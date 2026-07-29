'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// PREDICTIVE NON-ADHERENCE ENGINE — ATLAS v8.7.0
// MAP Trajectory Analysis: 30-60 day dropout risk prediction
// Created for ATLAS Pharma Medical Affairs positioning
//
// Requires: MAP domain colors and ATLAS design tokens available in CSS.
// Global scope pattern — no imports/exports.
// All functions declared as globals, matching map-assessment.js conventions.
//
// MAP (c) Philip Morisky / Adherence Cartography. All rights reserved.
// ATLAS platform (c) Adherence Inc. Unauthorized use prohibited.
// ══════════════════════════════════════════════════════════════════════════════

// ── Design tokens (mirrored from ATLAS token set) ─────────────────────────
var _PE_COLORS = {
  ink:          '#080e1a',
  surface:      '#0d1525',
  card:         '#111d30',
  cardDeep:     '#0a1422',
  border:       'rgba(255,255,255,0.07)',
  borderBright: 'rgba(255,255,255,0.14)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  pe:           '#d4a843',
  poor:         '#ef4444',
  moderate:     '#f59e0b',
  optimal:      '#10b981',
  architecture: '#f59e0b',
  execution:    '#22d3ee',
  context:      '#a78bfa',
};

// ── Risk tier config ───────────────────────────────────────────────────────
var _RISK_TIERS = {
  high:     { label: 'HIGH RISK',   color: '#ef4444', border: 'rgba(239,68,68,0.35)',   bg: 'rgba(239,68,68,0.06)',  pulse: true  },
  elevated: { label: 'ELEVATED',    color: '#f59e0b', border: 'rgba(245,158,11,0.30)',  bg: 'rgba(245,158,11,0.05)', pulse: false },
  low:      { label: 'MONITORING',  color: '#10b981', border: 'rgba(16,185,129,0.20)',  bg: 'rgba(16,185,129,0.04)', pulse: false },
  unscored: { label: 'NOT SCORED',  color: '#6b8099', border: 'rgba(107,128,153,0.20)', bg: 'rgba(107,128,153,0.04)',pulse: false },
};

// ── Intervention type labels ───────────────────────────────────────────────
var _INTERVENTION_LABELS = {
  belief_restructuring:  'Belief restructuring',
  habit_support:         'Habit support',
  access_support:        'Access support',
  side_effect_management:'Side-effect management',
  monitoring_only:       'Monitoring only',
};

// ── Primary signal labels ──────────────────────────────────────────────────
var _SIGNAL_LABELS = {
  architecture:  'ARCHITECTURE (beliefs/decisions)',
  execution:     'EXECUTION (behavioral reliability)',
  context_guard: 'CONTEXT-GUARD (environmental)',
  none:          'None identified',
};

