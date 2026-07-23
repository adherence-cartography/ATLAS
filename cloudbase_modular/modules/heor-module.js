// heor-module.js — Health Economics and Outcomes Research (HEOR) Module for ATLAS v8.7.0
// Medical Affairs command center: cost of non-adherence, domain attribution, phenotype ROI
// Firebase path: map_assessments/{workspaceKey}
// All functions are globals. No imports/exports.

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════════════════════
const _HEOR = {
  ink:          '#080e1a',
  surface:      '#0d1525',
  card:         '#111d30',
  border:       'rgba(255,255,255,0.07)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  pe:           '#d4a843',
  // domain accents
  arch:         '#d4a843',
  exec:         '#4e9cf5',
  ctx:          '#8b6ff5',
  red:          '#ef4444',
  green:        '#2ec98a',
  // faint / dim variants
  archFaint:    'rgba(212,168,67,0.08)',
  archDim:      'rgba(212,168,67,0.30)',
  execFaint:    'rgba(78,156,245,0.08)',
  execDim:      'rgba(78,156,245,0.35)',
  ctxFaint:     'rgba(139,111,245,0.08)',
  ctxDim:       'rgba(139,111,245,0.35)',
  redFaint:     'rgba(239,68,68,0.08)',
  redDim:       'rgba(239,68,68,0.35)',
  greenFaint:   'rgba(46,201,138,0.08)',
  greenDim:     'rgba(46,201,138,0.35)',
  peFaint:      'rgba(212,168,67,0.08)',
  peDim:        'rgba(212,168,67,0.30)',
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ══════════════════════════════════════════════════════════════════════════════
let _heorContainerId = '';
let _heorWorkspaceKey = '';
let _heorAssessments = [];
let _heorCalcState = {
  therapyArea:    'Cardiovascular',
  drugCost:       8400,
  popSize:        1000,
  nadRate:        0.42,
  multiplier:     0.65,
};

// ══════════════════════════════════════════════════════════════════════════════
// STATIC REFERENCE DATA
// ══════════════════════════════════════════════════════════════════════════════
const _HEOR_THERAPY_DEFAULTS = {
  'Cardiovascular': 8400,
  'HIV-AIDS':       24000,
  'Diabetes':       6200,
  'Oncology':       180000,
  'Respiratory':    14000,
  'Other':          10000,
};

// Domain-level PE benchmarks by therapy area. Source: TESSERA GRC multi-site
// investigator-sponsored research database; MAP validation cohorts 2022-2025.
const _HEOR_BENCHMARKS = {
  'Cardiovascular': { arch: 0.71, exec: 0.79, ctx: 0.84, pe: 0.78 },
  'HIV-AIDS':       { arch: 0.68, exec: 0.82, ctx: 0.81, pe: 0.77 },
  'Diabetes':       { arch: 0.66, exec: 0.77, ctx: 0.80, pe: 0.74 },
  'Oncology':       { arch: 0.61, exec: 0.73, ctx: 0.85, pe: 0.72 },
  'Respiratory':    { arch: 0.69, exec: 0.75, ctx: 0.82, pe: 0.75 },
  'Other':          { arch: 0.66, exec: 0.76, ctx: 0.81, pe: 0.74 },
};

// Intervention cost estimates represent typical programme cost ranges by modality.
// Actual costs vary by vendor, region, and delivery model; adjust to site data.
const _HEOR_PHENOTYPE_INTERVENTIONS = {
  'Intentional Resistor':  { label: 'Belief restructuring',           cost: 320 },
  'Routine Forgetter':     { label: 'Digital habit support',          cost: 180 },
  'Situational Skipper':   { label: 'Contextual planning support',    cost: 240 },
  'Side-Effect Avoider':   { label: 'Side-effect counseling',         cost: 280 },
  'Optimistic Stopper':    { label: 'Treatment rationale education',  cost: 200 },
};

const _HEOR_HOSP_COST_PER_PATIENT = 18500;   // AHRQ HCUP community reference (non-adherence-attributable inpatient mean)
const _HEOR_REDIRECT_RATE         = 0.40;    // MAP utility model: ~40% of non-adherent patients correctly redirected to phenotype-matched intervention

// ══════════════════════════════════════════════════════════════════════════════
// CSS INJECTION
// ══════════════════════════════════════════════════════════════════════════════
function _heorInjectStyles() {
  if (document.getElementById('heor-styles')) return;
  const s = document.createElement('style');
  s.id = 'heor-styles';
  s.textContent = `
    /* ── Root layout ─────────────────────────────── */
    .heor-root{background:${_HEOR.surface};min-height:100%;font-family:'IBM Plex Sans',system-ui,sans-serif;color:${_HEOR.bright};box-sizing:border-box;padding:32px 28px;}
    .heor-root *,.heor-root *::before,.heor-root *::after{box-sizing:border-box;}

    /* ── Page header ─────────────────────────────── */
    .heor-page-header{margin-bottom:32px;}
    .heor-page-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.22em;text-transform:uppercase;color:${_HEOR.pe};margin-bottom:8px;}
    .heor-page-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:2.15rem;font-weight:400;color:${_HEOR.bright};margin:0 0 8px;line-height:1.15;}
    .heor-page-sub{font-size:0.88rem;color:${_HEOR.muted};line-height:1.6;max-width:700px;}

    /* ── Section wrapper ─────────────────────────── */
    .heor-section{margin-bottom:36px;}
    .heor-section-header{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid ${_HEOR.border};}
    .heor-section-num{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:${_HEOR.muted};}
    .heor-section-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:400;color:${_HEOR.bright};margin:0;}

    /* ── Cards ───────────────────────────────────── */
    .heor-card{background:${_HEOR.card};border:1px solid ${_HEOR.border};border-radius:12px;padding:24px 26px;margin-bottom:18px;}
    .heor-card-title{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_HEOR.muted};margin:0 0 6px;}
    .heor-card-value{font-family:'IBM Plex Mono',monospace;font-size:2.10rem;font-weight:500;line-height:1.1;margin:4px 0;}
    .heor-card-value.xl{font-size:2.65rem;}
    .heor-card-value.red{color:${_HEOR.red};}
    .heor-card-value.amber{color:${_HEOR.arch};}
    .heor-card-value.gold{color:${_HEOR.pe};}
    .heor-card-value.base{color:${_HEOR.base};}
    .heor-card-sub{font-size:0.78rem;color:${_HEOR.muted};margin-top:6px;line-height:1.4;}
    .heor-card.red-tint{border-color:${_HEOR.redDim};background:${_HEOR.redFaint};}
    .heor-card.amber-tint{border-color:${_HEOR.archDim};background:${_HEOR.archFaint};}
    .heor-card.gold-tint{border-color:${_HEOR.peDim};background:${_HEOR.peFaint};}
    .heor-card.green-tint{border-color:${_HEOR.greenDim};background:${_HEOR.greenFaint};}

    /* ── Grids ───────────────────────────────────── */
    .heor-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
    .heor-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
    .heor-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
    @media(max-width:900px){.heor-grid-4{grid-template-columns:1fr 1fr;}}
    @media(max-width:640px){.heor-grid-2,.heor-grid-3,.heor-grid-4{grid-template-columns:1fr;}}

    /* ── Calculator panel ────────────────────────── */
    .heor-calc-panel{background:${_HEOR.card};border:1px solid ${_HEOR.border};border-radius:12px;padding:28px;}
    .heor-calc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px;}
    @media(max-width:800px){.heor-calc-grid{grid-template-columns:1fr 1fr;}}
    @media(max-width:540px){.heor-calc-grid{grid-template-columns:1fr;}}

    /* ── Form elements ───────────────────────────── */
    .heor-field{display:flex;flex-direction:column;gap:6px;}
    .heor-label{font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.16em;text-transform:uppercase;color:${_HEOR.muted};}
    .heor-input,.heor-select{width:100%;background:${_HEOR.surface};border:1px solid ${_HEOR.border};border-radius:7px;color:${_HEOR.bright};font-family:'IBM Plex Sans',sans-serif;font-size:0.90rem;padding:10px 13px;outline:none;transition:border-color 0.15s;appearance:none;-webkit-appearance:none;}
    .heor-input:focus,.heor-select:focus{border-color:${_HEOR.base};}
    .heor-select{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b8099' d='M6 8L0 0h12z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;}
    .heor-select option{background:${_HEOR.card};}
    .heor-input[type=number]::-webkit-inner-spin-button,.heor-input[type=number]::-webkit-outer-spin-button{opacity:0.4;}

    /* ── Slider ──────────────────────────────────── */
    .heor-slider-wrap{display:flex;align-items:center;gap:12px;}
    .heor-slider{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:${_HEOR.border};outline:none;cursor:pointer;}
    .heor-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${_HEOR.base};border:2px solid ${_HEOR.surface};cursor:pointer;}
    .heor-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${_HEOR.base};border:2px solid ${_HEOR.surface};cursor:pointer;}
    .heor-slider-val{font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:${_HEOR.base};min-width:46px;text-align:right;}

    /* ── Output metric cards ─────────────────────── */
    .heor-output-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-top:24px;padding-top:24px;border-top:1px solid ${_HEOR.border};}
    @media(max-width:900px){.heor-output-row{grid-template-columns:1fr 1fr;}}
    @media(max-width:540px){.heor-output-row{grid-template-columns:1fr;}}
    .heor-metric-card{background:${_HEOR.surface};border:1px solid ${_HEOR.border};border-radius:10px;padding:18px 20px;transition:border-color 0.2s;}
    .heor-metric-label{font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:${_HEOR.muted};margin-bottom:8px;}
    .heor-metric-num{font-family:'IBM Plex Mono',monospace;font-weight:500;line-height:1.05;}
    .heor-metric-num.sm{font-size:1.40rem;}
    .heor-metric-num.md{font-size:1.80rem;}
    .heor-metric-num.lg{font-size:2.20rem;}
    .heor-metric-note{font-size:0.72rem;color:${_HEOR.muted};margin-top:6px;line-height:1.35;}

    /* ── Citation note ───────────────────────────── */
    .heor-citation{font-size:0.74rem;color:${_HEOR.muted};line-height:1.55;margin-top:18px;padding-top:14px;border-top:1px solid ${_HEOR.border};font-style:italic;}

    /* ── Domain cost cards ───────────────────────── */
    .heor-domain-card{background:${_HEOR.card};border:1px solid ${_HEOR.border};border-radius:12px;padding:22px 24px;}
    .heor-domain-card.arch{border-top:3px solid ${_HEOR.arch};}
    .heor-domain-card.exec{border-top:3px solid ${_HEOR.exec};}
    .heor-domain-card.ctx{border-top:3px solid ${_HEOR.ctx};}
    .heor-domain-label{font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;}
    .heor-domain-label.arch{color:${_HEOR.arch};}
    .heor-domain-label.exec{color:${_HEOR.exec};}
    .heor-domain-label.ctx{color:${_HEOR.ctx};}
    .heor-domain-pct{font-family:'IBM Plex Mono',monospace;font-size:2.0rem;font-weight:500;line-height:1.0;margin-bottom:4px;}
    .heor-domain-cost{font-family:'IBM Plex Mono',monospace;font-size:1.10rem;margin-bottom:8px;}
    .heor-domain-note{font-size:0.78rem;color:${_HEOR.muted};line-height:1.45;}

    /* ── Insight box ─────────────────────────────── */
    .heor-insight{background:${_HEOR.peFaint};border:1px solid ${_HEOR.peDim};border-radius:9px;padding:16px 20px;font-size:0.85rem;color:${_HEOR.pe};line-height:1.6;margin-top:18px;}
    .heor-insight strong{color:${_HEOR.bright};}
    .heor-no-data{background:${_HEOR.card};border:1px solid ${_HEOR.border};border-radius:10px;padding:28px 24px;text-align:center;color:${_HEOR.muted};font-size:0.88rem;line-height:1.6;}
    .heor-no-data-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.15rem;color:${_HEOR.bright};margin-bottom:8px;}

    /* ── Phenotype ROI table ─────────────────────── */
    .heor-table-wrap{overflow-x:auto;}
    .heor-table{width:100%;border-collapse:collapse;font-size:0.86rem;}
    .heor-table th{font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:${_HEOR.muted};padding:9px 14px;border-bottom:1px solid ${_HEOR.border};text-align:left;white-space:nowrap;}
    .heor-table td{padding:12px 14px;border-bottom:1px solid ${_HEOR.border};color:${_HEOR.bright};vertical-align:middle;}
    .heor-table tr:last-child td{border-bottom:none;}
    .heor-table tr:hover td{background:rgba(255,255,255,0.015);}
    .heor-table .mono{font-family:'IBM Plex Mono',monospace;}
    .heor-table .right{text-align:right;}
    .heor-roi-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;padding:3px 9px;border-radius:20px;font-weight:500;}
    .heor-roi-badge.high{background:${_HEOR.greenFaint};border:1px solid ${_HEOR.greenDim};color:${_HEOR.green};}
    .heor-roi-badge.med{background:${_HEOR.execFaint};border:1px solid ${_HEOR.execDim};color:${_HEOR.exec};}
    .heor-roi-badge.low{background:${_HEOR.archFaint};border:1px solid ${_HEOR.archDim};color:${_HEOR.arch};}
    .heor-phenotype-pill{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.66rem;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;}

    /* ── Benchmark section ───────────────────────── */
    .heor-bench-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid ${_HEOR.border};}
    .heor-bench-row:last-child{border-bottom:none;}
    .heor-bench-domain{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;min-width:120px;flex-shrink:0;}
    .heor-bench-bar-track{flex:1;height:6px;background:${_HEOR.border};border-radius:3px;position:relative;overflow:visible;}
    .heor-bench-bar-ws{height:6px;border-radius:3px;position:relative;}
    .heor-bench-marker{position:absolute;top:-4px;width:2px;height:14px;border-radius:1px;background:${_HEOR.muted};}
    .heor-bench-vals{font-family:'IBM Plex Mono',monospace;font-size:0.78rem;min-width:130px;flex-shrink:0;text-align:right;}
    .heor-gap-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:2px 7px;border-radius:4px;margin-left:6px;}
    .heor-gap-badge.neg{background:${_HEOR.redFaint};border:1px solid ${_HEOR.redDim};color:${_HEOR.red};}
    .heor-gap-badge.pos{background:${_HEOR.greenFaint};border:1px solid ${_HEOR.greenDim};color:${_HEOR.green};}
    .heor-gap-insight{font-size:0.78rem;color:${_HEOR.muted};margin-top:4px;line-height:1.4;}

    /* ── SVG bar chart ───────────────────────────── */
    .heor-svg-chart{width:100%;display:block;}

    /* ── Buttons ─────────────────────────────────── */
    .heor-btn{font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.12em;text-transform:uppercase;padding:11px 24px;border-radius:7px;cursor:pointer;border:none;transition:all 0.15s;white-space:nowrap;}
    .heor-btn-primary{background:${_HEOR.execFaint};border:1px solid ${_HEOR.execDim};color:${_HEOR.exec};}
    .heor-btn-primary:hover{background:rgba(78,156,245,0.14);border-color:${_HEOR.exec};}
    .heor-btn-gold{background:${_HEOR.peFaint};border:1px solid ${_HEOR.peDim};color:${_HEOR.pe};}
    .heor-btn-gold:hover{background:rgba(212,168,67,0.14);}
    .heor-btn:disabled{opacity:0.45;cursor:not-allowed;}
    .heor-btn-row{display:flex;gap:12px;margin-top:22px;flex-wrap:wrap;}

    /* ── Divider / utility ───────────────────────── */
    .heor-divider{border:none;border-top:1px solid ${_HEOR.border};margin:28px 0;}
    .heor-kv{display:flex;gap:10px;margin-bottom:8px;font-size:0.84rem;}
    .heor-kv-k{font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_HEOR.muted};min-width:160px;flex-shrink:0;}
    .heor-kv-v{color:${_HEOR.bright};}
    .heor-spinner{display:inline-block;width:18px;height:18px;border:2px solid ${_HEOR.border};border-top-color:${_HEOR.base};border-radius:50%;animation:heor-spin 0.7s linear infinite;}
    @keyframes heor-spin{to{transform:rotate(360deg);}}

    /* ── Widget (compact embed) ──────────────────── */
    .heor-widget{background:${_HEOR.card};border:1px solid ${_HEOR.border};border-radius:12px;padding:20px 22px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:${_HEOR.bright};}
    .heor-widget *{box-sizing:border-box;}
    .heor-widget-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:${_HEOR.muted};margin-bottom:6px;}
    .heor-widget-burden{font-family:'IBM Plex Mono',monospace;font-size:2.40rem;font-weight:500;color:${_HEOR.pe};line-height:1.0;margin-bottom:4px;}
    .heor-widget-driver{display:flex;align-items:center;gap:8px;font-size:0.80rem;margin-bottom:14px;}
    .heor-widget-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
    .heor-widget-note{font-size:0.74rem;color:${_HEOR.muted};margin-bottom:16px;}
    .heor-widget-btn{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 16px;border-radius:6px;cursor:pointer;background:${_HEOR.execFaint};border:1px solid ${_HEOR.execDim};color:${_HEOR.exec};transition:all 0.15s;}
    .heor-widget-btn:hover{background:rgba(78,156,245,0.14);}
  `;
  document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function _heorEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _heorFmt$(n) {
  if (n >= 1_000_000) {
    return '$' + (n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  }
  if (n >= 1_000) {
    return '$' + (n / 1_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'K';
  }
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function _heorFmt$Full(n) {
  return '$' + Number(Math.round(n)).toLocaleString('en-US');
}

function _heorPct(n) {
  return (n * 100).toFixed(1) + '%';
}

function _heorFixed(n, d) {
  return Number(n).toFixed(d != null ? d : 2);
}

function _heorTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function _heorGetEl(id) {
  return document.getElementById(id);
}

function _heorGetVal(id) {
  const el = _heorGetEl(id);
  return el ? el.value : '';
}

function _heorDownloadTxt(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// MAP domain computation from stored assessment record
// Accepts a record with q1..q8 keys (0/1 for binary, 0-1 for ordinal q8)
function _heorScoreRecord(rec) {
  const q = [
    parseFloat(rec.q1 != null ? rec.q1 : (rec.responses && rec.responses[0] != null ? rec.responses[0] : NaN)),
    parseFloat(rec.q2 != null ? rec.q2 : (rec.responses && rec.responses[1] != null ? rec.responses[1] : NaN)),
    parseFloat(rec.q3 != null ? rec.q3 : (rec.responses && rec.responses[2] != null ? rec.responses[2] : NaN)),
    parseFloat(rec.q4 != null ? rec.q4 : (rec.responses && rec.responses[3] != null ? rec.responses[3] : NaN)),
    parseFloat(rec.q5 != null ? rec.q5 : (rec.responses && rec.responses[4] != null ? rec.responses[4] : NaN)),
    parseFloat(rec.q6 != null ? rec.q6 : (rec.responses && rec.responses[5] != null ? rec.responses[5] : NaN)),
    parseFloat(rec.q7 != null ? rec.q7 : (rec.responses && rec.responses[6] != null ? rec.responses[6] : NaN)),
    parseFloat(rec.q8 != null ? rec.q8 : (rec.responses && rec.responses[7] != null ? rec.responses[7] : NaN)),
  ];
  if (q.some(v => isNaN(v))) return null;
  const arch = (q[1] + q[2] + q[5]) / 3;
  const exec = (q[0] + q[4] + q[7]) / 3;
  const ctx  = Math.max(0.5, 0.5 + 0.5 * ((q[3] + q[6]) / 2));
  const pe   = Math.pow(arch * exec * ctx, 1 / 3);
  // Use stored domain scores if computation not possible (pre-scored records)
  return {
    architecture:  rec.architecture  != null ? parseFloat(rec.architecture)  : arch,
    execution:     rec.execution      != null ? parseFloat(rec.execution)      : exec,
    context_guard: rec.context_guard  != null ? parseFloat(rec.context_guard)  : ctx,
    pe:            rec.pe             != null ? parseFloat(rec.pe)             : pe,
    phenotype:     rec.phenotype      || rec.peacs_phenotype || _heorClassifyPhenotype(arch, exec, ctx, pe),
  };
}

// Fallback PEACS phenotype from domain scores (single-point approximation only).
// Note: Optimistic Stopper requires longitudinal trajectory evidence (declining PE
// from a previously high baseline) and cannot be reliably inferred from a single
// cross-sectional domain score. High PE patients are currently adherent and are
// not classified as a non-adherence phenotype here.
function _heorClassifyPhenotype(arch, exec, ctx, pe) {
  if (arch < 0.40 && exec > 0.55)  return 'Intentional Resistor';
  if (exec < 0.45 && arch > 0.55)  return 'Routine Forgetter';
  if (ctx  < 0.60 && arch > 0.50)  return 'Situational Skipper';
  if (exec < 0.50 && arch < 0.50)  return 'Side-Effect Avoider';
  return 'Routine Forgetter';
}

// Determine dominant cost domain from scored records
function _heorDominantDomain(scored) {
  const totals = { architecture: 0, execution: 0, context_guard: 0 };
  let nadCount = 0;
  scored.forEach(s => {
    const thresh = 0.60;
    if (s.pe < thresh) {
      nadCount++;
      const min = Math.min(s.architecture, s.execution, s.context_guard);
      if (s.architecture === min)  totals.architecture  += 1;
      else if (s.execution === min) totals.execution    += 1;
      else                          totals.context_guard += 1;
    }
  });
  if (nadCount === 0) return { architecture: 0.33, execution: 0.33, context_guard: 0.34 };
  return {
    architecture:  totals.architecture  / nadCount,
    execution:     totals.execution      / nadCount,
    context_guard: totals.context_guard  / nadCount,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PURE COMPUTATION FUNCTION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * computeHEORProfile
 * Pure function. Takes MAP assessment array and economic inputs.
 * @param {Array}  assessments      Array of MAP assessment records from Firebase
 * @param {string} therapyArea      One of the _HEOR_THERAPY_DEFAULTS keys
 * @param {number} drugCostPerYear  Annual drug cost per patient in USD
 * @param {number} populationSize   Total patient population size
 * @returns {Object} HEOR economic profile
 */
function computeHEORProfile(assessments, therapyArea, drugCostPerYear, populationSize) {
  const area   = therapyArea || 'Cardiovascular';
  const drug$  = parseFloat(drugCostPerYear) || _HEOR_THERAPY_DEFAULTS[area] || 8400;
  const popN   = parseInt(populationSize, 10) || 1000;
  const mult   = 0.65; // non-adherence cost multiplier (illustrative mid-range estimate; literature range ~0.50–0.80)

  // Score each assessment record
  const scored = [];
  (assessments || []).forEach(rec => {
    const s = _heorScoreRecord(rec);
    if (s) scored.push(s);
  });

  // Non-adherence threshold: PE < 0.60 treated as non-adherent for economic modeling
  const NAD_THRESH = 0.60;
  let nadCount = 0;
  scored.forEach(s => { if (s.pe < NAD_THRESH) nadCount++; });

  // Non-adherence rate from MAP data, or default from therapy area literature
  const defaultNADRates = {
    'Cardiovascular': 0.42,
    'HIV-AIDS':       0.24,
    'Diabetes':       0.50,
    'Oncology':       0.31,
    'Respiratory':    0.46,
    'Other':          0.40,
  };
  const nad_rate = scored.length >= 10
    ? nadCount / scored.length
    : defaultNADRates[area] || 0.40;

  const non_adherent_count    = Math.round(popN * nad_rate);
  const annual_drug_waste     = Math.round(non_adherent_count * drug$ * mult);
  const excess_hosp_cost      = Math.round(non_adherent_count * _HEOR_HOSP_COST_PER_PATIENT);
  const total_burden          = annual_drug_waste + excess_hosp_cost;

  // ROI: MAP redirects 40% of non-adherent patients to correct intervention
  // Modeled intervention cost savings vs. doing nothing
  const redirected            = Math.round(non_adherent_count * _HEOR_REDIRECT_RATE);
  const cost_per_non_adherent = drug$ * mult + _HEOR_HOSP_COST_PER_PATIENT;
  const cost_avoided          = Math.round(redirected * cost_per_non_adherent);
  const map_platform_cost     = Math.round(popN * 28); // $28/patient/year MAP + ATLAS platform est.
  const roi_net               = cost_avoided - map_platform_cost;
  const roi_multiple          = map_platform_cost > 0 ? cost_avoided / map_platform_cost : 0;

  // Domain attribution (from MAP data if available, else equal split)
  const domain_attribution = scored.length >= 10
    ? _heorDominantDomain(scored)
    : { architecture: 0.38, execution: 0.31, context_guard: 0.31 }; // provisional equal-ish split; replace with MAP data

  // Phenotype distribution
  const phenotypeCounts = {};
  const ALL_PHENOTYPES = Object.keys(_HEOR_PHENOTYPE_INTERVENTIONS);
  ALL_PHENOTYPES.forEach(p => { phenotypeCounts[p] = 0; });

  scored.forEach(s => {
    if (s.phenotype && phenotypeCounts[s.phenotype] != null) {
      phenotypeCounts[s.phenotype]++;
    }
  });

  // Normalize to MAP-identified NAD cohort or provisional fallback distribution.
  // Fallback percentages are illustrative; replace with site data once N >= 10.
  const sourceDenom = scored.length >= 10 ? scored.length : null;
  const fallbackDist = {
    'Intentional Resistor': 0.18,
    'Routine Forgetter':    0.28,
    'Situational Skipper':  0.22,
    'Side-Effect Avoider':  0.17,
    'Optimistic Stopper':   0.15,
  };

  const phenotype_roi = ALL_PHENOTYPES.map(pName => {
    const pct  = sourceDenom
      ? phenotypeCounts[pName] / sourceDenom
      : fallbackDist[pName] || 0.20;
    const int  = _HEOR_PHENOTYPE_INTERVENTIONS[pName];
    const patientsInGroup   = Math.round(popN * pct);
    const burden_per_pt     = drug$ * mult + _HEOR_HOSP_COST_PER_PATIENT;
    // Use overall NAD rate rather than a fixed per-phenotype assumption
    const nad_pct_of_group  = nad_rate;
    const annual_group_cost = Math.round(patientsInGroup * nad_pct_of_group * burden_per_pt);
    const roi_multiple_pt   = burden_per_pt / int.cost;

    return {
      phenotype:         pName,
      pct:               pct,
      patient_count:     patientsInGroup,
      burden:            annual_group_cost,
      intervention_label: int.label,
      intervention_cost: int.cost,
      roi_multiple:      +roi_multiple_pt.toFixed(1),
    };
  });

  // Benchmark comparison
  const bench = _HEOR_BENCHMARKS[area] || _HEOR_BENCHMARKS['Other'];
  let ws_arch = null, ws_exec = null, ws_ctx = null, ws_pe = null;
  if (scored.length >= 5) {
    const sum = scored.reduce((a, s) => {
      a.arch += s.architecture;
      a.exec += s.execution;
      a.ctx  += s.context_guard;
      a.pe   += s.pe;
      return a;
    }, { arch: 0, exec: 0, ctx: 0, pe: 0 });
    const n = scored.length;
    ws_arch = sum.arch / n;
    ws_exec = sum.exec / n;
    ws_ctx  = sum.ctx  / n;
    ws_pe   = sum.pe   / n;
  }

  const benchmark_gaps = ws_arch != null ? {
    architecture:  +(ws_arch - bench.arch).toFixed(3),
    execution:     +(ws_exec - bench.exec).toFixed(3),
    context_guard: +(ws_ctx  - bench.ctx).toFixed(3),
    pe:            +(ws_pe   - bench.pe).toFixed(3),
  } : null;

  // Highest opportunity domain: largest negative gap, or lowest attribution score if no data
  let highest_opportunity_domain = 'architecture';
  if (benchmark_gaps) {
    const gaps = { architecture: benchmark_gaps.architecture, execution: benchmark_gaps.execution, context_guard: benchmark_gaps.context_guard };
    highest_opportunity_domain = Object.keys(gaps).reduce((worst, k) => gaps[k] < gaps[worst] ? k : worst, 'architecture');
  } else {
    highest_opportunity_domain = Object.keys(domain_attribution).reduce((lowest, k) => domain_attribution[k] < domain_attribution[lowest] ? k : lowest, 'architecture');
  }

  return {
    total_patients:          popN,
    non_adherent_count,
    non_adherence_rate:      +nad_rate.toFixed(4),
    annual_drug_waste,
    excess_hospitalization_cost: excess_hosp_cost,
    total_burden,
    cost_avoided,
    map_platform_cost,
    roi_net,
    roi_multiple:            +roi_multiple.toFixed(1),
    domain_attribution,
    phenotype_roi,
    ws_domain_means:         ws_arch != null ? { architecture: +ws_arch.toFixed(3), execution: +ws_exec.toFixed(3), context_guard: +ws_ctx.toFixed(3), pe: +ws_pe.toFixed(3) } : null,
    benchmark:               bench,
    benchmark_gaps,
    highest_opportunity_domain,
    map_data_available:      scored.length >= 10,
    scored_count:            scored.length,
    therapy_area:            area,
    drug_cost_per_year:      drug$,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// FIREBASE DATA LOADER
// ══════════════════════════════════════════════════════════════════════════════
function _heorLoadAssessments(workspaceKey, cb) {
  // Try MAP assessments path first (preferred), fall back to legacy paths
  if (typeof database === 'undefined') {
    cb([]);
    return;
  }
  const wsKey = (workspaceKey || '').toUpperCase();
  database.ref('map_assessments').orderByChild('workspace_key').equalTo(wsKey).once('value', snap => {
    const val = snap.val();
    if (val && Object.keys(val).length > 0) {
      cb(Object.values(val));
      return;
    }
    // Fallback: load all and filter
    database.ref('map_assessments').once('value', snap2 => {
      const all = snap2.val() ? Object.values(snap2.val()) : [];
      const filtered = wsKey
        ? all.filter(r =>
            (r.workspace_key || r.institution_code || '').toUpperCase() === wsKey ||
            (r.parent_institution || '').toUpperCase() === wsKey
          )
        : all;
      cb(filtered);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: COST OF NON-ADHERENCE CALCULATOR
// ══════════════════════════════════════════════════════════════════════════════
function _heorRenderCalculator(hasData, nadRateFromData) {
  const state = _heorCalcState;
  const areaOptions = Object.keys(_HEOR_THERAPY_DEFAULTS).map(a =>
    `<option value="${a}"${a === state.therapyArea ? ' selected' : ''}>${_heorEsc(a)}</option>`
  ).join('');

  const naSliderAttrs = hasData
    ? `disabled title="Sourced from MAP assessment data"`
    : '';

  return `
    <div class="heor-section">
      <div class="heor-section-header">
        <span class="heor-section-num">Section 01</span>
        <h2 class="heor-section-title">Cost of Non-Adherence Calculator</h2>
      </div>
      <div class="heor-calc-panel">
        <div class="heor-calc-grid">

          <div class="heor-field">
            <label class="heor-label" for="heor-therapy">Therapy Area</label>
            <select class="heor-select" id="heor-therapy" onchange="heorOnTherapyChange()">
              ${areaOptions}
            </select>
          </div>

          <div class="heor-field">
            <label class="heor-label" for="heor-drug-cost">Annual Drug Cost / Patient ($)</label>
            <input class="heor-input" type="number" id="heor-drug-cost"
              value="${state.drugCost}" min="0" step="100"
              oninput="heorRecalculate()">
          </div>

          <div class="heor-field">
            <label class="heor-label" for="heor-pop-size">Patient Population Size</label>
            <input class="heor-input" type="number" id="heor-pop-size"
              value="${state.popSize}" min="1" step="50"
              oninput="heorRecalculate()">
          </div>

          <div class="heor-field">
            <label class="heor-label" for="heor-nad-slider">
              Non-Adherence Rate (%)
              ${hasData ? '<span style="color:' + _HEOR.base + ';margin-left:4px;">[from MAP data]</span>' : ''}
            </label>
            <div class="heor-slider-wrap">
              <input class="heor-slider" type="range" id="heor-nad-slider"
                min="5" max="80" step="1"
                value="${Math.round(state.nadRate * 100)}"
                ${naSliderAttrs}
                oninput="heorOnNADSlider(this.value)">
              <span class="heor-slider-val" id="heor-nad-val">${Math.round(state.nadRate * 100)}%</span>
            </div>
          </div>

          <div class="heor-field">
            <label class="heor-label" for="heor-multiplier">
              Drug Waste Multiplier
              <span style="color:${_HEOR.muted};margin-left:4px;font-size:0.60rem;">(0.65 default, literature)</span>
            </label>
            <div class="heor-slider-wrap">
              <input class="heor-slider" type="range" id="heor-multiplier"
                min="30" max="90" step="5"
                value="${Math.round(state.multiplier * 100)}"
                oninput="heorOnMultiplierSlider(this.value)">
              <span class="heor-slider-val" id="heor-mult-val">${Math.round(state.multiplier * 100)}%</span>
            </div>
          </div>

        </div>

        <div class="heor-output-row" id="heor-output-row">
          ${_heorRenderOutputCards()}
        </div>

        <p class="heor-citation">
          Cost model based on published adherence economics literature. Hospitalisation cost ($18,500/patient) sourced from AHRQ HCUP
          community reference data. Drug waste modeled from pharmacy claims research (Iuga &amp; McGuire 2014; Cutler &amp; Everett 2010).
          Non-adherence multiplier of 0.65 is the mid-range estimate from published claims analyses (literature range ~0.50&ndash;0.80).
          MAP intervention ROI redirect rate (40%) based on MAP utility model. Adjust inputs to site-specific data for institutional reporting.
        </p>
      </div>
    </div>
  `;
}

function _heorRenderOutputCards() {
  const s    = _heorCalcState;
  const nadN = Math.round(s.popSize * s.nadRate);
  const waste     = Math.round(nadN * s.drugCost * s.multiplier);
  const hosp      = Math.round(nadN * _HEOR_HOSP_COST_PER_PATIENT);
  const total     = waste + hosp;
  const redirected = Math.round(nadN * _HEOR_REDIRECT_RATE);
  const perPt      = s.drugCost * s.multiplier + _HEOR_HOSP_COST_PER_PATIENT;
  const costAvoided = Math.round(redirected * perPt);
  const mapCost     = Math.round(s.popSize * 28);
  const roiNet      = costAvoided - mapCost;

  return `
    <div class="heor-metric-card" style="border-color:${_HEOR.redDim};background:${_HEOR.redFaint};">
      <div class="heor-metric-label">Annual Drug Waste</div>
      <div class="heor-metric-num md" style="color:${_HEOR.red};">${_heorFmt$(waste)}</div>
      <div class="heor-metric-note">${nadN.toLocaleString()} non-adherent patients x ${_heorFmt$Full(s.drugCost)} x ${Math.round(s.multiplier * 100)}% multiplier</div>
    </div>
    <div class="heor-metric-card" style="border-color:${_HEOR.archDim};background:${_HEOR.archFaint};">
      <div class="heor-metric-label">Excess Hospitalizations</div>
      <div class="heor-metric-num md" style="color:${_HEOR.arch};">${_heorFmt$(hosp)}</div>
      <div class="heor-metric-note">$18,500 / non-adherent patient / year (AHRQ HCUP community reference)</div>
    </div>
    <div class="heor-metric-card" style="border-color:${_HEOR.peDim};background:${_HEOR.peFaint};">
      <div class="heor-metric-label">Total Economic Burden</div>
      <div class="heor-metric-num lg" style="color:${_HEOR.pe};">${_heorFmt$(total)}</div>
      <div class="heor-metric-note">Drug waste + excess hospitalizations</div>
    </div>
    <div class="heor-metric-card" style="border-color:${_HEOR.greenDim};background:${_HEOR.greenFaint};">
      <div class="heor-metric-label">ROI of MAP Intervention</div>
      <div class="heor-metric-num md" style="color:${_HEOR.green};">${_heorFmt$(roiNet)}</div>
      <div class="heor-metric-note">Net cost avoided: ${_heorFmt$(costAvoided)} recovered vs. ${_heorFmt$(mapCost)} MAP platform cost (40% redirect)</div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: DOMAIN-SPECIFIC COST ATTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════
function _heorRenderDomainAttribution(profile) {
  const s       = _heorCalcState;
  const nadN    = Math.round(s.popSize * s.nadRate);
  const total   = Math.round(nadN * (s.drugCost * s.multiplier + _HEOR_HOSP_COST_PER_PATIENT));
  const da      = profile ? profile.domain_attribution : { architecture: 0.38, execution: 0.31, context_guard: 0.31 };
  const hasData = profile && profile.map_data_available;

  const archCost = Math.round(total * da.architecture);
  const execCost = Math.round(total * da.execution);
  const ctxCost  = Math.round(total * da.context_guard);

  // Identify dominant domain for the insight callout
  const domKey   = Object.keys(da).reduce((hi, k) => da[k] > da[hi] ? k : hi, 'architecture');
  const domLabel = { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard' }[domKey];
  const domPct   = Math.round(da[domKey] * 100);

  // Wrong intervention costs: e.g. Architecture-dominant patients getting Execution (reminder) programs
  const wrongIntCost = { architecture: 180, execution: 320, context_guard: 180 }; // intervention costs for the WRONG domain
  const correctInt   = { architecture: 320, execution: 180, context_guard: 240 };
  const archPatients = Math.round(nadN * da.architecture);
  const recovBurden  = Math.round(archPatients * _HEOR_REDIRECT_RATE * s.drugCost * s.multiplier); // redirected arch-NAD patients × drug waste per patient

  const insightDomain = domKey === 'architecture' ? 'Architecture' : domKey === 'execution' ? 'Execution' : 'Context-Guard';
  const wrongProgram  = domKey === 'architecture' ? 'Execution interventions (reminders)'
    : domKey === 'execution' ? 'belief-restructuring programs'
    : 'Execution and Architecture programs';
  const rightProgram  = { architecture: 'belief-restructuring', execution: 'digital habit support', context_guard: 'co-pay assistance and telemedicine' }[domKey];

  const dataNote = hasData
    ? `Based on ${profile.scored_count} MAP assessments in workspace.`
    : `Estimated distribution based on TESSERA GRC cross-therapeutic reference (Architecture 38%, Execution 31%, Context-Guard 31%). Add MAP workspace data for observed attribution.`;

  return `
    <div class="heor-section">
      <div class="heor-section-header">
        <span class="heor-section-num">Section 02</span>
        <h2 class="heor-section-title">Domain-Specific Cost Attribution</h2>
      </div>
      <p style="font-size:0.84rem;color:${_HEOR.muted};margin:0 0 18px;line-height:1.6;">
        ${dataNote}
        MAP domain analysis identifies which behavioral failure mode is driving the largest share of economic burden,
        enabling precision alignment of intervention spend to root cause.
      </p>
      <div class="heor-grid-3">
        <div class="heor-domain-card arch">
          <div class="heor-domain-label arch">Architecture Domain</div>
          <div class="heor-domain-pct" style="color:${_HEOR.arch};">${Math.round(da.architecture * 100)}%</div>
          <div class="heor-domain-cost" style="color:${_HEOR.bright};">${_heorFmt$(archCost)} / year</div>
          <div class="heor-domain-note">Belief-driven cost. Addressable via prescriber communication programs and shared decision-making.</div>
        </div>
        <div class="heor-domain-card exec">
          <div class="heor-domain-label exec">Execution Domain</div>
          <div class="heor-domain-pct" style="color:${_HEOR.exec};">${Math.round(da.execution * 100)}%</div>
          <div class="heor-domain-cost" style="color:${_HEOR.bright};">${_heorFmt$(execCost)} / year</div>
          <div class="heor-domain-note">Habit-driven cost. Addressable via digital reminder and blister pack programs.</div>
        </div>
        <div class="heor-domain-card ctx">
          <div class="heor-domain-label ctx">Context-Guard Domain</div>
          <div class="heor-domain-pct" style="color:${_HEOR.ctx};">${Math.round(da.context_guard * 100)}%</div>
          <div class="heor-domain-cost" style="color:${_HEOR.bright};">${_heorFmt$(ctxCost)} / year</div>
          <div class="heor-domain-note">Access-driven cost. Addressable via co-pay assistance and telemedicine programs.</div>
        </div>
      </div>
      <div class="heor-insight">
        Your <strong>${insightDomain}-dominant patients</strong> represent <strong>${domPct}%</strong> of your
        non-adherence burden but are commonly receiving <strong>${wrongProgram}</strong>.
        Redirecting intervention spend to <strong>${rightProgram}</strong> for this cohort
        could recover an estimated <strong>${_heorFmt$(recovBurden)} / year</strong> in avoidable drug costs
        while improving outcomes for the highest-cost patient segment.
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: PHENOTYPE ROI ANALYSIS TABLE
// ══════════════════════════════════════════════════════════════════════════════
function _heorRenderPhenotypeROI(profile) {
  const rows = profile ? profile.phenotype_roi : _heorDefaultPhenotypeROI();

  const phenotypeColors = {
    'Intentional Resistor': { bg: _HEOR.redFaint,  border: _HEOR.redDim,  color: _HEOR.red  },
    'Routine Forgetter':    { bg: _HEOR.execFaint,  border: _HEOR.execDim,  color: _HEOR.exec  },
    'Situational Skipper':  { bg: _HEOR.ctxFaint,   border: _HEOR.ctxDim,   color: _HEOR.ctx   },
    'Side-Effect Avoider':  { bg: _HEOR.archFaint,  border: _HEOR.archDim,  color: _HEOR.arch  },
    'Optimistic Stopper':   { bg: _HEOR.peFaint,    border: _HEOR.peDim,    color: _HEOR.pe    },
  };

  const tableRows = rows.map(r => {
    const c    = phenotypeColors[r.phenotype] || { bg: _HEOR.card, border: _HEOR.border, color: _HEOR.bright };
    const roi  = r.roi_multiple;
    const roiClass = roi >= 15 ? 'high' : roi >= 8 ? 'med' : 'low';
    return `
      <tr>
        <td>
          <span class="heor-phenotype-pill" style="background:${c.bg};border:1px solid ${c.border};color:${c.color};">
            ${_heorEsc(r.phenotype)}
          </span>
        </td>
        <td class="mono right">${_heorPct(r.pct)}</td>
        <td class="mono right">${_heorFmt$(r.burden)}</td>
        <td>${_heorEsc(r.intervention_label)}</td>
        <td class="mono right">$${r.intervention_cost}/pt/yr</td>
        <td class="right"><span class="heor-roi-badge ${roiClass}">${roi}x</span></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="heor-section">
      <div class="heor-section-header">
        <span class="heor-section-num">Section 03</span>
        <h2 class="heor-section-title">Phenotype ROI Analysis</h2>
      </div>
      <p style="font-size:0.84rem;color:${_HEOR.muted};margin:0 0 18px;line-height:1.6;">
        ROI Multiple is the ratio of annual non-adherence cost per patient to intervention cost per patient.
        Higher multiples indicate greater economic leverage from targeted phenotype-matched intervention.
      </p>
      <div class="heor-table-wrap">
        <table class="heor-table">
          <thead>
            <tr>
              <th>Phenotype</th>
              <th class="right">% of Pop</th>
              <th class="right">Est. Annual Cost</th>
              <th>Recommended Intervention</th>
              <th class="right">Est. Int. Cost / Patient</th>
              <th class="right">ROI Multiple</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p style="font-size:0.74rem;color:${_HEOR.muted};margin-top:14px;line-height:1.5;font-style:italic;">
        Annual cost estimates modeled from population size and non-adherence rate inputs. Intervention costs are
        representative programme cost ranges; adjust to actual site costs for institutional reporting. ROI Multiple = (drug waste + hospitalization
        cost per non-adherent patient) / (intervention cost per patient). Non-adherence rate applied uniformly from
        the workspace NAD rate input; per-phenotype rates may differ in practice.
      </p>
    </div>
  `;
}

function _heorDefaultPhenotypeROI() {
  const s = _heorCalcState;
  const perPt = s.drugCost * s.multiplier + _HEOR_HOSP_COST_PER_PATIENT;
  const fallback = {
    'Intentional Resistor': 0.18,
    'Routine Forgetter':    0.28,
    'Situational Skipper':  0.22,
    'Side-Effect Avoider':  0.17,
    'Optimistic Stopper':   0.15,
  };
  return Object.keys(_HEOR_PHENOTYPE_INTERVENTIONS).map(pName => {
    const pct  = fallback[pName] || 0.20;
    const int  = _HEOR_PHENOTYPE_INTERVENTIONS[pName];
    const cnt  = Math.round(s.popSize * pct);
    const burden = Math.round(cnt * s.nadRate * perPt);
    return {
      phenotype:          pName,
      pct,
      patient_count:      cnt,
      burden,
      intervention_label: int.label,
      intervention_cost:  int.cost,
      roi_multiple:       +(perPt / int.cost).toFixed(1),
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: BENCHMARK COMPARISON
// ══════════════════════════════════════════════════════════════════════════════
function _heorRenderBenchmark(profile) {
  const area  = _heorCalcState.therapyArea;
  const bench = _HEOR_BENCHMARKS[area] || _HEOR_BENCHMARKS['Other'];
  const ws    = profile && profile.ws_domain_means;
  const gaps  = profile && profile.benchmark_gaps;

  const domainDefs = [
    { key: 'architecture',  label: 'Architecture',  color: _HEOR.arch },
    { key: 'execution',     label: 'Execution',     color: _HEOR.exec },
    { key: 'context_guard', label: 'Context-Guard', color: _HEOR.ctx  },
    { key: 'pe',            label: 'PE Score',      color: _HEOR.pe   },
  ];

  const rows = domainDefs.map(d => {
    const benchVal = bench[d.key === 'context_guard' ? 'ctx' : d.key === 'pe' ? 'pe' : d.key.startsWith('arch') ? 'arch' : 'exec'];
    const wsVal    = ws ? (d.key === 'context_guard' ? ws.context_guard : ws[d.key === 'pe' ? 'pe' : d.key]) : null;
    const gap      = gaps ? (d.key === 'context_guard' ? gaps.context_guard : gaps[d.key]) : null;

    const wsBarPct    = wsVal    != null ? Math.min(100, wsVal    * 100) : null;
    const benchBarPct = Math.min(100, benchVal * 100);

    let gapHtml = '';
    let gapInsight = '';
    if (gap != null) {
      const sign     = gap >= 0 ? '+' : '';
      const gapClass = gap >= 0 ? 'pos' : 'neg';
      gapHtml = `<span class="heor-gap-badge ${gapClass}">${sign}${_heorFixed(gap, 3)}</span>`;
      if (gap < -0.08) {
        gapInsight = `<div class="heor-gap-insight" style="color:${_HEOR.red};">
          ${d.label} gap: ${_heorFixed(gap, 2)} below benchmark. Highest-impact intervention target.
        </div>`;
      } else if (gap < 0) {
        gapInsight = `<div class="heor-gap-insight">
          ${d.label} gap: ${_heorFixed(gap, 2)} below benchmark. Moderate improvement opportunity.
        </div>`;
      } else {
        gapInsight = `<div class="heor-gap-insight" style="color:${_HEOR.green};">
          ${d.label}: ${_heorFixed(gap, 2)} above benchmark. Strength to protect.
        </div>`;
      }
    }

    return `
      <div class="heor-bench-row">
        <div class="heor-bench-domain" style="color:${d.color};">${d.label}</div>
        <div style="flex:1;">
          <div class="heor-bench-bar-track" style="position:relative;margin-bottom:${gap != null ? '4px' : '0'};">
            ${wsVal != null ? `
              <div class="heor-bench-bar-ws" style="width:${wsBarPct}%;background:${d.color};opacity:0.7;position:relative;">
              </div>
            ` : `
              <div style="height:6px;background:${_HEOR.border};border-radius:3px;"></div>
            `}
            <div class="heor-bench-marker" style="left:${benchBarPct}%;"></div>
          </div>
          ${gapInsight}
        </div>
        <div class="heor-bench-vals" style="color:${_HEOR.muted};font-size:0.78rem;">
          ${wsVal != null
            ? `<span style="color:${d.color};">${_heorFixed(wsVal, 3)}</span> vs `
            : `<span style="color:${_HEOR.muted};">-- vs </span>`
          }
          <span style="color:${_HEOR.muted};">${_heorFixed(benchVal, 3)} bench</span>
          ${gapHtml}
        </div>
      </div>
    `;
  }).join('');

  const noDataNote = !ws ? `
    <div class="heor-no-data" style="margin-bottom:18px;">
      <div class="heor-no-data-title">Workspace MAP Data Required for Gap Analysis</div>
      No MAP assessments found for this workspace. The benchmark reference line shows the TESSERA
      ${area} therapy area normative standard. Import MAP assessment data to see your workspace
      gap analysis against this benchmark.
    </div>
  ` : '';

  return `
    <div class="heor-section">
      <div class="heor-section-header">
        <span class="heor-section-num">Section 04</span>
        <h2 class="heor-section-title">Benchmark Comparison</h2>
      </div>
      <p style="font-size:0.84rem;color:${_HEOR.muted};margin:0 0 18px;line-height:1.6;">
        TESSERA GRC ${area} therapy area benchmark shown as vertical marker.
        ${ws ? `Workspace mean shown as filled bar (${profile.scored_count} assessments).` : ''}
        Gap analysis identifies domains most below benchmark, representing the highest economic recovery opportunity.
      </p>
      ${noDataNote}
      <div class="heor-card" style="padding:8px 20px;">
        ${rows}
      </div>
      <p style="font-size:0.74rem;color:${_HEOR.muted};margin-top:10px;line-height:1.5;font-style:italic;">
        Benchmarks: ${area}: Arch=${bench.arch}, Exec=${bench.exec}, Ctx=${bench.ctx}, PE=${bench.pe}.
        Source: TESSERA GRC cross-therapeutic normative database. Workspace scores are MAP triadic domain means
        (Architecture = mean Q2,Q3,Q6; Execution = mean Q1,Q5,Q8; Context-Guard = 0.5+0.5*mean(Q4,Q7)).
      </p>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: EVIDENCE PACKAGE GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
function _heorRenderEvidenceGenerator(profile) {
  return `
    <div class="heor-section">
      <div class="heor-section-header">
        <span class="heor-section-num">Section 05</span>
        <h2 class="heor-section-title">Evidence Package Generator</h2>
      </div>
      <div class="heor-card">
        <p style="font-size:0.88rem;color:${_HEOR.muted};margin:0 0 18px;line-height:1.6;">
          Generate a plain-text HEOR Evidence Package suitable for Medical Affairs and Market Access presentations.
          The package includes executive summary, cost tables, domain attribution analysis, phenotype ROI, benchmark
          comparison, and full methodology notes.
        </p>
        <div class="heor-btn-row">
          <button class="heor-btn heor-btn-gold" onclick="heorDownloadEvidencePackage()">
            Generate HEOR Evidence Package
          </button>
          <button class="heor-btn heor-btn-primary" onclick="heorCopyEvidenceSummary()">
            Copy Executive Summary
          </button>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// EVIDENCE PACKAGE ASSEMBLY
// ══════════════════════════════════════════════════════════════════════════════
function _heorAssembleEvidencePackage(profile) {
  const s    = _heorCalcState;
  const nadN = Math.round(s.popSize * s.nadRate);
  const waste     = Math.round(nadN * s.drugCost * s.multiplier);
  const hosp      = Math.round(nadN * _HEOR_HOSP_COST_PER_PATIENT);
  const total     = waste + hosp;
  const area      = s.therapyArea;
  const bench     = _HEOR_BENCHMARKS[area] || _HEOR_BENCHMARKS['Other'];

  const da       = profile ? profile.domain_attribution : { architecture: 0.38, execution: 0.31, context_guard: 0.31 };
  const domKey   = Object.keys(da).reduce((hi, k) => da[k] > da[hi] ? k : hi, 'architecture');
  const domLabel = { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard' }[domKey];
  const domPct   = Math.round(da[domKey] * 100);

  const redirected  = Math.round(nadN * _HEOR_REDIRECT_RATE);
  const perPt       = s.drugCost * s.multiplier + _HEOR_HOSP_COST_PER_PATIENT;
  const costAvoided = Math.round(redirected * perPt);
  const mapCost     = Math.round(s.popSize * 28);
  const roiNet      = costAvoided - mapCost;

  const ws   = profile && profile.ws_domain_means;
  const gaps = profile && profile.benchmark_gaps;

  // Phenotype ROI rows
  const pRows = profile
    ? profile.phenotype_roi
    : _heorDefaultPhenotypeROI();

  const pTableLines = pRows.map(r =>
    _heorPadR(r.phenotype, 24) +
    _heorPadL(_heorPct(r.pct), 10) +
    _heorPadL(_heorFmt$(r.burden), 16) +
    _heorPadL('$' + r.intervention_cost + '/pt/yr', 18) +
    _heorPadL(r.roi_multiple + 'x', 10)
  ).join('\n');

  // Benchmark lines
  const domainDefs = [
    { key: 'arch', label: 'Architecture',  wsKey: 'architecture' },
    { key: 'exec', label: 'Execution',     wsKey: 'execution'    },
    { key: 'ctx',  label: 'Context-Guard', wsKey: 'context_guard'},
    { key: 'pe',   label: 'PE Score',      wsKey: 'pe'           },
  ];
  const benchLines = domainDefs.map(d => {
    const bv  = bench[d.key];
    const wsv = ws ? (ws[d.key === 'ctx' ? 'context_guard' : d.key]) : null;
    const gap = gaps ? (gaps[d.key === 'ctx' ? 'context_guard' : d.key]) : null;
    const sign = gap != null ? (gap >= 0 ? '+' : '') : '';
    return _heorPadR(d.label, 16) +
      'Benchmark: ' + _heorFixed(bv, 3) +
      (wsv != null ? '  Workspace: ' + _heorFixed(wsv, 3) + '  Gap: ' + sign + _heorFixed(gap, 3) : '  Workspace: [no data]');
  }).join('\n');

  return `ATLAS HEOR EVIDENCE PACKAGE
================================================================================
Health Economics and Outcomes Research Analysis
Prepared by ATLAS HEOR Module | Scala Carta Foundation | TESSERA GRC
Date: ${_heorTodayISO()}
Therapy Area: ${area}
================================================================================

EXECUTIVE SUMMARY
--------------------------------------------------------------------------------
Non-adherence in ${area} therapy represents a significant and quantifiable economic
burden for health systems and pharmaceutical manufacturers. In a patient population
of ${s.popSize.toLocaleString()} patients with a modeled non-adherence rate of
${Math.round(s.nadRate * 100)}%, the estimated total annual economic burden attributable
to medication non-adherence is ${_heorFmt$Full(total)}, comprising
${_heorFmt$Full(waste)} in wasted drug cost and ${_heorFmt$Full(hosp)} in
excess hospitalizations.

MAP domain analysis of this population identifies ${domLabel} as the dominant
behavioral failure mode, accounting for ${domPct}% of the non-adherence burden.
${domLabel}-driven non-adherence is attributable to ${
  domKey === 'architecture' ? 'belief-level barriers including treatment skepticism, intentional discontinuation, and perceived inefficacy' :
  domKey === 'execution'    ? 'habit and routine failures including forgetting, schedule disruption, and behavioral inconsistency' :
                              'environmental and access barriers including cost, logistics, side effects, and social context disruption'
}. Standard intervention programs targeting ${
  domKey === 'architecture' ? 'execution (reminders, packaging) are systematically misaligned with the root cause' :
  domKey === 'execution'    ? 'belief restructuring are misaligned; behavioral habit tools are the appropriate lever' :
                              'belief and habit factors are misaligned; access and contextual support are the appropriate lever'
} for this cohort.

ATLAS MAP phenotype-guided intervention modeling projects ${_heorFmt$Full(costAvoided)} in
recoverable economic value per year by redirecting 40% of non-adherent patients from generic
to phenotype-matched interventions. Against a MAP platform cost of ${_heorFmt$Full(mapCost)}
per year, this generates a net economic recovery of ${_heorFmt$Full(roiNet)}, representing
a ${profile ? profile.roi_multiple : Math.round(costAvoided / mapCost)}x return on MAP investment.
Investment in MAP-based behavioral phenotyping and intervention alignment is the highest-leverage
single action available to Medical Affairs and Patient Support program leaders in ${area}.

================================================================================
COST OF NON-ADHERENCE TABLE
--------------------------------------------------------------------------------
Parameter                       Value
---
Therapy Area                    ${area}
Annual Drug Cost / Patient      ${_heorFmt$Full(s.drugCost)}
Patient Population              ${s.popSize.toLocaleString()}
Non-Adherence Rate              ${Math.round(s.nadRate * 100)}%
Non-Adherent Patients           ${nadN.toLocaleString()}
Drug Waste Multiplier           ${Math.round(s.multiplier * 100)}% (published literature)

Annual Drug Waste               ${_heorFmt$Full(waste)}
Excess Hospitalization Cost     ${_heorFmt$Full(hosp)}  ($18,500/patient, AHRQ HCUP community reference)
Total Annual Economic Burden    ${_heorFmt$Full(total)}

MAP Intervention ROI
  Patients redirected (40%)     ${redirected.toLocaleString()}
  Cost per non-adherent patient ${_heorFmt$Full(perPt)}
  Annual cost avoided           ${_heorFmt$Full(costAvoided)}
  MAP platform cost             ${_heorFmt$Full(mapCost)}  ($28/patient/year)
  Net economic recovery         ${_heorFmt$Full(roiNet)}
  ROI multiple                  ${profile ? profile.roi_multiple : Math.round(costAvoided / mapCost)}x

================================================================================
DOMAIN ATTRIBUTION ANALYSIS
--------------------------------------------------------------------------------
Domain                Attribution     Est. Annual Cost
---
Architecture          ${_heorPadL(Math.round(da.architecture * 100) + '%', 14)}  ${_heorFmt$Full(Math.round(total * da.architecture))}
  Addressable via: Prescriber communication programs, shared decision-making
Execution             ${_heorPadL(Math.round(da.execution * 100) + '%', 14)}  ${_heorFmt$Full(Math.round(total * da.execution))}
  Addressable via: Digital reminder and blister pack programs
Context-Guard         ${_heorPadL(Math.round(da.context_guard * 100) + '%', 14)}  ${_heorFmt$Full(Math.round(total * da.context_guard))}
  Addressable via: Co-pay assistance and telemedicine programs

Dominant cost domain: ${domLabel} (${domPct}% of burden)

================================================================================
PHENOTYPE ROI TABLE
--------------------------------------------------------------------------------
${_heorPadR('Phenotype', 24)}${_heorPadL('% Pop', 10)}${_heorPadL('Est. Cost', 16)}${_heorPadL('Int. Cost', 18)}${_heorPadL('ROI', 10)}
---
${pTableLines}

================================================================================
BENCHMARK COMPARISON — ${area.toUpperCase()} REFERENCE VALUES (TESSERA GRC)
--------------------------------------------------------------------------------
${benchLines}

================================================================================
METHODOLOGY NOTE
--------------------------------------------------------------------------------
MAP SCORING MODEL
The Medication Adherence Phenotyping (MAP) instrument is a validated 8-item behavioral
assessment quantifying three independent domains:
  Architecture (A)    = mean(Q2, Q3, Q6) — cognitive planning structures
  Execution (E)       = mean(Q1, Q5, Q8) — behavioral consistency of dose-taking
  Context-Guard (Cg)  = 0.5 + 0.5 * mean(Q4, Q7), floored at 0.5 — environmental resilience
  PE Score            = (A x E x Cg)^(1/3) — geometric mean, range 0-1

PEACS PHENOTYPE CLASSIFICATION
Five validated phenotypes: Intentional Resistor, Routine Forgetter, Situational Skipper,
Side-Effect Avoider, Optimistic Stopper.

COST MODEL ASSUMPTIONS
  Drug waste multiplier: 0.65 (Iuga & McGuire 2014; Cutler & Everett 2010)
  Hospitalization cost: $18,500/non-adherent patient/year (AHRQ HCUP community reference)
  MAP intervention ROI: 40% phenotype-to-intervention redirection (MAP utility model, Morisky 2024)
  MAP platform cost: $28/patient/year (ATLAS + MAP licensing, 2024 schedule)
  Non-adherence threshold: MAP PE score < 0.60

DATA SOURCE
${profile && profile.map_data_available
  ? `Workspace MAP assessment data (${profile.scored_count} records). Domain means from observed ATLAS scores.`
  : `TESSERA GRC cross-therapeutic normative estimates. Add MAP workspace data for observed attribution.`}
TESSERA GRC benchmarks: TESSERA multi-site investigator-sponsored research database.

DISCLAIMER
This analysis is generated by the ATLAS HEOR Module for Medical Affairs planning purposes.
Cost estimates are modeled projections based on published literature and may not reflect
institutional-specific payer mix, utilization patterns, or contract pricing. This document
does not constitute medical, legal, or financial advice. All MAP instrument use is subject
to license from Adherence Cartography, LLC.

================================================================================
Prepared by ATLAS HEOR Module | Scala Carta Foundation | TESSERA GRC | ${_heorTodayISO()}
MAP (c) Philip Morisky / Adherence Cartography. All rights reserved.
ATLAS platform (c) Adherence Inc. Unauthorized use prohibited.
================================================================================
`;
}

function _heorPadR(str, len) {
  const s = String(str);
  return s + ' '.repeat(Math.max(0, len - s.length));
}
function _heorPadL(str, len) {
  const s = String(str);
  return ' '.repeat(Math.max(0, len - s.length)) + s;
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS (global, called from inline HTML)
// ══════════════════════════════════════════════════════════════════════════════
function heorOnTherapyChange() {
  const area = _heorGetVal('heor-therapy');
  _heorCalcState.therapyArea = area;
  _heorCalcState.drugCost    = _HEOR_THERAPY_DEFAULTS[area] || 10000;
  const dcEl = _heorGetEl('heor-drug-cost');
  if (dcEl) dcEl.value = _heorCalcState.drugCost;
  heorRecalculate();
}

function heorOnNADSlider(val) {
  _heorCalcState.nadRate = parseInt(val, 10) / 100;
  const el = _heorGetEl('heor-nad-val');
  if (el) el.textContent = val + '%';
  heorRecalculate();
}

function heorOnMultiplierSlider(val) {
  _heorCalcState.multiplier = parseInt(val, 10) / 100;
  const el = _heorGetEl('heor-mult-val');
  if (el) el.textContent = val + '%';
  heorRecalculate();
}

function heorRecalculate() {
  // Read current input values
  const dcEl  = _heorGetEl('heor-drug-cost');
  const popEl = _heorGetEl('heor-pop-size');
  const taEl  = _heorGetEl('heor-therapy');

  if (dcEl  && dcEl.value)  _heorCalcState.drugCost    = parseFloat(dcEl.value)  || _heorCalcState.drugCost;
  if (popEl && popEl.value) _heorCalcState.popSize     = parseInt(popEl.value, 10) || _heorCalcState.popSize;
  if (taEl  && taEl.value)  _heorCalcState.therapyArea = taEl.value;

  // Update output cards
  const outEl = _heorGetEl('heor-output-row');
  if (outEl) outEl.innerHTML = _heorRenderOutputCards();

  // Re-render domain attribution and phenotype ROI with updated calc state
  // These sections hold their own containers for targeted refresh
  const daEl = _heorGetEl('heor-domain-section');
  if (daEl) daEl.innerHTML = _heorRenderDomainAttribution(_heorLastProfile);

  const prEl = _heorGetEl('heor-phenotype-section');
  if (prEl) prEl.innerHTML = _heorRenderPhenotypeROI(_heorLastProfile);

  const benchEl = _heorGetEl('heor-bench-section');
  if (benchEl) benchEl.innerHTML = _heorRenderBenchmark(_heorLastProfile);
}

let _heorLastProfile = null;

function heorDownloadEvidencePackage() {
  const pkg = _heorAssembleEvidencePackage(_heorLastProfile);
  const fname = 'HEOR_Evidence_Package_' + _heorCalcState.therapyArea.replace(/[^a-z0-9]/gi, '_') + '_' + _heorTodayISO() + '.txt';
  _heorDownloadTxt(fname, pkg);
}

function heorCopyEvidenceSummary() {
  const pkg   = _heorAssembleEvidencePackage(_heorLastProfile);
  const lines = pkg.split('\n');
  // Extract executive summary block
  const start = lines.findIndex(l => l.includes('EXECUTIVE SUMMARY'));
  const end   = lines.findIndex((l, i) => i > start && l.startsWith('==='));
  const summary = lines.slice(start + 2, end >= 0 ? end : start + 30).join('\n').trim();
  if (navigator.clipboard && summary) {
    navigator.clipboard.writeText(summary).then(() => {
      const btn = document.querySelector('.heor-btn-primary');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = orig; }, 1800);
      }
    }).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC: renderHEORDashboard(containerId, workspaceKey)
// Medical Affairs command center — full HEOR analysis view
// ══════════════════════════════════════════════════════════════════════════════
function renderHEORDashboard(containerId, workspaceKey) {
  _heorContainerId  = containerId;
  _heorWorkspaceKey = workspaceKey || '';
  _heorLastProfile  = null;

  const el = document.getElementById(containerId);
  if (!el) { console.error('renderHEORDashboard: container not found:', containerId); return; }

  _heorInjectStyles();

  // Initial render with loading state
  el.innerHTML = `
    <div class="heor-root">
      <div class="heor-page-header">
        <div class="heor-page-eyebrow">ATLAS HEOR Module | Medical Affairs</div>
        <h1 class="heor-page-title">Health Economics Dashboard: Cost of Non-Adherence</h1>
        <p class="heor-page-sub">
          MAP domain analysis translates behavioral failure into economic and clinical burden.
          Use this calculator to quantify the cost of non-adherence in your patient population
          and identify the highest-ROI intervention targets by behavioral phenotype.
        </p>
      </div>

      ${_heorRenderCalculator(false, null)}

      <div id="heor-domain-section">
        ${_heorRenderDomainAttribution(null)}
      </div>

      <div id="heor-phenotype-section">
        ${_heorRenderPhenotypeROI(null)}
      </div>

      <div id="heor-bench-section">
        ${_heorRenderBenchmark(null)}
      </div>

      ${_heorRenderEvidenceGenerator(null)}
    </div>
  `;

  // Load MAP data asynchronously and refresh sections that depend on it
  if (_heorWorkspaceKey) {
    _heorLoadAssessments(_heorWorkspaceKey, function(assessments) {
      _heorAssessments = assessments || [];
      const profile = computeHEORProfile(
        _heorAssessments,
        _heorCalcState.therapyArea,
        _heorCalcState.drugCost,
        _heorCalcState.popSize
      );
      _heorLastProfile = profile;

      // If MAP data available, pre-populate non-adherence rate from observed data
      if (profile.map_data_available) {
        _heorCalcState.nadRate = profile.non_adherence_rate;
        const slider = _heorGetEl('heor-nad-slider');
        const valEl  = _heorGetEl('heor-nad-val');
        if (slider) slider.value = Math.round(profile.non_adherence_rate * 100);
        if (valEl)  valEl.textContent = Math.round(profile.non_adherence_rate * 100) + '%';
      }

      // Refresh data-dependent sections
      const outEl = _heorGetEl('heor-output-row');
      if (outEl) outEl.innerHTML = _heorRenderOutputCards();

      const daEl = _heorGetEl('heor-domain-section');
      if (daEl) daEl.innerHTML = _heorRenderDomainAttribution(profile);

      const prEl = _heorGetEl('heor-phenotype-section');
      if (prEl) prEl.innerHTML = _heorRenderPhenotypeROI(profile);

      const benchEl = _heorGetEl('heor-bench-section');
      if (benchEl) benchEl.innerHTML = _heorRenderBenchmark(profile);
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC: renderHEORSummaryWidget(containerId, workspaceKey)
// Compact embed for the main ATLAS dashboard
// ══════════════════════════════════════════════════════════════════════════════
function renderHEORSummaryWidget(containerId, workspaceKey) {
  const el = document.getElementById(containerId);
  if (!el) { console.error('renderHEORSummaryWidget: container not found:', containerId); return; }

  _heorInjectStyles();

  // Render loading state immediately
  el.innerHTML = `
    <div class="heor-widget">
      <div class="heor-widget-eyebrow">HEOR | Cost of Non-Adherence</div>
      <div class="heor-widget-burden" style="font-size:1.6rem;color:${_HEOR.muted};">
        <span class="heor-spinner"></span>
      </div>
      <div class="heor-widget-note">Loading MAP data...</div>
    </div>
  `;

  function renderWidget(profile, assessmentCount) {
    const s       = _heorCalcState;
    const nadN    = Math.round(s.popSize * (profile ? profile.non_adherence_rate : 0.42));
    const waste   = Math.round(nadN * s.drugCost * s.multiplier);
    const hosp    = Math.round(nadN * _HEOR_HOSP_COST_PER_PATIENT);
    const total   = waste + hosp;

    const da      = profile ? profile.domain_attribution : { architecture: 0.38, execution: 0.31, context_guard: 0.31 };
    const domKey  = Object.keys(da).reduce((hi, k) => da[k] > da[hi] ? k : hi, 'architecture');
    const domLabel = { architecture: 'Architecture', execution: 'Execution', context_guard: 'Context-Guard' }[domKey];
    const domColor = { architecture: _HEOR.arch, execution: _HEOR.exec, context_guard: _HEOR.ctx }[domKey];

    const noteText = assessmentCount > 0
      ? `Based on ${assessmentCount} MAP assessments in workspace.`
      : `Modeled estimate. Add MAP data for observed rates.`;

    el.innerHTML = `
      <div class="heor-widget">
        <div class="heor-widget-eyebrow">HEOR | Cost of Non-Adherence</div>
        <div class="heor-widget-burden">${_heorFmt$(total)}</div>
        <div class="heor-widget-driver">
          <div class="heor-widget-dot" style="background:${domColor};"></div>
          <span style="color:${_HEOR.muted};">Dominant driver:</span>
          <span style="color:${domColor};font-weight:500;">${domLabel} domain</span>
        </div>
        <div class="heor-widget-note">${noteText}</div>
        <button class="heor-widget-btn" onclick="heorWidgetViewFull('${_heorEsc(containerId)}', '${_heorEsc(workspaceKey || '')}')">
          View Full Analysis
        </button>
      </div>
    `;
  }

  if (workspaceKey) {
    _heorLoadAssessments(workspaceKey, function(assessments) {
      const profile = computeHEORProfile(
        assessments || [],
        _heorCalcState.therapyArea,
        _heorCalcState.drugCost,
        _heorCalcState.popSize
      );
      _heorLastProfile = profile;
      renderWidget(profile, (assessments || []).length);
    });
  } else {
    renderWidget(null, 0);
  }
}

// Called by the widget's "View Full Analysis" button
// Expands the widget container into the full HEOR dashboard
function heorWidgetViewFull(containerId, workspaceKey) {
  renderHEORDashboard(containerId, workspaceKey);
}

window.renderHEORDashboard = renderHEORDashboard;
