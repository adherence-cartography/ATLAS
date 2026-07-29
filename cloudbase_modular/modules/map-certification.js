// map-certification.js — MAP Certification Program
// ATLAS v8.7.0 — TESSERA GRC / Scala Carta Foundation
// Globals: renderCertificationHub, renderFoundationTraining, renderDigitalCertificate,
//          renderCertificationDirectory, renderMyCertifications
// Firebase path: map_cert_progress/{userId}
// API: /api/v1/certification/*

// ── Design tokens ─────────────────────────────────────────────────────────────
const _MC = {
  ink:     '#080e1a',
  surface: '#0d1525',
  card:    '#111d30',
  border:  'rgba(255,255,255,0.07)',
  bright:  '#e8f0f8',
  muted:   '#6b8099',
  base:    '#4e9cf5',
  pe:      '#d4a843',
  amber:   '#d4a843',
  amberDim:'rgba(212,168,67,0.18)',
  amberBdr:'rgba(212,168,67,0.35)',
  cyan:    '#38bdf8',
  cyanDim: 'rgba(56,189,248,0.14)',
  cyanBdr: 'rgba(56,189,248,0.35)',
  gold:    '#f0c843',
  goldDim: 'rgba(240,200,67,0.14)',
  goldBdr: 'rgba(240,200,67,0.45)',
  purple:  '#8b6ff5',
  purpleDim:'rgba(139,111,245,0.14)',
  red:     '#ef4444',
  green:   '#2ec98a',
  greenDim:'rgba(46,201,138,0.12)',
  text:    'rgba(232,240,248,0.93)',
  dim:     'rgba(107,128,153,0.8)',
};

// ── Inject styles (idempotent) ─────────────────────────────────────────────────
function _mcInjectStyles() {
  if (document.getElementById('mc-styles')) return;
  const s = document.createElement('style');
  s.id = 'mc-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

    /* ── Layout ── */
    .mc-wrap{font-family:'IBM Plex Sans',system-ui,sans-serif;color:${_MC.text};background:transparent;}
    .mc-header{margin-bottom:24px;}
    .mc-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:0.63rem;letter-spacing:0.22em;text-transform:uppercase;color:${_MC.pe};margin-bottom:5px;}
    .mc-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.65rem;font-weight:300;color:${_MC.bright};line-height:1.2;}
    .mc-sub{font-size:0.81rem;color:${_MC.muted};margin-top:6px;line-height:1.6;}

    /* ── Hub track cards ── */
    .mc-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px;}
    .mc-track{background:${_MC.card};border-radius:12px;padding:22px 20px;border:1px solid ${_MC.border};transition:transform 0.15s,box-shadow 0.15s;}
    .mc-track:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.35);}
    .mc-track-badge{font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;padding:3px 10px;border-radius:20px;border:1px solid;display:inline-block;margin-bottom:14px;}
    .mc-track-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:600;margin-bottom:6px;}
    .mc-track-audience{font-size:0.76rem;color:${_MC.muted};margin-bottom:12px;line-height:1.5;}
    .mc-track-meta{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:${_MC.muted};margin-bottom:4px;line-height:1.8;}
    .mc-track-meta strong{color:${_MC.bright};}
    .mc-track-divider{border:none;border-top:1px solid ${_MC.border};margin:14px 0;}
    .mc-btn{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 18px;border-radius:6px;border:1px solid;cursor:pointer;transition:all 0.14s;text-decoration:none;line-height:1;}
    .mc-btn:disabled,.mc-btn[disabled]{opacity:0.45;cursor:not-allowed;}
    .mc-btn-amber{color:${_MC.amber};border-color:${_MC.amberBdr};background:${_MC.amberDim};}
    .mc-btn-amber:hover:not(:disabled){background:rgba(212,168,67,0.28);}
    .mc-btn-cyan{color:${_MC.cyan};border-color:${_MC.cyanBdr};background:${_MC.cyanDim};}
    .mc-btn-cyan:hover:not(:disabled){background:rgba(56,189,248,0.24);}
    .mc-btn-gold{color:${_MC.gold};border-color:${_MC.goldBdr};background:${_MC.goldDim};}
    .mc-btn-gold:hover:not(:disabled){background:rgba(240,200,67,0.24);}
    .mc-btn-base{color:${_MC.base};border-color:rgba(78,156,245,0.4);background:rgba(78,156,245,0.1);}
    .mc-btn-base:hover:not(:disabled){background:rgba(78,156,245,0.2);}
    .mc-btn-ghost{color:${_MC.muted};border-color:${_MC.border};background:transparent;}
    .mc-btn-ghost:hover{color:${_MC.bright};border-color:rgba(255,255,255,0.15);}
    .mc-req-note{margin-top:14px;font-size:0.74rem;color:${_MC.amber};background:rgba(212,168,67,0.08);border:1px solid ${_MC.amberBdr};border-radius:6px;padding:8px 12px;}

    /* ── Training view ── */
    .mc-training-back{margin-bottom:20px;}
    .mc-modules-list{display:flex;flex-direction:column;gap:12px;margin-bottom:24px;}
    .mc-module-row{background:${_MC.card};border:1px solid ${_MC.border};border-radius:10px;padding:16px 18px;cursor:pointer;transition:border-color 0.15s;}
    .mc-module-row:hover{border-color:rgba(255,255,255,0.16);}
    .mc-module-row.mc-open{border-radius:10px 10px 0 0;margin-bottom:0;}
    .mc-module-row-header{display:flex;align-items:center;gap:14px;}
    .mc-module-num{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;padding:3px 9px;border-radius:4px;border:1px solid;flex-shrink:0;}
    .mc-module-label{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:${_MC.bright};flex:1;}
    .mc-module-status{font-family:'IBM Plex Mono',monospace;font-size:0.67rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1px solid;white-space:nowrap;}
    .mc-module-status.passed{color:${_MC.green};border-color:rgba(46,201,138,0.4);background:rgba(46,201,138,0.10);}
    .mc-module-status.in-progress{color:${_MC.amber};border-color:${_MC.amberBdr};background:${_MC.amberDim};}
    .mc-module-status.locked{color:${_MC.muted};border-color:${_MC.border};background:transparent;}
    .mc-module-status.available{color:${_MC.base};border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.09);}

    /* ── Slide viewer ── */
    .mc-slide-viewer{background:${_MC.card};border:1px solid ${_MC.border};border-radius:0 0 10px 10px;padding:22px 22px 18px;margin-bottom:12px;}
    .mc-slide-nav{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
    .mc-slide-counter{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:${_MC.muted};flex:1;}
    .mc-slide-dots{display:flex;gap:6px;}
    .mc-dot{width:7px;height:7px;border-radius:50%;background:${_MC.border};transition:background 0.15s;}
    .mc-dot.active{background:${_MC.pe};}
    .mc-dot.done{background:rgba(46,201,138,0.5);}
    .mc-slide-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:0.63rem;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;}
    .mc-slide-heading{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.30rem;font-weight:600;color:${_MC.bright};margin-bottom:12px;line-height:1.25;}
    .mc-slide-body{font-size:0.83rem;color:${_MC.text};line-height:1.7;}
    .mc-slide-body p{margin:0 0 10px;}
    .mc-slide-body p:last-child{margin-bottom:0;}

    /* Domain cards in slide */
    .mc-domain-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:14px 0;}
    .mc-domain-card{border-radius:8px;padding:13px 14px;border:1px solid;}
    .mc-domain-card .mc-domain-label{font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:5px;font-weight:600;}
    .mc-domain-card .mc-domain-items{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;margin-bottom:6px;}
    .mc-domain-card .mc-domain-desc{font-size:0.76rem;line-height:1.55;}

    /* PE formula box */
    .mc-pe-formula{background:rgba(212,168,67,0.07);border:1px solid ${_MC.amberBdr};border-radius:8px;padding:14px 16px;margin:14px 0;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_MC.pe};letter-spacing:0.04em;}
    .mc-pe-formula .mc-pe-label{font-size:0.63rem;letter-spacing:0.18em;text-transform:uppercase;color:${_MC.muted};margin-bottom:5px;}
    .mc-pe-worked{font-size:0.76rem;color:${_MC.muted};margin-top:8px;line-height:1.6;}
    .mc-pe-worked strong{color:${_MC.text};}

    /* ── Quiz ── */
    .mc-quiz{background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.18);border-radius:0 0 10px 10px;padding:20px 22px;margin-bottom:12px;}
    .mc-quiz-title{font-family:'IBM Plex Mono',monospace;font-size:0.76rem;font-weight:600;color:${_MC.base};margin-bottom:14px;letter-spacing:0.06em;text-transform:uppercase;}
    .mc-q{margin-bottom:18px;}
    .mc-q-text{font-size:0.83rem;color:${_MC.bright};margin-bottom:9px;line-height:1.55;font-weight:500;}
    .mc-q-num{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${_MC.muted};margin-right:6px;}
    .mc-choice{display:flex;align-items:flex-start;gap:9px;padding:8px 11px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all 0.13s;margin-bottom:5px;}
    .mc-choice:hover{background:rgba(78,156,245,0.07);border-color:rgba(78,156,245,0.20);}
    .mc-choice.selected{background:rgba(78,156,245,0.12);border-color:rgba(78,156,245,0.38);}
    .mc-choice.correct{background:rgba(46,201,138,0.12);border-color:rgba(46,201,138,0.40);}
    .mc-choice.wrong{background:rgba(239,68,68,0.09);border-color:rgba(239,68,68,0.35);}
    .mc-choice-bullet{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,0.20);flex-shrink:0;margin-top:1px;transition:all 0.13s;}
    .mc-choice.selected .mc-choice-bullet{background:${_MC.base};border-color:${_MC.base};}
    .mc-choice.correct .mc-choice-bullet{background:${_MC.green};border-color:${_MC.green};}
    .mc-choice.wrong .mc-choice-bullet{background:${_MC.red};border-color:${_MC.red};}
    .mc-choice-text{font-size:0.80rem;color:${_MC.text};line-height:1.45;}
    .mc-quiz-actions{display:flex;gap:10px;align-items:center;margin-top:6px;}
    .mc-quiz-feedback{font-size:0.78rem;padding:8px 12px;border-radius:6px;margin-top:10px;line-height:1.5;}
    .mc-quiz-feedback.pass{color:${_MC.green};background:rgba(46,201,138,0.09);border:1px solid rgba(46,201,138,0.30);}
    .mc-quiz-feedback.fail{color:${_MC.red};background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.28);}
    .mc-score-breakdown{background:${_MC.card};border:1px solid ${_MC.border};border-radius:10px;padding:20px;margin:14px 0;}
    .mc-score-breakdown-title{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.14em;color:${_MC.muted};margin-bottom:12px;}
    .mc-score-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${_MC.border};font-size:0.80rem;}
    .mc-score-row:last-child{border-bottom:none;}
    .mc-score-val{font-family:'IBM Plex Mono',monospace;font-weight:600;}

    /* ── Certificate ── */
    .mc-cert-wrap{max-width:860px;margin:0 auto;}
    .mc-cert-card{background:linear-gradient(160deg,#0c1828 0%,#0a1420 60%,#0d1a2c 100%);border:2px solid ${_MC.gold};border-radius:8px;overflow:hidden;box-shadow:0 12px 60px rgba(0,0,0,0.6),inset 0 0 0 6px rgba(240,200,67,0.04);position:relative;}
    .mc-cert-card::before{content:'';position:absolute;inset:8px;border:1px solid rgba(240,200,67,0.18);border-radius:4px;pointer-events:none;z-index:0;}
    .mc-cert-header{background:linear-gradient(135deg,#080e1a 0%,#0e1b30 50%,#080e1a 100%);padding:22px 36px 18px;border-bottom:1px solid rgba(240,200,67,0.30);display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
    .mc-cert-wordmark{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.28em;text-transform:uppercase;color:${_MC.gold};opacity:0.9;}
    .mc-cert-logo-text{font-family:'Cormorant Garamond',Georgia,serif;font-size:0.85rem;font-weight:300;color:rgba(240,200,67,0.55);letter-spacing:0.06em;}
    .mc-cert-body{padding:32px 44px 28px;position:relative;z-index:1;}
    .mc-cert-seal-row{display:flex;align-items:center;gap:18px;margin-bottom:22px;}
    .mc-cert-seal{width:56px;height:56px;border-radius:50%;border:2px solid rgba(240,200,67,0.50);display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:rgba(240,200,67,0.06);flex-shrink:0;}
    .mc-cert-type{font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.24em;text-transform:uppercase;color:rgba(240,200,67,0.65);margin-bottom:4px;}
    .mc-cert-type-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.55rem;font-weight:600;color:${_MC.gold};line-height:1.15;}
    .mc-cert-certifies{font-size:0.83rem;color:rgba(232,240,248,0.60);margin-bottom:8px;font-style:italic;margin-top:18px;}
    .mc-cert-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:2.10rem;font-weight:700;color:${_MC.bright};line-height:1.1;margin-bottom:10px;letter-spacing:0.01em;}
    .mc-cert-role-line{font-size:0.80rem;color:${_MC.muted};margin-bottom:4px;}
    .mc-cert-role-line strong{color:rgba(232,240,248,0.75);}
    .mc-cert-body-text{font-size:0.82rem;color:rgba(232,240,248,0.65);line-height:1.7;margin:20px 0 22px;max-width:600px;}
    .mc-cert-meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:18px 0 24px;}
    .mc-cert-meta-box{background:rgba(240,200,67,0.04);border:1px solid rgba(240,200,67,0.18);border-radius:5px;padding:10px 14px;}
    .mc-cert-meta-label{font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(240,200,67,0.50);margin-bottom:4px;}
    .mc-cert-meta-val{font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_MC.gold};}
    .mc-cert-footer{border-top:1px solid rgba(240,200,67,0.22);padding:18px 44px 22px;display:flex;align-items:flex-end;justify-content:space-between;position:relative;z-index:1;}
    .mc-cert-sig-line{border-top:1px solid rgba(240,200,67,0.35);padding-top:7px;margin-top:24px;font-family:'IBM Plex Mono',monospace;font-size:0.64rem;color:rgba(240,200,67,0.55);letter-spacing:0.06em;}
    .mc-cert-sig-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:0.95rem;font-weight:600;color:rgba(240,200,67,0.80);margin-bottom:3px;}
    .mc-cert-number{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;color:rgba(240,200,67,0.65);letter-spacing:0.05em;}
    .mc-cert-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}
    .mc-cert-number-display{font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:${_MC.gold};letter-spacing:0.08em;background:rgba(240,200,67,0.06);border:1px solid rgba(240,200,67,0.28);border-radius:5px;padding:8px 14px;display:inline-block;margin-top:6px;}
    .mc-cert-verify-note{font-size:0.72rem;color:${_MC.muted};margin-top:8px;}

    /* ── Directory ── */
    .mc-dir-header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;}
    .mc-dir-stat-pill{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:20px;border:1px solid;white-space:nowrap;}
    .mc-search-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
    .mc-search-input{flex:1;min-width:200px;background:${_MC.card};border:1px solid ${_MC.border};border-radius:6px;padding:8px 12px;font-family:'IBM Plex Sans',sans-serif;font-size:0.82rem;color:${_MC.bright};outline:none;}
    .mc-search-input::placeholder{color:${_MC.muted};}
    .mc-search-input:focus{border-color:rgba(78,156,245,0.40);}
    .mc-select{background:${_MC.card};border:1px solid ${_MC.border};border-radius:6px;padding:7px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:${_MC.muted};cursor:pointer;outline:none;}
    .mc-select:focus{border-color:rgba(78,156,245,0.40);}
    .mc-dir-country-section{margin-bottom:20px;}
    .mc-dir-country-label{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_MC.muted};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${_MC.border};}
    .mc-dir-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
    .mc-dir-card{background:${_MC.card};border:1px solid ${_MC.border};border-radius:8px;padding:14px 16px;transition:border-color 0.15s;}
    .mc-dir-card:hover{border-color:rgba(255,255,255,0.16);}
    .mc-dir-card-name{font-size:0.88rem;font-weight:600;color:${_MC.bright};margin-bottom:3px;}
    .mc-dir-card-meta{font-size:0.75rem;color:${_MC.muted};margin-bottom:6px;line-height:1.5;}
    .mc-level-badge{font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1px solid;display:inline-block;margin-right:6px;}
    .mc-level-badge.foundation{color:${_MC.amber};border-color:${_MC.amberBdr};background:${_MC.amberDim};}
    .mc-level-badge.advanced{color:${_MC.cyan};border-color:${_MC.cyanBdr};background:${_MC.cyanDim};}
    .mc-level-badge.trainer{color:${_MC.gold};border-color:${_MC.goldBdr};background:${_MC.goldDim};}
    .mc-dir-card-number{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:${_MC.muted};margin-top:8px;}
    .mc-dir-card-expiry{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${_MC.muted};margin-top:3px;}
    .mc-verify-link{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;color:${_MC.base};text-decoration:none;margin-top:6px;display:inline-block;}
    .mc-verify-link:hover{text-decoration:underline;}

    /* ── My certs dashboard ── */
    .mc-my-cert-card{background:${_MC.card};border:1px solid ${_MC.border};border-radius:10px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.15s;}
    .mc-my-cert-card:hover{border-color:rgba(255,255,255,0.15);}
    .mc-my-cert-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;}
    .mc-my-cert-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.10rem;font-weight:600;color:${_MC.bright};}
    .mc-my-cert-number{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:${_MC.muted};margin-top:2px;}
    .mc-expiry-countdown{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;padding:4px 10px;border-radius:4px;border:1px solid;white-space:nowrap;}
    .mc-expiry-countdown.ok{color:${_MC.green};border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.08);}
    .mc-expiry-countdown.warn{color:${_MC.amber};border-color:${_MC.amberBdr};background:${_MC.amberDim};}
    .mc-expiry-countdown.urgent{color:${_MC.red};border-color:rgba(239,68,68,0.40);background:rgba(239,68,68,0.08);}
    .mc-progress-section{margin-bottom:14px;}
    .mc-progress-label{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:${_MC.muted};margin-bottom:8px;}
    .mc-progress-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
    .mc-progress-mod-name{font-size:0.78rem;color:${_MC.text};flex:1;}
    .mc-progress-bar-wrap{width:100px;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;}
    .mc-progress-bar-fill{height:100%;border-radius:3px;background:${_MC.pe};transition:width 0.4s;}
    .mc-progress-pct{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${_MC.muted};width:30px;text-align:right;}
    .mc-empty-state{text-align:center;padding:36px 20px;color:${_MC.muted};font-size:0.83rem;}
    .mc-empty-icon{font-size:2rem;margin-bottom:10px;}
    .mc-loading{text-align:center;padding:28px;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:${_MC.muted};}
    .mc-error{padding:12px 16px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:6px;font-size:0.80rem;color:${_MC.red};margin:12px 0;}
    .mc-success{padding:12px 16px;background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.28);border-radius:6px;font-size:0.80rem;color:${_MC.green};margin:12px 0;}

    /* ── Print styles ── */
    @media print {
      body > *:not(.mc-cert-wrap){ display:none !important; }
      .mc-cert-actions{ display:none !important; }
      .mc-cert-card{ box-shadow:none !important; border:2px solid #f0c843 !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── Utility helpers ────────────────────────────────────────────────────────────
function _mcEl(tag, attrs, inner) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(function([k, v]) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  });
  if (inner !== undefined) el.innerHTML = inner;
  return el;
}

