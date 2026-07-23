// ══════════════════════════════════════════════════════════════════════════
// FEATURE 1: PATIENT QR MODAL
// Generates a deep-link URL pointing to /assess?ws=KEY&lang=LANG.
// Patients land directly on the assessment page — no dashboard access,
// no researcher session, no workspace data visible.
// The workspace key is used only as the write target for the submitted score.
// ══════════════════════════════════════════════════════════════════════════
/**
 * Opens the Patient QR modal for the active workspace.
 * Generates a scoped URL (`/assess?ws=KEY&lang=LANG`) that takes the patient
 * directly to the assessment form. The researcher dashboard is never reached.
 * @returns {void}
 */
function openPatientQR() {
  if (!currentWorkspace) { showToast('No workspace active — enter a workspace key first.'); return; }
  const assessBase = window.location.origin + '/assess';
  const lang = (typeof mmasCurrentLang !== 'undefined' ? mmasCurrentLang : 'en');
  // Populate lang selector with all available MMAS_QUESTIONS languages
  const sel = document.getElementById('pqr-lang-select');
  sel.innerHTML = '';
  if (typeof MMAS_QUESTIONS !== 'undefined') {
    Object.keys(MMAS_QUESTIONS).sort((a, b) => {
      const na = MMAS_QUESTIONS[a].name || a;
      const nb = MMAS_QUESTIONS[b].name || b;
      return na.localeCompare(nb);
    }).forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = MMAS_QUESTIONS[code].name || code.toUpperCase();
      sel.appendChild(opt);
    });
  }
  sel.value = (MMAS_QUESTIONS && MMAS_QUESTIONS[lang]) ? lang : 'en';
  const activeLang = sel.value;
  const url   = `${assessBase}?ws=${encodeURIComponent(currentWorkspace)}&lang=${activeLang}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&format=png&ecc=M`;
  document.getElementById('pqr-qr-img').src             = qrSrc;
  document.getElementById('pqr-url-display').textContent = url;
  document.getElementById('pqr-ws-label').textContent    = currentWorkspace;
  document.getElementById('patient-qr-modal').style.display = 'flex';
  window._pqrUrl = url;
}
function pqrChangeLang(langCode) {
  const ws  = document.getElementById('pqr-ws-label').textContent;
  const url = `${window.location.origin}/assess?ws=${encodeURIComponent(ws)}&lang=${langCode}`;
  document.getElementById('pqr-qr-img').src             = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&format=png&ecc=M`;
  document.getElementById('pqr-url-display').textContent = url;
  window._pqrUrl = url;
}
/**
 * Closes the Patient QR modal.
 * @returns {void}
 */
function closePatientQR() {
  document.getElementById('patient-qr-modal').style.display = 'none';
}
/**
 * Copies the patient deep-link URL from the QR modal to the clipboard.
 * @returns {void}
 */
function pqrCopyLink() {
  const url = document.getElementById('pqr-url-display').textContent;
  navigator.clipboard.writeText(url).then(() => showToast('✓ Patient link copied to clipboard')).catch(() => { showToast('Copy failed — see URL below QR'); });
}
/**
 * Generates a print-formatted patient QR sheet and triggers `window.print()`.
 * @returns {void}
 */
function pqrPrint() {
  const url  = document.getElementById('pqr-url-display').textContent;
  const ws   = document.getElementById('pqr-ws-label').textContent;
  const sel  = document.getElementById('pqr-lang-select');
  const lang = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : 'English';
  const qr   = document.getElementById('pqr-qr-img').src;
  const sheet = document.getElementById('pqr-print-sheet');
  sheet.innerHTML = `<div class="pqr-print-page">
    <div class="pqr-print-brand">Adherence Cartography · ATLAS</div>
    <div class="pqr-print-title">Scan to Complete MMAS-8</div>
    <div class="pqr-print-sub">Scan this code to start your medication adherence assessment.<br>Opens the assessment directly — no login, no account, no personal data stored.</div>
    <img class="pqr-print-qr" src="${qr}" width="200" height="200" alt="QR"/>
    <br/>
    <div class="pqr-print-ws">Workspace: ${ws} · Language: ${lang}</div>
    <div class="pqr-print-footer">MMAS-8 © MMAR LLC · ATLAS © Adherence Cartography · atlas.adherence.cc<br>Written permission required for use of MMAS-8 · 100 Oceangate 12th Floor, Long Beach CA 90802</div>
  </div>`;
  document.body.classList.add('printing-pqr');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-pqr'); sheet.innerHTML = ''; }, 1500);
}
// Also wire the ?lang= param into the consent flow (extend existing ?ws handoff)
(function patchLangFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  if (langParam && typeof MMAS_QUESTIONS !== 'undefined' && MMAS_QUESTIONS[langParam]) {
    window._autoLang = langParam; // consumed in buildLangSelect after DOMContentLoaded
  }
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 2: AP2026 LIVE LEADERBOARD WITH HOT COUNTRIES
// Real-time country rankings pulled from mmasCountryData (already live).
// "Hot" = countries with submissions in the last 60 minutes.
// ══════════════════════════════════════════════════════════════════════════
let _wadLbInterval = null;
let _wadHotCountries = new Set();

function openWADLeaderboard() {
  const el = document.getElementById('wad-leaderboard-overlay');
  el.style.display = 'flex';
  renderWADLeaderboard();
  // Refresh every 15 seconds while open
  _wadLbInterval = setInterval(renderWADLeaderboard, 15000);
  // Harvest hot countries (last 60 min) from mapData live feed
  harvestHotCountries();
}
function closeWADLeaderboard() {
  document.getElementById('wad-leaderboard-overlay').style.display = 'none';
  if (_wadLbInterval) { clearInterval(_wadLbInterval); _wadLbInterval = null; }
}

function harvestHotCountries() {
  // Read the last hour of mapData from Firebase to identify hot countries
  const cutoff = Date.now() - 3600000;
  try {
    database.ref('mapData').orderByChild('timestamp').startAt(cutoff).once('value', snap => {
      _wadHotCountries = new Set();
      if (!snap.exists()) return;
      snap.forEach(child => {
        const d = child.val();
        if (d && d.country && d.country !== 'Unknown') _wadHotCountries.add(d.country);
      });
    });
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'AP2026 hot countries load failed: ' + e.message);
  }
}

function renderWADLeaderboard() {
  const now = new Date();
  const data = typeof mmasCountryData !== 'undefined' ? mmasCountryData : {};
  const sorted = Object.entries(data)
    .map(([c,d]) => ({ c, count:d.count, avg:d.totalScore/d.count }))
    .filter(x => x.c && x.c !== 'Unknown')
    .sort((a,b) => b.count - a.count);

  const total    = sorted.reduce((s,x) => s+x.count, 0);
  const totalWeightedScore = sorted.reduce((s,x) => s + x.avg * x.count, 0);
  const avgAll   = total > 0 ? totalWeightedScore / total : 0;
  const maxCount = sorted[0]?.count || 1;
  const medals   = ['🥇','🥈','🥉'];

  // ── Gini coefficient of adherence inequality across countries ──────────────
  // Uses the standard Gini formula on country-average MMAS scores (weight-adjusted).
  // Interpretation: 0 = all countries have equal average adherence,
  //                 1 = all adherence concentrated in one country.
  // A high Gini signals global health equity gaps — novel in adherence literature.
  let gini = null;
  if (sorted.length >= 2) {
    const avgs = sorted.map(x => x.avg).sort((a, b) => a - b);
    const n = avgs.length;
    const sumAvgs = avgs.reduce((s, v) => s + v, 0);
    if (sumAvgs > 0) {
      const numerator = avgs.reduce((s, v, i) => s + (2 * (i + 1) - n - 1) * v, 0);
      gini = parseFloat(Math.abs(numerator / (n * sumAvgs)).toFixed(3));
    }
  }
  const giniColor = gini === null ? 'var(--dim)'
    : gini < 0.10 ? '#10b981'
    : gini < 0.20 ? '#3b82f6'
    : gini < 0.30 ? '#f59e0b'
    : '#ef4444';

  // Update header stats
  const wadTotal    = document.getElementById('wad-lb-total');
  const wadCtries   = document.getElementById('wad-lb-countries');
  const wadAvg      = document.getElementById('wad-lb-avg');
  const wadGini     = document.getElementById('wad-lb-gini');
  const wadUpdated  = document.getElementById('wad-lb-updated');
  if (wadTotal)   wadTotal.textContent   = total.toLocaleString();
  if (wadCtries)  wadCtries.textContent  = sorted.length;
  if (wadAvg)     wadAvg.textContent     = avgAll.toFixed(2);
  if (wadGini)  { wadGini.textContent    = gini !== null ? gini.toFixed(3) : '—'; wadGini.style.color = giniColor; }
  if (wadUpdated) wadUpdated.textContent = 'Updated ' + now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  const container = document.getElementById('wad-lb-rows');
  if (!container) return;

  container.innerHTML = '';
  sorted.forEach((x, i) => {
    const cat     = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(x.avg) : { color:'#4e9cf5' };
    const isHot   = _wadHotCountries.has(x.c);
    const row     = document.createElement('div');
    row.className = 'wad-lb-row' + (isHot ? ' hot' : '');
    const pct     = Math.round((x.count / maxCount) * 100);
    row.innerHTML = `
      <div class="wad-lb-rank">${i < 3 ? medals[i] : (i+1)}</div>
      <div class="wad-lb-country">${_esc(x.c)}${isHot ? ' <span class="wad-hot-badge">🔥 hot</span>' : ''}</div>
      <div class="wad-lb-bar-wrap"><div class="wad-lb-bar-fill" style="width:${pct}%;background:${cat.color};"></div></div>
      <div class="wad-lb-count">${x.count}</div>
      <div class="wad-lb-avg" style="color:${cat.color};">${x.avg.toFixed(2)}</div>`;
    container.appendChild(row);
  });

  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.28);padding:40px;font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.08em;">Awaiting submissions…</div>';
  }
}

// AP2026 Leaderboard injection removed — event has ended
window.openWADLeaderboard = openWADLeaderboard;

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 3: TPE PROXY SCORE ON PATIENT RESULT CARD
// Computes a simplified PE = (BASE × MVMT × STRATA)^(1/3) from MMAS data
// and SDoH fields. Renders as an inline panel on showResultModal.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 4: ZOE LONGITUDINAL STREAK — WELCOME BACK
// Checks Firebase for prior assessments matching this user's atlas_user_id.
// If a prior score exists, ZOE opens with a personalised welcome-back intro.
// ══════════════════════════════════════════════════════════════════════════
window._priorScore  = null;
window._priorDelta  = null;
window._streakBanner = null;

function loadPriorScore() {
  try {
    const uid = (typeof getUserId === 'function') ? getUserId() : null;
    if (!uid) return;
    database.ref('assessments').orderByChild('user_id').equalTo(uid).limitToLast(5).once('value', snap => {
      if (!snap.exists()) return;
      const records = [];
      snap.forEach(child => { const d = child.val(); if (d && d.score != null) records.push(d); });
      if (records.length < 1) return;
      records.sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
      window._priorScore = records[records.length - 1].score;
      window._priorTimestamp = records[records.length - 1].timestamp;
      window._priorCount = records.length;
    });
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'loadPriorScore failed: ' + e.message);
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadPriorScore, 2000);

  // Handle #spectator hash — fired when assess.html redirects here after patient submission
  if (window.location.hash === '#spectator') {
    // Clear the hash immediately so refresh doesn't re-trigger
    history.replaceState(null, '', window.location.pathname);
    // Enter Explorer mode silently then open spectator overlay
    window._wsMode   = 'explorer';
    currentWorkspace = 'EXPLORER';
    workspaceProfile = { name:'Explorer', cohortLabel:'Explorer', color:'#2ec98a', active:true, role:'explorer' };
    enterResearcherDashboard();
    // Wait for dashboard + map assets to initialise before opening spectator
    setTimeout(() => {
      if (typeof enterSpectatorMode === 'function') enterSpectatorMode();
    }, 1200);
  }
});

// Inject streak banner into ZOE overlay on open
(function patchZoeOpen() {
  const _originalZoeOpen = window.zoeOpen;
  window.zoeOpen = function() {
    _originalZoeOpen && _originalZoeOpen.apply(this, arguments);
    // Inject streak banner if prior score exists
    if (window._priorScore != null) {
      const overlay = document.getElementById('zoe-overlay');
      if (!overlay) return;
      // Remove existing banner if any
      const existing = overlay.querySelector('.zoe-streak-banner');
      if (existing) existing.remove();
      const prior   = parseFloat(window._priorScore);
      const count   = window._priorCount || 1;
      const tsLabel = window._priorTimestamp
        ? new Date(window._priorTimestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'})
        : 'previously';
      const banner = document.createElement('div');
      banner.className = 'zoe-streak-banner';
      banner.innerHTML = `
        <div class="zoe-streak-icon">📈</div>
        <div class="zoe-streak-text">
          Welcome back! You have completed <strong>${count}</strong> assessment${count!==1?'s':''}.
          Your last score was <strong style="color:var(--pe);">${prior.toFixed(2)}/8</strong> (${tsLabel}).
          <div class="zoe-streak-delta" style="color:var(--strata);">ZOE will compare your result when you finish.</div>
        </div>`;
      // Insert after status line
      const statusEl = document.getElementById('zoe-status');
      if (statusEl && statusEl.parentNode) {
        statusEl.parentNode.insertBefore(banner, statusEl.nextSibling);
      }
      // Also update ZOE intro text
      window._zoeStreakPrior = prior;
    }
  };
})();

// Patch zoeFinalize to add delta messaging
(function patchZoeFinalize() {
  const _orig = window.zoeFinalize;
  window.zoeFinalize = function() {
    // Guard: zoeFinalize sets _zoeFinalizing itself — if already running, skip
    if (window._zoeFinalizing) return;
    _orig && _orig.apply(this, arguments);
    // Delta is computed after submitMMAS runs — hook via custom event
    window._zoePendingDeltaCheck = true;
  };
})();

// Hook into showResultModal to add streak delta
(function addStreakDeltaToResult() {
  const _origShow = window.showResultModal;
  window.showResultModal = function(score, answers) {
    (_origShow || function(){}).call(this, score, answers);
    if (window._zoeStreakPrior == null) return;
    setTimeout(() => {
      const box = document.querySelector('.result-box');
      if (!box) return;
      const prior = window._zoeStreakPrior;
      const delta = score - prior;
      const sign  = delta > 0 ? '+' : '';
      const color = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#f59e0b';
      const msg   = delta > 0 ? `You improved by ${sign}${delta.toFixed(2)} points since your last assessment. Keep it up!`
                  : delta < 0 ? `Your score decreased by ${Math.abs(delta).toFixed(2)} points. Let's talk to your care team about what changed.`
                  : 'Your score is unchanged from your last assessment. Consistency is a foundation — let\'s build on it.';
      const banner = document.createElement('div');
      banner.style.cssText = `background:rgba(${delta>0?'16,185,129':delta<0?'239,68,68':'245,158,11'},0.07);border:1px solid rgba(${delta>0?'16,185,129':delta<0?'239,68,68':'245,158,11'},0.25);border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:0.86rem;color:var(--text);line-height:1.6;`;
      banner.innerHTML = `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:${color};">📈 Longitudinal Change</span><br>${msg}`;
      const gauge = box.querySelector('.result-score-row');
      if (gauge) box.insertBefore(banner, gauge.nextSibling);
      window._zoeStreakPrior = null;
    }, 120);
  };
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 5: SOAP NOTE → SEND TO RESEARCHER EMAIL
// Adds a "📧 Send to Researcher" button to the SOAP panel on result modal.
// Routes through Lambda /zoe endpoint with action:'email_soap'.
// ══════════════════════════════════════════════════════════════════════════
function injectSoapEmailButton() {
  const panel = document.getElementById('rc-soap-panel');
  if (!panel || panel.querySelector('.soap-email-btn')) return;
  if (!window._zoeSoapNote) return;
  // Only show for researcher/institution
  if (typeof isResearcherMode === 'function' && !isResearcherMode()) return;

  const hdr = panel.querySelector('[id="rc-soap-readback-btn"]')?.parentElement;
  if (!hdr) return;
  const btn = document.createElement('button');
  btn.className = 'soap-email-btn';
  btn.innerHTML = '📧 Send to Researcher';
  btn.title = 'Email this SOAP note to the workspace PI';
  btn.addEventListener('click', sendSoapToResearcher);
  hdr.appendChild(btn);
}

