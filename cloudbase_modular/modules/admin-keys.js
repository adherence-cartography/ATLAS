// ── KEY EDIT ─────────────────────────────────────────────────────────────────
/** @type {string|null} The workspace key currently being edited in the key-edit modal. */
let _kmEditKey = null;

/**
 * Opens the key-edit modal and pre-fills all fields from the cached key data.
 * @param {string} key - The workspace key to edit (e.g. `'INST-SIMAT-2026'`)
 * @returns {void}
 */
function accOpenEditKey(key) {
  _kmEditKey = key;
  const modal = document.getElementById('km-edit-modal');
  if (!modal) return;
  // Move modal to body so it escapes any stacking context created by the Control panel
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  // Pre-fill from loaded key data
  const k = (_kmAllKeys || []).find(k => k.key === key) || {};
  document.getElementById('km-edit-key-display').textContent = key;
  document.getElementById('km-edit-name').value        = k.name        || '';
  document.getElementById('km-edit-email').value       = k.email       || '';
  document.getElementById('km-edit-institution').value = k.institution  || '';
  document.getElementById('km-edit-parent').value      = k.parent_institution || '';
  document.getElementById('km-edit-parent-pi').value   = k.parent_pi          || '';
  document.getElementById('km-edit-study').value       = k.study_title  || '';
  const editDims = k.peacs_dims || ['base','mvmt','strata'];
  ['base','mvmt','strata'].forEach(d => {
    const cb = document.getElementById('km-edit-dim-'+d);
    if (cb) cb.checked = editDims.includes(d);
  });
  // Role selector — pre-fill with current role, show warning if changed
  const roleEl = document.getElementById('km-edit-role');
  if (roleEl) {
    const currentRole = k.role || 'student';
    roleEl.value = currentRole;
    // Store original role on the element to detect changes
    roleEl.dataset.originalRole = currentRole;
    document.getElementById('km-edit-role-warning').style.display = 'none';
  }
  const isPiKey = (k.role === 'pi');
  const piSection = document.getElementById('km-edit-pi-section');
  if (piSection) piSection.style.display = isPiKey ? 'block' : 'none';
  const canEditCb = document.getElementById('km-edit-can-edit-children');
  if (canEditCb) canEditCb.checked = isPiKey ? (k.can_edit_children === true) : false;
  document.getElementById('km-edit-status').textContent = '';

  // ── Module Overrides section ──────────────────────────────────────────────
  const _moWrap = document.getElementById('km-edit-modules-wrap');
  if (_moWrap && typeof _ATLAS_FEATURE_CATALOG !== 'undefined') {
    const _grants  = Array.isArray(k.module_grants)  ? [...k.module_grants]  : [];
    const _revokes = Array.isArray(k.module_revokes) ? [...k.module_revokes] : [];
    const _overrideCount = _grants.length + _revokes.length;
    const _catLabels = { assessment:'Assessment', analytics:'Analytics', clinical:'Clinical', research:'Research', compliance:'Compliance', premium:'Premium' };
    _moWrap.innerHTML = `
      <div onclick="_kmModToggle()" style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;background:rgba(255,255,255,0.02);">
        <div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Module Overrides</span>
          <span id="km-mod-badge" style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;margin-left:8px;padding:1px 7px;border-radius:20px;${_overrideCount > 0 ? 'background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.3);color:var(--pe);' : 'background:transparent;border:1px solid var(--border2);color:var(--dim);'}">${_overrideCount > 0 ? _overrideCount + ' override' + (_overrideCount > 1 ? 's' : '') : 'none'}</span>
        </div>
        <span id="km-mod-chevron" style="font-size:0.70rem;color:var(--dim);">${_overrideCount > 0 ? '▲' : '▼'}</span>
      </div>
      <div id="km-mod-body" style="display:${_overrideCount > 0 ? 'block' : 'none'};border-top:1px solid var(--border2);padding:12px 14px;max-height:240px;overflow-y:auto;">
        <div style="font-size:0.72rem;color:var(--dim);margin-bottom:10px;line-height:1.5;">Grant adds a module beyond this role's default path. Revoke removes a default module from this workspace only. Changes take effect on the user's next login.</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:3px 0;padding-right:8px;">Module</th>
            <th style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(46,201,138,0.7);width:52px;">Grant</th>
            <th style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(239,68,68,0.7);width:52px;">Revoke</th>
          </tr></thead>
          <tbody>
            ${Object.entries(_ATLAS_FEATURE_CATALOG).map(([cat, mods]) => `
              <tr><td colspan="3" style="padding:6px 0 2px;font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);border-top:1px solid var(--border2);">${_catLabels[cat] || cat}</td></tr>
              ${mods.map(mod => `<tr>
                <td style="padding:3px 0;font-size:0.78rem;color:var(--text);">${mod.icon} ${mod.label}</td>
                <td style="text-align:center;"><input type="checkbox" class="km-mod-grant" data-modid="${mod.id}" ${_grants.includes(mod.id) ? 'checked' : ''} onchange="_kmModCheckExclusive(this,'grant')" style="accent-color:#2ec98a;width:14px;height:14px;cursor:pointer;"/></td>
                <td style="text-align:center;"><input type="checkbox" class="km-mod-revoke" data-modid="${mod.id}" ${_revokes.includes(mod.id) ? 'checked' : ''} onchange="_kmModCheckExclusive(this,'revoke')" style="accent-color:#ef4444;width:14px;height:14px;cursor:pointer;"/></td>
              </tr>`).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } else if (_moWrap) {
    _moWrap.innerHTML = '';
  }

  modal.style.display = 'flex';
  document.getElementById('km-edit-name').focus();
}

/**
 * Shows/hides the role-change warning and PI section when the role dropdown changes.
 * @param {string} newVal - New role value selected in `#km-edit-role`
 * @returns {void}
 */
function _kmModToggle() {
  const body    = document.getElementById('km-mod-body');
  const chevron = document.getElementById('km-mod-chevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.textContent = open ? '▼' : '▲';
}

function _kmModCheckExclusive(el, type) {
  // Grant and Revoke are mutually exclusive for the same module
  const modId    = el.dataset.modid;
  const opposite = type === 'grant' ? 'km-mod-revoke' : 'km-mod-grant';
  if (el.checked) {
    const otherEl = document.querySelector('.' + opposite + '[data-modid="' + modId + '"]');
    if (otherEl) otherEl.checked = false;
  }
}

function kmEditRoleChanged(newVal) {
  const el = document.getElementById('km-edit-role');
  const warn = document.getElementById('km-edit-role-warning');
  const piSection = document.getElementById('km-edit-pi-section');
  if (warn) warn.style.display = (el && newVal !== el.dataset.originalRole) ? 'block' : 'none';
  if (piSection) piSection.style.display = newVal === 'pi' ? 'block' : 'none';
}

/**
 * Closes the key-edit modal and clears the pending edit key.
 * @returns {void}
 */
function accCloseEditKey() {
  const modal = document.getElementById('km-edit-modal');
  if (modal) modal.style.display = 'none';
  _kmEditKey = null;
}

/**
 * Saves edits for the currently open key to the Firebase `workspaces/` node.
 * Also triggers a Firebase Custom Claims update via Lambda when the role is changed.
 * @returns {Promise<void>}
 */
async function accSaveEditKey() {
  const status = document.getElementById('km-edit-status');
  const key    = _kmEditKey;
  if (!key) return;
  const name             = document.getElementById('km-edit-name')?.value.trim();
  const email            = document.getElementById('km-edit-email')?.value.trim();
  const institution      = document.getElementById('km-edit-institution')?.value.trim();
  const parentInstitution= document.getElementById('km-edit-parent')?.value.trim().toUpperCase() || null;
  const parentPi         = document.getElementById('km-edit-parent-pi')?.value.trim().toUpperCase() || null;
  const studyTitle       = document.getElementById('km-edit-study')?.value.trim() || null;
  const editPeacsDims    = ['base','mvmt','strata'].filter(d => document.getElementById('km-edit-dim-'+d)?.checked);
  const safePeacsDims    = editPeacsDims.length > 0 ? editPeacsDims : ['base','mvmt','strata'];
  const canEditChildren  = document.getElementById('km-edit-can-edit-children')?.checked || false;
  const newRole          = document.getElementById('km-edit-role')?.value || null;
  const originalRole     = document.getElementById('km-edit-role')?.dataset.originalRole || null;
  const roleChanged      = newRole && newRole !== originalRole;

  if (!name || !institution) {
    status.style.color = 'var(--poor)';
    status.textContent = 'Name and institution are required.';
    return;
  }
  status.style.color = 'var(--muted)';
  status.textContent = roleChanged ? `Upgrading role ${originalRole} → ${newRole}…` : 'Saving…';
  // Helper: apply changes to local cache + re-render table
  const _applyLocalUpdate = (roleChanged, newRoleVal) => {
    const idx = (_kmAllKeys || []).findIndex(k => k.key === key);
    if (idx !== -1) {
      _kmAllKeys[idx] = { ..._kmAllKeys[idx], name, email, institution,
        parent_institution: parentInstitution || null,
        parent_pi:          parentPi          || null,
        study_title:        studyTitle,
        peacs_dims:         safePeacsDims,
        can_edit_children:  canEditChildren,
        ...(roleChanged ? { role: newRoleVal } : {}) };
      accRenderKeys((_kmFiltered||[]).map(k => k.key === key ? _kmAllKeys[idx] : k));
    }
  };

  // Helper: write workspace metadata to Firebase (source of truth for dashboard grouping)
  const _writeFirebase = async () => {
    const wsRef = database.ref('workspaces/' + key);
    const snap  = await wsRef.once('value');
    const existing = snap.val() || {};
    // Resolve parent institution display name from loaded keys so child workspaces
    // (students/PIs) can show it in their banner without reading the institution's node.
    const _parentInstName = parentInstitution
      ? ((_kmAllKeys || []).find(k2 => k2.key === parentInstitution) || {}).institution || parentInstitution
      : null;
    const update = {
      ...existing,
      name,
      ...(email              ? { email }                                          : {}),
      ...(institution        ? { institution }                                    : {}),
      ...(parentInstitution  ? { parent_institution: parentInstitution }          : { parent_institution: null }),
      ...(_parentInstName    ? { parent_institution_name: _parentInstName }       : { parent_institution_name: null }),
      ...(parentPi           ? { parent_pi: parentPi }                           : { parent_pi: null }),
      ...(studyTitle         ? { study_title: studyTitle }                        : {}),
      peacs_dims: safePeacsDims,
    };
    if (newRole) update.role = newRole;
    // Module overrides — collect checked grants and revokes from the UI
    const _grantCbs  = document.querySelectorAll('.km-mod-grant:checked');
    const _revokeCbs = document.querySelectorAll('.km-mod-revoke:checked');
    const _modGrants  = Array.from(_grantCbs).map(cb => cb.dataset.modid).filter(Boolean);
    const _modRevokes = Array.from(_revokeCbs).map(cb => cb.dataset.modid).filter(Boolean);
    if (_modGrants.length  > 0) update.module_grants  = _modGrants;
    else delete update.module_grants;
    if (_modRevokes.length > 0) update.module_revokes = _modRevokes;
    else delete update.module_revokes;
    await wsRef.set(update);
  };

  try {
    const token = await _accGetToken();
    const res   = await fetch(LAMBDA_URL + '/admin/edit-key', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ key, name, email, institution,
        parent_institution: parentInstitution || null,
        parent_pi:          parentPi          || null,
        study_title:        studyTitle,
        peacs_dims:         safePeacsDims,
        can_edit_children:  canEditChildren,
        role:               newRole || undefined })
    });
    const data = await res.json();

    // Detect when Lambda route doesn't exist — API Gateway falls back to key-verify
    // handler which returns { valid, profile } instead of { updated }
    const lambdaRouteMissing = !data.updated && (data.valid !== undefined || data.profile);

    if (data.updated || lambdaRouteMissing) {
      // Lambda updated SSM, OR route is missing so we write to Firebase directly.
      // Firebase is the source of truth for dashboard workspace grouping.
      await _writeFirebase();
      status.style.color = 'var(--strata)';
      const didRoleChange = data.role_changed || (lambdaRouteMissing && roleChanged);
      status.textContent = lambdaRouteMissing
        ? '✓ Saved to Firebase (SSM update pending — add /admin/edit-key to Lambda)'
        : (data.role_changed ? `✓ Role upgraded: ${data.previous_role} → ${data.new_role}` : '✓ Saved');
      _applyLocalUpdate(didRoleChange, newRole);
      setTimeout(accCloseEditKey, didRoleChange ? 1400 : 800);
    } else {
      status.style.color = 'var(--poor)';
      const errMsg = data.error || data.message || data.errorMessage || JSON.stringify(data);
      status.textContent = 'Error: ' + (errMsg || 'Unknown error');
      console.error('[accSaveEditKey] Lambda response:', data);
    }
  } catch(e) {
    status.style.color = 'var(--poor)';
    status.textContent = 'Error: ' + e.message;
    console.error('[accSaveEditKey] fetch/parse error:', e);
  }
}

