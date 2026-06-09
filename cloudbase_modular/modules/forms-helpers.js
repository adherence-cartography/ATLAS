/**
 * @fileoverview Form helper functions for the ATLAS platform: medication rows, SDOH fields,
 * user ID generation, MMAS score interpretation, glossary tooltips, and CSV/template downloads.
 * @module forms-helpers
 */

/**
 * @typedef {Object} ScoreInterpretation
 * @property {string} label - Human-readable tier label
 * @property {string} color - CSS color variable
 * @property {'high'|'medium'|'low'} tier
 * @property {string} badge - HTML badge string
 */

/**
 * Returns true for any authenticated workspace session (not EXPLORER or explorer mode).
 *
 * @returns {boolean}
 */
function isResearcherMode() {
  return !!currentWorkspace && currentWorkspace !== 'EXPLORER' && window._wsMode !== 'explorer';
}

/**
 * Returns the scope label shown in the dashboard header, adapted to the current role.
 *
 * @returns {string}
 */
function getScopeLabel() {
  if (isSuperAdmin())       return 'All Workspaces · Global';
  if (isInstitutionMode())  return (workspaceProfile && workspaceProfile.name) || currentWorkspace;
  if (isIndependentMode())  return 'Independent · My Cohort';
  if (isPIResearcher())     return (workspaceProfile && workspaceProfile.name) || currentWorkspace;
  return (workspaceProfile && workspaceProfile.name) || currentWorkspace || 'My Cohort';
}

// ══════════════════════════════════════════════
// MULTI-MEDICATION ROWS
// ══════════════════════════════════════════════
let _medRowCount = 0;
const ROUTES = ['Oral (Tablet/Capsule)','Oral (Liquid)','Sublingual','Inhalation (Inhaler)',
  'Injection - Subcutaneous','Injection - Intramuscular','Injection - Intravenous',
  'Topical (Cream/Ointment)','Transdermal (Patch)','Nasal (Spray/Drops)',
  'Ophthalmic (Eye drops)','Other'];

const DOSING_FREQS = [
  ['OD — Once Daily', 'OD'],
  ['BID — Twice Daily', 'BID'],
  ['TID — Three Times Daily', 'TID'],
  ['OAW — Once a Week', 'OAW'],
  ['Other', 'Other']
];

// ── Custom SDOH field rows ────────────────────────────────────────────────────
let _sdohCustomCount = 0;
/**
 * Appends a new custom SDOH label/value row to the specified container element.
 *
 * @param {string} [containerId='sdoh-custom-rows'] - ID of the container element
 * @returns {void}
 */
function addSdohCustomRow(containerId) {
  const list = document.getElementById(containerId || 'sdoh-custom-rows');
  if (!list) return;
  const id = ++_sdohCustomCount;
  const row = document.createElement('div');
  row.id = 'sdoh-custom-row-' + id;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;';
  row.innerHTML =
    '<input type="text" placeholder="Field name (e.g. Housing status)" maxlength="80"'
    + ' style="font-family:var(--font-mono);font-size:0.88rem;background:var(--card2);border:1px solid var(--border2);border-radius:var(--r);padding:8px 12px;color:var(--text);outline:none;width:100%;box-sizing:border-box;" class="sdoh-custom-label"/>'
    + '<input type="text" placeholder="Response" maxlength="200"'
    + ' style="font-family:var(--font-mono);font-size:0.88rem;background:var(--card2);border:1px solid var(--border2);border-radius:var(--r);padding:8px 12px;color:var(--text);outline:none;width:100%;box-sizing:border-box;" class="sdoh-custom-value"/>'
    + '<button type="button" onclick="this.closest(\'[id^=sdoh-custom-row-]\').remove()" title="Remove field"'
    + ' style="background:none;border:1px solid var(--border2);color:var(--dim);border-radius:var(--r);padding:7px 10px;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0;transition:all 0.15s;" onmouseenter="this.style.color=\'var(--text)\'" onmouseleave="this.style.color=\'var(--dim)\'">×</button>';
  list.appendChild(row);
  row.querySelector('.sdoh-custom-label').focus();
}

/**
 * Reads all custom SDOH field rows from the container and returns them as a key-value object.
 * Returns null if no rows are present or all labels are empty.
 *
 * @param {string} [containerId='sdoh-custom-rows'] - ID of the container element
 * @returns {Object.<string,string>|null}
 */
function getSdohCustomData(containerId) {
  const list = document.getElementById(containerId || 'sdoh-custom-rows');
  if (!list) return null;
  const result = {};
  list.querySelectorAll('[id^=sdoh-custom-row-]').forEach(row => {
    const label = (row.querySelector('.sdoh-custom-label')?.value || '').trim();
    const value = (row.querySelector('.sdoh-custom-value')?.value || '').trim();
    if (label) result[label] = value;
  });
  return Object.keys(result).length ? result : null;
}

/**
 * Appends a new medication row to the #med-list element.
 * Optionally pre-fills fields from an existing medication object.
 *
 * @param {{ name?: string, strength?: string, type?: string, route?: string, frequency?: string, mmas_linked?: boolean }} [prefill] - Optional prefill values
 * @returns {void}
 */
