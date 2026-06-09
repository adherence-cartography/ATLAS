/**
 * @fileoverview Live activity ticker strip and cohort-data loading utilities.
 * The ticker subscribes to Firebase /mapData and renders a scrolling feed of
 * recent global submissions at the bottom of entry/dashboard/map screens.
 */

// ══════════════════════════════════════════════════════════════════════════
// LIVE ACTIVITY TICKER
// Listens to Firebase onChildAdded on mapData, builds a scrolling ticker
// strip at the bottom of the screen. Only shown on entry + dashboard screens.
// ══════════════════════════════════════════════════════════════════════════
(function() {
  const TICKER_SCREENS = ['screen-entry', 'screen-dashboard', 'screen-mmas-map'];
  const MAX_ITEMS = 40;
  const tickerEl  = document.getElementById('live-activity-ticker');
  const trackEl   = document.getElementById('lat-track');
  let items = [];
  let tickerAnim = null;
  let isRunning = false;

  function countryToFlag(iso2) {
    if (!iso2 || iso2.length !== 2) return '🌐';
    try {
      return iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
    } catch(e) { return '🌐'; }
  }

  function scoreColor(score) {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  }

  function scoreLabel(score) {
    if (score >= 8) return 'High';
    if (score >= 6) return 'Med';
    return 'Low';
  }

  function buildItem(d) {
    const flag  = countryToFlag(d.country_code || '');
    const city  = d.city || d.country || 'Unknown';
    const score = typeof d.score === 'number' ? d.score : parseFloat(d.score) || 0;
    const col   = scoreColor(score);
    const lbl   = scoreLabel(score);
    return `<span class="lat-item">
      <span class="lat-dot" style="background:${col};box-shadow:0 0 5px ${col};"></span>
      <span class="lat-flag">${flag}</span>
      <span style="color:rgba(200,220,255,0.85);">${city}</span>
      <span class="lat-score" style="color:${col};">${score.toFixed(1)}</span>
      <span class="lat-label">${lbl}</span>
    </span>`;
  }

  function rebuildTrack() {
    if (!items.length) return;
    // Double the items for seamless loop
    const html = items.map(buildItem).join('') + items.map(buildItem).join('');
    trackEl.innerHTML = html;
    // Restart animation
    trackEl.style.animation = 'none';
    trackEl.offsetHeight; // reflow
    const totalW = trackEl.scrollWidth / 2;
    const speed  = Math.max(40, totalW / 60); // ~60s for a full loop, min 40px/s
    const dur    = totalW / speed;
    trackEl.style.animation = `tickerScroll ${dur}s linear infinite`;
  }

  function showTicker(show) {
    if (!tickerEl) return;
    tickerEl.style.display = show && items.length > 0 ? 'block' : 'none';
  }

  // Hook into showScreen to show/hide ticker
  const _origShowForTicker = window.showScreen;
  window.showScreen = function(id) {
    _origShowForTicker && _origShowForTicker.apply(this, arguments);
    showTicker(TICKER_SCREENS.includes(id));
    // Reveal cohort toggle on live map screen when researcher/institution key is active
    if (id === 'screen-mmas-map') {
      const cohortBtn = document.getElementById('map-cohort-toggle-btn');
      if (cohortBtn) {
        const wsOk = currentWorkspace &&
          currentWorkspace !== 'EXPLORER' &&
          currentWorkspace !== 'INDEPENDENT';
        cohortBtn.style.display = wsOk ? '' : 'none';
        // Also init the map on first nav
        if (typeof initMmasMap === 'function') initMmasMap();
      }
    }
  };

  // Load recent items + listen for new ones
  function startTicker() {
    if (!window.database) { setTimeout(startTicker, 1500); return; }
    const cutoff = Date.now() - 3600000; // last hour for seed
    database.ref('mapData').orderByChild('timestamp').limitToLast(20).once('value', snap => {
      if (snap.exists()) {
        snap.forEach(child => {
          const d = child.val();
          if (d && (d.city || d.country)) items.unshift(d);
        });
        items = items.slice(0, MAX_ITEMS);
        rebuildTrack();
        // Show if already on a ticker screen
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && TICKER_SCREENS.includes(activeScreen.id)) showTicker(true);
      }
    });

    // Real-time: new submissions push to front
    database.ref('mapData').limitToLast(1).on('child_added', snap => {
      const d = snap.val();
      if (!d || (!d.city && !d.country)) return;
      items.unshift(d);
      if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
      rebuildTrack();
      const activeScreen = document.querySelector('.screen.active');
      if (activeScreen && TICKER_SCREENS.includes(activeScreen.id)) showTicker(true);
    });
  }

  // Wait for Firebase to be ready
  if (window.database) {
    startTicker();
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(startTicker, 2000));
  }
})();
