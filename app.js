// ═══════════════════════════════════════════════════════
// Firebase Configuration
// ═══════════════════════════════════════════════════════
const firebaseConfig = {
    apiKey: "AIzaSyBRUEGRPaIWHMlzn0lT9otbJQEYZs4Br1A",
    authDomain: "adherence-project-2026.firebaseapp.com",
    databaseURL: "https://adherence-project-2026-default-rtdb.firebaseio.com",
    projectId: "adherence-project-2026",
    storageBucket: "adherence-project-2026.firebasestorage.app",
    messagingSenderId: "222566948658",
    appId: "1:222566948658:web:85528e19dd039c199a412b",
    measurementId: "G-R5E6QX8LB1"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ═══════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════
let currentScore          = 0;
let answeredQuestions     = 0;
let userLocation          = null;
let markers               = [];
let totalAssessments      = 0;
let countriesSet          = new Set();
let userId                = null;
let countryData           = {};
let currentMapStyle       = 'globe';
let markersByLocation     = {};
let spectatorMode         = false;
let cinematicTourActive   = false;
let cinematicTourTimeout  = null;
let spectatorOverlay      = null;
let tickerItems           = [];
let tickerEl              = null;
let tickerInnerEl         = null;
let institutionCode       = null;
let institutionProfile    = null;   // { name, cohortLabel, color }
let cohortMode            = false;  // true when viewing institution-filtered data
let cohortData            = {};     // parallel to countryData but scoped to cohort
let cohortTotal           = 0;
let cohortMarkers         = [];
let cohortHighCount       = 0;

// ═══════════════════════════════════════════════════════
// Mapbox — safe to init here, container div already in HTML
// ═══════════════════════════════════════════════════════
mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 20],
    zoom: 2,
    projection: 'globe'
});

map.addControl(new mapboxgl.NavigationControl());

// Globe auto-rotation
map.on('load', () => {
    const rotationSpeed = 0.2;
    function rotateGlobe() {
        if (cinematicTourActive) return;
        if (map.getZoom() < 3) {
            const center = map.getCenter();
            center.lng  += rotationSpeed;
            if (center.lng > 180) center.lng = -180;
            map.setCenter(center);
        }
    }
    let rotationInterval;
    map.on('idle',      () => { rotationInterval = setInterval(rotateGlobe, 100); });
    map.on('movestart', () => { clearInterval(rotationInterval); });
});

// ═══════════════════════════════════════════════════════
// PUBLIC STATS AGGREGATE
// Keeps /public_stats in sync so the public website can
// display accurate totals without reading the private
// /assessments node.
// ═══════════════════════════════════════════════════════
function sanitizeCountryKey(country) {
    return (country || 'unknown').trim().replace(/[.#$\/\[\]]/g, '_') || 'unknown';
}

function updatePublicStats(score, country) {
    const s = parseFloat(score);
    if (isNaN(s)) return;
    const statsRef = database.ref('public_stats');
    statsRef.child('total').transaction(n => (n || 0) + 1);
    statsRef.child('score_sum').transaction(n => (n || 0) + s);
    if (s >= 6) statsRef.child('high_count').transaction(n => (n || 0) + 1);
    const ck = sanitizeCountryKey(country);
    if (ck && ck !== 'unknown') statsRef.child('countries/' + ck).set(true);
}

// Seed /public_stats once from /assessments if the node is missing.
// Runs automatically when the authenticated ATLAS app loads.
function seedPublicStatsIfMissing() {
    database.ref('public_stats/total').once('value', snap => {
        if (snap.val() !== null) return; // already seeded
        database.ref('assessments').once('value', snap2 => {
            const raw = snap2.val();
            if (!raw) return;
            const all = Object.values(raw);
            let total = 0, scoreSum = 0, highCount = 0;
            const countries = {};
            all.forEach(r => {
                const s = parseFloat(r.score);
                if (isNaN(s)) return;
                total++;
                scoreSum += s;
                if (s >= 6) highCount++;
                const ck = sanitizeCountryKey(r.country);
                if (ck && ck !== 'unknown') countries[ck] = true;
            });
            database.ref('public_stats').set({ total, score_sum: scoreSum, high_count: highCount, countries });
            console.log('[ATLAS] public_stats seeded:', total, 'records');
        });
    });
}
seedPublicStatsIfMissing();

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function getAdherenceCategory(score) {
    if (score === 8) return { label: 'High Adherence',   color: '#10b981', description: 'Excellent medication adherence' };
    if (score >= 6)  return { label: 'Medium Adherence', color: '#f59e0b', description: 'Moderate adherence, some improvement needed' };
    return                   { label: 'Low Adherence',   color: '#ef4444', description: 'Poor adherence, intervention recommended' };
}

function getUserId() {
    let storedId = localStorage.getItem('adherence_user_id');
    if (storedId) return storedId;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'ADH';
    for (let i = 0; i < 4; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    id += Date.now().toString(36).slice(-4).toUpperCase();
    localStorage.setItem('adherence_user_id', id);
    return id;
}

// IP-based fallback — used when browser geolocation is unavailable or denied.
async function getUserLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data     = await response.json();
        userLocation = {
            country:      data.country_name,
            city:         data.city,
            latitude:     data.latitude,
            longitude:    data.longitude,
            country_code: data.country_code
        };
    } catch (error) {
        console.error('Error getting location:', error);
        userLocation = { country: 'Unknown', city: 'Unknown', latitude: 0, longitude: 0, country_code: 'XX' };
    }
}

// Browser geolocation with Nominatim reverse-geocode.
// Called from the consent modal "Continue" button BEFORE onAccept().
// Always resolves — never rejects. Falls back to IP on denial/error.
function requestGeolocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            getUserLocation().then(resolve);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userLocation = {
                    latitude:     position.coords.latitude,
                    longitude:    position.coords.longitude,
                    country:      'Unknown',
                    city:         'Unknown',
                    country_code: 'XX'
                };
                try {
                    const resp = await fetch(
                        'https://nominatim.openstreetmap.org/reverse?lat=' +
                        position.coords.latitude + '&lon=' + position.coords.longitude +
                        '&format=json'
                    );
                    const data = await resp.json();
                    if (data && data.address) {
                        userLocation.city         = data.address.city || data.address.town || data.address.village || data.address.county || 'Unknown';
                        userLocation.country      = data.address.country || 'Unknown';
                        userLocation.country_code = (data.address.country_code || 'XX').toUpperCase();
                    }
                } catch (e) { /* reverse geocode failed — coordinates still usable */ }
                resolve();
            },
            () => { getUserLocation().then(resolve); },   // denied or error → IP fallback
            { timeout: 8000, maximumAge: 300000 }
        );
    });
}

// ═══════════════════════════════════════════════════════
// SCORE CALCULATION
// ═══════════════════════════════════════════════════════
function calculateScore() {
    let score = 0, answered = 0;
    for (let i = 1; i <= 7; i++) {
        const sel = document.querySelector('input[name="q' + i + '"]:checked');
        if (sel) { score += parseFloat(sel.value); answered++; }
    }
    const q8 = document.querySelector('input[name="q8"]:checked');
    if (q8) { score += parseFloat(q8.value); answered++; }
    currentScore      = score;
    answeredQuestions = answered;
    updateScoreDisplay();
}

function updateScoreDisplay() {
    const scoreEl    = document.getElementById('current-score');
    const statusEl   = document.getElementById('adherence-status');
    const progressEl = document.getElementById('progress-fill');
    if (!scoreEl || !statusEl || !progressEl) return;

    scoreEl.textContent    = currentScore.toFixed(2);
    progressEl.style.width = ((answeredQuestions / 8) * 100) + '%';

    let status = 'Not Started', statusColor = '#6b7280';
    if (answeredQuestions === 8) {
        const cat = getAdherenceCategory(currentScore);
        status = cat.label; statusColor = cat.color;
    } else if (answeredQuestions > 0) {
        status = answeredQuestions + '/8 Questions Answered';
    }
    statusEl.textContent = status;
    statusEl.style.color = statusColor;
}

// ═══════════════════════════════════════════════════════
// MAP MARKERS
// ═══════════════════════════════════════════════════════
function addMarkerToMap(assessment) {
    const lat = assessment.latitude;
    const lng = assessment.longitude;
    if (!lat || !lng) return;

    const locationKey = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (!markersByLocation[locationKey]) {
        markersByLocation[locationKey] = { count: 0, scores: [], assessments: [], marker: null };
    }

    const locationData = markersByLocation[locationKey];
    locationData.count++;
    locationData.scores.push(assessment.score);
    locationData.assessments.push(assessment);

    const avgScore = locationData.scores.reduce((a, b) => a + b, 0) / locationData.scores.length;
    const category = getAdherenceCategory(avgScore);

    if (locationData.marker) locationData.marker.remove();

    const el     = document.createElement('div');
    el.className = 'custom-marker';
    const size   = Math.min(20 + locationData.count * 2, 40);
    el.style.cssText = 'position:relative;background-color:' + category.color + ';width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:11px;';
    if (locationData.count > 1) el.textContent = locationData.count;

    let popupContent = '<div style="padding:12px;min-width:250px;"><div style="font-weight:bold;font-size:14px;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid ' + category.color + ';">' + assessment.city + ', ' + assessment.country + '</div>';

    if (locationData.count > 1) {
        popupContent += '<div style="background:#f3f4f6;padding:8px;border-radius:6px;margin-bottom:12px;"><div style="font-weight:600;color:#374151;">\uD83D\uDCCA ' + locationData.count + ' Assessments</div><div style="color:#6b7280;font-size:13px;">Average Score: ' + avgScore.toFixed(2) + '/8</div><div style="color:' + category.color + ';font-weight:500;font-size:13px;">' + category.label + '</div></div>';
    }

    popupContent += '<div style="max-height:300px;overflow-y:auto;">';
    locationData.assessments.forEach((assess, index) => {
        const ac = getAdherenceCategory(assess.score);
        const ts = new Date(assess.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        popupContent += '<div style="padding:8px 0;' + (index > 0 ? 'border-top:1px solid #e5e7eb;' : '') + '"><div style="font-size:11px;color:#6b7280;margin-bottom:4px;">' + ts + '</div><div style="font-weight:600;color:#1f2937;margin-bottom:2px;">Patient: ' + (assess.patient_number || 'N/A') + '</div><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><span style="color:' + ac.color + ';font-weight:600;">' + assess.score.toFixed(2) + '/8</span><span style="color:' + ac.color + ';font-size:12px;">' + ac.label + '</span></div>' + (assess.condition ? '<div style="font-size:12px;color:#6b7280;">Condition: ' + assess.condition + '</div>' : '') + (assess.drug_name ? '<div style="font-size:12px;color:#6b7280;">Medication: ' + assess.drug_name + '</div>' : '') + '</div>';
    });
    popupContent += '</div></div>';

    const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 25, maxWidth: '350px' }).setHTML(popupContent))
        .addTo(map);

    locationData.marker = marker;
    markers.push(marker);
}

// ═══════════════════════════════════════════════════════
// GLOBAL STATS DISPLAY
// ═══════════════════════════════════════════════════════
function updateGlobalStats() {
    const globalCountEl = document.getElementById('global-count');
    if (globalCountEl) {
        globalCountEl.textContent = totalAssessments === 1 ? '1 Assessment Worldwide' : totalAssessments.toLocaleString() + ' Assessments Worldwide';
    }
    const totalEl = document.getElementById('participants-count');
    if (totalEl) totalEl.textContent = totalAssessments.toLocaleString();

    const countriesEl = document.getElementById('countries-count');
    if (countriesEl) countriesEl.textContent = countriesSet.size;

    const avgEl = document.getElementById('global-average');
    if (avgEl && totalAssessments > 0) {
        let ts = 0, tc = 0;
        Object.values(countryData).forEach(d => { ts += d.totalScore; tc += d.count; });
        avgEl.textContent = tc > 0 ? (ts / tc).toFixed(2) : '--';
    }

    const highEl = document.getElementById('highest-country');
    if (highEl && Object.keys(countryData).length > 0) {
        const sorted = Object.entries(countryData).map(([c, d]) => ({ country: c, avgScore: d.totalScore / d.count })).sort((a, b) => b.avgScore - a.avgScore);
        if (sorted.length > 0) highEl.textContent = sorted[0].country + ' (' + sorted[0].avgScore.toFixed(2) + ')';
    }

    const mostEl = document.getElementById('most-active-country');
    if (mostEl && Object.keys(countryData).length > 0) {
        const sorted = Object.entries(countryData).map(([c, d]) => ({ country: c, count: d.count })).sort((a, b) => b.count - a.count);
        if (sorted.length > 0) mostEl.textContent = sorted[0].country + ' (' + sorted[0].count + ')';
    }

    updateCountryStats();
}

function updateCountryStats() {
    const tbody = document.querySelector('#country-stats tbody');
    if (!tbody) return;
    const sorted = Object.entries(countryData).map(([c, d]) => ({ country: c, count: d.count, avgScore: d.totalScore / d.count })).sort((a, b) => b.count - a.count).slice(0, 10);
    tbody.innerHTML = '';
    sorted.forEach(item => {
        const row = tbody.insertRow();
        const cat = getAdherenceCategory(item.avgScore);
        row.innerHTML = '<td style="font-weight:500;">' + item.country + '</td><td>' + item.count + '</td><td>' + item.avgScore.toFixed(2) + '</td><td><span style="color:' + cat.color + ';font-weight:500;">' + cat.label + '</span></td>';
    });
}

// ═══════════════════════════════════════════════════════
// FIREBASE DATA LOADING
// ═══════════════════════════════════════════════════════
function loadExistingAssessments() {
    // Map reads /mapData (anonymized). Full PII records stay at /assessments.
    database.ref('mapData').once('value', (snapshot) => {
        const assessments = snapshot.val();
        if (!assessments) { listenForNewAssessments(); return; }
        Object.values(assessments).forEach(a => processNewAssessment(a));
        listenForNewAssessments();
    });
}

function listenForNewAssessments() {
    const startListeningTime = Date.now();
    database.ref('mapData').on('child_added', (snapshot) => {
        const assessment = snapshot.val();
        if (assessment.timestamp > startListeningTime) processNewAssessment(assessment);
    });
}

function processNewAssessment(assessment) {
    totalAssessments++;
    if (assessment.country) {
        countriesSet.add(assessment.country);
        if (!countryData[assessment.country]) countryData[assessment.country] = { count: 0, totalScore: 0 };
        countryData[assessment.country].count++;
        countryData[assessment.country].totalScore += assessment.score;
    }
    addMarkerToMap(assessment);
    updateGlobalStats();
    if (spectatorMode) addToCinematicFeed(assessment);
}

// ═══════════════════════════════════════════════════════
// OVERLAY MINIMIZE / MAXIMIZE
// ═══════════════════════════════════════════════════════
function setupOverlayMinimize(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    const minimizeBtn = overlay.querySelector('.overlay-minimize');
    if (!minimizeBtn) return;

    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.classList.toggle('overlay-minimized');
        minimizeBtn.textContent = overlay.classList.contains('overlay-minimized') ? '+' : '\u2212';
        minimizeBtn.title       = overlay.classList.contains('overlay-minimized') ? 'Maximize' : 'Minimize';
    });
    overlay.addEventListener('click', () => {
        if (overlay.classList.contains('overlay-minimized')) {
            overlay.classList.remove('overlay-minimized');
            minimizeBtn.textContent = '\u2212';
            minimizeBtn.title       = 'Minimize';
        }
    });
}

// ═══════════════════════════════════════════════════════
// LIVE TICKER BAR
// ═══════════════════════════════════════════════════════
function buildTickerBar() {
    if (document.getElementById('cine-ticker-bar')) return;
    const bar = document.createElement('div');
    bar.id    = 'cine-ticker-bar';
    bar.style.display = 'none';
    bar.innerHTML = '<div class="ticker-label"><span class="ticker-live-dot"></span>LIVE FEED</div><div id="cine-ticker-track"><div id="cine-ticker-inner"></div></div>';
    document.body.appendChild(bar);
    tickerEl      = bar;
    tickerInnerEl = document.getElementById('cine-ticker-inner');
    renderTickerItems();
}

function renderTickerItems() {
    if (!tickerInnerEl) return;
    if (tickerItems.length === 0) {
        tickerInnerEl.innerHTML = '<span class="ticker-item" style="color:rgba(255,255,255,0.4);">Awaiting live submissions from around the world\u2026</span>';
        return;
    }
    const allItems = tickerItems.concat(tickerItems);
    tickerInnerEl.innerHTML = allItems.map(item =>
        '<span class="ticker-item"><span class="ticker-dot" style="background:' + item.color + ';box-shadow:0 0 6px ' + item.color + ';"></span><strong style="color:white;">New submission from</strong>&nbsp;<span style="color:#60a5fa;font-weight:600;">' + (item.city ? item.city + ', ' : '') + item.country + '</span>&nbsp;\u2014&nbsp;<span class="ticker-score" style="color:' + item.color + ';">' + item.level + '</span><span style="color:rgba(255,255,255,0.3);margin-left:8px;font-size:0.75rem;">' + item.time + '</span></span><span class="ticker-separator">\u25c6</span>'
    ).join('');
    tickerInnerEl.style.animation = 'none';
    tickerInnerEl.offsetHeight;
    tickerInnerEl.style.animation = 'ticker-scroll ' + Math.max(20, tickerItems.length * 6) + 's linear infinite';
}

function addToTicker(assessment) {
    const cat = getAdherenceCategory(assessment.score);
    tickerItems.unshift({ city: assessment.city || '', country: assessment.country || 'Unknown', level: cat.label, color: cat.color, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
    if (tickerItems.length > 20) tickerItems.pop();
    renderTickerItems();
}

function showTickerBar() { if (!tickerEl) buildTickerBar(); tickerEl.style.display = 'flex'; }
function hideTickerBar() { if (tickerEl) tickerEl.style.display = 'none'; }

// ═══════════════════════════════════════════════════════
// HEATMAP PULSE
// ═══════════════════════════════════════════════════════
function pulseMarker(lat, lng, color) {
    if (!lat || !lng) return;
    if (!document.getElementById('heatmap-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'heatmap-pulse-style';
        style.textContent = '@keyframes heatmap-pulse{0%{transform:translate(-50%,-50%) scale(0.3);opacity:1;}100%{transform:translate(-50%,-50%) scale(3);opacity:0;}}';
        document.head.appendChild(style);
    }
    const mapContainer = document.getElementById('map');
    const point = map.project([lng, lat]);
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;width:60px;height:60px;border-radius:50%;border:3px solid ' + color + ';pointer-events:none;animation:heatmap-pulse 1.5s ease-out forwards;left:' + point.x + 'px;top:' + point.y + 'px;z-index:10;';
    mapContainer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
}

// ═══════════════════════════════════════════════════════
// CINEMATIC SPECTATOR MODE
// ═══════════════════════════════════════════════════════
function initCinematicSpectator() {
    spectatorOverlay    = document.createElement('div');
    spectatorOverlay.id = 'cinematic-spectator-overlay';
    spectatorOverlay.innerHTML = `
        <style>
            #cinematic-spectator-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;display:none;font-family:'Inter',system-ui,sans-serif;}
            #cinematic-spectator-overlay.active{display:block;}
            .cine-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.5);pointer-events:none;}
            .cine-interactive{pointer-events:auto;}
            .cine-top-bar{position:absolute;top:0;left:0;right:0;height:60px;background:linear-gradient(180deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0) 100%);display:flex;justify-content:space-between;align-items:center;padding:0 24px;}
            .cine-brand{display:flex;align-items:center;gap:12px;}
            .cine-logo{font-size:1.5rem;font-weight:800;background:linear-gradient(135deg,#60a5fa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
            .cine-live-badge{display:flex;align-items:center;gap:8px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.5);padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:1px;}
            .cine-live-dot{width:8px;height:8px;background:#10b981;border-radius:50%;animation:cine-pulse 2s ease-in-out infinite;}
            @keyframes cine-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(1.2);}}
            .cine-event{font-size:0.875rem;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;}
            .cine-exit-btn{background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.5);color:#ef4444;padding:10px 24px;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.3s ease;}
            .cine-exit-btn:hover{background:rgba(239,68,68,0.4);transform:translateY(-2px);}
            .cine-stats{position:absolute;top:70px;left:50%;transform:translateX(-50%);display:flex;gap:40px;background:rgba(0,0,0,0.7);backdrop-filter:blur(20px);padding:16px 40px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);}
            .cine-stat{text-align:center;}
            .cine-stat-val{font-size:2rem;font-weight:800;color:white;line-height:1;}
            .cine-stat-val.hl{color:#60a5fa;}
            .cine-stat-lbl{font-size:0.7rem;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:4px;}
            .cine-left{position:absolute;left:24px;top:160px;width:280px;background:rgba(0,0,0,0.75);backdrop-filter:blur(20px);border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:20px;max-height:calc(100vh - 220px);overflow-y:auto;}
            .cine-panel-title{font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;}
            .cine-right{position:absolute;right:24px;top:160px;width:300px;display:flex;flex-direction:column;gap:16px;max-height:calc(100vh - 220px);}
            .cine-feed{background:rgba(0,0,0,0.75);backdrop-filter:blur(20px);border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:20px;flex:1;overflow:hidden;}
            .cine-feed-list{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;}
            .cine-feed-item{display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;animation:cine-slide 0.5s ease;}
            @keyframes cine-slide{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
            .cine-legend{background:rgba(0,0,0,0.75);backdrop-filter:blur(20px);border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:20px;}
            .cine-legend-item{display:flex;align-items:center;gap:10px;padding:6px 0;}
            .cine-legend-dot{width:12px;height:12px;border-radius:50%;}
            .cine-signature{position:absolute;bottom:56px;right:24px;font-size:0.75rem;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:3px;}
            .cine-notify{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.88);backdrop-filter:blur(20px);padding:14px 28px;border-radius:12px;border:2px solid rgba(96,165,250,0.4);display:none;white-space:nowrap;transition:border-color 0.3s;}
            .cine-notify.active{display:block;animation:cine-slide 0.4s ease;}
            .cine-panel-collapse-btn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;pointer-events:auto;transition:background 0.2s;}
            .cine-panel-collapse-btn:hover{background:rgba(255,255,255,0.25);}
            .cine-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
            .cine-panel-header .cine-panel-title{margin-bottom:0;}
            .cine-panel-body{overflow:hidden;transition:max-height 0.3s ease,opacity 0.3s ease;}
            .cine-panel-body.collapsed{max-height:0!important;opacity:0;pointer-events:none;}
            @media(max-width:768px){
                .cine-left{position:absolute;top:unset!important;bottom:56px;left:10px;right:unset;width:210px;max-height:50vh;padding:12px;}
                .cine-right{position:absolute;top:unset!important;bottom:56px;right:10px;left:unset;width:200px;max-height:50vh;gap:10px;}
                .cine-stats{gap:14px;padding:10px 16px;top:66px;}
                .cine-stat-val{font-size:1.3rem;}
                .cine-stat-lbl{font-size:0.6rem;}
                .cine-feed-list{max-height:90px;}
                .cine-event{display:none;}
            }
            @media(max-width:480px){
                .cine-left{position:absolute!important;top:unset!important;bottom:52px!important;left:8px!important;right:unset!important;width:160px!important;padding:10px;}
                .cine-right{position:absolute!important;top:unset!important;bottom:52px!important;right:8px!important;left:unset!important;width:155px!important;}
                .cine-stats{flex-wrap:wrap;gap:6px;padding:6px 12px;justify-content:center;top:60px;max-width:90vw;}
                .cine-stat{min-width:55px;}
                .cine-stat-val{font-size:1.1rem;}
                .cine-event{display:none;}
                .cine-top-bar{padding:0 12px;}
            }
        </style>
        <div class="cine-backdrop"></div>
        <div class="cine-top-bar cine-interactive">
            <div class="cine-brand">
                <span class="cine-logo">ATLAS</span>
                <div class="cine-live-badge"><span class="cine-live-dot"></span>LIVE GLOBAL FEED</div>
            </div>
            <div class="cine-event">WORLD ADHERENCE DAY 2026</div>
            <button class="cine-exit-btn" id="cine-exit-btn">&#10005; EXIT SPECTATOR</button>
        </div>
        <div class="cine-stats cine-interactive">
            <div class="cine-stat"><div class="cine-stat-val hl" id="cine-total">0</div><div class="cine-stat-lbl">Global Assessments</div></div>
            <div class="cine-stat"><div class="cine-stat-val" id="cine-countries">0</div><div class="cine-stat-lbl">Countries</div></div>
            <div class="cine-stat"><div class="cine-stat-val hl" id="cine-avg">0.00</div><div class="cine-stat-lbl">Global Average</div></div>
            <div class="cine-stat"><div class="cine-stat-val">8</div><div class="cine-stat-lbl">MMAS-8 Max</div></div>
        </div>
        <div class="cine-left cine-interactive">
            <div class="cine-panel-header">
                <div class="cine-panel-title">&#127942; Country Leaderboard</div>
                <button class="cine-panel-collapse-btn" data-target="cine-leaderboard-body" title="Minimize">&minus;</button>
            </div>
            <div class="cine-panel-body" id="cine-leaderboard-body">
                <div id="cine-leaderboard"></div>
            </div>
        </div>
        <div class="cine-right cine-interactive">
            <div class="cine-feed">
                <div class="cine-panel-header">
                    <div class="cine-panel-title">&#128225; Live Submissions</div>
                    <button class="cine-panel-collapse-btn" data-target="cine-feed-body" title="Minimize">&minus;</button>
                </div>
                <div class="cine-panel-body" id="cine-feed-body">
                    <div class="cine-feed-list" id="cine-feed">
                        <div style="color:rgba(255,255,255,0.5);font-size:0.85rem;text-align:center;padding:20px;" data-placeholder="1">Waiting for new submissions...</div>
                    </div>
                </div>
            </div>
            <div class="cine-legend">
                <div class="cine-panel-header">
                    <div class="cine-panel-title">Adherence Levels</div>
                    <button class="cine-panel-collapse-btn" data-target="cine-legend-body" title="Minimize">&minus;</button>
                </div>
                <div class="cine-panel-body" id="cine-legend-body">
                    <div class="cine-legend-item"><div class="cine-legend-dot" style="background:#10b981;"></div><span style="font-size:0.8rem;color:rgba(255,255,255,0.8);">High (Score = 8)</span></div>
                    <div class="cine-legend-item"><div class="cine-legend-dot" style="background:#f59e0b;"></div><span style="font-size:0.8rem;color:rgba(255,255,255,0.8);">Medium (6&ndash;7.99)</span></div>
                    <div class="cine-legend-item"><div class="cine-legend-dot" style="background:#ef4444;"></div><span style="font-size:0.8rem;color:rgba(255,255,255,0.8);">Low (&lt;6)</span></div>
                </div>
            </div>
        </div>
        <div class="cine-notify cine-interactive" id="cine-notify">
            <div style="color:white;font-size:1rem;text-align:center;">New submission from <span style="color:#60a5fa;font-weight:700;" id="cine-loc"></span></div>
        </div>
        
    `;
    document.body.appendChild(spectatorOverlay);
    document.getElementById('cine-exit-btn').addEventListener('click', exitCinematicSpectator);

    // Panel collapse buttons — auto-collapse all on mobile so panels don't block screen
    const isMobile = window.innerWidth <= 768;
    spectatorOverlay.querySelectorAll('.cine-panel-collapse-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute('data-target');
            const body = document.getElementById(targetId);
            if (!body) return;
            const isCollapsed = body.classList.toggle('collapsed');
            body.style.maxHeight = isCollapsed ? '0' : '1000px';
            btn.textContent = isCollapsed ? '+' : '\u2212';
            btn.title = isCollapsed ? 'Expand' : 'Minimize';
        });
        const targetId = btn.getAttribute('data-target');
        const body = document.getElementById(targetId);
        if (body) {
            if (isMobile) {
                // Start collapsed on mobile — panel header stays visible as a small tab
                body.classList.add('collapsed');
                body.style.maxHeight = '0';
                btn.textContent = '+';
                btn.title = 'Expand';
            } else {
                body.style.maxHeight = '1000px';
            }
        }
    });
}

function animateCount(el, target, isDecimal) {
    if (!el) return;
    const from = parseFloat(el.getAttribute('data-val') || '0');
    const duration = 600, startTime = performance.now();
    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const val = from + (target - from) * (1 - Math.pow(1 - progress, 3));
        el.textContent = isDecimal ? val.toFixed(2) : Math.round(val).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
        else el.setAttribute('data-val', target);
    }
    requestAnimationFrame(tick);
}

function updateCinematicStats() {
    animateCount(document.getElementById('cine-total'),     totalAssessments, false);
    animateCount(document.getElementById('cine-countries'), countriesSet.size, false);
    let ts = 0, tc = 0;
    Object.values(countryData).forEach(d => { ts += d.totalScore; tc += d.count; });
    animateCount(document.getElementById('cine-avg'), tc > 0 ? ts / tc : 0, true);
}

