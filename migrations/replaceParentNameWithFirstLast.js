const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

async function migrateParentName() {
  try {
    // 1. Add new columns
    await sequelize.getQueryInterface().addColumn('Users', 'parentFirstName', {
      type: 'VARCHAR(255)',
      allowNull: true,
    });
    await sequelize.getQueryInterface().addColumn('Users', 'parentLastName', {
      type: 'VARCHAR(255)',
      allowNull: true,
    });

    // 2. Migrate data from parentName
    const users = await sequelize.query('SELECT id, parentName FROM Users', { type: QueryTypes.SELECT });
    for (const user of users) {
      if (user.parentName) {
        const [first, ...lastArr] = user.parentName.split(' ');
        const last = lastArr.join(' ');
        await sequelize.query(
          'UPDATE Users SET parentFirstName = ?, parentLastName = ? WHERE id = ?',
          { replacements: [first, last, user.id] }
        );
      }
    }

    // 3. Remove old column
    await sequelize.getQueryInterface().removeColumn('Users', 'parentName');
    console.log('✅ Migrated parentName to parentFirstName/parentLastName and removed parentName');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

migrateParentName()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 