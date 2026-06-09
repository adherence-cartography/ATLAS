// ══════════════════════════════════════════════
// PI RESEARCH PANEL
// Enrollment velocity · retention date · cross-site PE heatmap · blinded export
// PI tier only — gated on isPIMode()
// ══════════════════════════════════════════════

/**
 * Returns a deterministic 8-character hexadecimal blind identifier scoped to the current
 * workspace key, using a djb2-variant hash. Used to de-identify patient IDs in IRB exports.
 * @param {string} str - Original identifier (patient number, institution code, etc.)
 * @returns {string} Blinded ID in the format 'PXXXXXXXX'
 */
function _piBlindId(str) {
  // Deterministic djb2-variant hash → workspace-scoped blind code
  const input = (currentWorkspace || '') + '|' + (str || '');
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return 'P' + (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function _piRetentionYears() {
  const src = workspaceProfile && workspaceProfile.funding_source;
  if (['nih','nsf','dod','pcori'].includes(src)) return 7;
  if (src === 'industry') return 10;
  return 5;
}

function _piRetentionDate() {
  const end = workspaceProfile && workspaceProfile.study_end;
  if (!end) return null;
  const d = new Date(end);
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + _piRetentionYears());
  return d;
}

/**
 * Exports a blinded MMAS CSV replacing all patient IDs and site codes with djb2 hash codes.
 * Restricted to PI role. Downloads a file named atlas-blinded-{workspace}-{date}.csv.
 * @returns {Promise<void>}
 */
async function exportBlindedMmasCSV() {
  if (!isPIMode()) return;
  atlasAuditLog('export_mmas_blinded', { workspace: currentWorkspace });
  showToast('Preparing blinded export…', 2000);
  const allowedWS = await resolveAllowedWorkspaces();
  getCachedAssessments().then(records_all => {
    if (!records_all.length) { showToast('No data to export.'); return; }
    const records = records_all.filter(a => {
      const code = (a.institution_code || '').toUpperCase();
      return allowedWS === null ? true : (code && allowedWS.has(code));
    });
    const headers = [
      'Blind_ID','Site_Code','Timestamp','Score','Adherence_Level','INA_UNA',
      'Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8',
      'Condition','Num_Medications','Drug_Name','Drug_Strength','Dosing_Frequency','Route',
      'PE_Total','PE_Architecture','PE_Execution','PE_Context',
    ];
    const rows = records.map(a => {
      let pat = 'N/A';
      if (a.q1 !== undefined) {
        const {intentional, unintentional} = typeof classifyPattern === 'function' ? classifyPattern(a) : {intentional:0,unintentional:0};
        pat = a.score === 8 ? 'High' : intentional > unintentional ? 'INA' : unintentional > intentional ? 'UNA' : 'Mixed';
      }
      return [
        _piBlindId(a.patient_number || a._fbKey || ''),
        _piBlindId(a.institution_code || '').slice(0, 6),
        new Date(a.timestamp).toISOString(),
        (a.score || 0).toFixed(2), a.adherence_level || 'N/A', pat,
        a.q1 ?? '', a.q2 ?? '', a.q3 ?? '', a.q4 ?? '',
        a.q5 ?? '', a.q6 ?? '', a.q7 ?? '', a.q8 ?? '',
        a.condition || '', a.num_medications || '', a.drug_name || '',
        a.drug_strength || '', a.dosing_frequency || '', a.route_of_administration || '',
        a.pe !== undefined ? (+a.pe).toFixed(4) : '',
        a.a  !== undefined ? (+a.a ).toFixed(4) : '',
        a.e  !== undefined ? (+a.e ).toFixed(4) : '',
        a.c  !== undefined ? (+a.c ).toFixed(4) : '',
      ];
    });
    const date = new Date().toISOString().split('T')[0];
    triggerCSVDownload(headers, rows, 'atlas-blinded-' + (currentWorkspace||'ws').toLowerCase() + '-' + date + '.csv');
    showToast('Blinded export ready — ' + rows.length + ' records · patient IDs replaced with hash codes.', 4000);
  });
}

/**
 * Initialises the PI Research panel (enrollment velocity, retention dates, PE heatmap).
 * No-ops silently when the current user is not in PI mode or the panel element is missing.
 * @returns {Promise<void>}
 */
async function initPiResearchPanel() {
  if (!isPIMode()) return;
  const panel = document.getElementById('pi-research-panel');
  if (!panel) return;
  panel.style.display = '';

  // IRB protocol in header
  const proto = document.getElementById('pi-protocol-display');
  if (proto) proto.textContent = workspaceProfile.irb_protocol ? 'Protocol · ' + workspaceProfile.irb_protocol : '';

  // Retention date KPI
  const retDate = _piRetentionDate();
  const retVal  = document.getElementById('pi-kpi-retention-val');
  const retSub  = document.getElementById('pi-kpi-retention-sub');
  const retWarn = document.getElementById('pi-retention-warn');
  if (retDate) {
    if (retVal) retVal.textContent = retDate.toLocaleDateString('en-US', {year:'numeric', month:'short'});
    if (retSub) retSub.textContent = _piRetentionYears() + '-yr · ' + (workspaceProfile.funding_source || 'standard policy');
    const daysUntil = Math.floor((retDate.getTime() - Date.now()) / 86400000);
    if (retWarn && daysUntil <= 90 && daysUntil >= 0) {
      retWarn.textContent = '⚠ Data retention period ends in ' + daysUntil + ' day' + (daysUntil !== 1 ? 's' : '') + ' (' + retDate.toLocaleDateString() + '). Review your IRB data retention plan before this date.';
      retWarn.style.display = 'block';
    }
  } else {
    if (retVal) retVal.textContent = '—';
    if (retSub) retSub.textContent = 'set study end date to compute';
  }

  // Enrollment target from Firebase ws_meta
  let savedTarget = 0;
  try {
    const snap = await database.ref('ws_meta/' + currentWorkspace + '/enrollment_target').once('value');
    savedTarget = snap.val() || 0;
    const inp = document.getElementById('pi-target-input');
    if (inp && savedTarget) inp.value = savedTarget;
  } catch(e) {}

  // Enrollment count + velocity + cross-site heatmap
  resolveAllowedWorkspaces().then(allowedWS => {
    getCachedAssessments().then(records_raw => {
      const records = records_raw.filter(r => {
        const code = (r.institution_code || '').toUpperCase();
        return allowedWS === null ? true : (code && allowedWS.has(code));
      });
      renderPiVelocity(records, savedTarget);
      renderPiHeatmap(records, allowedWS);
      renderPiConsort(records);
      // P1: Data quality check after cohort load
      if (typeof _piCheckDataQuality === 'function') _piCheckDataQuality(records, window._rppPeacsData || dashPeacsData || []);
      // P2: Enrollment velocity card
      if (typeof _piRenderVelocityCard === 'function') _piRenderVelocityCard(records);

      // Populate vitals strip — CONSORT data is cached by renderPiConsort into window._piConsortData
      const cd = window._piConsortData || {};
      updatePiVitalsConsort({
        assessed: cd.assessed || records.length,
        enrolled: cd.enrolledN || records.filter(r => r.mmas_score !== undefined).length,
        ltfu:     cd.ltfuN    || records.filter(r => r.lost_to_followup === true).length,
        analyzed: cd.analyzedN || records.filter(r => r.mmas_score !== undefined && r.patient_id).length
      });

      // Update progress ring with enrollment data
      updatePiProgressRing(cd.enrolledN || records.filter(r => r.mmas_score !== undefined).length, savedTarget || 0);

      // Cache records globally for site matrix and activity feed
      window._piAllRecords = records;
      if (typeof renderPiSiteMatrix === 'function') renderPiSiteMatrix(window._piSiteMatrixData || [], records);
      if (typeof renderPiActivityFeed === 'function') renderPiActivityFeed(records, window._piAmendmentsCache || []);
    });
  });

  // Populate dashboard header with study title
  const nameEl = document.getElementById('pi-dash-study-name');
  if (nameEl) {
    const title = (workspaceProfile && (workspaceProfile.study_title || workspaceProfile.display_name)) || '—';
    nameEl.textContent = title;
  }

  // Load sites, snapshots, amendments, and outcome reports; audit log is lazy on first expand
  loadPiSites();
  loadPiSnapshots();
  loadPiAmendments();
  renderOutcomeReport();
  // Reset lazy-load flag so a re-login gets fresh data on next expand
  _piAuditLogLoaded = false;
  const _auditPanel = document.getElementById('pi-audit-log');
  const _auditBtn   = document.getElementById('pi-audit-toggle-btn');
  const _auditPdf   = document.getElementById('pi-audit-pdf-btn');
  if (_auditPanel) _auditPanel.style.display = 'none';
  if (_auditBtn)   { _auditBtn.textContent = '▶ Show'; _auditBtn.style.color = 'rgba(78,156,245,0.55)'; }
  if (_auditPdf)   _auditPdf.style.display = 'none';

  // ── IRB Progress Report AI ────────────────────────────────────────────
  var _irbContainer = document.getElementById('pi-irb-report-wrap');
  if (!_irbContainer) {
    _irbContainer = document.createElement('div');
    _irbContainer.id = 'pi-irb-report-wrap';
    _irbContainer.style.cssText = 'margin-top:20px;padding:16px;background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.18);border-radius:10px;';
    _irbContainer.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--pe);margin-bottom:6px;">IRB Progress Report</div>' +
      '<div style="font-size:0.82rem;color:var(--muted);margin-bottom:12px;">AI-drafted narrative from your current cohort data. Review and edit before submission.</div>' +
      '<button id="pi-irb-report-btn" onclick="generateIrbProgressReport()" style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(212,168,67,0.10);border:1px solid rgba(212,168,67,0.35);color:rgba(212,168,67,0.9);padding:8px 18px;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(212,168,67,0.18)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.10)\'">✦ Generate IRB Progress Report</button>' +
      '<div id="pi-irb-report-output" style="display:none;margin-top:14px;padding:14px;background:rgba(0,0,0,0.2);border-radius:8px;border:1px solid rgba(255,255,255,0.07);"></div>';
    // Inject into the pi-research-panel
    var _piPanel = document.getElementById('pi-research-panel');
    if (_piPanel) _piPanel.appendChild(_irbContainer);
  }

  // ── NIH DMSP Generator ────────────────────────────────────────────────────
  // BP-FOCUS-04: Required for all NIH R01, R21, U01 funded mechanisms (Jan 2023+)
  var _dmspContainer = document.getElementById('pi-dmsp-wrap');
  if (!_dmspContainer) {
    _dmspContainer = document.createElement('div');
    _dmspContainer.id = 'pi-dmsp-wrap';
    _dmspContainer.style.cssText = 'margin-top:12px;padding:16px;background:rgba(212,168,67,0.03);border:1px solid rgba(212,168,67,0.15);border-radius:10px;';
    _dmspContainer.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--pe);margin-bottom:6px;">NIH Data Management &amp; Sharing Plan</div>' +
      '<div style="font-size:0.82rem;color:var(--muted);margin-bottom:12px;">Required for all NIH-funded grants (effective Jan 25, 2023). Pre-populated with ATLAS platform data — review and customize before submission.</div>' +
      '<button onclick="openDMSPModal()" style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(212,168,67,0.10);border:1px solid rgba(212,168,67,0.35);color:rgba(212,168,67,0.9);padding:8px 18px;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(212,168,67,0.18)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.10)\'">⬡ Generate NIH DMSP</button>';
    var _piPanelDmsp = document.getElementById('pi-research-panel');
    if (_piPanelDmsp) _piPanelDmsp.appendChild(_dmspContainer);
  }
}

// ── NIH DMSP Generator Functions ─────────────────────────────────────────────

/**
 * Generates a pre-populated NIH Data Management and Sharing Plan (DMSP) document.
 * BP-FOCUS-04: NIH requires DMSP for all R01 grants (effective Jan 2023).
 * @param {Object} studyInfo - study configuration object with title, PI, institution, etc.
 */
