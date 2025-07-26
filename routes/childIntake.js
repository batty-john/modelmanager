const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const ChildModel = require('../models/ChildModel');
const User = require('../models/User');
const crypto = require('crypto');

// Asynchronous email sending function
async function sendWelcomeEmailAsync(email, password) {
  // Use setImmediate to send email asynchronously without blocking the response
  setImmediate(async () => {
    try {
      console.log(`🔄 Sending welcome email to ${email}...`);
      
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
      
      const loginUrl = process.env.BASE_URL || 'http://localhost:3000';
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Annie Jean Photography Login',
        text: `Thank you for registering!\n\nYou can log in to update your information at: ${loginUrl}/login\n\nEmail: ${email}\nPassword: ${password}\n\nPlease keep this information safe.`
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent successfully to ${email}`);
      
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
      
      // Log specific email error details for debugging
      if (error.code === 'EENVELOPE') {
        console.error(`📧 Email delivery failed - recipient rejected: ${email}`);
        console.error(`📧 This usually means the email address doesn't exist or is blacklisted`);
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`📧 Email sending timed out for: ${email}`);
      } else if (error.code === 'ECONNECTION') {
        console.error(`📧 Email server connection failed`);
      }
      
      // TODO: In production, you might want to:
      // - Store failed emails in a queue for retry
      // - Send admin notification about email failures
      // - Log to external monitoring service
    }
  });
}

// Function to calculate child size based on weight and height
function calculateChildSize(weight, height) {
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  
  if (isNaN(weightNum) || isNaN(heightNum)) {
    return null;
  }
  
  // Complete size chart based on weight ranges (defaulting to larger size for overlaps)
  // Check from largest to smallest to default to larger sizes in overlaps
  
  // Very large children
  if (weightNum >= 72) {
    return '10Y-12Y';
  } else if (weightNum >= 49) {
    return '7Y-8Y';
  } else if (weightNum >= 39) {
    return '5T-6T'; // Fixed capitalization
  } else if (weightNum >= 31) {
    return '3T-4T';
  } else if (weightNum >= 28) {
    return '2T';
  } else if (weightNum >= 25) {
    return '18-24 Months';
  } else if (weightNum >= 22) {
    return '12-18 Months';
  }
  // Handle overlapping ranges for smaller sizes (default to larger/older size)
  else if (weightNum >= 20) {
    return '9-12 Months'; // Larger of the overlapping options
  } else if (weightNum >= 17) {
    return '6-12 Months'; // Larger of the overlapping options  
  } else if (weightNum >= 12) {
    return '3-6 Months';
  } else if (weightNum >= 9) {
    return '0-3 Months';
  } else if (weightNum >= 6) {
    return 'Newborn';
  } else if (weightNum >= 0) {
    return 'Preemie';
  }
  
  // Handle edge cases
  if (weightNum > 101) {
    return '10Y-12Y';  // Very large children default to largest size
  }
  
  return null; // Should rarely reach here now
}

// Enhanced multer configuration with robust error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const multerConfig = { 
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB for professional model photos
    files: 10, // Maximum 10 files
    fieldSize: 2 * 1024 * 1024, // 2MB for form fields
    fieldNameSize: 100, // 100 bytes for field names
    fields: 50 // Maximum 50 non-file fields
  },
  fileFilter: (req, file, cb) => {
    console.log('Child intake file filter - processing file:', file.originalname, 'mimetype:', file.mimetype);
    
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.error('Child intake file rejected - not an image:', file.mimetype);
      cb(new Error('Only image files are allowed'), false);
    }
  }
};

const upload = multer(multerConfig);
const uploadAny = multer(multerConfig).any();

