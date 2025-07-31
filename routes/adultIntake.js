const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const AdultModel = require('../models/AdultModel');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
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
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      const loginUrl = process.env.BASE_URL || 'http://localhost:3000';
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Welcome to Annie Jean Photography',
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

// Enhanced multer configuration with error handling
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
    files: 15, // Maximum 15 files (increased for large families)
    fieldSize: 2 * 1024 * 1024, // 2MB for form fields
    fieldNameSize: 100, // 100 bytes for field names
    fields: 150 // Maximum 150 non-file fields (increased for families with 5+ children)
  },
  fileFilter: (req, file, cb) => {
    console.log('Adult intake file filter - processing file:', file.originalname, 'mimetype:', file.mimetype);
    
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.error('Adult intake file rejected - not an image:', file.mimetype);
      cb(new Error('Only image files are allowed'), false);
    }
  }
};

const upload = multer(multerConfig);
const uploadAny = multer(multerConfig).any();

// Enhanced error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  // Log to stderr for cPanel/LiteSpeed environments
  console.error('=== ADULT INTAKE FORM SUBMISSION FAILED ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Error Type: Multer/Upload Error');
  console.error('Adult intake multer error handler triggered:', err);
  
  if (err instanceof multer.MulterError) {
    console.error('Adult intake multer error details:', {
      code: err.code,
      message: err.message,
      field: err.field,
      stack: err.stack
    });
    
    // Log form data context for debugging
    if (req.body) {
      const fieldCount = Object.keys(req.body).length;
      const adultCount = Object.keys(req.body).filter(key => key.startsWith('firstName')).length;
      console.error('Form context - Total fields:', fieldCount, 'Adults detected:', adultCount);
    }
    if (req.files) {
      console.error('Files received:', req.files.length);
    }
    
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
        errorMessage = 'Too many form fields. This can happen with large families (4+ children). Please try submitting fewer children at once, or contact support for assistance with large family registrations.';
        break;
      default:
        errorMessage = `Upload error: ${err.message}`;
    }
    
    const userForTemplate = {
      parentFirstName: req.body ? req.body['firstName0'] : '',
      parentLastName: req.body ? req.body['lastName0'] : '',
      parentPhone: req.body ? req.body['phone0'] : '',
      email: req.body ? req.body['email0'] : '',
      preferredContact: req.body ? req.body.preferredContact || '' : '',
      facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
      instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
      hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
      brands: req.body ? req.body.brands || '' : ''
    };
    
    console.error('=== END ADULT INTAKE MULTER ERROR LOG ===');
    return res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: userForTemplate,
      errors: [{ msg: errorMessage }],
      dashboardEdit: false
    });
  } 
  
  // Handle busboy "Unexpected end of form" errors
  if (err.message && err.message.includes('Unexpected end of form')) {
    console.error('=== ADULT INTAKE FORM SUBMISSION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type: Unexpected end of form');
    console.error('Adult intake busboy "Unexpected end of form" error:', err);
    
    const userForTemplate = {
      parentFirstName: req.body ? req.body['firstName0'] : '',
      parentLastName: req.body ? req.body['lastName0'] : '',
      parentPhone: req.body ? req.body['phone0'] : '',
      email: req.body ? req.body['email0'] : '',
      preferredContact: req.body ? req.body.preferredContact || '' : '',
      facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
      instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
      hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
      brands: req.body ? req.body.brands || '' : ''
    };
    
    console.error('=== END ADULT INTAKE ERROR LOG ===');
    return res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: userForTemplate,
      errors: [{ msg: 'The form submission was interrupted. This can happen due to network issues or if you tried to upload files that are too large. Please try again with smaller files or check your internet connection.' }],
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
    console.error('=== ADULT INTAKE FORM SUBMISSION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type: File system error');
    console.error('Adult intake file system error:', err);
    
    const userForTemplate = {
      parentFirstName: req.body ? req.body['firstName0'] : '',
      parentLastName: req.body ? req.body['lastName0'] : '',
      parentPhone: req.body ? req.body['phone0'] : '',
      email: req.body ? req.body['email0'] : '',
      preferredContact: req.body ? req.body.preferredContact || '' : '',
      facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
      instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
      hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
      brands: req.body ? req.body.brands || '' : ''
    };
    
    console.error('=== END ADULT INTAKE ERROR LOG ===');
    return res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: userForTemplate,
      errors: [{ msg: 'Server error processing file upload. Please try again later.' }],
      dashboardEdit: false
    });
  }
  
  // Generic error handler
  if (err) {
    console.error('=== ADULT INTAKE FORM SUBMISSION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type: Generic upload error');
    console.error('Adult intake generic upload error:', err);
    console.error('Error stack:', err.stack);
    
    const userForTemplate = {
      parentFirstName: req.body ? req.body['firstName0'] : '',
      parentLastName: req.body ? req.body['lastName0'] : '',
      parentPhone: req.body ? req.body['phone0'] : '',
      email: req.body ? req.body['email0'] : '',
      preferredContact: req.body ? req.body.preferredContact || '' : '',
      facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
      instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
      hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
      brands: req.body ? req.body.brands || '' : ''
    };
    
    console.error('=== END ADULT INTAKE ERROR LOG ===');
    return res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: userForTemplate,
      errors: [{ msg: 'An error occurred during file upload. Please try again.' }],
      dashboardEdit: false
    });
  }
  
  next();
};

