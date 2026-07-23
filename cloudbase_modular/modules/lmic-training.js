// lmic-training.js — LMIC Research Training Curriculum
// ATLAS platform: in-app capacity building for LMIC students and researchers
// Entry point: window.lmicTrainingInit(container)
// Firebase paths: consortium_members/{uid} (membership check), lmic_access/{uid} (tier check)

// ── Colors ────────────────────────────────────────────────────────────────────
const _LTC = window._ATLAS_COLORS || {
  bg:'#070e1d', bg2:'#0a1527', surface:'#0d1b2e',
  border:'rgba(212,168,67,0.12)', borderB:'rgba(212,168,67,0.26)',
  amber:'#d4a843', amberDim:'rgba(212,168,67,0.55)', amberFaint:'rgba(212,168,67,0.09)',
  cyan:'#38bdf8', cyanDim:'rgba(56,189,248,0.5)',
  green:'#2ec98a', greenDim:'rgba(46,201,138,0.45)', greenFaint:'rgba(46,201,138,0.08)',
  orange:'#f97316', orangeFaint:'rgba(249,115,22,0.07)',
  red:'#ef4444', blue:'#4e9cf5', purple:'#8b6ff5',
  text:'rgba(205,216,232,0.92)', muted:'rgba(138,160,184,0.8)',
  dim:'rgba(96,120,152,0.65)',
};

