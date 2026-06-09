// ── MAP Phenotype Configuration ──────────────────────────────────────────────
const MAP_PHENOTYPE = {
  INA: {
    label: 'Intentional',
    full: 'Intentional Non-Adherent',
    code: 'INA',
    color: 'var(--mvmt,#8b6ff5)',
    bg: 'rgba(139,111,245,0.12)',
    border: 'rgba(139,111,245,0.3)',
    icon: '⚡',
    protocol: 'Motivational Engagement',
    tooltip: 'Volitional non-adherence — motivational intervention indicated. Avoid didactic content.'
  },
  UNA: {
    label: 'Unintentional',
    full: 'Unintentional Non-Adherent',
    code: 'UNA',
    color: 'var(--pe,#d4a843)',
    bg: 'rgba(212,168,67,0.12)',
    border: 'rgba(212,168,67,0.3)',
    icon: '⏰',
    protocol: 'Behavioral Structuring',
    tooltip: 'Structural non-adherence — habit cues, reminders, and environmental design indicated.'
  },
  PA:  {
    label: 'Partial',
    full: 'Partially Adherent',
    code: 'PA',
    color: 'var(--base,#4e9cf5)',
    bg: 'rgba(78,156,245,0.12)',
    border: 'rgba(78,156,245,0.3)',
    icon: '◐',
    protocol: 'Consolidation & Resilience',
    tooltip: 'Context-dependent adherence gaps — contingency planning and consolidation coaching indicated.'
  },
  A:   {
    label: 'Adherent',
    full: 'Adherent',
    code: 'A',
    color: 'var(--strata,#2ec98a)',
    bg: 'rgba(46,201,138,0.12)',
    border: 'rgba(46,201,138,0.3)',
    icon: '✓',
    protocol: 'Maintenance & Monitoring',
    tooltip: 'Adherent — maintenance protocol and longitudinal monitoring to prevent regression.'
  },
};

/**
 * Returns a styled MAP phenotype badge HTML string.
 * @param {string} phenotypeCode - 'INA'|'UNA'|'PA'|'A'
 * @param {boolean} [showTooltip=true] - whether to include title attribute
 * @returns {string} HTML string for badge
 */
function mapPhenotypeBadge(phenotypeCode, showTooltip = true) {
  const p = MAP_PHENOTYPE[phenotypeCode];
  if (!p) return '';
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:${p.bg};border:1px solid ${p.border};color:${p.color};white-space:nowrap;cursor:default;"${showTooltip ? ` title="${p.tooltip}"` : ''}>${p.icon} ${p.label}</span>`;
}

/**
 * Derives MAP phenotype from MMAS-8 item-level responses.
 * @param {Object} record - assessment record with q1-q8 fields
 * @returns {'INA'|'UNA'|'PA'|'A'} phenotype code
 */
function deriveMAPPhenotype(record) {
  if (!record) return 'PA';
  const score = (record.score !== undefined) ? record.score :
    [record.q1,record.q2,record.q3,record.q4,record.q5,record.q6,record.q7].filter(v=>v===0||v===false).length +
    (record.q8 !== undefined ? (4 - (record.q8||0)) / 4 : 0.5);
  // Use stored phenotype if available
  if (record.map_phenotype && MAP_PHENOTYPE[record.map_phenotype]) return record.map_phenotype;
  // Derive from score and item patterns
  const intentional = (record.q3 === 1 || record.q4 === 1);
  const forgetful = (record.q1 === 1 || record.q2 === 1) && !intentional;
  if (score >= 8) return 'A';
  if (intentional) return 'INA';
  if (forgetful) return 'UNA';
  if (score >= 6) return 'PA';
  return 'UNA'; // default for low scorers without clear intentional pattern
}

// ══════════════════════════════════════════════
// HELPER: toggle records panel
// ══════════════════════════════════════════════
/**
 * Toggles a collapsible records panel open or closed and updates its toggle icon.
 * @param {string} bodyId - ID of the panel body element
 * @param {string} iconId - ID of the toggle icon element (shows '+' or '−')
 * @returns {void}
 */
function toggleRecords(bodyId, iconId) {
  const body = document.getElementById(bodyId);
  const icon = document.getElementById(iconId);
  if (!body) return;
  body.classList.toggle('open');
  if (icon) icon.textContent = body.classList.contains('open') ? '−' : '+';
}

/** Toggles the mission-control records panel and updates the toggle button label. @returns {void} */
function toggleMcRecords() {
  const body = document.getElementById('mc-records-body');
  const icon = document.getElementById('mc-records-toggle-icon');
  if (!body) return;
  const open = body.style.display === 'none' || body.style.display === '';
  body.style.display = open ? 'block' : 'none';
  if (icon) icon.textContent = open ? '▲ Records' : '▼ Records';
}

// ══════════════════════════════════════════════
// ACTIVE STUDY LOCK
// Session-level study binding — stamps every assessment with a study_id
// without requiring manual re-entry each time. Mirrors bulk-upload behaviour.
// ══════════════════════════════════════════════

/**
 * Locks the session to a specific study ID.
 * Auto-fills all sdoh-study-id inputs and shows the lock badge.
 * @param {string|null} id    - ATLAS Study ID (e.g. "ATLAS-2026-1234")
 * @param {string}      title - Human-readable study title (for display only)
 */
