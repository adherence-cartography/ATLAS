// ══════════════════════════════════════════════════════════════════════════════
// FHIR Export — HL7 FHIR R4 Observation export for MAP/MMAS-8 assessments
// BP-INT-03: Enables EHR integration (Epic, Cerner, etc.) via FHIR webhooks
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

// ── SMART on FHIR Launch Detection ───────────────────────────────────────────

/**
 * Detects whether ATLAS was launched via a SMART on FHIR EHR launch sequence.
 * Reads `launch` and `iss` URL parameters injected by the EHR (Epic, Cerner, etc.).
 * Stores context in window._atlasSmartContext and shows the EHR launch banner.
 * @returns {Object|null} SMART context object, or null if not a SMART launch
 */
function detectSMARTLaunch() {
  const params = new URLSearchParams(window.location.search);
  const launchToken = params.get('launch');
  const issUrl = params.get('iss');
  if (!launchToken || !issUrl) return null;
  window._atlasSmartContext = { launch: launchToken, iss: issUrl, initiated: Date.now() };
  _showSMARTBanner(issUrl);
  console.log('[ATLAS FHIR] SMART launch detected from:', issUrl);
  return window._atlasSmartContext;
}

function _showSMARTBanner(issUrl) {
  let b = document.getElementById('atlas-smart-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'atlas-smart-banner';
    b.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:9999;background:var(--accent,#4e9cf5);color:#fff;padding:0.5rem 1rem;font-size:0.875rem;align-items:center;gap:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.prepend(b);
  }
  const domain = (() => { try { return new URL(issUrl).hostname; } catch(e) { return issUrl; } })();
  b.innerHTML = `<span>🏥 Launched from EHR</span><span style="opacity:0.8;font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${domain}</span><button onclick="document.getElementById('atlas-smart-banner').style.display='none'" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0 0.25rem;">✕</button>`;
  b.style.display = 'flex';
}

/**
 * Pre-populates patient context from a SMART launch.
 * NOTE: Full SMART auth requires a server-side token exchange step (OAuth2 authorization
 * code flow). This initial implementation stores context and pre-fills patient fields
 * when a patientId is already present in the launch context.
 * @param {Object} smartCtx - context returned by detectSMARTLaunch()
 */
function applySmartPatientContext(smartCtx) {
  if (!smartCtx) return;
  // Pre-fill patient number field if empty
  const patientFields = ['sdoh-patient', 'patient-number', 'patient_id', 'pt-number'].map(id => document.getElementById(id)).filter(Boolean);
  if (smartCtx.patientId) {
    patientFields.forEach(f => { if (!f.value) f.value = smartCtx.patientId; });
  }
  // Store FHIR patient reference for inclusion in Observation resources
  window._atlasFHIRPatientRef = smartCtx.patientId
    ? { reference: `Patient/${smartCtx.patientId}`, type: 'Patient' }
    : null;
}

// ── LOINC codes for MAP instrument ───────────────────────────────────────────
// Using local codes until formal LOINC assignment (to be assigned by LOINC committee)
const FHIR_CODING = {
  MAP_SCORE:      { system: 'https://adherence.cc/fhir/codes', code: 'MAP-COMPOSITE', display: 'MAP Medication Adherence Composite Score' },
  MAP_PHENOTYPE:  { system: 'https://adherence.cc/fhir/codes', code: 'MAP-PHENOTYPE', display: 'MAP Behavioral Adherence Phenotype' },
  MMAS8_SCORE:    { system: 'http://loinc.org', code: '89972-9', display: 'Morisky Medication Adherence Scale 8-item' },
  PEACS_BASE:     { system: 'https://adherence.cc/fhir/codes', code: 'PEACS-BASE', display: 'PEACS Architecture Domain Score (30-day)' },
  PEACS_MVMT:     { system: 'https://adherence.cc/fhir/codes', code: 'PEACS-MVMT', display: 'PEACS Execution Domain Score (7-day)' },
  PEACS_STRATA:   { system: 'https://adherence.cc/fhir/codes', code: 'PEACS-STRATA', display: 'PEACS Context Domain Score (90-day)' },
};

/**
 * Converts a single ATLAS assessment record to a FHIR R4 Observation resource.
 * @param {Object} record - ATLAS assessment record
 * @param {string} patientRef - FHIR Patient reference (e.g. "Patient/12345")
 * @returns {Object} FHIR Observation resource
 */
function assessmentToFHIRObservation(record, patientRef) {
  const phenotype = (typeof deriveMAPPhenotype === 'function') ? deriveMAPPhenotype(record) : (record.map_phenotype || 'PA');
  const score = record.score !== undefined ? record.score : null;
  const ts = record.timestamp ? new Date(record.timestamp).toISOString() : new Date().toISOString();

  const obs = {
    resourceType: 'Observation',
    id: record.id || record.patient_number + '-' + record.timestamp,
    status: 'final',
    category: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }]
    }],
    code: { coding: [FHIR_CODING.MAP_SCORE], text: 'MAP Medication Adherence Assessment' },
    subject: window._atlasFHIRPatientRef || { reference: patientRef || ('Patient/' + (record.patient_number || 'unknown')) },
    effectiveDateTime: ts,
    issued: ts,
    performer: [{ display: record.workspace || 'ATLAS Platform' }],
    note: [{ text: 'Generated by ATLAS Adherence Cartography Platform (adherence.cc)' }]
  };

  if (score !== null) {
    obs.valueQuantity = { value: score, unit: 'score', system: 'http://unitsofmeasure.org', code: '{score}' };
  }

  obs.component = [
    {
      code: { coding: [FHIR_CODING.MAP_PHENOTYPE] },
      valueCodeableConcept: {
        coding: [{ system: 'https://adherence.cc/fhir/codes/phenotype', code: phenotype }],
        text: { INA: 'Intentional Non-Adherent', UNA: 'Unintentional Non-Adherent', PA: 'Partially Adherent', A: 'Adherent' }[phenotype] || phenotype
      }
    }
  ];

  if (record.peacs_base !== undefined)   obs.component.push({ code: { coding: [FHIR_CODING.PEACS_BASE] },   valueQuantity: { value: record.peacs_base,   unit: 'score' } });
  if (record.peacs_mvmt !== undefined)   obs.component.push({ code: { coding: [FHIR_CODING.PEACS_MVMT] },   valueQuantity: { value: record.peacs_mvmt,   unit: 'score' } });
  if (record.peacs_strata !== undefined) obs.component.push({ code: { coding: [FHIR_CODING.PEACS_STRATA] }, valueQuantity: { value: record.peacs_strata, unit: 'score' } });

  return obs;
}