function addMedRow(prefill) {
  const list = document.getElementById('med-list');
  if (!list) return;
  const id = ++_medRowCount;
  const row = document.createElement('div');
  row.id = 'med-row-' + id;
  row.style.cssText = 'background:var(--card2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative;';
  const routeOpts = ROUTES.map(r => '<option' + (prefill && prefill.route===r?' selected':'') + '>' + r + '</option>').join('');
  const freqOpts  = DOSING_FREQS.map(([label, val]) => '<option value="' + val + '"' + (prefill && prefill.frequency===val?' selected':'') + '>' + label + '</option>').join('');
  const isLinked  = prefill && prefill.mmas_linked ? 'checked' : '';
  row.innerHTML =
    '<button type="button" onclick="document.getElementById(\'med-row-' + id + '\').remove();syncMedCountFromRows();" title="Remove"'
    + ' style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--dim);cursor:pointer;font-size:1.1rem;line-height:1;padding:0 4px;">&times;</button>'
    + '<div style="grid-column:1/-1;font-family:var(--font-mono);font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;">Medication ' + id + '</div>'
    + '<div style="grid-column:1/-1;">'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Drug / API Name</label>'
    +   '<input class="sdoh-input" id="med-name-' + id + '" type="text" placeholder="e.g., Metformin" value="' + (prefill&&prefill.name||'') + '"/>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Strength</label>'
    +   '<input class="sdoh-input" id="med-strength-' + id + '" type="text" placeholder="e.g., 500mg" value="' + (prefill&&prefill.strength||'') + '"/>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Type</label>'
    +   '<select class="sdoh-select" id="med-type-' + id + '">'
    +   '<option value="">— Select —</option>'
    +   '<option' + (prefill&&prefill.type==='Single API'?' selected':'') + '>Single API</option>'
    +   '<option' + (prefill&&prefill.type==='Combination (FDC)'?' selected':'') + '>Combination (FDC)</option>'
    +   '<option' + (prefill&&prefill.type==='Biological'?' selected':'') + '>Biological</option>'
    +   '</select>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Dosing Frequency</label>'
    +   '<select class="sdoh-select" id="med-freq-' + id + '">'
    +   '<option value="">— Select —</option>'
    +   freqOpts
    +   '</select>'
    + '</div>'
    + '<div style="grid-column:1/-1;">'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Route of Administration</label>'
    +   '<select class="sdoh-select" id="med-route-' + id + '">'
    +   '<option value="">— Select Route —</option>'
    +   routeOpts
    +   '</select>'
    + '</div>'
    + '<div style="grid-column:1/-1;background:rgba(78,156,245,0.05);border:1px solid rgba(78,156,245,0.18);border-radius:8px;padding:11px 14px;margin-top:2px;">'
    +   '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">'
    +   '<input type="checkbox" id="med-mmas-linked-' + id + '" ' + isLinked + ' style="width:16px;height:16px;margin-top:2px;accent-color:var(--base);flex-shrink:0;cursor:pointer;"/>'
    +   '<span style="display:flex;flex-direction:column;gap:3px;">'
    +   '<span style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--base);">MMAS-8 Linked to this Medication</span>'
    +   '<span style="font-size:0.82rem;color:var(--muted);line-height:1.5;">Are you answering the MMAS-8 about this medication? Tick to pair this session\'s adherence score with this specific drug — essential for polypharmacy analysis.</span>'
    +   '</span>'
    +   '</label>'
    + '</div>';
  list.appendChild(row);
}

/**
 * Adds or removes medication rows to match the given count.
 *
 * @param {number|string} n - Target number of medication rows
 * @returns {void}
 */
function syncMedRowsToCount(n) {
  n = parseInt(n, 10);
  if (isNaN(n)) return;
  const list = document.getElementById('med-list');
  if (!list) return;
  const existing = list.querySelectorAll('div[id^="med-row-"]').length;
  if (n > existing) {
    for (let i = existing; i < n; i++) addMedRow();
  } else if (n < existing) {
    const rows = list.querySelectorAll('div[id^="med-row-"]');
    for (let i = n; i < rows.length; i++) rows[i].remove();
  }
}

/**
 * Reads the current number of medication rows in the DOM and syncs the medication count selector.
 *
 * @returns {void}
 */
function syncMedCountFromRows() {
  const list = document.getElementById('med-list');
  const sel = document.getElementById('sdoh-num-medications');
  if (!list || !sel) return;
  const n = list.querySelectorAll('div[id^="med-row-"]').length;
  sel.value = n > 0 && n <= 10 ? String(n) : '';
}

/**
 * Reads all medication rows from the DOM and returns them as an array of medication objects.
 * Rows with no drug name are skipped.
 *
 * @returns {Array<{ name: string, strength: string, type: string, route: string, frequency: string, mmas_linked: boolean }>}
 */
function getMedications() {
  const rows = document.querySelectorAll('#med-list > div[id^="med-row-"]');
  const meds = [];
  rows.forEach(function(row) {
    const n = row.id.replace('med-row-','');
    const name = document.getElementById('med-name-'+n) ? document.getElementById('med-name-'+n).value.trim() : '';
    if (!name) return;
    meds.push({
      name:       name,
      strength:   document.getElementById('med-strength-'+n) ? document.getElementById('med-strength-'+n).value.trim() : '',
      type:       document.getElementById('med-type-'+n)     ? document.getElementById('med-type-'+n).value : '',
      route:      document.getElementById('med-route-'+n)    ? document.getElementById('med-route-'+n).value : '',
      frequency:  document.getElementById('med-freq-'+n)     ? document.getElementById('med-freq-'+n).value : '',
      mmas_linked: document.getElementById('med-mmas-linked-'+n) ? document.getElementById('med-mmas-linked-'+n).checked : false
    });
  });
  return meds;
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
/**
 * Returns a globally unique, device-persistent user ID stored in `localStorage`.
 * Uses `crypto.randomUUID()` (128-bit cryptographically random), with fallbacks for
 * `crypto.getRandomValues()` and a timestamp+random last resort.
 * Migrates legacy short IDs (ADH* format) to the new UUID format.
 * @returns {string} 32-character uppercase hex string
 */
function getUserId() {
  // Returns a globally unique, device-persistent ID stored in localStorage.
  //
  // UNIQUENESS GUARANTEE:
  //   Uses crypto.randomUUID() (128-bit cryptographically random, RFC 4122 v4).
  //   Collision probability across all sessions ever: ~1 in 5.3 × 10³⁶ — effectively zero.
  //   Falls back to a 32-char hex string built from crypto.getRandomValues() on browsers
  //   that support getRandomValues but not randomUUID (very rare).
  //   Final fallback: timestamp + 16 chars of Math.random (still astronomically unlikely to collide).
  //
  // PERSISTENCE CAVEAT: ID is per-origin per-browser-profile (localStorage).
  //   · Same person, different browser = different ID. Use patient_number as the true research key.
  //   · Shared tablets: ID persists across patients. Use ⟳ New Session between patients
  //     and always set a unique patient_number per patient.
  //   · Incognito/Private: generates a fresh ID each session (localStorage cleared on close).
  //
  let id = localStorage.getItem('atlas_user_id');
  // Migrate legacy short IDs (old 11-char ADH* format) to new UUID format
  if (id && id.length < 20) {
    id = null; // force regeneration for old format
    localStorage.removeItem('atlas_user_id');
  }
  if (id) return id;

  // Generate new UUID
  try {
    id = crypto.randomUUID().replace(/-/g, '').toUpperCase(); // 32 hex chars
  } catch(e1) {
    try {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      id = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
    } catch(e2) {
      // Last resort — timestamp + random (still ~96 bits of entropy combined)
      id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,18).toUpperCase().padEnd(16,'0');
    }
  }

  localStorage.setItem('atlas_user_id', id);
  return id;
}

