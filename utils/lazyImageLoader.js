const fs = require('fs').promises;
const path = require('path');

class LazyImageLoader {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../public/uploads');
    this.thumbnailsDir = path.join(__dirname, '../public/uploads/thumbnails');
    this.compressedDir = path.join(__dirname, '../public/uploads/compressed');
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Full path to file
   * @returns {boolean} - True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get optimized image data for templates
   * @param {string} originalPath - Original image path from database
   * @param {string} context - 'thumbnail' or 'compressed'
   * @returns {Object} - Image data object
   */
  async getImageData(originalPath, context = 'thumbnail') {
    if (!originalPath || !originalPath.includes('/public/uploads/')) {
      return {
        exists: false,
        path: originalPath,
        placeholder: true
      };
    }

    const filename = path.basename(originalPath);
    const nameWithoutExt = path.parse(filename).name;

    let processedPath, processedFullPath;

    switch (context) {
      case 'thumbnail':
        processedPath = `/public/uploads/thumbnails/${nameWithoutExt}_thumb.jpg`;
        processedFullPath = path.join(this.thumbnailsDir, `${nameWithoutExt}_thumb.jpg`);
        break;
      case 'compressed':
        processedPath = `/public/uploads/compressed/${nameWithoutExt}_compressed.jpg`;
        processedFullPath = path.join(this.compressedDir, `${nameWithoutExt}_compressed.jpg`);
        break;
      default:
        return {
          exists: false,
          path: originalPath,
          placeholder: true
        };
    }

    // Check if processed version exists
    const processedExists = await this.fileExists(processedFullPath);

    if (processedExists) {
      return {
        exists: true,
        path: processedPath,
        originalPath: originalPath,
        placeholder: false
      };
    }

    // Check if original exists
    const originalFullPath = path.join(this.uploadsDir, filename);
    const originalExists = await this.fileExists(originalFullPath);

    if (originalExists) {
      return {
        exists: true,
        path: originalPath,
        originalPath: originalPath,
        placeholder: false
      };
    }

    // Neither exists
    return {
      exists: false,
      path: originalPath,
      placeholder: true
    };
  }

  /**
   * Get multiple image data objects in parallel
   * @param {Array} imagePaths - Array of image paths
   * @param {string} context - 'thumbnail' or 'compressed'
   * @returns {Array} - Array of image data objects
   */
  async getMultipleImageData(imagePaths, context = 'thumbnail') {
    const promises = imagePaths.map(path => this.getImageData(path, context));
    return await Promise.all(promises);
  }

  /**
   * Generate HTML for lazy-loaded image
   * @param {Object} imageData - Image data from getImageData
   * @param {Object} options - Additional options
   * @returns {string} - HTML string
   */
  generateLazyImageHTML(imageData, options = {}) {
    const {
      alt = 'Image',
      className = '',
      style = '',
      width,
      height,
      placeholderSrc = '/public/logo.jpg' // Use logo as placeholder
    } = options;

    if (!imageData.exists) {
      // Return placeholder image
      return `<img src="${placeholderSrc}"
                   alt="${alt}"
                   class="${className} lazy-placeholder"
                   style="${style}"
                   loading="lazy"
                   ${width ? `width="${width}"` : ''}
                   ${height ? `height="${height}"` : ''} />`;
    }

    return `<img src="${imageData.path}"
                 alt="${alt}"
                 class="${className} lazy-image"
                 style="${style}"
                 loading="lazy"
                 data-original="${imageData.originalPath}"
                 ${width ? `width="${width}"` : ''}
                 ${height ? `height="${height}"` : ''} />`;
  }
}

module.exports = new LazyImageLoader();
