'use strict';
const https  = require('https');
const crypto = require('crypto');
const admin  = require('firebase-admin');

// ── Firebase Admin (shared with other Lambda functions) ───────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    )
  });
}
const db = admin.database();

// ── Constants ─────────────────────────────────────────────────────────────────
const ALLOWED_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-opus-4-7', 'claude-opus-4-8'];
const MAX_TOKENS_CAP = 4096;
const ALLOWED_ORIGINS = ['https://atlas.adherence.cc', 'https://www.adherence.cc', 'http://localhost'];

// ── CORS helpers ──────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.find(o => (origin || '').startsWith(o)) || ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResp(statusCode, data, headers) {
  return {
    statusCode,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}

// ── Anthropic proxy helper ────────────────────────────────────────────────────
function callAnthropic(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Token validation helper ───────────────────────────────────────────────────
/**
 * Validates the Firebase ID token from the Authorization header.
 * Returns the decoded token or throws with a human-readable message.
 */
async function verifyBearerToken(event) {
  const authHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  try {
    return await admin.auth().verifyIdToken(token);
  } catch(e) {
    throw Object.assign(new Error('Invalid or expired token: ' + e.message), { statusCode: 401 });
  }
}

// ── Key generation helper ─────────────────────────────────────────────────────
function generateSubKey(institutionWorkspace) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const year   = new Date().getFullYear();
  // e.g. INST-UNIV-ABC12-2026
  return `${institutionWorkspace}-${suffix}-${year}`;
}

// ── /inst/list-members ────────────────────────────────────────────────────────
/**
 * Lists all sub-workspace keys whose parent_institution matches the caller's
 * workspace. Requires role === 'institution' OR 'superadmin'.
 */
async function handleInstListMembers(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin') {
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  }
  if (!workspace) {
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);
  }

  try {
    // Query workspaces where parent_institution equals the caller's workspace key
    const snap = await db.ref('workspaces')
      .orderByChild('parent_institution')
      .equalTo(workspace)
      .once('value');

    const keys = [];
    if (snap.val()) {
      snap.forEach(child => {
        const profile = child.val();
        keys.push({
          key:          child.key,
          name:         profile.name         || null,
          email:        profile.email        || null,
          role:         profile.role         || null,
          expiry:       profile.expiry       || null,
          lastActive:   profile.lastActive   || profile.last_active || null,
          parent_inst:  profile.parent_institution || workspace,
          active:       profile.active !== false
        });
      });
    }

    return jsonResp(200, { keys }, headers);
  } catch(e) {
    console.error('[inst/list-members] Firebase error:', e.message);
    return jsonResp(502, { error: 'Database error: ' + e.message }, headers);
  }
}

// ── /inst/provision-key ───────────────────────────────────────────────────────
/**
 * Creates a new sub-workspace key under the caller's institution.
 * Sets parent_institution = caller's workspace on the new key's profile.
 * Requires role === 'institution' OR 'superadmin'.
 */
async function handleInstProvisionKey(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin') {
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  }
  if (!workspace) {
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { fname, lname, email, role: memberRole, expiry } = body;

  if (!email || !email.includes('@')) {
    return jsonResp(400, { error: 'Valid email is required' }, headers);
  }
  if (!memberRole) {
    return jsonResp(400, { error: 'role is required' }, headers);
  }

  const ALLOWED_MEMBER_ROLES = ['researcher', 'clinician', 'student', 'observer', 'pi'];
  if (!ALLOWED_MEMBER_ROLES.includes(memberRole)) {
    return jsonResp(400, { error: 'Invalid role. Allowed: ' + ALLOWED_MEMBER_ROLES.join(', ') }, headers);
  }

  const newKey = generateSubKey(workspace);
  const profile = {
    name:               [fname, lname].filter(Boolean).join(' ') || null,
    email:              email,
    role:               memberRole,
    parent_institution: workspace,
    active:             true,
    created_at:         Date.now(),
    expiry:             expiry || null
  };

  try {
    await db.ref('workspaces/' + newKey).set(profile);
    console.log(`[inst/provision-key] Created ${newKey} under institution ${workspace}`);
    return jsonResp(200, { key: newKey, profile }, headers);
  } catch(e) {
    console.error('[inst/provision-key] Firebase error:', e.message);
    return jsonResp(502, { error: 'Database error: ' + e.message }, headers);
  }
}

// ── /inst/revoke-key ──────────────────────────────────────────────────────────
/**
 * Revokes a sub-workspace key only if it belongs to the caller's institution
 * (i.e. parent_institution === caller's workspace). Sets active:false.
 * Requires role === 'institution' OR 'superadmin'.
 */
