import axios from 'axios';

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

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Fetch satellite data from keeptrack.space API
    const response = await axios.get('https://api.keeptrack.space/v2/sats', {
      params: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        alt: 0
      },
      timeout: 10000
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching satellite data:', error);
    return res.status(500).json({
      error: 'Failed to fetch satellite data',
      message: error.message || 'Unknown error'
    });
  }
}