# API 500 Error Fixes - Summary

## Changes Made

I've updated all API functions to fix the 500 errors you're experiencing:

### 1. Added CORS Headers
All API functions now include proper CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

### 2. Added Method Validation
Functions now check for:
- OPTIONS requests (preflight) - returns 200 immediately
- Only GET requests allowed - returns 405 for other methods

### 3. Improved Error Handling
- All functions wrapped in try-catch blocks
- Better error messages with details
- Proper return statements (using `return res.status()`)

### 4. Added Null Checks
- Check if data array exists and is valid
- Check if satellite object exists before processing
- Check if satellite.js functions return valid results

### 5. Created Health Check Endpoint
New endpoint: `/api/health` to test if API functions are working

## Files Updated

1. ✅ `api/satellites.js` - Added CORS, error handling, method validation
2. ✅ `api/positions.js` - Added CORS, error handling, null checks, method validation
3. ✅ `api/maps/key.js` - Added CORS, error handling, method validation
4. ✅ `api/health.js` - New health check endpoint

## Next Steps

### 1. Deploy the Changes
```bash
git add .
git commit -m "Fix API 500 errors - add CORS and error handling"
git push
```

Vercel will automatically redeploy.

### 2. Check Vercel Function Logs
**This is the most important step to see the actual error:**

1. Go to Vercel Dashboard
2. Your Project → Deployments → Latest Deployment
3. Click **Functions** tab
4. Click on `api/positions` or `api/satellites`
5. Click **Logs** tab
6. Look for error messages

### 3. Test the Endpoints

After deployment, test these URLs:

```bash
# Health check (should work)
https://your-project.vercel.app/api/health

# Satellites endpoint
https://your-project.vercel.app/api/satellites?lat=43.68&lon=-79.76

# Positions endpoint
https://your-project.vercel.app/api/positions?lat=43.68&lon=-79.76
```

### 4. If Still Getting 500 Errors

Check the Vercel logs for one of these common issues:

#### Issue A: Module Import Error
**Error:** `Cannot find module 'satellite.js'` or `satellite is undefined`

**Solution:** The import might need to be different. Try this in `api/positions.js`:

```javascript
// Option 1 (current)
import satellite from 'satellite.js';

// Option 2 (if Option 1 doesn't work)
import * as satellite from 'satellite.js';

// Option 3 (if Options 1 & 2 don't work)
const satellite = require('satellite.js');
```

If you need to use Option 3, change the file to CommonJS:
```javascript
const axios = require('axios');
const satellite = require('satellite.js');

module.exports = async function handler(req, res) {
  // ... rest of code
}
```

#### Issue B: KeepTrack API Error
**Error:** `Failed to fetch satellite data` or timeout

**Solution:** 
- Check if `https://api.keeptrack.space/v2/sats` is accessible
- The external API might be down or rate-limiting
- Test directly: `curl "https://api.keeptrack.space/v2/sats?lat=43.68&lon=-79.76&alt=0"`

#### Issue C: Function Timeout
**Error:** `Function execution exceeded timeout`

**Solution:**
- Reduce `TARGET_COUNT` from 50 to a smaller number (e.g., 20)
- Or upgrade Vercel plan for longer timeouts

#### Issue D: Invalid TLE Data
**Error:** `Error processing satellite` in logs

**Solution:**
- Some satellites might have invalid TLE data
- The code already skips these with `continue`
- Check logs to see how many are failing

## Debugging Tips

### Test Locally with Vercel CLI
```bash
npm i -g vercel
vercel dev
```

This simulates the Vercel environment locally and shows errors in your terminal.

### Check Browser Console
Open browser DevTools (F12) → Network tab:
- Look for failed requests
- Check the Response tab to see the actual error message
- The "A server e..." suggests HTML error page instead of JSON

### Verify Dependencies
Make sure `package.json` has:
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "satellite.js": "^6.0.1"
  }
}
```

## Expected Behavior After Fix

✅ All API endpoints return JSON (not HTML error pages)
✅ CORS errors are resolved
✅ Proper error messages in JSON format
✅ Health check endpoint works

## Still Need Help?

1. **Share Vercel Function Logs** - Copy the error from Vercel logs
2. **Test the health endpoint** - Does `/api/health` work?
3. **Check network tab** - What's the actual response body?
4. **Try the test endpoints** - Do they work when called directly?

The fixes I've made should resolve most common issues. The key is checking the Vercel logs to see the specific error that's causing the 500 status.

