/**
 * MediaFlow - Keyboard Shortcut Manager (Phase 4)
 * Handles panel-wide hotkeys, navigation, and modal dismissals (SOLID: Single Responsibility)
 * Fully localized via I18N Engine
 */

var ShortcutManager = (function () {
    let isEnabled = true;

    const SHORTCUTS_EN = [
        { keys: 'Ctrl + 1..5', desc: 'Instant navigation between panel tabs (1..5)' },
        { keys: 'Ctrl + Shift + R', desc: 'Open Render Queue Options dialog' },
        { keys: 'Ctrl + Alt + R', desc: 'Open Smart Batch Renamer dialog' },
        { keys: 'Ctrl + Shift + A', desc: 'Run Asset & Font Auditor scan' },
        { keys: 'Ctrl + Shift + P', desc: 'Purge all memory & disk caches' },
        { keys: 'Escape', desc: 'Close any active modal dialog' }
    ];

    const SHORTCUTS_AR = [
        { keys: 'Ctrl + 1..5', desc: 'التنقل الفوري بين تبويبات الإضافة' },
        { keys: 'Ctrl + Shift + R', desc: 'فتح نافذة خيارات التصدير (Render Queue)' },
        { keys: 'Ctrl + Alt + R', desc: 'فتح أداة إعادة التسمية الجماعية' },
        { keys: 'Ctrl + Shift + A', desc: 'بدء فحص وتدقيق الخطوط والتأثيرات' },
        { keys: 'Ctrl + Shift + P', desc: 'تفريغ فوري لكافة الذاكرة المؤقتة' },
        { keys: 'Escape', desc: 'إغلاق أي نافذة منبثقة مفتوحة' }
    ];

    function _t(key, params, fallback) {
        if (typeof I18N !== 'undefined') {
            return I18N.t(key, params, fallback);
        }
        return fallback || key;
    }

    /**
     * Check if the active focused element is an input or editable field
     */
    function isEditingText() {
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName.toLowerCase();
        return (tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable);
    }

    /**
     * Handle keydown events
     */
    function handleKeyDown(e) {
        // Universal Escape handler: Always closes open modals regardless of focus
        if (e.key === 'Escape' || e.keyCode === 27) {
            const openModals = document.querySelectorAll('.modal.active');
            if (openModals.length > 0) {
                e.preventDefault();
                openModals.forEach(function (m) {
                    m.classList.remove('active');
                });
                return;
            }
        }

        if (!isEnabled || isEditingText()) {
            return;
        }

        const isCtrl = (e.ctrlKey || e.metaKey);
        const isShift = e.shiftKey;
        const isAlt = e.altKey;

        // 1. Tab Switching: Ctrl + 1..5
        if (isCtrl && !isShift && !isAlt && e.key >= '1' && e.key <= '5') {
            const tabNum = parseInt(e.key, 10);
            const tabButtons = document.querySelectorAll('.tab-btn');
            if (tabButtons && tabButtons[tabNum - 1]) {
                e.preventDefault();
                tabButtons[tabNum - 1].click();
            }
            return;
        }

        // 2. Render Queue Modal: Ctrl + Shift + R
        if (isCtrl && isShift && !isAlt && (e.key === 'R' || e.key === 'r')) {
            e.preventDefault();
            const renderModal = document.getElementById('render-options-modal');
            if (renderModal) {
                renderModal.classList.add('active');
            }
            return;
        }

        // 3. Batch Renamer Modal: Ctrl + Alt + R
        if (isCtrl && isAlt && !isShift && (e.key === 'R' || e.key === 'r')) {
            e.preventDefault();
            if (typeof BatchRenamer !== 'undefined') {
                BatchRenamer.openWithComps();
            }
            return;
        }

        // 4. Run Asset Auditor: Ctrl + Shift + A
        if (isCtrl && isShift && !isAlt && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            const smartTabBtn = document.querySelector('.tab-btn[data-tab="smart"]');
            if (smartTabBtn) smartTabBtn.click();
            if (typeof SmartController !== 'undefined') {
                SmartController.runAuditor();
            }
            return;
        }

        // 5. Purge Caches: Ctrl + Shift + P
        if (isCtrl && isShift && !isAlt && (e.key === 'P' || e.key === 'p')) {
            e.preventDefault();
            if (typeof AEBridge !== 'undefined') {
                AEBridge.purgeCaches().then(function (res) {
                    if (res.success && typeof ToastSystem !== 'undefined') {
                        ToastSystem.success(_t('toasts.purgedCaches', null, 'All Caches Purged'));
                    }
                }).catch(function () { });
            }
            return;
        }
    }

    // Public API
    return {
        /**
         * Initialize Shortcut Manager
         */
        init: function () {
            try {
                const saved = localStorage.getItem('mediaflow_shortcuts_enabled');
                if (saved !== null) {
                    isEnabled = (saved === 'true');
                }
            } catch (e) {
                isEnabled = true;
            }

            const toggle = document.getElementById('shortcuts-toggle-enable');
            if (toggle) {
                toggle.checked = isEnabled;
                toggle.addEventListener('change', function () {
                    ShortcutManager.setEnabled(this.checked);
                    if (typeof ToastSystem !== 'undefined') {
                        ToastSystem.info(this.checked ? _t('toasts.shortcutsEnabled', null, 'Shortcuts enabled') : _t('toasts.shortcutsDisabled', null, 'Shortcuts disabled'));
                    }
                });
            }

            window.addEventListener('keydown', handleKeyDown);
        },

        /**
         * Enable or disable shortcuts
         * @param {boolean} enabled
         */
        setEnabled: function (enabled) {
            isEnabled = !!enabled;
            try {
                localStorage.setItem('mediaflow_shortcuts_enabled', isEnabled ? 'true' : 'false');
            } catch (e) { }
        },

        /**
         * Check if shortcuts are active
         */
        isEnabled: function () {
            return isEnabled;
        },

        /**
         * Get full list of registered shortcuts for UI reference
         */
        getShortcuts: function () {
            const isAr = (typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar');
            return isAr ? SHORTCUTS_AR : SHORTCUTS_EN;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortcutManager;
}