function _mcEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _mcFmtDate(ts) {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function _mcDaysRemaining(expiresAt) {
  return Math.ceil((expiresAt - Date.now()) / 86400000);
}

function _mcFirebase() {
  return window.firebase && window.firebase.database ? window.firebase.database()
    : (typeof database !== 'undefined' ? database : null);
}

function _mcFirebaseUid() {
  return window.firebase && window.firebase.auth && window.firebase.auth().currentUser
    ? window.firebase.auth().currentUser.uid : null;
}

function _mcApiBase() {
  return (window.ATLAS_API_BASE || '') + '/api/v1';
}

async function _mcAuthHeader() {
  try {
    if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
      const token = await window.firebase.auth().currentUser.getIdToken();
      return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
    }
  } catch(e) { /* fall through */ }
  return { 'Content-Type': 'application/json' };
}

function _mcRoleFmt(role) {
  const map = { pharmacist:'Pharmacist', physician:'Physician', nurse:'Nurse',
                researcher:'Researcher', chw:'Community Health Worker', other:'Other' };
  return map[role] || (role || '');
}

function _mcLevelFmt(level) {
  const map = { foundation:'Foundation', advanced:'Advanced', trainer:'Trainer' };
  return map[level] || (level || 'Foundation');
}

function _mcCountryFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(iso2.toUpperCase().charCodeAt(0) + offset)
       + String.fromCodePoint(iso2.toUpperCase().charCodeAt(1) + offset);
}

// ── Firebase progress helpers ─────────────────────────────────────────────────
function _mcLoadProgress(userId, cb) {
  const db = _mcFirebase();
  if (!db || !userId) { cb({}); return; }
  db.ref('map_cert_progress/' + userId).once('value')
    .then(function(snap) { cb(snap.val() || {}); })
    .catch(function() { cb({}); });
}

function _mcSaveProgress(userId, key, value) {
  const db = _mcFirebase();
  if (!db || !userId) return;
  db.ref('map_cert_progress/' + userId + '/' + key).set(value)
    .catch(function(e) { console.warn('mc progress save failed:', e); });
}