// ── CSS injection (single call on first use) ───────────────────────────────
var _peStylesInjected = false;
function _injectPEStyles() {
  if (_peStylesInjected || typeof document === 'undefined') return;
  _peStylesInjected = true;

  var css = [
    // Dashboard wrapper
    '.pe-dashboard { font-family: var(--font-body,"IBM Plex Sans"),sans-serif; color: #e8f0f8; }',
    '.pe-dashboard-header { margin-bottom: 24px; }',
    '.pe-dashboard-title { font-family: var(--font-display,"Cormorant Garamond"),Georgia,serif; font-size: 1.9rem; font-weight: 300; color: #e8f0f8; margin: 0 0 6px; }',
    '.pe-dashboard-subtitle { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: #6b8099; }',

    // Filter bar
    '.pe-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; padding: 14px 16px; background: #111d30; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }',
    '.pe-filter-label { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; color: #6b8099; flex-shrink: 0; }',
    '.pe-filter-select { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.72rem; background: #0d1525; color: #e8f0f8; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 6px 10px; cursor: pointer; outline: none; }',
    '.pe-filter-select:focus { border-color: #4e9cf5; }',
    '.pe-filter-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.08); margin: 0 4px; }',

    // Patient list
    '.pe-patient-list { display: flex; flex-direction: column; gap: 12px; }',
    '.pe-no-patients { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.8rem; color: #6b8099; padding: 40px; text-align: center; }',

    // Patient risk card
    '.pe-patient-card { border-radius: 12px; border: 1px solid; padding: 18px 20px; position: relative; transition: border-color 0.2s; }',
    '.pe-patient-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }',
    '.pe-patient-id-block { flex: 1; min-width: 0; }',
    '.pe-patient-number { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 1rem; font-weight: 700; color: #e8f0f8; letter-spacing: 0.04em; }',
    '.pe-patient-condition { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.14em; color: #6b8099; margin-top: 3px; }',
    '.pe-risk-badge { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.6rem; letter-spacing: 0.14em; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid; flex-shrink: 0; }',

    // Pulse animation for high-risk
    '@keyframes pe-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.18); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }',
    '.pe-patient-card.pe-pulse { animation: pe-pulse 2s ease-in-out infinite; }',

    // Card metric row
    '.pe-card-metrics { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 10px; margin-bottom: 14px; }',
    '.pe-metric { background: rgba(0,0,0,0.18); border-radius: 7px; padding: 9px 12px; }',
    '.pe-metric-label { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em; color: #6b8099; margin-bottom: 4px; }',
    '.pe-metric-value { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.88rem; font-weight: 700; }',

    // PE trajectory inline
    '.pe-traj-line { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.72rem; color: rgba(232,240,248,0.6); margin-bottom: 12px; }',
    '.pe-traj-direction { margin-left: 6px; }',

    // Card action bar
    '.pe-card-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }',
    '.pe-action-btn { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 7px 14px; border-radius: 7px; border: 1px solid; cursor: pointer; transition: opacity 0.15s; background: transparent; }',
    '.pe-action-btn:hover { opacity: 0.75; }',
    '.pe-action-btn.primary { background: rgba(78,156,245,0.1); border-color: rgba(78,156,245,0.4); color: #4e9cf5; }',
    '.pe-action-btn.secondary { border-color: rgba(255,255,255,0.14); color: #6b8099; }',

    // Intervention tag
    '.pe-intervention-tag { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; color: #6b8099; margin-top: 6px; }',
    '.pe-intervention-tag strong { color: #e8f0f8; }',

    // Loading spinner
    '.pe-loading { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.72rem; color: #6b8099; padding: 20px; }',
    '@keyframes pe-spin { to { transform: rotate(360deg); } }',
    '.pe-spinner { width: 16px; height: 16px; border: 2px solid rgba(78,156,245,0.2); border-top-color: #4e9cf5; border-radius: 50%; animation: pe-spin 0.8s linear infinite; }',

    // SVG chart container
    '.pe-chart-wrap { background: #111d30; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; overflow: hidden; }',
    '.pe-chart-title { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: #6b8099; margin-bottom: 14px; }',
    '.pe-chart-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }',
    '.pe-legend-item { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.62rem; color: #6b8099; }',
    '.pe-legend-swatch { width: 20px; height: 2px; border-radius: 1px; flex-shrink: 0; }',
    '.pe-legend-swatch.dashed { background: repeating-linear-gradient(90deg, currentColor 0, currentColor 4px, transparent 4px, transparent 8px); }',

    // Summary widget
    '.pe-widget { background: #111d30; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px 20px; }',
    '.pe-widget-title { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: #6b8099; margin-bottom: 14px; }',
    '.pe-widget-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 14px; }',
    '.pe-widget-stat { text-align: center; }',
    '.pe-widget-num { font-family: var(--font-display,"Cormorant Garamond"),Georgia,serif; font-size: 2.2rem; font-weight: 300; line-height: 1; }',
    '.pe-widget-label { font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: #6b8099; margin-top: 4px; }',
    '.pe-widget-btn { width: 100%; font-family: var(--font-mono,"IBM Plex Mono"),monospace; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 10px; background: rgba(78,156,245,0.08); border: 1px solid rgba(78,156,245,0.3); border-radius: 8px; color: #4e9cf5; cursor: pointer; transition: background 0.15s; }',
    '.pe-widget-btn:hover { background: rgba(78,156,245,0.15); }',

    // Refresh indicator
    '.pe-refresh-spinner { display: inline-block; width: 10px; height: 10px; border: 1px solid rgba(78,156,245,0.3); border-top-color: #4e9cf5; border-radius: 50%; animation: pe-spin 0.8s linear infinite; margin-left: 6px; vertical-align: middle; }',
  ].join('\n');

  var tag = document.createElement('style');
  tag.id = 'predictive-engine-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

// ── Utility helpers ────────────────────────────────────────────────────────

function _peEsc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function _peApiBase() {
  return (typeof ATLAS_API_BASE !== 'undefined' ? ATLAS_API_BASE : '') || '/api/v1';
}

function _peAuthToken() {
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
    return firebase.auth().currentUser.getIdToken();
  }
  return Promise.resolve(null);
}

function _peFetch(path, opts) {
  return _peAuthToken().then(function(token) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts && opts.headers);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(_peApiBase() + path, Object.assign({}, opts, { headers: headers }));
  });
}

function _peRiskTier(score) {
  if (score == null) return 'unscored';
  if (score >= 0.70)  return 'high';
  if (score >= 0.40)  return 'elevated';
  return 'low';
}

// Formats a PE trajectory array into a readable arrow-joined string
function _fmtTraj(arr) {
  if (!arr || !arr.length) return 'n/a';
  return arr.map(function(v) { return parseFloat(v).toFixed(2); }).join(' \u2192 ');
}

// Derives trend arrow symbol from first and last values
function _trendArrow(arr) {
  if (!arr || arr.length < 2) return '';
  var delta = arr[arr.length - 1] - arr[0];
  if (delta < -0.05) return '\u2193 declining';
  if (delta < -0.01) return '\u2193 slight decline';
  if (delta > 0.05)  return '\u2191 improving';
  if (delta > 0.01)  return '\u2191 slight improvement';
  return '\u2192 stable';
}

