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

// Function to calculate child size based on weight and height
function calculateChildSize(weight, height) {
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  
  if (isNaN(weightNum) || isNaN(heightNum)) {
    return null;
  }
  
  // Size chart based on weight and height
  if (weightNum >= 31 && weightNum <= 39 && heightNum >= 36 && heightNum <= 42) {
    return '3T-4T';
  } else if (weightNum >= 39 && weightNum <= 48 && heightNum >= 42 && heightNum <= 48) {
    return '5T-6T';
  } else if (weightNum >= 49 && weightNum <= 71 && heightNum >= 48 && heightNum <= 52) {
    return '7Y-8Y';
  } else if (weightNum >= 72 && weightNum <= 101 && heightNum >= 54 && heightNum <= 62) {
    return '10Y-12Y';
  }
  
  // If no exact match, try to determine based on weight ranges only
  if (weightNum >= 31 && weightNum <= 39) {
    return '3T-4T';
  } else if (weightNum >= 40 && weightNum <= 48) {
    return '5T-6T';
  } else if (weightNum >= 49 && weightNum <= 71) {
    return '7Y-8Y';
  } else if (weightNum >= 72 && weightNum <= 101) {
    return '10Y-12Y';
  }
  
  return null; // No size determined
}

// Multer setup for dynamic child photo fields
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// GET intake form
router.get('/', (req, res) => {
  res.render('childIntake', { success: null, errors: null, user: null, children: null, dashboardEdit: false });
});

// POST intake form
router.post('/',
  upload.any(), // Accept any file fields
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
        // Send email with login instructions if user was just created
        if (generatedPassword) {
          // Setup nodemailer (configure with your SMTP details)
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
            to: parentEmail,
            subject: 'Your Annie Jean Photography Login',
            text: `Thank you for registering!\n\nYou can log in to update your information at: ${loginUrl}/login\n\nEmail: ${parentEmail}\nPassword: ${generatedPassword}\n\nPlease keep this information safe.`
          };
          await transporter.sendMail(mailOptions);
        }
        // Check if this is from edit-family context
        if (req.body.dashboardEdit === 'true') {
          return res.redirect('/dashboard');
        }
        // Instead of redirect, render thankYou with user info
        return res.render('thankYou', { user: {
          parentFirstName,
          parentLastName,
          parentPhone,
          email: parentEmail,
          preferredContact,
          facebookProfileLink,
          instagramProfileLink,
          hasModeledBefore,
          brands: brandsWorkedWith
        }});
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
  res.render('thankYou', { user: null });
});

module.exports = router; 