// ── Fact Sheet helpers

// Theme state: 'dark' (default — matches ATLAS dark UI) | 'light' (day / print mode)
window._fsTheme = window._fsTheme || 'dark';

/**
 * Transforms light-mode inline styles in fact sheet HTML to match the current theme.
 * In dark mode the generated HTML's hardcoded light colors are swapped for dark-on-dark
 * readable equivalents. In light mode the original colors are returned unchanged.
 * @param {string} html - Raw HTML from _fsDirect() or _fsBulk()
 * @returns {string} Theme-adjusted HTML
 */
function _applyFsTheme(html) {
  if (window._fsTheme !== 'dark') return html;
  return html
    // ── Text colors ──────────────────────────────────────────────────────────
    .replace(/color:#0f1e33/g,                      'color:#e8f0f8')
    .replace(/color:#1a2535/g,                      'color:#cdd8e8')
    .replace(/color:#374151/g,                      'color:rgba(205,216,232,0.87)')
    .replace(/color:#9ca3af/g,                      'color:rgba(180,200,230,0.50)')
    .replace(/color:#7a8b9a/g,                      'color:rgba(140,165,200,0.65)')
    .replace(/color:#15803d/g,                      'color:rgba(74,222,128,0.92)')
    .replace(/color:#4b5563/g,                      'color:rgba(160,185,215,0.85)')
    .replace(/color:#6b7280/g,                      'color:rgba(145,170,200,0.60)')
    .replace(/color:#c0392b/g,                      'color:rgba(252,165,165,0.92)')
    .replace(/color:#2d1a1a/g,                      'color:rgba(252,210,210,0.88)')
    // ── Backgrounds ──────────────────────────────────────────────────────────
    .replace(/background:#f0fdf4/g,                 'background:rgba(16,185,129,0.09)')
    .replace(/background:#fff5f5/g,                 'background:rgba(239,68,68,0.08)')
    .replace(/background:#f3f4f6/g,                 'background:rgba(255,255,255,0.05)')
    // ── Borders ──────────────────────────────────────────────────────────────
    .replace(/border:1px solid #bbf7d0/g,           'border:1px solid rgba(16,185,129,0.30)')
    .replace(/border:1px solid #c0392b/g,           'border:1px solid rgba(239,68,68,0.35)')
    .replace(/border:1px solid #dde3ea/g,           'border:1px solid rgba(255,255,255,0.09)')
    .replace(/border:1px solid #e5e7eb/g,           'border:1px solid rgba(255,255,255,0.08)')
    .replace(/border-bottom:1px solid #dde3ea/g,    'border-bottom:1px solid rgba(255,255,255,0.09)')
    .replace(/border-top:1px solid #e5e7eb/g,       'border-top:1px solid rgba(255,255,255,0.09)');
}

/**
 * Applies the current _fsTheme values to the overlay DOM elements (card bg, content color).
 * Called on open and on every theme toggle so the chrome matches the content.
 */
function _fsApplyThemeDom() {
  const isDark = window._fsTheme === 'dark';
  const overlay = document.getElementById('fact-sheet-overlay');
  const card    = document.getElementById('fact-sheet-card');
  const content = document.getElementById('fact-sheet-content');
  const btn     = document.getElementById('fs-theme-btn');
  if (overlay) overlay.style.background = isDark ? 'rgba(2,6,15,0.92)' : 'rgba(60,80,110,0.55)';
  if (card) {
    card.style.background   = isDark ? '#111827'                      : '#ffffff';
    card.style.border       = isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.12)';
    card.style.boxShadow    = isDark ? '0 32px 80px rgba(0,0,0,0.6)' : '0 32px 80px rgba(0,0,0,0.18)';
  }
  if (content) content.style.color = isDark ? '#c8d8e8' : '#374151';
  if (btn) {
    btn.textContent   = isDark ? '☀ Day'  : '🌙 Night';
    btn.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    btn.style.color      = isDark ? 'rgba(180,200,230,0.6)'  : 'rgba(60,80,120,0.8)';
    btn.style.border     = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.15)';
  }
}

/**
 * Toggles the fact sheet between dark (Night) and light (Day) reading modes.
 * Re-renders the currently active tab so all inline colors update immediately.
 */
function toggleFactSheetTheme() {
  window._fsTheme = window._fsTheme === 'dark' ? 'light' : 'dark';
  _fsApplyThemeDom();
  // Re-render current tab with new theme
  const activeTab = document.querySelector('.fs-tab[style*="rgba(139,111,245,0.9)"]');
  const type = activeTab?.dataset?.fstype || 'direct';
  const c = document.getElementById('fact-sheet-content');
  if (c) c.innerHTML = type === 'bulk' ? _fsBulk() : _fsDirect();
  if (typeof _fsRenderVersionHistory === 'function') _fsRenderVersionHistory();
}
window.toggleFactSheetTheme = toggleFactSheetTheme;

/**
 * Renders a numbered section heading followed by HTML content for the Data Security Fact Sheet.
 * @param {string|number} num - Section number or letter (e.g. 1, 'A')
 * @param {string} title - Section title displayed as uppercase heading
 * @param {string} content - Raw HTML content for the section body
 * @returns {string} HTML string for the section
 */
function _fsSection(num,title,content){return`<h2 style="font-size:13px;font-weight:600;color:#1a2535;border-bottom:1px solid #dde3ea;padding-bottom:5px;margin:28px 0 12px;letter-spacing:0.04em;text-transform:uppercase">${num}. ${title}</h2>${content}`;}

/**
 * Renders a styled HTML table for the Data Security Fact Sheet.
 * @param {string[]} headers - Column header labels
 * @param {string[][]} rows - 2-D array of cell values (HTML allowed)
 * @returns {string} HTML string for the table
 */
function _fsTable(headers,rows){return`<table style="width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:11.5px"><thead><tr>${headers.map(h=>`<th style="background:#f3f4f6;padding:7px 10px;text-align:left;border:1px solid #dde3ea;font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:#4b5563">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td style="padding:7px 10px;border:1px solid #e5e7eb;color:#374151;vertical-align:top">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}

/**
 * Builds the International Research addendum section (Section A) with jurisdiction-specific
 * data protection notes for 40+ countries.
 * @returns {string} HTML string for the international regulatory addendum
 */
function _fsIntlAddendum(){
  return _fsSection('A','International Research — Regulatory Framework by Jurisdiction',`
<p style="margin-bottom:10px;color:#374151">ATLAS is used in research across more than 40 countries. The table below summarises applicable data protection frameworks and ATLAS's compliance posture. Researchers are responsible for confirming compliance with their local authority before uploading participant data.</p>
${_fsTable(['Jurisdiction','Framework','Cross-Border Transfer to USA','ATLAS Status'],[
  ['<strong>India</strong>','DPDP Act 2023','Permitted — USA not on restricted-country list.','Compatible. Firebase US-hosted via HTTPS/AES-256. Ensure consent language meets DPDP requirements.'],
  ['<strong>China (Mainland)</strong>','PIPL 2021 · DSL 2021','<span style="color:#c0392b;font-weight:600">Restricted.</span> Requires CAC security assessment, Standard Contract filing, or certification.','See China notice below. Contact info@adherence.cc for technical documentation to support Standard Contract filing.'],
  ['<strong>South Africa</strong>','POPIA 2013/2021','Permitted — Firebase DPA accepted as adequate protection by IOPO.','Compatible. Firebase GDPR DPA satisfies POPIA operator agreement §20–22.'],
  ['<strong>Kenya</strong>','DPA 2019','Permitted with participant consent or adequate protection finding.','Compatible with disclosed consent. Include Firebase (Google, USA) in ethics application.'],
  ['<strong>Nigeria</strong>','NDPA 2023 / NDPR 2019','Permitted where comparable safeguards exist.','Compatible. Firebase DPA + HTTPS/AES-256 constitute comparable safeguards under NDPA §43.'],
  ['<strong>Ghana</strong>','Data Protection Act 2012','Permitted with DPC notification.','Compatible. Researcher may need to notify Ghana DPC of cross-border transfer.'],
  ['<strong>Brazil</strong>','LGPD 2020','Permitted via Standard Contractual Clauses.','Compatible. Google Firebase provides LGPD DPA terms.'],
  ['<strong>EU / EEA</strong>','GDPR 2018','Permitted under EU-US Data Privacy Framework (2023).','Compatible. Firebase GDPR DPA available at firebase.google.com/support/privacy.'],
  ['<strong>All others</strong>','National / institutional','Consult local data protection authority.','ATLAS safeguards (HTTPS, AES-256, deletion on request, no commercial re-use) meet or exceed most national baselines.'],
])}
<div style="margin:20px 0;padding:16px 20px;border:1px solid #c0392b;border-radius:6px;background:#fff5f5">
  <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#c0392b;margin-bottom:8px">⚠ China (Mainland) — Additional Notice</div>
  <p style="color:#2d1a1a;margin-bottom:8px"><strong>Regulatory:</strong> PIPL Article 38 governs cross-border transfer of Chinese participants' data to US Firebase servers. Researchers at Chinese institutions must complete an approved transfer mechanism (CAC security assessment, Standard Contract, or certification) before uploading data. Adherence Inc. can provide technical architecture documentation — contact info@adherence.cc.</p>
  <p style="color:#2d1a1a;margin-bottom:0"><strong>Technical:</strong> Firebase (firebaseapp.com / firebaseio.com) is frequently inaccessible from mainland China. Verify platform connectivity before data collection begins. An institutional VPN or international network connection may be required. Adherence Inc. is evaluating a regional deployment option to address this limitation.</p>
</div>
<p style="color:#374151;margin-top:14px"><strong>Consent form language:</strong> In non-English-speaking countries, participant consent forms should disclose in the local language: (1) responses stored on US servers operated by Google LLC (Firebase); (2) protected by AES-256 encryption, accessible only to the research team; (3) not sold or used commercially; (4) deletable on request via info@adherence.cc within 30 days.</p>`);
}

/**
 * Builds the HTML body of the Direct Assessment workflow fact sheet.
 * @returns {string} Complete HTML string for the direct-assessment fact sheet
 */
function _fsDirect(){
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  return _applyFsTheme(`<div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#7a8b9a;margin-bottom:10px">ATLAS Platform · Adherence Inc.</div>
<h1 style="font-size:22px;font-weight:400;color:#0f1e33;margin-bottom:4px">Data Security Fact Sheet</h1>
<div style="font-family:'Courier New',monospace;font-size:9px;color:#9ca3af;margin-bottom:20px">Standard Subscription — Direct Assessment Workflow · Version 2026.6 · ${today}</div>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:28px;display:flex;align-items:flex-start;gap:12px;">
  <span style="font-size:1rem;flex-shrink:0;margin-top:1px;">🔒</span>
  <div>
    <div style="font-family:'Courier New',monospace;font-size:8.5px;letter-spacing:0.12em;text-transform:uppercase;color:#15803d;font-weight:600;margin-bottom:5px;">HIPAA Infrastructure · 21 CFR Part 11 · Compliance Status</div>
    <div style="font-size:11px;color:#374151;line-height:1.65;"><strong>AWS Business Associate Agreement (BAA) in place.</strong> Adherence Inc. maintains an executed BAA with Amazon Web Services (AWS) covering all ATLAS infrastructure services. The AWS Healthcare &amp; Life Sciences BAA Addendum is also in effect. Institutions requiring a BAA with Adherence Inc. should contact <span style="font-family:'Courier New',monospace;">info@adherence.cc</span>.</div>
  </div>
</div>
${_fsSection(1,'Platform & Instruments',`<p style="margin-bottom:10px;color:#374151"><strong>Platform:</strong> ATLAS (Adherence Technology &amp; Longitudinal Assessment System)</p><p style="margin-bottom:10px;color:#374151"><strong>Instruments:</strong> MAP (Multidimensional Adherence Parameters) · MMAS-8 (Morisky Medication Adherence Scale) · PEACS (Predictive Emergence Assessment for Clinical Services)</p><p style="margin-bottom:10px;color:#374151"><strong>Developer:</strong> Philip Morisky, MBA — Adherence Inc. · info@adherence.cc · 100 Oceangate, 12th Floor, Long Beach, CA 90802</p>`)}
${_fsSection(2,'Workflow Overview',`<p style="margin-bottom:10px;color:#374151">Participants enter MAP/MMAS-8/PEACS responses directly into the ATLAS platform in real time. No file upload or batch processing is involved. Each session is independent. Workflow: (1) Researcher shares workspace access link → (2) Participant opens ATLAS and optionally grants location consent → (3) Participant completes assessment → (4) Responses transmitted immediately to database on submission.</p>`)}
${_fsSection(3,'Data Fields Collected',_fsTable(['Field','Source','Type','Notes'],[
  ['Pseudonymous Patient Code','Researcher/clinician entered','String','Study/clinic ID only. Must not contain real name or national ID.'],
  ['MAP/MMAS-8 Responses Q1–Q8','Participant self-report','Float 0–1','Raw item responses. No open-text answers.'],
  ['Calculated Adherence Score','System-computed','Float 0–8','Computed in-browser before transmission.'],
  ['Condition, Medication, Route','Researcher entered','String','Disease, drug name, strength, administration route.'],
  ['Gender · Age Range · Education','Participant/researcher','String','Categorical — age band (e.g., 45–54), not date of birth.'],
  ['Country &amp; City · Lat/Lon','Platform-derived','String/Decimal','See Location section §4.'],
  ['Workspace Code','System-assigned','String',"Researcher's ATLAS access key."],
  ['Session Timestamp','System-generated','Unix ms','Date and time of submission.'],
  ['PEACS Subscale Scores','Participant self-report','Float 0–1','BASE, MVMT, STRATA, PE composite (if PEACS used).'],
  ['ZOE Transcript (optional)','Voice interaction','Text','Only if participant uses ZOE voice agent. See §5.'],
]))}
${_fsSection(4,'Location Data',`<p style="margin-bottom:10px;color:#374151"><strong>Method A — Browser GPS (primary):</strong> Consent dialog shown before access. If accepted, browser Geolocation API used — decimal degree precision (~1–10 m radius). Stored in database.</p><p style="margin-bottom:10px;color:#374151"><strong>Method B — IP Geolocation (fallback if GPS declined):</strong> Request sent to <strong>ipapi.co</strong> (USA) to resolve IP → city/country. City name and country stored — not the raw IP. Precision is city-level (~10–100 km).</p><p style="color:#374151"><strong>Method C — Nominatim:</strong> City/country sent to OpenStreetMap Nominatim to retrieve map-centroid coordinates for visualization. No patient data transmitted to Nominatim.</p>`)}
${_fsSection(5,'ZOE Voice Agent (Optional)',`<p style="margin-bottom:8px;color:#374151">ZOE is not activated by default — participant must explicitly opt in. Conversation transcript text sent over HTTPS to AWS Lambda (us-east-1). Audio is never stored — speech-to-text via browser Web Speech API (audio stays on device). No patient code or demographic data transmitted to Lambda. Researchers prioritising participant privacy should instruct participants to use the standard (non-voice) assessment path.</p>`)}
${_fsSection(6,'Data Storage',_fsTable(['Property','Detail'],[
  ['Primary database','Google LLC (Firebase Realtime Database) — all workspaces'],
  ['Database URL','adherence-project-2026-default-rtdb.firebaseio.com'],
  ['Firebase region','United States (Google Cloud Platform, us-central1)'],
  ['UAE workspace database','AWS DynamoDB — me-central-1 (Abu Dhabi, UAE). UAE-region workspace data is written to DynamoDB exclusively; it is not replicated to the US. See §9.'],
  ['Encryption at rest','AES-256 — Firebase: Google-managed keys; DynamoDB (UAE): AWS-managed keys. Both enforce encryption at the storage layer.'],
  ['Encryption in transit','TLS 1.3 / TLS 1.2 — all connections HTTPS. HSTS preload enforced at the Cloudflare edge.'],
  ['Edge security','Cloudflare Worker enforces IP-based rate limiting (60 req/min/IP) and injects security headers (HSTS, X-Frame-Options, X-Content-Type-Options) on every response before data reaches application servers.'],
  ['Access model','Workspace-scoped. No public listing of identified records.'],
  ['Data retention','Retained until PI requests deletion. No automatic expiration.'],
  ['Deletion requests','info@adherence.cc with workspace code. Fulfilled within 30 days.'],
]))}
${_fsSection(7,'Third-Party Data Processors',_fsTable(['Service','Provider','Purpose','Data Received'],[
  ['Firebase Realtime Database','Google LLC (USA)','Primary data storage — all workspaces','All fields listed in §3'],
  ['AWS DynamoDB + Lambda','Amazon Web Services (UAE — me-central-1, Abu Dhabi)','UAE workspace data storage and compute','UAE workspace assessment records, audit log. No data from global workspaces.'],
  ['Cloudflare, Inc. (USA / Global PoPs)','Cloudflare','Edge proxy, DDoS protection, rate limiting, HSTS enforcement','Transient — requests processed in-memory. No PHI stored or retained at the edge.'],
  ['AWS Lambda','Amazon Web Services (USA — us-east-1)','Authentication, API key validation, ZOE voice AI','Auth tokens (all); conversation transcript (ZOE sessions only)'],
  ['ipapi.co','ipapi (USA)','IP geolocation fallback','Client IP address (if GPS declined)'],
  ['OpenStreetMap Nominatim','OSM Foundation (UK)','City → coordinates','City name + country name'],
  ['Mapbox','Mapbox Inc. (USA)','Map visualization','API token + viewport — no patient data'],
  ['Google Fonts','Google LLC (USA)','UI typography','Client IP (standard CDN)'],
]))}
${_fsSection(8,'De-Identification Responsibility',`<p style="margin-bottom:8px;color:#374151">ATLAS does not validate Patient Code field content. Researchers must ensure no real names, national IDs, or direct identifiers are entered. The key linking Patient Codes to real identities must be held locally and never uploaded to ATLAS. For populations &lt;5 subjects per site, assess quasi-identification risk.</p>`)}
${_fsSection(9,'Data Residency & Regulatory Framework',`<p style="margin-bottom:10px;color:#374151"><strong>Global workspaces:</strong> All data stored in the <strong>United States</strong> on Google Cloud (Firebase, us-central1). Firebase operates under the EU-US Data Privacy Framework with a GDPR Article 28-compliant DPA (firebase.google.com/support/privacy).</p><p style="margin-bottom:10px;color:#374151"><strong>UAE workspaces:</strong> All assessment records, adherence scores, and audit logs are stored exclusively in <strong>AWS DynamoDB — me-central-1 (Abu Dhabi, UAE)</strong>. Data is routed via the Cloudflare Worker to an AWS API Gateway + Lambda endpoint in me-central-1 and never transits or is stored in the US infrastructure. This architecture satisfies UAE Federal Decree-Law No. 45 of 2021 (PDPL) data localisation requirements, DOH Data Privacy Standard, and ADHICS v2.0.</p><p style="color:#374151">Researchers with in-country residency requirements outside the US and UAE should consult their data protection officer. See the International Research Addendum (Section A) for jurisdiction-specific guidance.</p>`)}
${_fsSection(10,'Data Use & Research Partnerships',`<p style="margin-bottom:10px;color:#374151"><strong>Individual-level records:</strong> Used exclusively for the researcher's ATLAS dashboard and platform maintenance. Not sold, licensed, or shared commercially. Not used to train AI models.</p><p style="color:#374151"><strong>Aggregate de-identified data:</strong> City-level adherence indices — with no patient codes, no individual records — contribute to the Global Adherence Index (GAI), an anonymised epidemiological dataset made available to health economics and outcomes research (HEOR) and real-world evidence (RWE) partners under data access agreements that require peer-reviewed publication of findings. Recipients are contractually prohibited from re-identification. Researchers may opt their workspace's aggregate contribution out via workspace settings.</p>`)}
${_fsSection(11,'21 CFR Part 11 — Electronic Records & Electronic Signatures',`<p style="margin-bottom:10px;color:#374151">When ATLAS records are submitted to or used in support of FDA-regulated studies (IND, NDA, 510(k)) or GCP-compliant clinical research, the platform operates in full compliance with FDA 21 CFR Part 11 for electronic records and electronic signatures. The following controls are implemented:</p>`+_fsTable(['Control','Regulatory Basis','Status'],[
  ['Immutable CFR-11 audit trail — every create/update/delete on clinical records','§11.10(d)(e)','Platform Built'],
  ['SHA-256 payload hash on every audit entry (tamper-evident record integrity)','§11.10(d) / §11.70','Platform Built'],
  ['Two-component electronic signature: email + password re-entry at time of signing','§11.200(b) / §11.50','Platform Built'],
  ['E-signature on MMAS-8 and MAP submission; signature_id stored on record','§11.70 / §11.50','Platform Built'],
  ['E-signature on record deletion (Mission Control Data Ledger)','§11.10(e) / §11.50','Platform Built'],
  ['30-minute inactivity session timeout with audit entry on expiry','§11.10(f)','Platform Built'],
  ['Failed login events logged to audit trail','§11.10(d)','Platform Built'],
  ['Read-only Audit Log Viewer for superadmin — no delete/edit controls','§11.10(d)','Platform Built'],
  ['System validation documentation: IQ / OQ / PQ / SRS / RTM prepared','§11.10(a)','Awaiting PI Sign-Off'],
  ['DynamoDB audit table IAM Deny on DeleteItem / UpdateItem','§11.10(d)','Owner Action'],
  ['AWS CloudTrail enabled — infrastructure-level API audit','§11.10(d)','Owner Action'],
])+`<p style="margin-top:10px;font-size:10px;color:#6b7280;font-style:italic">All Part 11 controls are implemented within the existing Firebase + AWS DynamoDB + Lambda stack. No third-party e-signature service is required for in-application actions. For PI-level study document signatures, DocuSign or Adobe Sign may be used optionally.</p>`)}
${_fsIntlAddendum()}
<div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-top:36px;font-family:'Courier New',monospace;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between"><span>ATLAS · Adherence Inc. · Philip Morisky, MBA · info@adherence.cc · adherence.cc</span><span>ATLAS v8.8.0 · June 2026</span></div>`);
}

/**
 * Builds the HTML body of the Bulk Upload workflow fact sheet.
 * @returns {string} Complete HTML string for the bulk-upload fact sheet
 */
function _fsBulk(){
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  return _applyFsTheme(`<div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#7a8b9a;margin-bottom:10px">ATLAS Platform · Adherence Inc.</div>
<h1 style="font-size:22px;font-weight:400;color:#0f1e33;margin-bottom:4px">Data Security Fact Sheet</h1>
<div style="font-family:'Courier New',monospace;font-size:9px;color:#9ca3af;margin-bottom:20px">Researcher Subscription — De-Identified Excel Bulk Upload Workflow · Version 2026.6 · ${today}</div>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:28px;display:flex;align-items:flex-start;gap:12px;">
  <span style="font-size:1rem;flex-shrink:0;margin-top:1px;">🔒</span>
  <div>
    <div style="font-family:'Courier New',monospace;font-size:8.5px;letter-spacing:0.12em;text-transform:uppercase;color:#15803d;font-weight:600;margin-bottom:5px;">HIPAA Infrastructure · 21 CFR Part 11 · Compliance Status</div>
    <div style="font-size:11px;color:#374151;line-height:1.65;"><strong>AWS Business Associate Agreement (BAA) in place.</strong> Adherence Inc. maintains an executed BAA with Amazon Web Services (AWS) covering all ATLAS infrastructure services. The AWS Healthcare &amp; Life Sciences BAA Addendum is also in effect. Institutions requiring a BAA with Adherence Inc. should contact <span style="font-family:'Courier New',monospace;">info@adherence.cc</span>.</div>
  </div>
</div>
${_fsSection(1,'Platform & Instruments',`<p style="margin-bottom:10px;color:#374151"><strong>Platform:</strong> ATLAS (Adherence Technology &amp; Longitudinal Assessment System)</p><p style="margin-bottom:10px;color:#374151"><strong>Instruments:</strong> MAP (Multidimensional Adherence Parameters) · MMAS-8 (Morisky Medication Adherence Scale) · PEACS (Predictive Emergence Assessment for Clinical Services)</p><p style="color:#374151"><strong>Developer:</strong> Philip Morisky, MBA — Adherence Inc. · info@adherence.cc · 100 Oceangate, 12th Floor, Long Beach, CA 90802</p>`)}
${_fsSection(2,'Workflow Overview',`<p style="color:#374151">The bulk upload workflow is for researchers submitting de-identified datasets. <strong>No real patient names, dates of birth, national IDs, or contact information are collected.</strong> Workflow: (1) Download ATLAS Excel template from AWS S3 → (2) Enter de-identified data offline → (3) Select file in ATLAS — <em>the file is read in-browser using SheetJS; the file itself is never transmitted</em> → (4) Extracted fields transmitted over HTTPS to database.</p>`)}
${_fsSection(3,'Data Fields Collected',_fsTable(['Field','Source','Type','Notes'],[
  ['Patient Code','Researcher-assigned','String','Pseudonymous study ID. Must not contain real name or national ID.'],
  ['Country · City','Researcher-entered','String','Study site location — used for mapping only.'],
  ['Condition, Drug Name, Strength, Route','Researcher-entered','String','Medication and disease details.'],
  ['Gender · Age Range · Education','Researcher-entered','String','Categorical — age band, not date of birth.'],
  ['Q1–Q8 (MAP/MMAS-8 responses)','Researcher-entered','Yes/No or categorical','Raw item responses.'],
  ['Calculated Score','System-computed','Float 0–8','Computed client-side before upload.'],
  ['Study Title · PI Name · Study ID/IRB #','Researcher-entered','String','Optional batch metadata.'],
  ['Workspace Code · Batch ID · Timestamp','System-generated','String/Unix ms','Links records to researcher and upload event.'],
  ['Latitude / Longitude','System-derived','Decimal','City centroid via Nominatim — not individual GPS. See §4.'],
]))}
${_fsSection(4,'Location Data',`<p style="margin-bottom:10px;color:#374151">Location derived from researcher-entered City and Country fields only. These are sent to <strong>OpenStreetMap Nominatim</strong> to retrieve an approximate city-centroid lat/lon for visualization. <strong>No GPS data, no IP geolocation, no ipapi.co calls</strong> in the bulk upload workflow.</p><p style="color:#374151">Data sent to Nominatim per row: city name text + country name text only. No patient code, score, or demographic data transmitted to Nominatim. Returned coordinates are the city's geographic centroid — no individual-level precision.</p>`)}
${_fsSection(5,'Data Storage',_fsTable(['Property','Detail'],[
  ['Primary database','Google LLC (Firebase Realtime Database) — all workspaces'],
  ['Database URL','adherence-project-2026-default-rtdb.firebaseio.com'],
  ['Firebase region','United States (Google Cloud Platform, us-central1)'],
  ['UAE workspace database','AWS DynamoDB — me-central-1 (Abu Dhabi, UAE). UAE-region workspace records are written to DynamoDB exclusively and are not replicated to the US. See §8.'],
  ['Encryption at rest','AES-256 — Firebase: Google-managed keys; DynamoDB (UAE): AWS-managed keys. Both enforce encryption at the storage layer.'],
  ['Encryption in transit','TLS 1.3 / TLS 1.2 — all connections HTTPS. HSTS preload enforced at the Cloudflare edge.'],
  ['Edge security','Cloudflare Worker enforces IP-based rate limiting (60 req/min/IP) and injects security headers (HSTS, X-Frame-Options, X-Content-Type-Options) on every response.'],
  ['Database paths','(a) /assessments/{key} — full record per row; (b) /mapData/{key} — city-level score, no patient code; (c) /bulk_uploads/{id} — batch metadata only; (d) /audit_log/{key} — immutable CFR-11 audit entries; (e) /esignatures/{key} — electronic signature records'],
  ['Data retention','Retained until PI requests deletion.'],
  ['Deletion requests','info@adherence.cc with Batch ID or workspace code. Fulfilled within 30 days.'],
]))}
${_fsSection(6,'Third-Party Data Processors',_fsTable(['Service','Provider','Purpose','Data Received'],[
  ['Firebase Realtime Database','Google LLC (USA)','Primary data storage — all workspaces','All fields listed in §3'],
  ['AWS DynamoDB + Lambda','Amazon Web Services (UAE — me-central-1, Abu Dhabi)','UAE workspace data storage and compute','UAE workspace assessment records, audit log. No data from global workspaces.'],
  ['Cloudflare, Inc. (USA / Global PoPs)','Cloudflare','Edge proxy, DDoS protection, rate limiting, HSTS enforcement','Transient — requests processed in-memory. No PHI stored or retained at the edge.'],
  ['AWS Lambda','Amazon Web Services (USA — us-east-1)','Authentication, API key validation','Auth tokens only — no patient data in bulk workflow'],
  ['OpenStreetMap Nominatim','OSM Foundation (UK)','City → coordinates (per row)','City name + country name only'],
  ['AWS S3','Amazon Web Services (USA)','Template download','None — outbound download only'],
  ['SheetJS / XLSX.js','SheetJS LLC','Excel parsing','No data transmitted — client-side only'],
  ['AWS DynamoDB (US)','Amazon Web Services (USA — us-east-1)','Immutable CFR-11 audit log (global workspaces)','Audit entries only — no patient PHI'],
  ['Mapbox','Mapbox Inc. (USA)','Map visualization','API token + viewport — no patient data'],
])+'<p style="margin-top:10px;color:#374151"><em>Note: ipapi.co and ZOE AWS Lambda are not invoked in the bulk upload workflow.</em></p>')}
${_fsSection(7,'De-Identification Responsibility',`<p style="color:#374151">Researcher is responsible for de-identification before upload (HIPAA Safe Harbor, ISO 29101, or applicable national law). ATLAS does not validate the Patient Code field. The key linking codes to real identities must be held locally and never uploaded. For populations &lt;5 per site, assess quasi-identification risk before uploading.</p>`)}
${_fsSection(8,'Data Residency & Regulatory Framework',`<p style="margin-bottom:10px;color:#374151"><strong>Global workspaces:</strong> All data stored in the <strong>United States</strong> on Google Cloud (Firebase, us-central1). Firebase GDPR DPA available at firebase.google.com/support/privacy.</p><p style="margin-bottom:10px;color:#374151"><strong>UAE workspaces:</strong> All assessment records and audit logs are stored exclusively in <strong>AWS DynamoDB — me-central-1 (Abu Dhabi, UAE)</strong>. Data routes via the Cloudflare Worker to an AWS API Gateway + Lambda in me-central-1 and never transits or is stored in US infrastructure. This satisfies UAE PDPL (Federal Decree-Law No. 45 of 2021) data localisation requirements and ADHICS v2.0.</p><p style="color:#374151">Researchers with in-country residency requirements should consult their data protection officer. See the International Research Addendum (Section A) for jurisdiction-specific guidance.</p>`)}
${_fsSection(9,'Data Use & Research Partnerships',`<p style="margin-bottom:10px;color:#374151"><strong>Individual-level records:</strong> Used exclusively for the researcher's ATLAS dashboard and platform maintenance. Not sold, licensed, or shared commercially. Not used to train AI models.</p><p style="color:#374151"><strong>Aggregate de-identified data:</strong> City-level adherence indices — with no patient codes, no individual records — contribute to the Global Adherence Index (GAI), an anonymised epidemiological dataset made available to health economics and outcomes research (HEOR) and real-world evidence (RWE) partners under data access agreements that require peer-reviewed publication of findings. Recipients are contractually prohibited from re-identification. Researchers may opt their workspace's aggregate contribution out via workspace settings.</p>`)}
${_fsSection(10,'21 CFR Part 11 — Electronic Records & Electronic Signatures',`<p style="margin-bottom:10px;color:#374151">When ATLAS records are submitted to or used in support of FDA-regulated studies (IND, NDA, 510(k)) or GCP-compliant clinical research, the platform operates in full compliance with FDA 21 CFR Part 11 for electronic records and electronic signatures. The following controls are implemented:</p>`+_fsTable(['Control','Regulatory Basis','Status'],[
  ['Immutable CFR-11 audit trail — every create/update/delete on clinical records','§11.10(d)(e)','Platform Built'],
  ['SHA-256 payload hash on every audit entry (tamper-evident record integrity)','§11.10(d) / §11.70','Platform Built'],
  ['Two-component electronic signature: email + password re-entry at time of signing','§11.200(b) / §11.50','Platform Built'],
  ['E-signature on MMAS-8 and MAP submission; signature_id stored on record','§11.70 / §11.50','Platform Built'],
  ['E-signature on record deletion (Mission Control Data Ledger)','§11.10(e) / §11.50','Platform Built'],
  ['30-minute inactivity session timeout with audit entry on expiry','§11.10(f)','Platform Built'],
  ['Failed login events logged to audit trail','§11.10(d)','Platform Built'],
  ['Read-only Audit Log Viewer for superadmin — no delete/edit controls','§11.10(d)','Platform Built'],
  ['System validation documentation: IQ / OQ / PQ / SRS / RTM prepared','§11.10(a)','Awaiting PI Sign-Off'],
  ['DynamoDB audit table IAM Deny on DeleteItem / UpdateItem','§11.10(d)','Owner Action'],
  ['AWS CloudTrail enabled — infrastructure-level API audit','§11.10(d)','Owner Action'],
])+`<p style="margin-top:10px;font-size:10px;color:#6b7280;font-style:italic">All Part 11 controls are implemented within the existing Firebase + AWS DynamoDB + Lambda stack. No third-party e-signature service is required for in-application actions.</p>`)}
${_fsIntlAddendum()}
<div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-top:36px;font-family:'Courier New',monospace;font-size:9px;color:#9ca3af;display:flex;justify-content:space-between"><span>ATLAS · Adherence Inc. · Philip Morisky, MBA · info@adherence.cc · adherence.cc</span><span>ATLAS v8.8.0 · June 2026</span></div>`);
}

/**
 * Opens the Data Security Fact Sheet overlay. Defaults to the 'bulk' variant for
 * researcher/pi/institution tiers and 'direct' for all others.
 * @param {'direct'|'bulk'} [type] - Which fact sheet to show; auto-detected from tier when omitted
 * @returns {void}
 */
function openFactSheet(type){
  const overlay=document.getElementById('fact-sheet-overlay');
  if(!overlay)return;
  overlay.style.display='flex';
  _fsApplyThemeDom(); // sync chrome to current theme (dark by default)
  const tier=window._workspaceTier||window._activeRole||'researcher';
  if(!type)type=['researcher','pi','institution'].includes(tier)?'bulk':'direct';
  switchFactSheet(type);
}
/** Closes the Data Security Fact Sheet overlay. @returns {void} */
function closeFactSheet(){
  const o=document.getElementById('fact-sheet-overlay');
  if(o)o.style.display='none';
}
/**
 * Switches the visible fact sheet tab and re-renders its content.
 * @param {'direct'|'bulk'} type - Which variant to display
 * @returns {void}
 */
function switchFactSheet(type){
  document.querySelectorAll('.fs-tab').forEach(t=>{
    const active=t.dataset.fstype===type;
    t.style.borderBottomColor=active?'rgba(139,111,245,0.7)':'transparent';
    t.style.color=active?'rgba(139,111,245,0.9)':'rgba(180,200,230,0.35)';
  });
  const c=document.getElementById('fact-sheet-content');
  if(c)c.innerHTML=type==='bulk'?_fsBulk():_fsDirect();
  // P4: Render version history on open
  if(typeof _fsRenderVersionHistory==='function')_fsRenderVersionHistory();
}
document.addEventListener('click',e=>{
  const o=document.getElementById('fact-sheet-overlay');
  if(o&&o.style.display!=='none'&&e.target===o)closeFactSheet();
});

// ── Site Banner — Firebase-driven ────────────────────────────────────────
// Reads /site_banner on load; ATLAS Control writes to it.

/**
 * @typedef {Object} BannerData
 * @property {boolean} active - Whether the banner should be displayed
 * @property {string}  [tag] - Short date/event label shown in the badge
 * @property {string}  [message] - Main banner message (HTML allowed)
 * @property {string}  [cta_text] - Call-to-action button label
 * @property {string}  [cta_url] - CTA destination URL
 * @property {string}  [expires] - ISO date string; banner hides after this date
 * @property {'red'|'gold'|'blue'|'green'} [theme] - Visual colour theme
 * @property {string}  [key] - Unique banner key used for dismiss persistence
 */

/** @type {Object.<string, {bg:string, border:string, shadow:string, tag:string, cta:string, ctaHover:string}>} */
const _bannerThemes = {
  red:   { bg:'linear-gradient(90deg,#1a0606,#2a0a0a)', border:'rgba(220,38,38,0.4)', shadow:'rgba(220,38,38,0.18)', tag:'#f87171', cta:'#dc2626', ctaHover:'#b91c1c' },
  gold:  { bg:'linear-gradient(90deg,#110f00,#1a1500)', border:'rgba(212,168,67,0.4)', shadow:'rgba(212,168,67,0.15)', tag:'#f5cc4a', cta:'#d4a843', ctaHover:'#b8902e' },
  blue:  { bg:'linear-gradient(90deg,#00060f,#000d1a)', border:'rgba(78,156,245,0.4)', shadow:'rgba(78,156,245,0.15)', tag:'#93c5fd', cta:'#4e9cf5', ctaHover:'#2563eb' },
  green: { bg:'linear-gradient(90deg,#001209,#001f10)', border:'rgba(46,201,138,0.4)', shadow:'rgba(46,201,138,0.15)', tag:'#6ee7b7', cta:'#2ec98a', ctaHover:'#16a370' }
};

/**
 * Reads a banner data object from Firebase and applies it to the #whd-banner element.
 * Hides the banner when inactive, expired, or previously dismissed by the user.
 * @param {BannerData|null} d - Banner data from Firebase /site_banner node
 * @returns {void}
 */
function _applyBannerData(d) {
  const banner = document.getElementById('whd-banner');
  if (!banner) return;

  // Hide if inactive or expired
  if (!d || !d.active) { banner.style.display = 'none'; return; }
  if (d.expires) {
    const exp = new Date(d.expires); exp.setHours(23,59,59,999);
    if (new Date() > exp) { banner.style.display = 'none'; return; }
  }

  // Dismissed key — use banner key so new banners re-appear
  const dismissKey = 'banner-dismissed-' + (d.key || 'default');
  try { if (localStorage.getItem(dismissKey)) { banner.style.display='none'; return; } } catch(e){}

  // Apply theme
  const t = _bannerThemes[d.theme] || _bannerThemes.red;
  banner.style.background    = t.bg;
  banner.style.borderTopColor = t.border;
  banner.style.boxShadow     = `0 -4px 32px ${t.shadow}`;
  const pulse = banner.querySelector('.whd-pulse');
  if (pulse) pulse.style.background = t.cta;
  const tagEl = banner.querySelector('.whd-date');
  if (tagEl) { tagEl.textContent = d.tag || ''; tagEl.style.color = t.tag; }
  const msgEl = banner.querySelector('.whd-message');
  if (msgEl) msgEl.innerHTML = d.message || '';
  const ctaEl = banner.querySelector('.whd-cta');
  if (ctaEl) {
    ctaEl.textContent = d.cta_text || 'Learn more';
    ctaEl.style.background = t.cta;
    // Normalise URL — ensure absolute so window.open doesn't treat it as a relative path
    let _ctaUrl = (d.cta_url || '').trim();
    if (_ctaUrl && !/^https?:\/\//i.test(_ctaUrl)) _ctaUrl = 'https://' + _ctaUrl;
    // If the URL resolves to this same page, treat it as blank (avoid opening a useless new tab)
    try {
      const _parsed = new URL(_ctaUrl);
      if (_parsed.origin === window.location.origin && (_parsed.pathname === '/' || _parsed.pathname === window.location.pathname)) _ctaUrl = '';
    } catch(e) {}
    ctaEl.onclick = null;
    if (_ctaUrl) {
      ctaEl.setAttribute('data-url', _ctaUrl);
      ctaEl.onclick = () => { banner.style.display = 'none'; window.open(_ctaUrl, '_blank', 'noopener'); };
    } else {
      ctaEl.onclick = () => { banner.style.display = 'none'; };
    }
  }

  // Wire dismiss
  const closeBtn = document.getElementById('whd-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      banner.style.display = 'none';
      try { localStorage.setItem(dismissKey, '1'); } catch(e) {}
    };
  }

  if (window._bannerShowTimer) clearTimeout(window._bannerShowTimer);
  window._bannerShowTimer = setTimeout(() => { banner.style.display = 'flex'; }, 1200);
}

(function initSiteBanner() {
  database.ref('site_banner').once('value', snap => {
    _applyBannerData(snap.val());
  });
})();

// ── ATLAS Control — Banner section ───────────────────────────────────────

/** Loads the current /site_banner data from Firebase and populates the admin banner form. @returns {void} */
function accLoadBanner() {
  database.ref('site_banner').once('value', snap => {
    const d = snap.val() || {};
    document.getElementById('banner-tag').value      = d.tag      || '';
    document.getElementById('banner-message').value  = d.message  || '';
    document.getElementById('banner-cta-text').value = d.cta_text || '';
    document.getElementById('banner-cta-url').value  = d.cta_url  || '';
    document.getElementById('banner-expires').value  = d.expires  || '';
    document.getElementById('banner-theme').value    = d.theme    || 'red';
    document.getElementById(d.active ? 'banner-on' : 'banner-off').checked = true;
    _updateBannerPreview(d);
    document.getElementById('banner-status').textContent = 'Loaded.';
    setTimeout(() => { document.getElementById('banner-status').textContent = ''; }, 2000);
  });
}

/**
 * Reads the banner admin form fields and writes the payload to Firebase /site_banner.
 * Also immediately updates the live banner on the current page.
 * @returns {void}
 */
function accSaveBanner() {
  const active   = document.getElementById('banner-on').checked;
  const tag      = document.getElementById('banner-tag').value.trim();
  const message  = document.getElementById('banner-message').value.trim();
  const cta_text = document.getElementById('banner-cta-text').value.trim();
  const cta_url  = document.getElementById('banner-cta-url').value.trim();
  const expires  = document.getElementById('banner-expires').value;
  const theme    = document.getElementById('banner-theme').value;
  const key      = 'banner-' + Date.now();

  if (active && !message) { showToast('Add a message before publishing.', 2500); return; }

  const payload = { active, tag, message, cta_text, cta_url, expires, theme, key, updated: Date.now() };
  database.ref('site_banner').set(payload, err => {
    const st = document.getElementById('banner-status');
    if (err) { st.textContent = 'Error: ' + err.message; st.style.color = '#ef4444'; }
    else {
      st.textContent = active ? 'Published! Banner is now live.' : 'Saved as inactive.';
      st.style.color = 'var(--strata)';
      _updateBannerPreview(payload);
      _applyBannerData(payload); // update live banner on this page immediately
      setTimeout(() => { st.textContent = ''; st.style.color = 'var(--muted)'; }, 3000);
    }
  });
}

/**
 * Confirms then writes an inactive banner record to Firebase, immediately hiding the
 * banner on all active ATLAS pages.
 * @returns {void}
 */
function accClearBanner() {
  if (!confirm('Clear the banner? It will disappear from all sites immediately.')) return;
  database.ref('site_banner').set({ active: false, key: 'cleared-' + Date.now() }, err => {
    const st = document.getElementById('banner-status');
    if (err) { st.textContent = 'Error: ' + err.message; }
    else {
      st.textContent = 'Cleared — banner hidden on all sites.';
      document.getElementById('banner-preview').style.display = 'none';
      document.getElementById('banner-preview-empty').style.display = 'block';
      const banner = document.getElementById('whd-banner');
      if (banner) banner.style.display = 'none';
      setTimeout(() => { st.textContent = ''; }, 3000);
    }
  });
}

/**
 * Updates the banner preview card in the ATLAS Control admin panel.
 * Hides the preview when the banner data is inactive or has no message.
 * @param {BannerData|null} d - Banner data object
 * @returns {void}
 */
function _updateBannerPreview(d) {
  const prev  = document.getElementById('banner-preview');
  const empty = document.getElementById('banner-preview-empty');
  if (!d || !d.active || !d.message) {
    if (prev)  prev.style.display  = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  const t = _bannerThemes[d.theme] || _bannerThemes.red;
  if (prev) {
    prev.style.display    = 'flex';
    prev.style.background = t.bg;
    prev.style.borderColor = t.border;
  }
  if (empty) empty.style.display = 'none';
  const tagEl = document.getElementById('bp-tag');
  const msgEl = document.getElementById('bp-msg');
  const ctaEl = document.getElementById('bp-cta');
  if (tagEl) { tagEl.textContent = d.tag || ''; tagEl.style.color = t.tag; }
  if (msgEl) { msgEl.innerHTML = d.message; }
  if (ctaEl) { ctaEl.textContent = d.cta_text || 'Learn more'; ctaEl.style.background = t.cta; }
}

// Restore last-used patient language on load
(function() {
  try {
    const _savedLang = localStorage.getItem('atlas_lang');
    if (_savedLang && typeof setAppLanguage === 'function') {
      setAppLanguage(_savedLang);
      var _entrySelLang = document.getElementById('lang-select-entry');
      if (_entrySelLang) _entrySelLang.value = _savedLang;
    } else if (_savedLang) {
      // setAppLanguage may not be loaded yet — defer
      document.addEventListener('atlas:workspace-ready', function() {
        if (typeof setAppLanguage === 'function') {
          setAppLanguage(_savedLang);
          var _entrySelLang = document.getElementById('lang-select-entry');
          if (_entrySelLang) _entrySelLang.value = _savedLang;
        }
      });
    }
  } catch(e) {}
})();

// Auto-load banner data when banner section is opened
document.addEventListener('atlas:workspace-ready', () => {
  const orig = window.accNav;
  if (orig && !orig._bannerWrapped) {
    const wrapped = function(section) {
      orig(section);
      if (section === 'banner') accLoadBanner();
    };
    wrapped._bannerWrapped = true;
    window.accNav = wrapped;
  }
});

// ── Compliance & Security Page ─────────────────────────────────────────────

/**
 * Creates and displays the Security & Compliance modal, or re-shows it if already in the DOM.
 * @returns {void}
 */
function openCompliancePage() {
  if (document.getElementById('compliance-modal')) {
    document.getElementById('compliance-modal').style.display = 'flex';
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'compliance-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99996;background:rgba(2,6,18,0.92);backdrop-filter:blur(16px);display:flex;align-items:flex-start;justify-content:center;padding:32px 20px;overflow-y:auto;';
  modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

  modal.innerHTML = `
  <div style="background:#0d1525;border:1px solid rgba(255,255,255,0.09);border-radius:16px;max-width:760px;width:100%;padding:40px;position:relative;">
    <button onclick="document.getElementById('compliance-modal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--dim);font-size:1.1rem;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--dim)'">&#x2715;</button>

    <div style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(16,185,129,0.6);margin-bottom:8px;">Adherence Inc. · ATLAS Platform</div>
    <h1 style="font-family:var(--font-display);font-size:1.8rem;font-weight:300;color:var(--bright);margin-bottom:6px;">Security & Compliance</h1>
    <p style="font-size:0.82rem;color:var(--muted);line-height:1.65;margin-bottom:32px;">How ATLAS protects patient data and meets institutional compliance requirements.</p>

    <!-- HIPAA -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.15);border-radius:12px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(16,185,129,0.7);margin-bottom:8px;">HIPAA Compliance</div>
      <p style="font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:8px;">ATLAS operates on Google Firebase (Google Cloud), which offers a signed <strong style="color:var(--text);">Business Associate Agreement (BAA)</strong> under the Google Cloud Healthcare API. Institutions requiring a formal BAA should contact <a href="mailto:compliance@adherence.cc" style="color:rgba(16,185,129,0.7);">compliance@adherence.cc</a>.</p>
      <p style="font-size:0.78rem;color:var(--dim);line-height:1.65;">No Protected Health Information (PHI) is required — all participant identifiers are de-identified numeric codes assigned by the researcher. ATLAS never collects names, dates of birth, addresses, or insurance numbers.</p>
    </div>

    <!-- Encryption -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.15);border-radius:12px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(78,156,245,0.7);margin-bottom:8px;">Data Encryption</div>
      <ul style="font-size:0.82rem;color:var(--muted);line-height:1.9;padding-left:18px;margin:0;">
        <li><strong style="color:var(--text);">At rest:</strong> AES-256 encryption via Google Cloud Firebase (default, always-on)</li>
        <li><strong style="color:var(--text);">In transit:</strong> TLS 1.3 enforced via Cloudflare (HSTS, HTTPS-only)</li>
        <li><strong style="color:var(--text);">Access control:</strong> Firebase security rules enforce workspace-scoped read/write — no workspace can access another's data</li>
        <li><strong style="color:var(--text);">API keys:</strong> Stored in AWS SSM Parameter Store — never in client-side code</li>
      </ul>
    </div>

    <!-- Infrastructure -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(139,111,245,0.04);border:1px solid rgba(139,111,245,0.15);border-radius:12px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(139,111,245,0.7);margin-bottom:8px;">Infrastructure</div>
      <ul style="font-size:0.82rem;color:var(--muted);line-height:1.9;padding-left:18px;margin:0;">
        <li><strong style="color:var(--text);">Edge hosting:</strong> Cloudflare Workers — 300+ global PoPs, 99.99% uptime SLA</li>
        <li><strong style="color:var(--text);">Database:</strong> Google Firebase Realtime Database (SOC 2, ISO 27001 certified)</li>
        <li><strong style="color:var(--text);">File storage:</strong> AWS S3 (SOC 2, ISO 27001, HIPAA eligible)</li>
        <li><strong style="color:var(--text);">Authentication:</strong> Firebase Auth + AWS Lambda — custom tokens, MFA OTP, magic links</li>
        <li><strong style="color:var(--text);">Rate limiting:</strong> Edge-enforced via Cloudflare Workers (60 req/min per IP)</li>
      </ul>
    </div>

    <!-- IRB / Research -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.15);border-radius:12px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:8px;">IRB & Research Compliance</div>
      <ul style="font-size:0.82rem;color:var(--muted);line-height:1.9;padding-left:18px;margin:0;">
        <li>Downloadable <strong style="color:var(--text);">Data Security Fact Sheet</strong> for IEC/IRB submissions (available in PI workspace)</li>
        <li>Full <strong style="color:var(--text);">IRB Documentation Package</strong> exportable from PI workspace (instruments, methods, data security narrative)</li>
        <li>MMAS-8 instrument: licensed exclusively to Adherence Inc. — citation: Morisky et al. (2008)</li>
        <li>Audit log maintained for all data access events (superadmin-readable)</li>
      </ul>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:18px;font-size:0.76rem;color:var(--dim);line-height:1.8;">
      Questions? <a href="mailto:compliance@adherence.cc" style="color:rgba(16,185,129,0.7);">compliance@adherence.cc</a> &#xB7;
      <a href="mailto:legal@adherence.cc" style="color:rgba(78,156,245,0.7);">legal@adherence.cc</a> &#xB7;
      ATLAS v8.7.0 · Adherence Inc.
    </div>
  </div>`;

  document.body.appendChild(modal);
}

function downloadIRBTemplate() {
  const ws   = window._wsKey || window._workspaceKey || (typeof currentWorkspaceKey !== 'undefined' ? currentWorkspaceKey : 'YOUR-WORKSPACE-KEY');
  const role = window._wsRole || 'researcher';
  const date = new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});
  const yr   = new Date().getFullYear();

  const text = `IRB PROTOCOL TEMPLATE — ATLAS PLATFORM
Adherence Cartography · Adherence Inc.
Generated: ${date} · Workspace: ${ws}

INSTRUCTIONS FOR USE:
Replace all [BRACKETED PLACEHOLDERS] with your study-specific information.
This template provides standard boilerplate for IRB submissions using the
ATLAS platform and MAP/MMAS-8/PEACS instruments. Adapt as required by
your IRB's formatting guidelines.

═══════════════════════════════════════════════════════════════════════

SECTION: DATA COLLECTION INSTRUMENT

This study will use the MAP (Multidimensional Adherence Parameters)
instrument administered through the ATLAS Platform (atlas.adherence.cc),
developed by Adherence Cartography (Adherence Inc., Long Beach, CA).

MAP is an 8-item medication adherence assessment instrument validated
from the MMAS-8 (Morisky, Ang, Krousel-Wood & Ward, 2008; Journal of
Clinical Hypertension, 10(5), 348–354). MAP extends the MMAS-8 by
computing a Predictive Emergence (PE) score using a geometric mean
across three behavioural domains: Architecture, Execution, and Context.

[IF USING PEACS]: This study will additionally administer PEACS
(Predictive Emergence Assessment for Clinical Services), a 22-item
longitudinal instrument administered across three time intervals
(BASE: monthly / MVMT: weekly / STRATA: quarterly).

═══════════════════════════════════════════════════════════════════════

SECTION: HUMAN SUBJECTS PROTECTIONS

Data Collection Method:
Participants will complete the MAP assessment through the ATLAS digital
platform, accessible at atlas.adherence.cc. The platform collects no
personally identifiable information (PII). No names, dates of birth,
social security numbers, or insurance identifiers are collected or stored.

Participant Identification:
Each participant is assigned a de-identified participant code
([DESCRIBE CODE FORMAT, e.g., numeric study ID assigned by research
coordinator]). This code is the sole identifier linking assessment
records to the study roster, which is maintained separately by the
Principal Investigator in a password-protected local file.

Data Storage:
Assessment responses are transmitted over TLS 1.3-encrypted connections
and stored in AES-256-encrypted Firebase Realtime Database (Google Cloud,
us-central1 region). ATLAS operates under a signed HIPAA Business
Associate Agreement with Google LLC and Amazon Web Services, Inc.

Data Access:
Only investigators with a valid ATLAS workspace key may access cohort
data. Access is role-gated and logged in a server-side audit trail.
The workspace key for this study is: ${ws}

Data Retention:
Research data will be retained for [X YEARS] following study completion,
consistent with [YOUR INSTITUTION'S] data retention policy and applicable
federal regulations. Data may be exported in CSV format at any time for
archival purposes.

Geolocation:
The platform requests browser geolocation permission to display
anonymised submission locations on a global adherence map. Geolocation
is collected at city and country level only; precise coordinates are
not stored. Participants may decline geolocation without affecting
assessment completion.

Right to Withdraw:
Participants may discontinue the assessment at any time. Because data
is de-identified at the point of collection, linking a submitted record
to a specific participant for retroactive withdrawal requires the
participant to provide their assigned participant code to the research
coordinator.

═══════════════════════════════════════════════════════════════════════

SECTION: INSTRUMENT CITATIONS

Primary instrument citation:
  Morisky, D.E., Ang, A., Krousel-Wood, M., & Ward, H.J. (2008).
  Predictive validity of a medication adherence measure in an outpatient
  setting. Journal of Clinical Hypertension, 10(5), 348–354.
  https://doi.org/10.1111/j.1751-7176.2008.07572.x

ATLAS platform and MAP framework:
  Morisky, D.E. (${yr}). Multidimensional Adherence Parameters (MAP) and
  the Theory of Predictive Emergence. Adherence Cartography / Adherence
  Inc. atlas.adherence.cc

[IF USING PEACS — cite as]:
  Morisky, D.E. (${yr}). PEACS: Predictive Emergence Assessment for
  Clinical Services. Adherence Cartography / Adherence Inc.
  atlas.adherence.cc

Psychometric properties supporting instrument use:
  [INSERT ADDITIONAL CITATIONS FROM YOUR LITERATURE REVIEW AS REQUIRED
  BY YOUR IRB. The ATLAS codebook (downloadable from the researcher
  dashboard) includes Cronbach's α, McDonald's ω, SEM, and ICC
  computed from your specific cohort data.]

═══════════════════════════════════════════════════════════════════════

SECTION: INFORMED CONSENT LANGUAGE (suggested)

"You are being asked to complete a brief medication adherence survey
using the ATLAS platform. The survey takes approximately 2–4 minutes.
Your responses are completely anonymous — no identifying information
is collected. A de-identified participant code [CODE] will link your
responses to this study. Your participation is voluntary and you may
stop at any time. The data collected will be used for [STUDY PURPOSE].
Results will be stored securely and accessed only by the study team."

═══════════════════════════════════════════════════════════════════════

SECTION: DATA SECURITY SUPPORTING DOCUMENTATION

The following documents are available from the ATLAS platform (My Account
→ Documents & Compliance) and may be submitted as IRB appendices:

  □ ATLAS Data Security Fact Sheet (Direct Assessment variant)
  □ ATLAS Data Security Fact Sheet (Bulk Upload variant)
  □ PE Scoring Methodology Statement (downloadable from ATLAS Control)
  □ HIPAA BAA confirmation letter — contact research@adherence.cc

═══════════════════════════════════════════════════════════════════════
ATLAS Platform v8 · Adherence Cartography · adherence.cc
Generated for workspace: ${ws} · Role: ${role}
© ${yr} Adherence Inc. MMAS-8 © MMAR LLC — used under licence.
This template is provided for guidance only. Consult your IRB for
jurisdiction-specific requirements.`;

  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  a.download = 'ATLAS_IRB_Protocol_Template_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  if (typeof showToast === 'function') showToast('IRB Protocol Template downloaded.', 3000);
}

// ── P4: Fact Sheet Versioning + Signature ────────────────────────────────
async function _fsGetNextVersion(workspaceKey) {
  try {
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db || !workspaceKey) return 1;
    const safeKey = String(workspaceKey).replace(/[.#$\[\]]/g, '_');
    const ref = db.ref(`fact_sheet_versions/${safeKey}`);
    const snap = await ref.once('value');
    const current = snap.val() || 0;
    const next = current + 1;
    await ref.set(next);
    return next;
  } catch(e) { return 1; }
}

async function _fsGetVersionHistory(workspaceKey) {
  try {
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db || !workspaceKey) return [];
    const safeKey = String(workspaceKey).replace(/[.#$\[\]]/g, '_');
    const snap = await db.ref(`fact_sheet_log/${safeKey}`).limitToLast(5).once('value');
    const entries = snap.val() || {};
    return Object.values(entries).sort((a,b) => b.timestamp - a.timestamp);
  } catch(e) { return []; }
}

async function _fsLogVersion(workspaceKey, version) {
  try {
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db || !workspaceKey) return;
    const safeKey = String(workspaceKey).replace(/[.#$\[\]]/g, '_');
    await db.ref(`fact_sheet_log/${safeKey}`).push({
      version,
      timestamp: Date.now(),
      generated_by: window._currentUserEmail || 'pi',
      generated_at: new Date().toISOString()
    });
  } catch(e) { /* silent */ }
}

async function _fsRenderVersionHistory() {
  const container = document.getElementById('fs-version-history');
  if (!container) return;
  const wsKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey');
  if (!wsKey) { container.textContent = 'Sign in to view version history.'; return; }
  const history = await _fsGetVersionHistory(wsKey);
  if (!history.length) { container.textContent = 'No prior versions.'; return; }
  container.innerHTML = history.map(h =>
    `<span class="fs-ver-entry">v${h.version} · ${new Date(h.timestamp).toLocaleDateString()}</span>`
  ).join('');
}
window._fsRenderVersionHistory = _fsRenderVersionHistory;

// P4: Override printFactSheet to inject version header + signature block
function printFactSheet(){
  const content=document.getElementById('fact-sheet-content');
  if(!content)return;
  const type=document.querySelector('.fs-tab[style*="rgba(139,111,245,0.9)"]')?.dataset?.fstype||'direct';
  const title='ATLAS Data Security Fact Sheet — '+(type==='bulk'?'Bulk Upload':'Direct Assessment');
  const wsKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey') || 'ws';
  const fsDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const piName = window._currentWorkspaceProfile?.pi_name || window._currentWorkspaceProfile?.contact || 'Principal Investigator';
  const institutionName = window._currentWorkspaceProfile?.institution || 'Institution';
  const irb = window._currentWorkspaceProfile?.irb_protocol || '[IRB Protocol]';

  const versionHeader = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.7rem;color:#8090a8;margin-bottom:1.2rem;padding-bottom:.6rem;border-bottom:1px solid #1e2d45;display:flex;justify-content:space-between">
      <span>ATLAS Data Security Fact Sheet</span>
      <span>Generated: ${fsDate}</span>
    </div>`;

  const signatureBlock = `
    <div style="margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid #1e2d45">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#8090a8;margin-bottom:1rem">Attestation</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem">
        <div style="border-top:1px solid #cdd8e8;padding-top:.4rem">
          <div style="font-size:.75rem;color:#8090a8">Principal Investigator</div>
          <div style="font-size:.85rem;color:#1a2535;margin:.3rem 0">${piName}</div>
          <div style="font-size:.75rem;color:#8090a8">${institutionName}</div>
        </div>
        <div style="border-top:1px solid #cdd8e8;padding-top:.4rem">
          <div style="font-size:.75rem;color:#8090a8">IRB Protocol</div>
          <div style="font-size:.85rem;color:#1a2535;margin:.3rem 0">${irb}</div>
          <div style="font-size:.75rem;color:#8090a8">ATLAS v8.9.3</div>
        </div>
        <div style="border-top:1px solid #cdd8e8;padding-top:.4rem">
          <div style="font-size:.75rem;color:#8090a8">Generated</div>
          <div style="font-size:.85rem;color:#1a2535;margin:.3rem 0">${fsDate}</div>
          <div style="font-size:.75rem;color:#8090a8">Signature: _______________</div>
        </div>
      </div>
    </div>`;

  const w=window.open('','_blank','width=960,height=740');
  if(!w)return;
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;color:#1a2535;max-width:800px;margin:40px auto;padding:0 32px;font-size:13px;line-height:1.75}h1{font-size:22px;font-weight:400;color:#0f1e33;margin-bottom:4px}h2{font-size:13px;font-weight:600;color:#1a2535;border-bottom:1px solid #dde3ea;padding-bottom:5px;margin:28px 0 12px;letter-spacing:0.04em;text-transform:uppercase}p{margin-bottom:10px;color:#374151}table{width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:11.5px}th{background:#f3f4f6;padding:7px 10px;text-align:left;border:1px solid #dde3ea;font-family:'Courier New',monospace;font-size:9px;text-transform:uppercase;color:#4b5563}td{padding:7px 10px;border:1px solid #e5e7eb;color:#374151;vertical-align:top}@media print{body{margin:20px auto}}</style></head><body>${versionHeader}${content.innerHTML}${signatureBlock}</body></html>`);
  w.document.close();
  setTimeout(()=>{w.focus();w.print();},400);
  // Log this generation asynchronously
  _fsGetNextVersion(wsKey).then(v => _fsLogVersion(wsKey, v)).catch(()=>{});
}