async function handleInstRevokeKey(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin') {
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  }
  if (!workspace) {
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { key } = body;
  if (!key) {
    return jsonResp(400, { error: 'key is required' }, headers);
  }

  try {
    const snap = await db.ref('workspaces/' + key).once('value');
    if (!snap.exists()) {
      return jsonResp(404, { error: 'Key not found: ' + key }, headers);
    }

    const profile = snap.val();

    // Scope check: the key must belong to the caller's institution.
    // Superadmins bypass the scope check.
    if (role !== 'superadmin' && profile.parent_institution !== workspace) {
      return jsonResp(403, { error: 'Key does not belong to your institution' }, headers);
    }

    await db.ref('workspaces/' + key).update({
      active:      false,
      revoked_at:  Date.now(),
      revoked_by:  workspace
    });

    console.log(`[inst/revoke-key] Revoked ${key} by institution ${workspace}`);
    return jsonResp(200, { revoked: true, key }, headers);
  } catch(e) {
    console.error('[inst/revoke-key] Firebase error:', e.message);
    return jsonResp(502, { error: 'Database error: ' + e.message }, headers);
  }
}

// ── REDCap API proxy helper ───────────────────────────────────────────────────
/**
 * Makes a form-encoded POST to a REDCap API endpoint.
 * REDCap's API accepts only application/x-www-form-urlencoded.
 * @param {string} api_url - Full REDCap API URL (must be HTTPS)
 * @param {Object} params  - Key/value pairs to encode as form fields
 * @returns {{ status: number, body: any }}
 */
function callREDCap(api_url, params) {
  return new Promise((resolve, reject) => {
    const formData = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    let url;
    try { url = new URL(api_url); } catch(e) { return reject(new Error('Invalid REDCap API URL')); }

    const options = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname + (url.search || ''),
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('REDCap request timed out')); });
    req.write(formData);
    req.end();
  });
}

// ── /redcap-test ──────────────────────────────────────────────────────────────
/**
 * Validates a REDCap API token by fetching project metadata.
 * Stores the token server-side under redcap_tokens/{workspace} (Firebase only,
 * never returned to the client). Returns a short hash for the frontend to store.
 *
 * Body: { api_url: string, api_token: string }
 * Response: { token_hash: string, project_title: string, project_id: number|null }
 */
async function handleREDCapTest(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const workspace = decodedToken.workspace || decodedToken.workspace_key;
  if (!workspace) return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { api_url, api_token } = body;
  if (!api_url || !api_token)    return jsonResp(400, { error: 'api_url and api_token are required' }, headers);
  if (!api_url.startsWith('https://')) return jsonResp(400, { error: 'REDCap API URL must use HTTPS' }, headers);
  if (api_token.length !== 32)   return jsonResp(400, { error: 'REDCap API tokens must be exactly 32 characters' }, headers);
  if (!/^[A-F0-9]+$/i.test(api_token)) return jsonResp(400, { error: 'REDCap API token must be alphanumeric hex' }, headers);

  try {
    const result = await callREDCap(api_url, {
      token: api_token, content: 'project', format: 'json', returnFormat: 'json'
    });

    if (result.status !== 200 || (result.body && result.body.error)) {
      const msg = (result.body && result.body.error) ? result.body.error : `REDCap returned HTTP ${result.status}`;
      return jsonResp(400, { error: 'REDCap connection test failed: ' + msg }, headers);
    }

    // Derive a short display hash — never expose the raw token outside this function
    const token_hash = crypto.createHash('sha256').update(api_token).digest('hex').slice(0, 16);

    // Store token securely in a server-only Firebase path.
    // Firebase security rules should restrict redcap_tokens/* to the service account only.
    await db.ref(`redcap_tokens/${workspace}`).set({
      api_url,
      api_token,           // only stored here, never sent back to the browser
      token_hash,
      project_title: result.body.project_title || '',
      project_id:    result.body.project_id    || null,
      stored_at:     Date.now(),
      stored_by:     decodedToken.uid || 'unknown'
    });

    console.log(`[redcap-test] Connected workspace ${workspace} to REDCap project "${result.body.project_title}"`);
    return jsonResp(200, {
      token_hash,
      project_title: result.body.project_title || '',
      project_id:    result.body.project_id    || null
    }, headers);

  } catch(e) {
    console.error('[redcap-test] Error:', e.message);
    return jsonResp(502, { error: 'Could not reach REDCap: ' + e.message }, headers);
  }
}

// ── /redcap-push ──────────────────────────────────────────────────────────────
/**
 * Imports ATLAS-scored records into REDCap.
 * Records must already be keyed by REDCap variable names (the frontend's
 * _buildREDCapRecord() handles the field-name mapping before calling here).
 *
 * Body: { workspace: string, records: Object[] }
 * Response: { count: number, errors: number, log: string[] }
 */
