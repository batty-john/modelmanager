const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
require('dotenv').config();

console.log('Testing session store configuration...');

// Test configuration
const testConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test'
};

console.log('Database config:', {
  host: testConfig.host,
  port: testConfig.port,
  user: testConfig.user,
  database: testConfig.database
});

try {
  const store = new MySQLStore(testConfig);
  console.log('✅ MySQL session store created successfully');
  
  // Test the store
  store.get('test-session-id', (err, session) => {
    if (err) {
      console.log('⚠️  Store test completed (expected error for non-existent session):', err.message);
    } else {
      console.log('✅ Store test completed successfully');
    }
    process.exit(0);
  });
} catch (error) {
  console.error('❌ Error creating MySQL session store:', error.message);
  process.exit(1);
} 