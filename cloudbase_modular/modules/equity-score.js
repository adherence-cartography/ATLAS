// equity-score.js — ATLAS v8.7.0
// Equity Score Layer: structural vs behavioral burden decomposition
// Computes Equity-Adjusted PE (EA-PE) and renders equity analysis panels
// All functions are globals. No imports/exports.

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════════════
const _EQ = {
  ink:          '#080e1a',
  surface:      '#0d1525',
  card:         '#111d30',
  border:       'rgba(255,255,255,0.07)',
  borderA:      'rgba(255,255,255,0.12)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  pe:           '#d4a843',
  amber:        '#d4a843',
  amberFaint:   'rgba(212,168,67,0.09)',
  amberDim:     'rgba(212,168,67,0.45)',
  green:        '#2ec98a',
  greenFaint:   'rgba(46,201,138,0.09)',
  red:          '#ef4444',
  redFaint:     'rgba(239,68,68,0.09)',
  blue:         '#4e9cf5',
  blueFaint:    'rgba(78,156,245,0.09)',
  text:         'rgba(205,216,232,0.92)',
  dim:          'rgba(96,120,152,0.65)',
};

// ══════════════════════════════════════════════════════════════════════════════
// INTERNAL MATH HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function _eqMean(arr) {
  var valid = arr.filter(function(v) { return v != null && isFinite(v); });
  if (!valid.length) return null;
  return valid.reduce(function(s, v) { return s + v; }, 0) / valid.length;
}

function _eqArch(r) {
  return ((+r.map_q2 || 0) + (+r.map_q3 || 0) + (+r.map_q6 || 0)) / 3;
}

function _eqExec(r) {
  return ((+r.map_q1 || 0) + (+r.map_q5 || 0) + (+r.map_q8 || 0)) / 3;
}

function _eqCtx(r) {
  return 0.5 + 0.5 * ((+r.map_q4 || 0) + (+r.map_q7 || 0)) / 2;
}

function _eqPE(A, E, Cg) {
  return Math.pow(Math.max(0, A * E * Cg), 1 / 3);
}

function _eqEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _eqFmt(v, d) {
  d = (d === undefined) ? 2 : d;
  if (v == null || !isFinite(v)) return 'N/A';
  return (+v).toFixed(d);
}

function _eqPct(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  return (v * 100).toFixed(1) + '%';
}

function _eqPEColor(v) {
  if (v >= 0.75) return _EQ.green;
  if (v >= 0.50) return _EQ.amber;
  return _EQ.red;
}

function _eqEl(tag, attrs, inner) {
  var el = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function(k) {
    if (k === 'class') el.className = attrs[k];
    else if (k === 'style') el.style.cssText = attrs[k];
    else el.setAttribute(k, attrs[k]);
  });
  if (inner !== undefined) el.innerHTML = inner;
  return el;
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS INJECTION
// ══════════════════════════════════════════════════════════════════════════════

