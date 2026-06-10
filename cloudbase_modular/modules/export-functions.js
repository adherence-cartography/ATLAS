/**
 * Exports the ICC patient coverage table as a CSV file.
 * Falls back to scraping the DOM table if `window._iccPatientData` is not populated.
 * Triggers a browser download named `atlas_coverage_<date>.csv`.
 * @returns {void}
 */
function iccExportCSV() {
  const rows = window._iccPatientData || [];
  const domRows = rows.length ? rows : (window._iccPatientDataFromDOM ? window._iccPatientDataFromDOM() : []);
  if (!domRows.length) { showToast('No patient data loaded yet.', 3000); return; }
  const cols = ['patient_id','workspace','mmas_score','mmas_count','peacs_score','peacs_count','coverage','last_activity','condition','gender','age_range','country','city'];
  const esc = v => { const s=String(v==null?'':v); return (s.includes(',')||s.includes('"')||s.includes('\n'))?'"'+s.replace(/"/g,'""')+'"':s; };
  const csv = [cols.map(k => getVarLabel(k)).join(','), ...domRows.map(p=>[
    p.patientId||'', p.workspace||'',
    p.mmasScore!=null?p.mmasScore:'', p.mmasCount||0,
    p.peacsScore!=null?p.peacsScore:'', p.peacsCount||0,
    p.coverage||'',
    p.lastActivity ? new Date(p.lastActivity).toISOString() : '',
    p.condition||'', p.gender||'', p.ageRange||'', p.country||'', p.city||''
  ].map(esc).join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`atlas_coverage_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  showToast(`Exported ${domRows.length} patients.`,3000);
}
/**
 * Scrapes patient rows from the ICC patient table DOM element (`#icc-patient-tbody`).
 * Used as a fallback when `window._iccPatientData` is not populated in memory.
 * @returns {{ patientId: string, workspace: string, mmasScore: number|null, peacsScore: number|null, coverage: string }[]}
 */
window._iccPatientDataFromDOM = function() {
  const out=[];
  document.querySelectorAll('#icc-patient-tbody tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(!cells.length||cells.length<5)return;
    const pid=cells[0]?.textContent?.trim()||'';
    if(pid&&pid!=='Loading patients…')
      out.push({patientId:pid,workspace:cells[1]?.textContent?.trim()||'',
        mmasScore:parseFloat(cells[2]?.textContent)||null,
        peacsScore:parseFloat(cells[3]?.textContent)||null,
        coverage:cells[4]?.textContent?.trim()||''});
  });
  return out;
};

// ── MMAS-8 Variable Label Map — used for CSV headers and codebook ─────────────
// Keys match Firebase field names. Values are human-readable labels.
const MMAS_VAR_LABELS = {
  // MMAS-8 Items (Morisky 8-Item Medication Adherence Scale)
  q1:  'MMAS_Q1_ForgetMedication',
  q2:  'MMAS_Q2_CarelessAboutTaking',
  q3:  'MMAS_Q3_StoppedFeelWorse',
  q4:  'MMAS_Q4_StoppedFeelBetter',
  q5:  'MMAS_Q5_TroubleTakingYesterday',
  q6:  'MMAS_Q6_StopWhenControlled',
  q7:  'MMAS_Q7_EverFeelHassled',
  q8:  'MMAS_Q8_DifficultyRemembering',
  // Computed scores
  mmas_score:    'MMAS8_TotalScore_0to8',
  adherence_tier:'AdherenceTier_High_Med_Low',
  // Participant identifiers
  patient_number:'ParticipantID',
  workspace_key: 'WorkspaceKey',
  study_id:      'StudyID',
  // Clinical / SDOH fields
  condition:     'MedicalCondition',
  medication:    'MedicationName',
  age:           'Age',
  gender:        'Gender',
  education:     'EducationLevel',
  insurance:     'InsuranceStatus',
  employment:    'EmploymentStatus',
  income:        'HouseholdIncome',
  housing:       'HousingStability',
  transport:     'TransportationAccess',
  support:       'SocialSupport',
  // Geographic
  country:       'Country',
  country_iso2:  'CountryISO2',
  region:        'Region',
  city:          'City',
  latitude:      'Latitude',
  longitude:     'Longitude',
  // Timestamps
  ts:            'SubmissionTimestamp_Unix',
  submitted_at:  'SubmissionDateTime_ISO8601',
  // Study metadata
  site_id:       'SiteID',
  site_name:     'SiteName',
  parent_institution: 'ParentInstitutionKey',
  language:      'AssessmentLanguage',
  collection_method: 'CollectionMethod',
  // ICC/patient summary fields
  patient_id:    'ParticipantID',
  workspace:     'WorkspaceKey',
  mmas_count:    'MMAS8_AssessmentCount',
  peacs_score:   'PEACS_TotalScore',
  peacs_count:   'PEACS_AssessmentCount',
  coverage:      'CoverageStatus',
  last_activity: 'LastActivityTimestamp_ISO8601',
  age_range:     'AgeRange',
};

/**
 * Returns the human-readable CSV header label for a Firebase field key.
 * Falls back to the raw key if no mapping exists in `MMAS_VAR_LABELS`.
 * @param {string} key - Firebase field name (e.g. `'mmas_score'`, `'country'`)
 * @returns {string} Human-readable label (e.g. `'MMAS8_TotalScore_0to8'`)
 */
function getVarLabel(key) {
  return MMAS_VAR_LABELS[key] || key;
}

/**
 * Generates and downloads the ATLAS MMAS-8 codebook as a CSV file.
 * Includes variable names, labels, types, value encodings, and IRB notes.
 * Triggers a browser download named `ATLAS_MMAS8_Codebook.csv`.
 * @returns {void}
 */
function downloadAtlasCodebook() {
  const rows = [
    ['VariableName', 'Label', 'Type', 'Values', 'Notes'],
    ['MMAS_Q1_ForgetMedication',   'Q1: Do you sometimes forget to take your medicine?',            'Binary',  '0=Never/Rarely, 1=Sometimes/Usually/Always', 'MMAS-8 Item 1'],
    ['MMAS_Q2_CarelessAboutTaking','Q2: Are you careless about taking medicine?',                   'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 2'],
    ['MMAS_Q3_StoppedFeelWorse',   'Q3: When you felt worse, did you stop taking medicine?',        'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 3'],
    ['MMAS_Q4_StoppedFeelBetter',  'Q4: When you felt better, did you stop taking medicine?',       'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 4'],
    ['MMAS_Q5_TroubleTakingYesterday','Q5: Trouble taking medicine yesterday?',                     'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 5'],
    ['MMAS_Q6_StopWhenControlled', 'Q6: Stop taking medicine when symptoms controlled?',            'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 6'],
    ['MMAS_Q7_EverFeelHassled',    'Q7: Ever feel hassled about sticking to your treatment plan?', 'Binary',  '0=No, 1=Yes', 'MMAS-8 Item 7'],
    ['MMAS_Q8_DifficultyRemembering','Q8: Difficulty remembering all medications?',                 'Ordinal', '0=Never, 1=Once in a while, 2=Sometimes, 3=Usually, 4=All the time', 'MMAS-8 Item 8'],
    ['MMAS8_TotalScore_0to8',      'Total MMAS-8 Score',                                           'Continuous','0–8 (higher = better adherence)', 'Sum of items 1-8; Q8 scored 0-4 then normalized'],
    ['AdherenceTier_High_Med_Low', 'Adherence Classification',                                      'Categorical','High=8, Medium=6-7, Low=<6', 'Based on Morisky et al. scoring'],
    ['ParticipantID',              'De-identified participant identifier',                           'String',  'Alphanumeric', 'Assigned by researcher'],
    ['SubmissionTimestamp_Unix',   'Submission time (Unix epoch, milliseconds)',                     'Integer', 'Unix ms', 'UTC'],
    ['SubmissionDateTime_ISO8601', 'Submission time (ISO 8601)',                                     'String',  'YYYY-MM-DDTHH:MM:SSZ', 'UTC'],
    ['Country',                    'Country of assessment',                                          'String',  'Full country name', ''],
    ['CountryISO2',                'Country ISO 3166-1 alpha-2 code',                               'String',  '2-letter code', ''],
    ['AssessmentLanguage',         'Language used for assessment',                                   'String',  'BCP47 language code', ''],
    ['CollectionMethod',           'How assessment was administered',                                'Categorical','direct, qr_scan, bulk_upload, remote', ''],
  ];

  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ATLAS_MMAS8_Codebook.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── C3: Clinical Export Headers ───────────────────────────────────────────
const _CLINICAL_HEADER_MAP = {
  patient_number: 'Patient ID',
  submission_date: 'Assessment Date',
  total_score: 'MMAS-8 Total Score',
  score: 'MMAS-8 Score',
  adherence_level: 'Adherence Level',
  condition: 'Primary Condition',
  medications: 'Medications',
  med_count: 'Medication Count',
  q1: 'Q1: Forgets medication',
  q2: 'Q2: Missed doses (2 weeks)',
  q3: 'Q3: Stopped without telling doctor',
  q4: 'Q4: Forgot when traveling',
  q5: 'Q5: Took all medication yesterday',
  q6: 'Q6: Stopped when felt controlled',
  q7: 'Q7: Hassled by regimen',
  q8: 'Q8: Difficulty remembering',
  MMAS_Q1_ForgetMedication: 'Q1: Forgets medication',
  MMAS_Q2_MissedDoses: 'Q2: Missed doses (2 weeks)',
  MMAS_Q3_StoppedWithoutTelling: 'Q3: Stopped without telling doctor',
  MMAS_Q4_ForgotTraveling: 'Q4: Forgot when traveling',
  MMAS_Q5_TookYesterday: 'Q5: Took all medication yesterday',
  MMAS_Q6_StoppedControlled: 'Q6: Stopped when felt controlled',
  MMAS_Q7_HassledRegimen: 'Q7: Hassled by regimen',
  MMAS_Q8_DifficultyRemembering: 'Q8: Difficulty remembering',
  age: 'Age',
  gender: 'Gender',
  education: 'Education Level',
  language: 'Language',
  country: 'Country',
  workspace: 'Workspace',
  irb_protocol: 'IRB Protocol',
  baseline_score: 'PEACS Baseline Score',
  movement_score: 'PEACS Movement Score',
  strata_score: 'PEACS Strata Score',
  pe_score: 'PEACS PE Composite',
  last_intervention_type: 'Last Intervention Type',
  last_intervention_date: 'Last Intervention Date'
};

function exportClinicalCSV(data, filename) {
  if (!data || !data.length) return;
  filename = filename || ('atlas_clinical_' + new Date().toISOString().slice(0,10) + '.csv');
  const headers = Object.keys(data[0]);
  const clinicalHeaders = headers.map(h => _CLINICAL_HEADER_MAP[h] || h.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()));
  const escape = v => { const s = String(v ?? '').replace(/"/g,'""'); return /[,"\n]/.test(s) ? `"${s}"` : s; };
  const rows = [clinicalHeaders.join(','), ...data.map(r => headers.map(h => escape(r[h])).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
window.exportClinicalCSV = exportClinicalCSV;

// ══════════════════════════════════════════════════════════════════════════
// ATLAS COMMAND CENTER — SUPERADMIN
// ══════════════════════════════════════════════════════════════════════════
/** @type {string} */ let _accCurrentSection = 'overview';
/** @type {string} */ let _accCampColor = '#d4a843';

/**
 * Opens the ATLAS Command Center overlay (superadmin only).
 * Verifies a live Firebase ID token claim — cached role is not trusted.
 * Removes the open button from the DOM if the user is not a superadmin.
 * @returns {void}
 */
function openCommandCenter() {
  // Hard gate — verify live Firebase token claim, not just cached profile
  const user = firebase.auth().currentUser;
  if (!user) { showToast('Not authenticated.', 2500); return; }
  user.getIdTokenResult(false).then(result => {
    if (result.claims?.role !== 'superadmin') {
      showToast('ATLAS Control requires superadmin access.', 3000);
      const btn = document.getElementById('acc-open-btn');
      if (btn) btn.remove();
      const div = document.getElementById('acc-open-divider');
      if (div) div.remove();
      return;
    }
    atlasAuditLog('admin_access', { screen: 'MISSION_CONTROL' });
    _saOpenMissionControl({ role: 'superadmin', institutionCode: null });
  }).catch(() => {
    showToast('Could not verify access. Please try again.', 2500);
  });
}
/**
 * Opens Mission Control for PI-level users scoped to their institution.
 * Uses workspaceProfile role (authoritative) rather than raw token claims,
 * since PI users carry 'researcher' as their token claim role.
 */
function openInstitutionControl() {
  // workspaceProfile is the authoritative role source — token claim 'researcher'
  // is used for Firebase rules but does NOT equal the logical role 'pi'.
  const piOk        = typeof isPIMode === 'function' && isPIMode();
  const adminOk     = typeof isSuperAdmin === 'function' && isSuperAdmin();
  if (!piOk && !adminOk) {
    showToast('Institution Control requires PI access or higher.', 3000);
    return;
  }

  // For PI: institution code is the PI's own workspace key
  const institutionCode = adminOk ? null : (currentWorkspace || null);
  if (!institutionCode && piOk) {
    showToast('No institution code found on your account. Contact your administrator.', 3500);
    return;
  }

  const logRole = adminOk ? 'superadmin' : 'pi';
  atlasAuditLog('pi_access', { screen: 'INSTITUTION_CONTROL', institutionCode });
  if (typeof _saOpenMissionControl === 'function') {
    _saOpenMissionControl({ role: logRole, institutionCode });
  }
}

/**
 * Closes the ATLAS Command Center overlay and restores body scroll.
 * @returns {void}
 */
function closeCommandCenter() {
  const cc = document.getElementById('atlas-command-center');
  if (cc) cc.style.display = 'none';
  document.body.style.overflow = '';
}

/**
 * Navigates to a named section within the ATLAS Command Center.
 * Activates the corresponding nav item and section panel, then lazy-loads section data.
 * @param {string} section - Section identifier (e.g. `'overview'`, `'workspaces'`, `'campaigns'`, `'data'`, `'analytics'`)
 * @returns {void}
 */
function accNav(section) {
  _accCurrentSection = section;
  document.querySelectorAll('.acc-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.acc-section').forEach(el => el.classList.remove('active'));
  const nav = document.getElementById('accnav-'+section);
  const sec = document.getElementById('accsec-'+section);
  if (nav) nav.classList.add('active');
  if (sec) sec.classList.add('active');
  // Lazy-load section data
  if (section==='overview')  accLoadOverview();
  if (section==='workspaces') { accLoadKeys(); accLoadWorkspaces(); }
  if (section==='campaigns') accLoadCampaigns();
  if (section==='wall')      accLoadWallSection();
  if (section==='api')       accLoadApiKeys();
  if (section==='data')      accLoadDataSection();
  if (section==='analytics') accLoadAnalytics();
  if (section==='gai')       accLoadGAI();
  if (section==='keys')      { accLoadKeys(); accLoadWorkspaces(); }
  if (section==='letters')   accLoadLetters();
  if (section==='help')      accLoadHelp();
  if (section==='system')    accLoadSystem();
}

// ══════════════════════════════════════════════════════════════════════════════
// ACC KEY MANAGEMENT — Issue, revoke, list workspace keys via Lambda
// All routes require a valid superadmin Firebase token in Authorization header.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieves a valid Firebase ID token for the currently authenticated superadmin.
 * Throws if the user is not authenticated or does not hold the superadmin role claim.
 * @returns {Promise<string>} Raw Firebase ID token string
 * @throws {Error} If not authenticated or token claim is not `'superadmin'`
 */
async function _accGetToken() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const result = await user.getIdTokenResult(false);
  if (result.claims?.role !== 'superadmin') throw new Error('Superadmin token required');
  return await user.getIdToken(false);
}

/**
 * Responds to role selection changes in the key-management form.
 * Shows a superadmin warning and requires a custom key when `'superadmin'` is selected.
 * @param {string} role - The selected role value from the `#km-role` dropdown
 * @returns {void}
 */
function accRoleChanged(role) {
  const warning   = document.getElementById('km-superadmin-warning');
  const customKey = document.getElementById('km-custom-key');
  const isSA      = role === 'superadmin';
  if (warning)   warning.style.display   = isSA ? '' : 'none';
  if (customKey) customKey.placeholder   = isSA
    ? 'Required for superadmin — e.g. SA-ADHERENCE-2026'
    : 'e.g. INST-SIMAT-2026 — leave blank to auto-generate';
}

/**
 * Issues a new workspace key via the ATLAS Lambda backend.
 * Reads form inputs from the key-management panel, validates required fields,
 * then calls either `/admin/create-key` (custom key) or `/issue-key` (auto-generate).
 * Superadmin keys require an explicit custom key and a browser `confirm()` dialog.
 * On success, displays the issued key and refreshes the key list.
 * @returns {Promise<void>}
 */
async function accIssueKey() {
  const name              = document.getElementById('km-name')?.value.trim();
  const email             = document.getElementById('km-email')?.value.trim();
  const institution       = document.getElementById('km-institution')?.value.trim();
  const _roleRaw          = document.getElementById('km-role')?.value;
  const _instTypeMap      = { institution_academic:'academic', institution_health:'health', institution_amc:'amc' };
  const role              = _instTypeMap[_roleRaw] ? 'institution' : _roleRaw;
  const inst_type         = _instTypeMap[_roleRaw] || null;
  const study             = document.getElementById('km-study')?.value.trim();
  const parentInstitution = document.getElementById('km-parent-institution')?.value.trim().toUpperCase() || null;
  const parentPi          = document.getElementById('km-parent-pi')?.value.trim().toUpperCase() || null;
  const customKey         = document.getElementById('km-custom-key')?.value.trim().toUpperCase();
  const status      = document.getElementById('km-status');
  const result      = document.getElementById('km-result');
  const resultKey   = document.getElementById('km-result-key');
  const resultDetail= document.getElementById('km-result-detail');

  const emailRequired = role !== 'institution';
  if (!name || (emailRequired && !email) || !institution || !role) {
    const msg = role === 'institution'
      ? 'Name, institution and role are required. Email is optional for institution keys (add later via Edit when dept head is assigned).'
      : 'Name, email, institution and role are required.';
    if (status) { status.style.color='var(--poor)'; status.textContent=msg; }
    return;
  }

  // Superadmin keys must use a custom key and require explicit confirmation
  if (role === 'superadmin') {
    if (!customKey) {
      if (status) { status.style.color='var(--poor)'; status.textContent='A custom key is required for superadmin — auto-generation is disabled.'; }
      document.getElementById('km-custom-key')?.focus();
      return;
    }
    if (!confirm(`Issue superadmin key "${customKey}"?\n\nThis grants full unrestricted platform access to ${name}. MFA will be enabled automatically.\n\nProceed?`)) return;
  }
  if (status) { status.style.color='var(--muted)'; status.textContent='Issuing…'; }
  if (result) result.style.display = 'none';

  // Read selected PEACS dimensions (default all 3 if somehow unchecked all)
  const peacsDims = ['base','mvmt','strata'].filter(d => document.getElementById('km-dim-'+d)?.checked);
  const safePeacsDims = peacsDims.length > 0 ? peacsDims : ['base','mvmt','strata'];

  try {
    // If custom key specified, write directly to SSM via Lambda admin route.
    // Otherwise use the existing /issue-key route which auto-generates the key.
    const token = await _accGetToken();

    let data;
    if (customKey) {
      // Admin-only direct SSM write route
      const res = await fetch(LAMBDA_URL + '/admin/create-key', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ key: customKey, name, email, institution, role,
          ...(inst_type ? { institution_type: inst_type } : {}),
          study_title: study || null, active: true,
          mfa_enabled: (role === 'superadmin'),
          parent_institution: parentInstitution || null,
          parent_pi:          parentPi          || null,
          peacs_dims:         safePeacsDims })
      });
      data = await res.json();
    } else {
      // Standard issue-key route (auto-generates key, sends welcome email)
      const res = await fetch(LAMBDA_URL + '/issue-key', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, institution, role,
          ...(inst_type ? { institution_type: inst_type } : {}),
          study_title: study || null,
          parent_institution: parentInstitution || null,
          parent_pi:          parentPi          || null,
          peacs_dims:         safePeacsDims })
      });
      data = await res.json();
    }

    if (data.key) {
      if (status) { status.style.color='var(--strata)'; status.textContent='Key issued successfully.'; }
      if (resultKey) resultKey.textContent = data.key;
      if (resultDetail) resultDetail.innerHTML =
        `Role: ${data.tier || role} · Institution: ${data.institution || institution}<br/>` +
        (parentInstitution ? `Parent Institution: <span style="color:var(--pe);">${parentInstitution}</span><br/>` : '') +
        `Email sent: ${data.email_sent ? 'Yes' : 'No'}<br/>` +
        (data.atlas_url ? `ATLAS URL: <span style="color:var(--base);">${data.atlas_url}</span>` : '');
      if (result) result.style.display = 'block';
      // Clear form
      ['km-name','km-email','km-institution','km-study','km-custom-key','km-parent-institution','km-parent-pi'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      // Refresh the keys list
      setTimeout(accLoadKeys, 800);
    } else {
      if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + (data.error || 'Unknown error'); }
    }
  } catch(e) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + e.message; }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ATLAS CITATION GENERATOR
