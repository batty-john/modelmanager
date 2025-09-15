const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class ImageProcessor {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../public/uploads');
    this.thumbnailsDir = path.join(__dirname, '../public/uploads/thumbnails');
    this.compressedDir = path.join(__dirname, '../public/uploads/compressed');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
      await fs.mkdir(this.compressedDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  /**
   * Process uploaded image: create compressed version and thumbnail
   * @param {string} filename - Original filename
   * @returns {Object} - Paths to processed images
   */
  async processImage(filename) {
    await this.ensureDirectories();
    
    const originalPath = path.join(this.uploadsDir, filename);
    const nameWithoutExt = path.parse(filename).name;
    const ext = '.jpg'; // Always save as JPEG for consistency and size
    
    const compressedFilename = `${nameWithoutExt}_compressed${ext}`;
    const thumbnailFilename = `${nameWithoutExt}_thumb${ext}`;
    
    const compressedPath = path.join(this.compressedDir, compressedFilename);
    const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

    try {
      // Check if original file exists
      await fs.access(originalPath);
      
      // Create compressed version (max 1920x1920, 85% quality, ~500KB-2MB)
      await sharp(originalPath)
        .resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toFile(compressedPath);

      // Create thumbnail (300x300, 80% quality, ~20-100KB)
      await sharp(originalPath)
        .resize(300, 300, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(thumbnailPath);

      // Get file sizes for logging
      const originalStats = await fs.stat(originalPath);
      const compressedStats = await fs.stat(compressedPath);
      const thumbnailStats = await fs.stat(thumbnailPath);

      console.log(`✅ Image processed: ${filename}`);
      console.log(`   Original: ${(originalStats.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Compressed: ${(compressedStats.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Thumbnail: ${(thumbnailStats.size / 1024).toFixed(0)}KB`);

      return {
        original: `/public/uploads/${filename}`,
        compressed: `/public/uploads/compressed/${compressedFilename}`,
        thumbnail: `/public/uploads/thumbnails/${thumbnailFilename}`,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error processing image ${filename}:`, error);
      
      // Return original path as fallback
      return {
        original: `/public/uploads/${filename}`,
        compressed: `/public/uploads/${filename}`, // Fallback to original
        thumbnail: `/public/uploads/${filename}`, // Fallback to original
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process multiple images in parallel
   * @param {Array} filenames - Array of filenames to process
   * @returns {Array} - Array of processing results
   */
  async processImages(filenames) {
    const results = await Promise.allSettled(
      filenames.map(filename => this.processImage(filename))
    );

    return results.map((result, index) => ({
      filename: filenames[index],
      ...(result.status === 'fulfilled' ? result.value : { 
        success: false, 
        error: result.reason?.message || 'Processing failed' 
      })
    }));
  }

  /**
   * Clean up old processed images when original is deleted
   * @param {string} filename - Original filename to clean up
   */
  async cleanupProcessedImages(filename) {
    const nameWithoutExt = path.parse(filename).name;
    const compressedFilename = `${nameWithoutExt}_compressed.jpg`;
    const thumbnailFilename = `${nameWithoutExt}_thumb.jpg`;
    
    try {
      await fs.unlink(path.join(this.compressedDir, compressedFilename)).catch(() => {});
      await fs.unlink(path.join(this.thumbnailsDir, thumbnailFilename)).catch(() => {});
      console.log(`🧹 Cleaned up processed images for: ${filename}`);
    } catch (error) {
      console.error(`Error cleaning up processed images for ${filename}:`, error);
    }
  }

  /**
   * Get the best image path for display based on context, checking if files exist
   * @param {string} originalPath - Original image path
   * @param {string} context - 'thumbnail', 'compressed', or 'original'
   * @returns {string} - Best path to use
   */
  async getBestImagePath(originalPath, context = 'compressed') {
    if (!originalPath || !originalPath.includes('/public/uploads/')) {
      return originalPath;
    }

    const filename = path.basename(originalPath);
    const nameWithoutExt = path.parse(filename).name;

    let preferredPath;
    let fallbackPath;

    switch (context) {
      case 'thumbnail':
        preferredPath = path.join(this.thumbnailsDir, `${nameWithoutExt}_thumb.jpg`);
        fallbackPath = originalPath;
        break;
      case 'compressed':
        preferredPath = path.join(this.compressedDir, `${nameWithoutExt}_compressed.jpg`);
        fallbackPath = originalPath;
        break;
      case 'original':
      default:
        return originalPath;
    }

    // Check if preferred version exists
    try {
      await fs.access(preferredPath);
      // Return the processed version path if it exists
      return context === 'thumbnail'
        ? `/public/uploads/thumbnails/${nameWithoutExt}_thumb.jpg`
        : `/public/uploads/compressed/${nameWithoutExt}_compressed.jpg`;
    } catch (error) {
      // File doesn't exist, return fallback
      return fallbackPath;
    }
  }

  /**
   * Synchronous version for templates - checks cache first
   * @param {string} originalPath - Original image path
   * @param {string} context - 'thumbnail', 'compressed', or 'original'
   * @returns {string} - Best path to use
   */
  getBestImagePathSync(originalPath, context = 'compressed') {
    if (!originalPath || !originalPath.includes('/public/uploads/')) {
      return originalPath;
    }

    const filename = path.basename(originalPath);
    const nameWithoutExt = path.parse(filename).name;

    switch (context) {
      case 'thumbnail':
        return `/public/uploads/thumbnails/${nameWithoutExt}_thumb.jpg`;
      case 'compressed':
        return `/public/uploads/compressed/${nameWithoutExt}_compressed.jpg`;
      case 'original':
      default:
        return originalPath;
    }
  }
}

module.exports = new ImageProcessor();