async function sendSoapToResearcher() {
  if (!window._zoeSoapNote) { showToast('No SOAP note available.'); return; }
  const btn = document.querySelector('.soap-email-btn');
  if (btn) { btn.textContent = '📧 Sending…'; btn.disabled = true; }
  try {
    const resp = await fetch(`${LAMBDA_URL}/zoe`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action: 'email_soap',
        workspace: currentWorkspace || 'UNKNOWN',
        patient_id: window._sessionPatientId || '—',
        soap_note: window._zoeSoapNote,
        timestamp: new Date().toISOString()
      })
    });
    const data = await resp.json();
    if (data.sent || resp.ok) {
      showToast('✓ SOAP note sent to researcher inbox.');
      if (btn) { btn.textContent = '✓ Sent'; btn.style.color = 'var(--strata)'; }
    } else {
      throw new Error(data.error || 'Lambda returned error');
    }
  } catch(e) {
    showToast('Email failed — SOAP note copied to clipboard instead.');
    const soapText = formatSoapText(window._zoeSoapNote);
    try { navigator.clipboard.writeText(soapText); } catch(_) {}
    if (btn) { btn.textContent = '📧 Send to Researcher'; btn.disabled = false; }
  }
}

function formatSoapText(soap) {
  if (!soap) return '';
  return [
    'SOAP NOTE — ATLAS / ZOE Clinical Assessment',
    '─────────────────────────────',
    'S (Subjective): ' + (soap.subjective || ''),
    'O (Objective): '  + (soap.objective  || ''),
    'A (Assessment): ' + (soap.assessment || ''),
    'P (Plan):\n'      + (soap.plan        || ''),
    soap.clinical_flags?.length ? 'Clinical Flags: ' + soap.clinical_flags.join('; ') : '',
    soap.zoe_note ? 'ZOE Note: ' + soap.zoe_note : '',
    '─────────────────────────────',
    'Adherence Cartography · ATLAS · PENDING CLINICIAN REVIEW',
  ].filter(Boolean).join('\n');
}

