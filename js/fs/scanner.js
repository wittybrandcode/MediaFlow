/**
 * MediaFlow - Directory Scanner
 * Handles directory traversal and file discovery (Node.js FS + CEP FS fallback).
 * Extracted from file-handler.js for Single Responsibility.
 * Version: 1.0
 */

var DirectoryScanner = (function () {
    'use strict';

    /**
     * Normalize path (Windows backslash to forward slash)
     * @param {string} path
     * @returns {string}
     */
    function normalizePath(path) {
        return path.replace(/\\/g, '/');
    }

    return {
        /**
         * Scan directory for files recursively (Async FS)
         * @param {string} dirPath - Directory to scan
         * @param {number} currentDepth - Current recursion depth
         * @returns {Promise<string[]>} Array of file paths
         */
        scanDirectory: async function (dirPath, currentDepth) {
            currentDepth = currentDepth || 0;
            var files = [];

            if (currentDepth > 10) {
                console.warn('[DirectoryScanner] Max directory depth reached at:', dirPath);
                return files;
            }

            if (!CEPBridge.isCEPEnvironment()) {
                console.warn('[DirectoryScanner] Cannot scan directory in browser mode');
                return files;
            }

            // --- Async Node.js FS (Fast, non-blocking) ---
            if (typeof require !== 'undefined') {
                try {
                    var fs = require('fs');
                    var path = require('path');
                    var util = require('util');
                    var readdir = util.promisify(fs.readdir);
                    var stat = util.promisify(fs.stat);
                    var self = this;

                    var items = await readdir(dirPath);
                    var promises = items.map(async function (item) {
                        var itemPath = normalizePath(path.join(dirPath, item));
                        try {
                            var itemStat = await stat(itemPath);
                            if (itemStat.isDirectory()) {
                                var subFiles = await self.scanDirectory(itemPath, currentDepth + 1);
                                files.push.apply(files, subFiles);
                            } else if (itemStat.isFile()) {
                                files.push(itemPath);
                            }
                        } catch (err) {
                            console.error('[DirectoryScanner] Error stating item via Node:', itemPath, err);
                        }
                    });

                    await Promise.all(promises);
                    return files;

                } catch (e) {
                    console.error('[DirectoryScanner] Node.js FS failed, falling back to cep.fs:', e);
                    // Fallthrough to fallback below
                }
            }

            // --- Fallback: CEP FS (Synchronous, blocking) ---
            try {
                var result = window.cep.fs.readdir(dirPath);
                var self = this;

                if (result.err === 0 && result.data) {
                    for (var i = 0; i < result.data.length; i++) {
                        // Yield main thread periodically to prevent total freeze
                        if (i % 50 === 0) await new Promise(function (r) { setTimeout(r, 0); });

                        var item = result.data[i];
                        var itemPath = normalizePath(dirPath + '/' + item);

                        // Check if directory
                        var statRes = window.cep.fs.stat(itemPath);

                        if (statRes.err === 0) {
                            if (statRes.data.isDirectory()) {
                                var subFiles = await self.scanDirectory(itemPath, currentDepth + 1);
                                files.push.apply(files, subFiles);
                            } else if (statRes.data.isFile()) {
                                files.push(itemPath);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[DirectoryScanner] Error scanning directory via cep.fs:', e);
            }

            return files;
        },

        normalizePath: normalizePath
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DirectoryScanner;
}