/**
 * Exports a cohort of ATLAS assessments as a FHIR R4 Bundle.
 * @param {Object[]} records - array of ATLAS assessment records
 * @returns {Object} FHIR Bundle resource
 */
function exportFHIRBundle(records) {
  const bundle = {
    resourceType: 'Bundle',
    id: 'atlas-export-' + Date.now(),
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: { source: 'https://adherence.cc', profile: ['https://adherence.cc/fhir/StructureDefinition/atlas-bundle'] },
    entry: records.map(r => ({
      fullUrl: 'urn:uuid:' + (r.id || crypto.randomUUID()),
      resource: assessmentToFHIRObservation(r)
    }))
  };
  return bundle;
}

/**
 * Downloads a FHIR Bundle as a JSON file.
 * @param {Object[]} records - array of ATLAS assessment records
 */
function downloadFHIRBundle(records) {
  if (typeof isSuperAdmin !== 'function' && typeof isPIMode !== 'function') return;
  const hasAccess = (typeof isSuperAdmin === 'function' && isSuperAdmin()) ||
                    (typeof isPIMode === 'function' && isPIMode()) ||
                    (typeof isInstitutionMode === 'function' && isInstitutionMode());
  if (!hasAccess) {
    if (typeof showToast === 'function') showToast('PI or higher access required for FHIR export.', 3000);
    return;
  }
  const bundle = exportFHIRBundle(records);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atlas-fhir-bundle-${currentWorkspace}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (typeof atlasAuditLog === 'function') atlasAuditLog('FHIR_EXPORT', { count: records.length });
}

