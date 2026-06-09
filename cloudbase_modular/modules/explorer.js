// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1 — EXPLORER CONVERSION TIMER
//  Starts a 10-minute countdown when Explorer mode is entered.
//  On expiry, shows the conversion overlay. User can dismiss once
//  to continue in Explorer mode (data still goes to global pool).
// ══════════════════════════════════════════════════════════════════════════
/** @type {ReturnType<typeof setTimeout>|null} Timer handle for the explorer conversion overlay */
let _explorerTimerId = null;
/** @type {ReturnType<typeof setTimeout>|null} Timer handle for the 8-minute email gate */
let _explorerGateTimerId = null;
/** @type {ReturnType<typeof setInterval>|null} Tick interval for sub-minute explorer milestones */
let _explorerTickId = null;
/** @type {number} Duration in ms before the Explorer conversion overlay appears (10 minutes) */
const EXPLORER_DEMO_MS = 10 * 60 * 1000; // 10 minutes
/** @type {number} Mutable timeout used by the extend hook */
let EXPLORER_TIMEOUT_MS = 10 * 60 * 1000;

// ── Custom Metadata Filter ────────────────────────────────────────────────────
/** @type {string|null} Active custom field filter value */
let _explorerCustomFilter = null;
/** @type {string} Label for the custom metadata field */
let _explorerCustomFieldLabel = (function() {
  try { return localStorage.getItem('_explorerCustomFieldLabel') || 'Subgroup'; } catch(_) { return 'Subgroup'; }
})();

/**
 * Renders the custom field filter bar above the records table.
 * @param {Object[]} records - all loaded records
 * @param {HTMLElement} container - filter bar container
 */
