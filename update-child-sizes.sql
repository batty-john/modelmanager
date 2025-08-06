-- SQL to update existing child models to match new sizing rules
-- This updates children to use the SMALLER size when their weight falls in overlapping ranges

-- Before running this SQL:
-- 1. BACKUP your database first!
-- 2. Test on a copy of your database
-- 3. Verify the results before applying to production

-- New sizing rules (rounding DOWN for overlaps):
-- Weight ranges and their assigned sizes:
-- 84+ lbs     → 10Y-12Y
-- 49-83 lbs   → 7Y-8Y  
-- 39-48 lbs   → 5T-6T (KEEP AS GROUP)
-- 31-38 lbs   → 3T-4T (KEEP AS GROUP)
-- 28-30 lbs   → 2T
-- 25-27 lbs   → 18-24 Months
-- 22-24 lbs   → 12-18 Months
-- 20-21 lbs   → 6-9 Months (was 9-12 Months - CHANGED)
-- 17-19 lbs   → 6-9 Months (was 6-12 Months - CHANGED)
-- 12-16 lbs   → 3-6 Months
-- 9-11 lbs    → 0-3 Months
-- 6-8 lbs     → Newborn
-- 0-5 lbs     → Preemie

START TRANSACTION;

-- Update children who should be 6-9 Months instead of 9-12 Months or 6-12 Months
-- Weight 20-22 lbs: Change from 9-12 Months to 6-9 Months
UPDATE ChildModels 
SET childSize = '6-9 Months'
WHERE childWeight >= 20 
  AND childWeight <= 22 
  AND childSize = '9-12 Months';

-- Weight 17-22 lbs: Change from 6-12 Months to 6-9 Months  
UPDATE ChildModels 
SET childSize = '6-9 Months'
WHERE childWeight >= 17 
  AND childWeight <= 22 
  AND childSize = '6-12 Months';

-- Update children who should be 5T-6T instead of 7Y-8Y
-- Weight 39-48 lbs: Change from 7Y-8Y to 5T-6T (keep 5T-6T as group)
UPDATE ChildModels 
SET childSize = '5T-6T'
WHERE childWeight >= 39 
  AND childWeight <= 48 
  AND childSize = '7Y-8Y';

-- Update children who should be 3T-4T instead of higher sizes
-- Weight 31-38 lbs: Change from 5T-6T or 7Y-8Y to 3T-4T (keep 3T-4T as group)
UPDATE ChildModels 
SET childSize = '3T-4T'
WHERE childWeight >= 31 
  AND childWeight <= 38 
  AND childSize IN ('5T-6T', '7Y-8Y');

-- Update children who should be 7Y-8Y instead of 10Y-12Y
-- Weight 49-83 lbs: Change from 10Y-12Y to 7Y-8Y
UPDATE ChildModels 
SET childSize = '7Y-8Y'
WHERE childWeight >= 49 
  AND childWeight <= 83 
  AND childSize = '10Y-12Y';

-- Show summary of changes that will be made
SELECT 
    'Summary of size changes:' as info,
    COUNT(*) as total_children_updated
FROM ChildModels 
WHERE 
    (childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months') OR
    (childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months') OR
    (childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y')) OR
    (childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y') OR
    (childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y');

-- Show detailed breakdown of changes
SELECT 
    childSize as current_size,
    COUNT(*) as count,
    CASE 
        WHEN childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months' THEN '6-9 Months'
        WHEN childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months' THEN '6-9 Months'
        WHEN childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y') THEN '3T-4T'
        WHEN childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y' THEN '5T-6T'
        WHEN childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y' THEN '7Y-8Y'
        ELSE 'No change'
    END as new_size
FROM ChildModels 
WHERE 
    (childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months') OR
    (childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months') OR
    (childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y')) OR
    (childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y') OR
    (childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y')
GROUP BY childSize, new_size
ORDER BY 
    CASE childSize
        WHEN 'Preemie' THEN 1
        WHEN 'Newborn' THEN 2
        WHEN '0-3 Months' THEN 3
        WHEN '3-6 Months' THEN 4
        WHEN '6-9 Months' THEN 5
        WHEN '6-12 Months' THEN 6
        WHEN '9-12 Months' THEN 7
        WHEN '12-18 Months' THEN 8
        WHEN '18-24 Months' THEN 9
        WHEN '2T' THEN 10
        WHEN '3T' THEN 11
        WHEN '3T-4T' THEN 12
        WHEN '4T' THEN 13
        WHEN '5T-6T' THEN 14
        WHEN '7Y-8Y' THEN 15
        WHEN '10Y-12Y' THEN 16
        ELSE 17
    END;

-- Uncomment the line below to apply the changes
-- COMMIT;

-- If you want to rollback the changes, uncomment the line below instead
-- ROLLBACK;