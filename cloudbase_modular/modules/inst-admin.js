// ══════════════════════════════════════════════════════════════════════════════
// Institution Admin — Self-service member provisioning for institution accounts
// BP-FOCUS-02: Eliminates the need to email ATLAS support for every team change
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

/** @type {Object[]|null} Cached list of workspace members */
let _instAdminMembers = null;

/** @type {string[]|null} In-memory session domain match counts keyed by domain */
let _instDomainMatchCounts = {};

/**
 * Returns the Firebase ID token for the currently signed-in institution user.
 * Does NOT require superadmin claims — any authenticated user may call this.
 * Used exclusively by the /inst/ Lambda endpoints which enforce their own
 * institution-role check server-side.
 * @returns {Promise<string>} Raw Firebase ID token string
 * @throws {Error} If no user is currently authenticated
 */
async function _instGetToken() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return await user.getIdToken(false);
}

/**
 * Returns the institution workspace key from the current user's token claims.
 * @returns {Promise<string>} The workspace key
 * @throws {Error} If no workspace key found in claims
 */
async function _instGetInstKey() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const result = await user.getIdTokenResult(false);
  const claims = result.claims;
  const key = claims.workspace || claims.workspace_key;
  if (!key) throw new Error('No workspace key found in token claims');
  return key;
}

/**
 * Returns true if the email's domain is in the given domains array.
 * @param {string} email
 * @param {string[]} domains
 * @returns {boolean}
 */
function _instCheckDomainMatch(email, domains) {
  if (!email || !domains || !domains.length) return false;
  const parts = String(email).toLowerCase().split('@');
  if (parts.length !== 2) return false;
  return domains.indexOf(parts[1]) !== -1;
}

/**
 * Renders the Domain Access Configuration section into the given container.
 * @param {HTMLElement} container - the element to append the section into
 * @param {string} instKey - the institution workspace key
 * @param {Object[]} members - current member list (for domain match counting)
 */
