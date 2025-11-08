import axios from 'axios';
import satellite from 'satellite.js';

const TARGET_COUNT = 30; // Reduced from 50 to prevent timeouts

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lat, lon } = req.query;
    const hasUserLoc = Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lon));

    if (!hasUserLoc) {
      return res.status(200).json({ positions: [] });
    }

    // Fetch from keeptrack API
    let apiResp;
    try {
      apiResp = await axios.get('https://api.keeptrack.space/v2/sats', {
        params: { lat: parseFloat(lat), lon: parseFloat(lon), alt: 0 },
        timeout: 8000, // Reduced timeout
      });
    } catch (error) {
      console.error('Error fetching from keeptrack:', error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch satellite data',
        message: error.message || 'External API error'
      });
    }

    if (!apiResp || !apiResp.data) {
      return res.status(200).json({ positions: [] });
    }

    // Process the response
    const now = new Date();
    let gmst;
    try {
      gmst = satellite.gstime(now);
    } catch (err) {
      console.error('Error calculating GMST:', err.message);
      return res.status(500).json({ 
        error: 'Failed to calculate satellite positions',
        message: 'Time calculation error'
      });
    }

    const positions = [];
    
    // Extract data array
    let data = [];
    if (Array.isArray(apiResp.data)) {
      data = apiResp.data;
    } else if (apiResp.data && typeof apiResp.data === 'object') {
      data = apiResp.data.sats || apiResp.data.satellites || apiResp.data.data || [];
    }
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ positions: [] });
    }

    // Process satellites with better error handling
    const maxProcess = Math.min(data.length, TARGET_COUNT);
    for (let i = 0; i < maxProcess; i++) {
      const sat = data[i];
      if (!sat || typeof sat !== 'object') continue;
      if (!sat.tle1 || !sat.tle2 || typeof sat.tle1 !== 'string' || typeof sat.tle2 !== 'string') {
        continue;
      }
      
      try {
        // Parse TLE
        let satrec;
        try {
          satrec = satellite.twoline2satrec(sat.tle1.trim(), sat.tle2.trim());
        } catch (tleErr) {
          console.error(`Invalid TLE for satellite ${i}:`, tleErr.message);
          continue;
        }

        if (!satrec) continue;

        // Propagate position
        let pv;
        try {
          pv = satellite.propagate(
            satrec,
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
          );
        } catch (propErr) {
          console.error(`Propagation error for satellite ${i}:`, propErr.message);
          continue;
        }

        if (!pv || !pv.position) continue;

        // Convert to geodetic
        let positionGD;
        try {
          positionGD = satellite.eciToGeodetic(pv.position, gmst);
        } catch (geoErr) {
          console.error(`Geodetic conversion error for satellite ${i}:`, geoErr.message);
          continue;
        }

        if (!positionGD) continue;

        // Extract coordinates
        let longitude, latitude, altitude;
        try {
          longitude = satellite.degreesLong(positionGD.longitude);
          latitude = satellite.degreesLat(positionGD.latitude);
          altitude = (positionGD.height || 0) * 1000; // meters
        } catch (coordErr) {
          console.error(`Coordinate conversion error for satellite ${i}:`, coordErr.message);
          continue;
        }

        // Validate coordinates
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(altitude)) {
          continue;
        }

        positions.push({
          index: positions.length + 1,
          satnum: sat.satnum || null,
          name: sat.name || `Satellite ${positions.length + 1}`,
          country: sat.country || sat.cc || null,
          launch: sat.launch || sat.launch_date || sat.launchDate || null,
          lat: latitude,
          lng: longitude,
          altitude: altitude,
          tle1: sat.tle1,
          tle2: sat.tle2
        });
      } catch (err) {
        console.error(`Error processing satellite ${i}:`, err.message);
        continue;
      }
    }

    return res.status(200).json({ positions });
  } catch (error) {
    console.error('Unexpected API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  }
}