// ==========================================================================
// IMRESS - Professional Image Compressor Logic
// Supports: Staged Drop Zone, Offline Downscaled Previews, 
// Radar Circle Scanning Animation, Smooth 60fps Scrolling, 
// Electron Native Save & Web Browser Mode
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

// State Management
let stagedFiles = [];    // [{ id, file, name, size, ext, thumbnailUrl }]
let fileResults = [];    // [{ file, name, originalSize, compressedSize, blobUrl, previewUrl, status }]
let isScanning = false;
let isCompressing = false;

// Format file size
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

// ==========================================================================
// File Staging & Offline Thumbnail Generation (No Auto-Start)
// ==========================================================================

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const imageFiles = files.filter(f => {
        const lowerName = f.name.toLowerCase();
        return f.type.startsWith('image/') || validExtensions.some(ext => lowerName.endsWith(ext));
    });

    if (imageFiles.length === 0) {
        alert('Please select valid image files (.jpg, .jpeg, .png, .webp).');
        return;
    }

    // Activate circular bar progress animation
    showScanningState(imageFiles.length);

    try {
        // Use offline thumbnailer library with concurrency & live progress
        const batchResults = await window.imressThumbnailer.generateBatch(imageFiles, (loaded, total) => {
            const pct = Math.round((loaded / total) * 100);
            scanStatusText.textContent = `Scanning image ${loaded} of ${total}...`;

            // Update circular bar progress
            if (circularBarCircle) {
                const circumference = 264;
                const offset = circumference - (circumference * pct / 100);
                circularBarCircle.style.strokeDashoffset = offset;
            }
            if (circularPercent) {
                circularPercent.textContent = `${pct}%`;
            }
        });

        // Add to staged queue
        batchResults.forEach(item => {
            const file = item.file;
            stagedFiles.push({
                id: 'img_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
                file: file,
                name: file.name,
                size: file.size,
                ext: getFileExtension(file.name),
                thumbnailUrl: item.thumbnailUrl
            });
        });

    } catch (err) {
        console.error('Error generating thumbnails:', err);
    } finally {
        // Smoothly fade out circular bar animation once all images are loaded
        hideScanningState();
        renderStagedState();
    }
}

function showScanningState(fileCount) {
    isScanning = true;
    uploadEmptyState.style.display = 'none';
    stagedContainer.style.display = 'none';
    if (compressingState) compressingState.style.display = 'none';
    if (completionState) completionState.style.display = 'none';
    scanningState.style.display = 'flex';
    scanStatusText.textContent = `Scanning image 0 of ${fileCount}...`;

    // Reset circular bar ring
    if (circularBarCircle) {
        circularBarCircle.style.strokeDashoffset = '264';
    }
    if (circularPercent) {
        circularPercent.textContent = '0%';
    }

    uploadBox.classList.remove('has-completed');
    uploadBox.classList.add('has-staged');
}

function hideScanningState() {
    isScanning = false;
    scanningState.style.display = 'none';
}

function updateHeaderAddButtonVisibility() {
    const gridScroll = document.getElementById('stagedGridScroll');
    if (!gridScroll || !addMoreFilesBtn) return;
    // Add More in drop zone header appears ONLY when images require a scrollbar
    const needsScroll = (gridScroll.scrollHeight > gridScroll.clientHeight + 10) || (stagedFiles.length >= 7);
    addMoreFilesBtn.style.display = needsScroll ? 'inline-flex' : 'none';
}

