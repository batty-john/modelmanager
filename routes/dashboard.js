const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ChildModel = require('../models/ChildModel');
const AdultModel = require('../models/AdultModel');
const User = require('../models/User');
const Client = require('../models/Client');
const Shoot = require('../models/Shoot');
const ModelApproval = require('../models/ModelApproval');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs'); // Added for file deletion
const imageProcessor = require('../utils/imageProcessor');

// Middleware to require login
function requireLogin(req, res, next) {
  console.log('requireLogin middleware - Session:', {
    userId: req.session.userId,
    userEmail: req.session.userEmail,
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : []
  });
  
  if (!req.session.userId) {
    console.log('No userId in session, redirecting to login');
    console.log('Full session object:', req.session);
    return res.redirect('/login');
  }
  console.log('User authenticated, proceeding');
  next();
}

// Admin middleware
async function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findByPk(req.session.userId);
  if (!user || !user.isAdmin) return res.status(403).send('Forbidden: Admins only');
  next();
}

// Client middleware
async function requireClient(req, res, next) {
  if (!req.session.clientId) return res.redirect('/client-login');
  const client = await Client.findByPk(req.session.clientId);
  if (!client || !client.isActive) return res.status(403).send('Forbidden: Active clients only');
  next();
}

// Import the new size calculation utilities
const { calculateChildSize, calculateChildSizes, hasOverlappingSizes } = require('../utils/sizeCalculator');
const { updateChildSizes, getChildrenBySize } = require('../utils/childSizeManager');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Enhanced multer configuration with robust error handling
const multerConfig = { 
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB for professional model photos
    files: 15, // Maximum 15 files (increased for large families)
    fieldSize: 2 * 1024 * 1024, // 2MB for form fields
    fieldNameSize: 100, // 100 bytes for field names
    fields: 150 // Maximum 150 non-file fields (increased for families with 5+ children)
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter - processing file:', file.originalname, 'mimetype:', file.mimetype);
    
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.error('File rejected - not an image:', file.mimetype);
      cb(new Error('Only image files are allowed'), false);
    }
  }
};

// Create multer instances for different use cases with error handling
const upload = multer(multerConfig);
const uploadSingle = multer(multerConfig).single('childPhoto');
const uploadAny = multer(multerConfig).any();

