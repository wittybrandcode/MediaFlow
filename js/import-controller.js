/**
 * MediaFlow - Import Controller
 * Handles file import workflow: drop, browse, mode selection, and execution.
 * Extracted from app.js for Single Responsibility (Phase 3 Hardening).
 * Version: 1.0
 */

var ImportController = (function () {
    'use strict';

    /**
     * Initialize — bind all import-related events
     */
    function init() {
        EventBus.on(Events.FILES_DROPPED, handleFilesDropped);
        EventBus.on(Events.FILES_SELECTED, handleBrowseFiles);
        EventBus.on(Events.MODE_SELECTED, handleModeSelected);
        EventBus.on(Events.SEQUENCE_TOGGLED, handleSequenceToggled);
    }

    /**
     * Handle toggling of a detected sequence
     * @param {object} data - { seqName: string, enabled: boolean }
     */
    function handleSequenceToggled(data) {
        CEPBridge.log('info', 'Toggling sequence: ' + data.seqName + ' -> ' + data.enabled);

        let files = StateManager.getRaw('validatedFiles') || [];

        for (let i = 0; i < files.length; i++) {
            if (files[i].name === data.seqName) {
                files[i].importAsSequence = data.enabled;
                break;
            }
        }

        StateManager.set('validatedFiles', files);
        UIController.log('Sequence `' + data.seqName + '` import ' + (data.enabled ? 'enabled' : 'disabled') + '.', 'info');
    }

    /**
     * Handle files dropped
     * @param {string[]} paths
     */
    async function handleFilesDropped(paths) {
        CEPBridge.log('info', 'Files dropped:', paths.length);

        const processed = await FileHandler.processDroppedItems(paths);

        if (processed.files.length === 0 && (!processed.invalid || processed.invalid.length === 0)) {
            UIController.log('No valid files found', 'warning');
            return;
        }

        // Check for duplicates
        const pathsToCheck = processed.files.map(function (f) {
            if (f.rawFiles && f.rawFiles[0]) {
                var raw = f.rawFiles[0];
                return typeof raw === 'string' ? raw : raw.path;
            }
            return f.path;
        });
        const dupes = await AEBridge.checkDuplicates(pathsToCheck);

        processed.files.forEach(f => {
            const pathToCheck = (f.rawFiles && f.rawFiles[0]) ? f.rawFiles[0] : f.path;
            if (dupes && dupes[pathToCheck]) {
                f.duplicateType = dupes[pathToCheck];
            }
        });

        StateManager.set('pendingFiles', processed.files);
        StateManager.set('validatedFiles', processed.files);
        StateManager.set('hasFolderStructure', processed.hasFolders || false);

        processed.invalid.forEach(function (file) {
            UIController.log(file.name + ' - ' + file.error, 'warning');
        });

        const savedMode = StateManager.get('savedMode');
        const rememberChoice = StateManager.get('rememberChoice');

        if (savedMode && rememberChoice) {
            if (processed.hasFolders) {
                // FORCE SHOW MODAL for folders, so user can check/uncheck Rebuild Original
                CEPBridge.log('info', 'Folders detected - forcing modal bypass of savedMode');
            } else {
                // Only use savedMode for plain file drops (no folders)
                CEPBridge.log('info', 'Using saved mode (no folders):', savedMode);
                StateManager.set('importMode', savedMode);
                StateManager.set('structureMode', false);
                executeImport();
                return; // Early return prevents modal from showing
            }
        }

        // Show modal block
        var vCount = 0, iCount = 0, aCount = 0, sCount = 0;
        processed.files.forEach(function (f) {
            if (f.isSequence) sCount++;
            else if (f.type === 'video') vCount++;
            else if (f.type === 'image') iCount++;
            else if (f.type === 'audio') aCount++;
        });

        var summaryParts = [];
        if (vCount > 0) summaryParts.push('🎬 ' + vCount + ' video');
        if (iCount > 0) summaryParts.push('🖼️ ' + iCount + ' image(s)');
        if (aCount > 0) summaryParts.push('🔊 ' + aCount + ' audio');
        if (sCount > 0) summaryParts.push('📂 ' + sCount + ' sequence(s)');
        if (processed.hasFolders) summaryParts.push('📁 ' + processed.folders.length + ' folder(s)');
        if (processed.invalid && processed.invalid.length > 0) summaryParts.push('⚠️ ' + processed.invalid.length + ' unsupported');

        var finalSummary = summaryParts.length > 0 ? summaryParts.join(' · ') : processed.files.length + ' file(s) ready to import';

        UIController.log(finalSummary, 'info');
        UIController.renderSequences(processed.files);
        UIController.renderInvalidFiles(processed.invalid);

        // Show/hide the Structure options based on folder detection
        var contextOpts = document.getElementById('context-options-container');
        if (contextOpts) {
            contextOpts.style.display = processed.hasFolders ? '' : 'none';
        }

        // Show/hide duplicate handling options
        var hasDuplicates = processed.files.some(function(f) { return !!f.duplicateType; });
        var dupOpts = document.getElementById('duplicate-options-container');
        if (dupOpts) {
            dupOpts.style.display = hasDuplicates ? '' : 'none';
        }

        UIController.showModal();
    }

    /**
     * Handle browse button click
     */
    async function handleBrowseFiles() {
        CEPBridge.log('info', 'Browse files clicked');

        try {
            const paths = await CEPBridge.openFilePicker(
                'Select Media Files',
                '',
                FileHandler.getSupportedExtensions()
            );

            if (paths && paths.length > 0) {
                EventBus.emit(Events.FILES_DROPPED, paths);
            }
        } catch (e) {
            CEPBridge.log('info', 'File picker cancelled');
        }
    }

    /**
     * Handle mode selection
     * @param {string} mode
     */
    function handleModeSelected(mode) {
        CEPBridge.log('info', 'Mode selected:', mode);

        // CRITICAL: Read toggle state BEFORE hiding modal (hideModal may destroy DOM)
        var toggleElem = document.getElementById('toggle-structure-mode');
        var isToggleOn = toggleElem ? toggleElem.checked : false;

        // If the toggle is visible and checked, the user wants structure.
        var wantStructure = isToggleOn;

        // Read duplicate action if duplicate UI was visible
        var dupOpts = document.getElementById('duplicate-options-container');
        var dupActionElem = document.getElementById('duplicate-action-select');
        var duplicateAction = (dupOpts && dupOpts.style.display !== 'none' && dupActionElem) ? dupActionElem.value : 'skip';

        UIController.hideModal();

        StateManager.set('structureMode', !!wantStructure);
        CEPBridge.log('info', '[DEBUG] structureMode explicit=' + wantStructure);
        CEPBridge.log('info', 'Structure mode set to:', wantStructure);

        StateManager.set('duplicateAction', duplicateAction);

        StateManager.set('importMode', mode);

        if (StateManager.get('rememberChoice')) {
            StateManager.set('savedMode', mode);
            StateManager.savePreferences();
        }

        executeImport();
    }

    /**
     * Execute the import process
     */
    async function executeImport() {
        const files = StateManager.getRaw('validatedFiles');
        const mode = StateManager.get('importMode');

        if (!files || files.length === 0) {
            UIController.log('No files to import', 'warning');
            return;
        }

        if (!mode) {
            UIController.log('No import mode selected', 'error');
            return;
        }

        CEPBridge.log('info', 'Starting import with mode:', mode);

        UIController.setProcessing(true);
        UIController.lockUI(true); // Task 3: Lock UI to prevent concurrent drops
        UIController.showProgress();
        UIController.updateProgress(0, 'Initializing...', 0, files.length, '');

        StateManager.update('results', {
            imported: [],
            skipped: [],
            failed: []
        });

        // Unpack sequences that the user explicitly disabled via the toggle switch
        let importFilesList = [];
        for (let i = 0; i < files.length; i++) {
            let f = files[i];
            if (f.isSequence && f.importAsSequence === false && f.rawFiles) {
                for (let j = 0; j < f.rawFiles.length; j++) {
                    const rawF = Object.assign({}, f.rawFiles[j]);
                    rawF.forceIndividual = true;
                    importFilesList.push(rawF);
                }
            } else {
                importFilesList.push(f);
            }
        }

        const isStructureMode = StateManager.get('structureMode') || false;
        const subOrganization = SettingsManager.get('organization', 'subOrganization') || 'extension';
        var isAborted = false;

        var abortListener = function () {
            isAborted = true;
            UIController.log('Import aborted by user.', 'warning');
        };
        var abortListenerId = EventBus.on(Events.ABORT_IMPORT, abortListener);

        try {
            var startTime = Date.now();
            var totalCount = importFilesList.length;
            var results = { imported: [], skipped: [], failed: [] };

            // BATCH PROCESSING: Process files in chunks to keep CEP UI alive
            const CHUNK_SIZE = 25; 
            for (let i = 0; i < totalCount; i++) {
                if (isAborted) break;

                let file = importFilesList[i];
                let elapsedMs = Date.now() - startTime;
                let filesPerSec = i > 0 && elapsedMs > 0 ? (i / (elapsedMs / 1000)).toFixed(1) : 0;
                let speedInfo = filesPerSec > 0 ? filesPerSec + ' it/s' : '';

                UIController.updateProgress(Math.round((i / totalCount) * 100), file.name, i, totalCount, speedInfo);

                const isStructureMode = StateManager.get('structureMode') || false;
                const duplicateAction = StateManager.get('duplicateAction') || 'skip';

                // Call AE bridge for single file import
                const activeFolders = (typeof FolderPresets !== 'undefined') ? FolderPresets.getActiveFolderNames() : null;
                const singleResult = await AEBridge.importFiles([file], mode, { subOrganization: subOrganization, structureMode: isStructureMode, duplicateAction: duplicateAction, folderNames: activeFolders });

                if (singleResult && singleResult.success && singleResult.data) {
                    if (singleResult.data.imported && singleResult.data.imported.length > 0) results.imported.push(singleResult.data.imported[0]);
                    if (singleResult.data.skipped && singleResult.data.skipped.length > 0) results.skipped.push(singleResult.data.skipped[0]);
                    if (singleResult.data.failed && singleResult.data.failed.length > 0) results.failed.push(singleResult.data.failed[0]);
                }

                // Yield main thread every CHUNK_SIZE files to prevent UI block
                if (i > 0 && i % CHUNK_SIZE === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            if (!isAborted) {
                UIController.updateProgress(100, 'Complete', totalCount, totalCount, '');
            }

            StateManager.update('results', results);

            if (results.imported.length > 0) {
                results.imported.forEach(function (f) {
                    UIController.log(f.name + ' imported', 'success');
                });
            }

            if (results.skipped.length > 0) {
                results.skipped.forEach(function (f) {
                    UIController.log(f.name + ' skipped: ' + f.reason, 'warning');
                });
            }

            if (results.failed.length > 0) {
                results.failed.forEach(function (f) {
                    UIController.log(f.name + ' failed: ' + f.reason, 'error');
                });
            }

            const summary = 'Imported: ' + results.imported.length + ', Skipped: ' + results.skipped.length + ', Failed: ' + results.failed.length;
            UIController.log((isAborted ? 'Aborted: ' : 'Complete: ') + summary, 'info');

            UIController.flashDropzone('success');

            setTimeout(function () {
                UIController.hideProgress();
                UIController.lockUI(false); // Task 3: Unlock UI
            }, 3000);

            // Structure mode is now handled directly inside media-importer.jsx (single-phase)
            if (StateManager.get('structureMode')) {
                StateManager.set('structureMode', false);
            }

        } catch (e) {
            CEPBridge.log('error', 'Import failed:', e);

            if (e.message === 'NO_PROJECT') {
                UIController.log('No project open. Please open a project first.', 'error');
            } else if (e.message === 'PROJECT_NOT_SAVED') {
                UIController.log('Project is not saved. Please save your project first to use "Copy to Project" mode.', 'warning');
                alert('يرجى حفظ المشروع (Save) أولاً قبل استخدام وضع النسخ للمشروع لضمان استقرار المسارات.');
            } else if (e.message === 'AE_BUSY') {
                UIController.log('After Effects is busy. Please wait and try again.', 'warning');
            } else {
                UIController.log('Import failed: ' + e.message, 'error');
            }

            UIController.flashDropzone('error');
            UIController.lockUI(false); // Task 3: Unlock UI
        }

        EventBus.off(abortListenerId);
        UIController.setProcessing(false);
        UIController.hideProgress();
        StateManager.resetImport();
    }

    /**
     * Check AE project status
     */
    async function checkProjectStatus() {
        try {
            const response = await AEBridge.checkProject();

            if (response.success && response.data.isOpen) {
                CEPBridge.log('info', 'Project open:', response.data.name);
                StateManager.set('projectOpen', true);
                StateManager.set('projectName', response.data.name);
                StateManager.set('projectPath', response.data.path);
            } else {
                CEPBridge.log('warn', 'No project open');
                StateManager.set('projectOpen', false);
            }
        } catch (e) {
            CEPBridge.log('error', 'Failed to check project status:', e);
        }
    }

    // Public API
    return {
        init: init,
        checkProjectStatus: checkProjectStatus,
        executeImport: executeImport
    };

})();
