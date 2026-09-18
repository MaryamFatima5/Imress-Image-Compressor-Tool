// ==========================================================================
// IMRESS - Frontend Application Logic
// Supports both Electron Desktop & Web Browser modes
// ==========================================================================

const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');

const summaryBanner = document.getElementById('summaryBanner');
const progressCircle = document.getElementById('progressCircle');
const progressPercent = document.getElementById('progressPercent');
const totalFilesText = document.getElementById('totalFilesText');
const totalSaved = document.getElementById('totalSaved');
const totalOriginal = document.getElementById('totalOriginal');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const zipBtnText = document.getElementById('zipBtnText');
const clearAllBtn = document.getElementById('clearAllBtn');

const tableWrapper = document.getElementById('tableWrapper');
const tableBody = document.getElementById('tableBody');
const headerFileCount = document.getElementById('headerFileCount');
const footerFileCount = document.getElementById('footerFileCount');
const footerErrorCount = document.getElementById('footerErrorCount');
const footerOriginal = document.getElementById('footerOriginal');
const footerGain = document.getElementById('footerGain');

// API Base resolution (crucial for Electron file:// protocol)
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

let selectedFiles = [];
let fileResults = [];

// Trigger file input on dropzone click
uploadBox.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
    fileInput.value = '';
});

// Drag & Drop interactions
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(Array.from(e.dataTransfer.files));
    }
});

// Clear All functionality
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        // Clean up created object URLs
        fileResults.forEach(item => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
        });
        selectedFiles = [];
        fileResults = [];
        tableBody.innerHTML = '';
        tableWrapper.style.display = 'none';
        summaryBanner.style.display = 'none';
    });
}

function formatSize(bytes) {
    if (bytes === 0 || !bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(1) + ' KB';
}

function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toUpperCase() || 'IMG';
}

async function handleFiles(files) {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const imageFiles = files.filter(f => {
        const lowerName = f.name.toLowerCase();
        return f.type.startsWith('image/') || validExtensions.some(ext => lowerName.endsWith(ext));
    });

    if (imageFiles.length === 0) {
        alert('Please select valid image files (JPG, PNG, WEBP).');
        return;
    }

    const startIndex = fileResults.length;
    selectedFiles = selectedFiles.concat(imageFiles);

    const newResults = imageFiles.map(file => ({
        file: file,
        name: file.name,
        originalSize: file.size,
        compressedSize: 0,
        blobUrl: null,
        previewUrl: URL.createObjectURL(file),
        status: 'pending' // pending | compressing | complete | error
    }));

    fileResults = fileResults.concat(newResults);

    tableWrapper.style.display = 'flex';
    summaryBanner.style.display = 'block';

    renderTable();
    updateSummary();

    // Sequentially or concurrently process images
    for (let i = startIndex; i < fileResults.length; i++) {
        fileResults[i].status = 'compressing';
        renderTable();

        try {
            const compressedBlob = await compressOne(imageFiles[i - startIndex]);
            fileResults[i].compressedSize = compressedBlob.size;
            fileResults[i].blobUrl = URL.createObjectURL(compressedBlob);
            fileResults[i].status = 'complete';
        } catch (err) {
            console.error('Compression error for', fileResults[i].name, err);
            fileResults[i].status = 'error';
        }

        renderTable();
        updateSummary();
    }
}

