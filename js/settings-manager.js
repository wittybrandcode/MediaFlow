/**
 * MediaFlow - Settings Manager
 * Centralized settings management
 * Version: 1.1
 */

const SettingsManager = (function () {
    'use strict';

    /**
     * Storage key for localStorage
     */
    const STORAGE_KEY = 'mediaflow_settings';

    /**
     * Default settings
     */
    const DEFAULT_SETTINGS = {
        import: {
            defaultMode: 'link',        // 'copy' | 'link'
            rememberChoice: false,
            mediaFolderName: '_media'
        },
        organization: {
            mainFolderName: 'MediaFlow Import',
            subOrganization: 'extension'     // 'type' | 'extension' | 'none'
        },
        files: {
            duplicateHandling: 'skip',  // 'skip' | 'rename' | 'replace'
            autoDetectSequences: true,
            sequencePadding: 4
        }
    };

    /**
     * Current settings (merged with defaults)
     */
    var currentSettings = null;

    /**
     * Deep clone utility
     */
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Deep merge utility
     */
    function deepMerge(target, source) {
        var result = deepClone(target);

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Validate a single setting value
     */
    function validateValue(category, key, value) {
        var validators = {
            'import.defaultMode': function (v) {
                return v === 'copy' || v === 'link';
            },
            'import.rememberChoice': function (v) {
                return typeof v === 'boolean';
            },
            'import.mediaFolderName': function (v) {
                return typeof v === 'string' && v.length > 0 && v.length < 100;
            },
            'organization.mainFolderName': function (v) {
                return typeof v === 'string' && v.length > 0 && v.length < 100;
            },
            'organization.subOrganization': function (v) {
                return v === 'type' || v === 'date' || v === 'extension' || v === 'none';
            },
            'files.duplicateHandling': function (v) {
                return v === 'skip' || v === 'rename' || v === 'replace';
            },
            'files.autoDetectSequences': function (v) {
                return typeof v === 'boolean';
            },
            'files.sequencePadding': function (v) {
                return typeof v === 'number' && v >= 3 && v <= 6;
            }
        };

        var validatorKey = category + '.' + key;
        var validator = validators[validatorKey];

        if (validator) {
            return validator(value);
        }

        // Unknown setting, allow it
        return true;
    }

    return {
        /**
         * Initialize settings manager
         */
        initialize: function () {
            this.load();
            console.log('[SettingsManager] Initialized with settings:', currentSettings);
        },

        /**
         * Load settings from localStorage
         */
        load: function () {
            try {
                var stored = localStorage.getItem(STORAGE_KEY);

                if (stored) {
                    var parsed = JSON.parse(stored);
                    currentSettings = deepMerge(DEFAULT_SETTINGS, parsed);
                } else {
                    currentSettings = deepClone(DEFAULT_SETTINGS);
                }

                // Force migration to 'By Extension' for existing users prioritizing Enterprise standard
                if (currentSettings.organization.subOrganization === 'type') {
                    if (localStorage.getItem('mediaflow_migrated_ext') !== 'true') {
                        currentSettings.organization.subOrganization = 'extension';
                        localStorage.setItem('mediaflow_migrated_ext', 'true');
                        // Will be saved lazily on next save, but active immediately
                    }
                }
            } catch (e) {
                console.warn('[SettingsManager] Failed to load settings:', e);
                currentSettings = deepClone(DEFAULT_SETTINGS);
            }

            return currentSettings;
        },

        /**
         * Save settings to localStorage
         */
        save: function () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
                console.log('[SettingsManager] Settings saved');

                if (typeof EventBus !== 'undefined') {
                    EventBus.emit('SETTINGS_CHANGED', currentSettings);
                }

                return true;
            } catch (e) {
                console.error('[SettingsManager] Failed to save settings:', e);
                return false;
            }
        },

        /**
         * Reset to default settings
         */
        reset: function () {
            currentSettings = deepClone(DEFAULT_SETTINGS);
            this.save();
            console.log('[SettingsManager] Settings reset to defaults');
            return currentSettings;
        },

        /**
         * Get all settings
         * @returns {object}
         */
        getAll: function () {
            if (!currentSettings) this.initialize();
            return deepClone(currentSettings);
        },

        /**
         * Get a specific setting
         * @param {string} category - e.g., 'import', 'organization', 'files'
         * @param {string} key - e.g., 'defaultMode', 'rememberChoice'
         * @returns {*}
         */
        get: function (category, key) {
            if (!currentSettings) this.initialize();
            if (currentSettings && currentSettings[category] && currentSettings[category].hasOwnProperty(key)) {
                return currentSettings[category][key];
            }

            // Return default if available
            if (DEFAULT_SETTINGS && DEFAULT_SETTINGS[category] && DEFAULT_SETTINGS[category].hasOwnProperty(key)) {
                return DEFAULT_SETTINGS[category][key];
            }

            return null;
        },

        /**
         * Set a specific setting
         * @param {string} category
         * @param {string} key
         * @param {*} value
         * @returns {boolean} Success
         */
        set: function (category, key, value) {
            // Validate
            if (!validateValue(category, key, value)) {
                console.warn('[SettingsManager] Invalid value for', category + '.' + key, ':', value);
                return false;
            }

            if (!currentSettings[category]) {
                currentSettings[category] = {};
            }

            currentSettings[category][key] = value;

            // Emit event
            EventBus.emit('settings:changed', {
                category: category,
                key: key,
                value: value
            });

            return true;
        },

        /**
         * Set multiple settings at once
         * @param {object} settings
         */
        setMultiple: function (settings) {
            var self = this;

            for (var category in settings) {
                if (settings.hasOwnProperty(category)) {
                    for (var key in settings[category]) {
                        if (settings[category].hasOwnProperty(key)) {
                            self.set(category, key, settings[category][key]);
                        }
                    }
                }
            }
        },

        /**
         * Get default settings
         * @returns {object}
         */
        getDefaults: function () {
            return deepClone(DEFAULT_SETTINGS);
        },

        /**
         * Check if settings have been modified from defaults
         * @returns {boolean}
         */
        isModified: function () {
            return JSON.stringify(currentSettings) !== JSON.stringify(DEFAULT_SETTINGS);
        },

        /**
         * Export settings as JSON string
         * @returns {string}
         */
        export: function () {
            return JSON.stringify(currentSettings, null, 2);
        },

        /**
         * Import settings from JSON string
         * @param {string} jsonStr
         * @returns {boolean}
         */
        import: function (jsonStr) {
            try {
                var imported = JSON.parse(jsonStr);
                currentSettings = deepMerge(DEFAULT_SETTINGS, imported);
                this.save();
                return true;
            } catch (e) {
                console.error('[SettingsManager] Failed to import settings:', e);
                return false;
            }
        },

        /**
         * Debug: Log current settings
         */
        debug: function () {
            console.log('[SettingsManager] Current settings:', currentSettings);
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}