// Hook into renderSoapOnResultModal to add the email button after SOAP renders
(function watchSoapRender() {
  const _orig = window.renderSoapOnResultModal;
  if (typeof _orig === 'function') {
    window.renderSoapOnResultModal = function() {
      _orig.apply(this, arguments);
      setTimeout(injectSoapEmailButton, 200);
    };
  } else {
    // renderSoapOnResultModal defined later — watch via MutationObserver
    const obs = new MutationObserver(() => {
      const panel = document.getElementById('rc-soap-panel');
      if (panel && panel.style.display !== 'none') {
        injectSoapEmailButton();
      }
    });
    obs.observe(document.body, { childList:true, subtree:true });
  }
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 6: AMBIENT LIVE GLOBE ON ENTRY SCREEN
// Replaces the bg-canvas particle layer on the entry screen with a
// mini rotating Mapbox globe showing the last 24h of mapData points.
// Only initialises if Mapbox is loaded and canvas hasn't been replaced.
// ══════════════════════════════════════════════════════════════════════════
let _ambientGlobe = null;
let _ambientGlobeInited = false;

// Single authoritative globe rotation guard — call from anywhere.
// Starts the spin loop only if the globe exists, entry screen is active,
// and no loop is already running. Cancels any stale RAF first.
function ensureGlobeRotating() {
  if (!_ambientGlobe || typeof _ambientGlobe.jumpTo !== 'function') return;
  const entryEl = document.getElementById('screen-entry');
  if (!entryEl || !entryEl.classList.contains('active')) return;
  if (window._ambientRotateRaf) return; // already running — do nothing
  let _bearing = 0;
  try { _bearing = _ambientGlobe.getBearing ? _ambientGlobe.getBearing() : 0; } catch(e) { console.warn('atlas-globe:', e); }
  const _spin = () => {
    _bearing = (_bearing + 0.018) % 360;
    try { _ambientGlobe.jumpTo({ bearing: _bearing }); } catch(e) { console.warn('atlas-globe:', e); }
    window._ambientRotateRaf = requestAnimationFrame(_spin);
  };
  window._ambientRotateRaf = requestAnimationFrame(_spin);
}

function initAmbientGlobe() {
  if (_ambientGlobeInited) return;
  const entryScreen = document.getElementById('screen-entry');
  if (!entryScreen) return;
  ensureMapbox().then(() => {
    mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;
    if (_ambientGlobeInited) return; // double-guard in case called twice while loading
  // Target the dedicated left column in the split layout
  const globeCol = document.getElementById('entry-globe-col');
  const targetEl = globeCol || entryScreen;

  // Globe fills the globe column (or full screen as fallback)
  const wrap = document.createElement('div');
  wrap.id = 'ambient-globe-wrap';
  wrap.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:0',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 2.2s ease'
  ].join(';') + ';';

  targetEl.style.position = 'relative';
  targetEl.insertBefore(wrap, targetEl.firstChild);

  // Only add the fade overlay when falling back to full-screen mode
  let fade = null;
  if (!globeCol) {
    fade = document.createElement('div');
    fade.id = 'ambient-globe-fade';
    fade.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:1',
      'pointer-events:none',
      'background:linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(5,12,28,0.45) 72%, rgba(5,12,28,0.68) 100%)'
    ].join(';') + ';';
    entryScreen.insertBefore(fade, entryScreen.children[1] || null);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      fade.style.background = 'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(240,245,255,0.6) 55%, rgba(240,245,255,0.85) 100%)';
    }
  }

  // Ensure entry content layers above globe + fade
  const entryContent = entryScreen.querySelector('.entry-wrap');
  if (entryContent) {
    entryContent.style.position = 'relative';
    entryContent.style.zIndex   = '2';
  }
  // Also lift reset button and collab footer
  const resetBtn = entryScreen.querySelector('[onclick="hardResetApp()"]');
  if (resetBtn && resetBtn.parentElement) resetBtn.parentElement.style.position = 'relative', resetBtn.parentElement.style.zIndex = '2';

  try {
    _ambientGlobe = new mapboxgl.Map({
      container: wrap,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      projection: 'globe',
      zoom: 1.6,
      center: [20, 12],   // centred on Africa/Europe — interesting landmass in upper viewport
      pitch: 0,
      interactive: false,
      attributionControl: false,
      logoPosition: 'bottom-right'
    });

    _ambientGlobe.on('load', () => {
      _ambientGlobeInited = true;

      // Atmosphere: deep space feel
      try {
        _ambientGlobe.setFog({
          color: 'rgb(8,20,50)',
          'high-color': 'rgb(20,50,120)',
          'horizon-blend': 0.06,
          'space-color': 'rgb(2,5,18)',
          'star-intensity': 0.4
        });
      } catch(e) { console.warn('atlas-globe:', e); }

      // Fully visible — the gradient overlay controls the fade, not the globe opacity
      wrap.style.opacity = '1';

      // Full wander — tours continents with tilt and diagonal drift
      // Each waypoint: [longitude, latitude, pitch, zoom, dwellFrames]
      const WAYPOINTS = [
        [  20,  10, 20, 1.6 ],   // Africa / Europe
        [ -80,  15, 28, 1.7 ],   // Central America / Caribbean
        [-100,  45, 18, 1.5 ],   // North America
        [ -55, -15, 24, 1.7 ],   // South America
        [  20,  52, 16, 1.6 ],   // Europe
        [  80,  25, 22, 1.6 ],   // South Asia / India
        [ 135,  35, 20, 1.7 ],   // East Asia
        [ 150, -25, 18, 1.6 ],   // Australia / Pacific
        [  40,  15, 26, 1.7 ],   // East Africa / Middle East
      ];
      let wpIdx   = 0;
      let bearing = 0;
      let transitFrame = 0;
      const TRANSIT_FRAMES = 420; // ~7s per waypoint at 60fps

      const rotate = () => {
        transitFrame++;
        bearing = (bearing + 0.018) % 360;

        const t   = Math.min(transitFrame / TRANSIT_FRAMES, 1);
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease-in-out

        const cur  = WAYPOINTS[wpIdx];
        const next = WAYPOINTS[(wpIdx + 1) % WAYPOINTS.length];

        const lng   = cur[0] + (next[0] - cur[0]) * ease;
        const lat   = cur[1] + (next[1] - cur[1]) * ease;
        const pitch = cur[2] + (next[2] - cur[2]) * ease;
        const zoom  = cur[3] + (next[3] - cur[3]) * ease;

        if (transitFrame >= TRANSIT_FRAMES) {
          transitFrame = 0;
          wpIdx = (wpIdx + 1) % WAYPOINTS.length;
        }

        if (_ambientGlobe && typeof _ambientGlobe.jumpTo === 'function') {
          try { _ambientGlobe.jumpTo({ bearing, pitch, center: [lng, lat], zoom }); } catch(e) { console.warn('atlas-globe:', e); }
        }
        window._ambientRotateRaf = requestAnimationFrame(rotate);
      };
      window._ambientRotateRaf = requestAnimationFrame(rotate);

      // Adherence data dots: glow + sharp core
      // AP2026 event window: show all points from March 20 onward; fall back to 7-day window,
      // then fall back to all data so the globe is never empty on load.
      const ap2026Start = new Date('2026-03-20T00:00:00Z').getTime();
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const cutoff = Math.min(ap2026Start, sevenDaysAgo);

      function _renderAmbientDots(snap) {
        const features = [];
        if (snap && snap.exists()) {
          snap.forEach(child => {
            const d = child.val();
            if (d && d.latitude && d.longitude && !(d.latitude === 0 && d.longitude === 0)) {
              const cat = typeof getAdherenceCategory === 'function'
                ? getAdherenceCategory(d.score || 0) : { color:'#4e9cf5' };
              features.push({
                type:'Feature',
                geometry:{ type:'Point', coordinates:[d.longitude, d.latitude] },
                properties:{ color: cat.color }
              });
            }
          });
        }
        if (!features.length) return false;
        try {
          if (_ambientGlobe.getSource('ambient-points')) {
            _ambientGlobe.getSource('ambient-points').setData({ type:'FeatureCollection', features });
          } else {
            _ambientGlobe.addSource('ambient-points', {
              type:'geojson', data:{ type:'FeatureCollection', features }
            });
            _ambientGlobe.addLayer({ id:'ambient-glow', type:'circle', source:'ambient-points',
              paint:{ 'circle-radius':10, 'circle-color':['get','color'], 'circle-opacity':0.2, 'circle-blur':1.5 }
            });
            _ambientGlobe.addLayer({ id:'ambient-dots', type:'circle', source:'ambient-points',
              paint:{ 'circle-radius':3.5, 'circle-color':['get','color'], 'circle-opacity':0.95, 'circle-blur':0.1 }
            });
          }
        } catch(e) { console.warn('atlas-globe:', e); }
        return true;
      }

      try {
        database.ref('mapData').orderByChild('timestamp').startAt(cutoff).once('value', snap => {
          const rendered = _renderAmbientDots(snap);
          // If the time-windowed query returned nothing, load all data as fallback
          if (!rendered) {
            database.ref('mapData').once('value', snapAll => { _renderAmbientDots(snapAll); });
          }
        });
      } catch(e) {}

      // Live listener: add new submission dots as they arrive during this session
      try {
        database.ref('mapData').limitToLast(1).on('child_added', snap => {
          const d = snap ? snap.val() : null;
          if (!d || !d.latitude || !d.longitude) return;
          const cat = typeof getAdherenceCategory === 'function'
            ? getAdherenceCategory(d.score || 0) : { color:'#4e9cf5' };
          const src = _ambientGlobe && typeof _ambientGlobe.getSource === 'function' && _ambientGlobe.getSource('ambient-points');
          if (!src) return;
          try {
            const gj = src._data || { type:'FeatureCollection', features:[] };
            gj.features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[d.longitude, d.latitude] }, properties:{ color: cat.color } });
            src.setData(gj);
          } catch(e) {}
        });
      } catch(e) {}
    });

    _ambientGlobe.on('error', () => {
      try { wrap.remove(); fade.remove(); } catch(e) {}
    });
  } catch(e) {
    try { wrap.remove(); fade.remove(); } catch(e2) {}
  }
  }); // end ensureMapbox
}

