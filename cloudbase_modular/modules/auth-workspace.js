// ══════════════════════════════════════════════
// WORKSPACE / RESEARCHER GATE
// Keys are validated server-side via Lambda — no keys stored in client code
// ══════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  AWS SSM MIGRATION — fixes the 4MB Lambda env-var limit                 │
// │                                                                         │
// │  The client code below does NOT change. All changes are in the Lambda.  │
// │                                                                         │
// │  STEP 1 — Install AWS SDK v3 in your Lambda package (if not present):   │
// │    npm install @aws-sdk/client-ssm                                      │
// │                                                                         │
// │  STEP 2 — Load existing tokens into SSM Parameter Store (one per key):  │
// │    aws ssm put-parameter \                                              │
// │      --name "/atlas/workspaces/YOURKEY" \                               │
// │      --value '{"name":"Site Name","tier":"researcher"}' \               │
// │      --type SecureString                                                │
// │    Repeat for every existing workspace token.                           │
// │                                                                         │
// │  STEP 3 — Replace your Lambda handler key-lookup with:                 │
// │                                                                         │
// │    const { SSMClient, GetParameterCommand } =                           │
// │      require('@aws-sdk/client-ssm');                                    │
// │    const ssm = new SSMClient({ region: 'us-east-1' });                 │
// │    const _wsCache = new Map(); // in-memory cache, warm instance only  │
// │                                                                         │
// │    async function lookupWorkspaceKey(key) {                             │
// │      if (_wsCache.has(key)) return _wsCache.get(key);                  │
// │      try {                                                              │
// │        const res = await ssm.send(new GetParameterCommand({             │
// │          Name: '/atlas/workspaces/' + key,                             │
// │          WithDecryption: true                                           │
// │        }));                                                             │
// │        const profile = JSON.parse(res.Parameter.Value);                │
// │        _wsCache.set(key, profile);                                      │
// │        return profile;                                                  │
// │      } catch(e) { return null; }                                        │
// │    }                                                                    │
// │                                                                         │
// │  STEP 4 — In /validate-key handler replace:                            │
// │      const profile = WORKSPACE_KEYS[key];   // old env-var lookup      │
// │    with:                                                                │
// │      const profile = await lookupWorkspaceKey(key);                    │
// │                                                                         │
// │  STEP 5 — Add ssm:GetParameter to your Lambda IAM execution role:      │
// │    { "Effect":"Allow", "Action":"ssm:GetParameter",                    │
// │      "Resource":"arn:aws:ssm:us-east-1:*:parameter/atlas/workspaces/*"}│
// │                                                                         │
// │  STEP 6 — Delete WORKSPACE_KEYS (or equivalent) from Lambda env vars.  │
// │    You can now add unlimited tokens via SSM — no redeploy needed.       │
// └─────────────────────────────────────────────────────────────────────────┘
//
/** @type {string} The ATLAS Lambda function URL for workspace key validation and auth flows. */
const LAMBDA_URL = '/lambda-proxy';

/**
 * Validates a workspace key against the ATLAS Lambda backend and signs in via Firebase.
 * Handles three auth paths: immediate token (direct sign-in), MFA/OTP (session_token returned),
 * and magic-link (email link flow, no token yet).
 * @param {string} code - Raw workspace key string (will be trimmed and uppercased)
 * @returns {Promise<import('./auth-roles').WorkspaceProfile|null>} The workspace profile on success, or `null` on failure
 */
async function validateWorkspaceCode(code) {
  const key = code.trim().toUpperCase();
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${LAMBDA_URL}/validate-key`, {
      method:  'POST',
      mode:    'cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key }),
      signal:  controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error('[ATLAS] validateWorkspaceCode: server error', res.status, '— check Lambda is deployed');
      window._lastWsError = 'server_config_error';
      return null;
    }
    const data = await res.json();
    window._lastWsError = null;
    window._lastWsData  = data;
    if (!data.valid) {
      console.warn('[ATLAS] validateWorkspaceCode: key lookup returned valid=false — check SSM entry exists');
      window._lastWsError = 'key_not_found';
      return null;
    }
    // MFA required — return the profile so submitWorkspaceCode can show the OTP step.
    // Do NOT check for token here — mfa_required responses intentionally have no token yet.
    if (data.mfa_required && data.session_token) {
      return data.profile;
    }
    // Magic link required — key has an email; Lambda sent the link, no token issued yet.
    // submitWorkspaceCode reads window._lastWsData.magic_required to show the waiting step.
    if (data.magic_required) {
      return data.profile;
    }
    if (!data.token) {
      console.error('[ATLAS] validateWorkspaceCode: Lambda returned valid=true but no token — Lambda fix may not be deployed');
      window._lastWsError = 'server_config_error';
      return null;
    }
    try {
      await firebase.auth().signInWithCustomToken(data.token);
    } catch(authErr) {
      console.error('[ATLAS] validateWorkspaceCode: Firebase signInWithCustomToken failed', authErr.code, authErr);
      window._lastWsError = 'server_config_error';
      return null;
    }
    return data.profile;
  } catch(e) {
    if (e.name === 'AbortError') {
      console.warn('[ATLAS] validateWorkspaceCode: request timed out (>12s) — Lambda may be cold-starting');
      window._lastWsError = 'timeout';
    } else {
      console.error('[ATLAS] validateWorkspaceCode: network error —', e.message, '— check Lambda URL and CORS config');
      window._lastWsError = 'Network error';
    }
    return null;
  }
}

/**
 * Updates the workspace modal copy and benefits block for a given entry path.
 * Uses ATLAS_STRINGS translations for the current language.
 * @param {'institution'|'researcher'} mode - Entry path selected by the user
 * @returns {void}
 */
function setWorkspaceModalMode(mode) {
  var _lang = (typeof window._atlasLang !== 'undefined' && window._atlasLang) ? window._atlasLang : 'en';
  var _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[_lang]) ? ATLAS_STRINGS[_lang] : {};
  var _en = (typeof ATLAS_STRINGS !== 'undefined') ? ATLAS_STRINGS.en : {};
  var T = function(key) { return _t[key] || _en[key] || ''; };

  var title    = document.getElementById('ws-modal-title');
  var subtitle = document.getElementById('ws-modal-subtitle');
  var label    = document.getElementById('ws-benefits-label');
  var block    = document.getElementById('ws-benefits-block');

  if (mode === 'institution') {
    if (title)    title.textContent    = T('instTitle');
    if (subtitle) subtitle.textContent = T('instSubtitle');
    if (label)    label.textContent    = T('instBenefitsLabel');
    if (block) block.innerHTML =
      '<div class="ws-benefits-label">' + T('instBenefitsLabel') + '</div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--pe)"></span><span>' + T('instBullet1') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--optimal)"></span><span>' + T('instBullet2') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--base)"></span><span>' + T('instBullet3') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--mvmt)"></span><span>' + T('instBullet4') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--strata)"></span><span>' + T('instBullet5') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:rgba(255,255,255,0.25)"></span><span>' + T('instBullet6') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--pe)"></span><span>' + T('instBullet7') + '</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--optimal)"></span><span>' + T('instBullet8') + '</span></div>' +
      '<div style="margin-top:14px;padding:12px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;">' +
        '<div style="font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(245,158,11,0.85);margin-bottom:7px;">' + T('instSharedTitle') + '</div>' +
        '<div style="font-size:0.80rem;color:var(--text);line-height:1.7;">' + T('instSharedBody') + '</div>' +
      '</div>' +
      '<div style="margin-top:14px;padding:14px 16px;background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.22);border-radius:10px;">' +
        '<div style="font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:6px;">📊 Global Adherence Index — Industry Reports</div>' +
        '<div style="font-size:0.82rem;color:var(--muted);line-height:1.65;margin-bottom:12px;">Subscribe to quarterly or annual GAI reports — population-level adherence benchmarks used by HEOR teams, pharma, payers, and health ministries. All data is aggregate and de-identified.</div>' +
        '<button onclick="openGAIEnroll(\'standard\')" style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.28);color:rgba(212,168,67,0.85);font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.1em;text-transform:uppercase;border-radius:6px;padding:7px 14px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(212,168,67,0.16)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.08)\'">Inquire about GAI Reports →</button>' +
      '</div>';
  } else {
    if (title)    title.textContent    = T('resTitle') || T('wsTitle');
    if (subtitle) subtitle.textContent = T('resSubtitle') || T('wsSubtitle');
    if (block) block.innerHTML =
      '<div class="ws-benefits-label">Four key tiers — all include MAP</div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--optimal)"></span><span><strong style="color:var(--bright)">Student ($0–$19/mo)</strong> — MAP + PEACS snapshot (BASE · MVMT · STRATA) · cohort isolation · CSV export (100/mo)</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--base)"></span><span><strong style="color:var(--bright)">Clinician — NP · PA · PharmD · MD ($49/mo)</strong> — MAP + MMAS-8 + PEACS · ZOE voice SOAP notes · MTM billing · Care Gaps · SDoH Analysis</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--mvmt)"></span><span><strong style="color:var(--bright)">Pharmacist · Researcher ($49/mo)</strong> — MAP + PEACS longitudinal (BASE · MVMT · STRATA) · unlimited cohort · ZOE voice · Sentinel alerts</span></div>' +
      '<div class="ws-benefit-row"><span class="ws-benefit-dot" style="background:var(--pe)"></span><span><strong style="color:var(--bright)">PI · Multi Site ($149/mo)</strong> — Everything above + bulk XLSM upload · IRB-grade export · PEACS population stratification · API access</span></div>' +
      '<div class="ws-benefit-row" style="opacity:0.5;"><span class="ws-benefit-dot" style="background:rgba(255,255,255,0.2)"></span><span>Population Health Command Center, multi-PI dashboard &amp; Sentinel triage — Institution tier only</span></div>' +
      '<div style="margin-top:14px;padding:14px 16px;background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.22);border-radius:10px;">' +
        '<div style="font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:6px;">📊 Global Adherence Index — Industry Reports</div>' +
        '<div style="font-size:0.82rem;color:var(--muted);line-height:1.65;margin-bottom:12px;">Subscribe to quarterly or annual GAI reports — population-level adherence benchmarks used by HEOR teams, pharma, payers, and health ministries. All data is aggregate and de-identified.</div>' +
        '<button onclick="openGAIEnroll(\'standard\')" style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.28);color:rgba(212,168,67,0.85);font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.1em;text-transform:uppercase;border-radius:6px;padding:7px 14px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(212,168,67,0.16)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.08)\'">Inquire about GAI Reports →</button>' +
      '</div>';
  }
}

// BP-INT-01: China mainland access warning
/**
 * Checks if the user appears to be on mainland China (zh locale + China timezone)
 * and shows a dismissable amber warning banner if so. Dismissal is stored in
 * sessionStorage so it only shows once per session.
 * @returns {void}
 */
function _checkChinaMainlandAccess() {
  try {
    const DISMISS_KEY = '_atlas_china_warn_dismissed';
    if (sessionStorage.getItem(DISMISS_KEY)) return; // already dismissed this session

    const lang = (navigator.language || '').toLowerCase();
    if (!lang.startsWith('zh')) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const CHINA_TZ = new Set(['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Harbin']);
    if (!CHINA_TZ.has(tz)) return;

    // Both conditions met — show banner
    if (document.getElementById('_atlas-china-banner')) return; // already shown

    const banner = document.createElement('div');
    banner.id = '_atlas-china-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:#fffbeb', 'border-bottom:2px solid #f59e0b',
      'color:#92400e', 'font-family:\'IBM Plex Mono\',monospace',
      'font-size:0.78rem', 'padding:10px 16px',
      'display:flex', 'align-items:flex-start', 'gap:12px', 'line-height:1.5',
    ].join(';');
    banner.innerHTML =
      '<span style="flex:1;">' +
      '<strong style="font-weight:700;">ATLAS connectivity notice:</strong> ' +
      'ATLAS may experience connectivity issues from mainland China due to network restrictions affecting Firebase services. ' +
      'If you cannot connect, email <a href="mailto:info@adherence.cc" style="color:#92400e;">info@adherence.cc</a> for alternative access options.' +
      '</span>' +
      '<button id="_atlas-china-dismiss" style="' +
        'flex-shrink:0;background:transparent;border:1px solid #f59e0b;color:#92400e;' +
        'font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;padding:3px 10px;' +
        'border-radius:4px;cursor:pointer;white-space:nowrap;' +
      '">Dismiss</button>';

    document.body.insertBefore(banner, document.body.firstChild);

    document.getElementById('_atlas-china-dismiss').addEventListener('click', function() {
      banner.remove();
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch(e) {}
    });
  } catch(e) {
    // Never block auth flow for this check
  }
}

/**
 * Opens the workspace authentication modal and focuses the key input field.
 * @returns {void}
 */
function openWorkspaceModal() {
  _checkChinaMainlandAccess();
  document.getElementById('workspace-modal').classList.add('open');
  setTimeout(() => document.getElementById('ws-input').focus(), 100);
}

/**
 * Closes the workspace modal and resets all authentication state:
 * key input, MFA step, magic-link step, and pending session variables.
 * @returns {void}
 */
function closeWorkspaceModal() {
  document.getElementById('workspace-modal').classList.remove('open');
  document.getElementById('ws-input').value = '';
  document.getElementById('ws-input').disabled = false;
  // Reset MFA step
  const mfaStep = document.getElementById('ws-mfa-step');
  if (mfaStep) mfaStep.style.display = 'none';
  const otpInput = document.getElementById('ws-otp-input');
  if (otpInput) otpInput.value = '';
  _mfaPendingKey = null; _mfaPendingProfile = null; _mfaSessionToken = null;
  // Reset magic link step
  const magicStep = document.getElementById('ws-magic-step');
  if (magicStep) magicStep.style.display = 'none';
  const magicTimerEl   = document.getElementById('ws-magic-timer');
  const magicExpiredEl = document.getElementById('ws-magic-expired');
  if (magicTimerEl)   magicTimerEl.textContent  = 'Expires in 15 minutes';
  if (magicExpiredEl) magicExpiredEl.style.display = 'none';
  _stopMagicLinkListener(); // clears countdown + all channels
  _magicPendingKey = null; _magicPendingProfile = null; _magicResendCooldown = false;
  // Always reset button so it's ready for next open
  const btn = document.getElementById('ws-submit');
  if (btn) { btn.disabled = false; btn.innerHTML = 'Verify Access →'; btn.style.background = ''; }
  document.getElementById('ws-error').classList.remove('show');
  document.getElementById('ws-error').textContent = '';
}

// ── Superadmin MFA state ─────────────────────────────────────────────────────
// Stored in module scope — never in sessionStorage (cleared on page refresh,
// which forces re-authentication as intended).
let _mfaPendingKey     = null;  // the superadmin key that passed key validation
let _mfaPendingProfile = null;  // the profile returned by Lambda before OTP step
let _mfaSessionToken   = null;  // short-lived session token returned by Lambda for OTP exchange
let _mfaResendCooldown = false; // throttle resend button

// ── Magic link state (all non-superadmin users) ──────────────────────────────
let _magicPendingKey     = null;  // workspace key waiting for magic link click
let _magicPendingProfile = null;  // profile returned by Lambda at magic_required step
let _magicResendCooldown = false; // throttle resend button

/**
 * Handles workspace key form submission (Step 1) and OTP form submission (Step 2).
 * Detects which step is active based on MFA step visibility.
 * On key success, enforces institution/researcher path routing,
 * then branches into MFA, magic-link, or direct grant flows.
 * @returns {Promise<void>}
 */
async function submitWorkspaceCode() {
  const input = document.getElementById('ws-input');
  const btn   = document.getElementById('ws-submit');
  const err   = document.getElementById('ws-error');
  const mfaStep = document.getElementById('ws-mfa-step');

  // ── Step 2: OTP submission (MFA step visible) ────────────────────────────
  if (mfaStep && mfaStep.style.display !== 'none') {
    const otpInput = document.getElementById('ws-otp-input');
    const otp = (otpInput && otpInput.value.replace(/\s/g,'')) || '';
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      err.textContent = 'Please enter the 6-digit code from your email.';
      err.classList.add('show');
      return;
    }
    btn.disabled = true; btn.textContent = 'Verifying…';
    err.classList.remove('show');
    await _submitOTP(otp);
    return;
  }

  // ── Step 1: Key submission ────────────────────────────────────────────────
  const code = input.value.trim().toUpperCase();
  if (!code) { err.textContent='Please enter your workspace key.'; err.classList.add('show'); return; }
  btn.disabled = true; btn.innerHTML = '<span class="atlas-spinner"></span>Verifying…';
  err.classList.remove('show');

  const profile = await validateWorkspaceCode(code);

  if (profile) {
    // ── Path enforcement ────────────────────────────────────────────────────
    const enteredVia = window._wsMode || 'researcher';
    const actualRole = profile.role || 'researcher';
    const isInstRole = actualRole === 'institution' || actualRole === 'superadmin' || actualRole === 'observer';
    const isResRole  = actualRole === 'researcher'  || actualRole === 'independent';

    if (enteredVia === 'researcher' && isInstRole) {
      btn.disabled = false; btn.innerHTML = 'Verify Access →'; btn.style.background = '';
      err.textContent = actualRole === 'superadmin'
        ? 'Superadmin keys must be entered via the Institution door. Please go back and select Institution.'
        : 'This is an Institution key. Please go back and select Institution.';
      err.classList.add('show');
      return;
    }
    if (enteredVia === 'institution' && !isInstRole) {
      btn.disabled = false; btn.innerHTML = 'Verify Access →'; btn.style.background = '';
      err.textContent = 'This key is for the Researcher path, not Institution. Please go back and select PI / Researcher.';
      err.classList.add('show');
      return;
    }

    // ── MFA step: any role whose key has an email triggers OTP ──────────────
    // Lambda returns mfa_required:true + session_token for all keys with an email address.
    // This applies to researcher, student, institution, and superadmin alike.
    {
      const wsData = window._lastWsData || {};
      if (wsData.mfa_required && wsData.session_token) {
        _mfaPendingKey     = code;
        _mfaPendingProfile = profile;
        _mfaSessionToken   = wsData.session_token;
        // Show OTP step
        if (mfaStep) mfaStep.style.display = 'block';
        input.disabled = true;
        btn.disabled = false;
        btn.textContent = 'Verify Code →';
        err.classList.remove('show');
        // Focus OTP input
        setTimeout(() => {
          const oi = document.getElementById('ws-otp-input');
          if (oi) oi.focus();
        }, 80);
        return;
      }
    }

    // ── Magic link: fallback for keys configured for magic-link flow ──────────
    const wsData = window._lastWsData || {};
    if (wsData.magic_required) {
      _magicPendingKey     = code;
      _magicPendingProfile = profile;
      // Show magic link waiting step
      const magicStep = document.getElementById('ws-magic-step');
      const emailHint = document.getElementById('ws-magic-email-hint');
      if (emailHint) emailHint.textContent = wsData.email_hint || 'your registered email';
      if (magicStep) magicStep.style.display = 'block';
      input.disabled = true;
      // Change button to a disabled "waiting" state so user knows action happened
      btn.disabled = true;
      btn.textContent = 'Waiting for magic link…';
      err.classList.remove('show');
      // Listen for cross-tab completion (user clicks magic link in another tab)
      _startMagicLinkListener();
      return;
    }

    // ── Grant access (non-superadmin without magic required, or superadmin fallback) ──
    _grantWorkspaceAccess(code, profile);

  } else {
    btn.disabled = false; btn.innerHTML = 'Verify Access →'; btn.style.background = '';
    err.textContent = (window._lastWsError === 'timeout')
      ? 'Verification is taking longer than expected. Please try again.'
      : (window._lastWsError === 'server_config_error')
        ? 'There was a server configuration issue. Please contact support if this persists.'
        : (window._lastWsError && (window._lastWsError.includes('Network error') || window._lastWsError.includes('Failed to fetch')))
          ? 'Unable to verify key — please check your connection and try again.'
          : (window._lastWsError === 'key_not_found')
            ? 'Key not recognized. Please check your key and try again, or contact support.'
            : 'Key not recognised. Please double-check your key or contact support@adherence.cc.';
    err.classList.add('show');

    // CFR-11 §11.10(f) — log failed login attempt to audit_log
    // Guard: only write when authenticated — unauthenticated writes are denied
    // by Firebase rules and generate noisy permission_denied errors in the console.
    if (typeof database !== 'undefined' &&
        typeof firebase !== 'undefined' &&
        firebase.auth().currentUser) {
      database.ref('audit_log').push({
        cfr11:         true,
        action:        'LOGIN_FAILURE',
        actor_email:   code || 'unknown',
        error_code:    (window._lastWsError) ? 'key_invalid' : 'unknown',
        timestamp_utc: new Date().toISOString(),
        client_ts:     Date.now(),
        table:         'auth',
      }).catch(function(){});
    }
  }
}

/**
 * Submits a 6-digit OTP to the Lambda `/verify-otp` endpoint to complete MFA sign-in.
 * On success, signs in with the returned Firebase custom token and grants workspace access.
 * @param {string} otp - 6-digit one-time password entered by the user
 * @returns {Promise<void>}
 */
async function _submitOTP(otp) {
  const btn = document.getElementById('ws-submit');
  const err = document.getElementById('ws-error');
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${LAMBDA_URL}/verify-otp`, {
      method:  'POST',
      mode:    'cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_token: _mfaSessionToken, otp }),
      signal:  controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      btn.disabled = false; btn.textContent = 'Verify Code →';
      err.textContent = data.error || `Verification failed (${res.status}). Please try again.`;
      err.classList.add('show');
      return;
    }
    const data = await res.json();
    if (!data.valid || !data.token) {
      btn.disabled = false; btn.textContent = 'Verify Code →';
      err.textContent = data.error || 'Invalid or expired code. Please try again.';
      err.classList.add('show');
      // Clear OTP input for retry
      const oi = document.getElementById('ws-otp-input');
      if (oi) { oi.value = ''; oi.focus(); }
      return;
    }
    // OTP verified — sign in with the real Firebase custom token
    try {
      await firebase.auth().signInWithCustomToken(data.token);
    } catch(authErr) {
      btn.disabled = false; btn.textContent = 'Verify Code →';
      err.textContent = 'Sign-in failed — please try again or contact support@adherence.cc.';
      err.classList.add('show');
      return;
    }
    atlasAuditLog('superadmin_mfa_success', { workspace: _mfaPendingKey });
    _grantWorkspaceAccess(_mfaPendingKey, _mfaPendingProfile);
  } catch(e) {
    console.error('[ATLAS] _submitOTP: network error —', e.name, e.message);
    btn.disabled = false; btn.textContent = 'Verify Code →';
    err.textContent = e.name === 'AbortError'
      ? 'Verification is taking longer than expected. Please try again.'
      : 'Verification failed. Please try again or contact support.';
    err.classList.add('show');
  }
}

/**
 * Resends the MFA OTP email for the pending superadmin session.
 * Has a 30-second cooldown to prevent spam. No-ops if already cooling down.
 * @returns {Promise<void>}
 */
async function resendSuperadminOTP() {
  if (_mfaResendCooldown || !_mfaPendingKey) return;
  _mfaResendCooldown = true;
  const btn = document.getElementById('ws-otp-resend');
  if (btn) { btn.textContent = 'Sending…'; btn.style.pointerEvents = 'none'; }
  try {
    await fetch(`${LAMBDA_URL}/resend-otp`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: _mfaSessionToken }),
    });
    showToast('New code sent — check your email.', 3500);
  } catch(e) {
    showToast('Could not resend — please wait and try again.', 3000);
  }
  // 30-second cooldown before allowing another resend
  setTimeout(() => {
    _mfaResendCooldown = false;
    if (btn) { btn.textContent = 'Resend'; btn.style.pointerEvents = ''; }
  }, 30000);
}

// ── Magic link resend & cross-tab listener ───────────────────────────────────
/**
 * Resends a magic link by re-validating the pending workspace key with Lambda.
 * Has a 30-second cooldown. Updates the email hint if the resend response includes one.
 * @returns {Promise<void>}
 */
async function resendMagicLink() {
  if (_magicResendCooldown || !_magicPendingKey) return;
  _magicResendCooldown = true;
  const btn = document.getElementById('ws-magic-resend');
  if (btn) { btn.textContent = 'Sending…'; btn.style.pointerEvents = 'none'; }
  try {
    // Re-validate the key — Lambda will send a fresh magic link
    const res  = await fetch(`${LAMBDA_URL}/validate-key`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: _magicPendingKey }),
    });
    const data = await res.json();
    if (data.magic_required && data.email_hint) {
      const hint = document.getElementById('ws-magic-email-hint');
      if (hint) hint.textContent = data.email_hint;
    }
    showToast('New magic link sent — check your email.', 3500);
  } catch(e) {
    showToast('Could not resend — please wait and try again.', 3000);
  }
  setTimeout(() => {
    _magicResendCooldown = false;
    if (btn) { btn.textContent = 'Resend link'; btn.style.pointerEvents = ''; }
  }, 30000);
}

let _magicBroadcastChannel  = null;
let _magicFocusListener     = null;
let _magicPollInterval      = null;
let _magicAuthUnsub         = null;  // Firebase onAuthStateChanged unsubscribe for cross-tab sync
let _magicRtdbRef           = null;  // Firebase RTDB ref for cross-browser signal
let _magicCountdownInterval = null;  // Countdown timer interval for the waiting-state UI

function _checkMagicLocalStorage() {
  // ── localStorage check ────────────────────────────────────────────────────
  try {
    const raw = localStorage.getItem('atlas_magic_done');
    if (raw) {
      const data = JSON.parse(raw);
      const pendingUpper = (_magicPendingKey || '').toUpperCase();
      const dataKeyUpper = (data.key || '').toUpperCase();
      const keyMatch = !pendingUpper || dataKeyUpper === pendingUpper;
      console.log('[ATLAS] localStorage magic_done found, key:', data.key, 'keyMatch:', keyMatch);
      if (data && keyMatch && data.ts && Date.now() - data.ts < 5 * 60 * 1000) {
        // BP-SEC-10: Nonce validation — reject if nonce doesn't match
        let nonceValid = true;
        try {
          const expectedNonce = sessionStorage.getItem('_mlinkNonce');
          if (expectedNonce) {
            if (!data.nonce || data.nonce !== expectedNonce) {
              console.error('[ATLAS-AUTH] Magic link nonce mismatch — rejecting token');
              sessionStorage.removeItem('_mlinkNonce');
              localStorage.removeItem('atlas_magic_done');
              nonceValid = false;
            }
          }
          // If no expectedNonce stored (e.g. older relay), allow through for backward compat
        } catch(nonceErr) {}
        if (!nonceValid) return;
        localStorage.removeItem('atlas_magic_done');
        _completeMagicAuth(data.key, data.profile, data.token);
        return;
      }
    }
  } catch(e) { console.warn('[ATLAS] localStorage magic check error:', e); }

  // ── RTDB poll (backup for when WebSocket listener misses the update) ──────
  // Fires every 2s alongside the real-time listener. Uses .once() which can
  // fall back to HTTP if WebSocket is unavailable (Edge tracking prevention).
  if (_magicPendingKey && _magicRtdbRef) {
    _magicRtdbRef.once('value').then(function(snap) {
      const val = snap.val();
      if (val && val.completed && _magicPendingKey) {
        const age = Date.now() - (val.ts || 0);
        if (age < 5 * 60 * 1000) {
          console.log('[ATLAS] RTDB poll hit, age:', age + 'ms — completing auth');
          _completeMagicAuth(_magicPendingKey, _magicPendingProfile, null);
        }
      }
    }).catch(function(e) {
      // Silently ignore — permission errors are already logged by the .on() listener
    });
  }
}