// Formats a timestamp (ms epoch or ISO string) as a short date
function _fmtDate(val) {
  if (!val) return 'Unknown';
  var d = new Date(typeof val === 'number' ? val : val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════════════════════════
// renderDropoutRiskDashboard(containerId, workspaceKey)
//
// Renders the Medical Affairs command center: all patients for a workspace
// ranked by predicted 60-day discontinuation risk, with filter controls.
// ══════════════════════════════════════════════════════════════════════════════
function renderDropoutRiskDashboard(containerId, workspaceKey) {
  _injectPEStyles();

  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderDropoutRiskDashboard: container not found:', containerId);
    return;
  }

  // Render loading state immediately
  container.innerHTML = [
    '<div class="pe-dashboard">',
    '<div class="pe-dashboard-header">',
    '<div class="pe-dashboard-title">Dropout Risk Monitor</div>',
    '<div class="pe-dashboard-subtitle">Powered by MAP Trajectory Analysis</div>',
    '</div>',
    '<div class="pe-loading"><div class="pe-spinner"></div>Loading patient risk data...</div>',
    '</div>',
  ].join('');

  _peFetch('/map/risk-dashboard/' + encodeURIComponent(workspaceKey))
    .then(function(resp) {
      if (resp.status === 401 || resp.status === 403) throw new Error('__unauthorized__');
      return resp.json();
    })
    .then(function(json) {
      if (!json.ok) throw new Error(json.error || 'API error');
      _renderDashboardData(container, json.data, workspaceKey);
    })
    .catch(function(err) {
      var _msg = err && err.message || '';
      var _isUnauth = _msg === '__unauthorized__' || _msg.toLowerCase().indexOf('unauthorized') !== -1 || _msg.toLowerCase().indexOf('forbidden') !== -1;
      if (_isUnauth) {
        container.innerHTML = [
          '<div class="pe-dashboard">',
          '<div class="pe-dashboard-header"><div class="pe-dashboard-title">Dropout Risk Monitor</div></div>',
          '<div class="pe-no-patients" style="padding:32px;text-align:center;line-height:1.8;">',
          '<div style="font-size:1.4rem;margin-bottom:10px;opacity:0.3;">∿</div>',
          '<div style="font-size:0.88rem;color:var(--muted);margin-bottom:8px;">AI Risk Modeling Not Enabled</div>',
          'Dropout risk prediction requires MAP API access to be activated for your workspace.<br>',
          'Contact <span style="color:var(--base);">support@adherence.cc</span> to enable.',
          '</div></div>',
        ].join('');
      } else {
        container.innerHTML = [
          '<div class="pe-dashboard">',
          '<div class="pe-dashboard-header">',
          '<div class="pe-dashboard-title">Dropout Risk Monitor</div>',
          '</div>',
          '<div class="pe-no-patients">Failed to load risk data: ' + _peEsc(_msg) + '</div>',
          '</div>',
        ].join('');
      }
    });
}

function _renderDashboardData(container, data, workspaceKey) {
  var patients = data.patients || [];
  var summary  = data.summary  || {};

  // Collect unique conditions for filter
  var conditionSet = {};
  patients.forEach(function(p) { if (p.condition) conditionSet[p.condition] = true; });
  var conditions = Object.keys(conditionSet).sort();

  var condOptions = '<option value="">All Conditions</option>';
  conditions.forEach(function(c) {
    condOptions += '<option value="' + _peEsc(c) + '">' + _peEsc(c) + '</option>';
  });

  var html = [
    '<div class="pe-dashboard">',
    '<div class="pe-dashboard-header">',
    '<div class="pe-dashboard-title">Dropout Risk Monitor</div>',
    '<div class="pe-dashboard-subtitle">Patients ranked by predicted 60-day discontinuation risk &middot; ',
    data.total_patients + ' patients monitored',
    '</div>',
    '</div>',

    // Filter bar
    '<div class="pe-filter-bar">',
    '<span class="pe-filter-label">Filter</span>',
    '<select class="pe-filter-select" id="pe-filter-tier">',
    '<option value="">All Risk Tiers</option>',
    '<option value="high">High Risk</option>',
    '<option value="elevated">Elevated</option>',
    '<option value="low">Low Risk</option>',
    '</select>',
    '<div class="pe-filter-sep"></div>',
    '<select class="pe-filter-select" id="pe-filter-condition">',
    condOptions,
    '</select>',
    '<div class="pe-filter-sep"></div>',
    '<span class="pe-filter-label">Sort</span>',
    '<select class="pe-filter-select" id="pe-filter-sort">',
    '<option value="risk">By Risk Score</option>',
    '<option value="pe">By Current PE</option>',
    '<option value="date">By Last Assessment</option>',
    '</select>',
    '</div>',

    // Patient list
    '<div class="pe-patient-list" id="pe-patient-list">',
    '</div>',
    '</div>',
  ].join('');

  container.innerHTML = html;

  // Render patient cards with current filter state
  function _applyFilters() {
    var tierFilter = document.getElementById('pe-filter-tier');
    var condFilter = document.getElementById('pe-filter-condition');
    var sortSel    = document.getElementById('pe-filter-sort');

    var tierVal = tierFilter ? tierFilter.value : '';
    var condVal = condFilter ? condFilter.value : '';
    var sortVal = sortSel   ? sortSel.value    : 'risk';

    var filtered = patients.filter(function(p) {
      if (tierVal && p.risk_tier !== tierVal) return false;
      if (condVal && p.condition !== condVal)  return false;
      return true;
    });

    // Sort
    filtered = filtered.slice().sort(function(a, b) {
      if (sortVal === 'pe') {
        return (b.current_pe || 0) - (a.current_pe || 0);
      }
      if (sortVal === 'date') {
        var da = a.last_assessment_date ? new Date(a.last_assessment_date).getTime() : 0;
        var db = b.last_assessment_date ? new Date(b.last_assessment_date).getTime() : 0;
        return db - da;
      }
      // Default: by risk (nulls last)
      var ra = a.dropout_risk != null ? a.dropout_risk : -1;
      var rb = b.dropout_risk != null ? b.dropout_risk : -1;
      return rb - ra;
    });

    var listEl = document.getElementById('pe-patient-list');
    if (!listEl) return;

    if (!filtered.length) {
      listEl.innerHTML = '<div class="pe-no-patients">No patients match the current filters.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function(p) {
      return _buildPatientCardHTML(p, workspaceKey);
    }).join('');

    // Attach action button listeners
    filtered.forEach(function(p) {
      var alertBtn    = document.getElementById('pe-btn-alert-'    + p.session_id);
      var trajectBtn  = document.getElementById('pe-btn-traj-'     + p.session_id);
      var refreshBtn  = document.getElementById('pe-btn-refresh-'  + p.session_id);

      if (alertBtn) {
        alertBtn.addEventListener('click', function() {
          _handlePrescriberAlert(p);
        });
      }
      if (trajectBtn) {
        trajectBtn.addEventListener('click', function() {
          _handleViewTrajectory(p);
        });
      }
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
          triggerRiskRefresh(p.session_id, workspaceKey);
        });
      }
    });
  }

  // Wire filter controls
  ['pe-filter-tier','pe-filter-condition','pe-filter-sort'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', _applyFilters);
  });

  _applyFilters();
}

