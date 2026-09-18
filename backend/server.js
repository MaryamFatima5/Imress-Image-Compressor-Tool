const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const path = require('path');

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
 * Compress an image buffer according to its format using Sharp
 */
async function compressImageBuffer(buffer, originalname) {
    const ext = path.extname(originalname).toLowerCase();
    let sharpInstance = sharp(buffer);

    let outputBuffer;
    if (ext === '.jpg' || ext === '.jpeg') {
        outputBuffer = await sharpInstance
            .jpeg({ quality: 50, mozjpeg: true })
            .toBuffer();
    } else if (ext === '.png') {
        outputBuffer = await sharpInstance
            .png({ quality: 50, compressionLevel: 9, palette: true })
            .toBuffer();
    } else if (ext === '.webp') {
        outputBuffer = await sharpInstance
            .webp({ quality: 50 })
            .toBuffer();
    } else {
        // Fallback for other formats (e.g. gif, tiff) - convert to optimized webp
        outputBuffer = await sharpInstance
            .webp({ quality: 50 })
            .toBuffer();
    }

    return {
        buffer: outputBuffer,
        filename: originalname
    };
}

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT, uptime: process.uptime() });
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

// Multiple images compress and zip
app.post('/compress-zip', upload.array('images'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="compressed_images.zip"');

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
        });

        archive.pipe(res);

        for (const file of files) {
            try {
                const { buffer, filename } = await compressImageBuffer(file.buffer, file.originalname);
                archive.append(buffer, { name: filename });
            } catch (err) {
                console.error(`Error compressing ${file.originalname}:`, err);
                // Include original file if compression failed
                archive.append(file.buffer, { name: file.originalname });
            }
        }

        await archive.finalize();
    } catch (err) {
        console.error('Error creating zip:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to create zip: ' + err.message });
        }
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend] Imress Node.js Server running at http://localhost:${PORT}`);
});
