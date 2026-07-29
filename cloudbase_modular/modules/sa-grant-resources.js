// sa-grant-resources.js: Grant Resource Center - templates, funding board, letter of support, TESSERA GRC membership
// Entry point: window.saGrantResourcesInit(container)
// Firebase paths: consortium_support_requests/{timestamp}, consortium_members/{uid}
// All functions prefixed window.saGrant* or _sgr*

// ══════════════════════════════════════════════════════════════════════════════
// GRANT RESOURCE CENTER: Researcher / PI workspace module
// ══════════════════════════════════════════════════════════════════════════════

const _CGR = window._ATLAS_COLORS || {
  bg:'#070e1d', bg2:'#0a1527', surface:'#0d1b2e',
  border:'rgba(212,168,67,0.12)', borderB:'rgba(212,168,67,0.26)',
  amber:'#d4a843', amberDim:'rgba(212,168,67,0.55)', amberFaint:'rgba(212,168,67,0.09)',
  cyan:'#38bdf8', cyanDim:'rgba(56,189,248,0.5)',
  green:'#2ec98a', greenDim:'rgba(46,201,138,0.45)', greenFaint:'rgba(46,201,138,0.08)',
  red:'#ef4444', blue:'#4e9cf5', purple:'#8b6ff5',
  text:'rgba(205,216,232,0.92)', muted:'rgba(138,160,184,0.8)',
  dim:'rgba(96,120,152,0.65)', navy:'rgba(212,168,67,0.06)',
};

// ── TESSERA hex logo helper ───────────────────────────────────────────────────
// Returns the 19-hex diamond SVG at the requested pixel size.
// Each call gets a unique filter ID so multiple instances on the same page don't collide.
let _sgrLogoSeq = 0;
function _sgrTesseraLogo(w, h, extraStyle) {
  const id = 'sgr-hglow-' + (++_sgrLogoSeq);
  return `<svg width="${w}" height="${h}" viewBox="0 0 104 96" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;${extraStyle||''}" aria-label="TESSERA GRC">
    <defs><filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>
    <polygon points="31.17,0 41.56,6 41.56,18 31.17,24 20.78,18 20.78,6"    fill="none"                   stroke="rgba(212,168,67,0.28)"  stroke-width="0.85"/>
    <polygon points="51.95,0 62.34,6 62.34,18 51.95,24 41.56,18 41.56,6"    fill="rgba(212,168,67,0.20)"  stroke="rgba(212,168,67,0.42)"  stroke-width="0.85"/>
    <polygon points="72.73,0 83.12,6 83.12,18 72.73,24 62.34,18 62.34,6"    fill="none"                   stroke="rgba(16,185,129,0.25)"  stroke-width="0.85"/>
    <polygon points="20.78,18 31.17,24 31.17,36 20.78,42 10.39,36 10.39,24" fill="rgba(139,111,245,0.22)" stroke="rgba(139,111,245,0.40)" stroke-width="0.85"/>
    <polygon points="41.56,18 51.95,24 51.95,36 41.56,42 31.17,36 31.17,24" fill="rgba(212,168,67,0.52)"  stroke="rgba(212,168,67,0.65)"  stroke-width="0.85"/>
    <polygon points="62.34,18 72.73,24 72.73,36 62.34,42 51.95,36 51.95,24" fill="rgba(6,182,212,0.48)"   stroke="rgba(6,182,212,0.62)"   stroke-width="0.85"/>
    <polygon points="83.12,18 93.51,24 93.51,36 83.12,42 72.73,36 72.73,24" fill="rgba(16,185,129,0.20)"  stroke="rgba(16,185,129,0.38)"  stroke-width="0.85"/>
    <polygon points="10.39,36 20.78,42 20.78,54 10.39,60 0,54 0,42"         fill="none"                   stroke="rgba(6,182,212,0.22)"   stroke-width="0.85"/>
    <polygon points="31.17,36 41.56,42 41.56,54 31.17,60 20.78,54 20.78,42" fill="rgba(6,182,212,0.68)"   stroke="rgba(6,182,212,0.80)"   stroke-width="0.85"/>
    <polygon points="51.95,36 62.34,42 62.34,54 51.95,60 41.56,54 41.56,42" fill="#D4A843"                stroke="rgba(212,168,67,0.88)"  stroke-width="1.1" filter="url(#${id})" opacity="0.92"/>
    <polygon points="72.73,36 83.12,42 83.12,54 72.73,60 62.34,54 62.34,42" fill="rgba(16,185,129,0.68)"  stroke="rgba(16,185,129,0.80)"  stroke-width="0.85"/>
    <polygon points="93.51,36 103.9,42 103.9,54 93.51,60 83.12,54 83.12,42" fill="none"                   stroke="rgba(245,158,11,0.22)"  stroke-width="0.85"/>
    <polygon points="20.78,54 31.17,60 31.17,72 20.78,78 10.39,72 10.39,60" fill="rgba(16,185,129,0.20)"  stroke="rgba(16,185,129,0.38)"  stroke-width="0.85"/>
    <polygon points="41.56,54 51.95,60 51.95,72 41.56,78 31.17,72 31.17,60" fill="rgba(139,111,245,0.50)" stroke="rgba(139,111,245,0.64)" stroke-width="0.85"/>
    <polygon points="62.34,54 72.73,60 72.73,72 62.34,78 51.95,72 51.95,60" fill="rgba(16,185,129,0.48)"  stroke="rgba(16,185,129,0.62)"  stroke-width="0.85"/>
    <polygon points="83.12,54 93.51,60 93.51,72 83.12,78 72.73,72 72.73,60" fill="rgba(212,168,67,0.18)"  stroke="rgba(212,168,67,0.36)"  stroke-width="0.85"/>
    <polygon points="31.17,72 41.56,78 41.56,90 31.17,96 20.78,90 20.78,78" fill="none"                   stroke="rgba(212,168,67,0.25)"  stroke-width="0.85"/>
    <polygon points="51.95,72 62.34,78 62.34,90 51.95,96 41.56,90 41.56,78" fill="rgba(245,158,11,0.20)"  stroke="rgba(245,158,11,0.40)"  stroke-width="0.85"/>
    <polygon points="72.73,72 83.12,78 83.12,90 72.73,96 62.34,90 62.34,78" fill="none"                   stroke="rgba(139,111,245,0.22)" stroke-width="0.85"/>
  </svg>`;
}

// ── Module-level state ────────────────────────────────────────────────────────
let _sgrActiveTab = 'exchange';
let _sgrFundingFilter = 'all';
let _sgrMemberCache = null;
let _sgrRequestsCache = [];

// ── CSS (injected once, idempotent) ──────────────────────────────────────────
function _sgrInjectStyles() {
  if (document.getElementById('sgr-styles')) return;
  const s = document.createElement('style');
  s.id = 'sgr-styles';
  s.textContent = `
    .sgr-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(212,168,67,0.12);margin-bottom:22px;flex-wrap:wrap;}
    .sgr-tab{font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;padding:8px 16px;border:none;background:transparent;color:rgba(96,120,152,0.65);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.14s;white-space:nowrap;}
    .sgr-tab:hover{color:rgba(205,216,232,0.92);}
    .sgr-tab.active{color:#d4a843;border-bottom-color:#d4a843;}
    .sgr-section-title{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-bottom:14px;}
    .sgr-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.18s;}
    .sgr-card:hover{border-color:rgba(212,168,67,0.26);}
    .sgr-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;}
    .sgr-template-title{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:#d4a843;letter-spacing:0.04em;}
    .sgr-template-desc{font-size:0.79rem;color:rgba(138,160,184,0.8);line-height:1.5;}
    .sgr-text-block{font-family:'IBM Plex Mono',monospace;font-size:0.76rem;background:#070e1d;border:1px solid rgba(212,168,67,0.12);border-radius:6px;padding:12px 14px;color:rgba(205,216,232,0.85);word-break:break-word;line-height:1.7;white-space:pre-wrap;max-height:180px;overflow-y:auto;}
    .sgr-copy-btn{align-self:flex-end;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid rgba(212,168,67,0.26);background:rgba(212,168,67,0.07);color:#d4a843;cursor:pointer;transition:all 0.12s;}
    .sgr-copy-btn:hover{background:rgba(212,168,67,0.15);}
    .sgr-filter-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;}
    .sgr-filter-btn{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;padding:4px 11px;border-radius:4px;border:1px solid rgba(212,168,67,0.16);background:transparent;color:rgba(96,120,152,0.65);cursor:pointer;transition:all 0.13s;}
    .sgr-filter-btn:hover{color:rgba(205,216,232,0.92);border-color:rgba(212,168,67,0.32);}
    .sgr-filter-btn.active{background:rgba(212,168,67,0.10);border-color:rgba(212,168,67,0.45);color:#d4a843;}
    .sgr-fund-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;}
    .sgr-fund-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:9px;padding:15px 17px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.18s;}
    .sgr-fund-card:hover{border-color:rgba(212,168,67,0.28);}
    .sgr-fund-agency{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.92);}
    .sgr-fund-mech{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:#38bdf8;}
    .sgr-fund-desc{font-size:0.78rem;color:rgba(138,160,184,0.8);line-height:1.55;}
    .sgr-fund-deadline{font-family:'IBM Plex Mono',monospace;font-size:0.67rem;color:rgba(96,120,152,0.65);}
    .sgr-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid;font-weight:500;white-space:nowrap;}
    .sgr-badge-global{color:#38bdf8;border-color:rgba(56,189,248,0.35);background:rgba(56,189,248,0.07);}
    .sgr-badge-usa{color:#d4a843;border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);}
    .sgr-badge-europe{color:#8b6ff5;border-color:rgba(139,111,245,0.35);background:rgba(139,111,245,0.07);}
    .sgr-badge-latam{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sgr-badge-lmic{color:#f97316;border-color:rgba(249,115,22,0.35);background:rgba(249,115,22,0.07);}
    .sgr-badge-bestfit{color:#2ec98a;border-color:rgba(46,201,138,0.40);background:rgba(46,201,138,0.09);}
    .sgr-learn-btn{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:0.67rem;letter-spacing:0.10em;text-transform:uppercase;padding:4px 11px;border-radius:5px;border:1px solid rgba(56,189,248,0.28);background:rgba(56,189,248,0.06);color:#38bdf8;cursor:pointer;transition:all 0.12s;text-decoration:none;display:inline-block;}
    .sgr-learn-btn:hover{background:rgba(56,189,248,0.13);}
    .sgr-form-wrap{max-width:620px;}
    .sgr-form-row{margin-bottom:15px;}
    .sgr-label{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-bottom:5px;display:block;}
    .sgr-input{width:100%;background:#0a1527;border:1px solid rgba(212,168,67,0.12);color:rgba(205,216,232,0.92);font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;transition:border-color 0.14s;}
    .sgr-input:focus{border-color:rgba(212,168,67,0.40);}
    .sgr-select{width:100%;background:#0a1527;border:1px solid rgba(212,168,67,0.12);color:rgba(205,216,232,0.92);font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;cursor:pointer;}
    .sgr-textarea{width:100%;background:#0a1527;border:1px solid rgba(212,168,67,0.12);color:rgba(205,216,232,0.92);font-family:'IBM Plex Mono',monospace;font-size:0.84rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;resize:vertical;min-height:90px;transition:border-color 0.14s;}
    .sgr-textarea:focus{border-color:rgba(212,168,67,0.40);}
    .sgr-checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
    .sgr-checkbox-row input[type=checkbox]{accent-color:#d4a843;width:15px;height:15px;cursor:pointer;}
    .sgr-checkbox-label{font-size:0.82rem;color:rgba(205,216,232,0.92);cursor:pointer;}
    .sgr-submit-btn{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;padding:10px 24px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);background:rgba(212,168,67,0.10);color:#d4a843;cursor:pointer;transition:all 0.14s;}
    .sgr-submit-btn:hover{background:rgba(212,168,67,0.18);}
    .sgr-submit-btn:disabled{opacity:0.45;cursor:not-allowed;}
    .sgr-success-box{background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.28);border-radius:8px;padding:14px 18px;font-size:0.82rem;color:#2ec98a;line-height:1.6;margin-top:14px;}
    .sgr-error-box{background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.28);border-radius:8px;padding:14px 18px;font-size:0.82rem;color:#ef4444;line-height:1.6;margin-top:14px;}
    .sgr-past-req-title{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin:24px 0 10px;}
    .sgr-req-card{background:#0a1527;border:1px solid rgba(212,168,67,0.10);border-radius:8px;padding:12px 15px;font-size:0.79rem;color:rgba(138,160,184,0.8);margin-bottom:9px;line-height:1.6;}
    .sgr-req-study{font-weight:600;color:rgba(205,216,232,0.92);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;}
    .sgr-req-meta{font-family:'IBM Plex Mono',monospace;font-size:0.67rem;color:rgba(96,120,152,0.65);}
    .sgr-tier-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.26);border-radius:12px;padding:22px 24px;margin-bottom:14px;}
    .sgr-tier-name{font-family:'IBM Plex Mono',monospace;font-size:1.0rem;font-weight:700;color:#d4a843;margin-bottom:4px;}
    .sgr-tier-sub{font-size:0.80rem;color:rgba(138,160,184,0.8);margin-bottom:14px;}
    .sgr-tier-stat{display:inline-block;background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.18);border-radius:5px;padding:4px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:#d4a843;margin-right:8px;margin-bottom:6px;}
    .sgr-benefit-list{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:6px;}
    .sgr-benefit-list li{font-size:0.81rem;color:rgba(205,216,232,0.85);padding-left:18px;position:relative;line-height:1.5;}
    .sgr-benefit-list li::before{content:'';position:absolute;left:0;top:7px;width:7px;height:7px;border-radius:50%;background:#2ec98a;}
    .sgr-tier-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:22px;}
    .sgr-tier-option{background:#0a1527;border:1px solid rgba(212,168,67,0.12);border-radius:9px;padding:16px 18px;}
    .sgr-tier-option-name{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:#d4a843;margin-bottom:6px;}
    .sgr-apply-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:9px 22px;border-radius:7px;border:1px solid rgba(46,201,138,0.40);background:rgba(46,201,138,0.09);color:#2ec98a;cursor:pointer;transition:all 0.14s;}
    .sgr-apply-btn:hover{background:rgba(46,201,138,0.17);}
    .sgr-apply-btn:disabled{opacity:0.45;cursor:not-allowed;}
    .sgr-divider{height:1px;background:rgba(212,168,67,0.09);margin:22px 0;}
    .sgr-char-count{font-family:'IBM Plex Mono',monospace;font-size:0.63rem;color:rgba(96,120,152,0.65);text-align:right;margin-top:3px;}
    .sgr-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(212,168,67,0.2);border-top-color:#d4a843;border-radius:50%;animation:sgr-spin 0.7s linear infinite;vertical-align:middle;margin-right:6px;}
    @keyframes sgr-spin{to{transform:rotate(360deg);}}
    .sgr-letters-section{margin-top:32px;}
    .sgr-letter-card{background:#0a1527;border:1px solid rgba(212,168,67,0.12);border-radius:9px;padding:14px 17px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.18s;}
    .sgr-letter-card:hover{border-color:rgba(212,168,67,0.26);}
    .sgr-letter-study{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.92);}
    .sgr-letter-meta{font-family:'IBM Plex Mono',monospace;font-size:0.67rem;color:rgba(96,120,152,0.65);line-height:1.6;}
    .sgr-badge-issued{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sgr-badge-expired{color:#ef4444;border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.06);}
    .sgr-badge-draft{color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);}
    .sgr-contrib-row{display:flex;flex-direction:column;gap:2px;margin-top:10px;padding:10px 12px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.14);border-radius:7px;}
    .sgr-contrib-val{font-family:'IBM Plex Mono',monospace;font-size:1.4rem;font-weight:700;color:#38bdf8;line-height:1.2;}
    .sgr-contrib-label{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-top:2px;}
    .sgr-contrib-sub{font-size:0.72rem;color:rgba(56,189,248,0.6);margin-top:1px;}
    .sgr-reg-section-hdr{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid rgba(212,168,67,0.09);}
    .sgr-study-card{background:#0a1527;border:1px solid rgba(212,168,67,0.12);border-radius:9px;padding:14px 17px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.18s;}
    .sgr-study-card:hover{border-color:rgba(212,168,67,0.26);}
    .sgr-study-title{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.92);}
    .sgr-study-meta{font-family:'IBM Plex Mono',monospace;font-size:0.67rem;color:rgba(96,120,152,0.65);line-height:1.6;}
    .sgr-tessera-id-box{display:flex;align-items:center;gap:8px;background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.22);border-radius:6px;padding:8px 12px;margin-top:4px;}
    .sgr-tessera-id-val{font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:700;color:#2ec98a;letter-spacing:0.06em;flex:1;}
    .sgr-badge-status-pending{color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);}
    .sgr-badge-status-approved{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sgr-badge-status-rejected{color:#ef4444;border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.06);}
    .sgr-phase-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(56,189,248,0.30);background:rgba(56,189,248,0.06);color:#38bdf8;white-space:nowrap;}
    .rex-feed{display:flex;flex-direction:column;gap:10px;}
    .rex-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.18s;}
    .rex-card:hover{border-color:rgba(212,168,67,0.28);}
    .rex-type-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;padding:2px 7px;border-radius:10px;border:1px solid;font-weight:500;white-space:nowrap;}
    .rex-title{font-size:0.90rem;font-weight:700;color:rgba(205,216,232,0.92);line-height:1.35;margin:2px 0;}
    .rex-meta{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:rgba(96,120,152,0.65);}
    .rex-desc{font-size:0.79rem;color:rgba(138,160,184,0.8);line-height:1.55;}
    .rex-countries{font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:#38bdf8;}
    .rex-contact-btn{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid rgba(212,168,67,0.28);background:rgba(212,168,67,0.07);color:#d4a843;cursor:pointer;transition:all 0.12s;text-decoration:none;display:inline-block;}
    .rex-contact-btn:hover{background:rgba(212,168,67,0.15);}
    .rex-empty{text-align:center;padding:48px 24px;color:rgba(96,120,152,0.65);font-size:0.83rem;line-height:1.9;}
    .rex-action-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .rex-count{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:rgba(96,120,152,0.65);margin-left:auto;}
    .rex-post-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
    .rex-back-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;background:transparent;border:none;color:rgba(96,120,152,0.65);cursor:pointer;padding:0;transition:color 0.12s;}
    .rex-back-btn:hover{color:rgba(205,216,232,0.92);}
    .rex-my-card{background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:rgba(212,168,67,0.8);margin-bottom:14px;}
  `;
  document.head.appendChild(s);
}