/**
 * Revokes the currently edited workspace key via Lambda `/admin/revoke-key`.
 * Requires superadmin token. Prompts for confirmation before proceeding.
 * @returns {Promise<void>}
 */
async function accRevokeKey() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const keyInput  = document.getElementById('km-revoke-key');
  const status    = document.getElementById('km-revoke-status');
  const key       = keyInput?.value.trim().toUpperCase();
  if (!key) { if (status) { status.style.color='var(--poor)'; status.textContent='Enter a key to revoke.'; } return; }
  if (!confirm(`Revoke key ${key}?\n\nThis will immediately prevent new logins. Any active session expires within 1 hour.`)) return;

  if (status) { status.style.color='var(--muted)'; status.textContent=_t.admin_revoking || 'Revoking…'; }
  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/revoke-key', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.revoked) {
      if (status) { status.style.color='var(--strata)'; status.textContent=`✓ ${key} revoked.`; }
      if (keyInput) keyInput.value = '';
      setTimeout(accLoadKeys, 800);
    } else {
      if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + (data.error || (_t.admin_key_not_found || 'Key not found')); }
    }
  } catch(e) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + e.message; }
  }
}

/**
 * Permanently deletes a workspace key from SSM via Lambda `/admin/delete-key`.
 * Requires superadmin token and double confirmation dialog.
 * @param {string} key - The workspace key to delete
 * @returns {Promise<void>}
 */
async function accDeleteKey(key) {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  if (!key) return;
  if (!confirm(`Permanently delete key ${key}?\n\nThis removes it from the registry entirely. It cannot be undone.`)) return;
  const status = document.getElementById('km-revoke-status');
  if (status) { status.style.color='var(--muted)'; status.textContent=_t.admin_deleting || 'Deleting…'; }
  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/delete-key', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.deleted) {
      if (status) { status.style.color='var(--strata)'; status.textContent=`✓ ${key} deleted.`; }
      setTimeout(accLoadKeys, 800);
    } else {
      if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + (data.error || (_t.admin_delete_failed || 'Delete failed')); }
    }
  } catch(e) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + e.message; }
  }
}

/** @type {Array<Object>} Full list of workspace keys loaded from Lambda, enriched with Firebase data. */
let _kmAllKeys = [];

/**
 * Loads all workspace keys from Lambda `/admin/list-keys`, merges Firebase `workspaces/`
 * node data and assessment counts, and renders the key management table.
 * @returns {Promise<void>}
 */
async function accLoadKeys() {
  const container = document.getElementById('km-keys-list');
  if (!container) return;
  container.innerHTML = '<span style="color:var(--muted);">Loading…</span>';
  try {
    const token = await _accGetToken();
    // Fetch keys + Firebase data in parallel
    const [keysRes, aSnap, pSnap, wsSnap] = await Promise.all([
      fetch(LAMBDA_URL + '/admin/list-keys', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      }).then(r => r.json()),
      database.ref('assessments').once('value').catch(() => null),
      database.ref('peacs_assessments').once('value').catch(() => null),
      database.ref('workspaces').once('value').catch(() => null),
    ]);
    if (!keysRes.keys || !keysRes.keys.length) {
      container.innerHTML = '<span style="color:var(--muted);">No keys found.</span>';
      return;
    }
    // Build Firebase workspaces map — source of truth for parent_institution / parent_pi
    // (written by the Firebase fallback in accSaveEditKey when Lambda /admin/edit-key is absent)
    const wsMap = {};
    if (wsSnap && wsSnap.val()) {
      Object.entries(wsSnap.val()).forEach(([k, v]) => { wsMap[k.toUpperCase()] = v; });
    }
    // Build lastSeen map from assessment timestamps
    const lastSeen = {}, mmasCounts = {}, peacsCounts = {};
    if (aSnap && aSnap.val()) {
      Object.values(aSnap.val()).forEach(r => {
        const code = (r.institution_code || '').toUpperCase();
        if (!code) return;
        mmasCounts[code] = (mmasCounts[code] || 0) + 1;
        if (r.timestamp) lastSeen[code] = Math.max(lastSeen[code] || 0, r.timestamp);
      });
    }
    if (pSnap && pSnap.val()) {
      Object.values(pSnap.val()).forEach(r => {
        const code = (r.institution_code || '').toUpperCase();
        if (!code) return;
        peacsCounts[code] = (peacsCounts[code] || 0) + 1;
        if (r.timestamp) lastSeen[code] = Math.max(lastSeen[code] || 0, r.timestamp);
      });
    }
    // Merge lastActive + assessment counts + Firebase workspace fields onto each key.
    // Firebase is authoritative for parent_institution and parent_pi since the Lambda
    // /admin/edit-key route writes those to Firebase (SSM not updated until route exists).
    // Firebase is authoritative for all fields written by accSaveEditKey() because
    // the Lambda /admin/edit-key route doesn't exist — SSM is never updated by edits.
    // Firebase values override SSM values for every editable field.
    _kmAllKeys = keysRes.keys.map(k => {
      const ws = wsMap[(k.key || '').toUpperCase()] || {};
      return {
        ...k,
        ...(ws.name               ? { name:               ws.name               } : {}),
        ...(ws.email              ? { email:              ws.email              } : {}),
        ...(ws.institution        ? { institution:        ws.institution        } : {}),
        ...(ws.cohortLabel        ? { cohortLabel:        ws.cohortLabel        } : {}),
        ...(ws.study_title        ? { study_title:        ws.study_title        } : {}),
        ...(ws.peacs_dims         ? { peacs_dims:         ws.peacs_dims         } : {}),
        ...(ws.role               ? { role:               ws.role               } : {}),
        parent_institution: ws.parent_institution ?? k.parent_institution ?? null,
        parent_pi:          ws.parent_pi          ?? k.parent_pi          ?? null,
        _lastActive:  lastSeen[(k.key || '').toUpperCase()] || 0,
        _mmasCount:   mmasCounts[(k.key || '').toUpperCase()] || 0,
        _peacsCount:  peacsCounts[(k.key || '').toUpperCase()] || 0,
      };
    });
    accRenderKeys(_kmAllKeys);
  } catch(e) {
    container.innerHTML = `<span style="color:var(--poor);">Error: ${e.message}</span>`;
  }
}

let _kmPage     = 0;
let _kmPageSize = 20;
let _kmFiltered = [];
let _kmSortKey  = 'created';   // 'created' | 'lastActive' | 'name' | 'role'
let _kmSortDir  = 'desc';      // 'asc' | 'desc'

function _kmApplySort(keys) {
  return [...keys].sort((a, b) => {
    let av, bv;
    if (_kmSortKey === 'lastActive') {
      av = a._lastActive || 0; bv = b._lastActive || 0;
    } else if (_kmSortKey === 'name') {
      av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase();
      return _kmSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    } else if (_kmSortKey === 'role') {
      av = (a.role || '').toLowerCase(); bv = (b.role || '').toLowerCase();
      return _kmSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    } else { // 'created'
      av = a.created_at ? new Date(a.created_at).getTime() : 0;
      bv = b.created_at ? new Date(b.created_at).getTime() : 0;
    }
    return _kmSortDir === 'asc' ? av - bv : bv - av;
  });
}

/**
 * Filters the key list by a search query (matches key, name, institution, or role).
 * Resets to page 0 and re-renders.
 * @param {string} query - Search string (empty to show all)
 * @returns {void}
 */
function accFilterKeys(query) {
  _kmPage = 0;
  if (!query) { _kmFiltered = _kmAllKeys; }
  else {
    const q = query.toLowerCase();
    _kmFiltered = _kmAllKeys.filter(k =>
      (k.key||'').toLowerCase().includes(q) ||
      (k.name||'').toLowerCase().includes(q) ||
      (k.institution||'').toLowerCase().includes(q) ||
      (k.role||'').toLowerCase().includes(q)
    );
  }
  accRenderKeys(_kmFiltered);
}

/**
 * Renders the paginated key management table into `#km-keys-list`.
 * @param {Array<Object>} keys - Array of key objects to display
 * @returns {void}
 */
