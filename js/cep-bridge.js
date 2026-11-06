/**
 * MediaFlow - CEP Bridge
 * Singleton wrapper for CSInterface
 * Version: 1.0
 */

const CEPBridge = (function () {
    'use strict';

    /**
     * CSInterface instance
     */
    let csInterface = null;

    /**
     * Is CEP environment available
     */
    let isCEP = false;

    /**
     * Debug mode
     */
    let debugMode = false;

    /**
     * Initialize the bridge
     */
    function init() {
        // Check if running in CEP environment
        if (typeof window.__adobe_cep__ !== 'undefined') {
            isCEP = true;
            csInterface = new CSInterface();

            // Check debug mode
            const debug = csInterface.getSystemPath(SystemPath.EXTENSION);
            debugMode = debug && debug.length > 0;

            // Force-reload JSX so changes take effect without restarting AE
            var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
            var jsxPath = extPath + '/jsx/hostscript.jsx';
            csInterface.evalScript('$.evalFile("' + jsxPath.replace(/\\/g, '/') + '")');

            console.log('[CEPBridge] Initialized in CEP environment');
            console.log('[CEPBridge] Extension path:', csInterface.getSystemPath(SystemPath.EXTENSION));
            console.log('[CEPBridge] Host app:', csInterface.getHostEnvironment().appName);
        } else {
            console.log('[CEPBridge] Not in CEP environment - running in browser mode');
        }
    }

    /**
     * Generate unique job ID
     */
    function generateJobId() {
        return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    return {
        /**
         * Initialize the bridge
         */
        initialize: function () {
            init();
        },

        /**
         * Check if running in CEP
         * @returns {boolean}
         */
        isCEPEnvironment: function () {
            return isCEP;
        },

        /**
         * Get CSInterface instance
         * @returns {CSInterface|null}
         */
        getCSInterface: function () {
            return csInterface;
        },

        /**
         * Evaluate ExtendScript
         * @param {string} script - Script to execute
         * @returns {Promise<string>} Result
         */
        evalScript: function (script) {
            return new Promise(function (resolve, reject) {
                if (!isCEP) {
                    console.log('[CEPBridge] Browser mode - simulating evalScript:', script);
                    // Simulate response for testing
                    resolve('{"success": true, "data": {}}');
                    return;
                }

                // Global timeout (15 minutes - 900 seconds) to prevent infinite UI freezing if JSX hangs
                // Large copies (5GB+ files) running synchronously in AE require this overhead.
                const timeoutId = setTimeout(function () {
                    reject(new Error('AE Promise Timeout: ExtendScript did not respond within 900 seconds (15 minutes).'));
                }, 900000);

                csInterface.evalScript(script, function (result) {
                    clearTimeout(timeoutId);
                    if (result === EvalScript_ErrMessage || result === 'EvalScript error.' || !result || result === 'undefined') {
                        reject(new Error('ExtendScript returned invalid response: ' + (result || 'empty')));
                    } else {
                        resolve(result);
                    }
                });
            });
        },

        /**
         * Send JSON request to JSX
         * @param {string} action - Action name
         * @param {object} data - Data object
         * @returns {Promise<object>} Response object
         */
        sendRequest: function (action, data) {
            const self = this;
            const jobId = generateJobId();

            const request = {
                action: action,
                jobId: jobId,
                data: data || {}
            };

            const requestStr = JSON.stringify(request);
            // URI-encode to safely pass Arabic/Unicode characters through evalScript
            const safeStr = encodeURIComponent(requestStr);
            const script = 'handleRequest(' + JSON.stringify(safeStr) + ')';

            return this.evalScript(script)
                .then(function (result) {
                    try {
                        const response = JSON.parse(result);
                        if (response.jobId !== jobId) {
                            console.warn('[CEPBridge] Job ID mismatch');
                        }
                        return response;
                    } catch (e) {
                        console.error('[CEPBridge] Failed to parse response:', result);
                        throw new Error('Invalid JSON response');
                    }
                });
        },

        /**
         * Get extension path
         * @returns {string}
         */
        getExtensionPath: function () {
            if (!isCEP) return '';
            return csInterface.getSystemPath(SystemPath.EXTENSION);
        },

        /**
         * Get user data path
         * @returns {string}
         */
        getUserDataPath: function () {
            if (!isCEP) return '';
            return csInterface.getSystemPath(SystemPath.USER_DATA);
        },

        /**
         * Get common files path
         * @returns {string}
         */
        getCommonFilesPath: function () {
            if (!isCEP) return '';
            return csInterface.getSystemPath(SystemPath.COMMON_FILES);
        },

        /**
         * Get host environment info
         * @returns {object|null}
         */
        getHostEnvironment: function () {
            if (!isCEP) return null;
            return csInterface.getHostEnvironment();
        },

        /**
         * Get current API version
         * @returns {object}
         */
        getCurrentApiVersion: function () {
            if (!isCEP) return { major: 0, minor: 0, micro: 0 };
            return csInterface.getCurrentApiVersion();
        },

        /**
         * Open URL in default browser
         * @param {string} url
         */
        openURLInDefaultBrowser: function (url) {
            if (isCEP) {
                cep.util.openURLInDefaultBrowser(url);
            } else {
                window.open(url, '_blank');
            }
        },

        /**
         * Request to open file picker
         * @param {string} title - Dialog title
         * @param {string} initialPath - Starting path
         * @param {string} fileTypes - File type filters
         * @returns {Promise<string[]>} Selected file paths
         */
        openFolderPicker: function (title, initialPath) {
            return new Promise(function (resolve, reject) {
                if (!isCEP) {
                    const chosen = prompt(title || 'Enter directory path:', initialPath || '');
                    if (chosen) resolve(chosen);
                    else reject(new Error('Folder picker cancelled'));
                    return;
                }
                const result = window.cep.fs.showOpenDialog(false, true, title || 'Select Folder', initialPath || '', []);
                if (result.err === 0 && result.data && result.data.length > 0) {
                    resolve(result.data[0]);
                } else {
                    reject(new Error('Folder picker cancelled or error'));
                }
            });
        },

        openFilePicker: function (title, initialPath, fileTypes) {
            return new Promise(function (resolve, reject) {
                if (!isCEP) {
                    // Browser fallback - create file input
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;

                    input.onchange = function (e) {
                        const files = Array.from(e.target.files).map(function (f) {
                            return f.name; // In browser, we only get name
                        });
                        resolve(files);
                    };

                    input.click();
                    return;
                }

                // Use CEP file picker
                const result = window.cep.fs.showOpenDialog(
                    true,  // multi-select
                    false, // not directory picker
                    title || 'Select Files',
                    initialPath || '',
                    [] // Empty array forces "All Files (*.*)" to avoid CEP Windows filter truncation bug
                );

                if (result.err === 0 && result.data) {
                    resolve(result.data);
                } else {
                    reject(new Error('File picker cancelled or error'));
                }
            });
        },

        /**
         * Close the panel
         */
        closePanel: function () {
            if (isCEP) {
                csInterface.closeExtension();
            }
        },

        /**
         * Register event listener for CEP events
         * @param {string} type - Event type
         * @param {Function} listener - Callback
         * @param {object} obj - Optional context
         */
        addEventListener: function (type, listener, obj) {
            if (isCEP) {
                csInterface.addEventListener(type, listener, obj);
            }
        },

        /**
         * Remove event listener
         * @param {string} type - Event type
         * @param {Function} listener - Callback
         * @param {object} obj - Optional context
         */
        removeEventListener: function (type, listener, obj) {
            if (isCEP) {
                csInterface.removeEventListener(type, listener, obj);
            }
        },

        /**
         * Dispatch CEP event
         * @param {CSEvent} event
         */
        dispatchEvent: function (event) {
            if (isCEP) {
                csInterface.dispatchEvent(event);
            }
        },

        /**
         * Set panel size
         * @param {number} width
         * @param {number} height
         */
        resizeContent: function (width, height) {
            if (isCEP) {
                csInterface.resizeContent(width, height);
            }
        },

        /**
         * Log to console with prefix
         * @param {string} level - Log level
         * @param {string} message
         * @param {*} data
         */
        log: function (level, message, data) {
            const prefix = '[MediaFlow]';
            const timestamp = new Date().toISOString().substr(11, 12);

            const logMessage = timestamp + ' ' + message;

            switch (level) {
                case 'error':
                    console.error(prefix, logMessage, data || '');
                    break;
                case 'warn':
                    console.warn(prefix, logMessage, data || '');
                    break;
                case 'info':
                    console.info(prefix, logMessage, data || '');
                    break;
                default:
                    console.log(prefix, logMessage, data || '');
            }
        }
    };
})();

// Initialize on load
CEPBridge.initialize();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CEPBridge;
}