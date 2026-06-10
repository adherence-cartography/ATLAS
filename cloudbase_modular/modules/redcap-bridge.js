// ══════════════════════════════════════════════════════════════════════════════
// REDCap Bridge — Bidirectional sync between ATLAS and REDCap projects
// BP-INT-02: Enables PIs to eliminate double-entry between ATLAS and REDCap
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

/** @type {Object|null} Current REDCap connection config for this workspace */
let _redcapConfig = null;
/** @type {boolean} Whether a sync is currently in progress */
let _redcapSyncing = false;
/** @type {Function|null} Detach handle for the auto-sync Firebase listener */
let _redcapAutoSyncListener = null;

/**
 * Opens the REDCap Bridge configuration panel.
 * PI and institution roles only.
 * @param {HTMLElement} container - target container element
 */
function openREDCapBridge(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(78,156,245,0.6);margin-bottom:6px;">Integrations · REDCap Bridge</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:20px;">REDCap Bidirectional Sync</div>
    <div id="redcap-config-panel"></div>
    <div id="redcap-sync-panel" style="display:none;"></div>
    <div id="redcap-log-panel" style="display:none;"></div>
  `;
  _loadREDCapConfig();
}

async function _loadREDCapConfig() {
  const panel = document.getElementById('redcap-config-panel');
  if (!panel) return;

  try {
    const snap = await database.ref(`workspaces/${currentWorkspace}/redcap_config`).once('value');
    _redcapConfig = snap.val();
  } catch(e) { _redcapConfig = null; }

  if (_redcapConfig && _redcapConfig.api_url && _redcapConfig.api_token_hash) {
    _renderREDCapConnected(panel);
  } else {
    _renderREDCapSetup(panel);
    _restoreREDCapFormValues();
  }
}

/** Restores saved config values into the setup form inputs (after _renderREDCapSetup). */
function _restoreREDCapFormValues() {
  if (!_redcapConfig) return;
  const _set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const _chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  _set('rc-api-url',           _redcapConfig.api_url);
  _set('rc-id-field',          _redcapConfig.id_field);
  _set('rc-score-field',       _redcapConfig.score_field);
  _set('rc-phenotype-field',   _redcapConfig.phenotype_field);
  // MAP subscales
  _set('rc-field-map-arch',    _redcapConfig.rc_field_map_arch);
  _set('rc-field-map-exec',    _redcapConfig.rc_field_map_exec);
  _set('rc-field-map-ctx',     _redcapConfig.rc_field_map_ctx);
  // PEACS domains
  _set('rc-field-peacs-base',  _redcapConfig.rc_field_peacs_base);
  _set('rc-field-peacs-mvmt',  _redcapConfig.rc_field_peacs_mvmt);
  _set('rc-field-peacs-strata',_redcapConfig.rc_field_peacs_strata);
  // Auto-sync checkbox
  _chk('rc-auto-sync',         _redcapConfig.rc_auto_sync);
}

function _renderREDCapSetup(panel) {
  const _inputStyle = "width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;";
  const _labelStyle = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;";
  const _sectionHead = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(78,156,245,0.5);margin:18px 0 10px;border-top:1px solid rgba(78,156,245,0.1);padding-top:14px;";
  panel.innerHTML = `
    <div style="background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.15);border-radius:12px;padding:24px;max-width:520px;">
      <div style="font-size:0.84rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:20px;">
        Connect your REDCap project to sync MAP/MMAS-8 scores bidirectionally. Requires a REDCap API token with Export and Import privileges.
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">

        <!-- ── Connection ── -->
        <div>
          <label style="${_labelStyle}">REDCap API URL</label>
          <input id="rc-api-url" type="url" placeholder="https://redcap.yourinstitution.edu/api/" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">REDCap API Token</label>
          <input id="rc-api-token" type="password" placeholder="32-character alphanumeric token" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">Patient ID Field (REDCap variable name)</label>
          <input id="rc-id-field" type="text" placeholder="record_id" style="${_inputStyle}"/>
        </div>

        <!-- ── MMAS-8 / MAP Core ── -->
        <div style="${_sectionHead}">MMAS-8 &amp; MAP Core Fields</div>
        <div>
          <label style="${_labelStyle}">MMAS-8 Score Field — ATLAS: <code>record.score</code></label>
          <input id="rc-score-field" type="text" placeholder="mmas8_score" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">MAP Phenotype Field — ATLAS: <code>record.map_phenotype</code></label>
          <input id="rc-phenotype-field" type="text" placeholder="map_phenotype" style="${_inputStyle}"/>
        </div>

        <!-- ── MAP Subscale Scores ── -->
        <div style="${_sectionHead}">MAP Subscale Scores (0–1 decimal)</div>
        <div>
          <label style="${_labelStyle}">MAP Architecture Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (belief/motivation domain, 0–1)</span></label>
          <input id="rc-field-map-arch" type="text" placeholder="map_architecture" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">MAP Execution Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (habit/routine domain, 0–1)</span></label>
          <input id="rc-field-map-exec" type="text" placeholder="map_execution" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">MAP Context Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (environment/access domain, 0–1)</span></label>
          <input id="rc-field-map-ctx" type="text" placeholder="map_context" style="${_inputStyle}"/>
        </div>

        <!-- ── PEACS Domain Scores ── -->
        <div style="${_sectionHead}">PEACS Domain Composite Scores (0–1 decimal)</div>
        <div>
          <label style="${_labelStyle}">PEACS BASE Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (behavioral adherence habits, 0–1)</span></label>
          <input id="rc-field-peacs-base" type="text" placeholder="peacs_base" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">PEACS MVMT Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (routine/movement domain, 0–1)</span></label>
          <input id="rc-field-peacs-mvmt" type="text" placeholder="peacs_mvmt" style="${_inputStyle}"/>
        </div>
        <div>
          <label style="${_labelStyle}">PEACS STRATA Score
            <span style="font-size:0.90em;font-weight:300;text-transform:none;letter-spacing:0;"> (mindset/stratification, 0–1)</span></label>
          <input id="rc-field-peacs-strata" type="text" placeholder="peacs_strata" style="${_inputStyle}"/>
        </div>

        <!-- ── Auto-Sync ── -->
        <div style="${_sectionHead}">Auto-Sync</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <input id="rc-auto-sync" type="checkbox" style="width:15px;height:15px;accent-color:rgba(78,156,245,0.9);cursor:pointer;"/>
          <label for="rc-auto-sync" style="font-size:0.82rem;color:var(--text,#c8d6e8);cursor:pointer;">
            Auto-sync to REDCap after each new assessment submission
          </label>
        </div>
        <div style="font-size:0.76rem;color:var(--muted,#6b8099);line-height:1.6;margin-top:-6px;">
          When enabled, each new ATLAS assessment is pushed to REDCap immediately on submission. Only the new record is sent — not the full cohort.
        </div>

        <div id="rc-config-err" style="font-size:0.78rem;color:rgba(239,68,68,0.9);display:none;"></div>
        <button onclick="saveREDCapConfig()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.12);border:1px solid rgba(78,156,245,0.35);color:rgba(78,156,245,0.9);padding:10px 20px;border-radius:7px;cursor:pointer;transition:all 0.2s;"
          onmouseover="this.style.background='rgba(78,156,245,0.22)'" onmouseout="this.style.background='rgba(78,156,245,0.12)'">
          Connect REDCap →
        </button>
      </div>
    </div>`;
}

function _renderREDCapConnected(panel) {
  const autoSyncOn = _redcapConfig && _redcapConfig.rc_auto_sync;
  panel.innerHTML = `
    <div style="background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.2);border-radius:10px;padding:16px 20px;max-width:520px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
      <span style="font-size:1.2rem;">✓</span>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(46,201,138,0.8);margin-bottom:3px;">Connected</div>
        <div style="font-size:0.82rem;color:var(--text,#c8d6e8);">${_esc(_redcapConfig.api_url || 'REDCap')}</div>
      </div>
      <button onclick="disconnectREDCap()" style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.7);padding:5px 10px;border-radius:5px;cursor:pointer;">Disconnect</button>
    </div>
    <div style="display:flex;gap:10px;max-width:520px;flex-wrap:wrap;margin-bottom:12px;">
      <button onclick="syncATLAStoREDCap()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:10px 18px;border-radius:7px;cursor:pointer;transition:all 0.2s;">ATLAS → REDCap Push</button>
      <button onclick="syncREDCapToATLAS()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:10px 18px;border-radius:7px;cursor:pointer;transition:all 0.2s;">REDCap → ATLAS Pull</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;max-width:520px;margin-bottom:8px;">
      <input id="rc-auto-sync-toggle" type="checkbox" ${autoSyncOn ? 'checked' : ''}
        style="width:15px;height:15px;accent-color:rgba(78,156,245,0.9);cursor:pointer;"
        onchange="toggleREDCapAutoSync(this.checked)"/>
      <label for="rc-auto-sync-toggle" style="font-size:0.82rem;color:var(--text,#c8d6e8);cursor:pointer;">
        Auto-sync on new submission
        ${autoSyncOn ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(46,201,138,0.8);margin-left:8px;">active</span>' : ''}
      </label>
    </div>
    <div id="redcap-sync-status" style="font-size:0.80rem;color:var(--muted,#6b8099);margin-top:4px;"></div>
    <div id="redcap-sync-log" style="margin-top:16px;max-height:200px;overflow-y:auto;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--muted,#6b8099);line-height:1.8;"></div>`;
}

async function saveREDCapConfig() {
  const url   = document.getElementById('rc-api-url')?.value.trim();
  const token = document.getElementById('rc-api-token')?.value.trim();
  const idFld = document.getElementById('rc-id-field')?.value.trim() || 'record_id';
  const scoreFld = document.getElementById('rc-score-field')?.value.trim() || 'mmas8_score';
  const phenoFld = document.getElementById('rc-phenotype-field')?.value.trim() || 'map_phenotype';
  const errEl = document.getElementById('rc-config-err');

  if (!url || !token) {
    if (errEl) { errEl.textContent = 'API URL and token are required.'; errEl.style.display = 'block'; }
    return;
  }
  if (token.length !== 32) {
    if (errEl) { errEl.textContent = 'REDCap API tokens are exactly 32 characters.'; errEl.style.display = 'block'; }
    return;
  }

  try {
    // Validate connection via proxy
    const res = await fetch(LAMBDA_URL + '/redcap-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ api_url: url, api_token: token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Connection test failed');

    await database.ref(`workspaces/${currentWorkspace}/redcap_config`).set({
      api_url: url, api_token_hash: data.token_hash, // store hash not plaintext
      id_field: idFld, score_field: scoreFld, phenotype_field: phenoFld,
      // MAP subscale field mappings
      rc_field_map_arch:   document.getElementById('rc-field-map-arch')?.value.trim()   || '',
      rc_field_map_exec:   document.getElementById('rc-field-map-exec')?.value.trim()   || '',
      rc_field_map_ctx:    document.getElementById('rc-field-map-ctx')?.value.trim()    || '',
      // PEACS domain field mappings
      rc_field_peacs_base:  document.getElementById('rc-field-peacs-base')?.value.trim()  || '',
      rc_field_peacs_mvmt:  document.getElementById('rc-field-peacs-mvmt')?.value.trim()  || '',
      rc_field_peacs_strata:document.getElementById('rc-field-peacs-strata')?.value.trim()|| '',
      // Auto-sync toggle
      rc_auto_sync: !!(document.getElementById('rc-auto-sync')?.checked),
      connected_at: Date.now(), connected_by: _currentUid
    });

    // Note: actual token is stored server-side in SSM, only hash stored in Firebase
    _redcapConfig = {
      api_url: url, id_field: idFld, score_field: scoreFld, phenotype_field: phenoFld,
      rc_field_map_arch:    document.getElementById('rc-field-map-arch')?.value.trim()    || '',
      rc_field_map_exec:    document.getElementById('rc-field-map-exec')?.value.trim()    || '',
      rc_field_map_ctx:     document.getElementById('rc-field-map-ctx')?.value.trim()     || '',
      rc_field_peacs_base:  document.getElementById('rc-field-peacs-base')?.value.trim()  || '',
      rc_field_peacs_mvmt:  document.getElementById('rc-field-peacs-mvmt')?.value.trim()  || '',
      rc_field_peacs_strata:document.getElementById('rc-field-peacs-strata')?.value.trim()|| '',
      rc_auto_sync: !!(document.getElementById('rc-auto-sync')?.checked),
    };
    const panel = document.getElementById('redcap-config-panel');
    if (panel) _renderREDCapConnected(panel);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_CONNECTED', { api_url: url });

  } catch(e) {
    if (errEl) { errEl.textContent = 'Connection failed: ' + e.message; errEl.style.display = 'block'; }
  }
}

/**
 * Builds a REDCap record object from an ATLAS assessment record, using
 * the field name mappings stored in the workspace config.
 * @param {Object} record - ATLAS assessment record
 * @param {Object} cfg    - REDCap config object (from _redcapConfig)
 * @returns {Object} REDCap-ready record keyed by REDCap variable names
 */
function _buildREDCapRecord(record, cfg) {
  if (!record || !cfg) return {};
  const idField = cfg.id_field || 'record_id';
  const redcapRecord = {
    [idField]: record.patient_number || record.user_id || ''
  };

  // Core MMAS-8 score
  if (cfg.score_field && record.score !== undefined) {
    redcapRecord[cfg.score_field] = record.score;
  }
  // MAP phenotype
  if (cfg.phenotype_field && record.map_phenotype) {
    redcapRecord[cfg.phenotype_field] = record.map_phenotype;
  }

  // MAP subscales — Extension 4
  if (cfg.rc_field_map_arch && (record.map_architecture != null || record.arch_score != null)) {
    redcapRecord[cfg.rc_field_map_arch] = parseFloat(record.map_architecture ?? record.arch_score ?? '').toFixed(4);
  }
  if (cfg.rc_field_map_exec && (record.map_execution != null || record.exec_score != null)) {
    redcapRecord[cfg.rc_field_map_exec] = parseFloat(record.map_execution ?? record.exec_score ?? '').toFixed(4);
  }
  if (cfg.rc_field_map_ctx && (record.map_context != null || record.ctx_score != null)) {
    redcapRecord[cfg.rc_field_map_ctx] = parseFloat(record.map_context ?? record.ctx_score ?? '').toFixed(4);
  }

  // PEACS domains — Extension 4
  if (cfg.rc_field_peacs_base && (record.base_score != null || record.peacs_base != null)) {
    redcapRecord[cfg.rc_field_peacs_base] = parseFloat(record.base_score ?? record.peacs_base ?? '').toFixed(4);
  }
  if (cfg.rc_field_peacs_mvmt && (record.mvmt_score != null || record.peacs_mvmt != null)) {
    redcapRecord[cfg.rc_field_peacs_mvmt] = parseFloat(record.mvmt_score ?? record.peacs_mvmt ?? '').toFixed(4);
  }
  if (cfg.rc_field_peacs_strata && (record.strata_score != null || record.peacs_strata != null)) {
    redcapRecord[cfg.rc_field_peacs_strata] = parseFloat(record.strata_score ?? record.peacs_strata ?? '').toFixed(4);
  }

  return redcapRecord;
}

async function syncATLAStoREDCap() {
  if (_redcapSyncing) return;
  _redcapSyncing = true;
  const status = document.getElementById('redcap-sync-status');
  const log = document.getElementById('redcap-sync-log');
  if (status) status.textContent = 'Syncing ATLAS → REDCap…';

  try {
    const snap = await database.ref('assessments').once('value');
    const allRecords = snap.val() ? Object.values(snap.val()) : [];
    // Filter to only this workspace's records by institution_code
    const rawItems = allRecords.filter(r =>
      (r.institution_code || '').toUpperCase() === (currentWorkspace || '').toUpperCase()
    );
    if (status) status.textContent = `Pushing ${rawItems.length} records to REDCap…`;

    // Build field-mapped REDCap records using the saved config
    const cfg = _redcapConfig || {};
    const items = rawItems.map(r => _buildREDCapRecord(r, cfg));

    const res = await fetch(LAMBDA_URL + '/redcap-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace, records: items })
    });
    const data = await res.json();

    if (status) status.textContent = `✓ Pushed ${data.count || items.length} records. Errors: ${data.errors || 0}`;
    if (log) log.innerHTML = (data.log || []).map(l => `<div>${_esc(String(l))}</div>`).join('');
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_PUSH', { count: data.count, errors: data.errors });

  } catch(e) {
    if (status) status.textContent = 'Sync failed: ' + e.message;
  } finally {
    _redcapSyncing = false;
  }
}

/**
 * Toggles the rc_auto_sync flag in the saved Firebase config.
 * Called by the checkbox in _renderREDCapConnected.
 * @param {boolean} enabled
 */
async function toggleREDCapAutoSync(enabled) {
  if (!currentWorkspace) return;
  try {
    await database.ref(`workspaces/${currentWorkspace}/redcap_config/rc_auto_sync`).set(!!enabled);
    if (_redcapConfig) _redcapConfig.rc_auto_sync = !!enabled;
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_AUTO_SYNC_TOGGLED', { enabled });
  } catch(e) {
    console.warn('[REDCap] toggleREDCapAutoSync failed:', e.message);
  }
}

/**
 * Auto-sync hook: pushes a single newly submitted assessment record to REDCap.
 * Called from the assessment submit path when rc_auto_sync is enabled.
 * Non-blocking — errors are swallowed silently.
 * @param {Object} record - ATLAS assessment record (just submitted)
 */
async function redcapAutoSyncRecord(record) {
  // Load fresh config if not cached
  if (!_redcapConfig) {
    try {
      const snap = await database.ref(`workspaces/${currentWorkspace}/redcap_config`).once('value');
      _redcapConfig = snap.val();
    } catch(e) { return; }
  }
  const cfg = _redcapConfig;
  if (!cfg || !cfg.api_url || !cfg.rc_auto_sync) return; // not configured or disabled

  try {
    const redcapRecord = _buildREDCapRecord(record, cfg);
    const res = await fetch(LAMBDA_URL + '/redcap-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace, records: [redcapRecord] })
    });
    if (res.ok) {
      if (typeof showToast === 'function') showToast('Synced to REDCap ✓', 3000);
      if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_AUTO_SYNC', { patient: record.patient_number });
    }
  } catch(e) {
    // Silently skip — auto-sync must never interrupt the user's submission flow
    console.warn('[REDCap] autoSync failed:', e.message);
  }
}

async function syncREDCapToATLAS() {
  if (_redcapSyncing) return;
  _redcapSyncing = true;
  const status = document.getElementById('redcap-sync-status');
  if (status) status.textContent = 'Pulling from REDCap…';

  try {
    const res = await fetch(LAMBDA_URL + '/redcap-pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace })
    });
    const data = await res.json();

    if (status) status.textContent = `✓ Pulled ${data.count || 0} records from REDCap.`;
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_PULL', { count: data.count });

  } catch(e) {
    if (status) status.textContent = 'Pull failed: ' + e.message;
  } finally {
    _redcapSyncing = false;
  }
}

function disconnectREDCap() {
  if (!confirm('Disconnect REDCap integration? Existing synced data will remain.')) return;
  database.ref(`workspaces/${currentWorkspace}/redcap_config`).remove();
  _redcapConfig = null;
  const panel = document.getElementById('redcap-config-panel');
  if (panel) _renderREDCapSetup(panel);
  if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_DISCONNECTED', {});
}
