/**
 * MediaFlow - Toast Notification System
 * Version: 1.0
 */

var ToastManager = (function () {
    'use strict';

    var container = null;
    var MAX_TOASTS = 3;
    var defaultDuration = 4000;

    /**
     * Initialize the Toast System
     */
    function init() {
        container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    /**
     * Create and show a new toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} [duration] - Duration in ms (0 for persistent)
     */
    function show(message, type, duration) {
        if (!container) init();

        type = type || 'info';
        
        // Error might be persistent by default, unless specified
        if (duration === undefined) {
            duration = (type === 'error') ? 6000 : defaultDuration;
        }

        // Maintain max toasts
        if (container.children.length >= MAX_TOASTS) {
            var oldest = container.firstChild;
            if (oldest) removeToast(oldest);
        }

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;

        var icons = {
            success: '<i class="fa-solid fa-circle-check"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
            error: '<i class="fa-solid fa-circle-xmark"></i>',
            info: '<i class="fa-solid fa-circle-info"></i>'
        };

        var iconHtml = icons[type] || icons['info'];

        toast.innerHTML = 
            '<div class="toast-icon">' + iconHtml + '</div>' +
            '<div class="toast-message">' + message + '</div>' +
            '<button class="toast-close"><i class="fa-solid fa-xmark"></i></button>';

        // Close button event
        var closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', function () {
            removeToast(toast);
        });

        // Add to DOM
        container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(function () {
                if (toast.parentNode) {
                    removeToast(toast);
                }
            }, duration);
        }
    }

    /**
     * Properly remove a toast with animation
     * @param {HTMLElement} toast 
     */
    function removeToast(toast) {
        toast.classList.add('toast-closing');
        toast.addEventListener('animationend', function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    return {
        init: init,
        show: show
    };
})();

// Auto-initialize on load
window.addEventListener('DOMContentLoaded', function() {
    ToastManager.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
