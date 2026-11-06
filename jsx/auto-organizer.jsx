/**
 * MediaFlow - Auto Organizer
 * Handles automatic organization of existing project items.
 * Extracted from media-importer.jsx for Single Responsibility.
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.AutoOrganizer = {

    /**
     * Checks if a folder path is considered "loosely organized"
     * i.e., Root, TargetFolder root, or one of the predefined Type folders.
     */
    isLooselyOrganized: function (folderPath, targetFolder, folderNames) {
        if (!folderPath) return true; // Root folder
        if (folderPath === targetFolder) return true;

        var names = folderNames || {};
        var prefixMatches = [
            targetFolder + '/' + (names.video || 'Video'),
            targetFolder + '/' + (names.audio || 'Audio'),
            targetFolder + '/' + (names.image || 'Images'),
            targetFolder + '/' + (names.sequence || 'Sequences'),
            targetFolder + '/' + (names.solid || '[ Solids & Nulls ]'),
            targetFolder + '/Video',
            targetFolder + '/Audio',
            targetFolder + '/Images',
            targetFolder + '/Sequences',
            targetFolder + '/[ Solids & Nulls ]',
            '[ System Layers ]'
        ];

        for (var i = 0; i < prefixMatches.length; i++) {
            // Check if folderPath is exactly the type folder, or a subfolder of it (e.g. Video/mp4)
            if (folderPath === prefixMatches[i] || folderPath.indexOf(prefixMatches[i] + '/') === 0) {
                return true;
            }
        }

        return false;
    },

    /**
     * Preview auto-organize all root and loosely organized items in the project
     * @param {object} options
     * @returns {object}
     */
    previewAutoOrganize: function (options) {
        var result = {
            moves: [], // Array of { name: string, oldPath: string, newPath: string, type: string }
            error: null
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        try {
            var optionsObj = options || {};
            var targetFolder = optionsObj.targetFolder || 'MediaFlow Import';

            var itemsToOrganize = [];
            for (var i = 1, len = app.project.items.length; i <= len; i++) {
                var item = app.project.items[i];
                if (item instanceof FootageItem) {
                    itemsToOrganize.push(item);
                }
            }

            var customNames = optionsObj.folderNames || {};
            var smartFolderNames = {
                video: targetFolder + '/' + (customNames.video || 'Video'),
                audio: targetFolder + '/' + (customNames.audio || 'Audio'),
                image: targetFolder + '/' + (customNames.image || 'Images'),
                sequence: targetFolder + '/' + (customNames.sequence || 'Sequences'),
                solid: targetFolder + '/' + (customNames.solid || '[ Solids & Nulls ]')
            };

            for (var j = 0; j < itemsToOrganize.length; j++) {
                var itemToMove = itemsToOrganize[j];
                var fileType = 'unknown';
                var filePath = null;
                var fileName = itemToMove.name;

                if (!itemToMove.mainSource) continue;

                if (itemToMove.mainSource instanceof SolidSource) {
                    fileType = 'solid';
                } else if (itemToMove.file) {
                    filePath = itemToMove.file.fsName;
                    fileName = MediaFlow.Utils.getFileName(filePath);
                    fileType = MediaFlow.Utils.detectFileType(filePath, optionsObj.fileTypes);
                }

                if (fileType === 'unknown' || fileType === 'solid') continue;

                var currentPath = MediaFlow.FolderManager.getFolderPath(itemToMove.parentFolder);
                
                if (!this.isLooselyOrganized(currentPath, targetFolder)) {
                    continue;
                }

                var destFolderPath = smartFolderNames[fileType];
                if (!destFolderPath) continue;

                var extName = MediaFlow.Utils.getFileExtension(filePath);
                if (optionsObj.subOrganization === 'extension' && extName) {
                    destFolderPath += '/' + extName;
                }

                var destPathNorm = destFolderPath.replace(/^\//, ''); // Clean leading slashes
                if (currentPath !== destPathNorm) {
                    result.moves.push({
                        name: fileName,
                        oldPath: currentPath ? currentPath : 'Project Root',
                        newPath: destPathNorm,
                        type: fileType
                    });
                }
            }

            // Third pass: organize System Layers (Solids, Nulls, Adjustments)
            if (optionsObj.organizeSystemLayers !== false) {
                var sysFolderBase = '[ System Layers ]';
                var allItems = [];
                for (var s = 1, sLen = app.project.items.length; s <= sLen; s++) {
                    allItems.push(app.project.items[s]);
                }

                for (var si = 0; si < allItems.length; si++) {
                    var sysItem = allItems[si];
                    if (!(sysItem instanceof FootageItem) || !sysItem.mainSource) continue;

                    var layerType = null;
                    if (sysItem.mainSource instanceof SolidSource) {
                        if (sysItem.name.indexOf('Adjustment') !== -1 || sysItem.name.toLowerCase().indexOf('adjustment') !== -1) {
                            layerType = 'adjustment';
                        } else {
                            layerType = 'solid';
                        }
                    } else if (sysItem.name.indexOf('Null') !== -1 || sysItem.name.toLowerCase().indexOf('null') !== -1) {
                        layerType = 'null';
                    }

                    if (!layerType) continue;

                    var targetSysFolderPath = sysFolderBase;
                    switch (layerType) {
                        case 'solid': targetSysFolderPath += '/Solids'; break;
                        case 'null': targetSysFolderPath += '/Nulls'; break;
                        case 'adjustment': targetSysFolderPath += '/Adjustment Layers'; break;
                    }

                    var currentSysPath = MediaFlow.FolderManager.getFolderPath(sysItem.parentFolder);
                    if (currentSysPath !== targetSysFolderPath) {
                        result.moves.push({
                            name: sysItem.name,
                            oldPath: currentSysPath ? currentSysPath : 'Project Root',
                            newPath: targetSysFolderPath,
                            type: layerType
                        });
                    }
                }
            }
        } catch (e) {
            result.error = { message: e.message };
        }

        return result;
    },

    /**
     * Auto-organize all root and loosely organized items in the project
     * @param {object} options
     * @returns {object}
     */
    autoOrganizeProject: function (options) {
        var result = {
            movedCount: 0,
            movedVideo: 0,
            movedImage: 0,
            movedAudio: 0,
            movedSequence: 0,
            movedSystem: 0,
            osMoved: 0,
            osSkipped: 0,
            skippedSequences: [],
            mode: (options || {}).mode || 'ae-only',
            projectNotSaved: false,
            failedItems: [],
            error: null
        };

        // AE Label Color Map (0-16)
        // See AE docs
        var LABEL_COLORS = {
            "video": 9,      // Blue
            "audio": 4,      // Green (Sea Green)
            "image": 3,      // Yellow (Teal)
            "sequence": 6,   // Purple (Lavender)
            "solid": 14,     // Coral
            "null": 11,      // Peach
            "adjustment": 15 // Chestnut
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        app.beginUndoGroup('MediaFlow Auto-Organize');

        try {
            var optionsObj = options || {};
            var targetFolder = optionsObj.targetFolder || 'MediaFlow Import';
            var folders = MediaFlow.FolderManager.createSmartOrganizeFolders(targetFolder, optionsObj.subOrganization, optionsObj.folderNames);

            // Warn if os-ae mode but project not saved
            if (optionsObj.mode === 'os-ae' && !app.project.file) {
                result.projectNotSaved = true;
            }

            if (!folders || !folders.parent) {
                throw new Error('Could not create smart folders');
            }

            // First pass: collect all footage items we want to organize
            var itemsToOrganize = [];
            for (var i = 1, len = app.project.items.length; i <= len; i++) {
                var item = app.project.items[i];

                if (item instanceof FootageItem) {
                    itemsToOrganize.push(item);
                }
            }

            // Cache to track files already moved on OS to handle duplicate project items
            var movedFilesCache = {}; // { originalPath: newPath }

            // Second pass: organize the collected items
            for (var j = 0; j < itemsToOrganize.length; j++) {
                var itemToMove = itemsToOrganize[j];
                var fileType = 'unknown';
                var filePath = null;
                var fileName = itemToMove.name;

                if (!itemToMove.mainSource) continue;

                if (itemToMove.mainSource instanceof SolidSource) {
                    fileType = 'solid';
                } else if (itemToMove.file) {
                    filePath = itemToMove.file.fsName;
                    fileName = MediaFlow.Utils.getFileName(filePath);
                    fileType = MediaFlow.Utils.detectFileType(filePath, optionsObj.fileTypes);
                }

                if (fileType === 'unknown' || fileType === 'solid') continue;

                var currentPath = MediaFlow.FolderManager.getFolderPath(itemToMove.parentFolder);
                if (!this.isLooselyOrganized(currentPath, targetFolder)) {
                    continue;
                }

                var destFolder = MediaFlow.FolderManager.getFolderForType(fileType, folders);
                if (!destFolder) continue;

                var extName = MediaFlow.Utils.getFileExtension(filePath);
                if (optionsObj.subOrganization === 'extension' && extName) {
                    destFolder = MediaFlow.FolderManager.getOrCreateSubFolder(destFolder, extName);
                }

                // Move physical file on OS if mode is 'os-ae' (SKIP SOLIDS & SEQUENCES)
                if (optionsObj.mode === 'os-ae' && app.project.file && filePath && fileType !== 'solid') {
                    
                    // Task: Check if this is a sequence. Moving sequences is risky as it only identifies the 1st file.
                    // We skip physical move for sequences but still organize them in AE bins.
                    if (fileType === 'sequence') {
                        result.osSkipped++;
                        result.skippedSequences.push(fileName);
                        MediaFlow.Utils.log('Safely skipped OS move for Sequence: ' + fileName + ' (to preserve image links)');
                    } else {
                        var srcNorm = MediaFlow.Utils.normalizePath(filePath);

                        // Check cache first: Have we already moved this physical file?
                        if (movedFilesCache[srcNorm]) {
                            try {
                                itemToMove.replace(new File(movedFilesCache[srcNorm]));
                                result.osMoved++;
                            } catch (e) {
                                result.failedItems.push({ name: fileName, reason: 'Duplicate relink failed: ' + e.message });
                            }
                        } else {
                            var projectFolder = app.project.file.parent.fsName;
                            var mediaFolderName = optionsObj.mediaFolderName || '_media';
                            var osMediaFolder = projectFolder + '/' + mediaFolderName;

                            var typeFolderName = '';
                            switch (fileType) {
                                case 'video': typeFolderName = 'Video'; break;
                                case 'audio': typeFolderName = 'Audio'; break;
                                case 'image': typeFolderName = 'Images'; break;
                            }

                            var osTargetFolder = osMediaFolder;
                            if (typeFolderName) osTargetFolder += '/' + typeFolderName;
                            if (optionsObj.subOrganization === 'extension' && extName) osTargetFolder += '/' + extName;

                            MediaFlow.Utils.ensureFolder(osTargetFolder);
                            var newOsPath = osTargetFolder + '/' + fileName;
                            var tgtNorm = MediaFlow.Utils.normalizePath(newOsPath);

                            if (srcNorm !== tgtNorm) {
                                if (MediaFlow.Utils.fileExists(newOsPath)) {
                                    fileName = MediaFlow.Utils.generateUniqueFileName(osTargetFolder, fileName);
                                    newOsPath = osTargetFolder + '/' + fileName;
                                }

                                var moveResult = MediaFlow.Utils.moveFileInternal(filePath, newOsPath);
                                if (moveResult.success) {
                                    try {
                                        itemToMove.replace(new File(newOsPath));
                                        result.osMoved++;
                                        // Update cache
                                        movedFilesCache[srcNorm] = newOsPath;
                                    } catch (e) {
                                        // ROLLBACK: Move file back to prevent footage going missing
                                        try {
                                            MediaFlow.Utils.moveFileInternal(newOsPath, filePath);
                                            MediaFlow.Utils.log('Rollback OK: ' + fileName + ' restored to original location');
                                        } catch (rbErr) {
                                            MediaFlow.Utils.log('CRITICAL: Rollback failed for ' + fileName + ': ' + rbErr.message);
                                        }
                                        result.failedItems.push({
                                            name: fileName,
                                            oldPath: filePath,
                                            newPath: newOsPath,
                                            reason: 'Relink failed (rolled back): ' + e.message
                                        });
                                    }
                                } else {
                                    result.failedItems.push({
                                        name: fileName,
                                        oldPath: filePath,
                                        newPath: newOsPath,
                                        reason: 'OS Move failed: ' + (moveResult.error || 'unknown')
                                    });
                                }
                            } else {
                                result.osSkipped++;
                            }
                        }
                    }
                }

                // Move item in AE Bins if it's not already in the correct folder
                if (itemToMove.parentFolder !== destFolder) {
                    itemToMove.parentFolder = destFolder;
                    result.movedCount++;

                    // Apply label color if enabled (default: true)
                    if (optionsObj.applyLabels !== false && LABEL_COLORS[fileType] !== undefined) {
                        try { itemToMove.label = LABEL_COLORS[fileType]; } catch (e) { /* label not critical */ }
                    }

                    switch (fileType) {
                        case 'video': result.movedVideo++; break;
                        case 'image': result.movedImage++; break;
                        case 'audio': result.movedAudio++; break;
                        case 'sequence': result.movedSequence++; break;
                    }
                }
            }

            MediaFlow.FolderManager.cleanupEmptyFolders(folders.parent);

            // -- Third pass: organize System Layers (Solids, Nulls, Adjustments) --
            if (optionsObj.organizeSystemLayers !== false) {
                var sysFolder = null;         // Lazy-created
                var solidFolder = null;
                var nullFolder = null;
                var adjFolder = null;

                var allItems = [];
                for (var s = 1, sLen = app.project.items.length; s <= sLen; s++) {
                    allItems.push(app.project.items[s]);
                }

                for (var si = 0; si < allItems.length; si++) {
                    var sysItem = allItems[si];
                    if (!(sysItem instanceof FootageItem) || !sysItem.mainSource) continue;

                    var layerType = null;

                    if (sysItem.mainSource instanceof SolidSource) {
                        // Distinguish Adjustment Layers from regular Solids
                        // AE Solids have mainSource.color; Adjustment layers are used as effects hosts
                        if (sysItem.name.indexOf('Adjustment') !== -1 || sysItem.name.indexOf('adjustment') !== -1) {
                            layerType = 'adjustment';
                        } else {
                            layerType = 'solid';
                        }
                    } else if (sysItem.name.indexOf('Null') !== -1 || sysItem.name.indexOf('null') !== -1 || sysItem.name.indexOf('NULL') !== -1) {
                        // Null objects are typically named "Null 1", "Null 2", etc.
                        layerType = 'null';
                    }

                    if (!layerType) continue;

                    // Lazy-create the [ System Layers ] folder tree
                    if (!sysFolder) {
                        sysFolder = MediaFlow.FolderManager.findFolderByName('[ System Layers ]');
                        if (!sysFolder) {
                            sysFolder = app.project.items.addFolder('[ System Layers ]');
                        }
                    }

                    var targetSysFolder = null;
                    switch (layerType) {
                        case 'solid':
                            if (!solidFolder) {
                                solidFolder = MediaFlow.FolderManager.findFolderByName('Solids', sysFolder);
                                if (!solidFolder) solidFolder = app.project.items.addFolder('Solids');
                                if (solidFolder.parentFolder !== sysFolder) solidFolder.parentFolder = sysFolder;
                            }
                            targetSysFolder = solidFolder;
                            break;
                        case 'null':
                            if (!nullFolder) {
                                nullFolder = MediaFlow.FolderManager.findFolderByName('Nulls', sysFolder);
                                if (!nullFolder) nullFolder = app.project.items.addFolder('Nulls');
                                if (nullFolder.parentFolder !== sysFolder) nullFolder.parentFolder = sysFolder;
                            }
                            targetSysFolder = nullFolder;
                            break;
                        case 'adjustment':
                            if (!adjFolder) {
                                adjFolder = MediaFlow.FolderManager.findFolderByName('Adjustment Layers', sysFolder);
                                if (!adjFolder) adjFolder = app.project.items.addFolder('Adjustment Layers');
                                if (adjFolder.parentFolder !== sysFolder) adjFolder.parentFolder = sysFolder;
                            }
                            targetSysFolder = adjFolder;
                            break;
                    }

                    if (targetSysFolder && sysItem.parentFolder !== targetSysFolder) {
                        sysItem.parentFolder = targetSysFolder;
                        result.movedSystem++;
                        result.movedCount++;

                        // Apply label
                        if (optionsObj.applyLabels !== false && LABEL_COLORS[layerType] !== undefined) {
                            try { sysItem.label = LABEL_COLORS[layerType]; } catch (e) { /* label not critical */ }
                        }
                    }
                }
            }

        } catch (e) {
            result.error = { message: e.message };
        } finally {
            app.endUndoGroup();
        }

        return result;
    }
};

