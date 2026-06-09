// ══════════════════════════════════════════════════════════════════════════════
// REDCap Bridge — Bidirectional sync between ATLAS and REDCap projects
// BP-INT-02: Enables PIs to eliminate double-entry between ATLAS and REDCap
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

/** @type {Object|null} Current REDCap connection config for this workspace */
let _redcapConfig = null;
/** @type {boolean} Whether a sync is currently in progress */
let _redcapSyncing = false;

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

  if (_redcapConfig && _redcapConfig.api_url && _redcapConfig.api_token) {
    _renderREDCapConnected(panel);
  } else {
    _renderREDCapSetup(panel);
  }
}

function _renderREDCapSetup(panel) {
  panel.innerHTML = `
    <div style="background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.15);border-radius:12px;padding:24px;max-width:520px;">
      <div style="font-size:0.84rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:20px;">
        Connect your REDCap project to sync MAP/MMAS-8 scores bidirectionally. Requires a REDCap API token with Export and Import privileges.
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">REDCap API URL</label>
          <input id="rc-api-url" type="url" placeholder="https://redcap.yourinstitution.edu/api/"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">REDCap API Token</label>
          <input id="rc-api-token" type="password" placeholder="32-character alphanumeric token"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">Patient ID Field (REDCap variable name)</label>
          <input id="rc-id-field" type="text" placeholder="record_id"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">MMAS-8 Score Field (REDCap variable name)</label>
          <input id="rc-score-field" type="text" placeholder="mmas8_score"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:5px;">MAP Phenotype Field (REDCap variable name)</label>
          <input id="rc-phenotype-field" type="text" placeholder="map_phenotype"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(78,156,245,0.2);border-radius:6px;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--bright,#e8f0f8);outline:none;"/>
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
  panel.innerHTML = `
    <div style="background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.2);border-radius:10px;padding:16px 20px;max-width:520px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
      <span style="font-size:1.2rem;">✓</span>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(46,201,138,0.8);margin-bottom:3px;">Connected</div>
        <div style="font-size:0.82rem;color:var(--text,#c8d6e8);">${_redcapConfig.api_url || 'REDCap'}</div>
      </div>
      <button onclick="disconnectREDCap()" style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.7);padding:5px 10px;border-radius:5px;cursor:pointer;">Disconnect</button>
    </div>
    <div style="display:flex;gap:10px;max-width:520px;flex-wrap:wrap;">
      <button onclick="syncATLAStoREDCap()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:10px 18px;border-radius:7px;cursor:pointer;transition:all 0.2s;">ATLAS → REDCap Push</button>
      <button onclick="syncREDCapToATLAS()" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:10px 18px;border-radius:7px;cursor:pointer;transition:all 0.2s;">REDCap → ATLAS Pull</button>
    </div>
    <div id="redcap-sync-status" style="font-size:0.80rem;color:var(--muted,#6b8099);margin-top:12px;"></div>
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
      connected_at: Date.now(), connected_by: _currentUid
    });

    // Note: actual token is stored server-side in SSM, only hash stored in Firebase
    _redcapConfig = { api_url: url, id_field: idFld, score_field: scoreFld, phenotype_field: phenoFld };
    const panel = document.getElementById('redcap-config-panel');
    if (panel) _renderREDCapConnected(panel);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_CONNECTED', { api_url: url });

  } catch(e) {
    if (errEl) { errEl.textContent = 'Connection failed: ' + e.message; errEl.style.display = 'block'; }
  }
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
    const items = allRecords.filter(r =>
      (r.institution_code || '').toUpperCase() === (currentWorkspace || '').toUpperCase()
    );
    if (status) status.textContent = `Pushing ${items.length} records to REDCap…`;

    const res = await fetch(LAMBDA_URL + '/redcap-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await _accGetToken() },
      body: JSON.stringify({ workspace: currentWorkspace, records: items })
    });
    const data = await res.json();

    if (status) status.textContent = `✓ Pushed ${data.count || items.length} records. Errors: ${data.errors || 0}`;
    if (log) log.innerHTML = (data.log || []).map(l => `<div>${l}</div>`).join('');
    if (typeof atlasAuditLog === 'function') atlasAuditLog('REDCAP_PUSH', { count: data.count, errors: data.errors });

  } catch(e) {
    if (status) status.textContent = 'Sync failed: ' + e.message;
  } finally {
    _redcapSyncing = false;
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