function accRenderKeys(keys) {
  _kmFiltered = keys;
  const container = document.getElementById('km-keys-list');
  if (!container) return;
  const ROLE_COLORS = {
    superadmin: 'var(--pe)', institution: 'var(--mvmt)',
    researcher: 'var(--base)', pi: 'var(--base)',
    student: 'var(--strata)', observer: 'var(--muted)',
    independent: 'var(--dim)'
  };
  if (!keys.length) { container.innerHTML = '<span style="color:var(--muted);">No keys match.</span>'; return; }

  const sorted    = _kmApplySort(keys);
  const total     = sorted.length;
  const pageCount = Math.ceil(total / _kmPageSize);
  if (_kmPage >= pageCount) _kmPage = pageCount - 1;
  const start = _kmPage * _kmPageSize;
  const page  = sorted.slice(start, start + _kmPageSize);

  const pageBtn = (label, page, disabled, active) =>
    `<button onclick="_kmPage=${page};accRenderKeys(_kmFiltered)"
      style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.08em;
             padding:3px 9px;border-radius:3px;cursor:${disabled?'default':'pointer'};
             background:${active?'rgba(212,168,67,0.15)':'none'};
             border:1px solid ${active?'rgba(212,168,67,0.5)':'rgba(255,255,255,0.1)'};
             color:${disabled?'var(--dim)':active?'var(--pe)':'var(--muted)'};
             pointer-events:${disabled?'none':'auto'};"
      ${disabled?'disabled':''}>
      ${label}
    </button>`;

  const pageSizeBtn = (n) =>
    `<button onclick="_kmPageSize=${n};_kmPage=0;accRenderKeys(_kmFiltered)"
      style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.08em;
             padding:3px 9px;border-radius:3px;cursor:pointer;
             background:${_kmPageSize===n?'rgba(212,168,67,0.15)':'none'};
             border:1px solid ${_kmPageSize===n?'rgba(212,168,67,0.5)':'rgba(255,255,255,0.1)'};
             color:${_kmPageSize===n?'var(--pe)':'var(--muted)'};">
      ${n}
    </button>`;

  // Build page number buttons (show up to 7, with ellipsis)
  let pageNums = '';
  if (pageCount <= 7) {
    for (let i = 0; i < pageCount; i++)
      pageNums += pageBtn(i+1, i, false, i===_kmPage);
  } else {
    const show = new Set([0, pageCount-1, _kmPage, _kmPage-1, _kmPage+1].filter(i => i>=0 && i<pageCount));
    let prev = -1;
    [...show].sort((a,b)=>a-b).forEach(i => {
      if (prev !== -1 && i > prev+1) pageNums += `<span style="color:var(--dim);padding:0 4px;">…</span>`;
      pageNums += pageBtn(i+1, i, false, i===_kmPage);
      prev = i;
    });
  }

  container.innerHTML = `
    <table class="acc-table" style="font-size:0.78rem;">
      <thead><tr>
        <th>Key</th><th>Name</th><th>Institution</th><th>Role</th><th>Status</th>
        <th style="cursor:pointer;user-select:none;white-space:nowrap;" onclick="_kmSortDir=(_kmSortKey==='created'&&_kmSortDir==='desc')?'asc':'desc';_kmSortKey='created';accRenderKeys(_kmFiltered);">
          Created ${_kmSortKey==='created'?(_kmSortDir==='desc'?'↓':'↑'):'↕'}
        </th>
        <th style="cursor:pointer;user-select:none;white-space:nowrap;" onclick="_kmSortDir=(_kmSortKey==='lastActive'&&_kmSortDir==='desc')?'asc':'desc';_kmSortKey='lastActive';accRenderKeys(_kmFiltered);">
          Last Active ${_kmSortKey==='lastActive'?(_kmSortDir==='desc'?'↓':'↑'):'↕'}
        </th>
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${page.map(k => {
          const col    = ROLE_COLORS[k.role] || 'var(--muted)';
          const active = k.active !== false;
          const created = k.created_at ? new Date(k.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
          const lastActiveStr = k._lastActive ? new Date(k._lastActive).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Never';
          const lastActiveColor = k._lastActive ? 'var(--dim)' : 'rgba(255,255,255,0.18)';
          const assessmentTip = (k._mmasCount||k._peacsCount) ? `MMAS: ${k._mmasCount||0}  PEACS: ${k._peacsCount||0}` : '';
          return `<tr>
            <td style="color:${col};letter-spacing:0.1em;">${_esc(k.key) || '—'}</td>
            <td style="color:var(--text);">${_esc(k.name) || '—'}</td>
            <td style="color:var(--muted);max-width:160px;" title="${_esc(k.institution||'')}${k.parent_institution ? ' · inst: ' + _esc(k.parent_institution) : ''}${k.parent_pi ? ' · pi: ' + _esc(k.parent_pi) : ''}">
              <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(k.institution) || '—'}</div>
              ${k.parent_institution ? `<div style="font-size:0.68rem;color:rgba(212,168,67,0.55);letter-spacing:0.06em;margin-top:1px;">↑ ${_esc(k.parent_institution)}</div>` : ''}
              ${k.parent_pi ? `<div style="font-size:0.68rem;color:rgba(78,156,245,0.55);letter-spacing:0.06em;margin-top:1px;">↑ PI: ${_esc(k.parent_pi)}</div>` : ''}
            </td>
            <td><span style="color:${col};border:1px solid ${col}44;padding:1px 6px;border-radius:3px;font-size:0.72rem;letter-spacing:0.1em;">${(k.role||'—').toUpperCase()}</span></td>
            <td><span style="color:${active?'var(--strata)':'var(--poor)'}">${active?'Active':'Revoked'}</span></td>
            <td style="color:var(--dim);">${created}</td>
            <td style="color:${lastActiveColor};" title="${assessmentTip}">${lastActiveStr}${assessmentTip ? `<div style="font-size:0.65rem;color:rgba(78,156,245,0.5);margin-top:1px;letter-spacing:0.04em;">${k._mmasCount ? k._mmasCount+' MMAS' : ''}${k._mmasCount&&k._peacsCount?' · ':''}${k._peacsCount ? k._peacsCount+' PEACS' : ''}</div>` : ''}</td>
            <td style="white-space:nowrap;">
              <span data-key="${_esc(k.key)}" onclick="accOpenEditKey(this.dataset.key)" style="color:var(--base);cursor:pointer;opacity:0.7;margin-right:8px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Edit key profile">Edit</span>${active ? `<span data-key="${_esc(k.key)}" onclick="document.getElementById('km-revoke-key').value=this.dataset.key;accRevokeKey()" style="color:var(--poor);cursor:pointer;opacity:0.7;margin-right:8px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Revoke key (keeps record, disables login)">Revoke</span>` : ''}<span data-key="${_esc(k.key)}" onclick="accDeleteKey(this.dataset.key)" style="color:rgba(239,68,68,0.55);cursor:pointer;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Permanently delete key from registry">Delete</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:6px;">
        ${pageBtn('←', _kmPage-1, _kmPage===0, false)}
        ${pageNums}
        ${pageBtn('→', _kmPage+1, _kmPage>=pageCount-1, false)}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);letter-spacing:0.08em;text-transform:uppercase;">Per page</span>
        ${[10,20,50,100].map(pageSizeBtn).join('')}
      </div>
      <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">
        ${start+1}–${Math.min(start+_kmPageSize,total)} of ${total}
      </div>
    </div>
  `;
}

// ── Changelog selector ────────────────────────────────────────────────────────
const _clVersions = ['892','891','89','88','87','86','85','84','83','82','81','80'];
const _clBorderColors = { '892':'rgba(212,168,67,0.7)', '891':'rgba(212,168,67,0.7)', '89':'rgba(212,168,67,0.7)', '88':'rgba(212,168,67,0.7)', '87':'rgba(212,168,67,0.7)', '86':'rgba(139,111,245,0.7)', '85':'rgba(78,156,245,0.7)', '84':'rgba(46,201,138,0.7)', '83':'rgba(46,201,138,0.5)', '82':'rgba(78,156,245,0.5)', '81':'rgba(139,111,245,0.5)', '80':'rgba(212,168,67,0.5)' };

function _clSelect(v) {
  _clVersions.forEach(id => {
    const pane = document.getElementById('cl-pane-' + id);
    const btn  = document.getElementById('cl-btn-' + id);
    if (pane) pane.style.display = id === v ? '' : 'none';
    if (btn)  { btn.classList.toggle('cl-pill-active', id === v); }
  });
  const detail = document.getElementById('cl-detail');
  if (detail) detail.style.borderLeftColor = _clBorderColors[v] || 'var(--border2)';
}

// ── Institution Hierarchy View ────────────────────────────────────────────────
let _kmGroupView = false;

function _kmToggleGroupView() {
  _kmGroupView = !_kmGroupView;
  const btn = document.getElementById('km-group-toggle');
  const search = document.getElementById('km-search');
  if (btn) {
    btn.style.background   = _kmGroupView ? 'rgba(212,168,67,0.12)' : '';
    btn.style.borderColor  = _kmGroupView ? 'rgba(212,168,67,0.4)' : '';
    btn.style.color        = _kmGroupView ? 'var(--pe)' : '';
  }
  if (search) search.style.display = _kmGroupView ? 'none' : '';
  if (_kmGroupView) {
    accRenderKeysGrouped(_kmAllKeys);
  } else {
    accRenderKeys(_kmFiltered.length ? _kmFiltered : _kmAllKeys);
  }
}

// Pre-fill the issue-key form and scroll to it
function _kmPrefillForm({ role, institution, parent_institution, parent_pi }) {
  const roleEl = document.getElementById('km-role');
  if (roleEl) { roleEl.value = role || 'pi'; accRoleChanged(role || 'pi'); }
  const instEl = document.getElementById('km-institution');
  if (instEl && institution) instEl.value = institution;
  const piEl = document.getElementById('km-parent-institution');
  if (piEl) piEl.value = parent_institution || '';
  const ppiEl = document.getElementById('km-parent-pi');
  if (ppiEl) ppiEl.value = parent_pi || '';
  // Clear name/email so form is ready for new entry
  const nameEl = document.getElementById('km-name');
  const emailEl = document.getElementById('km-email');
  if (nameEl) nameEl.value = '';
  if (emailEl) emailEl.value = '';
  // Scroll to issue form
  document.getElementById('accsec-keys')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => nameEl?.focus(), 450);
}

function accRenderKeysGrouped(keys) {
  const container = document.getElementById('km-keys-list');
  if (!container) return;

  const active = keys.filter(k => k.active !== false);

  // Index by key
  const byKey = {};
  active.forEach(k => { byKey[(k.key||'').toUpperCase()] = k; });

  // Institutions
  const institutions = active.filter(k => k.role === 'institution');
  // PIs — grouped by parent_institution
  const pisByInst = {};
  active.filter(k => k.role === 'pi').forEach(k => {
    const inst = (k.parent_institution || '—').toUpperCase();
    if (!pisByInst[inst]) pisByInst[inst] = [];
    pisByInst[inst].push(k);
  });
  // Members — grouped by parent_pi
  const membersByPi = {};
  active.filter(k => !['institution','pi'].includes(k.role)).forEach(k => {
    const pi = (k.parent_pi || '—').toUpperCase();
    if (!membersByPi[pi]) membersByPi[pi] = [];
    membersByPi[pi].push(k);
  });

  const ROLE_COLORS = { researcher:'rgba(78,156,245,0.8)', clinician:'rgba(16,185,129,0.8)', student:'rgba(46,201,138,0.8)', observer:'rgba(255,255,255,0.35)', independent:'rgba(255,255,255,0.3)' };

  function actionBtn(label, color, onclick) {
    return `<button onclick="${onclick}" style="padding:3px 10px;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:${color}14;border:1px solid ${color}40;color:${color};border-radius:4px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" onmouseover="this.style.background='${color}28'" onmouseout="this.style.background='${color}14'">${label}</button>`;
  }

  function memberRow(m, indent) {
    const col = ROLE_COLORS[m.role] || 'rgba(255,255,255,0.4)';
    const safeKey = (m.key||'').replace(/'/g,"\\'");
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 14px 7px ${indent}px;border-bottom:1px solid var(--border2);flex-wrap:wrap;">
      <span style="color:var(--border2);font-size:0.70rem;flex-shrink:0;">└─</span>
      <span style="font-size:0.84rem;color:var(--text);min-width:120px;">${m.name||'—'}</span>
      <span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;color:${col};border:1px solid ${col}44;padding:1px 6px;border-radius:3px;">${m.role.toUpperCase()}</span>
      <span style="font-size:0.72rem;color:var(--muted);flex:1;">${m.email||''}</span>
      <span style="font-family:var(--font-mono);font-size:0.60rem;color:rgba(212,168,67,0.45);letter-spacing:0.06em;">${m.key}</span>
      <span onclick="accOpenEditKey('${safeKey}')" style="font-family:var(--font-mono);font-size:0.62rem;color:var(--base);cursor:pointer;opacity:0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">Edit</span>
    </div>`;
  }

  let html = '';

  // ── Institutions ──────────────────────────────────────────────────────────
  institutions.forEach(inst => {
    const instKey  = (inst.key||'').toUpperCase();
    const instName = inst.institution || inst.name || instKey;
    const pis      = pisByInst[instKey] || [];
    const safeInstKey  = instKey.replace(/'/g,"\\'");
    const safeInstName = instName.replace(/'/g,"\\'").replace(/"/g,'&quot;');

    html += `<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;">
      <!-- Institution root -->
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(139,111,245,0.05);border-bottom:1px solid var(--border);">
        <span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;background:rgba(139,111,245,0.1);border:1px solid rgba(139,111,245,0.25);color:rgba(139,111,245,0.8);border-radius:20px;padding:2px 9px;">Institution</span>
        <span style="flex:1;font-size:0.90rem;color:var(--bright);font-weight:500;">${instName}</span>
        <span style="font-family:var(--font-mono);font-size:0.62rem;color:rgba(212,168,67,0.55);letter-spacing:0.06em;">${inst.key}</span>
        ${actionBtn('+ Add PI', 'rgba(139,111,245,0.8)', `_kmPrefillForm({role:'pi',institution:'${safeInstName}',parent_institution:'${safeInstKey}'})`)}
        <span onclick="accOpenEditKey('${safeInstKey}')" style="font-family:var(--font-mono);font-size:0.62rem;color:var(--base);cursor:pointer;opacity:0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">Edit</span>
      </div>`;

    if (!pis.length) {
      html += `<div style="padding:10px 14px 10px 32px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">No PIs provisioned yet.</div>`;
    }

    pis.forEach(pi => {
      const piKey     = (pi.key||'').toUpperCase();
      const piName    = pi.name || piKey;
      const piMembers = membersByPi[piKey] || [];
      const safePiKey  = piKey.replace(/'/g,"\\'");
      const safePiName = piName.replace(/'/g,"\\'").replace(/"/g,'&quot;');

      html += `<div style="border-bottom:1px solid var(--border2);">
        <!-- PI row -->
        <div style="display:flex;align-items:center;gap:10px;padding:9px 14px 9px 28px;background:rgba(78,156,245,0.03);">
          <span style="color:var(--border2);font-size:0.70rem;flex-shrink:0;">└─</span>
          <span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(78,156,245,0.7);border:1px solid rgba(78,156,245,0.25);padding:1px 6px;border-radius:3px;">PI</span>
          <span style="flex:1;font-size:0.86rem;color:var(--bright);">${piName}</span>
          <span style="font-size:0.72rem;color:var(--muted);">${pi.email||''}</span>
          <span style="font-family:var(--font-mono);font-size:0.60rem;color:rgba(212,168,67,0.45);letter-spacing:0.06em;">${pi.key}</span>
          ${actionBtn('+ Clinician', 'rgba(16,185,129,0.8)', `_kmPrefillForm({role:'clinician',institution:'${safeInstName}',parent_institution:'${safeInstKey}',parent_pi:'${safePiKey}'})`)}
          ${actionBtn('+ Researcher', 'rgba(78,156,245,0.8)', `_kmPrefillForm({role:'researcher',institution:'${safeInstName}',parent_institution:'${safeInstKey}',parent_pi:'${safePiKey}'})`)}
          ${actionBtn('+ Student', 'rgba(46,201,138,0.8)', `_kmPrefillForm({role:'student',institution:'${safeInstName}',parent_institution:'${safeInstKey}',parent_pi:'${safePiKey}'})`)}
          <span onclick="accOpenEditKey('${safePiKey}')" style="font-family:var(--font-mono);font-size:0.62rem;color:var(--base);cursor:pointer;opacity:0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">Edit</span>
        </div>
        ${piMembers.map(m => memberRow(m, 44)).join('')}
      </div>`;
    });

    html += `</div>`;
  });

  // ── Standalone keys (no parent_institution, not institution role) ──────────
  const standalone = active.filter(k => !k.parent_institution && k.role !== 'institution' && k.role !== 'superadmin');
  if (standalone.length) {
    html += `<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;">
      <div style="padding:8px 14px;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Standalone / Independent</div>
      ${standalone.map(k => memberRow(k, 14)).join('')}
    </div>`;
  }

  if (!html) html = `<div style="padding:24px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">No institution keys found. Issue an institution key first.</div>`;

  container.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);margin-bottom:12px;">${institutions.length} institution${institutions.length!==1?'s':''} · ${active.filter(k=>k.role==='pi').length} PIs · ${active.filter(k=>!['institution','pi','superadmin'].includes(k.role)).length} members</div>` + html;
}

