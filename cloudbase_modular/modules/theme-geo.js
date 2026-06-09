// ══════════════════════════════════════════════
// THEME TOGGLE — Night / Daylight
// ══════════════════════════════════════════════
// ── Collapsible instrument cards ──────────────────────────────────────────────
/**
 * Toggles the collapsed state of a dashboard instrument card and persists the state
 * to localStorage. Resizes any embedded Mapbox globe when expanding.
 * @param {string} cardId - ID of the card element to collapse or expand
 * @returns {void}
 */
function toggleCardCollapse(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const isCollapsed = card.classList.toggle('collapsed');
  // Persist collapsed state per card
  try { localStorage.setItem('atlas_card_collapsed_' + cardId, isCollapsed ? '1' : '0'); } catch(e) {}
  // When expanding, resize any Mapbox globe inside
  if (!isCollapsed) {
    const globeEl = card.querySelector('.mc-thumb-map');
    if (globeEl) setTimeout(() => {
      if (cardId === 'dash-launch-map' && window.dashMiniMap) dashMiniMap.resize();
      if (cardId === 'dash-launch-peacs' && window.dashMiniPeacs) dashMiniPeacs.resize();
      if (cardId === 'dash-launch-mmas' && window.dashMiniMmas) dashMiniMmas.resize();
    }, 380);
  }
}
// Restore collapsed state on page load
/**
 * Reads collapsed-state flags from localStorage and restores collapsed classes
 * to each dashboard instrument card on page load.
 * @returns {void}
 */
function restoreCardCollapseState() {
  ['dash-launch-map','dash-launch-peacs','dash-launch-mmas'].forEach(id => {
    try {
      if (localStorage.getItem('atlas_card_collapsed_' + id) === '1') {
        const card = document.getElementById(id);
        if (card) card.classList.add('collapsed');
      }
    } catch(e) {}
  });
}

/** Flips the current theme between dark and light and persists the choice to localStorage. @returns {void} */
function toggleTheme() {
  const html    = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  const newTheme = isLight ? 'dark' : 'light';
  applyTheme(newTheme);
  try { localStorage.setItem('atlas_theme', newTheme); } catch(e) {}
}

/**
 * Applies a theme to the document, updates all toggle buttons and labels, switches all
 * active Mapbox map styles, and re-applies fog settings after style change.
 * @param {'light'|'dark'} theme - The theme to apply
 * @returns {void}
 */
