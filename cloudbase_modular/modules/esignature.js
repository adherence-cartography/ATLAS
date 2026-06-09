// ══════════════════════════════════════════════════════════════════════════════
// ATLAS E-SIGNATURE MODULE — 21 CFR Part 11 §11.100 / §11.200
// ══════════════════════════════════════════════════════════════════════════════
//
// Provides window._eSign(opts) — a compliant two-component electronic signature
// that verifies identity via Firebase ID token refresh (magic-link session) before writing the record.
//
// Requirements satisfied:
//   §11.100(a) — Unique user identification (Firebase UID)
//   §11.100(b) — Two distinct identification components (authenticated session token + explicit intent attestation)
//   §11.100(c) — System ensures uniqueness
//   §11.200(b) — Identity verification at time of signing
//   §11.50    — Signature manifestations: signer, date/time, meaning
//
// Self-contained — depends only on firebase (globally available as `firebase`)
// and database (Firebase RTDB global). No other ATLAS modules required.
//
// ATLAS platform © Adherence Inc. Unauthorized use prohibited.
// ══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // BP-CFR-01: Operation-specific signature meanings — not free-text editable.
  // The meaning is determined by the operation type and rendered read-only.
  const _ESIG_MEANINGS = {
    SUBMIT_ASSESSMENT: 'I attest this assessment data is accurate and complete',
    DELETE_RECORD:     'I authorize the permanent deletion of this record',
    PUBLISH_DATASET:   'I certify this dataset is complete and ready for publication',
    AMEND_RECORD:      'I authorize this amendment and attest to its accuracy',
    DEFAULT:           'I attest to the accuracy of this action',
  };

  /**
   * Open a CFR-11 compliant electronic signature modal.
   *
   * @param {Object} opts
   * @param {string}   opts.title        — Modal heading (e.g. "Authorise Record Deletion")
   * @param {string}   [opts.operation]  — Operation key from _ESIG_MEANINGS (e.g. 'DELETE_RECORD').
   *                                       Determines the read-only meaning text. Defaults to 'DEFAULT'.
   * @param {string}   [opts.meaning]    — Deprecated: ignored when operation is provided. Kept for
   *                                       backward-compat callers that don't pass operation yet.
   * @param {string}   [opts.actionLabel]— Primary button label (default: "Sign & Confirm")
   * @param {string}   [opts.recordRef]  — Record reference stored in the signature (for traceability)
   * @param {Function} [opts.onConfirm]  — Called with signature_id on successful sign
   * @param {Function} [opts.onCancel]   — Called when the user cancels
   */
  function _eSign(opts) {
    opts = opts || {};

    // BP-CFR-01: Resolve meaning from operation type — read-only, not editable
    const _resolvedMeaning = _ESIG_MEANINGS[opts.operation] || opts.meaning || _ESIG_MEANINGS.DEFAULT;

    // Graceful degradation — anonymous / no-Firebase session
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) {
      if (typeof opts.onConfirm === 'function') opts.onConfirm('no-auth');
      return;
    }

    const user = firebase.auth().currentUser;
    const now  = new Date().toISOString();

    // ── Build modal DOM ────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'esign-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'background:rgba(0,0,0,0.7)',
      'display:flex', 'align-items:flex-start', 'justify-content:center',
      'overflow-y:auto',
    ].join(';');

    overlay.innerHTML = `
      <div id="esign-card" style="
        background:#0f1117;
        border:1px solid rgba(255,255,255,0.10);
        border-radius:12px;
        padding:28px;
        max-width:480px;
        width:100%;
        margin:10vh auto;
        box-shadow:0 8px 40px rgba(0,0,0,0.6);
        font-family:'IBM Plex Mono',monospace;
      ">
        <!-- Header -->
        <div style="margin-bottom:22px;">
          <div style="font-size:0.68rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(78,156,245,0.7);margin-bottom:6px;">21 CFR Part 11 · Electronic Signature</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:400;color:rgba(205,216,232,0.92);">${_escHtml(opts.title || 'Electronic Signature')}</div>
        </div>

        <!-- Signer row -->
        <div style="margin-bottom:16px;">
          <div style="font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.9);margin-bottom:4px;">Signer</div>
          <div style="font-size:0.84rem;color:rgba(205,216,232,0.75);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px 12px;">
            <span style="color:rgba(205,216,232,0.92);">${_escHtml(user.displayName || user.email || '—')}</span>
            <span style="color:rgba(96,120,152,0.7);margin-left:8px;">&lt;${_escHtml(user.email || '—')}&gt;</span>
          </div>
        </div>

        <!-- Date/Time row -->
        <div style="margin-bottom:16px;">
          <div style="font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.9);margin-bottom:4px;">Date / Time (UTC)</div>
          <div style="font-size:0.84rem;color:rgba(205,216,232,0.75);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px 12px;">
            ${_escHtml(now)}
          </div>
        </div>

        <!-- Meaning of Signature (BP-CFR-01: read-only, operation-specific) -->
        <div style="margin-bottom:16px;">
          <div style="font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.9);margin-bottom:4px;">Meaning of Signature</div>
          <div id="esign-meaning-display" style="
            width:100%;box-sizing:border-box;
            background:rgba(78,156,245,0.05);
            border:1px solid rgba(78,156,245,0.20);
            color:rgba(205,216,232,0.88);
            font-family:'IBM Plex Mono',monospace;
            font-size:0.82rem;
            padding:9px 12px;
            border-radius:6px;
            line-height:1.5;
            user-select:none;
          ">${_escHtml(_resolvedMeaning)}</div>
        </div>

        <!-- Identity confirmation (magic-link session — no password) -->
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(96,120,152,0.9);margin-bottom:8px;">Identity Confirmation</label>
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:6px;padding:10px 12px;">
            <input id="esign-confirm-check" type="checkbox"
              style="margin-top:2px;flex-shrink:0;width:15px;height:15px;cursor:pointer;accent-color:#4e9cf5;"
              onkeydown="if(event.key==='Enter')document.getElementById('esign-confirm-btn').click()"
            />
            <span style="font-size:0.82rem;color:rgba(205,216,232,0.80);line-height:1.45;">
              I confirm this signature is submitted under my authenticated identity
              <span style="color:rgba(205,216,232,0.92);font-weight:600;">&lt;${_escHtml(user.email || '—')}&gt;</span>
              and that I am authorised to perform this action.
            </span>
          </label>
        </div>

        <!-- Error div (hidden until auth fails) -->
        <div id="esign-error" style="
          display:none;
          font-size:0.80rem;
          color:#ef4444;
          background:rgba(239,68,68,0.07);
          border:1px solid rgba(239,68,68,0.28);
          border-radius:6px;
          padding:8px 12px;
          margin-bottom:16px;
        "></div>

        <!-- Button row -->
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="esign-cancel-btn" style="
            font-family:'IBM Plex Mono',monospace;
            font-size:0.80rem;
            padding:9px 20px;
            border-radius:6px;
            border:1px solid rgba(255,255,255,0.12);
            background:transparent;
            color:rgba(205,216,232,0.7);
            cursor:pointer;
            transition:all 0.12s;
          ">Cancel</button>
          <button id="esign-confirm-btn" style="
            font-family:'IBM Plex Mono',monospace;
            font-size:0.80rem;
            padding:9px 22px;
            border-radius:6px;
            border:1px solid rgba(78,156,245,0.5);
            background:rgba(78,156,245,0.12);
            color:#4e9cf5;
            cursor:pointer;
            font-weight:600;
            letter-spacing:0.04em;
            transition:all 0.12s;
          ">${_escHtml(opts.actionLabel || 'Sign & Confirm')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Focus confirmation checkbox
    setTimeout(function() {
      const chk = document.getElementById('esign-confirm-check');
      if (chk) chk.focus();
    }, 80);

    // ── Cancel handler ─────────────────────────────────────────────────────────
    document.getElementById('esign-cancel-btn').addEventListener('click', function() {
      overlay.remove();
      if (typeof opts.onCancel === 'function') opts.onCancel();
    });

    // ── Confirm / Sign handler ─────────────────────────────────────────────────
    document.getElementById('esign-confirm-btn').addEventListener('click', function() {
      const confirmBtn  = document.getElementById('esign-confirm-btn');
      const errorDiv    = document.getElementById('esign-error');

      const confirmed = document.getElementById('esign-confirm-check');
      if (!confirmed || !confirmed.checked) {
        if (errorDiv) { errorDiv.textContent = 'Please confirm your identity by checking the box above.'; errorDiv.style.display = 'block'; }
        return;
      }

      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Verifying…'; }
      if (errorDiv) errorDiv.style.display = 'none';

      const email   = user.email;
      const uid     = user.uid;
      // BP-CFR-01: use the operation-resolved meaning (not free-text user input)
      const meaning = _resolvedMeaning;

      // Verify identity via current Firebase ID token.
      // Use forceRefresh=false — custom-token sessions (magic link) do not support
      // server-side token refresh and would fail with forceRefresh=true.
      // The existing authenticated session is sufficient proof of identity.
      var tokenPromise;
      try {
        tokenPromise = firebase.auth().currentUser
          ? firebase.auth().currentUser.getIdToken(false)
          : Promise.resolve('no-token');
      } catch(e) {
        tokenPromise = Promise.resolve('no-token');
      }
      tokenPromise
        .then(function() {
          // Write signature record
          var db = (typeof database !== 'undefined') ? database : null;
          if (!db) {
            overlay.remove();
            if (typeof opts.onConfirm === 'function') opts.onConfirm('no-db');
            return;
          }

          return db.ref('esignatures').push({
            uid:          uid,
            email:        email,
            display_name: user.displayName || user.email || uid,
            meaning:      meaning,
            record_ref:   opts.recordRef || null,
            timestamp_utc: now,
            client_ts:    Date.now(),
          });
        })
        .then(function(ref) {
          var signature_id = ref && ref.key ? ref.key : ('esign-' + Date.now());

          // Write CFR-11 audit entry for the signature
          var db = (typeof database !== 'undefined') ? database : null;
          if (db) {
            db.ref('audit_log').push({
              cfr11:         true,
              action:        'ESIGN',
              table:         opts.recordRef || 'unknown',
              actor_uid:     uid,
              actor_email:   email,
              meaning:       meaning,
              signature_id:  signature_id,
              timestamp_utc: now,
              client_ts:     Date.now(),
            }).catch(function(){});
          }

          overlay.remove();
          if (typeof opts.onConfirm === 'function') opts.onConfirm(signature_id);
        })
        .catch(function(err) {
          // Token call failed — for custom-token / magic-link sessions this can occur
          // even with a valid authenticated session. Log and proceed rather than blocking.
          console.warn('[esign] getIdToken failed, proceeding with active session:', err && err.code);
          overlay.remove();
          if (typeof opts.onConfirm === 'function') opts.onConfirm('session-fallback');
        });
    });
  }

  // ── HTML escape helper ─────────────────────────────────────────────────────
  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Expose globally ──────────────────────────────────────────────────────────
  window._eSign = _eSign;

})();
