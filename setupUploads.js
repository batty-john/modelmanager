const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists and has proper permissions
const uploadsDir = path.join(__dirname, 'public', 'uploads');

try {
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
  } else {
    console.log('Uploads directory already exists');
  }

  // Create a .gitkeep file to ensure the directory is tracked in git
  const gitkeepFile = path.join(uploadsDir, '.gitkeep');
  if (!fs.existsSync(gitkeepFile)) {
    fs.writeFileSync(gitkeepFile, '');
    console.log('Created .gitkeep file');
  }

  console.log('Uploads directory setup complete');
} catch (error) {
  console.error('Error setting up uploads directory:', error);
} 