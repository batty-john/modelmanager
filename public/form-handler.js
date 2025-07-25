// Enhanced Form Handler with Reliability and Error Handling
class EnhancedFormHandler {
  constructor() {
    this.MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB for professional model photos
    this.TIMEOUT_MS = 60000; // 60 second timeout
    this.retryCount = 0;
    this.maxRetries = 2;
    this.initializeForms();
  }

  initializeForms() {
    // Add basic client-side validation and better UX to all forms
    document.querySelectorAll('form').forEach(form => {
      this.setupFormEnhancements(form);
    });
  }

  setupFormEnhancements(form) {
    // Add form validation
    this.addClientSideValidation(form);
    
    // Add file size validation
    this.addFileValidation(form);
    
    // Add submission handling with fallback
    this.setupReliableSubmission(form);
    
    // Add auto-save for longer forms
    if (form.id === 'registrationForm' || form.id === 'adultIntakeForm') {
      this.setupAutoSave(form);
    }
  }

  setupReliableSubmission(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    form.addEventListener('submit', (e) => {
      // Prevent double submission
      if (form.classList.contains('submitting')) {
        e.preventDefault();
        return;
      }

      // Show loading immediately
      this.showLoadingState(form);
      
      // For file upload forms, try enhanced submission with fallback
      if (form.enctype === 'multipart/form-data') {
        e.preventDefault();
        this.handleEnhancedSubmission(form);
      }
      // Regular forms submit normally but with loading state
    });
  }