// ── Data: Grant Templates ─────────────────────────────────────────────────────
const _SGR_TEMPLATES = [
  {
    id: 'platform-desc',
    title: 'ATLAS Platform Description',
    desc: 'For any grant application: general platform introduction',
    text: 'This study will utilize the ATLAS (Adherence Tracking and Longitudinal Assessment System) platform (atlas.adherence.cc), developed by Philip Morisky, MBA, Chief Optimus, Adherence Cartography. ATLAS is built on the scientific foundation of the Morisky Medication Adherence Scale (MMAS), originally developed by Dr. Donald E. Morisky, ScD, MS, MPH, Professor Emeritus, UCLA Fielding School of Public Health. ATLAS provides IRB-grade data management, validated adherence instruments (MMAS-8, MAP, PEACS), real-time analytics, and export capabilities compliant with HIPAA and GDPR requirements. The platform is used by researchers in 150+ countries and serves as infrastructure for TESSERA GRC (Global Research Consortium).'
  },
  {
    id: 'data-mgmt',
    title: 'Data Management Plan',
    desc: 'For NIH, NSF data management and sharing plan sections',
    text: 'Data will be collected, stored, and managed using the ATLAS research platform, which employs AES-256 encryption at rest, TLS 1.3 in transit, role-based access controls, and immutable audit logging compliant with 21 CFR Part 11. All participant data will be de-identified prior to analysis. The platform provides automated CONSORT participant flow tracking, dataset locking with cryptographic snapshots, and protocol amendment logging. Data will be retained for a minimum of 7 years post-study completion in accordance with NIH data retention requirements.'
  },
  {
    id: 'map-justification',
    title: 'Instrument Justification: MAP',
    desc: 'For grant sections requiring justification of the MAP instrument',
    text: 'The Multidimensional Adherence Parameters (MAP) instrument, developed by Morisky et al. (2024), measures medication adherence across three behavioral domains: Architecture (intentional planning and regimen organization), Execution (day-to-day dose-taking behavior), and Context (environmental and situational factors). The MAP produces a composite Performance Execution (PE) score via geometric mean of domain scores, providing superior sensitivity to within-person longitudinal change compared to additive scoring models. Validated psychometric properties include Cronbach alpha > 0.80, intraclass correlation coefficients > 0.75 for test-retest reliability, and convergent validity with MMAS-8 (r > 0.65). The MAP is administered through the ATLAS platform under license from Adherence Cartography.'
  },
  {
    id: 'mmas-justification',
    title: 'Instrument Justification: MMAS-8',
    desc: 'For grant sections requiring justification of the MMAS-8 instrument',
    text: 'The 8-item Morisky Medication Adherence Scale (MMAS-8), developed by Morisky, Ang, Krousel-Wood, and Ward (2008), is the most widely validated self-report adherence instrument in the literature, with over 3,000 peer-reviewed citations. The MMAS-8 classifies adherence as high (score = 8), medium (6 to less than 8), or low (less than 6) and demonstrates sensitivity of 0.93 and specificity of 0.53 for identifying non-adherent patients in hypertension populations (Morisky et al., 2008). Use of the MMAS-8 in this study is conducted under formal license agreement with the copyright holder, MMAR LLC, in compliance with established terms for research use.'
  },
  {
    id: 'budget-atlas',
    title: 'Budget Justification: ATLAS',
    desc: 'For NIH budget narrative sections covering platform costs',
    text: 'ATLAS Platform Access (Year 1-3): $[AMOUNT]/year. The ATLAS platform provides validated adherence assessment instruments (MMAS-8, MAP, PEACS), secure cloud-based data collection and storage, real-time analytics, IRB-compliant audit logging, CONSORT participant flow tracking, and publication-ready data export. Platform access includes instrument licensing fees for MMAS-8 and MAP, unlimited participant assessments, researcher workspace provisioning, and technical support. ATLAS is used by investigators in 150+ countries and is the recommended infrastructure platform for multi-site adherence studies by TESSERA GRC (Global Research Consortium).'
  },
  {
    id: 'tessera-statement',
    title: 'TESSERA GRC Consortium Membership Statement',
    desc: 'For collaboration and team science sections demonstrating global network',
    text: 'The investigators are members of TESSERA GRC (Global Research Consortium), a global network of adherence researchers coordinated by Philip Morisky, MBA, Chief Optimus, Adherence Cartography. TESSERA GRC membership provides access to the global ATLAS normative dataset, co-authorship pathways on consortium publications, and cross-site data harmonization infrastructure. The consortium currently includes member institutions across [X] countries and [Y] active studies.'
  }
];

// ── Data: Funding Opportunities ───────────────────────────────────────────────
const _SGR_FUNDING = [
  {
    id: 'nih-r01',
    agency: 'NIH / NHLBI',
    mechanism: 'R01',
    region: 'usa',
    deadline: 'Feb 5 / Jun 5 / Oct 5',
    desc: 'Standard research project grant supporting hypothesis-driven studies in heart, lung, and blood diseases. Ideal for longitudinal adherence interventions in hypertension and cardiovascular conditions.',
    url: 'https://www.nhlbi.nih.gov/grants-and-training/funding-opportunities',
    bestFit: true
  },
  {
    id: 'nih-r21',
    agency: 'NIH / NIMH',
    mechanism: 'R21',
    region: 'usa',
    deadline: 'Feb 16 / Jun 16 / Oct 16',
    desc: 'Exploratory/Developmental research award for high-risk, high-reward pilot studies. Suitable for validating MAP or MMAS-8 in mental health adherence populations.',
    url: 'https://grants.nih.gov/grants/funding/r21.htm',
    bestFit: true
  },
  {
    id: 'nih-d43',
    agency: 'NIH / Fogarty International Center',
    mechanism: 'D43',
    region: 'global',
    deadline: 'Nov 26 (annual)',
    desc: 'International Training Grant supporting capacity building for LMIC researchers. Strong alignment with TESSERA GRC cross-site training goals and ATLAS platform deployment.',
    url: 'https://www.fic.nih.gov/Grants/Pages/InternationalTraining.aspx',
    bestFit: true
  },
  {
    id: 'nih-k23',
    agency: 'NIH / NIDDK',
    mechanism: 'K23',
    region: 'usa',
    deadline: 'Feb 12 / Jun 12 / Oct 12',
    desc: 'Mentored Patient-Oriented Research Career Development Award. Suitable for early-career investigators building adherence research programs in diabetes and metabolic disease.',
    url: 'https://www.niddk.nih.gov/research-funding/funding-opportunities',
    bestFit: false
  },
  {
    id: 'nsf-ehr',
    agency: 'NSF / STEM Education',
    mechanism: 'EHR',
    region: 'usa',
    deadline: 'Rolling / LOI required',
    desc: 'Supports research and development in education and human resources. Relevant for digital health literacy and adherence education intervention studies.',
    url: 'https://www.nsf.gov/funding/browse_all.jsp',
    bestFit: false
  },
  {
    id: 'pcori-ce',
    agency: 'PCORI',
    mechanism: 'Clinical Effectiveness',
    region: 'usa',
    deadline: 'Cycle-based (see website)',
    desc: 'Patient-Centered Outcomes Research Institute funding for comparative clinical effectiveness. Strongly aligned with patient-reported adherence outcomes using MMAS-8 and MAP.',
    url: 'https://www.pcori.org/funding-opportunities',
    bestFit: true
  },
  {
    id: 'wellcome-sci',
    agency: 'Wellcome Trust',
    mechanism: 'Science Grant',
    region: 'global',
    deadline: 'Rolling (Expression of Interest)',
    desc: 'Global funding for science that improves health. Supports adherence science in LMICs, implementation research, and cross-country validation studies via TESSERA GRC infrastructure.',
    url: 'https://wellcome.org/grant-funding',
    bestFit: true
  },
  {
    id: 'gates-gcgh',
    agency: 'Bill & Melinda Gates Foundation',
    mechanism: 'GCGH / Grand Challenges',
    region: 'lmic',
    deadline: 'Rolling / Call-based',
    desc: 'Supports high-impact global health innovation including HIV, TB, and malaria adherence. ATLAS infrastructure is directly applicable to medication adherence monitoring in resource-limited settings.',
    url: 'https://gcgh.grandchallenges.org',
    bestFit: true
  },
  {
    id: 'eu-horizon',
    agency: 'European Commission / Horizon Europe',
    mechanism: 'RIA / IA',
    region: 'europe',
    deadline: 'Call-dependent (see portal)',
    desc: 'Research and Innovation Actions supporting collaborative European and global health research. Adherence instrumentation and digital health track applicable.',
    url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
    bestFit: false
  },
  {
    id: 'dfg-sachs',
    agency: 'DFG (Germany)',
    mechanism: 'Research Grant',
    region: 'europe',
    deadline: 'Rolling',
    desc: 'Deutsche Forschungsgemeinschaft individual research grants. Supports instrumentation and behavioral science studies in adherence among German-affiliated investigators.',
    url: 'https://www.dfg.de/en/research_funding/programmes/individual/',
    bestFit: false
  },
  {
    id: 'anr-france',
    agency: 'ANR (France)',
    mechanism: 'PRCI / PRCE',
    region: 'europe',
    deadline: 'Annual call (spring)',
    desc: 'French National Research Agency collaborative and international research grants. Eligible for multi-site ATLAS adherence studies with European consortium partners.',
    url: 'https://anr.fr/en/call-for-proposals-details/',
    bestFit: false
  },
  {
    id: 'conacyt-mex',
    agency: 'CONAHCYT (Mexico)',
    mechanism: 'CF / Ciencia Basica',
    region: 'latam',
    deadline: 'Annual call',
    desc: 'Mexico national science council funding for health and biomedical research. Supports adherence studies in chronic disease populations prevalent in Latin America.',
    url: 'https://conahcyt.mx/convocatorias/',
    bestFit: false
  },
  {
    id: 'fapesp-bra',
    agency: 'FAPESP (Brazil)',
    mechanism: 'Tematico / Regular',
    region: 'latam',
    deadline: 'Rolling',
    desc: 'Sao Paulo Research Foundation funding for health sciences. Strong track record with hypertension and diabetes adherence research using validated instruments.',
    url: 'https://fapesp.br/en/opportunities/',
    bestFit: true
  },
  {
    id: 'edctp-africa',
    agency: 'EDCTP',
    mechanism: 'Senior Fellowship / RIA',
    region: 'lmic',
    deadline: 'Call-based',
    desc: 'European and Developing Countries Clinical Trials Partnership. Supports HIV, TB, malaria, and NCD adherence research in sub-Saharan Africa with capacity building.',
    url: 'https://www.edctp.org/funding/',
    bestFit: true
  },
  {
    id: 'idrc-canada',
    agency: 'IDRC (Canada)',
    mechanism: 'Research Grant',
    region: 'usa',
    deadline: 'Call-based',
    desc: 'International Development Research Centre funds health research with development impact. Supports LMIC-focused adherence instrumentation and implementation studies via Canadian institutions.',
    url: 'https://www.idrc.ca/en/funding',
    bestFit: false
  }
];

// ── Data: Countries list ──────────────────────────────────────────────────────
const _SGR_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bangladesh','Belarus','Belgium','Belize','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Bulgaria','Burkina Faso','Cambodia','Cameroon','Canada','Chad','Chile',
  'China','Colombia','Congo (DRC)','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia',
  'Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Haiti','Honduras',
  'Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kosovo','Kyrgyzstan','Latvia','Lebanon','Lithuania',
  'Madagascar','Malawi','Malaysia','Mali','Malta','Mexico','Moldova','Mongolia','Morocco',
  'Mozambique','Myanmar','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Macedonia','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland',
  'Portugal','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone',
  'Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sudan',
  'Sweden','Switzerland','Taiwan','Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Other'
];

// ── Data: Tier benefits ───────────────────────────────────────────────────────
const _SGR_TIERS = [
  {
    id: 'tier2',
    name: 'Tier 2: Validation Partner',
    color: '#d4a843',
    benefits: [
      'Free ATLAS platform access for active study',
      'Letter of Support from Philip Morisky, MBA',
      'Co-authorship pathway on TESSERA GRC normative database paper',
      'Full grant template library access',
      'TESSERA GRC consortium directory listing',
      'Cross-site data harmonization support',
      'Priority instrument licensing (MAP, MMAS-8, PEACS)'
    ]
  },
  {
    id: 'tier3',
    name: 'Tier 3: Research Affiliate',
    color: '#38bdf8',
    benefits: [
      'Subsidized ATLAS platform access',
      'Full grant template library access',
      'TESSERA GRC consortium network listing',
      'Invitation to TESSERA GRC annual convening',
      'Access to TESSERA GRC normative dataset (read-only)',
      'Newsletter and early access to consortium publications'
    ]
  },
  {
    id: 'tier4',
    name: 'Tier 4: Student Affiliate',
    color: '#8b6ff5',
    benefits: [
      'Supervised ATLAS platform access (faculty sponsor required)',
      'Portfolio and mentorship tools',
      'Pathway to Tier 3 upon degree completion',
      'Access to student adherence research webinar series',
      'Consortium network introductions'
    ]
  }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function _sgrCopyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '&#10003; Copied';
    btn.style.color = _CGR.green;
    btn.style.borderColor = 'rgba(46,201,138,0.40)';
    btn.style.background = 'rgba(46,201,138,0.08)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.style.background = '';
    }, 1900);
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Copy failed. Please select and copy manually.');
  });
}

function _sgrFmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function _sgrEl(tag, attrs, html) {
  const el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    if (k === 'style') el.style.cssText = attrs[k];
    else el.setAttribute(k, attrs[k]);
  });
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function _sgrDb() {
  return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
}

function _sgrCurrentUser() {
  try { return firebase.auth().currentUser; } catch(e) { return null; }
}

// ── Tab: TEMPLATES ────────────────────────────────────────────────────────────
function _sgrRenderTemplates(container) {
  container.innerHTML = '';

  const header = _sgrEl('div', { style:'margin-bottom:18px;' },
    '<div style="font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:680px;">' +
    'Copy-paste grant language for common sections. These templates are pre-approved for use in NIH, NSF, EU Horizon, and other grant applications. Customize bracketed placeholders before submission.' +
    '</div>'
  );
  container.appendChild(header);

  const grid = _sgrEl('div', { class:'sgr-card-grid' });

  _SGR_TEMPLATES.forEach(tpl => {
    const card = _sgrEl('div', { class:'sgr-card' });

    const titleRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;' });
    const titleWrap = _sgrEl('div');
    titleWrap.appendChild(_sgrEl('div', { class:'sgr-template-title' }, tpl.title));
    titleWrap.appendChild(_sgrEl('div', { class:'sgr-template-desc', style:'margin-top:3px;' }, tpl.desc));
    titleRow.appendChild(titleWrap);
    card.appendChild(titleRow);

    const textBox = _sgrEl('div', { class:'sgr-text-block' }, _sgrEscHtml(tpl.text));
    card.appendChild(textBox);

    const copyBtn = _sgrEl('button', { class:'sgr-copy-btn' }, '&#8856; Copy');
    copyBtn.addEventListener('click', () => _sgrCopyText(tpl.text, copyBtn));
    card.appendChild(copyBtn);

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function _sgrEscHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Tab: FUNDING BOARD ────────────────────────────────────────────────────────
function _sgrRenderFunding(container) {
  container.innerHTML = '';

  const header = _sgrEl('div', { style:'margin-bottom:16px;' },
    '<div style="font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:680px;">' +
    'Funding opportunities relevant to medication adherence, implementation science, and ATLAS-based research. Filter by region. Cards tagged Best Fit are strongly aligned with adherence and validation studies.' +
    '</div>'
  );
  container.appendChild(header);

  const filterBar = _sgrEl('div', { class:'sgr-filter-bar' });
  const filters = [
    { key:'all', label:'All' },
    { key:'global', label:'Global' },
    { key:'usa', label:'USA / Canada' },
    { key:'europe', label:'Europe' },
    { key:'latam', label:'Latin America' },
    { key:'lmic', label:'LMIC / Africa / Asia' }
  ];

  filters.forEach(f => {
    const btn = _sgrEl('button', { class:'sgr-filter-btn' + (_sgrFundingFilter === f.key ? ' active' : '') }, f.label);
    btn.dataset.filter = f.key;
    btn.addEventListener('click', () => {
      _sgrFundingFilter = f.key;
      filterBar.querySelectorAll('.sgr-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _sgrRefreshFundingGrid(grid);
    });
    filterBar.appendChild(btn);
  });
  container.appendChild(filterBar);

  const grid = _sgrEl('div', { class:'sgr-fund-grid' });
  container.appendChild(grid);
  _sgrRefreshFundingGrid(grid);
}

function _sgrRefreshFundingGrid(grid) {
  grid.innerHTML = '';
  const filtered = _sgrFundingFilter === 'all'
    ? _SGR_FUNDING
    : _SGR_FUNDING.filter(f => f.region === _sgrFundingFilter);

  if (!filtered.length) {
    grid.appendChild(_sgrEl('div', { style:'color:rgba(96,120,152,0.65);font-size:0.82rem;grid-column:1/-1;padding:20px 0;' }, 'No opportunities match this filter.'));
    return;
  }

  filtered.forEach(opp => {
    const card = _sgrEl('div', { class:'sgr-fund-card' });

    const topRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;gap:7px;flex-wrap:wrap;' });
    topRow.appendChild(_sgrEl('div', { class:'sgr-fund-agency' }, _sgrEscHtml(opp.agency)));
    topRow.appendChild(_sgrEl('div', { class:'sgr-fund-mech' }, _sgrEscHtml(opp.mechanism)));
    card.appendChild(topRow);

    const badgeRow = _sgrEl('div', { style:'display:flex;gap:5px;flex-wrap:wrap;' });
    const regionClass = {
      global: 'sgr-badge-global', usa: 'sgr-badge-usa', europe: 'sgr-badge-europe',
      latam: 'sgr-badge-latam', lmic: 'sgr-badge-lmic'
    }[opp.region] || 'sgr-badge-global';
    const regionLabel = {
      global:'Global', usa:'USA/Canada', europe:'Europe', latam:'Latin America', lmic:'LMIC'
    }[opp.region] || opp.region;
    badgeRow.appendChild(_sgrEl('span', { class:'sgr-badge ' + regionClass }, regionLabel));
    if (opp.bestFit) badgeRow.appendChild(_sgrEl('span', { class:'sgr-badge sgr-badge-bestfit' }, 'Best Fit'));
    card.appendChild(badgeRow);

    card.appendChild(_sgrEl('div', { class:'sgr-fund-desc' }, _sgrEscHtml(opp.desc)));
    card.appendChild(_sgrEl('div', { class:'sgr-fund-deadline' }, 'Deadline: ' + opp.deadline));

    const learnBtn = _sgrEl('a', { class:'sgr-learn-btn', href: opp.url, target:'_blank', rel:'noopener noreferrer' }, 'Learn More &#8599;');
    card.appendChild(learnBtn);

    grid.appendChild(card);
  });
}

// ── Tab: SUPPORT (Letter of Support Request) ──────────────────────────────────
function _sgrRenderSupport(container) {
  container.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:14px 0;"><span class="sgr-spinner"></span>Checking membership status...</div>';

  const user = _sgrCurrentUser();
  const db   = _sgrDb();

  if (!user || !user.uid) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { style:'color:rgba(138,160,184,0.8);font-size:0.84rem;line-height:1.7;padding:10px 0;' },
      'You must be signed in to request a Letter of Support. Please log in and return to this section.'
    ));
    return;
  }

  if (!db) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database connection unavailable. Please try again.'));
    return;
  }

  db.ref('consortium_members/' + user.uid).once('value')
    .then(function(snap) {
      container.innerHTML = '';
      const data = snap.val();

      if (data && data.status === 'active') {
        _sgrRenderSupportForm(container, user);
      } else if (data && data.status === 'pending') {
        const pendingBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.22);border-radius:10px;padding:20px 22px;max-width:580px;' });
        pendingBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:8px;' }, 'Membership Application Pending'));
        pendingBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;' },
          'Your TESSERA GRC membership application is currently under review. Letter of Support requests become available once your membership is approved. ' +
          'Applications are typically reviewed within 5 to 7 business days.'
        ));
        container.appendChild(pendingBox);
      } else {
        const gateBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:10px;padding:24px 26px;max-width:600px;' });
        gateBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:10px;' }, 'TESSERA GRC Membership Required'));
        gateBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.75;margin-bottom:18px;' },
          'Letters of support are issued to active TESSERA GRC members. Join the consortium to request a letter for your IRB, grant application, or ethics board.'
        ));
        const btnRow = _sgrEl('div', { style:'display:flex;gap:10px;flex-wrap:wrap;' });

        const stdBtn = _sgrEl('a', {
          href: 'https://scalacartafoundation.org',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);' +
                 'background:rgba(212,168,67,0.09);color:#d4a843;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for TESSERA GRC Membership &#8599;');
        btnRow.appendChild(stdBtn);

        const fellowBtn = _sgrEl('a', {
          href: 'https://scalacartafoundation.org#fellowship',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(46,201,138,0.40);' +
                 'background:rgba(46,201,138,0.09);color:#2ec98a;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for Global Science Fellowship &#8599;');
        btnRow.appendChild(fellowBtn);

        gateBox.appendChild(btnRow);
        container.appendChild(gateBox);
      }
    })
    .catch(function(err) {
      container.innerHTML = '';
      container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Could not verify membership status: ' + (err.message || 'Unknown error')));
    });
}

