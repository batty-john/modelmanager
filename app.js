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
  
  next();
});

// Body parsing middleware - MUST come before routes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Additional body parsing for cPanel compatibility
app.use((req, res, next) => {
  if (req.method === 'POST' && !req.body) {
    console.log('Body parsing middleware may have failed, attempting manual parsing');
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        if (req.headers['content-type']?.includes('application/json')) {
          req.body = JSON.parse(data);
        } else {
          const params = new URLSearchParams(data);
          req.body = {};
          for (const [key, value] of params) {
            req.body[key] = value;
          }
        }
        console.log('Manually parsed body:', req.body);
      } catch (error) {
        console.error('Failed to parse body:', error);
      }
      next();
    });
  } else {
    next();
  }
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
    console.log('Request body:', req.body);
  }
  next();
});

// Database sync
sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch((err) => console.error('Database sync error:', err));

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

// Session debug page
app.get('/session-debug', (req, res) => {
  res.render('sessionDebug');
});

// Routes - MUST come after middleware
app.use('/intake/child', childIntakeRouter);
app.use('/intake/adult', adultIntakeRouter);
app.use(authRouter);
app.use(dashboardRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 