async function compressOne(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/compress`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    return await response.blob();
}

function renderTable() {
    tableBody.innerHTML = '';
    headerFileCount.textContent = fileResults.length;

    fileResults.forEach((item, index) => {
        const row = document.createElement('tr');

        // Status Badge
        let statusHTML = '';
        if (item.status === 'pending') {
            statusHTML = `<span class="status-pill pending">⏳ Queued</span>`;
        } else if (item.status === 'compressing') {
            statusHTML = `<span class="status-pill compressing"><span class="spinner-icon"></span> Compressing...</span>`;
        } else if (item.status === 'complete') {
            statusHTML = `<span class="status-pill complete">✓ Ready</span>`;
        } else if (item.status === 'error') {
            statusHTML = `<span class="status-pill error">✕ Failed</span>`;
        }

        const originalText = formatSize(item.originalSize);
        const optimizedText = item.compressedSize ? formatSize(item.compressedSize) : '—';

        // Reduction %
        let percentHTML = '—';
        if (item.compressedSize && item.originalSize > 0) {
            const diff = item.originalSize - item.compressedSize;
            const percent = ((diff / item.originalSize) * 100).toFixed(1);
            if (diff > 0) {
                percentHTML = `<span class="reduction-badge">-${percent}%</span>`;
            } else {
                percentHTML = `<span class="reduction-badge" style="background:#f3f4f6; color:#6b7280; border:none;">0%</span>`;
            }
        }

        // Action / Download
        let actionHTML = '—';
        if (item.status === 'complete') {
            actionHTML = `
                <button class="btn-action-download" onclick="downloadSingleFile(${index})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Download</span>
                </button>
            `;
        }

        const ext = getFileExtension(item.name);

        row.innerHTML = `
            <td>
                <div class="file-cell">
                    <img src="${item.previewUrl}" alt="Preview" class="file-thumbnail" onerror="this.src='static/images/logo.png'">
                    <div class="file-info">
                        <span class="file-name-text" title="${item.name}">${item.name}</span>
                        <span class="file-ext-tag">${ext} FORMAT</span>
                    </div>
                </div>
            </td>
            <td>${statusHTML}</td>
            <td><strong>${originalText}</strong></td>
            <td><strong>${optimizedText}</strong></td>
            <td>${percentHTML}</td>
            <td style="text-align: right;">${actionHTML}</td>
        `;

        tableBody.appendChild(row);
    });
}

function updateSummary() {
    const completed = fileResults.filter(f => f.status === 'complete');
    const errors = fileResults.filter(f => f.status === 'error');

    const totalOrig = fileResults.reduce((sum, f) => sum + f.originalSize, 0);
    const totalComp = completed.reduce((sum, f) => sum + f.compressedSize, 0);
    const completedOrig = completed.reduce((sum, f) => sum + f.originalSize, 0);
    const totalGain = Math.max(0, completedOrig - totalComp);

    const overallPercent = completedOrig > 0 ? ((totalGain / completedOrig) * 100).toFixed(0) : 0;

    // Progress circle fill
    progressCircle.style.setProperty('--percent', overallPercent + '%');
    progressPercent.textContent = overallPercent + '%';

    totalFilesText.textContent = completed.length;
    totalSaved.textContent = formatSize(totalGain);
    totalOriginal.textContent = formatSize(totalOrig);

    footerFileCount.textContent = fileResults.length;
    footerErrorCount.textContent = errors.length;
    footerOriginal.textContent = formatSize(totalOrig);
    footerGain.textContent = formatSize(totalGain);
}

async function downloadSingleFile(index) {
    const item = fileResults[index];
    if (!item || !item.blobUrl) return;

    const response = await fetch(item.blobUrl);
    const blob = await response.blob();
    await saveFile(item.name, blob);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Universal save function that works in Electron, pywebview, or standard browser
 */
async function saveFile(filename, blob) {
    // 1. Electron Desktop API
    if (window.electronAPI && typeof window.electronAPI.saveFile === 'function') {
        try {
            const base64data = await blobToBase64(blob);
            const res = await window.electronAPI.saveFile(filename, base64data);
            if (res && res.success) {
                console.log('Saved successfully via Electron to:', res.filePath);
                return;
            }
            if (res && res.cancelled) {
                console.log('User cancelled save');
                return;
            }
        } catch (err) {
            console.warn('Electron save dialog failed, falling back to browser download:', err);
        }
    }

    // 2. Pywebview legacy API
    if (window.pywebview && window.pywebview.api) {
        try {
            const base64data = await blobToBase64(blob);
            const success = await window.pywebview.api.save_file(filename, base64data);
            if (success) return;
        } catch (err) {
            console.warn('Pywebview save failed:', err);
        }
    }

    // 3. Standard Web Browser anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Batch ZIP download button
downloadZipBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    const origText = zipBtnText.textContent;
    zipBtnText.textContent = 'Generating ZIP Archive...';
    downloadZipBtn.disabled = true;

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch(`${API_BASE}/compress-zip`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        await saveFile('compressed_images.zip', blob);

    } catch (err) {
        alert('Failed to generate ZIP: ' + err.message + '\nMake sure the backend server is running on http://localhost:5000');
    } finally {
        zipBtnText.textContent = origText;
        downloadZipBtn.disabled = false;
    }
});