/**
 * ATLAS REST API v1 — Cloudflare Worker + D1
 *
 * Authentication: Firebase JWT Bearer token in Authorization header
 * All endpoints require authentication unless marked [PUBLIC]
 *
 * Routes:
 *   GET  /api/v1/health                    [PUBLIC] Platform health check
 *   GET  /api/v1/assessments               List assessments for workspace
 *   POST /api/v1/assessments               Submit new MMAS-8 assessment
 *   GET  /api/v1/assessments/:id           Get single assessment
 *   GET  /api/v1/stats                     Workspace aggregate statistics
 *   GET  /api/v1/stats/public              [PUBLIC] Platform-wide public stats
 *   GET  /api/v1/workspace                 Current workspace profile
 *   GET  /api/v1/export/csv                Export assessments as CSV
 *
 * MMAS-8 © Donald E. Morisky. Licensed exclusively to Adherence Inc.
 * ATLAS platform © Adherence Inc. Unauthorized use prohibited.
 * See: adherence.cc/license
 */

// Allowed origins for CORS — never wildcard on a patient data API
const CORS_ORIGINS = new Set([
  'https://atlas.adherence.cc',
  'http://localhost',
  'http://127.0.0.1',
]);

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Allow localhost on any port (dev), exact match for production
  const allowed = origin === 'https://atlas.adherence.cc'
    || origin.startsWith('http://localhost:')
    || origin === 'http://localhost'
    || origin.startsWith('http://127.0.0.1:')
    || origin === 'http://127.0.0.1';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://atlas.adherence.cc',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Request-scoped CORS headers — set once per fetch, used by apiResponse/apiError helpers.
// Safe because Cloudflare Workers are single-threaded per request.
let _cors = {};

export default {
  async fetch(request, env, ctx) {
    _cors = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: _cors });
    }

    const url = new URL(request.url);

    // Only handle /api/v1/ routes
    if (!url.pathname.startsWith('/api/v1/')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      return await routeRequest(request, url, env, ctx);
    } catch (err) {
      console.error('API error:', err);
      return apiError(500, 'Internal server error', err.message);
    }
  }
};