function renderStagedState() {
    if (stagedFiles.length === 0) {
        // Return to clean empty state only if not actively compressing
        if (!isCompressing) {
            uploadEmptyState.style.display = 'flex';
            if (compressingState) compressingState.style.display = 'none';
            if (completionState) completionState.style.display = 'none';
            uploadBox.classList.remove('has-staged', 'has-completed');
        }
        stagedContainer.style.display = 'none';
        compressActionBar.style.display = 'none';
        if (addMoreFilesBtn) addMoreFilesBtn.style.display = 'none';
        return;
    }

    uploadEmptyState.style.display = 'none';
    if (compressingState) compressingState.style.display = 'none';
    if (completionState) completionState.style.display = 'none';
    stagedContainer.style.display = 'flex';
    compressActionBar.style.display = 'flex';
    uploadBox.classList.remove('has-completed');
    uploadBox.classList.add('has-staged');

    // Update staged toolbar
    const totalBytes = stagedFiles.reduce((sum, item) => sum + item.size, 0);
    stagedCountBadge.textContent = `${stagedFiles.length} Image${stagedFiles.length > 1 ? 's' : ''}`;
    stagedTotalSizeText.textContent = `Total: ${formatSize(totalBytes)}`;

    // Update Compress button CTA
    compressBtnText.textContent = `Compress All (${stagedFiles.length} Images)`;

    // Render preview cards in scrollable grid
    renderStagedGrid();

    // Ensure inner drop zone scroll always starts from row 1 (the very first row)
    const gridScroll = document.getElementById('stagedGridScroll');
    if (gridScroll) {
        gridScroll.scrollTop = 0;
    }

    // Check if scrollbar is active and toggle header add button + auto-scroll
    setTimeout(() => {
        updateHeaderAddButtonVisibility();
        const currentGridScroll = document.getElementById('stagedGridScroll');
        if (currentGridScroll) {
            currentGridScroll.scrollTop = 0; // Strictly ensure starting from row 1
        }

        // Smoothly auto-scroll the UI so the drop zone starts right from row 1 with Compress button below
        uploadBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
}

function renderStagedGrid() {
    stagedGrid.innerHTML = '';

    // 1. Render all staged image cards with thumbnails and cross icons
    stagedFiles.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'staged-card';
        card.setAttribute('data-id', item.id);

        card.innerHTML = `
            <button type="button" class="staged-remove-btn" title="Remove image" aria-label="Remove image">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="staged-thumb-wrapper">
                <img src="${item.thumbnailUrl}" alt="${item.name}" class="staged-thumb-img" loading="lazy">
            </div>
            <div class="staged-meta">
                <span class="staged-name" title="${item.name}">${item.name}</span>
                <span class="staged-size-badge">${formatSize(item.size)}</span>
            </div>
        `;

        // Cross icon click handler (scoped with stopPropagation)
        const removeBtn = card.querySelector('.staged-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeStagedFile(item.id);
        });

        stagedGrid.appendChild(card);
    });

    // 2. Add Dotted Thumbnail Frame at the end of the image list
    const addCard = document.createElement('div');
    addCard.className = 'staged-card staged-card-add';
    addCard.id = 'addThumbnailCard';
    addCard.title = 'Add more images';
    addCard.innerHTML = `
        <div class="staged-add-inner">
            <div class="staged-add-icon-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </div>
            <span class="staged-add-title">Add Images</span>
            <span class="staged-add-sub">Click to browse</span>
        </div>
    `;

    addCard.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isCompressing) {
            fileInput.click();
        }
    });

    stagedGrid.appendChild(addCard);
}

function removeStagedFile(id) {
    if (isCompressing) return;

    const index = stagedFiles.findIndex(f => f.id === id);
    if (index !== -1) {
        const item = stagedFiles[index];
        // Clean up object URL to free memory
        window.imressThumbnailer.revoke(item.thumbnailUrl);
        stagedFiles.splice(index, 1);
        renderStagedState();
    }
}

function clearStagedQueue() {
    if (isCompressing) return;

    stagedFiles.forEach(item => {
        window.imressThumbnailer.revoke(item.thumbnailUrl);
    });
    stagedFiles = [];
    renderStagedState();
}

// ==========================================================================
// Dropzone & File Input Events
// ==========================================================================

// Click on dropzone opens file picker only if clicking outside scroll/buttons
uploadBox.addEventListener('click', (e) => {
    if (isScanning || isCompressing) return;

    // Do not trigger file picker if clicked on cards, buttons, active compression or completion state
    if (e.target.closest('.staged-container') || e.target.closest('.compress-action-bar') || e.target.closest('.compressing-state') || e.target.closest('.completion-state')) {
        return;
    }
    fileInput.click();
});