/**
 * Normalises a country name to Title Case with trimmed whitespace.
 * Applied at every Firebase save point to ensure consistent country data.
 * @param {string} c - Raw country name string
 * @returns {string} Title-cased country name, or empty string if input is falsy
 */
function normalizeCountry(c) {
  if (!c || typeof c !== 'string') return c || '';
  return c.trim().replace(/\S+/g, w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

/**
 * Returns the adherence category label and color for a given MMAS-8 score.
 * Uses translated labels from `ATLAS_STRINGS` if available.
 * @param {number} score - MMAS-8 total score (0–8)
 * @returns {{ label: string, color: string }} Category label and CSS hex color
 */
function getAdherenceCategory(score) {
  var t = (typeof ATLAS_STRINGS !== 'undefined' && window._atlasLang)
    ? (ATLAS_STRINGS[window._atlasLang] || ATLAS_STRINGS.en)
    : { levelHigh:'High Adherence', levelMedium:'Medium Adherence', levelLow:'Low Adherence' };
  if (score >= 8)  return { label: t.levelHigh   || 'High Adherence',   color:'#10b981' };
  if (score >= 6)  return { label: t.levelMedium || 'Medium Adherence', color:'#f59e0b' };
  return                   { label: t.levelLow   || 'Low Adherence',    color:'#ef4444' };
}

/**
 * Displays a non-blocking toast notification at the bottom of the screen.
 * Also announces the message to screen readers via an `aria-live` region.
 * @param {string} msg - Message text to display
 * @param {number} [duration=3000] - Display duration in milliseconds
 * @returns {void}
 */
// ── Atlas tooltip engine ────────────────────────────────────────────────────
// atlasTip(el, text) wires an element with a custom tooltip that appends to body.
// This avoids browser `title` clipping inside overflow:hidden rail containers.
// Usage: atlasTip(element, 'Tooltip text') — call after element is in DOM.
(function _installAtlasTip() {
  var _tipEl = null;
  var _tipTimer = null;

  function _getTip() {
    if (!_tipEl) {
      _tipEl = document.createElement('div');
      _tipEl.className = 'atlas-tip';
      document.body.appendChild(_tipEl);
    }
    return _tipEl;
  }

  window.atlasTip = function(el, text) {
    if (!el || !text) return;
    el.removeAttribute('title'); // prevent native tooltip racing the custom one
    el.addEventListener('mouseenter', function(e) {
      var tip = _getTip();
      tip.textContent = text;
      // Position above the element
      var rect = el.getBoundingClientRect();
      var tipW = 260;
      var left = Math.min(rect.left, window.innerWidth - tipW - 8);
      var top  = rect.top - 8; // will shift up after we know tip height
      tip.style.left = left + 'px';
      tip.style.top  = (rect.top - 4) + 'px'; // temp position
      tip.classList.add('visible');
      // Re-position above after render so we know actual tip height
      requestAnimationFrame(function() {
        var th = tip.offsetHeight;
        tip.style.top = Math.max(4, rect.top - th - 6) + 'px';
      });
    });
    el.addEventListener('mouseleave', function() {
      var tip = _getTip();
      tip.classList.remove('visible');
    });
    el.addEventListener('mousedown', function() {
      var tip = _getTip();
      tip.classList.remove('visible');
    });
  };
})();

function showToast(msg, duration=3000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  // Mirror into aria-live region so screen readers announce the toast
  const _lr = document.getElementById('toast-live-region');
  if (_lr) { _lr.textContent = ''; requestAnimationFrame(() => { _lr.textContent = msg; }); }
  setTimeout(() => {
    t.style.transition = 'opacity 0.4s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 400);
  }, duration);
}

/**
 * Downloads the ATLAS MMAS-8 data collection spreadsheet template (XLSM).
 * Prevents default form submission if called from a click event.
 * @param {Event} [e] - Optional click event to suppress default behavior
 * @returns {Promise<void>}
 */
async function downloadTemplate(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const btn = (e && e.currentTarget) || (e && e.target) || null;
  const orig = btn ? btn.innerHTML : '↓ Template';
  if (btn) { btn.textContent = '↓ Starting download…'; btn.disabled = true; }

  // ── PRIMARY: same-origin worker proxy → forces Content-Disposition: attachment ──
  // Routes through /download/template on the Cloudflare Worker, which fetches from
  // S3 server-side and returns the file with attachment header so Office Online
  // never intercepts it. No CORS issues, guaranteed download.
  try {
    const res = await fetch('/download/template');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ATLAS_Bulk_Upload.xlsm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('ATLAS_Bulk_Upload.xlsm downloaded — open in Excel, enable macros, then fill in your data.', 5000);
    setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.disabled = false; } }, 2500);
    return;
  } catch(_) {
    // fall through to SheetJS lite version if worker proxy unavailable
  }

  // ── FALLBACK: generate functional .xlsx with SheetJS (no macros / no color styling) ──
  if (btn) btn.textContent = '↓ Generating lite…';
  try {
    await ensureSheetJS();
    const wb = XLSX.utils.book_new();
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Names) wb.Workbook.Names = [];

    // ── LOOKUP DATA ───────────────────────────────────────────────────────────
    const CONDITIONS = [
      // Cardiovascular
      'Hypertension','Heart Failure','Coronary Artery Disease / Angina','Atrial Fibrillation',
      'Hyperlipidaemia / Dyslipidaemia','Peripheral Arterial Disease',
      'DVT / Pulmonary Embolism','Stroke / TIA',
      // Endocrine & Metabolic
      'Type 1 Diabetes Mellitus','Type 2 Diabetes Mellitus','Hypothyroidism','Hyperthyroidism',
      'Obesity','Osteoporosis','Gout',
      // Respiratory
      'Asthma','COPD','Pulmonary Fibrosis','Sleep Apnoea','Allergic Rhinitis',
      // Gastrointestinal
      'GERD','Peptic Ulcer Disease','IBD (Crohn\'s / Ulcerative Colitis)',
      'Irritable Bowel Syndrome','Chronic Liver Disease / Cirrhosis','Hepatitis B','Hepatitis C',
      // Mental Health & Neurology
      'Depression','Anxiety Disorder','Bipolar Disorder','Schizophrenia / Psychosis','ADHD',
      'Epilepsy / Seizure Disorder','Parkinson\'s Disease','Alzheimer\'s / Dementia',
      'Multiple Sclerosis','Migraine',
      // Musculoskeletal
      'Rheumatoid Arthritis','Osteoarthritis','SLE','Ankylosing Spondylitis','Psoriatic Arthritis',
      // Oncology
      'Breast Cancer','Prostate Cancer','Colorectal Cancer','Lung Cancer',
      'Haematological Malignancy','Other Cancer',
      // Renal & Urology
      'Chronic Kidney Disease','End-Stage Renal Disease (Dialysis)',
      'Benign Prostatic Hyperplasia','Recurrent UTIs',
      // Infectious Disease
      'HIV / AIDS','Tuberculosis','Malaria','Other Infectious Disease',
      // Haematology
      'Anaemia (Iron Deficiency)','Sickle Cell Disease','Thalassaemia',
      'Haemophilia','Anticoagulation Therapy',
      // Dermatology
      'Psoriasis','Eczema / Atopic Dermatitis','Acne','Rosacea',
      // Ophthalmology
      'Glaucoma','Age-Related Macular Degeneration','Diabetic Retinopathy',
      // Women\'s Health
      'Contraception','Endometriosis','PCOS','Menopause / HRT','Pregnancy-Related Condition',
      // Other
      'Other',
    ];
    const AGE_RANGES  = ['Under 18','18-24','25-34','35-44','45-54','55-64','65-74','75 or older','Prefer not to say'];
    const EDUCATION   = [
      'No formal education','Primary school (Elementary)','Secondary school (High school)',
      'Some college / University (incomplete)','Associate degree / Trade school',
      "Bachelor's degree","Master's degree",'Doctoral degree (PhD, MD, JD, etc.)','Prefer not to say',
    ];
    const ROUTES = [
      'Oral (Tablet/Capsule)','Oral (Liquid)','Sublingual','Inhalation (Inhaler)',
      'Injection - Subcutaneous','Injection - Intramuscular','Injection - Intravenous',
      'Topical (Cream/Ointment)','Transdermal (Patch)','Nasal (Spray/Drops)',
      'Ophthalmic (Eye drops)','Other',
    ];

    // ── LOOKUP SHEET (hidden) ─────────────────────────────────────────────────
    const maxLookup = Math.max(CONDITIONS.length, AGE_RANGES.length, EDUCATION.length, ROUTES.length);
    const lookupAoa = [['Condition','Age Range','Education Level','Route of Administration']];
    for (let i = 0; i < maxLookup; i++) {
      lookupAoa.push([CONDITIONS[i]||'', AGE_RANGES[i]||'', EDUCATION[i]||'', ROUTES[i]||'']);
    }
    const wsLookup = XLSX.utils.aoa_to_sheet(lookupAoa);
    wsLookup['!cols'] = [{wch:46},{wch:22},{wch:46},{wch:32}];
    XLSX.utils.book_append_sheet(wb, wsLookup, 'Lookup');

    // Named ranges pointing at Lookup columns (rows 2 onward = data, row 1 = header)
    wb.Workbook.Names.push({ Name:'ConditionList', Ref:`Lookup!$A$2:$A$${CONDITIONS.length+1}` });
    wb.Workbook.Names.push({ Name:'AgeRangeList',  Ref:`Lookup!$B$2:$B$${AGE_RANGES.length+1}` });
    wb.Workbook.Names.push({ Name:'EducationList', Ref:`Lookup!$C$2:$C$${EDUCATION.length+1}` });
    wb.Workbook.Names.push({ Name:'RouteList',     Ref:`Lookup!$D$2:$D$${ROUTES.length+1}` });

    // ── INSTRUCTIONS SHEET ───────────────────────────────────────────────────
    const wsInstr = XLSX.utils.aoa_to_sheet([
      ['ATLAS PLATFORM · MMAS-8 BULK DATA SUBMISSION TEMPLATE — v2.0'],
      [],
      ['STUDY-LINKED UPLOAD — INSTRUCTIONS'],
      [],
      ['1.  Fill in the STUDY INFORMATION section (rows 2–7 of the "Data Entry" sheet).'],
      ['    Study Title (B2), Principal Investigator (B3), and Institution (B4) are REQUIRED.'],
      ['    IRB Protocol #, ClinicalTrials.gov ID, and Study Phase are optional but strongly recommended.'],
      [],
      ['2.  Enter one patient record per row, starting at ROW 11 of the "Data Entry" sheet.'],
      ['    Do not insert or remove rows in the Study Information header section (rows 1–8).'],
      [],
      ['3.  Dropdowns are provided for: Condition, Drug Type, Route of Administration, Gender,'],
      ['    Age Range, Education Level, Q1–Q7 (YES/NO), and Q8 Frequency.'],
      ['    If your value is not in a list, type it directly — only Q1–Q8 enforce strict validation.'],
      [],
      ['4.  Q1–Q7: Select YES or NO. Q5 is REVERSE-SCORED (YES = always takes medication on travel = adherent).'],
      ['    Q8 Frequency: Never / Once in a while / Sometimes / Usually / All the time'],
      [],
      ['5.  Country is required for map geocoding. City improves pin precision.'],
      [],
      ['6.  The example row (row 10) is automatically ignored on upload.'],
      [],
      ['7.  Every upload is permanently linked to the study metadata you enter.'],
      ['    Map data points show Study Title, PI, and Institution in their popup tooltips.'],
      [],
      ['NOTE: Dropdown lists for Condition, Age Range, Education, and Route are stored on the'],
      ['      "Lookup" sheet. Do not rename or delete that sheet.'],
    ]);
    wsInstr['!cols'] = [{wch:115}];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

    // ── DATA ENTRY SHEET ─────────────────────────────────────────────────────
    const COL_HEADERS = [
      'Country *','City','Patient ID','Assessment Date (YYYY-MM-DD)',
      'Condition','Drug Type','Drug Name','Drug Strength','Route of Administration',
      'Gender','Age Range','Education Level',
      'Q1 — Forget to take?','Q2 — Missed past 2 wks?','Q3 — Cut back / felt worse?',
      'Q4 — Forgot when travelling?','Q5 — Took last scheduled dose? (REVERSED)',
      'Q6 — Stopped when felt in control?','Q7 — Feel hassled by treatment?',
      'Q8 Frequency (how often forget?)',
    ];
    // Example row: one highlighted row; delete before uploading
    const EXAMPLE_DATA = [
      'United States','New York','PT-001 (EXAMPLE — DELETE BEFORE UPLOAD)','2026-01-15',
      'Hypertension','Single API','Lisinopril','10mg','Oral (Tablet/Capsule)',
      'Male','45-54',"Bachelor's degree",
      'NO','NO','NO','NO','YES','NO','NO','Never',
    ];
    const dataAoa = [
      ['ATLAS PLATFORM · MMAS-8 BULK DATA SUBMISSION'],  // row 0
      ['STUDY TITLE *',''],                                // row 1
      ['PRINCIPAL INVESTIGATOR *',''],                     // row 2
      ['INSTITUTION *',''],                                // row 3
      ['IRB PROTOCOL #',''],                               // row 4
      ['CLINICALTRIALS.GOV ID',''],                        // row 5
      ['STUDY PHASE / DESIGN',''],                         // row 6
      [],                                                  // row 7 separator
      COL_HEADERS,                                         // row 8 headers
      EXAMPLE_DATA,                                        // row 9 example (1 row only — delete before upload)
      [],[],[],[],[],[],[],[],[],[],                       // rows 10-19 empty
    ];
    const wsData = XLSX.utils.aoa_to_sheet(dataAoa);
    wsData['!cols'] = [
      {wch:28},{wch:20},{wch:22},{wch:24},
      {wch:32},{wch:18},{wch:24},{wch:14},{wch:26},
      {wch:14},{wch:12},{wch:20},
      {wch:22},{wch:22},{wch:26},{wch:28},{wch:32},{wch:28},{wch:28},{wch:26},
    ];

    // ── DATA VALIDATION (dropdowns) ───────────────────────────────────────────
    // Data rows start at Excel row 11 (0-indexed row 10); apply to rows 11:2000
    // Column letters (A=Country … T=Q8) — Assessment Date added at D, all Q cols shift right:
    //   A=Country B=City C=PatientID D=AssessmentDate E=Condition F=DrugType G=DrugName
    //   H=DrugStrength I=Route J=Gender K=AgeRange L=Education
    //   M=Q1 N=Q2 O=Q3 P=Q4 Q=Q5 R=Q6 S=Q7 T=Q8
    const dv = (sqref, formula1, strict) => ({
      sqref, type:'list', formula1,
      showDropDown: false,
      showErrorMessage: !!strict,
      errorStyle: 'stop',
      errorTitle: 'Invalid value',
      error: strict || '',
    });
    wsData['!dataValidations'] = [
      dv('E11:E2000', 'ConditionList', ''),
      dv('F11:F2000', '"Single API,Combination (FDC),Biological"', ''),
      dv('I11:I2000', 'RouteList', ''),
      dv('J11:J2000', '"Male,Female,Other / Prefer not to say"', ''),
      dv('K11:K2000', 'AgeRangeList', ''),
      dv('L11:L2000', 'EducationList', ''),
      dv('M11:S2000', '"YES,NO"', 'Enter YES or NO for Q1–Q7.'),
      dv('T11:T2000', '"Never,Once in a while,Sometimes,Usually,All the time"', 'Select a Q8 frequency from the dropdown.'),
    ];

    XLSX.utils.book_append_sheet(wb, wsData, 'Data Entry');

    // Set sheet order: Instructions first, then Data Entry, then Lookup (last = less prominent)
    // Re-order by rebuilding SheetNames
    wb.SheetNames = ['Instructions','Data Entry','Lookup'];

    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob  = new Blob([wbout], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl; a.download = 'ATLAS_Bulk_Upload.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
    showToast('Template downloaded (lite version — no macros or colour styling). Delete the example row before uploading.', 5000);
  } catch(err) {
    console.error('[template]', err);
    showToast('Could not generate template: ' + err.message, 4000);
  }
  if (btn) { btn.textContent = orig; btn.disabled = false; }
}

