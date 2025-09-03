'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all existing children
    const children = await queryInterface.sequelize.query(
      'SELECT id, childWeight, childHeight FROM ChildModels WHERE childWeight IS NOT NULL AND childHeight IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${children.length} children to process`);

    // Import the size calculation logic
    const { calculateChildSizes } = require('../utils/sizeCalculator');

    for (const child of children) {
      try {
        // Calculate all applicable sizes for this child
        const sizeResults = calculateChildSizes(child.childWeight, child.childHeight);
        
        if (sizeResults.length > 0) {
          // Insert size records for this child
          for (const sizeResult of sizeResults) {
            await queryInterface.sequelize.query(
              'INSERT INTO ChildSizes (childId, size, isPrimary, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
              {
                replacements: [child.id, sizeResult.size, sizeResult.isPrimary],
                type: Sequelize.QueryTypes.INSERT
              }
            );
          }
          
          // Update the primary size in the ChildModel for backward compatibility
          const primarySize = sizeResults.find(s => s.isPrimary);
          if (primarySize) {
            await queryInterface.sequelize.query(
              'UPDATE ChildModels SET childSize = ? WHERE id = ?',
              {
                replacements: [primarySize.size, child.id],
                type: Sequelize.QueryTypes.UPDATE
              }
            );
          }
          
          console.log(`Processed child ${child.id}: ${sizeResults.length} size(s)`);
        }
      } catch (error) {
        console.error(`Error processing child ${child.id}:`, error);
      }
    }
    
    console.log('Finished populating ChildSizes table');
  },

  async down(queryInterface, Sequelize) {
    // Remove all records from ChildSizes table
    await queryInterface.sequelize.query('DELETE FROM ChildSizes');
    console.log('Cleared ChildSizes table');
  }
};
