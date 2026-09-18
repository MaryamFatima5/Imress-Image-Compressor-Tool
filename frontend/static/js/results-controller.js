// ==========================================================================
// IMRESS - Results Table & Export Controller
// Module: results-controller.js
// Handles results rendering, KPI summary, removal, and single/batch ZIP downloads.
// ==========================================================================

function getStatusBadgeHTML(status) {
    if (status === 'pending') {
        return `<span class="status-pill pending"><svg class="status-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Queued</span></span>`;
    } else if (status === 'compressing') {
        return `<span class="status-pill compressing"><span class="spinner-icon"></span><span>Compressing...</span></span>`;
    } else if (status === 'complete') {
        return `<span class="status-pill complete"><svg class="status-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Ready</span></span>`;
    } else if (status === 'error') {
        return `<span class="status-pill error"><svg class="status-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>Failed</span></span>`;
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

// Shared Batch ZIP download function - Instant client-side bundling
async function downloadAllAsZip(btnElement, textElement) {
    const completedFiles = fileResults.filter(f => f.status === 'complete');
    if (completedFiles.length === 0) return;

    const origText = textElement ? textElement.textContent : 'Save as Zip';
    if (textElement) textElement.textContent = 'Preparing ZIP...';
    if (btnElement) btnElement.disabled = true;

    try {
        if (typeof JSZip !== 'undefined') {
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

            // Generate ZIP instantly using STORE (images are already compressed)
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
