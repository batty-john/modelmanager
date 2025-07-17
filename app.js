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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database sync
sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch((err) => console.error('Database sync error:', err));

// Splash page route
app.get('/', (req, res) => {
  res.render('splash');
});

// Client login page
app.get('/client-login', (req, res) => {
  res.render('clientLogin');
});

// Session configuration with MySQL store for production
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use MySQL session store in production, MemoryStore in development
if (process.env.NODE_ENV === 'production') {
  sessionConfig.store = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true
  });
}

app.use(session(sessionConfig));

app.use('/intake/child', childIntakeRouter);
app.use('/intake/adult', adultIntakeRouter);
app.use(authRouter);
app.use(dashboardRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 