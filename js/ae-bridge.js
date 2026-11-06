/**
 * MediaFlow - AE Bridge
 * After Effects specific communication layer
 * Version: 1.0
 */

const AEBridge = (function () {
    'use strict';

    /**
     * Retry configuration
     */
    const RETRY_CONFIG = {
        maxRetries: 3,
        delayMs: 500
    };

    /**
     * Sleep utility
     */
    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    /**
     * Non-retryable error codes — deterministic errors that will always fail
     */
    const NON_RETRYABLE = ['PROJECT_NOT_SAVED', 'NO_PROJECT', 'INVALID_JSON'];

    /**
     * Retry wrapper
     */
    async function withRetry(fn, retries, delay) {
        retries = retries || RETRY_CONFIG.maxRetries;
        delay = delay || RETRY_CONFIG.delayMs;

        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const result = await fn();
                // Check if JSX returned an error that should not be retried
                if (result && !result.success && result.error) {
                    const errMsg = result.error.message || '';
                    for (let k = 0; k < NON_RETRYABLE.length; k++) {
                        if (errMsg.indexOf(NON_RETRYABLE[k]) !== -1) {
                            throw new Error(NON_RETRYABLE[k]);
                        }
                    }
                }
                return result;
            } catch (e) {
                lastError = e;
                // Don't retry deterministic errors
                for (let k = 0; k < NON_RETRYABLE.length; k++) {
                    if (e.message && e.message.indexOf(NON_RETRYABLE[k]) !== -1) {
                        throw e;
                    }
                }
                if (i < retries - 1) {
                    await sleep(delay);
                }
            }
        }
        throw lastError;
    }

    return {
        /**
         * Check if a project is open
         * @returns {Promise<object>}
         */
        checkProject: async function () {
            const response = await CEPBridge.sendRequest('checkProject', {});

            if (response.success) {
                StateManager.set('projectOpen', response.data.isOpen);
                StateManager.set('projectPath', response.data.path);
                StateManager.set('projectName', response.data.name);
            }

            return response;
        },

        /**
         * Get project folder path
         * @returns {Promise<object>}
         */
        getProjectPath: async function () {
            return await CEPBridge.sendRequest('getProjectPath', {});
        },

        /**
         * Check if files are already in project
         * @param {string[]} files - Array of file paths format
         * @returns {Promise<object>} Maps path to match type ('exact', 'name-only', or false)
         */
        checkDuplicates: async function (files) {
            const response = await CEPBridge.sendRequest('checkDuplicates', files);
            if (response && response.success) {
                return response.data;
            }
            return {};
        },

        /**
         * Import files
         * @param {string[]} files - File paths
         * @param {string} mode - Import mode ('copy' or 'link')
         * @param {object} options - Additional options
         * @returns {Promise<object>}
         */
        importFiles: async function (files, mode, options) {
            options = options || {};

            const data = {
                files: files,
                mode: mode,
                options: {
                    createBins: true,
                    organizeByType: true,  // Main folders
                    subOrganization: options.subOrganization || 'type',
                    preserveStructure: options.preserveStructure !== false,
                    targetFolder: options.targetFolder || 'MediaFlow Import',
                    structureMode: options.structureMode || false,
                    fileTypes: typeof FILE_TYPES_CONFIG !== 'undefined' ? FILE_TYPES_CONFIG : null
                }
            };

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('importFiles', data);
            });
        },

        /**
         * Create folder (Bin) in project
         * @param {string} name - Folder name
         * @param {string} parent - Parent folder name (optional)
         * @returns {Promise<object>}
         */
        createFolder: async function (name, parent) {
            return await CEPBridge.sendRequest('createFolder', {
                name: name,
                parent: parent || null
            });
        },

        /**
         * Copy file to project folder
         * @param {string} sourcePath - Source file path
         * @param {string} targetPath - Target file path
         * @param {boolean} overwrite - Overwrite existing
         * @returns {Promise<object>}
         */
        copyFile: async function (sourcePath, targetPath, overwrite) {
            return await CEPBridge.sendRequest('copyFile', {
                sourcePath: sourcePath,
                targetPath: targetPath,
                overwrite: overwrite || false
            });
        },

        /**
         * Check if AE is busy
         * @returns {Promise<boolean>}
         */
        isAEBusy: async function () {
            try {
                const response = await CEPBridge.sendRequest('checkBusy', {});
                return response.success && response.data.busy;
            } catch (e) {
                return false;
            }
        },

        /**
         * Wait for AE to be ready
         * @param {number} timeout - Timeout in ms
         * @returns {Promise<boolean>}
         */
        waitForAE: async function (timeout) {
            timeout = timeout || 10000;
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
                const busy = await this.isAEBusy();
                if (!busy) {
                    return true;
                }
                await sleep(200);
            }

            return false;
        },

        /**
         * Execute import with progress tracking
         * @param {string[]} files - Files to import
         * @param {string} mode - Import mode
         * @param {object} options - Import options
         * @param {function} onProgress - Progress callback
         * @returns {Promise<object>}
         */
        executeImport: async function (files, mode, options, onProgress) {
            // Handle optional options argument
            if (typeof options === 'function') {
                onProgress = options;
                options = {};
            }
            options = options || {};

            const self = this;
            const total = files.length;
            const results = {
                imported: [],
                skipped: [],
                failed: []
            };

            // Check project first
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            // Wait for AE to be ready
            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            // Process in dynamic batches for UI responsiveness (slow copies vs fast links)
            const batchSize = (mode === 'copy') ? 5 : 25;
            const batches = [];

            for (let i = 0; i < files.length; i += batchSize) {
                batches.push(files.slice(i, i + batchSize));
            }

            let processed = 0;

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];

                try {
                    const response = await this.importFiles(batch, mode, options);

                    if (response.success) {
                        if (response.data.imported) {
                            results.imported = results.imported.concat(response.data.imported);
                        }
                        if (response.data.skipped) {
                            results.skipped = results.skipped.concat(response.data.skipped);
                        }
                        if (response.data.failed) {
                            results.failed = results.failed.concat(response.data.failed);
                        }
                    }
                } catch (e) {
                    // Mark batch as failed
                    batch.forEach(function (file) {
                        results.failed.push({
                            name: (typeof file === 'string') ? file.split('/').pop().split('\\').pop() : (file.name || 'unknown'),
                            path: (typeof file === 'string') ? file : (file.path || ''),
                            reason: e.message
                        });
                    });
                }

                processed += batch.length;

                if (onProgress) {
                    onProgress({
                        current: processed,
                        total: total,
                        percentage: Math.round((processed / total) * 100)
                    });
                }

                // Small delay between batches
                if (i < batches.length - 1) {
                    await sleep(100);
                }
            }

            return results;
        },

        /**
         * Get preview of auto-organizing existing project items
         * @param {object} options
         * @returns {Promise<object>}
         */
        getAutoOrganizePreview: async function (options) {
            options = options || {};
            options.fileTypes = typeof FILE_TYPES_CONFIG !== 'undefined' ? FILE_TYPES_CONFIG : null;

            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('getAutoOrganizePreview', options);
            });
        },

        /**
         * Auto-organize existing project items
         * @param {object} options
         * @returns {Promise<object>}
         */
        autoOrganizeProject: async function (options) {
            options = options || {};
            options.fileTypes = typeof FILE_TYPES_CONFIG !== 'undefined' ? FILE_TYPES_CONFIG : null;

            // Check project first
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            // Wait for AE to be ready
            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('autoOrganize', options);
            });
        },

        /**
         * Organize compositions into hierarchical tree
         * @param {object} options
         * @returns {Promise<object>}
         */
        organizeCompositions: async function (options) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('organizeComps', options || {});
            });
        },

        /* REMOVED: duplicate definitions of autoOrganizeProject, organizeCompositions,
           and getAutoOrganizePreview that were overriding the safe versions above */

        /**
         * Get project statistics
         * @returns {Promise<object>}
         */
        getProjectStats: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            return await CEPBridge.sendRequest('getProjectStats', {});
        },

        /**
         * Isolate Missing Media
         * @returns {Promise<object>}
         */
        isolateMissingMedia: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('isolateMissingMedia', {});
            });
        },

        /**
         * Isolate Unused Media
         * @returns {Promise<object>}
         */
        isolateUnusedMedia: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('isolateUnusedMedia', {});
            });
        },

        /**
         * Get Unused Media List
         * @returns {Promise<object>}
         */
        getUnusedMediaList: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('getUnusedMediaList', {});
            });
        },

        /**
         * Remove Unused Media (Irreversible)
         * @param {object} options - Options object, e.g. {deleteFromDisk: boolean}
         * @returns {Promise<object>}
         */
        removeUnusedMedia: async function (options) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('removeUnusedMedia', options || {});
            });
        },

        /**
         * Audit project for missing fonts and third-party effects
         * @returns {Promise<object>}
         */
        auditMissingFontsAndEffects: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) throw new Error('NO_PROJECT');
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('auditMissingFontsAndEffects', {});
            });
        },

        /**
         * Reveal and select a layer inside a composition in AE
         * @param {number} compId
         * @param {number} layerIndex
         * @returns {Promise<object>}
         */
        revealLayerInComp: async function (compId, layerIndex) {
            return await CEPBridge.sendRequest('revealLayerInComp', { compId: compId, layerIndex: layerIndex });
        },

        /**
         * Deep scan project for orphan compositions and unreferenced footage
         * @param {object} options
         * @returns {Promise<object>}
         */
        deepOrphanAudit: async function (options) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) throw new Error('NO_PROJECT');
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('deepOrphanAudit', options || {});
            });
        },

        /**
         * Isolate orphan compositions into a bin
         * @param {object} options
         * @returns {Promise<object>}
         */
        isolateOrphanComps: async function (options) {
            return await CEPBridge.sendRequest('isolateOrphanComps', options || {});
        },

        /**
         * Remove orphan items (comps and/or footage)
         * @param {object} data - { compIds: [], footageIds: [] }
         * @returns {Promise<object>}
         */
        removeOrphanItems: async function (data) {
            return await CEPBridge.sendRequest('removeOrphanItems', data || {});
        },

        /**
         * Auto-relink missing media from a directory
         * @param {string} searchFolder
         * @param {boolean} recursive
         * @returns {Promise<object>}
         */
        autoRelinkMedia: async function (searchFolder, recursive) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) throw new Error('NO_PROJECT');
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('autoRelinkMedia', {
                    searchFolder: searchFolder,
                    recursive: recursive !== false
                });
            });
        },

        /**
         * Consolidate and collect media to target destination
         * @param {object} options
         * @returns {Promise<object>}
         */
        smartCollectMedia: async function (options) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) throw new Error('NO_PROJECT');
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('smartCollectMedia', options || {});
            });
        },

        /**
         * Get list of video footage items eligible for proxy generation
         * @returns {Promise<object>}
         */
        getFootageForProxy: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) throw new Error('NO_PROJECT');
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('getFootageForProxy', {});
            });
        },

        /**
         * Attach a proxy file to a project FootageItem
         * @param {number} itemId
         * @param {string} proxyPath
         * @returns {Promise<object>}
         */
        setFootageProxy: async function (itemId, proxyPath) {
            return await CEPBridge.sendRequest('setFootageProxy', { itemId: itemId, proxyPath: proxyPath });
        },

        /**
         * Remove proxy from a FootageItem
         * @param {number} itemId
         * @returns {Promise<object>}
         */
        removeFootageProxy: async function (itemId) {
            return await CEPBridge.sendRequest('removeFootageProxy', { itemId: itemId });
        },

        /**
         * Get composition tree structure
         * @returns {Promise<object>}
         */
        getCompTree: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('getCompTree', {});
            });
        },

        /**
         * Add compositions to Render Queue
         * @param {number[]} compIds
         * @returns {Promise<object>}
         */
        addCompsToRenderQueue: async function (compIds, options) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            var opts = options || {};
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('addCompsToRenderQueue', {
                    compIds: compIds,
                    template: opts.template || null,
                    outputFolder: opts.outputFolder || null,
                    startRender: opts.startRender || false
                });
            });
        },

        /**
         * Batch rename items (compositions or footage)
         * @param {Array<{ id: number, newName: string }>} items
         * @returns {Promise<object>}
         */
        batchRename: async function (items) {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('batchRename', { items: items });
            });
        },

        /**
         * Open composition in Timeline
         * @param {number} compId
         * @returns {Promise<object>}
         */
        openCompInTimeline: async function (compId) {
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('openCompInTimeline', { id: compId });
            });
        },

        /**
         * Select and reveal composition in Project panel
         * @param {number} compId
         * @returns {Promise<object>}
         */
        revealCompInProject: async function (compId) {
            return await withRetry(async function () {
                return await CEPBridge.sendRequest('revealCompInProject', { id: compId });
            });
        },

        /**
         * Purge all memory and disk caches
         * @returns {Promise<object>}
         */
        purgeCaches: async function () {
            const projectCheck = await this.checkProject();
            if (!projectCheck.success || !projectCheck.data.isOpen) {
                throw new Error('NO_PROJECT');
            }

            const ready = await this.waitForAE();
            if (!ready) {
                throw new Error('AE_BUSY');
            }

            return await withRetry(async function () {
                return await CEPBridge.sendRequest('purgeCaches', {});
            });
        },

        /**
         * Get import summary from results object
         * @param {object} results - Import results containing imported, skipped, and failed arrays
         * @param {Array} results.imported - Array of successfully imported files
         * @param {Array} results.skipped - Array of skipped files (e.g. duplicates)
         * @param {Array} results.failed - Array of files that failed to import
         * @returns {string} Human readable summary string (e.g. "5 imported, 2 skipped")
         */
        getSummary: function (results) {
            const parts = [];

            if (results.imported.length > 0) {
                parts.push(results.imported.length + ' imported');
            }
            if (results.skipped.length > 0) {
                parts.push(results.skipped.length + ' skipped');
            }
            if (results.failed.length > 0) {
                parts.push(results.failed.length + ' failed');
            }

            return parts.join(', ') || 'No files processed';
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AEBridge;
}
