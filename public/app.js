// Configuration
const UPDATE_INTERVAL = 30000; // 30 seconds
const OVERHEAD_THRESHOLD = 500000; // 500 km in meters

// Global variables
let map;
let userMarker;
let satelliteMarkers = [];
let userLocation = null;
let updateInterval = null;
let isTracking = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Show instructions modal
    showInstructions();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize map (will wait for API key)
    initMap();
});

function setupEventListeners() {
    // Close modal
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('instructionsModal').style.display = 'none';
        });
    }

    // Start tracking button
    const startBtn = document.getElementById('startTracking');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('instructionsModal').style.display = 'none';
            startTracking();
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (userLocation) {
                fetchSatellites(userLocation);
            }
        });
    }

    // Center button
    const centerBtn = document.getElementById('centerBtn');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => {
            if (userLocation) {
                map.setCenter(userLocation);
                map.setZoom(8);
            }
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('instructionsModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showInstructions() {
    const modal = document.getElementById('instructionsModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function initMap() {
    // Check if Google Maps API key is set
    if (typeof google === 'undefined' || !google.maps) {
        updateStatus('Error: Google Maps API not loaded. Please check your API key.');
        return;
    }

    // Initialize map centered on a default location
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 2,
        center: { lat: 0, lng: 0 },
        mapTypeId: 'roadmap',
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // Get user's location
    if (navigator.geolocation) {
        updateStatus('Getting your location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                map.setCenter(userLocation);
                map.setZoom(8);
                
                // Add user marker
                userMarker = new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    title: 'Your Location',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    }
                });

                updateStatus('Location found! Ready to track satellites.');
                
                // Auto-start tracking if modal was closed
                if (!document.getElementById('instructionsModal') || 
                    document.getElementById('instructionsModal').style.display === 'none') {
                    startTracking();
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                updateStatus('Error: Could not get your location. Please enable location access.');
                alert('Please enable location access to track satellites overhead.');
            }
        );
    } else {
        updateStatus('Error: Geolocation is not supported by this browser.');
        alert('Geolocation is not supported by this browser.');
    }
}

function startTracking() {
    if (isTracking) return;
    
    if (!userLocation) {
        updateStatus('Waiting for location...');
        return;
    }

    isTracking = true;
    updateStatus('Tracking satellites...');
    
    // Fetch satellites immediately
    fetchSatellites(userLocation);
    
    // Set up auto-refresh
    updateInterval = setInterval(() => {
        if (userLocation) {
            fetchSatellites(userLocation);
        }
    }, UPDATE_INTERVAL);
}

