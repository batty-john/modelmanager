// Advanced Lazy Image Loader with Intersection Observer
class AdvancedLazyLoader {
  constructor() {
    this.imageObserver = null;
    this.loadedImages = new Set();
    this.failedImages = new Set();
    this.imageRetryCount = new Map();
    this.maxRetries = 1; // Only retry once
    this.init();
  }

  init() {
    // Create Intersection Observer
    this.imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      // Load images 50px before they enter viewport
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    // Observe all lazy images
    this.observeImages();
  }

  observeImages() {
    // Find all lazy images that haven't been processed yet
    const lazyImages = document.querySelectorAll('img[loading="lazy"]:not(.lazy-processed)');

    lazyImages.forEach(img => {
      // Only observe if not already in viewport and not failed
      if (!this.isElementInViewport(img) && !this.failedImages.has(img.src)) {
        this.imageObserver.observe(img);
      } else if (this.isElementInViewport(img) && !this.failedImages.has(img.src)) {
        // Load immediately if already in viewport
        this.loadImage(img);
      }
    });
  }

  loadImage(img) {
    // Prevent multiple processing of the same image
    if (img.classList.contains('lazy-processed')) {
      return;
    }

    // Mark as processed to prevent re-processing
    img.classList.add('lazy-processed');

    // Check if we've already failed this URL
    if (this.failedImages.has(img.src)) {
      this.handleFailedImage(img);
      return;
    }

    // Add loading class for CSS transitions
    img.classList.add('lazy-loading');

    // Set up event handlers with cleanup to prevent memory leaks
    const loadHandler = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      img.removeEventListener('load', loadHandler);
      img.removeEventListener('error', errorHandler);
    };

    const errorHandler = () => {
      this.handleImageError(img);
      img.removeEventListener('load', loadHandler);
      img.removeEventListener('error', errorHandler);
    };

    img.addEventListener('load', loadHandler);
    img.addEventListener('error', errorHandler);
  }

  handleImageError(img) {
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-error');

    // Get current retry count for this image
    const currentRetries = this.imageRetryCount.get(img.src) || 0;

    // Try to load original if processed version failed (only once)
    if (img.dataset.original && img.dataset.original !== img.src && currentRetries < this.maxRetries) {
      this.imageRetryCount.set(img.src, currentRetries + 1);
      img.src = img.dataset.original;
      // Re-process with new src
      img.classList.remove('lazy-processed');
      this.loadImage(img);
    } else {
      // Mark as failed to prevent future attempts
      this.failedImages.add(img.src);
      this.handleFailedImage(img);
    }
  }

  handleFailedImage(img) {
    // Instead of hiding, let CSS handle the display
    // The image stays in DOM but is hidden by CSS
    console.warn('Image failed to load:', img.src);

    // Optional: Dispatch custom event for other scripts to handle
    const event = new CustomEvent('lazyImageError', {
      detail: { image: img, src: img.src }
    });
    document.dispatchEvent(event);
  }

  isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Re-observe new images (useful for dynamically added content)
  refresh() {
    this.observeImages();
  }
}

// CSS for lazy loading states
const lazyStyles = `
  <style>
    .lazy-loading {
      opacity: 0.6;
      filter: blur(1px);
      transition: opacity 0.3s ease, filter 0.3s ease;
    }

    .lazy-loaded {
      opacity: 1;
      filter: blur(0);
    }

    .lazy-error {
      opacity: 0.8;
      filter: grayscale(100%);
      transition: opacity 0.3s ease;
    }

    .lazy-placeholder {
      background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%),
                  linear-gradient(-45deg, #f3f4f6 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f3f4f6 75%),
                  linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    }

    /* Hide failed images completely to prevent layout issues */
    .lazy-processed.lazy-error {
      display: none !important;
    }

    /* Better placeholder for image containers */
    .image-container:has(.lazy-processed.lazy-error) {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border: 2px dashed #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 0.875rem;
    }

    .image-container:has(.lazy-processed.lazy-error)::before {
      content: "Image not available";
    }
  </style>
`;

// Add styles to head
document.head.insertAdjacentHTML('beforeend', lazyStyles);

// Initialize lazy loader when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.lazyLoader = new AdvancedLazyLoader();
  });
} else {
  window.lazyLoader = new AdvancedLazyLoader();
}

// Export for use in other scripts
window.AdvancedLazyLoader = AdvancedLazyLoader;

// Debug helper (can be called from console)
window.debugLazyLoader = function() {
  if (!window.lazyLoader) {
    console.log('Lazy loader not initialized');
    return;
  }

  console.log('=== Lazy Loader Debug Info ===');
  console.log('Loaded images:', window.lazyLoader.loadedImages.size);
  console.log('Failed images:', window.lazyLoader.failedImages.size);
  console.log('Retry counts:', Object.fromEntries(window.lazyLoader.imageRetryCount));
  console.log('Total lazy images:', document.querySelectorAll('img[loading="lazy"]').length);
  console.log('Processed images:', document.querySelectorAll('.lazy-processed').length);
  console.log('Successfully loaded:', document.querySelectorAll('.lazy-loaded:not(.lazy-error)').length);
  console.log('Failed images:', document.querySelectorAll('.lazy-error').length);
};

// Auto-cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (window.lazyLoader && window.lazyLoader.imageObserver) {
    window.lazyLoader.imageObserver.disconnect();
  }
});
