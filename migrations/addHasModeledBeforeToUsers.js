const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addHasModeledBeforeToUsers() {
  try {
    // Add the hasModeledBefore column to the Users table
    await sequelize.getQueryInterface().addColumn('Users', 'hasModeledBefore', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    
    console.log('✅ Successfully added hasModeledBefore column to Users table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  hasModeledBefore column already exists in Users table');
    } else {
      console.error('❌ Error adding hasModeledBefore column:', error.message);
    }
  }
}

// Run the migration
addHasModeledBeforeToUsers()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 