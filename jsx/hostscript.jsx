/**
 * MediaFlow - Host Script
 * ExtendScript entry point and dispatcher
 * Version: 1.0
 */

// Initialize Root Namespace - MUST be before any #include
var MediaFlow = MediaFlow || {};

// Include dependencies
#include "json2.jsx"
#include "utils.jsx"
#include "folder-manager.jsx"
#include "sequence-handler.jsx"
#include "media-importer.jsx"
#include "auto-organizer.jsx"
#include "comp-organizer.jsx"
#include "smart-actions.jsx"
#include "comp-tree.jsx"

/**
 * Main request handler
 * @param {string} jsonRequest - JSON string with action and data
 * @returns {string} JSON response
 */
function handleRequest(jsonRequest) {
    var request, response;

    try {
        // URI-decode first (JS side encodes to protect Arabic/Unicode characters)
        var decoded = decodeURIComponent(jsonRequest);
        request = JSON.parse(decoded);
    } catch (e) {
        return JSON.stringify({
            success: false,
            jobId: null,
            data: null,
            error: {
                code: 'INVALID_JSON',
                message: 'Failed to parse request: ' + e.message
            }
        });
    }

    // Initialize response
    response = {
        success: false,
        jobId: request.jobId,
        data: null,
        error: null
    };

    try {
        // Route to appropriate handler
        switch (request.action) {
            case 'checkProject':
                response.data = MediaFlowAPI.checkProject();
                response.success = true;
                break;

            case 'getProjectPath':
                response.data = MediaFlowAPI.getProjectPath();
                response.success = true;
                break;

            case 'checkDuplicates':
                response.data = MediaFlowAPI.checkDuplicates(request.data);
                response.success = true;
                break;

            case 'importFiles':
                response.data = MediaFlow.Importer.importFiles(request.data);
                response.success = true;
                break;

            case 'autoOrganize':
                response.data = MediaFlow.AutoOrganizer.autoOrganizeProject(request.data);
                response.success = true;
                break;

            case 'getAutoOrganizePreview':
                response.data = MediaFlow.AutoOrganizer.previewAutoOrganize(request.data);
                response.success = true;
                break;

            case 'organizeComps':
                response.data = MediaFlow.CompOrganizer.organizeCompositions(request.data);
                response.success = true;
                break;

            case 'getProjectStats':
                response.data = MediaFlow.CompOrganizer.getProjectStats();
                response.success = true;
                break;

            case 'isolateMissingMedia':
                var isolateResult = MediaFlow.SmartActions.isolateMissingMedia();
                response.success = isolateResult.success;
                response.data = isolateResult.data;
                response.error = isolateResult.error;
                break;

            case 'isolateUnusedMedia':
                var unusedIsoResult = MediaFlow.SmartActions.isolateUnusedMedia();
                response.success = unusedIsoResult.success;
                response.data = unusedIsoResult.data;
                response.error = unusedIsoResult.error;
                break;

            case 'getUnusedMediaList':
                var unusedListResult = MediaFlow.SmartActions.getUnusedMediaList();
                response.success = unusedListResult.success;
                response.data = unusedListResult.data;
                response.error = unusedListResult.error;
                break;

            case 'removeUnusedMedia':
                var removeUnusedRs = MediaFlow.SmartActions.removeUnusedMedia(request.data);
                response.success = removeUnusedRs.success;
                response.data = removeUnusedRs.data;
                response.error = removeUnusedRs.error;
                break;

            case 'purgeCaches':
                var purgeResult = MediaFlow.SmartActions.purgeCaches();
                response.success = purgeResult.success;
                response.data = purgeResult.data;
                response.error = purgeResult.error;
                break;

            case 'auditMissingFontsAndEffects':
                var auditResult = MediaFlow.SmartActions.auditMissingFontsAndEffects();
                response.success = auditResult.success;
                response.data = auditResult.data;
                response.error = auditResult.error;
                break;

            case 'revealLayerInComp':
                var revealResult = MediaFlow.SmartActions.revealLayerInComp(request.data);
                response.success = revealResult.success;
                response.data = revealResult.data;
                response.error = revealResult.error;
                break;

            case 'deepOrphanAudit':
                var orphanAuditRs = MediaFlow.SmartActions.deepOrphanAudit(request.data);
                response.success = orphanAuditRs.success;
                response.data = orphanAuditRs.data;
                response.error = orphanAuditRs.error;
                break;

            case 'isolateOrphanComps':
                var isolateOrphanRs = MediaFlow.SmartActions.isolateOrphanComps(request.data);
                response.success = isolateOrphanRs.success;
                response.data = isolateOrphanRs.data;
                response.error = isolateOrphanRs.error;
                break;

            case 'removeOrphanItems':
                var removeOrphanRs = MediaFlow.SmartActions.removeOrphanItems(request.data);
                response.success = removeOrphanRs.success;
                response.data = removeOrphanRs.data;
                response.error = removeOrphanRs.error;
                break;

            case 'autoRelinkMedia':
                var relinkRs = MediaFlow.SmartActions.autoRelinkMedia(request.data);
                response.success = relinkRs.success;
                response.data = relinkRs.data;
                response.error = relinkRs.error;
                break;

            case 'smartCollectMedia':
                var collectRs = MediaFlow.SmartActions.smartCollectMedia(request.data);
                response.success = collectRs.success;
                response.data = collectRs.data;
                response.error = collectRs.error;
                break;

            case 'getFootageForProxy':
                var footageRs = MediaFlow.SmartActions.getFootageForProxy();
                response.success = footageRs.success;
                response.data = footageRs.data;
                response.error = footageRs.error;
                break;

            case 'setFootageProxy':
                var setProxyRs = MediaFlow.SmartActions.setFootageProxy(request.data);
                response.success = setProxyRs.success;
                response.data = setProxyRs.data;
                response.error = setProxyRs.error;
                break;

            case 'removeFootageProxy':
                var remProxyRs = MediaFlow.SmartActions.removeFootageProxy(request.data);
                response.success = remProxyRs.success;
                response.data = remProxyRs.data;
                response.error = remProxyRs.error;
                break;

            case 'createFolder':
                response.data = MediaFlow.FolderManager.createFolder(request.data);
                response.success = true;
                break;

            case 'copyFile':
                var copyData = request.data;
                response.data = MediaFlow.Utils.copyFileInternal(copyData.sourcePath, copyData.targetPath);
                response.success = response.data.success;
                if (!response.data.success) {
                    response.error = { code: 'COPY_FAILED', message: response.data.error };
                }
                break;

            case 'checkBusy':
                response.data = { busy: false }; // AE doesn't have a busy API
                response.success = true;
                break;

            case 'getCompTree':
                var treeResult = MediaFlow.CompTree.getTree();
                response.success = !treeResult.error;
                response.data = treeResult;
                if (treeResult.error) response.error = treeResult.error;
                break;

            case 'addCompsToRenderQueue':
                var rqResult = MediaFlow.CompTree.addToRenderQueue(request.data);
                response.success = !rqResult.error;
                response.data = rqResult;
                if (rqResult.error) response.error = rqResult.error;
                break;

            case 'openCompInTimeline':
                var openResult = MediaFlow.CompTree.openInTimeline(request.data);
                response.success = openResult.success;
                if (openResult.error) response.error = openResult.error;
                break;

            case 'revealCompInProject':
                var revealResult = MediaFlow.CompTree.revealInProject(request.data);
                response.success = revealResult.success;
                if (revealResult.error) response.error = revealResult.error;
                break;

            case 'batchRename':
                var renameResult = MediaFlow.CompTree.batchRename(request.data);
                response.success = renameResult.success;
                response.data = renameResult;
                if (renameResult.error) response.error = renameResult.error;
                break;

            default:
                response.error = {
                    code: 'UNKNOWN_ACTION',
                    message: 'Unknown action: ' + request.action
                };
        }
    } catch (e) {
        response.success = false;
        response.error = {
            code: 'EXECUTION_ERROR',
            message: e.message,
            details: e.toString(),
            line: e.line || null,
            source: e.fileName || null
        };
    }

    return JSON.stringify(response);
}

