# Quick Setup Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Your Google Maps API Key

1. Create a `.env` file in the root directory:
   ```bash
   # On Windows (Command Prompt)
   copy NUL .env
   
   # On Windows (PowerShell)
   New-Item .env
   
   # On Mac/Linux
   touch .env
   ```

2. Add your Google Maps API key to the `.env` file:
   ```
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

3. **Get your Google Maps API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "Maps JavaScript API"
   - Go to "Credentials" and create an API key
   - Copy the API key and paste it in your `.env` file

## Step 3: Run the Application

```bash
npm start
```

## Step 4: Open in Browser

Navigate to: `http://localhost:3000`

## That's it! 🎉

The app will:
- Ask for your location permission
- Show you a welcome screen with instructions
- Display satellites on the map
- Notify you when satellites are overhead

## Troubleshooting

**If the map doesn't load:**
- Make sure your API key is correct in the `.env` file
- Verify the "Maps JavaScript API" is enabled in Google Cloud Console
- Check the browser console for any error messages

**If you see "API key not set" errors:**
- Make sure you created the `.env` file in the root directory
- Verify the file contains: `GOOGLE_MAPS_API_KEY=your_key_here`
- Restart the server after creating/updating the `.env` file

