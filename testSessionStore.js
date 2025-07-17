const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
require('dotenv').config();

console.log('Testing MySQL Session Store...');

// Test configuration
const testConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',
  createDatabaseTable: true
};

console.log('Database config:', {
  host: testConfig.host,
  port: testConfig.port,
  user: testConfig.user,
  database: testConfig.database
});

async function testSessionStore() {
  try {
    const store = new MySQLStore(testConfig);
    console.log('✅ MySQL session store created successfully');
    
    // Test session operations
    const sessionId = 'test-session-' + Date.now();
    const sessionData = { userId: 123, email: 'test@example.com' };
    
    // Test set
    store.set(sessionId, sessionData, (err) => {
      if (err) {
        console.error('❌ Error setting session:', err);
        return;
      }
      console.log('✅ Session set successfully');
      
      // Test get
      store.get(sessionId, (err, data) => {
        if (err) {
          console.error('❌ Error getting session:', err);
          return;
        }
        console.log('✅ Session retrieved successfully:', data);
        
        // Test destroy
        store.destroy(sessionId, (err) => {
          if (err) {
            console.error('❌ Error destroying session:', err);
            return;
          }
          console.log('✅ Session destroyed successfully');
          console.log('🎉 All session store tests passed!');
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Error creating MySQL session store:', error.message);
    process.exit(1);
  }
}

testSessionStore(); 