// Forward wheel scroll to outer UI when reaching dropzone boundaries
if (stagedGridScroll) {
    stagedGridScroll.addEventListener('wheel', (e) => {
        const isAtBottom = stagedGridScroll.scrollTop + stagedGridScroll.clientHeight >= stagedGridScroll.scrollHeight - 2;
        const isAtTop = stagedGridScroll.scrollTop <= 0;

        if (isAtBottom && e.deltaY > 0) {
            // Reached bottom of drop zone: scroll the outer UI down
            window.scrollBy({
                top: e.deltaY,
                behavior: 'auto'
            });
        } else if (isAtTop && e.deltaY < 0) {
            // Reached top of drop zone: scroll the outer UI up
            window.scrollBy({
                top: e.deltaY,
                behavior: 'auto'
            });
        }
    }, { passive: true });
}

addMoreFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isCompressing) {
        fileInput.click();
    }
});

clearStagedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearStagedQueue();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
    fileInput.value = '';
});

// Drag & Drop interactions
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!isCompressing) {
        uploadBox.classList.add('dragover');
    }
});

uploadBox.addEventListener('dragleave', (e) => {
    uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    if (isCompressing) return;

    if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(Array.from(e.dataTransfer.files));
    }
});

// ==========================================================================
// Professional Smooth Scroll Controller
// Provides silky-smooth cubic-bezier tracking without browser jitter
// ==========================================================================

let activeScrollAnim = null;
let userInteractedWithScroll = false;
let isProgrammaticScrolling = false;

// Once user scrolls up or down (wheel, touch, arrow keys, or scrollbar), stop auto-scrolling permanently
function handleUserManualScroll() {
    userInteractedWithScroll = true;
    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
    }
}

window.addEventListener('wheel', handleUserManualScroll, { passive: true });
window.addEventListener('touchmove', handleUserManualScroll, { passive: true });
window.addEventListener('keydown', (e) => {
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (scrollKeys.includes(e.key)) {
        handleUserManualScroll();
    }
}, { passive: true });

window.addEventListener('scroll', () => {
    // If scroll occurred naturally (not via our step frame), user scrolled manually
    if (!isProgrammaticScrolling && !userInteractedWithScroll) {
        handleUserManualScroll();
    }
}, { passive: true });

function smoothScrollTo(targetY, duration = 650, force = false) {
    if (userInteractedWithScroll && !force) return;

    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
    }

    const startY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clampedTarget = Math.max(0, Math.min(targetY, maxScroll));
    const distance = clampedTarget - startY;

    if (Math.abs(distance) < 2) return;

    const startTime = performance.now();

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function step(currentTime) {
        if (userInteractedWithScroll && !force) {
            activeScrollAnim = null;
            return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutCubic(progress);

        isProgrammaticScrolling = true;
        window.scrollTo(0, startY + (distance * ease));
        requestAnimationFrame(() => {
            isProgrammaticScrolling = false;
        });

        if (progress < 1) {
            activeScrollAnim = requestAnimationFrame(step);
        } else {
            activeScrollAnim = null;
        }
    }

    activeScrollAnim = requestAnimationFrame(step);
}

function scrollToCompressionSection() {
    userInteractedWithScroll = false;
    if (summaryBanner) {
        const bannerRect = summaryBanner.getBoundingClientRect();
        const currentY = window.scrollY || window.pageYOffset;
        // Position summaryBanner right near top of screen with 16px luxury breathing room
        const targetY = currentY + bannerRect.top - 16;
        smoothScrollTo(Math.max(0, targetY), 700, true);
    }
}