// ── Module definitions ─────────────────────────────────────────────────────────
const _MC_MODULES = [
  {
    id:    'mod1',
    num:   'Module 1',
    title: 'Foundations of MAP',
    color: _MC.amber,
    slides: [
      {
        eyebrow: 'What is MAP',
        heading: 'Triadic vs Binary Adherence Measurement',
        body: function() {
          return `<p>The Multidimensional Adherence Parameters (MAP) instrument is an 8-item psychometric tool developed by Philip Morisky to measure medication adherence across three independent behavioral domains. Unlike binary adherence (adherent / non-adherent), MAP produces a triadic output: three domain scores and a composite Predictive Emergence (PE) geometric mean.</p>
          <p>Binary scales ask only "did the patient take their medication?" MAP asks: <em>Why did they miss it, and from which part of their behavioral system did the failure originate?</em> This distinction determines whether an intervention will succeed or fail.</p>`;
        }
      },
      {
        eyebrow: 'Three Domains',
        heading: 'Architecture, Execution, and Context-Guard',
        body: function() {
          return `<p>MAP scores are computed from three non-compensatory behavioral domains. A failure in any one domain requires domain-specific intervention. Strength in one domain cannot offset weakness in another.</p>
          <div class="mc-domain-cards">
            <div class="mc-domain-card" style="background:rgba(212,168,67,0.07);border-color:rgba(212,168,67,0.30);">
              <div class="mc-domain-label" style="color:${_MC.amber};">Architecture</div>
              <div class="mc-domain-items" style="color:${_MC.amber};">Items Q2, Q3, Q6</div>
              <div class="mc-domain-desc" style="color:${_MC.muted};">Intentional planning, regimen beliefs, and structural decisions around adherence. Failure here = the patient has <em>decided</em>, consciously or not, not to adhere.</div>
            </div>
            <div class="mc-domain-card" style="background:rgba(56,189,248,0.07);border-color:rgba(56,189,248,0.30);">
              <div class="mc-domain-label" style="color:${_MC.cyan};">Execution</div>
              <div class="mc-domain-items" style="color:${_MC.cyan};">Items Q1, Q5, Q8</div>
              <div class="mc-domain-desc" style="color:${_MC.muted};">Day-to-day behavioral compliance, forgetfulness, and dose-taking habits. Failure here = the patient intends to adhere but lacks reliable habit structure.</div>
            </div>
            <div class="mc-domain-card" style="background:rgba(139,111,245,0.07);border-color:rgba(139,111,245,0.30);">
              <div class="mc-domain-label" style="color:${_MC.purple};">Context-Guard</div>
              <div class="mc-domain-items" style="color:${_MC.purple};">Items Q4, Q7 (floored at 0.5)</div>
              <div class="mc-domain-desc" style="color:${_MC.muted};">Environmental, social, and situational pressures on adherence. The 0.5 floor reflects that context can support but never fully dictate behavior.</div>
            </div>
          </div>`;
        }
      },
      {
        eyebrow: 'The PE Formula',
        heading: 'Predictive Emergence: PE = (A \u00d7 E \u00d7 Cg)^(1/3)',
        body: function() {
          return `<p>The PE score is a geometric mean across the three domains. It is non-compensatory: a near-zero score in any single domain drives PE toward zero regardless of strength elsewhere. This models the real-world truth that one broken link breaks the entire adherence chain.</p>
          <div class="mc-pe-formula">
            <div class="mc-pe-label">Formula</div>
            PE = (Architecture &times; Execution &times; Context-Guard) ^ (1/3)
            <div class="mc-pe-worked">
              <strong>Worked example:</strong> Q2=0, Q3=0, Q6=1 &rarr; A = 0.333<br>
              Q1=1, Q5=1, Q8=0.75 &rarr; E = 0.917<br>
              Q4=1, Q7=1 &rarr; Cg = max(0.5, 0.5 + 0.5 &times; 1.0) = 1.000<br>
              PE = (0.333 &times; 0.917 &times; 1.000)^(1/3) = <strong style="color:${_MC.amber};">0.674</strong><br>
              Additive score = 5.75 &rarr; low_adherence = false<br>
              <em>Architecture is the target domain for intervention, not execution reminders.</em>
            </div>
          </div>
          <p>When Architecture is the dominant failure, sending reminder apps is ineffective. The patient is not forgetting; they have a structural belief or planning problem that reminders cannot solve.</p>`;
        }
      },
      {
        eyebrow: 'Clinical Implication',
        heading: 'Wrong Domain = Wrong Intervention',
        body: function() {
          return `<p>The most common clinical error in adherence support is mismatching the intervention to the failure domain. MAP prevents this by making the dominant failure explicit.</p>
          <p><strong style="color:${_MC.amber};">Intentional Resistor</strong> (Architecture failure): Belief restructuring, motivational interviewing, shared decision-making. Reminder apps will be ignored or resented.</p>
          <p><strong style="color:${_MC.cyan};">Routine Forgetter</strong> (Execution failure): Pill organizers, alarm reminders, pharmacist synchronization. Counseling on beliefs is irrelevant to this patient.</p>
          <p><strong style="color:${_MC.purple};">Situational Skipper</strong> (Context-Guard failure): Access support, cost navigation, social or environmental barrier removal. Neither reminders nor belief counseling address the root cause.</p>
          <p>Sending the wrong intervention wastes clinical resources, frustrates the patient, and produces no improvement in PE score at follow-up.</p>`;
        }
      },
      {
        eyebrow: 'MMAS Foundation',
        heading: 'MAP Additive Score and Legacy Benchmarking',
        body: function() {
          return `<p>MAP is the second-generation successor to the MMAS-8, developed by the same research lineage (Philip Morisky, Adherence Cartography). The MAP additive score (0-8) is computed identically to MMAS-8, enabling backward compatibility with legacy literature.</p>
          <p>Additive score = Q1 + Q2 + Q3 + Q4 + Q5 + Q6 + Q7 + Q8 (all items normalized to 0-1, where 1 = adherent). A score of 8 = perfect adherence; below 6 = low adherence (equivalent to MMAS-8 high-risk band).</p>
          <p>For all new studies, use MAP with PE scoring. Report both the PE triadic output and the additive score to maintain continuity with the existing MMAS-8 normative database.</p>`;
        }
      }
    ],
    quiz: _mcBuildMod1Quiz()
  },
  {
    id:    'mod2',
    num:   'Module 2',
    title: 'Administering MAP',
    color: _MC.cyan,
    slides: [
      {
        eyebrow: 'Patient Preparation',
        heading: 'Setting Up the Assessment Session',
        body: function() {
          return `<p>Before administering MAP, confirm the patient has a current medication regimen (at least one chronic medication, minimum 4 weeks active). Explain that this is not a test of their intelligence or willpower, and that there are no right or wrong answers.</p>
          <p>Recommended script: <em>"I would like to ask you some questions about how you take your medication. There are no right or wrong answers. Your honest responses help us provide better support for you."</em></p>
          <p>Ensure privacy. MAP items on forgetfulness, side effects, and medication cessation are sensitive. A shared waiting room is not appropriate for MAP administration.</p>`;
        }
      },
      {
        eyebrow: 'Item Coding',
        heading: 'Q1-Q7 Binary, Q8 Ordinal',
        body: function() {
          return `<p>All 8 MAP items are scored on a 0-1 scale where <strong>1 = adherent</strong> (favorable) and <strong>0 = non-adherent</strong> (unfavorable). This is the reverse of MMAS-8 convention.</p>
          <p><strong>Q1-Q7 (binary):</strong> Response is 0 or 1. Yes to an adherence-favorable behavior = 1; yes to a barrier or missed dose = 0.</p>
          <p><strong>Q8 (ordinal):</strong> "How often do you have difficulty remembering?" Scored as:</p>
          <ul style="font-size:0.80rem;line-height:2;color:${_MC.text};padding-left:18px;">
            <li>Never = 1.00</li>
            <li>Rarely = 0.75</li>
            <li>Sometimes = 0.50</li>
            <li>Often = 0.25</li>
            <li>All the time = 0.00</li>
          </ul>
          <p>Never enter raw 0-4 Likert codes. Always convert to the 0-1 scale before entering into ATLAS.</p>`;
        }
      },
      {
        eyebrow: 'Domain Item Assignment',
        heading: 'Which Items Feed Which Domains',
        body: function() {
          return `<p>Domain assignment is fixed and must not be modified:</p>
          <div class="mc-domain-cards">
            <div class="mc-domain-card" style="background:rgba(212,168,67,0.07);border-color:rgba(212,168,67,0.30);">
              <div class="mc-domain-label" style="color:${_MC.amber};">Architecture (A)</div>
              <div class="mc-domain-desc" style="color:${_MC.text};">A = mean(Q2, Q3, Q6)</div>
            </div>
            <div class="mc-domain-card" style="background:rgba(56,189,248,0.07);border-color:rgba(56,189,248,0.30);">
              <div class="mc-domain-label" style="color:${_MC.cyan};">Execution (E)</div>
              <div class="mc-domain-desc" style="color:${_MC.text};">E = mean(Q1, Q5, Q8)</div>
            </div>
            <div class="mc-domain-card" style="background:rgba(139,111,245,0.07);border-color:rgba(139,111,245,0.30);">
              <div class="mc-domain-label" style="color:${_MC.purple};">Context-Guard (Cg)</div>
              <div class="mc-domain-desc" style="color:${_MC.text};">Cg = max(0.5, 0.5 + 0.5 &times; mean(Q4, Q7))</div>
            </div>
          </div>
          <p>Q4 and Q7 contribute to Context-Guard only. The Cg floor of 0.5 ensures that even when context is maximally unfavorable, the PE score reflects the other domain contributions.</p>`;
        }
      },
      {
        eyebrow: 'Session Protocol',
        heading: 'Field Administration Best Practices',
        body: function() {
          return `<p>For clinic deployments, use the ATLAS assessment URL on a dedicated device. After each patient, refresh the page to clear the session. Do not allow browser autofill on shared devices.</p>
          <p>For high-volume screening, generate per-session QR codes (Records tab) so patients scan and self-administer on their own device. For low-bandwidth environments, ATLAS Data-Lite mode activates automatically and queues submissions locally.</p>
          <p>After submission, confirm the green "Submitted" indicator in the ATLAS header. Navigate to Records to verify the assessment appears with all domain scores. If PE score is missing, the submission may still be processing; refresh after 10 seconds.</p>`;
        }
      }
    ],
    quiz: _mcBuildMod2Quiz()
  },
  {
    id:    'mod3',
    num:   'Module 3',
    title: 'Interpreting Results and PEACS Phenotypes',
    color: _MC.purple,
    slides: [
      {
        eyebrow: 'Reading the Output',
        heading: 'Triadic Domain Profile and PE Score Bands',
        body: function() {
          return `<p>After MAP administration, ATLAS displays a triadic domain profile (Architecture, Execution, Context-Guard) and the PE geometric mean. Read domain scores first; then use PE as the composite adherence stability indicator.</p>
          <p><strong>PE score bands:</strong></p>
          <ul style="font-size:0.80rem;line-height:2;color:${_MC.text};padding-left:18px;">
            <li>PE &ge; 0.85: Optimal stability</li>
            <li>PE 0.70-0.84: Good stability, minor barriers present</li>
            <li>PE 0.55-0.69: Moderate concern, targeted intervention warranted</li>
            <li>PE 0.40-0.54: Poor stability, structured intervention recommended</li>
            <li>PE &lt; 0.40: Critical instability, immediate barrier assessment required</li>
          </ul>`;
        }
      },
      {
        eyebrow: 'PEACS Phenotypes',
        heading: 'Five Adherence Behavioral Phenotypes',
        body: function() {
          return `<p>PEACS phenotype classification is based on the pattern of domain scores, not PE alone:</p>
          <p><strong style="color:${_MC.amber};">Intentional Resistor:</strong> Architecture is the dominant failure domain. The patient has a belief, value, or intentional decision driving non-adherence. Architecture score is substantially below Execution and Context-Guard. Intervention: belief restructuring, motivational interviewing.</p>
          <p><strong style="color:${_MC.cyan};">Routine Forgetter:</strong> Execution is the dominant failure. Architecture and Context-Guard are relatively intact. Intervention: habit tools, reminders, pharmacist synchronization.</p>
          <p><strong style="color:${_MC.purple};">Situational Skipper:</strong> Context-Guard is the dominant failure. Environmental or social barriers are the primary driver. Intervention: access support, cost navigation, caregiver support.</p>
          <p><strong style="color:${_MC.base};">Side-Effect Avoider:</strong> Mixed domain failure with Q3 (side effects) as the primary driver. Often misclassified as Architecture. Intervention: medication review, side effect management.</p>
          <p><strong style="color:${_MC.green};">Optimistic Stopper:</strong> Architecture score below 0.5 but additive score was historically high. The patient stopped a medication they believed they no longer needed. Intervention: education on chronic disease and medication duration.</p>`;
        }
      },
      {
        eyebrow: 'Prescriber Communication',
        heading: 'Translating MAP Results to Clinical Action',
        body: function() {
          return `<p>When communicating MAP results to prescribers, lead with the dominant failure domain and recommended intervention class, not the raw PE number. Most prescribers do not have the training to interpret PE values independently.</p>
          <p>Recommended format: <em>"MAP assessment of [Patient] reveals Architecture as the dominant failure domain (score 0.28). This is consistent with an Intentional Resistor phenotype. Recommended intervention: structured motivational interviewing focused on medication beliefs. Reminder-based interventions are unlikely to be effective for this phenotype."</em></p>
          <p>For longitudinal follow-up, reassess at 30 days for Execution-dominant patients and 90 days for Architecture-dominant patients. Context-Guard failures may resolve faster if the environmental barrier (cost, access) is addressed directly.</p>`;
        }
      },
      {
        eyebrow: 'Longitudinal Follow-Up',
        heading: 'Using PEACS for Trajectory Monitoring',
        body: function() {
          return `<p>A single MAP assessment is a photograph. PEACS converts it into a film by measuring the same AEC domains at defined intervals: BASE (monthly, Architecture), MVMT (weekly, Execution), STRATA (quarterly, Context-Guard).</p>
          <p>After baseline MAP, enable PEACS for the patient in ATLAS. The platform schedules and sends reminders for each scale at the correct interval. Once three full administrations are complete, ATLAS generates a phenotype trajectory: Stable Optimal, Architecturally Fragile, Contextually Pressured, or Unstable.</p>
          <p>Use trajectory phenotypes to decide when to escalate intervention. An Architecturally Fragile trajectory (declining Architecture over three months) warrants referral to a structured adherence counseling program regardless of current PE score.</p>`;
        }
      }
    ],
    quiz: _mcBuildMod3Quiz()
  }
];