function _eqInjectStyles() {
  if (document.getElementById('eq-styles')) return;
  var s = document.createElement('style');
  s.id = 'eq-styles';
  s.textContent = [
    '.eq-panel{background:#111d30;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:24px 28px;margin-bottom:18px;}',
    '.eq-eyebrow{font-family:"IBM Plex Mono",monospace;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;color:#d4a843;margin-bottom:6px;}',
    '.eq-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.55rem;font-weight:300;color:#e8f0f8;line-height:1.25;margin-bottom:4px;}',
    '.eq-sub{font-size:0.82rem;color:#6b8099;line-height:1.6;margin-bottom:22px;}',
    '.eq-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;}',
    '.eq-stat-box{background:#0d1525;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;text-align:center;}',
    '.eq-stat-label{font-family:"IBM Plex Mono",monospace;font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;color:#6b8099;margin-bottom:8px;}',
    '.eq-stat-val{font-family:"Cormorant Garamond",Georgia,serif;font-size:2.4rem;font-weight:300;line-height:1;}',
    '.eq-gap-wrap{margin-bottom:18px;}',
    '.eq-gap-label{font-family:"IBM Plex Mono",monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;margin-bottom:8px;}',
    '.eq-gap-track{height:18px;background:rgba(255,255,255,0.05);border-radius:9px;overflow:hidden;position:relative;}',
    '.eq-gap-fill-actual{height:100%;border-radius:9px 0 0 9px;background:#4e9cf5;transition:width 0.6s ease;}',
    '.eq-gap-fill-ea{height:100%;border-radius:0;background:#d4a843;transition:width 0.6s ease;}',
    '.eq-gap-fill-gap{height:100%;border-radius:0 9px 9px 0;background:rgba(239,68,68,0.45);}',
    '.eq-gap-row{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;}',
    '.eq-gap-legend{display:flex;align-items:center;gap:6px;font-family:"IBM Plex Mono",monospace;font-size:0.64rem;color:#6b8099;}',
    '.eq-gap-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}',
    '.eq-burden-box{background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.22);border-radius:10px;padding:16px 18px;margin-bottom:18px;}',
    '.eq-burden-pct{font-family:"Cormorant Garamond",Georgia,serif;font-size:2rem;font-weight:300;color:#d4a843;margin-bottom:4px;}',
    '.eq-burden-text{font-size:0.80rem;color:rgba(205,216,232,0.80);line-height:1.6;}',
    '.eq-policy-box{background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);border-radius:10px;padding:16px 18px;margin-bottom:18px;}',
    '.eq-policy-label{font-family:"IBM Plex Mono",monospace;font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;color:#4e9cf5;margin-bottom:7px;}',
    '.eq-policy-text{font-size:0.82rem;color:rgba(205,216,232,0.85);line-height:1.65;}',
    '.eq-table-wrap{overflow-x:auto;margin-bottom:18px;}',
    '.eq-table{width:100%;border-collapse:collapse;font-size:0.80rem;}',
    '.eq-table th{font-family:"IBM Plex Mono",monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:#6b8099;padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.07);white-space:nowrap;}',
    '.eq-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(205,216,232,0.88);vertical-align:middle;}',
    '.eq-table tr:last-child td{border-bottom:none;}',
    '.eq-table tr:hover td{background:rgba(255,255,255,0.03);}',
    '.eq-priority-chip{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 8px;border-radius:10px;border:1px solid;}',
    '.eq-section-label{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:#6b8099;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:8px;}',
    /* Supervisor dashboard styles */
    '.eq-stats-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:20px;}',
    '.eq-stat-card{background:#0d1525;border:1px solid rgba(255,255,255,0.07);border-radius:9px;padding:14px 16px;text-align:center;}',
    '.eq-stat-card-val{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.8rem;font-weight:300;line-height:1.1;}',
    '.eq-stat-card-label{font-family:"IBM Plex Mono",monospace;font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;margin-top:4px;}',
    '.eq-filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;}',
    '.eq-filter-select{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;background:#0d1525;border:1px solid rgba(255,255,255,0.10);border-radius:6px;color:rgba(205,216,232,0.88);padding:6px 10px;cursor:pointer;}',
    '.eq-filter-select:focus{outline:none;border-color:rgba(78,156,245,0.40);}',
    '.eq-filter-label{font-family:"IBM Plex Mono",monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;color:#6b8099;}',
    '.eq-btn{font-family:"IBM Plex Mono",monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid;cursor:pointer;transition:all 0.12s;white-space:nowrap;}',
    '.eq-btn-blue{border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.08);color:#4e9cf5;}',
    '.eq-btn-blue:hover{background:rgba(78,156,245,0.16);}',
    '.eq-btn-amber{border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.08);color:#d4a843;}',
    '.eq-btn-amber:hover{background:rgba(212,168,67,0.16);}',
    '.eq-btn-green{border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.08);color:#2ec98a;}',
    '.eq-btn-green:hover{background:rgba(46,201,138,0.16);}',
    '.eq-tl-dot{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;margin-right:5px;}',
    '.eq-flag-row td{background:rgba(212,168,67,0.06)!important;}',
    '.eq-pending-badge{display:inline-block;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.30);border-radius:10px;font-family:"IBM Plex Mono",monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;color:#d4a843;padding:2px 9px;margin-left:8px;}',
  ].join('\n');
  document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════════════════════
// computeEquityAdjustedPE(assessments, countryHDI)
// Pure function. Returns equity decomposition object.
// assessments: array of records with map_q1..map_q8 (0/1 or ordinal for Q8)
// countryHDI:  optional numeric HDI value (0-1), reserved for future weighting
// ══════════════════════════════════════════════════════════════════════════════
function computeEquityAdjustedPE(assessments, countryHDI) {
  if (!assessments || !assessments.length) return null;

  var valid = assessments.filter(function(r) {
    return r != null && r.map_q1 != null;
  });
  if (!valid.length) return null;

  var CT_FULL = 0.85; // hypothetical full-access Context-Guard standard

  var archVals = valid.map(_eqArch);
  var execVals = valid.map(_eqExec);
  var ctxVals  = valid.map(_eqCtx);

  var arch_mean = _eqMean(archVals);
  var exec_mean = _eqMean(execVals);
  var ctx_mean  = _eqMean(ctxVals);

  // Actual PE per record then mean
  var peVals = valid.map(function(r, i) {
    return _eqPE(archVals[i], execVals[i], ctxVals[i]);
  });
  var actual_pe_mean = _eqMean(peVals);

  // EA-PE per record: substitute 0.85 for actual Context-Guard
  var eaPeVals = valid.map(function(r, i) {
    return _eqPE(archVals[i], execVals[i], CT_FULL);
  });
  var ea_pe_mean = _eqMean(eaPeVals);

  // Equity gap = EA-PE mean - actual PE mean (positive = structural suppression)
  var equity_gap = Math.max(0, ea_pe_mean - actual_pe_mean);

  // Structural burden: fraction of total non-adherence attributable to context barriers
  // Total non-adherence = 1 - actual_pe; structural component = equity_gap
  var total_non_adherence = 1 - actual_pe_mean;
  var structural_burden_pct = total_non_adherence > 0
    ? Math.min(1, equity_gap / total_non_adherence)
    : 0;

  var pct_str = (structural_burden_pct * 100).toFixed(1);

  var interpretation;
  if (structural_burden_pct >= 0.30) {
    interpretation = 'High structural burden. ' + pct_str + '% of non-adherence in this population is attributable to environmental and access barriers rather than behavioral factors.';
  } else if (structural_burden_pct >= 0.15) {
    interpretation = 'Moderate structural burden. ' + pct_str + '% of non-adherence is attributable to access barriers. Both structural and behavioral interventions are warranted.';
  } else {
    interpretation = 'Low structural burden. ' + pct_str + '% of non-adherence is attributable to access barriers. Behavioral interventions are likely to be the primary lever in this population.';
  }

  return {
    actual_pe_mean:          actual_pe_mean,
    equity_adjusted_pe_mean: ea_pe_mean,
    equity_gap:              equity_gap,
    ctx_mean_actual:         ctx_mean,
    ctx_full_access:         CT_FULL,
    arch_mean:               arch_mean,
    exec_mean:               exec_mean,
    structural_burden_pct:   structural_burden_pct,
    n:                       valid.length,
    interpretation:          interpretation,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// renderEquityDashboard(containerId, workspaceKey)
// Renders the equity analysis panel. Loads assessments from Firebase.
// ══════════════════════════════════════════════════════════════════════════════
function renderEquityDashboard(containerId, workspaceKey) {
  _eqInjectStyles();

  var container = document.getElementById(containerId);
  if (!container) { console.warn('[equity-score] Container not found:', containerId); return; }

  container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.75rem;color:#6b8099;padding:20px;">Loading equity data...</div>';

  // Try to load from Firebase
  var db = (typeof database !== 'undefined') ? database : null;
  if (window.firebase && window.firebase.database) db = window.firebase.database();

  function _render(assessments, countryMap) {
    container.innerHTML = '';

    var wrap = _eqEl('div', {});

    // Header
    var header = _eqEl('div', { style: 'margin-bottom:22px;' });
    header.innerHTML = '<div class="eq-eyebrow">ATLAS v8.7 / Equity Layer</div>' +
      '<div class="eq-title">Equity-Adjusted Adherence Analysis</div>' +
      '<div class="eq-sub">Separating behavioral non-adherence from structural barriers to care.</div>';
    wrap.appendChild(header);

    if (!assessments || !assessments.length) {
      wrap.appendChild(_eqEl('div', { class: 'eq-panel' },
        '<div style="color:#6b8099;font-size:0.82rem;">No assessment data found for workspace <strong>' + _eqEsc(workspaceKey) + '</strong>. Collect assessments first.</div>'
      ));
      container.appendChild(wrap);
      return;
    }

    var result = computeEquityAdjustedPE(assessments);
    if (!result) {
      wrap.appendChild(_eqEl('div', { class: 'eq-panel' },
        '<div style="color:#6b8099;font-size:0.82rem;">Could not compute equity scores. Ensure assessment records include MAP question responses.</div>'
      ));
      container.appendChild(wrap);
      return;
    }

    // --- Panel 1: Observed vs EA-PE ---
    var panel1 = _eqEl('div', { class: 'eq-panel' });
    panel1.innerHTML = '<div class="eq-section-label">Adherence Score Comparison</div>';

    var twoCol = _eqEl('div', { class: 'eq-two-col' });

    var actualBox = _eqEl('div', { class: 'eq-stat-box' });
    var actualColor = _eqPEColor(result.actual_pe_mean);
    actualBox.innerHTML =
      '<div class="eq-stat-label">Observed Adherence Score</div>' +
      '<div class="eq-stat-val" style="color:' + actualColor + ';">' + _eqFmt(result.actual_pe_mean) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:#6b8099;margin-top:6px;">Actual population PE mean<br>n = ' + result.n + '</div>';

    var eaBox = _eqEl('div', { class: 'eq-stat-box' });
    var eaColor = _eqPEColor(result.equity_adjusted_pe_mean);
    eaBox.innerHTML =
      '<div class="eq-stat-label">Adherence if Access Were Equal</div>' +
      '<div class="eq-stat-val" style="color:' + eaColor + ';">' + _eqFmt(result.equity_adjusted_pe_mean) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:#6b8099;margin-top:6px;">Equity-adjusted PE (Cg = 0.85)<br>Hypothetical full-access score</div>';

    twoCol.appendChild(actualBox);
    twoCol.appendChild(eaBox);
    panel1.appendChild(twoCol);

    // Gap bar
    var gapWrap = _eqEl('div', { class: 'eq-gap-wrap' });
    var totalWidth = 100;
    var actualWidth = Math.round(result.actual_pe_mean * totalWidth);
    var eaWidth     = Math.round(result.equity_adjusted_pe_mean * totalWidth);
    var gapWidth    = Math.max(0, eaWidth - actualWidth);

    gapWrap.innerHTML = '<div class="eq-gap-label">Equity Gap Visualization (0 to 1.0 scale)</div>' +
      '<div class="eq-gap-track">' +
        '<div style="display:flex;height:100%;width:100%;">' +
          '<div class="eq-gap-fill-actual" style="width:' + actualWidth + '%;"></div>' +
          '<div class="eq-gap-fill-gap" style="width:' + gapWidth + '%;"></div>' +
        '</div>' +
      '</div>' +
      '<div class="eq-gap-row">' +
        '<div class="eq-gap-legend"><div class="eq-gap-dot" style="background:#4e9cf5;"></div>Observed PE (' + _eqFmt(result.actual_pe_mean) + ')</div>' +
        '<div class="eq-gap-legend"><div class="eq-gap-dot" style="background:rgba(239,68,68,0.55);"></div>Equity gap (' + _eqFmt(result.equity_gap) + ' PE points)</div>' +
        '<div class="eq-gap-legend"><div class="eq-gap-dot" style="background:#d4a843;"></div>EA-PE target (' + _eqFmt(result.equity_adjusted_pe_mean) + ')</div>' +
      '</div>';
    panel1.appendChild(gapWrap);
    wrap.appendChild(panel1);

    // --- Panel 2: Structural burden ---
    var panel2 = _eqEl('div', { class: 'eq-panel' });
    panel2.innerHTML = '<div class="eq-section-label">Structural Burden Analysis</div>';

    var burdenBox = _eqEl('div', { class: 'eq-burden-box' });
    burdenBox.innerHTML =
      '<div class="eq-burden-pct">' + _eqPct(result.structural_burden_pct) + ' structural</div>' +
      '<div class="eq-burden-text">Of the non-adherence in your population, ' +
        '<strong style="color:#d4a843;">' + _eqPct(result.structural_burden_pct) + '</strong>' +
        ' is driven by Context-Guard factors (cost, access, supply chain, travel distance) rather than behavioral factors (beliefs, habits, forgetfulness). ' +
        'Addressing structural barriers could recover up to <strong style="color:#d4a843;">' +
        _eqFmt(result.equity_gap) + ' PE points</strong> without any behavioral intervention program.' +
      '</div>';
    panel2.appendChild(burdenBox);

    var ctxRow = _eqEl('div', { class: 'eq-two-col', style: 'margin-bottom:14px;' });
    ctxRow.innerHTML =
      '<div class="eq-stat-box"><div class="eq-stat-label">Observed Context-Guard Mean</div>' +
        '<div class="eq-stat-val" style="color:#d4a843;">' + _eqFmt(result.ctx_mean_actual) + '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:#6b8099;margin-top:5px;">Population average Cg score</div>' +
      '</div>' +
      '<div class="eq-stat-box"><div class="eq-stat-label">Full-Access Benchmark</div>' +
        '<div class="eq-stat-val" style="color:#2ec98a;">0.85</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:#6b8099;margin-top:5px;">Cg value in equal-access scenario</div>' +
      '</div>';
    panel2.appendChild(ctxRow);

    var interp = _eqEl('div', { style: 'font-size:0.82rem;color:rgba(205,216,232,0.80);line-height:1.65;padding:12px 14px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);' },
      result.interpretation
    );
    panel2.appendChild(interp);
    wrap.appendChild(panel2);

    // --- Panel 3: Policy implication ---
    var panel3 = _eqEl('div', { class: 'eq-panel' });
    panel3.innerHTML = '<div class="eq-section-label">Policy Implication</div>';

    var isHighBurden = result.structural_burden_pct >= 0.20;
    var policyBox = _eqEl('div', { class: 'eq-policy-box' });
    policyBox.innerHTML = '<div class="eq-policy-label">Recommended Policy Priority</div>' +
      '<div class="eq-policy-text">' +
        (isHighBurden
          ? 'High structural burden populations require healthcare system reform, not behavioral support programs. Investment in co-pay assistance, supply chain reliability, and proximity of care services will outperform reminder apps and counseling in this population.'
          : 'Moderate-to-low structural burden suggests behavioral interventions (medication reminders, counseling, peer support) are likely to be cost-effective. Structural improvements remain beneficial but should be secondary priority in resource-limited settings.'
        ) +
      '</div>';
    panel3.appendChild(policyBox);
    wrap.appendChild(panel3);

    // --- Panel 4: Country comparison (if multi-country data) ---
    if (countryMap && Object.keys(countryMap).length > 1) {
      var panel4 = _eqEl('div', { class: 'eq-panel' });
      panel4.innerHTML = '<div class="eq-section-label">Country Comparison</div>';

      // Build rows
      var rows = [];
      Object.keys(countryMap).forEach(function(country) {
        var recs = countryMap[country];
        var r = computeEquityAdjustedPE(recs);
        if (!r) return;
        rows.push({ country: country, r: r });
      });

      // Sort by equity gap descending (highest structural burden first)
      rows.sort(function(a, b) { return b.r.equity_gap - a.r.equity_gap; });

      if (rows.length) {
        var tableWrap = _eqEl('div', { class: 'eq-table-wrap' });
        var tHead = '<thead><tr>' +
          '<th>Country</th>' +
          '<th>Observed PE</th>' +
          '<th>EA-PE</th>' +
          '<th>Equity Gap</th>' +
          '<th>Structural Burden</th>' +
          '<th>Policy Priority</th>' +
          '<th>N</th>' +
          '</tr></thead>';

        var tRows = rows.map(function(row) {
          var r = row.r;
          var gapColor = r.equity_gap >= 0.15 ? _EQ.red : (r.equity_gap >= 0.08 ? _EQ.amber : _EQ.green);
          var priority = r.structural_burden_pct >= 0.30 ? 'System Reform' :
                         r.structural_burden_pct >= 0.15 ? 'Mixed' : 'Behavioral';
          var prioColor = r.structural_burden_pct >= 0.30
            ? 'color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.06);'
            : r.structural_burden_pct >= 0.15
              ? 'color:#d4a843;border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.06);'
              : 'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.06);';
          return '<tr>' +
            '<td style="font-weight:500;color:#e8f0f8;">' + _eqEsc(row.country) + '</td>' +
            '<td style="color:' + _eqPEColor(r.actual_pe_mean) + ';font-family:\'IBM Plex Mono\',monospace;">' + _eqFmt(r.actual_pe_mean) + '</td>' +
            '<td style="color:' + _eqPEColor(r.equity_adjusted_pe_mean) + ';font-family:\'IBM Plex Mono\',monospace;">' + _eqFmt(r.equity_adjusted_pe_mean) + '</td>' +
            '<td style="color:' + gapColor + ';font-family:\'IBM Plex Mono\',monospace;">' + _eqFmt(r.equity_gap) + '</td>' +
            '<td style="font-family:\'IBM Plex Mono\',monospace;">' + _eqPct(r.structural_burden_pct) + '</td>' +
            '<td><span class="eq-priority-chip" style="' + prioColor + '">' + _eqEsc(priority) + '</span></td>' +
            '<td style="color:#6b8099;font-family:\'IBM Plex Mono\',monospace;">' + r.n + '</td>' +
            '</tr>';
        }).join('');

        tableWrap.innerHTML = '<table class="eq-table">' + tHead + '<tbody>' + tRows + '</tbody></table>';
        panel4.appendChild(tableWrap);
      }

      wrap.appendChild(panel4);
    }

    container.appendChild(wrap);
  }

  // Load data from Firebase
  if (db && workspaceKey) {
    db.ref('assessments').orderByChild('workspace').equalTo(workspaceKey)
      .once('value')
      .then(function(snap) {
        var recs = [];
        var countryMap = {};
        snap.forEach(function(child) {
          var d = child.val();
          if (!d) return;
          recs.push(d);
          if (d.country) {
            if (!countryMap[d.country]) countryMap[d.country] = [];
            countryMap[d.country].push(d);
          }
        });
        _render(recs, countryMap);
      })
      .catch(function(err) {
        console.error('[equity-score] Firebase load error:', err);
        _render([], null);
      });
  } else {
    // No Firebase: render empty state
    _render([], null);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// renderCHWSupervisorDashboard(containerId, workspaceKey)
// CHW program supervisor view: flagged cases, site stats, export CSV
// ══════════════════════════════════════════════════════════════════════════════
function renderCHWSupervisorDashboard(containerId, workspaceKey) {
  _eqInjectStyles();

  var container = document.getElementById(containerId);
  if (!container) { console.warn('[equity-score] Container not found:', containerId); return; }

  // ── CHW field app launch card (persists above data area) ─────────────────
  container.innerHTML = '';
  var _chwLaunch = document.createElement('div');
  _chwLaunch.style.cssText = 'background:rgba(139,111,245,0.06);border:1px solid rgba(139,111,245,0.28);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;';
  _chwLaunch.innerHTML =
    '<div style="flex:1;min-width:220px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.20em;text-transform:uppercase;color:#8b6ff5;margin-bottom:4px;">CHW Field App</div>' +
      '<div style="font-size:0.88rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:3px;">Community Health Worker Mode</div>' +
      '<div style="font-size:0.77rem;color:rgba(138,160,184,0.8);line-height:1.5;">Verbal administration for low-resource field settings. 7 languages, offline queue, 72px YES/NO buttons. Open on a field tablet or share the link with your CHW team supervisor.</div>' +
    '</div>' +
    '<a href="./chw.html" target="_blank" rel="noopener" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:10px 20px;border-radius:7px;border:1px solid rgba(139,111,245,0.40);background:rgba(139,111,245,0.10);color:#8b6ff5;text-decoration:none;white-space:nowrap;flex-shrink:0;transition:background 0.14s;" onmouseover="this.style.background=\'rgba(139,111,245,0.18)\'" onmouseout="this.style.background=\'rgba(139,111,245,0.10)\'">Open CHW App &#8599;</a>';
  container.appendChild(_chwLaunch);

  var _chwDataWrap = document.createElement('div');
  _chwDataWrap.style.cssText = 'font-family:\'IBM Plex Mono\',monospace;font-size:0.75rem;color:#6b8099;padding:20px;';
  _chwDataWrap.textContent = 'Loading CHW data...';
  container.appendChild(_chwDataWrap);

  var db = (typeof database !== 'undefined') ? database : null;
  if (window.firebase && window.firebase.database) db = window.firebase.database();

  function _render(records) {
    _chwDataWrap.innerHTML = '';

    var wrap = _eqEl('div', {});

    // Header
    var header = _eqEl('div', { style: 'margin-bottom:22px;' });
    header.innerHTML =
      '<div class="eq-eyebrow">ATLAS v8.7 / CHW Program</div>' +
      '<div class="eq-title">CHW Assessment Supervisor View</div>' +
      '<div class="eq-sub">Community Health Worker assessments, flagged cases, and site performance. Workspace: <span style="color:#4e9cf5;font-family:\'IBM Plex Mono\',monospace;">' + _eqEsc(workspaceKey) + '</span></div>';
    wrap.appendChild(header);

    if (!records || !records.length) {
      wrap.appendChild(_eqEl('div', { class: 'eq-panel' },
        '<div style="color:#6b8099;font-size:0.82rem;">No CHW assessments found for this workspace. Begin field assessments using the CHW mobile interface.</div>'
      ));
      container.appendChild(wrap);
      return;
    }

    // Build summary stats
    var totalCount  = records.length;
    var sites       = {};
    var chws        = {};
    var flaggedList = [];
    var pendingSync = 0;

    records.forEach(function(r) {
      if (r.site_id)   sites[r.site_id] = true;
      if (r.chw_name)  chws[r.chw_name] = true;
      if (r.flagged)   flaggedList.push(r);
      if (!r.synced)   pendingSync++;
    });

    var sitesCount  = Object.keys(sites).length;
    var chwCount    = Object.keys(chws).length;
    var flagCount   = flaggedList.length;

    // Stats row
    var statsRow = _eqEl('div', { class: 'eq-stats-row' });
    var statsData = [
      { val: totalCount,  label: 'Total Assessments',  color: '#4e9cf5' },
      { val: sitesCount,  label: 'Sites Active',        color: '#2ec98a' },
      { val: chwCount,    label: 'CHWs Active',         color: '#d4a843' },
      { val: flagCount,   label: 'Flagged for Review',  color: '#ef4444' },
      { val: pendingSync, label: 'Pending Sync',        color: '#f97316' },
    ];
    statsData.forEach(function(sd) {
      var card = _eqEl('div', { class: 'eq-stat-card' });
      card.innerHTML =
        '<div class="eq-stat-card-val" style="color:' + sd.color + ';">' + sd.val + '</div>' +
        '<div class="eq-stat-card-label">' + _eqEsc(sd.label) + '</div>';
      statsRow.appendChild(card);
    });
    wrap.appendChild(statsRow);

    // Filter state
    var filterState = { chw: '', site: '', condition: '', tl: '', flagged: false };

    var mainPanel = _eqEl('div', { class: 'eq-panel' });

    // Filter bar
    var filterBar = _eqEl('div', { class: 'eq-filter-bar' });

    function _makeFilterLabel(txt) {
      return _eqEl('span', { class: 'eq-filter-label' }, txt);
    }

    // CHW dropdown
    var chwOptions = ['<option value="">All CHWs</option>'].concat(
      Object.keys(chws).sort().map(function(c) {
        return '<option value="' + _eqEsc(c) + '">' + _eqEsc(c) + '</option>';
      })
    ).join('');
    var chwSel = _eqEl('select', { class: 'eq-filter-select' }, chwOptions);
    chwSel.addEventListener('change', function() { filterState.chw = this.value; _refreshTable(); });

    // Site dropdown
    var siteOptions = ['<option value="">All Sites</option>'].concat(
      Object.keys(sites).sort().map(function(s) {
        return '<option value="' + _eqEsc(s) + '">' + _eqEsc(s) + '</option>';
      })
    ).join('');
    var siteSel = _eqEl('select', { class: 'eq-filter-select' }, siteOptions);
    siteSel.addEventListener('change', function() { filterState.site = this.value; _refreshTable(); });

    // Condition dropdown
    var conditions = ['Hypertension','Diabetes','HIV-AIDS','Tuberculosis','Malaria','Other'];
    var condOptions = ['<option value="">All Conditions</option>'].concat(
      conditions.map(function(c) { return '<option value="' + _eqEsc(c) + '">' + _eqEsc(c) + '</option>'; })
    ).join('');
    var condSel = _eqEl('select', { class: 'eq-filter-select' }, condOptions);
    condSel.addEventListener('change', function() { filterState.condition = this.value; _refreshTable(); });

    // Traffic light dropdown
    var tlOptions = '<option value="">All Tiers</option><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option>';
    var tlSel = _eqEl('select', { class: 'eq-filter-select' }, tlOptions);
    tlSel.addEventListener('change', function() { filterState.tl = this.value; _refreshTable(); });

    // Flagged checkbox
    var flagLabel = _eqEl('label', {
      style: 'display:flex;align-items:center;gap:6px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:#d4a843;cursor:pointer;'
    });
    var flagChk = _eqEl('input', { type: 'checkbox' });
    flagChk.addEventListener('change', function() { filterState.flagged = this.checked; _refreshTable(); });
    flagLabel.appendChild(flagChk);
    flagLabel.appendChild(document.createTextNode('Flagged Only'));

    // Export CSV button
    var exportBtn = _eqEl('button', { class: 'eq-btn eq-btn-blue', style: 'margin-left:auto;' }, 'Export CSV');
    exportBtn.addEventListener('click', function() { _exportCSV(_getFiltered()); });

    filterBar.appendChild(_makeFilterLabel('CHW:'));
    filterBar.appendChild(chwSel);
    filterBar.appendChild(_makeFilterLabel('Site:'));
    filterBar.appendChild(siteSel);
    filterBar.appendChild(_makeFilterLabel('Condition:'));
    filterBar.appendChild(condSel);
    filterBar.appendChild(_makeFilterLabel('Tier:'));
    filterBar.appendChild(tlSel);
    filterBar.appendChild(flagLabel);
    filterBar.appendChild(exportBtn);
    mainPanel.appendChild(filterBar);

    // Table container
    var tableContainer = _eqEl('div', { class: 'eq-table-wrap' });
    mainPanel.appendChild(tableContainer);
    wrap.appendChild(mainPanel);
    container.appendChild(wrap);

    function _tlDot(tl) {
      var col = tl === 'GREEN' ? '#10b981' : tl === 'AMBER' ? '#d4a843' : '#ef4444';
      return '<span class="eq-tl-dot" style="background:' + col + ';"></span>' + _eqEsc(tl);
    }

    function _getFiltered() {
      return records.filter(function(r) {
        if (filterState.chw       && r.chw_name   !== filterState.chw)       return false;
        if (filterState.site      && r.site_id     !== filterState.site)      return false;
        if (filterState.condition && r.condition   !== filterState.condition) return false;
        if (filterState.tl        && r.traffic_light !== filterState.tl)      return false;
        if (filterState.flagged   && !r.flagged)                              return false;
        return true;
      });
    }

    function _refreshTable() {
      var filtered = _getFiltered();
      if (!filtered.length) {
        tableContainer.innerHTML = '<div style="font-size:0.80rem;color:#6b8099;padding:16px 0;">No records match the current filters.</div>';
        return;
      }

      var tHead = '<thead><tr>' +
        '<th>Date</th><th>CHW</th><th>Site</th><th>Patient Code</th>' +
        '<th>Condition</th><th>Traffic Light</th><th>Dominant Domain</th>' +
        '<th>PE</th><th>Flag</th><th>Actions</th>' +
        '</tr></thead>';

      var tRows = filtered.map(function(r) {
        var date = r.ts ? new Date(r.ts).toLocaleDateString() : 'N/A';
        var isFlagged = !!r.flagged;
        var rowClass = isFlagged ? ' class="eq-flag-row"' : '';
        var flagCell = isFlagged
          ? '<span style="color:#d4a843;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;">FLAGGED</span>'
          : '<span style="color:#6b8099;font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;">clear</span>';

        var markBtn = isFlagged
          ? '<button class="eq-btn eq-btn-green" style="font-size:0.60rem;padding:4px 8px;" ' +
              'data-rid="' + _eqEsc(r.id || '') + '">Mark Reviewed</button>'
          : '';

        return '<tr' + rowClass + '>' +
          '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:#6b8099;">' + _eqEsc(date) + '</td>' +
          '<td style="color:#e8f0f8;">' + _eqEsc(r.chw_name || 'N/A') + '</td>' +
          '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;">' + _eqEsc(r.site_id || 'N/A') + '</td>' +
          '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;">' + _eqEsc(r.patient_code || 'anon') + '</td>' +
          '<td>' + _eqEsc(r.condition || 'N/A') + '</td>' +
          '<td>' + _tlDot(r.traffic_light || 'N/A') + '</td>' +
          '<td style="font-size:0.76rem;color:#d4a843;">' + _eqEsc(r.dominant_domain || 'N/A') + '</td>' +
          '<td style="font-family:\'IBM Plex Mono\',monospace;color:' + _eqPEColor(+r.pe_score || 0) + ';">' + _eqFmt(+r.pe_score || 0) + '</td>' +
          '<td>' + flagCell + '</td>' +
          '<td>' + markBtn + '</td>' +
          '</tr>';
      }).join('');

      tableContainer.innerHTML = '<table class="eq-table">' + tHead + '<tbody>' + tRows + '</tbody></table>';

      // Bind "Mark Reviewed" buttons
      tableContainer.querySelectorAll('[data-rid]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var rid = this.getAttribute('data-rid');
          _markReviewed(rid, records, _refreshTable);
        });
      });
    }

    _refreshTable(); // initial render

    function _markReviewed(rid, allRecords, refresh) {
      // Clear flag in Firebase and locally
      if (db && rid) {
        db.ref('chw_assessments/' + rid).update({ flagged: false })
          .then(function() {
            allRecords.forEach(function(r) { if (r.id === rid) r.flagged = false; });
            // Update flagged count display
            flagCount = allRecords.filter(function(r) { return r.flagged; }).length;
            refresh();
          })
          .catch(function(err) {
            console.warn('[equity-score] Mark reviewed failed:', err);
            // Still update locally
            allRecords.forEach(function(r) { if (r.id === rid) r.flagged = false; });
            refresh();
          });
      } else {
        allRecords.forEach(function(r) { if (r.id === rid) r.flagged = false; });
        refresh();
      }
    }
  } // end _render

  function _exportCSV(rows) {
    var headers = ['date','chw_name','site_id','patient_code','condition','traffic_light',
                   'dominant_domain','pe_score','arch_score','exec_score','ctx_score',
                   'additive','peacs_phenotype','language','flagged','synced'];
    var csvRows = [headers.join(',')];
    rows.forEach(function(r) {
      csvRows.push(headers.map(function(h) {
        var val = r[h] != null ? String(r[h]) : '';
        // Escape quotes and wrap in quotes if contains comma or newline
        if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(','));
    });
    var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'chw_assessments_' + (workspaceKey || 'export') + '_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
  }

  // Load from Firebase chw_assessments, filtered by workspace
  if (db) {
    var query = workspaceKey
      ? db.ref('chw_assessments').orderByChild('workspace').equalTo(workspaceKey)
      : db.ref('chw_assessments');

    query.once('value')
      .then(function(snap) {
        var recs = [];
        snap.forEach(function(child) {
          var d = child.val();
          if (!d) return;
          d.id = child.key;
          recs.push(d);
        });
        // Sort newest first
        recs.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
        _render(recs);
      })
      .catch(function(err) {
        console.error('[equity-score] CHW supervisor load error:', err);
        _render([]);
      });
  } else {
    _render([]);
  }
}

window.renderEquityDashboard = renderEquityDashboard;
