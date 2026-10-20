const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    saveFile: (filename, data) => ipcRenderer.invoke('save-file', { 
        filename, 
        data: data instanceof Uint8Array ? data : (typeof data === 'string' ? data : new Uint8Array(data))
    })
});
