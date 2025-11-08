// Test commit for app.js
// Configuration
const UPDATE_INTERVAL = 30000; // 30 seconds
const OVERHEAD_THRESHOLD = 500000; // 500 km in meters

// Global variables
let map;
let userMarker;
let satelliteMarkers = new Map(); // key: sat id (satnum preferred), value: { marker, data }
let selectedSatId = null; // persist which satellite is selected across refreshes
const lastSamples = new Map(); // satId -> { lat, lng, timeMs, altitudeKm }
let userLocation = null;
let updateInterval = null;
let isTracking = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Show instructions modal
    showInstructions();
    
    // Setup event listeners
    setupEventListeners();
    
    try {
        // Fetch Google Maps API key from server
        const response = await fetch('/api/maps/key');
        console.log(response);
        if (!response.ok) {
            throw new Error('Failed to fetch Google Maps API key');
        }
        const data = await response.json();
        
        // Load Google Maps API dynamically
        await loadGoogleMapsAPI(data.key);
        
        // Initialize map
        initMap();
    } catch (error) {
        console.error('Error loading Google Maps:', error);
        updateStatus('Error: Failed to load Google Maps. Please try again later.');
    }
});

// Function to load Google Maps API dynamically
function loadGoogleMapsAPI(apiKey) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onerror = () => reject(new Error('Failed to load Google Maps API'));
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
}

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
                refreshBtn.disabled = true;
                let timeLeft = 30;
                const originalText = refreshBtn.textContent;
                
                const timer = setInterval(() => {
                    refreshBtn.textContent = `Wait ${timeLeft}s`;
                    timeLeft--;
                    if (timeLeft < 0) {
                        clearInterval(timer);
                        refreshBtn.disabled = false;
                        refreshBtn.textContent = originalText;
                    }
                }, 1000);

                fetchPositions();
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

    // Mobile: toggle sidebar visibility so users can scroll and view the map
    const toggleBtn = document.getElementById('togglePanelBtn');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = sidebar.classList.toggle('hidden');
            // Update button icon
            toggleBtn.textContent = isHidden ? '☰' : '✕';
            // If hiding the sidebar, also cleanup any open satellite details
            if (isHidden) {
                try { closeSatelliteDetails(); } catch (e) { /* ignore */ }
            }
        });
    }

    // Close satellite details panel (mobile)
    const closeSatBtn = document.getElementById('closeSatInfo');
    if (closeSatBtn) {
        closeSatBtn.addEventListener('click', () => {
            closeSatelliteDetails();
        });
    }
}