function _buildPatientCardHTML(p, workspaceKey) {
  var tier   = _RISK_TIERS[p.risk_tier] || _RISK_TIERS.unscored;
  var riskPct = p.dropout_risk != null ? Math.round(p.dropout_risk * 100) : null;

  var cardClass = 'pe-patient-card' + (tier.pulse ? ' pe-pulse' : '');
  var cardStyle = 'border-color:' + tier.border + ';background:' + tier.bg + ';';

  var badgeStyle = 'color:' + tier.color + ';border-color:' + tier.color + ';background:rgba(' +
    _peHexToRgbStr(tier.color) + ',0.1);';

  var peTrajArr = p.pe_trajectory || [];
  var trajStr   = p.current_pe != null ? _fmtTraj([p.baseline_pe, p.current_pe]) : 'n/a';
  var trendStr  = p.baseline_pe != null && p.current_pe != null
    ? _trendArrow([p.baseline_pe, p.current_pe])
    : '';

  var signalLabel = _SIGNAL_LABELS[p.primary_signal] || (p.primary_signal || 'Not scored');
  var interventionLabel = _INTERVENTION_LABELS[p.intervention_type] || 'See assessment';

  var html = [
    '<div class="' + cardClass + '" id="pe-card-' + _peEsc(p.session_id) + '" style="' + cardStyle + '">',

    // Header
    '<div class="pe-patient-card-header">',
    '<div class="pe-patient-id-block">',
    '<div class="pe-patient-number">Patient #' + _peEsc(p.patient_number) + '</div>',
    '<div class="pe-patient-condition">' + _peEsc(p.condition || 'Condition not specified') + '</div>',
    '</div>',
    '<div class="pe-risk-badge" style="' + badgeStyle + '">' + tier.label + '</div>',
    '</div>',

    // Metrics grid
    '<div class="pe-card-metrics">',
    _metricCell('Risk Score', riskPct != null ? riskPct + '%' : 'Unscored', tier.color),
    _metricCell('Primary Signal', signalLabel, '#e8f0f8'),
    _metricCell('Current PE', p.current_pe != null ? p.current_pe.toFixed(3) : 'n/a', '#d4a843'),
    _metricCell('Assessments', String(p.assessment_count || 0), '#6b8099'),
    '</div>',

    // PE trajectory line
    '<div class="pe-traj-line">',
    'PE Trajectory: ' + _peEsc(trajStr),
    trendStr ? '<span class="pe-traj-direction">(' + _peEsc(trendStr) + ')</span>' : '',
    '</div>',

    // Dropout estimate row
    p.days_to_dropout != null && p.risk_tier === 'high'
      ? '<div class="pe-intervention-tag">Estimated dropout: <strong>~' + _peEsc(String(p.days_to_dropout)) + ' days</strong></div>'
      : '',

    // Intervention
    '<div class="pe-intervention-tag">Recommended intervention: <strong>' + _peEsc(interventionLabel) + '</strong></div>',

    // Last assessment date
    '<div class="pe-intervention-tag" style="margin-top:4px;">Last assessment: ' + _peEsc(_fmtDate(p.last_assessment_date)) + '</div>',

    // Action buttons
    '<div class="pe-card-actions">',
    p.risk_tier === 'high'
      ? '<button class="pe-action-btn primary" id="pe-btn-alert-' + _peEsc(p.session_id) + '">Request Prescriber Alert</button>'
      : '',
    '<button class="pe-action-btn secondary" id="pe-btn-traj-' + _peEsc(p.session_id) + '">View Full Trajectory</button>',
    '<button class="pe-action-btn secondary" id="pe-btn-refresh-' + _peEsc(p.session_id) + '">Refresh Risk Score</button>',
    '</div>',

    '</div>', // .pe-patient-card
  ].join('');

  return html;
}

