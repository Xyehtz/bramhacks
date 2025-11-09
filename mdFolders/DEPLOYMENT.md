# GitHub Pages Deployment Guide

> **Note**: This project is now configured for **full Vercel deployment**. See [VERCEL_DEPLOYMENT.md](../VERCEL_DEPLOYMENT.md) for the recommended deployment method.

This guide explains how to deploy the frontend to GitHub Pages (if you prefer separate frontend/backend hosting).

## Prerequisites

- A GitHub account
- Your repository pushed to GitHub
- (Optional) A backend service deployed (Vercel, Netlify, etc.) for API endpoints

## Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** → **Pages**
3. Under **Source**, select:
   - **GitHub Actions** (recommended - uses the workflow we created)
   - OR **Deploy from a branch** → select `gh-pages` branch and `/ (root)` folder

## Step 2: Configure Backend URL

You have two options for the backend:

### Option A: Cloud Service (Vercel, Netlify, etc.)

If you've deployed your backend to a service like Vercel or Netlify:

1. Open `public/index.html`
2. Uncomment and update the API base URL line:
   ```html
   <script>window.API_BASE_URL = 'https://your-backend-url.vercel.app';</script>
   ```
3. Replace `https://your-backend-url.vercel.app` with your actual backend URL

### Option B: Local Computer Backend

If you want to run the backend on your computer:

1. See **[LOCAL_BACKEND_SETUP.md](LOCAL_BACKEND_SETUP.md)** for detailed instructions
2. Use a tunneling service (ngrok, Cloudflare Tunnel) to expose your local server
3. Update `public/index.html` with your tunnel URL:
   ```html
   <script>window.API_BASE_URL = 'https://your-tunnel-url.ngrok.io';</script>
   ```

## Step 3: Push to GitHub

The GitHub Actions workflow will automatically deploy when you push to the `main` or `master` branch:

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

## Step 4: Access Your Site

After the workflow completes (usually takes 1-2 minutes), your site will be available at:
- `https://your-username.github.io/bramhacks` (if repository name is `bramhacks`)
- OR `https://your-username.github.io` (if repository name is `your-username.github.io`)

## Troubleshooting

### Workflow not running?
- Check that GitHub Actions are enabled in your repository settings
- Ensure the workflow file is in `.github/workflows/deploy.yml`
- Check the Actions tab for any error messages

### API calls failing?
- Make sure you've set the `API_BASE_URL` in `index.html` if using a separate backend
- Check browser console for CORS errors
- Verify your backend is deployed and accessible

### Site not updating?
- GitHub Pages can take a few minutes to update
- Check the Actions tab to see if deployment completed successfully
- Try clearing your browser cache

## Local Testing

To test the deployment locally before pushing:

1. Serve the `public/` folder using a local server:
   ```bash
   # Using Python
   cd public
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server public -p 8000
   ```

2. Open `http://localhost:8000` in your browser

## Next Steps

After deploying the frontend, you'll need to set up the backend:

**Option 1: Run on your computer**
- See **[LOCAL_BACKEND_SETUP.md](LOCAL_BACKEND_SETUP.md)** for complete instructions
- Use ngrok or Cloudflare Tunnel to expose your local server

**Option 2: Deploy to cloud service**
- Use services like Vercel, Netlify Functions, or Railway for the backend
- Update `public/index.html` with your backend URL

