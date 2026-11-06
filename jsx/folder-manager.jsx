/**
 * MediaFlow - Folder Manager
 * Project folder (Bin) creation and management
 * Version: 1.0
 */

if (typeof MediaFlow === 'undefined') {
    var MediaFlow = {};
}

MediaFlow.FolderManager = {

    /**
     * Create a folder in the project
     * @param {object} data - { name, parent }
     * @returns {object}
     */
    createFolder: function (data) {
        var result = {
            name: data.name,
            path: data.name,
            id: null,
            error: null
        };

        // Check project is open
        if (!app.project) {
            result.error = 'NO_PROJECT';
            return result;
        }

        try {
            var parentFolder = null;

            // Find parent folder if specified
            if (data.parent) {
                parentFolder = this.findFolderByName(data.parent);
            }

            // Check if folder already exists
            var existingFolder = this.findFolderByName(data.name, parentFolder);

            if (existingFolder) {
                result.id = existingFolder.id;
                result.path = this.getFolderPath(existingFolder);
                return result;
            }

            // Create new folder
            var newFolder;
            if (parentFolder) {
                newFolder = parentFolder.items.addFolder(data.name);
            } else {
                newFolder = app.project.items.addFolder(data.name);
            }

            result.id = newFolder.id;
            result.path = this.getFolderPath(newFolder);

        } catch (e) {
            result.error = e.message;
        }

        return result;
    },

    /**
     * Find folder by name
     * @param {string} name
     * @param {FolderItem} parent - Optional parent folder
     * @returns {FolderItem|null}
     */
    findFolderByName: function (name, parent) {
        var items = parent ? parent.items : app.project.items;

        for (var i = 1, len = items.length; i <= len; i++) {
            var item = items[i];

            if (item instanceof FolderItem && item.name.toLowerCase() === name.toLowerCase()) {
                return item;
            }
        }

        return null;
    },

    /**
     * Get folder path (e.g., "Parent/Child/Folder")
     * @param {FolderItem} folder
     * @returns {string}
     */
    getFolderPath: function (folder) {
        var path = folder.name;
        var current = folder.parentFolder;

        while (current && current !== app.project.rootFolder) {
            path = current.name + '/' + path;
            current = current.parentFolder;
        }

        return path;
    },

    /**
     * Create folder structure for Smart Organize
     * @param {string} parentName - Parent folder name
     * @param {string} subOrganization - Optional, e.g., 'extension'
     * @returns {object}
     */
    createSmartOrganizeFolders: function (parentName, subOrganization, folderNames) {
        var names = folderNames || {};
        var videoName = names.video || 'Video';
        var audioName = names.audio || 'Audio';
        var imageName = names.image || 'Images';
        var sequenceName = names.sequence || 'Sequences';
        var solidName = names.solid || '[ Solids & Nulls ]';

        var folders = {
            parent: null,
            video: null,
            audio: null,
            image: null,
            sequence: null,
            solid: null,
            subOrganization: subOrganization || 'type'
        };

        if (!app.project) {
            return folders;
        }

        try {
            var parentResult = this.createFolder({ name: parentName });

            if (parentResult.id) {
                folders.parent = this.findFolderById(parentResult.id);

                folders.video = this.createFolderInParent(videoName, folders.parent);
                folders.audio = this.createFolderInParent(audioName, folders.parent);
                folders.image = this.createFolderInParent(imageName, folders.parent);
                folders.sequence = this.createFolderInParent(sequenceName, folders.parent);
                folders.solid = this.createFolderInParent(solidName, folders.parent);
            }
        } catch (e) {
            MediaFlow.Utils.log('Error creating smart organize folders: ' + e.message);
        }

        return folders;
    },

    /**
     * Get or create a subfolder within a specific parent folder by name
     * @param {FolderItem} parentFolder
     * @param {string} folderName
     * @returns {FolderItem|null}
     */
    getOrCreateSubFolder: function (parentFolder, folderName) {
        if (!parentFolder) return null;

        var existing = this.findFolderByName(folderName, parentFolder);
        if (existing) {
            return existing;
        }

        try {
            return parentFolder.items.addFolder(folderName);
        } catch (e) {
            MediaFlow.Utils.log('Error creating subfolder ' + folderName + ': ' + e.message);
            return parentFolder;
        }
    },

    /**
     * Create folder inside parent
     * @param {string} name
     * @param {FolderItem} parent
     * @returns {FolderItem|null}
     */
    createFolderInParent: function (name, parent) {
        if (!parent) return null;

        try {
            var existing = this.findFolderByName(name, parent);
            if (existing) return existing;

            return parent.items.addFolder(name);
        } catch (e) {
            MediaFlow.Utils.log('Error creating folder ' + name + ': ' + e.message);
            return null;
        }
    },

    /**
     * Find folder by ID
     * @param {number} id
     * @returns {FolderItem|null}
     */
    findFolderById: function (id) {
        for (var i = 1, len = app.project.items.length; i <= len; i++) {
            var item = app.project.items[i];

            if (item.id === id) {
                return item;
            }
        }

        return null;
    },

    /**
     * Get or create folder by path
     * @param {string} path - Path like "Parent/Child/Folder"
     * @returns {FolderItem|null}
     */
    getOrCreateFolderByPath: function (path) {
        if (!app.project) return null;

        var parts = path.split('/');
        var currentFolder = null;

        for (var i = 0; i < parts.length; i++) {
            var folderName = parts[i];
            var existingFolder = this.findFolderByName(folderName, currentFolder);

            if (existingFolder) {
                currentFolder = existingFolder;
            } else {
                if (currentFolder) {
                    currentFolder = currentFolder.items.addFolder(folderName);
                } else {
                    currentFolder = app.project.items.addFolder(folderName);
                }
            }
        }

        return currentFolder;
    },

    /**
     * Move item to folder
     * @param {Item} item
     * @param {FolderItem} folder
     */
    moveItemToFolder: function (item, folder) {
        if (!item || !folder) return;

        try {
            item.parentFolder = folder;
        } catch (e) {
            MediaFlow.Utils.log('Error moving item to folder: ' + e.message);
        }
    },

    /**
     * Get appropriate folder for file type
     * @param {string} fileType
     * @param {object} folders
     * @returns {FolderItem|null}
     */
    getFolderForType: function (fileType, folders) {
        switch (fileType) {
            case 'video': return folders.video;
            case 'audio': return folders.audio;
            case 'image': return folders.image;
            case 'sequence': return folders.sequence;
            case 'solid': return folders.solid;
            default: return folders.parent;
        }
    },

    /**
     * Clean up empty folders
     * @param {FolderItem} folder
     */
    removeEmptyFolder: function (folder) {
        if (!folder || folder.items.length > 0) return;

        try {
            folder.remove();
        } catch (e) {
            MediaFlow.Utils.log('Error removing empty folder: ' + e.message);
        }
    },

    /**
     * Clean up all empty folders in parent recursively
     * @param {FolderItem} parent
     */
    cleanupEmptyFolders: function (parent) {
        if (!parent || !(parent instanceof FolderItem)) return;

        var toRemove = [];

        for (var i = 1; i <= parent.numItems; i++) {
            var item = parent.item(i);
            
            if (item instanceof FolderItem) {
                // Recursively clean sub-folders first
                this.cleanupEmptyFolders(item);
                
                // If it is now empty, flag it for removal
                if (item.numItems === 0) {
                    toRemove.push(item);
                }
            }
        }

        // Perform safe removal in reverse to avoid index shifting problems
        for (var j = toRemove.length - 1; j >= 0; j--) {
            try {
                toRemove[j].remove();
            } catch (e) {
                MediaFlow.Utils.log('Error removing empty folder: ' + e.message);
            }
        }
    }
};