// Enhanced error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  console.error('Child intake multer error handler triggered:', err);
  
  if (err instanceof multer.MulterError) {
    console.error('Child intake multer error details:', {
      code: err.code,
      message: err.message,
      field: err.field
    });
    
    let errorMessage = 'File upload error: ' + err.message;
    
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
        errorMessage = 'Too many fields. Please reduce the number of form fields.';
        break;
      default:
        errorMessage = `Upload error: ${err.message}`;
    }
    
    return res.render('childIntake', { 
      success: null, 
      errors: [{ msg: errorMessage }], 
      user: null, 
      children: null, 
      dashboardEdit: false 
    });
  } 
  
  // Handle busboy "Unexpected end of form" errors
  if (err.message && err.message.includes('Unexpected end of form')) {
    console.error('Child intake busboy "Unexpected end of form" error:', err);
    return res.render('childIntake', { 
      success: null, 
      errors: [{ msg: 'The form submission was interrupted. This can happen due to network issues or if you tried to upload files that are too large. Please try again with smaller files or check your internet connection.' }], 
      user: null, 
      children: null, 
      dashboardEdit: false 
    });
  }
  
  // Handle other upload-related errors
  if (err.message && (
    err.message.includes('ENOENT') || 
    err.message.includes('EACCES') ||
    err.message.includes('EMFILE') ||
    err.message.includes('ENOSPC')
  )) {
    console.error('Child intake file system error:', err);
    return res.render('childIntake', { 
      success: null, 
      errors: [{ msg: 'Server error processing file upload. Please try again later.' }], 
      user: null, 
      children: null, 
      dashboardEdit: false 
    });
  }
  
  // Generic error handler
  if (err) {
    console.error('Child intake generic upload error:', err);
    return res.render('childIntake', { 
      success: null, 
      errors: [{ msg: 'An error occurred during file upload. Please try again.' }], 
      user: null, 
      children: null, 
      dashboardEdit: false 
    });
  }
  
  next();
};

// GET intake form
router.get('/', (req, res) => {
  res.render('childIntake', { success: null, errors: null, user: null, children: null, dashboardEdit: false });
});

