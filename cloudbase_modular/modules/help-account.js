// ══════════════════════════════════════════════════════════════════════════
// CONTEXTUAL HELP MODAL
// Role-aware: shows the most relevant guide first based on workspace tier.
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// USER ACCOUNT PANEL
// ══════════════════════════════════════════════════════════════════════════
/** @type {boolean} Whether workspace notifications are enabled for the current user. */
let _uaNotifEnabled = true;

/**
 * Opens the User Account panel overlay and populates it with the current workspace profile.
 * @returns {void}
 */
function openUserAccount() {
  const panel   = document.getElementById('user-account-panel');
  const overlay = document.getElementById('user-account-overlay');
  if (!panel || !overlay) return;
  overlay.style.display = 'block';
  panel.style.display   = 'flex';
  _uaPopulate();
}

/**
 * Closes the User Account panel and its overlay.
 * @returns {void}
 */
function closeUserAccount() {
  document.getElementById('user-account-panel').style.display   = 'none';
  document.getElementById('user-account-overlay').style.display = 'none';
}

/**
 * Populates the User Account panel DOM with data from `workspaceProfile` and `currentWorkspace`.
 * Fetches additional fields (name, email, institution) from the Firebase `workspaces/` node.
 * Also syncs the theme and notification toggle states.
 * @returns {void}
 */
function _uaPopulate() {
  const p   = workspaceProfile || {};
  const key = currentWorkspace || '';

  // Initials
  const name     = p.name || '';
  const initials = name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('') || key.slice(0, 2);
  document.getElementById('ua-initials').textContent       = initials;
  document.getElementById('user-avatar-initials').textContent = initials;

  // Saved avatar
  const saved = localStorage.getItem('ua_avatar_' + key);
  ['ua-avatar-img','user-avatar-img'].forEach((id, i) => {
    const img = document.getElementById(id);
    const span = document.getElementById(i === 0 ? 'ua-initials' : 'user-avatar-initials');
    if (saved) { img.src = saved; img.style.display = ''; if (span) span.style.display = 'none'; }
    else        { img.style.display = 'none'; if (span) span.style.display = ''; }
  });

  // Identity
  document.getElementById('ua-display-name').textContent = name || '—';
  const roleLabel = { pi:'Principal Investigator', researcher:'Researcher', student:'Student', pharmacist:'PharmD · Pharmacist', np:'Nurse Practitioner', pa:'Physician Assistant', rn:'Registered Nurse', md:'Physician (MD/DO)', care_coordinator:'Care Coordinator', clinician:'Clinician', institution:'Institution Admin', observer:'Observer', superadmin:'Superadmin', independent:'Independent' };
  document.getElementById('ua-display-role').textContent = roleLabel[p.role] || (p.role || '—');
  document.getElementById('ua-display-key').textContent  = key || '—';
  document.getElementById('ua-plan-key').textContent     = key || '—';

  // Fields — seed priority: SSM → localStorage (user-saved) → Firebase node (admin-set)
  const _lsEmail = key ? (localStorage.getItem('atlas_email_' + key) || '') : '';
  const _lsInst  = key ? (localStorage.getItem('atlas_inst_'  + key) || '') : '';
  document.getElementById('ua-name').value        = name;
  document.getElementById('ua-email').value       = p.email || _lsEmail || '';
  document.getElementById('ua-institution').value = p.institution || _lsInst || '';
  if (key) {
    database.ref('workspaces/' + key).once('value').catch(() => null).then(snap => {
      const d = snap && snap.val() || {};
      if (d.name) { document.getElementById('ua-name').value = d.name; document.getElementById('ua-display-name').textContent = d.name; if (workspaceProfile) workspaceProfile.name = d.name; }
      // Email: admin-set in Firebase wins over localStorage; localStorage wins over blank
      const emailDisplay = d.email || _lsEmail || '';
      if (emailDisplay) { document.getElementById('ua-email').value = emailDisplay; if (workspaceProfile) workspaceProfile.email = emailDisplay; }
      // Institution: resolved name → admin text → localStorage → parent key (last resort)
      const instDisplay = d.parent_institution_name || d.institution || _lsInst
        || (workspaceProfile && workspaceProfile.institution)
        || (workspaceProfile && workspaceProfile.parent_institution) || '';
      if (instDisplay) { document.getElementById('ua-institution').value = instDisplay; if (workspaceProfile) workspaceProfile.institution = instDisplay; }
    });
  }

  // Subscription
  const planNames = { student:'Student · $19/mo', pharmacist:'Clinician · $49/mo', researcher:'Clinician · $49/mo', pi:'Investigator · $149/mo', institution:'Institution · $499/mo', observer:'Observer · $19/mo', superadmin:'Superadmin', independent:'Independent' };
  document.getElementById('ua-plan-badge').textContent  = planNames[p.role] || (p.role || 'Unknown');
  const expiry = p.subscription_end ? new Date(p.subscription_end).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : (p.role === 'superadmin' ? 'Unlimited' : 'No expiry set');
  document.getElementById('ua-plan-renews').textContent = expiry;

  // Theme knob sync
  _uaSyncThemeKnob();

  // Notif preference from localStorage
  _uaNotifEnabled = localStorage.getItem('ua_notif_' + key) !== 'false';
  _uaSyncNotifKnob();
}

