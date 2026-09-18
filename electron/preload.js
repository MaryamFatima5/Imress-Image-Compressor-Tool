const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    saveFile: (filename, base64data) => ipcRenderer.invoke('save-file', { filename, base64data })
});
