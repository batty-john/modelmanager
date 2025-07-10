const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addInstagramToUsers() {
  try {
    // Add the instagramProfileLink column to the Users table
    await sequelize.getQueryInterface().addColumn('Users', 'instagramProfileLink', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    
    console.log('✅ Successfully added instagramProfileLink column to Users table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  instagramProfileLink column already exists in Users table');
    } else {
      console.error('❌ Error adding instagramProfileLink column:', error.message);
    }
  }
}

// Run the migration
addInstagramToUsers()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 