// ── Support form (active members only) ───────────────────────────────────────
function _sgrRenderSupportForm(container, user) {
  const header = _sgrEl('div', { style:'margin-bottom:20px;' },
    '<div style="font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:680px;">' +
    'Submit a request for a Letter of Support from Philip Morisky, MBA, for your grant application. Requests are reviewed within 5 business days. ' +
    'Include your submission deadline so we can prioritize accordingly.' +
    '</div>'
  );
  container.appendChild(header);

  const formWrap = _sgrEl('div', { class:'sgr-form-wrap' });

  // Form fields
  const fields = [
    { id:'sgr-f-name',     label:'Researcher Name',   type:'text',  placeholder:'Full name as it appears on the grant' },
    { id:'sgr-f-inst',     label:'Institution',        type:'text',  placeholder:'University, hospital, or research center' },
    { id:'sgr-f-title',    label:'Study Title',        type:'text',  placeholder:'Full title of the study' },
    { id:'sgr-f-agency',   label:'Grant Agency',       type:'text',  placeholder:'e.g. NIH, Wellcome Trust, EU Horizon' },
    { id:'sgr-f-mech',     label:'Grant Mechanism',    type:'text',  placeholder:'e.g. R01, D43, RIA, Senior Fellowship' },
    { id:'sgr-f-email',    label:'Contact Email',      type:'email', placeholder:'Your email for correspondence' },
    { id:'sgr-f-deadline', label:'Submission Deadline',type:'date',  placeholder:'' }
  ];

  fields.forEach((f, idx) => {
    const row = _sgrEl('div', { class:'sgr-form-row' });
    row.appendChild(_sgrEl('label', { class:'sgr-label', for: f.id }, f.label));
    const inp = _sgrEl('input', { class:'sgr-input', id: f.id, type: f.type, placeholder: f.placeholder });
    if (f.id === 'sgr-f-email' && user && user.email) inp.value = user.email;
    row.appendChild(inp);
    formWrap.appendChild(row);

    // Country select after institution
    if (idx === 1) {
      const countryRow = _sgrEl('div', { class:'sgr-form-row' });
      countryRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-f-country' }, 'Country'));
      const sel = _sgrEl('select', { class:'sgr-select', id:'sgr-f-country' });
      sel.appendChild(_sgrEl('option', { value:'' }, '-- Select Country --'));
      _SGR_COUNTRIES.forEach(c => sel.appendChild(_sgrEl('option', { value:c }, c)));
      countryRow.appendChild(sel);
      formWrap.appendChild(countryRow);
    }
  });

  // Instruments checkboxes
  const instrRow = _sgrEl('div', { class:'sgr-form-row' });
  instrRow.appendChild(_sgrEl('div', { class:'sgr-label' }, 'Instruments Used in Study'));
  [
    { id:'sgr-cb-map',   label:'MAP (Multidimensional Adherence Parameters)' },
    { id:'sgr-cb-mmas',  label:'MMAS-8 (Morisky Medication Adherence Scale)' },
    { id:'sgr-cb-peacs', label:'PEACS (Phenotype Execution Adherence Classification System)' }
  ].forEach(cb => {
    const row = _sgrEl('div', { class:'sgr-checkbox-row' });
    const chk = _sgrEl('input', { type:'checkbox', id: cb.id });
    const lbl = _sgrEl('label', { class:'sgr-checkbox-label', for: cb.id }, cb.label);
    row.appendChild(chk);
    row.appendChild(lbl);
    instrRow.appendChild(row);
  });
  formWrap.appendChild(instrRow);

  // Study description
  const descRow = _sgrEl('div', { class:'sgr-form-row' });
  descRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-f-desc' }, 'Brief Study Description (max 500 characters)'));
  const descTa = _sgrEl('textarea', { class:'sgr-textarea', id:'sgr-f-desc', maxlength:'500', placeholder:'Describe your study aims and population in 2-3 sentences...' });
  const charCount = _sgrEl('div', { class:'sgr-char-count', id:'sgr-char-count' }, '0 / 500');
  descTa.addEventListener('input', () => {
    charCount.textContent = descTa.value.length + ' / 500';
  });
  descRow.appendChild(descTa);
  descRow.appendChild(charCount);
  formWrap.appendChild(descRow);

  const msgEl = _sgrEl('div', { id:'sgr-support-msg', style:'display:none;' });

  const submitBtn = _sgrEl('button', { class:'sgr-submit-btn', id:'sgr-support-submit' }, 'Request Letter of Support');
  submitBtn.addEventListener('click', () => _sgrSubmitSupportRequest(formWrap, msgEl, submitBtn));
  formWrap.appendChild(submitBtn);
  formWrap.appendChild(msgEl);

  container.appendChild(formWrap);

  // Past requests section
  const pastTitle = _sgrEl('div', { class:'sgr-past-req-title' }, 'Your Previous Requests');
  container.appendChild(pastTitle);

  const pastWrap = _sgrEl('div', { id:'sgr-past-requests' },
    '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:8px 0;"><span class="sgr-spinner"></span>Loading...</div>'
  );
  container.appendChild(pastWrap);

  _sgrLoadPastRequests(pastWrap, user);

  // Feature A: letters issued to this user
  _sgrRenderLettersSection(container, user);
}

function _sgrSubmitSupportRequest(formWrap, msgEl, submitBtn) {
  const db = _sgrDb();

  const name     = document.getElementById('sgr-f-name')?.value.trim();
  const inst     = document.getElementById('sgr-f-inst')?.value.trim();
  const country  = document.getElementById('sgr-f-country')?.value;
  const title    = document.getElementById('sgr-f-title')?.value.trim();
  const agency   = document.getElementById('sgr-f-agency')?.value.trim();
  const mech     = document.getElementById('sgr-f-mech')?.value.trim();
  const email    = document.getElementById('sgr-f-email')?.value.trim();
  const deadline = document.getElementById('sgr-f-deadline')?.value;
  const desc     = document.getElementById('sgr-f-desc')?.value.trim();

  const mapUsed   = document.getElementById('sgr-cb-map')?.checked;
  const mmasUsed  = document.getElementById('sgr-cb-mmas')?.checked;
  const peacsUsed = document.getElementById('sgr-cb-peacs')?.checked;

  msgEl.style.display = 'none';

  if (!name || !inst || !country || !title || !agency || !email) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Please complete all required fields: name, institution, country, study title, grant agency, and email.';
    return;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Please enter a valid email address.';
    return;
  }

  if (!db) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Database connection unavailable. Please try again.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="sgr-spinner"></span>Submitting...';

  const instruments = [];
  if (mapUsed)   instruments.push('MAP');
  if (mmasUsed)  instruments.push('MMAS-8');
  if (peacsUsed) instruments.push('PEACS');

  const user = _sgrCurrentUser();
  const ts = Date.now();
  const payload = {
    ts,
    name,
    institution: inst,
    country,
    studyTitle: title,
    grantAgency: agency,
    grantMechanism: mech || '',
    instruments,
    description: desc || '',
    submissionDeadline: deadline || '',
    email,
    uid: user ? user.uid : 'anonymous',
    status: 'pending'
  };

  db.ref('consortium_support_requests/' + ts).set(payload)
    .then(() => {
      submitBtn.innerHTML = 'Request Letter of Support';
      submitBtn.disabled = false;
      msgEl.className = 'sgr-success-box';
      msgEl.style.display = 'block';
      msgEl.innerHTML = '<strong>Request received.</strong> Philip Morisky\'s team will respond within 5 business days. A copy of this request has been logged to your profile.';

      // Reset form
      ['sgr-f-name','sgr-f-inst','sgr-f-title','sgr-f-agency','sgr-f-mech','sgr-f-email','sgr-f-deadline','sgr-f-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['sgr-cb-map','sgr-cb-mmas','sgr-cb-peacs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      const cc = document.getElementById('sgr-char-count');
      if (cc) cc.textContent = '0 / 500';

      const pastWrap = document.getElementById('sgr-past-requests');
      if (pastWrap) _sgrLoadPastRequests(pastWrap, user);
    })
    .catch(err => {
      submitBtn.innerHTML = 'Request Letter of Support';
      submitBtn.disabled = false;
      msgEl.className = 'sgr-error-box';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Submission error: ' + (err.message || 'Unknown error. Please try again.');
    });
}

function _sgrLoadPastRequests(wrap, user) {
  const db = _sgrDb();
  if (!db || !user || !user.email) {
    wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:6px 0;">Sign in to view your previous requests.</div>';
    return;
  }

  wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:8px 0;"><span class="sgr-spinner"></span>Loading your requests...</div>';

  db.ref('consortium_support_requests').orderByChild('email').equalTo(user.email).once('value')
    .then(snap => {
      const items = [];
      snap.forEach(child => items.push(child.val()));
      items.sort((a, b) => b.ts - a.ts);
      _sgrRequestsCache = items;

      if (!items.length) {
        wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:6px 0;">No previous requests found.</div>';
        return;
      }

      wrap.innerHTML = '';
      items.forEach(req => {
        const card = _sgrEl('div', { class:'sgr-req-card' });
        card.appendChild(_sgrEl('div', { class:'sgr-req-study' }, _sgrEscHtml(req.studyTitle || '(Untitled)')));
        const meta = _sgrEl('div', { class:'sgr-req-meta', style:'margin-top:4px;' });
        meta.innerHTML =
          _sgrEscHtml(req.grantAgency || '') +
          (req.grantMechanism ? ' &middot; ' + _sgrEscHtml(req.grantMechanism) : '') +
          ' &middot; ' + _sgrEscHtml(req.institution || '') +
          (req.submissionDeadline ? ' &middot; Deadline: ' + _sgrEscHtml(req.submissionDeadline) : '') +
          ' &middot; Submitted: ' + _sgrFmtDate(req.ts);
        card.appendChild(meta);
        if (req.instruments && req.instruments.length) {
          const chips = _sgrEl('div', { style:'margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;' });
          req.instruments.forEach(ins => {
            const cls = ins === 'MAP' ? 'sp-chip sp-chip-map' : ins === 'MMAS-8' ? 'sp-chip sp-chip-mmas' : 'sp-chip sp-chip-peacs';
            chips.appendChild(_sgrEl('span', { class: cls }, ins));
          });
          card.appendChild(chips);
        }
        const statusBadge = _sgrEl('span', {
          class: 'sgr-badge',
          style: 'margin-top:6px;' + (req.status === 'complete'
            ? 'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);'
            : 'color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);')
        }, req.status === 'complete' ? 'Complete' : 'Pending Review');
        card.appendChild(statusBadge);
        wrap.appendChild(card);
      });
    })
    .catch(err => {
      wrap.innerHTML = '<div style="color:#ef4444;font-size:0.80rem;padding:6px 0;">Could not load past requests: ' + (err.message || 'Unknown error') + '</div>';
    });
}

// ── Tab: MY TESSERA ──────────────────────────────────────────────────────────────
function _sgrRenderMyTESSERA(container) {
  container.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:14px 0;"><span class="sgr-spinner"></span>Checking membership status...</div>';

  const db = _sgrDb();

  // onAuthStateChanged instead of currentUser to avoid race with Firebase auth restore on page load
  const _unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
    _unsubscribe();

    if (!user || !user.email) {
      container.innerHTML = '';
      const msg = _sgrEl('div', { style:'color:rgba(138,160,184,0.8);font-size:0.84rem;line-height:1.7;padding:10px 0;' },
        'You must be signed in to view or apply for TESSERA GRC membership. Please log in and return to this section.'
      );
      container.appendChild(msg);
      return;
    }

    if (!db) {
      container.innerHTML = '';
      container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database connection unavailable.'));
      return;
    }

    const uid = user.uid;
    db.ref('consortium_members/' + uid).once('value')
      .then(snap => {
        container.innerHTML = '';
        const data = snap.val();
        if (data && data.status && data.status !== 'pending') {
          _sgrRenderMemberProfile(container, data, user);
        } else if (data && data.status === 'pending') {
          _sgrRenderPendingStatus(container, data);
        } else {
          _sgrRenderApplySection(container, user, db);
        }
      })
      .catch(err => {
        container.innerHTML = '';
        container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Could not load membership data: ' + (err.message || 'Unknown error')));
      });
  });
}

function _sgrRenderMemberProfile(container, data, user) {
  const tier = _SGR_TIERS.find(t => t.id === (data.tier || 'tier3')) || _SGR_TIERS[1];

  const card = _sgrEl('div', { class:'sgr-tier-card' });

  const topRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;' });
  const nameBlock = _sgrEl('div');
  nameBlock.appendChild(_sgrEl('div', { class:'sgr-tier-name', style:'color:' + tier.color + ';' }, _sgrEscHtml(tier.name)));
  nameBlock.appendChild(_sgrEl('div', { class:'sgr-tier-sub' }, 'Member since ' + _sgrFmtDate(data.joinedTs || Date.now())));
  topRow.appendChild(nameBlock);
  const badgeCol = _sgrEl('div', { style:'display:flex;flex-direction:column;align-items:flex-end;gap:6px;' });
  badgeCol.innerHTML = _sgrTesseraLogo(44, 40, 'opacity:0.82;');
  badgeCol.appendChild(_sgrEl('span', { class:'sgr-badge', style:'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);' }, 'Active'));
  topRow.appendChild(badgeCol);
  card.appendChild(topRow);

  const statsRow = _sgrEl('div', { style:'margin-bottom:14px;' });
  statsRow.appendChild(_sgrEl('span', { class:'sgr-tier-stat' }, 'Contributions: ' + (data.contributions || 0)));
  statsRow.appendChild(_sgrEl('span', { class:'sgr-tier-stat' }, 'Studies: ' + (data.studies || 0)));
  if (data.institution) statsRow.appendChild(_sgrEl('span', { class:'sgr-tier-stat' }, _sgrEscHtml(data.institution)));
  card.appendChild(statsRow);

  // Feature B: assessment contribution counter
  const contribWrap = _sgrEl('div', { class:'sgr-contrib-row', style:'margin-bottom:14px;' });
  contribWrap.innerHTML = '<span class="sgr-spinner"></span>';
  card.appendChild(contribWrap);
  if (user && user.uid) {
    _sgrLoadContributionCount(contribWrap, user.uid);
  } else {
    contribWrap.innerHTML =
      '<div class="sgr-contrib-val">N/A</div>' +
      '<div class="sgr-contrib-label">Assessments contributed to global MAP dataset</div>' +
      '<div class="sgr-contrib-sub">Data updates daily.</div>';
  }

  card.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-bottom:8px;' }, 'Your Tier Benefits'));

  const ul = _sgrEl('ul', { class:'sgr-benefit-list' });
  tier.benefits.forEach(b => ul.appendChild(_sgrEl('li', {}, _sgrEscHtml(b))));
  card.appendChild(ul);

  container.appendChild(card);
}