/**
 * Syncs the theme toggle knob position and colors to the current `light-mode` body class state.
 * @returns {void}
 */
function _uaSyncThemeKnob() {
  const knob   = document.getElementById('ua-theme-knob');
  const sw     = document.getElementById('ua-theme-switch');
  const isDark = !document.body.classList.contains('light-mode');
  if (knob) { knob.style.transform = isDark ? '' : 'translateX(20px)'; knob.textContent = isDark ? '☾' : '☀'; }
  if (sw)   { sw.style.background = isDark ? 'rgba(139,111,245,0.15)' : 'rgba(212,168,67,0.15)'; sw.style.borderColor = isDark ? 'rgba(139,111,245,0.35)' : 'rgba(212,168,67,0.35)'; }
}

/**
 * Toggles the workspace notification preference and persists it to `localStorage`.
 * @returns {void}
 */
function _uaToggleNotif() {
  _uaNotifEnabled = !_uaNotifEnabled;
  localStorage.setItem('ua_notif_' + (currentWorkspace || ''), _uaNotifEnabled ? 'true' : 'false');
  _uaSyncNotifKnob();
}

/**
 * Syncs the notification toggle knob position and colors to the current `_uaNotifEnabled` state.
 * @returns {void}
 */
function _uaSyncNotifKnob() {
  const knob = document.getElementById('ua-notif-knob');
  const sw   = document.getElementById('ua-notif-toggle');
  if (knob) knob.style.transform = _uaNotifEnabled ? '' : 'translateX(-20px)';
  if (sw)   { sw.style.background = _uaNotifEnabled ? 'rgba(46,201,138,0.15)' : 'rgba(255,255,255,0.05)'; sw.style.borderColor = _uaNotifEnabled ? 'rgba(46,201,138,0.35)' : 'var(--border2)'; }
}

function _uaHandleAvatarUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    localStorage.setItem('ua_avatar_' + (currentWorkspace || ''), data);
    ['ua-avatar-img','user-avatar-img'].forEach((id, i) => {
      const img  = document.getElementById(id);
      const span = document.getElementById(i === 0 ? 'ua-initials' : 'user-avatar-initials');
      if (img)  { img.src = data; img.style.display = ''; }
      if (span) span.style.display = 'none';
    });
    showToast('Profile picture updated.', 2500);
  };
  reader.readAsDataURL(file);
}

async function _uaSaveProfile() {
  const name        = (document.getElementById('ua-name')?.value        || '').trim();
  const email       = (document.getElementById('ua-email')?.value       || '').trim();
  const institution = (document.getElementById('ua-institution')?.value || '').trim();
  const msgEl = document.getElementById('ua-profile-msg');
  const show  = (msg, ok) => { if (msgEl) { msgEl.textContent = msg; msgEl.style.display = ''; msgEl.style.background = ok ? 'rgba(46,201,138,0.08)' : 'rgba(255,107,107,0.08)'; msgEl.style.color = ok ? 'var(--strata)' : '#ff6b6b'; } };

  if (!name) return show('Name cannot be empty.', false);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('Enter a valid email.', false);

  // Update display immediately
  document.getElementById('ua-display-name').textContent = name;
  const initials = name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
  if (!localStorage.getItem('ua_avatar_' + (currentWorkspace || ''))) {
    document.getElementById('ua-initials').textContent          = initials;
    document.getElementById('user-avatar-initials').textContent = initials;
  }
  if (workspaceProfile) { workspaceProfile.name = name; workspaceProfile.email = email; workspaceProfile.institution = institution; }

  // Persist email and institution to localStorage (Firebase write is admin-only)
  // workspaceProfile + sessionStorage keep changes alive for this session
  if (currentWorkspace) {
    localStorage.setItem('atlas_email_' + currentWorkspace, email);
    localStorage.setItem('atlas_inst_'  + currentWorkspace, institution);
  }
  if (workspaceProfile) {
    workspaceProfile.email       = email;
    workspaceProfile.institution = institution;
    try { sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(workspaceProfile)); } catch(e) {}
  }
  // Update student workspace banner immediately so it reflects the saved institution
  const _stuBannerInst = document.getElementById('stu-header-inst');
  if (_stuBannerInst && institution) {
    _stuBannerInst.textContent = '🏛 ' + institution;
    _stuBannerInst.style.display = 'block';
  }

  // Firebase auth email update (best-effort)
  try {
    const user = firebase.auth().currentUser;
    if (user && email !== user.email) await user.updateEmail(email);
  } catch(e) { /* email update requires recent login — silent fail */ }

  show('Profile saved.', true);
  setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
}

