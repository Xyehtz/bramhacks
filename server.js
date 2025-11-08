require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const satellite = require('satellite.js');

const app = express();
const PORT = process.env.PORT || 3000;
// Target number of satellites to persist/compute
const TARGET_COUNT = 50;

// Middleware
app.use(cors());
app.use(express.json());

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

    // Extract first N TLE pairs (tle1, tle2) for logging and saving
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

      // Build list of available TLE items with satnum parsed from TLE line 1
      const available = dataArray
        .map(item => {
          const tle1 = item?.tle1;
          const tle2 = item?.tle2;
          if (!tle1 || !tle2) return null;
          const match = /^1\s+(\d{5})/.exec(tle1.trim());
          const satnum = match ? parseInt(match[1], 10) : undefined;
          return satnum ? { satnum, tle1, tle2 } : null;
        })
        .filter(Boolean);

      const selectionPath = path.join(__dirname, 'Selected_satellites.json');
      let selected = [];

      if (fs.existsSync(selectionPath)) {
        // Load existing persistent selection and refresh their TLEs from current availability
        try {
          const existing = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
          if (Array.isArray(existing)) {
            const availMap = new Map(available.map(a => [a.satnum, a]));
            selected = existing.map(rec => {
              const upd = availMap.get(rec.satnum);
              return upd ? { ...rec, tle1: upd.tle1, tle2: upd.tle2, updatedAt: new Date().toISOString() } : rec;
            });
          }
        } catch (e) {
          console.warn('Failed to read Selected_satellites.json, reinitializing from current data:', e.message);
        }
      }
      
      // If we already have a selection but it's smaller than TARGET_COUNT, top it up deterministically
      if (selected.length && selected.length < TARGET_COUNT) {
        try {
          const have = new Set(selected.map(s => s.satnum));
          // Sort available by satnum ascending for deterministic append
          const sortedAvail = available
            .filter(a => !have.has(a.satnum))
            .sort((a, b) => a.satnum - b.satnum);
          let idx = selected.length;
          for (const rec of sortedAvail) {
            selected.push({
              index: ++idx,
              satnum: rec.satnum,
              tle1: rec.tle1,
              tle2: rec.tle2,
              selectedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            if (selected.length >= TARGET_COUNT) break;
          }
        } catch (topUpErr) {
          console.warn('Failed to top up selection:', topUpErr.message);
        }
      }
      
      if (!selected.length) {
        // Initialize a deterministic selection: first TARGET_COUNT by satnum ascending
        const uniqueBySatnum = new Map();
        for (const item of available) {
          if (!uniqueBySatnum.has(item.satnum)) uniqueBySatnum.set(item.satnum, item);
          if (uniqueBySatnum.size >= TARGET_COUNT) break;
        }
        selected = Array.from(uniqueBySatnum.values())
          .sort((a, b) => a.satnum - b.satnum)
          .slice(0, TARGET_COUNT)
          .map((rec, idx) => ({ index: idx + 1, satnum: rec.satnum, tle1: rec.tle1, tle2: rec.tle2, selectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      }

      if (selected.length) {
        // Persist the stable selection and a convenience TLE_first_50.json reflecting the selection only (may contain up to TARGET_COUNT entries)
        fs.writeFile(selectionPath, JSON.stringify(selected, null, 2), 'utf8', (err) => {
          if (err) console.error('Failed to write Selected_satellites.json:', err.message);
        });
        const tlePairs = selected.map(s => ({ tle1: s.tle1, tle2: s.tle2 }));
        fs.writeFile('TLE_first_50.json', JSON.stringify(tlePairs.slice(0, TARGET_COUNT), null, 2), 'utf8', (err) => {
          if (err) console.error('Failed to write TLE_first_50.json:', err.message);
        });
        console.log(`Persistent selection active: ${selected.length} satellites (target ${TARGET_COUNT})`);
      } else {
        console.warn('No TLE pairs available to persist selection.');
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
        tlePairsForCalc = dataArray.slice(0, TARGET_COUNT).map(item => ({
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

        console.log(`Computing positions for up to ${TARGET_COUNT} TLE pairs...`);
        tlePairsForCalc.slice(0, TARGET_COUNT).forEach((pair, idx) => {
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

            // derive satnum from TLE line 1
            const match = /^1\s+(\d{5})/.exec((pair.tle1 || '').trim());
            const satnum = match ? parseInt(match[1], 10) : undefined;

            results.push({
              index: idx + 1,
              satnum,
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

        // Persist computed positions to a file for reference (still using legacy filename)
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

// Endpoint to serve Google Maps API key securely (used by client-side to dynamically load Maps)
app.get('/api/maps/key', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }
  res.json({ key: apiKey });
});

// Endpoint to serve latest computed satellite positions (up to TARGET_COUNT)
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
          const positions = data.map(p => {
            // derive satnum if missing
            let satnum = p.satnum;
            if (!satnum && p.tle1) {
              const m = /^1\s+(\d{5})/.exec(String(p.tle1).trim());
              satnum = m ? parseInt(m[1], 10) : undefined;
            }
            return ({
              index: p.index,
              satnum,
              lat: p.latitude,
              lng: p.longitude,
              altitude: p.altitude,
              tle1: p.tle1,
              tle2: p.tle2
            });
          }).filter(p => isFinite(p.lat) && isFinite(p.lng));
          return res.json({ positions });
        }
      } catch (e) {
        console.warn('Could not parse existing TLE_positions_first_50.json, will attempt to (re)compute:', e.message);
      }
    }

    // Prefer computing from persistent Selected_satellites.json
    const selectionPath = path.join(__dirname, 'Selected_satellites.json');
    let tlePairs = [];
    if (fs.existsSync(selectionPath)) {
      try {
        const content = fs.readFileSync(selectionPath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          tlePairs = parsed.slice(0, TARGET_COUNT).map(s => ({ tle1: s.tle1, tle2: s.tle2 }));
        }
      } catch (e) {
        console.warn('Failed to read/parse Selected_satellites.json, will try TLE_first_50.json fallback:', e.message);
      }
    }

    // Fallback to legacy TLE_first_50.json if selection file not available
    if (!tlePairs.length) {
      const tlePath = path.join(__dirname, 'TLE_first_50.json');
      if (fs.existsSync(tlePath)) {
        try {
          const content = fs.readFileSync(tlePath, 'utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            tlePairs = parsed.slice(0, TARGET_COUNT);
          }
        } catch (e) {
          console.warn('Failed to read/parse TLE_first_50.json:', e.message);
        }
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
      satnum: p.satnum,
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