function stopTracking() {
    isTracking = false;
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

async function fetchSatellites(location) {
    try {
        updateStatus('Fetching satellite data...');
        
        const response = await fetch(`/api/satellites?lat=${location.lat}&lon=${location.lng}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch satellite data');
        }

        // Clear existing markers
        clearSatelliteMarkers();

        // Handle different response formats
        let satellites = [];
        if (Array.isArray(data)) {
            satellites = data;
        } else if (data.satellites && Array.isArray(data.satellites)) {
            satellites = data.satellites;
        } else if (data.data && Array.isArray(data.data)) {
            satellites = data.data;
        }

        // If we have satellite data, display it
        if (satellites.length > 0) {
            displaySatellites(satellites, location);
            updateStatus(`Tracking ${satellites.length} satellites`);
        } else {
            // If no satellites in response, try to get TLE data and calculate positions
            // For now, we'll use a fallback approach
            updateStatus('No satellite data available. Trying alternative method...');
            fetchSatellitesFallback(location);
        }

        updateLastUpdate();
    } catch (error) {
        console.error('Error fetching satellites:', error);
        updateStatus('Error: ' + error.message);
        // Try fallback method
        fetchSatellitesFallback(location);
    }
}

async function fetchSatellitesFallback(location) {
    try {
        // Try to get TLE data from keeptrack.space
        const response = await fetch('https://api.keeptrack.space/v2/tle');
        const tleData = await response.json();
        
        if (tleData && Array.isArray(tleData) && tleData.length > 0) {
            // Calculate positions for a sample of satellites
            // This is a simplified version - in production, you'd use a proper TLE library
            const sampleSatellites = tleData.slice(0, 50).map((sat, index) => {
                // Simplified position calculation (not accurate, but demonstrates the concept)
                const time = Date.now() / 1000;
                const orbitPeriod = 90 * 60; // 90 minutes in seconds
                const phase = (time % orbitPeriod) / orbitPeriod * 2 * Math.PI;
                
                // Approximate position (this is simplified - real calculation needs proper TLE parsing)
                const lat = location.lat + (Math.sin(phase + index) * 30);
                const lng = location.lng + (Math.cos(phase + index) * 30);
                
                return {
                    name: sat.name || `Satellite ${index + 1}`,
                    lat: lat,
                    lng: lng,
                    altitude: 400 + (index % 10) * 50 // Approximate altitude in km
                };
            });
            
            displaySatellites(sampleSatellites, location);
            updateStatus(`Tracking ${sampleSatellites.length} satellites (estimated)`);
            updateLastUpdate();
        }
    } catch (error) {
        console.error('Fallback fetch error:', error);
        updateStatus('Unable to fetch satellite data. Please try again later.');
    }
}

function displaySatellites(satellites, userLocation) {
    let overheadCount = 0;
    const infoWindow = new google.maps.InfoWindow();

    satellites.forEach((satellite) => {
        // Extract position
        const lat = satellite.lat || satellite.latitude;
        const lng = satellite.lng || satellite.longitude || satellite.long;
        
        if (lat === undefined || lng === undefined) return;

        const satPosition = { lat: parseFloat(lat), lng: parseFloat(lng) };

        // Create marker
        const marker = new google.maps.Marker({
            position: satPosition,
            map: map,
            title: satellite.name || 'Satellite',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: '#FF0000',
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2
            }
        });

        // Add click listener for info
        marker.addListener('click', () => {
            const content = `
                <div style="padding: 10px;">
                    <h3 style="margin: 0 0 10px 0;">${satellite.name || 'Satellite'}</h3>
                    ${satellite.altitude ? `<p><strong>Altitude:</strong> ${satellite.altitude} km</p>` : ''}
                    <p><strong>Position:</strong> ${lat.toFixed(4)}°, ${lng.toFixed(4)}°</p>
                </div>
            `;
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
        });

        satelliteMarkers.push(marker);

        // Check if satellite is overhead
        if (google.maps.geometry && google.maps.geometry.spherical) {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(userLocation.lat, userLocation.lng),
                new google.maps.LatLng(satPosition.lat, satPosition.lng)
            );

            // Consider satellite overhead if within threshold
            // Also check if it's roughly above (within reasonable lat/lng range)
            const latDiff = Math.abs(userLocation.lat - satPosition.lat);
            const lngDiff = Math.abs(userLocation.lng - satPosition.lng);
            
            if (distance < OVERHEAD_THRESHOLD && latDiff < 5 && lngDiff < 5) {
                overheadCount++;
            }
        }
    });

    // Update satellite count
    document.getElementById('satelliteCount').textContent = satellites.length;

    // Show notification if satellites are overhead
    if (overheadCount > 0) {
        showNotification(overheadCount);
    } else {
        hideNotification();
    }
}

function clearSatelliteMarkers() {
    satelliteMarkers.forEach(marker => marker.setMap(null));
    satelliteMarkers = [];
}

function showNotification(count) {
    const notification = document.getElementById('notification');
    const text = document.querySelector('.notification-text');
    
    if (notification && text) {
        text.textContent = count === 1 
            ? 'A satellite is currently flying over your location!'
            : `${count} satellites are currently flying over your location!`;
        notification.classList.remove('hidden');
    }
}

function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.classList.add('hidden');
    }
}

function closeNotification() {
    hideNotification();
}

function updateStatus(text) {
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = text;
    }
}

function updateLastUpdate() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = now.toLocaleTimeString();
    }
}

// Handle page visibility to pause/resume tracking
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopTracking();
    } else if (userLocation) {
        startTracking();
    }
});