// GET /intake/adult
router.get('/', (req, res) => {
  const user = {
    parentFirstName: req.query.parentFirstName || '',
    parentLastName: req.query.parentLastName || '',
    parentPhone: req.query.parentPhone || '',
    email: req.query.email || '',
    preferredContact: req.query.preferredContact || '',
    facebookProfileLink: req.query.facebookProfileLink || '',
    instagramProfileLink: req.query.instagramProfileLink || '',
    hasModeledBefore: req.query.hasModeledBefore === 'true' ? true : (req.query.hasModeledBefore === 'false' ? false : undefined),
    brands: req.query.brands || ''
  };
  const adults = [{
    firstName: user.parentFirstName,
    lastName: user.parentLastName,
    email: user.email,
    phone: user.parentPhone,
    gender: '',
    size: '',
    photo: ''
  }];
  res.render('adultIntake', {
    adults,
    user: (user.parentFirstName || user.parentLastName || user.parentPhone || user.email || user.preferredContact || user.facebookProfileLink || user.instagramProfileLink || user.hasModeledBefore !== undefined || user.brands) ? user : null,
    errors: [],
    dashboardEdit: false
  });
});

// POST /intake/adult
router.post('/', uploadAny, handleMulterError, async (req, res) => {
  try {
    console.log('ADULT INTAKE SUBMISSION:', { body: req.body, files: req.files });
    // Parse adults
    const adultIndices = Object.keys(req.body)
      .filter(key => key.startsWith('firstName'))
      .map(key => key.replace('firstName', ''));
    const photoFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        photoFiles[file.fieldname] = file;
        // Persist uploaded photo filename in req.body for error repopulation
        const idx = file.fieldname.replace('adultPhoto', '');
        req.body[`photo${idx}`] = '/public/uploads/' + file.filename;
      });
    }
    const userEmail = req.body['email0']; // Use first adult's email for user
    let user = await User.findOne({ where: { email: userEmail } });
    let isNewUser = false;
    let tempPassword = null;
    if (!user) {
      // Generate a random password
      tempPassword = crypto.randomBytes(8).toString('hex');
      // Hash the password
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      user = await User.create({ 
        email: userEmail, 
        passwordHash,
        parentFirstName: req.body['firstName0'],
        parentLastName: req.body['lastName0'],
        parentPhone: req.body['phone0'],
        preferredContact: req.body.preferredContact,
        facebookProfileLink: req.body.facebookProfileLink,
        instagramProfileLink: req.body.instagramProfileLink,
        hasModeledBefore: req.body.hasModeled === 'true',
        brands: req.body.brands || null
      });
      isNewUser = true;
    } else {
      // Update existing user with new information
      await user.update({
        parentFirstName: req.body['firstName0'],
        parentLastName: req.body['lastName0'],
        parentPhone: req.body['phone0'],
        preferredContact: req.body.preferredContact,
        facebookProfileLink: req.body.facebookProfileLink,
        instagramProfileLink: req.body.instagramProfileLink,
        hasModeledBefore: req.body.hasModeled === 'true',
        brands: req.body.brands || null
      });
    }
    // Restore validation for all required fields
    const preferredContact = req.body.preferredContact;
    const facebookProfileLink = req.body.facebookProfileLink;
    const instagramProfileLink = req.body.instagramProfileLink;
    const mainPhoto = req.body[`photo0`] || (photoFiles[`adultPhoto0`] ? '/public/uploads/' + photoFiles[`adultPhoto0`].filename : '');
    let errors = [];
    for (const idx of adultIndices) {
      const firstName = req.body[`firstName${idx}`];
      const lastName = req.body[`lastName${idx}`];
      const email = req.body[`email${idx}`];
      const phone = req.body[`phone${idx}`];
      const gender = req.body[`gender${idx}`];
      const size = req.body[`size${idx}`];
      if (!firstName) errors.push({ field: `firstName${idx}`, msg: 'First name is required.' });
      if (!lastName) errors.push({ field: `lastName${idx}`, msg: 'Last name is required.' });
      if (idx === '0' && !email) errors.push({ field: `email${idx}`, msg: 'Email is required.' });
      if (idx === '0' && !phone) errors.push({ field: `phone${idx}`, msg: 'Phone is required.' });
      if (!gender) errors.push({ field: `gender${idx}`, msg: 'Gender is required.' });
      if (!size) errors.push({ field: `size${idx}`, msg: 'Size is required.' });
    }
    if (!preferredContact) errors.push({ field: 'preferredContact', msg: 'Preferred contact method is required.' });
    if (preferredContact === 'Facebook' && !facebookProfileLink) errors.push({ field: 'facebookProfileLink', msg: 'Facebook profile link is required.' });
    if (!mainPhoto) errors.push({ field: 'photo0', msg: 'A photo is required.' });
    console.log('ADULT INTAKE ERRORS ARRAY:', errors);
    if (errors.length) {
      console.log('ADULTS ARRAY SENT TO TEMPLATE:', adultIndices.map(i => ({
        firstName: req.body[`firstName${i}`],
        lastName: req.body[`lastName${i}`],
        email: req.body[`email${i}`],
        phone: req.body[`phone${i}`],
        gender: req.body[`gender${i}`],
        size: req.body[`size${i}`],
        photo: req.body[`photo${i}`] || '',
      })));
      return res.render('adultIntake', {
        adults: adultIndices.map(i => ({
          firstName: req.body[`firstName${i}`],
          lastName: req.body[`lastName${i}`],
          email: req.body[`email${i}`],
          phone: req.body[`phone${i}`],
          gender: req.body[`gender${i}`],
          size: req.body[`size${i}`],
          photo: req.body[`photo${i}`] || '',
        })),
        user: {
          parentFirstName: req.body['firstName0'],
          parentLastName: req.body['lastName0'],
          parentPhone: req.body['phone0'],
          email: req.body['email0'],
          preferredContact: req.body.preferredContact || '',
          facebookProfileLink: req.body.facebookProfileLink || '',
          instagramProfileLink: req.body.instagramProfileLink || '',
          hasModeledBefore: req.body.hasModeled === 'true',
          brands: req.body.brands || ''
        },
        errors,
        dashboardEdit: false
      });
    }
    for (const idx of adultIndices) {
      const firstName = req.body[`firstName${idx}`];
      const lastName = req.body[`lastName${idx}`];
      const email = req.body[`email${idx}`];
      const phone = req.body[`phone${idx}`];
      const gender = req.body[`gender${idx}`];
      const size = req.body[`size${idx}`];
      const photo = req.body[`photo${idx}`] || '';
      try {
        await AdultModel.create({
          firstName,
          lastName,
          email,
          phone,
          gender,
          size,
          photo,
          userId: user.id
        });
        console.log(`Created adult ${idx}:`, { firstName, lastName, email });
      } catch (dbErr) {
        console.error(`Error creating adult ${idx}:`, dbErr);
        errors.push({ field: null, msg: `Database error for adult ${idx}: ${dbErr.message}` });
      }
    }
    if (errors.length) {
      return res.render('adultIntake', {
        adults: adultIndices.map(i => ({
          firstName: req.body[`firstName${i}`],
          lastName: req.body[`lastName${i}`],
          email: req.body[`email${i}`],
          phone: req.body[`phone${i}`],
          gender: req.body[`gender${i}`],
          size: req.body[`size${i}`],
          photo: req.body[`photo${i}`] || '',
        })),
        user: {
          parentFirstName: req.body['firstName0'],
          parentLastName: req.body['lastName0'],
          parentPhone: req.body['phone0'],
          email: req.body['email0'],
          preferredContact: req.body.preferredContact || '',
          facebookProfileLink: req.body.facebookProfileLink || '',
          instagramProfileLink: req.body.instagramProfileLink || '',
          hasModeledBefore: req.body.hasModeled === 'true',
          brands: req.body.brands || ''
        },
        errors,
        dashboardEdit: false
      });
    }
          // Send email if new user (asynchronously - don't wait for it)
      if (isNewUser) {
        sendWelcomeEmailAsync(userEmail, tempPassword);
      }
    res.redirect('/intake/adult/thankyou');
  } catch (err) {
    console.error('ADULT INTAKE FATAL ERROR:', err);
    res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: {
        parentFirstName: req.body ? req.body['firstName0'] : '',
        parentLastName: req.body ? req.body['lastName0'] : '',
        parentPhone: req.body ? req.body['phone0'] : '',
        email: req.body ? req.body['email0'] : '',
        preferredContact: req.body ? req.body.preferredContact || '' : '',
        facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
        instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
        hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
        brands: req.body ? req.body.brands || '' : ''
      },
      errors: [{ msg: 'Error saving adult intake.' }],
      dashboardEdit: false
    });
  }
});

