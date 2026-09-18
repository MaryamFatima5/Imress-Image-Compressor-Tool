const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1020,
        height: 800,
        minWidth: 760,
        minHeight: 620,
        title: 'Imress - Image Compressor',
        icon: path.join(__dirname, '..', 'frontend', 'static', 'images', 'logo.png'),
        backgroundColor: '#fbfbfd',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true
        }
    });

    const indexHtmlPath = path.join(__dirname, '..', 'frontend', 'index.html');
    mainWindow.loadFile(indexHtmlPath);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC handler for native Save Dialog
ipcMain.handle('save-file', async (event, { filename, base64data }) => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    try {
        const ext = path.extname(filename).toLowerCase().replace('.', '');
        const filterMap = {
            zip: [{ name: 'ZIP Archive (*.zip)', extensions: ['zip'] }],
            jpg: [{ name: 'JPEG Image (*.jpg; *.jpeg)', extensions: ['jpg', 'jpeg'] }],
            jpeg: [{ name: 'JPEG Image (*.jpg; *.jpeg)', extensions: ['jpg', 'jpeg'] }],
            png: [{ name: 'PNG Image (*.png)', extensions: ['png'] }],
            webp: [{ name: 'WEBP Image (*.webp)', extensions: ['webp'] }]
        };

        const filters = filterMap[ext] || [{ name: 'All Files (*.*)', extensions: ['*'] }];

        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Compressed File',
            defaultPath: filename,
            filters: filters
        });

        if (canceled || !filePath) {
            return { success: false, cancelled: true };
        }

        // Clean base64 data if it contains a data URL prefix
        let cleanData = base64data;
        if (cleanData.includes(',')) {
            cleanData = cleanData.split(',')[1];
        }

        const buffer = Buffer.from(cleanData, 'base64');
        await fs.promises.writeFile(filePath, buffer);

        return { success: true, filePath };
    } catch (err) {
        console.error('Error saving file:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
