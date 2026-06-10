// ══════════════════════════════════════════════════════════════════════════════
// HELP / SOP SECTION
// ══════════════════════════════════════════════════════════════════════════════
/** Expands the first help chapter on initial load if none are already open. @returns {void} */
function accLoadHelp() {
  // Expand the first chapter on first load if none are open
  const chapters = document.querySelectorAll('.help-ch-header');
  const anyOpen = [...chapters].some(h => h.classList.contains('open'));
  if (!anyOpen && chapters[0]) accHelpToggle(chapters[0]);
}

/**
 * Toggles a help chapter open or closed.
 * @param {HTMLElement} header - The chapter header element with class .help-ch-header
 * @returns {void}
 */
function accHelpToggle(header) {
  const isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  const body = header.nextElementSibling;
  if (body) body.classList.toggle('open', !isOpen);
}

/**
 * Filters help chapters by a search term, matching against title, body text, and data-tags.
 * Auto-opens matched chapters when the query is longer than one character.
 * @param {string} q - Search query string
 * @returns {void}
 */
function accHelpSearch(q) {
  const term = q.trim().toLowerCase();
  document.querySelectorAll('.help-chapter').forEach(ch => {
    if (!term) { ch.classList.remove('help-hidden'); return; }
    const tags  = (ch.dataset.tags || '').toLowerCase();
    const title = (ch.querySelector('.help-ch-title')?.textContent || '').toLowerCase();
    const body  = (ch.querySelector('.help-ch-body')?.textContent || '').toLowerCase();
    const match = tags.includes(term) || title.includes(term) || body.includes(term);
    ch.classList.toggle('help-hidden', !match);
    // Auto-open matched chapters when searching
    if (match && term.length > 1) {
      const h = ch.querySelector('.help-ch-header');
      const b = ch.querySelector('.help-ch-body');
      if (h && b) { h.classList.add('open'); b.classList.add('open'); }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// EASTER EGGS
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Konami Code → Mission Control ────────────────────────────────────────
(function() {
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let _kPos = 0;
  document.addEventListener('keydown', function(e) {
    if (!document.getElementById('sa-overlay')) { _kPos=0; return; }
    const key = e.key;
    if (key === KONAMI[_kPos]) {
      _kPos++;
      if (_kPos === KONAMI.length) { _kPos = 0; _accMissionControl(); }
    } else {
      _kPos = (key === KONAMI[0]) ? 1 : 0;
    }
  });
})();

function _accMissionControl() {
  if (document.getElementById('acc-mission-control')) return;
  // Gather live stats
  const keysN    = (window._kmAllKeys || []).filter(k => k.active !== false).length;
  const mmasEl   = document.getElementById('an-total-assessments');
  const peacsEl  = document.getElementById('an-total-peacs');
  const mmasN    = mmasEl?.textContent || '—';
  const peacsN   = peacsEl?.textContent || '—';
  const countriesEl = document.getElementById('acc-ov-countries');
  const countriesN  = countriesEl?.textContent || '—';

  const mc = document.createElement('div');
  mc.id = 'acc-mission-control';
  mc.innerHTML = `
    <div class="mc-eyebrow">Adherence Cartography · Mission Control</div>
    <div class="mc-title">ATLAS is Live</div>
    <div class="mc-grid">
      <div class="mc-stat"><div class="mc-stat-n">${keysN || '—'}</div><div class="mc-stat-l">Active Keys</div></div>
      <div class="mc-stat"><div class="mc-stat-n">${mmasN}</div><div class="mc-stat-l">MMAS-8 Records</div></div>
      <div class="mc-stat"><div class="mc-stat-n">${peacsN}</div><div class="mc-stat-l">PEACS Records</div></div>
      <div class="mc-stat"><div class="mc-stat-n">${countriesN}</div><div class="mc-stat-l">Countries</div></div>
    </div>
    <div class="mc-dismiss">Press Esc or click anywhere to return</div>`;
  document.body.appendChild(mc);
  const close = () => mc.remove();
  mc.addEventListener('click', close);
  const escClose = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); } };
  document.addEventListener('keydown', escClose);
}

// ── 2. Phantom Keys — click "Key Management" title 5× ───────────────────────
(function() {
  let _pkClicks = 0, _pkTimer = null, _pkActive = false;
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.acc-section-title');
    if (!target || target.textContent.trim() !== 'Key Management') { _pkClicks = 0; return; }
    _pkClicks++;
    clearTimeout(_pkTimer);
    _pkTimer = setTimeout(() => { _pkClicks = 0; }, 1200);
    if (_pkClicks >= 5) {
      _pkClicks = 0;
      _pkActive = !_pkActive;
      _accPhantomKeys(_pkActive);
    }
  });
})();

function _accPhantomKeys(show) {
  if (show) {
    showToast('👻 Phantom Keys — revoked keys now visible (ghosted)', 3000);
    const allKeys = window._kmAllKeys || [];
    const revoked = allKeys.filter(k => k.active === false);
    if (!revoked.length) { showToast('No revoked keys on record.', 2000); return; }
    const tbody = document.querySelector('#km-keys-list table tbody');
    if (!tbody) return;
    const ROLE_COLORS = { superadmin:'var(--pe)', institution:'var(--mvmt)', researcher:'var(--base)', pi:'var(--base)', student:'var(--strata)', observer:'var(--muted)' };
    revoked.forEach(k => {
      const tr = document.createElement('tr');
      tr.className = '_phantom-key-row';
      tr.style.cssText = 'opacity:0.28;filter:saturate(0.3);';
      const col = ROLE_COLORS[k.role] || 'var(--muted)';
      const created = k.created_at ? new Date(k.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      tr.innerHTML = `<td style="color:${col};letter-spacing:0.1em;">${_esc(k.key)||'—'}</td><td style="color:var(--text);">${_esc(k.name)||'—'}</td><td style="color:var(--muted);">${_esc(k.institution)||'—'}</td><td><span style="color:var(--poor);border:1px solid rgba(239,68,68,0.3);padding:1px 6px;border-radius:3px;font-size:0.72rem;">${(k.role||'—').toUpperCase()}</span></td><td style="color:var(--poor);">Revoked</td><td style="color:var(--dim);">${created}</td><td>—</td>`;
      tbody.appendChild(tr);
    });
  } else {
    document.querySelectorAll('._phantom-key-row').forEach(r => r.remove());
    showToast('👻 Phantom Keys hidden', 1500);
  }
}

// ── 3. MMAR tribute — type "MMAR" in Keys search ────────────────────────────
(function() {
  document.addEventListener('input', function(e) {
    const el = e.target;
    if (el.id !== 'km-search' && el.id !== 'km-filter') return;
    if (el.value.toUpperCase() === 'MMAR') {
      showToast('🏆 Dr. Donald Morisky, PhD · Creator of the MMAS-8 · The work that made this platform possible.', 6000);
    }
  });
})();

// ── 4. Alt+Shift+D → Diagnostic dump ────────────────────────────────────────
// (handled in keyboard shortcuts block below)

// ── 5. Triple-click "Sources:" in Analytics diagnostic bar ──────────────────
(function() {
  let _srcClicks = 0, _srcTimer = null;
  document.addEventListener('click', function(e) {
    const el = e.target;
    if (!el.closest('#an-diag-bar') || !el.matches('span[style*="var(--muted)"]') && el.textContent.trim() !== 'Sources:') return;
    _srcClicks++;
    clearTimeout(_srcTimer);
    _srcTimer = setTimeout(() => { _srcClicks = 0; }, 900);
    if (_srcClicks >= 3) {
      _srcClicks = 0;
      _accDiagSizes();
    }
  });
})();

function _accDiagSizes() {
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) { showToast('Firebase not available.', 2000); return; }
  Promise.allSettled([
    db.ref('assessments').once('value'),
    db.ref('peacs_assessments').once('value'),
    db.ref('export_counts').once('value'),
  ]).then(([a, p, e]) => {
    const sz = snap => {
      if (snap.status !== 'fulfilled' || !snap.value.val()) return 'denied/empty';
      const json = JSON.stringify(snap.value.val());
      const kb = (new Blob([json]).size / 1024).toFixed(1);
      const n = Object.keys(snap.value.val()).length;
      return `${n} records · ${kb} KB`;
    };
    showToast(`📡 MMAS: ${sz(a)} · PEACS: ${sz(p)} · Exports: ${sz(e)}`, 7000);
  });
}

// ── 6. Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('sa-overlay')) return;
  // Esc closes Mission Control
  if (e.key === 'Escape' && !document.querySelector('.modal-open, [id$="-modal"]:not([style*="display: none"])')) {
    if (typeof _saClose === 'function') _saClose(); return;
  }
  if (!e.altKey || !e.shiftKey) return;
  const map = { K:'keys', A:'analytics', H:'help', S:'system', O:'overview', G:'gai' };
  if (map[e.key.toUpperCase()]) {
    e.preventDefault();
    if (typeof saTab === 'function') saTab(map[e.key.toUpperCase()]);
    return;
  }
  if (e.key.toUpperCase() === 'D') {
    e.preventDefault();
    _accDiagDump();
  }
});

function _accDiagDump() {
  const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
  const dump = {
    timestamp: new Date().toISOString(),
    firebase_uid: user?.uid || null,
    firebase_anonymous: user?.isAnonymous || null,
    current_workspace: typeof currentWorkspace !== 'undefined' ? currentWorkspace : null,
    workspace_profile: typeof workspaceProfile !== 'undefined' ? workspaceProfile : null,
    is_superadmin: typeof isSuperAdmin === 'function' ? isSuperAdmin() : null,
    loaded_keys_count: (window._kmAllKeys || []).length,
    active_keys_count: (window._kmAllKeys || []).filter(k => k.active !== false).length,
    current_acc_section: typeof _accCurrentSection !== 'undefined' ? _accCurrentSection : null,
    lambda_url: typeof LAMBDA_URL !== 'undefined' ? LAMBDA_URL : null,
  };
  console.group('%cATLAS Diagnostic Dump', 'color:#d4a843;font-family:monospace;font-size:14px;font-weight:bold;');
  console.log(JSON.stringify(dump, null, 2));
  console.groupEnd();
  showToast('🔧 Diagnostic dump written to browser console (F12 → Console)', 3500);
}

function accLoadSystem() {
  const buildEl=document.getElementById('acc-sys-build');
  if(buildEl){const meta=document.querySelector('meta[name="atlas-build"]');buildEl.textContent=meta?meta.content:'—';}
  accLoadEventConfig();
  accCheckAuthState();
}

function accCopyFirebaseRules() {
  // section removed — function kept as no-op to avoid errors from any cached references
  return;
}