// ── Quiz builders ──────────────────────────────────────────────────────────────
function _mcBuildMod1Quiz() {
  return [
    {
      text: 'Which MAP items are assigned to the Architecture domain?',
      choices: ['Q1, Q5, Q8','Q2, Q3, Q6','Q4, Q7','Q1, Q2, Q3, Q4'],
      correct: 1
    },
    {
      text: 'What is the PE score formula?',
      choices: [
        'PE = (A + E + Cg) / 3',
        'PE = A \u00d7 E \u00d7 Cg',
        'PE = (A \u00d7 E \u00d7 Cg)^(1/3)',
        'PE = min(A, E, Cg)'
      ],
      correct: 2
    },
    {
      text: 'Why does Context-Guard have a floor of 0.5?',
      choices: [
        'To prevent division by zero in the PE formula',
        'Because context can support adherence but can never fully determine it independently',
        'Because Q4 and Q7 are ordinal items',
        'To match the MMAS-8 scoring convention'
      ],
      correct: 1
    },
    {
      text: 'A patient has Architecture=0.28, Execution=0.92, Cg=0.95. What is the dominant failure?',
      choices: ['Execution','Context-Guard','Architecture','Balanced failure'],
      correct: 2
    },
    {
      text: 'Given A=0.5, E=0.5, Cg=1.0, what is the PE score?',
      choices: ['0.667','0.5','0.794','0.630'],
      correct: 3
    }
  ];
}

function _mcBuildMod2Quiz() {
  return [
    {
      text: 'In MAP scoring, what does a value of 1 always indicate?',
      choices: ['Non-adherence','Adherence','Missing data','Maximum difficulty'],
      correct: 1
    },
    {
      text: 'A patient answers "Sometimes" to Q8. What numeric value is entered into ATLAS?',
      choices: ['2','0.50','0.25','0.75'],
      correct: 1
    },
    {
      text: 'Which items contribute to the Execution domain?',
      choices: ['Q2, Q3, Q6','Q4, Q7','Q1, Q5, Q8','Q1, Q2, Q3'],
      correct: 2
    },
    {
      text: 'Context-Guard is calculated as:',
      choices: [
        'mean(Q4, Q7)',
        'max(0.5, 0.5 + 0.5 \u00d7 mean(Q4, Q7))',
        '0.5 \u00d7 mean(Q4, Q7)',
        'min(1.0, mean(Q4, Q7))'
      ],
      correct: 1
    },
    {
      text: 'Before administering MAP, you should:',
      choices: [
        'Inform the patient there are right and wrong answers to motivate honesty',
        'Administer in a group setting to save time',
        'Explain that responses help provide better support, with no right or wrong answers',
        'Convert Q1-Q7 from binary to Likert scale first'
      ],
      correct: 2
    }
  ];
}

function _mcBuildMod3Quiz() {
  return [
    {
      text: 'A patient has PE = 0.62. Which band does this fall into?',
      choices: ['Optimal stability','Good stability','Moderate concern','Critical instability'],
      correct: 2
    },
    {
      text: 'An Intentional Resistor phenotype is best addressed by:',
      choices: [
        'Medication reminder app',
        'Pill organizer and pharmacist synchronization',
        'Motivational interviewing and belief restructuring',
        'Cost navigation and access support'
      ],
      correct: 2
    },
    {
      text: 'Which phenotype is characterized by Architecture as the dominant failure domain?',
      choices: ['Routine Forgetter','Situational Skipper','Optimistic Stopper','Intentional Resistor'],
      correct: 3
    },
    {
      text: 'For a patient with an Architecture-dominant failure, when should you schedule the first reassessment?',
      choices: ['1 week','30 days','90 days','6 months'],
      correct: 2
    },
    {
      text: 'PEACS BASE scale measures which domain on which interval?',
      choices: [
        'Execution, weekly',
        'Context-Guard, quarterly',
        'Architecture, monthly',
        'All domains, daily'
      ],
      correct: 2
    }
  ];
}

// ── Competency assessment (15 questions) ──────────────────────────────────────
function _mcBuildCompetencyQuiz() {
  return [
    // PE calculation
    {
      category: 'PE Calculation',
      text: 'Calculate PE: Q1=1, Q2=0, Q3=0, Q4=1, Q5=1, Q6=1, Q7=1, Q8=1.00. A=mean(Q2,Q3,Q6), E=mean(Q1,Q5,Q8), Cg=max(0.5,0.5+0.5\u00d7mean(Q4,Q7)).',
      choices: ['PE = 0.550','PE = 0.693','PE = 0.794','PE = 0.667'],
      correct: 1 // A=0.333, E=1.0, Cg=1.0, PE=(0.333)^(1/3)=0.693
    },
    {
      category: 'PE Calculation',
      text: 'If A=1.0, E=1.0, Cg=0.5, what is PE?',
      choices: ['1.000','0.794','0.500','0.693'],
      correct: 1 // (1.0*1.0*0.5)^(1/3) = 0.5^(1/3) = 0.794
    },
    {
      category: 'Domain Identification',
      text: 'A patient scores: Architecture=0.22, Execution=0.88, Context-Guard=0.90. Which domain is the dominant failure?',
      choices: ['Execution','Context-Guard','Architecture','None, PE is adequate'],
      correct: 2
    },
    {
      category: 'Domain Identification',
      text: 'Q1=1, Q2=1, Q3=1, Q4=0, Q5=1, Q6=1, Q7=0, Q8=1. Which domain has the lowest score?',
      choices: ['Architecture','Execution','Context-Guard','All domains equal'],
      correct: 2 // A=1, E=1, Cg=max(0.5,0.5+0.5*0)=0.5
    },
    {
      category: 'Item Coding',
      text: 'Q8 response "Rarely" is coded as:',
      choices: ['0.25','0.50','0.75','1.00'],
      correct: 2
    },
    {
      category: 'Item Coding',
      text: 'In MAP, a response of Q2=1 indicates:',
      choices: ['The patient missed a dose','The patient adhered for this item','A data entry error','A side effect response'],
      correct: 1
    },
    {
      category: 'Phenotype Classification',
      text: 'A patient has Architecture=0.15, Execution=0.90, Context-Guard=0.85. Which PEACS phenotype applies?',
      choices: ['Routine Forgetter','Situational Skipper','Intentional Resistor','Optimistic Stopper'],
      correct: 2
    },
    {
      category: 'Phenotype Classification',
      text: 'Architecture=0.82, Execution=0.21, Context-Guard=0.88. Which phenotype?',
      choices: ['Intentional Resistor','Routine Forgetter','Situational Skipper','Side-Effect Avoider'],
      correct: 1
    },
    {
      category: 'Phenotype Classification',
      text: 'A patient stopped a medication because they believed they were cured, despite a chronic diagnosis. Architecture is below 0.5 but historical additive scores were high. This is:',
      choices: ['Intentional Resistor','Routine Forgetter','Optimistic Stopper','Situational Skipper'],
      correct: 2
    },
    {
      category: 'Intervention Matching',
      text: 'Correct intervention for a Routine Forgetter:',
      choices: [
        'Motivational interviewing focused on medication beliefs',
        'Pill organizer, alarm reminders, pharmacist synchronization',
        'Cost navigation and access support programs',
        'Medication review for side effect burden'
      ],
      correct: 1
    },
    {
      category: 'Intervention Matching',
      text: 'Sending a reminder app to an Intentional Resistor is ineffective because:',
      choices: [
        'The patient does not have a smartphone',
        'The patient is forgetting, not resisting',
        'The failure is in beliefs and intentional decisions, not habit structure',
        'Reminders increase side effect awareness'
      ],
      correct: 2
    },
    {
      category: 'Administration Protocol',
      text: 'Context-Guard is floored at 0.5. This means:',
      choices: [
        'Context can never score above 0.5',
        'Even maximally unfavorable context cannot reduce Cg below 0.5',
        'Q4 and Q7 are not used in the PE formula',
        'Context-Guard is the most important domain'
      ],
      correct: 1
    },
    {
      category: 'Administration Protocol',
      text: 'MAP items Q4 and Q7 contribute exclusively to which domain?',
      choices: ['Architecture','Execution','Context-Guard','Both Architecture and Execution'],
      correct: 2
    },
    {
      category: 'PE Calculation',
      text: 'If any single MAP domain score is 0, the PE score is:',
      choices: ['Equal to the average of the other two domains','0.5','0','Undefined'],
      correct: 2
    },
    {
      category: 'Administration Protocol',
      text: 'The MAP additive score is comparable to which legacy instrument for benchmarking?',
      choices: ['PHQ-9','MMAS-8','SF-36','Morisky-4'],
      correct: 1
    }
  ];
}

