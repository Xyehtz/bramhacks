# Fixing FUNCTION_INVOCATION_FAILED Error

## Error
```
A server error has occurred
FUNCTION_INVOCATION_FAILED
```

This error occurs when a Vercel serverless function crashes during execution.

## Root Causes Identified

1. **Unhandled exceptions** in satellite.js library calls
2. **Invalid TLE data** causing crashes
3. **Function timeout** (processing 50 satellites takes too long)
4. **Missing null checks** before using satellite.js functions
5. **Invalid coordinate values** (NaN, Infinity) being returned

## Fixes Applied

### 1. Comprehensive Error Handling
- Wrapped each satellite.js operation in try-catch blocks
- Added specific error handling for:
  - TLE parsing (`twoline2satrec`)
  - Position propagation (`propagate`)
  - Geodetic conversion (`eciToGeodetic`)
  - Coordinate extraction (`degreesLong`, `degreesLat`)

### 2. Data Validation
- Validate TLE strings before processing
- Check if satellite object exists and has required fields
- Validate coordinates are finite numbers before adding to results
- Trim TLE strings to remove whitespace issues

### 3. Performance Optimizations
- Reduced `TARGET_COUNT` from 50 to 30 (prevents timeouts)
- Reduced axios timeout from 10s to 8s
- Early return if no user location provided
- Better data extraction logic

### 4. Better Error Messages
- Specific error messages for each failure point
- Console logging with satellite index for debugging
- Graceful degradation (skip bad satellites, continue processing)

### 5. Defensive Programming
- Check if `apiResp.data` exists before processing
- Validate array types before iteration
- Handle null/undefined values safely
- Use fallback values for missing data

## Key Changes in `api/positions.js`

```javascript
// Before: Single try-catch, could crash on any error
// After: Multiple try-catch blocks for each operation

// Before: Processed 50 satellites (could timeout)
// After: Process 30 satellites max

// Before: Minimal validation
// After: Comprehensive validation at each step

// Before: Could return NaN/Infinity coordinates
// After: Validates all coordinates are finite numbers
```

## Testing the Fix

After deployment, test:

1. **Health Check:**
   ```
   https://your-project.vercel.app/api/health
   ```
   Should return: `{"status":"ok",...}`

2. **Positions Endpoint:**
   ```
   https://your-project.vercel.app/api/positions?lat=43.68&lon=-79.76
   ```
   Should return: `{"positions":[...]}`

3. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Functions → api/positions → Logs
   - Should see successful processing or specific error messages
   - No more FUNCTION_INVOCATION_FAILED errors

## Expected Behavior

✅ Function completes successfully (no crashes)
✅ Returns valid JSON response
✅ Handles invalid TLE data gracefully
✅ Skips problematic satellites and continues
✅ Returns empty array if no valid satellites found
✅ Better error messages in logs for debugging

## If Errors Persist

### Check Vercel Function Logs
The improved error handling will now show specific errors:
- `Invalid TLE for satellite X: ...`
- `Propagation error for satellite X: ...`
- `Geodetic conversion error for satellite X: ...`
- `Coordinate conversion error for satellite X: ...`

### Common Issues

1. **Still timing out?**
   - Reduce `TARGET_COUNT` further (e.g., to 20)
   - Check if KeepTrack API is slow

2. **All satellites failing?**
   - Check if `satellite.js` is properly imported
   - Verify TLE data format from KeepTrack API

3. **Invalid coordinates?**
   - The validation should catch this now
   - Check logs for specific conversion errors

## Performance Notes

- Processing 30 satellites should complete in < 5 seconds
- Vercel Hobby plan: 10 second timeout
- Vercel Pro plan: 60 second timeout
- If you need more satellites, consider:
  - Caching results
  - Processing in batches
  - Using a background job

## Next Steps

1. **Deploy the changes:**
   ```bash
   git add api/positions.js
   git commit -m "Fix FUNCTION_INVOCATION_FAILED with comprehensive error handling"
   git push
   ```

2. **Monitor Vercel logs** after deployment

3. **Test the endpoints** to verify they work

4. **Check function execution time** in Vercel dashboard

The function should now be much more robust and handle edge cases gracefully!