// GET /dashboard/edit-adult
router.get('/dashboard/edit-adult', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect('/login');
  const adults = await AdultModel.findAll({ where: { userId } });
  const user = await User.findByPk(userId);
  res.render('adultIntake', {
    adults: adults.length ? adults : [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
    user,
    errors: [],
    dashboardEdit: true
  });
});

// POST /dashboard/edit-adult
router.post('/dashboard/edit-adult', uploadAny, handleMulterError, async (req, res) => {
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
      });
    }
    // Remove all existing adults for this user (for simplicity)
    await AdultModel.destroy({ where: { userId } });
    for (const idx of adultIndices) {
      const firstName = req.body[`firstName${idx}`];
      const lastName = req.body[`lastName${idx}`];
      const email = req.body[`email${idx}`];
      const phone = req.body[`phone${idx}`];
      const gender = req.body[`gender${idx}`];
      const size = req.body[`size${idx}`];
      const photo = req.body[`photo${idx}`] || '';
      try {
        await AdultModel.create({
          firstName,
          lastName,
          email,
          phone,
          gender,
          size,
          photo,
          userId: userId
        });
        console.log(`Created adult ${idx}:`, { firstName, lastName, email });
      } catch (dbErr) {
        console.error(`Error creating adult ${idx}:`, dbErr);
        errors.push({ field: null, msg: `Database error for adult ${idx}: ${dbErr.message}` });
      }
    }
    // Update user with new information
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({
        parentFirstName: req.body['firstName0'],
        parentLastName: req.body['lastName0'],
        parentPhone: req.body['phone0'],
        preferredContact: req.body.preferredContact,
        facebookProfileLink: req.body.facebookProfileLink,
        instagramProfileLink: req.body.instagramProfileLink,
        hasModeledBefore: req.body.hasModeled === 'true',
        brands: req.body.brands || null
      });
    }
    if (errors.length) {
      return res.render('adultIntake', {
        adults: adultIndices.map(i => ({
          firstName: req.body[`firstName${i}`],
          lastName: req.body[`lastName${i}`],
          email: req.body[`email${i}`],
          phone: req.body[`phone${i}`],
          gender: req.body[`gender${i}`],
          size: req.body[`size${i}`],
          photo: req.body[`photo${i}`] || '',
        })),
        user: {
          parentFirstName: req.body['firstName0'],
          parentLastName: req.body['lastName0'],
          parentPhone: req.body['phone0'],
          email: req.body['email0'],
          preferredContact: req.body.preferredContact || '',
          facebookProfileLink: req.body.facebookProfileLink || '',
          instagramProfileLink: req.body.instagramProfileLink || '',
          hasModeledBefore: req.body.hasModeled === 'true',
          brands: req.body.brands || ''
        },
        errors,
        dashboardEdit: false
      });
    }
    // Send email if new user (asynchronously - don't wait for it)
    if (isNewUser) {
      sendWelcomeEmailAsync(userEmail, tempPassword);
    }
    res.redirect('/intake/adult/thankyou');
  } catch (err) {
    console.error('ADULT INTAKE FATAL ERROR:', err);
    res.render('adultIntake', {
      adults: [{ firstName: '', lastName: '', email: '', phone: '', gender: '', size: '', photo: '' }],
      user: {
        parentFirstName: req.body ? req.body['firstName0'] : '',
        parentLastName: req.body ? req.body['lastName0'] : '',
        parentPhone: req.body ? req.body['phone0'] : '',
        email: req.body ? req.body['email0'] : '',
        preferredContact: req.body ? req.body.preferredContact || '' : '',
        facebookProfileLink: req.body ? req.body.facebookProfileLink || '' : '',
        instagramProfileLink: req.body ? req.body.instagramProfileLink || '' : '',
        hasModeledBefore: req.body ? req.body.hasModeled === 'true' : false,
        brands: req.body ? req.body.brands || '' : ''
      },
      errors: [{ msg: 'Error saving adult intake.' }],
      dashboardEdit: false
    });
  }
});

// Thank you page route
router.get('/thankyou', (req, res) => {
  res.render('adultThankYou');
});

module.exports = router;
