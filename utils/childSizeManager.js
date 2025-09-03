/**
 * Utility functions for managing child sizes in the database
 */

const { ChildSize, ChildModel } = require('../models');
const { calculateChildSizes, calculateChildSize } = require('./sizeCalculator');

/**
 * Update child sizes based on weight and height
 * This function handles both the legacy childSize field and the new ChildSizes table
 * @param {number} childId - ID of the child model
 * @param {number} weight - Child's weight
 * @param {number} height - Child's height
 * @param {Object} transaction - Optional database transaction
 * @returns {Promise<Array>} Array of created/updated ChildSize records
 */
async function updateChildSizes(childId, weight, height, transaction = null) {
  try {
    // Calculate all applicable sizes
    const applicableSizes = calculateChildSizes(weight, height);
    
    if (applicableSizes.length === 0) {
      throw new Error('No applicable sizes found for the given weight and height');
    }
    
    // Update the legacy childSize field with the first (preferred) size
    await ChildModel.update(
      { childSize: applicableSizes[0] },
      { 
        where: { id: childId },
        transaction
      }
    );
    
    // Remove existing sizes for this child
    await ChildSize.destroy({
      where: { childId },
      transaction
    });
    
    // Create new size records (no primary distinction)
    const childSizeRecords = await Promise.all(
      applicableSizes.map((size, index) => 
        ChildSize.create({
          childId,
          size: size,
          isPrimary: index === 0 // Keep first one as primary for database constraint
        }, { transaction })
      )
    );
    
    return childSizeRecords;
    
  } catch (error) {
    console.error('Error updating child sizes:', error);
    throw error;
  }
}

/**
 * Get all sizes for a specific child
 * @param {number} childId - ID of the child model
 * @returns {Promise<Array>} Array of ChildSize records
 */
async function getChildSizes(childId) {
  try {
    return await ChildSize.findAll({
      where: { childId },
      order: [['isPrimary', 'DESC'], ['size', 'ASC']]
    });
  } catch (error) {
    console.error('Error getting child sizes:', error);
    throw error;
  }
}

/**
 * Get the primary size for a child
 * @param {number} childId - ID of the child model
 * @returns {Promise<string|null>} Primary size string or null
 */
async function getPrimaryChildSize(childId) {
  try {
    const primarySize = await ChildSize.findOne({
      where: { 
        childId,
        isPrimary: true 
      }
    });
    
    return primarySize ? primarySize.size : null;
  } catch (error) {
    console.error('Error getting primary child size:', error);
    throw error;
  }
}

/**
 * Check if a child has multiple sizes (overlapping ranges)
 * @param {number} childId - ID of the child model
 * @returns {Promise<boolean>} True if child has multiple sizes
 */
async function hasMultipleSizes(childId) {
  try {
    const count = await ChildSize.count({
      where: { childId }
    });
    
    return count > 1;
  } catch (error) {
    console.error('Error checking multiple sizes:', error);
    throw error;
  }
}

/**
 * Get all children that match a specific size (for filtering)
 * @param {string} size - Size to filter by
 * @returns {Promise<Array>} Array of child IDs that match the size
 */
async function getChildrenBySize(size) {
  try {
    const childSizes = await ChildSize.findAll({
      where: { size },
      attributes: ['childId']
    });
    
    return childSizes.map(cs => cs.childId);
  } catch (error) {
    console.error('Error getting children by size:', error);
    throw error;
  }
}

/**
 * Migrate existing child data to the new multiple sizes system
 * This function should be run after the migration to populate the ChildSizes table
 * @returns {Promise<number>} Number of children processed
 */
async function migrateExistingChildSizes() {
  try {
    const children = await ChildModel.findAll({
      attributes: ['id', 'childWeight', 'childHeight']
    });
    
    let processedCount = 0;
    
    for (const child of children) {
      try {
        await updateChildSizes(child.id, child.childWeight, child.childHeight);
        processedCount++;
      } catch (error) {
        console.error(`Error migrating child ${child.id}:`, error);
      }
    }
    
    console.log(`Migrated ${processedCount} children to multiple sizes system`);
    return processedCount;
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

module.exports = {
  updateChildSizes,
  getChildSizes,
  getPrimaryChildSize,
  hasMultipleSizes,
  getChildrenBySize,
  migrateExistingChildSizes
};