async function _uaSendPasswordReset() {
  const msgEl = document.getElementById('ua-security-msg');
  const email = workspaceProfile?.email || firebase.auth().currentUser?.email || '';
  if (!email) { if (msgEl) { msgEl.textContent = 'No email on file.'; msgEl.style.display = ''; msgEl.style.color = '#ff6b6b'; } return; }
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    if (msgEl) { msgEl.textContent = `Reset link sent to ${email}`; msgEl.style.display = ''; msgEl.style.color = 'var(--strata)'; }
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 5000);
  } catch(e) {
    if (msgEl) { msgEl.textContent = e.message; msgEl.style.display = ''; msgEl.style.color = '#ff6b6b'; }
  }
}

function _uaCopyKey() {
  const key = currentWorkspace || '';
  if (!key) return;
  navigator.clipboard.writeText(key).then(() => showToast('Workspace key copied.', 2000)).catch(() => {});
}

function _uaCancelSubscription() {
  const email   = workspaceProfile?.email || '';
  const key     = currentWorkspace || '';
  const subject = encodeURIComponent(`Cancel Subscription — ${key}`);
  const body    = encodeURIComponent(`Hi,\n\nPlease cancel my ATLAS subscription.\n\nWorkspace Key: ${key}\nEmail: ${email}\n\nThank you.`);
  window.open(`mailto:billing@adherence.cc?subject=${subject}&body=${body}`, '_blank');
}

function _uaExportData() {
  closeUserAccount();
  showToast('Scroll to Export Data in your dashboard to download your cohort CSV.', 4000);
}

function openHelpModal() {
  const modal = document.getElementById('help-modal');
  if (!modal) return;

  // Build role-aware primary guide card
  const role  = workspaceProfile?.role || window._wsMode || 'researcher';
  const primary = document.getElementById('help-primary-guide');
  if (primary) {
    const roleMap = {
      student:     { url:'https://docs.adherence.cc/student-guide',      label:'Student Guide',                color:'#2ec98a', desc:'Your step-by-step walkthrough — from entering your workspace key to submitting your first assessment and exporting data for your thesis.' },
      pharmacist:  { url:'https://docs.adherence.cc/pharmacist-guide',   label:'Pharmacist Guide',              color:'#10b981', desc:'Clinical reference for community pharmacists — daily intake, ZOE voice assessments, MTM session timer (CPT 99605–99607), follow-up queue, Sentinel alerts, Medi-Cal audit log, and CSV/PDF export.' },
      researcher:  { url:'https://docs.adherence.cc/pharmacist-guide',   label:'Researcher Guide',              color:'#8b6ff5', desc:'Full guide covering cohort management, longitudinal tracking, ZOE voice assessments, IRB-grade export, Sentinel alerts, and statistical analytics.' },
      pi:          { url:'https://docs.adherence.cc/pi-sop',             label:'PI Governance SOP',         color:'#d4a843', desc:'Multi-site governance document covering site setup, role assignments, IRB export formats, and escalation protocols.' },
      institution: { url:'https://docs.adherence.cc/institution-runbook',label:'Institution Runbook',       color:'#4e9cf5', desc:'Operational procedures for the Population Health Command Center — Sentinel triage, adding sites, reading the dashboards.' },
      superadmin:  { url:'https://docs.adherence.cc',                    label:'Full Documentation Library', color:'#d4a843', desc:'All guides, release notes, API reference, and instrument citations.' },
      explorer:    { url:'https://docs.adherence.cc/student-guide',      label:'Getting Started',           color:'#2ec98a', desc:'New to ATLAS? The Student Guide is the best starting point — it walks through every feature from scratch.' },
    };
    const p = roleMap[role] || roleMap.researcher;
    primary.innerHTML =
      '<a href="' + p.url + '" target="_blank" style="display:block;padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-left:3px solid ' + p.color + ';border-radius:10px;text-decoration:none;transition:all 0.2s;margin-bottom:4px;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.03)\'">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">Your Guide</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;letter-spacing:0.08em;color:' + p.color + ';margin-bottom:6px;">' + p.label + ' →</div>' +
        '<div style="font-size:0.80rem;color:var(--muted);line-height:1.6;">' + p.desc + '</div>' +
      '</a>';
  }

  openModal(modal, { label: 'Documentation & Guides', onEscape: closeHelpModal });
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  closeModal(modal);
}