function _metricCell(label, value, color) {
  return [
    '<div class="pe-metric">',
    '<div class="pe-metric-label">' + _peEsc(label) + '</div>',
    '<div class="pe-metric-value" style="color:' + color + ';">' + _peEsc(value) + '</div>',
    '</div>',
  ].join('');
}

function _handlePrescriberAlert(patient) {
  // Extension point: emit a custom DOM event for the host application to handle.
  // The host app can attach a listener to trigger an in-app alert workflow,
  // send a push notification, or open a prescriber communication dialog.
  var event = new CustomEvent('atlas:prescriberAlert', {
    bubbles: true,
    detail: {
      session_id:     patient.session_id,
      patient_number: patient.patient_number,
      condition:      patient.condition,
      dropout_risk:   patient.dropout_risk,
      primary_signal: patient.primary_signal,
    },
  });
  document.dispatchEvent(event);

  // Visual feedback
  var btn = document.getElementById('pe-btn-alert-' + patient.session_id);
  if (btn) {
    btn.textContent = 'Alert Requested';
    btn.style.background = 'rgba(16,185,129,0.12)';
    btn.style.borderColor = 'rgba(16,185,129,0.4)';
    btn.style.color = '#10b981';
    btn.disabled = true;
  }
}

function _handleViewTrajectory(patient) {
  // Emit custom event so the host app can open a modal or navigate to a detail view
  var event = new CustomEvent('atlas:viewTrajectory', {
    bubbles: true,
    detail: { session_id: patient.session_id },
  });
  document.dispatchEvent(event);
}

// ══════════════════════════════════════════════════════════════════════════════
// renderPatientTrajectoryChart(containerId, sessionId)
//
// Draws a multi-line SVG chart showing MAP domain scores over time.
// Pure SVG, no external charting libraries.
// ══════════════════════════════════════════════════════════════════════════════
function renderPatientTrajectoryChart(containerId, sessionId) {
  _injectPEStyles();

  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderPatientTrajectoryChart: container not found:', containerId);
    return;
  }

  container.innerHTML = '<div class="pe-chart-wrap"><div class="pe-loading"><div class="pe-spinner"></div>Loading trajectory...</div></div>';

  _peFetch('/map/session/' + encodeURIComponent(sessionId))
    .then(function(resp) { return resp.json(); })
    .then(function(json) {
      if (!json.ok) throw new Error(json.error || 'API error');

      // Also attempt to load prediction data for risk zone shading
      return _peFetch('/map/predict-dropout', {
        method: 'POST',
        body: JSON.stringify({
          session_id:    sessionId,
          workspace_key: json.data.session.workspace_key,
        }),
      }).then(function(predResp) {
        return predResp.json().then(function(predJson) {
          return { session: json.data, prediction: predJson.ok ? predJson.data : null };
        }).catch(function() {
          return { session: json.data, prediction: null };
        });
      }).catch(function() {
        return { session: json.data, prediction: null };
      });
    })
    .then(function(result) {
      _drawTrajectoryChart(container, result.session, result.prediction);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="pe-chart-wrap"><div class="pe-no-patients">Failed to load trajectory: ' + _peEsc(err.message) + '</div></div>';
    });
}

