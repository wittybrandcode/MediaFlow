/**
 * MediaFlow - Sequence Detector
 * Handles image sequence pattern matching, detection, and grouping.
 * Extracted from file-handler.js for Single Responsibility.
 * Version: 1.0
 */

var SequenceDetector = (function () {
    'use strict';

    /**
     * Sequence detection patterns
     */
    var SEQUENCE_PATTERNS = [
        /_(\\d+)\\.([a-zA-Z0-9]+)$/i,           // file_001.png
        /\\.(\\d+)\\.([a-zA-Z0-9]+)$/i,          // file.0001.exr
        /[\\-\\s](\\d{2,})\\.([a-zA-Z0-9]+)$/i,  // file-001.tiff (separator + 2+ digits)
        /[^\\d](\\d{3,})\\.([a-zA-Z0-9]+)$/i,   // file001.exr (direct numbering, 3+ digits)
        /\\[(\\d+)\\]\\.([a-zA-Z0-9]+)$/i         // file[001].tga (bracketed numbering)
    ];

    /**
     * Get file name from path
     * @param {string} path
     * @returns {string}
     */
    function getFileName(path) {
        var parts = path.split(/[/\\\\]/);
        return parts[parts.length - 1];
    }

    return {
        /**
         * Check if file matches a sequence pattern
         * @param {string} path - File path
         * @returns {boolean}
         */
        isSequence: function (path) {
            var fileName = getFileName(path);
            for (var i = 0; i < SEQUENCE_PATTERNS.length; i++) {
                if (SEQUENCE_PATTERNS[i].test(fileName)) {
                    return true;
                }
            }
            return false;
        },

        /**
         * Extract sequence info from file path
         * @param {string} path - File path
         * @returns {object|null} { baseName, padding, startFrame, extension, pattern }
         */
        getSequenceInfo: function (path) {
            var fileName = getFileName(path);
            for (var i = 0; i < SEQUENCE_PATTERNS.length; i++) {
                var match = fileName.match(SEQUENCE_PATTERNS[i]);
                if (match) {
                    var numStr = match[1];
                    var ext = match[2];

                    // Safely extract the exact baseName from the filename
                    var suffixToStrip = match[0];
                    var baseFileName = fileName.substring(0, fileName.length - suffixToStrip.length + (suffixToStrip.startsWith('.') || suffixToStrip.startsWith('_') ? 1 : 0));

                    // Reconstruct full dir basePath
                    var dirPath = path.substring(0, path.length - fileName.length);
                    var baseName = dirPath + baseFileName;

                    return {
                        baseName: baseName,
                        padding: numStr.length,
                        startFrame: parseInt(numStr, 10),
                        extension: ext.toLowerCase(),
                        pattern: baseName + '[#' + numStr.length + '].' + ext
                    };
                }
            }
            return null;
        },

        /**
         * Get the raw SEQUENCE_PATTERNS array (for external use)
         * @returns {RegExp[]}
         */
        getPatterns: function () {
            return SEQUENCE_PATTERNS;
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceDetector;
}
