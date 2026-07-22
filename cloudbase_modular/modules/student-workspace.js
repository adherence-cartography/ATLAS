// ══════════════════════════════════════════════════════════════════════════════
// PROVISIONING MODAL — expanded clinician role types
// ══════════════════════════════════════════════════════════════════════════════

// Call this after the institution provisioning modal is rendered to add
// expanded clinician role options if they're not already present.
/**
 * Appends expanded clinician role radio buttons (NP, PA, RN, MD, Care Coordinator) to the
 * institution provisioning modal role selector. Idempotent — skips if already expanded.
 * @returns {void}
 */
function _expandProvisioningRoleOptions() {
  var typeRow = document.getElementById('inst-prov-type-row');
  if (!typeRow || document.getElementById('inst-prov-type-np')) return; // already expanded

  var roleContainer = typeRow.querySelector('div[style*="flex"]');
  if (!roleContainer) return;

  var newRoles = [
    { value: 'np',               label: 'NP',          title: 'Nurse Practitioner' },
    { value: 'pa',               label: 'PA',          title: 'Physician Assistant' },
    { value: 'rn',               label: 'RN',          title: 'Registered Nurse' },
    { value: 'md',               label: 'MD/DO',       title: 'Physician' },
    { value: 'care_coordinator', label: 'Care Coord.', title: 'Care Coordinator' },
  ];

  newRoles.forEach(function(r) {
    var lbl = document.createElement('label');
    lbl.id = 'inst-prov-type-' + r.value;
    lbl.title = r.title;
    lbl.style.cssText = 'flex:1;min-width:80px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);transition:all 0.15s;';
    lbl.onclick = function() { _instSelectMemberType(r.value); };
    lbl.innerHTML = '<input type="radio" name="inst-prov-type" value="' + r.value + '" style="display:none;"/> ' + r.label;
    roleContainer.appendChild(lbl);
  });
}
function renderConsentScreen(lang)   { setAppLanguage(lang); }
function renderMMASScreen(lang)      { setAppLanguage(lang); }

// ══════════════════════════════════════════════════════════════════════════
// PUBLICATION LICENSE FLOW
// Upload gate → form fill → Stripe payment → letter issuance
// ══════════════════════════════════════════════════════════════════════════

// Stripe Payment Links — replace with live Stripe Payment Link URLs
// Append ?prefilled_email=EMAIL to pre-fill customer email
const PUB_LIC_STRIPE_LINKS = {
  49:  'https://buy.stripe.com/6oU00l3T8eoz4tK4h19MY02',
  89:  'https://buy.stripe.com/6oU7sN75k80b5xOdRB9MY03',
  149: 'https://buy.stripe.com/cNi9AV3T8bcnd0g3cX9MY04',
  249: 'https://buy.stripe.com/4gM3cx3T8bcn7FWbJt9MY05',
};

function _pubLicPrice(n) {
  if (n <= 50)  return { price: 49,  label: '10–50 participants' };
  if (n <= 200) return { price: 89,  label: '51–200 participants' };
  if (n <= 500) return { price: 149, label: '201–500 participants' };
  return         { price: 249, label: '500+ participants' };
}

// Called after successful bulk upload (n ≥ 10) or from student Publish tab
/**
 * Opens the Publication License flow modal, pre-populating participant count and
 * pricing information based on the most recent bulk upload stats.
 * @param {{n?: number, dateRange?: string, countries?: string}|null} [stats] - Upload stats; defaults to window._lastBulkUpload
 * @returns {void}
 */
function openPubLicenseFlow(stats) {
  const modal = document.getElementById('pub-lic-modal');
  if (!modal) return;

  // Store stats on window for use by later steps
  window._pubLicStats = stats || window._lastBulkUpload || { n: null, dateRange: null, countries: null };
  const n = window._pubLicStats.n;

  // Update step 1 display
  const nEl = document.getElementById('pub-lic-n');
  if (nEl) nEl.textContent = n ? n.toLocaleString() : '—';

  // Toggle confirm vs upload section depending on whether data has been uploaded
  const confirmEl = document.getElementById('pub-lic-s1-confirm');
  const uploadEl  = document.getElementById('pub-lic-s1-upload');
  const contBtn   = document.getElementById('pub-lic-s1-continue');
  if (confirmEl) confirmEl.style.display = n ? '' : 'none';
  if (uploadEl)  uploadEl.style.display  = n ? 'none' : '';
  if (contBtn) {
    contBtn.disabled      = !n;
    contBtn.style.opacity = n ? '1' : '0.4';
    contBtn.style.cursor  = n ? 'pointer' : 'not-allowed';
  }

  // Reset to step 1
  pubLicStep(1);
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePubLicModal() {
  const modal = document.getElementById('pub-lic-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function pubLicStep(n) {
  [1,2,3,4].forEach(function(s) {
    const el = document.getElementById('pub-lic-step-' + s);
    if (el) el.style.display = s === n ? '' : 'none';
  });
  // Scroll to top of modal box
  const box = document.querySelector('#pub-lic-modal > div');
  if (box) box.scrollTop = 0;
}

function submitPubLicForm() {
  const get = id => (document.getElementById(id) || {}).value || '';
  const pi      = get('pub-lic-pi').trim();
  const inst    = get('pub-lic-inst').trim();
  const title   = get('pub-lic-title').trim();
  const pop     = get('pub-lic-pop').trim();
  const email   = get('pub-lic-email').trim();
  const errEl   = document.getElementById('pub-lic-form-err');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };
  if (errEl) errEl.style.display = 'none';

  if (!pi)    return showErr('Principal Investigator name is required.');
  if (!inst)  return showErr('Institution name is required.');
  if (!title) return showErr('Study title is required.');
  if (!pop)   return showErr('Patient population description is required.');
  if (!email || !email.includes('@')) return showErr('A valid email address is required.');

  // Populate review step
  const stats = window._pubLicStats || {};
  const n     = stats.n || 0;
  const tier  = _pubLicPrice(n);

  document.getElementById('pub-lic-rev-pi').textContent        = pi;
  document.getElementById('pub-lic-rev-inst').textContent      = inst;
  document.getElementById('pub-lic-rev-title').textContent     = title;
  document.getElementById('pub-lic-rev-pop').textContent       = pop;
  document.getElementById('pub-lic-rev-n').textContent         = n ? n.toLocaleString() + ' participants' : 'From your upload';
  document.getElementById('pub-lic-rev-dates').textContent     = stats.dateRange || 'Confirmed from upload';
  document.getElementById('pub-lic-rev-countries').textContent = stats.countries || 'Confirmed from upload';
  document.getElementById('pub-lic-tier-label').textContent    = tier.label;
  document.getElementById('pub-lic-price-display').textContent = '$' + tier.price;

  // Reset payment state
  const verRow = document.getElementById('pub-lic-verify-row');
  const payBtn = document.getElementById('pub-lic-pay-btn');
  const payErr = document.getElementById('pub-lic-pay-err');
  if (verRow) verRow.style.display = 'none';
  if (payBtn) { payBtn.style.display = 'block'; payBtn.disabled = false; payBtn.textContent = 'Pay with Stripe →'; }
  if (payErr) payErr.style.display = 'none';

  pubLicStep(3);
}

function initiatePubLicCheckout() {
  const stats  = window._pubLicStats || {};
  const n      = stats.n || 0;
  const tier   = _pubLicPrice(n);
  const email  = (document.getElementById('pub-lic-email') || {}).value || '';
  const payBtn = document.getElementById('pub-lic-pay-btn');
  const verRow = document.getElementById('pub-lic-verify-row');

  if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Opening Stripe…'; }

  const baseUrl = PUB_LIC_STRIPE_LINKS[tier.price] || PUB_LIC_STRIPE_LINKS[49];
  const stripeUrl = baseUrl + '?prefilled_email=' + encodeURIComponent(email);

  // Save form state to sessionStorage so it survives page navigation
  try {
    sessionStorage.setItem('_pubLicPending', JSON.stringify({
      pi:       (document.getElementById('pub-lic-pi')      || {}).value || '',
      inst:     (document.getElementById('pub-lic-inst')    || {}).value || '',
      title:    (document.getElementById('pub-lic-title')   || {}).value || '',
      pop:      (document.getElementById('pub-lic-pop')     || {}).value || '',
      irb:      (document.getElementById('pub-lic-irb')     || {}).value || '',
      journal:  (document.getElementById('pub-lic-journal') || {}).value || '',
      email:    email,
      n:        n,
      price:    tier.price,
      dateRange:  stats.dateRange  || '',
      countries:  stats.countries  || '',
    }));
  } catch(e) {}

  // Open Stripe in new tab
  window.open(stripeUrl, '_blank', 'noopener');

  // Reveal the "I've completed payment" button
  setTimeout(function() {
    if (payBtn) { payBtn.style.display = 'none'; }
    if (verRow) verRow.style.display = 'block';
  }, 1200);
}

async function verifyPubLicPayment() {
  const verBtn = document.querySelector('#pub-lic-verify-row button');
  const errEl  = document.getElementById('pub-lic-pay-err');
  if (verBtn) { verBtn.disabled = true; verBtn.textContent = 'Issuing license…'; }
  if (errEl)  errEl.style.display = 'none';

  try {
    let pending = {};
    try { pending = JSON.parse(sessionStorage.getItem('_pubLicPending') || '{}'); } catch(e) {}

    // Retrieve session_id written by Stripe success tab via localStorage
    const stripeSessionId = window._pubLicSessionId
      || (function() { try { return localStorage.getItem('_plcSession') || ''; } catch(e) { return ''; } })();

    if (!stripeSessionId) {
      throw new Error('Payment session not found. Please complete payment in the Stripe tab, then return here and click the button again.');
    }

    const stats = window._pubLicStats || {};
    const payload = {
      stripe_session_id: stripeSessionId,
      pi:            pending.pi     || (document.getElementById('pub-lic-pi')      || {}).value || '',
      institution:   pending.inst   || (document.getElementById('pub-lic-inst')    || {}).value || '',
      study_title:   pending.title  || (document.getElementById('pub-lic-title')   || {}).value || '',
      population:    pending.pop    || (document.getElementById('pub-lic-pop')     || {}).value || '',
      irb:           pending.irb    || (document.getElementById('pub-lic-irb')     || {}).value || '',
      journal:       pending.journal|| (document.getElementById('pub-lic-journal') || {}).value || '',
      email:         pending.email  || (document.getElementById('pub-lic-email')   || {}).value || '',
      n_validated:   pending.n      || stats.n || 0,
      date_range:    pending.dateRange || stats.dateRange || '',
      countries:     pending.countries || stats.countries || '',
      expected_price: pending.price || 49,
    };

    const res  = await fetch(LAMBDA_URL + '/issue-pub-license', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.licKey) throw new Error(data.error || 'License issuance failed');

    // Store for letter generation
    window._pubLicResult = Object.assign({}, payload, {
      licKey:     data.licKey,
      issuedDate: data.issuedDate
        ? new Date(data.issuedDate).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})
        : new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}),
    });

    // Update success step
    document.getElementById('pub-lic-success-email').textContent = payload.email;
    document.getElementById('pub-lic-key-display').textContent   = data.licKey;

    // Clean up
    sessionStorage.removeItem('_pubLicPending');
    try { localStorage.removeItem('_plcSession'); } catch(e) {}
    window._pubLicSessionId = null;
    pubLicStep(4);

  } catch(e) {
    if (errEl) { errEl.textContent = (e.message || 'Verification failed. Please try again or contact info@adherence.cc'); errEl.style.display = 'block'; }
    if (verBtn) { verBtn.disabled = false; verBtn.textContent = '✓ I\'ve completed payment — Issue My License'; }
  }
}

function downloadPubLicense() {
  const d = window._pubLicResult;
  if (!d) { showToast('License data not available. Please re-open the portal.', 3000); return; }

  const cert = document.createElement('div');
  cert.id = 'print-pub-license';
  cert.innerHTML = `
    <div class="plc-page">
      <div class="plc-header">
        <div class="plc-brand-block">
          <div class="plc-wordmark">ATLAS</div>
          <div class="plc-brand-sub">Adherence Cartography · adherence.cc</div>
        </div>
        <div class="plc-doc-type">
          <div class="plc-doc-label">Publication License</div>
          <div class="plc-lic-num">${d.licKey || '—'}</div>
        </div>
      </div>

      <div class="plc-title">MMAS-8 Letter of Permission</div>
      <div class="plc-subtitle">Instrument Use Authorization for Academic Publication</div>

      <table class="plc-table">
        <tr><td>Principal Investigator</td><td>${d.pi || d.pi_name || ''}</td></tr>
        <tr><td>Institution</td><td>${d.institution}</td></tr>
        <tr><td>Study Title</td><td><em>${d.study_title}</em></td></tr>
        <tr><td>Patient Population</td><td>${d.population}</td></tr>
        ${d.irb_ref ? `<tr><td>Ethics Reference</td><td>${d.irb_ref}</td></tr>` : ''}
        ${d.journal  ? `<tr><td>Intended Publication</td><td>${d.journal}</td></tr>`  : ''}
        <tr><td>Date Issued</td><td>${d.issuedDate}</td></tr>
        <tr><td>License No.</td><td><strong>${d.licKey}</strong></td></tr>
      </table>

      <div class="plc-validated-box">
        <div class="plc-vb-title">Data Validated by ATLAS Platform</div>
        <div class="plc-vb-row">
          <div class="plc-vb-stat"><strong>${(d.n_validated||0).toLocaleString()}</strong>Participants</div>
          ${d.date_range  ? `<div class="plc-vb-stat"><strong>${d.date_range}</strong>Date Range</div>` : ''}
          ${d.countries   ? `<div class="plc-vb-stat"><strong>${d.countries}</strong>Countries</div>`  : ''}
          <div class="plc-vb-stat"><strong>✓</strong>Data Integrity</div>
        </div>
      </div>

      <div class="plc-statement">
        This letter confirms that <strong>${d.pi || d.pi_name || ''}</strong> of <strong>${d.institution}</strong>
        is hereby granted a non-exclusive, non-transferable license to use the Morisky Medication
        Adherence Scale (MMAS-8)® instrument, as administered and validated via the ATLAS adherence
        platform, in the publication of the research study titled <em>"${d.study_title}"</em>.
        The data described herein has been verified by the ATLAS platform: ${(d.n_validated||0).toLocaleString()}
        participant records${d.date_range ? ', collected ' + d.date_range : ''}${d.countries ? ', across ' + d.countries : ''}.
      </div>

      <div class="plc-scope-note">
        This license is permanent, non-exclusive, and non-transferable. It authorizes the use of
        MMAS-8 solely in the publication of the described study and does not extend to subsequent
        research, commercial use, or redistribution of the instrument. The MMAS-8 is a proprietary
        instrument. © Donald E. Morisky, ScD, ScM, MSPH. All rights reserved.
      </div>

      <div class="plc-sig-area">
        <div class="plc-sig-block">
          <div class="plc-sig-line"></div>
          <div class="plc-sig-label">ATLAS Platform · Authorized Signatory</div>
        </div>
        <div class="plc-sig-block">
          <div class="plc-sig-line"></div>
          <div class="plc-sig-label">Date</div>
        </div>
      </div>

      <div class="plc-footer">
        <div>
          This document was generated by the ATLAS platform (adherence.cc) and is intended as the official
          Letter of Permission for MMAS-8 use in the study described herein.<br/>
          License No. ${d.licKey} · Issued ${d.issuedDate}
        </div>
        <div class="plc-verify-badge">Verify at<br/>keys.adherence.cc</div>
      </div>
    </div>
  `;

  document.body.appendChild(cert);
  document.body.classList.add('printing-pub-lic');
  window.print();
  setTimeout(function() {
    document.body.classList.remove('printing-pub-lic');
    const el = document.getElementById('print-pub-license');
    if (el) el.remove();
  }, 1500);
}

// ── Student Publish tab helpers ────────────────────────────────────────────

function _pubLicDownloadTemplate() {
  // Trigger the standard ATLAS bulk upload template download
  if (typeof downloadBulkTemplate === 'function') {
    downloadBulkTemplate();
  } else {
    // Fallback — trigger the bulk upload button if it exists
    const bulkBtn = document.getElementById('dash-bulk-btn');
    if (bulkBtn) { showToast('Use the bulk upload template from the researcher dashboard.', 3000); }
    else { showToast('Download the ATLAS template from your institution dashboard.', 3000); }
  }
}

// Syncs the pub-license modal's MMAS-8 / MAP toggle buttons to reflect _dndImportTool.
// Called by the onclick handlers on those buttons (after setDndImportTool sets the variable).
// setDndImportTool() updates #dnd-tool-mmas / #dnd-tool-map (DnD area) — these pub-lic
// buttons have different IDs so we style them separately here.
function _pubLicSyncToolUI() {
  const active   = { background:'rgba(99,102,241,0.25)', borderColor:'rgba(99,102,241,0.6)', color:'var(--text)', fontWeight:'600' };
  const inactive = { background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.1)', color:'var(--dim)', fontWeight:'400' };
  const isMmap = (typeof _dndImportTool !== 'undefined' ? _dndImportTool : 'mmas') === 'map';
  const mmasBtn = document.getElementById('pub-lic-tool-mmas');
  const mapBtn  = document.getElementById('pub-lic-tool-map');
  if (mmasBtn) Object.assign(mmasBtn.style, isMmap ? inactive : active);
  if (mapBtn)  Object.assign(mapBtn.style,  isMmap ? active   : inactive);
}

function _pubLicHandleUpload(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('pub-lic-modal-upload-status');
  if (statusEl) statusEl.textContent = 'Processing ' + file.name + '…';

  // If a workspace is active, use the full dashboard upload processor (map plots under workspace)
  if (currentWorkspace && (typeof _showBulkAcknowledgement === 'function' || typeof processBulkUpload === 'function')) {
    if (typeof _showBulkAcknowledgement === 'function') {
      _showBulkAcknowledgement(file);
    } else {
      processBulkUpload(file);
    }
  } else {
    // Publication-only path — no subscription required.  Saves all data to assessments
    // under source:'pub_license' so records are fully indexed across the platform.
    guestPubLicUpload(file);
  }
}

// ── Publication-only upload ───────────────────────────────────────────────────
// Used by researchers who access the Publish tab without an active workspace
// subscription (e.g. thesis students seeking a letter of permission).
//
// Saves a complete record to assessments (all SDoH fields, individual Q1–Q8
// values, study metadata) AND a geo record to mapData, identical to what
// processBulkUpload writes for subscribed workspaces.  institution_code is null
// because there is no workspace — records appear in global platform analytics
// but not in any workspace-scoped view.
async function guestPubLicUpload(file) {
  const statusEl = document.getElementById('pub-lic-modal-upload-status');
  const setStatus = (msg, ok) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok === true ? 'rgba(46,201,138,0.9)' : ok === false ? 'rgba(239,100,80,0.9)' : 'var(--dim)';
  };

  try { await ensureSheetJS(); } catch(e) {
    setStatus('Could not load file parser. Check your connection and try again.', false);
    return;
  }

  setStatus('Reading file…');
  const buf = await file.arrayBuffer();
  let wb;
  try {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch(e) {
    setStatus('Could not read file. Make sure it is an XLSX, XLSM, or XLS file.', false);
    return;
  }

  // Identical sheet-detection logic to processBulkUpload
  const sheetName = wb.SheetNames.find(n =>
    n.includes('Data Entry') || n.includes('📊') || n.includes('data')
  ) || wb.SheetNames[1] || wb.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

  if (!rows.length) {
    setStatus('No data rows found. Please use the ATLAS download template.', false);
    return;
  }

  // Pull study metadata from header rows (B2–B7), same positions as processBulkUpload
  const studyMeta = {
    study_title:       String(rows[1]?.[1] || '').trim(),
    pi_name:           String(rows[2]?.[1] || '').trim(),
    study_institution: String(rows[3]?.[1] || '').trim(),
    irb_number:        String(rows[4]?.[1] || '').trim() || null,
    clinicaltrials_id: String(rows[5]?.[1] || '').trim() || null,
    study_phase:       String(rows[6]?.[1] || '').trim() || null,
  };

  // Locate the column-header row: first row whose col-0 starts with 'country'
  let headerRowIdx = 8;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (String(rows[i]?.[0] || '').trim().toLowerCase().startsWith('country')) {
      headerRowIdx = i; break;
    }
  }

  // Instrument is selected by the user via the MMAS-8 / MAP toggle buttons in the modal,
  // which call setDndImportTool() — the same function used by the subscription DnD upload.
  const tool = (typeof _dndImportTool !== 'undefined' ? _dndImportTool : null) || 'mmas';

  const _isExampleRow = row =>
    String(row[0] || '').toUpperCase().includes('EXAMPLE') ||
    String(row[2] || '').toUpperCase().includes('EXAMPLE');

  const dataRows = rows.slice(headerRowIdx + 1).filter(row =>
    row && row.length >= 10 && row[0] && !_isExampleRow(row)
  );

  if (!dataRows.length) {
    setStatus('No patient data rows found. Make sure rows begin after the header row and that you have not left the file on the example row only.', false);
    return;
  }

  // Q1–Q7: Yes/No binary (Q5 reversed — Yes=adherent)
  function _yn(v, reversed) {
    if (typeof v === 'number') return v;
    const s = String(v).trim().toUpperCase();
    return reversed ? (s === 'YES' ? 1 : 0) : (s === 'NO' ? 1 : 0);
  }

  let validated = 0, skipped = 0;
  const countries = new Set();
  const ts = Date.now(); // single timestamp for the whole batch

  setStatus('Validating ' + dataRows.length + ' rows (' + (tool === 'map' ? 'MAP' : 'MMAS-8') + ')…');

  // Phase 1 — parse and validate all rows, collect pending records (no writes yet)
  const _pendingRecords = [];

  for (const row of dataRows) {
    // Col layout: 0=Country 1=City 2=PatientNum 3=Condition 4=DrugType 5=DrugName
    // 6=DrugStrength 7=Route 8=Gender 9=AgeRange 10=Education 11–18=Q1–Q8
    const [country_raw, city_raw, patientNum, condition, drugType, drugName,
           drugStrength, route, gender, ageRange, education,
           _q1, _q2, _q3, _q4, _q5, _q6, _q7, _q8] = row;

    const qVals = [_q1, _q2, _q3, _q4, _q5, _q6, _q7];
    if (qVals.some(v => v === undefined || v === null || v === '') ||
        _q8 === undefined || _q8 === null || _q8 === '') { skipped++; continue; }

    const rawScore = parseFloat(dndComputeScore(_q1,_q2,_q3,_q4,_q5,_q6,_q7,_q8));
    const q1=_yn(_q1,false), q2=_yn(_q2,false), q3=_yn(_q3,false), q4=_yn(_q4,false),
          q5=_yn(_q5,true),  q6=_yn(_q6,false), q7=_yn(_q7,false);
    const q8 = rawScore - (q1+q2+q3+q4+q5+q6+q7);
    if (isNaN(rawScore) || rawScore < 0 || rawScore > 8) { skipped++; continue; }

    const country = typeof normalizeCountry === 'function'
      ? normalizeCountry(String(country_raw || '').trim())
      : String(country_raw || '').trim();
    const city = String(city_raw || '').trim();
    const cat  = typeof getAdherenceCategory === 'function'
      ? getAdherenceCategory(rawScore)
      : { label: rawScore >= 8 ? 'High Adherence' : rawScore >= 6 ? 'Medium Adherence' : 'Low Adherence' };

    if (country) countries.add(country);
    validated++;
    _pendingRecords.push({ country, city, cat, rawScore, q1,q2,q3,q4,q5,q6,q7,q8,
      patientNum, condition, drugType, drugName, drugStrength, route, gender, ageRange, education });
  }

  if (validated < 10) {
    setStatus('Only ' + validated + ' valid rows found — minimum is 10 participants.', false);
    return;
  }

  // Phase 2 — geocode unique city+country pairs (Nominatim with centroid fallback)
  setStatus('Geocoding locations… (this takes a moment)');
  const _PUB_CENTROIDS = {'Afghanistan':[33.93,67.71],'Algeria':[28.03,1.66],'Angola':[-11.20,17.87],'Argentina':[-38.42,-63.62],'Australia':[-25.27,133.78],'Austria':[47.52,14.55],'Azerbaijan':[40.14,47.58],'Bangladesh':[23.68,90.36],'Bolivia':[-16.29,-63.59],'Brazil':[-14.24,-51.93],'Cambodia':[12.57,104.99],'Cameroon':[7.37,12.35],'Canada':[56.13,-106.35],'Chile':[-35.68,-71.54],'China':[35.86,104.20],'Colombia':[4.57,-74.30],'Croatia':[45.10,15.20],'Cuba':[21.52,-77.78],'Czechia':[49.82,15.47],'Czech Republic':[49.82,15.47],'Denmark':[56.26,9.50],'Ecuador':[-1.83,-78.18],'Egypt':[26.82,30.80],'Ethiopia':[9.15,40.49],'Finland':[61.92,25.75],'France':[46.23,2.21],'Germany':[51.17,10.45],'Ghana':[7.95,-1.02],'Greece':[39.07,21.82],'Guatemala':[15.78,-90.23],'Honduras':[15.20,-86.24],'Hungary':[47.16,19.50],'India':[20.59,78.96],'Indonesia':[-0.79,113.92],'Iran':[32.43,53.69],'Iraq':[33.22,43.68],'Ireland':[53.41,-8.24],'Israel':[31.05,34.85],'Italy':[41.87,12.57],'Japan':[36.20,138.25],'Jordan':[30.59,36.24],'Kazakhstan':[48.02,66.92],'Kenya':[0.02,37.91],'Kuwait':[29.31,47.48],'Malaysia':[4.21,101.98],'Mexico':[23.63,-102.55],'Morocco':[31.79,-7.09],'Mozambique':[-18.67,35.53],'Myanmar':[16.87,96.08],'Nepal':[28.39,84.12],'Netherlands':[52.13,5.29],'New Zealand':[-40.90,174.89],'Nicaragua':[12.87,-85.21],'Nigeria':[9.08,8.68],'Norway':[60.47,8.47],'Oman':[21.51,55.92],'Pakistan':[30.38,69.35],'Panama':[8.54,-80.78],'Peru':[-9.19,-75.02],'Philippines':[12.88,121.77],'Poland':[51.92,19.15],'Portugal':[39.40,-8.22],'Qatar':[25.35,51.18],'Romania':[45.94,24.97],'Russia':[61.52,105.32],'Saudi Arabia':[23.89,45.08],'Senegal':[14.50,-14.45],'Serbia':[44.02,21.01],'Singapore':[1.35,103.82],'Somalia':[5.15,46.20],'South Africa':[-30.56,22.94],'South Korea':[35.91,127.77],'Spain':[40.46,-3.75],'Sri Lanka':[7.87,80.77],'Sweden':[60.13,18.64],'Switzerland':[46.82,8.23],'Tanzania':[-6.37,34.89],'Thailand':[15.87,100.99],'Tunisia':[33.89,9.54],'Turkey':[38.96,35.24],'Uganda':[1.37,32.29],'Ukraine':[48.38,31.17],'United Arab Emirates':[23.42,53.85],'United Kingdom':[55.38,-3.44],'United States':[37.09,-95.71],'Uruguay':[-32.52,-55.77],'Uzbekistan':[41.38,64.59],'Venezuela':[6.42,-66.59],'Vietnam':[14.06,108.28],'Yemen':[15.55,48.52],'Zambia':[-13.13,27.85],'Zimbabwe':[-19.02,29.15]};
  const _geoCache = {};

  // Collect unique city+country pairs and geocode each once
  const uniquePairs = [...new Set(_pendingRecords.map(r => r.country + '|' + r.city))];
  for (const pair of uniquePairs) {
    const sepIdx = pair.indexOf('|');
    const c = pair.slice(0, sepIdx), ci = pair.slice(sepIdx + 1);
    const cacheKey = pair.toLowerCase();
    if (_geoCache[cacheKey] !== undefined) continue;
    let lat = 0, lng = 0;
    try {
      const geoQ = ci && ci.toLowerCase() !== 'unknown'
        ? 'city=' + encodeURIComponent(ci) + '&country=' + encodeURIComponent(c)
        : 'q=' + encodeURIComponent(c) + '&featuretype=country';
      const geo = await fetch(
        'https://nominatim.openstreetmap.org/search?' + geoQ + '&format=json&limit=1',
        { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'ATLAS-AdherenceProject/2026' } }
      );
      const gd = await geo.json();
      if (gd.length > 0) { lat = parseFloat(gd[0].lat); lng = parseFloat(gd[0].lon); }
      await new Promise(r => setTimeout(r, 1100)); // Nominatim 1 req/sec
    } catch (_ge) { /* use centroid fallback */ }
    if (!lat && !lng) { const ctr = _PUB_CENTROIDS[c]; if (ctr) { lat=ctr[0]; lng=ctr[1]; } }
    _geoCache[cacheKey] = { lat: lat || null, lng: lng || null };
  }

  // Phase 3 — write all records with resolved coordinates
  setStatus('Saving ' + validated + ' records…');
  const writes = [];
  for (const rec of _pendingRecords) {
    if (typeof database === 'undefined') continue;
    const coords = _geoCache[(rec.country + '|' + rec.city).toLowerCase()] || { lat: null, lng: null };
    const submission = {
      user_id:          typeof getUserId === 'function' ? getUserId() : 'pub_license',
      timestamp:        ts,
      tool,
      score:            rec.rawScore,
      adherence_level:  rec.cat.label,
      country:          rec.country || 'Unknown',
      city:             rec.city,
      latitude:         coords.lat, longitude: coords.lng,
      patient_number:   String(rec.patientNum   || ''),
      condition:        String(rec.condition    || ''),
      drug_type:        String(rec.drugType     || ''),
      drug_name:        String(rec.drugName     || ''),
      drug_strength:    String(rec.drugStrength || ''),
      route_of_administration: String(rec.route || ''),
      gender:           String(rec.gender    || ''),
      age_range:        String(rec.ageRange   || ''),
      education_level:  String(rec.education  || ''),
      role:             'pub_license',
      data_tier:        'publication',
      q1:rec.q1, q2:rec.q2, q3:rec.q3, q4:rec.q4, q5:rec.q5, q6:rec.q6, q7:rec.q7, q8:rec.q8,
      institution_code: null,
      source:           'pub_license',
      upload_source:    'pub_license',
      ...studyMeta,
    };
    if (tool !== 'map' && typeof computeMMASPE === 'function') {
      const pe = computeMMASPE(submission);
      if (pe) { submission.mmas_pe=pe.pe; submission.mmas_a=pe.a; submission.mmas_e=pe.e; submission.mmas_c=pe.c; }
    }
    if (tool === 'map' && typeof computeMapPE === 'function') {
      const pe = computeMapPE(submission);
      if (pe) { submission.map_pe=pe.pe; submission.map_a=pe.a; submission.map_e=pe.e; submission.map_c=pe.c; }
    }
    writes.push(
      atlasDB('assessments').push(submission).then(() =>
        database.ref('mapData').push({
          score: rec.rawScore, adherence_level: rec.cat.label, tool,
          country: rec.country || 'Unknown', city: rec.city,
          latitude: coords.lat, longitude: coords.lng,
          timestamp: ts, institution_code: null, source: 'pub_license', ...studyMeta,
        })
      ).catch(() => {})
    );
  }

  try { await Promise.allSettled(writes); } catch(e) {}

  const countriesArr = Array.from(countries).filter(Boolean);
  window._pubLicStats = {
    n:          validated,
    dateRange:  new Date().toLocaleDateString('en-US', { year:'numeric', month:'short' }),
    countries:  countriesArr.length ? countriesArr.join(', ') : null,
  };
  window._lastBulkUpload = window._pubLicStats;

  const nEl = document.getElementById('pub-lic-n');
  if (nEl) nEl.textContent = validated.toLocaleString();
  if (statusEl) {
    statusEl.textContent = '✓ ' + validated.toLocaleString() + ' records saved' +
      (skipped ? ' · ' + skipped + ' skipped' : '') + '. Opening form…';
    statusEl.style.color = 'rgba(46,201,138,0.9)';
  }
  const confirmEl = document.getElementById('pub-lic-s1-confirm');
  const uploadEl  = document.getElementById('pub-lic-s1-upload');
  const contBtn   = document.getElementById('pub-lic-s1-continue');
  if (confirmEl) confirmEl.style.display = '';
  if (uploadEl)  uploadEl.style.display  = 'none';
  if (contBtn)  { contBtn.disabled = false; contBtn.style.opacity = '1'; contBtn.style.cursor = 'pointer'; }

  setTimeout(() => {
    const s1 = document.getElementById('pub-lic-step-1');
    if (s1 && s1.style.display !== 'none') pubLicStep(2);
  }, 1200);
}

// ── Translated result modal helper ────────────────────────────────────────
// Call this from showResultModal to get translated strings
function getResultStrings(score, intentional, unintentional) {
  var lang = window._atlasLang || mmasCurrentLang || 'en';
  var t = ATLAS_STRINGS[lang] || ATLAS_STRINGS.en;
  var high = score >= 8;
  var med  = score >= 6 && !high;
  var ina  = !high && !med && intentional >= unintentional;
  var una  = !high && !med && !ina;

  var message = high ? t.resultHigh : med ? t.resultMedium : ina ? t.resultINA : t.resultUNA;
  var tipsArr = med  ? t.resultTipsMedium : una ? t.resultTipsUNA : [];
  var tips = '';
  if (tipsArr && tipsArr.length) {
    tips = '<div class="result-tips"><div class="result-tips-title">' + t.resultTipsTitle + '</div>'
      + tipsArr.map(function(tip) { return '<div class="result-tip"><span class="result-tip-dot"></span><span>' + tip + '</span></div>'; }).join('')
      + '</div>';
  }
  var pat = high ? t.patternHigh : (intentional > unintentional ? t.patternINA : unintentional > intentional ? t.patternUNA : (score >= 8 ? t.patternHigh : t.patternMixed));
  return {
    message: message, tips: tips, pattern: pat,
    globalTag: t.resultGlobalTag,
    download: t.resultDownload,
    spectator: t.resultSpectator,
    done: t.resultDone || 'Done',
    levelHigh: t.levelHigh, levelMedium: t.levelMedium, levelLow: t.levelLow,
  };
}


// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// STRIPE RETURN HANDLER — capture ?plc_session= after Payment Link redirect
// When Stripe's success URL redirects to atlas.adherence.cc?plc_session=cs_xxx
// this code runs in the new tab, writes the session_id to localStorage, and
// the storage event fires in any other open ATLAS tab so verifyPubLicPayment()
// can pick it up without the user having to copy/paste anything.
// ══════════════════════════════════════════════════════════════════════════
(function() {
  const params     = new URLSearchParams(window.location.search);
  const plcSession = params.get('plc_session');
  const pubMode    = params.get('publish');

  // ── Stripe success return: capture session_id written by the payment tab ──
  if (plcSession) {
    try { localStorage.setItem('_plcSession', plcSession); } catch(e) {}
    window._pubLicSessionId = plcSession;
    try {
      const clean = window.location.pathname + window.location.hash;
      history.replaceState(null, '', clean);
    } catch(e) {}
  }

  // ── ?publish=1 : open pub license modal directly, no workspace key needed ──
  if (pubMode) {
    try {
      const clean = window.location.pathname + window.location.hash;
      history.replaceState(null, '', clean);
    } catch(e) {}
    // Wait for DOM + Firebase init, then open the modal
    window._openPubLicOnLoad = true;
  }

  // ── Cross-tab storage event: session_id arrives from the Stripe tab ────────
  window.addEventListener('storage', function(e) {
    if (e.key === '_plcSession' && e.newValue) {
      window._pubLicSessionId = e.newValue;
      const verRow = document.getElementById('pub-lic-verify-row');
      if (verRow && verRow.style.display !== 'none') {
        const verBtn = verRow.querySelector('button');
        if (verBtn && verBtn.disabled) {
          verBtn.disabled = false;
          verBtn.textContent = '✓ I\'ve completed payment — Issue My License';
        }
      }
    }
  });
})();

// INIT WIRING — Wire features that need DOMContentLoaded
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const pulseBar = document.querySelector('.dash-pulse-bar');
  if (pulseBar) {
    // Build number chip — visible to superadmin only
    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) {
      const buildChip = document.createElement('div');
      buildChip.style.cssText = 'display:flex;align-items:center;padding:0 14px;';
      buildChip.innerHTML = `<span id="atlas-build-chip" style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:1px 6px;" title="ATLAS Build">B1 · 2026.03.23</span>`;
      pulseBar.appendChild(buildChip);
    }
  }

  // Auto-init ambient globe on first load if entry screen is shown
  if (document.getElementById('screen-entry')?.classList.contains('active')) {
    setTimeout(initAmbientGlobe, 600);
  }

  // ?publish=1 — open the pub license modal directly without a workspace key
  if (window._openPubLicOnLoad) {
    window._openPubLicOnLoad = false;
    // Give Firebase a moment to init, then open the modal over the entry screen
    setTimeout(function() {
      openPubLicenseFlow({ n: null, dateRange: null, countries: null });
    }, 800);
  }

  // Apply glossary tooltips to help students understand technical terms
  setTimeout(() => {
    if (typeof applyGlossaryTooltips === 'function') {
      applyGlossaryTooltips(document.getElementById('screen-dashboard'));
    }
  }, 500);
});


