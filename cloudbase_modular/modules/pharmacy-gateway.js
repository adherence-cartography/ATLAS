// ══════════════════════════════════════════════
// ATLAS PHARMACY GATEWAY MODULE
// pharmacy-gateway.js  v1.0.0  2026-06-14
// Scala Carta Foundation / TESSERA GRC
//
// Provides:
//   loadPharmacyStats(workspaceKey, containerId)
//   renderPharmacyNetworkStats(containerId)
//   generatePharmacyReport(workspaceKey)
//
// Depends on: firebase (compat 9.23.0), database
// No external charting libraries -- SVG only
// ══════════════════════════════════════════════

'use strict';

// ── Design tokens (mirrored from pharmacy.html) ──────────────────────────────
const PG_COLORS = {
  optimal:  '#10b981',
  good:     '#3b82f6',
  moderate: '#f59e0b',
  poor:     '#ef4444',
  arch:     '#f59e0b',
  exec:     '#06b6d4',
  ctx:      '#a78bfa',
  pe:       '#d4a843',
  muted:    '#6b8099',
  bright:   '#e8f0f8',
  card:     '#111d30',
  border:   'rgba(255,255,255,0.07)'
};

const PG_FONT_MONO  = "'IBM Plex Mono', monospace";
const PG_FONT_BODY  = "'IBM Plex Sans', system-ui, sans-serif";
const PG_FONT_DISP  = "'Cormorant Garamond', Georgia, serif";

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Returns a colour token string for a traffic-light level.
 * @param {'green'|'amber'|'red'} tl
 * @returns {string} CSS colour
 */
function _tlColor(tl) {
  return { green: PG_COLORS.optimal, amber: PG_COLORS.moderate, red: PG_COLORS.poor }[tl] || PG_COLORS.muted;
}

/**
 * Formats a number as a percentage string.
 * @param {number} v  Value in 0-1 range
 * @param {number} [dp=0] Decimal places
 * @returns {string}
 */
function _pct(v, dp = 0) {
  return (v * 100).toFixed(dp) + '%';
}

/**
 * Builds an inline-style string for a horizontal bar.
 * @param {number} fillRatio  0-1
 * @param {string} color      CSS colour
 * @returns {string} HTML string
 */
function _bar(fillRatio, color) {
  const w = Math.max(0, Math.min(1, fillRatio || 0));
  return `
    <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
      <div style="height:100%;width:${(w*100).toFixed(1)}%;background:${color};border-radius:4px;
        transition:width 1s cubic-bezier(0.22,1,0.36,1);"></div>
    </div>`;
}

/**
 * Escapes a string for safe insertion into HTML text nodes.
 * @param {string} s
 * @returns {string}
 */
function _esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/**
 * Returns human-readable month label for the current month.
 * @returns {string}  e.g. "June 2026"
 */
function _currentMonthLabel() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Checks whether a record timestamp falls within the current calendar month.
 * @param {number} ts  Unix timestamp (ms)
 * @returns {boolean}
 */
