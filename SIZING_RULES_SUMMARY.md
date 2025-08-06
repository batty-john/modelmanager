# Child Sizing Rules - Updated for "Round Down" Approach

## 🎯 **New Sizing Logic (Effective After Updates)**

### **Size Ranges (Rounding DOWN for overlaps):**

| **Weight Range** | **Assigned Size** | **Notes** |
|------------------|-------------------|-----------|
| 84+ lbs | 10Y-12Y | Largest size |
| 49-83 lbs | 7Y-8Y | Round down from 10Y-12Y |
| 39-48 lbs | **5T-6T** | **Keep as group** |
| 31-38 lbs | **3T-4T** | **Keep as group** |
| 28-30 lbs | 2T | |
| 25-27 lbs | 18-24 Months | |
| 22-24 lbs | 12-18 Months | |
| 20-21 lbs | 6-9 Months | Round down from 9-12 Months |
| 17-19 lbs | 6-9 Months | Round down from 6-12 Months |
| 12-16 lbs | 3-6 Months | |
| 9-11 lbs | 0-3 Months | |
| 6-8 lbs | Newborn | |
| 0-5 lbs | Preemie | |

## 🔄 **Changes From Previous Logic:**

### **What Changed:**
- **17-22 lbs**: Now all get `6-9 Months` (was mixed `6-12 Months` and `9-12 Months`)
- **49-83 lbs**: Now get `7Y-8Y` (was `10Y-12Y`)

### **What Stayed The Same:**
- **31-38 lbs**: Still get `3T-4T` (group preserved)
- **39-48 lbs**: Still get `5T-6T` (group preserved)
- All other ranges unchanged

## 📋 **SQL Updates Required:**

### **Children Who Will Be Updated:**
1. **Weight 20-22 lbs** with size `9-12 Months` → `6-9 Months`
2. **Weight 17-22 lbs** with size `6-12 Months` → `6-9 Months`
3. **Weight 31-38 lbs** with size `5T-6T` or `7Y-8Y` → `3T-4T`
4. **Weight 39-48 lbs** with size `7Y-8Y` → `5T-6T`
5. **Weight 49-83 lbs** with size `10Y-12Y` → `7Y-8Y`

### **Children Who Stay The Same:**
- Any child already correctly sized according to the new rules
- Children with weights that don't fall in overlap ranges

## 🚀 **Implementation Status:**

✅ **Code Updated**: Both `calculateChildSize` functions updated in:
- `routes/dashboard.js`
- `routes/childIntake.js`

✅ **SQL Created**: 
- `preview-child-size-changes.sql` - Safe preview of changes
- `update-child-sizes.sql` - Actual update statements

✅ **Image Optimization**: Complete image processing system implemented

## 📝 **Next Steps:**

1. **Review the preview**: Run `preview-child-size-changes.sql` to see what will change
2. **Backup database**: Always backup before making changes
3. **Apply updates**: Run `update-child-sizes.sql` to update existing children
4. **Test new uploads**: Verify new children get correctly sized
5. **Monitor performance**: Check dashboard loading speed improvements

## 🔍 **Key Principle:**

> **"Round Down for Overlaps"** - When a child's weight could fit in multiple size ranges, always choose the smaller/younger size. The grouped sizes `3T-4T` and `5T-6T` are preserved as complete groups.