function applyTheme(theme) {
  const html = document.documentElement;
  const isLight = (theme === 'light');

  // Apply CSS theme
  if (isLight) { html.setAttribute('data-theme', 'light'); }
  else         { html.removeAttribute('data-theme'); }

  // Update all toggle button icons + labels across every nav
  const iconIds  = ['theme-toggle-icon','theme-toggle-icon-mmas','theme-toggle-icon-peacs','theme-toggle-icon-float','theme-toggle-icon-acc','theme-toggle-icon-stu'];
  const labelIds = ['theme-toggle-label','theme-toggle-label-mmas','theme-toggle-label-peacs','theme-toggle-label-float','theme-toggle-label-acc','theme-toggle-label-stu'];
  iconIds.forEach(id  => { const el = document.getElementById(id);  if (el) el.textContent = isLight ? '☽' : '☀'; });
  labelIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = isLight ? 'Night' : 'Daylight'; });

  // Update ACC toggle switch knob
  const accSwitch = document.getElementById('acc-theme-switch');
  const accKnob   = document.getElementById('acc-theme-knob');
  if (accSwitch && accKnob) {
    accKnob.style.transform  = isLight ? 'translateX(24px)' : 'translateX(0)';
    accKnob.textContent      = isLight ? '☽' : '☀';
    accKnob.style.background = isLight ? 'rgba(78,156,245,0.9)' : 'rgba(212,168,67,0.9)';
    accSwitch.style.background    = isLight ? 'rgba(78,156,245,0.15)' : 'rgba(212,168,67,0.15)';
    accSwitch.style.borderColor   = isLight ? 'rgba(78,156,245,0.35)'  : 'rgba(212,168,67,0.35)';
  }

  // Update float button visual for light mode
  const floatBtn = document.getElementById('theme-toggle-float');
  if (floatBtn) {
    floatBtn.style.background    = isLight ? 'rgba(247,245,240,0.92)' : 'rgba(13,21,37,0.82)';
    floatBtn.style.borderColor   = isLight ? 'rgba(0,0,0,0.15)'       : 'rgba(255,255,255,0.12)';
    floatBtn.style.color         = isLight ? '#2c3a4a'                 : 'rgba(180,200,220,0.85)';
  }

  // Switch all Mapbox map styles + re-apply fog after style loads (setStyle wipes fog)
  const mapStyle = isLight ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11';
  const nightFog2 = {
    color: '#04091c', 'high-color': '#0d1a3a',
    'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
  };
  const dayFog2 = {
    color: 'rgba(186,210,235,0.9)', 'high-color': 'rgba(120,170,210,0.8)',
    'horizon-blend': 0.04, 'space-color': '#d8eaf7', 'star-intensity': 0.0
  };
  const fog = isLight ? dayFog2 : nightFog2;
  window._mapboxThemeStyle = mapStyle;
  window._mapboxFog = fog;

  function _switchMapTheme(m) {
    if (!m || typeof m.isStyleLoaded !== 'function') return;
    // Remove previous listener to avoid stacking
    if (m._themeStyleListener) { try { m.off('style.load', m._themeStyleListener); } catch(e){} }
    m._themeStyleListener = () => { try { m.setFog(fog); } catch(e){} };
    m.on('style.load', m._themeStyleListener);
    try {
      if (m.isStyleLoaded()) { m.setStyle(mapStyle); }
      else { m.once('load', () => { try { m.setStyle(mapStyle); } catch(e){} }); }
    } catch(e) {}
  }

  const _allMaps = [
    typeof dashMiniMmas      !== 'undefined' ? dashMiniMmas      : null,
    typeof dashMiniPeacs     !== 'undefined' ? dashMiniPeacs     : null,
    typeof mmasMapInstance   !== 'undefined' ? mmasMapInstance   : null,
    typeof spectatorMap      !== 'undefined' ? spectatorMap      : null,
    typeof peacsMap          !== 'undefined' ? peacsMap          : null,
    typeof mmasInlineMap     !== 'undefined' ? mmasInlineMap     : null,
    typeof peacsSpectatorMap !== 'undefined' ? peacsSpectatorMap : null,
  ];
  _allMaps.forEach(_switchMapTheme);

  // Redraw the star canvas
  try { initStars(); } catch(e) {}

  // Restart globe rotation if we're on the entry screen and the RAF stopped
  ensureGlobeRotating();

  // Update ambient globe fade gradient + map style on theme change
  const ambientFade = document.getElementById('ambient-globe-fade');
  if (ambientFade) {
    ambientFade.style.background = isLight
      ? 'linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(230,238,250,0.5) 70%, rgba(230,238,250,0.75) 100%)'
      : 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(5,12,28,0.45) 72%, rgba(5,12,28,0.68) 100%)';
  }
  if (typeof _ambientGlobe !== 'undefined' && _ambientGlobe) {
    const ambientStyle = 'mapbox://styles/mapbox/navigation-night-v1';
    const ambientFog = isLight
      ? { color:'rgb(180,210,235)', 'high-color':'rgb(100,160,210)', 'horizon-blend':0.04, 'space-color':'#c8e0f4', 'star-intensity':0.0 }
      : { color:'rgb(8,20,50)', 'high-color':'rgb(20,50,120)', 'horizon-blend':0.06, 'space-color':'rgb(2,5,18)', 'star-intensity':0.4 };
    try {
      // Clear existing fog first, then re-apply on next frame to guarantee update
      const _applyAmbientFog = () => {
        try {
          _ambientGlobe.setFog(null);
          requestAnimationFrame(() => {
            try { _ambientGlobe.setFog(ambientFog); } catch(e) {}
          });
        } catch(e) {}
      };
      if (_ambientGlobe.isStyleLoaded()) {
        _applyAmbientFog();
      } else {
        _ambientGlobe.once('style.load', _applyAmbientFog);
      }
    } catch(e) {}
  }
  // Update screen bg colour
  const entryScreen = document.getElementById('screen-entry');
  if (entryScreen) {
    entryScreen.style.background = isLight ? '#e0eaf8' : '#040c1c';
  }

  // Re-render any live JS-built content so it picks up theme-aware colors
  try { if (typeof accLoadOverview === 'function') accLoadOverview(); } catch(e) {}
  try { if (typeof accLoadWorkspaces === 'function') accLoadWorkspaces(); } catch(e) {}
  try { if (typeof accLoadCampaigns === 'function') accLoadCampaigns(); } catch(e) {}
  try { if (typeof accLoadKeys === 'function') accLoadKeys(); } catch(e) {}
}