function renderExplorerFilterBar(records, container) {
  if (!container || !records || !records.length) return;

  // Collect unique values of custom_field_1
  const values = [...new Set(records.map(r => r.custom_field_1).filter(Boolean))];
  if (!values.length) return;

  const label = _explorerCustomFieldLabel || 'Subgroup';

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);">${label}:</span>
      <button onclick="_explorerSetFilter(null)"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;padding:4px 10px;border-radius:5px;cursor:pointer;transition:all 0.15s;background:${_explorerCustomFilter===null?'rgba(46,201,138,0.15)':'transparent'};border:1px solid ${_explorerCustomFilter===null?'rgba(46,201,138,0.4)':'rgba(255,255,255,0.1)'};color:${_explorerCustomFilter===null?'rgba(46,201,138,0.9)':'rgba(255,255,255,0.4)'};">
        All
      </button>
      ${values.map(v => `
        <button onclick="_explorerSetFilter('${v.replace(/'/g, "\\'")}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;padding:4px 10px;border-radius:5px;cursor:pointer;transition:all 0.15s;background:${_explorerCustomFilter===v?'rgba(46,201,138,0.15)':'transparent'};border:1px solid ${_explorerCustomFilter===v?'rgba(46,201,138,0.4)':'rgba(255,255,255,0.1)'};color:${_explorerCustomFilter===v?'rgba(46,201,138,0.9)':'rgba(255,255,255,0.4)'};">
          ${v}
        </button>`).join('')}
      <button onclick="_explorerConfigCustomField()" title="Configure custom field label"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;padding:4px 8px;border-radius:5px;cursor:pointer;background:none;border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.25);">⚙</button>
    </div>`;
}

/**
 * Sets the active custom field filter and refreshes the Explorer records view.
 * @param {string|null} value - filter value to apply, or null to clear
 */
function _explorerSetFilter(value) {
  _explorerCustomFilter = value;
  if (typeof _explorerRefreshTable === 'function') _explorerRefreshTable();
  else if (typeof refreshExplorerView === 'function') refreshExplorerView();
}

/**
 * Filters the displayed records by the value of custom_field_1.
 * @param {Object[]} records - full records array to filter
 * @returns {Object[]} filtered records
 */
function _explorerFilterByCustomField(records) {
  if (!_explorerCustomFilter || !records) return records;
  return records.filter(r => r.custom_field_1 === _explorerCustomFilter);
}

/**
 * Opens a prompt allowing the Explorer user to rename the custom grouping field label.
 * Persists to localStorage so the label survives page reloads.
 */
function _explorerConfigCustomField() {
  const newLabel = prompt(
    'Enter a label for your custom grouping field (e.g. "Medication Class", "Clinic Site", "ARV Regimen"):',
    _explorerCustomFieldLabel || 'Subgroup'
  );
  if (newLabel !== null && newLabel.trim()) {
    _explorerCustomFieldLabel = newLabel.trim();
    try { localStorage.setItem('_explorerCustomFieldLabel', _explorerCustomFieldLabel); } catch(_) {}
  }
}

/**
 * Starts (or restarts) the 10-minute countdown that triggers the Explorer conversion overlay.
 * Also schedules the 8-minute academic email gate.
 * @returns {void}
 */
function startExplorerConversionTimer() {
  if (_explorerTimerId) clearTimeout(_explorerTimerId);
  if (_explorerGateTimerId) clearTimeout(_explorerGateTimerId);
  if (_explorerTickId) clearInterval(_explorerTickId);

  const _startTime = Date.now();

  // ── CTO2: Tick interval for sub-milestone checks (every 15 seconds) ──────
  _explorerTickId = setInterval(function() {
    const elapsed = Date.now() - _startTime;
    if (typeof _explorerMaybeShowAdminPreview === 'function') {
      _explorerMaybeShowAdminPreview(elapsed);
    }
  }, 15000);

  // ── S3: 8-minute gate — show email prompt if not already academic ──────────
  if (!sessionStorage.getItem('_explorer_academic')) {
    _explorerGateTimerId = setTimeout(() => {
      if (window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER') {
        const gate = document.getElementById('explorer-email-gate');
        if (gate) gate.style.display = 'flex';
      }
    }, 8 * 60 * 1000);
  }

  // ── Expose extend hook for S3 email gate ──────────────────────────────────
  window._explorerTimerExtend = function(newMs) {
    EXPLORER_TIMEOUT_MS = newMs;
    if (_explorerTimerId) clearTimeout(_explorerTimerId);
    if (_explorerGateTimerId) clearTimeout(_explorerGateTimerId);
    _explorerTimerId = setTimeout(() => {
      if (window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER') {
        const overlay = document.getElementById('explorer-conversion-overlay');
        if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
      }
    }, newMs);
  };

  // Keep the session expiry logic — shows conversion overlay after timeout
  // but do NOT inject a second banner bar. The green explorer-mode-banner
  // injected by injectExplorerBanner is the single source of truth.
  _explorerTimerId = setTimeout(() => {
    if (window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER') {
      const overlay = document.getElementById('explorer-conversion-overlay');
      if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    }
  }, EXPLORER_TIMEOUT_MS);
}

// ── S3: Academic Email Extension ──────────────────────────────────────────
const _ACADEMIC_TLDS = ['.edu','.ac.uk','.ac.au','.edu.au','.ac.nz','.ac.za','.ac.in','.edu.in','.ac.ca','.edu.ca'];

function explorerExtendSession() {
  const email = (document.getElementById('exp-gate-email').value || '').toLowerCase().trim();
  const isAcademic = _ACADEMIC_TLDS.some(t => email.endsWith(t)) || email.includes('.edu');
  if (!isAcademic) {
    const err = document.getElementById('exp-gate-err');
    if (err) err.style.display = 'block';
    return;
  }
  sessionStorage.setItem('_explorer_academic', '1');
  sessionStorage.setItem('_explorer_email', email);
  document.getElementById('explorer-email-gate').style.display = 'none';
  // Extend timer — find and update the running timer
  if (window._explorerTimerExtend) window._explorerTimerExtend(25 * 60 * 1000);
}

/**
 * Dismisses the Explorer conversion overlay, allowing the user to continue in Explorer mode.
 * @returns {void}
 */
function dismissExplorerConversion() {
  const overlay = document.getElementById('explorer-conversion-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  showToast('Continuing in Explorer mode — data contributes to the global pool only.', 4000);
}

/** Removes the Explorer timer banner DOM element and cancels the conversion timer. @returns {void} */
function removeExplorerBanner() {
  const b = document.getElementById('explorer-timer-banner');
  if (b) b.remove();
  if (_explorerTimerId) { clearTimeout(_explorerTimerId); _explorerTimerId = null; }
  if (_explorerTickId) { clearInterval(_explorerTickId); _explorerTickId = null; }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPLORER MODE — REBUILT FROM SCRATCH
// Clean single-modal tour. No floating cards. No stacking. No clumping.
// Snapshot data fires instantly. Live data replaces it when auth resolves.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ExplorerSnapshot
 * @property {number} mmasTotal - Total MMAS-8 submissions displayed
 * @property {number} countries - Number of countries represented
 * @property {number} avgScore - Global average MMAS-8 score
 * @property {number} peacsTotal - Total PEACS assessments
 * @property {number} avgPE - Average PE composite score
 * @property {number} inaCount - Count of intentional non-adherence records
 * @property {number} unaCount - Count of unintentional non-adherence records
 * @property {number} mixedCount - Count of mixed-pattern records
 * @property {number} highCount - Count of high-adherence records
 */

/** @type {ExplorerSnapshot} Seed values shown before Firebase data loads in Explorer mode */
const EXPLORER_SNAPSHOT = {
  mmasTotal: 1826, countries: 22, avgScore: 5.45,
  peacsTotal: 1278, avgPE: 0.614,
  inaCount: 387, unaCount: 761, mixedCount: 421, highCount: 251,
  avgBase: 0.71, avgMvmt: 0.58, avgStrata: 0.54,
  optimal: 189, good: 312, moderate: 498, poor: 269,
  // MAP — Track A
  mapTotal: 842, mapAvgScore: 6.12,
  mapAvgArch: 0.74, mapAvgExec: 0.68, mapAvgCtx: 0.71, mapAvgPE: 0.706,
  mapIna: 142, mapUna: 318, mapMixed: 198, mapHigh: 184,
};

// ── Animate a number from current value to target ──────────────────────────
/**
 * Animates a numeric counter element from its current displayed value to a target value.
 * @param {string} id - DOM element ID to animate
 * @param {number} target - Target numeric value
 * @param {number} dec - Decimal places for toFixed; 0 uses toLocaleString integer
 * @param {number} [delay] - Optional delay in ms before animation starts
 * @returns {void}
 */
function _eAnim(id, target, dec, delay) {
  const el = document.getElementById(id);
  if (!el) return;
  setTimeout(() => {
    const from = parseFloat(el.getAttribute('data-snap') || '0');
    const dur = 1200, t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * ease;
      el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
      else el.setAttribute('data-snap', target);
    }
    requestAnimationFrame(tick);
  }, delay || 0);
}

/**
 * Animates all Explorer snapshot stat counters into their seed values with staggered delays.
 * Called immediately when Explorer mode loads and again after Firebase data arrives.
 * @returns {void}
 */
function injectExplorerSnapshot() {
  const s = EXPLORER_SNAPSHOT;
  const d = (n) => n * 80; // stagger delay

  // Pulse bar
  _eAnim('pulse-mmas-total',  s.mmasTotal,  0, d(0));
  _eAnim('pulse-countries',   s.countries,  0, d(1));
  _eAnim('pulse-avg',         s.avgScore,   2, d(2));
  _eAnim('pulse-peacs-total', s.peacsTotal, 0, d(3));
  _eAnim('pulse-avg-pe',      s.avgPE,      3, d(4));

  // MMAS card
  _eAnim('mmas-total',    s.mmasTotal, 0, d(1));
  _eAnim('mmas-countries',s.countries, 0, d(2));
  _eAnim('mmas-avg',      s.avgScore,  2, d(3));
  _eAnim('mmas-n-ina',    s.inaCount,  0, d(4));
  _eAnim('mmas-n-una',    s.unaCount,  0, d(5));
  _eAnim('mmas-n-mixed',  s.mixedCount,0, d(6));
  _eAnim('mmas-n-high',   s.highCount, 0, d(7));
  const el = document.getElementById('mmas-high-pct');
  if (el) el.textContent = Math.round(s.highCount/s.mmasTotal*100)+'%';

  // Segment bar
  setTimeout(() => {
    const t = s.mmasTotal;
    const sb = id => document.getElementById(id);
    if(sb('mmas-seg-high'))  sb('mmas-seg-high').style.width  = (s.highCount/t*100)+'%';
    if(sb('mmas-seg-una'))   sb('mmas-seg-una').style.width   = (s.unaCount/t*100)+'%';
    if(sb('mmas-seg-ina'))   sb('mmas-seg-ina').style.width   = (s.inaCount/t*100)+'%';
    if(sb('mmas-seg-mixed')) sb('mmas-seg-mixed').style.width = (s.mixedCount/t*100)+'%';
  }, 700);

  // Mission control sync
  ['mc-mmas-total','mc-mmas-countries','mc-mmas-avg','mc-ina-count','mc-una-count','mc-mixed-count','mc-high-count']
    .forEach((id, i) => {
      const vals = [s.mmasTotal,s.countries,s.avgScore,s.inaCount,s.unaCount,s.mixedCount,s.highCount];
      const decs = [0,0,2,0,0,0,0];
      _eAnim(id, vals[i], decs[i], d(2));
    });

  // PEACS card
  _eAnim('peacs-total',      s.peacsTotal, 0, d(2));
  _eAnim('peacs-countries',  s.countries,  0, d(3));
  _eAnim('peacs-avg-pe',     s.avgPE,      3, d(4));
  _eAnim('peacs-avg-base',   s.avgBase,    2, d(5));
  _eAnim('peacs-avg-mvmt',   s.avgMvmt,    2, d(6));
  _eAnim('peacs-avg-strata', s.avgStrata,  2, d(7));
  _eAnim('peacs-n-optimal',  s.optimal,    0, d(5));
  _eAnim('peacs-n-good',     s.good,       0, d(6));
  _eAnim('peacs-n-mod',      s.moderate,   0, d(7));
  _eAnim('peacs-n-poor',     s.poor,       0, d(8));
  const opEl = document.getElementById('peacs-optimal-pct');
  if (opEl) opEl.textContent = Math.round(s.optimal/s.peacsTotal*100)+'%';

  // MAP card — Track A
  _eAnim('mc-map-total',      s.mapTotal,    0, d(1));
  _eAnim('mc-map-countries',  s.countries,   0, d(2));
  _eAnim('mc-map-avg',        s.mapAvgScore, 2, d(3));
  _eAnim('mc-map-arch',       s.mapAvgArch,  2, d(4));
  _eAnim('mc-map-exec',       s.mapAvgExec,  2, d(5));
  _eAnim('mc-map-ctx',        s.mapAvgCtx,   2, d(6));
  _eAnim('mc-map-pe-avg',     s.mapAvgPE,    3, d(7));
  _eAnim('mc-map-ina-count',  s.mapIna,      0, d(4));
  _eAnim('mc-map-una-count',  s.mapUna,      0, d(5));
  _eAnim('mc-map-mixed-count',s.mapMixed,    0, d(6));
  _eAnim('mc-map-high-count', s.mapHigh,     0, d(7));
  // MAP dist bar
  setTimeout(() => {
    const mt = s.mapTotal;
    const ms = id => document.getElementById(id);
    if(ms('map-card-seg-high'))  ms('map-card-seg-high').style.width  = (s.mapHigh/mt*100)+'%';
    if(ms('map-card-seg-una'))   ms('map-card-seg-una').style.width   = (s.mapUna/mt*100)+'%';
    if(ms('map-card-seg-ina'))   ms('map-card-seg-ina').style.width   = (s.mapIna/mt*100)+'%';
    if(ms('map-card-seg-mixed')) ms('map-card-seg-mixed').style.width = (s.mapMixed/mt*100)+'%';
  }, 700);

  // Timestamps
  const ts = 'Snapshot · ' + new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  ['mmas-last-updated','peacs-last-updated'].forEach(id => {
    const e = document.getElementById(id); if (e) e.textContent = ts;
  });
}

// ── Hide all export/download controls for Explorer ────────────────────────
function lockExplorerExports() {
  const HIDE = [
    '#dash-mmas-export-btn','#dash-export-btn',
    '#mmas-export-btn','#peacs-export-btn',
    '#pi-blinded-export-btn','#pi-provision-btn',
    '#irb-cert-btn','#irb-aggregate-btn',
    '#cohort-pdf-btn','#strat-export-btn',
    '#map-export-btn','#mapc-export-btn','#dash-qr-btn',
    '#dash-bulk-btn',
  ];
  HIDE.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
  });
  // Override export functions at runtime
  window.exportMmasCSV        = () => showToast('Data export requires a workspace key.', 3000);
  window.exportPeacsCSV       = () => showToast('Data export requires a workspace key.', 3000);
  window.exportMapCSV         = () => showToast('Data export requires a workspace key.', 3000);
  window.exportInstitutionCSV = () => showToast('Data export requires a workspace key.', 3000);
  window.exportCohortPDF      = () => showToast('Data export requires a workspace key.', 3000);
  window.rppExportCSV         = () => showToast('Data export requires a workspace key.', 3000);
  window.iccExportCSV         = () => showToast('Data export requires a workspace key.', 3000);
  window.mtmExportCSV         = () => showToast('Data export requires a workspace key.', 3000);
  window.mtmExportPDF         = () => showToast('Data export requires a workspace key.', 3000);
}

// ── Single tour modal — one card, centered, replaces itself on next/prev ──
const EXPLORER_TOUR = [
  {
    icon: '◈',
    title: 'Real Global Data',
    body: 'Every number you see is a real patient, a real medication, a real adherence decision — collected across 22 countries using the MMAS-8, the most validated adherence scale in clinical literature with over 3,000 published studies.',
    cta: null,
  },
  {
    icon: '⬡',
    title: 'Two Instruments, One Platform',
    body: 'Track A (MAP) measures eight distinct behavioral dimensions of adherence. Track B (PEACS) predicts whether patients will sustain adherence over time. Track C (MMAS-8) provides the validated legacy reference instrument for concurrent validity comparison.',
    cta: null,
  },
  {
    icon: '◉',
    title: 'Adherence Phenotyping',
    body: 'ATLAS classifies every patient as INA (Intentional Non-Adherent), UNA (Unintentional), Mixed, or High. INA and UNA require completely different clinical interventions — confusing them wastes resources and harms outcomes.',
    cta: null,
  },
  {
    icon: '✦',
    title: 'Predictive Emergence',
    body: 'PE = (Adherence × Engagement × Compliance)^(1/3). Developed by Philip Morisky. Validated retrospectively against COVID-19 outcomes across 12 nations (r = +0.787). Independently incorporated into an EPA World Congress presentation, March 2026.',
    cta: null,
  },
  {
    icon: '⊕',
    title: 'Your Workspace Awaits',
    body: 'Your Explorer workspace is free up to 50 assessments. A paid key unlocks full MAP licensing, Sentinel alerts, data export, and your IRB certificate. Student keys start at $19/month. Researcher and PI tiers available. Institution plans from $399/month.',
    cta: { label: 'Get a Workspace Key →', url: 'https://keys.adherence.cc' },
  },
];

let _explorerTourStep = 0;

function startExplorerTour() {
  _explorerTourStep = 0;
  _showExplorerTourStep();
}

function _showExplorerTourStep() {
  // Always remove existing modal first
  const old = document.getElementById('explorer-tour-modal');
  if (old) old.remove();

  const step = EXPLORER_TOUR[_explorerTourStep];
  if (!step) return;

  const total = EXPLORER_TOUR.length;
  const isLast = _explorerTourStep === total - 1;
  const isFirst = _explorerTourStep === 0;

  const modal = document.createElement('div');
  modal.id = 'explorer-tour-modal';
  modal.style.cssText = [
    'position:fixed;inset:0;z-index:99999',
    'display:flex;align-items:center;justify-content:center',
    'background:rgba(2,6,18,0.75)',
    'backdrop-filter:blur(4px)',
    '-webkit-backdrop-filter:blur(4px)',
    'padding:24px',
    'animation:fadeIn 0.25s ease both',
  ].join(';');

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeExplorerTour();
  });

  const dots = Array.from({length: total}, (_,i) =>
    `<div style="width:${i===_explorerTourStep?24:8}px;height:4px;border-radius:2px;background:${i===_explorerTourStep?'rgba(212,168,67,0.9)':i<_explorerTourStep?'rgba(212,168,67,0.35)':'rgba(255,255,255,0.12)'};transition:all 0.3s ease;"></div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:#0d1829;border:1px solid rgba(212,168,67,0.25);border-top:2px solid rgba(212,168,67,0.75);border-radius:16px;padding:36px 40px 28px;max-width:520px;width:100%;position:relative;animation:fadeUp 0.3s ease both;">
      <button onclick="closeExplorerTour()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:1.1rem;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:all 0.2s;" onmouseover="this.style.color='rgba(255,255,255,0.8)';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.4)';this.style.background='none'">✕</button>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:20px;">Explorer Tour · ${_explorerTourStep+1} of ${total}</div>
      <div style="font-size:1.8rem;margin-bottom:14px;color:rgba(212,168,67,0.85);">${step.icon}</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.75rem;font-weight:300;color:#ffffff;margin-bottom:14px;line-height:1.2;">${step.title}</div>
      <div style="font-size:0.88rem;color:rgba(220,232,248,0.92);line-height:1.75;margin-bottom:28px;">${step.body}</div>
      <div style="display:flex;gap:6px;margin-bottom:24px;">${dots}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${!isFirst ? `<button onclick="explorerTourPrev()" style="font-family:'IBM Plex Mono',monospace;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.4);border-radius:8px;padding:9px 18px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.3)';this.style.color='rgba(255,255,255,0.7)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='rgba(255,255,255,0.4)'">← Back</button>` : ''}
        <button onclick="${isLast ? 'closeExplorerTour()' : 'explorerTourNext()'}" style="flex:1;min-width:120px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.45);color:rgba(212,168,67,0.95);border-radius:8px;padding:10px 20px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(212,168,67,0.22)'" onmouseout="this.style.background='rgba(212,168,67,0.12)'">${isLast ? 'Done ✓' : 'Next →'}</button>
        ${step.cta ? `<a href="${step.cta.url}" target="_blank" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(46,201,138,0.1);border:1px solid rgba(46,201,138,0.4);color:#2ec98a;border-radius:8px;padding:10px 20px;cursor:pointer;transition:all 0.2s;text-decoration:none;white-space:nowrap;" onmouseover="this.style.background='rgba(46,201,138,0.2)'" onmouseout="this.style.background='rgba(46,201,138,0.1)'">${step.cta.label}</a>` : ''}
      </div>
    </div>`;

  document.body.appendChild(modal);
}

function explorerTourNext() {
  if (_explorerTourStep < EXPLORER_TOUR.length - 1) {
    _explorerTourStep++;
    _showExplorerTourStep();
  }
}
function explorerTourPrev() {
  if (_explorerTourStep > 0) {
    _explorerTourStep--;
    _showExplorerTourStep();
  }
}
function closeExplorerTour() {
  const m = document.getElementById('explorer-tour-modal');
  if (m) m.remove();
}

// ── Add fadeIn keyframe if not present ────────────────────────────────────
(function addFadeIn() {
  if (document.getElementById('atlas-fadein-style')) return;
  const s = document.createElement('style');
  s.id = 'atlas-fadein-style';
  s.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(s);
})();

// ── Explorer banner — clean single bar ───────────────────────────────────
function injectExplorerBanner() {
  const existing = document.getElementById('explorer-mode-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'explorer-mode-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:22px;padding:14px 20px;background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.18);border-radius:12px;flex-wrap:wrap;';
  const wsLabel = window._freemiumKey || 'EXPL-…';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px;">
      <span style="width:7px;height:7px;border-radius:50%;background:#2ec98a;box-shadow:0 0 6px #2ec98a;flex-shrink:0;animation:blink 2s ease-in-out infinite;"></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:#2ec98a;">Explorer · Free Tier</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:rgba(46,201,138,0.5);margin-left:4px;">${wsLabel}</span>
    </div>
    <span id="freemium-counter" style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.08em;color:rgba(200,216,234,0.5);">0 of 50 free assessments used</span>
    <button onclick="startExplorerTour()" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.3);color:rgba(212,168,67,0.85);border-radius:8px;padding:8px 16px;cursor:pointer;transition:all 0.2s;white-space:nowrap;" onmouseover="this.style.background='rgba(212,168,67,0.16)'" onmouseout="this.style.background='rgba(212,168,67,0.08)'">⬡ Tour</button>
    <a href="https://keys.adherence.cc" target="_blank" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.3);color:#2ec98a;border-radius:8px;padding:8px 16px;cursor:pointer;transition:all 0.2s;text-decoration:none;white-space:nowrap;" onmouseover="this.style.background='rgba(46,201,138,0.18)'" onmouseout="this.style.background='rgba(46,201,138,0.08)'">Upgrade →</a>`;

  const dashBody = document.querySelector('#screen-dashboard .dash-body');
  if (dashBody) dashBody.insertBefore(banner, dashBody.firstChild);
}

