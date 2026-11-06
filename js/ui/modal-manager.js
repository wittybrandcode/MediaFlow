/**
 * MediaFlow - Modal Manager
 * Handles modal show/hide and sequence rendering inside the import modal.
 * Extracted from ui-controller.js for Single Responsibility.
 * Version: 1.0
 */

var ModalManager = (function () {
    'use strict';

    var modalElement = null;
    var sequencesContainer = null;
    var sequenceList = null;

    return {
        /**
         * Initialize with DOM references
         * @param {object} refs - { modal, detectedSequencesContainer, sequenceList }
         */
        init: function (refs) {
            modalElement = refs.modal;
            sequencesContainer = refs.detectedSequencesContainer;
            sequenceList = refs.sequenceList;
        },

        formatSize: function(bytes) {
            if (!bytes || bytes === 0) return '0 KB';
            var units = ['B', 'KB', 'MB', 'GB', 'TB'];
            var i = Math.floor(Math.log(bytes) / Math.log(1024));
            return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
        },

        /**
         * Show the import mode modal
         */
        show: function () {
            if (modalElement) {
                modalElement.classList.add('active');
                StateManager.set('modalVisible', true);
                EventBus.emit(Events.MODAL_SHOW);
            }
        },

        /**
         * Hide the import mode modal
         */
        hide: function () {
            if (modalElement) {
                modalElement.classList.add('closing');
                setTimeout(function() {
                    modalElement.classList.remove('active', 'closing');
                    StateManager.set('modalVisible', false);
                    EventBus.emit(Events.MODAL_HIDE);
                }, 300); // Wait for CSS animation
            }
        },

        /**
         * Show generic confirmation modal
         * @param {string} title 
         * @param {string} message 
         * @param {function} onConfirm 
         */
        confirm: function(title, message, onConfirm) {
            var genericModal = document.getElementById('generic-confirm-modal');
            var titleEl = document.getElementById('generic-confirm-title');
            var msgEl = document.getElementById('generic-confirm-message');
            var cancelBtn = document.getElementById('generic-cancel-btn');
            var confirmBtn = document.getElementById('generic-confirm-btn');

            if (!genericModal || !titleEl || !msgEl || !cancelBtn || !confirmBtn) return;

            titleEl.textContent = title;
            msgEl.textContent = message;

            // Clean up old listeners
            var newCancelBtn = cancelBtn.cloneNode(true);
            var newConfirmBtn = confirmBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            newCancelBtn.addEventListener('click', function() {
                genericModal.classList.add('closing');
                setTimeout(function() { genericModal.classList.remove('active', 'closing'); }, 300);
            });

            newConfirmBtn.addEventListener('click', function() {
                genericModal.classList.add('closing');
                setTimeout(function() { genericModal.classList.remove('active', 'closing'); }, 300);
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });

            genericModal.classList.add('active');
        },

        /**
         * Render detected sequences in the modal
         * @param {object[]} files - Array of validated files
         */
        renderSequences: function (files) {
            if (!sequencesContainer || !sequenceList) return;

            // Find sequences
            var sequences = files.filter(function (f) {
                return f.isSequence === true && f.rawFiles && f.rawFiles.length > 0;
            });

            if (sequences.length === 0) {
                sequencesContainer.style.display = 'none';
            } else {
                // Show container
                sequencesContainer.style.display = 'block';
                sequenceList.innerHTML = '';

                // Performance optimization using DocumentFragment + requestAnimationFrame
                var fragment = document.createDocumentFragment();

                window.requestAnimationFrame(function () {
                    // RENDER SEQUENCES
                    sequences.forEach(function (seq) {
                        var item = document.createElement('div');
                        item.className = 'sequence-item';

                        var info = document.createElement('div');
                        info.className = 'sequence-info';

                        var icon = document.createElement('i');
                        icon.className = 'fa-solid fa-layer-group';

                        var name = document.createElement('span');
                        name.textContent = seq.displayName || seq.name;

                        var badge = document.createElement('span');
                        badge.className = 'sequence-count-badge';
                        var frameUnit = (typeof I18N !== 'undefined' ? I18N.t('modals.frames', null, 'Frames') : 'Frames');
            badge.textContent = seq.sequenceCount + ' ' + frameUnit;

                        info.appendChild(icon);
                        info.appendChild(name);
                        info.appendChild(badge);

                        var sizeBadge = document.createElement('span');
                        sizeBadge.className = 'sequence-count-badge';
                        sizeBadge.style.background = 'rgba(255, 255, 255, 0.1)';
                        sizeBadge.style.color = '#ccc';
                        sizeBadge.textContent = ModalManager.formatSize(seq.size);
                        info.appendChild(sizeBadge);

                        if (seq.duplicateType) {
                            var dupBadge = document.createElement('span');
                            dupBadge.className = 'sequence-count-badge';
                            dupBadge.style.background = seq.duplicateType === 'exact' ? 'var(--error)' : 'var(--warning)';
                            var exactStr = (typeof I18N !== 'undefined' ? I18N.t('modals.duplicateExact', null, 'Exists') : 'Exists');
            var nameStr = (typeof I18N !== 'undefined' ? I18N.t('modals.duplicateName', null, 'Same Name') : 'Same Name');
            dupBadge.textContent = seq.duplicateType === 'exact' ? exactStr : nameStr;
                            info.appendChild(dupBadge);
                        }

                        var toggleContainer = document.createElement('div');
                        toggleContainer.className = 'sequence-toggle';
                        toggleContainer.style.margin = '0';
                        toggleContainer.style.display = 'flex';
                        toggleContainer.style.alignItems = 'center';

                        var toggleLabel = document.createElement('label');
                        toggleLabel.className = 'toggle-switch tooltipped tooltip-bottom';
                        toggleLabel.setAttribute('data-i18n-tooltip', 'modals.importAsSequence');
        toggleLabel.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('modals.importAsSequence') : 'Import as Sequence'));
                        toggleLabel.style.userSelect = 'none';

                        var isSequenceEnabled = seq.importAsSequence !== false;

                        var toggleInput = document.createElement('input');
                        toggleInput.type = 'checkbox';
                        toggleInput.className = 'toggle-input';
                        toggleInput.checked = isSequenceEnabled;
                        toggleInput.setAttribute('data-seq-name', seq.name);

                        item.style.opacity = isSequenceEnabled ? '1' : '0.5';

                        toggleInput.addEventListener('change', function () {
                            item.style.opacity = this.checked ? '1' : '0.5';
                            EventBus.emit(Events.SEQUENCE_TOGGLED, { seqName: seq.name, enabled: this.checked });
                        });

                        var toggleSlider = document.createElement('span');
                        toggleSlider.className = 'toggle-slider';

                        toggleLabel.appendChild(toggleInput);
                        toggleLabel.appendChild(toggleSlider);
                        toggleContainer.appendChild(toggleLabel);

                        var actionsContent = document.createElement('div');
                        actionsContent.style.display = 'flex';
                        actionsContent.style.alignItems = 'center';
                        actionsContent.style.gap = '10px';

                        var delBtn = document.createElement('button');
                        delBtn.className = 'square-btn danger tooltipped tooltip-bottom';
                        delBtn.setAttribute('data-i18n-tooltip', 'modals.excludeSequence');
        delBtn.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('modals.excludeSequence') : 'Exclude Sequence'));
                        delBtn.style.width = '28px';
                        delBtn.style.height = '28px';
                        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                        delBtn.onclick = function() {
                            item.remove();
                            // Remove from global state
                            if (window.StateManager) {
                                var filesList = window.StateManager.getRaw('validatedFiles');
                                if (filesList) {
                                    var idx = filesList.findIndex(function(f) { return f.name === seq.name && f.isSequence; });
                                    if (idx !== -1) filesList.splice(idx, 1);
                                }
                            }
                            // BUG-05 Fix: Update sequence list header counter
                            var seqHeader = document.querySelector('#detected-sequences-container .sequence-list-header');
                            if (seqHeader && sequenceList) {
                                var remaining = sequenceList.querySelectorAll('.sequence-item').length;
                                var seqLabel = (typeof I18N !== 'undefined' ? I18N.t('modals.detectedSequences', null, 'Sequences') : 'Sequences');
        seqHeader.innerHTML = '<i class="fa-solid fa-layer-group"></i> ' + seqLabel + ' (' + remaining + ')';
                                if (remaining === 0) {
                                    var seqContainer = document.getElementById('detected-sequences-container');
                                    if (seqContainer) seqContainer.style.display = 'none';
                                }
                            }
                        };

                        actionsContent.appendChild(toggleContainer);
                        actionsContent.appendChild(delBtn);

                        item.appendChild(info);
                        item.appendChild(actionsContent);
                        fragment.appendChild(item);
                    });

                    sequenceList.appendChild(fragment);
                });
            }


            // RENDER STANDARD FILES
            var standardFiles = files.filter(function (f) {
                return !f.isSequence;
            });

            var previewContainer = document.getElementById('import-preview-container');
            var previewList = document.getElementById('import-preview-list');

            if (previewContainer && previewList) {
                if (standardFiles.length === 0) {
                    previewContainer.style.display = 'none';
                } else {
                    previewContainer.style.display = 'block';
                    previewList.innerHTML = '';
                    var fileFrag = document.createDocumentFragment();

                    window.requestAnimationFrame(function () {
                        standardFiles.forEach(function (f) {
                            var item = document.createElement('div');
                            item.className = 'sequence-item';
                            item.style.padding = '8px';

                            var info = document.createElement('div');
                            info.className = 'sequence-info';

                            var icon = document.createElement('i');
                            if (f.type === 'video') icon.className = 'fa-solid fa-film';
                            else if (f.type === 'audio') icon.className = 'fa-solid fa-music';
                            else icon.className = 'fa-solid fa-image';

                            var name = document.createElement('span');
                            name.textContent = f.name;

                            info.appendChild(icon);
                            info.appendChild(name);

                            var formatBadge = document.createElement('span');
                            formatBadge.className = 'sequence-count-badge';
                            formatBadge.style.background = 'rgba(0, 170, 255, 0.15)';
                            formatBadge.style.color = 'var(--text-primary)';
                            formatBadge.style.textTransform = 'uppercase';
                            formatBadge.textContent = f.extension || f.type;
                            info.appendChild(formatBadge);
                            
                            var sizeBadge = document.createElement('span');
                            sizeBadge.className = 'sequence-count-badge';
                            sizeBadge.style.background = 'rgba(255, 255, 255, 0.1)';
                            sizeBadge.style.color = '#ccc';
                            sizeBadge.textContent = ModalManager.formatSize(f.size);
                            info.appendChild(sizeBadge);

                            if (f.duplicateType) {
                                var dupBadge = document.createElement('span');
                                dupBadge.className = 'sequence-count-badge';
                                dupBadge.style.background = f.duplicateType === 'exact' ? 'var(--error)' : 'var(--warning)';
                                var exactStr2 = (typeof I18N !== 'undefined' ? I18N.t('modals.duplicateExact', null, 'Exists') : 'Exists');
            var nameStr2 = (typeof I18N !== 'undefined' ? I18N.t('modals.duplicateName', null, 'Same Name') : 'Same Name');
            dupBadge.textContent = f.duplicateType === 'exact' ? exactStr2 : nameStr2;
                                info.appendChild(dupBadge);
                            }

                            var actions = document.createElement('div');
                            actions.style.display = 'flex';
                            actions.style.alignItems = 'center';

                            var delBtn = document.createElement('button');
                            delBtn.className = 'square-btn danger tooltipped tooltip-bottom';
                            delBtn.setAttribute('data-i18n-tooltip', 'modals.excludeFile');
        delBtn.setAttribute('data-tooltip', (typeof I18N !== 'undefined' ? I18N.t('modals.excludeFile') : 'Exclude File'));
                            delBtn.style.width = '28px';
                            delBtn.style.height = '28px';
                            delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                            delBtn.onclick = function() {
                                item.remove();
                                if (window.StateManager) {
                                    var filesList = window.StateManager.getRaw('validatedFiles');
                                    if (filesList) {
                                        var idx = filesList.findIndex(function(file) { return file.path === f.path; });
                                        if (idx !== -1) filesList.splice(idx, 1);
                                    }
                                }
                                // BUG-05 Fix: Update file list header counter
                                var fileHeader = document.querySelector('#import-preview-container .sequence-list-header');
                                if (fileHeader && previewList) {
                                    var remaining = previewList.querySelectorAll('.sequence-item').length;
                                    var fileLabel = (typeof I18N !== 'undefined' ? I18N.t('modals.detectedFiles', null, 'Detected Files') : 'Detected Files');
        fileHeader.innerHTML = '<i class="fa-solid fa-file"></i> ' + fileLabel + ' (' + remaining + ')';
                                    if (remaining === 0) {
                                        var previewContainer = document.getElementById('import-preview-container');
                                        if (previewContainer) previewContainer.style.display = 'none';
                                    }
                                }
                            };

                            actions.appendChild(delBtn);

                            item.appendChild(info);
                            item.appendChild(actions);
                            fileFrag.appendChild(item);
                        });
                        previewList.appendChild(fileFrag);
                    });
                }
            }
        },

        /**
         * Render automatically isolated files (unsupported / invalid)
         * @param {object[]} files
         */
        renderInvalidFiles: function (files) {
            var previewContainer = document.getElementById('invalid-preview-container');
            var previewList = document.getElementById('invalid-preview-list');

            if (!previewContainer || !previewList) return;

            if (!files || files.length === 0) {
                previewContainer.style.display = 'none';
            } else {
                previewContainer.style.display = 'block';
                previewList.innerHTML = '';
                var fileFrag = document.createDocumentFragment();

                window.requestAnimationFrame(function () {
                    files.forEach(function (f) {
                        var item = document.createElement('div');
                        item.className = 'sequence-item';
                        item.style.padding = '8px';
                        item.style.borderLeft = '3px solid #ff4444';

                        var info = document.createElement('div');
                        info.className = 'sequence-info';

                        var icon = document.createElement('i');
                        icon.className = 'fa-solid fa-triangle-exclamation';
                        icon.style.color = '#ff4444';

                        var name = document.createElement('span');
                        name.textContent = f.name;
                        name.style.textDecoration = 'line-through';
                        name.style.opacity = '0.6';

                        var errorBadge = document.createElement('span');
                        errorBadge.className = 'sequence-count-badge';
                        errorBadge.style.background = 'var(--error)';
                        
                        if (f.error === 'UNSUPPORTED_FORMAT') {
                            errorBadge.textContent = 'Unsupported';
                        } else if (f.error === 'EMPTY_FILE') {
                            errorBadge.textContent = 'Empty / Corrupt';
                        } else {
                            errorBadge.textContent = 'Invalid';
                        }

                        info.appendChild(icon);
                        info.appendChild(name);
                        info.appendChild(errorBadge);

                        item.appendChild(info);
                        fileFrag.appendChild(item);
                    });
                    previewList.appendChild(fileFrag);
                });
            }
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
