'use strict';
const https = require('https');
const admin = require('firebase-admin');

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
const ALLOWED_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'];
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