// ── Webhook Configuration ─────────────────────────────────────────────────────

/**
 * Opens the FHIR webhook configuration panel.
 * @param {HTMLElement} container
 */
function openFHIRWebhookConfig(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(78,156,245,0.6);margin-bottom:6px;">Integrations · FHIR Webhook</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:16px;">HL7 FHIR R4 Webhook</div>
    <p style="font-size:0.84rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:20px;max-width:520px;">Configure a FHIR endpoint to receive MAP/MMAS-8 assessment results as FHIR Observations automatically after each patient assessment. Compatible with Epic FHIR, Cerner, and any FHIR R4 compliant server.</p>
    <div id="fhir-wh-form" style="max-width:520px;display:flex;flex-direction:column;gap:14px;">
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">FHIR Server Base URL</label>
        <input id="fhir-wh-url" type="url" placeholder="https://fhir.hospital.org/api/FHIR/R4"
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
      </div>
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">Authentication Type</label>
        <select id="fhir-wh-auth" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;color:var(--bright,#e8f0f8);outline:none;">
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="none">None (internal/sandbox)</option>
        </select>
      </div>
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">Authorization Token / Credentials</label>
        <input id="fhir-wh-token" type="password" placeholder="Bearer token or user:password"
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
      </div>
      <div id="fhir-wh-err" style="font-size:0.78rem;color:rgba(239,68,68,0.9);display:none;"></div>
      <div style="display:flex;gap:10px;">
        <button onclick="saveFHIRWebhook()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:10px 18px;border-radius:7px;cursor:pointer;">Save Webhook →</button>
        <button onclick="testFHIRWebhook()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.15);color:var(--muted,#6b8099);padding:10px 18px;border-radius:7px;cursor:pointer;">Send Test Ping</button>
      </div>

      <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border,#2a2a3e);">
        <div style="font-size:0.8rem;font-weight:600;color:var(--text);margin-bottom:0.75rem;">SMART on FHIR Registration</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:0.75rem;">Register ATLAS with your EHR's app marketplace to enable single-click launch from patient charts.</div>

        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.7rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Client ID (from EHR registration)</label>
          <input type="text" id="smart-client-id" placeholder="atlas-adherence-prod"
            style="width:100%;padding:0.4rem 0.6rem;background:var(--surface,#0f0f1a);border:1px solid var(--border,#2a2a3e);border-radius:5px;color:var(--text);font-size:0.8rem;box-sizing:border-box;">
        </div>

        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.7rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Redirect URI</label>
          <div style="padding:0.4rem 0.6rem;background:var(--surface,#0f0f1a);border:1px solid var(--border,#2a2a3e);border-radius:5px;font-size:0.8rem;color:var(--muted);font-family:monospace;">https://atlas.adherence.cc/assess.html</div>
        </div>

        <div style="margin-bottom:0.75rem;">
          <label style="font-size:0.7rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Required Scopes</label>
          <div style="padding:0.4rem 0.6rem;background:var(--surface,#0f0f1a);border:1px solid var(--border,#2a2a3e);border-radius:5px;font-size:0.75rem;color:var(--muted);font-family:monospace;">launch patient/*.read openid fhirUser</div>
        </div>

        <button onclick="_saveSMARTClientId()" style="padding:0.4rem 0.8rem;background:var(--accent,#4e9cf5);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:0.75rem;">Save Client ID</button>
        <div style="margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">For Epic App Orchard submission, see <a href="https://appmarket.epic.com" target="_blank" style="color:var(--accent);">appmarket.epic.com</a></div>
      </div>
    </div>`;

  // Load persisted SMART Client ID from Firebase into the input
  const ws = window.currentWorkspace || window._currentWS;
  if (ws && typeof database !== 'undefined') {
    database.ref('workspaces/' + ws + '/fhir_config/smart_client_id').once('value')
      .then(snap => {
        const val = snap.val();
        const field = document.getElementById('smart-client-id');
        if (field && val) field.value = val;
      }).catch(() => { /* non-critical */ });
  }
}