// ── Stat tooltip definitions — covers all MMAS, PEACS, and dimension cells ─
const EXPLORER_STAT_TIPS = {
  'pulse-mmas-total':    { label: 'MMAS-8 Submissions',              text: 'Total validated medication adherence assessments collected globally. Each represents one patient\'s honest self-report using the Morisky scale.' },
  'pulse-countries':     { label: 'Countries Represented',           text: 'Geographic reach of the live dataset. ATLAS is the only real-time adherence mapping platform with simultaneous validated data across this many nations.' },
  'pulse-avg':           { label: 'Global Average Score',            text: 'Mean MMAS-8 score across all submissions. Score 8 = fully adherent. Below 6 = low adherence. A global average of 5.45 means most patients are missing doses — this is the crisis ATLAS maps.' },
  'pulse-avg-pe':        { label: 'Avg Predictive Emergence',        text: 'Mean PE score across PEACS assessments. PE = (BASE × MVMT × STRATA)^(1/3). Closer to 1.0 = sustained behavioral stability predicted. Validated against COVID-19 outcomes across 12 nations.' },
  'mmas-total':          { label: 'MMAS-8 Submissions',              text: 'Total MMAS-8 assessments in the global dataset. The MMAS-8 has over 3,000 published studies and is validated across 100+ countries and 60+ languages.' },
  'mmas-countries':      { label: 'Countries',                       text: 'Number of distinct countries in the dataset. Each country adds population-level context to the global adherence map.' },
  'mmas-avg':            { label: 'Average Score',                   text: 'Mean MMAS-8 score. A score of 8 is fully adherent. Below 6 is clinically low adherence. This global average reflects a worldwide medication adherence crisis.' },
  'mmas-n-ina':          { label: 'INA — Intentional Non-Adherence', text: 'The patient knows they should take their medication but chooses not to — driven by side effects, doubts about necessity, or cost. This pattern is 3× harder to address than UNA and requires motivational intervention, not just reminders.' },
  'mmas-n-una':          { label: 'UNA — Unintentional Non-Adherence', text: 'The patient intends to take their medication but forgets, runs out, or faces access barriers. The most common adherence pattern globally. Responds well to pill organizers, phone reminders, and pharmacy support programs.' },
  'mmas-n-mixed':        { label: 'Mixed Adherence Pattern',         text: 'Both intentional and unintentional non-adherence are present. Often seen in patients managing multiple medications (polypharmacy) or facing complex life circumstances. Requires a combined clinical and behavioral approach.' },
  'mmas-n-high':         { label: 'High Adherence',                  text: 'Patients scoring 8/8 on the MMAS-8 — fully adherent. Understanding what this group does differently is as clinically valuable as understanding why others fail.' },
  'mmas-high-pct':       { label: 'High Adherence %',                text: 'Percentage of patients achieving a perfect score. A key benchmark for comparing populations, conditions, and interventions.' },
  'mc-mmas-total':       { label: 'MMAS-8 Submissions',              text: 'Total assessments in the active cohort. Explorer mode shows the full global dataset.' },
  'mc-mmas-countries':   { label: 'Countries',                       text: 'Distinct countries represented in the cohort.' },
  'mc-mmas-avg':         { label: 'Average Score',                   text: 'Mean MMAS-8 score for the cohort. Below 6 is clinically low adherence.' },
  'mc-ina-count':        { label: 'INA — Intentional',               text: 'Patients choosing not to take their medication. The most complex adherence pattern to address — requires understanding why, not just reminding.' },
  'mc-una-count':        { label: 'UNA — Unintentional',             text: 'Patients trying to adhere but facing practical barriers. The most addressable pattern — systems and routines are highly effective.' },
  'mc-mixed-count':      { label: 'Mixed Pattern',                   text: 'Patients showing both intentional and unintentional non-adherence. Often seen in polypharmacy patients.' },
  'mc-high-count':       { label: 'High Adherence',                  text: 'Fully adherent patients. This group can serve as behavioral models and peer mentors in clinical programs.' },
  'peacs-total':         { label: 'PEACS Assessments',               text: 'Total assessments using the Predictive Emergence Assessment and Compliance Scale. PEACS maps three behavioral dimensions to a single PE score via the Theory of Predictive Emergence.' },
  'peacs-countries':     { label: 'Countries',                       text: 'Geographic reach of PEACS data. Cross-cultural validation strengthens the Predictive Emergence model.' },
  'peacs-avg-pe':        { label: 'Mean Predictive Emergence (PE)',   text: 'PE = (BASE × MVMT × STRATA)^(1/3). Validated retrospectively against COVID-19 outcomes across 12 nations (Pearson r = +0.787, Spearman ρ = +0.860). Independently incorporated into an EPA World Congress presentation, March 2026.' },
  'peacs-avg-base':      { label: 'BASE — Behavioral Foundation',    text: 'Measures how consistently a patient follows their medication regimen under normal day-to-day conditions. Think of it as the adherence floor — what they do when nothing is disrupting their life. Assessed over a 30-day recall window.' },
  'peacs-avg-mvmt':      { label: 'MVMT — Behavioral Flexibility',   text: 'Measures whether a patient maintains adherence when life changes — travel, illness, shift work, disrupted routines. A patient with high BASE but low MVMT will fall apart when circumstances change. Assessed over a 7-day recall window.' },
  'peacs-avg-strata':    { label: 'STRATA — Social Determinants',    text: 'Captures the social and structural factors that enable or undermine adherence: living situation, transport access to pharmacy and clinic, support networks, health literacy, and beliefs about treatment necessity. Low STRATA predicts who needs the most intensive support. Assessed over a 90-day recall window.' },
  'mc-peacs-avg-base':   { label: 'BASE — Behavioral Foundation',    text: 'Foundational medication-taking behavior under normal conditions. Assessed over 30 days.' },
  'mc-peacs-avg-mvmt':   { label: 'MVMT — Behavioral Flexibility',   text: 'Adherence resilience across disruptions — travel, illness, schedule changes. Assessed over 7 days.' },
  'mc-peacs-avg-strata': { label: 'STRATA — Social Determinants',    text: 'Social and structural barriers and enablers: housing, transport, support, health literacy, treatment beliefs. Assessed over 90 days.' },
  'peacs-n-optimal':     { label: 'Optimal Zone — PE ≥ 0.85',        text: 'Highest predicted behavioral stability. These patients are likely to sustain adherence over time without intensive intervention. The clinical target.' },
  'peacs-n-good':        { label: 'Good Zone — PE 0.70–0.84',        text: 'Generally stable adherence predicted. Light monitoring and occasional support can maintain or improve stability.' },
  'peacs-n-mod':         { label: 'Moderate Zone — PE 0.55–0.69',    text: 'Behavioral instability risk present. Structured programs work well here. Often one specific weak dimension — BASE, MVMT, or STRATA — can be targeted directly.' },
  'peacs-n-poor':        { label: 'Poor Zone — PE < 0.55',           text: 'High risk of sustained non-adherence. Priority for clinical intervention. This group almost always carries multiple STRATA risk factors — social isolation, transport barriers, or low health literacy.' },
  'peacs-optimal-pct':   { label: 'Optimal Zone %',                  text: 'Percentage in the highest stability tier — a key performance indicator for population health programs using ATLAS.' },

  // ── MAP card — Track A ────────────────────────────────────────────────────
  'mc-map-total':        { label: 'MAP Assessments',                 text: 'Total Multidimensional Adherence Parameter (MAP) assessments in the cohort. MAP is an original adherence instrument developed by Philip Morisky — built on three behavioral domains that map directly to the Theory of Predictive Emergence.' },
  'mc-map-countries':    { label: 'Countries',                       text: 'Number of distinct countries contributing MAP data. Geographic diversity strengthens cross-cultural validation of the MAP\'s three behavioral domains across populations and care settings.' },
  'mc-map-avg':          { label: 'Average MAP Score',               text: 'Mean MAP composite score (0–8 scale). A score of 8 indicates full adherence across all eight behavioral parameters. Unlike a simple average, MAP decomposes this score into three clinically distinct behavioral domains: Architecture, Execution, and Context.' },
  'mc-map-arch':         { label: 'Architecture Domain',             text: 'Average Architecture (Arch) score — the MAP domain measuring the structural and habitual foundation of medication-taking behavior. Captures routine stability, memory architecture, and schedule integration. Questions 2, 3, and 6 load to this domain. High Architecture signals durable, self-sustaining adherence habits that persist even without active effort.' },
  'mc-map-exec':         { label: 'Execution Domain',                text: 'Average Execution (Exec) score — measures real-time adherence performance in the recent assessment window. Questions 1, 4, 5, and 8 load to this domain. High Architecture + low Execution means the patient is behaviorally structured but currently failing — often due to acute disruption, illness, or situational stress.' },
  'mc-map-ctx':          { label: 'Context Domain',                  text: 'Average Context (Ctx) score — captures how environmental and situational factors shape adherence behavior. Question 7 loads to this domain. Low Context scores indicate that external circumstances — schedule shifts, travel, competing demands — are the primary driver of non-adherence rather than forgetting or motivation.' },
  'mc-map-pe-avg':       { label: 'Predictive Emergence (PE)',       text: 'PE = (Architecture × Execution × Context)^(1/3) — the MAP\'s geometric adherence index. Unlike a linear average, PE is multiplicatively sensitive: a collapse in any single domain pulls the overall score toward zero, surfacing hidden fragility that composite scoring misses. Aligned with the Theory of Predictive Emergence (Dr. Donald Morisky, 2026).' },
  'mc-map-ina-count':    { label: 'INA — Intentional Non-Adherence', text: 'MAP patients choosing not to take their medication despite knowing they should — driven by side effects, perceived lack of necessity, or cost. The MAP Architecture and Execution domains localize whether the resistance is habitual or situational. Reminders are ineffective here; motivational dialogue and shared decision-making are required.' },
  'mc-map-una-count':    { label: 'UNA — Unintentional Non-Adherence', text: 'MAP patients intending to take their medication but failing due to forgetting, running out, or access barriers. The most common and most correctable adherence pattern. MAP Architecture scores pinpoint whether the issue is a missing routine or a disrupted one — enabling a precise, targeted intervention rather than a generic reminder.' },
  'mc-map-mixed-count':  { label: 'Mixed Adherence Pattern',         text: 'MAP patients displaying both intentional and unintentional non-adherence simultaneously. Common in polypharmacy patients and those under compound life stressors. Requires addressing both behavioral scaffolding (Architecture) and motivational barriers (Execution) with an individualized clinical plan.' },
  'mc-map-high-count':   { label: 'High Adherence',                  text: 'MAP patients scoring 8/8 — fully adherent across all behavioral parameters. Studying the Architecture, Execution, and Context profiles of this group reveals the protective factors and behavioral structures that can inform peer mentorship programs and population-level intervention design.' },

  // ── Session launcher ──────────────────────────────────────────────────────
  'start-session-btn':   { label: 'Patient Session Workflow',        text: 'Opens the clinical session workflow: collect patient ID, SDoH context, and informed consent, then route to the appropriate assessment instrument — MAP, MMAS-8, or PEACS. All data collected within a session links to the same patient number, enabling multi-visit trajectory tracking and cross-instrument comparison.' },
};