// ── Theme-aware color helper ──────────────────────────────────────────────
// Use this anywhere JS renders inline-style HTML so colors adapt to day/night.
// tc('dark-value', 'light-value')
function tc(dark, light) {
  return document.documentElement.getAttribute('data-theme') === 'light' ? light : dark;
}

// Helper — call after any map initialises so it respects the current theme
function applyMapTheme(mapInstance) {
  if (!mapInstance || !window._mapboxThemeStyle) return;
  try { if (mapInstance.isStyleLoaded()) mapInstance.setStyle(window._mapboxThemeStyle); } catch(e) {}
}

// Manage float toggle visibility — hide it when a screen with its own nav toggle is active
function updateFloatToggleVisibility() {
  const floatBtn = document.getElementById('theme-toggle-float');
  if (!floatBtn) return;
  // Screens that have their own nav-embedded toggle
  const screensWithNav = ['screen-mmas','screen-dashboard','screen-peacs'];
  const anyNavActive = screensWithNav.some(id => {
    const s = document.getElementById(id);
    return s && s.classList.contains('active');
  });
  // Also hide when Mission Control overlay is open
  const mcOpen = !!document.getElementById('sa-overlay');
  floatBtn.style.display = (anyNavActive || mcOpen) ? 'none' : 'flex';
}

