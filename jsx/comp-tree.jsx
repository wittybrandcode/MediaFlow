/**
 * MediaFlow - Comp Tree Analyzer
 * Scans project compositions and builds a hierarchical tree structure.
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.CompTree = {

    /**
     * Find a project item by its ID
     * @param {number} id
     * @returns {Item|null}
     */
    findItemById: function (id) {
        for (var i = 1; i <= app.project.numItems; i++) {
            if (app.project.item(i).id == id) {
                return app.project.item(i);
            }
        }
        return null;
    },

    /**
     * Build and return the full composition tree
     * @returns {object} { roots: [...], totalComps: number }
     */
    getTree: function () {
        var result = {
            roots: [],
            totalComps: 0,
            error: null
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        try {
            // 1. Collect all CompItems
            var compsById = {};
            var allCompIds = [];

            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item instanceof CompItem) {
                    var hasMissing = false;
                    var isEmpty = (item.numLayers === 0);
                    for (var l = 1; l <= item.numLayers; l++) {
                        try {
                            var lyr = item.layer(l);
                            if (lyr && lyr.source) {
                                if (lyr.source.footageMissing === true) {
                                    hasMissing = true;
                                    break;
                                }
                                if (lyr.source.mainSource && lyr.source.mainSource.isMissing) {
                                    hasMissing = true;
                                    break;
                                }
                            }
                        } catch (exLyr) {}
                    }

                    compsById[item.id] = {
                        id: item.id,
                        name: item.name,
                        duration: Math.round(item.duration * 100) / 100,
                        width: item.width,
                        height: item.height,
                        frameRate: Math.round(item.frameRate * 100) / 100,
                        numLayers: item.numLayers,
                        hasVideo: item.hasVideo,
                        hasAudio: item.hasAudio,
                        hasMissing: hasMissing,
                        isEmpty: isEmpty,
                        children: [],
                        childIds: [],
                        isRoot: true
                    };
                    allCompIds.push(item.id);
                }
            }

            result.totalComps = allCompIds.length;

            if (allCompIds.length === 0) {
                return result;
            }

            // 2. Build parent→children relationships by scanning layers
            for (var c = 0; c < allCompIds.length; c++) {
                var compId = allCompIds[c];
                var compItem = this.findItemById(compId);
                if (!compItem) continue;

                for (var l = 1; l <= compItem.numLayers; l++) {
                    try {
                        var layer = compItem.layer(l);
                        if (layer.source && layer.source instanceof CompItem) {
                            var childId = layer.source.id;
                            if (compsById[childId]) {
                                // Avoid duplicates
                                var alreadyAdded = false;
                                for (var d = 0; d < compsById[compId].childIds.length; d++) {
                                    if (compsById[compId].childIds[d] === childId) {
                                        alreadyAdded = true;
                                        break;
                                    }
                                }
                                if (!alreadyAdded) {
                                    compsById[compId].childIds.push(childId);
                                    compsById[childId].isRoot = false;
                                }
                            }
                        }
                    } catch (e) {
                        // Skip problematic layers
                    }
                }
            }

            // 3. Build nested tree structure recursively
            var visited = {};
            function buildNode(id) {
                if (visited[id]) return null; // Prevent circular references
                visited[id] = true;

                var node = compsById[id];
                var nestedChildren = [];
                for (var k = 0; k < node.childIds.length; k++) {
                    var child = buildNode(node.childIds[k]);
                    if (child) {
                        nestedChildren.push(child);
                    }
                }

                return {
                    id: node.id,
                    name: node.name,
                    duration: node.duration,
                    width: node.width,
                    height: node.height,
                    frameRate: node.frameRate,
                    numLayers: node.numLayers,
                    hasVideo: node.hasVideo,
                    hasAudio: node.hasAudio,
                    hasMissing: node.hasMissing,
                    isEmpty: node.isEmpty,
                    isRoot: node.isRoot,
                    children: nestedChildren
                };
            }

            // 4. Extract roots (comps not used inside any other comp)
            for (var r = 0; r < allCompIds.length; r++) {
                var rId = allCompIds[r];
                if (compsById[rId].isRoot) {
                    visited = {}; // Reset for each root tree
                    var rootNode = buildNode(rId);
                    if (rootNode) {
                        result.roots.push(rootNode);
                    }
                }
            }

            // Sort roots alphabetically
            result.roots.sort(function (a, b) {
                return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
            });

        } catch (e) {
            result.error = { message: e.message };
        }

        return result;
    },

    /**
     * Add selected compositions to the Render Queue
     * @param {object} data - { compIds: number[] }
     * @returns {object} { addedCount: number, error: null }
     */
    addToRenderQueue: function (data) {
        var result = {
            addedCount: 0,
            rendered: false,
            error: null
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        try {
            var compIds = data.compIds || [];
            var template = data.template || null;
            var outputFolder = data.outputFolder || null;
            var startRender = data.startRender || false;

            if (compIds.length === 0) {
                result.error = { message: 'No compositions selected' };
                return result;
            }

            app.beginUndoGroup('MediaFlow Add to Render Queue');

            for (var i = 0; i < compIds.length; i++) {
                var comp = this.findItemById(compIds[i]);
                if (comp && comp instanceof CompItem) {
                    var rqItem = app.project.renderQueue.items.add(comp);
                    if (rqItem && rqItem.outputModules && rqItem.outputModules.length > 0) {
                        var om = rqItem.outputModules[1];
                        if (template && om) {
                            try { om.applyTemplate(template); } catch (eTmpl) {}
                        }
                        if (outputFolder && om) {
                            try {
                                var outDir = new Folder(outputFolder);
                                if (!outDir.exists) outDir.create();
                                var ext = '.mov';
                                if (template && template.toLowerCase().indexOf('h.264') !== -1) ext = '.mp4';
                                else if (template && template.toLowerCase().indexOf('png') !== -1) ext = '_[#####].png';
                                var targetFile = new File(outDir.fsName + '/' + comp.name + ext);
                                om.file = targetFile;
                            } catch (eFile) {}
                        }
                    }
                    result.addedCount++;
                }
            }

            if (startRender && result.addedCount > 0) {
                try {
                    app.project.renderQueue.render();
                    result.rendered = true;
                } catch (eRend) {
                    result.renderError = eRend.message;
                }
            }

            app.endUndoGroup();
        } catch (e) {
            result.error = { message: e.message };
        }

        return result;
    },

    /**
     * Batch rename compositions or project items
     * @param {object} data - { items: [{ id: number, newName: string }] }
     * @returns {object} { success: boolean, renamedCount: number, errors: array }
     */
    batchRename: function (data) {
        var result = {
            success: false,
            renamedCount: 0,
            errors: []
        };

        if (!app.project) {
            result.error = { message: 'No project open' };
            return result;
        }

        try {
            var items = data.items || [];
            if (items.length === 0) {
                result.error = { message: 'No items to rename' };
                return result;
            }

            app.beginUndoGroup('MediaFlow Batch Rename');

            for (var i = 0; i < items.length; i++) {
                var renameEntry = items[i];
                var id = renameEntry.id;
                var newName = renameEntry.newName;

                var item = this.findItemById(id);
                if (item && newName && typeof newName === 'string') {
                    try {
                        item.name = newName;
                        result.renamedCount++;
                    } catch (eItem) {
                        result.errors.push({ id: id, error: eItem.message });
                    }
                }
            }

            app.endUndoGroup();
            result.success = (result.renamedCount > 0);
        } catch (e) {
            result.error = { message: e.message };
        }

        return result;
    },

    /**
     * Open a composition in the Timeline panel
     * @param {object} data - { id: number }
     * @returns {object} { success: boolean, error: null }
     */
    openInTimeline: function (data) {
        var result = { success: false, error: null };
        try {
            var comp = this.findItemById(data.id);
            if (comp && comp instanceof CompItem) {
                comp.openInViewer();
                result.success = true;
            } else {
                result.error = { message: 'Composition not found or invalid type' };
            }
        } catch (e) {
            result.error = { message: e.message };
        }
        return result;
    },

    /**
     * Reveal and select a composition in the Project panel
     * @param {object} data - { id: number }
     * @returns {object} { success: boolean, error: null }
     */
    revealInProject: function (data) {
        var result = { success: false, error: null };
        try {
            var comp = this.findItemById(data.id);
            if (comp) {
                // Deselect all items first
                for (var i = 1; i <= app.project.numItems; i++) {
                    app.project.item(i).selected = false;
                }
                // Select and reveal
                comp.selected = true;
                app.executeCommand(2735); // Reveal in Project (usually 2735 or standard selection does it in modern AE)
                // Fallback for execution command failures is just selection, which is enough to highlight it
                result.success = true;
            } else {
                result.error = { message: 'Item not found' };
            }
        } catch (e) {
            result.error = { message: e.message };
        }
        return result;
    }
};