// POST intake form
router.post('/',
  uploadAny, // Accept any file fields
  handleMulterError, // Handle upload errors
  async (req, res) => {
    // Parse parent info (now user-level fields)
    const parentFirstName = req.body.parentFirstName;
    const parentLastName = req.body.parentLastName;
    const parentPhone = req.body.parentPhone;
    const parentEmail = req.body.email;
    const preferredContact = req.body.preferredContact;
    const facebookProfileLink = req.body.facebookProfileLink || null;
    const instagramProfileLink = req.body.instagramProfileLink || null;
    const hasModeledBefore = req.body.hasModeled === 'true';
    const brandsWorkedWith = req.body.brands || null;

    // User account creation/update
    let user;
    let generatedPassword;
    try {
      user = await User.findOne({ where: { email: parentEmail } });
      if (!user) {
        // Generate password for new user
        generatedPassword = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        user = await User.create({ 
          email: parentEmail, 
          passwordHash,
          parentFirstName,
          parentLastName,
          parentPhone,
          preferredContact,
          facebookProfileLink,
          instagramProfileLink,
          hasModeledBefore,
          brands: brandsWorkedWith
        });
      } else {
        // Update existing user with new information
        await user.update({
          parentFirstName,
          parentLastName,
          parentPhone,
          preferredContact,
          facebookProfileLink,
          instagramProfileLink,
          hasModeledBefore,
          brands: brandsWorkedWith
        });
      }
    } catch (err) {
      console.error('Error creating/updating user account:', err);
      return res.render('childIntake', { success: null, errors: [{ msg: 'Error creating user account.' }], user: null, children: null, dashboardEdit: req.body.dashboardEdit === 'true' });
    }

    // Parse children
    // Find all child indices by looking for childName keys
    const childIndices = Object.keys(req.body)
      .filter(key => key.startsWith('childName'))
      .map(key => key.replace('childName', ''));

    // Map file fields for child photos
    const photoFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        photoFiles[file.fieldname] = file;
      });
    }

    let errors = [];
    let success = null;
    try {
      for (const idx of childIndices) {
        const childName = req.body[`childName${idx}`];
        const childDOB = req.body[`childDob${idx}`];
        const childGender = req.body[`childGender${idx}`];
        const childWeight = req.body[`childWeight${idx}`];
        const childHeight = req.body[`childHeight${idx}`];
        const photoFile = photoFiles[`childPhoto${idx}`];
        // Try to get existing photo from DB if available
        let existing = await ChildModel.findOne({
          where: {
            userId: user.id,
            childFirstName: childName,
            childDOB,
          }
        });
        let existingPhoto = existing ? existing.photo : null;
        // If editing (dashboardEdit), also check if children[idx] has a photo
        if (!existingPhoto && req.body[`existingPhoto${idx}`]) {
          existingPhoto = req.body[`existingPhoto${idx}`];
        }
        if (!childName || !childDOB || !childGender || !childWeight || !childHeight || (!photoFile && !existingPhoto)) {
          errors.push({ msg: `Missing required fields for child ${parseInt(idx) + 1}` });
          continue;
        }
        const photoPath = photoFile ? '/public/uploads/' + photoFile.filename : existingPhoto;
        // Calculate child size based on weight and height
        const calculatedSize = calculateChildSize(childWeight, childHeight);
        
        if (existing) {
          await existing.update({
            childGender,
            childWeight,
            childHeight,
            childSize: calculatedSize,
            childLastName: req.body[`childLastName${idx}`],
            photo: photoPath,
            userId: user.id, // Link to user
          });
        } else {
          await ChildModel.create({
            childFirstName: childName,
            childLastName: req.body[`childLastName${idx}`],
            childDOB,
            childGender,
            childWeight,
            childHeight,
            childSize: calculatedSize,
            photo: photoPath,
            userId: user.id, // Link to user
          });
        }
      }
      if (errors.length === 0) {
        // Form submitted successfully - respond immediately
        const responseData = {
          success: true,
          dashboardEdit: req.body.dashboardEdit === 'true'
        };
        
        // Send email asynchronously (don't wait for it)
        if (generatedPassword) {
          sendWelcomeEmailAsync(parentEmail, generatedPassword);
        }
        
        // Check if this is from edit-family context
        if (req.body.dashboardEdit === 'true') {
          return res.redirect('/dashboard');
        }
        
        // Build query parameters for thank you page to preserve user data for adult form pre-population
        const params = new URLSearchParams();
        if (parentFirstName) params.append('parentFirstName', parentFirstName);
        if (parentLastName) params.append('parentLastName', parentLastName);
        if (parentPhone) params.append('parentPhone', parentPhone);
        if (parentEmail) params.append('email', parentEmail);
        if (preferredContact) params.append('preferredContact', preferredContact);
        if (facebookProfileLink) params.append('facebookProfileLink', facebookProfileLink);
        if (instagramProfileLink) params.append('instagramProfileLink', instagramProfileLink);
        if (typeof hasModeledBefore !== 'undefined') params.append('hasModeledBefore', hasModeledBefore);
        if (brandsWorkedWith) params.append('brands', brandsWorkedWith);
        
        // Redirect to thank you page with user data for adult form pre-population
        const queryString = params.toString();
        return res.redirect(`/intake/child/thank-you${queryString ? '?' + queryString : ''}`);
      }
    } catch (err) {
      console.error('Error saving child to database:', err);
      errors.push({ msg: 'Error saving to database.' });
    }
    // Build user object from req.body for error repopulation
    const userForTemplate = {
      parentFirstName: req.body.parentFirstName,
      parentLastName: req.body.parentLastName,
      parentPhone: req.body.parentPhone,
      email: req.body.email,
      preferredContact: req.body.preferredContact,
      facebookProfileLink: req.body.facebookProfileLink,
      instagramProfileLink: req.body.instagramProfileLink,
      hasModeledBefore: req.body.hasModeled === 'true',
      brands: req.body.brands,
    };
    // Build children array from req.body
    const children = childIndices.map(idx => ({
      childFirstName: req.body[`childName${idx}`],
      childLastName: req.body[`childLastName${idx}`],
      childDOB: req.body[`childDob${idx}`],
      childGender: req.body[`childGender${idx}`],
      childWeight: req.body[`childWeight${idx}`],
      childHeight: req.body[`childHeight${idx}`],
      photo: req.body[`existingPhoto${idx}`] || null
    }));
    if (errors.length) {
      return res.render('childIntake', { success: null, errors, user: userForTemplate, children, dashboardEdit: req.body.dashboardEdit === 'true' });
    }
    res.render('childIntake', { success: null, errors: null, user: null, children: null, dashboardEdit: false });
  }
);

// Thank you page route
router.get('/thank-you', (req, res) => {
  // Reconstruct user object from query parameters for adult form pre-population
  const user = {
    parentFirstName: req.query.parentFirstName || null,
    parentLastName: req.query.parentLastName || null,
    parentPhone: req.query.parentPhone || null,
    email: req.query.email || null,
    preferredContact: req.query.preferredContact || null,
    facebookProfileLink: req.query.facebookProfileLink || null,
    instagramProfileLink: req.query.instagramProfileLink || null,
    hasModeledBefore: req.query.hasModeledBefore === 'true' ? true : (req.query.hasModeledBefore === 'false' ? false : undefined),
    brands: req.query.brands || null
  };
  
  // Only pass user object if it has actual data
  const hasUserData = user.parentFirstName || user.parentLastName || user.parentPhone || user.email || 
                      user.preferredContact || user.facebookProfileLink || user.instagramProfileLink || 
                      typeof user.hasModeledBefore !== 'undefined' || user.brands;
  
  res.render('thankYou', { user: hasUserData ? user : null });
});

module.exports = router; 