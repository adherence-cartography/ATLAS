// sa-consortium.js — TESSERA GRC (Global Research Consortium)
// Mission Control module: member registry, funding board, letters of support, impact dashboard
//
// Firebase paths used:
//   consortium_members/{id}     — superadmin read/write
//   consortium_letters/{id}     — superadmin read/write
//   consortium_applications/{id} — PUBLIC write (tessera-signup form), superadmin read/write
//
// Firebase rules (add to database.rules.json):
//   "consortium_members":      { ".read": "auth.token.superadmin === true", ".write": "auth.token.superadmin === true" },
//   "consortium_letters":      { ".read": "auth.token.superadmin === true", ".write": "auth.token.superadmin === true" },
//   "consortium_applications": { ".read": "auth.token.superadmin === true", ".write": true }

// ── Color constants (prefixed _CC to avoid conflicts with _C in sa-shell.js and _CP in sa-partners.js) ──
const _CC = window._ATLAS_COLORS || {
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
let _saCons_membersCache      = [];
let _saCons_lettersCache      = [];
let _saCons_applicationsCache = [];
let _saCons_activeSubTab      = 'members';
let _saCons_tierFilter    = 'all';
let _saCons_regionFilter  = 'all';
let _saCons_fitFilter     = 'all';

// ── Tier definitions ─────────────────────────────────────────────────────────
const _CONS_TIERS = {
  0: { label: 'Founder',               color: '#f5f0e0',   border: 'rgba(240,232,210,0.6)',  bg: 'rgba(240,232,210,0.08)'  },
  1: { label: 'Institutional Partner', color: _CC.amber,   border: 'rgba(212,168,67,0.4)',   bg: 'rgba(212,168,67,0.08)'   },
  2: { label: 'Validation Partner',    color: _CC.cyan,    border: 'rgba(56,189,248,0.4)',   bg: 'rgba(56,189,248,0.08)'   },
  3: { label: 'Research Affiliate',    color: _CC.green,   border: 'rgba(46,201,138,0.4)',   bg: 'rgba(46,201,138,0.08)'   },
  4: { label: 'Student Affiliate',     color: _CC.purple,  border: 'rgba(139,111,245,0.4)',  bg: 'rgba(139,111,245,0.08)'  },
  5: { label: 'Industry Partner',      color: '#f59e0b',   border: 'rgba(245,158,11,0.4)',   bg: 'rgba(245,158,11,0.08)'   },
};

// Maps numeric consortium_members tier (0–5) → tessera_tiles tier string
const _CONS_TIER_TO_TESSERA = { 0:'founder', 1:'institutional', 2:'validation', 3:'affiliate', 4:'student', 5:'industry' };

// Reverse map: tessera_tiles tier string → numeric
const _TESSERA_TIER_TO_CONS = { founder:0, institutional:1, validation:2, affiliate:3, student:4, industry:5 };

// ── Country list ─────────────────────────────────────────────────────────────
const _CONS_COUNTRIES = [
  'United States','United Kingdom','Canada','Australia','New Zealand',
  'Germany','France','Spain','Italy','Portugal','Netherlands','Belgium',
  'Switzerland','Austria','Sweden','Norway','Denmark','Finland',
  'Poland','Czech Republic','Hungary','Romania','Bulgaria','Croatia',
  'Cyprus','Malta','Greece','Turkey','Israel','Saudi Arabia','UAE',
  'Egypt','South Africa','Nigeria','Kenya','Ethiopia','Ghana',
  'Brazil','Mexico','Argentina','Colombia','Chile','Peru',
  'India','China','Japan','South Korea','Singapore','Thailand',
  'Philippines','Indonesia','Malaysia','Vietnam','Pakistan','Bangladesh',
  'Other',
];

// ── Flag lookup ───────────────────────────────────────────────────────────────
const _CONS_FLAGS = {
  'United States':'🇺🇸','United Kingdom':'🇬🇧','Canada':'🇨🇦','Australia':'🇦🇺',
  'New Zealand':'🇳🇿','Germany':'🇩🇪','France':'🇫🇷','Spain':'🇪🇸','Italy':'🇮🇹',
  'Portugal':'🇵🇹','Netherlands':'🇳🇱','Belgium':'🇧🇪','Switzerland':'🇨🇭',
  'Austria':'🇦🇹','Sweden':'🇸🇪','Norway':'🇳🇴','Denmark':'🇩🇰','Finland':'🇫🇮',
  'Poland':'🇵🇱','Czech Republic':'🇨🇿','Hungary':'🇭🇺','Romania':'🇷🇴',
  'Bulgaria':'🇧🇬','Croatia':'🇭🇷','Cyprus':'🇨🇾','Malta':'🇲🇹','Greece':'🇬🇷',
  'Turkey':'🇹🇷','Israel':'🇮🇱','Saudi Arabia':'🇸🇦','UAE':'🇦🇪','Egypt':'🇪🇬',
  'South Africa':'🇿🇦','Nigeria':'🇳🇬','Kenya':'🇰🇪','Ethiopia':'🇪🇹','Ghana':'🇬🇭',
  'Brazil':'🇧🇷','Mexico':'🇲🇽','Argentina':'🇦🇷','Colombia':'🇨🇴','Chile':'🇨🇱',
  'Peru':'🇵🇪','India':'🇮🇳','China':'🇨🇳','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Singapore':'🇸🇬','Thailand':'🇹🇭','Philippines':'🇵🇭','Indonesia':'🇮🇩',
  'Malaysia':'🇲🇾','Vietnam':'🇻🇳','Pakistan':'🇵🇰','Bangladesh':'🇧🇩',
};

// ── Hardcoded funding opportunities ──────────────────────────────────────────
const _CONS_FUNDING = [
  {
    agency: 'NIH',
    mechanism: 'R24 Resource Infrastructure Grant',
    region: 'Global',
    fit: 'Infrastructure',
    deadline: 'Rolling',
    description: 'Supports development and dissemination of research resources. Ideal for establishing ATLAS as a shared research infrastructure platform with validated psychometric instruments.',
    url: 'https://grants.nih.gov/grants/guide/pa-files/PA-20-272.html',
    boilerplate: 'The ATLAS platform (atlasadherence.com) provides a validated psychometric infrastructure for multicenter medication adherence research. ATLAS hosts the MAP, MMAS-8, and PEACS instruments with real-time scoring, normative benchmarking, and consortium-level data aggregation capabilities. This R24 infrastructure grant will enable ATLAS to serve as a shared resource for the broader adherence research community.'
  },
  {
    agency: 'NIH Fogarty',
    mechanism: 'D43 International Research Training Grant',
    region: 'LMIC',
    fit: 'Capacity Building',
    deadline: 'October (annually)',
    description: 'Funds research training programs that strengthen public health and biomedical research capacity in low- and middle-income countries. ATLAS consortium members in LMIC regions are ideal collaborating institutions.',
    url: 'https://www.fic.nih.gov/Programs/Pages/training-grants.aspx',
    boilerplate: 'TESSERA GRC (Global Research Consortium) partners with institutions across LMIC regions to deliver training in evidence-based medication adherence measurement. TESSERA GRC consortium members provide in-country mentorship and access to the validated MAP, MMAS-8, and PEACS instruments through the ATLAS platform, enabling sustainable local research capacity in adherence science.'
  },
  {
    agency: 'NIH Fogarty',
    mechanism: 'R21 TW International Collaborative Research',
    region: 'LMIC',
    fit: 'Pilot Studies',
    deadline: 'February / October',
    description: 'Supports exploratory pilot international research with LMIC partners. Suitable for instrument validation, cross-cultural adaptation, and normative data collection in underrepresented populations.',
    url: 'https://www.fic.nih.gov/Funding/Pages/default.aspx',
    boilerplate: 'This R21 TW pilot study will leverage the ATLAS platform to conduct the first population-normative validation of the MAP adherence instrument in [target LMIC country]. ATLAS consortium membership provides the methodological infrastructure, REDCap integration, and real-time scoring algorithms necessary to execute a rigorous multicenter validation study within the proposed timeline.'
  },
  {
    agency: 'PCORI',
    mechanism: 'Patient-Centered Outcomes Research Award',
    region: 'USA',
    fit: 'Patient-Centered Outcomes',
    deadline: 'Rolling',
    description: 'Funds comparative effectiveness and patient-centered outcomes research. PEACS framework and MAP scores are ideally positioned for patient-reported outcomes integration.',
    url: 'https://www.pcori.org/funding-opportunities',
    boilerplate: 'The MAP instrument, integrated within the ATLAS platform, captures patient-reported adherence behaviors with validated psychometric precision. ATLAS enables real-time patient feedback loops and longitudinal PEACS phenotype tracking, aligning with PCORI\'s mandate to center patients in research design and measurement.'
  },
  {
    agency: 'NIH',
    mechanism: 'U54 Cooperative Research Center',
    region: 'USA+International',
    fit: 'Multi-site Studies',
    deadline: 'Rolling',
    description: 'Supports large cooperative research programs requiring coordinated multi-site infrastructure. ATLAS is the natural data coordination center for a medication adherence U54.',
    url: 'https://grants.nih.gov/grants/guide/pa-files/PAR-22-127.html',
    boilerplate: 'The ATLAS platform serves as the data coordination infrastructure for the proposed Cooperative Research Center. Participating sites in the Scala Carta Foundation contribute harmonized adherence data using the MAP, MMAS-8, and PEACS instruments, enabling cross-site aggregation, normative benchmarking, and phenotype classification through a common computational framework.'
  },
  {
    agency: 'Wellcome Trust',
    mechanism: 'Discovery Awards',
    region: 'Global',
    fit: 'Methodological Research',
    deadline: 'Rolling',
    description: 'Funds bold, exploratory, and interdisciplinary biomedical research. The PEACS behavioral phenotyping framework and MAP psychometric theory are strong fits for discovery-level methodological grants.',
    url: 'https://wellcome.org/grant-funding/schemes/discovery-awards',
    boilerplate: 'The PEACS (Psychometric Execution and Adherence Classification System) framework, hosted on ATLAS, introduces a novel behavioral phenotyping approach to medication adherence science. This Wellcome Discovery Award will fund the theoretical development and cross-cultural validation of the MAP-to-PEACS phenotype pipeline, establishing a globally applicable measurement paradigm for adherence research.'
  },
  {
    agency: 'Bill and Melinda Gates Foundation',
    mechanism: 'Grand Challenges in Global Health',
    region: 'LMIC',
    fit: 'NCD/Adherence',
    deadline: 'Rolling',
    description: 'Targets transformative solutions to global health challenges, including NCD medication adherence. ATLAS consortium members in Sub-Saharan Africa, South Asia, and Latin America align strongly.',
    url: 'https://www.grandchallenges.org/',
    boilerplate: 'Medication non-adherence in LMIC settings represents a critical bottleneck in NCD care. The ATLAS platform, through the TESSERA GRC consortium, deploys validated adherence instruments (MAP, MMAS-8) in resource-limited settings with offline capability and multilingual scoring. This Grand Challenge proposal will scale ATLAS to 10 LMIC consortium sites, generating the first globally representative adherence normative database.'
  },
  {
    agency: 'PAHO',
    mechanism: 'Small Grants Program',
    region: 'Latin America',
    fit: 'Validation Studies',
    deadline: 'Rolling',
    description: 'Supports health research in the Americas, particularly validation and implementation science projects. Ideal for ATLAS consortium members in Latin America conducting MAP or MMAS-8 validation work.',
    url: 'https://www.paho.org/en/research-development',
    boilerplate: 'This PAHO Small Grant will fund the Spanish-language validation and normative calibration of the MAP adherence instrument in [country]. Conducted through the Scala Carta Foundation, the study will enroll [N] participants across [N] clinical sites, with real-time data entry and PEACS phenotype classification via the ATLAS platform.'
  },
  {
    agency: 'European Research Council',
    mechanism: 'Starting Grant',
    region: 'Europe',
    fit: 'Early Career',
    deadline: 'September (annually)',
    description: 'Supports early-career researchers in Europe with ambitious projects. ATLAS consortium members at European institutions are eligible. Adherence measurement methodology is a strong fit.',
    url: 'https://erc.europa.eu/apply-grant/starting-grant',
    boilerplate: 'This ERC Starting Grant proposes the development of a pan-European adherence normative database using the ATLAS platform. As a member of the Scala Carta Foundation, the applying institution will contribute to a coordinated multicenter study across [N] EU countries, validating MAP and MMAS-8 instruments in culturally diverse European patient populations.'
  },
  {
    agency: 'Horizon Europe',
    mechanism: 'Health Cluster (Cluster 1)',
    region: 'Europe',
    fit: 'Digital Health',
    deadline: 'Rolling',
    description: 'Funds collaborative European research in health and digital health innovation. ATLAS as a digital health platform with AI-ready adherence data architecture aligns with Horizon cluster priorities.',
    url: 'https://eic.ec.europa.eu/index_en',
    boilerplate: 'The ATLAS platform represents a scalable digital health infrastructure for medication adherence research across the European Research Area. This Horizon Europe proposal will integrate ATLAS with EHR systems at consortium partner sites, enabling automated MAP scoring at point-of-care and real-time PEACS phenotype feedback to clinicians.'
  },
  {
    agency: 'ANRS (France)',
    mechanism: 'Emerging Infectious Diseases Research',
    region: 'France/Francophone',
    fit: 'Infectious Disease Adherence',
    deadline: 'Rolling',
    description: 'Funds infectious disease research including HIV, hepatitis, and other conditions where adherence is critical. ATLAS consortium members in France and Francophone Africa are well-positioned.',
    url: 'https://anrs.fr/en/research/calls-for-projects/',
    boilerplate: 'Medication adherence is the primary determinant of virologic suppression in HIV and hepatitis care. This ANRS-funded project will deploy the French-language MAP instrument through the ATLAS platform at consortium sites in France and Francophone Sub-Saharan Africa, generating comparative normative data and PEACS phenotype profiles across treatment-experienced patient cohorts.'
  },
  {
    agency: 'CNPq',
    mechanism: 'Universal Call (Chamada Universal)',
    region: 'Brazil',
    fit: 'Observational Research',
    deadline: 'Rolling',
    description: 'Brazil\'s primary national research funding mechanism. Supports observational and validation studies. ATLAS consortium members at Brazilian universities are directly eligible.',
    url: 'https://www.gov.br/cnpq/pt-br',
    boilerplate: 'This CNPq Universal project will conduct the first Brazilian normative validation of the MAP adherence instrument using the ATLAS platform. Enrolled across [N] university hospital sites in [N] Brazilian states, the study will generate Portuguese-language normative data, PEACS phenotype distributions, and cross-instrument concordance with the MMAS-8 in a diverse Brazilian patient population.'
  },
  {
    agency: 'Novo Nordisk Foundation',
    mechanism: 'Research Grant (Chronic Disease)',
    region: 'Denmark/Global',
    fit: 'Chronic Disease',
    deadline: 'Rolling',
    description: 'Funds research on chronic disease prevention, treatment, and outcomes. Diabetes adherence is a particularly strong fit for MAP and MMAS-8 instruments via ATLAS.',
    url: 'https://novonordiskfonden.dk/en/grants/',
    boilerplate: 'Medication adherence is the single most modifiable determinant of glycemic outcomes in type 2 diabetes. This Novo Nordisk Foundation grant will fund a multicenter ATLAS consortium study measuring diabetes medication adherence using MAP and MMAS-8 across [N] countries, with PEACS phenotype stratification to identify patients most likely to benefit from targeted adherence interventions.'
  },
  {
    agency: 'Janssen',
    mechanism: 'Global Adherence Research Fund',
    region: 'Global',
    fit: 'Industry Validation',
    deadline: 'Rolling',
    description: 'Industry research partnership for medication adherence studies. ATLAS consortium infrastructure and validated instruments are ideal for industry-sponsored real-world evidence generation.',
    url: 'https://www.janssen.com/research-development',
    boilerplate: 'The Scala Carta Foundation provides the validated psychometric infrastructure and global site network required for real-world adherence evidence generation. Through this Janssen partnership, ATLAS will deploy MAP-based adherence monitoring at [N] consortium sites, generating PEACS phenotype data and adherence trajectories for patients prescribed [therapeutic area] medications.'
  },
  {
    agency: 'AstraZeneca',
    mechanism: 'Adherence Research Partnership',
    region: 'Global',
    fit: 'Industry Partnership',
    deadline: 'Rolling',
    description: 'AstraZeneca real-world evidence and adherence research partnerships. Cardiovascular and respiratory adherence studies are priority areas well-served by MAP and MMAS-8 instruments.',
    url: 'https://www.astrazeneca.com/r-d/real-world-evidence.html',
    boilerplate: 'This AstraZeneca research partnership will leverage the ATLAS platform to conduct a prospective multicenter adherence study in [cardiovascular/respiratory] patients. ATLAS consortium sites in [regions] will administer MAP and MMAS-8 instruments with real-time PEACS phenotype classification, enabling identification of adherence phenotypes most predictive of clinical outcomes in AstraZeneca therapeutic areas.'
  },
];

// ── ATLAS milestones (hardcoded) ──────────────────────────────────────────────
const _CONS_MILESTONES = [
  { year: '2006', event: 'MMAS-8 developed by Philip Morisky at UCLA' },
  { year: '2012', event: 'First international MMAS-8 validation studies published' },
  { year: '2018', event: 'ATLAS platform development begins' },
  { year: '2022', event: 'MAP (Medication Adherence Phenotyping) instrument validated' },
  { year: '2024', event: 'PEACS framework introduced; behavioral phenotype classification system established' },
  { year: '2025', event: 'TESSERA GRC launched' },
  { year: '2026', event: 'Global normative database established across 30+ countries' },
];

// ── CSS (injected once, idempotent) ──────────────────────────────────────────
function _saCons_injectStyles() {
  if (document.getElementById('sc-styles')) return;
  const s = document.createElement('style');
  s.id = 'sc-styles';
  s.textContent = `
    .sc-card{background:var(--mc-surface,#0d1b2e);border:1px solid var(--mc-border,rgba(212,168,67,0.12));border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.18s;}
    .sc-card:hover{border-color:var(--mc-border-b,rgba(212,168,67,0.26));}
    .sc-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid;font-weight:500;white-space:nowrap;}
    .sc-badge-active{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sc-badge-pending{color:#d4a843;border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);}
    .sc-badge-inactive{color:rgba(138,160,184,0.8);border-color:rgba(138,160,184,0.2);background:rgba(138,160,184,0.06);}
    .sc-badge-draft{color:#8b6ff5;border-color:rgba(139,111,245,0.35);background:rgba(139,111,245,0.07);}
    .sc-badge-issued{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sc-badge-expired{color:rgba(138,160,184,0.8);border-color:rgba(138,160,184,0.2);background:rgba(138,160,184,0.06);}
    .sc-chip{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid;margin-right:4px;}
    .sc-chip-map{color:#2ec98a;border-color:rgba(46,201,138,0.4);background:rgba(46,201,138,0.07);}
    .sc-chip-mmas{color:#4e9cf5;border-color:rgba(78,156,245,0.4);background:rgba(78,156,245,0.07);}
    .sc-chip-peacs{color:#8b6ff5;border-color:rgba(139,111,245,0.4);background:rgba(139,111,245,0.07);}
    .sc-action-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid var(--mc-border,rgba(212,168,67,0.12));background:transparent;color:var(--mc-dim,rgba(96,120,152,0.65));cursor:pointer;transition:all 0.12s;}
    .sc-action-btn:hover{background:var(--mc-navy,rgba(212,168,67,0.06));color:var(--mc-text,rgba(205,216,232,0.92));}
    .sc-action-btn-danger:hover{background:rgba(239,68,68,0.09);border-color:rgba(239,68,68,0.4);color:#ef4444;}
    .sc-action-btn-amber{color:#d4a843;border-color:rgba(212,168,67,0.35);}
    .sc-action-btn-amber:hover{background:rgba(212,168,67,0.09);border-color:rgba(212,168,67,0.5);color:#d4a843;}
    .sc-input{width:100%;background:var(--mc-bg2,#0a1527);border:1px solid var(--mc-border,rgba(212,168,67,0.12));color:var(--mc-text,rgba(205,216,232,0.92));font-family:'IBM Plex Mono',monospace;font-size:0.88rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;}
    .sc-input:focus{border-color:rgba(212,168,67,0.4);}
    .sc-label{font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim,rgba(96,120,152,0.65));margin-bottom:5px;display:block;}
    .sc-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10100;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;}
    .sc-modal{background:var(--mc-bg2,#0a1527);border:1px solid var(--mc-border-b,rgba(212,168,67,0.26));border-radius:14px;width:100%;max-width:580px;padding:32px 32px 28px;position:relative;}
    .sc-modal-wide{max-width:720px;}
    .sc-table{width:100%;border-collapse:collapse;font-size:0.84rem;}
    .sc-table th{font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(96,120,152,0.65);padding:10px 12px;text-align:left;border-bottom:1px solid rgba(212,168,67,0.12);white-space:nowrap;}
    .sc-table td{padding:11px 12px;border-bottom:1px solid rgba(212,168,67,0.07);color:rgba(205,216,232,0.92);vertical-align:middle;}
    .sc-table tr:last-child td{border-bottom:none;}
    .sc-table tbody tr:hover td{background:rgba(212,168,67,0.03);}
    .sc-stat-card{background:var(--mc-surface,#0d1b2e);border:1px solid var(--mc-border,rgba(212,168,67,0.12));border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:4px;}
    .sc-subtab{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;padding:7px 16px;border-radius:6px;border:1px solid transparent;cursor:pointer;transition:all 0.15s;background:transparent;}
    .sc-subtab-active{border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);color:#d4a843;}
    .sc-subtab-inactive{color:rgba(96,120,152,0.65);}
    .sc-subtab-inactive:hover{color:rgba(205,216,232,0.92);background:rgba(212,168,67,0.04);}
    .sc-fund-card{background:var(--mc-surface,#0d1b2e);border:1px solid var(--mc-border,rgba(212,168,67,0.12));border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.18s;}
    .sc-fund-card:hover{border-color:rgba(212,168,67,0.26);}
    .sc-progress-track{height:6px;border-radius:3px;background:rgba(255,255,255,0.07);overflow:hidden;}
    .sc-progress-fill{height:100%;border-radius:3px;transition:width 0.5s ease;}
    .sc-timeline-dot{width:10px;height:10px;border-radius:50%;background:#d4a843;flex-shrink:0;margin-top:5px;}
    .sc-letter-preview{font-family:Georgia,serif;font-size:0.88rem;line-height:1.75;color:rgba(205,216,232,0.88);background:#070e1d;border:1px solid rgba(212,168,67,0.12);border-radius:8px;padding:24px 28px;white-space:pre-wrap;}
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _saCons_esc(str) {
  if (typeof _esc === 'function') return _esc(str);
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _saCons_fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function _saCons_today() {
  return new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function _saCons_thisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return start;
}

function _saCons_copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    btn.style.color = _CC.green;
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1800);
  }).catch(() => { if (typeof showToast === 'function') showToast('Copy failed. Select and copy manually.'); });
}

function _saCons_tierBadge(tier) {
  const t = _CONS_TIERS[tier] || _CONS_TIERS[1];
  return `<span class="sc-badge" style="color:${t.color};border-color:${t.border};background:${t.bg};">${_saCons_esc(t.label)}</span>`;
}

function _saCons_instrumentChips(instruments) {
  if (!instruments || !instruments.length) return `<span style="font-size:0.75rem;color:${_CC.dim};">None</span>`;
  return instruments.map(inst => {
    const cls = inst === 'MAP' ? 'sc-chip-map' : inst === 'MMAS-8' ? 'sc-chip-mmas' : 'sc-chip-peacs';
    return `<span class="sc-chip ${cls}">${_saCons_esc(inst)}</span>`;
  }).join('');
}

function _saCons_statusBadge(status, prefix) {
  return `<span class="sc-badge sc-badge-${prefix || ''}${_saCons_esc(status)}">${_saCons_esc(status)}</span>`;
}

function _saCons_regionTag(region) {
  const colors = {
    'Global':          { c:'#d4a843', b:'rgba(212,168,67,0.3)',  bg:'rgba(212,168,67,0.07)' },
    'USA':             { c:'#38bdf8', b:'rgba(56,189,248,0.3)',   bg:'rgba(56,189,248,0.07)' },
    'USA+International':{ c:'#38bdf8', b:'rgba(56,189,248,0.3)', bg:'rgba(56,189,248,0.07)' },
    'LMIC':            { c:'#2ec98a', b:'rgba(46,201,138,0.3)',  bg:'rgba(46,201,138,0.07)' },
    'Latin America':   { c:'#8b6ff5', b:'rgba(139,111,245,0.3)', bg:'rgba(139,111,245,0.07)' },
    'Europe':          { c:'#4e9cf5', b:'rgba(78,156,245,0.3)',  bg:'rgba(78,156,245,0.07)' },
    'France/Francophone': { c:'#4e9cf5', b:'rgba(78,156,245,0.3)', bg:'rgba(78,156,245,0.07)' },
    'Brazil':          { c:'#2ec98a', b:'rgba(46,201,138,0.3)',  bg:'rgba(46,201,138,0.07)' },
    'Denmark/Global':  { c:'#d4a843', b:'rgba(212,168,67,0.3)',  bg:'rgba(212,168,67,0.07)' },
  };
  const col = colors[region] || colors['Global'];
  return `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid ${col.b};background:${col.bg};color:${col.c};white-space:nowrap;">${_saCons_esc(region)}</span>`;
}

// ── Sub-tab navigation render ─────────────────────────────────────────────────
function _saCons_renderSubNav(container) {
  const pendingCount = _saCons_applicationsCache.filter(a => a.status === 'pending').length;
  const appLabel = 'Applications' + (pendingCount > 0
    ? ` <span style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;border-radius:8px;background:${_CC.orange};color:#000;font-size:0.54rem;font-weight:700;margin-left:5px;padding:0 3px;">${pendingCount}</span>`
    : '');
  const tabs = [
    { id: 'members',      label: 'Members'        },
    { id: 'applications', label: appLabel          },
    { id: 'funding',      label: 'Funding Board'  },
    { id: 'letters',      label: 'Letters'        },
    { id: 'impact',       label: 'Impact'         },
    { id: 'registry',     label: 'Registry'       },
    { id: 'exchange',     label: '◎ Exchange'     },
  ];
  return tabs.map(t => `
    <button class="sc-subtab ${t.id === _saCons_activeSubTab ? 'sc-subtab-active' : 'sc-subtab-inactive'}"
      data-tab-id="${t.id}"
      onclick="_saCons_switchTab('${t.id}',_saCons_getContainer())">${t.label}</button>
  `).join('');
}

window._saCons_getContainer = function() {
  return document.getElementById('sc-tab-content');
};

window._saCons_switchTab = function(tabId, contentEl) {
  _saCons_activeSubTab = tabId;
  // Update button states
  document.querySelectorAll('.sc-subtab').forEach(btn => {
    const isActive = btn.textContent.toLowerCase().replace(/\s+/g,'') === tabId.replace(/\s+/g,'');
    // Match by data attribute set during render
    if (btn.dataset.tabId === tabId) {
      btn.className = 'sc-subtab sc-subtab-active';
    } else {
      btn.className = 'sc-subtab sc-subtab-inactive';
    }
  });
  if (!contentEl) contentEl = document.getElementById('sc-tab-content');
  if (!contentEl) return;
  if (tabId === 'members')      _saCons_renderMembers(contentEl);
  if (tabId === 'funding')      _saCons_renderFunding(contentEl);
  if (tabId === 'letters')      _saCons_renderLetters(contentEl);
  if (tabId === 'impact')       _saCons_renderImpact(contentEl);
  if (tabId === 'registry')     _saCons_renderRegistry(contentEl);
  if (tabId === 'applications') _saCons_renderApplications(contentEl);
  if (tabId === 'exchange') {
    if (typeof window.saGrantRenderExchange === 'function') {
      window.saGrantRenderExchange(contentEl);
    } else {
      contentEl.innerHTML = '<div style="padding:24px;font-family:\'IBM Plex Mono\',monospace;font-size:0.80rem;color:rgba(96,120,152,0.65);">Loading exchange…</div>';
      var _exPoll = setInterval(function() {
        if (typeof window.saGrantRenderExchange === 'function') {
          clearInterval(_exPoll);
          window.saGrantRenderExchange(contentEl);
        }
      }, 200);
    }
  }
};

// ── Main shell ────────────────────────────────────────────────────────────────
function _saCons_renderShell(container) {
  const pendingCount = _saCons_applicationsCache.filter(a => a.status === 'pending').length;
  const appLabel = 'Applications' + (pendingCount > 0
    ? ` <span style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;border-radius:8px;background:${_CC.orange};color:#000;font-size:0.54rem;font-weight:700;margin-left:5px;padding:0 3px;">${pendingCount}</span>`
    : '');
  const tabs = [
    { id: 'members',      label: 'Members'        },
    { id: 'applications', label: appLabel          },
    { id: 'funding',      label: 'Funding Board'  },
    { id: 'letters',      label: 'Letters'        },
    { id: 'impact',       label: 'Impact'         },
    { id: 'registry',     label: 'Registry'       },
    { id: 'exchange',     label: '◎ Exchange'     },
  ];

  container.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_CC.amber};margin-bottom:4px;">Mission Control · Consortium</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.6rem;font-weight:300;color:${_CC.text};line-height:1.2;">Scala Carta Foundation</div>
        <div style="font-size:0.84rem;color:${_CC.muted};margin-top:5px;">TESSERA GRC — membership applications, registry, funding intelligence, letters of support, and global impact metrics.</div>
      </div>
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid ${_CC.border};">
      ${tabs.map(t => `
        <button class="sc-subtab ${t.id === _saCons_activeSubTab ? 'sc-subtab-active' : 'sc-subtab-inactive'}"
          data-tab-id="${t.id}"
          onclick="_saCons_switchTab('${t.id}',document.getElementById('sc-tab-content'))">${t.label}</button>
      `).join('')}
    </div>

    <div id="sc-tab-content"></div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1: MEMBERS
// ═════════════════════════════════════════════════════════════════════════════

function _saCons_renderMembers(container) {
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.90rem;padding:20px 0;">Loading members…</div>`;
  Promise.all([_saCons_loadMembers(), _saTessera_load()])
    .then(() => _saCons_renderMembersUI(container));
}

async function _saCons_loadMembers() {
  try {
    const snap = await firebase.database().ref('consortium_members').once('value');
    const raw  = snap.val() || {};
    _saCons_membersCache = Object.entries(raw)
      .map(([k, v]) => ({ _key: k, ...v }))
      .sort((a, b) => (a.joined_at || 0) - (b.joined_at || 0));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Error loading members: ' + e.message, 3000);
  }
}

function _saCons_renderMembersUI(container) {
  // ── Merge both collections ────────────────────────────────────────────────
  const tierCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0 };
  _saCons_membersCache.forEach(m => { if (tierCounts[m.tier] !== undefined) tierCounts[m.tier]++; });

  const memberTileKeySet = new Set(_saCons_membersCache.filter(m => m.tessera_tile_key).map(m => m.tessera_tile_key));
  const orphanTiles      = _saTessera_cache.filter(t => !t.member_key && !memberTileKeySet.has(t._key));
  const onMosaicCount    = _saCons_membersCache.filter(m => m.tessera_tile_key).length;
  const activeCount      = _saCons_membersCache.filter(m => m.status === 'active').length;

  const filtered = _saCons_tierFilter === 'all'
    ? _saCons_membersCache
    : _saCons_membersCache.filter(m => String(m.tier) === String(_saCons_tierFilter));

  // ── Stat cards ────────────────────────────────────────────────────────────
  const tierStatCards = Object.entries(tierCounts).map(([tier, count]) => {
    const t = _CONS_TIERS[tier];
    return `<div class="sc-stat-card" style="border-color:${t.border};">
      <div style="font-size:1.4rem;font-weight:700;color:${t.color};font-family:'IBM Plex Mono',monospace;">${count}</div>
      <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">${_saCons_esc(t.label)}</div>
    </div>`;
  }).join('');

  // ── Member rows ───────────────────────────────────────────────────────────
  const memberRows = filtered.map(m => {
    const flag      = _CONS_FLAGS[m.country] || '🌐';
    const lmicBadge = m.lmic_tier
      ? `<span style="display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid rgba(249,115,22,0.35);background:rgba(249,115,22,0.07);color:#f97316;white-space:nowrap;margin-left:5px;">LMIC</span>` : '';
    const mosaicCell = m.tessera_tile_key
      ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);color:${_CC.amber};cursor:pointer;white-space:nowrap;" onclick="_saTessera_edit('${_saCons_esc(m.tessera_tile_key)}')">⬡ On Mosaic</span>`
      : `<span style="color:${_CC.dim};font-size:0.80rem;">—</span>`;
    const mosaicBtn = m.tessera_tile_key
      ? `<button class="sc-action-btn sc-action-btn-amber" onclick="_saTessera_edit('${_saCons_esc(m.tessera_tile_key)}')">Edit Tile</button>`
      : `<button class="sc-action-btn sc-action-btn-amber" onclick="_saCons_pushToMosaic('${_saCons_esc(m._key)}')">Mosaic ✦</button>`;
    return `<tr>
      <td>
        <div style="font-weight:600;color:${_CC.text};">${_saCons_esc(m.name || '—')}${lmicBadge}</div>
        <div style="font-size:0.76rem;color:${_CC.dim};margin-top:2px;">${_saCons_esc(m.contact_email || '')}</div>
      </td>
      <td style="color:${_CC.muted};">${_saCons_esc(m.institution || '—')}</td>
      <td style="font-size:0.90rem;">${flag} <span style="color:${_CC.muted};font-size:0.82rem;">${_saCons_esc(m.country || '—')}</span></td>
      <td>${_saCons_tierBadge(m.tier)}</td>
      <td>${_saCons_statusBadge(m.status || 'active', '')}</td>
      <td>${mosaicCell}</td>
      <td style="color:${_CC.dim};font-size:0.80rem;white-space:nowrap;">${_saCons_fmtDate(m.joined_at)}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="sc-action-btn" onclick="_saCons_openEditMember('${_saCons_esc(m._key)}')">Edit</button>
          ${mosaicBtn}
          ${m.workspace_key
            ? `<button class="sc-action-btn" style="opacity:0.4;cursor:default;font-size:0.66rem;" title="Workspace: ${_saCons_esc(m.workspace_key)}" disabled>WS ✓</button>`
            : `<button class="sc-action-btn" style="color:#38bdf8;border-color:rgba(56,189,248,0.35);" onmouseover="this.style.background='rgba(56,189,248,0.09)'" onmouseout="this.style.background='transparent'" onclick="_saCons_provisionWorkspace('${_saCons_esc(m._key)}')">Workspace</button>`}
          <button class="sc-action-btn sc-action-btn-danger" onclick="_saCons_deactivateMember('${_saCons_esc(m._key)}','${_saCons_esc(m.name)}')">Deactivate</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Orphan tile rows (on mosaic but no member record) ─────────────────────
  const orphanRows = (_saCons_tierFilter === 'all' ? orphanTiles : []).map(tile => {
    const flag     = _CONS_FLAGS[tile.country] || '🌐';
    const isIndiv  = new Set(['founder','affiliate','student']).has(tile.tier);
    const dispName = isIndiv ? (tile.name || '—') : (tile.institution || tile.name || '—');
    const dispInst = isIndiv ? (tile.affiliation || '—') : '—';
    const tierNum  = _TESSERA_TIER_TO_CONS[tile.tier] ?? 1;
    return `<tr style="background:rgba(212,168,67,0.03);">
      <td>
        <div style="font-weight:600;color:${_CC.text};">${_saCons_esc(dispName)}</div>
        <div style="font-size:0.68rem;color:${_CC.dim};margin-top:2px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.06em;">tile only · no member record</div>
      </td>
      <td style="color:${_CC.muted};">${_saCons_esc(dispInst)}</td>
      <td style="font-size:0.90rem;">${flag} <span style="color:${_CC.muted};font-size:0.82rem;">${_saCons_esc(tile.country || '—')}</span></td>
      <td>${_saCons_tierBadge(tierNum)}</td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 6px;border-radius:3px;border:1px solid rgba(96,120,152,0.25);color:${_CC.dim};">Tile Only</span></td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);color:${_CC.amber};white-space:nowrap;">⬡ On Mosaic</span></td>
      <td style="color:${_CC.dim};font-size:0.80rem;white-space:nowrap;">${tile.joinedAt ? new Date(tile.joinedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—'}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="sc-action-btn sc-action-btn-amber" onclick="_saTessera_edit('${_saCons_esc(tile._key)}')">Edit Tile</button>
          <button class="sc-action-btn" style="color:#38bdf8;border-color:rgba(56,189,248,0.35);" onmouseover="this.style.background='rgba(56,189,248,0.09)'" onmouseout="this.style.background='transparent'" onclick="_saTessera_registerMember('${_saCons_esc(tile._key)}')">Register +</button>
          <button class="sc-action-btn sc-action-btn-danger" onclick="_saTessera_remove('${_saCons_esc(tile._key)}','${_saCons_esc(dispName)}')">Remove</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const allRows = (memberRows + orphanRows) ||
    `<tr><td colspan="8" style="text-align:center;padding:40px;color:${_CC.dim};font-size:0.88rem;">No members found${_saCons_tierFilter !== 'all' ? ' for this tier' : '. Add your first consortium member.'}</td></tr>`;

  const tierOptions = `<option value="all">All Tiers</option>` +
    Object.entries(_CONS_TIERS).map(([id, t]) => `<option value="${id}" ${_saCons_tierFilter === id ? 'selected' : ''}>${t.label}</option>`).join('');

  // ── LMIC pending banner ───────────────────────────────────────────────────
  const lmicPending = _saCons_membersCache.filter(m => m.status === 'pending' && m.lmic_eligible);
  const lmicPendingBanner = lmicPending.length ? `
    <div style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.30);border-radius:9px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:1.1rem;flex-shrink:0;margin-top:1px;">🌍</div>
      <div style="flex:1;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;font-weight:600;color:#f97316;margin-bottom:4px;">${lmicPending.length} LMIC Application${lmicPending.length !== 1 ? 's' : ''} Awaiting Review</div>
        <div style="font-size:0.78rem;color:rgba(138,160,184,0.85);line-height:1.55;">${lmicPending.map(m => `<strong style="color:rgba(205,216,232,0.92);">${_saCons_esc(m.name || '—')}</strong> · ${_saCons_esc(m.institution || '—')} · ${_saCons_esc(m.country || '—')}`).join(' &nbsp;|&nbsp; ')}</div>
        <div style="font-size:0.72rem;color:rgba(249,115,22,0.7);margin-top:5px;">Edit each member, set status to Active, and check "Grant LMIC Researcher Access Tier" to provision fee-waived researcher access.</div>
      </div>
    </div>` : '';

  // ── Add tile form (for standalone tiles, e.g. founder) ────────────────────
  const tileCountryOpts = _CONS_COUNTRIES.map(c => `<option value="${_saCons_esc(c)}">${_saCons_esc(c)}</option>`).join('');
  const tileTierOpts    = Object.entries(_TESSERA_TIERS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');

  // ── Live mosaic link ──────────────────────────────────────────────────────
  const mosaicLink = `
    <div style="background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.14);border-radius:9px;padding:10px 16px;display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="font-size:0.78rem;color:${_CC.muted};">Live mosaic:</span>
      <a href="https://scalacartafoundation.org/mosaic/" target="_blank" rel="noopener"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.06em;color:${_CC.amber};text-decoration:none;">
        scalacartafoundation.org/mosaic/ ↗
      </a>
      <span style="font-size:0.76rem;color:${_CC.dim};">${onMosaicCount} of ${_saCons_membersCache.length} member${_saCons_membersCache.length !== 1 ? 's' : ''} on mosaic${orphanTiles.length ? ` · ${orphanTiles.length} tile-only` : ''}</span>
    </div>`;

  container.innerHTML = lmicPendingBanner + mosaicLink + `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:22px;">
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.amber};font-family:'IBM Plex Mono',monospace;">${_saCons_membersCache.length}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Total Members</div>
      </div>
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.green};font-family:'IBM Plex Mono',monospace;">${activeCount}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Active</div>
      </div>
      <div class="sc-stat-card" style="border-color:rgba(212,168,67,0.3);">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.amber};font-family:'IBM Plex Mono',monospace;">${onMosaicCount}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">On Mosaic</div>
      </div>
      ${tierStatCards}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <label class="sc-label" style="margin:0;">Filter by Tier:</label>
        <select class="sc-input" style="width:auto;cursor:pointer;padding:6px 10px;"
          onchange="_saCons_tierFilter=this.value;_saCons_renderMembersUI(document.getElementById('sc-tab-content'));">
          ${tierOptions}
        </select>
        <span style="font-size:0.80rem;color:${_CC.dim};">${filtered.length} member${filtered.length !== 1 ? 's' : ''}${_saCons_tierFilter === 'all' && orphanTiles.length ? ` + ${orphanTiles.length} tile-only` : ''}</span>
      </div>
      <button onclick="_saCons_openAddMember()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:8px 18px;border-radius:7px;cursor:pointer;
               background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
        onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
        + Add Member
      </button>
    </div>

    <div style="overflow-x:auto;border:1px solid ${_CC.border};border-radius:10px;margin-bottom:28px;">
      <table class="sc-table">
        <thead>
          <tr>
            <th>Name / Email</th>
            <th>Institution</th>
            <th>Country</th>
            <th>Tier</th>
            <th>Status</th>
            <th>Mosaic</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${allRows}</tbody>
      </table>
    </div>

    <!-- Standalone tile quick-add (for founder tiles and edge cases) -->
    <details style="margin-bottom:12px;">
      <summary style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_CC.dim};cursor:pointer;padding:10px 14px;background:${_CC.surface};border:1px solid ${_CC.border};border-radius:8px;list-style:none;display:flex;align-items:center;gap:8px;">
        <span style="color:${_CC.amber};">⬡</span> Add Standalone Tile (no member record required)
      </summary>
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-top:none;border-radius:0 0 8px 8px;padding:18px 20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:flex-end;">
          <div>
            <label class="sc-label" id="sc-tess-name-label" for="sc-tess-name">Institution / Name <span style="color:${_CC.red};">*</span></label>
            <input id="sc-tess-name" class="sc-input" type="text" placeholder="University of Porto" />
          </div>
          <div>
            <label class="sc-label" for="sc-tess-country">Country</label>
            <select id="sc-tess-country" class="sc-input" style="cursor:pointer;" onchange="_saTessera_updateFlag(this.value)">${tileCountryOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-tess-tier">Tier</label>
            <select id="sc-tess-tier" class="sc-input" style="cursor:pointer;" onchange="_saTessera_onTierChange(this.value)">${tileTierOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-tess-flag">Flag</label>
            <input id="sc-tess-flag" class="sc-input" type="text" placeholder="🇵🇹" maxlength="4" style="font-size:1.1rem;" />
          </div>
          <button id="sc-tess-add-btn" onclick="_saTessera_add()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                   padding:9px 20px;border-radius:7px;cursor:pointer;white-space:nowrap;
                   background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
            + Add Tile
          </button>
        </div>
        <div id="sc-tess-individual-fields" style="display:none;margin-top:10px;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
          <div><label class="sc-label" for="sc-tess-role">Role / Title</label><input id="sc-tess-role" class="sc-input" type="text" placeholder="PhD Candidate" /></div>
          <div><label class="sc-label" for="sc-tess-affiliation">Affiliation</label><input id="sc-tess-affiliation" class="sc-input" type="text" placeholder="University of Porto" /></div>
          <div><label class="sc-label" for="sc-tess-orcid">ORCID</label><input id="sc-tess-orcid" class="sc-input" type="text" placeholder="0000-0000-0000-0000" /></div>
          <div><label class="sc-label" for="sc-tess-linkedin">LinkedIn URL</label><input id="sc-tess-linkedin" class="sc-input" type="text" placeholder="https://linkedin.com/in/…" /></div>
        </div>
        <div id="sc-tess-err" style="display:none;margin-top:10px;font-size:0.80rem;color:${_CC.red};"></div>
      </div>
    </details>`;

  // Pre-fill flag for default country selection
  const defaultCountry = document.getElementById('sc-tess-country')?.value;
  if (defaultCountry) _saTessera_updateFlag(defaultCountry);
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
window._saCons_openAddMember = function() {
  _saCons_injectStyles();
  const countryOpts = _CONS_COUNTRIES.map(c => `<option value="${_saCons_esc(c)}">${_saCons_esc(c)}</option>`).join('');
  const tierOpts = Object.entries(_CONS_TIERS).map(([id, t]) => `<option value="${id}">${t.label} (Tier ${id})</option>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-add-member-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Add Consortium Member">
      <button onclick="document.getElementById('sc-add-member-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">New Member</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:${_CC.text};margin-bottom:22px;">Add Consortium Member</div>

      <div style="display:grid;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-add-name">Full Name <span style="color:${_CC.red};">*</span></label>
            <input id="sc-add-name" class="sc-input" type="text" placeholder="Dr. Jane Smith" />
          </div>
          <div>
            <label class="sc-label" for="sc-add-email">Contact Email</label>
            <input id="sc-add-email" class="sc-input" type="email" placeholder="researcher@university.edu" />
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-add-institution">Institution <span style="color:${_CC.red};">*</span></label>
          <input id="sc-add-institution" class="sc-input" type="text" placeholder="University of Example" />
        </div>
        <div>
          <label class="sc-label" for="sc-add-study">Study Title</label>
          <input id="sc-add-study" class="sc-input" type="text" placeholder="Validation of MAP instrument in…" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-add-country">Country</label>
            <select id="sc-add-country" class="sc-input" style="cursor:pointer;">${countryOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-add-tier">Membership Tier</label>
            <select id="sc-add-tier" class="sc-input" style="cursor:pointer;">${tierOpts}</select>
          </div>
        </div>
        <div>
          <label class="sc-label">Instruments</label>
          <div style="display:flex;gap:16px;margin-top:4px;">
            ${['MAP','MMAS-8','PEACS'].map(inst => `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:0.85rem;color:var(--mc-text,rgba(205,216,232,0.92));">
                <input type="checkbox" id="sc-add-inst-${inst.replace(/[^a-z0-9]/gi,'').toLowerCase()}" value="${inst}"
                  style="width:14px;height:14px;cursor:pointer;accent-color:${_CC.amber};" />
                ${inst}
              </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-add-status">Status</label>
          <select id="sc-add-status" class="sc-input" style="cursor:pointer;">
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div id="sc-add-member-error" style="display:none;margin-top:14px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-add-member-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-add-member-submit" onclick="_saCons_submitAddMember()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Add Member
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { document.getElementById('sc-add-name')?.focus(); }, 60);
};

window._saCons_submitAddMember = async function() {
  const name        = (document.getElementById('sc-add-name')?.value || '').trim();
  const email       = (document.getElementById('sc-add-email')?.value || '').trim();
  const institution = (document.getElementById('sc-add-institution')?.value || '').trim();
  const study       = (document.getElementById('sc-add-study')?.value || '').trim();
  const country     = document.getElementById('sc-add-country')?.value || '';
  const tier        = parseInt(document.getElementById('sc-add-tier')?.value || '1', 10);
  const status      = document.getElementById('sc-add-status')?.value || 'active';
  const errEl       = document.getElementById('sc-add-member-error');
  const submitBtn   = document.getElementById('sc-add-member-submit');

  if (!name) {
    errEl.textContent = 'Full name is required.';
    errEl.style.display = 'block';
    document.getElementById('sc-add-name')?.focus();
    return;
  }
  if (!institution) {
    errEl.textContent = 'Institution is required.';
    errEl.style.display = 'block';
    document.getElementById('sc-add-institution')?.focus();
    return;
  }

  const instruments = [];
  ['MAP','MMAS-8','PEACS'].forEach(inst => {
    const id = 'sc-add-inst-' + inst.replace(/[^a-z0-9]/gi,'').toLowerCase();
    if (document.getElementById(id)?.checked) instruments.push(inst);
  });

  const data = {
    name, email, institution, study_title: study,
    country, tier, instruments, status,
    contact_email: email,
    joined_at: Date.now(),
    contribution_count: 0,
  };

  submitBtn.textContent = 'Adding…';
  submitBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    await firebase.database().ref('consortium_members').push(data);
    document.getElementById('sc-add-member-overlay')?.remove();
    if (typeof showToast === 'function') showToast('✓ Member added to consortium.', 2200);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('consortium_member_added', { name, institution, tier });
    await _saCons_loadMembers();
    _saCons_renderMembersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    submitBtn.textContent = 'Add Member';
    submitBtn.disabled = false;
  }
};

// ── Edit Member Modal ─────────────────────────────────────────────────────────
window._saCons_openEditMember = function(key) {
  const m = _saCons_membersCache.find(x => x._key === key);
  if (!m) { if (typeof showToast === 'function') showToast('Member not found.'); return; }

  _saCons_injectStyles();
  const countryOpts = _CONS_COUNTRIES.map(c =>
    `<option value="${_saCons_esc(c)}" ${m.country === c ? 'selected' : ''}>${_saCons_esc(c)}</option>`
  ).join('');
  const tierOpts = Object.entries(_CONS_TIERS).map(([id, t]) =>
    `<option value="${id}" ${String(m.tier) === id ? 'selected' : ''}>${t.label} (Tier ${id})</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-edit-member-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Edit Member">
      <button onclick="document.getElementById('sc-edit-member-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">Edit Member</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:${_CC.text};margin-bottom:22px;">${_saCons_esc(m.name)}</div>

      <div style="display:grid;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-edit-name">Full Name</label>
            <input id="sc-edit-name" class="sc-input" type="text" value="${_saCons_esc(m.name || '')}" />
          </div>
          <div>
            <label class="sc-label" for="sc-edit-email">Contact Email</label>
            <input id="sc-edit-email" class="sc-input" type="email" value="${_saCons_esc(m.contact_email || m.email || '')}" />
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-edit-institution">Institution</label>
          <input id="sc-edit-institution" class="sc-input" type="text" value="${_saCons_esc(m.institution || '')}" />
        </div>
        <div>
          <label class="sc-label" for="sc-edit-study">Study Title</label>
          <input id="sc-edit-study" class="sc-input" type="text" value="${_saCons_esc(m.study_title || '')}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-edit-country">Country</label>
            <select id="sc-edit-country" class="sc-input" style="cursor:pointer;">${countryOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-edit-tier">Membership Tier</label>
            <select id="sc-edit-tier" class="sc-input" style="cursor:pointer;">${tierOpts}</select>
          </div>
        </div>
        <div>
          <label class="sc-label">Instruments</label>
          <div style="display:flex;gap:16px;margin-top:4px;">
            ${['MAP','MMAS-8','PEACS'].map(inst => `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:0.85rem;color:var(--mc-text,rgba(205,216,232,0.92));">
                <input type="checkbox" id="sc-edit-inst-${inst.replace(/[^a-z0-9]/gi,'').toLowerCase()}" value="${inst}"
                  ${(m.instruments || []).includes(inst) ? 'checked' : ''}
                  style="width:14px;height:14px;cursor:pointer;accent-color:${_CC.amber};" />
                ${inst}
              </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-edit-status">Status</label>
          <select id="sc-edit-status" class="sc-input" style="cursor:pointer;">
            <option value="active"   ${m.status === 'active'   ? 'selected' : ''}>Active</option>
            <option value="pending"  ${m.status === 'pending'  ? 'selected' : ''}>Pending</option>
            <option value="inactive" ${m.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>

        ${/* LMIC access tier — auto-checked when country is LMIC-classified */''}
        <div style="background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.22);border-radius:8px;padding:12px 14px;">
          <label style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;">
            <input type="checkbox" id="sc-edit-lmic-tier"
              ${(m.lmic_tier || (typeof isLMICCountry === 'function' && isLMICCountry(m.country))) ? 'checked' : ''}
              style="width:15px;height:15px;margin-top:2px;cursor:pointer;accent-color:#f97316;flex-shrink:0;" />
            <div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;font-weight:600;color:#f97316;">
                Grant LMIC Researcher Access Tier
              </div>
              <div style="font-size:0.74rem;color:${_CC.muted};margin-top:3px;line-height:1.5;">
                Waives all platform fees and elevates to full researcher capabilities
                (unlimited exports, standard PEACS, publication license waived).
                Writes to <code style="font-size:0.70rem;color:${_CC.dim};">lmic_access/{uid}</code> in Firebase.
              </div>
            </div>
          </label>
        </div>
      </div>

      <div id="sc-edit-member-error" style="display:none;margin-top:14px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-edit-member-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-edit-member-save" onclick="_saCons_saveEditMember('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Save Changes
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window._saCons_saveEditMember = async function(key) {
  const name        = (document.getElementById('sc-edit-name')?.value || '').trim();
  const email       = (document.getElementById('sc-edit-email')?.value || '').trim();
  const institution = (document.getElementById('sc-edit-institution')?.value || '').trim();
  const study       = (document.getElementById('sc-edit-study')?.value || '').trim();
  const country     = document.getElementById('sc-edit-country')?.value || '';
  const tier        = parseInt(document.getElementById('sc-edit-tier')?.value || '1', 10);
  const status      = document.getElementById('sc-edit-status')?.value || 'active';
  const lmicTier    = !!(document.getElementById('sc-edit-lmic-tier')?.checked);
  const errEl       = document.getElementById('sc-edit-member-error');
  const saveBtn     = document.getElementById('sc-edit-member-save');

  const instruments = [];
  ['MAP','MMAS-8','PEACS'].forEach(inst => {
    const id = 'sc-edit-inst-' + inst.replace(/[^a-z0-9]/gi,'').toLowerCase();
    if (document.getElementById(id)?.checked) instruments.push(inst);
  });

  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    const db = firebase.database();

    // 1. Update consortium member record
    await db.ref('consortium_members/' + key).update({
      name, contact_email: email, email, institution, study_title: study,
      country, tier, instruments, status, lmic_tier: lmicTier,
    });

    // 2. Provision or revoke LMIC access tier in Firebase (lmic_access/{uid})
    //    key === uid (consortium_members are keyed by firebase auth uid)
    if (lmicTier && status === 'active') {
      // Find existing TESSERA ID from members cache if available
      const cached = _saCons_membersCache.find(x => x._key === key);
      const tesseraId = (cached && cached.tessera_id) || '';
      await db.ref('lmic_access/' + key).set({
        active:           true,
        country:          country,
        institution:      institution,
        tessera_grc_id:   tesseraId,
        granted_by:  'superadmin',
        granted_at:  Date.now(),
        email:       email,
      });
      if (typeof atlasAuditLog === 'function') atlasAuditLog('lmic_access_granted', { uid: key, country, institution });
    } else if (!lmicTier) {
      // Revoke: mark inactive rather than delete to preserve audit trail
      const existing = await db.ref('lmic_access/' + key).once('value');
      if (existing.val()) {
        await db.ref('lmic_access/' + key + '/active').set(false);
        if (typeof atlasAuditLog === 'function') atlasAuditLog('lmic_access_revoked', { uid: key });
      }
    }

    document.getElementById('sc-edit-member-overlay')?.remove();
    const lmicNote = lmicTier && status === 'active' ? ' LMIC researcher access provisioned.' : '';
    if (typeof showToast === 'function') showToast('✓ Member updated.' + lmicNote, 2800);
    await _saCons_loadMembers();
    _saCons_renderMembersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = false;
  }
};

window._saCons_deactivateMember = async function(key, name) {
  if (!confirm(`Deactivate consortium member "${name}"?\n\nTheir status will be set to inactive. You can reactivate them by editing the record.`)) return;
  try {
    await firebase.database().ref('consortium_members/' + key + '/status').set('inactive');
    if (typeof showToast === 'function') showToast(`✓ "${name}" deactivated.`, 2500);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('consortium_member_deactivated', { key, name });
    await _saCons_loadMembers();
    _saCons_renderMembersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Deactivate failed: ' + e.message, 3000);
  }
};

// ── Push Member to Tessera Mosaic ─────────────────────────────────────────────
window._saCons_pushToMosaic = function(key) {
  const m = _saCons_membersCache.find(x => x._key === key);
  if (!m) { if (typeof showToast === 'function') showToast('Member not found.'); return; }
  if (m.tessera_tile_key) { if (typeof showToast === 'function') showToast('Already on mosaic.', 2000); return; }

  _saCons_injectStyles();

  const tierStr  = _CONS_TIER_TO_TESSERA[m.tier] || 'affiliate';
  const isIndiv  = (m.tier === 3 || m.tier === 4);
  const defName  = isIndiv ? (m.name || '') : (m.institution || m.name || '');
  const flag     = _CONS_FLAGS[m.country] || '';

  const countryOpts = _CONS_COUNTRIES.map(c =>
    `<option value="${_saCons_esc(c)}" ${m.country === c ? 'selected' : ''}>${_saCons_esc(c)}</option>`
  ).join('');
  const tierOpts = Object.entries(_TESSERA_TIERS).map(([k, t]) =>
    `<option value="${k}" ${k === tierStr ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-push-mosaic-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Add to Tessera Mosaic">
      <button onclick="document.getElementById('sc-push-mosaic-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">Add to Tessera Mosaic</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:300;color:${_CC.text};margin-bottom:20px;">${_saCons_esc(m.name || m.institution || '—')}</div>

      <div style="display:grid;gap:14px;">
        <div>
          <label class="sc-label" for="sc-pm-name">${isIndiv ? 'Full Name' : 'Institution / Name'} <span style="color:${_CC.red};">*</span></label>
          <input id="sc-pm-name" class="sc-input" type="text" value="${_saCons_esc(defName)}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pm-tier">Tier</label>
            <select id="sc-pm-tier" class="sc-input" style="cursor:pointer;" onchange="_saCons_pmOnTierChange(this.value)">${tierOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-pm-country">Country</label>
            <select id="sc-pm-country" class="sc-input" style="cursor:pointer;"
              onchange="document.getElementById('sc-pm-flag').value=(_CONS_FLAGS[this.value]||'')">
              <option value="">— select —</option>${countryOpts}
            </select>
          </div>
        </div>
        <div id="sc-pm-individual-fields" style="display:${isIndiv?'grid':'none'};grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pm-role">Role / Title</label>
            <input id="sc-pm-role" class="sc-input" type="text" placeholder="e.g. Associate Professor" />
          </div>
          <div>
            <label class="sc-label" for="sc-pm-affiliation">Affiliation</label>
            <input id="sc-pm-affiliation" class="sc-input" type="text" value="${_saCons_esc(m.institution || '')}" />
          </div>
        </div>
        <div id="sc-pm-links-fields" style="display:${isIndiv?'grid':'none'};grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pm-orcid">ORCID</label>
            <input id="sc-pm-orcid" class="sc-input" type="text" value="${_saCons_esc(m.orcid||'')}" placeholder="0000-0000-0000-0000" />
          </div>
          <div>
            <label class="sc-label" for="sc-pm-linkedin">LinkedIn URL</label>
            <input id="sc-pm-linkedin" class="sc-input" type="text" value="${_saCons_esc(m.linkedin||'')}" placeholder="https://linkedin.com/in/…" />
          </div>
        </div>
        <input id="sc-pm-flag" type="hidden" value="${_saCons_esc(flag)}" />
      </div>

      <div id="sc-pm-err" style="display:none;margin-top:12px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-push-mosaic-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-pm-submit" onclick="_saCons_submitPushToMosaic('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Add to Mosaic
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { document.getElementById('sc-pm-name')?.focus(); }, 60);
};

window._saCons_pmOnTierChange = function(tier) {
  const isIndiv = new Set(['student','affiliate','founder']).has(tier);
  const f = document.getElementById('sc-pm-individual-fields');
  const l = document.getElementById('sc-pm-links-fields');
  if (f) f.style.display = isIndiv ? 'grid' : 'none';
  if (l) l.style.display = isIndiv ? 'grid' : 'none';
};

window._saCons_submitPushToMosaic = async function(memberKey) {
  const name        = (document.getElementById('sc-pm-name')?.value        || '').trim();
  const tier        = document.getElementById('sc-pm-tier')?.value         || 'affiliate';
  const country     = document.getElementById('sc-pm-country')?.value      || '';
  const flag        = (document.getElementById('sc-pm-flag')?.value        || '') || (_CONS_FLAGS[country] || '');
  const role        = (document.getElementById('sc-pm-role')?.value        || '').trim();
  const affiliation = (document.getElementById('sc-pm-affiliation')?.value || '').trim();
  const orcid       = (document.getElementById('sc-pm-orcid')?.value       || '').trim();
  const linkedin    = (document.getElementById('sc-pm-linkedin')?.value    || '').trim();
  const errEl       = document.getElementById('sc-pm-err');
  const btn         = document.getElementById('sc-pm-submit');

  if (!name) {
    errEl.textContent = 'Name is required.';
    errEl.style.display = 'block';
    document.getElementById('sc-pm-name')?.focus();
    return;
  }
  errEl.style.display = 'none';
  btn.textContent = 'Adding…';
  btn.disabled = true;

  const record = { name, country, countryFlag: flag, tier, joinedAt: Date.now() };
  if (role)        record.role        = role;
  if (affiliation) record.affiliation = affiliation;
  if (orcid)       record.orcid       = orcid;
  if (linkedin)    record.linkedin    = linkedin;

  try {
    const db = firebase.database();
    const tileRef = await db.ref('tessera_tiles').push(record);
    await db.ref('consortium_members/' + memberKey + '/tessera_tile_key').set(tileRef.key);
    document.getElementById('sc-push-mosaic-overlay')?.remove();
    if (typeof showToast === 'function') showToast(`✓ "${name}" added to the Tessera mosaic.`, 3000);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('tessera_tile_added', { memberKey, tileKey: tileRef.key, name });
    await _saCons_loadMembers();
    _saCons_renderMembersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Failed: ' + e.message;
    errEl.style.display = 'block';
    btn.textContent = 'Add to Mosaic';
    btn.disabled = false;
  }
};

// ── Provision ATLAS Workspace for a TESSERA Member ───────────────────────────
window._saCons_provisionWorkspace = function(key) {
  const m = _saCons_membersCache.find(x => x._key === key);
  if (!m) { if (typeof showToast === 'function') showToast('Member not found.'); return; }
  if (m.workspace_key) { if (typeof showToast === 'function') showToast(`Workspace already provisioned: ${m.workspace_key}`, 2500); return; }

  _saCons_injectStyles();

  const tierToRole   = { 1:'pi', 2:'researcher', 3:'researcher', 4:'student', 5:'researcher' };
  const defaultRole  = tierToRole[m.tier] || 'researcher';
  const tierStr      = _CONS_TIER_TO_TESSERA[m.tier] || 'affiliate';
  const nameParts    = (m.name || '').trim().split(' ');
  const defaultFname = nameParts[0] || '';
  const defaultLname = nameParts.slice(1).join(' ') || '';

  const roleOpts = [
    ['student','Student'],['researcher','Researcher'],['clinician','Clinician'],
    ['pi','PI · Multi-Site'],['observer','Observer'],
    ['institution_academic','Institution · Academic'],
    ['institution_health','Institution · Health System'],
    ['institution_amc','Institution · Academic Med Ctr'],
  ].map(([v, l]) => `<option value="${v}" ${v === defaultRole ? 'selected' : ''}>${l}</option>`).join('');

  const regionOpts = [
    ['us','US — Virginia (default)'],['eu','EU — Frankfurt (GDPR)'],['uae','UAE — Abu Dhabi'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-prov-ws-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal sc-modal-wide" role="dialog" aria-modal="true" aria-label="Provision Workspace">
      <button onclick="document.getElementById('sc-prov-ws-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:#38bdf8;margin-bottom:6px;">Provision ATLAS Workspace</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:300;color:${_CC.text};margin-bottom:4px;">${_saCons_esc(m.name || '—')}</div>
      <div style="font-size:0.78rem;color:${_CC.dim};margin-bottom:20px;">${_saCons_esc(m.institution || '')}${m.country ? ' · ' + _saCons_esc(m.country) : ''}</div>

      <div style="display:grid;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1.6fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pw-fname">First Name</label>
            <input id="sc-pw-fname" class="sc-input" type="text" value="${_saCons_esc(defaultFname)}" />
          </div>
          <div>
            <label class="sc-label" for="sc-pw-lname">Last Name</label>
            <input id="sc-pw-lname" class="sc-input" type="text" value="${_saCons_esc(defaultLname)}" />
          </div>
          <div>
            <label class="sc-label" for="sc-pw-email">Email <span style="color:${_CC.red};">*</span></label>
            <input id="sc-pw-email" class="sc-input" type="email" value="${_saCons_esc(m.contact_email || m.email || '')}" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pw-role">Role <span style="color:${_CC.red};">*</span></label>
            <select id="sc-pw-role" class="sc-input" style="cursor:pointer;">${roleOpts}</select>
          </div>
          <div>
            <label class="sc-label" for="sc-pw-region">Data Region</label>
            <select id="sc-pw-region" class="sc-input" style="cursor:pointer;">${regionOpts}</select>
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-pw-inst">Institution <span style="color:${_CC.red};">*</span></label>
          <input id="sc-pw-inst" class="sc-input" type="text" value="${_saCons_esc(m.institution || '')}" />
        </div>
        <div>
          <label class="sc-label" for="sc-pw-study">Study Title <span style="color:${_CC.dim};font-weight:400;">(optional)</span></label>
          <input id="sc-pw-study" class="sc-input" type="text" value="${_saCons_esc(m.study_title || '')}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-pw-expiry">Key Expiry <span style="color:${_CC.dim};font-weight:400;">(optional)</span></label>
            <input id="sc-pw-expiry" class="sc-input" type="date" />
          </div>
          <div>
            <label class="sc-label">PEACS Dimensions</label>
            <div style="display:flex;gap:14px;margin-top:6px;">
              ${['base','mvmt','strata'].map(d => `
                <label style="display:flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_CC.muted};cursor:pointer;">
                  <input type="checkbox" id="sc-pw-dim-${d}" checked style="accent-color:${_CC.amber};width:13px;height:13px;"> ${d.toUpperCase()}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div style="background:rgba(56,189,248,0.04);border:1px solid rgba(56,189,248,0.18);border-radius:8px;padding:11px 13px;font-size:0.76rem;color:${_CC.muted};line-height:1.5;">
          TESSERA tier <strong style="color:#38bdf8;">${_saCons_esc(tierStr)}</strong> will be written to the workspace profile and this member record will be linked and set to Active.
        </div>
      </div>

      <div id="sc-pw-err" style="min-height:18px;margin-top:10px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-prov-ws-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-pw-submit" onclick="_saCons_submitProvisionWs('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.40);color:#38bdf8;transition:all 0.15s;"
          onmouseover="this.style.background='rgba(56,189,248,0.16)'" onmouseout="this.style.background='rgba(56,189,248,0.08)'">
          Create Workspace
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { document.getElementById('sc-pw-email')?.focus(); }, 60);
};

window._saCons_submitProvisionWs = async function(memberKey) {
  const m           = _saCons_membersCache.find(x => x._key === memberKey);
  const fname       = (document.getElementById('sc-pw-fname')?.value || '').trim();
  const lname       = (document.getElementById('sc-pw-lname')?.value || '').trim();
  const email       = (document.getElementById('sc-pw-email')?.value || '').trim().toLowerCase();
  const _roleRaw    = document.getElementById('sc-pw-role')?.value || 'researcher';
  const inst        = (document.getElementById('sc-pw-inst')?.value || '').trim();
  const study       = (document.getElementById('sc-pw-study')?.value || '').trim() || null;
  const expiry      = document.getElementById('sc-pw-expiry')?.value || null;
  const region      = document.getElementById('sc-pw-region')?.value || 'us';
  const dims        = ['base','mvmt','strata'].filter(d => document.getElementById('sc-pw-dim-'+d)?.checked);
  const errEl       = document.getElementById('sc-pw-err');
  const btn         = document.getElementById('sc-pw-submit');

  const _instTypeMap = { institution_academic:'academic', institution_health:'health', institution_amc:'amc' };
  const role            = _instTypeMap[_roleRaw] ? 'institution' : _roleRaw;
  const institution_type = _instTypeMap[_roleRaw] || null;
  const name            = fname && lname ? `${fname} ${lname}` : fname || lname || email;
  const tierNum         = m?.tier || 3;
  const tierStr         = _CONS_TIER_TO_TESSERA[tierNum] || 'affiliate';

  if (!email) { errEl.textContent = 'Email is required.'; return; }
  if (!inst)  { errEl.textContent = 'Institution is required.'; return; }
  if (!dims.length) { errEl.textContent = 'Select at least one PEACS dimension.'; return; }

  errEl.textContent = 'Creating workspace…';
  btn.textContent = 'Creating…';
  btn.disabled = true;

  try {
    const rawResp = await fetch(LAMBDA_URL + '/issue-key', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, institution: inst, role, peacs_dims: dims,
        ...(institution_type ? { institution_type } : {}),
        ...(study ? { study_title: study } : {}),
      })
    });
    const res = await rawResp.json().catch(() => ({}));
    if (!res.key) {
      errEl.textContent = res.error || `Issue failed (HTTP ${rawResp.status})`;
      btn.textContent = 'Create Workspace';
      btn.disabled = false;
      return;
    }
    const issuedKey = res.key;
    await firebase.database().ref('atlas_deleted_keys/' + issuedKey).remove().catch(() => {});

    const wsData = { role, created_at: Date.now(), name, peacs_dims: dims, tessera_member: true, tessera_tier: tierNum };
    if (fname)            wsData.first_name       = fname;
    if (lname)            wsData.last_name        = lname;
    if (email)            wsData.email            = email;
    if (inst)             wsData.institution      = inst;
    if (institution_type) wsData.institution_type = institution_type;
    if (study)            wsData.study_title      = study;
    if (expiry)           wsData.expiry           = expiry;
    if (region && region !== 'us') wsData.region  = region;
    wsData.sa_note = `Provisioned from TESSERA member ${memberKey} · ${new Date().toISOString().slice(0,10)}`;

    await firebase.database().ref('workspaces/' + issuedKey).update(wsData);
    await firebase.database().ref('consortium_members/' + memberKey).update({ workspace_key: issuedKey, status: 'active' });

    document.getElementById('sc-prov-ws-overlay')?.remove();
    if (typeof showToast === 'function') showToast(`Workspace ${issuedKey} created. Member activated.`, 4500);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('tessera_workspace_provisioned', { memberKey, issuedKey, email });
    await _saCons_loadMembers();
    _saCons_renderMembersUI(document.getElementById('sc-tab-content'));
  } catch(e) {
    errEl.textContent = e.message === 'Failed to fetch'
      ? 'Network error — Lambda may be unreachable.'
      : 'Error: ' + e.message;
    btn.textContent = 'Create Workspace';
    btn.disabled = false;
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2: FUNDING BOARD
// ═════════════════════════════════════════════════════════════════════════════

function _saCons_renderFunding(container) {
  const allRegions = [...new Set(_CONS_FUNDING.map(f => f.region))].sort();
  const allFits    = [...new Set(_CONS_FUNDING.map(f => f.fit))].sort();

  const filtered = _CONS_FUNDING.filter(f => {
    const regionMatch = _saCons_regionFilter === 'all' || f.region === _saCons_regionFilter;
    const fitMatch    = _saCons_fitFilter    === 'all' || f.fit    === _saCons_fitFilter;
    return regionMatch && fitMatch;
  });

  const regionOpts = `<option value="all">All Regions</option>` +
    allRegions.map(r => `<option value="${_saCons_esc(r)}" ${_saCons_regionFilter === r ? 'selected' : ''}>${_saCons_esc(r)}</option>`).join('');
  const fitOpts = `<option value="all">All Focus Areas</option>` +
    allFits.map(r => `<option value="${_saCons_esc(r)}" ${_saCons_fitFilter === r ? 'selected' : ''}>${_saCons_esc(r)}</option>`).join('');

  const cards = filtered.map((f, idx) => {
    const globalIdx = _CONS_FUNDING.indexOf(f);
    return `
      <div class="sc-fund-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.amber};margin-bottom:4px;">${_saCons_esc(f.agency)}</div>
            <div style="font-size:1.00rem;font-weight:600;color:${_CC.text};line-height:1.3;">${_saCons_esc(f.mechanism)}</div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:flex-start;flex-shrink:0;">
            ${_saCons_regionTag(f.region)}
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(78,156,245,0.3);background:rgba(78,156,245,0.07);color:#4e9cf5;white-space:nowrap;">${_saCons_esc(f.fit)}</span>
          </div>
        </div>

        <div style="font-size:0.84rem;color:${_CC.muted};line-height:1.55;">${_saCons_esc(f.description)}</div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid ${_CC.border};padding-top:10px;margin-top:2px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:0.76rem;color:${_CC.dim};">Deadline: <span style="color:${_CC.muted};">${_saCons_esc(f.deadline)}</span></span>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            <button class="sc-action-btn" onclick="_saCons_copyGrantLanguage(${globalIdx},this)">
              Copy Grant Language
            </button>
            <a href="${_saCons_esc(f.url)}" target="_blank" rel="noopener"
              style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);color:${_CC.amber};cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;transition:all 0.12s;"
              onmouseover="this.style.background='rgba(212,168,67,0.15)'" onmouseout="this.style.background='rgba(212,168,67,0.07)'">
              View Details ↗
            </a>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CC.dim};margin-bottom:3px;">Curated Opportunities</div>
        <div style="font-size:1.05rem;color:${_CC.text};">${filtered.length} of ${_CONS_FUNDING.length} funding sources</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select class="sc-input" style="width:auto;cursor:pointer;padding:6px 10px;"
          onchange="_saCons_regionFilter=this.value;_saCons_renderFunding(document.getElementById('sc-tab-content'));">${regionOpts}</select>
        <select class="sc-input" style="width:auto;cursor:pointer;padding:6px 10px;"
          onchange="_saCons_fitFilter=this.value;_saCons_renderFunding(document.getElementById('sc-tab-content'));">${fitOpts}</select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:14px;">
      ${cards || `<div style="color:${_CC.dim};font-size:0.88rem;padding:40px;grid-column:1/-1;text-align:center;">No funding sources match the current filters.</div>`}
    </div>`;
}

window._saCons_copyGrantLanguage = function(idx, btn) {
  const f = _CONS_FUNDING[idx];
  if (!f) return;
  const text = `[ATLAS Grant Language: ${f.mechanism}]\n\n${f.boilerplate}`;
  _saCons_copyText(text, btn);
};

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3: LETTERS OF SUPPORT
// ═════════════════════════════════════════════════════════════════════════════

function _saCons_renderLetters(container) {
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.90rem;padding:20px 0;">Loading letters…</div>`;
  _saCons_loadLetters().then(() => _saCons_renderLettersUI(container));
}

async function _saCons_loadLetters() {
  try {
    const snap = await firebase.database().ref('consortium_letters').once('value');
    const raw  = snap.val() || {};
    _saCons_lettersCache = Object.entries(raw)
      .map(([k, v]) => ({ _key: k, ...v }))
      .sort((a, b) => (b.issued_at || 0) - (a.issued_at || 0));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Error loading letters: ' + e.message, 3000);
  }
}

function _saCons_renderLettersUI(container) {
  const total   = _saCons_lettersCache.length;
  const active  = _saCons_lettersCache.filter(l => l.status === 'issued').length;
  const monthly = _saCons_lettersCache.filter(l => (l.issued_at || 0) >= _saCons_thisMonth()).length;

  const rows = _saCons_lettersCache.length ? _saCons_lettersCache.map(l => `
    <tr>
      <td>
        <div style="font-weight:600;color:${_CC.text};">${_saCons_esc(l.recipient_name || '—')}</div>
        <div style="font-size:0.76rem;color:${_CC.dim};margin-top:2px;">${_saCons_esc(l.country || '')}</div>
      </td>
      <td style="color:${_CC.muted};">${_saCons_esc(l.institution || '—')}</td>
      <td style="color:${_CC.muted};font-size:0.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_saCons_esc(l.study_title || '')}">${_saCons_esc(l.study_title || '—')}</td>
      <td style="color:${_CC.muted};font-size:0.82rem;">
        <div>${_saCons_esc(l.grant_agency || '—')}</div>
        <div style="color:${_CC.dim};font-size:0.75rem;">${_saCons_esc(l.grant_mechanism || '')}</div>
      </td>
      <td style="color:${_CC.dim};font-size:0.80rem;white-space:nowrap;">${_saCons_fmtDate(l.issued_at)}</td>
      <td>${_saCons_statusBadge(l.status || 'draft', '')}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:nowrap;">
          <button class="sc-action-btn sc-action-btn-amber" onclick="_saCons_previewLetter('${_saCons_esc(l._key)}')">View / Copy</button>
          <button class="sc-action-btn sc-action-btn-danger" onclick="_saCons_revokeLetter('${_saCons_esc(l._key)}','${_saCons_esc(l.recipient_name)}')">Revoke</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:${_CC.dim};font-size:0.88rem;">No letters issued yet. Issue your first letter of support.</td></tr>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:22px;">
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.amber};font-family:'IBM Plex Mono',monospace;">${total}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Total Issued</div>
      </div>
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.green};font-family:'IBM Plex Mono',monospace;">${active}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Active</div>
      </div>
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.cyan};font-family:'IBM Plex Mono',monospace;">${monthly}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">This Month</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:14px;">
      <button onclick="_saCons_openIssueLetterModal()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:8px 18px;border-radius:7px;cursor:pointer;
               background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
        onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
        + Issue New Letter
      </button>
    </div>

    <div style="overflow-x:auto;border:1px solid ${_CC.border};border-radius:10px;">
      <table class="sc-table">
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Institution</th>
            <th>Study</th>
            <th>Grant</th>
            <th>Issued</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Issue Letter Modal ────────────────────────────────────────────────────────
window._saCons_openIssueLetterModal = function() {
  _saCons_injectStyles();
  const countryOpts = _CONS_COUNTRIES.map(c => `<option value="${_saCons_esc(c)}">${_saCons_esc(c)}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-issue-letter-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Issue Letter of Support">
      <button onclick="document.getElementById('sc-issue-letter-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">New Letter</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:${_CC.text};margin-bottom:22px;">Issue Letter of Support</div>

      <div style="display:grid;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-lt-recipient">Recipient Name <span style="color:${_CC.red};">*</span></label>
            <input id="sc-lt-recipient" class="sc-input" type="text" placeholder="Dr. Jane Smith" />
          </div>
          <div>
            <label class="sc-label" for="sc-lt-country">Country</label>
            <select id="sc-lt-country" class="sc-input" style="cursor:pointer;">${countryOpts}</select>
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-lt-institution">Institution <span style="color:${_CC.red};">*</span></label>
          <input id="sc-lt-institution" class="sc-input" type="text" placeholder="University of Example" />
        </div>
        <div>
          <label class="sc-label" for="sc-lt-study">Study Title <span style="color:${_CC.red};">*</span></label>
          <input id="sc-lt-study" class="sc-input" type="text" placeholder="Validation of MAP instrument in…" />
        </div>
        <div>
          <label class="sc-label" for="sc-lt-instrument">Instrument(s)</label>
          <input id="sc-lt-instrument" class="sc-input" type="text" placeholder="MAP, MMAS-8, PEACS" value="MAP, MMAS-8" />
        </div>
        <div>
          <label class="sc-label" for="sc-lt-purpose">Purpose / Scope</label>
          <input id="sc-lt-purpose" class="sc-input" type="text" placeholder="Validation, clinical research, translation, etc." />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sc-label" for="sc-lt-agency">Grant Agency</label>
            <input id="sc-lt-agency" class="sc-input" type="text" placeholder="NIH, Wellcome Trust, etc." />
          </div>
          <div>
            <label class="sc-label" for="sc-lt-mechanism">Grant Mechanism</label>
            <input id="sc-lt-mechanism" class="sc-input" type="text" placeholder="R21, R01, D43, etc." />
          </div>
        </div>
        <div>
          <label class="sc-label" for="sc-lt-status">Status</label>
          <select id="sc-lt-status" class="sc-input" style="cursor:pointer;">
            <option value="issued">Issued</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div id="sc-lt-error" style="display:none;margin-top:14px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-issue-letter-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-lt-submit" onclick="_saCons_submitLetter()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Issue Letter
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { document.getElementById('sc-lt-recipient')?.focus(); }, 60);
};

window._saCons_submitLetter = async function() {
  const recipient  = (document.getElementById('sc-lt-recipient')?.value  || '').trim();
  const country    = document.getElementById('sc-lt-country')?.value || '';
  const institution = (document.getElementById('sc-lt-institution')?.value || '').trim();
  const study      = (document.getElementById('sc-lt-study')?.value     || '').trim();
  const instrument = (document.getElementById('sc-lt-instrument')?.value || '').trim();
  const purpose    = (document.getElementById('sc-lt-purpose')?.value    || '').trim();
  const agency     = (document.getElementById('sc-lt-agency')?.value     || '').trim();
  const mechanism  = (document.getElementById('sc-lt-mechanism')?.value  || '').trim();
  const status     = document.getElementById('sc-lt-status')?.value || 'issued';
  const errEl      = document.getElementById('sc-lt-error');
  const submitBtn  = document.getElementById('sc-lt-submit');

  if (!recipient) {
    errEl.textContent = 'Recipient name is required.'; errEl.style.display = 'block';
    document.getElementById('sc-lt-recipient')?.focus(); return;
  }
  if (!institution) {
    errEl.textContent = 'Institution is required.'; errEl.style.display = 'block';
    document.getElementById('sc-lt-institution')?.focus(); return;
  }
  if (!study) {
    errEl.textContent = 'Study title is required.'; errEl.style.display = 'block';
    document.getElementById('sc-lt-study')?.focus(); return;
  }

  const data = {
    recipient_name: recipient, country, institution,
    study_title: study, instrument, purpose,
    grant_agency: agency, grant_mechanism: mechanism,
    status, issued_at: Date.now(),
  };

  submitBtn.textContent = 'Issuing…';
  submitBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    await firebase.database().ref('consortium_letters').push(data);
    document.getElementById('sc-issue-letter-overlay')?.remove();
    if (typeof showToast === 'function') showToast('✓ Letter of support issued.', 2200);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('consortium_letter_issued', { recipient, institution });
    await _saCons_loadLetters();
    _saCons_renderLettersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    submitBtn.textContent = 'Issue Letter';
    submitBtn.disabled = false;
  }
};

// ── Letter preview / copy modal ───────────────────────────────────────────────
window._saCons_previewLetter = function(key) {
  const l = _saCons_lettersCache.find(x => x._key === key);
  if (!l) { if (typeof showToast === 'function') showToast('Letter not found.'); return; }
  _saCons_injectStyles();

  const today = _saCons_today();
  const instrumentLine = l.instrument || 'MAP, MMAS-8';
  const purposeLine    = l.purpose    || 'research and validation purposes';
  const grantLine      = (l.grant_agency && l.grant_mechanism)
    ? `in support of their ${l.grant_agency} ${l.grant_mechanism} application`
    : 'in support of their research grant application';

  const letterText = `${today}

To the Grants and Contracts Office,
${l.grant_agency ? l.grant_agency : 'Funding Agency'}

Dear Review Committee,

I am writing on behalf of TESSERA GRC (Global Research Consortium) and in my capacity as the developer of the Medication Adherence Report Scale (MMAS-8) and the Medication Adherence Phenotyping (MAP) instrument to express my strong support for the research proposal submitted by ${l.recipient_name} from ${l.institution}, ${l.country}${grantLine ? ', ' + grantLine : ''}.

The proposed study, titled "${l.study_title}," represents a scientifically rigorous contribution to the field of medication adherence science. The research team has been granted authorization to use the ${instrumentLine} instrument(s) within the ATLAS platform framework for ${purposeLine}. This authorization has been reviewed and approved through the ATLAS consortium membership process, ensuring appropriate methodological oversight and psychometric integrity.

TESSERA GRC (Global Research Consortium) actively supports validated, multicenter research using MAP, MMAS-8, and the PEACS (Psychometric Execution and Adherence Classification System) behavioral phenotyping framework. The proposed research aligns with TESSERA GRC priorities and will contribute to the global normative database currently being established across consortium member sites. Consortium membership provides access to validated scoring algorithms, normative benchmarking, and collaborative analytical support.

I fully endorse the qualifications of ${l.recipient_name} and the research team at ${l.institution} to conduct this work with fidelity to the psychometric standards required for MMAS-8 and MAP applications. I encourage favorable consideration of this proposal.

Sincerely,

Philip R. Morisky, ScD, MSPH, MPH
Professor Emeritus, UCLA Fielding School of Public Health
Developer, Morisky Medication Adherence Scale (MMAS-8)
Developer, Medication Adherence Phenotyping (MAP) Instrument
Director, TESSERA GRC
atlasadherence.com`;

  const overlay = document.createElement('div');
  overlay.id = 'sc-preview-letter-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal sc-modal-wide" role="dialog" aria-modal="true" aria-label="Letter Preview">
      <button onclick="document.getElementById('sc-preview-letter-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:4px;">Letter of Support</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:300;color:${_CC.text};margin-bottom:6px;">${_saCons_esc(l.recipient_name)}</div>
      <div style="font-size:0.80rem;color:${_CC.dim};margin-bottom:18px;">${_saCons_esc(l.institution)}  ${_saCons_esc(l.country ? '· ' + l.country : '')}</div>

      <div style="max-height:460px;overflow-y:auto;margin-bottom:18px;">
        <pre class="sc-letter-preview" id="sc-letter-text">${_saCons_esc(letterText)}</pre>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid ${_CC.border};padding-top:16px;">
        <button onclick="document.getElementById('sc-preview-letter-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Close
        </button>
        <button id="sc-copy-letter-btn" onclick="_saCons_copyLetterText()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Copy Letter
        </button>
      </div>
    </div>`;

  // Store letter text for copy
  window._saCons_currentLetterText = letterText;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window._saCons_copyLetterText = function() {
  const btn = document.getElementById('sc-copy-letter-btn');
  if (!btn || !window._saCons_currentLetterText) return;
  _saCons_copyText(window._saCons_currentLetterText, btn);
};

window._saCons_revokeLetter = async function(key, recipient) {
  if (!confirm(`Revoke letter of support for "${recipient}"?\n\nThe status will be set to expired.`)) return;
  try {
    await firebase.database().ref('consortium_letters/' + key + '/status').set('expired');
    if (typeof showToast === 'function') showToast(`✓ Letter for "${recipient}" revoked.`, 2500);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('consortium_letter_revoked', { key, recipient });
    await _saCons_loadLetters();
    _saCons_renderLettersUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Revoke failed: ' + e.message, 3000);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4: IMPACT DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

function _saCons_renderImpact(container) {
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.90rem;padding:20px 0;">Loading impact metrics…</div>`;
  _saCons_loadImpact(container);
}

async function _saCons_loadImpact(container) {
  try {
    const db = firebase.database();
    const [membersSnap, lettersSnap, assessmentsSnap, workspacesSnap] = await Promise.all([
      db.ref('consortium_members').once('value').catch(() => null),
      db.ref('consortium_letters').once('value').catch(() => null),
      db.ref('assessments').once('value').catch(() => null),
      db.ref('workspaces').once('value').catch(() => null),
    ]);

    const members    = membersSnap?.val()    || {};
    const letters    = lettersSnap?.val()    || {};
    const assessments = assessmentsSnap?.val() || {};
    const workspaces = workspacesSnap?.val()  || {};

    const memberList   = Object.values(members);
    const letterList   = Object.values(letters);

    const totalMembers  = memberList.length;
    const totalLetters  = letterList.filter(l => l.status === 'issued').length;
    const totalAssessments = Object.keys(assessments).length;
    const totalWorkspaces  = Object.keys(workspaces).length;

    // Countries represented
    const countries = [...new Set(memberList.map(m => m.country).filter(Boolean))];
    const countryCount = countries.length;

    // Active studies (members with active status)
    const activeStudies = memberList.filter(m => m.status === 'active').length;

    // Region breakdown (continent mapping)
    const regionMap = {
      'North America': ['United States','Canada','Mexico'],
      'Europe': ['United Kingdom','Germany','France','Spain','Italy','Portugal','Netherlands','Belgium','Switzerland','Austria','Sweden','Norway','Denmark','Finland','Poland','Czech Republic','Hungary','Romania','Bulgaria','Croatia','Cyprus','Malta','Greece','Turkey'],
      'Latin America': ['Brazil','Argentina','Colombia','Chile','Peru'],
      'Asia Pacific': ['India','China','Japan','South Korea','Singapore','Thailand','Philippines','Indonesia','Malaysia','Vietnam','Pakistan','Bangladesh','Australia','New Zealand'],
      'Middle East': ['Israel','Saudi Arabia','UAE','Egypt'],
      'Africa': ['South Africa','Nigeria','Kenya','Ethiopia','Ghana'],
    };

    const regionCounts = {};
    Object.keys(regionMap).forEach(r => { regionCounts[r] = 0; });
    memberList.forEach(m => {
      for (const [region, countryList] of Object.entries(regionMap)) {
        if (countryList.includes(m.country)) { regionCounts[region]++; break; }
      }
    });

    // Tier breakdown
    const tierCounts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    memberList.forEach(m => { if (tierCounts[m.tier] !== undefined) tierCounts[m.tier]++; });
    const maxTierCount = Math.max(...Object.values(tierCounts), 1);

    _saCons_renderImpactUI(container, {
      totalMembers, countryCount, activeStudies, totalLetters,
      totalAssessments, totalWorkspaces, regionCounts, tierCounts, maxTierCount
    });
  } catch (e) {
    container.innerHTML = `<div style="color:${_CC.red};font-size:0.88rem;padding:20px 0;">Error loading impact data: ${_saCons_esc(e.message)}</div>`;
  }
}

function _saCons_renderImpactUI(container, d) {
  const statCards = [
    { label: 'Total Members',          value: d.totalMembers,     color: _CC.amber  },
    { label: 'Countries',              value: d.countryCount,     color: _CC.cyan   },
    { label: 'Active Studies',         value: d.activeStudies,    color: _CC.green  },
    { label: 'Letters Issued',         value: d.totalLetters,     color: _CC.purple },
    { label: 'Assessments in ATLAS',   value: d.totalAssessments, color: _CC.blue   },
    { label: 'Workspaces',             value: d.totalWorkspaces,  color: '#f59e0b'  },
  ].map(s => `
    <div class="sc-stat-card">
      <div style="font-size:1.7rem;font-weight:700;color:${s.color};font-family:'IBM Plex Mono',monospace;">${s.value.toLocaleString()}</div>
      <div style="font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:${_CC.dim};">${s.label}</div>
    </div>`).join('');

  const regionRows = Object.entries(d.regionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([region, count]) => {
      const pct = d.totalMembers > 0 ? Math.round(count / d.totalMembers * 100) : 0;
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:0.82rem;color:${_CC.muted};">${_saCons_esc(region)}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_CC.dim};">${count} member${count !== 1 ? 's' : ''}</span>
          </div>
          <div class="sc-progress-track">
            <div class="sc-progress-fill" style="width:${pct}%;background:${_CC.cyan};"></div>
          </div>
        </div>`;
    }).join('');

  const tierRows = Object.entries(d.tierCounts).map(([tier, count]) => {
    const t   = _CONS_TIERS[tier];
    const pct = d.maxTierCount > 0 ? Math.round(count / d.maxTierCount * 100) : 0;
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:0.82rem;color:${t.color};">${_saCons_esc(t.label)}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_CC.dim};">${count}</span>
        </div>
        <div class="sc-progress-track">
          <div class="sc-progress-fill" style="width:${pct}%;background:${t.color};"></div>
        </div>
      </div>`;
  }).join('');

  const milestones = _CONS_MILESTONES.map((m, i) => `
    <div style="display:flex;gap:14px;align-items:flex-start;${i < _CONS_MILESTONES.length - 1 ? 'padding-bottom:16px;border-bottom:1px solid ' + _CC.border + ';' : ''}">
      <div style="flex-shrink:0;text-align:center;width:42px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:${_CC.amber};">${_saCons_esc(m.year)}</div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;flex:1;">
        <div class="sc-timeline-dot" style="margin-top:4px;"></div>
        <div style="font-size:0.88rem;color:${_CC.muted};line-height:1.5;">${_saCons_esc(m.event)}</div>
      </div>
    </div>`).join('');

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:28px;">
      ${statCards}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:10px;padding:20px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CC.dim};margin-bottom:16px;">Members by World Region</div>
        ${regionRows || `<div style="color:${_CC.dim};font-size:0.84rem;">No member data yet.</div>`}
      </div>
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:10px;padding:20px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CC.dim};margin-bottom:16px;">Membership Tier Breakdown</div>
        ${tierRows}
      </div>
    </div>

    <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:10px;padding:22px;">
      <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CC.dim};margin-bottom:6px;">ATLAS Annual Report</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.2rem;font-weight:300;color:${_CC.text};margin-bottom:20px;">Program Milestones</div>
      <div style="display:flex;flex-direction:column;gap:0;">
        ${milestones}
      </div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5: STUDY REGISTRY
// ═════════════════════════════════════════════════════════════════════════════

let _saCons_registryCache    = [];
let _saCons_registryFilter   = 'all';

function _saCons_renderRegistry(container) {
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.90rem;padding:20px 0;">Loading study registry…</div>`;
  _saCons_loadStudyRegistry().then(function() { _saCons_renderRegistryUI(container); });
}

async function _saCons_loadStudyRegistry() {
  try {
    const snap = await firebase.database().ref('tessera_study_registry').once('value');
    const raw  = snap.val() || {};
    _saCons_registryCache = Object.entries(raw)
      .map(function([k, v]) { return Object.assign({ _key: k }, v); })
      .sort(function(a, b) { return (b.submitted_at || 0) - (a.submitted_at || 0); });
  } catch (e) {
    if (typeof showToast === 'function') showToast('Error loading study registry: ' + e.message, 3000);
  }
}

function _saCons_renderRegistryUI(container) {
  const total    = _saCons_registryCache.length;
  const pending  = _saCons_registryCache.filter(function(s) { return s.status === 'pending';  }).length;
  const approved = _saCons_registryCache.filter(function(s) { return s.status === 'approved'; }).length;
  const rejected = _saCons_registryCache.filter(function(s) { return s.status === 'rejected'; }).length;

  const filtered = _saCons_registryFilter === 'all'
    ? _saCons_registryCache
    : _saCons_registryCache.filter(function(s) { return s.status === _saCons_registryFilter; });

  const filterBtns = ['all','pending','approved','rejected'].map(function(f) {
    const label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
    const isActive = _saCons_registryFilter === f;
    return `<button
      style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;
             padding:4px 13px;border-radius:4px;cursor:pointer;transition:all 0.13s;
             border:1px solid ${isActive ? 'rgba(212,168,67,0.45)' : 'rgba(212,168,67,0.16)'};
             background:${isActive ? 'rgba(212,168,67,0.10)' : 'transparent'};
             color:${isActive ? _CC.amber : _CC.dim};"
      onclick="_saCons_registryFilter='${f}';_saCons_renderRegistryUI(document.getElementById('sc-tab-content'));">
      ${label}
    </button>`;
  }).join('');

  const rows = filtered.length ? filtered.map(function(s) {
    const instrHtml = (s.instruments && s.instruments.length)
      ? s.instruments.map(function(inst) {
          const cls = inst === 'MAP' ? 'sc-chip-map' : inst === 'MMAS-8' ? 'sc-chip-mmas' : 'sc-chip-peacs';
          return `<span class="sc-chip ${cls}">${_saCons_esc(inst)}</span>`;
        }).join('')
      : `<span style="color:${_CC.dim};font-size:0.75rem;">None</span>`;

    const statusCls = s.status === 'approved' ? 'sc-badge-approved'
      : s.status === 'rejected' ? 'sc-badge-rejected'
      : 'sc-badge-pending';

    const approveBtn = (s.status === 'pending')
      ? `<button class="sc-action-btn sc-action-btn-amber" onclick="_saCons_openApproveModal('${_saCons_esc(s._key)}')">Approve</button>`
      : '';
    const rejectBtn = (s.status === 'pending')
      ? `<button class="sc-action-btn sc-action-btn-danger" onclick="_saCons_rejectStudy('${_saCons_esc(s._key)}','${_saCons_esc(s.title || '')}')">Reject</button>`
      : '';

    return `
      <tr>
        <td>
          <div style="font-weight:600;color:${_CC.text};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_saCons_esc(s.title || '')}">${_saCons_esc(s.title || '(Untitled)')}</div>
        </td>
        <td>
          <div style="font-size:0.82rem;color:${_CC.text};">${_saCons_esc(s.displayName || '—')}</div>
          <div style="font-size:0.74rem;color:${_CC.dim};margin-top:2px;">${_saCons_esc(s.email || '')}</div>
        </td>
        <td style="color:${_CC.muted};font-size:0.82rem;">${_saCons_esc(s.institution || '—')}</td>
        <td style="color:${_CC.muted};font-size:0.82rem;">${_saCons_esc(s.country || '—')}</td>
        <td>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(56,189,248,0.30);background:rgba(56,189,248,0.06);color:#38bdf8;white-space:nowrap;">${_saCons_esc(s.phase || '—')}</span>
        </td>
        <td>${instrHtml}</td>
        <td style="color:${_CC.dim};font-size:0.80rem;white-space:nowrap;">${_saCons_fmtDate(s.submitted_at)}</td>
        <td>
          <span class="sc-badge ${statusCls}" style="${
            s.status === 'approved' ? 'color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);' :
            s.status === 'rejected' ? 'color:#ef4444;border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.06);' :
                                      'color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);'
          }">${s.status === 'approved' ? 'Approved' : s.status === 'rejected' ? 'Rejected' : 'Pending'}</span>
        </td>
        <td>
          <div style="display:flex;gap:5px;flex-wrap:nowrap;">
            ${approveBtn}
            ${rejectBtn}
          </div>
        </td>
      </tr>`;
  }).join('')
  : `<tr><td colspan="9" style="text-align:center;padding:40px;color:${_CC.dim};font-size:0.88rem;">No submissions${_saCons_registryFilter !== 'all' ? ' with status "' + _saCons_registryFilter + '"' : ''} found.</td></tr>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:22px;">
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.amber};font-family:'IBM Plex Mono',monospace;">${total}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Total Submitted</div>
      </div>
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:#d4a843;font-family:'IBM Plex Mono',monospace;">${pending}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Pending</div>
      </div>
      <div class="sc-stat-card">
        <div style="font-size:1.6rem;font-weight:700;color:${_CC.green};font-family:'IBM Plex Mono',monospace;">${approved}</div>
        <div style="font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Approved</div>
      </div>
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
      ${filterBtns}
    </div>

    <div style="overflow-x:auto;border:1px solid ${_CC.border};border-radius:10px;">
      <table class="sc-table">
        <thead>
          <tr>
            <th>Study Title</th>
            <th>PI (Name / Email)</th>
            <th>Institution</th>
            <th>Country</th>
            <th>Phase</th>
            <th>Instruments</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

window._saCons_openApproveModal = function(key) {
  const s = _saCons_registryCache.find(function(x) { return x._key === key; });
  if (!s) { if (typeof showToast === 'function') showToast('Study record not found.'); return; }
  _saCons_injectStyles();

  const year      = new Date().getFullYear();
  const seqNum    = _saCons_nextTesseraSeq();
  const prefilled = 'TESSERA-' + year + '-' + String(seqNum).padStart(4, '0');

  const overlay = document.createElement('div');
  overlay.id = 'sc-approve-study-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Approve Study">
      <button onclick="document.getElementById('sc-approve-study-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">x</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">Issue TESSERA Study ID</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:300;color:${_CC.text};margin-bottom:6px;">${_saCons_esc(s.title || '(Untitled)')}</div>
      <div style="font-size:0.80rem;color:${_CC.dim};margin-bottom:20px;">${_saCons_esc(s.displayName || '')} &middot; ${_saCons_esc(s.institution || '')}</div>

      <div style="margin-bottom:18px;">
        <label class="sc-label" for="sc-approve-tessera-id">TESSERA Study ID</label>
        <input id="sc-approve-tessera-id" class="sc-input" type="text" value="${_saCons_esc(prefilled)}"
          style="font-family:'IBM Plex Mono',monospace;font-size:1.0rem;letter-spacing:0.06em;color:${_CC.green};" />
        <div style="font-size:0.72rem;color:${_CC.dim};margin-top:5px;">Format: TESSERA-YYYY-XXXX. Edit if needed before issuing.</div>
      </div>

      <div id="sc-approve-study-error" style="display:none;margin-bottom:14px;font-size:0.82rem;color:${_CC.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-approve-study-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CC.borderB}';this.style.color='${_CC.text}'"
          onmouseout="this.style.borderColor='${_CC.border}';this.style.color='${_CC.muted}'">
          Cancel
        </button>
        <button id="sc-approve-study-submit" onclick="_saCons_issueStudyId('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:rgba(46,201,138,0.09);border:1px solid rgba(46,201,138,0.40);color:${_CC.green};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(46,201,138,0.18)'" onmouseout="this.style.background='rgba(46,201,138,0.09)'">
          Issue ID
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  setTimeout(function() { document.getElementById('sc-approve-tessera-id')?.focus(); }, 60);
};

function _saCons_nextTesseraSeq() {
  const approved = _saCons_registryCache.filter(function(s) { return s.status === 'approved' && s.tessera_study_id; });
  let maxSeq = 0;
  approved.forEach(function(s) {
    const match = (s.tessera_study_id || '').match(/-(\d{4})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  });
  return maxSeq + 1;
}

window._saCons_issueStudyId = async function(key) {
  const tesseraId = (document.getElementById('sc-approve-tessera-id')?.value || '').trim();
  const errEl   = document.getElementById('sc-approve-study-error');
  const submitBtn = document.getElementById('sc-approve-study-submit');

  if (!tesseraId) {
    errEl.textContent = 'Please enter a TESSERA Study ID.';
    errEl.style.display = 'block';
    return;
  }

  submitBtn.textContent = 'Issuing…';
  submitBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    await firebase.database().ref('tessera_study_registry/' + key).update({
      status: 'approved',
      tessera_study_id: tesseraId,
      approved_at: Date.now()
    });
    if (typeof atlasAuditLog === 'function') {
      atlasAuditLog('tessera_study_approved', { key: key, tessera_study_id: tesseraId });
    }
    document.getElementById('sc-approve-study-overlay')?.remove();
    if (typeof showToast === 'function') showToast('Study approved. TESSERA ID issued: ' + tesseraId, 3000);
    await _saCons_loadStudyRegistry();
    _saCons_renderRegistryUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    submitBtn.textContent = 'Issue ID';
    submitBtn.disabled = false;
  }
};

window._saCons_rejectStudy = async function(key, title) {
  if (!confirm('Reject study "' + title + '"?\n\nStatus will be set to rejected. This can be undone by editing the record directly in Firebase.')) return;
  try {
    await firebase.database().ref('tessera_study_registry/' + key).update({
      status: 'rejected',
      rejected_at: Date.now()
    });
    if (typeof atlasAuditLog === 'function') {
      atlasAuditLog('tessera_study_rejected', { key: key, title: title });
    }
    if (typeof showToast === 'function') showToast('Study marked as rejected.', 2500);
    await _saCons_loadStudyRegistry();
    _saCons_renderRegistryUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Reject failed: ' + e.message, 3000);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════

window.saConsortiumInit = async function(container) {
  if (!container) return;
  _saCons_injectStyles();
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.90rem;padding:20px 0;">Initializing consortium module…</div>`;

  // Pre-load applications cache so badge count is accurate before shell renders
  await _saCons_loadApplications().catch(() => {});

  // Render the shell with sub-tab nav
  _saCons_renderShell(container);

  // Load and render the default tab (members)
  const contentEl = document.getElementById('sc-tab-content');
  if (!contentEl) return;

  if (_saCons_activeSubTab === 'members') {
    _saCons_renderMembers(contentEl);
  } else if (_saCons_activeSubTab === 'applications') {
    _saCons_renderApplications(contentEl);
  } else if (_saCons_activeSubTab === 'funding') {
    _saCons_renderFunding(contentEl);
  } else if (_saCons_activeSubTab === 'letters') {
    _saCons_renderLetters(contentEl);
  } else if (_saCons_activeSubTab === 'impact') {
    _saCons_renderImpact(contentEl);
  } else if (_saCons_activeSubTab === 'registry') {
    _saCons_renderRegistry(contentEl);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// TAB: APPLICATIONS — Self-submitted via tessera-signup form
// Firebase node: consortium_applications (publicly writable, admin readable)
// ═════════════════════════════════════════════════════════════════════════════

const _CONS_TIER_LABELS = {
  1: 'Institutional Partner', 2: 'Validation Partner',
  3: 'Research Affiliate',    4: 'Student Affiliate',
  5: 'Industry Partner',
};
const _CONS_TIER_COLORS = {
  1: '#d4a843', 2: '#38bdf8', 3: '#2ec98a', 4: '#8b6ff5', 5: '#f59e0b',
};

async function _saCons_loadApplications() {
  try {
    const snap = await firebase.database().ref('consortium_applications').once('value');
    const raw  = snap.val() || {};
    _saCons_applicationsCache = Object.entries(raw)
      .map(([k, v]) => ({ _key: k, ...v }))
      .sort((a, b) => (b.applied_at || 0) - (a.applied_at || 0));
  } catch (_) {
    _saCons_applicationsCache = [];
  }
}

function _saCons_renderApplications(container) {
  container.innerHTML = `<div style="color:${_CC.muted};font-size:0.88rem;padding:20px 0;">Loading applications…</div>`;
  _saCons_loadApplications().then(() => _saCons_renderApplicationsUI(container));
}

function _saCons_renderApplicationsUI(container) {
  const apps = _saCons_applicationsCache;
  const pending  = apps.filter(a => a.status === 'pending');
  const approved = apps.filter(a => a.status === 'approved' || a.status === 'active');
  const rejected = apps.filter(a => a.status === 'rejected');

  const pendingBanner = pending.length ? `
    <div style="background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.28);border-radius:10px;padding:13px 18px;margin-bottom:22px;display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:1.1rem;flex-shrink:0;margin-top:1px;">📬</div>
      <div style="flex:1;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;font-weight:600;color:${_CC.orange};margin-bottom:4px;letter-spacing:0.08em;">
          ${pending.length} Application${pending.length !== 1 ? 's' : ''} Awaiting Review
        </div>
        <div style="font-size:0.76rem;color:${_CC.muted};line-height:1.5;">
          Review and approve or reject each application below. Approved applications are automatically created as consortium members.
        </div>
      </div>
    </div>` : '';

  if (!apps.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:2.5rem;margin-bottom:16px;">📭</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_CC.dim};">No applications yet</div>
        <div style="font-size:0.78rem;color:${_CC.dim};margin-top:8px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.55;">
          Applications submitted via the TESSERA GRC signup page appear here automatically.
          Share the signup link at <a href="https://scalacartafoundation.org/#tessera" target="_blank" rel="noopener" style="color:${_CC.amber};text-decoration:none;">scalacartafoundation.org/#tessera</a> to start receiving applications.
        </div>
      </div>`;
    return;
  }

  const rows = apps.map(a => {
    const tierColor  = _CONS_TIER_COLORS[a.tier] || _CC.dim;
    const tierLabel  = _CONS_TIER_LABELS[a.tier]  || `Tier ${a.tier || '?'}`;
    const statusColor = a.status === 'pending' ? _CC.orange
      : a.status === 'approved' || a.status === 'active' ? _CC.green : _CC.red;
    const statusLabel = a.status === 'pending' ? 'Pending'
      : a.status === 'approved' || a.status === 'active' ? 'Approved' : 'Rejected';
    const dateStr = a.applied_at
      ? new Date(a.applied_at).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'})
      : '—';
    const lmicBadge = a.lmic_eligible
      ? `<span style="display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.54rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid rgba(249,115,22,0.32);background:rgba(249,115,22,0.07);color:${_CC.orange};white-space:nowrap;margin-left:5px;">Open Science</span>`
      : '';
    const osBadge = a.open_science
      ? `<span style="display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.54rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid rgba(249,115,22,0.22);background:rgba(249,115,22,0.05);color:${_CC.orange};white-space:nowrap;margin-left:3px;">OS Req</span>`
      : '';

    const actionBtns = a.status === 'pending' ? `
      <button onclick="_saCons_approveApp('${a._key}')" style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:none;background:${_CC.green};color:#000;cursor:pointer;font-weight:600;margin-right:5px;">Approve</button>
      <button onclick="_saCons_rejectApp('${a._key}')" style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;padding:5px 10px;border-radius:5px;border:1px solid rgba(239,68,68,0.35);background:transparent;color:${_CC.red};cursor:pointer;">Reject</button>
    ` : `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;color:${statusColor};">${statusLabel}</span>`;

    return `
      <tr onclick="_saCons_openAppDrawer('${a._key}')" style="cursor:pointer;">
        <td>
          <div style="font-weight:600;color:${_CC.text};">${_saCons_esc(a.name || '—')}${lmicBadge}${osBadge}</div>
          <div style="font-size:0.72rem;color:${_CC.dim};margin-top:2px;">${_saCons_esc(a.contact_email || '')}</div>
        </td>
        <td style="color:${_CC.muted};">${_saCons_esc(a.institution || '—')}</td>
        <td style="color:${_CC.muted};">${_saCons_esc(a.country || '—')}</td>
        <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.64rem;color:${tierColor};background:rgba(255,255,255,0.04);border:1px solid ${tierColor}30;padding:2px 8px;border-radius:4px;">${tierLabel}</span></td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:${_CC.dim};">${dateStr}</td>
        <td onclick="event.stopPropagation();">${actionBtns}</td>
      </tr>`;
  }).join('');

  container.innerHTML = pendingBanner + `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;">
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:9px;padding:16px 18px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:1.5rem;font-weight:600;color:${_CC.orange};">${pending.length}</div>
        <div style="font-size:0.66rem;letter-spacing:0.12em;text-transform:uppercase;color:${_CC.dim};margin-top:4px;">Pending Review</div>
      </div>
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:9px;padding:16px 18px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:1.5rem;font-weight:600;color:${_CC.green};">${approved.length}</div>
        <div style="font-size:0.66rem;letter-spacing:0.12em;text-transform:uppercase;color:${_CC.dim};margin-top:4px;">Approved</div>
      </div>
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:9px;padding:16px 18px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:1.5rem;font-weight:600;color:${_CC.text};">${apps.length}</div>
        <div style="font-size:0.66rem;letter-spacing:0.12em;text-transform:uppercase;color:${_CC.dim};margin-top:4px;">Total Applications</div>
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid ${_CC.border};border-radius:10px;">
      <table class="sc-table" style="width:100%;">
        <thead>
          <tr>
            <th>Applicant</th>
            <th>Institution</th>
            <th>Country</th>
            <th>Tier</th>
            <th>Applied</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

window._saCons_openAppDrawer = function(key) {
  const a = _saCons_applicationsCache.find(x => x._key === key);
  if (!a) return;
  const tierLabel = _CONS_TIER_LABELS[a.tier] || `Tier ${a.tier || '?'}`;
  const tierColor = _CONS_TIER_COLORS[a.tier] || _CC.dim;
  const dateStr   = a.applied_at ? new Date(a.applied_at).toLocaleString() : '—';
  const diseases  = Array.isArray(a.disease_areas) ? a.disease_areas.join(', ') : '—';
  const insts     = Array.isArray(a.instruments) ? a.instruments.join(', ') : '—';
  const isPending = a.status === 'pending';

  const overlay = document.createElement('div');
  overlay.id = 'sc-app-drawer';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-start;justify-content:flex-end;background:rgba(6,12,24,0.70);backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div style="width:min(540px,100vw);height:100vh;overflow-y:auto;background:${_CC.surface};border-left:1px solid ${_CC.borderB};padding:28px 28px 60px;display:flex;flex-direction:column;gap:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:${_CC.amber};margin-bottom:4px;">TESSERA GRC · Application</div>
          <div style="font-size:1.22rem;font-weight:600;color:${_CC.bright};">${_saCons_esc(a.name || '—')}</div>
          <div style="font-size:0.78rem;color:${_CC.dim};margin-top:2px;">${_saCons_esc(a.contact_email || '')}</div>
        </div>
        <button onclick="document.getElementById('sc-app-drawer')?.remove();" style="background:rgba(255,255,255,0.06);border:1px solid ${_CC.border};border-radius:6px;color:${_CC.muted};font-size:1.1rem;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
        ${[
          ['Institution',   a.institution || '—'],
          ['Department',    a.department  || '—'],
          ['Country',       a.country     || '—'],
          ['Role',          a.role        || '—'],
          ['Applied',       dateStr],
          ['Reference',     a.application_ref || '—'],
          ['IRB Status',    a.irb_status  || '—'],
          ['Enrollment',    a.enrollment ? String(a.enrollment) : '—'],
          ['ORCID',         a.orcid       || '—'],
          ['Open Science',  a.open_science ? 'Yes — requested' : 'Not requested'],
        ].map(([l,v]) => `
          <div style="background:${_CC.bg2};border:1px solid ${_CC.border};border-radius:7px;padding:10px 12px;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.dim};margin-bottom:4px;">${l}</div>
            <div style="font-size:0.80rem;color:${_CC.text};">${_saCons_esc(v)}</div>
          </div>`).join('')}
      </div>

      <div style="background:${_CC.bg2};border:1px solid rgba(${a.tier===1?'212,168,67':a.tier===2?'56,189,248':a.tier===3?'46,201,138':a.tier===4?'139,111,245':'245,158,11'},0.25);border-radius:8px;padding:13px 14px;margin-bottom:14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:${tierColor};margin-bottom:5px;">Requested Tier</div>
        <div style="font-size:0.84rem;color:${_CC.text};font-weight:600;">${tierLabel}</div>
      </div>

      ${a.study_title ? `<div style="background:${_CC.bg2};border:1px solid ${_CC.border};border-radius:8px;padding:13px 14px;margin-bottom:14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.dim};margin-bottom:5px;">Study / Research Focus</div>
        <div style="font-size:0.82rem;color:${_CC.text};line-height:1.5;">${_saCons_esc(a.study_title)}</div>
      </div>` : ''}

      ${a.description ? `<div style="background:${_CC.bg2};border:1px solid ${_CC.border};border-radius:8px;padding:13px 14px;margin-bottom:14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.dim};margin-bottom:5px;">Research Description</div>
        <div style="font-size:0.80rem;color:${_CC.muted};line-height:1.55;">${_saCons_esc(a.description)}</div>
      </div>` : ''}

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">
        ${diseases !== '—' ? `<div style="font-size:0.72rem;color:${_CC.dim};">Disease areas: <span style="color:${_CC.muted};">${_saCons_esc(diseases)}</span></div>` : ''}
        ${insts !== '—'    ? `<div style="font-size:0.72rem;color:${_CC.dim};margin-top:4px;">Instruments: <span style="color:${_CC.muted};">${_saCons_esc(insts)}</span></div>` : ''}
        ${a.referral       ? `<div style="font-size:0.72rem;color:${_CC.dim};margin-top:4px;">Referral: <span style="color:${_CC.muted};">${_saCons_esc(a.referral)}</span></div>` : ''}
        ${a.linkedin       ? `<div style="font-size:0.72rem;margin-top:4px;"><a href="${_saCons_esc(a.linkedin)}" target="_blank" style="color:${_CC.cyan};">${_saCons_esc(a.linkedin)}</a></div>` : ''}
      </div>

      ${a.message ? `<div style="background:${_CC.bg2};border:1px solid ${_CC.border};border-radius:8px;padding:13px 14px;margin-bottom:18px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.dim};margin-bottom:5px;">Applicant Message</div>
        <div style="font-size:0.80rem;color:${_CC.muted};line-height:1.55;font-style:italic;">"${_saCons_esc(a.message)}"</div>
      </div>` : ''}

      ${isPending ? `
        <div style="border-top:1px solid ${_CC.border};padding-top:20px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:${_CC.dim};">Review Decision</div>
          <div style="display:flex;gap:10px;">
            <button onclick="_saCons_approveApp('${a._key}')" style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;padding:12px;border-radius:7px;border:none;background:${_CC.green};color:#000;cursor:pointer;">Approve & Create Member</button>
            <button onclick="_saCons_rejectApp('${a._key}')" style="flex:0 0 auto;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;text-transform:uppercase;padding:12px 16px;border-radius:7px;border:1px solid rgba(239,68,68,0.35);background:transparent;color:${_CC.red};cursor:pointer;">Reject</button>
          </div>
          <div style="font-size:0.72rem;color:${_CC.dim};line-height:1.5;">
            Approving will create a consortium_members record with status "pending" and copy all applicant data. You can then provision workspace access and issue a TESSERA ID from the Members tab.
          </div>
        </div>` : `
        <div style="border-top:1px solid ${_CC.border};padding-top:16px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:${a.status==='rejected'?_CC.red:_CC.green};">${a.status === 'rejected' ? 'Application rejected' : 'Application approved — member record created'}</span>
        </div>`}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window._saCons_approveApp = async function(key) {
  const a = _saCons_applicationsCache.find(x => x._key === key);
  if (!a) return;
  if (!confirm(`Approve application from ${a.name || a.contact_email}?\n\nThis will create a consortium member record and mark the application as approved.`)) return;
  try {
    const db = firebase.database();
    // 1. Create member record in consortium_members
    const memberData = {
      name:          a.name          || '',
      contact_email: a.contact_email || a.email || '',
      email:         a.email         || a.contact_email || '',
      institution:   a.institution   || '',
      department:    a.department    || '',
      country:       a.country       || '',
      role:          a.role          || '',
      tier:          a.tier          || 3,
      study_title:   a.study_title   || '',
      disease_areas: a.disease_areas || [],
      instruments:   a.instruments   || [],
      irb_status:    a.irb_status    || '',
      description:   a.description   || '',
      open_science:  a.open_science  || false,
      lmic_eligible: a.lmic_eligible || false,
      lmic_tier:     a.open_science  || false,
      orcid:         a.orcid         || '',
      linkedin:      a.linkedin      || '',
      preferred_name:a.preferred_name|| '',
      referral:      a.referral      || '',
      status:        'pending',
      application_ref: a.application_ref || '',
      applied_at:    a.applied_at    || Date.now(),
      approved_at:   Date.now(),
      tessera_id:    null,
      source:        'tessera-signup-form-v1',
    };
    await db.ref('consortium_members').push(memberData);
    // 2. Mark application as approved
    await db.ref('consortium_applications/' + key + '/status').set('approved');
    document.getElementById('sc-app-drawer')?.remove();
    if (typeof showToast === 'function') showToast('✓ Application approved. Use the Workspace and Mosaic buttons in the Members tab to complete onboarding.', 5000);
    await _saCons_loadApplications();
    _saCons_renderApplicationsUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    alert('Error approving application: ' + e.message);
  }
};

window._saCons_rejectApp = async function(key) {
  const a = _saCons_applicationsCache.find(x => x._key === key);
  if (!a) return;
  if (!confirm(`Reject application from ${a.name || a.contact_email}?\n\nThis marks the application as rejected. You can reverse this decision by editing the record directly in Firebase.`)) return;
  try {
    await firebase.database().ref('consortium_applications/' + key + '/status').set('rejected');
    document.getElementById('sc-app-drawer')?.remove();
    if (typeof showToast === 'function') showToast('Application marked as rejected.', 2500);
    await _saCons_loadApplications();
    _saCons_renderApplicationsUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// TAB 8: TESSERA MOSAIC
// Manages tessera_tiles in Firebase — each tile appears as a colored hex on
// scalacartafoundation.org/mosaic/
// ═════════════════════════════════════════════════════════════════════════════

const _TESSERA_TIERS = {
  founder:       { label: 'Founder',               color: '#f5f0e0', border: 'rgba(240,232,210,0.6)', bg: 'rgba(240,232,210,0.08)' },
  institutional: { label: 'Institutional Partner', color: '#d4a843', border: 'rgba(212,168,67,0.4)',  bg: 'rgba(212,168,67,0.08)'  },
  validation:    { label: 'Validation Partner',    color: '#06b6d4', border: 'rgba(6,182,212,0.4)',   bg: 'rgba(6,182,212,0.08)'   },
  affiliate:     { label: 'Affiliate Partner',     color: '#10b981', border: 'rgba(16,185,129,0.4)',  bg: 'rgba(16,185,129,0.08)'  },
  student:       { label: 'Student Affiliate',     color: '#8b6ff5', border: 'rgba(139,111,245,0.4)', bg: 'rgba(139,111,245,0.08)' },
  industry:      { label: 'Industry Partner',      color: '#f59e0b', border: 'rgba(245,158,11,0.4)',  bg: 'rgba(245,158,11,0.08)'  },
};

let _saTessera_cache = [];

async function _saTessera_load() {
  const snap = await firebase.database().ref('tessera_tiles').orderByChild('joinedAt').once('value');
  const raw  = snap.val() || {};
  _saTessera_cache = Object.entries(raw)
    .map(([k, v]) => ({ _key: k, ...v }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

function _saTessera_tierBadge(tier) {
  const t = _TESSERA_TIERS[tier] || _TESSERA_TIERS.institutional;
  const textColor   = tier === 'founder' ? '#7a6235' : t.color;
  const bgColor     = tier === 'founder' ? 'rgba(210,188,140,0.18)' : t.bg;
  const borderColor = tier === 'founder' ? 'rgba(180,150,90,0.55)' : t.border;
  return `<span style="display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1px solid ${borderColor};background:${bgColor};color:${textColor};white-space:nowrap;">${_saCons_esc(t.label)}</span>`;
}

function _saTessera_hexSwatch(tier) {
  const t = _TESSERA_TIERS[tier] || _TESSERA_TIERS.institutional;
  const hw = 11, s = 13;
  const pts = [
    `${hw},0`, `${hw*2},${s*0.5}`, `${hw*2},${s*1.5}`,
    `${hw},${s*2}`, `0,${s*1.5}`, `0,${s*0.5}`
  ].join(' ');
  return `<svg width="${hw*2}" height="${s*2}" viewBox="0 0 ${hw*2} ${s*2}" style="flex-shrink:0;vertical-align:middle;">
    <polygon points="${pts}" fill="${t.color}" opacity="0.85"/>
  </svg>`;
}

function _saCons_renderTessera(container) {
  container.innerHTML = `<div style="color:${_CC.muted};padding:20px;font-size:0.90rem;">Loading tessera tiles…</div>`;
  _saTessera_load().then(() => _saTessera_renderUI(container)).catch(e => {
    container.innerHTML = `<div style="color:${_CC.red};padding:20px;">Error loading tiles: ${_saCons_esc(e.message)}</div>`;
  });
}

function _saTessera_renderUI(container) {
  const total = _saTessera_cache.length;
  const countries = new Set(_saTessera_cache.map(t => t.country).filter(Boolean));

  const tierCounts = {};
  _saTessera_cache.forEach(t => {
    const k = t.tier || 'institutional';
    tierCounts[k] = (tierCounts[k] || 0) + 1;
  });

  const statCards = Object.entries(_TESSERA_TIERS).map(([key, t]) => `
    <div style="background:${_CC.surface};border:1px solid ${t.border};border-radius:9px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;min-width:130px;">
      <div style="font-size:1.5rem;font-weight:700;color:${t.color};font-family:'IBM Plex Mono',monospace;line-height:1;">${tierCounts[key] || 0}</div>
      <div style="font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">${_saCons_esc(t.label)}</div>
    </div>`).join('');

  const _tessIndividualTiers = new Set(['student', 'affiliate']);
  const rows = _saTessera_cache.length ? _saTessera_cache.map((tile, seq) => `
    <tr>
      <td style="text-align:center;color:${_CC.dim};font-size:0.78rem;">${seq + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:9px;">
          ${_saTessera_hexSwatch(tile.tier)}
          <div>
            <div style="font-weight:600;color:${_CC.text};">${_saCons_esc(tile.name || '—')}</div>
            ${tile.role ? `<div style="font-size:0.70rem;color:${_CC.amber};margin-top:1px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.06em;">${_saCons_esc(tile.role)}</div>` : ''}
            ${(tile.affiliation || tile.institution) ? `<div style="font-size:0.75rem;color:${_CC.dim};margin-top:1px;">${_saCons_esc(tile.affiliation || tile.institution)}</div>` : ''}
            <div style="display:flex;gap:10px;margin-top:2px;flex-wrap:wrap;">
              ${tile.orcid ? `<a href="https://orcid.org/${_saCons_esc(tile.orcid)}" target="_blank" rel="noopener" style="font-size:0.66rem;font-family:'IBM Plex Mono',monospace;color:#a6ce39;text-decoration:none;letter-spacing:0.04em;">ORCID ↗</a>` : ''}
              ${tile.linkedin ? `<a href="${_saCons_esc(tile.linkedin)}" target="_blank" rel="noopener" style="font-size:0.66rem;font-family:'IBM Plex Mono',monospace;color:#0a66c2;text-decoration:none;letter-spacing:0.04em;">LinkedIn ↗</a>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td style="font-size:0.90rem;">${_saCons_esc(tile.countryFlag || '')} <span style="color:${_CC.muted};font-size:0.82rem;">${_saCons_esc(tile.country || '—')}</span></td>
      <td>${_saTessera_tierBadge(tile.tier)}</td>
      <td style="color:${_CC.dim};font-size:0.78rem;white-space:nowrap;">${tile.joinedAt ? new Date(tile.joinedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—'}</td>
      <td onclick="event.stopPropagation();" style="white-space:nowrap;">
        <button class="sc-action-btn"
          onclick="_saTessera_edit('${_saCons_esc(tile._key)}')"
          style="margin-right:6px;">
          Edit
        </button>
        ${tile.member_key
          ? `<button class="sc-action-btn" style="opacity:0.4;cursor:default;margin-right:6px;" disabled title="Linked to member record">Registry ✓</button>`
          : `<button class="sc-action-btn sc-action-btn-amber" onclick="_saTessera_registerMember('${_saCons_esc(tile._key)}')" style="margin-right:6px;">Register +</button>`}
        <button class="sc-action-btn sc-action-btn-danger"
          onclick="_saTessera_remove('${_saCons_esc(tile._key)}','${_saCons_esc(tile.name || '')}')">
          Remove
        </button>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;padding:48px;color:${_CC.dim};font-size:0.88rem;">No tiles yet. Add the first partner below.</td></tr>`;

  const tierOpts = Object.entries(_TESSERA_TIERS).map(([k, t]) =>
    `<option value="${k}">${t.label}</option>`).join('');

  const countryOpts = _CONS_COUNTRIES.map(c =>
    `<option value="${_saCons_esc(c)}">${_saCons_esc(c)}</option>`).join('');

  container.innerHTML = `
    <!-- Stats row -->
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:9px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;min-width:100px;">
        <div style="font-size:1.5rem;font-weight:700;color:${_CC.amber};font-family:'IBM Plex Mono',monospace;line-height:1;">${total}</div>
        <div style="font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Total Tiles</div>
      </div>
      <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:9px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;min-width:100px;">
        <div style="font-size:1.5rem;font-weight:700;color:${_CC.cyan};font-family:'IBM Plex Mono',monospace;line-height:1;">${countries.size}</div>
        <div style="font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;color:${_CC.dim};">Countries</div>
      </div>
      ${statCards}
    </div>

    <!-- Live mosaic link -->
    <div style="background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.14);border-radius:9px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:22px;flex-wrap:wrap;">
      <span style="font-size:0.82rem;color:${_CC.muted};">Live mosaic:</span>
      <a href="https://scalacartafoundation.org/mosaic/" target="_blank" rel="noopener"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;color:${_CC.amber};text-decoration:none;">
        scalacartafoundation.org/mosaic/ ↗
      </a>
      <span style="font-size:0.78rem;color:${_CC.dim};">Tiles update live via Firebase listener.</span>
    </div>

    <!-- Add tile form -->
    <div style="background:${_CC.surface};border:1px solid ${_CC.border};border-radius:10px;padding:20px 22px;margin-bottom:24px;">
      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:14px;">Add Partner Tile</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:flex-end;">
        <div>
          <label class="sc-label" id="sc-tess-name-label" for="sc-tess-name">Institution / Name <span style="color:${_CC.red};">*</span></label>
          <input id="sc-tess-name" class="sc-input" type="text" placeholder="University of Porto" />
        </div>
        <div>
          <label class="sc-label" for="sc-tess-country">Country</label>
          <select id="sc-tess-country" class="sc-input" style="cursor:pointer;" onchange="_saTessera_updateFlag(this.value)">${countryOpts}</select>
        </div>
        <div>
          <label class="sc-label" for="sc-tess-tier">Tier</label>
          <select id="sc-tess-tier" class="sc-input" style="cursor:pointer;" onchange="_saTessera_onTierChange(this.value)">${tierOpts}</select>
        </div>
        <div>
          <label class="sc-label" for="sc-tess-flag">Flag Emoji</label>
          <input id="sc-tess-flag" class="sc-input" type="text" placeholder="🇵🇹" maxlength="4" style="font-size:1.1rem;" />
        </div>
        <button id="sc-tess-add-btn" onclick="_saTessera_add()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 20px;border-radius:7px;cursor:pointer;white-space:nowrap;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          + Add Tile
        </button>
      </div>
      <!-- Individual fields — shown when tier is student, affiliate, or founder -->
      <div id="sc-tess-individual-fields" style="display:none;margin-top:10px;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
        <div>
          <label class="sc-label" for="sc-tess-role">Role / Title</label>
          <input id="sc-tess-role" class="sc-input" type="text" placeholder="PhD Candidate" />
        </div>
        <div>
          <label class="sc-label" for="sc-tess-affiliation">Affiliation</label>
          <input id="sc-tess-affiliation" class="sc-input" type="text" placeholder="University of Porto" />
        </div>
        <div>
          <label class="sc-label" for="sc-tess-orcid">ORCID</label>
          <input id="sc-tess-orcid" class="sc-input" type="text" placeholder="0000-0000-0000-0000" />
        </div>
        <div>
          <label class="sc-label" for="sc-tess-linkedin">LinkedIn URL</label>
          <input id="sc-tess-linkedin" class="sc-input" type="text" placeholder="https://linkedin.com/in/…" />
        </div>
      </div>
      <div id="sc-tess-err" style="display:none;margin-top:10px;font-size:0.80rem;color:${_CC.red};"></div>
    </div>

    <!-- Tiles table -->
    <div style="overflow-x:auto;border:1px solid ${_CC.border};border-radius:10px;">
      <table class="sc-table">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Name / Institution</th>
            <th>Country</th>
            <th>Tier</th>
            <th>Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="sc-tess-tbody">${rows}</tbody>
      </table>
    </div>
  `;

  // Pre-fill flag for default country
  const defaultCountry = document.getElementById('sc-tess-country')?.value;
  if (defaultCountry) _saTessera_updateFlag(defaultCountry);
}

window._saTessera_updateFlag = function(country) {
  const el = document.getElementById('sc-tess-flag');
  if (!el) return;
  const flag = _CONS_FLAGS[country] || '';
  el.value = flag;
};

const _TESSERA_INDIVIDUAL_TIERS = new Set(['student', 'affiliate', 'founder']);

window._saTessera_onTierChange = function(tier) {
  const fieldsEl = document.getElementById('sc-tess-individual-fields');
  const labelEl  = document.getElementById('sc-tess-name-label');
  const nameEl   = document.getElementById('sc-tess-name');
  const isIndividual = _TESSERA_INDIVIDUAL_TIERS.has(tier);

  if (fieldsEl) fieldsEl.style.display = isIndividual ? 'grid' : 'none';
  if (labelEl)  labelEl.innerHTML = tier === 'founder'
    ? `Founder Name <span style="color:#ef4444;">*</span>`
    : isIndividual
      ? `Full Name <span style="color:#ef4444;">*</span>`
      : `Institution / Name <span style="color:#ef4444;">*</span>`;
  if (nameEl)   nameEl.placeholder = tier === 'founder' ? 'Dr. Philip Morisky' : isIndividual ? 'Dr. Jane Smith' : 'University of Porto';
};

window._saTessera_add = async function() {
  const name        = (document.getElementById('sc-tess-name')?.value        || '').trim();
  const country     = document.getElementById('sc-tess-country')?.value      || '';
  const tier        = document.getElementById('sc-tess-tier')?.value         || 'institutional';
  const flag        = (document.getElementById('sc-tess-flag')?.value        || '').trim();
  const role        = (document.getElementById('sc-tess-role')?.value        || '').trim();
  const affiliation = (document.getElementById('sc-tess-affiliation')?.value || '').trim();
  const orcid       = (document.getElementById('sc-tess-orcid')?.value       || '').trim();
  const linkedin    = (document.getElementById('sc-tess-linkedin')?.value    || '').trim();
  const errEl       = document.getElementById('sc-tess-err');
  const btn         = document.getElementById('sc-tess-add-btn');

  if (!name) {
    errEl.textContent = _TESSERA_INDIVIDUAL_TIERS.has(tier) ? 'Full name is required.' : 'Institution / name is required.';
    errEl.style.display = 'block';
    document.getElementById('sc-tess-name')?.focus();
    return;
  }
  errEl.style.display = 'none';
  btn.textContent = 'Adding…';
  btn.disabled = true;

  const record = { name, country, countryFlag: flag, tier, joinedAt: Date.now() };
  if (role)        record.role        = role;
  if (affiliation) record.affiliation = affiliation;
  if (orcid)       record.orcid       = orcid;
  if (linkedin)    record.linkedin    = linkedin;

  try {
    await firebase.database().ref('tessera_tiles').push(record);
    if (typeof showToast === 'function') showToast(`✓ "${name}" added to the Tessera mosaic.`, 2500);
    document.getElementById('sc-tess-name').value = '';
    if (document.getElementById('sc-tess-role'))        document.getElementById('sc-tess-role').value = '';
    if (document.getElementById('sc-tess-affiliation')) document.getElementById('sc-tess-affiliation').value = '';
    if (document.getElementById('sc-tess-orcid'))       document.getElementById('sc-tess-orcid').value = '';
    if (document.getElementById('sc-tess-linkedin'))    document.getElementById('sc-tess-linkedin').value = '';
    await _saTessera_load();
    _saTessera_renderUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    btn.textContent = '+ Add Tile';
    btn.disabled = false;
  }
};

window._saTessera_edit = function(key) {
  const tile = _saTessera_cache.find(t => t._key === key);
  if (!tile) return;

  const isIndividual = _TESSERA_INDIVIDUAL_TIERS.has(tile.tier);
  const tierOpts = Object.entries(_TESSERA_TIERS).map(([k, t]) =>
    `<option value="${k}" ${tile.tier === k ? 'selected' : ''}>${t.label}</option>`).join('');
  const countryOpts = _CONS_COUNTRIES.map(c =>
    `<option value="${_saCons_esc(c)}" ${tile.country === c ? 'selected' : ''}>${_saCons_esc(c)}</option>`).join('');

  const inp = (id, label, val, ph) => `
    <div>
      <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_CC.dim};margin-bottom:4px;">${label}</label>
      <input id="ste-${id}" class="sc-input" type="text" value="${_saCons_esc(val || '')}" placeholder="${ph}" style="width:100%;box-sizing:border-box;" />
    </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'sc-tess-edit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <div style="background:${_CC.bg2};border:1px solid ${_CC.borderB};border-radius:12px;padding:26px 28px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;">
      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:18px;">Edit Tile · ${_saCons_esc(tile.name || '')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        ${inp('name', 'Name', tile.name, 'Philip Morisky')}
        <div>
          <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_CC.dim};margin-bottom:4px;">Tier</label>
          <select id="ste-tier" class="sc-input" style="width:100%;box-sizing:border-box;cursor:pointer;" onchange="_saTessera_editTierChange(this.value)">${tierOpts}</select>
        </div>
        <div>
          <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_CC.dim};margin-bottom:4px;">Country</label>
          <select id="ste-country" class="sc-input" style="width:100%;box-sizing:border-box;cursor:pointer;" onchange="_saTessera_editUpdateFlag(this.value)">${countryOpts}</select>
        </div>
        ${inp('flag', 'Flag Emoji', tile.countryFlag, '🇺🇸')}
      </div>
      <div id="ste-individual-fields" style="display:${isIndividual ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        ${inp('role', 'Role / Title', tile.role, 'Founder, Creator of MAP & ATLAS')}
        ${inp('affiliation', 'Affiliation', tile.affiliation, 'Adherence Cartography')}
        ${inp('orcid', 'ORCID', tile.orcid, '0000-0000-0000-0000')}
        ${inp('linkedin', 'LinkedIn URL', tile.linkedin, 'https://linkedin.com/in/…')}
      </div>
      <div id="ste-err" style="display:none;font-size:0.80rem;color:${_CC.red};margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid ${_CC.border};padding-top:16px;margin-top:4px;">
        <button onclick="document.getElementById('sc-tess-edit-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 16px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid ${_CC.border};color:${_CC.muted};">
          Cancel
        </button>
        <button id="ste-save-btn" onclick="_saTessera_saveEdit('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 20px;border-radius:6px;cursor:pointer;background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};">
          Save Changes →
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window._saTessera_editTierChange = function(tier) {
  const el = document.getElementById('ste-individual-fields');
  if (el) el.style.display = _TESSERA_INDIVIDUAL_TIERS.has(tier) ? 'grid' : 'none';
};

window._saTessera_editUpdateFlag = function(country) {
  const el = document.getElementById('ste-flag');
  if (el) el.value = _CONS_FLAGS[country] || '';
};

window._saTessera_saveEdit = async function(key) {
  const name    = (document.getElementById('ste-name')?.value        || '').trim();
  const tier    =  document.getElementById('ste-tier')?.value        || 'institutional';
  const country =  document.getElementById('ste-country')?.value     || '';
  const flag    = (document.getElementById('ste-flag')?.value        || '').trim();
  const role    = (document.getElementById('ste-role')?.value        || '').trim();
  const aff     = (document.getElementById('ste-affiliation')?.value || '').trim();
  const orcid   = (document.getElementById('ste-orcid')?.value       || '').trim();
  const linkedin= (document.getElementById('ste-linkedin')?.value    || '').trim();
  const errEl   = document.getElementById('ste-err');
  const btn     = document.getElementById('ste-save-btn');

  if (!name) {
    errEl.textContent = 'Name is required.';
    errEl.style.display = 'block';
    document.getElementById('ste-name')?.focus();
    return;
  }
  errEl.style.display = 'none';
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const data = { name, tier, country, countryFlag: flag };
  if (role)     data.role        = role;     else data.role        = null;
  if (aff)      data.affiliation = aff;      else data.affiliation = null;
  if (orcid)    data.orcid       = orcid;    else data.orcid       = null;
  if (linkedin) data.linkedin    = linkedin; else data.linkedin    = null;

  try {
    await firebase.database().ref('tessera_tiles/' + key).update(data);
    document.getElementById('sc-tess-edit-overlay')?.remove();
    if (typeof showToast === 'function') showToast('Tile updated.', 2000);
    await _saTessera_load();
    _saTessera_renderUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    btn.textContent = 'Save Changes →';
    btn.disabled = false;
  }
};

window._saTessera_remove = async function(key, name) {
  if (!confirm(`Remove "${name}" from the Tessera mosaic?\n\nThis removes their tile from scalacartafoundation.org/mosaic/ immediately.`)) return;
  try {
    await firebase.database().ref('tessera_tiles/' + key).remove();
    if (typeof showToast === 'function') showToast(`Tile removed.`, 2000);
    await _saTessera_load();
    _saTessera_renderUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Remove failed: ' + e.message, 3000);
  }
};

// ── Register mosaic tile → consortium_members ──────────────────────────────
window._saTessera_registerMember = function(key) {
  const tile = _saTessera_cache.find(t => t._key === key);
  if (!tile) return;
  _saCons_injectStyles();

  const consTier = _TESSERA_TIER_TO_CONS[tile.tier] ?? 1;
  const tierDef  = _CONS_TIERS[consTier];
  const isIndiv  = new Set(['founder','affiliate','student']).has(tile.tier);
  const instVal  = isIndiv ? (tile.affiliation || '') : (tile.institution || tile.name || '');
  const nameVal  = isIndiv ? (tile.name || '') : '';

  const countryOpts = _CONS_COUNTRIES.map(c =>
    `<option value="${_saCons_esc(c)}" ${tile.country === c ? 'selected' : ''}>${_saCons_esc(c)}</option>`
  ).join('');
  const tierOpts = Object.entries(_CONS_TIERS).map(([id, t]) =>
    `<option value="${id}" ${id == consTier ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sc-reg-member-overlay';
  overlay.className = 'sc-modal-overlay';
  overlay.innerHTML = `
    <div class="sc-modal" role="dialog" aria-modal="true" aria-label="Register as Member">
      <button onclick="document.getElementById('sc-reg-member-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CC.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CC.amber};margin-bottom:6px;">Add to Member Registry</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:300;color:${_CC.text};margin-bottom:4px;">${_saCons_esc(tile.name || tile.institution || '—')}</div>
      <div style="font-size:0.72rem;color:${_CC.dim};margin-bottom:20px;">Links the existing mosaic tile to a new consortium_members record.</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="sc-label">Full Name</label>
          <input id="sc-rm-name" class="sc-input" value="${_saCons_esc(nameVal)}" placeholder="Full name">
        </div>
        <div>
          <label class="sc-label">Email <span style="color:${_CC.red};">*</span></label>
          <input id="sc-rm-email" class="sc-input" type="email" placeholder="contact@institution.edu">
        </div>
        <div>
          <label class="sc-label">Institution / Affiliation</label>
          <input id="sc-rm-inst" class="sc-input" value="${_saCons_esc(instVal)}" placeholder="Institution">
        </div>
        <div>
          <label class="sc-label">Country</label>
          <select id="sc-rm-country" class="sc-input"><option value="">— select —</option>${countryOpts}</select>
        </div>
        <div>
          <label class="sc-label">Tier</label>
          <select id="sc-rm-tier" class="sc-input">${tierOpts}</select>
        </div>
      </div>

      <div id="sc-rm-err" style="color:${_CC.red};font-size:0.78rem;margin-top:12px;display:none;"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CC.border};padding-top:18px;">
        <button onclick="document.getElementById('sc-reg-member-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CC.border};
                 background:transparent;color:${_CC.muted};transition:all 0.15s;">
          Cancel
        </button>
        <button id="sc-rm-submit" onclick="_saTessera_submitRegisterMember('${_saCons_esc(key)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CC.amberFaint};border:1px solid ${_CC.amberDim};color:${_CC.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CC.amberFaint}'">
          Add to Registry →
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

window._saTessera_submitRegisterMember = async function(tileKey) {
  const btn    = document.getElementById('sc-rm-submit');
  const errEl  = document.getElementById('sc-rm-err');
  const name   = (document.getElementById('sc-rm-name')?.value   || '').trim();
  const email  = (document.getElementById('sc-rm-email')?.value  || '').trim();
  const inst   = (document.getElementById('sc-rm-inst')?.value   || '').trim();
  const country= document.getElementById('sc-rm-country')?.value || '';
  const tier   = parseInt(document.getElementById('sc-rm-tier')?.value || '1', 10);

  errEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Email is required.'; errEl.style.display = 'block'; return; }

  btn.textContent = 'Saving…';
  btn.disabled = true;
  try {
    const db = firebase.database();
    const memberRef = await db.ref('consortium_members').push({
      name:               name || null,
      email,
      contact_email:      email,
      institution:        inst || null,
      country,
      tier,
      instruments:        ['MAP'],
      status:             'active',
      joined_at:          Date.now(),
      contribution_count: 0,
      tessera_tile_key:   tileKey,
      source:             'tile-import',
    });
    // Cross-link tile → member
    await db.ref('tessera_tiles/' + tileKey + '/member_key').set(memberRef.key);
    document.getElementById('sc-reg-member-overlay')?.remove();
    if (typeof showToast === 'function') showToast(`✓ "${name || email}" added to the member registry and linked to tile.`, 3500);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('consortium_member_registered_from_tile', { tileKey, memberKey: memberRef.key });
    await _saTessera_load();
    _saTessera_renderUI(document.getElementById('sc-tab-content'));
  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    btn.textContent = 'Add to Registry →';
    btn.disabled = false;
  }
};
