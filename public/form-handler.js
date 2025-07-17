// Form Handler with Loading Animations
class FormHandler {
  constructor() {
    this.initializeForms();
  }

  initializeForms() {
    // Handle all forms with file uploads
    document.querySelectorAll('form[enctype="multipart/form-data"]').forEach(form => {
      this.setupFormSubmission(form);
    });

    // Handle regular forms
    document.querySelectorAll('form:not([enctype="multipart/form-data"])').forEach(form => {
      this.setupFormSubmission(form);
    });
  }

  setupFormSubmission(form) {
    // Only handle file upload forms with AJAX
    if (form.enctype === 'multipart/form-data') {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit(form);
      });
    }
    // Let regular forms submit normally - no AJAX interference
  }

  showFormLoadingState(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="loading-spinner"></span> Processing...';
      
      // Restore button after a delay (in case of errors)
      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }, 10000);
    }
  }

  async handleFormSubmit(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    // Show loading state
    this.showLoadingState(form, submitButton, originalText);
    
    // Create progress indicator for file uploads
    let progressBar = null;
    
    try {
      let requestBody;
      let headers = {};
      
      if (form.enctype === 'multipart/form-data') {
        // Handle file uploads
        requestBody = new FormData(form);
        progressBar = this.createProgressBar();
        form.appendChild(progressBar);
      } else {
        // Handle regular forms
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
          data[key] = value;
        });
        requestBody = new URLSearchParams(data);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      const response = await fetch(form.action, {
        method: form.method,
        body: requestBody,
        headers: headers
      });

      if (response.redirected) {
        // Handle redirect
        window.location.href = response.url;
        return;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        this.handleJsonResponse(data, form);
      } else {
        // Handle HTML response
        const html = await response.text();
        this.handleHtmlResponse(html, form);
      }

    } catch (error) {
      console.error('Form submission error:', error);
      this.showError(form, 'An error occurred. Please try again.');
    } finally {
      // Hide loading state
      this.hideLoadingState(form, submitButton, originalText);
      
      // Remove progress bar
      if (progressBar) {
        progressBar.remove();
      }
    }
  }

  showLoadingState(form, submitButton, originalText) {
    form.classList.add('form-submitting');
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="loading-spinner"></span> Processing...';
    
    // Show loading overlay for long operations
    if (form.enctype === 'multipart/form-data') {
      this.showLoadingOverlay('Uploading files and processing your application...');
    }
  }

  hideLoadingState(form, submitButton, originalText) {
    form.classList.remove('form-submitting');
    submitButton.disabled = false;
    submitButton.textContent = originalText;
    this.hideLoadingOverlay();
  }

  createProgressBar() {
    const container = document.createElement('div');
    container.className = 'upload-progress';
    container.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-medium text-gray-700">Uploading files...</span>
        <span class="text-sm text-gray-500">0%</span>
      </div>
      <div class="progress-container">
        <div class="progress-bar" style="width: 0%"></div>
      </div>
    `;
    return container;
  }

  showLoadingOverlay(message = 'Processing...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-text">${message}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    
    setTimeout(() => {
      overlay.classList.add('show');
    }, 100);
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 300);
    }
  }

  handleJsonResponse(data, form) {
    if (data.success) {
      this.showSuccess(form, data.message || 'Success!');
      if (data.redirect) {
        setTimeout(() => {
          window.location.href = data.redirect;
        }, 1500);
      }
    } else {
      this.showError(form, data.error || 'An error occurred.');
    }
  }

  handleHtmlResponse(html, form) {
    // Parse the HTML response to check for success/error messages
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Look for success messages
    const successMsg = doc.querySelector('.bg-green-100, .message.success');
    if (successMsg) {
      this.showSuccess(form, successMsg.textContent.trim());
      return;
    }
    
    // Look for error messages
    const errorMsg = doc.querySelector('.bg-red-100, .message.error');
    if (errorMsg) {
      this.showError(form, errorMsg.textContent.trim());
      return;
    }
    
    // If no specific message, assume success and redirect
    if (html.includes('redirect') || html.includes('dashboard')) {
      window.location.reload();
    }
  }

  showSuccess(form, message) {
    this.showMessage(form, message, 'success');
  }

  showError(form, message) {
    this.showMessage(form, message, 'error');
  }

  showMessage(form, message, type) {
    // Remove existing messages
    const existingMessages = form.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the form
    form.insertBefore(messageDiv, form.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
}

// Initialize form handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new FormHandler();
});

// Export for use in other scripts
window.FormHandler = FormHandler; 