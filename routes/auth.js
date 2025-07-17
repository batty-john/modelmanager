const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Client = require('../models/Client');

// GET login page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// POST login
router.post('/login', async (req, res) => {
  console.log('Login attempt received');
  console.log('Content-Type:', req.headers['content-type']);
  
  // Safely handle req.body
  let requestBody = req.body;
  if (!requestBody) {
    console.log('req.body is undefined - attempting to parse manually');
    // Try to parse the raw body if middleware failed
    try {
      const rawBody = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
        });
        req.on('end', () => {
          resolve(data);
        });
        req.on('error', reject);
      });
      
      // Parse URL-encoded data
      const params = new URLSearchParams(rawBody);
      requestBody = {};
      for (const [key, value] of params) {
        requestBody[key] = value;
      }
      console.log('Manually parsed body:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return res.render('login', { error: 'Invalid request format.' });
    }
  } else {
    console.log('Request body type:', typeof requestBody);
    console.log('Request body keys:', Object.keys(requestBody || {}));
  }
  
  const { email, password } = requestBody || {};
  
  if (!email || !password) {
    console.log('Missing email or password:', { email: !!email, password: !!password });
    return res.render('login', { error: 'Email and password are required.' });
  }
  
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('User not found:', email);
      return res.render('login', { error: 'Invalid email or password.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.render('login', { error: 'Invalid email or password.' });
    }
    
    console.log('Login successful for user:', email, 'Admin:', user.isAdmin);
    
    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.isAdmin = user.isAdmin || false;
    
    console.log('Session set:', {
      userId: req.session.userId,
      userEmail: req.session.userEmail,
      isAdmin: req.session.isAdmin,
      sessionID: req.sessionID
    });
    
    // Force session save and check if it worked
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('login', { error: 'Session error. Please try again.' });
      }
      
      console.log('Session saved successfully');
      console.log('Session after save:', {
        userId: req.session.userId,
        userEmail: req.session.userEmail,
        isAdmin: req.session.isAdmin,
        sessionID: req.sessionID
      });
      
      // Redirect
      if (user.isAdmin) {
        console.log('Redirecting admin to dashboard');
        return res.redirect('/admin/dashboard');
      } else {
        console.log('Redirecting user to dashboard');
        return res.redirect('/dashboard');
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.render('login', { error: 'Server error. Please try again.' });
  }
});

// GET logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// GET /forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('forgotPassword', { error: null, success: null });
});

// POST /forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.render('forgotPassword', { error: 'Please enter your email address.', success: null });
  }
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.render('forgotPassword', { error: 'No account found with that email.', success: null });
  }
  // Generate token and expiration
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  user.resetPasswordToken = token;
  user.resetPasswordExpires = expires;
  await user.save();
  // Send email
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`
  };
  try {
    await transporter.sendMail(mailOptions);
    return res.render('forgotPassword', { error: null, success: 'A password reset link has been sent to your email.' });
  } catch (err) {
    console.error('Error sending password reset email:', err);
    return res.render('forgotPassword', { error: 'Error sending email. Please try again later.', success: null });
  }
});

// GET /reset-password/:token
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: { [require('sequelize').Op.gt]: new Date() }
    }
  });
  if (!user) {
    return res.render('resetPassword', { error: 'Invalid or expired reset link.', success: null, token });
  }
  res.render('resetPassword', { error: null, success: null, token });
});

// POST /reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;
  if (!password || !confirmPassword) {
    return res.render('resetPassword', { error: 'Please fill out both fields.', success: null, token });
  }
  if (password !== confirmPassword) {
    return res.render('resetPassword', { error: 'Passwords do not match.', success: null, token });
  }
  const user = await User.findOne({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: { [require('sequelize').Op.gt]: new Date() }
    }
  });
  if (!user) {
    return res.render('resetPassword', { error: 'Invalid or expired reset link.', success: null, token });
  }
  const bcrypt = require('bcryptjs');
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();
  res.render('resetPassword', { error: null, success: 'Your password has been reset. You may now log in.', token: null });
});

// Client login route
router.post('/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find client by email
    const client = await Client.findOne({ where: { email, isActive: true } });
    if (!client) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await client.checkPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Set session
    req.session.clientId = client.id;
    req.session.clientName = client.name;
    req.session.clientEmail = client.email;
    
    res.json({ success: true, redirect: '/client/dashboard' });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Client logout route
router.post('/client-logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

module.exports = router; 