// ── Tooltip engine — attaches to all stat cells across MMAS and PEACS ─────
function attachExplorerStatTooltips() {
  const stale = document.getElementById('atlas-stat-tip');
  if (stale) stale.remove();

  const tip = document.createElement('div');
  tip.id = 'atlas-stat-tip';
  tip.style.cssText = [
    'position:fixed;z-index:99990;pointer-events:none',
    'max-width:280px;opacity:0;transition:opacity 0.18s ease',
    'background:rgba(6,12,28,0.97)',
    'border:1px solid rgba(212,168,67,0.25)',
    'border-top:2px solid rgba(212,168,67,0.65)',
    'border-radius:10px',
    'padding:13px 15px',
    'box-shadow:0 8px 28px rgba(0,0,0,0.55)',
  ].join(';');
  document.body.appendChild(tip);

  function show(key, e) {
    const def = EXPLORER_STAT_TIPS[key];
    if (!def) return;
    tip.innerHTML =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(212,168,67,0.75);margin-bottom:6px;">' + def.label + '</div>' +
      '<div style="font-size:0.80rem;color:rgba(200,216,234,0.82);line-height:1.65;">' + def.text + '</div>';
    tip.style.opacity = '1';
    move(e);
  }
  function move(e) {
    const x = e.clientX + 14, y = e.clientY - 10;
    tip.style.left = Math.min(x, window.innerWidth - 300) + 'px';
    tip.style.top  = Math.max(8, Math.min(y, window.innerHeight - 160)) + 'px';
  }
  function hide() { tip.style.opacity = '0'; }

  Object.keys(EXPLORER_STAT_TIPS).forEach(function(key) {
    const el = document.getElementById(key);
    if (!el) return;
    // Covers all stat cell wrapper patterns used across ATLAS dashboard
    const cell = el.closest(
      '.stat-cell,.mc-stat-cell,.mc-mini-stat,.panel-stat-cell,' +
      '.pulse-cell,[class*="stat-cell"],[class*="mini-stat"]'
    ) || el.parentElement;
    if (!cell) return;
    cell.style.cursor = 'help';
    const origBg = cell.style.background || '';
    cell.addEventListener('mouseenter', function(e) {
      cell.style.background = 'rgba(212,168,67,0.05)';
      show(key, e);
    });
    cell.addEventListener('mousemove',  function(e) { move(e); });
    cell.addEventListener('mouseleave', function() {
      cell.style.background = origBg;
      hide();
    });
  });
}

