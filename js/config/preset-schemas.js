/**
 * MediaFlow - Folder Preset Schemas
 * Defines built-in and user custom folder structure presets.
 * Version: 1.0 (Phase 1 Custom Presets)
 */

var FolderPresets = (function () {
    'use strict';

    var STORAGE_KEY = 'mediaflow_folder_presets';
    var ACTIVE_KEY = 'mediaflow_active_preset_id';

    /**
     * Built-in professional folder structure templates
     */
    var BUILT_IN_PRESETS = {
        standard: {
            id: 'standard',
            name: 'Standard Studio (استوديو احترافي)',
            isBuiltIn: true,
            folders: {
                video: '01_FOOTAGE',
                comps: '02_COMPS',
                audio: '03_AUDIO',
                image: '04_IMAGES',
                sequence: '05_SEQUENCES',
                solid: '06_SOLIDS'
            }
        },
        social: {
            id: 'social',
            name: 'Social Media (محتوى وسوشيال)',
            isBuiltIn: true,
            folders: {
                video: '01_RAW_CLIPS',
                comps: '02_FINAL_COMPS',
                audio: '03_VOICE_OVER',
                image: '04_GRAPHICS',
                sequence: '05_ANIMATIONS',
                solid: '06_NULLS'
            }
        },
        vfx: {
            id: 'vfx',
            name: 'VFX & 3D (مؤثرات وثري دي)',
            isBuiltIn: true,
            folders: {
                video: '01_PLATES',
                comps: '02_COMPOSITING',
                audio: '03_AUDIO',
                image: '04_ELEMENTS',
                sequence: '05_3D_RENDERS',
                solid: '06_SYSTEM'
            }
        },
        minimal: {
            id: 'minimal',
            name: 'Classic Minimal (كلاسيكي بسيط)',
            isBuiltIn: true,
            folders: {
                video: 'Video',
                comps: 'Compositions',
                audio: 'Audio',
                image: 'Images',
                sequence: 'Sequences',
                solid: '[ Solids & Nulls ]'
            }
        }
    };

    /**
     * Get all custom presets stored in localStorage
     */
    function getCustomPresets() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error('[FolderPresets] Failed to read custom presets:', e);
            return {};
        }
    }

    /**
     * Save custom presets to localStorage
     */
    function saveCustomPresets(customObj) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customObj));
            return true;
        } catch (e) {
            console.error('[FolderPresets] Failed to save custom presets:', e);
            return false;
        }
    }

    return {
        /**
         * Get a unified list of all available presets (built-in + custom)
         * @returns {object} Map of presetId -> presetObject
         */
        getAllPresets: function () {
            var all = {};
            // Built-in presets
            for (var key in BUILT_IN_PRESETS) {
                if (BUILT_IN_PRESETS.hasOwnProperty(key)) {
                    all[key] = JSON.parse(JSON.stringify(BUILT_IN_PRESETS[key]));
                }
            }
            // Custom presets
            var custom = getCustomPresets();
            for (var cKey in custom) {
                if (custom.hasOwnProperty(cKey)) {
                    all[cKey] = custom[cKey];
                }
            }
            return all;
        },

        /**
         * Get currently active preset
         * @returns {object}
         */
        getActivePreset: function () {
            var activeId = localStorage.getItem(ACTIVE_KEY) || 'standard';
            var all = this.getAllPresets();
            return all[activeId] || all['standard'];
        },

        /**
         * Set active preset by ID
         * @param {string} id
         */
        setActivePreset: function (id) {
            var all = this.getAllPresets();
            if (all[id]) {
                localStorage.setItem(ACTIVE_KEY, id);
                console.log('[FolderPresets] Active preset changed to: ' + id);
                return true;
            }
            return false;
        },

        /**
         * Get folder mappings for the active preset (ready to send to JSX)
         * @returns {object}
         */
        getActiveFolderNames: function () {
            var active = this.getActivePreset();
            return active && active.folders ? active.folders : BUILT_IN_PRESETS.standard.folders;
        },

        /**
         * Save or update a custom preset
         * @param {string} id
         * @param {string} name
         * @param {object} folders - {video, comps, audio, image, sequence, solid}
         */
        savePreset: function (id, name, folders) {
            if (!id || !name || !folders) return false;
            // Ensure no override of built-in unless creating a custom copy
            var custom = getCustomPresets();
            var presetId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            custom[presetId] = {
                id: presetId,
                name: name,
                isBuiltIn: false,
                folders: {
                    video: (folders.video || 'Video').trim(),
                    comps: (folders.comps || 'Compositions').trim(),
                    audio: (folders.audio || 'Audio').trim(),
                    image: (folders.image || 'Images').trim(),
                    sequence: (folders.sequence || 'Sequences').trim(),
                    solid: (folders.solid || '[ Solids & Nulls ]').trim()
                }
            };
            var ok = saveCustomPresets(custom);
            if (ok) {
                this.setActivePreset(presetId);
            }
            return ok;
        },

        /**
         * Delete a custom preset
         * @param {string} id
         */
        deletePreset: function (id) {
            if (BUILT_IN_PRESETS[id]) {
                console.warn('[FolderPresets] Cannot delete built-in preset:', id);
                return false;
            }
            var custom = getCustomPresets();
            if (custom[id]) {
                delete custom[id];
                saveCustomPresets(custom);
                if (localStorage.getItem(ACTIVE_KEY) === id) {
                    this.setActivePreset('standard');
                }
                return true;
            }
            return false;
        },

        /**
         * Export all custom presets as JSON string
         * @returns {string}
         */
        exportJSON: function () {
            var custom = getCustomPresets();
            return JSON.stringify(custom, null, 2);
        },

        /**
         * Import custom presets from JSON string
         * @param {string} jsonStr
         * @returns {number} Count of imported presets
         */
        importJSON: function (jsonStr) {
            try {
                var parsed = JSON.parse(jsonStr);
                if (!parsed || typeof parsed !== 'object') return 0;
                var custom = getCustomPresets();
                var count = 0;
                for (var key in parsed) {
                    if (parsed.hasOwnProperty(key) && parsed[key].folders) {
                        custom[key] = parsed[key];
                        custom[key].isBuiltIn = false;
                        count++;
                    }
                }
                saveCustomPresets(custom);
                return count;
            } catch (e) {
                console.error('[FolderPresets] Failed to import JSON:', e);
                return 0;
            }
        }
    };
})();