function followCompressingRow(idOrIndex) {
    if (userInteractedWithScroll) return;

    let row = document.getElementById(`resultRow-${idOrIndex}`);
    if (!row && typeof idOrIndex === 'number') {
        const item = fileResults[idOrIndex];
        if (item) row = document.getElementById(`resultRow-${item.id}`);
    }
    if (!row) return;

    const rowRect = row.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const currentScrollY = window.scrollY || window.pageYOffset;

    const rowAbsTop = currentScrollY + rowRect.top;

    // Ideal screen line for active row: comfortably below the center (around 52% - 56% of viewport)
    // so previous completed rows and upcoming pending rows are both visible
    const idealScreenY = Math.min(viewportHeight * 0.54, viewportHeight - 140);
    const desiredScrollY = Math.max(0, Math.round(rowAbsTop - idealScreenY));

    // Only scroll downwards as compression proceeds further down
    if (desiredScrollY > currentScrollY + 6) {
        // "slow slow following": 800ms silky glide
        smoothScrollTo(desiredScrollY, 800);
    }
}

// ==========================================================================
// Compression Engine (Triggered ONLY by Compress Button)
// ==========================================================================

startCompressBtn.addEventListener('click', () => {
    if (stagedFiles.length === 0 || isCompressing) return;
    startCompression();
});