function showKeyTierPanel() {
  // Go directly to keys portal — eliminates the intermediate plan selection page
  window.open('https://keys.adherence.cc', '_blank');
}

// ── My Studies panel ─────────────────────────────────────────────────────────

function mspSwitchTab(tab) {
  ['licensing','registry'].forEach(t => {
    const btn   = document.getElementById('msp-tab-' + t);
    const panel = document.getElementById('msp-panel-' + t);
    const active = t === tab;
    if (btn) {
      btn.style.background   = active ? 'rgba(212,168,67,0.1)'   : 'transparent';
      btn.style.borderColor  = active ? 'rgba(212,168,67,0.3)'   : 'var(--border)';
      btn.style.color        = active ? 'var(--pe)'              : 'var(--dim)';
    }
    if (panel) panel.style.display = active ? '' : 'none';
  });
  if (tab === 'registry') _mspLoadRegistryStudies();
}

function openMyStudiesPanel() {
  const modal = document.getElementById('my-studies-modal');
  if (!modal) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  // Populate account holder name in disclaimer
  const accountName = workspaceProfile?.name || currentWorkspace || 'the registered account holder';
  const nameEl  = document.getElementById('add-study-account-name');
  const nameEl2 = document.getElementById('add-study-confirm-name');
  if (nameEl)  nameEl.textContent  = accountName;
  if (nameEl2) nameEl2.textContent = accountName;
  // Reset checkbox
  const cb = document.getElementById('add-study-confirm');
  if (cb) cb.checked = false;
  _renderMyStudies();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeMyStudiesPanel() {
  const modal = document.getElementById('my-studies-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('add-study-title').value = '';
  document.getElementById('add-study-use').value   = '';
  document.getElementById('add-study-status').textContent = '';
  const cb = document.getElementById('add-study-confirm');
  if (cb) cb.checked = false;
}

function _renderMyStudies() {
  const list = document.getElementById('my-studies-list');
  if (!list) return;
  const certNums = Array.isArray(workspaceProfile?.cert_nums) ? workspaceProfile.cert_nums
                 : (workspaceProfile?.cert_num ? [workspaceProfile.cert_num] : []);
  if (!certNums.length) {
    list.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);padding:12px 0;">No letters of permission on file yet. Add your first study below.</div>`;
    return;
  }
  list.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">Active Letters of Permission · ${certNums.length}</div>
    ${certNums.map((cert, i) => {
      const isFirst   = i === 0;
      const studyLabel = isFirst && workspaceProfile?.study_title ? workspaceProfile.study_title : `Study ${i + 1}`;
      const verifyUrl  = 'https://keys.adherence.cc/verify?cert=' + encodeURIComponent(cert);
      return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:0.88rem;color:var(--text);font-style:italic;margin-bottom:4px;">${studyLabel}</div>
          <div style="font-family:var(--font-mono);font-size:0.78rem;color:rgba(212,168,67,0.7);letter-spacing:0.05em;">${cert}</div>
        </div>
        <a href="${verifyUrl}" target="_blank" rel="noopener" style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--base);text-decoration:none;white-space:nowrap;padding:4px 10px;border:1px solid rgba(78,156,245,0.3);border-radius:5px;background:rgba(78,156,245,0.07);" onmouseover="this.style.background='rgba(78,156,245,0.14)'" onmouseout="this.style.background='rgba(78,156,245,0.07)'">Verify →</a>
      </div>`;
    }).join('')}`;
}

async function submitAddStudy() {
  const status     = document.getElementById('add-study-status');
  const studyTitle = document.getElementById('add-study-title').value.trim();
  const confirmed  = document.getElementById('add-study-confirm')?.checked;
  if (!studyTitle) {
    status.style.color = 'var(--poor)';
    status.textContent = 'Study title is required.';
    return;
  }
  if (!confirmed) {
    status.style.color = 'var(--poor)';
    status.textContent = 'You must confirm the account holder declaration before issuing a letter.';
    return;
  }
  const intendedUse = document.getElementById('add-study-use').value.trim();
  status.style.color = 'var(--muted)';
  status.textContent = 'Issuing letter…';
  try {
    const res  = await fetch(LAMBDA_URL + '/add-study', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: currentWorkspace, study_title: studyTitle, intended_use: intendedUse || null }),
    });
    const data = await res.json();
    if (data.cert_num) {
      // Update local profile so the list reflects the new cert immediately
      if (!Array.isArray(workspaceProfile.cert_nums)) {
        workspaceProfile.cert_nums = workspaceProfile.cert_num ? [workspaceProfile.cert_num] : [];
      }
      workspaceProfile.cert_nums.push(data.cert_num);
      sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(workspaceProfile));
      status.style.color = 'var(--strata)';
      status.textContent = '✓ Letter issued — check your email.';
      document.getElementById('add-study-title').value = '';
      document.getElementById('add-study-use').value   = '';
      _renderMyStudies();
    } else {
      status.style.color = 'var(--poor)';
      status.textContent = 'Error: ' + (data.error || 'Unknown error');
    }
  } catch(e) {
    status.style.color = 'var(--poor)';
    status.textContent = 'Error: ' + e.message;
  }
}

