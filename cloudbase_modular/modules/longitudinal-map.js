'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// LONGITUDINAL MAP TRACKING DASHBOARD — ATLAS v8.7.0
// Multidimensional Adherence Parameters (MAP) — Session Trajectory Engine
// Created by Philip Morisky
//
// Depends on: map-assessment.js (scoreMAP, classifyPEACS, _mapPeColor, _mapEsc)
//             peacs-core.js     (peColor, lerpHex)
//             Firebase Realtime Database (global: database)
//
// Global scope pattern — no imports/exports. All functions are globals.
//
// Design tokens:
//   --ink:#080e1a  --surface:#0d1525  --card:#111d30
//   --border:rgba(255,255,255,0.07)  --bright:#e8f0f8
//   --muted:#6b8099  --base:#4e9cf5  --pe:#d4a843
//
// Domain colors: Architecture #d4a843 | Execution #4e9cf5 | Context-Guard #8b6ff5
// Fonts: Cormorant Garamond (display) | IBM Plex Sans (body) | IBM Plex Mono (labels/numbers)
// Charts: pure SVG, no external charting libraries
// ══════════════════════════════════════════════════════════════════════════════

// ── Color constants ───────────────────────────────────────────────────────────
var LM_COLORS = {
  ink:          '#080e1a',
  surface:      '#0d1525',
  card:         '#111d30',
  border:       'rgba(255,255,255,0.07)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  pe:           '#d4a843',
  architecture: '#d4a843',
  execution:    '#4e9cf5',
  context:      '#8b6ff5',
  improving:    '#10b981',
  declining:    '#ef4444',
  stable:       '#6b8099',
  threshold:    '#ef4444',
};

// Intervention type display labels
var LM_INTERVENTION_LABELS = {
  belief_restructuring:    'Belief restructuring',
  habit_support:           'Habit support',
  prescriber_consultation: 'Prescriber consult',
  regimen_simplification:  'Regimen simplification',
  access_support:          'Access support',
  side_effect_management:  'Side-effect mgmt',
  other:                   'Intervention',
};

