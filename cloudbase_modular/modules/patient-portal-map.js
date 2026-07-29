// ══════════════════════════════════════════════════════════════════════════════
// patient-portal-map.js  |  ATLAS v8.7.0
// MAP-Self patient history viewer -- clinical staff module
// renderPatientSelfResults(containerId, patientCode)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Renders the MAP Self-Assessment history for a given patient code into a
 * target container element. Intended for researcher, pharmacy, and clinician
 * dashboard views. NOT shown to patients.
 *
 * @param {string} containerId  DOM element ID to render into
 * @param {string} patientCode  Patient code string (case-insensitive match)
 */
function renderPatientSelfResults(containerId, patientCode) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // ── Patient self-assessment app launch card ───────────────────────────────
  if (!container.querySelector('#pmap-launch-card')) {
    const _pmLaunch = document.createElement('div');
    _pmLaunch.id = 'pmap-launch-card';
    _pmLaunch.style.cssText = 'background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.28);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;';
    _pmLaunch.innerHTML =
      '<div style="flex:1;min-width:220px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.20em;text-transform:uppercase;color:#d4a843;margin-bottom:4px;">Patient Self-Assessment App</div>' +
        '<div style="font-size:0.88rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:3px;">MAP-Self — Mobile Patient App</div>' +
        '<div style="font-size:0.77rem;color:rgba(138,160,184,0.8);line-height:1.5;">Mobile-optimized, 5 languages including Arabic. Share this link directly with your patient so they can complete their MAP assessment on their own device. Results appear below once submitted.</div>' +
      '</div>' +
      '<a href="./patient-map.html" target="_blank" rel="noopener" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:10px 20px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);background:rgba(212,168,67,0.10);color:#d4a843;text-decoration:none;white-space:nowrap;flex-shrink:0;transition:background 0.14s;" onmouseover="this.style.background=\'rgba(212,168,67,0.18)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.10)\'">Share Patient Link &#8599;</a>';
    container.insertBefore(_pmLaunch, container.firstChild);
  }

  const code = (patientCode || '').trim().toUpperCase();
  if (!code) {
    container.innerHTML += _pmap_errorHTML('No patient code provided.');
    return;
  }

  container.innerHTML = _pmap_loadingHTML(code);

  // Query Firebase for all self-assessments matching this patient code
  const db = firebase.database();
  db.ref('patient_self_assessments')
    .orderByChild('patient_code')
    .equalTo(code)
    .once('value')
    .then(snapshot => {
      const rows = [];
      snapshot.forEach(child => {
        rows.push({ key: child.key, ...child.val() });
      });

      if (!rows.length) {
        container.innerHTML = _pmap_errorHTML('No self-assessments found for patient code: ' + code);
        return;
      }

      // Sort ascending by timestamp
      rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      container.innerHTML = _pmap_render(code, rows);
    })
    .catch(err => {
      container.innerHTML = _pmap_errorHTML('Failed to load data: ' + (err.message || err));
    });
}

