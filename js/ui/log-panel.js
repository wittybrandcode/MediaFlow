/**
 * MediaFlow - Log Panel
 * Manages the activity log panel (add, clear, timestamp).
 * Extracted from ui-controller.js for Single Responsibility.
 * Version: 1.0
 */

var LogPanel = (function () {
    'use strict';

    var logElement = null;

    /**
     * Get current timestamp for log entries
     * @returns {string} HH:MM:SS
     */
    function getTimestamp() {
        const now = new Date();
        return now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0') + ':' +
            now.getSeconds().toString().padStart(2, '0');
    }

    return {
        /**
         * Initialize with reference to the log container element
         * @param {HTMLElement} el - The log container
         */
        init: function (el) {
            logElement = el;

            // Log header collapsing logic
            var logHeader = document.getElementById('log-header');
            var logContainer = document.getElementById('log-container');
            if (logHeader && logContainer) {
                logHeader.addEventListener('click', function () {
                    logContainer.classList.toggle('collapsed');
                });
            }
        },

        /**
         * Add log entry
         * @param {string} message
         * @param {string} type - 'success', 'warning', 'error', 'info'
         */
        log: function (message, type) {
            type = type || 'info';

            if (!logElement) return;

            const entry = document.createElement('div');
            entry.className = 'log-entry ' + type;
            entry.setAttribute('data-time', getTimestamp());

            const icons = {
                success: '<i data-lucide="check-circle-2"></i>',
                warning: '<i data-lucide="alert-triangle"></i>',
                error: '<i data-lucide="x-circle"></i>',
                info: '<i data-lucide="info"></i>'
            };

            entry.innerHTML = icons[type] + ' ' + message;

            logElement.appendChild(entry);
            logElement.scrollTop = logElement.scrollHeight;

            // Update collapsed header preview
            var previewEl = document.getElementById('log-header-preview');
            if (previewEl) {
                previewEl.className = 'log-header-preview ' + type;
                previewEl.innerHTML = icons[type] + ' <span>' + message + '</span>';
            }

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Auto expand log if it's an error
            if (type === 'error') {
                var logContainer = document.getElementById('log-container');
                if (logContainer) logContainer.classList.remove('collapsed');
            }

            EventBus.emit(Events.LOG_MESSAGE, { message: message, type: type });
        },

        /**
         * Clear all log entries
         */
        clear: function () {
            if (logElement) {
                logElement.innerHTML = '';
            }
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogPanel;
}