async function routeRequest(request, url, env, ctx) {
  const path = url.pathname.replace('/api/v1', '');
  const method = request.method;

  // ── Public routes (no auth required) ──────────────────────────────────────
  if (path === '/health' && method === 'GET') {
    return apiResponse({ status: 'ok', version: '1.0.0', platform: 'ATLAS v8' });
  }

  if (path === '/stats/public' && method === 'GET') {
    return handlePublicStats(env);
  }

  // ── Authenticated routes ───────────────────────────────────────────────────
  const auth = await verifyFirebaseToken(request, env);
  if (!auth.ok) return apiError(401, 'Unauthorized', auth.error);

  const { uid, claims } = auth;

  if (path === '/workspace' && method === 'GET') {
    return handleGetWorkspace(claims, env);
  }

  if (path === '/assessments' && method === 'GET') {
    return handleListAssessments(url, claims, env);
  }

  if (path === '/assessments' && method === 'POST') {
    return handleCreateAssessment(request, claims, env, ctx);
  }

  if (path.match(/^\/assessments\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    return handleGetAssessment(id, claims, env);
  }

  if (path === '/stats' && method === 'GET') {
    return handleWorkspaceStats(claims, env);
  }

  if (path === '/export/csv' && method === 'GET') {
    return handleExportCsv(url, claims, env);
  }

  return apiError(404, 'Route not found');
}

// ── Firebase JWT verification — RS256 signature verified ──────────────────
// Firebase signs ID tokens with RS256. Public keys rotate every ~6 hours and
// are fetched from Google's JWK endpoint. We cache them per their Cache-Control
// max-age to avoid a network round-trip on every request.
//
// The module-level cache is per-isolate (one Cloudflare Worker instance).
// In practice keys are stable for hours so cache hits are the common path.
let _fKeyCache = null; // { keys: { kid: CryptoKey }, expiresAt: number }

async function _getFirebasePublicKeys() {
  const now = Date.now();
  if (_fKeyCache && _fKeyCache.expiresAt > now) return _fKeyCache.keys;

  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { cf: { cacheTtl: 3600, cacheEverything: true } }
  );
  if (!resp.ok) throw new Error('Firebase key fetch failed: ' + resp.status);

  // Parse Cache-Control max-age to know when keys rotate
  const cc = resp.headers.get('Cache-Control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/);
  const ttl = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3_600_000;

  const certs = await resp.json(); // { kid: "-----BEGIN CERTIFICATE-----\n..." }
  const keys = {};
  for (const [kid, pem] of Object.entries(certs)) {
    // PEM → DER (strip headers, decode base64)
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    keys[kid] = await crypto.subtle.importKey(
      'spki', der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );
  }
  _fKeyCache = { keys, expiresAt: now + ttl };
  return keys;
}

function _b64urlDecode(s) {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function verifyFirebaseToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing Bearer token' };
  }
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Invalid token format' };

  try {
    const header  = JSON.parse(_b64urlDecode(parts[0]));
    const payload = JSON.parse(_b64urlDecode(parts[1]));

    // 1. Algorithm must be RS256
    if (header.alg !== 'RS256') return { ok: false, error: 'Unexpected algorithm: ' + header.alg };

    // 2. Expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return { ok: false, error: 'Token expired' };

    // 3. Not-before
    if (payload.nbf && payload.nbf > now + 60) return { ok: false, error: 'Token not yet valid' };

    // 4. Issuer must match Firebase project
    const project = env.FIREBASE_PROJECT_ID || 'adherence-project-2026';
    if (payload.iss !== `https://securetoken.google.com/${project}`) {
      return { ok: false, error: 'Invalid issuer' };
    }

    // 5. Audience must be the Firebase project
    if (payload.aud !== project) return { ok: false, error: 'Invalid audience' };

    // 6. RS256 signature verification
    const keys = await _getFirebasePublicKeys();
    const key = keys[header.kid];
    if (!key) return { ok: false, error: 'Unknown key ID — token may have been issued before key rotation' };

    const signedPart = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const sig = Uint8Array.from(_b64urlDecode(parts[2]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signedPart);
    if (!valid) return { ok: false, error: 'Signature verification failed' };

    return {
      ok: true,
      uid: payload.sub || payload.user_id,
      claims: {
        role:               payload.role || 'student',
        workspace_key:      payload.workspace_key,
        parent_institution: payload.parent_institution,
        tier:               payload.tier,
      }
    };
  } catch(e) {
    return { ok: false, error: 'Token verification error: ' + e.message };
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────

async function handlePublicStats(env) {
  // Return cached public stats from D1
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM public_stats ORDER BY updated_at DESC LIMIT 1'
    ).first();
    return apiResponse(row || { total_assessments: 0, countries: 0 });
  } catch(e) {
    return apiResponse({ total_assessments: 0, countries: 0, note: 'Stats pending' });
  }
}

async function handleGetWorkspace(claims, env) {
  return apiResponse({
    workspace_key: claims.workspace_key,
    role: claims.role,
    tier: claims.tier,
    parent_institution: claims.parent_institution,
  });
}

async function handleListAssessments(url, claims, env) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = (page - 1) * limit;
  const condition = url.searchParams.get('condition');
  const tier = url.searchParams.get('tier');

  let query = 'SELECT * FROM assessments WHERE workspace_key = ?';
  const params = [claims.workspace_key];

  if (condition) { query += ' AND condition LIKE ?'; params.push('%' + condition + '%'); }
  if (tier) { query += ' AND adherence_tier = ?'; params.push(tier); }

  query += ' ORDER BY ts DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  // Superadmin sees all
  if (claims.role === 'superadmin') {
    query = query.replace('WHERE workspace_key = ?', 'WHERE 1=1');
    params.shift();
  }

  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM assessments WHERE workspace_key = ?'
    ).bind(claims.workspace_key).first();

    return apiResponse({
      data: results,
      pagination: { page, limit, total: countRow?.total || 0 }
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleCreateAssessment(request, claims, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  // Validate required MMAS-8 fields
  const required = ['q1','q2','q3','q4','q5','q6','q7','q8'];
  const missing = required.filter(k => body[k] === undefined);
  if (missing.length) return apiError(400, `Missing required fields: ${missing.join(', ')}`);

  // Compute MMAS-8 score
  // Q1–Q7: 1 = non-adherent (missed), 0 = adherent (took)
  // Q8: 0–4 Likert scale; 0 = never (perfect), 4 = always (worst)
  const items = [body.q1, body.q2, body.q3, body.q4, body.q5, body.q6, body.q7];
  const q8Normalized = Math.min(body.q8 / 4, 1); // Q8 is 0-4 scale
  const rawScore = items.reduce((s, v) => s + (v ? 0 : 1), 0) + (q8Normalized === 0 ? 1 : 0);
  const mmas_score = parseFloat(rawScore.toFixed(2));
  const adherence_tier = mmas_score === 8 ? 'high' : mmas_score >= 6 ? 'medium' : 'low';

  const record = {
    id: crypto.randomUUID(),
    workspace_key: claims.workspace_key,
    q1: body.q1, q2: body.q2, q3: body.q3, q4: body.q4,
    q5: body.q5, q6: body.q6, q7: body.q7, q8: body.q8,
    mmas_score,
    adherence_tier,
    patient_number: body.patient_number || null,
    condition: body.condition || null,
    medication: body.medication || null,
    country: body.country || null,
    language: body.language || 'en',
    collection_method: body.collection_method || 'api',
    ts: Date.now(),
    submitted_at: new Date().toISOString(),
  };

  try {
    await env.DB.prepare(`
      INSERT INTO assessments
      (id, workspace_key, q1, q2, q3, q4, q5, q6, q7, q8, mmas_score, adherence_tier,
       patient_number, condition, medication, country, language, collection_method, ts, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      record.id, record.workspace_key,
      record.q1, record.q2, record.q3, record.q4, record.q5, record.q6, record.q7, record.q8,
      record.mmas_score, record.adherence_tier,
      record.patient_number, record.condition, record.medication, record.country,
      record.language, record.collection_method, record.ts, record.submitted_at
    ).run();

    return apiResponse(record, 201);
  } catch(e) {
    return apiError(500, 'Failed to save assessment', e.message);
  }
}

async function handleGetAssessment(id, claims, env) {
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM assessments WHERE id = ? AND workspace_key = ?'
    ).bind(id, claims.workspace_key).first();
    if (!row) return apiError(404, 'Assessment not found');
    return apiResponse(row);
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleWorkspaceStats(claims, env) {
  try {
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(mmas_score) as avg_score,
        SUM(CASE WHEN adherence_tier='high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN adherence_tier='medium' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN adherence_tier='low' THEN 1 ELSE 0 END) as low_count,
        COUNT(DISTINCT country) as countries,
        COUNT(DISTINCT condition) as conditions
      FROM assessments WHERE workspace_key = ?
    `).bind(claims.workspace_key).first();
    return apiResponse(stats);
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleExportCsv(url, claims, env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM assessments WHERE workspace_key = ? ORDER BY ts DESC LIMIT 10000'
    ).bind(claims.workspace_key).all();

    if (!results.length) return new Response('No data', { status: 200, headers: { 'Content-Type': 'text/csv' } });

    const headers = Object.keys(results[0]);
    const csv = [
      headers.join(','),
      ...results.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="atlas_export.csv"',
        ..._cors
      }
    });
  } catch(e) {
    return apiError(500, 'Export failed', e.message);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function apiResponse(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data, ts: Date.now() }), {
    status,
    headers: { 'Content-Type': 'application/json', ..._cors }
  });
}

function apiError(status, message, detail = null) {
  return new Response(JSON.stringify({ ok: false, error: message, detail, ts: Date.now() }), {
    status,
    headers: { 'Content-Type': 'application/json', ..._cors }
  });
}