// ── renderCertificationHub ─────────────────────────────────────────────────────
function renderCertificationHub(containerId, userId, workspaceKey) {
  _mcInjectStyles();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.className = 'mc-wrap';

  // Header
  const hdr = _mcEl('div', { class: 'mc-header' });
  hdr.innerHTML = `
    <div class="mc-eyebrow">TESSERA GRC &middot; Scala Carta Foundation</div>
    <div class="mc-title">MAP Certification Program</div>
    <div class="mc-sub">Structured competency certification for clinicians, pharmacists, and researchers administering the MAP instrument. Issued by the Scala Carta Foundation; recognized by TESSERA GRC partner institutions globally.</div>`;
  container.appendChild(hdr);

  // Check existing foundation cert from Firebase
  _mcLoadProgress(userId, function(progress) {
    const foundationPassed = progress && progress.competency_passed;

    const grid = _mcEl('div', { class: 'mc-hub-grid' });

    // Foundation track
    const foundation = _mcEl('div', { class: 'mc-track', style: 'border-left: 3px solid ' + _MC.amber + ';' });
    foundation.innerHTML = `
      <span class="mc-track-badge" style="color:${_MC.amber};border-color:${_MC.amberBdr};background:${_MC.amberDim};">Foundation</span>
      <div class="mc-track-title" style="color:${_MC.amber};">MAP Foundation Certification</div>
      <div class="mc-track-audience">Pharmacists &middot; Nurses &middot; Community Health Workers</div>
      <hr class="mc-track-divider">
      <div class="mc-track-meta">Modules: <strong>3 core modules</strong></div>
      <div class="mc-track-meta">Assessment: <strong>15-question competency exam</strong></div>
      <div class="mc-track-meta">Pass threshold: <strong>75% (11/15)</strong></div>
      <div class="mc-track-meta">Validity: <strong>2 years</strong></div>
      <div class="mc-track-meta">Cert number: <strong>MAP-CERT-XX-YYYY-NNNNNN</strong></div>
      <hr class="mc-track-divider">
      <button class="mc-btn mc-btn-amber" id="mc-hub-start-btn">${foundationPassed ? 'View Certificate' : 'Start Training'}</button>`;
    foundation.querySelector('#mc-hub-start-btn').addEventListener('click', function() {
      renderFoundationTraining(containerId, userId, workspaceKey);
    });
    grid.appendChild(foundation);

    // Advanced track
    const advanced = _mcEl('div', { class: 'mc-track', style: 'border-left: 3px solid ' + _MC.cyan + ';' });
    advanced.innerHTML = `
      <span class="mc-track-badge" style="color:${_MC.cyan};border-color:${_MC.cyanBdr};background:${_MC.cyanDim};">Advanced</span>
      <div class="mc-track-title" style="color:${_MC.cyan};">MAP Advanced Certification</div>
      <div class="mc-track-audience">Physicians &middot; Researchers &middot; Clinical Scientists</div>
      <hr class="mc-track-divider">
      <div class="mc-track-meta">Prerequisite: <strong>Foundation Certification</strong></div>
      <div class="mc-track-meta">Modules: <strong>4 advanced modules</strong></div>
      <div class="mc-track-meta">Assessment: <strong>20-question advanced exam</strong></div>
      <div class="mc-track-meta">Pass threshold: <strong>80%</strong></div>
      <div class="mc-track-meta">Covers: <strong>PEACS design, study methods, psychometrics</strong></div>
      <hr class="mc-track-divider">
      ${foundationPassed
        ? '<button class="mc-btn mc-btn-cyan">Begin Advanced Track</button>'
        : '<div class="mc-req-note">Requires Foundation Certification. Complete the Foundation track first.</div>'}`;
    if (foundationPassed) {
      advanced.querySelector('button').addEventListener('click', function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Advanced Track — Opening Q4 2026';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'default';
        showToast('Advanced certification opens Q4 2026. Your Foundation status is confirmed and saved — you will qualify automatically.', 5000);
      });
    }
    grid.appendChild(advanced);

    // Trainer track
    const trainer = _mcEl('div', { class: 'mc-track', style: 'border-left: 3px solid ' + _MC.gold + ';' });
    trainer.innerHTML = `
      <span class="mc-track-badge" style="color:${_MC.gold};border-color:${_MC.goldBdr};background:${_MC.goldDim};">Trainer</span>
      <div class="mc-track-title" style="color:${_MC.gold};">MAP Trainer Certification</div>
      <div class="mc-track-audience">Senior Faculty &middot; Train-the-Trainer Applicants</div>
      <hr class="mc-track-divider">
      <div class="mc-track-meta">Selection: <strong>Application-based</strong></div>
      <div class="mc-track-meta">Review: <strong>TESSERA GRC Faculty Committee</strong></div>
      <div class="mc-track-meta">Eligibility: <strong>Advanced Certification + clinical publications</strong></div>
      <div class="mc-track-meta">Scope: <strong>Authorized to train and assess others</strong></div>
      <hr class="mc-track-divider">
      <a class="mc-btn mc-btn-gold" href="mailto:research@scalacartafoundation.org?subject=MAP%20Trainer%20Certification%20Application&body=Please%20include%3A%20Name%2C%20institution%2C%20current%20MAP%20certification%20number%2C%20and%20brief%20statement%20of%20interest.">Apply via Email</a>`;
    grid.appendChild(trainer);

    container.appendChild(grid);

    // Footer note
    container.appendChild(_mcEl('div', {
      style: 'font-size:0.74rem;color:' + _MC.muted + ';text-align:center;margin-top:8px;line-height:1.6;'
    }, 'Certifications are issued by the Scala Carta Foundation, a 501(c)(3) non-profit. Certificate validity is 2 years. Renewal requires re-completion of the competency assessment.'));
  });
}

// ── renderFoundationTraining ───────────────────────────────────────────────────
function renderFoundationTraining(containerId, userId, workspaceKey) {
  _mcInjectStyles();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.className = 'mc-wrap';

  // Header with back button
  const backRow = _mcEl('div', { class: 'mc-training-back' });
  const backBtn = _mcEl('button', { class: 'mc-btn mc-btn-ghost', style: 'margin-bottom:16px;' }, '&larr; Back to Certification Hub');
  backBtn.addEventListener('click', function() { renderCertificationHub(containerId, userId, workspaceKey); });
  backRow.appendChild(backBtn);
  container.appendChild(backRow);

  const hdr = _mcEl('div', { class: 'mc-header' });
  hdr.innerHTML = `
    <div class="mc-eyebrow">Foundation Track &middot; 3 Modules + Competency Assessment</div>
    <div class="mc-title">MAP Foundation Training</div>
    <div class="mc-sub">Complete all three modules and pass the 15-question competency assessment (75% threshold) to receive your MAP Foundation Certificate.</div>`;
  container.appendChild(hdr);

  const moduleList = _mcEl('div', { class: 'mc-modules-list' });
  container.appendChild(moduleList);

  _mcLoadProgress(userId, function(progress) {
    _mcRenderModuleList(moduleList, progress, userId, workspaceKey, containerId);
  });
}

function _mcRenderModuleList(container, progress, userId, workspaceKey, containerId) {
  container.innerHTML = '';

  // Determine unlock state
  const mod1Passed = progress && progress.mod1_quiz_passed;
  const mod2Passed = progress && progress.mod2_quiz_passed;
  const mod3Passed = progress && progress.mod3_quiz_passed;
  const allModsPassed = mod1Passed && mod2Passed && mod3Passed;
  const competencyPassed = progress && progress.competency_passed;
  const competencyLastFail = progress && progress.competency_last_fail;

  _MC_MODULES.forEach(function(mod, idx) {
    const isLocked = idx === 1 && !mod1Passed || idx === 2 && !mod2Passed;
    const quizPassed = progress && progress[mod.id + '_quiz_passed'];
    const statusLabel = quizPassed ? 'Passed' : isLocked ? 'Locked' : 'Available';
    const statusClass = quizPassed ? 'passed' : isLocked ? 'locked' : 'available';

    const row = _mcEl('div', { class: 'mc-module-row' + (isLocked ? ' mc-locked' : '') });
    row.innerHTML = `
      <div class="mc-module-row-header">
        <span class="mc-module-num" style="color:${mod.color};border-color:${mod.color}33;background:${mod.color}12;">${_mcEsc(mod.num)}</span>
        <span class="mc-module-label">${_mcEsc(mod.title)}</span>
        <span class="mc-module-status ${statusClass}">${statusLabel}</span>
      </div>`;

    if (!isLocked) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function() {
        _mcOpenModule(mod, progress, userId, workspaceKey, containerId, container);
      });
    } else {
      row.style.opacity = '0.55';
      row.style.cursor = 'not-allowed';
    }
    container.appendChild(row);
  });

  // Competency assessment row
  const compLocked = !allModsPassed;
  const compStatusLabel = competencyPassed ? 'Certified' : compLocked ? 'Locked' : 'Ready';
  const compStatusClass = competencyPassed ? 'passed' : compLocked ? 'locked' : 'available';
  const compRow = _mcEl('div', { class: 'mc-module-row' });
  compRow.innerHTML = `
    <div class="mc-module-row-header">
      <span class="mc-module-num" style="color:${_MC.gold};border-color:rgba(240,200,67,0.30);background:rgba(240,200,67,0.10);">Assessment</span>
      <span class="mc-module-label">Competency Assessment (15 Questions)</span>
      <span class="mc-module-status ${compStatusClass}">${compStatusLabel}</span>
    </div>
    <div style="font-size:0.75rem;color:${_MC.muted};margin-top:6px;padding-left:2px;">75% pass threshold (11/15). One retry after 24 hours if failed.</div>`;

  if (!compLocked) {
    compRow.style.cursor = 'pointer';
    compRow.addEventListener('click', function() {
      // Check 24-hour retry lock
      if (competencyLastFail && !competencyPassed) {
        const hoursElapsed = (Date.now() - competencyLastFail) / 3600000;
        if (hoursElapsed < 24) {
          const remaining = Math.ceil(24 - hoursElapsed);
          const note = _mcEl('div', { class: 'mc-error', style: 'margin-top:10px;' },
            'Retry available in ' + remaining + ' hour' + (remaining !== 1 ? 's' : '') + '. The assessment may be retaken once every 24 hours.');
          compRow.appendChild(note);
          return;
        }
      }
      _mcOpenCompetency(container, progress, userId, workspaceKey, containerId);
    });
  } else {
    compRow.style.opacity = '0.55';
    compRow.style.cursor = 'not-allowed';
  }
  container.appendChild(compRow);

  // Show certificate if passed
  if (competencyPassed && progress.cert_record) {
    const certWrap = _mcEl('div', { style: 'margin-top:24px;' });
    container.appendChild(certWrap);
    renderDigitalCertificate(certWrap.id || (function(){ const id='mc-cert-inline-'+Date.now(); certWrap.id=id; return id; })(), progress.cert_record);
  }
}

