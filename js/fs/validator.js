/**
 * MediaFlow - File Validator
 * Handles file validation, type detection, and batch grouping.
 * Extracted from file-handler.js for Single Responsibility.
 * Version: 1.0
 */

var FileValidator = (function () {
    'use strict';

    /**
     * Supported file types (from shared config)
     */
    var FILE_TYPES = FILE_TYPES_CONFIG;

    /**
     * System/junk files to silently skip during import
     */
    var SYSTEM_FILES = {
        '.ds_store': true,
        'thumbs.db': true,
        'desktop.ini': true,
        '.thumbs': true,
        '.spotlight-v100': true,
        '.trashes': true,
        '.fseventsd': true,
        'icon\r': true,
        '.bbridge': true,
        '.apdisk': true
    };

    /**
     * Get file extension
     * @param {string} path
     * @returns {string}
     */
    function getExtension(path) {
        var parts = path.split('.');
        if (parts.length < 2) return '';
        return parts[parts.length - 1].toLowerCase();
    }

    /**
     * Get file name from path
     * @param {string} path
     * @returns {string}
     */
    function getFileName(path) {
        var parts = path.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Normalize path
     * @param {string} path
     * @returns {string}
     */
    function normalizePath(path) {
        return path.replace(/\\/g, '/');
    }

    return {
        /**
         * Detect file type from extension
         * @param {string} path - File path
         * @returns {string} Type: 'video', 'audio', 'image', 'sequence', or 'unknown'
         */
        detectType: function (path) {
            var ext = getExtension(path);

            // Special check for sequences FIRST
            if (FILE_TYPES.sequence && FILE_TYPES.sequence.indexOf(ext) !== -1) {
                if (SequenceDetector.isSequence(path)) {
                    return 'sequence';
                }
            }

            // Check each type
            for (var type in FILE_TYPES) {
                if (FILE_TYPES.hasOwnProperty(type) && type !== 'sequence') {
                    if (FILE_TYPES[type].indexOf(ext) !== -1) {
                        return type;
                    }
                }
            }

            return 'unknown';
        },

        /**
         * Validate a single file
         * @param {string} path - File path
         * @returns {object} { valid, error, file }
         */
        validateFile: function (path) {
            var fs;
            try {
                if (typeof require !== 'undefined') fs = require('fs');
            } catch(e) {}

            var fileSize = 0;
            if (fs) {
                try {
                    var stat = fs.statSync(path);
                    fileSize = stat.size;
                } catch(e) {}
            }

            var result = {
                valid: true,
                error: null,
                file: {
                    path: normalizePath(path),
                    name: getFileName(path),
                    extension: getExtension(path),
                    type: 'unknown',
                    size: fileSize
                }
            };

            // Check extension
            if (!result.file.extension) {
                result.valid = false;
                result.error = 'NO_EXTENSION';
                return result;
            }

            // Detect type
            result.file.type = this.detectType(path);

            // Check if supported
            if (result.file.type === 'unknown') {
                result.valid = false;
                result.error = 'UNSUPPORTED_FORMAT';
                return result;
            }

            // New: Check for 0-byte files (Empty/Corrupt)
            if (result.file.size === 0) {
                result.valid = false;
                result.error = 'EMPTY_FILE';
                return result;
            }

            return result;
        },

        /**
         * Validate multiple files and group image sequences
         * @param {string[]} paths - File paths
         * @returns {Promise<object>} { valid: [], invalid: [] }
         */
        validateFiles: async function (paths) {
            var self = this;
            var result = {
                valid: [],
                invalid: []
            };

            // Temporary store for discovered sequences
            var sequencesMap = {};
            var standardFiles = [];

            // First pass: identify validity and separate sequences from single files
            for (var i = 0; i < paths.length; i++) {
                // Yield the main thread every 50 files to keep UI responsive
                if (i % 50 === 0) await new Promise(function (r) { setTimeout(r, 0); });

                var path = paths[i];
                var name = getFileName(path).toLowerCase();

                // Skip system/junk files silently
                if (SYSTEM_FILES[name] || name.charAt(0) === '.') {
                    continue;
                }

                var validation = self.validateFile(path);

                if (validation.valid) {
                    var fileObj = validation.file;

                    if (fileObj.type === 'sequence') {
                        var seqInfo = SequenceDetector.getSequenceInfo(path);
                        if (seqInfo) {
                            var key = seqInfo.baseName + '.' + seqInfo.extension;
                            if (!sequencesMap[key]) {
                                sequencesMap[key] = {
                                    file: fileObj,
                                    info: seqInfo,
                                    count: 1,
                                    minFrame: seqInfo.startFrame,
                                    rawFiles: [fileObj]
                                };
                            } else {
                                sequencesMap[key].count++;
                                sequencesMap[key].rawFiles.push(fileObj);
                                if (seqInfo.startFrame < sequencesMap[key].minFrame) {
                                    sequencesMap[key].minFrame = seqInfo.startFrame;
                                    sequencesMap[key].file = fileObj;
                                }
                            }
                        } else {
                            standardFiles.push(fileObj);
                        }
                    } else {
                        standardFiles.push(fileObj);
                    }
                } else {
                    result.invalid.push({
                        path: path,
                        name: getFileName(path),
                        error: validation.error
                    });
                }
            }

            // Second pass: Process identified sequences
            var autoDetect = (typeof SettingsManager !== 'undefined') ? SettingsManager.get('files', 'autoDetectSequences') : true;

            for (var key in sequencesMap) {
                if (sequencesMap.hasOwnProperty(key)) {
                    var seqData = sequencesMap[key];
                    if (autoDetect && seqData.count > 2) {
                        var seqFile = JSON.parse(JSON.stringify(seqData.file));

                        seqFile.isSequence = true;
                        seqFile.sequenceCount = seqData.count;

                        var baseFileName = getFileName(seqData.info.baseName);
                        seqFile.displayName = baseFileName + '[sequence].' + seqData.info.extension;

                        seqFile.rawFiles = seqData.rawFiles;
                        seqFile.size = 0;
                        if (seqData.rawFiles) {
                            for (var rf = 0; rf < seqData.rawFiles.length; rf++) {
                                seqFile.size += (seqData.rawFiles[rf].size || 0);
                            }
                        }
                        result.valid.push(seqFile);
                    } else {
                        for (var r = 0; r < seqData.rawFiles.length; r++) {
                            var raw = seqData.rawFiles[r];
                            raw.type = 'image';
                            result.valid.push(raw);
                        }
                    }
                }
            }

            // Push all the standard files
            result.valid = result.valid.concat(standardFiles);

            return result;
        },

        /**
         * Check for duplicates
         * @param {object[]} files - File objects
         * @param {object[]} existingFiles - Existing file names
         * @returns {object} { unique: [], duplicates: [] }
         */
        checkDuplicates: function (files, existingFiles) {
            existingFiles = existingFiles || [];

            var result = {
                unique: [],
                duplicates: []
            };

            var existingNames = {};
            existingFiles.forEach(function (f) {
                existingNames[f.name.toLowerCase()] = true;
            });

            files.forEach(function (file) {
                if (existingNames[file.name.toLowerCase()]) {
                    result.duplicates.push(file);
                } else {
                    result.unique.push(file);
                }
            });

            return result;
        },

        /**
         * Generate unique name
         * @param {string} name - Original name
         * @param {string[]} existingNames - Existing names
         * @returns {string} Unique name
         */
        generateUniqueName: function (name, existingNames) {
            var ext = getExtension(name);
            var baseName = name.substring(0, name.length - ext.length - 1);

            var counter = 1;
            var newName = name;

            var existingLower = existingNames.map(function (n) {
                return n.toLowerCase();
            });

            while (existingLower.indexOf(newName.toLowerCase()) !== -1) {
                newName = baseName + '_' + counter + '.' + ext;
                counter++;
            }

            return newName;
        },

        /**
         * Get supported extensions list
         * @returns {string[]}
         */
        getSupportedExtensions: function () {
            var extensions = [];
            for (var type in FILE_TYPES) {
                if (FILE_TYPES.hasOwnProperty(type)) {
                    FILE_TYPES[type].forEach(function (ext) {
                        if (extensions.indexOf(ext) === -1) {
                            extensions.push(ext);
                        }
                    });
                }
            }
            return extensions;
        },

        // Expose utilities needed externally
        getExtension: getExtension,
        getFileName: getFileName,
        normalizePath: normalizePath,
        isSystemFile: function (name) { return !!SYSTEM_FILES[name.toLowerCase()]; }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileValidator;
}