function showInstructions() {
    const modal = document.getElementById('instructionsModal');
    if (modal) {
        // Use flex to keep the modal centered (the modal element uses flex centering)
        modal.style.display = 'flex';
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
    
    // Fetch positions immediately
    fetchPositions();
    
    // Set up auto-refresh
    updateInterval = setInterval(() => {
        if (userLocation) {
            fetchPositions();
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
            // const sampleSatellites = tleData.slice(0, 50).map((sat, index) => {
            //     // Simplified position calculation (not accurate, but demonstrates the concept)
            //     const time = Date.now() / 1000;
            //     const orbitPeriod = 90 * 60; // 90 minutes in seconds
            //     const phase = (time % orbitPeriod) / orbitPeriod * 2 * Math.PI;
                
            //     // Approximate position (this is simplified - real calculation needs proper TLE parsing)
            //     const lat = location.lat + (Math.sin(phase + index) * 30);
            //     const lng = location.lng + (Math.cos(phase + index) * 30);
                
            //     return {
            //         name: sat.name || `Satellite ${index + 1}`,
            //         lat: lat,
            //         lng: lng,
            //         altitude: 400 + (index % 10) * 50 // Approximate altitude in km
            //     };
            // });

            const sampleSatellites = [];
            tleData.forEach(sat => {
                // Use fixed offset from user location (30 degrees is arbitrary)
                const lat = location.lat + (Math.random() * 60 - 30);
                const lng = location.lng + (Math.random() * 60 - 30);
                
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(location.lat, location.lng),
                    new google.maps.LatLng(lat, lng)
                );

                const satellite = {
                    name: sat.name || 'Unknown Satellite',
                    lat: lat,
                    lng: lng,
                    altitude: 400,
                    distance: distance
                };

                if (sampleSatellites.length < 50) {
                    sampleSatellites.push(satellite);
                } else {
                    const maxDistSat = sampleSatellites.reduce((max, curr) => 
                        curr.distance > max.distance ? curr : max
                    );
                    if (distance < maxDistSat.distance) {
                        sampleSatellites.splice(sampleSatellites.indexOf(maxDistSat), 1);
                        sampleSatellites.push(satellite);
                    }
                }
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

    // Build a set of incoming satellite IDs for reconciliation
    const incomingIds = new Set();

    // Helper to update the side panel
    const panel = {
        container: document.getElementById('satelliteInfo'),
        name: document.getElementById('satelliteName'),
        altitude: document.getElementById('satelliteAltitude'),
        velocity: document.getElementById('satelliteVelocity'),
        country: document.getElementById('satelliteCountry'),
        distance: document.getElementById('satelliteDistance'),
        launch: document.getElementById('satelliteLaunch')
    };

    const showPanel = (sat) => {
        if (!panel.container) return;
        panel.container.classList.remove('hidden');
        if (panel.name) panel.name.textContent = sat.name || (sat.satnum ? `SAT ${sat.satnum}` : 'Satellite');
        if (panel.altitude) panel.altitude.textContent = typeof sat.altitude === 'number' ? sat.altitude.toFixed(2) : 'N/A';
        if (panel.country) {
            const cc = (sat.country || '').toString().trim();
            const full = cc ? countryCodeToName(cc) : '';
            panel.country.textContent = cc ? (full || cc) : 'N/A';
        }
        if (panel.distance) {
            sat.distance = sat.distance / 1000; // store for future reference
            if (typeof sat.distance === 'number') {
                panel.distance.textContent = sat.distance.toFixed(2);
            } else {
                // Compute distance if not provided
                const dKm = haversineKm(userLocation.lat, userLocation.lng, sat.lat, sat.lng)/1000;
                panel.distance.textContent = dKm.toFixed(2);
            }
        }   
        if (panel.launch) panel.launch.textContent = sat.launch || 'N/A';
        if (panel.velocity) {
            // compute approximate velocity from consecutive samples
            const last = lastSamples.get(String(sat.id));
            const nowMs = Date.now();
            let vel = null;
            if (last && isFinite(last.lat) && isFinite(last.lng) && last.timeMs) {
                const dKm = haversineKm(last.lat, last.lng, sat.lat, sat.lng);
                const dt = (nowMs - last.timeMs) / 1000; // seconds
                if (dt > 0) vel = dKm / dt; // km/s
            }
            panel.velocity.textContent = (vel && isFinite(vel)) ? vel.toFixed(3) : 'N/A';
            // store current sample
            lastSamples.set(String(sat.id), { lat: sat.lat, lng: sat.lng, timeMs: nowMs, altitudeKm: sat.altitude });
        }
        // Initialize 3D viewer for this satellite (clean previous and init after panel is visible)
        try {
            if (typeof window.cleanupThreeJS === 'function') {
                window.cleanupThreeJS();
            }
        } catch (e) {
            console.warn('cleanupThreeJS failed:', e);
        }
        // Defer init to allow DOM to paint and size the container
        setTimeout(() => {
            try {
                if (typeof window.initThreeJS === 'function') window.initThreeJS();
            } catch (e) {
                console.warn('initThreeJS failed:', e);
            }
        }, 200);
    };

    satellites.forEach((satellite, idx) => {
        // Extract position
        const lat = satellite.lat || satellite.latitude;
        const lng = satellite.lng || satellite.longitude || satellite.long;
        if (lat === undefined || lng === undefined) return;

        const satPosition = { lat: parseFloat(lat), lng: parseFloat(lng) };

        // Compute a stable id for this satellite
        const satId = satellite.satnum ?? satellite.id ?? satellite.name ?? `${satPosition.lat.toFixed(4)},${satPosition.lng.toFixed(4)}`;
        satellite.id = satId; // ensure id stored for velocity tracking
        incomingIds.add(String(satId));

        const satelliteIcon = {
            url: "./models/red-satellite.png", // relative path from where your HTML is served
            scaledSize: new google.maps.Size(32, 32), // adjust for your desired size
            anchor: new google.maps.Point(16, 16), // centers the icon
        };


        // Update existing marker or create a new one
        const existing = satelliteMarkers.get(String(satId));
        if (existing && existing.marker) {
            existing.marker.setPosition(satPosition);
            existing.data = satellite;
        } else {
            const marker = new google.maps.Marker({
                position: satPosition,
                map: map,
                title: satellite.name || `Satellite ${idx + 1}`,
                icon: satelliteIcon
            });

            // Click selects satellite and updates side panel (no popup cards)
            marker.addListener('click', () => {
                selectedSatId = String(satId);
                showPanel({ ...satellite, lat: satPosition.lat, lng: satPosition.lng, id: satId });
            });

            satelliteMarkers.set(String(satId), { marker, data: satellite });
        }

        // If this satellite is currently selected, update the panel with its latest data
        if (selectedSatId && String(satId) === String(selectedSatId)) {
            showPanel({ ...satellite, lat: satPosition.lat, lng: satPosition.lng, id: satId });
        }

        // Check if satellite is overhead
        if (google.maps.geometry && google.maps.geometry.spherical) {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(userLocation.lat, userLocation.lng),
                new google.maps.LatLng(satPosition.lat, satPosition.lng)
            );

            const latDiff = Math.abs(userLocation.lat - satPosition.lat);
            const lngDiff = Math.abs(userLocation.lng - satPosition.lng);
            if (distance < OVERHEAD_THRESHOLD && latDiff < 5 && lngDiff < 5) {
                overheadCount++;
            }
        }
    });

    // Remove markers that are no longer present
    for (const [id, entry] of satelliteMarkers.entries()) {
        if (!incomingIds.has(id)) {
            entry.marker.setMap(null);
            satelliteMarkers.delete(id);
            // Keep selection; we don't clear the panel to avoid flicker, but note that the selected sat might be out of range now
        }
    }

    // Update satellite count using the Map size
    const countEl = document.getElementById('satelliteCount');
    if (countEl) countEl.textContent = satelliteMarkers.size;

    // Show/hide overhead notification
    if (overheadCount > 0) {
        showNotification(overheadCount);
    } else {
        hideNotification();
    }
}

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Convert country code (ISO-2 or common ISO-3) to full country name
function countryCodeToName(cc) {
    if (!cc) return '';
    let code = String(cc).trim().toUpperCase();
    const iso3to2 = {
        USA: 'US', RUS: 'RU', CHN: 'CN', PRC: 'CN', GBR: 'GB', UK: 'GB',
        JPN: 'JP', IND: 'IN', DEU: 'DE', GER: 'DE', FRA: 'FR', ESP: 'ES', ITA: 'IT',
        CAN: 'CA', BRA: 'BR', AUS: 'AU', KOR: 'KR', PRK: 'KP', ISR: 'IL',
        IRN: 'IR', SAU: 'SA', ARE: 'AE', UAE: 'AE', MEX: 'MX', ARG: 'AR',
        ZAF: 'ZA', CHL: 'CL', SWE: 'SE', NOR: 'NO', FIN: 'FI', POL: 'PL',
        NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', CZE: 'CZ', SVK: 'SK',
        PRT: 'PT', GRC: 'GR', TUR: 'TR', EGY: 'EG', ZWE: 'ZW', NGA: 'NG',
        IDN: 'ID', MYS: 'MY', PAK: 'PK', BGD: 'BD', VNM: 'VN', THA: 'TH',
        PHL: 'PH', SGP: 'SG', NZL: 'NZ', IRL: 'IE', SCO: 'GB', ENG: 'GB',
        WAL: 'GB', NIR: 'GB', KAZ: 'KZ', UKR: 'UA', BLR: 'BY', ROM: 'RO',
        HUN: 'HU'
    };
    if (code.length === 3 && iso3to2[code]) code = iso3to2[code];
    const names = {
        AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola', AR: 'Argentina',
        AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan',
        BD: 'Bangladesh', BY: 'Belarus', BE: 'Belgium', BJ: 'Benin', BO: 'Bolivia',
        BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', BG: 'Bulgaria',
        KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CL: 'Chile', CN: 'China',
        CO: 'Colombia', CR: 'Costa Rica', HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus',
        CZ: 'Czechia', DK: 'Denmark', DO: 'Dominican Republic', EC: 'Ecuador',
        EG: 'Egypt', SV: 'El Salvador', EE: 'Estonia', ET: 'Ethiopia', FI: 'Finland',
        FR: 'France', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece',
        GT: 'Guatemala', HN: 'Honduras', HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland',
        IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland',
        IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan',
        KZ: 'Kazakhstan', KE: 'Kenya', KP: 'North Korea', KR: 'South Korea',
        KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon',
        LR: 'Liberia', LY: 'Libya', LT: 'Lithuania', LU: 'Luxembourg',
        MY: 'Malaysia', ML: 'Mali', MX: 'Mexico', MD: 'Moldova', MN: 'Mongolia',
        ME: 'Montenegro', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar',
        NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria',
        MK: 'North Macedonia', NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PS: 'Palestine',
        PA: 'Panama', PY: 'Paraguay', PE: 'Peru', PH: 'Philippines', PL: 'Poland',
        PT: 'Portugal', PR: 'Puerto Rico', QA: 'Qatar', RO: 'Romania', RU: 'Russia',
        RW: 'Rwanda', SA: 'Saudi Arabia', RS: 'Serbia', SG: 'Singapore', SK: 'Slovakia',
        SI: 'Slovenia', ZA: 'South Africa', ES: 'Spain', LK: 'Sri Lanka', SE: 'Sweden',
        CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania',
        TH: 'Thailand', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan', UA: 'Ukraine',
        AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States', UY: 'Uruguay',
        UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe'
    };
    return names[code] || '';
}

function clearSatelliteMarkers() {
    if (satelliteMarkers instanceof Map) {
        for (const [, entry] of satelliteMarkers.entries()) {
            if (entry && entry.marker) entry.marker.setMap(null);
        }
        satelliteMarkers.clear();
    } else if (Array.isArray(satelliteMarkers)) {
        satelliteMarkers.forEach(marker => marker.setMap(null));
        satelliteMarkers = [];
    }
}

function showNotification(count) {
    const notification = document.getElementById('notification');
    const text = document.querySelector('.notification-text');
    if (notification && text) {
        text.textContent = count === 1 
            ? 'A satellite is currently flying over your location!'
            : `${count} satellites are currently flying over your location!`;

        // Decide placement: on mobile use fixed bottom center in the viewport; on larger screens place over map area
        const mapEl = document.getElementById('map');
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            if (notification.parentNode !== document.body) {
                document.body.appendChild(notification);
            }
            notification.classList.add('map-position-mobile');
            notification.classList.remove('map-position');
        } else {
            if (mapEl && notification.parentNode !== mapEl) {
                mapEl.appendChild(notification);
            }
            notification.classList.add('map-position');
            notification.classList.remove('map-position-mobile');
        }

        // Show with animation
        notification.classList.remove('hidden');
        // Force reflow to restart animation if needed
        // eslint-disable-next-line no-unused-expressions
        void notification.offsetWidth;
        notification.classList.add('show');
    }
}

function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        // Remove animation class to trigger hide animation, then hide after duration
        notification.classList.remove('show');
        setTimeout(() => {
            notification.classList.add('hidden');
            // Clean up placement classes and move notification back to body to restore original placement
            try {
                if (notification.classList.contains('map-position-mobile')) {
                    notification.classList.remove('map-position-mobile');
                }
                if (notification.classList.contains('map-position')) {
                    notification.classList.remove('map-position');
                }
                if (notification.parentNode && notification.parentNode.id === 'map') {
                    document.body.appendChild(notification);
                }
            } catch (e) { /* ignore */ }
        }, 350);
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

function closeSatelliteDetails() {
    try {
        const panel = document.getElementById('satelliteInfo');
        if (panel) panel.classList.add('hidden');
        selectedSatId = null;
        if (typeof window.cleanupThreeJS === 'function') window.cleanupThreeJS();
    } catch (e) {
        console.warn('Error closing satellite details:', e);
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



// Fetch precomputed satellite positions from the server and render markers
async function fetchPositions() {
    try {
        updateStatus('Fetching satellite positions...');
        // Prime backend data by hitting /api/satellites to (re)generate TLE files
        if (userLocation) {
            try {
                await fetch(`/api/satellites?lat=${userLocation.lat}&lon=${userLocation.lng}`);
            } catch (e) {
                // non-fatal
                console.warn('Priming /api/satellites failed (continuing):', e);
            }
        }
        const positionsUrl = userLocation ? `/api/positions?lat=${userLocation.lat}&lon=${userLocation.lng}` : '/api/positions';
        const resp = await fetch(positionsUrl);
        const json = await resp.json();
        if (!resp.ok) {
            throw new Error(json.error || 'Failed to fetch positions');
        }

        // Normalize response
        let positions = [];
        if (Array.isArray(json)) {
            positions = json;
        } else if (Array.isArray(json.positions)) {
            positions = json.positions;
        }

        // Map to the shape expected by displaySatellites(); include stable id
        const satellites = positions
            .filter(p => isFinite(p.lat) && isFinite(p.lng))
            .map((p, idx) => ({
                id: p.satnum ?? p.index ?? (p.tle1 ? (String(p.tle1).slice(2,7)) : idx + 1),
                name: p.name || `Satellite ${p.index ?? (idx + 1)}`,
                country: p.country,
                launch: p.launch,
                distance: p.distance,
                lat: parseFloat(p.lat),
                lng: parseFloat(p.lng),
                // Backend altitude is meters; convert to km for display
                altitude: typeof p.altitude === 'number' ? (p.altitude / 1000) : undefined,
                satnum: p.satnum,
                tle1: p.tle1,
                tle2: p.tle2
            }));

        if (satellites.length > 0) {
            displaySatellites(satellites, userLocation);
            updateStatus(`Tracking ${satellites.length} satellites`);
        } else {
            updateStatus('No satellite positions available yet.');
        }

        updateLastUpdate();
    } catch (err) {
        console.error('Error fetching positions:', err);
        updateStatus('Error: ' + err.message);
    }
}