function _mcOpenModule(mod, progress, userId, workspaceKey, containerId, listContainer) {
  // Remove any existing open viewer
  const existing = listContainer.querySelector('.mc-slide-viewer, .mc-quiz');
  if (existing) existing.remove();

  const currentSlide = { idx: 0 };
  const totalSlides = mod.slides.length;

  // Slide viewer
  const viewer = _mcEl('div', { class: 'mc-slide-viewer' });
  listContainer.appendChild(viewer);

  function renderSlide(idx) {
    const slide = mod.slides[idx];
    const dots = mod.slides.map(function(_, i) {
      const cls = i < idx ? 'done' : i === idx ? 'active' : '';
      return '<span class="mc-dot ' + cls + '"></span>';
    }).join('');

    viewer.innerHTML = `
      <div class="mc-slide-nav">
        <span class="mc-slide-counter" style="color:${mod.color};">Slide ${idx + 1} of ${totalSlides}</span>
        <div class="mc-slide-dots">${dots}</div>
      </div>
      <div class="mc-slide-eyebrow" style="color:${mod.color};">${_mcEsc(slide.eyebrow)}</div>
      <div class="mc-slide-heading">${_mcEsc(slide.heading)}</div>
      <div class="mc-slide-body">${slide.body()}</div>
      <div style="display:flex;gap:10px;margin-top:18px;align-items:center;">
        ${idx > 0 ? '<button class="mc-btn mc-btn-ghost" id="mc-slide-prev">Previous</button>' : ''}
        ${idx < totalSlides - 1
          ? '<button class="mc-btn mc-btn-amber" id="mc-slide-next" style="color:' + mod.color + ';border-color:' + mod.color + '55;background:' + mod.color + '18;">Next Slide</button>'
          : '<button class="mc-btn mc-btn-amber" id="mc-slide-quiz" style="color:' + mod.color + ';border-color:' + mod.color + '55;background:' + mod.color + '18;">Take Module Quiz</button>'}
        <button class="mc-btn mc-btn-ghost" id="mc-slide-close" style="margin-left:auto;">Close</button>
      </div>`;

    const prev = viewer.querySelector('#mc-slide-prev');
    const next = viewer.querySelector('#mc-slide-next');
    const quiz = viewer.querySelector('#mc-slide-quiz');
    const close = viewer.querySelector('#mc-slide-close');
    if (prev) prev.addEventListener('click', function() { currentSlide.idx--; renderSlide(currentSlide.idx); });
    if (next) next.addEventListener('click', function() { currentSlide.idx++; renderSlide(currentSlide.idx); });
    if (close) close.addEventListener('click', function() { viewer.remove(); if (quizEl) quizEl.remove(); });
    if (quiz) quiz.addEventListener('click', function() { viewer.style.borderRadius = '0'; showQuiz(); });

    // Save progress
    _mcSaveProgress(userId, mod.id + '_slide_' + idx, Date.now());
  }

  renderSlide(0);

  // Quiz element (hidden until after slides)
  let quizEl = null;

  function showQuiz() {
    if (quizEl) quizEl.remove();
    quizEl = _mcEl('div', { class: 'mc-quiz' });
    listContainer.appendChild(quizEl);
    _mcRenderModuleQuiz(quizEl, mod, userId, function(passed, score) {
      // After quiz: reload module list with fresh progress
      _mcLoadProgress(userId, function(fresh) {
        _mcRenderModuleList(listContainer, fresh, userId, workspaceKey, containerId);
      });
    });
    quizEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  renderSlide(0);
}

function _mcRenderModuleQuiz(container, mod, userId, onComplete) {
  const questions = mod.quiz;
  const answers = new Array(questions.length).fill(-1);
  let submitted = false;

  container.innerHTML = `<div class="mc-quiz-title">${_mcEsc(mod.num)} Quiz &middot; ${questions.length} Questions &middot; 80% to Proceed</div>`;

  questions.forEach(function(q, qi) {
    const qDiv = _mcEl('div', { class: 'mc-q' });
    qDiv.innerHTML = `<div class="mc-q-text"><span class="mc-q-num">${qi + 1}.</span>${_mcEsc(q.text)}</div>`;
    q.choices.forEach(function(choice, ci) {
      const c = _mcEl('div', { class: 'mc-choice', 'data-qi': qi, 'data-ci': ci });
      c.innerHTML = `<span class="mc-choice-bullet"></span><span class="mc-choice-text">${_mcEsc(choice)}</span>`;
      c.addEventListener('click', function() {
        if (submitted) return;
        answers[qi] = ci;
        qDiv.querySelectorAll('.mc-choice').forEach(function(el) { el.classList.remove('selected'); });
        c.classList.add('selected');
      });
      qDiv.appendChild(c);
    });
    container.appendChild(qDiv);
  });

  const actions = _mcEl('div', { class: 'mc-quiz-actions' });
  const submitBtn = _mcEl('button', { class: 'mc-btn mc-btn-base' }, 'Submit Quiz');
  actions.appendChild(submitBtn);
  container.appendChild(actions);

  const feedback = _mcEl('div', { class: 'mc-quiz-feedback', style: 'display:none;' });
  container.appendChild(feedback);

  submitBtn.addEventListener('click', function() {
    if (submitted) return;
    const unanswered = answers.filter(function(a) { return a === -1; }).length;
    if (unanswered > 0) {
      feedback.style.display = '';
      feedback.className = 'mc-quiz-feedback fail';
      feedback.textContent = 'Please answer all ' + unanswered + ' remaining question' + (unanswered > 1 ? 's' : '') + ' before submitting.';
      return;
    }
    submitted = true;
    submitBtn.disabled = true;

    let correct = 0;
    questions.forEach(function(q, qi) {
      const ai = answers[qi];
      container.querySelectorAll('[data-qi="' + qi + '"]').forEach(function(el) {
        const ci = parseInt(el.getAttribute('data-ci'));
        if (ci === q.correct) el.classList.add('correct');
        else if (ci === ai) el.classList.add('wrong');
      });
      if (ai === q.correct) correct++;
    });

    const pct = Math.round(correct / questions.length * 100);
    const passed = pct >= 80;

    feedback.style.display = '';
    feedback.className = 'mc-quiz-feedback ' + (passed ? 'pass' : 'fail');
    feedback.textContent = (passed ? 'Passed: ' : 'Not yet: ') + correct + '/' + questions.length + ' correct (' + pct + '%). ' +
      (passed ? 'You may proceed to the next module.' : 'Review the slides and retake this quiz.');

    if (passed) {
      _mcSaveProgress(userId, mod.id + '_quiz_passed', true);
      _mcSaveProgress(userId, mod.id + '_quiz_score', pct);
    }
    if (onComplete) onComplete(passed, pct);
  });
}

function _mcOpenCompetency(listContainer, progress, userId, workspaceKey, containerId) {
  listContainer.innerHTML = '<div class="mc-loading">Loading Competency Assessment...</div>';
  setTimeout(function() {
    listContainer.innerHTML = '';
    _mcRenderCompetencyAssessment(listContainer, userId, workspaceKey, containerId);
  }, 200);
}

function _mcRenderCompetencyAssessment(container, userId, workspaceKey, containerId) {
  const questions = _mcBuildCompetencyQuiz();
  const answers = new Array(questions.length).fill(-1);
  let submitted = false;

  const hdr = _mcEl('div', { style: 'margin-bottom:18px;' });
  hdr.innerHTML = `
    <div class="mc-eyebrow" style="color:${_MC.gold};">MAP Foundation Certification</div>
    <div class="mc-title" style="font-size:1.25rem;">Competency Assessment</div>
    <div class="mc-sub">15 questions covering PE calculation, domain identification, phenotype classification, intervention matching, and administration protocol. Pass threshold: 75% (11/15). You will see your score breakdown on completion.</div>`;
  container.appendChild(hdr);

  // Group by category
  const byCat = {};
  questions.forEach(function(q, idx) {
    if (!byCat[q.category]) byCat[q.category] = [];
    byCat[q.category].push({ q: q, idx: idx });
  });

  Object.entries(byCat).forEach(function([cat, items]) {
    const section = _mcEl('div', { style: 'margin-bottom:20px;' });
    section.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.63rem;letter-spacing:0.20em;text-transform:uppercase;color:' + _MC.muted + ';margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ' + _MC.border + ';">' + _mcEsc(cat) + '</div>';

    items.forEach(function(item) {
      const q = item.q;
      const qi = item.idx;
      const qDiv = _mcEl('div', { class: 'mc-q' });
      qDiv.innerHTML = `<div class="mc-q-text"><span class="mc-q-num">${qi + 1}.</span>${_mcEsc(q.text)}</div>`;
      q.choices.forEach(function(choice, ci) {
        const c = _mcEl('div', { class: 'mc-choice', 'data-qi': qi, 'data-ci': ci });
        c.innerHTML = `<span class="mc-choice-bullet"></span><span class="mc-choice-text">${_mcEsc(choice)}</span>`;
        c.addEventListener('click', function() {
          if (submitted) return;
          answers[qi] = ci;
          qDiv.querySelectorAll('.mc-choice').forEach(function(el) { el.classList.remove('selected'); });
          c.classList.add('selected');
        });
        qDiv.appendChild(c);
      });
      section.appendChild(qDiv);
    });
    container.appendChild(section);
  });

  const actions = _mcEl('div', { class: 'mc-quiz-actions', style: 'margin-top:10px;' });
  const submitBtn = _mcEl('button', { class: 'mc-btn mc-btn-gold' }, 'Submit Competency Assessment');
  actions.appendChild(submitBtn);
  container.appendChild(actions);

  const feedback = _mcEl('div', { style: 'margin-top:14px;' });
  container.appendChild(feedback);

  submitBtn.addEventListener('click', function() {
    if (submitted) return;
    const unanswered = answers.filter(function(a) { return a === -1; }).length;
    if (unanswered > 0) {
      feedback.innerHTML = '<div class="mc-error">Please answer all ' + unanswered + ' remaining question' + (unanswered > 1 ? 's' : '') + '.</div>';
      return;
    }
    submitted = true;
    submitBtn.disabled = true;

    let correct = 0;
    const byCatScore = {};
    questions.forEach(function(q, qi) {
      const ai = answers[qi];
      container.querySelectorAll('[data-qi="' + qi + '"]').forEach(function(el) {
        const ci = parseInt(el.getAttribute('data-ci'));
        if (ci === q.correct) el.classList.add('correct');
        else if (ci === ai) el.classList.add('wrong');
      });
      if (!byCatScore[q.category]) byCatScore[q.category] = { correct: 0, total: 0 };
      byCatScore[q.category].total++;
      if (ai === q.correct) { correct++; byCatScore[q.category].correct++; }
    });

    const pct = Math.round(correct / questions.length * 100);
    const passed = correct >= 11; // 75% of 15

    // Save progress
    if (passed) {
      _mcSaveProgress(userId, 'competency_passed', true);
      _mcSaveProgress(userId, 'competency_score', pct);
    } else {
      _mcSaveProgress(userId, 'competency_last_fail', Date.now());
      _mcSaveProgress(userId, 'competency_score_last', pct);
    }

    // Score breakdown
    let breakdownHtml = '<div class="mc-score-breakdown"><div class="mc-score-breakdown-title">Score Breakdown</div>';
    Object.entries(byCatScore).forEach(function([cat, sc]) {
      breakdownHtml += '<div class="mc-score-row"><span>' + _mcEsc(cat) + '</span><span class="mc-score-val" style="color:' + (sc.correct === sc.total ? _MC.green : sc.correct === 0 ? _MC.red : _MC.amber) + ';">' + sc.correct + '/' + sc.total + '</span></div>';
    });
    breakdownHtml += '<div class="mc-score-row" style="font-weight:600;"><span>Total</span><span class="mc-score-val" style="color:' + (passed ? _MC.green : _MC.red) + ';">' + correct + '/15 (' + pct + '%)</span></div></div>';

    if (passed) {
      feedback.innerHTML = '<div class="mc-success">Competency assessment passed! Issuing your MAP Foundation Certificate...</div>' + breakdownHtml;
      _mcIssueCertificate(userId, workspaceKey, pct, containerId, feedback);
    } else {
      feedback.innerHTML = '<div class="mc-error">Score: ' + correct + '/15 (' + pct + '%). Threshold is 11/15 (75%). Review the modules and retry after 24 hours.</div>' + breakdownHtml;
    }
  });
}

function _mcIssueCertificate(userId, workspaceKey, competencyScore, containerId, feedbackEl) {
  // Get practitioner details from Firebase profile or prompt
  const db = _mcFirebase();
  const profileRef = db ? db.ref('workspaces/' + workspaceKey + '/profile') : null;
  const userRef = db ? db.ref('users/' + userId) : null;

  Promise.all([
    profileRef ? profileRef.once('value').then(function(s) { return s.val(); }).catch(function() { return null; }) : Promise.resolve(null),
    userRef ? userRef.once('value').then(function(s) { return s.val(); }).catch(function() { return null; }) : Promise.resolve(null),
  ]).then(function(results) {
    const wsProfile = results[0] || {};
    const userProfile = results[1] || {};

    const practitioner_name = userProfile.displayName || userProfile.name || 'Practitioner';
    const practitioner_role = userProfile.role || wsProfile.primary_role || 'other';
    const institution = wsProfile.institution || userProfile.institution || '';
    const country = wsProfile.country || userProfile.country || '';
    const country_iso2 = wsProfile.country_iso2 || userProfile.country_iso2 || 'XX';

    _mcAuthHeader().then(function(headers) {
      fetch(_mcApiBase() + '/certification/issue', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          practitioner_name: practitioner_name,
          practitioner_role: practitioner_role,
          institution: institution,
          country: country,
          country_iso2: country_iso2,
          cert_level: 'foundation',
          training_score: 85, // modules completed = training score baseline
          competency_score: competencyScore,
          workspace_key: workspaceKey,
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp.error) throw new Error(resp.error);
        const cert = resp.data || resp;
        // Save cert record to Firebase for offline display
        _mcSaveProgress(userId, 'cert_record', cert);
        if (feedbackEl) {
          feedbackEl.innerHTML += '<div class="mc-success">Certificate issued: <strong>' + _mcEsc(cert.cert_number) + '</strong></div>';
        }
        // Render the certificate below the assessment
        const certContainer = document.getElementById(containerId);
        if (certContainer) {
          const certWrap = _mcEl('div', { style: 'margin-top:28px;' });
          certContainer.appendChild(certWrap);
          const certId = 'mc-cert-' + Date.now();
          certWrap.id = certId;
          renderDigitalCertificate(certId, cert);
        }
      })
      .catch(function(err) {
        console.error('Certificate issue error:', err);
        if (feedbackEl) {
          feedbackEl.innerHTML += '<div class="mc-error">Certificate issuance encountered an error: ' + _mcEsc(err.message) + '. Contact research@scalacartafoundation.org.</div>';
        }
      });
    });
  });
}

