'use strict';
/**
 * ATLAS API Lambda  (atlas-api)
 * Single Lambda function backing the xckeiwruv7 API Gateway.
 *
 * Routes:
 *   POST   /claude             — Anthropic Claude AI proxy
 *   POST   /inst/list-members  — list sub-workspace keys for an institution
 *   POST   /inst/provision-key — create a new sub-workspace key
 *   POST   /inst/revoke-key    — deactivate a sub-workspace key
 *   OPTIONS *                  — CORS pre-flight
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY         — sk-ant-... (console.anthropic.com)
 *   FIREBASE_SERVICE_ACCOUNT  — full service account JSON as a single-line string
 *
 * AWS Lambda: Node.js 20.x  |  Handler: index.handler
 * Timeout: 30s  |  Memory: 256 MB
 */

const https = require('https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    ),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://adherence-project-2026-default-rtdb.firebaseio.com'
  });
}

// Lazy-initialize the database reference — only /inst/* routes need it
// Keeps /claude working even if the DB URL is misconfigured
let _db = null;
function getDb() {
  if (!_db) _db = admin.database();
  return _db;
}

// ── Config ────────────────────────────────────────────────────────────────────
const ALLOWED_MODELS   = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'];
const MAX_TOKENS_CAP   = 4096;
const ALLOWED_ORIGINS  = ['https://atlas.adherence.cc', 'https://www.adherence.cc', 'http://localhost'];

// ── CORS ──────────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.find(o => (origin || '').startsWith(o)) || ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400'
  };
}