// ── Curriculum modules ────────────────────────────────────────────────────────
const _LTC_MODULES = [
  {
    id: 'map-intro',
    icon: '◈',
    title: 'Module 1: Understanding MAP',
    duration: '~20 min',
    color: _LTC.amber,
    colorFaint: 'rgba(212,168,67,0.07)',
    colorBorder: 'rgba(212,168,67,0.25)',
    summary: 'The Multidimensional Adherence Parameters (MAP) instrument: what it measures, the three AEC behavioral domains, and how the Predictive Emergence (PE) geometric mean is calculated.',
    steps: [
      { label: 'What MAP measures', body: 'MAP is an 8-item cross-sectional instrument designed by Philip Morisky to capture medication adherence across three behavioral domains: Architecture (items 2, 3, 6), Execution (items 1, 4, 5, 8), and Context (item 7). Unlike additive scales, MAP scores both an additive total and a geometric mean PE score simultaneously.' },
      { label: 'The AEC domain structure', body: 'Architecture: intentional planning, regimen understanding, and structural barriers to adherence. Execution: day-to-day behavioral compliance, forgetfulness, and dose-taking habits. Context: perceived social, environmental, and situational burden. Each domain captures a distinct and non-compensatory dimension of adherence.' },
      { label: 'The PE formula', body: 'Performance Execution (PE) = (Architecture × Execution × Context)^(1/3). This geometric mean is non-compensatory: a zero in any domain drives the score to zero regardless of strength in the others. Domain scores range from 0 to 1; PE ranges from 0 to 1, where higher values indicate greater adherence stability.' },
      { label: 'MAP vs MMAS-8', body: 'MAP is the second-generation successor to MMAS-8, developed by the same research lineage. MAP retains backward compatibility with MMAS-8 additive scoring while adding the PE geometric framework. Use MAP for all new studies; MMAS-8 additive scores can still be computed from MAP items for continuity with legacy literature.' },
    ],
  },
  {
    id: 'map-admin',
    icon: '⊕',
    title: 'Module 2: Administering MAP in the Field',
    duration: '~15 min',
    color: _LTC.cyan,
    colorFaint: 'rgba(56,189,248,0.07)',
    colorBorder: 'rgba(56,189,248,0.25)',
    summary: 'Practical guide to setting up an assessment session on ATLAS, obtaining electronic consent, and administering MAP in low-resource or shared-device environments.',
    steps: [
      { label: 'Setting up your workspace', body: 'Log in to ATLAS with your workspace key. Navigate to the Assessment tab and verify your session is active (green indicator in the header). For field deployments, bookmark the assess URL on the shared device and pre-test the consent screen before your first patient.' },
      { label: 'Consent and language selection', body: 'ATLAS supports 60+ languages. On the consent screen, select the patient\'s preferred language from the dropdown. The full consent form and all MAP items will render in the selected language. Consent is electronic and timestamped; the patient taps "I Agree" to proceed.' },
      { label: 'Shared-device deployment', body: 'In clinic settings where patients share a device: complete one session, submit, then refresh the page to clear the session before the next patient. Do not use browser autofill on shared devices. For high-volume screenings, use the QR generation module (in Records) to produce per-session QR codes so patients can scan and begin on their own device.' },
      { label: 'Offline and low-bandwidth settings', body: 'If the connection is unstable, ATLAS will detect low bandwidth and activate the Data-Lite mode automatically (reduced visualizations, text-only layout). Assessment submission queues locally and syncs when connectivity resumes. You can verify submission status under Records after reconnecting.' },
    ],
  },
  {
    id: 'map-results',
    icon: '∿',
    title: 'Module 3: Interpreting MAP Results',
    duration: '~25 min',
    color: _LTC.green,
    colorFaint: 'rgba(46,201,138,0.07)',
    colorBorder: 'rgba(46,201,138,0.25)',
    summary: 'Reading the PE score, interpreting domain profiles, identifying adherence phenotypes, and communicating findings to patients and clinical teams.',
    steps: [
      { label: 'PE score bands', body: 'PE ≥ 0.85: Optimal stability. PE 0.70–0.84: Good stability — minor barriers present. PE 0.55–0.69: Moderate concern — targeted intervention warranted. PE 0.40–0.54: Poor stability — structured intervention recommended. PE < 0.40: Critical instability — immediate assessment of barriers required.' },
      { label: 'Domain profile patterns', body: 'A low Architecture score with high Execution and Context suggests the patient understands the importance of adherence but lacks a reliable structural system (e.g. pill organizer, alarm, refill routine). A low Context score with strong Architecture and Execution suggests environmental or social barriers (cost, stigma, caregiver burden) are the primary driver. Interventions should target the weakest domain specifically.' },
      { label: 'Communicating results to patients', body: 'Avoid framing PE scores as a "grade." Use language like: "Your results show that remembering to take medications consistently is the area where you might benefit from some extra support." Present the domain breakdown visually (the ATLAS spider chart) and invite the patient to identify which domain resonates most with their experience.' },
      { label: 'Reporting in publications', body: 'Report: (1) PE mean and SD, (2) domain-level means, (3) proportion in each score band, (4) Cronbach alpha per domain. Use the ATLAS Publication License to generate the citable Methods section. The platform pre-generates APA, Vancouver, and Harvard citation strings for MAP and for the ATLAS platform itself.' },
    ],
  },
  {
    id: 'peacs-intro',
    icon: '≋',
    title: 'Module 4: Introduction to PEACS',
    duration: '~30 min',
    color: _LTC.purple,
    colorFaint: 'rgba(139,111,245,0.07)',
    colorBorder: 'rgba(139,111,245,0.25)',
    summary: 'PEACS (Predictive Emergence Assessment for Clinical Services): the three-scale, three-interval longitudinal instrument that turns adherence from a snapshot into a trajectory.',
    steps: [
      { label: 'MAP vs PEACS: photograph vs film', body: 'MAP is a photograph: it captures where a patient is at one moment in time. PEACS is a film: it tracks where a patient is going by measuring the same AEC domains across three time intervals. BASE scale: monthly (Architecture domain, 7 items). MVMT scale: weekly (Execution domain, 7 items). STRATA scale: quarterly (Context domain, 8 items). Together, they produce a 22-item composite trajectory.' },
      { label: 'The three PEACS scales in practice', body: 'BASE (monthly): captures whether the structural architecture of the patient\'s adherence regimen is stable or drifting. MVMT (weekly): captures whether day-to-day behavioral execution is consistent. STRATA (quarterly): captures whether contextual pressures (cost, environment, support) are improving or deteriorating. Timing matters: MVMT is sensitive to short-term disruptions; STRATA reveals slow-moving structural change.' },
      { label: 'Setting up PEACS in ATLAS', body: 'Navigate to the PEACS module from the Assessment tab. Enable PEACS for a patient after their baseline MAP is complete. ATLAS will schedule and send reminders for each scale at the correct interval. All three scales must have at least one completed administration before a phenotype trajectory is generated.' },
      { label: 'Phenotype trajectories', body: 'PEACS classifies patients into four trajectory phenotypes: Stable Optimal (consistently high across all three scales); Architecturally Fragile (stable BASE but declining MVMT); Contextually Pressured (strong BASE and MVMT, deteriorating STRATA); and Unstable (declining across multiple scales). Phenotype output is used to guide targeted intervention rather than generic adherence counseling.' },
    ],
  },
  {
    id: 'study-design',
    icon: '⬡',
    title: 'Module 5: Designing a Study on ATLAS',
    duration: '~35 min',
    color: _LTC.blue,
    colorFaint: 'rgba(78,156,245,0.07)',
    colorBorder: 'rgba(78,156,245,0.25)',
    summary: 'From IRB application to data management plan to REDCap bridge: how to structure a research study using ATLAS infrastructure from submission to publication.',
    steps: [
      { label: 'Study registry and TESSERA ID', body: 'Register your study under the TESSERA tab (Grant Resources → My TESSERA). Once your TESSERA GRC membership is approved, submit a study protocol for review. Approved studies receive a TESSERA Study ID (format: TESSERA-YYYY-XXXX) which is cited in your publications as evidence of consortium oversight and methodological review.' },
      { label: 'IRB application language', body: 'Use the Grant Resources templates to generate pre-approved IRB language for: ATLAS platform description, MAP instrument justification, PEACS timeline justification, data management plan (AES-256, TLS 1.3, 7-year retention), and CONSORT tracking methodology. All templates are accessible under the TESSERA tab → Grant Resources → Templates.' },
      { label: 'REDCap integration', body: 'ATLAS integrates with REDCap via the REDCap Bridge (Admin → REDCap). Export your ATLAS cohort data in REDCap-compatible format, or import existing REDCap records for MAP scoring. The bridge maps ATLAS field names to REDCap instrument variable conventions. Contact info@adherence.cc for institution-level REDCap API configuration.' },
      { label: 'Sample size planning', body: 'Use the Statistical Power Advisor (Publications tab → Power) to calculate required N for your study design. The tool supports MAP PE as a continuous outcome, domain scores as secondary outcomes, and between-group comparisons. Enter your target effect size (Cohen\'s d), alpha (typically 0.05), and desired power (typically 0.80 or 0.90) to generate a sample size estimate with confidence intervals.' },
    ],
  },
  {
    id: 'publishing',
    icon: '✦',
    title: 'Module 6: Publishing Your Findings',
    duration: '~20 min',
    color: _LTC.amber,
    colorFaint: 'rgba(212,168,67,0.07)',
    colorBorder: 'rgba(212,168,67,0.25)',
    summary: 'Publication License, thesis Methods generator, citation strings, and how LMIC researchers access all publication tools at no cost through TESSERA GRC membership.',
    steps: [
      { label: 'Publication License (LMIC: waived)', body: 'The ATLAS Publication License covers instrument licensing for MAP and MMAS-8 in academic publications. For TESSERA GRC members at LMIC institutions, the license fee is fully waived. Simply navigate to Publications → Publish and the LMIC waiver will be applied automatically. You will still complete the publication registration form (PI name, institution, title, journal target) to generate your citable license record.' },
      { label: 'Generating your Methods section', body: 'The Thesis Export tool (Publications tab) generates a complete, publication-ready Methods section pre-populated with your study data: instrument descriptions, participant N, date range, countries represented, domain score statistics, and IRB data handling language. Export as plain text for your manuscript or as a formatted Word-compatible block.' },
      { label: 'Citation strings', body: 'ATLAS generates citation strings for MAP, MMAS-8, PEACS, and the ATLAS platform itself in APA 7, Vancouver, and Harvard formats. Find them under Publications → Citations. Copy the appropriate string for your reference list. The TPE theoretical paper (Morisky, 2026; doi:10.5281/zenodo.18209699) should be cited when discussing the PE geometric mean formula.' },
      { label: 'Co-authorship pathways', body: 'TESSERA GRC members contributing to the global normative MAP database (minimum 50 validated assessments submitted to the consortium dataset) are eligible for co-authorship on the TESSERA GRC normative database paper. Contact info@adherence.cc to verify your contribution count and express interest. Contribution counts are visible in the TESSERA tab → My TESSERA.' },
    ],
  },
];

