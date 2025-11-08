require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve index.html with API key injection
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Replace API key placeholder with actual key from environment
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
    html = html.replace(/YOUR_GOOGLE_MAPS_API_KEY/g, apiKey);
    
    res.send(html);
});

// Serve other static files
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint for satellite data from keeptrack.space
app.get('/api/satellites', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Fetch satellite data from keeptrack.space API
    // Using their API endpoint for satellite positions
    const response = await axios.get('https://api.keeptrack.space/v2/satellites', {
      params: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        alt: 0 // Ground level
      },
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching satellite data:', error.message);
    
    // Fallback: try alternative endpoint or return sample data structure
    try {
      // Alternative: try getting TLE data and calculate positions
      const tleResponse = await axios.get('https://api.keeptrack.space/v2/tle', {
        timeout: 10000
      });
      
      // If we get TLE data, we'd need to calculate positions
      // For now, return a structure that the frontend can handle
      res.json({ satellites: [], error: 'Position calculation needed' });
    } catch (fallbackError) {
      res.status(500).json({ 
        error: 'Failed to fetch satellite data',
        message: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Make sure to set GOOGLE_MAPS_API_KEY in your .env file`);
});

