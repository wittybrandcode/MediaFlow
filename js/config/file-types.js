/**
 * MediaFlow - File Types Configuration
 * Single Source of Truth for supported file types and extensions.
 *
 * @sync Any changes here MUST be mirrored in jsx/utils.jsx → detectFileType()
 *       since ExtendScript cannot import JS modules directly.
 *
 * Version: 1.0
 */

const FILE_TYPES_CONFIG = {
    video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mxf', 'prores', 'r3d', 'braw', 'mts', 'm2ts', 'ts', 'mpg', 'mpeg', 'wmv', 'flv', '3gp', 'rmvb'],
    audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'aiff', 'aif', 'wma', 'ac3', 'pcm'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'psd', 'psb', 'ai', 'svg', 'exr', 'bmp', 'dpx', 'tga', 'webp', 'hdr', 'ico', 'sgi', 'cin'],
    sequence: ['png', 'tiff', 'tif', 'exr', 'dpx', 'tga', 'jpg', 'jpeg', 'webp', 'cin', 'sgi']
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FILE_TYPES_CONFIG;
}