// Trigger globe init when entry screen becomes active
(function watchEntryScreen() {
  const _origShow = window.showScreen;
  window.showScreen = function(id) {
    _origShow && _origShow.apply(this, arguments);
    if (id === 'screen-entry') {
      if (!_ambientGlobeInited) {
        setTimeout(initAmbientGlobe, 400);
      } else {
        ensureGlobeRotating();
      }
    } else {
      // Pause rotation when not on entry screen
      if (window._ambientRotateRaf) {
        cancelAnimationFrame(window._ambientRotateRaf);
        window._ambientRotateRaf = null;
      }
    }
  };
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 7: PEACS PERCENTILE INLINE BENCHMARK
// After PEACS result renders, fetches the live distribution from
// peacs_assessments and shows "You scored higher than X% of patients
// in your condition category."
// ══════════════════════════════════════════════════════════════════════════
/**
 * Computes the PEACS percentile rank for a patient's PE score against the Firebase cohort.
 * Filters by condition if provided. Returns `null` if fewer than 5 peers are available.
 * @param {number} myPE - The patient's PEACS PE score (0–1)
 * @param {string|null} condition - Medical condition for cohort filtering, or `null` for all
 * @returns {Promise<{percentile: number, n: number, condition: string|null}|null>}
 */
function computePeacsPercentile(myPE, condition) {
  return new Promise(resolve => {
    try {
      database.ref('peacs_assessments').once('value', snap => {
        if (!snap.exists()) { resolve(null); return; }
        const peers = [];
        snap.forEach(child => {
          const d = child.val();
          if (!d || d.pe_score == null) return;
          // Filter by condition if we have one, otherwise use all
          if (condition && d.condition && d.condition.toLowerCase() !== condition.toLowerCase()) return;
          peers.push(parseFloat(d.pe_score));
        });
        if (peers.length < 5) { resolve(null); return; } // need enough data for meaningful percentile
        const below = peers.filter(p => p < myPE).length;
        const percentile = Math.round((below / peers.length) * 100);
        resolve({ percentile, n: peers.length, condition });
      });
    } catch(e) { resolve(null); }
  });
}

/**
 * Appends a PEACS percentile benchmark badge to the result section after scoring.
 * Reads the condition from `#sdoh-condition` and calls `computePeacsPercentile`.
 * @param {number} peScore - The patient's PEACS PE score (0–1)
 * @returns {void}
 */
function injectPeacsPercentile(peScore) {
  const condition = document.getElementById('sdoh-condition')?.value?.trim() || null;
  computePeacsPercentile(peScore, condition).then(result => {
    if (!result) return;
    const resultArea = document.querySelector('.peacs-result-pe, #peacs-result-pe, .peacs-result-section');
    if (!resultArea) return;
    const existing = resultArea.querySelector('.peacs-percentile-badge');
    if (existing) existing.remove();
    const badge = document.createElement('div');
    badge.className = 'peacs-percentile-badge';
    const condLabel = result.condition ? ` in your ${_esc(result.condition)} group` : '';
    badge.innerHTML = `📊 You scored higher than <strong style="color:var(--bright);margin:0 3px;">${result.percentile}%</strong> of patients${condLabel} (n=${result.n})`;
    resultArea.appendChild(badge);
  });
}

// Patch PEACS result render — hook into submitPeacs or equivalent
(function watchPeacsResult() {
  const _origSubmit = window.submitPeacs;
  if (typeof _origSubmit === 'function') {
    window.submitPeacs = function() {
      const ret = _origSubmit.apply(this, arguments);
      setTimeout(() => {
        const pe = (typeof peacsState !== 'undefined') ? peacsState.pe : null;
        if (pe != null) injectPeacsPercentile(pe);
      }, 1200);
      return ret;
    };
  }
  // MutationObserver fallback — watch for PEACS result section appearing
  const obs = new MutationObserver(mutations => {
    mutations.forEach(() => {
      const resultEl = document.querySelector('.peacs-result-pe, [id*="peacs"][id*="result"]');
      if (resultEl && !resultEl.querySelector('.peacs-percentile-badge')) {
        const pe = (typeof peacsState !== 'undefined') ? peacsState.pe : null;
        if (pe != null) injectPeacsPercentile(pe);
      }
    });
  });
  obs.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 8: LIGHTWEIGHT ERROR TELEMETRY
// Catches unhandled errors and promise rejections.
// Writes to Firebase /errors/{workspace} (superadmin-visible only).
// Zero external dependencies.
// ══════════════════════════════════════════════════════════════════════════
(function initErrorTelemetry() {
  const MAX_ERRORS = 3; // don't spam Firebase
  let _errCount = 0;

  function logError(type, message, source, stack) {
    if (_errCount >= MAX_ERRORS) return;
    _errCount++;
    try {
      const payload = {
        type, message: String(message).slice(0, 300),
        source: String(source||'').slice(0, 200),
        stack: String(stack||'').slice(0, 500),
        workspace: (typeof currentWorkspace !== 'undefined') ? currentWorkspace : 'UNKNOWN',
        url: window.location.href.split('?')[0],
        ua: navigator.userAgent.slice(0, 120),
        ts: Date.now()
      };
      if (typeof database !== 'undefined') {
        database.ref('errors').push(payload).catch(() => {});
      }
      // Also log to console for debugging
      console.warn('[ATLAS Telemetry]', type, message);
    } catch(e) {}
  }

  window.addEventListener('error', e => {
    logError('js_error', e.message, e.filename + ':' + e.lineno, e.error?.stack);
  });
  window.addEventListener('unhandledrejection', e => {
    const msg = e.reason?.message || String(e.reason);
    logError('unhandled_promise', msg, '', e.reason?.stack);
  });
})();

// ── Diagnostic logger for caught-but-notable errors ──
// Writes to console and Firebase /warnings (superadmin-visible).
// Call window._atlasLog('warn'|'info', message) from any catch block
// that should surface during a live event without crashing.
window._atlasLog = (function() {
  const _q = [];
  let _count = 0;
  const MAX = 20;
  return function(level, msg) {
    if (_count >= MAX) return;
    _count++;
    const entry = {
      level, msg: String(msg).slice(0, 300),
      workspace: (typeof currentWorkspace !== 'undefined') ? currentWorkspace : 'UNKNOWN',
      timestamp: Date.now()
    };
    _q.push(entry);
    console[level === 'warn' ? 'warn' : 'info']('[ATLAS]', msg);
    try {
      if (typeof database !== 'undefined') {
        database.ref('warnings').push(entry).catch(() => {});
      }
    } catch(e) {}
  };
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 9: FIREBASE PAGINATION GUARD
// Wraps the high-frequency assessments reads with a limit to prevent
// loading unbounded data. Applies to all .once('value') reads on
// /assessments that don't already have a query modifier.
// ══════════════════════════════════════════════════════════════════════════
(function patchFirebaseReads() {
  // We can't easily intercept Firebase SDK internals without monkey-patching,
  // so we implement a caching layer that de-duplicates rapid reads.
  window._assessmentsCache = null;
  window._assessmentsCacheTs = 0;
  const CACHE_TTL = 45000; // 45 seconds

  window.getCachedAssessments = function(wsFilter) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      if (window._assessmentsCache && (now - window._assessmentsCacheTs) < CACHE_TTL) {
        let data = window._assessmentsCache;
        if (wsFilter) data = data.filter(r => r.institution_code === wsFilter || r.workspace_key === wsFilter);
        resolve(data);
        return;
      }
      // Paginate: fetch latest 2000 records only
      let ref = database.ref('assessments').orderByChild('timestamp').limitToLast(2000);
      ref.once('value', snap => {
        const records = [];
        if (snap.exists()) snap.forEach(child => { const d=child.val(); if(d) records.push(d); });
        window._assessmentsCache = records;
        window._assessmentsCacheTs = Date.now();
        let data = records;
        if (wsFilter) data = data.filter(r => r.institution_code === wsFilter || r.workspace_key === wsFilter);
        resolve(data);
      }, reject);
    });
  };

  window.invalidateAssessmentsCache = function() {
    window._assessmentsCache = null;
    window._assessmentsCacheTs = 0;
  };

  // Invalidate cache on new submissions
  const _origSubmit = window.submitMMAS;
  if (typeof _origSubmit === 'function') {
    window.submitMMAS = function() {
      window.invalidateAssessmentsCache();
      return _origSubmit.apply(this, arguments);
    };
  }
})();

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 10: OFFLINE SUBMISSION QUEUE (IndexedDB)
// When navigator.onLine is false at submission time, persists the full
// submission payload to IndexedDB and syncs when connectivity returns.
// Completely transparent to the user — shows a badge when queue is non-empty.
// ══════════════════════════════════════════════════════════════════════════
(function initOfflineQueue() {
  const DB_NAME    = 'atlas_offline';
  const DB_VERSION = 1;
  const STORE      = 'submissions';
  let _idb = null;

  function openIDB() {
    return new Promise((resolve, reject) => {
      if (_idb) { resolve(_idb); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath:'id', autoIncrement:true });
        }
      };
      req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
      req.onerror   = e => reject(e);
    });
  }

  async function queueSubmission(type, assessmentPayload, mapPayload) {
    try {
      const db = await openIDB();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({
        type, assessmentPayload, mapPayload,
        queuedAt: Date.now(),
        workspace: (typeof currentWorkspace !== 'undefined') ? currentWorkspace : 'UNKNOWN'
      });
      updateOfflineBadge();
      showToast('📶 Offline — submission queued. Will sync automatically when connected.');
    } catch(e) {
      console.warn('[ATLAS Offline] Queue failed:', e);
    }
  }

  async function getQueueCount() {
    try {
      const db = await openIDB();
      return new Promise(resolve => {
        const tx  = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => resolve(0);
      });
    } catch(e) { return 0; }
  }

  async function updateOfflineBadge() {
    const count = await getQueueCount();
    const badge = document.getElementById('offline-queue-badge');
    if (!badge) return;
    if (count > 0) {
      badge.style.display = 'block';
      badge.textContent   = `⚡ ${count} Queued Submission${count!==1?'s':''} — Tap to Sync`;
    } else {
      badge.style.display = 'none';
    }
  }

  window.syncOfflineQueue = async function() {
    if (!navigator.onLine) { showToast('Still offline — will sync when connected.'); return; }

    // Ensure auth before writing — same race condition as live submission
    if (!firebase.auth().currentUser) {
      await new Promise((resolve) => {
        const unsub = firebase.auth().onAuthStateChanged(user => {
          unsub();
          if (user) resolve();
          else firebase.auth().signInAnonymously().then(resolve).catch(resolve);
        });
        setTimeout(resolve, 8000);
      });
    }

    const db = await openIDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const all = await new Promise(resolve => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve([]);
    });
    if (!all.length) { showToast('No queued submissions.'); return; }
    let synced = 0;
    for (const item of all) {
      try {
        if (item.type === 'mmas') {
          await atlasDB('assessments').push(item.assessmentPayload);
          if (item.mapPayload) await database.ref('mapData').push(item.mapPayload);
          updatePublicStats(item.assessmentPayload.score, (item.mapPayload||item.assessmentPayload).country);
        } else if (item.type === 'peacs') {
          await atlasDB('peacs_assessments').push(item.assessmentPayload);
          if (item.mapPayload) await database.ref('peacs_mapData').push(item.mapPayload);
          updatePeacsPublicStats(item.assessmentPayload.pe ?? item.assessmentPayload.pe_score ?? item.assessmentPayload.base);
        }
        const delTx = db.transaction(STORE, 'readwrite');
        delTx.objectStore(STORE).delete(item.id);
        synced++;
      } catch(e) {
        console.warn('[ATLAS Offline] Sync failed for item', item.id, e);
      }
    }
    showToast(`✓ Synced ${synced} submission${synced!==1?'s':''} to Firebase.`);
    window.invalidateAssessmentsCache && window.invalidateAssessmentsCache();
    updateOfflineBadge();
  };

  // Expose queueSubmission globally so submitMMAS can use it
  window._atlasQueueSubmission = queueSubmission;

  // Patch submitMMAS to intercept offline submissions
  const _origSubmitMMAS = window.submitMMAS;
  if (typeof _origSubmitMMAS === 'function') {
    window.submitMMAS = async function() {
      if (!navigator.onLine) {
        // Build a minimal queued payload from current state
        try {
          const numericKeys = ['q1','q2','q3','q4','q5','q6','q7','q8'];
          const _answers = typeof mmasAnswers !== 'undefined' ? mmasAnswers : {};
          const score = numericKeys.reduce((a, k) => a + (parseFloat(_answers[k]) || 0), 0);
          const uid   = (typeof getUserId === 'function') ? getUserId() : 'UNKNOWN';
          const loc = (typeof userLocation !== 'undefined') ? userLocation : {};
          const payload = {
            user_id: uid, score, timestamp: Date.now(),
            country: loc.country||'Unknown', city: loc.city||'Unknown',
            latitude: loc.latitude||null, longitude: loc.longitude||null,
            workspace_key: (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null,
            offline_queued: true
          };
          await queueSubmission('mmas', payload, null);
          // Show a result modal with the local score anyway
          if (typeof showResultModal === 'function') {
            showResultModal(score, typeof mmasAnswers !== 'undefined' ? mmasAnswers : {});
          }
        } catch(e) {}
        return;
      }
      return _origSubmitMMAS.apply(this, arguments);
    };
  }

  // Check queue on reconnect
  window.addEventListener('online', () => {
    updateOfflineBadge();
    getQueueCount().then(n => {
      if (n > 0) {
        showToast(`📶 Back online — syncing ${n} queued submission${n!==1?'s':''}…`);
        setTimeout(window.syncOfflineQueue, 1500);
      }
    });
  });
  window.addEventListener('offline', () => {
    showToast('📶 You are offline. Submissions will be queued automatically.');
  });

  // Initial badge check on load
  document.addEventListener('DOMContentLoaded', () => setTimeout(updateOfflineBadge, 2000));
})();

// ══════════════════════════════════════════════════════════════════════════
// SUPERADMIN RECORD EDIT / DELETE  — ATLAS Control Patient Panel
// Build: 2026.03.23-B1
// ══════════════════════════════════════════════════════════════════════════

/**
 * Shows a confirmation modal for permanently deleting a Firebase assessment record.
 * Superadmin-only. The actual deletion is performed by `atlasConfirmDelete`.
 * @param {string} node - Firebase node path (e.g. `'assessments'` or `'peacs_assessments'`)
 * @param {string} fbKey - Firebase key of the record to delete
 * @param {string} patientId - Display patient ID shown in the confirmation dialog
 * @returns {void}
 */
window.atlasDeleteRecord = function(node, fbKey, patientId) {
  if (!isSuperAdmin()) { showToast('⛔ Superadmin access required.'); return; }
  if (!fbKey) { showToast('⚠ No Firebase key found on this record.'); return; }
  const existing = document.getElementById('atlas-admin-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'atlas-admin-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:28px 30px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--poor);margin-bottom:10px;">⚠ Superadmin · Hard Delete</div>
      <div style="font-family:var(--font-body);font-size:0.82rem;color:var(--bright);margin-bottom:6px;font-weight:500;">Delete this record permanently?</div>
      <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);margin-bottom:4px;">Patient: <span style="color:var(--bright);">${patientId}</span></div>
      <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);margin-bottom:4px;">Node: <span style="color:var(--bright);">${node}</span></div>
      <div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);margin-bottom:20px;">Key: ${fbKey}</div>
      <div style="font-size:0.84rem;color:var(--muted);margin-bottom:20px;line-height:1.5;">This cannot be undone. The record will be removed from Firebase immediately and will disappear from all dashboards on next refresh.</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('atlas-admin-modal').remove()" style="font-family:var(--font-mono);font-size:0.90rem;padding:7px 16px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--muted);cursor:pointer;">Cancel</button>
        <button id="atlas-confirm-delete-btn" onclick="atlasConfirmDelete('${node}','${fbKey}')" style="font-family:var(--font-mono);font-size:0.90rem;padding:7px 16px;border-radius:7px;border:1px solid rgba(239,68,68,0.5);background:rgba(239,68,68,0.12);color:var(--poor);cursor:pointer;font-weight:600;">Delete Permanently</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

/**
 * Executes the permanent deletion of a Firebase record after confirmation.
 * Removes the record from `{node}/{fbKey}` and refreshes the dashboard data.
 * @param {string} node - Firebase node path
 * @param {string} fbKey - Firebase key of the record
 * @returns {Promise<void>}
 */
window.atlasConfirmDelete = async function(node, fbKey) {
  const btn = document.getElementById('atlas-confirm-delete-btn');
  if (btn) { btn.textContent = 'Deleting…'; btn.disabled = true; }
  try {
    await database.ref(node + '/' + fbKey).remove();
    if (node === 'assessments') {
      try { await database.ref('mapData/' + fbKey).remove(); } catch(e) {}
    } else if (node === 'peacs_assessments') {
      try { await database.ref('peacs_mapData/' + fbKey).remove(); } catch(e) {}
    }
    document.getElementById('atlas-admin-modal')?.remove();
    showToast('✓ Record deleted from Firebase.');
    window.invalidateAssessmentsCache && window.invalidateAssessmentsCache();
    refreshCommandCenter();
  } catch(e) {
    showToast('⚠ Delete failed: ' + e.message);
    if (btn) { btn.textContent = 'Delete Permanently'; btn.disabled = false; }
  }
};

