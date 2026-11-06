/**
 * MediaFlow - Main Application (Bootstrapper)
 * Initializes all controllers and binds top-level UI events.
 * Version: 2.0 — Refactored (Phase 3 Hardening)
 */

(function () {
    'use strict';

    /**
     * Application initialization
     */
    function init() {
        console.log('[App] init() starting...');
        var initErrors = [];

        // Initialize CEP Bridge logging
        try { CEPBridge.log('info', 'Initializing MediaFlow...'); } catch (e) { initErrors.push('CEPBridge: ' + e.message); }

        // Initialize i18n Engine (Auto-detects After Effects language or loads preference)
        try { if (typeof I18N !== 'undefined') { I18N.init(); } } catch (e) { initErrors.push('I18N: ' + e.message); }

        // Initialize Theme Manager (Theme Auto-Sync)
        try { if (typeof ThemeManager !== 'undefined') { ThemeManager.init(); } } catch (e) { initErrors.push('ThemeManager: ' + e.message); }

        // Initialize Tab Manager
        try { TabManager.init(); } catch (e) { initErrors.push('TabManager: ' + e.message); }

        // Initialize Settings Manager
        try { SettingsManager.initialize(); } catch (e) { initErrors.push('SettingsManager: ' + e.message); }

        // Load saved preferences
        try { StateManager.loadPreferences(); } catch (e) { initErrors.push('StateManager: ' + e.message); }

        // Initialize Language Switcher (Header Dropdown & Settings Sync)
        try { if (typeof LanguageSwitcher !== 'undefined') { LanguageSwitcher.init(); } } catch (e) { initErrors.push('LanguageSwitcher: ' + e.message); }

        // Initialize UI Controller
        try { UIController.initialize(); } catch (e) { initErrors.push('UIController: ' + e.message); }

        // Initialize Smart Controller
        try {
            if (typeof SmartController !== 'undefined') { SmartController.init(); }
        } catch (e) { initErrors.push('SmartController: ' + e.message); }

        // Initialize Comp Tree UI
        try {
            if (typeof CompTreeUI !== 'undefined') { CompTreeUI.init(); }
        if (typeof BatchRenamer !== 'undefined') { BatchRenamer.init(); }
        } catch (e) { initErrors.push('CompTreeUI: ' + e.message); }

        // Initialize Shortcut Manager (Phase 4)
        try { if (typeof ShortcutManager !== 'undefined') { ShortcutManager.init(); } } catch (e) { initErrors.push('ShortcutManager: ' + e.message); }

        // Initialize Proxy Controller (Phase 4)
        try { if (typeof ProxyController !== 'undefined') { ProxyController.init(); } } catch (e) { initErrors.push('ProxyController: ' + e.message); }

        // Initialize Import Controller
        try { ImportController.init(); } catch (e) { initErrors.push('ImportController: ' + e.message); }

        // CRITICAL: Bind event handlers — MUST always run
        try {
            bindEventHandlers();
            console.log('[App] bindEventHandlers completed successfully');
        } catch (e) {
            initErrors.push('EventHandlers: ' + e.message);
            console.error('[App] bindEventHandlers FAILED:', e);
        }

        // Check AE project status
        try { ImportController.checkProjectStatus(); } catch (e) { initErrors.push('ProjectCheck: ' + e.message); }

        // Mark as ready and report any init errors to the user
        try {
            StateManager.set('isReady', true);
            CEPBridge.log('info', 'MediaFlow initialized successfully');

            if (initErrors.length > 0) {
                initErrors.forEach(function(err) {
                    console.error('[App] Init error:', err);
                    try { UIController.log('⚠️ Init: ' + err, 'warning'); } catch(e) {}
                });
            }
            UIController.log('Ready. Drop files to import.', 'info');
        } catch (e) { console.error('[App] Final init step failed:', e); }

        console.log('[App] init() completed');
    }

    /**
     * Bind top-level event handlers (non-import)
     */
    function bindEventHandlers() {
        EventBus.on(Events.SETTINGS_SHOW, UIController.showSettingsModal.bind(UIController));

        // Auto organize (Sort tab)
        EventBus.on(Events.AUTO_ORGANIZE_CLICKED, handleAutoOrganize);

        // Composition sorting
        EventBus.on(Events.SORT_COMPS_CLICKED, handleSortComps);

        // Comp Tree Actions
        EventBus.on(Events.COMP_TREE_RENDER_SELECTED, async function (compIds) {
            UIController.log('Adding ' + compIds.length + ' comps to Render Queue...', 'info');
            UIController.setProcessing(true);
            try {
                const response = await AEBridge.addCompsToRenderQueue(compIds);
                if (response.success && response.data) {
                    UIController.log('Added ' + response.data.addedCount + ' compositions to Render Queue', 'success');
                    if (typeof CompTreeUI !== 'undefined') {
                        CompTreeUI.clearSelection();
                    }
                } else {
                    UIController.log('Failed to add: ' + (response.error ? response.error.message : 'Unknown'), 'error');
                }
            } catch (e) {
                UIController.log('Error adding to Render Queue: ' + e.message, 'error');
            } finally {
                UIController.setProcessing(false);
            }
        });

        // Stats refresh
        EventBus.on(Events.STATS_REFRESH, handleStatsRefresh);

        // Smart Features (events emitted by smart-controller.js which owns the DOM buttons)
        EventBus.on(Events.ISOLATE_MISSING_CLICKED, handleIsolateMissing);
        EventBus.on(Events.ISOLATE_UNUSED_CLICKED, handleIsolateUnused);
        EventBus.on(Events.REMOVE_UNUSED_CLICKED, handleRemoveUnused);

        var purgeBtn = document.getElementById('btn-purge-cache');
        if (purgeBtn) {
            purgeBtn.addEventListener('click', function () {
                ModalManager.confirm(
                    'Purge System Caches',
                    '🧹 Are you sure you want to purge all memory and disk caches? This might take a moment but frees up system resources.',
                    async function () {
                        UIController.log('Purging caches...', 'info');
                        UIController.setProcessing(true);
                        try {
                            const response = await AEBridge.purgeCaches();
                            if (response.success) {
                                UIController.log('All caches successfully purged.', 'success');
                            } else {
                                UIController.log('Purge failed: ' + (response.error ? response.error.message : 'Unknown'), 'error');
                            }
                        } catch (e) {
                            UIController.log('Purge error: ' + e.message, 'error');
                        } finally {
                            UIController.setProcessing(false);
                        }
                    }
                );
            });
        }

        var deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        var deleteCancelBtn = document.getElementById('delete-cancel-btn');
        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', async function () {
                var modal = document.getElementById('delete-confirm-modal');
                if (modal) modal.classList.remove('active');

                var diskCheck = document.getElementById('delete-from-disk-checkbox');
                var deleteFromDisk = diskCheck ? diskCheck.checked : false;

                UIController.log('Removing unused media...', 'info');
                try {
                    // Pass pre-fetched IDs to avoid expensive double-scan
                    var unusedIds = (modal && modal._unusedItemIds) ? modal._unusedItemIds : [];
                    const response = await AEBridge.removeUnusedMedia({ deleteFromDisk: deleteFromDisk, itemIds: unusedIds });
                    if (response.success) {
                        UIController.log('Removed ' + (response.data.removedCount || 0) + ' items' + (deleteFromDisk ? ' from memory and disk' : ''), 'success');
                        handleStatsRefresh();
                    } else {
                        UIController.log('Remove failed: ' + (response.error ? response.error.message : 'Unknown'), 'error');
                    }
                } catch (e) {
                    UIController.log('Remove unused error: ' + e.message, 'error');
                }
            });
        }

        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', function () {
                var modal = document.getElementById('delete-confirm-modal');
                if (modal) modal.classList.remove('active');
                UIController.log('Remove cancelled', 'info');
            });
        }

        // Ensure refresh is ready
        setTimeout(handleStatsRefresh, 1000);

        // Tab changed — auto-refresh stats when stats tab is shown
        EventBus.on(Events.TAB_CHANGED, function (data) {
            if (data.tab === 'stats') {
                handleStatsRefresh();
            }
        });

        // Bind Sort tab buttons
        bindSortTabButtons();
    }

    /**
     * Bind sort tab button clicks
     */
    function bindSortTabButtons() {
        var sortAeBtn = document.getElementById('sort-ae-only');
        var sortOsAeBtn = document.getElementById('sort-os-ae');
        var sortCompsBtn = document.getElementById('sort-comps');
        var refreshStatsBtn = document.getElementById('refresh-stats');

        if (sortAeBtn) {
            sortAeBtn.addEventListener('click', function () {
                EventBus.emit(Events.AUTO_ORGANIZE_CLICKED, 'ae-only');
            });
        }
        if (sortOsAeBtn) {
            sortOsAeBtn.addEventListener('click', function () {
                EventBus.emit(Events.AUTO_ORGANIZE_CLICKED, 'os-ae');
            });
        }
        if (sortCompsBtn) {
            sortCompsBtn.addEventListener('click', function () {
                EventBus.emit(Events.SORT_COMPS_CLICKED);
            });
        }
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', function () {
                EventBus.emit(Events.STATS_REFRESH);
            });
        }
    }
    async function handleAutoOrganize(mode) {
        UIController.log('Scanning project items...', 'info');

        try {
            UIController.setProcessing(true);

            var options = {
                mode: mode,
                targetFolder: SettingsManager.get('organization', 'targetFolder') || 'MediaFlow Import',
                subOrganization: SettingsManager.get('organization', 'subOrganization') || 'extension',
                mediaFolderName: SettingsManager.get('organization', 'mediaFolderName') || '_media',
                folderNames: (typeof FolderPresets !== 'undefined') ? FolderPresets.getActiveFolderNames() : null
            };

            var fileTypes = null;
            if (typeof FILE_TYPES_CONFIG !== 'undefined') {
                fileTypes = FILE_TYPES_CONFIG;
            }
            if (fileTypes) {
                options.fileTypes = fileTypes;
            }

            const previewResponse = await AEBridge.getAutoOrganizePreview(options);
            UIController.setProcessing(false);

            if (previewResponse.success && previewResponse.data) {
                if (previewResponse.data.error) {
                    UIController.log('❌ Preview error: ' + previewResponse.data.error.message, 'error');
                    return;
                }

                if (previewResponse.data.moves) {
                    var moves = previewResponse.data.moves;

                    if (moves.length === 0) {
                        UIController.log('✅ Everything is already organized!', 'success');
                        return;
                    }

                    var listElem = document.getElementById('organize-preview-list');
                    if (listElem) {
                        listElem.innerHTML = '';
                        moves.forEach(m => {
                            var div = document.createElement('div');
                            div.className = 'sequence-item';
                            div.style.padding = '6px';
                            div.innerHTML = `
                            <div class="sequence-info">
                                <div><strong>${m.name}</strong></div>
                                <div style="font-size: 0.85em; opacity: 0.7; margin-top:2px;">
                                    <i class="fa-solid fa-arrow-right"></i> ${m.newPath}
                                </div>
                            </div>
                        `;
                            listElem.appendChild(div);
                        });
                    }

                    var modal = document.getElementById('organize-preview-modal');
                    if (modal) modal.classList.add('active');

                    // Remove old listener if any and add new one
                    var confirmBtn = document.getElementById('organize-preview-confirm-btn');
                    var cancelBtn = document.getElementById('organize-preview-cancel-btn');

                    var onConfirm = async function () {
                        confirmBtn.onclick = null;
                        cancelBtn.onclick = null;
                        if (modal) modal.classList.remove('active');

                        UIController.log('Organizing project...', 'info');
                        UIController.setProcessing(true);

                        try {
                            const response = await AEBridge.autoOrganizeProject(options);
                            if (response.success) {
                                var data = response.data;
                                var msg = '✅ Organized ' + data.movedCount + ' items';
                                if (data.movedVideo) msg += ' (🎬' + data.movedVideo + ')';
                                if (data.movedImage) msg += ' (🖼️' + data.movedImage + ')';
                                if (data.movedAudio) msg += ' (🔊' + data.movedAudio + ')';
                                if (data.movedSequence) msg += ' (📂' + data.movedSequence + ')';

                                UIController.log(msg, 'success');
                                if (options.mode === 'os-ae') {
                                    if (data.osMoved > 0) {
                                        UIController.log('📁 Copied ' + data.osMoved + ' files to project folder on disk', 'success');
                                    } else {
                                        UIController.log('⚠️ No files were copied to disk.', 'warning');
                                    }
                                }

                                if (data.failedItems && data.failedItems.length > 0) {
                                    data.failedItems.forEach(function (fi) {
                                        UIController.log('⚠️ ' + fi.name + ': ' + fi.reason, 'warning');
                                    });
                                }

                                UIController.flashDropzone('success');
                            } else {
                                UIController.log('Organize failed: ' + (response.error ? response.error.message : 'Unknown error'), 'error');
                            }
                        } catch (e) {
                            UIController.log('Organize error: ' + e.message, 'error');
                        } finally {
                            UIController.setProcessing(false);
                        }
                    };

                    var onCancel = function () {
                        confirmBtn.onclick = null;
                        cancelBtn.onclick = null;
                        if (modal) modal.classList.remove('active');
                        UIController.log('Organize cancelled.', 'info');
                    };

                    // Use onclick to cleanly replace any existing listeners without destroying DOM nodes
                    if (confirmBtn) confirmBtn.onclick = onConfirm;
                    if (cancelBtn) cancelBtn.onclick = onCancel;

                }
            } else {
                UIController.log('❌ Preview failed: ' + (previewResponse.error ? previewResponse.error.message : 'Unknown error'), 'error');
            }

        } catch (e) {
            UIController.setProcessing(false);
            UIController.log('❌ Sort error: ' + e.message, 'error');
            console.error('[handleAutoOrganize] Exception:', e);
        }
    }

    /**
     * Handle composition sorting
     */
    async function handleSortComps() {
        CEPBridge.log('info', 'Sort comps clicked');
        UIController.log('Organizing compositions...', 'info');

        try {
            const response = await AEBridge.organizeCompositions({
                targetFolder: ((typeof FolderPresets !== 'undefined' && FolderPresets.getActiveFolderNames().comps) || SettingsManager.get('organization', 'compFolder') || 'Compositions'),
                folderNames: (typeof FolderPresets !== 'undefined') ? FolderPresets.getActiveFolderNames() : null
            });

            if (response.success) {
                var data = response.data;
                var msg = 'Organized ' + data.organized + ' compositions';
                if (data.orphans > 0) msg += ' (' + data.orphans + ' unused)';
                UIController.log(msg, 'success');
                UIController.flashDropzone('success');
            } else {
                UIController.log('Comp organize failed: ' + (response.error ? response.error.message : 'Unknown error'), 'error');
            }
        } catch (e) {
            UIController.log('Comp organize error: ' + e.message, 'error');
        }
    }

    /**
     * Handle stats refresh
     */
    async function handleStatsRefresh() {
        try {
            const response = await AEBridge.getProjectStats();

            if (response.success) {
                var stats = response.data;

                updateStatValue('stat-video', stats.video || 0);
                updateStatValue('stat-image', stats.image || 0);
                updateStatValue('stat-audio', stats.audio || 0);
                updateStatValue('stat-comp', stats.comp || 0);
                updateStatValue('stat-missing', stats.missing || 0);
                updateStatValue('stat-total', stats.total || 0);
                updateStatValue('stat-size', formatSizeValue(stats.totalSize || 0));

                // Update unused badges
                updateUnusedBadge('stat-video-unused', stats.unusedVideo || 0);
                updateUnusedBadge('stat-image-unused', stats.unusedImage || 0);
                updateUnusedBadge('stat-audio-unused', stats.unusedAudio || 0);

                // Missing file count for Smart tab
                var missingBadge = document.getElementById('missing-count-badge');
                if (missingBadge) {
                    missingBadge.textContent = stats.missing || 0;
                    missingBadge.style.display = stats.missing > 0 ? 'inline-block' : 'none';
                }

                // Unused total for Smart tab
                var unusedTotal = (stats.unusedVideo || 0) + (stats.unusedImage || 0) + (stats.unusedAudio || 0);
                var unusedBadge = document.getElementById('unused-count-badge');
                if (unusedBadge) {
                    unusedBadge.textContent = unusedTotal;
                    unusedBadge.style.display = unusedTotal > 0 ? 'inline-block' : 'none';
                }

                // Render advanced health metrics
                if (typeof UIController.renderProjectHealth === 'function') {
                    UIController.renderProjectHealth(stats);
                }
            }
        } catch (e) {
            CEPBridge.log('error', 'Failed to refresh stats:', e);
        }
    }

    /**
     * Update a stat value element
     */
    function updateStatValue(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    /**
     * Format bytes to human-readable size
     */
    function formatSizeValue(bytes) {
        if (bytes === 0) return '0 B';
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Update an unused badge element
     */
    function updateUnusedBadge(id, count) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = count;
            if (count > 0) {
                el.classList.add('has-unused');
                el.style.display = 'inline-block';
            } else {
                el.classList.remove('has-unused');
                el.style.display = 'none';
            }
        }
    }

    /**
     * Handle isolate missing media click (Smart Feature)
     */
    async function handleIsolateMissing() {
        CEPBridge.log('info', 'Isolate missing media clicked');
        UIController.log('Scanning for missing media...', 'info');

        try {
            const response = await AEBridge.isolateMissingMedia();
            if (response.success) {
                UIController.log('Isolated ' + (response.data.count || 0) + ' missing items', 'success');
            } else {
                UIController.log('Isolate failed: ' + (response.error ? response.error.message : 'Unknown'), 'error');
            }
        } catch (e) {
            UIController.log('Isolate missing error: ' + e.message, 'error');
        }
    }

    /**
     * Handle isolate unused media click (Smart Feature)
     */
    async function handleIsolateUnused() {
        CEPBridge.log('info', 'Isolate unused media clicked');
        UIController.log('Scanning for unused media...', 'info');

        try {
            const response = await AEBridge.isolateUnusedMedia();
            if (response.success) {
                UIController.log('Isolated ' + (response.data.count || 0) + ' unused items', 'success');
            } else {
                UIController.log('Isolate failed: ' + (response.error ? response.error.message : 'Unknown'), 'error');
            }
        } catch (e) {
            UIController.log('Isolate unused error: ' + e.message, 'error');
        }
    }

    /**
     * Handle remove unused media click (Smart Feature — Irreversible)
     */
    async function handleRemoveUnused() {
        CEPBridge.log('info', 'Remove unused media clicked');

        try {
            UIController.setProcessing(true);
            UIController.log('Scanning for unused media...', 'info');
            const response = await AEBridge.getUnusedMediaList();
            UIController.setProcessing(false);

            if (response.success) {
                const items = response.data.items || [];
                if (items.length === 0) {
                    UIController.log('No unused media found in project.', 'info');
                    return;
                }

                // Populate Modal
                const countElem = document.getElementById('delete-confirm-count');
                const listElem = document.getElementById('delete-confirm-list');
                const diskCheck = document.getElementById('delete-from-disk-checkbox');

                if (countElem) countElem.textContent = items.length;
                if (listElem) {
                    listElem.innerHTML = '';
                    const fragment = document.createDocumentFragment();
                    var limit = Math.min(items.length, 100); // UI cap
                    for (var i = 0; i < limit; i++) {
                        const item = items[i];
                        const div = document.createElement('div');
                        div.className = 'sequence-item';
                        div.style.padding = '4px 8px';
                        div.innerHTML = '<div class="sequence-info"><i class="fa-solid fa-file"></i><span>' + item.name + '</span></div>';
                        fragment.appendChild(div);
                    }
                    if (items.length > limit) {
                        var moreDiv = document.createElement('div');
                        moreDiv.style.padding = '8px';
                        moreDiv.style.opacity = '0.6';
                        moreDiv.style.textAlign = 'center';
                        moreDiv.innerHTML = '<i>And ' + (items.length - limit) + ' more item(s)...</i>';
                        fragment.appendChild(moreDiv);
                    }
                    listElem.appendChild(fragment);
                }
                if (diskCheck) diskCheck.checked = false;

                // Show Modal and store IDs for efficient removal
                const modal = document.getElementById('delete-confirm-modal');
                if (modal) {
                    modal.classList.add('active');
                    // Store item IDs to avoid double-scan when confirming delete
                    modal._unusedItemIds = items.map(function (item) { return item.id; });
                }
            } else {
                UIController.log('Scan failed: ' + (response.error ? response.error.message : 'Unknown'), 'error');
            }
        } catch (e) {
            UIController.setProcessing(false);
            UIController.log('Scan error: ' + e.message, 'error');
        }
    }

    /**
     * Initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