async function handleREDCapPush(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const workspace = decodedToken.workspace || decodedToken.workspace_key;
  if (!workspace) return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { records } = body;
  if (!Array.isArray(records) || records.length === 0)
    return jsonResp(400, { error: 'records must be a non-empty array' }, headers);
  if (records.length > 200)
    return jsonResp(400, { error: 'Maximum 200 records per push' }, headers);

  // Retrieve the stored REDCap credentials for this workspace
  let cfg;
  try {
    const snap = await db.ref(`redcap_tokens/${workspace}`).once('value');
    cfg = snap.val();
  } catch(e) {
    return jsonResp(502, { error: 'Failed to retrieve REDCap config: ' + e.message }, headers);
  }

  if (!cfg || !cfg.api_token || !cfg.api_url)
    return jsonResp(400, { error: 'REDCap is not connected for this workspace. Use the REDCap Bridge setup first.' }, headers);

  try {
    const result = await callREDCap(cfg.api_url, {
      token:             cfg.api_token,
      content:           'record',
      action:            'import',
      format:            'json',
      type:              'flat',
      overwriteBehavior: 'normal',
      forceAutoNumber:   'false',
      returnContent:     'count',
      returnFormat:      'json',
      data:              JSON.stringify(records)
    });

    const log    = [];
    let   errors = 0;

    if (result.status !== 200 || (result.body && result.body.error)) {
      errors = records.length;
      const msg = (result.body && result.body.error)
        ? result.body.error
        : (typeof result.body === 'string' ? result.body : `HTTP ${result.status}`);
      log.push('REDCap import error: ' + msg);
      console.error(`[redcap-push] workspace=${workspace} error=${msg}`);
    } else {
      const imported = (typeof result.body === 'number') ? result.body
        : (result.body && result.body.count != null) ? result.body.count
        : records.length;
      log.push(`Imported ${imported} record(s) to REDCap`);
      await db.ref(`redcap_tokens/${workspace}/last_push`).set(Date.now());
      console.log(`[redcap-push] workspace=${workspace} imported=${imported}`);
    }

    return jsonResp(200, { count: errors === 0 ? records.length : 0, errors, log }, headers);

  } catch(e) {
    console.error('[redcap-push] Error:', e.message);
    return jsonResp(502, { error: 'REDCap push failed: ' + e.message }, headers);
  }
}

// ── /redcap-pull ──────────────────────────────────────────────────────────────
/**
 * Exports all records from the connected REDCap project.
 * Optionally filtered to specific fields via body.fields array.
 *
 * Body: { workspace?: string, fields?: string[] }
 * Response: { count: number, records: Object[] }
 */
async function handleREDCapPull(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const workspace = decodedToken.workspace || decodedToken.workspace_key;
  if (!workspace) return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch(e) {}

  // Retrieve stored credentials
  let cfg;
  try {
    const snap = await db.ref(`redcap_tokens/${workspace}`).once('value');
    cfg = snap.val();
  } catch(e) {
    return jsonResp(502, { error: 'Failed to retrieve REDCap config: ' + e.message }, headers);
  }

  if (!cfg || !cfg.api_token || !cfg.api_url)
    return jsonResp(400, { error: 'REDCap is not connected for this workspace.' }, headers);

  try {
    const params = {
      token:                  cfg.api_token,
      content:                'record',
      action:                 'export',
      format:                 'json',
      type:                   'flat',
      rawOrLabel:             'raw',
      rawOrLabelHeaders:      'raw',
      exportCheckboxLabel:    'false',
      exportSurveyFields:     'true',
      exportDataAccessGroups: 'false',
      returnFormat:           'json'
    };

    // Narrow the export to specific fields if requested (reduces payload size)
    if (Array.isArray(body.fields) && body.fields.length > 0) {
      params.fields = body.fields.join(',');
    }

    const result = await callREDCap(cfg.api_url, params);

    if (result.status !== 200 || (result.body && result.body.error)) {
      const msg = (result.body && result.body.error) ? result.body.error : `HTTP ${result.status}`;
      return jsonResp(400, { error: 'REDCap export failed: ' + msg }, headers);
    }

    const records = Array.isArray(result.body) ? result.body : [];
    await db.ref(`redcap_tokens/${workspace}/last_pull`).set(Date.now());
    console.log(`[redcap-pull] workspace=${workspace} pulled=${records.length}`);

    return jsonResp(200, { count: records.length, records }, headers);

  } catch(e) {
    console.error('[redcap-pull] Error:', e.message);
    return jsonResp(502, { error: 'REDCap pull failed: ' + e.message }, headers);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const origin  = event.headers?.origin || event.headers?.Origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path || event.rawPath || '/';

  // ── Institution-tier self-service routes ───────────────────────────────────
  if (path === '/inst/list-members')  return handleInstListMembers(event, headers);
  if (path === '/inst/provision-key') return handleInstProvisionKey(event, headers);
  if (path === '/inst/revoke-key')    return handleInstRevokeKey(event, headers);

  // ── REDCap bridge routes ───────────────────────────────────────────────────
  if (path === '/redcap-test') return handleREDCapTest(event, headers);
  if (path === '/redcap-push') return handleREDCapPush(event, headers);
  if (path === '/redcap-pull') return handleREDCapPull(event, headers);

  // ── AI proxy (default route) ───────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI service not configured' }) };
  }

  const model      = ALLOWED_MODELS.includes(body.model) ? body.model : 'claude-haiku-4-5-20251001';
  const max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP);

  const payload = { model, max_tokens, messages: body.messages };
  if (body.system) payload.system = body.system;

  try {
    const result = await callAnthropic(payload, apiKey);
    console.log(JSON.stringify({ model, status: result.status, input_tokens: result.body?.usage?.input_tokens }));
    return {
      statusCode: result.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(result.body)
    };
  } catch(e) {
    console.error('Anthropic call failed:', e.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service unavailable' }) };
  }
};
