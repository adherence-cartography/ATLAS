'use strict';
/**
 * ATLAS Claude Proxy Lambda
 * Route: POST /claude  (OPTIONS /claude for CORS pre-flight)
 *
 * Validates the caller's Firebase ID token, then forwards the request to
 * Anthropic's /v1/messages API using the ANTHROPIC_API_KEY env variable.
 * The API key is never exposed to the client.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY         — sk-ant-... from console.anthropic.com
 *   FIREBASE_SERVICE_ACCOUNT  — full Firebase service account JSON as a single-line string
 *
 * AWS Lambda: Node.js 20.x  |  Handler: index.handler
 * Timeout: 30s  |  Memory: 256 MB (use 512 MB for Sonnet/Opus)
 */

const https = require('https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    )
  });
}

// ── Config ────────────────────────────────────────────────────────────────────
const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-6'
];
const MAX_TOKENS_CAP = 4096;
const ALLOWED_ORIGINS = [
  'https://atlas.adherence.cc',
  'https://www.adherence.cc',
  'http://localhost'
];

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

// ── Anthropic call ────────────────────────────────────────────────────────────
function callAnthropic(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':        'application/json',
        'x-api-key':           apiKey,
        'anthropic-version':   '2023-06-01',
        'Content-Length':      Buffer.byteLength(body)
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

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const origin  = event.headers?.origin || event.headers?.Origin || '';
  const headers = corsHeaders(origin);

  // CORS pre-flight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Validate Firebase token — every caller must be an authenticated ATLAS user
  let decodedToken;
  try {
    decodedToken = await verifyBearerToken(event);
  } catch(e) {
    return { statusCode: e.statusCode || 401, headers, body: JSON.stringify({ error: e.message }) };
  }

  // Parse request body
  let reqBody;
  try { reqBody = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude-proxy] ANTHROPIC_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI service not configured' }) };
  }

  // Clamp model and token count
  const model      = ALLOWED_MODELS.includes(reqBody.model) ? reqBody.model : 'claude-haiku-4-5-20251001';
  const max_tokens = Math.min(Number(reqBody.max_tokens) || 1024, MAX_TOKENS_CAP);

  const payload = { model, max_tokens, messages: reqBody.messages };
  if (reqBody.system) payload.system = reqBody.system;

  try {
    const result = await callAnthropic(payload, apiKey);

    // Structured CloudWatch log: uid, workspace, model, token usage
    console.log(JSON.stringify({
      uid:          decodedToken.uid,
      workspace:    decodedToken.workspace || decodedToken.workspace_key || null,
      role:         decodedToken.role || null,
      model,
      input_tokens: result.body?.usage?.input_tokens  || null,
      output_tokens:result.body?.usage?.output_tokens || null,
      status:       result.status
    }));

    return {
      statusCode: result.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(result.body)
    };
  } catch(e) {
    console.error('[claude-proxy] Anthropic call failed:', e.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service unavailable' }) };
  }
};