// ── CSS injection (idempotent) ────────────────────────────────────────────────
function _lmInjectStyles() {
  if (document.getElementById('lm-styles')) return;
  var style = document.createElement('style');
  style.id = 'lm-styles';
  style.textContent = [
    // Root layout
    '.lm-root{font-family:"IBM Plex Sans",sans-serif;color:#e8f0f8;background:#0d1525;min-height:100%;padding:24px;box-sizing:border-box;}',
    '.lm-root *,.lm-root *::before,.lm-root *::after{box-sizing:border-box;}',

    // Header
    '.lm-header{margin-bottom:28px;}',
    '.lm-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:2rem;font-weight:300;color:#e8f0f8;margin:0 0 4px;letter-spacing:0.01em;}',
    '.lm-subtitle{font-family:"IBM Plex Mono",monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:#6b8099;}',

    // Stats row
    '.lm-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}',
    '@media(max-width:720px){.lm-stats-row{grid-template-columns:repeat(2,1fr);}}',
    '@media(max-width:420px){.lm-stats-row{grid-template-columns:1fr;}}',
    '.lm-stat-card{background:#111d30;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;}',
    '.lm-stat-label{font-family:"IBM Plex Mono",monospace;font-size:0.63rem;letter-spacing:0.14em;text-transform:uppercase;color:#6b8099;margin-bottom:6px;}',
    '.lm-stat-value{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.9rem;font-weight:300;color:#e8f0f8;line-height:1;}',
    '.lm-stat-value.positive{color:#10b981;}',
    '.lm-stat-value.negative{color:#ef4444;}',

    // Filter bar
    '.lm-filter-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;}',
    '.lm-filter-label{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;}',
    '.lm-filter-select{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;background:#111d30;color:#e8f0f8;border:1px solid rgba(255,255,255,0.12);border-radius:7px;padding:8px 28px 8px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%236b8099\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;}',
    '.lm-filter-select:focus{outline:none;border-color:#4e9cf5;}',
    '.lm-result-count{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#6b8099;margin-left:auto;}',

    // Session cards grid
    '.lm-cards-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}',
    '@media(max-width:800px){.lm-cards-grid{grid-template-columns:1fr;}}',

    // Session card
    '.lm-session-card{background:#111d30;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;transition:border-color 0.2s;}',
    '.lm-session-card:hover{border-color:rgba(255,255,255,0.14);}',
    '.lm-session-card.declining{border-left:3px solid #ef4444;}',
    '.lm-session-card.improving{border-left:3px solid #10b981;}',
    '.lm-session-card.stable{border-left:3px solid #6b8099;}',

    // Card header
    '.lm-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}',
    '.lm-patient-id{font-family:"IBM Plex Mono",monospace;font-size:1rem;color:#e8f0f8;}',
    '.lm-patient-condition{font-family:"IBM Plex Mono",monospace;font-size:0.63rem;letter-spacing:0.1em;text-transform:uppercase;color:#6b8099;margin-top:3px;}',

    // Status badge
    '.lm-status-badge{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid;flex-shrink:0;}',
    '.lm-status-badge.improving{color:#10b981;border-color:#10b981;background:rgba(16,185,129,0.08);}',
    '.lm-status-badge.declining{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,0.08);}',
    '.lm-status-badge.stable{color:#6b8099;border-color:#6b8099;background:rgba(107,128,153,0.08);}',

    // PE delta row
    '.lm-pe-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}',
    '.lm-pe-baseline{font-family:"IBM Plex Mono",monospace;font-size:0.68rem;color:#6b8099;}',
    '.lm-pe-arrow{color:#6b8099;font-size:0.8rem;}',
    '.lm-pe-current{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.6rem;font-weight:300;line-height:1;}',
    '.lm-pe-delta{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;padding:2px 7px;border-radius:4px;}',
    '.lm-pe-delta.pos{color:#10b981;background:rgba(16,185,129,0.1);}',
    '.lm-pe-delta.neg{color:#ef4444;background:rgba(239,68,68,0.1);}',
    '.lm-pe-delta.zero{color:#6b8099;background:rgba(107,128,153,0.1);}',

    // Domain mini-bars
    '.lm-domain-mini{display:flex;gap:6px;align-items:center;}',
    '.lm-domain-mini-label{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.1em;color:#6b8099;width:26px;flex-shrink:0;}',
    '.lm-domain-mini-track{flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;}',
    '.lm-domain-mini-fill{height:4px;border-radius:2px;}',
    '.lm-domain-mini-val{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;color:#6b8099;width:36px;text-align:right;flex-shrink:0;}',

    // Card phenotype
    '.lm-card-phenotype{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#6b8099;padding:4px 10px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;display:inline-block;}',

    // Buttons
    '.lm-card-actions{display:flex;gap:8px;flex-wrap:wrap;}',
    '.lm-btn{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;padding:8px 14px;border-radius:7px;border:1px solid;cursor:pointer;transition:opacity 0.15s,background 0.15s;white-space:nowrap;}',
    '.lm-btn-primary{background:#4e9cf5;color:#080e1a;border-color:#4e9cf5;font-weight:700;}',
    '.lm-btn-primary:hover{opacity:0.85;}',
    '.lm-btn-ghost{background:transparent;color:#6b8099;border-color:rgba(255,255,255,0.12);}',
    '.lm-btn-ghost:hover{color:#e8f0f8;border-color:rgba(255,255,255,0.25);}',
    '.lm-btn-amber{background:transparent;color:#d4a843;border-color:rgba(212,168,67,0.3);}',
    '.lm-btn-amber:hover{background:rgba(212,168,67,0.08);}',

    // Empty / loading
    '.lm-empty{text-align:center;padding:60px 24px;}',
    '.lm-empty-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.4rem;font-weight:300;color:#e8f0f8;margin-bottom:8px;}',
    '.lm-empty-sub{font-family:"IBM Plex Mono",monospace;font-size:0.68rem;color:#6b8099;}',
    '.lm-loading{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;color:#6b8099;padding:40px 0;text-align:center;}',

    // Trajectory view root
    '.lm-traj-root{font-family:"IBM Plex Sans",sans-serif;color:#e8f0f8;}',
    '.lm-traj-header{margin-bottom:20px;}',
    '.lm-traj-patient-id{font-family:"IBM Plex Mono",monospace;font-size:1.3rem;color:#e8f0f8;}',
    '.lm-traj-meta{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#6b8099;margin-top:5px;display:flex;gap:18px;flex-wrap:wrap;}',

    // Chart
    '.lm-chart-wrap{width:100%;overflow-x:auto;margin-bottom:24px;}',
    '.lm-chart-svg{display:block;width:100%;}',

    // Legend
    '.lm-chart-legend{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;padding-left:4px;}',
    '.lm-legend-item{display:flex;align-items:center;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#6b8099;}',
    '.lm-legend-line{width:24px;height:2px;border-radius:1px;flex-shrink:0;}',
    '.lm-legend-line.dashed{background:transparent;border-top:2px dashed;}',

    // Assessment table
    '.lm-table-wrap{overflow-x:auto;margin-bottom:24px;}',
    '.lm-table{width:100%;border-collapse:collapse;font-family:"IBM Plex Mono",monospace;font-size:0.72rem;}',
    '.lm-table th{text-align:left;padding:10px 12px;color:#6b8099;font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.07);font-weight:400;}',
    '.lm-table td{padding:10px 12px;color:#e8f0f8;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;}',
    '.lm-table tr:last-child td{border-bottom:none;}',
    '.lm-table tr.baseline td{color:#6b8099;}',
    '.lm-table .delta-pos{color:#10b981;}',
    '.lm-table .delta-neg{color:#ef4444;}',
    '.lm-table .delta-zero{color:#6b8099;}',
    '.lm-phenotype-pill{display:inline-block;padding:2px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);font-size:0.6rem;letter-spacing:0.08em;white-space:nowrap;}',

    // Effectiveness analysis
    '.lm-analysis-section{background:#111d30;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px 22px;margin-bottom:24px;}',
    '.lm-analysis-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.2rem;font-weight:300;color:#e8f0f8;margin-bottom:16px;}',
    '.lm-analysis-row{display:flex;align-items:flex-start;gap:16px;margin-bottom:14px;flex-wrap:wrap;}',
    '.lm-analysis-label{font-family:"IBM Plex Mono",monospace;font-size:0.63rem;letter-spacing:0.1em;text-transform:uppercase;color:#6b8099;min-width:160px;padding-top:2px;}',
    '.lm-analysis-value{font-family:"IBM Plex Sans",sans-serif;font-size:0.88rem;color:#e8f0f8;flex:1;}',
    '.lm-match-badge{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;padding:4px 12px;border-radius:20px;border:1px solid;}',
    '.lm-match-badge.confirmed{color:#10b981;border-color:#10b981;background:rgba(16,185,129,0.08);}',
    '.lm-match-badge.mismatch{color:#d4a843;border-color:#d4a843;background:rgba(212,168,67,0.08);}',
    '.lm-flag-amber{color:#d4a843;}',

    // Phenotype timeline
    '.lm-pheno-timeline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;}',
    '.lm-pheno-badge{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.08em;padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.15);color:#e8f0f8;white-space:nowrap;}',
    '.lm-pheno-badge.first{border-color:rgba(212,168,67,0.4);background:rgba(212,168,67,0.05);}',
    '.lm-pheno-badge.last{border-color:rgba(78,156,245,0.4);background:rgba(78,156,245,0.05);}',
    '.lm-pheno-arrow{color:#6b8099;font-size:0.9rem;flex-shrink:0;}',

    // Publication report
    '.lm-report-root{font-family:"IBM Plex Sans",sans-serif;color:#e8f0f8;}',
    '.lm-report-header{margin-bottom:28px;}',
    '.lm-report-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.8rem;font-weight:300;color:#e8f0f8;margin-bottom:4px;}',
    '.lm-report-meta{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#6b8099;}',
    '.lm-evidence-badge{display:inline-flex;align-items:center;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:0.68rem;padding:6px 14px;border-radius:7px;border:1px solid;margin-bottom:20px;}',
    '.lm-evidence-badge.strong{color:#10b981;border-color:#10b981;background:rgba(16,185,129,0.08);}',
    '.lm-evidence-badge.moderate{color:#d4a843;border-color:#d4a843;background:rgba(212,168,67,0.08);}',
    '.lm-evidence-badge.insufficient{color:#6b8099;border-color:#6b8099;background:rgba(107,128,153,0.08);}',
    '.lm-report-summary-table{width:100%;border-collapse:collapse;font-family:"IBM Plex Mono",monospace;font-size:0.72rem;margin-bottom:24px;}',
    '.lm-report-summary-table th{text-align:left;padding:10px 14px;color:#6b8099;font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:400;}',
    '.lm-report-summary-table td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,0.04);}',
    '.lm-report-section-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.2rem;font-weight:300;color:#e8f0f8;margin:24px 0 14px;}',
    '.lm-response-rate-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}',
    '.lm-rr-label{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#e8f0f8;width:140px;flex-shrink:0;}',
    '.lm-rr-track{flex:1;height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;}',
    '.lm-rr-fill{height:8px;border-radius:4px;}',
    '.lm-rr-val{font-family:"IBM Plex Mono",monospace;font-size:0.65rem;color:#6b8099;width:40px;text-align:right;flex-shrink:0;}',
    '.lm-transition-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;}',
    '.lm-tr-label{font-family:"IBM Plex Mono",monospace;font-size:0.62rem;color:#e8f0f8;width:260px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.lm-tr-track{flex:1;height:14px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;}',
    '.lm-tr-fill{height:14px;border-radius:4px;background:rgba(78,156,245,0.4);}',
    '.lm-tr-val{font-family:"IBM Plex Mono",monospace;font-size:0.62rem;color:#6b8099;width:32px;text-align:right;flex-shrink:0;}',
    '.lm-key-finding{background:rgba(78,156,245,0.05);border:1px solid rgba(78,156,245,0.15);border-radius:10px;padding:18px 20px;margin-bottom:24px;}',
    '.lm-key-finding-label{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:#4e9cf5;margin-bottom:10px;}',
    '.lm-key-finding-text{font-family:"IBM Plex Sans",sans-serif;font-size:0.95rem;color:#e8f0f8;line-height:1.65;}',
  ].join('\n');
  document.head.appendChild(style);
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function _lmEsc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function _lmFmtDate(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function _lmFmtDateFull(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function _lmMaskPatient(patientNumber) {
  if (!patientNumber) return '....----';
  var s = String(patientNumber);
  return '.' + s.slice(-4);
}

function _lmDelta(current, prior) {
  if (prior === null || prior === undefined) return null;
  return parseFloat((current - prior).toFixed(3));
}

function _lmDeltaStr(delta) {
  if (delta === null || delta === undefined) return '--';
  if (delta > 0) return '+' + delta.toFixed(3);
  return delta.toFixed(3);
}

function _lmDeltaClass(delta) {
  if (delta === null || delta === undefined) return 'delta-zero';
  if (delta > 0.001)  return 'delta-pos';
  if (delta < -0.001) return 'delta-neg';
  return 'delta-zero';
}

function _lmTrajStatus(session) {
  var baseline = parseFloat(session.baseline_pe) || 0;
  var latest   = parseFloat(session.latest_pe)   || 0;
  var diff = latest - baseline;
  if (diff >= 0.10)  return 'improving';
  if (diff <= -0.10) return 'declining';
  return 'stable';
}

function _lmSafeArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch(e) { return []; }
}

function _lmDaysBetween(tsA, tsB) {
  return Math.round(Math.abs(tsB - tsA) / 86400000);
}

// Firebase read, returns Promise<value|null>
function _lmFbGet(path) {
  return new Promise(function(resolve, reject) {
    if (typeof database === 'undefined' || !database) { resolve(null); return; }
    database.ref(path).once('value', function(snap) {
      resolve(snap.val());
    }, function(err) { reject(err); });
  });
}

// Firebase push with auto-ID, returns Promise<pushKey>
function _lmFbPush(path, data) {
  return new Promise(function(resolve, reject) {
    if (typeof database === 'undefined' || !database) {
      reject(new Error('Firebase database not available'));
      return;
    }
    var ref = database.ref(path).push();
    ref.set(data, function(err) {
      if (err) reject(err);
      else resolve(ref.key);
    });
  });
}

// Firebase set at explicit path, returns Promise<true>
function _lmFbSet(path, data) {
  return new Promise(function(resolve, reject) {
    if (typeof database === 'undefined' || !database) {
      reject(new Error('Firebase database not available'));
      return;
    }
    database.ref(path).set(data, function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

// PE color: delegates to map-assessment helper when available
function _lmPeColor(pe) {
  if (typeof _mapPeColor === 'function') return _mapPeColor(pe);
  if (!pe || pe <= 0) return '#ef4444';
  if (pe >= 1)        return '#10b981';
  if (pe <= 0.25) return '#f59e0b';
  if (pe <= 0.5)  return '#eab308';
  if (pe <= 0.75) return '#4e9cf5';
  return '#10b981';
}

// ══════════════════════════════════════════════════════════════════════════════
// startNewSession(patientNumber, condition, workspaceKey)
// Creates a longitudinal MAP session in Firebase map_sessions/{id}.
// Returns Promise<sessionId>.
// ══════════════════════════════════════════════════════════════════════════════
function startNewSession(patientNumber, condition, workspaceKey) {
  return new Promise(function(resolve, reject) {
    if (!patientNumber) return reject(new Error('startNewSession: patientNumber is required'));
    if (!workspaceKey)  return reject(new Error('startNewSession: workspaceKey is required'));

    var now = Date.now();
    var sessionId = 'sess_' + now + '_' + Math.random().toString(36).slice(2, 8);

    var session = {
      session_id:       sessionId,
      patient_number:   String(patientNumber),
      workspace_key:    workspaceKey,
      condition:        condition || null,
      started_at:       now,
      last_updated:     now,
      assessment_count: 0,
      baseline_pe:      null,
      latest_pe:        null,
      arch_trajectory:  JSON.stringify([]),
      exec_trajectory:  JSON.stringify([]),
      ctx_trajectory:   JSON.stringify([]),
      pe_trajectory:    JSON.stringify([]),
      dropout_risk:     null,
      dominant_domain:  null,
    };

    _lmFbSet('map_sessions/' + sessionId, session)
      .then(function() { resolve(sessionId); })
      .catch(reject);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// logInterventionEvent(sessionId, interventionType, notes, ts)
// Saves to Firebase map_sessions/{sessionId}/interventions/{pushId}.
// Valid types: belief_restructuring | habit_support | prescriber_consultation |
//              regimen_simplification | access_support | side_effect_management | other
// Returns Promise<pushId>.
// ══════════════════════════════════════════════════════════════════════════════
function logInterventionEvent(sessionId, interventionType, notes, ts) {
  if (!sessionId) return Promise.reject(new Error('logInterventionEvent: sessionId is required'));

  var validTypes = [
    'belief_restructuring', 'habit_support', 'prescriber_consultation',
    'regimen_simplification', 'access_support', 'side_effect_management', 'other',
  ];
  var type = validTypes.indexOf(interventionType) >= 0 ? interventionType : 'other';
  var when = ts || Date.now();

  var record = {
    session_id:        sessionId,
    intervention_type: type,
    label:             LM_INTERVENTION_LABELS[type] || 'Intervention',
    notes:             notes || null,
    timestamp:         when,
    logged_at:         new Date(when).toISOString(),
  };

  return _lmFbPush('map_sessions/' + sessionId + '/interventions', record);
}

// ══════════════════════════════════════════════════════════════════════════════
// computeInterventionEffectiveness(sessions)
// Pure function. Takes array of session objects (each optionally with
// sess._assessments[] for phenotype transition data).
// Returns effectiveness analysis object.
// ══════════════════════════════════════════════════════════════════════════════
function computeInterventionEffectiveness(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      total_sessions:            0,
      sessions_improving:        0,
      sessions_stable:           0,
      sessions_declining:        0,
      domain_response_rates:     { architecture: 0, execution: 0, context_guard: 0 },
      phenotype_transitions:     {},
      avg_pe_delta_by_condition: {},
      best_responding_domain:    null,
      evidence_strength:         'insufficient',
    };
  }

  var total = sessions.length;
  var improving = 0, stable = 0, declining = 0;

  var domainImproved = { architecture: 0, execution: 0, context_guard: 0 };
  var domainTotal    = { architecture: 0, execution: 0, context_guard: 0 };

  var condPeDeltas = {};
  var condCounts   = {};
  var phenoTransitions = {};

  sessions.forEach(function(sess) {
    var baseline = parseFloat(sess.baseline_pe) || 0;
    var latest   = parseFloat(sess.latest_pe)   || 0;
    var diff = latest - baseline;

    if (diff >= 0.10)  improving++;
    else if (diff <= -0.10) declining++;
    else stable++;

    var cond = sess.condition || 'Unknown';
    condPeDeltas[cond] = (condPeDeltas[cond] || 0) + diff;
    condCounts[cond]   = (condCounts[cond]   || 0) + 1;

    // Domain improvement: first vs last trajectory point
    var archArr = _lmSafeArr(sess.arch_trajectory);
    var execArr = _lmSafeArr(sess.exec_trajectory);
    var ctxArr  = _lmSafeArr(sess.ctx_trajectory);

    if (archArr.length >= 2) {
      domainTotal.architecture++;
      if (archArr[archArr.length - 1] > archArr[0]) domainImproved.architecture++;
    }
    if (execArr.length >= 2) {
      domainTotal.execution++;
      if (execArr[execArr.length - 1] > execArr[0]) domainImproved.execution++;
    }
    if (ctxArr.length >= 2) {
      domainTotal.context_guard++;
      if (ctxArr[ctxArr.length - 1] > ctxArr[0]) domainImproved.context_guard++;
    }

    // Phenotype transitions from attached assessments
    var assessments = sess._assessments || [];
    if (assessments.length >= 2) {
      var fromPheno = assessments[0].peacs_phenotype || 'Unknown';
      var toPheno   = assessments[assessments.length - 1].peacs_phenotype || 'Unknown';
      if (fromPheno !== toPheno) {
        var key = fromPheno + ' -> ' + toPheno;
        phenoTransitions[key] = (phenoTransitions[key] || 0) + 1;
      }
    }
  });

  var domainRates = {
    architecture:  domainTotal.architecture  > 0 ? domainImproved.architecture  / domainTotal.architecture  : 0,
    execution:     domainTotal.execution     > 0 ? domainImproved.execution     / domainTotal.execution     : 0,
    context_guard: domainTotal.context_guard > 0 ? domainImproved.context_guard / domainTotal.context_guard : 0,
  };

  var bestDomain = Object.keys(domainRates).reduce(function(best, key) {
    return domainRates[key] > domainRates[best] ? key : best;
  }, 'architecture');

  var avgPeDeltaByCondition = {};
  Object.keys(condPeDeltas).forEach(function(cond) {
    avgPeDeltaByCondition[cond] = parseFloat((condPeDeltas[cond] / condCounts[cond]).toFixed(4));
  });

  var evidenceStrength = total < 20 ? 'insufficient' : total <= 100 ? 'moderate' : 'strong';

  return {
    total_sessions:            total,
    sessions_improving:        improving,
    sessions_stable:           stable,
    sessions_declining:        declining,
    domain_response_rates:     domainRates,
    phenotype_transitions:     phenoTransitions,
    avg_pe_delta_by_condition: avgPeDeltaByCondition,
    best_responding_domain:    bestDomain,
    evidence_strength:         evidenceStrength,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// renderLongitudinalDashboard(containerId, workspaceKey)
// Loads all map_sessions for workspace from Firebase. Renders header stats,
// condition filter, and 2-col session cards grid.
// ══════════════════════════════════════════════════════════════════════════════
function renderLongitudinalDashboard(containerId, workspaceKey) {
  _lmInjectStyles();
  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderLongitudinalDashboard: container not found:', containerId);
    return;
  }

  container.innerHTML = '<div class="lm-root"><div class="lm-loading">Loading session data...</div></div>';

  if (!workspaceKey) {
    container.innerHTML = '<div class="lm-root"><div class="lm-empty"><div class="lm-empty-title">No workspace specified</div><div class="lm-empty-sub">Provide a workspaceKey to load longitudinal sessions.</div></div></div>';
    return;
  }

  // workspaceKey may be a string (single workspace) or an array (PI/institution multi-site)
  var _wsSet = null;
  if (Array.isArray(workspaceKey)) {
    _wsSet = {};
    workspaceKey.forEach(function(k) { if (k) _wsSet[k.toUpperCase()] = true; });
  }

  _lmFbGet('map_sessions')
    .then(function(data) {
      var allSessions = [];
      if (data) {
        Object.keys(data).forEach(function(key) {
          var sess = data[key];
          if (!sess) return;
          var sessWs = (sess.workspace_key || '').toUpperCase();
          var match = _wsSet
            ? _wsSet[sessWs]
            : (!workspaceKey || sessWs === (workspaceKey || '').toUpperCase());
          if (match) allSessions.push(sess);
        });
      }
      allSessions.sort(function(a, b) { return (b.last_updated || 0) - (a.last_updated || 0); });
      _lmRenderDashboardUI(container, allSessions, workspaceKey);
    })
    .catch(function(err) {
      console.error('renderLongitudinalDashboard: Firebase load failed:', err);
      var _isPerm = err && (err.code === 'PERMISSION_DENIED' || (err.message && err.message.indexOf('permission_denied') !== -1));
      if (_isPerm) {
        container.innerHTML = '<div class="lm-root"><div class="lm-empty">' +
          '<div style="font-size:1.6rem;margin-bottom:12px;opacity:0.4;">≋</div>' +
          '<div class="lm-empty-title">Longitudinal Tracking Not Yet Active</div>' +
          '<div class="lm-empty-sub" style="max-width:360px;line-height:1.7;">Session data is written to Firebase when you start a patient session from the Overview tab. Once the first session is recorded, trajectory history will appear here.<br><br>If you believe you should have access, contact your workspace administrator.</div>' +
        '</div></div>';
      } else {
        container.innerHTML = '<div class="lm-root"><div class="lm-empty"><div class="lm-empty-title">Failed to load sessions</div><div class="lm-empty-sub">' + _lmEsc(err.message) + '</div></div></div>';
      }
    });
}

function _lmRenderDashboardUI(container, sessions, workspaceKey) {
  var now          = Date.now();
  var ninetyDaysMs = 90 * 24 * 3600 * 1000;

  var totalSessions = sessions.length;

  var activeRecent = sessions.filter(function(s) {
    return s.last_updated && (now - s.last_updated) <= ninetyDaysMs;
  }).length;

  var highRisk = sessions.filter(function(s) {
    return parseFloat(s.dropout_risk) > 0.5;
  }).length;

  var peChanges = sessions
    .filter(function(s) { return s.baseline_pe !== null && s.baseline_pe !== undefined && s.latest_pe !== null && s.latest_pe !== undefined; })
    .map(function(s) { return parseFloat(s.latest_pe) - parseFloat(s.baseline_pe); });
  var avgPeChange = peChanges.length
    ? peChanges.reduce(function(sum, v) { return sum + v; }, 0) / peChanges.length
    : null;

  var html = '<div class="lm-root">';

  // Header
  html += '<div class="lm-header">';
  html += '<div class="lm-title">Longitudinal MAP Monitor</div>';
  html += '<div class="lm-subtitle">MAP Adherence Trajectory Dashboard &middot; ATLAS v8.7.0</div>';
  html += '</div>';

  // Stats row
  html += '<div class="lm-stats-row">';
  html += '<div class="lm-stat-card"><div class="lm-stat-label">Total Sessions</div><div class="lm-stat-value">' + totalSessions + '</div></div>';
  html += '<div class="lm-stat-card"><div class="lm-stat-label">Active (90 days)</div><div class="lm-stat-value">' + activeRecent + '</div></div>';
  html += '<div class="lm-stat-card"><div class="lm-stat-label">High Risk</div><div class="lm-stat-value' + (highRisk > 0 ? ' negative' : '') + '">' + highRisk + '</div></div>';

  var avgHtml;
  if (avgPeChange !== null) {
    var avgCls = avgPeChange >= 0.005 ? ' positive' : avgPeChange <= -0.005 ? ' negative' : '';
    avgHtml = '<div class="lm-stat-value' + avgCls + '">' + (avgPeChange >= 0 ? '+' : '') + avgPeChange.toFixed(3) + '</div>';
  } else {
    avgHtml = '<div class="lm-stat-value">--</div>';
  }
  html += '<div class="lm-stat-card"><div class="lm-stat-label">Avg PE Change</div>' + avgHtml + '</div>';
  html += '</div>';

  // Filter bar
  html += '<div class="lm-filter-bar">';
  html += '<span class="lm-filter-label">Filter</span>';
  html += '<select class="lm-filter-select" id="lm-condition-filter">';
  html += '<option value="">All Conditions</option>';
  ['Hypertension','Diabetes','HIV','Cardiovascular','Other'].forEach(function(c) {
    html += '<option value="' + _lmEsc(c) + '">' + _lmEsc(c) + '</option>';
  });
  html += '</select>';
  html += '<span class="lm-result-count" id="lm-result-count">' + totalSessions + ' session' + (totalSessions !== 1 ? 's' : '') + '</span>';
  html += '</div>';

  // Cards grid
  html += '<div class="lm-cards-grid" id="lm-cards-grid">';
  html += _lmBuildSessionCards(sessions, workspaceKey);
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;

  // Wire filter
  var filterEl = document.getElementById('lm-condition-filter');
  if (filterEl) {
    filterEl.addEventListener('change', function() {
      var cond = this.value;
      var filtered = cond
        ? sessions.filter(function(s) { return (s.condition || 'Other') === cond; })
        : sessions;
      var grid  = document.getElementById('lm-cards-grid');
      var count = document.getElementById('lm-result-count');
      if (grid)  grid.innerHTML = _lmBuildSessionCards(filtered, workspaceKey);
      if (count) count.textContent = filtered.length + ' session' + (filtered.length !== 1 ? 's' : '');
    });
  }
}

function _lmBuildSessionCards(sessions, workspaceKey) {
  if (!sessions.length) {
    return '<div class="lm-empty" style="grid-column:1/-1"><div class="lm-empty-title">No sessions found</div><div class="lm-empty-sub">No longitudinal MAP sessions match the current filter.</div></div>';
  }

  var html = '';
  sessions.forEach(function(sess) {
    var status    = _lmTrajStatus(sess);
    var maskedId  = _lmMaskPatient(sess.patient_number);
    var baseline  = parseFloat(sess.baseline_pe) || 0;
    var latest    = parseFloat(sess.latest_pe)   || 0;
    var delta     = _lmDelta(latest, baseline);
    var deltaStr  = _lmDeltaStr(delta);
    var deltaCls  = delta !== null && delta > 0.001 ? 'pos' : delta !== null && delta < -0.001 ? 'neg' : 'zero';
    var peColor   = _lmPeColor(latest);

    var archArr = _lmSafeArr(sess.arch_trajectory);
    var execArr = _lmSafeArr(sess.exec_trajectory);
    var ctxArr  = _lmSafeArr(sess.ctx_trajectory);
    var archCur = archArr.length ? archArr[archArr.length - 1] : 0;
    var execCur = execArr.length ? execArr[execArr.length - 1] : 0;
    var ctxCur  = ctxArr.length  ? ctxArr[ctxArr.length  - 1] : 0;

    var domainNames = { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard', balanced: 'Balanced' };
    var domainLabel = sess.dominant_domain ? (domainNames[sess.dominant_domain] || sess.dominant_domain) : '--';

    var sessionId = _lmEsc(sess.session_id || '');
    var condition = _lmEsc(sess.condition  || 'Unknown');
    var patNum    = _lmEsc(sess.patient_number || '');
    var wsKey     = _lmEsc(workspaceKey || '');

    html += '<div class="lm-session-card ' + status + '">';

    // Header row
    html += '<div class="lm-card-header">';
    html += '<div><div class="lm-patient-id">' + _lmEsc(maskedId) + '</div>';
    html += '<div class="lm-patient-condition">' + condition + '</div></div>';
    html += '<div class="lm-status-badge ' + status + '">' + status.toUpperCase() + '</div>';
    html += '</div>';

    // PE delta row
    html += '<div class="lm-pe-row">';
    html += '<span class="lm-pe-baseline">Baseline ' + baseline.toFixed(3) + '</span>';
    html += '<span class="lm-pe-arrow">&#8594;</span>';
    html += '<span class="lm-pe-current" style="color:' + peColor + '">' + latest.toFixed(3) + '</span>';
    html += '<span class="lm-pe-delta ' + deltaCls + '">' + _lmEsc(deltaStr) + '</span>';
    html += '</div>';

    // Domain mini-bars
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.6rem;color:#6b8099;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2px;">Dominant: ' + _lmEsc(domainLabel) + '</div>';
    html += _lmBuildMiniBar('A',  archCur, LM_COLORS.architecture);
    html += _lmBuildMiniBar('E',  execCur, LM_COLORS.execution);
    html += _lmBuildMiniBar('Cg', ctxCur,  LM_COLORS.context);
    html += '</div>';

    // Phenotype placeholder (populated from most-recent assessment if available)
    var phenoLabel = sess._latestPhenotype || '--';
    html += '<div><span class="lm-card-phenotype">' + _lmEsc(phenoLabel) + '</span></div>';

    // Action buttons
    // "View Trajectory" targets a full-page overlay with id lm-traj-{sessionId}
    html += '<div class="lm-card-actions">';
    html += '<button class="lm-btn lm-btn-primary" onclick="renderSessionTrajectory(\'lm-traj-' + sessionId + '\',\'' + sessionId + '\')">View Trajectory</button>';
    html += '<button class="lm-btn lm-btn-ghost" onclick="_lmOpenAddAssessment(\'' + sessionId + '\',\'' + patNum + '\',\'' + condition + '\',\'' + wsKey + '\')">Add Assessment</button>';
    html += '<button class="lm-btn lm-btn-amber" onclick="_lmRequestPrediction(\'' + sessionId + '\')">Request Prediction</button>';
    html += '</div>';

    html += '</div>';
  });

  return html;
}

function _lmBuildMiniBar(label, value, color) {
  var pct = Math.min(100, Math.max(0, (value || 0) * 100)).toFixed(1);
  return '<div class="lm-domain-mini">' +
    '<span class="lm-domain-mini-label">' + _lmEsc(label) + '</span>' +
    '<div class="lm-domain-mini-track"><div class="lm-domain-mini-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
    '<span class="lm-domain-mini-val">' + parseFloat(value || 0).toFixed(3) + '</span>' +
    '</div>';
}

// Opens MAP assessment in a modal overlay
function _lmOpenAddAssessment(sessionId, patientNumber, condition, workspaceKey) {
  var modal = document.getElementById('lm-assess-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'lm-assess-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(8,14,26,0.94);z-index:9000;overflow-y:auto;padding:32px 16px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div style="max-width:680px;margin:0 auto;position:relative;">' +
    '<button onclick="document.getElementById(\'lm-assess-modal\').remove()" style="position:absolute;top:0;right:0;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#6b8099;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;padding:6px 14px;border-radius:7px;cursor:pointer;letter-spacing:0.1em;">&times; Close</button>' +
    '<div id="lm-assess-modal-body" style="padding-top:36px;"></div>' +
    '</div>';
  modal.style.display = 'block';

  if (typeof renderMAPAssessmentUI === 'function') {
    renderMAPAssessmentUI('lm-assess-modal-body', {
      mode: 'clinical',
      conditionContext: condition,
      onComplete: function(result) {
        if (typeof submitMAPAssessment === 'function') {
          submitMAPAssessment({
            responses:      result.responses,
            patient_number: patientNumber,
            condition:      condition,
            session_id:     sessionId,
          }, workspaceKey).then(function() {
            setTimeout(function() {
              var m = document.getElementById('lm-assess-modal');
              if (m) m.remove();
            }, 1800);
          });
        }
      },
    });
  } else {
    document.getElementById('lm-assess-modal-body').innerHTML =
      '<div style="color:#6b8099;font-family:\'IBM Plex Mono\',monospace;font-size:0.8rem;padding:20px;">MAP assessment module not loaded. Include map-assessment.js before longitudinal-map.js.</div>';
  }
}

// Delegates to predictive engine if available
function _lmRequestPrediction(sessionId) {
  if (typeof triggerRiskRefresh === 'function') {
    triggerRiskRefresh(sessionId);
  } else {
    console.info('longitudinal-map: predictive engine not loaded; triggerRiskRefresh() unavailable for session', sessionId);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// renderSessionTrajectory(containerId, sessionId)
// Full trajectory view for a single patient session.
// If container not found in DOM, creates a full-page overlay.
// ══════════════════════════════════════════════════════════════════════════════
function renderSessionTrajectory(containerId, sessionId) {
  _lmInjectStyles();

  var container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0d1525;z-index:8000;overflow-y:auto;padding:28px 24px 48px;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7  Close';
    closeBtn.style.cssText = 'position:fixed;top:14px;right:18px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#6b8099;font-family:"IBM Plex Mono",monospace;font-size:0.72rem;padding:6px 14px;border-radius:7px;cursor:pointer;z-index:8001;letter-spacing:0.1em;';
    var cid = containerId;
    closeBtn.onclick = function() {
      var el = document.getElementById(cid);
      if (el) el.remove();
      this.remove();
    };

    document.body.appendChild(container);
    document.body.appendChild(closeBtn);
  }

  container.innerHTML = '<div class="lm-traj-root"><div class="lm-loading">Loading trajectory...</div></div>';

  Promise.all([
    _lmFbGet('map_sessions/' + sessionId),
    _lmFbGet('map_assessments'),
  ]).then(function(results) {
    var session   = results[0];
    var allAssess = results[1];

    if (!session) {
      container.innerHTML = '<div class="lm-traj-root"><div class="lm-empty"><div class="lm-empty-title">Session not found</div><div class="lm-empty-sub">ID: ' + _lmEsc(sessionId) + '</div></div></div>';
      return;
    }

    // Collect and sort assessments for this session
    var assessments = [];
    if (allAssess) {
      Object.keys(allAssess).forEach(function(k) {
        var a = allAssess[k];
        if (a && a.session_id === sessionId) assessments.push(a);
      });
    }
    assessments.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

    // Load interventions
    _lmFbGet('map_sessions/' + sessionId + '/interventions')
      .then(function(intData) {
        var interventions = [];
        if (intData) {
          Object.keys(intData).forEach(function(k) { interventions.push(intData[k]); });
          interventions.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        }
        _lmRenderTrajectoryUI(container, session, assessments, interventions);
      })
      .catch(function() {
        _lmRenderTrajectoryUI(container, session, assessments, []);
      });
  }).catch(function(err) {
    container.innerHTML = '<div class="lm-traj-root"><div class="lm-empty"><div class="lm-empty-title">Failed to load trajectory</div><div class="lm-empty-sub">' + _lmEsc(err.message) + '</div></div></div>';
  });
}

function _lmRenderTrajectoryUI(container, session, assessments, interventions) {
  var startTs  = session.started_at  || Date.now();
  var lastTs   = session.last_updated || startTs;
  var durationDays = _lmDaysBetween(startTs, lastTs);
  var maskedId = _lmMaskPatient(session.patient_number);
  var condition = session.condition || 'Unknown';
  var assessCount = session.assessment_count || assessments.length;
  var dropoutRisk = parseFloat(session.dropout_risk) || 0;

  var archArr = _lmSafeArr(session.arch_trajectory);
  var execArr = _lmSafeArr(session.exec_trajectory);
  var ctxArr  = _lmSafeArr(session.ctx_trajectory);
  var peArr   = _lmSafeArr(session.pe_trajectory);

  // Build date labels from assessment timestamps or synthesize
  var dateLabels = [];
  if (assessments.length) {
    dateLabels = assessments.map(function(a) { return a.timestamp || 0; });
  } else {
    var n = Math.max(peArr.length, 1);
    var step = durationDays > 0 && n > 1 ? (durationDays / (n - 1)) * 86400000 : 0;
    for (var i = 0; i < n; i++) dateLabels.push(startTs + i * step);
  }

  var html = '<div class="lm-traj-root">';

  // Patient header
  html += '<div class="lm-traj-header">';
  html += '<div class="lm-traj-patient-id">' + _lmEsc(maskedId) + '</div>';
  html += '<div class="lm-traj-meta">';
  html += '<span>' + _lmEsc(condition) + '</span>';
  html += '<span>' + durationDays + ' day' + (durationDays !== 1 ? 's' : '') + ' tracked</span>';
  html += '<span>' + assessCount + ' assessment' + (assessCount !== 1 ? 's' : '') + '</span>';
  if (dropoutRisk > 0) {
    var riskColor = dropoutRisk > 0.5 ? '#ef4444' : '#d4a843';
    html += '<span style="color:' + riskColor + '">Dropout risk: ' + (dropoutRisk * 100).toFixed(0) + '%</span>';
  }
  html += '</div>';
  html += '</div>';

  // SVG chart
  html += '<div class="lm-chart-wrap">';
  html += _lmBuildTrajectoryChart(archArr, execArr, ctxArr, peArr, dateLabels, interventions, dropoutRisk);
  html += '</div>';

  // Legend
  html += '<div class="lm-chart-legend">';
  html += '<div class="lm-legend-item"><div class="lm-legend-line" style="background:' + LM_COLORS.architecture + ';"></div>Architecture</div>';
  html += '<div class="lm-legend-item"><div class="lm-legend-line" style="background:' + LM_COLORS.execution + ';"></div>Execution</div>';
  html += '<div class="lm-legend-item"><div class="lm-legend-line" style="background:' + LM_COLORS.context + ';"></div>Context-Guard</div>';
  html += '<div class="lm-legend-item"><div class="lm-legend-line dashed" style="border-color:' + LM_COLORS.pe + ';width:28px;"></div>PE Composite</div>';
  html += '<div class="lm-legend-item"><div class="lm-legend-line dashed" style="border-color:#ef4444;width:28px;"></div>Clinical Threshold (0.50)</div>';
  if (interventions.length) {
    html += '<div class="lm-legend-item"><div style="width:2px;height:14px;border-left:1px dashed rgba(255,255,255,0.3);margin-right:6px;"></div>Intervention</div>';
  }
  html += '</div>';

  // Assessment table
  html += _lmBuildAssessmentTable(assessments, archArr, execArr, ctxArr, peArr, dateLabels);

  // Effectiveness analysis (requires 2+ data points)
  var hasSufficientData = (assessments.length >= 2) || (peArr.length >= 2);
  if (hasSufficientData) {
    html += _lmBuildEffectivenessAnalysis(session, assessments, archArr, execArr, ctxArr, peArr);
  }

  html += '</div>';
  container.innerHTML = html;
}

// ── Pure SVG trajectory chart ─────────────────────────────────────────────────
// Publication-quality. Viewbox 900x320. All measurements in SVG user units.
function _lmBuildTrajectoryChart(archArr, execArr, ctxArr, peArr, dateLabels, interventions, dropoutRisk) {
  var W = 900, H = 320;
  var padL = 52, padR = 140, padT = 28, padB = 52;
  var chartW = W - padL - padR;
  var chartH = H - padT - padB;

  // Number of data points to plot
  var n = Math.max(archArr.length, execArr.length, ctxArr.length, peArr.length);
  if (n < 2) n = 2;

  function xPos(i) {
    if (n <= 1) return padL + chartW / 2;
    return padL + (i / (n - 1)) * chartW;
  }
  function yPos(val) {
    var v = Math.min(1, Math.max(0, val || 0));
    return padT + chartH * (1 - v);
  }

  var svg = '<svg class="lm-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MAP Domain Trajectory Chart">';

  // Background
  svg += '<rect width="' + W + '" height="' + H + '" fill="#0d1525"/>';

  // Risk zone: rightmost 25% shaded red at 8% opacity when dropout_risk > 0.5
  if (dropoutRisk > 0.5) {
    var rzX = (padL + chartW * 0.75).toFixed(1);
    var rzW = (chartW * 0.25).toFixed(1);
    svg += '<rect x="' + rzX + '" y="' + padT + '" width="' + rzW + '" height="' + chartH + '" fill="rgba(239,68,68,0.08)"/>';
    svg += '<text x="' + (parseFloat(rzX) + 6).toFixed(1) + '" y="' + (padT + 15) + '" font-family="IBM Plex Mono,monospace" font-size="9" fill="rgba(239,68,68,0.5)" letter-spacing="0.12em" text-transform="uppercase">RISK ZONE</text>';
  }

  // Horizontal gridlines at 0.25, 0.50, 0.75, 1.00
  [1.00, 0.75, 0.50, 0.25, 0.00].forEach(function(yVal) {
    var y = yPos(yVal).toFixed(1);
    var isThreshold = yVal === 0.50;
    if (isThreshold) {
      // Clinical threshold: red dashed
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + chartW) + '" y2="' + y + '" stroke="rgba(239,68,68,0.45)" stroke-width="1.5" stroke-dasharray="6,4"/>';
      svg += '<text x="' + (padL + chartW + 6) + '" y="' + y + '" font-family="IBM Plex Mono,monospace" font-size="8.5" fill="rgba(239,68,68,0.7)" dominant-baseline="middle">Clinical Threshold</text>';
    } else {
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + chartW) + '" y2="' + y + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
    }
    // Y axis labels
    svg += '<text x="' + (padL - 7) + '" y="' + y + '" font-family="IBM Plex Mono,monospace" font-size="9" fill="rgba(107,128,153,0.9)" text-anchor="end" dominant-baseline="middle">' + yVal.toFixed(2) + '</text>';
  });

  // Axis lines
  svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + chartH) + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>';
  svg += '<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (padL + chartW) + '" y2="' + (padT + chartH) + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>';

  // X axis date labels — at most 8 labels to avoid crowding
  var labelStep = Math.max(1, Math.ceil((n - 1) / 7));
  for (var li = 0; li < n; li += labelStep) {
    var lx = xPos(li).toFixed(1);
    var labelTs  = dateLabels[li] || 0;
    var labelStr = labelTs ? _lmFmtDate(labelTs) : ('Pt ' + (li + 1));
    svg += '<line x1="' + lx + '" y1="' + (padT + chartH) + '" x2="' + lx + '" y2="' + (padT + chartH + 5) + '" stroke="rgba(107,128,153,0.4)" stroke-width="1"/>';
    svg += '<text x="' + lx + '" y="' + (padT + chartH + 17) + '" font-family="IBM Plex Mono,monospace" font-size="9" fill="rgba(107,128,153,0.85)" text-anchor="middle">' + _lmEsc(labelStr) + '</text>';
  }
  // Always show last label if not already shown
  if ((n - 1) % labelStep !== 0 && n > 1) {
    var lastLx  = xPos(n - 1).toFixed(1);
    var lastTs  = dateLabels[n - 1] || 0;
    var lastStr = lastTs ? _lmFmtDate(lastTs) : ('Pt ' + n);
    svg += '<line x1="' + lastLx + '" y1="' + (padT + chartH) + '" x2="' + lastLx + '" y2="' + (padT + chartH + 5) + '" stroke="rgba(107,128,153,0.4)" stroke-width="1"/>';
    svg += '<text x="' + lastLx + '" y="' + (padT + chartH + 17) + '" font-family="IBM Plex Mono,monospace" font-size="9" fill="rgba(107,128,153,0.85)" text-anchor="middle">' + _lmEsc(lastStr) + '</text>';
  }

  // Intervention markers: vertical dashed lines with labels
  interventions.forEach(function(intv) {
    var ts = intv.timestamp || 0;
    if (!ts || dateLabels.length < 1) return;
    var ix;
    if (dateLabels.length === 1) {
      ix = padL;
    } else {
      var span = dateLabels[dateLabels.length - 1] - dateLabels[0];
      ix = span > 0 ? padL + ((ts - dateLabels[0]) / span) * chartW : padL;
      ix = Math.min(padL + chartW, Math.max(padL, ix));
    }
    ix = ix.toFixed(1);
    var label = _lmEsc(intv.label || 'Intervention');
    svg += '<line x1="' + ix + '" y1="' + padT + '" x2="' + ix + '" y2="' + (padT + chartH) + '" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3,4"/>';
    svg += '<text x="' + (parseFloat(ix) + 4) + '" y="' + (padT + 11) + '" font-family="IBM Plex Mono,monospace" font-size="8" fill="rgba(255,255,255,0.42)" letter-spacing="0.04em">' + label + '</text>';
  });

  // Helper: draw a data series (polyline + filled circles)
  function drawSeries(arr, color, strokeW, dashArray, dotR) {
    if (!arr || arr.length === 0) return;
    var pathD = '';
    arr.forEach(function(val, i) {
      var px = xPos(i).toFixed(1);
      var py = yPos(val).toFixed(1);
      pathD += (i === 0 ? 'M' : 'L') + px + ',' + py + ' ';
    });
    svg += '<path d="' + pathD.trim() + '" fill="none" stroke="' + color + '" stroke-width="' + strokeW + '"' +
      (dashArray ? ' stroke-dasharray="' + dashArray + '"' : '') +
      ' stroke-linejoin="round" stroke-linecap="round"/>';
    // Dots on top of lines
    arr.forEach(function(val, i) {
      var px = xPos(i).toFixed(1);
      var py = yPos(val).toFixed(1);
      svg += '<circle cx="' + px + '" cy="' + py + '" r="' + dotR + '" fill="' + color + '" stroke="#0d1525" stroke-width="1.5"/>';
    });
  }

  // Draw in order: domain lines first (behind), PE composite on top
  drawSeries(archArr, LM_COLORS.architecture, 2,   null,   3.5);
  drawSeries(execArr, LM_COLORS.execution,    2,   null,   3.5);
  drawSeries(ctxArr,  LM_COLORS.context,      2,   null,   3.5);
  drawSeries(peArr,   LM_COLORS.pe,           2.5, '7,4',  4.5);

  svg += '</svg>';
  return svg;
}

// ── Assessment timeline table ─────────────────────────────────────────────────
function _lmBuildAssessmentTable(assessments, archArr, execArr, ctxArr, peArr, dateLabels) {
  var len = Math.max(assessments.length, peArr.length);
  if (len === 0) return '';

  var html = '<div class="lm-table-wrap">';
  html += '<table class="lm-table">';
  html += '<thead><tr><th>Date</th><th>Architecture</th><th>Execution</th><th>Context-Guard</th><th>PE</th><th>Phenotype</th><th>Delta vs Prior</th></tr></thead>';
  html += '<tbody>';

  for (var i = 0; i < len; i++) {
    var a    = assessments[i] || null;
    var arch = archArr[i] !== undefined ? archArr[i] : (a ? a.arch_score : null);
    var exec = execArr[i] !== undefined ? execArr[i] : (a ? a.exec_score : null);
    var ctx  = ctxArr[i]  !== undefined ? ctxArr[i]  : (a ? a.ctx_score  : null);
    var pe   = peArr[i]   !== undefined ? peArr[i]   : (a ? a.pe_score   : null);
    var ts   = dateLabels[i] || (a ? a.timestamp : 0);
    var pheno = a ? (a.peacs_phenotype || '--') : '--';
    var isBaseline = (i === 0);

    var priorPe = (i > 0) ? (peArr[i - 1] !== undefined ? peArr[i - 1] : null) : null;
    var delta    = isBaseline ? null : _lmDelta(pe || 0, priorPe || 0);
    var deltaCls = _lmDeltaClass(delta);

    html += '<tr class="' + (isBaseline ? 'baseline' : '') + '">';
    html += '<td>' + _lmEsc(_lmFmtDateFull(ts)) + (isBaseline ? ' <span style="color:#4e4e6a;font-size:0.6rem;">(Baseline)</span>' : '') + '</td>';
    html += '<td style="color:' + LM_COLORS.architecture + '">' + (arch !== null ? parseFloat(arch).toFixed(4) : '--') + '</td>';
    html += '<td style="color:' + LM_COLORS.execution    + '">' + (exec !== null ? parseFloat(exec).toFixed(4) : '--') + '</td>';
    html += '<td style="color:' + LM_COLORS.context      + '">' + (ctx  !== null ? parseFloat(ctx).toFixed(4)  : '--') + '</td>';
    html += '<td style="color:' + _lmPeColor(pe || 0) + '">' + (pe !== null ? parseFloat(pe).toFixed(4) : '--') + '</td>';
    html += '<td><span class="lm-phenotype-pill">' + _lmEsc(pheno) + '</span></td>';
    html += '<td class="' + deltaCls + '">' + (isBaseline ? '--' : _lmEsc(_lmDeltaStr(delta))) + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ── Intervention effectiveness analysis ───────────────────────────────────────
function _lmBuildEffectivenessAnalysis(session, assessments, archArr, execArr, ctxArr, peArr) {
  var html = '<div class="lm-analysis-section">';
  html += '<div class="lm-analysis-title">Intervention Effectiveness Analysis</div>';

  var hasData = (archArr.length >= 2 || peArr.length >= 2);
  if (!hasData) {
    html += '<div style="color:#6b8099;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;">Insufficient data. At least 2 assessments required for effectiveness analysis.</div>';
    html += '</div>';
    return html;
  }

  // Domain deltas: first vs last trajectory point
  var firstArch = archArr[0] || 0,  lastArch = archArr[archArr.length - 1] || 0;
  var firstExec = execArr[0] || 0,  lastExec = execArr[execArr.length - 1] || 0;
  var firstCtx  = ctxArr[0]  || 0,  lastCtx  = ctxArr[ctxArr.length  - 1] || 0;

  var archDelta = parseFloat((lastArch - firstArch).toFixed(4));
  var execDelta = parseFloat((lastExec - firstExec).toFixed(4));
  var ctxDelta  = parseFloat((lastCtx  - firstCtx).toFixed(4));

  var domainDeltas  = { architecture: archDelta, execution: execDelta, context_guard: ctxDelta };
  var domainNames   = { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard' };
  var domainColors  = { architecture: LM_COLORS.architecture, execution: LM_COLORS.execution, context_guard: LM_COLORS.context };

  // Most improved
  var bestDomain = Object.keys(domainDeltas).reduce(function(best, k) {
    return domainDeltas[k] > domainDeltas[best] ? k : best;
  }, 'architecture');

  // Declined domains
  var declinedDomains = Object.keys(domainDeltas).filter(function(k) { return domainDeltas[k] < -0.001; });

  html += '<div class="lm-analysis-row">';
  html += '<span class="lm-analysis-label">Domain Improved Most</span>';
  html += '<span class="lm-analysis-value" style="color:' + domainColors[bestDomain] + '">' +
    domainNames[bestDomain] + ' (' + (domainDeltas[bestDomain] >= 0 ? '+' : '') + domainDeltas[bestDomain].toFixed(3) + ')</span>';
  html += '</div>';

  if (declinedDomains.length) {
    html += '<div class="lm-analysis-row">';
    html += '<span class="lm-analysis-label">Declined Domains</span>';
    html += '<span class="lm-analysis-value lm-flag-amber">';
    html += declinedDomains.map(function(k) {
      return domainNames[k] + ' (' + domainDeltas[k].toFixed(3) + ')';
    }).join(', ');
    html += '</span>';
    html += '</div>';
  }

  // Intervention-Domain Match indicator
  var dominantDomain = session.dominant_domain || null;
  if (dominantDomain && dominantDomain !== 'balanced') {
    var matched = (bestDomain === dominantDomain);
    html += '<div class="lm-analysis-row">';
    html += '<span class="lm-analysis-label">Intervention-Domain Match</span>';
    html += '<span class="lm-analysis-value"><span class="lm-match-badge ' + (matched ? 'confirmed' : 'mismatch') + '">' +
      (matched ? 'Match Confirmed' : 'Mismatch: Review Protocol') + '</span></span>';
    html += '</div>';
  }

  // Phenotype evolution timeline
  var phenotypes = assessments
    .map(function(a) { return a.peacs_phenotype || null; })
    .filter(function(p) { return p !== null; });

  if (phenotypes.length >= 2) {
    html += '<div class="lm-analysis-row" style="flex-direction:column;gap:8px;">';
    html += '<span class="lm-analysis-label">Phenotype Evolution</span>';
    html += '<div class="lm-pheno-timeline">';
    phenotypes.forEach(function(ph, idx) {
      if (idx > 0) html += '<span class="lm-pheno-arrow">&#8594;</span>';
      var cls = idx === 0 ? 'first' : idx === phenotypes.length - 1 ? 'last' : '';
      html += '<span class="lm-pheno-badge ' + cls + '">' + _lmEsc(ph) + '</span>';
    });
    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════════════════════
// renderInterventionEffectivenessReport(containerId, workspaceKey)
// Publication-ready statistics view for NIH grant applications and pharma ISR.
// ══════════════════════════════════════════════════════════════════════════════
function renderInterventionEffectivenessReport(containerId, workspaceKey) {
  _lmInjectStyles();
  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderInterventionEffectivenessReport: container not found:', containerId);
    return;
  }

  container.innerHTML = '<div class="lm-report-root"><div class="lm-loading">Computing effectiveness statistics...</div></div>';

  _lmFbGet('map_sessions')
    .then(function(data) {
      var sessions = [];
      if (data) {
        Object.keys(data).forEach(function(key) {
          var sess = data[key];
          if (sess && sess.workspace_key === workspaceKey) sessions.push(sess);
        });
      }

      // Attach assessment arrays for phenotype transition analysis
      return _lmFbGet('map_assessments').then(function(allAssess) {
        if (allAssess) {
          sessions.forEach(function(sess) {
            var sa = [];
            Object.keys(allAssess).forEach(function(k) {
              var a = allAssess[k];
              if (a && a.session_id === sess.session_id) sa.push(a);
            });
            sa.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
            sess._assessments = sa;
          });
        }
        return sessions;
      });
    })
    .then(function(sessions) {
      var stats = computeInterventionEffectiveness(sessions);
      _lmRenderReportUI(container, stats, sessions, workspaceKey);
    })
    .catch(function(err) {
      container.innerHTML = '<div class="lm-report-root"><div class="lm-empty"><div class="lm-empty-title">Failed to load data</div><div class="lm-empty-sub">' + _lmEsc(err.message) + '</div></div></div>';
    });
}

function _lmRenderReportUI(container, stats, sessions, workspaceKey) {
  var now = new Date();
  var reportDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Timespan in months across session start dates
  var timestamps = sessions.map(function(s) { return s.started_at || 0; }).filter(Boolean);
  var monthsSpan = 0;
  if (timestamps.length >= 2) {
    var earliest = Math.min.apply(null, timestamps);
    var latest   = Math.max.apply(null, timestamps);
    monthsSpan = Math.round((latest - earliest) / (30 * 86400000));
  }

  // Best PE delta condition
  var bestCondition = '--', bestCondDelta = 0;
  Object.keys(stats.avg_pe_delta_by_condition).forEach(function(cond) {
    if (stats.avg_pe_delta_by_condition[cond] > bestCondDelta) {
      bestCondDelta = stats.avg_pe_delta_by_condition[cond];
      bestCondition = cond;
    }
  });

  // Domain label
  var domainLabel = stats.best_responding_domain
    ? { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard' }[stats.best_responding_domain] || stats.best_responding_domain
    : '--';

  // Improving percentage
  var improvingPct = stats.total_sessions > 0
    ? Math.round((stats.sessions_improving / stats.total_sessions) * 100)
    : 0;

  // Find most common transition toward adequate adherence for key finding sentence
  var topTransition = '--', topTransitionCount = 0;
  Object.keys(stats.phenotype_transitions).forEach(function(key) {
    if (key.toLowerCase().indexOf('adequate') >= 0 && stats.phenotype_transitions[key] > topTransitionCount) {
      topTransitionCount = stats.phenotype_transitions[key];
      topTransition = key;
    }
  });
  var fromPheno = topTransition !== '--' ? topTransition.split(' -> ')[0] : null;
  var bestPeDeltaStr = bestCondDelta >= 0 ? '+' + bestCondDelta.toFixed(3) : bestCondDelta.toFixed(3);

  var keyFinding = 'In a cohort of ' + stats.total_sessions + ' patient' + (stats.total_sessions !== 1 ? 's' : '') +
    ' assessed longitudinally via MAP over ' + monthsSpan + ' month' + (monthsSpan !== 1 ? 's' : '') +
    ', targeted ' + domainLabel.toLowerCase() + ' interventions produced a mean PE improvement of ' + bestPeDeltaStr +
    ', with ' + improvingPct + '% of patients shifting toward improved adherence classification';
  if (fromPheno) keyFinding += ', including transitions from ' + fromPheno + ' to Adequate Adherent';
  keyFinding += '.';

  var html = '<div class="lm-report-root">';

  // Header
  html += '<div class="lm-report-header">';
  html += '<div class="lm-report-title">MAP Longitudinal Effectiveness Report</div>';
  html += '<div class="lm-report-meta">Workspace: ' + _lmEsc(workspaceKey) + ' &middot; Generated: ' + _lmEsc(reportDate) + ' &middot; ATLAS v8.7.0</div>';
  html += '</div>';

  // Evidence strength badge
  var evClass = stats.evidence_strength;
  var evNotes = {
    insufficient: 'N=' + stats.total_sessions + '. Minimum 20 sessions required for moderate evidence.',
    moderate:     'N=' + stats.total_sessions + '. Moderate evidence threshold met (20-100 sessions).',
    strong:       'N=' + stats.total_sessions + '. Strong evidence threshold met (N > 100).',
  };
  html += '<div class="lm-evidence-badge ' + evClass + '">';
  html += '<span>' + stats.evidence_strength.toUpperCase() + ' EVIDENCE</span>';
  html += '<span style="opacity:0.7;font-size:0.6rem;">' + _lmEsc(evNotes[evClass] || '') + '</span>';
  html += '</div>';

  // Key finding block
  html += '<div class="lm-key-finding">';
  html += '<div class="lm-key-finding-label">Key Finding</div>';
  html += '<div class="lm-key-finding-text">' + _lmEsc(keyFinding) + '</div>';
  html += '</div>';

  // Cohort summary table
  html += '<div class="lm-report-section-title">Cohort Summary</div>';
  html += '<table class="lm-report-summary-table"><thead><tr><th>Metric</th><th>N</th><th>Percent</th></tr></thead><tbody>';
  var summaryRows = [
    { label: 'Total Sessions',          n: stats.total_sessions,   pct: null },
    { label: 'Improving (PE +0.10)',     n: stats.sessions_improving, pct: stats.total_sessions ? Math.round(stats.sessions_improving/stats.total_sessions*100) : 0 },
    { label: 'Stable (within 0.10)',     n: stats.sessions_stable,    pct: stats.total_sessions ? Math.round(stats.sessions_stable/stats.total_sessions*100)    : 0 },
    { label: 'Declining (PE -0.10)',     n: stats.sessions_declining, pct: stats.total_sessions ? Math.round(stats.sessions_declining/stats.total_sessions*100) : 0 },
  ];
  summaryRows.forEach(function(row) {
    html += '<tr><td style="color:#6b8099">' + _lmEsc(row.label) + '</td><td>' + row.n + '</td><td>' + (row.pct !== null ? row.pct + '%' : '--') + '</td></tr>';
  });
  html += '<tr><td style="color:#6b8099">Best Responding Domain</td><td colspan="2">' + _lmEsc(domainLabel) + '</td></tr>';
  html += '<tr><td style="color:#6b8099">Evidence Strength</td><td colspan="2">' + stats.evidence_strength.charAt(0).toUpperCase() + stats.evidence_strength.slice(1) + '</td></tr>';
  html += '</tbody></table>';

  // Domain response rate bars
  html += '<div class="lm-report-section-title">Domain Response Rates</div>';
  html += '<div style="margin-bottom:20px;">';
  [
    { key: 'architecture',  label: 'Architecture',  color: LM_COLORS.architecture },
    { key: 'execution',     label: 'Execution',      color: LM_COLORS.execution },
    { key: 'context_guard', label: 'Context-Guard',  color: LM_COLORS.context },
  ].forEach(function(d) {
    var rate = stats.domain_response_rates[d.key] || 0;
    var pct  = (rate * 100).toFixed(1);
    html += '<div class="lm-response-rate-row">';
    html += '<div class="lm-rr-label">' + _lmEsc(d.label) + '</div>';
    html += '<div class="lm-rr-track"><div class="lm-rr-fill" style="width:' + pct + '%;background:' + d.color + ';"></div></div>';
    html += '<div class="lm-rr-val">' + pct + '%</div>';
    html += '</div>';
  });
  html += '</div>';

  // Phenotype transition bars (pure SVG-free horizontal bars)
  var transKeys = Object.keys(stats.phenotype_transitions);
  if (transKeys.length) {
    html += '<div class="lm-report-section-title">Phenotype Transitions</div>';
    var maxCount = Math.max.apply(null, transKeys.map(function(k) { return stats.phenotype_transitions[k]; }));
    html += '<div style="margin-bottom:20px;">';
    transKeys
      .sort(function(a, b) { return stats.phenotype_transitions[b] - stats.phenotype_transitions[a]; })
      .forEach(function(key) {
        var count = stats.phenotype_transitions[key];
        var barW  = maxCount > 0 ? (count / maxCount * 100).toFixed(1) : '0';
        html += '<div class="lm-transition-row">';
        html += '<div class="lm-tr-label" title="' + _lmEsc(key) + '">' + _lmEsc(key) + '</div>';
        html += '<div class="lm-tr-track"><div class="lm-tr-fill" style="width:' + barW + '%;"></div></div>';
        html += '<div class="lm-tr-val">' + count + '</div>';
        html += '</div>';
      });
    html += '</div>';
  }

  // Mean PE delta by condition
  var condKeys = Object.keys(stats.avg_pe_delta_by_condition);
  if (condKeys.length) {
    html += '<div class="lm-report-section-title">Mean PE Change by Condition</div>';
    html += '<table class="lm-report-summary-table"><thead><tr><th>Condition</th><th>Mean PE Delta</th><th>Direction</th></tr></thead><tbody>';
    condKeys.forEach(function(cond) {
      var delta = stats.avg_pe_delta_by_condition[cond];
      var dir   = delta >  0.005 ? 'Improving' : delta < -0.005 ? 'Declining' : 'Stable';
      var col   = delta >  0.005 ? '#10b981'   : delta < -0.005 ? '#ef4444'   : '#6b8099';
      html += '<tr>';
      html += '<td>' + _lmEsc(cond) + '</td>';
      html += '<td style="color:' + col + '">' + (delta >= 0 ? '+' : '') + delta.toFixed(3) + '</td>';
      html += '<td style="color:' + col + '">' + dir + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  html += '</div>';
  container.innerHTML = html;
}

window.renderLongitudinalDashboard = renderLongitudinalDashboard;
