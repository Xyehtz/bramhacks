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

// Helper function to calculate distance between two lat/lng points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);

    console.log(`Fetching satellites for user location: ${userLat}, ${userLon}`);

    // Fetch satellite data from keeptrack.space API
    const response = await axios.get('https://api.keeptrack.space/v2/sats', {
      params: {
        lat: userLat,
        lon: userLon,
        alt: 0 // Ground level
      },
      timeout: 10000
    });

    res.json(response.data);

    // Save the full response for debugging
    fs.writeFile('APIResponse.txt', JSON.stringify(response.data), 'utf8', (err) => {
        if (err) {
            console.error(`ERROR saving APIResponse.txt: ${err}`);
        }
    });

    // Extract TLE data from response
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

      // Extract all valid TLE pairs (not just first 50)
      const allTlePairs = dataArray
        .map((item, index) => ({
          index: index,
          name: item?.name || `Satellite ${index + 1}`,
          tle1: item?.tle1,
          tle2: item?.tle2
        }))
        .filter(p => p.tle1 && p.tle2);

      if (!allTlePairs.length) {
        console.warn('No TLE pairs found in response data.');
        return;
      }

      console.log(`Found ${allTlePairs.length} satellites with valid TLE data`);

      // Calculate positions for all satellites and find nearest 50
      const now = new Date();
      const gmst = satellite.gstime(now);
      const satellitesWithPositions = [];

      console.log('Computing positions for all satellites...');
      allTlePairs.forEach((pair) => {
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
          if (!positionECI || typeof positionECI.x !== 'number') {
            return; // Skip invalid positions
          }

          const positionGD = satellite.eciToGeodetic(positionECI, gmst);
          const longitude = satellite.degreesLong(positionGD.longitude);
          const latitude = satellite.degreesLat(positionGD.latitude);
          const altitude = positionGD.height * 1000; // meters

          // Calculate distance from user location
          const distance = calculateDistance(userLat, userLon, latitude, longitude);

          satellitesWithPositions.push({
            name: pair.name,
            index: pair.index,
            tle1: pair.tle1,
            tle2: pair.tle2,
            latitude,
            longitude,
            altitude,
            distance
          });
        } catch (perSatErr) {
          // Skip satellites that fail to propagate
          console.warn(`Failed to compute position for ${pair.name}: ${perSatErr.message}`);
        }
      });

      console.log(`Successfully computed positions for ${satellitesWithPositions.length} satellites`);

      // Sort by distance and take the nearest 50
      const nearest = satellitesWithPositions
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50); // EDIT to change number of satellites saved

      console.log(`Selected 50 nearest satellites (closest: ${(nearest[0]?.distance / 1000).toFixed(2)} km)`);

      // Save the nearest 50 TLE pairs
      const tlePairsToSave = nearest.map(sat => ({
        name: sat.name,
        tle1: sat.tle1,
        tle2: sat.tle2
      }));

      fs.writeFile(
        'TLE_first_50.json',
        JSON.stringify(tlePairsToSave, null, 2),
        'utf8',
        (err) => {
          if (err) {
            console.error('Failed to write TLE_first_50.json:', err.message);
          } else {
            console.log('Saved nearest 50 TLE pairs to TLE_first_50.json');
          }
        }
      );

      // Save the computed positions for the nearest 50
      const positionsToSave = nearest.map((sat, idx) => ({
        index: idx + 1,
        name: sat.name,
        tle1: sat.tle1,
        tle2: sat.tle2,
        latitude: sat.latitude,
        longitude: sat.longitude,
        altitude: sat.altitude,
        distance: sat.distance
      }));

      fs.writeFile(
        path.join(__dirname, 'TLE_positions_first_50.json'),
        JSON.stringify(positionsToSave, null, 2),
        'utf8',
        (err) => {
          if (err) {
            console.error('Failed to write TLE_positions_first_50.json:', err.message);
          } else {
            console.log('Saved nearest 50 positions to TLE_positions_first_50.json');
            // Log first few for verification
            console.log('\nNearest satellites:');
            positionsToSave.slice(0, 5).forEach(sat => {
              console.log(`  ${sat.name}: ${(sat.distance / 1000).toFixed(2)} km away`);
            });
          }
        }
      );

    } catch (e) {
      console.error('Error processing TLE data:', e.message);
    }

  } catch (error) {
    console.error('Error fetching satellite data:', error.message);
    
    // Fallback: try alternative endpoint
    try {
      const tleResponse = await axios.get('https://api.keeptrack.space/v2/tle', {
        timeout: 10000
      });
      
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

// Endpoint to serve Google Maps API key securely
app.get('/api/maps/key', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }
  res.json({ key: apiKey });
});

// Endpoint to serve latest computed satellite positions (nearest 50)
app.get('/api/positions', async (req, res) => {
  try {
    const positionsPath = path.join(__dirname, 'TLE_positions_first_50.json');
    
    // If positions file exists, return it (will be recalculated on next /api/satellites call)
    if (fs.existsSync(positionsPath)) {
      try {
        const content = fs.readFileSync(positionsPath, 'utf8');
        const data = JSON.parse(content);
        if (Array.isArray(data) && data.length) {
          // Recalculate current positions using stored TLEs
          const now = new Date();
          const gmst = satellite.gstime(now);
          const updatedPositions = [];

          data.forEach((sat) => {
            try {
              const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
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

              updatedPositions.push({
                index: sat.index,
                name: sat.name,
                lat: latitude,
                lng: longitude,
                altitude: altitude
              });
            } catch (err) {
              // Skip satellites that fail
            }
          });

          const positions = updatedPositions.filter(p => isFinite(p.lat) && isFinite(p.lng));
          return res.json({ positions });
        }
      } catch (e) {
        console.warn('Could not parse existing TLE_positions_first_50.json:', e.message);
      }
    }

    // If no cached positions, return error asking user to initialize
    return res.status(404).json({ 
      error: 'No satellite data available yet. Please wait for initial data load.' 
    });

  } catch (e) {
    console.error('/api/positions error:', e.message);
    res.status(500).json({ error: 'Failed to get positions', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Make sure to set GOOGLE_MAPS_API_KEY in your .env file`);
});