function _drawTrajectoryChart(container, sessionData, predData) {
  var archArr = sessionData.arch_trajectory || [];
  var execArr = sessionData.exec_trajectory || [];
  var ctxArr  = sessionData.ctx_trajectory  || [];
  var peArr   = sessionData.pe_trajectory   || [];
  var session = sessionData.session || {};

  var n = Math.max(archArr.length, peArr.length);

  if (n < 1) {
    container.innerHTML = '<div class="pe-chart-wrap"><div class="pe-no-patients">No trajectory data available yet.</div></div>';
    return;
  }

  // Chart dimensions
  var W = 640, H = 280;
  var PAD = { top: 20, right: 60, bottom: 40, left: 48 };
  var chartW = W - PAD.left - PAD.right;
  var chartH = H - PAD.top  - PAD.bottom;

  // Dropout risk from prediction
  var riskScore = predData && predData.prediction ? predData.prediction.risk_score : null;
  var showRiskZone = riskScore != null && riskScore > 0.5;

  // X axis: evenly spaced assessment points
  function xPos(i) {
    if (n === 1) return PAD.left + chartW / 2;
    return PAD.left + (i / (n - 1)) * chartW;
  }

  // Y axis: 0 to 1
  function yPos(v) {
    return PAD.top + chartH - (v * chartH);
  }

  // Build SVG polyline points string from a score array
  function buildPoints(arr) {
    return arr.map(function(v, i) {
      return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1);
    }).join(' ');
  }

  // Generate X axis date labels from assessments if available
  var assessments = sessionData.assessments || [];
  var xLabels = [];
  for (var i = 0; i < n; i++) {
    if (assessments[i] && assessments[i].submitted_at) {
      var d = new Date(assessments[i].submitted_at);
      xLabels.push(isNaN(d.getTime()) ? ('Visit ' + (i+1)) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    } else {
      xLabels.push('Visit ' + (i + 1));
    }
  }

  // Y axis grid lines at 0, 0.25, 0.50, 0.75, 1.0
  var yGridValues = [0, 0.25, 0.5, 0.75, 1.0];

  var svgParts = [
    '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-width:' + W + 'px;" xmlns="http://www.w3.org/2000/svg">',

    // Defs: risk zone gradient
    '<defs>',
    '<linearGradient id="pe-risk-gradient" x1="0" x2="0" y1="0" y2="1">',
    '<stop offset="0%" stop-color="#ef4444" stop-opacity="0.15"/>',
    '<stop offset="100%" stop-color="#ef4444" stop-opacity="0.04"/>',
    '</linearGradient>',
    '</defs>',

    // Background
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#111d30"/>',
  ];

  // Y axis grid lines
  yGridValues.forEach(function(v) {
    var y = yPos(v).toFixed(1);
    svgParts.push(
      '<line x1="' + PAD.left + '" y1="' + y + '" x2="' + (PAD.left + chartW) + '" y2="' + y + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>',
      '<text x="' + (PAD.left - 6) + '" y="' + y + '" fill="#6b8099" font-size="9" font-family="IBM Plex Mono,monospace" text-anchor="end" dominant-baseline="middle">' + v.toFixed(2) + '</text>'
    );
  });

  // Threshold line at 0.5 (clinical alert)
  var threshY = yPos(0.5).toFixed(1);
  svgParts.push(
    '<line x1="' + PAD.left + '" y1="' + threshY + '" x2="' + (PAD.left + chartW) + '" y2="' + threshY + '" stroke="#ef4444" stroke-width="1" stroke-dasharray="5,3" opacity="0.55"/>',
    '<text x="' + (PAD.left + chartW + 4) + '" y="' + threshY + '" fill="#ef4444" font-size="8" font-family="IBM Plex Mono,monospace" dominant-baseline="middle" opacity="0.8">0.50</text>'
  );

  // Dropout risk zone shading (right 25% of chart if risk > 0.5)
  if (showRiskZone) {
    var zoneX = PAD.left + chartW * 0.75;
    svgParts.push(
      '<rect x="' + zoneX.toFixed(1) + '" y="' + PAD.top + '" width="' + (chartW * 0.25).toFixed(1) + '" height="' + chartH + '" fill="url(#pe-risk-gradient)"/>',
      '<text x="' + (PAD.left + chartW - 4) + '" y="' + (PAD.top + 10) + '" fill="#ef4444" font-size="8" font-family="IBM Plex Mono,monospace" text-anchor="end" opacity="0.7">RISK ZONE</text>'
    );
  }

  // Domain lines (drawn behind PE)
  if (archArr.length > 1) {
    svgParts.push(
      '<polyline points="' + buildPoints(archArr) + '" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.7"/>'
    );
  } else if (archArr.length === 1) {
    svgParts.push('<circle cx="' + xPos(0).toFixed(1) + '" cy="' + yPos(archArr[0]).toFixed(1) + '" r="3" fill="#f59e0b" opacity="0.7"/>');
  }

  if (execArr.length > 1) {
    svgParts.push(
      '<polyline points="' + buildPoints(execArr) + '" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.7"/>'
    );
  } else if (execArr.length === 1) {
    svgParts.push('<circle cx="' + xPos(0).toFixed(1) + '" cy="' + yPos(execArr[0]).toFixed(1) + '" r="3" fill="#22d3ee" opacity="0.7"/>');
  }

  if (ctxArr.length > 1) {
    svgParts.push(
      '<polyline points="' + buildPoints(ctxArr) + '" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.7"/>'
    );
  } else if (ctxArr.length === 1) {
    svgParts.push('<circle cx="' + xPos(0).toFixed(1) + '" cy="' + yPos(ctxArr[0]).toFixed(1) + '" r="3" fill="#a78bfa" opacity="0.7"/>');
  }

  // PE composite line (dashed gold, drawn on top)
  if (peArr.length > 1) {
    svgParts.push(
      '<polyline points="' + buildPoints(peArr) + '" fill="none" stroke="#d4a843" stroke-width="2" stroke-dasharray="6,3"/>'
    );
  } else if (peArr.length === 1) {
    svgParts.push('<circle cx="' + xPos(0).toFixed(1) + '" cy="' + yPos(peArr[0]).toFixed(1) + '" r="4" fill="#d4a843"/>');
  }

  // Data point dots and annotation on most recent PE point
  peArr.forEach(function(v, i) {
    var cx = xPos(i).toFixed(1);
    var cy = yPos(v).toFixed(1);
    svgParts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#d4a843" stroke="#111d30" stroke-width="1.5"/>');

    // Annotation on the last point
    if (i === peArr.length - 1) {
      var labelX = parseFloat(cx) + 8;
      var labelY = parseFloat(cy) - 10;
      // Keep label within chart bounds
      if (labelX + 80 > W - PAD.right) labelX = parseFloat(cx) - 90;
      svgParts.push(
        '<rect x="' + labelX + '" y="' + (labelY - 12) + '" width="80" height="18" rx="4" fill="#111d30" stroke="#d4a843" stroke-width="0.8" opacity="0.92"/>',
        '<text x="' + (labelX + 40) + '" y="' + (labelY - 1) + '" fill="#d4a843" font-size="8.5" font-family="IBM Plex Mono,monospace" text-anchor="middle">Current PE: ' + v.toFixed(3) + '</text>'
      );
    }
  });

  // X axis labels
  xLabels.forEach(function(label, i) {
    var x = xPos(i).toFixed(1);
    svgParts.push(
      '<text x="' + x + '" y="' + (PAD.top + chartH + 16) + '" fill="#6b8099" font-size="8" font-family="IBM Plex Mono,monospace" text-anchor="middle">' + _peEsc(label) + '</text>'
    );
    // Tick mark
    svgParts.push(
      '<line x1="' + x + '" y1="' + (PAD.top + chartH) + '" x2="' + x + '" y2="' + (PAD.top + chartH + 4) + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>'
    );
  });

  // Y axis label (rotated)
  svgParts.push(
    '<text x="' + (PAD.left - 36) + '" y="' + (PAD.top + chartH / 2) + '" fill="#6b8099" font-size="8" font-family="IBM Plex Mono,monospace" text-anchor="middle" transform="rotate(-90,' + (PAD.left - 36) + ',' + (PAD.top + chartH / 2) + ')">SCORE (0-1)</text>'
  );

  svgParts.push('</svg>');

  var patientLabel = session.patient_number
    ? 'Patient #' + String(session.patient_number).slice(-4).padStart(String(session.patient_number).length, '\u00B7')
    : 'Session';

  var legendHtml = [
    '<div class="pe-chart-legend">',
    '<div class="pe-legend-item"><div class="pe-legend-swatch" style="background:#f59e0b;height:2px;width:20px;"></div>Architecture</div>',
    '<div class="pe-legend-item"><div class="pe-legend-swatch" style="background:#22d3ee;height:2px;width:20px;"></div>Execution</div>',
    '<div class="pe-legend-item"><div class="pe-legend-swatch" style="background:#a78bfa;height:2px;width:20px;"></div>Context-Guard</div>',
    '<div class="pe-legend-item"><div class="pe-legend-swatch dashed" style="background:none;border-top:2px dashed #d4a843;width:20px;"></div>PE Composite</div>',
    '<div class="pe-legend-item"><div class="pe-legend-swatch" style="background:none;border-top:1px dashed #ef4444;width:20px;opacity:0.7;"></div>0.50 Threshold</div>',
    showRiskZone ? '<div class="pe-legend-item"><div class="pe-legend-swatch" style="background:rgba(239,68,68,0.3);width:20px;height:10px;border-radius:2px;"></div>Dropout Risk Zone</div>' : '',
    '</div>',
  ].join('');

  var riskNote = predData && predData.prediction
    ? '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;color:#6b8099;">Dropout risk: <span style="color:' +
      (riskScore >= 0.70 ? '#ef4444' : riskScore >= 0.40 ? '#f59e0b' : '#10b981') + ';font-weight:700;">' +
      Math.round(riskScore * 100) + '%</span> &middot; ' + _peEsc(predData.prediction.confidence) + ' confidence &middot; ' +
      _peEsc(_SIGNAL_LABELS[predData.prediction.primary_signal] || predData.prediction.primary_signal) + '</div>'
    : '';

  container.innerHTML = [
    '<div class="pe-chart-wrap">',
    '<div class="pe-chart-title">MAP Domain Trajectory &middot; ' + _peEsc(patientLabel) + (session.condition ? ' &middot; ' + _peEsc(session.condition) : '') + '</div>',
    svgParts.join(''),
    legendHtml,
    riskNote,
    '</div>',
  ].join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// triggerRiskRefresh(sessionId, workspaceKey)
//
// Calls the predict-dropout endpoint, shows a loading state on the patient
// card, and updates the card on completion. Intended to be called after a
// new MAP assessment is submitted for an existing longitudinal session.
// ══════════════════════════════════════════════════════════════════════════════
function triggerRiskRefresh(sessionId, workspaceKey) {
  // Update the refresh button to show loading
  var refreshBtn = document.getElementById('pe-btn-refresh-' + sessionId);
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = 'Refreshing<span class="pe-refresh-spinner"></span>';
  }

  _peFetch('/map/predict-dropout', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, workspace_key: workspaceKey }),
  })
    .then(function(resp) { return resp.json(); })
    .then(function(json) {
      if (!json.ok) throw new Error(json.error || 'Prediction failed');

      var data = json.data;
      var prediction = data.prediction || {};
      var sessionMeta = data.session || {};

      // Update the patient card in place if it exists in the DOM
      var card = document.getElementById('pe-card-' + sessionId);
      if (card) {
        var riskScore = prediction.risk_score;
        var tier = _RISK_TIERS[_peRiskTier(riskScore)] || _RISK_TIERS.unscored;

        // Update card border and background
        card.style.borderColor = tier.border;
        card.style.background  = tier.bg;
        if (tier.pulse) {
          card.classList.add('pe-pulse');
        } else {
          card.classList.remove('pe-pulse');
        }

        // Update the risk badge text
        var badge = card.querySelector('.pe-risk-badge');
        if (badge) {
          badge.textContent = tier.label;
          badge.style.color = tier.color;
          badge.style.borderColor = tier.color;
        }

        // Update metric values inline
        var metrics = card.querySelectorAll('.pe-metric');
        if (metrics && metrics.length >= 2) {
          var riskMetric = metrics[0].querySelector('.pe-metric-value');
          var signalMetric = metrics[1] ? metrics[1].querySelector('.pe-metric-value') : null;

          if (riskMetric && riskScore != null) {
            riskMetric.textContent = Math.round(riskScore * 100) + '%';
            riskMetric.style.color = tier.color;
          }
          if (signalMetric && prediction.primary_signal) {
            signalMetric.textContent = _SIGNAL_LABELS[prediction.primary_signal] || prediction.primary_signal;
          }
        }
      }

      // Re-enable the refresh button
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Risk Score';
      }

      // Dispatch event so the host app can react to the updated risk
      var event = new CustomEvent('atlas:riskRefreshed', {
        bubbles: true,
        detail: {
          session_id:  sessionId,
          risk_score:  prediction.risk_score,
          risk_tier:   _peRiskTier(prediction.risk_score),
          primary_signal: prediction.primary_signal,
          prediction:  prediction,
        },
      });
      document.dispatchEvent(event);

      return data;
    })
    .catch(function(err) {
      console.error('triggerRiskRefresh failed:', err.message);
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Retry Refresh';
      }
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// renderRiskSummaryWidget(containerId, workspaceKey)
//
// Compact widget for embedding in the main ATLAS dashboard.
// Shows total monitored patients, high-risk and elevated counts,
// and a link to the full risk dashboard.
// ══════════════════════════════════════════════════════════════════════════════
function renderRiskSummaryWidget(containerId, workspaceKey) {
  _injectPEStyles();

  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderRiskSummaryWidget: container not found:', containerId);
    return;
  }

  container.innerHTML = [
    '<div class="pe-widget">',
    '<div class="pe-widget-title">Dropout Risk Monitor</div>',
    '<div class="pe-loading"><div class="pe-spinner"></div>Loading...</div>',
    '</div>',
  ].join('');

  _peFetch('/map/risk-dashboard/' + encodeURIComponent(workspaceKey))
    .then(function(resp) { return resp.json(); })
    .then(function(json) {
      if (!json.ok) throw new Error(json.error || 'API error');
      var d = json.data;
      var summary = d.summary || {};
      var highRisk = summary.high_risk || 0;

      var highStyle = 'color:' + (highRisk > 0 ? '#ef4444' : '#10b981') + ';';

      var html = [
        '<div class="pe-widget">',
        '<div class="pe-widget-title">Dropout Risk Monitor</div>',
        '<div class="pe-widget-grid">',
        _widgetStat(String(d.total_patients || 0), 'Monitored', '#e8f0f8'),
        _widgetStat(String(highRisk), 'High Risk', highRisk > 0 ? '#ef4444' : '#10b981'),
        _widgetStat(String(summary.elevated_risk || 0), 'Elevated', summary.elevated_risk > 0 ? '#f59e0b' : '#6b8099'),
        '</div>',
        '<button class="pe-widget-btn" id="pe-widget-view-btn-' + _peEsc(workspaceKey) + '">View Risk Dashboard</button>',
        '</div>',
      ].join('');

      container.innerHTML = html;

      var viewBtn = document.getElementById('pe-widget-view-btn-' + workspaceKey);
      if (viewBtn) {
        viewBtn.addEventListener('click', function() {
          var event = new CustomEvent('atlas:openRiskDashboard', {
            bubbles: true,
            detail: { workspace_key: workspaceKey },
          });
          document.dispatchEvent(event);
        });
      }
    })
    .catch(function(err) {
      container.innerHTML = [
        '<div class="pe-widget">',
        '<div class="pe-widget-title">Dropout Risk Monitor</div>',
        '<div class="pe-no-patients" style="padding:16px 0;">Unable to load: ' + _peEsc(err.message) + '</div>',
        '</div>',
      ].join('');
    });
}

function _widgetStat(value, label, color) {
  return [
    '<div class="pe-widget-stat">',
    '<div class="pe-widget-num" style="color:' + color + ';">' + _peEsc(value) + '</div>',
    '<div class="pe-widget-label">' + _peEsc(label) + '</div>',
    '</div>',
  ].join('');
}

// ── Internal utility: hex color to "r,g,b" string ─────────────────────────
function _peHexToRgbStr(hex) {
  var h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}

window.renderDropoutRiskDashboard = renderDropoutRiskDashboard;