// ── renderDigitalCertificate ───────────────────────────────────────────────────
function renderDigitalCertificate(containerId, certRecord) {
  _mcInjectStyles();
  var container;
  if (typeof containerId === 'string') {
    container = document.getElementById(containerId);
  } else {
    container = containerId; // allow element to be passed directly
  }
  if (!container) return;
  container.innerHTML = '';
  container.className = 'mc-cert-wrap';

  const cert = certRecord || {};
  const name = cert.practitioner_name || 'Practitioner Name';
  const role = _mcRoleFmt(cert.practitioner_role);
  const institution = cert.institution || '';
  const country = cert.country || '';
  const level = _mcLevelFmt(cert.cert_level);
  const certNum = cert.cert_number || 'MAP-CERT-XX-2026-000000';
  const issuedAt = cert.issued_at || cert.issued_date;
  const expiresAt = cert.expires_at || cert.expiry_date;
  const issuedStr = _mcFmtDate(typeof issuedAt === 'number' ? issuedAt : new Date(issuedAt).getTime());
  const expiresStr = _mcFmtDate(typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime());
  const verifyUrl = 'https://atlas.adherence.cc/verify/' + encodeURIComponent(certNum);
  const iso2 = cert.country_iso2 || '';
  const flag = iso2 ? _mcCountryFlag(iso2) : '';

  const card = _mcEl('div', { class: 'mc-cert-card' });

  // Header band
  card.innerHTML = `
    <div class="mc-cert-header">
      <div>
        <div class="mc-cert-wordmark">ATLAS &middot; MAP &middot; TESSERA GRC</div>
        <div class="mc-cert-logo-text">Adherence Cartography &middot; Scala Carta Foundation</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.16em;color:rgba(240,200,67,0.45);text-transform:uppercase;">Certificate of Competency</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:rgba(240,200,67,0.65);margin-top:3px;">${_mcEsc(certNum)}</div>
      </div>
    </div>

    <div class="mc-cert-body">
      <div class="mc-cert-seal-row">
        <div class="mc-cert-seal">&#9670;</div>
        <div>
          <div class="mc-cert-type">Scala Carta Foundation &middot; ${_mcEsc(level)} Certification</div>
          <div class="mc-cert-type-title">Certificate of Competency</div>
        </div>
      </div>

      <div class="mc-cert-certifies">This certifies that</div>
      <div class="mc-cert-name">${_mcEsc(name)}</div>

      <div class="mc-cert-role-line">
        ${role ? '<strong>' + _mcEsc(role) + '</strong>' : ''}${role && institution ? ' &middot; ' : ''}${institution ? _mcEsc(institution) : ''}${(role || institution) && country ? ' &middot; ' : ''}${country ? (flag ? flag + ' ' : '') + _mcEsc(country) : ''}
      </div>

      <div class="mc-cert-body-text">
        has successfully completed the MAP ${_mcEsc(level)} Certification Program, demonstrating competency in the Multidimensional Adherence Parameters (MAP) instrument, including the triadic AEC domain framework, Predictive Emergence (PE) scoring, PEACS phenotype classification, and evidence-based intervention matching. This certification is issued in accordance with the standards of the Scala Carta Foundation, a 501(c)(3) non-profit organization, under the auspices of TESSERA GRC.
      </div>

      <div class="mc-cert-meta-grid">
        <div class="mc-cert-meta-box">
          <div class="mc-cert-meta-label">Certificate Number</div>
          <div class="mc-cert-meta-val">${_mcEsc(certNum)}</div>
        </div>
        <div class="mc-cert-meta-box">
          <div class="mc-cert-meta-label">Date Issued</div>
          <div class="mc-cert-meta-val">${_mcEsc(issuedStr)}</div>
        </div>
        <div class="mc-cert-meta-box">
          <div class="mc-cert-meta-label">Valid Through</div>
          <div class="mc-cert-meta-val">${_mcEsc(expiresStr)}</div>
        </div>
      </div>
    </div>

    <div class="mc-cert-footer">
      <div>
        <div class="mc-cert-sig-name">Philip Morisky, MBA</div>
        <div class="mc-cert-sig-line">Founder, Scala Carta Foundation &middot; Chief Optimus, Adherence Cartography</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(240,200,67,0.45);margin-bottom:4px;">Verify at</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:rgba(240,200,67,0.60);">atlas.adherence.cc/verify</div>
      </div>
    </div>`;

  container.appendChild(card);

  // Action buttons below the card
  const actions = _mcEl('div', { class: 'mc-cert-actions' });

  const printBtn = _mcEl('button', { class: 'mc-btn mc-btn-gold' }, 'Download Certificate');
  printBtn.addEventListener('click', function() { window.print(); });
  actions.appendChild(printBtn);

  const shareBtn = _mcEl('button', { class: 'mc-btn mc-btn-ghost' }, 'Share Credential');
  shareBtn.addEventListener('click', function() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(verifyUrl).then(function() {
        shareBtn.textContent = 'Link Copied!';
        setTimeout(function() { shareBtn.textContent = 'Share Credential'; }, 2000);
      });
    } else {
      const inp = document.createElement('input');
      inp.value = verifyUrl;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand('copy');
      document.body.removeChild(inp);
      shareBtn.textContent = 'Link Copied!';
      setTimeout(function() { shareBtn.textContent = 'Share Credential'; }, 2000);
    }
  });
  actions.appendChild(shareBtn);

  container.appendChild(actions);

  // Verify URL display
  container.appendChild(_mcEl('div', { class: 'mc-cert-verify-note' },
    'Verification URL: <a href="' + _mcEsc(verifyUrl) + '" target="_blank" rel="noopener" style="color:' + _MC.base + ';text-decoration:none;">' + _mcEsc(verifyUrl) + '</a>'));
}