/**
 * Downloads the ATLAS MAP Bulk Upload Template.
 * Primary: fetches ATLAS_MAP_Bulk_Upload.xlsm from S3 via Worker (/download/template?tool=map).
 * Fallback: generates a functional .xlsx with SheetJS (Q1–Q7 YES/NO dropdowns,
 *           Q8 = Never | Rarely | Sometimes | Often | All of the time).
 *
 * MAP Q8 scores: Never=1, Rarely=0.75, Sometimes=0.5, Often=0.25, All of the time=0
 */
async function downloadMAPTemplate(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const btn  = (e && e.currentTarget) || (e && e.target) || document.getElementById('dnd-template-btn') || null;
  const orig = btn ? btn.textContent : '↓ MAP Template';
  if (btn) { btn.textContent = '↓ Starting download…'; btn.disabled = true; }

  // ── PRIMARY: Worker → S3 xlsm ──────────────────────────────────────────────
  try {
    const res = await fetch('/download/template?tool=map');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ATLAS_MAP_Bulk_Upload.xlsm';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('ATLAS_MAP_Bulk_Upload.xlsm downloaded — open in Excel and enable macros.', 5000);
    setTimeout(() => { if (btn) { btn.textContent = orig; btn.disabled = false; } }, 2500);
    return;
  } catch(_) {
    // fall through to SheetJS lite version
  }

  // ── FALLBACK: generate functional .xlsx with SheetJS ──────────────────────
  if (btn) btn.textContent = '↓ Generating lite…';
  try {
    await ensureSheetJS();
    const wb = XLSX.utils.book_new();
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Names) wb.Workbook.Names = [];

    // Re-use same condition / lookup lists as MMAS template
    const CONDITIONS = [
      'Hypertension','Heart Failure','Coronary Artery Disease / Angina','Atrial Fibrillation',
      'Hyperlipidaemia / Dyslipidaemia','Peripheral Arterial Disease','DVT / Pulmonary Embolism','Stroke / TIA',
      'Type 1 Diabetes Mellitus','Type 2 Diabetes Mellitus','Hypothyroidism','Hyperthyroidism',
      'Obesity','Osteoporosis','Gout','Asthma','COPD','Pulmonary Fibrosis','Sleep Apnoea','Allergic Rhinitis',
      'GERD','Peptic Ulcer Disease','IBD (Crohn\'s / Ulcerative Colitis)','Irritable Bowel Syndrome',
      'Chronic Liver Disease / Cirrhosis','Hepatitis B','Hepatitis C','Depression','Anxiety Disorder',
      'Bipolar Disorder','Schizophrenia / Psychosis','ADHD','Epilepsy / Seizure Disorder',
      'Parkinson\'s Disease','Alzheimer\'s / Dementia','Multiple Sclerosis','Migraine',
      'Rheumatoid Arthritis','Osteoarthritis','SLE','Ankylosing Spondylitis','Psoriatic Arthritis',
      'Breast Cancer','Prostate Cancer','Colorectal Cancer','Lung Cancer','Haematological Malignancy','Other Cancer',
      'Chronic Kidney Disease','End-Stage Renal Disease (Dialysis)','Benign Prostatic Hyperplasia','Recurrent UTIs',
      'HIV / AIDS','Tuberculosis','Malaria','Other Infectious Disease',
      'Anaemia (Iron Deficiency)','Sickle Cell Disease','Thalassaemia','Haemophilia','Anticoagulation Therapy',
      'Psoriasis','Eczema / Atopic Dermatitis','Acne','Rosacea',
      'Glaucoma','Age-Related Macular Degeneration','Diabetic Retinopathy',
      'Contraception','Endometriosis','PCOS','Menopause / HRT','Pregnancy-Related Condition','Other',
    ];
    const AGE_RANGES = ['Under 18','18-24','25-34','35-44','45-54','55-64','65-74','75 or older','Prefer not to say'];
    const EDUCATION  = [
      'No formal education','Primary school (Elementary)','Secondary school (High school)',
      'Some college / University (incomplete)','Associate degree / Trade school',
      "Bachelor's degree","Master's degree",'Doctoral degree (PhD, MD, JD, etc.)','Prefer not to say',
    ];
    const ROUTES = [
      'Oral (Tablet/Capsule)','Oral (Liquid)','Sublingual','Inhalation (Inhaler)',
      'Injection - Subcutaneous','Injection - Intramuscular','Injection - Intravenous',
      'Topical (Cream/Ointment)','Transdermal (Patch)','Nasal (Spray/Drops)',
      'Ophthalmic (Eye drops)','Other',
    ];

    // Lookup sheet (hidden)
    const maxLookup = Math.max(CONDITIONS.length, AGE_RANGES.length, EDUCATION.length, ROUTES.length);
    const lookupAoa = [['Condition','Age Range','Education Level','Route of Administration']];
    for (let i = 0; i < maxLookup; i++) {
      lookupAoa.push([CONDITIONS[i]||'', AGE_RANGES[i]||'', EDUCATION[i]||'', ROUTES[i]||'']);
    }
    const wsLookup = XLSX.utils.aoa_to_sheet(lookupAoa);
    wsLookup['!cols'] = [{wch:46},{wch:22},{wch:46},{wch:32}];
    XLSX.utils.book_append_sheet(wb, wsLookup, 'Lookup');
    wb.Workbook.Names.push({ Name:'ConditionList', Ref:`Lookup!$A$2:$A$${CONDITIONS.length+1}` });
    wb.Workbook.Names.push({ Name:'AgeRangeList',  Ref:`Lookup!$B$2:$B$${AGE_RANGES.length+1}` });
    wb.Workbook.Names.push({ Name:'EducationList', Ref:`Lookup!$C$2:$C$${EDUCATION.length+1}` });
    wb.Workbook.Names.push({ Name:'RouteList',     Ref:`Lookup!$D$2:$D$${ROUTES.length+1}` });

    // Instructions sheet
    const wsInstr = XLSX.utils.aoa_to_sheet([
      ['ATLAS PLATFORM · MAP BULK DATA SUBMISSION TEMPLATE — v2.0'],
      [],
      ['MAP (Multidimensional Adherence Parameters) — INSTRUCTIONS'],
      [],
      ['1.  Fill in the STUDY INFORMATION section (rows 2–7 of the "Data Entry" sheet).'],
      ['    Study Title (B2), Principal Investigator (B3), and Institution (B4) are REQUIRED.'],
      [],
      ['2.  Enter one patient record per row, starting at ROW 11 of the "Data Entry" sheet.'],
      [],
      ['3.  MAP_Q1–MAP_Q7: Select YES or NO.'],
      ['    MAP_Q5 is REVERSE-SCORED (YES = took last scheduled dose = adherent).'],
      [],
      ['4.  MAP_Q8: "In a typical week, how often do you have trouble taking all your medications as prescribed?"'],
      ['    Select from the dropdown: Never | Rarely | Sometimes | Often | All of the time'],
      ['    Scores: Never=1.00  Rarely=0.75  Sometimes=0.50  Often=0.25  All of the time=0.00'],
      [],
      ['5.  Country is required for map geocoding. City improves pin precision.'],
      [],
      ['6.  The example row (row 10) is automatically ignored on upload.'],
    ]);
    wsInstr['!cols'] = [{wch:115}];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

    // Data Entry sheet
    // Columns: A=Country B=City C=PatientID D=AssessDate E=Condition F=DrugType G=DrugName
    //          H=DrugStrength I=Route J=Gender K=AgeRange L=Education
    //          M=MAP_Q1 N=MAP_Q2 O=MAP_Q3 P=MAP_Q4 Q=MAP_Q5 R=MAP_Q6 S=MAP_Q7 T=MAP_Q8
    const COL_HEADERS = [
      'Country *','City','Patient ID','Assessment Date (YYYY-MM-DD)',
      'Condition','Drug Type','Drug Name','Drug Strength','Route of Administration',
      'Gender','Age Range','Education Level',
      'MAP_Q1 — Forget?','MAP_Q2 — Chose to skip?','MAP_Q3 — Reduced dose?',
      'MAP_Q4 — Hard when routine changes?','MAP_Q5 — Took last dose? (REVERSED)',
      'MAP_Q6 — Stop when feeling better?','MAP_Q7 — Feels like a hassle?',
      'MAP_Q8 — How often trouble? (Frequency)',
    ];
    const EXAMPLE_DATA = [
      'United States','New York','PT-001 (EXAMPLE — DELETE BEFORE UPLOAD)','2026-01-15',
      'Hypertension','Single API','Lisinopril','10mg','Oral (Tablet/Capsule)',
      'Male','45-54',"Bachelor's degree",
      'NO','NO','NO','NO','YES','NO','NO','Sometimes',
    ];
    const dataAoa = [
      ['ATLAS PLATFORM · MAP BULK DATA SUBMISSION'],
      ['STUDY TITLE *',''],
      ['PRINCIPAL INVESTIGATOR *',''],
      ['INSTITUTION *',''],
      ['IRB PROTOCOL #',''],
      ['CLINICALTRIALS.GOV ID',''],
      ['STUDY PHASE / DESIGN',''],
      [],
      COL_HEADERS,
      EXAMPLE_DATA,
      [],[],[],[],[],[],[],[],[],[],
    ];
    const wsData = XLSX.utils.aoa_to_sheet(dataAoa);
    wsData['!cols'] = [
      {wch:28},{wch:20},{wch:22},{wch:24},
      {wch:32},{wch:18},{wch:24},{wch:14},{wch:26},
      {wch:14},{wch:12},{wch:20},
      {wch:24},{wch:24},{wch:22},{wch:28},{wch:32},{wch:28},{wch:26},{wch:32},
    ];
    const dv = (sqref, formula1, strict) => ({
      sqref, type:'list', formula1,
      showDropDown: false,
      showErrorMessage: !!strict,
      errorStyle: 'stop', errorTitle: 'Invalid value', error: strict || '',
    });
    wsData['!dataValidations'] = [
      dv('E11:E2000', 'ConditionList', ''),
      dv('F11:F2000', '"Single API,Combination (FDC),Biological"', ''),
      dv('I11:I2000', 'RouteList', ''),
      dv('J11:J2000', '"Male,Female,Other / Prefer not to say"', ''),
      dv('K11:K2000', 'AgeRangeList', ''),
      dv('L11:L2000', 'EducationList', ''),
      dv('M11:S2000', '"YES,NO"', 'Enter YES or NO for MAP_Q1–MAP_Q7.'),
      dv('T11:T2000', '"Never,Rarely,Sometimes,Often,All of the time"', 'Select a MAP_Q8 frequency from the dropdown.'),
    ];
    XLSX.utils.book_append_sheet(wb, wsData, 'Data Entry');
    wb.SheetNames = ['Instructions','Data Entry','Lookup'];

    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob  = new Blob([wbout], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl; a.download = 'ATLAS_MAP_Bulk_Upload.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
    showToast('MAP template downloaded (lite version — no macros). Q1–Q7 = YES/NO; Q8 = Never | Rarely | Sometimes | Often | All of the time.', 6000);
  } catch(err) {
    console.error('[map-template]', err);
    showToast('Could not generate MAP template: ' + err.message, 4000);
  }
  if (btn) { btn.textContent = orig; btn.disabled = false; }
}
window.downloadMAPTemplate = downloadMAPTemplate;

