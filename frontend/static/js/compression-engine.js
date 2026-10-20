// ==========================================================================
// IMRESS - Parallel Compression Engine
// Module: compression-engine.js
// Orchestrates multi-worker concurrent compression and abort signals.
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