function _sgrRenderPendingStatus(container, data) {
  const pendingBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.22);border-radius:10px;padding:20px 22px;max-width:580px;' });
  pendingBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:8px;' }, 'Application Pending Review'));
  pendingBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;' },
    'Your TESSERA GRC membership application for ' +
    _sgrEscHtml((data.tier ? _SGR_TIERS.find(t => t.id === data.tier)?.name : 'Tier 3') || 'Tier 3') +
    ' is under review. You will receive an email confirmation once approved. Applications are typically reviewed within 5 to 7 business days.'
  ));
  container.appendChild(pendingBox);
}

function _sgrRenderApplySection(container, user, db) {
  const introBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.18);border-radius:10px;padding:16px 18px;max-width:700px;margin-bottom:20px;display:flex;gap:14px;align-items:flex-start;' });
  introBox.innerHTML =
    _sgrTesseraLogo(40, 37, 'margin-top:2px;opacity:0.85;') +
    '<div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(212,168,67,0.65);margin-bottom:6px;">TESSERA GRC &middot; Scala Carta Foundation</div>' +
      '<div style="font-size:0.84rem;color:rgba(205,216,232,0.88);line-height:1.65;margin-bottom:8px;">' +
        '<strong>TESSERA GRC</strong> (Global Research Consortium) is the international adherence science network of the Scala Carta Foundation — ' +
        'uniting universities, teaching hospitals, and research institutions across six continents under shared scientific instruments, ' +
        'governance standards, and a common framework for adherence cartography.' +
      '</div>' +
      '<div style="font-size:0.80rem;color:rgba(138,160,184,0.75);line-height:1.62;margin-bottom:10px;">' +
        'Membership provides access to the global ATLAS normative dataset, co-authorship pathways on consortium publications, ' +
        'letter of support eligibility, TESSERA Study ID registration, and the global researcher network.' +
      '</div>' +
      '<a href="https://scalacartafoundation.org" target="_blank" rel="noopener" ' +
        'style="display:inline-block;font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(212,168,67,0.8);text-decoration:none;border-bottom:1px solid rgba(212,168,67,0.3);padding-bottom:1px;">' +
        'Visit Consortium Page &#8599;' +
      '</a>' +
    '</div>';
  container.appendChild(introBox);

  container.appendChild(_sgrEl('div', { class:'sgr-section-title' }, 'Membership Tiers'));

  const tierGrid = _sgrEl('div', { class:'sgr-tier-grid' });
  _SGR_TIERS.forEach(tier => {
    const card = _sgrEl('div', { class:'sgr-tier-option' });
    card.appendChild(_sgrEl('div', { class:'sgr-tier-option-name', style:'color:' + tier.color + ';' }, tier.name));
    const ul = _sgrEl('ul', { class:'sgr-benefit-list' });
    tier.benefits.forEach(b => ul.appendChild(_sgrEl('li', {}, _sgrEscHtml(b))));
    card.appendChild(ul);
    tierGrid.appendChild(card);
  });
  container.appendChild(tierGrid);

  container.appendChild(_sgrEl('div', { class:'sgr-divider' }));
  container.appendChild(_sgrEl('div', { class:'sgr-section-title' }, 'Apply for Membership'));

  const formWrap = _sgrEl('div', { class:'sgr-form-wrap' });

  // Name
  const nameRow = _sgrEl('div', { class:'sgr-form-row' });
  nameRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-tessera-name' }, 'Full Name'));
  nameRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-tessera-name', type:'text', placeholder:'As it appears on publications' }));
  formWrap.appendChild(nameRow);

  // Institution
  const instRow = _sgrEl('div', { class:'sgr-form-row' });
  instRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-tessera-inst' }, 'Institution'));
  instRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-tessera-inst', type:'text', placeholder:'University, hospital, or research center' }));
  formWrap.appendChild(instRow);

  // Country
  const countryRow = _sgrEl('div', { class:'sgr-form-row' });
  countryRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-tessera-country' }, 'Country'));
  const csel = _sgrEl('select', { class:'sgr-select', id:'sgr-tessera-country' });
  csel.appendChild(_sgrEl('option', { value:'' }, '-- Select Country --'));
  _SGR_COUNTRIES.forEach(c => csel.appendChild(_sgrEl('option', { value:c }, c)));
  countryRow.appendChild(csel);
  formWrap.appendChild(countryRow);

  // Tier selection
  const tierRow = _sgrEl('div', { class:'sgr-form-row' });
  tierRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-tessera-tier' }, 'Membership Tier'));
  const tsel = _sgrEl('select', { class:'sgr-select', id:'sgr-tessera-tier' });
  _SGR_TIERS.forEach(t => tsel.appendChild(_sgrEl('option', { value: t.id }, t.name)));
  tierRow.appendChild(tsel);
  formWrap.appendChild(tierRow);

  // Research focus
  const focusRow = _sgrEl('div', { class:'sgr-form-row' });
  focusRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-tessera-focus' }, 'Research Focus (brief)'));
  const focusTa = _sgrEl('textarea', { class:'sgr-textarea', id:'sgr-tessera-focus', maxlength:'300', placeholder:'Describe your primary research area and how it relates to medication adherence...' });
  focusRow.appendChild(focusTa);
  formWrap.appendChild(focusRow);

  const applyMsg = _sgrEl('div', { id:'sgr-tessera-msg', style:'display:none;' });

  const applyBtn = _sgrEl('button', { class:'sgr-apply-btn', id:'sgr-tessera-apply-btn' }, 'Apply for TESSERA GRC Membership');
  applyBtn.addEventListener('click', () => _sgrSubmitTESSERAApplication(db, user, applyMsg, applyBtn));
  formWrap.appendChild(applyBtn);
  formWrap.appendChild(applyMsg);

  container.appendChild(formWrap);
}

function _sgrSubmitTESSERAApplication(db, user, msgEl, btn) {
  const name    = document.getElementById('sgr-tessera-name')?.value.trim();
  const inst    = document.getElementById('sgr-tessera-inst')?.value.trim();
  const country = document.getElementById('sgr-tessera-country')?.value;
  const tier    = document.getElementById('sgr-tessera-tier')?.value;
  const focus   = document.getElementById('sgr-tessera-focus')?.value.trim();

  msgEl.style.display = 'none';

  if (!name || !inst || !country || !tier) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Please complete all required fields before applying.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="sgr-spinner"></span>Submitting...';

  // Check LMIC eligibility at application time so SA approval flow can surface it
  const _isLMICApplicant = typeof isLMICCountry === 'function' ? isLMICCountry(country) : false;

  const payload = {
    name,
    institution: inst,
    country,
    tier,
    researchFocus: focus || '',
    email: user.email || '',
    uid: user.uid,
    status: 'pending',
    appliedTs: Date.now(),
    joinedTs: null,
    contributions: 0,
    studies: 0,
    lmic_eligible: _isLMICApplicant,  // pre-flagged for SA review
  };

  db.ref('consortium_members/' + user.uid).set(payload)
    .then(() => {
      btn.innerHTML = 'Apply for TESSERA GRC Membership';
      btn.disabled = true;
      msgEl.className = 'sgr-success-box';
      msgEl.style.display = 'block';
      const _lmicNote = _isLMICApplicant
        ? ' Because your institution is in an LMIC country, your application is flagged for expedited review and '
          + '<strong>LMIC researcher access (all fees waived)</strong> will be activated upon approval.'
        : '';
      msgEl.innerHTML =
        '<strong>Application submitted.</strong> Your TESSERA GRC membership application has been received. '
        + 'You will be notified by email once reviewed (typically 5 to 7 business days).'
        + _lmicNote;
    })
    .catch(err => {
      btn.innerHTML = 'Apply for TESSERA GRC Membership';
      btn.disabled = false;
      msgEl.className = 'sgr-error-box';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Submission error: ' + (err.message || 'Unknown error. Please try again.');
    });
}

// ── Feature A: Letters issued to this user ────────────────────────────────────
function _sgrRenderLettersSection(container, user) {
  const section = _sgrEl('div', { class:'sgr-letters-section' });
  section.appendChild(_sgrEl('div', { class:'sgr-past-req-title', style:'margin-top:0;' }, 'Letters of Support'));

  const listWrap = _sgrEl('div', { id:'sgr-letters-list' },
    '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:8px 0;"><span class="sgr-spinner"></span>Loading...</div>'
  );
  section.appendChild(listWrap);
  container.appendChild(section);

  _sgrLoadLettersForUser(listWrap, user);
}

function _sgrLoadLettersForUser(wrap, user) {
  const db = _sgrDb();
  if (!db || !user || !user.email) {
    wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.79rem;padding:6px 0;">Sign in to view your letters.</div>';
    return;
  }

  // Step 1: gather recipient names from this user's own support requests (email is stored there)
  db.ref('consortium_support_requests').orderByChild('email').equalTo(user.email).once('value')
    .then(function(reqSnap) {
      const knownNames = new Set();
      reqSnap.forEach(function(child) {
        const v = child.val();
        if (v && v.name) knownNames.add(v.name.trim().toLowerCase());
        if (v && v.email) knownNames.add(v.email.trim().toLowerCase());
      });
      // Also add displayName from auth in case letters were issued directly
      if (user.displayName) knownNames.add(user.displayName.trim().toLowerCase());
      knownNames.add(user.email.trim().toLowerCase());

      return db.ref('consortium_letters').once('value').then(function(lettersSnap) {
        const letters = [];
        lettersSnap.forEach(function(child) {
          const v = child.val();
          if (!v) return;
          const rname = (v.recipient_name || '').trim().toLowerCase();
          if (knownNames.has(rname)) letters.push({ _key: child.key, ...v });
        });
        letters.sort(function(a, b) { return (b.issued_at || 0) - (a.issued_at || 0); });
        _sgrRenderLetterCards(wrap, letters);
      });
    })
    .catch(function(err) {
      wrap.innerHTML = '<div style="color:#ef4444;font-size:0.79rem;padding:6px 0;">Could not load letters: ' + _sgrEscHtml(err.message || 'Unknown error') + '</div>';
    });
}

function _sgrRenderLetterCards(wrap, letters) {
  wrap.innerHTML = '';

  if (!letters.length) {
    wrap.appendChild(_sgrEl('div', { style:'color:rgba(96,120,152,0.65);font-size:0.80rem;padding:6px 0;' },
      'No letters issued yet. Submit a request above.'
    ));
    return;
  }

  letters.forEach(function(l) {
    const card = _sgrEl('div', { class:'sgr-letter-card' });

    const topRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;' });
    topRow.appendChild(_sgrEl('div', { class:'sgr-letter-study' }, _sgrEscHtml(l.study_title || '(Untitled)')));

    const badgeCls = l.status === 'issued' ? 'sgr-badge sgr-badge-issued'
      : l.status === 'expired' ? 'sgr-badge sgr-badge-expired'
      : 'sgr-badge sgr-badge-draft';
    const badgeLabel = l.status === 'issued' ? 'Active'
      : l.status === 'expired' ? 'Expired'
      : _sgrEscHtml(l.status || 'Draft');
    topRow.appendChild(_sgrEl('span', { class: badgeCls }, badgeLabel));
    card.appendChild(topRow);

    const meta = _sgrEl('div', { class:'sgr-letter-meta' });
    const parts = [];
    if (l.institution) parts.push(_sgrEscHtml(l.institution));
    if (l.grant_agency) parts.push(_sgrEscHtml(l.grant_agency) + (l.grant_mechanism ? ' ' + _sgrEscHtml(l.grant_mechanism) : ''));
    if (l.issued_at) parts.push('Issued: ' + _sgrFmtDate(l.issued_at));
    if (l.instrument) parts.push('Instruments: ' + _sgrEscHtml(l.instrument));
    meta.innerHTML = parts.join(' &nbsp;&middot;&nbsp; ');
    card.appendChild(meta);

    const copyBtn = _sgrEl('button', { class:'sgr-copy-btn', style:'align-self:flex-start;' }, '&#8856; Copy Letter Text');
    copyBtn.addEventListener('click', function() {
      let text;
      if (l.letter_text) {
        text = l.letter_text;
      } else {
        const lines = ['Letter of Support'];
        if (l.recipient_name) lines.push('Recipient: ' + l.recipient_name);
        if (l.institution)    lines.push('Institution: ' + l.institution);
        if (l.study_title)    lines.push('Study: ' + l.study_title);
        if (l.grant_agency)   lines.push('Agency: ' + l.grant_agency + (l.grant_mechanism ? ' ' + l.grant_mechanism : ''));
        if (l.instrument)     lines.push('Instruments: ' + l.instrument);
        if (l.status)         lines.push('Status: ' + l.status);
        if (l.issued_at)      lines.push('Issued: ' + _sgrFmtDate(l.issued_at));
        text = lines.join('\n');
      }
      _sgrCopyText(text, copyBtn);
    });
    card.appendChild(copyBtn);

    wrap.appendChild(card);
  });
}

// ── Feature B: Assessment contribution count ──────────────────────────────────
function _sgrLoadContributionCount(statWrap, uid) {
  statWrap.innerHTML = '<span class="sgr-spinner"></span>';

  firebase.auth().currentUser.getIdTokenResult()
    .then(function(result) {
      const workspace = result.claims && result.claims.workspace;
      if (!workspace) {
        statWrap.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:1.4rem;font-weight:700;color:#38bdf8;">N/A</span>';
        return;
      }
      const db = _sgrDb();
      if (!db) {
        statWrap.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:1.4rem;font-weight:700;color:#38bdf8;">N/A</span>';
        return;
      }
      db.ref('assessments/' + workspace).once('value')
        .then(function(snap) {
          const count = snap.numChildren ? snap.numChildren() : (snap.val() ? Object.keys(snap.val()).length : 0);
          statWrap.innerHTML =
            '<div class="sgr-contrib-val">' + (count > 0 ? count.toLocaleString() : 'N/A') + '</div>' +
            '<div class="sgr-contrib-label">Assessments contributed to global MAP dataset</div>' +
            '<div class="sgr-contrib-sub">' + (count > 0 ? 'from your workspace' : 'Data updates daily.') + '</div>';
        })
        .catch(function() {
          statWrap.innerHTML =
            '<div class="sgr-contrib-val">N/A</div>' +
            '<div class="sgr-contrib-label">Assessments contributed to global MAP dataset</div>' +
            '<div class="sgr-contrib-sub">Data updates daily.</div>';
        });
    })
    .catch(function() {
      statWrap.innerHTML =
        '<div class="sgr-contrib-val">N/A</div>' +
        '<div class="sgr-contrib-label">Assessments contributed to global MAP dataset</div>' +
        '<div class="sgr-contrib-sub">Data updates daily.</div>';
    });
}

// ── Main Init ─────────────────────────────────────────────────────────────────
window.saGrantResourcesInit = function(container) {
  if (!container) return;
  _sgrInjectStyles();

  container.innerHTML = '';
  container.style.cssText = 'box-sizing:border-box;';

  // Page header
  const pageHeader = _sgrEl('div', { style:'margin-bottom:20px;display:flex;align-items:flex-start;gap:14px;' });
  pageHeader.innerHTML =
    _sgrTesseraLogo(38, 35, 'margin-top:2px;opacity:0.88;') +
    '<div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:4px;">ATLAS · Grant Resource Center</div>' +
      '<div style="font-size:1.08rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:4px;">Grant Resources &amp; TESSERA GRC Tools</div>' +
      '<div style="font-size:0.80rem;color:rgba(96,120,152,0.65);max-width:600px;line-height:1.6;">Templates, funding opportunities, letter of support requests, and TESSERA GRC membership for ATLAS-affiliated researchers worldwide.</div>' +
    '</div>';
  container.appendChild(pageHeader);

  // Tab bar
  const tabs = [
    { key:'exchange',     label:'◎ Exchange'    },
    { key:'directory',    label:'◉ Directory'   },
    { key:'templates',    label:'Templates'     },
    { key:'funding',      label:'Funding Board' },
    { key:'support',      label:'Request Support' },
    { key:'tessera',      label:'My TESSERA'    },
    { key:'registry',     label:'Registry'      },
    { key:'lmic-network', label:'🌍 LMIC Network' }
  ];

  const tabBar = _sgrEl('div', { class:'sgr-tabs' });
  const contentWrap = _sgrEl('div', { id:'sgr-content-wrap' });

  tabs.forEach(tab => {
    const btn = _sgrEl('button', { class:'sgr-tab' + (_sgrActiveTab === tab.key ? ' active' : '') }, tab.label);
    btn.dataset.tab = tab.key;
    btn.addEventListener('click', () => {
      if (_sgrActiveTab === tab.key) return;
      _sgrActiveTab = tab.key;
      tabBar.querySelectorAll('.sgr-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _sgrRenderTab(contentWrap, tab.key);
    });
    tabBar.appendChild(btn);
  });

  container.appendChild(tabBar);
  container.appendChild(contentWrap);

  _sgrRenderTab(contentWrap, _sgrActiveTab);
};

function _sgrRenderTab(contentWrap, key) {
  contentWrap.innerHTML = '';
  switch (key) {
    case 'exchange':     _sgrRenderExchange(contentWrap);     break;
    case 'directory':    _sgrRenderDirectory(contentWrap);    break;
    case 'templates':    _sgrRenderTemplates(contentWrap);    break;
    case 'funding':      _sgrRenderFunding(contentWrap);      break;
    case 'support':      _sgrRenderSupport(contentWrap);      break;
    case 'tessera':      _sgrRenderMyTESSERA(contentWrap);    break;
    case 'registry':     _sgrRenderRegistry(contentWrap);     break;
    case 'lmic-network': _sgrRenderLMICNetwork(contentWrap);  break;
    default:             _sgrRenderTemplates(contentWrap);
  }
}

// ── Tab: REGISTRY ─────────────────────────────────────────────────────────────
function _sgrRenderRegistry(container) {
  container.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:14px 0;"><span class="sgr-spinner"></span>Checking membership status...</div>';

  const user = _sgrCurrentUser();
  const db   = _sgrDb();

  if (!user || !user.uid) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { style:'color:rgba(138,160,184,0.8);font-size:0.84rem;line-height:1.7;padding:10px 0;' },
      'You must be signed in to register a study. Please log in and return to this section.'
    ));
    return;
  }

  if (!db) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database connection unavailable. Please try again.'));
    return;
  }

  db.ref('consortium_members/' + user.uid).once('value')
    .then(function(snap) {
      container.innerHTML = '';
      const data = snap.val();

      if (data && data.status === 'active') {
        _sgrRenderRegistryFull(container, user, db);
      } else if (data && data.status === 'pending') {
        const pendingBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.22);border-radius:10px;padding:20px 22px;max-width:580px;' });
        pendingBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:8px;' }, 'Membership Application Pending'));
        pendingBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;' },
          'Your TESSERA GRC membership application is under review. Study registration becomes available once membership is approved. ' +
          'Applications are typically reviewed within 5 to 7 business days.'
        ));
        container.appendChild(pendingBox);
      } else {
        const gateBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:10px;padding:24px 26px;max-width:600px;' });
        const gateTop = _sgrEl('div', { style:'display:flex;align-items:center;gap:12px;margin-bottom:12px;' });
        gateTop.innerHTML = _sgrTesseraLogo(40, 37, 'opacity:0.75;');
        gateTop.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;' }, 'TESSERA GRC Membership Required'));
        gateBox.appendChild(gateTop);
        gateBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.75;margin-bottom:18px;' },
          'Study registration and TESSERA Study ID assignment is available to active TESSERA GRC members. Join the consortium to register your study protocol.'
        ));
        const btnRow = _sgrEl('div', { style:'display:flex;gap:10px;flex-wrap:wrap;' });

        const stdBtn = _sgrEl('a', {
          href: 'https://scalacartafoundation.org',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);' +
                 'background:rgba(212,168,67,0.09);color:#d4a843;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for TESSERA GRC Membership &#8599;');
        btnRow.appendChild(stdBtn);

        const fellowBtn = _sgrEl('a', {
          href: 'https://scalacartafoundation.org#fellowship',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(46,201,138,0.40);' +
                 'background:rgba(46,201,138,0.09);color:#2ec98a;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for Global Science Fellowship &#8599;');
        btnRow.appendChild(fellowBtn);

        gateBox.appendChild(btnRow);
        container.appendChild(gateBox);
      }
    })
    .catch(function(err) {
      container.innerHTML = '';
      container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Could not verify membership status: ' + (err.message || 'Unknown error')));
    });
}

