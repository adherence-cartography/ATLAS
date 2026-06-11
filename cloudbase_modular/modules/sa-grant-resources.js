// sa-grant-resources.js: Grant Resource Center - templates, funding board, letter of support, AIRC membership
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

// ── Module-level state ────────────────────────────────────────────────────────
let _sgrActiveTab = 'templates';
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
    .sgr-airc-id-box{display:flex;align-items:center;gap:8px;background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.22);border-radius:6px;padding:8px 12px;margin-top:4px;}
    .sgr-airc-id-val{font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:700;color:#2ec98a;letter-spacing:0.06em;flex:1;}
    .sgr-badge-status-pending{color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);}
    .sgr-badge-status-approved{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sgr-badge-status-rejected{color:#ef4444;border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.06);}
    .sgr-phase-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(56,189,248,0.30);background:rgba(56,189,248,0.06);color:#38bdf8;white-space:nowrap;}
  `;
  document.head.appendChild(s);
}

// ── Data: Grant Templates ─────────────────────────────────────────────────────
const _SGR_TEMPLATES = [
  {
    id: 'platform-desc',
    title: 'ATLAS Platform Description',
    desc: 'For any grant application: general platform introduction',
    text: 'This study will utilize the ATLAS (Adherence Tracking and Longitudinal Assessment System) platform (atlas.adherence.cc), developed by Philip Morisky, ScD, MS, MPH, Professor Emeritus, UCLA Fielding School of Public Health, and creator of the Morisky Medication Adherence Scale (MMAS). ATLAS provides IRB-grade data management, validated adherence instruments (MMAS-8, MAP, PEACS), real-time analytics, and export capabilities compliant with HIPAA and GDPR requirements. The platform is used by researchers in 150+ countries and serves as infrastructure for the ATLAS International Research Consortium (AIRC).'
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
    text: 'The 8-item Morisky Medication Adherence Scale (MMAS-8), developed by Morisky, Ang, Krousel-Wood, and Ward (2008), is the most widely validated self-report adherence instrument in the literature, with over 3,000 peer-reviewed citations. The MMAS-8 classifies adherence as high (score = 8), medium (6 to less than 8), or low (less than 6) and demonstrates sensitivity of 0.93 and specificity of 0.53 for identifying non-adherent patients in hypertension populations (Morisky et al., 2008). Use of the MMAS-8 in this study is conducted under formal license agreement with the copyright holder, Philip Morisky, ScD, in compliance with established terms for research use.'
  },
  {
    id: 'budget-atlas',
    title: 'Budget Justification: ATLAS',
    desc: 'For NIH budget narrative sections covering platform costs',
    text: 'ATLAS Platform Access (Year 1-3): $[AMOUNT]/year. The ATLAS platform provides validated adherence assessment instruments (MMAS-8, MAP, PEACS), secure cloud-based data collection and storage, real-time analytics, IRB-compliant audit logging, CONSORT participant flow tracking, and publication-ready data export. Platform access includes instrument licensing fees for MMAS-8 and MAP, unlimited participant assessments, researcher workspace provisioning, and technical support. ATLAS is used by investigators in 150+ countries and is the recommended infrastructure platform for multi-site adherence studies by the ATLAS International Research Consortium.'
  },
  {
    id: 'airc-statement',
    title: 'AIRC Consortium Membership Statement',
    desc: 'For collaboration and team science sections demonstrating global network',
    text: 'The investigators are members of the ATLAS International Research Consortium (AIRC), a global network of adherence researchers coordinated by Philip Morisky, ScD, Professor Emeritus, UCLA Fielding School of Public Health. AIRC membership provides access to the global ATLAS normative dataset, co-authorship pathways on consortium publications, and cross-site data harmonization infrastructure. The consortium currently includes member institutions across [X] countries and [Y] active studies.'
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
    desc: 'International Training Grant supporting capacity building for LMIC researchers. Strong alignment with AIRC cross-site training goals and ATLAS platform deployment.',
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
    desc: 'Global funding for science that improves health. Supports adherence science in LMICs, implementation research, and cross-country validation studies via AIRC infrastructure.',
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
      'Letter of Support from Philip Morisky, ScD',
      'Co-authorship pathway on AIRC normative database paper',
      'Full grant template library access',
      'AIRC consortium directory listing',
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
      'AIRC consortium network listing',
      'Invitation to AIRC annual convening',
      'Access to AIRC normative dataset (read-only)',
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
          'Your AIRC membership application is currently under review. Letter of Support requests become available once your membership is approved. ' +
          'Applications are typically reviewed within 5 to 7 business days.'
        ));
        container.appendChild(pendingBox);
      } else {
        const gateBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:10px;padding:24px 26px;max-width:600px;' });
        gateBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:10px;' }, 'AIRC Membership Required'));
        gateBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.75;margin-bottom:18px;' },
          'Letters of support are issued to active AIRC members. Join the consortium to request a letter for your IRB, grant application, or ethics board.'
        ));
        const btnRow = _sgrEl('div', { style:'display:flex;gap:10px;flex-wrap:wrap;' });

        const stdBtn = _sgrEl('a', {
          href: 'https://adherence.cc/consortium/',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);' +
                 'background:rgba(212,168,67,0.09);color:#d4a843;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for AIRC Membership &#8599;');
        btnRow.appendChild(stdBtn);

        const fellowBtn = _sgrEl('a', {
          href: 'https://adherence.cc/consortium/#fellowship',
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
    'Submit a request for a Letter of Support from Philip Morisky, ScD, for your grant application. Requests are reviewed within 5 business days. ' +
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

// ── Tab: MY AIRC ──────────────────────────────────────────────────────────────
function _sgrRenderMyAIRC(container) {
  container.innerHTML = '<div style="color:rgba(96,120,152,0.65);font-size:0.80rem;padding:14px 0;"><span class="sgr-spinner"></span>Checking membership status...</div>';

  const user = _sgrCurrentUser();
  const db   = _sgrDb();

  if (!user || !user.email) {
    container.innerHTML = '';
    const msg = _sgrEl('div', { style:'color:rgba(138,160,184,0.8);font-size:0.84rem;line-height:1.7;padding:10px 0;' },
      'You must be signed in to view or apply for AIRC membership. Please log in and return to this section.'
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
}

function _sgrRenderMemberProfile(container, data, user) {
  const tier = _SGR_TIERS.find(t => t.id === (data.tier || 'tier3')) || _SGR_TIERS[1];

  const card = _sgrEl('div', { class:'sgr-tier-card' });

  const topRow = _sgrEl('div', { style:'display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;' });
  const nameBlock = _sgrEl('div');
  nameBlock.appendChild(_sgrEl('div', { class:'sgr-tier-name', style:'color:' + tier.color + ';' }, _sgrEscHtml(tier.name)));
  nameBlock.appendChild(_sgrEl('div', { class:'sgr-tier-sub' }, 'Member since ' + _sgrFmtDate(data.joinedTs || Date.now())));
  topRow.appendChild(nameBlock);
  const activeBadge = _sgrEl('span', { class:'sgr-badge', style:'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);' }, 'Active');
  topRow.appendChild(activeBadge);
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
    'Your AIRC membership application for ' +
    _sgrEscHtml((data.tier ? _SGR_TIERS.find(t => t.id === data.tier)?.name : 'Tier 3') || 'Tier 3') +
    ' is under review. You will receive an email confirmation once approved. Applications are typically reviewed within 5 to 7 business days.'
  ));
  container.appendChild(pendingBox);
}

function _sgrRenderApplySection(container, user, db) {
  const header = _sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.7;max-width:660px;margin-bottom:20px;' },
    'You are not yet a member of the ATLAS International Research Consortium (AIRC). ' +
    'Review the tier benefits below and submit an application. Membership provides access to the global ATLAS normative dataset, ' +
    'letter of support eligibility, co-authorship pathways, and the global researcher network.'
  );
  container.appendChild(header);

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
  nameRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-airc-name' }, 'Full Name'));
  nameRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-airc-name', type:'text', placeholder:'As it appears on publications' }));
  formWrap.appendChild(nameRow);

  // Institution
  const instRow = _sgrEl('div', { class:'sgr-form-row' });
  instRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-airc-inst' }, 'Institution'));
  instRow.appendChild(_sgrEl('input', { class:'sgr-input', id:'sgr-airc-inst', type:'text', placeholder:'University, hospital, or research center' }));
  formWrap.appendChild(instRow);

  // Country
  const countryRow = _sgrEl('div', { class:'sgr-form-row' });
  countryRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-airc-country' }, 'Country'));
  const csel = _sgrEl('select', { class:'sgr-select', id:'sgr-airc-country' });
  csel.appendChild(_sgrEl('option', { value:'' }, '-- Select Country --'));
  _SGR_COUNTRIES.forEach(c => csel.appendChild(_sgrEl('option', { value:c }, c)));
  countryRow.appendChild(csel);
  formWrap.appendChild(countryRow);

  // Tier selection
  const tierRow = _sgrEl('div', { class:'sgr-form-row' });
  tierRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-airc-tier' }, 'Membership Tier'));
  const tsel = _sgrEl('select', { class:'sgr-select', id:'sgr-airc-tier' });
  _SGR_TIERS.forEach(t => tsel.appendChild(_sgrEl('option', { value: t.id }, t.name)));
  tierRow.appendChild(tsel);
  formWrap.appendChild(tierRow);

  // Research focus
  const focusRow = _sgrEl('div', { class:'sgr-form-row' });
  focusRow.appendChild(_sgrEl('label', { class:'sgr-label', for:'sgr-airc-focus' }, 'Research Focus (brief)'));
  const focusTa = _sgrEl('textarea', { class:'sgr-textarea', id:'sgr-airc-focus', maxlength:'300', placeholder:'Describe your primary research area and how it relates to medication adherence...' });
  focusRow.appendChild(focusTa);
  formWrap.appendChild(focusRow);

  const applyMsg = _sgrEl('div', { id:'sgr-airc-msg', style:'display:none;' });

  const applyBtn = _sgrEl('button', { class:'sgr-apply-btn', id:'sgr-airc-apply-btn' }, 'Apply for AIRC Membership');
  applyBtn.addEventListener('click', () => _sgrSubmitAIRCApplication(db, user, applyMsg, applyBtn));
  formWrap.appendChild(applyBtn);
  formWrap.appendChild(applyMsg);

  container.appendChild(formWrap);
}

function _sgrSubmitAIRCApplication(db, user, msgEl, btn) {
  const name    = document.getElementById('sgr-airc-name')?.value.trim();
  const inst    = document.getElementById('sgr-airc-inst')?.value.trim();
  const country = document.getElementById('sgr-airc-country')?.value;
  const tier    = document.getElementById('sgr-airc-tier')?.value;
  const focus   = document.getElementById('sgr-airc-focus')?.value.trim();

  msgEl.style.display = 'none';

  if (!name || !inst || !country || !tier) {
    msgEl.className = 'sgr-error-box';
    msgEl.style.display = 'block';
    msgEl.textContent = 'Please complete all required fields before applying.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="sgr-spinner"></span>Submitting...';

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
    studies: 0
  };

  db.ref('consortium_members/' + user.uid).set(payload)
    .then(() => {
      btn.innerHTML = 'Apply for AIRC Membership';
      btn.disabled = true;
      msgEl.className = 'sgr-success-box';
      msgEl.style.display = 'block';
      msgEl.innerHTML =
        '<strong>Application submitted.</strong> Your AIRC membership application has been received. ' +
        'You will be notified by email once reviewed (typically 5 to 7 business days).';
    })
    .catch(err => {
      btn.innerHTML = 'Apply for AIRC Membership';
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
  const pageHeader = _sgrEl('div', { style:'margin-bottom:20px;' });
  pageHeader.innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:4px;">ATLAS · Grant Resource Center</div>' +
    '<div style="font-size:1.08rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:4px;">Grant Resources &amp; AIRC Tools</div>' +
    '<div style="font-size:0.80rem;color:rgba(96,120,152,0.65);max-width:600px;line-height:1.6;">Templates, funding opportunities, letter of support requests, and AIRC membership for ATLAS-affiliated researchers worldwide.</div>';
  container.appendChild(pageHeader);

  // Tab bar
  const tabs = [
    { key:'templates', label:'Templates' },
    { key:'funding',   label:'Funding Board' },
    { key:'support',   label:'Request Support' },
    { key:'airc',      label:'My AIRC' },
    { key:'registry',  label:'Registry' }
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
    case 'templates': _sgrRenderTemplates(contentWrap); break;
    case 'funding':   _sgrRenderFunding(contentWrap);   break;
    case 'support':   _sgrRenderSupport(contentWrap);   break;
    case 'airc':      _sgrRenderMyAIRC(contentWrap);    break;
    case 'registry':  _sgrRenderRegistry(contentWrap);  break;
    default:          _sgrRenderTemplates(contentWrap);
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
          'Your AIRC membership application is under review. Study registration becomes available once membership is approved. ' +
          'Applications are typically reviewed within 5 to 7 business days.'
        ));
        container.appendChild(pendingBox);
      } else {
        const gateBox = _sgrEl('div', { style:'background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:10px;padding:24px 26px;max-width:600px;' });
        gateBox.appendChild(_sgrEl('div', { style:'font-family:"IBM Plex Mono",monospace;font-size:0.80rem;font-weight:600;color:#d4a843;margin-bottom:10px;' }, 'AIRC Membership Required'));
        gateBox.appendChild(_sgrEl('div', { style:'font-size:0.82rem;color:rgba(138,160,184,0.8);line-height:1.75;margin-bottom:18px;' },
          'Study registration and AIRC Study ID assignment is available to active AIRC members. Join the consortium to register your study protocol.'
        ));
        const btnRow = _sgrEl('div', { style:'display:flex;gap:10px;flex-wrap:wrap;' });

        const stdBtn = _sgrEl('a', {
          href: 'https://adherence.cc/consortium/',
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.11em;text-transform:uppercase;' +
                 'padding:9px 20px;border-radius:7px;border:1px solid rgba(212,168,67,0.40);' +
                 'background:rgba(212,168,67,0.09);color:#d4a843;text-decoration:none;display:inline-block;transition:background 0.14s;'
        }, 'Apply for AIRC Membership &#8599;');
        btnRow.appendChild(stdBtn);

        const fellowBtn = _sgrEl('a', {
          href: 'https://adherence.cc/consortium/#fellowship',
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
    'Register your study protocol with the ATLAS International Research Consortium. Upon review, an AIRC Study ID will be issued within 5 business days.'
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
    airc_study_id: null
  };

  db.ref('airc_study_registry').push(payload)
    .then(function() {
      submitBtn.innerHTML = 'Submit Study Protocol';
      submitBtn.disabled = false;
      msgEl.className = 'sgr-success-box';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Study submitted. Your AIRC Study ID will be assigned within 5 business days.';

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

  db.ref('airc_study_registry').orderByChild('uid').equalTo(user.uid).once('value')
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

        if (s.status === 'approved' && s.airc_study_id) {
          const idBox = _sgrEl('div', { class:'sgr-airc-id-box' });
          idBox.appendChild(_sgrEl('div', { class:'sgr-airc-id-val' }, _sgrEscHtml(s.airc_study_id)));
          const copyBtn = _sgrEl('button', { class:'sgr-copy-btn', style:'margin:0;padding:4px 10px;' }, '&#8856; Copy ID');
          copyBtn.addEventListener('click', function() { _sgrCopyText(s.airc_study_id, copyBtn); });
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

// Expose sub-renderers for external call if needed
window.saGrantRenderTemplates = _sgrRenderTemplates;
window.saGrantRenderFunding   = _sgrRenderFunding;
window.saGrantRenderSupport   = _sgrRenderSupport;
window.saGrantRenderMyAIRC    = _sgrRenderMyAIRC;
window.saGrantRenderRegistry  = _sgrRenderRegistry;
