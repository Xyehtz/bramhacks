****# Vercel Deployment Guide

This guide explains how to deploy both the frontend and backend to Vercel.

## Prerequisites

- A Vercel account ([Sign up here](https://vercel.com/signup) - free tier available)
- Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- Node.js installed locally (for testing)

## Overview

Vercel will deploy:
- **Backend**: Express.js server as serverless functions
- **Frontend**: Static files from the `public/` folder
- **API Routes**: All `/api/*` routes will be handled by your Express server

**Note**: The server has been configured to work with Vercel's read-only filesystem. Data files (TLE cache, etc.) are stored in `/tmp` on Vercel, which is temporary but sufficient for serverless functions.

## Step 1: Prepare Your Code

The code is already configured for Vercel:
- ✅ `vercel.json` - Vercel configuration file
- ✅ `server.js` - Exports Express app for Vercel
- ✅ `public/` - Contains all frontend files

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Click "Add New..." → "Project"**

3. **Import your Git repository:**
   - Select your Git provider (GitHub, GitLab, Bitbucket)
   - Choose your repository
   - Click "Import"

4. **Configure the project:**
   - **Framework Preset**: Other (or leave default)
   - **Root Directory**: `./` (root of repository)
   - **Build Command**: Leave empty (no build needed)
   - **Output Directory**: Leave empty (Vercel will handle it)

5. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add: `GOOGLE_MAPS_API_KEY` = `your_actual_api_key_here`
   - Click "Add" for each environment (Production, Preview, Development)

6. **Click "Deploy"**

7. **Wait for deployment** (usually 1-2 minutes)

8. **Copy your deployment URL** (e.g., `https://bramhacks-abc123.vercel.app`)

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Set up and deploy? **Y**
   - Which scope? (select your account)
   - Link to existing project? **N** (first time) or **Y** (subsequent)
   - Project name? (press Enter for default)
   - Directory? (press Enter for `./`)
   - Override settings? **N**

5. **Add environment variables:**
   ```bash
   vercel env add GOOGLE_MAPS_API_KEY
   ```
   - Enter your API key when prompted
   - Select environments: Production, Preview, Development

6. **Redeploy to apply environment variables:**
   ```bash
   vercel --prod
   ```

## Step 3: Verify Deployment

1. **Visit your Vercel URL** (e.g., `https://your-project.vercel.app`)

2. **Test the API endpoints:**
   - `https://your-project.vercel.app/api/health` - Should return `{"status":"ok"}`
   - `https://your-project.vercel.app/api/maps/key` - Should return your Google Maps API key

3. **Test the frontend:**
   - The main page should load
   - Google Maps should display
   - Satellite tracking should work

## Step 4: Update GitHub Pages Frontend (If Using)

If you're also using GitHub Pages for the frontend:

1. **Open `public/index.html`**

2. **Uncomment and update the API base URL:**
   ```html
   <script>window.API_BASE_URL = 'https://your-project.vercel.app';</script>
   ```

3. **Commit and push:**
   ```bash
   git add public/index.html
   git commit -m "Configure Vercel backend URL"
   git push origin main
   ```

## Environment Variables

### Required Variables

- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key

### Optional Variables

- `PORT` - Not needed on Vercel (automatically set)
- `VERCEL` - Automatically set by Vercel (don't set manually)

## Project Structure on Vercel

```
your-project/
├── server.js          → Handles all /api/* routes
├── vercel.json        → Vercel configuration
├── public/            → Served as static files
│   ├── index.html
│   ├── app.**js**
│   ├── style.css
│   └── ...
└── package.json       → Dependencies
```

## Custom Domain (Optional)

1. **Go to your project in Vercel Dashboard**
2. **Settings → Domains**
3. **Add your domain** (e.g., `satellite-tracker.com`)
4. **Follow DNS configuration instructions**

## Troubleshooting

### API Routes Not Working?

- Check that `vercel.json` is in the root directory
- Verify `server.js` exports the Express app (`module.exports = app`)
- Check Vercel deployment logs in the dashboard

### Environment Variables Not Working?

- Make sure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding environment variables
- Check variable names match exactly (case-sensitive)

### Static Files Not Loading?

- Verify files are in the `public/` directory
- Check file paths in HTML (should be relative, e.g., `./style.css`)
- Clear browser cache

### CORS Errors?

- The server already has CORS enabled (`app.use(cors())`)
- If issues persist, check Vercel function logs

### Google Maps Not Loading?

- Verify `GOOGLE_MAPS_API_KEY` is set in Vercel environment variables
- Check that the API key has "Maps JavaScript API" enabled
- Verify the API key is not restricted to specific domains (or add Vercel domain)

## Updating Your Deployment

### Automatic Updates

- **Vercel automatically deploys** when you push to your main branch
- Each push creates a new preview deployment
- Production deployments require manual promotion or auto-deploy from main branch

### Manual Deployment

```bash
vercel --prod
```

## Local Development with Vercel

Test your Vercel setup locally:

```bash
# Install Vercel CLI
npm install -g vercel

# Run Vercel dev server
vercel dev
```

This will:
- Start a local server
- Simulate Vercel's serverless environment
- Use your local `.env` file for environment variables

## Cost

Vercel's free tier includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless functions (generous limits)
- ✅ Custom domains
- ✅ Automatic HTTPS

Perfect for personal projects and small applications!

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test all functionality
3. ✅ Set up custom domain (optional)
4. ✅ Configure automatic deployments
5. ✅ Monitor usage in Vercel dashboard

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- Check deployment logs in Vercel Dashboard → Your Project → Deployments