// ══════════════════════════════════════════════════════════════════════════
// MODULE 9 — THESIS EXPORT
// Citation, Methods, and Results paragraphs for MAP · MMAS-8 · PEACS
// All text is auto-populated from live cohort data and copyable in one click.
// ══════════════════════════════════════════════════════════════════════════

// ── Citation database ──────────────────────────────────────────────────────

var _STU_CITATIONS = {
  map: {
    apa: [
      'Morisky, P., & Adherence Cartography. (2026). Multidimensional Adherence Parameters (MAP): Predictive emergence framework for medication adherence assessment [Measurement instrument]. ATLAS v8. https://atlas.adherence.cc',
      '',
      'Morisky, P. (2026). The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo. https://doi.org/10.5281/zenodo.18209699'
    ].join('\n'),
    vancouver: [
      'Morisky P, Adherence Cartography. Multidimensional Adherence Parameters (MAP) [Internet]. ATLAS v8. 2026 [cited ' + new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) + ']. Available from: https://atlas.adherence.cc',
      '',
      'Morisky P. The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo; 2026. doi:10.5281/zenodo.18209699'
    ].join('\n'),
    ama: [
      'Morisky P, Adherence Cartography. Multidimensional Adherence Parameters (MAP). ATLAS v8. 2026. Accessed ' + new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) + '. https://atlas.adherence.cc',
      '',
      'Morisky P. The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo; 2026. doi:10.5281/zenodo.18209699'
    ].join('\n'),
  },
  mmas: {
    apa: [
      'Morisky, D. E., Ang, A., Krousel-Wood, M., & Ward, H. J. (2008). Predictive validity of a medication adherence measure in outpatient settings. Journal of Clinical Hypertension, 10(5), 348\u2013354. https://doi.org/10.1111/j.1751-7176.2008.07572.x',
      '',
      'Krousel-Wood, M., Islam, T., Webber, L. S., Re, R. N., Morisky, D. E., & Muntner, P. (2009). New medication adherence scale versus pharmacy fill rates in seniors with hypertension. American Journal of Managed Care, 15(1), 59\u201366. PMID: 19146365'
    ].join('\n'),
    vancouver: [
      'Morisky DE, Ang A, Krousel-Wood M, Ward HJ. Predictive validity of a medication adherence measure in outpatient settings. J Clin Hypertens. 2008;10(5):348-54. doi:10.1111/j.1751-7176.2008.07572.x',
      '',
      'Krousel-Wood M, Islam T, Webber LS, Re RN, Morisky DE, Muntner P. New medication adherence scale versus pharmacy fill rates in seniors with hypertension. Am J Manag Care. 2009;15(1):59-66. PMID: 19146365'
    ].join('\n'),
    ama: [
      'Morisky DE, Ang A, Krousel-Wood M, Ward HJ. Predictive validity of a medication adherence measure in outpatient settings. J Clin Hypertens. 2008;10(5):348-354. doi:10.1111/j.1751-7176.2008.07572.x',
      '',
      'Krousel-Wood M, Islam T, Webber LS, Re RN, Morisky DE, Muntner P. New medication adherence scale versus pharmacy fill rates in seniors with hypertension. Am J Manag Care. 2009;15(1):59-66. PMID: 19146365'
    ].join('\n'),
  },
  peacs: {
    apa: [
      'Adherence Cartography. (2026). Predictive Emergence Assessment for Clinical Services (PEACS v2.0): Longitudinal behavioral phenotyping instrument. ATLAS v8. https://atlas.adherence.cc',
      '',
      'Morisky, P. (2026). The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo. https://doi.org/10.5281/zenodo.18209699'
    ].join('\n'),
    vancouver: [
      'Adherence Cartography. Predictive Emergence Assessment for Clinical Services (PEACS v2.0) [Internet]. ATLAS v8. 2026 [cited ' + new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) + ']. Available from: https://atlas.adherence.cc',
      '',
      'Morisky P. The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo; 2026. doi:10.5281/zenodo.18209699'
    ].join('\n'),
    ama: [
      'Adherence Cartography. Predictive Emergence Assessment for Clinical Services (PEACS v2.0). ATLAS v8. 2026. Accessed ' + new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) + '. https://atlas.adherence.cc',
      '',
      'Morisky P. The theory of predictive emergence: A geometric framework for behavioral stability. Zenodo; 2026. doi:10.5281/zenodo.18209699'
    ].join('\n'),
  },
};

// ── Methods paragraphs ─────────────────────────────────────────────────────

var _STU_METHODS = {
  map: 'The Multidimensional Adherence Parameter (MAP) instrument was administered via ATLAS v8 (Adherence Cartography, 2026; https://atlas.adherence.cc). MAP is an 8-item instrument measuring medication adherence across three behavioral domains: Architecture (intentional structural adherence; items 2, 3, 6), Execution (behavioral compliance; items 1, 5, 8), and Context-Guard (contextual barriers; items 4, 7; scored as 0.5 + 0.5 \u00d7 mean(Q4, Q7)). Domain scores (0\u20131) are combined into a Predictive Emergence (PE) composite using a geometric mean model grounded in the Theory of Predictive Emergence (Morisky, 2026). Higher PE scores indicate greater adherence stability. All sessions were self-administered via secure digital interface following electronic informed consent. Participants were assigned de-identified numeric identifiers prior to assessment.',

  mmas: 'Medication adherence was assessed using the 8-item Morisky Medication Adherence Scale (MMAS-8; Morisky et al., 2008; Krousel-Wood et al., 2009), administered via ATLAS v8 (Adherence Cartography, 2026). The MMAS-8 is a validated, self-report instrument with established categories of high adherence (score\u2009=\u20098), medium adherence (6\u2009\u2264\u2009score\u2009<\u20098), and low adherence (score\u2009<\u20096). Item-response patterns were further classified as intentional non-adherence (INA; deliberate dose modification) or unintentional non-adherence (UNA; forgetting or practical barriers) using the ATLAS classification algorithm. All sessions were self-administered following electronic informed consent. Participants were assigned de-identified numeric identifiers prior to assessment.',

  peacs: 'Longitudinal adherence phenotyping was conducted using the Predictive Emergence Assessment for Clinical Services (PEACS v2.0; Adherence Cartography, 2026), administered via ATLAS v8. PEACS uses a staged three-session protocol assessing behavioral dimensions of medication adherence: BASE (biological-structural determinants; Session 1), MVMT (movement-behavioral patterns; Session 2), and STRATA (social-contextual factors; Session 3). Sessions were spaced approximately six weeks apart per the PEACS longitudinal protocol. A full Predictive Emergence (PE) behavioral profile is constructed upon completion of all three sessions. The theoretical framework is the Theory of Predictive Emergence (Morisky, 2026; doi:10.5281/zenodo.18209699).',
};

// ── Active citation format state ───────────────────────────────────────────
window._stuCiteFmt = { map: 'apa', mmas: 'apa', peacs: 'apa' };

// ── Tab switching ──────────────────────────────────────────────────────────
function stuSwitchThesisTab(tab) {
  document.querySelectorAll('.stu-thesis-pane').forEach(function(p) { p.style.display = 'none'; });
  var pane = document.getElementById('stu-thesis-pane-' + tab);
  if (pane) pane.style.display = '';

  var _tabColor = function(t) {
    return t==='map'?'#059669': t==='mmas'?'#2563eb': t==='peacs'?'#7c3aed': '#0891b2';
  };
  document.querySelectorAll('.stu-thesis-tab').forEach(function(btn) {
    var isActive = btn.dataset.tab === tab;
    btn.style.borderBottomColor = isActive ? _tabColor(tab) : 'transparent';
    btn.style.color = isActive ? _tabColor(tab) : 'var(--dim)';
  });

  // Lazy-init on first open
  if (tab === 'combined') stuBuildCombined();
}

// ── Citation format selector ───────────────────────────────────────────────
function stuSelectCiteFmt(inst, fmt) {
  window._stuCiteFmt[inst] = fmt;

  // Update button active states
  document.querySelectorAll('.stu-cite-fmt-btn[data-inst="' + inst + '"]').forEach(function(btn) {
    var isActive = btn.dataset.fmt === fmt;
    var col = inst==='map'?'#0891b2':inst==='mmas'?'#2563eb':'#7c3aed';
    btn.style.background  = isActive ? col   : 'var(--card2)';
    btn.style.borderColor = isActive ? col   : 'var(--border2)';
    btn.style.color       = isActive ? '#fff' : 'var(--muted)';
  });

  // Update citation text
  var el = document.getElementById('stu-thesis-cite-' + inst);
  if (el && _STU_CITATIONS[inst]) el.textContent = _STU_CITATIONS[inst][fmt] || '';
}

// ── Copy any block ─────────────────────────────────────────────────────────
function stuCopyBlock(id, btn) {
  var el = document.getElementById(id);
  if (!el) return;
  var text = el.textContent || el.innerText || '';
  if (!text.trim()) return;
  try {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = '\u2713 Copied';
      btn.style.color = '#059669';
      setTimeout(function() { btn.textContent = orig; btn.style.color = ''; }, 1800);
    });
  } catch(e) {
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    var orig = btn.textContent;
    btn.textContent = '\u2713 Copied';
    setTimeout(function() { btn.textContent = orig; }, 1800);
  }
}

// ── Compute Bonett (2002) approximate 95% CI for Cronbach alpha ────────────
function _stuAlphaCI(alpha, n, k) {
  if (!isFinite(alpha) || n < 2 || k < 2) return { low: NaN, high: NaN };
  var se = Math.sqrt(2 * k * Math.pow(1 - alpha, 2) / ((n - 1) * (k - 1)));
  var low  = Math.max(0, alpha - 1.96 * se);
  var high = Math.min(1, alpha + 1.96 * se);
  return { low: low, high: high };
}

// ── Build MAP results paragraph from live data ─────────────────────────────
function _stuBuildMapResults(mapRows) {
  var n = mapRows.length;
  if (!n) return '(No MAP records yet. Collect at least 1 MAP assessment to generate this paragraph.)';

  // Means
  var sumA = 0, sumE = 0, sumC = 0;
  mapRows.forEach(function(r) {
    var a = parseFloat(r.arch_score) || ((parseFloat(r.q2||0)+parseFloat(r.q3||0)+parseFloat(r.q6||0))/3);
    var e = parseFloat(r.exec_score) || ((parseFloat(r.q1||0)+parseFloat(r.q5||0)+parseFloat(r.q8||0))/3);
    var c = parseFloat(r.ctx_score) || Math.max(0.5, 0.5 + 0.5 * ((parseFloat(r.q4||0) + parseFloat(r.q7||0)) / 2));
    sumA += a; sumE += e; sumC += c;
  });
  var avgA = sumA/n, avgE = sumE/n, avgC = sumC/n;
  var pe   = Math.pow(Math.max(0, avgA * avgE * avgC), 1/3);

  // SD for arch
  var sdA = 0, sdE = 0, sdC = 0;
  mapRows.forEach(function(r) {
    var a = parseFloat(r.arch_score) || ((parseFloat(r.q2||0)+parseFloat(r.q3||0)+parseFloat(r.q6||0))/3);
    var e = parseFloat(r.exec_score) || ((parseFloat(r.q1||0)+parseFloat(r.q5||0)+parseFloat(r.q8||0))/3);
    var c = parseFloat(r.ctx_score) || Math.max(0.5, 0.5 + 0.5 * ((parseFloat(r.q4||0) + parseFloat(r.q7||0)) / 2));
    sdA += Math.pow(a - avgA, 2); sdE += Math.pow(e - avgE, 2); sdC += Math.pow(c - avgC, 2);
  });
  var denom = n > 1 ? n - 1 : 1;
  sdA = Math.sqrt(sdA/denom); sdE = Math.sqrt(sdE/denom); sdC = Math.sqrt(sdC/denom);

  // Alpha (using map_q1-map_q8 items — MAP records store with map_q* keys)
  var _ALL = ['map_q1','map_q2','map_q3','map_q4','map_q5','map_q6','map_q7','map_q8'];
  var itemRecs = mapRows.filter(function(r) { return r.map_q1 !== undefined; });
  var alphaVal = NaN, ciLow = '', ciHigh = '';
  if (itemRecs.length >= 10) {
    var k = 8, m = itemRecs.length;
    var tMean = 0, tVals = itemRecs.map(function(r) { return _ALL.reduce(function(s,it){return s+(+(r[it]||0));},0); });
    tMean = tVals.reduce(function(a,b){return a+b;},0)/m;
    var tVar = tVals.reduce(function(s,t){return s+Math.pow(t-tMean,2);},0)/(m-1);
    var sumIV = _ALL.reduce(function(sv, it) {
      var sc = itemRecs.map(function(r){return +(r[it]||0);});
      var mn = sc.reduce(function(a,b){return a+b;},0)/m;
      return sv + sc.reduce(function(s,x){return s+Math.pow(x-mn,2);},0)/(m-1);
    }, 0);
    alphaVal = tVar > 0 ? (k/(k-1)) * (1 - sumIV/tVar) : NaN;
    var ci = _stuAlphaCI(alphaVal, m, k);
    ciLow  = isFinite(ci.low)  ? ci.low.toFixed(2)  : '—';
    ciHigh = isFinite(ci.high) ? ci.high.toFixed(2) : '—';
  }

  // PE interpretation
  var peInterp = pe >= 0.85 ? 'indicating optimal adherence stability'
               : pe >= 0.70 ? 'indicating good adherence stability'
               : pe >= 0.55 ? 'indicating moderate adherence stability — intervention may be warranted'
               : pe >= 0.40 ? 'indicating poor adherence stability — intervention is recommended'
               : 'indicating critical adherence instability — immediate intervention indicated';

  // Primary constraint
  var domains = [{name:'Architecture', val:avgA},{name:'Execution',val:avgE},{name:'Context',val:avgC}];
  domains.sort(function(a,b){return a.val-b.val;});
  var primary = domains[0];

  var fmt = function(v) { return isFinite(v) ? v.toFixed(3) : '\u2014'; };
  var fmt2 = function(v) { return isFinite(v) ? v.toFixed(2) : '\u2014'; };

  // Cohen's d vs provisional PE norm (illustrative ≈ 0.72, SD ≈ 0.16 — not yet validated cross-cohort)
  var peSD = 0;
  var peVals = mapRows.map(function(r) {
    var a = parseFloat(r.arch_score) || ((parseFloat(r.q2||0)+parseFloat(r.q3||0)+parseFloat(r.q6||0))/3);
    var e = parseFloat(r.exec_score) || ((parseFloat(r.q1||0)+parseFloat(r.q5||0)+parseFloat(r.q8||0))/3);
    var c = parseFloat(r.ctx_score) || Math.max(0.5, 0.5 + 0.5 * ((parseFloat(r.q4||0) + parseFloat(r.q7||0)) / 2));
    return Math.pow(Math.max(0, a*e*c), 1/3);
  });
  peSD = Math.sqrt(peVals.reduce(function(s,x){return s+Math.pow(x-pe,2);},0)/(peVals.length>1?peVals.length-1:1));
  var globalPE = 0.72; // provisional illustrative norm — not yet validated cross-cohort
  var cohensD_pe = peSD > 0 ? (pe - globalPE) / peSD : NaN;
  var _effLabel = function(d) { var a=Math.abs(d); return a>=0.80?'large':a>=0.50?'medium':a>=0.20?'small':'negligible'; };

  var lines = [
    'Across N\u2009=\u2009' + n + ' MAP assessments' + (itemRecs.length >= 10 ? ', internal consistency of the MAP 8-item scale was \u03b1\u2009=\u2009.' + (alphaVal*100).toFixed(0) + ' (95% CI [.' + (parseFloat(ciLow)*100).toFixed(0) + ', .' + (parseFloat(ciHigh)*100).toFixed(0) + ']).' : '.'),
    'The Architecture domain mean score was ' + fmt(avgA) + ' (SD\u2009=\u2009' + fmt2(sdA) + '), Execution domain ' + fmt(avgE) + ' (SD\u2009=\u2009' + fmt2(sdE) + '), and Context domain ' + fmt(avgC) + ' (SD\u2009=\u2009' + fmt2(sdC) + ').',
    'The cohort Predictive Emergence (PE) composite mean was ' + fmt(pe) + ', ' + peInterp + '.',
    'The primary behavioral constraint domain was ' + primary.name + ' (lowest domain mean\u2009=\u2009' + fmt(primary.val) + ').',
  ];
  if (n >= 5 && isFinite(cohensD_pe)) {
    var dDir = cohensD_pe > 0 ? 'above' : 'below';
    lines.push('Effect size vs provisional PE norm (\u03bc\u2009=\u2009' + globalPE.toFixed(2) + ', illustrative): d\u2009=\u2009' + cohensD_pe.toFixed(2) + ' (' + _effLabel(cohensD_pe) + ' effect, cohort is ' + dDir + ' provisional reference).');
  }
  return lines.join(' ');
}

// ── Build MMAS-8 results paragraph from live data ──────────────────────────
function _stuBuildMmasResults(allRows) {
  var rows = allRows.filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined; });
  var n = rows.length;
  if (!n) return '(No MMAS-8 records yet. Collect at least 1 MMAS-8 assessment to generate this paragraph.)';

  var scores = rows.map(function(r) { return parseFloat(r.score) || 0; });
  var mean   = scores.reduce(function(a,b){return a+b;},0) / n;
  var sd     = Math.sqrt(scores.reduce(function(s,x){return s+Math.pow(x-mean,2);},0) / (n>1?n-1:1));

  var nHigh = rows.filter(function(r){return parseFloat(r.score)>=8;}).length;
  var nMed  = rows.filter(function(r){var s=parseFloat(r.score);return s>=6&&s<8;}).length;
  var nLow  = rows.filter(function(r){return parseFloat(r.score)<6;}).length;
  var nINA = 0, nUNA = 0, nMixed = 0;
  rows.forEach(function(r) {
    var s = parseFloat(r.score)||0;
    if (s >= 8) return;
    if (r.q1 === undefined) { nUNA++; return; }
    try {
      if (typeof classifyPattern === 'function') {
        var cp = classifyPattern(r);
        if (cp.intentional > cp.unintentional) nINA++;
        else if (cp.unintentional > cp.intentional) nUNA++;
        else nMixed++;
      }
    } catch(e) { nUNA++; }
  });

  var pct = function(x) { return n ? Math.round(x/n*100) : 0; };
  var fmt2 = function(v) { return v.toFixed(2); };

  // Cohen's d vs published MMAS-8 normative data (Morisky et al. outpatient meta-analysis: μ=6.52, σ=1.85)
  var normMean = 6.52, normSD = 1.85;
  var pooledSD = Math.sqrt((sd*sd + normSD*normSD) / 2);
  var cohensD = pooledSD > 0 ? (mean - normMean) / pooledSD : NaN;
  var _effLabel = function(d) { var a=Math.abs(d); return a>=0.80?'large':a>=0.50?'medium':a>=0.20?'small':'negligible'; };

  var parts = [
    'Across N\u2009=\u2009' + n + ' MMAS-8 assessments (mean score\u2009=\u2009' + fmt2(mean) + ', SD\u2009=\u2009' + fmt2(sd) + '),',
    pct(nHigh) + '% (n\u2009=\u2009' + nHigh + ') demonstrated high adherence (score\u2009=\u20098),',
    pct(nMed) + '% (n\u2009=\u2009' + nMed + ') medium adherence (6\u2009\u2264\u2009score\u2009<\u20098),',
    'and ' + pct(nLow) + '% (n\u2009=\u2009' + nLow + ') low adherence (score\u2009<\u20096).',
    'Intentional non-adherence (INA) patterns were identified in ' + pct(nINA) + '% (n\u2009=\u2009' + nINA + ') of participants,',
    'unintentional non-adherence (UNA) in ' + pct(nUNA) + '% (n\u2009=\u2009' + nUNA + '),',
    'and mixed patterns in ' + pct(nMixed) + '% (n\u2009=\u2009' + nMixed + ').',
  ];
  if (n >= 5 && isFinite(cohensD)) {
    var dDir = cohensD > 0 ? 'above' : 'below';
    parts.push('Effect size relative to published MMAS-8 outpatient norms (\u03bc\u2009=\u2009' + normMean + ', SD\u2009=\u2009' + normSD + '): d\u2009=\u2009' + cohensD.toFixed(2) + ' (' + _effLabel(cohensD) + ' effect; cohort is ' + dDir + ' the normative mean).');
  }
  return parts.join(' ');
}

// ── Build PEACS results paragraph ─────────────────────────────────────────
function _stuBuildPeacsResults() {
  var peacsRecs = (window._rppPeacsData || []);
  if (!peacsRecs.length) return '(No PEACS records yet. Collect at least 1 PEACS session to generate this paragraph.)';

  var byPid = {};
  peacsRecs.forEach(function(r) {
    var pid = (r.patient_number || '').toString().trim().toUpperCase() || 'UNASSIGNED';
    if (!byPid[pid]) byPid[pid] = { base: false, mvmt: false, strata: false, pe: null };
    var dim = (r.dimension || r.peacs_dimension || '').toUpperCase();
    if (dim === 'BASE'   || r.base_score   !== undefined) byPid[pid].base   = true;
    if (dim === 'MVMT'   || r.mvmt_score   !== undefined) byPid[pid].mvmt   = true;
    if (dim === 'STRATA' || r.strata_score !== undefined) byPid[pid].strata = true;
    if (r.pe !== undefined && r.pe !== null) byPid[pid].pe = parseFloat(r.pe);
  });

  var patients = Object.values(byPid);
  var total    = patients.length;
  var nBase    = patients.filter(function(p){return p.base;}).length;
  var nMvmt    = patients.filter(function(p){return p.mvmt;}).length;
  var nStrata  = patients.filter(function(p){return p.strata;}).length;
  var complete = patients.filter(function(p){return p.base && p.mvmt && p.strata;}).length;
  var pct      = function(x) { return total ? Math.round(x/total*100) : 0; };

  var peVals   = patients.filter(function(p){return p.base&&p.mvmt&&p.strata&&p.pe!==null;}).map(function(p){return p.pe;});
  var peMean   = peVals.length ? peVals.reduce(function(a,b){return a+b;},0)/peVals.length : null;
  var peNote   = peMean !== null
    ? 'The cohort mean PE score for participants with complete profiles was ' + peMean.toFixed(3) + '.'
    : 'Full PE profiles are not yet available for all three dimensions.';

  return [
    'PEACS longitudinal data were collected from N\u2009=\u2009' + total + ' participants.',
    'BASE dimension completion: ' + nBase + '/' + total + ' (' + pct(nBase) + '%);',
    'MVMT completion: ' + nMvmt + '/' + total + ' (' + pct(nMvmt) + '%);',
    'STRATA completion: ' + nStrata + '/' + total + ' (' + pct(nStrata) + '%).',
    complete + ' participant' + (complete!==1?'s':'') + ' (' + pct(complete) + '%) completed all three dimensions with a full Predictive Emergence profile available.',
    peNote,
  ].join(' ');
}

// ── Build Combined methods + IRB ───────────────────────────────────────────
function stuBuildCombined() {
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var hasMap   = allRows.some(function(r){return r.tool==='map'||r.map_q1!==undefined||r.q1!==undefined;});
  var hasMmas  = allRows.some(function(r){return r.tool!=='map'&&r.map_q1===undefined&&r.q1===undefined;});
  var hasPeacs = (window._rppPeacsData||[]).length > 0;

  var parts = [];
  if (hasMap)   parts.push(_STU_METHODS.map);
  if (hasMmas)  parts.push(_STU_METHODS.mmas);
  if (hasPeacs) parts.push(_STU_METHODS.peacs);

  var combined = parts.length
    ? 'A multi-instrument adherence assessment protocol was administered via ATLAS v8 (Adherence Cartography, 2026; https://atlas.adherence.cc).\n\n' + parts.join('\n\n')
    : '(No cohort data yet. Collect at least one assessment to generate the combined methods paragraph.)';

  var mEl = document.getElementById('stu-thesis-methods-combined');
  if (mEl) mEl.textContent = combined;

  // Combined results
  var resultParts = [];
  if (hasMap || hasMmas || hasPeacs) {
    resultParts.push(_stuBuildMapResults(allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; })));
    resultParts.push(_stuBuildMmasResults(allRows));
    resultParts.push(_stuBuildPeacsResults());
  }
  var rEl = document.getElementById('stu-thesis-results-combined');
  if (rEl) rEl.textContent = resultParts.filter(function(s){return !s.startsWith('(');}).join('\n\n') || '(No data yet.)';

  // IRB statement
  var instruments = [];
  if (hasMap)   instruments.push('MAP');
  if (hasMmas)  instruments.push('MMAS-8');
  if (hasPeacs) instruments.push('PEACS v2.0');
  var instStr = instruments.join(', ') || '[instrument]';
  var irb = [
    'This study used a cross-sectional ' + (hasPeacs ? 'and longitudinal ' : '') + 'design to collect medication adherence data using the ' + instStr + ' instrument' + (instruments.length>1?'s':'') + ' administered via ATLAS v8.',
    'All assessments were self-administered via secure digital interface. Electronic informed consent was obtained from all participants prior to participation.',
    'Participant data were de-identified using numeric codes; no personal health identifiers were collected.',
    'Geolocation data, where collected, were aggregated to the country or regional level.',
    'Data were stored on Firebase Realtime Database infrastructure with role-based access controls limiting data visibility to the administering workspace.',
    'This study was conducted in accordance with the Declaration of Helsinki. [IRB approval number and institution to be inserted by investigator.]',
  ].join(' ');
  var iEl = document.getElementById('stu-thesis-irb');
  if (iEl) iEl.textContent = irb;

  // ── AI Cohort Interpretation button injection ──────────────────────────
  if (!document.getElementById('stu-interpret-btn')) {
    var _interpWrap = document.createElement('div');
    _interpWrap.style.cssText = 'margin-top:14px;padding:14px 16px;background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.18);border-radius:10px;';
    _interpWrap.innerHTML =
      '<button id="stu-interpret-btn" onclick="stuInterpretCohort()" style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(46,201,138,0.10);border:1px solid rgba(46,201,138,0.30);color:rgba(46,201,138,0.9);padding:7px 16px;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(46,201,138,0.18)\'" onmouseout="this.style.background=\'rgba(46,201,138,0.10)\'">✦ Interpret My Cohort</button>' +
      '<div id="stu-interpret-output" style="display:none;margin-top:12px;padding:12px;background:rgba(0,0,0,0.15);border-radius:8px;border:1px solid rgba(255,255,255,0.06);"></div>';
    var _patternsEl = document.getElementById('stu-mod-patterns');
    if (_patternsEl) _patternsEl.appendChild(_interpWrap);
  }
}

// ── Main initializer — called from _updateStudentSessionStats ──────────────
function stuInitThesisExport() {
  var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mapRows = allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });

  // Populate citation blocks (default to APA)
  ['map','mmas','peacs'].forEach(function(inst) {
    var fmt = window._stuCiteFmt[inst] || 'apa';
    var el  = document.getElementById('stu-thesis-cite-' + inst);
    if (el && _STU_CITATIONS[inst]) el.textContent = _STU_CITATIONS[inst][fmt];
  });

  // Populate methods blocks
  var mMap   = document.getElementById('stu-thesis-methods-map');
  var mMmas  = document.getElementById('stu-thesis-methods-mmas');
  var mPeacs = document.getElementById('stu-thesis-methods-peacs');
  if (mMap)   mMap.textContent   = _STU_METHODS.map;
  if (mMmas)  mMmas.textContent  = _STU_METHODS.mmas;
  if (mPeacs) mPeacs.textContent = _STU_METHODS.peacs;

  // Populate results paragraphs
  var rMap   = document.getElementById('stu-thesis-results-map');
  var rMmas  = document.getElementById('stu-thesis-results-mmas');
  var rPeacs = document.getElementById('stu-thesis-results-peacs');
  if (rMap)   rMap.textContent   = _stuBuildMapResults(mapRows);
  if (rMmas)  rMmas.textContent  = _stuBuildMmasResults(allRows);
  if (rPeacs) rPeacs.textContent = _stuBuildPeacsResults();

  // Update N labels
  var nMap  = document.getElementById('stu-thesis-results-map-n');
  var nMmas = document.getElementById('stu-thesis-results-mmas-n');
  var nPeacs= document.getElementById('stu-thesis-results-peacs-n');
  if (nMap)   nMap.textContent   = mapRows.length ? '(N\u2009=\u2009' + mapRows.length + ')' : '';
  if (nMmas)  nMmas.textContent  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined&&r.q1===undefined;}).length ?
    '(N\u2009=\u2009' + allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined&&r.q1===undefined;}).length + ')' : '';
  if (nPeacs) nPeacs.textContent = (window._rppPeacsData||[]).length ? '(N\u2009=\u2009' + (window._rppPeacsData||[]).length + ' records)' : '';

  // Re-build combined if pane is visible
  var combinedPane = document.getElementById('stu-thesis-pane-combined');
  if (combinedPane && combinedPane.style.display !== 'none') stuBuildCombined();

  // ── Methods Section AI Drafter button injection ────────────────────────
  if (!document.getElementById('stu-draft-methods-btn')) {
    var _mWrap = document.createElement('div');
    _mWrap.style.cssText = 'margin-top:14px;padding:14px 16px;background:rgba(139,111,245,0.04);border:1px solid rgba(139,111,245,0.18);border-radius:10px;';
    _mWrap.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--mvmt);margin-bottom:6px;">Methods Section AI Drafter</div>' +
      '<div style="font-size:0.81rem;color:var(--muted);margin-bottom:10px;">Generate a thesis-ready Methods section from your study data. Fill in the bracketed fields before submitting.</div>' +
      '<button id="stu-draft-methods-btn" onclick="stuDraftMethods()" style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(139,111,245,0.10);border:1px solid rgba(139,111,245,0.30);color:rgba(139,111,245,0.9);padding:7px 16px;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(139,111,245,0.18)\'" onmouseout="this.style.background=\'rgba(139,111,245,0.10)\'">✦ Draft My Methods Section</button>' +
      '<div id="stu-draft-methods-output" style="display:none;margin-top:12px;padding:12px;background:rgba(0,0,0,0.15);border-radius:8px;border:1px solid rgba(255,255,255,0.06);"></div>';
    var _thesisEl = document.getElementById('stu-mod-thesis');
    if (_thesisEl) _thesisEl.appendChild(_mWrap);
  }
}

function stuRefreshThesisResults() { stuInitThesisExport(); }


// ══════════════════════════════════════════════════════════════════════════
// MODULE 10 — SAMPLE SIZE ADVISOR
// Uses Bonett (2002) SE approximation: SE(α) = sqrt(2k(1-α)² / N(k-1))
// Advises how many more participants are needed for publishable CI lower bound.
// ══════════════════════════════════════════════════════════════════════════

window._stuPowerTarget = 0.80; // default target

function stuInitPowerAdvisor() {
  var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mapRows = allRows.filter(function(r) { return r.tool === 'map' || r.map_q1 !== undefined; });
  var n = mapRows.length;

  var setEl = function(id, v) { var el=document.getElementById(id); if(el) el.textContent = v; };

  if (n < 2) {
    setEl('stu-power-n', n);
    setEl('stu-power-alpha', '\u2014');
    setEl('stu-power-ci-lower', '\u2014');
    var badge = document.getElementById('stu-power-badge');
    if (badge) { badge.textContent = 'Need \u2265 10 records'; badge.style.display = ''; badge.style.background = 'var(--card2)'; badge.style.color = 'var(--dim)'; badge.style.borderColor = 'var(--border2)'; }
    return;
  }

  // Compute alpha
  var k = 8;
  var _ALL = ['map_q1','map_q2','map_q3','map_q4','map_q5','map_q6','map_q7','map_q8'];
  var tVals = mapRows.map(function(r){ return _ALL.reduce(function(s,it){return s+(+(r[it]||0));},0); });
  var m = mapRows.length;
  var tMean = tVals.reduce(function(a,b){return a+b;},0)/m;
  var tVar  = tVals.reduce(function(s,t){return s+Math.pow(t-tMean,2);},0)/(m-1);
  var sumIV = _ALL.reduce(function(sv,it){
    var sc = mapRows.map(function(r){return +(r[it]||0);});
    var mn = sc.reduce(function(a,b){return a+b;},0)/m;
    return sv + sc.reduce(function(s,x){return s+Math.pow(x-mn,2);},0)/(m-1);
  },0);
  var alpha = tVar > 0 ? (k/(k-1))*(1-sumIV/tVar) : NaN;
  if (!isFinite(alpha)) { setEl('stu-power-n', n); setEl('stu-power-alpha', '\u2014'); return; }

  var ci      = _stuAlphaCI(alpha, n, k);
  var ciLow   = ci.low;
  var alphaFmt = '.' + Math.round(alpha * 100);
  var ciLowFmt = isFinite(ciLow) ? '.' + Math.round(ciLow * 100) : '\u2014';

  setEl('stu-power-n',        n);
  setEl('stu-power-alpha',    alphaFmt);
  setEl('stu-power-ci-lower', ciLowFmt);

  var alphaEl = document.getElementById('stu-power-alpha');
  if (alphaEl) alphaEl.style.color = alpha >= 0.80 ? '#059669' : alpha >= 0.70 ? '#d97706' : '#dc2626';
  var ciEl = document.getElementById('stu-power-ci-lower');
  if (ciEl) ciEl.style.color = isFinite(ciLow) && ciLow >= 0.80 ? '#059669' : ciLow >= 0.70 ? '#d97706' : '#dc2626';

  // Cache for advisor
  window._stuPowerState = { alpha: alpha, n: n, k: k };

  // Update badge
  var badge = document.getElementById('stu-power-badge');
  if (badge) {
    if (isFinite(ciLow) && ciLow >= 0.80) {
      badge.textContent = '\u2713 Publication ready'; badge.style.display = '';
      badge.style.background = 'rgba(5,150,105,0.08)'; badge.style.color = '#059669'; badge.style.borderColor = 'rgba(5,150,105,0.22)';
    } else {
      badge.textContent = 'CI lower = ' + ciLowFmt; badge.style.display = '';
      badge.style.background = 'rgba(239,68,68,0.07)'; badge.style.color = '#dc2626'; badge.style.borderColor = 'rgba(239,68,68,0.20)';
    }
  }

  // Run advisor with active target
  stuRunPowerAdvisor(window._stuPowerTarget || 0.80);
}