async function accCheckAuthState() {
  const el = document.getElementById('acc-auth-state');
  const user = firebase.auth().currentUser;
  if (!user) {
    if(el) { el.textContent = 'Not authenticated — no Firebase user session.'; el.style.color='var(--poor)'; }
    return;
  }
  try {
    const result = await user.getIdTokenResult(true);
    const claims = result.claims;
    const role = claims.role || '(no role claim)';
    const uid = user.uid;
    if(el) {
      el.style.color = role === 'superadmin' ? 'var(--optimal)' : 'var(--pe)';
      el.textContent = `UID: ${uid.slice(0,12)}… · role: ${role} · ${role === 'superadmin' ? '✓ rules will allow writes' : '✗ Lambda must issue role:"superadmin" in custom token claims'}`;
    }
  } catch(e) {
    if(el) { el.textContent = 'Error reading token: ' + e.message; el.style.color='var(--poor)'; }
  }
}
function accLoadEventConfig() {
  const db=(typeof database!=='undefined')?database:null;
  if(!db) return;
  db.ref('/config/event').once('value',snap=>{
    const cfg=snap.val()||{};
    const n=document.getElementById('acc-sys-event-name');
    const s=document.getElementById('acc-sys-event-start');
    const e=document.getElementById('acc-sys-event-end');
    if(n) n.value=cfg.name||'';
    if(s) s.value=cfg.start||'';
    if(e) e.value=cfg.end||'';
  });
}
async function accSaveEventConfig() {
  const name=(document.getElementById('acc-sys-event-name')?.value||'').trim();
  const start=document.getElementById('acc-sys-event-start')?.value||'';
  const end=document.getElementById('acc-sys-event-end')?.value||'';
  const st=document.getElementById('acc-sys-event-status');
  if(!name||!start||!end){if(st){st.textContent='Name, start, and end required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent='Saving…';st.style.color='var(--muted)';}
  try{
    await database.ref('/config/event').set({name,start,end});
    if(st){st.textContent='Saved. Reload the app to activate.';st.style.color='var(--optimal)';}
  } catch(e) {
    if(st){st.textContent='Save failed: '+e.message;st.style.color='var(--poor)';}
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 — ANALYTICS — accLoadAnalytics()
//  Usage intelligence: key distribution, per-workspace volume,
//  export cap consumption, conversion signals.
// ══════════════════════════════════════════════════════════════════════════
function accLoadAnalytics() {
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;

  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Helper to update per-source diagnostic chips
  const diagSet = (id, ok, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? 'var(--optimal)' : 'var(--poor)';
  };

  // Reset diagnostics to "loading" state
  const diagLabels = { 'an-diag-keys':'Keys','an-diag-mmas':'MMAS','an-diag-peacs':'PEACS','an-diag-exp':'Exports' };
  Object.entries(diagLabels).forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = label + ': loading…'; el.style.color='var(--muted)'; }
  });

  const keysPromise = _accGetToken()
    .then(token => fetch(LAMBDA_URL + '/admin/list-keys', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    }).then(r => r.json()))
    .catch(e => { console.warn('[Analytics] Keys fetch failed:', e.message); return { keys: [], _err: e.message }; });

  // allSettled — a single failed read can't block the other three sources
  Promise.allSettled([
    keysPromise,
    db.ref('assessments').once('value'),
    db.ref('peacs_assessments').once('value'),
    db.ref('export_counts').once('value'),
  ]).then(([keysResult, aResult, pResult, ecResult]) => {

    // ── Update diagnostic chips ───────────────────────────────────────────
    const keysData  = keysResult.status === 'fulfilled' ? keysResult.value  : { keys: [], _err: keysResult.reason?.message };
    const aSnap     = aResult.status    === 'fulfilled' ? aResult.value     : null;
    const pSnap     = pResult.status    === 'fulfilled' ? pResult.value     : null;
    const ecSnap    = ecResult.status   === 'fulfilled' ? ecResult.value    : null;

    const keysOk   = keysResult.status === 'fulfilled' && !keysData._err;
    const aOk      = aResult.status    === 'fulfilled';
    const pOk      = pResult.status    === 'fulfilled';
    const ecOk     = ecResult.status   === 'fulfilled';

    const aErr  = !aOk  ? (aResult.reason?.message  || 'error') : null;
    const pErr  = !pOk  ? (pResult.reason?.message  || 'error') : null;
    const ecErr = !ecOk ? (ecResult.reason?.message || 'error') : null;

    const keysN = (keysData.keys || []).length;
    diagSet('an-diag-keys',  keysOk,  keysOk  ? `Keys: ${keysN} loaded`          : `Keys: ${keysData._err || 'failed'}`);
    diagSet('an-diag-mmas',  aOk,     aOk     ? `MMAS: ${aSnap?.val() ? Object.keys(aSnap.val()).length : 0} records` : `MMAS: ${aErr}`);
    diagSet('an-diag-peacs', pOk,     pOk     ? `PEACS: ${pSnap?.val() ? Object.keys(pSnap.val()).length : 0} records` : `PEACS: ${pErr}`);
    diagSet('an-diag-exp',   ecOk,    ecOk    ? `Exports: ${ecSnap?.val() ? Object.keys(ecSnap.val()).length : 0} keys` : `Exports: ${ecErr}`);

    // ── Resolve data (degrade gracefully per source) ──────────────────────
    const workspaces = {};
    (keysData.keys || []).forEach(k => { workspaces[k.key] = k; });

    const assessments  = aSnap?.val()  ? Object.values(aSnap.val())  : [];
    const peacs        = pSnap?.val()  ? Object.values(pSnap.val())  : [];
    const exportCounts = ecSnap?.val() || {};

    const wsKeys  = Object.keys(workspaces);
    const wsVals  = Object.values(workspaces);

    // ── Top-line stats ───────────────────────────────────────────────────
    const activeKeys = wsVals.filter(w => w.active !== false).length;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('an-total-keys',        activeKeys.toLocaleString());
    setVal('an-total-assessments', assessments.length.toLocaleString());
    setVal('an-total-peacs',       peacs.length.toLocaleString());

    // ── Tier distribution ─────────────────────────────────────────────────
    const roleCounts = {};
    wsVals.forEach(w => {
      const r = w.role || 'researcher';
      roleCounts[r] = (roleCounts[r] || 0) + 1;
    });
    const roleColors = {
      superadmin:  'rgba(212,168,67,0.8)',
      institution: 'rgba(139,111,245,0.8)',
      researcher:  'rgba(78,156,245,0.8)',
      student:     'rgba(46,201,138,0.8)',
      independent: 'rgba(100,116,139,0.8)',
    };
    const total = wsVals.length || 1;
    const tiersEl = document.getElementById('an-tier-bars');
    if (tiersEl) {
      tiersEl.innerHTML = Object.entries(roleCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([role, count]) => {
          const pct = Math.round((count / total) * 100);
          const col = roleColors[role] || 'rgba(255,255,255,0.4)';
          return `<div style="display:flex;align-items:center;gap:12px;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.08em;text-transform:uppercase;color:${col};min-width:110px;">${role}</div>
            <div style="flex:1;background:rgba(255,255,255,0.05);border-radius:3px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${col};border-radius:3px;transition:width 0.6s ease;"></div>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(255,255,255,0.5);min-width:48px;text-align:right;">${count} · ${pct}%</div>
          </div>`;
        }).join('');
    }

    // ── Per-workspace volume table ────────────────────────────────────────
    const mmasCounts = {}, peacsCounts = {}, lastSeen = {};
    assessments.forEach(r => {
      const code = (r.institution_code || '').toUpperCase();
      if (code) {
        mmasCounts[code] = (mmasCounts[code] || 0) + 1;
        if (r.timestamp) lastSeen[code] = Math.max(lastSeen[code] || 0, r.timestamp);
      }
    });
    peacs.forEach(r => {
      const code = (r.institution_code || '').toUpperCase();
      if (code) peacsCounts[code] = (peacsCounts[code] || 0) + 1;
    });

    const wsEntries = Object.entries(workspaces)
      .map(([key, ws]) => ({
        key,
        name:   ws.name || '—',
        role:   ws.role || 'researcher',
        mmas:   mmasCounts[key.toUpperCase()] || 0,
        peacs:  peacsCounts[key.toUpperCase()] || 0,
        last:   lastSeen[key.toUpperCase()] || 0,
        active: ws.active !== false,
      }))
      .filter(w => w.active)
      .sort((a, b) => b.mmas - a.mmas)
      .slice(0, 20);

    const tbody = document.getElementById('an-ws-tbody');
    if (tbody) {
      if (!wsEntries.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;">No workspace data yet.</td></tr>`;
      } else {
        const roleColors2 = { superadmin:'acc-badge-gold', institution:'acc-badge-gold', clinician:'acc-badge-teal', pharmacist:'acc-badge-teal', researcher:'acc-badge-blue', student:'acc-badge-green', independent:'' };
        tbody.innerHTML = wsEntries.map((w, i) => {
          const lastStr = w.last ? new Date(w.last).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
          const expUsed = (exportCounts[w.key] && exportCounts[w.key][monthKey]) ? exportCounts[w.key][monthKey] : 0;
          const shade = i % 2 === 1 ? `background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.02)')};` : '';
          return `<tr style="${shade}">
            <td style="padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:rgba(212,168,67,0.65);">${w.key}</td>
            <td style="padding:7px 10px;color:${tc('rgba(255,255,255,0.75)','rgba(0,0,0,0.78)')};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(w.name)}</td>
            <td style="padding:7px 10px;"><span class="acc-badge ${roleColors2[w.role] || ''}">${w.role}</span></td>
            <td style="padding:7px 10px;text-align:right;color:rgba(78,156,245,0.85);">${w.mmas.toLocaleString()}</td>
            <td style="padding:7px 10px;text-align:right;color:rgba(139,111,245,0.85);">${w.peacs.toLocaleString()}</td>
            <td style="padding:7px 10px;text-align:right;color:${expUsed > 40 ? 'rgba(239,68,68,0.8)' : tc('rgba(255,255,255,0.4)','rgba(0,0,0,0.45)')};">${expUsed}</td>
            <td style="padding:7px 10px;color:${tc('rgba(255,255,255,0.35)','rgba(0,0,0,0.45)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;">${lastStr}</td>
          </tr>`;
        }).join('');
      }
    }

    // ── Export cap usage ──────────────────────────────────────────────────
    const capsEl = document.getElementById('an-export-caps');
    if (capsEl) {
      const capEntries = Object.entries(exportCounts)
        .map(([key, months]) => ({ key, used: (months[monthKey] || 0) }))
        .filter(e => e.used > 0)
        .sort((a, b) => b.used - a.used);

      if (!capEntries.length) {
        capsEl.innerHTML = `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;">No exports recorded this month.</div>`;
      } else {
        capsEl.innerHTML = capEntries.map(e => {
          const pct  = Math.min(100, Math.round((e.used / 50) * 100));
          const warn = e.used >= 40;
          const col  = e.used >= 50 ? 'rgba(239,68,68,0.8)' : warn ? 'rgba(245,158,11,0.8)' : 'rgba(46,201,138,0.8)';
          return `<div style="display:flex;align-items:center;gap:12px;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${tc('rgba(255,255,255,0.5)','rgba(0,0,0,0.6)')};min-width:160px;">${_esc(e.key)}</div>
            <div style="flex:1;background:${tc('rgba(255,255,255,0.05)','rgba(0,0,0,0.08)')};border-radius:3px;height:6px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${col};border-radius:3px;"></div>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${col};min-width:60px;text-align:right;">${e.used} / 50</div>
          </div>`;
        }).join('');
      }
    }

    // ── Conversion signals ────────────────────────────────────────────────
    const keyedCodes = new Set(Object.keys(workspaces).map(k => k.toUpperCase()));
    const keyedAssessments  = assessments.filter(r => r.institution_code && keyedCodes.has((r.institution_code || '').toUpperCase()));
    const explorerAssessments = assessments.length - keyedAssessments.length;
    const instCount = wsVals.filter(w => w.role === 'institution').length;
    const avgPerKey = wsEntries.length ? Math.round(wsEntries.reduce((s, w) => s + w.mmas, 0) / wsEntries.length) : 0;

    setVal('an-explorer-pct', assessments.length ? Math.round((explorerAssessments / assessments.length) * 100) + '%' : '—');
    setVal('an-keyed-pct',    assessments.length ? Math.round((keyedAssessments.length / assessments.length) * 100) + '%' : '—');
    setVal('an-avg-per-key',  avgPerKey.toLocaleString());
    setVal('an-inst-keys',    instCount.toLocaleString());

  }).catch(e => {
    // allSettled shouldn't reach here — only fires if .then() callback itself throws
    console.error('Analytics render error:', e);
    ['an-diag-keys','an-diag-mmas','an-diag-peacs','an-diag-exp'].forEach(id => diagSet(id, false, 'render error: ' + e.message));
    const tbody = document.getElementById('an-ws-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--poor);font-family:'IBM Plex Mono',monospace;font-size:0.72rem;">Analytics render error: ${e.message}</td></tr>`;
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2 — GLOBAL ADHERENCE INDEX — accLoadGAI()
//  Aggregate population-level MMAS-8 data: score distribution,
//  country breakdown, condition map, INA/UNA/High classification,
//  PEACS global stats. The live source for the GAI commercial product.
// ══════════════════════════════════════════════════════════════════════════
function accLoadGAI() {
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;

  Promise.all([
    db.ref('assessments').once('value'),
    db.ref('peacs_assessments').once('value'),
  ]).then(([aSnap, pSnap]) => {

    const all   = aSnap.val() ? Object.values(aSnap.val()) : [];
    const peacs = pSnap.val() ? Object.values(pSnap.val()) : [];
    const valid = all.filter(r => r.score !== undefined && r.score !== null);

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    if (!valid.length) {
      setVal('gai-total', '0');
      setVal('gai-countries', '0');
      return;
    }

    // ── Top-line ──────────────────────────────────────────────────────────
    const countries = new Set(valid.map(r => r.country).filter(c => c && c !== 'Unknown'));
    const avg = (valid.reduce((s, r) => s + (r.score || 0), 0) / valid.length).toFixed(2);

    // INA/UNA/High — using standard MMAS-8 classification
    // INA: score < 6, UNA: score 6–7, High: score 8
    const ina  = valid.filter(r => r.score < 6).length;
    const una  = valid.filter(r => r.score >= 6 && r.score < 8).length;
    const high = valid.filter(r => r.score === 8).length;
    const n = valid.length;

    setVal('gai-total',    n.toLocaleString());
    setVal('gai-countries', countries.size.toLocaleString());
    setVal('gai-global-avg', avg);
    setVal('gai-ina-pct',  Math.round((ina  / n) * 100) + '%');
    setVal('gai-una-pct',  Math.round((una  / n) * 100) + '%');
    setVal('gai-high-pct', Math.round((high / n) * 100) + '%');

    // ── Score distribution bar chart ──────────────────────────────────────
    const scoreBuckets = Array(9).fill(0);
    valid.forEach(r => {
      const s = Math.round(r.score);
      if (s >= 0 && s <= 8) scoreBuckets[s]++;
    });
    const maxBucket = Math.max(...scoreBuckets, 1);
    const distEl = document.getElementById('gai-score-dist');
    const lblEl  = document.getElementById('gai-score-labels');
    if (distEl) {
      distEl.innerHTML = scoreBuckets.map((cnt, score) => {
        const h   = Math.round((cnt / maxBucket) * 110);
        const col = score === 8 ? 'var(--optimal)' : score >= 6 ? 'var(--moderate)' : 'var(--poor)';
        const pct = Math.round((cnt / n) * 100);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${tc('rgba(255,255,255,0.4)','rgba(0,0,0,0.55)')};">${pct}%</div>
          <div style="width:100%;background:${col};opacity:0.8;border-radius:3px 3px 0 0;height:${h}px;min-height:2px;transition:height 0.5s ease;" title="Score ${score}: ${cnt.toLocaleString()} records (${pct}%)"></div>
        </div>`;
      }).join('');
    }
    if (lblEl) {
      lblEl.innerHTML = scoreBuckets.map((_, score) =>
        `<div style="flex:1;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${tc('rgba(255,255,255,0.3)','rgba(0,0,0,0.45)')};">${score}</div>`
      ).join('');
    }

    // ── Country breakdown (+ PE domain aggregation) ───────────────────────
    const byCo = {};
    valid.forEach(r => {
      const co = (r.country && r.country !== 'Unknown') ? r.country : null;
      if (!co) return;
      if (!byCo[co]) byCo[co] = { n: 0, sum: 0, ina: 0, high: 0, peSum: 0, aSum: 0, eSum: 0, cSum: 0, peN: 0 };
      byCo[co].n++;
      byCo[co].sum += (r.score || 0);
      if (r.score < 6) byCo[co].ina++;
      if (r.score === 8) byCo[co].high++;
      // PE domain removed — PE applies to MAP only
    });

    const coEntries = Object.entries(byCo)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 25);

    const coTbody = document.getElementById('gai-country-tbody');
    if (coTbody) {
      coTbody.innerHTML = coEntries.map(([co, d], i) => {
        const coAvg   = (d.sum / d.n).toFixed(2);
        const inaPct  = Math.round((d.ina  / d.n) * 100);
        const highPct = Math.round((d.high / d.n) * 100);
        const band    = parseFloat(coAvg) >= 7 ? 'High' : parseFloat(coAvg) >= 5 ? 'Moderate' : 'Low';
        const bandCol = band === 'High' ? 'var(--optimal)' : band === 'Moderate' ? 'var(--moderate)' : 'var(--poor)';
        const shade   = i % 2 === 1 ? `background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.02)')};` : '';
        // PE columns removed from MMAS country table — PE is MAP-only
        const peCell = '';
        return `<tr style="${shade}">
          <td style="padding:7px 10px;color:${tc('rgba(255,255,255,0.8)','rgba(0,0,0,0.8)')};">${_esc(co)}</td>
          <td style="padding:7px 10px;text-align:right;color:rgba(78,156,245,0.8);">${d.n.toLocaleString()}</td>
          <td style="padding:7px 10px;text-align:right;color:var(--pe);">${coAvg}</td>
          <td style="padding:7px 10px;text-align:right;color:var(--poor);">${inaPct}%</td>
          <td style="padding:7px 10px;text-align:right;color:var(--optimal);">${highPct}%</td>
          ${peCell}
          <td style="padding:7px 10px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:0.51rem;color:${bandCol};">${band}</span></td>
        </tr>`;
      }).join('');
    }

    // ── MMAS-8 PE Domain Analysis removed — PE applies to MAP only ──────────
    if (false) {
      // Legacy MMAS PE block retained as dead code for data-model reference
      let gPeSum=0, gASum=0, gESum=0, gCSum=0, gPeN=0, gCntA=0, gCntE=0, gCntC=0;
      const peCountries = new Set();
      valid.forEach(r => {
        const _rpe = r.mmas_pe !== undefined
          ? { pe: r.mmas_pe, a: r.mmas_a, e: r.mmas_e, c: r.mmas_c }
          : (typeof computeMMASPE === 'function' ? computeMMASPE(r) : null);
        if (!_rpe) return;
        gPeSum += _rpe.pe; gASum += _rpe.a; gESum += _rpe.e; gCSum += _rpe.c; gPeN++;
        const minV = Math.min(_rpe.a, _rpe.e, _rpe.c);
        if (_rpe.a===minV) gCntA++; else if (_rpe.e===minV) gCntE++; else gCntC++;
        if (r.country && r.country !== 'Unknown') peCountries.add(r.country);
      });

      if (gPeN > 0) {
        const gAvgPE = gPeSum / gPeN;
        const gAvgA  = gASum  / gPeN;
        const gAvgE  = gESum  / gPeN;
        const gAvgC  = gCSum  / gPeN;
        const gConst = gAvgA<=gAvgE&&gAvgA<=gAvgC?'Architecture':gAvgE<=gAvgA&&gAvgE<=gAvgC?'Execution':'Context';
        const peColor = gAvgPE >= 0.75 ? 'var(--optimal)' : gAvgPE >= 0.5 ? '#f59e0b' : 'var(--poor)';
        const card = (val, lbl, col) => `<div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.8rem;color:${col};">${val}</div>
          <div class="acc-stat-lbl">${lbl}</div></div>`;
        const bar = (v, col, lbl) => `<div style="margin-bottom:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${col};display:flex;justify-content:space-between;margin-bottom:3px;"><span>${lbl}</span><span>${v.toFixed(3)}</span></div>
          <div style="height:7px;border-radius:3px;background:${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};overflow:hidden;">
            <div style="height:100%;width:${Math.round(v*100)}%;background:${col};border-radius:3px;transition:width 0.9s ease;"></div>
          </div></div>`;
        mmasPeEl.innerHTML =
          card(gAvgPE.toFixed(3), 'Global Avg MMAS PE', peColor) +
          card(gPeN.toLocaleString(), 'Records with Q-Level Data', tc('rgba(255,255,255,0.8)','rgba(0,0,0,0.8)')) +
          card(peCountries.size, 'Countries with PE Data', 'var(--strata)') +
          `<div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid rgba(212,168,67,0.15);border-radius:8px;padding:16px;grid-column:1/-1;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">Global Domain Averages &amp; Constraint Distribution</div>
            ${bar(gAvgA,'var(--base)','Architecture (A) · Q2,Q3,Q6 — Decisions &amp; Beliefs')}
            ${bar(gAvgE,'var(--mvmt)','Execution (E) · Q1,Q4,Q5,Q8 — Behavioral Reliability')}
            ${bar(gAvgC,'var(--strata)','Context (C) · Q7 — Burden &amp; Friction')}
            <div style="margin-top:10px;padding:8px 12px;background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:6px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--pe);display:flex;gap:16px;flex-wrap:wrap;">
              <span>◈ Global constraint: <strong>${gConst}</strong></span>
              <span style="color:var(--base);">A: ${Math.round(gCntA/gPeN*100)}%</span>
              <span style="color:var(--mvmt);">E: ${Math.round(gCntE/gPeN*100)}%</span>
              <span style="color:var(--strata);">C: ${Math.round(gCntC/gPeN*100)}%</span>
            </div>
          </div>`;

        // PE by country table
        const peCoEntries = Object.entries(byCo)
          .filter(([,d]) => d.peN >= 3)
          .sort((a,b) => b[1].peN - a[1].peN)
          .slice(0, 20);
        const peCoDivEl  = document.getElementById('gai-mmas-pe-country');
        const peCotbody  = document.getElementById('gai-mmas-pe-country-tbody');
        if (peCoDivEl) peCoDivEl.style.display = peCoEntries.length ? '' : 'none';
        if (peCotbody && peCoEntries.length) {
          peCotbody.innerHTML = peCoEntries.map(([co, d], i) => {
            const avgPE = d.peSum / d.peN;
            const avgA  = d.aSum  / d.peN;
            const avgE  = d.eSum  / d.peN;
            const avgC  = d.cSum  / d.peN;
            const minV  = Math.min(avgA, avgE, avgC);
            const lim   = avgA===minV ? 'A' : avgE===minV ? 'E' : 'C';
            const limC  = lim==='A'?'var(--base)':lim==='E'?'var(--mvmt)':'var(--strata)';
            const peCol = avgPE >= 0.75 ? 'var(--optimal)' : avgPE >= 0.5 ? '#f59e0b' : 'var(--poor)';
            const shade = i%2===1?`background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.02)')};`:'';
            return `<tr style="${shade}">
              <td style="padding:5px 8px;color:${tc('rgba(255,255,255,0.8)','rgba(0,0,0,0.8)')};">${co}</td>
              <td style="padding:5px 8px;text-align:right;font-weight:600;font-family:'IBM Plex Mono',monospace;color:${peCol};">${avgPE.toFixed(3)}</td>
              <td style="padding:5px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--base);">${avgA.toFixed(2)}</td>
              <td style="padding:5px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--mvmt);">${avgE.toFixed(2)}</td>
              <td style="padding:5px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--strata);">${avgC.toFixed(2)}</td>
              <td style="padding:5px 8px;text-align:center;"><span style="font-size:0.75rem;padding:1px 6px;border-radius:5px;background:${limC}18;color:${limC};border:1px solid ${limC}35;">${lim}</span></td>
              <td style="padding:5px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:${tc('rgba(255,255,255,0.4)','rgba(0,0,0,0.45)')};">${d.peN}</td>
            </tr>`;
          }).join('');
        }
      } else {
        mmasPeEl.innerHTML = `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;grid-column:1/-1;">No Q-level data yet — PE domain scores will appear as assessments with individual item responses accumulate.</div>`;
      }
    }

    // ── Condition breakdown ───────────────────────────────────────────────
    const condMap = {};
    valid.forEach(r => {
      const raw = r.condition || r.drug_condition || '';
      if (!raw) return;
      // Normalize: lowercase, trim, take first 40 chars
      const norm = raw.trim().toLowerCase().slice(0, 40);
      if (norm.length < 2) return;
      condMap[norm] = (condMap[norm] || 0) + 1;
    });
    const condEntries = Object.entries(condMap).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const condEl = document.getElementById('gai-conditions');
    if (condEl) {
      if (!condEntries.length) {
        condEl.innerHTML = `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;">No condition data in current assessments.</div>`;
      } else {
        const maxCond = condEntries[0][1];
        condEl.innerHTML = condEntries.map(([cond, cnt]) => {
          const opacity = 0.35 + (cnt / maxCond) * 0.65;
          const size    = 0.58 + (cnt / maxCond) * 0.2;
          const bgOpacity = tc('0.05', '0.08');
          const borderOpacity = tc('0.12', '0.2');
          return `<div style="font-family:'IBM Plex Mono',monospace;font-size:${size.toFixed(2)}rem;letter-spacing:0.06em;color:rgba(78,156,245,${opacity.toFixed(2)});background:rgba(78,156,245,${bgOpacity});border:1px solid rgba(78,156,245,${borderOpacity});padding:4px 10px;border-radius:4px;" title="${cnt.toLocaleString()} records">${_esc(cond)}</div>`;
        }).join('');
      }
    }

    // ── PEACS global stats ────────────────────────────────────────────────
    const peacsEl = document.getElementById('gai-peacs-stats');
    if (peacsEl && peacs.length) {
      const validP = peacs.filter(r => r.pe !== undefined && r.pe !== null);
      const peAvg  = validP.length ? (validP.reduce((s, r) => s + r.pe, 0) / validP.length).toFixed(3) : '—';
      const peCouns = new Set(validP.map(r => r.country).filter(Boolean)).size;
      const basAvg  = validP.length ? (validP.reduce((s, r) => s + (r.base || 0), 0) / validP.length).toFixed(3) : '—';
      const mvmAvg  = validP.length ? (validP.reduce((s, r) => s + (r.mvmt || 0), 0) / validP.length).toFixed(3) : '—';
      const strAvg  = validP.length ? (validP.reduce((s, r) => s + (r.strata || 0), 0) / validP.length).toFixed(3) : '—';

      peacsEl.innerHTML = `
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.8rem;color:var(--pe);">${peAvg}</div>
          <div class="acc-stat-lbl">Global Avg PE Score</div>
        </div>
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.8rem;">${validP.length.toLocaleString()}</div>
          <div class="acc-stat-lbl">Total PEACS Records</div>
        </div>
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.8rem;">${peCouns}</div>
          <div class="acc-stat-lbl">Countries with PEACS Data</div>
        </div>
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.4rem;color:var(--base);">${basAvg}</div>
          <div class="acc-stat-lbl">Avg Architecture (A)</div>
        </div>
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.4rem;color:var(--mvmt);">${mvmAvg}</div>
          <div class="acc-stat-lbl">Avg Execution (E)</div>
        </div>
        <div style="background:${tc('rgba(255,255,255,0.02)','rgba(0,0,0,0.03)')};border:1px solid ${tc('rgba(255,255,255,0.06)','rgba(0,0,0,0.1)')};border-radius:8px;padding:16px;">
          <div class="acc-stat-big" style="font-size:1.4rem;color:var(--strata);">${strAvg}</div>
          <div class="acc-stat-lbl">Avg Context (C)</div>
        </div>`;
    } else if (peacsEl) {
      peacsEl.innerHTML = `<div style="color:${tc('rgba(255,255,255,0.2)','rgba(0,0,0,0.38)')};font-family:'IBM Plex Mono',monospace;font-size:0.61rem;grid-column:1/-1;">No PEACS data yet.</div>`;
    }

  }).catch(e => {
    console.error('GAI load error:', e);
  });
}

// ── GAI Contributing Studies — provenance view for superadmin ────────────────
function accLoadGAIStudies() {
  const tbody = document.getElementById('gai-studies-tbody');
  const countEl = document.getElementById('gai-studies-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dim);font-family:var(--font-mono);font-size:0.80rem;">Loading…</td></tr>';

  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dim);">Database not available.</td></tr>'; return; }

  db.ref('assessments').once('value', snap => {
    const data = snap.val();
    if (!data) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dim);">No data found.</td></tr>'; return; }

    // Aggregate by study_title
    const studyMap = {};
    Object.values(data).forEach(r => {
      if (!r.study_title) return;
      const key = r.study_title;
      if (!studyMap[key]) {
        studyMap[key] = { title: r.study_title, pi: r.pi_name || '—', institution: r.study_institution || '—', count: 0, earliest: Infinity, latest: 0 };
      }
      studyMap[key].count++;
      if ((r.timestamp || 0) < studyMap[key].earliest) studyMap[key].earliest = r.timestamp;
      if ((r.timestamp || 0) > studyMap[key].latest)   studyMap[key].latest   = r.timestamp;
      // prefer non-blank PI/institution if later records have it
      if (r.pi_name && studyMap[key].pi === '—')               studyMap[key].pi          = r.pi_name;
      if (r.study_institution && studyMap[key].institution === '—') studyMap[key].institution = r.study_institution;
    });

    const studies = Object.values(studyMap).sort((a, b) => b.latest - a.latest);
    if (countEl) countEl.textContent = studies.length ? `${studies.length} stud${studies.length === 1 ? 'y' : 'ies'}` : '';

    if (!studies.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dim);font-family:var(--font-mono);font-size:0.80rem;">No bulk-uploaded studies found. Study provenance is captured automatically when using the v2 template.</td></tr>';
      return;
    }

    const fmtDate = ts => ts === Infinity || !ts ? '—' : new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const daysSince = ts => {
      if (!ts || ts === Infinity) return null;
      return Math.round((Date.now() - ts) / 86400000);
    };

    tbody.innerHTML = studies.map(s => {
      const days = daysSince(s.latest);
      const ageColor = days === null ? 'var(--dim)' : days > 365 ? '#ef4444' : days > 180 ? '#f59e0b' : '#10b981';
      const ageLabel = days === null ? '' : days === 0 ? ' · today' : ` · ${days}d ago`;
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:8px 10px;font-size:0.85rem;color:var(--text);">${_esc(s.title)}</td>
        <td style="padding:8px 10px;font-size:0.82rem;color:var(--muted);">${_esc(s.pi)}</td>
        <td style="padding:8px 10px;font-size:0.82rem;color:var(--muted);">${_esc(s.institution)}</td>
        <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.82rem;color:var(--text);text-align:right;">${s.count.toLocaleString()}</td>
        <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);text-align:right;">${fmtDate(s.earliest)}</td>
        <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.80rem;text-align:right;"><span style="color:${ageColor};">${fmtDate(s.latest)}</span><span style="font-size:0.72rem;color:var(--dim);">${ageLabel}</span></td>
      </tr>`;
    }).join('');
  });
}

// ── GAI JSON snapshot export ──────────────────────────────────────────────────
function accExportGAI() {
  atlasAuditLog('export_gai_snapshot', {});
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;
  showToast('Building GAI snapshot…', 2000);

  Promise.all([
    db.ref('assessments').once('value'),
    db.ref('peacs_assessments').once('value'),
  ]).then(([aSnap, pSnap]) => {
    const all   = aSnap.val()  ? Object.values(aSnap.val())  : [];
    const peacs = pSnap.val()  ? Object.values(pSnap.val())  : [];
    const valid = all.filter(r => r.score !== undefined && r.score !== null);

    // Aggregate — no individual records, only population-level stats
    const byCo = {};
    let expPeSum=0, expASum=0, expESum=0, expCSum=0, expPeN=0, expCntA=0, expCntE=0, expCntC=0;
    valid.forEach(r => {
      const co = (r.country && r.country !== 'Unknown') ? r.country : 'Unknown';
      if (!byCo[co]) byCo[co] = { n: 0, sum: 0, ina: 0, una: 0, high: 0, peSum: 0, aSum: 0, eSum: 0, cSum: 0, peN: 0 };
      byCo[co].n++;
      byCo[co].sum += (r.score || 0);
      if (r.score < 6) byCo[co].ina++;
      else if (r.score < 8) byCo[co].una++;
      else byCo[co].high++;
      // PE domain
      const _rpe = r.mmas_pe !== undefined
        ? { pe: r.mmas_pe, a: r.mmas_a, e: r.mmas_e, c: r.mmas_c }
        : (typeof computeMMASPE === 'function' ? computeMMASPE(r) : null);
      if (_rpe) {
        byCo[co].peSum += _rpe.pe; byCo[co].aSum += _rpe.a;
        byCo[co].eSum  += _rpe.e; byCo[co].cSum  += _rpe.c; byCo[co].peN++;
        expPeSum += _rpe.pe; expASum += _rpe.a; expESum += _rpe.e; expCSum += _rpe.c; expPeN++;
        const minV = Math.min(_rpe.a, _rpe.e, _rpe.c);
        if (_rpe.a===minV) expCntA++; else if (_rpe.e===minV) expCntE++; else expCntC++;
      }
    });

    const snapshot = {
      generated:  new Date().toISOString(),
      product:    'Global Adherence Index — Adherence Inc.',
      instrument: 'MMAS-8 © MMAR LLC · Licensed to Adherence Inc. · PE scoring: Theory of Predictive Emergence (Morisky)',
      period:     'All time to ' + new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
      global: {
        total_assessments: valid.length,
        countries:         Object.keys(byCo).filter(c => c !== 'Unknown').length,
        avg_score:         valid.length ? +(valid.reduce((s,r) => s + r.score, 0) / valid.length).toFixed(3) : null,
        ina_pct:           valid.length ? +(valid.filter(r => r.score < 6).length / valid.length * 100).toFixed(1) : null,
        una_pct:           valid.length ? +(valid.filter(r => r.score >= 6 && r.score < 8).length / valid.length * 100).toFixed(1) : null,
        high_pct:          valid.length ? +(valid.filter(r => r.score === 8).length / valid.length * 100).toFixed(1) : null,
      },
      mmas_pe_global: expPeN > 0 ? {
        records_with_pe_data: expPeN,
        avg_pe:  +(expPeSum / expPeN).toFixed(4),
        avg_a:   +(expASum  / expPeN).toFixed(4),
        avg_e:   +(expESum  / expPeN).toFixed(4),
        avg_c:   +(expCSum  / expPeN).toFixed(4),
        constraint_pct: {
          architecture: +(expCntA / expPeN * 100).toFixed(1),
          execution:    +(expCntE / expPeN * 100).toFixed(1),
          context:      +(expCntC / expPeN * 100).toFixed(1),
        },
        primary_global_constraint: expCntA>=expCntE&&expCntA>=expCntC ? 'Architecture' : expCntE>=expCntA&&expCntE>=expCntC ? 'Execution' : 'Context',
      } : null,
      by_country: Object.entries(byCo)
        .sort((a, b) => b[1].n - a[1].n)
        .map(([country, d]) => {
          const entry = {
            country,
            assessments: d.n,
            avg_score:   +(d.sum / d.n).toFixed(3),
            ina_pct:     +(d.ina  / d.n * 100).toFixed(1),
            una_pct:     +(d.una  / d.n * 100).toFixed(1),
            high_pct:    +(d.high / d.n * 100).toFixed(1),
          };
          if (d.peN > 0) {
            const minV = Math.min(d.aSum/d.peN, d.eSum/d.peN, d.cSum/d.peN);
            const avg_a = d.aSum/d.peN, avg_e = d.eSum/d.peN, avg_c = d.cSum/d.peN;
            entry.pe_records = d.peN;
            entry.avg_pe = +(d.peSum / d.peN).toFixed(4);
            entry.avg_a  = +avg_a.toFixed(4);
            entry.avg_e  = +avg_e.toFixed(4);
            entry.avg_c  = +avg_c.toFixed(4);
            entry.primary_constraint = avg_a===minV?'Architecture':avg_e===minV?'Execution':'Context';
          }
          return entry;
        }),
      peacs_global: peacs.length ? {
        total:   peacs.length,
        avg_pe:  +(peacs.reduce((s,r) => s + (r.pe || 0), 0) / peacs.length).toFixed(4),
        avg_a:   +(peacs.reduce((s,r) => s + (r.base  || 0), 0) / peacs.length).toFixed(4),
        avg_e:   +(peacs.reduce((s,r) => s + (r.mvmt  || 0), 0) / peacs.length).toFixed(4),
        avg_c:   +(peacs.reduce((s,r) => s + (r.strata|| 0), 0) / peacs.length).toFixed(4),
      } : null,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = 'GAI-snapshot-' + date + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('GAI snapshot exported — ' + valid.length + ' assessments from ' + Object.keys(byCo).filter(c=>c!=='Unknown').length + ' countries', 4000);
  }).catch(e => { console.error('GAI export error', e); showToast('Export failed: ' + e.message, 3000); });
}

// ── GAI Inquiries loader (ATLAS Control) ─────────────────────────────────────
async function accLoadGAIInquiries() {
  const el = document.getElementById('gai-inquiries-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.61rem;">Loading…</div>';

  try {
    const idToken = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/list-gai-inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { inquiries } = await res.json();

    if (!inquiries || !inquiries.length) {
      el.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.61rem;">No inquiries yet.</div>';
      return;
    }
    const tierColor = { standard: 'var(--base)', annual: 'var(--mvmt)', enterprise: 'var(--pe)' };
    el.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
          <thead><tr>
            ${['Date','Name','Organization','Email','Tier','Status','Note',''].map(h =>
              `<th style="font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.07);white-space:nowrap;">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>
            ${inquiries.map((r, i) => {
              const shade     = i % 2 === 1 ? 'background:rgba(255,255,255,0.015);' : '';
              const col       = tierColor[r.tier] || 'var(--dim)';
              const date      = r.submitted_at ? r.submitted_at.slice(0,10) : '—';
              const statusCol = r.status === 'converted' ? 'var(--optimal)' : r.status === 'contacted' ? 'var(--moderate)' : 'var(--dim)';
              return `<tr style="${shade}">
                <td style="padding:7px 10px;color:var(--muted);font-family:var(--font-mono);font-size:0.78rem;white-space:nowrap;">${_esc(date)}</td>
                <td style="padding:7px 10px;color:var(--text);">${_esc(r.name||'—')}</td>
                <td style="padding:7px 10px;color:var(--text);">${_esc(r.organization||'—')}</td>
                <td style="padding:7px 10px;color:rgba(78,156,245,0.8);font-family:var(--font-mono);font-size:0.80rem;">${_esc(r.email||'—')}</td>
                <td style="padding:7px 10px;white-space:nowrap;"><span style="font-family:var(--font-mono);font-size:0.71rem;color:${col};">${_esc(r.tier_label||r.tier||'—')}</span></td>
                <td style="padding:7px 10px;"><span style="font-family:var(--font-mono);font-size:0.71rem;color:${statusCol};">${_esc(r.status||'new')}</span></td>
                <td style="padding:7px 10px;color:var(--muted);font-size:0.80rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(r.note||'')}">${_esc(r.note||'—')}</td>
                <td style="padding:7px 10px;">
                  <select onchange="accUpdateGAIStatus('${_esc(r.key)}',this.value)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--muted);font-family:var(--font-mono);font-size:0.71rem;padding:3px 6px;cursor:pointer;">
                    ${['new','contacted','converted','closed'].map(s =>
                      `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`
                    ).join('')}
                  </select>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.71rem;color:var(--dim);margin-top:8px;">${inquiries.length} inquir${inquiries.length===1?'y':'ies'}</div>
    `;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--poor);font-family:var(--font-mono);font-size:0.61rem;">Failed to load: ${_esc(e.message)}</div>`;
  }
}

async function accUpdateGAIStatus(key, status) {
  try {
    const idToken = await _accGetToken();
    await fetch(LAMBDA_URL + '/admin/update-gai-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ key, status }),
    });
  } catch(e) { console.error('GAI status update failed:', e.message); }
}

// ── GAI Report Enrollment ─────────────────────────────────────────────────────
// Tracks the Firebase key of the saved inquiry so Stripe can reference it
let _gaiInquiryKey = null;

function openGAIEnroll(tier) {
  const modal = document.getElementById('gai-enroll-modal');
  if (!modal) return;

  // Pre-select the requested tier
  const radios = modal.querySelectorAll('input[name="gai-tier"]');
  radios.forEach(r => { r.checked = r.value === tier; });
  selectGAITier(tier);

  // Reset everything back to step 1 (contact form)
  ['gai-enroll-name','gai-enroll-org','gai-enroll-email','gai-enroll-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const errEl    = document.getElementById('gai-enroll-error');
  const okEl     = document.getElementById('gai-enroll-success');
  const btn      = document.getElementById('gai-enroll-submit');
  const formBtns = document.getElementById('gai-form-btns');
  const stripeRow= document.getElementById('gai-stripe-row');
  if (errEl)     { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (okEl)      { okEl.style.display  = 'none'; okEl.textContent  = ''; }
  if (btn)       { btn.disabled = false; btn.textContent = 'Continue →'; }
  if (formBtns)  formBtns.style.display = 'flex';
  if (stripeRow) stripeRow.style.display = 'none';
  _gaiInquiryKey = null;

  // Make tier cards and fields editable again
  modal.querySelectorAll('input[name="gai-tier"]').forEach(r => r.disabled = false);
  ['gai-enroll-name','gai-enroll-org','gai-enroll-email','gai-enroll-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  modal.style.display = 'flex';
  setTimeout(() => { const n = document.getElementById('gai-enroll-name'); if (n) n.focus(); }, 80);
}

function selectGAITier(tier) {
  ['standard','annual','enterprise'].forEach(t => {
    const lbl = document.getElementById('gai-tier-' + t);
    if (!lbl) return;
    if (t === tier) {
      lbl.style.borderColor    = 'rgba(212,168,67,0.5)';
      lbl.style.background     = 'rgba(212,168,67,0.06)';
    } else {
      lbl.style.borderColor    = t === 'enterprise' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.08)';
      lbl.style.background     = t === 'enterprise' ? 'rgba(212,168,67,0.03)' : 'rgba(255,255,255,0.025)';
    }
  });
  // Sync radio
  const radio = document.querySelector('input[name="gai-tier"][value="' + tier + '"]');
  if (radio) radio.checked = true;
}

function closeGAIEnroll() {
  const modal = document.getElementById('gai-enroll-modal');
  if (modal) modal.style.display = 'none';
  _gaiInquiryKey = null;
}

function gaiBackToForm() {
  const formBtns  = document.getElementById('gai-form-btns');
  const stripeRow = document.getElementById('gai-stripe-row');
  const btn       = document.getElementById('gai-enroll-submit');
  if (formBtns)  formBtns.style.display = 'flex';
  if (stripeRow) stripeRow.style.display = 'none';
  if (btn)       { btn.disabled = false; btn.textContent = 'Continue →'; }
  // Re-enable fields
  document.querySelectorAll('#gai-enroll-modal input, #gai-enroll-modal textarea, #gai-enroll-modal input[name="gai-tier"]')
    .forEach(el => { el.disabled = false; });
}

async function submitGAIEnroll() {
  const name  = (document.getElementById('gai-enroll-name')?.value  || '').trim();
  const org   = (document.getElementById('gai-enroll-org')?.value   || '').trim();
  const email = (document.getElementById('gai-enroll-email')?.value || '').trim();
  const note  = (document.getElementById('gai-enroll-note')?.value  || '').trim();
  const tier  = document.querySelector('input[name="gai-tier"]:checked')?.value || 'standard';

  const errEl    = document.getElementById('gai-enroll-error');
  const btn      = document.getElementById('gai-enroll-submit');
  const formBtns = document.getElementById('gai-form-btns');
  const stripeRow= document.getElementById('gai-stripe-row');

  const showErr = (msg) => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };
  if (errEl) errEl.style.display = 'none';

  if (!name)  { showErr('Please enter your full name.'); document.getElementById('gai-enroll-name')?.focus();  return; }
  if (!org)   { showErr('Please enter your organization.'); document.getElementById('gai-enroll-org')?.focus(); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showErr('Please enter a valid work email address.');
    document.getElementById('gai-enroll-email')?.focus();
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const tierLabels = {
    standard:   'GAI Standard — Quarterly PDF ($5,000/yr)',
    annual:     'GAI Annual Deep-Dive ($12,500/yr)',
    enterprise: 'GAI Enterprise — Real-time API ($25,000+/yr)',
  };

  try {
    const res = await fetch(LAMBDA_URL + '/gai-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, organization: org, email, tier,
        tier_label: tierLabels[tier] || tier, note: note || null }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Server error');
    _gaiInquiryKey = data.key || null;
    atlasAuditLog('gai_inquiry_submitted', { tier, org });

    // Lock fields — show Stripe step
    document.querySelectorAll('#gai-enroll-modal input, #gai-enroll-modal textarea, #gai-enroll-modal input[name="gai-tier"]')
      .forEach(el => { el.disabled = true; });

    const tierSummaries = {
      standard:   'GAI Standard · Quarterly PDF Report · <strong style="color:var(--bright)">$5,000 / year</strong> — 4 reports/year delivered to ' + email,
      annual:     'GAI Annual Deep-Dive · Full longitudinal report · <strong style="color:var(--bright)">$12,500 / year</strong> — delivered to ' + email,
      enterprise: 'GAI Enterprise · Real-time API access · <strong style="color:var(--bright)">$25,000+ / year</strong> — custom scope, dedicated account manager',
    };
    const summaryEl = document.getElementById('gai-stripe-summary');
    if (summaryEl) summaryEl.innerHTML = tierSummaries[tier] || tierSummaries.standard;

    if (formBtns)  formBtns.style.display  = 'none';
    if (stripeRow) stripeRow.style.display = 'block';
    if (btn)       btn.textContent = '✓ Saved';

    // Scroll stripe row into view
    stripeRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (e) {
    console.error('GAI inquiry submit error:', e);
    showErr('Submission failed (' + (e.message || 'unknown error') + '). Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Continue →'; }
  }
}

async function initiateGAICheckout() {
  const tier    = document.querySelector('input[name="gai-tier"]:checked')?.value || 'standard';
  const name    = (document.getElementById('gai-enroll-name')?.value  || '').trim();
  const org     = (document.getElementById('gai-enroll-org')?.value   || '').trim();
  const email   = (document.getElementById('gai-enroll-email')?.value || '').trim();
  const stripeBtn = document.getElementById('gai-stripe-btn');
  const errEl     = document.getElementById('gai-enroll-error');

  if (errEl) errEl.style.display = 'none';
  if (stripeBtn) { stripeBtn.disabled = true; stripeBtn.textContent = 'Opening Stripe…'; }

  // Enterprise uses a pre-configured Stripe Payment Link for custom scoping
  // Replace these with your actual Stripe Payment Link URLs or Price IDs
  const STRIPE_PAYMENT_LINKS = {
    enterprise: 'https://buy.stripe.com/7sYcN70GWbcn6BS00L9MY01',
  };

  if (tier === 'enterprise') {
    // Append prefill params so Stripe form is pre-filled
    const url = STRIPE_PAYMENT_LINKS.enterprise
      + '?prefilled_email=' + encodeURIComponent(email)
      + '&prefilled_promo_code='
      + '&client_reference_id=' + encodeURIComponent(_gaiInquiryKey || '');
    window.open(url, '_blank', 'noopener');
    if (stripeBtn) { stripeBtn.disabled = false; stripeBtn.textContent = 'Pay with Stripe →'; }
    return;
  }

  // Standard and Annual: create a Stripe Checkout Session via Lambda
  try {
    const res = await fetch(LAMBDA_URL + '/gai-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        name,
        organization: org,
        email,
        inquiry_key: _gaiInquiryKey || '',
        success_url: window.location.href + '?gai_success=1',
        cancel_url:  window.location.href + '?gai_cancel=1',
      }),
    });

    if (!res.ok) throw new Error('Lambda returned ' + res.status);
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url; // redirect to Stripe Checkout
    } else {
      throw new Error(data.error || 'No checkout URL returned');
    }

  } catch (e) {
    console.error('GAI Stripe checkout error:', e);
    if (errEl) { errEl.textContent = 'Could not open Stripe checkout: ' + e.message + '. Please try again or contact support.'; errEl.style.display = 'block'; }
    if (stripeBtn) { stripeBtn.disabled = false; stripeBtn.textContent = 'Pay with Stripe →'; }
  }
}

// Handle ?gai_success=1, ?gai_cancel=1, ?checkout=success, and ?magic=TOKEN on page load
(function checkReturnParams() {
  const p = new URLSearchParams(window.location.search);

  // ── Magic link return — complete workspace authentication ──────────────────
  if (p.get('magic')) {
    const token = p.get('magic').trim();
    console.log('[ATLAS] Magic link detected, token length:', token.length);
    window.history.replaceState({}, '', window.location.pathname); // clean URL immediately
    (async () => {
      // Show relay overlay immediately so user knows something is happening
      const _relay = document.createElement('div');
      _relay.style.cssText = 'position:fixed;inset:0;background:#0a0e1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:99999;font-family:\'IBM Plex Mono\',monospace;';
      _relay.innerHTML =
        '<div style="font-size:2.5rem;color:#10b981;" id="_relay_icon">⏳</div>' +
        '<div style="font-size:0.82rem;letter-spacing:0.16em;text-transform:uppercase;color:#10b981;" id="_relay_status">Verifying…</div>' +
        '<div style="font-size:0.74rem;color:#6b7280;text-align:center;max-width:300px;line-height:1.8;" id="_relay_msg">Checking your magic link…</div>' +
        '<button onclick="window.close()" id="_relay_close_btn" style="display:none;margin-top:8px;padding:8px 20px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;border-radius:8px;cursor:pointer;">Close This Tab →</button>' +
        '<button onclick="document.getElementById(\'workspace-modal\').classList.add(\'open\');document.getElementById(\'_magic_relay_overlay\').remove();" id="_relay_retry_btn" style="display:none;margin-top:4px;padding:8px 20px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:8px;cursor:pointer;">Enter Key Manually →</button>';
      _relay.id = '_magic_relay_overlay';
      document.body.appendChild(_relay);

      const _setStatus = (icon, status, msg, showRetry) => {
        const iconEl   = document.getElementById('_relay_icon');
        const statusEl = document.getElementById('_relay_status');
        const msgEl    = document.getElementById('_relay_msg');
        const retryBtn = document.getElementById('_relay_retry_btn');
        const closeBtn = document.getElementById('_relay_close_btn');
        if (iconEl)   iconEl.textContent   = icon;
        if (statusEl) statusEl.textContent = status;
        if (msgEl)    msgEl.textContent    = msg;
        if (retryBtn) retryBtn.style.display = showRetry ? '' : 'none';
        if (closeBtn && showRetry) closeBtn.style.display = '';
      };

      try {
        console.log('[ATLAS] Calling /verify-magic…');
        const res  = await fetch(`${LAMBDA_URL}/verify-magic`, {
          method:  'POST',
          mode:    'cors',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
        });
        console.log('[ATLAS] /verify-magic response status:', res.status);
        const data = await res.json();
        console.log('[ATLAS] /verify-magic response:', JSON.stringify({ valid: data.valid, hasToken: !!data.token, key: data.key, hasProfile: !!data.profile, error: data.error }));
        if (!data.valid || !data.token) {
          const errMsg = data.error || 'Magic link invalid or expired.';
          console.warn('[ATLAS] Magic link rejected:', errMsg);
          _setStatus('✗', 'Link Expired', errMsg + ' Please request a new link or enter your workspace key manually.', true);
          return;
        }
        // Sign into Firebase
        try {
          console.log('[ATLAS] Signing in with custom token…');
          await firebase.auth().signInWithCustomToken(data.token);
          console.log('[ATLAS] Firebase sign-in success, uid:', firebase.auth().currentUser?.uid);
        } catch(authErr) {
          console.error('[ATLAS] Firebase signInWithCustomToken failed:', authErr.code, authErr.message);
          _setStatus('✗', 'Auth Failed', 'Firebase error: ' + authErr.code + '. Please enter your workspace key manually.', true);
          return;
        }

        // Safe profile — guard against Lambda not returning one
        const safeProfile = data.profile || {};
        atlasAuditLog('magic_link_success', { workspace: data.key });

        // Update relay overlay to success state immediately
        _setStatus('✓', 'Access Granted', 'Returning to your ATLAS window…', false);

        // ── Broadcast auth to waiting tab ─────────────────────────────────
        // BP-SEC-10: Read nonce from localStorage (written by Tab 1 when it started listening)
        let _mlinkNonce = null;
        try { _mlinkNonce = localStorage.getItem('_mlinkNonce'); } catch(e) {}

        // Channel 1: BroadcastChannel — instant, same-browser only
        try {
          const bc = new BroadcastChannel('atlas_magic');
          bc.postMessage({ type: 'magic_complete', key: data.key, profile: safeProfile, token: data.token, nonce: _mlinkNonce });
          setTimeout(() => bc.close(), 1000);
        } catch(e) {}
        // Channel 2: localStorage — same-browser, picked up by Tab 1's 2s poll
        try {
          localStorage.setItem('atlas_magic_done', JSON.stringify({
            key: data.key, profile: safeProfile, token: data.token, nonce: _mlinkNonce, ts: Date.now()
          }));
        } catch(e) {}

        // Channel 3: Firebase RTDB — cross-browser signal.
        // IMPORTANT: close the tab only AFTER the RTDB write is acknowledged by Firebase.
        // If we close immediately, the Firebase WebSocket may not have sent the write yet
        // (SDK needs ~1-2s to establish connection on a fresh page load).
        const _safeKey = (data.key || '').replace(/[.#$[\]/]/g, '_');
        const _rtdbRef  = firebase.database().ref('magic_signals/' + _safeKey);
        console.log('[ATLAS] Writing RTDB signal, will close tab after confirmation…');

        // Fallback: close after 4s even if RTDB never confirms (network issue)
        const _closeTimer = setTimeout(() => {
          console.log('[ATLAS] RTDB close timeout — closing tab anyway');
          window.close();
          setTimeout(() => {
            _setStatus('✓', 'Access Granted', 'Your ATLAS window is now active. You can close this tab.', false);
            document.getElementById('_relay_close_btn') && (document.getElementById('_relay_close_btn').style.display = '');
          }, 500);
        }, 4000);

        _rtdbRef.set({ completed: true, key: data.key, ts: Date.now() })
          .then(() => {
            clearTimeout(_closeTimer);
            console.log('[ATLAS] RTDB write confirmed — closing relay tab');
            window.close();
            // If close fails (tab stays open), show close button after short delay
            setTimeout(() => {
              const _still = localStorage.getItem('atlas_magic_done');
              if (_still) {
                // Tab 1 hasn't consumed localStorage yet — grant access here (single-tab flow)
                localStorage.removeItem('atlas_magic_done');
                if (_relay && _relay.parentNode) _relay.remove();
                _grantWorkspaceAccess(data.key, safeProfile, { fromMagicLink: true });
              } else {
                _setStatus('✓', 'Access Granted', 'Your ATLAS window is now active. You can close this tab.', false);
                document.getElementById('_relay_close_btn') && (document.getElementById('_relay_close_btn').style.display = '');
              }
            }, 2000);
          })
          .catch(e => {
            clearTimeout(_closeTimer);
            console.error('[ATLAS] RTDB write failed:', e.code, e.message);
            // RTDB failed — Tab 1 must rely on BroadcastChannel/localStorage
            window.close();
            setTimeout(() => {
              _setStatus('✓', 'Access Granted', 'Your ATLAS window is now active. You can close this tab.', false);
              document.getElementById('_relay_close_btn') && (document.getElementById('_relay_close_btn').style.display = '');
            }, 500);
          });
      } catch(e) {
        console.error('[ATLAS] Magic link verification error:', e);
        _setStatus('✗', 'Verification Failed', 'Could not verify magic link: ' + (e.message || 'network error') + '. Please enter your workspace key manually.', true);
      }
    })();
    return; // don't process other params
  }

  if (p.get('gai_success') === '1') {
    showToast('✓ GAI subscription confirmed — check your email for next steps.', 6000);
    window.history.replaceState({}, '', window.location.pathname);
  } else if (p.get('gai_cancel') === '1') {
    showToast('GAI checkout cancelled. Your inquiry has been saved — come back any time.', 5000);
    window.history.replaceState({}, '', window.location.pathname);
  } else if (p.get('checkout') === 'success') {
    // Workspace subscription checkout completed — key will arrive by email via webhook
    showToast('✓ Payment confirmed — your workspace key will arrive by email shortly. Check spam if not received within 5 minutes.', 8000);
    window.history.replaceState({}, '', window.location.pathname);
  } else if (p.get('checkout') === 'cancel') {
    showToast('Checkout cancelled — no charge was made. Enter a key or try again any time.', 5000);
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// Close GAI enroll modal on backdrop click
document.addEventListener('click', function(e) {
  const modal = document.getElementById('gai-enroll-modal');
  if (modal && e.target === modal) closeGAIEnroll();
});

// ── Lucide icon initialisation ──
document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ── ZOE Remote Mode ───────────────────────────────────

function getZoeRemoteURL() {
  const pid = window._currentPatientId || window._activePatientNum || '';
  const wk  = (typeof currentWorkspace !== 'undefined' && currentWorkspace) ? currentWorkspace : (localStorage.getItem('atlas_workspace_key') || '');
  const base = window.location.origin + window.location.pathname;
  return `${base}?zoe_remote=1&pid=${encodeURIComponent(pid)}&wk=${encodeURIComponent(wk)}`;
}

function copyZoeRemoteLink() {
  const url = getZoeRemoteURL();
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('zoe-remote-status');
    if (el) { el.textContent = '✓ Link copied to clipboard'; el.style.color = '#10b981'; setTimeout(() => { if(el) el.textContent=''; }, 3000); }
  });
}

function sendZoeRemoteLink() {
  const phone = (document.getElementById('zoe-sms-number')?.value || '').trim();
  const el = document.getElementById('zoe-remote-status');
  if (!phone) { if (el) { el.textContent = 'Please enter a phone number.'; el.style.color = '#ef4444'; } return; }
  const url = getZoeRemoteURL();
  const msg = encodeURIComponent(`Your care coordinator has sent you a medication adherence check-in. Complete it here (3 min): ${url}`);
  window.open(`sms:${phone}?body=${msg}`, '_blank');
  if (el) { el.textContent = `✓ SMS app opened for ${phone}`; el.style.color = '#10b981'; setTimeout(() => { if(el) el.textContent=''; }, 5000); }
}

// ── ZOE Remote Screen (patient's phone) ──────────────

const ZOE_REMOTE_QUESTIONS = [
  { text: "Do you sometimes forget to take your pills?", options: ["Yes","No"], key: "q1" },
  { text: "People sometimes miss taking their medications for reasons other than forgetting. Were there any days in the past 2 weeks when you did not take your medicine?", options: ["Yes","No"], key: "q2" },
  { text: "Have you ever cut back or stopped taking your medicine without telling your doctor?", options: ["Yes","No"], key: "q3" },
  { text: "When you travel or leave home, do you sometimes forget to bring along your medicine?", options: ["Yes","No"], key: "q4" },
  { text: "Did you take your medicine yesterday?", options: ["Yes","No"], key: "q5" },
  { text: "When you feel your condition is under control, do you sometimes stop taking your medicine?", options: ["Yes","No"], key: "q6" },
  { text: "Do you ever feel hassled about sticking to your treatment plan?", options: ["Yes","No"], key: "q7" },
  { text: "How often do you have difficulty remembering to take all your medication?", options: ["Never/Rarely","Once in a while","Sometimes","Usually","All the time"], key: "q8" }
];

let _zrAnswers = {};
let _zrCurrentQ = 0;

function initZoeRemoteScreen() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('zoe_remote')) return;
  const screen = document.getElementById('zoe-remote-screen');
  if (screen) screen.classList.add('active');
  document.getElementById('zr-progress').style.display = 'block';
  _zrAnswers = {};
  _zrCurrentQ = 0;
  setTimeout(() => renderZoeRemoteQuestion(0), 1200);
  const st = document.getElementById('zr-status');
  if (st) { st.textContent = "Hi! I'm ZOE. I'll guide you through a short check-in about your medication."; }
}

function renderZoeRemoteQuestion(idx) {
  const q = ZOE_REMOTE_QUESTIONS[idx];
  if (!q) { finishZoeRemote(); return; }
  const pct = Math.round((idx / ZOE_REMOTE_QUESTIONS.length) * 100);
  const fill = document.getElementById('zr-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const st = document.getElementById('zr-status');
  if (st) st.textContent = 'Question ' + (idx+1) + ' of ' + ZOE_REMOTE_QUESTIONS.length;
  const area = document.getElementById('zr-question-area');
  if (area) {
    area.innerHTML = '<div class="zr-question-card"><div class="zr-q-num">Question ' + (idx+1) + '</div><div class="zr-q-text">' + q.text + '</div></div>' +
      '<div class="zr-answer-row">' +
      q.options.map(function(opt) { return '<button class="zr-answer-btn" onclick="zrSelectAnswer(\'' + q.key + '\',\'' + opt + '\',' + idx + ')">' + opt + '</button>'; }).join('') +
      '</div>';
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(q.text);
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }
}

function zrSelectAnswer(key, value, qIdx) {
  _zrAnswers[key] = value;
  document.querySelectorAll('.zr-answer-btn').forEach(function(b) {
    b.classList.toggle('selected', b.textContent === value);
  });
  setTimeout(function() { renderZoeRemoteQuestion(qIdx + 1); }, 800);
}

function finishZoeRemote() {
  const boolScore  = function(v) { return (v === 'No'  || v === 'no')  ? 1 : 0; };
  const boolScoreR = function(v) { return (v === 'Yes' || v === 'yes') ? 1 : 0; };
  const q8map = { Never:1, Rarely:0.75, 'Once in a while':0.75, Sometimes:0.5, Often:0.25, Usually:0.25, Always:0, 'All the time':0 };
  const score = boolScore(_zrAnswers.q1) + boolScore(_zrAnswers.q2) + boolScore(_zrAnswers.q3) +
    boolScore(_zrAnswers.q4) + boolScoreR(_zrAnswers.q5) + boolScore(_zrAnswers.q6) +
    boolScore(_zrAnswers.q7) + (q8map[_zrAnswers.q8] || 0);
  const level = score >= 8 ? 'High Adherence' : score >= 6 ? 'Medium Adherence' : 'Low Adherence';
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
  const fill = document.getElementById('zr-progress-fill');
  if (fill) fill.style.width = '100%';
  document.getElementById('zr-question-area').innerHTML = '';
  document.getElementById('zr-status').textContent = 'Assessment complete!';
  document.getElementById('zr-complete-area').innerHTML =
    '<div class="zr-complete">' +
    '<div style="font-size:0.82rem;opacity:0.6;margin-bottom:8px;">Your Score</div>' +
    '<div class="zr-score-display" style="color:' + color + ';">' + score.toFixed(2) + '<span style="font-size:1.2rem;opacity:0.4;"> /8</span></div>' +
    '<div class="zr-complete-label" style="color:' + color + ';">' + level + '</div>' +
    '<div style="margin-top:24px;font-size:0.78rem;opacity:0.55;line-height:1.6;">Your result has been sent to your care coordinator.<br>Thank you for completing your check-in.</div>' +
    '</div>';
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('pid') || 'ZOE-REMOTE';
  try {
    const db = window._firebaseDb || (typeof database !== 'undefined' ? database : null);
    if (db) {
      const rec = { patient_number: pid, score: score.toFixed(2), pattern: score >= 8 ? 'High' : score < 6 ? 'INA' : 'UNA', source: 'zoe_remote', timestamp: Date.now() };
      Object.assign(rec, _zrAnswers);
      db.ref('assessments').push(rec);
      updatePublicStats(score, rec.country||null);
    }
  } catch(e) {}
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Your score is ' + score.toFixed(1) + ' out of 8. ' + level + '. Thank you.'));
  }
}

(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZoeRemoteScreen);
  } else {
    initZoeRemoteScreen();
  }
})();

// ============================================================
// MULTILINGUAL UI — i18n Engine
// ============================================================
const UI_STRINGS = {
  en: {
    consent_title: 'Before we begin',
    consent_body: 'This assessment collects information about your medication-taking behaviour. Your responses are confidential and used only for your care.',
    consent_agree: 'I Agree & Continue',
    consent_decline: 'Not Now',
    zoe_greeting: 'Hi! I\'m ZOE, your adherence guide.',
    zoe_start: 'Start Assessment',
    zoe_next: 'Next',
    zoe_submit: 'Submit',
    result_title: 'Your Adherence Profile',
    result_high: 'High Adherence',
    result_medium: 'Moderate Adherence',
    result_low: 'Low Adherence',
    result_tip_high: 'Excellent work. Keep up your routine.',
    result_tip_medium: 'Some barriers detected. Your care team can help.',
    result_tip_low: 'Several barriers detected. Please speak with your provider.',
    domain_motivation: 'Motivation',
    domain_routine: 'Routine',
    domain_access: 'Access',
    portal_title: 'Your Health Journey',
    portal_history: 'Assessment History',
    portal_contact: 'Contact Your Care Team',
    lang_label: 'Language',
  },
  es: {
    consent_title: 'Antes de comenzar',
    consent_body: 'Esta evaluación recopila información sobre su comportamiento al tomar medicamentos. Sus respuestas son confidenciales y se usan solo para su atención.',
    consent_agree: 'Acepto y Continúo',
    consent_decline: 'Ahora No',
    zoe_greeting: '¡Hola! Soy ZOE, tu guía de adherencia.',
    zoe_start: 'Iniciar Evaluación',
    zoe_next: 'Siguiente',
    zoe_submit: 'Enviar',
    result_title: 'Tu Perfil de Adherencia',
    result_high: 'Alta Adherencia',
    result_medium: 'Adherencia Moderada',
    result_low: 'Baja Adherencia',
    result_tip_high: 'Excelente trabajo. Mantén tu rutina.',
    result_tip_medium: 'Algunas barreras detectadas. Tu equipo de atención puede ayudar.',
    result_tip_low: 'Varias barreras detectadas. Por favor, habla con tu proveedor.',
    domain_motivation: 'Motivación',
    domain_routine: 'Rutina',
    domain_access: 'Acceso',
    portal_title: 'Tu Trayectoria de Salud',
    portal_history: 'Historial de Evaluaciones',
    portal_contact: 'Contacta a Tu Equipo de Atención',
    lang_label: 'Idioma',
  },
  fr: {
    consent_title: 'Avant de commencer',
    consent_body: 'Cette évaluation recueille des informations sur votre comportement en matière de prise de médicaments. Vos réponses sont confidentielles et utilisées uniquement pour vos soins.',
    consent_agree: 'J\'accepte et continue',
    consent_decline: 'Pas maintenant',
    zoe_greeting: 'Bonjour ! Je suis ZOE, votre guide d\'adhérence.',
    zoe_start: 'Démarrer l\'évaluation',
    zoe_next: 'Suivant',
    zoe_submit: 'Soumettre',
    result_title: 'Votre profil d\'adhérence',
    result_high: 'Haute Adhérence',
    result_medium: 'Adhérence Modérée',
    result_low: 'Faible Adhérence',
    result_tip_high: 'Excellent travail. Continuez votre routine.',
    result_tip_medium: 'Quelques obstacles détectés. Votre équipe soignante peut aider.',
    result_tip_low: 'Plusieurs obstacles détectés. Veuillez parler à votre prestataire.',
    domain_motivation: 'Motivation',
    domain_routine: 'Routine',
    domain_access: 'Accès',
    portal_title: 'Votre Parcours de Santé',
    portal_history: 'Historique des évaluations',
    portal_contact: 'Contactez votre équipe soignante',
    lang_label: 'Langue',
  },
  de: {
    consent_title: 'Bevor wir beginnen',
    consent_body: 'Diese Bewertung sammelt Informationen über Ihr Medikamenteneinnahmeverhalten. Ihre Antworten sind vertraulich und werden nur für Ihre Betreuung verwendet.',
    consent_agree: 'Ich stimme zu & weiter',
    consent_decline: 'Nicht jetzt',
    zoe_greeting: 'Hallo! Ich bin ZOE, Ihr Adhärenz-Guide.',
    zoe_start: 'Bewertung starten',
    zoe_next: 'Weiter',
    zoe_submit: 'Absenden',
    result_title: 'Ihr Adhärenzprofil',
    result_high: 'Hohe Adhärenz',
    result_medium: 'Moderate Adhärenz',
    result_low: 'Geringe Adhärenz',
    result_tip_high: 'Hervorragende Arbeit. Behalten Sie Ihre Routine bei.',
    result_tip_medium: 'Einige Hindernisse erkannt. Ihr Betreuungsteam kann helfen.',
    result_tip_low: 'Mehrere Hindernisse erkannt. Bitte sprechen Sie mit Ihrem Arzt.',
    domain_motivation: 'Motivation',
    domain_routine: 'Routine',
    domain_access: 'Zugang',
    portal_title: 'Ihre Gesundheitsreise',
    portal_history: 'Bewertungsverlauf',
    portal_contact: 'Ihr Betreuungsteam kontaktieren',
    lang_label: 'Sprache',
  },
  pt: {
    consent_title: 'Antes de começarmos',
    consent_body: 'Esta avaliação coleta informações sobre seu comportamento de adesão à medicação. Suas respostas são confidenciais e usadas apenas para seu cuidado.',
    consent_agree: 'Concordo e Continuo',
    consent_decline: 'Agora Não',
    zoe_greeting: 'Olá! Sou ZOE, sua guia de adesão.',
    zoe_start: 'Iniciar Avaliação',
    zoe_next: 'Próximo',
    zoe_submit: 'Enviar',
    result_title: 'Seu Perfil de Adesão',
    result_high: 'Alta Adesão',
    result_medium: 'Adesão Moderada',
    result_low: 'Baixa Adesão',
    result_tip_high: 'Excelente trabalho. Continue com sua rotina.',
    result_tip_medium: 'Algumas barreiras detectadas. Sua equipe de cuidados pode ajudar.',
    result_tip_low: 'Várias barreiras detectadas. Por favor, fale com seu provedor.',
    domain_motivation: 'Motivação',
    domain_routine: 'Rotina',
    domain_access: 'Acesso',
    portal_title: 'Sua Jornada de Saúde',
    portal_history: 'Histórico de Avaliações',
    portal_contact: 'Contate Sua Equipe de Cuidados',
    lang_label: 'Idioma',
  }
};

let _currentUILang = localStorage.getItem('atlas_ui_lang') || 'en';

function t(key) {
  const strings = UI_STRINGS[_currentUILang] || UI_STRINGS.en;
  return strings[key] || UI_STRINGS.en[key] || key;
}

function setUILanguage(lang) {
  if (!UI_STRINGS[lang]) return;
  _currentUILang = lang;
  localStorage.setItem('atlas_ui_lang', lang);
  // Update active button state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick') === `setUILanguage('${lang}')`);
  });
  // Apply to all data-i18n elements
  applyUIStrings();
}