async function startCompression() {
    isCompressing = true;
    startCompressBtn.disabled = true;

    const totalToCompress = stagedFiles.length;

    // 1. Hide thumbnails & CTA action bar; reveal circular progress in drop zone
    stagedContainer.style.display = 'none';
    compressActionBar.style.display = 'none';
    uploadEmptyState.style.display = 'none';
    if (completionState) completionState.style.display = 'none';
    uploadBox.classList.remove('has-completed');
    if (compressingState) compressingState.style.display = 'flex';

    // Reset circular bar ring (circumference 264)
    if (compressCircularBar) {
        compressCircularBar.style.strokeDashoffset = '264';
    }
    if (compressCircularPercent) compressCircularPercent.textContent = '0%';
    if (compressingTitle) compressingTitle.textContent = 'Compressing Images...';
    if (compressingStatusText) compressingStatusText.textContent = `Compressing ${totalToCompress} images concurrently...`;

    // Convert staged files into fileResults records with persistent IDs & abort controllers
    const newItems = stagedFiles.map(item => ({
        id: item.id || ('img_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()),
        file: item.file,
        name: item.name,
        originalSize: item.size,
        compressedSize: 0,
        blobUrl: null,
        compressedBlob: null,
        outputName: item.name,
        previewUrl: item.thumbnailUrl,
        status: 'pending',
        abortController: null
    }));

    const startIndex = fileResults.length;
    fileResults = fileResults.concat(newItems);

    tableWrapper.style.display = 'flex';
    summaryBanner.style.display = 'block';

    const summaryTitle = document.getElementById('summaryTitle');
    if (summaryTitle) {
        summaryTitle.textContent = 'Compressing Images...';
    }

    renderTable();
    updateSummary();

    // 1. Instantly auto-scroll UI down to the compression dashboard section
    scrollToCompressionSection();

    // Brief pause so the user smoothly glides down into the view before processing starts
    await new Promise(r => setTimeout(r, 350));

    // Parallel Concurrent Compression Engine (up to 4 concurrent workers)
    async function compressionWorker() {
        while (true) {
            // Find next pending item dynamically (resistant to removals)
            const item = fileResults.find(f => f.status === 'pending');
            if (!item) break;

            item.status = 'compressing';
            const abortController = new AbortController();
            item.abortController = abortController;

            updateTableRow(item.id);
            followCompressingRow(item.id);

            if (compressingStatusText) {
                compressingStatusText.textContent = `Compressing ${item.name}...`;
            }

            try {
                const { blob, outputFilename } = await compressOne(item.file, abortController.signal);
                if (item.status === 'cancelled' || !fileResults.includes(item)) {
                    continue;
                }
                item.compressedBlob = blob;
                item.compressedSize = blob.size;
                item.blobUrl = URL.createObjectURL(blob);
                item.outputName = outputFilename || item.name;
                item.status = 'complete';
            } catch (err) {
                if (err.name === 'AbortError' || item.status === 'cancelled') {
                    // Cancelled by user - move to next item smoothly
                    continue;
                }
                console.error('Compression error for', item.name, err);
                item.status = 'error';
            }

            if (!fileResults.includes(item)) {
                continue;
            }

            const completedCount = fileResults.filter(f => f.status === 'complete').length;
            const totalRemaining = fileResults.length;
            const completedPct = totalRemaining > 0 ? Math.round((completedCount / totalRemaining) * 100) : 100;

            if (compressCircularBar) {
                const circumference = 264;
                const offset = circumference - (circumference * completedPct / 100);
                compressCircularBar.style.strokeDashoffset = offset;
            }
            if (compressCircularPercent) {
                compressCircularPercent.textContent = `${completedPct}%`;
            }
            if (compressingStatusText) {
                compressingStatusText.textContent = `Compressed ${completedCount} of ${totalRemaining} images...`;
            }

            updateTableRow(item.id);
            updateSummary();
        }
    }

    const CONCURRENCY = Math.min(4, Math.max(1, totalToCompress));
    const workerPromises = [];
    for (let w = 0; w < CONCURRENCY; w++) {
        workerPromises.push(compressionWorker());
    }
    await Promise.all(workerPromises);

    // Finished compression
    isCompressing = false;
    startCompressBtn.disabled = false;

    // If user cancelled/removed all files during compression
    if (fileResults.length === 0) {
        resetAllState();
        return;
    }

    if (summaryTitle) {
        summaryTitle.textContent = 'Compression Complete!';
    }
    
    // 1. Loading bar gets disappeared
    if (compressingState) compressingState.style.display = 'none';

    // 2. Compute final statistics for completion window
    const completed = fileResults.filter(f => f.status === 'complete');
    const totalOrig = fileResults.reduce((sum, f) => sum + f.originalSize, 0);
    const totalComp = completed.reduce((sum, f) => sum + f.compressedSize, 0);
    const completedOrig = completed.reduce((sum, f) => sum + f.originalSize, 0);
    const totalGain = Math.max(0, completedOrig - totalComp);
    const overallPercent = completedOrig > 0 ? ((totalGain / completedOrig) * 100).toFixed(0) : 0;

    if (completionFilesCount) completionFilesCount.textContent = completed.length;
    if (completionSavedText) completionSavedText.textContent = formatSize(totalGain);
    if (completionPercentBadge) completionPercentBadge.textContent = `${overallPercent}% SAVED`;
    if (completionTotalImages) completionTotalImages.textContent = `${completed.length} Files`;
    if (completionFinalSize) completionFinalSize.textContent = `${formatSize(totalComp)} (orig ${formatSize(totalOrig)})`;

    // 3. Reveal the Download All window inside the drop zone matching the UI theme
    if (completionState && completed.length > 0) {
        completionState.style.display = 'flex';
        uploadBox.classList.add('has-completed');
        uploadBox.classList.remove('has-staged');

        // Hide the lower redundant summaryBanner so the drop zone remains the clean hero download panel
        if (summaryBanner) summaryBanner.style.display = 'none';

        // 4. Auto scroll UI smoothly to the very top so the user sees the download window immediately
        userInteractedWithScroll = false;
        setTimeout(() => {
            smoothScrollTo(0, 800, true);
        }, 100);
    }

    // Clear staged files queue
    stagedFiles = [];
}

async function compressOne(file, signal) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/compress`, {
        method: 'POST',
        body: formData,
        signal: signal
    });

    if (!response.ok) {
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
    }

    let outputFilename = file.name;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        if (match && match[1]) {
            outputFilename = decodeURIComponent(match[1]);
        }
    }

    const blob = await response.blob();
    return { blob, outputFilename };
}

// ==========================================================================
// Results Table & KPI Summary
// ==========================================================================

function getStatusBadgeHTML(status) {
    if (status === 'pending') {
        return `<span class="status-pill pending">⏳ Queued</span>`;
    } else if (status === 'compressing') {
        return `<span class="status-pill compressing"><span class="spinner-icon"></span> Compressing...</span>`;
    } else if (status === 'complete') {
        return `<span class="status-pill complete">✓ Ready</span>`;
    } else if (status === 'error') {
        return `<span class="status-pill error">✕ Failed</span>`;
    }
    return '';
}

function getReductionBadgeHTML(item) {
    if (item.compressedSize && item.originalSize > 0) {
        const diff = item.originalSize - item.compressedSize;
        const percent = ((diff / item.originalSize) * 100).toFixed(1);
        if (diff > 0) {
            return `<span class="reduction-badge">-${percent}%</span>`;
        } else {
            return `<span class="reduction-badge" style="background:#f3f4f6; color:#6b7280; border:none;">0%</span>`;
        }
    }
    return '—';
}

function getActionHTML(item) {
    if (item.status === 'complete') {
        return `
            <div class="action-buttons-group">
                <button type="button" class="btn-action-download" onclick="downloadSingleFile('${item.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Download</span>
                </button>
                <button type="button" class="btn-action-remove" onclick="removeFileResult('${item.id}')" title="Remove image" aria-label="Remove image">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    } else if (item.status === 'compressing' || item.status === 'pending') {
        return `
            <div class="action-buttons-group">
                <button type="button" class="btn-action-remove" onclick="removeFileResult('${item.id}')" title="Cancel & remove image" aria-label="Cancel image">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    } else if (item.status === 'error') {
        return `
            <div class="action-buttons-group">
                <button type="button" class="btn-action-remove" onclick="removeFileResult('${item.id}')" title="Remove error image" aria-label="Remove image">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    }
    return '—';
}