function _isThisMonth(ts) {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ── SVG Donut chart ──────────────────────────────────────────────────────────

/**
 * Generates an SVG donut chart from a data series.
 * No external libraries required.
 *
 * @param {Array<{label:string, value:number, color:string}>} segments
 * @param {number} [size=160]  SVG width/height in px
 * @param {number} [stroke=28] Ring thickness
 * @returns {string} SVG HTML string
 */
function _donutSVG(segments, size = 160, stroke = 28) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  if (total === 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
    </svg>`;
  }

  let offset = -0.25 * circ; // start at top
  const paths = segments.map(seg => {
    if (!seg.value) return '';
    const frac = seg.value / total;
    const dash = frac * circ;
    const gap  = circ - dash;
    const path = `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none"
      stroke="${seg.color}"
      stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      stroke-linecap="butt"
      style="transition:stroke-dasharray 1s ease;"
    />`;
    offset += dash;
    return path;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(0deg);">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${stroke}"/>
    ${paths}
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════════════
// loadPharmacyStats
// ═══════════════════════════════════════════════════════════════════════

/**
 * Loads pharmacy assessment data from Firebase and renders a pharmacist-facing
 * dashboard into the specified container element.
 *
 * Shows:
 *   - Total assessments this month
 *   - Green / Amber / Red distribution (donut + counts)
 *   - Domain mean bars (Architecture / Execution / Context-Guard)
 *   - Dominant failure domain
 *   - Condition breakdown by risk
 *
 * @param {string} workspaceKey   Pharmacy workspace identifier (case-insensitive)
 * @param {string} containerId    DOM element ID to render into
 * @returns {void}
 */
function loadPharmacyStats(workspaceKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[PG] loadPharmacyStats: container not found:', containerId);
    return;
  }

  container.innerHTML = _loadingHTML('Loading pharmacy statistics...');

  const ref = (typeof database !== 'undefined' ? database : firebase.database())
    .ref('pharmacy_assessments');

  ref.once('value', snap => {
    const raw = snap.val();
    if (!raw) {
      container.innerHTML = _emptyHTML('No assessments recorded yet for this pharmacy.');
      return;
    }

    const all = Object.values(raw);
    const wk = (workspaceKey || '').toUpperCase();
    // Filter: match pharmacy_name or workspace_key; superadmin sees all
    const records = wk === 'SUPERADMIN'
      ? all
      : all.filter(r => {
          const rk = (r.workspace_key || '').toUpperCase();
          const rn = (r.pharmacy_name || '').toUpperCase();
          return rk === wk || rn === wk;
        });

    const monthRecords = records.filter(r => _isThisMonth(r.ts));

    // Risk distribution
    const dist = { green: 0, amber: 0, red: 0 };
    monthRecords.forEach(r => { if (dist[r.traffic_light] !== undefined) dist[r.traffic_light]++; });
    const total = monthRecords.length;

    // Domain means
    const means = { A: 0, E: 0, Cg: 0 };
    if (total > 0) {
      monthRecords.forEach(r => {
        means.A  += (r.arch_score || 0);
        means.E  += (r.exec_score || 0);
        means.Cg += (r.ctx_score  || 0);
      });
      means.A  /= total;
      means.E  /= total;
      means.Cg /= total;
    }

    // Dominant failure domain
    const failCounts = { Architecture: 0, Execution: 0, 'Context-Guard': 0 };
    monthRecords.filter(r => r.traffic_light === 'red' || r.traffic_light === 'amber').forEach(r => {
      const low = [
        { d: 'Architecture',   v: r.arch_score || 0 },
        { d: 'Execution',      v: r.exec_score || 0 },
        { d: 'Context-Guard',  v: r.ctx_score  || 0 }
      ].sort((a, b) => a.v - b.v)[0].d;
      failCounts[low]++;
    });
    const dominantFailure = Object.entries(failCounts).sort((a,b)=>b[1]-a[1])[0][0];

    // Condition breakdown
    const condRisk = {};
    monthRecords.forEach(r => {
      const c = r.condition || 'Unknown';
      if (!condRisk[c]) condRisk[c] = { total: 0, red: 0, amber: 0, green: 0 };
      condRisk[c].total++;
      if (condRisk[c][r.traffic_light] !== undefined) condRisk[c][r.traffic_light]++;
    });

    container.innerHTML = _buildStatsHTML({
      total, monthLabel: _currentMonthLabel(),
      dist, means, dominantFailure, condRisk, workspaceKey
    });

    // Animate bars after paint
    requestAnimationFrame(() => {
      container.querySelectorAll('[data-fill-w]').forEach(el => {
        el.style.width = el.dataset.fillW;
      });
    });

  }).catch(err => {
    container.innerHTML = _errorHTML('Could not load pharmacy data: ' + err.message);
  });
}

function _buildStatsHTML({ total, monthLabel, dist, means, dominantFailure, condRisk, workspaceKey }) {
  const donut = _donutSVG([
    { label: 'Low Risk',  value: dist.green, color: PG_COLORS.optimal  },
    { label: 'Monitor',   value: dist.amber, color: PG_COLORS.moderate },
    { label: 'High Risk', value: dist.red,   color: PG_COLORS.poor    }
  ], 156, 30);

  const condRows = Object.entries(condRisk).map(([cond, stats]) => {
    const highRiskPct = stats.total > 0 ? (stats.red / stats.total) : 0;
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="min-width:130px;font-size:0.97rem;color:${PG_COLORS.bright};">${_esc(cond)}</div>
        <div style="flex:1;">${_bar(highRiskPct, PG_COLORS.poor)}</div>
        <div style="font-family:${PG_FONT_MONO};font-size:0.82rem;color:${PG_COLORS.poor};min-width:40px;text-align:right;">${_pct(highRiskPct)}</div>
        <div style="font-family:${PG_FONT_MONO};font-size:0.78rem;color:${PG_COLORS.muted};min-width:52px;text-align:right;">${stats.total} pts</div>
      </div>`;
  }).join('');

  return `
  <div style="font-family:${PG_FONT_BODY};color:${PG_COLORS.bright};">

    <!-- Header row -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:16px;">
      <div>
        <div style="font-family:${PG_FONT_MONO};font-size:0.72rem;letter-spacing:0.24em;text-transform:uppercase;color:${PG_COLORS.muted};margin-bottom:6px;">
          Pharmacy Dashboard &middot; ${_esc(monthLabel)}
        </div>
        <div style="font-family:${PG_FONT_DISP};font-size:2rem;font-weight:300;color:#fff;">
          ${total} Assessment${total !== 1 ? 's' : ''} This Month
        </div>
      </div>
      <div style="font-family:${PG_FONT_MONO};font-size:0.75rem;letter-spacing:0.16em;color:${PG_COLORS.muted};text-transform:uppercase;padding-top:6px;">
        ${_esc(workspaceKey || 'PHARMACY')}
      </div>
    </div>

    <!-- Risk distribution row -->
    <div style="display:flex;gap:20px;margin-bottom:28px;flex-wrap:wrap;">

      <!-- Donut -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;
        background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};border-radius:14px;
        padding:24px 28px;flex-shrink:0;">
        ${donut}
        <div style="font-family:${PG_FONT_MONO};font-size:0.73rem;letter-spacing:0.18em;text-transform:uppercase;color:${PG_COLORS.muted};">
          Risk Distribution
        </div>
      </div>

      <!-- Counts -->
      <div style="flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center;">
        ${[
          { label: 'Low Risk (Green)',   count: dist.green, color: PG_COLORS.optimal  },
          { label: 'Monitor (Amber)',    count: dist.amber, color: PG_COLORS.moderate },
          { label: 'High Risk (Red)',    count: dist.red,   color: PG_COLORS.poor    }
        ].map(row => `
          <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};
            border-radius:10px;padding:14px 18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${row.color};display:inline-block;"></span>
                <span style="font-size:0.93rem;color:${PG_COLORS.muted};">${row.label}</span>
              </div>
              <div style="font-family:${PG_FONT_MONO};font-size:1.3rem;font-weight:500;color:${row.color};">${row.count}</div>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
              <div data-fill-w="${total > 0 ? _pct(row.count/total) : '0%'}"
                style="height:100%;width:0%;background:${row.color};border-radius:3px;transition:width 1s ease;"></div>
            </div>
            <div style="font-family:${PG_FONT_MONO};font-size:0.76rem;color:${PG_COLORS.muted};margin-top:5px;">
              ${total > 0 ? _pct(row.count/total) : '0%'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Domain means -->
    <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};border-radius:14px;padding:22px 24px;margin-bottom:20px;">
      <div style="font-family:${PG_FONT_MONO};font-size:0.73rem;letter-spacing:0.22em;text-transform:uppercase;
        color:${PG_COLORS.muted};margin-bottom:18px;">Domain Mean Scores</div>
      ${[
        { label: 'Architecture',  val: means.A,  color: PG_COLORS.arch },
        { label: 'Execution',     val: means.E,  color: PG_COLORS.exec },
        { label: 'Context-Guard', val: means.Cg, color: PG_COLORS.ctx  }
      ].map(d => `
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:0.95rem;">
              <span style="width:7px;height:7px;border-radius:50%;background:${d.color};display:inline-block;"></span>
              ${d.label}
            </div>
            <div style="font-family:${PG_FONT_MONO};font-size:0.85rem;color:${d.color};font-weight:500;">
              ${(d.val).toFixed(2)}
            </div>
          </div>
          <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
            <div data-fill-w="${_pct(d.val)}"
              style="height:100%;width:0%;background:${d.color};border-radius:4px;transition:width 1s ease;"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Dominant failure -->
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);
      border-radius:12px;padding:18px 22px;margin-bottom:20px;
      display:flex;align-items:center;gap:14px;">
      <div style="font-size:1.5rem;">&#9888;</div>
      <div>
        <div style="font-family:${PG_FONT_MONO};font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;
          color:${PG_COLORS.muted};margin-bottom:4px;">Dominant Failure Domain This Month</div>
        <div style="font-size:1.1rem;color:${PG_COLORS.poor};font-weight:500;">${_esc(dominantFailure)}</div>
      </div>
    </div>

    <!-- Condition breakdown -->
    ${condRows ? `
    <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};border-radius:14px;padding:22px 24px;">
      <div style="font-family:${PG_FONT_MONO};font-size:0.73rem;letter-spacing:0.22em;text-transform:uppercase;
        color:${PG_COLORS.muted};margin-bottom:14px;">Condition Breakdown (High Risk %)</div>
      ${condRows}
    </div>` : ''}

  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// renderPharmacyNetworkStats
// ═══════════════════════════════════════════════════════════════════════

/**
 * Renders an aggregate FOFI network view (de-identified, all pharmacies)
 * into the specified container. Shows:
 *   - Italy SVG map placeholder with pharmacy dots
 *   - Network-wide risk distribution
 *   - Per-pharmacy "your pharmacy vs network" comparison bars
 *
 * @param {string} containerId  DOM element ID to render into
 * @returns {void}
 */
function renderPharmacyNetworkStats(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[PG] renderPharmacyNetworkStats: container not found:', containerId);
    return;
  }

  // ── Pharmacy tablet app launch card ──────────────────────────────────────
  const _pgLaunch = document.createElement('div');
  _pgLaunch.style.cssText = 'background:rgba(46,201,138,0.06);border:1px solid rgba(46,201,138,0.28);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;';
  _pgLaunch.innerHTML =
    '<div style="flex:1;min-width:220px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.20em;text-transform:uppercase;color:#2ec98a;margin-bottom:4px;">Pharmacy Tablet App</div>' +
      '<div style="font-size:0.88rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:3px;">MAP Assessment Gateway</div>' +
      '<div style="font-size:0.77rem;color:rgba(138,160,184,0.8);line-height:1.5;">4-screen tablet UI for pharmacy counter staff. Self-contained, 5 languages, 72px touch targets. Open on a shared counter device or share the link with your pharmacy partner.</div>' +
    '</div>' +
    '<a href="./pharmacy.html" target="_blank" rel="noopener" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:10px 20px;border-radius:7px;border:1px solid rgba(46,201,138,0.40);background:rgba(46,201,138,0.10);color:#2ec98a;text-decoration:none;white-space:nowrap;flex-shrink:0;transition:background 0.14s;" onmouseover="this.style.background=\'rgba(46,201,138,0.18)\'" onmouseout="this.style.background=\'rgba(46,201,138,0.10)\'">Open Pharmacy App &#8599;</a>';
  container.appendChild(_pgLaunch);

  const _pgStats = document.createElement('div');
  container.appendChild(_pgStats);

  _pgStats.innerHTML = _loadingHTML('Loading network statistics...');

  const ref = (typeof database !== 'undefined' ? database : firebase.database())
    .ref('pharmacy_assessments');

  ref.once('value', snap => {
    const raw = snap.val();
    if (!raw) {
      _pgStats.innerHTML = _emptyHTML('No network data available yet.');
      return;
    }

    const all = Object.values(raw).filter(r => r.assessment_mode === 'pharmacy');

    // Group by pharmacy_name or workspace_key
    const byPharmacy = {};
    all.forEach(r => {
      const key = r.pharmacy_name || r.workspace_key || 'Unknown';
      if (!byPharmacy[key]) byPharmacy[key] = [];
      byPharmacy[key].push(r);
    });

    const pharmKeys = Object.keys(byPharmacy);
    const networkTotal = all.length;
    const networkDist = { green: 0, amber: 0, red: 0 };
    all.forEach(r => { if (networkDist[r.traffic_light] !== undefined) networkDist[r.traffic_light]++; });

    const networkRed = networkTotal > 0 ? networkDist.red / networkTotal : 0;
    const networkAmber = networkTotal > 0 ? networkDist.amber / networkTotal : 0;

    // Build per-pharmacy comparison rows
    const pharmRows = pharmKeys.map((key, idx) => {
      const recs  = byPharmacy[key];
      const pTotal = recs.length;
      const pRed   = pTotal > 0 ? recs.filter(r=>r.traffic_light==='red').length / pTotal : 0;
      const diff   = pRed - networkRed;
      const diffColor = diff > 0.05 ? PG_COLORS.poor : diff < -0.05 ? PG_COLORS.optimal : PG_COLORS.muted;
      const diffSign  = diff > 0 ? '+' : '';
      return `
        <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:0.95rem;color:${PG_COLORS.bright};">
              <span style="font-family:${PG_FONT_MONO};font-size:0.76rem;color:${PG_COLORS.muted};margin-right:8px;">P${String(idx+1).padStart(2,'0')}</span>
              ${_esc(key.length > 28 ? key.slice(0,25)+'...' : key)}
            </div>
            <div style="font-family:${PG_FONT_MONO};font-size:0.82rem;color:${diffColor};">
              ${diffSign}${(diff*100).toFixed(1)}% vs net
            </div>
          </div>
          <div style="height:7px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
            <div data-fill-w="${_pct(pRed)}"
              style="height:100%;width:0%;background:${PG_COLORS.poor};border-radius:4px;transition:width 1s ease;"></div>
          </div>
          <div style="font-family:${PG_FONT_MONO};font-size:0.75rem;color:${PG_COLORS.muted};margin-top:4px;">
            ${_pct(pRed)} high risk &middot; ${pTotal} assessments
          </div>
        </div>`;
    }).join('');

    _pgStats.innerHTML = `
    <div style="font-family:${PG_FONT_BODY};color:${PG_COLORS.bright};">

      <!-- Header -->
      <div style="margin-bottom:24px;">
        <div style="font-family:${PG_FONT_MONO};font-size:0.72rem;letter-spacing:0.24em;text-transform:uppercase;color:${PG_COLORS.muted};margin-bottom:6px;">
          FOFI Network View &middot; All Participating Pharmacies
        </div>
        <div style="font-family:${PG_FONT_DISP};font-size:1.9rem;font-weight:300;color:#fff;">
          Network Overview
        </div>
        <div style="font-size:0.9rem;color:${PG_COLORS.muted};margin-top:4px;">
          ${pharmKeys.length} pharmacies &middot; ${networkTotal} total assessments &middot; de-identified
        </div>
      </div>

      <!-- Italy map placeholder + network donut row -->
      <div style="display:flex;gap:20px;margin-bottom:24px;flex-wrap:wrap;align-items:flex-start;">

        <!-- Italy SVG map placeholder -->
        <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};
          border-radius:14px;padding:20px;flex-shrink:0;min-width:200px;">
          <div style="font-family:${PG_FONT_MONO};font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;
            color:${PG_COLORS.muted};margin-bottom:12px;text-align:center;">Participating Pharmacies</div>
          ${_italySVG(pharmKeys.length)}
          <div style="font-family:${PG_FONT_MONO};font-size:0.7rem;color:${PG_COLORS.muted};text-align:center;margin-top:8px;">
            ${pharmKeys.length} active site${pharmKeys.length !== 1 ? 's' : ''}
          </div>
        </div>

        <!-- Network-wide dist -->
        <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
          <div style="font-family:${PG_FONT_MONO};font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;
            color:${PG_COLORS.muted};margin-bottom:4px;">Network Risk Distribution</div>
          ${[
            { label: 'Low Risk',   val: networkDist.green, color: PG_COLORS.optimal  },
            { label: 'Monitor',    val: networkDist.amber, color: PG_COLORS.moderate },
            { label: 'High Risk',  val: networkDist.red,   color: PG_COLORS.poor    }
          ].map(d => `
            <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};border-radius:10px;padding:14px 18px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:7px;height:7px;border-radius:50%;background:${d.color};display:inline-block;"></span>
                  <span style="font-size:0.92rem;color:${PG_COLORS.muted};">${d.label}</span>
                </div>
                <div style="font-family:${PG_FONT_MONO};font-size:0.95rem;font-weight:500;color:${d.color};">
                  ${d.val} (${networkTotal > 0 ? _pct(d.val/networkTotal) : '0%'})
                </div>
              </div>
              <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
                <div data-fill-w="${networkTotal > 0 ? _pct(d.val/networkTotal) : '0%'}"
                  style="height:100%;width:0%;background:${d.color};border-radius:3px;transition:width 1s ease;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Per-pharmacy comparison -->
      <div style="background:${PG_COLORS.card};border:1px solid ${PG_COLORS.border};border-radius:14px;padding:22px 24px;">
        <div style="font-family:${PG_FONT_MONO};font-size:0.73rem;letter-spacing:0.22em;text-transform:uppercase;
          color:${PG_COLORS.muted};margin-bottom:4px;">Your Pharmacy vs Network Average</div>
        <div style="font-size:0.88rem;color:${PG_COLORS.muted};margin-bottom:16px;">
          Network high-risk baseline: ${_pct(networkRed)} &middot; shown as deviation
        </div>
        ${pharmRows || '<div style="color:var(--muted);font-size:0.9rem;padding:12px 0;">No pharmacies to compare yet.</div>'}
      </div>
    </div>`;

    requestAnimationFrame(() => {
      container.querySelectorAll('[data-fill-w]').forEach(el => {
        el.style.width = el.dataset.fillW;
      });
    });

  }).catch(err => {
    _pgStats.innerHTML = _errorHTML('Could not load network data: ' + err.message);
  });
}

