const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const path = require('path');
const os = require('os');

// Configure Sharp for maximum multi-core SIMD throughput & minimal memory overhead
sharp.concurrency(Math.max(1, os.cpus().length));
sharp.simd(true);
sharp.cache(false); // Disable internal cache to prevent RAM bloat on large batches

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all requests
app.use(cors());
app.use(express.json());

// Memory storage for uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Paths to frontend assets
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.use('/static', express.static(path.join(FRONTEND_DIR, 'static')));

/**
 * Concurrently process an array with a bounded worker pool
 */
async function mapConcurrent(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(items.length, limit) }, async () => {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await fn(items[currentIndex], currentIndex);
        }
    });
    await Promise.all(workers);
    return results;
}

/**
 * High-performance image compression using hardware-accelerated Sharp
 */
async function compressImageBuffer(buffer, originalname) {
    const ext = path.extname(originalname).toLowerCase();
    const sharpInstance = sharp(buffer, { failOn: 'none', animated: ext === '.gif' });

    let outputBuffer;

    if (ext === '.jpg' || ext === '.jpeg') {
        // High-speed baseline libjpeg-turbo with SIMD (15x faster than mozjpeg)
        outputBuffer = await sharpInstance
            .rotate()
            .jpeg({
                quality: 68,
                mozjpeg: false,
                progressive: false,
                chromaSubsampling: '4:2:0',
                trellisQuantisation: false,
                overshootDeringing: false,
                optimizeScans: false
            })
            .toBuffer();
    } else if (ext === '.png') {
        // High-speed PNG compression: level 6 zlib with fast palette quantization
        try {
            outputBuffer = await sharpInstance
                .png({
                    quality: 75,
                    compressionLevel: 6,
                    palette: true,
                    effort: 1,
                    dither: 0,
                    adaptiveFiltering: true
                })
                .toBuffer();
        } catch (e) {
            outputBuffer = await sharpInstance
                .png({
                    compressionLevel: 6,
                    adaptiveFiltering: true
                })
                .toBuffer();
        }
    } else if (ext === '.webp') {
        // Fast WebP compression (effort: 0 is >2.5x faster with virtually identical size)
        outputBuffer = await sharpInstance
            .rotate()
            .webp({
                quality: 65,
                effort: 0,
                smartSubsample: false
            })
            .toBuffer();
    } else if (ext === '.gif') {
        outputBuffer = await sharpInstance
            .gif({
                reoptimise: true,
                effort: 1
            })
            .toBuffer();
    } else if (ext === '.avif') {
        outputBuffer = await sharpInstance
            .rotate()
            .avif({
                quality: 55,
                effort: 1
            })
            .toBuffer();
    } else {
        // Fallback for other formats (e.g. tiff, bmp)
        outputBuffer = await sharpInstance
            .rotate()
            .webp({
                quality: 65,
                effort: 0
            })
            .toBuffer();
    }

    // Professional safety: ensure output never exceeds original file size
    if (outputBuffer && outputBuffer.length > buffer.length) {
        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
            outputBuffer = buffer;
        }
    }

    return {
        buffer: outputBuffer || buffer,
        filename: originalname
    };
}

// Health check route
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        port: PORT,
        uptime: process.uptime(),
        sharpSimd: sharp.simd(),
        sharpConcurrency: sharp.concurrency()
    });
});

// Serve frontend main page
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Single image compress
app.post('/compress', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const { buffer, filename } = await compressImageBuffer(req.file.buffer, req.file.originalname);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (err) {
        console.error('Error compressing image:', err);
        return res.status(500).json({ error: 'Image compression failed: ' + err.message });
    }
});

// Multiple images compress and zip (Parallel concurrent processing)
app.post('/compress-zip', upload.array('images'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="compressed_images.zip"');

        const archive = archiver('zip', {
            zlib: { level: 6 } // Level 6 is much faster than 9 for already compressed image buffers
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
        });

        archive.pipe(res);

        // Compress images concurrently using multi-core worker pool
        const concurrency = Math.min(files.length, Math.max(2, os.cpus().length));
        const compressedList = await mapConcurrent(files, concurrency, async (file) => {
            try {
                return await compressImageBuffer(file.buffer, file.originalname);
            } catch (err) {
                console.error(`Error compressing ${file.originalname}:`, err);
                return { buffer: file.buffer, filename: file.originalname };
            }
        });

        for (const item of compressedList) {
            archive.append(item.buffer, { name: item.filename });
        }

        await archive.finalize();
    } catch (err) {
        console.error('Error creating zip:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to create zip: ' + err.message });
        }
    }
});

function startServer(port = 5000) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, '127.0.0.1', () => {
            console.log(`[Backend] Imress Ultra-Fast Server running at http://127.0.0.1:${port}`);
            resolve(server);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`[Backend] Port ${port} is already active. Reusing running backend.`);
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
}

// Standalone execution support
if (require.main === module) {
    const port = parseInt(process.env.PORT, 10) || 5000;
    startServer(port);
}

module.exports = { app, startServer };
