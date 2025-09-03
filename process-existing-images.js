const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const imageProcessor = require('./utils/imageProcessor');

async function processExistingImages() {
  console.log('🔄 Starting to process existing images...');

  try {
    // Initialize database connection
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './database.sqlite',
      logging: false
    });

    // Import models
    const AdultModel = require('./models/AdultModel');
    const ChildModel = require('./models/ChildModel');

    // Sync models
    await sequelize.sync();

    // Get all adults and children with photos
    const adults = await AdultModel.findAll({
      where: { photo: { [require('sequelize').Op.ne]: null } }
    });

    const children = await ChildModel.findAll({
      where: { photo: { [require('sequelize').Op.ne]: null } }
    });

    console.log(`📸 Found ${adults.length} adults and ${children.length} children with photos`);

    // Process adult images
    console.log('\n👨 Processing adult images...');
    for (const adult of adults) {
      if (adult.photo) {
        try {
          const result = await imageProcessor.processImage(path.basename(adult.photo));
          if (result.success) {
            console.log(`✅ Processed: ${adult.firstName} ${adult.lastName}`);
          } else {
            console.log(`❌ Failed to process: ${adult.firstName} ${adult.lastName} - ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ Error processing ${adult.firstName} ${adult.lastName}:`, error.message);
        }
      }
    }

    // Process child images
    console.log('\n👶 Processing child images...');
    for (const child of children) {
      if (child.photo) {
        try {
          const result = await imageProcessor.processImage(path.basename(child.photo));
          if (result.success) {
            console.log(`✅ Processed: ${child.childFirstName}`);
          } else {
            console.log(`❌ Failed to process: ${child.childFirstName} - ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ Error processing ${child.childFirstName}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Finished processing existing images!');
    console.log('💡 Tip: You can now use imageProcessor.getBestImagePath() to get optimized versions');

  } catch (error) {
    console.error('❌ Error processing existing images:', error);
  }
}

// Run if called directly
if (require.main === module) {
  processExistingImages();
}

module.exports = processExistingImages;
