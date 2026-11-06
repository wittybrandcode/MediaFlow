/**
 * MediaFlow - File Handler (Facade)
 * Delegates to specialized modules: DirectoryScanner, SequenceDetector, FileValidator.
 * Version: 2.0 — Refactored for Single Responsibility
 */

const FileHandler = (function () {
    'use strict';

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
     * Get directory from path
     * @param {string} path
     * @returns {string}
     */
    function getDirectory(path) {
        var parts = path.split(/[/\\]/);
        parts.pop();
        return parts.join('/');
    }

    /**
     * Normalize path (Windows backslash to forward slash)
     * @param {string} path
     * @returns {string}
     */
    function normalizePath(path) {
        return path.replace(/\\/g, '/');
    }

    return {
        // ========== Delegated to FileValidator ==========
        detectType: function (path) { return FileValidator.detectType(path); },
        validateFile: function (path) { return FileValidator.validateFile(path); },
        validateFiles: function (paths) { return FileValidator.validateFiles(paths); },
        checkDuplicates: function (f, e) { return FileValidator.checkDuplicates(f, e); },
        generateUniqueName: function (n, e) { return FileValidator.generateUniqueName(n, e); },
        getSupportedExtensions: function () { return FileValidator.getSupportedExtensions(); },

        // ========== Delegated to SequenceDetector ==========
        isSequence: function (path) { return SequenceDetector.isSequence(path); },
        getSequenceInfo: function (path) { return SequenceDetector.getSequenceInfo(path); },

        // ========== Delegated to DirectoryScanner ==========
        scanDirectory: function (dirPath, depth) { return DirectoryScanner.scanDirectory(dirPath, depth); },

        // ========== Process Dropped Items (Orchestration) ==========
        /**
         * Process dropped items (files and folders)
         * @param {string[]} paths - Paths from drop
         * @returns {Promise<object>}
         */
        processDroppedItems: async function (paths) {
            var self = this;
            var allFiles = [];
            var folders = [];

            // Separate files and folders (Async Node FS preferred)
            var hasNode = typeof require !== 'undefined';
            var fs, statAsync;
            if (hasNode) {
                try {
                    fs = require('fs');
                    statAsync = require('util').promisify(fs.stat);
                } catch (e) {
                    console.error('[FileHandler] Node setup failed in processDroppedItems:', e);
                }
            }

            var statPromises = paths.map(async function (pathStr) {
                if (!CEPBridge.isCEPEnvironment()) {
                    allFiles.push(pathStr);
                    return;
                }

                if (hasNode && statAsync) {
                    try {
                        var itemStat = await statAsync(pathStr);
                        if (itemStat.isDirectory()) folders.push(pathStr);
                        else if (itemStat.isFile()) allFiles.push(pathStr);
                    } catch (e) {
                        allFiles.push(pathStr); // Assume file on error
                    }
                } else {
                    // Fallback to CEP FS
                    try {
                        var statRes = window.cep.fs.stat(pathStr);
                        if (statRes.err === 0) {
                            if (statRes.data.isDirectory()) folders.push(pathStr);
                            else if (statRes.data.isFile()) allFiles.push(pathStr);
                        } else {
                            allFiles.push(pathStr);
                        }
                    } catch (e) {
                        allFiles.push(pathStr);
                    }
                }
            });

            await Promise.all(statPromises);

            // Scan folders and build structure map
            var folderMap = {}; // Maps absolute file path → relative path from dropped root
            for (var i = 0; i < folders.length; i++) {
                var rootFolder = folders[i];
                var rootName = rootFolder.split(/[\/\\]/).pop(); // Folder name (robust split)
                var folderFiles = await self.scanDirectory(rootFolder, 0);

                // Pre-normalize rootFolder to ensure string replacement works on Windows
                var normRootFolder = normalizePath(rootFolder);

                for (var j = 0; j < folderFiles.length; j++) {
                    var filePath = folderFiles[j];
                    var normFilePath = normalizePath(filePath);

                    // Use case-insensitive slice to handle Windows drive letter C: vs c:
                    var relativeSubstring = "";
                    if (normFilePath.toLowerCase().indexOf(normRootFolder.toLowerCase()) === 0) {
                        relativeSubstring = normFilePath.substring(normRootFolder.length);
                    } else {
                        relativeSubstring = normFilePath.replace(normRootFolder, '');
                    }

                    // Compute relative path: rootName/subfolder/file.ext
                    var relative = rootName + '/' + relativeSubstring.replace(/^[/\\]+/, '');

                    folderMap[normFilePath] = relative;
                    allFiles.push(filePath);
                }
            }

            console.log('[FileHandler] folderMap built with ' + Object.keys(folderMap).length + ' entries from ' + folders.length + ' folder(s)');

            // Safety limit for massive folder drops
            var MAX_FILES = 5000;
            if (allFiles.length > MAX_FILES) {
                console.warn('[FileHandler] Ignored excess files. Maximum limit of ' + MAX_FILES + ' exceeded.');
                if (typeof UIController !== 'undefined') {
                    UIController.log('Warning: Dropped folder is too large. Only the first ' + MAX_FILES + ' files will be processed.', 'warning');
                }
                allFiles.length = MAX_FILES; // Truncate array to save memory
            }

            // Validate all files
            var validation = await self.validateFiles(allFiles);

            // Enrich validated files with relativePath from folderMap
            var hasFolders = folders.length > 0;
            if (hasFolders) {
                // To guarantee matching on Windows, normalize map keys to lowercase
                var lowerMap = {};
                for (var rawKey in folderMap) {
                    if (folderMap.hasOwnProperty(rawKey)) {
                        lowerMap[rawKey.toLowerCase()] = folderMap[rawKey];
                    }
                }

                for (var k = 0; k < validation.valid.length; k++) {
                    var fileObj = validation.valid[k];
                    var normalized = normalizePath(fileObj.path).toLowerCase();
                    if (lowerMap[normalized]) {
                        fileObj.relativePath = lowerMap[normalized];
                    }

                    // Critical Fix: Also enrich inner rawFiles if this is a sequence 
                    // that might get unpacked by the user later.
                    if (fileObj.rawFiles && fileObj.rawFiles.length > 0) {
                        for (var r = 0; r < fileObj.rawFiles.length; r++) {
                            var rawF = fileObj.rawFiles[r];
                            var normRaw = normalizePath(rawF.path).toLowerCase();
                            if (lowerMap[normRaw]) {
                                rawF.relativePath = lowerMap[normRaw];
                            }
                        }
                    }
                }
            }

            return {
                files: validation.valid,
                invalid: validation.invalid,
                folders: folders,
                hasFolders: hasFolders
            };
        },

        // ========== Utility Functions ==========
        /**
         * Group files by type
         * @param {object[]} files
         * @returns {object}
         */
        groupByType: function (files) {
            var groups = {
                video: [],
                audio: [],
                image: [],
                sequence: [],
                unknown: []
            };

            files.forEach(function (file) {
                var type = file.type || 'unknown';
                if (groups[type]) {
                    groups[type].push(file);
                } else {
                    groups.unknown.push(file);
                }
            });

            return groups;
        },

        /**
         * Get file type icon
         * @param {string} type
         * @returns {string}
         */
        getTypeIcon: function (type) {
            var icons = {
                video: '.movie',
                audio: 'audio_file',
                image: 'image',
                sequence: 'video_library',
                unknown: 'insert_drive_file'
            };
            return icons[type] || icons.unknown;
        },

        /**
         * Format file size
         * @param {number} bytes
         * @returns {string}
         */
        formatSize: function (bytes) {
            if (bytes === 0) return '0 B';

            var units = ['B', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(1024));

            return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}