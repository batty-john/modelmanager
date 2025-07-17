require('dotenv').config();

console.log('=== Environment Test ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NODE_ENV (lowercase):', process.env.NODE_ENV ? process.env.NODE_ENV.toLowerCase() : 'undefined');
console.log('Is Production:', process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'production');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');

// Test session configuration
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
};

if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'production') {
  console.log('\n=== Testing MySQL Session Store ===');
  try {
    sessionConfig.store = new MySQLStore({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      createDatabaseTable: true
    });
    console.log('✅ MySQL session store created successfully');
  } catch (error) {
    console.error('❌ Error creating MySQL session store:', error.message);
  }
} else {
  console.log('\n=== Using MemoryStore for development ===');
}

console.log('\n=== Session Config ===');
console.log('Secret:', sessionConfig.secret ? 'SET' : 'NOT SET');
console.log('Secure cookies:', sessionConfig.cookie.secure);
console.log('Store:', sessionConfig.store ? 'MySQL' : 'Memory'); 