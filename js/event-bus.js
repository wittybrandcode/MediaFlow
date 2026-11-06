/**
 * MediaFlow - Event Bus
 * Decoupled pub/sub event system
 * Version: 1.0
 */

const EventBus = (function () {
    'use strict';

    /**
     * Private event registry
     */
    const events = {};

    /**
     * Generate unique listener ID
     */
    let listenerId = 0;

    return {
        /**
         * Subscribe to an event
         * @param {string} eventName - Name of the event
         * @param {Function} callback - Callback function
         * @returns {number} Listener ID for unsubscribing
         */
        on: function (eventName, callback) {
            if (!events[eventName]) {
                events[eventName] = [];
            }

            const id = ++listenerId;
            events[eventName].push({
                id: id,
                callback: callback
            });

            // Prevent memory leaks: warn if an event has too many listeners
            if (events[eventName].length > 50) {
                console.warn('[EventBus] Warning: possible memory leak. Event "' + eventName + '" has ' + events[eventName].length + ' listeners.');
            }

            return id;
        },

        /**
         * Subscribe to an event (one-time)
         * @param {string} eventName - Name of the event
         * @param {Function} callback - Callback function
         * @returns {number} Listener ID
         */
        once: function (eventName, callback) {
            const self = this;
            const id = this.on(eventName, function (data) {
                self.off(id);
                callback(data);
            });
            return id;
        },

        /**
         * Unsubscribe from an event
         * @param {number} listenerId - Listener ID returned from on()
         */
        off: function (listenerId) {
            for (const eventName in events) {
                if (events.hasOwnProperty(eventName)) {
                    const listeners = events[eventName];
                    for (let i = listeners.length - 1; i >= 0; i--) {
                        if (listeners[i].id === listenerId) {
                            listeners.splice(i, 1);
                            return;
                        }
                    }
                }
            }
        },

        /**
         * Emit an event
         * @param {string} eventName - Name of the event
         * @param {*} data - Data to pass to listeners
         */
        emit: function (eventName, data) {
            if (!events[eventName]) {
                return;
            }

            // Create a copy to prevent issues if callback modifies the array
            const listeners = events[eventName].slice();

            for (let i = 0; i < listeners.length; i++) {
                try {
                    // Stop Propagation pattern: If a listener returns explicitly `false`, break the loop
                    const result = listeners[i].callback(data);
                    if (result === false) {
                        break;
                    }
                } catch (e) {
                    console.error('[EventBus] Error in listener for "' + eventName + '":', e);
                }
            }
        },

        /**
         * Remove all listeners for an event
         * @param {string} eventName - Name of the event
         */
        clear: function (eventName) {
            if (eventName) {
                delete events[eventName];
            } else {
                // Clear all events
                for (const key in events) {
                    if (events.hasOwnProperty(key)) {
                        delete events[key];
                    }
                }
            }
        },

        /**
         * Get listener count for an event
         * @param {string} eventName - Name of the event
         * @returns {number} Number of listeners
         */
        listenerCount: function (eventName) {
            return events[eventName] ? events[eventName].length : 0;
        }
    };
})();

/**
 * Event Constants
 */
const Events = {
    // File Events
    FILES_DROPPED: 'files:dropped',
    FILES_SELECTED: 'files:selected',
    FILES_VALIDATED: 'files:validated',

    // Import Events
    IMPORT_START: 'import:start',
    IMPORT_PROGRESS: 'import:progress',
    IMPORT_COMPLETE: 'import:complete',
    IMPORT_ERROR: 'import:error',

    // Mode Events
    MODE_SELECTED: 'mode:selected',
    MODE_SAVED: 'mode:saved',

    // UI Events
    MODAL_SHOW: 'modal:show',
    MODAL_HIDE: 'modal:hide',
    LOG_MESSAGE: 'log:message',
    PROGRESS_UPDATE: 'progress:update',

    // AE Events
    AE_PROJECT_CHECK: 'ae:projectCheck',
    AE_READY: 'ae:ready',
    AE_BUSY: 'ae:busy',

    // Organize Events
    AUTO_ORGANIZE_CLICKED: 'autoOrganize:clicked',

    // Tab Events
    TAB_CHANGED: 'tab:changed',

    // Sort Events
    SORT_COMPS_CLICKED: 'sort:compsClicked',

    // Stats Events
    STATS_REFRESH: 'stats:refresh',

    // Smart Features Events
    ISOLATE_MISSING_CLICKED: 'smart:isolateMissingClicked',
    ISOLATE_UNUSED_CLICKED: 'smart:isolateUnusedClicked',
    REMOVE_UNUSED_CLICKED: 'smart:removeUnusedClicked',

    // Comp Tree Events
    COMP_TREE_REFRESH: 'compTree:refresh',
    COMP_TREE_RENDER_SELECTED: 'compTree:renderSelected',

    // Sequence Events
    SEQUENCE_TOGGLED: 'sequence:toggled',

    // Abort Events
    ABORT_IMPORT: 'import:abort',

    // Settings Events
    SETTINGS_SHOW: 'settings:show'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, Events };
}