// ── ATLAS Study Registry (researcher / student / PI facing) ──────────────────

async function _mspLoadRegistryStudies() {
  const list = document.getElementById('msp-reg-list');
  if (!list) return;
  if (!currentWorkspace) {
    list.innerHTML = `<div style="font-size:0.84rem;color:var(--dim);">Sign in to a workspace to view or register studies.</div>`;
    return;
  }
  list.innerHTML = `<div style="font-size:0.84rem;color:var(--dim);">Loading…</div>`;
  try {
    const db = (typeof firebase !== 'undefined') ? firebase.database() : null;
    if (!db) throw new Error('no db');
    const snap = await db.ref('research_studies').once('value');
    const all  = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,_key:k})) : [];
    // Show studies linked to this workspace key, IRB, or PI name
    const pi = workspaceProfile?.name || '';
    const irb = studyConfig?.irb || '';
    const matched = all.filter(s =>
      s.workspace_key === currentWorkspace ||
      (irb && s.irb === irb) ||
      (pi  && s.pi  === pi)
    );
    _mspRenderRegistryStudies(matched, db);
  } catch(e) {
    if (list) list.innerHTML = `<div style="font-size:0.82rem;color:var(--dim);">Could not load registry.</div>`;
  }
}

function _mspRenderRegistryStudies(studies, db) {
  const list = document.getElementById('msp-reg-list');
  if (!list) return;

  if (!studies.length) {
    list.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:10px 0;">No registered studies yet. Use the form below to pre-register your first study and get an ATLAS Study ID.</div>`;
    return;
  }

  const statusCol = { planning:'rgba(156,163,175,0.8)', active:'var(--green)', analysis:'var(--blue)', published:'var(--pe)', closed:'rgba(239,68,68,0.5)' };

  list.innerHTML = studies.map(s => {
    const col  = statusCol[s.status] || 'rgba(156,163,175,0.7)';
    const conds = (s.conditions || (s.condition_focus ? [s.condition_focus] : [])).join(', ');
    return `
    <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-left:3px solid ${col};border-radius:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:0.90rem;font-weight:600;color:var(--bright);margin-bottom:2px;">${_escHtml(s.title||'Untitled')}</div>
          <div style="font-size:0.76rem;color:var(--muted);">${_escHtml(s.pi||'—')} · ${_escHtml(s.institution||'—')}</div>
        </div>
        <span style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border:1px solid ${col};border-radius:3px;color:${col};white-space:nowrap;">${s.status||'—'}</span>
      </div>

      ${s.atlas_id ? `
      <div style="padding:10px 14px;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:7px;margin-bottom:8px;cursor:pointer;"
        onclick="navigator.clipboard?.writeText('${_escHtml(s.atlas_id)}').then(()=>{const t=document.getElementById('msp-reg-status');if(t){t.style.color='var(--green)';t.textContent='ATLAS ID copied';setTimeout(()=>t.textContent='',2000);}})"
        title="Click to copy ATLAS Study ID">
        <div style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(212,168,67,0.5);margin-bottom:3px;">ATLAS Study ID — share with participants ⧉</div>
        <div style="font-family:var(--font-mono);font-size:1.05rem;font-weight:700;color:var(--pe);letter-spacing:0.06em;">${_escHtml(s.atlas_id)}</div>
      </div>` : ''}

      <div style="display:flex;gap:14px;font-size:0.74rem;color:var(--dim);flex-wrap:wrap;">
        ${s.irb ? `<span>IRB: ${_escHtml(s.irb)}</span>` : ''}
        ${s.target_n ? `<span>Target n: ${s.target_n}</span>` : ''}
        ${conds ? `<span>Condition: ${_escHtml(conds)}</span>` : ''}
        ${s.prereg_locked_at ? `<span style="color:var(--green);">✓ Pre-registered ${new Date(s.prereg_locked_at).toLocaleDateString()}</span>` : `<span style="color:rgba(249,115,22,0.8);">Not yet activated</span>`}
      </div>
    </div>`;
  }).join('');
}