function stuRunPowerAdvisor(target) {
  window._stuPowerTarget = target;
  var state = window._stuPowerState;
  var resultEl  = document.getElementById('stu-power-result');
  var sentEl    = document.getElementById('stu-power-sentence');
  var detailEl  = document.getElementById('stu-power-detail');
  var progWrap  = document.getElementById('stu-power-progress-wrap');
  var progBar   = document.getElementById('stu-power-bar');
  var progPct   = document.getElementById('stu-power-pct');

  // Style target buttons
  document.querySelectorAll('.stu-power-target-btn').forEach(function(btn) {
    var isActive = parseFloat(btn.dataset.target) === target;
    btn.style.background  = isActive ? '#059669' : 'var(--card2)';
    btn.style.borderColor = isActive ? '#059669' : 'var(--border2)';
    btn.style.color       = isActive ? '#fff'    : 'var(--muted)';
  });

  if (!state || !isFinite(state.alpha)) return;

  var alpha = state.alpha, n = state.n, k = state.k;
  var ci    = _stuAlphaCI(alpha, n, k);

  if (!resultEl || !sentEl) return;
  resultEl.style.display = '';
  if (progWrap) progWrap.style.display = '';

  if (isFinite(ci.low) && ci.low >= target) {
    // Already there
    sentEl.textContent = '\u2713 Your cohort already meets this threshold.';
    resultEl.style.background = '#f0fdf4';
    resultEl.style.borderColor = 'rgba(5,150,105,0.25)';
    sentEl.style.color = '#059669';
    if (detailEl) detailEl.textContent = 'Current 95% CI lower bound = .' + Math.round(ci.low*100) + ' \u2265 target .' + Math.round(target*100) + '. You have enough participants.';
    if (progBar) { progBar.style.width = '100%'; progBar.style.background = '#059669'; }
    if (progPct) progPct.textContent = '100%';
    return;
  }

  if (alpha <= target) {
    sentEl.textContent = 'Your current \u03b1 (' + '.' + Math.round(alpha*100) + ') is at or below the target CI floor (' + '.' + Math.round(target*100) + '). Collect more data and consider instrument refinement.';
    resultEl.style.background = '#fff7ed';
    resultEl.style.borderColor = 'rgba(245,158,11,0.25)';
    sentEl.style.color = '#92400e';
    if (detailEl) detailEl.textContent = 'A CI lower bound above your current \u03b1 is not possible. Focus on increasing N to stabilize estimates.';
    if (progBar) { progBar.style.width = Math.min(100, Math.round(n/50*100)) + '%'; progBar.style.background = '#d97706'; }
    if (progPct) progPct.textContent = Math.min(100, Math.round(n/50*100)) + '%';
    return;
  }

  // N required so that lower CI >= target
  // Lower CI = alpha - 1.96 * sqrt(2k(1-alpha)^2 / (N_req*(k-1))) >= target
  // N_req >= 2k(1-alpha)^2 * 1.96^2 / ((k-1) * (alpha-target)^2)
  var nRequired = Math.ceil(2 * k * Math.pow(1 - alpha, 2) * 3.8416 / ((k - 1) * Math.pow(alpha - target, 2)));
  var nMore = Math.max(0, nRequired - n);
  // Expose target for enrollment gauge
  if (window._stuPowerState) window._stuPowerState.nRequired = nRequired;

  resultEl.style.background  = nMore === 0 ? '#f0fdf4' : '#fff7ed';
  resultEl.style.borderColor = nMore === 0 ? 'rgba(5,150,105,0.25)' : 'rgba(245,158,11,0.25)';
  sentEl.style.color         = nMore === 0 ? '#059669' : '#92400e';

  if (nMore === 0) {
    sentEl.textContent = '\u2713 You already have enough participants (N\u2009=\u2009' + n + ').';
    if (detailEl) detailEl.textContent = 'At your current \u03b1\u2009=\u2009.' + Math.round(alpha*100) + ', N\u2009=\u2009' + n + ' is sufficient for the 95% CI lower bound to reach .' + Math.round(target*100) + '.';
  } else {
    sentEl.textContent = 'You need ' + nMore + ' more participant' + (nMore!==1?'s':'') + ' (total: ' + nRequired + ') to reach a 95% CI lower bound \u2265\u2009.' + Math.round(target*100) + '.';
    if (detailEl) detailEl.textContent = 'Current: N\u2009=\u2009' + n + ', \u03b1\u2009=\u2009.' + Math.round(alpha*100) + ', CI lower\u2009=\u2009.' + Math.round(ci.low*100) + '. Required N\u2009=\u2009' + nRequired + ' based on Bonett (2002) SE approximation for k\u2009=\u2009' + k + ' items.';
  }

  var pct = Math.min(100, Math.round(n / nRequired * 100));
  if (progBar) { progBar.style.width = pct + '%'; progBar.style.background = pct >= 100 ? '#059669' : '#d97706'; }
  if (progPct) progPct.textContent = pct + '%';
}


// ══════════════════════════════════════════════════════════════════════════
// MODULE 11 — PEACS DIMENSION TRACKER
// Patient × dimension grid: BASE | MVMT | STRATA per patient
// ══════════════════════════════════════════════════════════════════════════

function stuRenderPeacsTracker() {
  var body    = document.getElementById('stu-peacs-grid-body');
  var setEl   = function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };
  var badge   = document.getElementById('stu-peacs-tracker-badge');

  var recs = window._rppPeacsData || [];
  if (!recs.length) {
    if (body) body.innerHTML = '<div style="padding:24px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--dim);">No PEACS records yet. Start a PEACS session to populate this tracker.</div>';
    setEl('stu-peacs-total',     '\u2014');
    setEl('stu-peacs-complete',  '\u2014');
    setEl('stu-peacs-partial',   '\u2014');
    setEl('stu-peacs-base-only', '\u2014');
    if (badge) badge.style.display = 'none';
    return;
  }

  // Group by patient_number
  var byPid = {};
  recs.forEach(function(r) {
    var pid = (r.patient_number || '').toString().trim().toUpperCase() || 'UNASSIGNED';
    if (!byPid[pid]) byPid[pid] = { base: false, mvmt: false, strata: false, baseScore: null, mvmtScore: null, strataScore: null, lastTs: 0 };
    var dim = (r.dimension || r.peacs_dimension || r.session_type || '').toString().toUpperCase();
    var ts  = r.timestamp || 0;
    if (dim === 'BASE'   || r.base_score   !== undefined) { byPid[pid].base   = true; if(r.base_score)   byPid[pid].baseScore   = parseFloat(r.base_score); }
    if (dim === 'MVMT'   || r.mvmt_score   !== undefined) { byPid[pid].mvmt   = true; if(r.mvmt_score)   byPid[pid].mvmtScore   = parseFloat(r.mvmt_score); }
    if (dim === 'STRATA' || r.strata_score !== undefined) { byPid[pid].strata = true; if(r.strata_score) byPid[pid].strataScore = parseFloat(r.strata_score); }
    if (ts > byPid[pid].lastTs) byPid[pid].lastTs = ts;
  });

  var patients = Object.entries(byPid).map(function(e){ return Object.assign({pid: e[0]}, e[1]); });
  patients.sort(function(a,b){ return b.lastTs - a.lastTs; }); // most recent first

  var total    = patients.length;
  var complete = patients.filter(function(p){return p.base&&p.mvmt&&p.strata;}).length;
  var partial  = patients.filter(function(p){return (p.base||p.mvmt||p.strata)&&!(p.base&&p.mvmt&&p.strata);}).length;
  var baseOnly = patients.filter(function(p){return p.base&&!p.mvmt&&!p.strata;}).length;

  setEl('stu-peacs-total',     total);
  setEl('stu-peacs-complete',  complete);
  setEl('stu-peacs-partial',   partial);
  setEl('stu-peacs-base-only', baseOnly);

  if (badge) {
    badge.textContent   = complete + '/' + total + ' complete';
    badge.style.display = '';
  }

  if (!body) return;

  var check  = '<span style="color:#059669;font-size:1rem;">&#10003;</span>';
  var miss   = '<span style="color:var(--dim);font-size:0.85rem;">\u2014</span>';

  var statusBadge = function(p) {
    if (p.base && p.mvmt && p.strata)
      return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:2px 8px;border-radius:20px;background:rgba(5,150,105,0.10);color:#059669;border:1px solid rgba(5,150,105,0.28);">Complete</span>';
    if (!p.base && !p.mvmt && !p.strata)
      return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,0.04);color:var(--dim);border:1px solid rgba(0,0,0,0.08);">Not started</span>';
    var done = [p.base,p.mvmt,p.strata].filter(Boolean).length;
    return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:2px 8px;border-radius:20px;background:rgba(217,119,6,0.09);color:#d97706;border:1px solid rgba(217,119,6,0.24);">' + done + '/3 done</span>';
  };

  body.innerHTML = patients.map(function(p) {
    var rowBg = (p.base && p.mvmt && p.strata) ? 'rgba(5,150,105,0.03)' : '';
    return '<div style="display:grid;grid-template-columns:2fr 90px 90px 90px 90px;gap:0;padding:9px 14px;border-bottom:1px solid rgba(0,0,0,0.05);align-items:center;background:' + rowBg + ';">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:var(--bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + p.pid + '</div>' +
      '<div style="text-align:center;">' + (p.base   ? check : miss) + '</div>' +
      '<div style="text-align:center;">' + (p.mvmt   ? check : miss) + '</div>' +
      '<div style="text-align:center;">' + (p.strata ? check : miss) + '</div>' +
      '<div style="text-align:center;">' + statusBadge(p) + '</div>' +
    '</div>';
  }).join('');
}


// ══════════════════════════════════════════════════════════════════════════
// MODULE 12 — MY COHORT MAP
// Personal Mapbox GL map showing only this workspace's cohort records.
// Markers colored by adherence score. Popup shows patient ID + score.
// Falls back to country list when no coordinates are available.
// ══════════════════════════════════════════════════════════════════════════

window._stuCohortMap      = null;
window._stuCohortMapOpen  = false;
window._stuCohortMapFilter= 'all';
window._stuCohortMarkers  = [];

function stuToggleCohortMap(headerBtn) {
  var body    = document.getElementById('stu-mod-cohort-map-body');
  var icon    = document.getElementById('stu-cohort-map-toggle-icon');
  if (!body) return;

  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (icon) icon.textContent = open ? '\u25b6' : '\u25bc';

  if (!open) {
    // First open — init or resize
    setTimeout(function() {
      if (!window._stuCohortMap) {
        _stuInitCohortMap();
      } else {
        window._stuCohortMap.resize();
      }
    }, 80);
  }
}

function _stuInitCohortMap() {
  if (!window.mapboxgl) return;
  if (!mapboxgl.accessToken) mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;

  var container = document.getElementById('stu-cohort-mapbox');
  if (!container) return;

  window._stuCohortMap = new mapboxgl.Map({
    container: container,
    style:     'mapbox://styles/mapbox/light-v11',
    center:    [0, 20],
    zoom:      1.4,
    projection:'globe',
    attributionControl: false,
  });

  window._stuCohortMap.addControl(new mapboxgl.NavigationControl({showCompass:false}), 'bottom-right');
  window._stuCohortMap.on('load', function() { _stuPlotCohortMarkers(); });
}

function _stuScoreColor(r) {
  if (r.tool === 'map' || r.map_q1 !== undefined || r.q1 !== undefined) {
    // MAP / MMAS with item data — use PE or MMAS score
    var score = parseFloat(r.score) || 0;
    if (r.tool === 'map' || r.map_q1 !== undefined) {
      // MAP PE 0-1
      return score >= 0.85 ? '#10b981' : score >= 0.55 ? '#f59e0b' : '#ef4444';
    }
    // MMAS 0-8
    return score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
  }
  var s = parseFloat(r.score) || 0;
  return s >= 8 ? '#10b981' : s >= 6 ? '#f59e0b' : '#ef4444';
}

function _stuPlotCohortMarkers() {
  var map = window._stuCohortMap;
  if (!map) return;

  // Clear old markers
  window._stuCohortMarkers.forEach(function(m){ m.remove(); });
  window._stuCohortMarkers = [];

  var filter   = window._stuCohortMapFilter || 'all';
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];

  var filtered = allRows.filter(function(r) {
    if (filter === 'map')    return r.tool === 'map' || r.map_q1 !== undefined;
    if (filter === 'mmas')   return r.tool !== 'map' && r.map_q1 === undefined;
    if (filter === 'atrisk') {
      var s = parseFloat(r.score) || 0;
      if (r.tool === 'map') return s < 0.55;
      return s < 6;
    }
    return true;
  });

  var withCoords  = filtered.filter(function(r){ return r.latitude && r.longitude; });
  var noCoords    = filtered.length - withCoords.length;
  var fallback    = document.getElementById('stu-cohort-map-fallback');
  var countEl     = document.getElementById('stu-cohort-map-count');
  var markerCount = document.getElementById('stu-map-marker-count');

  if (countEl) countEl.textContent = allRows.length + ' records';
  if (markerCount) markerCount.textContent = withCoords.length + ' mapped' + (noCoords ? ' · ' + noCoords + ' no coords' : '');

  // Cluster nearby coords
  var clusters = {};
  withCoords.forEach(function(r) {
    var lat = parseFloat(r.latitude).toFixed(2);
    var lng = parseFloat(r.longitude).toFixed(2);
    var key = lat + ',' + lng;
    if (!clusters[key]) clusters[key] = { lat: parseFloat(lat), lng: parseFloat(lng), records: [] };
    clusters[key].records.push(r);
  });

  Object.values(clusters).forEach(function(cl) {
    var records = cl.records;
    var scores  = records.map(function(r){ return parseFloat(r.score)||0; });
    var avg     = scores.reduce(function(a,b){return a+b;},0)/scores.length;
    var color   = _stuScoreColor(records[records.length-1]);
    var count   = records.length;
    var size    = count > 5 ? 24 : count > 2 ? 18 : 14;

    var el = document.createElement('div');
    el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:IBM Plex Mono,monospace;font-size:0.52rem;color:#fff;font-weight:700;';
    if (count > 1) el.textContent = count;

    var pid = records.map(function(r){ return r.patient_number || '—'; }).join(', ');
    var instLabel = records[0].tool === 'map' ? 'MAP PE: ' + avg.toFixed(3) : 'MMAS-8: ' + avg.toFixed(2);

    var popup = new mapboxgl.Popup({ offset: size/2 + 4, closeButton: false, className: 'stu-map-popup' })
      .setHTML('<div style="font-family:IBM Plex Mono,monospace;font-size:0.68rem;color:var(--bright);padding:2px 0;"><div style="font-weight:700;margin-bottom:2px;">PID: ' + pid + '</div><div style="color:var(--muted);">' + instLabel + '</div></div>');

    var marker = new mapboxgl.Marker({ element: el })
      .setLngLat([cl.lng, cl.lat])
      .setPopup(popup)
      .addTo(map);

    window._stuCohortMarkers.push(marker);
  });

  // Show/hide fallback country list
  if (withCoords.length === 0 && allRows.length > 0) {
    if (fallback) fallback.style.display = '';
    _stuBuildCountryList(filtered);
  } else {
    if (fallback) fallback.style.display = 'none';
  }
}

function _stuBuildCountryList(rows) {
  var listEl = document.getElementById('stu-cohort-country-list');
  if (!listEl) return;
  var counts = {};
  rows.forEach(function(r) {
    var c = r.country || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  });
  var sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
  listEl.innerHTML = sorted.map(function(e) {
    return '<div style="display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--bright);">' + e[0] + '</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--dim);">×' + e[1] + '</span>' +
      '</div>';
  }).join('');
}

function stuMapFilter(filter) {
  window._stuCohortMapFilter = filter;
  document.querySelectorAll('.stu-map-filter-btn').forEach(function(btn) {
    var isActive = btn.dataset.filter === filter;
    btn.style.background  = isActive ? '#0891b2' : 'var(--card2)';
    btn.style.borderColor = isActive ? '#0891b2' : 'var(--border2)';
    btn.style.color       = isActive ? '#fff'    : 'var(--muted)';
  });
  _stuPlotCohortMarkers();
}

// ── Researcher Cohort Map ────────────────────────────────────────────────────
window._resCohortMarkers   = [];
window._resCohortMapFilter = 'all';

function resToggleCohortMap(headerBtn) {
  var body = document.getElementById('res-mod-cohort-map-body');
  var icon = document.getElementById('res-cohort-map-toggle-icon');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (icon) icon.textContent = open ? '▶' : '▼';
  if (!open) {
    setTimeout(function() {
      if (!window._resCohortMap) { _resInitCohortMap(); }
      else { window._resCohortMap.resize(); }
    }, 80);
  }
}

function _resInitCohortMap() {
  if (!window.mapboxgl) return;
  if (!mapboxgl.accessToken) mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;

  var container = document.getElementById('res-cohort-mapbox');
  if (!container) return;

  window._resCohortMap = new mapboxgl.Map({
    container: container,
    style:     'mapbox://styles/mapbox/light-v11',
    center:    [0, 20],
    zoom:      1.4,
    projection:'globe',
    attributionControl: false,
  });

  window._resCohortMap.addControl(new mapboxgl.NavigationControl({showCompass:false}), 'bottom-right');
  window._resCohortMap.on('load', function() { _resPlotCohortMarkers(); });
}

function _resScoreColor(r) {
  if (r.tool === 'map' || r.map_q1 !== undefined || r.q1 !== undefined) {
    var score = parseFloat(r.score) || 0;
    if (r.tool === 'map' || r.map_q1 !== undefined) {
      return score >= 0.85 ? '#10b981' : score >= 0.55 ? '#f59e0b' : '#ef4444';
    }
    return score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
  }
  // PEACS — no numeric threshold; use purple
  if (r.tool === 'peacs' || r.peacs_score !== undefined) return '#7c3aed';
  var s = parseFloat(r.score) || 0;
  return s >= 8 ? '#10b981' : s >= 6 ? '#f59e0b' : '#ef4444';
}

function _resPlotCohortMarkers() {
  var map = window._resCohortMap;
  if (!map) return;

  // Clear old markers
  window._resCohortMarkers.forEach(function(m){ m.remove(); });
  window._resCohortMarkers = [];

  var filter  = window._resCohortMapFilter || 'all';
  var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];

  var filtered = allRows.filter(function(r) {
    if (filter === 'map')    return r.tool === 'map'   || r.map_q1  !== undefined;
    if (filter === 'mmas')   return r.tool === 'mmas'  || (r.tool !== 'map' && r.map_q1 === undefined && r.tool !== 'peacs' && r.peacs_score === undefined);
    if (filter === 'peacs')  return r.tool === 'peacs' || r.peacs_score !== undefined;
    if (filter === 'atrisk') {
      var s = parseFloat(r.score) || 0;
      if (r.tool === 'map' || r.map_q1 !== undefined) return s < 0.55;
      if (r.tool === 'peacs' || r.peacs_score !== undefined) return false;
      return s < 6;
    }
    return true;
  });

  var withCoords = filtered.filter(function(r){ return r.latitude && r.longitude; });
  var noCoords   = filtered.length - withCoords.length;
  var fallback   = document.getElementById('res-cohort-map-fallback');
  var countEl    = document.getElementById('res-cohort-map-count');
  var markerCount= document.getElementById('res-map-marker-count');

  if (countEl)    countEl.textContent    = allRows.length + ' records';
  if (markerCount) markerCount.textContent = withCoords.length + ' mapped' + (noCoords ? ' · ' + noCoords + ' no coords' : '');

  // Cluster nearby coords
  var clusters = {};
  withCoords.forEach(function(r) {
    var lat = parseFloat(r.latitude).toFixed(2);
    var lng = parseFloat(r.longitude).toFixed(2);
    var key = lat + ',' + lng;
    if (!clusters[key]) clusters[key] = { lat: parseFloat(lat), lng: parseFloat(lng), records: [] };
    clusters[key].records.push(r);
  });

  Object.values(clusters).forEach(function(cl) {
    var records = cl.records;
    var scores  = records.map(function(r){ return parseFloat(r.score)||0; });
    var avg     = scores.reduce(function(a,b){return a+b;},0)/scores.length;
    var color   = _resScoreColor(records[records.length-1]);
    var count   = records.length;
    var size    = count > 5 ? 24 : count > 2 ? 18 : 14;

    var el = document.createElement('div');
    el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:IBM Plex Mono,monospace;font-size:0.52rem;color:#fff;font-weight:700;';
    if (count > 1) el.textContent = count;

    var pid = records.map(function(r){ return r.patient_number || '—'; }).join(', ');
    var instLabel;
    var last = records[records.length-1];
    if (last.tool === 'map' || last.map_q1 !== undefined) {
      instLabel = 'MAP PE: ' + avg.toFixed(3);
    } else if (last.tool === 'peacs' || last.peacs_score !== undefined) {
      instLabel = 'PEACS: ' + count + ' record' + (count !== 1 ? 's' : '');
    } else {
      instLabel = 'MMAS-8: ' + avg.toFixed(2);
    }

    var popup = new mapboxgl.Popup({ offset: size/2 + 4, closeButton: false, className: 'stu-map-popup' })
      .setHTML('<div style="font-family:IBM Plex Mono,monospace;font-size:0.68rem;color:var(--bright);padding:2px 0;"><div style="font-weight:700;margin-bottom:2px;">PID: ' + pid + '</div><div style="color:var(--muted);">' + instLabel + '</div></div>');

    var marker = new mapboxgl.Marker({ element: el })
      .setLngLat([cl.lng, cl.lat])
      .setPopup(popup)
      .addTo(map);

    window._resCohortMarkers.push(marker);
  });

  // Show/hide fallback country list
  if (withCoords.length === 0 && allRows.length > 0) {
    if (fallback) fallback.style.display = '';
    _resBuildCountryList(filtered);
  } else {
    if (fallback) fallback.style.display = 'none';
  }
}

function _resBuildCountryList(rows) {
  var listEl = document.getElementById('res-cohort-country-list');
  if (!listEl) return;
  var counts = {};
  rows.forEach(function(r) {
    var c = r.country || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  });
  var sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
  listEl.innerHTML = sorted.map(function(e) {
    return '<div style="display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--bright);">' + e[0] + '</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--dim);">×' + e[1] + '</span>' +
      '</div>';
  }).join('');
}

function resMapFilter(filter) {
  window._resCohortMapFilter = filter;
  document.querySelectorAll('.res-map-filter-btn').forEach(function(btn) {
    var isActive = btn.dataset.filter === filter;
    btn.style.background  = isActive ? '#0891b2' : 'var(--card2)';
    btn.style.borderColor = isActive ? '#0891b2' : 'var(--border2)';
    btn.style.color       = isActive ? '#fff'    : 'var(--muted)';
  });
  _resPlotCohortMarkers();
}
// ── End Researcher Cohort Map ────────────────────────────────────────────────

// ── Stability / Fragility Classifier ─────────────────────────────────────────
function _tssfClass(r) {
  var pe = r.pe != null ? +r.pe : null;
  var a  = r.a  != null ? +r.a  : null;
  var e  = r.e  != null ? +r.e  : null;
  var c  = r.c  != null ? +r.c  : null;
  var sc = r.score != null ? +r.score : null;
  if (pe === null) return 'unknown';
  if (a !== null && e !== null && c !== null && a < 0.55 && e < 0.55 && c < 0.55) return 'fragile';
  if (sc !== null && sc >= 6 && pe < 0.65) return 'hidden';
  if ((a !== null && a < 0.35) || (e !== null && e < 0.35) || (c !== null && c < 0.35)) return 'domain';
  if (pe >= 0.65 && (a == null || a >= 0.55) && (e == null || e >= 0.55) && (c == null || c >= 0.55)) return 'stable';
  return 'conditional';
}

// ── Stability/Fragility Glossary Card helper ──────────────────────────────────
function _sfGlossCard(title, color, text) {
  return '<div style="background:var(--bg);border:1px solid var(--border);border-left:3px solid '+color+';border-radius:8px;padding:12px 14px;">'
    +'<div style="font-family:var(--font-mono);font-size:0.64rem;font-weight:600;color:'+color+';margin-bottom:5px;">'+title+'</div>'
    +'<div style="font-size:0.78rem;color:var(--muted);line-height:1.55;">'+text+'</div>'
    +'</div>';
}

// ── Fragility Watchlist renderer (records tab) ────────────────────────────────
function _tsRenderFragilityWatchlist(container) {
  var recs = (window._piAllRecords || []).filter(function(r){ return r.pe != null; });
  if (!recs.length) {
    container.innerHTML = '<div style="padding:20px;font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">No MAP assessment data available for fragility analysis.</div>';
    return;
  }
  var flagged = recs.filter(function(r){
    var cl = _tssfClass(r);
    return cl==='fragile'||cl==='hidden'||cl==='domain';
  });
  flagged.sort(function(a,b){ return (+a.pe||0)-(+b.pe||0); });

  var classLabel = { fragile:'Compoundly Fragile', hidden:'Hidden Binding', domain:'Domain-Fragile', stable:'Stable', conditional:'Conditional', unknown:'Unknown' };
  var classColor = { fragile:'#ef4444', hidden:'#f97316', domain:'#f59e0b', stable:'#10b981', conditional:'#3b82f6', unknown:'var(--dim)' };

  function domainFlag(r) {
    var flags = [];
    if (r.a != null && +r.a < 0.35) flags.push('Arch');
    if (r.e != null && +r.e < 0.35) flags.push('Exec');
    if (r.c != null && +r.c < 0.35) flags.push('Ctx');
    if (!flags.length && r.a != null && r.e != null && r.c != null) {
      var arr = [{l:'Arch',v:+r.a},{l:'Exec',v:+r.e},{l:'Ctx',v:+r.c}];
      arr.sort(function(a,b){return a.v-b.v;});
      flags.push(arr[0].l + ' (' + arr[0].v.toFixed(2) + ')');
    }
    return flags.join(', ') || '—';
  }

  if (!flagged.length) {
    container.innerHTML = '<div style="padding:20px 0;display:flex;align-items:center;gap:8px;">'
      +'<span style="color:#10b981;font-size:1.2rem;">✓</span>'
      +'<span style="font-family:var(--font-mono);font-size:0.78rem;color:#10b981;">No fragile patients identified in this cohort.</span>'
      +'</div>';
    return;
  }

  var rows = flagged.map(function(r) {
    var cl = _tssfClass(r);
    var pid = r.patient_number || r.id || r.patientId || '—';
    return '<tr style="border-top:1px solid var(--border);">'
      +'<td style="padding:5px 10px;font-family:var(--font-mono);font-size:0.72rem;color:var(--text);">'+(pid)+'</td>'
      +'<td style="padding:5px 10px;"><span style="font-family:var(--font-mono);font-size:0.66rem;color:'+classColor[cl]+';background:'+classColor[cl]+'18;padding:1px 6px;border-radius:3px;">'+classLabel[cl]+'</span></td>'
      +'<td style="padding:5px 10px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);text-align:right;">'+(r.pe!=null?(+r.pe).toFixed(3):'—')+'</td>'
      +'<td style="padding:5px 10px;font-family:var(--font-mono);font-size:0.70rem;color:#f59e0b;">'+domainFlag(r)+'</td>'
      +'</tr>';
  }).join('');

  container.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">'
    +'Fragility Watchlist · '+flagged.length+' of '+recs.length+' patients flagged'
    +'</div>'
    +'<table style="width:100%;border-collapse:collapse;">'
    +'<thead><tr style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);">'
    +'<th style="padding:4px 10px;text-align:left;">Patient</th>'
    +'<th style="padding:4px 10px;text-align:left;">Classification</th>'
    +'<th style="padding:4px 10px;text-align:right;">PE</th>'
    +'<th style="padding:4px 10px;text-align:left;">Failing Domain</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>';
}

// ── Domain Fragility Analysis renderer (analytics tab) ───────────────────────
function _tsRenderDomainFragility(container) {
  var recs = (window._piAllRecords || []).filter(function(r){ return r.a!=null && r.e!=null && r.c!=null; });
  if (!recs.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);padding:16px 0;">No MAP domain data available.</div>';
    return;
  }

  function domainStats(key) {
    var vals = recs.map(function(r){ return +r[key]; });
    var below35 = vals.filter(function(v){ return v<0.35; }).length;
    var below55 = vals.filter(function(v){ return v<0.55; }).length;
    var mean = vals.reduce(function(s,v){ return s+v; },0)/vals.length;
    return { mean:mean, below35:below35, below55:below55, n:recs.length,
      pct35:Math.round(below35/recs.length*100), pct55:Math.round(below55/recs.length*100) };
  }

  var A = domainStats('a'), E = domainStats('e'), C = domainStats('c');
  var primaryDriver = A.pct35 >= E.pct35 && A.pct35 >= C.pct35 ? 'Architecture'
    : E.pct35 >= C.pct35 ? 'Execution' : 'Context-Guard';
  var primaryPct = Math.max(A.pct35, E.pct35, C.pct35);

  function domRow(label, key, st) {
    var barW = Math.round(st.pct55);
    var c35 = st.pct35>=30?'#ef4444':st.pct35>=15?'#f59e0b':'#10b981';
    return '<div style="margin-bottom:12px;">'
      +'<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
      +'<span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--text);">'+label+'</span>'
      +'<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">mean '+st.mean.toFixed(3)+' · <span style="color:'+c35+';">'+st.pct35+'% critical</span></span>'
      +'</div>'
      +'<div style="background:var(--border);border-radius:3px;height:6px;overflow:hidden;">'
      +'<div style="background:linear-gradient(90deg,#ef4444,#f59e0b);height:100%;width:'+barW+'%;border-radius:3px;transition:width 0.5s;"></div>'
      +'</div>'
      +'<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:3px;">'+st.below55+' patients below threshold (0.55) · '+st.pct55+'% of cohort</div>'
      +'</div>';
  }

  container.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">MAP Domain Fragility Analysis</div>'
    +'<div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);">'
    +'Primary fragility driver: <strong style="color:#ef4444;">'+primaryDriver+'</strong> — '+primaryPct+'% of cohort below critical threshold (0.35)'
    +'</div>'
    +domRow('Architecture (Habit Structure)', 'a', A)
    +domRow('Execution (Behavioral Follow-through)', 'e', E)
    +domRow('Context-Guard (Environmental Resilience)', 'c', C);
}
// ── End Stability / Fragility helpers ────────────────────────────────────────

