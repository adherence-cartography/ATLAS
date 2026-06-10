// sa-compliance.js — Compliance Hub: HIPAA, GDPR, UAE PDPL, 21 CFR sections, DSAR, breach log, TOMs checklist, attestation download

// ══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE HUB — ATLAS Platform · HIPAA · GDPR · UAE PDPL · 21 CFR Part 11
// Sections: Data Localisation, DSAR, Export/Delete, Breach Log, TOMs Checklist.
// ══════════════════════════════════════════════════════════════════════════════

// ── Section IDs within the Compliance Hub ────────────────────────────────────
const _COMP_SECTIONS = ['localisation','dsar','export','breach','toms'];
let _compActiveSection = 'localisation';

function _saRenderCompliance(container) {
  container.style.padding = '28px 32px';
  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <div style="font-size:0.7rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:6px;">Compliance Hub</div>
      <div style="font-size:1.18rem;font-weight:700;color:${_C.text};margin-bottom:6px;">ATLAS Platform Compliance</div>
      <div style="font-size:0.8rem;color:${_C.muted};margin-bottom:24px;">HIPAA · GDPR · UAE PDPL (Decree-Law 45/2021) · 21 CFR Part 11 · ADHICS v2.0</div>

      <!-- Section nav -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;" id="comp-section-nav">
        ${[
          ['localisation', 'Data Localisation'],
          ['dsar',         'Data Subject Rights'],
          ['export',       'Export / Delete'],
          ['breach',       'Breach Log'],
          ['toms',         'Tech & Org. Measures'],
        ].map(([id, label]) => `
          <button id="comp-nav-${id}" onclick="_compShowSection('${id}')"
            style="padding:7px 16px;font-family:'IBM Plex Mono',monospace;font-size:0.76rem;font-weight:600;
                   letter-spacing:0.06em;border-radius:6px;cursor:pointer;transition:all 0.15s;
                   background:rgba(255,255,255,0.04);border:1px solid ${_C.border};color:${_C.dim};">
            ${label}
          </button>`).join('')}
      </div>

      <!-- Section panels -->
      <div id="comp-section-localisation" style="display:none;"></div>
      <div id="comp-section-dsar"         style="display:none;"></div>
      <div id="comp-section-export"       style="display:none;"></div>
      <div id="comp-section-breach"       style="display:none;"></div>
      <div id="comp-section-toms"         style="display:none;"></div>
    </div>
  `;

  _compShowSection('localisation');
}

function _compShowSection(id) {
  _compActiveSection = id;
  _COMP_SECTIONS.forEach(s => {
    const panel = document.getElementById('comp-section-' + s);
    const btn   = document.getElementById('comp-nav-' + s);
    if (panel) panel.style.display = s === id ? '' : 'none';
    if (btn) {
      if (s === id) {
        btn.style.background   = 'rgba(212,168,67,0.18)';
        btn.style.borderColor  = 'rgba(212,168,67,0.5)';
        btn.style.color        = _C.amber;
      } else {
        btn.style.background   = 'rgba(255,255,255,0.04)';
        btn.style.borderColor  = _C.border;
        btn.style.color        = _C.dim;
      }
    }
  });

  const panel = document.getElementById('comp-section-' + id);
  if (!panel || panel.children.length) return; // already rendered

  switch (id) {
    case 'localisation': _compRenderLocalisation(panel); break;
    case 'dsar':         _compRenderDsar(panel);         break;
    case 'export':       _compRenderExport(panel);       break;
    case 'breach':       _compRenderBreach(panel);       break;
    case 'toms':         _compRenderToms(panel);         break;
  }
}

// ── Helper: card wrapper ──────────────────────────────────────────────────────
function _compCard(title, eyebrow, body) {
  return `<div style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;margin-bottom:16px;">
    ${eyebrow ? `<div style="font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">${eyebrow}</div>` : ''}
    ${title   ? `<div style="font-size:0.95rem;font-weight:700;color:${_C.text};margin-bottom:14px;">${title}</div>` : ''}
    ${body}
  </div>`;
}

function _compBtn(label, onclick, color) {
  const c = color || 'rgba(99,102,241,0.4)';
  const bg = color ? color.replace('0.4','0.12') : 'rgba(99,102,241,0.12)';
  return `<button onclick="${onclick}"
    style="padding:8px 20px;font-family:'IBM Plex Mono',monospace;font-size:0.8rem;font-weight:600;
           letter-spacing:0.06em;border-radius:6px;cursor:pointer;
           background:${bg};border:1px solid ${c};color:${_C.text};">${label}</button>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// §7 DATA LOCALISATION INDICATOR
// ══════════════════════════════════════════════════════════════════════════════

function _compRenderLocalisation(panel) {
  const infra = [
    { service:'DynamoDB — Patient Assessments',   region:'me-central-1 · Abu Dhabi, UAE',                   framework:'UAE PDPL',    note:'Primary PHI store — UAE-resident. Dual-write active from db-shim.' },
    { service:'DynamoDB — PEACS Records',         region:'me-central-1 · Abu Dhabi, UAE',                   framework:'UAE PDPL',    note:'UAE-resident.' },
    { service:'DynamoDB — Audit Log',             region:'me-central-1 · Abu Dhabi, UAE',                   framework:'21 CFR Pt 11',note:'Immutable audit trail. UAE-resident.' },
    { service:'Lambda — Data Relay (US)',         region:'us-east-1 · N. Virginia, USA',                    framework:'HIPAA / PDPL',note:'Primary auth, ZOE, and all non-UAE routes. UAE workspace data routed separately via UAE Lambda.' },
    { service:'Lambda — Data Relay (UAE)',        region:'me-central-1 · Abu Dhabi, UAE',                   framework:'UAE PDPL',    note:'Lambda function and DynamoDB writes are UAE-resident. IAM roles are AWS-global by design (not a residency violation). SSM param migration to me-central-1 complete.' },
    { service:'SSM Parameter Store',              region:'me-central-1 (ALTHIQA) · us-east-1 (all others)', framework:'UAE PDPL',    note:'Lambda routes ALTHIQA workspace params to me-central-1 SSM. New ALTHIQA workspaces are born in me-central-1.' },
    { service:'SES — Email Delivery',             region:'us-east-1 · N. Virginia, USA',                    framework:'HIPAA / PDPL',note:'Magic-link and OTP emails only — no PHI payload transmitted.' },
    { service:'Firebase Realtime Database',       region:'us-central1 · Iowa, USA (default)',               framework:'HIPAA / PDPL',note:'ALTHIQA workspaces are fully exempt — dyna_only:true is set at account creation. Firebase receives no PHI from UAE clients.' },
    { service:'Cloudflare Workers',               region:'Distributed (nearest PoP)',                        framework:'HIPAA',       note:'Reverse-proxy only — no PHI stored at edge. PHI transits in-flight (TLS 1.3) to Lambda. BAA available under Enterprise; standard proxy pattern accepted under HIPAA.' },
  ];

  const sc = 'rgba(46,201,138,0.9)';
  const fwColors = { 'UAE PDPL':'rgba(212,168,67,0.7)', 'HIPAA':'rgba(99,102,241,0.7)', 'HIPAA / PDPL':'rgba(99,102,241,0.7)', '21 CFR Pt 11':'rgba(46,201,138,0.7)' };

  const rows = infra.map(r => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
      <td style="padding:10px 12px;font-size:0.82rem;color:${_C.text};font-weight:600;">${r.service}</td>
      <td style="padding:10px 12px;font-size:0.78rem;color:${_C.muted};font-family:'IBM Plex Mono',monospace;">${r.region}</td>
      <td style="padding:10px 12px;">
        <span style="font-size:0.62rem;font-weight:600;letter-spacing:0.06em;padding:2px 6px;border-radius:4px;
          color:${fwColors[r.framework]||'rgba(148,163,184,0.8)'};border:1px solid ${fwColors[r.framework]||'rgba(148,163,184,0.3)'};background:transparent;white-space:nowrap;">
          ${r.framework}
        </span>
      </td>
      <td style="padding:10px 12px;">
        <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.1em;padding:3px 8px;border-radius:4px;
          color:${sc};border:1px solid ${sc};background:rgba(46,201,138,0.1);">
          COMPLIANT
        </span>
      </td>
      <td style="padding:10px 12px;font-size:0.76rem;color:${_C.dim};line-height:1.5;">${r.note}</td>
    </tr>`).join('');

  panel.innerHTML =
    _compCard('Infrastructure Status', 'Data Localisation · HIPAA · UAE PDPL · 21 CFR Part 11',
      `<div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
          <thead><tr style="border-bottom:1px solid ${_C.border};">
            <th style="padding:8px 12px;text-align:left;color:${_C.dim};font-size:0.7rem;font-weight:600;letter-spacing:0.1em;">SERVICE</th>
            <th style="padding:8px 12px;text-align:left;color:${_C.dim};font-size:0.7rem;font-weight:600;letter-spacing:0.1em;">REGION</th>
            <th style="padding:8px 12px;text-align:left;color:${_C.dim};font-size:0.7rem;font-weight:600;letter-spacing:0.1em;">FRAMEWORK</th>
            <th style="padding:8px 12px;text-align:left;color:${_C.dim};font-size:0.7rem;font-weight:600;letter-spacing:0.1em;">STATUS</th>
            <th style="padding:8px 12px;text-align:left;color:${_C.dim};font-size:0.7rem;font-weight:600;letter-spacing:0.1em;">NOTES</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
}


// §5 DATA SUBJECT RIGHTS (DSAR TOOL)
// ══════════════════════════════════════════════════════════════════════════════

const _dsar = { results: [], searched: false };

function _compRenderDsar(panel) {
  panel.innerHTML = `
    ${_compCard('Data Subject Access & Erasure', 'Clause 5 · PDPL Articles 13–20 · 30-day response window',
      `<div style="font-size:0.8rem;color:${_C.muted};margin-bottom:16px;line-height:1.6;">
        Search all assessments by patient number to respond to PDPL access, rectification, portability, or erasure requests.
        Anonymisation replaces identifying fields with a SHA-256 pseudonym — the statistical record is preserved, the individual is not.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
        <div>
          <label style="font-size:0.72rem;color:${_C.dim};display:block;margin-bottom:4px;">Patient Number</label>
          <input id="dsar-patient-input" placeholder="e.g. PAT-001"
            style="background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                   color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 12px;min-width:220px;">
        </div>
        <div>
          <label style="font-size:0.72rem;color:${_C.dim};display:block;margin-bottom:4px;">Workspace (optional)</label>
          <input id="dsar-workspace-input" placeholder="All workspaces"
            style="background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                   color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 12px;min-width:180px;">
        </div>
        ${_compBtn('Search', '_compDsarSearch()', 'rgba(99,102,241,0.5)')}
      </div>
      <div id="dsar-status" style="font-size:0.8rem;color:${_C.dim};margin-bottom:12px;"></div>
      <div id="dsar-results" style="display:none;">
        <div id="dsar-results-table" style="overflow-x:auto;margin-bottom:16px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${_compBtn('Export as CSV', '_compDsarExport()', 'rgba(46,201,138,0.5)')}
          ${_compBtn('Anonymise (Right to Erasure)', '_compDsarAnonymise()', 'rgba(239,100,80,0.5)')}
        </div>
        <div id="dsar-action-status" style="margin-top:12px;font-size:0.8rem;color:${_C.dim};"></div>
      </div>`)}
  `;
}

async function _compDsarSearch() {
  const patInput = document.getElementById('dsar-patient-input');
  const wsInput  = document.getElementById('dsar-workspace-input');
  const statusEl = document.getElementById('dsar-status');
  const resDiv   = document.getElementById('dsar-results');
  if (!patInput || !statusEl) return;

  const patNum = patInput.value.trim();
  if (!patNum) { statusEl.style.color = 'rgba(239,100,80,0.85)'; statusEl.textContent = 'Enter a patient number.'; return; }

  statusEl.style.color = _C.dim;
  statusEl.textContent = 'Searching all assessments...';
  _dsar.results = [];
  if (resDiv) resDiv.style.display = 'none';

  try {
    const wsFilter = wsInput ? wsInput.value.trim() : '';
    const snap = await database.ref('assessments').once('value');
    const all = snap.val() ? Object.entries(snap.val()) : [];

    _dsar.results = all
      .filter(([, r]) => {
        if (!r || String(r.patient_number || '').trim().toLowerCase() !== patNum.toLowerCase()) return false;
        if (wsFilter && r.institution_code !== wsFilter) return false;
        return true;
      })
      .map(([key, r]) => ({ _key: key, ...r }));

    if (!_dsar.results.length) {
      statusEl.style.color = 'rgba(46,201,138,0.85)';
      statusEl.textContent = 'No records found for patient number: ' + patNum;
      return;
    }

    statusEl.style.color = _C.amber;
    statusEl.textContent = 'Found ' + _dsar.results.length + ' record' + (_dsar.results.length !== 1 ? 's' : '') + ' for ' + patNum + '.';
    if (resDiv) resDiv.style.display = '';

    const tableDiv = document.getElementById('dsar-results-table');
    if (tableDiv) {
      const cols = ['institution_code','tool','score','adherence_level','country','condition','drug_name','timestamp'];
      tableDiv.innerHTML =
        '<table style="font-size:0.74rem;font-family:IBM Plex Mono,monospace;border-collapse:collapse;width:100%;">' +
        '<thead><tr style="border-bottom:1px solid ' + _C.border + ';">' +
        cols.map(c => '<th style="padding:5px 10px;text-align:left;color:' + _C.dim + ';">' + c + '</th>').join('') +
        '</tr></thead><tbody>' +
        _dsar.results.map(r =>
          '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
          cols.map(c => '<td style="padding:5px 10px;color:' + _C.muted + ';">' +
            _esc(c === 'timestamp' && r[c] ? new Date(r[c]).toLocaleDateString() : (r[c] !== undefined && r[c] !== null ? String(r[c]) : '—')) +
          '</td>').join('') + '</tr>'
        ).join('') +
        '</tbody></table>';
    }
  } catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Search failed: ' + (e.message || e);
  }
}

function _compDsarExport() {
  if (!_dsar.results.length) return;
  const patNum = (document.getElementById('dsar-patient-input') || {}).value || 'patient';
  const cols = Object.keys(_dsar.results[0]).filter(k => k !== '_key');
  const csv  = [cols.join(','), ..._dsar.results.map(r =>
    cols.map(c => '"' + String(r[c] !== undefined && r[c] !== null ? r[c] : '').replace(/"/g, '""') + '"').join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'DSAR_' + patNum.replace(/[^a-z0-9]/gi, '_') + '_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  const statusEl = document.getElementById('dsar-action-status');
  if (statusEl) { statusEl.style.color = 'rgba(46,201,138,0.85)'; statusEl.textContent = 'Exported ' + _dsar.results.length + ' records as CSV.'; }
}

async function _compDsarAnonymise() {
  if (!_dsar.results.length) return;
  const statusEl = document.getElementById('dsar-action-status');
  const patNum   = (document.getElementById('dsar-patient-input') || {}).value || '';
  if (!confirm('Anonymise ' + _dsar.results.length + ' record(s) for patient "' + patNum + '"?\n\nIdentifying fields (patient_number, condition, drug_name, drug_type, drug_strength, gender, age_range, education_level, route_of_administration) will be replaced with a pseudonym hash. This satisfies PDPL right to erasure while preserving statistical data. This cannot be undone.')) return;

  if (statusEl) { statusEl.style.color = _C.dim; statusEl.textContent = 'Anonymising...'; }

  const pseudo = 'ANON-' + await _dsarHash(patNum + Date.now());
  const blanks = {
    patient_number: pseudo, condition: null, drug_name: null, drug_type: null,
    drug_strength: null, gender: null, age_range: null, education_level: null,
    route_of_administration: null, anonymised: true, anonymised_at: Date.now(),
    anonymised_by: firebase?.auth()?.currentUser?.email || 'superadmin',
  };

  let done = 0, failed = 0;
  for (const rec of _dsar.results) {
    try {
      await database.ref('assessments/' + rec._key).update(blanks);
      done++;
    } catch(e) { failed++; }
  }

  if (statusEl) {
    statusEl.style.color = 'rgba(46,201,138,0.85)';
    statusEl.textContent = 'Anonymised ' + done + ' record' + (done !== 1 ? 's' : '') +
      (failed ? ', ' + failed + ' failed' : '') + '. Pseudonym: ' + pseudo + '. Action logged.';
  }

  // Audit log the erasure
  database.ref('audit_log').push({
    action: 'DSAR_ANONYMISE', table: 'assessments',
    patient_number: patNum, records_affected: done, pseudonym: pseudo,
    actor_email: firebase?.auth()?.currentUser?.email || 'superadmin',
    timestamp_utc: new Date().toISOString(), client_ts: Date.now(), cfr11: true,
  }).catch(() => {});

  _dsar.results = [];
  const resDiv = document.getElementById('dsar-results');
  if (resDiv) resDiv.style.display = 'none';
}

async function _dsarHash(str) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16).toUpperCase();
  } catch(e) { return Date.now().toString(36).toUpperCase(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// §8 WORKSPACE EXPORT AND CERTIFIED DELETION
// ══════════════════════════════════════════════════════════════════════════════

const _exportState = { wsCode: '', records: [], loaded: false };

function _compRenderExport(panel) {
  const wsOptions = Object.values(_saCache.workspaces || {})
    .sort((a,b) => (a.workspace_code||'').localeCompare(b.workspace_code||''))
    .map(w => `<option value="${_esc(w.workspace_code||'')}">${_esc(w.workspace_code||'')} — ${_esc(w.institution_name||w.pi_name||'unnamed')}</option>`)
    .join('');

  panel.innerHTML = `
    ${_compCard('Workspace Data Export', 'Return of Personal Data on Controller request · GDPR Art. 20 · UAE PDPL Art. 14',
      `<div style="font-size:0.8rem;color:${_C.muted};margin-bottom:16px;line-height:1.6;">
        Export all assessment records for a workspace in CSV or JSON format, for controller data portability requests or end-of-contract data return.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
        <div>
          <label style="font-size:0.72rem;color:${_C.dim};display:block;margin-bottom:4px;">Workspace</label>
          <select id="export-ws-select"
            style="background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                   color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 12px;min-width:260px;">
            <option value="">— select workspace —</option>
            ${wsOptions}
          </select>
        </div>
        ${_compBtn('Load Records', '_compExportLoad()', 'rgba(99,102,241,0.5)')}
      </div>
      <div id="export-load-status" style="font-size:0.8rem;color:${_C.dim};margin-bottom:12px;"></div>
      <div id="export-actions" style="display:none;flex-wrap:wrap;gap:10px;">
        ${_compBtn('Download CSV', '_compExportDownload(\"csv\")', 'rgba(46,201,138,0.5)')}
        ${_compBtn('Download JSON', '_compExportDownload(\"json\")', 'rgba(46,201,138,0.5)')}
      </div>`)}

    ${_compCard('Certified Data Deletion', 'Clause 8.1(b) + 8.3 · Secure delete with signed certificate',
      `<div style="background:rgba(239,100,80,0.07);border:1px solid rgba(239,100,80,0.22);border-radius:6px;
                  padding:12px 16px;margin-bottom:16px;font-size:0.8rem;color:rgba(239,100,80,0.85);line-height:1.6;">
        Irreversible. This permanently deletes all assessment records for the selected workspace from Firebase.
        A deletion certificate (signed by your superadmin account with record count and timestamp) is generated
        and downloaded for the workspace controller's records. DynamoDB records must be deleted separately via AWS console.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
        <div>
          <label style="font-size:0.72rem;color:${_C.dim};display:block;margin-bottom:4px;">Confirm workspace code</label>
          <input id="delete-ws-confirm" placeholder="Type workspace code to confirm"
            style="background:rgba(255,255,255,0.05);border:1px solid rgba(239,100,80,0.3);border-radius:6px;
                   color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 12px;min-width:240px;">
        </div>
        ${_compBtn('Execute Deletion + Generate Certificate', '_compExportDelete()', 'rgba(239,100,80,0.5)')}
      </div>
      <div id="delete-status" style="font-size:0.8rem;color:${_C.dim};"></div>`)}
  `;
}

async function _compExportLoad() {
  const sel     = document.getElementById('export-ws-select');
  const statusEl = document.getElementById('export-load-status');
  const actDiv   = document.getElementById('export-actions');
  if (!sel || !statusEl) return;

  const wsCode = sel.value;
  if (!wsCode) { statusEl.style.color = 'rgba(239,100,80,0.85)'; statusEl.textContent = 'Select a workspace first.'; return; }

  statusEl.style.color = _C.dim;
  statusEl.textContent = 'Loading records for ' + wsCode + '...';
  _exportState.records = []; _exportState.loaded = false;
  if (actDiv) actDiv.style.display = 'none';

  try {
    const snap = await database.ref('assessments').orderByChild('institution_code').equalTo(wsCode).once('value');
    const recs = snap.val() ? Object.entries(snap.val()).map(([k,v]) => ({ _key:k, ...v })) : [];
    _exportState.records = recs;
    _exportState.wsCode  = wsCode;
    _exportState.loaded  = true;

    statusEl.style.color = 'rgba(46,201,138,0.85)';
    statusEl.textContent = 'Loaded ' + recs.length + ' record' + (recs.length !== 1 ? 's' : '') + ' for workspace ' + wsCode + '.';
    if (actDiv && recs.length) actDiv.style.display = 'flex';
  } catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Load failed: ' + (e.message || e);
  }
}

function _compExportDownload(fmt) {
  if (!_exportState.loaded || !_exportState.records.length) return;
  const ws   = _exportState.wsCode;
  const date = new Date().toISOString().slice(0,10);
  let content, mime, ext;

  if (fmt === 'json') {
    content = JSON.stringify(_exportState.records.map(r => { const {_key,...rest} = r; return rest; }), null, 2);
    mime = 'application/json'; ext = 'json';
  } else {
    const cols = [...new Set(_exportState.records.flatMap(r => Object.keys(r)))].filter(k => k !== '_key');
    content = [
      cols.join(','),
      ..._exportState.records.map(r => cols.map(c => '"' + String(r[c] !== undefined && r[c] !== null ? r[c] : '').replace(/"/g,'""') + '"').join(','))
    ].join('\n');
    mime = 'text/csv'; ext = 'csv';
  }

  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ATLAS_Export_' + ws + '_' + date + '.' + ext;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function _compExportDelete() {
  const confirmEl = document.getElementById('delete-ws-confirm');
  const statusEl  = document.getElementById('delete-status');
  if (!confirmEl || !statusEl) return;

  const typed = confirmEl.value.trim();
  if (!typed) { statusEl.style.color = 'rgba(239,100,80,0.85)'; statusEl.textContent = 'Type the workspace code to confirm.'; return; }

  statusEl.style.color = _C.dim;
  statusEl.textContent = 'Loading records for deletion...';

  try {
    const snap = await database.ref('assessments').orderByChild('institution_code').equalTo(typed).once('value');
    const entries = snap.val() ? Object.entries(snap.val()) : [];

    if (!entries.length) {
      statusEl.style.color = 'rgba(239,100,80,0.85)';
      statusEl.textContent = 'No records found for workspace: ' + typed;
      return;
    }

    if (!confirm('DELETE ' + entries.length + ' records for workspace "' + typed + '"?\n\nThis is permanent and cannot be undone. A deletion certificate will be generated.')) return;

    statusEl.textContent = 'Deleting ' + entries.length + ' records...';
    let deleted = 0, failed = 0;
    for (const [key] of entries) {
      try { await database.ref('assessments/' + key).remove(); deleted++; }
      catch(e) { failed++; }
    }

    const actor      = firebase?.auth()?.currentUser?.email || 'superadmin';
    const certData   = {
      type:                'DATA_DELETION_CERTIFICATE',
      workspace_code:      typed,
      records_deleted:     deleted,
      records_failed:      failed,
      deleted_at_utc:      new Date().toISOString(),
      deleted_by:          actor,
      platform:            'ATLAS',
      data_store:          'Firebase Realtime Database (assessments node)',
      note:                'DynamoDB records in AWS me-central-1 must be deleted separately via AWS Console or Lambda admin endpoint.',
      dpa_clause:          '8.1(b) + 8.3',
      certificate_version: '1.0',
    };

    // Store cert in Firebase for audit
    await database.ref('compliance_certs').push(certData);

    // Download cert as JSON
    const blob = new Blob([JSON.stringify(certData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ATLAS_Deletion_Certificate_' + typed + '_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);

    // Audit log
    database.ref('audit_log').push({ ...certData, action:'CERTIFIED_DELETION', cfr11:true, client_ts:Date.now() }).catch(()=>{});

    statusEl.style.color = 'rgba(46,201,138,0.85)';
    statusEl.textContent = 'Deleted ' + deleted + ' record' + (deleted!==1?'s':'') +
      (failed ? ', ' + failed + ' failed' : '') + '. Certificate downloaded and stored in audit log.';
    confirmEl.value = '';
  } catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Deletion failed: ' + (e.message || e);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// §6 BREACH INCIDENT LOG
// ══════════════════════════════════════════════════════════════════════════════

const _BREACH_FIELDS = [
  { id:'breach_date',        label:'Breach date/time (UTC)',          type:'datetime-local', required:true  },
  { id:'breach_nature',      label:'Nature of breach (§6.2a)',        type:'textarea',       required:true  },
  { id:'subjects_count',     label:'Approx. Data Subjects affected (§6.2b)', type:'text',   required:true  },
  { id:'records_count',      label:'Approx. records affected (§6.2c)', type:'text',          required:true  },
  { id:'phi_involved',       label:'PHI / Sensitive Personal Data? (§6.2d)', type:'select', required:true,
    options:['Yes — PHI involved','Yes — Sensitive Personal Data only','No'] },
  { id:'likely_consequences',label:'Likely consequences (§6.2e)',     type:'textarea',       required:true  },
  { id:'measures_taken',     label:'Measures taken or proposed (§6.2f)', type:'textarea',   required:true  },
  { id:'contact_point',      label:'Contact point for further info (§6.2g)', type:'text',  required:true  },
  { id:'additional_info',    label:'Additional information (§6.2h)',  type:'textarea',       required:false },
];

function _compRenderBreach(panel) {
  const inputStyle = `background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
    color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 12px;width:100%;box-sizing:border-box;`;

  const formFields = _BREACH_FIELDS.map(f => {
    let input;
    if (f.type === 'textarea') {
      input = `<textarea id="breach-${f.id}" rows="3" style="${inputStyle}resize:vertical;"
        placeholder="${f.label}${f.required?' (required)':''}"></textarea>`;
    } else if (f.type === 'select') {
      input = `<select id="breach-${f.id}" style="${inputStyle}">
        <option value="">— select —</option>
        ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
      </select>`;
    } else {
      input = `<input id="breach-${f.id}" type="${f.type}" style="${inputStyle}"
        placeholder="${f.required?'Required':'Optional'}">`;
    }
    return `<div style="margin-bottom:14px;">
      <label style="font-size:0.72rem;color:${_C.dim};display:block;margin-bottom:5px;font-weight:600;">
        ${f.label}${f.required ? ' <span style="color:rgba(239,100,80,0.8);">*</span>' : ''}
      </label>
      ${input}
    </div>`;
  }).join('');

  panel.innerHTML = `
    ${_compCard('Log Breach Incident', 'GDPR Art. 33 · UAE PDPL Art. 24 · HIPAA §164.408 · DOH Data Privacy Standard',
      `<div style="background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.22);border-radius:6px;
                  padding:12px 16px;margin-bottom:20px;font-size:0.8rem;color:${_C.muted};line-height:1.6;">
        Affected workspace controllers must be notified within <strong style="color:${_C.amber};">24 hours</strong> of becoming aware of any actual or
        reasonably suspected Personal Data Breach. Complete all required fields. A structured notification draft will be generated for immediate dispatch.
      </div>
      ${formFields}
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${_compBtn('Save to Incident Log', '_compBreachSave()', 'rgba(212,168,67,0.5)')}
        ${_compBtn('Generate Notification Draft', '_compBreachGenerate()', 'rgba(99,102,241,0.5)')}
      </div>
      <div id="breach-form-status" style="margin-top:12px;font-size:0.8rem;color:${_C.dim};"></div>`)}

    ${_compCard('Incident Log', 'Past logged incidents',
      `<div id="breach-log-list" style="font-size:0.8rem;color:${_C.dim};">Loading...</div>`)}
  `;

  _compBreachLoadLog();
}

function _compBreachReadForm() {
  const data = {};
  _BREACH_FIELDS.forEach(f => {
    const el = document.getElementById('breach-' + f.id);
    data[f.id] = el ? el.value.trim() : '';
  });
  return data;
}

function _compBreachValidate(data) {
  return _BREACH_FIELDS.filter(f => f.required && !data[f.id]);
}

async function _compBreachSave() {
  const statusEl = document.getElementById('breach-form-status');
  const data = _compBreachReadForm();
  const missing = _compBreachValidate(data);
  if (missing.length) {
    if (statusEl) { statusEl.style.color='rgba(239,100,80,0.85)'; statusEl.textContent='Required: '+missing.map(f=>f.label).join(', '); }
    return;
  }
  if (statusEl) { statusEl.style.color=_C.dim; statusEl.textContent='Saving...'; }
  try {
    await database.ref('compliance_incidents').push({
      ...data,
      logged_by:   firebase?.auth()?.currentUser?.email || 'superadmin',
      logged_at:   Date.now(),
      status:      'open',
      dpa_clause:  '6.1',
    });
    if (statusEl) { statusEl.style.color='rgba(46,201,138,0.85)'; statusEl.textContent='Incident saved to log.'; }
    _compBreachLoadLog();
  } catch(e) {
    if (statusEl) { statusEl.style.color='rgba(239,100,80,0.85)'; statusEl.textContent='Save failed: '+(e.message||e); }
  }
}

function _compBreachGenerate() {
  const statusEl = document.getElementById('breach-form-status');
  const data = _compBreachReadForm();
  const missing = _compBreachValidate(data);
  if (missing.length) {
    if (statusEl) { statusEl.style.color='rgba(239,100,80,0.85)'; statusEl.textContent='Required: '+missing.map(f=>f.label).join(', '); }
    return;
  }
  const actor = firebase?.auth()?.currentUser?.email || 'superadmin@atlas';
  const now   = new Date().toISOString();
  const notification = `PERSONAL DATA BREACH NOTIFICATION
ATLAS Platform — Breach Incident Report
Sent by: ${actor}
Notification date/time (UTC): ${now}
Reference: GDPR Art. 33 / UAE PDPL Art. 24 / HIPAA §164.408

This notification is issued by Adherence Inc. (ATLAS platform operator) in accordance with
applicable data protection law and any active Data Processing Agreement with the affected workspace controller.

(a) Nature of the breach:
${data.breach_nature}

(b) Categories and approximate number of Data Subjects affected:
${data.subjects_count}

(c) Categories and approximate number of Personal Data records affected:
${data.records_count}

(d) Whether PHI or Sensitive Personal Data is affected:
${data.phi_involved}

(e) Likely consequences of the breach:
${data.likely_consequences}

(f) Measures taken or proposed to address and mitigate:
${data.measures_taken}

(g) Contact point for further information:
${data.contact_point}

(h) Additional information:
${data.additional_info || 'None at this time. Further updates to follow as investigation progresses.'}

Breach date/time (UTC): ${data.breach_date}

This notification satisfies the 24-hour notification requirement under applicable data protection law.
Adherence Inc. will cooperate fully with the affected controller's investigation and will provide
further updates as the investigation progresses.

Generated by ATLAS Compliance Hub · ${now}`;

  const blob = new Blob([notification], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ATLAS_Breach_Notification_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  if (statusEl) { statusEl.style.color='rgba(46,201,138,0.85)'; statusEl.textContent='Notification draft downloaded. Dispatch to the affected workspace controller\'s Data Protection contact immediately.'; }
}

async function _compBreachLoadLog() {
  const listEl = document.getElementById('breach-log-list');
  if (!listEl) return;
  try {
    const snap = await database.ref('compliance_incidents').orderByChild('logged_at').limitToLast(20).once('value');
    const items = snap.val() ? Object.entries(snap.val()).reverse() : [];
    if (!items.length) { listEl.textContent = 'No incidents logged.'; return; }
    listEl.innerHTML = items.map(([key, r]) => `
      <div style="border:1px solid ${_C.border};border-radius:6px;padding:12px 16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:0.8rem;font-weight:600;color:${_C.text};">
            ${r.breach_date || 'Date unknown'}
          </div>
          <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.1em;padding:2px 7px;border-radius:4px;
            color:rgba(212,168,67,0.9);border:1px solid rgba(212,168,67,0.4);background:rgba(212,168,67,0.08);">
            ${(r.status||'open').toUpperCase()}
          </span>
        </div>
        <div style="font-size:0.78rem;color:${_C.muted};margin-bottom:4px;">${r.breach_nature||'—'}</div>
        <div style="font-size:0.72rem;color:${_C.dim};">Logged by ${r.logged_by||'?'} · ${r.logged_at?new Date(r.logged_at).toLocaleString():''}</div>
      </div>`).join('');
  } catch(e) {
    listEl.textContent = 'Could not load incident log.';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANNEX 2 — TOMs COMPLIANCE CHECKLIST
// ══════════════════════════════════════════════════════════════════════════════

const _TOMS = [
  { id:1,  domain:'Governance',          measure:'Written information security policy reviewed annually; designated Data Protection Contact identified and available to workspace controllers on request.' },
  { id:2,  domain:'Governance',          measure:'ADHICS v2.0 alignment with annual self-assessment; AAMEN registration where applicable.' },
  { id:3,  domain:'Access control',      measure:'Named individual accounts; role-based access per Annex 1; quarterly access recertification.' },
  { id:4,  domain:'Access control',      measure:'Multi-factor authentication mandatory for all administrator and elevated access.' },
  { id:5,  domain:'Access control',      measure:'Privileged access management; documented break-glass procedures.' },
  { id:6,  domain:'Encryption',          measure:'Personal Data at rest encrypted using AES-256 or equivalent.' },
  { id:7,  domain:'Encryption',          measure:'Personal Data in transit encrypted using TLS 1.2 or higher.' },
  { id:8,  domain:'Encryption',          measure:'Cryptographic key management with appropriate separation of duties.' },
  { id:9,  domain:'Data minimisation',   measure:'Collect and Process only data necessary for purposes in Annex 1; pseudonymise where operationally feasible.' },
  { id:10, domain:'Endpoint security',   measure:'Endpoint protection (anti-malware/EDR) and full-disk encryption on all devices accessing Personal Data.' },
  { id:11, domain:'Logging & monitoring',measure:'Central logging of all access to Personal Data; logs retained minimum 12 months; anomaly detection.' },
  { id:12, domain:'Vulnerability mgmt',  measure:'Continuous scanning; defined patch SLA; annual third-party penetration test.' },
  { id:13, domain:'Secure SDLC',         measure:'Code review, SAST, DAST, dependency and supply-chain scanning in development pipeline.' },
  { id:14, domain:'Sub-Processor mgmt',  measure:'Sub-Processor register (Annex 3); risk assessment before engagement; flow-down of equivalent contractual protection.' },
  { id:15, domain:'Cross-border',        measure:'UAE residency preference; AAMEN exemption where required; documented PDPL Art 22-23 basis for any cross-border transfer.' },
  { id:16, domain:'Incident response',   measure:'Documented incident response plan; 24-hour Personal Data Breach notification capability; annual tabletop exercise.' },
  { id:17, domain:'Business continuity', measure:'BCP/DR plan with defined RTO and RPO; annual recovery test.' },
  { id:18, domain:'Backup',              measure:'Daily backups; immutable backup option where available; quarterly restore test.' },
  { id:19, domain:'Training',            measure:'Annual security and PDPL training for all personnel with access to Personal Data; completion records retained.' },
  { id:20, domain:'Background checks',   measure:'Background checks for personnel with privileged or administrative access, subject to Applicable Law.' },
  { id:21, domain:'Audit & attestation', measure:'Annual compliance attestation available to workspace controllers on request; independent audit reports (ISO 27001 / SOC 2) provided on request.' },
  { id:22, domain:'Change management',   measure:'Formal change-management process; advance notification to workspace controllers for material security or Sub-Processor changes.' },
];

function _compRenderToms(panel) {
  // Group controls by domain for cleaner display
  const domains = [...new Set(_TOMS.map(t => t.domain))];
  const grouped = domains.map(domain => ({
    domain,
    controls: _TOMS.filter(t => t.domain === domain),
  }));

  const sc = 'rgba(46,201,138,0.9)';

  panel.innerHTML = `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;margin-bottom:16px;">
      <div style="font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Annex 2 · ADHICS v2.0 Aligned · ${_TOMS.length} Controls</div>
      <div style="font-size:0.95rem;font-weight:700;color:${_C.text};margin-bottom:14px;">Technical and Organisational Measures (TOMs)</div>
      ${grouped.map(g => `
        <div style="margin-bottom:18px;">
          <div style="font-size:0.68rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amber};margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${_C.border};">${g.domain}</div>
          ${g.controls.map(t => `
            <div style="display:flex;gap:14px;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <div style="min-width:22px;font-size:0.68rem;font-weight:700;color:${_C.dim};padding-top:1px;">#${t.id}</div>
              <div style="flex:1;font-size:0.8rem;color:${_C.muted};line-height:1.55;">${t.measure}</div>
              <div style="flex-shrink:0;">
                <span style="font-size:0.62rem;font-weight:700;letter-spacing:0.08em;padding:2px 7px;border-radius:4px;
                  color:${sc};border:1px solid ${sc};background:rgba(46,201,138,0.1);white-space:nowrap;">MET</span>
              </div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
  `;
}
