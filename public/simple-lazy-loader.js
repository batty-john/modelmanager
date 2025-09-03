// Simple Lazy Image Loader - Fallback for basic lazy loading
class SimpleLazyLoader {
  constructor() {
    this.init();
  }

  init() {
    // Use Intersection Observer if available, otherwise use scroll events
    if ('IntersectionObserver' in window) {
      this.useIntersectionObserver();
    } else {
      this.useScrollEvents();
    }
  }

  useIntersectionObserver() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    // Observe all images with data-src
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => imageObserver.observe(img));
  }

  useScrollEvents() {
    // Fallback for older browsers
    const lazyImages = document.querySelectorAll('img[data-src]');

    const lazyLoad = () => {
      lazyImages.forEach(img => {
        if (this.isElementInViewport(img)) {
          this.loadImage(img);
        }
      });
    };

    // Initial load
    lazyLoad();

    // Load on scroll and resize
    window.addEventListener('scroll', lazyLoad);
    window.addEventListener('resize', lazyLoad);
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.classList.remove('lazy');
      img.removeAttribute('data-src');
    }
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.simpleLazyLoader = new SimpleLazyLoader();
});