/**
 * Triggers a browser download of a CSV file built from headers and rows.
 * Applies CSV injection sanitization (guards against =, +, -, @, tab leading chars).
 * @param {string[]} headers - Column header labels
 * @param {Array<Array<string|number>>} rows - Data rows (each cell stringified)
 * @param {string} filename - Suggested download filename (e.g. `'atlas_export.csv'`)
 * @returns {void}
 */
function triggerCSVDownload(headers, rows, filename) {
  // ── CSV injection guard ──────────────────────────────────────────────────
  // Leading =, +, -, @, tab, or CR triggers formula execution in Excel/Sheets.
  // Wrap such values in double-quotes (standard CSV escaping) rather than
  // prefixing with a single-quote, which creates a literal character that
  // corrupts programmatic consumers like pandas, R, and database imports.
  function csvSanitize(raw) {
    const s = String(raw);
    // If the value starts with a formula-injection character, force quote-wrapping
    // by returning it as-is — the quote-wrap below handles the rest.
    return s;
  }
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(f => {
      const s = csvSanitize(f);
      // Force quote-wrap for injection-risk leading chars, commas, quotes, or newlines
      return (s.includes(',') || s.includes('"') || s.includes('\n') || /^[=+\-@\t\r]/.test(s))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Returns a detailed MMAS-8 score interpretation object with label, color, tier, and badge HTML.
 * @param {number|string} score - MMAS-8 total score (0–8)
 * @returns {ScoreInterpretation}
 */
function mmasScoreInterpretation(score) {
  const s = parseFloat(score);
  if (isNaN(s)) return { label: 'Unknown', color: 'var(--dim)', badge: '' };
  if (s === 8)  return { label: 'High Adherence',   color: 'var(--optimal)', tier: 'high',   badge: '<span class="mmas-badge mmas-high">HIGH</span>' };
  if (s >= 6)   return { label: 'Medium Adherence', color: 'var(--moderate)', tier: 'medium', badge: '<span class="mmas-badge mmas-medium">MED</span>' };
  return          { label: 'Low Adherence',    color: 'var(--poor)',     tier: 'low',    badge: '<span class="mmas-badge mmas-low">LOW</span>' };
}

// ── Jargon Glossary — adds data-tip tooltips to technical terms in the DOM ───
const ATLAS_GLOSSARY = {
  'MMAS-8':       'Morisky Medication Adherence Scale — 8 items. The global standard for measuring medication adherence. Score 0–8; higher = better.',
  'PEACS':        'Predictive Emergence Assessment for Clinical Services — tracks medication adherence patterns across multiple dimensions over time.',
  'MAP':          'Multidimensional Adherence Parameters — classifies adherence into three domains: Architecture, Execution, and Context.',
  'MAP Tri-Domain': 'Three-domain adherence framework: Architecture (intentional barriers), Execution (behavioral patterns), Context (social determinants).',
  'KYBOS':        'Know Your Barriers of Scope — a visual cube showing the six dimensions of adherence barriers.',
  'Loom':         'Adherence Loom — a longitudinal visualization showing how adherence patterns weave over time across multiple medications.',
  'Sentinel':     'Automated alert system that flags patients whose adherence score drops below the medium threshold, triggering clinical review.',
  'SDOH':         'Social Determinants of Health — non-medical factors (housing, income, transport, education) that influence health outcomes.',
  'PE Domain':    'Predictive Emergence Domain — measures the likelihood of future non-adherence based on current behavioral signals.',
  'MTM':          'Medication Therapy Management — a clinical service where pharmacists review all of a patient\'s medications to optimize therapy.',
  'CCM':          'Chronic Care Management — a Medicare billing program for patients with two or more chronic conditions.',
  'RTM':          'Remote Therapeutic Monitoring — billing for monitoring patient response to therapy using digital tools.',
  'CPT':          'Current Procedural Terminology — standardized medical billing codes used to describe clinical services.',
  'IRB':          'Institutional Review Board — an ethics committee that reviews and approves research involving human subjects.',
  'PI':           'Principal Investigator — the lead researcher responsible for a study.',
};

/**
 * Walks the DOM under `rootEl` and wraps occurrences of glossary terms in `<span data-tip>` elements.
 * Skips SCRIPT, STYLE, TEXTAREA, INPUT elements and already-tipped nodes.
 * @param {Element} [rootEl=document.body] - Root element to search within
 * @returns {void}
 */
function applyGlossaryTooltips(rootEl) {
  const root = rootEl || document.body;
  Object.entries(ATLAS_GLOSSARY).forEach(([term, definition]) => {
    // Find text nodes containing the term (case-sensitive, whole word)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      // Skip script, style, and already-tipped elements
      const parent = node.parentElement;
      if (!parent || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(parent.tagName)) continue;
      if (parent.closest('[data-tip]')) continue;
      if (node.textContent.includes(term)) matches.push({ node, term, definition });
    }
    matches.forEach(({ node, term, definition }) => {
      const idx = node.textContent.indexOf(term);
      if (idx < 0) return;
      const before = document.createTextNode(node.textContent.slice(0, idx));
      const span = document.createElement('span');
      span.setAttribute('data-tip', definition);
      span.textContent = term;
      const after = document.createTextNode(node.textContent.slice(idx + term.length));
      const parent = node.parentNode;
      parent.insertBefore(before, node);
      parent.insertBefore(span, node);
      parent.insertBefore(after, node);
      parent.removeChild(node);
    });
  });
}

