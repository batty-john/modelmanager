const express = require('express');
const path = require('path');
const sequelize = require('./config/database');
require('dotenv').config();
const childIntakeRouter = require('./routes/childIntake');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const adultIntakeRouter = require('./routes/adultIntake');
const uploadRouter = require('./routes/upload');

const app = express();

// Redirect HTTP to HTTPS if FORCE_HTTPS is true
if (process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
    }
    next();
  });
}

// LiteSpeed/cPanel proxy handling
app.use((req, res, next) => {
  // Trust proxy for cPanel/LiteSpeed
  req.connection.proxySecure = req.headers['x-forwarded-proto'] === 'https';
  
  // Handle LiteSpeed's proxy headers
  if (req.headers['x-forwarded-for']) {
    req.connection.remoteAddress = req.headers['x-forwarded-for'].split(',')[0];
  }
  
  // Set timeout for cPanel/LiteSpeed - increased for file uploads
  req.setTimeout(120000); // 2 minutes for file uploads
  res.setTimeout(120000); // 2 minutes for responses
  
  next();
});

// Enhanced request timeout and size handling
app.use((req, res, next) => {
  // Set longer timeouts for file uploads
  if (req.path.includes('/intake/') || req.path.includes('/dashboard/edit-')) {
    req.setTimeout(180000); // 3 minutes for intake forms
    res.setTimeout(180000);
  }
  
  // Add request ID for debugging
  req.requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log(`[${req.requestId}] ${req.method} ${req.path} - Started`);
  
  // Track request timing
  req.startTime = Date.now();
  
  // Enhanced error handling
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    console.log(`[${req.requestId}] ${req.method} ${req.path} - Completed in ${duration}ms`);
    originalSend.call(this, data);
  };
  
  next();
});

// Body parsing middleware - MUST come before routes
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Additional body parsing for cPanel compatibility
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Skip body parsing for multipart forms (handled by multer)
    return next();
  }
  
  // Handle large form data for cPanel
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1000000) {
    req.setTimeout(180000); // 3 minutes for large forms
  }
  
  next();
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${req.requestId || 'unknown'}] Error:`, err);
  
  // Handle specific error types
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('error', {
      message: 'File is too large. Maximum size is 10MB. Please compress your image or use a smaller file.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).render('error', {
      message: 'Too many files. Maximum is 10 files per upload.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  if (err.code === 'ETIMEOUT' || err.message === 'Request timeout') {
    return res.status(408).render('error', {
      message: 'Request timed out. Please try again with smaller files or check your internet connection.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Database connection errors
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).render('error', {
      message: 'Database connection error. Please try again in a moment.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  // Default error handler
  res.status(err.status || 500).render('error', {
    message: err.message || 'An unexpected error occurred. Please try again.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log(`[${req.requestId}] Request timeout for ${req.method} ${req.path}`);
      res.status(408).render('error', {
        message: 'Request timed out. Please try again.',
        error: {}
      });
    }
  }, 180000); // 3 minute timeout
  
  // Clear timeout when response is sent
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
});

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration with MySQL store for production
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: true, // Changed to true for cPanel/LiteSpeed
  saveUninitialized: true, // Changed to true for cPanel/LiteSpeed
  rolling: true, // Extend session on each request
  cookie: {
    secure: false, // Disabled for cPanel/LiteSpeed compatibility
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  },
  name: 'sid' // Use a different session name to avoid conflicts
};

// Use MySQL session store in production, MemoryStore in development
if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'production') {
  console.log('Setting up MySQL session store for production');
  try {
    sessionConfig.store = new MySQLStore({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      createDatabaseTable: true,
      // cPanel/LiteSpeed specific settings
      clearExpired: true,
      checkExpirationInterval: 900000, // 15 minutes
      expiration: 86400000, // 24 hours
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
        }
      }
    });
    console.log('✅ MySQL session store created successfully');
  } catch (error) {
    console.error('❌ Error creating MySQL session store:', error);
    console.log('Falling back to MemoryStore');
  }
} else {
  console.log('Using MemoryStore for development');
}

// Session middleware - MUST come before routes
app.use(session(sessionConfig));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Content-Type: ${req.headers['content-type']}`);
  console.log('Session ID:', req.sessionID);
  console.log('Cookies:', req.headers.cookie);
  if (req.method === 'POST') {
    console.log('Request body keys:', Object.keys(req.body || {}));
    // Don't log full body as it may contain large data
  }
  next();
});

// Database sync with retry logic
async function connectToDatabase(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.sync();
      console.log('✅ Database synced successfully');
      return;
    } catch (err) {
      console.error(`❌ Database sync error (attempt ${i + 1}/${retries}):`, err);
      if (i === retries - 1) {
        console.error('Failed to connect to database after all retries');
        process.exit(1);
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

connectToDatabase();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Splash page route
app.get('/', (req, res) => {
  res.render('splash');
});

// Test endpoint for debugging
app.post('/test-body', (req, res) => {
  console.log('Test endpoint called');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  res.json({
    success: true,
    body: req.body,
    headers: req.headers,
    method: req.method
  });
});

// Session test endpoint
app.get('/test-session', (req, res) => {
  console.log('Session test endpoint called');
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  
  // Set a test value in session
  req.session.testValue = 'test-' + Date.now();
  
  res.json({
    sessionID: req.sessionID,
    sessionData: req.session,
    sessionKeys: Object.keys(req.session || {}),
    hasSession: !!req.session
  });
});

app.get('/test-session-read', (req, res) => {
  console.log('Session read test endpoint called');
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  
  res.json({
    sessionID: req.sessionID,
    sessionData: req.session,
    testValue: req.session.testValue,
    hasSession: !!req.session,
    cookies: req.headers.cookie,
    userAgent: req.headers['user-agent'],
    host: req.headers.host,
    referer: req.headers.referer
  });
});

// Client login page
app.get('/client-login', (req, res) => {
  res.render('clientLogin');
});

// Redirect routes for client access
app.get('/client', (req, res) => {
  res.redirect('/client-login');
});

app.get('/clients', (req, res) => {
  res.redirect('/client-login');
});

// Session debug page
app.get('/session-debug', (req, res) => {
  res.render('sessionDebug');
});

// Routes - MUST come after middleware
app.use('/intake/child', childIntakeRouter);
app.use('/intake/adult', adultIntakeRouter);
app.use('/upload', uploadRouter);
app.use(authRouter);
app.use(dashboardRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found',
    error: {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 