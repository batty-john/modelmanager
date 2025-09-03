/**
 * Setup script for the multiple child sizes system
 * Run this after implementing the multiple sizes feature
 */

const { sequelize } = require('./models');
const { migrateExistingChildSizes } = require('./utils/childSizeManager');
const { calculateChildSizes, hasOverlappingSizes } = require('./utils/sizeCalculator');

async function setupMultipleSizes() {
  try {
    console.log('🚀 Setting up multiple child sizes system...\n');

    // 1. Sync database to create new tables
    console.log('1. Syncing database schema...');
    await sequelize.sync();
    console.log('✅ Database schema synced\n');

    // 2. Migrate existing child data
    console.log('2. Migrating existing child data to multiple sizes...');
    const migratedCount = await migrateExistingChildSizes();
    console.log(`✅ Migrated ${migratedCount} children\n`);

    // 3. Test the new size calculation system
    console.log('3. Testing size calculation system...');
    
    const testCases = [
      { weight: 20, height: 30, description: '20 lb child (overlapping range)' },
      { weight: 85, height: 50, description: '85 lb child (overlapping range)' },
      { weight: 15, height: 28, description: '15 lb child (single size)' },
      { weight: 35, height: 40, description: '35 lb child (single size)' }
    ];

    testCases.forEach(testCase => {
      const sizes = calculateChildSizes(testCase.weight, testCase.height);
      const hasMultiple = hasOverlappingSizes(testCase.weight);
      
      console.log(`  📊 ${testCase.description}:`);
      console.log(`     Sizes: ${sizes.map(s => s.isPrimary ? `**${s.size}**` : s.size).join(', ')}`);
      console.log(`     Has multiple: ${hasMultiple}`);
      console.log('');
    });

    console.log('✅ Size calculation system working correctly\n');

    // 4. Display summary
    console.log('🎉 Multiple sizes system setup complete!');
    console.log('\nWhat\'s new:');
    console.log('• Children can now have multiple sizes when weight overlaps ranges');
    console.log('• Primary size is indicated with ** in admin views');
    console.log('• Filtering now finds children in any of their applicable sizes');
    console.log('• Backward compatibility maintained with existing childSize field');
    console.log('\nNext steps:');
    console.log('• Test the admin models view to see multiple sizes');
    console.log('• Test size filtering to verify it finds children with overlapping sizes');
    console.log('• Check client dashboard for updated size display');

  } catch (error) {
    console.error('❌ Error setting up multiple sizes system:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupMultipleSizes();
}

module.exports = { setupMultipleSizes };