function _startMagicLinkListener() {
  // Capture pre-wait UID before any async work — used to guard onAuthStateChanged
  // against false-triggering on a pre-existing session (since we no longer sign out,
  // which was breaking RTDB auth).
  const _preWaitUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
  console.log('[ATLAS] Magic link listener started, pendingKey:', _magicPendingKey, '| pre-wait uid:', _preWaitUid || '(none)');

  // ── Countdown timer ───────────────────────────────────────────────────────
  // Updates #ws-magic-timer every minute; at 0 shows the expired state with a
  // resend prompt and stops all listeners (link is no longer valid anyway).
  const timerEl   = document.getElementById('ws-magic-timer');
  const expiredEl = document.getElementById('ws-magic-expired');
  let minutesLeft = 15;
  if (timerEl) timerEl.textContent = 'Expires in 15 minutes';
  if (expiredEl) expiredEl.style.display = 'none';
  if (_magicCountdownInterval) clearInterval(_magicCountdownInterval); // clear any stale
  _magicCountdownInterval = setInterval(function() {
    minutesLeft -= 1;
    if (minutesLeft > 0) {
      if (timerEl) timerEl.textContent = 'Expires in ' + minutesLeft + ' minute' + (minutesLeft !== 1 ? 's' : '');
    } else {
      if (timerEl) timerEl.textContent = '';
      if (expiredEl) expiredEl.style.display = '';
      clearInterval(_magicCountdownInterval);
      _magicCountdownInterval = null;
      // Stop all listeners — expired link cannot complete auth
      _stopMagicLinkListener();
      console.log('[ATLAS] Magic link countdown expired — listeners stopped');
    }
  }, 60000);

  // BP-SEC-10: Generate nonce for this magic link session to prevent cross-tab token replay.
  // Stored in sessionStorage (for this tab's validation) and localStorage (so the relay tab
  // can read and include it in the handoff payload).
  try {
    const nonce = crypto.randomUUID();
    sessionStorage.setItem('_mlinkNonce', nonce);
    localStorage.setItem('_mlinkNonce', nonce);
    console.log('[ATLAS] Magic link nonce generated and stored');
  } catch(e) {
    console.warn('[ATLAS] Could not generate magic link nonce:', e);
  }

  // ── PRIMARY: Firebase RTDB signal ─────────────────────────────────────────
  // Works cross-browser and cross-device — the only channel that survives when
  // the email link opens in a different browser than the waiting tab (e.g. Edge
  // waiting tab, Chrome opens the email link as default browser).
  // Relay tab writes magic_signals/{key} after signInWithCustomToken.
  // IMPORTANT: Do NOT sign out before setting this up — signing out revokes auth
  // and the RTDB listener immediately loses permission.
  if (_magicPendingKey) {
    try {
      const _safeKey = _magicPendingKey.replace(/[.#$[\]/]/g, '_');
      _magicRtdbRef = firebase.database().ref('magic_signals/' + _safeKey);
      // Clear any stale signal from a previous attempt, then listen
      _magicRtdbRef.remove().catch(() => {});
      _magicRtdbRef.on('value', function(snap) {
        const val = snap.val();
        // Log every value including null so we can see if the WebSocket connection is alive
        console.log('[ATLAS] RTDB listener fired, val:', val ? 'completed=' + val.completed : 'null');
        if (val && val.completed && _magicPendingKey) {
          const age = Date.now() - (val.ts || 0);
          console.log('[ATLAS] RTDB signal received, age:', age + 'ms');
          if (age < 5 * 60 * 1000) {
            _magicRtdbRef.remove().catch(() => {});
            _completeMagicAuth(_magicPendingKey, _magicPendingProfile, null);
          }
        }
      }, function(err) {
        console.error('[ATLAS] RTDB magic_signals permission denied:', err.code);
      });
      console.log('[ATLAS] RTDB signal listener active on magic_signals/' + _safeKey);
    } catch(e) {
      console.warn('[ATLAS] RTDB signal listener setup failed:', e);
    }
  }

  // ── SECONDARY: BroadcastChannel ───────────────────────────────────────────
  // Same-browser, same-origin. Fires faster than RTDB when relay tab is in the
  // same browser instance.
  try {
    _magicBroadcastChannel = new BroadcastChannel('atlas_magic');
    _magicBroadcastChannel.onmessage = function(e) {
      console.log('[ATLAS] BroadcastChannel message received:', e.data && e.data.type);
      if (e.data && e.data.type === 'magic_complete') {
        // BP-SEC-10: Nonce validation on BroadcastChannel
        try {
          const expectedNonce = sessionStorage.getItem('_mlinkNonce');
          if (expectedNonce && (!e.data.nonce || e.data.nonce !== expectedNonce)) {
            console.error('[ATLAS-AUTH] Magic link nonce mismatch — rejecting token');
            sessionStorage.removeItem('_mlinkNonce');
            return;
          }
        } catch(nonceErr) {}
        _completeMagicAuth(e.data.key, e.data.profile, e.data.token);
      }
    };
  } catch(err) {
    console.warn('[ATLAS] BroadcastChannel not supported');
  }

  // ── TERTIARY: localStorage + storage event + 2s poll ─────────────────────
  _magicFocusListener = _checkMagicLocalStorage;
  window.addEventListener('focus',   _magicFocusListener);
  window.addEventListener('storage', _magicFocusListener);
  _magicPollInterval = setInterval(_checkMagicLocalStorage, 2000);

  // ── QUATERNARY: Firebase onAuthStateChanged ───────────────────────────────
  // Same-browser only (Firebase syncs via IndexedDB). UID guard prevents the
  // immediate-fire false trigger from a pre-existing session — only completes
  // when a DIFFERENT (new) non-anonymous user signs in via the relay tab.
  _magicAuthUnsub = firebase.auth().onAuthStateChanged(function(user) {
    if (user && !user.isAnonymous && _magicPendingKey && user.uid !== _preWaitUid) {
      console.log('[ATLAS] onAuthStateChanged: new workspace user detected, uid:', user.uid);
      _completeMagicAuth(_magicPendingKey, _magicPendingProfile, null);
    }
  });
}

function _stopMagicLinkListener() {
  if (_magicAuthUnsub)           { _magicAuthUnsub(); _magicAuthUnsub = null; }
  if (_magicBroadcastChannel)    { _magicBroadcastChannel.close(); _magicBroadcastChannel = null; }
  if (_magicFocusListener) {
    window.removeEventListener('focus',   _magicFocusListener);
    window.removeEventListener('storage', _magicFocusListener);
    _magicFocusListener = null;
  }
  if (_magicPollInterval)        { clearInterval(_magicPollInterval); _magicPollInterval = null; }
  if (_magicRtdbRef)             { _magicRtdbRef.off(); _magicRtdbRef = null; }
  if (_magicCountdownInterval)   { clearInterval(_magicCountdownInterval); _magicCountdownInterval = null; }
  // BP-SEC-10: Clean up nonce from localStorage (sessionStorage cleared in _completeMagicAuth)
  try { localStorage.removeItem('_mlinkNonce'); } catch(e) {}
}

/**
 * Cancels the magic-link waiting state and returns the user to the key-entry screen.
 * Stops all listeners, resets UI, and re-enables the key input and submit button.
 * Called from the "Cancel" button in the magic-link waiting panel.
 */
function _cancelMagicLinkWait() {
  _stopMagicLinkListener();
  _magicPendingKey     = null;
  _magicPendingProfile = null;
  _magicResendCooldown = false;
  // Hide the magic-link waiting panel
  const magicStep = document.getElementById('ws-magic-step');
  if (magicStep) magicStep.style.display = 'none';
  // Reset the expired state so next attempt starts fresh
  const expiredEl = document.getElementById('ws-magic-expired');
  if (expiredEl) expiredEl.style.display = 'none';
  const timerEl = document.getElementById('ws-magic-timer');
  if (timerEl) timerEl.textContent = 'Expires in 15 minutes';
  // Re-enable key input and reset button
  const input = document.getElementById('ws-input');
  if (input) { input.value = ''; input.disabled = false; input.focus(); }
  const btn = document.getElementById('ws-submit');
  if (btn) { btn.disabled = false; btn.innerHTML = 'Verify Access →'; btn.style.background = ''; }
  const err = document.getElementById('ws-error');
  if (err) { err.classList.remove('show'); err.textContent = ''; }
  console.log('[ATLAS] Magic link wait cancelled by user — returned to key entry');
}

let _magicAuthCompleting = false; // guard against double-trigger from multiple channels

function _completeMagicAuth(key, profile, firebaseToken) {
  if (_magicAuthCompleting) return; // already in progress — ignore duplicate triggers
  _magicAuthCompleting = true;
  const currentUser = firebase.auth().currentUser;
  console.log('[ATLAS] _completeMagicAuth called, key:', key, 'currentUser:', currentUser && currentUser.uid, 'isAnonymous:', currentUser && currentUser.isAnonymous);
  _stopMagicLinkListener();
  try { localStorage.removeItem('atlas_magic_done'); } catch(e) {}
  // BP-SEC-10: Clear nonce after consuming the magic link (success or failure path)
  try { sessionStorage.removeItem('_mlinkNonce'); } catch(e) {}
  const resolvedProfile = _magicPendingProfile || profile || {};

  // ── Cross-browser magic link fix ──────────────────────────────────────────
  // If this tab is still anonymous, the relay tab has already authenticated in
  // another tab/browser. Sign in using the token from the relay if available,
  // otherwise re-exchange with Lambda (last resort — sends a second email).
  const needsSignIn = !currentUser || currentUser.isAnonymous;
  if (needsSignIn && firebaseToken) {
    // Token was passed by BroadcastChannel or localStorage relay — use it directly
    // so we don't trigger another Lambda call (which would send a second magic link email).
    console.log('[ATLAS] Using relay token for direct sign-in — skipping Lambda re-exchange');
    firebase.auth().signInWithCustomToken(firebaseToken)
      .then(() => { const u = firebase.auth().currentUser; return u ? u.getIdToken(true) : Promise.resolve(); })
      .then(() => { _grantWorkspaceAccess(key, resolvedProfile, { fromMagicLink: true }); setTimeout(() => { _magicAuthCompleting = false; }, 3000); })
      .catch(err => { console.error('[ATLAS] Relay token sign-in failed:', err.message); _grantWorkspaceAccess(key, resolvedProfile, { fromMagicLink: true }); setTimeout(() => { _magicAuthCompleting = false; }, 3000); });
    return;
  }
  if (needsSignIn && key) {
    console.log('[ATLAS] Anonymous user detected — re-exchanging key with Lambda for custom token');
    fetch(`${LAMBDA_URL}/validate-key`, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim().toUpperCase() })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.token) {
        return firebase.auth().signInWithCustomToken(data.token);
      }
      // No token from Lambda (e.g. key now requires MFA) — grant profile-only access
      console.warn('[ATLAS] Lambda re-exchange returned no token — falling back to profile-only grant');
      return null;
    })
    .then(() => {
      // Force token refresh so RTDB reads pick up the new custom claims immediately
      const u = firebase.auth().currentUser;
      return u ? u.getIdToken(true) : Promise.resolve();
    })
    .then(() => {
      console.log('[ATLAS] Custom token sign-in complete — granting workspace access');
      _grantWorkspaceAccess(key, resolvedProfile, { fromMagicLink: true });
      setTimeout(() => { _magicAuthCompleting = false; }, 3000);
    })
    .catch(err => {
      console.error('[ATLAS] Custom token re-exchange failed:', err.message);
      // Fall back to profile-only grant so the user isn't left on a blank screen
      _grantWorkspaceAccess(key, resolvedProfile, { fromMagicLink: true });
      setTimeout(() => { _magicAuthCompleting = false; }, 3000);
    });
    return; // async path — return early, grant happens in .then()
  }

  // Same-browser path — user already signed in via onAuthStateChanged → proceed directly
  console.log('[ATLAS] Authenticated user — granting access, role:', resolvedProfile.role || '(empty profile)');
  _grantWorkspaceAccess(key, resolvedProfile, { fromMagicLink: true });
  setTimeout(() => { _magicAuthCompleting = false; }, 3000);
}

function _grantWorkspaceAccess(code, profile, opts) {
  const _fromMagicLink = !!(opts && opts.fromMagicLink);
  const btn = document.getElementById('ws-submit');
  currentWorkspace  = code;
  // Guard: profile may be null if Lambda /verify-magic didn't return one
  workspaceProfile  = profile || {};
  profile = workspaceProfile;
  // Sync PEACS enabled dims from workspace profile (default to all 3 if not set)
  window._peacsEnabledDims = (profile.peacs_dims?.length > 0) ? profile.peacs_dims : ['base','mvmt','strata'];
  // btn is null when the magic link opens in a fresh window (modal not yet open) — guard it
  if (btn) {
    btn.textContent = '✓ Access Granted';
    btn.style.background = '#10b981';
  }
  // Load module path config from Firebase (non-blocking — hasModule() falls back to defaults)
  if (typeof _loadModulePaths === 'function') _loadModulePaths();

  // Magic link: skip the visual button-feedback delay
  const _delay = (_fromMagicLink || !btn) ? 0 : 700;

  const _doEnter = () => {
    // Override Lambda SSM role with Firebase-stored role (fixes old keys issued as 'researcher')
    // Firebase is authoritative — write happens at workspace creation time
    const _applyRoleAndEnter = (fbRole) => {
      if (fbRole && fbRole !== profile.role) {
        workspaceProfile.role = fbRole;
        profile.role = fbRole;
      }
      const actualRole  = profile.role || 'researcher';
      const isInstRole  = actualRole === 'institution' || actualRole === 'superadmin' || actualRole === 'observer';
      const actualMode  = isInstRole ? 'institution'
                        : actualRole === 'independent' ? 'independent'
                        : 'researcher';
      window._wsMode = actualMode;
      sessionStorage.setItem('atlas_workspace', code);
      sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(workspaceProfile));
      sessionStorage.setItem('atlas_ws_mode', actualMode);
      // Reset MFA + magic link state
      _mfaPendingKey = null; _mfaPendingProfile = null; _mfaSessionToken = null;
      _magicPendingKey = null; _magicPendingProfile = null;
      // Show My Studies button for keyed roles that support LOPs
      const lopRoles = new Set(['student','researcher','pi']);
      const myStudiesBtn = document.getElementById('my-studies-btn');
      if (myStudiesBtn) myStudiesBtn.style.display = lopRoles.has(actualRole) ? 'flex' : 'none';
      closeWorkspaceModal();
      enterResearcherDashboard();
      const name = profile.name || code;
      const welcomeMsg = (typeof isClinician === 'function' && isClinician())
        ? `✓ Welcome, ${name} — patient panel is active.`
        : `✓ Welcome, ${name} — cohort is now active.`;
      showToast(welcomeMsg, 4000);
    };

    // Attempt Firebase role lookup; fall back immediately on any error
    if (typeof database !== 'undefined' && database && database.ref) {
      database.ref('workspaces/' + code + '/role').once('value')
        .then(snap => { _applyRoleAndEnter(snap && snap.val()); })
        .catch(() => { _applyRoleAndEnter(null); });
    } else {
      _applyRoleAndEnter(null);
    }
  };

  setTimeout(_doEnter, _delay);
}

/**
 * Restores a workspace session from `sessionStorage` on page reload.
 * Parses the stored workspace profile JSON and repopulates global state variables.
 * @returns {boolean} `true` if a valid session was restored, `false` otherwise
 */
function restoreWorkspaceSession() {
  const code    = sessionStorage.getItem('atlas_workspace');
  const profile = sessionStorage.getItem('atlas_workspace_profile');
  if (code && profile) {
    try {
      workspaceProfile = JSON.parse(profile);
      _normalizeInstType(workspaceProfile);
    } catch(e) {
      console.warn('[ATLAS] Corrupted workspace profile in sessionStorage, clearing.', e);
      sessionStorage.removeItem('atlas_workspace');
      sessionStorage.removeItem('atlas_workspace_profile');
      sessionStorage.removeItem('atlas_ws_mode');
      return false;
    }
    currentWorkspace  = code;
    window._wsMode    = sessionStorage.getItem('atlas_ws_mode') || 'researcher';
    // Reload module paths after session restore (non-blocking)
    if (typeof _loadModulePaths === 'function') _loadModulePaths();
    // Fire async Firebase role patch — fixes old sessions where SSM stored 'researcher'
    // but Firebase has the true role (e.g. 'clinician'). Re-enters dashboard if role changed.
    if (typeof database !== 'undefined' && database && database.ref && code) {
      database.ref('workspaces/' + code + '/role').once('value').then(snap => {
        const fbRole = snap && snap.val();
        if (fbRole && fbRole !== workspaceProfile.role) {
          workspaceProfile.role = fbRole;
          sessionStorage.setItem('atlas_workspace_profile', JSON.stringify(workspaceProfile));
          // Re-enter dashboard with corrected role so clinician panels render properly
          if (typeof enterResearcherDashboard === 'function') enterResearcherDashboard();
        }
      }).catch(() => {});
    }
    return true;
  }
  return false;
}

let dashMiniMmasInited = false;
let dashMiniPeacsInited = false;
let dashMiniMapInited = false;
let dashMiniMmas = null;
let dashMiniPeacs = null;
let dashMiniMap = null;

/**
 * Initializes the dashboard mini-maps (MMAS globe and PEACS globe) using Mapbox GL JS.
 * Only runs for non-institution modes. Skips initialization if already done.
 * Depends on `ensureMapbox()` lazy-loader.
 * @returns {void}
 */
function initDashMiniMaps() {
  restoreCardCollapseState();
  // Mini-maps: only initialize for non-institution modes
  if (!isInstitutionMode()) {
  ensureMapbox().then(() => {
  mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;

  // One WebGL draw call for all points instead of 1800+ DOM Marker nodes
  function _addDotLayer(map, srcId, features) {
    if (map.getSource(srcId)) { map.getSource(srcId).setData({type:'FeatureCollection',features}); return; }
    map.addSource(srcId, {type:'geojson', data:{type:'FeatureCollection',features}});
    map.addLayer({id:srcId+'-layer', type:'circle', source:srcId,
      paint:{'circle-radius':2.5,'circle-color':['get','color'],'circle-opacity':0.85,'circle-blur':0.3}});
  }

  if (!dashMiniMmasInited) {
    dashMiniMmasInited = true;
    dashMiniMmas = new mapboxgl.Map({
      container:'dash-mini-mmas', style:(window._mapboxThemeStyle||'mapbox://styles/mapbox/dark-v11'),
      center:[0,20], zoom:0.2, projection:'globe', interactive:false, attributionControl:false
    });
    dashMiniMmas.on('load', () => {
      const fog = window._mapboxFog || {color:'#04091c','high-color':'#0d1a3a','horizon-blend':0.06,'space-color':'#010408','star-intensity':0.4};
      dashMiniMmas.setFog(fog);
      if (window._miniMmasRotInt) clearInterval(window._miniMmasRotInt);
      window._miniMmasRotInt = setInterval(()=>{ const c=dashMiniMmas.getCenter(); c.lng=(c.lng+2)%360; dashMiniMmas.setCenter(c); },2000);
      database.ref('assessments').once('value', snap => {
        const data = snap.val(); if (!data) return;
        const features = [];
        Object.values(data).forEach(a => {
          if (!a.latitude||!a.longitude) return;
          if (a.tool === 'map' || a.map_q1 !== undefined) return; // exclude MAP records
          features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
            properties:{color:getAdherenceCategory(a.score||0).color}});
        });
        _addDotLayer(dashMiniMmas, 'mini-mmas-pts', features);
        // ── Globe point badge — clarifies what's plotted vs. missing geolocation ──
        {
          const _cnt = features.length;
          const _prev = document.getElementById('globe-mmas-badge');
          if (_prev) _prev.remove();
          const _badge = document.createElement('div');
          _badge.id = 'globe-mmas-badge';
          _badge.style.cssText = 'position:absolute;bottom:10px;left:12px;z-index:4;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);background:rgba(5,9,26,0.72);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:3px 8px;pointer-events:none;backdrop-filter:blur(4px);';
          _badge.textContent = _cnt > 0 ? '🌐 ' + _cnt.toLocaleString() + ' geolocated' : 'No geolocated records yet — enable browser location to plot submissions';
          const _container = document.getElementById('dash-mini-mmas');
          if (_container) _container.appendChild(_badge);
        }
        if (!window._miniMmasLiveInited) {
          window._miniMmasLiveInited = true;
          const since = Date.now();
          database.ref('assessments').on('child_added', snap => {
            const a = snap.val();
            if (!a||!a.latitude||!a.longitude||!a.timestamp||a.timestamp<=since) return;
            if (a.tool === 'map' || a.map_q1 !== undefined) return; // exclude MAP records from MMAS-8 globe
            const src = dashMiniMmas.getSource('mini-mmas-pts'); if (!src) return;
            const gj = src._data||{type:'FeatureCollection',features:[]};
            gj.features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
              properties:{color:getAdherenceCategory(a.score||0).color}});
            src.setData(gj);
          });
        }
      });
    });
  } else if (dashMiniMmas) { dashMiniMmas.resize(); }

  if (!dashMiniPeacsInited) {
    dashMiniPeacsInited = true;
    dashMiniPeacs = new mapboxgl.Map({
      container:'dash-mini-peacs', style:(window._mapboxThemeStyle||'mapbox://styles/mapbox/dark-v11'),
      center:[30,20], zoom:0.2, projection:'globe', interactive:false, attributionControl:false
    });
    dashMiniPeacs.on('load', () => {
      const fog = window._mapboxFog || {color:'#04091c','high-color':'#0d1a3a','horizon-blend':0.06,'space-color':'#010408','star-intensity':0.4};
      dashMiniPeacs.setFog(fog);
      if (window._miniPeacsRotInt) clearInterval(window._miniPeacsRotInt);
      window._miniPeacsRotInt = setInterval(()=>{ const c=dashMiniPeacs.getCenter(); c.lng=(c.lng+2.2)%360; dashMiniPeacs.setCenter(c); },2000);
      const peCol = pe => pe>=0.85?'#10b981':pe>=0.70?'#3b82f6':pe>=0.55?'#f59e0b':pe>=0.40?'#ef4444':'#991b1b';
      database.ref('peacs_assessments').once('value', snap => {
        const data = snap.val(); if (!data) return;
        const features = [];
        Object.values(data).forEach(a => {
          if (!a.latitude||!a.longitude) return;
          features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
            properties:{color:peCol(a.pe||0)}});
        });
        _addDotLayer(dashMiniPeacs, 'mini-peacs-pts', features);
        if (!window._miniPeacsLiveInited) {
          window._miniPeacsLiveInited = true;
          const since = Date.now();
          database.ref('peacs_assessments').on('child_added', snap => {
            const a = snap.val();
            if (!a||!a.latitude||!a.longitude||!a.timestamp||a.timestamp<=since) return;
            const src = dashMiniPeacs.getSource('mini-peacs-pts'); if (!src) return;
            const gj = src._data||{type:'FeatureCollection',features:[]};
            gj.features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
              properties:{color:peCol(a.pe||0)}});
            src.setData(gj);
          });
        }
      });
    });
  } else if (dashMiniPeacs) { dashMiniPeacs.resize(); }

  if (!dashMiniMapInited) {
    dashMiniMapInited = true;
    dashMiniMap = new mapboxgl.Map({
      container:'dash-mini-map', style:(window._mapboxThemeStyle||'mapbox://styles/mapbox/dark-v11'),
      center:[60,15], zoom:0.2, projection:'globe', interactive:false, attributionControl:false
    });
    dashMiniMap.on('load', () => {
      const fog = window._mapboxFog || {color:'#04091c','high-color':'#0d1a3a','horizon-blend':0.06,'space-color':'#010408','star-intensity':0.4};
      dashMiniMap.setFog(fog);
      if (window._miniMapRotInt) clearInterval(window._miniMapRotInt);
      window._miniMapRotInt = setInterval(()=>{ const c=dashMiniMap.getCenter(); c.lng=(c.lng+1.8)%360; dashMiniMap.setCenter(c); },2000);
      // Plot only genuine MAP assessments (tool:'map' or legacy map_q1 key)
      database.ref('assessments').once('value', snap => {
        const data = snap.val(); if (!data) return;
        const features = [];
        Object.values(data).forEach(a => {
          if (!a.latitude||!a.longitude) return;
          if (a.tool !== 'map' && a.map_q1 === undefined) return; // strict MAP-only filter
          const peCol = pe => pe>=0.75?'#10b981':pe>=0.50?'#3b82f6':pe>=0.25?'#f59e0b':'#ef4444';
          features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
            properties:{color:a.pe_score!=null ? peCol(a.pe_score) : getAdherenceCategory(a.score||0).color}});
        });
        if (dashMiniMap.getSource('mini-map-pts')) { dashMiniMap.getSource('mini-map-pts').setData({type:'FeatureCollection',features}); return; }
        dashMiniMap.addSource('mini-map-pts', {type:'geojson', data:{type:'FeatureCollection',features}});
        dashMiniMap.addLayer({id:'mini-map-pts-layer', type:'circle', source:'mini-map-pts',
          paint:{'circle-radius':2.5,'circle-color':['get','color'],'circle-opacity':0.85,'circle-blur':0.3}});
        // Live listener — MAP records only
        if (!window._miniMapLiveInited) {
          window._miniMapLiveInited = true;
          const mapSince = Date.now();
          database.ref('assessments').on('child_added', snap => {
            const a = snap.val();
            if (!a||!a.latitude||!a.longitude||!a.timestamp||a.timestamp<=mapSince) return;
            if (a.tool !== 'map' && a.map_q1 === undefined) return; // MAP records only
            const src = dashMiniMap.getSource('mini-map-pts'); if (!src) return;
            const peCol = pe => pe>=0.75?'#10b981':pe>=0.50?'#3b82f6':pe>=0.25?'#f59e0b':'#ef4444';
            const gj = src._data||{type:'FeatureCollection',features:[]};
            gj.features.push({type:'Feature',geometry:{type:'Point',coordinates:[a.longitude,a.latitude]},
              properties:{color:a.pe_score!=null ? peCol(a.pe_score) : getAdherenceCategory(a.score||0).color}});
            src.setData(gj);
          });
        }
      });
    });
  } else if (dashMiniMap) { dashMiniMap.resize(); }

  }); // end ensureMapbox
  } // end !isInstitutionMode()
}