// ── Session start guard — freemium cap + study declaration ────────────────
// Replaces the direct openSessionModal() call on the start-session button.
// For non-Explorer users this is a transparent pass-through.
function openSessionGuarded() {
  if (window._wsMode === 'explorer' && window._freemiumKey) {
    checkFreemiumCap().then(function(ok) { if (ok) openSessionModal(); });
  } else {
    openSessionModal();
  }
}

// ── Main entry point ──────────────────────────────────────────────────────
function initExplorerExperience() {
  lockExplorerExports();
  setTimeout(injectExplorerBanner, 100);
  setTimeout(attachExplorerStatTooltips, 500);
  // Refresh the assessment counter once data has loaded
  setTimeout(refreshFreemiumCounter, 1200);
}

// ── Freemium counter — reads live cohort size and updates the banner ──────
function refreshFreemiumCounter() {
  const ws = (currentWorkspace || '').toUpperCase();
  if (!ws || !ws.startsWith('EXPL-')) return;
  const counterEl = document.getElementById('freemium-counter');
  if (!counterEl) return;
  database.ref('assessments').orderByChild('institution_code').equalTo(ws).once('value', snap => {
    const n = snap.numChildren ? snap.numChildren() : (snap.val() ? Object.keys(snap.val()).length : 0);
    counterEl.textContent = n + ' of 50 free assessments used';
    // Warn at 40+
    if (n >= 40) counterEl.style.color = n >= 50 ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)';
    window._freemiumCount = n;
  });
}