  async handleEnhancedSubmission(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
      // Validate before submission
      const validationResult = this.validateForm(form);
      if (!validationResult.isValid) {
        this.showValidationErrors(form, validationResult.errors);
        this.hideLoadingState(form);
        return;
      }

      // Check file sizes
      const fileCheck = this.validateFiles(form);
      if (!fileCheck.isValid) {
        this.showError(form, fileCheck.error);
        this.hideLoadingState(form);
        return;
      }

      // Try AJAX submission with timeout
      await this.attemptAjaxSubmission(form);
      
    } catch (error) {
      console.error('Enhanced submission failed:', error);
      
      // Fallback to normal form submission
      this.fallbackToNormalSubmission(form);
    }
  }

  async attemptAjaxSubmission(form) {
    const formData = new FormData(form);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), this.TIMEOUT_MS);
    });

    // Create fetch promise with progress
    const fetchPromise = this.createFetchWithProgress(form, formData);

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.ok) {
        if (response.redirected) {
          window.location.href = response.url;
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          const html = await response.text();
          this.handleHtmlResponse(html, form);
        } else {
          // Assume success and reload
          window.location.reload();
        }
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
      
    } catch (error) {
      if (error.message === 'Request timeout') {
        throw new Error('The request is taking longer than expected. Please check your connection and try again.');
      }
      throw error;
    }
  }

  async createFetchWithProgress(form, formData) {
    // Show progress for file uploads
    const progressContainer = this.createProgressIndicator();
    form.appendChild(progressContainer);

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: formData,
        // Add headers for better cPanel compatibility
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      progressContainer.remove();
      return response;
    } catch (error) {
      progressContainer.remove();
      throw error;
    }
  }

  fallbackToNormalSubmission(form) {
    console.log('Falling back to normal form submission');
    
    // Show fallback message
    this.showInfo(form, 'Using standard submission method...');
    
    // Remove the event listener to prevent recursion
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Submit the new form normally
    setTimeout(() => {
      newForm.submit();
    }, 500);
  }

  validateForm(form) {
    const errors = [];
    
    // Check required fields
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        const label = form.querySelector(`label[for="${field.id}"]`);
        const fieldName = label ? label.textContent : field.name;
        errors.push(`${fieldName} is required`);
        field.classList.add('border-red-500');
      } else {
        field.classList.remove('border-red-500');
      }
    });

    // Validate email fields
    const emailFields = form.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
      if (field.value && !this.isValidEmail(field.value)) {
        errors.push('Please enter a valid email address');
        field.classList.add('border-red-500');
      }
    });

    // Validate phone fields
    const phoneFields = form.querySelectorAll('input[type="tel"], .modern-phone-input');
    phoneFields.forEach(field => {
      if (field.value && !this.isValidPhone(field.value)) {
        errors.push('Please enter a valid phone number');
        field.classList.add('border-red-500');
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  validateFiles(form) {
    const fileInputs = form.querySelectorAll('input[type="file"]');
    
    for (const input of fileInputs) {
      if (input.files && input.files.length > 0) {
        for (const file of input.files) {
          if (file.size > this.MAX_FILE_SIZE) {
            return {
              isValid: false,
              error: `File "${file.name}" is too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB. Please compress your image or use a smaller file.`
            };
          }
          
          if (!file.type.startsWith('image/')) {
            return {
              isValid: false,
              error: `File "${file.name}" is not an image. Please upload only image files.`
            };
          }
        }
      }
    }
    
    return { isValid: true };
  }

  addFileValidation(form) {
    const fileInputs = form.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          // Check file size
          if (file.size > this.MAX_FILE_SIZE) {
            alert(`File is too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB. Please compress your image or use a smaller file.`);
            input.value = '';
            return;
          }
          
          // Check file type
          if (!file.type.startsWith('image/')) {
            alert('Please upload only image files.');
            input.value = '';
            return;
          }
          
          // Show file size info
          this.showFileInfo(input, file);
        }
      });
    });
  }

  addClientSideValidation(form) {
    // Add real-time validation to inputs
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        this.validateSingleField(input);
      });
      
      input.addEventListener('input', () => {
        // Clear previous error state
        input.classList.remove('border-red-500');
        this.clearFieldError(input);
      });
    });
  }

  validateSingleField(field) {
    let isValid = true;
    let errorMessage = '';

    // Required field validation
    if (field.hasAttribute('required') && !field.value.trim()) {
      isValid = false;
      errorMessage = 'This field is required';
    }
    // Email validation
    else if (field.type === 'email' && field.value && !this.isValidEmail(field.value)) {
      isValid = false;
      errorMessage = 'Please enter a valid email address';
    }
    // Phone validation
    else if ((field.type === 'tel' || field.classList.contains('modern-phone-input')) && field.value && !this.isValidPhone(field.value)) {
      isValid = false;
      errorMessage = 'Please enter a valid phone number';
    }

    if (!isValid) {
      field.classList.add('border-red-500');
      this.showFieldError(field, errorMessage);
    } else {
      field.classList.remove('border-red-500');
      this.clearFieldError(field);
    }

    return isValid;
  }

  setupAutoSave(form) {
    let autoSaveTimeout;
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
          this.saveFormData(form);
        }, 2000);
      });
    });

    // Load saved data on page load
    this.loadFormData(form);
  }

  saveFormData(form) {
    try {
      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        if (key.includes('Photo')) continue; // Don't save file inputs
        data[key] = value;
      }
      
      localStorage.setItem(`formData_${form.id}`, JSON.stringify(data));
      this.showAutoSaveIndicator(form);
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  loadFormData(form) {
    try {
      const savedData = localStorage.getItem(`formData_${form.id}`);
      if (savedData) {
        const data = JSON.parse(savedData);
        
        Object.entries(data).forEach(([key, value]) => {
          const field = form.querySelector(`[name="${key}"]`);
          if (field && field.type !== 'file') {
            field.value = value;
          }
        });
      }
    } catch (error) {
      console.warn('Loading saved data failed:', error);
    }
  }

  // UI Helper Methods
  showLoadingState(form) {
    form.classList.add('submitting');
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      const originalText = submitButton.innerHTML;
      submitButton.setAttribute('data-original-text', originalText);
      submitButton.innerHTML = '<span class="loading-spinner"></span> Submitting...';
    }
    
    // Show loading overlay
    this.showLoadingOverlay('Processing your submission...');
  }

  hideLoadingState(form) {
    form.classList.remove('submitting');
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = false;
      const originalText = submitButton.getAttribute('data-original-text');
      if (originalText) {
        submitButton.innerHTML = originalText;
      }
    }
    
    this.hideLoadingOverlay();
  }

  createProgressIndicator() {
    const container = document.createElement('div');
    container.className = 'upload-progress mt-4 p-3 bg-blue-50 rounded border';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-blue-700">Uploading files...</span>
        <span class="text-sm text-blue-600">Please wait</span>
      </div>
      <div class="w-full bg-blue-200 rounded-full h-2">
        <div class="bg-blue-600 h-2 rounded-full progress-bar animate-pulse" style="width: 30%"></div>
      </div>
      <div class="text-xs text-blue-600 mt-1">Do not close this window</div>
    `;
    return container;
  }

  showLoadingOverlay(message = 'Processing...') {
    let overlay = document.getElementById('enhanced-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'enhanced-loading-overlay';
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      overlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
          <div class="loading-spinner mx-auto mb-4"></div>
          <div class="text-gray-700 font-medium">${message}</div>
          <div class="text-sm text-gray-500 mt-2">Please don't close this window</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    
    overlay.style.display = 'flex';
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('enhanced-loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  handleHtmlResponse(html, form) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Look for success messages
    const successMsg = doc.querySelector('.bg-green-100');
    if (successMsg) {
      this.showSuccess(form, successMsg.textContent.trim());
      return;
    }
    
    // Look for error messages
    const errorMsgs = doc.querySelectorAll('.bg-red-100');
    if (errorMsgs.length > 0) {
      const errorText = Array.from(errorMsgs).map(el => el.textContent.trim()).join(' ');
      this.showError(form, errorText);
      return;
    }
    
    // If thankYou page is returned, redirect
    if (html.includes('Thank you') || html.includes('successfully')) {
      this.showSuccess(form, 'Application submitted successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }
    
    // Default case - reload page
    window.location.reload();
  }

  showValidationErrors(form, errors) {
    const errorHtml = errors.map(error => `<div>${error}</div>`).join('');
    this.showError(form, errorHtml);
  }

  showSuccess(form, message) {
    this.showMessage(form, message, 'success');
    
    // Clear auto-saved data on success
    if (form.id) {
      localStorage.removeItem(`formData_${form.id}`);
    }
  }

  showError(form, message) {
    this.showMessage(form, message, 'error');
  }

  showInfo(form, message) {
    this.showMessage(form, message, 'info');
  }

  showMessage(form, message, type) {
    // Remove existing messages
    const existingMessages = form.querySelectorAll('.form-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message mb-4 p-3 rounded`;
    
    switch (type) {
      case 'success':
        messageDiv.className += ' bg-green-100 text-green-800 border border-green-200';
        break;
      case 'error':
        messageDiv.className += ' bg-red-100 text-red-800 border border-red-200';
        break;
      case 'info':
        messageDiv.className += ' bg-blue-100 text-blue-800 border border-blue-200';
        break;
    }
    
    messageDiv.innerHTML = message;
    
    // Insert at the top of the form
    form.insertBefore(messageDiv, form.firstChild);
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto-remove success/info messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  }

  showFieldError(field, message) {
    this.clearFieldError(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error text-red-600 text-xs mt-1';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
  }

  clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
  }

  showFileInfo(input, file) {
    const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
    const info = document.createElement('div');
    info.className = 'text-xs text-gray-600 mt-1';
    info.textContent = `Selected: ${file.name} (${sizeInMB} MB)`;
    
    // Remove existing info
    const existingInfo = input.parentNode.querySelector('.file-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    info.className += ' file-info';
    input.parentNode.appendChild(info);
  }

  showAutoSaveIndicator(form) {
    let indicator = form.querySelector('.auto-save-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'auto-save-indicator text-xs text-green-600 mt-2';
      form.appendChild(indicator);
    }
    
    indicator.textContent = 'Draft saved automatically';
    indicator.style.opacity = '1';
    
    setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  }

  // Utility Methods
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }
}

// Initialize enhanced form handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the enhanced form handler
  window.enhancedFormHandler = new EnhancedFormHandler();
  
  // Add connection status monitoring
  window.addEventListener('online', () => {
    document.querySelectorAll('.connection-warning').forEach(el => el.remove());
  });
  
  window.addEventListener('offline', () => {
    const warning = document.createElement('div');
    warning.className = 'connection-warning fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50';
    warning.textContent = 'No internet connection. Your form will be submitted when connection is restored.';
    document.body.appendChild(warning);
  });
});

// Legacy support
window.FormHandler = EnhancedFormHandler; 