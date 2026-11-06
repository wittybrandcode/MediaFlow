/**
 * Smart Actions Controller
 * Handles specialized project maintenance tools (SOLID: Single Responsibility)
 * Phase 3: Project Auditor, Deep Dependency / Orphan Cleaner, Smart Relink & Consolidate
 */

if (typeof MediaFlow === "undefined") {
    var MediaFlow = {};
}

if (typeof MediaFlow.SmartActions === "undefined") {
    MediaFlow.SmartActions = {};
}

/**
 * Helper: Find an item by its unique ID across project items
 * @param {number} id
 * @returns {Item|null}
 */
MediaFlow.SmartActions.findItemById = function (id) {
    if (!app.project) return null;
    for (var i = 1; i <= app.project.numItems; i++) {
        if (app.project.item(i).id == id) {
            return app.project.item(i);
        }
    }
    return null;
};

/**
 * Isolates missing/offline media into a specific project bin
 * @returns {object} Result object with count of isolated items
 */
MediaFlow.SmartActions.isolateMissingMedia = function () {
    try {
        if (!app.project) {
            return {
                success: false,
                error: { message: "No project open" }
            };
        }

        var missingBinName = "[ Missing Media ]";
        var missingBin = null;
        var missingItems = [];

        // 1. Scan for missing items using multiple strategies
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);

            if (!(item instanceof FootageItem)) continue;

            var itemIsMissing = false;
            try {
                // Strategy 1: mainSource.isMissing (FileSource)
                if (item.mainSource) {
                    var isFS = false;
                    try { isFS = (item.mainSource instanceof FileSource); } catch (ex) { }
                    if (isFS && item.mainSource.isMissing) {
                        itemIsMissing = true;
                    }
                }

                // Strategy 2: Check physical file existence
                if (!itemIsMissing && item.file) {
                    try {
                        var tf = new File(item.file.fsName);
                        if (!tf.exists) {
                            itemIsMissing = true;
                        }
                    } catch (ex2) { }
                }

                // Strategy 3: footageMissing property
                if (!itemIsMissing) {
                    try {
                        if (item.footageMissing === true) itemIsMissing = true;
                    } catch (ex3) { }
                }
            } catch (eMain) { }

            if (itemIsMissing) {
                missingItems.push(item);
            }
        }

        if (missingItems.length === 0) {
            return {
                success: true,
                data: { count: 0, isolatedCount: 0 }
            };
        }

        // Begin undo group early to capture folder creation if needed
        app.beginUndoGroup("Isolate Missing Media");

        try {
            // 2. Find or create the [ Missing Media ] bin
            for (var j = 1; j <= app.project.numItems; j++) {
                var currentItem = app.project.item(j);
                if (currentItem instanceof FolderItem && currentItem.name === missingBinName) {
                    missingBin = currentItem;
                    break;
                }
            }

            if (!missingBin) {
                missingBin = app.project.items.addFolder(missingBinName);
                missingBin.label = 11; // Orange
            }

            // 3. Move items to the bin and change their label
            for (var k = 0; k < missingItems.length; k++) {
                var mItem = missingItems[k];
                if (mItem.parentFolder !== missingBin) {
                    mItem.parentFolder = missingBin;
                }
                mItem.label = 1; // Red
            }
        } finally {
            app.endUndoGroup();
        }

        return {
            success: true,
            data: {
                count: missingItems.length
            }
        };

    } catch (e) {
        return {
            success: false,
            error: {
                message: e.toString(),
                line: e.line
            }
        };
    }
};

/**
 * Helper: Delegates to the canonical implementation in MediaFlow.Utils.
 * Kept as a local alias for backward compatibility with getUnusedMedia().
 */
function isItemTrulyUsed(item, renderQueueCompIds) {
    return MediaFlow.Utils.isItemTrulyUsed(item, renderQueueCompIds);
}

/**
 * Core Logic to scan for genuinely Unused Media.
 * Namespaced under SmartActions to avoid global pollution.
 */