// ── ATLAS Tab Rail — switch function (shared by all rail roles) ───────────────
window.atlasTabSwitch = function(tabId) {
  var accentColor = window._atlasRailColor || '#d4a843';

  // Hide all tab panels
  document.querySelectorAll('.atlas-tab-panel').forEach(function(p) {
    p.style.display = 'none';
  });

  // Show target panel
  var target = document.getElementById('atlas-tab-' + tabId);
  if (target) target.style.display = '';

  // Update nav rail buttons
  document.querySelectorAll('#atlas-rail-nav button[data-tab]').forEach(function(btn) {
    var active = btn.dataset.tab === tabId;
    btn.style.background = active ? 'rgba(212,168,67,0.10)' : 'transparent';
    btn.style.color      = active ? accentColor              : 'var(--dim)';
    btn.style.boxShadow  = active ? 'inset 2px 0 0 ' + accentColor : 'none';
  });

  window._atlasActiveTab = tabId;

  // ── Shared workspace key helper ──────────────────────────────────────────
  // currentWorkspace / workspaceProfile are `let` globals (audit-router-state.js),
  // not window properties — access them directly, not via window.*
  var _tsWsKey = (typeof currentWorkspace !== 'undefined' && currentWorkspace && currentWorkspace !== 'EXPLORER' && currentWorkspace !== 'INDEPENDENT')
    ? currentWorkspace
    : null;
  var _tsUid   = firebase.auth().currentUser && firebase.auth().currentUser.uid ? firebase.auth().currentUser.uid : null;

  // ── Workspace-key guard: shows a friendly inline message when the key is not
  //    yet available, so modules don't surface cryptic API errors.
  function _tsNeedKey(bodyEl, moduleName) {
    if (_tsWsKey) return false;
    if (bodyEl && !bodyEl.dataset.inited) {
      bodyEl.dataset.inited = '1';
      bodyEl.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);padding:24px;text-align:center;">' +
        '<div style="font-size:1.1rem;margin-bottom:8px;">⊘</div>' +
        '<div style="margin-bottom:4px;color:var(--muted);">' + moduleName + '</div>' +
        '<div style="font-size:0.70rem;">Workspace key not loaded. Please reload the page or re-enter your key.</div>' +
      '</div>';
    }
    return true;
  }

  // ── Country Intelligence Portal ───────────────────────────────────────────
  // Builds a country-level adherence breakdown from window._piAllRecords.
  function _tsRenderCountryIntel(container) {
    var FM = '\'IBM Plex Mono\',monospace';
    var records = window._piAllRecords || (typeof dashMmasData !== 'undefined' ? dashMmasData : []);

    if (!records.length) {
      container.innerHTML = '<div style="padding:28px;font-family:' + FM + ';font-size:0.78rem;color:var(--dim);text-align:center;">No cohort data loaded. Administer assessments to populate country intelligence.</div>';
      return;
    }

    // Aggregate by country
    var byCountry = {};
    records.forEach(function(r) {
      var c = (r.country && r.country !== 'Unknown') ? r.country : (r.institution_code ? r.institution_code.split('-')[0] : 'Unspecified');
      if (!byCountry[c]) byCountry[c] = { n: 0, scores: [], pe: [], a: [], e: [], cg: [], conditions: {} };
      byCountry[c].n++;
      if (r.score  != null) byCountry[c].scores.push(+r.score);
      if (r.pe     != null) byCountry[c].pe.push(+r.pe);
      if (r.a      != null) byCountry[c].a.push(+r.a);
      if (r.e      != null) byCountry[c].e.push(+r.e);
      if (r.c      != null) byCountry[c].cg.push(+r.c);
      if (r.condition) byCountry[c].conditions[r.condition] = (byCountry[c].conditions[r.condition] || 0) + 1;
      var _cl = _tssfClass(r);
      if (!byCountry[c].sf) byCountry[c].sf = { stable:0, conditional:0, domain:0, fragile:0, hidden:0 };
      if (byCountry[c].sf[_cl] !== undefined) byCountry[c].sf[_cl]++;
    });

    var mean = function(arr) { return arr.length ? arr.reduce(function(s,v){return s+v;},0)/arr.length : null; };
    var fmt  = function(v,d) { return v != null ? v.toFixed(d||2) : '—'; };

    var countries = Object.keys(byCountry).sort(function(a,b){ return byCountry[b].n - byCountry[a].n; });
    var totalN = records.length;
    var uniqueCountries = countries.length;

    // Score color
    var scoreColor = function(s) {
      if (s == null) return 'var(--dim)';
      if (s >= 8)  return '#2ec98a';
      if (s >= 6)  return '#f59e0b';
      return '#ef4444';
    };
    var peColor = function(p) {
      if (p == null) return 'var(--dim)';
      if (p >= 0.75) return '#2ec98a';
      if (p >= 0.55) return '#f59e0b';
      return '#ef4444';
    };

    var topCondition = function(conds) {
      var keys = Object.keys(conds);
      if (!keys.length) return '—';
      return keys.sort(function(a,b){return conds[b]-conds[a];})[0];
    };

    // Summary strip
    var allScores = records.filter(function(r){return r.score!=null;}).map(function(r){return +r.score;});
    var allPe     = records.filter(function(r){return r.pe!=null;}).map(function(r){return +r.pe;});
    var globalMmas = mean(allScores), globalPe = mean(allPe);
    var fragCount  = records.filter(function(r){return r.score>=6 && r.pe!=null && +r.pe<0.65;}).length;

    var html = '<div style="padding:20px 22px;">' +

      // Header
      '<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;flex-wrap:wrap;">' +
        '<div style="font-family:' + FM + ';font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--base);">Geographic Intelligence</div>' +
        '<div style="font-family:' + FM + ';font-size:0.62rem;color:var(--dim);">' + totalN.toLocaleString() + ' records · ' + uniqueCountries + ' countr' + (uniqueCountries===1?'y':'ies') + '</div>' +
      '</div>' +

      // Global KPI strip
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;">' +
        ['<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:10px 14px;"><div style="font-family:' + FM + ';font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Countries</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:300;color:var(--bright);">' + uniqueCountries + '</div></div>',
         '<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:10px 14px;"><div style="font-family:' + FM + ';font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Global MMAS-8</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:300;color:' + scoreColor(globalMmas) + ';">' + fmt(globalMmas) + '</div></div>',
         '<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:10px 14px;"><div style="font-family:' + FM + ';font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Global Mean PE</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:300;color:' + peColor(globalPe) + ';">' + fmt(globalPe,3) + '</div></div>',
         '<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:10px 14px;"><div style="font-family:' + FM + ';font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Fragility Events</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:300;color:#f59e0b;">' + fragCount + '</div></div>'].join('') +
      '</div>' +

      // Country table
      '<div style="font-family:' + FM + ';font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Country Breakdown</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-family:' + FM + ';font-size:0.74rem;">' +
        '<thead><tr style="border-bottom:1px solid var(--border2);">' +
          ['Country','N','Share','MMAS-8','Mean PE','Arch','Exec','Ctx','Top Condition','Fragile %'].map(function(h){
            return '<th style="text-align:left;padding:6px 10px;color:var(--dim);font-weight:400;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;white-space:nowrap;">' + h + '</th>';
          }).join('') +
        '</tr></thead><tbody>';

    countries.forEach(function(c, idx) {
      var d = byCountry[c];
      var mMmas = mean(d.scores), mPe = mean(d.pe), mA = mean(d.a), mE = mean(d.e), mCg = mean(d.cg);
      var share = Math.round(d.n / totalN * 100);
      var bg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      var _sfN = (d.sf ? (d.sf.fragile||0)+(d.sf.hidden||0)+(d.sf.domain||0) : 0);
      var _sfPct = d.n ? Math.round(_sfN/d.n*100) : 0;
      var _sfColor = _sfPct>=30?'#ef4444':_sfPct>=15?'#f59e0b':'#10b981';
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:' + bg + ';">' +
        '<td style="padding:7px 10px;color:var(--text);font-weight:600;">' + c + '</td>' +
        '<td style="padding:7px 10px;color:var(--muted);">' + d.n + '</td>' +
        '<td style="padding:7px 10px;">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div style="width:' + Math.max(4, share) + 'px;height:4px;background:var(--base);border-radius:2px;flex-shrink:0;"></div>' +
            '<span style="color:var(--dim);">' + share + '%</span>' +
          '</div>' +
        '</td>' +
        '<td style="padding:7px 10px;color:' + scoreColor(mMmas) + ';">' + fmt(mMmas) + '</td>' +
        '<td style="padding:7px 10px;color:' + peColor(mPe) + ';">' + fmt(mPe,3) + '</td>' +
        '<td style="padding:7px 10px;color:var(--muted);">' + fmt(mA,3) + '</td>' +
        '<td style="padding:7px 10px;color:var(--muted);">' + fmt(mE,3) + '</td>' +
        '<td style="padding:7px 10px;color:var(--muted);">' + fmt(mCg,3) + '</td>' +
        '<td style="padding:7px 10px;color:var(--dim);font-size:0.68rem;">' + topCondition(d.conditions) + '</td>' +
        '<td style="padding:7px 10px;"><span style="font-family:' + FM + ';font-size:0.70rem;color:' + _sfColor + ';">' + _sfPct + '%</span></td>' +
      '</tr>';
    });

    html += '</tbody></table></div>' +
      '<div style="margin-top:10px;font-family:' + FM + ';font-size:0.62rem;color:var(--dim);">Fragility = MMAS-8 ≥ 6.0 with PE &lt; 0.65. Source: your workspace cohort records.</div>' +
    '</div>';

    container.innerHTML = html;
  }

  // ── ISR Study Builder ─────────────────────────────────────────────────────
  // Investigator-Sponsored Research proposal builder. Persists to localStorage.
  function _tsRenderISRBuilder(container, wsKey) {
    var FM  = '\'IBM Plex Mono\',monospace';
    var SK  = 'atlas_isr_' + (wsKey || 'default');
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(SK) || '{}'); } catch(e) {}

    var v = function(k, def) { return saved[k] != null ? saved[k] : (def || ''); };

    var CONDITIONS = ['Hypertension','Type 2 Diabetes','Heart Failure','COPD','Dyslipidemia','HIV/AIDS','Mental Health','Oncology','Other'];
    var PHASES = ['Phase II','Phase IIb','Phase III','Phase IIIb','Phase IV / RWE','Observational'];
    var ENDPOINTS = ['MMAS-8 Score Change (Primary)','PE Score Change (Primary)','Fragility Event Rate Reduction','Stability Convergence Rate','Architecture Domain Improvement','Execution Domain Improvement','Context-Guard Domain Improvement','Adherence-Related Hospitalization Rate','Refill Rate / PDC'];

    var condOpts = CONDITIONS.map(function(c){ return '<option' + (v('condition')===c?' selected':'') + '>' + c + '</option>'; }).join('');
    var phaseOpts = PHASES.map(function(p){ return '<option' + (v('phase')===p?' selected':'') + '>' + p + '</option>'; }).join('');

    var endpointChecks = ENDPOINTS.map(function(ep,i) {
      var sel = (v('endpoints','') || '').indexOf(ep) !== -1;
      return '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:6px;">' +
        '<input type="checkbox" data-isr-ep="' + i + '" ' + (sel?'checked':'') + ' onchange="_tsIsrSave(\'' + SK + '\')" style="margin-top:2px;accent-color:var(--pe);flex-shrink:0;">' +
        '<span style="font-size:0.74rem;color:var(--text);">' + ep + '</span>' +
      '</label>';
    }).join('');

    container.innerHTML =
      '<div style="padding:20px 22px;">' +

        // Header
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">' +
          '<div>' +
            '<div style="font-family:' + FM + ';font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--pe);margin-bottom:3px;">Pharma Partnership</div>' +
            '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.15rem;font-weight:300;color:var(--bright);">ISR Proposal Builder</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="_tsIsrSave(\'' + SK + '\')" style="font-family:' + FM + ';font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(212,168,67,0.10);border:1px solid rgba(212,168,67,0.3);color:var(--pe);border-radius:6px;padding:6px 14px;cursor:pointer;">Save Draft</button>' +
            '<button onclick="_tsIsrExport(\'' + SK + '\')" style="font-family:' + FM + ';font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(78,156,245,0.10);border:1px solid rgba(78,156,245,0.3);color:var(--base);border-radius:6px;padding:6px 14px;cursor:pointer;">Copy Summary</button>' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +

          // Left column
          '<div style="display:flex;flex-direction:column;gap:12px;">' +
            _isrField('Study Title', 'text', 'isr-title', v('title'), 'e.g. MAP-Guided Adherence Intervention in Hypertension') +
            _isrField('Sponsoring Company / CRO', 'text', 'isr-sponsor', v('sponsor'), 'e.g. Novartis, Pfizer, Boehringer Ingelheim') +
            _isrSelect('Therapeutic Area', 'isr-condition', condOpts) +
            _isrSelect('Study Phase', 'isr-phase', phaseOpts) +
            _isrField('Target Sample Size (N)', 'number', 'isr-n', v('n'), 'e.g. 240') +
            _isrField('Study Duration (months)', 'number', 'isr-duration', v('duration'), 'e.g. 18') +
          '</div>' +

          // Right column
          '<div style="display:flex;flex-direction:column;gap:12px;">' +
            '<div>' +
              '<div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">MAP-Aligned Endpoints</div>' +
              '<div id="isr-endpoint-list">' + endpointChecks + '</div>' +
            '</div>' +
            '<div>' +
              '<div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Study Rationale</div>' +
              '<textarea id="isr-rationale" oninput="_tsIsrSave(\'' + SK + '\')" rows="5" placeholder="Describe the scientific rationale for this ISR and how MAP domain decomposition adds value over standard adherence measurement..." style="width:100%;box-sizing:border-box;font-family:' + FM + ';font-size:0.74rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:8px 10px;resize:vertical;outline:none;">' + v('rationale') + '</textarea>' +
            '</div>' +
            '<div>' +
              '<div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Contact / PI Affiliation</div>' +
              '<input id="isr-contact" type="text" value="' + v('contact') + '" oninput="_tsIsrSave(\'' + SK + '\')" placeholder="PI name, institution, email" style="width:100%;box-sizing:border-box;font-family:' + FM + ';font-size:0.74rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;outline:none;">' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div id="isr-save-note" style="margin-top:12px;font-family:' + FM + ';font-size:0.62rem;color:var(--dim);display:none;">Draft saved.</div>' +

      '</div>';

    // Field helpers (defined as locals, used in the template above)
    function _isrField(label, type, id, val, ph) {
      return '<div><div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">' + label + '</div>' +
        '<input type="' + type + '" id="' + id + '" value="' + (val||'').toString().replace(/"/g,'&quot;') + '" oninput="_tsIsrSave(\'' + SK + '\')" placeholder="' + ph + '" style="width:100%;box-sizing:border-box;font-family:' + FM + ';font-size:0.74rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;outline:none;"></div>';
    }
    function _isrSelect(label, id, opts) {
      return '<div><div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">' + label + '</div>' +
        '<select id="' + id + '" onchange="_tsIsrSave(\'' + SK + '\')" style="width:100%;box-sizing:border-box;font-family:' + FM + ';font-size:0.74rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;outline:none;cursor:pointer;">' + opts + '</select></div>';
    }
  }

  // ISR save — called from inline onchange/oninput handlers
  window._tsIsrSave = function(sk) {
    var g = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var eps = [];
    document.querySelectorAll('[data-isr-ep]').forEach(function(cb) { if (cb.checked) eps.push(cb.closest('label').querySelector('span').textContent); });
    var data = {
      title: g('isr-title'), sponsor: g('isr-sponsor'),
      condition: g('isr-condition'), phase: g('isr-phase'),
      n: g('isr-n'), duration: g('isr-duration'),
      rationale: g('isr-rationale'), contact: g('isr-contact'),
      endpoints: eps.join('||'), saved: new Date().toISOString()
    };
    try { localStorage.setItem(sk, JSON.stringify(data)); } catch(e) {}
    var note = document.getElementById('isr-save-note');
    if (note) { note.style.display = 'block'; setTimeout(function(){note.style.display='none';}, 2000); }
  };

  // ISR export — copies a text summary to clipboard
  window._tsIsrExport = function(sk) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(sk) || '{}'); } catch(e) {}
    var eps = saved.endpoints ? saved.endpoints.split('||').filter(Boolean) : [];
    var text = [
      'INVESTIGATOR-SPONSORED RESEARCH PROPOSAL SUMMARY',
      'Generated by ATLAS · Adherence Cartography · ' + new Date().toLocaleDateString(),
      '',
      'Study Title:      ' + (saved.title || '—'),
      'Sponsor / CRO:    ' + (saved.sponsor || '—'),
      'Therapeutic Area: ' + (saved.condition || '—'),
      'Study Phase:      ' + (saved.phase || '—'),
      'Sample Size:      N = ' + (saved.n || '—'),
      'Duration:         ' + (saved.duration || '—') + ' months',
      '',
      'MAP-ALIGNED ENDPOINTS',
      eps.length ? eps.map(function(e){return '  • ' + e;}).join('\n') : '  (none selected)',
      '',
      'SCIENTIFIC RATIONALE',
      saved.rationale || '—',
      '',
      'PI / CONTACT',
      saved.contact || '—',
      '',
      'INSTRUMENT: MMAS-8 (Morisky Medication Adherence Scale, © Donald E. Morisky)',
      'FRAMEWORK:  MAP Tri-Domain Analytics (Multidimensional Adherence Parameters)',
      'PLATFORM:   ATLAS · atlas.adherence.cc',
    ].join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        if (typeof showToast === 'function') showToast('ISR summary copied to clipboard.', 3000);
      });
    }
  };

  // ── Side-effects per tab ─────────────────────────────────────────────────
  if (tabId === 'records') {
    // Resize MapBox instances if open (researcher and student cohort maps)
    if (window._resCohortMap)  setTimeout(function(){ window._resCohortMap.resize();  }, 100);
    if (window._stuCohortMap)  setTimeout(function(){ window._stuCohortMap.resize();  }, 100);
    // Fragility watchlist
    var _wlWrap = document.getElementById('res-mod-fragility-watchlist');
    if (!_wlWrap) {
      _wlWrap = document.createElement('div');
      _wlWrap.id = 'res-mod-fragility-watchlist';
      _wlWrap.style.cssText = 'background:var(--card);border:1px solid var(--border);border-left:3px solid #ef4444;border-radius:12px;padding:16px 20px;margin-top:12px;';
      var _recPanel    = document.getElementById('researcher-patient-panel');
      var _atlasRecTab = document.getElementById('atlas-tab-records');
      if (_recPanel && _atlasRecTab && _recPanel.closest('#atlas-tab-records')) {
        // PI/researcher: rpp is inside the rail Records tab — insert before it
        _recPanel.parentNode.insertBefore(_wlWrap, _recPanel);
      } else if (_atlasRecTab) {
        // Student: rpp lives hidden in dash-body; inject into the rail Records tab instead
        _atlasRecTab.appendChild(_wlWrap);
      } else if (_recPanel && _recPanel.parentNode) {
        _recPanel.parentNode.insertBefore(_wlWrap, _recPanel);
      }
    }
    _tsRenderFragilityWatchlist(_wlWrap);
  }
  if ((tabId === 'validation' || tabId === 'writing') && typeof _updateStudentValidationPanel === 'function') {
    // 'writing' = student tab that contains validation module
    setTimeout(_updateStudentValidationPanel, 100);
  }
  if ((tabId === 'analytics' || tabId === 'analysis') && typeof _resUpdateAnalytics === 'function') {
    // 'analysis' = student analytics tab; 'analytics' = researcher/PI analytics tab
    setTimeout(_resUpdateAnalytics, 80);
  }
  if (tabId === 'analytics') {
    // Domain fragility analysis panel
    var _dfWrap = document.getElementById('res-mod-domain-fragility');
    if (!_dfWrap) {
      _dfWrap = document.createElement('div');
      _dfWrap.id = 'res-mod-domain-fragility';
      _dfWrap.style.cssText = 'background:var(--card);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:12px;padding:16px 20px;margin-top:12px;';
      var _analyticsPanel = document.getElementById('res-analytics-panel');
      if (_analyticsPanel && _analyticsPanel.parentNode) _analyticsPanel.parentNode.insertBefore(_dfWrap, _analyticsPanel.nextSibling);
    }
    _tsRenderDomainFragility(_dfWrap);
  }
  if (tabId === 'cohort' && typeof _updateStudentSessionStats === 'function') {
    // Re-sync stat strip when returning to student cohort overview
    setTimeout(_updateStudentSessionStats, 80);
  }
  if (tabId === 'overview' && typeof _cpoUpdate === 'function') {
    // Refresh Clinical Practice Overview when returning to the tab
    setTimeout(_cpoUpdate, 80);
  }
  if (tabId === 'tessera') {
    // Lazy-init TESSERA GRC Grant Resource Center on first visit
    var _tesseraBody = document.getElementById('res-tessera-body');
    if (_tesseraBody && !_tesseraBody.dataset.inited && typeof window.saGrantResourcesInit === 'function') {
      _tesseraBody.dataset.inited = '1';
      window.saGrantResourcesInit(_tesseraBody);
    }
  }
  if (tabId === 'learning') {
    // Lazy-init LMIC Training Curriculum on first visit
    var _ltcBody = document.getElementById('res-lmic-training-body');
    if (_ltcBody && !_ltcBody.dataset.inited && typeof window.lmicTrainingInit === 'function') {
      _ltcBody.dataset.inited = '1';
      window.lmicTrainingInit(_ltcBody);
    }
    // MAP Framework stability/fragility glossary card
    var _glossWrap = document.getElementById('res-mod-sf-glossary');
    if (!_glossWrap) {
      _glossWrap = document.createElement('div');
      _glossWrap.id = 'res-mod-sf-glossary';
      _glossWrap.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin-bottom:14px;';
      _glossWrap.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">MAP Framework · Stability and Fragility</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
        +_sfGlossCard('Stable','#10b981','PE ≥ 0.65, all MAP domains ≥ 0.55, MMAS ≤ 6. Patient demonstrates sustainable adherence with structural integrity across Architecture, Execution, and Context-Guard dimensions.')
        +_sfGlossCard('Conditionally Stable','#3b82f6','PE 0.50–0.80 with high domain variance. Adequate overall adherence, but one disruption — a schedule change, side effect, or social stressor — may trigger lapse.')
        +_sfGlossCard('Domain-Fragile','#f59e0b','Any single MAP domain below 0.35. Architecture fragility means the habit structure is weak. Execution fragility means behavioral follow-through is failing. Context-Guard fragility means the environment is undermining the regimen.')
        +_sfGlossCard('Compoundly Fragile','#ef4444','All three MAP domains below 0.55 simultaneously. The highest clinical priority. Structural, behavioral, and contextual factors are all compromised — adherence collapse is likely without intervention.')
        +_sfGlossCard('Hidden Binding Constraint','#f97316','MMAS-8 ≥ 6 (self-reported poor adherence) but PE < 0.65. The patient acknowledges difficulty but structural PE is suppressed — indicating a pattern that is fragile in ways the patient may not recognize.')
        +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">'
        +'<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Predictive Emergence (PE)</div>'
        +'<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text);margin-bottom:4px;">PE = (A × E × C)<sup>⅓</sup></div>'
        +'<div style="font-size:0.78rem;color:var(--muted);line-height:1.55;">The geometric mean of the three MAP domains. A single failing domain suppresses PE even when the others are strong — which is why compoundly fragile patients have dramatically low PE scores.</div>'
        +'</div>'
        +'</div>';
      var _lmicPanel = document.getElementById('res-mod-lmic-training');
      if (_lmicPanel && _lmicPanel.parentNode) {
        _lmicPanel.parentNode.insertBefore(_glossWrap, _lmicPanel);
      } else {
        var _learningTab = document.getElementById('atlas-tab-learning');
        if (_learningTab) _learningTab.insertBefore(_glossWrap, _learningTab.firstChild);
      }
    }
  }

  // ── 'studies' tab: PI research panel + Country Intelligence + ISR ────────
  if (tabId === 'studies' || tabId === 'research' || tabId === 'intel') {
    var _intelBody = document.getElementById('res-country-intel-body');
    if (_intelBody && !_intelBody.dataset.inited) {
      _intelBody.dataset.inited = '1';
      if (typeof window.renderCountryIntelPortal === 'function') {
        window.renderCountryIntelPortal('res-country-intel-body', { useDemo: false });
      } else {
        _tsRenderCountryIntel(_intelBody);
      }
    }
  }
  if (tabId === 'studies' || tabId === 'research' || tabId === 'isr') {
    var _isrBody2 = document.getElementById('res-isr-body');
    if (_isrBody2 && !_isrBody2.dataset.inited) {
      _isrBody2.dataset.inited = '1';
      if (typeof window.renderISRStudyBuilder === 'function') {
        window.renderISRStudyBuilder('res-isr-body', { workspaceKey: _tsWsKey });
      } else {
        _tsRenderISRBuilder(_isrBody2, _tsWsKey);
      }
    }
  }

  // ── 'longitudinal' tab: session tracking + dropout risk ─────────────────
  if (tabId === 'longitudinal' || tabId === 'tracking') {
    var _trackingBody = document.getElementById('res-longitudinal-body');
    if (_trackingBody && !_trackingBody.dataset.inited && !_tsNeedKey(_trackingBody, 'Longitudinal Tracking') && typeof window.renderLongitudinalDashboard === 'function') {
      _trackingBody.dataset.inited = '1';
      window.renderLongitudinalDashboard('res-longitudinal-body', _tsWsKey);
    }
  }
  if (tabId === 'longitudinal' || tabId === 'predict') {
    var _predictBody = document.getElementById('res-predictive-body');
    if (_predictBody && !_predictBody.dataset.inited && !_tsNeedKey(_predictBody, 'Dropout Risk Dashboard') && typeof window.renderDropoutRiskDashboard === 'function') {
      _predictBody.dataset.inited = '1';
      window.renderDropoutRiskDashboard('res-predictive-body', _tsWsKey);
    }
  }

  // ── 'integrations' tab: MaaS + DHIS2 + Pharmacy + Open Data ────────────
  if (tabId === 'integrations' || tabId === 'pharmacy') {
    var _pharmacyBody = document.getElementById('res-pharmacy-body');
    if (_pharmacyBody && !_pharmacyBody.dataset.inited && typeof window.renderPharmacyNetworkStats === 'function') {
      _pharmacyBody.dataset.inited = '1';
      window.renderPharmacyNetworkStats('res-pharmacy-body', _tsWsKey);
    }
  }
  if (tabId === 'integrations' || tabId === 'maas') {
    var _maasBody = document.getElementById('res-maas-body');
    if (_maasBody && !_maasBody.dataset.inited && !_tsNeedKey(_maasBody, 'MaaS API Portal') && typeof window.renderMaaSPortal === 'function') {
      _maasBody.dataset.inited = '1';
      window.renderMaaSPortal('res-maas-body', _tsWsKey);
    }
  }
  if (tabId === 'integrations' || tabId === 'dhis2') {
    var _dhis2Body = document.getElementById('res-dhis2-body');
    if (_dhis2Body && !_dhis2Body.dataset.inited && typeof window.renderDHIS2Portal === 'function') {
      _dhis2Body.dataset.inited = '1';
      window.renderDHIS2Portal('res-dhis2-body', _tsWsKey);
    }
  }
  if (tabId === 'integrations' || tabId === 'opendata') {
    var _openDataBody = document.getElementById('res-open-data-body');
    if (_openDataBody && !_openDataBody.dataset.inited && typeof window.renderOpenDataPortal === 'function') {
      _openDataBody.dataset.inited = '1';
      window.renderOpenDataPortal('res-open-data-body', _tsWsKey);
    }
  }

  // ── 'publications' tab: APA/power/predictor + certification ─────────────
  if (tabId === 'publications' || tabId === 'certification') {
    var _certBody = document.getElementById('res-certification-body');
    if (_certBody && !_certBody.dataset.inited && typeof window.renderCertificationHub === 'function') {
      _certBody.dataset.inited = '1';
      window.renderCertificationHub('res-certification-body', _tsUid, _tsWsKey);
    }
  }

  if (tabId === 'publications' || tabId === 'certification' || tabId === 'portfolio') {
    var _portBody = document.getElementById('res-portfolio-body');
    if (_portBody && !_portBody.dataset.inited) {
      _portBody.dataset.inited = '1';
      renderStudentPortfolio('res-portfolio-body', _tsUid, _tsWsKey);
    }
  }

  // ── 'analytics' tab: also inits HEOR and Equity (now nested in Analytics) ─
  if (tabId === 'analytics' || tabId === 'heor') {
    var _heorBody = document.getElementById('res-heor-body');
    if (_heorBody && !_heorBody.dataset.inited && typeof window.renderHEORDashboard === 'function') {
      _heorBody.dataset.inited = '1';
      window.renderHEORDashboard('res-heor-body', _tsWsKey);
    }
  }
  if (tabId === 'analytics' || tabId === 'equity') {
    var _equityBody = document.getElementById('res-equity-body');
    if (_equityBody && !_equityBody.dataset.inited && typeof window.renderEquityDashboard === 'function') {
      _equityBody.dataset.inited = '1';
      window.renderEquityDashboard('res-equity-body', _tsWsKey);
    }
  }

  // ── 'admin' tab: institution self-service team management ─────────────────
  if (tabId === 'admin' && typeof isInstitutionMode === 'function' && isInstitutionMode()) {
    var _instAdminWrap = document.getElementById('inst-admin-wrap');
    if (!_instAdminWrap) {
      var _toolsBar = document.getElementById('res-tools-bar');
      if (_toolsBar) {
        _instAdminWrap = document.createElement('div');
        _instAdminWrap.id = 'inst-admin-wrap';
        _instAdminWrap.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;padding:24px;margin-top:14px;';
        _toolsBar.parentNode.insertBefore(_instAdminWrap, _toolsBar.nextSibling);
      }
    }
    if (_instAdminWrap && !_instAdminWrap.dataset.inited && typeof renderInstAdmin === 'function') {
      _instAdminWrap.dataset.inited = '1';
      renderInstAdmin(_instAdminWrap);
    }
  }
};
// ── End ATLAS Tab Rail ──────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════════════════
// Open Data Portal
// Renders into res-open-data-body on the Integrations tab (PI/researcher).
// Lets users browse ATLAS open datasets and submit access requests.
// ══════════════════════════════════════════════════════════════════════════
window.renderOpenDataPortal = function(containerId, wsKey) {
  var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  var FM = "'IBM Plex Mono',monospace";
  var db = (typeof database !== 'undefined') ? database : null;
  var user = (typeof firebase !== 'undefined') ? firebase.auth().currentUser : null;

  container.innerHTML =
    '<div style="font-family:' + FM + ';font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(78,156,245,0.6);margin-bottom:6px;">Open Data / GAI</div>' +
    '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.25rem;font-weight:300;color:var(--bright);margin-bottom:6px;">ATLAS Open Data Portal</div>' +
    '<p style="font-size:0.80rem;color:var(--muted);line-height:1.75;margin-bottom:20px;">Request access to anonymized ATLAS adherence datasets for secondary analysis. All requests are reviewed by the Data Access Committee within 10 business days.</p>' +

    '<div style="margin-bottom:24px;padding:16px;border:1px solid rgba(78,156,245,0.2);border-radius:8px;background:rgba(78,156,245,0.04);" id="odp-catalog">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:rgba(78,156,245,0.7);margin-bottom:6px;">DATASET CATALOG — PENDING</div>' +
      '<div style="font-size:0.82rem;color:var(--muted);line-height:1.7;">Curated secondary-analysis datasets are in preparation and not yet available for download. Submit an access request below to be notified when datasets open for applications. Do not cite any dataset as available until an official Data Access Agreement has been executed.</div>' +
    '</div>' +

    '<div style="border-top:1px solid var(--border);padding-top:20px;">' +
      '<div style="font-family:' + FM + ';font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:12px;">Request Dataset Access</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<input id="odp-req-dataset" placeholder="Dataset name or ID" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:var(--bright);font-family:' + FM + ';font-size:0.78rem;outline:none;"/>' +
        '<textarea id="odp-req-purpose" placeholder="Research purpose and intended use (100–500 words)" rows="3" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:var(--bright);font-family:' + FM + ';font-size:0.78rem;outline:none;resize:vertical;"></textarea>' +
        '<input id="odp-req-irb" placeholder="IRB protocol number (if applicable)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:var(--bright);font-family:' + FM + ';font-size:0.78rem;outline:none;"/>' +
        '<div id="odp-req-msg" style="font-family:' + FM + ';font-size:0.72rem;display:none;"></div>' +
        '<button onclick="window._odpSubmitRequest()" style="font-family:' + FM + ';font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(78,156,245,0.10);border:1px solid rgba(78,156,245,0.30);color:rgba(78,156,245,0.9);padding:9px 20px;border-radius:7px;cursor:pointer;align-self:flex-start;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(78,156,245,0.18)\'" onmouseout="this.style.background=\'rgba(78,156,245,0.10)\'">Submit Access Request →</button>' +
      '</div>' +
    '</div>';

  window._odpSubmitRequest = function() {
    var dataset = (document.getElementById('odp-req-dataset') || {}).value || '';
    var purpose = (document.getElementById('odp-req-purpose') || {}).value || '';
    var irb     = (document.getElementById('odp-req-irb')     || {}).value || '';
    var msgEl   = document.getElementById('odp-req-msg');
    if (!dataset.trim() || purpose.trim().length < 20) {
      if (msgEl) { msgEl.textContent = 'Dataset name and research purpose are required (min 20 characters).'; msgEl.style.color = 'rgba(239,68,68,0.9)'; msgEl.style.display = 'block'; }
      return;
    }
    if (!db || !user) {
      if (msgEl) { msgEl.textContent = 'You must be signed in to submit a request.'; msgEl.style.color = 'rgba(239,68,68,0.9)'; msgEl.style.display = 'block'; }
      return;
    }
    var record = {
      uid: user.uid, workspace: wsKey || null,
      dataset: dataset.trim(), purpose: purpose.trim(),
      irb: irb.trim() || null, submitted_at: Date.now(), status: 'pending'
    };
    db.ref('open_data_notifications').push(record).then(function() {
      if (msgEl) { msgEl.textContent = 'Request submitted. The Data Access Committee will respond within 10 business days.'; msgEl.style.color = 'rgba(46,201,138,0.9)'; msgEl.style.display = 'block'; }
      ['odp-req-dataset','odp-req-purpose','odp-req-irb'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    }).catch(function(err) {
      if (msgEl) { msgEl.textContent = 'Submission failed: ' + (err.message || 'Unknown error'); msgEl.style.color = 'rgba(239,68,68,0.9)'; msgEl.style.display = 'block'; }
    });
  };
};

function _odpDatasetCard(title, desc, id, color) {
  return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ' + color + ';border-radius:8px;padding:14px 16px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;font-weight:600;color:var(--bright);margin-bottom:5px;">' + title + '</div>' +
    '<div style="font-size:0.76rem;color:var(--muted);line-height:1.6;margin-bottom:8px;">' + desc + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:' + color + ';opacity:0.7;">' + id + '</div>' +
  '</div>';
}


// ══════════════════════════════════════════════════════════════════════════
// MASTER INIT — patch _updateStudentSessionStats to trigger thesis modules
// Called at the end of _updateStudentSessionStats (spectator.js).
// ══════════════════════════════════════════════════════════════════════════

(function _patchStudentStats() {
  window._stuThesisRefreshFromStats = function() {
    // Only run if the thesis panel exists in DOM
    if (!document.getElementById('stu-mod-thesis')) return;
    stuInitThesisExport();
    stuInitPowerAdvisor();
    stuRenderPeacsTracker();

    // Update cohort map count badge
    var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
    var countEl = document.getElementById('stu-cohort-map-count');
    if (countEl) countEl.textContent = allRows.length + ' records';

    // Re-plot if map is already open
    if (window._stuCohortMap) {
      try { _stuPlotCohortMarkers(); } catch(e) {}
    }

    // Apply persisted settings on first load (DOM must exist first)
    if (!window._stuSettingsApplied) {
      window._stuSettingsApplied = true;
      if (typeof stuLoadSettings === 'function') stuLoadSettings();
    }

    // Render data visualization charts
    var _chartRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
    stuRenderScoreHistogram(_chartRows);
    stuRenderDomainRadar(_chartRows);
    stuRenderEnrollmentVelocity(_chartRows);
    stuRenderTrajectoryChart(_chartRows);

    // Show setup wizard only after student workspace is confirmed active
    setTimeout(() => { if (typeof stuWizShow === 'function') stuWizShow(); }, 600);
  };
})();


// ══════════════════════════════════════════════════════════════════════════
// MODULE 13 — THESIS MODE
// Plain-language interpretation banners injected into each Thesis Export pane.
// State persists to localStorage. Toggled via the thesis panel control bar
// or the student settings modal.
// ══════════════════════════════════════════════════════════════════════════

window._stuThesisMode = (localStorage.getItem('atlas_stu_thesis_mode') === 'true');

function stuToggleThesisMode() {
  window._stuThesisMode = !window._stuThesisMode;
  localStorage.setItem('atlas_stu_thesis_mode', String(window._stuThesisMode));
  _stuApplyThesisMode();
  _stuSyncThesisModeButton();
}

function _stuSyncThesisModeButton() {
  var btn = document.getElementById('stu-thesis-mode-btn');
  if (!btn) return;
  var on = window._stuThesisMode;
  btn.textContent  = on ? '◉ Thesis Mode: ON' : '○ Thesis Mode';
  btn.style.background  = on ? 'rgba(212,168,67,0.12)' : 'var(--card2)';
  btn.style.borderColor = on ? 'rgba(245,158,11,0.5)'  : 'var(--border2)';
  btn.style.color       = on ? 'var(--pe)'              : 'var(--muted)';
}

function _stuApplyThesisMode() {
  ['map', 'mmas', 'peacs', 'combined'].forEach(function(tab) {
    var pane = document.getElementById('stu-thesis-pane-' + tab);
    if (!pane) return;

    var banner = pane.querySelector('.stu-tm-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'stu-tm-banner';
      banner.style.cssText = 'background:rgba(212,168,67,0.08);border:1px solid rgba(245,158,11,0.28);border-radius:8px;padding:12px 16px;margin-bottom:16px;';
      pane.insertBefore(banner, pane.firstChild);
    }

    if (window._stuThesisMode) {
      banner.style.display = '';
      banner.innerHTML = _stuThesisModeBannerHTML(tab);
    } else {
      banner.style.display = 'none';
    }
  });

  // Suppress the old static placeholder (MAP pane only, was pre-built but empty)
  var oldBanner = document.getElementById('stu-thesis-thesis-mode-banner');
  if (oldBanner) oldBanner.style.display = 'none';
}

function _stuThesisModeBannerHTML(tab) {
  var allRows   = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mapRows   = allRows.filter(function(r) { return r.tool === 'map' || r.map_q1 !== undefined; });
  var mmasRows  = allRows.filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined; });
  var peacsRecs = window._rppPeacsData || [];

  var hdr  = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.16em;text-transform:uppercase;color:#d97706;margin-bottom:7px;">◉ Thesis Mode — Plain Language</div>';
  var wrap = '<div style="font-size:0.78rem;color:#92400e;line-height:1.75;">';
  var content = '';

  if (tab === 'map') {
    if (!mapRows.length) {
      content = 'No MAP data yet. Once you collect assessments, this panel will explain what your results mean in everyday language.';
    } else {
      var n = mapRows.length;
      var sumA=0, sumE=0, sumC=0;
      mapRows.forEach(function(r) {
        sumA += parseFloat(r.arch_score) || ((parseFloat(r.q2||0)+parseFloat(r.q3||0)+parseFloat(r.q6||0))/3);
        sumE += parseFloat(r.exec_score) || ((parseFloat(r.q1||0)+parseFloat(r.q5||0)+parseFloat(r.q8||0))/3);
        sumC += parseFloat(r.ctx_score) || Math.max(0.5, 0.5 + 0.5 * ((parseFloat(r.q4||0) + parseFloat(r.q7||0)) / 2));
      });
      var pe = Math.pow(Math.max(0, (sumA/n)*(sumE/n)*(sumC/n)), 1/3);
      var domains = [{name:'Architecture',val:sumA/n},{name:'Execution',val:sumE/n},{name:'Context',val:sumC/n}];
      domains.sort(function(a,b){return a.val-b.val;});
      var weakest = domains[0].name;

      var explain, action;
      if      (pe >= 0.85) { explain='Your cohort shows <strong>strong, consistent medication-taking behavior</strong>. Most participants follow their regimens reliably across all three behavioral domains.'; action='This is an excellent outcome for your thesis.'; }
      else if (pe >= 0.70) { explain='Your cohort shows <strong>good adherence overall</strong>, with minor inconsistencies in some areas.'; action='Most participants are doing well. The <strong>' + weakest + '</strong> domain has the most room for improvement.'; }
      else if (pe >= 0.55) { explain='Your cohort shows <strong>moderate adherence</strong>. Participants are generally taking medications but with noticeable gaps.'; action='The <strong>' + weakest + '</strong> domain is the biggest driver — focus your intervention discussion here.'; }
      else if (pe >= 0.40) { explain='Your cohort shows <strong>below-average adherence</strong>. A significant portion of participants miss doses or make unsanctioned changes.'; action='Make the <strong>' + weakest + '</strong> domain the centerpiece of your recommendations section.'; }
      else                 { explain='Your cohort shows <strong>critical adherence instability</strong>. Participants are frequently not taking medications as prescribed.'; action='This is a significant finding. Immediate focus on the <strong>' + weakest + '</strong> domain is indicated in your discussion.'; }

      content = explain + ' ' + action +
        '<br><br><strong>What is the PE score?</strong> The Predictive Emergence (PE) score (' + pe.toFixed(3) + ') runs from 0 to 1 and is calculated using a geometric mean of three domains. Because of the geometric mean, <em>all three domains must be healthy for the overall score to be high</em> — one weak domain drags the whole score down. This is intentional: it captures how behavioral systems are interdependent.';
    }
  }

  else if (tab === 'mmas') {
    if (!mmasRows.length) {
      content = 'No MMAS-8 data yet. Once you run assessments, this panel will explain what your results mean in plain language.';
    } else {
      var n   = mmasRows.length;
      var sc  = mmasRows.map(function(r){return parseFloat(r.score)||0;});
      var avg = sc.reduce(function(a,b){return a+b;},0)/n;
      var nHi = mmasRows.filter(function(r){return parseFloat(r.score)>=8;}).length;
      var nMd = mmasRows.filter(function(r){var s=parseFloat(r.score);return s>=6&&s<8;}).length;
      var nLo = mmasRows.filter(function(r){return parseFloat(r.score)<6;}).length;
      var pct = function(x){return Math.round(x/n*100);};

      var scoreMsg;
      if      (avg >= 7.5) scoreMsg = 'Your mean score of <strong>' + avg.toFixed(2) + '/8</strong> is high — most participants report taking medications reliably.';
      else if (avg >= 6)   scoreMsg = 'Your mean score of <strong>' + avg.toFixed(2) + '/8</strong> suggests moderate adherence — a portion of participants struggle occasionally.';
      else                 scoreMsg = 'Your mean score of <strong>' + avg.toFixed(2) + '/8</strong> indicates low adherence — participants frequently miss doses.';

      content = scoreMsg +
        '<br><br><strong>' + pct(nHi) + '% take medications reliably</strong> (high adherence, score = 8). ' +
        '<strong>' + pct(nMd) + '% miss occasionally</strong> (medium, 6–7). ' +
        '<strong>' + pct(nLo) + '% frequently miss doses</strong> (low, &lt;6) — these participants are most at clinical risk.' +
        '<br><br><strong>MMAS-8 scoring:</strong> 8 questions, each worth 1 point. Q5 is reverse-scored. Scores below 6 are the standard clinical action threshold. The scale was developed by Dr. Donald Morisky and is one of the most widely validated adherence instruments globally.';
    }
  }

  else if (tab === 'peacs') {
    if (!peacsRecs.length) {
      content = 'No PEACS data yet. PEACS uses a 3-session longitudinal design — it takes longer to collect than MMAS-8 or MAP, but provides a richer behavioral profile of how adherence changes over time.';
    } else {
      var byPid = {};
      peacsRecs.forEach(function(r) {
        var pid = (r.patient_number||'').toString().trim().toUpperCase()||'UNASSIGNED';
        if (!byPid[pid]) byPid[pid] = {base:false,mvmt:false,strata:false};
        var dim = (r.dimension||r.peacs_dimension||'').toUpperCase();
        if (dim==='BASE'||r.base_score!==undefined) byPid[pid].base=true;
        if (dim==='MVMT'||r.mvmt_score!==undefined) byPid[pid].mvmt=true;
        if (dim==='STRATA'||r.strata_score!==undefined) byPid[pid].strata=true;
      });
      var pts      = Object.values(byPid);
      var total    = pts.length;
      var complete = pts.filter(function(p){return p.base&&p.mvmt&&p.strata;}).length;
      var baseOnly = pts.filter(function(p){return p.base&&!p.mvmt&&!p.strata;}).length;
      var pct      = function(x){return Math.round(x/total*100);};

      content = '<strong>PEACS tracks how medication behavior changes over time</strong> using three staged sessions: ' +
        'BASE (biological and structural factors, Session 1), ' +
        'MVMT (day-to-day behavioral patterns, Session 2), ' +
        'STRATA (social and contextual influences, Session 3).' +
        '<br><br>So far, <strong>' + pct(complete) + '% of your ' + total + ' participants have all three sessions complete</strong> and a full behavioral profile. ' +
        pct(baseOnly) + '% have only done Session 1 (BASE) — these participants cannot be fully classified yet.' +
        '<br><br><strong>For your thesis:</strong> A PEACS PE score requires all three sessions. Participants with only BASE data show you where they start, not how behavior evolves. Acknowledge partial profiles in your limitations section — this is expected in longitudinal adherence research and shows methodological honesty.';
    }
  }

  else if (tab === 'combined') {
    var hasMap   = allRows.some(function(r){return r.tool==='map'||r.map_q1!==undefined||r.q1!==undefined;});
    var hasMmas  = allRows.some(function(r){return r.tool!=='map'&&r.map_q1===undefined&&r.q1===undefined;});
    var hasPeacs = peacsRecs.length > 0;
    var tools    = [];
    if (hasMap)   tools.push('MAP');
    if (hasMmas)  tools.push('MMAS-8');
    if (hasPeacs) tools.push('PEACS');

    content = '<strong>You are using ' + (tools.length ? tools.join(' + ') : 'multiple instruments') + '.</strong> ' +
      'Using more than one adherence instrument is called a <em>multi-method protocol</em>.' +
      '<br><br><strong>How to explain this to your committee:</strong> Each tool captures a different aspect of adherence. ' +
      'MAP captures behavioral structure — the how and why of adherence patterns. ' +
      'MMAS-8 gives you a validated snapshot score directly comparable to hundreds of published studies. ' +
      'PEACS adds longitudinal depth — how behavior changes over time across social and biological dimensions.' +
      '<br><br><strong>In your methods section:</strong> State which instruments you used, cite each one separately, explain the sequence of administration, and confirm that participants were de-identified using numeric codes. ' +
      'The IRB statement below covers the core ethics language — insert your actual approval number (from Settings) before submitting.';
  }

  return hdr + wrap + content + '</div>';
}


