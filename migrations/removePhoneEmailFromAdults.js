const sequelize = require('../config/database');

async function removePhoneEmailFromAdults() {
  try {
    await sequelize.getQueryInterface().removeColumn('Adults', 'phone');
    await sequelize.getQueryInterface().removeColumn('Adults', 'email');
    console.log('✅ Successfully removed phone and email columns from Adults table');
  } catch (error) {
    console.error('❌ Error removing columns:', error.message);
  }
}

removePhoneEmailFromAdults()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 