function createTableRowElement(item) {
    const row = document.createElement('tr');
    row.id = `resultRow-${item.id}`;
    row.className = `modern-table-row ${item.status === 'compressing' ? 'row-compressing' : ''} ${item.status === 'complete' ? 'row-complete' : ''} ${item.status === 'error' ? 'row-error' : ''}`;

    const originalText = formatSize(item.originalSize);
    const optimizedText = item.compressedSize ? formatSize(item.compressedSize) : '—';
    const ext = getFileExtension(item.name);

    row.innerHTML = `
        <td class="cell-file">
            <div class="file-cell">
                <img src="${item.previewUrl}" alt="Preview" class="file-thumbnail" onerror="this.src='static/images/logo.png'">
                <div class="file-info">
                    <span class="file-name-text" title="${item.name}">${item.name}</span>
                    <span class="file-ext-tag">${ext} FORMAT</span>
                </div>
            </div>
        </td>
        <td class="cell-status">${getStatusBadgeHTML(item.status)}</td>
        <td class="cell-orig"><strong>${originalText}</strong></td>
        <td class="cell-opt"><strong>${optimizedText}</strong></td>
        <td class="cell-reduc">${getReductionBadgeHTML(item)}</td>
        <td class="cell-action" style="text-align: right;">${getActionHTML(item)}</td>
    `;

    return row;
}

function updateTableRow(idOrIndex) {
    let id = idOrIndex;
    let item = fileResults.find(f => f.id === id);
    if (!item && typeof idOrIndex === 'number') {
        item = fileResults[idOrIndex];
        if (item) id = item.id;
    }
    if (!item) return;

    let row = document.getElementById(`resultRow-${id}`);
    if (!row) {
        row = createTableRowElement(item);
        tableBody.appendChild(row);
        return;
    }

    row.className = `modern-table-row ${item.status === 'compressing' ? 'row-compressing' : ''} ${item.status === 'complete' ? 'row-complete' : ''} ${item.status === 'error' ? 'row-error' : ''}`;

    const cellStatus = row.querySelector('.cell-status');
    if (cellStatus) cellStatus.innerHTML = getStatusBadgeHTML(item.status);

    const cellOpt = row.querySelector('.cell-opt');
    if (cellOpt) {
        const optimizedText = item.compressedSize ? formatSize(item.compressedSize) : '—';
        cellOpt.innerHTML = `<strong>${optimizedText}</strong>`;
    }

    const cellReduc = row.querySelector('.cell-reduc');
    if (cellReduc) cellReduc.innerHTML = getReductionBadgeHTML(item);

    const cellAction = row.querySelector('.cell-action');
    if (cellAction) cellAction.innerHTML = getActionHTML(item);
}