async function _instRenderDomainConfig(container, instKey, members) {
  if (!container || !instKey) return;

  // Dismiss banner state (session-only)
  const bannerKey = '_instSsoBannerDismissed';

  const sectionEl = document.createElement('div');
  sectionEl.id = 'inst-domain-config-section';
  sectionEl.style.cssText = 'margin-top:32px;';
  container.appendChild(sectionEl);

  const _renderSection = (domains) => {
    // Count member email matches per session
    _instDomainMatchCounts = {};
    (members || []).forEach(m => {
      if (m.email && _instCheckDomainMatch(m.email, domains)) {
        const d = m.email.split('@')[1].toLowerCase();
        _instDomainMatchCounts[d] = (_instDomainMatchCounts[d] || 0) + 1;
      }
    });
    const totalMatched = Object.values(_instDomainMatchCounts).reduce((s, v) => s + v, 0);

    // Check if current user matches
    const currentUser = firebase.auth().currentUser;
    const currentEmail = currentUser ? (currentUser.email || '') : '';
    const currentUserMatches = _instCheckDomainMatch(currentEmail, domains);

    const bannerDismissed = sessionStorage.getItem(bannerKey);
    const ssoBannerHtml = bannerDismissed ? '' : `
      <div id="inst-sso-banner" style="background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px;">
        <div style="flex:1;font-size:0.80rem;color:rgba(78,156,245,0.85);line-height:1.6;">
          <strong style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;">Enterprise SSO Available</strong><br>
          Full SSO integration (LDAP/SAML/Azure AD) is available on Enterprise tier. Domain matching enables streamlined invite workflows.
        </div>
        <button onclick="sessionStorage.setItem('${bannerKey}','1');document.getElementById('inst-sso-banner').remove();" style="background:none;border:none;color:rgba(78,156,245,0.5);font-size:1rem;cursor:pointer;padding:0;line-height:1;flex-shrink:0;" title="Dismiss">✕</button>
      </div>`;

    const domainListHtml = domains.length === 0
      ? '<div style="font-size:0.80rem;color:var(--muted,#6b8099);font-style:italic;padding:8px 0;">No domains registered yet.</div>'
      : domains.map(d => {
          const matchCount = _instDomainMatchCounts[d] || 0;
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:6px;margin-bottom:6px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(212,168,67,0.9);flex:1;">@${_esc(d)}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:rgba(46,201,138,0.7);">Active &mdash; ${matchCount} user${matchCount !== 1 ? 's' : ''} matched this session</span>
            <button onclick="_instRemoveDomain('${_esc(d)}')" style="background:none;border:1px solid rgba(239,68,68,0.25);color:rgba(239,68,68,0.6);border-radius:4px;padding:2px 8px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'">✕ Remove</button>
          </div>`;
        }).join('');

    sectionEl.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.6);margin-bottom:6px;">Domain Access Configuration</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.15rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:6px;">Domain Access</div>
      <p style="font-size:0.80rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:16px;">Register your institution's email domain. Users signing in with a matching email are automatically recognized as institution members and can request access without a manual key.</p>
      ${ssoBannerHtml}
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input id="inst-domain-input" type="text" placeholder="Email domain (e.g. hopkinsmedicine.org)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 12px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;outline:none;" />
        <button onclick="_instAddDomain()" style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(212,168,67,0.10);border:1px solid rgba(212,168,67,0.30);color:rgba(212,168,67,0.9);padding:8px 16px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:all 0.2s;" onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='rgba(212,168,67,0.10)'">Add Domain</button>
      </div>
      <div id="inst-domain-list">${domainListHtml}</div>
      ${currentUserMatches ? '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:rgba(46,201,138,0.8);">Your account matches this domain.</div>' : ''}
      <div id="inst-domain-err" style="font-size:0.78rem;color:rgba(239,68,68,0.9);display:none;margin-top:8px;"></div>`;
  };

  // Load existing domains from Firebase
  try {
    const snap = await firebase.database().ref('workspaces/' + instKey + '/auth_domains').once('value');
    const existing = snap.val() || [];
    const domainArr = Array.isArray(existing) ? existing : Object.values(existing);
    window._instCurrentDomains = domainArr;
    window._instCurrentKey = instKey;
    _renderSection(domainArr);
  } catch(e) {
    sectionEl.innerHTML = `<div style="font-size:0.80rem;color:rgba(239,68,68,0.8);">Could not load domain config: ${_esc(e.message)}</div>`;
  }
}

async function _instAddDomain() {
  const input = document.getElementById('inst-domain-input');
  const errEl = document.getElementById('inst-domain-err');
  if (!input) return;

  let domain = (input.value || '').trim().toLowerCase().replace(/^@/, '');
  if (!domain || !domain.includes('.')) {
    if (errEl) { errEl.textContent = 'Enter a valid domain (e.g. hopkinsmedicine.org).'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const domains = window._instCurrentDomains || [];
  if (domains.indexOf(domain) !== -1) {
    if (errEl) { errEl.textContent = 'Domain already registered.'; errEl.style.display = 'block'; }
    return;
  }

  const updated = [...domains, domain];
  try {
    await firebase.database().ref('workspaces/' + window._instCurrentKey + '/auth_domains').set(updated);
    window._instCurrentDomains = updated;
    if (typeof atlasAuditLog === 'function') atlasAuditLog('INST_DOMAIN_ADDED', { domain });
    if (typeof showToast === 'function') showToast('Domain @' + domain + ' added.', 3000);
    input.value = '';
    // Re-render section with updated domains
    const body = document.getElementById('inst-admin-body');
    const sec = document.getElementById('inst-domain-config-section');
    if (sec) sec.remove();
    if (body) await _instRenderDomainConfig(body, window._instCurrentKey, _instAdminMembers || []);
  } catch(e) {
    if (errEl) { errEl.textContent = 'Failed to save: ' + e.message; errEl.style.display = 'block'; }
  }
}

async function _instRemoveDomain(domain) {
  if (!domain || !confirm('Remove domain @' + domain + '?')) return;
  const domains = (window._instCurrentDomains || []).filter(d => d !== domain);
  try {
    await firebase.database().ref('workspaces/' + window._instCurrentKey + '/auth_domains').set(domains);
    window._instCurrentDomains = domains;
    if (typeof atlasAuditLog === 'function') atlasAuditLog('INST_DOMAIN_REMOVED', { domain });
    if (typeof showToast === 'function') showToast('Domain @' + domain + ' removed.', 3000);
    const body = document.getElementById('inst-admin-body');
    const sec = document.getElementById('inst-domain-config-section');
    if (sec) sec.remove();
    if (body) await _instRenderDomainConfig(body, window._instCurrentKey, _instAdminMembers || []);
  } catch(e) {
    if (typeof showToast === 'function') showToast('Failed to remove domain: ' + e.message, 4000);
  }
}

/**
 * Renders the institution self-service admin panel.
 * @param {HTMLElement} container
 */
async function renderInstAdmin(container) {
  if (!isInstitutionMode()) return;
  if (!container) return;
  container.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.6);margin-bottom:6px;">Institution · Team Management</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:6px;">Manage Your Team</div>
    <p style="font-size:0.84rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:20px;">Add, remove, and configure team members without contacting ATLAS support. Changes take effect immediately.</p>
    <div id="inst-admin-body">
      <div style="font-size:0.84rem;color:var(--muted,#6b8099);">Loading members…</div>
    </div>`;

  await _loadInstMembers(container.querySelector('#inst-admin-body'));
}

async function _loadInstMembers(body) {
  try {
    const token = await _instGetToken();
    const res = await fetch(LAMBDA_URL + '/inst/list-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load members');
    _instAdminMembers = data.keys || [];
    _renderMemberTable(body);

    // Render Domain Access Configuration below the member table
    try {
      const instKey = await _instGetInstKey();
      await _instRenderDomainConfig(body, instKey, _instAdminMembers);
    } catch(domErr) {
      // Non-fatal: domain config section is additive
      console.warn('[inst-admin] domain config unavailable:', domErr.message);
    }
  } catch(e) {
    if (body) body.innerHTML = `<div style="color:rgba(239,68,68,0.8);font-size:0.84rem;">Error loading members: ${_esc(e.message)}</div>`;
  }
}

function _renderMemberTable(body) {
  const members = _instAdminMembers || [];
  const roleColors = { researcher:'rgba(139,111,245,0.8)', clinician:'rgba(78,156,245,0.8)', student:'rgba(46,201,138,0.8)', observer:'rgba(255,255,255,0.3)', pi:'rgba(212,168,67,0.8)' };

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--muted,#6b8099);">${members.length} member${members.length !== 1 ? 's' : ''}</div>
      <button onclick="openAddMemberModal()" style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);color:rgba(212,168,67,0.9);padding:8px 16px;border-radius:7px;cursor:pointer;transition:all 0.2s;">+ Add Member</button>
    </div>
    ${members.length === 0 ? '<div style="font-size:0.84rem;color:var(--muted,#6b8099);padding:24px 0;text-align:center;">No sub-workspace members yet. Add your first team member.</div>' : `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
            ${['Name','Email','Role','Key','Expiry','Last Active',''].map(h=>`<th style="text-align:left;padding:8px 10px;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-weight:400;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const rc = roleColors[m.role] || 'rgba(255,255,255,0.5)';
            const expiry = m.expiry ? new Date(m.expiry).toLocaleDateString() : '—';
            const lastSeen = m.lastActive ? (Date.now()-m.lastActive < 86400000 ? Math.floor((Date.now()-m.lastActive)/3600000)+'h ago' : new Date(m.lastActive).toLocaleDateString()) : 'Never';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.12s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
              <td style="padding:9px 10px;font-size:0.84rem;color:var(--text,#c8d6e8);">${m.name || '—'}</td>
              <td style="padding:9px 10px;font-size:0.78rem;color:var(--muted,#6b8099);">${m.email || '—'}</td>
              <td style="padding:9px 10px;"><span style="font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:${rc}18;border:1px solid ${rc}44;color:${rc};">${m.role || '?'}</span></td>
              <td style="padding:9px 10px;font-size:0.72rem;color:rgba(212,168,67,0.7);">${m.key || '—'}</td>
              <td style="padding:9px 10px;font-size:0.78rem;color:var(--muted,#6b8099);">${expiry}</td>
              <td style="padding:9px 10px;font-size:0.78rem;color:var(--muted,#6b8099);">${lastSeen}</td>
              <td style="padding:9px 10px;">
                <div style="display:flex;gap:5px;">
                  <button onclick="revokeInstMember('${m.key}')" style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.7);padding:3px 8px;border-radius:4px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">Revoke</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}`;
}

function openAddMemberModal() {
  if (!isInstitutionMode()) return;
  const overlay = document.createElement('div');
  overlay.id = 'inst-add-member-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(2,6,18,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:var(--card,#111e32);border:1px solid var(--border2,rgba(255,255,255,0.13));border-top:2px solid rgba(212,168,67,0.5);border-radius:14px;max-width:480px;width:100%;padding:36px;">
      <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.3rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:20px;">Add Team Member</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">First Name</label>
            <input id="iam-fname" placeholder="First" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;outline:none;"/>
          </div>
          <div>
            <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Last Name</label>
            <input id="iam-lname" placeholder="Last" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;outline:none;"/>
          </div>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Email *</label>
          <input id="iam-email" type="email" placeholder="colleague@institution.edu" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;outline:none;"/>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Role *</label>
          <select id="iam-role" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);outline:none;">
            <option value="researcher">Researcher</option>
            <option value="clinician">Clinician</option>
            <option value="student">Student</option>
            <option value="observer">Observer (read-only)</option>
          </select>
        </div>
        <div>
          <label style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted,#6b8099);display:block;margin-bottom:4px;">Key Expiry (optional)</label>
          <input id="iam-expiry" type="date" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:var(--bright,#e8f0f8);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;outline:none;"/>
        </div>
        <div id="iam-err" style="font-size:0.78rem;color:rgba(239,68,68,0.9);display:none;"></div>
        <div style="display:flex;gap:10px;margin-top:6px;">
          <button onclick="submitAddMember()" style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);color:rgba(212,168,67,0.9);padding:10px;border-radius:7px;cursor:pointer;">Provision Key & Send Email →</button>
          <button onclick="document.getElementById('inst-add-member-overlay').remove()" style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.12);color:var(--muted,#6b8099);padding:10px 14px;border-radius:7px;cursor:pointer;">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function submitAddMember() {
  if (!isInstitutionMode()) return;
  const fname  = document.getElementById('iam-fname')?.value.trim();
  const lname  = document.getElementById('iam-lname')?.value.trim();
  const email  = document.getElementById('iam-email')?.value.trim();
  const role   = document.getElementById('iam-role')?.value;
  const expiry = document.getElementById('iam-expiry')?.value;
  const errEl  = document.getElementById('iam-err');

  if (!email || !email.includes('@')) { if (errEl) { errEl.textContent = 'Valid email required.'; errEl.style.display = 'block'; } return; }

  try {
    const token = await _instGetToken();
    const res = await fetch(LAMBDA_URL + '/inst/provision-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ fname, lname, email, role, expiry: expiry || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Provisioning failed');

    document.getElementById('inst-add-member-overlay')?.remove();
    if (typeof showToast === 'function') showToast('Key provisioned and sent to ' + email, 4000);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('INST_MEMBER_ADDED', { email, role, key: data.key });

    // Refresh member list
    _instAdminMembers = null;
    const body = document.getElementById('inst-admin-body');
    if (body) await _loadInstMembers(body);

  } catch(e) {
    if (errEl) { errEl.textContent = 'Error: ' + e.message; errEl.style.display = 'block'; }
  }
}

async function revokeInstMember(key) {
  if (!isInstitutionMode()) return;
  if (!key || !confirm('Revoke access for key ' + key + '? This cannot be undone.')) return;

  try {
    const token = await _instGetToken();
    await fetch(LAMBDA_URL + '/inst/revoke-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ key })
    });
    if (typeof showToast === 'function') showToast('Access revoked for ' + key, 3000);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('INST_MEMBER_REVOKED', { key });
    _instAdminMembers = null;
    const body = document.getElementById('inst-admin-body');
    if (body) await _loadInstMembers(body);
  } catch(e) {
    if (typeof showToast === 'function') showToast('Revoke failed: ' + e.message, 4000);
  }
}
