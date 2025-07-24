#!/usr/bin/env node

/**
 * Server Restart Script for Annie Jean Photography
 * 
 * This script helps restart the Node.js server and clear module cache
 * to resolve issues like "upload.single is not a function"
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Annie Jean Photography Server Restart Script');
console.log('================================================');

// Function to kill existing Node.js processes
function killExistingProcesses() {
  return new Promise((resolve) => {
    console.log('🔍 Checking for existing Node.js processes...');
    
    // Kill processes by port (if using PORT environment variable)
    const port = process.env.PORT || 3000;
    
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n');
        console.log(`🛑 Found processes on port ${port}: ${pids.join(', ')}`);
        
        exec(`kill -9 ${pids.join(' ')}`, (killError) => {
          if (killError) {
            console.log('⚠️  Error killing processes:', killError.message);
          } else {
            console.log('✅ Successfully stopped existing processes');
          }
          resolve();
        });
      } else {
        console.log('✅ No existing processes found on port', port);
        resolve();
      }
    });
  });
}

// Function to clear Node.js module cache
function clearNodeCache() {
  console.log('🧹 Clearing Node.js module cache...');
  
  // Clear require cache
  Object.keys(require.cache).forEach(key => {
    delete require.cache[key];
  });
  
  console.log('✅ Module cache cleared');
}

// Function to restart the server
function restartServer() {
  console.log('🚀 Starting server...');
  
  const serverProcess = exec('node app.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error starting server:', error);
      return;
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('📦 Server:', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('🚨 Server Error:', data.toString().trim());
  });

  return serverProcess;
}

// Main restart function
async function main() {
  try {
    await killExistingProcesses();
    clearNodeCache();
    
    console.log('⏳ Waiting 2 seconds for cleanup...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const serverProcess = restartServer();
    
    console.log('✅ Server restart initiated!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Wait for "Server running on port" message');
    console.log('   2. Test your forms to verify they work');
    console.log('   3. Press Ctrl+C to stop this script (server will continue)');
    console.log('');
    
    // Keep script running to show server output
    process.on('SIGINT', () => {
      console.log('\n👋 Restart script stopped. Server continues running.');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Restart failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 