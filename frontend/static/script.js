const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');

const summaryBanner = document.getElementById('summaryBanner');
const progressCircle = document.getElementById('progressCircle');
const progressPercent = document.getElementById('progressPercent');
const totalFilesText = document.getElementById('totalFilesText');
const totalSaved = document.getElementById('totalSaved');
const totalOriginal = document.getElementById('totalOriginal');
const downloadZipBtn = document.getElementById('downloadZipBtn');

const tableWrapper = document.getElementById('tableWrapper');
const tableBody = document.getElementById('tableBody');
const footerFileCount = document.getElementById('footerFileCount');
const footerErrorCount = document.getElementById('footerErrorCount');
const footerOriginal = document.getElementById('footerOriginal');
const footerGain = document.getElementById('footerGain');

let selectedFiles = [];
let fileResults = [];

// Box pe click karne se file selector khulay
uploadBox.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
    fileInput.value = '';
});

// Drag & Drop
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
    handleFiles(Array.from(e.dataTransfer.files));
});

function formatSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
    }
    return (bytes / 1024).toFixed(1) + 'KB';
}

async function handleFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        alert('Please select image files only (JPG, PNG, WEBP)');
        return;
    }

    const startIndex = fileResults.length;

    selectedFiles = selectedFiles.concat(imageFiles);

    const newResults = imageFiles.map(f => ({
        name: f.name,
        originalSize: f.size,
        compressedSize: 0,
        blobUrl: null,
        status: 'pending'
    }));

    fileResults = fileResults.concat(newResults);

    tableWrapper.style.display = 'block';
    summaryBanner.style.display = 'flex';

    renderTable();
    updateSummary();

    for (let i = startIndex; i < fileResults.length; i++) {
        fileResults[i].status = 'compressing';
        renderTable();

        try {
            const compressedBlob = await compressOne(imageFiles[i - startIndex]);
            fileResults[i].compressedSize = compressedBlob.size;
            fileResults[i].blobUrl = URL.createObjectURL(compressedBlob);
            fileResults[i].status = 'complete';
        } catch (err) {
            fileResults[i].status = 'error';
        }

        renderTable();
        updateSummary();
    }
}

async function compressOne(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/compress', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Compression failed');
    }

    return await response.blob();
}

function renderTable() {
    tableBody.innerHTML = '';

    fileResults.forEach((item, index) => {
        const row = document.createElement('tr');

        let statusHTML = '';
        if (item.status === 'pending') {
            statusHTML = `<span class="status-pending">⏳ Pending</span>`;
        } else if (item.status === 'compressing') {
            statusHTML = `<span class="status-pending"><span class="spinner"></span>Compressing...</span>`;
        } else if (item.status === 'complete') {
            statusHTML = `<span class="status-complete">✅ Complete</span>`;
        } else if (item.status === 'error') {
            statusHTML = `<span class="status-error">❌ Error</span>`;
        }

        const originalText = formatSize(item.originalSize);
        const optimizedText = item.compressedSize ? formatSize(item.compressedSize) : '-';

        let percentText = '-';
        if (item.compressedSize) {
            const percent = (((item.originalSize - item.compressedSize) / item.originalSize) * 100).toFixed(1);
            percentText = `<span class="percentage-text">${percent}%</span>`;
        }

        let downloadHTML = '-';
        if (item.status === 'complete') {
            downloadHTML = `<a class="download-link" href="javascript:void(0)" onclick="downloadSingleFile(${index})">⬇️ Download</a>`;
        }

        row.innerHTML = `
            <td>
                <div class="file-name-cell">
                    <span class="filename-text">${item.name}</span>
                </div>
            </td>
            <td>${statusHTML}</td>
            <td>${originalText}</td>
            <td>${optimizedText}</td>
            <td>${percentText}</td>
            <td>${downloadHTML}</td>
        `;

        tableBody.appendChild(row);
    });
}

function updateSummary() {
    const completed = fileResults.filter(f => f.status === 'complete');
    const errors = fileResults.filter(f => f.status === 'error');

    const totalOrig = fileResults.reduce((sum, f) => sum + f.originalSize, 0);
    const totalGain = completed.reduce((sum, f) => sum + (f.originalSize - f.compressedSize), 0);

    const overallPercent = totalOrig > 0 ? ((totalGain / totalOrig) * 100).toFixed(0) : 0;

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

async function saveFile(filename, blob) {
    const base64data = await blobToBase64(blob);

    if (window.pywebview && window.pywebview.api) {
        const success = await window.pywebview.api.save_file(filename, base64data);
        if (!success) {
            console.log('Save cancelled or failed');
        }
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ZIP download button
downloadZipBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    downloadZipBtn.textContent = '⏳ Preparing ZIP...';
    downloadZipBtn.disabled = true;

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch('/compress-zip', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('ZIP creation failed');
        }

        const blob = await response.blob();
        await saveFile('compressed_images.zip', blob);

    } catch (err) {
        alert('Something went wrong: ' + err.message);
    } finally {
        downloadZipBtn.textContent = '📦 Download All as ZIP';
        downloadZipBtn.disabled = false;
    }
});