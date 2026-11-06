/**
 * MediaFlow - Utilities
 * Helper functions for ExtendScript
 * Version: 1.0
 */

// Define Root Namespace if not exists
if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

/**
 * MediaFlow.Utils Namespace
 */
MediaFlow.Utils = {
    /**
     * Normalize path separators
     * @sync Mirrored in js/file-handler.js → normalizePath()
     * @param {string} path
     * @returns {string}
     */
    normalizePath: function (path) {
        return path.replace(/\\/g, '/');
    },

    /**
     * Get file extension
     * @sync Mirrored in js/file-handler.js → getExtension()
     * @param {string} path
     * @returns {string}
     */
    getFileExtension: function (path) {
        var parts = path.split('.');
        if (parts.length < 2) return '';
        return parts[parts.length - 1].toLowerCase();
    },

    /**
     * Get file name from path
     * @sync Mirrored in js/file-handler.js → getFileName()
     * @param {string} path
     * @returns {string}
     */
    getFileName: function (path) {
        var normalized = this.normalizePath(path);
        var parts = normalized.split('/');
        return parts[parts.length - 1];
    },

    /**
     * Get directory from path
     * @sync Mirrored in js/file-handler.js → getDirectory()
     * @param {string} path
     * @returns {string}
     */
    getFileDirectory: function (path) {
        var normalized = this.normalizePath(path);
        var parts = normalized.split('/');
        parts.pop();
        return parts.join('/');
    },

    /**
     * Check if file exists
     * @param {string} path
     * @returns {boolean}
     */
    fileExists: function (path) {
        var file = new File(path);
        return file.exists;
    },

    /**
     * Check if folder exists
     * @param {string} path
     * @returns {boolean}
     */
    folderExists: function (path) {
        var folder = new Folder(path);
        return folder.exists;
    },

    /**
     * Create folder recursively (creates all parent directories)
     * @param {string} path
     * @returns {Folder|null}
     */
    ensureFolder: function (path) {
        var folder = new Folder(path);
        if (folder.exists) return folder;

        // Recursively create parent first
        var parent = folder.parent;
        if (parent && !parent.exists) {
            this.ensureFolder(parent.fsName);
        }

        var created = folder.create();
        if (created) {
            return folder;
        }
        return null;
    },

    /**
     * Get file size
     * @param {string} path
     * @returns {number} Size in bytes, or -1 if error
     */
    getFileSize: function (path) {
        var file = new File(path);
        var size = -1;

        if (file.exists) {
            size = file.length;
        }

        return size;
    },

    /**
     * Copy file using ExtendScript native File.copy()
     * @param {string} sourcePath
     * @param {string} targetPath
     * @returns {object} { success, bytesCopied, error }
     */
    copyFileInternal: function (sourcePath, targetPath) {
        var result = {
            success: false,
            bytesCopied: 0,
            error: null
        };

        try {
            var sourceFile = new File(sourcePath);

            if (!sourceFile.exists) {
                result.error = 'Source file not found: ' + sourcePath;
                return result;
            }

            // Ensure target directory exists (recursively)
            var targetDir = this.getFileDirectory(targetPath);
            var dirResult = this.ensureFolder(targetDir);
            if (!dirResult) {
                result.error = 'Could not create target folder: ' + targetDir;
                return result;
            }

            // Bypassing ExtendScript's 32-bit buffering limit: Files over 300MB will crash or stall AE internally.
            var copySuccess = false;
            if (sourceFile.length < 300 * 1024 * 1024) { // 300 MB threshold
                copySuccess = sourceFile.copy(targetPath);
            }

            // Fallback: If File.copy() fails (common with certain Unicode/locked files in AE)
            if (!copySuccess) {
                try {
                    var isMac = ($.os.toLowerCase().indexOf('mac') >= 0);
                    var cmd = '';
                    if (isMac) {
                        cmd = 'cp "' + sourcePath + '" "' + targetPath + '"';
                        system.callSystem(cmd);
                    } else {
                        var winSrc = sourcePath.replace(/\//g, '\\');
                        // By feeding xcopy a directory with a trailing backslash, it implicitly knows 
                        // it's a directory and never prompts (bypass the broken pipe `|` in ExtendScript)
                        var winDstDir = targetDir.replace(/\//g, '\\') + '\\';
                        
                        // Create an invisible VBScript envelope to run xcopy completely hidden (No PowerShell windows!)
                        var vbsCode = 'Set objShell = WScript.CreateObject("WScript.Shell")\n';
                        var cmdLine = 'cmd.exe /c xcopy /Y /J /Q ""' + winSrc + '"" ""' + winDstDir + '""';
                        vbsCode += 'objShell.Run "' + cmdLine + '", 0, True\n';
                        
                        var vbsFile = new File(Folder.temp.fsName + '/mf_hidden_copy_' + new Date().getTime() + '.vbs');
                        vbsFile.open('w');
                        vbsFile.write(vbsCode);
                        vbsFile.close();

                        // wscript launches instantly and invisibly in the OS background
                        system.callSystem('wscript.exe //nologo "' + vbsFile.fsName.replace(/\//g, '\\') + '"');
                        
                        // Smart ExtendScript polling to wait for the silent background copy to finish
                        var checkFallback = new File(targetPath);
                        var pollTicks = 0;
                        while(pollTicks < 900) { // 15 minutes max
                            // Refresh the file object to get latest disk bytes
                            checkFallback = new File(targetPath);
                            if (checkFallback.exists && checkFallback.length >= sourceFile.length) {
                                $.sleep(500); // Give OS tiny buffer time to release lock
                                copySuccess = true;
                                break;
                            }
                            $.sleep(1000); // 0 CPU cost
                            pollTicks++;
                        }
                        
                        vbsFile.remove();
                    }

                    var checkFallback = new File(targetPath);
                    if (checkFallback.exists && checkFallback.length > 0) {
                        copySuccess = true;
                    }
                } catch (cmdErr) {
                    // Native fallback failed too
                }
            }

            if (copySuccess) {
                var checkFile = new File(targetPath);
                result.success = true;
                result.bytesCopied = checkFile.exists ? checkFile.length : sourceFile.length;
            } else {
                result.error = 'File.copy() and OS fallback failed for: ' + sourcePath;
            }
        } catch (e) {
            result.error = 'Copy error: ' + e.message;
        }

        return result;
    },

    /**
     * Move file using copy then remove for cross-drive safety
     * @param {string} sourcePath
     * @param {string} targetPath
     * @returns {object} { success, bytesCopied, error }
     */
    moveFileInternal: function (sourcePath, targetPath) {
        var result = this.copyFileInternal(sourcePath, targetPath);
        
        if (result.success) {
            try {
                var sourceFile = new File(sourcePath);
                if (sourceFile.exists) {
                    var removed = sourceFile.remove();
                    if (!removed) {
                        this.log('Could not remove original file during move: ' + sourcePath);
                    }
                }
            } catch (e) {
                this.log('Exception removing original file: ' + e.message);
            }
        }
        
        return result;
    },

    /**
     * Generate unique file name
     * @param {string} basePath
     * @param {string} fileName
     * @returns {string}
     */
    generateUniqueFileName: function (basePath, fileName) {
        var targetPath = basePath + '/' + fileName;

        if (!this.fileExists(targetPath)) {
            return fileName;
        }

        var ext = this.getFileExtension(fileName);
        var baseName = fileName.substring(0, fileName.length - ext.length - 1);
        var counter = 1;

        while (this.fileExists(basePath + '/' + baseName + '_' + counter + '.' + ext)) {
            counter++;
        }

        return baseName + '_' + counter + '.' + ext;
    },

    /**
     * Detect file type from extension
     * @sync Mirrored in js/file-handler.js → detectType()
     *       Extension lists must match js/config/file-types.js (Single Source of Truth)
     * @param {string} path
     * @returns {string}
     */
    /**
     * Helper to check if array contains value (ES3 compatible)
     * @param {Array} arr 
     * @param {*} val 
     * @returns {boolean}
     */
    arrayContains: function (arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return true;
        }
        return false;
    },

    /**
     * Detect file type from extension
     * @sync Mirrored in js/file-handler.js → detectType()
     *       Extension lists must match js/config/file-types.js (Single Source of Truth)
     * @param {string} path
     * @returns {string}
     */
    detectFileType: function (path, fileTypes) {
        var ext = this.getFileExtension(path);

        var videoExts = fileTypes ? fileTypes.video : ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mxf', 'prores', 'r3d', 'braw', 'mts', 'm2ts', 'ts', 'mpg', 'mpeg', 'wmv', 'flv', '3gp', 'rmvb'];
        var audioExts = fileTypes ? fileTypes.audio : ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'aiff', 'aif', 'wma', 'ac3', 'pcm'];
        var imageExts = fileTypes ? fileTypes.image : ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'psd', 'psb', 'ai', 'svg', 'exr', 'bmp', 'dpx', 'tga', 'webp', 'hdr', 'ico', 'sgi', 'cin'];
        var sequenceExts = fileTypes ? fileTypes.sequence : ['png', 'tiff', 'tif', 'exr', 'dpx', 'tga', 'jpg', 'jpeg', 'webp', 'cin', 'sgi'];

        if (videoExts && this.arrayContains(videoExts, ext)) return 'video';
        if (audioExts && this.arrayContains(audioExts, ext)) return 'audio';

        // Check sequence-eligible formats: if the filename matches a sequence pattern, classify as sequence
        if (sequenceExts && this.arrayContains(sequenceExts, ext) && this.isSequence(path)) {
            return 'sequence';
        }

        if (imageExts && this.arrayContains(imageExts, ext)) return 'image';

        return 'unknown';
    },

    /**
     * Check if file is a sequence
     * @sync Mirrored in js/file-handler.js → isSequence()
     * @param {string} path
     * @returns {boolean}
     */
    isSequence: function (path) {
        var fileName = this.getFileName(path);
        // Check for sequence patterns
        var patterns = [
            /_(\d+)\.([a-zA-Z0-9]+)$/i,       // file_001.png
            /\.(\d+)\.([a-zA-Z0-9]+)$/i,      // file.0001.exr
            /[\-\s](\d{2,})\.([a-zA-Z0-9]+)$/i  // file-001.tiff or file 001.tiff (requires separator + 2+ digits)
        ];

        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i].test(fileName)) {
                return true;
            }
        }

        return false;
    },

    /**
     * Get sequence info
     * @param {string} path
     * @returns {object|null}
     */
    getSequenceInfo: function (path) {
        var fileName = this.getFileName(path);
        var patterns = [
            /_(\d+)\.([a-zA-Z0-9]+)$/i,       // file_001.png
            /\.(\d+)\.([a-zA-Z0-9]+)$/i,      // file.0001.exr
            /[\-\s](\d{2,})\.([a-zA-Z0-9]+)$/i  // file-001.tiff (requires separator + 2+ digits)
        ];

        for (var i = 0; i < patterns.length; i++) {
            var match = fileName.match(patterns[i]);
            if (match) {
                var numStr = match[1];
                var ext = match[2];
                var suffixToStrip = match[0];
                var baseFileName = fileName.substring(0, fileName.length - suffixToStrip.length + (suffixToStrip.charAt(0) === '.' || suffixToStrip.charAt(0) === '_' ? 1 : 0));

                var dirPath = path.substring(0, path.length - fileName.length);
                var baseName = dirPath + baseFileName;

                return {
                    baseName: baseName,
                    padding: numStr.length,
                    startFrame: parseInt(numStr, 10),
                    extension: ext.toLowerCase()
                };
            }
        }

        return null;
    },

    /**
     * Log to ExtendScript console
     * @param {string} message
     */
    log: function (message) {
        $.writeln('[MediaFlow] ' + message);
    },

    /**
     * Safe execute with error handling
     * @param {Function} fn
     * @returns {*}
     */
    safeExecute: function (fn) {
        try {
            return fn();
        } catch (e) {
            this.log('Error: ' + e.message);
            return null;
        }
    },

    /**
     * Check if a project item is truly used by tracing its usage chain
     * up to either a Render Queue comp or a top-level Root Comp.
     * Uses BFS to avoid stack overflow on deep hierarchies.
     * 
     * @param {Item} item - The project item to check
     * @param {object} renderQueueCompIds - Map of comp IDs in the Render Queue
     * @returns {boolean} True if item traces to an active comp
     */
    isItemTrulyUsed: function (item, renderQueueCompIds) {
        if (!item.usedIn || item.usedIn.length === 0) return false;

        var visited = {};
        var queue = item.usedIn.slice(0); // clone array

        while (queue.length > 0) {
            var parentComp = queue.shift();

            if (visited[parentComp.id]) continue;
            visited[parentComp.id] = true;

            // Condition A: Comp is explicitly in Render Queue
            if (renderQueueCompIds[parentComp.id]) return true;

            // Condition B: Comp is a Top-Level Root Comp (used nowhere else)
            if (!parentComp.usedIn || parentComp.usedIn.length === 0) {
                return true;
            }

            // Trace further up the tree
            for (var i = 0; i < parentComp.usedIn.length; i++) {
                queue.push(parentComp.usedIn[i]);
            }
        }

        return false;
    }
};