// ══════════════════════════════════════════════════════════════════════════
// STUDENT SETTINGS
// Persists researcher metadata and workspace preferences to localStorage.
// Opens via ⚙ Settings button in the student workspace header.
// ══════════════════════════════════════════════════════════════════════════

window._stuSettingsCite = localStorage.getItem('atlas_stu_default_cite') || 'apa';
window._stuSettingsInst = localStorage.getItem('atlas_stu_default_instrument') || 'map';

function stuOpenSettings() {
  var modal = document.getElementById('stu-settings-modal');
  if (!modal) return;

  // Populate text fields from localStorage
  var nameEl  = document.getElementById('stu-set-name');
  var instEl  = document.getElementById('stu-set-institution');
  var irbEl   = document.getElementById('stu-set-irb');
  var titleEl = document.getElementById('stu-set-study-title');
  if (nameEl)  nameEl.value  = localStorage.getItem('atlas_stu_name')       || '';
  if (instEl)  instEl.value  = localStorage.getItem('atlas_stu_institution') || '';
  if (irbEl)   irbEl.value   = localStorage.getItem('atlas_stu_irb')         || '';
  if (titleEl) titleEl.value = localStorage.getItem('atlas_stu_study_title') || '';

  // Sync button groups to current state
  window._stuSettingsCite = localStorage.getItem('atlas_stu_default_cite') || 'apa';
  window._stuSettingsInst = localStorage.getItem('atlas_stu_default_instrument') || 'map';
  _stuSettingsSyncButtons();

  // Sync thesis mode toggle button
  var tmBtn = document.getElementById('stu-set-thesis-toggle');
  if (tmBtn) {
    var on = window._stuThesisMode;
    tmBtn.textContent        = on ? 'ON' : 'OFF';
    tmBtn.style.background   = on ? '#059669'     : 'var(--card2)';
    tmBtn.style.borderColor  = on ? '#059669'     : 'var(--border2)';
    tmBtn.style.color        = on ? '#fff'         : 'var(--muted)';
  }

  modal.showModal();
}

function _stuSettingsSyncButtons() {
  document.querySelectorAll('.stu-set-cite-btn').forEach(function(btn) {
    var isActive = btn.dataset.fmt === window._stuSettingsCite;
    btn.style.background  = isActive ? 'var(--bright)' : 'var(--card2)';
    btn.style.color       = isActive ? 'var(--ink)'    : 'var(--muted)';
    btn.style.borderColor = isActive ? 'var(--border2)': 'var(--border2)';
  });
  document.querySelectorAll('.stu-set-inst-btn').forEach(function(btn) {
    var isActive = btn.dataset.inst === window._stuSettingsInst;
    var col = btn.dataset.inst==='map'?'#059669':btn.dataset.inst==='mmas'?'#2563eb':btn.dataset.inst==='peacs'?'#7c3aed':'#0891b2';
    btn.style.background  = isActive ? col    : 'var(--card2)';
    btn.style.color       = isActive ? '#fff' : 'var(--muted)';
    btn.style.borderColor = isActive ? col    : 'var(--border2)';
  });
}

function stuSettingsCiteSelect(fmt) {
  window._stuSettingsCite = fmt;
  _stuSettingsSyncButtons();
}

function stuSettingsInstSelect(inst) {
  window._stuSettingsInst = inst;
  _stuSettingsSyncButtons();
}

function stuSettingsThesisModeToggle(btn) {
  window._stuThesisMode  = !window._stuThesisMode;
  btn.textContent        = window._stuThesisMode ? 'ON'     : 'OFF';
  btn.style.background   = window._stuThesisMode ? '#059669'     : 'var(--card2)';
  btn.style.borderColor  = window._stuThesisMode ? '#059669'     : 'var(--border2)';
  btn.style.color        = window._stuThesisMode ? '#fff'         : 'var(--muted)';
}

function stuSaveSettings() {
  // Persist text fields
  var nameVal  = (document.getElementById('stu-set-name')?.value        || '').trim();
  var instVal  = (document.getElementById('stu-set-institution')?.value  || '').trim();
  var irbVal   = (document.getElementById('stu-set-irb')?.value          || '').trim();
  var titleVal = (document.getElementById('stu-set-study-title')?.value  || '').trim();
  localStorage.setItem('atlas_stu_name',        nameVal);
  localStorage.setItem('atlas_stu_institution',  instVal);
  localStorage.setItem('atlas_stu_irb',          irbVal);
  localStorage.setItem('atlas_stu_study_title',  titleVal);

  // Persist citation format and apply to all thesis panes
  localStorage.setItem('atlas_stu_default_cite', window._stuSettingsCite);
  ['map','mmas','peacs'].forEach(function(inst) {
    window._stuCiteFmt[inst] = window._stuSettingsCite;
    stuSelectCiteFmt(inst, window._stuSettingsCite);
  });

  // Persist default tab
  localStorage.setItem('atlas_stu_default_instrument', window._stuSettingsInst);

  // Persist and apply thesis mode
  localStorage.setItem('atlas_stu_thesis_mode', String(window._stuThesisMode));
  _stuApplyThesisMode();
  _stuSyncThesisModeButton();

  // Rebuild combined (picks up new IRB number)
  stuBuildCombined();
  _stuPatchIRBStatement();

  // Switch to selected default tab
  var tab = window._stuSettingsInst || 'map';
  stuSwitchThesisTab(tab);

  // Open the thesis body if it was collapsed
  var body = document.getElementById('stu-mod-thesis-body');
  if (body && body.style.display === 'none') body.style.display = 'block';

  document.getElementById('stu-settings-modal').close();
}

function _stuPatchIRBStatement() {
  // Replaces the placeholder IRB text with the stored IRB number
  var irbNum = localStorage.getItem('atlas_stu_irb') || '';
  if (!irbNum) return;
  var irbEl = document.getElementById('stu-thesis-irb');
  if (!irbEl) return;
  var current = irbEl.textContent || '';
  if (current.includes('[IRB approval number')) {
    irbEl.textContent = current.replace(
      '[IRB approval number and institution to be inserted by investigator.]',
      'This study was approved under ethics protocol number ' + irbNum + '.'
    );
  }
}

function stuLoadSettings() {
  // Apply citation format
  var defCite = localStorage.getItem('atlas_stu_default_cite');
  if (defCite) {
    window._stuSettingsCite = defCite;
    ['map','mmas','peacs'].forEach(function(inst) {
      window._stuCiteFmt[inst] = defCite;
      stuSelectCiteFmt(inst, defCite);
    });
  }

  // Apply default tab
  var defInst = localStorage.getItem('atlas_stu_default_instrument');
  if (defInst) {
    window._stuSettingsInst = defInst;
    stuSwitchThesisTab(defInst);
  }

  // Apply thesis mode
  window._stuThesisMode = (localStorage.getItem('atlas_stu_thesis_mode') === 'true');
  _stuSyncThesisModeButton();
  if (window._stuThesisMode) _stuApplyThesisMode();

  // Apply IRB patch if applicable
  _stuPatchIRBStatement();
}

// ── S1: Student Setup Wizard ────────────────────────────────────────────────
const _STU_WIZ_STATE = { study_type: null, instruments: [], n: null, inst: '', irb: '', advisor: '' };

function stuWizShow() {
  if (localStorage.getItem('_stu_wizard_done')) return;
  const el = document.getElementById('stu-wizard-overlay');
  if (!el) return;
  el.style.display = 'flex';
}

function stuWizSelect(btn, field) {
  const pane = btn.closest('.stu-wiz-pane');
  pane.querySelectorAll('.stu-wiz-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _STU_WIZ_STATE[field] = btn.dataset.value;
  const nextBtn = pane.querySelector('.stu-wiz-next');
  if (nextBtn) nextBtn.disabled = false;
}

function stuWizNext(step) {
  if (step === 1) {
    if (!_STU_WIZ_STATE.study_type) return;
    document.getElementById('stu-wiz-s1').style.display = 'none';
    document.getElementById('stu-wiz-s2').style.display = 'block';
    _stuWizUpdateProgress(2);
  } else if (step === 2) {
    const checked = [...document.querySelectorAll('.stu-wiz-checks input:checked')].map(i => i.value);
    _STU_WIZ_STATE.instruments = checked;
    _STU_WIZ_STATE.n = parseInt(document.getElementById('stu-wiz-n').value) || null;
    document.getElementById('stu-wiz-s2').style.display = 'none';
    document.getElementById('stu-wiz-s3').style.display = 'block';
    _stuWizUpdateProgress(3);
  }
}

function stuWizBack(step) {
  if (step === 2) {
    document.getElementById('stu-wiz-s2').style.display = 'none';
    document.getElementById('stu-wiz-s1').style.display = 'block';
    _stuWizUpdateProgress(1);
  } else if (step === 3) {
    document.getElementById('stu-wiz-s3').style.display = 'none';
    document.getElementById('stu-wiz-s2').style.display = 'block';
    _stuWizUpdateProgress(2);
  }
}

function _stuWizUpdateProgress(activeStep) {
  document.querySelectorAll('.stu-wiz-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.toggle('active', n === activeStep);
    s.classList.toggle('done', n < activeStep);
  });
}

function stuWizComplete() {
  _STU_WIZ_STATE.inst = document.getElementById('stu-wiz-inst').value.trim();
  _STU_WIZ_STATE.irb = document.getElementById('stu-wiz-irb').value.trim();
  _STU_WIZ_STATE.advisor = document.getElementById('stu-wiz-advisor').value.trim();
  localStorage.setItem('_stu_wizard_done', '1');
  localStorage.setItem('_stu_wizard_state', JSON.stringify(_STU_WIZ_STATE));
  const el = document.getElementById('stu-wizard-overlay');
  if (el) el.style.display = 'none';
  if (typeof _stuRenderCapMeter === 'function') _stuRenderCapMeter();
  // Surface IRB in workspace header if provided
  if (_STU_WIZ_STATE.irb) {
    const hdr = document.getElementById('stu-irb-display');
    if (hdr) { hdr.textContent = _STU_WIZ_STATE.irb; hdr.style.display = 'inline'; }
  }
}

// Wizard is triggered by _stuThesisRefreshFromStats (called only after student workspace is confirmed active)
// Do NOT auto-fire here — this script loads for all roles.

// ── S2: Export Cap Meter ──────────────────────────────────────────────────
function _stuRenderCapMeter() {
  const wrap = document.getElementById('stu-cap-meter-wrap');
  if (!wrap) return;
  // Try to read cap values from existing window state or sessionStorage
  const used = parseInt(window._stuExportUsed || sessionStorage.getItem('_stu_export_used') || '0');
  const total = parseInt(window._stuExportCap || sessionStorage.getItem('_stu_export_cap') || '100');
  if (!total) return;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const fill = document.getElementById('stu-cap-bar-fill');
  const txt = document.getElementById('stu-cap-text');
  if (fill) {
    fill.style.width = pct + '%';
    fill.className = 'stu-cap-bar-fill' + (pct >= 90 ? ' critical' : pct >= 70 ? ' warn' : '');
  }
  if (txt) txt.textContent = used + ' / ' + total;
  wrap.style.display = 'flex';
}
window._stuRenderCapMeter = _stuRenderCapMeter;