function applyUIStrings() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // Only process keys that belong to the new UI_STRINGS system (underscore-format keys)
    if (!UI_STRINGS.en.hasOwnProperty(key)) return;
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
}

// Auto-apply stored language on load
(function() {
  const stored = localStorage.getItem('atlas_ui_lang');
  if (stored && UI_STRINGS[stored]) {
    _currentUILang = stored;
    // Defer until DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyUIStrings();
        document.querySelectorAll('.lang-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('onclick') === `setUILanguage('${stored}')`);
        });
      });
    } else {
      applyUIStrings();
    }
  }
})();
// ============================================================

// ============================================================
// IRB SUBMISSION ASSISTANT
// ============================================================

function openIRBAssistant() {
  populateIRBAssistant();
  const modal = document.getElementById('irb-assistant-modal');
  if (modal) modal.classList.add('open');
}

function closeIRBAssistant() {
  const modal = document.getElementById('irb-assistant-modal');
  if (modal) modal.classList.remove('open');
}

function switchIRBTab(tab, btn) {
  ['population','instruments','procedures','risks','data'].forEach(function(t) {
    var sec = document.getElementById('irb-tab-' + t);
    if (sec) sec.style.display = (t === tab) ? 'block' : 'none';
  });
  document.querySelectorAll('.irb-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

function _irbGetConfig() {
  return (typeof studyConfig !== 'undefined' && studyConfig) ? studyConfig : {};
}

function _irbGetSites() {
  return (typeof _studySites !== 'undefined') ? _studySites : [];
}

function populateIRBAssistant() {
  var cfg       = _irbGetConfig();
  var sites     = _irbGetSites();
  var studyName = cfg.name     || '[Study Name]';
  var irbNum    = cfg.irb      || '[IRB Number]';
  var sponsor   = cfg.sponsor  || '[Sponsor]';
  var protocol  = cfg.protocol || '[Protocol Number]';
  var startDate = cfg.start    || '[Start Date]';
  var lockDate  = cfg.lock     || '[Lock Date]';
  var targetN   = cfg.target   || '[N]';
  var siteCount = sites.length || '[N]';

  function fill(id, text) {
    var el = document.getElementById(id);
    if (el && !el.dataset.edited) el.value = text;
  }

  fill('irb-text-population',
    'Study Name: ' + studyName + '\n' +
    'Protocol Number: ' + protocol + '\n' +
    'IRB Reference: ' + irbNum + '\n' +
    'Sponsor: ' + sponsor + '\n\n' +
    'This protocol describes a prospective observational study of medication adherence using the ATLAS platform. ' +
    'The study will enroll ' + targetN + ' participants across ' + siteCount + ' site(s) beginning ' + startDate + '. ' +
    'Adherence will be measured using the MAP (Multidimensional Adherence Parameters) instrument, a validated 8-item scale derived from the Morisky Medication Adherence Scale (MMAS-8). ' +
    'Longitudinal tracking will employ PEACS (Predictive Emergence Assessment for Clinical Services), a 22-item composite instrument measuring adherence trajectory across three temporal scales.'
  );

  fill('irb-text-criteria',
    'INCLUSION CRITERIA\n' +
    '\u2022 Age \u2265 18 years\n' +
    '\u2022 Active prescription for \u22651 chronic medication\n' +
    '\u2022 Ability to provide informed consent\n' +
    '\u2022 Access to a device capable of completing electronic assessments\n\n' +
    'EXCLUSION CRITERIA\n' +
    '\u2022 Cognitive impairment precluding informed consent\n' +
    '\u2022 Life expectancy < 6 months at time of enrollment\n' +
    '\u2022 Current participation in a conflicting interventional trial\n' +
    '\u2022 Non-English speaking (unless site provides translated materials)'
  );

  fill('irb-text-instruments',
    'MAP \u2014 MULTIDIMENSIONAL ADHERENCE PARAMETERS\n' +
    'An 8-item validated self-report scale assessing medication adherence across behavioral and attitudinal dimensions. ' +
    'Derived from the Morisky Medication Adherence Scale (MMAS-8). Administered at enrollment and each scheduled clinical visit. ' +
    'Scores range 0\u20138; higher scores indicate greater adherence. Validated for use in chronic disease populations.\n\n' +
    'PEACS \u2014 PREDICTIVE EMERGENCE ASSESSMENT FOR CLINICAL SERVICES\n' +
    'A 22-item composite instrument measuring adherence trajectory across three temporal scales:\n' +
    '  \u2022 BASE (Baseline Adherence Status Evaluation) \u2014 administered monthly\n' +
    '  \u2022 MVMT (Medication Variability Momentum Tracker) \u2014 administered weekly\n' +
    '  \u2022 STRATA (Stratified Temporal Readiness and Trend Assessment) \u2014 administered quarterly\n\n' +
    'ATLAS PLATFORM\n' +
    'The ATLAS (Adherence Tracking and Longitudinal Analysis System) platform hosts all electronic assessments, ' +
    'stores participant data, generates Sentinel alerts for adherence decline, and provides the principal investigator ' +
    'with real-time enrollment and trajectory dashboards.\n\n' +
    'THEORETICAL FRAMEWORK\n' +
    'All instruments are grounded in the Theory of Predictive Emergence (TPE), which conceptualizes adherence ' +
    'as a dynamic, trajectory-dependent phenomenon emerging from the interaction of behavioral, cognitive, and contextual determinants across time.'
  );

  fill('irb-text-citations',
    '1. Morisky DE, et al. (2008). Predictive Validity of a Medication Adherence Measure in an Outpatient Setting. J Clin Hypertens.\n' +
    '2. Morisky P. (2026). MAP \u2014 Multidimensional Adherence Parameters. Adherence Cartography, Inc.\n' +
    '3. Morisky P. (2026). PEACS \u2014 Predictive Emergence Assessment for Clinical Services. Adherence Cartography, Inc.\n' +
    '4. Morisky P. (2026). Theory of Predictive Emergence (TPE). Adherence Cartography, Inc.\n' +
    '5. ATLAS Platform Documentation. Adherence Cartography, Inc. (docs.adherence.cc)'
  );

  var visitsStr = (cfg.visits || [30, 90, 180]).map(function(d) { return 'Day ' + d; }).join(', ');
  fill('irb-text-procedures',
    'DATA COLLECTION PROCEDURES\n\n' +
    '1. ENROLLMENT: Eligible participants are identified by clinical staff and invited to enroll. ' +
    'After informed consent, baseline MAP and PEACS BASE assessments are completed electronically via ATLAS.\n\n' +
    '2. ONGOING ASSESSMENTS:\n' +
    '   \u2022 MAP \u2014 completed at each scheduled clinical visit\n' +
    '   \u2022 PEACS MVMT \u2014 completed weekly via ATLAS patient portal (\u22483 minutes)\n' +
    '   \u2022 PEACS STRATA \u2014 completed quarterly (\u22488 minutes)\n' +
    '   \u2022 PEACS BASE \u2014 completed monthly (\u22486 minutes)\n\n' +
    '3. SENTINEL ALERTS: ATLAS automatically generates Sentinel alerts when PEACS trajectories ' +
    'indicate adherence risk. Clinical staff review alerts and initiate outreach per site SOP.\n\n' +
    '4. DATA LOCK: All data collection ceases on ' + lockDate + '. Final exports generated by PI.'
  );

  fill('irb-text-timeline',
    'Study Start: ' + startDate + '\n' +
    'Database Lock: ' + lockDate + '\n' +
    'Target Enrollment: ' + targetN + ' participants\n' +
    'Number of Sites: ' + siteCount + '\n\n' +
    'VISIT SCHEDULE\n' +
    '\u2022 Baseline (enrollment)\n' +
    '\u2022 Follow-up visits: ' + visitsStr + '\n\n' +
    'MILESTONES\n' +
    '\u2022 Month 1: Site activation and staff training\n' +
    '\u2022 Month 2: First participant enrollment\n' +
    '\u2022 Ongoing: MAP per visit, PEACS MVMT weekly, PEACS BASE monthly, PEACS STRATA quarterly\n' +
    '\u2022 Final month: Database lock and data export\n' +
    '\u2022 Post-lock: Statistical analysis and manuscript preparation'
  );

  fill('irb-text-risks',
    'The risks of this study are minimal.\n\n' +
    '\u2022 CONFIDENTIALITY RISK: There is a small risk of breach of confidentiality, mitigated by use of coded ' +
    'participant identifiers and secure encrypted data storage (Firebase with role-based access control).\n\n' +
    '\u2022 PSYCHOLOGICAL DISCOMFORT: Some participants may experience mild discomfort when reflecting on ' +
    'medication adherence challenges. Staff are trained to respond supportively.\n\n' +
    '\u2022 NO PHYSICAL RISKS: There are no physical risks associated with participation. No medications, ' +
    'devices, or procedures are administered as part of this study.'
  );

  fill('irb-text-benefits',
    'DIRECT BENEFITS TO PARTICIPANTS\n' +
    '\u2022 Increased self-awareness of medication adherence patterns through ATLAS feedback\n' +
    '\u2022 Early identification of adherence decline via Sentinel alerts, enabling proactive clinical support\n' +
    '\u2022 Access to personalized adherence trajectory visualizations through the ATLAS patient portal\n\n' +
    'INDIRECT BENEFITS\n' +
    '\u2022 Contribution to scientific knowledge about longitudinal adherence patterns\n' +
    '\u2022 Development of more effective clinical intervention protocols\n' +
    '\u2022 Advancement of validated adherence instrumentation (MAP, PEACS)\n\n' +
    'COMPENSATION\n' +
    'Participants will not receive financial compensation unless specified in the site-specific addendum.'
  );

  fill('irb-text-consent',
    'Informed consent will be obtained by trained research staff prior to any study procedures. ' +
    'The consent process will include:\n\n' +
    '1. Verbal explanation of study purpose, procedures, risks, and benefits\n' +
    '2. Opportunity for participant questions\n' +
    '3. Written consent form signature (paper or electronic per site SOP)\n' +
    '4. Copy of signed consent provided to participant\n\n' +
    'Participants may withdraw consent at any time without penalty or impact on their clinical care. ' +
    'For participants with limited English proficiency, translated consent materials will be provided where available per site addendum.'
  );

  fill('irb-text-datastorage',
    'All data is stored in Firebase Realtime Database (Google Cloud infrastructure) with:\n' +
    '\u2022 AES-256 encryption at rest\n' +
    '\u2022 TLS 1.3 encryption in transit\n' +
    '\u2022 Role-based access control via Firebase Authentication\n' +
    '\u2022 Workspace-isolated data nodes (no cross-study data access)\n' +
    '\u2022 Automated backups per Firebase enterprise policy\n\n' +
    'Access is restricted to: the principal investigator, authorized co-investigators, site coordinators ' +
    '(read access for their site only), and the ATLAS platform administrator (anonymized aggregate data only ' +
    'under a data use agreement with Adherence Cartography, Inc.).\n\n' +
    'Sponsor (' + sponsor + ') will receive de-identified aggregate data for publication and regulatory purposes.'
  );

  fill('irb-text-confidentiality',
    'Each participant is assigned a unique coded identifier (participant ID) at enrollment. ' +
    'Identifiable information (name, date of birth, contact details) is maintained only in the ' +
    'site-level master enrollment log, stored separately from ATLAS research data.\n\n' +
    'ATLAS stores only: participant ID, assessment responses, timestamps, site code, and derived scores. ' +
    'No direct identifiers are stored in the ATLAS database.\n\n' +
    'Study results may be published in peer-reviewed journals. No individual participant will be ' +
    'identifiable in any publication or presentation.'
  );

  fill('irb-text-retention',
    'Research data will be retained for a minimum of 7 years following study completion or database lock (' + lockDate + '), ' +
    'or as required by applicable federal, state, and institutional regulations \u2014 whichever is longer.\n\n' +
    'Upon retention period expiration, data will be securely deleted per Firebase enterprise data destruction policy. ' +
    'Aggregate de-identified data may be retained indefinitely for archival and scientific purposes.'
  );
}

function irbRegenSection(sectionName) {
  var fieldMap = {
    population:      ['irb-text-population'],
    criteria:        ['irb-text-criteria'],
    instruments:     ['irb-text-instruments'],
    citations:       ['irb-text-citations'],
    procedures:      ['irb-text-procedures'],
    timeline:        ['irb-text-timeline'],
    risks:           ['irb-text-risks'],
    benefits:        ['irb-text-benefits'],
    consent:         ['irb-text-consent'],
    datastorage:     ['irb-text-datastorage'],
    confidentiality: ['irb-text-confidentiality'],
    retention:       ['irb-text-retention']
  };
  (fieldMap[sectionName] || []).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { delete el.dataset.edited; el.value = ''; }
  });
  populateIRBAssistant();
}

