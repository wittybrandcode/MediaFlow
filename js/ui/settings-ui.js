/**
 * MediaFlow - Settings UI
 * Manages the settings inline form (load, save, reset) and Folder Presets Manager.
 * Version: 2.0 (Phase 1 Custom Presets)
 */

var SettingsUI = (function () {
    'use strict';

    // DOM element references — set via init()
    var els = {};
    var presetEls = {};

    /**
     * Initialize Folder Presets UI elements and event listeners
     */
    function initPresetElements() {
        presetEls = {
            select: document.getElementById('setting-folderPreset'),
            video: document.getElementById('preset-folder-video'),
            comps: document.getElementById('preset-folder-comps'),
            audio: document.getElementById('preset-folder-audio'),
            image: document.getElementById('preset-folder-image'),
            sequence: document.getElementById('preset-folder-sequence'),
            solid: document.getElementById('preset-folder-solid'),
            btnSaveNew: document.getElementById('btn-preset-save-new'),
            btnDelete: document.getElementById('btn-preset-delete'),
            btnExport: document.getElementById('btn-preset-export'),
            btnImport: document.getElementById('btn-preset-import'),
            fileImport: document.getElementById('preset-import-file')
        };

        if (presetEls.select) {
            presetEls.select.addEventListener('change', function () {
                var selectedId = this.value;
                if (typeof FolderPresets !== 'undefined') {
                    FolderPresets.setActivePreset(selectedId);
                    loadPresetToInputs(selectedId);
                }
            });
        }

        if (presetEls.btnSaveNew) {
            presetEls.btnSaveNew.addEventListener('click', function () {
                var name = prompt(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'أدخل اسماً للقالب الجديد:' : 'Enter Preset Name:'), 'My Studio Preset');
                if (!name || !name.trim()) return;

                var id = 'custom_' + Date.now();
                var folders = {
                    video: presetEls.video ? presetEls.video.value : '01_FOOTAGE',
                    comps: presetEls.comps ? presetEls.comps.value : '02_COMPS',
                    audio: presetEls.audio ? presetEls.audio.value : '03_AUDIO',
                    image: presetEls.image ? presetEls.image.value : '04_IMAGES',
                    sequence: presetEls.sequence ? presetEls.sequence.value : '05_SEQUENCES',
                    solid: presetEls.solid ? presetEls.solid.value : '06_SOLIDS'
                };

                if (typeof FolderPresets !== 'undefined' && FolderPresets.savePreset(id, name.trim(), folders)) {
                    refreshPresetDropdown(id);
                    if (typeof ToastManager !== 'undefined') {
                        ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تم حفظ القالب بنجاح!' : 'Preset saved successfully!'), 'success');
                    }
                }
            });
        }

        if (presetEls.btnDelete) {
            presetEls.btnDelete.addEventListener('click', function () {
                if (typeof FolderPresets === 'undefined') return;
                var currentId = presetEls.select ? presetEls.select.value : '';
                var all = FolderPresets.getAllPresets();
                if (!all[currentId]) return;

                if (all[currentId].isBuiltIn) {
                    if (typeof ToastManager !== 'undefined') {
                        ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'لا يمكن حذف القوالب المدمجة' : 'Cannot delete built-in presets'), 'warning');
                    }
                    return;
                }

                if (confirm(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'هل أنت متأكد من حذف هذا القالب؟' : 'Are you sure you want to delete this preset?'))) {
                    if (FolderPresets.deletePreset(currentId)) {
                        refreshPresetDropdown('standard');
                        if (typeof ToastManager !== 'undefined') {
                            ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تم حذف القالب' : 'Preset deleted'), 'info');
                        }
                    }
                }
            });
        }

        if (presetEls.btnExport) {
            presetEls.btnExport.addEventListener('click', function () {
                if (typeof FolderPresets === 'undefined') return;
                var json = FolderPresets.exportJSON();
                try {
                    var blob = new Blob([json], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'mediaflow_presets.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    if (typeof ToastManager !== 'undefined') {
                        ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تم تصدير ملف القوالب بنجاح' : 'Presets exported successfully!'), 'success');
                    }
                } catch (e) {
                    if (typeof ToastManager !== 'undefined') {
                        ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'فشل التصدير: ' : 'Export failed: ') + e.message, 'error');
                    }
                }
            });
        }

        if (presetEls.btnImport && presetEls.fileImport) {
            presetEls.btnImport.addEventListener('click', function () {
                presetEls.fileImport.click();
            });

            presetEls.fileImport.addEventListener('change', function (e) {
                if (typeof FolderPresets === 'undefined') return;
                var file = e.target.files && e.target.files[0];
                if (!file) return;

                var reader = new FileReader();
                reader.onload = function (evt) {
                    var count = FolderPresets.importJSON(evt.target.result);
                    if (count > 0) {
                        refreshPresetDropdown();
                        if (typeof ToastManager !== 'undefined') {
                            ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تم استيراد ' + count + ' قالب بنجاح!' : 'Imported ' + count + ' preset(s) successfully!'), 'success');
                        }
                    } else {
                        if (typeof ToastManager !== 'undefined') {
                            ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'الملف لا يحتوي على قوالب صالحة' : 'File does not contain valid presets'), 'error');
                        }
                    }
                };
                reader.readAsText(file);
                e.target.value = ''; // Reset input
            });
        }
    }

    /**
     * Re-populate the preset dropdown
     */
    function refreshPresetDropdown(selectedId) {
        if (!presetEls.select || typeof FolderPresets === 'undefined') return;

        var presets = FolderPresets.getAllPresets();
        var active = FolderPresets.getActivePreset();
        var targetId = selectedId || (active ? active.id : 'standard');

        presetEls.select.innerHTML = '';
        for (var id in presets) {
            if (presets.hasOwnProperty(id)) {
                var opt = document.createElement('option');
                opt.value = id;
                opt.textContent = presets[id].name;
                if (id === targetId) opt.selected = true;
                presetEls.select.appendChild(opt);
            }
        }

        loadPresetToInputs(targetId);
    }

    /**
     * Fill folder mapping inputs from a preset
     */
    function loadPresetToInputs(presetId) {
        if (typeof FolderPresets === 'undefined') return;
        var presets = FolderPresets.getAllPresets();
        var p = presets[presetId] || presets['standard'];
        if (!p || !p.folders) return;

        if (presetEls.video) presetEls.video.value = p.folders.video || 'Video';
        if (presetEls.comps) presetEls.comps.value = p.folders.comps || 'Compositions';
        if (presetEls.audio) presetEls.audio.value = p.folders.audio || 'Audio';
        if (presetEls.image) presetEls.image.value = p.folders.image || 'Images';
        if (presetEls.sequence) presetEls.sequence.value = p.folders.sequence || 'Sequences';
        if (presetEls.solid) presetEls.solid.value = p.folders.solid || '[ Solids & Nulls ]';

        if (presetEls.btnDelete) {
            presetEls.btnDelete.disabled = !!p.isBuiltIn;
            presetEls.btnDelete.style.opacity = p.isBuiltIn ? '0.35' : '1';
        }
    }

    /**
     * Save currently edited folder mapping inputs
     */
    function saveActivePresetInputs() {
        if (typeof FolderPresets === 'undefined') return;
        var active = FolderPresets.getActivePreset();
        if (!active) return;

        var folders = {
            video: presetEls.video ? presetEls.video.value.trim() : 'Video',
            comps: presetEls.comps ? presetEls.comps.value.trim() : 'Compositions',
            audio: presetEls.audio ? presetEls.audio.value.trim() : 'Audio',
            image: presetEls.image ? presetEls.image.value.trim() : 'Images',
            sequence: presetEls.sequence ? presetEls.sequence.value.trim() : 'Sequences',
            solid: presetEls.solid ? presetEls.solid.value.trim() : '[ Solids & Nulls ]'
        };

        if (!active.isBuiltIn) {
            FolderPresets.savePreset(active.id, active.name, folders);
        } else {
            // Check if user changed any value in built-in
            var changed = false;
            for (var k in folders) {
                if (folders[k] !== active.folders[k]) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                FolderPresets.savePreset('custom_' + active.id, active.name + ' (Modified)', folders);
                refreshPresetDropdown('custom_' + active.id);
            }
        }
    }

    return {
        /**
         * Initialize with DOM references
         * @param {object} domRefs
         */
        init: function (domRefs) {
            els = domRefs || {};
            initPresetElements();
            refreshPresetDropdown();
        },

        /**
         * Load current settings into the UI form
         */
        loadToUI: function () {
            var settings = SettingsManager.getAll();

            // Import settings
            if (els.defaultMode) els.defaultMode.value = settings.import.defaultMode;
            if (els.rememberChoice) els.rememberChoice.checked = settings.import.rememberChoice;
            if (els.mediaFolderName) els.mediaFolderName.value = settings.import.mediaFolderName;

            // Organization settings
            var mainName = settings.organization.mainFolderName;
            if (els.mainFolderType) {
                if (mainName === 'MediaFlow Import' || mainName === 'Imported Media') {
                    els.mainFolderType.value = mainName;
                    if (els.mainFolderName) {
                        els.mainFolderName.classList.add('hidden');
                        els.mainFolderName.value = '';
                    }
                } else {
                    els.mainFolderType.value = 'custom';
                    if (els.mainFolderName) {
                        els.mainFolderName.classList.remove('hidden');
                        els.mainFolderName.value = mainName;
                    }
                }
            }
            if (els.subOrganization) els.subOrganization.value = settings.organization.subOrganization;

            // File handling settings
            if (els.duplicateHandling) els.duplicateHandling.value = settings.files.duplicateHandling;
            if (els.autoDetectSequences) els.autoDetectSequences.checked = settings.files.autoDetectSequences;
            if (els.sequencePadding) els.sequencePadding.value = settings.files.sequencePadding;

            // Presets
            refreshPresetDropdown();
        },

        /**
         * Save settings from the UI form
         */
        save: function () {
            // Import settings
            if (els.defaultMode) SettingsManager.set('import', 'defaultMode', els.defaultMode.value);
            if (els.rememberChoice) SettingsManager.set('import', 'rememberChoice', els.rememberChoice.checked);
            if (els.mediaFolderName) SettingsManager.set('import', 'mediaFolderName', els.mediaFolderName.value);

            // Organization settings
            if (els.mainFolderType) {
                var folderType = els.mainFolderType.value;
                var folderName = folderType === 'custom'
                    ? ((els.mainFolderName && els.mainFolderName.value.trim()) || 'MediaFlow Import')
                    : folderType;
                SettingsManager.set('organization', 'mainFolderName', folderName);
            }
            if (els.subOrganization) SettingsManager.set('organization', 'subOrganization', els.subOrganization.value);

            // File handling settings
            if (els.duplicateHandling) SettingsManager.set('files', 'duplicateHandling', els.duplicateHandling.value);
            if (els.autoDetectSequences) SettingsManager.set('files', 'autoDetectSequences', els.autoDetectSequences.checked);
            if (els.sequencePadding) SettingsManager.set('files', 'sequencePadding', parseInt(els.sequencePadding.value, 10));

            // Save active preset inputs
            saveActivePresetInputs();

            // Persist
            SettingsManager.save();

            if (typeof ToastManager !== 'undefined') {
                ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully!'), 'success');
            }
        },

        /**
         * Reset to defaults
         */
        reset: function () {
            if (confirm(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'هل أنت متأكد من استعادة الإعدادات الافتراضية؟' : 'Are you sure you want to reset all settings to defaults?'))) {
                SettingsManager.reset();
                if (typeof FolderPresets !== 'undefined') {
                    FolderPresets.setActivePreset('standard');
                }
                this.loadToUI();
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'تمت إعادة ضبط الإعدادات' : 'Settings reset to defaults'), 'info');
                }
            }
        }
    };
})();