// ── LETTERS OF PERMISSION ────────────────────────────────────────────────────
/**
 * Issues a Letter of Permission (LOP) for MMAS-8 use by posting to Lambda `/admin/issue-lop`.
 * Reads form fields from the LOP section, validates required fields, and displays the result.
 * @returns {Promise<void>}
 */
async function accIssueLOP() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const name        = document.getElementById('lop-name')?.value.trim();
  const email       = document.getElementById('lop-email')?.value.trim();
  const institution = document.getElementById('lop-institution')?.value.trim();
  const study       = document.getElementById('lop-study')?.value.trim();
  const role        = document.getElementById('lop-role')?.value;
  const intended    = document.getElementById('lop-use')?.value;
  const expiry      = document.getElementById('lop-expiry')?.value || null;
  const wskey       = document.getElementById('lop-wskey')?.value.trim() || null;
  const notes       = document.getElementById('lop-notes')?.value.trim() || null;
  const tool        = document.querySelector('input[name="lop-tool"]:checked')?.value || 'MMAS-8';
  const status      = document.getElementById('lop-status');
  const result      = document.getElementById('lop-result');

  if (!name || !email || !institution || !study) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Name, email, institution and study title are required.'; }
    return;
  }
  if (status) { status.style.color='var(--muted)'; status.textContent=_t.admin_issuing || 'Issuing…'; }
  if (result) result.style.display = 'none';

  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/issue-lop', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name, email, institution, study_title: study, role,
        intended_use: intended, expiry, workspace_key: wskey, lmic_notes: notes, tool })
    });
    const data = await res.json();
    if (data.certNum) {
      if (status) { status.style.color='var(--strata)'; status.textContent='Letter issued successfully.'; }
      document.getElementById('lop-result-cert').textContent = data.certNum;
      document.getElementById('lop-result-detail').innerHTML =
        `${data.name} · ${data.institution}<br/>` +
        `Email sent: ${data.email_sent ? 'Yes' : 'No (check SES logs)'}<br/>` +
        `Verify: <a href="${data.verify_url}" target="_blank" style="color:var(--base);">${data.verify_url}</a>`;
      if (result) result.style.display = 'block';
      ['lop-name','lop-email','lop-institution','lop-study','lop-wskey','lop-notes','lop-expiry'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      setTimeout(accLoadLetters, 600);
    } else {
      if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + (data.error || 'Unknown error'); }
    }
  } catch(e) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Error: ' + e.message; }
  }
}