function _sgrRenderRegistryFull(container, user, db) {
  // Section A: Submit New Study
  const secAHdr = _sgrEl('div', { class:'sgr-reg-section-hdr' }, 'Submit New Study');
  container.appendChild(secAHdr);

  const intro = _sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:680px;margin-bottom:18px;' },
    'Register your study protocol with TESSERA GRC (Global Research Consortium). Upon review, a TESSERA Study ID will be issued within 5 business days.'
  );
  container.appendChild(intro);

  const formWrap = _sgrEl('div', { class:'sgr-form-wrap' });

  // Study Title
  const titleRow = _sgrEl('div', { class:'sgr-form-row' });
  titleRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-title' }, 'Study Title *'));
  titleRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-title', type:'text', placeholder:'Full title of the study' }));
  formWrap.appendChild(titleRow);

  // Disease Area
  const diseaseRow = _sgrEl('div', { class:'sgr-form-row' });
  diseaseRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-disease' }, 'Disease Area'));
  diseaseRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-disease', type:'text', placeholder:'e.g. Hypertension, Cardiovascular' }));
  formWrap.appendChild(diseaseRow);

  // Institution
  const instRow = _sgrEl('div', { class:'sgr-form-row' });
  instRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-inst' }, 'Institution *'));
  instRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-inst', type:'text', placeholder:'University, hospital, or research center' }));
  formWrap.appendChild(instRow);

  // Country
  const countryRow = _sgrEl('div', { class:'sgr-form-row' });
  countryRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-country' }, 'Country'));
  const csel = _sgrEl('select', { class:'sgr-select', id:'sgr-reg-country' });
  csel.appendChild(_sgrEl('option', { value:'' }, '-- Select Country --'));
  _SGR_COUNTRIES.forEach(function(c) { csel.appendChild(_sgrEl('option', { value:c }, c)); });
  countryRow.appendChild(csel);
  formWrap.appendChild(countryRow);

  // N Planned
  const nRow = _sgrEl('div', { class:'sgr-form-row' });
  nRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-n' }, 'N Planned'));
  nRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-n', type:'number', min:'1', placeholder:'Planned sample size' }));
  formWrap.appendChild(nRow);

  // Follow-up Duration
  const fuRow = _sgrEl('div', { class:'sgr-form-row' });
  fuRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-fu' }, 'Follow-up Duration'));
  fuRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-fu', type:'text', placeholder:'e.g. 12 months' }));
  formWrap.appendChild(fuRow);

  // Phase
  const phaseRow = _sgrEl('div', { class:'sgr-form-row' });
  phaseRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-phase' }, 'Phase'));
  const psel = _sgrEl('select', { class:'sgr-select', id:'sgr-reg-phase' });
  ['Recruiting', 'Enrolling', 'Active', 'Completed'].forEach(function(p) {
    psel.appendChild(_sgrEl('option', { value:p }, p));
  });
  phaseRow.appendChild(psel);
  formWrap.appendChild(phaseRow);

  // Instruments
  const instrRow = _sgrEl('div', { class:'sgr-form-row' });
  instrRow.appendChild(_sgrEl('div', { class:'sgr-label' }, 'Instruments Used'));
  [
    { id:'sgr-reg-cb-map',   label:'MAP (Multidimensional Adherence Parameters)' },
    { id:'sgr-reg-cb-mmas',  label:'MMAS-8 (Morisky Medication Adherence Scale)' },
    { id:'sgr-reg-cb-peacs', label:'PEACS (Phenotype Execution Adherence Classification System)' }
  ].forEach(function(cb) {
    const row = _sgrEl('div', { class:'sgr-checkbox-row' });
    const chk = _sgrEl('input', { type:'checkbox', id:cb.id });
    const lbl = _sgrEl('label', { class:'sgr-checkbox-label', for:cb.id }, cb.label);
    row.appendChild(chk);
    row.appendChild(lbl);
    instrRow.appendChild(row);
  });
  formWrap.appendChild(instrRow);

  // Ethics/IRB Reference
  const ethicsRow = _sgrEl('div', { class:'sgr-form-row' });
  ethicsRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-reg-ethics' }, 'Ethics / IRB Reference Number'));
  ethicsRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-reg-ethics', type:'text', placeholder:'e.g. IRB-2026-001' }));
  formWrap.appendChild(ethicsRow);

  const regMsgEl = _sgrEl('div', { id:'sgr-reg-msg', style:'display:none;' });

  const submitBtn = _sgrEl('button', { class:'sgr-submit-btn', id:'sgr-reg-submit' }, 'Submit Study Protocol');
  submitBtn.addEventListener('click', function() {
    _sgrSubmitStudyRegistration(formWrap, regMsgEl, submitBtn, user, db);
  });
  formWrap.appendChild(submitBtn);
  formWrap.appendChild(regMsgEl);

  container.appendChild(formWrap);

  // Section B: Your Registered Studies
  container.appendChild(_sgrEl('div', { class:'sgr-divider' }));

  const secBHdr = _sgrEl('div', { class:'sgr-reg-section-hdr', style:'margin-top:0;' }, 'Your Registered Studies');
  container.appendChild(secBHdr);

  const studiesWrap = _sgrEl('div', { id:'sgr-reg-studies-wrap' },
    '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:8px 0;"><span class="sgr-spinner"></span>Loading your studies...</div>'
  );
  container.appendChild(studiesWrap);

  _sgrLoadMyStudies(studiesWrap, user, db);
}

function _sgrSubmitStudyRegistration(formWrap, msgEl, submitBtn, user, db) {
  const title   = document.getElementById('sgr-reg-title')?.value.trim();
  const disease = document.getElementById('sgr-reg-disease')?.value.trim();
  const inst    = document.getElementById('sgr-reg-inst')?.value.trim();
  const country = document.getElementById('sgr-reg-country')?.value;
  const n       = document.getElementById('sgr-reg-n')?.value.trim();
  const fu      = document.getElementById('sgr-reg-fu')?.value.trim();
  const phase   = document.getElementById('sgr-reg-phase')?.value;
  const ethics  = document.getElementById('sgr-reg-ethics')?.value.trim();

  const instruments = [];
  if (document.getElementById('sgr-reg-cb-map')?.checked)   instruments.push('MAP');
  if (document.getElementById('sgr-reg-cb-mmas')?.checked)  instruments.push('MMAS-8');
  if (document.getElementById('sgr-reg-cb-peacs')?.checked) instruments.push('PEACS');

  msgEl.style.display = 'none';

  if (!title || !inst) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Please complete all required fields: study title and institution.';
    return;
  }

  if (!db) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Database connection unavailable. Please try again.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="sgr-spinner"></span>Submitting...';

  const currentUser = firebase.auth().currentUser;
  const payload = {
    uid:         currentUser ? currentUser.uid   : (user.uid || ''),
    email:       currentUser ? (currentUser.email       || '') : (user.email || ''),
    displayName: currentUser ? (currentUser.displayName || '') : (user.displayName || ''),
    workspace:   user.workspace || '',
    title:       title,
    disease_area: disease || '',
    institution: inst,
    country:     country || '',
    n_planned:   n ? parseInt(n, 10) : null,
    follow_up:   fu || '',
    phase:       phase || 'Recruiting',
    instruments: instruments,
    ethics_ref:  ethics || '',
    submitted_at: Date.now(),
    status:      'pending',
    tessera_study_id: null
  };

  db.ref('tessera_study_registry').push(payload)
    .then(function() {
      submitBtn.innerHTML = 'Submit Study Protocol';
      submitBtn.disabled = false;
      msgEl.className = 'sgr-success-box';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Study submitted. Your TESSERA Study ID will be assigned within 5 business days.';

      // Reset form
      ['sgr-reg-title','sgr-reg-disease','sgr-reg-inst','sgr-reg-n','sgr-reg-fu','sgr-reg-ethics'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['sgr-reg-cb-map','sgr-reg-cb-mmas','sgr-reg-cb-peacs'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      const csel = document.getElementById('sgr-reg-country');
      if (csel) csel.value = '';
      const psel = document.getElementById('sgr-reg-phase');
      if (psel) psel.value = 'Recruiting';

      const studiesWrap = document.getElementById('sgr-reg-studies-wrap');
      if (studiesWrap) _sgrLoadMyStudies(studiesWrap, user, db);
    })
    .catch(function(err) {
      submitBtn.innerHTML = 'Submit Study Protocol';
      submitBtn.disabled = false;
      msgEl.className = 'sgr-error-box';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Submission error: ' + (err.message || 'Unknown error. Please try again.');
    });
}

function _sgrLoadMyStudies(wrap, user, db) {
  if (!db || !user || !user.uid) {
    wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:6px 0;">Sign in to view your registered studies.</div>';
    return;
  }

  wrap.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:8px 0;"><span class="sgr-spinner"></span>Loading...</div>';

  db.ref('tessera_study_registry').orderByChild('uid').equalTo(user.uid).once('value')
    .then(function(snap) {
      const studies = [];
      snap.forEach(function(child) {
        studies.push({ _key: child.key, ...child.val() });
      });
      studies.sort(function(a, b) { return (b.submitted_at || 0) - (a.submitted_at || 0); });

      wrap.innerHTML = '';

      if (!studies.length) {
        wrap.appendChild(_sgrEl('div', { style:'color:rgba(96,120,152,0.65);font-size:0.80rem;padding:6px 0;' },
          'No studies registered yet.'
        ));
        return;
      }

      studies.forEach(function(s) {
        const card = _sgrEl('div', { class:'sgr-study-card' });

        const topRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;' });
        topRow.appendChild(_sgrEl('div', { class:'sgr-study-title' }, _sgrEscHtml(s.title || '(Untitled)')));

        const badgeRow = _sgrEl('div', { style:'display:flex;gap:5px;align-items:center;flex-wrap:wrap;' });
        if (s.phase) badgeRow.appendChild(_sgrEl('span', { class:'sgr-phase-badge' }, _sgrEscHtml(s.phase)));

        const statusCls = s.status === 'approved' ? 'sgr-badge sgr-badge-status-approved'
          : s.status === 'rejected' ? 'sgr-badge sgr-badge-status-rejected'
          : 'sgr-badge sgr-badge-status-pending';
        const statusLabel = s.status === 'approved' ? 'Approved'
          : s.status === 'rejected' ? 'Rejected'
          : 'Pending';
        badgeRow.appendChild(_sgrEl('span', { class: statusCls }, statusLabel));
        topRow.appendChild(badgeRow);
        card.appendChild(topRow);

        const meta = _sgrEl('div', { class:'sgr-study-meta' });
        const parts = [];
        if (s.disease_area) parts.push(_sgrEscHtml(s.disease_area));
        if (s.institution)  parts.push(_sgrEscHtml(s.institution));
        if (s.country)      parts.push(_sgrEscHtml(s.country));
        if (s.submitted_at) parts.push('Submitted: ' + _sgrFmtDate(s.submitted_at));
        meta.innerHTML = parts.join(' &middot; ');
        card.appendChild(meta);

        if (s.instruments && s.instruments.length) {
          const chips = _sgrEl('div', { style:'display:flex;gap:4px;flex-wrap:wrap;' });
          s.instruments.forEach(function(ins) {
            const cls = ins === 'MAP' ? 'sgr-badge' : ins === 'MMAS-8' ? 'sgr-badge' : 'sgr-badge';
            const chip = _sgrEl('span', { class: cls,
              style: ins === 'MAP'    ? 'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);' :
                     ins === 'MMAS-8' ? 'color:#4e9cf5;border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.07);' :
                                        'color:#8b6ff5;border-color:rgba(139,111,245,0.35);background:rgba(139,111,245,0.07);'
            }, ins);
            chips.appendChild(chip);
          });
          card.appendChild(chips);
        }

        if (s.status === 'approved' && s.tessera_study_id) {
          const idBox = _sgrEl('div', { class:'sgr-tessera-id-box' });
          idBox.appendChild(_sgrEl('div', { class:'sgr-tessera-id-val' }, _sgrEscHtml(s.tessera_study_id)));
          const copyBtn = _sgrEl('button', { class:'sgr-copy-btn', style:'margin:0;padding:4px 10px;' }, '&#8856; Copy ID');
          copyBtn.addEventListener('click', function() { _sgrCopyText(s.tessera_study_id, copyBtn); });
          idBox.appendChild(copyBtn);
          card.appendChild(idBox);
        }

        wrap.appendChild(card);
      });
    })
    .catch(function(err) {
      wrap.innerHTML = '<div style="color:#ef4444;font-size:0.80rem;padding:6px 0;">Could not load studies: ' + (err.message || 'Unknown error') + '</div>';
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: LMIC RESEARCH NETWORK
// Pre-built LMIC study protocols, LMIC funding filter, Fogarty letter generator
// ══════════════════════════════════════════════════════════════════════════════

// ── Pre-built LMIC study protocols ───────────────────────────────────────────
const _SGR_LMIC_PROTOCOLS = [
  {
    id: 'lmic-htn',
    icon: '❤',
    title: 'Hypertension Adherence Validation',
    region: 'Sub-Saharan Africa',
    disease: 'Hypertension',
    instruments: ['MAP', 'MMAS-8'],
    n: 300,
    followUp: 'Cross-sectional (single visit)',
    color: '#ef4444',
    colorFaint: 'rgba(239,68,68,0.07)',
    colorBorder: 'rgba(239,68,68,0.22)',
    summary: 'Normative validation of MAP against MMAS-8 in a hypertensive population at a primary care facility. Target: 300 participants, single cross-sectional assessment, convergent validity analysis.',
    fullTitle: 'Normative Validation of the Multidimensional Adherence Parameters (MAP) Instrument in Hypertensive Patients: A Cross-Sectional Study',
    fogartyMechanism: 'R21 TW',
    fogartyFit: 'Instrument validation in LMIC primary care settings — strong fit for R21 TW pilot data.',
  },
  {
    id: 'lmic-hiv',
    icon: '⊕',
    title: 'HIV Antiretroviral Adherence Trajectory',
    region: 'East Africa',
    disease: 'HIV / ART Adherence',
    instruments: ['MAP', 'PEACS'],
    n: 150,
    followUp: '12 months longitudinal (MAP at baseline; PEACS monthly/weekly/quarterly)',
    color: '#f97316',
    colorFaint: 'rgba(249,115,22,0.07)',
    colorBorder: 'rgba(249,115,22,0.22)',
    summary: 'Longitudinal phenotype trajectory study in HIV-positive patients on ART. MAP at baseline; PEACS BASE, MVMT, and STRATA administered at respective intervals for 12 months. Primary outcome: phenotype stability classification.',
    fullTitle: 'Phenotype Trajectory Classification of Antiretroviral Adherence Using PEACS: A 12-Month Longitudinal Study in East Africa',
    fogartyMechanism: 'D43',
    fogartyFit: 'Capacity building grant with in-country training component — ideal for D43 with LMIC co-investigator mentorship.',
  },
  {
    id: 'lmic-diabetes',
    icon: '◈',
    title: 'Diabetes Medication Adherence in South Asia',
    region: 'India / Bangladesh / Pakistan',
    disease: 'Type 2 Diabetes',
    instruments: ['MAP'],
    n: 500,
    followUp: 'Cross-sectional with 3-month follow-up subsample',
    color: '#8b6ff5',
    colorFaint: 'rgba(139,111,245,0.07)',
    colorBorder: 'rgba(139,111,245,0.22)',
    summary: 'Cross-sectional MAP normative data collection in T2DM patients across 3 South Asian countries. Establishes regional PE score norms, domain profiles, and sociodemographic correlates of adherence architecture.',
    fullTitle: 'Regional Normative Data for the MAP Adherence Instrument in South Asian Type 2 Diabetes Patients: A Multicenter Cross-Sectional Study',
    fogartyMechanism: 'R21 TW',
    fogartyFit: 'Multi-country pilot with cross-cultural adaptation focus — fits R21 TW scope and budget.',
  },
  {
    id: 'lmic-tb',
    icon: '≋',
    title: 'TB Treatment Adherence',
    region: 'Southeast Asia',
    disease: 'Tuberculosis',
    instruments: ['MAP', 'MMAS-8'],
    n: 250,
    followUp: '6 months (aligned to standard TB treatment course)',
    color: '#38bdf8',
    colorFaint: 'rgba(56,189,248,0.07)',
    colorBorder: 'rgba(56,189,248,0.22)',
    summary: 'MAP and MMAS-8 dual-instrument validation and comparative psychometric study in TB patients during treatment. Convergent and discriminant validity analysis; domain profile comparison across treatment phases.',
    fullTitle: 'Comparative Psychometric Validation of MAP vs MMAS-8 in Tuberculosis Treatment Adherence: A 6-Month Prospective Study in Southeast Asia',
    fogartyMechanism: 'R21 TW',
    fogartyFit: 'Infectious disease adherence with global burden relevance — strong fit for Fogarty and EDCTP funding.',
  },
  {
    id: 'lmic-ncd-norm',
    icon: '∿',
    title: 'NCD Adherence Normative Dataset',
    region: 'Any LMIC Country',
    disease: 'Mixed NCD (hypertension, diabetes, asthma)',
    instruments: ['MAP'],
    n: 200,
    followUp: 'Cross-sectional (single visit)',
    color: '#2ec98a',
    colorFaint: 'rgba(46,201,138,0.07)',
    colorBorder: 'rgba(46,201,138,0.22)',
    summary: 'General-purpose normative MAP data collection for the TESSERA GRC global normative database. 200+ participants, any NCD population, any LMIC country. Contributes to global PE norms and co-authorship eligibility on the TESSERA GRC normative database paper.',
    fullTitle: 'Contribution to the TESSERA GRC Global MAP Normative Database: [Country] NCD Population Cross-Sectional Survey',
    fogartyMechanism: 'D43',
    fogartyFit: 'Consortium contribution study — best funded as part of a D43 training grant deliverable.',
  },
];

// ── Fogarty letter pre-generator ──────────────────────────────────────────────
function _sgrRenderFogartyGenerator(container, user, memberData) {
  const isLMIC   = typeof isLMICTier === 'function' ? isLMICTier() : false;
  const isMember = memberData && memberData.status === 'active';

  const hdr = _sgrEl('div', { class:'sgr-reg-section-hdr', style:'margin-top:24px;' }, 'Fogarty Grant Letter Pre-Generator');
  container.appendChild(hdr);

  container.appendChild(_sgrEl('div', { style:'font-size:0.80rem;color:rgba(138,160,184,0.8);line-height:1.6;max-width:620px;margin-bottom:16px;' },
    'Generate a pre-filled Fogarty D43 or R21 TW cover letter / letter of support. '
    + 'Fill in the fields below and copy the generated text into your application. '
    + (isMember ? '' : 'TESSERA GRC membership is recommended for the strongest Fogarty fit statement.')
  ));

  const formWrap = _sgrEl('div', { class:'sgr-form-wrap' });

  // PI Name
  const piRow = _sgrEl('div', { class:'sgr-form-row' });
  piRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'fg-pi-name' }, 'PI Name *'));
  const piInput = _sgrEl('input', { class:'sgr-input', id:'fg-pi-name', type:'text',
    placeholder:'Dr. Jane Smith' });
  if (user && user.displayName) piInput.value = user.displayName;
  piRow.appendChild(piInput);
  formWrap.appendChild(piRow);

  // Institution
  const instRow2 = _sgrEl('div', { class:'sgr-form-row' });
  instRow2.appendChild(_sgrEl('label', { class:'sgr-label', for:'fg-inst' }, 'Institution *'));
  const instInput = _sgrEl('input', { class:'sgr-input', id:'fg-inst', type:'text',
    placeholder:'University of [City], [Country]' });
  if (memberData && memberData.institution) instInput.value = memberData.institution;
  instRow2.appendChild(instInput);
  formWrap.appendChild(instRow2);

  // Country
  const cRow = _sgrEl('div', { class:'sgr-form-row' });
  cRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'fg-country' }, 'Country'));
  const csel = _sgrEl('select', { class:'sgr-select', id:'fg-country' });
  csel.appendChild(_sgrEl('option', { value:'' }, '-- Select Country --'));
  _SGR_COUNTRIES.forEach(function(c) {
    const opt = _sgrEl('option', { value:c }, c);
    if (memberData && memberData.country === c) opt.selected = true;
    csel.appendChild(opt);
  });
  cRow.appendChild(csel);
  formWrap.appendChild(cRow);

  // Mechanism
  const mechRow = _sgrEl('div', { class:'sgr-form-row' });
  mechRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'fg-mech' }, 'Fogarty Mechanism'));
  const msel = _sgrEl('select', { class:'sgr-select', id:'fg-mech' });
  ['D43 — International Research Training Grant', 'R21 TW — International Collaborative Research']
    .forEach(function(m) { msel.appendChild(_sgrEl('option', { value:m }, m)); });
  mechRow.appendChild(msel);
  formWrap.appendChild(mechRow);

  // Study Topic
  const topicRow = _sgrEl('div', { class:'sgr-form-row' });
  topicRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'fg-topic' }, 'Study Topic / Disease'));
  topicRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'fg-topic', type:'text',
    placeholder:'e.g. HIV antiretroviral adherence' }));
  formWrap.appendChild(topicRow);

  const genBtn = _sgrEl('button', { class:'sgr-submit-btn', id:'fg-gen-btn' }, 'Generate Letter Draft');
  const outWrap = _sgrEl('div', { id:'fg-output-wrap', style:'display:none;margin-top:18px;' });

  genBtn.addEventListener('click', function() {
    const pi      = (document.getElementById('fg-pi-name')?.value || '').trim();
    const inst    = (document.getElementById('fg-inst')?.value    || '').trim();
    const country = document.getElementById('fg-country')?.value  || '[Country]';
    const mech    = document.getElementById('fg-mech')?.value     || 'D43';
    const topic   = (document.getElementById('fg-topic')?.value   || '').trim() || 'medication adherence';
    const tesseraId = (memberData && memberData.tessera_id) || (isLMIC && typeof workspaceProfile !== 'undefined' && workspaceProfile.features && workspaceProfile.features.lmic_tessera_grc_id) || '[TESSERA-ID]';
    const mechShort = mech.startsWith('D43') ? 'D43' : 'R21 TW';
    const mechFull  = mech.startsWith('D43')
      ? 'D43 International Research Training Grant (NIH Fogarty International Center)'
      : 'R21 TW International Collaborative Research Grant (NIH Fogarty International Center)';

    if (!pi || !inst) {
      outWrap.style.display = 'block';
      outWrap.innerHTML = '<div style="color:#ef4444;font-size:0.80rem;padding:8px 0;">Please enter PI name and institution.</div>';
      return;
    }

    const letterText = [
      '[DATE]',
      '',
      'Dear Fogarty International Center Review Panel,',
      '',
      'I am writing to document institutional support for the ' + mechFull + ' application submitted by '
        + pi + ', ' + inst + ', ' + country + '.',
      '',
      'The proposed study on ' + topic + ' in ' + country + ' represents a scientifically rigorous '
        + 'contribution to the global medication adherence evidence base. The research team has been '
        + 'granted authorization to use the Multidimensional Adherence Parameters (MAP) instrument '
        + 'and, where applicable, the PEACS (Predictive Emergence Assessment for Clinical Services) '
        + 'longitudinal framework within the ATLAS platform (atlas.adherence.cc).',
      '',
      'TESSERA GRC (Global Research Consortium) actively supports validated, multicenter '
        + 'research using MAP, MMAS-8, and PEACS. ' + (tesseraId !== '[TESSERA-ID]' ? 'This investigator holds TESSERA GRC membership (ID: ' + tesseraId + '), confirming '
        + 'methodological oversight, psychometric integrity review, and access to the global TESSERA GRC '
        + 'normative dataset. ' : '')
        + 'The ' + mechShort + ' mechanism is an excellent fit: the proposed work contributes directly '
        + 'to the TESSERA GRC\'s mission of building sustainable adherence research capacity in low- and '
        + 'middle-income countries.',
      '',
      'The proposed study will: (1) generate normative MAP adherence data from a previously '
        + 'unstudied ' + country + ' population; (2) contribute this dataset to the TESSERA GRC global '
        + 'normative database; and (3) train in-country investigators in psychometrically rigorous '
        + 'adherence measurement methodology using the validated ATLAS platform infrastructure.',
      '',
      'I am pleased to confirm that TESSERA GRC provides full platform access, methodological mentorship, '
        + 'co-authorship pathways on consortium publications, and letters of support to all consortium '
        + 'members undertaking ' + mechShort + '-funded studies. This proposal has been reviewed and '
        + 'is endorsed by the TESSERA GRC scientific leadership.',
      '',
      'Sincerely,',
      '',
      'Philip Morisky, MBA',
      'Chief Optimus, Adherence Cartography',
      'Director, TESSERA GRC',
      'Creator, MMAS-8 and MAP Adherence Instruments',
      'Email: info@adherence.cc | Web: adherence.cc',
    ].join('\n');

    outWrap.style.display = 'block';
    outWrap.innerHTML = '';

    outWrap.appendChild(_sgrEl('div', { class:'sgr-section-title', style:'margin-bottom:10px;' }, 'Generated Letter Draft'));
    outWrap.appendChild(_sgrEl('div', { class:'sgr-text-block', style:'max-height:320px;white-space:pre-wrap;' }, _sgrEscHtml(letterText)));

    const copyBtn2 = _sgrEl('button', { class:'sgr-copy-btn', style:'margin-top:8px;' }, 'Copy Letter Text');
    copyBtn2.addEventListener('click', function() { _sgrCopyText(letterText, copyBtn2); });
    outWrap.appendChild(copyBtn2);

    outWrap.appendChild(_sgrEl('div', { style:'font-size:0.72rem;color:rgba(96,120,152,0.55);margin-top:8px;line-height:1.5;' },
      'Replace [DATE] and bracketed fields before submission. '
      + 'This letter is for preparation purposes; the official signed letter must be requested '
      + 'through the TESSERA GRC Letters of Support form (Request Support tab).'
    ));
  });

  formWrap.appendChild(genBtn);
  formWrap.appendChild(outWrap);
  container.appendChild(formWrap);
}

