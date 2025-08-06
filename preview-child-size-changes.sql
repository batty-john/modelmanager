-- Preview what child size changes will be made
-- Run this FIRST to see what will change before applying the updates

-- This query shows all children who will be affected by the new sizing rules
SELECT 
    id,
    childFirstName,
    childWeight,
    childSize as current_size,
    CASE 
        -- Weight 20-22 lbs: Change from 9-12 Months to 6-9 Months
        WHEN childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months' THEN '6-9 Months'
        
        -- Weight 17-22 lbs: Change from 6-12 Months to 6-9 Months  
        WHEN childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months' THEN '6-9 Months'
        
        -- Weight 31-38 lbs: Change from 5T-6T or 7Y-8Y to 3T-4T (keep 3T-4T as group)
        WHEN childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y') THEN '3T-4T'
        
        -- Weight 39-48 lbs: Change from 7Y-8Y to 5T-6T (keep 5T-6T as group)
        WHEN childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y' THEN '5T-6T'
        
        -- Weight 49-83 lbs: Change from 10Y-12Y to 7Y-8Y
        WHEN childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y' THEN '7Y-8Y'
        
        ELSE childSize
    END as new_size,
    CASE 
        WHEN childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months' THEN 'Overlap: 20-22 lbs can be 6-9 or 9-12, choosing smaller'
        WHEN childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months' THEN 'Overlap: 17-22 lbs can be 6-9 or 6-12, choosing smaller'
        WHEN childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y') THEN 'Weight 31-38 lbs should be 3T-4T group, not larger sizes'
        WHEN childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y' THEN 'Weight 39-48 lbs should be 5T-6T group, not 7Y-8Y'
        WHEN childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y' THEN 'Overlap: 49-83 lbs can be 7Y-8Y or 10Y-12Y, choosing smaller'
        ELSE 'No change needed'
    END as reason
FROM ChildModels 
WHERE 
    (childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months') OR
    (childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months') OR
    (childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y')) OR
    (childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y') OR
    (childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y')
ORDER BY childWeight, childFirstName;

-- Summary count by change type
SELECT 
    'SUMMARY: Children that will be updated' as summary,
    COUNT(*) as total_affected
FROM ChildModels 
WHERE 
    (childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months') OR
    (childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months') OR
    (childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y')) OR
    (childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y') OR
    (childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y')

UNION ALL

SELECT 
    'Total children in database' as summary,
    COUNT(*) as total_affected
FROM ChildModels;

-- Breakdown by current size
SELECT 
    childSize as current_size,
    COUNT(*) as children_with_this_size,
    COUNT(CASE 
        WHEN (childWeight >= 20 AND childWeight <= 22 AND childSize = '9-12 Months') OR
             (childWeight >= 17 AND childWeight <= 22 AND childSize = '6-12 Months') OR
             (childWeight >= 31 AND childWeight <= 38 AND childSize IN ('5T-6T', '7Y-8Y')) OR
             (childWeight >= 39 AND childWeight <= 48 AND childSize = '7Y-8Y') OR
             (childWeight >= 49 AND childWeight <= 83 AND childSize = '10Y-12Y')
        THEN 1 END) as will_be_changed
FROM ChildModels 
GROUP BY childSize
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