function generateDMSP(studyInfo) {
  const s = studyInfo || {};
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  const dmspContent = `DATA MANAGEMENT AND SHARING PLAN
NIH Grant Application — ${s.title || '[Study Title]'}
Principal Investigator: ${s.pi || '[PI Name]'}
Institution: ${s.institution || '[Institution]'}
Generated: ${today} via ATLAS Platform (adherence.cc)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DATA TYPE

This study will generate self-report medication adherence data collected via the MAP (Multidimensional Adherence Parameters) instrument and scored by the PEACS (Predictive Emergence Framework). Data types include:

- Primary: MAP/MMAS-8 item-level responses (8 ordinal items per assessment)
- Derived: MMAS-8 composite adherence scores (0–8), MAP phenotype classifications (INA/UNA/PA/A), and PEACS domain scores (BASE/MVMT/STRATA, 0–100)
- Administrative: de-identified participant metadata (age range, disease state, study site, assessment date)
- Format: Structured JSON (platform storage), CSV/XLSX (export format), FHIR R4 Observation (interoperable export)

Estimated dataset size: ${s.n_participants || '[N]'} participants × ${s.n_timepoints || '[N]'} assessment timepoints = approximately ${s.n_participants && s.n_timepoints ? s.n_participants * s.n_timepoints : '[N]'} total records.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. RELATED TOOLS, SOFTWARE, AND CODE

All data will be collected, stored, and analyzed using the ATLAS platform (atlas.adherence.cc, Adherence Inc.). ATLAS is a HIPAA-compliant, 21 CFR Part 11-validated research platform. Primary analysis outputs (psychometric statistics, CONSORT diagrams) are generated within ATLAS and are exportable in standard formats.

Statistical analysis will use [R/SPSS/SAS — specify]. Analysis scripts will be deposited with the shared dataset.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. STANDARDS

Data will be collected and exported in the following standards-compliant formats:
- Storage: JSON (RFC 8259)
- Export: CSV (RFC 4180), XLSX (ISO/IEC 29500)
- Interoperability: HL7 FHIR R4 Observation resource
- Metadata: Dublin Core (study-level); FHIR Observation (record-level)
- De-identification: HIPAA Safe Harbor method (45 CFR §164.514(b)) applied at export

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. DATA PRESERVATION, ACCESS, AND TIMELINES

Data will be securely stored in the ATLAS platform (Firebase Realtime Database, AES-256-GCM encryption; AWS DynamoDB for compliance records) throughout the study period. Following study completion:

- Dataset lock: Upon final data freeze, a cryptographically signed immutable snapshot will be generated in ATLAS.
- De-identification: All direct identifiers will be removed using HIPAA Safe Harbor. The resulting dataset will contain: age range, sex, disease state, study site, MAP scores, phenotype classifications, and assessment dates.
- Repository: De-identified datasets will be deposited in [NIMH Data Archive / ICPSR / OSF — specify repository] within 12 months of study completion or primary manuscript acceptance, whichever comes first.
- Access: Data will be available to qualified researchers upon submission of a data use agreement. Sensitive subgroup analyses may require IRB approval from the requesting institution.
- Retention: Data will be retained for a minimum of 7 years following study completion per NIH data retention policy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. ACCESS, DISTRIBUTION, OR REUSE CONSIDERATIONS

The MAP and MMAS-8 instruments are proprietary and licensed to this study. Instrument items will not be included in the shared dataset; only scored responses and derived variables will be shared. Users of the shared dataset who wish to re-use the MAP/MMAS-8 items in a new study must obtain a separate instrument license from Adherence Inc. (adherence.cc/keys).

IRB-approved study protocol summary and informed consent template will be deposited alongside the dataset.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. OVERSIGHT

The Principal Investigator is responsible for data management plan compliance. The ATLAS platform provides automated enforcement of:
- Access controls (role-based, workspace-isolated)
- Audit trail (immutable, 21 CFR Part 11 compliant)
- Data retention (platform-enforced minimum retention)
- Breach notification (automated alert to Privacy Officer)

The institution's IRB and Research Compliance Office will be notified of the DMSP and provided access to ATLAS platform compliance documentation upon request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated by ATLAS Adherence Cartography Platform (adherence.cc)
Workspace: ${(typeof currentWorkspace !== 'undefined' ? currentWorkspace : null) || '[WORKSPACE]'} | ${today}
This document was auto-generated and should be reviewed and customized before submission.`;

  // Download as .txt file (compatible with NIH ASSIST system)
  const blob = new Blob([dmspContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DMSP-' + (s.title || 'Study').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30) + '-' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
  URL.revokeObjectURL(url);

  if (typeof atlasAuditLog === 'function') atlasAuditLog('DMSP_GENERATED', { study: s.title });
  if (typeof showToast === 'function') showToast('NIH DMSP downloaded. Review and customize before submission.', 5000);
}

/**
 * Opens the DMSP generation modal for the PI to fill in study details.
 */
function openDMSPModal() {
  const overlay = document.createElement('div');
  overlay.id = 'dmsp-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(2,6,18,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:var(--card,#111e32);border:1px solid var(--border2,rgba(255,255,255,0.13));border-top:2px solid rgba(212,168,67,0.5);border-radius:14px;max-width:520px;width:100%;padding:36px;max-height:85vh;overflow-y:auto;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.6);margin-bottom:8px;">NIH Compliance · DMSP Generator</div>
      <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:6px;">Data Management &amp; Sharing Plan</h3>
      <p style="font-size:0.78rem;color:var(--muted,#6b8099);line-height:1.7;margin-bottom:20px;">Required for all NIH R01, R21, U01, and other funded mechanisms (effective Jan 25, 2023). Fill in study details to auto-generate your DMSP.</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Study Title *</label>
          <input id="dmsp-title" placeholder="e.g. Pharmacist-Led Adherence Intervention in Hypertensive Adults" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Principal Investigator *</label>
          <input id="dmsp-pi" placeholder="e.g. Marcus Thompson, MD, PhD" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Institution *</label>
          <input id="dmsp-inst" placeholder="e.g. University of Michigan, Department of Internal Medicine" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Expected Participants</label>
            <input id="dmsp-n" type="number" placeholder="e.g. 200" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;"/>
          </div>
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Assessment Timepoints</label>
            <input id="dmsp-tp" type="number" placeholder="e.g. 3" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;"/>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button onclick="generateDMSP({title:document.getElementById('dmsp-title')?.value,pi:document.getElementById('dmsp-pi')?.value,institution:document.getElementById('dmsp-inst')?.value,n_participants:parseInt(document.getElementById('dmsp-n')?.value)||null,n_timepoints:parseInt(document.getElementById('dmsp-tp')?.value)||null});document.getElementById('dmsp-modal-overlay').remove();"
            style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);color:rgba(212,168,67,0.9);padding:11px;border-radius:7px;cursor:pointer;">
            Generate &amp; Download DMSP →
          </button>
          <button onclick="document.getElementById('dmsp-modal-overlay').remove()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.1);color:var(--muted,#6b8099);padding:11px 14px;border-radius:7px;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function renderPiVelocity(records, target) {
  const count = records.length;
  const now   = Date.now();
  const recent = records.filter(r => (r.timestamp || 0) > now - 8 * 7 * 24 * 3600 * 1000);
  const weeklyRate = recent.length / 8;

  let projectedText = '—';
  if (target > 0 && weeklyRate > 0 && count < target) {
    const weeksLeft = (target - count) / weeklyRate;
    const projDate  = new Date(now + weeksLeft * 7 * 24 * 3600 * 1000);
    projectedText   = projDate.toLocaleDateString('en-US', {year:'numeric', month:'short'});
  } else if (target > 0 && count >= target) {
    projectedText = '✓ Target met';
  }

  const el = id => document.getElementById(id);
  if (el('pi-kpi-enrolled-val'))  el('pi-kpi-enrolled-val').textContent  = count.toLocaleString();
  if (el('pi-kpi-rate-val'))      el('pi-kpi-rate-val').textContent      = weeklyRate.toFixed(1);
  if (el('pi-kpi-rate-sub'))      el('pi-kpi-rate-sub').textContent      = 'per week · last 8 wks';
  if (el('pi-kpi-projected-val')) el('pi-kpi-projected-val').textContent = projectedText;
  if (el('pi-kpi-enrolled-sub'))  el('pi-kpi-enrolled-sub').textContent  = target > 0 ? 'of ' + target.toLocaleString() + ' target' : 'no target set';
  const bar = el('pi-progress-bar');
  if (bar) bar.style.width = (target > 0 ? Math.min(100, (count / target) * 100).toFixed(1) : 0) + '%';
}

function renderPiHeatmap(records, allowedWS) {
  const wrap = document.getElementById('pi-pe-heatmap');
  if (!wrap) return;

  // Only include records that have PE domain scores (a, e, c)
  const bySite = {};
  records.forEach(r => {
    if (r.a === undefined || r.e === undefined || r.c === undefined) return;
    const site = (r.institution_code || 'Unknown').toUpperCase();
    if (!bySite[site]) bySite[site] = { a: [], e: [], c: [] };
    bySite[site].a.push(+r.a);
    bySite[site].e.push(+r.e);
    bySite[site].c.push(+r.c);
  });

  const sites = Object.keys(bySite).filter(s => bySite[s].a.length > 0).sort();
  if (!sites.length) {
    wrap.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.80rem;padding:4px 0;">No PE domain data yet — administer MMAS-8 to patients to populate this map.</div>';
    return;
  }

  const mean  = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const heatC = v => {
    if (v < 0.35) return { bg: 'rgba(46,201,138,0.18)',  text: 'var(--strata)' };
    if (v < 0.55) return { bg: 'rgba(212,168,67,0.16)',  text: 'var(--pe)' };
    if (v < 0.75) return { bg: 'rgba(245,158,11,0.18)',  text: '#f59e0b' };
    return         { bg: 'rgba(239,68,68,0.18)',          text: '#ef4444' };
  };

  let html = `<div class="pi-heatmap-row" style="border-bottom:1px solid var(--border);padding-bottom:5px;margin-bottom:6px;">
    <div class="pi-heatmap-col-hdr" style="text-align:left;">Site</div>
    <div class="pi-heatmap-col-hdr">Architecture</div>
    <div class="pi-heatmap-col-hdr">Execution</div>
    <div class="pi-heatmap-col-hdr">Context</div>
  </div>`;

  sites.forEach(site => {
    const d  = bySite[site];
    const mA = mean(d.a), mE = mean(d.e), mC = mean(d.c);
    const n  = d.a.length;
    const cA = heatC(mA), cE = heatC(mE), cC = heatC(mC);
    const short = site.length > 20 ? site.slice(0, 18) + '…' : site;
    html += `<div class="pi-heatmap-row">
      <div class="pi-heatmap-site" title="${_esc(site)}">${_esc(short)}<br/><span style="font-size:0.62rem;color:var(--dim);">n=${n}</span></div>
      <div class="pi-heatmap-cell" style="background:${cA.bg};color:${cA.text};">${mA.toFixed(3)}</div>
      <div class="pi-heatmap-cell" style="background:${cE.bg};color:${cE.text};">${mE.toFixed(3)}</div>
      <div class="pi-heatmap-cell" style="background:${cC.bg};color:${cC.text};">${mC.toFixed(3)}</div>
    </div>`;
  });

  wrap.innerHTML = html;
}

async function savePiEnrollmentTarget() {
  if (!isPIMode() || !currentWorkspace) return;
  const inp = document.getElementById('pi-target-input');
  if (!inp) return;
  const val = parseInt(inp.value, 10);
  if (isNaN(val) || val < 1) { showToast('Please enter a valid enrollment target (minimum 1).'); return; }
  try {
    await database.ref('ws_meta/' + currentWorkspace + '/enrollment_target').set(val);
    const saved = document.getElementById('pi-target-saved');
    if (saved) { saved.style.display = ''; setTimeout(() => saved.style.display = 'none', 2500); }
    resolveAllowedWorkspaces().then(allowedWS => {
      getCachedAssessments().then(records_raw => {
        const records = records_raw.filter(r => {
          const code = (r.institution_code || '').toUpperCase();
          return allowedWS === null ? true : (code && allowedWS.has(code));
        });
        renderPiVelocity(records, val);
      });
    });
  } catch(e) {
    showToast('Could not save target — ' + e.message);
  }
}

// ── PI: Dataset Lock ──────────────────────────────────────────────────────────
async function lockDataset() {
  if (!isPIMode() || !currentWorkspace) return;
  const btn = document.getElementById('pi-lock-btn');
  if (!btn || btn.disabled) return;
  const total = await (async () => {
    try {
      const data = await getCachedAssessments();
      return data.filter(r => (r.institution_code || '').toUpperCase() === currentWorkspace).length;
    } catch(_) { return '?'; }
  })();
  if (!confirm(`Lock the current dataset?\n\n${total} MMAS-8 record(s) will be frozen into an immutable snapshot.\nThis cannot be undone — the snapshot is permanent.`)) return;
  btn.disabled = true;
  btn.textContent = '⊘ Locking…';
  try {
    const res = await fetch(LAMBDA_URL + '/lock-dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: currentWorkspace }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lock failed');
    showToast(`Dataset locked — ${data.total_records} record(s) in snapshot ${data.snapshot_id.slice(0,18)}…`);
    loadPiSnapshots();
    // Only refresh audit log if the panel is already open
    if (document.getElementById('pi-audit-log')?.style.display !== 'none') loadPiAuditLog();
  } catch(e) {
    showToast('Lock failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '⊘ Lock Current Dataset';
  }
}

function loadPiSnapshots() {
  if (!isPIMode() || !currentWorkspace) return;
  const el = document.getElementById('pi-snapshot-list');
  if (!el) return;
  database.ref('ws_snapshots/' + currentWorkspace).once('value').then(snap => {
    const data = snap.val();
    if (!data || !Object.keys(data).length) {
      el.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No snapshots yet.</div>';
      return;
    }
    const entries = Object.values(data).sort((a, b) => b.created_at - a.created_at);
    let html = '';
    for (const s of entries) {
      const dt = new Date(s.created_at).toLocaleString();
      const id  = s.snapshot_id || '—';
      html += `<div class="pi-snap-row">
        <div class="pi-snap-id">${_esc(id.slice(0,22))}</div>
        <div class="pi-snap-meta">${_esc(dt)} · ${s.mmas_count || 0} MMAS · ${s.peacs_count || 0} PEACS</div>
        <button class="pi-snap-dl" onclick="downloadSnapshotCSV('${_esc(id)}')">↓ CSV</button>
      </div>`;
    }
    el.innerHTML = html;
  }).catch(() => {
    el.innerHTML = '<div style="color:rgba(239,68,68,0.7);font-size:0.76rem;">Could not load snapshots.</div>';
  });
}

async function downloadSnapshotCSV(snapshotId) {
  if (!currentWorkspace) return;
  try {
    const snap = await database.ref('ws_snapshots/' + currentWorkspace + '/' + snapshotId).once('value');
    const data = snap.val();
    if (!data) { showToast('Snapshot not found.'); return; }
    const records = data.mmas_records || [];
    if (!records.length) { showToast('Snapshot has no MMAS-8 records.'); return; }
    const cols = ['_id','patient_number','institution_code','timestamp','total_score',
      'q1','q2','q3','q4','q5','q6','q7','q8','a_score','e_score','c_score','pe_composite'];
    const hdr = cols.join(',');
    const rows = records.map(r => cols.map(c => {
      const v = r[c] == null ? '' : String(r[c]);
      return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g,'""') + '"' : v;
    }).join(','));
    const csv = [hdr, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `snapshot_${currentWorkspace}_${snapshotId.slice(5,18)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch(e) {
    showToast('Download failed: ' + e.message);
  }
}

function loadPiAuditLog() {
  if (!isPIMode() || !currentWorkspace) return;
  const el = document.getElementById('pi-audit-log');
  if (!el) return;
  database.ref('ws_audit/' + currentWorkspace).orderByChild('ts').limitToLast(50).once('value').then(snap => {
    const data = snap.val();
    if (!data || !Object.keys(data).length) {
      el.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No audit entries yet.</div>';
      return;
    }
    const entries = Object.values(data).sort((a, b) => b.ts - a.ts);
    const actionLabel = {
      key_issued:      'Key issued',
      dataset_locked:  'Dataset locked',
      key_verified:    'Key verified (login)',
    };
    let html = '<table class="pi-audit-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>';
    for (const e of entries) {
      const dt = new Date(e.ts).toLocaleString();
      const action = actionLabel[e.action] || e.action || '—';
      const details = Object.entries(e)
        .filter(([k]) => !['action','ts'].includes(k))
        .map(([k,v]) => `${k}: ${v}`).join(' · ') || '—';
      html += `<tr>
        <td>${_esc(dt)}</td>
        <td><span class="pi-audit-action">${_esc(action)}</span></td>
        <td>${_esc(details)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }).catch(() => {
    el.innerHTML = '<div style="color:rgba(239,68,68,0.7);font-size:0.76rem;">Could not load audit log.</div>';
  });
}

let _piAuditLogLoaded = false;
function togglePiAuditLog() {
  const panel   = document.getElementById('pi-audit-log');
  const btn     = document.getElementById('pi-audit-toggle-btn');
  const pdfBtn  = document.getElementById('pi-audit-pdf-btn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    if (btn) { btn.textContent = '▶ Show'; btn.style.color = 'rgba(78,156,245,0.55)'; }
    if (pdfBtn) pdfBtn.style.display = 'none';
  } else {
    panel.style.display = '';
    if (btn) { btn.textContent = '▼ Hide'; btn.style.color = 'rgba(78,156,245,0.85)'; }
    if (pdfBtn) pdfBtn.style.display = '';
    if (!_piAuditLogLoaded) { _piAuditLogLoaded = true; loadPiAuditLog(); }
  }
}

function downloadAuditLogPDF() {
  const el = document.getElementById('pi-audit-log');
  if (!el) return;
  const ws   = currentWorkspace || 'Workspace';
  const now  = new Date().toLocaleString();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Audit Log — ${ws}</title>
<style>
  body{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#0d1c2e;margin:32px 40px;}
  h1{font-size:15px;font-weight:600;margin-bottom:4px;}
  .meta{color:#6b7280;font-size:10px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f4f6;text-align:left;padding:6px 10px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #e5e7eb;}
  td{padding:5px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;}
  tr:nth-child(even) td{background:#f9fafb;}
  @media print{body{margin:16px;}}
</style></head><body>
<h1>Workspace Audit Log — ${ws}</h1>
<div class="meta">Generated ${now} · Last 50 entries</div>
${el.innerHTML}
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { showToast('Allow pop-ups to download the audit log PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── PI: Site Provisioning ─────────────────────────────────────────────────────
let _provType = 'student';

function selectProvType(type) {
  if (!type) return;
  _provType = type;
  updateProvLink();
  const linkSection = document.getElementById('prov-link-section');
  if (linkSection) linkSection.style.display = '';
}

function updateProvLink() {
  const ws  = currentWorkspace || '';
  const url = `https://keys.adherence.cc?tier=${_provType}&pi=${encodeURIComponent(ws)}`;
  const el  = document.getElementById('prov-link-display');
  if (el) {
    if (el.tagName === 'INPUT') el.value = url;
    else el.textContent = url;
  }
}

function copyProvLink() {
  const el = document.getElementById('prov-link-display');
  if (!el) return;
  const text = el.value || el.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('prov-copy-btn');
    if (btn) { btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
  }).catch(() => showToast('Copy failed — please select and copy the link manually.'));
}

function openProvLink() {
  const el = document.getElementById('prov-link-display');
  if (!el) return;
  const url = el.value || el.textContent || '';
  if (url) window.open(url, '_blank');
}

function openProvisionModal() {
  if (!isPIMode()) return;
  // Reset the new invite form fields
  const nameInput = document.getElementById('prov-name-input');
  const emailInput = document.getElementById('prov-email-input');
  const roleSelect = document.getElementById('prov-role-select');
  const linkSection = document.getElementById('prov-link-section');
  const errorDiv = document.getElementById('pi-prov-error');
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  if (roleSelect) roleSelect.value = '';
  if (linkSection) linkSection.style.display = 'none';
  if (errorDiv) errorDiv.style.display = 'none';
  const modal = document.getElementById('pi-provision-modal');
  if (modal) modal.style.display = 'flex';
  const wsLabel = document.getElementById('prov-ws-label');
  if (wsLabel) wsLabel.textContent = currentWorkspace || 'your workspace';
}

function closeProvisionModal() {
  const modal = document.getElementById('pi-provision-modal');
  if (modal) modal.style.display = 'none';
}

// Legacy stub — kept so any old references don't throw
async function submitProvisionSite() { closeProvisionModal(); }

function loadPiSites() {
  if (!isPIMode() || !currentWorkspace) return;
  const listEl  = document.getElementById('pi-site-list');
  const quotaEl = document.getElementById('pi-quota-bar');
  const limit   = workspaceProfile?.num_sites || 5;
  // We can't query SSM directly from client — use Firebase ws_audit to list provisioned sites,
  // but that's ephemeral. Instead use resolveAllowedWorkspaces to discover child workspaces.
  resolveAllowedWorkspaces().then(allowedWS => {
    if (!allowedWS || allowedWS.size <= 1) {
      if (quotaEl) quotaEl.textContent = `0 of ${limit} site(s) provisioned`;
      if (listEl)  listEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No child sites yet — provision your first site coordinator above.</div>';
      return;
    }
    // Exclude the PI's own workspace
    const sites = [...allowedWS].filter(k => k !== currentWorkspace);
    if (quotaEl) quotaEl.textContent = `${sites.length} of ${limit} site(s) provisioned`;
    if (!listEl) return;
    if (!sites.length) {
      listEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No child sites yet — provision your first site coordinator above.</div>';
      return;
    }
    let html = '';
    for (const key of sites.sort()) {
      html += `<div class="pi-site-row">
        <span class="pi-site-key">${_esc(key)}</span>
        <span class="pi-site-meta">${_esc(key.split('-').slice(0,2).join(' · '))}</span>
        <span class="pi-site-status">Active</span>
      </div>`;
    }
    listEl.innerHTML = html;

    // Build site objects for matrix and render
    const siteObjects = sites.sort().map(key => ({ key, workspace_key: key }));
    if (typeof renderPiSiteMatrix === 'function') {
      renderPiSiteMatrix(siteObjects, window._piAllRecords || []);
    }
    // Update team tab badge
    const teamBadge = document.getElementById('pi-team-tab-badge');
    if (teamBadge && sites.length > 0) {
      teamBadge.textContent = sites.length;
      teamBadge.style.display = '';
    }
  });
}

// ── PI: IRB Study Package ─────────────────────────────────────────────────────
async function generateStudyPackage() {
  if (!isPIMode() || !currentWorkspace) return;
  showToast('Compiling study package…', 2500);

  const p = workspaceProfile || {};
  const now = new Date();

  // Gather records
  let mmasRecords = [], peacsRecords = [], auditEntries = [], snapshots = [];
  try {
    const [aSnap, pSnap, auditSnap, ssSnap] = await Promise.all([
      database.ref('assessments').once('value'),
      database.ref('peacs_assessments').once('value'),
      database.ref('ws_audit/' + currentWorkspace).orderByChild('ts').limitToLast(50).once('value'),
      database.ref('ws_snapshots/' + currentWorkspace).once('value'),
    ]);
    const aData = aSnap.val() || {};
    mmasRecords  = Object.values(aData).filter(r => (r.institution_code || '').toUpperCase() === currentWorkspace);
    const pData  = pSnap.val() || {};
    peacsRecords = Object.values(pData).filter(r => (r.institution_code || '').toUpperCase() === currentWorkspace);
    const aLog   = auditSnap.val() || {};
    auditEntries = Object.values(aLog).sort((a, b) => b.ts - a.ts);
    const ssData = ssSnap.val() || {};
    snapshots    = Object.values(ssData).sort((a, b) => b.created_at - a.created_at);
  } catch(e) { showToast('Could not load data: ' + e.message); return; }

  // Compute PE domain averages per site
  const allowed = await resolveAllowedWorkspaces();
  const sites = allowed ? [...allowed] : [currentWorkspace];
  const siteData = {};
  for (const s of sites) {
    const recs = mmasRecords.filter(r => (r.institution_code || '').toUpperCase() === s);
    if (!recs.length) { siteData[s] = null; continue; }
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const aVals = recs.map(r => +r.a).filter(v => !isNaN(v));
    const eVals = recs.map(r => +r.e).filter(v => !isNaN(v));
    const cVals = recs.map(r => +r.c).filter(v => !isNaN(v));
    siteData[s] = {
      n: recs.length,
      a: aVals.length ? mean(aVals).toFixed(3) : '—',
      e: eVals.length ? mean(eVals).toFixed(3) : '—',
      c: cVals.length ? mean(cVals).toFixed(3) : '—',
    };
  }

  const retDate    = _piRetentionDate();
  const retStr     = retDate ? retDate.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}) : 'Not set — enter study end date in your profile';
  const fundLabels = { nih:'NIH', nsf:'NSF', dod:'DoD/CDMRP', pcori:'PCORI', institutional:'Institutional/Internal', foundation:'Private Foundation', industry:'Industry-Sponsored', international:'International Funding Body', unfunded:'Self-Funded', };

  const actionLabel = { key_issued:'Key issued', dataset_locked:'Dataset locked', key_verified:'Key verified (sign-in)', site_provisioned:'Site provisioned', dashboard_access:'Dashboard access', export_mmas_csv:'MMAS export', export_institution_csv:'Institution export', };

  const siteRows = sites.map(s => {
    const d = siteData[s];
    if (!d) return `<tr><td><code>${s}</code></td><td>0</td><td>—</td><td>—</td><td>—</td></tr>`;
    return `<tr><td><code>${s}</code>${s === currentWorkspace ? ' <em>(PI)</em>' : ''}</td><td>${d.n}</td><td>${d.a}</td><td>${d.e}</td><td>${d.c}</td></tr>`;
  }).join('');

  const snapRows = snapshots.length
    ? snapshots.slice(0, 5).map(s => `<tr><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.snapshot_id || '—'}</td><td>${s.mmas_count || 0} MMAS · ${s.peacs_count || 0} PEACS</td><td>Immutable</td></tr>`).join('')
    : '<tr><td colspan="4" style="color:#6b8099;">No snapshots yet</td></tr>';

  const auditRows = auditEntries.slice(0, 20).map(e => {
    const details = Object.entries(e).filter(([k]) => !['action','ts'].includes(k)).map(([k,v]) => `${k}: ${v}`).join(' · ') || '—';
    return `<tr><td>${new Date(e.ts).toLocaleString()}</td><td>${actionLabel[e.action] || e.action || '—'}</td><td>${details}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>IRB Study Package · ${currentWorkspace}</title>
<style>
  body{font-family:'IBM Plex Sans',Arial,sans-serif;font-size:12px;color:#1a2332;margin:0;padding:0;}
  .page{max-width:900px;margin:0 auto;padding:48px 40px;}
  h1{font-size:22px;font-weight:400;border-bottom:2px solid #d4a843;padding-bottom:10px;margin-bottom:6px;}
  h2{font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#4e6080;margin:28px 0 8px;border-bottom:1px solid #e5eaf0;padding-bottom:4px;}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
  .meta-cell label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#8899aa;margin-bottom:2px;}
  .meta-cell span{font-size:11.5px;color:#1a2332;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;}
  th{background:#f4f6f8;text-align:left;padding:6px 10px;font-size:9.5px;text-transform:uppercase;letter-spacing:0.1em;color:#6b8099;border-bottom:1px solid #dde3ea;}
  td{padding:6px 10px;border-bottom:1px solid #eef1f4;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  .warn{background:#fff8ed;border-left:3px solid #d4a843;padding:10px 14px;font-size:11px;margin-bottom:16px;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #dde3ea;font-size:9.5px;color:#8899aa;line-height:1.8;}
  code{font-family:'IBM Plex Mono',monospace;font-size:10px;background:#f4f6f8;padding:1px 4px;border-radius:2px;}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
</style></head><body><div class="page">
  <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.2em;color:#d4a843;margin-bottom:8px;">ATLAS PLATFORM · IRB STUDY PACKAGE</div>
  <h1>Study Package — ${p.study_title || currentWorkspace}</h1>
  <div style="font-size:11px;color:#6b8099;margin-bottom:24px;">Generated ${now.toLocaleString()} · Workspace <code>${currentWorkspace}</code></div>

  <h2>Study Configuration</h2>
  <div class="meta-grid">
    <div class="meta-cell"><label>Principal Investigator</label><span>${p.name || '—'}</span></div>
    <div class="meta-cell"><label>Institution</label><span>${p.institution || '—'}</span></div>
    <div class="meta-cell"><label>Study Title</label><span>${p.study_title || '—'}</span></div>
    <div class="meta-cell"><label>IRB Protocol</label><span>${p.irb_protocol || '—'}</span></div>
    <div class="meta-cell"><label>Ethics Board</label><span>${p.irb_board || '—'}</span></div>
    <div class="meta-cell"><label>Funding Source</label><span>${fundLabels[p.funding_source] || p.funding_source || '—'}</span></div>
    <div class="meta-cell"><label>Grant / Award No.</label><span>${p.grant_num || '—'}</span></div>
    <div class="meta-cell"><label>Study Period</label><span>${p.study_start || '—'} – ${p.study_end || 'ongoing'}</span></div>
    <div class="meta-cell"><label>Authorised Sites</label><span>${p.num_sites || 1}</span></div>
    <div class="meta-cell"><label>Permission Certificate(s)</label><span>${(Array.isArray(p.cert_nums) && p.cert_nums.length ? p.cert_nums : (p.cert_num ? [p.cert_num] : [])).join(', ') || '—'}</span></div>
    <div class="meta-cell"><label>Data Retention Until</label><span>${retStr}</span></div>
    <div class="meta-cell"><label>Package Generated</label><span>${now.toLocaleDateString()}</span></div>
  </div>

  <h2>Enrollment Summary</h2>
  <div class="meta-grid" style="grid-template-columns:repeat(4,1fr);">
    <div class="meta-cell"><label>Total MMAS Records</label><span style="font-size:18px;font-weight:500;">${mmasRecords.length}</span></div>
    <div class="meta-cell"><label>Total PEACS Records</label><span style="font-size:18px;font-weight:500;">${peacsRecords.length}</span></div>
    <div class="meta-cell"><label>Active Sites</label><span style="font-size:18px;font-weight:500;">${sites.length}</span></div>
    <div class="meta-cell"><label>Frozen Snapshots</label><span style="font-size:18px;font-weight:500;">${snapshots.length}</span></div>
  </div>

  <h2>PE Domain Distribution by Site</h2>
  <table><thead><tr><th>Site</th><th>n</th><th>Architecture</th><th>Execution</th><th>Context</th></tr></thead>
  <tbody>${siteRows}</tbody></table>
  <div style="font-size:10px;color:#8899aa;margin-top:-10px;margin-bottom:20px;">PE = (A × E × C)<sup>1/3</sup> · Architecture: mean(Q2,Q3,Q6) · Execution: mean(Q1,Q4,Q5,Q8) · Context: Q7</div>

  <h2>Instruments &amp; Measures</h2>
  <table><thead><tr><th>Instrument</th><th>Version</th><th>Citation</th></tr></thead><tbody>
    <tr><td><strong>MMAS-8</strong> — Morisky Medication Adherence Scale (8-item)</td><td>MMAS-8®</td><td>Morisky, D. E., et al. (2008). Predictive validity of a medication adherence measure in an outpatient setting. <em>Journal of Clinical Hypertension, 10</em>(5), 348–354. · Copyright TX 8-632-533 · www.moriskyscale.com</td></tr>
    <tr><td><strong>PEACS / MAP</strong> — Predictive Emergence Assessment for Clinical Services / Multidimensional Adherence Parameters</td><td>PEACS v2.0</td><td>Morisky, P. (2025). Theory of Predictive Emergence © Philip Morisky. DOI: 10.5281/zenodo.18209699</td></tr>
  </tbody></table>

  <h2>Statistical Methods</h2>
  <table><thead><tr><th>Method</th><th>Purpose</th><th>Citation</th></tr></thead><tbody>
    <tr><td>Cronbach's α (coefficient alpha)</td><td>Internal consistency reliability of MMAS-8 item set</td><td>Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. <em>Psychometrika, 16</em>(3), 297–334.</td></tr>
    <tr><td>McDonald's ω (omega total)</td><td>Composite reliability accounting for non-tau-equivalence</td><td>McDonald, R. P. (1999). <em>Test theory: A unified treatment.</em> Lawrence Erlbaum Associates.</td></tr>
    <tr><td>ICC(2,1) — Two-way mixed, absolute agreement</td><td>Test-retest reliability; intraclass correlation for repeated measures</td><td>Shrout, P. E., &amp; Fleiss, J. L. (1979). Intraclass correlations: Uses in assessing rater reliability. <em>Psychological Bulletin, 86</em>(2), 420–428.</td></tr>
    <tr><td>Standard Error of Measurement (SEM)</td><td>Score-level precision; SEM = SD × √(1 − α)</td><td>Lord, F. M., &amp; Novick, M. R. (1968). <em>Statistical theories of mental test scores.</em> Addison-Wesley.</td></tr>
  </tbody></table>

  <h2>Data Security &amp; Privacy</h2>
  <div style="font-size:11px;line-height:1.7;margin-bottom:16px;">
    <p><strong>Platform:</strong> ATLAS v8.5.0 — Adherence Cartography Platform · Build date: ${now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} · Hosted on Cloudflare edge infrastructure with global TLS 1.3 encryption in transit.</p>
    <p><strong>Data storage:</strong> Patient records are stored in Google Firebase Realtime Database (Google Cloud, North America region) with AES-256 encryption at rest. No personally identifiable information (PII) — including names, dates of birth, or health identifiers — is stored in plain text. Patient identifiers are replaced with deterministic SHA-based blind codes scoped to the workspace prior to any export or cross-site aggregation.</p>
    <p><strong>Access control:</strong> All workspace access is gated by cryptographically signed permission certificates issued through keys.adherence.cc. Each PI workspace operates in an isolated Firebase security scope. Site coordinator access is provisioned by the PI and audited in the workspace audit log.</p>
    <p><strong>Data retention:</strong> Data will be retained until <strong>${retStr}</strong>, consistent with the ${_piRetentionYears()}-year retention requirement for the declared funding source (${fundLabels[p.funding_source] || p.funding_source || 'standard policy'}). After this date, data may be securely destroyed in accordance with the IRB-approved data retention plan.</p>
  </div>

  <h2>Dataset Snapshots</h2>
  <table><thead><tr><th>Created</th><th>Snapshot ID</th><th>Records</th><th>Status</th></tr></thead>
  <tbody>${snapRows}</tbody></table>

  <h2>Audit Log (last 20 events)</h2>
  <table><thead><tr><th>Timestamp</th><th>Action</th><th>Details</th></tr></thead>
  <tbody>${auditRows || '<tr><td colspan="3" style="color:#6b8099;">No audit entries</td></tr>'}</tbody></table>

  <div class="footer">
    ATLAS Platform v8.5.0 · Adherence Cartography · Adherence Inc. · Long Beach, California · Generated ${now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}<br/>
    MMAS-8® © Dr. Donald E. Morisky · TX 8-632-533 · All rights reserved · www.moriskyscale.com<br/>
    PEACS v2.0 · Theory of Predictive Emergence © Philip Morisky · DOI: 10.5281/zenodo.18209699<br/>
    This document was auto-generated by ATLAS and is intended as a research governance aid. It does not replace the primary IRB protocol or regulatory binder. Verify all certificate numbers at keys.adherence.cc/verify.
  </div>
</div></body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback to blob download if popup blocked
    const blob = new Blob([html], { type: 'text/html' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `ATLAS_Study_Package_${currentWorkspace}_${now.toISOString().split('T')[0]}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
  atlasAuditLog('irb_study_package_generated', { workspace: currentWorkspace });
}

// ── CONSORT Participant Flow ──────────────────────────────────────────────────

function renderPiConsort(records) {
  const wrap = document.getElementById('pi-consort-diagram');
  if (!wrap) return;

  if (!records || records.length === 0) {
    wrap.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No cohort records yet \u2014 upload data to generate participant flow.</div>';
    return;
  }

  const assessed = records.length;

  // Group by patient identifier
  const byPid = {};
  let noIdN = 0;
  records.forEach(function(r) {
    const pid = _normPatientNum(r.patient_number || r.patient_id || '');
    if (!pid) { noIdN++; return; }
    if (!byPid[pid]) byPid[pid] = [];
    byPid[pid].push(r);
  });

  // Enrolled: unique patients with \u22651 complete record (has a numeric score)
  const enrolledPids = new Set();
  const completeCountByPid = {};
  Object.keys(byPid).forEach(function(pid) {
    const complete = byPid[pid].filter(function(r) {
      return r.score != null && !isNaN(Number(r.score));
    });
    if (complete.length > 0) {
      enrolledPids.add(pid);
      completeCountByPid[pid] = complete.length;
    }
  });

  const enrolledN       = enrolledPids.size;
  const incompleteOnlyN = Object.keys(byPid).length - enrolledN;
  const excludedN       = noIdN + incompleteOnlyN;

  // Follow-up: \u22652 complete assessments
  const followedPids = new Set();
  enrolledPids.forEach(function(pid) {
    if ((completeCountByPid[pid] || 0) >= 2) followedPids.add(pid);
  });
  const followedN  = followedPids.size;
  const ltfuN      = enrolledN - followedN;
  const analyzedN  = followedN;

  // Cache for copy function
  window._piConsortData = { assessed: assessed, excludedN: excludedN, incompleteOnlyN: incompleteOnlyN, noIdN: noIdN, enrolledN: enrolledN, ltfuN: ltfuN, followedN: followedN, analyzedN: analyzedN };

  function box(label, n, sub, accent) {
    const bdrColor = accent || 'var(--border2)';
    return '<div style="background:var(--card2);border:1px solid ' + bdrColor + ';border-top:2px solid ' + bdrColor + ';border-radius:6px;padding:10px 16px;min-width:178px;text-align:center;">' +
      '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.11em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">' + label + '</div>' +
      '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.30rem;font-weight:600;color:var(--bright);">n\u00A0=\u00A0' + Number(n).toLocaleString() + '</div>' +
      (sub ? '<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);margin-top:3px;line-height:1.5;">' + sub + '</div>' : '') +
      '</div>';
  }

  const vLine   = '<div style="display:flex;justify-content:flex-start;padding-left:89px;"><div style="width:2px;height:16px;background:var(--border2);"></div></div>';
  const hBranch = '<div style="width:30px;height:2px;background:var(--border2);flex-shrink:0;align-self:center;"></div>';

  function flowRow(mainHtml, sideHtml) {
    return '<div style="display:flex;align-items:center;gap:0;">' + mainHtml + (sideHtml ? hBranch + '<div style="opacity:0.9;">' + sideHtml + '</div>' : '') + '</div>';
  }

  const excludeSub = incompleteOnlyN > 0 || noIdN > 0
    ? 'Incomplete MMAS&#8209;8: ' + incompleteOnlyN + (noIdN > 0 ? '<br>No patient ID: ' + noIdN : '')
    : 'All records complete';
  const ltfuSub = ltfuN > 0 ? 'Baseline only &middot; did not return' : 'No loss to follow-up';

  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:0;">' +
    '<div>' + box('Records Assessed for Eligibility', assessed, null, 'rgba(78,156,245,0.55)') + '</div>' +
    vLine +
    flowRow(
      box('Enrolled', enrolledN, '&#8805;1 complete MMAS&#8209;8', 'rgba(46,201,138,0.55)'),
      box('Excluded', excludedN, excludeSub, 'rgba(239,68,68,0.45)')
    ) +
    vLine +
    flowRow(
      box('Returned for Follow-up', followedN, '&#8805;2 assessments on record', 'rgba(46,201,138,0.55)'),
      box('Lost to Follow-up', ltfuN, ltfuSub, 'rgba(245,158,11,0.45)')
    ) +
    vLine +
    '<div>' + box('Included in Primary Analysis', analyzedN, 'Complete-case cohort', 'rgba(139,111,245,0.55)') + '</div>' +
    '</div>' +
    '<button onclick="_copyPiConsort()" class="pi-lock-btn" style="margin-top:10px;border-color:rgba(78,156,245,0.3);color:rgba(78,156,245,0.8);">&#8696; Copy CONSORT Text</button>';
}

function _copyPiConsort() {
  var d     = window._piConsortData || {};
  var lines = [
    'CONSORT Participant Flow \u2014 ATLAS v8.7',
    '\u2550'.repeat(44),
    'Records Assessed for Eligibility:     n = ' + (d.assessed         || 0).toLocaleString(),
    '  \u00B7 Excluded:                         n = ' + (d.excludedN       || 0).toLocaleString(),
    '      \u00B7 Incomplete MMAS\u20118:            n = ' + (d.incompleteOnlyN || 0).toLocaleString(),
    '      \u00B7 No patient identifier:          n = ' + (d.noIdN           || 0).toLocaleString(),
    'Enrolled (\u22651 complete record):         n = ' + (d.enrolledN       || 0).toLocaleString(),
    '  \u00B7 Lost to Follow-up (LTFU):         n = ' + (d.ltfuN           || 0).toLocaleString(),
    '  \u00B7 Returned for Follow-up:           n = ' + (d.followedN       || 0).toLocaleString(),
    'Included in Primary Analysis:          n = ' + (d.analyzedN       || 0).toLocaleString(),
    '',
    'Generated: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    'Platform: ATLAS v8.7 \u2014 Adherence Cartography Platform'
  ].join('\n');
  navigator.clipboard.writeText(lines).then(function() {
    showToast('CONSORT flow copied to clipboard', 2500);
  }).catch(function() {
    showToast('Copy failed \u2014 check clipboard permissions', 2000);
  });
}

// ── Protocol Amendment Log ────────────────────────────────────────────────────

function loadPiAmendments() {
  if (!isPIMode() || !currentWorkspace) return;
  var listEl = document.getElementById('pi-amendment-list');
  if (listEl) listEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">Loading\u2026</div>';

  database.ref('ws_amendments/' + currentWorkspace).orderByChild('createdAt').once('value').then(function(snap) {
    var val  = snap.val();
    var amds = [];
    if (val) {
      Object.keys(val).forEach(function(k) {
        amds.push(Object.assign({}, val[k], { id: k }));
      });
    }
    // Reverse-chronological
    amds.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    // Cache for activity feed
    window._piAmendmentsCache = amds;
    if (typeof renderPiActivityFeed === 'function') renderPiActivityFeed(window._piAllRecords || [], amds);
    _renderPiAmendmentList(amds);
  }).catch(function() {
    _renderPiAmendmentList([]);
  });
}

function _renderPiAmendmentList(amds) {
  var listEl = document.getElementById('pi-amendment-list');
  if (!listEl) return;

  if (!amds || amds.length === 0) {
    listEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No amendments logged yet.</div>';
    return;
  }

  var typeColors = {
    'Protocol Change':    'rgba(78,156,245,0.80)',
    'Enrollment Criteria':'rgba(212,168,67,0.85)',
    'Consent Form':       'rgba(46,201,138,0.80)',
    'Statistical Plan':   'rgba(139,111,245,0.80)',
    'Safety Monitoring':  'rgba(239,68,68,0.80)',
    'Other':              'rgba(156,163,175,0.70)'
  };
  var impactLabels = {
    'Requires Re-consent':      '\u26A0 Re-consent required',
    'Affects Existing Records': '\u26A0 Affects existing records',
    'New Exclusion Criteria':   '\u26A0 New exclusion criteria'
  };

  listEl.innerHTML = amds.map(function(a) {
    var color   = typeColors[a.type] || 'rgba(156,163,175,0.70)';
    var dateStr = a.submittedDate || (a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '\u2014');
    var impactHtml = (a.impact && impactLabels[a.impact])
      ? '<div style="font-family:var(--font-mono);font-size:0.66rem;color:rgba(245,158,11,0.85);margin-top:5px;">' + impactLabels[a.impact] + '</div>'
      : '';
    var effectiveHtml = a.effectiveDate
      ? '<div style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);margin-top:4px;">Effective: ' + _esc(a.effectiveDate) + '</div>'
      : '';
    return '<div style="background:var(--card2);border:1px solid var(--border2);border-left:3px solid ' + color + ';border-radius:6px;padding:12px 14px;margin-bottom:8px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<span style="font-family:var(--font-mono);font-size:0.62rem;border-radius:3px;padding:2px 8px;color:#fff;background:' + color + ';">' + _esc(a.type || 'Amendment') + '</span>' +
          (a.irbNumber ? '<span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);">' + _esc(a.irbNumber) + '</span>' : '') +
        '</div>' +
        '<span style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);white-space:nowrap;margin-left:8px;">' + _esc(dateStr) + '</span>' +
      '</div>' +
      '<div style="font-family:var(--font-mono);font-size:0.74rem;color:var(--text);line-height:1.55;">' + _esc(a.summary || '\u2014') + '</div>' +
      effectiveHtml +
      impactHtml +
    '</div>';
  }).join('');
}

function openPiAmendmentModal() {
  if (!isPIMode()) return;
  ['pi-amend-irb', 'pi-amend-summary', 'pi-amend-submitted', 'pi-amend-effective'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var typeEl   = document.getElementById('pi-amend-type');   if (typeEl)   typeEl.value   = 'Protocol Change';
  var impactEl = document.getElementById('pi-amend-impact'); if (impactEl) impactEl.value = 'None';
  var modal    = document.getElementById('pi-amendment-modal');
  if (modal) modal.style.display = 'flex';
}

function closePiAmendmentModal() {
  var modal = document.getElementById('pi-amendment-modal');
  if (modal) modal.style.display = 'none';
}

function savePiAmendment() {
  var submittedDate = ((document.getElementById('pi-amend-submitted') || {}).value || '').trim();
  var summary       = ((document.getElementById('pi-amend-summary')   || {}).value || '').trim();
  if (!submittedDate) { showToast('IRB submission date is required', 2000); return; }
  if (!summary)       { showToast('Summary of changes is required', 2000);  return; }

  var data = {
    type:          ((document.getElementById('pi-amend-type')      || {}).value || 'Other').trim(),
    irbNumber:     ((document.getElementById('pi-amend-irb')       || {}).value || '').trim(),
    submittedDate: submittedDate,
    effectiveDate: ((document.getElementById('pi-amend-effective') || {}).value || '').trim(),
    summary:       summary,
    impact:        ((document.getElementById('pi-amend-impact')    || {}).value || 'None').trim(),
    createdAt:     Date.now(),
    loggedBy:      currentWorkspace
  };

  database.ref('ws_amendments/' + currentWorkspace).push(data).then(function() {
    closePiAmendmentModal();
    loadPiAmendments();
    atlasAuditLog('amendment_logged', { type: data.type, irbNumber: data.irbNumber, workspace: currentWorkspace });
    showToast('Amendment logged \u2014 record is permanent', 2500);
  }).catch(function(err) {
    showToast('Error saving amendment: ' + (err.message || 'Unknown'), 3000);
  });
}

// ── IRB Package alias — generateIrbPackage() → generateStudyPackage() ─────────
// Exposed as a named entry point so the "Download IRB Package" button can call it
// without depending on the internal function name.
function generateIrbPackage() {
  return generateStudyPackage();
}

// ══════════════════════════════════════════════════════════════════════════════
// OUTCOME REPORT — PI Workspace
// Allows PIs to submit real-world outcomes for the public results page.
// Saved under institutions/{instId}/outcomes/{outcomeId}
// ══════════════════════════════════════════════════════════════════════════════

function renderOutcomeReport() {
  var panel = document.getElementById('pi-outcomes-panel');
  if (!panel) return;

  panel.innerHTML = [
    '<div class="pi-heatmap-hdr" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">',
      '<span>Outcome Report · Real-World Evidence</span>',
      '<button class="pi-lock-btn" style="border-color:rgba(46,201,138,0.3);color:rgba(46,201,138,0.8);" onclick="toggleOutcomeForm()">+ Submit Outcomes</button>',
    '</div>',
    '<div style="font-size:0.76rem;color:var(--dim);margin-bottom:10px;">',
      'Submit your institution\'s adherence outcomes for publication on the <a href="results.html" target="_blank" style="color:rgba(78,156,245,0.8);text-decoration:none;">public results page</a>. Submissions with consent are anonymized before display.',
    '</div>',
    '<div id="pi-outcomes-list"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">Loading previous submissions\u2026</div></div>',

    '<div id="pi-outcome-form" style="display:none;margin-top:14px;">',
      '<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:18px;">',
        '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">New Outcome Report</div>',

        '<!-- Row 1: Institution name + study period -->',
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">',
          '<div>',
            '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Institution Name</label>',
            '<input id="oc-institution" type="text" placeholder="e.g. City Hospital Research Unit" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-body);font-size:0.84rem;outline:none;"/>',
          '</div>',
          '<div>',
            '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Study Start Date</label>',
            '<input id="oc-start" type="date" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;"/>',
          '</div>',
          '<div>',
            '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Study End Date</label>',
            '<input id="oc-end" type="date" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;"/>',
          '</div>',
        '</div>',

        '<!-- Row 2: Participants + primary outcome -->',
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">',
          '<div>',
            '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Number of Participants</label>',
            '<input id="oc-n" type="number" min="1" placeholder="e.g. 120" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-mono);font-size:0.84rem;outline:none;"/>',
          '</div>',
          '<div>',
            '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Primary Outcome — Adherence Improvement (MMAS %)</label>',
            '<input id="oc-primary" type="number" min="-100" max="100" step="0.1" placeholder="e.g. 18.4" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-mono);font-size:0.84rem;outline:none;"/>',
          '</div>',
        '</div>',

        '<!-- Secondary outcomes -->',
        '<div style="margin-bottom:10px;">',
          '<label style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:4px;">Secondary Outcomes / Notes</label>',
          '<textarea id="oc-secondary" rows="4" placeholder="Describe secondary outcomes, context, methods, or relevant observations\u2026" style="width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-body);font-size:0.82rem;line-height:1.55;outline:none;resize:vertical;"></textarea>',
        '</div>',

        '<!-- Consent checkbox -->',
        '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:10px 12px;background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.18);border-radius:6px;">',
          '<input id="oc-consent" type="checkbox" style="margin-top:2px;accent-color:var(--strata);width:15px;height:15px;flex-shrink:0;cursor:pointer;"/>',
          '<label for="oc-consent" style="font-family:var(--font-mono);font-size:0.73rem;color:var(--text);line-height:1.55;cursor:pointer;">',
            'I consent to publishing these anonymized results on the ATLAS public outcomes page. Institution name will appear only if checked; otherwise displayed as "Anonymous Institution".',
          '</label>',
        '</div>',

        '<!-- Action buttons -->',
        '<div style="display:flex;align-items:center;gap:8px;">',
          '<button class="pi-lock-btn" style="border-color:rgba(46,201,138,0.4);color:rgba(46,201,138,0.85);padding:8px 20px;" onclick="submitOutcomeReport()">Submit Report</button>',
          '<button class="pi-lock-btn" style="border-color:rgba(255,255,255,0.1);color:var(--dim);padding:8px 14px;" onclick="toggleOutcomeForm()">Cancel</button>',
          '<span id="oc-saving" style="font-family:var(--font-mono);font-size:0.68rem;color:var(--strata);display:none;">Saving\u2026</span>',
          '<span id="oc-saved"  style="font-family:var(--font-mono);font-size:0.68rem;color:var(--strata);display:none;">\u2713 Saved</span>',
        '</div>',
      '</div>',
    '</div>',
  ].join('');

  _loadOutcomesList();
}

function toggleOutcomeForm() {
  var form = document.getElementById('pi-outcome-form');
  if (!form) return;
  var isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : '';
}

async function submitOutcomeReport() {
  if (!isPIMode() || !currentWorkspace) return;

  var institution = ((document.getElementById('oc-institution') || {}).value || '').trim();
  var start       = ((document.getElementById('oc-start')       || {}).value || '').trim();
  var end         = ((document.getElementById('oc-end')         || {}).value || '').trim();
  var nPart       = parseInt(((document.getElementById('oc-n')  || {}).value || ''), 10);
  var primary     = parseFloat(((document.getElementById('oc-primary') || {}).value || ''));
  var secondary   = ((document.getElementById('oc-secondary')   || {}).value || '').trim();
  var consent     = !!(document.getElementById('oc-consent') || {}).checked;

  if (!institution)      { showToast('Institution name is required.',  2500); return; }
  if (!start || !end)    { showToast('Study start and end dates are required.', 2500); return; }
  if (isNaN(nPart) || nPart < 1) { showToast('Number of participants must be a positive integer.', 2500); return; }
  if (isNaN(primary))   { showToast('Primary outcome (%) is required.', 2500); return; }

  var saving = document.getElementById('oc-saving');
  var saved  = document.getElementById('oc-saved');
  if (saving) saving.style.display = '';
  if (saved)  saved.style.display  = 'none';

  var instId = currentWorkspace.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  var record = {
    institution:  institution,
    study_start:  start,
    study_end:    end,
    n_participants: nPart,
    adherence_improvement_pct: primary,
    secondary_outcomes: secondary,
    consent_publish: consent,
    submitted_by:  currentWorkspace,
    submitted_at:  Date.now(),
  };

  try {
    await database.ref('institutions/' + instId + '/outcomes').push(record);
    if (saving) saving.style.display = 'none';
    if (saved)  { saved.style.display = ''; setTimeout(function() { saved.style.display = 'none'; }, 3000); }
    atlasAuditLog('outcome_report_submitted', { workspace: currentWorkspace, consent: consent });
    showToast('Outcome report saved' + (consent ? ' — will appear on the public results page.' : '.'), 3500);
    // Reset form
    ['oc-institution','oc-start','oc-end','oc-n','oc-primary','oc-secondary'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var cb = document.getElementById('oc-consent'); if (cb) cb.checked = false;
    toggleOutcomeForm();
    _loadOutcomesList();
  } catch(e) {
    if (saving) saving.style.display = 'none';
    showToast('Could not save outcome report: ' + e.message, 4000);
  }
}

function _loadOutcomesList() {
  if (!currentWorkspace) return;
  var listEl = document.getElementById('pi-outcomes-list');
  if (!listEl) return;

  var instId = currentWorkspace.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  database.ref('institutions/' + instId + '/outcomes')
    .orderByChild('submitted_at')
    .once('value')
    .then(function(snap) {
      var val = snap.val();
      if (!val || !Object.keys(val).length) {
        listEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.78rem;">No outcome reports submitted yet.</div>';
        return;
      }
      var entries = Object.values(val).sort(function(a, b) { return (b.submitted_at || 0) - (a.submitted_at || 0); });
      listEl.innerHTML = entries.map(function(o) {
        var pct    = typeof o.adherence_improvement_pct === 'number' ? (o.adherence_improvement_pct >= 0 ? '+' : '') + o.adherence_improvement_pct.toFixed(1) + '%' : '\u2014';
        var period = (o.study_start || '\u2014') + ' \u2013 ' + (o.study_end || 'ongoing');
        var consentBadge = o.consent_publish
          ? '<span style="font-family:var(--font-mono);font-size:0.58rem;background:rgba(46,201,138,0.12);border:1px solid rgba(46,201,138,0.3);color:rgba(46,201,138,0.85);border-radius:3px;padding:1px 6px;">Public</span>'
          : '<span style="font-family:var(--font-mono);font-size:0.58rem;background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--dim);border-radius:3px;padding:1px 6px;">Private</span>';
        var dt = o.submitted_at ? new Date(o.submitted_at).toLocaleDateString() : '';
        return '<div style="background:var(--card2);border:1px solid var(--border2);border-left:3px solid rgba(46,201,138,0.5);border-radius:6px;padding:10px 14px;margin-bottom:7px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
            '<span style="font-family:var(--font-mono);font-size:0.76rem;color:var(--bright);">' + _esc(o.institution || 'Unnamed') + '</span>' +
            '<div style="display:flex;align-items:center;gap:6px;">' + consentBadge + '<span style="font-family:var(--font-mono);font-size:0.64rem;color:var(--dim);">' + _esc(dt) + '</span></div>' +
          '</div>' +
          '<div style="display:flex;gap:18px;font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);margin-bottom:4px;">' +
            '<span>Period: ' + _esc(period) + '</span>' +
            '<span>n\u00A0=\u00A0' + _esc(String(o.n_participants || '\u2014')) + '</span>' +
            '<span style="color:' + (o.adherence_improvement_pct >= 0 ? 'rgba(46,201,138,0.85)' : 'rgba(239,68,68,0.8)') + ';">' + _esc(pct) + ' adherence improvement</span>' +
          '</div>' +
          (o.secondary_outcomes ? '<div style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);white-space:pre-wrap;line-height:1.5;">' + _esc(o.secondary_outcomes.slice(0, 200)) + (o.secondary_outcomes.length > 200 ? '\u2026' : '') + '</div>' : '') +
        '</div>';
      }).join('');
    })
    .catch(function() {
      if (listEl) listEl.innerHTML = '<div style="color:rgba(239,68,68,0.7);font-size:0.76rem;">Could not load outcome reports.</div>';
    });
}

// ── End ATLAS v8.7 PI Research Features ──────────────────────────────────────

// ── P1: patient_number Normalization ──────────────────────────────────────
function _normPatientNum(raw) {
  if (raw == null) return '';
  return String(raw).trim().toLowerCase().replace(/\s+/g, '').replace(/[^\w\-]/g, '');
}
window._normPatientNum = _normPatientNum;

// Data quality warning: detect likely duplicates after normalization
function _piCheckDataQuality(mmasData, peacsData) {
  const warnings = [];
  const mmasNums = (mmasData || []).map(r => ({ raw: r.patient_number, norm: _normPatientNum(r.patient_number) }));
  const peacsNums = (peacsData || []).map(r => ({ raw: r.patient_number, norm: _normPatientNum(r.patient_number) }));

  // Check MMAS for near-duplicate patient numbers (same norm, different raw)
  const mmNormMap = {};
  mmasNums.forEach(({raw, norm}) => { if (!mmNormMap[norm]) mmNormMap[norm] = []; mmNormMap[norm].push(raw); });
  Object.entries(mmNormMap).forEach(([norm, raws]) => {
    if (raws.length > 1) warnings.push({ type: 'mmas_dup', norm, raws, msg: `MMAS: "${raws.join('" / "')}" resolve to same patient after normalization` });
  });

  // Check MMAS patients not found in PEACS and vice versa
  const peacsNormSet = new Set(peacsNums.map(p => p.norm));
  const mmasNormSet = new Set(mmasNums.map(m => m.norm));
  const mmOnly = [...mmasNormSet].filter(n => !peacsNormSet.has(n)).length;
  const peOnly = [...peacsNormSet].filter(n => !mmasNormSet.has(n)).length;
  if (mmOnly > 0) warnings.push({ type: 'info', msg: `${mmOnly} patient(s) have MMAS records but no PEACS assessment` });
  if (peOnly > 0) warnings.push({ type: 'info', msg: `${peOnly} patient(s) have PEACS records but no MMAS assessment` });

  window._piDataQualityWarnings = warnings;
  _piRenderDataQualityPanel(warnings, mmasNums.length, peacsNums.length);
  return warnings;
}

function _piRenderDataQualityPanel(warnings, mmTotal, peTotal) {
  const panel = document.getElementById('pi-data-quality-panel');
  if (!panel) return;
  const errors = warnings.filter(w => w.type !== 'info');
  const infos = warnings.filter(w => w.type === 'info');
  const statusColor = errors.length > 0 ? 'var(--poor,#ef4444)' : infos.length > 0 ? 'var(--moderate,#f59e0b)' : 'var(--strata,#2ec98a)';
  const statusLabel = errors.length > 0 ? `${errors.length} Issue${errors.length > 1 ? 's' : ''} Found` : infos.length > 0 ? `${infos.length} Notice${infos.length > 1 ? 's' : ''}` : 'Clean';
  panel.innerHTML = `
    <div class="pi-dq-header">
      <span class="pi-dq-title">Data Quality</span>
      <span class="pi-dq-badge" style="color:${statusColor};border-color:${statusColor}">${statusLabel}</span>
    </div>
    <div class="pi-dq-stats">
      <span>MMAS: ${mmTotal} records</span><span>PEACS: ${peTotal} records</span>
      <span>Normalized merge: active</span>
    </div>
    ${warnings.length === 0 ? '<div class="pi-dq-ok">All patient numbers resolved cleanly. No duplicates detected.</div>' : ''}
    ${warnings.map(w => `<div class="pi-dq-row pi-dq-${w.type === 'info' ? 'info' : 'warn'}">${w.msg}</div>`).join('')}
  `;
  panel.style.display = 'block';
}
window._piCheckDataQuality = _piCheckDataQuality;

// ── P2: Enrollment Velocity Widget ───────────────────────────────────────
function _piCalcEnrollmentVelocity(records) {
  if (!records || records.length === 0) return null;
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;

  // Parse submission dates
  const dated = records.map(r => {
    const ts = r.timestamp || r.created_at || r.submission_timestamp;
    const d = ts ? (typeof ts === 'number' ? ts : new Date(ts).getTime()) : null;
    return d;
  }).filter(Boolean);

  const thisWeek = dated.filter(d => now - d <= oneWeek).length;
  const lastWeek = dated.filter(d => (now - d > oneWeek) && (now - d <= twoWeeks)).length;
  const delta = thisWeek - lastWeek;

  // Projected completion
  const targetN = parseInt(sessionStorage.getItem('_pi_target_n') || '0') || null;
  let projection = null;
  if (targetN && thisWeek > 0) {
    const remaining = Math.max(0, targetN - records.length);
    const weeksNeeded = remaining / thisWeek;
    const projDate = new Date(now + weeksNeeded * oneWeek);
    projection = projDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  return { thisWeek, lastWeek, delta, total: records.length, targetN, projection };
}

function _piRenderVelocityCard(records) {
  const card = document.getElementById('pi-velocity-card');
  if (!card) return;
  const v = _piCalcEnrollmentVelocity(records);
  if (!v) { card.style.display = 'none'; return; }

  const deltaSign = v.delta > 0 ? '+' : '';
  const deltaColor = v.delta > 0 ? 'var(--strata,#2ec98a)' : v.delta < 0 ? 'var(--poor,#ef4444)' : 'var(--text-muted,#8090a8)';
  const arrow = v.delta > 0 ? '↑' : v.delta < 0 ? '↓' : '→';

  // Pace assessment if target set
  let paceHtml = '';
  if (v.targetN) {
    const pct = v.total / v.targetN;
    const paceColor = pct >= 0.85 ? 'var(--strata,#2ec98a)' : pct >= 0.7 ? 'var(--moderate,#f59e0b)' : 'var(--poor,#ef4444)';
    paceHtml = `<div class="pi-vel-pace" style="color:${paceColor}">${v.total} / ${v.targetN} enrolled (${Math.round(pct * 100)}%)</div>`;
  }

  card.innerHTML = `
    <div class="pi-vel-eyebrow">This Week</div>
    <div class="pi-vel-main">
      <span class="pi-vel-count">${v.thisWeek}</span>
      <span class="pi-vel-delta" style="color:${deltaColor}">${arrow} ${deltaSign}${v.delta} vs last week</span>
    </div>
    ${paceHtml}
    ${v.projection ? `<div class="pi-vel-proj">At this pace: <strong>${v.projection}</strong></div>` : ''}
    <div class="pi-vel-set-target">
      <input type="number" id="pi-vel-target-input" class="pi-vel-target-inp" placeholder="Set target N" value="${v.targetN || ''}" min="1" max="99999" onchange="piSetTargetN(this.value)">
    </div>
  `;
  card.style.display = 'block';
}

function piSetTargetN(val) {
  const n = parseInt(val);
  if (n > 0) sessionStorage.setItem('_pi_target_n', String(n));
  // Re-render with current data
  const records = window._mmasCohort || window._mmCohort || window._piAllRecords || [];
  _piRenderVelocityCard(records);
}
window._piRenderVelocityCard = _piRenderVelocityCard;
window.piSetTargetN = piSetTargetN;

// ── P3: Self-Service Key Rotation ─────────────────────────────────────────
function piOpenKeyRotation() {
  const modal = document.getElementById('pi-key-rotate-modal');
  if (modal) modal.style.display = 'flex';
}

function piCloseKeyRotation() {
  const modal = document.getElementById('pi-key-rotate-modal');
  if (modal) modal.style.display = 'none';
  const result = document.getElementById('pi-rotate-result');
  if (result) { result.textContent = ''; result.style.display = 'none'; }
}

async function piConfirmKeyRotation() {
  const btn = document.getElementById('pi-rotate-confirm-btn');
  const result = document.getElementById('pi-rotate-result');
  if (btn) btn.disabled = true;
  if (result) { result.style.display = 'none'; }

  try {
    const currentKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey');
    if (!currentKey) throw new Error('No workspace key found in session.');

    // Verify this key belongs to current user (PI-tier only)
    const keyRole = window._currentWorkspaceProfile?.role || sessionStorage.getItem('_wsRole');
    if (!keyRole || !['pi','researcher'].includes(keyRole.toLowerCase())) {
      throw new Error('Key rotation is available for PI and Researcher workspace keys only.');
    }

    // Call the key revocation API (scoped to own key only)
    const workerBase = window._WORKER_URL || '/_worker';
    const response = await fetch(`${workerBase}/rotate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebase.auth().currentUser?.getIdToken()}` },
      body: JSON.stringify({ current_key: currentKey, scope: 'self' })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    const newKey = data.new_key;

    // Clear session and show new key
    sessionStorage.removeItem('_wsKey');
    sessionStorage.removeItem('_wsProfile');
    if (result) {
      result.innerHTML = `
        <div class="pi-rotate-success">
          <div class="pi-rotate-success-label">New Workspace Key</div>
          <div class="pi-rotate-new-key" id="pi-rotate-new-key-display">${newKey || 'Check your email — key sent via Magic Link'}</div>
          ${newKey ? `<button class="pi-rotate-copy" onclick="navigator.clipboard.writeText('${newKey}').then(()=>this.textContent='Copied!')">Copy Key</button>` : ''}
          <p class="pi-rotate-note">Your previous key has been revoked. All sessions using the old key have been signed out. Save your new key securely.</p>
        </div>`;
      result.style.display = 'block';
    }
    if (btn) btn.style.display = 'none';
    document.getElementById('pi-rotate-cancel-btn')?.textContent && (document.getElementById('pi-rotate-cancel-btn').textContent = 'Close');

  } catch(err) {
    if (result) {
      result.innerHTML = `<div class="pi-rotate-err">Rotation failed: ${err.message}</div>`;
      result.style.display = 'block';
    }
    if (btn) btn.disabled = false;
  }
}
window.piOpenKeyRotation = piOpenKeyRotation;
window.piCloseKeyRotation = piCloseKeyRotation;
window.piConfirmKeyRotation = piConfirmKeyRotation;

function piCheckAndConfirmRotation() {
  const acks = ['pi-rotate-ack-1','pi-rotate-ack-2','pi-rotate-ack-3'];
  const allChecked = acks.every(id => document.getElementById(id)?.checked);
  if (!allChecked) {
    const result = document.getElementById('pi-rotate-result');
    if (result) { result.innerHTML = '<div class="pi-rotate-err">Please confirm all acknowledgements above before proceeding.</div>'; result.style.display = 'block'; }
    return;
  }
  piConfirmKeyRotation();
}
window.piCheckAndConfirmRotation = piCheckAndConfirmRotation;

// ══════════════════════════════════════════════════════════════════
// PI TAB SYSTEM
// ══════════════════════════════════════════════════════════════════

/**
 * Switches the active tab in the PI research dashboard.
 * @param {string} tab - 'overview' | 'enrollment' | 'governance' | 'outcomes' | 'team'
 */
function switchPiTab(tab) {
  document.querySelectorAll('.pi-dash-tab').forEach(function(btn) {
    var isActive = btn.dataset.piTab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.color             = isActive ? 'var(--base)' : 'var(--dim)';
    btn.style.borderBottomColor = isActive ? 'var(--base)' : 'transparent';
  });
  ['overview', 'enrollment', 'governance', 'outcomes', 'team', 'lab', 'extcomp', 'psychometrics'].forEach(function(t) {
    var panel = document.getElementById('pi-tab-panel-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  // Lazy-init Instrument Lab on first open
  if (tab === 'lab' && !window._piLabLoaded) {
    window._piLabLoaded = true;
    var labPanel = document.getElementById('pi-tab-panel-lab');
    if (labPanel && typeof _saRenderLab === 'function') {
      var theme = document.documentElement.getAttribute('data-theme') || 'dark';
      labPanel.setAttribute('data-atlas-theme', theme === 'light' ? 'light' : 'dark');
      if (typeof _saResolveColors === 'function') _saResolveColors(labPanel);
      if (typeof _rlInjectStyles === 'function') _rlInjectStyles();
      _saRenderLab(labPanel);
    }
  }
  // Lazy-init Method Comparator on first open
  if (tab === 'extcomp' && !window._piExtCompLoaded) {
    window._piExtCompLoaded = true;
    var extPanel = document.getElementById('pi-tab-panel-extcomp');
    if (extPanel && typeof _saRenderExtComp === 'function') {
      var theme = document.documentElement.getAttribute('data-theme') || 'dark';
      extPanel.setAttribute('data-atlas-theme', theme === 'light' ? 'light' : 'dark');
      if (typeof _saResolveColors === 'function') _saResolveColors(extPanel);
      _saRenderExtComp(extPanel);
    }
  }
  // Lazy-init Psychometrics on first open
  if (tab === 'psychometrics' && !window._piPsyLoaded) {
    window._piPsyLoaded = true;
    var psyPanel = document.getElementById('pi-tab-panel-psychometrics');
    if (psyPanel) _piInitPsychometrics(psyPanel);
  }
  // Lazy-init team tab on first open — mirror quota bar + site list
  if (tab === 'team' && !window._piTeamLoaded) {
    window._piTeamLoaded = true;
    // Mirror site data into team panel
    var quotaSrc = document.getElementById('pi-quota-bar');
    var quotaTgt = document.getElementById('pi-quota-bar-team');
    if (quotaSrc && quotaTgt) quotaTgt.textContent = quotaSrc.textContent;
    var listSrc = document.getElementById('pi-site-list');
    var listTgt = document.getElementById('pi-site-list-team');
    if (listSrc && listTgt) listTgt.innerHTML = listSrc.innerHTML;
  }
}

// ══════════════════════════════════════════════════════════════════
// PI SETTINGS MODAL
// ══════════════════════════════════════════════════════════════════

function openPiSettings() {
  const modal = document.getElementById('pi-settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  // Populate from workspaceProfile
  const wp = window.workspaceProfile || {};
  const _set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  _set('pi-cfg-title', wp.study_title || wp.display_name);
  _set('pi-cfg-irb', wp.irb_protocol);
  _set('pi-cfg-nct', wp.clinicaltrials_id);
  _set('pi-cfg-funding', wp.funding_source);
  _set('pi-cfg-start', wp.study_start);
  _set('pi-cfg-end', wp.study_end);
  // Enrollment target
  const savedTarget = localStorage.getItem('pi_enrollment_target_' + (wp.workspace_key || ''));
  _set('pi-settings-target-input', savedTarget || '');
  // Retention settings
  const retentionDays = localStorage.getItem('pi_retention_alert_days') || '90';
  _set('pi-retention-alert-days', retentionDays);
  // Notifications
  const notif = JSON.parse(localStorage.getItem('pi_notifications') || '{}');
  _set('pi-notif-enrollment', notif.enrollment || '25pct');
  _set('pi-notif-retention', notif.retention || '90');
  _set('pi-notif-amendment', notif.amendment || 'immediate');
  _set('pi-notif-lock', notif.lock || 'immediate');
  switchPiSettingsTab('study');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePiSettings() {
  const modal = document.getElementById('pi-settings-modal');
  if (modal) modal.style.display = 'none';
}

function switchPiSettingsTab(tab) {
  document.querySelectorAll('.pi-settings-nav').forEach(function(btn) {
    var isActive = btn.dataset.piSettingsTab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.background      = isActive ? 'rgba(78,156,245,0.10)' : 'none';
    btn.style.borderLeftColor = isActive ? 'var(--base)' : 'transparent';
    btn.style.color           = isActive ? 'var(--text)' : 'var(--dim)';
  });
  document.querySelectorAll('.pi-settings-panel').forEach(function(panel) {
    panel.style.display = panel.id === 'pi-settings-panel-' + tab ? '' : 'none';
  });
}

function savePiStudyProfile() {
  const data = {
    study_title:       document.getElementById('pi-cfg-title').value.trim(),
    irb_protocol:      document.getElementById('pi-cfg-irb').value.trim(),
    clinicaltrials_id: document.getElementById('pi-cfg-nct').value.trim(),
    funding_source:    document.getElementById('pi-cfg-funding').value,
    study_start:       document.getElementById('pi-cfg-start').value,
    study_end:         document.getElementById('pi-cfg-end').value,
  };
  // Update workspaceProfile in memory
  if (window.workspaceProfile) Object.assign(window.workspaceProfile, data);
  // Update dashboard header
  const nameEl = document.getElementById('pi-dash-study-name');
  if (nameEl && data.study_title) nameEl.textContent = data.study_title;
  const protocolEl = document.getElementById('pi-protocol-display');
  if (protocolEl && data.irb_protocol) protocolEl.textContent = data.irb_protocol;
  localStorage.setItem('pi_study_profile', JSON.stringify(data));
  if (typeof atlasAuditLog === 'function') atlasAuditLog('pi_study_profile_saved', data);
}

function savePiRetentionSettings() {
  const days = document.getElementById('pi-retention-alert-days').value;
  localStorage.setItem('pi_retention_alert_days', days);
}

function savePiNotifications() {
  const notif = {
    enrollment: document.getElementById('pi-notif-enrollment').value,
    retention:  document.getElementById('pi-notif-retention').value,
    amendment:  document.getElementById('pi-notif-amendment').value,
    lock:       document.getElementById('pi-notif-lock').value,
  };
  localStorage.setItem('pi_notifications', JSON.stringify(notif));
}

// ── IRB Progress Report — Claude AI Narrative Generator ──────────────────────
async function generateIrbProgressReport() {
  const btn = document.getElementById('pi-irb-report-btn');
  const out = document.getElementById('pi-irb-report-output');
  if (!btn || !out) return;

  btn.disabled = true;
  btn.textContent = '✦ Generating…';
  out.style.display = '';
  out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);animation:blink 1.4s ease-in-out infinite;">Drafting IRB progress report narrative…</div>';

  // Collect cohort data
  const records = window.dashMmasData || window._rppMmasData || [];
  const peacsRec = window.dashPeacsData || window._rppPeacsData || [];
  const total = records.length;
  const scores = records.map(r => parseFloat(r.score||r.mmas_score||0)).filter(s => s > 0);
  const avgScore = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : 'N/A';
  const highAdh = scores.filter(s => s >= 6).length;
  const medAdh  = scores.filter(s => s >= 4 && s < 6).length;
  const lowAdh  = scores.filter(s => s < 4).length;
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))];
  const studyTitle = (window._atlasActiveStudy && window._atlasActiveStudy.title) || localStorage.getItem('atlas_active_study_title') || 'current study';
  const targetN = (window.workspaceProfile && window.workspaceProfile.enrollmentTarget) || '(target not set)';
  const piName = (window.workspaceProfile && window.workspaceProfile.name) || currentWorkspace || 'PI';

  const prompt = `You are writing an IRB progress report narrative for a medication adherence research study.

Study: ${studyTitle}
Principal Investigator: ${piName}
Total enrolled participants: ${total} (target: ${targetN})
Countries represented: ${countries.length > 0 ? countries.slice(0,8).join(', ') : 'not recorded'}
Mean MMAS adherence score: ${avgScore}/8
Adherence distribution: High (≥6): ${highAdh} (${total ? Math.round(100*highAdh/total) : 0}%) | Medium (4-5): ${medAdh} (${total ? Math.round(100*medAdh/total) : 0}%) | Low (<4): ${lowAdh} (${total ? Math.round(100*lowAdh/total) : 0}%)
PEACS assessments completed: ${peacsRec.length}

Write a professional IRB progress report narrative section (3-4 paragraphs). Include: enrollment status and trajectory, summary of adherence findings to date, any notable patterns, and a brief statement on data integrity and study conduct. Use formal academic language appropriate for an IRB committee. Do not fabricate specific dates or names beyond what is provided.`;

  try {
    // Use same endpoint as ZOE/IVM — AWS Lambda proxy
    const resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are a professional research documentation specialist generating IRB progress report narratives for clinical adherence research studies. Write in formal academic style.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const text = (data.content && data.content[0] && data.content[0].text) || (data.error ? ('Error: ' + (data.error.message||JSON.stringify(data.error))) : 'No response');
    out.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--pe);margin-bottom:10px;">✦ IRB Progress Report Narrative · AI Draft</div>' +
      '<div style="font-family:var(--font-body);font-size:0.88rem;line-height:1.7;color:var(--text);white-space:pre-wrap;">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;">' +
        '<button onclick="navigator.clipboard.writeText(document.getElementById(\'pi-irb-report-output\').querySelector(\'div:nth-child(2)\').textContent)" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.25);color:rgba(212,168,67,0.8);padding:5px 12px;border-radius:6px;cursor:pointer;">Copy Text</button>' +
        '<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);align-self:center;">AI draft · review before submission</div>' +
      '</div>';
  } catch(e) {
    out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">Could not generate report. Please try again.</div>';
  }

  btn.disabled = false;
  btn.textContent = '✦ Regenerate IRB Report';
}

function showPiSettingsToast(msg) {
  const toast = document.getElementById('pi-settings-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}

// ══════════════════════════════════════════════════════════════════
// PI COMMAND CENTER — SITE MATRIX + VITALS STRIP
// ══════════════════════════════════════════════════════════════════

/** All loaded site records — cached for filter without re-fetch */
window._piSiteMatrixData = [];

/**
 * Renders the multi-site status matrix from site workspace data.
 * Called after loadPiSites() resolves with site data.
 * @param {Array} sites - Array of site workspace objects from Firebase
 * @param {Array} records - All assessment records across allowed workspaces
 */
function renderPiSiteMatrix(sites, records) {
  window._piSiteMatrixData = sites;

  const badge = document.getElementById('pi-site-count-badge');
  if (badge) badge.textContent = sites.length + ' site' + (sites.length !== 1 ? 's' : '');

  _applyPiSiteMatrixFilter(sites, records, 'all');
}

/**
 * Filters the site matrix by status category.
 */
function filterPiSiteMatrix() {
  const filter = document.getElementById('pi-site-filter');
  const val = filter ? filter.value : 'all';
  _applyPiSiteMatrixFilter(window._piSiteMatrixData, window._piAllRecords || [], val);
}

/**
 * Internal — applies filter and renders rows.
 */
function _applyPiSiteMatrixFilter(sites, records, filter) {
  const body = document.getElementById('pi-site-matrix-body');
  const empty = document.getElementById('pi-site-matrix-empty');
  if (!body) return;

  // Build per-site record index
  const byWS = {};
  (records || []).forEach(r => {
    const ws = r.workspace_key || r.institution_code || '';
    if (!byWS[ws]) byWS[ws] = [];
    byWS[ws].push(r);
  });

  // Compute site stats
  const siteStats = sites.map(site => {
    const wsKey = site.workspace_key || site.key || '';
    const siteRecords = byWS[wsKey] || [];
    const enrolled = siteRecords.filter(r => r.mmas_score !== undefined).length;
    const now = Date.now();
    const timestamps = siteRecords.map(r => r.timestamp || r.created_at || 0).filter(Boolean);
    const lastTs = timestamps.length ? Math.max(...timestamps) : 0;
    const daysSinceLast = lastTs ? Math.round((now - lastTs) / 86400000) : null;
    const overdueCount = siteRecords.filter(r => {
      const ts = r.timestamp || r.created_at || 0;
      return r.mmas_score < 6 && (now - ts) > 30 * 86400000;
    }).length;

    // Status
    let status = 'active';
    if (daysSinceLast === null || daysSinceLast > 14) status = 'stalled';
    else if (daysSinceLast > 7) status = 'low';

    // Compliance
    let compliance = 'on-track';
    if (overdueCount > 0) compliance = 'warning';
    if (overdueCount > 3) compliance = 'alert';

    return { site, wsKey, enrolled, daysSinceLast, overdueCount, status, compliance, lastTs };
  });

  // Apply filter
  const filtered = filter === 'all' ? siteStats : siteStats.filter(s => s.status === filter);

  if (filtered.length === 0) {
    body.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  body.innerHTML = filtered.map((s, idx) => {
    const statusDot = {
      active:  '<span style="width:8px;height:8px;border-radius:50%;background:var(--strata);display:inline-block;" title="Active"></span>',
      low:     '<span style="width:8px;height:8px;border-radius:50%;background:var(--moderate);display:inline-block;" title="Low activity"></span>',
      stalled: '<span style="width:8px;height:8px;border-radius:50%;background:var(--poor);display:inline-block;" title="Stalled"></span>',
    }[s.status];

    const complianceBadge = {
      'on-track': '<span style="font-family:var(--font-mono);font-size:0.62rem;background:rgba(46,201,138,0.10);border:1px solid rgba(46,201,138,0.25);color:var(--strata);border-radius:20px;padding:2px 8px;">✓ On Track</span>',
      'warning':  '<span style="font-family:var(--font-mono);font-size:0.62rem;background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.25);color:var(--moderate);border-radius:20px;padding:2px 8px;">⚠ ' + s.overdueCount + ' Overdue</span>',
      'alert':    '<span style="font-family:var(--font-mono);font-size:0.62rem;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);color:var(--poor);border-radius:20px;padding:2px 8px;">✗ ' + s.overdueCount + ' Overdue</span>',
    }[s.compliance];

    const lastActive = s.daysSinceLast === null ? '<span style="color:var(--dim);">Never</span>'
      : s.daysSinceLast === 0 ? '<span style="color:var(--strata);">Today</span>'
      : s.daysSinceLast === 1 ? '<span style="color:var(--strata);">Yesterday</span>'
      : s.daysSinceLast <= 7 ? '<span style="color:var(--text);">' + s.daysSinceLast + 'd ago</span>'
      : '<span style="color:var(--poor);">' + s.daysSinceLast + 'd ago</span>';

    const alertsCell = s.overdueCount > 0
      ? '<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--poor);">' + s.overdueCount + '</span>'
      : '<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">—</span>';

    const siteName = s.site.display_name || s.site.name || s.wsKey;
    const siteRole = s.site.role || 'researcher';

    return `<div class="pi-site-matrix-row" data-ws="${s.wsKey}" data-idx="${idx}" onclick="togglePiSiteDetail('${s.wsKey}', ${idx})"
      style="display:grid;grid-template-columns:2fr 80px 110px 100px 80px 90px 80px;gap:0;padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;align-items:center;"
      onmouseover="this.style.background='rgba(255,255,255,0.025)'" onmouseout="this.style.background='none'">
      <div>
        <div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--text);">${siteName}</div>
        <div style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);margin-top:2px;text-transform:capitalize;">${siteRole} · ${s.wsKey}</div>
      </div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.2rem;font-weight:300;color:var(--bright);text-align:right;">${s.enrolled}</div>
      <div style="text-align:right;font-size:0.78rem;">${lastActive}</div>
      <div style="text-align:center;">${complianceBadge}</div>
      <div style="text-align:center;">${alertsCell}</div>
      <div style="text-align:center;">${statusDot}</div>
      <div style="text-align:right;"><span style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim);">Details ›</span></div>
    </div>`;
  }).join('');
}

/**
 * Expands/collapses the site detail drawer below the matrix.
 */
function togglePiSiteDetail(wsKey, idx) {
  const drawer = document.getElementById('pi-site-detail-drawer');
  if (!drawer) return;

  // If already showing this site, collapse
  if (drawer.dataset.wsKey === wsKey && drawer.style.display !== 'none') {
    drawer.style.display = 'none';
    drawer.dataset.wsKey = '';
    // Remove active highlight from all rows
    document.querySelectorAll('.pi-site-matrix-row').forEach(r => r.style.background = 'none');
    return;
  }

  drawer.dataset.wsKey = wsKey;
  drawer.style.display = '';

  // Highlight active row
  document.querySelectorAll('.pi-site-matrix-row').forEach(r => {
    r.style.background = r.dataset.ws === wsKey ? 'rgba(78,156,245,0.05)' : 'none';
  });

  const s = (window._piSiteMatrixData || []).find(s => (s.workspace_key || s.key) === wsKey);
  const records = (window._piAllRecords || []).filter(r => (r.workspace_key || r.institution_code) === wsKey);
  const enrolled = records.filter(r => r.mmas_score !== undefined).length;
  const scores = records.map(r => r.mmas_score).filter(v => v != null);
  const meanScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '—';
  const highAdh = scores.length ? Math.round(scores.filter(s => s >= 6).length / scores.length * 100) : '—';

  // Recent records for mini log
  const recent = records
    .filter(r => r.timestamp || r.created_at)
    .sort((a, b) => (b.timestamp || b.created_at) - (a.timestamp || a.created_at))
    .slice(0, 5);

  const siteName = (s && (s.display_name || s.name)) || wsKey;

  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Site Detail</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.2rem;font-weight:300;color:var(--bright);">${siteName}</div>
      </div>
      <button onclick="togglePiSiteDetail('${wsKey}', ${idx})" style="background:none;border:none;color:var(--dim);font-size:1.1rem;cursor:pointer;padding:4px 8px;border-radius:4px;transition:color 0.15s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--dim)'">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright);">${enrolled}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.10em;color:var(--dim);margin-top:3px;">Enrolled</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright);">${meanScore}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.10em;color:var(--dim);margin-top:3px;">Mean MMAS-8</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright);">${highAdh}${typeof highAdh === 'number' ? '%' : ''}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.10em;color:var(--dim);margin-top:3px;">High Adherence</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright);">${scores.length}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.10em;color:var(--dim);margin-top:3px;">Assessments</div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <div style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Recent Submissions</div>
      ${recent.length === 0
        ? '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">No submissions recorded.</div>'
        : recent.map(r => {
            const ts = r.timestamp || r.created_at;
            const date = ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const pid = r.patient_id ? '· ' + String(r.patient_id).slice(0, 8) + '…' : '';
            const score = r.mmas_score != null ? 'MMAS-8: ' + r.mmas_score : '';
            return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);">
              <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);flex-shrink:0;">${date}</span>
              <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--muted);">${score} ${pid}</span>
            </div>`;
          }).join('')
      }
    </div>`;
}

/**
 * Renders the recent activity feed in Vitals panel 3.
 * @param {Array} records - All records across allowed workspaces
 * @param {Array} amendments - Protocol amendments
 */
function renderPiActivityFeed(records, amendments) {
  const feed = document.getElementById('pi-activity-feed');
  if (!feed) return;

  const events = [];

  // Assessment submissions (most recent 8)
  const sorted = (records || [])
    .filter(r => r.timestamp || r.created_at)
    .sort((a, b) => (b.timestamp || b.created_at) - (a.timestamp || a.created_at))
    .slice(0, 8);

  sorted.forEach(r => {
    const ts = r.timestamp || r.created_at;
    const ws = r.workspace_key || r.institution_code || 'unknown';
    const tool = r.tool === 'map' ? 'MAP' : r.pe_score !== undefined ? 'PEACS' : 'MMAS-8';
    events.push({ ts, label: tool + ' assessment', sub: ws, type: 'assessment' });
  });

  // Amendments (most recent 3)
  (amendments || []).slice(0, 3).forEach(a => {
    events.push({ ts: a.submitted || a.created_at, label: 'Amendment filed', sub: a.type || 'Protocol Change', type: 'amendment' });
  });

  // Sort all events by time desc
  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const top = events.slice(0, 7);

  if (top.length === 0) {
    feed.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">No activity yet.</div>';
    return;
  }

  const typeIcon = { assessment: '●', amendment: '⚑' };
  const typeColor = { assessment: 'var(--base)', amendment: 'var(--moderate)' };

  feed.innerHTML = top.map(ev => {
    const ts = ev.ts;
    const now = Date.now();
    const diff = ts ? now - ts : null;
    const ago = !diff ? '—'
      : diff < 3600000 ? Math.round(diff / 60000) + 'm ago'
      : diff < 86400000 ? Math.round(diff / 3600000) + 'h ago'
      : Math.round(diff / 86400000) + 'd ago';

    return `<div style="display:flex;align-items:flex-start;gap:8px;">
      <span style="font-size:0.50rem;color:${typeColor[ev.type]};margin-top:4px;flex-shrink:0;">${typeIcon[ev.type]}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.label}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);">${ev.sub} · ${ago}</div>
      </div>
    </div>`;
  }).join('');
}

/**
 * Updates the enrollment progress ring in Vitals panel 1.
 * @param {number} enrolled - Count of enrolled participants
 * @param {number} target - Enrollment target (0 = no target)
 */
function updatePiProgressRing(enrolled, target) {
  const ring = document.getElementById('pi-vital-ring');
  const pct = document.getElementById('pi-vital-ring-pct');
  const statusBadge = document.getElementById('pi-vital-enroll-status');
  if (!ring) return;

  if (!target || target <= 0) {
    ring.style.strokeDashoffset = '188.5';
    if (pct) pct.textContent = '—';
    return;
  }
  const ratio = Math.min(enrolled / target, 1);
  const offset = 188.5 * (1 - ratio);
  ring.style.strokeDashoffset = offset.toFixed(1);
  if (pct) pct.textContent = Math.round(ratio * 100) + '%';

  // Update status badge
  if (statusBadge) {
    if (ratio >= 1) {
      statusBadge.textContent = 'Complete';
      statusBadge.style.background = 'rgba(46,201,138,0.10)';
      statusBadge.style.borderColor = 'rgba(46,201,138,0.25)';
      statusBadge.style.color = 'var(--strata)';
    } else if (ratio >= 0.5) {
      statusBadge.textContent = 'On Track';
    } else {
      statusBadge.textContent = 'Enrolling';
      statusBadge.style.background = 'rgba(78,156,245,0.10)';
      statusBadge.style.borderColor = 'rgba(78,156,245,0.25)';
      statusBadge.style.color = 'var(--base)';
    }
  }
}

/**
 * Populates CONSORT numbers in Vitals panel 2.
 * @param {object} counts - { assessed, enrolled, ltfu, analyzed }
 */
function updatePiVitalsConsort(counts) {
  const _set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val != null ? val : '—'; };
  _set('pi-consort-assessed', counts.assessed);
  _set('pi-consort-enrolled', counts.enrolled);
  _set('pi-consort-ltfu', counts.ltfu);
  _set('pi-consort-analyzed', counts.analyzed);
}


// ══════════════════════════════════════════════════════════════════════════════
// PI PSYCHOMETRICS TAB
// Reliability · Distributions · Classification · Cross-Instrument
// Data: window._piAllRecords (MMAS/MAP), window._rppPeacsData (PEACS)
// ══════════════════════════════════════════════════════════════════════════════

window._piPsyLoaded = false;
window._piPsySub    = 'reliability';

// ── Entry point ───────────────────────────────────────────────────────────────
function _piInitPsychometrics(container) {
  container.innerHTML = `
    <div style="padding:4px 0 18px;">
      <div style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--base);opacity:0.7;margin-bottom:3px;">Psychometrics</div>
      <div style="font-family:var(--font-mono);font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:14px;">Instrument Statistics</div>

      <!-- Sub-nav -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border2);">
        <button class="pi-psy-sub-btn" data-sub="reliability"
          onclick="piPsySwitchSub('reliability')"
          style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid var(--base);background:rgba(78,156,245,0.10);color:var(--base);cursor:pointer;transition:all 0.15s;">Reliability</button>
        <button class="pi-psy-sub-btn" data-sub="distributions"
          onclick="piPsySwitchSub('distributions')"
          style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--dim);cursor:pointer;transition:all 0.15s;">Distributions</button>
        <button class="pi-psy-sub-btn" data-sub="classification"
          onclick="piPsySwitchSub('classification')"
          style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--dim);cursor:pointer;transition:all 0.15s;">Classification</button>
        <button class="pi-psy-sub-btn" data-sub="crossinstrument"
          onclick="piPsySwitchSub('crossinstrument')"
          style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--dim);cursor:pointer;transition:all 0.15s;">Cross-Instrument</button>
        <button class="pi-psy-sub-btn" data-sub="methods"
          onclick="piPsySwitchSub('methods')"
          style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:6px 14px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--dim);cursor:pointer;transition:all 0.15s;">Methods</button>
      </div>

      <div id="pi-psy-body"></div>
    </div>`;

  piPsySwitchSub('reliability');
}

function piPsySwitchSub(sub) {
  window._piPsySub = sub;
  document.querySelectorAll('.pi-psy-sub-btn').forEach(function(btn) {
    var isActive = btn.dataset.sub === sub;
    btn.style.background  = isActive ? 'rgba(78,156,245,0.10)' : 'transparent';
    btn.style.borderColor = isActive ? 'var(--base)'           : 'var(--border2)';
    btn.style.color       = isActive ? 'var(--base)'           : 'var(--dim)';
  });
  var body = document.getElementById('pi-psy-body');
  if (!body) return;
  if      (sub === 'reliability')     _piPsyReliability(body);
  else if (sub === 'distributions')   _piPsyDistributions(body);
  else if (sub === 'classification')  _piPsyClassification(body);
  else if (sub === 'crossinstrument') _piPsyCrossInstrument(body);
  else if (sub === 'methods')         _piPsyMethods(body);
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function _piPsyMean(a) { return a.length?a.reduce(function(s,x){return s+x;},0)/a.length:0; }
function _piPsySD(a) {
  if(a.length<2) return 0;
  var m=_piPsyMean(a);
  return Math.sqrt(a.reduce(function(s,x){return s+(x-m)*(x-m);},0)/(a.length-1));
}
function _piPsyCronbach(matrix) {
  var n=matrix.length, k=matrix[0]?matrix[0].length:0;
  if(n<2||k<2) return NaN;
  var itemVars=[];
  for(var j=0;j<k;j++){
    var col=matrix.map(function(r){return r[j]||0;});
    var s=_piPsySD(col); itemVars.push(s*s);
  }
  var tots=matrix.map(function(r){return r.reduce(function(a,b){return a+b;},0);});
  var tv=_piPsySD(tots); tv*=tv;
  return tv>0?(k/(k-1))*(1-itemVars.reduce(function(a,b){return a+b;},0)/tv):NaN;
}
function _piPsyAlphaCI(alpha,n,k) {
  if(!isFinite(alpha)||n<2||k<2) return {low:NaN,high:NaN};
  var se=Math.sqrt(2*k*Math.pow(1-alpha,2)/(n*(k-1)));
  return {low:Math.max(0,alpha-1.96*se), high:Math.min(1,alpha+1.96*se)};
}
function _piPsyPearsonR(a,b) {
  var n=a.length; if(n<2) return NaN;
  var ma=_piPsyMean(a),mb=_piPsyMean(b),num=0,da=0,db=0;
  for(var i=0;i<n;i++){num+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)*(a[i]-ma);db+=(b[i]-mb)*(b[i]-mb);}
  return (da>0&&db>0)?num/Math.sqrt(da*db):NaN;
}
function _piPsyCohenD(m1,s1,m2,s2){var p=Math.sqrt((s1*s1+s2*s2)/2);return p>0?(m1-m2)/p:NaN;}
function _piPsyEffLabel(d){var a=Math.abs(d||0);return a>=0.80?'large':a>=0.50?'medium':a>=0.20?'small':'negligible';}
function _piPsyFmt(v,dec){return isFinite(v)?v.toFixed(dec!=null?dec:3):'—';}

function _piPsyCard(title, subtitle, content) {
  return `<div style="background:var(--card);border:1px solid var(--border2);border-radius:8px;padding:16px 18px;margin-bottom:16px;">
    <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--base);margin-bottom:2px;">${title}</div>
    ${subtitle?`<div style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);margin-bottom:10px;">${subtitle}</div>`:''}
    ${content}
  </div>`;
}
function _piPsyKpi(label,value,sub,ok) {
  var col = ok===true?'#2ec98a':ok===false?'#f87171':'var(--text)';
  return `<div style="display:inline-block;margin-right:22px;margin-bottom:10px;vertical-align:top;">
    <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-bottom:2px;">${label}</div>
    <div style="font-family:var(--font-mono);font-size:1.0rem;font-weight:700;color:${col};">${value}</div>
    ${sub?`<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:1px;">${sub}</div>`:''}
  </div>`;
}
function _piPsyNote(text) {
  return `<div style="margin-top:10px;font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);line-height:1.65;border-top:1px solid var(--border2);padding-top:8px;">${text}</div>`;
}
function _piPsyEmpty(msg) {
  return `<div style="font-family:var(--font-mono);font-size:0.74rem;color:var(--dim);padding:12px 0;">${msg||'Insufficient data — need ≥ 10 records.'}</div>`;
}

// ── RELIABILITY ───────────────────────────────────────────────────────────────
function _piPsyReliability(body) {
  var allRows   = window._piAllRecords || [];
  var mmasRows  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var mapRows   = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var peacsRecs = window._rppPeacsData||[];
  var html = '';

  // MMAS-8
  var mmasN = mmasRows.length;
  if (mmasN >= 10) {
    var mat = mmasRows.map(function(r){
      return [+r.q1||0,+r.q2||0,+r.q3||0,+r.q4||0,+r.q5||0,+r.q6||0,+r.q7||0,+r.q8||0];
    });
    var alpha = _piPsyCronbach(mat);
    var ci    = _piPsyAlphaCI(alpha, mmasN, 8);
    var odd   = mat.map(function(r){return r[0]+r[2]+r[4]+r[6];});
    var even  = mat.map(function(r){return r[1]+r[3]+r[5]+r[7];});
    var rSH   = _piPsyPearsonR(odd, even);
    var sbCorr = isFinite(rSH)?(2*rSH)/(1+rSH):NaN;
    html += _piPsyCard(
      'MMAS-8 · Internal Consistency',
      'N\u2009=\u2009'+mmasN+' records · 8 items',
      _piPsyKpi("Cronbach's α", _piPsyFmt(alpha), isFinite(ci.low)?'95% CI ['+_piPsyFmt(ci.low)+', '+_piPsyFmt(ci.high)+']':'', alpha>=0.70) +
      _piPsyKpi('Split-Half (S-B)', _piPsyFmt(sbCorr), 'Spearman-Brown', isFinite(sbCorr)?sbCorr>=0.70:undefined) +
      _piPsyKpi('k', '8', 'items', undefined) +
      _piPsyNote(alpha>=0.80?'&#10003; Excellent reliability (\u03b1\u2009\u2265\u20090.80) — suitable for clinical and research use.':
                 alpha>=0.70?'&#9888; Acceptable reliability (\u03b1\u2009\u2265\u20090.70) — adequate for group-level research.':
                 '&#9888; Low reliability (\u03b1\u2009<\u20090.70) — review item quality or data collection procedures.')
    );
  } else {
    html += _piPsyCard('MMAS-8 · Internal Consistency', 'N\u2009=\u2009'+mmasN, _piPsyEmpty('Need \u2265 10 MMAS-8 records.'));
  }

  // MAP — full scale + domain subscales
  var mapN = mapRows.length;
  if (mapN >= 10) {
    var mat = mapRows.map(function(r){
      return [
        +(r.map_q1||r.q1)||0, +(r.map_q2||r.q2)||0, +(r.map_q3||r.q3)||0,
        +(r.map_q4||r.q4)||0, +(r.map_q5||r.q5)||0, +(r.map_q6||r.q6)||0,
        +(r.map_q7||r.q7)||0, +(r.map_q8||r.q8)||0
      ];
    });
    var alpha = _piPsyCronbach(mat);
    var ci    = _piPsyAlphaCI(alpha, mapN, 8);
    var archM = mapRows.map(function(r){return [+(r.map_q2||r.q2)||0,+(r.map_q3||r.q3)||0,+(r.map_q6||r.q6)||0];});
    var execM = mapRows.map(function(r){return [+(r.map_q1||r.q1)||0,+(r.map_q5||r.q5)||0,+(r.map_q8||r.q8)||0];});
    var ctxM  = mapRows.map(function(r){return [+(r.map_q4||r.q4)||0,+(r.map_q7||r.q7)||0];});
    html += _piPsyCard(
      'MAP · Internal Consistency',
      'N\u2009=\u2009'+mapN+' records · 8 items across 3 domains',
      _piPsyKpi('Full-Scale α', _piPsyFmt(alpha), '95% CI ['+_piPsyFmt(ci.low)+', '+_piPsyFmt(ci.high)+']', alpha>=0.70) +
      _piPsyKpi('Architecture α', _piPsyFmt(_piPsyCronbach(archM)), 'Q2, Q3, Q6 (k=3)', undefined) +
      _piPsyKpi('Execution α', _piPsyFmt(_piPsyCronbach(execM)), 'Q1, Q5, Q8 (k=3)', undefined) +
      _piPsyKpi('Context α', _piPsyFmt(_piPsyCronbach(ctxM)), 'Q4, Q7 (k=2)', undefined) +
      _piPsyNote('Domain-level α values with k=2 (Context) will be lower by formula — report all four coefficients. Adequate domain α is ≥ 0.60.')
    );
  } else {
    html += _piPsyCard('MAP · Internal Consistency', 'N\u2009=\u2009'+mapN, _piPsyEmpty('Need \u2265 10 MAP records.'));
  }

  // PEACS — subscale inter-correlations as convergent evidence
  var peN = peacsRecs.length;
  if (peN >= 5) {
    var base   = peacsRecs.map(function(r){return +(r.base)||0;});
    var mvmt   = peacsRecs.map(function(r){return +(r.mvmt)||0;});
    var strata = peacsRecs.map(function(r){return +(r.strata)||0;});
    var rBM=_piPsyPearsonR(base,mvmt), rBS=_piPsyPearsonR(base,strata), rMS=_piPsyPearsonR(mvmt,strata);
    var rics=[rBM,rBS,rMS].filter(isFinite);
    var avgR = rics.length?_piPsyMean(rics):NaN;
    var omegaEst = isFinite(avgR)?(3*avgR)/(1+2*avgR):NaN;
    html += _piPsyCard(
      'PEACS · Subscale Convergence',
      'N\u2009=\u2009'+peN+' records · BASE / MVMT / STRATA subscales',
      _piPsyKpi('BASE\u2013MVMT r', _piPsyFmt(rBM), 'Architecture\u2194Execution', isFinite(rBM)?rBM>=0.25:undefined) +
      _piPsyKpi('BASE\u2013STRATA r', _piPsyFmt(rBS), 'Architecture\u2194Context', isFinite(rBS)?rBS>=0.25:undefined) +
      _piPsyKpi('MVMT\u2013STRATA r', _piPsyFmt(rMS), 'Execution\u2194Context', isFinite(rMS)?rMS>=0.25:undefined) +
      _piPsyKpi('\u03c9 Estimate', _piPsyFmt(omegaEst), '3-subscale composite', isFinite(omegaEst)?omegaEst>=0.70:undefined) +
      _piPsyNote('PEACS subscales are theoretically non-redundant. Moderate inter-correlations (0.25\u20130.55) support convergent validity without redundancy.')
    );
  } else {
    html += _piPsyCard('PEACS · Subscale Convergence', 'N\u2009=\u2009'+peN, _piPsyEmpty('Need \u2265 5 PEACS records.'));
  }

  body.innerHTML = html || _piPsyEmpty('No assessment data available.');
}

// ── DISTRIBUTIONS ─────────────────────────────────────────────────────────────
function _piPsyDistributions(body) {
  var allRows   = window._piAllRecords || [];
  var mmasRows  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var mapRows   = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var peacsRecs = window._rppPeacsData||[];
  var html = '';

  function _histBars(values, bins, colors) {
    if (!values.length) return _piPsyEmpty();
    var counts = bins.map(function(b,i){
      return values.filter(function(v){return i===bins.length-1?v>=b.lo&&v<=b.hi:v>=b.lo&&v<b.hi;}).length;
    });
    var maxCount = Math.max.apply(null, counts)||1;
    return counts.map(function(cnt,i){
      var pct=Math.round(cnt/values.length*100);
      var barW=Math.round(cnt/maxCount*100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
        '<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);width:48px;text-align:right;">'+bins[i].label+'</div>' +
        '<div style="flex:1;height:18px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;">' +
          '<div style="width:'+barW+'%;height:100%;background:'+(colors[i]||'var(--base)')+';border-radius:3px;opacity:0.75;"></div>' +
        '</div>' +
        '<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);width:70px;">'+cnt+' ('+pct+'%)</div>' +
      '</div>';
    }).join('');
  }

  // MMAS-8 score distribution
  if (mmasRows.length >= 3) {
    var scores = mmasRows.map(function(r){return parseFloat(r.score)||0;});
    var m = _piPsyMean(scores), sd = _piPsySD(scores);
    var nHigh=scores.filter(function(v){return v>=8;}).length;
    var nMed =scores.filter(function(v){return v>=6&&v<8;}).length;
    var nLow =scores.filter(function(v){return v<6;}).length;
    html += _piPsyCard(
      'MMAS-8 · Score Distribution',
      'N\u2009=\u2009'+mmasRows.length+' · Mean\u2009=\u2009'+_piPsyFmt(m,2)+' · SD\u2009=\u2009'+_piPsyFmt(sd,2),
      _histBars(scores,
        [{lo:0,hi:3,label:'0\u20132'},{lo:3,hi:5,label:'3\u20134'},{lo:5,hi:6,label:'5'},{lo:6,hi:7,label:'6'},{lo:7,hi:8,label:'7'},{lo:8,hi:8,label:'8'}],
        ['#f87171','#f87171','#fb923c','#fbbf24','#a3e635','#2ec98a']
      ) +
      '<div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;">' +
        _piPsyKpi('High (\u22658)', nHigh+' ('+Math.round(nHigh/mmasRows.length*100)+'%)', 'score = 8', undefined) +
        _piPsyKpi('Medium', nMed+' ('+Math.round(nMed/mmasRows.length*100)+'%)', '6 \u2264 score < 8', undefined) +
        _piPsyKpi('Low (<6)', nLow+' ('+Math.round(nLow/mmasRows.length*100)+'%)', 'score < 6', undefined) +
      '</div>'
    );
  }

  // MAP — PE zone distribution
  if (mapRows.length >= 3) {
    var peVals = mapRows.map(function(r){
      var a=parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;
      var e=parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;
      var c=parseFloat(r.ctx_score)||(+(r.map_q7||r.q7)||0);
      return Math.pow(Math.max(0,a*e*(0.5+0.5*c)),1/3);
    });
    var m=_piPsyMean(peVals), sd=_piPsySD(peVals);
    // Domain means
    var archMean=_piPsyMean(mapRows.map(function(r){return parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;}));
    var execMean=_piPsyMean(mapRows.map(function(r){return parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;}));
    var ctxMean =_piPsyMean(mapRows.map(function(r){return parseFloat(r.ctx_score)||(+(r.map_q7||r.q7)||0);}));
    html += _piPsyCard(
      'MAP · PE Distribution + Domain Profile',
      'N\u2009=\u2009'+mapRows.length+' · Mean PE\u2009=\u2009'+_piPsyFmt(m,3)+' · SD\u2009=\u2009'+_piPsyFmt(sd,3),
      _histBars(peVals,
        [{lo:0,hi:0.40,label:'<0.40'},{lo:0.40,hi:0.60,label:'0.40\u20130.60'},{lo:0.60,hi:0.75,label:'0.60\u20130.75'},{lo:0.75,hi:0.85,label:'0.75\u20130.85'},{lo:0.85,hi:1.01,label:'\u22650.85'}],
        ['#f87171','#fb923c','#fbbf24','#a3e635','#2ec98a']
      ) +
      '<div style="margin-top:12px;">' +
        '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Domain Means</div>' +
        _piPsyKpi('Architecture', _piPsyFmt(archMean,3), 'Q2, Q3, Q6', undefined) +
        _piPsyKpi('Execution', _piPsyFmt(execMean,3), 'Q1, Q5, Q8', undefined) +
        _piPsyKpi('Context', _piPsyFmt(ctxMean,3), 'Q4, Q7', undefined) +
      '</div>'
    );
  }

  // PEACS — PE and subscale distributions
  if (peacsRecs.length >= 3) {
    var peVals = peacsRecs.map(function(r){return parseFloat(r.pe_score||r.pe)||0;}).filter(function(v){return v>0;});
    var baseMean=_piPsyMean(peacsRecs.map(function(r){return +(r.base)||0;}));
    var mvmtMean=_piPsyMean(peacsRecs.map(function(r){return +(r.mvmt)||0;}));
    var strMean =_piPsyMean(peacsRecs.map(function(r){return +(r.strata)||0;}));
    var m=_piPsyMean(peVals), sd=_piPsySD(peVals);
    html += _piPsyCard(
      'PEACS · PE & Subscale Distribution',
      'N\u2009=\u2009'+peacsRecs.length+' records · Mean PE\u2009=\u2009'+_piPsyFmt(m,3),
      _histBars(peVals,
        [{lo:0,hi:0.40,label:'<0.40'},{lo:0.40,hi:0.60,label:'0.40\u20130.60'},{lo:0.60,hi:0.75,label:'0.60\u20130.75'},{lo:0.75,hi:0.85,label:'0.75\u20130.85'},{lo:0.85,hi:1.01,label:'\u22650.85'}],
        ['#f87171','#fb923c','#fbbf24','#a3e635','#7c3aed']
      ) +
      '<div style="margin-top:12px;">' +
        _piPsyKpi('BASE', _piPsyFmt(baseMean,3), 'Architecture subscale', undefined) +
        _piPsyKpi('MVMT', _piPsyFmt(mvmtMean,3), 'Execution subscale', undefined) +
        _piPsyKpi('STRATA', _piPsyFmt(strMean,3), 'Context subscale', undefined) +
        _piPsyKpi('SD(PE)', _piPsyFmt(sd,3), 'cohort spread', undefined) +
      '</div>'
    );
  }

  if (!html) html = _piPsyEmpty('No assessment data available yet.');
  body.innerHTML = html;
}

// ── CLASSIFICATION ────────────────────────────────────────────────────────────
function _piPsyConfusionGrid(tp, fp, fn, tn, posLabel, negLabel, threshNote) {
  var n = tp+fp+fn+tn||1;
  var sens   = tp+fn>0 ? tp/(tp+fn) : 0;
  var spec   = tn+fp>0 ? tn/(tn+fp) : 0;
  var ppv    = tp+fp>0 ? tp/(tp+fp) : 0;
  var npv    = tn+fn>0 ? tn/(tn+fn) : 0;
  var f1     = (ppv+sens)>0 ? 2*ppv*sens/(ppv+sens) : 0;
  var pObs   = (tp+tn)/n;
  var pExp   = ((tp+fp)/n)*((tp+fn)/n) + ((fn+tn)/n)*((fp+tn)/n);
  var kappa  = pExp<1 ? (pObs-pExp)/(1-pExp) : 0;
  function _cell(v, type) {
    var pct  = Math.round(v/n*100);
    var abbr = {tp:'TP',fp:'FP',fn:'FN',tn:'TN'}[type];
    var bg   = (type==='tp'||type==='tn') ? 'rgba(5,150,105,0.13)' : 'rgba(220,38,38,0.08)';
    var col  = (type==='tp'||type==='tn') ? '#059669' : '#dc2626';
    return '<td style="text-align:center;padding:10px 16px;background:'+bg+';border-radius:5px;min-width:72px;">' +
      '<div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;color:'+col+';">'+v+'</div>' +
      '<div style="font-family:var(--font-mono);font-size:0.58rem;color:'+col+';opacity:0.75;">'+pct+'% · '+abbr+'</div>' +
    '</td>';
  }
  var grid =
    '<div style="overflow-x:auto;margin-bottom:14px;">' +
    '<table style="border-collapse:separate;border-spacing:4px;">' +
      '<thead>' +
        '<tr>' +
          '<td style="padding:4px 10px;"></td>' +
          '<th colspan="2" style="font-family:var(--font-mono);font-size:0.60rem;font-weight:600;color:var(--dim);letter-spacing:0.08em;text-transform:uppercase;text-align:center;padding:4px 8px;">Actual</th>' +
        '</tr>' +
        '<tr>' +
          '<td style="font-family:var(--font-mono);font-size:0.58rem;color:var(--dim);letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;">Predicted</td>' +
          '<th style="font-family:var(--font-mono);font-size:0.64rem;font-weight:500;color:var(--dim);text-align:center;padding:6px 16px;">'+posLabel+'</th>' +
          '<th style="font-family:var(--font-mono);font-size:0.64rem;font-weight:500;color:var(--dim);text-align:center;padding:6px 16px;">'+negLabel+'</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        '<tr>' +
          '<td style="font-family:var(--font-mono);font-size:0.64rem;font-weight:500;color:var(--dim);padding:6px 10px;white-space:nowrap;">'+posLabel+'</td>' +
          _cell(tp,'tp')+_cell(fp,'fp') +
        '</tr>' +
        '<tr>' +
          '<td style="font-family:var(--font-mono);font-size:0.64rem;font-weight:500;color:var(--dim);padding:6px 10px;white-space:nowrap;">'+negLabel+'</td>' +
          _cell(fn,'fn')+_cell(tn,'tn') +
        '</tr>' +
      '</tbody>' +
    '</table>' +
    '</div>' +
    (threshNote ? '<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-bottom:10px;opacity:0.8;">'+threshNote+'</div>' : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px;">' +
      _piPsyKpi('Sensitivity',  (sens*100).toFixed(1)+'%', 'TP\u2215(TP+FN)', undefined) +
      _piPsyKpi('Specificity',  (spec*100).toFixed(1)+'%', 'TN\u2215(TN+FP)', undefined) +
      _piPsyKpi('PPV',          (ppv*100).toFixed(1)+'%',  'TP\u2215(TP+FP)', undefined) +
      _piPsyKpi('NPV',          (npv*100).toFixed(1)+'%',  'TN\u2215(TN+FN)', undefined) +
      _piPsyKpi('F\u2081',      f1.toFixed(3),             '2\u00d7PPV\u00d7Sens\u2215(PPV+Sens)', undefined) +
      _piPsyKpi('\u03ba',       kappa.toFixed(3),          'beyond-chance agreement', undefined) +
    '</div>';
  return grid;
}

function _piPsyClassification(body) {
  var allRows   = window._piAllRecords||[];
  var mmasRows  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var mapRows   = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var peacsRecs = window._rppPeacsData||[];
  var html      = '';

  // MMAS-8: Predicted Adherent = score ≥ 6.52 (norm μ), Actual Adherent = score ≥ 6 (clinical cut)
  if (mmasRows.length >= 6) {
    var scores = mmasRows.map(function(r){return parseFloat(r.score)||0;});
    var n = scores.length;
    var tp=0,fp=0,fn=0,tn=0;
    scores.forEach(function(s){
      var predAdh = s>=6.52, actAdh = s>=6;
      if(predAdh&&actAdh) tp++;
      else if(predAdh&&!actAdh) fp++;
      else if(!predAdh&&actAdh) fn++;
      else tn++;
    });
    // INA vs UNA of non-adherers (score < 6)
    var nINA=0, nUNA=0, nMix=0, nonAdh=scores.filter(function(v){return v<6;}).length;
    mmasRows.forEach(function(r){
      var s=parseFloat(r.score)||0; if(s>=6) return;
      if(typeof classifyPattern==='function'){
        try{var cp=classifyPattern(r);if(cp.intentional>cp.unintentional)nINA++;else if(cp.unintentional>cp.intentional)nUNA++;else nMix++;}catch(e){nUNA++;}
      } else { nUNA++; }
    });
    html += _piPsyCard(
      'MMAS-8 · Adherence Classification',
      'N\u2009=\u2009'+n+' · Binary confusion matrix',
      _piPsyConfusionGrid(tp,fp,fn,tn,'Adherent','Non-Adherent',
        'Predicted: score\u2009\u2265\u20096.52 (norm \u03bc) \u2502 Actual: score\u2009\u2265\u20096 (clinical cut)') +
      (nonAdh>0 ? '<div style="margin-top:10px;">' +
        _piPsyKpi('INA', nINA+' ('+Math.round(nINA/Math.max(1,nonAdh)*100)+'%)', 'intentional, of non-adherers', undefined) +
        _piPsyKpi('UNA', nUNA+' ('+Math.round(nUNA/Math.max(1,nonAdh)*100)+'%)', 'unintentional', undefined) +
        _piPsyKpi('Mixed', nMix+' ('+Math.round(nMix/Math.max(1,nonAdh)*100)+'%)', 'combined pattern', undefined) +
      '</div>' : '') +
      _piPsyNote('INA/UNA breakdown applies only to non-adherers (score < 6). INA = intentional non-adherence; UNA = unintentional (forgetting, practical barriers).')
    );
  } else {
    html += _piPsyCard('MMAS-8 · Adherence Classification','N\u2009=\u2009'+mmasRows.length, _piPsyEmpty('Need \u2265 6 MMAS-8 records.'));
  }

  // MAP: Predicted High PE = PE ≥ 0.72 (baseline μ), Actual High PE = PE ≥ 0.60 (clinical threshold)
  if (mapRows.length >= 6) {
    var peVals  = mapRows.map(function(r){
      var a=parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;
      var e=parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;
      var c=parseFloat(r.ctx_score)||(+(r.map_q7||r.q7)||0);
      return Math.pow(Math.max(0,a*e*(0.5+0.5*c)),1/3);
    });
    var archVals=mapRows.map(function(r){return parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;});
    var execVals=mapRows.map(function(r){return parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;});
    var n=mapRows.length, tp=0,fp=0,fn=0,tn=0;
    peVals.forEach(function(pe){
      var predHigh = pe>=0.72, actHigh = pe>=0.60;
      if(predHigh&&actHigh) tp++;
      else if(predHigh&&!actHigh) fp++;
      else if(!predHigh&&actHigh) fn++;
      else tn++;
    });
    var nINA=0,nUNA=0, nNonHigh=peVals.filter(function(v){return v<0.85;}).length;
    mapRows.forEach(function(r,i){
      if(peVals[i]>=0.85) return;
      if(archVals[i]<execVals[i]) nINA++; else nUNA++;
    });
    html += _piPsyCard(
      'MAP · PE Zone Classification',
      'N\u2009=\u2009'+n+' · Non-compensatory PE with context guard',
      _piPsyConfusionGrid(tp,fp,fn,tn,'High PE','Not High PE',
        'Predicted: PE\u2009\u2265\u20090.72 (baseline \u03bc) \u2502 Actual: PE\u2009\u2265\u20090.60 (clinical threshold)') +
      '<div style="margin-top:10px;">' +
        _piPsyKpi('INA Pattern', nINA+' ('+Math.round(nINA/Math.max(1,nNonHigh)*100)+'%)', 'Architecture\u2009<\u2009Execution', undefined) +
        _piPsyKpi('UNA Pattern', nUNA+' ('+Math.round(nUNA/Math.max(1,nNonHigh)*100)+'%)', 'Execution\u2009<\u2009Architecture', undefined) +
      '</div>' +
      _piPsyNote('INA: Architecture domain lower than Execution — deliberate decision not to take medication. UNA: Execution lower — forgetting or practical barriers. Measured among non-High PE cases (PE < 0.85).')
    );
  } else {
    html += _piPsyCard('MAP · PE Zone Classification','N\u2009=\u2009'+mapRows.length, _piPsyEmpty('Need \u2265 6 MAP records.'));
  }

  // PEACS: Predicted High PE = PE ≥ 0.68 (PEACS norm), Actual High PE = PE ≥ 0.60
  if (peacsRecs.length >= 6) {
    var n=peacsRecs.length, tp=0,fp=0,fn=0,tn=0;
    peacsRecs.forEach(function(r){
      var pe=parseFloat(r.pe_score||r.pe)||0;
      var predHigh = pe>=0.68, actHigh = pe>=0.60;
      if(predHigh&&actHigh) tp++;
      else if(predHigh&&!actHigh) fp++;
      else if(!predHigh&&actHigh) fn++;
      else tn++;
    });
    html += _piPsyCard(
      'PEACS · PE Zone Classification',
      'N\u2009=\u2009'+n+' · Subscale-weighted PE composite',
      _piPsyConfusionGrid(tp,fp,fn,tn,'High PE','Not High PE',
        'Predicted: PE\u2009\u2265\u20090.68 (PEACS norm \u03bc) \u2502 Actual: PE\u2009\u2265\u20090.60 (clinical threshold)') +
      _piPsyNote('PEACS PE composite is derived from Base, Movement, and Strata subscales. Threshold 0.68 is the cross-cohort PEACS baseline. Threshold 0.60 represents clinical high-risk cut.')
    );
  } else {
    html += _piPsyCard('PEACS · PE Zone Classification','N\u2009=\u2009'+peacsRecs.length, _piPsyEmpty('Need \u2265 6 PEACS records.'));
  }

  if (!html) html = _piPsyEmpty('No assessment data available.');
  body.innerHTML = html;
}

// ── CROSS-INSTRUMENT ──────────────────────────────────────────────────────────
function _piPsyCrossInstrument(body) {
  var allRows   = window._piAllRecords||[];
  var mmasRows  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined&&r.patient_number;});
  var mapRows   = allRows.filter(function(r){return (r.tool==='map'||r.map_q1!==undefined)&&r.patient_number;});
  var peacsRecs = (window._rppPeacsData||[]).filter(function(r){return r.patient_number;});
  var html      = '';

  function _normPid(v){ return String(v||'').trim().toUpperCase(); }

  // Build patient-keyed maps (latest record per patient per instrument)
  var mmasMap={}, mapMap={}, peacsMap={};
  mmasRows.forEach(function(r){
    var p=_normPid(r.patient_number);
    if(!mmasMap[p]||r.timestamp>mmasMap[p].timestamp) mmasMap[p]=r;
  });
  mapRows.forEach(function(r){
    var p=_normPid(r.patient_number);
    if(!mapMap[p]||r.timestamp>mapMap[p].timestamp) mapMap[p]=r;
  });
  peacsRecs.forEach(function(r){
    var p=_normPid(r.patient_number);
    if(!peacsMap[p]||r.timestamp>peacsMap[p].timestamp) peacsMap[p]=r;
  });

  // MMAS score for a record
  function _mmasScore(r){ return parseFloat(r.score)||0; }
  // MAP PE for a record
  function _mapPE(r){
    var a=parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;
    var e=parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;
    var c=parseFloat(r.ctx_score)||(+(r.map_q7||r.q7)||0);
    return Math.pow(Math.max(0,a*e*(0.5+0.5*c)),1/3);
  }
  // PEACS PE
  function _peacsPE(r){ return parseFloat(r.pe_score||r.pe)||0; }

  // Pairs: MMAS ↔ MAP (same patient, both have records)
  var allPids = Array.from(new Set(Object.keys(mmasMap).concat(Object.keys(mapMap)).concat(Object.keys(peacsMap))));
  var mmasPE_pairs=[], mmasXpeacs=[], mapXpeacs=[];
  allPids.forEach(function(p){
    var m=mmasMap[p], ap=mapMap[p], pp=peacsMap[p];
    if(m&&ap){ mmasPE_pairs.push({mmas:_mmasScore(m), mapPE:_mapPE(ap)}); }
    if(m&&pp){ mmasXpeacs.push({mmas:_mmasScore(m), peacs:_peacsPE(pp)}); }
    if(ap&&pp){ mapXpeacs.push({mapPE:_mapPE(ap), peacs:_peacsPE(pp)}); }
  });

  function _corrRow(label, pairs, xKey, yKey, note) {
    if (pairs.length < 5) return '<tr><td style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);padding:6px 12px 6px 0;">'+label+'</td>' +
      '<td colspan="3" style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);padding:6px 12px;">'+(pairs.length?'N\u2009=\u2009'+pairs.length+' (need \u2265 5)':'No matched pairs')+'</td></tr>';
    var xs=pairs.map(function(p){return p[xKey];});
    var ys=pairs.map(function(p){return p[yKey];});
    var r=_piPsyPearsonR(xs,ys);
    var rAbs=Math.abs(r||0);
    var strength=rAbs>=0.70?'Strong':rAbs>=0.40?'Moderate':rAbs>=0.20?'Weak':'Negligible';
    var col=rAbs>=0.40?'#2ec98a':rAbs>=0.20?'#fbbf24':'#f87171';
    return '<tr>' +
      '<td style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);padding:6px 12px 6px 0;white-space:nowrap;">'+label+'</td>' +
      '<td style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:'+col+';padding:6px 12px;text-align:center;">'+_piPsyFmt(r,3)+'</td>' +
      '<td style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);padding:6px 12px;text-align:center;">'+pairs.length+'</td>' +
      '<td style="font-family:var(--font-mono);font-size:0.62rem;color:'+col+';padding:6px 12px;">'+strength+'</td>' +
    '</tr>';
  }

  html += _piPsyCard(
    'Cross-Instrument Correlations',
    'Pearson r between matched patient records (latest per instrument per patient)',
    '<table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr>' +
        '<th style="font-family:var(--font-mono);font-size:0.58rem;font-weight:500;color:var(--dim);text-align:left;padding:4px 12px 8px 0;border-bottom:1px solid var(--border2);">Pair</th>' +
        '<th style="font-family:var(--font-mono);font-size:0.58rem;font-weight:500;color:var(--dim);text-align:center;padding:4px 12px 8px;border-bottom:1px solid var(--border2);">r</th>' +
        '<th style="font-family:var(--font-mono);font-size:0.58rem;font-weight:500;color:var(--dim);text-align:center;padding:4px 12px 8px;border-bottom:1px solid var(--border2);">N pairs</th>' +
        '<th style="font-family:var(--font-mono);font-size:0.58rem;font-weight:500;color:var(--dim);text-align:left;padding:4px 12px 8px;border-bottom:1px solid var(--border2);">Strength</th>' +
      '</thead>' +
      '<tbody>' +
        _corrRow('MMAS-8 Score\u2009\u2194\u2009MAP PE', mmasPE_pairs, 'mmas', 'mapPE', '') +
        _corrRow('MMAS-8 Score\u2009\u2194\u2009PEACS PE', mmasXpeacs, 'mmas', 'peacs', '') +
        _corrRow('MAP PE\u2009\u2194\u2009PEACS PE', mapXpeacs, 'mapPE', 'peacs', '') +
      '</tbody>' +
    '</table>' +
    _piPsyNote('Matching is by patient_number — only patients with records in both instruments contribute to each correlation. Strong cross-instrument correlations (\u2265 0.60) support convergent validity. Moderate correlations (0.40\u20130.60) indicate related but non-redundant constructs.')
  );

  // Sample sizes table
  var nMmasOnly = Object.keys(mmasMap).filter(function(p){return !mapMap[p]&&!peacsMap[p];}).length;
  var nMapOnly  = Object.keys(mapMap).filter(function(p){return !mmasMap[p]&&!peacsMap[p];}).length;
  var nPeOnly   = Object.keys(peacsMap).filter(function(p){return !mmasMap[p]&&!mapMap[p];}).length;
  var nAll      = allPids.filter(function(p){return mmasMap[p]&&mapMap[p]&&peacsMap[p];}).length;
  html += _piPsyCard(
    'Patient Coverage Summary',
    'Unique patients by instrument combination',
    _piPsyKpi('MMAS-8 Only', nMmasOnly.toString(), 'no MAP or PEACS', undefined) +
    _piPsyKpi('MAP Only', nMapOnly.toString(), 'no MMAS or PEACS', undefined) +
    _piPsyKpi('PEACS Only', nPeOnly.toString(), 'no MMAS or MAP', undefined) +
    _piPsyKpi('All Three', nAll.toString(), 'full cross-instrument', nAll>0) +
    _piPsyKpi('MMAS\u2194MAP Pairs', mmasPE_pairs.length.toString(), 'matched patients', mmasPE_pairs.length>=5) +
    _piPsyKpi('MMAS\u2194PEACS Pairs', mmasXpeacs.length.toString(), 'matched patients', mmasXpeacs.length>=5) +
    _piPsyKpi('MAP\u2194PEACS Pairs', mapXpeacs.length.toString(), 'matched patients', mapXpeacs.length>=5)
  );

  body.innerHTML = html;
}

// ── METHODS ───────────────────────────────────────────────────────────────────
function _piPsyPrintMethods() {
  var w = window.open('', '_blank', 'width=750,height=960,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — allow pop-ups then try again.'); return; }
  var css = [
    'body{font-family:"IBM Plex Mono",monospace;max-width:660px;margin:36px auto;color:#1a1a1a;font-size:0.78rem;line-height:1.6;}',
    'h1{font-size:1.0rem;font-weight:700;margin:0 0 4px;letter-spacing:0.04em;}',
    '.subtitle{font-size:0.62rem;color:#666;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:28px;}',
    'h2{font-size:0.68rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#3b82f6;margin:24px 0 10px;padding-bottom:5px;border-bottom:1px solid #bfdbfe;}',
    '.fcard{background:#fafafa;border-left:3px solid #3b82f6;padding:10px 14px;margin:8px 0;border-radius:0 4px 4px 0;}',
    '.fname{font-weight:700;font-size:0.75rem;margin-bottom:3px;}',
    '.fformula{font-size:0.82rem;color:#1a1a1a;margin:3px 0 5px;letter-spacing:0.02em;}',
    '.fwhere{font-size:0.62rem;color:#555;margin-top:3px;}',
    '.finterp{font-size:0.62rem;color:#444;font-style:italic;margin-top:4px;border-top:1px solid #e8e8e8;padding-top:4px;}',
    'table{border-collapse:collapse;width:100%;margin:10px 0;}',
    'td,th{padding:5px 10px;border:1px solid #ddd;font-size:0.70rem;text-align:left;}',
    'th{background:#f5f5f5;font-weight:600;}',
    '.ref{font-size:0.60rem;color:#888;margin-top:24px;border-top:1px solid #ddd;padding-top:10px;}',
    '@media print{body{margin:18px;} .no-print{display:none;}}'
  ].join('');
  var body = [
    '<h1>ATLAS Psychometric Methods Reference</h1>',
    '<div class="subtitle">ATLAS v8 \u2014 PI Psychometrics Dashboard \u2014 Formulas &amp; Norms</div>',
    '<h2>Reliability</h2>',
    '<div class="fcard"><div class="fname">Cronbach\u2019s \u03b1</div><div class="fformula">\u03b1 = k/(k\u22121) \u00d7 (1 \u2212 \u03a3\u03c3\u1d62\u00b2 / \u03c3\u209c\u00b2)</div><div class="fwhere">k = items \u2502 \u03c3\u1d62\u00b2 = item variance \u2502 \u03c3\u209c\u00b2 = total score variance</div><div class="finterp">\u2265 0.90 excellent \u00b7 0.80\u20130.89 good \u00b7 0.70\u20130.79 acceptable \u00b7 < 0.70 poor</div></div>',
    '<div class="fcard"><div class="fname">95% CI for \u03b1 (Bonett, 2002)</div><div class="fformula">SE(\u03b1) \u2248 \u221a[ 2k(1\u2212\u03b1)\u00b2 / ((k\u22121)(N\u22121)) ] \u2003 CI: \u03b1 \u00b1 1.96 \u00d7 SE</div></div>',
    '<div class="fcard"><div class="fname">Spearman-Brown Split-Half</div><div class="fformula">\u03c1_SB = 2r / (1 + r)</div><div class="fwhere">r = Pearson r between odd/even item halves</div></div>',
    '<div class="fcard"><div class="fname">McDonald\u2019s \u03c9 (estimate)</div><div class="fformula">\u03c9 \u2248 (\u03a3\u03bb\u1d62)\u00b2 / [(\u03a3\u03bb\u1d62)\u00b2 + \u03a3\u03b5\u1d62\u1d62]</div></div>',
    '<h2>Classification</h2>',
    '<div class="fcard"><div class="fname">Confusion Matrix</div><table><tr><th></th><th>Actual Positive</th><th>Actual Negative</th></tr><tr><td>Predicted Positive</td><td>TP</td><td>FP</td></tr><tr><td>Predicted Negative</td><td>FN</td><td>TN</td></tr></table></div>',
    '<div class="fcard"><div class="fname">Sensitivity</div><div class="fformula">TP / (TP + FN)</div></div>',
    '<div class="fcard"><div class="fname">Specificity</div><div class="fformula">TN / (TN + FP)</div></div>',
    '<div class="fcard"><div class="fname">PPV (Precision)</div><div class="fformula">TP / (TP + FP)</div></div>',
    '<div class="fcard"><div class="fname">NPV</div><div class="fformula">TN / (TN + FN)</div></div>',
    '<div class="fcard"><div class="fname">F\u2081 Score</div><div class="fformula">2 \u00d7 PPV \u00d7 Sensitivity / (PPV + Sensitivity)</div></div>',
    '<div class="fcard"><div class="fname">Cohen\u2019s \u03ba</div><div class="fformula">\u03ba = (p_obs \u2212 p_exp) / (1 \u2212 p_exp)</div><div class="fwhere">p_obs = (TP+TN)/N \u2502 p_exp = [(TP+FP)/N \u00d7 (TP+FN)/N] + [(FN+TN)/N \u00d7 (FP+TN)/N]</div><div class="finterp">\u2265 0.80 almost perfect \u00b7 0.60\u20130.79 substantial \u00b7 0.40\u20130.59 moderate \u00b7 < 0.40 fair/poor</div></div>',
    '<h2>Effect Size</h2>',
    '<div class="fcard"><div class="fname">Cohen\u2019s d (one-sample vs norm)</div><div class="fformula">d = (M\u0305 \u2212 \u03bc\u2080) / s</div><div class="finterp">|d| < 0.20 negligible \u00b7 0.20\u20130.49 small \u00b7 0.50\u20130.79 medium \u00b7 \u2265 0.80 large</div></div>',
    '<div class="fcard"><div class="fname">Cohen\u2019s d (two-sample)</div><div class="fformula">d = (M\u2081 \u2212 M\u2082) / \u221a[(s\u2081\u00b2 + s\u2082\u00b2) / 2]</div></div>',
    '<div class="fcard"><div class="fname">95% CI for d</div><div class="fformula">d \u00b1 1.96 / \u221aN</div></div>',
    '<h2>PE Composite (MAP &amp; PEACS)</h2>',
    '<div class="fcard"><div class="fname">Predictive Emergence</div><div class="fformula">PE = \u00b3\u221a(A \u00d7 E \u00d7 C_guarded)</div><div class="fformula">C_guarded = 0.5 + 0.5 \u00d7 C_raw</div><div class="fwhere">A = Architecture \u2502 E = Execution \u2502 C_raw = Context (0\u20131)</div></div>',
    '<div class="fcard"><div class="fname">INA vs UNA</div><div class="fformula">INA: Architecture < Execution \u2003 UNA: Execution < Architecture</div></div>',
    '<h2>Pearson r (Cross-Instrument)</h2>',
    '<div class="fcard"><div class="fname">Pearson Correlation</div><div class="fformula">r = \u03a3[(x\u1d62 \u2212 x\u0305)(y\u1d62 \u2212 \u0233)] / [(N\u22121) \u00d7 s\u2093 \u00d7 s\u1d67]</div><div class="finterp">\u2265 0.70 strong \u00b7 0.40\u20130.69 moderate \u00b7 0.20\u20130.39 weak \u00b7 < 0.20 negligible</div></div>',
    '<h2>Reference Norms</h2>',
    '<table><tr><th>Instrument</th><th>Metric</th><th>\u03bc</th><th>\u03c3</th><th>Source</th></tr>',
    '<tr><td>MMAS-8</td><td>Total score</td><td>6.52</td><td>1.85</td><td>Morisky et al., 2008 (N=272)</td></tr>',
    '<tr><td>MAP</td><td>PE composite</td><td>0.72</td><td>0.16</td><td>ATLAS cross-cohort</td></tr>',
    '<tr><td>PEACS</td><td>PE composite</td><td>0.68</td><td>0.18</td><td>ATLAS cross-cohort</td></tr></table>',
    '<h2>Clinical Thresholds</h2>',
    '<table><tr><th>Instrument</th><th>Threshold</th><th>Classification</th></tr>',
    '<tr><td>MMAS-8</td><td>score \u2265 8</td><td>High adherence</td></tr>',
    '<tr><td>MMAS-8</td><td>6 \u2264 score < 8</td><td>Medium adherence</td></tr>',
    '<tr><td>MMAS-8</td><td>score < 6</td><td>Low adherence</td></tr>',
    '<tr><td>MAP / PEACS</td><td>PE \u2265 0.85</td><td>High \u2014 stable</td></tr>',
    '<tr><td>MAP / PEACS</td><td>0.60 \u2264 PE < 0.85</td><td>Moderate</td></tr>',
    '<tr><td>MAP / PEACS</td><td>PE < 0.60</td><td>Low \u2014 high risk</td></tr></table>',
    '<div class="ref">Bonett (2002). <em>J. Ed. &amp; Behavioral Statistics</em>, 27(4), 335\u2013340.<br>Cohen (1988). <em>Statistical power analysis</em>, 2nd ed. LEA.<br>Landis &amp; Koch (1977). <em>Biometrics</em>, 33(1), 159\u2013174.<br>Morisky et al. (2008). <em>J. Clinical Hypertension</em>, 10(5), 348\u2013354.</div>'
  ].join('\n');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>ATLAS PI Psychometric Methods</title><style>' + css + '</style></head><body>' +
    '<button class="no-print" onclick="window.print()" style="float:right;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;padding:7px 16px;background:#3b82f6;color:#fff;border:none;border-radius:5px;cursor:pointer;margin-bottom:10px;">Print / Save as PDF</button>' +
    body + '</body></html>');
  w.document.close();
  w.focus();
}

function _piPsyMethods(body) {
  var M = 'var(--font-mono)';
  function _sec(t) {
    return '<div style="font-family:'+M+';font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--base);margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(78,156,245,0.25);">'+t+'</div>';
  }
  function _fc(name, formula, where, interp) {
    return '<div style="background:var(--card2);border-left:3px solid rgba(78,156,245,0.55);border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:8px;">' +
      '<div style="font-family:'+M+';font-size:0.66rem;font-weight:700;color:var(--text);margin-bottom:4px;">'+name+'</div>' +
      '<div style="font-family:'+M+';font-size:0.80rem;color:var(--text);margin:3px 0 5px;letter-spacing:0.02em;">'+formula+'</div>' +
      (where  ? '<div style="font-family:'+M+';font-size:0.58rem;color:var(--dim);margin-top:3px;">'+where+'</div>' : '') +
      (interp ? '<div style="font-family:'+M+';font-size:0.58rem;color:var(--muted);font-style:italic;margin-top:5px;padding-top:5px;border-top:1px solid var(--border);">'+interp+'</div>' : '') +
    '</div>';
  }
  function _tbl(headers, rows) {
    var ths = headers.map(function(h){ return '<th style="font-family:'+M+';font-size:0.58rem;font-weight:600;padding:5px 10px;background:var(--card2);border:1px solid var(--border2);text-align:left;">'+h+'</th>'; }).join('');
    var trs = rows.map(function(r){
      return '<tr>'+r.map(function(c){ return '<td style="font-family:'+M+';font-size:0.60rem;padding:5px 10px;border:1px solid var(--border2);">'+c+'</td>'; }).join('')+'</tr>';
    }).join('');
    return '<table style="border-collapse:collapse;width:100%;margin:10px 0 14px;"><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table>';
  }

  body.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">' +
      '<div>' +
        '<div style="font-family:'+M+';font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Reference</div>' +
        '<div style="font-family:'+M+';font-size:0.88rem;font-weight:700;color:var(--text);">Psychometric Methods</div>' +
        '<div style="font-family:'+M+';font-size:0.60rem;color:var(--dim);margin-top:3px;">All formulas underlying Reliability, Classification, Effect Size, and Cross-Instrument analyses</div>' +
      '</div>' +
      '<button onclick="_piPsyPrintMethods()" style="font-family:'+M+';font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:7px 14px;background:rgba(78,156,245,0.10);border:1px solid rgba(78,156,245,0.40);color:var(--base);border-radius:5px;cursor:pointer;white-space:nowrap;flex-shrink:0;">&#8659; Download PDF</button>' +
    '</div>' +

    _sec('Reliability') +
    _fc('Cronbach\u2019s \u03b1',
        '\u03b1 = k/(k\u22121) \u00d7 (1 \u2212 \u03a3\u03c3\u1d62\u00b2 / \u03c3\u209c\u00b2)',
        'k\u2009=\u2009items \u2502 \u03c3\u1d62\u00b2\u2009=\u2009item variance \u2502 \u03c3\u209c\u00b2\u2009=\u2009total score variance',
        '\u2265\u20090.90 excellent \u00b7 0.80\u20130.89 good \u00b7 0.70\u20130.79 acceptable \u00b7 <\u20090.70 poor') +
    _fc('95% CI for \u03b1 (Bonett, 2002)',
        'SE(\u03b1) \u2248 \u221a[ 2k(1\u2212\u03b1)\u00b2 / ((k\u22121)(N\u22121)) ] \u2003 CI: \u03b1 \u00b1 1.96 \u00d7 SE(\u03b1)',
        'N\u2009=\u2009sample size',
        'Bonett (2002). Journal of Educational and Behavioral Statistics, 27(4), 335\u2013340') +
    _fc('Spearman-Brown Split-Half',
        '\u03c1_SB = 2r / (1 + r)',
        'r\u2009=\u2009Pearson r between odd/even item halves') +
    _fc('McDonald\u2019s \u03c9 (composite reliability estimate)',
        '\u03c9 \u2248 (\u03a3\u03bb\u1d62)\u00b2 / [(\u03a3\u03bb\u1d62)\u00b2 + \u03a3\u03b5\u1d62\u1d62]',
        '\u03bb\u1d62\u2009=\u2009factor loading \u2502 \u03b5\u1d62\u1d62\u2009=\u2009unique variance') +

    _sec('Classification') +
    '<div style="background:var(--card2);border-left:3px solid rgba(78,156,245,0.55);border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:8px;">' +
      '<div style="font-family:'+M+';font-size:0.66rem;font-weight:700;color:var(--text);margin-bottom:8px;">Confusion Matrix Cells</div>' +
      _tbl(['','Actual Positive','Actual Negative'],
        [['Predicted Positive','TP \u2014 True Positive','FP \u2014 False Positive'],
         ['Predicted Negative','FN \u2014 False Negative','TN \u2014 True Negative']]) +
      '<div style="font-family:'+M+';font-size:0.58rem;color:var(--dim);">Predicted Positive\u2009=\u2009\u2265 published norm mean \u2502 Actual Positive\u2009=\u2009\u2265 clinical threshold</div>' +
    '</div>' +
    _fc('Sensitivity',  'TP / (TP + FN)', undefined, 'Of all true positives, fraction correctly identified') +
    _fc('Specificity',  'TN / (TN + FP)', undefined, 'Of all true negatives, fraction correctly identified') +
    _fc('PPV (Precision)', 'TP / (TP + FP)', undefined, 'Of all predicted positives, fraction truly positive') +
    _fc('NPV',          'TN / (TN + FN)', undefined, 'Of all predicted negatives, fraction truly negative') +
    _fc('F\u2081 Score', '2 \u00d7 PPV \u00d7 Sensitivity / (PPV + Sensitivity)', undefined, 'Harmonic mean of PPV and Sensitivity') +
    _fc('Cohen\u2019s \u03ba',
        '\u03ba = (p_obs \u2212 p_exp) / (1 \u2212 p_exp)',
        'p_obs\u2009=\u2009(TP+TN)/N \u2502 p_exp\u2009=\u2009[(TP+FP)/N \u00d7 (TP+FN)/N] + [(FN+TN)/N \u00d7 (FP+TN)/N]',
        '\u2265\u20090.80 almost perfect \u00b7 0.60\u20130.79 substantial \u00b7 0.40\u20130.59 moderate \u00b7 <\u20090.40 poor') +

    _sec('Effect Size') +
    _fc('Cohen\u2019s d (one-sample vs norm)',
        'd = (M\u0305 \u2212 \u03bc\u2080) / s',
        'M\u0305\u2009=\u2009sample mean \u2502 \u03bc\u2080\u2009=\u2009norm mean \u2502 s\u2009=\u2009sample SD',
        '|d| < 0.20 negligible \u00b7 0.20\u20130.49 small \u00b7 0.50\u20130.79 medium \u00b7 \u2265\u20090.80 large') +
    _fc('Cohen\u2019s d (two-sample)',
        'd = (M\u2081 \u2212 M\u2082) / \u221a[(s\u2081\u00b2 + s\u2082\u00b2) / 2]') +
    _fc('95% CI for d',
        'CI: d \u00b1 1.96 / \u221aN',
        'N\u2009=\u2009sample size (approximation)') +

    _sec('PE Composite (MAP &amp; PEACS)') +
    _fc('Predictive Emergence',
        'PE = \u00b3\u221a(A \u00d7 E \u00d7 C_guarded)',
        'A\u2009=\u2009Architecture \u2502 E\u2009=\u2009Execution \u2502 C_raw\u2009=\u2009Context (0\u20131)',
        'Non-compensatory: no domain substitutes for another') +
    _fc('Context Guard',
        'C_guarded = 0.5 + 0.5 \u00d7 C_raw',
        'Prevents C = 0 from collapsing PE to zero') +
    _fc('INA vs UNA',
        'INA: Architecture < Execution \u2003 UNA: Execution < Architecture',
        'Applied to non-high-adherence cases only') +

    _sec('Pearson r (Cross-Instrument)') +
    _fc('Pearson Correlation',
        'r = \u03a3[(x\u1d62 \u2212 x\u0305)(y\u1d62 \u2212 \u0233)] / [(N\u22121) \u00d7 s\u2093 \u00d7 s\u1d67]',
        'Matched pairs by patient_number',
        '\u2265\u20090.70 strong \u00b7 0.40\u20130.69 moderate \u00b7 0.20\u20130.39 weak \u00b7 <\u20090.20 negligible') +

    _sec('Reference Norms &amp; Clinical Thresholds') +
    _tbl(['Instrument','Metric','\u03bc','\u03c3','Source'],
      [['MMAS-8','Total score','6.52','1.85','Morisky et al., 2008 \u2502 N\u2009=\u2009272'],
       ['MAP','PE composite','0.72','0.16','ATLAS cross-cohort'],
       ['PEACS','PE composite','0.68','0.18','ATLAS cross-cohort']]) +
    _tbl(['Instrument','Threshold','Classification'],
      [['MMAS-8','score \u2265 8','High adherence'],
       ['MMAS-8','6 \u2264 score < 8','Medium adherence'],
       ['MMAS-8','score < 6','Low adherence'],
       ['MAP / PEACS','PE \u2265 0.85','High \u2014 stable'],
       ['MAP / PEACS','0.60 \u2264 PE < 0.85','Moderate'],
       ['MAP / PEACS','PE < 0.60','Low \u2014 high risk']]) +

    '<div style="font-family:'+M+';font-size:0.56rem;color:var(--dim);margin-top:20px;padding-top:12px;border-top:1px solid var(--border2);line-height:1.7;">' +
      'Bonett, D.G. (2002). <em>J. Educational and Behavioral Statistics</em>, 27(4), 335\u2013340.<br>' +
      'Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). LEA.<br>' +
      'Landis, J.R., &amp; Koch, G.G. (1977). <em>Biometrics</em>, 33(1), 159\u2013174.<br>' +
      'Morisky, D.E. et al. (2008). <em>Journal of Clinical Hypertension</em>, 10(5), 348\u2013354.' +
    '</div>';
}

// End PI Psychometrics Module