/**
 * Renders a simple Italy SVG outline with scattered pharmacy dots.
 * @param {number} n  Number of dots to plot
 * @returns {string} SVG HTML
 */
function _italySVG(n) {
  // Simplified Italy boot silhouette (stylised path)
  const dots = [];
  // Fixed plausible Italian coordinates (normalised to SVG viewport 0-120 x 0-180)
  const positions = [
    [55,30],[48,45],[50,60],[52,75],[60,85],[65,100],[58,118],[56,130],
    [62,140],[70,150],[80,145],[85,130],[88,115],[80,100],[75,85],[70,70],
    [72,55],[66,40],[80,35],[95,40],[105,50],[108,65],[100,78],[90,80]
  ];
  const count = Math.min(n, positions.length);
  for(let i=0;i<count;i++){
    const [x,y] = positions[i];
    dots.push(`<circle cx="${x}" cy="${y}" r="5" fill="${PG_COLORS.optimal}"
      opacity="0.8" style="filter:drop-shadow(0 0 3px ${PG_COLORS.optimal});"/>`);
  }
  return `
  <svg width="130" height="180" viewBox="0 0 130 180" style="display:block;margin:0 auto;">
    <!-- Italy boot outline (stylised) -->
    <path d="M60 10 C55 20 48 35 46 50 C44 65 48 80 52 90
             C56 100 58 115 55 128 C52 138 54 148 60 155
             C66 162 75 160 82 155 C88 150 90 140 88 128
             C86 115 80 105 76 92 C72 78 74 62 72 48
             C70 34 80 22 88 18 C96 14 108 22 112 35
             C116 48 110 65 106 78 C102 88 96 95 92 102
             C100 100 108 95 112 88 C118 78 118 62 114 50
             C110 38 100 28 90 22 C80 16 68 8 60 10Z"
      fill="rgba(78,156,245,0.08)" stroke="rgba(78,156,245,0.25)" stroke-width="1.5"/>
    ${dots.join('\n    ')}
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════════════
// generatePharmacyReport
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generates a plain-language text report for the Order of Pharmacists of Rome
 * quarterly submission. Includes all key statistics in readable format.
 *
 * @param {string} workspaceKey   Pharmacy workspace identifier
 * @returns {Promise<string>}     Resolves with formatted report text
 */
function generatePharmacyReport(workspaceKey) {
  return new Promise((resolve, reject) => {
    const ref = (typeof database !== 'undefined' ? database : firebase.database())
      .ref('pharmacy_assessments');

    ref.once('value', snap => {
      const raw = snap.val();
      if (!raw) {
        resolve(_blankReport(workspaceKey));
        return;
      }

      const all = Object.values(raw);
      const wk = (workspaceKey || '').toUpperCase();
      const records = wk === 'SUPERADMIN'
        ? all
        : all.filter(r => {
            const rk = (r.workspace_key || '').toUpperCase();
            const rn = (r.pharmacy_name || '').toUpperCase();
            return rk === wk || rn === wk;
          });

      const now = new Date();
      const monthRecords = records.filter(r => _isThisMonth(r.ts));
      const total = monthRecords.length;

      if (total === 0) {
        resolve(_blankReport(workspaceKey));
        return;
      }

      // Compute stats
      const dist = { green: 0, amber: 0, red: 0 };
      monthRecords.forEach(r => { if (dist[r.traffic_light] !== undefined) dist[r.traffic_light]++; });

      let sumPE = 0, sumA = 0, sumE = 0, sumCg = 0;
      monthRecords.forEach(r => {
        sumPE += (r.pe_score  || 0);
        sumA  += (r.arch_score || 0);
        sumE  += (r.exec_score || 0);
        sumCg += (r.ctx_score  || 0);
      });
      const meanPE = sumPE / total;
      const meanA  = sumA  / total;
      const meanE  = sumE  / total;
      const meanCg = sumCg / total;

      // Failure domain counts
      const failCounts = { Architecture: 0, Execution: 0, 'Context-Guard': 0 };
      monthRecords.filter(r=>r.traffic_light==='red'||r.traffic_light==='amber').forEach(r => {
        const low = [
          { d: 'Architecture',  v: r.arch_score || 0 },
          { d: 'Execution',     v: r.exec_score || 0 },
          { d: 'Context-Guard', v: r.ctx_score  || 0 }
        ].sort((a,b)=>a.v-b.v)[0].d;
        failCounts[low]++;
      });
      const dominantFailure = Object.entries(failCounts).sort((a,b)=>b[1]-a[1])[0][0];

      // Condition breakdown
      const condRisk = {};
      monthRecords.forEach(r => {
        const c = r.condition || 'Unspecified';
        if (!condRisk[c]) condRisk[c] = { total: 0, red: 0 };
        condRisk[c].total++;
        if (r.traffic_light === 'red') condRisk[c].red++;
      });

      // PEACS distribution
      const peacs = {};
      monthRecords.forEach(r => {
        const p = r.peacs_phenotype || 'Unknown';
        peacs[p] = (peacs[p] || 0) + 1;
      });

      const alertsSent = monthRecords.filter(r => r.alert_sent).length;

      const reportDate = now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
      const monthLabel = now.toLocaleDateString('en-GB',{month:'long',year:'numeric'});

      const condLines = Object.entries(condRisk).map(([c,s])=>
        `    ${c}: ${s.total} patients, ${s.red} high-risk (${s.total>0?_pct(s.red/s.total):'0%'})`
      ).join('\n');

      const peacsLines = Object.entries(peacs).map(([p,c])=>
        `    ${p}: ${c} (${_pct(c/total)})`
      ).join('\n');

      const report = [
        '================================================================',
        'ATLAS MAP PHARMACY ADHERENCE REPORT',
        'Order of Pharmacists of Rome / FOFI',
        '================================================================',
        '',
        `Report Generated:     ${reportDate}`,
        `Reporting Period:     ${monthLabel}`,
        `Pharmacy / Workspace: ${workspaceKey || 'N/A'}`,
        `Instrument:           MAP (Multidimensional Adherence Parameters)`,
        `Platform:             ATLAS Pharmacy Gateway v8.7.0`,
        `Institution:          Scala Carta Foundation / TESSERA GRC`,
        '',
        '----------------------------------------------------------------',
        'SUMMARY',
        '----------------------------------------------------------------',
        '',
        `Total Assessments This Month:  ${total}`,
        `Mean PE Composite Score:       ${meanPE.toFixed(3)} / 1.000`,
        '',
        'RISK DISTRIBUTION:',
        `  Low Risk (Green):    ${dist.green} patients (${_pct(dist.green/total)})`,
        `  Monitor (Amber):     ${dist.amber} patients (${_pct(dist.amber/total)})`,
        `  High Risk (Red):     ${dist.red} patients (${_pct(dist.red/total)})`,
        '',
        '----------------------------------------------------------------',
        'DOMAIN ANALYSIS',
        '----------------------------------------------------------------',
        '',
        `Architecture domain mean:   ${meanA.toFixed(3)}`,
        '  (Reflects intentional adherence decisions and treatment beliefs)',
        '',
        `Execution domain mean:      ${meanE.toFixed(3)}`,
        '  (Reflects routine habits, memory, and daily adherence behaviour)',
        '',
        `Context-Guard domain mean:  ${meanCg.toFixed(3)}`,
        '  (Reflects practical barriers: travel, inconvenience, access)',
        '',
        `Dominant failure domain:    ${dominantFailure}`,
        '',
        '----------------------------------------------------------------',
        'CONDITION BREAKDOWN',
        '----------------------------------------------------------------',
        '',
        condLines,
        '',
        '----------------------------------------------------------------',
        'ADHERENCE PHENOTYPES (PEACS Classification)',
        '----------------------------------------------------------------',
        '',
        peacsLines,
        '',
        '----------------------------------------------------------------',
        'ACTIONS TAKEN',
        '----------------------------------------------------------------',
        '',
        `Prescriber alerts generated: ${alertsSent}`,
        `Alert rate (of high-risk):   ${dist.red > 0 ? _pct(alertsSent/dist.red) : 'N/A'}`,
        '',
        '----------------------------------------------------------------',
        'CLINICAL INTERPRETATION',
        '----------------------------------------------------------------',
        '',
        `The dominant failure domain for this reporting period is ${dominantFailure}.`,
        '',
        dominantFailure === 'Architecture'
          ? 'A significant proportion of patients in this cohort are making intentional\ndecisions not to take their medication. This may reflect doubts about treatment\nefficacy or concerns about side effects. Patient education sessions and\nprescriber communication about treatment goals are recommended.'
          : dominantFailure === 'Execution'
          ? 'Most adherence failures in this cohort are habit- or routine-based, suggesting\nthat patients intend to take their medication but forget or miss doses due to\nlifestyle patterns. Structured reminder tools, blister packaging, or adherence\napps may reduce this gap.'
          : 'Adherence failures in this cohort are predominantly context-driven, linked\nto travel, inconvenience, or access barriers. Simplifying regimens, providing\nemergency supplies, or discussing flexible dosing options with prescribers\ncould significantly improve adherence in this population.',
        '',
        '================================================================',
        'END OF REPORT',
        `Generated by ATLAS Pharmacy Gateway | atlas.adherence.cc`,
        '================================================================'
      ].join('\n');

      resolve(report);

    }).catch(err => reject(err));
  });
}

function _blankReport(workspaceKey) {
  const d = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  return [
    '================================================================',
    'ATLAS MAP PHARMACY ADHERENCE REPORT',
    '================================================================',
    '',
    `Generated: ${d}`,
    `Workspace: ${workspaceKey || 'N/A'}`,
    '',
    'No assessment data recorded for this pharmacy in the current reporting period.',
    '',
    'To begin collecting data, use the ATLAS Pharmacy Gateway (pharmacy.html)',
    'to administer MAP assessments at your pharmacy counter.',
    '',
    '================================================================',
    'END OF REPORT',
    '================================================================'
  ].join('\n');
}

// ── Shared UI helpers ────────────────────────────────────────────────────────

function _loadingHTML(msg) {
  return `<div style="padding:32px;text-align:center;font-family:${PG_FONT_MONO};
    font-size:0.82rem;letter-spacing:0.16em;color:${PG_COLORS.muted};text-transform:uppercase;">
    <div style="font-size:1.4rem;margin-bottom:12px;opacity:0.5;">&#8987;</div>
    ${_esc(msg)}
  </div>`;
}

function _emptyHTML(msg) {
  return `<div style="padding:32px;text-align:center;font-family:${PG_FONT_BODY};
    font-size:1rem;color:${PG_COLORS.muted};">
    <div style="font-size:2rem;margin-bottom:12px;opacity:0.4;">&#128202;</div>
    ${_esc(msg)}
  </div>`;
}

function _errorHTML(msg) {
  return `<div style="padding:24px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);
    border-radius:12px;font-family:${PG_FONT_MONO};font-size:0.82rem;color:${PG_COLORS.poor};">
    &#9888; ${_esc(msg)}
  </div>`;
}

// ── Exports (for module-aware environments) ──────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadPharmacyStats, renderPharmacyNetworkStats, generatePharmacyReport };
}