function updateCinematicLeaderboard() {
    const lb = document.getElementById('cine-leaderboard');
    if (!lb) return;
    const sorted = Object.entries(countryData).map(([c, d]) => ({ country: c, count: d.count, avg: d.totalScore / d.count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const max    = sorted[0] ? sorted[0].count : 1;
    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
    lb.innerHTML = sorted.map((c, i) => {
        const cat = getAdherenceCategory(c.avg);
        return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="width:28px;font-weight:700;color:white;">' + (i < 3 ? medals[i] : (i + 1)) + '</span><span style="flex:1;color:white;">' + c.country + '</span><div style="width:80px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="width:' + ((c.count / max) * 100) + '%;height:100%;background:' + cat.color + ';border-radius:3px;"></div></div><span style="width:40px;text-align:right;font-weight:600;color:rgba(255,255,255,0.7);">' + c.count + '</span></div>';
    }).join('');
}

function addToCinematicFeed(assessment) {
    const feed = document.getElementById('cine-feed');
    if (!feed || !spectatorMode) return;

    const ph = feed.querySelector('[data-placeholder]');
    if (ph) ph.remove();

    const cat  = getAdherenceCategory(assessment.score);
    const item = document.createElement('div');
    item.className = 'cine-feed-item';
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid ' + cat.color + ';animation:cine-slide 0.4s ease;';
    item.innerHTML = '<div style="width:10px;height:10px;border-radius:50%;background:' + cat.color + ';flex-shrink:0;box-shadow:0 0 8px ' + cat.color + ';"></div><span style="flex:1;font-size:0.82rem;color:white;">' + (assessment.city || 'Unknown') + ', ' + (assessment.country || 'Unknown') + '</span><span style="font-size:0.82rem;font-weight:700;color:' + cat.color + ';">' + assessment.score.toFixed(2) + '</span>';
    feed.insertBefore(item, feed.firstChild);
    while (feed.children.length > 12) feed.removeChild(feed.lastChild);

    updateCinematicStats();
    updateCinematicLeaderboard();
    addToTicker(assessment);

    if (assessment.latitude && assessment.longitude) {
        pulseMarker(assessment.latitude, assessment.longitude, cat.color);
        cinematicTourActive = false;
        if (cinematicTourTimeout) { clearTimeout(cinematicTourTimeout); cinematicTourTimeout = null; }

        const notify = document.getElementById('cine-notify');
        const loc    = document.getElementById('cine-loc');
        if (notify && loc) {
            loc.textContent = (assessment.city || 'Unknown') + ', ' + (assessment.country || 'Unknown') + ' \u2014 ' + cat.label;
            notify.style.borderColor = cat.color;
            notify.classList.add('active');
        }
        map.flyTo({ center: [assessment.longitude, assessment.latitude], zoom: 5, duration: 2500, essential: true });
        setTimeout(() => {
            if (notify) notify.classList.remove('active');
            setTimeout(() => {
                map.flyTo({ center: [0, 20], zoom: 2, duration: 3000, essential: true });
                setTimeout(() => { if (spectatorMode) startCinematicTour(); }, 3200);
            }, 1500);
        }, 5000);
    }
}

function startCinematicTour() {
    cinematicTourActive = true;
    const fallback = [
        { center: [-100, 40], zoom: 3 }, { center: [10, 50], zoom: 3.5 },
        { center: [100, 35], zoom: 3 },  { center: [20, 5], zoom: 3 },
        { center: [-60, -15], zoom: 3 }, { center: [140, -25], zoom: 3.5 },
        { center: [55, 25], zoom: 3.5 }
    ];
    let idx = 0;
    function next() {
        if (!cinematicTourActive || !spectatorMode) return;
        const realKeys = Object.keys(markersByLocation);
        let target;
        if (realKeys.length > 0) {
            const parts = realKeys[idx % realKeys.length].split(',');
            target = { center: [parseFloat(parts[1]), parseFloat(parts[0])], zoom: 4.5 };
        } else {
            target = fallback[idx % fallback.length];
        }
        map.flyTo({ center: target.center, zoom: target.zoom, duration: 5000, essential: true });
        idx++;
        cinematicTourTimeout = setTimeout(next, 10000);
    }
    cinematicTourTimeout = setTimeout(next, 2000);
}

function enterCinematicSpectator() {
    spectatorMode = true;
    document.body.classList.add('spectator-mode');
    if (spectatorOverlay) spectatorOverlay.classList.add('active');

    ['map', 'map-section', 'map-panel', 'main-container'].forEach(id => {
        const el = document.getElementById(id) || document.querySelector('.' + id);
        if (el) el.style.background = '#000';
    });

    map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
    map.once('style.load', () => {
        map.setProjection('globe');
        setTimeout(() => { map.resize(); startCinematicTour(); }, 150);
    });

    updateCinematicStats();
    updateCinematicLeaderboard();
    showTickerBar();
}

function exitCinematicSpectator() {
    spectatorMode = false; cinematicTourActive = false;
    if (cinematicTourTimeout) { clearTimeout(cinematicTourTimeout); cinematicTourTimeout = null; }

    document.body.classList.remove('spectator-mode');
    if (spectatorOverlay) spectatorOverlay.classList.remove('active');

    ['map', 'map-section', 'map-panel', 'main-container'].forEach(id => {
        const el = document.getElementById(id) || document.querySelector('.' + id);
        if (el) el.style.background = '';
    });

    hideTickerBar();
    map.setStyle('mapbox://styles/mapbox/light-v11');
    map.once('style.load', () => {
        map.setProjection('globe');
        map.flyTo({ center: [0, 20], zoom: 2, duration: 1000 });
        setTimeout(() => { map.resize(); }, 200);
    });
}

// ═══════════════════════════════════════════════════════
// EXPORT TO CSV
// ═══════════════════════════════════════════════════════
function exportToExcel() {
    console.log('[ATLAS] exportToExcel called');
    showToast('Preparing export...', 2000);
    database.ref('assessments').once('value', (snapshot) => {
        const assessments = snapshot.val();
        console.log('[ATLAS] assessments for export:', assessments ? Object.keys(assessments).length + ' records' : 'EMPTY/NULL');
        if (!assessments) {
            // Fallback: try mapData
            database.ref('mapData').once('value', (snap2) => {
                const mapRecords = snap2.val();
                console.log('[ATLAS] mapData fallback:', mapRecords ? Object.keys(mapRecords).length + ' records' : 'EMPTY/NULL');
                if (!mapRecords) {
                    showToast('No assessment data found. Submit at least one assessment first.', 4000);
                    return;
                }
                const headers = ['Timestamp','Country','City','Score','Adherence_Level','Latitude','Longitude'];
                const rows = Object.values(mapRecords).map(a => [
                    new Date(a.timestamp).toISOString(),
                    a.country||'Unknown', a.city||'Unknown',
                    (a.score||0).toFixed(2), a.adherence_level||'N/A',
                    a.latitude||0, a.longitude||0
                ]);
                triggerCSVDownload(headers, rows, 'adherence-mapdata-' + new Date().toISOString().split('T')[0] + '.csv');
                showToast('Exported map data (' + rows.length + ' records). Note: assessments node is empty.', 5000);
            });
            return;
        }
        const headers = ['User_ID','Timestamp','Country','City','Patient_Number','Study_ID','Condition','Drug_Type','Drug_Name','Drug_Strength','Route_of_Administration','Gender','Age_Range','Education_Level','Score','Adherence_Level','Data_Tier','Role','Latitude','Longitude'];
        const rows = Object.values(assessments).map(a => [
            a.user_id||'N/A', new Date(a.timestamp).toISOString(),
            a.country||'Unknown', a.city||'Unknown',
            a.patient_number||'N/A', a.study_id||'N/A',
            a.condition||'N/A', a.drug_type||'N/A',
            a.drug_name||'N/A', a.drug_strength||'N/A',
            a.route_of_administration||'N/A', a.gender||'N/A',
            a.age_range||'N/A', a.education_level||'N/A',
            a.score.toFixed(2), a.adherence_level||'N/A',
            a.data_tier||'N/A', a.role||'N/A',
            a.latitude||0, a.longitude||0
        ]);
        console.log('[ATLAS] Triggering CSV download with', rows.length, 'rows');
        triggerCSVDownload(headers, rows, 'adherence-data-' + new Date().toISOString().split('T')[0] + '.csv');
        showToast('Exported ' + rows.length + ' records successfully.', 3000);
    });
}

function triggerCSVDownload(headers, rows, filename) {
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(f => {
            const s = String(f);
            return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
window.exportToExcel = exportToExcel;

// ═══════════════════════════════════════════════════════
// BULK UPLOAD
// ═══════════════════════════════════════════════════════
async function processBulkUpload(file, studyName, piName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const dataSheet = workbook.Sheets['Data Entry'] || workbook.Sheets['\ud83d\udcca Data Entry'] || workbook.Sheets['📊 Data Entry'] || workbook.Sheets[workbook.SheetNames[1]] || workbook.Sheets[workbook.SheetNames[0]];
                const rows     = XLSX.utils.sheet_to_json(dataSheet, { header: 1 });

                // Try to read study info from template header cells if not provided via dialog
                if (!studyName && dataSheet['C1'] && dataSheet['C1'].v) studyName = String(dataSheet['C1'].v).trim();
                if (!piName    && dataSheet['C2'] && dataSheet['C2'].v) piName    = String(dataSheet['C2'].v).trim();

                // Create batch metadata record in Firebase before processing rows
                const batchRef  = database.ref('bulk_uploads').push();
                const batchId   = batchRef.key;
                const uploadDate = Date.now();
                const studyIdVal = document.getElementById('study-id-input') ? (document.getElementById('study-id-input').value.trim().toUpperCase() || null) : null;
                await batchRef.set({
                    batch_id:         batchId,
                    study_name:       studyName || null,
                    pi_name:          piName || null,
                    study_id:         studyIdVal,
                    institution_code: institutionCode || null,
                    uploader_id:      getUserId(),
                    upload_date:      uploadDate,
                    file_name:        file.name,
                    status:           'processing'
                });

                let uploaded = 0, skipped = 0;
                const validRows = rows.slice(4).filter(row => row && row.length >= 10 && row[0] && String(row[0]).includes('EXAMPLE') === false && row[11] !== undefined && row[11] !== null && row[11] !== '');
                const total_rows = validRows.length;

                // Stagger delay: spread writes over time for live map effect
                // ≤20 rows: 800ms apart | ≤100 rows: 400ms | >100 rows: 150ms
                const delay = total_rows <= 20 ? 800 : total_rows <= 100 ? 400 : 150;

                for (const row of validRows) {
                    const [country, city, patientNum, condition, drugType, drugName, drugStrength, route, gender, ageRange, education, _q1, _q2, _q3, _q4, _q5, _q6, _q7, _q8freq] = row;
                    // Convert YES/NO text to numeric MMAS-8 scores
                    function yesno(v, reversed) {
                        if (typeof v === 'number') return v;
                        const s = String(v).trim().toUpperCase();
                        if (reversed) return s === 'YES' ? 1 : s === 'NO' ? 0 : 0;
                        return s === 'NO' ? 1 : s === 'YES' ? 0 : 0;
                    }
                    function q8score(v) {
                        if (typeof v === 'number') {
                            const indexMap = { 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0 };
                            return indexMap[v] !== undefined ? indexMap[v] : 0;
                        }
                        const s = String(v).trim().toLowerCase();
                        if (s === 'never') return 1;
                        if (s === 'rarely' || s === 'once in a while') return 0.75;
                        if (s === 'sometimes') return 0.5;
                        if (s === 'usually') return 0.25;
                        if (s === 'all of the time' || s === 'all the time') return 0;
                        return parseFloat(v) || 0;
                    }
                    const q1 = yesno(_q1, false);
                    const q2 = yesno(_q2, false);
                    const q3 = yesno(_q3, false);
                    const q4 = yesno(_q4, false);
                    const q5 = yesno(_q5, true);
                    const q6 = yesno(_q6, false);
                    const q7 = yesno(_q7, false);
                    const q8freq = q8score(_q8freq);
                    const total = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8freq;

                    let lat = 0, lng = 0;
                    try {
                        const gd = await (await fetch('https://nominatim.openstreetmap.org/search?city=' + encodeURIComponent(city||'') + '&country=' + encodeURIComponent(country) + '&format=json&limit=1')).json();
                        if (gd.length > 0) { lat = parseFloat(gd[0].lat); lng = parseFloat(gd[0].lon); }
                    } catch(e) {}

                    const submissionData = {
                        user_id: getUserId(),
                        timestamp: Date.now(),
                        score: total,
                        adherence_level: getAdherenceCategory(total).label,
                        country: String(country), city: String(city||''),
                        latitude: lat, longitude: lng,
                        patient_number: String(patientNum||''),
                        condition: String(condition||''), drug_type: String(drugType||''),
                        drug_name: String(drugName||''), drug_strength: String(drugStrength||''),
                        route_of_administration: String(route||''),
                        gender: String(gender||''), age_range: String(ageRange||''),
                        education_level: String(education||''),
                        role: userRole || 'patient',
                        data_tier: 'clinical',
                        study_id: studyIdVal,
                        bulk_batch_id: batchId,
                        study_name: studyName || null,
                        pi_name: piName || null,
                        upload_date: uploadDate,
                        q1: parseFloat(q1)||0, q2: parseFloat(q2)||0, q3: parseFloat(q3)||0,
                        q4: parseFloat(q4)||0, q5: parseFloat(q5)||0, q6: parseFloat(q6)||0,
                        q7: parseFloat(q7)||0, q8: parseFloat(q8freq)||0
                    };
                    if (institutionCode) submissionData.institution_code = institutionCode;

                    await database.ref('assessments').push(submissionData);
                    await database.ref('mapData').push({
                        score: total,
                        adherence_level: submissionData.adherence_level,
                        latitude: lat, longitude: lng,
                        country: String(country), city: String(city||''),
                        timestamp: submissionData.timestamp
                    });
                    updatePublicStats(total, String(country));
                    uploaded++;

                    // Stagger: wait between writes so spectators see dots appear one by one
                    if (uploaded < total_rows) {
                        await new Promise(res => setTimeout(res, delay));
                    }
                }
                // Finalize batch record with totals
                await database.ref('bulk_uploads/' + batchId).update({ status: 'complete', record_count: uploaded });
                resolve({ success: true, message: 'Uploaded ' + uploaded + ' assessments. Skipped ' + skipped + ' rows.' });
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
}

function downloadTemplateAsBlob() {
    const templateUrl = 'https://adherence-project-march-2026.s3.amazonaws.com/adherence/MMAS8_Bulk_Upload_Template_PRO.xlsm';
    const btn = document.getElementById('download-template-btn');
    if (btn) { btn.textContent = '⏳ Downloading...'; btn.style.opacity = '0.7'; btn.disabled = true; }
    fetch(templateUrl)
        .then(res => {
            if (!res.ok) throw new Error('Download failed');
            return res.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'MMAS8_Bulk_Upload_Template_PRO.xlsm';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (btn) { btn.textContent = '✅ Downloaded!'; btn.style.opacity = '1'; btn.disabled = false; }
        })
        .catch(err => {
            if (btn) { btn.textContent = '⬇️ Download Excel Template'; btn.style.opacity = '1'; btn.disabled = false; }
            alert('Download failed. Please try again or contact info@adherence.cc');
        });
}

function handleBulkUpload() {
    const inputStyle = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#1f2937;outline:none;';
    const labelStyle = 'display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;';
    const dialogContainer = document.createElement('div');
    dialogContainer.innerHTML = `<div id="bulk-upload-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;"></div>
    <div id="bulk-upload-dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:10000;max-width:500px;width:90%;">
      <h2 style="margin:0 0 6px 0;color:#1f2937;">&#128228; Bulk Upload MMAS-8 Assessments</h2>
      <p style="color:#6b7280;margin-bottom:20px;font-size:14px;">Upload multiple assessments at once using an Excel file.</p>
      <div style="margin-bottom:14px;">
        <label style="${labelStyle}">Study Title</label>
        <input id="bulk-study-name" type="text" placeholder="e.g. Hypertension Adherence Study 2026" style="${inputStyle}">
      </div>
      <div style="margin-bottom:20px;">
        <label style="${labelStyle}">Principal Investigator</label>
        <input id="bulk-pi-name" type="text" placeholder="e.g. Dr. Jane Smith" style="${inputStyle}">
      </div>
      <div style="background:#f3f4f6;padding:15px;border-radius:8px;margin-bottom:20px;">
        <p style="margin:0 0 10px 0;font-weight:600;color:#374151;">&#128203; Need a template?</p>
        <button id="download-template-btn" onclick="downloadTemplateAsBlob()" style="display:inline-block;background:#10b981;color:white;padding:10px 20px;border-radius:6px;border:none;font-weight:500;cursor:pointer;font-size:14px;">&#11015;&#65039; Download Excel Template</button>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="select-file-btn" style="flex:1;background:#2563eb;color:white;padding:12px;border:none;border-radius:6px;font-weight:500;cursor:pointer;">&#128193; Select Excel File</button>
        <button id="cancel-upload-btn" style="background:#e5e7eb;color:#374151;padding:12px 20px;border:none;border-radius:6px;font-weight:500;cursor:pointer;">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(dialogContainer);

    const closeDialog = () => document.body.removeChild(dialogContainer);
    document.getElementById('cancel-upload-btn').onclick = closeDialog;
    document.getElementById('bulk-upload-overlay').onclick = closeDialog;
    document.getElementById('select-file-btn').onclick = () => {
        const studyName = (document.getElementById('bulk-study-name').value || '').trim();
        const piName    = (document.getElementById('bulk-pi-name').value || '').trim();
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.xlsx,.xls,.xlsm';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            closeDialog();
            const loadingMsg = document.createElement('div');
            loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:10000;text-align:center;';
            loadingMsg.innerHTML = '<h3>Processing Excel file...</h3><p>Please wait...</p>';
            document.body.appendChild(loadingMsg);
            try {
                const result = await processBulkUpload(file, studyName, piName);
                document.body.removeChild(loadingMsg);
                alert(result.success ? '\u2705 Bulk Upload Complete!\n\n' + result.message : '\u274C Upload Failed\n\n' + result.message);
            } catch (err) {
                document.body.removeChild(loadingMsg);
                alert('\u274C Upload Failed\n\n' + (err.message || 'Unknown error'));
            }
        };
        input.click();
    };
}
window.handleBulkUpload = handleBulkUpload;



// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// TRANSLATION SYSTEM  v2
// ═══════════════════════════════════════════════════════
//
// Architecture:
//   MMAS_QUESTIONS  — 60 validated language question sets (from Word doc)
//   UI_STRINGS      — UI text for 5 languages (EN/ES/FR/AR/PT)
//   t(key)          — returns current language string, falls back to English
//   switchLanguage()— updates lang, re-renders ALL open modals & DOM elements
//   Rule: MMAS questions switch only when language exists in MMAS_QUESTIONS
//         UI strings switch whenever the language has a UI_STRINGS entry
//         Everything falls back to English silently
//
// ── MMAS question data (all 60 languages from validated Word doc) ─────────────
const MMAS_QUESTIONS = {
  "af": {
    "name": "Afrikaans",
    "native": "Afrikaans",
    "dir": "ltr",
    "q1": "Vergeet jy soms om jou medikasie te neem?",
    "q2": "Mense mis soms om hul medikasie te neem om ander redes as vergeetagtigheid. Terugskouend na die afgelope twee weke, was daar enige kere waar jy nie jou medikasie geneem het nie?",
    "q3": "Het jy al ooit jou medikasie verminder of opgehou sonder om jou dokter te vertel, omdat jy slegter gevoel het toe jy dit geneem het?",
    "q4": "Wanneer jy reis of die huis verlaat, vergeet jy soms om jou medikasie saam te neem?",
    "q5": "Het jy jou medikasie die laaste keer geneem toe jy dit moes neem?",
    "q6": "Wanneer jy voel dat jou simptome onder beheer is, hou jy soms op om jou medikasie te neem?",
    "q7": "Dit is vir sommige mense 'n regte ongerief om elke dag medikasie te neem. Voel jy ooit lastig geval om jou behandelingsplan te volg?",
    "q8": "Hoe dikwels het jy moeilikheid om te onthou om al jou medikasies te neem?"
  },
  "sq": {
    "name": "Albanian",
    "native": "Shqip",
    "dir": "ltr",
    "q1": "A harroni ndonjëherë të merrni ilaçet tuaja?",
    "q2": "Njerëzit ndonjëherë humbasin marrjen e ilaçeve për arsye të tjera përveç harresës. Duke menduar për dy javët e fundit, a kishte ndonjë herë kur nuk i morët ilaçet tuaja?",
    "q3": "A keni reduktuar ose ndaluar ndonjëherë marrjen e ilaçeve pa i thënë mjekut tuaj, sepse u ndjetë më keq kur i morët ato?",
    "q4": "Kur udhëtoni ose largoheni nga shtëpia, a harroni ndonjëherë të merrni ilaçet tuaja?",
    "q5": "A i morët ilaçet herën e fundit kur duhet t'i merrnit?",
    "q6": "Kur ndiheni se simptomat tuaja janë nën kontroll, a ndaloni ndonjëherë të merrni ilaçet tuaja?",
    "q7": "Marrja e ilaçeve çdo ditë është një shqetësim i vërtetë për disa njerëz. A ndiheni ndonjëherë të lodhur nga mbajtja e planit tuaj të trajtimit?",
    "q8": "Sa shpesh keni vështirësi të mbani mend të merrni të gjitha ilaçet tuaja?"
  },
  "am": {
    "name": "Amharic",
    "native": "አማርኛ",
    "dir": "ltr",
    "q1": "አንዳንድ ጊዜ መድኃኒትዎን ረስተው ሳይወሰዱ ቀርተው ያውቃለ?",
    "q2": "ሰዎች አንዳንድ ጊዜ ከመርሳት በተጨማሪ ባሉት የተለያዩ ምክንያቶች መድኃኒታቸውን ሳይወስዱ ይቀራሉ፡፡ ባለፉት ሁለት ሳምንታት፣ መድኃኒትዎን ሳይወስዱ የቀሩበት ጊዜያቶች ነበሩ?",
    "q3": "መድኃኒትዎን እየወሰዱ ህመምዎ ባለመቆሙ ሐኪምዎን ሳያማከሩ መድኃኒትዎን አቋርጠው ያውቃሉ?",
    "q4": "በጉዞ ወይም በሌላ ምክንያት ከቤትዎ እርቀው ሲጓዙ አንዳንድ ጊዜ መድኃኒትዎን ረስተውት ሳይወስዱት ያውቃለ?",
    "q5": "በትላንትናው ዕለት ሁሉንም መድኃኒትዎን ውጠዋል?",
    "q6": "ህመምዎ ጋብ ሲልሎት (የህመምዎ ስሜቶች ሲጠፈ) አንደንዴ ጊዜ መድኃኒትዎን አቋርጠው ያውቃሉ?",
    "q7": "በየቀኑ መድኃኒት መዋጥ፣ ለአንዳንድ ሰዎች አይመችም፡፡ እርስዎ በየቀኑ እንድሁም አንዴም ሰዓት ሳያዛንፉ መድኃኒትዎን መዋጥ የመሰለቸት ስሜት ተሰምቶት ያውቃሉ?",
    "q8": "መድኃኒትዎን አስታውሰው ለመዋጥ ምን ያክል ይቸገራሉ?"
  },
  "ar": {
    "name": "Arabic",
    "native": "العربية",
    "dir": "rtl",
    "q1": "هل تنسى أحيانًا تناول دوائك؟",
    "q2": "ينسى الناس أحياناً تناول أدويتهم لأسباب أخرى غير النسيان. خلال الأسبوعين الماضيين، هل كانت هناك أوقات لم تتناول فيها دوائك؟",
    "q3": "هل سبق لك أن قللت أو توقفت عن تناول دوائك دون إخبار طبيبك لأنك شعرت بأنك أسوأ عندما تناولته؟",
    "q4": "عندما تسافر أو تغادر المنزل، هل تنسى أحيانًا إحضار دوائك؟",
    "q5": "هل تناولت دوائك في المرة الأخيرة التي كان من المفترض أن تتناولها؟",
    "q6": "عندما تشعر أن الأعراض تحت السيطرة، هل تتوقف أحيانًا عن تناول دوائك؟",
    "q7": "تناول الدواء كل يوم يعد إزعاجًا حقيقيًا لبعض الناس. هل تشعر بالانزعاج من الالتزام بخطة العلاج الخاصة بك؟",
    "q8": "كم مرة تجد صعوبة في تذكر تناول جميع أدويتك؟"
  },
  "hy": {
    "name": "Armenian",
    "native": "Հայերեն",
    "dir": "ltr",
    "q1": "Երբեմն մոռանո՞ւմ եք ընդունել ձեր դեղերը:",
    "q2": "Մարդիկ երբեմն բաց են թողնում իրենց դեղերի ընդունումն այլ պատճառներով, քան մոռացումը: Նայելով անցած երկու շաբաթներին, արդյո՞ք եղել են ժամանակներ, երբ չեք ընդունել ձեր դեղերը:",
    "q3": "Հնարավո՞ր է, որ առանց ձեր բժշկին տեղեկացնելու դադարեցրել եք կամ կրճատել եք ձեր դեղերը, քանի որ ավելի վատ եք զգացել դրանք ընդունելուց հետո:",
    "q4": "Երբ ճամփորդում եք կամ տանից դուրս եք գալիս, մոռանո՞ւմ եք ձեր դեղերը:",
    "q5": "Վերջին անգամ, երբ պետք է ընդունեիք ձեր դեղերը, ընդունե՞լ եք:",
    "q6": "Երբ զգում եք, որ ձեր ախտանիշները վերահսկվում են, դադարեցնո՞ւմ եք ձեր դեղերը:",
    "q7": "Ամեն օր դեղեր ընդունելը իրական անհարմարություն է որոշ մարդկանց համար: Երբևէ անհանգստացե՞լ եք ձեր բուժման պլանին հետևելու համար:",
    "q8": "Որքան հաճախ եք դժվարանում հիշել ընդունել ձեր բոլոր դեղերը:"
  },
  "az": {
    "name": "Azerbaijani",
    "native": "Azərbaycan",
    "dir": "ltr",
    "q1": "Bəzən dərmanınızı qəbul etməyi unudursunuzmu?",
    "q2": "İnsanlar bəzən unutqanlıqdan başqa səbəblərdən dərmanlarını qəbul etməyi buraxırlar. Son iki həftəni düşünərək, dərmanınızı qəbul etmədiyiniz vaxtlar olubmu?",
    "q3": "Heç vaxt dərmanınızı qəbul edərkən özünüzü pis hiss etdiyiniz üçün həkiminizə xəbər vermədən dərmanınızı azaldıb və ya dayandırmısınız?",
    "q4": "Səyahət edərkən və ya evdən çıxanda dərmanınızı gətirməyi unudursunuzmu?",
    "q5": "Dərmanınızı qəbul etməli olduğunuz sonuncu dəfə qəbul etmisinizmi?",
    "q6": "Simptomlarınızın nəzarət altında olduğunu hiss etdikdə, dərmanınızı qəbul etməyi dayandırırsınızmı?",
    "q7": "Hər gün dərman qəbul etmək bəzi insanlar üçün həqiqətən narahatlıqdır. Müalicə planınıza riayət etməklə bağlı narahat olduğunuzu hiss edirsinizmi?",
    "q8": "Bütün dərmanlarınızı qəbul etməyi xatırlamaqda nə qədər çətinlik çəkirsiniz?"
  },
  "bn": {
    "name": "Bengali",
    "native": "বাংলা",
    "dir": "ltr",
    "q1": "আপনি কি কখনও কখনও আপনার ওষুধ নিতে ভুলে যান?",
    "q2": "মানুষ কখনও কখনও ভুলে যাওয়া ছাড়া অন্য কারণে তাদের ওষুধ নিতে বাদ দেয়। গত দুই সপ্তাহের কথা চিন্তা করে, এমন কি কোনও সময় ছিল যখন আপনি আপনার ওষুধ নেননি?",
    "q3": "আপনি কি কখনও আপনার ডাক্তারকে না জানিয়ে আপনার ওষুধের ডোজ কমিয়েছেন বা বন্ধ করেছেন, কারণ আপনি ওষুধ গ্রহণ করলে আরও খারাপ অনুভব করতেন?",
    "q4": "আপনি যখন ভ্রমণ করেন বা বাড়ি ছেড়ে যান, তখন কি কখনও কখনও আপনার ওষুধ আনতে ভুলে যান?",
    "q5": "আপনি কি শেষবারের মতো যখন আপনার ওষুধ নিতে হবে, তা গ্রহণ করেছিলেন?",
    "q6": "যখন আপনি অনুভব করেন যে আপনার উপসর্গগুলি নিয়ন্ত্রণে রয়েছে, তখন কি আপনি কখনও কখনও আপনার ওষুধ নেওয়া বন্ধ করেন?",
    "q7": "প্রতিদিন ওষুধ নেওয়া কিছু লোকের জন্য সত্যিই অসুবিধাজনক। আপনি কি কখনও আপনার চিকিৎসা পরিকল্পনা মেনে চলা সম্পর্কে বিরক্তি অনুভব করেন?",
    "q8": "সমস্ত ওষুধ গ্রহণের কথা মনে রাখতে আপনার কতটা অসুবিধা হয়?"
  },
  "bs": {
    "name": "Bosnian",
    "native": "Bosanski",
    "dir": "ltr",
    "q1": "Da li ponekad zaboravljate uzeti lijekove?",
    "q2": "Ljudi ponekad propuste uzimanje lijekova iz drugih razloga osim zaboravnosti. Razmišljajući o posljednje dvije sedmice, da li je bilo ikakvih trenutaka kada niste uzimali lijekove?",
    "q3": "Da li ste ikada smanjili ili prestali uzimati lijekove bez da ste rekli svom doktoru, jer ste se osjećali lošije kad ste ih uzimali?",
    "q4": "Kada putujete ili napustite kuću, da li ponekad zaboravite ponijeti lijekove?",
    "q5": "Da li ste uzeli lijekove posljednji put kada ste trebali uzeti?",
    "q6": "Kada osjećate da su vam simptomi pod kontrolom, da li ponekad prestanete uzimati lijekove?",
    "q7": "Uzimanje lijekova svaki dan je stvarna neprijatnost za neke ljude. Da li se ikada osjećate napadnuto zbog pridržavanja vašeg plana liječenja?",
    "q8": "Koliko često imate poteškoće u sjećanju da uzmete sve svoje lijekove?"
  },
  "zh": {
    "name": "Chinese (Simplified)",
    "native": "中文(简体)",
    "dir": "ltr",
    "q1": "你有时候会忘记吃药吗？",
    "q2": "人们有时因其他原因而不是忘记而错过服药。回顾过去两周，有没有任何时候你没有服用你的药物？",
    "q3": "你有没有在没有告诉医生的情况下减少或停止服药，因为你觉得服药后感觉更糟？",
    "q4": "旅行或离开家时，你有时会忘记带药吗？",
    "q5": "你上次该吃药的时候吃了吗？",
    "q6": "当你觉得症状得到控制时，你有时会停止服药吗？",
    "q7": "每天吃药对有些人来说确实很不方便。你是否觉得坚持治疗计划很麻烦？",
    "q8": "你多久会发现很难记住吃所有的药？"
  },
  "zh-TW": {
    "name": "Chinese (Traditional)",
    "native": "中文(繁體)",
    "dir": "ltr",
    "q1": "你有時候會忘記吃藥嗎？",
    "q2": "人們有時因其他原因而不是忘記而錯過服藥。回顧過去兩週，有沒有任何時候你沒有服用你的藥物？",
    "q3": "你有沒有在沒有告訴醫生的情況下減少或停止服藥，因為你覺得服藥後感覺更糟？",
    "q4": "旅行或離開家時，你有時會忘記帶藥嗎？",
    "q5": "你上次該吃藥的時候吃了嗎？",
    "q6": "當你覺得症狀得到控制時，你有時會停止服藥嗎？",
    "q7": "每天吃藥對有些人來說確實很不方便。你是否覺得堅持治療計劃很麻煩？",
    "q8": "你多久會發現很難記住吃所有的藥？"
  },
  "hr": {
    "name": "Croatian",
    "native": "Hrvatski",
    "dir": "ltr",
    "q1": "Zaboravljate li ponekad uzeti lijek?",
    "q2": "Ljudi ponekad propuste uzimanje lijekova iz razloga koji nisu zaborav. Razmišljajući o protekla dva tjedna, je li bilo ikakvih trenutaka kada niste uzeli lijekove?",
    "q3": "Jeste li ikada smanjili ili prestali uzimati lijekove, a da niste rekli liječniku, jer ste se osjećali lošije dok ste ih uzimali?",
    "q4": "Kada putujete ili odlazite od kuće, zaboravite li ponekad ponijeti lijekove?",
    "q5": "Jeste li uzeli lijek zadnji put kada ste ga trebali uzeti?",
    "q6": "Kada osjećate da su vaši simptomi pod kontrolom, prestanete li ponekad uzimati svoje lijekove?",
    "q7": "Svakodnevno uzimanje lijekova nekima je prava neugodnost. Osjećate li se ikada mučno zbog pridržavanja svog plana liječenja?",
    "q8": "Koliko često imate poteškoća sa sjećanjem da morate uzeti sve svoje lijekove?"
  },
  "cs": {
    "name": "Czech",
    "native": "Čeština",
    "dir": "ltr",
    "q1": "Zapomínáte někdy vzít si léky?",
    "q2": "Lidé někdy vynechají užívání léků z jiných důvodů než zapomnětlivosti. Přemýšlíte-li o posledních dvou týdnech, byly chvíle, kdy jste si nevzali své léky?",
    "q3": "Snížili jste někdy nebo přestali užívat léky bez toho, abyste to řekli svému lékaři, protože jste se cítili hůře, když jste je užívali?",
    "q4": "Když cestujete nebo opouštíte domov, zapomínáte někdy vzít si léky s sebou?",
    "q5": "Vzali jste si své léky naposledy, když jste je měli vzít?",
    "q6": "Když máte pocit, že máte příznaky pod kontrolou, přestanete někdy užívat své léky?",
    "q7": "Užívání léků každý den je pro některé lidi skutečným nepohodlím. Cítíte se někdy obtěžováni dodržováním svého léčebného plánu?",
    "q8": "Jak často máte potíže si vzpomenout, abyste si vzali všechny své léky?"
  },
  "da": {
    "name": "Danish",
    "native": "Dansk",
    "dir": "ltr",
    "q1": "Glemmer du nogle gange at tage din medicin?",
    "q2": "Folk glemmer nogle gange at tage deres medicin af andre årsager end glemsomhed. Når du tænker på de sidste to uger, var der så tidspunkter, hvor du ikke tog din medicin?",
    "q3": "Har du nogensinde skåret ned på eller stoppet med at tage din medicin uden at fortælle det til din læge, fordi du havde det værre, når du tog den?",
    "q4": "Når du rejser eller forlader hjemmet, glemmer du så nogle gange at tage din medicin med?",
    "q5": "Tog du din medicin sidste gang, du skulle tage den?",
    "q6": "Når du føler, at dine symptomer er under kontrol, stopper du så nogle gange med at tage din medicin?",
    "q7": "At tage medicin hver dag er en rigtig ulejlighed for nogle mennesker. Føler du dig nogensinde irriteret over at følge din behandlingsplan?",
    "q8": "Hvor ofte har du svært ved at huske at tage alle dine mediciner?"
  },
  "nl": {
    "name": "Dutch",
    "native": "Nederlands",
    "dir": "ltr",
    "q1": "Vergeet je soms je medicatie in te nemen?",
    "q2": "Mensen slaan soms het innemen van hun medicatie over om andere redenen dan vergeetachtigheid. Als je terugdenkt aan de afgelopen twee weken, waren er momenten waarop je je medicatie niet hebt ingenomen?",
    "q3": "Heb je ooit je medicatie verminderd of gestopt zonder je dokter te vertellen, omdat je je slechter voelde toen je het innam?",
    "q4": "Wanneer je reist of van huis weggaat, vergeet je soms je medicatie mee te nemen?",
    "q5": "Heb je de laatste keer dat je je medicatie moest innemen, het genomen?",
    "q6": "Wanneer je het gevoel hebt dat je symptomen onder controle zijn, stop je soms met het innemen van je medicatie?",
    "q7": "Het dagelijks innemen van medicatie is voor sommige mensen echt een ongemak. Voel je je ooit gehinderd door je aan je behandelplan te houden?",
    "q8": "Hoe vaak heb je moeite om te onthouden al je medicaties in te nemen?"
  },
  "et": {
    "name": "Estonian",
    "native": "Eesti",
    "dir": "ltr",
    "q1": "Kas unustate mõnikord oma ravimeid võtta?",
    "q2": "Inimesed jätavad mõnikord oma ravimeid võtmata muudel põhjustel peale unustamise. Mõeldes viimasele kahele nädalale, kas oli hetki, mil te ei võtnud oma ravimeid?",
    "q3": "Kas olete kunagi oma arstile ütlemata vähendanud või lõpetanud oma ravimite võtmise, sest tundsite end halvemini, kui neid võtsite?",
    "q4": "Kui reisite või lahkute kodust, kas unustate mõnikord oma ravimeid kaasa võtta?",
    "q5": "Kas võtsite oma ravimeid viimati, kui pidite neid võtma?",
    "q6": "Kui tunnete, et teie sümptomid on kontrolli all, kas lõpetate mõnikord oma ravimite võtmise?",
    "q7": "Mõne inimese jaoks on igapäevane ravimite võtmine tõeliselt ebamugav. Kas tunnete end kunagi oma raviplaanist kinni pidamise pärast häirituna?",
    "q8": "Kui tihti teil on raskusi kõigi oma ravimite võtmise meeldejätmisega?"
  },
  "tl": {
    "name": "Filipino",
    "native": "Filipino",
    "dir": "ltr",
    "q1": "Minsan ba ay nakakalimutan mong inumin ang iyong gamot?",
    "q2": "Minsan ang mga tao ay nakakalimutan ang pag-inom ng kanilang gamot dahil sa iba pang dahilan bukod sa pagkalimot. Sa pag-iisip tungkol sa nakaraang dalawang linggo, may mga pagkakataon ba na hindi mo ininom ang iyong gamot?",
    "q3": "Kailanman ba ay binawasan mo o itinigil ang pag-inom ng iyong gamot nang hindi sinasabi sa iyong doktor, dahil mas masama ang pakiramdam mo kapag ininom mo ito?",
    "q4": "Kapag naglalakbay ka o umaalis ng bahay, minsan bang nakakalimutan mong dalhin ang iyong gamot?",
    "q5": "Ininom mo ba ang iyong gamot noong huling beses na dapat mo itong inumin?",
    "q6": "Kapag nararamdaman mong kontrolado ang iyong mga sintomas, minsan bang itinitigil mo ang pag-inom ng iyong gamot?",
    "q7": "Ang pag-inom ng gamot araw-araw ay isang tunay na abala para sa ilang tao. Minsan bang nararamdaman mong nababahala ka tungkol sa pagsunod sa iyong plano ng paggamot?",
    "q8": "Gaano kadalas kang nahihirapan na maalala ang pag-inom ng lahat ng iyong gamot?"
  },
  "fr": {
    "name": "French",
    "native": "Français",
    "dir": "ltr",
    "q1": "Parfois, oubliez-vous de prendre votre médicament ?",
    "q2": "Parfois, les gens ne prennent pas leurs médicaments pour des raisons autres que l'oubli. En repensant aux deux dernières semaines, y a-t-il eu des moments où vous n'avez pas pris votre médicament?",
    "q3": "Avez-vous déjà réduit ou arrêté de prendre votre médicament sans en parler à votre médecin, parce que vous vous sentiez pire en le prenant ?",
    "q4": "Lorsque vous voyagez ou quittez la maison, oubliez-vous parfois d'emporter votre médicament ?",
    "q5": "Avez-vous pris votre médicament la dernière fois que vous deviez le prendre ?",
    "q6": "Lorsque vous sentez que vos symptômes sont sous contrôle, arrêtez-vous parfois de prendre votre médicament ?",
    "q7": "Prendre des médicaments tous les jours est un véritable inconvénient pour certaines personnes. Vous sentez-vous parfois harcelé par le fait de suivre votre plan de traitement ?",
    "q8": "À quelle fréquence avez-vous du mal à vous rappeler de prendre tous vos médicaments ?"
  },
  "ka": {
    "name": "Georgian",
    "native": "ქართული",
    "dir": "ltr",
    "q1": "ხანდახან გავიწყდებათ წამლის მიღება?",
    "q2": "ადამიანები ხანდახან გამოტოვებენ წამლის მიღებას სხვა მიზეზებით, გარდა დავიწყებისა. უკანასკნელი ორი კვირის გახსენებისას, იყო თუ არა მომენტები, როდესაც არ მიგიღიათ თქვენი წამლები?",
    "q3": "ოდესმე შეგიცვლიათ ან შეწყვეტილა წამლის მიღება ისე, რომ არ შეგითანხმებივით ექიმს, რადგან უფრო ცუდად გრძნობდით თავს, როცა მას იღებდით?",
    "q4": "როცა მოგზაურობთ ან სახლიდან გადიხართ, ხანდახან გავიწყდებათ წამლის წაღება?",
    "q5": "ბოლო დროს, როცა უნდა მიგეღოთ წამალი, მიიღეთ?",
    "q6": "როცა გრძნობთ, რომ სიმპტომები კონტროლს ექვემდებარება, ხანდახან წყვეტთ წამლის მიღებას?",
    "q7": "ყოველდღე წამლის მიღება რეალური უხერხულობაა ზოგიერთისთვის. ოდესმე გიგრძვნიათ დისკომფორტი თქვენი მკურნალობის გეგმაზე მორჩილების გამო?",
    "q8": "რამდენად ხშირად გიჭირთ გახსენება, რომ მიიღოთ ყველა წამალი?"
  },
  "de": {
    "name": "German",
    "native": "Deutsch",
    "dir": "ltr",
    "q1": "Vergessen Sie manchmal, Ihre Medikamente einzunehmen?",
    "q2": "Menschen versäumen manchmal, ihre Medikamente aus anderen Gründen als dem Vergessen einzunehmen. Wenn Sie an die letzten zwei Wochen zurückdenken, gab es Zeiten, in denen Sie Ihr Medikament nicht genommen haben?",
    "q3": "Haben Sie jemals die Einnahme Ihres Medikaments reduziert oder aufgehört, ohne es Ihrem Arzt zu sagen, weil Sie sich schlechter fühlten, wenn Sie es genommen haben?",
    "q4": "Wenn Sie reisen oder das Haus verlassen, vergessen Sie manchmal, Ihr Medikament mitzunehmen?",
    "q5": "Haben Sie Ihr Medikament das letzte Mal genommen, als Sie es nehmen sollten?",
    "q6": "Wenn Sie das Gefühl haben, dass Ihre Symptome unter Kontrolle sind, hören Sie manchmal auf, Ihr Medikament einzunehmen?",
    "q7": "Die tägliche Einnahme von Medikamenten ist für manche Menschen eine echte Unannehmlichkeit. Fühlen Sie sich manchmal genervt, Ihren Behandlungsplan einzuhalten?",
    "q8": "Wie oft haben Sie Schwierigkeiten, sich daran zu erinnern, alle Ihre Medikamente einzunehmen?"
  },
  "el": {
    "name": "Greek",
    "native": "Ελληνικά",
    "dir": "ltr",
    "q1": "Μερικές φορές ξεχνάτε να πάρετε τα φάρμακά σας;",
    "q2": "Οι άνθρωποι μερικές φορές χάνουν τη λήψη των φαρμάκων τους για λόγους πέρα από τη λήθη. Σκεπτόμενοι τις τελευταίες δύο εβδομάδες, υπήρξαν στιγμές που δεν πήρατε τα φάρμακά σας;",
    "q3": "Έχετε ποτέ μειώσει ή σταματήσει να παίρνετε τα φάρμακά σας χωρίς να ενημερώσετε τον γιατρό σας, επειδή αισθανόσασταν χειρότερα όταν τα παίρνατε;",
    "q4": "Όταν ταξιδεύετε ή φεύγετε από το σπίτι, ξεχνάτε μερικές φορές να φέρετε τα φάρμακά σας;",
    "q5": "Πήρατε τα φάρμακά σας την τελευταία φορά που έπρεπε να τα πάρετε;",
    "q6": "Όταν αισθάνεστε ότι τα συμπτώματά σας είναι υπό έλεγχο, σταματάτε μερικές φορές να παίρνετε τα φάρμακά σας;",
    "q7": "Η καθημερινή λήψη φαρμάκων είναι πραγματικά μια ταλαιπωρία για μερικούς ανθρώπους. Νιώθετε ποτέ αγχωμένοι για την τήρηση του θεραπευτικού σας πλάνου;",
    "q8": "Πόσο συχνά έχετε δυσκολία να θυμάστε να παίρνετε όλα τα φάρμακά σας;"
  },
  "ht": {
    "name": "Haitian Creole",
    "native": "Kreyòl",
    "dir": "ltr",
    "q1": "Èske ou pafwa bliye pran medikaman w?",
    "q2": "Moun pafwa rate pran medikaman yo pou lòt rezon pase bliye. Panse sou de semèn ki sot pase yo, èske te gen moman kote ou pa t pran medikaman w?",
    "q3": "Èske w te janm koupe oswa sispann pran medikaman w san ou pa di doktè w, paske ou te santi w pi mal lè w te pran li?",
    "q4": "Lè ou vwayaje oswa kite kay la, èske w pafwa bliye pote medikaman w?",
    "q5": "Èske ou te pran medikaman w dènye fwa ou te sipoze pran li?",
    "q6": "Lè ou santi ke sentòm ou yo anba kontwòl, èske ou pafwa sispann pran medikaman w?",
    "q7": "Pran medikaman chak jou se yon pwoblèm reyèl pou kèk moun. Èske ou janm santi w fristre paske ou bezwen swiv plan tretman w?",
    "q8": "Konbyen fwa ou gen difikilte pou sonje pou pran tout medikaman w?"
  },
  "haw": {
    "name": "Hawaiian",
    "native": "ʻŌlelo Hawaiʻi",
    "dir": "ltr",
    "q1": "Hoʻopoina paha ʻoe i kekahi manawa e lawe i kāu lāʻau lapaʻau?",
    "q2": "Hoʻopau ka poʻe i kekahi manawa i ka lawe ʻana i kā lākou lāʻau lapaʻau no nā kumu ʻē aʻe ma mua o ka hoʻopoina ʻana. E noʻonoʻo ana i nā pule ʻelua i hala, he mau manawa paha i loaʻa iā ʻoe i ka manawa i lawe ʻole ʻoe i kāu lāʻau lapaʻau?",
    "q3": "Ua hōʻemi paha ʻoe a hoʻōki paha i ka lawe ʻana i kāu lāʻau lapaʻau me ka ʻole e haʻi aku i kau kauka, no ka mea ua ʻike ʻoe he maikaʻi ʻole ke lawe ʻoe?",
    "q4": "Ke huakaʻi ʻoe a haʻalele i ka hale, hoʻopoina paha ʻoe i kekahi manawa e lawe i kāu lāʻau lapaʻau?",
    "q5": "Ua lawe paha ʻoe i kāu lāʻau lapaʻau i ka manawa hope loa i hiki iā ʻoe ke lawe?",
    "q6": "Ke manaʻo ʻoe he mālama ʻia kāu mau hōʻailona, hoʻōki paha ʻoe i kekahi manawa i ka lawe ʻana i kāu lāʻau lapaʻau?",
    "q7": "He pilikia maoli ka lawe ʻana i ka lāʻau lapaʻau i nā lā a pau no kekahi poʻe. Ua ʻeha paha kou naʻau e pili ana i ka mālama ʻana i kāu papahana lapaʻau?",
    "q8": "Pehea pinepine ʻoe i ka paʻakikī e hoʻomanaʻo e lawe i kāu mau lāʻau lapaʻau a pau?"
  },
  "he": {
    "name": "Hebrew",
    "native": "עברית",
    "dir": "rtl",
    "q1": "האם אתה לפעמים שוכח לקחת את התרופות שלך?",
    "q2": "אנשים לפעמים מחמיצים לקחת את התרופות שלהם מסיבות אחרות מאשר שכחה. חושב על השבועיים האחרונים, האם היו זמנים שבהם לא לקחת את התרופות שלך?",
    "q3": "האם אי פעם צמצמת או הפסקת לקחת את התרופות שלך מבלי ליידע את הרופא שלך, כי הרגשת רע יותר כשלקחת אותן?",
    "q4": "כשאתה נוסע או עוזב את הבית, האם לפעמים אתה שוכח לקחת את התרופות שלך?",
    "q5": "האם לקחת את התרופות שלך בפעם האחרונה שהיית אמור לקחת אותן?",
    "q6": "כשאתה מרגיש שהסימפטומים שלך בשליטה, האם לפעמים אתה מפסיק לקחת את התרופות שלך?",
    "q7": "לקחת תרופות כל יום זה מטרד אמיתי עבור חלק מהאנשים. האם אי פעם אתה מרגיש מטרד לגבי דבקות בתוכנית הטיפול שלך?",
    "q8": "באיזו תדירות אתה מתקשה לזכור לקחת את כל התרופות שלך?"
  },
  "hi": {
    "name": "Hindi",
    "native": "हिन्दी",
    "dir": "ltr",
    "q1": "क्या आप कभी-कभी अपनी दवा लेना भूल जाते हैं?",
    "q2": "लोग कभी-कभी भूलने के अलावा अन्य कारणों से अपनी दवा लेने से चूक जाते हैं। पिछले दो हफ्तों के बारे में सोचते हुए, क्या ऐसे समय थे जब आपने अपनी दवा नहीं ली?",
    "q3": "क्या आपने कभी अपने डॉक्टर को बताए बिना अपनी दवा कम की है या बंद कर दी है क्योंकि दवा लेने पर आपको बुरा लगा?",
    "q4": "जब आप यात्रा करते हैं या घर से बाहर जाते हैं, तो क्या आप कभी-कभी अपनी दवा लाना भूल जाते हैं?",
    "q5": "क्या आपने पिछली बार जब आपको दवा लेनी थी, तो ली थी?",
    "q6": "जब आपको लगता है कि आपके लक्षण नियंत्रण में हैं, तो क्या आप कभी-कभी अपनी दवा लेना बंद कर देते हैं?",
    "q7": "हर दिन दवा लेना कुछ लोगों के लिए वास्तव में असुविधाजनक होता है। क्या आपको कभी अपने उपचार योजना का पालन करने में परेशानी महसुस होती है?",
    "q8": "सभी दवाओं को याद रखने में आपको कितनी बार कठिनाई होती है?"
  },
  "hu": {
    "name": "Hungarian",
    "native": "Magyar",
    "dir": "ltr",
    "q1": "Néha elfelejti bevenni a gyógyszerét?",
    "q2": "Az emberek néha más okok miatt is kihagyják a gyógyszer bevételét, nem csak feledékenységből. Az elmúlt két hétre visszagondolva, voltak-e olyan időpontok, amikor nem vette be a gyógyszerét?",
    "q3": "Előfordult már, hogy csökkentette vagy abbahagyta a gyógyszer szedését anélkül, hogy értesítette volna az orvosát, mert rosszabbul érezte magát, amikor bevette?",
    "q4": "Amikor utazik vagy elhagyja otthonát, néha elfelejti magával vinni a gyógyszerét?",
    "q5": "Bevette a gyógyszerét legutóbb, amikor be kellett volna vennie?",
    "q6": "Amikor úgy érzi, hogy tünetei kontroll alatt vannak, néha abbahagyja a gyógyszer szedését?",
    "q7": "A mindennapi gyógyszer szedése valóban kényelmetlen egyes emberek számára. Érezte már valaha nehézséget a kezelési terv betartásában?",
    "q8": "Milyen gyakran okoz nehézséget emlékeznie arra, hogy az összes gyógyszerét bevegye?"
  },
  "is": {
    "name": "Icelandic",
    "native": "Íslenska",
    "dir": "ltr",
    "q1": "Gleymir þú stundum að taka lyfin þín?",
    "q2": "Fólk gleymist stundum að taka lyfin sín af öðrum ástæðum en gleymsku. Hugsandi um síðustu tvær vikur, voru einhverjir tímar þar sem þú tókst ekki lyfin þín?",
    "q3": "Hefur þú einhvern tíma skorið niður eða hætt að taka lyfin þín án þess að segja lækninum þínum, því þú fannst þér verri þegar þú tókst þau?",
    "q4": "Þegar þú ferðast eða ferð að heiman, gleymir þú stundum að taka lyfin þín með?",
    "q5": "Tókst þú lyfin þín síðast þegar þú áttir að taka þau?",
    "q6": "Þegar þú finnur að einkennin eru undir stjórn, hættir þú stundum að taka lyfin þín?",
    "q7": "Að taka lyf á hverjum degi er virkilega óþægilegt fyrir suma. Finnst þér einhvern tíma erfitt að halda þig við meðferðaráætlunina þína?",
    "q8": "Hversu oft áttu erfitt með að muna eftir að taka öll lyfin þín?"
  },
  "id": {
    "name": "Indonesian",
    "native": "Indonesia",
    "dir": "ltr",
    "q1": "Apakah Anda terkadang lupa minum obat Anda?",
    "q2": "Orang terkadang melewatkan minum obat mereka karena alasan lain selain lupa. Memikirkan dua minggu terakhir, apakah ada saat-saat di mana Anda tidak minum obat?",
    "q3": "Apakah Anda pernah mengurangi atau berhenti minum obat tanpa memberi tahu dokter Anda, karena Anda merasa lebih buruk saat meminumnya?",
    "q4": "Ketika Anda bepergian atau meninggalkan rumah, apakah Anda terkadang lupa membawa obat Anda?",
    "q5": "Apakah Anda minum obat terakhir kali Anda seharusnya meminumnya?",
    "q6": "Ketika Anda merasa gejala Anda terkendali, apakah Anda terkadang berhenti minum obat Anda?",
    "q7": "Minum obat setiap hari benar-benar merepotkan bagi sebagian orang. Apakah Anda pernah merasa repot mengikuti rencana perawatan Anda?",
    "q8": "Seberapa sering Anda kesulitan mengingat untuk minum semua obat Anda?"
  },
  "it": {
    "name": "Italian",
    "native": "Italiano",
    "dir": "ltr",
    "q1": "A volte dimentichi di prendere il tuo farmaco?",
    "q2": "A volte le persone mancano di prendere i loro farmaci per motivi diversi dall'oblio. Ripensando alle ultime due settimane, ci sono stati momenti in cui non hai preso il tuo farmaco?",
    "q3": "Hai mai ridotto o smesso di prendere il tuo farmaco senza dirlo al tuo medico, perché ti sentivi peggio quando lo prendevi?",
    "q4": "Quando viaggi o esci di casa, a volte dimentichi di portare il tuo farmaco?",
    "q5": "Hai preso il tuo farmaco l'ultima volta che dovevi prenderlo?",
    "q6": "Quando senti che i tuoi sintomi sono sotto controllo, a volte smetti di prendere il tuo farmaco?",
    "q7": "Prendere farmaci ogni giorno è un vero inconveniente per alcune persone. Ti senti mai infastidito a seguire il tuo piano di trattamento?",
    "q8": "Quanto spesso hai difficoltà a ricordarti di prendere tutti i tuoi farmaci?"
  },
  "ja": {
    "name": "Japanese",
    "native": "日本語",
    "dir": "ltr",
    "q1": "薬を飲むのを時々忘れることがありますか？",
    "q2": "忘れる以外の理由で薬を飲み損ねることがあります。過去2週間を振り返って、薬を飲まなかった時があありましたか？",
    "q3": "飲んだときに調子が悪くなったので、医師に言わずに薬を減らしたりやめたりしたことがありますか？",
    "q4": "旅行や外出時に、薬を持ってくるのを忘れることがありますか？",
    "q5": "最後に薬を飲むべきときに、薬を飲みましたか？",
    "q6": "症状がコントロールされていると感じたときに、薬を飲むのをやめることがありますか？",
    "q7": "毎日薬を飲むのは、一部の人にとって本当に不便です。治療計画に従うことについて煩わしさを感じたことはありますか？",
    "q8": "すべての薬を飲むのを覚えているのが難しいと感じることはどのくらいありますか"
  },
  "kn": {
    "name": "Kannada",
    "native": "ಕನ್ನಡ",
    "dir": "ltr",
    "q1": "ನೀವು ಕೆಲವು ಬಾರಿ ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವುದನ್ನು ಮರೆತೆಯೇ?",
    "q2": "ಜನರು ಕೆಲವೊಮ್ಮೆ ಮರೆತಿಲ್ಲದ ಕಾರಣಕ್ಕಾಗಿ ತಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವುದನ್ನು ಬಿಡುತ್ತಾರೆ. ಕಳೆದ ಎರಡು ವಾರಗಳ ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದರೆ, ನೀವು ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳದ ಯಾವುದೇ ಸಮಯಗಳಿದ್ದವೇ?",
    "q3": "ನೀವು ವೈದ್ಯರನ್ನು ತಿಳಿಸದೆ ನಿಮ್ಮ ಔಷಧಿಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಿದ್ದೀರಾ ಅಥವಾ ನಿಲ್ಲಿಸಿದ್ದೀರಾ, ಏಕೆಂದರೆ ನೀವು ಅದನ್ನು ತೆಗೆದುಕೊಂಡಾಗ ಹೆಚ್ಚು ಕೆಟ್ಟಿದ್ದೀರಿ?",
    "q4": "ನೀವು ಪ್ರಯಾಣಿಸುತ್ತಿರುವಾಗ ಅಥವಾ ಮನೆಯನ್ನು ತೊರೆದಾಗ, ನೀವು ಕೆಲವೊಮ್ಮೆ ಔಷಧಿಗಳನ್ನು ತರಲು ಮರೆತೆಯೇ?",
    "q5": "ನೀವು ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳಬೇಕಾದ ಕೊನೆಯ ಸಮಯದಲ್ಲಿ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ?",
    "q6": "ನಿಮ್ಮ ಲಕ್ಷಣಗಳು ನಿಯಂತ್ರಣದಲ್ಲಿ ಇದ್ದಂತೆ ಎನಿಸಿದಾಗ, ನೀವು ಕೆಲವೊಮ್ಮೆ ಔಷಧಿಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುವುದನ್ನು ನಿಲ್ಲಿಸುತ್ತೀರಾ?",
    "q7": "ಪ್ರತಿ ದಿನ ಔಷಧಿಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುವುದು ಕೆಲವರಿಗೆ ನಿಜವಾಗಿಯೂ ತೊಂದರೆ. ನಿಮ್ಮ ಚಿಕಿತ್ಸೆ ಯೋಜನೆಗೆ ಬದ್ಧವಾಗಲು ನೀವು ಕೆಲವೊಮ್ಮೆ ತೊಂದರೆ ಅನುಭವಿಸಿದ್ದೀರಾ?",
    "q8": "ನೀವು ನಿಮ್ಮ ಎಲ್ಲಾ ಔಷಧಿಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಲು ಮರೆತು ಬಿಡಲು ಎಷ್ಟು ಬಾರಿ ಕಷ್ಟ ಅನುಭವಿಸುತ್ತೀರಿ?"
  },
  "kk": {
    "name": "Kazakh",
    "native": "Қазақша",
    "dir": "ltr",
    "q1": "Сіз кейде дәрі қабылдауды ұмытып қаласыз ба?",
    "q2": "Адамдар кейде ұмытып қалудан басқа себептермен дәрі қабылдауды өткізіп жібереді. Соңғы екі аптаны еске түсіріп, дәрі қабылдамаған уақыттар болды ма?",
    "q3": "Дәрі қабылдағаннан кейін өзіңізді нашар сезінгендіктен, дәрігеріңізге ескертпей, дәрі қабылдауды қысқартқан немесе тоқтатқан кезіңіз болды ма?",
    "q4": "Саяхаттағанда немесе үйден шыққанда дәрі-дәрмекті өзіңізбен бірге алуды ұмытып қаласыз ба?",
    "q5": "Соңғы рет дәрі қабылдау керек кезде оны қабылдадыңыз ба?",
    "q6": "Симптомдарыңыз бақылауға алынғандай сезінгенде, кейде дәрі қабылдауды тоқтатасыз ба?",
    "q7": "Күн сайын дәрі қабылдау кейбір адамдар үшін шын мәнінде қолайсыз. Емдеу жоспарыңызға сай болу сізге кейде қиындық туғыза ма?",
    "q8": "Барлық дәрі-дәрмектерді қабылдауды ұмытып қалу қиынға соға ма?"
  },
  "ko": {
    "name": "Korean",
    "native": "한국어",
    "dir": "ltr",
    "q1": "가끔 약을 복용하는 것을 잊어버리나요?",
    "q2": "사람들은 때때로 잊어버리는 것 외의 이유로 약을 복용하지 못합니다. 지난 2주를 돌이켜보면, 약을 복용하지 않은 적이 있었나요?",
    "q3": "약을 복용하면 상태가 나빠져서 의사에게 알리지 않고 약을 줄이거나 중단한 적이 있나요?",
    "q4": "여행이나 외출할 때 약을 가져오는 것을 가끔 잊어버리나요?",
    "q5": "마지막으로 약을 복용해야 했을 때 복용했나요?",
    "q6": "증상이 조절된다고 느낄 때 약을 복용하는 것을 가끔 중단하나요?",
    "q7": "매일 약을 복용하는 것은 일부 사람들에게 정말 불편합니다. 치료 계획을 따르는 것에 대해 귀찮다고 느끼나요?",
    "q8": "모든 약을 기억하는 데 어려움을 겪는 경우가 얼마나 자주 있나요?"
  },
  "lo": {
    "name": "Lao",
    "native": "ລາວ",
    "dir": "ltr",
    "q1": "ເຈົ້າບາງຄັ້ງຈະລືມກິນຢາບໍ?",
    "q2": "ຄົນບາງຄັ້ງຈະຂ້າມການກິນຢາເນື່ອງຈາກເຫດຜົນອື່ນນອກຈາກການລືມ. ຄິດຖືກກ່ຽວກັບສອງອາທິດຜ່ານມາ, ມີເວລາໃດບ້ານທີ່ເຈົ້າບໍ່ໄດ້ກິນຢາບໍ?",
    "q3": "ເຈົ້າເຄີຍຫຼຸດຫຼືຫຍຸດການກິນຢາໂດຍບໍ່ໄດ້ບອກທານຢາຂອງເຈົ້າບໍ, ເພາະເຈົ້າຮູ້ສຶກບໍ່ດີເມື່ອເຈົ້າກິນມັນ?",
    "q4": "ເມື່ອເຈົ້າເດີນທາງຫຼືອອກຈາກບ້ານ, ເຈົ້າມັກຈະລືມນໍາຢາມາບໍ?",
    "q5": "ເຈົ້າໄດ້ກິນຢາໃນເວລາທີ່ເຈົ້າຄວນກິນຢາໃນເວລາສຸດທ້າຍບໍ?",
    "q6": "ເມື່ອເຈົ້າຮູ້ສຶກວ່າອາການຂອງເຈົ້າຢູ່ໃນຄວາມຄວບຄຸມ, ເຈົ້າບາງຄັ້ງຈະຢຸດການກິນຢາບໍ?",
    "q7": "ການກິນຢາທຸກມື້ເປັນຄວາມບໍ່ສະດວກທີ່ແທ້ຈິງສໍາລັບຄົນບາງຄົນ. ເຈົ້າເຄີຍຮູ້ສຶກບໍ່ສະດວກກ່ຽວກັບການຕິດຕາມແຜນການຮັກສາຂອງເຈົ້າບໍ?",
    "q8": "ເປັນປະຈໍາປານໃດທີ່ເຈົ້າມີຄວາມລຳບາກໃນການຈື່ຈຳການກິນຢາທັງໝົດຂອງເຈົ້າ?"
  },
  "lv": {
    "name": "Latvian",
    "native": "Latviešu",
    "dir": "ltr",
    "q1": "Vai dažreiz aizmirstat lietot savas zāles?",
    "q2": "Cilvēki dažreiz izlaiž savu zāļu lietošanu citu iemeslu dēļ, nevis aizmāršības dēļ. Domājot par pēdējām divām nedēļām, vai bija kādi brīži, kad nelietojāt savas zāles?",
    "q3": "Vai esat kādreiz samazinājis vai pārtraucis lietot savas zāles, neinformējot savu ārstu, jo jutāties sliktāk, kad tās lietojāt?",
    "q4": "Kad ceļojat vai pametat mājas, vai dažreiz aizmirstat paņemt savas zāles?",
    "q5": "Vai pēdējo reizi, kad vajadzēja lietot zāles, jūs tās lietojāt?",
    "q6": "Kad jūtat, ka simptomi ir kontrolēti, vai dažreiz pārtraucat lietot zāles?",
    "q7": "Katru dienu lietot zāles ir patiešām neērti dažiem cilvēkiem. Vai jūs kādreiz jūtat apgrūtinājumu, ievērojot savu ārstēšanas plānu?",
    "q8": "Cik bieži jums ir grūtības atcerēties lietot visas savas zāles?"
  },
  "lt": {
    "name": "Lithuanian",
    "native": "Lietuvių",
    "dir": "ltr",
    "q1": "Ar kartais pamirštate išgerti vaistus?",
    "q2": "Žmonės kartais praleidžia vaistų vartojimą dėl kitų priežasčių, o ne dėl užmaršumo. Pagalvojus apie pastarąsias dvi savaites, ar buvo momentų, kai negerėte vaistų?",
    "q3": "Ar kada nors sumažinote arba nutraukėte vaistų vartojimą neinformavę gydytojo, nes jaučiatės blogiau, kai juos vartojate?",
    "q4": "Kai keliaujate ar paliekate namus, ar kartais pamirštate pasiimti vaistus?",
    "q5": "Ar paskutinį kartą, kai reikėjo išgerti vaistus, juos išgėrėte?",
    "q6": "Kai jaučiate, kad simptomai yra kontroliuojami, ar kartais nustojate vartoti vaistus?",
    "q7": "Kiekvieną dieną vartoti vaistus kai kuriems žmonėms yra tikrai nepatogu. Ar kada nors jaučiate sunkumų laikantis gydymo plano?",
    "q8": "Kaip dažnai jums sunku prisiminti išgerti visus savo vaistus?"
  },
  "ms": {
    "name": "Malay",
    "native": "Bahasa Melayu",
    "dir": "ltr",
    "q1": "Adakah anda kadang-kadang lupa mengambil ubat anda?",
    "q2": "Orang kadang-kadang terlepas mengambil ubat mereka kerana sebab selain lupa. Berfikir tentang dua minggu yang lalu, adakah terdapat masa-masa di mana anda tidak mengambil ubat anda?",
    "q3": "Pernahkah anda mengurangkan atau berhenti mengambil ubat anda tanpa memberitahu doktor anda, kerana anda merasa lebih teruk apabila mengambilnya?",
    "q4": "Apabila anda bepergian atau meninggalkan rumah, adakah anda kadang-kadang lupa membawa ubat anda?",
    "q5": "Adakah anda mengambil ubat anda kali terakhir anda sepatutnya mengambilnya?",
    "q6": "Apabila anda merasa gejala anda terkawal, adakah anda kadang-kadang berhenti mengambil ubat anda?",
    "q7": "Mengambil ubat setiap hari adalah benar-benar menyusahkan bagi sesetengah orang. Adakah anda pernah merasa terbeban untuk mengikuti pelan rawatan anda?",
    "q8": "Berapa kerapkah anda menghadapi kesukaran untuk mengingati mengambil semua ubat anda?"
  },
  "mn": {
    "name": "Mongolian",
    "native": "Монгол",
    "dir": "ltr",
    "q1": "Заримдаа эмээ уухаас мартдаг уу?",
    "q2": "Хүмүүс заримдаа мартах шалтгаанаас бусад шалтгаанаар эмээ авахгүй орхидог. Өнгөрсөн хоёр долоо хоногийг эргэцүүлэн бодоход, эмээ авахгүй байсан үе байсан уу?",
    "q3": "Та хэзээ нэгэн цагт эмчдээ хэлэлгүйгээр эмээ багасгаж эсвэл зогсоосон уу, учир нь та эмээ уухад муу байсан уу?",
    "q4": "Та аялж эсвэл гэрээсээ гарахдаа эмээ авч явахгүй гэж мартдаг уу?",
    "q5": "Сүүлийн удаа эмээ уухаар байсан үед уусан уу?",
    "q6": "Та шинж тэмдгүүдээ хянаж байгаа гэж мэдрэх үедээ заримдаа эмээ уухаас зогсоодог уу?",
    "q7": "Өдөр бүр эм уух нь зарим хүмүүст үнэхээр төвөгтэй байдаг. Та хэзээ нэгэн цагт эмчилгээний төлөвлөгөөгөө дагаж мөрдөхөд хүндрэлтэй гэж боддог уу?",
    "q8": "Та бүх эмээ уухаа санахад хэр олон удаа хэцүү байдаг вэ?"
  },
  "ne": {
    "name": "Nepali",
    "native": "नेपाली",
    "dir": "ltr",
    "q1": "के तपाईं कहिलेकाहीँ तपाईंको औषधी लिन बिर्सनुहुन्छ?",
    "q2": "मानिसहरू कहिलेकाहीँ बिर्सनु बाहेक अन्य कारणका लागि औषधि लिन छुटाउँछन्। विगत दुई हप्ता सोच्दा, के त्यस्ता समयहरू थिए जब तपाईंले औषधि लिनु भएन?",
    "q3": "के तपाईंले तपाईंको डाक्टरलाई नभनीकन औषधि कम गर्नुभएको छ वा रोक्नुभएको छ, किनकि तपाईंले यसलाई लिनु भएको बेला झनै खराब महसुस गर्नु भएको थियो?",
    "q4": "जब तपाईं यात्रा गर्नुहुन्छ वा घर छोड्नुहुन्छ, के तपाईं कहिलेकाहीँ तपाईंको औषधि ल्याउन बिर्सनुहुन्छ?",
    "q5": "तपाईंले अन्तिम पटक जब तपाईंले लिनु पर्ने बेला औषधि लिनुभयो?",
    "q6": "जब तपाईंको लक्षणहरू नियन्त्रणमा भएको महसुस गर्नुहुन्छ, के तपाईं कहिलेकाहीँ औषधि लिन बन्द गर्नुहुन्छ?",
    "q7": "हरेक दिन औषधि लिनु केहि मानिसहरूका लागि साँच्चिकै असुविधा हो। के तपाईंलाई कहिलेकाहीँ तपाईंको उपचार योजना पालना गर्न कठिन महसुस हुन्छ?",
    "q8": "तपाईंलाई सबै औषधि लिन सम्झन कत्तिको गाह्रो लाग्छ?"
  },
  "no": {
    "name": "Norwegian",
    "native": "Norsk",
    "dir": "ltr",
    "q1": "Glemmer du noen ganger å ta medisinen din?",
    "q2": "Folk glemmer noen ganger å ta medisinen sin av andre grunner enn å glemme. Tenker du på de siste to ukene, var det noen tidspunkter da du ikke tok medisinen din?",
    "q3": "Har du noen gang kuttet ned eller sluttet å ta medisinen uten å fortelle legen din, fordi du følte deg verre når du tok den?",
    "q4": "Når du reiser eller forlater hjemmet, glemmer du noen ganger å ta med medisinen din?",
    "q5": "Tok du medisinen din sist gang du skulle ta den?",
    "q6": "Når du føler at symptomene dine er under kontroll, slutter du noen ganger å ta medisinen?",
    "q7": "Å ta medisin hver dag er virkelig upraktisk for noen mennesker. Har du noen gang følt at det er vanskelig å følge behandlingsplanen din?",
    "q8": "Hvor ofte har du problemer med å huske å ta alle medisinene dine?"
  },
  "fa": {
    "name": "Persian",
    "native": "فارسی",
    "dir": "rtl",
    "q1": "آیا گاهی فراموش می‌کنید داروهایتان را مصرف کنید؟",
    "q2": "مردم گاهی به دلایلی غیر از فراموشی، مصرف داروهایشان را از دست می‌دهند. به دو هفته گذشته فکر کنید، آیا مواقعی بوده که داروهایتان را مصرف نکرده‌اید؟",
    "q3": "آیا تاکنون بدون اطلاع پزشک خود، مصرف داروهایتان را کاهش داده یا متوقف کرده‌اید، زیرا هنگام مصرف آن‌ها حالتان بدتر شده است؟",
    "q4": "وقتی سفر می‌کنید یا خانه را ترک می‌کنید، آیا گاهی فراموش می‌کنید داروهایتان را با خود ببرید؟",
    "q5": "آیا آخرین باری که باید داروهایتان را مصرف می‌کردید، آن‌ها را مصرف کردید؟",
    "q6": "وقتی احساس می‌کنید علائم شما تحت کنترل است، آیا گاهی مصرف داروهایتان را متوقف می‌کنید؟",
    "q7": "مصرف داروها هر روز واقعاً برای برخی افراد مشکل است. آیا تاکنون احساس کرده‌اید که پیروی از برنامه درمانی شما سخت است؟",
    "q8": "چند بار در یادآوری مصرف تمام داروهایتان مشکل دارید؟"
  },
  "pl": {
    "name": "Polish",
    "native": "Polski",
    "dir": "ltr",
    "q1": "Czy zdarza Ci się czasem zapomnieć wziąć leki?",
    "q2": "Ludzie czasem opuszczają branie leków z innych powodów niż zapomnienie. Myśląc o ostatnich dwóch tygodniach, czy były chwile, w których nie brałeś/aś leków?",
    "q3": "Czy kiedykolwiek zmniejszyłeś/aś dawkę lub przestałeś/aś brać leki bez poinformowania lekarza, ponieważ czułeś/aś się gorzej, gdy je brałeś/aś?",
    "q4": "Kiedy podróżujesz lub wychodzisz z domu, czy czasem zapominasz zabrać ze sobą leki?",
    "q5": "Czy wziąłeś/aś leki ostatnim razem, gdy powinieneś/aś je wziąć?",
    "q6": "Kiedy czujesz, że objawy są pod kontrolą, czy czasami przestajesz brać leki?",
    "q7": "Branie leków codziennie jest naprawdę niewygodne dla niektórych osób. Czy kiedykolwiek czułeś/aś, że przestrzeganie planu leczenia jest uciążliwe?",
    "q8": "Jak często masz trudności z pamiętaniem o wzięciu wszystkich swoich leków?"
  },
  "pt-PT": {
    "name": "Portuguese (PT)",
    "native": "Português (PT)",
    "dir": "ltr",
    "q1": "Às vezes esquece-se de tomar os seus medicamentos?",
    "q2": "As pessoas às vezes não tomam os seus medicamentos por outras razões além do esquecimento. Pensando nas últimas duas semanas, houve alturas em que não tomou os seus medicamentos?",
    "q3": "Alguma vez reduziu ou parou de tomar os seus medicamentos sem informar o seu médico, porque se sentia pior quando os tomava?",
    "q4": "Quando viaja ou sai de casa, às vezes esquece-se de levar os seus medicamentos?",
    "q5": "Tomou os seus medicamentos na última vez que deveria tê-los tomado?",
    "q6": "Quando sente que os seus sintomas estão controlados, às vezes deixa de tomar os seus medicamentos?",
    "q7": "Tomar medicamentos todos os dias é realmente inconveniente para algumas pessoas. Alguma vez sentiu que era um incómodo seguir o seu plano de tratamento?",
    "q8": "Com que frequência tem dificuldade em lembrar-se de tomar todos os seus medicamentos?"
  },
  "pt": {
    "name": "Portuguese",
    "native": "Português",
    "dir": "ltr",
    "q1": "Você às vezes esquece de tomar sua medicação?",
    "q2": "As pessoas às vezes não tomam seus medicamentos por razões além do esquecimento. Pensando nas últimas duas semanas, houve momentos em que você não tomou seu medicamento?",
    "q3": "Você já reduziu ou parou de tomar seu medicamento sem informar seu médico, porque se sentiu pior quando o tomou?",
    "q4": "Quando você viaja ou sai de casa, às vezes esquece de levar seu medicamento?",
    "q5": "Você tomou seu medicamento na última vez que deveria tomar?",
    "q6": "Quando você sente que seus sintomas estão controlados, às vezes para de tomar seu medicamento?",
    "q7": "Tomar medicação todos os dias é um verdadeiro incômodo para algumas pessoas. Você já se sente incomodado em seguir seu plano de tratamento?",
    "q8": "Com que frequência você tem dificuldade em lembrar de tomar todos os seus medicamentos?"
  },
  "ru": {
    "name": "Russian",
    "native": "Русский",
    "dir": "ltr",
    "q1": "Вы иногда забываете принимать свои лекарства?",
    "q2": "Люди иногда пропускают приём лекарств по другим причинам, кроме забывчивости. Вспоминая последние две недели, были ли моменты, когда вы не принимали свои лекарства?",
    "q3": "Вы когда-нибудь уменьшали дозу или прекращали принимать лекарства без уведомления врача, потому что чувствовали себя хуже при их приеме?",
    "q4": "Когда вы путешествуете или покидаете дом, вы иногда забываете взять с собой лекарства?",
    "q5": "Вы приняли свои лекарства в последний раз, когда должны были их принять?",
    "q6": "Когда вы чувствуете, что ваши симптомы под контролем, вы иногда прекращаете принимать лекарства?",
    "q7": "Ежедневный прием лекарств является настоящей неприятностью для некоторых людей. Вы когда-нибудь чувствовали себя раздраженным от необходимости придерживаться своего плана лечения?",
    "q8": "Как часто вам сложно помнить о приеме всех ваших лекарств?"
  },
  "sr": {
    "name": "Serbian",
    "native": "Srpski",
    "dir": "ltr",
    "q1": "Da li ponekada zaboravite da uzimate vaše lekove?",
    "q2": "Ljudi ponekad propuste uzimanje lekova iz razloga koji nisu vezani samo za zaborav. Tokom zadnje dve nedelje, da li je bilo trenutaka kada niste uzeli svoj lek?",
    "q3": "Da li ste ikada smanjili dozu ili prestali da uzimate lekove a da niste rekli doktoru jer ste se osećali lošije nakon konzumiranja lekova.",
    "q4": "Kada putujete ili ste van kuće, da li ponekada zaboravite da ponesete svoje lekove?",
    "q5": "Da li ste uzeli svoje lekove poslednji put kada je trebalo da ih uzmete?",
    "q6": "Kada osetite da su simptomi prestali, da li prestajete da uzimate svoje lekove?",
    "q7": "Konzumiranje lekova svakog dana može da bude naporno. Da li se ikada osećate pod pritiskom da nastavite sa uzimanjem lekova?",
    "q8": "Koliko često imate problem da se setite da uzmete sve svoje lekove?"
  },
  "sr-Cyrl": {
    "name": "Serbian (Cyrillic)",
    "native": "Српски",
    "dir": "ltr",
    "q1": "Да ли понекад заборављате да узмете своје лекове?",
    "q2": "Људи понекад пропусте узимање лекова из других разлога осим заборава. Размишљајући о последње две недеље, да ли је било тренутака када нисте узели лекове?",
    "q3": "Да ли сте икада смањили или престали да узимате лекове а да нисте обавестили свог лекара, зато што сте се осећали лошије када сте их узимали?",
    "q4": "Када путујете или напуштате кућу, да ли понекад заборавите да понесете лекове?",
    "q5": "Да ли сте узели лекове последњи пут када је требало да их узмете?",
    "q6": "Када осетите да су вам симптоми под контролом, да ли понекад престанете да узимате лекове?",
    "q7": "Узимање лекова сваког дана је заиста непријатно за неке људе. Да ли сте некада осетили да је тешко да се придржавате свог плана лечења?",
    "q8": "Колико често имате тешкоћа да се сетите да узмете све своје лекове?"
  },
  "si": {
    "name": "Sinhala",
    "native": "සිංහල",
    "dir": "ltr",
    "q1": "ඔබේ ඖෂධ ගැනීම අමතක කරයිද?",
    "q2": "මිනිසුන්ට අමතක වීමෙන් තොරව වෙනත් හේතු මත ඔවුන්ගේ ඖෂධ ගැනීම මග හැරේ. පසුගිය සති 2 ගැන සිතන විට, ඔබේ ඖෂධ නොගත් ඕනෑම අවස්ථාවක් තිබේද?",
    "q3": "ඔබේ වෛද්‍යවරයාට නොමැසිදී ඔබේ ඖෂධ ගැනීම අඩු කර ඇතද හෝ නතර කර ඇතද, එය ගැනීමට ඔබට නරක විය හැකිද?",
    "q4": "ඔබ යාත්‍රා කරන විට හෝ නිවසින් පිටවූ විට, ඔබේ ඖෂධ ඔබ සමඟ ගෙන ඒම අමතක කරයිද?",
    "q5": "ඔබේ ඖෂධ ගැනීමට අවසන් වරට ඔබ ගෙන තිබේද?",
    "q6": "ඔබේ ලක්ෂණ පාලනයට ලක්ව ඇති බවක් ඔබට දැනුනු විට, ඔබේ ඖෂධ ගැනීම නතර කරයිද?",
    "q7": "සෑම දිනකම ඖෂධ ගැනීම යමක් වූ බව ඔබට දැනී තිබේද. ඔබේ ප්‍රතිකාර සැලැස්ම පසුපස යාම අපහසු බව ඔබට දැනී තිබේද?",
    "q8": "ඔබේ සියලුම ඖෂධ ගැනීමට මතක් කිරීමේදී ඔබට ගැටලු ඇතිවන්නේ කොපමණ වතාවක්ද?"
  },
  "so": {
    "name": "Somali",
    "native": "Soomaali",
    "dir": "ltr",
    "q1": "Ma illoowdaa inaad qaadato daawooyinkaaga mararka qaar?",
    "q2": "Dadku mararka qaar waxay ka tagaan qaadashada daawooyinkooda sababo aan illoobin ahayn. Adiga oo ka fikiraya labada todobaad ee la soo dhaafay, ma jireen waqtiyo aadan qaadanin daawooyinkaaga?",
    "q3": "Ma hoos u dhigtay ama joojisay qaadashada daawooyinkaaga adiga oo aan u sheegin dhakhtarkaaga, sababtoo ah waxaad dareentay inaad ka sii dartay markaad qaadato?",
    "q4": "Marka aad safarto ama ka tagto guriga, ma illoowdaa inaad qaadato daawooyinkaaga mararka qaar?",
    "q5": "Ma qaadatay daawooyinkaaga markii ugu dambeysay ee aad qaadan lahayd?",
    "q6": "Marka aad dareento in astaamahaagu xakameysan yihiin, ma joojisaa qaadashada daawooyinkaaga mararka qaar?",
    "q7": "Qaadashada daawooyinka maalin kasta waxay dhab ahaantii dhib ku tahay qaar ka mid ah dadka. Ma dareentay inay dhib tahay inaad raacdo qorshahaaga daaweynta?",
    "q8": "Inta jeer ee aad dhibaato ku qabto inaad xasuusato inaad qaadato dhammaan daawooyinkaaga intee le'eg tahay?"
  },
  "es": {
    "name": "Spanish",
    "native": "Español",
    "dir": "ltr",
    "q1": "¿A veces olvidas tomar tu medicamento?",
    "q2": "A veces las personas no toman sus medicamentos por razones distintas al olvido. Pensando en las últimas dos semanas, ¿hubo alguna vez que no tomaste tu medicamento?",
    "q3": "¿Alguna vez has reducido o dejado de tomar tu medicamento sin decírselo a tu médico, porque te sentiste peor al tomarlo?",
    "q4": "Cuando viajas o sales de casa, ¿a veces olvidas llevar tu medicamento?",
    "q5": "¿Tomaste tu medicamento la última vez que debías tomarlo?",
    "q6": "Cuando sientes que tus síntomas están bajo control, ¿a veces dejas de tomar tu medicamento?",
    "q7": "Tomar medicamentos todos los días es un verdadero inconveniente para algunas personas. ¿Alguna vez te sientes molesto por seguir tu plan de tratamiento?",
    "q8": "¿Con qué frecuencia tienes dificultades para recordar tomar todos tus medicamentos?"
  },
  "sw": {
    "name": "Swahili",
    "native": "Kiswahili",
    "dir": "ltr",
    "q1": "Je, wakati mwingine unasahau kunywa dawa zako?",
    "q2": "Watu wakati mwingine wanakosa kunywa dawa zao kwa sababu nyingine isipokuwa kusahau. Ukiwaza kuhusu wiki mbili zilizopita, je, kulikuwa na nyakati ambazo hukunywa dawa zako?",
    "q3": "Je, umewahi kupunguza au kuacha kunywa dawa zako bila kumjulisha daktari wako, kwa sababu ulihisi vibaya zaidi ulipozinywa?",
    "q4": "Unaposafiri au kutoka nyumbani, je, wakati mwingine unasahau kuchukua dawa zako?",
    "q5": "Je, ulinywa dawa zako mara ya mwisho ulipostahili kuzinywa?",
    "q6": "Unapohisi dalili zako ziko chini ya udhibiti, je, wakati mwingine unaacha kunywa dawa zako?",
    "q7": "Kunywa dawa kila siku ni jambo lisilofaa kweli kwa baadhi ya watu. Je, umewahi kuhisi kuwa ni vigumu kufuata mpango wako wa matibabu?",
    "q8": "Ni mara ngapi unapata shida kukumbuka kunywa dawa zako zote?"
  },
  "ta": {
    "name": "Tamil",
    "native": "தமிழ்",
    "dir": "ltr",
    "q1": "உங்கள் மருந்தை எடுத்துக்கொள்ள சில சமயங்களில் மறந்து விடுகிறீர்களா?",
    "q2": "சில சமயங்களில் மருந்தை எடுத்துக்கொள்ள மறந்து விடுவதை தவிர வேறு காரணங்களுக்காகவும் சிலர் மருந்தை எடுத்துக்கொள்ளத் தவறுகிறார்கள். கடந்த இரண்டு வாரங்களை நினைத்தால், நீங்கள் மருந்தை எடுத்துக்கொள்ளாத எந்த நேரங்களும் இருந்தனவா?",
    "q3": "உங்கள் மருத்துவரிடம் தெரிவிக்காமல், மருந்தை எடுத்தால் நிலைமை மேலும் மோசமாகும் என்று உணர்ந்தால், மருந்து அளவை குறைத்து அல்லது நிறுத்தி விட்டீர்களா?",
    "q4": "நீங்கள் பயணம் செய்தால் அல்லது வீட்டை விட்டு வெளியே சென்றால், உங்கள் மருந்துகளை எடுத்துக்கொள்ள மறந்து விடுகிறீர்களா?",
    "q5": "நீங்கள் கடைசி முறையாக மருந்து எடுத்துக்கொள்ள வேண்டிய பொழுது எடுத்துக்கொண்டீர்களா?",
    "q6": "உங்களின் அறிகுறிகள் கட்டுக்குள் இருக்கின்றன என்று நீங்கள் உணரும்போது, சில சமயங்களில் மருந்து எடுத்துக்கொள்வதை நிறுத்தி விடுகிறீர்களா?",
    "q7": "ஒவ்வொரு நாளும் மருந்து எடுத்துக்கொள்வது சிலருக்கு உண்மையாகவே சிரமமாக இருக்கிறது. உங்களின் சிகிச்சை திட்டத்தை பின்பற்றுவது சிரமமாகவே உள்ளதாக எப்போதாவது உணர்ந்ததுண்டா?",
    "q8": "உங்களின் அனைத்து மருந்துகளையும் எடுத்துக்கொள்ள நினைவில் கொள்வது எவ்வளவு அடிக்கடி சிரமமாக உள்ளது?"
  },
  "te": {
    "name": "Telugu",
    "native": "తెలుగు",
    "dir": "ltr",
    "q1": "మీరు మీ మందులు తీసుకోవడం కొన్నిసార్లు మర్చిపోతారా?",
    "q2": "మందులు మర్చిపోవడం కాకుండా ఇతర కారణాల వల్ల కొన్నిసార్లు మనుషులు తమ మందులు తీసుకోవడం తప్పిపోతారు. గత రెండు వారాలు గురించి ఆలోచిస్తే, మీరు మీ మందులు తీసుకోని సమయాలు ఏమైనా ఉన్నాయా?",
    "q3": "మీరు మీ వైద్యుడికి తెలియజేయకుండా, మందులు తీసుకుంటే మీ ఆరోగ్యం మరింత క్షీణిస్తుంది అని భావించి, మందుల మోతాదును తగ్గించారా లేదా ఆపివేశారా?",
    "q4": "మీరు ప్రయాణిస్తే లేదా ఇంటిని వదిలి వెళ్ళినపుడు, మీ మందులు తీసుకోవడం కొన్నిసార్లు మర్చిపోతారా?",
    "q5": "మీరు గతంలో మీ మందులు తీసుకోవలసిన సమయంలో తీసుకున్నారా?",
    "q6": "మీరు మీ లక్షణాలు నియంత్రణలో ఉన్నాయని భావించినప్పుడు, కొన్నిసార్లు మీరు మీ మందులు తీసుకోవడం ఆపివేస్తారా?",
    "q7": "ప్రతి రోజూ మందులు తీసుకోవడం కొంతమంది వ్యక్తులకు నిజంగా ఇబ్బందికరంగా ఉంటుంది. మీ చికిత్సా ప్రణాళికను అనుసరించడం ఇబ్బందిగా ఉంది అని మీరు ఎప్పుడైనా భావించారా?",
    "q8": "మీ అన్ని మందులు తీసుకోవడం గుర్తు పెట్టుకోవడంలో మీరు ఎంత తరచుగా ఇబ్బందులు ఎదుర్కొంటారు?"
  },
  "th": {
    "name": "Thai",
    "native": "ภาษาไทย",
    "dir": "ltr",
    "q1": "คุณเคยลืมกินยาบ้างไหม?",
    "q2": "บางครั้งผู้คนพลาดการกินยาเพราะเหตุผลอื่นนอกจากความหลงลืม คิดถึงช่วงสองสัปดาห์ที่ผ่านมา มีช่วงเวลาใดที่คุณไม่ได้กินยาบ้างไหม?",
    "q3": "คุณเคยลดหรือหยุดกินยาโดยไม่บอกแพทย์หรือไม่ เพราะคุณรู้สึกแย่ลงเมื่อกินยา?",
    "q4": "เมื่อคุณเดินทางหรือออกจากบ้าน คุณเคยลืมพกยาไปด้วยหรือไม่?",
    "q5": "คุณได้กินยาครั้งสุดท้ายที่คุณควรกินหรือไม่?",
    "q6": "เมื่อคุณรู้สึกว่าอาการของคุณอยู่ในการควบคุม คุณเคยหยุดกินยาหรือไม่?",
    "q7": "การกินยาทุกวันเป็นเรื่องที่ไม่สะดวกจริงๆ สำหรับบางคน คุณเคยรู้สึกว่าการปฏิบัติตามแผนการรักษาของคุณยากไหม?",
    "q8": "คุณมักจะลำบากในการจำที่จะกินยาทั้งหมดของคุณบ่อยแค่ไหน?"
  },
  "tr": {
    "name": "Turkish",
    "native": "Türkçe",
    "dir": "ltr",
    "q1": "Bazen ilacınızı almayı unutuyor musunuz?",
    "q2": "İnsanlar bazen unutmanın dışında başka nedenlerle ilaçlarını almayı kaçırır. Geçen iki haftayı düşündüğünüzde, ilacınızı almadığınız zamanlar oldu mu?",
    "q3": "İlacı aldıktan sonra kendinizi daha kötü hissettiğiniz için, doktorunuza söylemeden ilacınızı azaltmaya veya bırakmaya çalıştınız mı?",
    "q4": "Seyahat ederken veya evden çıkarken bazen ilacınızı almayı unutuyor musunuz?",
    "q5": "İlacınızı almanız gerektiği son seferde aldınız mı?",
    "q6": "Semptomlarınızın kontrol altında olduğunu hissettiğinizde, bazen ilacınızı almayı bırakıyor musunuz?",
    "q7": "Her gün ilaç almak bazı insanlar için gerçek bir zorluktur. Tedavi planınıza uymak konusunda rahatsızlık hissediyor musunuz?",
    "q8": "Tüm ilaçlarınızı almayı hatırlamakta ne sıklıkla zorlanıyorsunuz?"
  },
  "uk": {
    "name": "Ukrainian",
    "native": "Українська",
    "dir": "ltr",
    "q1": "Чи іноді ви забуваєте приймати свої ліки?",
    "q2": "Люди іноді пропускають прийом ліків з інших причин, окрім забування. Думаючи про останні два тижні, чи були моменти, коли ви не приймали свої ліки?",
    "q3": "Чи зменшували ви коли-небудь дозу або припиняли прийом ліків без повідомлення лікаря, оскільки відчували себе гірше, коли їх приймали?",
    "q4": "Коли ви подорожуєте або виходите з дому, чи іноді забуваєте взяти ліки з собою?",
    "q5": "Чи приймали ви свої ліки останнього разу, коли мали їх прийняти?",
    "q6": "Коли ви відчуваєте, що ваші симптоми під контролем, чи іноді припиняєте прийом ліків?",
    "q7": "Щоденний прийом ліків є справжнім незручністю для деяких людей. Чи відчуваєте ви коли-небудь труднощі з дотриманням вашого плану лікування?",
    "q8": "Як часто вам важко пам'ятати про прийом усіх своїх ліків?"
  },
  "ur": {
    "name": "Urdu",
    "native": "اردو",
    "dir": "rtl",
    "q1": "کیا آپ کبھی کبھار اپنی دوا لینے کو بھول جاتے ہیں؟",
    "q2": "لوگ کبھی کبھار بھولنے کے علاوہ دیگر وجوہات کی بنا پر اپنی دوا لینا چھوڑ دیتے ہیں۔ گزشتہ دو ہفتوں کے بارے میں سوچتے ہوئے، کیا ایسے مواقع تھے جب آپ نے اپنی دوا نہیں لی؟",
    "q3": "کیا آپ نے کبھی اپنے ڈاکٹر کو بتائے بغیر دوا کی خوراک کم کی یا چھوڑ دی ہے کیونکہ آپ کو دوا لینے پر برا لگتا تھا؟",
    "q4": "جب آپ سفر کرتے ہیں یا گھر سے باہر جاتے ہیں، تو کیا کبھی کبھار آپ اپنی دوا لانا بھول جاتے ہیں؟",
    "q5": "کیا آپ نے آخری بار جب آپ کو دوا لینا چاہئے تھی، لی تھی؟",
    "q6": "جب آپ کو لگتا ہے کہ آپ کے علامات کنٹرول میں ہیں، تو کیا آپ کبھی کبھار دوا لینا چھوڑ دیتے ہیں؟",
    "q7": "ہر روز دوا لینا کچھ لوگوں کے لئے واقعی تکلیف دہ ہوتا ہے۔ کیا آپ کبھی اپنی علاجی منصوبہ کی پابندی کرنے میں تکلیف محسوس کرتے ہیں؟",
    "q8": "آپ کو کتنی بار تمام دوائیں لینے کی یاد رکھنے میں دشواری ہوتی ہے؟"
  },
  "vi": {
    "name": "Vietnamese",
    "native": "Tiếng Việt",
    "dir": "ltr",
    "q1": "Bạn có đôi khi quên uống thuốc không?",
    "q2": "Đôi khi mọi người bỏ lỡ uống thuốc vì những lý do khác ngoài việc quên. Nghĩ về hai tuần qua, có những lần nào bạn không uống thuốc không?",
    "q3": "Bạn đã bao giờ giảm hoặc ngừng uống thuốc mà không nói với bác sĩ, vì bạn cảm thấy tồi tệ hơn khi uống thuốc không?",
    "q4": "Khi bạn đi du lịch hoặc ra khỏi nhà, bạn có đôi khi quên mang thuốc không?",
    "q5": "Bạn đã uống thuốc lần cuối cùng khi bạn nên uống không?",
    "q6": "Khi bạn cảm thấy các triệu chứng của mình được kiểm soát, bạn có đôi khi ngừng uống thuốc không?",
    "q7": "Uống thuốc hàng ngày là một bất tiện thực sự đối với một số người. Bạn có bao giờ cảm thấy phiền toái về việc tuân thủ kế hoạch điều trị của mình không?",
    "q8": "Bạn thường gặp khó khăn bao nhiêu lần khi nhớ uống tất cả các loại thuốc của mình?"
  },
  "cy": {
    "name": "Welsh",
    "native": "Cymraeg",
    "dir": "ltr",
    "q1": "A ydych chi'n anghofio cymryd eich meddyginiaeth weithiau?",
    "q2": "Weithiau mae pobl yn colli cymryd eu meddyginiaethau am resymau heblaw anghofio. Gan feddwl am y pythefnos diwethaf, a oedd unrhyw adegau pan nad oeddech chi wedi cymryd eich meddyginiaeth?",
    "q3": "A ydych chi erioed wedi lleihau neu roi'r gorau i gymryd eich meddyginiaeth heb ddweud wrth eich meddyg, oherwydd i chi deimlo'n waeth wrth ei gymryd?",
    "q4": "Pan fyddwch chi'n teithio neu'n gadael y tŷ, ydych chi weithiau'n anghofio dod â'ch meddyginiaeth gyda chi?",
    "q5": "A wnaethoch chi gymryd eich meddyginiaeth y tro diwethaf y dylech fod wedi'i chymryd?",
    "q6": "Pan fyddwch chi'n teimlo bod eich symptomau o dan reolaeth, a ydych chi weithiau'n rhoi'r gorau i gymryd eich meddyginiaeth?",
    "q7": "Mae cymryd meddyginiaeth bob dydd yn drafferth go iawn i rai pobl. A ydych chi'n teimlo'n rhwystredig ynghylch dilyn eich cynllun triniaeth?",
    "q8": "Pa mor aml ydych chi'n cael anhawster cofio cymryd eich holl feddyginiaethau?"
  },
  "xh": {
    "name": "Xhosa",
    "native": "isiXhosa",
    "dir": "ltr",
    "q1": "Ngaba ngamanye amaxesha uyayilibala ukuthatha iyeza lakho?",
    "q2": "Abantu ngamanye amaxesha balahlekana nokuthatha iyeza labo ngenxa yezizathu ezahlukeneyo ngaphandle kokulibala. Ucinga ngeeveki ezimbini ezidlulileyo, ngaba bekukho nayiphi imizuzu apho ungazithathanga iyeza lakho?",
    "q3": "Ngaba ukhe wehlise okanye wayeka ukuthatha iyeza lakho ungaxelelanga ugqirha wakho, ngenxa yokuba uzive ungcono xa uyalithatha?",
    "q4": "Xa uhamba okanye ushiya ikhaya, ngaba ngamanye amaxesha uyayilibala ukuthatha iyeza lakho?",
    "q5": "Ngaba uthathe iyeza lakho okokugqibela xa bekufanele ukuba ulithathile?",
    "q6": "Xa uziva ukuba iimpawu zakho zilawulwa, ngaba ngamanye amaxesha uyeka ukuthatha iyeza lakho?",
    "q7": "Ukuthatha iyeza yonke imihla kunzima ngenene kwabanye abantu. Ngaba ukhe uzive kunzima ukulandela icebo lakho lonyango?",
    "q8": "Ngaba kuhlala kunzima kuwe ukukhumbula ukuthatha onke amayeza akho?"
  },
  "zu": {
    "name": "Zulu",
    "native": "isiZulu",
    "dir": "ltr",
    "q1": "Ngabe kwesinye isikhathi uyakhohlwa ukuthatha imishanguzo yakho?",
    "q2": "Abantu kwesinye isikhathi bashaya noma banqamule ukuthatha imishanguzo yabo ngenxa yezizathu ezihlukene ngaphandle kokukhohlwa. Ucabanga ngeviki ezimbili ezedlule, ngabe kube nezikhathi ongathathanga ngazo imishanguzo yakho?",
    "q3": "Wake wehlisa noma wayeka ukuthatha imishanguzo yakho ngaphandle kokutshela udokotela wakho yini, ngoba uzizwe ungcono uma uyithathile?",
    "q4": "Uma uhamba noma uphuma endlini, ngabe kwesinye isikhathi uyakhohlwa ukuthatha imishanguzo yakho?",
    "q5": "Ngabe uthathe imishanguzo yakho ngesikhathi sokugcina okufanele ukuthi uyithathe?",
    "q6": "Uma uzizwa izimpawu zakho zisematheni, ngabe kwesinye isikhathi uyayeka ukuthatha imishanguzo yakho?",
    "q7": "Ukuthatha imishanguzo nsuku zonke kuyabaphatha kabi abanye abantu. Wake wazizwa kunzima ukuhambisana nohlelo lwakho lokwelashwa yini?",
    "q8": "Ngabe kuvamile ukuthi uhlale ukhumbula ukuthatha yonke imishanguzo yakho?"
  }
};


// ── UI strings (5 languages — EN always base) ────────────────────────────────
const UI_STRINGS = {
    en: {
        dir: 'ltr',
        // consent
        consent_title:    'Informed Consent',
        consent_subtitle: 'The Adherence Project 2026 by ATLAS (Adherence Tools and Location Analytics System)',
        consent_body_html: null, // stays in HTML — too long to translate here; swap via Firebase
        consent_agree_text: 'I have read and understood the above information. I voluntarily agree to participate in this study and understand that my responses will be anonymous and used for research purposes.',
        consent_btn:      'Continue to Assessment',
        // header
        header_title:     'The Adherence Project',
        header_date:      'World Adherence Day 2026 | March 27, 2026',
        header_powered:   'Powered by ATLAS (Adherence Tools and Location Analytics System)',
        assessments_worldwide: 'Assessments Worldwide',
        // map controls
        btn_globe:         '🌍 Globe',
        btn_flat:          '🗺️ Flat',
        btn_spectator:     'Spectator Mode',
        btn_exit_spectator:'Exit Spectator Mode',
        btn_bulk_upload:   '📤 Bulk Upload',
        // stats overlay
        stats_title:       'Global Statistics',
        stat_countries:    'Countries',
        stat_participants: 'Participants',
        // insights
        insights_title:    '🔬 Global Insights',
        insight_avg:       'Global Average',
        insight_highest:   'Highest Country',
        insight_most:      'Most Submissions',
        no_data_yet:       'No data yet',
        // legend
        legend_title:      'Adherence Legend',
        legend_show:       'Show Details',
        legend_hide:       'Hide Details',
        legend_high:       'High Adherence (8.0)',
        legend_medium:     'Medium (6.0–7.9)',
        legend_low:        'Low (<6.0)',
        legend_country_breakdown: 'Country Breakdown',
        legend_no_data:    'No data yet. Submit an assessment to see statistics!',
        analytics_badge:   'Live Global Analytics',
        // section header
        section_h2:        'MMAS-8 Medication Adherence Assessment',
        section_sub:       'Complete this brief assessment to contribute to global adherence data',
        // preface
        preface_title:     'Before You Begin',
        preface_p1:        '<strong>This is not a test.</strong> There are no right or wrong answers.',
        preface_p2:        'Many people find it challenging to take their medications exactly as prescribed. You are not alone. Research shows that medication-taking patterns vary widely, and most people experience some difficulty with adherence at different times.',
        preface_p3:        '<strong>Please answer honestly.</strong> Your honest responses help us understand real-world medication-taking behaviors and identify ways to make medication regimens easier to follow.',
        preface_p4:        'All responses are completely anonymous and will be used to improve support systems for patients worldwide.',
        // score tracker
        score_progress:    'Progress',
        score_label:       'Current Score',
        score_not_started: 'Not Started',
        score_in_progress: 'In Progress',
        score_complete:    'Complete',
        // patient info
        info_title:        '📋 Patient & Medication Information',
        info_desc:         'Please provide the following information to help us understand adherence patterns across different populations.',
        label_country:     'Country',
        ph_country:        'e.g., United States',
        note_location:     'Auto-detected from your location. You can edit if incorrect.',
        label_city:        'City',
        ph_city:           'e.g., Long Beach',
        label_patient_num: 'Patient Number',
        ph_patient_num:    'e.g., Patient 001',
        note_optional_blank: 'Optional for patients. Required for Study Coordinators and PIs.',
        label_condition:   'Medical Condition Being Treated',
        ph_condition:      'e.g., Hypertension, Type 2 Diabetes, Asthma',
        note_one_condition:'Enter one condition per assessment.',
        label_drug_type:   'Drug Type',
        drug_single:       'Single API',
        drug_combo:        'Combination Therapy',
        label_drug_name:   'Drug/API Name',
        ph_drug_name:      'e.g., Metformin, Lisinopril',
        note_optional:     'Optional.',
        label_drug_strength:'Drug Strength',
        ph_drug_strength:  'e.g., 500mg, 10mg/20mg',
        label_route:       'Route of Administration',
        route_placeholder: '-- Select Route --',
        route_oral:        'Oral (Tablet/Capsule)',
        route_oral_liq:    'Oral (Liquids)',
        route_sublingual:  'Sublingual (Under tongue)',
        route_buccal:      'Buccal (Cheek)',
        route_inhalation:  'Inhalation (Inhaler)',
        route_nasal:       'Nasal (Spray/Drops)',
        route_sc:          'Injection - Subcutaneous',
        route_im:          'Injection - Intramuscular',
        route_iv:          'Injection - Intravenous',
        route_topical:     'Topical (Cream/Ointment)',
        route_transdermal: 'Transdermal (Patch)',
        route_rectal:      'Rectal (Suppository)',
        route_vaginal:     'Vaginal',
        route_ophthalmic:  'Ophthalmic (Eye drops)',
        route_otic:        'Otic (Ear drops)',
        route_other:       'Other',
        note_optional_rec: 'Optional but recommended.',
        label_gender:      'Gender',
        gender_male:       'Male',
        gender_female:     'Female',
        gender_other:      'Other/Prefer not to say',
        label_age:         'Age Range',
        age_placeholder:   '-- Select Age Range --',
        label_education:   'Highest Level of Education',
        edu_placeholder:   '-- Select Education Level --',
        edu_none:          'No formal education',
        edu_primary:       'Primary school (Elementary)',
        edu_secondary:     'Secondary school (High school)',
        edu_some_college:  'Some college/University (incomplete)',
        edu_associate:     'Associate degree / Trade school',
        edu_bachelor:      "Bachelor's degree",
        edu_master:        "Master's degree",
        edu_doctoral:      'Doctoral degree (PhD, MD, JD, etc.)',
        prefer_not:        'Prefer not to say',
        // MMAS section
        mmas_section_title:'📊 MMAS-8 Medication Adherence Assessment',
        // submit & footer
        submit_btn:        'Submit Assessment & Add to Global Map',
        submitting:        'Submitting...',
        submitted:         '✓ Submitted!',
        answer_all:        'Please answer all 8 questions before submitting.',
        footer_copy:       '© 2026 Adherence Inc.',
        // result card
        mmas_lang_note:    null,
        rc_high_headline:  'Excellent Adherence',
        rc_high_subline:   'You are taking your medication as prescribed.',
        rc_high_msg_patient:'Maintaining this level of adherence significantly improves your long-term health outcomes. Keep up the routine that is working for you.',
        rc_high_msg_clin:  'Patient demonstrates full adherence. No intervention indicated at this time.',
        rc_med_headline:   'Moderate Adherence',
        rc_med_subline:    'You are mostly on track, with some room for improvement.',
        rc_med_msg_patient:'Most people miss doses occasionally. Small adjustments to your routine can make a real difference in how well your medication works.',
        rc_med_msg_clin:   'Patient shows moderate adherence. Consider brief counseling on barrier identification.',
        rc_med_tips:       ['Try linking your medication to a daily habit — morning coffee, brushing teeth, or a phone alarm.','A weekly pill organizer can help you track whether you have taken your dose.','If side effects are a factor, speak with your doctor — alternatives are often available.'],
        rc_int_headline:   'Your Medication Routine Needs Attention',
        rc_int_subline:    'Some of your answers suggest this may feel like a choice.',
        rc_int_msg:        "It is common to stop or change medication when it feels like it is not working, causes side effects, or does not feel necessary. These are real and valid concerns — and your prescriber needs to know about them so they can help.",
        rc_int_ref_label:  'Talk to Your Doctor or Pharmacist',
        rc_int_ref_text:   'A brief conversation with your prescriber can address side effects, adjust your dosage, or explore alternatives. You should not have to manage this alone.',
        rc_unint_headline: 'Your Medication Routine Needs Some Support',
        rc_unint_subline:  'Forgetting doses is more common than you might think.',
        rc_unint_msg:      'Missing medication is rarely about not caring — it is usually about the difficulty of building any new habit into a busy life. These practical steps help most people.',
        rc_unint_tips:     ['Set a daily phone alarm at the time you are most reliably home and settled.','Keep your medication visible — next to your toothbrush, your coffee maker, or your keys.','A weekly pill organizer removes the uncertainty of whether you already took your dose.','Ask your pharmacist if a once-daily formulation is available for your medication.'],
        rc_mixed_headline: 'Your Medication Routine Has Room to Grow',
        rc_mixed_subline:  'A mix of factors is affecting your adherence.',
        rc_mixed_msg:      'Your answers suggest both some practical barriers and some uncertainty about your medication. Both are worth addressing — and both are very common.',
        rc_mixed_tips:     ['A daily alarm or pill organizer can help with the days you simply forget.','If you have doubts about your medication — side effects, cost, or whether it is working — write them down and bring them to your next appointment.'],
        rc_mixed_ref_label:'A Conversation With Your Prescriber Could Help',
        rc_mixed_ref_text: 'Your doctor can address concerns about your medication and work with you on a plan that fits your life.',
        rc_clin_int:       'Intentional non-adherence dominant — referral recommended.',
        rc_clin_unint:     'Unintentional non-adherence dominant — behavioral strategies indicated.',
        rc_clin_mixed:     'Mixed adherence pattern — comprehensive adherence consultation recommended.',
        rc_global_tag:     'Your response has been added to the global map',
        rc_compare_title:  'How You Compare Globally',
        rc_compare_yours:  'Your Score',
        rc_compare_global: 'Global Avg',
        rc_done:           'Done',
        rc_steps_title:    'Practical Steps',
        // welcome modal (role selection)
        welcome_title:     'Welcome to ATLAS',
        welcome_subtitle:  "How are you using the ATLAS platform today?\nYour role determines what data you can submit and view.",
        role_patient:      'Patient',
        role_patient_desc: 'Taking the MMAS-8 for your own medication tracking and awareness.',
        role_patient_badge:'Personal Use',
        role_researcher:   'Study Coordinator',
        role_researcher_desc:'Collecting MMAS-8 assessments on behalf of patients. Enter a Study ID to group your submissions under a PI or program.',
        role_researcher_badge:'Study Collection',
        role_institution:  'Principal Investigator / Institution',
        role_institution_desc:'Overseeing a study or program. Enter your PI code to access cohort analytics, individual INA/UNA records, and team management.',
        role_institution_badge:'PI / Institutional',
        role_footer:       'Your selection is saved for this session only and does not affect your data.',
        banner_patient_title:   'Personal Assessment Mode',
        banner_patient_msg:     'Complete the 8 questions below and see where your adherence places you on the global map.',
        banner_researcher_title:'Study Coordinator Mode',
        banner_researcher_msg:  'Patient metadata, bulk upload, and data export enabled. Enter a Study ID to link submissions to your PI.',
        inst_title:        'PI / Institution Access',
        inst_subtitle:     'Enter your PI or institution code to unlock cohort analytics and individual patient INA/UNA records.',
        inst_placeholder:  'Enter access code',
        inst_verify:       'Verify Code',
        inst_back:         '← Back to role selection',
        inst_granted:      '✓ Access Granted',
        inst_error:        'Code not recognized. Please check and try again, or contact Adherence Inc.',
        // Study ID field
        label_study_id:    'Study ID',
        ph_study_id:       'e.g., UCLA-PHARM-2026',
        note_study_id:     'Enter the Study ID provided by your PI to group your submissions under their program.',
        // PI dashboard
        pi_individual_records: 'Individual Patient Records',
        pi_col_patient:    'Patient #',
        pi_col_score:      'Score',
        pi_col_pattern:    'Pattern',
        pi_col_country:    'Country',
        pi_col_date:       'Date',
        pi_col_coordinator:'Coordinator',
        pi_ina_label:      'Intentional',
        pi_una_label:      'Unintentional',
        pi_mixed_label:    'Mixed',
        pi_high_label:     'High',
        pi_no_records:     'No individual records yet. Records appear here as Study Coordinators submit assessments under your PI code.',
        pi_export_cohort:  '📥 Export Cohort CSV',
        pi_exit:           'Exit PI View',
    },

    es: {
        dir: 'ltr',
        consent_title:    'Consentimiento Informado',
        consent_subtitle: 'El Proyecto de Adherencia 2026 por ATLAS (Sistema de Herramientas de Adherencia y Análisis de Ubicación)',
        consent_agree_text: 'He leído y comprendido la información anterior. Acepto voluntariamente participar en este estudio y entiendo que mis respuestas serán anónimas y utilizadas con fines de investigación.',
        consent_btn:      'Continuar a la Evaluación',
        header_title:     'El Proyecto de Adherencia',
        header_date:      'Día Mundial de la Adherencia 2026 | 27 de marzo de 2026',
        header_powered:   'Impulsado por ATLAS (Sistema de Herramientas de Adherencia y Análisis de Ubicación)',
        assessments_worldwide: 'Evaluaciones en Todo el Mundo',
        btn_globe:         '🌍 Globo',
        btn_flat:          '🗺️ Plano',
        btn_spectator:     'Modo Espectador',
        btn_exit_spectator:'Salir del Modo Espectador',
        btn_bulk_upload:   '📤 Carga Masiva',
        stats_title:       'Estadísticas Globales',
        stat_countries:    'Países',
        stat_participants: 'Participantes',
        insights_title:    '🔬 Perspectivas Globales',
        insight_avg:       'Promedio Global',
        insight_highest:   'País más Alto',
        insight_most:      'Más Envíos',
        no_data_yet:       'Sin datos aún',
        legend_title:      'Leyenda de Adherencia',
        legend_show:       'Mostrar Detalles',
        legend_hide:       'Ocultar Detalles',
        legend_high:       'Alta Adherencia (8.0)',
        legend_medium:     'Media (6.0–7.9)',
        legend_low:        'Baja (<6.0)',
        legend_country_breakdown: 'Desglose por País',
        legend_no_data:    '¡Sin datos aún. Envíe una evaluación para ver estadísticas!',
        analytics_badge:   'Análisis Global en Vivo',
        section_h2:        'Evaluación de Adherencia a la Medicación MMAS-8',
        section_sub:       'Complete esta breve evaluación para contribuir a los datos globales de adherencia',
        preface_title:     'Antes de Comenzar',
        preface_p1:        '<strong>Esto no es una prueba.</strong> No hay respuestas correctas o incorrectas.',
        preface_p2:        'Muchas personas encuentran difícil tomar sus medicamentos exactamente como se les prescribe. No está solo. La investigación muestra que los patrones de toma de medicamentos varían ampliamente.',
        preface_p3:        '<strong>Por favor responda honestamente.</strong> Sus respuestas honestas nos ayudan a comprender los comportamientos reales de toma de medicamentos.',
        preface_p4:        'Todas las respuestas son completamente anónimas y se utilizarán para mejorar los sistemas de apoyo para pacientes en todo el mundo.',
        score_progress:    'Progreso',
        score_label:       'Puntuación Actual',
        score_not_started: 'No Iniciado',
        score_in_progress: 'En Progreso',
        score_complete:    'Completo',
        info_title:        '📋 Información del Paciente y Medicación',
        info_desc:         'Proporcione la siguiente información para ayudarnos a comprender los patrones de adherencia en diferentes poblaciones.',
        label_country:     'País',
        ph_country:        'p.ej., México',
        note_location:     'Detectado automáticamente desde su ubicación. Puede editar si es incorrecto.',
        label_city:        'Ciudad',
        ph_city:           'p.ej., Ciudad de México',
        label_patient_num: 'Número de Paciente (Para Investigadores)',
        ph_patient_num:    'p.ej., Paciente 001',
        note_optional_blank: 'Opcional. Dejar en blanco si es usuario individual.',
        label_condition:   'Condición Médica en Tratamiento',
        ph_condition:      'p.ej., Hipertensión, Diabetes Tipo 2, Asma',
        note_one_condition:'Ingrese una condición por evaluación.',
        label_drug_type:   'Tipo de Medicamento',
        drug_single:       'API Único',
        drug_combo:        'Terapia Combinada',
        label_drug_name:   'Nombre del Medicamento/API',
        ph_drug_name:      'p.ej., Metformina, Lisinopril',
        note_optional:     'Opcional.',
        label_drug_strength:'Concentración del Medicamento',
        ph_drug_strength:  'p.ej., 500mg, 10mg/20mg',
        label_route:       'Vía de Administración',
        route_placeholder: '-- Seleccionar Vía --',
        route_oral:        'Oral (Tableta/Cápsula)',
        route_oral_liq:    'Oral (Líquidos)',
        route_sublingual:  'Sublingual (Bajo la lengua)',
        route_buccal:      'Bucal (Mejilla)',
        route_inhalation:  'Inhalación (Inhalador)',
        route_nasal:       'Nasal (Spray/Gotas)',
        route_sc:          'Inyección - Subcutánea',
        route_im:          'Inyección - Intramuscular',
        route_iv:          'Inyección - Intravenosa',
        route_topical:     'Tópico (Crema/Ungüento)',
        route_transdermal: 'Transdérmico (Parche)',
        route_rectal:      'Rectal (Supositorio)',
        route_vaginal:     'Vaginal',
        route_ophthalmic:  'Oftálmico (Colirio)',
        route_otic:        'Ótico (Gotas para oídos)',
        route_other:       'Otro',
        note_optional_rec: 'Opcional pero recomendado.',
        label_gender:      'Género',
        gender_male:       'Masculino',
        gender_female:     'Femenino',
        gender_other:      'Otro/Prefiero no decir',
        label_age:         'Rango de Edad',
        age_placeholder:   '-- Seleccionar Rango de Edad --',
        label_education:   'Nivel Educativo más Alto',
        edu_placeholder:   '-- Seleccionar Nivel Educativo --',
        edu_none:          'Sin educación formal',
        edu_primary:       'Primaria (Educación básica)',
        edu_secondary:     'Secundaria/Preparatoria',
        edu_some_college:  'Algo de universidad (incompleta)',
        edu_associate:     'Técnico/Escuela de oficios',
        edu_bachelor:      'Licenciatura',
        edu_master:        'Maestría',
        edu_doctoral:      'Doctorado (PhD, MD, JD, etc.)',
        prefer_not:        'Prefiero no decir',
        mmas_section_title:'📊 Evaluación de Adherencia a la Medicación MMAS-8',
        submit_btn:        'Enviar Evaluación y Añadir al Mapa Global',
        submitting:        'Enviando...',
        submitted:         '✓ ¡Enviado!',
        answer_all:        'Por favor responda las 8 preguntas antes de enviar.',
        footer_copy:       '© 2026 Adherence Inc.',
        mmas_lang_note:    null,
        rc_high_headline:  'Excelente Adherencia',
        rc_high_subline:   'Está tomando su medicación según lo prescrito.',
        rc_high_msg_patient:'Mantener este nivel de adherencia mejora significativamente sus resultados de salud a largo plazo.',
        rc_high_msg_clin:  'El paciente demuestra adherencia total. No se indica intervención en este momento.',
        rc_med_headline:   'Adherencia Moderada',
        rc_med_subline:    'Está mayormente en camino, con algo de margen para mejorar.',
        rc_med_msg_patient:'La mayoría de las personas olvidan dosis ocasionalmente. Pequeños ajustes pueden hacer una gran diferencia.',
        rc_med_msg_clin:   'El paciente muestra adherencia moderada. Considere una breve orientación.',
        rc_med_tips:       ['Intente vincular su medicación a un hábito diario.','Un organizador de pastillas semanal puede ayudarle.','Si los efectos secundarios son un factor, hable con su médico.'],
        rc_int_headline:   'Su Rutina de Medicación Necesita Atención',
        rc_int_subline:    'Algunas respuestas sugieren que esto puede sentirse como una elección.',
        rc_int_msg:        'Es común dejar o cambiar la medicación cuando no parece funcionar o causa efectos secundarios. Estas son preocupaciones válidas — su médico necesita saberlo.',
        rc_int_ref_label:  'Hable con su Médico o Farmacéutico',
        rc_int_ref_text:   'Una breve conversación puede abordar efectos secundarios, ajustar la dosis o explorar alternativas.',
        rc_unint_headline: 'Su Rutina de Medicación Necesita Apoyo',
        rc_unint_subline:  'Olvidar dosis es más común de lo que cree.',
        rc_unint_msg:      'Olvidar la medicación rara vez es por no importar — generalmente es por la dificultad de construir nuevos hábitos.',
        rc_unint_tips:     ['Configure una alarma diaria.','Mantenga su medicación visible.','Un organizador de pastillas semanal elimina la incertidumbre.','Pregunte si hay una formulación de dosis única diaria.'],
        rc_mixed_headline: 'Su Rutina de Medicación Tiene Margen de Mejora',
        rc_mixed_subline:  'Una combinación de factores está afectando su adherencia.',
        rc_mixed_msg:      'Sus respuestas sugieren tanto barreras prácticas como incertidumbre sobre su medicación.',
        rc_mixed_tips:     ['Una alarma diaria puede ayudar.','Si tiene dudas, anótelas y llévelas a su próxima cita.'],
        rc_mixed_ref_label:'Una Conversación con su Médico Podría Ayudar',
        rc_mixed_ref_text: 'Su médico puede abordar sus preocupaciones y trabajar con usted en un plan.',
        rc_clin_int:       'No adherencia intencional dominante — derivación recomendada.',
        rc_clin_unint:     'No adherencia no intencional dominante — estrategias conductuales indicadas.',
        rc_clin_mixed:     'Patrón mixto — consulta integral recomendada.',
        rc_global_tag:     'Su respuesta ha sido añadida al mapa global',
        rc_compare_title:  'Cómo se Compara Globalmente',
        rc_compare_yours:  'Su Puntuación',
        rc_compare_global: 'Promedio Global',
        rc_done:           'Listo',
        rc_steps_title:    'Pasos Prácticos',
        welcome_title:     'Bienvenido a ATLAS',
        welcome_subtitle:  "¿Cómo está utilizando la plataforma hoy?\nAdaptaremos su experiencia en consecuencia.",
        role_patient:      'Paciente',
        role_patient_desc: 'Realizando el MMAS-8 para su propio seguimiento de adherencia.',
        role_patient_badge:'Uso Personal',
        role_researcher:   'Coordinador de Estudio',
        role_researcher_desc:'Recopilando evaluaciones MMAS-8 en nombre de pacientes. Ingrese un ID de estudio para agrupar sus envíos.',
        role_researcher_badge:'Recolección de Estudio',
        role_institution:  'Investigador Principal / Institución',
        role_institution_desc:'Supervisando un estudio o programa. Ingrese su código PI para acceder a análisis de cohorte y registros INA/UNA individuales.',
        role_institution_badge:'PI / Institucional',
        role_footer:       'Su selección se guarda solo para esta sesión y no afecta sus datos.',
        banner_patient_title:   'Modo de Evaluación Personal',
        banner_patient_msg:     'Complete las 8 preguntas y vea dónde se encuentra en el mapa global.',
        banner_researcher_title:'Modo Coordinador de Estudio',
        banner_researcher_msg:  'Metadatos de pacientes, carga masiva y exportación habilitados. Ingrese un ID de estudio para vincular envíos a su PI.',
        inst_title:        'Acceso PI / Institucional',
        inst_subtitle:     'Ingrese su código PI o institucional para desbloquear análisis de cohorte y registros individuales INA/UNA.',
        inst_placeholder:  'Ingrese el código de acceso',
        inst_verify:       'Verificar Código',
        inst_back:         '← Volver a la selección de rol',
        inst_granted:      '✓ Acceso Concedido',
        inst_error:        'Código no reconocido. Por favor verifique e intente de nuevo.',
        label_study_id:    'ID de Estudio',
        ph_study_id:       'ej., UCLA-FARM-2026',
        note_study_id:     'Ingrese el ID de estudio proporcionado por su IP para agrupar sus envíos.',
        pi_individual_records: 'Registros Individuales de Pacientes',
        pi_col_patient:    'Paciente #', pi_col_score: 'Puntuación', pi_col_pattern: 'Patrón',
        pi_col_country:    'País', pi_col_date: 'Fecha', pi_col_coordinator: 'Coordinador',
        pi_ina_label: 'Intencional', pi_una_label: 'No Intencional', pi_mixed_label: 'Mixto',
        pi_high_label: 'Alto', pi_no_records: 'Sin registros individuales aún.',
        pi_export_cohort: '📥 Exportar CSV de Cohorte', pi_exit: 'Salir de Vista PI',
    },

    fr: {
        dir: 'ltr',
        consent_title:    'Consentement Éclairé',
        consent_subtitle: "Le Projet d'Adhérence 2026 par ATLAS (Système d'Outils d'Adhérence et d'Analyse de Localisation)",
        consent_agree_text: "J'ai lu et compris les informations ci-dessus. J'accepte volontairement de participer à cette étude et je comprends que mes réponses seront anonymes et utilisées à des fins de recherche.",
        consent_btn:      "Continuer vers l'Évaluation",
        header_title:     "Le Projet d'Adhérence",
        header_date:      "Journée Mondiale de l'Adhérence 2026 | 27 mars 2026",
        header_powered:   "Propulsé par ATLAS (Système d'Outils d'Adhérence et d'Analyse de Localisation)",
        assessments_worldwide: 'Évaluations dans le Monde',
        btn_globe:         '🌍 Globe',
        btn_flat:          '🗺️ Plat',
        btn_spectator:     'Mode Spectateur',
        btn_exit_spectator:'Quitter le Mode Spectateur',
        btn_bulk_upload:   '📤 Import en Masse',
        stats_title:       'Statistiques Mondiales',
        stat_countries:    'Pays',
        stat_participants: 'Participants',
        insights_title:    '🔬 Perspectives Mondiales',
        insight_avg:       'Moyenne Mondiale',
        insight_highest:   'Pays le Plus Élevé',
        insight_most:      'Plus de Soumissions',
        no_data_yet:       'Pas encore de données',
        legend_title:      "Légende d'Adhérence",
        legend_show:       'Afficher les Détails',
        legend_hide:       'Masquer les Détails',
        legend_high:       'Haute Adhérence (8.0)',
        legend_medium:     'Moyenne (6.0–7.9)',
        legend_low:        'Faible (<6.0)',
        legend_country_breakdown: 'Répartition par Pays',
        legend_no_data:    'Pas encore de données. Soumettez une évaluation pour voir les statistiques!',
        analytics_badge:   'Analyses Mondiales en Direct',
        section_h2:        "Évaluation d'Adhérence aux Médicaments MMAS-8",
        section_sub:       "Complétez cette brève évaluation pour contribuer aux données mondiales d'adhérence",
        preface_title:     'Avant de Commencer',
        preface_p1:        "<strong>Ce n'est pas un test.</strong> Il n'y a pas de bonnes ou mauvaises réponses.",
        preface_p2:        "De nombreuses personnes trouvent difficile de prendre leurs médicaments exactement comme prescrit. Vous n'êtes pas seul. La recherche montre que les habitudes de prise de médicaments varient considérablement.",
        preface_p3:        '<strong>Veuillez répondre honnêtement.</strong> Vos réponses honnêtes nous aident à comprendre les comportements réels de prise de médicaments.',
        preface_p4:        'Toutes les réponses sont complètement anonymes et seront utilisées pour améliorer les systèmes de soutien aux patients dans le monde entier.',
        score_progress:    'Progression',
        score_label:       'Score Actuel',
        score_not_started: 'Non Commencé',
        score_in_progress: 'En Cours',
        score_complete:    'Terminé',
        info_title:        '📋 Informations sur le Patient et le Médicament',
        info_desc:         "Veuillez fournir les informations suivantes pour nous aider à comprendre les schémas d'adhérence dans différentes populations.",
        label_country:     'Pays',
        ph_country:        'ex., France',
        note_location:     'Détecté automatiquement depuis votre emplacement. Vous pouvez modifier si incorrect.',
        label_city:        'Ville',
        ph_city:           'ex., Paris',
        label_patient_num: 'Numéro de Patient (Pour les Chercheurs)',
        ph_patient_num:    'ex., Patient 001',
        note_optional_blank: 'Facultatif. Laisser vide si utilisateur individuel.',
        label_condition:   'Condition Médicale Traitée',
        ph_condition:      'ex., Hypertension, Diabète de Type 2, Asthme',
        note_one_condition:'Entrez une condition par évaluation.',
        label_drug_type:   'Type de Médicament',
        drug_single:       'API Unique',
        drug_combo:        'Thérapie Combinée',
        label_drug_name:   'Nom du Médicament/API',
        ph_drug_name:      'ex., Metformine, Lisinopril',
        note_optional:     'Facultatif.',
        label_drug_strength:'Dosage du Médicament',
        ph_drug_strength:  'ex., 500mg, 10mg/20mg',
        label_route:       "Voie d'Administration",
        route_placeholder: '-- Sélectionner la Voie --',
        route_oral:        'Orale (Comprimé/Gélule)',
        route_oral_liq:    'Orale (Liquides)',
        route_sublingual:  'Sublinguale (Sous la langue)',
        route_buccal:      'Buccale (Joue)',
        route_inhalation:  'Inhalation (Inhalateur)',
        route_nasal:       'Nasale (Spray/Gouttes)',
        route_sc:          'Injection - Sous-cutanée',
        route_im:          'Injection - Intramusculaire',
        route_iv:          'Injection - Intraveineuse',
        route_topical:     'Topique (Crème/Pommade)',
        route_transdermal: 'Transdermique (Patch)',
        route_rectal:      'Rectale (Suppositoire)',
        route_vaginal:     'Vaginale',
        route_ophthalmic:  'Ophtalmique (Gouttes oculaires)',
        route_otic:        'Otique (Gouttes auriculaires)',
        route_other:       'Autre',
        note_optional_rec: 'Facultatif mais recommandé.',
        label_gender:      'Sexe',
        gender_male:       'Masculin',
        gender_female:     'Féminin',
        gender_other:      'Autre/Préfère ne pas dire',
        label_age:         "Tranche d'Âge",
        age_placeholder:   "-- Sélectionner la Tranche d'Âge --",
        label_education:   "Niveau d'Éducation le Plus Élevé",
        edu_placeholder:   "-- Sélectionner le Niveau d'Éducation --",
        edu_none:          'Aucune éducation formelle',
        edu_primary:       'École primaire',
        edu_secondary:     'École secondaire (Lycée)',
        edu_some_college:  'Quelques études universitaires (incomplet)',
        edu_associate:     'BTS / École professionnelle',
        edu_bachelor:      'Licence',
        edu_master:        'Master',
        edu_doctoral:      'Doctorat (PhD, MD, JD, etc.)',
        prefer_not:        'Préfère ne pas dire',
        mmas_section_title:"📊 Évaluation d'Adhérence aux Médicaments MMAS-8",
        submit_btn:        "Soumettre l'Évaluation et Ajouter à la Carte Mondiale",
        submitting:        'Envoi en cours...',
        submitted:         '✓ Soumis!',
        answer_all:        'Veuillez répondre aux 8 questions avant de soumettre.',
        footer_copy:       '© 2026 Adherence Inc.',
        mmas_lang_note:    null,
        rc_high_headline:  'Excellente Adhérence',
        rc_high_subline:   'Vous prenez vos médicaments comme prescrit.',
        rc_high_msg_patient:"Maintenir ce niveau d'adhérence améliore significativement vos résultats de santé.",
        rc_high_msg_clin:  "Le patient démontre une adhérence totale.",
        rc_med_headline:   'Adhérence Modérée',
        rc_med_subline:    'Vous êtes globalement sur la bonne voie.',
        rc_med_msg_patient:'La plupart des gens oublient des doses occasionnellement. De petits ajustements peuvent faire une grande différence.',
        rc_med_msg_clin:   "Le patient montre une adhérence modérée.",
        rc_med_tips:       ["Associez votre médicament à une habitude quotidienne.",'Un pilulier hebdomadaire peut vous aider.',"Parlez des effets secondaires à votre médecin."],
        rc_int_headline:   'Votre Routine Médicamenteuse Nécessite Attention',
        rc_int_subline:    'Certaines réponses suggèrent que cela peut sembler être un choix.',
        rc_int_msg:        "Il est courant d'arrêter un médicament quand il semble inefficace. Ces préoccupations sont valides — votre médecin doit en être informé.",
        rc_int_ref_label:  'Parlez à Votre Médecin ou Pharmacien',
        rc_int_ref_text:   'Une brève conversation peut aborder les effets secondaires ou explorer des alternatives.',
        rc_unint_headline: 'Votre Routine Nécessite du Soutien',
        rc_unint_subline:  "Oublier des doses est plus courant qu'on ne le pense.",
        rc_unint_msg:      "Oublier ses médicaments est rarement par manque d'attention.",
        rc_unint_tips:     ['Configurez une alarme quotidienne.','Gardez vos médicaments visibles.','Un pilulier hebdomadaire élimine le doute.','Demandez une formulation de dose unique si disponible.'],
        rc_mixed_headline: 'Votre Routine a de la Marge de Progression',
        rc_mixed_subline:  'Une combinaison de facteurs affecte votre adhérence.',
        rc_mixed_msg:      'Vos réponses suggèrent à la fois des obstacles pratiques et une incertitude.',
        rc_mixed_tips:     ['Une alarme quotidienne peut aider.','Notez vos doutes et apportez-les à votre prochain rendez-vous.'],
        rc_mixed_ref_label:'Une Conversation Avec Votre Médecin Pourrait Aider',
        rc_mixed_ref_text: 'Votre médecin peut aborder vos préoccupations et travailler avec vous.',
        rc_clin_int:       'Non-adhérence intentionnelle dominante — référence recommandée.',
        rc_clin_unint:     'Non-adhérence non intentionnelle dominante — stratégies comportementales.',
        rc_clin_mixed:     "Schéma mixte — consultation globale recommandée.",
        rc_global_tag:     'Votre réponse a été ajoutée à la carte mondiale',
        rc_compare_title:  "Comment Vous Comparez Mondialement",
        rc_compare_yours:  'Votre Score',
        rc_compare_global: 'Moyenne Mondiale',
        rc_done:           'Terminé',
        rc_steps_title:    'Étapes Pratiques',
        welcome_title:     'Bienvenue sur ATLAS',
        welcome_subtitle:  "Comment utilisez-vous la plateforme aujourd'hui?\nNous adapterons votre expérience.",
        role_patient:      'Patient',
        role_patient_desc: "Effectuant le MMAS-8 pour votre propre suivi d'adhérence.",
        role_patient_badge:'Usage Personnel',
        role_researcher:   "Coordinateur d'Étude",
        role_researcher_desc:"Administration d'évaluations ou conduite d'une étude clinique.",
        role_researcher_badge:"Collecte d'Étude",
        role_institution:  'Principal Investigator / Institution',
        role_institution_desc:"Gestion d'une cohorte ou utilisation d'un code d'accès institutionnel.",
        role_institution_badge:'PI / Institutionnel',
        role_footer:       "Votre sélection est enregistrée pour cette session uniquement.",
        banner_patient_title:   "Mode Évaluation Personnelle",
        banner_patient_msg:     "Répondez aux 8 questions et voyez où vous vous situez sur la carte mondiale.",
        banner_researcher_title:"Mode Coordinateur d'Étude",
        banner_researcher_msg:  "Accès complet à tous les outils et à l'exportation des données.",
        inst_title:        'Accès PI / Institutionnel',
        inst_subtitle:     "Entrez votre code pour accéder au tableau de bord de cohorte.",
        inst_placeholder:  "Entrez le code d'accès",
        inst_verify:       "Vérifier le Code",
        inst_back:         "← Retour à la sélection du rôle",
        inst_granted:      "✓ Accès Accordé",
        inst_error:        'Code non reconnu. Veuillez vérifier et réessayer.',
        label_study_id:    "ID d'Étude",
        ph_study_id:       'ex., UCLA-PHARM-2026',
        note_study_id:     "Entrez l'ID d'étude fourni par votre IP pour regrouper vos soumissions.",
        pi_individual_records: 'Dossiers Individuels des Patients',
        pi_col_patient: 'Patient #', pi_col_score: 'Score', pi_col_pattern: 'Schéma',
        pi_col_country: 'Pays', pi_col_date: 'Date', pi_col_coordinator: 'Coordinateur',
        pi_ina_label: 'Intentionnel', pi_una_label: 'Non Intentionnel', pi_mixed_label: 'Mixte',
        pi_high_label: 'Élevé', pi_no_records: "Aucun enregistrement individuel pour l'instant.",
        pi_export_cohort: '📥 Exporter CSV Cohorte', pi_exit: 'Quitter Vue PI',
    },

    ar: {
        dir: 'rtl',
        consent_title:    'موافقة مستنيرة',
        consent_subtitle: 'مشروع الالتزام 2026 بواسطة ATLAS (نظام أدوات الالتزام وتحليل المواقع)',
        consent_agree_text: 'لقد قرأت وفهمت المعلومات أعلاه. أوافق طوعاً على المشاركة في هذه الدراسة وأفهم أن ردودي ستكون مجهولة الهوية وستُستخدم لأغراض البحث العلمي.',
        consent_btn:      'المتابعة إلى التقييم',
        header_title:     'مشروع الالتزام',
        header_date:      'اليوم العالمي للالتزام الدوائي 2026 | 27 مارس 2026',
        header_powered:   'مدعوم بـ ATLAS (نظام أدوات الالتزام وتحليل المواقع)',
        assessments_worldwide: 'تقييمات حول العالم',
        btn_globe:         '🌍 كرة أرضية',
        btn_flat:          '🗺️ خريطة مسطحة',
        btn_spectator:     'وضع المتفرج',
        btn_exit_spectator:'الخروج من وضع المتفرج',
        btn_bulk_upload:   '📤 تحميل جماعي',
        stats_title:       'إحصائيات عالمية',
        stat_countries:    'الدول',
        stat_participants: 'المشاركون',
        insights_title:    '🔬 رؤى عالمية',
        insight_avg:       'المتوسط العالمي',
        insight_highest:   'أعلى دولة',
        insight_most:      'أكثر المشاركين',
        no_data_yet:       'لا توجد بيانات بعد',
        legend_title:      'مفتاح الالتزام',
        legend_show:       'عرض التفاصيل',
        legend_hide:       'إخفاء التفاصيل',
        legend_high:       'التزام عالٍ (8.0)',
        legend_medium:     'متوسط (6.0–7.9)',
        legend_low:        'منخفض (<6.0)',
        legend_country_breakdown: 'تفصيل حسب الدولة',
        legend_no_data:    'لا توجد بيانات بعد. أرسل تقييماً لرؤية الإحصائيات!',
        analytics_badge:   'تحليلات عالمية مباشرة',
        section_h2:        'تقييم الالتزام الدوائي MMAS-8',
        section_sub:       'أكمل هذا التقييم الموجز للمساهمة في بيانات الالتزام العالمية',
        preface_title:     'قبل البدء',
        preface_p1:        '<strong>هذا ليس اختباراً.</strong> لا توجد إجابات صحيحة أو خاطئة.',
        preface_p2:        'يجد كثير من الناس صعوبة في تناول أدويتهم تماماً كما وُصفت. أنت لست وحدك. تُظهر الأبحاث أن أنماط تناول الأدوية تتفاوت على نطاق واسع.',
        preface_p3:        '<strong>يرجى الإجابة بصدق.</strong> تساعدنا إجاباتك الصادقة على فهم سلوكيات تناول الأدوية في الواقع العملي.',
        preface_p4:        'جميع الردود مجهولة الهوية تماماً وستُستخدم لتحسين أنظمة الدعم للمرضى في جميع أنحاء العالم.',
        score_progress:    'التقدم',
        score_label:       'النتيجة الحالية',
        score_not_started: 'لم يبدأ',
        score_in_progress: 'قيد التنفيذ',
        score_complete:    'مكتمل',
        info_title:        '📋 معلومات المريض والدواء',
        info_desc:         'يرجى تقديم المعلومات التالية لمساعدتنا على فهم أنماط الالتزام عبر مختلف الفئات السكانية.',
        label_country:     'الدولة',
        ph_country:        'مثال: المملكة العربية السعودية',
        note_location:     'تم الاكتشاف تلقائياً من موقعك. يمكنك التعديل إذا كان غير صحيح.',
        label_city:        'المدينة',
        ph_city:           'مثال: الرياض',
        label_patient_num: 'رقم المريض (للباحثين)',
        ph_patient_num:    'مثال: مريض 001',
        note_optional_blank: 'اختياري. اتركه فارغاً إذا كنت مستخدماً فردياً.',
        label_condition:   'الحالة الطبية قيد العلاج',
        ph_condition:      'مثال: ارتفاع ضغط الدم، السكري من النوع الثاني، الربو',
        note_one_condition:'أدخل حالة واحدة لكل تقييم.',
        label_drug_type:   'نوع الدواء',
        drug_single:       'مادة فعالة واحدة',
        drug_combo:        'علاج مركب',
        label_drug_name:   'اسم الدواء/المادة الفعالة',
        ph_drug_name:      'مثال: ميتفورمين، ليزينوبريل',
        note_optional:     'اختياري.',
        label_drug_strength:'تركيز الدواء',
        ph_drug_strength:  'مثال: 500 ملغ، 10 ملغ/20 ملغ',
        label_route:       'طريقة الإعطاء',
        route_placeholder: '-- اختر طريقة الإعطاء --',
        route_oral:        'فموي (قرص/كبسولة)',
        route_oral_liq:    'فموي (سائل)',
        route_sublingual:  'تحت اللسان',
        route_buccal:      'فموي (الخد)',
        route_inhalation:  'استنشاق (بخاخ)',
        route_nasal:       'أنفي (بخاخ/قطرات)',
        route_sc:          'حقن - تحت الجلد',
        route_im:          'حقن - عضلي',
        route_iv:          'حقن - وريدي',
        route_topical:     'موضعي (كريم/مرهم)',
        route_transdermal: 'عبر الجلد (لصقة)',
        route_rectal:      'شرجي (تحميلة)',
        route_vaginal:     'مهبلي',
        route_ophthalmic:  'للعين (قطرات عينية)',
        route_otic:        'للأذن (قطرات أذنية)',
        route_other:       'أخرى',
        note_optional_rec: 'اختياري ولكن موصى به.',
        label_gender:      'الجنس',
        gender_male:       'ذكر',
        gender_female:     'أنثى',
        gender_other:      'آخر/أفضل عدم الإفصاح',
        label_age:         'الفئة العمرية',
        age_placeholder:   '-- اختر الفئة العمرية --',
        label_education:   'أعلى مستوى تعليمي',
        edu_placeholder:   '-- اختر المستوى التعليمي --',
        edu_none:          'بدون تعليم رسمي',
        edu_primary:       'المرحلة الابتدائية',
        edu_secondary:     'المرحلة الثانوية',
        edu_some_college:  'بعض الدراسة الجامعية (غير مكتملة)',
        edu_associate:     'دبلوم / مدرسة مهنية',
        edu_bachelor:      'بكالوريوس',
        edu_master:        'ماجستير',
        edu_doctoral:      'دكتوراه (PhD, MD, JD, إلخ)',
        prefer_not:        'أفضل عدم الإفصاح',
        mmas_section_title:'📊 تقييم الالتزام الدوائي MMAS-8',
        submit_btn:        'إرسال التقييم وإضافته إلى الخريطة العالمية',
        submitting:        'جاري الإرسال...',
        submitted:         '✓ تم الإرسال!',
        answer_all:        'يرجى الإجابة على جميع الأسئلة الثمانية قبل الإرسال.',
        footer_copy:       '© 2026 Adherence Inc.',
        mmas_lang_note:    null,
        rc_high_headline:  'التزام ممتاز',
        rc_high_subline:   'أنت تتناول دواءك وفقاً للوصفة الطبية.',
        rc_high_msg_patient:'الحفاظ على هذا المستوى يحسن نتائجك الصحية على المدى البعيد.',
        rc_high_msg_clin:  'يُظهر المريض التزاماً كاملاً.',
        rc_med_headline:   'التزام معتدل',
        rc_med_subline:    'أنت في المسار الصحيح في معظم الأوقات.',
        rc_med_msg_patient:'معظم الناس يفوتون جرعات أحياناً. تعديلات صغيرة يمكن أن تحدث فرقاً.',
        rc_med_msg_clin:   'يُظهر المريض التزاماً معتدلاً.',
        rc_med_tips:       ['حاول ربط دوائك بعادة يومية.','منظم الحبوب الأسبوعي يساعدك.','إذا كانت الآثار الجانبية مشكلة، تحدث مع طبيبك.'],
        rc_int_headline:   'روتين الدواء الخاص بك يحتاج إلى انتباه',
        rc_int_subline:    'بعض إجاباتك تشير إلى أن هذا قد يبدو كاختيار.',
        rc_int_msg:        'من الشائع إيقاف الدواء عندما يبدو غير فعال. هذه مخاوف حقيقية — طبيبك بحاجة إلى معرفتها.',
        rc_int_ref_label:  'تحدث مع طبيبك أو الصيدلاني',
        rc_int_ref_text:   'محادثة قصيرة يمكن أن تعالج الآثار الجانبية أو تعدل الجرعة.',
        rc_unint_headline: 'روتين الدواء الخاص بك يحتاج إلى دعم',
        rc_unint_subline:  'نسيان الجرعات أكثر شيوعاً مما تعتقد.',
        rc_unint_msg:      'نسيان الدواء نادراً ما يكون بسبب عدم الاهتمام.',
        rc_unint_tips:     ['اضبط منبهاً يومياً.','احتفظ بدوائك في مكان مرئي.','منظم الحبوب الأسبوعي يزيل الشك.','اسأل الصيدلاني عن صيغة يومية واحدة.'],
        rc_mixed_headline: 'روتين الدواء لديك مجال للتحسين',
        rc_mixed_subline:  'مزيج من العوامل يؤثر على التزامك.',
        rc_mixed_msg:      'تشير إجاباتك إلى وجود عوائق وعدم يقين.',
        rc_mixed_tips:     ['منبه يومي يمكن أن يساعد.','دون أسئلتك وأحضرها لموعدك القادم.'],
        rc_mixed_ref_label:'محادثة مع طبيبك يمكن أن تساعد',
        rc_mixed_ref_text: 'يمكن لطبيبك معالجة مخاوفك والعمل معك على خطة.',
        rc_clin_int:       'عدم الالتزام المتعمد هو السائد — يُنصح بالإحالة.',
        rc_clin_unint:     'عدم الالتزام غير المتعمد هو السائد.',
        rc_clin_mixed:     'نمط التزام مختلط — استشارة شاملة موصى بها.',
        rc_global_tag:     'تمت إضافة إجابتك إلى الخريطة العالمية',
        rc_compare_title:  'كيف تقارن عالمياً',
        rc_compare_yours:  'نقاطك',
        rc_compare_global: 'المتوسط العالمي',
        rc_done:           'تم',
        rc_steps_title:    'خطوات عملية',
        welcome_title:     'مرحباً بك في ATLAS',
        welcome_subtitle:  "كيف تستخدم المنصة اليوم؟\nسنقوم بتخصيص تجربتك وفقاً لذلك.",
        role_patient:      'مريض',
        role_patient_desc: 'إجراء MMAS-8 لمتابعة الالتزام بالدواء الخاص بك.',
        role_patient_badge:'استخدام شخصي',
        role_researcher:   'باحث / طبيب',
        role_researcher_desc:'إجراء تقييمات أو دراسة سريرية.',
        role_researcher_badge:'سريري',
        role_institution:  'مؤسسة',
        role_institution_desc:'إدارة مجموعة أو استخدام رمز وصول مؤسسي.',
        role_institution_badge:'مؤسسي',
        role_footer:       'يتم حفظ اختيارك لهذه الجلسة فقط.',
        banner_patient_title:   'وضع التقييم الشخصي',
        banner_patient_msg:     'أكمل الأسئلة الثمانية وشاهد موقعك على الخريطة العالمية.',
        banner_researcher_title:'وضع الباحث والطبيب',
        banner_researcher_msg:  'وصول كامل لجميع الأدوات والبيانات.',
        inst_title:        'الوصول المؤسسي',
        inst_subtitle:     'أدخل رمز مؤسستك للوصول إلى لوحة التحكم.',
        inst_placeholder:  'أدخل رمز الوصول',
        inst_verify:       'التحقق من الرمز',
        inst_back:         '→ العودة إلى اختيار الدور',
        inst_granted:      '✓ تم منح الوصول',
        inst_error:        'الرمز غير معترف به. يرجى التحقق والمحاولة مرة أخرى.',
        label_study_id:    'معرف الدراسة',
        ph_study_id:       'مثال: UCLA-PHARM-2026',
        note_study_id:     'أدخل معرف الدراسة الذي قدمه المحقق الرئيسي لتجميع طلباتك.',
        pi_individual_records: 'سجلات المرضى الفردية',
        pi_col_patient: 'رقم المريض', pi_col_score: 'النتيجة', pi_col_pattern: 'النمط',
        pi_col_country: 'الدولة', pi_col_date: 'التاريخ', pi_col_coordinator: 'المنسق',
        pi_ina_label: 'متعمد', pi_una_label: 'غير متعمد', pi_mixed_label: 'مختلط',
        pi_high_label: 'عالٍ', pi_no_records: 'لا توجد سجلات فردية بعد.',
        pi_export_cohort: '📥 تصدير CSV للمجموعة', pi_exit: 'الخروج من عرض PI',
    },

    pt: {
        dir: 'ltr',
        consent_title:    'Consentimento Informado',
        consent_subtitle: 'O Projeto de Adesão 2026 pelo ATLAS (Sistema de Ferramentas de Adesão e Análise de Localização)',
        consent_agree_text: 'Li e compreendi as informações acima. Concordo voluntariamente em participar deste estudo e entendo que minhas respostas serão anônimas e utilizadas para fins de pesquisa.',
        consent_btn:      'Continuar para a Avaliação',
        header_title:     'O Projeto de Adesão',
        header_date:      'Dia Mundial da Adesão 2026 | 27 de março de 2026',
        header_powered:   'Desenvolvido pelo ATLAS (Sistema de Ferramentas de Adesão e Análise de Localização)',
        assessments_worldwide: 'Avaliações em Todo o Mundo',
        btn_globe:         '🌍 Globo',
        btn_flat:          '🗺️ Plano',
        btn_spectator:     'Modo Espectador',
        btn_exit_spectator:'Sair do Modo Espectador',
        btn_bulk_upload:   '📤 Upload em Massa',
        stats_title:       'Estatísticas Globais',
        stat_countries:    'Países',
        stat_participants: 'Participantes',
        insights_title:    '🔬 Perspectivas Globais',
        insight_avg:       'Média Global',
        insight_highest:   'País mais Alto',
        insight_most:      'Mais Envios',
        no_data_yet:       'Sem dados ainda',
        legend_title:      'Legenda de Adesão',
        legend_show:       'Mostrar Detalhes',
        legend_hide:       'Ocultar Detalhes',
        legend_high:       'Alta Adesão (8.0)',
        legend_medium:     'Média (6.0–7.9)',
        legend_low:        'Baixa (<6.0)',
        legend_country_breakdown: 'Distribuição por País',
        legend_no_data:    'Sem dados ainda. Envie uma avaliação para ver as estatísticas!',
        analytics_badge:   'Análises Globais ao Vivo',
        section_h2:        'Avaliação de Adesão à Medicação MMAS-8',
        section_sub:       'Complete esta breve avaliação para contribuir com os dados globais de adesão',
        preface_title:     'Antes de Começar',
        preface_p1:        '<strong>Isso não é um teste.</strong> Não há respostas certas ou erradas.',
        preface_p2:        'Muitas pessoas acham difícil tomar seus medicamentos exatamente como prescritos. Você não está sozinho. Pesquisas mostram que os padrões de uso de medicamentos variam amplamente.',
        preface_p3:        '<strong>Por favor, responda honestamente.</strong> Suas respostas honestas nos ajudam a entender os comportamentos reais de uso de medicamentos.',
        preface_p4:        'Todas as respostas são completamente anônimas e serão usadas para melhorar os sistemas de apoio a pacientes em todo o mundo.',
        score_progress:    'Progresso',
        score_label:       'Pontuação Atual',
        score_not_started: 'Não Iniciado',
        score_in_progress: 'Em Andamento',
        score_complete:    'Concluído',
        info_title:        '📋 Informações do Paciente e Medicamento',
        info_desc:         'Forneça as informações a seguir para nos ajudar a entender os padrões de adesão em diferentes populações.',
        label_country:     'País',
        ph_country:        'ex., Brasil',
        note_location:     'Detectado automaticamente pela sua localização. Você pode editar se estiver incorreto.',
        label_city:        'Cidade',
        ph_city:           'ex., São Paulo',
        label_patient_num: 'Número do Paciente (Para Pesquisadores)',
        ph_patient_num:    'ex., Paciente 001',
        note_optional_blank: 'Opcional. Deixe em branco se for usuário individual.',
        label_condition:   'Condição Médica em Tratamento',
        ph_condition:      'ex., Hipertensão, Diabetes Tipo 2, Asma',
        note_one_condition:'Digite uma condição por avaliação.',
        label_drug_type:   'Tipo de Medicamento',
        drug_single:       'IFA Único',
        drug_combo:        'Terapia Combinada',
        label_drug_name:   'Nome do Medicamento/IFA',
        ph_drug_name:      'ex., Metformina, Lisinopril',
        note_optional:     'Opcional.',
        label_drug_strength:'Concentração do Medicamento',
        ph_drug_strength:  'ex., 500mg, 10mg/20mg',
        label_route:       'Via de Administração',
        route_placeholder: '-- Selecionar Via --',
        route_oral:        'Oral (Comprimido/Cápsula)',
        route_oral_liq:    'Oral (Líquidos)',
        route_sublingual:  'Sublingual (Sob a língua)',
        route_buccal:      'Bucal (Bochecha)',
        route_inhalation:  'Inalação (Inalador)',
        route_nasal:       'Nasal (Spray/Gotas)',
        route_sc:          'Injeção - Subcutânea',
        route_im:          'Injeção - Intramuscular',
        route_iv:          'Injeção - Intravenosa',
        route_topical:     'Tópico (Creme/Pomada)',
        route_transdermal: 'Transdérmico (Adesivo)',
        route_rectal:      'Retal (Supositório)',
        route_vaginal:     'Vaginal',
        route_ophthalmic:  'Oftálmico (Colírio)',
        route_otic:        'Otológico (Gotas auriculares)',
        route_other:       'Outro',
        note_optional_rec: 'Opcional mas recomendado.',
        label_gender:      'Gênero',
        gender_male:       'Masculino',
        gender_female:     'Feminino',
        gender_other:      'Outro/Prefiro não dizer',
        label_age:         'Faixa Etária',
        age_placeholder:   '-- Selecionar Faixa Etária --',
        label_education:   'Nível de Educação mais Alto',
        edu_placeholder:   '-- Selecionar Nível de Educação --',
        edu_none:          'Sem educação formal',
        edu_primary:       'Ensino fundamental',
        edu_secondary:     'Ensino médio',
        edu_some_college:  'Alguma faculdade (incompleto)',
        edu_associate:     'Técnico / Escola profissionalizante',
        edu_bachelor:      'Bacharelado',
        edu_master:        'Mestrado',
        edu_doctoral:      'Doutorado (PhD, MD, JD, etc.)',
        prefer_not:        'Prefiro não dizer',
        mmas_section_title:'📊 Avaliação de Adesão à Medicação MMAS-8',
        submit_btn:        'Enviar Avaliação e Adicionar ao Mapa Global',
        submitting:        'Enviando...',
        submitted:         '✓ Enviado!',
        answer_all:        'Por favor, responda todas as 8 perguntas antes de enviar.',
        footer_copy:       '© 2026 Adherence Inc.',
        mmas_lang_note:    null,
        rc_high_headline:  'Excelente Adesão',
        rc_high_subline:   'Você está tomando sua medicação conforme prescrito.',
        rc_high_msg_patient:'Manter este nível de adesão melhora significativamente seus resultados de saúde.',
        rc_high_msg_clin:  'Paciente demonstra adesão total.',
        rc_med_headline:   'Adesão Moderada',
        rc_med_subline:    'Você está majoritariamente no caminho certo.',
        rc_med_msg_patient:'A maioria das pessoas perde doses ocasionalmente. Pequenos ajustes fazem diferença.',
        rc_med_msg_clin:   'Paciente demonstra adesão moderada.',
        rc_med_tips:       ['Vincule sua medicação a um hábito diário.','Um organizador semanal pode ajudar.','Fale com seu médico sobre efeitos colaterais.'],
        rc_int_headline:   'Sua Rotina de Medicação Precisa de Atenção',
        rc_int_subline:    'Algumas respostas sugerem que isso pode parecer uma escolha.',
        rc_int_msg:        'É comum parar a medicação quando parece não funcionar. Essas são preocupações válidas — seu médico precisa saber.',
        rc_int_ref_label:  'Fale com Seu Médico ou Farmacêutico',
        rc_int_ref_text:   'Uma breve conversa pode abordar efeitos colaterais ou ajustar a dosagem.',
        rc_unint_headline: 'Sua Rotina de Medicação Precisa de Apoio',
        rc_unint_subline:  'Esquecer doses é mais comum do que você pensa.',
        rc_unint_msg:      'Esquecer a medicação raramente é por falta de cuidado.',
        rc_unint_tips:     ['Configure um alarme diário.','Mantenha sua medicação visível.','Um organizador semanal elimina a incerteza.','Pergunte sobre formulação de dose única diária.'],
        rc_mixed_headline: 'Sua Rotina Tem Espaço para Crescer',
        rc_mixed_subline:  'Uma combinação de fatores está afetando sua adesão.',
        rc_mixed_msg:      'Suas respostas sugerem tanto barreiras práticas quanto incerteza.',
        rc_mixed_tips:     ['Um alarme diário pode ajudar.','Anote suas dúvidas e leve-as à próxima consulta.'],
        rc_mixed_ref_label:'Uma Conversa com Seu Médico Pode Ajudar',
        rc_mixed_ref_text: 'Seu médico pode abordar suas preocupações e ajudar com um plano.',
        rc_clin_int:       'Não adesão intencional dominante — encaminhamento recomendado.',
        rc_clin_unint:     'Não adesão não intencional dominante — estratégias comportamentais.',
        rc_clin_mixed:     'Padrão misto — consulta abrangente recomendada.',
        rc_global_tag:     'Sua resposta foi adicionada ao mapa global',
        rc_compare_title:  'Como Você se Compara Globalmente',
        rc_compare_yours:  'Sua Pontuação',
        rc_compare_global: 'Média Global',
        rc_done:           'Concluído',
        rc_steps_title:    'Passos Práticos',
        welcome_title:     'Bem-vindo ao ATLAS',
        welcome_subtitle:  "Como você está usando a plataforma hoje?\nAdaptaremos sua experiência de acordo.",
        role_patient:      'Paciente',
        role_patient_desc: 'Realizando o MMAS-8 para seu próprio acompanhamento de adesão.',
        role_patient_badge:'Uso Pessoal',
        role_researcher:   'Coordenador de Estudo',
        role_researcher_desc:'Administrando avaliações ou conduzindo um estudo clínico.',
        role_researcher_badge:'Recolección de Estudio',
        role_institution:  'Investigador Principal / Instituição',
        role_institution_desc:'Gerenciando uma coorte ou usando um código de acesso institucional.',
        role_institution_badge:'PI / Institucional',
        role_footer:       'Sua seleção é salva apenas para esta sessão.',
        banner_patient_title:   'Modo de Avaliação Pessoal',
        banner_patient_msg:     'Complete as 8 perguntas e veja onde você se situa no mapa global.',
        banner_researcher_title:'Modo Coordenador de Estudo',
        banner_researcher_msg:  'Acesso completo a todos os campos e ferramentas de exportação.',
        inst_title:        'Acesso PI / Institucional',
        inst_subtitle:     'Digite seu código para acessar o painel de coorte.',
        inst_placeholder:  'Digite o código de acesso',
        inst_verify:       'Verificar Código',
        inst_back:         '← Voltar à seleção de papel',
        inst_granted:      '✓ Acesso Concedido',
        inst_error:        'Código não reconhecido. Por favor verifique e tente novamente.',
        label_study_id:    'ID do Estudo',
        ph_study_id:       'ex., UCLA-FARM-2026',
        note_study_id:     'Digite o ID do estudo fornecido pelo seu PI para agrupar suas submissões.',
        pi_individual_records: 'Registros Individuais de Pacientes',
        pi_col_patient: 'Paciente #', pi_col_score: 'Pontuação', pi_col_pattern: 'Padrão',
        pi_col_country: 'País', pi_col_date: 'Data', pi_col_coordinator: 'Coordenador',
        pi_ina_label: 'Intencional', pi_una_label: 'Não Intencional', pi_mixed_label: 'Misto',
        pi_high_label: 'Alto', pi_no_records: 'Nenhum registro individual ainda.',
        pi_export_cohort: '📥 Exportar CSV da Coorte', pi_exit: 'Sair da Vista PI',
    },
};


// ── Language state ────────────────────────────────────────────────────────────
let currentLang       = 'en';
let currentUIStrings  = UI_STRINGS.en;     // active UI strings object
let currentMMASLang   = null;              // code if MMAS questions available, else null

// ── t() — get current UI string, fall back to English ─────────────────────────
function t(key, fallback) {
    if (currentUIStrings && currentUIStrings[key] !== undefined && currentUIStrings[key] !== null) {
        return currentUIStrings[key];
    }
    if (UI_STRINGS.en[key] !== undefined) return UI_STRINGS.en[key];
    return fallback !== undefined ? fallback : key;
}

// ── isRTL ──────────────────────────────────────────────────────────────────────
function isRTL() {
    return (currentUIStrings && currentUIStrings.dir === 'rtl') ||
           (currentMMASLang && MMAS_QUESTIONS[currentMMASLang] && MMAS_QUESTIONS[currentMMASLang].dir === 'rtl');
}

// ── Apply MMAS questions to DOM ──────────────────────────────────────────────
function applyMMASQuestions() {
    const qData = currentMMASLang ? MMAS_QUESTIONS[currentMMASLang] : null;
    const dir   = qData ? qData.dir : 'ltr';

    // Set RTL on form section
    const form = document.getElementById('mmas-form');
    if (form) form.setAttribute('dir', dir);

    for (let i = 1; i <= 8; i++) {
        const el = document.querySelector('[data-question="q' + i + '"]');
        if (!el) continue;
        el.textContent = (qData && qData['q' + i]) ? qData['q' + i] : el.getAttribute('data-en') || el.textContent;
        el.setAttribute('dir', dir);
    }

    // Update Yes/No labels
    document.querySelectorAll('[data-yesno="yes"]').forEach(el => {
        el.textContent = (qData && qData.q1_yes) ? qData.q1_yes : 'Yes';
    });
    document.querySelectorAll('[data-yesno="no"]').forEach(el => {
        el.textContent = (qData && qData.q1_no) ? qData.q1_no : 'No';
    });

    // Freq labels
    const freqMap = {
        q8_never: 'Never', q8_once: 'Rarely',
        q8_sometimes: 'Sometimes', q8_usually: 'Often', q8_always: 'All of the time'
    };
    Object.keys(freqMap).forEach(key => {
        const el = document.querySelector('[data-freq="' + key + '"]');
        if (el) el.textContent = (qData && qData[key]) ? qData[key] : freqMap[key];
    });

    // Validated note
    const noteEl = document.getElementById('mmas-lang-note');
    if (noteEl) {
        const hasQ = qData && qData.q1;
        const uiNote = t('mmas_lang_note', null);
        if (!hasQ && currentLang !== 'en') {
            noteEl.textContent = uiNote || 'Assessment questions are shown in English — a validated translation for this language will be available soon.';
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }
}

// ── Apply UI direction to document ────────────────────────────────────────────
function applyDocumentDir() {
    document.documentElement.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', currentLang);
}

// ── Re-render all open modals and live DOM elements ───────────────────────────
function reRenderUI() {
    applyDocumentDir();

    // ── DOM SWEEP — update every data-i18n tagged element ────────────────────
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key, null);
        if (val !== null) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const val = t(key, null);
        if (val !== null) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        const val = t(key, null);
        if (val !== null) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-empty]').forEach(el => {
        const key = el.getAttribute('data-i18n-empty');
        const val = t(key, null);
        const txt = (el.textContent || '').trim();
        const isDefault = txt.length < 30 && !txt.match(/\d/);
        if (val !== null && isDefault) el.textContent = val;
    });
    document.querySelectorAll('option[data-i18n]').forEach(opt => {
        const key = opt.getAttribute('data-i18n');
        const val = t(key, null);
        if (val !== null) opt.textContent = val;
    });
    // ── END DOM SWEEP ─────────────────────────────────────────────────────────

    applyMMASQuestions();

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn && !submitBtn.disabled) submitBtn.textContent = t('submit_btn');

    // Role modal — rebuild if open
    const roleModal = document.getElementById('role-modal');
    if (roleModal) {
        const box = roleModal.querySelector('.role-modal-box');
        if (box) {
            box.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
            const title    = box.querySelector('.role-modal-title');
            const subtitle = box.querySelector('.role-modal-subtitle');
            if (title)    title.textContent    = t('welcome_title');
            if (subtitle) subtitle.innerHTML   = t('welcome_subtitle').replace(/\n/g, '<br>');
            box.querySelectorAll('.role-card').forEach(card => {
                const role = card.getAttribute('data-role');
                const map = {
                    individual:  ['role_patient',      'role_patient_desc',      'role_patient_badge'],
                    researcher:  ['role_researcher',    'role_researcher_desc',   'role_researcher_badge'],
                    institution: ['role_institution',   'role_institution_desc',  'role_institution_badge'],
                };
                if (!map[role]) return;
                const name  = card.querySelector('.role-name');
                const desc  = card.querySelector('.role-desc');
                const badge = card.querySelector('.role-badge');
                if (name)  name.textContent  = t(map[role][0]);
                if (desc)  desc.textContent  = t(map[role][1]);
                if (badge) badge.textContent = t(map[role][2]);
            });
            const footer = box.querySelector('.role-footer');
            if (footer) footer.textContent = t('role_footer');
        }
    }

    // Institution modal — rebuild if open
    const instModal = document.getElementById('inst-modal');
    if (instModal) {
        const titleEl    = instModal.querySelector('.inst-title');
        const subtitleEl = instModal.querySelector('.inst-subtitle');
        const inputEl    = instModal.querySelector('#inst-code-input');
        const verifyBtn  = instModal.querySelector('#inst-submit-btn');
        const backBtn    = instModal.querySelector('#inst-back-btn');
        if (titleEl)    titleEl.textContent       = t('inst_title');
        if (subtitleEl) subtitleEl.textContent     = t('inst_subtitle');
        if (inputEl)    inputEl.placeholder        = t('inst_placeholder');
        if (verifyBtn && !verifyBtn.disabled) verifyBtn.textContent = t('inst_verify');
        if (backBtn)    backBtn.textContent         = t('inst_back');
        instModal.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
    }

    // Update language selector active state
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === currentLang);
    });

    // Update selector button label
    const langBtn = document.getElementById('lang-selector-btn');
    if (langBtn) {
        const mmData = MMAS_QUESTIONS[currentLang];
        const uiData = UI_STRINGS[currentLang];
        const native = (mmData && mmData.native) || (uiData && uiData.welcome_title ? currentLang.toUpperCase() : 'English');
        const nativeLabel = mmData ? mmData.native : (currentLang === 'en' ? 'English' : currentLang.toUpperCase());
        langBtn.textContent = nativeLabel + ' ▾';
    }
}

// ── Switch language ────────────────────────────────────────────────────────────
async function switchLanguage(langCode) {
    currentLang      = langCode;
    currentUIStrings = UI_STRINGS[langCode] || UI_STRINGS['en'];
    currentMMASLang  = MMAS_QUESTIONS[langCode] ? langCode : null;
    localStorage.setItem('atlas_lang', langCode);

    // Firebase override for UI strings (live without deploy)
    try {
        const snap = await database.ref('translations/' + langCode).once('value');
        const override = snap.val();
        if (override) currentUIStrings = Object.assign({}, currentUIStrings, override);
    } catch(e) { /* network issue — use built-in */ }

    reRenderUI();
}

// ── Language selector UI ───────────────────────────────────────────────────────
function injectLanguageSelector() {
    if (document.getElementById('lang-selector')) return;

    // Build lang list: UI_STRINGS languages first, then MMAS-only languages
    const uiLangs  = Object.keys(UI_STRINGS);
    const mmasOnly = Object.keys(MMAS_QUESTIONS).filter(c => !uiLangs.includes(c));
    const allLangs = [
        ...uiLangs.map(c => ({ code: c, native: (MMAS_QUESTIONS[c] || {}).native || c.toUpperCase(), hasUI: true,  hasMmas: !!MMAS_QUESTIONS[c] })),
        ...mmasOnly.map(c => ({ code: c, native: MMAS_QUESTIONS[c].native, hasUI: false, hasMmas: true })),
    ];

    const wrap = document.createElement('div');
    wrap.id = 'lang-selector';
    wrap.innerHTML = `
        <style>
            #lang-selector{position:fixed;top:14px;right:16px;z-index:99990;font-family:'Inter',system-ui,sans-serif;}
            #lang-selector-btn{background:rgba(15,23,42,0.88);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.15);color:white;padding:7px 14px;border-radius:20px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;}
            #lang-selector-btn:hover{background:rgba(37,99,235,0.35);border-color:rgba(96,165,250,0.5);}
            #lang-dropdown{display:none;position:absolute;top:calc(100% + 6px);right:0;background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.7);min-width:210px;max-height:70vh;overflow-y:auto;}
            #lang-dropdown.open{display:block;animation:ldDrop 0.18s ease;}
            @keyframes ldDrop{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
            .lang-group-label{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.25);padding:10px 16px 4px;}
            .lang-option{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;cursor:pointer;transition:background 0.12s;gap:10px;}
            .lang-option:hover{background:rgba(255,255,255,0.07);}
            .lang-option.active{background:rgba(37,99,235,0.22);}
            .lang-native{font-size:0.85rem;font-weight:600;color:white;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .lang-badges{display:flex;gap:4px;align-items:center;flex-shrink:0;}
            .lang-badge-ui{font-size:0.58rem;color:#60a5fa;background:rgba(96,165,250,0.15);padding:2px 5px;border-radius:4px;}
            .lang-badge-mmas{font-size:0.58rem;color:#10b981;background:rgba(16,185,129,0.15);padding:2px 5px;border-radius:4px;}
            .lang-check{color:#60a5fa;font-size:0.75rem;opacity:0;flex-shrink:0;}
            .lang-option.active .lang-check{opacity:1;}
        </style>
        <button id="lang-selector-btn">English ▾</button>
        <div id="lang-dropdown">
            <div class="lang-group-label">Full Interface</div>
            ${allLangs.filter(l => l.hasUI).map(l => `
                <div class="lang-option" data-lang="${l.code}">
                    <span class="lang-native">${l.native}</span>
                    <span class="lang-badges">
                        <span class="lang-badge-ui">UI</span>
                        ${l.hasMmas ? '<span class="lang-badge-mmas">MMAS</span>' : ''}
                    </span>
                    <span class="lang-check">✓</span>
                </div>`).join('')}
            <div class="lang-group-label">MMAS Questions Only</div>
            ${allLangs.filter(l => !l.hasUI).map(l => `
                <div class="lang-option" data-lang="${l.code}">
                    <span class="lang-native">${l.native}</span>
                    <span class="lang-badges"><span class="lang-badge-mmas">MMAS</span></span>
                    <span class="lang-check">✓</span>
                </div>`).join('')}
        </div>
    `;
    document.body.appendChild(wrap);

    const btn      = document.getElementById('lang-selector-btn');
    const dropdown = document.getElementById('lang-dropdown');

    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', async e => {
            e.stopPropagation();
            dropdown.classList.remove('open');
            await switchLanguage(opt.getAttribute('data-lang'));
        });
    });
}

// ── Boot ───────────────────────────────────────────────────────────────────────
async function initTranslations() {
    const saved      = localStorage.getItem('atlas_lang') || 'en';
    currentLang      = saved;
    currentUIStrings = UI_STRINGS[saved] || UI_STRINGS['en'];
    currentMMASLang  = MMAS_QUESTIONS[saved] ? saved : null;

    // Firebase override
    try {
        const snap = await database.ref('translations/' + saved).once('value');
        const override = snap.val();
        if (override) currentUIStrings = Object.assign({}, currentUIStrings, override);
    } catch(e) {}

    injectLanguageSelector();
    reRenderUI();

    // Mark active in dropdown
    const opt = document.querySelector('.lang-option[data-lang="' + saved + '"]');
    if (opt) opt.classList.add('active');
}

// ROLE SELECTION MODAL
// ═══════════════════════════════════════════════════════
let userRole = null;

function showRoleSelection() {
    // Skip if already chosen this session
    if (sessionStorage.getItem('atlas_role')) {
        userRole = sessionStorage.getItem('atlas_role');
        institutionCode = sessionStorage.getItem('atlas_inst_code') || null;
        applyRole(userRole);
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'role-modal';
    modal.innerHTML = `
        <style>
            #role-modal{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.92);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',system-ui,sans-serif;}
            .role-modal-box{background:#0a0f1c;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:52px 44px;max-width:640px;width:100%;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,0.7);}
            .role-modal-logo{font-size:0.7rem;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:32px;}
            .role-modal-title{font-size:clamp(1.5rem,4vw,2.1rem);font-weight:800;color:white;margin-bottom:10px;letter-spacing:-0.5px;}
            .role-modal-subtitle{font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:44px;line-height:1.6;}
            .role-cards{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;}
            .role-card{flex:1;min-width:220px;max-width:260px;background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.09);border-radius:20px;padding:32px 24px;cursor:pointer;transition:all 0.25s ease;position:relative;overflow:hidden;text-align:left;}
            .role-card::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity 0.25s;border-radius:20px;}
            .role-card[data-role="patient"]::before{background:linear-gradient(135deg,rgba(96,165,250,0.1),rgba(52,211,153,0.06));}
            .role-card[data-role="researcher"]::before{background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(236,72,153,0.06));}
            .role-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.25);}
            .role-card:hover::before{opacity:1;}
            .role-icon{font-size:2.4rem;margin-bottom:18px;display:block;}
            .role-name{font-size:1.05rem;font-weight:700;color:white;margin-bottom:8px;}
            .role-desc{font-size:0.78rem;color:rgba(255,255,255,0.45);line-height:1.55;}
            .role-badge{display:inline-block;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:3px 10px;border-radius:20px;margin-top:14px;}
            .role-card[data-role="patient"] .role-badge{background:rgba(96,165,250,0.15);color:#60a5fa;}
            .role-card[data-role="researcher"] .role-badge{background:rgba(168,85,247,0.15);color:#a855f7;}
            .role-tracks{margin-top:10px;font-size:0.68rem;color:rgba(255,255,255,0.25);letter-spacing:0.03em;}
            .role-footer{margin-top:36px;font-size:0.72rem;color:rgba(255,255,255,0.2);}
            /* Researcher step 2 */
            .role-step2{display:none;text-align:left;}
            .role-step2-title{font-size:1.1rem;font-weight:700;color:white;margin-bottom:6px;}
            .role-step2-sub{font-size:0.78rem;color:rgba(255,255,255,0.4);margin-bottom:28px;line-height:1.5;}
            .role-input-group{margin-bottom:20px;}
            .role-input-label{font-size:0.72rem;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;display:block;}
            .role-input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 14px;color:white;font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 0.2s;}
            .role-input:focus{border-color:rgba(168,85,247,0.5);}
            .role-input::placeholder{color:rgba(255,255,255,0.2);}
            .role-btn-row{display:flex;gap:12px;margin-top:28px;}
            .role-btn-primary{flex:1;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:12px;padding:14px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s;}
            .role-btn-primary:hover{filter:brightness(1.1);transform:translateY(-1px);}
            .role-btn-back{background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.35);border-radius:12px;padding:14px 18px;font-size:0.82rem;cursor:pointer;font-family:inherit;transition:all 0.2s;}
            .role-btn-back:hover{border-color:rgba(255,255,255,0.25);color:rgba(255,255,255,0.6);}
            @media(max-width:520px){.role-modal-box{padding:32px 20px;}.role-cards{gap:14px;}.role-card{min-width:160px;padding:24px 16px;}}
        </style>
        <div class="role-modal-box" dir="${isRTL() ? 'rtl' : 'ltr'}">
            <div class="role-modal-logo">ATLAS · Adherence Platform</div>

            <!-- Step 1: Choose role -->
            <div id="role-step1">
                <div class="role-modal-title">How are you using ATLAS today?</div>
                <div class="role-modal-subtitle">Your role determines which tracks are available to you.</div>
                <div class="role-cards">
                    <div class="role-card" data-role="patient">
                        <span class="role-icon">💊</span>
                        <div class="role-name">Patient</div>
                        <div class="role-desc">I am completing a medication adherence assessment for my own tracking and care.</div>
                        <span class="role-badge">Personal Use</span>
                        <div class="role-tracks">Track A — MMAS-8 only</div>
                    </div>
                    <div class="role-card" data-role="researcher">
                        <span class="role-icon">🔬</span>
                        <div class="role-name">Researcher / PI</div>
                        <div class="role-desc">I am a clinician, researcher, or PI collecting or analyzing adherence data.</div>
                        <span class="role-badge">Clinical Access</span>
                        <div class="role-tracks">Track A + Track B — Full Access</div>
                    </div>
                </div>
                <div class="role-footer">Your selection is saved for this browser session only.</div>
            </div>

            <!-- Step 2: Researcher detail -->
            <div id="role-step2" class="role-step2">
                <div style="font-size:1.8rem;margin-bottom:16px;">🔬</div>
                <div class="role-step2-title">Researcher / PI Access</div>
                <div class="role-step2-sub">Full access to both Track A (MMAS-8) and Track B (PEACS / TPE) is now enabled for this session.<br><br>Optionally enter your institution or study code — this tags your Track B submissions and enables cohort filtering.</div>
                <div class="role-input-group">
                    <label class="role-input-label" for="researcher-name-input">Your Name or Identifier</label>
                    <input class="role-input" id="researcher-name-input" type="text" placeholder="e.g., Dr. Patel, PEACS-PI-007" autocomplete="off">
                </div>
                <div class="role-input-group">
                    <label class="role-input-label" for="researcher-inst-input">Institution / Study Code <span style="color:rgba(255,255,255,0.25);font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></label>
                    <input class="role-input" id="researcher-inst-input" type="text" placeholder="e.g., UCLA Health, MMAS-Study-007" autocomplete="off">
                </div>
                <div class="role-btn-row">
                    <button class="role-btn-back" id="role-back-btn">← Back</button>
                    <button class="role-btn-primary" id="role-confirm-btn">Enter Platform →</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Step 1 — card clicks
    modal.querySelector('[data-role="patient"]').addEventListener('click', () => {
        userRole = 'patient';
        sessionStorage.setItem('atlas_role', 'patient');
        sessionStorage.removeItem('atlas_inst_code');
        sessionStorage.removeItem('atlas_researcher_name');
        modal.style.transition = 'opacity 0.35s ease';
        modal.style.opacity = '0';
        setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); applyRole('patient'); }, 350);
    });

    modal.querySelector('[data-role="researcher"]').addEventListener('click', () => {
        modal.querySelector('#role-step1').style.display = 'none';
        const s2 = modal.querySelector('#role-step2');
        s2.style.display = 'block';
        modal.querySelector('#researcher-name-input').focus();
    });

    // Step 2 — back
    modal.querySelector('#role-back-btn').addEventListener('click', () => {
        modal.querySelector('#role-step2').style.display = 'none';
        modal.querySelector('#role-step1').style.display = 'block';
    });

    // Step 2 — confirm
    modal.querySelector('#role-confirm-btn').addEventListener('click', () => {
        const name = modal.querySelector('#researcher-name-input').value.trim();
        const inst = modal.querySelector('#researcher-inst-input').value.trim();
        userRole = 'researcher';
        sessionStorage.setItem('atlas_role', 'researcher');
        if (inst) { institutionCode = inst; sessionStorage.setItem('atlas_inst_code', inst); }
        if (name) sessionStorage.setItem('atlas_researcher_name', name);
        modal.style.transition = 'opacity 0.35s ease';
        modal.style.opacity = '0';
        setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); applyRole('researcher'); }, 350);
    });

    // Allow Enter on step 2 inputs
    ['researcher-name-input','researcher-inst-input'].forEach(id => {
        modal.querySelector('#'+id).addEventListener('keydown', e => {
            if (e.key === 'Enter') modal.querySelector('#role-confirm-btn').click();
        });
    });
}