window.atlasEditRecord = function(node, fbKey, record) {
  if (!isSuperAdmin()) { showToast('⛔ Superadmin access required.'); return; }
  if (!fbKey) { showToast('⚠ No Firebase key found on this record.'); return; }
  const existing = document.getElementById('atlas-admin-modal');
  if (existing) existing.remove();
  const isMmas = node === 'assessments';
  const fields = isMmas
    ? [
        { key: 'patient_number', label: 'Patient ID',      type: 'text'   },
        { key: 'score',          label: 'MMAS-8 Score',    type: 'number', min:0, max:8, step:0.25 },
        { key: 'institution_code', label: 'Workspace Key', type: 'text'   },
        { key: 'condition',      label: 'Condition',        type: 'text'   },
        { key: 'drug_name',      label: 'Drug Name',        type: 'text'   },
        { key: 'age_range',      label: 'Age Range',        type: 'text'   },
        { key: 'gender',         label: 'Gender',           type: 'text'   },
        { key: 'country',        label: 'Country',          type: 'text'   },
        { key: 'city',           label: 'City',             type: 'text'   },
      ]
    : [
        { key: 'patient_number', label: 'Patient ID',      type: 'text'   },
        { key: 'pe_score',       label: 'PE Score',         type: 'number', min:0, max:1, step:0.01 },
        { key: 'institution_code', label: 'Workspace Key', type: 'text'   },
        { key: 'risk_level',     label: 'Risk Level',       type: 'text'   },
        { key: 'country',        label: 'Country',          type: 'text'   },
        { key: 'city',           label: 'City',             type: 'text'   },
      ];
  const inputStyle = 'width:100%;font-family:var(--font-mono);font-size:0.80rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:5px 9px;color:var(--bright);outline:none;';
  const labelStyle = 'font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;display:block;';
  const fieldHtml = fields.map(f => `
    <div style="margin-bottom:10px;">
      <label style="${labelStyle}">${f.label}</label>
      ${f.type === 'number'
        ? `<input id="atlas-edit-${f.key}" type="number" min="${f.min??''}" max="${f.max??''}" step="${f.step??1}" value="${record[f.key]??''}" style="${inputStyle}">`
        : `<input id="atlas-edit-${f.key}" type="text" value="${(record[f.key]??'').toString().replace(/"/g,'&quot;')}" style="${inputStyle}">`
      }
    </div>`).join('');
  const modal = document.createElement('div');
  modal.id = 'atlas-admin-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);overflow-y:auto;padding:20px 0;';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:28px 30px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--base);margin-bottom:10px;">✎ Superadmin · Edit Record</div>
      <div style="font-family:var(--font-body);font-size:0.82rem;color:var(--bright);margin-bottom:4px;font-weight:500;">Edit ${isMmas ? 'MMAS-8' : 'PEACS'} Record</div>
      <div style="font-family:var(--font-mono);font-size:0.61rem;color:var(--dim);margin-bottom:18px;">Key: ${fbKey}</div>
      ${fieldHtml}
      <div style="font-size:0.90rem;color:var(--dim);margin-bottom:16px;line-height:1.5;">Only the fields above will be updated. All other record data remains unchanged.</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('atlas-admin-modal').remove()" style="font-family:var(--font-mono);font-size:0.90rem;padding:7px 16px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--muted);cursor:pointer;">Cancel</button>
        <button id="atlas-confirm-edit-btn" onclick="atlasConfirmEdit('${node}','${fbKey}')" style="font-family:var(--font-mono);font-size:0.90rem;padding:7px 16px;border-radius:7px;border:1px solid rgba(78,156,245,0.5);background:rgba(78,156,245,0.12);color:var(--base);cursor:pointer;font-weight:600;">Save Changes</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.atlasConfirmEdit = async function(node, fbKey) {
  const btn = document.getElementById('atlas-confirm-edit-btn');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  const updates = {};
  document.querySelectorAll('#atlas-admin-modal input[id^="atlas-edit-"]').forEach(input => {
    const fieldKey = input.id.replace('atlas-edit-', '');
    const val = input.type === 'number' ? (input.value !== '' ? parseFloat(input.value) : null) : input.value.trim();
    if (val !== null && val !== '') updates[fieldKey] = val;
  });
  if (node === 'assessments' && updates.score !== undefined) {
    const s = parseFloat(updates.score);
    updates.adherence_level = s === 8 ? 'High Adherence' : s >= 6 ? 'Medium Adherence' : 'Low Adherence';
  }
  try {
    await database.ref(node + '/' + fbKey).update(updates);
    document.getElementById('atlas-admin-modal')?.remove();
    showToast('✓ Record updated in Firebase.');
    window.invalidateAssessmentsCache && window.invalidateAssessmentsCache();
    refreshCommandCenter();
  } catch(e) {
    showToast('⚠ Save failed: ' + e.message);
    if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
  }
};


// ══════════════════════════════════════════════════════════════════════════
// ICC DEMOGRAPHICS CHARTS — Gender · Age Bands · Education
// Build: 2026.03.23-B2
// Normalizes Greek/variant field values to canonical English before counting
// so bulk-uploaded Greek CSVs merge correctly with English form submissions.
// Red imbalance warning fires when any single category exceeds 60%.
// ══════════════════════════════════════════════════════════════════════════

// ── Normalization maps — Greek → English canonical ────────────────────────
const _NORM_GENDER = {
  // Greek variants
  'Άνδρας': 'Male', 'Ανδρας': 'Male', 'άνδρας': 'Male', 'ανδρας': 'Male',
  'Αρσενικό': 'Male', 'αρσενικό': 'Male',
  'Γυναίκα': 'Female', 'γυναίκα': 'Female', 'Θηλυκό': 'Female', 'θηλυκό': 'Female',
  'Άλλο': 'Other/Prefer not to say', 'Άλλο / Προτιμώ να μην απαντήσω': 'Other/Prefer not to say',
  'Προτιμώ να μην απαντήσω': 'Other/Prefer not to say',
  // Alternate English spellings
  'M': 'Male', 'F': 'Female', 'male': 'Male', 'female': 'Female',
  'Other': 'Other/Prefer not to say', 'Prefer not to say': 'Other/Prefer not to say',
  'Non-binary': 'Other/Prefer not to say',
};

const _NORM_AGE = {
  // Greek variants (from screenshot + common PEACS form)
  'Κάτω των 18 ετών': 'Under 18', 'Κάτω από 18': 'Under 18',
  '18-24': '18–24', '18-24 ετών': '18–24', '18–24 ετών': '18–24',
  '25-34': '25–34', '25-34 ετών': '25–34', '25–34 ετών': '25–34',
  '35-44': '35–44', '35-44 ετών': '35–44', '35–44 ετών': '35–44',
  '45-54': '45–54', '45-54 ετών': '45–54', '45–54 ετών': '45–54',
  '55-64': '55–64', '55-64 ετών': '55–64', '55–64 ετών': '55–64',
  '65-74': '65–74', '65-74 ετών': '65–74', '65–74 ετών': '65–74',
  '75+': '75 or older', '75 ετών και άνω': '75 or older', '75 ετών και ανω': '75 or older',
  '75 ή παραπάνω': '75 or older', '75 και άνω': '75 or older',
  'Προτιμώ να μην απαντήσω': 'Prefer not to say',
  // Hyphen variants
  'Under-18': 'Under 18', '<18': 'Under 18', '>75': '75 or older',
};

const _NORM_EDU = {
  // ── No formal education ───────────────────────────────────────────────────
  'Χωρίς τυπική εκπαίδευση': 'No formal education',
  'Καμία τυπική εκπαίδευση': 'No formal education',
  'Χωρίς επίσημη εκπαίδευση': 'No formal education',
  'Δεν υπάρχει επίσημη εκπαίδευση': 'No formal education',
  'Δεν υπάρχει επίσημ.': 'No formal education',
  'No formal': 'No formal education',
  'None': 'No formal education',
  'none': 'No formal education',

  // ── Primary ───────────────────────────────────────────────────────────────
  'Δημοτικό': 'Primary school (Elementary)',
  'Δημοτικό σχολείο': 'Primary school (Elementary)',
  'Δημοτικό σχολείο (...)': 'Primary school (Elementary)',
  'Δημοτικό σχολείο (Δημοτικό)': 'Primary school (Elementary)',
  'Primary': 'Primary school (Elementary)',
  'Primary school': 'Primary school (Elementary)',
  'Elementary': 'Primary school (Elementary)',

  // ── Secondary / High school ───────────────────────────────────────────────
  'Γυμνάσιο': 'Secondary school (High school)',
  'Λύκειο': 'Secondary school (High school)',
  'Γυμνάσιο (Λύκειο)': 'Secondary school (High school)',
  'Γυμνάσιο/Λύκειο': 'Secondary school (High school)',
  'Γυμνάσιο / Λύκειο': 'Secondary school (High school)',
  'Secondary': 'Secondary school (High school)',
  'High school': 'Secondary school (High school)',
  'High School': 'Secondary school (High school)',
  'Secondary school': 'Secondary school (High school)',

  // ── Some college ─────────────────────────────────────────────────────────
  'Μερικές σπουδές / Πανεπιστήμιο (ημιτελείς)': 'Some college / University (incomplete)',
  'Μερικές σπουδές': 'Some college / University (incomplete)',
  'Κάποιο κολέγιο / ...': 'Some college / University (incomplete)',
  'Κάποιο κολέγιο': 'Some college / University (incomplete)',
  'Κάποιο κολέγιο / Πανεπιστήμιο': 'Some college / University (incomplete)',
  'Some college': 'Some college / University (incomplete)',
  'Some College': 'Some college / University (incomplete)',
  'Incomplete': 'Some college / University (incomplete)',

  // ── Associate / Trade ─────────────────────────────────────────────────────
  'Αναπληρωτής πτυχίο / Τεχνική σχολή': 'Associate degree / Trade school',
  'Αναπληρωτής Πτυχίο': 'Associate degree / Trade school',
  'Αναπληρωτής Πτυχίο / Τεχνική': 'Associate degree / Trade school',
  'Αναπληρωτής Πτυχίο...': 'Associate degree / Trade school',
  'Τεχνική σχολή': 'Associate degree / Trade school',
  'Associate': 'Associate degree / Trade school',
  'Trade school': 'Associate degree / Trade school',
  'Associate degree': 'Associate degree / Trade school',

  // ── Bachelor's ────────────────────────────────────────────────────────────
  'Πτυχίο': "Bachelor's degree",
  'Πτυχίο πανεπιστημίου': "Bachelor's degree",
  'Πτυχίο πανεπιστημ.': "Bachelor's degree",
  'Πτυχίο Πανεπιστημίου': "Bachelor's degree",
  'Bachelor': "Bachelor's degree",
  'Bachelors': "Bachelor's degree",
  "Bachelor's": "Bachelor's degree",
  'Undergraduate': "Bachelor's degree",
  'Graduate': "Bachelor's degree",
  'Laurea': "Bachelor's degree",
  'Laurea Triennale': "Bachelor's degree",

  // ── Master's ──────────────────────────────────────────────────────────────
  'Μεταπτυχιακό': "Master's degree",
  'Μεταπτυχιακό δίπλωμα': "Master's degree",
  'Μεταπτυχιακό δίπλ.': "Master's degree",
  'MSc': "Master's degree",
  'MBA': "Master's degree",
  'Masters': "Master's degree",
  'Master': "Master's degree",
  "Master's": "Master's degree",
  'Diploma di Master': "Master's degree",
  'Diploma di master': "Master's degree",
  'Master di II livello': "Master's degree",
  'Laurea Magistrale': "Master's degree",
  'Postgraduate': "Master's degree",

  // ── Doctoral ──────────────────────────────────────────────────────────────
  'Διδακτορικό': 'Doctoral degree (PhD, MD, JD, etc.)',
  'Διδακτορικό δίπλωμα': 'Doctoral degree (PhD, MD, JD, etc.)',
  'Διδακτορικό δίπλω...': 'Doctoral degree (PhD, MD, JD, etc.)',
  'PhD': 'Doctoral degree (PhD, MD, JD, etc.)',
  'MD': 'Doctoral degree (PhD, MD, JD, etc.)',
  'Doctoral': 'Doctoral degree (PhD, MD, JD, etc.)',
  'Doctorate': 'Doctoral degree (PhD, MD, JD, etc.)',
  'JD': 'Doctoral degree (PhD, MD, JD, etc.)',
  'DPhil': 'Doctoral degree (PhD, MD, JD, etc.)',
  'Dottorato': 'Doctoral degree (PhD, MD, JD, etc.)',

  // ── Prefer not to say ─────────────────────────────────────────────────────
  'Προτιμώ να μην απαντήσω': 'Prefer not to say',
  'Prefer not to say': 'Prefer not to say',
  'Prefer not': 'Prefer not to say',
  'Rather not say': 'Prefer not to say',

  // ── N/A / Not specified ───────────────────────────────────────────────────
  'N/A': 'Not specified', 'n/a': 'Not specified',
  '-': 'Not specified', '': 'Not specified',
  'Not specified': 'Not specified',
};

function _normalizeDemoValue(val, map) {
  if (!val || !val.trim()) return 'Not specified';
  const trimmed = val.trim();
  // Exact match first
  if (map[trimmed] !== undefined) return map[trimmed];
  // Case-insensitive fallback
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v;
  }
  // Case-insensitive partial match for truncated strings and typos
  // e.g. "Χωρίς επίσημ..." → "No formal education", "high schoole" → "Secondary school (High school)"
  const lower8 = lower.slice(0, 8);
  for (const [k, v] of Object.entries(map)) {
    if (k.length > 8 && (lower8 === k.slice(0, 8).toLowerCase() || k.toLowerCase().startsWith(lower8))) return v;
  }
  return trimmed; // unrecognised — show as-is
}

// Standard canonical age bands (en-dash form, matching Firebase values)
const _STD_AGE_BANDS = new Set(['Under 18','18–24','25–34','35–44','45–54','55–64','65–74','75 or older','Prefer not to say','Not specified']);

// Normalizes any free-typed age range to the correct standard band.
// Maps by lower bound: "18-26" → lo=18 → "18–24", "35-45" → lo=35 → "35–44", etc.
function _normalizeAgeBand(val) {
  if (!val || !val.trim()) return 'Not specified';
  // Try the standard map first (exact/case-insensitive/partial)
  const fromMap = _normalizeDemoValue(val, _NORM_AGE);
  if (_STD_AGE_BANDS.has(fromMap)) return fromMap;
  // fromMap returned the raw string — try numeric range parsing
  const rangeMatch = (fromMap || val).trim().match(/^(\d+)\s*[-–—\/to]+\s*\d+/i);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    if (lo < 18) return 'Under 18';
    if (lo < 25) return '18–24';
    if (lo < 35) return '25–34';
    if (lo < 45) return '35–44';
    if (lo < 55) return '45–54';
    if (lo < 65) return '55–64';
    if (lo < 75) return '65–74';
    return '75 or older';
  }
  // Single number with optional +
  const numMatch = (fromMap || val).trim().match(/^(\d+)\+?$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n < 18) return 'Under 18';
    if (n < 25) return '18–24';
    if (n < 35) return '25–34';
    if (n < 45) return '35–44';
    if (n < 55) return '45–54';
    if (n < 65) return '55–64';
    if (n < 75) return '65–74';
    return '75 or older';
  }
  return fromMap; // still unrecognised — show as-is
}

/**
 * Renders the ICC Social Determinants of Health (SDoH) panel cards.
 * Uses PEACS STRATA dimension records plus MMAS records to compute housing, access,
 * literacy, support, and composite risk profiles.
 * @param {Array<Object>} strataRecords - PEACS STRATA dimension records for the cohort
 * @param {Array<Object>} peacsRecords - All PEACS assessment records for the cohort
 * @param {Array<Object>} mmasRecords - MMAS assessment records for the cohort
 * @returns {void}
 */
function renderICCSDoH(strataRecords, peacsRecords, mmasRecords) {
  const el = id => document.getElementById(id);
  const pn = strataRecords.length;
  const peacsPn = (peacsRecords || []).length;

  // ── No data: replace "Loading…" with a clear, actionable message ──────────
  // Previous code did `if (!pn) return;` which left panels stuck on "Loading…"
  // forever when peacs_dimensions had no matching records (e.g. early sessions
  // where institution_code wasn't being written to dimension records yet, or
  // when a cohort has MMAS data but no PEACS STRATA completions).
  if (!pn) {
    const hasPeacs = peacsPn > 0;
    const msg = hasPeacs
      ? '<span style="color:var(--muted);font-family:var(--font-mono);font-size:0.88rem;line-height:1.6;">STRATA dimension data not yet available.<br/>Patients must complete the full PEACS assessment (including STRATA questions) to populate these panels.</span>'
      : '<span style="color:var(--muted);font-family:var(--font-mono);font-size:0.88rem;line-height:1.6;">No PEACS data yet for this cohort.<br/>Patients complete the PEACS assessment after their MAP to generate SDOH profiles.</span>';
    ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk']
      .forEach(id => { const e = el(id); if (e) e.innerHTML = msg; });
    return;
  }

  // Build patient lookup from _patientPanelData
  const patByNum = {};
  (window._patientPanelData || []).forEach(p => { if (p.pid) patByNum[p.pid] = p; });

  // ── sq value → numeric score ──────────────────────────────────────────────
  // Newer records store sq fields as numeric scores (0.00–1.00).
  // Older records (pre dimension-tracking update) may store the raw option
  // index (0–3) or the option label string. This parser handles all three.
  const STRATA_SCORE_MAP = {
    // Option index → score (matches original STRATA_QS opts array)
    0: 1.00, 1: 0.67, 2: 0.33, 3: 0.00,
  };
  function parseSqVal(raw) {
    if (raw === undefined || raw === null) return null;
    const n = parseFloat(raw);
    // Already a decimal score between 0 and 1
    if (!isNaN(n) && n >= 0 && n <= 1) return n;
    // Integer option index (0–3)
    if (!isNaN(n) && Number.isInteger(n) && n >= 0 && n <= 3) return STRATA_SCORE_MAP[n] ?? null;
    // String option label — map by position in known label sets per question
    // (covers edge cases from early ZOE sessions that stored label text)
    return null; // unknown format — exclude from breakdown
  }

  const valLabel = (rawVal, labels) => {
    const n = parseSqVal(rawVal);
    if (n === null) return null;
    if (n >= 0.9)  return labels[0];
    if (n >= 0.58) return labels[1];
    if (n >= 0.2)  return labels[2];
    return labels[3];
  };

  function buildBreakdown(sqField, labels) {
    const groups = {};
    strataRecords.forEach(r => {
      if (r[sqField] === undefined) return;
      const l = valLabel(r[sqField], labels);
      if (!l) return;
      if (!groups[l]) groups[l] = { count: 0, pids: [] };
      groups[l].count++;
      if (r.patient_number) groups[l].pids.push(r.patient_number);
    });
    return groups;
  }

  window._sdohBreakdownGroups = window._sdohBreakdownGroups || {};

  function renderBreakdown(elId, groups, total, cardTitle) {
    const container = el(elId);
    if (!container) return;
    const entries = Object.entries(groups).sort((a,b)=>b[1].count-a[1].count);
    const maxN = entries[0]?.[1].count || 1;
    if (!entries.length) {
      container.innerHTML = '<span style="color:var(--dim);font-family:var(--font-mono);font-size:0.90rem;">No responses recorded yet.</span>';
      return;
    }
    const cols = ['var(--optimal)','var(--base)','var(--moderate)','var(--poor)'];
    const colHexMap = {'var(--optimal)':'#10b981','var(--base)':'#4e9cf5','var(--moderate)':'#f59e0b','var(--poor)':'#ef4444'};

    container.innerHTML = entries.map(([label, {count: n, pids}], idx) => {
      const pct = Math.round(n/total*100);
      const col = cols[Math.min(idx, cols.length-1)];
      const colHex = colHexMap[col] || '#4e9cf5';
      const key = elId + '_' + idx;
      window._sdohBreakdownGroups[key] = { title: cardTitle + ' · ' + label, color: colHex, pids };
      return `<div onclick="_openSDoHByKey('${key}')" onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background=''"
        style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 4px;border-radius:4px;transition:background 0.15s;">
        <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${label}">${label}</span>
        <div style="flex-shrink:0;width:50px;height:6px;background:var(--card2);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.round(n/maxN*100)}%;height:100%;background:${col};border-radius:3px;"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:0.88rem;color:${col};flex-shrink:0;min-width:28px;text-align:right;">${pct}%</span>
        <span style="font-family:var(--font-mono);font-size:0.88rem;color:${col};opacity:0.6;">↗</span>
      </div>`;
    }).join('');
  }

  const livingGroups   = buildBreakdown('sq3', ['With spouse/family','Alone — support nearby','Assisted living','Alone/isolated']);
  renderBreakdown('icc-sdoh-living',   livingGroups,    pn, 'Living Situation');

  const transportGroups = buildBreakdown('sq5', ['Reliable transport','Transport available','Difficult to access','Cannot access']);
  renderBreakdown('icc-sdoh-access',   transportGroups, pn, 'Access & Transport');

  const beliefGroups   = buildBreakdown('sq8', ['Strongly believes','Generally believes','Uncertain','Often doubts']);
  renderBreakdown('icc-sdoh-literacy', beliefGroups,    pn, 'Health Literacy & Beliefs');

  const supportGroups  = buildBreakdown('sq1', ['Spouse','Family member','Friend/caregiver','Manages alone']);
  renderBreakdown('icc-sdoh-support',  supportGroups,   pn, 'Social Support Network');

  // ── High social risk panel ───────────────────────────────────────────────
  const riskEl = el('icc-sdoh-risk');
  if (riskEl) {
    const mmasByPat = {};
    (mmasRecords || []).forEach(r => { if (r.patient_number) mmasByPat[r.patient_number] = r; });
    const highRisk = (peacsRecords || []).filter(r => (r.strata || 1) < 0.5);
    const highRiskWithLowMmas = highRisk.filter(r => {
      const mR = r.patient_number ? mmasByPat[r.patient_number] : null;
      return mR ? (mR.score || 8) < 6 : true;
    });
    const n = highRiskWithLowMmas.length;
    const riskPct = peacsPn > 0 ? Math.round(n/peacsPn*100) : 0;
    const domainPids = {};
    strataRecords.forEach(r => {
      const pid = r.patient_number;
      if (!pid) return;
      if (parseSqVal(r.sq3) !== null && parseSqVal(r.sq3) < 0.35) { if (!domainPids['Social isolation']) domainPids['Social isolation']=[]; domainPids['Social isolation'].push(pid); }
      if (parseSqVal(r.sq5) !== null && parseSqVal(r.sq5) < 0.35) { if (!domainPids['No reliable transport']) domainPids['No reliable transport']=[]; domainPids['No reliable transport'].push(pid); }
      if (parseSqVal(r.sq8) !== null && parseSqVal(r.sq8) < 0.35) { if (!domainPids['Low treatment belief']) domainPids['Low treatment belief']=[]; domainPids['Low treatment belief'].push(pid); }
      if (parseSqVal(r.sq6) !== null && parseSqVal(r.sq6) < 0.35) { if (!domainPids['Poor medication access']) domainPids['Poor medication access']=[]; domainPids['Poor medication access'].push(pid); }
    });
    const allRiskPids = highRiskWithLowMmas.map(r=>r.patient_number).filter(Boolean);

    if (!window._sdohBreakdownGroups) window._sdohBreakdownGroups = {};
    window._sdohBreakdownGroups['risk_all'] = { title: 'High Social Risk', color: '#ef4444', pids: allRiskPids };
    Object.entries(domainPids).forEach(([k, pids], i) => {
      window._sdohBreakdownGroups['risk_dom_' + i] = { title: 'High Social Risk · ' + k, color: '#ef4444', pids };
    });

    const domainTags = Object.entries(domainPids).sort((a,b)=>b[1].length-a[1].length).slice(0,4)
      .map(([k, pids], i) => `<span onclick="_openSDoHByKey('risk_dom_${i}')" style="font-family:var(--font-mono);font-size:0.86rem;padding:4px 10px;border-radius:10px;border:1px solid rgba(239,68,68,0.3);color:var(--poor);background:rgba(239,68,68,0.06);cursor:pointer;white-space:nowrap;" onmouseover="this.style.background='rgba(239,68,68,0.12)'" onmouseout="this.style.background='rgba(239,68,68,0.06)'">${k} (${pids.length})</span>`).join('');

    riskEl.innerHTML = `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
      <span onclick="_openSDoHByKey('risk_all')" style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;font-weight:300;color:var(--poor);cursor:pointer;text-decoration:underline;text-underline-offset:3px;" title="Click to see all high-risk patients">${n}</span>
      <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);">patients · ${riskPct}% of PEACS cohort</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;">${domainTags || '<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);">No specific risk domains identified</span>'}</div>`;
    window._sdohHighRiskPats = new Set(allRiskPids);
  }
}

function _openSDoHByKey(key) {
  const d = window._sdohBreakdownGroups && window._sdohBreakdownGroups[key];
  if (!d) { console.warn('SDoH key not found:', key); return; }
  _openSDoHDrawer(d.title, d.color, d.pids);
}

// Open patient drawer filtered to SDoH patient IDs
function _openSDoHDrawer(title, color, pids) {
  const pidSet = new Set(Array.isArray(pids) ? pids : []);
  const patients = (window._patientPanelData || []).filter(p => pidSet.has(p.pid));
  _openPhenotypeDrawer('SDoH · ' + title, color,
    patients.length ? patients : (pids||[]).map(pid => ({pid, ws:'—', mmas:[], peacs:[], lastTs:0})));
}


// ── Phenotype Patient Drawer ─────────────────────────────────────────────────
// Opens an overlay panel listing all patients in a given phenotype/profile
function _openPhenotypeDrawer(title, color, patients) {
  // Remove existing
  const old = document.getElementById('phenotype-drawer');
  if (old) old.remove();

  const drawer = document.createElement('div');
  drawer.id = 'phenotype-drawer';
  drawer.style.cssText = `position:fixed;top:0;right:0;bottom:0;width:520px;z-index:99990;background:var(--card);border-left:3px solid ${color};box-shadow:-8px 0 32px rgba(0,0,0,0.35);display:flex;flex-direction:column;animation:slideInRight 0.25s ease;`;

  // Header
  const header = `<div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;">
    <div style="flex:1;">
      <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${title}</div>
      <div style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);margin-top:2px;">${patients.length} patient${patients.length!==1?'s':''} · click a row to expand</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="_exportDrawerCSV()" style="font-family:var(--font-mono);font-size:0.82rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:4px 10px;cursor:pointer;">↓ CSV</button>
      <button onclick="document.getElementById('phenotype-drawer').remove()" style="font-family:var(--font-mono);font-size:0.88rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:4px 9px;cursor:pointer;">✕</button>
    </div>
  </div>`;

  // Search bar
  const search = `<div style="padding:10px 20px;border-bottom:1px solid var(--border);flex-shrink:0;">
    <input type="text" id="drawer-search" placeholder="Search patient ID or workspace…" oninput="_filterDrawer(this.value)"
      style="width:100%;font-family:var(--font-mono);font-size:0.90rem;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 12px;color:var(--text);outline:none;box-sizing:border-box;"/>
  </div>`;

  // Patient rows
  const rowsHtml = patients.length ? patients.map((p, i) => {
    const mmasScore = p.mmas.length ? (p.mmas[p.mmas.length-1].score||0).toFixed(2) : '—';
    const peScore   = p.peacs.length ? (p.peacs[p.peacs.length-1].pe||0).toFixed(3) : '—';
    const cat = p.mmas.length ? getAdherenceCategory(parseFloat(mmasScore)||0) : {color:'var(--dim)',label:'—'};
    const lastDate = p.lastTs ? new Date(p.lastTs).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '—';
    return `<div class="drawer-row" data-pid="${_esc(p.pid)}" data-ws="${_esc(p.ws)}" style="padding:10px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background=''" onclick="_toggleDrawerDetail(this,${i})">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${cat.color};flex-shrink:0;box-shadow:0 0 4px ${cat.color}80;"></div>
        <span style="font-family:var(--font-mono);font-size:0.80rem;color:var(--bright);font-weight:500;flex:1;">${_esc(p.pid)}</span>
        <span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">${_esc(p.ws)}</span>
        <span style="font-family:var(--font-mono);font-size:0.80rem;color:${cat.color};min-width:32px;text-align:right;">${mmasScore}</span>
        <span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--pe);min-width:40px;text-align:right;">${peScore}</span>
        <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);min-width:52px;text-align:right;">${lastDate}</span>
      </div>
      <div class="drawer-detail" style="display:none;margin-top:8px;padding:8px 12px;background:var(--card2);border-radius:6px;font-family:var(--font-mono);font-size:0.86rem;color:var(--muted);line-height:1.7;">
        ${p.mmas.length ? `MMAS-8: ${p.mmas.map(r=>`<span style="color:${getAdherenceCategory(r.score||0).color};">${(r.score||0).toFixed(2)}</span>`).join(' → ')} (${p.mmas.length} assessment${p.mmas.length>1?'s':''})` : 'No MMAS data'}
        <br>${p.peacs.length ? `PE: ${(p.peacs[p.peacs.length-1].pe||0).toFixed(3)} · B:${(p.peacs[p.peacs.length-1].base||0).toFixed(2)} M:${(p.peacs[p.peacs.length-1].mvmt||0).toFixed(2)} S:${(p.peacs[p.peacs.length-1].strata||0).toFixed(2)}` : 'No PEACS data'}
        <br>Condition: ${_esc(p.mmas[0]?.condition || '—')} · Country: ${_esc(p.mmas[0]?.country || p.peacs[0]?.country || '—')}
      </div>
    </div>`;
  }).join('') : `<div style="padding:32px 20px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">No patients classified into this phenotype yet.</div>`;

  drawer.innerHTML = `<style>@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}</style>
    ${header}${search}
    <div id="drawer-body" style="flex:1;overflow-y:auto;">${rowsHtml}</div>`;

  document.body.appendChild(drawer);
  window._drawerPatients = patients;
  window._drawerTitle    = title;

  // Click outside to close
  const overlay = document.createElement('div');
  overlay.id = 'phenotype-drawer-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99989;background:transparent;';
  overlay.onclick = () => { drawer.remove(); overlay.remove(); };
  document.body.insertBefore(overlay, drawer);
}

function _toggleDrawerDetail(row, i) {
  const det = row.querySelector('.drawer-detail');
  if (det) det.style.display = det.style.display === 'none' ? '' : 'none';
}

function _filterDrawer(q) {
  const ql = (q||'').toLowerCase();
  document.querySelectorAll('#phenotype-drawer .drawer-row').forEach(row => {
    const pid = (row.dataset.pid||'').toLowerCase();
    const ws  = (row.dataset.ws||'').toLowerCase();
    row.style.display = (!ql || pid.includes(ql) || ws.includes(ql)) ? '' : 'none';
  });
}

function _exportDrawerCSV() {
  const pats = window._drawerPatients || [];
  const title = (window._drawerTitle || 'phenotype').replace(/[^a-z0-9]/gi,'_');
  const rows = [['Patient ID','Workspace','MMAS Score','PE Score','Condition','Country'].join(',')];
  pats.forEach(p => {
    const mmasScore = p.mmas.length ? (p.mmas[p.mmas.length-1].score||0).toFixed(2) : '';
    const peScore   = p.peacs.length ? (p.peacs[p.peacs.length-1].pe||0).toFixed(3) : '';
    rows.push([p.pid, p.ws, mmasScore, peScore, p.mmas[0]?.condition||'', p.mmas[0]?.country||p.peacs[0]?.country||''].map(v=>`"${v}"`).join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${title}_patients.csv`; a.click();
}