// ── Main LMIC Network render ──────────────────────────────────────────────────
function _sgrRenderLMICNetwork(container) {
  container.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:14px 0;"><span class="sgr-spinner"></span>Loading LMIC Network...</div>';

  const user = _sgrCurrentUser();
  const db   = _sgrDb();

  const render = function(memberData) {
    container.innerHTML = '';

    // Header
    const hdrBlock = _sgrEl('div', { style:'margin-bottom:22px;' });
    hdrBlock.innerHTML =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:#f97316;margin-bottom:5px;">TESSERA GRC · LMIC Research Network</div>' +
      '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.45rem;font-weight:300;color:rgba(205,216,232,0.92);line-height:1.25;margin-bottom:6px;">LMIC Study Protocols &amp; Grant Pipeline</div>' +
      '<div style="font-size:0.81rem;color:rgba(138,160,184,0.8);line-height:1.6;max-width:640px;">' +
        'Pre-built study protocols for common LMIC disease contexts. Click any protocol to pre-fill the study registry form. ' +
        'LMIC funding opportunities and a Fogarty letter pre-generator are included below.' +
      '</div>';
    container.appendChild(hdrBlock);

    // ── Protocol Cards ─────────────────────────────────────────────────────
    const protHdr = _sgrEl('div', { class:'sgr-reg-section-hdr' }, 'Pre-Built LMIC Study Protocols');
    container.appendChild(protHdr);

    container.appendChild(_sgrEl('div', { style:'font-size:0.79rem;color:rgba(138,160,184,0.8);margin-bottom:14px;line-height:1.55;' },
      'Click "Use This Protocol" to pre-fill the study registry form with the protocol details. Edit as needed before submitting.'
    ));

    const protGrid = _sgrEl('div', { class:'sgr-card-grid' });

    _SGR_LMIC_PROTOCOLS.forEach(function(proto) {
      const card = _sgrEl('div', { class:'sgr-card', style:'border-left:3px solid ' + proto.color + ';cursor:default;' });
      card.innerHTML =
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:' + _sgrEscHtml(proto.color) + ';margin-bottom:4px;">'
          + _sgrEscHtml(proto.region) + '</div>' +
        '<div class="sgr-template-title" style="color:' + _sgrEscHtml(proto.color) + ';">' + _sgrEscHtml(proto.title) + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;">'
          + proto.instruments.map(function(i) {
              return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;padding:2px 7px;border-radius:3px;border:1px solid ' + _sgrEscHtml(proto.colorBorder) + ';background:' + _sgrEscHtml(proto.colorFaint) + ';color:' + _sgrEscHtml(proto.color) + ';">' + _sgrEscHtml(i) + '</span>';
            }).join('') +
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:rgba(96,120,152,0.65);">N=' + proto.n + '</span>' +
        '</div>' +
        '<div class="sgr-template-desc">' + _sgrEscHtml(proto.summary) + '</div>' +
        '<div style="margin-top:8px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:rgba(96,120,152,0.65);">Follow-up: ' + _sgrEscHtml(proto.followUp) + '</div>' +
        '<div style="margin-top:5px;padding:7px 10px;background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.15);border-radius:5px;font-size:0.73rem;color:rgba(138,160,184,0.7);line-height:1.5;">Fogarty: ' + _sgrEscHtml(proto.fogartyFit) + '</div>';

      const useBtn = _sgrEl('button', { class:'sgr-copy-btn', style:'margin-top:10px;align-self:flex-start;' }, 'Use This Protocol');
      useBtn.addEventListener('click', function() {
        _sgrApplyProtocol(proto);
      });
      card.appendChild(useBtn);
      protGrid.appendChild(card);
    });

    container.appendChild(protGrid);

    // ── LMIC Funding Board ─────────────────────────────────────────────────
    const fundHdr = _sgrEl('div', { class:'sgr-reg-section-hdr', style:'margin-top:28px;' }, 'LMIC Funding Opportunities');
    container.appendChild(fundHdr);

    const lmicFunding = _SGR_FUNDING.filter(function(f) {
      return f.region === 'lmic' || f.region === 'global' || f.id === 'nih-d43';
    });

    const fundGrid = _sgrEl('div', { class:'sgr-fund-grid' });
    lmicFunding.forEach(function(f) {
      const card = _sgrEl('div', { class:'sgr-fund-card' });
      card.innerHTML =
        '<div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;">' +
          '<div class="sgr-fund-agency">' + _sgrEscHtml(f.agency) + '</div>' +
          '<div class="sgr-fund-mech">' + _sgrEscHtml(f.mechanism) + '</div>' +
        '</div>' +
        '<div class="sgr-fund-desc">' + _sgrEscHtml(f.desc) + '</div>' +
        '<div class="sgr-fund-deadline">Deadline: ' + _sgrEscHtml(f.deadline) + '</div>' +
        '<a href="' + _sgrEscHtml(f.url) + '" target="_blank" rel="noopener" class="sgr-learn-btn">Learn More &#8599;</a>';
      fundGrid.appendChild(card);
    });
    container.appendChild(fundGrid);

    // ── Fogarty letter generator ───────────────────────────────────────────
    container.appendChild(_sgrEl('div', { class:'sgr-divider', style:'margin-top:22px;' }));
    _sgrRenderFogartyGenerator(container, user, memberData);
  };

  if (db && user && user.uid) {
    db.ref('consortium_members/' + user.uid).once('value')
      .then(function(snap) { render(snap.val()); })
      .catch(function()    { render(null);       });
  } else {
    render(null);
  }
}

// ── Apply protocol to registry form ──────────────────────────────────────────
function _sgrApplyProtocol(proto) {
  // Switch to Registry tab first
  _sgrActiveTab = 'registry';
  const tabBar = document.querySelector('#sgr-content-wrap')?.previousElementSibling;
  if (tabBar) {
    tabBar.querySelectorAll('.sgr-tab').forEach(function(b) {
      b.classList.toggle('active', b.dataset && b.dataset.tab === 'registry');
    });
  }
  const wrap = document.getElementById('sgr-content-wrap');
  if (wrap) _sgrRenderRegistry(wrap);

  // Wait for the form to render, then pre-fill
  setTimeout(function() {
    const titleEl   = document.getElementById('sgr-reg-title');
    const diseaseEl = document.getElementById('sgr-reg-disease');
    const nEl       = document.getElementById('sgr-reg-n');
    const fuEl      = document.getElementById('sgr-reg-fu');

    if (titleEl)   titleEl.value   = proto.fullTitle;
    if (diseaseEl) diseaseEl.value = proto.disease;
    if (nEl)       nEl.value       = proto.n;
    if (fuEl)      fuEl.value      = proto.followUp;

    // Instruments
    if (document.getElementById('sgr-reg-cb-map'))   document.getElementById('sgr-reg-cb-map').checked   = proto.instruments.includes('MAP');
    if (document.getElementById('sgr-reg-cb-mmas'))  document.getElementById('sgr-reg-cb-mmas').checked  = proto.instruments.includes('MMAS-8');
    if (document.getElementById('sgr-reg-cb-peacs')) document.getElementById('sgr-reg-cb-peacs').checked = proto.instruments.includes('PEACS');

    if (typeof showToast === 'function') showToast('✓ Protocol pre-filled. Edit as needed, then submit.', 3000);

    // Scroll to the form
    const formWrap = document.querySelector('.sgr-form-wrap');
    if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 350);
}

// Expose sub-renderers for external call if needed
window.saGrantRenderTemplates   = _sgrRenderTemplates;
window.saGrantRenderFunding     = _sgrRenderFunding;
window.saGrantRenderSupport     = _sgrRenderSupport;
window.saGrantRenderMyTESSERA   = _sgrRenderMyTESSERA;
window.saGrantRenderRegistry    = _sgrRenderRegistry;
window.saGrantRenderLMICNetwork = _sgrRenderLMICNetwork;

// ══════════════════════════════════════════════════════════════════════════════
// TAB: RESEARCH EXCHANGE
// Community board where all ATLAS users can post and browse research cards.
// Firebase path: research_exchange/{pushKey}
// Card schema: { uid, memberId, name, institution, country, role, type, title,
//               description, countries_seeking, contact_email, posted, expires, status }
// ══════════════════════════════════════════════════════════════════════════════

const _REX_TYPES = {
  study_seeking_collaborator: { label:'Seeking Collaborator', color:'#d4a843' },
  grant_announcement:         { label:'Grant Opportunity',    color:'#38bdf8' },
  publication:                { label:'Publication',          color:'#2ec98a' },
  job_posting:                { label:'Position Available',   color:'#8b6ff5' },
};

let _rexTypeFilter = 'all';

function _sgrRenderExchange(container) {
  container.innerHTML =
    '<div style="padding:24px 0;color:rgba(96,120,152,0.65);font-size:0.80rem;display:flex;align-items:center;gap:8px;">' +
    '<span class="sgr-spinner"></span>Loading Research Exchange…</div>';

  const db = _sgrDb();
  if (!db) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database unavailable. Please try again.'));
    return;
  }

  Promise.all([
    db.ref('research_exchange').once('value'),
    db.ref('researcher_profiles').once('value').catch(() => null)
  ]).then(([exchSnap, profSnap]) => {
    container.innerHTML = '';
    const raw        = exchSnap.val() || {};
    const profileMap = (profSnap && profSnap.val()) || {};
    const now        = Date.now();
    const all        = Object.entries(raw)
      .filter(([, c]) => c.status !== 'closed' && (!c.expires || c.expires > now))
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.posted || 0) - (a.posted || 0));

    _sgrRenderExchangeView(container, all, profileMap);
  }).catch(err => {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' },
      'Could not load Research Exchange: ' + (err.message || 'Unknown error')));
  });
}

