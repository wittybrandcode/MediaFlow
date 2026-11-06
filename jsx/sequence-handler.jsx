/**
 * MediaFlow - Sequence Handler
 * Handles image sequence detection, import, and related utilities.
 * Extracted from media-importer.jsx for Single Responsibility.
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.SequenceHandler = {

    /**
     * Import a sequence
     * @param {string} filePath
     * @returns {FootageItem|null}
     */
    importSequence: function (filePath) {
        try {
            var importOptions = new ImportOptions(new File(filePath));

            var seqInfo = MediaFlow.Utils.getSequenceInfo(filePath);

            if (seqInfo) {
                importOptions.sequence = true;

                if (importOptions.canImportSequence) {
                    var importedSeq = app.project.importFile(importOptions);

                    // Task 3.5: Guess Alpha Channel to avoid AE popup freezing
                    if (importedSeq && importedSeq.mainSource && importedSeq.mainSource.hasAlpha) {
                        try {
                            importedSeq.mainSource.alphaMode = AlphaMode.STRAIGHT;
                        } catch (alphaErr) { }
                    }

                    return importedSeq;
                }
            }

            // Fallback to single import
            return MediaFlow.Importer.importSingle(filePath);

        } catch (e) {
            MediaFlow.Utils.log('Import sequence error: ' + e.message);
            return null;
        }
    },

    /**
     * Check if file is already in project
     * @param {string} filePath
     * @returns {boolean}
     */
    isDuplicate: function (filePath) {
        var fileName = MediaFlow.Utils.getFileName(filePath);
        var normPath = MediaFlow.Utils.normalizePath(filePath);

        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item instanceof FootageItem && item.file) {
                var itemPath = MediaFlow.Utils.normalizePath(item.file.fsName);
                if (itemPath === normPath) {
                    return 'exact';
                }
                if (item.name === fileName) {
                    return 'name-only'; // Duplicate name but different path
                }
            }
        }

        return false;
    },

    /**
     * Find footage item by name
     * @param {string} name
     * @returns {FootageItem|null}
     */
    findFootageByName: function (name) {
        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item instanceof FootageItem && item.name === name) {
                return item;
            }
        }

        return null;
    },

    /**
     * Find footage item by path
     * @param {string} path
     * @returns {FootageItem|null}
     */
    findFootageByPath: function (path) {
        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item instanceof FootageItem && item.file) {
                if (MediaFlow.Utils.normalizePath(item.file.fsName) === MediaFlow.Utils.normalizePath(path)) {
                    return item;
                }
            }
        }

        return null;
    },

    /**
     * Get all footage items in project
     * @returns {Array}
     */
    getAllFootage: function () {
        var footage = [];

        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item instanceof FootageItem) {
                footage.push({
                    name: item.name,
                    path: item.file ? item.file.fsName : null,
                    type: item.mainSource ? item.mainSource.constructor.name : 'unknown',
                    duration: item.duration,
                    frameRate: item.frameRate
                });
            }
        }

        return footage;
    },

    /**
     * Replace footage
     * @param {string} itemName
     * @param {string} newPath
     * @returns {boolean}
     */
    replaceFootage: function (itemName, newPath) {
        var item = this.findFootageByName(itemName);

        if (item && item.file) {
            try {
                item.replace(new File(newPath));
                return true;
            } catch (e) {
                MediaFlow.Utils.log('Replace footage error: ' + e.message);
            }
        }

        return false;
    },

    /**
     * Reload footage
     * @param {string} itemName
     * @returns {boolean}
     */
    reloadFootage: function (itemName) {
        var item = this.findFootageByName(itemName);

        if (item && item.mainSource) {
            try {
                item.mainSource.reload();
                return true;
            } catch (e) {
                MediaFlow.Utils.log('Reload footage error: ' + e.message);
            }
        }

        return false;
    }
};

