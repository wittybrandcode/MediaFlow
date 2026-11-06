// Debug loader to isolate syntax errors

var debugFile = new File($.fileName);
var dir = debugFile.parent.fsName.replace(/\\/g, '/');

var filesToLoad = [
    "json2.jsx",
    "utils.jsx",
    "folder-manager.jsx",
    "sequence-handler.jsx",
    "media-importer.jsx",
    "auto-organizer.jsx",
    "comp-organizer.jsx",
    "smart-actions.jsx",
    "comp-tree.jsx"
];

for (var i = 0; i < filesToLoad.length; i++) {
    var file = new File(dir + "/" + filesToLoad[i]);
    if (file.exists) {
        try {
            $.evalFile(file);
        } catch (e) {
            alert("MediaFlow Debug: Syntax or execution error in file: " + filesToLoad[i] + "\nLine: " + e.line + "\nMessage: " + e.message);
        }
    } else {
        alert("MediaFlow Debug: File not found: " + filesToLoad[i]);
    }
}

// Minimal handleRequest just in case
function handleRequest(jsonRequest) {
    return '{"success":false,"error":{"message":"Debug mode active"}}';
}
