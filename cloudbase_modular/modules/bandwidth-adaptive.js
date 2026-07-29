// bandwidth-adaptive.js — Connection-quality detection and Data-Lite mode
// ATLAS platform: adaptive UI for low-bandwidth LMIC field deployments
//
// What it does:
//   1. Detects connection quality via Network Information API + RTT probe fallback
//   2. Activates atlas-lite-mode CSS class on body when connection is slow
//   3. Defers heavy visualizations (MapBox, Chart.js, 3D globe) behind "Load" buttons
//   4. Shows a dismissible lite-mode banner when active
//   5. Persists user preference in localStorage (can force-enable or force-disable)
//
// CSS class: body.atlas-lite-mode
//   Applied automatically on slow/2G connections, or when user enables manually.
//   Hides heavy elements and shows lightweight fallbacks.

(function initBandwidthAdaptive() {
  'use strict';

  const LS_KEY_FORCE  = 'atlas_lite_mode_forced';   // 'on' | 'off' | null
  const LS_KEY_BANNER = 'atlas_lite_banner_seen';    // '1' if user dismissed once this session

  // ── CSS injection ────────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('ba-styles')) return;
    const s = document.createElement('style');
    s.id = 'ba-styles';
    s.textContent = `
      /* ── Data-Lite mode: suppress heavy visualizations ─────────────────── */

      /* MapBox maps — replace with a placeholder box */
      body.atlas-lite-mode .mapboxgl-map,
      body.atlas-lite-mode .mapboxgl-canvas-container,
      body.atlas-lite-mode #sa-globe-container,
      body.atlas-lite-mode #sa-globe-canvas { display: none !important; }

      /* Cohort map module — hide map, show lite placeholder */
      body.atlas-lite-mode #res-mod-cohort-map .cohort-map-wrap { display: none !important; }
      body.atlas-lite-mode .ba-map-placeholder { display: flex !important; }
      .ba-map-placeholder {
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        min-height: 120px;
        background: rgba(249,115,22,0.04);
        border: 1px dashed rgba(249,115,22,0.25);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
      }
      .ba-map-placeholder .ba-map-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.74rem;
        color: rgba(138,160,184,0.7);
        line-height: 1.5;
      }
      .ba-map-load-btn {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.70rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 6px 14px;
        border-radius: 5px;
        border: 1px solid rgba(249,115,22,0.30);
        background: rgba(249,115,22,0.07);
        color: #f97316;
        cursor: pointer;
        transition: all 0.12s;
      }
      .ba-map-load-btn:hover { background: rgba(249,115,22,0.14); }

      /* Chart.js heavy accordion — collapse by default in lite mode */
      body.atlas-lite-mode .res-advanced-accordion,
      body.atlas-lite-mode #res-advanced-accordion { max-height: 0; overflow: hidden; }
      body.atlas-lite-mode .ba-accordion-note { display: block !important; }
      .ba-accordion-note {
        display: none;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.72rem;
        color: rgba(249,115,22,0.7);
        padding: 6px 0;
      }

      /* Analytics heavy sections — defer chart rendering */
      body.atlas-lite-mode canvas.chartjs-render-monitor { opacity: 0.4; }

      /* ── Lite-mode banner ───────────────────────────────────────────────── */
      #ba-banner {
        display: none;
        position: fixed;
        bottom: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9100;
        background: rgba(10, 21, 39, 0.97);
        border: 1px solid rgba(249,115,22,0.40);
        border-radius: 9px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.40);
        max-width: calc(100vw - 40px);
        flex-wrap: wrap;
        backdrop-filter: blur(8px);
      }
      #ba-banner.hidden { display: none !important; }
      #ba-banner .ba-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.72rem;
        color: #f97316;
        white-space: nowrap;
      }
      #ba-banner .ba-sub {
        font-size: 0.75rem;
        color: rgba(138,160,184,0.8);
        flex: 1;
        min-width: 140px;
      }
      #ba-banner .ba-btn {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.68rem;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        padding: 5px 12px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.12s;
        white-space: nowrap;
        border: 1px solid;
      }
      #ba-banner .ba-btn-full {
        border-color: rgba(56,189,248,0.35);
        background: rgba(56,189,248,0.07);
        color: #38bdf8;
      }
      #ba-banner .ba-btn-full:hover { background: rgba(56,189,248,0.14); }
      #ba-banner .ba-btn-dismiss {
        border-color: rgba(96,120,152,0.30);
        background: transparent;
        color: rgba(96,120,152,0.65);
      }
      #ba-banner .ba-btn-dismiss:hover { color: rgba(138,160,184,0.8); }

      /* ── Connection quality indicator (top-right corner) ───────────────── */
      #ba-conn-indicator {
        display: none;
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9050;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.60rem;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 10px;
        border: 1px solid;
        pointer-events: none;
      }
      #ba-conn-indicator.slow {
        display: block;
        color: #f97316;
        border-color: rgba(249,115,22,0.30);
        background: rgba(249,115,22,0.07);
      }
      #ba-conn-indicator.offline {
        display: block;
        color: #ef4444;
        border-color: rgba(239,68,68,0.35);
        background: rgba(239,68,68,0.08);
      }
    `;
    document.head.appendChild(s);
  }

  // ── Connection quality classification ─────────────────────────────────────────
  // Returns: 'fast' | 'medium' | 'slow' | 'offline'
  function _classifyConnection() {
    if (!navigator.onLine) return 'offline';

    // Network Information API (Chrome/Android)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const type = conn.effectiveType || conn.type || '';
      if (type === '2g' || type === 'slow-2g')           return 'slow';
      if (type === '3g')                                  return 'medium';
      if (conn.downlink !== undefined && conn.downlink < 0.5) return 'slow';
      if (conn.downlink !== undefined && conn.downlink < 2)   return 'medium';
      if (conn.rtt      !== undefined && conn.rtt > 1000)     return 'slow';
      if (conn.rtt      !== undefined && conn.rtt > 400)      return 'medium';
      if (conn.saveData === true)                         return 'slow'; // data-saver mode
    }

    return 'fast'; // default when API unavailable — probe will refine
  }

  // RTT probe: time a small HEAD request against the Firebase project domain
  function _probeRTT() {
    return new Promise(function(resolve) {
      try {
        const start = performance.now();
        const img = new Image();
        // Use a 1x1 favicon — no CORS issue, tiny payload
        img.src = '/favicon.ico?_ba=' + Date.now();
        img.onload  = function() { resolve(performance.now() - start); };
        img.onerror = function() { resolve(performance.now() - start); };
        setTimeout(function() { resolve(9999); }, 8000); // timeout = assume slow
      } catch(_) {
        resolve(9999);
      }
    });
  }

  // ── Lite mode activation/deactivation ────────────────────────────────────────
  let _liteActive = false;

  function _activateLite(reason) {
    if (_liteActive) return;
    _liteActive = true;
    document.body.classList.add('atlas-lite-mode');
    _injectMapPlaceholders();
    _showBanner(reason);
    _updateIndicator('slow');
    window._atlasLiteMode = true;
  }

  function _deactivateLite() {
    _liteActive = false;
    document.body.classList.remove('atlas-lite-mode');
    _hideBanner();
    _updateIndicator('fast');
    window._atlasLiteMode = false;
  }

  // ── Map placeholders ──────────────────────────────────────────────────────────
  function _injectMapPlaceholders() {
    // Cohort map wrap
    const cohortMapWrap = document.querySelector('#res-mod-cohort-map .cohort-map-wrap')
                       || document.getElementById('res-cohort-map-wrap');
    if (cohortMapWrap && !cohortMapWrap.parentNode.querySelector('.ba-map-placeholder')) {
      const ph = document.createElement('div');
      ph.className = 'ba-map-placeholder';
      ph.innerHTML =
        '<div class="ba-map-label">Cohort Map hidden in Data-Lite mode<br>to preserve bandwidth.</div>' +
        '<button class="ba-map-load-btn" onclick="window._atlasLoadMap && window._atlasLoadMap()">Load Cohort Map</button>';
      cohortMapWrap.parentNode.insertBefore(ph, cohortMapWrap);
    }
  }

  // ── Banner ────────────────────────────────────────────────────────────────────
  function _showBanner(reason) {
    if (sessionStorage.getItem('ba_banner_dismissed') === '1') return;
    let banner = document.getElementById('ba-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ba-banner';
      banner.innerHTML =
        '<span class="ba-label">📶 Data-Lite Mode</span>' +
        '<span class="ba-sub">' + (reason || 'Slow connection detected') + ' — heavy visualizations deferred to save data.</span>' +
        '<button class="ba-btn ba-btn-full" onclick="window.atlasDisableLiteMode()">Load Full Version</button>' +
        '<button class="ba-btn ba-btn-dismiss" onclick="window.atlasDismissLiteBanner()">Dismiss</button>';
      document.body.appendChild(banner);
    }
    banner.classList.remove('hidden');
  }

  function _hideBanner() {
    const banner = document.getElementById('ba-banner');
    if (banner) banner.classList.add('hidden');
  }

  // ── Connection indicator ──────────────────────────────────────────────────────
  function _updateIndicator(quality) {
    let ind = document.getElementById('ba-conn-indicator');
    if (!ind) {
      ind = document.createElement('div');
      ind.id = 'ba-conn-indicator';
      document.body.appendChild(ind);
    }
    ind.className = '';
    if (quality === 'slow') {
      ind.classList.add('slow');
      ind.textContent = '2G / Slow';
    } else if (quality === 'offline') {
      ind.classList.add('offline');
      ind.textContent = 'Offline';
    } else {
      ind.textContent = '';
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /** Force-enable lite mode (user preference). */
  window.atlasEnableLiteMode = function() {
    localStorage.setItem(LS_KEY_FORCE, 'on');
    _activateLite('Data-Lite mode enabled');
  };

  /** Force-disable lite mode (user wants full version). */
  window.atlasDisableLiteMode = function() {
    localStorage.setItem(LS_KEY_FORCE, 'off');
    _deactivateLite();
  };

  /** Dismiss the banner for this session only (don't affect lite mode). */
  window.atlasDismissLiteBanner = function() {
    sessionStorage.setItem('ba_banner_dismissed', '1');
    _hideBanner();
  };

  /** Returns true if Data-Lite mode is currently active. */
  window.atlasIsLiteMode = function() { return _liteActive; };

  // ── Startup detection ─────────────────────────────────────────────────────────
  async function _startup() {
    _injectStyles();

    // Check forced preference first
    const forced = localStorage.getItem(LS_KEY_FORCE);
    if (forced === 'on')  { _activateLite('Data-Lite mode (user setting)'); return; }
    if (forced === 'off') { return; } // user explicitly chose full version

    // Check Network Information API
    const apiQuality = _classifyConnection();
    if (apiQuality === 'offline') {
      _updateIndicator('offline');
      return; // offline queue handles submission; don't activate lite mode
    }
    if (apiQuality === 'slow') {
      _activateLite('Slow connection detected (2G/3G)');
      return;
    }
    if (apiQuality === 'medium') {
      // Probe RTT to confirm
      const rtt = await _probeRTT();
      if (rtt > 2000) {
        _activateLite('High latency detected (' + Math.round(rtt) + 'ms)');
        return;
      }
    }

    // If Network Information API isn't available, do a lightweight RTT probe
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) {
      const rtt = await _probeRTT();
      if (rtt > 3000) {
        _activateLite('High latency detected (' + Math.round(rtt) + 'ms)');
      }
    }
  }

  // Run after DOM is ready (don't block page load)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startup);
  } else {
    setTimeout(_startup, 500); // small delay to not contend with auth startup
  }

  // Re-check on network change
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    conn.addEventListener('change', function() {
      const forced = localStorage.getItem(LS_KEY_FORCE);
      if (forced === 'on' || forced === 'off') return; // user preference wins
      const q = _classifyConnection();
      if (q === 'slow' && !_liteActive) {
        _activateLite('Connection degraded');
      } else if (q === 'fast' && _liteActive) {
        _deactivateLite();
      }
    });
  }

  // Offline/online events
  window.addEventListener('offline', function() { _updateIndicator('offline'); });
  window.addEventListener('online',  function() {
    if (_liteActive) _updateIndicator('slow');
    else             _updateIndicator('fast');
  });

})();