function _sgrRenderExchangeView(container, allCards, profileMap) {
  profileMap = profileMap || {};
  container.innerHTML = '';

  // Description
  container.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:680px;margin-bottom:18px;' },
    'Post open studies, collaboration requests, grant announcements, publications, and positions. ' +
    'Every ATLAS user can browse and post. Cards expire automatically.'
  ));

  // Action row: Post button + type filters + count
  const actionRow = _sgrEl('div', { class:'rex-action-row' });

  const postBtn = _sgrEl('button', { class:'sgr-submit-btn', style:'padding:7px 18px;flex-shrink:0;' }, '+ Post Card');
  postBtn.addEventListener('click', () => _sgrRenderPostCardForm(container));
  actionRow.appendChild(postBtn);

  const typeFilters = [
    { key:'all',                        label:'All'         },
    { key:'study_seeking_collaborator', label:'Collab'      },
    { key:'grant_announcement',         label:'Grants'      },
    { key:'publication',                label:'Publications'},
    { key:'job_posting',                label:'Positions'   },
  ];
  typeFilters.forEach(f => {
    const btn = _sgrEl('button', {
      class: 'sgr-filter-btn' + (_rexTypeFilter === f.key ? ' active' : '')
    }, f.label);
    btn.addEventListener('click', () => {
      _rexTypeFilter = f.key;
      actionRow.querySelectorAll('.sgr-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _sgrRefreshExchangeFeed(feedEl, allCards);
    });
    actionRow.appendChild(btn);
  });

  const countEl = _sgrEl('span', { class:'rex-count' }, allCards.length + ' card' + (allCards.length !== 1 ? 's' : ''));
  actionRow.appendChild(countEl);

  container.appendChild(actionRow);

  const feedEl = _sgrEl('div', { class:'rex-feed' });
  container.appendChild(feedEl);
  _sgrRefreshExchangeFeed(feedEl, allCards);
}

function _sgrRefreshExchangeFeed(feedEl, allCards) {
  feedEl.innerHTML = '';
  const filtered = _rexTypeFilter === 'all'
    ? allCards
    : allCards.filter(c => c.type === _rexTypeFilter);

  if (filtered.length === 0) {
    feedEl.innerHTML =
      '<div class="rex-empty">No cards match this filter.<br/>' +
      (_rexTypeFilter === 'all'
        ? 'Be the first to post and connect with the global network.'
        : 'Try another filter or post a card in this category.') +
      '</div>';
    return;
  }
  filtered.forEach(card => feedEl.appendChild(_sgrBuildExchangeCard(card, profileMap)));
}

function _sgrBuildExchangeCard(card, profileMap) {
  const tDef = _REX_TYPES[card.type] || { label: card.type || 'Post', color:'#8b6ff5' };
  const now  = Date.now();
  const daysLeft = card.expires ? Math.max(0, Math.ceil((card.expires - now) / 86400000)) : null;
  const metaParts = [card.name, card.institution, card.country].filter(Boolean);

  const el = _sgrEl('div', { class:'rex-card' });

  // Top row: type badge + expiry
  const topRow = _sgrEl('div', { style:'display:flex;align-items:center;justify-content:space-between;gap:8px;' });
  topRow.appendChild(_sgrEl('span', { class:'rex-type-badge',
    style:'background:' + tDef.color + '18;border-color:' + tDef.color + '40;color:' + tDef.color + ';'
  }, _sgrEscHtml(tDef.label)));
  if (daysLeft !== null) {
    topRow.appendChild(_sgrEl('span', { class:'rex-meta' }, daysLeft + 'd left'));
  }
  el.appendChild(topRow);

  el.appendChild(_sgrEl('div', { class:'rex-title' }, _sgrEscHtml(card.title || '—')));

  if (metaParts.length) {
    el.appendChild(_sgrEl('div', { class:'rex-meta', style:'margin-top:1px;' },
      _sgrEscHtml(metaParts.join(' · '))));
  }

  if (card.description) {
    const d = card.description.length > 220 ? card.description.slice(0, 220) + '…' : card.description;
    el.appendChild(_sgrEl('div', { class:'rex-desc' }, _sgrEscHtml(d)));
  }

  if (card.countries_seeking && card.countries_seeking.length) {
    const list = Array.isArray(card.countries_seeking) ? card.countries_seeking : [card.countries_seeking];
    el.appendChild(_sgrEl('div', { class:'rex-countries' },
      'Seeking: ' + _sgrEscHtml(list.join(', '))));
  }

  if (card.contact_email) {
    const a = _sgrEl('a', { class:'rex-contact-btn',
      href:'mailto:' + card.contact_email }, 'Contact →');
    el.appendChild(a);
  }

  // Author strip: shown when poster has a researcher profile
  const prof = profileMap && card.uid ? profileMap[card.uid] : null;
  if (prof && prof.visible !== false) {
    const initials = (prof.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const instruments = Array.isArray(prof.instruments) ? prof.instruments : [];
    const instrBadges = instruments.map(i => {
      const cfg = { map:['MAP','#d4a843'], peacs:['PEACS','#4e9cf5'], mmas8:['MMAS-8','#10b981'] }[i];
      return cfg ? '<span style="font-size:0.58rem;padding:1px 5px;border-radius:3px;background:' + cfg[1] + '18;border:1px solid ' + cfg[1] + '40;color:' + cfg[1] + ';margin-left:3px;">' + cfg[0] + '</span>' : '';
    }).join('');

    const strip = _sgrEl('div', {
      style:'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;'
    });
    const avatar = _sgrEl('div', {
      style:'width:24px;height:24px;border-radius:50%;background:rgba(212,168,67,0.15);border:1px solid rgba(212,168,67,0.3);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.55rem;color:#d4a843;flex-shrink:0;letter-spacing:0;'
    }, initials);
    const info = _sgrEl('div', { style:'flex:1;min-width:0;' });
    info.innerHTML =
      '<span style="font-size:0.72rem;color:rgba(205,216,232,0.8);">' + _sgrEscHtml(prof.name) +
      (prof.credentials ? '<span style="color:rgba(96,120,152,0.7);"> · ' + _sgrEscHtml(prof.credentials) + '</span>' : '') +
      '</span>' + instrBadges +
      (prof.institution ? '<div style="font-size:0.66rem;color:rgba(96,120,152,0.65);margin-top:1px;">' + _sgrEscHtml(prof.institution) + '</div>' : '');

    strip.appendChild(avatar);
    strip.appendChild(info);
    el.appendChild(strip);
  }

  return el;
}

function _sgrRenderPostCardForm(container) {
  const user = _sgrCurrentUser();
  const db   = _sgrDb();

  container.innerHTML = '';

  const hdr = _sgrEl('div', { class:'rex-post-hdr' });
  hdr.appendChild(_sgrEl('div', {
    style:'font-size:0.96rem;font-weight:600;color:rgba(205,216,232,0.92);'
  }, 'Post Research Card'));
  const backBtn = _sgrEl('button', { class:'rex-back-btn' }, '← Back to Exchange');
  backBtn.addEventListener('click', () => _sgrRenderExchange(container));
  hdr.appendChild(backBtn);
  container.appendChild(hdr);

  if (!user) {
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' },
      'You must be signed in to post a research card.'));
    return;
  }
  if (!db) {
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database unavailable.'));
    return;
  }

  // Show who they're posting as
  const wp = (typeof workspaceProfile !== 'undefined' && workspaceProfile) ? workspaceProfile : {};
  const posterName = wp.name || user.displayName || user.email || '';
  if (posterName) {
    container.appendChild(_sgrEl('div', { class:'rex-my-card' },
      'Posting as: ' + _sgrEscHtml(posterName) +
      (wp.institution ? '  ·  ' + _sgrEscHtml(wp.institution) : '')));
  }

  const form = _sgrEl('div', { class:'sgr-form-wrap' });

  // Type
  const typeRow = _sgrEl('div', { class:'sgr-form-row' });
  typeRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Card Type'));
  const typeSelect = _sgrEl('select', { class:'sgr-select', id:'rex-uf-type' });
  [
    ['study_seeking_collaborator', 'Seeking Collaborator'],
    ['grant_announcement',         'Grant Opportunity'],
    ['publication',                'Publication'],
    ['job_posting',                'Position Available'],
  ].forEach(([v, l]) => typeSelect.appendChild(_sgrEl('option', { value:v }, l)));
  typeRow.appendChild(typeSelect);
  form.appendChild(typeRow);

  // Title
  const titleRow = _sgrEl('div', { class:'sgr-form-row' });
  titleRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Title *'));
  titleRow.appendChild(_sgrEl('input', {
    class:'sgr-input', id:'rex-uf-title', type:'text',
    placeholder:'e.g. Seeking EU site PI for multi-country adherence study'
  }));
  form.appendChild(titleRow);

  // Description
  const descRow = _sgrEl('div', { class:'sgr-form-row' });
  descRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Description'));
  descRow.appendChild(_sgrEl('textarea', {
    class:'sgr-textarea', id:'rex-uf-desc',
    placeholder:'Brief description (2–3 sentences, 280 chars max)', rows:'3'
  }));
  const charCount = _sgrEl('div', { class:'sgr-char-count', id:'rex-uf-char' }, '0 / 280');
  descRow.appendChild(charCount);
  form.appendChild(descRow);

  // Countries seeking
  const countriesRow = _sgrEl('div', { class:'sgr-form-row' });
  countriesRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Countries Seeking (comma-separated)'));
  countriesRow.appendChild(_sgrEl('input', {
    class:'sgr-input', id:'rex-uf-countries', type:'text',
    placeholder:'e.g. Germany, Italy, Spain  (leave blank if open globally)'
  }));
  form.appendChild(countriesRow);

  // Contact email
  const emailRow = _sgrEl('div', { class:'sgr-form-row' });
  emailRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Contact Email *'));
  const emailInput = _sgrEl('input', {
    class:'sgr-input', id:'rex-uf-email', type:'email',
    placeholder:'your@institution.edu'
  });
  emailInput.value = user.email || '';
  emailRow.appendChild(emailInput);
  form.appendChild(emailRow);

  // Expires
  const expiresRow = _sgrEl('div', { class:'sgr-form-row' });
  expiresRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Card Expires After'));
  const daysSelect = _sgrEl('select', { class:'sgr-select', id:'rex-uf-days' });
  [['30','30 days'],['60','60 days'],['90','90 days (recommended)'],['180','180 days']].forEach(([v,l]) => {
    const opt = _sgrEl('option', { value:v }, l);
    if (v === '90') opt.selected = true;
    daysSelect.appendChild(opt);
  });
  expiresRow.appendChild(daysSelect);
  form.appendChild(expiresRow);

  const msgEl = _sgrEl('div', { style:'display:none;margin-top:8px;' });
  const submitBtn = _sgrEl('button', { class:'sgr-submit-btn', style:'margin-top:8px;' }, 'Post Card →');
  submitBtn.addEventListener('click', () => _sgrSubmitExchangeCard(container, submitBtn, msgEl, user, db));
  form.appendChild(submitBtn);
  form.appendChild(msgEl);
  container.appendChild(form);

  // Live char counter
  const descEl = form.querySelector('#rex-uf-desc');
  if (descEl) {
    descEl.addEventListener('input', () => {
      const n = descEl.value.length;
      charCount.textContent = n + ' / 280';
      charCount.style.color = n > 280 ? '#ef4444' : 'rgba(96,120,152,0.65)';
    });
  }
}

function _sgrSubmitExchangeCard(container, submitBtn, msgEl, user, db) {
  const type      = (document.getElementById('rex-uf-type')?.value)    || 'study_seeking_collaborator';
  const title     = (document.getElementById('rex-uf-title')?.value    || '').trim();
  const desc      = (document.getElementById('rex-uf-desc')?.value     || '').trim();
  const countries = (document.getElementById('rex-uf-countries')?.value|| '').split(',').map(s=>s.trim()).filter(Boolean);
  const email     = (document.getElementById('rex-uf-email')?.value    || '').trim();
  const days      = parseInt(document.getElementById('rex-uf-days')?.value) || 90;

  if (!title) { _rexShowMsg(msgEl, 'error', 'Title is required.'); return; }
  if (!email) { _rexShowMsg(msgEl, 'error', 'Contact email is required.'); return; }
  if (desc.length > 280) { _rexShowMsg(msgEl, 'error', 'Description must be 280 characters or fewer.'); return; }

  const wp = (typeof workspaceProfile !== 'undefined' && workspaceProfile) ? workspaceProfile : {};

  const card = {
    uid:               user.uid,
    memberId:          user.uid,
    name:              wp.name || user.displayName || '',
    institution:       wp.institution || wp.display_name || '',
    country:           wp.country || '',
    role:              wp.role || '',
    type,
    title,
    description:       desc   || null,
    countries_seeking: countries.length ? countries : null,
    contact_email:     email,
    posted:            Date.now(),
    expires:           Date.now() + days * 86400000,
    status:            'active',
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="sgr-spinner"></span>Posting…';

  db.ref('research_exchange').push(card)
    .then(() => {
      if (typeof showToast === 'function') showToast('Card posted to Research Exchange.', 3000);
      _rexTypeFilter = 'all';
      // Check if user already has a profile; if not, surface the profile creation prompt
      db.ref('researcher_profiles/' + user.uid).once('value').then(profSnap => {
        if (!profSnap.exists()) {
          _sgrRenderExchangeWithProfilePrompt(container, user, db);
        } else {
          _sgrRenderExchange(container);
        }
      }).catch(() => _sgrRenderExchange(container));
    })
    .catch(err => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Card →';
      _rexShowMsg(msgEl, 'error', 'Post failed: ' + (err.message || 'Unknown error'));
    });
}

function _rexShowMsg(el, type, text) {
  el.className = type === 'error' ? 'sgr-error-box' : 'sgr-success-box';
  el.textContent = text;
  el.style.display = 'block';
}

window.saGrantRenderExchange = _sgrRenderExchange;

// ══════════════════════════════════════════════════════════════════════════════
// TAB: RESEARCHER DIRECTORY
// Community profiles for ATLAS researchers. Opt-in. Stored at
// Firebase path: researcher_profiles/{uid}
// Schema: { name, credentials, institution, country, bio, instruments:[],
//           specialties:[], contact_email, visible, updated }
// ══════════════════════════════════════════════════════════════════════════════

const _DIR_INSTRUMENTS = [
  { key:'map',   label:'MAP',    color:'#d4a843' },
  { key:'peacs', label:'PEACS',  color:'#4e9cf5' },
  { key:'mmas8', label:'MMAS-8', color:'#10b981' },
];

const _DIR_SPECIALTIES = [
  'SDoH','CHW','LMIC','Global Health','Pediatric','Geriatric',
  'Pharmacy','Oncology','HIV/AIDS','Mental Health','Cardiology',
  'Diabetes','Chronic Disease','Telehealth','Community Health',
  'Implementation Science',
];

let _dirSpecFilter = '';

function _sgrRenderDirectory(container) {
  container.innerHTML =
    '<div style="padding:24px 0;color:rgba(96,120,152,0.65);font-size:0.80rem;display:flex;align-items:center;gap:8px;">' +
    '<span class="sgr-spinner"></span>Loading Researcher Directory…</div>';

  const db   = _sgrDb();
  const user = _sgrCurrentUser();

  if (!db) {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' }, 'Database unavailable. Please try again.'));
    return;
  }

  db.ref('researcher_profiles').once('value').then(snap => {
    container.innerHTML = '';
    const raw  = snap.val() || {};
    const list = Object.entries(raw)
      .filter(([, p]) => p.visible !== false)
      .map(([uid, p]) => ({ uid, ...p }))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));

    _sgrRenderDirectoryView(container, list, user, db);
  }).catch(err => {
    container.innerHTML = '';
    container.appendChild(_sgrEl('div', { class:'sgr-error-box' },
      'Could not load directory: ' + (err.message || 'Unknown error')));
  });
}