// Simple HTML escaper for inline string contexts
function _escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function mspSubmitRegistration() {
  const status = document.getElementById('msp-reg-status');
  const title  = (document.getElementById('msp-reg-title')?.value||'').trim();
  if (!title) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Study title is required.'; }
    return;
  }
  const irb   = (document.getElementById('msp-reg-irb')?.value||'').trim();
  const n     = parseInt(document.getElementById('msp-reg-n')?.value||'0')||null;
  const cond  = (document.getElementById('msp-reg-cond')?.value||'').trim();
  const hyp   = (document.getElementById('msp-reg-hypothesis')?.value||'').trim();
  const insts = ['mmas','map','peacs'].filter(i=>document.getElementById('msp-reg-'+i)?.checked);

  // Generate ATLAS ID
  const year   = new Date().getFullYear();
  const seq    = String(Math.floor(Math.random()*9000)+1000);
  const atlasId= `ATLAS-${year}-${seq}`;

  const study = {
    title,
    pi:           workspaceProfile?.name || '',
    institution:  workspaceProfile?.institution || '',
    irb,
    target_n:     n,
    conditions:   cond ? cond.split(',').map(s=>s.trim()).filter(Boolean) : [],
    hypothesis:   hyp,
    instruments:  insts,
    status:       'planning',
    atlas_id:     atlasId,
    workspace_key: currentWorkspace || null,
    created:      Date.now(),
    prereg_locked_at: null,
  };

  if (status) { status.style.color='var(--muted)'; status.textContent='Registering…'; }
  try {
    const db = (typeof firebase !== 'undefined') ? firebase.database() : null;
    if (!db) throw new Error('no db');
    await db.ref('research_studies').push(study);
    if (status) { status.style.color='var(--green)'; status.textContent=`✓ Registered · ID: ${atlasId}`; }
    // Clear form
    ['msp-reg-title','msp-reg-irb','msp-reg-n','msp-reg-cond','msp-reg-hypothesis'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.value='';
    });
    ['msp-reg-mmas','msp-reg-map','msp-reg-peacs'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.checked=false;
    });
    _mspLoadRegistryStudies();
  } catch(e) {
    if (status) { status.style.color='var(--poor)'; status.textContent='Error: '+e.message; }
  }
}

// ── Onboarding Tour — shows once per browser on first login ──────────────────
const TOUR_KEY = 'atlas_tour_seen_v1';

function maybeShowOnboardingTour() {
  if (localStorage.getItem(TOUR_KEY)) return;
  const steps = _getTourSteps();
  if (!steps) return;
  _renderTourModal(steps, 0);
}

function _getTourSteps() {
  // Determine role — use existing role helpers
  if (typeof isStudentMode === 'function' && isStudentMode && isStudentMode())
    return _TOUR_STEPS.student;
  if (typeof isClinician === 'function' && isClinician())
    return _TOUR_STEPS.clinician;
  if (typeof isPIMode === 'function' && isPIMode())
    return _TOUR_STEPS.pi;
  if (typeof isInstitutionMode === 'function' && isInstitutionMode())
    return _TOUR_STEPS.institution;
  return _TOUR_STEPS.default;
}

