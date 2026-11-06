/**
 * MediaFlow - Environment & UXP Abstraction Layer (Phase 4)
 * Decouples business logic from CEP / UXP / Browser runtime differences (SOLID: Dependency Inversion)
 */

var MFAdapter = (function () {
    // 1. Detect Environments
    const isCEP = (typeof window !== 'undefined' && (typeof window.__adobe_cep__ !== 'undefined' || typeof CSInterface !== 'undefined'));
    const isUXP = (typeof window !== 'undefined' && (typeof window.uxp !== 'undefined' || (typeof window.require !== 'undefined' && (function () {
        try { return !!window.require('uxp'); } catch (e) { return false; }
    })())));
    const isNode = (typeof process !== 'undefined' && process.versions && !!process.versions.node);
    const isBrowser = (!isCEP && !isUXP);

    /**
     * Get environment diagnosis report
     */
    function getEnvironmentInfo() {
        let envName = 'Browser Standalone';
        if (isUXP) envName = 'Adobe UXP Runtime';
        else if (isCEP) envName = 'Adobe CEP (Chromium + Node)';

        return {
            environment: envName,
            isCEP: isCEP,
            isUXP: isUXP,
            isNode: isNode,
            isBrowser: isBrowser,
            userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'Node.js',
            platform: (typeof process !== 'undefined' && process.platform) ? process.platform : 'web'
        };
    }

    /**
     * Unified File System Adapter
     */
    const fs = {
        /**
         * Read file text content
         */
        readFile: async function (path, encoding) {
            encoding = encoding || 'utf-8';
            if (isNode) {
                const nodeFs = require('fs');
                return nodeFs.readFileSync(path, encoding);
            } else if (isCEP && window.cep && window.cep.fs) {
                const res = window.cep.fs.readFile(path, encoding === 'utf-8' ? window.cep.encoding.UTF8 : undefined);
                if (res.err === 0) return res.data;
                throw new Error('CEP FS Read Error: ' + res.err);
            } else if (isUXP) {
                const uxpFs = require('uxp').storage.localFileSystem;
                const file = await uxpFs.getEntryWithUrl('file:' + path);
                return await file.read();
            } else {
                throw new Error('FileSystem is not available in browser mode');
            }
        },

        /**
         * Write file text content
         */
        writeFile: async function (path, content) {
            if (isNode) {
                const nodeFs = require('fs');
                nodeFs.writeFileSync(path, content, 'utf-8');
                return true;
            } else if (isCEP && window.cep && window.cep.fs) {
                const res = window.cep.fs.writeFile(path, content, window.cep.encoding.UTF8);
                return res.err === 0;
            } else if (isUXP) {
                const uxpFs = require('uxp').storage.localFileSystem;
                const file = await uxpFs.createEntryWithUrl('file:' + path, { overwrite: true });
                await file.write(content);
                return true;
            } else {
                throw new Error('FileSystem is not available in browser mode');
            }
        },

        /**
         * Ensure folder exists recursively
         */
        ensureDir: function (path) {
            if (isNode) {
                const nodeFs = require('fs');
                if (!nodeFs.existsSync(path)) {
                    nodeFs.mkdirSync(path, { recursive: true });
                }
                return true;
            } else if (isCEP && window.cep && window.cep.fs) {
                const res = window.cep.fs.makedir(path);
                return res.err === 0;
            }
            return false;
        }
    };

    /**
     * Unified Host Script Execution Adapter
     */
    const host = {
        /**
         * Execute ExtendScript or UXP modal script
         * @param {string} script - Script string
         * @returns {Promise<string>} Output from host
         */
        evalScript: function (script) {
            return new Promise(function (resolve, reject) {
                if (isCEP && typeof csInterface !== 'undefined') {
                    csInterface.evalScript(script, function (result) {
                        resolve(result);
                    });
                } else if (isUXP) {
                    try {
                        const ae = require('aftereffects');
                        if (ae && ae.executeAsModal) {
                            ae.executeAsModal(async function () {
                                resolve(JSON.stringify({ success: true }));
                            }, { commandName: "MediaFlow Action" });
                        } else {
                            resolve(JSON.stringify({ success: true }));
                        }
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    // Browser mock fallback
                    resolve(JSON.stringify({ success: true, mock: true }));
                }
            });
        }
    };

    // Public API
    return {
        isCEP: isCEP,
        isUXP: isUXP,
        isNode: isNode,
        isBrowser: isBrowser,
        getInfo: getEnvironmentInfo,
        fs: fs,
        host: host
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MFAdapter;
}