function setActiveStudy(id, title) {
  window._activeStudyId    = id    ? id.trim().toUpperCase() : null;
  window._activeStudyTitle = title || null;

  // Persist across same-tab page navigations (e.g. index.html → assess.html)
  try {
    if (window._activeStudyId) {
      sessionStorage.setItem('atlas_active_study_id',    window._activeStudyId);
      sessionStorage.setItem('atlas_active_study_title', window._activeStudyTitle || '');
    } else {
      sessionStorage.removeItem('atlas_active_study_id');
      sessionStorage.removeItem('atlas_active_study_title');
    }
  } catch(e) {}

  // Auto-fill every study-id input that is currently empty
  ['sdoh-study-id', 'map-sdoh-study-id', 'p-sdoh-study-id'].forEach(function(fid) {
    var el = document.getElementById(fid);
    if (el) el.value = window._activeStudyId || '';
  });

  // Update the lock badge visibility
  var badge = document.getElementById('active-study-lock-badge');
  if (!badge) return;
  if (window._activeStudyId) {
    var idEl = document.getElementById('aslb-id');
    var ttEl = document.getElementById('aslb-title');
    if (idEl) idEl.textContent = window._activeStudyId;
    if (ttEl) ttEl.textContent = window._activeStudyTitle ? ' — ' + window._activeStudyTitle : '';
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Clears the session study lock and blanks every study-id input.
 */
function clearActiveStudy() {
  setActiveStudy(null, null);
}

// ══════════════════════════════════════════════
// WIRING — all event listeners in one place
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  // If returning from MAP assessment, flag for post-auth queue refresh and auto-restore session
  (function _checkMapReturn() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('refresh') === 'map') {
        window._mapReturnRefresh = true;
        history.replaceState(null, '', window.location.pathname);
        // Auto-restore the workspace session so user lands back in their dashboard
        // instead of the entry screen. Run after DOMContentLoaded finishes.
        setTimeout(function() {
          const savedCode = sessionStorage.getItem('atlas_workspace');
          const savedProf = sessionStorage.getItem('atlas_workspace_profile');
          const savedMode = sessionStorage.getItem('atlas_ws_mode') || 'researcher';
          if (savedCode && savedProf) {
            window._wsMode = savedMode;
            if (typeof restoreWorkspaceSession === 'function' && restoreWorkspaceSession()) {
              if (typeof enterResearcherDashboard === 'function') enterResearcherDashboard();
            }
          }
        }, 0);
      }
    } catch(e) {}
  })();

  initTheme();
  initStars();
  userId = getUserId();
  // Do NOT auto-populate patient number — clinician/researcher should enter it manually.
  // userId is used as a fallback internally on submission but should not clutter the form.
  // Add a default empty medication row
  addMedRow();
  buildLangSelect();
  buildPeacsLangSelect();

  // ── Cherry 7: Session resumption toast ──────────────────────────────────────
  // If this device has an in-progress MMAS assessment from the last 24 hours
  // that was never submitted, gently offer to resume.
  (function checkSessionResumption() {
    try {
      const saved = sessionStorage.getItem('atlas_mmas_draft');
      if (!saved) return;
      const draft = JSON.parse(saved);
      const age = Date.now() - (draft.ts || 0);
      const answeredCount = Object.keys(draft.answers || {}).filter(k => /^q\d$/.test(k)).length;
      if (age > 86400000 || answeredCount < 1) {
        sessionStorage.removeItem('atlas_mmas_draft');
        return;
      }
      // Show a non-blocking toast after the UI has settled
      setTimeout(() => {
        const t = document.createElement('div');
        t.id = 'atlas-resume-toast';
        t.style.cssText = [
          'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
          'z-index:99999;background:var(--card)',
          'border:1px solid var(--border2);border-top:2px solid var(--base)',
          'border-radius:12px;padding:14px 20px',
          'display:flex;align-items:center;gap:14px',
          'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
          'font-family:\'IBM Plex Mono\',monospace;font-size:0.88rem',
          'animation:fadeUp 0.4s ease both',
          'max-width:92vw;cursor:default',
        ].join(';');
        t.innerHTML = `
          <span style="color:var(--base);font-size:1.1rem;flex-shrink:0;">↩</span>
          <span style="color:var(--text);">You have an in-progress assessment
            <span style="color:var(--muted);"> · ${answeredCount}/8 questions answered</span>
          </span>
          <button id="resume-yes-btn" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.14);border:1px solid rgba(78,156,245,0.4);color:var(--base);border-radius:7px;padding:6px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background 0.2s;" onmouseover="this.style.background='rgba(78,156,245,0.25)'" onmouseout="this.style.background='rgba(78,156,245,0.14)'">Resume</button>
          <button id="resume-no-btn" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;background:none;border:none;color:var(--dim);cursor:pointer;padding:4px 6px;" title="Dismiss">✕</button>`;
        document.body.appendChild(t);

        document.getElementById('resume-yes-btn').addEventListener('click', () => {
          try {
            mmasAnswers = draft.answers;
            showScreen('screen-mmas');
            renderMMASQuestions();
            buildLangSelect();
            rebuildConditionDropdown();
            requestGeolocation().then(() => fillSdohLocation());
          } catch(e) {}
          t.remove();
        });
        document.getElementById('resume-no-btn').addEventListener('click', () => {
          sessionStorage.removeItem('atlas_mmas_draft');
          t.remove();
        });

        // Auto-dismiss after 12 seconds
        setTimeout(() => { try { t.remove(); } catch(e) {} }, 12000);
      }, 1800);
    } catch(e) {
      console.warn('[ATLAS] Session resumption check failed, clearing draft.', e);
      try { sessionStorage.removeItem('atlas_mmas_draft'); } catch(_) {}
    }
  })();

  // ── Entry ──
  // ── Entry gate — 4 paths, 2 need keys ───────────────────────────────────────
  // Patient: enter MAP-only visitor mode — MMAS and PEACS greyed out.
  // Previously redirected to /assess (MMAS-only); now uses the MAP instrument directly.
  document.getElementById('btn-patient').addEventListener('click', () => {
    window._wsMode         = 'explorer';
    window._patientMapMode = true; // skip dashboard entirely — consent → /assess?tool=map
    currentWorkspace  = 'ATLAS-EXPLORER-2026';
    workspaceProfile  = { name:'Visitor', cohortLabel:'Visitor', color:'#2ec98a', active:true, role:'explorer' };
    requestGeolocation().then(() => fillSdohLocation());
    // Go straight to MAP consent — patient path is MAP-only, no dashboard stop
    window._postConsentInstrument = 'map';
    _postConsentTarget = 'entry';
    document.getElementById('consent-checkbox').checked = false;
    document.getElementById('consent-proceed-btn').disabled = true;
    renderConsentForInstrument('map');
    showScreen('screen-consent');
  });

  // Explorer (freemium): no payment required, up to 50 real assessments.
  // Each user gets an isolated personal workspace derived from their Firebase
  // anonymous UID so data is real and cohort-specific, never pooled with others.
  document.getElementById('btn-explorer').addEventListener('click', () => {
    function _enterFreemium(uid) {
      // 'EXPL-' + first 8 chars of UID gives a stable, human-readable workspace key
      const freemiumKey = 'EXPL-' + uid.substring(0, 8).toUpperCase();
      window._wsMode      = 'explorer';
      window._freemiumKey = freemiumKey;
      currentWorkspace    = freemiumKey;
      workspaceProfile    = { name:'Explorer', cohortLabel:'Explorer', color:'#2ec98a', active:true, role:'explorer' };
      sessionStorage.setItem('atlas_workspace',         freemiumKey);
      sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(workspaceProfile));
      sessionStorage.setItem('atlas_ws_mode',           'explorer');
      requestGeolocation().then(() => fillSdohLocation());
      if (typeof setAppLanguage === 'function') setAppLanguage(mmasCurrentLang || 'en');
      document.body.classList.add('explorer-mode');
      enterResearcherDashboard();
      setTimeout(initExplorerExperience, 150);
    }

    // signInAnonymously() fires at page load (firebase-init.js) — auth is usually
    // already resolved. Guard with onAuthStateChanged for the rare slow-load case.
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      _enterFreemium(currentUser.uid);
    } else {
      let _done = false;
      const unsub = firebase.auth().onAuthStateChanged(function(user) {
        if (user && !_done) { _done = true; unsub(); _enterFreemium(user.uid); }
      });
      // Safety: if auth stalls 4s, generate a random key so user isn't blocked
      setTimeout(() => {
        if (!_done) {
          _done = true;
          try { unsub(); } catch(e) {}
          _enterFreemium('anon' + Math.random().toString(36).substring(2, 10));
        }
      }, 4000);
    }
  });

  // PI / Researcher / Student: workspace key required
  // Role within this path (researcher vs independent) is determined by the key,
  // not by which sub-button was clicked.
  document.getElementById('btn-researcher').addEventListener('click', () => {
    window._wsMode = 'researcher';
    const _rb = document.getElementById('entry-reset-btn'); if (_rb) _rb.style.display = '';
    setWorkspaceModalMode('researcher');
    // Restore session for any non-institution role (researcher, clinician, student, pi, observer, independent)
    const savedProfile = sessionStorage.getItem('atlas_workspace_profile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        const _nonInstRoles = new Set(['researcher','independent','clinician','student','pi','observer',
                                       'pharmacist','np','pa','rn','md','care_coordinator']);
        if (_nonInstRoles.has(p.role)) {
          if (restoreWorkspaceSession()) { enterResearcherDashboard(); return; }
        }
      } catch(e) {
        console.warn('[ATLAS] Corrupted saved profile, clearing.', e);
        sessionStorage.removeItem('atlas_workspace_profile');
      }
    }
    openWorkspaceModal();
  });

  // Institution: institution key required — role must be institution or superadmin
  document.getElementById('btn-institution').addEventListener('click', () => {
    window._wsMode = 'institution';
    const _rb2 = document.getElementById('entry-reset-btn'); if (_rb2) _rb2.style.display = '';
    setWorkspaceModalMode('institution');
    const savedProfile = sessionStorage.getItem('atlas_workspace_profile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        if (p.role === 'institution' || p.role === 'superadmin') {
          if (restoreWorkspaceSession()) { enterResearcherDashboard(); return; }
        }
      } catch(e) {
        console.warn('[ATLAS] Corrupted saved profile, clearing.', e);
        sessionStorage.removeItem('atlas_workspace_profile');
      }
    }
    openWorkspaceModal();
  });

  // ── Workspace modal ──
  document.getElementById('ws-submit').addEventListener('click', submitWorkspaceCode);
  document.getElementById('ws-cancel').addEventListener('click', closeWorkspaceModal);
  document.getElementById('ws-input').addEventListener('keydown', e => { if(e.key==='Enter') submitWorkspaceCode(); });

  // ── Consent screen ──
  document.getElementById('consent-checkbox').addEventListener('change', e => {
    document.getElementById('consent-proceed-btn').disabled = !e.target.checked;
  });

  document.getElementById('consent-proceed-btn').addEventListener('click', async () => {
    // Fire geolocation in background — don't block the screen transition
    requestGeolocation().then(() => { fillSdohLocation(); });
    // MAP — both patient and researcher paths redirect to /assess?tool=map
    // consented=1 tells assess.html to skip its own consent screen (already done here)
    // return=dashboard tells assess.html Done button to navigate back to the workspace
    if (window._postConsentInstrument === 'map') {
      window._postConsentInstrument = null;
      const lang = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang && mmasCurrentLang !== 'en') ? `&lang=${mmasCurrentLang}` : '';
      const retParam = (_postConsentTarget === 'dashboard') ? '&return=dashboard' : '';
      const wsParam  = (currentWorkspace && _postConsentTarget === 'dashboard') ? '&key=' + encodeURIComponent(currentWorkspace) : '';
      window.location.href = '/assess?tool=map&consented=1' + retParam + wsParam + lang;
      return;
    }
    // PEACS-only session — skip the MMAS form entirely
    if (window._postConsentInstrument === 'peacs') {
      window._postConsentInstrument = null;
      showScreen('screen-peacs');
      switchPeacsTab('assess');
      return;
    }
    window._postConsentInstrument = null;
    showScreen('screen-mmas');
    renderMMASQuestions();
    // If coming from the researcher dashboard, show the spectator button
    if (_postConsentTarget === 'dashboard') {
      const specBtn = document.getElementById('mmas-spectator-btn');
      if (specBtn) specBtn.style.display = 'inline-flex';
    }
    // Pre-fill session patient ID into the SDoH patient number field
    if (window._sessionData) _populateMmasFromSession();
  });

  document.getElementById('consent-back-btn').addEventListener('click', () => {
    document.getElementById('consent-checkbox').checked = false;
    document.getElementById('consent-proceed-btn').disabled = true;
    // _postConsentTarget is explicitly set to 'entry' (patient path) or 'dashboard'
    // (researcher/PI path) before consent is shown — use it directly.
    // Do NOT fall back to workspaceProfile: the patient path sets a fake explorer
    // workspaceProfile that would otherwise route patients into the researcher dashboard.
    showScreen(_postConsentTarget === 'dashboard' ? 'screen-dashboard' : 'screen-entry');
  });

  // ── MMAS screen ──
  document.getElementById('mmas-exit-btn').addEventListener('click', () => {
    showAtlasConfirm({
      title: 'Exit Assessment?',
      message: 'Your answers will be lost if you go back now.',
      onConfirm: () => {
        mmasAnswers = {};
        document.getElementById('consent-checkbox').checked = false;
        document.getElementById('consent-proceed-btn').disabled = true;
        // Return to dashboard if came from researcher path, entry if patient path
        if (_postConsentTarget === 'dashboard') {
          showScreen('screen-dashboard');
        } else {
          showScreen('screen-entry');
        }
      }
    });
  });

  document.getElementById('mmas-submit-btn').addEventListener('click', submitMMAS);

  document.getElementById('mmas-spectator-btn').addEventListener('click', enterSpectatorMode);
  document.getElementById('mmas-inline-spectator-btn').addEventListener('click', enterSpectatorMode);

  // ── Inline MMAS map globe/flat toggle ──
  document.getElementById('mmas-inline-globe-btn').addEventListener('click', () => {
    if (mmasInlineMap) { mmasInlineMap.setProjection('globe'); document.getElementById('mmas-inline-globe-btn').classList.add('active'); document.getElementById('mmas-inline-flat-btn').classList.remove('active'); }
  });
  document.getElementById('mmas-inline-flat-btn').addEventListener('click', () => {
    if (mmasInlineMap) { mmasInlineMap.setProjection('mercator'); document.getElementById('mmas-inline-flat-btn').classList.add('active'); document.getElementById('mmas-inline-globe-btn').classList.remove('active'); mmasInlineMap.flyTo({center:[0,20],zoom:1.5,duration:1000}); }
  });

  // ── Inline cohort toggle ──
  (function initInlineCohortToggle() {
    const btn = document.getElementById('mmas-inline-cohort-btn');
    if (!btn) return;
    let inlineCohortActive = false;

    function _refreshInlineCohortVisibility() {
      const wsOk = currentWorkspace &&
        currentWorkspace !== 'EXPLORER' &&
        currentWorkspace !== 'INDEPENDENT';
      btn.style.display = wsOk ? '' : 'none';
    }
    _refreshInlineCohortVisibility();

    // Re-check visibility whenever enterResearcherDashboard fires (workspace may not be set at init time)
    const _origEnter = window.enterResearcherDashboard;
    window._onResearcherLogin = window._onResearcherLogin || [];
    window._onResearcherLogin.push(_refreshInlineCohortVisibility);

    btn.addEventListener('click', () => {
      inlineCohortActive = !inlineCohortActive;
      if (inlineCohortActive) {
        btn.textContent = '🌐 Global';
        btn.style.background = 'rgba(78,156,245,0.12)';
        btn.style.borderColor = 'rgba(78,156,245,0.35)';
        btn.style.color = 'var(--base)';
        btn.title = 'Showing your cohort only — click to see global map';
        _loadInlineCohort();
      } else {
        btn.textContent = '🏛 My Cohort';
        btn.style.background = 'rgba(46,201,138,0.08)';
        btn.style.borderColor = 'rgba(46,201,138,0.25)';
        btn.style.color = 'var(--strata)';
        btn.title = 'Toggle between your cohort and the global map';
        // Restore global inline map — remove cohort markers and reload
        Object.values(mmasInlineMarkers).forEach(cl => { if (cl.marker) cl.marker.remove(); if (cl.popup) cl.popup.remove(); });
        mmasInlineMarkers = {};
        if (mmasInlineMap) {
          database.ref('mapData').once('value', snap => {
            if (!snap.exists()) return;
            snap.forEach(child => { _addInlineMarker(child.val()); });
          });
        }
      }
    });

    function _addInlineMarker(a) {
      if (!a || !a.latitude || !a.longitude || !mmasInlineMap) return;
      const key = (a.city && a.city !== 'Unknown' && a.country && a.country !== 'Unknown')
        ? (a.city + '||' + a.country).toLowerCase()
        : parseFloat(a.latitude).toFixed(2) + ',' + parseFloat(a.longitude).toFixed(2);
      if (!mmasInlineMarkers[key]) mmasInlineMarkers[key] = { count:0, scores:[], lat:parseFloat(a.latitude), lng:parseFloat(a.longitude), marker:null, popup:null };
      const loc = mmasInlineMarkers[key];
      loc.count++; loc.scores.push(a.score || 0);
      const avg = loc.scores.reduce((x,y)=>x+y,0)/loc.scores.length;
      const cat = getAdherenceCategory(avg);
      if (loc.marker) loc.marker.remove();
      const el = document.createElement('div');
      el.style.cssText = `width:${Math.min(18+loc.count*2,36)}px;height:${Math.min(18+loc.count*2,36)}px;border-radius:50%;background:${cat.color};border:2px solid rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#fff;cursor:pointer;box-shadow:0 0 8px ${cat.color}66;`;
      if (loc.count > 1) el.textContent = loc.count;
      loc.marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([loc.lng, loc.lat]).addTo(mmasInlineMap);
    }

    function _loadInlineCohort() {
      // Clear existing inline markers
      Object.values(mmasInlineMarkers).forEach(cl => { if (cl.marker) cl.marker.remove(); if (cl.popup) cl.popup.remove(); });
      mmasInlineMarkers = {};
      const wsCode = (currentWorkspace || '').toUpperCase();
      database.ref('assessments').once('value', snap => {
        if (!snap.exists()) return;
        snap.forEach(child => {
          const a = child.val();
          if (!a) return;
          if ((a.institution_code || '').toUpperCase() !== wsCode) return;
          if (!a.latitude || !a.longitude) return;
          _addInlineMarker(a);
        });
      });
    }
  })();

  // ── PEACS live map globe/flat toggle ──
  document.getElementById('peacs-globe-btn').addEventListener('click', () => {
    if (peacsMap) { peacsMap.setProjection('globe'); document.getElementById('peacs-globe-btn').classList.add('active'); document.getElementById('peacs-flat-btn').classList.remove('active'); }
  });
  document.getElementById('peacs-flat-btn').addEventListener('click', () => {
    if (peacsMap) { peacsMap.setProjection('mercator'); document.getElementById('peacs-flat-btn').classList.add('active'); document.getElementById('peacs-globe-btn').classList.remove('active'); peacsMap.flyTo({center:[0,20],zoom:1.5,duration:1000}); }
  });

  // ── MMAS tab bar ──
  let mmasInlineMapInited = false;
  // NOTE: mmasInlineMap declared at module scope below for theme-switcher access
  let mmasInlineMarkers = {}; // separate from mmasMarkersMap which feeds the standalone map screen

  document.querySelectorAll('#mmas-tab-bar .mmas-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('#mmas-tab-bar .mmas-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      const assessShell = document.getElementById('mmas-assess-shell');
      const mapShell    = document.getElementById('mmas-map-tab-shell');
      if (tab === 'map') {
        assessShell.style.display = 'none';
        mapShell.classList.add('active');
        if (!mmasInlineMapInited) {
          mmasInlineMapInited = true;
          ensureMapbox().then(() => {
            mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
            mmasInlineMap = new mapboxgl.Map({
              container: 'mmas-map-inline',
              style: window._mapboxThemeStyle || 'mapbox://styles/mapbox/dark-v11',
              center: [0, 20], zoom: 2, projection: 'globe'
            });
            mmasInlineMap.addControl(new mapboxgl.NavigationControl());
            mmasInlineMap.on('load', () => {
              const fog = window._mapboxFog || {
                color: '#04091c', 'high-color': '#0d1a3a',
                'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
              };
              mmasInlineMap.setFog(fog);
              database.ref('mapData').once('value', snap => {
                const data = snap.val(); if (!data) return;
                let total=0, countries=new Set(), scoreSum=0;
                Object.values(data).forEach(a => {
                  if (!a.latitude||!a.longitude) return;
                  total++; scoreSum+=a.score||0;
                  if(a.country && a.country !== 'Unknown') countries.add(a.country);
                  addMmasInlineMarker(a);
                });
                const te=document.getElementById('mmas-tab-total'); if(te)te.textContent=total.toLocaleString();
                const ce=document.getElementById('mmas-tab-countries'); if(ce)ce.textContent=countries.size;
                const ae=document.getElementById('mmas-tab-avg'); if(ae&&total>0){ const tabAvg=scoreSum/total; ae.textContent=(!isNaN(tabAvg)?tabAvg.toFixed(2):'—'); }
              });
              // Live listener — guarded so tab re-opens don't stack listeners
              if (!window._mmasInlineMapListener) {
                const since=Date.now();
                window._mmasInlineMapListener = database.ref('mapData').on('child_added', snap=>{
                  const a=snap.val();
                  if(a.timestamp>since && a.latitude && a.longitude) addMmasInlineMarker(a);
                });
              }
            });
          }); // end ensureMapbox
        } else {
          setTimeout(() => mmasInlineMap && mmasInlineMap.resize(), 100);
        }
      } else {
        mapShell.classList.remove('active');
        assessShell.style.display = '';
      }
    });
  });

  function addMmasInlineMarker(a) {
    if (!mmasInlineMap || !a.latitude || !a.longitude) return;
    const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
    if (!mmasInlineMarkers[key]) mmasInlineMarkers[key]={count:0,scores:[],records:[],marker:null,popup:null,popupIdx:0,lat:parseFloat(a.latitude),lng:parseFloat(a.longitude)};
    const loc = mmasInlineMarkers[key];
    loc.count++; loc.scores.push(a.score||0); loc.records.push(a);
    const avg = loc.scores.reduce((x,y)=>x+y,0)/loc.scores.length;
    const cat2 = getAdherenceCategory(avg);
    if (loc.marker) { loc.marker.remove(); }
    const sz = Math.min(16+loc.count*2,36);
    const el = document.createElement('div');
    el.style.cssText='width:0;height:0;position:relative;cursor:pointer;';
    const dot = document.createElement('div');
    dot.style.cssText=`position:absolute;width:${sz}px;height:${sz}px;top:${-sz/2}px;left:${-sz/2}px;border-radius:50%;background:${cat2.color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:10px;transition:transform 0.18s,box-shadow 0.18s;transform-origin:center center;`;
    if(loc.count>1) dot.textContent=loc.count;
    el.appendChild(dot);
    const iKey = 'inline:'+key;
    loc.popup = new mapboxgl.Popup({offset:sz/2+4,maxWidth:'310px',closeButton:true,closeOnClick:false})
      .setLngLat([loc.lng,loc.lat]);
    el.addEventListener('click',(e)=>{
      e.stopPropagation();
      dot.style.transform='scale(1.4)';
      loc.popup.setHTML(buildMmasPopupHTML(loc.records, loc.popupIdx));
      loc.popup.addTo(mmasInlineMap);
      setTimeout(()=>{
        const w=loc.popup.getElement()&&loc.popup.getElement().querySelector('.mapboxgl-popup-content');
        if(w) w.dataset.mmasKey=iKey;
        dot.style.transform='';
      },15);
    });
    loc.popup.on('close',()=>{ dot.style.transform=''; });
    if (!window._mmasInlineClusters) window._mmasInlineClusters = {};
    window._mmasInlineClusters[iKey] = loc;
    el.addEventListener('mouseenter',()=>{ dot.style.boxShadow=`0 4px 18px ${cat2.color}99`; });
    el.addEventListener('mouseleave',()=>{ dot.style.boxShadow='0 2px 8px rgba(0,0,0,0.4)'; });
    loc.marker = new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([loc.lng,loc.lat]).addTo(mmasInlineMap);
  }

  // ── Spectator ──
  document.getElementById('spectator-exit-btn').addEventListener('click', exitSpectatorMode);

  document.querySelectorAll('.cine-collapse-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body = document.getElementById(btn.getAttribute('data-target'));
      if (!body) return;
      // Use the button label (not absent inline style) to determine current state.
      // '−' means currently open → collapse. '+' means currently closed → expand.
      const isMobile = window.innerWidth <= 480;
      const expandH  = isMobile ? '50vh' : '1000px';
      const isOpen   = btn.textContent.trim() === '−';
      body.style.maxHeight = isOpen ? '0px' : expandH;
      body.style.overflow  = isOpen ? 'hidden' : '';
      btn.textContent = isOpen ? '+' : '−';
    });
  });

  // ── Dashboard ──
  initCountdown();
  // QR code — points to current page URL (initialised once)
  (function(){
    const qrImg = document.getElementById('entry-qr-img');
    if (qrImg) {
      const pageUrl = window.location.href.split('?')[0];
      qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=' + encodeURIComponent(pageUrl) + '&format=png&ecc=M';
    }
  })();
  initZoeButtons();

  // Session handoff via query string ?ws=KEY&mode=institution&go=1
  // SECURITY: ?ws= alone (without &go=1&mode=) is reserved for patient QR scan links.
  //   If a patient QR URL (?ws=KEY or ?ws=KEY&lang=X, no &go=1) hits this page,
  //   redirect immediately to /assess so the patient sees the assessment only,
  //   never the researcher dashboard. Old printed QR codes that still carry &go=1
  //   are also redirected to /assess — researcher dashboard access requires an
  //   authenticated session initiated by the workspace owner, not a scannable link.
  (function checkQueryHandoff() {
    const params  = new URLSearchParams(window.location.search);
    const wsKey   = params.get('ws');
    if (!wsKey) return;

    const goNow   = params.get('go') === '1';
    const hasMode = params.has('mode'); // internal institution handoff always includes mode=

    // ── Patient QR guard ────────────────────────────────────────────────────
    // Any ?ws= link that lacks an explicit mode= is a patient QR scan.
    // Redirect to /assess — the patient assessment page — and never proceed
    // to enterResearcherDashboard(). &go=1 alone is NOT sufficient to open the
    // researcher dashboard via a QR link; only authenticated session restore does.
    if (!hasMode) {
      const lang   = params.get('lang') || 'en';
      window.location.replace(`${window.location.origin}/assess?ws=${encodeURIComponent(wsKey)}&lang=${encodeURIComponent(lang)}`);
      return;
    }

    // ── Internal researcher / institution session handoff ────────────────────
    // mode= is present — this is a researcher-initiated link (not a patient QR).
    const mode = params.get('mode') === 'institution' ? 'institution' : 'researcher';
    window._wsMode = mode;
    setWorkspaceModalMode(mode);
    if (goNow) {
      validateWorkspaceCode(wsKey).then(profile => {
        if (profile && profile.active !== false) {
          currentWorkspace = wsKey.toUpperCase();
          workspaceProfile = profile;
          _normalizeInstType(workspaceProfile);
          sessionStorage.setItem('atlas_workspace', wsKey.toUpperCase());
          sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(profile));
          sessionStorage.setItem('atlas_ws_mode', mode);
          enterResearcherDashboard();
        } else {
          document.getElementById('ws-input').value = wsKey.toUpperCase();
          openWorkspaceModal();
        }
      });
    } else {
      document.getElementById('ws-input').value = wsKey.toUpperCase();
      openWorkspaceModal();
    }
  })();

  // Wait for anonymous auth before fetching entry stats.
  // signInAnonymously is async — if initEntryLiveCounter fires before it
  // resolves the Firebase reads fail silently. onAuthStateChanged guarantees
  // we have a valid session (anonymous or workspace) before reading.
  firebase.auth().onAuthStateChanged(function(user) {
    if (user && !window._elcInited) {
      initEntryLiveCounter();
    }
  });

  // Deep link: ?spectator=1 opens cinematic mode directly
  // Share this URL during LinkedIn Live so viewers watch the globe in real time
  (function checkSpectatorParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spectator') === '1') {
      // Wait for maps to init before entering spectator
      setTimeout(() => {
        showScreen('screen-mmas');
        setTimeout(enterSpectatorMode, 400);
      }, 600);
    }
  })();

  // ── Patient Portal ──────────────────────────────────
  (function checkPatientPortal() {
    const params = new URLSearchParams(window.location.search);
    const portalPid = params.get('portal') || params.get('patient_portal');
    if (!portalPid) return;
    // Show portal screen immediately
    const screen = document.getElementById('patient-portal-screen');
    if (screen) screen.classList.add('active');
    // Load patient data
    loadPatientPortalData(portalPid);
  })();

  document.getElementById('irb-cert-btn').addEventListener('click', generateIRBCertificate);
  document.getElementById('cite-btn').addEventListener('click', showCitationModal);

  document.getElementById('dash-new-session-btn').addEventListener('click', () => {
    removeExplorerBanner();
    showAtlasConfirm({
      title: 'Start a New Session?',
      message: 'This will clear all current workspace data and return you to the entry screen.',
      onConfirm: () => {
    // Clear all session state
    currentWorkspace = null;
    workspaceProfile = null;
    userLocation = null;
    mmasAnswers = {};
    peacsState = { base:{}, mvmt:{}, strata:{} };
    mmasMarkersMap = {};
    mmasTotal = 0;
    mmasCountries = new Set();
    dashMmasData = [];
    dashPeacsData = [];
    _allowedWSCache = null; _allowedWSCacheKey = null; // invalidate workspace cache
    spectatorActive = false;
    spectatorMapInited = false;
    spectatorMap = null;
    dashMiniMmasInited = false;
    dashMiniPeacsInited = false;
    dashMiniMapInited = false;
    dashMiniMmas = null;
    dashMiniPeacs = null;
    dashMiniMap = null;
    window._miniMmasLiveInited = false;
    window._miniMapLiveInited = false;
    peacsMapInited = false;
    peacsMap = null;
    _sentinelListener = null;
    _sentinelReviewedKeys = new Set();
    const sp = document.getElementById('sentinel-panel');
    if (sp) sp.remove();
    if (typeof tourTimeout !== 'undefined' && tourTimeout) clearTimeout(tourTimeout);
    sessionStorage.clear();
    document.body.classList.remove('researcher-mode','patient-mode');
    // Reset mode banner
    const banner = document.getElementById('dash-context-banner');
    if (banner) { banner.style.display='none'; banner.textContent=''; }
    // Reset workspace chip
    document.getElementById('dash-workspace-label').textContent = 'Workspace';
    showScreen('screen-entry');
    showToast('Session cleared. Welcome back.', 2500);
      }
    });
  });

  document.getElementById('dash-exit-btn').addEventListener('click', () => {
    sessionStorage.removeItem('atlas_workspace');
    sessionStorage.removeItem('atlas_workspace_profile');
    currentWorkspace = null; workspaceProfile = null;
    showScreen('screen-entry');
  });

  // ── Condition multi-select: show/hide Other field ──
  const condSel = document.getElementById('sdoh-condition');
  if (condSel) {
    condSel.addEventListener('change', () => {
      const selected = Array.from(condSel.selectedOptions).map(o => o.value).filter(v => v && v !== '');
      const hasOther = selected.includes('Other');
      document.getElementById('sdoh-condition-other').style.display = hasOther ? 'block' : 'none';
      const display = document.getElementById('sdoh-condition-display');
      if (display) {
        if (selected.length === 0) {
          display.style.display = 'none';
        } else {
          const labels = selected.map(v => v === 'Other' ? 'Other (specify below)' : v);
          display.textContent = '✓ ' + labels.join(' · ');
          display.style.display = 'block';
        }
      }
    });
  }

  document.getElementById('dash-spectator-btn').addEventListener('click', () => {
    enterSpectatorMode();
  });

  document.getElementById('mmas-refresh-btn').addEventListener('click', loadMmasCohortData);
  document.getElementById('peacs-refresh-btn').addEventListener('click', loadPeacsCohortData);
  document.getElementById('mapc-refresh-btn').addEventListener('click', function() { _renderMapRecordsTab(dashMmasData); });
  document.getElementById('mmas-export-btn').addEventListener('click', exportMmasCSV);
  document.getElementById('peacs-export-btn').addEventListener('click', exportPeacsCSV);
  document.getElementById('pi-blinded-export-btn').addEventListener('click', exportBlindedMmasCSV);
  document.getElementById('mapc-export-btn').addEventListener('click', exportMapCSV);

  // ── Close View-As panel on outside click ──
  document.addEventListener('click', e => {
    const toolbar = document.getElementById('va-toolbar');
    const panel   = document.getElementById('va-panel');
    if (panel && panel.classList.contains('open') && toolbar && !toolbar.contains(e.target)) {
      panel.classList.remove('open');
      document.getElementById('va-toggle-btn')?.classList.remove('panel-open');
    }
  }, { capture: false });

  // ── Records panel tabs ──
  document.querySelectorAll('.mc-rec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.rtab;
      document.querySelectorAll('.mc-rec-tab').forEach(b => b.classList.toggle('active', b.dataset.rtab === tab));
      document.getElementById('mc-rtab-mmas').style.display = tab === 'mmas' ? '' : 'none';
      document.getElementById('mc-rtab-peacs').style.display = tab === 'peacs' ? '' : 'none';
      document.getElementById('mc-rtab-map').style.display = tab === 'map' ? '' : 'none';
      // Show correct refresh button
      document.getElementById('mmas-refresh-btn').style.display = tab === 'mmas' ? '' : 'none';
      document.getElementById('peacs-refresh-btn').style.display = tab === 'peacs' ? '' : 'none';
      document.getElementById('mapc-refresh-btn').style.display = tab === 'map' ? '' : 'none';
    });
  });

  // ── MMAS Map screen ──
  document.getElementById('mmas-map-back-btn').addEventListener('click', () => showScreen('screen-dashboard'));
  document.getElementById('map-export-btn').addEventListener('click', exportMmasCSV);
  document.getElementById('map-refresh-btn').addEventListener('click', () => {
    if (mmasMapInstance) {
      // Remove only tracked MMAS markers — never touch spectator or mini-map markers
      Object.values(mmasMarkersMap).forEach(cl => { if (cl.marker) cl.marker.remove(); if (cl.popup) cl.popup.remove(); });
      mmasMarkersMap={}; mmasTotal=0; mmasCountries=new Set(); mmasCountryData={};
      window._mmasLiveListenerActive = false;
      loadMmasMapData();
    }
  });
  document.getElementById('map-spectator-btn').addEventListener('click', enterSpectatorMode);
  document.getElementById('globe-btn').addEventListener('click', () => {
    if (mmasMapInstance) { mmasMapInstance.setProjection('globe'); document.getElementById('globe-btn').classList.add('active'); document.getElementById('flat-btn').classList.remove('active'); }
  });
  document.getElementById('flat-btn').addEventListener('click', () => {
    if (mmasMapInstance) { mmasMapInstance.setProjection('mercator'); document.getElementById('flat-btn').classList.add('active'); document.getElementById('globe-btn').classList.remove('active'); mmasMapInstance.flyTo({center:[0,20],zoom:1.5,duration:1000}); }
  });
  document.getElementById('map-heatmap-btn').addEventListener('click', toggleMmasHeatmap);

  // ── Cohort Toggle: show only for researcher / institution workspaces ──
  (function initCohortToggle() {
    const btn = document.getElementById('map-cohort-toggle-btn');
    if (!btn) return;
    // Only visible when a real workspace key is active (not explorer, not unauthenticated)
    const canFilter = typeof isResearcherMode === 'function'
      ? (isResearcherMode() || isInstitutionMode())
      : (currentWorkspace && currentWorkspace !== 'EXPLORER' && currentWorkspace !== 'INDEPENDENT');
    if (!canFilter) return;
    btn.style.display = '';

    let cohortActive = false;

    btn.addEventListener('click', () => {
      cohortActive = !cohortActive;
      if (cohortActive) {
        btn.textContent = '🌐 Global';
        btn.style.background = 'rgba(78,156,245,0.12)';
        btn.style.borderColor = 'rgba(78,156,245,0.35)';
        btn.style.color = 'var(--base)';
        btn.title = 'Showing your cohort only — click to see global map';
        _loadCohortOnlyMap();
      } else {
        btn.textContent = '🏛 My Cohort';
        btn.style.background = 'rgba(46,201,138,0.08)';
        btn.style.borderColor = 'rgba(46,201,138,0.25)';
        btn.style.color = 'var(--strata)';
        btn.title = 'Toggle between your cohort and the global map';
        // Restore full global map
        Object.values(mmasMarkersMap).forEach(cl => { if (cl.marker) cl.marker.remove(); if (cl.popup) cl.popup.remove(); });
        mmasMarkersMap = {}; mmasTotal = 0; mmasCountries = new Set(); mmasCountryData = {};
        mmasListening = false;
        loadMmasMapData();
      }
    });

    function _loadCohortOnlyMap() {
      // Clear existing markers
      Object.values(mmasMarkersMap).forEach(cl => { if (cl.marker) cl.marker.remove(); if (cl.popup) cl.popup.remove(); });
      mmasMarkersMap = {}; mmasTotal = 0; mmasCountries = new Set(); mmasCountryData = {};
      mmasListening = true; // prevent auto-global reload

      const wsCode = (currentWorkspace || '').toUpperCase();
      database.ref('assessments').once('value', snap => {
        if (!snap.exists()) return;
        snap.forEach(child => {
          const a = child.val();
          if (!a) return;
          // Filter: institution_code must match current workspace
          const ic = (a.institution_code || '').toUpperCase();
          if (ic !== wsCode) return;
          if (!a.latitude || !a.longitude) return;
          // Normalize to addMmasMarker's expected shape
          addMmasMarker({
            score: a.score || 0,
            latitude: a.latitude,
            longitude: a.longitude,
            country: a.country || 'Unknown',
            city: a.city || 'Unknown',
            timestamp: a.timestamp,
            patient_number: a.patient_number,
            condition: a.condition,
            q1: a.q1, q2: a.q2, q3: a.q3, q4: a.q4,
            q5: a.q5, q6: a.q6, q7: a.q7, q8: a.q8
          });
        });
        updateMmasMapStats();
      });
    }
  })();

  // ── PEACS screen ──
  document.getElementById('peacs-back-btn').addEventListener('click', () => showScreen('screen-dashboard'));
  document.getElementById('peacs-tab-bar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn && !btn.disabled && btn.dataset.tab) switchPeacsTab(btn.dataset.tab);
  });
  document.getElementById('peacs-spectator-btn').addEventListener('click', enterPeacsSpectatorMode);
  document.getElementById('peacs-spectator-exit-btn').addEventListener('click', exitPeacsSpectatorMode);

  // ── Data Tools ──
  document.getElementById('dash-bulk-btn').addEventListener('click', e => { e.stopPropagation(); openBulkUpload(); });
  document.getElementById('dash-mmas-export-btn').addEventListener('click', e => { e.stopPropagation(); exportMmasCSV(); });
  document.getElementById('dash-qr-btn').addEventListener('click', e => { e.stopPropagation(); openPatientQR(); });
  document.getElementById('dash-export-btn').addEventListener('click', e => { e.stopPropagation(); exportPeacsCSV(); });
  // MAP card — show MAP informed consent first, then redirect to /assess?tool=map on proceed
  const mapCard = document.getElementById('dash-launch-map');
  if (mapCard) mapCard.addEventListener('click', () => {
    window._postConsentInstrument = 'map';
    _postConsentTarget = 'dashboard';
    document.getElementById('consent-checkbox').checked = false;
    document.getElementById('consent-proceed-btn').disabled = true;
    renderConsentForInstrument('map');
    showScreen('screen-consent');
  });
  // MAP card click is the sole entry point — no separate launch button
  document.getElementById('bulk-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so same file can be re-selected after acknowledgement
    e.target.value = '';
    // Show acknowledgement modal before processing
    _showBulkAcknowledgement(file);
  });

});

