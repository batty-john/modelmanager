const readline = require('readline');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const sequelize = require('./config/database');
const { Op } = require('sequelize');
const ChildModel = require('./models/ChildModel');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  await sequelize.authenticate();
  rl.question('Admin email: ', async (email) => {
    rl.question('Admin password: ', async (password) => {
      const passwordHash = await bcrypt.hash(password, 10);
      try {
        const [user, created] = await User.findOrCreate({
          where: { email },
          defaults: { passwordHash, isAdmin: true }
        });
        if (!created) {
          user.passwordHash = passwordHash;
          user.isAdmin = true;
          await user.save();
          console.log('Updated existing user to admin.');
        } else {
          console.log('Created new admin user.');
        }
      } catch (err) {
        console.error('Error creating admin:', err);
      }
      rl.close();
      process.exit();
    });
  });
}

async function migrateParentFieldsToUser() {
  const children = await ChildModel.findAll();
  const seen = new Set();
  for (const child of children) {
    // Use userId if set, else match by email
    let user = null;
    if (child.userId) {
      user = await User.findByPk(child.userId);
    } else if (child.parentEmail) {
      user = await User.findOne({ where: { email: child.parentEmail } });
    }
    if (!user) continue;
    // Only update if not already set
    const updates = {};
    if (!user.parentName && child.parentName) updates.parentName = child.parentName;
    if (!user.parentPhone && child.parentPhone) updates.parentPhone = child.parentPhone;
    if (!user.preferredContact && child.preferredContact) updates.preferredContact = child.preferredContact;
    if (!user.facebookProfileLink && child.facebookProfileLink) updates.facebookProfileLink = child.facebookProfileLink;
    if (Object.keys(updates).length > 0) {
      await user.update(updates);
      console.log(`Updated user ${user.email} with`, updates);
    }
    // Only update once per user
    seen.add(user.id);
  }
  console.log('Migration complete.');
}

if (require.main === module) {
  migrateParentFieldsToUser().then(() => process.exit(0));
}

main(); 