// ── 50-cap gate — call before opening a new patient session ───────────────
// Returns a Promise<boolean>: true = proceed, false = blocked (cap reached)
function checkFreemiumCap() {
  if (window._wsMode !== 'explorer' || !window._freemiumKey) return Promise.resolve(true);
  const ws = window._freemiumKey.toUpperCase();
  return database.ref('assessments').orderByChild('institution_code').equalTo(ws).once('value')
    .then(snap => {
      const n = snap.numChildren ? snap.numChildren() : (snap.val() ? Object.keys(snap.val()).length : 0);
      window._freemiumCount = n;
      if (n >= 50) {
        _showFreemiumCapModal(n);
        return false;
      }
      // Study declaration at 10 assessments (fires once per session)
      if (n >= 10 && !window._studyDeclared && !sessionStorage.getItem('atlas_study_declared')) {
        return _showStudyDeclarationModal().then(declared => declared);
      }
      return true;
    });
}

// ── Study declaration modal — fires at 10th assessment ───────────────────
function _showStudyDeclarationModal() {
  return new Promise(resolve => {
    const existing = document.getElementById('explorer-study-decl-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'explorer-study-decl-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,18,0.80);backdrop-filter:blur(4px);padding:24px;';
    modal.innerHTML = `
      <div style="background:#0d1829;border:1px solid rgba(78,156,245,0.25);border-top:2px solid rgba(78,156,245,0.65);border-radius:16px;padding:36px 40px 28px;max-width:540px;width:100%;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(78,156,245,0.7);margin-bottom:16px;">Explorer · Study Registration</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.6rem;font-weight:300;color:#fff;margin-bottom:10px;line-height:1.2;">Register your study before continuing</div>
        <div style="font-size:0.84rem;color:rgba(200,216,234,0.75);line-height:1.7;margin-bottom:24px;">You have collected 10 or more assessments. Before the next session, please declare your study so that a Letter of Permission can be auto-issued for eligible research. You will not be asked again.</div>
        <div style="display:grid;gap:12px;margin-bottom:20px;">
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(200,216,234,0.55);display:block;margin-bottom:4px;">Study Title *</label>
            <input id="sdecl-title" type="text" placeholder="e.g. MMAS-8 Adherence in Hypertension Patients" style="width:100%;box-sizing:border-box;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:#fff;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(200,216,234,0.55);display:block;margin-bottom:4px;">Target Sample Size (n) *</label>
              <input id="sdecl-n" type="number" min="1" placeholder="e.g. 40" style="width:100%;box-sizing:border-box;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:#fff;">
            </div>
            <div>
              <label style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(200,216,234,0.55);display:block;margin-bottom:4px;">Condition / Drug Class</label>
              <input id="sdecl-condition" type="text" placeholder="e.g. Hypertension" style="width:100%;box-sizing:border-box;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:#fff;">
            </div>
          </div>
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(200,216,234,0.55);display:block;margin-bottom:4px;">Supervised by a faculty PI?</label>
            <select id="sdecl-pi" style="width:100%;box-sizing:border-box;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:#fff;">
              <option value="no">No — independent student study</option>
              <option value="yes">Yes — faculty PI is responsible for this cohort</option>
            </select>
          </div>
        </div>
        <div id="sdecl-msg" style="font-size:0.80rem;color:rgba(239,68,68,0.85);margin-bottom:14px;display:none;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="sdecl-submit" onclick="_submitStudyDeclaration()" style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(78,156,245,0.12);border:1px solid rgba(78,156,245,0.4);color:rgba(78,156,245,0.95);border-radius:8px;padding:10px 20px;cursor:pointer;">Declare Study →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Expose resolve so _submitStudyDeclaration can call it
    modal._resolve = resolve;
  });
}

function _submitStudyDeclaration() {
  const modal = document.getElementById('explorer-study-decl-modal');
  if (!modal) return;
  const title     = (document.getElementById('sdecl-title')?.value || '').trim();
  const nVal      = parseInt(document.getElementById('sdecl-n')?.value || '0', 10);
  const condition = (document.getElementById('sdecl-condition')?.value || '').trim();
  const piSupervised = document.getElementById('sdecl-pi')?.value === 'yes';
  const msgEl     = document.getElementById('sdecl-msg');

  if (!title) { msgEl.textContent = 'Study title is required.'; msgEl.style.display=''; return; }
  if (!nVal || nVal < 1) { msgEl.textContent = 'Target sample size is required.'; msgEl.style.display=''; return; }

  if (nVal > 50) {
    // Exceeds free tier — block and prompt upgrade
    msgEl.innerHTML = 'Studies exceeding 50 participants require a paid workspace key. <a href="https://keys.adherence.cc" target="_blank" style="color:rgba(46,201,138,0.85);">Student keys start at $19/month →</a>';
    msgEl.style.display = '';
    return;
  }

  // Store declaration
  const declaration = { title, n: nVal, condition, piSupervised, workspace: window._freemiumKey, declared: new Date().toISOString() };
  sessionStorage.setItem('atlas_study_declared', JSON.stringify(declaration));
  window._studyDeclared = declaration;

  if (typeof modal._resolve === 'function') modal._resolve(true);
  modal.remove();

  // Auto-issue LOP
  setTimeout(() => _issueExplorerLOP(declaration), 300);
}

// ── Auto-LOP for eligible freemium studies ────────────────────────────────
function _issueExplorerLOP(decl) {
  const today   = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const isoNow  = new Date().toISOString();
  const ws      = decl.workspace || window._freemiumKey || 'EXPL-UNKNOWN';
  // Stable reference ID: workspace + unix timestamp in base36
  const lopRef  = ws + '-' + Date.now().toString(36).toUpperCase();
  const piLine  = decl.piSupervised
    ? `The supervising faculty PI is responsible for ensuring any combined analyses across multiple workspaces comply with MMAS instrument licensing terms.`
    : `This authorization is issued directly to the student researcher.`;

  const content = [
    `ATLAS EXPLORER — LETTER OF PERMISSION`,
    `Reference:       ${lopRef}`,
    `Issued:          ${today}`,
    ``,
    `This Letter of Permission authorizes the use of the MMAS-8 (Morisky Medication Adherence Scale, 8-item version) and the MAP (Multidimensional Adherence Parameters) instrument for the following study:`,
    ``,
    `  Study Title:     ${decl.title}`,
    `  Workspace ID:    ${ws}`,
    `  Condition/Drug:  ${decl.condition || 'Not specified'}`,
    `  Declared n:      ≤ ${decl.n} participants`,
    `  Issued:          ${today}`,
    ``,
    `Authenticity of this document can be verified at: adherence.cc/verify?ref=${lopRef}`,
    ``,
    `CONDITIONS OF THIS AUTHORIZATION:`,
    ``,
    `1. This authorization covers a single-site feasibility study not to exceed ${decl.n} participants enrolled under workspace ${ws}.`,
    ``,
    `2. This document does not authorize data aggregation across multiple Explorer workspaces. Each workspace requires its own authorization.`,
    ``,
    `3. Any expansion of the declared sample size beyond ${decl.n} participants requires a new authorization issued by the MMAS Licensing Office.`,
    ``,
    `4. ${piLine}`,
    ``,
    `5. Commercial use, clinical deployment, or publication in peer-reviewed journals requires a paid workspace license. See keys.adherence.cc for details.`,
    ``,
    `This authorization is automatically issued by the ATLAS platform on behalf of the MMAS Licensing Office for exploratory research not exceeding 50 participants.`,
    ``,
    `— ATLAS Platform · adherence.cc · MMAS Licensing Office`,
  ].join('\n');

  // ── Write to Firebase for real-time lookup and revocation capability ──────
  // Path: explorer_lops/<lopRef>
  // Readable by anyone with the ref (for verify page), writable only once.
  if (typeof database !== 'undefined') {
    database.ref('explorer_lops/' + lopRef).set({
      ref:          lopRef,
      workspace:    ws,
      title:        decl.title,
      condition:    decl.condition || '',
      declared_n:   decl.n,
      pi_supervised: decl.piSupervised || false,
      issued_iso:   isoNow,
      issued_date:  today,
      status:       'active',   // 'active' | 'revoked'
    }).catch(e => console.warn('[ATLAS] LOP write failed (non-fatal):', e));
  }

  // ── Download as .txt ──────────────────────────────────────────────────────
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ATLAS-LOP-${lopRef}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof showToast === 'function') showToast('Letter of Permission issued — reference ' + lopRef, 5000);
}

// ── Cap modal — shown when freemium user hits 50 ──────────────────────────
function _showFreemiumCapModal(n) {
  const existing = document.getElementById('freemium-cap-modal');
  if (existing) { existing.style.display = 'flex'; return; }
  const modal = document.createElement('div');
  modal.id = 'freemium-cap-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,18,0.80);backdrop-filter:blur(4px);padding:24px;';
  modal.innerHTML = `
    <div style="background:#0d1829;border:1px solid rgba(239,68,68,0.25);border-top:2px solid rgba(239,68,68,0.65);border-radius:16px;padding:36px 40px 28px;max-width:500px;width:100%;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(239,68,68,0.7);margin-bottom:16px;">Explorer · Assessment Limit Reached</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.6rem;font-weight:300;color:#fff;margin-bottom:10px;">50 free assessments used</div>
      <div style="font-size:0.84rem;color:rgba(200,216,234,0.75);line-height:1.7;margin-bottom:24px;">Your free-tier workspace has reached the 50-assessment limit. To continue collecting data, upgrade to a paid workspace key. Your existing data is preserved — upgrading links it to your new key.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="https://keys.adherence.cc" target="_blank" style="flex:1;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(46,201,138,0.1);border:1px solid rgba(46,201,138,0.4);color:#2ec98a;border-radius:8px;padding:10px 20px;cursor:pointer;text-decoration:none;">Upgrade →</a>
        <button onclick="document.getElementById('freemium-cap-modal').style.display='none'" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:8px;padding:10px 20px;cursor:pointer;">View Data</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── CTO2: Sandbox Admin Preview ───────────────────────────────────────────
let _explorerAdminPreviewShown = false;

function _explorerMaybeShowAdminPreview(elapsedMs) {
  if (_explorerAdminPreviewShown) return;
  if (elapsedMs >= 5 * 60 * 1000) {
    _explorerAdminPreviewShown = true;
    const bar = document.getElementById('explorer-admin-preview-bar');
    if (bar) { bar.style.display = 'flex'; bar.classList.add('slide-in'); }
  }
}

function explorerOpenAdminPreview() {
  const overlay = document.getElementById('admin-preview-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    _adminPreviewLoadDemo();
  }
}

function explorerCloseAdminPreview() {
  const overlay = document.getElementById('admin-preview-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Demo data for sandbox admin preview
const _ADMIN_PREVIEW_DEMO = {
  workspaces: [
    { key: 'PI-JHOP-2841-2026', role: 'pi', institution: 'Johns Hopkins', pi: 'Dr. Sarah Chen', seats: 3, records: 142, avg_score: 5.8 },
    { key: 'PI-UCLA-3301-2026', role: 'pi', institution: 'UCLA Health', pi: 'Dr. Marcus Webb', seats: 2, records: 89, avg_score: 6.1 },
    { key: 'CLIN-MAYO-0091-2026', role: 'clinician', institution: 'Mayo Clinic', pi: 'PharmD J. Torres', seats: 1, records: 201, avg_score: 5.4 },
    { key: 'STU-HARV-7712-2026', role: 'student', institution: 'Harvard SPH', pi: 'Dr. A. Okafor', seats: 1, records: 34, avg_score: 4.9 }
  ],
  modules: ['MAP','MMAS-8','PEACS','Bulk Upload','Blinded Export','MTM Billing','Sentinel','ZOE SOAP'],
  stats: { total_ws: 4, total_records: 466, countries: 8, avg: 5.55 }
};

function _adminPreviewLoadDemo() {
  const content = document.getElementById('admin-preview-content');
  if (!content) return;
  const demo = _ADMIN_PREVIEW_DEMO;
  content.innerHTML = `
    <div class="ap-demo-badge">Read-Only Preview — Demo Data</div>
    <div class="ap-demo-kpis">
      <div class="ap-demo-kpi"><span class="ap-demo-kpi-n">${demo.stats.total_ws}</span><span class="ap-demo-kpi-l">Workspaces</span></div>
      <div class="ap-demo-kpi"><span class="ap-demo-kpi-n">${demo.stats.total_records}</span><span class="ap-demo-kpi-l">Total Records</span></div>
      <div class="ap-demo-kpi"><span class="ap-demo-kpi-n">${demo.stats.countries}</span><span class="ap-demo-kpi-l">Countries</span></div>
      <div class="ap-demo-kpi"><span class="ap-demo-kpi-n">${demo.stats.avg}</span><span class="ap-demo-kpi-l">Avg Score</span></div>
    </div>
    <div class="ap-demo-section-title">Workspace Keys — Team Management</div>
    <div class="ap-demo-ws-list">
      ${demo.workspaces.map(ws => `
        <div class="ap-demo-ws-row">
          <div class="ap-demo-ws-key">${ws.key}</div>
          <div class="ap-demo-ws-meta">
            <span class="ap-demo-ws-role ap-demo-role-${ws.role}">${ws.role.toUpperCase()}</span>
            <span class="ap-demo-ws-inst">${ws.institution}</span>
            <span class="ap-demo-ws-pi">${ws.pi}</span>
          </div>
          <div class="ap-demo-ws-stats">
            <span>${ws.records} records</span>
            <span>Avg: ${ws.avg_score}</span>
            <span>${ws.seats} seat${ws.seats > 1 ? 's' : ''}</span>
          </div>
          <div class="ap-demo-ws-actions">
            <button class="ap-demo-btn-disabled" disabled>Edit</button>
            <button class="ap-demo-btn-disabled" disabled>Revoke</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="ap-demo-section-title">Module Grants — Feature Control</div>
    <div class="ap-demo-modules">
      ${demo.modules.map(m => `<div class="ap-demo-mod-chip ap-demo-mod-on"><span class="ap-demo-mod-dot"></span>${m}</div>`).join('')}
      <div class="ap-demo-mod-chip ap-demo-mod-off"><span class="ap-demo-mod-dot"></span>API Access <span class="ap-demo-mod-locked">PI+ only</span></div>
    </div>
    <div class="ap-demo-section-title">User Provisioning</div>
    <div class="ap-demo-prov-note">Add team members, assign roles (PI / Researcher / Clinician / Student / Observer), and manage seat allocations. All buttons are disabled in preview mode.</div>
    <div class="ap-demo-prov-form">
      <input class="ap-demo-input" placeholder="team@institution.edu" disabled>
      <select class="ap-demo-input" disabled><option>Select role...</option><option>PI</option><option>Researcher</option><option>Clinician</option><option>Student</option></select>
      <button class="ap-demo-btn-disabled" disabled>Add Member</button>
    </div>
    <div class="ap-demo-cta">
      <p>Ready to manage your own institution?</p>
      <a href="https://keys.adherence.cc" target="_blank" class="ap-demo-cta-btn">View Institutional Plans →</a>
    </div>
  `;
}
window.explorerOpenAdminPreview = explorerOpenAdminPreview;
window.explorerCloseAdminPreview = explorerCloseAdminPreview;
window._explorerMaybeShowAdminPreview = _explorerMaybeShowAdminPreview;
