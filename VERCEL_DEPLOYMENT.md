# Vercel Deployment Guide

This guide will help you deploy the Satellite Tracker application to Vercel and configure the Google Maps API properly.

## Prerequisites

- A Vercel account ([Sign up here](https://vercel.com/signup))
- A Google Cloud Platform account with Maps JavaScript API enabled
- Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Project

The project is already configured for Vercel deployment:
- ✅ API routes are in the `api/` folder (serverless functions)
- ✅ Static files are in the `public/` folder
- ✅ `vercel.json` is configured correctly
- ✅ No file system writes (compatible with serverless)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect the project settings
5. Click "Deploy"

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

**CRITICAL:** You must set the Google Maps API key as an environment variable in Vercel.

### In Vercel Dashboard:

1. Go to your project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name:** `GOOGLE_MAPS_API_KEY`
   - **Value:** Your Google Maps API key
   - **Environment:** Select all (Production, Preview, Development)
4. Click **Save**

### Via CLI:

```bash
vercel env add GOOGLE_MAPS_API_KEY
# Enter your API key when prompted
```

### After Adding Environment Variables:

**IMPORTANT:** You must redeploy for environment variables to take effect:

```bash
vercel --prod
```

Or trigger a new deployment from the Vercel dashboard.

## Step 4: Configure Google Maps API for Vercel

### Domain Restrictions

You need to add your Vercel domain(s) to the Google Maps API key restrictions:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. Under **Application restrictions**, select **HTTP referrers (web sites)**
5. Add the following referrers:
   ```
   https://your-project-name.vercel.app/*
   https://*.vercel.app/*
   ```
   (Replace `your-project-name` with your actual Vercel project name)
6. If you have a custom domain:
   ```
   https://your-custom-domain.com/*
   https://www.your-custom-domain.com/*
   ```
7. Click **Save**

### API Restrictions

1. Under **API restrictions**, select **Restrict key**
2. Ensure **Maps JavaScript API** is enabled
3. Optionally enable **Geocoding API** if you need additional features
4. Click **Save**

## Step 5: Verify Deployment

1. Visit your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Open browser developer tools (F12)
3. Check the Console tab for any errors
4. The app should:
   - Load the Google Maps interface
   - Request location permission
   - Display satellites on the map

## Troubleshooting

### Map Not Loading

**Issue:** Google Maps doesn't load, shows "This page can't load Google Maps correctly"

**Solutions:**
1. ✅ Verify `GOOGLE_MAPS_API_KEY` is set in Vercel environment variables
2. ✅ Check that your Vercel domain is added to Google Maps API key restrictions
3. ✅ Ensure Maps JavaScript API is enabled in Google Cloud Console
4. ✅ Redeploy after adding environment variables
5. ✅ Check browser console for specific error messages

### API Key Not Found Error

**Issue:** Frontend shows "Failed to fetch Google Maps API key"

**Solutions:**
1. ✅ Verify the environment variable name is exactly `GOOGLE_MAPS_API_KEY`
2. ✅ Ensure you've redeployed after adding the environment variable
3. ✅ Check that the `/api/maps/key` endpoint is accessible: `https://your-project.vercel.app/api/maps/key`
4. ✅ Verify the API function is deployed correctly

### CORS Errors

**Issue:** CORS errors when fetching from API

**Solutions:**
- The API functions should handle CORS automatically
- If issues persist, check that API routes are in the `api/` folder
- Verify `vercel.json` configuration

### Satellites Not Showing

**Issue:** Map loads but no satellites appear

**Solutions:**
1. ✅ Check browser console for API errors
2. ✅ Verify `/api/positions` endpoint is working: `https://your-project.vercel.app/api/positions?lat=0&lon=0`
3. ✅ Check network tab to see if API calls are successful
4. ✅ Ensure KeepTrack.Space API is accessible (external dependency)

## Project Structure for Vercel

```
bramhacks/
├── api/                    # Serverless functions (auto-detected by Vercel)
│   ├── maps/
│   │   └── key.js         # Returns Google Maps API key
│   ├── positions.js        # Computes satellite positions
│   └── satellites.js      # Fetches satellite data
├── public/                 # Static files (auto-served by Vercel)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── models/            # 3D models and assets
├── vercel.json            # Vercel configuration
├── package.json
└── server.js              # NOT USED on Vercel (local dev only)
```

## Important Notes

1. **`server.js` is NOT used on Vercel** - Vercel uses serverless functions from the `api/` folder
2. **No file system writes** - The API functions don't write files (compatible with serverless)
3. **Environment variables** - Must be set in Vercel dashboard, not in `.env` file
4. **Automatic deployments** - Vercel auto-deploys on git push (if connected to repo)
5. **API routes** - Automatically available at `/api/*` paths

## Testing Locally with Vercel

You can test the Vercel configuration locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run local development server
vercel dev
```

This will:
- Use your local environment variables (from `.env`)
- Simulate the Vercel serverless environment
- Help debug issues before deploying

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Google Maps API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Support

If you encounter issues:
1. Check the Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure Google Maps API key restrictions are correct