// Generates workspace-aware, instrument-aware citations in APA, AMA,
// Vancouver, and Methods Section Template formats.
// ══════════════════════════════════════════════════════════════════════════

/**
 * Generates formatted citations for ATLAS and its instruments based on the
 * active workspace and detected data (MMAS-8, MAP, PEACS).
 * Opens a modal with copy buttons for APA, AMA, Vancouver, and a Methods
 * Section Template.
 * @returns {void}
 */
function generateATLASCitation() {
  const ws = window.currentWorkspace || 'WORKSPACE';
  const today = new Date();
  const accessDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = today.getFullYear();
  const version = document.querySelector('meta[name="atlas-build"]')?.content || 'v8';

  // Determine what instruments were used
  const usedMMAS = true; // always
  const usedMAP = !!(window.dashMapData?.length || window._mapRecords?.length);
  const usedPEACS = !!(window.dashPeacsData?.length || window._peacsRecords?.length);

  const instruments = ['MMAS-8'];
  if (usedMAP) instruments.push('MAP');
  if (usedPEACS) instruments.push('PEACS');

  const instrumentStr = instruments.join(', ');

  const citations = {
    apa: `Morisky, D. E. (${year}). ATLAS Adherence Cartography Platform (${version}) [Software]. Adherence Inc. Accessed ${accessDate}. https://atlas.adherence.cc\n\nMorisky, D. E., Ang, A., Krousel-Wood, M., & Ward, H. J. (2008). Predictive validity of a medication adherence measure in an outpatient setting. Journal of Clinical Hypertension, 10(5), 348–354. https://doi.org/10.1111/j.1751-7176.2008.07572.x`,

    ama: `Morisky DE. ATLAS Adherence Cartography Platform (${version}) [Software]. Adherence Inc; ${year}. Accessed ${accessDate}. https://atlas.adherence.cc\n\nMorisky DE, Ang A, Krousel-Wood M, Ward HJ. Predictive validity of a medication adherence measure in an outpatient setting. J Clin Hypertens. 2008;10(5):348–354. doi:10.1111/j.1751-7176.2008.07572.x`,

    vancouver: `Morisky DE. ATLAS Adherence Cartography Platform (${version}) [Software]. Adherence Inc.; ${year} [cited ${accessDate}]. Available from: https://atlas.adherence.cc\n\nMorisky DE, Ang A, Krousel-Wood M, Ward HJ. Predictive validity of a medication adherence measure in an outpatient setting. J Clin Hypertens. 2008;10(5):348-354.`,

    methods: `Data collection and adherence assessment were conducted using the ATLAS Adherence Cartography Platform (${version}; Adherence Inc., https://atlas.adherence.cc), employing the ${instrumentStr} instrument${instruments.length > 1 ? 's' : ''}. Workspace code: ${ws}. Data collection period: [INSERT DATES]. All assessments were conducted in accordance with the validated scoring protocols established by Morisky et al. (2008).`
  };

  _showCitationModal(citations);
}