// ── Module locked metadata ────────────────────────────────────────────────────
// Used by the "Expand Workspace" card to describe available add-ons.
const _MODULE_LOCK_META = {
  analytics_map:          { icon:'◈', label:'MAP Analytics',             desc:'MAP Tri-Domain Predictive Emergence analytics — APE scoring, phenotype distribution, and adherence drivers.', premium:false },
  analytics_subgroup:     { icon:'◫', label:'Subgroup Analysis',         desc:'Drug·condition outcome stratification — cross-tabulate adherence by medication class, diagnosis, and demographic strata.', premium:false },
  analytics_peacs:        { icon:'◉', label:'PEACS Analytics',           desc:'Longitudinal PEACS dimension tracking — visualise BASE, MVMT, and STRATA trajectories over time.', premium:false },
  analytics_psychometrics:{ icon:'◬', label:'Psychometrics Suite',       desc:'Cronbach α, test-retest reliability indices, and normative benchmarking against the global ATLAS cohort.', premium:false },
  analytics_power:        { icon:'◐', label:'Sample Size Advisor',       desc:'Statistical power calculator, effect size estimator, and sample size planner for your study design.', premium:false },
  analytics_geospatial:   { icon:'◎', label:'Cohort Geospatial Map',     desc:'Plot your cohort geographically — patient density, regional adherence phenotypes, and ZIP-level heatmaps.', premium:false },
  premium_nlq:            { icon:'◍', label:'AI Natural Language Query', desc:'Ask plain-language questions about your cohort — powered by Claude AI. "What is the mean MAP PE score for patients with hypertension?"', premium:true  },
};

/** Hide a panel that the current role/module set doesn't include. No card injection. */
function _showModuleLocked(panelEl, moduleId) {
  if (!panelEl) return;
  panelEl.style.display = 'none';
}

/** No-op kept for call-site compatibility. */
function _clearLockedCards() {}