// APE phenotype click → open drawer
function filterPatientsByApePhenotype(phenotypeId) {
  const ph = APE_PHENOTYPES.find(p => p.id === phenotypeId);
  const rows = window._patientPanelData || [];
  const filtered = rows.filter(p => {
    if (!p.mmas.length) return false;
    const worst = p.mmas.reduce((a,b) => (b.score||0)<(a.score||0)?b:a);
    const res = classifyApePhenotype(worst);
    return res && res.length && res[0].phenotype.id === phenotypeId && res[0].prob > 0.15;
  });
  _openPhenotypeDrawer(
    `APE · ${ph ? ph.icon+' '+ph.name : phenotypeId}`,
    ph ? ph.color : 'var(--base)',
    filtered
  );
}

// PPE profile click → open drawer
function filterPatientsByPpePhenotype(profileId) {
  const ph = PPE_PROFILES.find(p => p.id === profileId);
  const rows = window._patientPanelData || [];
  const filtered = rows.filter(p => {
    if (!p.peacs.length) return false;
    const latest = p.peacs[p.peacs.length-1];
    const res = classifyPpePhenotype(latest);
    return res && res.length && res[0].profile.id === profileId && res[0].prob > 0.15;
  });
  _openPhenotypeDrawer(
    `PPE · ${ph ? ph.icon+' '+ph.name : profileId}`,
    ph ? ph.color : 'var(--mvmt)',
    filtered
  );
}

