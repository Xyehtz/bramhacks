# Vercel API 500 Error Troubleshooting Guide

## Issue: API Endpoints Returning 500 Errors

If you're seeing 500 errors from `/api/satellites` and `/api/positions`, follow these steps:

## Step 1: Check Vercel Function Logs

1. Go to your Vercel Dashboard
2. Navigate to your project
3. Click on **Deployments**
4. Click on the latest deployment
5. Click on **Functions** tab
6. Click on the failing function (e.g., `api/positions`)
7. Check the **Logs** tab for error messages

Common errors you might see:
- `Module not found` - Missing dependency
- `Cannot read property of undefined` - Null/undefined check needed
- `Import error` - Module import syntax issue

## Step 2: Verify Dependencies

Ensure all dependencies are in `package.json`:

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "satellite.js": "^6.0.1"
  }
}
```

## Step 3: Test API Endpoints Directly

Test the endpoints in your browser or with curl:

```bash
# Test satellites endpoint
curl "https://your-project.vercel.app/api/satellites?lat=43.68&lon=-79.76"

# Test positions endpoint
curl "https://your-project.vercel.app/api/positions?lat=43.68&lon=-79.76"

# Test maps key endpoint
curl "https://your-project.vercel.app/api/maps/key"
```

## Step 4: Common Fixes

### Fix 1: Module Import Syntax

If `satellite.js` import is failing, try:

**Option A (Current):**
```javascript
import * as satellite from 'satellite.js';
```

**Option B (If Option A doesn't work):**
```javascript
const satellite = require('satellite.js');
```

**Option C (If using ES modules):**
```javascript
import satellite from 'satellite.js';
```

### Fix 2: Add Error Handling

Make sure all API functions have proper try-catch blocks and return statements.

### Fix 3: Check Environment Variables

Verify `GOOGLE_MAPS_API_KEY` is set in Vercel:
- Settings → Environment Variables
- Must be set for Production, Preview, and Development

### Fix 4: Verify KeepTrack API is Accessible

The API functions call `https://api.keeptrack.space/v2/sats`. Test this directly:

```bash
curl "https://api.keeptrack.space/v2/sats?lat=43.68&lon=-79.76&alt=0"
```

If this fails, the external API might be down or blocking requests.

## Step 5: Debug Locally

Test with Vercel CLI locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run local dev server
vercel dev
```

This will simulate the Vercel environment and show errors in your terminal.

## Step 6: Check Function Timeout

Vercel serverless functions have timeout limits:
- Hobby plan: 10 seconds
- Pro plan: 60 seconds

If your function is timing out, check:
- External API response times
- Complex calculations taking too long
- Network latency

## Step 7: Verify Response Format

Ensure all responses are valid JSON:

```javascript
// ✅ Good
return res.status(200).json({ data: result });

// ❌ Bad - Missing return
res.status(200).json({ data: result });

// ❌ Bad - Not JSON
return res.status(200).send('text');
```

## Step 8: Check CORS Headers

If you see CORS errors, ensure CORS headers are set:

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
```

## Common Error Messages and Solutions

### "A server error occurred"
- **Cause:** Function crashed before returning response
- **Solution:** Check Vercel logs for the actual error

### "Module not found: Can't resolve 'satellite.js'"
- **Cause:** Dependency not installed or wrong import
- **Solution:** 
  1. Verify `satellite.js` is in `package.json`
  2. Try different import syntax (see Fix 1)
  3. Redeploy

### "Cannot read property 'gstime' of undefined"
- **Cause:** `satellite` object is undefined
- **Solution:** Fix import syntax (see Fix 1)

### "Request timeout"
- **Cause:** Function taking too long
- **Solution:** 
  1. Reduce number of satellites processed
  2. Optimize calculations
  3. Check external API response time

## Quick Test Function

Create a simple test endpoint to verify the function works:

```javascript
// api/test.js
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ 
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
}
```

Test it: `https://your-project.vercel.app/api/test`

## Still Having Issues?

1. **Check Vercel Logs** - Most important step!
2. **Test locally with `vercel dev`**
3. **Simplify the function** - Remove complex logic temporarily
4. **Check Vercel Status** - https://vercel-status.com
5. **Review Vercel Documentation** - https://vercel.com/docs

## Additional Resources

- [Vercel Function Logs](https://vercel.com/docs/concepts/functions/serverless-functions#logs)
- [Vercel Error Handling](https://vercel.com/docs/concepts/functions/serverless-functions#error-handling)
- [Vercel Debugging Guide](https://vercel.com/docs/concepts/debugging)

