// ══════════════════════════════════════════════════════════════════════════════
// ATLAS DB SHIM — UAE Data Residency Layer
// ══════════════════════════════════════════════════════════════════════════════
//
// Presents the same API as Firebase's database.ref() but routes writes through
// the ATLAS Lambda → DynamoDB in AWS me-central-1 (Abu Dhabi, UAE).
//
// Strategy during migration: DUAL WRITE (Phase 1 — default)
//   Every write goes to BOTH Firebase (existing reads stay intact) AND DynamoDB
//   (UAE data residency).
//
// Phase 2 — dyna_only flag (per-workspace in workspaceProfile):
//   When workspaceProfile.dyna_only === true:
//     • Writes go ONLY to DynamoDB (Firebase writes are suppressed).
//     • .once() reads on DYNA_PATHS are served from DynamoDB via atlasDB.query().
//     • .on() listeners fall back to a one-time DynamoDB fetch (no real-time push).
//   To activate for an ALTHIQA workspace: set dyna_only:true in its SSM profile.
//
// Usage — replace database.ref() with atlasDB():
//   Old: database.ref('assessments').push(data)
//   New: atlasDB('assessments').push(data)
//
// MMAS-8 © Donald E. Morisky. Licensed exclusively to Adherence Inc.
// ATLAS platform © Adherence Inc. Unauthorized use prohibited.
// ══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // UAE workspaces (ALTHIQA-*) route to me-central-1 (Abu Dhabi, UAE).
  // All other workspaces route to us-east-1 (existing infrastructure).
  const LAMBDA_URL_UAE = '/lambda-proxy-uae';
  const LAMBDA_URL_US  = 'https://fv3y62xuce6w3t37oj73x5gzcq0uwdqo.lambda-url.us-east-1.on.aws';

  function _lambdaUrl() {
    const ws = (typeof currentWorkspace !== 'undefined') ? currentWorkspace : '';
    return (ws && ws.startsWith('ALTHIQA')) ? LAMBDA_URL_UAE : LAMBDA_URL_US;
  }

  // Paths routed through DynamoDB (UAE). All others fall through to Firebase only.
  const DYNA_PATHS = new Set([
    'assessments',
    'peacs_assessments',
    'peacs_dimensions',
    'peacs_dimension_history',
    'audit_log',
    'ws_audit',
  ]);

  // Map Firebase path names → Lambda op names
  const PATH_TO_OP = {
    'assessments':              'push_assessment',
    'peacs_assessments':        'push_peacs',
    'peacs_dimensions':         'set_peacs_dim',
    'peacs_dimension_history':  'set_peacs_dim',  // history handled server-side
    'audit_log':                'push_audit',
    'ws_audit':                 'push_audit',
  };

  // ── dyna_only flag ───────────────────────────────────────────────────────────
  // Returns true when the current workspace has opted into Phase 2 (DynamoDB-only
  // reads and writes). Set workspaceProfile.dyna_only = true in SSM to activate.
  function _isDynaOnly() {
    try {
      const profile = (typeof workspaceProfile !== 'undefined') ? workspaceProfile : null;
      return !!(profile && profile.dyna_only);
    } catch(e) { return false; }
  }

  // ── Firebase-snapshot shim ────────────────────────────────────────────────────
  // Converts a DynamoDB query array into an object that behaves like a Firebase
  // DataSnapshot — covers .val(), .exists(), .forEach(), and .child() so existing
  // dashboard read callbacks work without modification.
  function _arrayToSnapshot(arr, path) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return { val: () => null, exists: () => false, forEach: () => {}, child: () => _arrayToSnapshot([], '') };
    }
    // Build a keyed map. DynamoDB items carry an 'id' or 'sk' field; fall back to index.
    const obj = {};
    arr.forEach((item, idx) => {
      const key = item.id || item.sk || String(idx);
      obj[key] = item;
    });
    return {
      val:     () => obj,
      exists:  () => true,
      key:     path ? path.split('/').pop() : null,
      forEach: (fn) => {
        let stopped = false;
        for (const [k, v] of Object.entries(obj)) {
          if (stopped) break;
          if (fn(_arrayToSnapshot([v], k)) === true) stopped = true;
        }
      },
      child: (seg) => {
        const item = obj[seg];
        return item ? _arrayToSnapshot([item], seg) : _arrayToSnapshot([], seg);
      },
    };
  }

  // ── Token helper ─────────────────────────────────────────────────────────────
  // Gets the Firebase ID token (already cached by Firebase SDK between refreshes).
  // Returns null if no user is signed in — the dual-write silently skips DynamoDB.
  async function _getToken() {
    try {
      const user = firebase?.auth()?.currentUser;
      if (!user) return null;
      return await user.getIdToken(false); // false = use cached token
    } catch(e) {
      console.warn('[atlasDB] getIdToken failed:', e.message);
      return null;
    }
  }

  // ── DynamoDB write (fire-and-forget) ─────────────────────────────────────────
  // Never blocks the UI — errors are logged but don't throw.
  async function _dynaWrite(op, workspaceKey, data, extras) {
    let token;
    try {
      token = await _getToken();
      if (!token) return; // anonymous session — skip DynamoDB write
    } catch(e) { return; }

    try {
      const resp = await fetch(`${_lambdaUrl()}/db`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ op, data, ...extras }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.warn('[atlasDB] DynamoDB write rejected:', op, err.error || resp.status);
      }
    } catch(e) {
      console.warn('[atlasDB] DynamoDB write failed (network):', op, e.message);
    }
  }

  // ── CFR11_AUDIT_TABLES — tables that generate 21 CFR Part 11 audit entries ───
  const CFR11_AUDIT_TABLES = new Set(['assessments','peacs_assessments','mapData']);

  // ── SHA-256 helper (Web Crypto API) ──────────────────────────────────────────
  async function _sha256(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(e) { return 'hash-unavailable'; }
  }

  // ── CFR-11 Audit Trail Writer ─────────────────────────────────────────────────
  // Satisfies 21 CFR Part 11 §11.10(d)(e): who, when, what, payload hash.
  // Fire-and-forget — never blocks the calling write.
  async function _cfr11Audit(action, table, recordId, payload) {
    try {
      const user = firebase?.auth?.()?.currentUser;
      const hash = await _sha256(JSON.stringify(payload || {}));
      const entry = {
        cfr11:         true,
        action,
        table,
        record_id:     recordId || null,
        actor_uid:     user?.uid          || 'unknown',
        actor_email:   user?.email        || 'unknown',
        actor_name:    user?.displayName  || user?.email || 'unknown',
        workspace:     (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null,
        payload_hash:  hash,
        timestamp_utc: new Date().toISOString(),
        client_ts:     Date.now(),
        session_id:    (typeof _atlasSessionId !== 'undefined') ? _atlasSessionId : null,
      };
      if (typeof database !== 'undefined') {
        database.ref('audit_log').push(entry).catch(() => {});
      }
      _dynaWrite('push_audit', entry.workspace, entry, {});
    } catch(e) {
      console.warn('[cfr11] audit write failed:', e.message);
    }
  }

  // CFR-11 §11.10(b) — payload integrity hash stored in audit_log entries (see _cfr11Audit).
  // Cross-verify: recompute hash from record and compare against audit_log entry for the same client_ts.

  // ── Path parser ───────────────────────────────────────────────────────────────
  // Parses a Firebase-style path string into components.
  // Examples:
  //   'assessments'                               → { root: 'assessments', segments: [] }
  //   'peacs_dimensions/PATIENT001/base'          → { root: 'peacs_dimensions', segments: ['PATIENT001','base'] }
  //   'ws_audit/ATLX1234'                         → { root: 'ws_audit', segments: ['ATLX1234'] }
  function _parsePath(path) {
    const parts = (path || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    return { root: parts[0] || '', segments: parts.slice(1) };
  }

  // ── Main shim factory ─────────────────────────────────────────────────────────
  //
  // atlasDB(path) — returns an object matching the firebase database.ref() API:
  //   .push(data)      → Firebase push + DynamoDB write (dual)
  //   .set(data)       → Firebase set  + DynamoDB write (dual, for dimensions)
  //   .update(data)    → Firebase update + DynamoDB batch (dual)
  //   .once(ev, cb)    → Firebase read only (reads stay on Firebase during transition)
  //   .on(ev, cb)      → Firebase listener only
  //   .off(ev, cb)     → Firebase listener removal
  //   .transaction(fn) → Firebase transaction only (stats counters)
  //   .child(seg)      → Returns a new atlasDB for the child path
  //   .orderByChild(k) → Returns firebase ref for chained queries
  //
  // When a workspace has the 'dyna_only' flag set (Phase 2), Firebase writes
  // are skipped and reads come from DynamoDB. Not yet implemented here.
  //
  function atlasDB(path) {
    const { root, segments } = _parsePath(path);
    const useDyna = DYNA_PATHS.has(root);

    // Resolve workspace key — always available after login
    function _ws() {
      return (typeof currentWorkspace !== 'undefined' && currentWorkspace &&
              currentWorkspace !== 'EXPLORER' && currentWorkspace !== 'INDEPENDENT')
        ? currentWorkspace
        : null;
    }

    // Get the raw Firebase ref for this path (used for all reads + fallback writes)
    function _fbRef() {
      if (typeof database === 'undefined') return null;
      return database.ref(path);
    }

    return {
      // ── .push(data) ──────────────────────────────────────────────────────────
      push(data) {
        const fbRef = _fbRef();

        if (useDyna && data !== undefined) {
          const op  = PATH_TO_OP[root] || 'push_assessment';
          const ws  = _ws();
          const extras = {};

          // For dimension paths, extract patient_id and dimension from path segments
          if (root === 'peacs_dimensions' || root === 'peacs_dimension_history') {
            extras.patient_id = segments[0] || null;
            extras.dimension  = segments[1] || null;
          }
          if (root === 'ws_audit') {
            extras.patient_id = null;
          }

          // Fire-and-forget DynamoDB write — does not block
          _dynaWrite(op, ws, data, extras);

          // CFR-11 §11.10(e) — audit CREATE for patient data tables
          if (CFR11_AUDIT_TABLES.has(root)) {
            _sha256(JSON.stringify(data || {})).then(hash => {
              _cfr11Audit('CREATE', root, null, { ...data, payload_hash: hash });
            });
          }
        }

        // Phase 2 (dyna_only): suppress Firebase write — DynamoDB is the sole store.
        // Phase 1 (default): dual-write to Firebase as well.
        if (!_isDynaOnly()) {
          if (fbRef && data !== undefined) {
            return fbRef.push(data);
          }
          // push() with no data → Firebase ref for .key generation
          return fbRef ? fbRef.push() : { key: null };
        }
        // dyna_only: return a stub with a generated key so callers can use .key
        const stubKey = typeof database !== 'undefined' ? database.ref().push().key : null;
        return { key: stubKey };
      },

      // ── .set(data) ───────────────────────────────────────────────────────────
      async set(data) {
        if (useDyna && data !== undefined) {
          const op  = PATH_TO_OP[root] || 'push_assessment';
          const ws  = _ws();
          const extras = {};

          if (root === 'peacs_dimensions') {
            // path = 'peacs_dimensions/{patientId}/{dimension}'
            extras.patient_id = segments[0] || null;
            extras.dimension  = segments[1] || null;
          }

          _dynaWrite(op, ws, data, extras);

          // CFR-11 §11.10(e) — audit UPDATE
          if (CFR11_AUDIT_TABLES.has(root)) {
            _cfr11Audit('UPDATE', root, segments[0] || null, data);
          }
        }

        if (!_isDynaOnly()) {
          const fbRef = _fbRef();
          if (fbRef) return fbRef.set(data);
        }
      },

      // ── .update(data) ────────────────────────────────────────────────────────
      // Batch update — used by peacs-core to write all dimensions at once.
      // Inspects every key in the batch against DYNA_PATHS regardless of which
      // root this atlasDB() was constructed with (dimUpdates keys are absolute
      // Firebase paths so we always write from database.ref() root on Firebase).
      async update(updates) {
        if (updates && typeof updates === 'object') {
          const ws = _ws();
          const processedPaths = new Set();

          for (const [updatePath, value] of Object.entries(updates)) {
            if (!value) continue;
            const { root: r, segments: segs } = _parsePath(updatePath);
            if (!DYNA_PATHS.has(r)) continue;

            const pathKey = `${r}/${segs[0]||''}/${segs[1]||''}`;
            if (processedPaths.has(pathKey)) continue; // de-dup

            if (r === 'peacs_dimensions' && segs[0] && segs[1]) {
              processedPaths.add(pathKey);
              _dynaWrite('set_peacs_dim', ws, value, {
                patient_id: segs[0],
                dimension:  segs[1],
              });
            }
            // peacs_dimension_history → history log stays Firebase-only;
            // DynamoDB stores current dimension state via set_peacs_dim above
          }
        }

        // Phase 2 (dyna_only): suppress Firebase write.
        if (!_isDynaOnly() && typeof database !== 'undefined') return database.ref().update(updates);
      },

      // ── .once(event, callback) ───────────────────────────────────────────────
      // Phase 1: reads from Firebase.
      // Phase 2 (dyna_only + DYNA_PATH): reads from DynamoDB via atlasDB.query().
      once(event, callback) {
        if (_isDynaOnly() && useDyna) {
          const ws = _ws();
          return atlasDB.query(root, { workspace: ws }).then(arr => {
            const snap = _arrayToSnapshot(arr, path);
            if (typeof callback === 'function') callback(snap);
            return snap;
          });
        }
        const fbRef = _fbRef();
        if (!fbRef) return Promise.resolve(null);
        return fbRef.once(event, callback);
      },

      // ── .on(event, callback) ─────────────────────────────────────────────────
      // Phase 2 (dyna_only): one-time DynamoDB fetch; no real-time push.
      on(event, callback) {
        if (_isDynaOnly() && useDyna) {
          const ws = _ws();
          atlasDB.query(root, { workspace: ws }).then(arr => {
            if (typeof callback === 'function') callback(_arrayToSnapshot(arr, path));
          });
          return callback; // return handle for .off() compatibility
        }
        const fbRef = _fbRef();
        if (!fbRef) return callback;
        return fbRef.on(event, callback);
      },

      // ── .off(event, callback) ────────────────────────────────────────────────
      off(event, callback) {
        const fbRef = _fbRef();
        if (fbRef) fbRef.off(event, callback);
      },

      // ── .transaction(fn) ─────────────────────────────────────────────────────
      // Atomic counters (public_stats, globalStats) stay on Firebase for now.
      transaction(fn) {
        const fbRef = _fbRef();
        if (fbRef) return fbRef.transaction(fn);
        return Promise.resolve();
      },

      // ── .child(segment) ──────────────────────────────────────────────────────
      child(segment) {
        return atlasDB(path + '/' + segment);
      },

      // ── .orderByChild(key) / .limitToLast(n) / .equalTo(v) ──────────────────
      // Query chaining — delegate to Firebase ref (reads only during transition)
      orderByChild(key) { return _fbRef()?.orderByChild(key); },
      limitToLast(n)    { return _fbRef()?.limitToLast(n);    },
      equalTo(v)        { return _fbRef()?.equalTo(v);        },
      orderByKey()      { return _fbRef()?.orderByKey();      },
      startAt(v)        { return _fbRef()?.startAt(v);        },
      endAt(v)          { return _fbRef()?.endAt(v);          },
    };
  }

  // ── Query helper — reads from DynamoDB (for migrated paths) ─────────────────
  // Usage: await atlasDB.query('assessments', { limit: 200 })
  atlasDB.query = async function(path, params = {}) {
    const token = await _getToken();
    if (!token) return [];

    const { root } = _parsePath(path);
    const op = root === 'peacs_assessments' ? 'query_peacs' : 'query_assessments';

    try {
      const resp = await fetch(`${_lambdaUrl()}/db`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ op, query: params }),
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return json.data || [];
    } catch(e) {
      console.warn('[atlasDB.query] failed:', e.message);
      return [];
    }
  };

  // ── Expose globally ──────────────────────────────────────────────────────────
  window.atlasDB = atlasDB;

})();
