import axios from 'axios';

export default async function handler(req, res) {
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

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching satellite data:', error);
    res.status(500).json({
      error: 'Failed to fetch satellite data',
      message: error.message
    });
  }
}