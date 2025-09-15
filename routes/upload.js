const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const imageProcessor = require('../utils/imageProcessor');

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('file');

// POST /upload/photo — accepts one image file and returns processed paths
router.post('/photo', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      // Process image to create compressed and thumbnail versions
      const processed = await imageProcessor.processImage(req.file.filename);
      return res.json({
        success: true,
        field: req.query.field || null,
        filename: req.file.filename,
        original: processed.original,
        compressed: processed.compressed,
        thumbnail: processed.thumbnail
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
});

module.exports = router;