/**
 * Renders and appends the citation modal to the document body.
 * Removes any existing instance before creating a fresh one.
 * @param {{ apa: string, ama: string, vancouver: string, methods: string }} citations
 * @returns {void}
 */
function _showCitationModal(citations) {
  // Remove existing modal if present
  const existing = document.getElementById('atlas-citation-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'atlas-citation-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  modal.innerHTML = `
    <div style="background:var(--surface,#0f0f1a);border:1px solid var(--border,#2a2a3e);border-radius:12px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;">
      <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:1rem;">Cite ATLAS</div>
          <div style="font-size:0.75rem;color:var(--muted);">Copy the citation format required by your journal</div>
        </div>
        <button onclick="document.getElementById('atlas-citation-modal').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.25rem;">&#x2715;</button>
      </div>
      <div style="padding:1.25rem 1.5rem;">
        ${_citationBlock('APA', citations.apa)}
        ${_citationBlock('AMA', citations.ama)}
        ${_citationBlock('Vancouver', citations.vancouver)}
        ${_citationBlock('Methods Section Template', citations.methods)}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/**
 * Renders a single labelled citation block with a copy button.
 * @param {string} label - Display label (e.g. 'APA', 'Vancouver')
 * @param {string} text  - Citation text to display and copy
 * @returns {string} HTML string for the citation block
 */
function _citationBlock(label, text) {
  const id = 'cit-' + label.toLowerCase().replace(/\s+/g, '-');
  return `
    <div style="margin-bottom:1.25rem;">
      <div style="font-size:0.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">${label}</div>
      <div style="background:var(--surface2,#1a1a2e);border:1px solid var(--border);border-radius:6px;padding:0.75rem;font-size:0.8rem;line-height:1.6;color:var(--text);white-space:pre-wrap;" id="${id}">${text}</div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('${id}').textContent).then(()=>{ this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',1500); })" style="margin-top:0.4rem;padding:0.25rem 0.75rem;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:0.72rem;cursor:pointer;">Copy</button>
    </div>`;
}

window.generateATLASCitation = generateATLASCitation;