function _sgrRenderDirectoryView(container, profiles, user, db) {
  // Header row
  const hdr = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;' });
  const desc = _sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:580px;' });
  desc.textContent = 'Verified ATLAS researchers who have opted in to share their profile. Browse by specialty or instrument to find collaborators.';
  hdr.appendChild(desc);

  if (user) {
    const myBtn = _sgrEl('button', { class:'sgr-submit-btn', style:'flex-shrink:0;padding:7px 16px;white-space:nowrap;' }, '+ My Profile');
    myBtn.addEventListener('click', () => {
      db.ref('researcher_profiles/' + user.uid).once('value').then(snap => {
        _sgrRenderProfileForm(container, snap.val(), user, db, () => _sgrRenderDirectory(container));
      });
    });
    hdr.appendChild(myBtn);
  }
  container.appendChild(hdr);

  // Specialty filter pills
  const filterRow = _sgrEl('div', { style:'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;' });
  const allPill = _sgrEl('button', {
    class:'sgr-filter-btn' + (_dirSpecFilter === '' ? ' active' : ''),
    style:'font-size:0.66rem;padding:3px 10px;'
  }, 'All');
  allPill.addEventListener('click', () => { _dirSpecFilter = ''; _sgrRefreshDirectoryGrid(grid, profiles); filterRow.querySelectorAll('.sgr-filter-btn').forEach(b => b.classList.remove('active')); allPill.classList.add('active'); });
  filterRow.appendChild(allPill);

  _DIR_SPECIALTIES.forEach(spec => {
    const pill = _sgrEl('button', {
      class:'sgr-filter-btn' + (_dirSpecFilter === spec ? ' active' : ''),
      style:'font-size:0.66rem;padding:3px 10px;'
    }, spec);
    pill.addEventListener('click', () => {
      _dirSpecFilter = spec;
      filterRow.querySelectorAll('.sgr-filter-btn').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
      _sgrRefreshDirectoryGrid(grid, profiles);
    });
    filterRow.appendChild(pill);
  });
  container.appendChild(filterRow);

  // Profile grid
  const grid = _sgrEl('div', {
    style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;'
  });
  container.appendChild(grid);
  _sgrRefreshDirectoryGrid(grid, profiles);

  // Empty state with CTA
  if (profiles.length === 0 && user) {
    const empty = _sgrEl('div', {
      style:'padding:32px 0;text-align:center;color:rgba(96,120,152,0.65);font-size:0.82rem;line-height:1.8;'
    });
    empty.innerHTML = 'No researcher profiles yet.<br>Be the first to add yours and help build the ATLAS research network.';
    grid.appendChild(empty);
  }
}

function _sgrRefreshDirectoryGrid(grid, profiles) {
  grid.innerHTML = '';
  const filtered = _dirSpecFilter
    ? profiles.filter(p => Array.isArray(p.specialties) && p.specialties.includes(_dirSpecFilter))
    : profiles;

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:24px 0;color:rgba(96,120,152,0.65);font-size:0.82rem;text-align:center;">No profiles match this filter.</div>';
    return;
  }
  filtered.forEach(p => grid.appendChild(_sgrBuildProfileCard(p)));
}

function _sgrBuildProfileCard(profile) {
  const initials  = (profile.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const instruments = Array.isArray(profile.instruments) ? profile.instruments : [];
  const specialties = Array.isArray(profile.specialties) ? profile.specialties : [];

  const card = _sgrEl('div', {
    style:'background:var(--card,#111d30);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.2s;'
  });

  // Avatar + name row
  const topRow = _sgrEl('div', { style:'display:flex;align-items:center;gap:12px;' });
  topRow.appendChild(_sgrEl('div', {
    style:'width:40px;height:40px;border-radius:50%;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.28);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono,monospace);font-size:0.78rem;color:#d4a843;flex-shrink:0;letter-spacing:0;font-weight:500;'
  }, initials));

  const nameBlock = _sgrEl('div', { style:'min-width:0;' });
  nameBlock.appendChild(_sgrEl('div', {
    style:'font-size:0.88rem;font-weight:600;color:rgba(205,216,232,0.92);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
  }, _sgrEscHtml(profile.name || '—')));
  if (profile.credentials) {
    nameBlock.appendChild(_sgrEl('div', {
      style:'font-size:0.70rem;color:rgba(96,120,152,0.75);margin-top:1px;'
    }, _sgrEscHtml(profile.credentials)));
  }
  topRow.appendChild(nameBlock);
  card.appendChild(topRow);

  // Institution + country
  if (profile.institution || profile.country) {
    card.appendChild(_sgrEl('div', {
      style:'font-size:0.72rem;color:rgba(96,120,152,0.7);line-height:1.4;'
    }, _sgrEscHtml([profile.institution, profile.country].filter(Boolean).join(' · '))));
  }

  // Instrument badges
  if (instruments.length) {
    const row = _sgrEl('div', { style:'display:flex;gap:5px;flex-wrap:wrap;' });
    instruments.forEach(key => {
      const cfg = _DIR_INSTRUMENTS.find(i => i.key === key);
      if (!cfg) return;
      row.appendChild(_sgrEl('span', {
        style:'font-size:0.60rem;padding:2px 7px;border-radius:4px;background:' + cfg.color + '18;border:1px solid ' + cfg.color + '40;color:' + cfg.color + ';font-family:var(--font-mono,monospace);letter-spacing:0.04em;'
      }, cfg.label));
    });
    card.appendChild(row);
  }

  // Specialty pills (first 4)
  if (specialties.length) {
    const row = _sgrEl('div', { style:'display:flex;gap:4px;flex-wrap:wrap;' });
    specialties.slice(0, 4).forEach(spec => {
      row.appendChild(_sgrEl('span', {
        style:'font-size:0.60rem;padding:2px 7px;border-radius:4px;background:rgba(139,111,245,0.10);border:1px solid rgba(139,111,245,0.22);color:rgba(139,111,245,0.85);'
      }, _sgrEscHtml(spec)));
    });
    if (specialties.length > 4) {
      row.appendChild(_sgrEl('span', { style:'font-size:0.60rem;color:rgba(96,120,152,0.55);' }, '+' + (specialties.length - 4) + ' more'));
    }
    card.appendChild(row);
  }

  // Bio snippet
  if (profile.bio) {
    const bio = profile.bio.length > 120 ? profile.bio.slice(0, 120) + '…' : profile.bio;
    card.appendChild(_sgrEl('div', {
      style:'font-size:0.74rem;color:rgba(138,160,184,0.7);line-height:1.6;flex:1;'
    }, _sgrEscHtml(bio)));
  }

  // Connect button
  if (profile.contact_email) {
    const connect = _sgrEl('a', {
      href: 'mailto:' + profile.contact_email,
      style:'display:inline-block;margin-top:4px;font-family:var(--font-mono,monospace);font-size:0.64rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(78,156,245,0.85);text-decoration:none;border:1px solid rgba(78,156,245,0.25);border-radius:6px;padding:5px 12px;background:rgba(78,156,245,0.07);transition:all 0.15s;align-self:flex-start;'
    }, 'Connect →');
    card.appendChild(connect);
  }

  return card;
}

function _sgrRenderProfileForm(container, existingProfile, user, db, afterSave) {
  container.innerHTML = '';
  const ep = existingProfile || {};
  const isNew = !existingProfile;

  const hdr = _sgrEl('div', { class:'rex-post-hdr' });
  hdr.appendChild(_sgrEl('div', {
    style:'font-size:0.96rem;font-weight:600;color:rgba(205,216,232,0.92);'
  }, isNew ? 'Create Researcher Profile' : 'Edit My Profile'));
  const backBtn = _sgrEl('button', { class:'rex-back-btn' }, '← Back');
  backBtn.addEventListener('click', () => _sgrRenderDirectory(container));
  hdr.appendChild(backBtn);
  container.appendChild(hdr);

  container.appendChild(_sgrEl('div', {
    style:'font-size:0.78rem;color:rgba(96,120,152,0.7);line-height:1.6;margin-bottom:16px;max-width:560px;'
  }, 'Your profile is visible to all authenticated ATLAS users in the Researcher Directory. You control what you share.'));

  const form = _sgrEl('div', { class:'sgr-form-wrap' });

  // Name
  const nameRow = _sgrEl('div', { class:'sgr-form-row' });
  nameRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Full Name *'));
  const nameInput = _sgrEl('input', { class:'sgr-input', id:'dir-f-name', type:'text', placeholder:'Dr. Jane Smith' });
  nameInput.value = ep.name || '';
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  // Credentials
  const credRow = _sgrEl('div', { class:'sgr-form-row' });
  credRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Credentials'));
  const credInput = _sgrEl('input', { class:'sgr-input', id:'dir-f-cred', type:'text', placeholder:'PharmD, PhD' });
  credInput.value = ep.credentials || '';
  credRow.appendChild(credInput);
  form.appendChild(credRow);

  // Institution
  const instRow = _sgrEl('div', { class:'sgr-form-row' });
  instRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Institution'));
  const instInput = _sgrEl('input', { class:'sgr-input', id:'dir-f-inst', type:'text', placeholder:'University of Ghana · Pharmacy' });
  instInput.value = ep.institution || '';
  instRow.appendChild(instInput);
  form.appendChild(instRow);

  // Country
  const cntryRow = _sgrEl('div', { class:'sgr-form-row' });
  cntryRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Country'));
  const cntryInput = _sgrEl('input', { class:'sgr-input', id:'dir-f-country', type:'text', placeholder:'Ghana' });
  cntryInput.value = ep.country || '';
  cntryRow.appendChild(cntryInput);
  form.appendChild(cntryRow);

  // Instruments
  const instrRow = _sgrEl('div', { class:'sgr-form-row' });
  instrRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Instruments Used'));
  const instrWrap = _sgrEl('div', { style:'display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;' });
  const epInstr = Array.isArray(ep.instruments) ? ep.instruments : [];
  _DIR_INSTRUMENTS.forEach(instr => {
    const label = _sgrEl('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.78rem;color:rgba(205,216,232,0.8);' });
    const cb = _sgrEl('input', { type:'checkbox', 'data-instr':instr.key, style:'accent-color:' + instr.color + ';width:14px;height:14px;cursor:pointer;' });
    if (epInstr.includes(instr.key)) cb.checked = true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(instr.label));
    instrWrap.appendChild(label);
  });
  instrRow.appendChild(instrWrap);
  form.appendChild(instrRow);

  // Specialties
  const specRow = _sgrEl('div', { class:'sgr-form-row' });
  specRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Research Specialties'));
  const epSpec = Array.isArray(ep.specialties) ? ep.specialties : [];
  const specWrap = _sgrEl('div', { id:'dir-f-specs', style:'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;' });
  _DIR_SPECIALTIES.forEach(spec => {
    const active = epSpec.includes(spec);
    const pill = _sgrEl('button', {
      type:'button',
      'data-spec':spec,
      style:'font-size:0.64rem;padding:3px 10px;border-radius:20px;cursor:pointer;transition:all 0.15s;border:1px solid ' + (active ? 'rgba(139,111,245,0.6)' : 'rgba(255,255,255,0.1)') + ';background:' + (active ? 'rgba(139,111,245,0.15)' : 'transparent') + ';color:' + (active ? 'rgba(139,111,245,0.9)' : 'rgba(138,160,184,0.6)') + ';'
    }, spec);
    pill.addEventListener('click', () => {
      pill.dataset.active = pill.dataset.active === '1' ? '' : '1';
      const on = pill.dataset.active === '1';
      pill.style.border = '1px solid ' + (on ? 'rgba(139,111,245,0.6)' : 'rgba(255,255,255,0.1)');
      pill.style.background = on ? 'rgba(139,111,245,0.15)' : 'transparent';
      pill.style.color = on ? 'rgba(139,111,245,0.9)' : 'rgba(138,160,184,0.6)';
    });
    if (active) pill.dataset.active = '1';
    specWrap.appendChild(pill);
  });
  specRow.appendChild(specWrap);
  form.appendChild(specRow);

  // Bio
  const bioRow = _sgrEl('div', { class:'sgr-form-row' });
  bioRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Short Bio (280 chars max)'));
  const bioArea = _sgrEl('textarea', { class:'sgr-textarea', id:'dir-f-bio', rows:'3', placeholder:'One or two sentences about your research focus and clinical/academic context.' });
  bioArea.value = ep.bio || '';
  const bioCount = _sgrEl('div', { class:'sgr-char-count', id:'dir-f-bio-count' }, (ep.bio || '').length + ' / 280');
  bioArea.addEventListener('input', () => {
    const n = bioArea.value.length;
    bioCount.textContent = n + ' / 280';
    bioCount.style.color = n > 280 ? '#ef4444' : 'rgba(96,120,152,0.65)';
  });
  bioRow.appendChild(bioArea);
  bioRow.appendChild(bioCount);
  form.appendChild(bioRow);

  // Contact email
  const emailRow = _sgrEl('div', { class:'sgr-form-row' });
  emailRow.appendChild(_sgrEl('label', { class:'sgr-label' }, 'Contact Email *'));
  const emailInput = _sgrEl('input', { class:'sgr-input', id:'dir-f-email', type:'email', placeholder:'your@institution.edu' });
  emailInput.value = ep.contact_email || (user ? user.email : '') || '';
  emailRow.appendChild(emailInput);
  form.appendChild(emailRow);

  // Visibility toggle
  const visRow = _sgrEl('div', { class:'sgr-form-row', style:'flex-direction:row;align-items:center;gap:10px;' });
  const visCb = _sgrEl('input', { type:'checkbox', id:'dir-f-vis', style:'width:16px;height:16px;accent-color:#10b981;cursor:pointer;' });
  visCb.checked = ep.visible !== false;
  visRow.appendChild(visCb);
  visRow.appendChild(_sgrEl('label', { for:'dir-f-vis', style:'font-size:0.78rem;color:rgba(205,216,232,0.8);cursor:pointer;' }, 'Show my profile in the Researcher Directory'));
  form.appendChild(visRow);

  const msgEl  = _sgrEl('div', { style:'display:none;margin-top:8px;' });
  const saveBtn = _sgrEl('button', { class:'sgr-submit-btn', style:'margin-top:8px;' }, isNew ? 'Create Profile →' : 'Save Changes →');
  saveBtn.addEventListener('click', () => _sgrSubmitProfile(form, saveBtn, msgEl, user, db, afterSave));
  form.appendChild(saveBtn);
  form.appendChild(msgEl);
  container.appendChild(form);
}

function _sgrSubmitProfile(form, saveBtn, msgEl, user, db, afterSave) {
  const name   = (document.getElementById('dir-f-name')?.value    || '').trim();
  const cred   = (document.getElementById('dir-f-cred')?.value    || '').trim();
  const inst   = (document.getElementById('dir-f-inst')?.value    || '').trim();
  const country= (document.getElementById('dir-f-country')?.value || '').trim();
  const bio    = (document.getElementById('dir-f-bio')?.value     || '').trim();
  const email  = (document.getElementById('dir-f-email')?.value   || '').trim();
  const visible= document.getElementById('dir-f-vis')?.checked !== false;

  if (!name) { _rexShowMsg(msgEl, 'error', 'Name is required.'); return; }
  if (!email) { _rexShowMsg(msgEl, 'error', 'Contact email is required.'); return; }
  if (bio.length > 280) { _rexShowMsg(msgEl, 'error', 'Bio must be 280 characters or fewer.'); return; }

  const instruments = [];
  form.querySelectorAll('[data-instr]').forEach(cb => { if (cb.checked) instruments.push(cb.dataset.instr); });
  const specialties = [];
  form.querySelectorAll('[data-spec]').forEach(pill => { if (pill.dataset.active === '1') specialties.push(pill.dataset.spec); });

  const profile = {
    name,
    credentials:   cred   || null,
    institution:   inst   || null,
    country:       country || null,
    bio:           bio    || null,
    instruments:   instruments.length ? instruments : null,
    specialties:   specialties.length ? specialties : null,
    contact_email: email,
    visible,
    updated:       Date.now(),
    uid:           user.uid,
  };

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="sgr-spinner"></span>Saving…';

  db.ref('researcher_profiles/' + user.uid).set(profile)
    .then(() => {
      if (typeof showToast === 'function') showToast('Researcher profile saved.', 3000);
      if (typeof afterSave === 'function') afterSave();
      else _sgrRenderDirectory(form.closest('[id]') || document.getElementById('sgr-content-wrap') || document.body);
    })
    .catch(err => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes →';
      _rexShowMsg(msgEl, 'error', 'Save failed: ' + (err.message || 'Unknown error'));
    });
}

function _sgrRenderExchangeWithProfilePrompt(container, user, db) {
  // Render a brief "create your profile" banner above the normal exchange view
  container.innerHTML = '';

  const banner = _sgrEl('div', {
    style:'background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;'
  });
  const bannerText = _sgrEl('div');
  bannerText.appendChild(_sgrEl('div', { style:'font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.9);margin-bottom:2px;' }, 'Your card is live!'));
  bannerText.appendChild(_sgrEl('div', { style:'font-size:0.76rem;color:rgba(96,120,152,0.8);' }, 'Add a researcher profile so collaborators can learn more about your work.'));
  banner.appendChild(bannerText);

  const btnRow = _sgrEl('div', { style:'display:flex;gap:8px;flex-shrink:0;' });
  const createBtn = _sgrEl('button', { class:'sgr-submit-btn', style:'padding:6px 14px;font-size:0.72rem;' }, 'Create Profile →');
  createBtn.addEventListener('click', () => {
    _sgrRenderProfileForm(container, null, user, db, () => _sgrRenderExchange(container));
  });
  const skipBtn = _sgrEl('button', {
    style:'padding:6px 12px;font-size:0.70rem;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:rgba(96,120,152,0.7);cursor:pointer;font-family:var(--font-mono,monospace);letter-spacing:0.05em;'
  }, 'Skip');
  skipBtn.addEventListener('click', () => _sgrRenderExchange(container));
  btnRow.appendChild(createBtn);
  btnRow.appendChild(skipBtn);
  banner.appendChild(btnRow);
  container.appendChild(banner);

  // Then render the exchange normally below the banner
  const feedWrap = _sgrEl('div');
  container.appendChild(feedWrap);
  Promise.all([
    db.ref('research_exchange').once('value'),
    db.ref('researcher_profiles').once('value').catch(() => null)
  ]).then(([exchSnap, profSnap]) => {
    const raw        = exchSnap.val() || {};
    const profileMap = (profSnap && profSnap.val()) || {};
    const now        = Date.now();
    const all        = Object.entries(raw)
      .filter(([, c]) => c.status !== 'closed' && (!c.expires || c.expires > now))
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.posted || 0) - (a.posted || 0));
    _sgrRenderExchangeView(feedWrap, all, profileMap);
  }).catch(() => _sgrRenderExchange(feedWrap));
}

window.saGrantRenderDirectory = _sgrRenderDirectory;
