/**
 * MediaFlow - Proxy & Transcode Engine (Phase 4)
 * Handles background video transcoding and proxy generation via FFmpeg & Node.js
 */

var Transcoder = (function () {
    let cachedFFmpegPath = null;
    let isFFmpegAvailable = false;
    let ffmpegVersion = '';
    let currentProcess = null;

    // Built-in studio presets
    const PRESETS = {
        'prores_proxy': {
            name: 'Apple ProRes 422 Proxy (Recommended for AE)',
            ext: 'mov',
            description: 'Industry standard for ultra-smooth timeline playback and low CPU overhead.',
            getArgs: function (input, output) {
                return ['-i', input, '-c:v', 'prores_ks', '-profile:v', '0', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le', '-y', output];
            }
        },
        'prores_lt': {
            name: 'Apple ProRes 422 LT (High Quality Proxy)',
            ext: 'mov',
            description: 'Near-master quality playback proxy suitable for client review drafts.',
            getArgs: function (input, output) {
                return ['-i', input, '-c:v', 'prores_ks', '-profile:v', '1', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le', '-y', output];
            }
        },
        'mp4_720p': {
            name: 'H.264 Fast 720p Proxy (Lightweight)',
            ext: 'mp4',
            description: 'Minimal disk space usage, downscaled to 720p with fast encoding.',
            getArgs: function (input, output) {
                return ['-i', input, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', '-y', output];
            }
        },
        'mp4_1080p': {
            name: 'H.264 Fast 1080p Proxy',
            ext: 'mp4',
            description: 'Crisp 1080p proxy for balanced previewing on high-resolution displays.',
            getArgs: function (input, output) {
                return ['-i', input, '-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', '-y', output];
            }
        },
        'prores_4444_alpha': {
            name: 'Apple ProRes 4444 (Preserve Alpha)',
            ext: 'mov',
            description: 'Lossless proxy preserving transparency / alpha channel.',
            getArgs: function (input, output) {
                return ['-i', input, '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-c:a', 'copy', '-y', output];
            }
        },
        'wav_48k': {
            name: 'Extract Broadcast Audio (24-bit 48kHz WAV)',
            ext: 'wav',
            description: 'Fixes AE MP3 audio drift and sample rate mismatches.',
            getArgs: function (input, output) {
                return ['-i', input, '-vn', '-c:a', 'pcm_s24le', '-ar', '48000', '-y', output];
            }
        }
    };

    /**
     * Check if running in a Node.js-capable environment
     */
    function hasNode() {
        return (typeof require !== 'undefined');
    }

    /**
     * Detect FFmpeg installation and verify execution
     * @param {string} customPath - Optional path specified by user in settings
     * @returns {Promise<object>} { available: boolean, path: string, version: string }
     */
    async function checkFFmpeg(customPath) {
        if (!hasNode()) {
            return { available: false, path: '', version: 'Browser Mode (Node unavailable)' };
        }

        const cp = require('child_process');
        const candidatePaths = [];

        if (customPath && customPath.trim()) candidatePaths.push(customPath.trim());
        if (cachedFFmpegPath) candidatePaths.push(cachedFFmpegPath);
        candidatePaths.push('ffmpeg');

        // Check common WinGet / Windows locations
        if (process.platform === 'win32') {
            const userProfile = process.env.USERPROFILE || '';
            if (userProfile) {
                candidatePaths.push(userProfile + '\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe');
            }
        }

        for (let i = 0; i < candidatePaths.length; i++) {
            const candidate = candidatePaths[i];
            const checkResult = await new Promise(function (resolve) {
                try {
                    cp.exec('"' + candidate + '" -version', { timeout: 4000 }, function (err, stdout) {
                        if (!err && stdout && stdout.indexOf('ffmpeg version') !== -1) {
                            const firstLine = stdout.split('\n')[0].trim();
                            resolve({ success: true, path: candidate, version: firstLine });
                        } else {
                            resolve({ success: false });
                        }
                    });
                } catch (e) {
                    resolve({ success: false });
                }
            });

            if (checkResult.success) {
                cachedFFmpegPath = checkResult.path;
                isFFmpegAvailable = true;
                ffmpegVersion = checkResult.version;
                return {
                    available: true,
                    path: cachedFFmpegPath,
                    version: ffmpegVersion
                };
            }
        }

        isFFmpegAvailable = false;
        return {
            available: false,
            path: '',
            version: 'FFmpeg not detected'
        };
    }

    /**
     * Parse duration in seconds from FFmpeg time string "00:01:23.45"
     */
    function parseTimeString(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        if (parts.length === 3) {
            const hours = parseFloat(parts[0]) || 0;
            const minutes = parseFloat(parts[1]) || 0;
            const seconds = parseFloat(parts[2]) || 0;
            return (hours * 3600) + (minutes * 60) + seconds;
        }
        return 0;
    }

    /**
     * Transcode a single file using FFmpeg
     * @param {string} inputPath - Absolute source path
     * @param {string} outputPath - Absolute target path
     * @param {string} presetKey - Preset identifier
     * @param {number} totalDuration - Video duration in seconds (for progress)
     * @param {Function} onProgress - Callback with { percentage, speed, fps, currentTime }
     * @returns {Promise<object>}
     */
    function transcode(inputPath, outputPath, presetKey, totalDuration, onProgress) {
        return new Promise(function (resolve, reject) {
            if (!hasNode()) {
                return reject(new Error('Node.js is not available'));
            }
            if (!isFFmpegAvailable && !cachedFFmpegPath) {
                return reject(new Error('FFmpeg is not configured or available'));
            }

            const preset = PRESETS[presetKey] || PRESETS.prores_proxy;
            const args = preset.getArgs(inputPath, outputPath);
            const cp = require('child_process');

            try {
                currentProcess = cp.spawn(cachedFFmpegPath || 'ffmpeg', args);
            } catch (spawnErr) {
                return reject(spawnErr);
            }

            let stderrLog = '';

            currentProcess.stderr.on('data', function (chunk) {
                const text = chunk.toString();
                stderrLog += text;

                // Parse time and speed from FFmpeg stderr stream
                const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
                const speedMatch = text.match(/speed=\s*([\d\.]+x)/);
                const fpsMatch = text.match(/fps=\s*([\d\.]+)/);

                if (timeMatch && onProgress) {
                    const currentTime = parseTimeString(timeMatch[1]);
                    let percentage = 0;
                    if (totalDuration && totalDuration > 0) {
                        percentage = Math.min(100, Math.round((currentTime / totalDuration) * 100));
                    }
                    onProgress({
                        percentage: percentage,
                        currentTime: currentTime,
                        speed: speedMatch ? speedMatch[1] : '1.0x',
                        fps: fpsMatch ? fpsMatch[1] : '0'
                    });
                }
            });

            currentProcess.on('error', function (err) {
                currentProcess = null;
                reject(err);
            });

            currentProcess.on('close', function (code) {
                currentProcess = null;
                if (code === 0) {
                    resolve({
                        success: true,
                        outputPath: outputPath,
                        preset: presetKey
                    });
                } else {
                    reject(new Error('FFmpeg exited with error code ' + code + ': ' + stderrLog.slice(-300)));
                }
            });
        });
    }

    /**
     * Cancel currently active transcode job
     */
    function cancel() {
        if (currentProcess) {
            try {
                currentProcess.kill('SIGKILL');
            } catch (e) { }
            currentProcess = null;
            return true;
        }
        return false;
    }

    /**
     * Get default proxy path for a given footage file
     * @param {string} sourcePath - Original footage path
     * @param {string} presetKey - Preset identifier
     * @param {string} customFolder - Optional proxy directory
     * @returns {string} Suggested proxy file path
     */
    function getDefaultProxyPath(sourcePath, presetKey, customFolder) {
        const preset = PRESETS[presetKey] || PRESETS.prores_proxy;
        const normalized = sourcePath.replace(/\\/g, '/');
        const lastSlash = normalized.lastIndexOf('/');
        const dir = (lastSlash !== -1) ? normalized.substring(0, lastSlash) : '';
        const fileName = (lastSlash !== -1) ? normalized.substring(lastSlash + 1) : normalized;
        const extDot = fileName.lastIndexOf('.');
        const baseName = (extDot !== -1) ? fileName.substring(0, extDot) : fileName;

        const targetDir = customFolder ? customFolder.replace(/\\/g, '/') : (dir + '/_proxies');
        return targetDir + '/' + baseName + '_proxy.' + preset.ext;
    }

    // Public API
    return {
        PRESETS: PRESETS,
        checkFFmpeg: checkFFmpeg,
        transcode: transcode,
        cancel: cancel,
        getDefaultProxyPath: getDefaultProxyPath,
        isAvailable: function () { return isFFmpegAvailable; },
        getVersion: function () { return ffmpegVersion; },
        getPath: function () { return cachedFFmpegPath; }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Transcoder;
}