// ── S4: IRB Appendix / Thesis Appendix Generator ──────────────────────────
function _stuGenerateAppendixPDF() {
  const state = JSON.parse(localStorage.getItem('_stu_wizard_state') || '{}');
  const instruments = state.instruments || ['map','mmas','peacs'];
  const pi = state.advisor || 'Investigator';
  const inst = state.inst || 'Institution';
  const irb = state.irb || '[IRB Protocol Not Set]';
  const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  const citationBlock = instruments.map(ins => {
    const c = (_STU_CITATIONS || {})[ins];
    if (!c) return '';
    return `<div class="ax-cite-item"><span class="ax-cite-ins">${ins.toUpperCase()}</span><p class="ax-cite-apa">${c.apa || c}</p></div>`;
  }).join('');

  const methodsBlock = instruments.map(ins => {
    const m = (_STU_METHODS || {})[ins];
    if (!m) return '';
    return `<div class="ax-methods-item"><h4>${ins.toUpperCase()} — Methods</h4><p>${m}</p></div>`;
  }).join('');

  const psychometrics = `
    <table class="ax-table">
      <thead><tr><th>Instrument</th><th>Items</th><th>Cronbach's α</th><th>Test-Retest ICC</th><th>Validity</th></tr></thead>
      <tbody>
        <tr><td>MAP</td><td>8 domains</td><td>Platform-estimated (validation study in preparation)</td><td>Platform-estimated</td><td>Convergent, criterion</td></tr>
        <tr><td>MMAS-8</td><td>8 items</td><td>0.83 (Morisky et al., 2008)</td><td>0.89 (Morisky et al., 2008)</td><td>Criterion, concurrent</td></tr>
        <tr><td>PEACS</td><td>Longitudinal composite</td><td>Platform-estimated (validation study in preparation)</td><td>Platform-estimated</td><td>Predictive, construct</td></tr>
      </tbody>
    </table>
    <p style="font-size:10pt;color:#555;margin-top:6px;"><em>Platform-estimated psychometric properties reflect internal pilot data and have not yet been independently published. Cite Morisky et al. (2008) for MMAS-8 psychometrics.</em></p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ATLAS Appendix — ${inst}</title>
  <style>
    body{font-family:'Times New Roman',serif;font-size:12pt;max-width:7in;margin:1in auto;color:#111;line-height:1.7}
    h1{font-size:16pt;border-bottom:2px solid #333;padding-bottom:.3rem;margin-bottom:1rem}
    h2{font-size:14pt;margin-top:2rem;margin-bottom:.5rem}
    h3{font-size:13pt;margin-top:1.5rem}
    h4{font-size:12pt;margin-bottom:.3rem}
    .ax-meta{font-size:10pt;color:#555;margin-bottom:1.5rem}
    .ax-meta span{margin-right:2rem}
    .ax-cite-item{margin-bottom:1rem;padding-left:1.5rem;text-indent:-1.5rem}
    .ax-cite-ins{font-weight:bold;font-family:monospace;font-size:10pt;display:block;margin-bottom:.2rem}
    .ax-cite-apa{margin:0;line-height:1.6}
    .ax-methods-item{margin-bottom:1.2rem}
    .ax-table{width:100%;border-collapse:collapse;font-size:10pt;margin:1rem 0}
    .ax-table th{background:#eee;border:1px solid #ccc;padding:.4rem .6rem;text-align:left}
    .ax-table td{border:1px solid #ccc;padding:.35rem .6rem}
    .ax-security{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;padding:1rem;font-size:10pt;line-height:1.6}
    .ax-sig{margin-top:3rem;display:grid;grid-template-columns:1fr 1fr;gap:2rem}
    .ax-sig-block{border-top:1px solid #333;padding-top:.3rem;font-size:10pt}
    @media print{body{margin:.75in}h2{page-break-before:always}h2:first-of-type{page-break-before:avoid}}
  </style></head><body>
  <h1>ATLAS Research Appendix</h1>
  <div class="ax-meta">
    <span><b>Principal Investigator:</b> ${pi}</span>
    <span><b>Institution:</b> ${inst}</span><br>
    <span><b>IRB Protocol:</b> ${irb}</span>
    <span><b>Generated:</b> ${today}</span>
    <span><b>ATLAS Version:</b> v8.9.3</span>
  </div>

  <h2>A. Instrument Citations</h2>
  <p>The following validated instruments were administered using the ATLAS platform (Adherence Tracking &amp; Longitudinal Assessment System, adherence.cc).</p>
  ${citationBlock || '<p>No instruments selected. Run study setup wizard to configure.</p>'}

  <h2>B. Methods Section</h2>
  <p>The following methodology text is provided for inclusion in the Methods section of a thesis, dissertation, or grant application.</p>
  ${methodsBlock || '<p>No methodology text available for selected instruments.</p>'}

  <h2>C. Psychometric Properties</h2>
  ${psychometrics}

  <h2>D. Data Security Summary</h2>
  <div class="ax-security">
    <b>Platform:</b> ATLAS (Adherence Tracking &amp; Longitudinal Assessment System) v8.9.3<br>
    <b>Data storage:</b> Firebase Realtime Database (Google Cloud, US-Central) with UAE data residency option via AWS DynamoDB<br>
    <b>Authentication:</b> Magic Link (OTP-based, no persistent passwords); anonymous assessment mode available<br>
    <b>Encryption:</b> TLS 1.3 in transit; AES-256 at rest<br>
    <b>Identifiers:</b> Patient numbers only; no PHI collected unless explicitly added by researcher<br>
    <b>Retention:</b> 7 years post-study completion (NIH/NSF standard); configurable per funding source<br>
    <b>HIPAA:</b> BAA available upon request; compliant data handling for covered entities<br>
    <b>Export:</b> Blinded CSV export with deterministic de-identification hash (djb2, workspace-scoped)
  </div>

  <h2>E. Signature Block</h2>
  <div class="ax-sig">
    <div class="ax-sig-block">Principal Investigator<br><br>${pi}<br><i>${inst}</i></div>
    <div class="ax-sig-block">Date<br><br>${today}<br>&nbsp;</div>
    <div class="ax-sig-block">IRB Protocol<br><br>${irb}<br>&nbsp;</div>
    <div class="ax-sig-block">ATLAS Workspace Version<br><br>v8.9.3 — Generated ${today}<br>&nbsp;</div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
}
window.stuGenerateAppendixPDF = _stuGenerateAppendixPDF;

// ── S5: Pub license explainer gate ───────────────────────────────────────
function pubLicAdvanceFromExplainer() {
  const s0 = document.getElementById('pub-lic-step-0');
  const s1 = document.getElementById('pub-lic-s1-upload') || document.getElementById('pub-lic-step-1');
  if (s0) s0.style.display = 'none';
  if (s1) s1.style.display = 'block';
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE 13 — STUDY REGISTRY
// Shows ATLAS Study ID, pre-registration status, linked record count, and
// a sequential analysis chart. Renders a registration form if not yet in registry.
// ══════════════════════════════════════════════════════════════════════════

window._stuRegistryOutcome = 'mmas'; // default outcome for sequential chart

function stuInitRegistry(wrId) {
  var wrap = document.getElementById(wrId || 'stu-registry-content');
  if (!wrap) return;

  var db  = (typeof database !== 'undefined') ? database : null;
  var wk  = (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null;

  if (!db || !wk || wk === 'EXPLORER') {
    wrap.innerHTML = '<div style="padding:18px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:var(--dim);">Sign in with a workspace key to access the Study Registry.</div>';
    return;
  }

  wrap.innerHTML = '<div style="padding:14px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:var(--dim);">Loading registry…</div>';

  db.ref('research_studies').orderByChild('workspace_key').equalTo(wk).once('value', function(snap) {
    var studies = [];
    if (snap.exists()) {
      snap.forEach(function(c) { studies.push(Object.assign({ _key: c.key }, c.val())); });
    }

    if (!studies.length) {
      _stuRenderRegistryForm(wrap, db, wk);
    } else {
      _stuRenderRegistryPanel(wrap, db, wk, studies[0]);
    }
  }, function() {
    wrap.innerHTML = '<div style="padding:14px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:#dc2626;">Unable to load registry. Check your connection.</div>';
  });
}

function _stuRenderRegistryPanel(wrap, db, wk, study) {
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mmasRecs = allRows.filter(function(r){ return r.tool !== 'map' && r.map_q1 === undefined; });
  var mapRecs  = allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
  var linkedCount = allRows.filter(function(r){ return r.study_id === study.atlas_id; }).length || allRows.length;

  var preregDate = study.prereg_locked_at ? new Date(study.prereg_locked_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : null;
  var statusColor = study.status === 'published' ? '#2563eb' : study.status === 'active' ? '#059669' : '#94a3b8';
  var statusLabel = (study.status || 'planning').replace(/^\w/, function(c){return c.toUpperCase();});

  // Sequential analysis data
  var seqRecs = (mmasRecs.length >= 3 ? mmasRecs : mapRecs).slice().sort(function(a,b){
    return (a.timestamp||a.created_at||0) - (b.timestamp||b.created_at||0);
  });

  // Update header badge
  var badge = document.getElementById('stu-registry-badge');
  if (badge) { badge.textContent = study.atlas_id; badge.style.display = ''; }

  var h = '<div>';

  // ── ATLAS ID card ─────────────────────────────────────────────────────────
  h += '<div style="display:flex;align-items:center;gap:10px;background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.20);border-radius:10px;padding:14px 16px;margin-bottom:14px;">';
  h += '<div style="flex:1;">';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.18em;text-transform:uppercase;color:#059669;margin-bottom:4px;">ATLAS Study ID</div>';
  h += '<div id="stu-reg-atlas-id" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.28rem;font-weight:700;color:#059669;letter-spacing:0.08em;cursor:pointer;" onclick="stuCopyAtlasId()" title="Click to copy">' + (study.atlas_id||'—') + '</div>';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--dim);margin-top:3px;">' + (study.title || study.study_title || 'Untitled Study') + '</div>';
  h += '</div>';
  h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;background:' + statusColor + '18;border:1px solid ' + statusColor + '44;color:' + statusColor + ';border-radius:20px;padding:3px 10px;">' + statusLabel + '</div>';
  if (preregDate) {
    h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;color:#059669;">🔒 Pre-reg: ' + preregDate + '</div>';
  } else {
    h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;color:#d97706;">⚠ No pre-registration lock</div>';
  }
  h += '</div></div>';

  // ── Stats strip ───────────────────────────────────────────────────────────
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">';
  var _stat = function(label, val, color) {
    return '<div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid ' + color + ';border-radius:8px;padding:10px 12px;text-align:center;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.44rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.3rem;font-weight:700;color:' + color + ';line-height:1;">' + val + '</div>'
      + '</div>';
  };
  h += _stat('Linked Records', linkedCount, '#059669');
  h += _stat('MMAS-8', mmasRecs.length, '#2563eb');
  h += _stat('MAP', mapRecs.length, '#7c3aed');
  h += '</div>';

  // ── Sequential analysis chart ─────────────────────────────────────────────
  if (seqRecs.length >= 3) {
    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Sequential Analysis — Cumulative Mean</div>';
    h += _stuBuildSeqChart(seqRecs);
    h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;color:var(--dim);margin-top:5px;">Stable plateau = no early-stopping signal. Drift = review enrollment.</div>';
    h += '</div>';
  }

  // ── Conditions & PI ───────────────────────────────────────────────────────
  if (study.conditions || study.pi || study.institution) {
    h += '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:11px 14px;margin-bottom:14px;">';
    if (study.pi) h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;color:var(--muted);margin-bottom:4px;"><span style="color:var(--dim);"><span data-tip="Principal Investigator — researcher managing a study workspace">PI</span>:</span> ' + study.pi + (study.institution ? ' · ' + study.institution : '') + '</div>';
    if (study.conditions) {
      var conds = Array.isArray(study.conditions) ? study.conditions : study.conditions.split(',');
      h += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">';
      conds.forEach(function(c) {
        h += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.20);color:#059669;border-radius:12px;padding:2px 8px;">' + c.toString().trim() + '</span>';
      });
      h += '</div>';
    }
    h += '</div>';
  }

  // ── Copy ID helper ────────────────────────────────────────────────────────
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--dim);background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;">';
  h += '<span>Add this ATLAS ID to every assessment record to link data to this study.</span>';
  h += '<button onclick="stuCopyAtlasId()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:var(--card);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;white-space:nowrap;margin-left:8px;">Copy ID</button>';
  h += '</div>';

  h += '</div>';
  wrap.innerHTML = h;

  // Store atlas_id globally for copy function and lock session to this study
  window._stuAtlasId = study.atlas_id;
  if (typeof setActiveStudy === 'function') {
    setActiveStudy(study.atlas_id, study.title || study.study_title || '');
  }
}

function _stuBuildSeqChart(recs) {
  var W = 460, H = 80, pad = { l: 40, r: 10, t: 8, b: 20 };
  var iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  var n = recs.length;

  // Compute cumulative means (MMAS score or PE value)
  var cumMeans = [];
  var runSum = 0;
  recs.forEach(function(r, i) {
    var v = parseFloat(r.score) || parseFloat(r.pe) || 0;
    runSum += v;
    cumMeans.push(runSum / (i + 1));
  });

  var minV = Math.min.apply(null, cumMeans), maxV = Math.max.apply(null, cumMeans);
  var range = maxV - minV || 1;
  var xStep = iW / (n - 1 || 1);

  var px = function(i) { return pad.l + i * xStep; };
  var py = function(v) { return pad.t + iH - ((v - minV) / range) * iH; };

  var pts = cumMeans.map(function(v, i) { return px(i) + ',' + py(v); }).join(' ');

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:80px;display:block;">'
    // axes
    + '<line x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (pad.t+iH) + '" stroke="var(--border2)" stroke-width="1"/>'
    + '<line x1="' + pad.l + '" y1="' + (pad.t+iH) + '" x2="' + (W-pad.r) + '" y2="' + (pad.t+iH) + '" stroke="var(--border2)" stroke-width="1"/>'
    // y-axis labels
    + '<text x="' + (pad.l-4) + '" y="' + (pad.t+4) + '" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="var(--dim)">' + maxV.toFixed(1) + '</text>'
    + '<text x="' + (pad.l-4) + '" y="' + (pad.t+iH) + '" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="var(--dim)">' + minV.toFixed(1) + '</text>'
    // line
    + '<polyline points="' + pts + '" fill="none" stroke="#059669" stroke-width="2" stroke-linejoin="round"/>'
    // dot at last point
    + '<circle cx="' + px(n-1) + '" cy="' + py(cumMeans[n-1]) + '" r="3" fill="#059669"/>'
    + '</svg>';
  return svg;
}

function _stuRenderRegistryForm(wrap, db, wk) {
  var irb     = localStorage.getItem('atlas_stu_irb')         || '';
  var title   = localStorage.getItem('atlas_stu_study_title') || '';
  var piName  = localStorage.getItem('atlas_stu_name')        || '';
  var instit  = localStorage.getItem('atlas_stu_institution') || '';

  var h = '<div>';
  h += '<div style="background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.18);border-radius:9px;padding:13px 15px;margin-bottom:16px;">';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;font-weight:700;color:#059669;margin-bottom:4px;">Register Your Study</div>';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);line-height:1.6;">Pre-registration generates a permanent ATLAS Study ID and timestamps your hypothesis — a key bias-reduction requirement for meta-analysis inclusion.</div>';
  h += '</div>';

  h += '<div style="display:grid;gap:10px;margin-bottom:14px;">';
  h += _stuFormRow('Study Title', 'stu-reg-title', title, 'e.g. Medication Adherence in Hypertension');
  h += _stuFormRow('Principal Investigator', 'stu-reg-pi', piName, 'Your name');
  h += _stuFormRow('Institution', 'stu-reg-inst', instit, 'University / Hospital');
  h += _stuFormRow('IRB / Ethics Number', 'stu-reg-irb', irb, 'e.g. IRB-2026-0042');
  h += _stuFormRow('Target N', 'stu-reg-n', '', 'e.g. 80', 'number');
  h += '</div>';

  h += '<div style="margin-bottom:12px;">';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Primary Hypothesis</div>';
  h += '<textarea id="stu-reg-hypothesis" rows="3" placeholder="State your primary hypothesis. This will be timestamp-locked on submission." style="width:100%;padding:8px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:7px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>';
  h += '</div>';

  h += '<div style="margin-bottom:14px;">';
  h += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Instruments</div>';
  h += '<div style="display:flex;gap:6px;">';
  ['MAP','MMAS-8','PEACS'].forEach(function(ins) {
    h += '<label style="display:flex;align-items:center;gap:6px;font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:6px 10px;">'
      + '<input type="checkbox" class="stu-reg-ins-chk" value="' + ins + '" checked style="accent-color:#059669;"> ' + ins + '</label>';
  });
  h += '</div></div>';

  h += '<div id="stu-reg-error" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:#dc2626;margin-bottom:8px;"></div>';
  h += '<button onclick="stuSubmitRegistration()" style="width:100%;padding:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:#059669;color:#fff;border:none;border-radius:7px;cursor:pointer;">Register Study &amp; Generate ATLAS ID</button>';
  h += '</div>';
  wrap.innerHTML = h;
}

function _stuFormRow(label, id, val, placeholder, type) {
  return '<div>'
    + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">' + label + '</div>'
    + '<input id="' + id + '" type="' + (type||'text') + '" value="' + (val||'').replace(/"/g,'&quot;') + '" placeholder="' + placeholder + '" style="width:100%;padding:7px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:6px;outline:none;box-sizing:border-box;">'
    + '</div>';
}

function stuSubmitRegistration() {
  var db  = (typeof database !== 'undefined') ? database : null;
  var wk  = (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null;
  if (!db || !wk) return;

  var title = (document.getElementById('stu-reg-title')?.value || '').trim();
  var pi    = (document.getElementById('stu-reg-pi')?.value    || '').trim();
  var inst  = (document.getElementById('stu-reg-inst')?.value  || '').trim();
  var irb   = (document.getElementById('stu-reg-irb')?.value   || '').trim();
  var n     = parseInt(document.getElementById('stu-reg-n')?.value) || null;
  var hyp   = (document.getElementById('stu-reg-hypothesis')?.value || '').trim();
  var errEl = document.getElementById('stu-reg-error');

  if (!title) { if (errEl) { errEl.textContent='Study title is required.'; errEl.style.display=''; } return; }
  if (errEl) errEl.style.display = 'none';

  var ins = [];
  document.querySelectorAll('.stu-reg-ins-chk:checked').forEach(function(c){ ins.push(c.value); });

  // Generate ATLAS-YYYY-XXXX
  var yr = new Date().getFullYear();
  var seq = Math.floor(1000 + Math.random() * 9000);
  var atlasId = 'ATLAS-' + yr + '-' + seq;

  // Verify uniqueness, then save
  db.ref('research_studies').orderByChild('atlas_id').equalTo(atlasId).once('value', function(snap) {
    if (snap.exists()) {
      seq = Math.floor(1000 + Math.random() * 9000);
      atlasId = 'ATLAS-' + yr + '-' + seq;
    }
    var record = {
      atlas_id:      atlasId,
      title:         title,
      pi:            pi,
      institution:   inst,
      irb:           irb,
      target_n:      n,
      hypothesis:    hyp,
      instruments:   ins,
      workspace_key: wk,
      status:        'planning',
      conditions:    [],
      created_at:    Date.now(),
      prereg_locked_at: Date.now()
    };
    db.ref('research_studies').push(record, function(err) {
      if (err) {
        if (errEl) { errEl.textContent='Save failed. Check connection.'; errEl.style.display=''; }
      } else {
        stuInitRegistry();
      }
    });
  });
}

function stuCopyAtlasId() {
  var id = window._stuAtlasId || (document.getElementById('stu-reg-atlas-id') || {}).textContent || '';
  if (!id) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(id).then(function() {
      var el = document.getElementById('stu-reg-atlas-id');
      if (el) { var old=el.textContent; el.textContent='Copied!'; setTimeout(function(){el.textContent=old;},1400); }
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE 14 — PREDICTOR ANALYSIS
// Simple OLS regression: outcome (MMAS-8 score or MAP PE) vs predictors
// (age, gender, condition, country). APA 7th edition output.
// ══════════════════════════════════════════════════════════════════════════

window._stuPredOutcome = 'mmas';

function stuPredSelectOutcome(out) {
  window._stuPredOutcome = out;
  document.querySelectorAll('.stu-pred-out-btn').forEach(function(btn) {
    var active = btn.dataset.out === out;
    btn.style.background   = active ? (out==='mmas'?'#2563eb':'#7c3aed') : 'var(--card2)';
    btn.style.color        = active ? '#fff'   : 'var(--muted)';
    btn.style.borderColor  = active ? (out==='mmas'?'#2563eb':'#7c3aed') : 'var(--border2)';
  });
}

function stuInitPredictor() {
  var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mmasRows = allRows.filter(function(r){ return r.tool !== 'map' && r.map_q1 === undefined; });
  var mapRows  = allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
  var n = Math.max(mmasRows.length, mapRows.length);

  var gate    = document.getElementById('stu-predictor-gate');
  var controls= document.getElementById('stu-predictor-controls');
  var badge   = document.getElementById('stu-predictor-badge');

  if (n < 10) {
    if (gate)     { gate.style.display = ''; }
    if (controls) { controls.style.opacity = '0.4'; controls.style.pointerEvents = 'none'; }
    if (badge)    { badge.textContent = 'Need \u2265 10 records'; badge.style.display = ''; }
  } else {
    if (gate)     { gate.style.display = 'none'; }
    if (controls) { controls.style.opacity = ''; controls.style.pointerEvents = ''; }
    if (badge)    { badge.textContent = n + ' records'; badge.style.display = ''; }
  }
}

function stuRunPredictor() {
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mmasRows = allRows.filter(function(r){ return r.tool !== 'map' && r.map_q1 === undefined; });
  var mapRows  = allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
  var outcome  = window._stuPredOutcome || 'mmas';
  var rows     = outcome === 'map' ? mapRows : mmasRows;

  var resWrap = document.getElementById('stu-predictor-results');
  var tblWrap = document.getElementById('stu-predictor-table-wrap');
  var apaWrap = document.getElementById('stu-predictor-apa');

  if (rows.length < 10) {
    if (tblWrap) tblWrap.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:#dc2626;padding:10px 0;">Not enough records for this outcome. Switch outcome or collect more data.</div>';
    if (resWrap) resWrap.style.display = '';
    return;
  }

  // Extract y values
  var Y = rows.map(function(r) {
    if (outcome === 'map') {
      var a = parseFloat(r.arch_score) || ((parseFloat(r.q2||0)+parseFloat(r.q3||0)+parseFloat(r.q6||0))/3);
      var e = parseFloat(r.exec_score) || ((parseFloat(r.q1||0)+parseFloat(r.q5||0)+parseFloat(r.q8||0))/3);
      var c = parseFloat(r.ctx_score) || Math.max(0.5, 0.5 + 0.5 * ((parseFloat(r.q4||0) + parseFloat(r.q7||0)) / 2));
      return Math.pow(Math.max(0, a*e*c), 1/3);
    }
    return parseFloat(r.score) || 0;
  });

  var n      = rows.length;
  var yMean  = Y.reduce(function(a,b){return a+b;},0)/n;
  var ySD    = Math.sqrt(Y.reduce(function(s,y){return s+Math.pow(y-yMean,2);},0)/(n-1));
  var SStot  = Y.reduce(function(s,y){return s+Math.pow(y-yMean,2);},0);

  var useAge       = document.getElementById('stu-pred-age')?.checked;
  var useGender    = document.getElementById('stu-pred-gender')?.checked;
  var useCondition = document.getElementById('stu-pred-condition')?.checked;
  var useCountry   = document.getElementById('stu-pred-country')?.checked;

  var predictors = [];
  if (useAge && rows.some(function(r){return r.age||r.patient_age;})) {
    predictors.push({ label: 'Age', type: 'continuous', vals: rows.map(function(r){ return parseFloat(r.age||r.patient_age)||NaN; }) });
  }
  if (useGender && rows.some(function(r){return r.gender||r.patient_gender;})) {
    var genderVals = rows.map(function(r){
      var g = (r.gender||r.patient_gender||'').toString().toLowerCase().trim();
      return g === 'female' || g === 'f' ? 1 : g === 'male' || g === 'm' ? 0 : NaN;
    });
    if (genderVals.some(function(v){return !isNaN(v);})) {
      predictors.push({ label: 'Gender (female=1)', type: 'binary', vals: genderVals });
    }
  }
  if (useCondition && rows.some(function(r){return r.condition||r.diagnosis;})) {
    var conds = rows.map(function(r){ return (r.condition||r.diagnosis||'').toString().trim(); });
    var uniqueConds = conds.filter(function(v,i,a){ return v && a.indexOf(v)===i; });
    if (uniqueConds.length >= 2 && uniqueConds.length <= 8) {
      var refCond = uniqueConds[0];
      predictors.push({ label: 'Condition (' + uniqueConds.slice(1).join('/') + ' vs ref: ' + refCond + ')', type: 'categorical',
        vals: conds.map(function(c){ return c === refCond ? 0 : c ? 1 : NaN; }) });
    }
  }
  if (useCountry && rows.some(function(r){return r.country;})) {
    var countries = rows.map(function(r){ return (r.country||'').toString().trim(); });
    var uniqueCtry = countries.filter(function(v,i,a){ return v && a.indexOf(v)===i; });
    if (uniqueCtry.length >= 2 && uniqueCtry.length <= 10) {
      predictors.push({ label: 'Country (' + uniqueCtry.slice(1).join('/') + ' vs ref: ' + uniqueCtry[0] + ')', type: 'categorical',
        vals: countries.map(function(c){ return c === uniqueCtry[0] ? 0 : c ? 1 : NaN; }) });
    }
  }

  if (!predictors.length) {
    if (tblWrap) tblWrap.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:#d97706;padding:10px 0;">No predictor data found. Ensure your records include age, gender, and/or condition fields.</div>';
    if (resWrap) resWrap.style.display = '';
    return;
  }

  // OLS bivariate for each predictor
  var results = predictors.map(function(pred) {
    // Pair valid rows only
    var pairs = [];
    pred.vals.forEach(function(x, i) { if (!isNaN(x) && !isNaN(Y[i])) pairs.push({ x: x, y: Y[i] }); });
    var m = pairs.length;
    if (m < 5) return { label: pred.label, m: m, skipped: true };

    var xMean = pairs.reduce(function(s,p){return s+p.x;},0)/m;
    var Sxx   = pairs.reduce(function(s,p){return s+Math.pow(p.x-xMean,2);},0);
    var Sxy   = pairs.reduce(function(s,p){return s+(p.x-xMean)*(p.y-(pairs.reduce(function(a,b){return a+b.y;},0)/m));},0);
    if (Sxx === 0) return { label: pred.label, m: m, skipped: true };

    var beta   = Sxy / Sxx;
    var yMeanP = pairs.reduce(function(s,p){return s+p.y;},0)/m;
    var alpha  = yMeanP - beta * xMean;
    var SSres  = pairs.reduce(function(s,p){return s+Math.pow(p.y-(alpha+beta*p.x),2);},0);
    var MSres  = SSres / (m - 2);
    var SE     = MSres > 0 ? Math.sqrt(MSres / Sxx) : 0;
    var t      = SE > 0 ? beta / SE : Infinity;
    var r2     = Sxx > 0 ? 1 - SSres / (pairs.reduce(function(s,p){var ym=pairs.reduce(function(a,b){return a+b.y;},0)/m; return s+Math.pow(p.y-ym,2);},0)||1) : 0;
    var r      = Math.sqrt(Math.max(0, r2)) * (beta >= 0 ? 1 : -1);

    // p-value (two-tailed, normal approximation — acceptable for df>20; conservative note added)
    var absT = Math.abs(t);
    var pStr = absT > 3.29 ? '< .001' : absT > 2.58 ? '< .01' : absT > 1.96 ? '< .05' : '= ' + (2*(1-_stuNormCDF(absT))).toFixed(3).replace('0.','.') ;

    return { label: pred.label, m: m, beta: beta, SE: SE, t: t, pStr: pStr, r2: r2, r: r, skipped: false };
  });

  var outcomeLabel = outcome === 'map' ? 'MAP PE Score' : 'MMAS-8 Score';

  // Build results table
  var tbl = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;">';
  tbl += '<thead><tr style="border-bottom:2px solid var(--border);">';
  ['Predictor','n','β','SE','t','p','r²','r'].forEach(function(h) {
    tbl += '<th style="padding:6px 8px;text-align:' + (h==='Predictor'?'left':'center') + ';color:var(--dim);font-weight:600;font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;">' + h + '</th>';
  });
  tbl += '</tr></thead><tbody>';
  results.forEach(function(res, i) {
    var row = i % 2 === 0 ? 'background:var(--card2);' : '';
    if (res.skipped) {
      tbl += '<tr style="' + row + '"><td style="padding:6px 8px;color:var(--muted);">' + res.label + '</td><td colspan="7" style="padding:6px 8px;text-align:center;color:var(--dim);">Insufficient valid data (n=' + res.m + ')</td></tr>';
      return;
    }
    var sig = res.pStr.indexOf('= ') === -1 ? 'color:#059669;font-weight:700;' : 'color:var(--muted);';
    tbl += '<tr style="' + row + '">'
      + '<td style="padding:6px 8px;color:var(--bright);">' + res.label + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--muted);">' + res.m + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--bright);">' + res.beta.toFixed(3) + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--dim);">' + res.SE.toFixed(3) + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--dim);">' + res.t.toFixed(2) + '</td>'
      + '<td style="padding:6px 8px;text-align:center;' + sig + '">' + res.pStr + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--dim);">' + res.r2.toFixed(3) + '</td>'
      + '<td style="padding:6px 8px;text-align:center;color:var(--dim);">' + res.r.toFixed(3) + '</td>'
      + '</tr>';
  });
  tbl += '</tbody></table></div>';
  tbl += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--dim);margin-top:5px;">β = unstandardized coefficient. p-values use two-tailed normal approximation. Each predictor tested independently (bivariate OLS).</div>';

  if (tblWrap) tblWrap.innerHTML = tbl;

  // Build APA paragraph
  var sigResults = results.filter(function(r){ return !r.skipped && r.pStr.indexOf('= ') === -1; });
  var nsResults  = results.filter(function(r){ return !r.skipped && r.pStr.indexOf('= ') > -1; });

  var apa = 'A series of bivariate ordinary least squares (OLS) regressions were conducted to examine predictors of ' + outcomeLabel + ' (N\u2009=\u2009' + n + ').';
  if (sigResults.length) {
    apa += ' Significant predictors included: ';
    apa += sigResults.map(function(r) {
      return r.label + ' (\u03b2\u2009=\u2009' + r.beta.toFixed(3) + ', SE\u2009=\u2009' + r.SE.toFixed(3) + ', t\u2009=\u2009' + r.t.toFixed(2) + ', p\u2009' + r.pStr + ', r\u00b2\u2009=\u2009' + r.r2.toFixed(3) + ')';
    }).join('; ') + '.';
  }
  if (nsResults.length) {
    apa += ' The following predictors were not significantly associated with ' + outcomeLabel + ': ';
    apa += nsResults.map(function(r) {
      return r.label + ' (\u03b2\u2009=\u2009' + r.beta.toFixed(3) + ', p\u2009' + r.pStr + ')';
    }).join('; ') + '.';
  }
  apa += ' Each predictor was tested independently; a multivariate model controlling for all predictors simultaneously is recommended as a follow-up analysis.';

  if (apaWrap) apaWrap.textContent = apa;
  window._stuPredictorAPA = apa;
  if (resWrap) resWrap.style.display = '';
}

function _stuNormCDF(z) {
  // Abramowitz & Stegun approximation of Φ(z) for z ≥ 0
  var t = 1 / (1 + 0.2316419 * z);
  var poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-z * z / 2) * poly;
}

function stuCopyPredictorAPA() {
  var txt = window._stuPredictorAPA || '';
  if (!txt) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(function() {
      var btn = document.querySelector('[onclick="stuCopyPredictorAPA()"]');
      if (btn) { btn.textContent = 'Copied!'; setTimeout(function(){ btn.textContent = 'Copy APA Paragraph'; }, 1500); }
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// RESEARCHER APA GENERATOR
// Reuses student result-builder functions for the researcher workspace APA module.
// ══════════════════════════════════════════════════════════════════════════

window._resApaTab = 'map';

function resInitApaGen() {
  resApaTab('map');
}

function resApaTab(tab) {
  window._resApaTab = tab;
  document.querySelectorAll('.res-apa-tab').forEach(function(btn) {
    var active = btn.dataset.t === tab;
    btn.style.borderBottomColor = active ? '#7c3aed' : 'transparent';
    btn.style.color = active ? 'var(--bright)' : 'var(--dim)';
  });

  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mapRows  = allRows.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
  var mmasRows = allRows.filter(function(r){ return r.tool !== 'map' && r.map_q1 === undefined; });

  var methods = {
    map:   (typeof _STU_METHODS !== 'undefined' && _STU_METHODS.map)   || 'MAP methods text unavailable.',
    mmas:  (typeof _STU_METHODS !== 'undefined' && _STU_METHODS.mmas)  || 'MMAS-8 methods text unavailable.',
    peacs: (typeof _STU_METHODS !== 'undefined' && _STU_METHODS.peacs) || 'PEACS methods text unavailable.'
  };

  var results = {
    map:   typeof _stuBuildMapResults   === 'function' ? _stuBuildMapResults(mapRows)   : '(MAP data unavailable.)',
    mmas:  typeof _stuBuildMmasResults  === 'function' ? _stuBuildMmasResults(allRows)  : '(MMAS-8 data unavailable.)',
    peacs: typeof _stuBuildPeacsResults === 'function' ? _stuBuildPeacsResults()        : '(PEACS data unavailable.)'
  };

  var mEl = document.getElementById('res-apa-methods-text');
  var rEl = document.getElementById('res-apa-results-text');
  if (mEl) mEl.textContent = methods[tab] || '—';
  if (rEl) rEl.textContent = results[tab] || '—';

  window._resApaCache = { methods: methods[tab], results: results[tab] };
}

function resApaCopy(section) {
  var txt = window._resApaCache && window._resApaCache[section];
  if (!txt) {
    var el = document.getElementById('res-apa-' + section + '-text');
    txt = el ? el.textContent : '';
  }
  if (!txt) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(function() {
      var btn = document.querySelector('[onclick="resApaCopy(\'' + section + '\')"]');
      if (btn) { var old = btn.textContent; btn.textContent = 'Copied!'; setTimeout(function(){ btn.textContent = old; }, 1500); }
    });
  }
}

// Intercept openPubLicenseFlow to show step-0 explainer on first use (students only).
// clinical-billing.js exports openPubLicenseFlow to window before this file runs.
const _origOpenPubLicenseFlow = window.openPubLicenseFlow;
window.openPubLicenseFlow = function(...args) {
  const _plRole = (typeof workspaceProfile !== 'undefined' && workspaceProfile && workspaceProfile.role) ? workspaceProfile.role : null;
  const _plIsStudent = _plRole === 'student';
  if (!_plIsStudent || sessionStorage.getItem('_pl_exp_seen')) {
    if (_origOpenPubLicenseFlow) _origOpenPubLicenseFlow(...args);
  } else {
    sessionStorage.setItem('_pl_exp_seen', '1');
    document.querySelectorAll('[id^="pub-lic-step"]').forEach(el => el.style.display = 'none');
    const s0 = document.getElementById('pub-lic-step-0');
    const modal = document.getElementById('pub-lic-modal');
    if (s0) s0.style.display = 'block';
    if (modal) modal.style.display = 'flex';
  }
};
window.openPubLicModal = window.openPubLicenseFlow;

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 1 — STUDENT COHORT AI INTERPRETATION
// ══════════════════════════════════════════════════════════════════════════
async function stuInterpretCohort() {
  var btn = document.getElementById('stu-interpret-btn');
  var out = document.getElementById('stu-interpret-output');
  if (!btn || !out) return;
  btn.disabled = true;
  btn.textContent = '✦ Interpreting…';
  out.style.display = '';
  out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);animation:blink 1.4s ease-in-out infinite;">Analyzing your cohort…</div>';

  var records = window.dashMmasData || window._rppMmasData || [];
  var total = records.length;
  var scores = records.map(function(r){ return parseFloat(r.score||r.mmas_score||0); }).filter(function(s){ return s > 0; });
  var avg = scores.length ? (scores.reduce(function(a,b){return a+b;},0)/scores.length).toFixed(2) : 'N/A';
  var high = scores.filter(function(s){return s>=8;}).length;
  var med  = scores.filter(function(s){return s>=6&&s<8;}).length;
  var low  = scores.filter(function(s){return s<6;}).length;

  // MAP domain averages if available
  var archScores = records.map(function(r){ return ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; }).filter(function(s){return s>0;});
  var execScores = records.map(function(r){ return ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; }).filter(function(s){return s>0;});
  var ctxScores  = records.map(function(r){ return 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; });
  var avgArch = archScores.length ? (archScores.reduce(function(a,b){return a+b;},0)/archScores.length).toFixed(2) : null;
  var avgExec = execScores.length ? (execScores.reduce(function(a,b){return a+b;},0)/execScores.length).toFixed(2) : null;
  var avgCtx  = ctxScores.length  ? (ctxScores.reduce(function(a,b){return a+b;},0)/ctxScores.length).toFixed(2)  : null;

  var domainStr = (avgArch && avgExec && avgCtx)
    ? 'MAP Tri-Domain averages (0–1 scale): Architecture ' + avgArch + ', Execution ' + avgExec + ', Context-Guard ' + avgCtx + '.'
    : '';

  var prompt = 'You are interpreting medication adherence research data for a student researcher.\n\n'
    + 'Cohort summary:\n'
    + '- Total participants: ' + total + '\n'
    + '- Mean adherence score: ' + avg + '/8\n'
    + '- High adherence (score = 8): ' + high + ' (' + (total ? Math.round(100*high/total) : 0) + '%)\n'
    + '- Medium adherence (score ≥6 to <8): ' + med + ' (' + (total ? Math.round(100*med/total) : 0) + '%)\n'
    + '- Low adherence (score <6): ' + low + ' (' + (total ? Math.round(100*low/total) : 0) + '%)\n'
    + (domainStr ? '- ' + domainStr + '\n' : '')
    + '\nWrite 2–3 sentences interpreting what these findings mean scientifically. Identify the dominant pattern, note which domain is weakest (if domain data is present), and suggest one intervention focus area. Use academic language appropriate for a student thesis.';

  try {
    var resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 220,
        system: 'You are an adherence science research assistant helping students interpret cohort data. Be concise, academic, and specific.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await resp.json();
    var text = (data.content && data.content[0] && data.content[0].text) || 'No interpretation available.';
    out.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--strata);margin-bottom:8px;">✦ AI Cohort Interpretation</div>' +
      '<div style="font-family:var(--font-body);font-size:0.87rem;line-height:1.7;color:var(--text);">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:8px;">AI draft · verify against your raw data</div>';
  } catch(e) {
    out.style.display = 'none';
  }
  btn.disabled = false;
  btn.textContent = '✦ Re-interpret';
}

// ══════════════════════════════════════════════════════════════════════════
// FEATURE 2 — THESIS METHODS SECTION DRAFTER
// ══════════════════════════════════════════════════════════════════════════
async function stuDraftMethods() {
  var btn = document.getElementById('stu-draft-methods-btn');
  var out = document.getElementById('stu-draft-methods-output');
  if (!btn || !out) return;
  btn.disabled = true;
  btn.textContent = '✦ Drafting…';
  out.style.display = '';
  out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);animation:blink 1.4s ease-in-out infinite;">Writing your methods section…</div>';

  var records = window.dashMmasData || window._rppMmasData || [];
  var total = records.length;
  var hasPeacs = (window.dashPeacsData || window._rppPeacsData || []).length > 0;
  var hasMap = records.some(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
  var hasMmas = records.some(function(r){ return r.tool !== 'map' && r.map_q1 === undefined && r.score !== undefined; });
  var studyTitle = (window._atlasActiveStudy && window._atlasActiveStudy.title) || localStorage.getItem('atlas_active_study_title') || '[Study Title]';
  var wsName = (window.workspaceProfile && window.workspaceProfile.name) || '[Researcher Name]';
  var instruments = [];
  if (hasMap) instruments.push('MAP (Multidimensional Adherence Parameters)');
  if (hasMmas) instruments.push('MMAS-8 (Morisky Medication Adherence Scale)');
  if (hasPeacs) instruments.push('PEACS v2.0 (Predictive Emergence Adherence Cartography Scale)');

  var prompt = 'Write a formal Methods section for a thesis or journal article on medication adherence research.\n\n'
    + 'Study: ' + studyTitle + '\n'
    + 'Researcher: ' + wsName + '\n'
    + 'Sample size: n = ' + total + '\n'
    + 'Instruments used: ' + (instruments.length ? instruments.join('; ') : 'MAP, PEACS') + '\n'
    + 'Platform: ATLAS (Adherence Tracking and Longitudinal Assessment System) by Adherence Cartography\n\n'
    + 'Write a Methods section of approximately 250–350 words covering: study design, participant recruitment approach, instruments and their psychometric properties, data collection procedure via ATLAS, and analysis plan. Use APA 7th edition style. Include standard citations for MMAS-8 (Morisky et al., 2008) and MAP/PEACS (Morisky, 2026) where appropriate. Use brackets like [IRB protocol number] for items the researcher must fill in.';

  try {
    var resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: 'You are an academic writing assistant specializing in health sciences research methods sections. Write in formal APA style.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await resp.json();
    var text = (data.content && data.content[0] && data.content[0].text) || 'No draft available.';
    out.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mvmt);margin-bottom:10px;">✦ AI Methods Section Draft</div>' +
      '<textarea id="stu-methods-editable" style="width:100%;box-sizing:border-box;font-family:var(--font-body);font-size:0.87rem;line-height:1.75;color:var(--text);background:rgba(255,255,255,0.03);border:1px solid rgba(139,111,245,0.2);border-radius:8px;padding:12px;resize:vertical;min-height:260px;outline:none;">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>' +
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;">' +
        '<button onclick="var ta=document.getElementById(\'stu-methods-editable\');navigator.clipboard.writeText(ta.value)" style="font-family:var(--font-mono);font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.25);color:rgba(139,111,245,0.8);padding:5px 12px;border-radius:6px;cursor:pointer;">Copy Text</button>' +
        '<div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);">Edit directly · fill in brackets · then copy</div>' +
      '</div>';
  } catch(e) {
    out.style.display = 'none';
  }
  btn.disabled = false;
  btn.textContent = '✦ Redraft Methods';
}

// ══════════════════════════════════════════════════════════════════════════
// DATA VISUALIZATION CHARTS — Score Histogram · Domain Radar · Enrollment Velocity
// ══════════════════════════════════════════════════════════════════════════

function stuRenderScoreHistogram(records) {
  ensurePlotly().then(function() {
    var el = document.getElementById('stu-score-histogram');
    if (!el) return;
    // MMAS-8 records only — exclude MAP (map_q1 present) and PEACS (pe_score present)
    var mmasOnly = (records || []).filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined && r.pe_score === undefined; });
    var scores = mmasOnly.map(function(r){ var sc=parseFloat(r.score||r.mmas_score||0); return sc>=8?8:Math.max(0,Math.floor(sc)); }).filter(function(s){ return s >= 0 && s <= 8; });
    if (scores.length < 3) { el.style.display = 'none'; return; }
    el.style.display = '';
    var counts = [0,0,0,0,0,0,0,0,0];
    scores.forEach(function(s){ counts[s]++; });
    var colors = counts.map(function(_,i){ return i === 8 ? '#10b981' : i >= 6 ? '#f59e0b' : '#ef4444'; });
    window.Plotly.newPlot(el, [{
      type: 'bar', x: [0,1,2,3,4,5,6,7,8], y: counts,
      marker: { color: colors },
      hovertemplate: 'Score %{x}: %{y} patients<extra></extra>'
    }], {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 10, r: 10, b: 30, l: 30 },
      xaxis: { tickfont: { family: 'IBM Plex Mono', size: 10, color: '#607898' }, gridcolor: 'rgba(255,255,255,0.05)', title: { text: 'Adherence Score', font: { family: 'IBM Plex Mono', size: 9, color: '#607898' } } },
      yaxis: { tickfont: { family: 'IBM Plex Mono', size: 10, color: '#607898' }, gridcolor: 'rgba(255,255,255,0.05)', title: { text: 'Patients', font: { family: 'IBM Plex Mono', size: 9, color: '#607898' } } },
      font: { family: 'IBM Plex Mono', color: '#8aa0b8' },
      showlegend: false
    }, { responsive: true, displayModeBar: false });
  });
}

function stuRenderDomainRadar(records) {
  ensurePlotly().then(function() {
    var el = document.getElementById('stu-domain-radar');
    if (!el) return;
    var mapRecs = records.filter(function(r){ return r.tool === 'map' || r.map_q1 !== undefined; });
    if (mapRecs.length < 2) { el.style.display = 'none'; return; }
    el.style.display = '';
    function avg(arr){ return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0; }
    var archVals = mapRecs.map(function(r){ return ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; });
    var execVals = mapRecs.map(function(r){ return ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; });
    var ctxVals  = mapRecs.map(function(r){ return 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; });
    var aA = avg(archVals), aE = avg(execVals), aC = avg(ctxVals);
    window.Plotly.newPlot(el, [{
      type: 'scatterpolar', r: [aA, aE, aC, aA],
      theta: ['Architecture', 'Execution', 'Context', 'Architecture'],
      fill: 'toself',
      fillcolor: 'rgba(78,156,245,0.12)',
      line: { color: '#4e9cf5', width: 2 },
      hovertemplate: '%{theta}: %{r:.2f}<extra></extra>'
    }], {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      polar: {
        bgcolor: 'transparent',
        radialaxis: { visible: true, range: [0, 1], tickfont: { family: 'IBM Plex Mono', size: 8, color: '#607898' }, gridcolor: 'rgba(255,255,255,0.07)', linecolor: 'rgba(255,255,255,0.07)' },
        angularaxis: { tickfont: { family: 'IBM Plex Mono', size: 9, color: '#8aa0b8' }, gridcolor: 'rgba(255,255,255,0.07)', linecolor: 'rgba(255,255,255,0.07)' }
      },
      margin: { t: 20, r: 30, b: 20, l: 30 },
      showlegend: false
    }, { responsive: true, displayModeBar: false });
  });
}

function stuRenderEnrollmentVelocity(records) {
  ensurePlotly().then(function() {
    var el = document.getElementById('stu-velocity-chart');
    if (!el) return;
    if (records.length < 5) { el.style.display = 'none'; return; }
    el.style.display = '';
    // Sort by timestamp
    var sorted = records.slice().sort(function(a,b){ return (+(a.ts||a.timestamp||0)) - (+(b.ts||b.timestamp||0)); });
    // Build cumulative count by day
    var dayMap = {};
    sorted.forEach(function(r){
      var ts = +(r.ts||r.timestamp||0);
      if (!ts) return;
      var d = new Date(ts).toISOString().slice(0,10);
      dayMap[d] = (dayMap[d]||0) + 1;
    });
    var days = Object.keys(dayMap).sort();
    var cumulative = []; var sum = 0;
    days.forEach(function(d){ sum += dayMap[d]; cumulative.push(sum); });
    window.Plotly.newPlot(el, [{
      type: 'scatter', mode: 'lines+markers',
      x: days, y: cumulative,
      line: { color: '#2ec98a', width: 2 },
      marker: { color: '#2ec98a', size: 4 },
      fill: 'tozeroy', fillcolor: 'rgba(46,201,138,0.08)',
      hovertemplate: '%{x}: %{y} total<extra></extra>'
    }], {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 8, r: 10, b: 30, l: 36 },
      xaxis: { tickfont: { family: 'IBM Plex Mono', size: 8, color: '#607898' }, gridcolor: 'rgba(255,255,255,0.05)', tickangle: -30 },
      yaxis: { tickfont: { family: 'IBM Plex Mono', size: 9, color: '#607898' }, gridcolor: 'rgba(255,255,255,0.05)' },
      showlegend: false
    }, { responsive: true, displayModeBar: false });
  });
}


// ── Patient Score Trajectory Chart (Spaghetti Plot) ──────
// Shows each patient's MMAS-8 score across their sessions ordered by timestamp.
// Only patients with ≥2 records are drawn as lines; single-record patients show dots.
// Color: green = net improvement, red = net decline, gray = no change.
// Shared trajectory state — set once on load, reused on dropdown change
window._stuTrajectoryPatients = null; // { pid: [{ ts, score, pid }] }

function stuRenderTrajectoryChart(records) {
  var wrap  = document.getElementById('stu-trajectory-wrap');
  var el    = document.getElementById('stu-trajectory-chart');
  var badge = document.getElementById('stu-trajectory-badge');
  var sel   = document.getElementById('stu-trajectory-pid');
  if (!el || !wrap) return;

  // MMAS-8 only
  var mmasRecs = (records || []).filter(function(r) {
    return r.tool !== 'map' && r.map_q1 === undefined && r.pe_score === undefined;
  });

  // Group by patient_number; sort each patient's sessions by assessment_date (Excel date),
  // falling back to upload timestamp when assessment_date is absent.
  var byPat = {};
  mmasRecs.forEach(function(r) {
    var pid = String(r.patient_number || r.pid || r.user_id || '?');
    if (!byPat[pid]) byPat[pid] = [];
    // sortKey: parsed assessment_date preferred over upload timestamp
    var sortKey = r.assessment_date
      ? new Date(r.assessment_date + 'T12:00:00').getTime()
      : +(r.timestamp || 0);
    // displayDate for tooltip/label
    var displayDate = r.assessment_date
      ? new Date(r.assessment_date + 'T12:00:00').toLocaleDateString()
      : (r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '—');
    byPat[pid].push({ ts: sortKey, displayDate: displayDate, score: parseFloat(r.score) || 0, pid: pid });
  });
  Object.values(byPat).forEach(function(pts) { pts.sort(function(a, b) { return a.ts - b.ts; }); });

  var patients     = Object.values(byPat);
  var longitudinal = patients.filter(function(pts) { return pts.length >= 2; });

  if (patients.length < 2) { wrap.style.display = 'none'; return; }

  // Store for dropdown handler
  window._stuTrajectoryPatients = byPat;

  wrap.style.display = '';
  if (badge) badge.textContent = longitudinal.length + ' with repeat measures';

  // Populate dropdown (preserve current selection if patient still exists)
  if (sel) {
    var prevVal = sel.value;
    sel.innerHTML = '<option value="">All patients</option>';
    // Sort patient IDs numerically where possible
    var pids = Object.keys(byPat).sort(function(a, b) {
      var na = parseFloat(a), nb = parseFloat(b);
      return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
    });
    pids.forEach(function(pid) {
      var pts   = byPat[pid];
      var delta = pts.length >= 2 ? (pts[pts.length - 1].score - pts[0].score) : null;
      var arrow = delta === null ? '' : delta > 0 ? ' ↑' : delta < 0 ? ' ↓' : ' →';
      var opt   = document.createElement('option');
      opt.value = pid;
      opt.textContent = 'PID ' + pid + ' (' + pts.length + ' session' + (pts.length > 1 ? 's' : '') + ')' + arrow;
      sel.appendChild(opt);
    });
    sel.value = (prevVal && byPat[prevVal]) ? prevVal : '';
  }

  // Render with current selection
  _stuDrawTrajectory(sel ? sel.value : '');
}

// Called by the dropdown onchange
function stuTrajectorySelectPid(pid) {
  _stuDrawTrajectory(pid);
}

function _stuDrawTrajectory(selectedPid) {
  var el      = document.getElementById('stu-trajectory-chart');
  var statsEl = document.getElementById('stu-trajectory-stats');
  var byPat   = window._stuTrajectoryPatients;
  if (!el || !byPat) return;

  var patients     = Object.values(byPat);
  var longitudinal = patients.filter(function(pts) { return pts.length >= 2; });
  var maxSessions  = Math.max.apply(null, patients.map(function(pts) { return pts.length; }));

  // Shared layout base
  var shapeColor4 = 'rgba(252,165,165,0.4)', shapeColor6 = 'rgba(253,211,77,0.4)';
  var baseLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    margin: { t: 10, r: 24, b: 36, l: 36 },
    xaxis: {
      title: { text: 'Session', font: { family: 'IBM Plex Mono', size: 9, color: '#607898' } },
      tickmode: 'linear', tick0: 1, dtick: 1,
      range: [0.6, maxSessions + 0.4],
      tickfont: { family: 'IBM Plex Mono', size: 9, color: '#607898' },
      gridcolor: 'rgba(255,255,255,0.05)', zeroline: false
    },
    yaxis: {
      title: { text: 'MMAS-8', font: { family: 'IBM Plex Mono', size: 9, color: '#607898' } },
      range: [-0.2, 8.4],
      tickfont: { family: 'IBM Plex Mono', size: 9, color: '#607898' },
      gridcolor: 'rgba(255,255,255,0.05)', zeroline: false
    },
    shapes: [
      { type: 'line', x0: 0.6, x1: maxSessions + 0.4, y0: 6, y1: 6, line: { color: shapeColor6, width: 1, dash: 'dot' } },
      { type: 'line', x0: 0.6, x1: maxSessions + 0.4, y0: 4, y1: 4, line: { color: shapeColor4, width: 1, dash: 'dot' } }
    ],
    annotations: [
      { x: maxSessions + 0.4, y: 6, xanchor: 'left', yanchor: 'middle', text: '6', showarrow: false, font: { family: 'IBM Plex Mono', size: 8, color: '#d97706' } },
      { x: maxSessions + 0.4, y: 4, xanchor: 'left', yanchor: 'middle', text: '4', showarrow: false, font: { family: 'IBM Plex Mono', size: 8, color: '#dc2626' } }
    ],
    hovermode: 'closest', showlegend: false
  };

  ensurePlotly().then(function() {
    // ── Single patient selected ──────────────────────────────────────────
    if (selectedPid && byPat[selectedPid]) {
      var pts   = byPat[selectedPid];
      var first = pts[0].score, last = pts[pts.length - 1].score;
      var delta = last - first;
      var col   = delta > 0 ? '#059669' : delta < 0 ? '#dc2626' : '#94a3b8';

      // Always use numeric session indices for X so Plotly never reorders points.
      // Map actual assessment dates onto tick labels so the axis still reads as dates.
      var xs  = pts.map(function(_, i) { return i + 1; });
      var ys  = pts.map(function(p) { return p.score; });
      var hov = pts.map(function(p, i) {
        return 'PID ' + p.pid + '<br>Session ' + (i + 1) + '<br>Score: ' + p.score.toFixed(2) + '<br>' + p.displayDate;
      });

      // Score labels anchored to numeric X positions (always correct)
      var labelAnnotations = pts.map(function(p, i) {
        return { x: i + 1, y: p.score, xanchor: 'center', yanchor: 'bottom',
          text: '<b>' + p.score.toFixed(2) + '</b>', showarrow: false,
          font: { family: 'IBM Plex Mono', size: 11, color: col }, yshift: 8 };
      });

      // Show dates as tick labels only when they differ across sessions
      var uniqueDates = pts.map(function(p) { return p.displayDate; });
      var allSameDate = uniqueDates.every(function(d) { return d === uniqueDates[0]; });
      var xAxisOverride = {
        title: { text: allSameDate ? 'Session' : 'Assessment Date', font: { family: 'IBM Plex Mono', size: 9, color: '#607898' } },
        type: 'linear',          // always numeric — prevents category reordering
        tickmode: 'array',
        tickvals: xs,
        ticktext: allSameDate
          ? xs.map(function(n) { return 'Session ' + n; })
          : uniqueDates,
        tickangle: allSameDate ? 0 : -30,
        range: [0.6, pts.length + 0.4]
      };

      var layout = Object.assign({}, baseLayout, {
        annotations: baseLayout.annotations.concat(labelAnnotations),
        xaxis: Object.assign({}, baseLayout.xaxis, xAxisOverride)
      });

      var trace = {
        type: 'scatter', mode: 'lines+markers',
        x: xs, y: ys,
        line:   { color: col, width: 3 },
        marker: { color: col, size: 10, line: { color: 'white', width: 2 } },
        hovertemplate: '%{customdata}<extra></extra>',
        customdata: hov,
        showlegend: false
      };

      window.Plotly.react(el, [trace], layout, { responsive: true, displayModeBar: false });

      // Stat strip
      if (statsEl) {
        var sign    = delta > 0 ? '+' : '';
        var tier    = function(s) { return s >= 8 ? 'High' : s >= 6 ? 'Medium' : 'Low'; };
        var tierCol = function(s) { return s >= 8 ? '#059669' : s >= 6 ? '#d97706' : '#dc2626'; };
        statsEl.style.display = 'flex';
        statsEl.innerHTML =
          '<span>Sessions: <strong>' + pts.length + '</strong></span>' +
          '<span>Baseline: <strong style="color:' + tierCol(first) + '">' + first.toFixed(2) + ' (' + tier(first) + ')</strong></span>' +
          '<span>Latest: <strong style="color:' + tierCol(last) + '">' + last.toFixed(2) + ' (' + tier(last) + ')</strong></span>' +
          '<span>Change: <strong style="color:' + col + '">' + sign + delta.toFixed(2) + '</strong></span>';
      }
      return;
    }

    // ── All patients (spaghetti) ─────────────────────────────────────────
    if (statsEl) statsEl.style.display = 'none';

    var traces = [];
    longitudinal.forEach(function(pts) {
      var delta   = pts[pts.length - 1].score - pts[0].score;
      var lineCol = delta > 0 ? 'rgba(5,150,105,0.45)' : delta < 0 ? 'rgba(220,38,38,0.45)' : 'rgba(148,163,184,0.35)';
      var dotCol  = delta > 0 ? '#059669'              : delta < 0 ? '#dc2626'              : '#94a3b8';
      var xs  = pts.map(function(_, i) { return i + 1; });
      var ys  = pts.map(function(p) { return p.score; });
      var hov = pts.map(function(p, i) {
        return 'PID ' + p.pid + '<br>Session ' + (i + 1) + '<br>Score: ' + p.score.toFixed(2) + '<br>' + p.displayDate;
      });
      traces.push({
        type: 'scatter', mode: 'lines+markers',
        x: xs, y: ys,
        line:   { color: lineCol, width: 1.4 },
        marker: { color: dotCol, size: 5, line: { color: 'white', width: 1 } },
        hovertemplate: '%{customdata}<extra></extra>',
        customdata: hov,
        showlegend: false
      });
    });

    // Single-session patients: faint open dots
    var singlePats = patients.filter(function(pts) { return pts.length === 1; });
    if (singlePats.length) {
      traces.push({
        type: 'scatter', mode: 'markers',
        x: singlePats.map(function() { return 1; }),
        y: singlePats.map(function(pts) { return pts[0].score; }),
        marker: { color: 'rgba(148,163,184,0.4)', size: 4, symbol: 'circle-open' },
        hovertemplate: 'PID %{text}<br>Score: %{y:.2f}<br>' + '%{customdata}<extra></extra>',
        text:       singlePats.map(function(pts) { return pts[0].pid; }),
        customdata: singlePats.map(function(pts) { return pts[0].displayDate; }),
        showlegend: false
      });
    }

    window.Plotly.react(el, traces, baseLayout, { responsive: true, displayModeBar: false });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 14 — STATISTICS PANEL
// Reliability | Classification | Effect Size  (student-facing, plain-language)
// Data sources: dashMmasData (MMAS-8 + MAP), window._rppPeacsData (PEACS)
// ══════════════════════════════════════════════════════════════════════════════

window._stuStatsLoaded  = false;
window._stuStatsSub     = 'reliability';
window._stuPsychoLoaded = false;
window._stuPsychoSub    = 'reliability';

// ── Module-card entry point (sidebar "Psychometric Analysis" card) ────────────

function stuInitPsychoStats() {
  if (window._stuPsychoLoaded) return;
  window._stuPsychoLoaded = true;
  stuPsychoSwitchSub('reliability');
}

function stuPsychoSwitchSub(sub) {
  window._stuPsychoSub = sub;
  document.querySelectorAll('.stu-psycho-sub-btn').forEach(function(btn) {
    var isActive = btn.dataset.sub === sub;
    btn.style.background  = isActive ? 'rgba(180,83,9,0.08)'  : 'var(--card2)';
    btn.style.borderColor = isActive ? 'rgba(180,83,9,0.38)'  : 'var(--border2)';
    btn.style.color       = isActive ? '#b45309'               : 'var(--muted)';
  });
  var body = document.getElementById('stu-psycho-body');
  if (!body) return;
  if (sub === 'reliability')    _stuStatsReliability(body);
  else if (sub === 'classification') _stuStatsClassification(body);
  else if (sub === 'effectsize')     _stuStatsEffectSize(body);
  else if (sub === 'methods')        _stuStatsMethodsRender(body);
}

// ── Researcher / PI module-card entry point ───────────────────────────────────

window._resPsychoLoaded = false;
window._resPsychoSub    = 'reliability';

function resInitPsychoStats() {
  if (window._resPsychoLoaded) return;
  window._resPsychoLoaded = true;
  resPsychoSwitchSub('reliability');
}

function resPsychoSwitchSub(sub) {
  window._resPsychoSub = sub;
  document.querySelectorAll('.res-psycho-sub-btn').forEach(function(btn) {
    var isActive = btn.dataset.sub === sub;
    btn.style.background  = isActive ? 'rgba(180,83,9,0.08)'  : 'var(--card2)';
    btn.style.borderColor = isActive ? 'rgba(180,83,9,0.38)'  : 'var(--border2)';
    btn.style.color       = isActive ? '#b45309'               : 'var(--muted)';
  });
  var body = document.getElementById('res-psycho-body');
  if (!body) return;
  if (sub === 'reliability')    _stuStatsReliability(body);
  else if (sub === 'classification') _stuStatsClassification(body);
  else if (sub === 'effectsize')     _stuStatsEffectSize(body);
  else if (sub === 'methods')        _stuStatsMethodsRender(body);
}

// ── Thesis-pane entry point (Statistics tab inside Writing → Thesis Export) ───

function stuInitStats() {
  if (window._stuStatsLoaded) return;
  window._stuStatsLoaded = true;
  stuSwitchStatsSub('reliability');
}

function stuSwitchStatsSub(sub) {
  window._stuStatsSub = sub;
  document.querySelectorAll('.stu-stats-sub-btn').forEach(function(btn) {
    var isActive = btn.dataset.sub === sub;
    btn.style.background  = isActive ? 'rgba(212,168,67,0.10)' : 'var(--card2)';
    btn.style.borderColor = isActive ? 'rgba(212,168,67,0.38)' : 'var(--border2)';
    btn.style.color       = isActive ? '#b45309'               : 'var(--muted)';
  });
  var body = document.getElementById('stu-stats-body');
  if (!body) return;
  if (sub === 'reliability')    _stuStatsReliability(body);
  else if (sub === 'classification') _stuStatsClassification(body);
  else if (sub === 'effectsize')     _stuStatsEffectSize(body);
  else if (sub === 'methods')        _stuStatsMethodsRender(body);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function _stuStatsMean(arr) {
  return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0;
}
function _stuStatsSD(arr) {
  if (arr.length < 2) return 0;
  var m = _stuStatsMean(arr);
  return Math.sqrt(arr.reduce(function(s,x){return s+(x-m)*(x-m);},0)/(arr.length-1));
}
function _stuStatsCronbach(matrix) {
  // matrix: array of arrays, each inner array = one person's k item responses
  var n = matrix.length, k = matrix[0] ? matrix[0].length : 0;
  if (n < 2 || k < 2) return NaN;
  var itemVars = [];
  for (var j=0; j<k; j++) {
    var col = matrix.map(function(r){return r[j]||0;});
    itemVars.push(_stuStatsSD(col) * _stuStatsSD(col));
  }
  var totals = matrix.map(function(r){return r.reduce(function(a,b){return a+b;},0);});
  var totVar = _stuStatsSD(totals) * _stuStatsSD(totals);
  if (totVar === 0) return NaN;
  return (k/(k-1)) * (1 - itemVars.reduce(function(a,b){return a+b;},0)/totVar);
}
function _stuStatsSpearmanBrown(r) {
  // Spearman-Brown correction for split-half reliability
  return (2*r) / (1+r);
}
function _stuStatsPearsonR(a, b) {
  var n=a.length; if(n<2) return NaN;
  var ma=_stuStatsMean(a), mb=_stuStatsMean(b), num=0, da=0, db=0;
  for(var i=0;i<n;i++){num+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)*(a[i]-ma);db+=(b[i]-mb)*(b[i]-mb);}
  return (da>0&&db>0)?num/Math.sqrt(da*db):NaN;
}
function _stuStatsCohenKappa(matrix3x3) {
  // Cohen's κ for 3-class observed-vs-observed (used as agreement measure)
  var total=0, obsAgree=0;
  var rowSums=[0,0,0], colSums=[0,0,0];
  for(var i=0;i<3;i++) for(var j=0;j<3;j++) {
    total+=matrix3x3[i][j]; rowSums[i]+=matrix3x3[i][j]; colSums[j]+=matrix3x3[i][j];
    if(i===j) obsAgree+=matrix3x3[i][j];
  }
  if(total===0) return NaN;
  var pObs=obsAgree/total;
  var pExp=0;
  for(var i=0;i<3;i++) pExp+=rowSums[i]*colSums[i];
  pExp/=(total*total);
  return pExp<1?(pObs-pExp)/(1-pExp):NaN;
}
function _stuStatsCohenD(m1,s1,m2,s2) {
  // Single-sample d: divide by sample SD only (s1). Using pooled SD is for
  // two independent groups; comparing a sample to a published norm uses s1 alone.
  return s1 > 0 ? (m1 - m2) / s1 : NaN;
}
function _stuEffLabel(d) {
  var a=Math.abs(d||0);
  return a>=0.80?'large':a>=0.50?'medium':a>=0.20?'small':'negligible';
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function _stuStatsCard(eyebrow, content) {
  return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:14px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:#b45309;margin-bottom:10px;">' + eyebrow + '</div>' +
    content +
    '</div>';
}
function _stuStatsStat(label, value, sub, good) {
  var col = good===true?'#059669':good===false?'#dc2626':'var(--text)';
  return '<div style="display:inline-block;margin-right:20px;margin-bottom:8px;vertical-align:top;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--muted);margin-bottom:2px;">' + label + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.05rem;font-weight:700;color:' + col + ';">' + value + '</div>' +
    (sub?'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);">' + sub + '</div>':'') +
    '</div>';
}
function _stuStatsEmpty(inst) {
  return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--dim);padding:16px 0;">' +
    'No ' + inst + ' records yet — collect at least 10 assessments to compute these statistics.</div>';
}

// ── RELIABILITY ───────────────────────────────────────────────────────────────
function _stuStatsReliability(body) {
  var allRows   = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mapRows   = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var mmasRows  = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var peacsRecs = window._rppPeacsData||[];

  var html = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);margin-bottom:14px;">Internal consistency coefficients for your study data. A minimum of 10 records is needed for reliable estimation.</div>';

  // ── MMAS-8 block ──
  if (mmasRows.length >= 10) {
    var matrix = mmasRows.map(function(r){
      return [
        parseFloat(r.q1)||0, parseFloat(r.q2)||0, parseFloat(r.q3)||0,
        parseFloat(r.q4)||0, parseFloat(r.q5)||0, parseFloat(r.q6)||0,
        parseFloat(r.q7)||0, parseFloat(r.q8)||0
      ];
    });
    var alpha = _stuStatsCronbach(matrix);
    var ci    = _stuAlphaCI(alpha, mmasRows.length, 8);
    // Split-half: odd (0,2,4,6) vs even (1,3,5,7) item indices
    var odd  = matrix.map(function(r){return r[0]+r[2]+r[4]+r[6];});
    var even = matrix.map(function(r){return r[1]+r[3]+r[5]+r[7];});
    var rHalf = _stuStatsPearsonR(odd, even);
    var sbCorr = isFinite(rHalf) ? _stuStatsSpearmanBrown(rHalf) : NaN;
    var alphaGood = alpha >= 0.70;
    html += _stuStatsCard('MMAS-8 — Internal Consistency (N\u2009=\u2009' + mmasRows.length + ')',
      _stuStatsStat("Cronbach's \u03b1", isFinite(alpha)?alpha.toFixed(3):'—', isFinite(ci.low)?'95% CI ['+ci.low.toFixed(3)+', '+ci.high.toFixed(3)+']':'', alphaGood) +
      _stuStatsStat('Split-Half (S-B)', isFinite(sbCorr)?sbCorr.toFixed(3):'—', 'Spearman-Brown corrected', isFinite(sbCorr)?sbCorr>=0.70:undefined) +
      _stuStatsStat('Items (k)', '8', 'Dichotomous / polytomous', undefined) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);line-height:1.65;">' +
      (alpha>=0.80?'<span style="color:#059669;">&#10003; Excellent reliability</span> — \u03b1\u2009\u2265\u20090.80 meets standards for group-level research and clinical application.' :
       alpha>=0.70?'<span style="color:#d97706;">&#9888; Acceptable reliability</span> — \u03b1\u2009\u2265\u20090.70 is adequate for group-level research. Consider larger N.' :
       '<span style="color:#dc2626;">&#9888; Low reliability</span> — \u03b1\u2009<\u20090.70. May reflect small N, restricted range, or true heterogeneity.') +
      '</div>'
    );
  } else if (mmasRows.length > 0) {
    html += _stuStatsCard('MMAS-8 — Internal Consistency (N\u2009=\u2009' + mmasRows.length + ')', _stuStatsEmpty('MMAS-8 (need \u2265 10)'));
  }

  // ── MAP block ──
  if (mapRows.length >= 10) {
    var mapMatrix = mapRows.map(function(r){
      return [
        parseFloat(r.map_q1||r.q1)||0, parseFloat(r.map_q2||r.q2)||0,
        parseFloat(r.map_q3||r.q3)||0, parseFloat(r.map_q4||r.q4)||0,
        parseFloat(r.map_q5||r.q5)||0, parseFloat(r.map_q6||r.q6)||0,
        parseFloat(r.map_q7||r.q7)||0, parseFloat(r.map_q8||r.q8)||0
      ];
    });
    var mapAlpha = _stuStatsCronbach(mapMatrix);
    var mapCI    = _stuAlphaCI(mapAlpha, mapRows.length, 8);
    // Domain subscale alphas
    var archMatrix = mapRows.map(function(r){return [parseFloat(r.map_q2||r.q2)||0, parseFloat(r.map_q3||r.q3)||0, parseFloat(r.map_q6||r.q6)||0];});
    var execMatrix = mapRows.map(function(r){return [parseFloat(r.map_q1||r.q1)||0, parseFloat(r.map_q5||r.q5)||0, parseFloat(r.map_q8||r.q8)||0];});
    var ctxMatrix  = mapRows.map(function(r){return [parseFloat(r.map_q4||r.q4)||0, parseFloat(r.map_q7||r.q7)||0];});
    var alphaA = _stuStatsCronbach(archMatrix);
    var alphaE = _stuStatsCronbach(execMatrix);
    var alphaC = ctxMatrix[0].length >= 2 ? _stuStatsCronbach(ctxMatrix) : NaN;
    html += _stuStatsCard('MAP — Internal Consistency (N\u2009=\u2009' + mapRows.length + ')',
      _stuStatsStat('Full-Scale \u03b1', isFinite(mapAlpha)?mapAlpha.toFixed(3):'—', isFinite(mapCI.low)?'['+mapCI.low.toFixed(3)+', '+mapCI.high.toFixed(3)+']':'', mapAlpha>=0.70) +
      _stuStatsStat('Architecture \u03b1', isFinite(alphaA)?alphaA.toFixed(3):'—', 'Q2, Q3, Q6 (k\u2009=\u20093)', isFinite(alphaA)?alphaA>=0.60:undefined) +
      _stuStatsStat('Execution \u03b1', isFinite(alphaE)?alphaE.toFixed(3):'—', 'Q1, Q5, Q8 (k\u2009=\u20093)', isFinite(alphaE)?alphaE>=0.60:undefined) +
      _stuStatsStat('Context \u03b1', isFinite(alphaC)?alphaC.toFixed(3):'—', 'Q4, Q7 (k\u2009=\u20092)', isFinite(alphaC)?alphaC>=0.50:undefined) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);line-height:1.6;">Domain \u03b1 values with 2-item subscales (Context) will naturally be lower — report all four coefficients and note this limitation.</div>'
    );
  } else if (mapRows.length > 0) {
    html += _stuStatsCard('MAP — Internal Consistency (N\u2009=\u2009' + mapRows.length + ')', _stuStatsEmpty('MAP (need \u2265 10)'));
  }

  // ── PEACS block ──
  if (peacsRecs.length >= 5) {
    var peVals     = peacsRecs.map(function(r){return parseFloat(r.pe_score||r.pe)||0;}).filter(function(v){return v>0;});
    var baseVals   = peacsRecs.map(function(r){return parseFloat(r.base)||0;});
    var mvmtVals   = peacsRecs.map(function(r){return parseFloat(r.mvmt)||0;});
    var strataVals = peacsRecs.map(function(r){return parseFloat(r.strata)||0;});
    var rBA = _stuStatsPearsonR(baseVals, mvmtVals);
    var rBC = _stuStatsPearsonR(baseVals, strataVals);
    var rAC = _stuStatsPearsonR(mvmtVals, strataVals);
    var avgInterCorr = [rBA, rBC, rAC].filter(isFinite).reduce(function(a,b){return a+b;},0) /
                       [rBA, rBC, rAC].filter(isFinite).length;
    // Omega-like estimate from inter-correlation average (3 subscale version)
    var omegaEst = isFinite(avgInterCorr) ? (3*avgInterCorr)/(1+2*avgInterCorr) : NaN;
    html += _stuStatsCard('PEACS — Subscale Convergence (N\u2009=\u2009' + peacsRecs.length + ')',
      _stuStatsStat('BASE\u2013MVMT r', isFinite(rBA)?rBA.toFixed(3):'—', 'Architecture \u2194 Execution', isFinite(rBA)?rBA>=0.30:undefined) +
      _stuStatsStat('BASE\u2013STRATA r', isFinite(rBC)?rBC.toFixed(3):'—', 'Architecture \u2194 Context', isFinite(rBC)?rBC>=0.30:undefined) +
      _stuStatsStat('MVMT\u2013STRATA r', isFinite(rAC)?rAC.toFixed(3):'—', 'Execution \u2194 Context', isFinite(rAC)?rAC>=0.30:undefined) +
      _stuStatsStat('\u03c9 Estimate', isFinite(omegaEst)?omegaEst.toFixed(3):'—', '3-subscale composite', isFinite(omegaEst)?omegaEst>=0.70:undefined) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);line-height:1.6;">PEACS subscales (BASE/MVMT/STRATA) are theoretically non-redundant — moderate inter-subscale correlations (\u223c 0.30\u20130.50) are expected and desirable.</div>'
    );
  } else if (peacsRecs.length > 0) {
    html += _stuStatsCard('PEACS — Subscale Convergence (N\u2009=\u2009' + peacsRecs.length + ')', _stuStatsEmpty('PEACS (need \u2265 5)'));
  }

  if (!html.match(/stu-stats-card/i) && mmasRows.length===0 && mapRows.length===0 && peacsRecs.length===0) {
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);">No assessment data uploaded yet. Upload or collect data, then return here.</div>';
  }

  body.innerHTML = html;
}

// ── METHODS ───────────────────────────────────────────────────────────────────
function _stuStatsPrintMethods() {
  var w = window.open('', '_blank', 'width=750,height=960,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — allow pop-ups then try again.'); return; }
  var css = [
    'body{font-family:"IBM Plex Mono",monospace;max-width:660px;margin:36px auto;color:#1a1a1a;font-size:0.78rem;line-height:1.6;}',
    'h1{font-size:1.0rem;font-weight:700;margin:0 0 4px;letter-spacing:0.04em;}',
    '.subtitle{font-size:0.62rem;color:#666;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:28px;}',
    'h2{font-size:0.68rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#b45309;margin:24px 0 10px;padding-bottom:5px;border-bottom:1px solid #e5c9a0;}',
    '.fcard{background:#fafafa;border-left:3px solid #b45309;padding:10px 14px;margin:8px 0;border-radius:0 4px 4px 0;}',
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
    '<div class="subtitle">ATLAS v8 \u2014 Psychometric Analysis Module \u2014 Formulas &amp; Norms</div>',

    '<h2>Reliability</h2>',

    '<div class="fcard">',
    '<div class="fname">Cronbach\u2019s \u03b1 (coefficient alpha)</div>',
    '<div class="fformula">\u03b1 = k/(k\u22121) \u00d7 (1 \u2212 \u03a3\u03c3\u1d62\u00b2 / \u03c3\u209c\u00b2)</div>',
    '<div class="fwhere">k = number of items &nbsp;\u2502&nbsp; \u03c3\u1d62\u00b2 = variance of item i &nbsp;\u2502&nbsp; \u03c3\u209c\u00b2 = variance of total score</div>',
    '<div class="finterp">Interpretation: \u2265 0.90 excellent \u00b7 0.80\u20130.89 good \u00b7 0.70\u20130.79 acceptable \u00b7 < 0.70 poor</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">95% CI for \u03b1 (Bonett, 2002)</div>',
    '<div class="fformula">SE(\u03b1) \u2248 \u221a[ 2k(1\u2212\u03b1)\u00b2 / ((k\u22121)(N\u22121)) ]</div>',
    '<div class="fformula">CI: \u03b1 \u00b1 1.96 \u00d7 SE(\u03b1)</div>',
    '<div class="fwhere">N = sample size &nbsp;\u2502&nbsp; k = number of items</div>',
    '<div class="finterp">Bonett D.G. (2002). Sample size requirements for testing and estimating coefficient alpha. Journal of Educational and Behavioral Statistics, 27(4), 335\u2013340.</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Spearman-Brown Split-Half Reliability</div>',
    '<div class="fformula">\u03c1_SB = 2r / (1 + r)</div>',
    '<div class="fwhere">r = Pearson correlation between odd-numbered and even-numbered item halves</div>',
    '<div class="finterp">Corrects for attenuation due to halving the scale.</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">McDonald\u2019s \u03c9 (omega, composite reliability)</div>',
    '<div class="fformula">\u03c9 \u2248 (\u03a3\u03bb\u1d62)\u00b2 / [(\u03a3\u03bb\u1d62)\u00b2 + \u03a3\u03b5\u1d62\u1d62]</div>',
    '<div class="fwhere">\u03bb\u1d62 = factor loading of item i &nbsp;\u2502&nbsp; \u03b5\u1d62\u1d62 = unique (error) variance of item i</div>',
    '<div class="finterp">In ATLAS, \u03c9 is estimated from \u03b1 using the lambda-loading approximation. Values \u2265 0.80 indicate adequate composite reliability.</div>',
    '</div>',

    '<h2>Classification</h2>',

    '<div class="fcard">',
    '<div class="fname">Confusion Matrix Cells</div>',
    '<table>',
    '<tr><th></th><th>Actual Positive</th><th>Actual Negative</th></tr>',
    '<tr><td>Predicted Positive</td><td>TP (True Positive)</td><td>FP (False Positive)</td></tr>',
    '<tr><td>Predicted Negative</td><td>FN (False Negative)</td><td>TN (True Negative)</td></tr>',
    '</table>',
    '<div class="fwhere">Predicted Positive = at or above published norm mean &nbsp;\u2502&nbsp; Actual Positive = at or above clinical threshold</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Sensitivity (Recall / True Positive Rate)</div>',
    '<div class="fformula">Sensitivity = TP / (TP + FN)</div>',
    '<div class="finterp">Of all true positives, what fraction did the instrument correctly identify?</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Specificity (True Negative Rate)</div>',
    '<div class="fformula">Specificity = TN / (TN + FP)</div>',
    '<div class="finterp">Of all true negatives, what fraction did the instrument correctly identify?</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Positive Predictive Value (PPV / Precision)</div>',
    '<div class="fformula">PPV = TP / (TP + FP)</div>',
    '<div class="finterp">Of all cases classified as positive, what fraction are truly positive?</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Negative Predictive Value (NPV)</div>',
    '<div class="fformula">NPV = TN / (TN + FN)</div>',
    '<div class="finterp">Of all cases classified as negative, what fraction are truly negative?</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">F\u2081 Score</div>',
    '<div class="fformula">F\u2081 = 2 \u00d7 PPV \u00d7 Sensitivity / (PPV + Sensitivity)</div>',
    '<div class="finterp">Harmonic mean of PPV and Sensitivity. Balances precision and recall; values closer to 1.0 are better.</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Cohen\u2019s \u03ba (kappa, beyond-chance agreement)</div>',
    '<div class="fformula">\u03ba = (p_obs \u2212 p_exp) / (1 \u2212 p_exp)</div>',
    '<div class="fformula">p_obs = (TP + TN) / N</div>',
    '<div class="fformula">p_exp = [(TP+FP)/N \u00d7 (TP+FN)/N] + [(FN+TN)/N \u00d7 (FP+TN)/N]</div>',
    '<div class="finterp">Interpretation: \u2265 0.80 almost perfect \u00b7 0.60\u20130.79 substantial \u00b7 0.40\u20130.59 moderate \u00b7 < 0.40 fair/poor</div>',
    '</div>',

    '<h2>Effect Size</h2>',

    '<div class="fcard">',
    '<div class="fname">Cohen\u2019s d (one-sample, vs published norm)</div>',
    '<div class="fformula">d = (M\u0305 \u2212 \u03bc\u2080) / s</div>',
    '<div class="fwhere">M\u0305 = sample mean &nbsp;\u2502&nbsp; \u03bc\u2080 = norm mean &nbsp;\u2502&nbsp; s = sample standard deviation</div>',
    '<div class="finterp">Interpretation: |d| < 0.20 negligible \u00b7 0.20\u20130.49 small \u00b7 0.50\u20130.79 medium \u00b7 \u2265 0.80 large (Cohen, 1988)</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">Cohen\u2019s d (two-sample, pooled SD)</div>',
    '<div class="fformula">d = (M\u2081 \u2212 M\u2082) / \u221a[(s\u2081\u00b2 + s\u2082\u00b2) / 2]</div>',
    '<div class="fwhere">M\u2081, M\u2082 = group means &nbsp;\u2502&nbsp; s\u2081, s\u2082 = group standard deviations</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">95% CI for Cohen\u2019s d</div>',
    '<div class="fformula">CI: d \u00b1 1.96 / \u221aN</div>',
    '<div class="fwhere">N = sample size. This is an approximation; exact CI requires noncentral t-distribution.</div>',
    '</div>',

    '<h2>PE Composite Formula (MAP &amp; PEACS)</h2>',

    '<div class="fcard">',
    '<div class="fname">Predictive Emergence (PE)</div>',
    '<div class="fformula">PE = \u00b3\u221a(A \u00d7 E \u00d7 C_guarded)</div>',
    '<div class="fformula">C_guarded = 0.5 + 0.5 \u00d7 C_raw</div>',
    '<div class="fwhere">A = Architecture domain mean &nbsp;\u2502&nbsp; E = Execution domain mean &nbsp;\u2502&nbsp; C_raw = Context score (0\u20131)</div>',
    '<div class="finterp">Non-compensatory geometric mean: no single domain can fully substitute for another. Context Guard prevents C = 0 from zeroing PE.</div>',
    '</div>',

    '<div class="fcard">',
    '<div class="fname">INA vs UNA Classification (MAP)</div>',
    '<div class="fformula">INA (Intentional): Architecture &lt; Execution</div>',
    '<div class="fformula">UNA (Unintentional): Execution &lt; Architecture</div>',
    '<div class="finterp">INA reflects deliberate choice not to take medication (architecture of belief lower than execution capacity). UNA reflects forgetting or practical barriers.</div>',
    '</div>',

    '<h2>Reference Norms</h2>',
    '<table>',
    '<tr><th>Instrument</th><th>Metric</th><th>\u03bc (mean)</th><th>\u03c3 (SD)</th><th>Source / N</th></tr>',
    '<tr><td>MMAS-8</td><td>Total score</td><td>6.52</td><td>1.85</td><td>Morisky et al., 2008 &nbsp;\u2502&nbsp; N\u2009=\u2009272 outpatients</td></tr>',
    '<tr><td>MAP</td><td>PE composite</td><td>0.72</td><td>0.16</td><td>Provisional illustrative norm (not yet aggregated)</td></tr>',
    '<tr><td>PEACS</td><td>PE composite</td><td>0.68</td><td>0.18</td><td>Provisional illustrative norm (not yet aggregated)</td></tr>',
    '</table>',

    '<h2>Clinical Thresholds</h2>',
    '<table>',
    '<tr><th>Instrument</th><th>Threshold</th><th>Meaning</th></tr>',
    '<tr><td>MMAS-8</td><td>score \u2265 8</td><td>High adherence</td></tr>',
    '<tr><td>MMAS-8</td><td>6 \u2264 score &lt; 8</td><td>Medium adherence</td></tr>',
    '<tr><td>MMAS-8</td><td>score &lt; 6</td><td>Low adherence (non-adherent)</td></tr>',
    '<tr><td>MAP / PEACS PE</td><td>PE \u2265 0.85</td><td>High \u2014 stable adherence</td></tr>',
    '<tr><td>MAP / PEACS PE</td><td>0.60 \u2264 PE &lt; 0.85</td><td>Moderate</td></tr>',
    '<tr><td>MAP / PEACS PE</td><td>PE &lt; 0.60</td><td>Low \u2014 high risk</td></tr>',
    '</table>',

    '<div class="ref">',
    'Bonett, D.G. (2002). Sample size requirements for testing and estimating coefficient alpha. <em>Journal of Educational and Behavioral Statistics</em>, 27(4), 335\u2013340.<br>',
    'Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Lawrence Erlbaum Associates.<br>',
    'Landis, J.R., &amp; Koch, G.G. (1977). The measurement of observer agreement for categorical data. <em>Biometrics</em>, 33(1), 159\u2013174.<br>',
    'Morisky, D.E., Ang, A., Krousel-Wood, M., &amp; Ward, H.J. (2008). Predictive validity of a medication adherence measure in an outpatient setting. <em>Journal of Clinical Hypertension</em>, 10(5), 348\u2013354.',
    '</div>'
  ].join('\n');

  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>ATLAS Psychometric Methods</title><style>' + css + '</style></head><body>' +
    '<button class="no-print" onclick="window.print()" style="float:right;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;padding:7px 16px;background:#b45309;color:#fff;border:none;border-radius:5px;cursor:pointer;margin-bottom:10px;">Print / Save as PDF</button>' +
    body + '</body></html>');
  w.document.close();
  w.focus();
}

function _stuStatsMethodsRender(body) {
  var M = 'IBM Plex Mono\',monospace';
  function _sec(title) {
    return '<div style="font-family:\'' + M + ';font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:#b45309;margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(180,83,9,0.20);">' + title + '</div>';
  }
  function _fc(name, formula, where, interp) {
    return '<div style="background:var(--card2);border-left:3px solid rgba(180,83,9,0.50);border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:8px;">' +
      '<div style="font-family:\'' + M + ';font-size:0.66rem;font-weight:700;color:var(--text);margin-bottom:4px;">' + name + '</div>' +
      '<div style="font-family:\'' + M + ';font-size:0.80rem;color:var(--text);margin:3px 0 5px;letter-spacing:0.02em;">' + formula + '</div>' +
      (where  ? '<div style="font-family:\'' + M + ';font-size:0.58rem;color:var(--dim);margin-top:3px;">' + where + '</div>' : '') +
      (interp ? '<div style="font-family:\'' + M + ';font-size:0.58rem;color:var(--muted);font-style:italic;margin-top:5px;padding-top:5px;border-top:1px solid var(--border);">' + interp + '</div>' : '') +
    '</div>';
  }
  function _tbl(headers, rows) {
    var ths = headers.map(function(h){ return '<th style="font-family:\'' + M + ';font-size:0.58rem;font-weight:600;padding:5px 10px;background:var(--card2);border:1px solid var(--border);text-align:left;">' + h + '</th>'; }).join('');
    var trs = rows.map(function(r){
      return '<tr>' + r.map(function(c){ return '<td style="font-family:\'' + M + ';font-size:0.60rem;padding:5px 10px;border:1px solid var(--border);">' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table style="border-collapse:collapse;width:100%;margin:10px 0 14px;">' +
      '<thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }

  var html =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">' +
      '<div>' +
        '<div style="font-family:\'' + M + ';font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Reference</div>' +
        '<div style="font-family:\'' + M + ';font-size:0.88rem;font-weight:700;color:var(--text);">Psychometric Methods</div>' +
        '<div style="font-family:\'' + M + ';font-size:0.60rem;color:var(--dim);margin-top:3px;">All formulas used to compute Reliability, Classification, and Effect Size statistics</div>' +
      '</div>' +
      '<button onclick="_stuStatsPrintMethods()" style="font-family:\'' + M + ';font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:7px 14px;background:rgba(180,83,9,0.08);border:1px solid rgba(180,83,9,0.38);color:#b45309;border-radius:5px;cursor:pointer;white-space:nowrap;flex-shrink:0;">&#8659; Download PDF</button>' +
    '</div>' +

    _sec('Reliability') +
    _fc('Cronbach\u2019s \u03b1 (coefficient alpha)',
        '\u03b1 = k/(k\u22121) \u00d7 (1 \u2212 \u03a3\u03c3\u1d62\u00b2 / \u03c3\u209c\u00b2)',
        'k\u2009=\u2009number of items \u2502 \u03c3\u1d62\u00b2\u2009=\u2009variance of item i \u2502 \u03c3\u209c\u00b2\u2009=\u2009variance of total score',
        '\u2265\u20090.90 excellent \u00b7 0.80\u20130.89 good \u00b7 0.70\u20130.79 acceptable \u00b7 <\u20090.70 poor') +
    _fc('95% CI for \u03b1 (Bonett, 2002)',
        'SE(\u03b1) \u2248 \u221a[ 2k(1\u2212\u03b1)\u00b2 / ((k\u22121)(N\u22121)) ] \u2003 CI: \u03b1 \u00b1 1.96 \u00d7 SE(\u03b1)',
        'N\u2009=\u2009sample size \u2502 k\u2009=\u2009number of items',
        'Bonett (2002), Journal of Educational and Behavioral Statistics, 27(4), 335\u2013340') +
    _fc('Spearman-Brown Split-Half',
        '\u03c1_SB = 2r / (1 + r)',
        'r\u2009=\u2009Pearson r between odd- and even-numbered item halves',
        'Corrects for attenuation from halving the scale') +
    _fc('McDonald\u2019s \u03c9 (composite reliability estimate)',
        '\u03c9 \u2248 (\u03a3\u03bb\u1d62)\u00b2 / [(\u03a3\u03bb\u1d62)\u00b2 + \u03a3\u03b5\u1d62\u1d62]',
        '\u03bb\u1d62\u2009=\u2009factor loading of item i \u2502 \u03b5\u1d62\u1d62\u2009=\u2009unique (error) variance',
        'Estimated from \u03b1 via loading approximation. Values \u2265 0.80 indicate adequate composite reliability') +

    _sec('Classification (Confusion Matrix)') +
    '<div style="background:var(--card2);border-left:3px solid rgba(180,83,9,0.50);border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:8px;">' +
      '<div style="font-family:\'' + M + ';font-size:0.66rem;font-weight:700;color:var(--text);margin-bottom:8px;">Confusion Matrix Cell Definitions</div>' +
      _tbl(['','Actual Positive','Actual Negative'],
        [['Predicted Positive','TP — True Positive','FP — False Positive'],
         ['Predicted Negative','FN — False Negative','TN — True Negative']]) +
      '<div style="font-family:\'' + M + ';font-size:0.58rem;color:var(--dim);">Predicted Positive\u2009=\u2009at or above published norm mean \u2502 Actual Positive\u2009=\u2009at or above clinical threshold</div>' +
    '</div>' +
    _fc('Sensitivity (Recall / True Positive Rate)',  'Sensitivity = TP / (TP + FN)', undefined, 'Of all true positives, what fraction did the instrument identify?') +
    _fc('Specificity (True Negative Rate)',           'Specificity = TN / (TN + FP)', undefined, 'Of all true negatives, what fraction did the instrument identify?') +
    _fc('PPV (Positive Predictive Value / Precision)','PPV = TP / (TP + FP)',         undefined, 'Of all cases called positive, what fraction are truly positive?') +
    _fc('NPV (Negative Predictive Value)',            'NPV = TN / (TN + FN)',         undefined, 'Of all cases called negative, what fraction are truly negative?') +
    _fc('F\u2081 Score',
        'F\u2081 = 2 \u00d7 PPV \u00d7 Sensitivity / (PPV + Sensitivity)',
        undefined,
        'Harmonic mean of PPV and Sensitivity. Closer to 1.0 is better') +
    _fc('Cohen\u2019s \u03ba (beyond-chance agreement)',
        '\u03ba = (p_obs \u2212 p_exp) / (1 \u2212 p_exp)',
        'p_obs\u2009=\u2009(TP+TN)/N \u2502 p_exp\u2009=\u2009[(TP+FP)/N \u00d7 (TP+FN)/N] + [(FN+TN)/N \u00d7 (FP+TN)/N]',
        '\u2265\u20090.80 almost perfect \u00b7 0.60\u20130.79 substantial \u00b7 0.40\u20130.59 moderate \u00b7 <\u20090.40 fair/poor') +

    _sec('Effect Size') +
    _fc('Cohen\u2019s d (one-sample vs published norm)',
        'd = (M\u0305 \u2212 \u03bc\u2080) / s',
        'M\u0305\u2009=\u2009sample mean \u2502 \u03bc\u2080\u2009=\u2009norm mean \u2502 s\u2009=\u2009sample SD',
        '|d| < 0.20 negligible \u00b7 0.20\u20130.49 small \u00b7 0.50\u20130.79 medium \u00b7 \u2265\u20090.80 large (Cohen, 1988)') +
    _fc('Cohen\u2019s d (two-sample, pooled SD)',
        'd = (M\u2081 \u2212 M\u2082) / \u221a[(s\u2081\u00b2 + s\u2082\u00b2) / 2]',
        'M\u2081, M\u2082\u2009=\u2009group means \u2502 s\u2081, s\u2082\u2009=\u2009group SDs') +
    _fc('95% CI for Cohen\u2019s d',
        'CI: d \u00b1 1.96 / \u221aN',
        'N\u2009=\u2009sample size. Approximation; exact CI uses noncentral t-distribution') +

    _sec('PE Composite Formula (MAP &amp; PEACS)') +
    _fc('Predictive Emergence (PE)',
        'PE = \u00b3\u221a(A \u00d7 E \u00d7 C_guarded)',
        'A\u2009=\u2009Architecture domain mean \u2502 E\u2009=\u2009Execution domain mean \u2502 C_raw\u2009=\u2009Context score (0\u20131)',
        'Non-compensatory geometric mean: no single domain can substitute for another') +
    _fc('Context Guard',
        'C_guarded = 0.5 + 0.5 \u00d7 C_raw',
        'Prevents C\u2009=\u20090 from collapsing PE to zero while preserving directional sensitivity') +
    _fc('INA vs UNA Classification',
        'INA (Intentional): Architecture < Execution\nUNA (Unintentional): Execution < Architecture',
        'Applies to non-high-adherence cases only',
        'INA = deliberate decision not to take medication; UNA = forgetting or practical barriers') +

    _sec('Reference Norms &amp; Clinical Thresholds') +
    _tbl(['Instrument','Metric','\u03bc (mean)','\u03c3 (SD)','Source'],
      [['MMAS-8','Total score (0\u20138)','6.52','1.85','Morisky et al., 2008 \u2502 N\u2009=\u2009272 outpatients'],
       ['MAP','PE composite','0.72','0.16','Provisional illustrative norm (not yet aggregated)'],
       ['PEACS','PE composite','0.68','0.18','Provisional illustrative norm (not yet aggregated)']]) +
    _tbl(['Instrument','Threshold','Classification'],
      [['MMAS-8','score \u2265 8','High adherence'],
       ['MMAS-8','6 \u2264 score < 8','Medium adherence'],
       ['MMAS-8','score < 6','Low adherence (non-adherent)'],
       ['MAP / PEACS','PE \u2265 0.85','High \u2014 stable adherence'],
       ['MAP / PEACS','0.60 \u2264 PE < 0.85','Moderate'],
       ['MAP / PEACS','PE < 0.60','Low \u2014 high risk']]) +

    '<div style="font-family:\'' + M + ';font-size:0.56rem;color:var(--dim);margin-top:20px;padding-top:12px;border-top:1px solid var(--border);line-height:1.7;">' +
      'Bonett, D.G. (2002). Sample size requirements for testing and estimating coefficient alpha. <em>Journal of Educational and Behavioral Statistics</em>, 27(4), 335\u2013340.<br>' +
      'Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Lawrence Erlbaum Associates.<br>' +
      'Landis, J.R., &amp; Koch, G.G. (1977). The measurement of observer agreement for categorical data. <em>Biometrics</em>, 33(1), 159\u2013174.<br>' +
      'Morisky, D.E., Ang, A., Krousel-Wood, M., &amp; Ward, H.J. (2008). Predictive validity of a medication adherence measure in an outpatient setting. <em>Journal of Clinical Hypertension</em>, 10(5), 348\u2013354.' +
    '</div>';

  body.innerHTML = html;
}

// ── CLASSIFICATION ────────────────────────────────────────────────────────────
// ── 2×2 confusion matrix grid ─────────────────────────────────────────────────
function _stuConfusionGrid(tp, fp, fn, tn, posLabel, negLabel, threshNote) {
  var n   = (tp+fp+fn+tn) || 1;
  var sens = (tp+fn)>0 ? tp/(tp+fn) : NaN;
  var spec = (tn+fp)>0 ? tn/(tn+fp) : NaN;
  var ppv  = (tp+fp)>0 ? tp/(tp+fp) : NaN;
  var npv  = (tn+fn)>0 ? tn/(tn+fn) : NaN;
  var f1   = (2*tp+fp+fn)>0 ? 2*tp/(2*tp+fp+fn) : NaN;
  var pObs = (tp+tn)/n;
  var pExp = ((tp+fp)*(tp+fn)+(tn+fn)*(tn+fp))/(n*n);
  var kappa = pExp<1 ? (pObs-pExp)/(1-pExp) : NaN;
  var fm   = function(v,d){ return isFinite(v)?v.toFixed(d!=null?d:3):'—'; };

  var cell = function(v, diag, abbr) {
    var pct = Math.round(v/n*100);
    var bg  = diag ? 'rgba(5,150,105,0.13)' : 'rgba(220,38,38,0.08)';
    var col = diag ? '#059669' : '#dc2626';
    return '<td style="padding:12px 16px;background:'+bg+';border-radius:5px;text-align:center;vertical-align:middle;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.30rem;font-weight:700;color:'+col+';">'+v+'</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--dim);margin-top:1px;">'+pct+'%</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;color:'+col+';opacity:0.8;margin-top:2px;letter-spacing:0.06em;">'+abbr+'</div>' +
    '</td>';
  };
  var hdr = function(label) {
    return '<th style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;font-weight:500;color:var(--dim);padding:4px 16px;text-align:center;">'+label+'</th>';
  };

  var grid =
    '<table style="border-collapse:separate;border-spacing:5px;margin-bottom:14px;">' +
      '<thead><tr>' +
        '<td style="padding:4px 8px;"></td>' +
        '<td colspan="2" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:4px 16px;text-align:center;">Actual</td>' +
      '</tr><tr>' +
        '<td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:4px 8px;writing-mode:vertical-lr;transform:rotate(180deg);text-align:center;vertical-align:middle;">Predicted</td>' +
        hdr(posLabel) + hdr(negLabel) +
      '</tr></thead>' +
      '<tbody>' +
        '<tr><td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--muted);padding:4px 10px;text-align:right;white-space:nowrap;">'+posLabel+'</td>' + cell(tp,true,'TP') + cell(fp,false,'FP') + '</tr>' +
        '<tr><td style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--muted);padding:4px 10px;text-align:right;white-space:nowrap;">'+negLabel+'</td>' + cell(fn,false,'FN') + cell(tn,true,'TN') + '</tr>' +
      '</tbody>' +
    '</table>';

  var metrics =
    '<div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:10px;">' +
      _stuStatsStat('Sensitivity', fm(sens), 'TP / (TP+FN)', isFinite(sens)?sens>=0.70:undefined) +
      _stuStatsStat('Specificity', fm(spec), 'TN / (TN+FP)', isFinite(spec)?spec>=0.70:undefined) +
      _stuStatsStat('PPV', fm(ppv), 'precision', undefined) +
      _stuStatsStat('NPV', fm(npv), 'neg. pred. value', undefined) +
      _stuStatsStat('F1', fm(f1), 'harmonic mean', isFinite(f1)?f1>=0.70:undefined) +
      _stuStatsStat('Cohen\'s κ', fm(kappa), 'beyond-chance agreement', isFinite(kappa)?kappa>=0.60:undefined) +
    '</div>' +
    (threshNote ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--dim);line-height:1.6;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">'+threshNote+'</div>' : '');

  return grid + metrics;
}

function _stuStatsClassification(body) {
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mmasRows = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var mapRows  = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var html     = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);margin-bottom:14px;">Binary confusion matrices, sensitivity/specificity, and Cohen\'s κ for your cohort.</div>';

  // MMAS-8 binary confusion: Predicted = score ≥ 6.52 (norm mean), Actual = score ≥ 6 (clinical)
  if (mmasRows.length >= 5) {
    var n = mmasRows.length;
    var tp=0, fp=0, fn=0, tn=0;
    mmasRows.forEach(function(r) {
      var s = parseFloat(r.score)||0;
      var predPos = s >= 6.52;  // at or above norm mean → predicted adherent
      var actPos  = s >= 6;     // clinical adherence threshold
      if (predPos && actPos)  tp++;
      else if (predPos && !actPos) fp++;
      else if (!predPos && actPos) fn++;
      else tn++;
    });
    var nHigh=mmasRows.filter(function(r){return parseFloat(r.score)>=8;}).length;
    var nMed =mmasRows.filter(function(r){var s=parseFloat(r.score);return s>=6&&s<8;}).length;
    var nLow =mmasRows.filter(function(r){return parseFloat(r.score)<6;}).length;
    html += _stuStatsCard('MMAS-8 — Classification Matrix (N\u2009=\u2009' + n + ')',
      _stuConfusionGrid(tp, fp, fn, tn, 'Adherent', 'Non-Adherent',
        'Predicted Adherent: score\u2009\u2265\u20096.52 (published outpatient norm mean, Morisky et al. 2008). ' +
        'Actual Adherent: score\u2009\u2265\u20096 (clinical threshold). ' +
        'Category breakdown\u2009— High (score\u2009=\u20098): '+nHigh+'\u2009('+Math.round(nHigh/n*100)+'%) · ' +
        'Medium: '+nMed+'\u2009('+Math.round(nMed/n*100)+'%) · Low: '+nLow+'\u2009('+Math.round(nLow/n*100)+'%).')
    );
  } else if (mmasRows.length > 0) {
    html += _stuStatsCard('MMAS-8 — Classification Matrix', _stuStatsEmpty('MMAS-8 (need \u2265 5)'));
  }

  // MAP binary confusion: Predicted = PE ≥ 0.72 (provisional threshold), Actual = PE ≥ 0.60 (moderate threshold)
  if (mapRows.length >= 5) {
    var n = mapRows.length;
    var tp=0, fp=0, fn=0, tn=0;
    mapRows.forEach(function(r) {
      var a=parseFloat(r.arch_score)||((+(r.map_q2||r.q2)||0)+(+(r.map_q3||r.q3)||0)+(+(r.map_q6||r.q6)||0))/3;
      var e=parseFloat(r.exec_score)||((+(r.map_q1||r.q1)||0)+(+(r.map_q5||r.q5)||0)+(+(r.map_q8||r.q8)||0))/3;
      var c=parseFloat(r.ctx_score)||Math.max(0.5,0.5+0.5*((+(r.map_q4||r.q4)||0)+(+(r.map_q7||r.q7)||0))/2);
      var pe=Math.pow(Math.max(0,a*e*c),1/3);
      var predPos = pe >= 0.72;
      var actPos  = pe >= 0.60;
      if (predPos && actPos)  tp++;
      else if (predPos && !actPos) fp++;
      else if (!predPos && actPos) fn++;
      else tn++;
    });
    html += _stuStatsCard('MAP — PE Classification Matrix (N\u2009=\u2009' + n + ')',
      _stuConfusionGrid(tp, fp, fn, tn, 'High PE', 'Low PE',
        'Predicted High PE: PE\u2009\u2265\u20090.72 (provisional illustrative threshold \u2014 no externally validated MAP baseline exists yet). ' +
        'Actual High PE: PE\u2009\u2265\u20090.60 (moderate adherence threshold). ' +
        'PE uses non-compensatory geometric mean with Context Guard (C\u2099 = 0.5 + 0.5 \u00d7 C).')
    );
  } else if (mapRows.length > 0) {
    html += _stuStatsCard('MAP — PE Classification Matrix', _stuStatsEmpty('MAP (need \u2265 5)'));
  }

  // PEACS binary confusion: Predicted = PE ≥ 0.68 (PEACS norm), Actual = PE ≥ 0.60
  var peacsRecs = window._rppPeacsData||[];
  if (peacsRecs.length >= 5) {
    var peVals = peacsRecs.map(function(r){return parseFloat(r.pe_score||r.pe)||0;});
    var n = peVals.length;
    var tp=0, fp=0, fn=0, tn=0;
    peVals.forEach(function(pe) {
      var predPos = pe >= 0.68;
      var actPos  = pe >= 0.60;
      if (predPos && actPos)  tp++;
      else if (predPos && !actPos) fp++;
      else if (!predPos && actPos) fn++;
      else tn++;
    });
    html += _stuStatsCard('PEACS — PE Classification Matrix (N\u2009=\u2009' + n + ')',
      _stuConfusionGrid(tp, fp, fn, tn, 'High PE', 'Low PE',
        'Predicted High PE: PE\u2009\u2265\u20090.68 (provisional illustrative threshold \u2014 no externally validated PEACS baseline exists yet). Actual High PE: PE\u2009\u2265\u20090.60.')
    );
  } else if (peacsRecs.length > 0) {
    html += _stuStatsCard('PEACS — PE Classification Matrix', _stuStatsEmpty('PEACS (need \u2265 5)'));
  }

  if (mmasRows.length===0 && mapRows.length===0 && (window._rppPeacsData||[]).length===0) {
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);">No assessment data uploaded yet.</div>';
  }

  body.innerHTML = html;
}

// ── EFFECT SIZE ───────────────────────────────────────────────────────────────
function _stuStatsEffectSize(body) {
  var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData)) ? dashMmasData : [];
  var mmasRows = allRows.filter(function(r){return r.tool!=='map'&&r.map_q1===undefined;});
  var mapRows  = allRows.filter(function(r){return r.tool==='map'||r.map_q1!==undefined;});
  var peacsRecs = window._rppPeacsData||[];

  var html = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);margin-bottom:14px;">Cohen\'s d effect sizes comparing your cohort to published normative benchmarks. Use these in your thesis Results section.</div>';

  // ── Forest-plot row helper ──
  function _forestRow(label, d, ciLow, ciHigh, norm, col) {
    if (!isFinite(d)) return '';
    var barMax = 2.0; // ±2 SD range display
    var center = 50;  // 50% = 0
    var pct    = center + (d/barMax)*50;
    pct = Math.max(2, Math.min(98, pct));
    var ciLowPct  = isFinite(ciLow)  ? Math.max(2,  Math.min(98, center+(ciLow/barMax)*50))  : pct-4;
    var ciHighPct = isFinite(ciHigh) ? Math.max(2,  Math.min(98, center+(ciHigh/barMax)*50)) : pct+4;
    var effStr = _stuEffLabel(d);
    var dSign  = d>=0?'+':'';
    return '<div style="margin-bottom:12px;">' +
      '<div style="display:flex;justify-content:space-between;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--muted);margin-bottom:4px;">' +
        '<span>' + label + '</span>' +
        '<span style="color:' + col + ';">d\u2009=\u2009' + dSign + d.toFixed(2) + ' <span style="color:var(--dim);font-size:0.58rem;">(' + effStr + ')</span></span>' +
      '</div>' +
      '<div style="position:relative;height:12px;background:var(--card);border-radius:2px;overflow:visible;">' +
        '<div style="position:absolute;top:3px;bottom:3px;left:' + ciLowPct + '%;width:' + (ciHighPct-ciLowPct) + '%;background:' + col + ';opacity:0.22;border-radius:2px;"></div>' +
        '<div style="position:absolute;top:50%;left:50%;width:1px;height:100%;background:var(--border2);transform:translateX(-50%);"></div>' +
        '<div style="position:absolute;top:50%;left:' + pct + '%;width:8px;height:8px;border-radius:50%;background:' + col + ';transform:translate(-50%,-50%);"></div>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--dim);margin-top:3px;">vs norm: ' + norm + '</div>' +
    '</div>';
  }

  // ── MMAS-8 vs published norms ──
  if (mmasRows.length >= 5) {
    var scores = mmasRows.map(function(r){return parseFloat(r.score)||0;});
    var m = _stuStatsMean(scores), s = _stuStatsSD(scores);
    var normM=6.52, normS=1.85;
    var d = _stuStatsCohenD(m, s, normM, normS);
    var se_d = Math.sqrt((1/mmasRows.length)+(d*d/(2*(mmasRows.length-1))));
    var ciLo = d-1.96*se_d, ciHi = d+1.96*se_d;
    html += _stuStatsCard('MMAS-8 — Effect Size vs Morisky Outpatient Norms',
      _forestRow('MMAS-8 Score', d, ciLo, ciHi, '\u03bc\u2009=\u20096.52, SD\u2009=\u20091.85 (Morisky et al., 2008)', '#2563eb') +
      _stuStatsStat('Your Mean', m.toFixed(2), 'SD\u2009=\u2009'+s.toFixed(2), undefined) +
      _stuStatsStat('Norm Mean', normM.toFixed(2), 'SD\u2009=\u2009'+normS.toFixed(2), undefined) +
      _stuStatsStat('Cohen\'s d', d.toFixed(2), _stuEffLabel(d)+' effect', d>0) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);line-height:1.65;">' +
        'APA format: d\u2009=\u2009' + d.toFixed(2) + ', 95% CI [' + ciLo.toFixed(2) + ', ' + ciHi.toFixed(2) + ']. ' +
        (d>0?'Your cohort scores higher than the normative outpatient sample.':d<0?'Your cohort scores lower than the normative outpatient sample.':'Your cohort is similar to the normative sample.') +
      '</div>'
    );
  } else if (mmasRows.length > 0) {
    html += _stuStatsCard('MMAS-8 — Effect Size', _stuStatsEmpty('MMAS-8 (need \u2265 5)'));
  }

  // ── MAP vs Provisional illustrative norm (not yet aggregated) ──
  if (mapRows.length >= 5) {
    var peVals = mapRows.map(function(r){
      var a = parseFloat(r.arch_score)||((parseFloat(r.map_q2||r.q2||0)+parseFloat(r.map_q3||r.q3||0)+parseFloat(r.map_q6||r.q6||0))/3);
      var e = parseFloat(r.exec_score)||((parseFloat(r.map_q1||r.q1||0)+parseFloat(r.map_q5||r.q5||0)+parseFloat(r.map_q8||r.q8||0))/3);
      var cg = parseFloat(r.ctx_score)||Math.max(0.5,0.5+0.5*((parseFloat(r.map_q4||r.q4||0)+parseFloat(r.map_q7||r.q7||0))/2));
      return Math.pow(Math.max(0,a*e*cg),1/3);
    });
    var m = _stuStatsMean(peVals), s = _stuStatsSD(peVals);
    var normM=0.72, normS=0.16;
    var d = _stuStatsCohenD(m, s, normM, normS);
    var se_d = Math.sqrt((1/mapRows.length)+(d*d/(2*(mapRows.length-1))));
    var ciLo = d-1.96*se_d, ciHi = d+1.96*se_d;
    html += _stuStatsCard('MAP — PE Effect Size vs Provisional Baseline',
      _forestRow('Predictive Emergence (PE)', d, ciLo, ciHi, '\u03bc\u2009=\u20090.72, SD\u2009=\u20090.16 (provisional — not yet externally validated)', '#059669') +
      _stuStatsStat('Your PE Mean', m.toFixed(3), 'SD\u2009=\u2009'+s.toFixed(3), undefined) +
      _stuStatsStat('Baseline PE', normM.toFixed(2), 'SD\u2009=\u2009'+normS.toFixed(2), undefined) +
      _stuStatsStat('Cohen\'s d', d.toFixed(2), _stuEffLabel(d)+' effect', d>0) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);line-height:1.65;">' +
        'APA format: d\u2009=\u2009' + d.toFixed(2) + ', 95% CI [' + ciLo.toFixed(2) + ', ' + ciHi.toFixed(2) + '].' +
      '</div>'
    );
  } else if (mapRows.length > 0) {
    html += _stuStatsCard('MAP — PE Effect Size', _stuStatsEmpty('MAP (need \u2265 5)'));
  }

  // ── PEACS vs ATLAS baseline ──
  if (peacsRecs.length >= 5) {
    var peVals = peacsRecs.map(function(r){return parseFloat(r.pe_score||r.pe)||0;}).filter(function(v){return v>0;});
    var m = _stuStatsMean(peVals), s = _stuStatsSD(peVals);
    var normM=0.68, normS=0.18;
    var d = _stuStatsCohenD(m, s, normM, normS);
    var se_d = Math.sqrt((1/peVals.length)+(d*d/(2*(peVals.length-1))));
    var ciLo = d-1.96*se_d, ciHi = d+1.96*se_d;
    html += _stuStatsCard('PEACS — PE Effect Size vs Provisional Baseline',
      _forestRow('PEACS PE Composite', d, ciLo, ciHi, '\u03bc\u2009=\u20090.68, SD\u2009=\u20090.18 (provisional — not yet externally validated)', '#7c3aed') +
      _stuStatsStat('Your PE Mean', m.toFixed(3), 'SD\u2009=\u2009'+s.toFixed(3), undefined) +
      _stuStatsStat('Baseline PE', normM.toFixed(2), 'SD\u2009=\u2009'+normS.toFixed(2), undefined) +
      _stuStatsStat('Cohen\'s d', d.toFixed(2), _stuEffLabel(d)+' effect', d>0) +
      '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);line-height:1.65;">' +
        'APA format: d\u2009=\u2009' + d.toFixed(2) + ', 95% CI [' + ciLo.toFixed(2) + ', ' + ciHi.toFixed(2) + ']. ' +
        'Report effect size, CI, and normative reference in your Results section.' +
      '</div>'
    );
  } else if (peacsRecs.length > 0) {
    html += _stuStatsCard('PEACS — PE Effect Size', _stuStatsEmpty('PEACS (need \u2265 5)'));
  }

  if (mmasRows.length===0 && mapRows.length===0 && peacsRecs.length===0) {
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);">No assessment data yet.</div>';
  }

  body.innerHTML = html;
}
// End Module 14 — Statistics Panel

// ══════════════════════════════════════════════════════════════════════════
// ACRONYM GLOSSARY MODAL
// Opened via the "Glossary" button in the student workspace header.
// Lists all ATLAS acronyms used in the student and patient-facing views.
// ══════════════════════════════════════════════════════════════════════════

var _STU_GLOSSARY_TERMS = [
  { term: 'MAP',    def: 'Multidimensional Adherence Parameters — measures Architecture, Execution, and Context domains' },
  { term: 'PEACS',  def: 'Predictive Emergence Assessment for Clinical Services — 22-item composite instrument with three scales (BASE, MVMT, STRATA) measuring Architecture, Execution, and Context at different temporal intervals' },
  { term: 'GAI',    def: 'Global Adherence Index — annually published country-level triadic adherence profiles (Architecture, Execution, Context domain means per country)' },
  { term: 'MMAS-8', def: 'Morisky Medication Adherence Scale — 8-item validated adherence instrument, scientific foundation for MAP' },
  { term: 'INA',    def: 'Intentional Non-Adherence — patient chooses not to take medication' },
  { term: 'UNA',    def: 'Unintentional Non-Adherence — patient forgets or has barriers to taking medication' },
  { term: 'PE',     def: 'Predictive Emergence — geometric mean composite adherence score: (Architecture x Execution x Context-Guard)^(1/3)' },
  { term: 'BASE',   def: 'Behavioral Architecture and Stability Evaluation — PEACS Scale 01 (Architecture domain). Measures structural conditions: access reliability, regimen clarity, care relationship quality, and infrastructural support. 7 items, assessed monthly.' },
  { term: 'MVMT',   def: 'Measurable Variance Minimal Term — PEACS Scale 02 (Execution domain). Measures behavioral trajectory and drift resistance: whether adherence is stable, improving, or eroding over time. 7 items, assessed weekly.' },
  { term: 'STRATA', def: 'Social and Treatment Relational Access and Terrain — PEACS Scale 03 (Context domain). Measures socioeconomic, cultural, and environmental conditions: treatment continuity access, health literacy, social support, care system trust. 8 items, assessed quarterly.' },
  { term: 'SDoH',   def: 'Social Determinants of Health — environmental factors affecting adherence' },
  { term: 'PI',     def: 'Principal Investigator — researcher managing a study workspace' },
];

/**
 * Opens the ATLAS Acronym Glossary modal.
 * Creates the modal on first call, then shows it on subsequent calls.
 * @returns {void}
 */
function openStuGlossary() {
  var existing = document.getElementById('stu-glossary-modal');
  if (existing) { existing.style.display = 'flex'; document.body.style.overflow = 'hidden'; return; }

  var modal = document.createElement('div');
  modal.id = 'stu-glossary-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = (
    '<div style="background:var(--card,#111d30);border:1px solid var(--border,#1e2d45);border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.6);">' +
      '<div style="padding:20px 24px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--border2,#1e2d45);">' +
          '<div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">ATLAS · Reference</div>' +
            '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.25rem;font-weight:600;color:var(--bright);">Acronym Glossary</div>' +
          '</div>' +
          '<button onclick="closeStuGlossary()" style="background:none;border:none;font-size:1.2rem;color:var(--muted);cursor:pointer;padding:4px 8px;border-radius:6px;transition:color 0.15s;" onmouseover="this.style.color=\'var(--text)\'" onmouseout="this.style.color=\'var(--muted)\'">\u2715</button>' +
        '</div>' +
      '</div>' +
      '<div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:0;">' +
        _STU_GLOSSARY_TERMS.map(function(t, i) {
          var borderTop = i === 0 ? '' : 'border-top:1px solid var(--border2,#1e2d45);';
          return (
            '<div style="display:flex;gap:14px;padding:12px 0;' + borderTop + 'align-items:flex-start;">' +
              '<div style="min-width:66px;font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;font-weight:700;color:var(--base,#4e9cf5);letter-spacing:0.04em;flex-shrink:0;padding-top:1px;">' + t.term + '</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.73rem;color:var(--text,#e0e0e0);line-height:1.6;">' + t.def + '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>' +
    '</div>'
  );

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeStuGlossary();
  });

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

/**
 * Closes and hides the ATLAS Acronym Glossary modal.
 * @returns {void}
 */
function closeStuGlossary() {
  var modal = document.getElementById('stu-glossary-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

window.openStuGlossary  = openStuGlossary;
window.closeStuGlossary = closeStuGlossary;

// ══════════════════════════════════════════════════════════════════════════
// ATLAS EVIDENCE PORTFOLIO
// Renders a timestamped evidence record of the student's ATLAS activities
// suitable for inclusion in CV / residency / grant applications.
// Container: res-portfolio-body (injected by auth-workspace.js _waveModules)
// ══════════════════════════════════════════════════════════════════════════

function renderStudentPortfolio(containerId, uid, wsKey) {
  var el = document.getElementById(containerId);
  if (!el) return;

  var C = window._ATLAS_COLORS || {
    amber:'#d4a843', amberFaint:'rgba(212,168,67,0.09)', amberBdr:'rgba(212,168,67,0.3)',
    cyan:'#38bdf8',  green:'#2ec98a', purple:'#8b6ff5',  red:'#ef4444', blue:'#4e9cf5',
    text:'rgba(205,216,232,0.92)', muted:'rgba(138,160,184,0.8)', dim:'rgba(96,120,152,0.65)',
    border:'rgba(212,168,67,0.12)', surface:'#0d1b2e', card:'#111d30',
  };

  var M = '\'IBM Plex Mono\',monospace';
  var S = '\'Cormorant Garamond\',Georgia,serif';

  el.innerHTML = '<div style="text-align:center;padding:32px;font-family:' + M + ';font-size:0.80rem;color:' + C.muted + ';">Building portfolio…</div>';

  // Load data from Firebase in parallel
  var db = (typeof database !== 'undefined') ? database : null;
  if (!db || !wsKey) {
    el.innerHTML = '<div style="font-family:' + M + ';font-size:0.76rem;color:' + C.dim + ';padding:24px;text-align:center;">Portfolio requires an active workspace key.</div>';
    return;
  }

  var assessPath = 'assessments';
  var certPath   = 'map_cert_progress/' + (uid || 'anon');
  var studyPath  = 'research_studies';

  Promise.all([
    db.ref(assessPath).orderByChild('institution_code').equalTo(wsKey).limitToLast(500).once('value'),
    db.ref(certPath).once('value'),
    db.ref(studyPath).orderByChild('workspace_key').equalTo(wsKey).limitToLast(50).once('value'),
  ]).then(function(results) {
    var assessSnap = results[0];
    var certSnap   = results[1];
    var studySnap  = results[2];

    var assessments = [];
    assessSnap.forEach(function(child) { assessments.push(child.val()); });

    var certData = certSnap.val() || {};
    var studies  = [];
    studySnap.forEach(function(child) { studies.push(child.val()); });

    // Compute stats
    var mapRecs   = assessments.filter(function(r){ return r.map_q1 !== undefined; });
    var mmasRecs  = assessments.filter(function(r){ return r.score !== undefined && r.map_q1 === undefined; });
    var totalRecs = assessments.length;

    var peScores = mapRecs.map(function(r){
      var a = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
      var e = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
      var c = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
      return Math.pow(Math.max(0, a*e*c), 1/3);
    });
    var meanPE = peScores.length ? peScores.reduce(function(a,b){return a+b;},0)/peScores.length : null;

    // Certification levels completed
    var certLevels = {
      foundation:    !!(certData.foundation    && certData.foundation.completed),
      practitioner:  !!(certData.practitioner  && certData.practitioner.completed),
      specialist:    !!(certData.specialist    && certData.specialist.completed),
      fellow:        !!(certData.fellow        && certData.fellow.completed),
    };
    var certCount = Object.values(certLevels).filter(Boolean).length;

    // Build timeline events from assessments and studies
    var events = [];
    assessments.forEach(function(r) {
      if (!r.timestamp) return;
      var label = r.map_q1 !== undefined ? 'MAP Assessment administered' : 'MMAS-8 Assessment administered';
      events.push({ ts: +r.timestamp, label: label, color: r.map_q1 !== undefined ? C.green : C.blue, tag: r.map_q1 !== undefined ? 'MAP' : 'MMAS-8' });
    });
    studies.forEach(function(s) {
      if (s.created) events.push({ ts: +s.created, label: 'Study registered: ' + (s.title || s.study_title || 'Unnamed'), color: C.amber, tag: 'STUDY', atlasId: s.atlas_id });
    });
    if (certData.foundation    && certData.foundation.completed_ts)   events.push({ ts: +certData.foundation.completed_ts,   label: 'MAP Foundation Certification completed',   color: '#d4a843', tag: 'CERT' });
    if (certData.practitioner  && certData.practitioner.completed_ts) events.push({ ts: +certData.practitioner.completed_ts, label: 'MAP Practitioner Certification completed', color: '#38bdf8', tag: 'CERT' });
    if (certData.specialist    && certData.specialist.completed_ts)   events.push({ ts: +certData.specialist.completed_ts,   label: 'MAP Specialist Certification completed',   color: '#2ec98a', tag: 'CERT' });
    if (certData.fellow        && certData.fellow.completed_ts)       events.push({ ts: +certData.fellow.completed_ts,       label: 'MAP Fellow Certification completed',       color: '#8b6ff5', tag: 'CERT' });
    events.sort(function(a,b){ return b.ts - a.ts; });

    // Date helpers
    function _fmtDate(ts) {
      if (!ts) return '—';
      var d = new Date(ts);
      return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    }

    var atlasId = (window._stuAtlasId || (studies.length ? studies[0].atlas_id : null) || '—');

    // Render
    var h = '';

    // ── Header ──────────────────────────────────────────────────────────────────
    h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;">';
    h += '  <div>';
    h += '    <div style="font-family:' + M + ';font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:' + C.dim + ';margin-bottom:3px;">ATLAS Evidence Portfolio</div>';
    h += '    <div style="font-family:' + S + ';font-size:1.55rem;font-weight:300;color:' + C.text + ';line-height:1.2;margin-bottom:6px;">Research Record</div>';
    h += '    <div style="font-family:' + M + ';font-size:0.72rem;color:' + C.muted + ';">Workspace: <span style="color:' + C.amber + ';">' + wsKey + '</span></div>';
    h += '    <div style="font-family:' + M + ';font-size:0.72rem;color:' + C.muted + ';margin-top:2px;">ATLAS ID: <span style="color:' + C.green + ';letter-spacing:0.06em;">' + atlasId + '</span></div>';
    h += '    <div style="font-family:' + M + ';font-size:0.70rem;color:' + C.dim + ';margin-top:2px;">Generated: ' + _fmtDate(Date.now()) + ' · ATLAS v8.9.3</div>';
    h += '  </div>';
    h += '  <button onclick="window._stuPrintPortfolio()" style="flex-shrink:0;font-family:' + M + ';font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 14px;border-radius:6px;cursor:pointer;border:1px solid ' + C.amberBdr + ';background:' + C.amberFaint + ';color:' + C.amber + ';">&#8659; Export PDF</button>';
    h += '</div>';

    // ── KPI strip ────────────────────────────────────────────────────────────────
    var kpis = [
      { val: totalRecs.toLocaleString(), lbl: 'Total Assessments', col: C.cyan },
      { val: mapRecs.length.toLocaleString(),  lbl: 'MAP Administered', col: C.green },
      { val: mmasRecs.length.toLocaleString(), lbl: 'MMAS-8 Administered', col: C.blue },
      { val: meanPE !== null ? meanPE.toFixed(3) : '—', lbl: 'Mean PE Score', col: C.amber },
      { val: certCount + '/4', lbl: 'Cert Levels', col: C.purple },
      { val: studies.length.toLocaleString(), lbl: 'Registered Studies', col: '#f59e0b' },
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px;">';
    kpis.forEach(function(k) {
      h += '<div style="background:' + C.surface + ';border:1px solid ' + C.border + ';border-radius:8px;padding:12px 14px;">';
      h += '  <div style="font-size:1.35rem;font-weight:700;color:' + k.col + ';font-family:' + M + ';letter-spacing:-0.02em;">' + k.val + '</div>';
      h += '  <div style="font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:' + C.dim + ';margin-top:3px;">' + k.lbl + '</div>';
      h += '</div>';
    });
    h += '</div>';

    // ── Certification badges ──────────────────────────────────────────────────────
    var certDefs = [
      { key:'foundation',   label:'Foundation',   color:'#d4a843' },
      { key:'practitioner', label:'Practitioner', color:'#38bdf8' },
      { key:'specialist',   label:'Specialist',   color:'#2ec98a' },
      { key:'fellow',       label:'Fellow',       color:'#8b6ff5' },
    ];
    h += '<div style="margin-bottom:20px;">';
    h += '<div style="font-family:' + M + ';font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:' + C.dim + ';margin-bottom:10px;">MAP Certification Pathway</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
    certDefs.forEach(function(cd) {
      var done = certLevels[cd.key];
      var completedDate = (certData[cd.key] && certData[cd.key].completed_ts) ? _fmtDate(certData[cd.key].completed_ts) : null;
      h += '<div style="background:' + (done ? 'rgba('+_hexToRgb(cd.color)+',0.10)' : C.surface) + ';border:1px solid ' + (done ? cd.color+'55' : C.border) + ';border-radius:8px;padding:12px 14px;min-width:120px;flex:1;">';
      h += '  <div style="font-size:1.4rem;margin-bottom:6px;">' + (done ? '◉' : '○') + '</div>';
      h += '  <div style="font-family:' + M + ';font-size:0.72rem;font-weight:700;color:' + (done ? cd.color : C.dim) + ';">MAP ' + cd.label + '</div>';
      h += '  <div style="font-family:' + M + ';font-size:0.60rem;color:' + C.dim + ';margin-top:3px;">' + (done && completedDate ? 'Earned ' + completedDate : (done ? 'Completed' : 'Not yet completed')) + '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    // ── Registered studies ────────────────────────────────────────────────────────
    if (studies.length) {
      h += '<div style="margin-bottom:20px;">';
      h += '<div style="font-family:' + M + ';font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:' + C.dim + ';margin-bottom:10px;">Registered Studies</div>';
      studies.forEach(function(s) {
        h += '<div style="background:' + C.surface + ';border:1px solid ' + C.border + ';border-left:3px solid ' + C.amber + ';border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:8px;">';
        h += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">';
        h += '    <div style="font-family:' + M + ';font-size:0.82rem;font-weight:700;color:' + C.text + ';">' + ((s.title||s.study_title||'Unnamed Study').substring(0,60)) + '</div>';
        h += '    <span style="font-family:' + M + ';font-size:0.62rem;color:' + C.green + ';letter-spacing:0.08em;white-space:nowrap;">' + (s.atlas_id || '—') + '</span>';
        h += '  </div>';
        h += '  <div style="font-family:' + M + ';font-size:0.68rem;color:' + C.muted + ';margin-top:4px;">Registered ' + _fmtDate(s.created) + (s.condition ? ' · ' + s.condition : '') + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }

    // ── Activity timeline (last 30 events) ───────────────────────────────────────
    if (events.length) {
      h += '<div>';
      h += '<div style="font-family:' + M + ';font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:' + C.dim + ';margin-bottom:10px;">Activity Timeline (most recent)</div>';
      events.slice(0, 30).forEach(function(ev) {
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid ' + C.border + ';">';
        h += '  <span style="font-family:' + M + ';font-size:0.60rem;padding:2px 6px;border-radius:10px;background:' + ev.color + '1a;color:' + ev.color + ';white-space:nowrap;margin-top:1px;">' + ev.tag + '</span>';
        h += '  <div style="flex:1;">';
        h += '    <div style="font-family:' + M + ';font-size:0.78rem;color:' + C.text + ';">' + ev.label + (ev.atlasId ? ' (' + ev.atlasId + ')' : '') + '</div>';
        h += '    <div style="font-family:' + M + ';font-size:0.64rem;color:' + C.dim + ';margin-top:1px;">' + _fmtDate(ev.ts) + '</div>';
        h += '  </div>';
        h += '</div>';
      });
      h += '</div>';
    }

    if (!totalRecs && !studies.length && !certCount) {
      h += '<div style="text-align:center;padding:40px 16px;font-family:' + M + ';font-size:0.80rem;color:' + C.muted + ';line-height:1.7;">';
      h += 'Your portfolio will populate as you administer assessments, register studies, and earn MAP certifications.<br/>';
      h += '<span style="color:' + C.dim + ';font-size:0.72rem;">All ATLAS activity is automatically timestamped and recorded here.</span>';
      h += '</div>';
    }

    el.innerHTML = h;

    // Attach print function
    window._stuPrintPortfolio = function() {
      var win = window.open('', '_blank');
      if (!win) { showToast('Allow pop-ups to export portfolio.', 3000); return; }
      win.document.write('<html><head><title>ATLAS Evidence Portfolio</title>'
        + '<style>body{font-family:"IBM Plex Mono",monospace;font-size:11px;color:#1a1a1a;padding:32px;}'
        + 'h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:300;font-size:28px;margin-bottom:4px;}'
        + '.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;}'
        + '.kpi{border:1px solid #ddd;border-radius:6px;padding:10px 14px;}'
        + '.kpi-val{font-size:22px;font-weight:700;margin-bottom:2px;}'
        + '.kpi-lbl{font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#888;}'
        + '.event-row{display:flex;gap:10px;padding:5px 0;border-bottom:1px solid #eee;font-size:10px;}'
        + '.tag{padding:1px 5px;border-radius:8px;font-size:9px;letter-spacing:0.08em;}'
        + '@media print{body{padding:0;}}</style></head><body>');
      win.document.write('<h1>ATLAS Evidence Portfolio</h1>');
      win.document.write('<p style="font-size:10px;color:#888;">ATLAS ID: ' + atlasId + ' &nbsp;|&nbsp; Workspace: ' + wsKey + ' &nbsp;|&nbsp; Generated: ' + _fmtDate(Date.now()) + '</p>');
      win.document.write('<hr>');
      win.document.write('<div class="kpi-grid">');
      kpis.forEach(function(k){ win.document.write('<div class="kpi"><div class="kpi-val">' + k.val + '</div><div class="kpi-lbl">' + k.lbl + '</div></div>'); });
      win.document.write('</div><hr>');
      win.document.write('<h3 style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">MAP Certification</h3>');
      certDefs.forEach(function(cd){
        win.document.write('<p>' + (certLevels[cd.key] ? '✓' : '○') + ' MAP ' + cd.label + (certLevels[cd.key] && certData[cd.key] && certData[cd.key].completed_ts ? ' — Earned ' + _fmtDate(certData[cd.key].completed_ts) : '') + '</p>');
      });
      if (studies.length) {
        win.document.write('<hr><h3 style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">Registered Studies</h3>');
        studies.forEach(function(s){ win.document.write('<p><strong>' + (s.atlas_id||'—') + '</strong> — ' + (s.title||s.study_title||'Unnamed Study') + ' &nbsp;(' + _fmtDate(s.created) + ')</p>'); });
      }
      if (events.length) {
        win.document.write('<hr><h3 style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#666;">Activity Timeline</h3>');
        events.slice(0, 30).forEach(function(ev){ win.document.write('<div class="event-row"><span>[' + ev.tag + ']</span><span>' + _fmtDate(ev.ts) + ' — ' + ev.label + '</span></div>'); });
      }
      win.document.write('</body></html>');
      win.document.close();
      setTimeout(function(){ win.print(); }, 500);
    };

  }).catch(function(err) {
    console.error('[ATLAS] Portfolio load error:', err);
    el.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:rgba(96,120,152,0.65);padding:24px;text-align:center;">Could not load portfolio data. Check your connection and workspace permissions.</div>';
  });
}

// Helper: convert hex color to "r,g,b" for rgba() use
function _hexToRgb(hex) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return r + ',' + g + ',' + b;
}

window.renderStudentPortfolio = renderStudentPortfolio;
