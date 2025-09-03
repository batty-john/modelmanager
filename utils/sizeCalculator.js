/**
 * Enhanced child size calculation with support for multiple sizes in overlapping ranges
 */

/**
 * Define size ranges with their weight boundaries
 * Each range can have overlaps with adjacent ranges
 */
const SIZE_RANGES = [
  { size: '10Y-12Y', minWeight: 84, maxWeight: Infinity },
  { size: '7Y-8Y', minWeight: 49, maxWeight: Infinity },  // Overlaps with 10Y-12Y for 84+ lbs
  { size: '5T-6T', minWeight: 39, maxWeight: 48 },
  { size: '3T-4T', minWeight: 31, maxWeight: 38 },
  { size: '2T', minWeight: 28, maxWeight: 30 },
  { size: '18-24 Months', minWeight: 25, maxWeight: 27 },
  { size: '12-18 Months', minWeight: 22, maxWeight: 24 },
  { size: '9-12 Months', minWeight: 20, maxWeight: 24 },  // Overlaps with 12-18 Months
  { size: '6-9 Months', minWeight: 17, maxWeight: 21 },   // Overlaps with 9-12 Months
  { size: '6-12 Months', minWeight: 17, maxWeight: 24 },  // Overlaps with both 6-9 and 9-12
  { size: '3-6 Months', minWeight: 12, maxWeight: 16 },
  { size: '0-3 Months', minWeight: 9, maxWeight: 11 },
  { size: 'Newborn', minWeight: 6, maxWeight: 8 },
  { size: 'Preemie', minWeight: 0, maxWeight: 5 }
];

/**
 * Calculate all applicable sizes for a child based on weight
 * Returns an array of size strings (no primary distinction)
 * @param {number} weight - Child's weight in lbs
 * @param {number} height - Child's height (currently not used but kept for compatibility)
 * @returns {Array} Array of size strings
 */
function calculateChildSizes(weight, height) {
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  
  if (isNaN(weightNum) || isNaN(heightNum)) {
    return [];
  }
  
  // Handle edge cases for very large children
  if (weightNum > 101) {
    return ['10Y-12Y'];
  }
  
  // Find all applicable sizes
  const applicableSizes = SIZE_RANGES.filter(range => 
    weightNum >= range.minWeight && weightNum <= range.maxWeight
  );
  
  if (applicableSizes.length === 0) {
    return [];
  }
  
  // Return all applicable sizes sorted by preference (smaller/younger first)
  const sortedSizes = applicableSizes.map(range => range.size);
  return sortSizesByPreference(sortedSizes);
}

/**
 * Sort sizes by preference (smaller/younger sizes first)
 * @param {Array} sizes - Array of size strings
 * @returns {Array} Sorted array of sizes
 */
function sortSizesByPreference(sizes) {
  // Define size order from smallest/youngest to largest/oldest
  const sizeOrder = [
    'Preemie',
    'Newborn', 
    '0-3 Months',
    '3-6 Months',
    '6-9 Months',
    '6-12 Months',
    '9-12 Months',
    '12-18 Months',
    '18-24 Months',
    '2T',
    '3T-4T',
    '5T-6T',
    '7Y-8Y',
    '10Y-12Y'
  ];
  
  return sizes.sort((a, b) => {
    const aIndex = sizeOrder.indexOf(a);
    const bIndex = sizeOrder.indexOf(b);
    return aIndex - bIndex;
  });
}

/**
 * Backward compatibility function that returns first (preferred) size
 * @param {number} weight - Child's weight in lbs  
 * @param {number} height - Child's height
 * @returns {string|null} First/preferred size string or null
 */
function calculateChildSize(weight, height) {
  const sizes = calculateChildSizes(weight, height);
  return sizes.length > 0 ? sizes[0] : null;
}

/**
 * Get all unique sizes that are currently in use
 * @returns {Array} Array of all possible child sizes
 */
function getAllChildSizes() {
  return SIZE_RANGES.map(range => range.size);
}

/**
 * Check if a weight falls in an overlapping range (has multiple applicable sizes)
 * @param {number} weight - Child's weight in lbs
 * @returns {boolean} True if weight has multiple applicable sizes
 */
function hasOverlappingSizes(weight) {
  const weightNum = parseFloat(weight);
  if (isNaN(weightNum)) return false;
  
  const applicableSizes = SIZE_RANGES.filter(range => 
    weightNum >= range.minWeight && weightNum <= range.maxWeight
  );
  
  return applicableSizes.length > 1;
}

module.exports = {
  calculateChildSizes,
  calculateChildSize,
  getAllChildSizes,
  hasOverlappingSizes,
  SIZE_RANGES
};
