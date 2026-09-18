// ==========================================================================
// IMRESS - Application State & Core Utilities
// Module: app-state.js
// Manages global DOM references, reactive state, formatting, and file persistence.
// ==========================================================================

// DOM Elements - Dropzone & Staging
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadEmptyState = document.getElementById('uploadEmptyState');
const scanningState = document.getElementById('scanningState');
const scanStatusText = document.getElementById('scanStatusText');
const scanProgressText = document.getElementById('scanProgressText');
const circularBarCircle = document.getElementById('circularBarCircle');
const circularPercent = document.getElementById('circularPercent');

const stagedContainer = document.getElementById('stagedContainer');
const stagedCountBadge = document.getElementById('stagedCountBadge');
const stagedTotalSizeText = document.getElementById('stagedTotalSizeText');
const stagedGrid = document.getElementById('stagedGrid');
const stagedGridScroll = document.getElementById('stagedGridScroll');
const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
const clearStagedBtn = document.getElementById('clearStagedBtn');

// DOM Elements - Live Compressing Circular Progress State
const compressingState = document.getElementById('compressingState');
const compressCircularBar = document.getElementById('compressCircularBar');
const compressCircularPercent = document.getElementById('compressCircularPercent');
const compressingTitle = document.getElementById('compressingTitle');
const compressingStatusText = document.getElementById('compressingStatusText');

// DOM Elements - Completion "Download All" State inside Dropzone
const completionState = document.getElementById('completionState');
const completionFilesCount = document.getElementById('completionFilesCount');
const completionSavedText = document.getElementById('completionSavedText');
const completionPercentBadge = document.getElementById('completionPercentBadge');
const completionTotalImages = document.getElementById('completionTotalImages');
const completionFinalSize = document.getElementById('completionFinalSize');
const completionDownloadZipBtn = document.getElementById('completionDownloadZipBtn');
const completionZipBtnText = document.getElementById('completionZipBtnText');
const completionUploadMoreBtn = document.getElementById('completionUploadMoreBtn');
const completionClearBtn = document.getElementById('completionClearBtn');
const completionCloseBtn = document.getElementById('completionCloseBtn');

// DOM Elements - Compress CTA
const compressActionBar = document.getElementById('compressActionBar');
const startCompressBtn = document.getElementById('startCompressBtn');
const compressBtnText = document.getElementById('compressBtnText');

// DOM Elements - KPI Summary & Results Table
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

// API Base resolution (supports Electron file:// protocol)
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

// Global State Management
let stagedFiles = [];    // [{ id, file, name, size, ext, thumbnailUrl }]
let fileResults = [];    // [{ file, name, originalSize, compressedSize, blobUrl, previewUrl, status }]
let isScanning = false;
let isCompressing = false;

// Format file size into human-readable string
function formatSize(bytes) {
    if (bytes === 0 || !bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(1) + ' KB';
}

// Get uppercase extension without dot
function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toUpperCase() || 'IMG';
}

// Helper to convert blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Save file using Electron native dialog if available, or trigger browser download
async function saveFile(filename, blob) {
    // 1. Electron Desktop API - Fast binary transfer
    if (window.electronAPI && typeof window.electronAPI.saveFile === 'function') {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            const res = await window.electronAPI.saveFile(filename, uint8);
            if (res && res.success) {
                console.log('Saved successfully via Electron to:', res.filePath);
                return true;
            }
            if (res && res.cancelled) {
                console.log('User cancelled save dialog');
                return false;
            }
        } catch (err) {
            console.warn('Fast Electron binary save failed, trying base64 fallback:', err);
            try {
                const base64data = await blobToBase64(blob);
                const res = await window.electronAPI.saveFile(filename, base64data);
                if (res && res.success) return true;
                if (res && res.cancelled) return false;
            } catch (b64Err) {
                console.warn('Base64 save failed, falling back to browser download:', b64Err);
            }
        }
    }

    // 1b. PyWebView API (if running under pywebview desktop.py)
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_file === 'function') {
        try {
            const base64data = await blobToBase64(blob);
            const success = await window.pywebview.api.save_file(filename, base64data);
            return !!success;
        } catch (pwErr) {
            console.warn('PyWebView save failed:', pwErr);
        }
    }

    // 2. Standard Web Browser anchor download
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        console.error('Browser save failed:', e);
        return false;
    }
}

// Built-in Startup Loading Page (Initial App Launch Only - Exactly 4 Seconds)
function initAppLoadingPage() {
    const loadingPage = document.getElementById('appLoadingPage');
    const loadingFill = document.getElementById('loadingBarFill');
    const loadingPercent = document.getElementById('loadingPercentText');
    const loadingStatus = document.getElementById('loadingStatusText');

    if (!loadingPage || !loadingFill) return;

    const DURATION_MS = 4000;
    const startTime = performance.now();

    function updateProgress(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(Math.max(elapsed / DURATION_MS, 0), 1);
        const percent = Math.floor(progress * 100);

        loadingFill.style.width = `${(progress * 100).toFixed(1)}%`;
        if (loadingPercent) {
            loadingPercent.textContent = `${percent}%`;
        }

        if (loadingStatus) {
            if (progress < 0.25) {
                loadingStatus.textContent = 'Starting Imress Engine...';
            } else if (progress < 0.52) {
                loadingStatus.textContent = 'Loading compression modules...';
            } else if (progress < 0.78) {
                loadingStatus.textContent = 'Optimizing workspace...';
            } else if (progress < 0.95) {
                loadingStatus.textContent = 'Finalizing setup...';
            } else {
                loadingStatus.textContent = 'Ready!';
            }
        }

        if (progress < 1) {
            requestAnimationFrame(updateProgress);
        } else {
            // Reached 100% at 4 seconds
            loadingFill.style.width = '100%';
            if (loadingPercent) loadingPercent.textContent = '100%';
            if (loadingStatus) loadingStatus.textContent = 'Ready!';

            // Elegant brief hold (120ms) then smooth fade out
            setTimeout(() => {
                loadingPage.classList.add('fade-out');
                setTimeout(() => {
                    loadingPage.style.display = 'none';
                }, 600);
            }, 120);
        }
    }

    requestAnimationFrame(updateProgress);
}

// Start loading animation on app startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppLoadingPage);
} else {
    initAppLoadingPage();
}
