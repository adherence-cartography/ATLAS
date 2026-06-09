// ══════════════════════════════════════════════
// ATLAS DOMAIN LOCK
// MMAS-8 © Donald E. Morisky. Licensed exclusively to Adherence Inc.
// ATLAS platform © Adherence Inc. Unauthorized use prohibited.
// See: adherence.cc/license
// ══════════════════════════════════════════════
(function() {
  const ALLOWED = [
    'atlas.adherence.cc',
    'www.atlas.adherence.cc',
    'localhost',
    '127.0.0.1'
  ];
  const host = window.location.hostname.toLowerCase();
  if (!ALLOWED.some(d => host === d || host.endsWith('.' + d))) {
    document.body.innerHTML = '<div style="font-family:monospace;padding:40px;color:#c0392b;">ATLAS: Unauthorized domain. This platform is licensed exclusively to Adherence Inc. Contact info@adherence.cc.</div>';
    throw new Error('ATLAS: Unauthorized domain — ' + host);
  }
})();
// ══════════════════════════════════════════════
// FIREBASE — single init, shared across all screens
// ══════════════════════════════════════════════
const firebaseConfig = {
  apiKey:"AIzaSyBRUEGRPaIWHMlzn0lT9otbJQEYZs4Br1A",
  authDomain:"adherence-project-2026.firebaseapp.com",
  databaseURL:"https://adherence-project-2026-default-rtdb.firebaseio.com",
  projectId:"adherence-project-2026",
  storageBucket:"adherence-project-2026.firebasestorage.app",
  messagingSenderId:"222566948658",
  appId:"1:222566948658:web:85528e19dd039c199a412b"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ── Public stats aggregate ────────────────────────────────────────────────────
// /public_stats is a publicly-readable node that mirrors aggregate counts from
// /assessments so the adherence.cc website can display live stats without
// requiring auth on the private PII node.
/**
 * Sanitizes a country string into a valid Firebase key by replacing forbidden characters.
 * @param {string} c - Country name or raw string
 * @returns {string} Firebase-safe key string
 */
function sanitizeCountryKey(c) {
  return (c||'unknown').trim().replace(/[.#$\/\[\]]/g,'_')||'unknown';
}
/**
 * Increments /public_stats counters (total, score_sum, high_count, countries) for a new
 * MMAS-8 submission. Skips invalid scores silently.
 * @param {number|string} score - MMAS-8 total score (0–8)
 * @param {string} country - Country name used to derive the Firebase key
 * @returns {void}
 */
function updatePublicStats(score, country) {
  const s = parseFloat(score);
  if (isNaN(s) || s < 0) return; // skip invalid / rapid-only scores
  // public_stats is intentionally written to the global Firebase instance (US)
  // as it contains only anonymized aggregate counts, not individual records.
  // This is by design per the ATLAS data architecture.
  const sr = database.ref('public_stats');
  sr.child('total').transaction(n => (n||0)+1);
  sr.child('score_sum').transaction(n => (n||0)+s);
  if (s >= 6) sr.child('high_count').transaction(n => (n||0)+1);
  const ck = sanitizeCountryKey(country);
  if (ck && ck !== 'unknown') sr.child('countries/'+ck).set(true);
}
/**
 * Increments /peacs_public_stats counters (total, score_sum, high_count) for a new PEACS submission.
 * @param {number|string} pe_score - PEACS PE composite score (0–1)
 * @returns {void}
 */
function updatePeacsPublicStats(pe_score) {
  const s = parseFloat(pe_score);
  if (isNaN(s) || s < 0) return;
  const pr = database.ref('peacs_public_stats');
  pr.child('total').transaction(n => (n||0)+1);
  pr.child('score_sum').transaction(n => (n||0)+s);
  if (s >= 0.6) pr.child('high_count').transaction(n => (n||0)+1);
}
// Seed /public_stats once from /assessments when the node is missing.
// Runs on every authenticated ATLAS app load; exits immediately if already seeded.
/**
 * Seeds /public_stats from the /assessments node if the stats node is absent.
 * Runs on every authenticated load but exits immediately when already seeded.
 * @returns {void}
 */
function seedPublicStatsIfMissing() {
  database.ref('public_stats/total').once('value', snap => {
    if (snap.val() !== null) return;
    database.ref('assessments').once('value', snap2 => {
      const raw = snap2.val();
      if (!raw) return;
      const all = Object.values(raw);
      let total=0, scoreSum=0, highCount=0;
      const countries={};
      all.forEach(r => {
        const s = parseFloat(r.score);
        if (isNaN(s)||s<0) return;
        total++; scoreSum+=s; if(s>=6) highCount++;
        const ck = sanitizeCountryKey(r.country);
        if (ck&&ck!=='unknown') countries[ck]=true;
      });
      database.ref('public_stats').set({total,score_sum:scoreSum,high_count:highCount,countries});
    });
  });
}
/**
 * Seeds /peacs_public_stats from the /peacs_assessments node if the stats node is absent.
 * @returns {void}
 */
function seedPeacsPublicStatsIfMissing() {
  database.ref('peacs_public_stats/total').once('value', snap => {
    if (snap.val() !== null) return;
    database.ref('peacs_assessments').once('value', snap2 => {
      const raw = snap2.val();
      if (!raw) return;
      const all = Object.values(raw);
      let total=0, scoreSum=0, highCount=0;
      all.forEach(r => {
        const s = parseFloat(r.pe ?? r.pe_score ?? r.base);
        if (isNaN(s)||s<0) return;
        total++; scoreSum+=s; if(s>=0.6) highCount++;
      });
      database.ref('peacs_public_stats').set({total,score_sum:scoreSum,high_count:highCount});
    });
  });
}
seedPublicStatsIfMissing();
seedPeacsPublicStatsIfMissing();
// Anonymous sign-in: gives every visitor a Firebase session so public
// reads (entry stats, map) work under auth!=null rules. Overridden by
// signInWithCustomToken when a workspace key is entered.
firebase.auth().signInAnonymously().catch(e => console.warn('[ATLAS] Anonymous auth failed:', e.code, e.message));

// ── Session expiry guard ──────────────────────────────────────────────────────
// Firebase auto-refreshes ID tokens every ~59 min while the page is open.
// This catches the edge case where the session fully expires (e.g. tab left open
// overnight with no network) and the user still has an active workspace loaded.
firebase.auth().onIdTokenChanged(function(user) {
  if (!user && currentWorkspace) {
    // Session expired unexpectedly — workspace data may no longer be accessible
    currentWorkspace = null;
    workspaceProfile = null;
    try { sessionStorage.removeItem('atlas_workspace'); sessionStorage.removeItem('atlas_workspace_profile'); } catch(e) {}
    showToast('Your session has expired — please re-enter your workspace key to continue.', 8000);
    // Re-establish anonymous auth so public Firebase reads still work
    firebase.auth().signInAnonymously().catch(() => {});
  }
});

// ── Cherry 1: Offline persistence — assessments survive connectivity drops.
// Critical for LMIC deployments where network is intermittent.
// Firebase queues writes locally and syncs when connection restores.
try { firebase.database().goOnline(); } catch(e) {}
(function enableOfflinePersistence() {
  // keepSynced removed — it held the full assessments + peacs_assessments nodes
  // in device memory permanently, causing progressive slowdown especially on
  // mobile and low-RAM devices. Writes still queue offline via Firebase's built-in
  // offline support; reads use normal on-demand fetching.
})();

// ══════════════════════════════════════════════
// ATLAS AUDIT LOG
// Non-blocking write to /audit_log on every
// significant researcher / admin data access.
// Readable only by superadmin (enforced in
// Firebase rules). Never throws or blocks UI.
// ══════════════════════════════════════════════
function atlasAuditLog(action, meta) {
  const user = firebase.auth().currentUser;
  if (!user || user.isAnonymous) return;
  const ws   = (typeof currentWorkspace !== 'undefined' && currentWorkspace) ? currentWorkspace : null;
  const role = (typeof workspaceProfile !== 'undefined' && workspaceProfile && workspaceProfile.role) ? workspaceProfile.role : null;
  const entry = {
    action:    String(action).slice(0, 80),
    timestamp: Date.now(),
    uid:       user.uid,
    workspace: ws,
    role,
  };
  if (meta && typeof meta === 'object') {
    const SAFE = ['records','workspace','screen','export_type','filter','count','tier','instrument','rows'];
    SAFE.forEach(k => {
      if (meta[k] !== undefined) {
        const v = meta[k];
        // Strip HTML from string values to prevent stored XSS
        entry[k] = typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v;
      }
    });
  }

  // BP-SEC-09: Exponential backoff retry — up to 3 attempts (delays: 500ms, 1000ms, 2000ms)
  const _AUDIT_DELAYS = [500, 1000, 2000];
  let _auditAttempt = 0;

  function _attemptWrite() {
    atlasDB('audit_log').push(entry)
      .then(function() {
        // Success — also write to per-workspace audit log for PI visibility
        // Secondary write in its own chain — failures here don't trigger primary retry
        if (ws && (role === 'pi' || role === 'institution' || role === 'superadmin')) {
          atlasDB('ws_audit/' + ws).push({ action: entry.action, ts: entry.timestamp, uid: entry.uid })
            .catch(function(e) {
              console.warn('[ATLAS] ws_audit secondary write failed:', e && e.message);
            });
        }
      })
      .catch(function(err) {
        console.error('[ATLAS-AUDIT] Write attempt', _auditAttempt + 1, 'failed:', err && err.message);
        if (_auditAttempt < _AUDIT_DELAYS.length) {
          const delay = _AUDIT_DELAYS[_auditAttempt];
          _auditAttempt++;
          setTimeout(_attemptWrite, delay);
        } else {
          // All 3 attempts exhausted — write failure record and notify user
          console.error('[ATLAS-AUDIT] All retry attempts failed for action:', entry.action);
          try {
            database.ref('errors').push({
              type:  'AUDIT_WRITE_FAILURE',
              entry: entry,
              error: (err && err.message) || 'unknown',
              ts:    Date.now(),
            }).catch(function() {});
          } catch(e2) {}
          if (typeof showToast === 'function') {
            showToast('Audit record could not be saved. Please contact support if this persists.', 6000);
          }
        }
      });
  }

  _attemptWrite();
}

// Escape user-sourced strings before inserting into innerHTML contexts
