# Multiple Child Sizes Implementation

## Overview

This implementation adds support for assigning multiple sizes to child models when their weight falls in overlapping ranges, instead of rounding down to a single size. This provides better flexibility for casting and ensures children aren't missed when filtering by size.

## Key Changes

### Database Schema

1. **New Table: `ChildSizes`**
   - `id` - Primary key
   - `childId` - Foreign key to ChildModels
   - `size` - Size string (e.g., "6-9 Months")
   - `isPrimary` - Boolean indicating the preferred/primary size
   - Unique constraint ensures only one primary size per child

2. **ChildModel Changes**
   - `childSize` field maintained for backward compatibility
   - Synced with primary size from ChildSizes table
   - New association with ChildSizes table

### Size Calculation Logic

**New Files:**
- `utils/sizeCalculator.js` - Enhanced size calculation with overlap detection
- `utils/childSizeManager.js` - Database management for multiple sizes

**Key Features:**
- Identifies all applicable sizes for a given weight
- Determines primary size based on preference rules (smaller sizes preferred)
- Handles overlapping ranges intelligently

### Overlapping Ranges Handled

| Weight Range | Applicable Sizes | Primary Size | Additional Sizes |
|--------------|------------------|--------------|------------------|
| 17-19 lbs | 6-9 Months, 6-12 Months | 6-9 Months | 6-12 Months |
| 20-21 lbs | 6-9 Months, 9-12 Months, 6-12 Months | 6-9 Months | 9-12 Months, 6-12 Months |
| 22-24 lbs | 12-18 Months, 9-12 Months, 6-12 Months | 12-18 Months | 9-12 Months, 6-12 Months |
| 84+ lbs | 10Y-12Y, 7Y-8Y | 7Y-8Y | 10Y-12Y |

### Route Updates

**Modified Routes:**
- `routes/childIntake.js` - Uses new size calculation system
- `routes/dashboard.js` - Updated filtering and size assignment

**Key Changes:**
- Child creation/update now populates ChildSizes table
- Size filtering uses multiple sizes for broader matches
- Includes ChildSizes association in queries

### View Updates

**Modified Views:**
- `views/adminModels.ejs` - Shows primary size + count of additional sizes
- `views/clientDashboard.ejs` - Displays multiple sizes with primary highlighted

**UI Features:**
- Table view shows primary size in dropdown + list of all sizes below
- Card view shows primary size with "+ X more" indicator
- Filtering works with all applicable sizes, not just primary

### Migration Process

1. **Create ChildSizes table** - `20250115000001-create-child-sizes-table.js`
2. **Populate with existing data** - `20250115000002-populate-child-sizes.js`

The population migration:
- Recalculates sizes for all existing children
- Creates ChildSize records for each applicable size
- Updates primary childSize field for backward compatibility

## Benefits

1. **Better Casting Flexibility** - Children appear in multiple size categories when appropriate
2. **No Lost Opportunities** - Size filtering finds all potentially suitable children
3. **Backward Compatibility** - Existing code continues to work with primary size
4. **Clear Primary Size** - UI clearly indicates the preferred size while showing alternatives
5. **Accurate Representation** - Reflects real-world overlap scenarios

## Usage Examples

### For a 20 lb child:
- **Before**: Only assigned "6-9 Months" (rounded down)
- **After**: Assigned "6-9 Months" (primary), "9-12 Months", "6-12 Months"
- **Result**: Child appears when filtering for any of these three sizes

### For an 85 lb child:
- **Before**: Only assigned "10Y-12Y"
- **After**: Assigned "7Y-8Y" (primary), "10Y-12Y"
- **Result**: Child appears when filtering for either size, with 7Y-8Y as preferred

## Technical Notes

- Primary size determination follows "smaller is better" logic for better fit
- Database constraints prevent multiple primary sizes per child
- Filtering performance optimized with proper indexing
- All size updates are atomic (transaction-safe)
- Legacy `childSize` field automatically synced with primary size

## Future Enhancements

- Admin interface to manually adjust primary size selection
- Size recommendation system based on booking history
- Analytics on size overlap utilization
- Bulk size recalculation tools
