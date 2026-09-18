const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
let backendProcess = null;

function isBackendRunning() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:5000/health', (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(800, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function startBackendIfNeeded() {
    const running = await isBackendRunning();
    if (running) {
        console.log('[Electron] Backend is already running on http://127.0.0.1:5000');
        return;
    }

    console.log('[Electron] Auto-starting Python backend server...');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const mainPyPath = path.join(__dirname, '..', 'backend', 'main.py');

    backendProcess = spawn(pythonCmd, [mainPyPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore',
        windowsHide: true
    });

    backendProcess.on('error', (err) => {
        console.error('[Electron] Failed to spawn Python backend:', err);
    });

    // Wait up to 10 seconds for backend server to become ready
    for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await isBackendRunning()) {
            console.log('[Electron] Python backend is ready on http://127.0.0.1:5000');
            break;
        }
    }
}

function killBackendProcess() {
    if (backendProcess && backendProcess.pid) {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /pid ${backendProcess.pid} /T /F`);
            } else {
                backendProcess.kill('SIGTERM');
            }
        } catch (err) {
            // Process may already have exited
        }
        backendProcess = null;
    }
}

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
ipcMain.handle('save-file', async (event, { filename, data, base64data }) => {
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

        let buffer;
        const raw = data !== undefined ? data : base64data;
        if (Buffer.isBuffer(raw)) {
            buffer = raw;
        } else if (raw instanceof Uint8Array || (raw && raw.buffer)) {
            buffer = Buffer.from(raw.buffer || raw);
        } else if (typeof raw === 'string') {
            let cleanData = raw;
            if (cleanData.includes(',')) {
                cleanData = cleanData.split(',')[1];
            }
            buffer = Buffer.from(cleanData, 'base64');
        } else {
            throw new Error('No valid file data provided');
        }

        await fs.promises.writeFile(filePath, buffer);

        return { success: true, filePath };
    } catch (err) {
        console.error('Error saving file:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(async () => {
    await startBackendIfNeeded();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    killBackendProcess();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    killBackendProcess();
});
