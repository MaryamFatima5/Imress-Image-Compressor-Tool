/**
 * Imress Offline Thumbnail Library
 * 100% Offline, Zero-Dependency, High-Performance Image Thumbnail Engine
 * 
 * Optimized for Electron and modern Web browsers to prevent memory bloat 
 * and eliminate scroll lag when previewing dozens or hundreds of high-res images.
 */
(function(global) {
    'use strict';

    class OfflineThumbnailer {
        constructor(options = {}) {
            // Ultra HD Crisp Thumbnail settings
            this.maxWidth = options.maxWidth || 480;
            this.maxHeight = options.maxHeight || 480;
            this.quality = options.quality || 0.94;
            this.format = options.format || 'image/webp'; // Ultra-HD WebP
            this.concurrency = options.concurrency || 6;
            this.cache = new Map();
        }

        /**
         * Calculate proportional downscaled dimensions with Hi-DPI clarity
         */
        calculateDimensions(srcWidth, srcHeight) {
            let width = srcWidth;
            let height = srcHeight;

            if (width > this.maxWidth || height > this.maxHeight) {
                const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
                width = Math.max(1, Math.round(width * ratio));
                height = Math.max(1, Math.round(height * ratio));
            }

            return { width, height };
        }

        /**
         * Generate an Ultra-HD crisp thumbnail from a File/Blob
         * @param {File|Blob} file 
         * @returns {Promise<string>} Blob URL of Ultra-HD thumbnail
         */
        async generateThumbnail(file) {
            if (!file) throw new Error('No file provided');

            // 1. Try hardware-accelerated createImageBitmap with high quality resize
            try {
                if ('createImageBitmap' in global) {
                    // Pre-decode to get aspect ratio
                    let bmp = await createImageBitmap(file);
                    const { width, height } = this.calculateDimensions(bmp.width, bmp.height);
                    bmp.close();

                    // Re-create with high quality downscaling for razor-sharp Ultra-HD
                    const resizedBmp = await createImageBitmap(file, {
                        resizeWidth: width,
                        resizeHeight: height,
                        resizeQuality: 'high'
                    });

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d', { alpha: true });
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(resizedBmp, 0, 0);
                    resizedBmp.close();

                    return await this.canvasToBlobUrl(canvas);
                }
            } catch (err) {
                // Fallback to Image element if createImageBitmap fails
            }

            // 2. Fallback: Image object + Canvas
            return new Promise((resolve, reject) => {
                const img = new Image();
                const tempUrl = URL.createObjectURL(file);

                img.onload = () => {
                    try {
                        const { width, height } = this.calculateDimensions(img.naturalWidth, img.naturalHeight);
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d', { alpha: true });
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'medium';
                        ctx.drawImage(img, 0, 0, width, height);

                        URL.revokeObjectURL(tempUrl);
                        this.canvasToBlobUrl(canvas).then(resolve).catch(reject);
                    } catch (e) {
                        URL.revokeObjectURL(tempUrl);
                        resolve(tempUrl); // safe fallback
                    }
                };

                img.onerror = () => {
                    URL.revokeObjectURL(tempUrl);
                    reject(new Error('Failed to load image for thumbnailing'));
                };

                img.src = tempUrl;
            });
        }

        /**
         * Convert canvas to a lightweight Blob URL
         */
        canvasToBlobUrl(canvas) {
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    } else {
                        // Fallback to dataURL if toBlob fails
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    }
                }, this.format, this.quality);
            });
        }

        /**
         * Batch process files with concurrency control & progress callback
         * @param {Array<File>} files 
         * @param {Function} onProgress (loadedCount, totalCount)
         * @returns {Promise<Array<{file: File, thumbnailUrl: string}>>}
         */
        async generateBatch(files, onProgress) {
            const results = new Array(files.length);
            let currentIndex = 0;
            let completedCount = 0;

            const worker = async () => {
                while (currentIndex < files.length) {
                    const idx = currentIndex++;
                    const file = files[idx];
                    try {
                        const thumbnailUrl = await this.generateThumbnail(file);
                        results[idx] = { file, thumbnailUrl, error: null };
                    } catch (err) {
                        console.warn(`Thumbnail creation error for ${file.name}:`, err);
                        // Fallback placeholder or raw object URL
                        const fallbackUrl = URL.createObjectURL(file);
                        results[idx] = { file, thumbnailUrl: fallbackUrl, error: err };
                    }
                    completedCount++;
                    if (typeof onProgress === 'function') {
                        onProgress(completedCount, files.length);
                    }
                }
            };

            const pool = [];
            const workersCount = Math.min(this.concurrency, files.length);
            for (let i = 0; i < workersCount; i++) {
                pool.push(worker());
            }

            await Promise.all(pool);
            return results;
        }

        /**
         * Revoke an active thumbnail URL
         */
        revoke(url) {
            if (url && typeof url === 'string' && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        }
    }

    // Expose global instance
    global.OfflineThumbnailer = OfflineThumbnailer;
    global.imressThumbnailer = new OfflineThumbnailer({
        maxWidth: 480,
        maxHeight: 480,
        quality: 0.94,
        concurrency: 6
    });

})(typeof window !== 'undefined' ? window : this);