function jsonResp(statusCode, data, headers) {
  return { statusCode, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

// ── Firebase token validation ─────────────────────────────────────────────────
async function verifyBearerToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  try {
    return await admin.auth().verifyIdToken(token);
  } catch(e) {
    throw Object.assign(new Error('Invalid or expired token: ' + e.message), { statusCode: 401 });
  }
}

// ── Key generation ────────────────────────────────────────────────────────────
function generateSubKey(institutionWorkspace) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${institutionWorkspace}-${suffix}-${new Date().getFullYear()}`;
}

// ── Anthropic call ────────────────────────────────────────────────────────────
function callAnthropic(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body)
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

// ── /claude ───────────────────────────────────────────────────────────────────
async function handleClaude(event, headers) {
  // Every claude call must come from an authenticated ATLAS user
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  let reqBody;
  try { reqBody = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude] ANTHROPIC_API_KEY not configured');
    return jsonResp(500, { error: 'AI service not configured' }, headers);
  }

  const model      = ALLOWED_MODELS.includes(reqBody.model) ? reqBody.model : 'claude-haiku-4-5-20251001';
  const max_tokens = Math.min(Number(reqBody.max_tokens) || 1024, MAX_TOKENS_CAP);

  const payload = { model, max_tokens, messages: reqBody.messages };
  if (reqBody.system) payload.system = reqBody.system;

  try {
    const result = await callAnthropic(payload, apiKey);

    // Structured log: uid, workspace, model, token usage — visible in CloudWatch
    console.log(JSON.stringify({
      route:         '/claude',
      uid:           decodedToken.uid,
      workspace:     decodedToken.workspace || decodedToken.workspace_key || null,
      role:          decodedToken.role || null,
      model,
      input_tokens:  result.body?.usage?.input_tokens  || null,
      output_tokens: result.body?.usage?.output_tokens || null,
      status:        result.status
    }));

    // If Anthropic itself returned an error, surface it clearly rather than proxying raw status
    if (result.status >= 400) {
      const anthErr = result.body?.error?.message || result.body?.error || 'Anthropic error';
      console.error('[claude] Anthropic returned', result.status, anthErr);
      return jsonResp(502, { error: `Anthropic: ${anthErr}` }, headers);
    }

    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) };
  } catch(e) {
    console.error('[claude] Anthropic call failed:', e.message);
    return jsonResp(502, { error: 'AI service unavailable: ' + e.message }, headers);
  }
}

// ── /inst/list-members ────────────────────────────────────────────────────────
async function handleInstListMembers(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin')
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  if (!workspace)
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  try {
    const snap = await getDb().ref('workspaces')
      .orderByChild('parent_institution')
      .equalTo(workspace)
      .once('value');

    const keys = [];
    if (snap.val()) {
      snap.forEach(child => {
        const p = child.val();
        keys.push({
          key:        child.key,
          name:       p.name       || null,
          email:      p.email      || null,
          role:       p.role       || null,
          expiry:     p.expiry     || null,
          lastActive: p.lastActive || p.last_active || null,
          parent_inst:p.parent_institution || workspace,
          active:     p.active !== false
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
async function handleInstProvisionKey(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin')
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  if (!workspace)
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { fname, lname, email, role: memberRole, expiry } = body;

  if (!email || !email.includes('@'))
    return jsonResp(400, { error: 'Valid email is required' }, headers);
  if (!memberRole)
    return jsonResp(400, { error: 'role is required' }, headers);

  const ALLOWED_MEMBER_ROLES = ['researcher', 'clinician', 'student', 'observer', 'pi'];
  if (!ALLOWED_MEMBER_ROLES.includes(memberRole))
    return jsonResp(400, { error: 'Invalid role. Allowed: ' + ALLOWED_MEMBER_ROLES.join(', ') }, headers);

  const newKey = generateSubKey(workspace);
  const profile = {
    name:               [fname, lname].filter(Boolean).join(' ') || null,
    email,
    role:               memberRole,
    parent_institution: workspace,
    active:             true,
    created_at:         Date.now(),
    expiry:             expiry || null
  };

  try {
    await getDb().ref('workspaces/' + newKey).set(profile);
    console.log(JSON.stringify({ route: '/inst/provision-key', newKey, email, role: memberRole, institution: workspace }));
    return jsonResp(200, { key: newKey, profile }, headers);
  } catch(e) {
    console.error('[inst/provision-key] Firebase error:', e.message);
    return jsonResp(502, { error: 'Database error: ' + e.message }, headers);
  }
}

// ── /inst/revoke-key ──────────────────────────────────────────────────────────
async function handleInstRevokeKey(event, headers) {
  let decodedToken;
  try { decodedToken = await verifyBearerToken(event); }
  catch(e) { return jsonResp(e.statusCode || 401, { error: e.message }, headers); }

  const role      = decodedToken.role;
  const workspace = decodedToken.workspace || decodedToken.workspace_key;

  if (role !== 'institution' && role !== 'superadmin')
    return jsonResp(403, { error: 'institution or superadmin role required' }, headers);
  if (!workspace)
    return jsonResp(400, { error: 'workspace claim missing from token' }, headers);

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return jsonResp(400, { error: 'Invalid JSON body' }, headers); }

  const { key } = body;
  if (!key) return jsonResp(400, { error: 'key is required' }, headers);

  try {
    const snap = await getDb().ref('workspaces/' + key).once('value');
    if (!snap.exists()) return jsonResp(404, { error: 'Key not found: ' + key }, headers);

    const profile = snap.val();
    if (role !== 'superadmin' && profile.parent_institution !== workspace)
      return jsonResp(403, { error: 'Key does not belong to your institution' }, headers);

    await getDb().ref('workspaces/' + key).update({ active: false, revoked_at: Date.now(), revoked_by: workspace });
    console.log(JSON.stringify({ route: '/inst/revoke-key', key, institution: workspace }));
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

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS')
    return { statusCode: 200, headers, body: '' };

  const path = event.path || event.rawPath || '/';

  if (path === '/claude')             return handleClaude(event, headers);
  if (path === '/inst/list-members')  return handleInstListMembers(event, headers);
  if (path === '/inst/provision-key') return handleInstProvisionKey(event, headers);
  if (path === '/inst/revoke-key')    return handleInstRevokeKey(event, headers);

  return jsonResp(404, { error: 'Route not found', path }, headers);
};