/* ── Internal: compute trend vs prior ────────────────────────────────────── */
function _pmap_trend(current, prior) {
  if (prior == null) return null;
  const diff = current - prior;
  if (Math.abs(diff) < 0.02) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function _pmap_trendArrow(trend, large) {
  if (!trend || trend === 'stable') return '<span style="color:#6b8099;font-size:' + (large ? '16px' : '13px') + '">&#8212;</span>';
  const up = trend === 'up';
  const color = up ? '#4ade80' : '#f87171';
  const arrow = up ? '&#8593;' : '&#8595;';
  return '<span style="color:' + color + ';font-size:' + (large ? '18px' : '14px') + '">' + arrow + '</span>';
}

function _pmap_peCircles(pe, size) {
  size = size || 14;
  let count = 1;
  if (pe >= 0.90) count = 5;
  else if (pe >= 0.75) count = 4;
  else if (pe >= 0.60) count = 3;
  else if (pe >= 0.45) count = 2;
  const filled = '<span style="display:inline-block;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#d4a843;margin-right:3px;vertical-align:middle;"></span>';
  const empty  = '<span style="display:inline-block;width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:2px solid rgba(212,168,67,0.35);margin-right:3px;vertical-align:middle;"></span>';
  return filled.repeat(count) + empty.repeat(5 - count);
}

function _pmap_bar(pct, color, height) {
  height = height || 6;
  return (
    '<div style="width:100%;height:' + height + 'px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;">' +
    '<div style="width:' + Math.round(pct) + '%;height:100%;background:' + color + ';border-radius:3px;"></div>' +
    '</div>'
  );
}

function _pmap_dateStr(ts) {
  if (!ts) return 'Unknown date';
  return new Date(ts).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

/* ── Internal: loading state ──────────────────────────────────────────────── */
function _pmap_loadingHTML(code) {
  return (
    '<div style="font-family:\'IBM Plex Sans\',sans-serif;color:#6b8099;padding:24px;text-align:center;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Loading MAP Self-Assessments</div>' +
    '<div style="font-size:13px;">' + code + '</div>' +
    '</div>'
  );
}

/* ── Internal: error state ────────────────────────────────────────────────── */
function _pmap_errorHTML(msg) {
  return (
    '<div style="font-family:\'IBM Plex Sans\',sans-serif;color:#f87171;padding:20px;font-size:13px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:10px;">' +
    msg +
    '</div>'
  );
}

/* ── Internal: full render ────────────────────────────────────────────────── */
function _pmap_render(code, rows) {
  const latest = rows[rows.length - 1];
  const prior = rows.length >= 2 ? rows[rows.length - 2] : null;

  const peTrend  = _pmap_trend(latest.pe_score, prior ? prior.pe_score : null);
  const archTrend = _pmap_trend(latest.arch_score, prior ? prior.arch_score : null);
  const execTrend = _pmap_trend(latest.exec_score, prior ? prior.exec_score : null);
  const ctxTrend  = _pmap_trend(latest.ctx_score, prior ? prior.ctx_score : null);

  const base = 'font-family:\'IBM Plex Sans\',sans-serif;color:#e8f0f8;';
  const mono = 'font-family:\'IBM Plex Mono\',monospace;';
  const muted = 'color:#6b8099;';
  const cardStyle = 'background:#111d30;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:12px;';

  // Latest assessment summary card
  let html = '<div style="' + base + '">';

  // Header
  html += (
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
    '<div>' +
    '<div style="' + mono + 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;' + muted + 'margin-bottom:3px;">MAP Self-Assessment History</div>' +
    '<div style="font-size:16px;font-weight:600;color:#e8f0f8;">' + code + '</div>' +
    '</div>' +
    '<div style="' + mono + 'font-size:11px;' + muted + '">' + rows.length + ' assessment' + (rows.length !== 1 ? 's' : '') + '</div>' +
    '</div>'
  );

  // Latest assessment card
  html += '<div style="' + cardStyle + 'border-color:rgba(212,168,67,0.2);">';
  html += (
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
    '<div>' +
    '<div style="' + mono + 'font-size:10px;letter-spacing:0.12em;text-transform:uppercase;' + muted + 'margin-bottom:4px;">Latest · ' + _pmap_dateStr(latest.ts) + '</div>' +
    '<div style="font-size:13px;' + muted + '">' + (latest.language ? latest.language.toUpperCase() : '') + '</div>' +
    '</div>' +
    '<div style="text-align:right;">' +
    '<div>' + _pmap_peCircles(latest.pe_score, 16) + _pmap_trendArrow(peTrend, true) + '</div>' +
    '<div style="' + mono + 'font-size:22px;color:#d4a843;margin-top:4px;">' + Math.round((latest.pe_score || 0) * 100) + '%' +
    '<span style="' + mono + 'font-size:11px;' + muted + 'margin-left:6px;">PE</span></div>' +
    '</div>' +
    '</div>'
  );

  // Domain bars
  const domains = [
    { label: 'Feelings about medication', key: 'arch_score', color: '#d4a843', trend: archTrend },
    { label: 'Daily routine',              key: 'exec_score', color: '#4e9cf5', trend: execTrend },
    { label: 'Practical challenges',       key: 'ctx_score',  color: '#9b7fd4', trend: ctxTrend }
  ];
  domains.forEach(d => {
    const val = latest[d.key] || 0;
    html += (
      '<div style="margin-bottom:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
      '<span style="font-size:12px;' + muted + '">' + d.label + '</span>' +
      '<span>' +
      '<span style="' + mono + 'font-size:12px;color:' + d.color + ';">' + Math.round(val * 100) + '%</span>' +
      '&nbsp;' + _pmap_trendArrow(d.trend, false) +
      '</span>' +
      '</div>' +
      _pmap_bar(val * 100, d.color, 6) +
      '</div>'
    );
  });

  // Phenotype (internal only)
  if (latest.peacs_phenotype) {
    html += (
      '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:8px;">' +
      '<span style="' + mono + 'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;' + muted + '">PEACS Phenotype:</span>' +
      '<span style="' + mono + 'font-size:12px;color:#9b7fd4;">' + latest.peacs_phenotype + '</span>' +
      (latest.low_adherence ? '<span style="margin-left:auto;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:4px;padding:2px 7px;font-size:10px;' + mono + 'color:#f87171;">LOW ADHERENCE</span>' : '') +
      '</div>'
    );
  }

  html += '</div>'; // end latest card

  // History table (if more than 1 assessment)
  if (rows.length > 1) {
    html += '<div style="' + cardStyle + '">';
    html += '<div style="' + mono + 'font-size:10px;letter-spacing:0.12em;text-transform:uppercase;' + muted + 'margin-bottom:14px;">Assessment History</div>';

    html += (
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      '<thead>' +
      '<tr style="' + muted + mono + 'font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">' +
      '<th style="text-align:left;padding-bottom:8px;font-weight:400;">Date</th>' +
      '<th style="text-align:center;padding-bottom:8px;font-weight:400;">PE</th>' +
      '<th style="text-align:center;padding-bottom:8px;font-weight:400;color:#d4a843;">Beliefs</th>' +
      '<th style="text-align:center;padding-bottom:8px;font-weight:400;color:#4e9cf5;">Routine</th>' +
      '<th style="text-align:center;padding-bottom:8px;font-weight:400;color:#9b7fd4;">Context</th>' +
      '<th style="text-align:center;padding-bottom:8px;font-weight:400;">Lang</th>' +
      '</tr>' +
      '</thead><tbody>'
    );

    // Show all rows descending (newest first)
    const sorted = [...rows].reverse();
    sorted.forEach((row, idx) => {
      const prevRow = idx < rows.length - 1 ? sorted[idx + 1] : null;
      const isLatest = idx === 0;
      const bg = isLatest ? 'background:rgba(212,168,67,0.05);' : '';
      const peTr = _pmap_trend(row.pe_score, prevRow ? prevRow.pe_score : null);
      html += (
        '<tr style="' + bg + 'border-top:1px solid rgba(255,255,255,0.05);">' +
        '<td style="padding:8px 0;' + muted + '">' + _pmap_dateStr(row.ts) + '</td>' +
        '<td style="text-align:center;' + mono + 'color:#d4a843;">' + Math.round((row.pe_score || 0) * 100) + '% ' + _pmap_trendArrow(peTr, false) + '</td>' +
        '<td style="text-align:center;' + mono + 'color:#d4a843;">' + Math.round((row.arch_score || 0) * 100) + '%</td>' +
        '<td style="text-align:center;' + mono + 'color:#4e9cf5;">' + Math.round((row.exec_score || 0) * 100) + '%</td>' +
        '<td style="text-align:center;' + mono + 'color:#9b7fd4;">' + Math.round((row.ctx_score || 0) * 100) + '%</td>' +
        '<td style="text-align:center;' + mono + muted + 'font-size:10px;">' + (row.language || '').toUpperCase() + '</td>' +
        '</tr>'
      );
    });

    html += '</tbody></table>';

    // Trend summary line
    const first = rows[0];
    const peDelta = latest.pe_score - first.pe_score;
    const deltaStr = (peDelta >= 0 ? '+' : '') + Math.round(peDelta * 100) + '%';
    const deltaColor = peDelta > 0.02 ? '#4ade80' : peDelta < -0.02 ? '#f87171' : '#6b8099';
    html += (
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);font-size:12px;' + muted + '">' +
      'Overall change from first to latest: <span style="' + mono + 'color:' + deltaColor + ';font-size:13px;">' + deltaStr + '</span> PE' +
      '</div>'
    );

    html += '</div>'; // end history card
  }

  html += '</div>'; // end base wrapper
  return html;
}

/* ── Export ───────────────────────────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderPatientSelfResults };
}
window.renderPatientSelfResults = renderPatientSelfResults;
