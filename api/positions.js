import axios from 'axios';
import satellite from 'satellite.js';

const TARGET_COUNT = 50;

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

    if (hasUserLoc) {
      // Fetch from keeptrack API
      try {
        const apiResp = await axios.get('https://api.keeptrack.space/v2/sats', {
          params: { lat, lon, alt: 0 },
          timeout: 10000,
        });
        
        // Process the response similar to the original server code
        const now = new Date();
        const gmst = satellite.gstime(now);
        const positions = [];
        
        // Process the first TARGET_COUNT satellites
        const data = Array.isArray(apiResp.data) ? apiResp.data : (apiResp.data.sats || apiResp.data.satellites || []);
        
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(200).json({ positions: [] });
        }

        for (let i = 0; i < Math.min(data.length, TARGET_COUNT); i++) {
          const sat = data[i];
          if (!sat || !sat.tle1 || !sat.tle2) continue;
          
          try {
            const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
            if (!satrec) continue;

            const pv = satellite.propagate(
              satrec,
              now.getUTCFullYear(),
              now.getUTCMonth() + 1,
              now.getUTCDate(),
              now.getUTCHours(),
              now.getUTCMinutes(),
              now.getUTCSeconds()
            );

            if (!pv || !pv.position) continue;

            const positionGD = satellite.eciToGeodetic(pv.position, gmst);
            if (!positionGD) continue;

            const longitude = satellite.degreesLong(positionGD.longitude);
            const latitude = satellite.degreesLat(positionGD.latitude);
            const altitude = positionGD.height * 1000; // meters

            positions.push({
              index: i + 1,
              satnum: sat.satnum,
              name: sat.name,
              country: sat.country || sat.cc,
              launch: sat.launch || sat.launch_date || sat.launchDate,
              lat: latitude,
              lng: longitude,
              altitude,
              tle1: sat.tle1,
              tle2: sat.tle2
            });
          } catch (err) {
            console.error('Error processing satellite:', err);
            continue;
          }
        }

        return res.status(200).json({ positions });
      } catch (error) {
        console.error('Error fetching from keeptrack:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch satellite data',
          message: error.message || 'Unknown error'
        });
      }
    }

    // If no user location provided, return empty set
    return res.status(200).json({ positions: [] });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    });
  }
}