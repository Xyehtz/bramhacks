require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const satellite = require('satellite.js');

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
    const response = await axios.get('https://api.keeptrack.space/v2/sats', {
      params: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        alt: 0 // Ground level
      },
      timeout: 10000
    });

    res.json(response.data);

    // Extract first 50 TLE pairs (tle1, tle2) for logging and saving
    try {
      const rawData = response.data;
      let dataArray = [];
      if (Array.isArray(rawData)) {
        dataArray = rawData;
      } else if (rawData && typeof rawData === 'object') {
        const candidateKeys = ['sats', 'satellites', 'data', 'results', 'items'];
        for (const key of candidateKeys) {
          if (Array.isArray(rawData[key])) {
            dataArray = rawData[key];
            break;
          }
        }
      }

      const tlePairs = dataArray.slice(0, 50).map(item => ({
        tle1: item?.tle1,
        tle2: item?.tle2
      })).filter(p => p.tle1 && p.tle2);

      if (tlePairs.length) {
        console.log('Extracted first TLE pairs (up to 50):');
        for (const pair of tlePairs) {
          console.log(pair.tle1);
          console.log(pair.tle2);
          console.log('');
        }
        // Save for reference
        fs.writeFile('TLE_first_50.json', JSON.stringify(tlePairs, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Failed to write TLE_first_50.json:', err.message);
          }
        });
      } else {
        console.warn('No TLE pairs (tle1/tle2) found in the first 50 items.');
      }
    } catch (e) {
      console.error('Error extracting first 50 TLE pairs:', e.message);
    }

    fs.writeFile('APIResponse.txt', JSON.stringify(response.data), 'utf8', (err) => {
        if (err) {
            console.error(`ERROR: ${err}`);
        }
    })

    // Iterate over the first 50 TLE pairs and compute lat/lon/alt for each
    try {
      let tlePairsForCalc = [];

      // Prefer using the TLEs we just extracted; if not available, try reading from file
      try {
        const filePath = path.join(__dirname, 'TLE_first_50.json');
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            tlePairsForCalc = parsed;
          }
        }
      } catch (readErr) {
        console.warn('Could not read TLE_first_50.json, falling back to response data:', readErr.message);
      }

      // Fallback: derive from current response if file was not available or empty
      if (!tlePairsForCalc.length) {
        const rawData = response.data;
        let dataArray = [];
        if (Array.isArray(rawData)) {
          dataArray = rawData;
        } else if (rawData && typeof rawData === 'object') {
          const candidateKeys = ['sats', 'satellites', 'data', 'results', 'items'];
          for (const key of candidateKeys) {
            if (Array.isArray(rawData[key])) {
              dataArray = rawData[key];
              break;
            }
          }
        }
        tlePairsForCalc = dataArray.slice(0, 50).map(item => ({
          tle1: item?.tle1,
          tle2: item?.tle2
        })).filter(p => p.tle1 && p.tle2);
      }

      if (!tlePairsForCalc.length) {
        console.warn('No TLE pairs available to compute positions.');
      } else {
        const now = new Date();
        const gmst = satellite.gstime(now);
        const results = [];

        console.log('Computing positions for up to 50 TLE pairs...');
        tlePairsForCalc.slice(0, 50).forEach((pair, idx) => {
          try {
            const satrec = satellite.twoline2satrec(pair.tle1, pair.tle2);
            const pv = satellite.propagate(
              satrec,
              now.getUTCFullYear(),
              now.getUTCMonth() + 1,
              now.getUTCDate(),
              now.getUTCHours(),
              now.getUTCMinutes(),
              now.getUTCSeconds()
            );

            const positionECI = pv && pv.position;
            if (!positionECI) throw new Error('No ECI position from propagate');

            const positionGD = satellite.eciToGeodetic(positionECI, gmst);
            const longitude = satellite.degreesLong(positionGD.longitude);
            const latitude = satellite.degreesLat(positionGD.latitude);
            const altitude = positionGD.height * 1000; // meters

            results.push({
              index: idx + 1,
              tle1: pair.tle1,
              tle2: pair.tle2,
              latitude,
              longitude,
              altitude
            });

            console.log(`Sat #${idx + 1}: lat=${latitude.toFixed(6)}, lon=${longitude.toFixed(6)}, alt_m=${Math.round(altitude)}`);
          } catch (perSatErr) {
            console.warn(`Failed to compute position for pair #${idx + 1}: ${perSatErr.message}`);
          }
        });

        // Persist computed positions to a file for reference
        fs.writeFile(
          path.join(__dirname, 'TLE_positions_first_50.json'),
          JSON.stringify(results, null, 2),
          'utf8',
          (err) => {
            if (err) {
              console.error('Failed to write TLE_positions_first_50.json:', err.message);
            }
          }
        );
      }
    } catch (calcErr) {
      console.error('Error iterating over TLE pairs to compute positions:', calcErr.message);
    }
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