function applyRole(role) {
    document.body.setAttribute('data-role', role);

    const studyIdGroup = document.getElementById('study-id-group');
    const bulkBtn      = document.getElementById('bulk-upload-btn');
    const exportBtn    = document.getElementById('export-btn');
    const trackBBtn    = document.getElementById('track-b-nav-btn');
    const trackBGate   = document.getElementById('track-b-gate');
    const trackBSection = document.getElementById('track-b-section');

    // Wire the gate's "Change Role" button every time (idempotent)
    const upgradeBtn = document.getElementById('track-b-gate-upgrade-btn');
    if (upgradeBtn && !upgradeBtn.dataset.wired) {
        upgradeBtn.dataset.wired = '1';
        upgradeBtn.addEventListener('click', () => {
            sessionStorage.removeItem('atlas_role');
            userRole = null;
            document.body.removeAttribute('data-role');
            showRoleSelection();
        });
    }

    if (role === 'patient' || role === 'individual') {
        // Track B — soft gate ON (overlay stays, content blurred behind it)
        if (trackBGate)    { trackBGate.style.display = 'flex'; }
        if (trackBSection) { trackBSection.style.display = 'none'; }  // not shown to patients at all
        if (trackBBtn)     { trackBBtn.style.display = 'none'; }

        if (studyIdGroup) studyIdGroup.style.display = 'none';
        const linkGroup = document.getElementById('participant-link-group');
        if (linkGroup) linkGroup.style.display = 'none';
        if (bulkBtn)   bulkBtn.style.display   = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
        injectRoleDashboard('patient');
        showRoleBanner('💊', t('banner_patient_title'), t('banner_patient_msg'), '#60a5fa');

    } else if (role === 'researcher') {
        // Track B — soft gate OFF (overlay removed, content accessible)
        if (trackBGate)    { trackBGate.style.display = 'none'; }
        if (trackBSection) { trackBSection.style.display = 'block'; }
        if (trackBBtn)     { trackBBtn.style.display = ''; }

        if (studyIdGroup) studyIdGroup.style.display = '';
        const linkGroup = document.getElementById('participant-link-group');
        if (linkGroup) linkGroup.style.display = '';
        if (bulkBtn)   bulkBtn.style.display   = '';
        if (exportBtn) exportBtn.style.display = '';

        const instCode = sessionStorage.getItem('atlas_inst_code');
        const resName  = sessionStorage.getItem('atlas_researcher_name');
        if (instCode) { institutionCode = instCode; }
        injectCohortDashboard('researcher');
        const bannerSubtitle = (resName ? resName + ' · ' : '') + (instCode ? instCode + ' · ' : '') + 'Track A + Track B enabled';
        showRoleBanner('🔬', 'Researcher / PI Mode', bannerSubtitle, '#a855f7');
        initParticipantLinkVerify();

        // Scroll Track B into view when nav button is clicked
        if (trackBBtn) {
            if (!trackBBtn.dataset.wired) {
                trackBBtn.dataset.wired = '1';
                trackBBtn.addEventListener('click', () => {
                    const sec = document.getElementById('track-b-section');
                    if (sec) {
                        sec.style.display = 'block'; // ensure visible before scroll
                        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }
        }

        if (instCode && typeof loadCohortAssessments === 'function') {
            loadCohortAssessments();
        }
    }
}

function injectRoleDashboard(roleType) {
    const existing = document.getElementById('role-dashboard-bar');
    if (existing) existing.remove();

    const configs = {
        patient: {
            color: '#60a5fa',
            gradient: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.06))',
            border: 'rgba(96,165,250,0.25)',
            icon: '💊',
            title: 'Personal Assessment Mode',
            subtitle: 'Your responses are fully anonymous and contribute to global adherence research. No personal data is stored.',
            items: []
        },
        researcher: {
            color: '#a855f7',
            gradient: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.06))',
            border: 'rgba(168,85,247,0.25)',
            icon: '🔬',
            title: 'Study Coordinator Mode',
            subtitle: 'Clinical data collection enabled. Submissions tagged as clinical records — linked to your Study ID if provided.',
            items: [
                { icon: '📤', label: 'Bulk Upload', desc: 'Import Excel file with multiple assessments', action: 'handleBulkUpload()', color: '#8b5cf6' },
                { icon: '📥', label: 'Export Data', desc: 'Download full dataset as CSV', action: 'exportToExcel()', color: '#0891b2' },
            ]
        }
    };

    const cfg = configs[roleType];
    if (!cfg) return;

    const itemsHTML = cfg.items.length ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
            ${cfg.items.map(item => `
                <button onclick="${item.action}" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.05);border:1px solid ${item.color}55;border-radius:10px;padding:10px 16px;cursor:pointer;transition:all 0.2s;color:white;font-family:'Inter',system-ui,sans-serif;">
                    <span style="font-size:1.2rem;">${item.icon}</span>
                    <div style="text-align:left;">
                        <div style="font-size:0.82rem;font-weight:700;color:${item.color};">${item.label}</div>
                        <div style="font-size:0.7rem;color:rgba(255,255,255,0.4);margin-top:1px;">${item.desc}</div>
                    </div>
                </button>`).join('')}
        </div>` : '';

    const bar = document.createElement('div');
    bar.id = 'role-dashboard-bar';
    bar.innerHTML = `
        <style>
            #role-dashboard-bar{background:${cfg.gradient};border-left:3px solid ${cfg.color};border-bottom:1px solid ${cfg.border};padding:14px 24px;font-family:'Inter',system-ui,sans-serif;animation:rdbSlide 0.4s cubic-bezier(0.34,1.2,0.64,1) both;}
            @keyframes rdbSlide{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
            #role-dashboard-bar button:hover{transform:translateY(-1px);filter:brightness(1.15);}
            .rdb-privacy-pill{display:inline-flex;align-items:center;gap:5px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:3px 10px;border-radius:20px;margin-left:10px;vertical-align:middle;}
        </style>
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <span style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">${cfg.icon}</span>
            <div style="flex:1;min-width:200px;">
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
                    <span style="font-size:0.88rem;font-weight:700;color:${cfg.color};">${cfg.title}</span>
                    ${roleType === 'patient'
                        ? `<span class="rdb-privacy-pill" style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;">🔒 Anonymous · Public Track</span>`
                        : `<span class="rdb-privacy-pill" style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;">🔬 Clinical · Protected Track</span>`}
                </div>
                <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:3px;">${cfg.subtitle}</div>
            </div>
            <button onclick="document.getElementById('role-dashboard-bar').remove();sessionStorage.removeItem('atlas_role');sessionStorage.removeItem('atlas_inst_code');sessionStorage.removeItem('atlas_researcher_name');document.body.removeAttribute('data-role');const b=document.getElementById('bulk-upload-btn');const e=document.getElementById('export-btn');const s=document.getElementById('study-id-group');const tb=document.getElementById('track-b-nav-btn');const tg=document.getElementById('track-b-gate');if(b)b.style.display='none';if(e)e.style.display='none';if(s)s.style.display='none';if(tb)tb.style.display='none';if(tg)tg.style.display='flex';showRoleSelection();"
                style="background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.35);padding:5px 12px;border-radius:8px;font-size:0.7rem;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all 0.2s;">
                ⇄ Switch Role
            </button>
        </div>
        ${itemsHTML}
    `;

    const mapSection = document.querySelector('.map-section') || document.getElementById('map');
    const parent = mapSection ? mapSection.parentNode : document.body;
    const insertBefore = mapSection ? mapSection.nextSibling : null;
    parent.insertBefore(bar, insertBefore);
}

function showRoleBanner(icon, title, message, color) {
    const existing = document.getElementById('role-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'role-banner';
    banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99998;background:#0f172a;border:1px solid ' + color + '44;border-left:4px solid ' + color + ';border-radius:12px;padding:14px 22px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:90vw;pointer-events:auto;animation:roleBannerIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both;';

    if (!document.getElementById('role-banner-style')) {
        const s = document.createElement('style');
        s.id = 'role-banner-style';
        s.textContent = '@keyframes roleBannerIn{from{opacity:0;transform:translateX(-50%) translateY(-20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
        document.head.appendChild(s);
    }

    banner.innerHTML = '<span style="font-size:1.4rem">' + icon + '</span><div><div style="font-size:0.85rem;font-weight:700;color:white;">' + title + '</div><div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-top:2px;">' + message + '</div></div><button onclick="this.parentNode.remove()" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:1.2rem;padding:0 0 0 12px;line-height:1;">&times;</button>';

    document.body.appendChild(banner);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        if (banner.parentNode) {
            banner.style.transition = 'opacity 0.5s';
            banner.style.opacity = '0';
            setTimeout(() => { if (banner.parentNode) banner.remove(); }, 500);
        }
    }, 6000);
}


// ═══════════════════════════════════════════════════════
// INSTITUTION CODE GATE
// ═══════════════════════════════════════════════════════

// Built-in institution registry — add new codes here or store in Firebase
// Firebase path: institutions/{code} = { name, cohortLabel, color, active }
// The code below checks Firebase first, falls back to this local registry.
const INSTITUTION_REGISTRY = {
    'ATLAS-DEV': { name: 'Adherence Inc. — Internal', cohortLabel: 'Dev / QA Testing', color: '#ef4444' }
};

async function validateInstitutionCode(code) {
    // 1. Check Firebase institutions node first (live, updateable without deploy)
    try {
        const snap = await database.ref('institutions/' + code.toUpperCase()).once('value');
        const data = snap.val();
        if (data && data.active !== false) return data;
    } catch (e) { /* fall through to local registry */ }

    // 2. Fall back to local registry
    const local = INSTITUTION_REGISTRY[code.toUpperCase()];
    if (local) return local;

    return null;
}

function promptInstitutionCode() {
    // Already verified this session?
    const cached = sessionStorage.getItem('atlas_inst_code');
    const cachedProfile = sessionStorage.getItem('atlas_inst_profile');
    if (cached && cachedProfile) {
        institutionCode    = cached;
        institutionProfile = JSON.parse(cachedProfile);
        activateCohortMode();
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'inst-code-modal';
    modal.innerHTML = `
        <style>
            #inst-code-modal{position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',system-ui,sans-serif;}
            .inst-box{background:#0f172a;border:1px solid rgba(245,158,11,0.3);border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,0.7);}
            .inst-icon{font-size:3rem;margin-bottom:16px;}
            .inst-title{font-size:1.6rem;font-weight:800;color:white;margin-bottom:8px;}
            .inst-subtitle{font-size:0.9rem;color:rgba(255,255,255,0.5);margin-bottom:32px;line-height:1.6;}
            .inst-input-wrap{position:relative;margin-bottom:16px;}
            .inst-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;padding:16px 20px;font-size:1.1rem;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:white;text-align:center;outline:none;transition:border-color 0.2s;}
            .inst-input:focus{border-color:rgba(245,158,11,0.6);}
            .inst-input::placeholder{letter-spacing:1px;font-weight:400;font-size:0.9rem;color:rgba(255,255,255,0.25);text-transform:none;}
            .inst-submit{width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;border-radius:12px;padding:16px;font-size:1rem;font-weight:700;cursor:pointer;transition:all 0.2s;margin-bottom:12px;}
            .inst-submit:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(245,158,11,0.35);}
            .inst-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
            .inst-back{background:none;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);border-radius:12px;padding:12px;font-size:0.85rem;cursor:pointer;width:100%;transition:all 0.2s;}
            .inst-back:hover{border-color:rgba(255,255,255,0.3);color:white;}
            .inst-error{color:#ef4444;font-size:0.82rem;margin-bottom:12px;min-height:20px;transition:opacity 0.2s;}
            .inst-checking{color:rgba(255,255,255,0.5);font-size:0.82rem;margin-bottom:12px;min-height:20px;}
        </style>
        <div class="inst-box">
            <div class="inst-icon">&#127973;</div>
            <div class="inst-title">${t('inst_title')}</div>
            <div class="inst-subtitle">${t('inst_subtitle')}</div>
            <div class="inst-input-wrap">
                <input class="inst-input" id="inst-code-input" type="text" maxlength="12" placeholder="${t('inst_placeholder')}" autocomplete="off" spellcheck="false" />
            </div>
            <div class="inst-error" id="inst-error" style="opacity:0;"></div>
            <button class="inst-submit" id="inst-submit-btn">${t('inst_verify')}</button>
            <button class="inst-back" id="inst-back-btn">${t('inst_back')}</button>
        </div>
    `;
    document.body.appendChild(modal);

    const input   = document.getElementById('inst-code-input');
    const submitBtn = document.getElementById('inst-submit-btn');
    const errorEl = document.getElementById('inst-error');
    const backBtn = document.getElementById('inst-back-btn');

    input.focus();

    // Allow Enter key
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); });

    submitBtn.addEventListener('click', async () => {
        const code = input.value.trim().toUpperCase();
        if (!code) {
            showInstError('Please enter your access code.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';
        errorEl.style.opacity = '0';

        const profile = await validateInstitutionCode(code);

        if (profile) {
            institutionCode    = code;
            institutionProfile = profile;
            sessionStorage.setItem('atlas_inst_code',    code);
            sessionStorage.setItem('atlas_inst_profile', JSON.stringify(profile));

            // Success animation
            submitBtn.textContent = t('inst_granted');
            submitBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';

            setTimeout(() => {
                modal.style.transition = 'opacity 0.4s ease';
                modal.style.opacity = '0';
                setTimeout(() => {
                    if (modal.parentNode) modal.parentNode.removeChild(modal);
                    activateCohortMode();
                }, 400);
            }, 800);

        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verify Code';
            showInstError(t('inst_error'));
            input.focus(); input.select();
        }
    });

    backBtn.addEventListener('click', () => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        // Clear role and re-show role selection
        sessionStorage.removeItem('atlas_role');
        userRole = null;
        document.body.removeAttribute('data-role');
        showRoleSelection();
    });

    function showInstError(msg) {
        errorEl.textContent = msg;
        errorEl.style.opacity = '1';
        input.style.borderColor = 'rgba(239,68,68,0.6)';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
    }
}

function activateCohortMode() {
    cohortMode = true;
    document.body.setAttribute('data-cohort', institutionCode);

    // Show researcher tools for institution users
    const bulkBtn   = document.getElementById('bulk-upload-btn');
    const exportBtn = document.getElementById('export-btn');
    if (bulkBtn)   bulkBtn.style.display   = '';
    if (exportBtn) exportBtn.style.display = '';

    // Inject cohort stats bar — global map stays untouched
    injectCohortDashboard();

    // Scan already-loaded global data to build cohort stats, then highlight markers
    loadCohortAssessments();

    showRoleBanner('\u{1F3DB}', institutionProfile.name + ' — Now Viewing Global Map',
        'Your cohort stats appear below. All global submissions remain visible — your patients are highlighted on the map.',
        institutionProfile.color || '#f59e0b');
}

function injectCohortDashboard(mode) {
    if (document.getElementById('cohort-dashboard')) return;
    const isResearcher = (mode === 'researcher');
    const color = isResearcher ? '#a855f7' : (institutionProfile && institutionProfile.color) || '#f59e0b';
    const barLabel = isResearcher ? 'Study Coordinator' : (institutionProfile && institutionProfile.cohortLabel) || 'PI View';

    const dash = document.createElement('div');
    dash.id = 'cohort-dashboard';
    dash.innerHTML = `
        <style>
            #cohort-dashboard{position:fixed;bottom:0;left:0;right:0;z-index:9000;background:rgba(10,15,28,0.97);backdrop-filter:blur(16px);border-top:2px solid ${color}55;font-family:'Inter',system-ui,sans-serif;transition:height 0.3s ease;}
            #cohort-dash-header{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.06);}
            .cohort-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${color};border:1px solid ${color}44;padding:3px 10px;border-radius:20px;white-space:nowrap;}
            .cohort-stat{text-align:center;min-width:64px;}
            .cohort-stat-val{font-size:1.2rem;font-weight:800;color:white;line-height:1;}
            .cohort-stat-lbl{font-size:0.6rem;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-top:2px;}
            .cohort-divider{width:1px;height:32px;background:rgba(255,255,255,0.08);flex-shrink:0;}
            .cohort-actions{margin-left:auto;display:flex;gap:8px;align-items:center;}
            .cohort-btn{padding:7px 16px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;border:none;transition:all 0.2s;font-family:inherit;}
            .cohort-btn-export{background:${color};color:#000;}
            .cohort-btn-export:hover{opacity:0.85;}
            .cohort-btn-toggle{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.65);border:1px solid rgba(255,255,255,0.12);}
            .cohort-btn-toggle:hover{background:rgba(255,255,255,0.14);color:white;}
            .cohort-btn-exit{background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);}
            .cohort-btn-exit:hover{background:rgba(239,68,68,0.22);}
            /* Individual records panel */
            #cohort-records-panel{display:none;padding:0 24px 14px;max-height:240px;overflow-y:auto;}
            #cohort-records-panel.open{display:block;}
            .cohort-records-title{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);padding:10px 0 8px;}
            #cohort-records-table{width:100%;border-collapse:collapse;font-size:0.78rem;}
            #cohort-records-table th{text-align:left;color:rgba(255,255,255,0.3);font-weight:600;padding:4px 10px 6px;font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.07);}
            #cohort-records-table td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:rgba(255,255,255,0.75);vertical-align:middle;}
            #cohort-records-table tr:hover td{background:rgba(255,255,255,0.03);}
            .pattern-pill{display:inline-block;font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;}
            .pattern-ina{background:rgba(239,68,68,0.18);color:#f87171;}
            .pattern-una{background:rgba(245,158,11,0.18);color:#fbbf24;}
            .pattern-mixed{background:rgba(168,85,247,0.18);color:#c084fc;}
            .pattern-high{background:rgba(16,185,129,0.18);color:#34d399;}
            .cohort-no-records{color:rgba(255,255,255,0.25);font-size:0.8rem;padding:16px 0;text-align:center;}
            @media(max-width:600px){#cohort-dash-header{padding:10px 14px;gap:12px;}.cohort-actions{width:100%;justify-content:flex-end;}#cohort-records-panel{padding:0 14px 12px;}}
        </style>
        <div id="cohort-dash-header">
            <div class="cohort-label">&#127979; ${barLabel}</div>
            <div class="cohort-divider"></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-total">0</div><div class="cohort-stat-lbl">Assessments</div></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-countries">0</div><div class="cohort-stat-lbl">Countries</div></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-avg">--</div><div class="cohort-stat-lbl">Avg Score</div></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-high">--</div><div class="cohort-stat-lbl">High %</div></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-ina-count" style="color:#f87171;">0</div><div class="cohort-stat-lbl">Intentional</div></div>
            <div class="cohort-stat"><div class="cohort-stat-val" id="cohort-una-count" style="color:#fbbf24;">0</div><div class="cohort-stat-lbl">Unintentional</div></div>
            <div class="cohort-divider"></div>
            <div class="cohort-actions">
                <button class="cohort-btn cohort-btn-toggle" id="cohort-records-toggle" onclick="toggleCohortRecords()">&#128065; Individual Records</button>
                <button class="cohort-btn cohort-btn-toggle" id="cohort-linked-toggle" onclick="toggleLinkedView()" style="border-color:rgba(168,85,247,0.35);color:#c084fc;">&#128279; Linked Participants</button>
                <button class="cohort-btn" onclick="handleBulkUpload()" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);">&#128228; Bulk Upload</button>
                <button class="cohort-btn cohort-btn-export" id="cohort-export-btn">&#11015; Export CSV</button>
                <button class="cohort-btn" onclick="exportLinkedCSV()" style="background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3);">&#128279; Export Linked</button>
                <button class="cohort-btn cohort-btn-exit" id="cohort-exit-btn">Exit PI View</button>
            </div>
        </div>
        <div id="cohort-records-panel">
            <div class="cohort-records-title" style="display:flex;align-items:center;justify-content:space-between;">
                <span>${t('pi_individual_records')}</span>
                <select id="cohort-source-filter" onchange="filterCohortBySource(this.value)" style="font-size:0.65rem;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);cursor:pointer;outline:none;">
                    <option value="">All Sources</option>
                </select>
            </div>
            <table id="cohort-records-table">
                <thead>
                    <tr>
                        <th>${t('pi_col_patient')}</th>
                        <th>${t('pi_col_score')}</th>
                        <th>${t('pi_col_pattern')}</th>
                        <th>${t('pi_col_country')}</th>
                        <th>${t('pi_col_coordinator')}</th>
                        <th>Source</th>
                        <th>${t('pi_col_date')}</th>
                    </tr>
                </thead>
                <tbody id="cohort-records-tbody">
                    <tr><td colspan="7" class="cohort-no-records">${t('pi_no_records')}</td></tr>
                </tbody>
            </table>
        </div>
    `;
    document.body.appendChild(dash);

    document.getElementById('cohort-export-btn').addEventListener('click', exportCohortCSV);
    document.getElementById('cohort-exit-btn').addEventListener('click', deactivateCohortMode);
}

// INA/UNA counts for PI dashboard
let cohortINACount = 0;
let cohortUNACount = 0;
let cohortMixedCount = 0;
let cohortRecords = []; // individual records for PI table

function toggleCohortRecords() {
    const panel = document.getElementById('cohort-records-panel');
    const btn   = document.getElementById('cohort-records-toggle');
    if (!panel) return;
    const isOpen = panel.classList.toggle('open');
    btn.textContent = isOpen ? '▼ Hide Records' : '👁 Individual Records';
}

function loadCohortAssessments() {
    cohortTotal     = 0;
    cohortData      = {};
    cohortHighCount = 0;
    cohortINACount  = 0;
    cohortUNACount  = 0;
    cohortMixedCount= 0;
    cohortRecords   = [];

    if (!institutionCode) {
        console.warn('[ATLAS] loadCohortAssessments: no institutionCode set');
        return;
    }

    console.log('[ATLAS] Loading cohort assessments for code:', institutionCode);

    const seenKeys = new Set();

    // Step 1: load all existing records, filter by institution_code client-side
    database.ref('assessments').once('value', (snap) => {
        const data = snap.val();
        console.log('[ATLAS] assessments snapshot:', data ? Object.keys(data).length + ' records' : 'EMPTY');

        if (data) {
            Object.entries(data).forEach(([key, a]) => {
                seenKeys.add(key);
                if (a.institution_code === institutionCode) {
                    console.log('[ATLAS] matched record:', key, a.patient_number, a.score);
                    processCohortRecord(a);
                }
            });
        }
        updateCohortStats();
        renderCohortRecordsTable();
        console.log('[ATLAS] Initial load complete. cohortTotal:', cohortTotal);

        // Step 2: live listener for NEW records only — attach AFTER initial load
        // so seenKeys is populated and we skip replayed children
        database.ref('assessments').on('child_added', (snap) => {
            const key = snap.key;
            const a   = snap.val();
            if (seenKeys.has(key)) return; // skip replayed existing records
            seenKeys.add(key);
            console.log('[ATLAS] New record detected:', key, 'institution_code:', a.institution_code);
            if (a && a.institution_code === institutionCode) {
                processCohortRecord(a);
                updateCohortStats();
                renderCohortRecordsTable();
            }
        });
    });
}

function processCohortRecord(a) {
    cohortTotal++;
    if (a.score === 8) cohortHighCount++;
    if (a.country) {
        if (!cohortData[a.country]) cohortData[a.country] = { count: 0, totalScore: 0 };
        cohortData[a.country].count++;
        cohortData[a.country].totalScore += a.score;
    }
    highlightCohortMarker(a);

    // Classify INA/UNA from stored question answers if available,
    // otherwise fall back to score-based heuristic
    let pattern = 'una';
    if (a.q1 !== undefined) {
        const answers = { q1:a.q1, q2:a.q2, q3:a.q3, q4:a.q4, q5:a.q5, q6:a.q6, q7:a.q7, q8:a.q8 };
        const { intentional, unintentional } = classifyAdherencePattern(answers);
        pattern = intentional > unintentional ? 'ina' : unintentional > intentional ? 'una' : 'mixed';
    } else if (a.score === 8) {
        pattern = 'high';
    }

    if (pattern === 'ina') cohortINACount++;
    else if (pattern === 'una') cohortUNACount++;
    else if (pattern === 'mixed') cohortMixedCount++;

    cohortRecords.push({
        patient_number: a.patient_number || 'N/A',
        score: a.score,
        pattern: pattern,
        country: a.country || 'Unknown',
        coordinator: a.user_id || 'N/A',
        timestamp: a.timestamp,
        study_id: a.study_id || '—',
        study_name: a.study_name || null,
        pi_name: a.pi_name || null,
        bulk_batch_id: a.bulk_batch_id || null,
        upload_date: a.upload_date || null
    });
    // Keep sorted newest first
    cohortRecords.sort((a,b) => b.timestamp - a.timestamp);
}

let cohortSourceFilter = '';
function filterCohortBySource(val) {
    cohortSourceFilter = val;
    renderCohortRecordsTable();
}

function renderCohortRecordsTable() {
    const tbody = document.getElementById('cohort-records-tbody');
    if (!tbody) return;

    // Populate source filter dropdown with unique study names
    const filterEl = document.getElementById('cohort-source-filter');
    if (filterEl) {
        const sources = [...new Set(cohortRecords.map(r => r.study_name).filter(Boolean))].sort();
        const currentVal = filterEl.value;
        filterEl.innerHTML = '<option value="">All Sources</option>' +
            sources.map(s => `<option value="${s}" ${s === currentVal ? 'selected' : ''}>${s}</option>`).join('');
        cohortSourceFilter = filterEl.value;
    }

    const visible = cohortSourceFilter
        ? cohortRecords.filter(r => r.study_name === cohortSourceFilter)
        : cohortRecords;

    if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="cohort-no-records">${t('pi_no_records')}</td></tr>`;
        return;
    }

    const patternLabels = {
        ina:   `<span class="pattern-pill pattern-ina">${t('pi_ina_label')}</span>`,
        una:   `<span class="pattern-pill pattern-una">${t('pi_una_label')}</span>`,
        mixed: `<span class="pattern-pill pattern-mixed">${t('pi_mixed_label')}</span>`,
        high:  `<span class="pattern-pill pattern-high">${t('pi_high_label')}</span>`
    };

    tbody.innerHTML = visible.slice(0, 100).map(r => {
        const cat   = getAdherenceCategory(r.score);
        const date  = new Date(r.timestamp).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        const pill  = patternLabels[r.pattern] || patternLabels.una;
        const studyTag = r.study_id !== '—' ? `<span style="font-size:0.62rem;color:rgba(255,255,255,0.3);margin-left:4px;">[${r.study_id}]</span>` : '';
        const uploadAgo = r.upload_date ? (() => {
            const days = Math.round((Date.now() - r.upload_date) / 86400000);
            return days === 0 ? 'today' : days === 1 ? '1d ago' : days + 'd ago';
        })() : null;
        const sourceCell = r.study_name
            ? `<span style="font-size:0.68rem;color:rgba(255,255,255,0.75);">${r.study_name}</span>` +
              (r.pi_name ? `<br><span style="font-size:0.6rem;color:rgba(255,255,255,0.35);">${r.pi_name}</span>` : '') +
              (uploadAgo ? `<br><span style="font-size:0.58rem;color:rgba(255,255,255,0.25);">Uploaded ${uploadAgo}</span>` : '')
            : `<span style="font-size:0.65rem;color:rgba(255,255,255,0.2);">—</span>`;
        return `<tr>
            <td>${r.patient_number}${studyTag}</td>
            <td><span style="font-weight:700;color:${cat.color};">${r.score.toFixed(2)}</span></td>
            <td>${pill}</td>
            <td>${r.country}</td>
            <td style="font-size:0.7rem;color:rgba(255,255,255,0.4);">${r.coordinator}</td>
            <td style="line-height:1.4;">${sourceCell}</td>
            <td style="font-size:0.7rem;color:rgba(255,255,255,0.4);">${date}</td>
        </tr>`;
    }).join('');
}

function highlightCohortMarker(assessment) {
    // Add a glowing ring around the map marker for this institution's submissions
    if (!assessment.latitude || !assessment.longitude) return;
    const color = (institutionProfile && institutionProfile.color) || '#f59e0b';
    const locationKey = parseFloat(assessment.latitude).toFixed(4) + ',' + parseFloat(assessment.longitude).toFixed(4);
    const locationData = markersByLocation[locationKey];
    if (!locationData || !locationData.marker) return;

    const el = locationData.marker.getElement();
    if (!el) return;

    // Apply a glowing border ring — idempotent, safe to call multiple times
    el.style.outline = '3px solid ' + color;
    el.style.outlineOffset = '3px';
    el.style.boxShadow = '0 0 0 4px ' + color + '55, 0 2px 8px rgba(0,0,0,0.3)';

    // Add a small institution badge if not already present
    if (!el.querySelector('.cohort-badge')) {
        const badge = document.createElement('div');
        badge.className = 'cohort-badge';
        badge.style.cssText = 'position:absolute;top:-8px;right:-8px;width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);';
        el.appendChild(badge);
    }
}

function updateCohortStats() {
    const totalEl = document.getElementById('cohort-total');
    if (totalEl) totalEl.textContent = cohortTotal.toLocaleString();

    const countriesEl = document.getElementById('cohort-countries');
    if (countriesEl) countriesEl.textContent = Object.keys(cohortData).length;

    let ts = 0, tc = 0;
    Object.values(cohortData).forEach(d => { ts += d.totalScore; tc += d.count; });

    const avgEl = document.getElementById('cohort-avg');
    if (avgEl) avgEl.textContent = tc > 0 ? (ts / tc).toFixed(2) : '--';

    const highEl = document.getElementById('cohort-high');
    if (highEl && cohortTotal > 0) {
        const pct = cohortHighCount > 0 ? Math.round((cohortHighCount / cohortTotal) * 100) : 0;
        highEl.textContent = pct + '%';
    }

    const inaEl = document.getElementById('cohort-ina-count');
    if (inaEl) inaEl.textContent = cohortINACount;

    const unaEl = document.getElementById('cohort-una-count');
    if (unaEl) unaEl.textContent = cohortUNACount;
}

function exportCohortCSV() {
    database.ref('assessments').once('value', (snap) => {
        const allData = snap.val();
        if (!allData) { showToast('No cohort data to export yet.', 3000); return; }

        const cohortData = Object.values(allData).filter(a => a.institution_code === institutionCode);
        if (!cohortData.length) { showToast('No records found for this institution code yet.', 3000); return; }

        const headers = ['User_ID','Timestamp','Country','City','Patient_Number','Study_ID','Study_Name','PI_Name','Upload_Date','Bulk_Batch_ID','Condition','Drug_Type','Drug_Name','Drug_Strength','Route','Gender','Age_Range','Education_Level','Score','Adherence_Level','INA_UNA_Pattern','Data_Tier','Latitude','Longitude','Institution_Code'];
        const rows = cohortData.map(a => {
            let pattern = 'N/A';
            if (a.q1 !== undefined) {
                const { intentional, unintentional } = classifyAdherencePattern(a);
                pattern = intentional > unintentional ? 'INA' : unintentional > intentional ? 'UNA' : 'Mixed';
            }
            return [
                a.user_id||'N/A', new Date(a.timestamp).toISOString(),
                a.country||'Unknown', a.city||'Unknown',
                a.patient_number||'N/A', a.study_id||'N/A',
                a.study_name||'N/A', a.pi_name||'N/A',
                a.upload_date ? new Date(a.upload_date).toISOString() : 'N/A',
                a.bulk_batch_id||'N/A',
                a.condition||'N/A', a.drug_type||'N/A',
                a.drug_name||'N/A', a.drug_strength||'N/A',
                a.route_of_administration||'N/A', a.gender||'N/A',
                a.age_range||'N/A', a.education_level||'N/A',
                a.score.toFixed(2), a.adherence_level||'N/A',
                pattern, a.data_tier||'N/A',
                a.latitude||0, a.longitude||0,
                a.institution_code||institutionCode
            ];
        });
        triggerCSVDownload(headers, rows, (institutionProfile.cohortLabel||'cohort').replace(/\s+/g,'-') + '-' + new Date().toISOString().split('T')[0] + '.csv');
    });
}

function deactivateCohortMode() {
    cohortMode = false;

    // Remove cohort highlight rings from map markers
    document.querySelectorAll('.cohort-badge').forEach(b => b.remove());
    Object.values(markersByLocation).forEach(loc => {
        if (loc.marker) {
            const el = loc.marker.getElement();
            if (el) {
                el.style.outline = '';
                el.style.outlineOffset = '';
                el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }
        }
    });

    // Reset cohort state but preserve session role — researcher stays researcher
    institutionCode  = null;
    institutionProfile = null;
    cohortTotal      = 0;
    cohortData       = {};
    cohortHighCount  = 0;
    cohortINACount   = 0;
    cohortUNACount   = 0;
    cohortMixedCount = 0;
    cohortRecords    = [];
    pairIndex        = {};
    sessionStorage.removeItem('atlas_inst_code');
    sessionStorage.removeItem('atlas_inst_profile');
    document.body.removeAttribute('data-cohort');

    // Just close the dashboard — do NOT reset role or re-show role selection
    const dash = document.getElementById('cohort-dashboard');
    if (dash) {
        dash.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        dash.style.opacity = '0';
        dash.style.transform = 'translateY(8px)';
        setTimeout(() => { if (dash.parentNode) dash.remove(); }, 250);
    }
}


// ═══════════════════════════════════════════════════════
// POST-SUBMISSION RESULT CARD
// ═══════════════════════════════════════════════════════

// Intentional / Unintentional mapping (Philip Morisky, 2026)
// Intentional:   Q2, Q3, Q6, Q7  (score 0 = failed)
// Unintentional: Q1, Q4          (score 0 = failed)
// Neutral:       Q5
// Q8 (frequency): unintentional when score < 1

function classifyAdherencePattern(answers) {
    // answers = { q1, q2, q3, q4, q5, q6, q7, q8 } — raw float values
    let intentional   = 0;
    let unintentional = 0;

    if (parseFloat(answers.q1) === 0) unintentional++;
    if (parseFloat(answers.q2) === 0) intentional++;
    if (parseFloat(answers.q3) === 0) intentional++;
    if (parseFloat(answers.q4) === 0) unintentional++;
    // q5 neutral — skip
    if (parseFloat(answers.q6) === 0) intentional++;
    if (parseFloat(answers.q7) === 0) intentional++;
    if (parseFloat(answers.q8) < 1)   unintentional++;

    return { intentional, unintentional };
}

function getResultCardContent(score, answers, role) {
    const cat = getAdherenceCategory(score);

    // ── HIGH (score = 8) ─────────────────────────────────────────────────────
    if (score === 8) {
        return {
            headline: t('rc_high_headline'),
            subline:  t('rc_high_subline'),
            message:  role === 'individual' ? t('rc_high_msg_patient') : t('rc_high_msg_clin'),
            tips: null, referral: null, color: cat.color
        };
    }

    // ── MEDIUM (6–7.99) ──────────────────────────────────────────────────────
    if (score >= 6) {
        return {
            headline: t('rc_med_headline'),
            subline:  t('rc_med_subline'),
            message:  role === 'individual' ? t('rc_med_msg_patient') : t('rc_med_msg_clin'),
            tips:     role === 'individual' ? t('rc_med_tips') : null,
            referral: null, color: cat.color
        };
    }

    // ── LOW (<6) — intentional / unintentional branching ────────────────────
    const { intentional, unintentional } = classifyAdherencePattern(answers);
    const dominantPattern = intentional > unintentional ? 'intentional'
                          : unintentional > intentional  ? 'unintentional'
                          : 'mixed';

    if (role !== 'individual') {
        const patternLabel = dominantPattern === 'intentional'   ? t('rc_clin_int')
                           : dominantPattern === 'unintentional' ? t('rc_clin_unint')
                           : t('rc_clin_mixed');
        return {
            headline: 'Low Adherence',
            subline:  patternLabel,
            message:  patternLabel,
            tips: null, referral: null, color: cat.color, pattern: dominantPattern
        };
    }

    // Patient — empathetic, pattern-specific
    if (dominantPattern === 'intentional') {
        return {
            headline: t('rc_int_headline'),   subline: t('rc_int_subline'),
            message:  t('rc_int_msg'),        tips: null,
            referral: { label: t('rc_int_ref_label'), text: t('rc_int_ref_text') },
            color: cat.color, pattern: 'intentional'
        };
    }
    if (dominantPattern === 'unintentional') {
        return {
            headline: t('rc_unint_headline'), subline: t('rc_unint_subline'),
            message:  t('rc_unint_msg'),      tips: t('rc_unint_tips'),
            referral: null, color: cat.color, pattern: 'unintentional'
        };
    }
    // Mixed
    return {
        headline: t('rc_mixed_headline'), subline: t('rc_mixed_subline'),
        message:  t('rc_mixed_msg'),      tips: t('rc_mixed_tips'),
        referral: { label: t('rc_mixed_ref_label'), text: t('rc_mixed_ref_text') },
        color: cat.color, pattern: 'mixed'
    };
}


function showResultCard(score, answers, role, globalAvg, cohortInfo) {
    const content = getResultCardContent(score, answers, role);
    const cat     = getAdherenceCategory(score);
    const scorePct = Math.round((score / 8) * 100);

    // Build gauge arc (SVG)
    const radius = 54;
    const circ   = Math.PI * radius; // half-circle
    const offset = circ - (scorePct / 100) * circ;
    const gaugeColor = cat.color;

    // Tips HTML
    let tipsHTML = '';
    if (content.tips && content.tips.length) {
        tipsHTML = '<div class="rc-tips"><div class="rc-tips-title">' + t('rc_steps_title') + '</div>' +
            content.tips.map(t => '<div class="rc-tip"><span class="rc-tip-dot"></span><span>' + t + '</span></div>').join('') +
            '</div>';
    }

    // Referral HTML
    let referralHTML = '';
    if (content.referral) {
        referralHTML = '<div class="rc-referral"><div class="rc-referral-icon">&#128203;</div>' +
            '<div><div class="rc-referral-label">' + content.referral.label + '</div>' +
            '<div class="rc-referral-text">' + content.referral.text + '</div></div></div>';
    }

    // Global average comparison
    let compareHTML = '';
    if (globalAvg !== null && globalAvg > 0) {
        const myPct  = Math.round((score / 8) * 100);
        const avgPct = Math.round((globalAvg / 8) * 100);
        compareHTML = '<div class="rc-compare">' +
            '<div class="rc-compare-title">' + t('rc_compare_title') + '</div>' +
            '<div class="rc-compare-row"><span class="rc-compare-lbl">' + t('rc_compare_yours') + '</span>' +
            '<div class="rc-compare-bar-wrap"><div class="rc-compare-bar" style="width:' + myPct + '%;background:' + cat.color + ';"></div></div>' +
            '<span class="rc-compare-val" style="color:' + cat.color + ';">' + score.toFixed(2) + '</span></div>' +
            '<div class="rc-compare-row"><span class="rc-compare-lbl">' + t('rc_compare_global') + '</span>' +
            '<div class="rc-compare-bar-wrap"><div class="rc-compare-bar" style="width:' + avgPct + '%;background:#60a5fa;"></div></div>' +
            '<span class="rc-compare-val" style="color:#60a5fa;">' + globalAvg.toFixed(2) + '</span></div>' +
            '</div>';
    }

    // Cohort tag
    let cohortHTML = '';
    if (cohortInfo) {
        cohortHTML = '<div class="rc-cohort-tag" style="border-color:' + (cohortInfo.color || '#f59e0b') + '44;color:' + (cohortInfo.color || '#f59e0b') + ';">&#127973; Added to ' + cohortInfo.cohortLabel + '</div>';
    }

    const modal = document.createElement('div');
    modal.id = 'result-card-modal';
    modal.innerHTML = `
        <style>
            #result-card-modal{position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,0.82);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',system-ui,sans-serif;animation:rcFadeIn 0.35s ease;}
            @keyframes rcFadeIn{from{opacity:0;}to{opacity:1;}}
            @keyframes rcSlideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
            .rc-box{background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:36px 32px;max-width:520px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:rcSlideUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both;max-height:90vh;overflow-y:auto;}
            .rc-top{text-align:center;margin-bottom:24px;}
            .rc-gauge-wrap{position:relative;width:140px;height:76px;margin:0 auto 16px;}
            .rc-gauge-track{fill:none;stroke:rgba(255,255,255,0.08);stroke-width:10;stroke-linecap:round;}
            .rc-gauge-fill{fill:none;stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(0.34,1.2,0.64,1);}
            .rc-score-val{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:2rem;font-weight:800;color:white;line-height:1;}
            .rc-score-max{font-size:0.9rem;color:rgba(255,255,255,0.35);font-weight:400;}
            .rc-headline{font-size:1.25rem;font-weight:800;margin-bottom:6px;}
            .rc-subline{font-size:0.82rem;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px;}
            .rc-message{font-size:0.9rem;color:rgba(255,255,255,0.75);line-height:1.65;background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;margin-bottom:16px;}
            .rc-tips{margin-bottom:16px;}
            .rc-tips-title{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin-bottom:10px;}
            .rc-tip{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.85rem;color:rgba(255,255,255,0.7);line-height:1.5;}
            .rc-tip:last-child{border-bottom:none;}
            .rc-tip-dot{width:7px;height:7px;border-radius:50%;background:#60a5fa;flex-shrink:0;margin-top:6px;}
            .rc-referral{display:flex;gap:14px;align-items:flex-start;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:14px 16px;margin-bottom:16px;}
            .rc-referral-icon{font-size:1.4rem;flex-shrink:0;}
            .rc-referral-label{font-size:0.88rem;font-weight:700;color:#f59e0b;margin-bottom:4px;}
            .rc-referral-text{font-size:0.82rem;color:rgba(255,255,255,0.6);line-height:1.55;}
            .rc-compare{margin-bottom:16px;}
            .rc-compare-title{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin-bottom:10px;}
            .rc-compare-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
            .rc-compare-lbl{font-size:0.75rem;color:rgba(255,255,255,0.45);width:72px;flex-shrink:0;}
            .rc-compare-bar-wrap{flex:1;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;}
            .rc-compare-bar{height:100%;border-radius:4px;transition:width 1s cubic-bezier(0.34,1.2,0.64,1);}
            .rc-compare-val{font-size:0.82rem;font-weight:700;width:32px;text-align:right;flex-shrink:0;}
            .rc-cohort-tag{display:inline-block;font-size:0.72rem;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid;margin-bottom:16px;letter-spacing:0.5px;}
            .rc-global-tag{font-size:0.72rem;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:20px;}
            .rc-global-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;margin-right:5px;animation:rcPulse 2s ease-in-out infinite;}
            @keyframes rcPulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
            .rc-done-btn{width:100%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;border-radius:12px;padding:15px;font-size:1rem;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px;}
            .rc-done-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,0.4);}
            @media(max-width:480px){.rc-box{padding:24px 18px;border-radius:18px;}}
        </style>
        <div class="rc-box">
            <div class="rc-top">
                <div class="rc-gauge-wrap">
                    <svg width="140" height="76" viewBox="0 0 140 76">
                        <path class="rc-gauge-track" d="M 14 70 A 56 56 0 0 1 126 70" stroke-dasharray="${Math.PI * radius}" stroke-dashoffset="0"/>
                        <path class="rc-gauge-fill" d="M 14 70 A 56 56 0 0 1 126 70"
                            stroke="${gaugeColor}"
                            stroke-dasharray="${circ}"
                            stroke-dashoffset="${circ}"
                            id="rc-gauge-path"/>
                    </svg>
                    <div class="rc-score-val">${score.toFixed(1)}<span class="rc-score-max">/8</span></div>
                </div>
                <div class="rc-headline" style="color:${cat.color};">${content.headline}</div>
                <div class="rc-subline">${content.subline}</div>
            </div>
            <div class="rc-message">${content.message}</div>
            ${tipsHTML}
            ${referralHTML}
            ${compareHTML}
            ${cohortHTML}
            <div class="rc-global-tag"><span class="rc-global-dot"></span>${t('rc_global_tag')}</div>
            <button class="rc-done-btn" id="rc-done-btn">${t('rc_done')}</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Animate gauge after paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const path = document.getElementById('rc-gauge-path');
            if (path) path.style.strokeDashoffset = offset;
        });
    });

    // Dismiss
    document.getElementById('rc-done-btn').addEventListener('click', () => {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '0';
        setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 300);
    });

    // Also dismiss on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) document.getElementById('rc-done-btn').click();
    });
}

// ═══════════════════════════════════════════════════════
// SINGLE BOOT — ALL DOM wiring in one place
// ═══════════════════════════════════════════════════════

// ── DOM self-patcher — stamps data-question/data-en/data-yesno/data-freq ──────
// Runs once at boot. Walks the form and finds the text element closest to each
// radio group, then caches the English text in data-en so we can restore it.
// This makes the HTML file translation-ready without touching it directly.
function patchMMASFormDOM() {
    for (let i = 1; i <= 8; i++) {
        // Find any radio input for this question
        const radio = document.querySelector('input[name="q' + i + '"]');
        if (!radio) continue;

        // Walk up the DOM until we find a container that holds the question text
        // Strategy: go up 2–4 levels, then find the first text-heavy element
        let container = radio.closest('fieldset, .question, .q-block, [class*="question"], [class*="item"], li, div') || radio.parentElement;
        // Keep going up until we find something with substantial text
        for (let depth = 0; depth < 6 && container; depth++) {
            const textNodes = Array.from(container.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim().length > 15);
            if (textNodes.length) break;
            const labelEl = container.querySelector('label, legend, p, span, div');
            if (labelEl && labelEl.textContent.trim().length > 15) break;
            container = container.parentElement;
        }

        // Find the best text element to stamp
        let textEl = null;

        // First look for a <label>, <legend>, or <p> with real content
        if (container) {
            const candidates = Array.from(container.querySelectorAll('label, legend, p, .question-text, [class*="label"], [class*="text"]'))
                .filter(el => el.textContent.trim().length > 15 && !el.querySelector('input'));
            if (candidates.length) textEl = candidates[0];
        }

        // Fallback: find the label that wraps or precedes the radio group
        if (!textEl) {
            const label = document.querySelector('label[for="q' + i + '_yes"], label[for="q' + i + '_no"]');
            if (label && label.parentElement) {
                const parent = label.parentElement;
                const textChild = Array.from(parent.children).find(el => el.tagName !== 'INPUT' && el.tagName !== 'LABEL' && el.textContent.trim().length > 15);
                textEl = textChild || null;
            }
        }

        if (textEl && !textEl.getAttribute('data-question')) {
            textEl.setAttribute('data-question', 'q' + i);
            // Cache the English text so we can always restore it
            textEl.setAttribute('data-en', textEl.textContent.trim());
        }
    }

    // Stamp Yes/No labels — look for labels with text "Yes" or "No" next to radio inputs
    document.querySelectorAll('input[type="radio"]').forEach(input => {
        const name = input.getAttribute('name');
        if (!name || !/^q[1-7]$/.test(name)) return;
        const label = document.querySelector('label[for="' + input.id + '"]') ||
                      input.closest('label');
        if (!label) return;
        const txt = label.textContent.trim().toLowerCase();
        if (txt === 'yes' || txt === 'oui' || txt === 'sí' || txt === 'sim') {
            label.setAttribute('data-yesno', 'yes');
            label.setAttribute('data-en', 'Yes');
        } else if (txt === 'no') {
            label.setAttribute('data-yesno', 'no');
            label.setAttribute('data-en', 'No');
        }
    });

    // Stamp Q8 frequency labels
    const freqEnMap = {
        'never': 'q8_never',
        'rarely': 'q8_once',
        'sometimes': 'q8_sometimes',
        'often': 'q8_usually',
        'all of the time': 'q8_always', 'all the time': 'q8_always', 'always': 'q8_always',
        // legacy aliases kept for safety
        'never / rarely': 'q8_never', 'never/rarely': 'q8_never',
        'once in a while': 'q8_once', 'usually': 'q8_usually'
    };
    const q8radios = document.querySelectorAll('input[name="q8"]');
    q8radios.forEach(input => {
        const label = document.querySelector('label[for="' + input.id + '"]') || input.closest('label');
        if (!label) return;
        const txt = label.textContent.trim().toLowerCase();
        const freqKey = freqEnMap[txt];
        if (freqKey) {
            label.setAttribute('data-freq', freqKey);
            label.setAttribute('data-en', label.textContent.trim());
        }
    });

    // Insert mmas-lang-note element after the form header if it doesn't exist
    if (!document.getElementById('mmas-lang-note')) {
        const form = document.getElementById('mmas-form');
        if (form) {
            const note = document.createElement('p');
            note.id = 'mmas-lang-note';
            note.style.cssText = 'display:none;font-size:0.8rem;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:8px 14px;margin:0 0 16px;';
            form.insertBefore(note, form.firstChild);
        }
    }

    console.log('[i18n] DOM patched — data-question attributes stamped');
}

document.addEventListener('DOMContentLoaded', async () => {

    // Map view toggles
    document.getElementById('globe-btn').addEventListener('click', () => {
        if (currentMapStyle !== 'globe') {
            map.setProjection('globe'); currentMapStyle = 'globe';
            document.getElementById('globe-btn').classList.add('active');
            document.getElementById('flat-btn').classList.remove('active');
        }
    });
    document.getElementById('flat-btn').addEventListener('click', () => {
        if (currentMapStyle !== 'flat') {
            map.setProjection('mercator'); currentMapStyle = 'flat';
            document.getElementById('flat-btn').classList.add('active');
            document.getElementById('globe-btn').classList.remove('active');
            map.flyTo({ center: [0, 20], zoom: 1.5, duration: 1000 });
        }
    });

    // Legend toggle
    document.getElementById('legend-toggle').addEventListener('click', () => {
        const cs = document.getElementById('country-stats');
        const tg = document.getElementById('legend-toggle');
        if (cs.style.display === 'none') { cs.style.display = 'block'; tg.textContent = 'Hide Details'; }
        else { cs.style.display = 'none'; tg.textContent = 'Show Details'; }
    });

    // Overlay minimize
    setupOverlayMinimize('stats-overlay');
    setupOverlayMinimize('insights-panel');
    setupOverlayMinimize('map-legend');

    // Spectator mode
    initCinematicSpectator();
    buildTickerBar();
    document.getElementById('spectator-btn').addEventListener('click', enterCinematicSpectator);
    const exitBtn = document.getElementById('exit-spectator');
    if (exitBtn) exitBtn.addEventListener('click', exitCinematicSpectator);

    // Radio buttons for score
    document.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', calculateScore));

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Form submission
    document.getElementById('mmas-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (answeredQuestions < 8) { alert(t('answer_all')); return; }

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true; submitBtn.textContent = t('submitting');

        try {
            const formData = new FormData(e.target);

            // Collect raw question answers for INA/UNA classification + storage
            const rawAnswers = {};
            for (let i = 1; i <= 7; i++) {
                const sel = document.querySelector('input[name="q' + i + '"]:checked');
                rawAnswers['q' + i] = sel ? parseFloat(sel.value) : 1;
            }
            const q8sel = document.querySelector('input[name="q8"]:checked');
            rawAnswers.q8 = q8sel ? parseFloat(q8sel.value) : 1;

            // Determine data tier: individual = public/anonymous, coordinator/PI = clinical/protected
            const dataTier = (userRole === 'patient' || userRole === 'individual' || !userRole) ? 'public' : 'clinical';

            const submissionData = {
                user_id: userId, timestamp: Date.now(), score: currentScore,
                adherence_level: getAdherenceCategory(currentScore).label,
                country: formData.get('country') || userLocation.country,
                city:    formData.get('city')    || userLocation.city,
                latitude: userLocation.latitude, longitude: userLocation.longitude,
                country_code: userLocation.country_code,
                patient_number: formData.get('patient_number') || 'PAT-' + Date.now().toString(36).toUpperCase(),
                condition: formData.get('condition'), drug_type: formData.get('drug_type'),
                drug_name: formData.get('drug_name'), drug_strength: formData.get('drug_strength'),
                route_of_administration: formData.get('route') || 'Not specified',
                gender: formData.get('gender'), age_range: formData.get('age'), education_level: formData.get('education'),
                role: userRole || 'patient',
                data_tier: dataTier,
                study_id: formData.get('study_id') || null,
                // Store raw answers for INA/UNA computation at PI level
                q1: rawAnswers.q1, q2: rawAnswers.q2, q3: rawAnswers.q3, q4: rawAnswers.q4,
                q5: rawAnswers.q5, q6: rawAnswers.q6, q7: rawAnswers.q7, q8: rawAnswers.q8
            };
            // Tag with institution code if user is in PI/institution role
            if (institutionCode) submissionData.institution_code = institutionCode;

            // ── TRIPLE-WRITE ──────────────────────────────────────────
            // 1. Full record (with PII) → /assessments  (private)
            // 2. Anonymized point       → /mapData       (public map feed)
            // 3. Aggregate counters     → /public_stats  (public website stats)
            const newRef = database.ref('assessments').push();
            await newRef.set(submissionData);
            await database.ref('mapData').push({
                score:          submissionData.score,
                adherence_level: submissionData.adherence_level,
                latitude:       submissionData.latitude,
                longitude:      submissionData.longitude,
                country:        submissionData.country,
                city:           submissionData.city,
                timestamp:      submissionData.timestamp,
                assessment_ref: newRef.key   // link back for researcher exports
            });
            updatePublicStats(submissionData.score, submissionData.country);

            submitBtn.textContent = t('submitted'); submitBtn.style.background = '#10b981';

            // Calculate global average for comparison bar
            let globalAvgVal = 0;
            if (totalAssessments > 0) {
                let ts = 0, tc = 0;
                Object.values(countryData).forEach(d => { ts += d.totalScore; tc += d.count; });
                globalAvgVal = tc > 0 ? ts / tc : 0;
            }

            // Cohort tag if in institution mode
            const cohortInfo = (cohortMode && institutionProfile) ? institutionProfile : null;

            // Show result card — replaces alert()
            showResultCard(currentScore, rawAnswers, userRole || 'individual', globalAvgVal, cohortInfo);

            // Reset form after card is shown
            setTimeout(() => {
                document.getElementById('mmas-form').reset();
                if (userLocation) {
                    const ci = document.getElementById('country-input'); if (ci) ci.value = userLocation.country || '';
                    const cy = document.getElementById('city-input');    if (cy) cy.value = userLocation.city    || '';
                }
                currentScore = 0; answeredQuestions = 0; updateScoreDisplay();
                submitBtn.disabled = false; submitBtn.textContent = t('submit_btn'); submitBtn.style.background = '';
            }, 1200);

        } catch (error) {
            console.error('Error submitting assessment:', error);
            alert('Error submitting assessment. Please try again.');
            submitBtn.disabled = false; submitBtn.textContent = t('submit_btn');
        }
    });

    // Boot: patch DOM for translation attributes, then init translations
    patchMMASFormDOM();
    await initTranslations();

    // ── Geolocation consent hook ──────────────────────────────────────────
    // The consent modal "Continue" button lives in the HTML (id="cm-proceed-btn").
    // If the user arrived from the portal they already consented — auto-dismiss.
    // Otherwise intercept its click to fire requestGeolocation() before dismiss.
    const cmBtn = document.getElementById('cm-proceed-btn');
    const consentModal = document.getElementById('consent-modal');
    if (cmBtn && sessionStorage.getItem('atlas_role')) {
        // Portal handoff — consent already given, dismiss silently and fire geo
        requestGeolocation().then(() => {
            const ci = document.getElementById('country-input'); if (ci && userLocation) ci.value = userLocation.country || '';
            const cy = document.getElementById('city-input');    if (cy && userLocation) cy.value = userLocation.city    || '';
        });
        if (consentModal) {
            consentModal.style.transition = 'opacity 0.3s';
            consentModal.style.opacity = '0';
            setTimeout(() => { if (consentModal.parentNode) consentModal.parentNode.removeChild(consentModal); }, 320);
        }
    }
    if (cmBtn && !sessionStorage.getItem('atlas_role')) {
        const originalClick = cmBtn.onclick;
        cmBtn.addEventListener('click', async () => {
            // Only fire once — after first click the button is removed from DOM
            if (cmBtn.dataset.geoRequested) return;
            cmBtn.dataset.geoRequested = '1';
            // Fire geolocation request in background; don't block the UI
            requestGeolocation().then(() => {
                const ci = document.getElementById('country-input'); if (ci && userLocation) ci.value = userLocation.country || '';
                const cy = document.getElementById('city-input');    if (cy && userLocation) cy.value = userLocation.city    || '';
            });
        }, true); // capture phase — runs before the inline handler closes the modal
    }

    // ── Portal session handoff ─────────────────────────────────────────────
    // If the user arrived from the portal with a role already set via
    // sessionStorage 'atlas_role', skip the role selection modal entirely.
    // Also pick up any workspace code passed in the URL (?workspace=CODE).
    (function bootstrapRole() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlWorkspace = urlParams.get('workspace');
        if (urlWorkspace && urlWorkspace.trim()) {
            const code = urlWorkspace.trim().toUpperCase();
            sessionStorage.setItem('atlas_role', 'researcher');
            sessionStorage.setItem('atlas_inst_code', code);
        }
        const existingRole = sessionStorage.getItem('atlas_role');
        if (existingRole) {
            userRole = existingRole;
            institutionCode = sessionStorage.getItem('atlas_inst_code') || null;
            applyRole(userRole);
        } else {
            showRoleSelection();
        }
    })();
    (async () => {
        userId = getUserId();
        // requestGeolocation() tries GPS first, falls back to IP silently.
        // On first visit this races with the consent modal hook (both resolve fine).
        // On return visits (consent already accepted) this runs immediately.
        await requestGeolocation();
        if (userLocation) {
            const ci = document.getElementById('country-input'); if (ci) ci.value = userLocation.country || '';
            const cy = document.getElementById('city-input');    if (cy) cy.value = userLocation.city    || '';
        }
        loadExistingAssessments();
        updateScoreDisplay();
    })();

});
