'use strict';
/**
 * ATLAS Institution Provisioning Lambda
 * Routes:
 *   POST /inst/list-members   — list sub-workspace keys for the caller's institution
 *   POST /inst/provision-key  — create a new sub-workspace key + send welcome email
 *   POST /inst/revoke-key     — deactivate a key owned by the caller's institution
 *
 * All routes require a valid Firebase ID token with role === 'institution'
 * or role === 'superadmin'. The token must carry a workspace claim.
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — full Firebase service account JSON as a single-line string
 *
 * AWS Lambda: Node.js 20.x  |  Handler: index.handler
 * Timeout: 15s  |  Memory: 256 MB
 */

'use strict';
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    )
  });
}
const db = admin.database();

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://atlas.adherence.cc',
  'https://www.adherence.cc',
  'http://localhost'
];

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

// ── Token validation ──────────────────────────────────────────────────────────
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
  const year   = new Date().getFullYear();
  return `${institutionWorkspace}-${suffix}-${year}`;
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
    const snap = await db.ref('workspaces')
      .orderByChild('parent_institution')
      .equalTo(workspace)
      .once('value');

    const keys = [];
    if (snap.val()) {
      snap.forEach(child => {
        const p = child.val();
        keys.push({
          key:        child.key,
          name:       p.name         || null,
          email:      p.email        || null,
          role:       p.role         || null,
          expiry:     p.expiry       || null,
          lastActive: p.lastActive   || p.last_active || null,
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

  try {
    const newKey = generateSubKey(workspace);
    const profile = {
      name:               [fname, lname].filter(Boolean).join(' ') || null,
      email,
      role:               memberRole,
      parent_institution: workspace,
      created_at:         Date.now(),
      active:             true,
      ...(expiry ? { expiry } : {})
    };

    await db.ref('workspaces/' + newKey).set(profile);
    console.log(`[inst/provision-key] Provisioned ${newKey} for ${email} by institution ${workspace}`);
    return jsonResp(200, { key: newKey, email, role: memberRole }, headers);
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
    const snap = await db.ref('workspaces/' + key).once('value');
    if (!snap.exists()) return jsonResp(404, { error: 'Key not found: ' + key }, headers);

    const profile = snap.val();
    if (role !== 'superadmin' && profile.parent_institution !== workspace)
      return jsonResp(403, { error: 'Key does not belong to your institution' }, headers);

    await db.ref('workspaces/' + key).update({
      active:     false,
      revoked_at: Date.now(),
      revoked_by: workspace
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

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS')
    return { statusCode: 200, headers, body: '' };

  const path = event.path || event.rawPath || '/';

  if (path === '/inst/list-members')  return handleInstListMembers(event, headers);
  if (path === '/inst/provision-key') return handleInstProvisionKey(event, headers);
  if (path === '/inst/revoke-key')    return handleInstRevokeKey(event, headers);

  return jsonResp(404, { error: 'Route not found', path }, headers);
};