// Endpoint to serve latest computed satellite positions (first 50)
app.get('/api/positions', async (req, res) => {
  try {
    const positionsPath = path.join(__dirname, 'TLE_positions_first_50.json');
    // If positions file exists and is recent enough, return it
    if (fs.existsSync(positionsPath)) {
      try {
        const content = fs.readFileSync(positionsPath, 'utf8');
        const data = JSON.parse(content);
        if (Array.isArray(data) && data.length) {
          // Normalize keys for frontend: lat/lng in degrees, altitude in meters
          const positions = data.map(p => ({
            index: p.index,
            lat: p.latitude,
            lng: p.longitude,
            altitude: p.altitude,
            tle1: p.tle1,
            tle2: p.tle2
          })).filter(p => isFinite(p.lat) && isFinite(p.lng));
          return res.json({ positions });
        }
      } catch (e) {
        console.warn('Could not parse existing TLE_positions_first_50.json, will attempt to (re)compute:', e.message);
      }
    }

    // Try to compute from TLE_first_50.json
    const tlePath = path.join(__dirname, 'TLE_first_50.json');
    let tlePairs = [];
    if (fs.existsSync(tlePath)) {
      try {
        const content = fs.readFileSync(tlePath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          tlePairs = parsed.slice(0, 50);
        }
      } catch (e) {
        console.warn('Failed to read/parse TLE_first_50.json:', e.message);
      }
    }

    if (!tlePairs.length) {
      return res.status(404).json({ error: 'No TLE data available to compute positions yet. Hit /api/satellites first to generate files.' });
    }

    const now = new Date();
    const gmst = satellite.gstime(now);
    const results = [];
    tlePairs.forEach((pair, idx) => {
      try {
        const satrec = satellite.twoline2satrec(pair.tle1, pair.tle2);
        const pv = satellite.propagate(
          satrec,
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds()
        );
        const positionECI = pv && pv.position;
        if (!positionECI) return;
        const positionGD = satellite.eciToGeodetic(positionECI, gmst);
        const longitude = satellite.degreesLong(positionGD.longitude);
        const latitude = satellite.degreesLat(positionGD.latitude);
        const altitude = positionGD.height * 1000; // meters
        results.push({ index: idx + 1, tle1: pair.tle1, tle2: pair.tle2, latitude, longitude, altitude });
      } catch (err) {
        // skip bad pair
      }
    });

    // Persist and return normalized response
    try {
      fs.writeFileSync(positionsPath, JSON.stringify(results, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to persist TLE_positions_first_50.json:', e.message);
    }

    const positions = results.map(p => ({
      index: p.index,
      lat: p.latitude,
      lng: p.longitude,
      altitude: p.altitude,
      tle1: p.tle1,
      tle2: p.tle2
    })).filter(p => isFinite(p.lat) && isFinite(p.lng));

    res.json({ positions });
  } catch (e) {
    console.error('/api/positions error:', e.message);
    res.status(500).json({ error: 'Failed to get positions', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Make sure to set GOOGLE_MAPS_API_KEY in your .env file`);
});