// ── renderCertificationDirectory ───────────────────────────────────────────────
function renderCertificationDirectory(containerId) {
  _mcInjectStyles();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="mc-loading">Loading directory...</div>';
  container.className = 'mc-wrap';

  function loadDirectory(filters) {
    const params = new URLSearchParams();
    if (filters.q)       params.set('q',       filters.q);
    if (filters.role)    params.set('role',     filters.role);
    if (filters.country) params.set('country',  filters.country);
    if (filters.level)   params.set('level',    filters.level);
    params.set('limit', '200');

    fetch(_mcApiBase() + '/certification/directory?' + params.toString())
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        const data = resp.data || resp;
        renderDir(data, filters);
      })
      .catch(function(err) {
        container.innerHTML = '<div class="mc-error">Failed to load directory: ' + _mcEsc(err.message) + '</div>';
      });
  }

  function renderDir(data, filters) {
    container.innerHTML = '';

    const stats = data.stats || {};
    const directory = data.directory || [];

    // Stats header
    const dirHeader = _mcEl('div', { class: 'mc-header' });
    dirHeader.innerHTML = `
      <div class="mc-eyebrow">Public Directory &middot; TESSERA GRC</div>
      <div class="mc-title">Certified MAP Practitioners</div>`;
    container.appendChild(dirHeader);

    const statRow = _mcEl('div', { class: 'mc-dir-header' });
    statRow.innerHTML = `
      <span class="mc-dir-stat-pill" style="color:${_MC.gold};border-color:rgba(240,200,67,0.35);background:rgba(240,200,67,0.08);">${stats.total_certified || 0} Certified</span>
      <span class="mc-dir-stat-pill" style="color:${_MC.base};border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.08);">${stats.countries_represented || 0} Countries</span>
      <span class="mc-dir-stat-pill" style="color:${_MC.green};border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.08);">${stats.issued_this_year || 0} Issued This Year</span>`;
    container.appendChild(statRow);

    // Search + filter bar
    const searchBar = _mcEl('div', { class: 'mc-search-bar' });
    const searchInput = _mcEl('input', {
      class: 'mc-search-input',
      type: 'text',
      placeholder: 'Search practitioner name...',
      value: filters.q || ''
    });
    const roleSelect = _mcEl('select', { class: 'mc-select' });
    roleSelect.innerHTML = '<option value="">All Roles</option><option value="pharmacist">Pharmacist</option><option value="physician">Physician</option><option value="nurse">Nurse</option><option value="researcher">Researcher</option><option value="chw">CHW</option><option value="other">Other</option>';
    if (filters.role) roleSelect.value = filters.role;
    const levelSelect = _mcEl('select', { class: 'mc-select' });
    levelSelect.innerHTML = '<option value="">All Levels</option><option value="foundation">Foundation</option><option value="advanced">Advanced</option><option value="trainer">Trainer</option>';
    if (filters.level) levelSelect.value = filters.level;

    const searchBtn = _mcEl('button', { class: 'mc-btn mc-btn-base' }, 'Search');
    searchBtn.addEventListener('click', function() {
      loadDirectory({ q: searchInput.value.trim(), role: roleSelect.value, level: levelSelect.value });
    });
    searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') searchBtn.click(); });

    searchBar.appendChild(searchInput);
    searchBar.appendChild(roleSelect);
    searchBar.appendChild(levelSelect);
    searchBar.appendChild(searchBtn);
    container.appendChild(searchBar);

    // Directory by country
    if (!directory.length) {
      container.appendChild(_mcEl('div', { class: 'mc-empty-state' }, '<div class="mc-empty-icon">&#9670;</div>No certified practitioners found.'));
      return;
    }

    directory.forEach(function(group) {
      const section = _mcEl('div', { class: 'mc-dir-country-section' });
      const flag = _mcCountryFlag(group.country_iso2);
      section.innerHTML = '<div class="mc-dir-country-label">' + (flag ? flag + ' ' : '') + _mcEsc(group.country || group.country_iso2 || 'Unknown') + ' (' + group.practitioners.length + ')</div>';

      const cards = _mcEl('div', { class: 'mc-dir-cards' });
      group.practitioners.forEach(function(p) {
        const card = _mcEl('div', { class: 'mc-dir-card' });
        const expiry = p.expiry_date ? new Date(p.expiry_date) : null;
        const expiryStr = expiry ? expiry.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '';
        card.innerHTML = `
          <div class="mc-dir-card-name">${_mcEsc(p.practitioner_name)}</div>
          <div class="mc-dir-card-meta">${_mcEsc(_mcRoleFmt(p.practitioner_role))}${p.institution ? ' &middot; ' + _mcEsc(p.institution) : ''}</div>
          <span class="mc-level-badge ${_mcEsc(p.cert_level || 'foundation')}">${_mcEsc(_mcLevelFmt(p.cert_level))}</span>
          <div class="mc-dir-card-number">${_mcEsc(p.cert_number)}</div>
          ${expiryStr ? '<div class="mc-dir-card-expiry">Valid through ' + _mcEsc(expiryStr) + '</div>' : ''}
          <a class="mc-verify-link" href="${_mcEsc(p.verification_url || '#')}" target="_blank" rel="noopener">Verify &#8599;</a>`;
        cards.appendChild(card);
      });
      section.appendChild(cards);
      container.appendChild(section);
    });
  }

  loadDirectory({ q: '', role: '', level: '' });
}

// ── renderMyCertifications ────────────────────────────────────────────────────
function renderMyCertifications(containerId, userId) {
  _mcInjectStyles();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="mc-loading">Loading your certifications...</div>';
  container.className = 'mc-wrap';

  const hdr = _mcEl('div', { class: 'mc-header' });
  hdr.innerHTML = `
    <div class="mc-eyebrow">My Certifications</div>
    <div class="mc-title">Certification Dashboard</div>
    <div class="mc-sub">Your active MAP certifications, expiry status, and in-progress training.</div>`;

  _mcLoadProgress(userId, function(progress) {
    container.innerHTML = '';
    container.appendChild(hdr);

    const certRecord = progress && progress.cert_record;
    const inProgressModules = [];

    _MC_MODULES.forEach(function(mod) {
      const quizPassed = progress && progress[mod.id + '_quiz_passed'];
      if (!quizPassed) {
        // Compute % of slides seen
        let slidesSeen = 0;
        mod.slides.forEach(function(_, idx) {
          if (progress && progress[mod.id + '_slide_' + idx]) slidesSeen++;
        });
        const pct = Math.round(slidesSeen / mod.slides.length * 100);
        inProgressModules.push({ title: mod.title, pct: pct });
      }
    });

    // In-progress training
    if (inProgressModules.length > 0) {
      const progSection = _mcEl('div', { class: 'mc-progress-section', style: 'margin-bottom:24px;' });
      progSection.innerHTML = '<div class="mc-progress-label">Training Progress</div>';
      inProgressModules.forEach(function(m) {
        const row = _mcEl('div', { class: 'mc-progress-row' });
        row.innerHTML = `
          <span class="mc-progress-mod-name">${_mcEsc(m.title)}</span>
          <div class="mc-progress-bar-wrap"><div class="mc-progress-bar-fill" style="width:${m.pct}%;"></div></div>
          <span class="mc-progress-pct">${m.pct}%</span>`;
        progSection.appendChild(row);
      });
      container.appendChild(progSection);
    }

    // Active certifications
    if (!certRecord) {
      if (inProgressModules.length === 0 && !(progress && progress.competency_passed)) {
        container.appendChild(_mcEl('div', { class: 'mc-empty-state' }, '<div class="mc-empty-icon">&#9670;</div>No certifications yet. <a href="#" onclick="renderCertificationHub && renderCertificationHub(\'' + _mcEsc(containerId) + '\',\'' + _mcEsc(userId) + '\',\'\')" style="color:' + _MC.base + ';">Start Foundation Training</a>'));
      } else if (progress && progress.competency_passed) {
        container.appendChild(_mcEl('div', { class: 'mc-success' }, 'Competency assessment passed. Certificate is being issued.'));
      }
      return;
    }

    const certCard = _mcEl('div', { class: 'mc-my-cert-card' });
    const daysLeft = _mcDaysRemaining(certRecord.expires_at || new Date(certRecord.expiry_date).getTime());
    const countdownClass = daysLeft < 30 ? 'urgent' : daysLeft < 90 ? 'warn' : 'ok';

    certCard.innerHTML = `
      <div class="mc-my-cert-top">
        <div>
          <div class="mc-my-cert-name">${_mcEsc(certRecord.practitioner_name || '')}</div>
          <div class="mc-my-cert-number">${_mcEsc(certRecord.cert_number || '')}</div>
          <div style="margin-top:6px;"><span class="mc-level-badge ${_mcEsc(certRecord.cert_level || 'foundation')}">${_mcEsc(_mcLevelFmt(certRecord.cert_level))}</span></div>
        </div>
        <span class="mc-expiry-countdown ${countdownClass}">${daysLeft > 0 ? daysLeft + ' days left' : 'Expired'}</span>
      </div>
      <div style="font-size:0.78rem;color:${_MC.muted};margin-bottom:12px;">
        Issued: ${_mcEsc(_mcFmtDate(certRecord.issued_at || new Date(certRecord.issued_date).getTime()))} &middot;
        Expires: ${_mcEsc(_mcFmtDate(certRecord.expires_at || new Date(certRecord.expiry_date).getTime()))}
      </div>`;

    const btnRow = _mcEl('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' });
    const dlBtn = _mcEl('button', { class: 'mc-btn mc-btn-gold' }, 'Download Certificate');
    dlBtn.addEventListener('click', function() {
      // Render certificate in a printable overlay
      const overlay = _mcEl('div', { id: 'mc-print-overlay', style: 'position:fixed;inset:0;background:#0a1220;z-index:9999;overflow:auto;padding:32px;' });
      const closeBtn = _mcEl('button', { class: 'mc-btn mc-btn-ghost', style: 'margin-bottom:16px;' }, 'Close');
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      overlay.appendChild(closeBtn);
      const certDiv = _mcEl('div', { id: 'mc-print-cert' });
      overlay.appendChild(certDiv);
      document.body.appendChild(overlay);
      renderDigitalCertificate('mc-print-cert', certRecord);
      setTimeout(function() { window.print(); }, 300);
    });
    btnRow.appendChild(dlBtn);

    if (daysLeft < 90) {
      const renewBtn = _mcEl('button', { class: 'mc-btn mc-btn-amber' }, 'Renew Certification');
      renewBtn.addEventListener('click', function() {
        renderFoundationTraining(containerId, userId, certRecord.workspace_key || '');
      });
      btnRow.appendChild(renewBtn);
    }

    certCard.appendChild(btnRow);
    container.appendChild(certCard);
  });
}

window.renderCertificationHub = renderCertificationHub;
