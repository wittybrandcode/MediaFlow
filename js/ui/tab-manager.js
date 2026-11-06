/**
 * MediaFlow - Tab Manager
 * Handles main tab navigation between Import, Sort, Stats, Settings.
 * Version: 1.0
 */

const TabManager = (function () {
    'use strict';

    let currentTab = 'import';
    let tabButtons = [];
    let tabPanes = [];

    /**
     * Initialize tab system
     */
    function init() {
        tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        tabPanes = document.querySelectorAll('.tab-pane');

        // Bind click events
        tabButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });

        // Bind settings sub-tabs
        var subTabs = document.querySelectorAll('.settings-sub-tab[data-tab]');
        subTabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var subTabId = this.getAttribute('data-tab');
                switchSettingsSubTab(subTabId);
            });
        });

        console.log('[TabManager] Initialized with', tabButtons.length, 'tabs');
    }

    /**
     * Switch to a tab
     * @param {string} tabId
     */
    function switchTab(tabId) {
        if (tabId === currentTab) return;

        // Update buttons
        tabButtons.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        // Update panes
        tabPanes.forEach(function (pane) {
            pane.classList.toggle('active', pane.id === 'pane-' + tabId);
        });

        var previousTab = currentTab;
        currentTab = tabId;

        // Emit event
        if (typeof EventBus !== 'undefined') {
            EventBus.emit(Events.TAB_CHANGED, { tab: tabId, previousTab: previousTab });
        }

        console.log('[TabManager] Switched to tab:', tabId);
    }

    /**
     * Switch settings sub-tab
     * @param {string} subTabId
     */
    function switchSettingsSubTab(subTabId) {
        var subTabs = document.querySelectorAll('.settings-sub-tab');
        var subPanes = document.querySelectorAll('#pane-settings .settings-tab-pane');

        subTabs.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === subTabId);
        });

        subPanes.forEach(function (pane) {
            pane.classList.toggle('active', pane.id === 'tab-' + subTabId);
        });
    }

    return {
        init: init,

        switchTab: switchTab,

        getCurrentTab: function () {
            return currentTab;
        }
    };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabManager;
}
