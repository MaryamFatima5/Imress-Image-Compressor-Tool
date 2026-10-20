// ==========================================================================
// IMRESS - File Staging & Dropzone Controller
// Module: staging-controller.js
// Handles dropzone interactions, thumbnail generation, and staged queue.
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

// Dropzone & File Input Events
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
            window.scrollBy({
                top: e.deltaY,
                behavior: 'auto'
            });
        } else if (isAtTop && e.deltaY < 0) {
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

// Keep header add button visibility synced on window resize
window.addEventListener('resize', () => {
    if (stagedFiles.length > 0) {
        updateHeaderAddButtonVisibility();
    }
});