async function saveFHIRWebhook() {
  const url   = document.getElementById('fhir-wh-url')?.value.trim();
  const auth  = document.getElementById('fhir-wh-auth')?.value;
  const token = document.getElementById('fhir-wh-token')?.value.trim();
  const errEl = document.getElementById('fhir-wh-err');

  if (!url) { if (errEl) { errEl.textContent = 'FHIR server URL is required.'; errEl.style.display = 'block'; } return; }

  try {
    const res = await fetch(LAMBDA_URL + '/fhir-webhook-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace, fhir_url: url, auth_type: auth, token })
    });
    if (!res.ok) throw new Error('Failed to save webhook configuration');
    if (typeof showToast === 'function') showToast('FHIR webhook saved. New assessments will be posted automatically.', 4000);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('FHIR_WEBHOOK_SAVED', { fhir_url: url, auth_type: auth });
  } catch(e) {
    if (errEl) { errEl.textContent = 'Save failed: ' + e.message; errEl.style.display = 'block'; }
  }
}

async function testFHIRWebhook() {
  const testObs = assessmentToFHIRObservation({ score: 7.5, q1:0,q2:0,q3:0,q4:0,q5:1,q6:0,q7:0,q8:0, timestamp: Date.now(), patient_number: 'TEST-001' });
  const status = document.getElementById('fhir-wh-err');
  if (status) { status.textContent = 'Sending test ping…'; status.style.color = 'rgba(78,156,245,0.8)'; status.style.display = 'block'; }

  try {
    const res = await fetch(LAMBDA_URL + '/fhir-webhook-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace, observation: testObs })
    });
    const data = await res.json();
    if (status) { status.textContent = '✓ Test ping successful: ' + (data.message || 'FHIR server responded 200'); status.style.color = 'rgba(46,201,138,0.9)'; }
  } catch(e) {
    if (status) { status.textContent = 'Test failed: ' + e.message; status.style.color = 'rgba(239,68,68,0.9)'; }
  }
}

// ── SMART App Registration Config UI ─────────────────────────────────────────

/**
 * Saves the SMART Client ID directly to Firebase at
 * workspaces/{ws}/fhir_config/smart_client_id.
 */
function _saveSMARTClientId() {
  const clientId = document.getElementById('smart-client-id')?.value.trim();
  if (!clientId) return;
  const ws = window.currentWorkspace || window._currentWS;
  if (!ws) return;
  database.ref('workspaces/' + ws + '/fhir_config/smart_client_id').set(clientId)
    .then(() => { if (typeof showToast === 'function') showToast('SMART Client ID saved.', 2500); });
}

// ── Module Initialization ─────────────────────────────────────────────────────

(function initFHIRModule() {
  // Run SMART launch detection as early as possible.
  // If ATLAS is embedded in an EHR iframe the launch + iss params will be present.
  const smartCtx = detectSMARTLaunch();
  if (smartCtx) {
    // NOTE: Full SMART auth requires a server-side token exchange step (OAuth2 authorization
    // code flow) before patient data can be fetched from the FHIR server. The call below
    // pre-populates patient fields only when a patientId is already carried in the context.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applySmartPatientContext(smartCtx));
    } else {
      applySmartPatientContext(smartCtx);
    }
  }
})();
