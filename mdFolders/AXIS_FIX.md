# Fixing Axios Module Not Found Error on Vercel

## Error
```
Cannot find module '/var/task/node_modules/axios/dist/node/axios.cjs'
Did you forget to add it to "dependencies" in `package.json`?
```

## Root Cause
Vercel is having trouble resolving the `axios` module during the serverless function execution. This can happen when:
1. Dependencies aren't properly installed during build
2. Package-lock.json is out of sync
3. Module resolution issues with ES6 imports

## Fixes Applied

### 1. Updated `package.json`
- Added `vercel-build` script to explicitly run `npm install`
- Added `engines` field to specify Node.js version (>=18.x)

### 2. Updated `vercel.json`
- Added `buildCommand` to ensure dependencies are installed

## Additional Steps You Need to Take

### Step 1: Update package-lock.json
Make sure your `package-lock.json` is up to date:

```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# Commit the updated package-lock.json
git add package-lock.json
git commit -m "Update package-lock.json for Vercel"
git push
```

### Step 2: Verify Dependencies
Ensure all dependencies are listed in `package.json`:
- ✅ `axios`: ^1.6.0
- ✅ `satellite.js`: ^6.0.1

### Step 3: Redeploy
After pushing the changes, Vercel will automatically redeploy. The build process should now:
1. Run `npm install` (via vercel-build script)
2. Install all dependencies including axios
3. Bundle the serverless functions correctly

## Alternative Fix (If Still Not Working)

If the error persists, try using a specific axios version instead of a range:

```json
{
  "dependencies": {
    "axios": "1.6.0",
    "satellite.js": "6.0.1"
  }
}
```

Then:
```bash
rm -rf node_modules package-lock.json
npm install
git add package.json package-lock.json
git commit -m "Pin dependency versions"
git push
```

## Verify the Fix

After deployment, check:
1. Vercel build logs - should show `npm install` running
2. Function logs - should no longer show module not found errors
3. Test endpoints - `/api/health`, `/api/satellites`, `/api/positions`

## Why This Happens

Vercel serverless functions need all dependencies to be:
1. Listed in `package.json`
2. Installed during the build process
3. Available in the function's runtime environment

The error suggests that axios wasn't properly installed or bundled. The `vercel-build` script ensures dependencies are installed before the functions are deployed.