function irbRegenAll() {
  document.querySelectorAll('.irb-textarea').forEach(function(ta) {
    delete ta.dataset.edited;
    ta.value = '';
  });
  populateIRBAssistant();
}

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.irb-textarea').forEach(function(ta) {
      ta.addEventListener('input', function() { ta.dataset.edited = '1'; });
    });
  });
})();

function exportIRBDocument() {
  var cfg       = _irbGetConfig();
  var studyName = cfg.name || 'ATLAS Study';
  var irbNum    = cfg.irb  || 'TBD';
  var sep       = '='.repeat(60);
  var doc =
    'ATLAS IRB SUBMISSION DOCUMENT\n' + sep + '\n' +
    'Study: '    + studyName + '\n' +
    'IRB #: '    + irbNum + '\n' +
    'Protocol: ' + (cfg.protocol || 'TBD') + '\n' +
    'Sponsor: '  + (cfg.sponsor  || 'TBD') + '\n' +
    'Generated: '+ new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}) + '\n' +
    sep + '\n';

  [
    { label: 'STUDY POPULATION DESCRIPTION',    id: 'irb-text-population'      },
    { label: 'INCLUSION / EXCLUSION CRITERIA',  id: 'irb-text-criteria'        },
    { label: 'ASSESSMENT INSTRUMENTS',          id: 'irb-text-instruments'     },
    { label: 'KEY CITATIONS',                   id: 'irb-text-citations'       },
    { label: 'DATA COLLECTION PROCEDURES',      id: 'irb-text-procedures'      },
    { label: 'TIMELINE & VISIT SCHEDULE',       id: 'irb-text-timeline'        },
    { label: 'RISKS TO PARTICIPANTS',           id: 'irb-text-risks'           },
    { label: 'BENEFITS TO PARTICIPANTS',        id: 'irb-text-benefits'        },
    { label: 'INFORMED CONSENT PROCESS',        id: 'irb-text-consent'         },
    { label: 'DATA STORAGE & SECURITY',         id: 'irb-text-datastorage'     },
    { label: 'CONFIDENTIALITY & DE-IDENTIFICATION', id: 'irb-text-confidentiality' },
    { label: 'DATA RETENTION POLICY',           id: 'irb-text-retention'       },
  ].forEach(function(s) {
    var el = document.getElementById(s.id);
    doc += '\n' + s.label + '\n' + '-'.repeat(s.label.length) + '\n' + (el ? el.value : '[Not populated]') + '\n';
  });

  var blob = new Blob([doc], { type: 'text/plain' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'ATLAS_IRB_Submission_' + (cfg.protocol || 'draft').replace(/\s+/g, '_') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}
// ============================================================