var MediaFlowAPI = {
    /**
     * Check if a project is open
     * @returns {object}
     */
    checkProject: function () {
        var result = {
            isOpen: false,
            name: null,
            path: null
        };

        try {
            if (app.project) {
                result.isOpen = true;
                if (app.project.file) {
                    result.name = app.project.file.name;
                    result.path = app.project.file.fsName;
                } else {
                    result.name = 'Untitled Project';
                    result.path = null;
                }
            }
        } catch (e) {
            // Project not open
        }

        return result;
    },

    /**
     * Check multiple files for duplicates
     * @param {string[]} files
     * @returns {object} Maps filePath to duplicate status (false, 'exact', or 'name-only')
     */
    checkDuplicates: function (files) {
        var results = {};
        if (files && files.length) {
            for (var i = 0; i < files.length; i++) {
                results[files[i]] = MediaFlow.SequenceHandler.isDuplicate(files[i]);
            }
        }
        return results;
    },

    /**
     * Get project path information
     * @returns {object}
     */
    getProjectPath: function () {
        var result = {
            projectPath: null,
            projectFolder: null,
            mediaFolder: null  // Determined by JS settings (mediaFolderName)
        };

        try {
            if (app.project && app.project.file) {
                result.projectPath = app.project.file.fsName;
                result.projectFolder = app.project.file.parent.fsName;
            }
        } catch (e) {
            // Project not open
        }

        return result;
    },

    /**
     * Test function for debugging
     * @returns {string}
     */
    test: function () {
        return JSON.stringify({
            success: true,
            message: 'MediaFlow JSX is working!',
            aeVersion: app.version,
            projectOpen: (app.project && app.project.file) ? true : false
        });
    }
};