const _TOUR_STEPS = {
  student: [
    { icon: '🎓', title: 'Welcome to ATLAS — Your Research Hub', body: 'Your workspace tracks every assessment you collect. Start by entering your Study Key on the login screen.' },
    { icon: '📋', title: 'Collect Assessments', body: 'Use the QR code in your workspace to let patients self-administer the MAP instrument. Each submission is scored by PEACS in real time — you\'ll see the patient\'s phenotype classification (INA / UNA / PA / A) appear instantly in your records table.' },
    { icon: '📊', title: 'Validate Your Data', body: 'Head to the Psychometrics tab to run Cronbach\'s Alpha and reliability checks — publication-ready statistics, built in.' },
    { icon: '🔬', title: 'MAP Phenotype Classification', body: 'MAP classifies each patient into one of four behavioral profiles: Intentional Non-Adherent (INA), Unintentional Non-Adherent (UNA), Partially Adherent (PA), or Adherent (A). Each phenotype tells you the WHY behind the score — critical for your thesis discussion.' },
    { icon: '📤', title: 'Export & Publish', body: 'When your study is complete, use the Publish tab to get your Letter of Permission. The Publication License covers your thesis committee and any peer-reviewed journal submission.' },
  ],
  clinician: [
    { icon: '🏥', title: 'Welcome — Your Patient Monitor', body: 'Your dashboard shows every patient\'s adherence score in real time. Red rows need your attention first.' },
    { icon: '🔔', title: 'Use Sentinel Alerts', body: 'ATLAS flags patients who drop below medium adherence. Click any alert to open the patient\'s full history and escalation workflow.' },
    { icon: '💊', title: 'Bill with MTM Timers', body: 'The MTM/CCM billing panel auto-tracks your counseling minutes and suggests the correct CPT code. Find it in the Billing tab.' },
    { icon: '🧬', title: 'MAP Phenotype Guides Your Intervention', body: 'INA patients need motivational engagement — avoid information overload. UNA patients need habit cues and reminders. PA patients need consolidation coaching. The ZOE SOAP AI note adapts its language to your patient\'s phenotype automatically.' },
    { icon: '📊', title: 'PE Domain Analysis', body: 'The PEACS engine scores three domains: Architecture (30-day behavioral pattern), Execution (7-day consistency), and Context (90-day life factors). Use the PE Triangle to identify which domain is limiting adherence.' },
  ],
  pi: [
    { icon: '🔬', title: 'Welcome — Research Command Center', body: 'Your workspace aggregates data across all sites and studies. The dashboard updates in real time as assessments come in.' },
    { icon: '📁', title: 'Manage Your Studies', body: 'Use the Research Hub tab to track enrollment, completion rates, and grant reporting across all active studies.' },
    { icon: '📤', title: 'Export & Analyze', body: 'Export full datasets with variable labels to CSV or Excel. Run psychometric validation under the Analytics tab.' },
    { icon: '🧬', title: 'MAP Phenotype Distribution', body: 'Your cross-site dashboard shows the phenotype distribution of your cohort — what proportion are INA vs UNA vs PA vs A. This is your behavioral landscape and the core finding for most adherence intervention studies.' },
    { icon: '✅', title: 'Validation Suite', body: 'Run MAP ↔ MMAS-8 paired scoring, Bland-Altman analysis, ICC, and AVE/HTMT construct validity directly in your PI workspace. All outputs are publication-ready with citation-formatted statistics.' },
  ],
  institution: [
    { icon: '🏛️', title: 'Welcome — Institution Command Center', body: 'You have visibility across all child workspaces. The command center shows population-level adherence in real time.' },
    { icon: '📍', title: 'Monitor Your Sites', body: 'Each site appears as a card. Drill down to see site-level adherence rates, sentinel alerts, and intervention activity.' },
    { icon: '⚙️', title: 'Configure Your Platform', body: 'Use ATLAS Control to provision workspace keys, manage campaigns, and configure institution settings.' },
    { icon: '🚨', title: 'Care Gap Monitor', body: 'The Care Gap Monitor flags patients who are overdue for MAP reassessment or whose phenotype has deteriorated. Sentinel escalation triggers automatically when a patient moves from PA/A to INA/UNA.' },
    { icon: '💰', title: 'MTM Billing Integration', body: 'Every MAP assessment generates a structured MTM encounter record with suggested CPT codes (99605, 99606, 99607). The billing log tracks counseling minutes and exports directly to your billing system.' },
  ],
  default: [
    { icon: '🗺️', title: 'Welcome to ATLAS', body: 'You\'re connected to the Adherence Cartography platform. Your role determines which features are visible to you.' },
    { icon: '🧭', title: 'Navigation', body: 'Use the tabs across the top of your dashboard to move between features. The ? button in the header opens full documentation.' },
    { icon: '🚀', title: 'Get Started', body: 'Check Documentation & Guides under the Help button for role-specific walkthroughs and quick-reference cards.' },
  ],
};

