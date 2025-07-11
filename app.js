const express = require('express');
const path = require('path');
const sequelize = require('./config/database');
require('dotenv').config();
const childIntakeRouter = require('./routes/childIntake');
const session = require('express-session');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const adultIntakeRouter = require('./routes/adultIntake');

const app = express();

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

app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
}));

app.use('/intake/child', childIntakeRouter);
app.use('/intake/adult', adultIntakeRouter);
app.use(authRouter);
app.use(dashboardRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 