function initTheme() {
  try {
    const saved = localStorage.getItem('atlas_theme');
    if (saved) { applyTheme(saved); return; }
    // Default to daylight — user can toggle to night
    applyTheme('light');
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function initStars() {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = window.innerWidth; c.height = window.innerHeight;
  ctx.clearRect(0, 0, c.width, c.height);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) return; // canvas hidden in daylight — no need to draw

  // ── Deep-space background gradient ──
  const bg = ctx.createRadialGradient(c.width*0.45, c.height*0.4, 0, c.width*0.5, c.height*0.5, c.width*0.85);
  bg.addColorStop(0,   'rgba(12, 22, 48, 0.82)');
  bg.addColorStop(0.5, 'rgba(5,  10, 26, 0.60)');
  bg.addColorStop(1,   'rgba(2,   4, 12, 0.30)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  // ── Milky Way band ──
  const mw = ctx.createLinearGradient(0, c.height*0.3, c.width, c.height*0.7);
  mw.addColorStop(0,    'rgba(60,  80, 160, 0.00)');
  mw.addColorStop(0.3,  'rgba(80, 100, 200, 0.07)');
  mw.addColorStop(0.5,  'rgba(100,120, 230, 0.12)');
  mw.addColorStop(0.7,  'rgba(80, 100, 200, 0.07)');
  mw.addColorStop(1,    'rgba(60,  80, 160, 0.00)');
  ctx.fillStyle = mw;
  ctx.fillRect(0, 0, c.width, c.height);

  // ── Stars — three layers: tiny, medium, bright ──
  const layers = [
    { count: 280, rMin: 0.1, rMax: 0.5,  aMin: 0.08, aMax: 0.30, colors: ['180,210,255','200,220,255','160,190,255'] },
    { count: 90,  rMin: 0.4, rMax: 0.9,  aMin: 0.25, aMax: 0.65, colors: ['210,225,255','180,200,255','240,240,255'] },
    { count: 18,  rMin: 0.8, rMax: 1.6,  aMin: 0.55, aMax: 1.00, colors: ['255,255,255','220,235,255','200,220,255'] },
  ];
  layers.forEach(l => {
    for (let i = 0; i < l.count; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * (l.rMax - l.rMin) + l.rMin;
      const a = Math.random() * (l.aMax - l.aMin) + l.aMin;
      const col = l.colors[Math.floor(Math.random() * l.colors.length)];
      // Soft glow for bright stars
      if (l.rMax > 1) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        glow.addColorStop(0,   `rgba(${col},${a * 0.6})`);
        glow.addColorStop(0.4, `rgba(${col},${a * 0.2})`);
        glow.addColorStop(1,   `rgba(${col},0)`);
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},${a})`;
      ctx.fill();
    }
  });
}

window.addEventListener('resize', () => initStars());

// ══════════════════════════════════════════════
// GEOLOCATION
// ══════════════════════════════════════════════
async function getLocationByIP() {
  // ── Timeout guard ────────────────────────────────────────────────────────
  // ipapi.co is a free-tier service that can stall under load (e.g. World
  // Adherence Day traffic spikes). Race the fetch against a 4-second deadline
  // so a slow or rate-limited response never blocks patient form submission.
  const ipTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('ipapi timeout')), 4000)
  );
  try {
    const r = await Promise.race([fetch('https://ipapi.co/json/'), ipTimeout]);
    const d = await r.json();
    if (d && d.country_name && d.city) {
      userLocation = { country:d.country_name, city:d.city, latitude:d.latitude, longitude:d.longitude, country_code:d.country_code };
      return;
    }
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'getLocationByIP failed: ' + e.message);
  }
}

function requestGeolocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { getLocationByIP().then(resolve); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        userLocation = { latitude:pos.coords.latitude, longitude:pos.coords.longitude, country:'Unknown', city:'Unknown', country_code:'XX' };
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=en`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'ATLAS-AdherenceProject/2026' } }
          );
          const d = await r.json();
          if (d && d.address) {
            const city    = d.address.city||d.address.town||d.address.village||d.address.suburb||d.address.county||'';
            const country = d.address.country||'';
            const code    = (d.address.country_code||'').toUpperCase();
            if (city)    userLocation.city         = city;
            if (country) userLocation.country      = country;
            if (code)    userLocation.country_code = code;
          }
        } catch(e) {}
        // If Nominatim didn't resolve country/city, fall back to IP for those fields
        if (userLocation.country === 'Unknown' || userLocation.city === 'Unknown') {
          try {
            const ipTimeout2 = new Promise((_,reject) => setTimeout(() => reject(new Error('ipapi timeout2')), 4000));
            const r2 = await Promise.race([fetch('https://ipapi.co/json/'), ipTimeout2]);
            const d2 = await r2.json();
            if (d2 && d2.country_name) {
              if (userLocation.country === 'Unknown') userLocation.country = d2.country_name;
              if (userLocation.city    === 'Unknown') userLocation.city    = d2.city || userLocation.city;
              if (!userLocation.country_code || userLocation.country_code === 'XX') userLocation.country_code = d2.country_code;
            }
          } catch(e2) {}
        }
        resolve();
      },
      async () => { await getLocationByIP(); resolve(); },
      { timeout:8000, maximumAge:300000 }
    );
  });
}

function fillSdohLocation() {
  if (!userLocation) return;
  const c = document.getElementById('sdoh-country');
  const ci = document.getElementById('sdoh-city');
  if (c && !c.value && userLocation.country && userLocation.country !== 'Unknown') c.value = userLocation.country;
  if (ci && !ci.value && userLocation.city && userLocation.city !== 'Unknown') ci.value = userLocation.city;
}

