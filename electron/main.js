const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
let backendProcess = null;
let embeddedServer = null;

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

    // 1. Primary: Start the high-performance bundled Node.js + Sharp backend directly
    try {
        console.log('[Electron] Starting bundled Node.js Sharp backend on http://127.0.0.1:5000...');
        const { startServer } = require('../backend/server.js');
        embeddedServer = await startServer(5000);
        console.log('[Electron] Bundled backend is active and ready on port 5000');
        return;
    } catch (nodeErr) {
        console.warn('[Electron] Bundled Node backend failed to start, trying Python fallback:', nodeErr);
    }

    // 2. Fallback: If bundled Node server failed, attempt Python
    try {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const mainPyPath = path.join(__dirname, '..', 'backend', 'main.py');

        backendProcess = spawn(pythonCmd, [mainPyPath], {
            cwd: path.join(__dirname, '..'),
            stdio: 'ignore',
            windowsHide: true
        });

        backendProcess.on('error', (err) => {
            console.error('[Electron] Python fallback error:', err);
        });

        for (let i = 0; i < 20; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (await isBackendRunning()) {
                console.log('[Electron] Python fallback backend is ready on http://127.0.0.1:5000');
                break;
            }
        }
    } catch (pyErr) {
        console.error('[Electron] Could not launch Python fallback:', pyErr);
    }
}

function killBackendProcess() {
    if (embeddedServer) {
        try {
            embeddedServer.close();
            console.log('[Electron] Closed embedded backend server');
        } catch (err) {}
        embeddedServer = null;
    }

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
        width: 1200,
        height: 850,
        minWidth: 760,
        minHeight: 620,
        title: 'Imress - Image Compressor',
        icon: process.platform === 'win32'
            ? path.join(__dirname, '..', 'frontend', 'static', 'images', 'icon.ico')
            : path.join(__dirname, '..', 'frontend', 'static', 'images', 'logo.png'),
        backgroundColor: '#fbfbfd',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true
        }
    });

    // Ensure window always opens maximized/full screen on every launch, in dev and after build
    mainWindow.maximize();

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
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
