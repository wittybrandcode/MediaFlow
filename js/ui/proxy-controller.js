/**
 * MediaFlow - Proxy UI Controller (Phase 4)
 * Handles UI interactions for video proxy generation and transcode management (SOLID: Single Responsibility)
 * Fully localized via I18N Engine
 */

var ProxyController = (function () {
    let elements = {};
    let footageList = [];
    let isProcessing = false;

    function _t(key, params, fallback) {
        if (typeof I18N !== 'undefined') {
            return I18N.t(key, params, fallback);
        }
        return fallback || key;
    }

    /**
     * Cache needed DOM elements
     */
    function cacheElements() {
        elements = {
            btnOpenManager: document.getElementById('btn-open-proxy-manager'),
            ffmpegStatusBadge: document.getElementById('ffmpeg-status-badge'),
            modal: document.getElementById('proxy-manager-modal'),
            closeTop: document.getElementById('proxy-modal-close-top'),
            cancelBtn: document.getElementById('proxy-modal-cancel-btn'),
            startBtn: document.getElementById('proxy-start-btn'),
            stopBtn: document.getElementById('proxy-stop-btn'),
            presetSelect: document.getElementById('proxy-preset-select'),
            outputFolderInput: document.getElementById('proxy-output-folder'),
            browseFolderBtn: document.getElementById('proxy-browse-folder-btn'),
            autoAttachCheck: document.getElementById('proxy-auto-attach'),
            footageContainer: document.getElementById('proxy-footage-list'),
            selectAllBtn: document.getElementById('proxy-select-all-btn'),
            refreshListBtn: document.getElementById('proxy-refresh-list-btn'),
            progressContainer: document.getElementById('proxy-progress-container'),
            progressBar: document.getElementById('proxy-progress-bar'),
            statusText: document.getElementById('proxy-status-text'),
            percentageText: document.getElementById('proxy-percentage-text'),
            speedText: document.getElementById('proxy-speed-text'),
            currentFileText: document.getElementById('proxy-current-file-text')
        };
    }

    /**
     * Check FFmpeg availability and update badge
     */
    async function checkFFmpegStatus() {
        if (typeof Transcoder === 'undefined') return;
        const res = await Transcoder.checkFFmpeg();
        if (elements.ffmpegStatusBadge) {
            if (res.available) {
                elements.ffmpegStatusBadge.className = 'comp-badge badge-root';
                elements.ffmpegStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + _t('smart.badgeFfmpegReady', null, 'FFmpeg Ready');
            } else {
                elements.ffmpegStatusBadge.className = 'comp-badge badge-warning';
                elements.ffmpegStatusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + _t('smart.badgeFfmpegNotFound', null, 'FFmpeg Not Found');
            }
        }
    }

    /**
     * Load project footage items eligible for proxy
     */
    async function loadFootage() {
        if (!elements.footageContainer) return;
        elements.footageContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> ' + _t('proxy.scanningFootage', null, 'Scanning video footage in project...') + '</div>';

        try {
            const res = await AEBridge.getFootageForProxy();
            if (res.success && res.data && res.data.items) {
                footageList = res.data.items;
                renderFootageList();
            } else {
                elements.footageContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);">' + _t('proxy.noFootageFound', null, 'No video footage found in project.') + '</div>';
            }
        } catch (e) {
            elements.footageContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #ff5252;">Footage scan error: ' + e.message + '</div>';
        }
    }

    /**
     * Render footage list inside modal
     */
    function renderFootageList() {
        if (!elements.footageContainer) return;

        if (footageList.length === 0) {
            elements.footageContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);">' + _t('proxy.noFootagePrompt', null, 'No video footage in project. Import video files first.') + '</div>';
            return;
        }

        let html = '';
        footageList.forEach(function (f) {
            const resText = (f.width && f.height) ? `${f.width}x${f.height}` : 'Video';
            const fpsText = f.frameRate ? `${Math.round(f.frameRate)} fps` : '';
            const proxyStatus = f.hasProxy ? '<span class="comp-badge badge-root">Has Proxy</span>' : '<span class="comp-badge badge-sub">Original</span>';

            html += `<div class="rename-preview-row">
                <label style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;">
                    <input type="checkbox" class="proxy-footage-checkbox" value="${f.id}" ${f.hasProxy ? '' : 'checked'} style="accent-color: #00bcd4;" />
                    <i class="fa-solid fa-file-video" style="color: #00bcd4;"></i>
                    <span class="rename-new-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
                </label>
                <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-right: 8px;">${resText} ${fpsText}</span>
                ${proxyStatus}
            </div>`;
        });

        elements.footageContainer.innerHTML = html;
    }

    /**
     * Browse output directory for proxies
     */
    async function browseOutputFolder() {
        try {
            const folder = await CEPBridge.openFolderPicker('Select Directory for Generated Proxies');
            if (folder && elements.outputFolderInput) {
                elements.outputFolderInput.value = folder;
            }
        } catch (e) { }
    }

    /**
     * Open Proxy Manager modal
     */
    function openManager() {
        if (elements.modal) {
            elements.modal.classList.add('active');
            checkFFmpegStatus();
            loadFootage();
        }
    }

    /**
     * Close Proxy Manager modal
     */
    function closeManager() {
        if (isProcessing) {
            if (!confirm('Transcode is in progress. Are you sure you want to stop?')) return;
            Transcoder.cancel();
            isProcessing = false;
        }
        if (elements.modal) {
            elements.modal.classList.remove('active');
        }
    }

    /**
     * Start batch transcoding selected footage
     */
    async function startBatchTranscode() {
        if (!elements.modal || isProcessing) return;

        const checkedBoxes = Array.from(elements.modal.querySelectorAll('.proxy-footage-checkbox:checked'));
        if (checkedBoxes.length === 0) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.warning(_t('proxy.selectAtLeastOne', null, 'Please select at least one video file.'));
            return;
        }

        const selectedIds = checkedBoxes.map(cb => parseInt(cb.value, 10));
        const itemsToProcess = footageList.filter(f => selectedIds.indexOf(f.id) !== -1);

        const presetKey = elements.presetSelect ? elements.presetSelect.value : 'prores_proxy';
        const customFolder = elements.outputFolderInput ? elements.outputFolderInput.value.trim() : '';
        const autoAttach = elements.autoAttachCheck ? elements.autoAttachCheck.checked : true;

        isProcessing = true;
        if (elements.startBtn) elements.startBtn.style.display = 'none';
        if (elements.stopBtn) elements.stopBtn.style.display = 'inline-flex';
        if (elements.progressContainer) elements.progressContainer.style.display = 'block';

        let completed = 0;
        let failed = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
            if (!isProcessing) break;

            const item = itemsToProcess[i];
            const outPath = Transcoder.getDefaultProxyPath(item.path, presetKey, customFolder);

            try {
                if (typeof MFAdapter !== 'undefined') {
                    const norm = outPath.replace(/\\/g, '/');
                    const dir = norm.substring(0, norm.lastIndexOf('/'));
                    MFAdapter.fs.ensureDir(dir);
                }
            } catch (e) { }

            if (elements.statusText) elements.statusText.textContent = `Transcoding (${i + 1}/${itemsToProcess.length}): ${item.name}`;
            if (elements.currentFileText) elements.currentFileText.textContent = `Target: ${outPath.split('/').pop().split('\\').pop()}`;

            try {
                await Transcoder.transcode(item.path, outPath, presetKey, item.duration, function (prog) {
                    if (elements.progressBar) elements.progressBar.style.width = prog.percentage + '%';
                    if (elements.percentageText) elements.percentageText.textContent = prog.percentage + '%';
                    if (elements.speedText) elements.speedText.textContent = `Speed: ${prog.speed || '1x'} (${prog.fps || 0} fps)`;
                });

                completed++;

                if (autoAttach) {
                    try {
                        await AEBridge.setFootageProxy(item.id, outPath);
                    } catch (attachErr) { }
                }

            } catch (transErr) {
                failed++;
            }
        }

        isProcessing = false;
        if (elements.startBtn) elements.startBtn.style.display = 'inline-flex';
        if (elements.stopBtn) elements.stopBtn.style.display = 'none';

        if (elements.progressBar) elements.progressBar.style.width = '100%';
        if (elements.statusText) elements.statusText.textContent = `Done! Created ${completed} proxy file(s). (Failed: ${failed})`;

        if (typeof ToastSystem !== 'undefined') {
            ToastSystem.success(_t('toasts.proxyCreated', null, `Created and attached ${completed} proxy file(s)!`));
        }

        loadFootage();
    }

    /**
     * Stop ongoing transcode
     */
    function stopTranscode() {
        if (isProcessing) {
            Transcoder.cancel();
            isProcessing = false;
            if (elements.startBtn) elements.startBtn.style.display = 'inline-flex';
            if (elements.stopBtn) elements.stopBtn.style.display = 'none';
            if (elements.statusText) elements.statusText.textContent = 'Transcoding stopped by user.';
            if (typeof ToastSystem !== 'undefined') ToastSystem.info(_t('proxy.cancelled', null, 'Transcoding cancelled.'));
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        if (elements.btnOpenManager) elements.btnOpenManager.addEventListener('click', openManager);
        if (elements.closeTop) elements.closeTop.addEventListener('click', closeManager);
        if (elements.cancelBtn) elements.cancelBtn.addEventListener('click', closeManager);
        if (elements.browseFolderBtn) elements.browseFolderBtn.addEventListener('click', browseOutputFolder);
        if (elements.refreshListBtn) elements.refreshListBtn.addEventListener('click', loadFootage);
        if (elements.startBtn) elements.startBtn.addEventListener('click', startBatchTranscode);
        if (elements.stopBtn) elements.stopBtn.addEventListener('click', stopTranscode);

        if (elements.selectAllBtn) {
            elements.selectAllBtn.addEventListener('click', function () {
                const boxes = elements.footageContainer ? elements.footageContainer.querySelectorAll('.proxy-footage-checkbox') : [];
                const anyUnchecked = Array.from(boxes).some(b => !b.checked);
                boxes.forEach(b => b.checked = anyUnchecked);
            });
        }
    }

    // Public API
    return {
        init: function () {
            cacheElements();
            bindEvents();
            checkFFmpegStatus();
        },
        openManager: openManager
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProxyController;
}
