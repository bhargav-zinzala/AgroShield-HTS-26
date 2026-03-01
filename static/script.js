// ==========================================
// 1. LOGIN & REGISTRATION LOGIC (index.html)
// ==========================================

async function sendOTP() {
    const mobileInput = document.getElementById('mobile-number').value;
    
    if (mobileInput.length < 10) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }

    try {
        // Send the phone number to our Python backend
        const response = await fetch('http://127.0.0.1:5000/api/send_otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: mobileInput })
        });

        const data = await response.json();

        if (data.success) {
            // Hide phone input, show OTP input
            document.getElementById('phone-section').style.display = 'none';
            document.getElementById('otp-section').style.display = 'block';
        }
    } catch (error) {
        console.error("Error connecting to server:", error);
        alert("Make sure your Python server is running!");
    }
}

async function verifyOTP() {
    const mobileInput = document.getElementById('mobile-number').value;
    const otpInput = document.getElementById('otp-input').value;
    const errorMessage = document.getElementById('error-message');

    try {
        // Notice we changed the URL to just '/api/verify_otp'
        const response = await fetch('/api/verify_otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: mobileInput, otp: otpInput })
        });

        const data = await response.json();

        if (data.success) {
            // Save the user in browser memory
            localStorage.setItem('agroshield_user', mobileInput);
            alert(data.message); 
            
            // THE SMART ROUTING FIX: 
            if (data.status === 'login') {
                // Returning user -> Skip farm setup, go straight to Dashboard
                window.location.href = "/dashboard"; 
            } else if (data.status === 'register') {
                // New user -> Go to Farm Setup
                window.location.href = "/add_farm"; 
            }
            
        } else {
            errorMessage.innerText = data.message;
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

function goBack() {
    document.getElementById('otp-section').style.display = 'none';
    document.getElementById('phone-section').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
}


// ==========================================
// 2. MAP & FARM SETUP LOGIC (add_farm.html)
// ==========================================

let farmCoordinates = []; 
let map = null;
let drawnItems = null;

// Only run map code if we are actually on the add_farm.html page
if (document.getElementById('farm-map')) {
    
    // Check if user is logged in
    const currentUser = localStorage.getItem('agroshield_user');
    if (!currentUser) {
        alert("You must login first!");
        window.location.href = "index.html";
    }

    map = L.map('farm-map').setView([23.2156, 72.6369], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        draw: { polygon: true, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false },
        edit: { featureGroup: drawnItems }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
        clearAllPoints(); 
        const layer = event.layer;
        drawnItems.addLayer(layer);

        const geoJson = layer.toGeoJSON();
        farmCoordinates = geoJson.geometry.coordinates[0]; 
        
        updateStatus(`Polygon Drawn! Points: ${farmCoordinates.length}`);
    });
}

function addManualPoint() {
    const lat = parseFloat(document.getElementById('lat-input').value);
    const lng = parseFloat(document.getElementById('lng-input').value);

    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coordinates.");

    farmCoordinates.push([lng, lat]);
    
    const list = document.getElementById('point-list');
    const li = document.createElement('li');
    li.innerText = `Point ${farmCoordinates.length}: ${lat}, ${lng}`;
    list.appendChild(li);

    document.getElementById('lat-input').value = '';
    document.getElementById('lng-input').value = '';

    redrawManualPolygon();
}

function removeLastPoint() {
    if (farmCoordinates.length > 0) {
        farmCoordinates.pop();
        document.getElementById('point-list').lastElementChild.remove();
        redrawManualPolygon();
    }
}

function clearAllPoints() {
    farmCoordinates = [];
    document.getElementById('point-list').innerHTML = '';
    if (drawnItems) drawnItems.clearLayers();
    updateStatus("Map cleared.");
}

function redrawManualPolygon() {
    drawnItems.clearLayers();
    if (farmCoordinates.length > 0) {
        const displayCoords = farmCoordinates.map(c => [c[1], c[0]]);
        displayCoords.forEach(c => L.marker(c).addTo(drawnItems));

        if (displayCoords.length >= 3) {
            const polygon = L.polygon(displayCoords, {color: '#4caf50'}).addTo(drawnItems);
            map.fitBounds(polygon.getBounds());
            updateStatus("Manual Polygon Created");
        } else {
            updateStatus(`Points added: ${displayCoords.length} (Need 3)`);
        }
    }
}

function updateStatus(msg) {
    document.getElementById('map-status').innerText = msg;
}

// --- SEND FARM DATA TO MONGODB ---
async function saveFarmDetails() {
    const plantingDate = document.getElementById('planting-date').value;
    const soilType = document.getElementById('soil-type').value;
    const currentUser = localStorage.getItem('agroshield_user');

    if (farmCoordinates.length < 3) return alert("Farm needs at least 3 points.");
    if (!plantingDate || !soilType) return alert("Fill in date and soil type.");

    // Package the data to send to Python
    const farmData = {
        mobile: currentUser,
        coordinates: farmCoordinates,
        crop: "Tomato",
        planting_date: plantingDate,
        soil_type: soilType
    };

    try {
        // Send to Python backend
        const response = await fetch('http://127.0.0.1:5000/api/save_farm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(farmData)
        });

        const data = await response.json();

        if (data.success) {
            alert("Farm Details Saved Successfully!");
            // window.location.href = "dashboard.html"; // Coming soon!
        } else {
            alert("Error: " + data.message);
        }
    } catch (error) {
        console.error("Error saving farm:", error);
        alert("Failed to connect to the server.");
    }
}
function logout() {
    localStorage.removeItem('agroshield_user');
    window.location.href = "/";
}


// ==========================================
// 3. DASHBOARD LOGIC (dashboard.html)
// ==========================================

async function loadDashboardData() {
    const currentUser = localStorage.getItem('agroshield_user');
    
    // If they aren't logged in, kick them back to the login page
    if (!currentUser) {
        window.location.href = "/";
        return;
    }

    try {
        // Ask Python for this user's data
        const response = await fetch('/api/get_user_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: currentUser })
        });

        const result = await response.json();

        if (result.success && result.data.farm_details) {
            const farm = result.data.farm_details;
            
            // Inject the real data into the HTML!
            document.getElementById('user-phone').innerText = currentUser;
            document.getElementById('dash-crop').innerText = farm.crop;
            document.getElementById('dash-date').innerText = farm.planting_date;
            document.getElementById('dash-soil').innerText = farm.soil_type;
        } else if (result.success && !result.data.farm_details) {
            // If they registered but somehow skipped the map page
            window.location.href = "/add_farm";
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// Automatically run this function ONLY if we are on the dashboard page
if (document.querySelector('.dashboard-body')) {
    loadDashboardData();
}