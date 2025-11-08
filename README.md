# Satellite Tracker 🛰️

A real-time satellite tracking application that displays satellites currently in space on an interactive Google Maps interface. The app tracks satellites flying over your location and provides notifications when satellites are overhead.

## Features

- 🌍 **Interactive Google Maps**: View your location and satellite positions on a beautiful map interface
- 🛰️ **Real-time Satellite Tracking**: Track satellites currently in space using the KeepTrack.Space API
- 🔔 **Overhead Notifications**: Get notified when satellites are flying directly over your location
- 📍 **Auto-location**: Automatically detects your location using browser geolocation
- 🔄 **Auto-updates**: Satellite positions refresh every 30 seconds automatically
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Google Maps API Key ([Get one here](https://console.cloud.google.com/google/maps-apis))
- Internet connection

## Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   ```bash
   copy .env.example .env
   ```
   - Open `.env` and add your Google Maps API Key:
   ```
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

4. **Update the Google Maps API key in the frontend**
   - Open `public/index.html`
   - Find the line: `<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=geometry"></script>`
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key

## Running the Application

1. **Start the server**
   ```bash
   npm start
   ```

2. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Allow location access when prompted
   - Follow the on-screen instructions

## How to Use

1. **Allow Location Access**: When you first open the app, your browser will ask for location permission. Click "Allow" to enable satellite tracking.

2. **Read the Instructions**: A welcome modal will appear with instructions on how to use the app. Click "Start Tracking Satellites" to begin.

3. **View the Map**: 
   - Your location is marked with a blue pin
   - Satellites are marked with red circles
   - Click on any satellite marker to see its details

4. **Notifications**: When a satellite flies directly over your location (within 500 km), a notification will appear at the top of the screen.

5. **Controls**:
   - **Refresh Satellites**: Manually update satellite positions
   - **Center on Me**: Re-center the map on your location

6. **Auto-updates**: The app automatically refreshes satellite positions every 30 seconds.

## API Information

This application uses:
- **Google Maps JavaScript API**: For map display and geolocation features
- **KeepTrack.Space API**: For real-time satellite tracking data

## Troubleshooting

### Map not loading
- Verify your Google Maps API key is correct
- Check that the API key has the "Maps JavaScript API" enabled in Google Cloud Console
- Ensure the API key is added in both `.env` and `public/index.html`

### No satellites showing
- Check your internet connection
- The KeepTrack.Space API may be temporarily unavailable
- Try clicking the "Refresh Satellites" button

### Location not working
- Ensure you've allowed location access in your browser
- Check that your browser supports geolocation
- Try refreshing the page and allowing location access again

### Server errors
- Make sure all dependencies are installed: `npm install`
- Check that port 3000 is not already in use
- Verify your `.env` file is properly configured

## Project Structure

```
BramHacks2025/
├── server.js          # Express server and API endpoints
├── package.json       # Project dependencies
├── .env              # Environment variables (create from .env.example)
├── .env.example      # Environment variables template
├── README.md         # This file
└── public/
    ├── index.html    # Main HTML file
    ├── style.css     # Styling
    └── app.js        # Frontend JavaScript logic
```

## Technologies Used

- **Node.js**: Backend runtime
- **Express**: Web server framework
- **Axios**: HTTP client for API requests
- **Google Maps JavaScript API**: Map and geolocation services
- **KeepTrack.Space API**: Satellite tracking data

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!

## Notes

- Satellite positions are approximations based on available data
- The app uses a 500 km threshold to determine if a satellite is "overhead"
- Position updates occur every 30 seconds to balance accuracy and performance
- Some browsers may require HTTPS for geolocation to work properly