function renderTable() {
    tableBody.innerHTML = '';
    headerFileCount.textContent = fileResults.length;

    fileResults.forEach((item) => {
        const row = createTableRowElement(item);
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

// Remove / Cancel a specific image from the table
function removeFileResult(id) {
    const itemIndex = fileResults.findIndex(f => f.id === id);
    if (itemIndex === -1) return;

    const item = fileResults[itemIndex];

    // Abort active network request if compression is in-flight
    if (item.abortController) {
        try {
            item.abortController.abort();
        } catch (e) {
            console.error('Abort error:', e);
        }
    }
    item.status = 'cancelled';

    // Free object URLs to prevent memory leaks
    if (item.blobUrl) {
        URL.revokeObjectURL(item.blobUrl);
        item.blobUrl = null;
    }
    if (item.previewUrl) {
        window.imressThumbnailer.revoke(item.previewUrl);
        item.previewUrl = null;
    }

    // Remove from active records
    fileResults.splice(itemIndex, 1);

    // Smooth exit animation on DOM row
    const row = document.getElementById(`resultRow-${id}`);
    if (row) {
        row.style.transition = 'all 0.22s ease';
        row.style.opacity = '0';
        row.style.transform = 'scale(0.96) translateX(12px)';
        setTimeout(() => {
            if (row.parentNode) row.parentNode.removeChild(row);
        }, 220);
    }

    // If all files are removed, return cleanly to empty state
    if (fileResults.length === 0) {
        resetAllState();
        return;
    }

    // Update table header and summary KPI metrics
    headerFileCount.textContent = fileResults.length;
    updateSummary();

    // If actively compressing, refresh circular progress bar and text dynamically
    if (isCompressing) {
        const completedCount = fileResults.filter(f => f.status === 'complete').length;
        const totalRemaining = fileResults.length;
        const completedPct = totalRemaining > 0 ? Math.round((completedCount / totalRemaining) * 100) : 100;

        if (compressCircularBar) {
            const circumference = 264;
            const offset = circumference - (circumference * completedPct / 100);
            compressCircularBar.style.strokeDashoffset = offset;
        }
        if (compressCircularPercent) {
            compressCircularPercent.textContent = `${completedPct}%`;
        }
        if (compressingStatusText) {
            compressingStatusText.textContent = `Compressed ${completedCount} of ${totalRemaining} images...`;
        }
    }
}
window.removeFileResult = removeFileResult;

// ==========================================================================
// File Download & Native Electron Save
// ==========================================================================

async function downloadSingleFile(idOrIndex) {
    const item = typeof idOrIndex === 'string'
        ? fileResults.find(f => f.id === idOrIndex)
        : (fileResults.find(f => f.id === idOrIndex) || fileResults[idOrIndex]);
    if (!item) return;

    let blob = item.compressedBlob;
    if (!blob && item.blobUrl) {
        try {
            const response = await fetch(item.blobUrl);
            blob = await response.blob();
        } catch (e) {
            console.error('Failed to fetch blob URL:', e);
        }
    }
    if (!blob) {
        alert('File is not ready yet or compression failed.');
        return;
    }

    const downloadName = item.outputName || item.name;
    await saveFile(downloadName, blob);
}
window.downloadSingleFile = downloadSingleFile;

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function saveFile(filename, blob) {
    // 1. Electron Desktop API - Fast binary transfer
    if (window.electronAPI && typeof window.electronAPI.saveFile === 'function') {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            const res = await window.electronAPI.saveFile(filename, uint8);
            if (res && res.success) {
                console.log('Saved successfully via Electron to:', res.filePath);
                return;
            }
            if (res && res.cancelled) {
                console.log('User cancelled save dialog');
                return;
            }
        } catch (err) {
            console.warn('Fast Electron binary save failed, trying base64 fallback:', err);
            try {
                const base64data = await blobToBase64(blob);
                const res = await window.electronAPI.saveFile(filename, base64data);
                if (res && (res.success || res.cancelled)) return;
            } catch (b64Err) {
                console.warn('Base64 save failed, falling back to browser download:', b64Err);
            }
        }
    }

    // 2. Standard Web Browser anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shared Batch ZIP download function - Instant client-side bundling
async function downloadAllAsZip(btnElement, textElement) {
    const completedFiles = fileResults.filter(f => f.status === 'complete');
    if (completedFiles.length === 0) return;

    const origText = textElement ? textElement.textContent : 'Save as Zip';
    if (textElement) textElement.textContent = 'Preparing ZIP...';
    if (btnElement) btnElement.disabled = true;

    try {
        if (typeof JSZip !== 'undefined') {
            // Instant Client-Side Packaging from already compressed memory blobs
            const zip = new JSZip();
            const usedNames = new Set();

            for (const item of completedFiles) {
                let filename = item.outputName || item.name;
                let finalName = filename;
                let counter = 1;
                while (usedNames.has(finalName.toLowerCase())) {
                    const dotIdx = filename.lastIndexOf('.');
                    if (dotIdx !== -1) {
                        finalName = `${filename.slice(0, dotIdx)}_${counter}${filename.slice(dotIdx)}`;
                    } else {
                        finalName = `${filename}_${counter}`;
                    }
                    counter++;
                }
                usedNames.add(finalName.toLowerCase());

                let blob = item.compressedBlob;
                if (!blob && item.blobUrl) {
                    const res = await fetch(item.blobUrl);
                    blob = await res.blob();
                }
                if (blob) {
                    zip.file(finalName, blob);
                }
            }

            // Generate ZIP instantly using STORE (images are already compressed, zero latency!)
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'STORE'
            });

            await saveFile('compressed_images.zip', zipBlob);
            return;
        }

        // Fallback to server /compress-zip if JSZip library is not present
        const formData = new FormData();
        completedFiles.forEach(item => {
            formData.append('images', item.file);
        });

        const response = await fetch(`${API_BASE}/compress-zip`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const fallbackBlob = await response.blob();
        await saveFile('compressed_images.zip', fallbackBlob);

    } catch (err) {
        console.error('Failed to generate ZIP archive:', err);
        alert('Failed to generate ZIP archive: ' + err.message);
    } finally {
        if (textElement) textElement.textContent = origText;
        if (btnElement) btnElement.disabled = false;
    }
}

// Batch ZIP download listeners (both completion window & table banner)
if (downloadZipBtn) {
    downloadZipBtn.addEventListener('click', () => downloadAllAsZip(downloadZipBtn, zipBtnText));
}

if (completionDownloadZipBtn) {
    completionDownloadZipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadAllAsZip(completionDownloadZipBtn, completionZipBtnText);
    });
}

if (completionUploadMoreBtn) {
    completionUploadMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
}

// Reset/Clear All functionality
function resetAllState() {
    // Clean up created object URLs
    fileResults.forEach(item => {
        if (item.previewUrl) window.imressThumbnailer.revoke(item.previewUrl);
        if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    });
    if (fileInput) fileInput.value = '';
    clearStagedQueue();
    fileResults = [];
    tableBody.innerHTML = '';
    tableWrapper.style.display = 'none';
    summaryBanner.style.display = 'none';
    if (compressingState) compressingState.style.display = 'none';
    if (completionState) completionState.style.display = 'none';
    uploadBox.classList.remove('has-staged', 'has-completed');
    uploadEmptyState.style.display = 'flex';
    // Smoothly scroll back to top
    smoothScrollTo(0, 500, true);
}

if (clearAllBtn) {
    clearAllBtn.addEventListener('click', resetAllState);
}

if (completionClearBtn) {
    completionClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetAllState();
    });
}

if (completionCloseBtn) {
    completionCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetAllState();
    });
}

// Keep header add button visibility synced on window resize
window.addEventListener('resize', () => {
    if (stagedFiles.length > 0) {
        updateHeaderAddButtonVisibility();
    }
});