/**
 * MediaFlow - UI Controller
 * DOM manipulation and rendering
 * Version: 1.1
 */

const UIController = (function () {
    'use strict';

    /**
     * DOM element cache
     */
    let elements = {};

    /**
     * Initialize DOM references
     */
    function cacheElements() {
        elements = {
            dropzone: document.getElementById('dropzone'),
            fileCounter: document.getElementById('file-counter'),
            fileCount: document.getElementById('file-count'),
            browseBtn: document.getElementById('browse-btn'),
            log: document.getElementById('log'),
            progressContainer: document.getElementById('progress-container'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            progressFilename: document.getElementById('progress-filename'),
            progressStats: document.getElementById('progress-stats'),
            progressSpeed: document.getElementById('progress-speed'),
            progressAbortBtn: document.getElementById('progress-abort-btn'),
            modal: document.getElementById('modal'),
            rememberChoice: document.getElementById('remember-choice'),
            modeButtons: document.querySelectorAll('#modal .mode-btn'),

            // New Sequence UI Elements
            detectedSequencesContainer: document.getElementById('detected-sequences-container'),
            sequenceList: document.getElementById('sequence-list'),

            // Settings elements (inline in tab pane)
            settingsSave: document.getElementById('settings-save'),
            settingsReset: document.getElementById('settings-reset'),
            // Settings inputs
            settingDefaultMode: document.getElementById('setting-defaultMode'),
            settingRememberChoice: document.getElementById('setting-rememberChoice'),
            settingMediaFolderName: document.getElementById('setting-mediaFolderName'),
            settingMainFolderType: document.getElementById('setting-mainFolderType'),
            settingMainFolderName: document.getElementById('setting-mainFolderName'),
            settingSubOrganization: document.getElementById('setting-subOrganization'),
            settingDuplicateHandling: document.getElementById('setting-duplicateHandling'),
            settingAutoDetectSequences: document.getElementById('setting-autoDetectSequences'),
            settingSequencePadding: document.getElementById('setting-sequencePadding'),

            // Missing Media UI
            missingMediaContainer: document.getElementById('missing-media-container'),
            missingMediaCount: document.getElementById('missing-media-count'),
            missingMediaList: document.getElementById('missing-media-list'),

            // Unused Media UI
            unusedMediaContainer: document.getElementById('unused-media-container'),
            unusedMediaCount: document.getElementById('unused-media-count'),
            unusedMediaList: document.getElementById('unused-media-list'),

            // Chart
            statsChart: document.getElementById('stats-chart')
        };
    }

    // Tooltip engine moved to js/ui/tooltip-engine.js
    // Modal manager moved to js/ui/modal-manager.js

    return {
        /**
         * Initialize UI Controller
         */
        initialize: function () {
            cacheElements();

            // Initialize sub-modules with DOM references (Dependency Injection)
            LogPanel.init(elements.log);
            SettingsUI.init({
                // Settings are inline in tab pane, no separate modal needed
                defaultMode: elements.settingDefaultMode,
                rememberChoice: elements.settingRememberChoice,
                mediaFolderName: elements.settingMediaFolderName,
                mainFolderType: elements.settingMainFolderType,
                mainFolderName: elements.settingMainFolderName,
                subOrganization: elements.settingSubOrganization,
                duplicateHandling: elements.settingDuplicateHandling,
                autoDetectSequences: elements.settingAutoDetectSequences,
                sequencePadding: elements.settingSequencePadding
            });

            this.bindEvents();

            // Initialize sub-modules
            TooltipEngine.init();
            ModalManager.init({
                modal: elements.modal,
                detectedSequencesContainer: elements.detectedSequencesContainer,
                sequenceList: elements.sequenceList
            });
        },

        /**
         * Bind UI events
         */
        bindEvents: function () {
            const self = this;

            // Global drag events to prevent Chromium navigation and make entire window a drop zone
            let dragCounter = 0; // Prevent flicker when dragging over child elements

            window.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.setDropzoneState('dragover');

                // Show file count
                if (e.dataTransfer.items) {
                    const count = e.dataTransfer.items.length;
                    self.showFileCount(count);
                }
            });

            window.addEventListener('dragenter', function (e) {
                e.preventDefault();
                dragCounter++;
            });

            window.addEventListener('dragleave', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter--;
                if (dragCounter === 0) {
                    self.setDropzoneState('idle');
                    self.hideFileCount();
                }
            });

            window.addEventListener('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter = 0;
                self.setDropzoneState('idle');
                self.hideFileCount();

                // Block new drops during active import to prevent corruption
                if (StateManager.get('isProcessing')) return;

                // Extract files
                const files = self.extractFilesFromDrop(e);
                if (files.length > 0) {
                    EventBus.emit(Events.FILES_DROPPED, files);
                }
            });

            // Browse button (hidden but accessible via dropzone click)
            elements.browseBtn.addEventListener('click', function () {
                EventBus.emit(Events.FILES_SELECTED);
            });

            // Make dropzone clickable to trigger browse
            elements.dropzone.addEventListener('click', function (e) {
                // Ensure we don't trigger if they are currently dragging (handled by proper drag events)
                EventBus.emit(Events.FILES_SELECTED);
            });

            // Modal backdrop click
            var modalBackdrop = elements.modal ? elements.modal.querySelector('.modal-backdrop') : null;
            if (modalBackdrop) {
                modalBackdrop.addEventListener('click', function () {
                    ModalManager.hide();
                });
            }

            // Modal cancel button
            var modalCancelBtn = document.getElementById('modal-cancel-btn');
            if (modalCancelBtn) {
                modalCancelBtn.addEventListener('click', function () {
                    ModalManager.hide();
                });
            }

            // Abort button
            if (elements.progressAbortBtn) {
                elements.progressAbortBtn.addEventListener('click', function () {
                    EventBus.emit(Events.ABORT_IMPORT);
                });
            }

            // Mode buttons (import modal only)
            elements.modeButtons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const mode = this.getAttribute('data-mode');
                    EventBus.emit(Events.MODE_SELECTED, mode);
                });
            });

            // Remember choice checkbox
            if (elements.rememberChoice) {
                elements.rememberChoice.addEventListener('change', function () {
                    StateManager.set('rememberChoice', this.checked);
                });
            }

            // Delegated Sequence Toggle Events (Removed in favor of direct listener in renderSequences)

            // Settings save button
            if (elements.settingsSave) {
                elements.settingsSave.addEventListener('click', function () {
                    self.saveSettings();
                });
            }

            // Settings reset button
            if (elements.settingsReset) {
                elements.settingsReset.addEventListener('click', function () {
                    self.resetSettings();
                });
            }

            // Main folder type change (custom or predefined)
            if (elements.settingMainFolderType) {
                elements.settingMainFolderType.addEventListener('change', function () {
                    if (this.value === 'custom') {
                        elements.settingMainFolderName.classList.remove('hidden');
                        elements.settingMainFolderName.focus();
                    } else {
                        elements.settingMainFolderName.classList.add('hidden');
                    }
                });
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', function (e) {
                // Ignore shortcuts when user is typing in form fields
                var tag = (e.target.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

                if (!StateManager.get('modalVisible')) {
                    // Browse shortcut when no modal is open
                    if (e.key === 'b' || e.key === 'B') {
                        EventBus.emit(Events.FILES_SELECTED);
                    }
                    return;
                }

                // Modal shortcuts
                switch (e.key.toLowerCase()) {
                    case 'c':
                    case 'enter':
                        EventBus.emit(Events.MODE_SELECTED, 'copy');
                        break;
                    case 'l':
                        EventBus.emit(Events.MODE_SELECTED, 'link');
                        break;
                    case 'escape':
                        self.hideModal();
                        break;
                }
            });
        },

        /**
         * Extract files from drop event
         * @param {DragEvent} e
         * @returns {string[]}
         */
        extractFilesFromDrop: function (e) {
            const files = [];

            if (e.dataTransfer.files) {
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    const file = e.dataTransfer.files[i];
                    // In CEP, we get the full path
                    if (file.path) {
                        files.push(file.path);
                    } else {
                        files.push(file.name);
                    }
                }
            }

            return files;
        },



        /**
         * Set dropzone state
         * @param {string} state - 'idle', 'dragover', 'processing'
         */
        setDropzoneState: function (state) {
            elements.dropzone.classList.remove('dragover', 'processing');
            document.body.classList.remove('body-dragover');

            if (state !== 'idle') {
                elements.dropzone.classList.add(state);
                if (state === 'dragover') {
                    document.body.classList.add('body-dragover');
                }
            }

            StateManager.set('dropzoneState', state);
        },

        /**
         * Show file count
         * @param {number} count
         */
        showFileCount: function (count) {
            elements.fileCount.textContent = count;
            elements.fileCounter.style.display = 'block';
        },

        /**
         * Hide file count
         */
        hideFileCount: function () {
            elements.fileCounter.style.display = 'none';
        },

        /**
         * Show modal — delegates to ModalManager
         */
        showModal: function () {
            ModalManager.show();
        },

        /**
         * Render detected sequences — delegates to ModalManager
         * @param {object[]} files
         */
        renderSequences: function (files) {
            ModalManager.renderSequences(files);
        },

        /**
         * Render isolated invalid files — delegates to ModalManager
         * @param {object[]} files
         */
        renderInvalidFiles: function (files) {
            ModalManager.renderInvalidFiles(files);
        },

        /**
         * Hide modal — delegates to ModalManager
         */
        hideModal: function () {
            ModalManager.hide();
        },

        /**
         * Add log entry — delegates to LogPanel
         * @param {string} message
         * @param {string} type
         */
        log: function (message, type) {
            LogPanel.log(message, type);
            // Trigger Toast Notification for important messages, or all if we want
            if (typeof ToastManager !== 'undefined') {
                // Don't toast simple 'info' messages to avoid spam, unless specified
                // Let's toast everything for now or filter by type
                if (type === 'success' || type === 'error' || type === 'warning') {
                    ToastManager.show(message, type);
                } else if (message.indexOf('Ready') !== -1) {
                    ToastManager.show('MediaFlow is Ready', 'info', 3000);
                }
            }
        },

        /**
         * Clear log — delegates to LogPanel
         */
        clearLog: function () {
            LogPanel.clear();
        },

        /**
         * Show progress bar
         */
        showProgress: function () {
            elements.progressContainer.style.display = 'flex';
        },

        /**
         * Hide progress bar
         */
        hideProgress: function () {
            elements.progressContainer.style.display = 'none';
        },

        /**
         * Update progress
         * @param {number} percentage - 0-100
         * @param {string} currentFile - Current file name (optional)
         * @param {number} currentCount - (optional)
         * @param {number} totalCount - (optional)
         * @param {string} speedInfo - (optional)
         */
        updateProgress: function (percentage, currentFile, currentCount, totalCount, speedInfo) {
            elements.progressFill.style.width = percentage + '%';
            elements.progressText.textContent = percentage + '%';

            if (elements.progressFilename) {
                if (currentFile) {
                    var displayPath = currentFile.length > 50 ? '...' + currentFile.slice(-47) : currentFile;
                    elements.progressFilename.textContent = displayPath;
                } else {
                    elements.progressFilename.textContent = '';
                }
            }

            if (elements.progressStats && currentCount !== undefined && totalCount !== undefined) {
                elements.progressStats.textContent = currentCount + ' / ' + totalCount;
            }

            if (elements.progressSpeed && speedInfo) {
                elements.progressSpeed.textContent = speedInfo;
            }

            if (currentFile) {
                StateManager.update('progress', {
                    percentage: percentage,
                    currentFile: currentFile
                });
            }

            EventBus.emit(Events.PROGRESS_UPDATE, {
                percentage: percentage,
                currentFile: currentFile
            });
        },

        /**
         * Flash dropzone
         * @param {string} type - 'success' or 'error'
         */
        flashDropzone: function (type) {
            const self = this;
            elements.dropzone.classList.add('flash-' + type);

            setTimeout(function () {
                elements.dropzone.classList.remove('flash-' + type);
            }, 500);
        },

        /**
         * Set processing state
         * @param {boolean} processing
         */
        setProcessing: function (processing) {
            if (processing) {
                this.setDropzoneState('processing');
                elements.browseBtn.disabled = true;
                elements.browseBtn.classList.add('disabled');
            } else {
                this.setDropzoneState('idle');
                elements.browseBtn.disabled = false;
                elements.browseBtn.classList.remove('disabled');
            }

            StateManager.set('isProcessing', processing);
        },

        /**
         * Lock/Unlock UI during intensive operations
         * @param {boolean} locked 
         */
        lockUI: function (locked) {
            if (locked) {
                document.body.classList.add('ui-locked');
                elements.dropzone.style.pointerEvents = 'none';
                elements.dropzone.style.opacity = '0.7';
                
                var actionBtns = document.querySelectorAll('.action-card, .square-btn, .settings-btn');
                for (var i = 0; i < actionBtns.length; i++) {
                    actionBtns[i].style.pointerEvents = 'none';
                    actionBtns[i].style.opacity = '0.5';
                }
            } else {
                document.body.classList.remove('ui-locked');
                elements.dropzone.style.pointerEvents = 'auto';
                elements.dropzone.style.opacity = '1';

                var actionBtns = document.querySelectorAll('.action-card, .square-btn, .settings-btn');
                for (var i = 0; i < actionBtns.length; i++) {
                    actionBtns[i].style.pointerEvents = 'auto';
                    actionBtns[i].style.opacity = '1';
                }
            }
        },

        /**
         * Update remember choice checkbox
         * @param {boolean} checked
         */
        setRememberChoice: function (checked) {
            elements.rememberChoice.checked = checked;
        },

        /**
         * Show settings modal — delegates to SettingsUI
         */
        showSettingsModal: function () {
            SettingsUI.show();
        },

        /**
         * Hide settings modal — delegates to SettingsUI
         */
        hideSettingsModal: function () {
            SettingsUI.hide();
        },

        /**
         * Load settings to UI — delegates to SettingsUI
         */
        loadSettingsToUI: function () {
            SettingsUI.loadToUI();
        },

        /**
         * Save settings from UI — delegates to SettingsUI
         */
        saveSettings: function () {
            SettingsUI.save();
        },

        /**
         * Reset settings to defaults — delegates to SettingsUI
         */
        resetSettings: function () {
            SettingsUI.reset();
        },

        /**
         * Get elements cache
         * @returns {object}
         */
        getElements: function () {
            return elements;
        },

        /**
         * Render the missing media list in the UI
         * @param {Array} missingFiles - Array of { name, path } objects
         */
        renderMissingMedia: function (missingFiles) {
            if (!elements.missingMediaContainer || !elements.missingMediaList || !elements.missingMediaCount) return;

            if (!missingFiles || missingFiles.length === 0) {
                elements.missingMediaContainer.style.display = 'none';
                return;
            }

            elements.missingMediaCount.textContent = missingFiles.length;
            elements.missingMediaList.innerHTML = '';
            elements.missingMediaContainer.style.display = 'block';

            // Use DocumentFragment for performant DOM insertion
            const fragment = document.createDocumentFragment();

            window.requestAnimationFrame(function () {
                missingFiles.forEach(function (file) {
                    const item = document.createElement('div');
                    item.className = 'missing-item';

                    const info = document.createElement('div');
                    info.className = 'missing-item-info';

                    const name = document.createElement('div');
                    name.className = 'missing-item-name';
                    name.textContent = file.name;

                    const path = document.createElement('div');
                    path.className = 'missing-item-path';
                    path.textContent = file.path;
                    path.title = file.path; // Standard HTML tooltip as fallback

                    info.appendChild(name);
                    info.appendChild(path);

                    const actionContainer = document.createElement('div');
                    actionContainer.className = 'missing-item-action';

                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'btn-copy-path tooltipped tooltip-bottom';
                    copyBtn.setAttribute('data-i18n-tooltip', 'common.copyOriginalPath');
                copyBtn.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('common.copyOriginalPath') : 'Copy Original Path'));
                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';

                    copyBtn.addEventListener('click', function () {
                        const textarea = document.createElement('textarea');
                        textarea.value = file.path;
                        document.body.appendChild(textarea);
                        textarea.select();

                        var copySuccess = false;
                        try {
                            copySuccess = document.execCommand('copy');
                        } catch (err) {
                            console.warn('DOM copy failed, attempting NodeJS fallback...');
                        }

                        // Adobe CEP fallback: use native OS clipboard via Node JS
                        if (!copySuccess && typeof require !== 'undefined') {
                            try {
                                var cp = require('child_process');
                                var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                                var proc = cp.spawn(isMac ? 'pbcopy' : 'clip');
                                proc.stdin.write(file.path);
                                proc.stdin.end();
                                copySuccess = true;
                            } catch (nodeErr) {
                                console.error('Node native copy failed:', nodeErr);
                            }
                        }

                        if (copySuccess) {
                            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                            copyBtn.classList.add('success');
                            copyBtn.setAttribute('data-i18n-tooltip', 'common.copied');
                    copyBtn.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('common.copied') : 'Copied!'));

                            setTimeout(() => {
                                copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
                                copyBtn.classList.remove('success');
                                copyBtn.setAttribute('data-tooltip', 'Copy Original Path');
                            }, 2000);
                        } else {
                            copyBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                            copyBtn.setAttribute('data-i18n-tooltip', 'common.copyFailed');
                    copyBtn.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('common.copyFailed') : 'Copy Failed'));
                        }

                        document.body.removeChild(textarea);
                    });

                    actionContainer.appendChild(copyBtn);
                    item.appendChild(info);
                    item.appendChild(actionContainer);
                    fragment.appendChild(item);
                });

                elements.missingMediaList.appendChild(fragment);
            });
        },

        /**
         * Render the unused media list in the UI
         * @param {Array} unusedFiles - Array of { name, path, type } objects
         */
        renderUnusedMedia: function (unusedFiles) {
            if (!elements.unusedMediaContainer || !elements.unusedMediaList || !elements.unusedMediaCount) return;

            if (!unusedFiles || unusedFiles.length === 0) {
                elements.unusedMediaContainer.style.display = 'none';
                return;
            }

            elements.unusedMediaCount.textContent = unusedFiles.length;
            elements.unusedMediaList.innerHTML = '';
            elements.unusedMediaContainer.style.display = 'block';

            const fragment = document.createDocumentFragment();

            window.requestAnimationFrame(function () {
                unusedFiles.forEach(function (file) {
                    const item = document.createElement('div');
                    item.className = 'missing-item';

                    const info = document.createElement('div');
                    info.className = 'missing-item-info';

                    const name = document.createElement('div');
                    name.className = 'missing-item-name';
                    name.textContent = file.name;

                    const path = document.createElement('div');
                    path.className = 'missing-item-path';
                    path.textContent = file.type + ' — ' + file.path;
                    path.title = file.path;

                    info.appendChild(name);
                    info.appendChild(path);
                    item.appendChild(info);
                    fragment.appendChild(item);
                });

                elements.unusedMediaList.appendChild(fragment);
            });
        },

        /**
         * Render the stats pie chart using CSS conic-gradient
         * @param {object} stats - Project statistics object
         */
        renderStatsChart: function (stats) {
            if (!elements.statsChart) return;

            // Define colors matching the UI theme
            const colors = {
                video: '#00AAFF',    // var(--accent)
                image: '#4CAF50',    // Green
                audio: '#FF9800',    // Orange
                comp: '#9C27B0',     // Purple
                missing: '#F44336'   // var(--error)
            };

            const totalActive = stats.video + stats.image + stats.audio + stats.comp + stats.missing;

            if (totalActive === 0) {
                elements.statsChart.style.background = 'var(--border-idle)';
                return;
            }

            // Calculate percentages and build conic-gradient string
            let gradientStr = [];
            let currentAngle = 0;

            const addSlice = (count, color) => {
                if (count > 0) {
                    const percentage = (count / totalActive) * 100;
                    const endAngle = currentAngle + percentage;
                    gradientStr.push(`${color} ${currentAngle}% ${endAngle}%`);
                    currentAngle = endAngle;
                }
            };

            addSlice(stats.video, colors.video);
            addSlice(stats.image, colors.image);
            addSlice(stats.audio, colors.audio);
            addSlice(stats.comp, colors.comp);
            addSlice(stats.missing, colors.missing);

            elements.statsChart.style.background = `conic-gradient(${gradientStr.join(', ')})`;
        },

        /**
         * Render project health score and diagnosis
         * @param {object} stats - Stats object with healthScore and diagnosis
         */
        renderProjectHealth: function (stats) {
            var widget = document.getElementById('health-widget');
            var scoreEl = document.getElementById('health-score-value');
            var barFill = document.getElementById('health-bar-fill');
            var diagnosisEl = document.getElementById('health-diagnosis');

            if (!widget || !scoreEl || !barFill || !diagnosisEl) return;

            var isEmptyProject = (stats.total === 0);
            var score = stats.healthScore || 0;
            var diagnosis = stats.diagnosis || [];

            // Show the widget
            widget.style.display = 'block';

            if (isEmptyProject) {
                scoreEl.textContent = 'N/A';
                scoreEl.style.color = '#888';
                barFill.style.width = '0%';
                barFill.style.background = '#444';
            } else {
                // Update score text
                scoreEl.textContent = score + '%';

                // Color based on score
                var barColor;
                if (score >= 80) {
                    barColor = '#4CAF50';        // Green
                    scoreEl.style.color = '#4CAF50';
                } else if (score >= 50) {
                    barColor = '#FF9800';        // Orange
                    scoreEl.style.color = '#FF9800';
                } else {
                    barColor = '#F44336';        // Red
                    scoreEl.style.color = '#F44336';
                }

                barFill.style.width = score + '%';
                barFill.style.background = barColor;
            }

            // Render diagnosis messages
            diagnosisEl.innerHTML = '';
            for (var i = 0; i < diagnosis.length; i++) {
                var d = diagnosis[i];
                var icon = '';
                var cls = '';
                switch (d.type) {
                    case 'error': icon = '<i data-lucide="x-circle"></i>'; cls = 'diag-error'; break;
                    case 'warning': icon = '<i data-lucide="alert-triangle"></i>'; cls = 'diag-warning'; break;
                    case 'success': icon = '<i data-lucide="check-circle-2"></i>'; cls = 'diag-success'; break;
                    default: icon = '<i data-lucide="info"></i>'; cls = 'diag-info'; break;
                }
                var div = document.createElement('div');
                div.className = 'diag-item ' + cls;
                div.innerHTML = icon + ' ' + d.message;
                diagnosisEl.appendChild(div);
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
