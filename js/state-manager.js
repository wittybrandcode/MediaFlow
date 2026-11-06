/**
 * MediaFlow - State Manager
 * Centralized state management for the panel
 * Version: 1.0
 */

const StateManager = (function () {
    'use strict';

    /**
     * Application state
     */
    const state = {
        // Panel state
        isReady: false,
        isProcessing: false,

        // Project state
        projectOpen: false,
        projectPath: null,
        projectName: null,

        // File state
        pendingFiles: [],
        validatedFiles: [],
        currentBatch: [],

        // Import state
        importMode: null,           // 'copy', 'link', 'smart'
        savedMode: null,            // Persisted mode preference
        rememberChoice: false,
        structureMode: false,       // Rebuild folder tree flag
        hasFolderStructure: false,  // Whether dropped items contained folders
        duplicateAction: 'skip',    // Duplicate file handling action

        // Progress state
        progress: {
            current: 0,
            total: 0,
            currentFile: null,
            percentage: 0
        },

        // Results state
        results: {
            imported: [],
            skipped: [],
            failed: []
        },

        // UI state
        modalVisible: false,
        dropzoneState: 'idle'       // 'idle', 'dragover', 'processing'
    };

    /**
     * Listeners for state changes
     */
    const listeners = {};

    /**
     * Generate unique listener ID
     */
    let listenerId = 0;

    /**
     * Deep clone utility (Safe against Circular References & DOM Nodes)
     */
    function deepClone(obj, hash) {
        hash = hash || new WeakMap();

        // Primitives, null, undefined
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Prevent copying DOM nodes which cause massive memory leaks
        if (typeof window !== 'undefined' && window.Node && obj instanceof window.Node) {
            return null;
        }

        // Handle circular references
        if (hash.has(obj)) {
            return hash.get(obj);
        }

        // Handle Arrays and Objects
        const result = Array.isArray(obj) ? [] : {};
        hash.set(obj, result);

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = deepClone(obj[key], hash);
            }
        }

        return result;
    }

    return {
        /**
         * Get current state (read-only clone)
         * @param {string} key - Optional specific key
         * @returns {*} State value
         */
        get: function (key) {
            if (key) {
                return deepClone(state[key]);
            }
            return deepClone(state);
        },

        /**
         * Get state value by direct reference (no clone, for internal performance-sensitive paths)
         * WARNING: Caller must NOT mutate the returned value
         * @param {string} key - State key
         * @returns {*} Direct reference
         */
        getRaw: function (key) {
            if (key) {
                return state[key];
            }
            return state;
        },

        /**
         * Set state value
         * @param {string} key - State key
         * @param {*} value - New value
         */
        set: function (key, value) {
            if (!state.hasOwnProperty(key)) {
                console.warn('[StateManager] Unknown state key:', key);
                return;
            }

            const oldValue = deepClone(state[key]);
            state[key] = value;

            // Notify listeners
            if (listeners[key]) {
                listeners[key].forEach(function (listener) {
                    try {
                        listener.callback(value, oldValue);
                    } catch (e) {
                        console.error('[StateManager] Listener error:', e);
                    }
                });
            }
        },

        /**
         * Update nested state
         * @param {string} key - Top-level key
         * @param {object} updates - Object with updates
         */
        update: function (key, updates) {
            if (!state.hasOwnProperty(key) || typeof state[key] !== 'object') {
                console.warn('[StateManager] Cannot update non-object state:', key);
                return;
            }

            const oldValue = deepClone(state[key]);
            state[key] = Object.assign({}, state[key], updates);

            // Notify listeners
            if (listeners[key]) {
                listeners[key].forEach(function (listener) {
                    try {
                        listener.callback(state[key], oldValue);
                    } catch (e) {
                        console.error('[StateManager] Listener error:', e);
                    }
                });
            }
        },

        /**
         * Subscribe to state changes
         * @param {string} key - State key to watch
         * @param {Function} callback - Callback(newValue, oldValue)
         * @returns {number} Listener ID
         */
        subscribe: function (key, callback) {
            if (!listeners[key]) {
                listeners[key] = [];
            }

            const id = ++listenerId;
            listeners[key].push({
                id: id,
                callback: callback
            });

            return id;
        },

        /**
         * Alias for subscribe to match modern reactive programming patterns
         */
        watch: function (key, callback) {
            return this.subscribe(key, callback);
        },

        /**
         * Unsubscribe from state changes
         * @param {number} id - Listener ID
         */
        unsubscribe: function (id) {
            for (const key in listeners) {
                if (listeners.hasOwnProperty(key)) {
                    const keyListeners = listeners[key];
                    for (let i = keyListeners.length - 1; i >= 0; i--) {
                        if (keyListeners[i].id === id) {
                            keyListeners.splice(i, 1);
                            return;
                        }
                    }
                }
            }
        },

        /**
         * Reset state to initial values
         */
        reset: function () {
            state.isReady = false;
            state.isProcessing = false;
            state.pendingFiles = [];
            state.validatedFiles = [];
            state.currentBatch = [];
            state.importMode = null;
            state.structureMode = false;
            state.hasFolderStructure = false;
            state.duplicateAction = 'skip';
            state.progress = {
                current: 0,
                total: 0,
                currentFile: null,
                percentage: 0
            };
            state.results = {
                imported: [],
                skipped: [],
                failed: []
            };
            state.modalVisible = false;
            state.dropzoneState = 'idle';
        },

        /**
         * Reset only file/import state
         */
        resetImport: function () {
            state.pendingFiles = [];
            state.validatedFiles = [];
            state.currentBatch = [];
            state.importMode = null;
            state.structureMode = false;
            state.hasFolderStructure = false;
            state.duplicateAction = 'skip';
            state.progress = {
                current: 0,
                total: 0,
                currentFile: null,
                percentage: 0
            };
            state.results = {
                imported: [],
                skipped: [],
                failed: []
            };
            state.isProcessing = false;
            state.dropzoneState = 'idle';
        },

        /**
         * Load saved preferences from localStorage
         */
        loadPreferences: function () {
            try {
                const savedMode = localStorage.getItem('mediaflow_importMode');
                const rememberChoice = localStorage.getItem('mediaflow_rememberChoice');

                if (savedMode) {
                    state.savedMode = savedMode;
                    state.importMode = savedMode;
                }

                if (rememberChoice === 'true') {
                    state.rememberChoice = true;
                }
            } catch (e) {
                console.warn('[StateManager] Could not load preferences:', e);
            }
        },

        /**
         * Save preferences to localStorage
         */
        savePreferences: function () {
            try {
                if (state.rememberChoice && state.importMode) {
                    localStorage.setItem('mediaflow_importMode', state.importMode);
                    localStorage.setItem('mediaflow_rememberChoice', 'true');
                } else {
                    localStorage.removeItem('mediaflow_importMode');
                    localStorage.setItem('mediaflow_rememberChoice', 'false');
                }
            } catch (e) {
                console.warn('[StateManager] Could not save preferences:', e);
            }
        },

        /**
         * Debug: Log current state
         */
        debug: function () {
            console.log('[StateManager] Current state:', deepClone(state));
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}
