/**
 * MediaFlow - Media Importer
 * Import logic and file operations
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.Importer = {

    /**
     * Import files into After Effects
     * @param {object} data - { files, mode, options }
     * @returns {object}
     */
    importFiles: function (data) {
        var result = {
            imported: [],
            skipped: [],
            failed: []
        };

        if (!data.files || data.files.length === 0) {
            return result;
        }

        if (!app.project) {
            throw new Error('NO_PROJECT');
        }

        var mode = data.mode || 'link';
        var options = data.options || {};
        var files = data.files;

        // Log import parameters for debugging (no blocking alert)
        MediaFlow.Utils.log('Import: structureMode=' + (options.structureMode ? 'TRUE' : 'FALSE') + ', mode=' + mode + ', files=' + files.length);

        app.beginUndoGroup('MediaFlow Import');

        try {
            var projectFolder = null;
            var mediaFolder = null;
            var mediaFolders = null;
            var customFolderNames = options.folderNames || {};
            var vFolder = customFolderNames.video || 'Video';
            var aFolder = customFolderNames.audio || 'Audio';
            var iFolder = customFolderNames.image || 'Images';
            var sFolder = customFolderNames.sequence || 'Sequences';

            if (mode === 'copy') {
                if (!app.project.file) {
                    throw new Error('PROJECT_NOT_SAVED');
                }
                
                projectFolder = app.project.file.parent.fsName;
                var mediaFolderName = options.mediaFolderName || '_media';
                mediaFolder = projectFolder + '/' + mediaFolderName;
                MediaFlow.Utils.ensureFolder(mediaFolder);

                mediaFolders = {
                    video: mediaFolder + '/' + vFolder,
                    audio: mediaFolder + '/' + aFolder,
                    image: mediaFolder + '/' + iFolder,
                    sequence: mediaFolder + '/' + sFolder
                };

                for (var key in mediaFolders) {
                    if (mediaFolders.hasOwnProperty(key)) {
                        MediaFlow.Utils.ensureFolder(mediaFolders[key]);
                    }
                }
            }

            var folders = null;
            if (options.organizeByType !== false) {
                var targetFolder = options.targetFolder || 'MediaFlow Import';
                folders = MediaFlow.FolderManager.createSmartOrganizeFolders(targetFolder, options.subOrganization, options.folderNames);
            }

            var importContext = {
                mode: mode,
                options: options,
                mediaFolder: mediaFolder,
                mediaFolders: mediaFolders,
                folders: folders
            };

            for (var i = 0; i < files.length; i++) {
                var fileData = files[i];
                var importResult = this.importSingleFile(fileData, importContext);

                if (importResult.imported) {
                    result.imported.push(importResult.item);
                } else if (importResult.skipped) {
                    result.skipped.push(importResult.item);
                } else {
                    result.failed.push(importResult.item);
                }
            }

            if (folders && folders.parent) {
                MediaFlow.FolderManager.cleanupEmptyFolders(folders.parent);
            }

        } catch (e) {
            MediaFlow.Utils.log('Import error: ' + e.message);
        } finally {
            app.endUndoGroup();
        }

        return result;
    },

    /**
     * Import a single file
     * @param {object|string} fileData
     * @param {object} ctx
     * @returns {object}
     */
    importSingleFile: function (fileData, ctx) {
        var filePath = typeof fileData === 'string' ? fileData : fileData.path;
        var forceSequence = typeof fileData === 'object' && fileData.isSequence === true;
        var forceIndividual = typeof fileData === 'object' && fileData.forceIndividual === true;

        var mode = ctx.mode;
        var options = ctx.options;
        var mediaFolder = ctx.mediaFolder;
        var mediaFolders = ctx.mediaFolders;
        var folders = ctx.folders;
        var result = {
            imported: false,
            skipped: false,
            item: {
                name: MediaFlow.Utils.getFileName(filePath),
                path: filePath,
                type: (typeof fileData === 'object' && fileData.type) ? fileData.type : MediaFlow.Utils.detectFileType(filePath, ctx.options ? ctx.options.fileTypes : null),
                reason: null
            }
        };

        try {
            if (!MediaFlow.Utils.fileExists(filePath)) {
                result.item.reason = 'File not found';
                return result;
            }

            var importPath = filePath;
            var fileType = (typeof fileData === 'object' && fileData.type) ? fileData.type : MediaFlow.Utils.detectFileType(filePath, ctx.options ? ctx.options.fileTypes : null);

            // Trust JS validation (fileData.isSequence) definitively if available, otherwise fallback to rough regex
            var isSeq = forceSequence || (!forceIndividual && ((typeof fileData === 'object') ? !!fileData.isSequence : MediaFlow.Utils.isSequence(filePath)));

            var dupType = typeof fileData === 'object' && fileData.duplicateType ? fileData.duplicateType : false;
            var dupAction = (options && options.duplicateAction) ? options.duplicateAction : 'skip';

            // 1. Skip early
            if (dupType && dupAction === 'skip') {
                result.skipped = true;
                result.item.reason = 'Skipped duplicate';
                return result;
            }

            // 2. Replace AE Link Only (skip copy entirely, just replace and return)
            if (dupType && dupAction === 'replace_link') {
                var existingLink = dupType === 'exact' 
                    ? MediaFlow.SequenceHandler.findFootageByPath(filePath) 
                    : MediaFlow.SequenceHandler.findFootageByName(MediaFlow.Utils.getFileName(filePath));
                
                if (existingLink) {
                    try {
                        existingLink.replace(new File(filePath));
                        result.imported = true;
                        result.item.reason = 'Replaced AE Link';
                        result.item.id = existingLink.id;
                        return result;
                    } catch (e) {
                        result.item.reason = 'Failed to replace link: ' + e.message;
                        return result;
                    }
                }
            }

            var forceOverwrite = (dupType && dupAction === 'overwrite_reload');

            // Handle copy mode
            if (mode === 'copy' && mediaFolder) {
                var targetFolder = mediaFolder;
                var isFolderDrop = typeof fileData === 'object' && !!fileData.relativePath;
                
                // If structureMode is active, skip type-based physical folders ONLY IF it's a folder drop
                if (mediaFolders && (!options.structureMode || !isFolderDrop)) {
                    switch (fileType) {
                        case 'video': targetFolder = mediaFolders.video; break;
                        case 'audio': targetFolder = mediaFolders.audio; break;
                        case 'image': targetFolder = mediaFolders.image; break;
                        case 'sequence': targetFolder = mediaFolders.sequence || mediaFolders.image; break;
                        default: targetFolder = mediaFolder;
                    }

                    if (options.subOrganization === 'extension') {
                        var extName = MediaFlow.Utils.getFileExtension(filePath);
                        if (extName) {
                            targetFolder = targetFolder + '/' + extName;
                            MediaFlow.Utils.ensureFolder(targetFolder);
                        }
                    }
                }

                if (isSeq && fileData.rawFiles && fileData.rawFiles.length > 0) {
                    var firstRawPath = typeof fileData.rawFiles[0] === 'string' ? fileData.rawFiles[0] : fileData.rawFiles[0].path;
                    var firstCopy = this.copyFileToMediaFolder(firstRawPath, targetFolder, options.structureMode, fileData.relativePath, forceOverwrite);

                    if (firstCopy.success) {
                        importPath = firstCopy.newPath;

                        for (var j = 1; j < fileData.rawFiles.length; j++) {
                            var rawFile = fileData.rawFiles[j];
                            var rawPath = typeof rawFile === 'string' ? rawFile : rawFile.path;
                            this.copyFileToMediaFolder(rawPath, targetFolder, options.structureMode, fileData.relativePath, forceOverwrite);
                        }
                    } else {
                        result.item.reason = 'Sequence copy failed: ' + firstCopy.error;
                        return result;
                    }
                } else {
                    var copyResult = this.copyFileToMediaFolder(filePath, targetFolder, options.structureMode, fileData.relativePath, forceOverwrite);

                    if (copyResult.success) {
                        importPath = copyResult.newPath;
                    } else {
                        result.item.reason = 'Copy failed: ' + copyResult.error;
                        return result;
                    }
                }
            }

            // 3. Post-copy duplicated logic
            var isStillDuplicate = MediaFlow.SequenceHandler.isDuplicate(importPath);

            if (isStillDuplicate) {
                if (dupType && dupAction === 'overwrite_reload') {
                    // Try to find and reload the existing AE item
                    var existingItem = dupType === 'exact' 
                        ? MediaFlow.SequenceHandler.findFootageByPath(importPath) 
                        : MediaFlow.SequenceHandler.findFootageByName(MediaFlow.Utils.getFileName(importPath));
                        
                    if (existingItem) {
                        try {
                            existingItem.mainSource.reload();
                            result.imported = true;
                            result.item.reason = 'Overwrote and reloaded';
                            result.item.id = existingItem.id;
                            
                            // Re-organize it if folders exist
                            MediaFlow.FolderManager.cleanupEmptyFolders(existingItem.parentFolder);
                            importedItem = existingItem; // let the logic below organize it
                            isSeq = false; // block sequence renaming logic
                        } catch(e) { }
                    }
                } else if (dupType && dupAction === 'redundant_link') {
                    // Allow it to pass through and import redundantly
                } else if (dupType && dupAction === 'rename_new') {
                    // Should pass if copy mode renamed it! If Link mode, AE allows redundant imports!
                } else {
                    // Safety catch-all for unseen duplicates or default skip
                    result.skipped = true;
                    result.item.reason = 'Already exists in project';
                    return result;
                }
            }

            if (result.imported && importedItem) {
                // Skips the app.project.importFile entirely because it's a reload!
            } else {
                // Import the file
                importedItem = null;

                if (isSeq && fileType !== 'audio') {
                    importedItem = this.importSequence(importPath);
                } else {
                    importedItem = this.importSingle(importPath);
                }
            }

            if (importedItem) {
                // Force sequence name override to prevent AE from naming it after the parent folder
                if (isSeq && typeof fileData === 'object') {
                    if (fileData.displayName) {
                        importedItem.name = fileData.displayName;
                    } else if (fileData.name) {
                        importedItem.name = fileData.name + ' [Sequence]';
                    }
                }

                // Structure Mode: create bins matching the original folder hierarchy
                if (options.structureMode && typeof fileData === 'object' && fileData.relativePath) {
                    var relParts = fileData.relativePath.replace(/\\/g, '/').split('/');
                    relParts.pop(); // Remove filename, keep only folder segments

                    if (relParts.length > 0) {
                        // Use the import target folder as the root, or project root
                        var structRoot = folders ? folders.parent : app.project.rootFolder;
                        var currentBin = structRoot;

                        for (var sp = 0; sp < relParts.length; sp++) {
                            // Trim empty parts to be safe
                            if (relParts[sp]) {
                                currentBin = MediaFlow.FolderManager.getOrCreateSubFolder(currentBin, relParts[sp]);
                            }
                        }

                        MediaFlow.FolderManager.moveItemToFolder(importedItem, currentBin);
                    } else {
                        // File is at root level of dropped folder, use type-based organization instead
                        if (folders && (mode === 'smart' || options.organizeByType)) {
                            var rootOrgFolder = MediaFlow.FolderManager.getFolderForType(fileType, folders);
                            if (rootOrgFolder) {
                                if (options.subOrganization === 'extension') {
                                    var extNameRoot = MediaFlow.Utils.getFileExtension(filePath);
                                    if (extNameRoot) {
                                        rootOrgFolder = MediaFlow.FolderManager.getOrCreateSubFolder(rootOrgFolder, extNameRoot);
                                    }
                                }
                                MediaFlow.FolderManager.moveItemToFolder(importedItem, rootOrgFolder);
                            }
                        }
                    }
                } else if (folders && (mode === 'smart' || options.organizeByType)) {
                    var orgFolder = MediaFlow.FolderManager.getFolderForType(fileType, folders);

                    if (orgFolder && options.subOrganization === 'extension') {
                        var extName2 = MediaFlow.Utils.getFileExtension(filePath);
                        if (extName2) {
                            orgFolder = MediaFlow.FolderManager.getOrCreateSubFolder(orgFolder, extName2);
                        }
                    }

                    if (orgFolder) {
                        MediaFlow.FolderManager.moveItemToFolder(importedItem, orgFolder);
                    }
                } else if (options.targetFolder) {
                    var folder = MediaFlow.FolderManager.getOrCreateFolderByPath(options.targetFolder);
                    if (folder) {
                        MediaFlow.FolderManager.moveItemToFolder(importedItem, folder);
                    }
                }

                result.imported = true;
                result.item.bin = MediaFlow.FolderManager.getFolderPath(importedItem.parentFolder);
                result.item.id = importedItem.id;
            } else {
                result.item.reason = 'Import failed';
            }

        } catch (e) {
            result.item.reason = e.message;
        }

        return result;
    },

    /**
     * Import a single file (low-level)
     * @param {string} filePath
     * @returns {FootageItem|null}
     */
    importSingle: function (filePath) {
        try {
            var importOptions = new ImportOptions(new File(filePath));
            importOptions.sequence = false;
            return app.project.importFile(importOptions);
        } catch (e) {
            MediaFlow.Utils.log('Import single error: ' + e.message);
            return null;
        }
    },

    /**
     * Import as an image sequence (low-level)
     * @param {string} filePath
     * @returns {FootageItem}
     * @throws {Error} on failure with explicit file path
     */
    importSequence: function (filePath) {
        try {
            var importOptions = new ImportOptions(new File(filePath));
            importOptions.sequence = true;
            importOptions.forceAlphabetical = true;

            var imported = app.project.importFile(importOptions);

            if (!imported) {
                throw new Error('AE returned null for: ' + MediaFlow.Utils.getFileName(filePath));
            }

            // Set default alpha interpretation to avoid AE's popup dialog
            try {
                if (imported.mainSource && imported.mainSource.hasAlpha) {
                    imported.mainSource.alphaMode = AlphaMode.STRAIGHT;
                }
            } catch (alphaErr) {
                // Not all footage types support alpha — safe to ignore
            }

            return imported;
        } catch (e) {
            MediaFlow.Utils.log('Import sequence error for ' + filePath + ': ' + e.message);
            throw new Error('Sequence import failed (' + MediaFlow.Utils.getFileName(filePath) + '): ' + e.message);
        }
    },

    /**
     * Copy file to media folder
     * @param {string} sourcePath
     * @param {string} mediaFolder
     * @param {boolean} preserveStructure
     * @param {string} relativePath - Folder structure passed from UI
     * @param {boolean} [forceOverwrite]
     * @returns {object}
     */
    copyFileToMediaFolder: function (sourcePath, mediaFolder, preserveStructure, relativePath, forceOverwrite) {
        var result = {
            success: false,
            newPath: null,
            error: null
        };

        try {
            var fileName = MediaFlow.Utils.getFileName(sourcePath);
            var targetPath = mediaFolder + '/' + fileName;

            if (preserveStructure && relativePath) {
                // If relativePath exists ('xxx/yyy/file.jpg'), rebuild the exact structure
                var relParts = relativePath.replace(/\\/g, '/').split('/');
                relParts.pop(); // Remove the filename from the end
                if (relParts.length > 0) {
                    var subdirs = relParts.join('/');
                    mediaFolder = mediaFolder + '/' + subdirs;
                    MediaFlow.Utils.ensureFolder(mediaFolder);
                    targetPath = mediaFolder + '/' + fileName;
                }
            }

            if (!forceOverwrite && MediaFlow.Utils.fileExists(targetPath)) {
                fileName = MediaFlow.Utils.generateUniqueFileName(mediaFolder, fileName);
                targetPath = mediaFolder + '/' + fileName;
            }

            var copyResult = MediaFlow.Utils.copyFileInternal(sourcePath, targetPath);

            if (copyResult.success) {
                result.success = true;
                result.newPath = targetPath;
            } else {
                result.error = copyResult.error;
            }

        } catch (e) {
            result.error = e.message;
        }

        return result;
    }
};