// SDoH high-risk click → open drawer
function filterPatientsBySDoHRisk(domain) {
  const riskPats = window._sdohHighRiskPats || new Set();
  const rows = window._patientPanelData || [];
  const filtered = rows.filter(p => riskPats.has(p.pid));
  _openPhenotypeDrawer(
    `SDoH · High Social Risk${domain?' · '+domain:''}`,
    'var(--poor)',
    filtered
  );
}

function clearPatientPhenotypeFilter() {
  window._apePhFilter = null;
  window._ppePhFilter = null;
  const old = document.getElementById('icc-active-filter-badge');
  if (old) old.remove();
  renderPatientRows(window._patientPanelData || []);
}

function renderICCDemographics(records) {
  if (!records || !records.length) return;

  const GENDER_COLORS = {
    'Male': '#4e9cf5', 'Female': '#8b6ff5',
    'Other/Prefer not to say': '#2ec98a', 'Not specified': '#3d506a',
  };
  const AGE_COLORS   = ['#2ec98a','#4e9cf5','#8b6ff5','#d4a843','#f59e0b','#ef4444','#3b82f6','#10b981','#6b8099'];
  const EDU_COLORS   = ['#4e9cf5','#8b6ff5','#2ec98a','#d4a843','#f59e0b','#ef4444','#3b82f6','#10b981','#6b8099'];

  // ── Tally with normalization ──────────────────────────────────────────────
  const genderCounts = {}, ageCounts = {}, eduCounts = {};
  records.forEach(r => {
    const g = _normalizeDemoValue(r.gender          || '', _NORM_GENDER);
    const a = _normalizeAgeBand(r.age_range          || '');
    const e = _normalizeDemoValue(r.education_level  || '', _NORM_EDU);
    genderCounts[g] = (genderCounts[g] || 0) + 1;
    ageCounts[a]    = (ageCounts[a]    || 0) + 1;
    eduCounts[e]    = (eduCounts[e]    || 0) + 1;
  });

  const total = records.length;
  const WARN  = 0.60;

  // ── Short label map for display ───────────────────────────────────────────
  const SHORT = {
    'No formal education':                        'No formal',
    'Primary school (Elementary)':                'Primary',
    'Secondary school (High school)':             'Secondary / HS',
    'Some college / University (incomplete)':     'Some college',
    'Associate degree / Trade school':            'Associate / Trade',
    "Bachelor's degree":                          "Bachelor's",
    "Master's degree":                            "Master's",
    'Doctoral degree (PhD, MD, JD, etc.)':        'Doctoral',
    'Prefer not to say':                          'Prefer not to say',
    'Not specified':                              'Not specified',
    'Other/Prefer not to say':                    'Other / N/A',
  };

  // ── Generic horizontal bar renderer ──────────────────────────────────────
  function renderHBar(entries, colors, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const max = Math.max(...entries.map(e => e.count), 1);
    const topPct = entries[0]?.count / total;
    const warnHtml = topPct > WARN
      ? `<div style="display:flex;align-items:center;gap:5px;margin-bottom:7px;padding:4px 8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:5px;">
           <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;display:inline-block;"></span>
           <span style="font-family:var(--font-mono);font-size:0.88rem;color:#ef4444;">Imbalance · "${_esc(SHORT[entries[0].label]||entries[0].label)}" = ${Math.round(topPct*100)}%</span>
         </div>`
      : '';
    const bars = entries.map((e, i) => {
      const pct   = Math.round(e.count / total * 100);
      const width = Math.round(e.count / max * 100);
      const col   = typeof colors === 'object' && !Array.isArray(colors)
        ? (colors[e.label] || '#4e9cf5')
        : (colors[i % colors.length]);
      const lbl   = SHORT[e.label] || e.label;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);width:82px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${_esc(e.label)}">${_esc(lbl)}</div>
        <div style="flex:1;background:var(--border);border-radius:2px;height:8px;overflow:hidden;">
          <div style="width:${width}%;height:100%;background:${col};border-radius:2px;transition:width 0.4s ease;"></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.90rem;color:${col};width:28px;text-align:right;flex-shrink:0;">${pct}%</div>
        <div style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);width:20px;text-align:right;flex-shrink:0;">${e.count}</div>
      </div>`;
    }).join('');
    el.innerHTML = warnHtml + (bars || '<span style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No data recorded.</span>');
  }

  // ── Gender ────────────────────────────────────────────────────────────────
  const genderEntries = Object.entries(genderCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  renderHBar(genderEntries, GENDER_COLORS, 'icc-demo-gender');

  // ── Age — clinical order ──────────────────────────────────────────────────
  const AGE_ORDER = ['Under 18','18–24','25–34','35–44','45–54','55–64','65–74','75 or older','Prefer not to say','Not specified'];
  const ageEntries = Object.entries(ageCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const ia = AGE_ORDER.indexOf(a.label), ib = AGE_ORDER.indexOf(b.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  renderHBar(ageEntries, AGE_COLORS, 'icc-demo-age');

  // ── Education — lowest → highest ─────────────────────────────────────────
  const EDU_ORDER = [
    'No formal education','Primary school (Elementary)','Secondary school (High school)',
    'Some college / University (incomplete)','Associate degree / Trade school',
    "Bachelor's degree","Master's degree",'Doctoral degree (PhD, MD, JD, etc.)',
    'Prefer not to say','Not specified',
  ];
  const eduEntries = Object.entries(eduCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const ia = EDU_ORDER.indexOf(a.label), ib = EDU_ORDER.indexOf(b.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  renderHBar(eduEntries, EDU_COLORS, 'icc-demo-edu');
}

// ── mapData coord backfill (superadmin utility) ──────────────────────────────
// Finds all /mapData records with null or 0,0 coordinates and patches them
// using country centroids. Run once after bulk uploads with missing city data.
// Usage: atlasBackfillMapCoords() from console or superadmin tools panel.
const _ATLAS_CENTROIDS = {'Afghanistan':[33.93,67.71],'Algeria':[28.03,1.66],'Angola':[-11.20,17.87],'Argentina':[-38.42,-63.62],'Australia':[-25.27,133.78],'Austria':[47.52,14.55],'Azerbaijan':[40.14,47.58],'Bangladesh':[23.68,90.36],'Bolivia':[-16.29,-63.59],'Brazil':[-14.24,-51.93],'Cambodia':[12.57,104.99],'Cameroon':[7.37,12.35],'Canada':[56.13,-106.35],'Chile':[-35.68,-71.54],'China':[35.86,104.20],'Colombia':[4.57,-74.30],'Croatia':[45.10,15.20],'Cuba':[21.52,-77.78],'Czechia':[49.82,15.47],'Czech Republic':[49.82,15.47],'Denmark':[56.26,9.50],'Ecuador':[-1.83,-78.18],'Egypt':[26.82,30.80],'Ethiopia':[9.15,40.49],'Finland':[61.92,25.75],'France':[46.23,2.21],'Germany':[51.17,10.45],'Ghana':[7.95,-1.02],'Greece':[39.07,21.82],'Guatemala':[15.78,-90.23],'Honduras':[15.20,-86.24],'Hungary':[47.16,19.50],'India':[20.59,78.96],'Indonesia':[-0.79,113.92],'Iran':[32.43,53.69],'Iraq':[33.22,43.68],'Ireland':[53.41,-8.24],'Israel':[31.05,34.85],'Italy':[41.87,12.57],'Japan':[36.20,138.25],'Jordan':[30.59,36.24],'Kazakhstan':[48.02,66.92],'Kenya':[0.02,37.91],'Kuwait':[29.31,47.48],'Kyrgyzstan':[41.20,74.77],'Lebanon':[33.85,35.86],'Libya':[26.34,17.23],'Malaysia':[4.21,101.98],'Mexico':[23.63,-102.55],'Moldova':[47.41,28.37],'Morocco':[31.79,-7.09],'Mozambique':[-18.67,35.53],'Myanmar':[16.87,96.08],'Nepal':[28.39,84.12],'Netherlands':[52.13,5.29],'New Zealand':[-40.90,174.89],'Nicaragua':[12.87,-85.21],'Nigeria':[9.08,8.68],'Norway':[60.47,8.47],'Oman':[21.51,55.92],'Pakistan':[30.38,69.35],'Panama':[8.54,-80.78],'Paraguay':[-23.44,-58.44],'Peru':[-9.19,-75.02],'Philippines':[12.88,121.77],'Poland':[51.92,19.15],'Portugal':[39.40,-8.22],'Qatar':[25.35,51.18],'Romania':[45.94,24.97],'Russia':[61.52,105.32],'Saudi Arabia':[23.89,45.08],'Senegal':[14.50,-14.45],'Serbia':[44.02,21.01],'Singapore':[1.35,103.82],'Somalia':[5.15,46.20],'South Africa':[-30.56,22.94],'South Korea':[35.91,127.77],'Spain':[40.46,-3.75],'Sri Lanka':[7.87,80.77],'Sweden':[60.13,18.64],'Switzerland':[46.82,8.23],'Syria':[34.80,38.99],'Taiwan':[23.70,120.96],'Tajikistan':[38.86,71.28],'Tanzania':[-6.37,34.89],'Thailand':[15.87,100.99],'Tunisia':[33.89,9.54],'Turkey':[38.96,35.24],'Uganda':[1.37,32.29],'Ukraine':[48.38,31.17],'United Arab Emirates':[23.42,53.85],'United Kingdom':[55.38,-3.44],'United States':[37.09,-95.71],'Uruguay':[-32.52,-55.77],'Uzbekistan':[41.38,64.59],'Venezuela':[6.42,-66.59],'Vietnam':[14.06,108.28],'Yemen':[15.55,48.52],'Zambia':[-13.13,27.85],'Zimbabwe':[-19.02,29.15]};

async function atlasBackfillMapCoords() {
  const user = firebase.auth().currentUser;
  if (!user) { showToast('Not authenticated.', 2500); return; }
  const tok = await user.getIdTokenResult();
  if (tok.claims?.role !== 'superadmin') { showToast('Superadmin only.', 2500); return; }

  showToast('Scanning mapData for null coordinates…', 3000);
  const snap = await database.ref('mapData').once('value');
  if (!snap.exists()) { showToast('mapData is empty.', 2000); return; }

  // Collect records that need patching: { key, lat, lng }
  const toPatch = [];
  let skipped = 0;

  snap.forEach(child => {
    const r   = child.val();
    const key = child.key;
    const hasCoords = r.latitude && r.longitude && !(r.latitude === 0 && r.longitude === 0);
    // Normalize country name to title-case for centroid lookup
    const nc = (r.country || '').trim().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const ctr = _ATLAS_CENTROIDS[nc];
    // Skip only if coords are real AND not sitting exactly on the country centroid (failed geocode fallback)
    const atCentroid = ctr && hasCoords && Math.abs(r.latitude - ctr[0]) < 0.01 && Math.abs(r.longitude - ctr[1]) < 0.01;
    if (hasCoords && !atCentroid) { skipped++; return; }
    if (!ctr) { skipped++; return; }
    toPatch.push({ key, lat: ctr[0], lng: ctr[1] });
  });

  if (!toPatch.length) { showToast(`No null-coord records found. ${skipped} already have coordinates.`, 3500); return; }

  showToast(`Patching ${toPatch.length} records…`, 3000);

  // Write each record at its own node path — root-level multi-path updates are
  // blocked by Firebase rules. Per-node updates hit only the allowed path.
  let patched = 0, failed = 0;
  await Promise.all(toPatch.map(async ({ key, lat, lng }) => {
    try {
      await database.ref('mapData/' + key).update({ latitude: lat, longitude: lng });
      patched++;
    } catch (e) {
      console.warn('[ATLAS] backfill failed for', key, e.message);
      failed++;
    }
  }));

  const msg = failed
    ? `Patched ${patched} · ${failed} failed (check console). ${skipped} already had coords.`
    : `✓ Patched ${patched} records with country centroids. ${skipped} already had coordinates.`;
  showToast(msg, 6000);
}

window.atlasBackfillMapCoords = atlasBackfillMapCoords;