MediaFlow.SmartActions._getUnusedMedia = function () {
    var unusedItems = [];
    var renderComps = {};

    // 1. Gather Render Queue Comps to anchor the Deep Tracking
    if (app.project.renderQueue) {
        for (var i = 1; i <= app.project.renderQueue.numItems; i++) {
            var rqItem = app.project.renderQueue.item(i);
            if (rqItem && rqItem.comp) {
                renderComps[rqItem.comp.id] = true;
            }
        }
    }

    // 2. Scan Project Items
    for (var j = 1; j <= app.project.numItems; j++) {
        var item = app.project.item(j);

        if (item instanceof FootageItem && item.mainSource instanceof FileSource) {
            // Drop placeholder and solids
            if (item.mainSource instanceof SolidSource || item.mainSource instanceof PlaceholderSource) continue;

            if (!MediaFlow.Utils.isItemTrulyUsed(item, renderComps)) {
                unusedItems.push(item);
            }
        }
    }

    // Force garbage collection for large projects
    try { $.gc(); } catch (e) { }

    return unusedItems;
};

// Backward-compatible alias for existing callers
function getUnusedMedia() {
    return MediaFlow.SmartActions._getUnusedMedia();
}

/**
 * Isolate purely Unused Media into a specific bin
 */
MediaFlow.SmartActions.isolateUnusedMedia = function () {
    try {
        if (!app.project) throw new Error("No project open");

        var unusedBinName = "[ Unused Media ]";
        var unusedBin = null;
        var unusedItems = getUnusedMedia();

        if (unusedItems.length === 0) return { success: true, data: { count: 0 } };

        for (var j = 1; j <= app.project.numItems; j++) {
            if (app.project.item(j) instanceof FolderItem && app.project.item(j).name === unusedBinName) {
                unusedBin = app.project.item(j); break;
            }
        }

        if (!unusedBin) {
            unusedBin = app.project.items.addFolder(unusedBinName);
            unusedBin.label = 15; // Cyan
        }

        app.beginUndoGroup("Isolate Unused Media");
        try {
            for (var k = 0; k < unusedItems.length; k++) {
                if (unusedItems[k].parentFolder !== unusedBin) {
                    unusedItems[k].parentFolder = unusedBin;
                }
                unusedItems[k].label = 15;
            }
        } finally {
            app.endUndoGroup();
        }

        return { success: true, data: { count: unusedItems.length } };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Get the list of purely Unused Media
 */
MediaFlow.SmartActions.getUnusedMediaList = function () {
    try {
        if (!app.project) throw new Error("No project open");

        var unusedItems = getUnusedMedia();
        var dataList = [];
        for (var i = 0; i < unusedItems.length; i++) {
            var item = unusedItems[i];
            var path = item.file ? item.file.fsName : null;
            dataList.push({ id: item.id, name: item.name, path: path });
        }

        return { success: true, data: { items: dataList } };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Irreversibly remove Unused Media
 */
MediaFlow.SmartActions.removeUnusedMedia = function (options) {
    try {
        if (!app.project) throw new Error("No project open");
        var deleteFromDisk = options && options.deleteFromDisk;
        var itemIds = options && options.itemIds;

        var unusedItems;
        if (itemIds && itemIds.length > 0) {
            unusedItems = [];
            for (var i = 0; i < itemIds.length; i++) {
                try {
                    var foundItem = MediaFlow.SmartActions.findItemById(itemIds[i]);
                    if (foundItem) unusedItems.push(foundItem);
                } catch (e) { }
            }
        } else {
            unusedItems = getUnusedMedia();
        }
        if (unusedItems.length === 0) return { success: true, data: { removedCount: 0 } };

        app.beginUndoGroup("Remove Unused Media");
        var removedCount = 0;
        var failedCount = 0;
        try {
            for (var k = unusedItems.length - 1; k >= 0; k--) {
                var item = unusedItems[k];
                var f = item.file;

                try {
                    item.remove();
                    removedCount++;

                    if (deleteFromDisk && f && f.exists) {
                        try {
                            f.remove();
                        } catch (e) { }
                    }
                } catch (removeErr) {
                    failedCount++;
                    MediaFlow.Utils.log('Failed to remove: ' + item.name + ' - ' + removeErr.message);
                }
            }
        } finally {
            app.endUndoGroup();
        }

        return { success: true, data: { removedCount: removedCount, failedCount: failedCount } };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Purge All Memory and Disk Caches
 */
MediaFlow.SmartActions.purgeCaches = function () {
    try {
        app.purge(PurgeTarget.ALL_CACHES);
        return { success: true, data: { status: 'Purged' } };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

// =========================================================================
// PHASE 3.1: MISSING FONTS & EFFECTS AUDITOR
// =========================================================================

/**
 * Audits all compositions in the project for missing fonts and missing 3rd-party effects
 * @returns {object} Detailed audit report with missing fonts, missing effects, and full inventories
 */
MediaFlow.SmartActions.auditMissingFontsAndEffects = function () {
    try {
        if (!app.project) {
            return { success: false, error: { message: "No project open" } };
        }

        var missingEffects = [];
        var missingFonts = [];
        var allFontsMap = {};
        var allEffectsMap = {};
        var scannedComps = 0;
        var scannedLayers = 0;

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof CompItem)) continue;

            scannedComps++;

            for (var l = 1; l <= item.numLayers; l++) {
                scannedLayers++;
                var layer = null;
                try {
                    layer = item.layer(l);
                } catch (lErr) {
                    continue;
                }
                if (!layer) continue;

                // 1. Audit Effects on Layer
                try {
                    var effectGroup = layer.property("ADBE Effect Parade");
                    if (effectGroup) {
                        for (var e = 1; e <= effectGroup.numProperties; e++) {
                            var effect = effectGroup.property(e);
                            if (!effect) continue;

                            var effName = effect.name || "Unknown Effect";
                            var matchName = "";
                            try { matchName = effect.matchName || ""; } catch (mnErr) { }

                            // Inventory all unique effects
                            if (!allEffectsMap[effName]) {
                                allEffectsMap[effName] = { name: effName, matchName: matchName, count: 0, isMissing: false };
                            }
                            allEffectsMap[effName].count++;

                            // Missing effect detection:
                            // AE assigns matchName "ADBE Missing Effect" or prefixes the name with "Missing:"
                            var isMissingEffect = false;
                            if (matchName === "ADBE Missing Effect" ||
                                matchName.indexOf("Missing") !== -1 ||
                                effName.indexOf("Missing:") === 0 ||
                                effName.indexOf("(Missing)") !== -1) {
                                isMissingEffect = true;
                                allEffectsMap[effName].isMissing = true;
                            }

                            if (isMissingEffect) {
                                missingEffects.push({
                                    compId: item.id,
                                    compName: item.name,
                                    layerIndex: layer.index,
                                    layerName: layer.name,
                                    effectIndex: e,
                                    effectName: effName,
                                    matchName: matchName
                                });
                            }
                        }
                    }
                } catch (effErr) { }

                // 2. Audit Fonts on Text Layers
                try {
                    var textPropGroup = layer.property("ADBE Text Properties");
                    if (textPropGroup && textPropGroup.property("ADBE Text Document")) {
                        var textDocProp = textPropGroup.property("ADBE Text Document");
                        if (textDocProp && textDocProp.value) {
                            var textDoc = textDocProp.value;
                            var fontName = textDoc.font || "";
                            var fontStyle = textDoc.fontStyle || "";
                            var sampleText = "";
                            try {
                                sampleText = textDoc.text ? textDoc.text.substring(0, 40) : "";
                            } catch (stErr) { }

                            var isFontMissing = false;

                            // Check modern AE FontLocation enum (AE 16.0+)
                            if (typeof FontLocation !== "undefined") {
                                try {
                                    if (textDoc.fontLocation === FontLocation.FONT_LOCATION_MISSING ||
                                        textDoc.fontLocation === FontLocation.MISSING) {
                                        isFontMissing = true;
                                    }
                                } catch (flErr) { }
                            }

                            // Numeric fallback for AE where 4 = FONT_LOCATION_MISSING
                            if (!isFontMissing && typeof textDoc.fontLocation === "number") {
                                if (textDoc.fontLocation === 4) {
                                    isFontMissing = true;
                                }
                            }

                            // Heuristic checks for missing font annotations
                            if (!isFontMissing && fontName) {
                                if (fontName.indexOf("Missing") !== -1 ||
                                    fontName.indexOf("(missing)") !== -1 ||
                                    fontName.indexOf("?") !== -1) {
                                    isFontMissing = true;
                                }
                            }

                            // Track font in project inventory
                            var fontKey = fontName + (fontStyle ? " (" + fontStyle + ")" : "");
                            if (fontKey) {
                                if (!allFontsMap[fontKey]) {
                                    allFontsMap[fontKey] = {
                                        fontName: fontName,
                                        fontStyle: fontStyle,
                                        isMissing: isFontMissing,
                                        count: 0
                                    };
                                }
                                allFontsMap[fontKey].count++;
                                if (isFontMissing) {
                                    allFontsMap[fontKey].isMissing = true;
                                }
                            }

                            if (isFontMissing) {
                                missingFonts.push({
                                    compId: item.id,
                                    compName: item.name,
                                    layerIndex: layer.index,
                                    layerName: layer.name,
                                    fontName: fontName,
                                    fontStyle: fontStyle,
                                    sampleText: sampleText
                                });
                            }
                        }
                    }
                } catch (fntErr) { }
            }
        }

        // Convert inventories to arrays
        var allFontsList = [];
        for (var fKey in allFontsMap) {
            if (allFontsMap.hasOwnProperty(fKey)) {
                allFontsList.push(allFontsMap[fKey]);
            }
        }

        var allEffectsList = [];
        for (var eKey in allEffectsMap) {
            if (allEffectsMap.hasOwnProperty(eKey)) {
                allEffectsList.push(allEffectsMap[eKey]);
            }
        }

        return {
            success: true,
            data: {
                missingEffects: missingEffects,
                missingFonts: missingFonts,
                allFonts: allFontsList,
                allEffects: allEffectsList,
                stats: {
                    scannedComps: scannedComps,
                    scannedLayers: scannedLayers,
                    missingEffectsCount: missingEffects.length,
                    missingFontsCount: missingFonts.length,
                    totalFontsCount: allFontsList.length,
                    totalEffectsCount: allEffectsList.length
                }
            }
        };
    } catch (e) {
        return {
            success: false,
            error: { message: e.toString(), line: e.line }
        };
    }
};

/**
 * Reveals a specific layer inside a composition in AE viewer and selects it
 * @param {object} data - { compId, layerIndex }
 * @returns {object} Result with compName and layerName
 */
MediaFlow.SmartActions.revealLayerInComp = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var compId = data && data.compId;
        var layerIndex = data && data.layerIndex;

        var comp = MediaFlow.SmartActions.findItemById(compId);
        if (!comp || !(comp instanceof CompItem)) {
            return { success: false, error: { message: "Composition not found" } };
        }

        // Open viewer
        comp.openInViewer();

        if (layerIndex && layerIndex >= 1 && layerIndex <= comp.numLayers) {
            // Deselect all layers first
            for (var i = 1; i <= comp.numLayers; i++) {
                comp.layer(i).selected = false;
            }
            var targetLayer = comp.layer(layerIndex);
            targetLayer.selected = true;
            try {
                comp.time = targetLayer.inPoint;
            } catch (tErr) { }

            return {
                success: true,
                data: {
                    compId: comp.id,
                    compName: comp.name,
                    layerIndex: targetLayer.index,
                    layerName: targetLayer.name
                }
            };
        }

        return {
            success: true,
            data: {
                compId: comp.id,
                compName: comp.name
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

// =========================================================================
// PHASE 3.2: DEEP DEPENDENCY & ORPHAN CLEANER
// =========================================================================

/**
 * Scans project for orphan compositions, empty comps, and unreferenced footage
 * @param {object} options
 * @returns {object} Breakdown of root, orphan, empty comps, and unused footage
 */
MediaFlow.SmartActions.deepOrphanAudit = function (options) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };

        var rootComps = [];
        var orphanComps = [];
        var emptyComps = [];
        var unusedFootage = [];
        var renderComps = {};

        // 1. Render Queue Comps
        if (app.project.renderQueue) {
            for (var rq = 1; rq <= app.project.renderQueue.numItems; rq++) {
                var rqItem = app.project.renderQueue.item(rq);
                if (rqItem && rqItem.comp) {
                    renderComps[rqItem.comp.id] = true;
                }
            }
        }

        // 2. Scan all Comps
        var allComps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem) {
                allComps.push(item);
                var isRoot = (!item.usedIn || item.usedIn.length === 0);
                var inRQ = (renderComps[item.id] === true);

                if (isRoot) {
                    rootComps.push({
                        id: item.id,
                        name: item.name,
                        numLayers: item.numLayers,
                        inRenderQueue: inRQ
                    });
                }

                if (item.numLayers === 0) {
                    emptyComps.push({
                        id: item.id,
                        name: item.name,
                        usedInCount: item.usedIn ? item.usedIn.length : 0
                    });
                }
            }
        }

        // 3. Find Orphan Comps by BFS from active Root Comps
        var reachableComps = {};
        function markReachable(comp) {
            if (!comp || reachableComps[comp.id]) return;
            reachableComps[comp.id] = true;
            for (var l = 1; l <= comp.numLayers; l++) {
                var lyr = comp.layer(l);
                if (lyr && lyr.source && (lyr.source instanceof CompItem)) {
                    markReachable(lyr.source);
                }
            }
        }

        // Mark reachable comps starting from root comps with layers or RQ comps
        for (var r = 0; r < rootComps.length; r++) {
            var rComp = MediaFlow.SmartActions.findItemById(rootComps[r].id);
            if (rComp && rComp.numLayers > 0) {
                markReachable(rComp);
            }
        }

        for (var c = 0; c < allComps.length; c++) {
            var compItem = allComps[c];
            if (!reachableComps[compItem.id]) {
                var reason = (compItem.numLayers === 0) ? "Empty Comp (0 layers)" : "Unused Pre-comp (Never referenced)";
                orphanComps.push({
                    id: compItem.id,
                    name: compItem.name,
                    numLayers: compItem.numLayers,
                    usedInCount: compItem.usedIn ? compItem.usedIn.length : 0,
                    reason: reason
                });
            }
        }

        // 4. Scan for unused footage
        for (var j = 1; j <= app.project.numItems; j++) {
            var pItem = app.project.item(j);
            if (pItem instanceof FootageItem && pItem.mainSource instanceof FileSource) {
                if (pItem.mainSource instanceof SolidSource || pItem.mainSource instanceof PlaceholderSource) continue;
                if (!MediaFlow.Utils.isItemTrulyUsed(pItem, renderComps)) {
                    var fPath = pItem.file ? pItem.file.fsName : "";
                    var fSize = (pItem.file && pItem.file.exists) ? pItem.file.length : 0;
                    unusedFootage.push({
                        id: pItem.id,
                        name: pItem.name,
                        path: fPath,
                        size: fSize
                    });
                }
            }
        }

        return {
            success: true,
            data: {
                rootComps: rootComps,
                orphanComps: orphanComps,
                emptyComps: emptyComps,
                unusedFootage: unusedFootage,
                stats: {
                    totalComps: allComps.length,
                    rootCount: rootComps.length,
                    orphanCount: orphanComps.length,
                    emptyCount: emptyComps.length,
                    unusedFootageCount: unusedFootage.length
                }
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Isolates orphan/empty comps into a designated [ Orphan Comps ] bin
 * @param {object} data - { compIds: [number] } (optional)
 * @returns {object} Result with isolated count
 */
MediaFlow.SmartActions.isolateOrphanComps = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var compIds = data && data.compIds;
        var orphanBinName = "[ Orphan Comps ]";
        var orphanBin = null;

        var targetComps = [];
        if (compIds && compIds.length > 0) {
            for (var i = 0; i < compIds.length; i++) {
                var c = MediaFlow.SmartActions.findItemById(compIds[i]);
                if (c && (c instanceof CompItem)) targetComps.push(c);
            }
        } else {
            var audit = MediaFlow.SmartActions.deepOrphanAudit();
            if (audit.success && audit.data.orphanComps) {
                for (var j = 0; j < audit.data.orphanComps.length; j++) {
                    var c2 = MediaFlow.SmartActions.findItemById(audit.data.orphanComps[j].id);
                    if (c2 && (c2 instanceof CompItem)) targetComps.push(c2);
                }
            }
        }

        if (targetComps.length === 0) {
            return { success: true, data: { isolatedCount: 0 } };
        }

        app.beginUndoGroup("Isolate Orphan Comps");
        try {
            for (var b = 1; b <= app.project.numItems; b++) {
                var it = app.project.item(b);
                if (it instanceof FolderItem && it.name === orphanBinName) {
                    orphanBin = it;
                    break;
                }
            }
            if (!orphanBin) {
                orphanBin = app.project.items.addFolder(orphanBinName);
                orphanBin.label = 13; // Fuchsia / Magenta
            }

            for (var k = 0; k < targetComps.length; k++) {
                if (targetComps[k].parentFolder !== orphanBin) {
                    targetComps[k].parentFolder = orphanBin;
                }
                targetComps[k].label = 13;
            }
        } finally {
            app.endUndoGroup();
        }

        return { success: true, data: { isolatedCount: targetComps.length } };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Irreversibly removes orphan comps and unused footage inside an undo group
 * @param {object} data - { compIds: [number], footageIds: [number] }
 * @returns {object} Result with removed counts
 */
MediaFlow.SmartActions.removeOrphanItems = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var compIds = (data && data.compIds) || [];
        var footageIds = (data && data.footageIds) || [];

        app.beginUndoGroup("Remove Orphan Items");
        var removedComps = 0;
        var removedFootage = 0;
        try {
            for (var i = 0; i < compIds.length; i++) {
                var comp = MediaFlow.SmartActions.findItemById(compIds[i]);
                if (comp && (comp instanceof CompItem)) {
                    comp.remove();
                    removedComps++;
                }
            }
            for (var j = 0; j < footageIds.length; j++) {
                var fItem = MediaFlow.SmartActions.findItemById(footageIds[j]);
                if (fItem && (fItem instanceof FootageItem)) {
                    fItem.remove();
                    removedFootage++;
                }
            }
        } finally {
            app.endUndoGroup();
        }

        return {
            success: true,
            data: {
                removedComps: removedComps,
                removedFootage: removedFootage,
                totalRemoved: removedComps + removedFootage
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

// =========================================================================
// PHASE 3.3: SMART RELINK & CONSOLIDATE
// =========================================================================

/**
 * Recursively scans a target directory for missing media filenames and automatically reconnects them
 * @param {object} data - { searchFolder: string, recursive: boolean }
 * @returns {object} Result with relinked count, remaining missing, and details
 */
MediaFlow.SmartActions.autoRelinkMedia = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var searchFolderPath = data && data.searchFolder;
        var recursive = (data && typeof data.recursive !== "undefined") ? data.recursive : true;

        if (!searchFolderPath) {
            return { success: false, error: { message: "Search folder path is required" } };
        }

        var searchFolder = new Folder(searchFolderPath);
        if (!searchFolder.exists) {
            return { success: false, error: { message: "Search folder does not exist: " + searchFolderPath } };
        }

        // 1. Gather all missing footage items
        var missingMap = {}; // lowercase filename -> array of footage items
        var totalMissing = 0;

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource || item.mainSource instanceof PlaceholderSource) continue;

            var isMissing = false;
            try {
                if (item.mainSource && item.mainSource.isMissing) isMissing = true;
                if (!isMissing && item.footageMissing) isMissing = true;
                if (!isMissing && item.file && !item.file.exists) isMissing = true;
            } catch (ex) { }

            if (isMissing) {
                var expectedName = item.name;
                if (item.file && item.file.name) expectedName = item.file.name;
                var key = expectedName.toLowerCase();
                if (!missingMap[key]) {
                    missingMap[key] = [];
                }
                missingMap[key].push(item);
                totalMissing++;
            }
        }

        if (totalMissing === 0) {
            return {
                success: true,
                data: {
                    relinkedCount: 0,
                    totalMissingBefore: 0,
                    remainingMissing: 0,
                    relinked: []
                }
            };
        }

        // 2. Scan searchFolder recursively for matching filenames
        var foundFilesMap = {}; // lowercase filename -> File object
        var folderQueue = [searchFolder];

        while (folderQueue.length > 0) {
            var currentFolder = folderQueue.shift();
            var entries = null;
            try {
                entries = currentFolder.getFiles();
            } catch (readErr) {
                continue;
            }
            if (!entries) continue;

            for (var e = 0; e < entries.length; e++) {
                var entry = entries[e];
                if (entry instanceof Folder) {
                    if (recursive && entry.name.charAt(0) !== '.' && entry.name.charAt(0) !== '$') {
                        folderQueue.push(entry);
                    }
                } else if (entry instanceof File) {
                    var entryKey = entry.name.toLowerCase();
                    if (missingMap[entryKey] && !foundFilesMap[entryKey]) {
                        foundFilesMap[entryKey] = entry;
                    }
                }
            }
        }

        // 3. Relink matched items
        var relinkedList = [];
        app.beginUndoGroup("MediaFlow Smart Relink");
        try {
            for (var mKey in missingMap) {
                if (missingMap.hasOwnProperty(mKey) && foundFilesMap[mKey]) {
                    var targetFile = foundFilesMap[mKey];
                    var itemsToRelink = missingMap[mKey];
                    for (var r = 0; r < itemsToRelink.length; r++) {
                        var it = itemsToRelink[r];
                        var oldPath = it.file ? it.file.fsName : "Unknown";
                        try {
                            it.replace(targetFile);
                            relinkedList.push({
                                id: it.id,
                                name: it.name,
                                oldPath: oldPath,
                                newPath: targetFile.fsName
                            });
                        } catch (repErr) { }
                    }
                }
            }
        } finally {
            app.endUndoGroup();
        }

        return {
            success: true,
            data: {
                relinkedCount: relinkedList.length,
                totalMissingBefore: totalMissing,
                remainingMissing: totalMissing - relinkedList.length,
                relinked: relinkedList
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Collects project assets into an organized destination folder and generates a manifest report
 * @param {object} data - { targetFolder, usedOnly, organizeByType, relinkProject, saveProjectCopy }
 * @returns {object} Result with collected count, bytes, and destination path
 */
MediaFlow.SmartActions.smartCollectMedia = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var targetFolderPath = data && data.targetFolder;
        var usedOnly = (data && typeof data.usedOnly !== "undefined") ? data.usedOnly : true;
        var organizeByType = (data && typeof data.organizeByType !== "undefined") ? data.organizeByType : true;
        var relinkProject = (data && typeof data.relinkProject !== "undefined") ? data.relinkProject : false;
        var saveProjectCopy = (data && typeof data.saveProjectCopy !== "undefined") ? data.saveProjectCopy : true;

        if (!targetFolderPath) {
            return { success: false, error: { message: "Target destination folder is required" } };
        }

        var targetFolder = new Folder(targetFolderPath);
        if (!targetFolder.exists) {
            MediaFlow.Utils.ensureFolder(targetFolderPath);
        }
        if (!targetFolder.exists) {
            return { success: false, error: { message: "Could not create target folder: " + targetFolderPath } };
        }

        var renderComps = {};
        if (app.project.renderQueue) {
            for (var rq = 1; rq <= app.project.renderQueue.numItems; rq++) {
                var rqItem = app.project.renderQueue.item(rq);
                if (rqItem && rqItem.comp) renderComps[rqItem.comp.id] = true;
            }
        }

        // Collect footage items
        var itemsToCollect = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource || item.mainSource instanceof PlaceholderSource) continue;
            if (!item.file || !item.file.exists) continue; // Skip offline/missing files

            if (usedOnly && !MediaFlow.Utils.isItemTrulyUsed(item, renderComps)) {
                continue;
            }
            itemsToCollect.push(item);
        }

        if (itemsToCollect.length === 0) {
            return {
                success: true,
                data: {
                    collectedCount: 0,
                    failedCount: 0,
                    totalBytes: 0,
                    targetFolder: targetFolderPath
                }
            };
        }

        var subfolders = {
            video: targetFolderPath + "/(Footage)/Video",
            audio: targetFolderPath + "/(Footage)/Audio",
            image: targetFolderPath + "/(Footage)/Images",
            sequence: targetFolderPath + "/(Footage)/Sequences",
            other: targetFolderPath + "/(Footage)/Other"
        };

        if (organizeByType) {
            for (var sKey in subfolders) {
                if (subfolders.hasOwnProperty(sKey)) {
                    MediaFlow.Utils.ensureFolder(subfolders[sKey]);
                }
            }
        } else {
            MediaFlow.Utils.ensureFolder(targetFolderPath + "/(Media)");
        }

        if (relinkProject) {
            app.beginUndoGroup("Smart Collect and Relink");
        }

        var collectedCount = 0;
        var failedCount = 0;
        var totalBytes = 0;
        var manifestLines = [];
        manifestLines.push("=== MediaFlow Smart Collect Report ===");
        manifestLines.push("Date: " + new Date().toString());
        manifestLines.push("Project: " + (app.project.file ? app.project.file.name : "Untitled"));
        manifestLines.push("Destination: " + targetFolderPath);
        manifestLines.push("Assets Collected: " + itemsToCollect.length);
        manifestLines.push("--------------------------------------\n");

        try {
            for (var k = 0; k < itemsToCollect.length; k++) {
                var cItem = itemsToCollect[k];
                var srcFile = cItem.file;
                var type = MediaFlow.Utils.detectFileType(srcFile.fsName);
                var destDir = organizeByType ? (subfolders[type] || subfolders.other) : (targetFolderPath + "/(Media)");

                var destFileName = MediaFlow.Utils.generateUniqueFileName(destDir, srcFile.name);
                var fullDestPath = destDir + "/" + destFileName;

                var copyResult = MediaFlow.Utils.copyFileInternal(srcFile.fsName, fullDestPath);
                if (copyResult.success) {
                    collectedCount++;
                    totalBytes += copyResult.bytesCopied || 0;
                    manifestLines.push("[OK] " + cItem.name + " -> " + fullDestPath);

                    if (relinkProject) {
                        try {
                            cItem.replace(new File(fullDestPath));
                        } catch (relErr) {
                            manifestLines.push("  [WARNING: Relink failed for " + cItem.name + ": " + relErr.message + "]");
                        }
                    }
                } else {
                    failedCount++;
                    manifestLines.push("[FAILED] " + cItem.name + ": " + copyResult.error);
                }
            }

            // Save project copy if requested
            if (saveProjectCopy && app.project.file) {
                var origProjName = app.project.file.name;
                var baseProjName = origProjName.replace(/\.aep$/i, "");
                var projCopyPath = targetFolderPath + "/" + baseProjName + "_collected.aep";
                var projCopyFile = new File(projCopyPath);
                try {
                    app.project.save(projCopyFile);
                    manifestLines.push("\n[Project File Saved]: " + projCopyPath);
                } catch (saveErr) {
                    manifestLines.push("\n[Project File Save Failed]: " + saveErr.message);
                }
            }

            // Write Manifest Report
            var reportFile = new File(targetFolderPath + "/Collection_Report.txt");
            reportFile.open("w");
            reportFile.write(manifestLines.join("\n"));
            reportFile.close();

        } finally {
            if (relinkProject) {
                app.endUndoGroup();
            }
        }

        return {
            success: true,
            data: {
                collectedCount: collectedCount,
                failedCount: failedCount,
                totalBytes: totalBytes,
                targetFolder: targetFolderPath
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};


// =========================================================================
// PHASE 4.1: PROXY & TRANSCODE EXTENDSCRIPT INTEGRATION
// =========================================================================

/**
 * Gets video footage items suitable for generating proxies
 * @returns {object} List of footage items with dimensions, fps, duration, and proxy status
 */
MediaFlow.SmartActions.getFootageForProxy = function () {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };

        var items = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource || item.mainSource instanceof PlaceholderSource) continue;
            if (!item.file || !item.file.exists) continue;

            var isVideo = item.hasVideo && !item.isStill;
            var path = item.file.fsName;
            var type = MediaFlow.Utils.detectFileType(path);

            if (type === 'video' || isVideo) {
                var hasProxy = false;
                var useProxy = false;
                try {
                    hasProxy = (item.useProxy !== undefined && item.useProxy);
                    useProxy = (item.useProxy === true);
                } catch (pxErr) { }

                items.push({
                    id: item.id,
                    name: item.name,
                    path: path,
                    width: item.width || 0,
                    height: item.height || 0,
                    duration: item.duration || 0,
                    frameRate: item.frameRate || 0,
                    hasProxy: hasProxy,
                    useProxy: useProxy
                });
            }
        }

        return {
            success: true,
            data: { items: items }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Attaches a generated proxy file to a project FootageItem
 * @param {object} data - { itemId: number, proxyPath: string }
 * @returns {object} Result object
 */
MediaFlow.SmartActions.setFootageProxy = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var itemId = data && data.itemId;
        var proxyPath = data && data.proxyPath;

        if (!itemId || !proxyPath) {
            return { success: false, error: { message: "itemId and proxyPath are required" } };
        }

        var item = MediaFlow.SmartActions.findItemById(itemId);
        if (!item || !(item instanceof FootageItem)) {
            return { success: false, error: { message: "Footage item not found" } };
        }

        var proxyFile = new File(proxyPath);
        if (!proxyFile.exists) {
            return { success: false, error: { message: "Proxy file does not exist on disk: " + proxyPath } };
        }

        app.beginUndoGroup("Attach Footage Proxy");
        try {
            item.setProxy(proxyFile);
            item.useProxy = true;
        } finally {
            app.endUndoGroup();
        }

        return {
            success: true,
            data: {
                itemId: item.id,
                name: item.name,
                proxyPath: proxyFile.fsName
            }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};

/**
 * Removes attached proxy from a FootageItem
 * @param {object} data - { itemId: number }
 * @returns {object} Result object
 */
MediaFlow.SmartActions.removeFootageProxy = function (data) {
    try {
        if (!app.project) return { success: false, error: { message: "No project open" } };
        var itemId = data && data.itemId;
        var item = MediaFlow.SmartActions.findItemById(itemId);
        if (!item || !(item instanceof FootageItem)) {
            return { success: false, error: { message: "Footage item not found" } };
        }

        app.beginUndoGroup("Remove Footage Proxy");
        try {
            item.setProxyToNone();
        } finally {
            app.endUndoGroup();
        }

        return {
            success: true,
            data: { itemId: item.id, name: item.name }
        };
    } catch (e) {
        return { success: false, error: { message: e.toString() } };
    }
};