// ── Language resources ────────────────────────────────────────────────────────
const _LTC_LANGUAGES = [
  { code: 'es', name: 'Español',    flag: '🇪🇸', guide: 'https://www.adherence.cc/resources/map-guide-es', note: 'Guía de administración MAP — América Latina y España' },
  { code: 'pt', name: 'Português',  flag: '🇧🇷', guide: 'https://www.adherence.cc/resources/map-guide-pt', note: 'Guia de administração MAP — Brasil e África Lusófona' },
  { code: 'fr', name: 'Français',   flag: '🇫🇷', guide: 'https://www.adherence.cc/resources/map-guide-fr', note: 'Guide d\'administration MAP — Afrique francophone' },
  { code: 'hi', name: 'हिन्दी',     flag: '🇮🇳', guide: 'https://www.adherence.cc/resources/map-guide-hi', note: 'MAP प्रशासन मार्गदर्शिका — भारत' },
  { code: 'sw', name: 'Kiswahili',  flag: '🇰🇪', guide: 'https://www.adherence.cc/resources/map-guide-sw', note: 'Mwongozo wa utawala wa MAP — Afrika Mashariki' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', guide: 'https://www.adherence.cc/resources/map-guide-id', note: 'Panduan administrasi MAP — Indonesia' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', guide: 'https://www.adherence.cc/resources/map-guide-vi', note: 'Hướng dẫn thực hiện MAP — Việt Nam' },
  { code: 'tl', name: 'Filipino',   flag: '🇵🇭', guide: 'https://www.adherence.cc/resources/map-guide-tl', note: 'Gabay sa administrasyon ng MAP — Pilipinas' },
  { code: 'bn', name: 'বাংলা',      flag: '🇧🇩', guide: 'https://www.adherence.cc/resources/map-guide-bn', note: 'MAP প্রশাসন নির্দেশিকা — বাংলাদেশ' },
  { code: 'ar', name: 'العربية',    flag: '🇪🇬', guide: 'https://www.adherence.cc/resources/map-guide-ar', note: 'دليل إدارة خريطة MAP — الشرق الأوسط وشمال أفريقيا', rtl: true },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
function _ltcInjectStyles() {
  if (document.getElementById('ltc-styles')) return;
  const s = document.createElement('style');
  s.id = 'ltc-styles';
  s.textContent = `
    .ltc-header{margin-bottom:24px;}
    .ltc-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:#f97316;margin-bottom:5px;}
    .ltc-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:rgba(205,216,232,0.92);line-height:1.25;}
    .ltc-sub{font-size:0.83rem;color:rgba(138,160,184,0.8);margin-top:6px;line-height:1.55;}
    .ltc-status-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px;}
    .ltc-status-pill{display:inline-flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid;white-space:nowrap;}
    .ltc-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(212,168,67,0.12);margin-bottom:22px;flex-wrap:wrap;}
    .ltc-tab{font-family:'IBM Plex Mono',monospace;font-size:0.69rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 14px;border:none;background:transparent;color:rgba(96,120,152,0.65);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.14s;white-space:nowrap;}
    .ltc-tab:hover{color:rgba(205,216,232,0.92);}
    .ltc-tab.active{color:#f97316;border-bottom-color:#f97316;}
    .ltc-mod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-bottom:22px;}
    .ltc-mod-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:10px;padding:18px 20px;cursor:pointer;transition:border-color 0.18s,transform 0.12s;}
    .ltc-mod-card:hover{border-color:rgba(212,168,67,0.28);transform:translateY(-1px);}
    .ltc-mod-icon{font-size:1.2rem;margin-bottom:8px;line-height:1;}
    .ltc-mod-title{font-family:'IBM Plex Mono',monospace;font-size:0.80rem;font-weight:600;color:rgba(205,216,232,0.92);margin-bottom:5px;}
    .ltc-mod-dur{font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;margin-bottom:8px;}
    .ltc-mod-summary{font-size:0.78rem;color:rgba(138,160,184,0.8);line-height:1.55;}
    .ltc-mod-open{display:none;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:20px 22px;margin-bottom:18px;}
    .ltc-mod-open.visible{display:block;}
    .ltc-mod-open-title{font-family:'IBM Plex Mono',monospace;font-size:0.85rem;font-weight:700;color:rgba(205,216,232,0.92);margin-bottom:16px;}
    .ltc-step{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(249,115,22,0.10);}
    .ltc-step:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
    .ltc-step-label{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;font-weight:600;color:#f97316;margin-bottom:5px;}
    .ltc-step-body{font-size:0.81rem;color:rgba(205,216,232,0.88);line-height:1.65;}
    .ltc-close-btn{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:6px 14px;border-radius:5px;border:1px solid rgba(249,115,22,0.30);background:rgba(249,115,22,0.07);color:#f97316;cursor:pointer;transition:all 0.12s;margin-bottom:18px;}
    .ltc-close-btn:hover{background:rgba(249,115,22,0.15);}
    .ltc-lang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
    .ltc-lang-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:8px;padding:13px 15px;display:flex;flex-direction:column;gap:6px;transition:border-color 0.16s;}
    .ltc-lang-card:hover{border-color:rgba(212,168,67,0.28);}
    .ltc-lang-name{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.92);}
    .ltc-lang-note{font-size:0.76rem;color:rgba(138,160,184,0.8);line-height:1.5;}
    .ltc-lang-btn{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:0.67rem;letter-spacing:0.10em;text-transform:uppercase;padding:4px 11px;border-radius:4px;border:1px solid rgba(56,189,248,0.28);background:rgba(56,189,248,0.06);color:#38bdf8;cursor:pointer;transition:all 0.12s;text-decoration:none;display:inline-block;}
    .ltc-lang-btn:hover{background:rgba(56,189,248,0.13);}
    .ltc-mentor-card{background:#0d1b2e;border:1px solid rgba(212,168,67,0.12);border-radius:9px;padding:15px 17px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;}
    .ltc-mentor-avatar{width:38px;height:38px;border-radius:50%;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.25);display:flex;align-items:center;justify-content:center;font-size:0.90rem;flex-shrink:0;}
    .ltc-mentor-name{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;color:rgba(205,216,232,0.92);}
    .ltc-mentor-meta{font-size:0.76rem;color:rgba(138,160,184,0.8);line-height:1.5;margin-top:3px;}
    .ltc-mentor-region{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid rgba(249,115,22,0.30);background:rgba(249,115,22,0.06);color:#f97316;margin-top:4px;}
    .ltc-contact-btn{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid rgba(46,201,138,0.30);background:rgba(46,201,138,0.07);color:#2ec98a;cursor:pointer;transition:all 0.12s;text-decoration:none;display:inline-block;margin-top:6px;}
    .ltc-contact-btn:hover{background:rgba(46,201,138,0.14);}
    .ltc-cta-box{background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:18px 20px;margin-bottom:20px;}
    .ltc-cta-title{font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:600;color:#f97316;margin-bottom:6px;}
    .ltc-cta-body{font-size:0.81rem;color:rgba(138,160,184,0.8);line-height:1.6;margin-bottom:12px;}
    .ltc-cta-btn{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;padding:9px 20px;border-radius:7px;border:1px solid rgba(249,115,22,0.40);background:rgba(249,115,22,0.10);color:#f97316;cursor:pointer;transition:all 0.14s;}
    .ltc-cta-btn:hover{background:rgba(249,115,22,0.18);}
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _ltcEl(tag, attrs, inner) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  });
  if (inner !== undefined) el.innerHTML = inner;
  return el;
}

function _ltcEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Tab state ─────────────────────────────────────────────────────────────────
let _ltcActiveTab = 'curriculum';
let _ltcOpenModuleId = null;

// ── Status bar ────────────────────────────────────────────────────────────────
function _ltcRenderStatusBar(container, memberData) {
  const isLMIC   = typeof isLMICTier === 'function' ? isLMICTier() : false;
  const country  = (workspaceProfile && workspaceProfile.features && workspaceProfile.features.lmic_country) || '';
  const tesseraId   = (workspaceProfile && workspaceProfile.features && workspaceProfile.features.lmic_tessera_grc_id) || '';
  const isMember = memberData && memberData.status === 'active';
  const isPending = memberData && memberData.status === 'pending';

  const pills = [];

  if (isLMIC) {
    pills.push(`<span class="ltc-status-pill" style="color:#f97316;border-color:rgba(249,115,22,0.35);background:rgba(249,115,22,0.08);">
      🌍 LMIC Access Active${country ? ' · ' + _ltcEsc(country) : ''}
    </span>`);
  }
  if (tesseraId) {
    pills.push(`<span class="ltc-status-pill" style="color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);">
      ⬡ ${_ltcEsc(tesseraId)}
    </span>`);
  }
  if (isMember) {
    pills.push(`<span class="ltc-status-pill" style="color:#2ec98a;border-color:rgba(46,201,138,0.30);background:rgba(46,201,138,0.06);">
      TESSERA GRC Member · Active
    </span>`);
  } else if (isPending) {
    pills.push(`<span class="ltc-status-pill" style="color:#d4a843;border-color:rgba(212,168,67,0.30);background:rgba(212,168,67,0.06);">
      TESSERA GRC Application Pending
    </span>`);
  }
  if (pills.length) {
    const bar = _ltcEl('div', { class: 'ltc-status-bar' }, pills.join(''));
    container.appendChild(bar);
  }
}

// ── Tab: Curriculum ───────────────────────────────────────────────────────────
function _ltcRenderCurriculum(container) {
  const grid = _ltcEl('div', { class: 'ltc-mod-grid' });

  _LTC_MODULES.forEach(function(mod) {
    const card = _ltcEl('div', { class: 'ltc-mod-card', style: 'border-left:3px solid ' + mod.color + ';' });
    card.innerHTML = `
      <div class="ltc-mod-icon" style="color:${mod.color};">${_ltcEsc(mod.icon)}</div>
      <div class="ltc-mod-title">${_ltcEsc(mod.title)}</div>
      <div class="ltc-mod-dur" style="color:${mod.color};">${_ltcEsc(mod.duration)}</div>
      <div class="ltc-mod-summary">${_ltcEsc(mod.summary)}</div>
      <div style="margin-top:12px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;color:${mod.color};opacity:0.8;">Open Module &#8599;</span>
      </div>`;
    card.addEventListener('click', function() { _ltcOpenModule(mod.id, container); });
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function _ltcOpenModule(modId, tabBody) {
  // Remove any open module detail first
  const existing = tabBody.querySelector('.ltc-mod-open.visible');
  if (existing) existing.classList.remove('visible');

  const mod = _LTC_MODULES.find(function(m) { return m.id === modId; });
  if (!mod) return;

  let panel = tabBody.querySelector('#ltc-open-' + modId);
  if (!panel) {
    panel = _ltcEl('div', { class: 'ltc-mod-open', id: 'ltc-open-' + modId });
    panel.innerHTML = `
      <div class="ltc-mod-open-title" style="color:${mod.color};">${_ltcEsc(mod.icon)} &nbsp;${_ltcEsc(mod.title)}</div>
      ${mod.steps.map(function(step) {
        return `<div class="ltc-step">
          <div class="ltc-step-label" style="color:${mod.color};">${_ltcEsc(step.label)}</div>
          <div class="ltc-step-body">${_ltcEsc(step.body)}</div>
        </div>`;
      }).join('')}
      <button class="ltc-close-btn" onclick="this.closest('.ltc-mod-open').classList.remove('visible');">Close Module</button>`;
    const grid = tabBody.querySelector('.ltc-mod-grid');
    if (grid) tabBody.insertBefore(panel, grid);
    else tabBody.appendChild(panel);
  }

  panel.classList.add('visible');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Tab: Language Resources ───────────────────────────────────────────────────
function _ltcRenderLanguages(container) {
  container.appendChild(_ltcEl('div', {
    style: 'font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-bottom:14px;'
  }, 'Administration Guides by Language'));

  container.appendChild(_ltcEl('div', {
    style: 'font-size:0.80rem;color:rgba(138,160,184,0.8);margin-bottom:18px;line-height:1.6;'
  }, 'MAP administration guides are available in the following languages. Each guide covers consent procedures, item-by-item administration instructions, and scoring interpretation in the local language.'));

  const grid = _ltcEl('div', { class: 'ltc-lang-grid' });
  _LTC_LANGUAGES.forEach(function(lang) {
    const card = _ltcEl('div', { class: 'ltc-lang-card' });
    card.innerHTML = `
      <div class="ltc-lang-name">${lang.flag} &nbsp;${_ltcEsc(lang.name)}</div>
      <div class="ltc-lang-note">${_ltcEsc(lang.note)}</div>
      <a href="${_ltcEsc(lang.guide)}" target="_blank" rel="noopener" class="ltc-lang-btn">Download Guide &#8599;</a>`;
    grid.appendChild(card);
  });
  container.appendChild(grid);

  container.appendChild(_ltcEl('div', {
    style: 'margin-top:18px;font-size:0.76rem;color:rgba(96,120,152,0.65);line-height:1.55;'
  }, 'The ATLAS platform interface is available in 60+ languages. Change the assessment language on the consent screen before each session. All MAP items, response scales, and consent text will render in the selected language automatically.'));
}

