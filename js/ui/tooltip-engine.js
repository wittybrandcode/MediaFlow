/**
 * MediaFlow - Tooltip Engine
 * Global tooltip system using event delegation on document.body.
 * Extracted from ui-controller.js for Single Responsibility.
 * Version: 1.0
 */

var TooltipEngine = (function () {
    'use strict';

    var tooltipEl = null;
    var tooltipArrow = null;
    var tooltipHideTimer = null;

    /**
     * Initialize the global tooltip engine
     * Creates a single tooltip element on <body> and uses event delegation.
     */
    function init() {
        // Create tooltip container
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'global-tooltip';

        tooltipArrow = document.createElement('div');
        tooltipArrow.id = 'global-tooltip-arrow';
        tooltipEl.appendChild(tooltipArrow);

        document.body.appendChild(tooltipEl);

        // Delegated mouseover on body
        document.body.addEventListener('mouseover', function (e) {
            var target = e.target.closest('.tooltipped');
            if (!target) return;

            // Prioritize reactive i18n translation key lookup
            var text = null;
            var i18nKey = target.getAttribute('data-i18n-tooltip');
            if (i18nKey && typeof I18N !== 'undefined') {
                text = I18N.t(i18nKey);
            }
            if (!text) {
                text = target.getAttribute('data-tooltip');
            }
            if (!text) return;

            clearTimeout(tooltipHideTimer);
            tooltipEl.textContent = text;
            tooltipEl.appendChild(tooltipArrow);

            // Determine if tooltip-bottom class is requested
            var preferBottom = target.classList.contains('tooltip-bottom');

            // Measure target position
            var rect = target.getBoundingClientRect();
            var ttWidth = tooltipEl.offsetWidth;
            var ttHeight = tooltipEl.offsetHeight;

            var left = rect.left + (rect.width / 2) - (ttWidth / 2);
            var top;

            if (preferBottom) {
                top = rect.bottom + 8;
                tooltipEl.classList.add('tooltip-pos-bottom');
            } else {
                top = rect.top - ttHeight - 8;
                tooltipEl.classList.remove('tooltip-pos-bottom');
            }

            // Clamp to viewport edges
            if (left < 4) left = 4;
            if (left + ttWidth > window.innerWidth - 4) left = window.innerWidth - ttWidth - 4;
            if (top < 4) {
                // Flip to bottom if no space above
                top = rect.bottom + 8;
                tooltipEl.classList.add('tooltip-pos-bottom');
            }

            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
            tooltipEl.classList.add('visible');
        });

        // Delegated mouseout on body
        document.body.addEventListener('mouseout', function (e) {
            var target = e.target.closest('.tooltipped');
            if (!target) return;

            tooltipHideTimer = setTimeout(function () {
                tooltipEl.classList.remove('visible');
            }, 80);
        });
    }

    return {
        init: init
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TooltipEngine;
}