function _renderTourModal(steps, idx) {
  const existing = document.getElementById('atlas-tour-modal');
  if (existing) existing.remove();

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const dots = steps.map((_, i) =>
    `<span style="width:7px;height:7px;border-radius:50%;background:${i===idx?'var(--base)':'rgba(255,255,255,0.2)'};display:inline-block;"></span>`
  ).join('');

  const el = document.createElement('div');
  el.id = 'atlas-tour-modal';
  el.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(2,6,18,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;';
  el.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-top:2px solid var(--base);border-radius:var(--rl);max-width:480px;width:100%;padding:36px;text-align:center;position:relative;">
      <div style="font-size:2.4rem;margin-bottom:16px;">${step.icon}</div>
      <div style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--base);margin-bottom:8px;">STEP ${idx+1} OF ${steps.length}</div>
      <h2 style="font-family:var(--font-display);font-size:1.45rem;font-weight:300;color:var(--bright);margin-bottom:12px;line-height:1.3;">${step.title}</h2>
      <p style="font-size:0.85rem;color:var(--muted);line-height:1.7;margin-bottom:28px;">${step.body}</p>
      <div style="display:flex;gap:6px;justify-content:center;margin-bottom:24px;">${dots}</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        ${idx > 0 ? `<button onclick="_tourNav(${idx-1})" style="font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid var(--border2);color:var(--muted);padding:9px 20px;border-radius:8px;cursor:pointer;">← Back</button>` : ''}
        <button onclick="dismissTour()" style="font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:none;color:var(--dim);padding:9px 16px;border-radius:8px;cursor:pointer;">Skip</button>
        <button onclick="${isLast ? 'dismissTour()' : `_tourNav(${idx+1})`}" style="font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;background:var(--base);border:none;color:#fff;padding:9px 24px;border-radius:8px;cursor:pointer;">${isLast ? 'Get Started →' : 'Next →'}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}

function _tourNav(idx) {
  const steps = _getTourSteps();
  _renderTourModal(steps, idx);
}

function dismissTour() {
  localStorage.setItem(TOUR_KEY, '1');
  const el = document.getElementById('atlas-tour-modal');
  if (el) el.remove();
}

/**
 * Handles GDPR Art. 17 / CCPA data deletion requests from the My Account panel.
 * Writes a deletion record to Firebase /deletion_requests/{wsKey} and disables the button.
 */
async function _uaRequestDeletion() {
  const btn    = document.getElementById('ua-deletion-btn');
  const status = document.getElementById('ua-deletion-status');
  const wsKey  = window._wsKey || window._workspaceKey
    || (typeof currentWorkspaceKey !== 'undefined' ? currentWorkspaceKey : null);

  if (!status) return;

  const confirmed = window.confirm(
    'Request permanent deletion of all ATLAS data linked to your workspace key?\n\n' +
    'This includes all assessment records, PEACS profiles, and cohort data. ' +
    'This cannot be undone. Processed within 30 days.\n\nContinue?'
  );
  if (!confirmed) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    const db  = firebase.database();
    const ref = wsKey ? ('deletion_requests/' + wsKey) : ('deletion_requests/anon_' + Date.now());
    await db.ref(ref).set({
      requested_at:  firebase.database.ServerValue.TIMESTAMP,
      workspace_key: wsKey || null,
      role:          window._wsRole  || null,
      status:        'pending',
      source:        'user_account_panel'
    });
    status.style.display = 'block';
    status.innerHTML = '✓ Deletion request submitted. Confirmation will be sent to your registered email within 30 days. Reference key: <strong>' + (wsKey || 'anonymous') + '</strong>';
    if (btn) { btn.textContent = 'Request Submitted'; }
    if (typeof showToast === 'function') showToast('Data deletion request logged. We\'ll contact you within 30 days.', 5000);
  } catch (err) {
    status.style.display = 'block';
    status.textContent   = '⚠ Submission failed. Email privacy@adherence.cc with subject "Data Deletion Request — ' + (wsKey || 'unknown') + '".';
    if (btn) { btn.disabled = false; btn.textContent = '⚠ Request Data Deletion'; }
  }
}
