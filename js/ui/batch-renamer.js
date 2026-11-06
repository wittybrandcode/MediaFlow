/**
 * MediaFlow - Smart Batch Renamer
 * Advanced bulk renaming engine with tokens, regex find & replace, and live preview.
 * Version: 1.0 (Phase 2 Workflow Automation)
 */

var BatchRenamer = (function () {
    'use strict';

    var currentItems = [];
    var modalElem = null;
    var previewListElem = null;
    var patternInput = null;
    var findInput = null;
    var replaceInput = null;
    var prefixInput = null;
    var suffixInput = null;
    var counterStartInput = null;
    var caseCheckbox = null;
    var regexCheckbox = null;
    var applyBtn = null;
    var cancelBtn = null;
    var countBadge = null;

    function _t(key, params, fallback) {
        if (typeof I18N !== 'undefined') return I18N.t(key, params, fallback);
        return fallback || key;
    }

    /**
     * Initialize DOM references and event listeners
     */
    function init() {
        modalElem = document.getElementById('batch-rename-modal');
        if (!modalElem) return;

        previewListElem = document.getElementById('rename-preview-list');
        patternInput = document.getElementById('rename-pattern');
        findInput = document.getElementById('rename-find');
        replaceInput = document.getElementById('rename-replace');
        prefixInput = document.getElementById('rename-prefix');
        suffixInput = document.getElementById('rename-suffix');
        counterStartInput = document.getElementById('rename-counter-start');
        caseCheckbox = document.getElementById('rename-case-sensitive');
        regexCheckbox = document.getElementById('rename-use-regex');
        applyBtn = document.getElementById('rename-apply-btn');
        cancelBtn = document.getElementById('rename-cancel-btn');
        countBadge = document.getElementById('rename-items-count');

        // Token helper buttons
        var tokenButtons = modalElem.querySelectorAll('.token-chip');
        tokenButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var token = btn.dataset.token;
                if (token && patternInput) {
                    var curPos = patternInput.selectionStart || patternInput.value.length;
                    var text = patternInput.value;
                    patternInput.value = text.substring(0, curPos) + token + text.substring(curPos);
                    patternInput.focus();
                    patternInput.selectionStart = patternInput.selectionEnd = curPos + token.length;
                    updatePreview();
                }
            });
        });

        // Input listeners for real-time live preview
        var inputs = [patternInput, findInput, replaceInput, prefixInput, suffixInput, counterStartInput, caseCheckbox, regexCheckbox];
        inputs.forEach(function (inp) {
            if (inp) {
                inp.addEventListener('input', updatePreview);
                inp.addEventListener('change', updatePreview);
            }
        });

        if (cancelBtn) {
            cancelBtn.addEventListener('click', hide);
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', applyRename);
        }
    }

    /**
     * Show modal with items to rename
     * @param {Array<{ id: number, name: string, width?: number, height?: number, frameRate?: number, duration?: number }>} items
     */
    function show(items) {
        if (!modalElem) init();
        if (!items || items.length === 0) {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.show('يرجى تحديد عنصر واحد على الأقل لإعادة التسمية', 'warning');
            }
            return;
        }

        currentItems = items;
        if (countBadge) countBadge.textContent = items.length;

        // Reset inputs to clean defaults if empty
        if (patternInput && !patternInput.value) {
            patternInput.value = '{name}';
        }

        modalElem.classList.add('active');
        updatePreview();
    }

    /**
     * Hide modal
     */
    function hide() {
        if (modalElem) modalElem.classList.remove('active');
    }

    /**
     * Generate new name for a single item according to current settings
     */
    function computeNewName(item, index) {
        var pattern = patternInput ? patternInput.value : '{name}';
        var prefix = prefixInput ? prefixInput.value : '';
        var suffix = suffixInput ? suffixInput.value : '';
        var startNum = counterStartInput ? (parseInt(counterStartInput.value, 10) || 1) : 1;
        var curNum = startNum + index;

        // Pad counter (default 2 digits: 01, 02)
        var counterStr = curNum < 10 ? '0' + curNum : '' + curNum;
        if (curNum < 100 && pattern.indexOf('{counter:001}') !== -1) {
            counterStr = curNum < 10 ? '00' + curNum : '0' + curNum;
        }

        // Today's date YYYY-MM-DD
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = (now.getMonth() + 1).toString().padStart(2, '0');
        var dd = now.getDate().toString().padStart(2, '0');
        var dateStr = yyyy + '-' + mm + '-' + dd;

        var resStr = (item.width && item.height) ? (item.width + 'x' + item.height) : '';
        var fpsStr = item.frameRate ? (item.frameRate + 'fps') : '';
        var durStr = item.duration ? (item.duration + 's') : '';

        // Token replacement
        var res = pattern
            .replace(/\{name\}/gi, item.name || '')
            .replace(/\{counter(:0+1)?\}/gi, counterStr)
            .replace(/\{date\}/gi, dateStr)
            .replace(/\{res\}/gi, resStr)
            .replace(/\{fps\}/gi, fpsStr)
            .replace(/\{dur\}/gi, durStr);

        // Find & Replace
        var findVal = findInput ? findInput.value : '';
        var replaceVal = replaceInput ? replaceInput.value : '';
        if (findVal) {
            try {
                var isRegex = regexCheckbox && regexCheckbox.checked;
                var isCase = caseCheckbox && caseCheckbox.checked;
                var flags = isCase ? 'g' : 'gi';
                var regex = isRegex ? new RegExp(findVal, flags) : new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                res = res.replace(regex, replaceVal);
            } catch (e) {
                // Invalid regex, keep as-is
            }
        }

        // Apply prefix and suffix
        res = prefix + res + suffix;
        return res.trim();
    }

    /**
     * Update real-time preview list
     */
    function updatePreview() {
        if (!previewListElem) return;
        previewListElem.innerHTML = '';

        var limit = Math.min(currentItems.length, 50); // Preview cap for speed
        var fragment = document.createDocumentFragment();

        for (var i = 0; i < limit; i++) {
            var item = currentItems[i];
            var newName = computeNewName(item, i);

            var row = document.createElement('div');
            row.className = 'rename-preview-row';
            row.innerHTML = '<span class="rename-old-name" title="' + item.name + '">' + item.name + '</span>' +
                            '<i class="fa-solid fa-arrow-right rename-arrow"></i>' +
                            '<span class="rename-new-name' + (newName === item.name ? ' unchanged' : ' changed') + '" title="' + newName + '">' + newName + '</span>';
            fragment.appendChild(row);
        }

        if (currentItems.length > limit) {
            var more = document.createElement('div');
            more.className = 'rename-preview-more';
            more.textContent = (_t('common.info', null, '') ? '... and ' + (currentItems.length - limit) + ' more' : '... و ' + (currentItems.length - limit) + ' عنصر إضافي');
            fragment.appendChild(more);
        }

        previewListElem.appendChild(fragment);
    }

    /**
     * Apply rename via AEBridge
     */
    async function applyRename() {
        if (!currentItems || currentItems.length === 0) return;

        var renameList = [];
        for (var i = 0; i < currentItems.length; i++) {
            var item = currentItems[i];
            var newName = computeNewName(item, i);
            if (newName && newName !== item.name) {
                renameList.push({
                    id: item.id,
                    newName: newName
                });
            }
        }

        if (renameList.length === 0) {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.show(_t('toasts.noNamesChanged', null, 'No names were changed'), 'info');
            }
            hide();
            return;
        }

        if (typeof UIController !== 'undefined') {
            UIController.setProcessing(true);
            UIController.log(_t('toasts.renaming', null, 'Renaming ') + renameList.length + ' item(s)...', 'info');
        }

        try {
            var response = await AEBridge.batchRename(renameList);
            if (typeof UIController !== 'undefined') {
                UIController.setProcessing(false);
            }

            if (response.success && response.data) {
                var count = response.data.renamedCount || renameList.length;
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.show(_t('toasts.renamedSuccess', null, 'Successfully renamed ') + count + ' item(s)!', 'success');
                }
                if (typeof UIController !== 'undefined') {
                    UIController.log('✅ ' + _t('toasts.renamedSuccess', null, 'Successfully renamed ') + count + ' item(s).', 'success');
                }

                hide();

                // Refresh tree
                if (typeof EventBus !== 'undefined') {
                    EventBus.emit(Events.COMP_TREE_REFRESH);
                }
            } else {
                var err = (response.error && response.error.message) || 'Unknown error';
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.show(_t('toasts.renameFailed', null, 'Rename failed: ') + err, 'error');
                }
            }
        } catch (e) {
            if (typeof UIController !== 'undefined') {
                UIController.setProcessing(false);
                UIController.log(_t('toasts.renameError', null, 'Rename error: ') + e.message, 'error');
            }
        }
    }

    return {
        init: init,
        show: show,
        hide: hide
    };
})();