// ── Hard reset — global, callable from onclick on entry screen ───────────────
function hardResetApp() {
  // Remove ATLAS Control button immediately on any reset
  const ccBtn = document.getElementById('acc-open-btn');
  if (ccBtn) ccBtn.remove();
  const ccDiv = document.getElementById('acc-open-divider');
  if (ccDiv) ccDiv.remove();
  const hasSession = !!(currentWorkspace || Object.keys(mmasAnswers||{}).length > 0);
  const doReset = () => {
    currentWorkspace    = null;
    workspaceProfile    = null;
    userLocation        = null;
    mmasAnswers         = {};
    if (typeof peacsState      !== 'undefined') peacsState      = { base:{}, mvmt:{}, strata:{} };
    if (typeof mmasMarkersMap  !== 'undefined') mmasMarkersMap  = {};
    if (typeof mmasCountries   !== 'undefined') mmasCountries   = new Set();
    mmasTotal           = 0;
    dashMmasData        = [];
    dashPeacsData       = [];
    spectatorActive     = false;
    spectatorMapInited  = false;
    spectatorMap        = null;
    dashMiniMmasInited  = false;
    dashMiniPeacsInited = false;
    dashMiniMapInited   = false;
    dashMiniMmas        = null;
    dashMiniPeacs       = null;
    dashMiniMap         = null;
    window._miniMmasLiveInited = false;
    window._miniMapLiveInited  = false;
    if (typeof peacsMapInited  !== 'undefined') peacsMapInited  = false;
    if (typeof peacsMap        !== 'undefined') peacsMap        = null;
    _sentinelListener   = null;
    if (typeof _sentinelReviewedKeys !== 'undefined') _sentinelReviewedKeys = new Set();
    const sp = document.getElementById('sentinel-panel');
    if (sp) sp.remove();
    if (typeof tourTimeout !== 'undefined' && tourTimeout) clearTimeout(tourTimeout);
    if (window._countdownInterval) { clearInterval(window._countdownInterval); window._countdownInterval = null; }
    ['atlas_workspace','atlas_workspace_profile','atlas_consent','atlas_sdoh'].forEach(k => {
      try { sessionStorage.removeItem(k); } catch(e) {}
    });
    try { localStorage.removeItem('atlas_user_id'); } catch(e) {} // force new device ID for next user
    document.body.classList.remove('researcher-mode','patient-mode','clinic-mode');
    const clinicBar = document.getElementById('clinic-mode-bar');
    if (clinicBar) clinicBar.classList.remove('active');
    const banner = document.getElementById('dash-context-banner');
    if (banner) { banner.style.display='none'; banner.textContent=''; }
    const wsLabel = document.getElementById('dash-workspace-label');
    if (wsLabel) wsLabel.textContent = 'Workspace';
    const cb = document.getElementById('consent-checkbox');
    if (cb) cb.checked = false;
    const procBtn = document.getElementById('consent-proceed-btn');
    if (procBtn) procBtn.disabled = true;
    // Sign out of Firebase so a next user on a shared device cannot
    // access the previous user's authenticated session or data.
    try {
      if (firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.auth().signOut().catch(() => {});
      }
    } catch(e) {}
    showScreen('screen-entry');
    initCountdown();
    showToast('Session cleared.', 2000);
  };
  if (hasSession) {
    showAtlasConfirm({
      title: 'Reset Session?',
      message: 'This will clear all current data and return you to the home screen.',
      onConfirm: doReset
    });
  } else {
    doReset();
  }
}