function _lopExpiryDate(l) {
  const raw = l.subscription_end || l.expiry || null;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function _lopTable(lops, isLmic) {
  if (!lops.length) return `<div style="color:var(--dim);font-size:0.76rem;padding:8px 0;">None on record.</div>`;
  const actionCol = isLmic
    ? `<th>Actions</th>`
    : `<th>Actions</th>`;
  return `<table class="acc-table" style="font-size:0.76rem;">
    <thead><tr>
      <th>Cert #</th><th>Name</th><th>Institution</th><th>Role</th><th>Issued</th><th>Valid Through</th><th>Status</th>${actionCol}
    </tr></thead>
    <tbody>
      ${lops.map(l => {
        const active     = l.status !== 'revoked';
        const issued     = l.issued_at ? new Date(l.issued_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
        const expires    = _lopExpiryDate(l);
        const certShort  = (l.certNum||'').slice(0,20) + '…';
        const certEsc    = (l.certNum||'').replace(/'/g,"\\'");
        const actionBtns = [
          `<span onclick="accReprintLOP('${certEsc}')" title="Download letter HTML" style="color:var(--base);cursor:pointer;opacity:0.75;margin-right:10px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">↓ Download</span>`,
          `<span onclick="accResendLOP('${certEsc}')" title="Resend letter to recipient" style="color:var(--mvmt);cursor:pointer;opacity:0.75;margin-right:10px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">✉ Resend</span>`,
          isLmic && active ? `<span onclick="accRevokeLOP('${certEsc}')" style="color:var(--poor);cursor:pointer;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">Revoke</span>` : '',
        ].join('');
        return `<tr>
          <td style="color:var(--pe);letter-spacing:0.06em;font-size:0.72rem;" title="${l.certNum||''}">${certShort}</td>
          <td style="color:var(--text);">${l.name||'—'}</td>
          <td style="color:var(--muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.institution||''}">${l.institution||'—'}</td>
          <td><span style="color:var(--base);border:1px solid rgba(78,156,245,0.3);padding:1px 6px;border-radius:3px;font-size:0.68rem;">${(l.role||'—').toUpperCase()}</span></td>
          <td style="color:var(--dim);">${issued}</td>
          <td style="color:var(--dim);">${expires}</td>
          <td><span style="color:${active?'var(--strata)':'var(--poor)'}">${active?'Active':'Revoked'}</span></td>
          <td style="white-space:nowrap;">${active ? actionBtns : '<span style="color:var(--dim);">—</span>'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

/**
 * Loads and renders issued Letters of Permission from Lambda `/admin/list-lops`.
 * @returns {Promise<void>}
 */
async function accLoadLetters() {
  const lmicEl = document.getElementById('lop-list-lmic');
  const stdEl  = document.getElementById('lop-list-standard');
  const lmicCount = document.getElementById('lop-lmic-count');
  const stdCount  = document.getElementById('lop-std-count');
  if (!lmicEl || !stdEl) return;
  lmicEl.innerHTML = stdEl.innerHTML = '<span style="color:var(--muted);">Loading…</span>';
  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/list-lops', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    });
    const data = await res.json();
    const all  = data.lops || [];
    const lmic = all.filter(l => l.key_type === 'admin_lop');
    const std  = all.filter(l => l.key_type !== 'admin_lop');
    if (lmicCount) lmicCount.textContent = `· ${lmic.length}`;
    if (stdCount)  stdCount.textContent  = `· ${std.length}`;
    lmicEl.innerHTML = _lopTable(lmic, true);
    stdEl.innerHTML  = _lopTable(std,  false);
  } catch(e) {
    lmicEl.innerHTML = stdEl.innerHTML = `<span style="color:var(--poor);">Error: ${e.message}</span>`;
  }
}

async function accReprintLOP(certNum) {
  if (!certNum) return;
  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/reprint-lop', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ certNum })
    });
    const data = await res.json();
    if (!data.letterB64) { showToast('Error: ' + (data.error || 'No letter returned'), 3500); return; }
    const html  = atob(data.letterB64);
    const blob  = new Blob([html], { type: 'text/html' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = data.filename || `ATLAS_Permission_Letter_${certNum}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    showToast('Letter downloaded.', 2000);
  } catch(e) { showToast('Download error: ' + e.message, 3500); }
}

async function accResendLOP(certNum) {
  if (!certNum) return;
  const override = prompt('Resend letter to the address on file?\n\nLeave blank to use the registered email, or enter a different address to override:', '');
  if (override === null) return; // cancelled
  try {
    const token = await _accGetToken();
    const body  = { certNum };
    if (override.trim()) body.override_email = override.trim();
    const res = await fetch(LAMBDA_URL + '/admin/resend-lop', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.resent) showToast(`Letter resent to ${data.to}.`, 3000);
    else showToast('Error: ' + (data.error || 'Unknown error'), 3500);
  } catch(e) { showToast('Resend error: ' + e.message, 3500); }
}

async function accRevokeLOP(certNum) {
  if (!certNum || !confirm(`Revoke letter ${certNum}?\n\nThe certificate will be marked Revoked in the public registry immediately. This cannot be undone.`)) return;
  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/revoke-lop', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ certNum })
    });
    const data = await res.json();
    if (data.revoked) { showToast('Letter revoked.', 2500); accLoadLetters(); }
    else showToast('Error: ' + (data.error || 'Unknown'), 3000);
  } catch(e) { showToast('Error: ' + e.message, 3000); }
}

/**
 * Loads summary statistics for the ACC Overview section from Firebase and Lambda.
 * Populates total assessments, country count, average score, active workspaces,
 * campaign count, PEACS count, and the recent activity feed.
 * @returns {void}
 */
function accLoadOverview() {
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  db.ref('assessments').once('value', snap => {
    const all = snap.val() ? Object.values(snap.val()) : [];
    const mmasOnly = all.filter(r => r.map_q1 === undefined); // exclude MAP records from MMAS-8 stats
    const valid = mmasOnly.filter(r=>r.score!==undefined&&r.score!==null);
    const total = valid.length;
    const countries = new Set(valid.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
    const avg = total ? (valid.reduce((s,r)=>s+(r.score||0),0)/total).toFixed(2) : '—';
    const el = id => document.getElementById(id);
    if(el('acc-ov-total')) el('acc-ov-total').textContent = total.toLocaleString();
    if(el('acc-ov-countries')) el('acc-ov-countries').textContent = countries;
    if(el('acc-ov-avg')) el('acc-ov-avg').textContent = avg;

    // Recent activity
    const recent = valid.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,8);
    const act = document.getElementById('acc-ov-activity');
    if (act) act.innerHTML = recent.map(r => {
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      const cat = typeof getAdherenceCategory==='function' ? getAdherenceCategory(r.score||0) : {color:'#4e9cf5'};
      return `<div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid ${tc('rgba(255,255,255,0.04)','rgba(0,0,0,0.06)')};">
        <div style="width:6px;height:6px;background:${cat.color};flex-shrink:0;"></div>
        <span style="color:${tc('rgba(255,255,255,0.55)','rgba(0,0,0,0.7)')};flex:1;">${_esc(r.country)||'Unknown'} · ${_esc(r.city)||'Unknown'}</span>
        <span style="color:${tc('rgba(255,255,255,0.35)','rgba(0,0,0,0.55)')};">${(r.score||0).toFixed(2)}</span>
        <span style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-size:0.88rem;">${ts}</span>
      </div>`;
    }).join('') || `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.35)')};padding:8px 0;">No recent activity.</div>`;
  });
  db.ref('peacs_assessments').once('value', snap => {
    const n = snap.val() ? Object.keys(snap.val()).length : 0;
    const el = document.getElementById('acc-ov-peacs'); if(el) el.textContent = n.toLocaleString();
  });
  // Active workspace count comes from SSM via Lambda, not the Firebase workspaces node.
  _accGetToken().then(token => {
    return fetch(`${LAMBDA_URL}/admin/list-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({}),
    });
  }).then(r => r.json()).then(data => {
    const keys = Array.isArray(data.keys) ? data.keys : [];
    const active = keys.filter(k => k.active !== false).length;
    const el = document.getElementById('acc-ov-workspaces');
    if (el) el.textContent = active;
  }).catch(() => {
    const el = document.getElementById('acc-ov-workspaces');
    if (el) el.textContent = '—';
  });
  db.ref('campaigns').once('value', snap => {
    const n = snap.val() ? Object.keys(snap.val()).length : 0;
    const el = document.getElementById('acc-ov-campaigns'); if(el) el.textContent = n;
  });
}

/**
 * Loads the workspace registry table from Firebase `workspaces/`, cross-referencing
 * assessment record counts. Renders into `#acc-ws-tbody`.
 * @returns {void}
 */
function accLoadWorkspaces() {
  const tb = document.getElementById('acc-ws-tbody');
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;">Loading…</td></tr>`;
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;

  // Load registered workspaces AND cross-reference with assessment record counts
  Promise.all([
    db.ref('workspaces').once('value'),
    db.ref('assessments').once('value')
  ]).then(([wsSnap, aSnap]) => {
    const registered = wsSnap.val() || {};
    const allAssessments = aSnap.val() ? Object.values(aSnap.val()) : [];

    // Count records per institution_code
    const recordCounts = {};
    allAssessments.forEach(r => {
      const code = (r.institution_code || '').toUpperCase();
      if (code) recordCounts[code] = (recordCounts[code] || 0) + 1;
    });

    // Merge record counts into registered workspace objects
    const entries = Object.entries(registered).map(([key, ws]) => {
      ws.record_count = recordCounts[key.toUpperCase()] || 0;
      return [key, ws];
    }).sort((a,b) => (b[1].record_count||0) - (a[1].record_count||0));

    if (!entries.length) {
      tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;">No workspaces registered yet.<br><span style="font-size:0.82rem;color:${tc('rgba(255,255,255,0.14)','rgba(0,0,0,0.28)')}">Use "Scan Assessment Data" above to discover existing keys, or use Bulk Import.</span></td></tr>`;
      return;
    }
    window._accWorkspaces = entries;
    _renderWorkspaceTable(entries);
  });
}

// ── Discover keys from assessment data ──────────────────────────────────────
window._accDiscoveredKeys = [];

function accDiscoverWorkspaces() {
  const st = document.getElementById('acc-ws-discover-status');
  const list = document.getElementById('acc-ws-discovered-list');
  const importBtn = document.getElementById('acc-ws-import-btn');
  if (st) { st.textContent = 'Scanning…'; st.style.color = 'rgba(255,255,255,0.4)'; }
  if (list) list.innerHTML = '';
  if (importBtn) importBtn.style.display = 'none';

  const db = (typeof database!=='undefined') ? database : null;
  if (!db) { if(st) st.textContent = 'Firebase unavailable.'; return; }

  Promise.all([
    db.ref('workspaces').once('value'),
    db.ref('assessments').once('value'),
    db.ref('peacs_assessments').once('value')
  ]).then(([wsSnap, aSnap, pSnap]) => {
    const registered = new Set(Object.keys(wsSnap.val() || {}).map(k => k.toUpperCase()));

    // Tally all institution_codes from both instruments
    const discovered = {}; // code → { mmas, peacs }
    (aSnap.val() ? Object.values(aSnap.val()) : []).forEach(r => {
      const code = (r.institution_code || '').trim().toUpperCase();
      if (!code || code === 'EXPLORER') return;
      if (!discovered[code]) discovered[code] = { mmas: 0, peacs: 0 };
      discovered[code].mmas++;
    });
    (pSnap.val() ? Object.values(pSnap.val()) : []).forEach(r => {
      const code = (r.institution_code || '').trim().toUpperCase();
      if (!code || code === 'EXPLORER') return;
      if (!discovered[code]) discovered[code] = { mmas: 0, peacs: 0 };
      discovered[code].peacs++;
    });

    // Split: already registered vs new
    const newKeys = Object.entries(discovered).filter(([k]) => !registered.has(k));
    const knownKeys = Object.entries(discovered).filter(([k]) => registered.has(k));

    const total = Object.keys(discovered).length;
    if (st) {
      st.textContent = `Found ${total} active key${total!==1?'s':''} — ${newKeys.length} unregistered, ${knownKeys.length} already in registry.`;
      st.style.color = newKeys.length > 0 ? 'rgba(212,168,67,0.8)' : 'rgba(46,201,138,0.7)';
    }

    window._accDiscoveredKeys = newKeys.map(([k]) => k);

    if (!list) return;
    if (newKeys.length === 0) {
      list.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.82rem;color:rgba(46,201,138,0.6);padding:8px 0;">All active keys are already registered.</div>';
      return;
    }

    // Show table of unregistered keys
    if (importBtn) importBtn.style.display = 'inline-block';
    list.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(212,168,67,0.5);margin-bottom:8px;">Unregistered Keys Found in Assessment Data</div>
      <table class="acc-table" style="margin-bottom:4px;">
        <thead><tr><th>Key</th><th>MMAS Records</th><th>PEACS Records</th><th>Action</th></tr></thead>
        <tbody>${newKeys.sort((a,b)=>(b[1].mmas+b[1].peacs)-(a[1].mmas+a[1].peacs)).map(([k,v]) =>
          `<tr>
            <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(212,168,67,0.7);">${k}</span></td>
            <td>${v.mmas}</td>
            <td>${v.peacs}</td>
            <td><button onclick="accRegisterSingleKey('${k}',${v.mmas})" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid rgba(46,201,138,0.25);color:rgba(46,201,138,0.6);padding:2px 8px;cursor:pointer;" onmouseover="this.style.borderColor='rgba(46,201,138,0.55)';this.style.color='#2ec98a'" onmouseout="this.style.borderColor='rgba(46,201,138,0.25)';this.style.color='rgba(46,201,138,0.6)'">Register</button></td>
          </tr>`
        ).join('')}</tbody>
      </table>`;
  });
}

async function accRegisterSingleKey(key, recordCount) {
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  // Infer role from key prefix
  const role = key.startsWith('INST-') || key.startsWith('UNIV-') ? 'institution'
    : key.startsWith('STU-')  ? 'student'
    : key.startsWith('PHRM-') ? 'clinician'  // legacy PHRM- keys map to unified clinician role
    : 'researcher';
  try {
    await db.ref('workspaces/'+key).set({
      name: key, // superadmin can rename later
      role,
      active: true,
      record_count: recordCount,
      source: 'discovered',
      created_at: Date.now()
    });
    showToast(`Registered ${key}.`, 2500);
    accDiscoverWorkspaces(); // refresh discovered list
    accLoadWorkspaces();     // refresh table
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

async function accImportDiscovered() {
  const keys = window._accDiscoveredKeys || [];
  if (!keys.length) { showToast('No keys to import.'); return; }
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  const st = document.getElementById('acc-ws-discover-status');
  if (st) { st.textContent = `Registering ${keys.length} keys…`; st.style.color = 'var(--muted)'; }
  const updates = {};
  keys.forEach(key => {
    const role = key.startsWith('INST-') || key.startsWith('UNIV-') ? 'institution'
      : key.startsWith('STU-')  ? 'student'
      : key.startsWith('PHRM-') ? 'clinician'  // legacy PHRM- keys map to unified clinician role
      : 'researcher';
    updates['workspaces/'+key] = { name: key, role, active: true, source: 'discovered', created_at: Date.now() };
  });
  try {
    await db.ref().update(updates);
    if (st) { st.textContent = `✓ Registered ${keys.length} keys. Rename them in the table below.`; st.style.color = 'var(--optimal)'; }
    window._accDiscoveredKeys = [];
    document.getElementById('acc-ws-discovered-list').innerHTML = '';
    document.getElementById('acc-ws-import-btn').style.display = 'none';
    accLoadWorkspaces();
  } catch(e) {
    if (st) { st.textContent = 'Error: ' + e.message; st.style.color = 'var(--poor)'; }
  }
}

// ── Bulk import via pasted key list ─────────────────────────────────────────
async function accBulkImportKeys() {
  const raw = (document.getElementById('acc-ws-bulk-input')?.value || '').trim();
  const role = document.getElementById('acc-ws-bulk-role')?.value || 'researcher';
  const st = document.getElementById('acc-ws-bulk-status');
  if (!raw) { if(st){st.textContent='Paste keys above.';st.style.color='var(--poor)';} return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = lines.map(line => {
    const parts = line.split(/\t+/);
    const key = parts[0].trim().toUpperCase();
    const name = parts[1]?.trim() || key;
    return { key, name };
  }).filter(({key}) => key.length >= 4);

  if (!parsed.length) { if(st){st.textContent='No valid keys found.';st.style.color='var(--poor)';} return; }
  if(st){st.textContent=`Importing ${parsed.length} keys…`;st.style.color='var(--muted)';}

  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  const updates = {};
  parsed.forEach(({key, name}) => {
    // Don't overwrite if already registered — only set if not present
    updates['workspaces/'+key] = { name, role, active: true, source: 'bulk_import', created_at: Date.now() };
  });
  try {
    await db.ref().update(updates);
    if(st){st.textContent=`✓ Imported ${parsed.length} keys.`;st.style.color='var(--optimal)';}
    document.getElementById('acc-ws-bulk-input').value = '';
    accLoadWorkspaces();
  } catch(e) {
    if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}
  }
}
function _renderWorkspaceTable(entries) {
  const tb = document.getElementById('acc-ws-tbody');
  if (!tb) return;
  const roleBadge = r => r==='institution'?'acc-badge-gold':r==='superadmin'?'acc-badge-gold':r==='clinician'?'acc-badge-teal':r==='pharmacist'?'acc-badge-teal':r==='researcher'?'acc-badge-blue':'acc-badge-green';
  tb.innerHTML = entries.map(([key, ws]) => `
    <tr>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(212,168,67,0.7);">${key}</span></td>
      <td>${ws.name||'—'}</td>
      <td><span class="acc-badge ${roleBadge(ws.role)}">${ws.role||'researcher'}</span></td>
      <td>${ws.record_count!=null?ws.record_count:'—'}</td>
      <td style="color:rgba(255,255,255,0.35);">${ws.parent_institution||'—'}</td>
      <td><span class="acc-badge ${ws.active===false?'acc-badge-red':'acc-badge-green'}">${ws.active===false?'Inactive':'Active'}</span></td>
      <td><button onclick="accRevokeWorkspace('${key}')" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.5);padding:2px 8px;cursor:pointer;" onmouseover="this.style.borderColor='rgba(239,68,68,0.5)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(239,68,68,0.2)';this.style.color='rgba(239,68,68,0.5)'">Revoke</button></td>
    </tr>`).join('');
}
function accFilterWorkspaces(q) {
  const entries = window._accWorkspaces || [];
  const f = q.toLowerCase();
  _renderWorkspaceTable(f ? entries.filter(([k,ws])=>(k+' '+(ws.name||'')).toLowerCase().includes(f)) : entries);
}
function accGenerateKey() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = n => Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  const role = document.getElementById('acc-ws-role')?.value || 'researcher';
  const prefixMap = { student:'STU', clinician:'CLI', pharmacist:'PHRM', np:'NP', pa:'PA', rn:'RN', md:'MD', care_coordinator:'CC', researcher:'RES', pi:'PI', institution_academic:'INST-ACAD', institution_health:'INST-HLTH', institution_amc:'INST-AMC', observer:'OBS', superadmin:'SA' };
  const prefix = prefixMap[role] || 'RES';
  document.getElementById('acc-ws-key').value = `${prefix}-${seg(4)}-${seg(4)}-2027`;
}
async function accCreateWorkspace() {
  const key = (document.getElementById('acc-ws-key')?.value||'').trim().toUpperCase();
  const name = (document.getElementById('acc-ws-name')?.value||'').trim();
  const _roleRaw = document.getElementById('acc-ws-role')?.value||'researcher';
  const _instTypeMap = { institution_academic:'academic', institution_health:'health', institution_amc:'amc' };
  const role = _instTypeMap[_roleRaw] ? 'institution' : _roleRaw;
  const institution_type = _instTypeMap[_roleRaw] || null;
  const parent = (document.getElementById('acc-ws-parent')?.value||'').trim().toUpperCase()||null;
  const campaign = (document.getElementById('acc-ws-campaign')?.value||'').trim()||null;
  const expiry = document.getElementById('acc-ws-expiry')?.value||null;
  const st = document.getElementById('acc-ws-status');
  if(!key||!name){if(st){st.textContent='Key and name required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent='Creating…';st.style.color='var(--muted)';}
  try{
    const _wsData = {name,role,parent_institution:parent,campaign_tag:campaign,expiry,active:true,created_at:Date.now()};
    if(institution_type) _wsData.institution_type = institution_type;
    await database.ref('workspaces/'+key).set(_wsData);
    if(st){st.textContent='Key issued: '+key;st.style.color='var(--optimal)';}
    ['acc-ws-key','acc-ws-name','acc-ws-parent','acc-ws-campaign','acc-ws-expiry'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    accLoadWorkspaces();
  }catch(e){if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}}
}
async function accRevokeWorkspace(key) {
  if(!confirm(`Revoke workspace key ${key}? This will prevent new logins. Existing data is preserved.`)) return;
  try{ await database.ref('workspaces/'+key+'/active').set(false); accLoadWorkspaces(); showToast('Key '+key+' revoked.'); }
  catch(e){ showToast('Error: '+e.message); }
}

function accSelectCampColor(color, el) {
  _accCampColor = color;
  document.querySelectorAll('#acc-camp-color-row div').forEach(d=>d.style.border='2px solid transparent');
  el.style.border = `2px solid ${color}`;
}

function accLoadCampaigns() {
  const list = document.getElementById('acc-camp-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--muted);padding:8px 0;">Loading\u2026</div>';
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  db.ref('campaigns').orderByChild('created_at').once('value', function(snap) {
    const raw = snap.val();
    if (!raw) { list.innerHTML='<div style="color:var(--muted);padding:8px 0;">No campaigns yet.</div>'; return; }
    const camps = Object.entries(raw).sort(function(a,b){return (b[1].created_at||0)-(a[1].created_at||0);});
    const now = Date.now();
    const cc1 = tc('rgba(255,255,255,0.75)','rgba(0,0,0,0.8)');
    const cc2 = tc('rgba(255,255,255,0.35)','rgba(0,0,0,0.5)');
    const cc3 = tc('rgba(255,255,255,0.5)','rgba(0,0,0,0.6)');
    var rows = camps.map(function(entry) {
      var id=entry[0], c=entry[1];
      var start=c.start?new Date(c.start):null, end=c.end?new Date(c.end):null;
      var active=start&&end&&(now>=start.getTime()&&now<=end.getTime());
      var concluded=end&&now>end.getTime();
      var badge=active?'acc-badge-green':concluded?'acc-badge-red':'acc-badge-blue';
      var status=active?'Active':concluded?'Concluded':'Upcoming';
      var dateStr=[c.start,c.end].filter(Boolean).join(' \u2192 ');
      var dot='<span style="display:inline-block;width:8px;height:8px;background:'+(c.color||'#d4a843')+';margin-left:8px;vertical-align:middle;"></span>';
      return '<tr>'
        +'<td style="color:'+cc1+';">'+(c.name||'\u2014')+dot+'</td>'
        +'<td style="color:'+cc2+';font-size:0.82rem;">'+dateStr+'</td>'
        +'<td><span class="acc-badge '+badge+'">'+status+'</span></td>'
        +'<td style="color:'+cc3+';">'+(c.submission_count||'\u2014')+'</td>'
        +'<td><button onclick="accArchiveCampaign(\''+id+'\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(212,168,67,0.2);color:rgba(212,168,67,0.5);padding:2px 8px;cursor:pointer;">Archive</button></td>'
        +'</tr>';
    });
    list.innerHTML = '<table class="acc-table"><thead><tr><th>Name</th><th>Dates</th><th>Status</th><th>Submissions</th><th></th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
    var sel = document.getElementById('acc-data-camp-select');
    if (sel) {
      sel.innerHTML = '<option value="">Select campaign\u2026</option>' + camps.map(function(e){return '<option value="'+e[0]+'">'+(e[1].name||e[0])+'</option>';}).join('');
    }
  });
}
async function accCreateCampaign() {
  const name=(document.getElementById('acc-camp-name')?.value||'').trim();
  const start=document.getElementById('acc-camp-start')?.value||'';
  const end=document.getElementById('acc-camp-end')?.value||'';
  const condition=(document.getElementById('acc-camp-condition')?.value||'').trim();
  const st=document.getElementById('acc-camp-status');
  if(!name){if(st){st.textContent='Campaign name required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent='Creating…';st.style.color='var(--muted)';}
  try{
    const id = 'CAMP-'+Date.now();
    await database.ref('campaigns/'+id).set({name,start,end,condition,color:_accCampColor,active:true,created_at:Date.now()});
    if(st){st.textContent='Campaign created.';st.style.color='var(--optimal)';}
    ['acc-camp-name','acc-camp-start','acc-camp-end','acc-camp-condition'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
    accLoadCampaigns();
    showToast('Campaign "'+name+'" launched.',3000);
  }catch(e){if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}}
}

async function accArchiveCampaign(id) {
  if(!confirm('Archive this campaign? It will be removed from the live system but data is preserved.')) return;
  try{ await database.ref('campaigns/'+id+'/active').set(false); accLoadCampaigns(); showToast('Campaign archived.'); }
  catch(e){ showToast('Error: '+e.message); }
}

function accLoadWallSection() {
  const list = document.getElementById('acc-wall-list');
  if (!list) return;
  list.innerHTML = `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};padding:8px 0;">Loading…</div>`;
  const db = (typeof database!=='undefined') ? database : null;
  if (!db) return;
  // Always show AP2026 as first entry
  const SEED = {name:'Adherence Project 2026',start:'2026-03-20',end:'2026-03-27',_seed:true};
  db.ref('wall_projects').orderByChild('created_at').once('value', snap => {
    const raw = snap.val();
    const extra = raw ? Object.values(raw).sort((a,b)=>(a.created_at||0)-(b.created_at||0)) : [];
    const all = [SEED,...extra];
    db.ref('assessments').once('value', aSnap => {
      const recs = aSnap.val() ? Object.values(aSnap.val()) : [];
      const tot = recs.filter(r=>r.score!==undefined).length;
      const ctr = new Set(recs.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
      list.innerHTML = all.map((p,i)=>`
        <div style="display:flex;align-items:baseline;gap:14px;padding:10px 0;border-bottom:1px solid ${tc('rgba(255,255,255,0.04)','rgba(0,0,0,0.07)')};">
          <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:0.9rem;color:rgba(212,168,67,0.45);letter-spacing:0.2em;min-width:32px;">${_toRoman(i+1)}</span>
          <span style="color:${tc('rgba(255,255,255,0.7)','rgba(0,0,0,0.8)')};flex:1;">${p.name||'Untitled'}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${tc('rgba(255,255,255,0.25)','rgba(0,0,0,0.4)')};">${p.start||''} – ${p.end||''}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:rgba(212,168,67,0.5);">${p._seed ? tot.toLocaleString() : (p.total?Number(p.total).toLocaleString():'—')}</span>
        </div>`).join('');
    });
  });
}

function accAutofillWallStats() {
  const st=document.getElementById('acc-wall-autofill-status');
  if(st) st.textContent='Fetching…';
  const db=(typeof database!=='undefined')?database:null;
  if(!db){if(st)st.textContent='Unavailable.';return;}
  db.ref('assessments').once('value',snap=>{
    const all=snap.val()?Object.values(snap.val()):[];
    const t=all.filter(r=>r.score!==undefined).length;
    const c=new Set(all.map(r=>r.country).filter(x=>x&&x!=='Unknown')).size;
    const tf=document.getElementById('acc-wall-total'); if(tf) tf.value=t;
    const cf=document.getElementById('acc-wall-countries'); if(cf) cf.value=c;
    if(st) st.textContent=`${t.toLocaleString()} assessments · ${c} countries`;
  });
}

async function accInscribeWall() {
  const name=(document.getElementById('acc-wall-name')?.value||'').trim();
  const st=document.getElementById('acc-wall-status');
  if(!name){if(st){st.textContent='Name required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent='Inscribing…';st.style.color='var(--muted)';}
  try{
    await database.ref('wall_projects').push({
      name,
      start:document.getElementById('acc-wall-start')?.value||'',
      end:document.getElementById('acc-wall-end')?.value||'',
      desc:(document.getElementById('acc-wall-desc')?.value||'').trim(),
      total:parseInt(document.getElementById('acc-wall-total')?.value)||0,
      countries:parseInt(document.getElementById('acc-wall-countries')?.value)||0,
      created_at:Date.now()
    });
    if(st){st.textContent='Inscribed on The Wall.';st.style.color='var(--optimal)';}
    ['acc-wall-name','acc-wall-start','acc-wall-end','acc-wall-desc','acc-wall-total','acc-wall-countries'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    accLoadWallSection();
  }catch(e){if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}}
}

function accLoadApiKeys() {
  const tb=document.getElementById('acc-api-tbody');
  if(!tb) return;
  tb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;">Loading…</td></tr>`;
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('api_keys').once('value',snap=>{
    const raw=snap.val()||{};
    const entries=Object.entries(raw).sort((a,b)=>(b[1].created_at||0)-(a[1].created_at||0));
    if(!entries.length){tb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;">No API keys issued.</td></tr>`;return;}
    const tierBadge=t=>t==='enterprise'?'acc-badge-gold':t==='premium'?'acc-badge-blue':'acc-badge-green';
    tb.innerHTML=entries.map(([id,k])=>`<tr>
      <td style="color:${tc('rgba(255,255,255,0.65)','rgba(0,0,0,0.75)')};">${k.client||'—'}</td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:rgba(212,168,67,0.6);">${id.slice(0,12)}…</span></td>
      <td><span class="acc-badge ${tierBadge(k.tier)}">${k.tier||'standard'}</span></td>
      <td style="color:${tc('rgba(255,255,255,0.4)','rgba(0,0,0,0.5)')};">${k.calls_today||0} / ${k.rate_limit||'∞'}</td>
      <td style="color:${tc('rgba(255,255,255,0.3)','rgba(0,0,0,0.4)')};font-size:0.80rem;">${k.expiry||'—'}</td>
      <td><span class="acc-badge ${k.active===false?'acc-badge-red':'acc-badge-green'}">${k.active===false?'Revoked':'Active'}</span></td>
      <td><button onclick="accRevokeApiKey('${id}')" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.5);padding:2px 8px;cursor:pointer;">Revoke</button></td>
    </tr>`).join('');
  });
}
async function accIssueApiKey() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const client=(document.getElementById('acc-api-client')?.value||'').trim();
  const tier=document.getElementById('acc-api-tier')?.value||'standard';
  const rate=parseInt(document.getElementById('acc-api-rate')?.value)||1000;
  const expiry=document.getElementById('acc-api-expiry')?.value||null;
  const st=document.getElementById('acc-api-status');
  if(!client){if(st){st.textContent='Client name required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent=_t.admin_issuing || 'Issuing…';st.style.color='var(--muted)';}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const key='atlas_'+Array.from({length:32},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  try{
    await database.ref('api_keys/'+key).set({client,tier,rate_limit:rate,expiry,active:true,calls_today:0,created_at:Date.now()});
    if(st){st.textContent='Key issued.';st.style.color='var(--optimal)';}
    navigator.clipboard?.writeText(key).then(()=>showToast('API key copied to clipboard.',3000));
    ['acc-api-client','acc-api-rate','acc-api-expiry'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    accLoadApiKeys();
  }catch(e){if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}}
}
async function accRevokeApiKey(id) {
  if(!confirm('Revoke this API key? The client will lose access immediately.')) return;
  try{ await database.ref('api_keys/'+id+'/active').set(false); accLoadApiKeys(); showToast('API key revoked.'); }
  catch(e){ showToast('Error: '+e.message); }
}

function accLoadDataSection() {
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('campaigns').once('value',snap=>{
    const raw=snap.val()||{};
    const sel=document.getElementById('acc-data-camp-select');
    if(sel) sel.innerHTML='<option value="">Select campaign…</option>'+
      Object.entries(raw).map(([id,c])=>`<option value="${id}">${c.name||id}</option>`).join('');
  });
  refreshBatchHistory();
}

// ── Annual State of Global Adherence Report ───────────

function openAnnualReport() {
  renderAnnualReport();
  const m = document.getElementById('annual-report-modal');
  if (m) { m.classList.add('open'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

function closeAnnualReport() {
  const m = document.getElementById('annual-report-modal');
  if (m) m.classList.remove('open');
}

function renderAnnualReport() {
  const body = document.getElementById('ar-body');
  if (!body) return;

  // Data sources — try multiple global state locations
  const records = window._allRecords || window.allRecords || window._cohortData || [];
  const year = new Date().getFullYear();

  const badge = document.getElementById('ar-year-badge');
  if (badge) badge.textContent = `${year} Annual Report`;

  if (records.length === 0) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#9ca3af;">Loading global data… Please ensure you are logged in with an institution or researcher key.</div>';
    return;
  }

  // Compute global stats
  const totalN = records.length;
  const scores = records.map(r => parseFloat(r.score)).filter(s => !isNaN(s));
  const mean = scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  const high = scores.filter(s => s >= 8).length;
  const medium = scores.filter(s => s >= 6 && s < 8).length;
  const low = scores.filter(s => s < 6).length;

  // Country breakdown
  const countryMap = {};
  records.forEach(r => {
    const c = r.country || 'Unknown';
    if (!countryMap[c]) countryMap[c] = { n: 0, scoreSum: 0 };
    countryMap[c].n++;
    countryMap[c].scoreSum += parseFloat(r.score) || 0;
  });
  const topCountries = Object.entries(countryMap)
    .map(([name, d]) => ({ name, n: d.n, mean: d.scoreSum / d.n }))
    .sort((a, b) => b.n - a.n).slice(0, 20);

  // Condition breakdown
  const condMap = {};
  records.forEach(r => {
    const c = (r.condition || 'Not specified').trim();
    if (!condMap[c]) condMap[c] = { n: 0, scoreSum: 0 };
    condMap[c].n++;
    condMap[c].scoreSum += parseFloat(r.score) || 0;
  });
  const topConditions = Object.entries(condMap)
    .map(([name, d]) => ({ name, n: d.n, mean: d.scoreSum / d.n }))
    .sort((a, b) => b.n - a.n).slice(0, 15);

  // Pattern breakdown
  const patterns = { INA: 0, UNA: 0, Mixed: 0, High: 0 };
  records.forEach(r => { if (patterns.hasOwnProperty(r.pattern)) patterns[r.pattern]++; });

  const pct = (n) => totalN ? ((n / totalN) * 100).toFixed(1) + '%' : '—';
  const scoreBar = (mean) => {
    const w = Math.round((mean / 8) * 80);
    const color = mean >= 7 ? '#10b981' : mean >= 5.5 ? '#f59e0b' : '#ef4444';
    return `<span class="ar-score-bar" style="width:${w}px;background:${color};"></span><strong>${mean.toFixed(2)}</strong>`;
  };

  body.innerHTML = `
    <!-- Global Stats -->
    <div class="ar-stat-grid">
      <div class="ar-stat-card"><div class="ar-stat-num">${totalN.toLocaleString()}</div><div class="ar-stat-label">Total Assessments</div></div>
      <div class="ar-stat-card"><div class="ar-stat-num">${topCountries.length}</div><div class="ar-stat-label">Countries Represented</div></div>
      <div class="ar-stat-card"><div class="ar-stat-num">${mean.toFixed(2)}</div><div class="ar-stat-label">Global Mean Score</div></div>
      <div class="ar-stat-card"><div class="ar-stat-num">${pct(high)}</div><div class="ar-stat-label">High Adherence</div></div>
    </div>

    <!-- Adherence Distribution -->
    <div class="ar-section-title">Global Adherence Distribution</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.25rem;">
      <div style="padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:800;color:#10b981;">${pct(high)}</div>
        <div style="font-size:0.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-top:2px;">High Adherence</div>
        <div style="font-size:0.72rem;color:#9ca3af;">Score 8.0 (n=${high.toLocaleString()})</div>
      </div>
      <div style="padding:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:800;color:#f59e0b;">${pct(medium)}</div>
        <div style="font-size:0.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-top:2px;">Medium Adherence</div>
        <div style="font-size:0.72rem;color:#9ca3af;">Score 6.0–7.9 (n=${medium.toLocaleString()})</div>
      </div>
      <div style="padding:12px;background:#fff1f2;border:1px solid #fca5a5;border-radius:8px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:800;color:#ef4444;">${pct(low)}</div>
        <div style="font-size:0.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-top:2px;">Low Adherence</div>
        <div style="font-size:0.72rem;color:#9ca3af;">Score &lt;6.0 (n=${low.toLocaleString()})</div>
      </div>
    </div>

    <!-- Behavioral Patterns -->
    <div class="ar-section-title">Behavioral Pattern Classification</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:1.25rem;">
      ${Object.entries(patterns).map(([p,n]) => `<div style="padding:10px;border:1px solid #e5e7eb;border-radius:7px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:#374151;">${pct(n)}</div><div style="font-size:0.7rem;font-weight:700;color:#9ca3af;text-transform:uppercase;">${p}</div></div>`).join('')}
    </div>

    <!-- Country Breakdown -->
    <div class="ar-section-title">Top Countries by Submission Volume</div>
    <table class="ar-country-table">
      <thead><tr><th>#</th><th>Country</th><th>Assessments</th><th>Mean Score</th><th>Share</th></tr></thead>
      <tbody>
        ${topCountries.map((c,i) => `<tr>
          <td style="color:#9ca3af;">${i+1}</td>
          <td style="font-weight:600;">${c.name}</td>
          <td>${c.n.toLocaleString()}</td>
          <td>${scoreBar(c.mean)}</td>
          <td style="color:#9ca3af;">${pct(c.n)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <!-- Condition Breakdown -->
    <div class="ar-section-title">Adherence by Condition (Top 15)</div>
    <div>
      ${topConditions.map(c => `
        <div class="ar-condition-row">
          <span style="font-weight:600;">${c.name}</span>
          <span style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.72rem;color:#9ca3af;">n=${c.n}</span>
            ${scoreBar(c.mean)}
          </span>
        </div>`).join('')}
    </div>

    <!-- Methodology Note -->
    <div style="margin-top:1.5rem;padding:14px;background:#f8faff;border:1px solid #dbeafe;border-radius:8px;font-size:0.75rem;color:#374151;line-height:1.6;">
      <strong>Methodology:</strong> Data sourced from the ATLAS Global Adherence Dataset (${year}). All assessments administered using MAP (Multidimensional Adherence Parameters), second-generation refinement of the MMAS-8 (Morisky Medication Adherence Scale, © Morisky Medication Adherence Research LLC). PE scores computed via the Theory of Predictive Emergence (TPE): PE = (Architecture × Execution × Context)^(1/3). Data is de-identified; geographic attribution is country-level only. Published baselines: Morisky et al., J Clin Hypertension, 2008 (global mean MMAS-8 = 5.93, n=1,367).
    </div>`;
}

function exportAnnualReportText() {
  const records = window._allRecords || window.allRecords || window._cohortData || [];
  const year = new Date().getFullYear();
  const totalN = records.length;
  const scores = records.map(r => parseFloat(r.score)).filter(s => !isNaN(s));
  const mean = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : '—';
  const countries = new Set(records.map(r => r.country).filter(Boolean)).size;

  const text = [
    `STATE OF GLOBAL ADHERENCE — ${year} ANNUAL REPORT`,
    `${'═'.repeat(58)}`,
    `Adherence Inc. · Philip Morisky, ScD, MSPH, FAHA`,
    `ATLAS Platform · adherence.cc`,
    `Generated: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`,
    ``,
    `GLOBAL DATASET SUMMARY`,
    `${'─'.repeat(40)}`,
    `Total Assessments:    ${totalN.toLocaleString()}`,
    `Countries:            ${countries}`,
    `Global Mean Score:    ${mean} / 8.0`,
    ``,
    `INSTRUMENT`,
    `${'─'.repeat(40)}`,
    `MAP (Multidimensional Adherence Parameters)`,
    `Second-generation refinement of MMAS-8`,
    `© Morisky Medication Adherence Research LLC`,
    ``,
    `PUBLISHED BASELINE COMPARISON`,
    `${'─'.repeat(40)}`,
    `ATLAS Global Mean (${year}): ${mean}`,
    `Literature Baseline (Morisky et al. 2008): 5.93`,
    ``,
    `METHODOLOGY`,
    `${'─'.repeat(40)}`,
    `All assessments administered via ATLAS platform. Data de-identified.`,
    `Geographic attribution: country-level only. TPE: PE=(A×E×C)^(1/3).`,
    ``,
    `© ${year} Adherence Inc. All rights reserved.`
  ].join('\n');

  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ATLAS_State_of_Global_Adherence_${year}.txt`;
  a.click();
}

// ── Bulk Upload Batch History & Rollback ─────────────

const BATCH_HISTORY_KEY = 'atlas_batch_history';

function _getBatchHistory() {
  try { return JSON.parse(localStorage.getItem(BATCH_HISTORY_KEY) || '[]'); } catch(e) { return []; }
}

function _saveBatchHistory(history) {
  try { localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(history)); } catch(e) {}
}

function recordBatchUpload(filename, recordCount, uploadedBy, batchIds) {
  // Call this after a successful bulk upload
  // batchIds = array of Firebase push keys for the uploaded records (for rollback)
  const history = _getBatchHistory();
  history.unshift({
    id: 'BATCH-' + Date.now(),
    date: new Date().toISOString(),
    filename: filename || 'unknown.csv',
    recordCount: recordCount || 0,
    uploadedBy: uploadedBy || 'Admin',
    status: 'active',
    batchIds: batchIds || []
  });
  // Keep only last 50 batches
  _saveBatchHistory(history.slice(0, 50));
  refreshBatchHistory();
}

function refreshBatchHistory() {
  const tbody = document.getElementById('batch-history-tbody');
  if (!tbody) return;
  const history = _getBatchHistory();
  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="batch-empty">No upload batches recorded.</td></tr>';
    return;
  }
  tbody.innerHTML = history.map(batch => {
    const date = new Date(batch.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'});
    const isActive = batch.status === 'active';
    return `<tr>
      <td style="color:#6b7280;font-size:0.78rem;">${date}</td>
      <td style="font-weight:600;font-family:monospace;font-size:0.78rem;">${batch.filename}</td>
      <td style="text-align:center;font-weight:700;">${batch.recordCount}</td>
      <td style="color:#6b7280;">${batch.uploadedBy || '—'}</td>
      <td><span class="batch-status-badge ${batch.status}">${batch.status === 'active' ? 'Active' : 'Rolled Back'}</span></td>
      <td>${isActive
        ? `<button class="batch-rollback-btn" onclick="confirmRollback('${batch.id}')">Rollback</button>`
        : `<span style="font-size:0.72rem;color:#9ca3af;">—</span>`
      }</td>
    </tr>`;
  }).join('');
}

function confirmRollback(batchId) {
  const history = _getBatchHistory();
  const batch = history.find(b => b.id === batchId);
  if (!batch) return;
  const confirmed = confirm(`Roll back batch "${batch.filename}"?\n\n${batch.recordCount} records will be deleted. This cannot be undone.\n\nType OK to confirm.`);
  if (!confirmed) return;
  executeBatchRollback(batchId);
}

async function executeBatchRollback(batchId) {
  const history = _getBatchHistory();
  const batch = history.find(b => b.id === batchId);
  if (!batch) return;

  // Find rollback button and disable it
  const btns = document.querySelectorAll('.batch-rollback-btn');
  btns.forEach(b => { if (b.getAttribute('onclick')?.includes(batchId)) { b.disabled = true; b.textContent = 'Rolling back…'; } });

  let deleted = 0;
  if (batch.batchIds && batch.batchIds.length > 0) {
    // Delete each record from Firebase
    for (const fbKey of batch.batchIds) {
      try {
        const db = window._firebaseDb || (typeof database !== 'undefined' ? database : null);
        if (db) { await db.ref(`assessments/${fbKey}`).remove(); deleted++; }
      } catch(e) { console.error('Rollback delete error:', fbKey, e); }
    }
  }

  // Mark batch as rolled back
  batch.status = 'rolled-back';
  batch.rolledBackAt = new Date().toISOString();
  batch.deletedCount = deleted;
  _saveBatchHistory(history);
  refreshBatchHistory();
  showToast(`Rollback complete — ${deleted} records removed.`, 4000);
}

function accExportGlobalMMAS() {
  if (typeof isSuperAdmin !== 'function' || !isSuperAdmin()) {
    if (typeof showToast === 'function') showToast('Superadmin access required.', 3000);
    return;
  }
  showToast('Preparing global MMAS export…');
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('assessments').once('value',snap=>{
    const all=snap.val()?Object.values(snap.val()):[];
    if(!all.length){showToast('No data to export.');return;}
    const mmasExport = all.filter(r => r.map_q1 === undefined); // MMAS-8 only — MAP records go to separate export
    const cols=['score','country','city','condition','drug_name','gender','age_range','education','institution_code','patient_number','timestamp'];
    const esc=v=>{const s=String(v==null?'':v);return(s.includes(',')||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s;};
    const csv=[cols.join(','),...mmasExport.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`atlas_global_mmas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`Exported ${mmasExport.length.toLocaleString()} MMAS-8 records.`,3000);
  });
}
function accExportGlobalPEACS() {
  if (typeof isSuperAdmin !== 'function' || !isSuperAdmin()) {
    if (typeof showToast === 'function') showToast('Superadmin access required.', 3000);
    return;
  }
  showToast('Preparing global PEACS export…');
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('peacs_assessments').once('value',snap=>{
    const all=snap.val()?Object.values(snap.val()):[];
    if(!all.length){showToast('No data to export.');return;}
    const cols=['pe_score','base','mvmt','strata','country','city','condition','institution_code','patient_number','timestamp'];
    const esc=v=>{const s=String(v==null?'':v);return(s.includes(',')||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s;};
    const csv=[cols.join(','),...all.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`atlas_global_peacs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`Exported ${all.length.toLocaleString()} PEACS records.`,3000);
  });
}
function accExportCampaign() {
  const campId=document.getElementById('acc-data-camp-select')?.value;
  if(!campId){showToast('Select a campaign first.');return;}
  showToast('Preparing campaign export…');
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('assessments').orderByChild('campaign_id').equalTo(campId).once('value',snap=>{
    const all=snap.val()?Object.values(snap.val()):[];
    if(!all.length){showToast('No records tagged to that campaign.');return;}
    const cols=['score','country','city','condition','institution_code','patient_number','timestamp'];
    const esc=v=>{const s=String(v==null?'':v);return(s.includes(','))?'"'+s+'"':s;};
    const csv=[cols.join(','),...all.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`atlas_campaign_${campId}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`Exported ${all.length} campaign records.`,3000);
  });
}

