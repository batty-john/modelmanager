const sequelize = require('../config/database');

async function removeUserFieldsFromAdults() {
  try {
    await sequelize.getQueryInterface().removeColumn('Adults', 'preferredContact');
    await sequelize.getQueryInterface().removeColumn('Adults', 'facebookProfileLink');
    await sequelize.getQueryInterface().removeColumn('Adults', 'hasModeledBefore');
    await sequelize.getQueryInterface().removeColumn('Adults', 'brandsWorkedWith');
    console.log('✅ Successfully removed user-level fields from Adults table');
  } catch (error) {
    console.error('❌ Error removing columns:', error.message);
  }
}

removeUserFieldsFromAdults()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 