// Enhanced error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  // Log to stderr for cPanel/LiteSpeed environments
  console.error('=== DASHBOARD FORM SUBMISSION FAILED ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Error Type: Multer/Upload Error');
  console.error('Dashboard multer error handler triggered:', err);
  
  if (err instanceof multer.MulterError) {
    console.error('Dashboard multer error details:', {
      code: err.code,
      message: err.message,
      field: err.field,
      stack: err.stack
    });
    
    // Log form data context for debugging
    if (req.body) {
      const fieldCount = Object.keys(req.body).length;
      const childCount = Object.keys(req.body).filter(key => key.startsWith('childName')).length;
      console.error('Form context - Total fields:', fieldCount, 'Children detected:', childCount);
    }
    if (req.files) {
      console.error('Files received:', req.files.length);
    }
    
    let errorMessage = 'File upload error: ' + err.message;
    let statusCode = 400;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
                 errorMessage = 'File is too large. Maximum size is 25MB. Please compress your image or use a smaller file.';
        break;
      case 'LIMIT_FILE_COUNT':
        errorMessage = 'Too many files. Maximum is 10 files per upload.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        errorMessage = 'Unexpected file field. Please check your form configuration.';
        break;
      case 'LIMIT_PART_COUNT':
        errorMessage = 'Too many form parts. Please reduce the number of form fields.';
        break;
      case 'LIMIT_FIELD_KEY':
        errorMessage = 'Field name too long. Please use shorter field names.';
        break;
      case 'LIMIT_FIELD_VALUE':
        errorMessage = 'Field value too large. Please reduce the size of form data.';
        break;
      case 'LIMIT_FIELD_COUNT':
        errorMessage = 'Too many form fields. This can happen with large families (4+ children). Please try submitting fewer children at once, or contact support for assistance with large family registrations.';
        break;
      default:
        errorMessage = `Upload error: ${err.message}`;
    }
    
    console.error('=== END DASHBOARD MULTER ERROR LOG ===');
    return res.status(statusCode).render('error', {
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  } 
  
  // Handle busboy "Unexpected end of form" errors
  if (err.message && err.message.includes('Unexpected end of form')) {
    console.error('Busboy "Unexpected end of form" error:', err);
    return res.status(400).render('error', {
      message: 'The form submission was interrupted. This can happen due to network issues or if you tried to upload files that are too large. Please try again with smaller files or check your internet connection.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Handle other upload-related errors
  if (err.message && (
    err.message.includes('ENOENT') || 
    err.message.includes('EACCES') ||
    err.message.includes('EMFILE') ||
    err.message.includes('ENOSPC')
  )) {
    console.error('File system error:', err);
    return res.status(500).render('error', {
      message: 'Server error processing file upload. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Generic error handler
  if (err) {
    console.error('Generic upload error:', err);
    return res.status(500).render('error', {
      message: 'An error occurred during file upload. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  next();
};

// Helper function to get the best photo path for database storage
function getBestPhotoPath(req, filename, fallbackPath = '') {
  if (!filename) return fallbackPath;
  
  // Check if we have processing results for this file
  if (req.imageProcessingResults) {
    const result = req.imageProcessingResults.find(r => r.filename === filename);
    if (result && result.success) {
      // Use compressed version for storage - this is the optimal size for display
      return result.compressed;
    }
  }
  
  // Fallback to original path
  return `/public/uploads/${filename}`;
}

// Middleware to process uploaded images
const processUploadedImages = async (req, res, next) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next(); // No files to process
  }

  try {
    const filesToProcess = [];
    
    if (req.file) {
      filesToProcess.push(req.file.filename);
    }
    
    if (req.files) {
      req.files.forEach(file => {
        filesToProcess.push(file.filename);
      });
    }

    console.log(`🖼️  Processing ${filesToProcess.length} uploaded images...`);
    
    // Process images in parallel
    const results = await imageProcessor.processImages(filesToProcess);
    
    // Attach processing results to request for use in route handlers
    req.imageProcessingResults = results;
    
    // Log results
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ Successfully processed: ${result.filename}`);
      } else {
        console.log(`⚠️  Failed to process: ${result.filename} - ${result.error}`);
      }
    });

    next();
  } catch (error) {
    console.error('Error in image processing middleware:', error);
    // Don't fail the request if image processing fails, just log and continue
    req.imageProcessingResults = [];
    next();
  }
};

// GET /dashboard
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const children = await ChildModel.findAll({ 
      where: { userId: req.session.userId },
      include: [{
        model: require('../models').ChildSize,
        as: 'sizes',
        required: false
      }]
    });
    const adults = await AdultModel.findAll({ where: { userId: req.session.userId } });
    res.render('dashboard', { 
      userEmail: req.session.userEmail, 
      children, 
      adults,
      imageProcessor: imageProcessor // Pass imageProcessor for view helper
    });
  } catch (err) {
    console.error('Error in GET /dashboard:', err);
    res.status(500).send('Server error');
  }
});

// GET /dashboard/add/child
router.get('/dashboard/add/child', requireLogin, (req, res) => {
  res.render('childForm', { editing: false, formAction: '/dashboard/add/child', child: null, error: null });
});

// POST /dashboard/add/child
router.post('/dashboard/add/child', requireLogin, uploadSingle, handleMulterError, processUploadedImages, async (req, res) => {
  const { childFirstName, childDOB, childGender, childWeight } = req.body;
  if (!childFirstName || !childDOB || !childGender || !childWeight) {
    return res.render('childForm', { editing: false, formAction: '/dashboard/add/child', child: null, error: 'All fields are required.' });
  }
  // Check for duplicate
  const existing = await ChildModel.findOne({
    where: {
      parentEmail: req.session.userEmail,
      childFirstName,
      childDOB,
    }
  });
  if (existing) {
    // Update existing
    await existing.update({
      childGender,
      childWeight,
      photo: req.file ? getBestPhotoPath(req, req.file.filename, existing.photo) : existing.photo,
    });
    return res.redirect('/dashboard');
  } else {
    // Create new
    await ChildModel.create({
      parentName: '', // Optionally fetch from user profile
      parentPhone: '',
      parentEmail: req.session.userEmail,
      childFirstName,
      childDOB,
      childGender,
      childWeight,
      photo: req.file ? getBestPhotoPath(req, req.file.filename, '') : '',
      preferredContact: '',
      facebookProfileLink: '',
      hasModeledBefore: false,
      brandsWorkedWith: '',
    });
    return res.redirect('/dashboard');
  }
});

// GET /dashboard/edit/child/:id
router.get('/dashboard/edit/child/:id', requireLogin, async (req, res) => {
  const child = await ChildModel.findOne({ where: { id: req.params.id, parentEmail: req.session.userEmail } });
  if (!child) {
    return res.redirect('/dashboard');
  }
  res.render('childForm', { editing: true, formAction: `/dashboard/edit/child/${child.id}`, child, error: null });
});

// POST /dashboard/edit/child/:id
router.post('/dashboard/edit/child/:id', requireLogin, uploadSingle, handleMulterError, processUploadedImages, async (req, res) => {
  const { childFirstName, childDOB, childGender, childWeight, childHeight } = req.body;
  const child = await ChildModel.findOne({ where: { id: req.params.id, parentEmail: req.session.userEmail } });
  if (!child) {
    return res.redirect('/dashboard');
  }
  if (!childFirstName || !childDOB || !childGender || !childWeight || !childHeight) {
    return res.render('childForm', { editing: true, formAction: `/dashboard/edit/child/${child.id}`, child, error: 'All fields are required.' });
  }
  // Calculate child size based on weight and height
  const calculatedSize = calculateChildSize(childWeight, childHeight);
  
  await child.update({
    childFirstName,
    childDOB,
    childGender,
    childWeight,
    childHeight,
    childSize: calculatedSize,
    photo: req.file ? getBestPhotoPath(req, req.file.filename, child.photo) : child.photo,
  });
  
  // Update multiple sizes for the child
  await updateChildSizes(child.id, childWeight, childHeight);
  
  res.redirect('/dashboard');
});

// POST /dashboard/delete/child/:id
router.post('/dashboard/delete/child/:id', requireLogin, async (req, res) => {
  const child = await ChildModel.findOne({ where: { id: req.params.id, parentEmail: req.session.userEmail } });
  if (child) {
    await child.destroy();
  }
  res.redirect('/dashboard');
});

// GET /dashboard/edit-family
router.get('/dashboard/edit-family', requireLogin, async (req, res) => {
  // Get user info and all children for this user
  const user = await User.findByPk(req.session.userId);
  const children = await ChildModel.findAll({ 
    where: { userId: req.session.userId },
    include: [{
      model: require('../models').ChildSize,
      as: 'sizes',
      required: false
    }]
  });
  
  res.render('childIntake', {
    success: null,
    errors: null,
    user,
    children,
    dashboardEdit: true
  });
});

// POST /dashboard/edit-family
router.post('/dashboard/edit-family', requireLogin, uploadAny, handleMulterError, processUploadedImages, async (req, res) => {
  try {
  // Enhanced logging for debugging field count issues
  console.log('=== DASHBOARD EDIT-FAMILY SUBMISSION DEBUG ===');
  console.log('Total form fields received:', Object.keys(req.body).length);
  console.log('Total files received:', req.files ? req.files.length : 0);
  console.log('Form fields:', Object.keys(req.body));
  console.log('File fields:', req.files ? req.files.map(f => f.fieldname) : []);
  
  // Count child-specific fields
  const childFields = Object.keys(req.body).filter(key => 
    key.startsWith('childName') || key.startsWith('childDob') || key.startsWith('childGender') || 
    key.startsWith('childWeight') || key.startsWith('childHeight')
  );
  const childCount = Object.keys(req.body).filter(key => key.startsWith('childName')).length;
  console.log(`Detected ${childCount} children with ${childFields.length} child-related fields`);
  console.log('===============================================');
  
  // Parse children from form (moved outside try block)
  const childIndices = Object.keys(req.body)
    .filter(key => key.startsWith('childName'))
    .map(key => key.replace('childName', ''));
    
  try {
    // User-level info
    const parentFirstName = req.body.parentFirstName;
    const parentLastName = req.body.parentLastName;
    const parentPhone = req.body.parentPhone;
    const email = req.body.email;
    const preferredContact = req.body.preferredContact || '';
    const facebookProfileLink = req.body.facebookProfileLink || '';
    const instagramProfileLink = req.body.instagramProfileLink || '';
    const hasModeledBefore = req.body.hasModeled === 'true';
    const brands = req.body.brands || '';

    // Parse children from form
    const photoFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        photoFiles[file.fieldname] = file;
      });
    }

    // Update user with new information
    const user = await User.findByPk(req.session.userId);
    if (user) {
      await user.update({
        parentFirstName,
        parentLastName,
        parentPhone,
        email,
        preferredContact,
        facebookProfileLink,
        instagramProfileLink,
        hasModeledBefore,
        brands
      });
    }

    // Get all existing children for this user (moved before validation)
    const existingChildren = await ChildModel.findAll({ 
      where: { userId: req.session.userId },
      include: [{
        model: require('../models').ChildSize,
        as: 'sizes',
        required: false
      }]
    });
    const existingByKey = {};
    existingChildren.forEach(child => {
      const key = `${child.childFirstName}|${child.childDOB}`;
      existingByKey[key] = child;
    });

    // Validate required fields
    let errors = [];
    if (!parentFirstName || !parentLastName || !parentPhone || !email) {
      errors.push({ msg: 'Parent information is required.' });
    }

    for (const idx of childIndices) {
      const childFirstName = req.body[`childName${idx}`];
      const childDOB = req.body[`childDob${idx}`];
      const childGender = req.body[`childGender${idx}`];
      const childWeight = req.body[`childWeight${idx}`];
      const childHeight = req.body[`childHeight${idx}`];
      const photoFile = photoFiles[`childPhoto${idx}`];
      
      if (!childFirstName || !childDOB || !childGender || !childWeight || !childHeight) {
        errors.push({ msg: `Missing required fields for child ${parseInt(idx) + 1}` });
      }
      // Check if this is a new child (no existing record) and requires a photo
      const key = `${childFirstName}|${childDOB}`;
      const isNewChild = !existingByKey[key];
      if (isNewChild && !photoFile) {
        errors.push({ msg: `Photo is required for new child ${parseInt(idx) + 1}` });
      }
    }

    if (errors.length > 0) {
      console.error('=== DASHBOARD EDIT-FAMILY VALIDATION FAILED ===');
      console.error('Timestamp:', new Date().toISOString());
      console.error('Error Type: Form validation errors');
      console.error('Validation errors:', errors);
      console.error('Children attempted:', childIndices.length);
      console.error('User ID:', req.session.userId);
      console.error('=== END DASHBOARD VALIDATION LOG ===');
      
      // Re-render form with errors
      const children = childIndices.map(idx => ({
        childFirstName: req.body[`childName${idx}`] || '',
        childDOB: req.body[`childDob${idx}`] || '',
        childGender: req.body[`childGender${idx}`] || '',
        childWeight: req.body[`childWeight${idx}`] || '',
        childHeight: req.body[`childHeight${idx}`] || '',
        photo: req.body[`existingPhoto${idx}`] || null
      }));
      const user = {
        parentFirstName: req.body.parentFirstName || '',
        parentLastName: req.body.parentLastName || '',
        parentPhone: req.body.parentPhone || '',
        email: req.body.email || '',
        preferredContact: req.body.preferredContact || '',
        facebookProfileLink: req.body.facebookProfileLink || '',
        instagramProfileLink: req.body.instagramProfileLink || '',
        hasModeledBefore: req.body.hasModeled === 'true',
        brands: req.body.brands || '',
      };
      return res.render('childIntake', {
        success: null,
        errors,
        user,
        children,
        dashboardEdit: true
      });
    }

    const seenKeys = new Set();

    for (const idx of childIndices) {
      const childFirstName = req.body[`childName${idx}`];
      const childDOB = req.body[`childDob${idx}`];
      const childGender = req.body[`childGender${idx}`];
      const childWeight = req.body[`childWeight${idx}`];
      const childHeight = req.body[`childHeight${idx}`];
      const photoFile = photoFiles[`childPhoto${idx}`];
      const key = `${childFirstName}|${childDOB}`;
      seenKeys.add(key);
      // Check if child already has a photo
      let existingPhoto = null;
      if (existingByKey[key]) {
        existingPhoto = existingByKey[key].photo;
      }
      if (existingByKey[key]) {
        // Update existing
        // Calculate child size based on weight and height
        const calculatedSize = calculateChildSize(childWeight, childHeight);
        
        await existingByKey[key].update({
          childGender,
          childWeight,
          childHeight,
          childSize: calculatedSize,
          photo: photoFile ? getBestPhotoPath(req, photoFile.filename, existingPhoto) : existingPhoto,
        });
        
        // Update multiple sizes for existing child
        await updateChildSizes(existingByKey[key].id, childWeight, childHeight);
      } else {
        // Create new
        // Calculate child size based on weight and height
        const calculatedSize = calculateChildSize(childWeight, childHeight);
        
        const newChild = await ChildModel.create({
          childFirstName,
          childLastName: null, // Always null, only editable from admin dashboard
          childDOB,
          childGender,
          childWeight,
          childHeight,
          childSize: calculatedSize,
          photo: photoFile ? getBestPhotoPath(req, photoFile.filename, '') : '',
          userId: req.session.userId,
        });
        
        // Set up multiple sizes for new child
        await updateChildSizes(newChild.id, childWeight, childHeight);
      }
    }
    // Remove children that were deleted from the form
    for (const key in existingByKey) {
      if (!seenKeys.has(key)) {
        await existingByKey[key].destroy();
      }
    }
    
    // Log successful submission to stderr for monitoring
    console.error('=== DASHBOARD EDIT-FAMILY SUBMITTED SUCCESSFULLY ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Children processed:', childIndices.length);
    console.error('User ID:', req.session.userId);
    console.error('=== END SUCCESSFUL DASHBOARD SUBMISSION LOG ===');
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('=== DASHBOARD EDIT-FAMILY SUBMISSION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type: Route processing error');
    console.error('Error in edit-family route:', err);
    console.error('Error stack:', err.stack);
    console.error('User ID:', req.session.userId);
    console.error('Children being processed:', childIndices.length);
    console.error('Request body keys:', Object.keys(req.body || {}));
    console.error('Request files count:', req.files ? req.files.length : 0);
    console.error('=== END DASHBOARD ERROR LOG ===');
    
    // Handle any unexpected errors
    const children = childIndices.map(idx => ({
      childFirstName: req.body[`childName${idx}`] || '',
      childDOB: req.body[`childDob${idx}`] || '',
      childGender: req.body[`childGender${idx}`] || '',
      childWeight: req.body[`childWeight${idx}`] || '',
      childHeight: req.body[`childHeight${idx}`] || '',
      photo: req.body[`existingPhoto${idx}`] || null
    }));
    const user = {
      parentFirstName: req.body.parentFirstName || '',
      parentLastName: req.body.parentLastName || '',
      parentPhone: req.body.parentPhone || '',
      email: req.body.email || '',
      preferredContact: req.body.preferredContact || '',
      facebookProfileLink: req.body.facebookProfileLink || '',
      instagramProfileLink: req.body.instagramProfileLink || '',
      hasModeledBefore: req.body.hasModeled === 'true',
      brands: req.body.brands || '',
    };
    return res.render('childIntake', {
      success: null,
      errors: [{ msg: 'An error occurred while saving your information. Please try again.' }],
      user,
      children,
      dashboardEdit: true
    });
  }
  } catch (unexpectedErr) {
    // Catch-all for any unexpected errors in the entire route
    console.error('=== DASHBOARD EDIT-FAMILY SUBMISSION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type: Unexpected route error');
    console.error('Unexpected error in dashboard route:', unexpectedErr);
    console.error('Error stack:', unexpectedErr.stack);
    console.error('User ID:', req.session.userId);
    console.error('Request body keys:', Object.keys(req.body || {}));
    console.error('Request files count:', req.files ? req.files.length : 0);
    console.error('=== END DASHBOARD ERROR LOG ===');
    
    return res.render('error', {
      message: 'An unexpected error occurred. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? unexpectedErr : {}
    });
  }
});

// GET /dashboard/edit-adult
router.get('/dashboard/edit-adult', requireLogin, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  let adults = await AdultModel.findAll({ where: { userId: req.session.userId } });
  // Ensure at least one adult for the form
  if (!adults.length) {
    adults = [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }];
  }
  // For the first adult, pre-populate email and phone from user
  adults[0].email = user.email || '';
  adults[0].phone = user.parentPhone || '';
  res.render('adultIntake', {
    adults,
    user,
    errors: [],
    dashboardEdit: true
  });
});

// POST /dashboard/edit-adult
router.post('/dashboard/edit-adult', requireLogin, uploadAny, handleMulterError, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');
    const adultIndices = Object.keys(req.body)
      .filter(key => key.startsWith('firstName'))
      .map(key => key.replace('firstName', ''));
    const photoFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        photoFiles[file.fieldname] = file;
        const idx = file.fieldname.replace('adultPhoto', '');
        req.body[`photo${idx}`] = '/public/uploads/' + file.filename;
      });
    }
    // Fetch all existing adults for this user
    const existingAdults = await AdultModel.findAll({ where: { userId } });
    const processedKeys = new Set();
    let errors = [];
    for (const idx of adultIndices) {
      const adultId = req.body[`adultId${idx}`];
      const firstName = req.body[`firstName${idx}`];
      const lastName = req.body[`lastName${idx}`];
      const email = req.body[`email${idx}`];
      const phone = req.body[`phone${idx}`];
      const gender = req.body[`gender${idx}`];
      const size = req.body[`size${idx}`];
      const photo = req.body[`photo${idx}`] || '';
      let adult = null;
      if (adultId) {
        adult = existingAdults.find(a => a.id == adultId);
      }
      processedKeys.add(adultId ? adultId : `${firstName}|${lastName}`);
      if (adult) {
        // Update existing, do not require new photo
        await adult.update({
          firstName,
          lastName,
          email,
          phone,
          gender,
          size,
          photo: photo || adult.photo,
        });
      } else {
        // Create new
        const newAdult = await AdultModel.create({
          firstName,
          lastName,
          email,
          phone,
          gender,
          size,
          photo,
          userId
        });
        processedKeys.add(newAdult.id.toString());
      }
    }

    // Update user with new information
    const user = await User.findByPk(req.session.userId);
    if (user) {
      await user.update({
        parentName: req.body['firstName0'] + ' ' + req.body['lastName0'],
        parentPhone: req.body['phone0'],
        email: req.body['email0'],
        preferredContact: req.body.preferredContact,
        facebookProfileLink: req.body.facebookProfileLink,
        instagramProfileLink: req.body.instagramProfileLink,
        hasModeledBefore: req.body.hasModeled === 'true',
        brands: req.body.brands || null
      });
    }

    // Delete any adults not in the current submission
    for (const adult of existingAdults) {
      if (!processedKeys.has(adult.id.toString())) {
        await adult.destroy();
      }
    }
    if (errors.length) {
      const adults = await AdultModel.findAll({ where: { userId } });
      const user = await User.findByPk(req.session.userId);
      return res.render('adultIntake', {
        adults: adults.length ? adults : [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
        user,
        errors
      });
    }
    return res.redirect('/dashboard');
  } catch (err) {
    const adults = await AdultModel.findAll({ where: { userId: req.session.userId } });
    const user = await User.findByPk(req.session.userId);
    res.render('adultIntake', {
      adults: adults.length ? adults : [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user,
      errors: [{ msg: 'Error saving adult info.' }]
    });
  }
});

// GET /admin/models (Admin dashboard for all models)
router.get('/admin/models', requireAdmin, async (req, res) => {
  // Extract filters and sorting from query params
  const { gender, minAge, maxAge, weight, size, brands, excludeBrands, modelType, sort, view, clientId, shootId, approvalStatus, page, limit } = req.query;

  // For now, load everything on initial render (disable pagination)
  const currentPage = 1;
  const itemsPerPage = Number.MAX_SAFE_INTEGER;
  const offset = 0;
  
  // Build queries for adults and children
  const adultWhere = {};
  const childWhere = {};
  if (gender) {
    adultWhere.gender = gender;
    childWhere.childGender = gender;
  }
  if (size) {
    adultWhere.size = size;
  }
  
  // Add more filters as needed (age, weight, brands, etc.)
  // Fetch adults and children with pagination
  let adults = [];
  let children = [];
  let totalAdults = 0;
  let totalChildren = 0;

  if (modelType !== 'child') {
    // Get total count
    totalAdults = await AdultModel.count({ where: adultWhere });

    // Fetch all adults
    adults = await AdultModel.findAll({
      where: adultWhere,
      order: [['createdAt', 'DESC']] // Default ordering
    });
  }

  if (modelType !== 'adult') {
    if (size) {
      // For size filtering, find children that have this size in their ChildSizes
      const childIds = await getChildrenBySize(size);
      if (childIds.length > 0) {
        childWhere.id = { [require('sequelize').Op.in]: childIds };
      } else {
        // No children match this size, return empty array
        childWhere.id = -1; // This will match no records
      }
    }

    // Get total count
    totalChildren = await ChildModel.count({
      where: childWhere,
      include: [{
        model: require('../models').ChildSize,
        as: 'sizes',
        required: false
      }]
    });

    // Fetch all children
    children = await ChildModel.findAll({
      where: childWhere,
      include: [{
        model: require('../models').ChildSize,
        as: 'sizes',
        required: false
      }],
      order: [['createdAt', 'DESC']] // Default ordering
    });
  }

  // Calculate pagination info
  const totalItems = totalAdults + totalChildren;
  const hasNextPage = false;
  const hasPrevPage = false;

  // Fetch and merge user-level fields for each adult
  for (const adult of adults) {
    if (adult.userId) {
      const user = await User.findByPk(adult.userId);
      if (user) {
        adult.brandsWorkedWith = user.brands || '';
        adult.phone = user.parentPhone || '';
        adult.email = user.email || '';
        adult.preferredContact = user.preferredContact || '';
        adult.facebookProfileLink = user.facebookProfileLink || '';
        adult.instagramProfileLink = user.instagramProfileLink || '';
        adult.parentFirstName = user.parentFirstName || '';
        adult.parentLastName = user.parentLastName || '';
      }
    }
  }
  
  // Fetch and merge user-level fields for each child
  for (const child of children) {
    if (child.userId) {
      const user = await User.findByPk(child.userId);
      if (user) {
        child.brandsWorkedWith = user.brands || '';
        child.parentPhone = user.parentPhone || '';
        child.parentEmail = user.email || '';
        child.preferredContact = user.preferredContact || '';
        child.facebookProfileLink = user.facebookProfileLink || '';
        child.instagramProfileLink = user.instagramProfileLink || '';
        child.parentFirstName = user.parentFirstName || '';
        child.parentLastName = user.parentLastName || '';
      }
    }
  }

  // If a shoot is selected, fetch approval status for all models
  if (shootId) {
    // Fetch approval status for adults
    for (const adult of adults) {
      const approval = await ModelApproval.findOne({
        where: { shootId, modelType: 'adult', modelId: adult.id }
      });
      adult.approvalStatus = approval ? approval.approvalStatus : null;
      adult.approvalNotes = approval ? approval.notes : null;
    }
    
    // Fetch approval status for children
    for (const child of children) {
      const approval = await ModelApproval.findOne({
        where: { shootId, modelType: 'child', modelId: child.id }
      });
      child.approvalStatus = approval ? approval.approvalStatus : null;
      child.approvalNotes = approval ? approval.notes : null;
    }
    
    // Filter by approval status if specified
    if (approvalStatus !== undefined && approvalStatus !== '') {
      const status = parseInt(approvalStatus);
      adults = adults.filter(adult => adult.approvalStatus === status);
      children = children.filter(child => child.approvalStatus === status);
    }
  }

  // Fetch clients and shoots for dropdowns
  const clients = await Client.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']]
  });
  
  let shoots = [];
  if (clientId) {
    shoots = await Shoot.findAll({
      where: { clientId, isActive: true },
      order: [['createdAt', 'DESC']]
    });
  }





  // Pass everything to the template
  res.render('adminModels', {
    adults,
    children,
    filters: req.query,
    modelType: req.query.modelType || '',
    size: req.query.size || '',
    viewMode: view || 'spreadsheet',
    sort,
    clients,
    shoots,
    selectedClientId: clientId,
    selectedShootId: shootId,
    // Pagination data
    pagination: {
      currentPage,
      itemsPerPage,
      totalItems,
      totalAdults,
      totalChildren,
      hasNextPage,
      hasPrevPage,
      totalPages: Math.ceil(totalItems / itemsPerPage)
    }
  });
});

// Debug endpoint for checking raw model data
router.get('/admin/models/debug', requireAdmin, async (req, res) => {
  try {
    const adults = await AdultModel.findAll({ limit: 2 });
    const children = await ChildModel.findAll({ limit: 2 });

    res.json({
      adults: adults.map(a => ({ id: a.id, userId: a.userId, firstName: a.firstName })),
      children: children.map(c => ({ id: c.id, userId: c.userId, childFirstName: c.childFirstName }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Debug endpoint for checking user data
router.get('/admin/models/debug-users', requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.query;

    if (!userIds) {
      return res.json({ error: 'userIds parameter required' });
    }

    const ids = userIds.split(',').map(id => parseInt(id.trim()));

    const users = [];
    for (const userId of ids) {
      try {
        const user = await User.findByPk(userId);
        users.push({
          userId,
          found: !!user,
          data: user ? {
            email: user.email,
            parentPhone: user.parentPhone,
            brands: user.brands,
            facebookProfileLink: user.facebookProfileLink,
            instagramProfileLink: user.instagramProfileLink
          } : null
        });
      } catch (error) {
        users.push({
          userId,
          found: false,
          error: error.message
        });
      }
    }

    res.json({ users });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// API endpoint for loading more models (lazy pagination)
router.get('/admin/models/api', requireAdmin, async (req, res) => {
  try {
    // Extract filters and pagination from query params
    const { gender, minAge, maxAge, weight, size, brands, excludeBrands, modelType, sort, clientId, shootId, approvalStatus, page, limit } = req.query;

    // Pagination settings
    const currentPage = parseInt(page) || 1;
    const itemsPerPage = parseInt(limit) || 25;
    const offset = (currentPage - 1) * itemsPerPage;

    // Build queries for adults and children
    const adultWhere = {};
    const childWhere = {};

    if (gender) {
      adultWhere.gender = gender;
      childWhere.childGender = gender;
    }
    if (size) {
      adultWhere.size = size;
    }

    // Calculate total items for pagination
    let totalAdults = 0;
    let totalChildren = 0;

    if (modelType !== 'child') {
      totalAdults = await AdultModel.count({ where: adultWhere });
    }

    if (modelType !== 'adult') {
      if (size) {
        const childIds = await getChildrenBySize(size);
        if (childIds.length > 0) {
          childWhere.id = { [require('sequelize').Op.in]: childIds };
        } else {
          childWhere.id = -1;
        }
      }
      totalChildren = await ChildModel.count({
        where: childWhere,
        include: [{
          model: require('../models').ChildSize,
          as: 'sizes',
          required: false
        }]
      });
    }

    const totalItems = totalAdults + totalChildren;

    // Fetch adults and children with pagination
    let adults = [];
    let children = [];

    if (modelType !== 'child') {
      adults = await AdultModel.findAll({
        where: adultWhere,
        limit: itemsPerPage,
        offset: offset,
        order: [['createdAt', 'DESC']]
      });
    }

    if (modelType !== 'adult') {
      // Apply size filter for fetch (same as count)
      if (size) {
        const childIds = await getChildrenBySize(size);
        if (childIds.length > 0) {
          childWhere.id = { [require('sequelize').Op.in]: childIds };
        } else {
          childWhere.id = -1;
        }
      }

      children = await ChildModel.findAll({
        where: childWhere,
        include: [{
          model: require('../models').ChildSize,
          as: 'sizes',
          required: false
        }],
        limit: itemsPerPage,
        offset: offset,
        order: [['createdAt', 'DESC']]
      });
    }

    // Process user data for adults (same as original route)
    for (const adult of adults) {
      if (adult.userId) {
        try {
          const user = await User.findByPk(adult.userId);
          if (user) {
            adult.brandsWorkedWith = user.brands || '';
            adult.phone = user.parentPhone || '';
            adult.email = user.email || '';
            adult.preferredContact = user.preferredContact || '';
            adult.facebookProfileLink = user.facebookProfileLink || '';
            adult.instagramProfileLink = user.instagramProfileLink || '';
            adult.parentFirstName = user.parentFirstName || '';
            adult.parentLastName = user.parentLastName || '';
          } else {
            console.log(`API: User not found for adult ${adult.id}, userId: ${adult.userId}`);
          }
        } catch (error) {
          console.log(`API: Error finding user for adult ${adult.id}:`, error.message);
        }
      }
    }

    // Process user data for children (same as original route)
    for (const child of children) {
      if (child.userId) {
        try {
          const user = await User.findByPk(child.userId);
          if (user) {
            child.brandsWorkedWith = user.brands || '';
            child.parentPhone = user.parentPhone || '';
            child.parentEmail = user.email || '';
            child.preferredContact = user.preferredContact || '';
            child.facebookProfileLink = user.facebookProfileLink || '';
            child.instagramProfileLink = user.instagramProfileLink || '';
            child.parentFirstName = user.parentFirstName || '';
            child.parentLastName = user.parentLastName || '';
          } else {
            console.log(`API: User not found for child ${child.id}, userId: ${child.userId}`);
          }
        } catch (error) {
          console.log(`API: Error finding user for child ${child.id}:`, error.message);
        }
      }
    }



    // If a shoot is selected, fetch approval status
    if (shootId) {
      for (const adult of adults) {
        const approval = await ModelApproval.findOne({
          where: { shootId, modelType: 'adult', modelId: adult.id }
        });
        adult.approvalStatus = approval ? approval.approvalStatus : null;
      }

      for (const child of children) {
        const approval = await ModelApproval.findOne({
          where: { shootId, modelType: 'child', modelId: child.id }
        });
        child.approvalStatus = approval ? approval.approvalStatus : null;
      }
    }

    // Calculate total items for this page
    const pageItemCount = adults.length + children.length;
    const loadedSoFar = (currentPage - 1) * itemsPerPage + pageItemCount;
    const hasMore = loadedSoFar < totalItems && pageItemCount > 0;

    console.log('API Pagination Debug:', {
      currentPage,
      itemsPerPage,
      pageItemCount,
      totalItems,
      loadedSoFar,
      hasMore,
      totalAdults,
      totalChildren
    });

    // Return JSON response
    res.json({
      success: true,
      data: {
        adults,
        children,
        pagination: {
          currentPage,
          itemsPerPage,
          hasMore: hasMore,
          totalItems: totalItems,
          loadedItems: loadedSoFar
        }
      }
    });

  } catch (error) {
    console.error('Error loading more models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load more models'
    });
  }
});

// Redirect /admin/dashboard to /admin/models for admin dashboard entry point
router.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.redirect('/admin/models');
});

// Inline update endpoint for admin model editing
router.post('/admin/models/update', requireAdmin, async (req, res) => {
  try {
    const { modelType, id, name, gender, dob, weight, size, brands, phone, email, preferredContact, socialLink } = req.body;
    if (!modelType || !id) return res.status(400).json({ error: 'Missing fields' });
    if (modelType === 'adult') {
      const adult = await AdultModel.findByPk(id);
      if (!adult) return res.status(404).json({ error: 'Adult not found' });
      // Split name into first and last if provided
      if (name) {
        const [firstName, ...lastNameArr] = name.split(' ');
        adult.firstName = firstName;
        adult.lastName = lastNameArr.join(' ');
      }
      if (gender) adult.gender = gender;
      if (dob !== undefined) {
        // Handle empty or invalid date values
        if (dob === '' || dob === null || dob === 'Invalid date') {
          adult.dob = null;
        } else {
          // Validate the date format
          const dateObj = new Date(dob);
          if (isNaN(dateObj.getTime())) {
            adult.dob = null;
          } else {
            adult.dob = dob;
          }
        }
      }
      if (size) adult.size = size;
      // Per-user fields
      const userFields = {};
      if (phone !== undefined) userFields.parentPhone = phone;
      if (email !== undefined) userFields.email = email;
      if (preferredContact !== undefined) userFields.preferredContact = preferredContact;
      if (brands !== undefined) userFields.brands = brands;
      if (socialLink !== undefined) {
        // Save to facebookProfileLink if it looks like Facebook, else Instagram
        if (socialLink.toLowerCase().includes('facebook.com')) userFields.facebookProfileLink = socialLink;
        else userFields.instagramProfileLink = socialLink;
      }
      if (Object.keys(userFields).length > 0) {
        await User.update(userFields, { where: { id: adult.userId } });
      }
      await adult.save();
      return res.json({ success: true });
    } else if (modelType === 'child') {
      const child = await ChildModel.findByPk(id);
      if (!child) return res.status(404).json({ error: 'Child not found' });
      if (name) {
        const [firstName, ...lastNameArr] = name.split(' ');
        child.childFirstName = firstName;
        child.childLastName = lastNameArr.join(' ');
      }
      if (gender) child.childGender = gender;
      if (dob !== undefined) {
        // Handle empty or invalid date values
        if (dob === '' || dob === null || dob === 'Invalid date') {
          child.childDOB = null;
        } else {
          // Validate the date format
          const dateObj = new Date(dob);
          if (isNaN(dateObj.getTime())) {
            child.childDOB = null;
          } else {
            child.childDOB = dob;
          }
        }
      }
      if (weight !== undefined) child.childWeight = weight;
      if (height !== undefined) child.childHeight = height;
      
      // Auto-update sizes if weight or height changed
      if (weight !== undefined || height !== undefined) {
        await updateChildSizes(child.id, child.childWeight, child.childHeight);
      }
      
      // Per-user fields
      const userFields = {};
      if (phone !== undefined) userFields.parentPhone = phone;
      if (email !== undefined) userFields.email = email;
      if (preferredContact !== undefined) userFields.preferredContact = preferredContact;
      if (brands !== undefined) userFields.brands = brands;
      if (socialLink !== undefined) {
        if (socialLink.toLowerCase().includes('facebook.com')) userFields.facebookProfileLink = socialLink;
        else userFields.instagramProfileLink = socialLink;
      }
      if (Object.keys(userFields).length > 0) {
        await User.update(userFields, { where: { id: child.userId } });
      }
      await child.save();
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Invalid model type' });
    }
  } catch (err) {
    console.error('Error in /admin/models/update:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Calculate sizes endpoint for admin (for real-time size preview)
router.post('/admin/models/calculate-sizes', requireAdmin, async (req, res) => {
  try {
    const { weight, height } = req.body;
    
    if (!weight || !height) {
      return res.status(400).json({ error: 'Weight and height are required' });
    }
    
    const sizes = require('../utils/sizeCalculator').calculateChildSizes(weight, height);
    
    res.json({ sizes });
  } catch (error) {
    console.error('Error calculating sizes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete model endpoint for admin
router.post('/admin/models/delete', requireAdmin, async (req, res) => {
  try {
    const { modelType, id } = req.body;
    if (!modelType || !id) return res.status(400).json({ error: 'Missing fields' });
    
    if (modelType === 'adult') {
      const adult = await AdultModel.findByPk(id);
      if (!adult) return res.status(404).json({ error: 'Adult not found' });
      
      // Delete associated photo file if it exists
      if (adult.photo && adult.photo !== '/public/logo.jpg') {
        const photoPath = path.join(__dirname, '..', 'public', adult.photo.replace('/public/', ''));
        try {
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
          }
        } catch (err) {
          console.error('Error deleting photo file:', err);
        }
      }
      
      await adult.destroy();
      return res.json({ success: true });
    } else if (modelType === 'child') {
      const child = await ChildModel.findByPk(id);
      if (!child) return res.status(404).json({ error: 'Child not found' });
      
      // Delete associated photo file if it exists
      if (child.photo && child.photo !== '/public/logo.jpg') {
        const photoPath = path.join(__dirname, '..', 'public', child.photo.replace('/public/', ''));
        try {
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
          }
        } catch (err) {
          console.error('Error deleting photo file:', err);
        }
      }
      
      await child.destroy();
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Invalid model type' });
    }
  } catch (err) {
    console.error('Error in /admin/models/delete:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes for managing clients and shoots

// GET /admin/clients - List all clients
router.get('/admin/clients', requireAdmin, async (req, res) => {
  try {
    const clients = await Client.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/clients - Create new client
router.post('/admin/clients', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, ineligibleBrands } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    // Check if client already exists
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create client
    const client = await Client.create({
      name,
      email,
      passwordHash,
      ineligibleBrands: JSON.stringify(ineligibleBrands || [])
    });
    
    res.json({ success: true, client });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/shoots/:clientId - Get shoots for a client
router.get('/admin/shoots/:clientId', requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const shoots = await Shoot.findAll({
      where: { clientId, isActive: true },
      order: [['createdAt', 'DESC']]
    });
    res.json(shoots);
  } catch (err) {
    console.error('Error fetching shoots:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/shoots - Create new shoot
router.post('/admin/shoots', requireAdmin, async (req, res) => {
  try {
    const { clientId, name, description, shootDate } = req.body;
    
    if (!clientId || !name) {
      return res.status(400).json({ error: 'Client ID and name are required' });
    }
    
    // Check if client exists
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(400).json({ error: 'Client not found' });
    }
    
    // Create shoot
    const shoot = await Shoot.create({
      clientId,
      name,
      description,
      shootDate: shootDate || null
    });
    
    res.json({ success: true, shoot });
  } catch (err) {
    console.error('Error creating shoot:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/model-approvals - Update model approval status
router.post('/admin/model-approvals', requireAdmin, async (req, res) => {
  try {
    const { shootId, modelType, modelId, approvalStatus, notes } = req.body;
    
    if (!shootId || !modelType || !modelId) {
      return res.status(400).json({ error: 'Shoot ID, model type, and model ID are required' });
    }
    
    // Find or create approval record
    const [approval, created] = await ModelApproval.findOrCreate({
      where: { shootId, modelType, modelId },
      defaults: { approvalStatus, notes }
    });
    
    if (!created) {
      // Update existing record
      await approval.update({ approvalStatus, notes });
    }
    
    res.json({ success: true, approval });
  } catch (err) {
    console.error('Error updating model approval:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/model-approvals/shoot/:shootId - Get all approval statuses for a shoot
router.get('/admin/model-approvals/shoot/:shootId', requireAdmin, async (req, res) => {
  try {
    const { shootId } = req.params;
    
    const approvals = await ModelApproval.findAll({
      where: { shootId },
      attributes: ['modelType', 'modelId', 'approvalStatus', 'notes']
    });
    
    res.json(approvals);
  } catch (err) {
    console.error('Error fetching shoot approvals:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Client
router.post('/admin/clients/update', async (req, res) => {
  try {
    const { clientId, name, email, ineligibleBrands } = req.body;
    
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await client.update({
      name: name,
      email: email,
      ineligibleBrands: ineligibleBrands
    });

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Error updating client' });
  }
});

// Reset Client Password
router.post('/admin/clients/reset-password', async (req, res) => {
  try {
    const { clientId, newPassword } = req.body;
    
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Hash the new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await client.update({
      passwordHash: hashedPassword
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Delete Client
router.post('/admin/clients/delete', async (req, res) => {
  try {
    const { clientId } = req.body;
    
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete associated shoots first
    await Shoot.destroy({ where: { clientId: clientId } });
    
    // Delete the client
    await client.destroy();

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Error deleting client' });
  }
});

// Update Shoot
router.post('/admin/shoots/update', async (req, res) => {
  try {
    const { shootId, name, description, shootDate } = req.body;
    
    const shoot = await Shoot.findByPk(shootId);
    if (!shoot) {
      return res.status(404).json({ error: 'Shoot not found' });
    }

    await shoot.update({
      name: name,
      description: description,
      shootDate: shootDate
    });

    res.json({ success: true, message: 'Shoot updated successfully' });
  } catch (error) {
    console.error('Error updating shoot:', error);
    res.status(500).json({ error: 'Error updating shoot' });
  }
});

// Delete Shoot
router.post('/admin/shoots/delete', async (req, res) => {
  try {
    const { shootId } = req.body;
    
    const shoot = await Shoot.findByPk(shootId);
    if (!shoot) {
      return res.status(404).json({ error: 'Shoot not found' });
    }

    // Delete associated model approvals first
    await ModelApproval.destroy({ where: { shootId: shootId } });
    
    // Delete the shoot
    await shoot.destroy();

    res.json({ success: true, message: 'Shoot deleted successfully' });
  } catch (error) {
    console.error('Error deleting shoot:', error);
    res.status(500).json({ error: 'Error deleting shoot' });
  }
});

// Client Dashboard Routes

// GET /client/dashboard - Client dashboard for reviewing models
router.get('/client/dashboard', requireClient, async (req, res) => {
  try {
    const { shootId, gender, size, approvalStatus } = req.query;
    
    // Get client info
    const client = await Client.findByPk(req.session.clientId);
    
    // Get all shoots for this client
    const shoots = await Shoot.findAll({
      where: { clientId: req.session.clientId, isActive: true },
      order: [['createdAt', 'DESC']]
    });
    
    // If no shoot is selected, show the first one or empty state
    let selectedShootId = shootId;
    if (!selectedShootId && shoots.length > 0) {
      selectedShootId = shoots[0].id;
    }
    
    // Build queries for adults and children
    const adultWhere = {};
    const childWhere = {};
    
    if (gender) {
      adultWhere.gender = gender;
      childWhere.childGender = gender;
    }
    if (size) {
      adultWhere.size = size;
    }
    
    // Fetch all adults and children
    let adults = await AdultModel.findAll({ where: adultWhere });
    
    let children = [];
    if (size) {
      // For size filtering, find children that have this size in their ChildSizes
      const childIds = await getChildrenBySize(size);
      if (childIds.length > 0) {
        childWhere.id = { [require('sequelize').Op.in]: childIds };
      } else {
        // No children match this size, return empty array
        childWhere.id = -1; // This will match no records
      }
    }
    children = await ChildModel.findAll({ 
      where: childWhere,
      include: [{
        model: require('../models').ChildSize,
        as: 'sizes',
        required: false
      }]
    });
    
    // Fetch and merge user-level fields for each adult
    for (const adult of adults) {
      if (adult.userId) {
        const user = await User.findByPk(adult.userId);
        if (user) {
          adult.brandsWorkedWith = user.brands || '';
          adult.phone = user.parentPhone || '';
          adult.email = user.email || '';
          adult.preferredContact = user.preferredContact || '';
          adult.facebookProfileLink = user.facebookProfileLink || '';
          adult.instagramProfileLink = user.instagramProfileLink || '';
          adult.parentFirstName = user.parentFirstName || '';
          adult.parentLastName = user.parentLastName || '';
        }
      }
    }
    
    // Fetch and merge user-level fields for each child
    for (const child of children) {
      if (child.userId) {
        const user = await User.findByPk(child.userId);
        if (user) {
          child.brandsWorkedWith = user.brands || '';
          child.parentPhone = user.parentPhone || '';
          child.parentEmail = user.email || '';
          child.preferredContact = user.preferredContact || '';
          child.facebookProfileLink = user.facebookProfileLink || '';
          child.instagramProfileLink = user.instagramProfileLink || '';
          child.parentFirstName = user.parentFirstName || '';
          child.parentLastName = user.parentLastName || '';
        }
      }
    }
    
    // If a shoot is selected, fetch approval status for all models
    if (selectedShootId) {
      // Fetch approval status for adults
      for (const adult of adults) {
        const approval = await ModelApproval.findOne({
          where: { shootId: selectedShootId, modelType: 'adult', modelId: adult.id }
        });
        adult.approvalStatus = approval ? approval.approvalStatus : null;
        adult.approvalNotes = approval ? approval.notes : null;
      }
      
      // Fetch approval status for children
      for (const child of children) {
        const approval = await ModelApproval.findOne({
          where: { shootId: selectedShootId, modelType: 'child', modelId: child.id }
        });
        child.approvalStatus = approval ? approval.approvalStatus : null;
        child.approvalNotes = approval ? approval.notes : null;
      }
      
      // Filter by approval status if specified
      if (approvalStatus !== undefined && approvalStatus !== '') {
        const status = approvalStatus === 'null' ? null : parseInt(approvalStatus);
        adults = adults.filter(adult => adult.approvalStatus === status);
        children = children.filter(child => child.approvalStatus === status);
      }
    }
    
    res.render('clientDashboard', {
      client,
      shoots,
      selectedShootId,
      adults,
      children,
      filters: req.query
    });
  } catch (err) {
    console.error('Error in client dashboard:', err);
    res.status(500).send('Server error');
  }
});

// POST /client/approval - Update model approval status (client version)
router.post('/client/approval', requireClient, async (req, res) => {
  try {
    const { shootId, modelType, modelId, approvalStatus, notes } = req.body;
    
    if (!shootId || !modelType || !modelId) {
      return res.status(400).json({ error: 'Shoot ID, model type, and model ID are required' });
    }
    
    // Verify the shoot belongs to this client
    const shoot = await Shoot.findOne({
      where: { id: shootId, clientId: req.session.clientId }
    });
    
    if (!shoot) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Find or create approval record
    const [approval, created] = await ModelApproval.findOrCreate({
      where: { shootId, modelType, modelId },
      defaults: { approvalStatus, notes }
    });
    
    if (!created) {
      // Update existing record
      await approval.update({ approvalStatus, notes });
    }
    
    res.json({ success: true, approval });
  } catch (err) {
    console.error('Error updating model approval:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /client/shoots - Create new shoot (client version)
router.post('/client/shoots', requireClient, async (req, res) => {
  try {
    const { name, description, shootDate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Shoot name is required' });
    }
    
    // Create shoot for this client
    const shoot = await Shoot.create({
      clientId: req.session.clientId,
      name,
      description,
      shootDate: shootDate || null
    });
    
    res.json({ success: true, shoot });
  } catch (err) {
    console.error('Error creating shoot:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Client Management Page
router.get('/admin/clients/manage', async (req, res) => {
  try {
    const clients = await Client.findAll({
      order: [['createdAt', 'DESC']]
    });

    // Get shoots for each client separately
    for (let client of clients) {
      const shoots = await Shoot.findAll({
        where: { clientId: client.id },
        order: [['createdAt', 'DESC']]
      });
      client.dataValues.shoots = shoots;
    }

    res.render('adminClients', {
      clients: clients,
      user: req.user
    });
  } catch (error) {
    console.error('Error loading client management page:', error);
    res.status(500).send('Error loading client management page');
  }
});

module.exports = router; 