// ── Tab: Mentorship ───────────────────────────────────────────────────────────
function _ltcRenderMentorship(container, memberData) {
  const isMember = memberData && memberData.status === 'active';

  if (!isMember) {
    const cta = _ltcEl('div', { class: 'ltc-cta-box' });
    cta.innerHTML = `
      <div class="ltc-cta-title">TESSERA GRC Membership Required for Mentorship</div>
      <div class="ltc-cta-body">
        The TESSERA GRC mentor network connects LMIC students and early-career researchers with senior
        PIs across the global adherence science community. Mentorship access is available to
        all active TESSERA GRC members at no cost.
      </div>
      <button class="ltc-cta-btn" onclick="atlasTabSwitch && atlasTabSwitch('tessera')">Apply for TESSERA GRC Membership &#8599;</button>`;
    container.appendChild(cta);
  }

  container.appendChild(_ltcEl('div', {
    style: 'font-family:"IBM Plex Mono",monospace;font-size:0.65rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(96,120,152,0.65);margin-bottom:14px;'
  }, 'TESSERA GRC Mentor Network'));

  container.appendChild(_ltcEl('div', {
    style: 'font-size:0.80rem;color:rgba(138,160,184,0.8);margin-bottom:18px;line-height:1.6;'
  }, 'TESSERA GRC mentors are senior researchers available to provide methodological guidance, grant review support, co-authorship pathways, and study design consultation for LMIC-based projects.'));

  function _renderMentorCard(m) {
    const card = _ltcEl('div', { class: 'ltc-mentor-card' });
    card.innerHTML = `
      <div class="ltc-mentor-avatar">${_ltcEsc(m.initials)}</div>
      <div style="flex:1;">
        <div class="ltc-mentor-name">${_ltcEsc(m.name)}</div>
        <div class="ltc-mentor-meta">${_ltcEsc(m.role)}</div>
        <div class="ltc-mentor-meta" style="margin-top:3px;">Focus: ${_ltcEsc(m.focus)}</div>
        <div class="ltc-mentor-region">${_ltcEsc(m.region)}</div>
        ${isMember
          ? `<a href="mailto:${_ltcEsc(m.email)}" class="ltc-contact-btn">Contact &#8599;</a>`
          : `<div style="font-size:0.72rem;color:rgba(96,120,152,0.55);margin-top:6px;">Join TESSERA GRC to view contact details</div>`}
      </div>`;
    return card;
  }

  const permanentMentor = { initials: 'PM', name: 'Philip Morisky, MBA', role: 'Chief Optimus, Adherence Cartography', region: 'Global', focus: 'MAP theory, PEACS design, grant development', email: 'info@adherence.cc' };
  container.appendChild(_renderMentorCard(permanentMentor));

  const dynamicList = _ltcEl('div', { id: 'ltc-dynamic-mentors' });
  dynamicList.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:rgba(96,120,152,0.55);padding:10px 0;">Loading mentor directory…</div>';
  container.appendChild(dynamicList);

  var db = window.firebase && window.firebase.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
  if (db) {
    db.ref('consortium_members').orderByChild('mentor_available').equalTo(true).once('value')
      .then(function(snap) {
        dynamicList.innerHTML = '';
        var found = false;
        if (snap.val()) {
          snap.forEach(function(child) {
            var m = child.val();
            if (!m.name) return;
            found = true;
            dynamicList.appendChild(_renderMentorCard({
              initials: (m.name || 'M').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase(),
              name:     m.name,
              role:     m.role || 'TESSERA GRC Mentor',
              region:   m.region || 'Global',
              focus:    m.focus || 'Adherence science research',
              email:    m.email || 'mentors@adherence.cc',
            }));
          });
        }
        if (!found) {
          dynamicList.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:rgba(96,120,152,0.55);padding:10px 0;">Additional mentor applications are currently under review. Check back soon.</div>';
        }
      })
      .catch(function() {
        dynamicList.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:rgba(96,120,152,0.55);padding:10px 0;">Unable to load mentor directory at this time.</div>';
      });
  } else {
    dynamicList.innerHTML = '';
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
window.lmicTrainingInit = function(container) {
  _ltcInjectStyles();
  container.innerHTML = '';

  // Header
  const header = _ltcEl('div', { class: 'ltc-header' });
  header.innerHTML = `
    <div class="ltc-eyebrow">TESSERA GRC · LMIC Capacity Building</div>
    <div class="ltc-title">Research Training Curriculum</div>
    <div class="ltc-sub">
      Six structured modules covering MAP administration, PEACS, study design, and publishing.
      All content is available in multiple languages. Fee-waived access for TESSERA GRC members at LMIC institutions.
    </div>`;
  container.appendChild(header);

  // Load membership status, then render
  const render = function(memberData) {
    _ltcRenderStatusBar(container, memberData);

    // Tab bar
    const tabs = [
      { id: 'curriculum',  label: 'Curriculum'  },
      { id: 'languages',   label: 'Languages'   },
      { id: 'mentorship',  label: 'Mentorship'  },
    ];

    const tabBar = _ltcEl('div', { class: 'ltc-tabs' });
    tabs.forEach(function(t) {
      const btn = _ltcEl('button', { class: 'ltc-tab' + (t.id === _ltcActiveTab ? ' active' : ''), 'data-ltc-tab': t.id }, t.label);
      btn.addEventListener('click', function() {
        _ltcActiveTab = t.id;
        tabBar.querySelectorAll('.ltc-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        body.innerHTML = '';
        _ltcRenderTab(t.id, body, memberData);
      });
      tabBar.appendChild(btn);
    });
    container.appendChild(tabBar);

    const body = _ltcEl('div', { id: 'ltc-tab-body' });
    container.appendChild(body);
    _ltcRenderTab(_ltcActiveTab, body, memberData);
  };

  const db = window.firebase && window.firebase.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
  const uid = window.firebase && window.firebase.auth && window.firebase.auth().currentUser
    ? window.firebase.auth().currentUser.uid : null;

  if (db && uid) {
    db.ref('consortium_members/' + uid).once('value')
      .then(function(snap) { render(snap.val()); })
      .catch(function()    { render(null);       });
  } else {
    render(null);
  }
};

function _ltcRenderTab(tabId, container, memberData) {
  if (tabId === 'curriculum')  _ltcRenderCurriculum(container);
  if (tabId === 'languages')   _ltcRenderLanguages(container);
  if (tabId === 'mentorship')  _ltcRenderMentorship(container, memberData);
}
