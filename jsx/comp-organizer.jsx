/**
 * MediaFlow - Composition Organizer
 * Builds a hierarchical folder tree for compositions in the project.
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.CompOrganizer = {

    /**
     * Organize compositions into a hierarchical tree structure.
     * Root comps get their own folders, sub-comps are nested inside.
     * Orphan comps (unused anywhere) go into _Unused Comps.
     *
     * @param {object} options - { targetFolder }
     * @returns {object} { organized, orphans, error }
     */
    organizeCompositions: function (options) {
        var result = {
            organized: 0,
            orphans: 0,
            error: null
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        app.beginUndoGroup('MediaFlow Comp-Organize');

        try {
            var optionsObj = options || {};
            var customNames = optionsObj.folderNames || {};
            var rootFolderName = optionsObj.targetFolder || customNames.comps || 'Compositions';

            // ---- Step 1: Collect all CompItems ----
            var allComps = [];
            for (var i = 1, len = app.project.items.length; i <= len; i++) {
                var item = app.project.items[i];
                if (item instanceof CompItem) {
                    allComps.push(item);
                }
            }

            if (allComps.length === 0) {
                result.error = { message: 'No compositions found in project' };
                return result;
            }

            // ---- Step 2: Build parent-children map ----
            var childrenMap = {};
            var usedAsChild = {};

            for (var c = 0; c < allComps.length; c++) {
                var comp = allComps[c];
                childrenMap[comp.id] = [];

                if (comp.numLayers > 0) {
                    for (var l = 1; l <= comp.numLayers; l++) {
                        try {
                            var layer = comp.layer(l);
                            if (layer.source && layer.source instanceof CompItem) {
                                var childId = layer.source.id;
                                var alreadyAdded = false;
                                for (var k = 0; k < childrenMap[comp.id].length; k++) {
                                    if (childrenMap[comp.id][k] === childId) {
                                        alreadyAdded = true;
                                        break;
                                    }
                                }
                                if (!alreadyAdded) {
                                    childrenMap[comp.id].push(childId);
                                    usedAsChild[childId] = true;
                                }
                            }
                        } catch (e) {
                            // Skip locked or heavily restricted layers
                        }
                    }
                }
            }

            // ---- Step 3: Identify root comps ----
            var rootComps = [];
            var orphanComps = [];

            for (var r = 0; r < allComps.length; r++) {
                var compItem = allComps[r];
                if (!usedAsChild[compItem.id]) {
                    if (childrenMap[compItem.id] && childrenMap[compItem.id].length > 0) {
                        rootComps.push(compItem);
                    } else {
                        orphanComps.push(compItem);
                    }
                }
            }

            // ---- Step 4: Create root folder ----
            var rootFolder = MediaFlow.FolderManager.getOrCreateFolderByPath(rootFolderName);
            if (!rootFolder) {
                throw new Error('Could not create root folder: ' + rootFolderName);
            }

            // ---- Step 5: Build folder tree for each root comp (recursive) ----
            function findCompById(id) {
                for (var f = 0; f < allComps.length; f++) {
                    if (allComps[f].id === id) return allComps[f];
                }
                return null;
            }

            function organizeComp(comp, parentFolder) {
                var compFolder = MediaFlow.FolderManager.getOrCreateSubFolder(parentFolder, comp.name);
                if (!compFolder) return;

                if (comp.parentFolder !== compFolder) {
                    comp.parentFolder = compFolder;
                    result.organized++;
                }

                var children = childrenMap[comp.id];
                if (children && children.length > 0) {
                    var subFolder = MediaFlow.FolderManager.getOrCreateSubFolder(compFolder, comp.name + ' Pre-Comps');
                    if (subFolder) {
                        for (var s = 0; s < children.length; s++) {
                            var childComp = findCompById(children[s]);
                            if (childComp) {
                                if (childrenMap[childComp.id] && childrenMap[childComp.id].length > 0) {
                                    organizeComp(childComp, subFolder);
                                } else {
                                    if (childComp.parentFolder !== subFolder) {
                                        childComp.parentFolder = subFolder;
                                        result.organized++;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            for (var rc = 0; rc < rootComps.length; rc++) {
                organizeComp(rootComps[rc], rootFolder);
            }

            // ---- Step 6: Handle orphan comps ----
            if (orphanComps.length > 0) {
                var orphanFolder = MediaFlow.FolderManager.getOrCreateSubFolder(rootFolder, '_Unused Comps');
                if (orphanFolder) {
                    for (var o = 0; o < orphanComps.length; o++) {
                        if (orphanComps[o].parentFolder !== orphanFolder) {
                            orphanComps[o].parentFolder = orphanFolder;
                            result.orphans++;
                            result.organized++;
                        }
                    }
                }
            }

            MediaFlow.FolderManager.cleanupEmptyFolders(rootFolder);

        } catch (e) {
            result.error = { message: e.message };
        } finally {
            app.endUndoGroup();
        }

        return result;
    },

    /**
     * Get project statistics
     * @returns {object}
     */
    getProjectStats: function () {
        var stats = {
            total: 0,
            video: 0,
            image: 0,
            audio: 0,
            comp: 0,
            missing: 0,
            unusedVideo: 0,
            unusedImage: 0,
            unusedAudio: 0,
            totalSize: 0,
            missingFiles: [],
            unusedFiles: [],
            healthScore: 100,
            diagnosis: []
        };

        if (!app.project) return stats;

        var renderComps = {};
        if (app.project.renderQueue) {
            for (var rqI = 1; rqI <= app.project.renderQueue.numItems; rqI++) {
                var rqItem = app.project.renderQueue.item(rqI);
                if (rqItem && rqItem.comp) {
                    renderComps[rqItem.comp.id] = true;
                }
            }
        }

        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item instanceof CompItem) {
                stats.comp++;
                stats.total++;
            } else if (item instanceof FootageItem) {
                stats.total++;

                // Check for missing footage
                var isMissing = false;
                try {
                    if (item.mainSource) {
                        var isFileSource = false;
                        try { isFileSource = (item.mainSource instanceof FileSource); } catch (ex) { }

                        if (isFileSource && item.mainSource.isMissing) {
                            isMissing = true;
                        }
                    }

                    if (!isMissing && item.file) {
                        try {
                            var testFile = new File(item.file.fsName);
                            if (!testFile.exists) {
                                isMissing = true;
                            }
                        } catch (ex2) { }
                    }

                    if (!isMissing) {
                        try {
                            if (item.footageMissing === true) {
                                isMissing = true;
                            }
                        } catch (ex3) { }
                    }
                } catch (eMain) { }

                if (isMissing) {
                    stats.missing++;

                    // Cap array size to prevent oversized JSON response
                    if (stats.missingFiles.length < 200) {
                        var originalPath = "Unknown Path";
                        try {
                            if (item.mainSource && item.mainSource.file && item.mainSource.file.fsName) {
                                originalPath = item.mainSource.file.fsName;
                            } else if (item.file && item.file.fsName) {
                                originalPath = item.file.fsName;
                            }
                        } catch (e) { }

                        stats.missingFiles.push({
                            name: item.name,
                            path: originalPath
                        });
                    }
                }

                // Skip solids and placeholders
                var isSolid = false;
                var isPlaceholder = false;
                try { isSolid = (item.mainSource instanceof SolidSource); } catch (ex) { }
                try { isPlaceholder = (item.mainSource instanceof PlaceholderSource); } catch (ex) { }
                if (isSolid || isPlaceholder) {
                    continue;
                }

                var isUnused = true;
                try {
                    if (this.isItemTrulyUsed(item, renderComps)) {
                        isUnused = false;
                    }
                } catch (e) { }

                if (item.file) {
                    var fileType = MediaFlow.Utils.detectFileType(item.file.fsName, null);
                    var filePath = item.file.fsName;

                    try {
                        var fileObj = new File(filePath);
                        if (fileObj.exists && fileObj.length > 0 && fileObj.length < 1e15) {
                            stats.totalSize += fileObj.length;
                        }
                    } catch (eSize) { }

                    switch (fileType) {
                        case 'video':
                            stats.video++;
                            if (isUnused) {
                                stats.unusedVideo++;
                                if (stats.unusedFiles.length < 200) {
                                    stats.unusedFiles.push({ name: item.name, path: filePath, type: 'video' });
                                }
                            }
                            break;
                        case 'image':
                            stats.image++;
                            if (isUnused) {
                                stats.unusedImage++;
                                if (stats.unusedFiles.length < 200) {
                                    stats.unusedFiles.push({ name: item.name, path: filePath, type: 'image' });
                                }
                            }
                            break;
                        case 'audio':
                            stats.audio++;
                            if (isUnused) {
                                stats.unusedAudio++;
                                if (stats.unusedFiles.length < 200) {
                                    stats.unusedFiles.push({ name: item.name, path: filePath, type: 'audio' });
                                }
                            }
                            break;
                    }
                }
            }
        }

        // --- Project Health Score Calculation ---
        var score = 100;

        if (stats.missing > 0) {
            var penalty = stats.missing * 5;
            score -= penalty;
            stats.diagnosis.push({
                type: 'error',
                message: stats.missing + ' missing file(s) detected. Fix immediately.'
            });
        }

        var totalUnused = stats.unusedVideo + stats.unusedImage + stats.unusedAudio;
        if (totalUnused > 0) {
            var unusedPenalty = Math.min(20, totalUnused * 2); // Cap unused penalty at 20
            score -= unusedPenalty;
            stats.diagnosis.push({
                type: totalUnused > 10 ? 'error' : 'warning',
                message: totalUnused + ' unused file(s) bloating the project.'
            });
        }

        if (stats.comp > 50) {
            score -= 10;
            stats.diagnosis.push({
                type: 'warning',
                message: 'High composition count (' + stats.comp + ') may slow down rendering.'
            });
        }

        if (totalUnused === 0 && stats.missing === 0 && stats.total > 0) {
            stats.diagnosis.push({
                type: 'success',
                message: 'Project is perfectly clean and optimized.'
            });
        } else if (stats.total === 0) {
            stats.diagnosis.push({
                type: 'info',
                message: 'Project is empty.'
            });
        }

        stats.healthScore = Math.max(0, score); // Ensure score doesn't go below 0

        return stats;
    },

    /**
     * Helper: Delegates to the canonical implementation in MediaFlow.Utils.
     */
    isItemTrulyUsed: function (item, renderQueueCompIds) {
        return MediaFlow.Utils.isItemTrulyUsed(item, renderQueueCompIds);
    }
};