function enterResearcherDashboard() {
  atlasAuditLog('dashboard_access', { workspace: currentWorkspace, role: workspaceProfile && workspaceProfile.role });
  document.body.classList.add('researcher-mode');
  document.body.classList.remove('patient-mode');
  const label = getScopeLabel();
  document.getElementById('dash-workspace-label').textContent = label || 'Workspace';
  if (!userLocation) requestGeolocation().then(() => fillSdohLocation());

  const isExplorer    = window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER';
  const isResearcher  = isResearcherMode();
  const isInstitution = isInstitutionMode();
  const isStudentRole = workspaceProfile?.role === 'student';

  // Cohort toggle: show for any authenticated workspace (researcher, institution, superadmin)
  const cohortToggleBtn = document.getElementById('map-cohort-toggle-btn');
  if (cohortToggleBtn) {
    const wsOk = currentWorkspace &&
      currentWorkspace !== 'EXPLORER' &&
      currentWorkspace !== 'INDEPENDENT';
    cohortToggleBtn.style.display = wsOk ? '' : 'none';
  }
  // Also notify inline cohort toggle listener
  if (window._onResearcherLogin) window._onResearcherLogin.forEach(fn => { try { fn(); } catch(e) {} });

  const bulkBtn = document.getElementById('dash-bulk-btn');
  // Students use the Publish tab upload widget — hide the workspace bulk upload from them
  if (bulkBtn) bulkBtn.style.display = ((isInstitution || isResearcher) && !isStudentRole && hasModule('assess_bulk')) ? '' : 'none';
  document.querySelectorAll('.mc-ghost-btn').forEach(btn => {
    if (btn.textContent.includes('Template')) btn.style.display = ((isInstitution || isResearcher) && !isStudentRole) ? '' : 'none';
  });
  // Students have their own export buttons in the student tab — hide the main export buttons
  document.querySelectorAll('#mmas-export-btn, #peacs-export-btn').forEach(b => {
    if (b) b.style.display = (isResearcher && !isStudentRole && hasModule('export_csv')) ? '' : 'none';
  });
  const dashPeacsExport = document.getElementById('dash-export-btn');
  if (dashPeacsExport) dashPeacsExport.style.display = (isResearcher && !isStudentRole && hasModule('export_csv')) ? '' : 'none';
  const qrBtn = document.getElementById('dash-qr-btn');
  if (qrBtn) qrBtn.style.display = (isResearcher && !isStudentRole) ? '' : 'none'; // Patient QR: researcher + institution only

  const chip = document.querySelector('.dash-workspace-chip');
  const dot  = document.querySelector('.dash-workspace-dot');
  if (chip && dot) {
    if (isSuperAdmin())         { chip.style.background='rgba(212,168,67,0.1)';chip.style.borderColor='rgba(212,168,67,0.3)';chip.style.color='var(--pe)';dot.style.background='var(--pe)';dot.style.boxShadow='0 0 5px var(--pe)'; }
    else if (isInstitution)     { chip.style.background='rgba(139,111,245,0.08)';chip.style.borderColor='rgba(139,111,245,0.25)';chip.style.color='var(--mvmt)';dot.style.background='var(--mvmt)';dot.style.boxShadow='0 0 5px var(--mvmt)'; }
    else if (isClinician())     { chip.style.background='rgba(16,185,129,0.08)';chip.style.borderColor='rgba(16,185,129,0.28)';chip.style.color='#10b981';dot.style.background='#10b981';dot.style.boxShadow='0 0 5px #10b981'; }
    else if (isPIResearcher())  { chip.style.background='rgba(78,156,245,0.08)';chip.style.borderColor='rgba(78,156,245,0.25)';chip.style.color='var(--base)';dot.style.background='var(--base)';dot.style.boxShadow='0 0 5px var(--base)'; }
    else if (isIndependentMode()){ chip.style.background='rgba(100,116,139,0.08)';chip.style.borderColor='rgba(100,116,139,0.25)';chip.style.color='#94a3b8';dot.style.background='#94a3b8';dot.style.boxShadow='0 0 5px #94a3b8'; }
    else if (isExplorer)        { chip.style.background='rgba(46,201,138,0.08)';chip.style.borderColor='rgba(46,201,138,0.2)';chip.style.color='#2ec98a';dot.style.background='#2ec98a';dot.style.boxShadow='0 0 5px #2ec98a'; }
    else                        { chip.style.background='';chip.style.borderColor='';chip.style.color='';dot.style.background='';dot.style.boxShadow=''; }
  }

  updateDashContextBanner();
  // View-As toolbar removed — use Impersonate Role in ATLAS Mission Control instead

  const irbBtn = document.getElementById('irb-cert-btn');
  if (irbBtn) irbBtn.style.display = (isResearcher && !isStudentRole && hasModule('export_irb')) ? '' : 'none'; // session cert: researcher + institution
  const irbAggBtn = document.getElementById('irb-aggregate-btn');
  if (irbAggBtn) irbAggBtn.style.display = (isInstitution && hasModule('export_csv')) ? '' : 'none'; // aggregate export: institution only

  const mmasGlobal  = document.getElementById('mc-global-mmas');
  const peacsGlobal = document.getElementById('mc-global-peacs');
  if (mmasGlobal)  mmasGlobal.style.display  = isInstitution ? 'flex' : 'none';
  if (peacsGlobal) peacsGlobal.style.display = isInstitution ? 'flex' : 'none';
  if (isInstitution) loadGlobalContextStats();

  // Institution analytics dashboard — replaces instrument cards
  const instDash  = document.getElementById('institution-analytics-dashboard');
  const instrRow  = document.querySelector('.mc-instrument-row');
  const specBtn   = document.getElementById('dash-spectator-btn')?.parentElement;
  const recPanel  = document.querySelector('.mc-records-panel');
  const pulseBar  = document.querySelector('.dash-pulse-bar');
  if (isInstitution) {
    if (instDash)  instDash.style.display  = '';
    if (instrRow)  instrRow.style.display  = 'none';
    if (specBtn)   specBtn.style.display   = 'none';
    if (recPanel)  recPanel.style.display  = 'none';
    if (pulseBar)  pulseBar.style.display  = 'none'; // KPI strip replaces pulse bar
    // Set institution name + user in header
    // workspaceProfile fields (cohortLabel, institution) are unreliable for display —
    // resolve the institution name from Firebase workspaces node, which is authoritative.
    const userName = workspaceProfile ? (workspaceProfile.name || '') : '';
    const instDashName = document.getElementById('inst-dash-name');
    const instDashUser = document.getElementById('inst-dash-user');
    if (instDashName) instDashName.textContent = '…';
    if (instDashUser) instDashUser.textContent = userName;
    database.ref('workspaces/' + currentWorkspace).once('value')
      .then(snap => {
        const d = snap.val();
        const label = (d && (d.institution || d.name || d.cohortLabel)) || currentWorkspace;
        if (instDashName) instDashName.textContent = label;
      })
      .catch(() => {
        // fallback: format workspace key
        if (instDashName) instDashName.textContent =
          (workspaceProfile && workspaceProfile.institution) || currentWorkspace;
      });
    // Gate tabs and panels to match the institution's type (health / academic / amc)
    _applyInstTabGating();
  } else {
    if (instDash)  instDash.style.display  = 'none';
    if (instrRow)  instrRow.style.display  = isStudentRole ? 'none' : '';
    if (specBtn)   specBtn.style.display   = (isStudentRole || isPIResearcher()) ? 'none' : '';
    if (recPanel)  recPanel.style.display  = '';
    if (pulseBar)  pulseBar.style.display  = '';
  }

  // ── MTM TAB: wire badge + suppress dash-body MTM panels for institution users ──
  if (isInstitution) {
    // MTM panels in dash-body will be relocated into inst-tab-panel-mtm by initInstMTMTab()
    // Hide them from dash-body immediately so there's no flash/duplicate
    const mtmTimerPanel = document.getElementById('mtm-timer-panel');
    const mtmAuditPanel = document.getElementById('mtm-audit-panel');
    if (mtmTimerPanel) mtmTimerPanel.style.display = 'none';
    if (mtmAuditPanel) mtmAuditPanel.style.display = 'none';

    // MTM tab: all clinician roles now have access (PharmD bills independently; others supervised)
    const _hasMTM = isSuperAdmin() || isClinician() || isInstitutionMode();
    const _mtmBadge = document.getElementById('inst-mtm-tab-badge');
    if (_mtmBadge) _mtmBadge.style.display = _hasMTM ? 'inline' : 'none';
  }

  // Show/hide institution command center
  const icc = document.getElementById('institution-command-center');
  if (icc) {
    icc.style.display = isInstitution ? 'block' : 'none';
    if (isInstitution) refreshCommandCenter();
  }
  // Phase 1: Inject institution tier badge into dash nav
  const _oldTierBadge = document.getElementById('inst-tier-badge');
  if (_oldTierBadge) _oldTierBadge.remove();
  if (isInstitution && workspaceProfile) {
    const _tierLabel = workspaceProfile.contract_tier || 'Academic';
    const _tierColors = { Academic:'rgba(46,201,138,0.15),rgba(46,201,138,0.4),#2ec98a', Clinical:'rgba(78,156,245,0.15),rgba(78,156,245,0.4),#4e9cf5', Enterprise:'rgba(212,168,67,0.15),rgba(212,168,67,0.4),#d4a843' };
    const _tc = (_tierColors[_tierLabel] || _tierColors['Academic']).split(',');
    const _badge = document.createElement('div');
    _badge.id = 'inst-tier-badge';
    _badge.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;background:'+_tc[0]+';border:1px solid '+_tc[1]+';color:'+_tc[2]+';border-radius:4px;padding:3px 9px;margin-left:8px;';
    _badge.textContent = _tierLabel + ' Tier';
    const _chip = document.querySelector('.dash-workspace-chip');
    if (_chip && _chip.parentNode) _chip.parentNode.insertBefore(_badge, _chip.nextSibling);
  }

  // Show/hide researcher patient panel — any workspace user who isn't institution, superadmin, or observer
  const rpp = document.getElementById('researcher-patient-panel');
  const showRpp = !isInstitution && !isSuperAdmin() && !isObserverMode() && !!currentWorkspace
                  && currentWorkspace !== 'EXPLORER'
                  && window._wsMode !== 'explorer';
  if (rpp) rpp.style.display = showRpp ? 'block' : 'none';
  // Research analytics panel mirrors researcher-patient-panel visibility
  const rapPanel = document.getElementById('res-analytics-panel');
  if (rapPanel) rapPanel.style.display = showRpp ? 'block' : 'none';
  // Populate cohort name label
  const rapCohortName = document.getElementById('rap-cohort-name');
  if (rapCohortName && showRpp) {
    const cname = (workspaceProfile && workspaceProfile.name) || currentWorkspace || '';
    rapCohortName.textContent = cname ? '· ' + cname : '';
  }
  // Clinical Practice Overview — clinician roles with module entitlement
  const cpoPanel = document.getElementById('cpo-panel');
  // CPO is shown for all clinician roles — it is core clinical intelligence, not a premium add-on.
  // The module gate (clinical_overview) was removed; the panel shows whenever isClinician() is true.
  const showCPO  = showRpp && isClinician();
  if (cpoPanel) cpoPanel.style.display = showCPO ? 'block' : 'none';

  // ── Clinical Billing tab badge — any clinician role ───────────────────────
  const _billingBadge = document.getElementById('inst-billing-tab-badge');
  if (_billingBadge) {
    const _tier = (workspaceProfile?.tier || workspaceProfile?.role || '').toLowerCase();
    const _hasBilling = isSuperAdmin() || isClinician() || _tier === 'researcher' || _tier === 'pi' || _tier === 'institution';
    _billingBadge.style.display = _hasBilling ? 'inline' : 'none';
    if (isClinician()) _billingBadge.textContent = getClinicianLabel().split(' · ')[0];
  }

  // ── Student dashboard tabs ─────────────────────────────────────────────────
  // Remove any stale student tab bar before re-injecting
  const _prevStudTab = document.getElementById('student-dash-tabs');
  if (_prevStudTab) _prevStudTab.remove();
  const _prevStudPanel = document.getElementById('student-dash-panel');
  if (_prevStudPanel) _prevStudPanel.remove();

  if (showRpp && workspaceProfile?.role === 'student') {
    const _db = document.querySelector('#screen-dashboard .dash-body');
    if (_db) {
      // Hide panels that the student surface replaces
      const _slp = document.getElementById('session-launcher-panel');
      if (_slp) _slp.style.display = 'none';
      const _rppEl = document.getElementById('researcher-patient-panel');
      if (_rppEl) _rppEl.style.display = 'none';
      const _rapEl = document.getElementById('res-analytics-panel');
      if (_rapEl) _rapEl.style.display = 'none';
      const _rabEl = document.getElementById('dash-researcher-action-bar');
      if (_rabEl) _rabEl.style.display = 'none';
      const _mcRec = document.querySelector('.mc-records-panel');
      if (_mcRec) _mcRec.style.display = 'none';

      // Single-surface student research desktop — no tabs
      const stPanel = document.createElement('div');
      stPanel.id = 'student-dash-panel';

      const _stuName   = (workspaceProfile && workspaceProfile.name) || '';
      const _stuByline = _stuName || 'Student Researcher';

      // Helper: pre-select instrument radio then open session modal.
      // Single source of truth — all session starts go through here.
      window._stuStartSession = function(instrument) {
        var r = document.querySelector("input[name='sess-instrument'][value='" + instrument + "']");
        if (r) r.checked = true;
        openSessionModal();
      };

      stPanel.innerHTML = `
        <!-- ══════════════════════════════════════════════════════════════════
             STUDENT WORKSPACE — Modular Layout
             Each section is a self-contained lego block with: eyebrow label,
             title, and collapse toggle. Blocks are independently hideable.
        ══════════════════════════════════════════════════════════════════ -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 1 · WORKSPACE HEADER — always visible                  -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-header" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <div style="padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
              <div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Student Workspace · ATLAS</div>
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.40rem;font-weight:300;color:var(--bright);line-height:1.15;">${_stuByline}</div>
                <div id="stu-header-inst" style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-top:4px;display:none;"></div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <button onclick="enterSpectatorMode()" style="padding:7px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.2);color:#059669;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background='rgba(5,150,105,0.12)'" onmouseout="this.style.background='rgba(5,150,105,0.06)'">🌐 Global Map</button>
                <button onclick="openStuGlossary()" style="padding:7px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.2);color:var(--base);border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background='rgba(78,156,245,0.13)'" onmouseout="this.style.background='rgba(78,156,245,0.06)'">Glossary</button>
              </div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- SESSION STRIP — single entry point for all session actions     -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-session-strip" style="background:var(--card);border:1.5px solid rgba(5,150,105,0.22);border-radius:12px;overflow:hidden;">
            <!-- Strip header -->
            <div style="padding:10px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:rgba(5,150,105,0.025);">
              <div style="width:3px;height:30px;background:linear-gradient(to bottom,#059669 0%,#2563eb 50%,#7c3aed 100%);border-radius:2px;flex-shrink:0;"></div>
              <div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Assessment · Upload · QR</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Start Session</div>
              </div>
              <div style="flex:1;"></div>
              <span id="stu-sess-count-label" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);"></span>
            </div>
            <!-- Action row -->
            <div style="padding:12px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <!-- Instrument launchers -->
              <button id="stu-sess-map" onclick="_stuStartSession('map')"
                data-tip="Multidimensional Adherence Parameters — measures Architecture, Execution, and Context domains"
                style="padding:9px 18px;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(5,150,105,0.07);border:1px solid rgba(5,150,105,0.28);color:#059669;border-radius:7px;cursor:pointer;transition:all 0.18s;"
                onmouseover="this.style.background='rgba(5,150,105,0.15)'" onmouseout="this.style.background='rgba(5,150,105,0.07)'">⬡ MAP</button>
              <button id="stu-sess-mmas" onclick="_stuStartSession('mmas')"
                data-tip="Morisky Medication Adherence Scale — 8-item validated adherence instrument"
                style="padding:9px 18px;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.25);color:#2563eb;border-radius:7px;cursor:pointer;transition:all 0.18s;"
                onmouseover="this.style.background='rgba(37,99,235,0.14)'" onmouseout="this.style.background='rgba(37,99,235,0.07)'">◉ MMAS-8</button>
              <button id="stu-sess-peacs" onclick="_stuStartSession('peacs')"
                data-tip="Patient Ecosystem Adherence Composite Score — 7-item cross-domain assessment"
                style="padding:9px 18px;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.25);color:#7c3aed;border-radius:7px;cursor:pointer;transition:all 0.18s;"
                onmouseover="this.style.background='rgba(124,58,237,0.14)'" onmouseout="this.style.background='rgba(124,58,237,0.07)'">◈ PEACS</button>
              <!-- Divider -->
              <div style="width:1px;height:26px;background:var(--border2);margin:0 4px;flex-shrink:0;"></div>
              <!-- Utility actions -->
              <button id="stu-sess-import" onclick="openBulkUpload()" class="stu-btn">⬆ Import</button>
              <button id="stu-sess-qr" onclick="openPatientQR()" class="stu-btn">⬜ QR Scan</button>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 3 · COHORT SNAPSHOT — always visible                   -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-snapshot" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <div style="padding:14px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#94a3b8;border-radius:2px;flex-shrink:0;"></div>
              <div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Your Data</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Cohort Snapshot</div>
              </div>
              <button onclick="showScreen(\'screen-peacs\');switchPeacsTab(\'kybos\');" class="stu-kybos-btn">⬡ KYBOS / Loom →</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;">
              <div style="padding:18px 20px;border-right:1px solid var(--border);">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.18em;text-transform:uppercase;color:#2563eb;margin-bottom:3px;"><span data-tip="Morisky Medication Adherence Scale — 8-item validated adherence instrument">MMAS-8</span></div>
                <div id="stu-session-count" style="font-family:'IBM Plex Mono',monospace;font-size:2rem;font-weight:700;color:var(--bright);line-height:1;letter-spacing:-0.03em;">—</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);margin-top:3px;">assessments</div>
                <div style="margin-top:8px;display:flex;align-items:baseline;gap:6px;">
                  <div id="stu-session-avg" style="font-family:'IBM Plex Mono',monospace;font-size:1.2rem;font-weight:600;color:#2563eb;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);">mean / 8</div>
                </div>
                <div style="margin-top:4px;display:flex;align-items:baseline;gap:6px;">
                  <div id="stu-session-low" style="font-family:'IBM Plex Mono',monospace;font-size:0.95rem;font-weight:600;color:#dc2626;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);">low adherence</div>
                </div>
              </div>
              <div style="padding:18px 20px;border-right:1px solid var(--border);">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.18em;text-transform:uppercase;color:#059669;margin-bottom:3px;"><span data-tip="Multidimensional Adherence Parameters — measures Architecture, Execution, and Context domains">MAP</span></div>
                <div id="stu-val-map-n" style="font-family:'IBM Plex Mono',monospace;font-size:2rem;font-weight:700;color:var(--bright);line-height:1;letter-spacing:-0.03em;">—</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);margin-top:3px;">assessments</div>
                <div style="margin-top:8px;display:flex;align-items:baseline;gap:6px;">
                  <div id="stu-pe-composite-score" style="font-family:'IBM Plex Mono',monospace;font-size:1.2rem;font-weight:600;color:#059669;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);"><span data-tip="Predictive Emergence — composite adherence score from MAP tri-domain model">PE</span> avg</div>
                </div>
              </div>
              <div style="padding:18px 20px;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.18em;text-transform:uppercase;color:#7c3aed;margin-bottom:3px;"><span data-tip="Patient Ecosystem Adherence Composite Score — 7-item cross-domain assessment">PEACS</span></div>
                <div id="stu-val-mmas-n" style="font-family:'IBM Plex Mono',monospace;font-size:2rem;font-weight:700;color:var(--bright);line-height:1;letter-spacing:-0.03em;">—</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);margin-top:3px;">assessments</div>
              </div>
            </div>
            <div id="stu-velocity-wrap" style="margin-top:12px;padding:0 20px 18px;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#607898;margin-bottom:4px;">Enrollment Velocity</div>
              <div id="stu-velocity-chart" style="width:100%;height:140px;display:none;"></div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 4 · ADHERENCE PATTERNS — collapsible                   -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-patterns" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById('stu-mod-patterns-body');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('.stu-mod-toggle').textContent=open?'▶':'▼';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#2563eb;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · <span data-tip="Morisky Medication Adherence Scale — 8-item validated adherence instrument">MMAS-8</span> Analysis</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Adherence Patterns</div>
              </div>
              <div class="stu-mod-toggle" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);">▼</div>
            </button>
            <div id="stu-mod-patterns-body" style="padding:4px 20px 18px;border-top:1px solid var(--border);">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px;margin-top:14px;">
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #059669;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.50rem;color:#059669;margin-bottom:5px;">High Adherence</div>
                  <div id="stu-count-high" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.54rem;color:var(--dim);margin-top:3px;">score ≥ 8</div>
                </div>
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #dc2626;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.50rem;color:#dc2626;margin-bottom:5px;"><span data-tip="Intentional Non-Adherence — patient chooses not to take medication">INA</span></div>
                  <div id="stu-count-ina" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#dc2626;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.54rem;color:var(--dim);margin-top:3px;">intentional</div>
                </div>
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #d97706;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.50rem;color:#d97706;margin-bottom:5px;"><span data-tip="Unintentional Non-Adherence — patient forgets or has barriers to taking medication">UNA</span></div>
                  <div id="stu-count-una" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#d97706;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.54rem;color:var(--dim);margin-top:3px;">unintentional</div>
                </div>
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #7c3aed;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.50rem;color:#7c3aed;margin-bottom:5px;">Mixed Patterns</div>
                  <div id="stu-count-mixed" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#7c3aed;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.54rem;color:var(--dim);margin-top:3px;">both present</div>
                </div>
              </div>
              <div id="stu-dist-bar" style="display:flex;height:4px;border-radius:2px;overflow:hidden;background:rgba(0,0,0,0.05);margin-bottom:10px;">
                <div id="stu-bar-high"  style="height:100%;background:#059669;width:0%;transition:width 0.6s ease;"></div>
                <div id="stu-bar-una"   style="height:100%;background:#d97706;width:0%;transition:width 0.6s ease;"></div>
                <div id="stu-bar-ina"   style="height:100%;background:#dc2626;width:0%;transition:width 0.6s ease;"></div>
                <div id="stu-bar-mixed" style="height:100%;background:#7c3aed;width:0%;transition:width 0.6s ease;"></div>
              </div>
              <div id="stu-benchmark-container"></div>
              <div id="stu-score-histogram-wrap" style="margin-top:12px;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#607898;margin-bottom:4px;">Score Distribution</div>
                <div id="stu-score-histogram" style="width:100%;height:180px;display:none;"></div>
              </div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 5 · MAP PE DOMAINS — collapsible                       -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-pe-domain-card" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById('stu-mod-domains-body');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('.stu-mod-toggle').textContent=open?'▶':'▼';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#059669;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · <span data-tip="Multidimensional Adherence Parameters — measures Architecture, Execution, and Context domains">MAP</span> · Predictive Emergence</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">AEC Domain Scores</div>
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--dim);font-style:italic;margin-right:8px;">Cohort averages</div>
              <div class="stu-mod-toggle" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);">▼</div>
            </button>
            <div id="stu-mod-domains-body" style="padding:4px 20px 18px;border-top:1px solid var(--border);">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;margin-top:14px;">
                <div style="background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.18);border-top:2px solid #d4a843;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Architecture</div>
                  <div id="stu-pe-arch-score" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#b45309;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--dim);margin-top:3px;">Intentional · Q2 Q3 Q6</div>
                </div>
                <div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.15);border-top:2px solid #2563eb;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;margin-bottom:4px;">Execution</div>
                  <div id="stu-pe-exec-score" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#2563eb;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--dim);margin-top:3px;">Behavioral · Q1 Q4 Q5 Q8</div>
                </div>
                <div style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.15);border-top:2px solid #7c3aed;border-radius:9px;padding:13px 15px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:#7c3aed;margin-bottom:4px;">Context</div>
                  <div id="stu-pe-ctx-score" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#7c3aed;line-height:1;">—</div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--dim);margin-top:3px;">Perceived burden · Q7</div>
                </div>
              </div>
              <div id="stu-pe-constraint-label" style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);margin-bottom:4px;"></div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.54rem;color:var(--dim);">Per-patient targeting and APE phenotyping available in Researcher tier.</div>
              <div id="stu-domain-radar-wrap" style="margin-top:12px;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#607898;margin-bottom:4px;">Domain Radar · MAP</div>
                <div id="stu-domain-radar" style="width:100%;height:200px;display:none;"></div>
              </div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 6 · AT-RISK PATIENTS — collapsible                     -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-sentinel-panel" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById('stu-mod-atrisk-body');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('.stu-mod-toggle').textContent=open?'▶':'▼';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#dc2626;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Needs Attention</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">At-Risk Patients</div>
              </div>
              <div id="stu-sentinel-count-badge" style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);color:#dc2626;border-radius:20px;padding:2px 10px;display:none;margin-right:6px;"></div>
              <div class="stu-mod-toggle" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);">▼</div>
            </button>
            <div id="stu-mod-atrisk-body" style="padding:4px 20px 18px;border-top:1px solid var(--border);">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--dim);margin-bottom:10px;margin-top:10px;">Score ≤ 4 — intentional non-adherence pattern priority</div>
              <div id="stu-sentinel-body">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--dim);padding:8px 0;">No high-risk records detected.</div>
              </div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 7 · SUBMITTED RECORDS — collapsible                    -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-records" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById('stu-mod-records-body');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('.stu-mod-toggle').textContent=open?'▶':'▼';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#475569;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Data Management</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Submitted Records</div>
              </div>
              <div class="stu-mod-toggle" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);">▼</div>
            </button>
            <div id="stu-mod-records-body" style="padding:4px 20px 18px;border-top:1px solid var(--border);">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:14px;margin-bottom:12px;">
                <button id="stu-export-mmas-btn" onclick="_stuExportMMAS()" class="stu-export-btn-map">↓ MAP CSV</button>
                <button id="stu-export-peacs-btn" onclick="_stuExportPEACS()" class="stu-export-btn-peacs">↓ PEACS CSV</button>
              </div>
              <div id="stu-review-table" style="font-size:0.80rem;color:var(--muted);">Loading records…</div>
              <div style="margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:0.56rem;color:var(--dim);">Student tier · up to 100 records / mo</div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 8 · PSYCHOMETRIC VALIDATION — collapsible, CLOSED      -->
          <!-- Live Cronbach α, item-total correlations, convergent validity  -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-validation" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById('stu-mod-validation-body');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('.stu-mod-toggle').textContent=open?'▶':'▼';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#475569;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Psychometrics</div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Validation &amp; Reliability</div>
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--dim);margin-right:8px;">Cronbach α · Item correlations · Convergent validity</div>
              <div class="stu-mod-toggle" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-validation-body" style="display:none;border-top:1px solid var(--border);">

              <!-- placeholder shown when cohort is too small -->
              <div id="stu-val-placeholder" style="padding:20px 24px;text-align:center;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--dim);line-height:1.9;">Collect ≥ 10 MAP assessments to unlock psychometric statistics.<br>Results auto-update as your cohort grows.</div>
              </div>

              <!-- main validation panel — shown when N≥10 -->
              <div id="stu-validation-panel" style="display:none;padding:20px 24px;">

                <!-- Row 1: Cronbach α + Domain reliability -->
                <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:12px;margin-bottom:20px;align-items:start;">

                  <!-- Overall α -->
                  <div style="background:var(--card2);border:1px solid var(--border);border-top:3px solid #475569;border-radius:9px;padding:14px 20px;text-align:center;min-width:100px;">
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Cronbach α · MAP</div>
                    <div id="stu-val-alpha" style="font-family:'IBM Plex Mono',monospace;font-size:2.2rem;font-weight:700;color:var(--bright);line-height:1;letter-spacing:-0.03em;">—</div>
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--dim);margin-top:4px;">8 items · N=<span id="stu-val-map-n">—</span></div>
                  </div>

                  <!-- Architecture domain -->
                  <div style="background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.15);border-top:3px solid #d4a843;border-radius:9px;padding:14px 16px;">
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:#b45309;margin-bottom:8px;">Architecture · Q2 Q3 Q6</div>
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
                      <span id="stu-val-arch-val" style="font-family:'IBM Plex Mono',monospace;font-size:1.5rem;font-weight:700;color:#d4a843;line-height:1;">—</span>
                      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#b45309;">avg domain score</span>
                    </div>
                    <div style="height:5px;background:rgba(212,168,67,0.12);border-radius:3px;overflow:hidden;">
                      <div id="stu-val-arch-bar" style="height:100%;width:0%;background:#d4a843;border-radius:3px;transition:width 0.6s;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;color:var(--dim);">α=</span>
                      <span id="stu-val-alpha-arch" style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#b45309;font-weight:700;">—</span>
                    </div>
                  </div>

                  <!-- Execution domain -->
                  <div style="background:rgba(37,99,235,0.07);border:1px solid rgba(78,156,245,0.15);border-top:3px solid #4e9cf5;border-radius:9px;padding:14px 16px;">
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">Execution · Q1 Q4 Q5 Q8</div>
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
                      <span id="stu-val-exec-val" style="font-family:'IBM Plex Mono',monospace;font-size:1.5rem;font-weight:700;color:#4e9cf5;line-height:1;">—</span>
                      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#2563eb;">avg domain score</span>
                    </div>
                    <div style="height:5px;background:rgba(78,156,245,0.12);border-radius:3px;overflow:hidden;">
                      <div id="stu-val-exec-bar" style="height:100%;width:0%;background:#4e9cf5;border-radius:3px;transition:width 0.6s;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;">
                      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;color:var(--dim);">α=</span>
                      <span id="stu-val-alpha-exec" style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#2563eb;font-weight:700;">—</span>
                    </div>
                  </div>
                </div>

                <!-- Row 2: Item-total correlations -->
                <div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:14px 16px;margin-bottom:16px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Corrected Item-Total Correlations (r<sub>it</sub>)</div>
                  <div style="display:flex;flex-direction:column;gap:5px;" id="stu-val-itc-grid">
                    <!-- Q1–Q8 rows injected by _updateStudentValidationPanel() -->
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--dim);">Populating…</div>
                  </div>
                </div>

                <!-- Row 3: Convergent validity (paired MAP + MMAS-8) -->
                <div style="background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.12);border-radius:9px;padding:14px 16px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:#059669;margin-bottom:12px;">Convergent Validity · MAP vs MMAS-8 · N=<span id="stu-val-mmas-n">—</span> MMAS · <span id="stu-val-paired-n">—</span> matched pairs</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    <div style="text-align:center;">
                      <div id="stu-val-r" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>
                      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">Pearson r</div>
                    </div>
                    <div style="text-align:center;">
                      <div id="stu-val-agree-pct" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>
                      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">Pattern agreement</div>
                    </div>
                    <div style="text-align:center;">
                      <div id="stu-val-extra-pct" style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:700;color:#d97706;line-height:1;">—</div>
                      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">MAP detects extra non-adh</div>
                    </div>
                  </div>
                  <div id="stu-val-ctx-val" style="display:none;"></div><!-- preserved for JS compat -->
                  <div id="stu-val-ctx-bar" style="display:none;"></div><!-- preserved for JS compat -->
                  <div style="margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:0.56rem;color:var(--dim);line-height:1.7;">Requires same patient_number collected on both MAP and MMAS-8. Pearson r = convergent validity coefficient. Pattern agreement = % patients classified identically by both instruments.</div>
                </div>

                <!-- Export bundle -->
                <div style="margin-top:12px;text-align:right;">
                  <button onclick="_stuExportValidationBundle()" style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:7px;padding:6px 14px;cursor:pointer;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">↓ Export Paired Validation Dataset</button>
                </div>

              </div><!-- /stu-validation-panel -->
            </div><!-- /stu-mod-validation-body -->
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 9 · THESIS EXPORT — instrument-tabbed citation/results  -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-thesis" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-thesis-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#0891b2;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Publication Ready</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Thesis Export</div>
              </div>
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:#0891b2;background:rgba(8,145,178,0.07);border:1px solid rgba(8,145,178,0.18);border-radius:20px;padding:2px 10px;margin-right:8px;">Citations · Methods · Results</div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-thesis-body" style="display:none;border-top:1px solid var(--border);">

              <!-- Thesis Mode control bar -->
              <div style="padding:8px 16px;background:#fafafa;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;align-items:center;gap:10px;">
                <button id="stu-thesis-mode-btn" onclick="stuToggleThesisMode()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:6px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.18s;">○ Thesis Mode</button>
                <span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--dim);">Plain-language interpretation of your results</span>
              </div>

              <!-- Instrument tab bar -->
              <div style="display:flex;border-bottom:1px solid rgba(0,0,0,0.07);background:var(--card2);padding:0 20px;gap:0;overflow-x:auto;">
                <button class="stu-thesis-tab" data-tab="map"      onclick="stuSwitchThesisTab(\'map\')"      style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;background:none;border:none;border-bottom:2px solid #059669;color:#059669;padding:10px 18px;cursor:pointer;white-space:nowrap;transition:all 0.18s;margin-bottom:-1px;">MAP</button>
                <button class="stu-thesis-tab" data-tab="mmas"     onclick="stuSwitchThesisTab(\'mmas\')"     style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;background:none;border:none;border-bottom:2px solid transparent;color:var(--dim);padding:10px 18px;cursor:pointer;white-space:nowrap;transition:all 0.18s;margin-bottom:-1px;">MMAS-8</button>
                <button class="stu-thesis-tab" data-tab="peacs"    onclick="stuSwitchThesisTab(\'peacs\')"    style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;background:none;border:none;border-bottom:2px solid transparent;color:var(--dim);padding:10px 18px;cursor:pointer;white-space:nowrap;transition:all 0.18s;margin-bottom:-1px;">PEACS</button>
                <button class="stu-thesis-tab" data-tab="combined" onclick="stuSwitchThesisTab(\'combined\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;background:none;border:none;border-bottom:2px solid transparent;color:var(--dim);padding:10px 18px;cursor:pointer;white-space:nowrap;transition:all 0.18s;margin-bottom:-1px;">Combined</button>
              </div>

              <!-- ── MAP pane ── -->
              <div id="stu-thesis-pane-map" class="stu-thesis-pane" style="padding:18px 20px 22px;">
                <div id="stu-thesis-thesis-mode-banner" style="display:none;background:rgba(212,168,67,0.08);border:1px solid rgba(245,158,11,0.28);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:#92400e;line-height:1.7;"></div>
                <!-- Citation -->
                <div style="margin-bottom:18px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">Citation</div>
                    <div style="display:flex;gap:4px;">
                      <button class="stu-cite-fmt-btn" data-inst="map" data-fmt="apa"       onclick="stuSelectCiteFmt(\'map\',\'apa\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:#0891b2;color:#fff;border:1px solid #0891b2;cursor:pointer;">APA 7th</button>
                      <button class="stu-cite-fmt-btn" data-inst="map" data-fmt="vancouver" onclick="stuSelectCiteFmt(\'map\',\'vancouver\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">Vancouver</button>
                      <button class="stu-cite-fmt-btn" data-inst="map" data-fmt="ama"       onclick="stuSelectCiteFmt(\'map\',\'ama\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">AMA</button>
                    </div>
                  </div>
                  <div id="stu-thesis-cite-map" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;min-height:60px;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;gap:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-cite-map\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;transition:all 0.15s;">Copy</button>
                  </div>
                </div>
                <!-- Methods -->
                <div style="margin-bottom:18px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Methods paragraph</div>
                  <div id="stu-thesis-methods-map" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-methods-map\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;transition:all 0.15s;">Copy</button>
                  </div>
                </div>
                <!-- Results -->
                <div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">Results paragraph <span id="stu-thesis-results-map-n" style="color:#0891b2;"></span></div>
                    <button onclick="stuRefreshThesisResults()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;background:none;border:none;color:var(--dim);cursor:pointer;padding:0 2px;" title="Refresh with latest data">↺ Refresh</button>
                  </div>
                  <div id="stu-thesis-results-map" style="background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.15);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-results-map\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.22);color:#059669;border-radius:5px;padding:4px 10px;cursor:pointer;transition:all 0.15s;">Copy</button>
                  </div>
                </div>
              </div>

              <!-- ── MMAS-8 pane ── -->
              <div id="stu-thesis-pane-mmas" class="stu-thesis-pane" style="display:none;padding:18px 20px 22px;">
                <!-- Citation -->
                <div style="margin-bottom:18px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">Citation</div>
                    <div style="display:flex;gap:4px;">
                      <button class="stu-cite-fmt-btn" data-inst="mmas" data-fmt="apa"       onclick="stuSelectCiteFmt(\'mmas\',\'apa\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:#2563eb;color:#fff;border:1px solid #2563eb;cursor:pointer;">APA 7th</button>
                      <button class="stu-cite-fmt-btn" data-inst="mmas" data-fmt="vancouver" onclick="stuSelectCiteFmt(\'mmas\',\'vancouver\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">Vancouver</button>
                      <button class="stu-cite-fmt-btn" data-inst="mmas" data-fmt="ama"       onclick="stuSelectCiteFmt(\'mmas\',\'ama\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">AMA</button>
                    </div>
                  </div>
                  <div id="stu-thesis-cite-mmas" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;min-height:60px;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-cite-mmas\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <!-- Methods -->
                <div style="margin-bottom:18px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Methods paragraph</div>
                  <div id="stu-thesis-methods-mmas" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-methods-mmas\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <!-- Results -->
                <div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">Results paragraph <span id="stu-thesis-results-mmas-n" style="color:#2563eb;"></span></div>
                    <button onclick="stuRefreshThesisResults()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;background:none;border:none;color:var(--dim);cursor:pointer;padding:0 2px;">↺ Refresh</button>
                  </div>
                  <div id="stu-thesis-results-mmas" style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.15);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-results-mmas\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.22);color:#2563eb;border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
              </div>

              <!-- ── PEACS pane ── -->
              <div id="stu-thesis-pane-peacs" class="stu-thesis-pane" style="display:none;padding:18px 20px 22px;">
                <div style="margin-bottom:18px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">Citation</div>
                    <div style="display:flex;gap:4px;">
                      <button class="stu-cite-fmt-btn" data-inst="peacs" data-fmt="apa"       onclick="stuSelectCiteFmt(\'peacs\',\'apa\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:#7c3aed;color:#fff;border:1px solid #7c3aed;cursor:pointer;">APA 7th</button>
                      <button class="stu-cite-fmt-btn" data-inst="peacs" data-fmt="vancouver" onclick="stuSelectCiteFmt(\'peacs\',\'vancouver\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">Vancouver</button>
                      <button class="stu-cite-fmt-btn" data-inst="peacs" data-fmt="ama"       onclick="stuSelectCiteFmt(\'peacs\',\'ama\')"       style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;padding:3px 8px;border-radius:4px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;">AMA</button>
                    </div>
                  </div>
                  <div id="stu-thesis-cite-peacs" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;min-height:60px;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-cite-peacs\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <div style="margin-bottom:18px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Methods paragraph</div>
                  <div id="stu-thesis-methods-peacs" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-methods-peacs\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Results paragraph <span id="stu-thesis-results-peacs-n" style="color:#7c3aed;"></span></div>
                  <div id="stu-thesis-results-peacs" style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.15);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-results-peacs\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.22);color:#7c3aed;border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
              </div>

              <!-- ── Combined pane ── -->
              <div id="stu-thesis-pane-combined" class="stu-thesis-pane" style="display:none;padding:18px 20px 22px;">
                <div style="background:rgba(212,168,67,0.08);border:1px solid rgba(245,158,11,0.22);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;color:#92400e;line-height:1.7;">Instruments detected in your cohort are auto-highlighted below. Edit the combined paragraph before copying.</div>
                <div style="margin-bottom:18px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Combined Methods</div>
                  <div id="stu-thesis-methods-combined" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-methods-combined\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <div style="margin-bottom:18px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Combined Results</div>
                  <div id="stu-thesis-results-combined" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-results-combined\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <!-- IRB Language -->
                <div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">IRB / Ethics Statement</div>
                  <div id="stu-thesis-irb" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--bright);line-height:1.8;white-space:pre-wrap;word-break:break-word;"></div>
                  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                    <button onclick="stuCopyBlock(\'stu-thesis-irb\',this)" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;padding:4px 10px;cursor:pointer;">Copy</button>
                  </div>
                </div>
                <!-- S4: Generate Appendix PDF -->
                <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;">
                  <button class="stu-appendix-btn" onclick="stuGenerateAppendixPDF()" title="Generate IRB-ready thesis appendix">
                    Generate Appendix PDF
                  </button>
                </div>
              </div>


            </div><!-- /stu-mod-thesis-body -->
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 10 · SAMPLE SIZE ADVISOR — power analysis for alpha CI  -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-power" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-power-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#dc2626;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Statistical Power</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Sample Size Advisor</div>
              </div>
              <div id="stu-power-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-power-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">

              <!-- Current stats strip -->
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #475569;border-radius:9px;padding:13px 15px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">Current N</div>
                  <div id="stu-power-n" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.8rem;font-weight:700;color:var(--bright);line-height:1;">—</div>
                </div>
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #059669;border-radius:9px;padding:13px 15px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">Cronbach α</div>
                  <div id="stu-power-alpha" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.8rem;font-weight:700;color:#059669;line-height:1;">—</div>
                </div>
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #dc2626;border-radius:9px;padding:13px 15px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">95% CI Lower</div>
                  <div id="stu-power-ci-lower" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.8rem;font-weight:700;color:#dc2626;line-height:1;">—</div>
                </div>
              </div>

              <!-- Target selector -->
              <div style="margin-bottom:16px;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Target CI lower bound (publication floor)</div>
                <div style="display:flex;gap:6px;">
                  <button class="stu-power-target-btn" data-target="0.70" onclick="stuRunPowerAdvisor(0.70)" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:7px;border-radius:6px;background:var(--card2);border:1px solid var(--border2);color:var(--muted);cursor:pointer;transition:all 0.15s;">α CI ≥ 0.70<br><span style="font-size:0.52rem;color:var(--dim);">Acceptable</span></button>
                  <button class="stu-power-target-btn" data-target="0.75" onclick="stuRunPowerAdvisor(0.75)" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:7px;border-radius:6px;background:var(--card2);border:1px solid var(--border2);color:var(--muted);cursor:pointer;transition:all 0.15s;">α CI ≥ 0.75<br><span style="font-size:0.52rem;color:var(--dim);">Good</span></button>
                  <button class="stu-power-target-btn" data-target="0.80" onclick="stuRunPowerAdvisor(0.80)" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:7px;border-radius:6px;background:#059669;border:1px solid #059669;color:#fff;cursor:pointer;transition:all 0.15s;">α CI ≥ 0.80<br><span style="font-size:0.52rem;color:rgba(255,255,255,0.7);">Publication ready</span></button>
                  <button class="stu-power-target-btn" data-target="0.85" onclick="stuRunPowerAdvisor(0.85)" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:7px;border-radius:6px;background:var(--card2);border:1px solid var(--border2);color:var(--muted);cursor:pointer;transition:all 0.15s;">α CI ≥ 0.85<br><span style="font-size:0.52rem;color:var(--dim);">Excellent</span></button>
                </div>
              </div>

              <!-- Result sentence -->
              <div id="stu-power-result" style="background:#fff7ed;border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:14px 16px;font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:#92400e;line-height:1.8;display:none;">
                <div id="stu-power-sentence" style="font-weight:700;margin-bottom:6px;"></div>
                <div id="stu-power-detail" style="font-size:0.64rem;color:#b45309;"></div>
              </div>

              <!-- Progress bar toward target N -->
              <div id="stu-power-progress-wrap" style="display:none;margin-top:14px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--dim);">Progress toward target N</span>
                  <span id="stu-power-pct" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:var(--muted);font-weight:700;"></span>
                </div>
                <div style="height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;">
                  <div id="stu-power-bar" style="height:100%;background:#059669;border-radius:3px;transition:width 0.6s;width:0%;"></div>
                </div>
              </div>

              <div style="margin-top:12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--dim);line-height:1.7;">Formula: SE(α) = √(2k(1−α)²/(N(k−1))) · Lower CI = α − 1.96·SE(α) · k = 8 items · Bonett (2002) approximation</div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 11 · PEACS DIMENSION TRACKER — patient × session grid   -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-peacs-tracker" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-peacs-tracker-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#7c3aed;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · <span data-tip="Patient Ecosystem Adherence Composite Score — 7-item cross-domain assessment">PEACS</span> Longitudinal</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;"><span data-tip="Patient Ecosystem Adherence Composite Score — 7-item cross-domain assessment">PEACS</span> Dimension Tracker</div>
              </div>
              <div id="stu-peacs-tracker-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.22);color:#7c3aed;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-peacs-tracker-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">

              <!-- Summary strip -->
              <div id="stu-peacs-tracker-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
                <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #94a3b8;border-radius:8px;padding:11px 13px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Total Patients</div>
                  <div id="stu-peacs-total" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:var(--bright);line-height:1;">—</div>
                </div>
                <div style="background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.14);border-top:2px solid #059669;border-radius:8px;padding:11px 13px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Complete (All 3)</div>
                  <div id="stu-peacs-complete" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>
                </div>
                <div style="background:rgba(212,168,67,0.08);border:1px solid rgba(245,158,11,0.18);border-top:2px solid #d97706;border-radius:8px;padding:11px 13px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">In Progress</div>
                  <div id="stu-peacs-partial" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#d97706;line-height:1;">—</div>
                </div>
                <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.14);border-top:2px solid #dc2626;border-radius:8px;padding:11px 13px;text-align:center;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;"><span data-tip="Behavioral Adherence Substrate Evaluation — habits and routine domain">BASE</span> Only</div>
                  <div id="stu-peacs-base-only" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#dc2626;line-height:1;">—</div>
                </div>
              </div>

              <!-- Patient grid -->
              <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                <div style="display:grid;grid-template-columns:2fr 90px 90px 90px 90px;gap:0;padding:8px 14px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02);">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Patient ID</div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:#b45309;text-align:center;"><span data-tip="Behavioral Adherence Substrate Evaluation — habits and routine domain">BASE</span></div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;text-align:center;"><span data-tip="Movement domain — physical and logistical adherence factors">MVMT</span></div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:#7c3aed;text-align:center;"><span data-tip="Stratification domain — mindset and motivation factors">STRATA</span></div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);text-align:center;">Status</div>
                </div>
                <div id="stu-peacs-grid-body" style="max-height:320px;overflow-y:auto;">
                  <div style="padding:20px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--dim);">No PEACS records yet.</div>
                </div>
              </div>

            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 12 · MY COHORT MAP — personal geo view of cohort data   -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-cohort-map" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="stuToggleCohortMap(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#0891b2;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Geospatial</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">My Cohort Map</div>
              </div>
              <div id="stu-cohort-map-count" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(8,145,178,0.07);border:1px solid rgba(8,145,178,0.18);color:#0891b2;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>
              <div id="stu-cohort-map-toggle-icon" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-cohort-map-body" style="display:none;border-top:1px solid var(--border);">
              <!-- Controls -->
              <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.05);flex-wrap:wrap;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;color:var(--dim);flex-shrink:0;">Show:</div>
                <button class="stu-map-filter-btn active" data-filter="all"   onclick="stuMapFilter(\'all\')"   style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:#0891b2;color:#fff;border:1px solid #0891b2;cursor:pointer;transition:all 0.15s;">All</button>
                <button class="stu-map-filter-btn"        data-filter="map"   onclick="stuMapFilter(\'map\')"   style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">MAP</button>
                <button class="stu-map-filter-btn"        data-filter="mmas"  onclick="stuMapFilter(\'mmas\')"  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">MMAS-8</button>
                <button class="stu-map-filter-btn"        data-filter="atrisk" onclick="stuMapFilter(\'atrisk\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">At Risk</button>
                <div style="margin-left:auto;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--dim);" id="stu-map-marker-count"></div>
              </div>
              <!-- Legend -->
              <div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(0,0,0,0.05);flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">High / Optimal</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Medium</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Low / At Risk</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#94a3b8;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">No coordinates</span></div>
              </div>
              <!-- Map container -->
              <div id="stu-cohort-mapbox" style="height:320px;border-radius:0;"></div>
              <!-- Fallback country list (shown when no coords) -->
              <div id="stu-cohort-map-fallback" style="display:none;padding:14px 16px;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Cohort by Country / Region</div>
                <div id="stu-cohort-country-list" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
              </div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 13 · STUDY REGISTRY — pre-registration + ATLAS ID    -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-registry" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-registry-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitRegistry===\'function\')stuInitRegistry();})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#059669;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Research</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Study Registry</div>
              </div>
              <div id="stu-registry-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.22);color:#059669;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-registry-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">
              <div id="stu-registry-content" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--dim);text-align:center;padding:14px 0;">Loading registry status…</div>
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────────────── -->
          <!-- MODULE 14 · PREDICTOR ANALYSIS — OLS regression               -->
          <!-- ────────────────────────────────────────────────────────────── -->
          <div id="stu-mod-predictor" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-predictor-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitPredictor===\'function\')stuInitPredictor();})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#d97706;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Statistics</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Predictor Analysis</div>
              </div>
              <div id="stu-predictor-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.22);color:#d97706;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-predictor-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">

              <!-- Gate: need ≥ 10 records -->
              <div id="stu-predictor-gate" style="display:none;background:rgba(217,119,6,0.07);border:1px solid rgba(217,119,6,0.22);border-radius:8px;padding:13px 16px;margin-bottom:14px;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;font-weight:700;color:#d97706;margin-bottom:3px;">Minimum Sample Required</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;color:var(--muted);">OLS regression requires at least 10 records. Collect more assessments to unlock this module.</div>
              </div>

              <!-- Controls panel -->
              <div id="stu-predictor-controls">
                <!-- Outcome selector -->
                <div style="margin-bottom:14px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Outcome Variable</div>
                  <div style="display:flex;gap:6px;">
                    <button id="stu-pred-out-mmas" class="stu-pred-out-btn" data-out="mmas" onclick="stuPredSelectOutcome(\'mmas\')" style="flex:1;padding:7px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;transition:all 0.15s;">MMAS-8 Score</button>
                    <button id="stu-pred-out-map" class="stu-pred-out-btn" data-out="map" onclick="stuPredSelectOutcome(\'map\')" style="flex:1;padding:7px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">MAP PE Score</button>
                  </div>
                </div>

                <!-- Predictor checkboxes -->
                <div style="margin-bottom:14px;">
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Predictor Variables</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                    <label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;">
                      <input type="checkbox" id="stu-pred-age" checked style="accent-color:#d97706;"> Age
                    </label>
                    <label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;">
                      <input type="checkbox" id="stu-pred-gender" checked style="accent-color:#d97706;"> Gender
                    </label>
                    <label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;">
                      <input type="checkbox" id="stu-pred-condition" checked style="accent-color:#d97706;"> Condition
                    </label>
                    <label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;">
                      <input type="checkbox" id="stu-pred-country" style="accent-color:#d97706;"> Country
                    </label>
                  </div>
                </div>

                <button onclick="stuRunPredictor()" style="width:100%;padding:9px;font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:#d97706;color:#fff;border:none;border-radius:7px;cursor:pointer;">Run Analysis</button>
              </div>

              <!-- Results area -->
              <div id="stu-predictor-results" style="display:none;margin-top:16px;">
                <div id="stu-predictor-table-wrap"></div>
                <div id="stu-predictor-apa" style="margin-top:12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:13px 15px;font-family:\'IBM Plex Mono\',monospace;font-size:0.67rem;color:var(--muted);line-height:1.7;white-space:pre-wrap;"></div>
                <button onclick="stuCopyPredictorAPA()" style="margin-top:8px;padding:6px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:6px;cursor:pointer;">Copy APA Paragraph</button>
              </div>

            </div>
          </div>

          <!-- MODULE · PSYCHOMETRIC ANALYSIS -->
          <div id="stu-mod-psycho" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;">
            <button onclick="(function(btn){var body=document.getElementById(\'stu-mod-psycho-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.stu-mod-toggle\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitPsychoStats===\'function\')stuInitPsychoStats();})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <div style="width:3px;height:14px;background:#b45309;border-radius:2px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Statistics</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Psychometric Analysis</div>
              </div>
              <div class="stu-mod-toggle" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>
            </button>
            <div id="stu-mod-psycho-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">

              <!-- Sub-nav -->
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">
                <button class="stu-psycho-sub-btn" data-sub="reliability"
                  onclick="stuPsychoSwitchSub(\'reliability\')"
                  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid rgba(180,83,9,0.38);background:rgba(180,83,9,0.08);color:#b45309;cursor:pointer;transition:all 0.15s;">Reliability</button>
                <button class="stu-psycho-sub-btn" data-sub="classification"
                  onclick="stuPsychoSwitchSub(\'classification\')"
                  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Classification</button>
                <button class="stu-psycho-sub-btn" data-sub="effectsize"
                  onclick="stuPsychoSwitchSub(\'effectsize\')"
                  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Effect Size</button>
                <button class="stu-psycho-sub-btn" data-sub="methods"
                  onclick="stuPsychoSwitchSub(\'methods\')"
                  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Methods</button>
              </div>

              <!-- Dynamic content -->
              <div id="stu-psycho-body" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);">
                Loading…
              </div>

            </div>
          </div><!-- /stu-mod-psycho -->

          <!-- STUDENT SETTINGS MODAL -->
          <dialog id="stu-settings-modal" style="background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:0;width:440px;max-width:92vw;box-shadow:0 8px 32px rgba(0,0,0,0.22);overflow:hidden;">
            <div style="padding:18px 22px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Student · Workspace</div>
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.88rem;font-weight:700;color:var(--bright);margin-top:2px;">Settings</div>
              </div>
              <button onclick="document.getElementById(\'stu-settings-modal\').close()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--dim);line-height:1;padding:4px 8px;">✕</button>
            </div>
            <div style="padding:18px 22px;max-height:72vh;overflow-y:auto;">
              <div style="margin-bottom:14px;">
                <label style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px;">Your Name (for citations)</label>
                <input id="stu-set-name" type="text" placeholder="e.g. Jane Smith" style="width:100%;padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:7px;outline:none;box-sizing:border-box;">
              </div>
              <div style="margin-bottom:14px;">
                <label style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px;">Institution / University</label>
                <input id="stu-set-institution" type="text" placeholder="e.g. University of Toronto" style="width:100%;padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:7px;outline:none;box-sizing:border-box;">
              </div>
              <div style="margin-bottom:14px;">
                <label style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px;">Study Title</label>
                <input id="stu-set-study-title" type="text" placeholder="e.g. Medication Adherence in Type 2 Diabetes" style="width:100%;padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:7px;outline:none;box-sizing:border-box;">
              </div>
              <div style="margin-bottom:18px;">
                <label style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px;">IRB / Ethics Approval Number</label>
                <input id="stu-set-irb" type="text" placeholder="e.g. IRB-2026-0042" style="width:100%;padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:var(--bright);background:var(--card2);border:1px solid var(--border2);border-radius:7px;outline:none;box-sizing:border-box;">
              </div>
              <div style="border-top:1px solid var(--border);margin-bottom:16px;"></div>
              <div style="margin-bottom:16px;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Default Citation Format</div>
                <div style="display:flex;gap:6px;">
                  <button class="stu-set-cite-btn" data-fmt="apa"       onclick="stuSettingsCiteSelect(\'apa\')"       style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--bright);color:var(--ink);transition:all 0.15s;">APA 7th</button>
                  <button class="stu-set-cite-btn" data-fmt="vancouver" onclick="stuSettingsCiteSelect(\'vancouver\')" style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--card2);color:var(--muted);transition:all 0.15s;">Vancouver</button>
                  <button class="stu-set-cite-btn" data-fmt="ama"       onclick="stuSettingsCiteSelect(\'ama\')"       style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--card2);color:var(--muted);transition:all 0.15s;">AMA</button>
                </div>
              </div>
              <div style="margin-bottom:18px;">
                <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Default Thesis Tab</div>
                <div style="display:flex;gap:6px;">
                  <button class="stu-set-inst-btn" data-inst="map"      onclick="stuSettingsInstSelect(\'map\')"      style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid #059669;cursor:pointer;background:#059669;color:#fff;transition:all 0.15s;">MAP</button>
                  <button class="stu-set-inst-btn" data-inst="mmas"     onclick="stuSettingsInstSelect(\'mmas\')"     style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--card2);color:var(--muted);transition:all 0.15s;">MMAS-8</button>
                  <button class="stu-set-inst-btn" data-inst="peacs"    onclick="stuSettingsInstSelect(\'peacs\')"    style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--card2);color:var(--muted);transition:all 0.15s;">PEACS</button>
                  <button class="stu-set-inst-btn" data-inst="combined" onclick="stuSettingsInstSelect(\'combined\')" style="flex:1;padding:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;border-radius:6px;border:1px solid var(--border2);cursor:pointer;background:var(--card2);color:var(--muted);transition:all 0.15s;">Combined</button>
                </div>
              </div>
              <div style="border-top:1px solid var(--border);margin-bottom:16px;"></div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);">Thesis Mode</div>
                  <div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);margin-top:2px;">Plain-language interpretation in all thesis sections</div>
                </div>
                <button id="stu-set-thesis-toggle" onclick="stuSettingsThesisModeToggle(this)" style="padding:6px 16px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;font-weight:700;border-radius:20px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;min-width:52px;transition:all 0.2s;">OFF</button>
              </div>
            </div>
            <div style="padding:12px 22px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;">
              <button onclick="document.getElementById(\'stu-settings-modal\').close()" style="padding:8px 18px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:7px;cursor:pointer;">Cancel</button>
              <button onclick="stuSaveSettings()" style="padding:8px 18px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--bright);border:none;color:var(--ink);border-radius:7px;cursor:pointer;">Save Settings</button>
            </div>
          </dialog>

          <!-- hidden stu-citation-block preserved for JS that populates it -->
          <div style="display:none;" aria-hidden="true">
            <div id="stu-citation-block"></div>
          </div>

        </div>
      `;

      // Insert panel after the workspace ribbon
      const _rib = document.getElementById('role-id-banner');
      if (_rib && _rib.parentNode === _db) {
        _rib.after(stPanel);
      } else {
        _db.insertBefore(stPanel, _db.firstChild);
      }

      // Resolve institution name for student header card — always run regardless of workspaceProfile
      database.ref('workspaces/' + currentWorkspace + '/parent_institution_name').once('value')
        .catch(() => null)
        .then(snap => {
          const _lsInst = (currentWorkspace && localStorage.getItem('atlas_inst_' + currentWorkspace)) || '';
          const _parentKey = (workspaceProfile && workspaceProfile.parent_institution) || '';
          const resolved = (snap && snap.val())
            || (workspaceProfile && workspaceProfile.institution)
            || _lsInst
            || '';
          const instEl = document.getElementById('stu-header-inst');
          // Helper to display the resolved name
          const _showInst = (name) => {
            if (instEl && name) { instEl.textContent = '🏛 ' + name; instEl.style.display = 'block'; }
          };
          if (resolved) {
            // We have a friendly name — show it immediately
            _showInst(resolved);
          } else if (_parentKey) {
            // All friendly-name sources empty — look up the institution's own workspace node
            database.ref('workspaces/' + _parentKey + '/name').once('value')
              .catch(() => null)
              .then(instSnap => {
                const instName = (instSnap && instSnap.val()) || _parentKey;
                _showInst(instName);
                // Cache the friendly name so future loads skip this lookup
                if (instSnap && instSnap.val() && currentWorkspace) {
                  localStorage.setItem('atlas_inst_' + currentWorkspace, instSnap.val());
                }
              });
          }
        });

      // All 4 required citations
      const stuCite = document.getElementById('stu-citation-block');
      if (stuCite) {
        stuCite.textContent = [
          '[1] MMAS-8\nKrousel-Wood, M., Islam, T., Webber, L.S., Re, R.N., Morisky, D.E., & Muntner, P. (2009). New medication adherence scale versus pharmacy fill rates in seniors with hypertension. American Journal of Managed Care, 15(1), 59–66. PMID: 19146365; PMCID: PMC2728593.',
          '',
          '[2] TPE · Theory of Predictive Emergence\nMorisky, P. (2026). The Theory of Predictive Emergence: A Geometric Framework for Behavioral Stability. Zenodo. https://doi.org/10.5281/zenodo.18209699',
          '',
          '[3] ATLAS Platform\nAdherence Cartography. (2026). ATLAS: Adherence Tracking & Longitudinal Assessment System, v8. Cloud-based platform for population-level medication adherence surveillance. https://atlas.adherence.cc',
          '',
          '[4] PEACS · Predictive Emergence Assessment for Clinical Services\nAdherence Cartography. (2026). PEACS: Predictive Emergence Assessment for Clinical Services — instrument development, validation, and clinical utility. Adherence Cartography. https://atlas.adherence.cc',
        ].join('\n');
      }
      // ── Student module gates (post-render) ─────────────────────────────────
      // Only render what the user is entitled to. No locked cards — just hide.
      // Collect gated panel modules to render a single "Expand" card at the end.
      const _stuLockedMods = [];
      const _stuGate = (id, moduleId, isPanel) => {
        const el = document.getElementById(id);
        if (el && !hasModule(moduleId)) {
          el.style.display = 'none';
          if (isPanel && _MODULE_LOCK_META[moduleId] && !_stuLockedMods.includes(moduleId))
            _stuLockedMods.push(moduleId);
        }
      };
      // Panel gates (isPanel = true → tracked for Expand card)
      _stuGate('stu-mod-power',         'analytics_power',        true);
      _stuGate('stu-mod-peacs-tracker', 'analytics_peacs',        true);
      _stuGate('stu-mod-cohort-map',    'analytics_geospatial',   true);
      _stuGate('stu-mod-validation',    'analytics_psychometrics', true);
      // Button/export gates (not tracked for Expand card)
      _stuGate('stu-export-mmas-btn',   'export_csv',  false);
      _stuGate('stu-export-peacs-btn',  'export_csv',  false);
      _stuGate('stu-sess-peacs',        'assess_peacs',false);
      // Import is always available in the session strip — all roles need to upload records

      // ── Expand Workspace card — only appears if any panels are gated ───────
      if (_stuLockedMods.length > 0) {
        const _expandCard = document.createElement('div');
        _expandCard.id = 'stu-mod-expand';
        _expandCard.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;';
        _expandCard.innerHTML = `
          <div style="padding:14px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
            <div style="width:3px;height:14px;background:var(--border2);border-radius:2px;flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Add-on Modules · Request Access</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Expand Your Workspace</div>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--dim);background:var(--card2);border:1px solid var(--border2);border-radius:20px;padding:2px 10px;">${_stuLockedMods.length} available</div>
          </div>
          <div style="padding:14px 18px 16px;">
            <div id="stu-expand-tiles" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px;">
              ${_stuLockedMods.map(m => {
                const meta = _MODULE_LOCK_META[m];
                return `<div style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--text);">${meta.icon} ${meta.label}${meta.premium ? ' <span style="font-size:0.60rem;color:var(--pe);margin-left:4px;">✦ Premium</span>' : ''}</div>
                  <div style="font-size:0.72rem;color:var(--dim);line-height:1.5;flex:1;">${meta.desc}</div>
                  <button id="stu-req-btn-${m}" onclick="window._stuRequestModule('${m}','${meta.label||''}')"
                    style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.10em;text-transform:uppercase;
                    padding:5px 10px;border-radius:5px;cursor:pointer;border:1px solid var(--border2);
                    background:transparent;color:var(--muted);width:100%;text-align:center;transition:all 0.15s;">
                    → Request Access
                  </button>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        const _flexWrap = document.querySelector('#student-dash-panel > div');
        if (_flexWrap) _flexWrap.appendChild(_expandCard);

        // Pre-mark modules already requested
        if (currentWorkspace && database) {
          database.ref('workspaces/' + currentWorkspace + '/access_requests').once('value').then(snap => {
            const reqs = snap.val() || {};
            _stuLockedMods.forEach(m => {
              const btn = document.getElementById('stu-req-btn-' + m);
              if (!btn) return;
              const s = (reqs[m] || {}).status;
              if (s === 'pending') {
                btn.textContent = '✓ Requested';
                btn.style.color = 'var(--muted)';
                btn.style.opacity = '0.6';
                btn.disabled = true;
              } else if (s === 'granted') {
                btn.textContent = '✓ Granted — Reload';
                btn.style.color = 'var(--green)';
                btn.style.borderColor = 'var(--green)';
                btn.disabled = true;
              } else if (s === 'dismissed') {
                btn.textContent = '✗ Dismissed';
                btn.style.color = 'var(--dim)';
                btn.style.opacity = '0.5';
                btn.disabled = true;
              }
            });
          }).catch(() => {});
        }
      }

      // ── Module request handler ────────────────────────────────────────────────
      window._stuRequestModule = function(moduleId, label) {
        const btn = document.getElementById('stu-req-btn-' + moduleId);
        if (!btn || btn.disabled) return;
        if (!currentWorkspace || !database) return;
        const reqRef = database.ref('workspaces/' + currentWorkspace + '/access_requests/' + moduleId);
        reqRef.once('value').then(snap => {
          if (snap.exists() && snap.val().status === 'pending') {
            if (btn) { btn.textContent = '✓ Requested'; btn.disabled = true; }
            return;
          }
          const payload = {
            requested_at: Date.now(),
            status: 'pending',
            module_id: moduleId,
            module_label: label,
            workspace_key: currentWorkspace,
            role: (workspaceProfile && workspaceProfile.role) || 'student',
            name: (workspaceProfile && workspaceProfile.name) || '',
            parent_pi: (workspaceProfile && workspaceProfile.parent_pi) || '',
            parent_institution: (workspaceProfile && workspaceProfile.parent_institution) || '',
          };
          return reqRef.set(payload).then(() => {
            if (btn) {
              btn.textContent = '✓ Requested';
              btn.style.color = 'var(--muted)';
              btn.style.opacity = '0.6';
              btn.disabled = true;
            }
            atlasAuditLog('module_access_requested', { workspace: currentWorkspace, module: moduleId });
          });
        }).catch(err => {
          console.warn('Request failed:', err);
          if (btn) btn.textContent = '! Error — Retry';
        });
      };

      // Pull live session stats from loaded records
      _updateStudentSessionStats();

      // ── ATLAS TAB RAIL — student workspace ─────────────────────────────
      // headerId: 'stu-mod-header' is nested inside student-dash-panel;
      // the rail engine hoists it to dash-body level automatically.
      var STU_RAIL_TABS = [
        { id: 'cohort',    icon: '⌂', label: 'Cohort',
          elements: ['stu-session-strip', 'stu-mod-snapshot'] },
        { id: 'analysis',  icon: '∿', label: 'Analysis',
          elements: ['stu-mod-patterns', 'stu-pe-domain-card'] },
        { id: 'records',   icon: '≡', label: 'Records',
          elements: ['stu-mod-records', 'stu-mod-peacs-tracker', 'stu-mod-cohort-map'] },
        { id: 'writing',   icon: '✦', label: 'Writing',
          elements: ['stu-mod-thesis', 'stu-mod-validation'] },
        { id: 'tools',     icon: '◇', label: 'Tools',
          elements: ['stu-mod-power', 'stu-mod-registry', 'stu-mod-predictor', 'stu-mod-psycho', 'stu-mod-expand'] },
      ];
      setTimeout(function() {
        if (typeof window._atlasInstallRail === 'function') {
          window._atlasInstallRail(STU_RAIL_TABS, '#2ec98a', { headerId: 'stu-mod-header' });
        }
      }, 800);
    }
  }

  // ── Clinician dashboard ───────────────────────────────────────────────────
  if (showRpp && isClinician()) {
    const _db = document.querySelector('#screen-dashboard .dash-body');
    if (_db) {
      // Hide all researcher/analytics panels — clinician has its own purpose-built workspace
      [
        'session-launcher-panel',  // researcher session launcher
        'res-analytics-panel',     // researcher Track A/B/C analytics
        'researcher-patient-panel',// researcher RPP "Active Patients · Your Cohort" panel
        // 'cpo-panel' intentionally omitted — shown for all clinician roles (no module gate)
        'dash-spectator-btn',      // global map spectator — not a clinical tool
        'dash-researcher-action-bar', // researcher bulk import / QR bar
      ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      // Also hide the Track A/B/C records panel — clinicians use the worklist, not raw records
      const _mcRec = document.querySelector('.mc-records-panel');
      if (_mcRec) _mcRec.style.display = 'none';
      // Collapse instrument launch cards — clinician starts assessment from a single button
      ['dash-launch-map','dash-launch-peacs','dash-launch-mmas'].forEach(id => {
        const c = document.getElementById(id);
        if (c) c.style.display = 'none';
      });

      // Show the static clinician panel
      const clinPanel = document.getElementById('clinician-dash-panel');
      if (clinPanel) {
        clinPanel.style.display = '';

        // Populate header
        const nameEl  = document.getElementById('clin-header-name');
        const instEl  = document.getElementById('clin-header-inst');
        if (nameEl) nameEl.textContent = (workspaceProfile && workspaceProfile.name) || (workspaceProfile && workspaceProfile.workspace_key) || '—';
        if (instEl) {
          const _clinParentInst = workspaceProfile && workspaceProfile.parent_institution;
          if (_clinParentInst) {
            instEl.textContent = '🏛 …';
            instEl.style.display = 'block';
            database.ref('workspaces/' + currentWorkspace + '/parent_institution_name').once('value')
              .catch(() => null)
              .then(function(snap) {
                const resolved = (snap && snap.val()) || (workspaceProfile && workspaceProfile.institution) || _clinParentInst;
                instEl.textContent = '🏛 ' + resolved;
              });
          } else if (workspaceProfile && workspaceProfile.institution) {
            instEl.textContent = '🏛 ' + workspaceProfile.institution;
            instEl.style.display = 'block';
          }
        }

        // Default instrument
        window._clinDefaultInstrument = localStorage.getItem('clin_default_instrument') || 'map';
        if (typeof setClinDefaultInstrument === 'function') setClinDefaultInstrument(window._clinDefaultInstrument);

        // Wire custom tooltips on instrument buttons — replaces `title` attr which gets
        // clipped inside the rail's overflow:hidden container in some browsers.
        if (typeof atlasTip === 'function') {
          var _instTips = {
            map:   'MAP · Multidimensional Adherence Parameters\n8 behavioural dimensions · AEC tri-domain scoring\nAdditive + PE composite score',
            mmas:  'MMAS-8 · Morisky Medication Adherence Scale\n8-question validated instrument · 0–8 scale\nINA / UNA pattern classification',
            peacs: 'PEACS · Predictive Emergence Assessment\nStaged over a quarter · 3 dimension sessions\nArchitecture · Execution · Context domains',
          };
          Object.keys(_instTips).forEach(function(inst) {
            var btn = document.querySelector('.clin-inst-btn[data-inst="' + inst + '"]');
            if (btn) atlasTip(btn, _instTips[inst]);
          });
        }

        // Gate clinician tabs by module entitlement — hides tabs the workspace hasn't enabled
        const _tBilling  = document.querySelector('.clin-tab[data-clin-tab="billing"]');
        const _tCareGaps = document.querySelector('.clin-tab[data-clin-tab="caregaps"]');
        const _tSdoh     = document.querySelector('.clin-tab[data-clin-tab="sdoh"]');
        if (_tBilling)  _tBilling.style.display  = hasModule('clinical_billing')   ? '' : 'none';
        if (_tCareGaps) _tCareGaps.style.display = hasModule('clinical_care_gaps') ? '' : 'none';
        if (_tSdoh)     _tSdoh.style.display     = hasModule('analytics_sdoh')     ? '' : 'none';

        // Hide mc-instrument-row for clinicians (same as PI mode)
        const mcRowClin = document.querySelector('.mc-instrument-row');
        if (mcRowClin) mcRowClin.style.display = 'none';

        // Init worklist after data loads
        setTimeout(function() {
          if (typeof renderClinWorklist === 'function') renderClinWorklist();
          if (typeof updateClinKPIs === 'function') updateClinKPIs();
          if (typeof updateClinReport === 'function') updateClinReport();
          // If returning from MAP assessment, force data refresh and open Patients tab
          if (window._mapReturnRefresh) {
            window._mapReturnRefresh = false;
            if (typeof loadMmasCohortData === 'function') loadMmasCohortData();
            // Second load 3s later catches any record whose Firebase write was
            // still in-flight when the initial loadMmasCohortData ran.
            setTimeout(function() {
              if (typeof loadMmasCohortData === 'function') loadMmasCohortData();
              if (typeof switchClinTab === 'function') switchClinTab('session');
            }, 3000);
          }
        }, 600);
      }

      // Wire up clin-search to also sync with the hidden rpp controls
      // so rppFilter() continues to work
      const clinSearch = document.getElementById('clin-search');
      const rppSearch  = document.getElementById('rpp-search');
      if (clinSearch && rppSearch) {
        clinSearch.addEventListener('input', function() { rppSearch.value = this.value; rppFilter(); });
      }

      // ── ATLAS TAB RAIL — clinician workspace ─────────────────────────────
      // role-id-banner is the pinned header (shows clinician name + role chip).
      // clinician-dash-panel holds the full worklist + internal tab system.
      // MTM panels live separately in dash-body and move into the MTM tab.
      var CLIN_RAIL_TABS = [
        { id: 'patients', icon: '⊕', label: 'Patients',
          elements: ['clinician-dash-panel'] },
        { id: 'mtm',      icon: '⏱', label: 'MTM',
          elements: ['daily-intake-panel', 'mtm-timer-panel', 'mtm-audit-panel'] },
        { id: 'overview', icon: '◈', label: 'Overview',
          elements: ['cpo-panel'] },
      ];
      setTimeout(function() {
        if (typeof window._atlasInstallRail === 'function') {
          window._atlasInstallRail(CLIN_RAIL_TABS, '#10b981', { headerId: 'role-id-banner' });
        }
      }, 900);
    }
  }

  // ── Hide spinning globe launch cards for all authenticated workspace roles ──
  // These instrument launch cards (MAP/PEACS/MMAS animated globes) are visual
  // clutter for authenticated users — assessment is launched from the dashboard
  // toolbar or clinician panel. Explorer mode keeps them as the primary CTA.
  if (showRpp) {
    ['dash-launch-map','dash-launch-peacs','dash-launch-mmas'].forEach(id => {
      const c = document.getElementById(id);
      if (c) c.style.display = 'none';
    });
  }

  // ── Role identity banner ──────────────────────────────────────────────────
  const rib = document.getElementById('role-id-banner');
  if (rib) {
    if (showRpp) {
      const _role = workspaceProfile?.role || '';
      const isPharm   = isClinician(); // expanded from pharmacist-only
      const isStudent = _role === 'student';
      const ribColor = isPharm   ? '#10b981'
                     : isStudent ? '#2ec98a'
                     :             'var(--base)';
      const ribBg    = isPharm   ? 'rgba(16,185,129,0.04)'
                     : isStudent ? 'rgba(46,201,138,0.04)'
                     :             'rgba(78,156,245,0.04)';
      rib.style.display    = 'block';
      rib.style.borderLeft = '3px solid ' + ribColor;
      rib.style.background = ribBg;
      const ribEy = document.getElementById('rib-eyebrow');
      const ribTi = document.getElementById('rib-title');
      const ribSu = document.getElementById('rib-sub');
      const ribLabel = isPharm   ? '⚕ Clinical Practice Dashboard'
                     : isStudent ? '◎ Student Workspace'
                     :             '◈ Research Program Dashboard';
      const ribDefault = isPharm   ? 'Clinical Workspace'
                       : isStudent ? 'Student Workspace'
                       :             'Research Workspace';
      const ribDesc = isPharm
        ? 'Real-time patient monitoring · adherence alerts and care gaps · bulk import and CSV export · clinical workflow and billing documentation. Built for pharmacists, nurses, NPs, PAs, and care coordinators.'
        : isStudent
        ? 'Your personal cohort for thesis and coursework research. Collect MAP and PEACS data, run adherence phenotyping, export for your institution, and cite the instruments in your publication.'
        : 'Cohort analytics, adherence phenotyping, drug-condition stratification, natural language data queries, and PE Domain cohort intelligence. Built for academic publication and grant reporting.';
      if (ribEy) { ribEy.textContent = ribLabel; ribEy.style.color = ribColor; }
      if (ribTi) ribTi.textContent = (workspaceProfile && workspaceProfile.name) || ribDefault;
      if (ribSu) ribSu.textContent = ribDesc;
      // Show parent institution for PI and student when linked to an institution
      const ribInst = document.getElementById('rib-inst');
      if (ribInst) {
        const parentInst = workspaceProfile && workspaceProfile.parent_institution;
        if ((isStudent || isPIMode()) && parentInst) {
          // Show key immediately as placeholder, then resolve name async
          ribInst.textContent = '🏛 …';
          ribInst.style.display = 'block';
          // Read parent_institution_name from the student's OWN workspace node — stored
          // there by accSaveEditKey() so students/PIs can read it without access to the
          // institution's workspace node.
          database.ref('workspaces/' + currentWorkspace + '/parent_institution_name').once('value')
            .catch(() => null)
            .then(snap => {
              const resolved = (snap && snap.val()) || workspaceProfile.institution || parentInst;
              ribInst.textContent = '🏛 ' + resolved;
            });
        } else {
          ribInst.style.display = 'none';
        }
      }
      // Hoist the workspace ribbon above the pulse stat bar for all roles
      const _pulseBar = document.querySelector('#screen-dashboard .dash-pulse-bar');
      if (_pulseBar && _pulseBar.parentNode) {
        _pulseBar.parentNode.insertBefore(rib, _pulseBar);
      }
    } else {
      rib.style.display = 'none';
    }
  }

  // ── Relabel analytics panel and patient panel for role ─────────────────────
  const rapEyebrow = document.getElementById('rap-eyebrow');
  const rppHdrLbl  = document.getElementById('rpp-header-label');
  if (rapEyebrow) {
    if (isClinician()) {
      rapEyebrow.textContent = 'Patient Cohort Summary · ' + getClinicianLabel();
      rapEyebrow.style.color = 'rgba(16,185,129,0.55)';
    } else {
      rapEyebrow.textContent = 'Research Analytics · Your Cohort';
      rapEyebrow.style.color = 'rgba(212,168,67,0.55)';
    }
  }
  if (rppHdrLbl) rppHdrLbl.textContent = isClinician() ? '🧑‍⚕️ Active Patients · Your Cohort' : '◈ Cohort Records · Your Dataset';

  // ── PE Domain aggregate (researcher + PI only — not pharmacist, not student) ─
  const _roleForPE = workspaceProfile?.role || '';
  const rapPeDom = document.getElementById('rap-pe-domain');
  if (rapPeDom) rapPeDom.style.display = (showRpp && _roleForPE === 'researcher') ? '' : 'none';

  // ── Subgroup Analysis + Publication Stats (researcher + PI only) ──────────
  const rapSubEl = document.getElementById('rap-subgroup-section');
  const rapPubEl = document.getElementById('rap-pubstats-section');
  const _showResearchModules = showRpp && (_roleForPE === 'researcher' || _roleForPE === 'pi');
  if (rapSubEl) rapSubEl.style.display = _showResearchModules ? '' : 'none';
  if (rapPubEl) rapPubEl.style.display = _showResearchModules ? '' : 'none';
  const rapPsychEl = document.getElementById('rap-psych-section');
  if (rapPsychEl) rapPsychEl.style.display = _showResearchModules ? '' : 'none';

  // ── Clinical Profile (all research tiers — researcher, PI, student, institution) ─
  const rapClinical = document.getElementById('rap-clinical-profile');
  // Expand clinical profile roles to include all CLINICIAN_ROLES
  const _cpRoles = new Set(['student','researcher','pi','institution','pharmacist','np','pa','rn','md','care_coordinator','clinician']);
  if (rapClinical) rapClinical.style.display = (showRpp && _cpRoles.has(_roleForPE)) ? '' : 'none';

  // ── Citation panel: on-demand only — always hidden from live workspace ───────
  const citPanel = document.getElementById('res-citation-panel');
  if (citPanel) citPanel.style.display = 'none';
  // Pre-init quick-copy for researcher so it's ready when citation modal is opened
  if (showRpp && !isClinician() && _roleForPE !== 'student') setTimeout(initCiteQuickCopy, 200);
  // ── Researcher tools bar (Citation Guide + other end-of-study tools) ─────────
  const resToolsBar = document.getElementById('res-tools-bar');
  if (resToolsBar) {
    resToolsBar.style.display = (showRpp && !isClinician() && _roleForPE !== 'student') ? '' : 'none';
  }

  // Show/hide dash-level MMAS export button (not for students — they use the student tab export)
  const dashMmasExport = document.getElementById('dash-mmas-export-btn');
  if (dashMmasExport) dashMmasExport.style.display = (isResearcher && !isStudentRole) ? '' : 'none';

  // Remove any previously injected explorer banner and stale locked cards (session restore cleanup)
  const _eb = document.getElementById('explorer-upgrade-banner');
  if (_eb) _eb.remove();
  _clearLockedCards();

  // ── EXPLORER WORKSPACE ───────────────────────────────────────────────────────
  // Full modular workspace for Explorer / Free Tier users. Replaces the sparse
  // default dashboard with properly organised plug-and-play module blocks.
  // Guard: isExplorer only — NEVER runs for authenticated workspace roles.
  if (isExplorer) {
    (function _buildExplorerWorkspace() {
      if (document.getElementById('explorer-workspace-panel')) return; // idempotent

      var _db = document.querySelector('#screen-dashboard .dash-body');
      if (!_db) return;

      // ── Suppress explorer-mode-banner (injectExplorerBanner runs at 100ms) ──
      // Our MODULE 1 header replaces it — override the injector to a no-op and
      // remove any copy that already exists or fires after us.
      window.injectExplorerBanner = function() {};
      var _existBanner = document.getElementById('explorer-mode-banner');
      if (_existBanner) _existBanner.remove();
      setTimeout(function() {
        var _b = document.getElementById('explorer-mode-banner');
        if (_b) _b.remove();
      }, 200);

      // ── Hide elements we're consolidating into the workspace ────────────────
      var _slpE = document.getElementById('session-launcher-panel');
      if (_slpE) _slpE.style.display = 'none';
      var _rabE = document.getElementById('dash-researcher-action-bar');
      if (_rabE) _rabE.style.display = 'none';
      // Hide standalone spectator card (has no ID — target via button's parentNode)
      var _specBtnEl = document.getElementById('dash-spectator-btn');
      if (_specBtnEl && _specBtnEl.parentNode) _specBtnEl.parentNode.style.display = 'none';
      // Records panel: will be re-parented into MODULE 5 below
      var _mrpE = document.querySelector('.mc-records-panel');

      // ── Workspace ID display ────────────────────────────────────────────────
      var _wsDisplay = window._freemiumKey
        || (currentWorkspace && currentWorkspace !== 'EXPLORER' ? currentWorkspace : null)
        || ('EXPL-' + Math.random().toString(36).slice(2,10).toUpperCase());

      // ── Build explorer-workspace-panel ──────────────────────────────────────
      var _ewp = document.createElement('div');
      _ewp.id = 'explorer-workspace-panel';
      _ewp.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-bottom:10px;';

      _ewp.innerHTML =
        // ── MODULE 1 · EXPLORER HEADER ───────────────────────────────────────
        '<div id="expl-mod-header" style="background:var(--card);border:1px solid var(--border);border-left:3px solid rgba(46,201,138,0.55);border-radius:12px;overflow:hidden;">' +
          '<div style="padding:20px 24px;">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.24em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Explorer Workspace · ATLAS</div>' +
                '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright);line-height:1.2;margin-bottom:4px;">Free Tier</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.14em;color:var(--muted);">' + _wsDisplay + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:2px;">' +
                '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.25);color:#2ec98a;border-radius:5px;padding:3px 9px;">FREE TIER</span>' +
                '<button onclick="if(typeof startExplorerTour===\'function\')startExplorerTour();" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--muted);border-radius:7px;padding:6px 12px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.color=\'var(--text)\';this.style.borderColor=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.color=\'var(--muted)\';this.style.borderColor=\'var(--border2)\'">⬡ Tour</button>' +
                '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.10);border:1px solid rgba(46,201,138,0.35);color:#2ec98a;border-radius:7px;padding:6px 14px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(46,201,138,0.20)\'" onmouseout="this.style.background=\'rgba(46,201,138,0.10)\'">Upgrade →</button>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top:16px;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                '<div id="expl-usage-label" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;letter-spacing:0.10em;color:var(--muted);">0 of 50 free assessments used</div>' +
                '<div id="expl-usage-pct" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);">0%</div>' +
              '</div>' +
              '<div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">' +
                '<div id="expl-usage-bar" style="height:100%;width:0%;background:#2ec98a;border-radius:3px;transition:width 0.6s ease,background 0.4s;"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ── MODULE 2 · SESSION LAUNCHER ──────────────────────────────────────
        '<div id="expl-mod-session" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">' +
          '<div style="padding:16px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">' +
            '<div style="width:3px;height:30px;background:linear-gradient(to bottom,#2563eb 0%,#2ec98a 50%,#7c3aed 100%);border-radius:2px;flex-shrink:0;"></div>' +
            '<div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">MAP · PEACS · MMAS-8</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Start Assessment Session</div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:16px 20px 18px;">' +
            // Main session button
            '<button id="expl-start-session-btn" onclick="openSessionGuarded()" style="width:100%;padding:14px 20px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;background:linear-gradient(135deg,rgba(37,99,235,0.12),rgba(46,201,138,0.10));border:1px solid rgba(37,99,235,0.35);color:var(--base);border-radius:9px;cursor:pointer;transition:all 0.22s;display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(37,99,235,0.20),rgba(46,201,138,0.16))\';this.style.borderColor=\'rgba(37,99,235,0.6)\'" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(46,201,138,0.10))\';this.style.borderColor=\'rgba(37,99,235,0.35)\'">' +
              '<span style="font-size:1.1rem;">⊕</span>' +
              '<div style="text-align:left;">' +
                '<div>Start New Patient Session</div>' +
                '<div style="font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:0.69rem;text-transform:none;letter-spacing:0.04em;color:var(--dim);margin-top:2px;">Collect patient ID · SDoH · consent · select instrument</div>' +
              '</div>' +
            '</button>' +
            // Instrument quick-start grid
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">' +
              '<button onclick="(function(){var r=document.querySelector(\'input[name=\\\'sess-instrument\\\'][value=\\\'map\\\']\');if(r)r.checked=true;openSessionGuarded();})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.22);color:var(--base);border-radius:7px;padding:9px 6px;cursor:pointer;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:4px;" onmouseover="this.style.background=\'rgba(37,99,235,0.16)\'" onmouseout="this.style.background=\'rgba(37,99,235,0.08)\'">' +
                '<span style="font-size:0.9rem;">◈</span><span>MAP</span>' +
              '</button>' +
              '<button onclick="(function(){var r=document.querySelector(\'input[name=\\\'sess-instrument\\\'][value=\\\'peacs\\\']\');if(r)r.checked=true;openSessionGuarded();})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.22);color:var(--mvmt);border-radius:7px;padding:9px 6px;cursor:pointer;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:4px;" onmouseover="this.style.background=\'rgba(124,58,237,0.16)\'" onmouseout="this.style.background=\'rgba(124,58,237,0.08)\'">' +
                '<span style="font-size:0.9rem;">⬡</span><span>PEACS</span>' +
              '</button>' +
              '<button onclick="(function(){var r=document.querySelector(\'input[name=\\\'sess-instrument\\\'][value=\\\'mmas\\\']\');if(r)r.checked=true;openSessionGuarded();})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.22);color:#2ec98a;border-radius:7px;padding:9px 6px;cursor:pointer;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:4px;" onmouseover="this.style.background=\'rgba(46,201,138,0.16)\'" onmouseout="this.style.background=\'rgba(46,201,138,0.08)\'">' +
                '<span style="font-size:0.9rem;">⬤</span><span>MMAS-8</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ── MODULE 3 · LIVE GLOBAL MAP ───────────────────────────────────────
        '<div id="expl-mod-spectator" style="background:var(--card);border:1px solid rgba(5,150,105,0.22);border-radius:12px;overflow:hidden;">' +
          '<button onclick="(function(btn){var body=document.getElementById(\'expl-spectator-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'\';btn.querySelector(\'.expl-tog\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;">' +
            '<span style="width:7px;height:7px;border-radius:50%;background:#059669;box-shadow:0 0 7px #059669;flex-shrink:0;animation:expl-pulse 2s ease-in-out infinite;"></span>' +
            '<div style="flex:1;">' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Live · Real-time · Global</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Watch Live Global Map</div>' +
            '</div>' +
            '<span class="expl-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);">▼</span>' +
          '</button>' +
          '<div id="expl-spectator-body" style="border-top:1px solid var(--border);padding:16px 20px 18px;">' +
            '<div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">' +
              '<div style="flex:1;min-width:200px;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--text);line-height:1.8;margin-bottom:12px;">' +
                  'Watch MAP, PEACS, and MMAS-8 assessments stream globally in real time. Spectator mode is fully available on the free tier.' +
                '</div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                  '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);color:var(--base);border-radius:4px;padding:2px 7px;">MAP</span>' +
                  '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);color:var(--mvmt);border-radius:4px;padding:2px 7px;">PEACS</span>' +
                  '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.2);color:#2ec98a;border-radius:4px;padding:2px 7px;">MMAS-8</span>' +
                  '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);color:#ef4444;border-radius:4px;padding:2px 7px;">● Real-time</span>' +
                '</div>' +
              '</div>' +
              '<button onclick="enterSpectatorMode()" style="flex-shrink:0;font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(5,150,105,0.10);border:1.5px solid rgba(5,150,105,0.35);color:#059669;border-radius:9px;padding:12px 20px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:9px;" onmouseover="this.style.background=\'rgba(5,150,105,0.20)\';this.style.borderColor=\'rgba(5,150,105,0.60)\'" onmouseout="this.style.background=\'rgba(5,150,105,0.10)\';this.style.borderColor=\'rgba(5,150,105,0.35)\'">' +
                '<span style="width:8px;height:8px;border-radius:50%;background:#059669;box-shadow:0 0 6px #059669;"></span>' +
                '◉ Spectator Mode' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ── MODULE 4 · ANALYTICS PREVIEW (LOCKED — upgrade required) ─────────
        '<div id="expl-mod-preview" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">' +
          '<button onclick="(function(btn){var body=document.getElementById(\'expl-preview-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'\';btn.querySelector(\'.expl-tog2\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;">' +
            '<div style="width:3px;height:30px;background:linear-gradient(to bottom,rgba(46,201,138,0.6) 0%,rgba(139,111,245,0.6) 100%);border-radius:2px;flex-shrink:0;"></div>' +
            '<div style="flex:1;">' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">Researcher · PI · Clinician</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Analytics Modules Preview</div>' +
            '</div>' +
            '<span class="expl-tog2" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);">▼</span>' +
          '</button>' +
          '<div id="expl-preview-body" style="border-top:1px solid var(--border);padding:16px 20px 20px;">' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--muted);margin-bottom:14px;line-height:1.7;">Upgrade to unlock full analytics, cohort comparison, PEACS trajectory, and research publication tools.</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">' +

              // Card 1: MAP Adherence Analysis
              '<div style="background:rgba(37,99,235,0.04);border:1px solid rgba(37,99,235,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(37,99,235,0.7);margin-bottom:6px;">Researcher Tier</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">MAP Adherence Analysis</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">Domain breakdown, PE scoring, ITC grid, arch vs. exec comparison, subgroup stratification.</div>' +
              '</div>' +

              // Card 2: PEACS Trajectory Engine
              '<div style="background:rgba(124,58,237,0.04);border:1px solid rgba(124,58,237,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(124,58,237,0.7);margin-bottom:6px;">Researcher · PI</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">PEACS Trajectory Engine</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">Quarter-over-quarter trajectory, movement domain trends, behavioral pattern stability.</div>' +
              '</div>' +

              // Card 3: Cohort Analytics Suite
              '<div style="background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(46,201,138,0.7);margin-bottom:6px;">All Paid Tiers</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">Cohort Analytics Suite</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">Cohort snapshot, country breakdown, global cohort map, benchmark comparisons.</div>' +
              '</div>' +

              // Card 4: Publication & Export Tools
              '<div style="background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:6px;">Researcher · PI</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">Publication & Export Tools</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">APA citation generator, power calculator, IRB cert, blinded CSV export, predictor model.</div>' +
              '</div>' +

              // Card 5: Validation Comparator
              '<div style="background:rgba(5,150,105,0.04);border:1px solid rgba(5,150,105,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(5,150,105,0.7);margin-bottom:6px;">Student · Researcher</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">Validation Comparator</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">MAP vs. MMAS-8 convergent validity, Pearson r, Cronbach alpha, ITC analysis.</div>' +
              '</div>' +

              // Card 6: Clinical Worklist (MTM)
              '<div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.14);border-radius:9px;padding:14px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
                  '<span style="font-size:1.2rem;">🔒</span>' +
                  '<button onclick="window.open(\'https://keys.adherence.cc\',\'_blank\');" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.40);color:#2ec98a;border-radius:6px;padding:5px 12px;cursor:pointer;">Upgrade →</button>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(16,185,129,0.7);margin-bottom:6px;">Clinician · PharmD</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-bottom:6px;">Clinical Worklist & MTM</div>' +
                '<div style="font-size:0.72rem;color:var(--dim);line-height:1.6;">Active patient worklist, MTM timer, audit panel, care gap detection, billing integration.</div>' +
              '</div>' +

            '</div>' +
          '</div>' +
        '</div>';

      // ── Insert workspace panel before the pulse bar ────────────────────────
      var _pb = document.querySelector('#screen-dashboard .dash-pulse-bar');
      if (_pb && _pb.parentNode === _db) {
        _db.insertBefore(_ewp, _pb);
      } else {
        _db.insertBefore(_ewp, _slpE || _db.firstChild);
      }

      // ── MODULE 5 · RECORDS — wrap existing mc-records-panel ───────────────
      if (_mrpE && !document.getElementById('expl-mod-records')) {
        var _recMod = document.createElement('div');
        _recMod.id = 'expl-mod-records';
        _recMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
        _recMod.innerHTML =
          '<button onclick="(function(btn){var body=document.getElementById(\'expl-records-body\');var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'\';btn.querySelector(\'.expl-rec-tog\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:14px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;">' +
            '<div style="width:3px;height:28px;background:rgba(46,201,138,0.5);border-radius:2px;flex-shrink:0;"></div>' +
            '<div style="flex:1;">' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">MAP · PEACS · MMAS-8</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:700;color:var(--bright);margin-top:1px;">Records & Data</div>' +
            '</div>' +
            '<span class="expl-rec-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:var(--dim);">▼</span>' +
          '</button>' +
          '<div id="expl-records-body" style="border-top:1px solid var(--border);"></div>';
        _mrpE.parentNode.insertBefore(_recMod, _mrpE);
        var _recBody = document.getElementById('expl-records-body');
        if (_recBody) {
          _recBody.appendChild(_mrpE);
          _mrpE.style.background   = 'none';
          _mrpE.style.border       = 'none';
          _mrpE.style.borderRadius = '0';
          _mrpE.style.margin       = '0';
          // Hide inner toggle — our outer MODULE 5 toggle replaces it
          var _innerTog = document.getElementById('mc-records-toggle-btn');
          if (_innerTog) _innerTog.style.display = 'none';
          // Open inner body so content shows when our outer panel is expanded
          var _innerBody = document.getElementById('mc-records-body');
          if (_innerBody) _innerBody.style.display = '';
        }
      }

      // ── Inject pulsing dot CSS ─────────────────────────────────────────────
      if (!document.getElementById('expl-ws-style')) {
        var _es = document.createElement('style');
        _es.id = 'expl-ws-style';
        _es.textContent =
          '@keyframes expl-pulse{0%,100%{box-shadow:0 0 4px #059669;}50%{box-shadow:0 0 10px #059669;}}';
        document.head.appendChild(_es);
      }

      // ── Usage meter update — called after dashMmasData loads ──────────────
      window._explorerUpdateUsage = function() {
        var _n = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData))
          ? dashMmasData.length : 0;
        var _lbl  = document.getElementById('expl-usage-label');
        var _pct  = document.getElementById('expl-usage-pct');
        var _bar  = document.getElementById('expl-usage-bar');
        var _pctN = Math.min(Math.round((_n / 50) * 100), 100);
        if (_lbl)  _lbl.textContent  = _n + ' of 50 free assessments used';
        if (_pct)  _pct.textContent  = _pctN + '%';
        if (_bar) {
          _bar.style.width      = _pctN + '%';
          _bar.style.background = _n >= 45 ? '#ef4444' : _n >= 35 ? '#f59e0b' : '#2ec98a';
        }
      };

      atlasAuditLog('explorer_workspace_rendered', { workspace: currentWorkspace || 'EXPL' });
    })();
  }
  // ── END EXPLORER WORKSPACE ───────────────────────────────────────────────────

  // Clinic Mode: institution + superadmin only (not student/PI researchers)
  const cmBtn = document.getElementById('clinic-mode-toggle-btn');
  if (cmBtn) cmBtn.style.display = ((isInstitutionMode() || isSuperAdmin()) && hasModule('clinical_clinic_mode')) ? 'flex' : 'none';
  // HEOR panels — researcher/PI and above (not institution — institution has its own embedded panels)
  const isRes = isResearcherMode() && !isInstitutionMode();
  const apePanel   = document.getElementById('ape-panel');
  const stratPanel = document.getElementById('strat-panel');
  const nlqPanel   = document.getElementById('nlq-panel');
  const trajPanel  = document.getElementById('traj-panel');
  const benchPanel = document.getElementById('bench-panel');

  // Students use the Publish tab — APE and advanced analytics panels are researcher/clinician/PI+
  // When role qualifies but module is disabled → show locked card instead of blank gap.
  const _apeRoleOk  = showRpp && !isStudentRole;
  const _resRoleOk  = isRes && !isStudentRole;
  const _benchRoleOk = (isRes && !isStudentRole && (workspaceProfile?.role === 'pi')) || isInstitutionMode() || isSuperAdmin();

  if (apePanel) {
    if (_apeRoleOk && !hasModule('analytics_map'))          _showModuleLocked(apePanel, 'analytics_map');
    else apePanel.style.display = (_apeRoleOk && hasModule('analytics_map')) ? '' : 'none';
  }
  if (stratPanel) {
    if (_resRoleOk && !hasModule('analytics_subgroup'))     _showModuleLocked(stratPanel, 'analytics_subgroup');
    else stratPanel.style.display = (_resRoleOk && hasModule('analytics_subgroup')) ? '' : 'none';
  }
  if (nlqPanel) {
    if (_resRoleOk && !hasModule('premium_nlq'))            _showModuleLocked(nlqPanel, 'premium_nlq');
    else nlqPanel.style.display = (_resRoleOk && hasModule('premium_nlq')) ? '' : 'none';
  }
  if (trajPanel) {
    if (_resRoleOk && !hasModule('analytics_peacs'))        _showModuleLocked(trajPanel, 'analytics_peacs');
    else trajPanel.style.display = (_resRoleOk && hasModule('analytics_peacs')) ? '' : 'none';
  }
  if (benchPanel) {
    if (_benchRoleOk && !hasModule('analytics_psychometrics')) _showModuleLocked(benchPanel, 'analytics_psychometrics');
    else benchPanel.style.display = (_benchRoleOk && hasModule('analytics_psychometrics')) ? '' : 'none';
  }

  // PI Research Panel — velocity, retention, heatmap
  const piPanel = document.getElementById('pi-research-panel');
  if (piPanel) piPanel.style.display = (isPIMode() && hasModule('research_pi_panel')) ? '' : 'none';
  if (isPIMode() && hasModule('research_pi_panel')) setTimeout(initPiResearchPanel, 400);
  // Hide instrument globe cards for PI — replaced by command center
  const mcRow = document.querySelector('.mc-instrument-row');
  if (mcRow && isPIMode()) mcRow.style.display = 'none';

  // Blinded export — PI only
  const blindedBtn = document.getElementById('pi-blinded-export-btn');
  if (blindedBtn) blindedBtn.style.display = (isPIMode() && hasModule('export_csv')) ? '' : 'none';
  // Campaign manager: superadmin + PI (with module entitlement)
  const campManagerPanel = document.getElementById('campaign-manager-panel');
  const campManagerBtn   = document.getElementById('campaign-manager-btn');
  if (campManagerPanel) campManagerPanel.style.display = 'none'; // always closed on login; toggled by button
  if (campManagerBtn)   campManagerBtn.style.display   = (isSuperAdmin() && hasModule('clinical_campaigns')) ? 'flex' : 'none';
  const backfillBtn = document.getElementById('backfill-tool-btn');
  if (backfillBtn) backfillBtn.style.display = isSuperAdmin() ? 'flex' : 'none';
  // Sentinel: superadmin, institution, researcher/PI with module entitlement
  const _sentinelRoleOk = isSuperAdmin() || isInstitutionMode() || isResearcherMode();
  if (_sentinelRoleOk && hasModule('clinical_sentinel')) {
    setTimeout(initSentinel, 600);
  }
  // ATLAS Control button — superadmin only. Button lives in the static nav bar
  // (index.html #acc-open-btn, display:none by default). Show it here for superadmin.
  const _accBtn = document.getElementById('acc-open-btn');
  if (_accBtn) _accBtn.style.display = isSuperAdmin() ? 'flex' : 'none';
  const prevNudge = document.getElementById('researcher-upgrade-nudge');
  if (prevNudge) prevNudge.remove();

  if (typeof setAppLanguage === 'function') setAppLanguage(mmasCurrentLang || 'en');

  // ── Observer mode: read-only global view ─────────────────────────────────
  // Runs last so it overrides any display:'' set by the role checks above.
  // Observer sees: live stats, spectator globe, global map, pulse bar.
  // Observer does NOT see: exports, edits, bulk upload, IRB certs, QR,
  //   patient panel, ACC button, PEACS admin, Sentinel, campaign tools.
  if (isObserverMode()) {
    // Remove any existing observer banner first (session restore)
    const prevObsBanner = document.getElementById('observer-mode-banner');
    if (prevObsBanner) prevObsBanner.remove();

    // Inject read-only banner at top of dash body
    const obsBanner = document.createElement('div');
    obsBanner.id = 'observer-mode-banner';
    obsBanner.style.cssText = [
      'background:rgba(212,168,67,0.05)',
      'border:1px solid rgba(212,168,67,0.18)',
      'border-radius:12px',
      'padding:12px 18px',
      'margin-bottom:20px',
      'display:flex',
      'align-items:center',
      'gap:12px',
    ].join(';');
    obsBanner.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:var(--pe);box-shadow:0 0 6px var(--pe);flex-shrink:0;"></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(212,168,67,0.75);">Observer Access</span>
      <span style="font-size:0.84rem;color:var(--muted);">Read-only global view. Data and exports are not available at this access level.</span>
    `;
    const _db = document.querySelector('#screen-dashboard .dash-body');
    if (_db) _db.insertBefore(obsBanner, _db.firstChild);

    // Hide all write/export/admin controls
    const OBSERVER_HIDE = [
      '#dash-bulk-btn',
      '#dash-mmas-export-btn',
      '#dash-export-btn',
      '#dash-qr-btn',
      '#irb-cert-btn',
      '#irb-aggregate-btn',
      '#mmas-export-btn',
      '#peacs-export-btn',
      '#pi-blinded-export-btn',
      '#pi-research-panel',
      '#pi-provision-modal',
      '#mmas-refresh-btn',
      '#peacs-refresh-btn',
      '#mapc-refresh-btn',
      '#map-export-btn',
      '#mapc-export-btn',
      '#acc-open-btn',
      '#acc-open-divider',
      '#campaign-manager-btn',
      '#backfill-tool-btn',
      '#clinic-mode-toggle-btn',
      '#dash-new-session-btn',
      '.mc-ghost-btn',
      '#researcher-patient-panel',
      '#researcher-upgrade-nudge',
      '#institution-analytics-dashboard',
      '#institution-command-center',
      '.ape-panel', '#ape-panel',
      '.strat-panel', '#strat-panel',
      '.nlq-panel', '#nlq-panel',
      '.traj-panel', '#traj-panel',
      '.bench-panel', '#bench-panel',
      '#corr-panel',
    ];
    OBSERVER_HIDE.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
    });

    // Workspace chip — gold observer colour
    const chip = document.querySelector('.dash-workspace-chip');
    const dot  = document.querySelector('.dash-workspace-dot');
    if (chip) { chip.style.background='rgba(212,168,67,0.08)';chip.style.borderColor='rgba(212,168,67,0.25)';chip.style.color='var(--pe)'; }
    if (dot)  { dot.style.background='var(--pe)';dot.style.boxShadow='0 0 5px var(--pe)'; }

    // Ensure the instrument row and pulse bar are visible (global stats, spectator button)
    const instrRow = document.querySelector('.mc-instrument-row');
    const pulseBar = document.querySelector('.dash-pulse-bar');
    const specBtn  = document.getElementById('dash-spectator-btn')?.parentElement;
    const recPanel = document.querySelector('.mc-records-panel');
    if (instrRow)  instrRow.style.display = '';
    if (pulseBar)  pulseBar.style.display = '';
    if (specBtn)   specBtn.style.display  = '';
    // Hide records panel — contains individual data
    if (recPanel)  recPanel.style.display = 'none';

    // Disable all export functions at runtime so keyboard shortcuts can't bypass UI
    window.exportMmasCSV       = () => showToast('Export not available in Observer mode.', 3000);
    window.exportPeacsCSV      = () => showToast('Export not available in Observer mode.', 3000);
    window.exportInstitutionCSV= () => showToast('Export not available in Observer mode.', 3000);
    window.accExportGAI        = () => showToast('Export not available in Observer mode.', 3000);
    window.openCommandCenter   = () => showToast('ATLAS Control requires superadmin access.', 3000);
    window.generateIRBCertificate = () => showToast('IRB certificates require researcher access.', 3000);

    atlasAuditLog('observer_dashboard_access', { workspace: currentWorkspace });
  }

  // ── Missing study title nudge (PI + researcher only) ─────────────────────
  // The Letter of Permission requires study_title. If the profile was created
  // without one (common when checking out quickly), show a one-time prompt so
  // the user knows they need to add it before requesting the LoP.
  {
    const _prevNudge = document.getElementById('study-title-nudge');
    if (_prevNudge) _prevNudge.remove();
    const _nudgeRoles = new Set(['pi','researcher']);
    const _needsNudge = workspaceProfile
      && _nudgeRoles.has(workspaceProfile.role)
      && !workspaceProfile.letter_eligible
      && !workspaceProfile.study_title;
    if (_needsNudge) {
      const _nudge = document.createElement('div');
      _nudge.id = 'study-title-nudge';
      _nudge.style.cssText = 'background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.28);border-radius:12px;padding:12px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;';
      _nudge.innerHTML = `
        <span style="width:6px;height:6px;border-radius:50%;background:var(--pe);box-shadow:0 0 5px var(--pe);flex-shrink:0;"></span>
        <div style="flex:1;min-width:220px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(212,168,67,0.85);margin-bottom:3px;">Letter of Permission — Study Title Required</div>
          <div style="font-size:0.83rem;color:var(--muted);line-height:1.6;">Your workspace has no study title on file. Add one via <strong style="color:var(--text);">My Studies</strong> — it's required before your Letter of Permission can be issued.</div>
        </div>
        <button onclick="openMyStudiesPanel();document.getElementById('study-title-nudge').style.display='none';" style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);color:var(--pe);border-radius:8px;padding:8px 14px;cursor:pointer;transition:all 0.18s;white-space:nowrap;" onmouseover="this.style.background='rgba(212,168,67,0.2)'" onmouseout="this.style.background='rgba(212,168,67,0.1)'">Add Study Title →</button>
        <button onclick="this.closest('#study-title-nudge').remove();" title="Dismiss" style="background:none;border:none;color:var(--dim);font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;flex-shrink:0;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--dim)'">✕</button>
      `;
      const _db = document.querySelector('#screen-dashboard .dash-body');
      if (_db) _db.insertBefore(_nudge, _db.firstChild);
    }
  }

  // ── Researcher / PI workspace modularization ─────────────────────────────
  // Wrapped in try-catch: any DOM error here must not prevent showScreen('screen-dashboard').
  // Applies to researcher + PI paths — not student (own panel), clinician (own panel),
  // institution (own dashboard), or observer.
  try {
  {
    // Re-login cleanup: restore any HEOR panels from inside the accordion before removing it
    const _prevResAdv = document.getElementById('res-advanced-accordion');
    if (_prevResAdv) {
      const _advParent = _prevResAdv.parentNode;
      ['pe-domain-panel','ape-panel','strat-panel','nlq-panel','traj-panel','bench-panel'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el && el.closest('#res-advanced-accordion') && _advParent) {
          _advParent.insertBefore(el, _prevResAdv);
        }
      });
      _prevResAdv.remove();
    }
    const _prevResHdr = document.getElementById('res-ws-header');
    if (_prevResHdr) _prevResHdr.remove();
    document.querySelectorAll('.res-mod-hdr').forEach(function(e) { e.remove(); });

    const _isResWs = showRpp && !isStudentRole && !isClinician() && !isInstitutionMode() && !isObserverMode();
    if (_isResWs) {
      const _db = document.querySelector('#screen-dashboard .dash-body');
      if (_db) {
        const _isPiWs = isPIMode();
        const _resName  = (workspaceProfile && workspaceProfile.name)        || '';
        const _resInst  = (workspaceProfile && workspaceProfile.institution)  || '';
        const _resByline = _resName
          ? (_resInst ? _resName + ' · ' + _resInst : _resName)
          : (_isPiWs ? 'Principal Investigator' : 'Researcher');
        const _resRoleLabel   = _isPiWs ? 'PI Workspace · ATLAS' : 'Researcher Workspace · ATLAS';
        const _resBarColor    = _isPiWs ? '#d4a843' : '#8b6ff5';
        const _resBorderColor = _isPiWs ? 'rgba(212,168,67,0.40)' : 'rgba(139,111,245,0.40)';
        const _resDisplayName = _resName || (_isPiWs ? 'Principal Investigator' : 'Researcher');

        // ── MODULE 1: Workspace Header ──────────────────────────────────
        const _resHdr = document.createElement('div');
        _resHdr.id = 'res-ws-header';
        _resHdr.style.cssText = 'background:var(--card);border:1px solid var(--border);border-left:3px solid ' + _resBorderColor + ';border-radius:12px;overflow:hidden;margin-bottom:10px;';
        _resHdr.innerHTML =
          '<div style="padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">' +
            '<div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">' + _resRoleLabel + '</div>' +
              '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.40rem;font-weight:300;color:var(--bright);line-height:1.15;">' + _resDisplayName + '</div>' +
              '<div id="res-header-inst" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-top:4px;display:none;"></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
              '<button onclick="openSessionModal()" class="stu-btn">⊕ New Session</button>' +
              '<button onclick="showCitationModal()" class="stu-btn">✦ Cite</button>' +
              '<button onclick="enterSpectatorMode()" style="padding:7px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.2);color:#059669;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(5,150,105,0.12)\'" onmouseout="this.style.background=\'rgba(5,150,105,0.06)\'">🌐 Global Map</button>' +
            '</div>' +
          '</div>';
        // Hide role-id-banner — our workspace header replaces it for researcher/PI
        const _ribForRes = document.getElementById('role-id-banner');
        if (_ribForRes) _ribForRes.style.display = 'none';
        // Insert workspace header before the pulse stat bar (top of workspace content)
        const _pBarR = document.querySelector('#screen-dashboard .dash-pulse-bar');
        if (_pBarR && _pBarR.parentNode) {
          _pBarR.parentNode.insertBefore(_resHdr, _pBarR);
        } else {
          const _slpElRFb = document.getElementById('session-launcher-panel');
          if (_slpElRFb && _slpElRFb.parentNode === _db) _db.insertBefore(_resHdr, _slpElRFb);
          else _db.insertBefore(_resHdr, _db.firstChild);
        }
        // Populate institution line
        const _resInstEl = document.getElementById('res-header-inst');
        if (_resInstEl) {
          const _resParentInst = workspaceProfile && workspaceProfile.parent_institution;
          if (_resParentInst) {
            _resInstEl.textContent = '🏛 …';
            _resInstEl.style.display = 'block';
            database.ref('workspaces/' + currentWorkspace + '/parent_institution_name').once('value')
              .catch(() => null)
              .then(function(snap) {
                const resolved = (snap && snap.val()) || _resInst || _resParentInst;
                _resInstEl.textContent = '🏛 ' + resolved;
              });
          } else if (_resInst) {
            _resInstEl.textContent = '🏛 ' + _resInst;
            _resInstEl.style.display = 'block';
          }
        }

        // ── MODULE 2: Session Launcher — card styling + module header ────
        const _slpElR = document.getElementById('session-launcher-panel');
        if (_slpElR) {
          _slpElR.style.background    = 'var(--card)';
          _slpElR.style.border        = '1px solid var(--border)';
          _slpElR.style.borderRadius  = '12px';
          _slpElR.style.overflow      = 'hidden';
          _slpElR.style.marginBottom  = '10px';
          _slpElR.style.padding       = '0';
          const _slHdr = document.createElement('div');
          _slHdr.className = 'res-mod-hdr';
          _slHdr.style.cssText = 'padding:13px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;';
          _slHdr.innerHTML =
            '<div style="width:3px;height:14px;background:' + _resBarColor + ';border-radius:2px;flex-shrink:0;"></div>' +
            '<div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + '</div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Session Launcher</div></div>';
          _slpElR.insertBefore(_slHdr, _slpElR.firstChild);
          const _sBtn = document.getElementById('start-session-btn');
          if (_sBtn) { _sBtn.style.margin = '14px'; _sBtn.style.width = 'calc(100% - 28px)'; }
          const _sSum = document.getElementById('session-summary-bar');
          if (_sSum) { _sSum.style.margin = '0 14px 14px'; }
        }

        // ── MODULE 3: Instrument row spacing ─────────────────────────────
        const _instrRowR = _db.querySelector('.mc-instrument-row');
        if (_instrRowR) _instrRowR.style.marginBottom = '10px';

        // ── MODULE 4: Cohort Analytics — card styling ─────────────────────
        const _rapElR = document.getElementById('res-analytics-panel');
        if (_rapElR) {
          _rapElR.style.background   = 'var(--card)';
          _rapElR.style.border       = '1px solid var(--border)';
          _rapElR.style.borderLeft   = '3px solid ' + _resBorderColor;
          _rapElR.style.borderRadius = '12px';
          _rapElR.style.overflow     = 'hidden';
          _rapElR.style.marginBottom = '10px';
          // Add module header before existing rap-eyebrow header row
          const _rapFirstChild = _rapElR.firstElementChild;
          if (_rapFirstChild && !_rapElR.querySelector('.res-mod-hdr')) {
            const _rapMH = document.createElement('div');
            _rapMH.className = 'res-mod-hdr';
            // Negative margin cancels the parent's 28px left/right padding so header spans full width
            _rapMH.style.cssText = 'margin:0 -28px 16px;padding:13px 28px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;';
            _rapMH.innerHTML =
              '<div style="width:3px;height:14px;background:' + _resBarColor + ';border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Analytics</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Cohort Analytics</div>' +
              '</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;color:var(--dim);margin-right:8px;">MMAS-8 · MAP · AEC Domains</div>';
            _rapElR.insertBefore(_rapMH, _rapFirstChild);
          }
        }

        // ── MODULE 5: Cohort Records — card border ─────────────────────────
        const _recPanelElR = _db.querySelector('.mc-records-panel');
        if (_recPanelElR) {
          _recPanelElR.style.border       = '1px solid var(--border)';
          _recPanelElR.style.borderRadius = '12px';
          _recPanelElR.style.overflow     = 'hidden';
          _recPanelElR.style.marginBottom = '10px';
        }

        // ── MODULE 6: Patient Cohort — adjust outer spacing ──────────────
        const _rppElR = document.getElementById('researcher-patient-panel');
        if (_rppElR) {
          _rppElR.style.marginBottom = '10px';
          // Inner card already has its own border/bg — just ensure outer has no double-border
          _rppElR.style.padding = '0 0 0 0';
          // Add module header inside the existing inner card header row
          const _innerCard = _rppElR.querySelector('div[style*="background:var(--card)"]') || _rppElR.firstElementChild;
          if (_innerCard && !_rppElR.querySelector('.res-mod-hdr')) {
            const _rppMH = document.createElement('div');
            _rppMH.className = 'res-mod-hdr';
            _rppMH.style.cssText = 'padding:9px 18px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--card2);';
            _rppMH.innerHTML =
              '<div style="width:3px;height:12px;background:' + _resBarColor + ';border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Patients</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;font-weight:700;color:var(--bright);margin-left:8px;">Active Cohort</div>';
            _innerCard.insertBefore(_rppMH, _innerCard.firstChild);
          }
        }

        // ── MODULE 7: Advanced Analytics Accordion ────────────────────────
        // Groups PE Domain, APE, Stratification, NLQ, Trajectories (+ Benchmarking for PI)
        // Physically moves HEOR panels inside accordion for clean containment.
        // Re-login cleanup (above) moves them back out before removing old accordion.
        const _heorIds = ['pe-domain-panel','ape-panel','strat-panel','nlq-panel','traj-panel'];
        const _heorVisible = _heorIds.filter(function(id) {
          const el = document.getElementById(id);
          return el && el.style.display !== 'none';
        });
        const _benchElR = document.getElementById('bench-panel');
        const _benchVisible = _benchElR && _benchElR.style.display !== 'none';

        if (_heorVisible.length > 0 || _benchVisible) {
          const _firstHEOR = document.getElementById(_heorVisible[0] || 'bench-panel');
          if (_firstHEOR && _firstHEOR.parentNode) {
            const _advAcc = document.createElement('div');
            _advAcc.id = 'res-advanced-accordion';
            _advAcc.style.cssText = 'background:var(--card);border:1px solid var(--border);border-left:3px solid ' + _resBorderColor + ';border-radius:12px;overflow:hidden;margin-bottom:10px;';
            _advAcc.innerHTML =
              '<button onclick="(function(btn){var b=document.getElementById(\'res-adv-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-adv-tog\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
                '<div style="width:3px;height:14px;background:' + _resBarColor + ';border-radius:2px;flex-shrink:0;"></div>' +
                '<div style="flex:1;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · HEOR</div>' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Advanced Analytics</div>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;color:var(--dim);margin-right:8px;">PE Domain · APE · Stratification · NLQ · Trajectories</div>' +
                '<div class="res-adv-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▼</div>' +
              '</button>' +
              '<div id="res-adv-body" style="border-top:1px solid var(--border);"></div>';
            _firstHEOR.parentNode.insertBefore(_advAcc, _firstHEOR);
            const _advBody = document.getElementById('res-adv-body');
            // Move HEOR panels into accordion
            _heorIds.forEach(function(id) {
              const el = document.getElementById(id);
              if (el) _advBody.appendChild(el);
            });
            // Move bench-panel if visible (PI-gated)
            if (_benchElR && _benchVisible) _advBody.appendChild(_benchElR);
          }
        }

        // ── MODULE 8: Study Registry — block banner ───────────────────────
        // Inject collapsible Study Registry module after the analytics panel
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-registry')) return; // already injected

          var _regMod = document.createElement('div');
          _regMod.id = 'res-mod-registry';
          _regMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _regMod.innerHTML =
            '<button onclick="(function(btn){var b=document.getElementById(\'res-reg-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-reg-tog\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitRegistry===\'function\')stuInitRegistry(\'res-registry-content\');})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#059669;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Research</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Study Registry</div>' +
              '</div>' +
              '<div id="res-registry-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.22);color:#059669;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>' +
              '<div class="res-reg-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-reg-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">' +
              '<div id="res-registry-content" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.74rem;color:var(--dim);text-align:center;padding:14px 0;">Loading registry status…</div>' +
            '</div>';

          _target.parentNode.insertBefore(_regMod, _target);
        })();

        // ── MODULE 9: Predictor Analysis — block banner ────────────────────
        // OLS regression: outcome vs age, gender, condition, country
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-predictor')) return;

          var _predMod = document.createElement('div');
          _predMod.id = 'res-mod-predictor';
          _predMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _predMod.innerHTML =
            '<button onclick="(function(btn){var b=document.getElementById(\'res-pred-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-pred-tog\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitPredictor===\'function\')stuInitPredictor();})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#d97706;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Statistics</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Predictor Analysis</div>' +
              '</div>' +
              '<div id="stu-predictor-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.22);color:#d97706;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>' +
              '<div class="res-pred-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-pred-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">' +
              // Gate
              '<div id="stu-predictor-gate" style="display:none;background:rgba(217,119,6,0.07);border:1px solid rgba(217,119,6,0.22);border-radius:8px;padding:13px 16px;margin-bottom:14px;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;font-weight:700;color:#d97706;margin-bottom:3px;">Minimum Sample Required</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.64rem;color:var(--muted);">OLS regression requires at least 10 records. Collect more assessments to unlock.</div>' +
              '</div>' +
              // Controls
              '<div id="stu-predictor-controls">' +
                '<div style="margin-bottom:14px;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Outcome Variable</div>' +
                  '<div style="display:flex;gap:6px;">' +
                    '<button id="stu-pred-out-mmas" class="stu-pred-out-btn" data-out="mmas" onclick="stuPredSelectOutcome(\'mmas\')" style="flex:1;padding:7px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;transition:all 0.15s;">MMAS-8 Score</button>' +
                    '<button id="stu-pred-out-map" class="stu-pred-out-btn" data-out="map" onclick="stuPredSelectOutcome(\'map\')" style="flex:1;padding:7px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">MAP PE Score</button>' +
                  '</div>' +
                '</div>' +
                '<div style="margin-bottom:14px;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Predictor Variables</div>' +
                  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
                    '<label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;"><input type="checkbox" id="stu-pred-age" checked style="accent-color:#d97706;"> Age</label>' +
                    '<label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;"><input type="checkbox" id="stu-pred-gender" checked style="accent-color:#d97706;"> Gender</label>' +
                    '<label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;"><input type="checkbox" id="stu-pred-condition" checked style="accent-color:#d97706;"> Condition</label>' +
                    '<label style="display:flex;align-items:center;gap:7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;color:var(--muted);cursor:pointer;background:var(--card2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;"><input type="checkbox" id="stu-pred-country" style="accent-color:#d97706;"> Country</label>' +
                  '</div>' +
                '</div>' +
                '<button onclick="stuRunPredictor()" style="width:100%;padding:9px;font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:#d97706;color:#fff;border:none;border-radius:7px;cursor:pointer;">Run Analysis</button>' +
              '</div>' +
              // Results
              '<div id="stu-predictor-results" style="display:none;margin-top:16px;">' +
                '<div id="stu-predictor-table-wrap"></div>' +
                '<div id="stu-predictor-apa" style="margin-top:12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:13px 15px;font-family:\'IBM Plex Mono\',monospace;font-size:0.67rem;color:var(--muted);line-height:1.7;white-space:pre-wrap;"></div>' +
                '<button onclick="stuCopyPredictorAPA()" style="margin-top:8px;padding:6px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:6px;cursor:pointer;">Copy APA Paragraph</button>' +
              '</div>' +
            '</div>';

          _target.parentNode.insertBefore(_predMod, _target);
        })();

        // ── MODULE 10: APA Methods + Results Generator ────────────────────
        // Generates full APA 7th edition Methods and Results paragraphs from live cohort data.
        // Reuses _stuBuildMapResults / _stuBuildMmasResults / _stuBuildPeacsResults from student-workspace.js.
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-apa-gen')) return;

          var _apaMod = document.createElement('div');
          _apaMod.id = 'res-mod-apa-gen';
          _apaMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _apaMod.innerHTML =
            '<button onclick="(function(btn){var b=document.getElementById(\'res-apa-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-apa-tog\').textContent=open?\'▶\':\'▼\';if(!open)resInitApaGen();})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#8b6ff5;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Writing</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">APA Methods + Results Generator</div>' +
              '</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--dim);margin-right:8px;">Publication-ready paragraphs · Copy-paste ready</div>' +
              '<div class="res-apa-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-apa-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">' +
              // Tab bar
              '<div style="display:flex;gap:6px;border-bottom:1px solid var(--border);margin-bottom:16px;">' +
                '<button class="res-apa-tab" data-t="map"   onclick="resApaTab(\'map\')"   style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:8px 14px;background:none;border:none;border-bottom:2px solid #7c3aed;color:var(--bright);cursor:pointer;margin-bottom:-1px;">MAP</button>' +
                '<button class="res-apa-tab" data-t="mmas"  onclick="resApaTab(\'mmas\')"  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;color:var(--dim);cursor:pointer;margin-bottom:-1px;">MMAS-8</button>' +
                '<button class="res-apa-tab" data-t="peacs" onclick="resApaTab(\'peacs\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;color:var(--dim);cursor:pointer;margin-bottom:-1px;">PEACS</button>' +
              '</div>' +
              // Methods pane
              '<div id="res-apa-pane-methods" style="margin-bottom:14px;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Methods Paragraph</div>' +
                '<div id="res-apa-methods-text" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.67rem;color:var(--muted);line-height:1.7;white-space:pre-wrap;">Loading…</div>' +
                '<button onclick="resApaCopy(\'methods\')" style="margin-top:6px;padding:5px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;cursor:pointer;">Copy Methods</button>' +
              '</div>' +
              // Results pane
              '<div id="res-apa-pane-results">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.50rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">Results Paragraph</div>' +
                '<div id="res-apa-results-text" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.67rem;color:var(--muted);line-height:1.7;white-space:pre-wrap;">Loading…</div>' +
                '<button onclick="resApaCopy(\'results\')" style="margin-top:6px;padding:5px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:5px;cursor:pointer;">Copy Results</button>' +
              '</div>' +
            '</div>';

          _target.parentNode.insertBefore(_apaMod, _target);
        })();

        // ── MODULE 11: Sample Size Advisor ────────────────────────────────
        // Bonett (2002) SE approximation for Cronbach's α CI on MAP data.
        // Reuses stuInitPowerAdvisor / stuRunPowerAdvisor from student-workspace.js.
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-power')) return;

          var _pwrMod = document.createElement('div');
          _pwrMod.id = 'res-mod-power';
          _pwrMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _pwrMod.innerHTML =
            '<button onclick="(function(btn){var b=document.getElementById(\'res-power-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-pwr-tog\').textContent=open?\'▶\':\'▼\';if(!open&&typeof stuInitPowerAdvisor===\'function\')stuInitPowerAdvisor();})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#0891b2;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Power</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Sample Size Advisor</div>' +
              '</div>' +
              '<div id="stu-power-badge" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(8,145,178,0.08);border:1px solid rgba(8,145,178,0.22);color:#0891b2;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>' +
              '<div class="res-pwr-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-power-body" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">' +
              // Stat strip
              '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">' +
                '<div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid #0891b2;border-radius:8px;padding:11px 13px;text-align:center;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">MAP Records</div>' +
                  '<div id="stu-power-n" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:var(--bright);line-height:1;">—</div>' +
                '</div>' +
                '<div style="background:rgba(8,145,178,0.08);border:1px solid rgba(8,145,178,0.20);border-top:2px solid #0891b2;border-radius:8px;padding:11px 13px;text-align:center;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Cronbach\'s α</div>' +
                  '<div id="stu-power-alpha" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:var(--bright);line-height:1;">—</div>' +
                '</div>' +
                '<div style="background:rgba(8,145,178,0.08);border:1px solid rgba(8,145,178,0.20);border-top:2px solid #0891b2;border-radius:8px;padding:11px 13px;text-align:center;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">95% CI Lower</div>' +
                  '<div id="stu-power-ci-lower" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:var(--bright);line-height:1;">—</div>' +
                '</div>' +
              '</div>' +
              // Target selector
              '<div style="margin-bottom:12px;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Target α</div>' +
                '<div style="display:flex;gap:6px;">' +
                  '<button class="stu-pwr-tgt" data-t="0.80" onclick="stuRunPowerAdvisor(0.80)" style="flex:1;padding:6px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid #0891b2;background:#0891b2;color:#fff;cursor:pointer;">.80</button>' +
                  '<button class="stu-pwr-tgt" data-t="0.85" onclick="stuRunPowerAdvisor(0.85)" style="flex:1;padding:6px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;">.85</button>' +
                  '<button class="stu-pwr-tgt" data-t="0.90" onclick="stuRunPowerAdvisor(0.90)" style="flex:1;padding:6px;font-family:\'IBM Plex Mono\',monospace;font-size:0.66rem;border-radius:6px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;">.90</button>' +
                '</div>' +
              '</div>' +
              '<div id="stu-power-result" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.67rem;color:var(--muted);line-height:1.7;"></div>' +
            '</div>';

          _target.parentNode.insertBefore(_pwrMod, _target);
        })();

        // ── MODULE 12: Cohort Map ─────────────────────────────────────────
        // Embedded MapBox globe scoped to the researcher's own cohort.
        // Mirrors student MODULE 12 but uses res-* IDs and resMap* functions.
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-cohort-map')) return;

          var _mapMod = document.createElement('div');
          _mapMod.id = 'res-mod-cohort-map';
          _mapMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _mapMod.innerHTML =
            '<button onclick="resToggleCohortMap(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#0891b2;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Geospatial</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Cohort Map</div>' +
              '</div>' +
              '<div id="res-cohort-map-count" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;background:rgba(8,145,178,0.07);border:1px solid rgba(8,145,178,0.18);color:#0891b2;border-radius:20px;padding:2px 10px;margin-right:8px;"></div>' +
              '<div id="res-cohort-map-toggle-icon" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-mod-cohort-map-body" style="display:none;border-top:1px solid var(--border);">' +
              // Controls
              '<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.05);flex-wrap:wrap;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;color:var(--dim);flex-shrink:0;">Show:</div>' +
                '<button class="res-map-filter-btn active" data-filter="all"    onclick="resMapFilter(\'all\')"    style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:#0891b2;color:#fff;border:1px solid #0891b2;cursor:pointer;transition:all 0.15s;">All</button>' +
                '<button class="res-map-filter-btn"        data-filter="map"    onclick="resMapFilter(\'map\')"    style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">MAP</button>' +
                '<button class="res-map-filter-btn"        data-filter="mmas"   onclick="resMapFilter(\'mmas\')"   style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">MMAS-8</button>' +
                '<button class="res-map-filter-btn"        data-filter="peacs"  onclick="resMapFilter(\'peacs\')"  style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">PEACS</button>' +
                '<button class="res-map-filter-btn"        data-filter="atrisk" onclick="resMapFilter(\'atrisk\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;padding:4px 10px;border-radius:5px;background:var(--card2);color:var(--muted);border:1px solid var(--border2);cursor:pointer;transition:all 0.15s;">At Risk</button>' +
                '<div style="margin-left:auto;font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--dim);" id="res-map-marker-count"></div>' +
              '</div>' +
              // Legend
              '<div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(0,0,0,0.05);flex-wrap:wrap;">' +
                '<div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">High / Optimal</span></div>' +
                '<div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Medium</span></div>' +
                '<div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">Low / At Risk</span></div>' +
                '<div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#7c3aed;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">PEACS Complete</span></div>' +
                '<div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:50%;background:#94a3b8;flex-shrink:0;"></div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.58rem;color:var(--muted);">No coordinates</span></div>' +
              '</div>' +
              // Map container — taller than student version
              '<div id="res-cohort-mapbox" style="height:400px;border-radius:0;"></div>' +
              // Fallback country list
              '<div id="res-cohort-map-fallback" style="display:none;padding:14px 16px;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Cohort by Country / Region</div>' +
                '<div id="res-cohort-country-list" style="display:flex;flex-wrap:wrap;gap:6px;"></div>' +
              '</div>' +
            '</div>';

          _target.parentNode.insertBefore(_mapMod, _target);
        })();

        // ── MODULE · Psychometric Analysis — researcher / PI card ─────────────
        (function() {
          var _target = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
          if (!_target || !_target.parentNode) return;
          if (document.getElementById('res-mod-psycho')) return;

          var _psychoMod = document.createElement('div');
          _psychoMod.id = 'res-mod-psycho';
          _psychoMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _psychoMod.innerHTML =
            '<button onclick="(function(btn){var b=document.getElementById(\'res-psycho-body-wrap\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';btn.querySelector(\'.res-psycho-tog\').textContent=open?\'▶\':\'▼\';if(!open&&typeof resInitPsychoStats===\'function\')resInitPsychoStats();})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#b45309;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Statistics</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Psychometric Analysis</div>' +
              '</div>' +
              '<div class="res-psycho-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-psycho-body-wrap" style="display:none;border-top:1px solid var(--border);padding:18px 20px 22px;">' +
              '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">' +
                '<button class="res-psycho-sub-btn" data-sub="reliability"    onclick="resPsychoSwitchSub(\'reliability\')"    style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid rgba(180,83,9,0.38);background:rgba(180,83,9,0.08);color:#b45309;cursor:pointer;transition:all 0.15s;">Reliability</button>' +
                '<button class="res-psycho-sub-btn" data-sub="classification" onclick="resPsychoSwitchSub(\'classification\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Classification</button>' +
                '<button class="res-psycho-sub-btn" data-sub="effectsize"     onclick="resPsychoSwitchSub(\'effectsize\')"     style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Effect Size</button>' +
                '<button class="res-psycho-sub-btn" data-sub="methods"        onclick="resPsychoSwitchSub(\'methods\')"        style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 13px;border-radius:5px;border:1px solid var(--border2);background:var(--card2);color:var(--muted);cursor:pointer;transition:all 0.15s;">Methods</button>' +
              '</div>' +
              '<div id="res-psycho-body" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:var(--dim);">Loading…</div>' +
            '</div>';

          _target.parentNode.insertBefore(_psychoMod, _target);
        })();

        // ── MODULE 13: Records & Compliance — block banner wrapper ───────────
        // Wraps the shared mc-records-panel in a collapsible researcher block banner.
        // Hides the duplicate MMAS stat row (covered by Cohort Snapshot + APA Generator).
        // Hides the internal ▼ Records toggle; outer banner controls open/close.
        (function() {
          var _panel = document.getElementById('mc-records-panel');
          if (!_panel) return;
          if (document.getElementById('res-records-banner')) return;

          // Define toggle function
          window.resToggleRecords = function() {
            var body = document.getElementById('res-records-body-outer');
            var icon = document.getElementById('res-records-toggle-icon');
            if (!body) return;
            var open = body.style.display !== 'none';
            body.style.display = open ? 'none' : '';
            if (icon) icon.textContent = open ? '▶' : '▼';
          };

          // Build wrapper
          var _wrapper = document.createElement('div');
          _wrapper.id = 'res-records-banner';
          _wrapper.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
          _wrapper.innerHTML =
            '<button onclick="resToggleRecords()" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
              '<div style="width:3px;height:14px;background:#0891b2;border-radius:2px;flex-shrink:0;"></div>' +
              '<div style="flex:1;">' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.55rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:1px;">Module 13</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Records &amp; Compliance</div>' +
              '</div>' +
              '<div id="res-records-toggle-icon" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
            '</button>' +
            '<div id="res-records-body-outer" style="display:none;border-top:1px solid var(--border);"></div>';

          // Insert wrapper before panel, then move panel inside
          _panel.parentNode.insertBefore(_wrapper, _panel);
          var _bodyOuter = document.getElementById('res-records-body-outer');
          _bodyOuter.appendChild(_panel);

          // Strip mc-records-panel's own border/radius — wrapper provides them
          _panel.style.background   = 'none';
          _panel.style.border       = 'none';
          _panel.style.borderRadius = '0';
          _panel.style.margin       = '0';

          // Always show records body when outer banner is open
          var _mcBody = document.getElementById('mc-records-body');
          if (_mcBody) _mcBody.style.display = '';

          // Hide inner toggle btn — outer banner handles expand/collapse
          var _innerToggle = document.getElementById('mc-records-toggle-btn');
          if (_innerToggle) _innerToggle.style.display = 'none';

          // Hide duplicate MMAS stats row — covered by Cohort Snapshot + APA Generator
          var _statRow = document.querySelector('#mc-rtab-mmas .stat-row');
          if (_statRow) _statRow.style.display = 'none';
        })();

        // ── MODULE 14: PI Research Panel — card styling ────────────────────
        if (_isPiWs) {
          const _piPanelR = document.getElementById('pi-research-panel');
          if (_piPanelR && _piPanelR.style.display !== 'none') {
            _piPanelR.style.background   = 'var(--card)';
            _piPanelR.style.border       = '1px solid rgba(212,168,67,0.25)';
            _piPanelR.style.borderLeft   = '3px solid rgba(212,168,67,0.5)';
            _piPanelR.style.borderRadius = '12px';
            _piPanelR.style.overflow     = 'hidden';
            _piPanelR.style.marginBottom = '10px';
          }
        }

        // ── MODULE 15: Validation & Reliability (PI only) ──────────────────
        // Injects the psychometric validation panel: Cronbach α, domain reliability,
        // corrected item-total correlations, and MAP vs MMAS-8 convergent validity.
        // Reuses stu-val-* IDs — safe because PI and student are mutually exclusive.
        if (_isPiWs) {
          (function() {
            if (document.getElementById('res-mod-validation')) return;
            var _vtarget = document.getElementById('researcher-patient-panel') || document.getElementById('res-analytics-panel');
            if (!_vtarget || !_vtarget.parentNode) return;

            var _valMod = document.createElement('div');
            _valMod.id = 'res-mod-validation';
            _valMod.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;';
            _valMod.innerHTML =
              '<button onclick="(function(btn){var b=document.getElementById(\'res-val-body\');var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'\';btn.querySelector(\'.res-val-tog\').textContent=open?\'▶\':\'▼\';})(this)" style="width:100%;padding:13px 20px;text-align:left;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
                '<div style="width:3px;height:14px;background:#475569;border-radius:2px;flex-shrink:0;"></div>' +
                '<div style="flex:1;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--dim);">' + _resRoleLabel + ' · Validation</div>' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;font-weight:700;color:var(--bright);margin-top:1px;">Validation &amp; Reliability</div>' +
                '</div>' +
                '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;color:var(--dim);margin-right:8px;">Cronbach α · Item correlations · Convergent validity</div>' +
                '<div class="res-val-tog" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);">▶</div>' +
              '</button>' +
              '<div id="res-val-body" style="display:none;border-top:1px solid var(--border);">' +
                '<div id="stu-val-placeholder" style="padding:20px 24px;text-align:center;">' +
                  '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:var(--dim);line-height:1.9;">Collect ≥ 10 MAP assessments to unlock psychometric statistics.<br>Results auto-update as your cohort grows.</div>' +
                '</div>' +
                '<div id="stu-validation-panel" style="display:none;padding:20px 24px;">' +
                  '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:12px;margin-bottom:20px;align-items:start;">' +
                    '<div style="background:var(--card2);border:1px solid var(--border);border-top:3px solid #475569;border-radius:9px;padding:14px 20px;text-align:center;min-width:100px;">' +
                      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Cronbach α · MAP</div>' +
                      '<div id="stu-val-alpha" style="font-family:\'IBM Plex Mono\',monospace;font-size:2.2rem;font-weight:700;color:var(--bright);line-height:1;letter-spacing:-0.03em;">—</div>' +
                      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--dim);margin-top:4px;">8 items · N=<span id="stu-val-map-n">—</span></div>' +
                    '</div>' +
                    '<div style="background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.15);border-top:3px solid #d4a843;border-radius:9px;padding:14px 16px;">' +
                      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:#b45309;margin-bottom:8px;">Architecture · Q2 Q3 Q6</div>' +
                      '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">' +
                        '<span id="stu-val-arch-val" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.5rem;font-weight:700;color:#d4a843;line-height:1;">—</span>' +
                        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:#b45309;">avg domain score</span>' +
                      '</div>' +
                      '<div style="height:5px;background:rgba(212,168,67,0.12);border-radius:3px;overflow:hidden;">' +
                        '<div id="stu-val-arch-bar" style="height:100%;width:0%;background:#d4a843;border-radius:3px;transition:width 0.6s;"></div>' +
                      '</div>' +
                      '<div style="display:flex;justify-content:space-between;margin-top:4px;">' +
                        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;color:var(--dim);">α=</span>' +
                        '<span id="stu-val-alpha-arch" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:#b45309;font-weight:700;">—</span>' +
                      '</div>' +
                    '</div>' +
                    '<div style="background:rgba(37,99,235,0.07);border:1px solid rgba(78,156,245,0.15);border-top:3px solid #4e9cf5;border-radius:9px;padding:14px 16px;">' +
                      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.48rem;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">Execution · Q1 Q4 Q5 Q8</div>' +
                      '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">' +
                        '<span id="stu-val-exec-val" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.5rem;font-weight:700;color:#4e9cf5;line-height:1;">—</span>' +
                        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:#2563eb;">avg domain score</span>' +
                      '</div>' +
                      '<div style="height:5px;background:rgba(78,156,245,0.12);border-radius:3px;overflow:hidden;">' +
                        '<div id="stu-val-exec-bar" style="height:100%;width:0%;background:#4e9cf5;border-radius:3px;transition:width 0.6s;"></div>' +
                      '</div>' +
                      '<div style="display:flex;justify-content:space-between;margin-top:4px;">' +
                        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;color:var(--dim);">α=</span>' +
                        '<span id="stu-val-alpha-exec" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:#2563eb;font-weight:700;">—</span>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:14px 16px;margin-bottom:16px;">' +
                    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">Corrected Item-Total Correlations (r<sub>it</sub>)</div>' +
                    '<div style="display:flex;flex-direction:column;gap:5px;" id="stu-val-itc-grid">' +
                      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--dim);">Populating…</div>' +
                    '</div>' +
                  '</div>' +
                  '<div style="background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.12);border-radius:9px;padding:14px 16px;">' +
                    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:#059669;margin-bottom:12px;">Convergent Validity · MAP vs MMAS-8 · N=<span id="stu-val-mmas-n">—</span> MMAS · <span id="stu-val-paired-n">—</span> matched pairs</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">' +
                      '<div style="text-align:center;">' +
                        '<div id="stu-val-r" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>' +
                        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">Pearson r</div>' +
                      '</div>' +
                      '<div style="text-align:center;">' +
                        '<div id="stu-val-agree-pct" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#059669;line-height:1;">—</div>' +
                        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">Pattern agreement</div>' +
                      '</div>' +
                      '<div style="text-align:center;">' +
                        '<div id="stu-val-extra-pct" style="font-family:\'IBM Plex Mono\',monospace;font-size:1.6rem;font-weight:700;color:#d97706;line-height:1;">—</div>' +
                        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--muted);margin-top:3px;">MAP detects extra non-adh</div>' +
                      '</div>' +
                    '</div>' +
                    '<div id="stu-val-ctx-val" style="display:none;"></div>' +
                    '<div id="stu-val-ctx-bar" style="display:none;"></div>' +
                    '<div style="margin-top:10px;font-family:\'IBM Plex Mono\',monospace;font-size:0.56rem;color:var(--dim);line-height:1.7;">Requires same patient_number collected on both MAP and MMAS-8. Pearson r = convergent validity coefficient. Pattern agreement = % patients classified identically by both instruments.</div>' +
                  '</div>' +
                  '<div style="margin-top:12px;text-align:right;">' +
                    '<button onclick="_stuExportValidationBundle()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.10em;text-transform:uppercase;background:var(--card2);border:1px solid var(--border2);color:var(--muted);border-radius:7px;padding:6px 14px;cursor:pointer;" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f8fafc\'">↓ Export Paired Validation Dataset</button>' +
                  '</div>' +
                '</div>' +
              '</div>';

            _vtarget.parentNode.insertBefore(_valMod, _vtarget);
          })();
        }

        // ── ATLAS TAB RAIL — schedule post-init install ─────────────────────
        // Runs at 800ms so sentinel-panel (injected at 600ms) already exists.
        if (_isPiWs) {
          var _piRailColor = _resBarColor; // '#d4a843'
          var PI_RAIL_TABS = [
            { id: 'overview',     icon: '⌂', label: 'Overview',
              elements: ['session-launcher-panel', 'dash-pulse-bar-ref'] },
            { id: 'studies',      icon: '◈', label: 'Studies',
              elements: ['pi-research-panel', 'res-mod-registry'] },
            { id: 'analytics',    icon: '∿', label: 'Analytics',
              elements: ['res-analytics-panel', 'res-advanced-accordion'] },
            { id: 'validation',   icon: '◇', label: 'Validation',
              elements: ['res-mod-validation'] },
            { id: 'publications', icon: '✦', label: 'Publications',
              elements: ['res-mod-apa-gen', 'res-mod-predictor', 'res-mod-power'] },
            { id: 'statistics',   icon: '∑', label: 'Statistics',
              elements: ['res-mod-psycho'] },
            { id: 'records',      icon: '≡', label: 'Records',
              elements: ['res-records-banner', 'res-mod-cohort-map', 'researcher-patient-panel'] },
            { id: 'admin',        icon: '⊘', label: 'Admin',
              elements: ['study-title-nudge', 'res-tools-bar'] },
          ];
          setTimeout(function() {
            if (typeof window._atlasInstallRail === 'function') {
              window._atlasInstallRail(PI_RAIL_TABS, _piRailColor);
            }
          }, 800);
        } else {
          // ── Researcher (non-PI) rail ─────────────────────────────────────
          var RES_RAIL_TABS = [
            { id: 'overview',     icon: '⌂', label: 'Overview',
              elements: ['session-launcher-panel', 'dash-pulse-bar-ref'] },
            { id: 'analytics',    icon: '∿', label: 'Analytics',
              elements: ['res-analytics-panel', 'res-advanced-accordion'] },
            { id: 'publications', icon: '✦', label: 'Publications',
              elements: ['res-mod-apa-gen', 'res-mod-predictor', 'res-mod-power'] },
            { id: 'statistics',   icon: '∑', label: 'Statistics',
              elements: ['res-mod-psycho'] },
            { id: 'records',      icon: '≡', label: 'Records',
              elements: ['res-records-banner', 'res-mod-cohort-map', 'researcher-patient-panel'] },
            { id: 'research',     icon: '◈', label: 'Research',
              elements: ['res-mod-registry', 'res-tools-bar'] },
          ];
          setTimeout(function() {
            if (typeof window._atlasInstallRail === 'function') {
              window._atlasInstallRail(RES_RAIL_TABS, _resBarColor);
            }
          }, 800);
        }

      }
    }
  }
  } catch(e) { console.warn('[ATLAS] Researcher modularization error (non-fatal):', e); }

  // ── ATLAS TAB RAIL ENGINE ────────────────────────────────────────────────────
  // Generic left-rail installer shared across roles. Called via setTimeout so all
  // async-injected panels (sentinel, etc.) are present before reorganization.
  // tabs = [{ id, icon, label, elements:[id,...] }]
  // accentColor = role accent hex string
  window._atlasInstallRail = function(tabs, accentColor, opts) {
    opts = opts || {};
    var headerId = opts.headerId || 'res-ws-header';

    var db = document.querySelector('#screen-dashboard .dash-body');
    if (!db || document.getElementById('atlas-rail-wrapper')) return;

    // ── 1. Strip dash-body spacing — rail controls layout ─────────────────
    db.style.padding = '0';
    db.style.gap     = '0';

    // ── 2. Header becomes a flat full-width top bar ────────────────────────
    // Hoist to db if nested inside another element (e.g. student-dash-panel)
    var hdr = document.getElementById(headerId);
    if (hdr) {
      if (hdr.parentNode !== db) db.insertBefore(hdr, db.firstChild);
      hdr.style.margin       = '0';
      hdr.style.borderRadius = '0';
      hdr.style.border       = 'none';
      hdr.style.borderBottom = '1px solid var(--border)';
      hdr.style.flexShrink   = '0';
    }

    // ── 3. Sentinel stays pinned below header (persistent triage) ─────────
    var sentinel = document.getElementById('sentinel-panel');
    if (sentinel && sentinel.parentNode === db) {
      sentinel.style.margin     = '0';
      sentinel.style.flexShrink = '0';
      // Move it to immediately after the header
      if (hdr && hdr.parentNode === db && hdr.nextSibling !== sentinel) {
        db.insertBefore(sentinel, hdr.nextSibling);
      }
    }

    // ── 4. Build left nav rail ─────────────────────────────────────────────
    var nav = document.createElement('nav');
    nav.id = 'atlas-rail-nav';
    nav.style.cssText = [
      'width:62px', 'flex-shrink:0',
      'background:var(--card)', 'border-right:1px solid var(--border)',
      'display:flex', 'flex-direction:column', 'align-items:center',
      'padding:10px 0 20px', 'gap:2px', 'overflow-y:auto',
    ].join(';');

    tabs.forEach(function(tab, i) {
      var btn = document.createElement('button');
      btn.id = 'atlas-rail-btn-' + tab.id;
      // No native title — atlasTip is wired after append (avoids clipping in overflow containers)
      btn.setAttribute('data-tab', tab.id);
      btn.onclick = function() { window.atlasTabSwitch(tab.id); };
      var isFirst = i === 0;
      btn.style.cssText = [
        'width:54px', 'height:56px', 'border-radius:8px', 'border:none',
        'background:' + (isFirst ? 'rgba(212,168,67,0.10)' : 'transparent'),
        'color:'      + (isFirst ? accentColor             : 'var(--dim)'),
        'font-size:1.05rem', 'cursor:pointer',
        'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center', 'gap:2px',
        'transition:all 0.15s',
        'box-shadow:' + (isFirst ? 'inset 2px 0 0 ' + accentColor : 'none'),
      ].join(';');
      btn.innerHTML = '<span style="font-size:1.0rem;line-height:1;">' + tab.icon + '</span>' +
        '<span style="font-family:var(--font-mono,monospace);font-size:0.44rem;letter-spacing:0.06em;text-transform:uppercase;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50px;">' + tab.label + '</span>';
      // Hover effect via dataset flag
      btn.onmouseenter = function() {
        if (window._atlasActiveTab !== tab.id) {
          this.style.background = 'rgba(255,255,255,0.04)';
          this.style.color      = 'var(--muted)';
        }
      };
      btn.onmouseleave = function() {
        if (window._atlasActiveTab !== tab.id) {
          this.style.background = 'transparent';
          this.style.color      = 'var(--dim)';
        }
      };
      nav.appendChild(btn);
      // Wire custom tooltip AFTER append so the element is in the DOM
      if (typeof atlasTip === 'function') atlasTip(btn, tab.label);
    });

    // ── 5. Build content area with tab panels ──────────────────────────────
    var content = document.createElement('div');
    content.id = 'atlas-rail-content';
    content.style.cssText = [
      'flex:1', 'overflow-y:auto',
      'padding:20px 28px 40px', 'min-width:0',
      'box-sizing:border-box',
    ].join(';');

    // Inject scoped CSS for tab panel gap (avoids touching global .dash-body gap)
    if (!document.getElementById('atlas-rail-style')) {
      var _rs = document.createElement('style');
      _rs.id = 'atlas-rail-style';
      _rs.textContent = '.atlas-tab-panel>*{margin-bottom:10px!important;}' +
        '.atlas-tab-panel>*:last-child{margin-bottom:0!important;}';
      document.head.appendChild(_rs);
    }

    tabs.forEach(function(tab, i) {
      var panel = document.createElement('div');
      panel.id = 'atlas-tab-' + tab.id;
      panel.className = 'atlas-tab-panel';
      panel.style.display = i === 0 ? '' : 'none';

      tab.elements.forEach(function(elId) {
        // Special case: dash-pulse-bar has no ID — use class selector
        var el = elId === 'dash-pulse-bar-ref'
          ? document.querySelector('#screen-dashboard .dash-pulse-bar')
          : document.getElementById(elId);
        if (el && el.parentNode) panel.appendChild(el);
      });

      content.appendChild(panel);
    });

    // ── 6. Wrapper: flex row (nav + content) ──────────────────────────────
    var wrapper = document.createElement('div');
    wrapper.id = 'atlas-rail-wrapper';
    wrapper.style.cssText = [
      'display:flex', 'flex-direction:row',
      'flex:1', 'min-height:0', 'overflow:hidden', 'width:100%',
    ].join(';');
    wrapper.appendChild(nav);
    wrapper.appendChild(content);

    // ── 7. Anchor wrapper after sentinel (or header if no sentinel) ────────
    var _anchor = sentinel && sentinel.parentNode === db ? sentinel : hdr;
    if (_anchor && _anchor.nextSibling) {
      db.insertBefore(wrapper, _anchor.nextSibling);
    } else {
      db.appendChild(wrapper);
    }

    // ── 8. Hide any remaining db direct children (not header/sentinel/rail)
    Array.from(db.children).forEach(function(child) {
      var id = child.id || '';
      if (id !== headerId && id !== 'sentinel-panel' && id !== 'atlas-rail-wrapper') {
        child.style.display = 'none';
      }
    });

    window._atlasActiveTab  = tabs[0].id;
    window._atlasRailColor  = accentColor;
    window._atlasRailTabs   = tabs;
    console.log('[ATLAS] Tab rail installed · role:', window._atlasRailRole, '· tabs:', tabs.length);
  };
  // ── END ATLAS TAB RAIL ENGINE ────────────────────────────────────────────

  showScreen('screen-dashboard');
  setTimeout(maybeShowOnboardingTour, 800);

  // For Explorer/anonymous: guard loadDashboardData until Firebase auth is ready.
  // Without this, the reads fire before anonymous auth completes and return empty data.
  const _ws = (currentWorkspace || '').toUpperCase();
  if ((_ws === 'EXPLORER' || !currentWorkspace) && !firebase.auth().currentUser) {
    let _loaded = false;
    const _unsub = firebase.auth().onAuthStateChanged(function(u) {
      if (u && !_loaded) { _loaded = true; _unsub(); loadDashboardData(); }
    });
    setTimeout(() => { if (!_loaded) { _loaded = true; loadDashboardData(); } }, 4000);
  } else {
    loadDashboardData();
  }

  setTimeout(initDashMiniMaps, 250);
  setTimeout(initMTMAuditPanel, 600);
  setTimeout(initDailyIntakePanel, 700);
  setTimeout(initMTMTimerPanel, 650);
  // PI hard-lock: force MTM panels hidden well after all init timeouts have fired
  if (isPIMode()) {
    setTimeout(() => {
      const _tp = document.getElementById('mtm-timer-panel');
      const _ap = document.getElementById('mtm-audit-panel');
      if (_tp) _tp.style.display = 'none';
      if (_ap) _ap.style.display = 'none';
    }, 1200);
  }
  setTimeout(() => document.dispatchEvent(new CustomEvent('atlas:workspace-ready')), 400);
}

// ── CFR-11 §11.10(f) — 30-minute inactivity session timeout ──────────────────
(function() {
  var TIMEOUT_MS = 30 * 60 * 1000;
  var _idleTimer;
  function _resetIdle() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(function() {
      var user = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
      if (!user) return;
      if (typeof database !== 'undefined') {
        database.ref('audit_log').push({
          cfr11: true, action: 'SESSION_TIMEOUT',
          actor_uid: user.uid, actor_email: user.email,
          timestamp_utc: new Date().toISOString(), client_ts: Date.now(), table: 'session'
        }).catch(function(){});
      }
      firebase.auth().signOut().then(function() {
        var base = window.location.pathname || '/';
        window.location.href = base + '?session=timeout';
      });
    }, TIMEOUT_MS);
  }
  ['click','keydown','mousemove','scroll','touchstart'].forEach(function(ev) {
    document.addEventListener(ev, _resetIdle, { passive: true });
  });
  _resetIdle();
})();

function loadGlobalContextStats() {
  // MMAS global
  database.ref('assessments').once('value', snap => {
    const all = snap.val();
    const records = all ? Object.values(all) : [];
    const total = records.length;
    const countries = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
    const avg = total > 0 ? (records.reduce((s,r)=>s+(r.score||0),0)/total).toFixed(2) : '—';
    const t = document.getElementById('mc-global-mmas-total');
    const co = document.getElementById('mc-global-mmas-countries');
    const av = document.getElementById('mc-global-mmas-avg');
    if (t) t.textContent  = total.toLocaleString();
    if (co) co.textContent = countries;
    if (av) av.textContent = avg;
  });
  // PEACS global
  database.ref('peacs_assessments').once('value', snap => {
    const all = snap.val();
    const records = all ? Object.values(all) : [];
    const total = records.length;
    const countries = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
    const avg = total > 0 ? (records.reduce((s,r)=>s+(r.pe||0),0)/total).toFixed(3) : '—';
    const t = document.getElementById('mc-global-peacs-total');
    const co = document.getElementById('mc-global-peacs-countries');
    const av = document.getElementById('mc-global-peacs-avg');
    if (t) t.textContent  = total.toLocaleString();
    if (co) co.textContent = countries;
    if (av) av.textContent = avg;
  });
}

