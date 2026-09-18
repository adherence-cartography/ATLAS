/**
 * ATLAS REST API v1 — Cloudflare Worker + D1
 *
 * Authentication: Firebase JWT Bearer token in Authorization header
 * All endpoints require authentication unless marked [PUBLIC]
 *
 * Routes:
 *   GET  /api/v1/health                           [PUBLIC] Platform health check
 *   GET  /api/v1/assessments                      List assessments for workspace
 *   POST /api/v1/assessments                      Submit new MMAS-8 assessment
 *   GET  /api/v1/assessments/:id                  Get single assessment
 *   GET  /api/v1/stats                            Workspace aggregate statistics
 *   GET  /api/v1/stats/public                     [PUBLIC] Platform-wide public stats
 *   GET  /api/v1/workspace                        Current workspace profile
 *   GET  /api/v1/export/csv                       Export assessments as CSV
 *
 * MAP instrument routes:
 *   POST /api/v1/map/submit                       Submit MAP assessment with computed scores
 *   GET  /api/v1/map/session/:sessionId           Longitudinal session assessments
 *   GET  /api/v1/map/country-profile/:iso2        Country-level triadic domain aggregates
 *   GET  /api/v1/map/workspace-summary/:key       PE distribution, domain means, phenotype freq
 *
 * MaaS (MAP-as-a-Service) routes — external partner API:
 *   POST /api/maas/v1/score                       [MAAS KEY] Score a single patient
 *   POST /api/maas/v1/batch                       [MAAS KEY] Score up to 50 patients
 *   GET  /api/maas/v1/status                      [MAAS KEY] API key status and quota
 *   POST /api/v1/admin/maas/create-key            [SUPER-ADMIN] Provision a new MaaS API key
 *
 * DHIS2 integration routes — WHO-standard health information system:
 *   POST   /api/v1/dhis2/connect                  Save and verify a DHIS2 connection
 *   POST   /api/v1/dhis2/sync/:connectionId       Sync pending MAP assessments to DHIS2
 *   GET    /api/v1/dhis2/status/:connectionId     Connection health and sync stats
 *   DELETE /api/v1/dhis2/connect/:connectionId    Deactivate a connection
 *   POST   /api/v1/dhis2/pull-orgunits/:connectionId  Fetch org unit hierarchy from DHIS2
 *
 * MAP Certification routes — TESSERA GRC / Scala Carta Foundation:
 *   POST /api/v1/certification/issue              Issue MAP certification (auth required)
 *   GET  /api/v1/certification/verify/:certNumber [PUBLIC] Verify a cert by number
 *   GET  /api/v1/certification/directory          [PUBLIC] All active certs grouped by country
 *   GET  /api/v1/certification/workspace/:key     All certs for a workspace (auth required)
 *
 * MMAS-8 (c) Donald E. Morisky. Licensed exclusively to Adherence Inc.
 * MAP (c) Philip Morisky / Adherence Cartography. All rights reserved.
 * ATLAS platform (c) Adherence Inc. Unauthorized use prohibited.
 * See: adherence.cc/license
 */

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

// Per-request CORS headers — reset at the start of each fetch() call before use.
let _cors = {};

export default {
  async fetch(request, env, ctx) {
    _cors = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: _cors });
    }

    const url = new URL(request.url);

    // Only handle /api/v1/ or /api/maas/ routes
    if (!url.pathname.startsWith('/api/v1/') && !url.pathname.startsWith('/api/maas/')) {
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
  const method = request.method;

  // ── MaaS routes (/api/maas/v1/...) — separate auth path ──────────────────
  if (url.pathname.startsWith('/api/maas/')) {
    const maasPath = url.pathname.replace('/api/maas', '');
    if (maasPath === '/v1/score'  && method === 'POST') return handleMaaSScore(request, env, ctx);
    if (maasPath === '/v1/batch'  && method === 'POST') return handleMaaSBatch(request, env, ctx);
    if (maasPath === '/v1/status' && method === 'GET')  return handleMaaSStatus(request, env);
    return apiError(404, 'MaaS route not found');
  }

  const path = url.pathname.replace('/api/v1', '');

  // ── Public routes (no auth required) ──────────────────────────────────────
  if (path === '/health' && method === 'GET') {
    return apiResponse({ status: 'ok', version: '1.0.0', platform: 'ATLAS v8' });
  }

  if (path === '/stats/public' && method === 'GET') {
    return handlePublicStats(env);
  }

  // ── MAP Certification public routes (no auth) ─────────────────────────────
  if (path.match(/^\/certification\/verify\/[^/]+$/) && method === 'GET') {
    const certNumber = path.split('/')[3];
    return handleCertVerify(certNumber, env);
  }

  if (path === '/certification/directory' && method === 'GET') {
    return handleCertDirectory(url, env);
  }

  // ── GAI public routes (no auth) ────────────────────────────────────────────
  if (path.match(/^\/gai\/snapshots\/\d{4}$/) && method === 'GET') {
    const year = parseInt(path.split('/')[3], 10);
    return handleGAISnapshotsPublic(year, env);
  }

  // ── Open-data public routes (no auth or token-only) ───────────────────────
  if (path === '/open-data/catalog' && method === 'GET') {
    return handleOpenDataCatalog(env);
  }

  if (path === '/open-data/download' && method === 'GET') {
    return handleOpenDataDownload(request, env);
  }

  if (path === '/open-data/request-access' && method === 'POST') {
    return handleOpenDataRequestAccess(request, env, ctx);
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

  // ── MAP instrument routes ───────────────────────────────────────────────────
  if (path === '/map/submit' && method === 'POST') {
    return handleMAPSubmit(request, claims, env, ctx);
  }

  if (path.match(/^\/map\/session\/[^/]+$/) && method === 'GET') {
    const sessionId = path.split('/')[3];
    return handleMAPSession(sessionId, claims, env);
  }

  if (path.match(/^\/map\/country-profile\/[^/]+$/) && method === 'GET') {
    const iso2 = path.split('/')[3];
    return handleMAPCountryProfile(iso2, claims, env);
  }

  if (path.match(/^\/map\/workspace-summary\/[^/]+$/) && method === 'GET') {
    const wsKey = path.split('/')[3];
    return handleMAPWorkspaceSummary(wsKey, claims, env);
  }

  if (path === '/map/predict-dropout' && method === 'POST') {
    return handleMAPPredictDropout(request, claims, env);
  }

  if (path.match(/^\/map\/risk-dashboard\/[^/]+$/) && method === 'GET') {
    const wsKey = path.split('/')[3];
    return handleMAPRiskDashboard(wsKey, claims, env);
  }

  // ── GAI snapshot computation (super-admin or institution-admin) ──────────
  if (path === '/gai/compute-snapshot' && method === 'POST') {
    if (claims.role !== 'superadmin' && claims.role !== 'institution-admin') {
      return apiError(403, 'Institution-admin or super-admin access required');
    }
    return handleGAIComputeSnapshot(request, claims, env);
  }

  // ── Admin open-data approval (super-admin only) ───────────────────────────
  if (path.match(/^\/admin\/open-data\/approve\/[^/]+$/) && method === 'POST') {
    if (claims.role !== 'superadmin') return apiError(403, 'Super-admin access required');
    const requestId = path.split('/')[4];
    return handleOpenDataApprove(requestId, env);
  }

  // ── Admin MaaS provisioning (super-admin only) ────────────────────────────
  if (path === '/admin/maas/create-key' && method === 'POST') {
    if (claims.role !== 'superadmin') return apiError(403, 'Super-admin access required');
    return handleMaaSCreateKey(request, claims, env);
  }

  // ── DHIS2 integration routes ───────────────────────────────────────────────
  if (path === '/dhis2/connect' && method === 'POST') {
    return handleDHIS2Connect(request, claims, env);
  }

  if (path.match(/^\/dhis2\/sync\/[^/]+$/) && method === 'POST') {
    const connectionId = path.split('/')[3];
    return handleDHIS2Sync(connectionId, claims, env, ctx);
  }

  if (path.match(/^\/dhis2\/status\/[^/]+$/) && method === 'GET') {
    const connectionId = path.split('/')[3];
    return handleDHIS2Status(connectionId, claims, env);
  }

  if (path.match(/^\/dhis2\/connect\/[^/]+$/) && method === 'DELETE') {
    const connectionId = path.split('/')[3];
    return handleDHIS2Disconnect(connectionId, claims, env);
  }

  if (path.match(/^\/dhis2\/pull-orgunits\/[^/]+$/) && method === 'POST') {
    const connectionId = path.split('/')[3];
    return handleDHIS2PullOrgUnits(connectionId, claims, env);
  }

  // ── MAP Certification authenticated routes ────────────────────────────────
  if (path === '/certification/issue' && method === 'POST') {
    return handleCertIssue(request, uid, claims, env);
  }

  if (path.match(/^\/certification\/workspace\/[^/]+$/) && method === 'GET') {
    const wsKey = path.split('/')[3];
    return handleCertWorkspace(wsKey, claims, env);
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
    const project = 'adherence-project-2026';
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
        workspace_key:      payload.workspace_key || payload.workspace,
        parent_institution: payload.parent_institution || payload.institution,
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
    return apiResponse({ total_assessments: 0, countries: 0 });
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

    let countQuery = 'SELECT COUNT(*) as total FROM assessments WHERE workspace_key = ?';
    let countParams = [claims.workspace_key];
    if (claims.role === 'superadmin') {
      countQuery = 'SELECT COUNT(*) as total FROM assessments WHERE 1=1';
      countParams = [];
    }
    if (condition) { countQuery += ' AND condition LIKE ?'; countParams.push('%' + condition + '%'); }
    if (tier) { countQuery += ' AND adherence_tier = ?'; countParams.push(tier); }

    const countRow = await env.DB.prepare(countQuery).bind(...countParams).first();

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

// ── MAP Route Handlers ─────────────────────────────────────────────────────

// MAP scoring — pure server-side replication of the client scoreMAP() function.
// Kept here so the Worker can validate and recompute scores independently of
// any client-provided values. The formula is authoritative and must not diverge.
function _workerScoreMAP(q) {
  return _maasScoreMAP([q.q1,q.q2,q.q3,q.q4,q.q5,q.q6,q.q7,q.q8]).pe;
}

function _validateMAPItems(body) {
  // Validate Q1-Q7 binary (0 or 1) and Q8 ordinal (0, 0.25, 0.5, 0.75, 1.0)
  const binaryFields = ['q1','q2','q3','q4','q5','q6','q7'];
  const q8ValidValues = new Set([0, 0.25, 0.5, 0.75, 1.0]);
  const errors = [];

  for (const field of binaryFields) {
    const v = body[field];
    if (v === undefined || v === null) { errors.push(field + ' is required'); continue; }
    const n = parseFloat(v);
    if (isNaN(n) || (n !== 0 && n !== 1)) errors.push(field + ' must be 0 or 1');
  }

  const q8 = parseFloat(body.q8);
  if (body.q8 === undefined || body.q8 === null) {
    errors.push('q8 is required');
  } else if (isNaN(q8) || !q8ValidValues.has(q8)) {
    errors.push('q8 must be one of: 0, 0.25, 0.5, 0.75, 1.0');
  }

  return errors;
}

async function handleMAPSubmit(request, claims, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  // Validate MAP items
  const itemErrors = _validateMAPItems(body);
  if (itemErrors.length) return apiError(400, 'Invalid MAP items: ' + itemErrors.join('; '));

  // Validate assessment_mode if provided
  const validModes = new Set(['clinical','pharmacy','self','research','chw']);
  const assessment_mode = body.assessment_mode || 'clinical';
  if (!validModes.has(assessment_mode)) {
    return apiError(400, 'assessment_mode must be one of: clinical, pharmacy, self, research, chw');
  }

  // Parse numeric values
  const items = {
    q1: parseFloat(body.q1), q2: parseFloat(body.q2), q3: parseFloat(body.q3),
    q4: parseFloat(body.q4), q5: parseFloat(body.q5), q6: parseFloat(body.q6),
    q7: parseFloat(body.q7), q8: parseFloat(body.q8),
  };

  // Server-side score computation — authoritative, never trust client-provided scores
  const scores = _workerScoreMAP(items);

  const record = {
    id:               crypto.randomUUID(),
    instrument_type:  'map',
    workspace_key:    claims.workspace_key,
    q1: items.q1, q2: items.q2, q3: items.q3, q4: items.q4,
    q5: items.q5, q6: items.q6, q7: items.q7, q8: items.q8,
    mmas_score:       null,
    adherence_tier:   scores.low_adherence ? 'low' : scores.pe >= 0.75 ? 'high' : 'medium',
    arch_score:       parseFloat(scores.arch.toFixed(6)),
    exec_score:       parseFloat(scores.exec.toFixed(6)),
    ctx_score:        parseFloat(scores.cg.toFixed(6)),
    pe_score:         parseFloat(scores.pe.toFixed(6)),
    peacs_phenotype:  body.peacs_phenotype || null,
    patient_number:   body.patient_number  || null,
    condition:        body.condition       || null,
    medication:       body.medication      || null,
    country:          body.country         || null,
    country_iso2:     body.country_iso2    || null,
    language:         body.language        || 'en',
    collection_method: 'api',
    assessment_mode:  assessment_mode,
    session_id:       body.session_id      || null,
    assessor_id:      body.assessor_id     || null,
    site_id:          body.site_id         || null,
    ts:               Date.now(),
    submitted_at:     new Date().toISOString(),
  };

  try {
    await env.DB.prepare(`
      INSERT INTO assessments
      (id, instrument_type, workspace_key,
       q1, q2, q3, q4, q5, q6, q7, q8,
       mmas_score, adherence_tier,
       arch_score, exec_score, ctx_score, pe_score, peacs_phenotype,
       patient_number, condition, medication, country, country_iso2,
       language, collection_method, assessment_mode, session_id, assessor_id,
       site_id, ts, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      record.id, record.instrument_type, record.workspace_key,
      record.q1, record.q2, record.q3, record.q4,
      record.q5, record.q6, record.q7, record.q8,
      record.mmas_score, record.adherence_tier,
      record.arch_score, record.exec_score, record.ctx_score,
      record.pe_score, record.peacs_phenotype,
      record.patient_number, record.condition, record.medication,
      record.country, record.country_iso2,
      record.language, record.collection_method, record.assessment_mode,
      record.session_id, record.assessor_id,
      record.site_id, record.ts, record.submitted_at
    ).run();

    // Update longitudinal session record if session_id provided
    if (record.session_id) {
      ctx.waitUntil(_updateMAPSessionD1(record, scores, env));
    }

    return apiResponse({
      ...record,
      computed: {
        pe:           record.pe_score,
        architecture: record.arch_score,
        execution:    record.exec_score,
        context_guard:record.ctx_score,
        additive:     parseFloat(scores.additive.toFixed(2)),
        low_adherence:scores.low_adherence,
        dominant_failure: scores.dominant,
      }
    }, 201);
  } catch(e) {
    return apiError(500, 'Failed to save MAP assessment', e.message);
  }
}

async function _updateMAPSessionD1(record, scores, env) {
  // Upsert map_longitudinal_sessions row for this session_id.
  // Trajectory columns are JSON arrays grown with each new assessment.
  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM map_longitudinal_sessions WHERE session_id = ?'
    ).bind(record.session_id).first();

    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO map_longitudinal_sessions
        (session_id, patient_number, workspace_key, condition,
         started_at, last_updated, assessment_count,
         baseline_pe, latest_pe,
         arch_trajectory, exec_trajectory, ctx_trajectory, pe_trajectory,
         dropout_risk, dominant_domain)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        record.session_id,
        record.patient_number || '',
        record.workspace_key,
        record.condition || null,
        record.ts, record.ts, 1,
        record.pe_score, record.pe_score,
        JSON.stringify([record.arch_score]),
        JSON.stringify([record.exec_score]),
        JSON.stringify([record.ctx_score]),
        JSON.stringify([record.pe_score]),
        null,
        scores.dominant || null
      ).run();
    } else {
      const archTraj = _parseJsonArray(existing.arch_trajectory);
      const execTraj = _parseJsonArray(existing.exec_trajectory);
      const ctxTraj  = _parseJsonArray(existing.ctx_trajectory);
      const peTraj   = _parseJsonArray(existing.pe_trajectory);

      archTraj.push(record.arch_score);
      execTraj.push(record.exec_score);
      ctxTraj.push(record.ctx_score);
      peTraj.push(record.pe_score);

      await env.DB.prepare(`
        UPDATE map_longitudinal_sessions
        SET last_updated = ?, assessment_count = ?, latest_pe = ?,
            arch_trajectory = ?, exec_trajectory = ?,
            ctx_trajectory = ?, pe_trajectory = ?,
            dominant_domain = ?
        WHERE session_id = ?
      `).bind(
        record.ts,
        (existing.assessment_count || 0) + 1,
        record.pe_score,
        JSON.stringify(archTraj),
        JSON.stringify(execTraj),
        JSON.stringify(ctxTraj),
        JSON.stringify(peTraj),
        scores.dominant || existing.dominant_domain,
        record.session_id
      ).run();
    }
  } catch(e) {
    console.error('_updateMAPSessionD1 failed:', e.message);
  }
}

function _parseJsonArray(str) {
  if (!str) return [];
  try { const v = JSON.parse(str); return Array.isArray(v) ? v : []; }
  catch(e) { return []; }
}

async function handleMAPSession(sessionId, claims, env) {
  if (!sessionId || sessionId.length > 128) return apiError(400, 'Invalid session ID');

  try {
    // Retrieve session metadata
    const session = await env.DB.prepare(
      'SELECT * FROM map_longitudinal_sessions WHERE session_id = ?'
    ).bind(sessionId).first();

    if (!session) return apiError(404, 'Session not found');

    // Enforce workspace access (superadmin bypasses)
    if (claims.role !== 'superadmin' && session.workspace_key !== claims.workspace_key) {
      return apiError(403, 'Access denied to this session');
    }

    // Fetch all assessments for this session
    const { results: assessments } = await env.DB.prepare(
      'SELECT * FROM assessments WHERE session_id = ? AND instrument_type = ? ORDER BY ts ASC'
    ).bind(sessionId, 'map').all();

    return apiResponse({
      session,
      assessments,
      assessment_count: assessments.length,
      pe_trajectory: _parseJsonArray(session.pe_trajectory),
      arch_trajectory: _parseJsonArray(session.arch_trajectory),
      exec_trajectory: _parseJsonArray(session.exec_trajectory),
      ctx_trajectory:  _parseJsonArray(session.ctx_trajectory),
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleMAPCountryProfile(iso2, claims, env) {
  if (!iso2 || iso2.length > 3) return apiError(400, 'Invalid ISO2 country code');
  const cleanIso2 = iso2.toUpperCase().replace(/[^A-Z]/g, '');

  try {
    const row = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_assessments,
        AVG(pe_score) as avg_pe,
        AVG(arch_score) as avg_arch,
        AVG(exec_score) as avg_exec,
        AVG(ctx_score) as avg_ctx,
        MIN(pe_score) as min_pe,
        MAX(pe_score) as max_pe,
        SUM(CASE WHEN pe_score >= 0.85 THEN 1 ELSE 0 END) as optimal_count,
        SUM(CASE WHEN pe_score >= 0.70 AND pe_score < 0.85 THEN 1 ELSE 0 END) as good_count,
        SUM(CASE WHEN pe_score >= 0.55 AND pe_score < 0.70 THEN 1 ELSE 0 END) as moderate_count,
        SUM(CASE WHEN pe_score >= 0.40 AND pe_score < 0.55 THEN 1 ELSE 0 END) as poor_count,
        SUM(CASE WHEN pe_score < 0.40 THEN 1 ELSE 0 END) as critical_count,
        COUNT(DISTINCT condition) as condition_count
      FROM assessments
      WHERE country_iso2 = ? AND instrument_type = 'map' AND pe_score IS NOT NULL
    `).bind(cleanIso2).first();

    if (!row || row.total_assessments === 0) {
      return apiResponse({ iso2: cleanIso2, total_assessments: 0, message: 'No MAP data for this country' });
    }

    // Phenotype frequency for this country
    const { results: phenotypes } = await env.DB.prepare(`
      SELECT peacs_phenotype, COUNT(*) as count
      FROM assessments
      WHERE country_iso2 = ? AND instrument_type = 'map' AND peacs_phenotype IS NOT NULL
      GROUP BY peacs_phenotype ORDER BY count DESC
    `).bind(cleanIso2).all();

    // Dominant failure breakdown
    const { results: conditions } = await env.DB.prepare(`
      SELECT condition, COUNT(*) as count, AVG(pe_score) as avg_pe
      FROM assessments
      WHERE country_iso2 = ? AND instrument_type = 'map' AND condition IS NOT NULL
      GROUP BY condition ORDER BY count DESC LIMIT 10
    `).bind(cleanIso2).all();

    return apiResponse({
      iso2: cleanIso2,
      total_assessments: row.total_assessments,
      triadic_means: {
        architecture:  row.avg_arch  ? parseFloat(row.avg_arch.toFixed(4))  : null,
        execution:     row.avg_exec  ? parseFloat(row.avg_exec.toFixed(4))  : null,
        context_guard: row.avg_ctx   ? parseFloat(row.avg_ctx.toFixed(4))   : null,
        pe:            row.avg_pe    ? parseFloat(row.avg_pe.toFixed(4))    : null,
      },
      pe_range: {
        min: row.min_pe ? parseFloat(row.min_pe.toFixed(4)) : null,
        max: row.max_pe ? parseFloat(row.max_pe.toFixed(4)) : null,
      },
      pe_distribution: {
        optimal:  row.optimal_count,
        good:     row.good_count,
        moderate: row.moderate_count,
        poor:     row.poor_count,
        critical: row.critical_count,
      },
      phenotype_frequencies: phenotypes,
      top_conditions: conditions,
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleMAPWorkspaceSummary(wsKey, claims, env) {
  // Superadmin can query any workspace; others are restricted to their own
  const targetWS = wsKey;
  if (claims.role !== 'superadmin' && targetWS !== claims.workspace_key) {
    return apiError(403, 'Access denied to this workspace');
  }
  if (!targetWS || targetWS.length > 64) return apiError(400, 'Invalid workspace key');

  try {
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(pe_score) as avg_pe,
        AVG(arch_score) as avg_arch,
        AVG(exec_score) as avg_exec,
        AVG(ctx_score) as avg_ctx,
        SUM(CASE WHEN pe_score >= 0.85 THEN 1 ELSE 0 END) as optimal_count,
        SUM(CASE WHEN pe_score >= 0.70 AND pe_score < 0.85 THEN 1 ELSE 0 END) as good_count,
        SUM(CASE WHEN pe_score >= 0.55 AND pe_score < 0.70 THEN 1 ELSE 0 END) as moderate_count,
        SUM(CASE WHEN pe_score >= 0.40 AND pe_score < 0.55 THEN 1 ELSE 0 END) as poor_count,
        SUM(CASE WHEN pe_score < 0.40 THEN 1 ELSE 0 END) as critical_count,
        COUNT(DISTINCT country) as countries,
        COUNT(DISTINCT condition) as conditions,
        COUNT(DISTINCT patient_number) as unique_patients,
        COUNT(DISTINCT session_id) as sessions
      FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map' AND pe_score IS NOT NULL
    `).bind(targetWS).first();

    if (!stats || stats.total === 0) {
      return apiResponse({ workspace_key: targetWS, total: 0, message: 'No MAP assessments for this workspace' });
    }

    // Phenotype frequencies
    const { results: phenotypes } = await env.DB.prepare(`
      SELECT peacs_phenotype, COUNT(*) as count,
             ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM assessments WHERE workspace_key = ? AND instrument_type = 'map'), 1) as pct
      FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map' AND peacs_phenotype IS NOT NULL
      GROUP BY peacs_phenotype ORDER BY count DESC
    `).bind(targetWS, targetWS).all();

    // Assessment mode breakdown
    const { results: modes } = await env.DB.prepare(`
      SELECT assessment_mode, COUNT(*) as count
      FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map'
      GROUP BY assessment_mode ORDER BY count DESC
    `).bind(targetWS).all();

    // Monthly submission trend (last 12 months)
    const { results: trend } = await env.DB.prepare(`
      SELECT strftime('%Y-%m', datetime(ts/1000, 'unixepoch')) as month,
             COUNT(*) as count,
             AVG(pe_score) as avg_pe
      FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map'
        AND ts > (strftime('%s','now','-12 months') * 1000)
      GROUP BY month ORDER BY month ASC
    `).bind(targetWS).all();

    return apiResponse({
      workspace_key: targetWS,
      total: stats.total,
      triadic_means: {
        pe:            stats.avg_pe    ? parseFloat(stats.avg_pe.toFixed(4))    : null,
        architecture:  stats.avg_arch  ? parseFloat(stats.avg_arch.toFixed(4))  : null,
        execution:     stats.avg_exec  ? parseFloat(stats.avg_exec.toFixed(4))  : null,
        context_guard: stats.avg_ctx   ? parseFloat(stats.avg_ctx.toFixed(4))   : null,
      },
      pe_distribution: {
        optimal:  { count: stats.optimal_count,  pct: stats.total ? parseFloat((stats.optimal_count  / stats.total * 100).toFixed(1)) : 0 },
        good:     { count: stats.good_count,     pct: stats.total ? parseFloat((stats.good_count     / stats.total * 100).toFixed(1)) : 0 },
        moderate: { count: stats.moderate_count, pct: stats.total ? parseFloat((stats.moderate_count / stats.total * 100).toFixed(1)) : 0 },
        poor:     { count: stats.poor_count,     pct: stats.total ? parseFloat((stats.poor_count     / stats.total * 100).toFixed(1)) : 0 },
        critical: { count: stats.critical_count, pct: stats.total ? parseFloat((stats.critical_count / stats.total * 100).toFixed(1)) : 0 },
      },
      phenotype_frequencies: phenotypes,
      assessment_modes: modes,
      coverage: {
        countries:       stats.countries,
        conditions:      stats.conditions,
        unique_patients: stats.unique_patients,
        sessions:        stats.sessions,
      },
      monthly_trend: trend,
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

// ── MAP Predictive Non-Adherence Engine ────────────────────────────────────

// _calcTrend — derives a human-readable trend label from an array of scores.
// Uses linear regression slope to classify direction and steepness.
function _calcTrend(arr) {
  if (!arr || arr.length < 2) return 'INSUFFICIENT DATA';
  const n = arr.length;
  // Simple linear regression slope
  const xMean = (n - 1) / 2;
  const yMean = arr.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (arr[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  if (slope < -0.04)  return 'DECLINING';
  if (slope < -0.01)  return 'SLIGHT DECLINE';
  if (slope > 0.04)   return 'IMPROVING';
  if (slope > 0.01)   return 'SLIGHT IMPROVEMENT';
  return 'STABLE';
}

// _daysBetween — converts an array of epoch-ms timestamps to an array of
// integer day-gaps between consecutive entries.
function _daysBetween(timestamps) {
  if (!timestamps || timestamps.length < 2) return [];
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(Math.round((timestamps[i] - timestamps[i - 1]) / 86400000));
  }
  return gaps;
}

// _validatePrediction — checks the AI JSON response conforms to the expected
// schema.  Returns the validated object or throws if malformed.
function _validatePrediction(obj) {
  if (typeof obj !== 'object' || obj === null) throw new Error('Response is not an object');

  const riskScore = parseFloat(obj.risk_score);
  if (isNaN(riskScore) || riskScore < 0 || riskScore > 1) {
    throw new Error('risk_score out of range: ' + obj.risk_score);
  }

  const validSignals = new Set(['architecture', 'execution', 'context_guard', 'none']);
  if (!validSignals.has(obj.primary_signal)) {
    throw new Error('Invalid primary_signal: ' + obj.primary_signal);
  }

  const validConfidences = new Set(['low', 'medium', 'high']);
  if (!validConfidences.has(obj.confidence)) {
    throw new Error('Invalid confidence: ' + obj.confidence);
  }

  const validInterventions = new Set([
    'belief_restructuring', 'habit_support', 'access_support',
    'side_effect_management', 'monitoring_only',
  ]);
  if (!validInterventions.has(obj.intervention_type)) {
    throw new Error('Invalid intervention_type: ' + obj.intervention_type);
  }

  const daysToDropout = obj.days_to_dropout === null || obj.days_to_dropout === undefined
    ? null
    : parseInt(obj.days_to_dropout);

  return {
    risk_score:        parseFloat(riskScore.toFixed(4)),
    primary_signal:    obj.primary_signal,
    days_to_dropout:   daysToDropout,
    confidence:        obj.confidence,
    intervention_type: obj.intervention_type,
    rationale:         String(obj.rationale || '').slice(0, 1000),
  };
}

async function handleMAPPredictDropout(request, claims, env) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  const { session_id, workspace_key } = body;
  if (!session_id) return apiError(400, 'session_id is required');
  if (!workspace_key) return apiError(400, 'workspace_key is required');

  // Workspace access guard
  if (claims.role !== 'superadmin' && workspace_key !== claims.workspace_key) {
    return apiError(403, 'Access denied to this workspace');
  }

  // Load the longitudinal session
  let session;
  try {
    session = await env.DB.prepare(
      'SELECT * FROM map_longitudinal_sessions WHERE session_id = ? AND workspace_key = ?'
    ).bind(session_id, workspace_key).first();
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }

  if (!session) return apiError(404, 'Session not found');

  // Enforce minimum assessment threshold
  const archTraj = _parseJsonArray(session.arch_trajectory);
  const execTraj = _parseJsonArray(session.exec_trajectory);
  const ctxTraj  = _parseJsonArray(session.ctx_trajectory);
  const peTraj   = _parseJsonArray(session.pe_trajectory);

  if (peTraj.length < 2) {
    return apiResponse({
      insufficient_data: true,
      minimum_required: 2,
      current_count: peTraj.length,
      session_id,
    });
  }

  // Load ordered assessment timestamps so we can compute day-gaps
  let assessmentRows;
  try {
    const { results } = await env.DB.prepare(
      'SELECT ts, peacs_phenotype FROM assessments WHERE session_id = ? AND instrument_type = ? ORDER BY ts ASC'
    ).bind(session_id, 'map').all();
    assessmentRows = results;
  } catch(e) {
    assessmentRows = [];
  }

  const timestamps   = assessmentRows.map(r => r.ts);
  const dayGaps      = _daysBetween(timestamps);
  const totalDays    = timestamps.length >= 2
    ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 86400000)
    : 0;

  // Pick the most recent PEACS phenotype
  const latestPhenotype = assessmentRows.length
    ? (assessmentRows[assessmentRows.length - 1].peacs_phenotype || 'Unknown')
    : 'Unknown';

  // Format trajectory arrays as JSON-serialisable strings for the prompt
  const fmt = arr => JSON.stringify(arr.map(v => parseFloat(v.toFixed(3))));

  const prompt = [
    'Analyze this medication adherence trajectory and predict dropout risk.',
    '',
    `Patient has completed ${peTraj.length} MAP assessments over ${totalDays} days.`,
    '',
    `Architecture scores (beliefs/decisions): ${fmt(archTraj)} - trend: ${_calcTrend(archTraj)}`,
    `Execution scores (behavioral reliability): ${fmt(execTraj)} - trend: ${_calcTrend(execTraj)}`,
    `Context-Guard scores (environmental): ${fmt(ctxTraj)} - trend: ${_calcTrend(ctxTraj)}`,
    `PE composite scores: ${fmt(peTraj)} - trend: ${_calcTrend(peTraj)}`,
    `Current PEACS phenotype: ${latestPhenotype}`,
    `Condition: ${session.condition || 'Not specified'}`,
    `Days between assessments: ${JSON.stringify(dayGaps)}`,
    '',
    'Based on clinical adherence research, provide a structured risk assessment:',
    '1. Dropout risk score (0.0 to 1.0, where 1.0 = certain dropout within 60 days)',
    '2. Primary warning signal (which domain is the leading indicator)',
    '3. Days to estimated dropout (if risk > 0.5)',
    '4. Confidence level (low/medium/high)',
    '5. Recommended intervention type',
    '6. Clinical rationale (2-3 sentences)',
    '',
    'Respond ONLY with valid JSON matching this exact schema:',
    '{"risk_score": 0.0-1.0, "primary_signal": "architecture|execution|context_guard|none", "days_to_dropout": null or integer, "confidence": "low|medium|high", "intervention_type": "belief_restructuring|habit_support|access_support|side_effect_management|monitoring_only", "rationale": "string"}',
  ].join('\n');

  // Call Cloudflare Workers AI
  let rawAiResponse;
  try {
    rawAiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a clinical pharmacist AI specializing in medication adherence prediction. You output ONLY valid JSON — no markdown, no explanation, no code fences. The JSON must be syntactically valid and match the exact schema requested.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 512,
      temperature: 0.1,
    });
  } catch(e) {
    return apiError(502, 'AI inference failed', e.message);
  }

  // Extract text response
  const aiText = (rawAiResponse && rawAiResponse.response)
    ? rawAiResponse.response.trim()
    : '';

  // Parse the AI JSON — strip any accidental markdown fences first
  let prediction;
  try {
    const jsonStr = aiText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(jsonStr);
    prediction = _validatePrediction(parsed);
  } catch(e) {
    // Return a degraded response rather than a 500 so the front-end can display a fallback
    return apiResponse({
      session_id,
      prediction_failed: true,
      failure_reason: 'AI response could not be parsed: ' + e.message,
      raw_ai_output: aiText.slice(0, 500),
      trajectory: { arch: archTraj, exec: execTraj, ctx: ctxTraj, pe: peTraj },
    });
  }

  // Persist the risk score back to the session row
  try {
    await env.DB.prepare(
      'UPDATE map_longitudinal_sessions SET dropout_risk = ?, last_updated = ? WHERE session_id = ?'
    ).bind(prediction.risk_score, Date.now(), session_id).run();
  } catch(e) {
    // Non-fatal: log and continue
    console.error('Failed to persist dropout_risk:', e.message);
  }

  return apiResponse({
    session_id,
    workspace_key,
    prediction,
    trajectory: {
      assessment_count:  peTraj.length,
      total_days:        totalDays,
      day_gaps:          dayGaps,
      architecture:      archTraj,
      execution:         execTraj,
      context_guard:     ctxTraj,
      pe:                peTraj,
      trends: {
        architecture:  _calcTrend(archTraj),
        execution:     _calcTrend(execTraj),
        context_guard: _calcTrend(ctxTraj),
        pe:            _calcTrend(peTraj),
      },
    },
    session: {
      patient_number: session.patient_number,
      condition:      session.condition,
      baseline_pe:    session.baseline_pe,
      latest_pe:      session.latest_pe,
      started_at:     session.started_at,
      last_updated:   session.last_updated,
      peacs_phenotype: latestPhenotype,
    },
    predicted_at: new Date().toISOString(),
  });
}

async function handleMAPRiskDashboard(wsKey, claims, env) {
  // Access guard
  if (claims.role !== 'superadmin' && wsKey !== claims.workspace_key) {
    return apiError(403, 'Access denied to this workspace');
  }
  if (!wsKey || wsKey.length > 64) return apiError(400, 'Invalid workspace key');

  try {
    const { results: sessions } = await env.DB.prepare(`
      SELECT
        session_id,
        patient_number,
        condition,
        latest_pe,
        dropout_risk,
        dominant_domain,
        assessment_count,
        started_at,
        last_updated,
        pe_trajectory
      FROM map_longitudinal_sessions
      WHERE workspace_key = ?
      ORDER BY dropout_risk DESC NULLS LAST, last_updated DESC
      LIMIT 500
    `).bind(wsKey).all();

    // For each session, pull the most recent PEACS phenotype from the assessments table
    // Batch: single query for all session_ids to avoid N+1
    const sessionIds = sessions.map(s => s.session_id);
    let phenotypeMap = {};

    if (sessionIds.length > 0) {
      // D1 doesn't support parameterised arrays, so we build a safe IN clause
      // using only UUID-formatted session IDs (alphanumeric + hyphens, max 128 chars)
      const safeIds = sessionIds
        .filter(id => typeof id === 'string' && /^[\w\-]{1,128}$/.test(id))
        .map(id => "'" + id.replace(/'/g, '') + "'")
        .join(', ');

      if (safeIds) {
        try {
          const { results: phenRows } = await env.DB.prepare(`
            SELECT session_id, peacs_phenotype
            FROM assessments
            WHERE session_id IN (${safeIds}) AND instrument_type = 'map'
              AND peacs_phenotype IS NOT NULL
            ORDER BY ts DESC
          `).all();
          for (const row of phenRows) {
            if (!phenotypeMap[row.session_id]) {
              phenotypeMap[row.session_id] = row.peacs_phenotype;
            }
          }
        } catch(e) {
          // Phenotype enrichment is non-fatal
          console.warn('Phenotype lookup failed:', e.message);
        }
      }
    }

    const patients = sessions.map(s => {
      // Mask patient number to last 4 characters
      const raw = String(s.patient_number || '');
      const masked = raw.length > 4
        ? '\u00B7\u00B7\u00B7' + raw.slice(-4)   // ···XXXX
        : raw || 'Unknown';

      const peTraj = _parseJsonArray(s.pe_trajectory);
      const lastAssessmentDate = s.last_updated
        ? new Date(s.last_updated).toISOString()
        : null;

      return {
        session_id:          s.session_id,
        patient_number:      masked,
        condition:           s.condition || null,
        current_pe:          s.latest_pe  != null ? parseFloat(s.latest_pe.toFixed(4))  : null,
        baseline_pe:         peTraj.length ? parseFloat(peTraj[0].toFixed(4)) : null,
        dropout_risk:        s.dropout_risk != null ? parseFloat(s.dropout_risk.toFixed(4)) : null,
        primary_signal:      s.dominant_domain || null,
        assessment_count:    s.assessment_count || 0,
        last_assessment_date: lastAssessmentDate,
        peacs_phenotype:     phenotypeMap[s.session_id] || null,
        risk_tier:           s.dropout_risk == null ? 'unscored'
                             : s.dropout_risk >= 0.70 ? 'high'
                             : s.dropout_risk >= 0.40 ? 'elevated'
                             : 'low',
      };
    });

    // Summary counts
    const scored   = patients.filter(p => p.dropout_risk != null);
    const highRisk = scored.filter(p => p.dropout_risk >= 0.70).length;
    const elevated = scored.filter(p => p.dropout_risk >= 0.40 && p.dropout_risk < 0.70).length;
    const lowRisk  = scored.filter(p => p.dropout_risk < 0.40).length;

    return apiResponse({
      workspace_key:   wsKey,
      total_patients:  patients.length,
      summary: {
        scored:        scored.length,
        unscored:      patients.length - scored.length,
        high_risk:     highRisk,
        elevated_risk: elevated,
        low_risk:      lowRisk,
      },
      patients,
      generated_at: new Date().toISOString(),
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

// ── MAP Certification Handlers ─────────────────────────────────────────────

// _genCertNumber — produces MAP-CERT-{ISO2}-{YEAR}-{6 random digits}
// iso2 is validated to letters only; falls back to 'XX' if missing.
function _genCertNumber(iso2, level) {
  const clean = (iso2 || 'XX').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'XX';
  const year  = new Date().getFullYear();
  const rand  = String(Math.floor(100000 + Math.random() * 900000));
  const prefix = level === 'advanced' ? 'MAP-ADV' : level === 'trainer' ? 'MAP-TRN' : 'MAP-CERT';
  return `${prefix}-${clean}-${year}-${rand}`;
}

async function handleCertIssue(request, uid, claims, env) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  const { practitioner_name, practitioner_role, institution, country, country_iso2,
          cert_level, training_score, competency_score } = body;

  if (!practitioner_name || !practitioner_name.trim()) {
    return apiError(400, 'practitioner_name is required');
  }

  const level = cert_level || 'foundation';
  const validLevels = new Set(['foundation', 'advanced', 'trainer']);
  if (!validLevels.has(level)) return apiError(400, 'cert_level must be foundation, advanced, or trainer');

  // Score thresholds
  const tScore = parseFloat(training_score);
  const cScore = parseFloat(competency_score);
  if (isNaN(tScore) || tScore < 80) {
    return apiError(422, 'training_score must be >= 80 to issue certification', { training_score: tScore });
  }
  if (isNaN(cScore) || cScore < 75) {
    return apiError(422, 'competency_score must be >= 75 to issue certification', { competency_score: cScore });
  }

  const validRoles = new Set(['pharmacist','physician','nurse','researcher','chw','other']);
  if (practitioner_role && !validRoles.has(practitioner_role)) {
    return apiError(400, 'Invalid practitioner_role');
  }

  const now          = Date.now();
  const twoYearsMs   = 2 * 365.25 * 24 * 60 * 60 * 1000;
  const certId       = crypto.randomUUID();
  const certNumber   = _genCertNumber(country_iso2, level);
  const workspaceKey = claims.workspace_key || body.workspace_key || '';

  const rec = {
    cert_id:           certId,
    user_id:           uid,
    workspace_key:     workspaceKey,
    practitioner_name: practitioner_name.trim(),
    practitioner_role: practitioner_role || null,
    institution:       institution       || null,
    country:           country           || null,
    country_iso2:      country_iso2 ? country_iso2.toUpperCase().slice(0, 2) : null,
    cert_level:        level,
    training_score:    tScore,
    competency_score:  cScore,
    issued_at:         now,
    expires_at:        Math.round(now + twoYearsMs),
    cert_number:       certNumber,
    active:            1,
    renewal_count:     0,
  };

  try {
    await env.DB.prepare(`
      INSERT INTO map_certifications
      (cert_id, user_id, workspace_key, practitioner_name, practitioner_role,
       institution, country, country_iso2, cert_level, training_score, competency_score,
       issued_at, expires_at, cert_number, active, renewal_count)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      rec.cert_id, rec.user_id, rec.workspace_key,
      rec.practitioner_name, rec.practitioner_role,
      rec.institution, rec.country, rec.country_iso2,
      rec.cert_level, rec.training_score, rec.competency_score,
      rec.issued_at, rec.expires_at, rec.cert_number,
      rec.active, rec.renewal_count
    ).run();

    return apiResponse(rec, 201);
  } catch(e) {
    // cert_number UNIQUE constraint — retry once with fresh random
    if (e.message && e.message.includes('UNIQUE')) {
      rec.cert_number = _genCertNumber(country_iso2, level);
      try {
        await env.DB.prepare(`
          INSERT INTO map_certifications
          (cert_id, user_id, workspace_key, practitioner_name, practitioner_role,
           institution, country, country_iso2, cert_level, training_score, competency_score,
           issued_at, expires_at, cert_number, active, renewal_count)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          rec.cert_id, rec.user_id, rec.workspace_key,
          rec.practitioner_name, rec.practitioner_role,
          rec.institution, rec.country, rec.country_iso2,
          rec.cert_level, rec.training_score, rec.competency_score,
          rec.issued_at, rec.expires_at, rec.cert_number,
          rec.active, rec.renewal_count
        ).run();
        return apiResponse(rec, 201);
      } catch(e2) {
        return apiError(500, 'Failed to issue certification', e2.message);
      }
    }
    return apiError(500, 'Failed to issue certification', e.message);
  }
}

async function handleCertVerify(certNumber, env) {
  if (!certNumber || certNumber.length > 32) return apiError(400, 'Invalid cert number');
  const clean = certNumber.toUpperCase().replace(/[^A-Z0-9\-]/g, '');

  try {
    const row = await env.DB.prepare(`
      SELECT practitioner_name, practitioner_role, institution, country, country_iso2,
             cert_level, issued_at, expires_at, cert_number, active
      FROM map_certifications WHERE cert_number = ?
    `).bind(clean).first();

    if (!row) return apiError(404, 'Certification not found');

    return apiResponse({
      cert_number:       row.cert_number,
      practitioner_name: row.practitioner_name,
      practitioner_role: row.practitioner_role,
      institution:       row.institution,
      country:           row.country,
      country_iso2:      row.country_iso2,
      cert_level:        row.cert_level,
      issued_date:       row.issued_at  ? new Date(row.issued_at).toISOString()  : null,
      expiry_date:       row.expires_at ? new Date(row.expires_at).toISOString() : null,
      active:            row.active === 1,
      verified_at:       new Date().toISOString(),
      issuer:            'TESSERA GRC / Scala Carta Foundation',
      verification_url:  'https://atlas.adherence.cc/verify/' + row.cert_number,
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleCertDirectory(url, env) {
  const role    = url.searchParams.get('role')    || null;
  const iso2    = url.searchParams.get('country') || null;
  const level   = url.searchParams.get('level')   || null;
  const search  = url.searchParams.get('q')       || null;
  const page    = Math.max(1, parseInt(url.searchParams.get('page')  || '1'));
  const limit   = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100')));
  const offset  = (page - 1) * limit;

  let query  = `SELECT practitioner_name, practitioner_role, institution, country, country_iso2,
                       cert_level, cert_number, issued_at, expires_at
                FROM map_certifications WHERE active = 1`;
  const params = [];

  if (role)   { query += ' AND practitioner_role = ?';      params.push(role); }
  if (iso2)   { query += ' AND country_iso2 = ?';           params.push(iso2.toUpperCase().slice(0, 2)); }
  if (level)  { query += ' AND cert_level = ?';             params.push(level); }
  if (search) { query += ' AND practitioner_name LIKE ?';   params.push('%' + search + '%'); }

  const countQ = query.replace(
    /SELECT practitioner_name[\s\S]+?FROM map_certifications/,
    'SELECT COUNT(*) as total FROM map_certifications'
  );

  query += ' ORDER BY country_iso2 ASC, practitioner_name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const [{ results }, countRow] = await Promise.all([
      env.DB.prepare(query).bind(...params).all(),
      env.DB.prepare(countQ).bind(...params.slice(0, -2)).first(),
    ]);

    // Group by country
    const grouped = {};
    for (const row of results) {
      const key = row.country_iso2 || 'XX';
      if (!grouped[key]) grouped[key] = { country: row.country, country_iso2: key, practitioners: [] };
      grouped[key].practitioners.push({
        practitioner_name: row.practitioner_name,
        practitioner_role: row.practitioner_role,
        institution:       row.institution,
        cert_level:        row.cert_level,
        cert_number:       row.cert_number,
        issued_date:       row.issued_at  ? new Date(row.issued_at).toISOString()  : null,
        expiry_date:       row.expires_at ? new Date(row.expires_at).toISOString() : null,
        verification_url:  'https://atlas.adherence.cc/verify/' + row.cert_number,
      });
    }

    // Global stats
    const statsRow = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_active,
        COUNT(DISTINCT country_iso2) as countries,
        SUM(CASE WHEN issued_at > ? THEN 1 ELSE 0 END) as issued_this_year
      FROM map_certifications WHERE active = 1
    `).bind(new Date(new Date().getFullYear(), 0, 1).getTime()).first();

    return apiResponse({
      directory:   Object.values(grouped),
      stats: {
        total_certified:       statsRow ? statsRow.total_active       : 0,
        countries_represented: statsRow ? statsRow.countries          : 0,
        issued_this_year:      statsRow ? statsRow.issued_this_year   : 0,
      },
      pagination: {
        page, limit,
        total: countRow ? countRow.total : results.length,
      },
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

async function handleCertWorkspace(wsKey, claims, env) {
  if (!wsKey || wsKey.length > 64) return apiError(400, 'Invalid workspace key');
  if (claims.role !== 'superadmin' && wsKey !== claims.workspace_key) {
    return apiError(403, 'Access denied to this workspace');
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT cert_id, practitioner_name, practitioner_role, institution, country, country_iso2,
             cert_level, training_score, competency_score, issued_at, expires_at,
             cert_number, active, renewal_count
      FROM map_certifications WHERE workspace_key = ?
      ORDER BY issued_at DESC
    `).bind(wsKey).all();

    return apiResponse({
      workspace_key: wsKey,
      certifications: results.map(function(r) {
        return {
          ...r,
          issued_date:  r.issued_at  ? new Date(r.issued_at).toISOString()  : null,
          expiry_date:  r.expires_at ? new Date(r.expires_at).toISOString() : null,
          active:       r.active === 1,
          verification_url: 'https://atlas.adherence.cc/verify/' + r.cert_number,
        };
      }),
      total: results.length,
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MaaS (MAP-as-a-Service) Handlers
// Authentication: SHA-256 hashed Bearer tokens stored in maas_api_keys table.
// Raw keys are NEVER persisted. Only SHA-256 hashes.
// Rate limiting: sliding 1-hour window tracked entirely in D1.
// ══════════════════════════════════════════════════════════════════════════════

// _hashMaaSKey — SHA-256 hash a raw MaaS API key via Web Crypto.
// Returns lowercase hex string matching maas_api_keys.key_hash.
async function _hashMaaSKey(rawKey) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(rawKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// _validateMaaSBearer — look up Bearer token in D1, verify active and within rate limit.
// Returns { ok, keyRow, callsThisHour, nowMs } or { ok: false, error, rateLimited }.
async function _validateMaaSBearer(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing or malformed Authorization header. Expected: Bearer maas_live_...' };
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith('maas_live_')) {
    return { ok: false, error: 'Invalid key format. MaaS keys begin with maas_live_' };
  }

  let keyHash;
  try {
    keyHash = await _hashMaaSKey(rawKey);
  } catch(e) {
    return { ok: false, error: 'Key hashing failed: ' + e.message };
  }

  let keyRow;
  try {
    keyRow = await env.DB.prepare(
      'SELECT * FROM maas_api_keys WHERE key_hash = ? LIMIT 1'
    ).bind(keyHash).first();
  } catch(e) {
    return { ok: false, error: 'Database error during key lookup: ' + e.message };
  }

  if (!keyRow) return { ok: false, error: 'Invalid API key' };
  if (!keyRow.active) return { ok: false, error: 'API key has been revoked' };

  // Sliding 1-hour window: compare integer hour buckets
  const nowMs    = Date.now();
  const nowHour  = Math.floor(nowMs / 3_600_000);
  const prevHour = keyRow.hour_window_start
    ? Math.floor(keyRow.hour_window_start / 3_600_000)
    : -1;

  const callsThisHour = prevHour === nowHour ? (keyRow.calls_this_hour || 0) : 0;

  if (callsThisHour >= keyRow.rate_limit_per_hour) {
    const resetAt = new Date((nowHour + 1) * 3_600_000).toISOString();
    return {
      ok: false,
      rateLimited: true,
      error: `Rate limit exceeded. Limit: ${keyRow.rate_limit_per_hour}/hour. Resets at: ${resetAt}`,
    };
  }

  return { ok: true, keyRow, callsThisHour, nowMs };
}

// _incrementMaaSUsage — update D1 call counters after a successful MaaS call.
// callCount > 1 for batch requests.
async function _incrementMaaSUsage(keyId, callCount, nowMs, env) {
  const nowHour = Math.floor(nowMs / 3_600_000);
  try {
    const current = await env.DB.prepare(
      'SELECT calls_this_hour, hour_window_start FROM maas_api_keys WHERE key_id = ?'
    ).bind(keyId).first();

    const prevHour = current && current.hour_window_start
      ? Math.floor(current.hour_window_start / 3_600_000)
      : -1;

    const base        = prevHour === nowHour ? (current.calls_this_hour || 0) : 0;
    const windowStart = prevHour === nowHour ? current.hour_window_start : nowMs;

    await env.DB.prepare(`
      UPDATE maas_api_keys
      SET calls_this_hour   = ?,
          hour_window_start = ?,
          total_calls       = total_calls + ?,
          last_used         = ?
      WHERE key_id = ?
    `).bind(base + callCount, windowStart, callCount, nowMs, keyId).run();
  } catch(e) {
    console.error('_incrementMaaSUsage failed:', e.message);
  }
}

// _maasScoreMAP — server-side MAP scoring for MaaS (operates on ordered [q1..q8] array).
function _maasScoreMAP(responses) {
  const [q1, q2, q3, q4, q5, q6, q7, q8] = responses;
  const arch    = (q2 + q3 + q6) / 3;
  const exec    = (q1 + q5 + q8) / 3;
  const ctx_raw = (q4 + q7) / 2;
  const cg      = Math.max(0.5, 0.5 + 0.5 * ctx_raw);
  const pe      = Math.pow(arch * exec * cg, 1 / 3);
  const additive = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8;
  const low_adherence = additive < 6;

  const domains = { architecture: arch, execution: exec, context_guard: cg };
  let dominant = Object.keys(domains).reduce((min, k) => domains[k] < domains[min] ? k : min);
  if (arch === exec && exec === cg) dominant = low_adherence ? 'architecture' : 'balanced';

  return { pe, arch, exec, cg, ctx_raw, additive, low_adherence, dominant, q4, q7 };
}

// _PEACS_DESCRIPTORS — clinical narrative text for each phenotype classification.
// Ported from map-assessment.js MAP_I18N.en.phenotypes so the Worker can surface
// full descriptions and intervention protocols to API partners without a platform session.
const _PEACS_DESCRIPTORS = {
  'Optimistic Stopper': {
    description:          'The patient shows adequate behavioral adherence but holds beliefs that medication may no longer be necessary. Symptom resolution or perceived cure is likely driving intentional dose reduction or planned discontinuation.',
    full_intervention:    'Education on illness chronicity; shared goal-setting on long-term medication purpose; re-evaluation of treatment beliefs; structured follow-up to monitor intentional stopping behavior.',
  },
  'Intentional Resistor': {
    description:          'The patient holds beliefs that actively conflict with consistent adherence. Non-adherence is intentional and decision-driven, not circumstantial or forgetful. The Architecture domain is the primary failure.',
    full_intervention:    'Motivational interviewing to explore medication beliefs; collaborative re-framing of perceived necessity and concerns; side-effect discussion and alternative regimen negotiation where appropriate.',
  },
  'Routine Forgetter': {
    description:          'The patient has adequate beliefs about medication but consistently fails to execute the daily routine. Forgetfulness, inconsistent timing, and difficulty remembering are the primary barriers.',
    full_intervention:    'Behavioral cue strategies (alarms, pill organizers, habit stacking with existing routines); pharmacy-initiated blister packs; caregiver or digital reminder integration.',
  },
  'Situational Skipper': {
    description:          'The patient encounters significant environmental, social, or logistical barriers that interrupt adherence. Medication access, cost, side-effect interference, or social context disrupts an otherwise motivated patient.',
    full_intervention:    'Barrier mapping and social support assessment; pharmacy access programs; cost-assistance navigation; regimen simplification to reduce situational demand; peer support linkage.',
  },
  'Side-Effect Avoider': {
    description:          'The patient experiences both environmental friction and side-effect or social interference alongside reduced medication beliefs. The non-adherence pattern is consistent with avoidance driven by medication experience.',
    full_intervention:    'Side-effect review and symptom management strategies; regimen modification discussion with prescriber; patient education on managing expected effects; barrier support programs.',
  },
  'Balanced Low': {
    description:          'The patient shows globally reduced adherence across all three MAP domains without a single dominant failure pattern. Comprehensive intervention addressing beliefs, routine, and context simultaneously is indicated.',
    full_intervention:    'Holistic adherence review; multi-component intervention addressing beliefs, behavioral routines, and environmental barriers in parallel; close monitoring and reassessment after initial intervention.',
  },
  'Adequate Adherent': {
    description:          'The patient demonstrates adequate adherence across Architecture, Execution, and Context-Guard domains. PE score indicates optimal or good adherence health.',
    full_intervention:    'Maintain current regimen and reinforce adherence behaviors at routine follow-up. Schedule reassessment at next clinical visit.',
  },
};

// _maasClassifyPEACS — PEACS phenotype classification for MaaS responses.
// Evaluates 6 branches in order; order is authoritative per PEACS spec.
function _maasClassifyPEACS(s) {
  const { arch, exec, cg, ctx_raw, additive, low_adherence, dominant, q4, q7 } = s;

  const isMin = (domain) => {
    const minVal = Math.min(arch, exec, cg);
    return { architecture: arch, execution: exec, context_guard: cg }[domain] === minVal;
  };

  const TARGETS = {
    architecture:  'Belief restructuring and shared decision-making',
    execution:     'Behavioral cue systems and routine anchoring',
    context_guard: 'Environmental barrier reduction and social support activation',
    balanced:      'Holistic multi-component adherence intervention',
  };

  const _withDesc = (result) => {
    const d = _PEACS_DESCRIPTORS[result.classification] || {};
    return { ...result, description: d.description || null, full_intervention: d.full_intervention || null };
  };

  // 1. Optimistic Stopper: arch low but overall additive still high
  if (arch < 0.5 && additive >= 5) {
    return _withDesc({
      classification:      'Optimistic Stopper',
      confidence:          arch < 0.35 ? 'high' : 'moderate',
      dominant_failure:    'architecture',
      intervention_target: TARGETS.architecture,
    });
  }
  // 2. Intentional Resistor: arch is minimum domain and below threshold
  if (arch < 0.5 && isMin('architecture')) {
    return _withDesc({
      classification:      'Intentional Resistor',
      confidence:          arch < 0.33 ? 'high' : 'moderate',
      dominant_failure:    'architecture',
      intervention_target: TARGETS.architecture,
    });
  }
  // 3. Routine Forgetter: execution is minimum domain and below threshold
  if (exec < 0.5 && isMin('execution')) {
    return _withDesc({
      classification:      'Routine Forgetter',
      confidence:          exec < 0.33 ? 'high' : 'moderate',
      dominant_failure:    'execution',
      intervention_target: TARGETS.execution,
    });
  }
  // 4. Situational Skipper: ctx_raw below threshold (before Cg floor) and context is min
  if (ctx_raw < 0.6 && isMin('context_guard')) {
    return _withDesc({
      classification:      'Situational Skipper',
      confidence:          ctx_raw < 0.4 ? 'high' : 'moderate',
      dominant_failure:    'context_guard',
      intervention_target: TARGETS.context_guard,
    });
  }
  // 5. Side-Effect Avoider: Q4 and Q7 both 0 with mixed low arch and exec
  if (q4 === 0 && q7 === 0 && arch < 0.7 && exec < 0.7) {
    return _withDesc({
      classification:      'Side-Effect Avoider',
      confidence:          'moderate',
      dominant_failure:    dominant === 'balanced' ? null : dominant,
      intervention_target: 'Side-effect review and regimen modification with prescriber',
    });
  }
  // 6. Balanced Low or Adequate
  if (low_adherence) {
    return _withDesc({
      classification:      'Balanced Low',
      confidence:          'low',
      dominant_failure:    dominant === 'balanced' ? null : dominant,
      intervention_target: TARGETS.balanced,
    });
  }
  return _withDesc({
    classification:      'Adequate Adherent',
    confidence:          s.pe >= 0.85 ? 'high' : 'moderate',
    dominant_failure:    null,
    intervention_target: 'Maintain current regimen; reassess at next clinical visit',
  });
}

// _validateMaaSResponses — validate MaaS responses[] array.
// Returns array of error strings (empty = valid).
function _validateMaaSResponses(responses) {
  const errors = [];
  if (!Array.isArray(responses) || responses.length !== 8) {
    errors.push('responses must be an array of exactly 8 numeric values [q1..q8]');
    return errors;
  }
  const q8Valid = new Set([0, 0.25, 0.5, 0.75, 1.0]);
  for (let i = 0; i < 7; i++) {
    const v = parseFloat(responses[i]);
    if (isNaN(v) || (v !== 0 && v !== 1)) {
      errors.push(`Q${i + 1} must be 0 or 1, received: ${responses[i]}`);
    }
  }
  const q8 = parseFloat(responses[7]);
  if (isNaN(q8) || !q8Valid.has(q8)) {
    errors.push(`Q8 must be one of: 0, 0.25, 0.5, 0.75, 1.0 — received: ${responses[7]}`);
  }
  return errors;
}

// _saveMaaSAssessment — persist scored MaaS assessment to D1 assessments table.
// Returns new assessment UUID or null on failure (non-fatal: caller still returns scores).
async function _saveMaaSAssessment(responses, scores, phenotype, keyRow, body, env) {
  const id  = crypto.randomUUID();
  const now = Date.now();
  const pq  = responses.map(v => parseFloat(v));
  const adherence_tier = scores.low_adherence ? 'low' : scores.pe >= 0.75 ? 'high' : 'medium';

  try {
    await env.DB.prepare(`
      INSERT INTO assessments
      (id, instrument_type, workspace_key,
       q1, q2, q3, q4, q5, q6, q7, q8,
       mmas_score, adherence_tier,
       arch_score, exec_score, ctx_score, pe_score, peacs_phenotype,
       patient_number, condition,
       language, collection_method, assessment_mode,
       maas_key_id, api_caller,
       ts, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, 'map', keyRow.workspace_key,
      pq[0], pq[1], pq[2], pq[3], pq[4], pq[5], pq[6], pq[7],
      null, adherence_tier,
      parseFloat(scores.arch.toFixed(6)),
      parseFloat(scores.exec.toFixed(6)),
      parseFloat(scores.cg.toFixed(6)),
      parseFloat(scores.pe.toFixed(6)),
      phenotype.classification,
      body.patient_ref || null,
      body.condition   || null,
      'en', 'maas_api', 'api',
      keyRow.key_id,
      keyRow.partner_name,
      now, new Date(now).toISOString()
    ).run();
    return id;
  } catch(e) {
    console.error('_saveMaaSAssessment failed:', e.message);
    return null;
  }
}

// _maaPETier — convert pe score to 5-level label used across the ATLAS platform.
function _maasPETier(pe) {
  if (pe >= 0.85) return 'optimal';
  if (pe >= 0.70) return 'good';
  if (pe >= 0.55) return 'moderate';
  if (pe >= 0.40) return 'poor';
  return 'critical';
}

// _maasDomainLabel — per-domain strength label (strong/adequate/weak) for partner display.
function _maasDomainLabel(score) {
  if (score >= 0.75) return 'strong';
  if (score >= 0.50) return 'adequate';
  return 'weak';
}

// _buildMaaSScoreResponse — standardised MaaS single-score response payload.
function _buildMaaSScoreResponse(assessmentId, scores, phenotype) {
  const pe            = parseFloat(scores.pe.toFixed(4));
  const arch          = parseFloat(scores.arch.toFixed(4));
  const exec          = parseFloat(scores.exec.toFixed(4));
  const ctx           = parseFloat(scores.cg.toFixed(4));
  const pe_tier       = _maasPETier(pe);
  const adherence_level = scores.low_adherence ? 'low' : pe >= 0.75 ? 'high' : 'medium';
  const risk_flag     = pe_tier === 'critical' || pe_tier === 'poor' ? 'high'
                      : pe_tier === 'moderate' ? 'elevated'
                      : 'none';

  return {
    success:          true,
    assessment_id:    assessmentId,
    scores: {
      pe,
      pe_tier,
      adherence_level,
      architecture:   arch,
      execution:      exec,
      context_guard:  ctx,
      additive:       parseFloat(scores.additive.toFixed(2)),
      low_adherence:  scores.low_adherence,
    },
    domain_analysis: {
      architecture:  { score: arch,  label: _maasDomainLabel(arch), gap_to_optimal: parseFloat(Math.max(0, 1 - arch).toFixed(4))  },
      execution:     { score: exec,  label: _maasDomainLabel(exec), gap_to_optimal: parseFloat(Math.max(0, 1 - exec).toFixed(4))  },
      context_guard: { score: ctx,   label: _maasDomainLabel(ctx),  gap_to_optimal: parseFloat(Math.max(0, 1 - ctx).toFixed(4))   },
    },
    phenotype: {
      classification:      phenotype.classification,
      confidence:          phenotype.confidence,
      dominant_failure:    phenotype.dominant_failure,
      intervention_target: phenotype.intervention_target,
      description:         phenotype.description         || null,
      full_intervention:   phenotype.full_intervention   || null,
    },
    risk_flag,
    meta: {
      instrument:          'MAP',
      version:             '1.1',
      atlas_assessment_id: assessmentId,
    },
  };
}

// POST /api/maas/v1/score
async function handleMaaSScore(request, env, ctx) {
  const auth = await _validateMaaSBearer(request, env);
  if (!auth.ok) return apiError(auth.rateLimited ? 429 : 401, auth.error);

  let body;
  try { body = await request.json(); }
  catch(e) { return apiError(400, 'Malformed JSON request body'); }

  if (!body || !body.responses) {
    return apiError(400, 'Request body must include a responses[] array');
  }

  const validationErrors = _validateMaaSResponses(body.responses);
  if (validationErrors.length) return apiError(422, 'Validation failed', validationErrors);

  const parsed    = body.responses.map(v => parseFloat(v));
  const scores    = _maasScoreMAP(parsed);
  const phenotype = _maasClassifyPEACS(scores);

  const assessmentId = await _saveMaaSAssessment(parsed, scores, phenotype, auth.keyRow, body, env);
  ctx.waitUntil(_incrementMaaSUsage(auth.keyRow.key_id, 1, auth.nowMs, env));

  return new Response(
    JSON.stringify(_buildMaaSScoreResponse(assessmentId, scores, phenotype)),
    { status: 200, headers: { 'Content-Type': 'application/json', ..._cors } }
  );
}

// POST /api/maas/v1/batch — score up to 50 patients in one call.
async function handleMaaSBatch(request, env, ctx) {
  const auth = await _validateMaaSBearer(request, env);
  if (!auth.ok) return apiError(auth.rateLimited ? 429 : 401, auth.error);

  let body;
  try { body = await request.json(); }
  catch(e) { return apiError(400, 'Malformed JSON request body'); }

  if (!body || !Array.isArray(body.assessments)) {
    return apiError(400, 'Request body must include an assessments[] array');
  }

  const MAX_BATCH = 50;
  if (body.assessments.length === 0) return apiError(400, 'assessments[] must not be empty');
  if (body.assessments.length > MAX_BATCH) {
    return apiError(422, `Batch limit exceeded. Maximum ${MAX_BATCH} per call. Received: ${body.assessments.length}`);
  }

  const callCount = body.assessments.length;
  if ((auth.callsThisHour + callCount) > auth.keyRow.rate_limit_per_hour) {
    const remaining = Math.max(0, auth.keyRow.rate_limit_per_hour - auth.callsThisHour);
    return apiError(429, `Batch of ${callCount} would exceed rate limit. Remaining capacity this hour: ${remaining}`);
  }

  const results = [];
  for (let i = 0; i < body.assessments.length; i++) {
    const item = body.assessments[i];

    if (!item || !item.responses) {
      results.push({ index: i, success: false, error: 'Missing responses array' });
      continue;
    }

    const validationErrors = _validateMaaSResponses(item.responses);
    if (validationErrors.length) {
      results.push({ index: i, success: false, error: 'Validation failed', detail: validationErrors });
      continue;
    }

    const parsed    = item.responses.map(v => parseFloat(v));
    const scores    = _maasScoreMAP(parsed);
    const phenotype = _maasClassifyPEACS(scores);
    const assessmentId = await _saveMaaSAssessment(parsed, scores, phenotype, auth.keyRow, item, env);

    results.push({
      index:       i,
      patient_ref: item.patient_ref || null,
      ..._buildMaaSScoreResponse(assessmentId, scores, phenotype),
    });
  }

  ctx.waitUntil(_incrementMaaSUsage(auth.keyRow.key_id, callCount, auth.nowMs, env));

  return new Response(
    JSON.stringify({ success: true, count: results.length, results }),
    { status: 200, headers: { 'Content-Type': 'application/json', ..._cors } }
  );
}

// GET /api/maas/v1/status — API key quota and status check.
async function handleMaaSStatus(request, env) {
  const auth = await _validateMaaSBearer(request, env);
  if (!auth.ok) return apiError(auth.rateLimited ? 429 : 401, auth.error);

  const k        = auth.keyRow;
  const nowHour  = Math.floor(auth.nowMs / 3_600_000);
  const prevHour = k.hour_window_start ? Math.floor(k.hour_window_start / 3_600_000) : -1;
  const callsThisHour = prevHour === nowHour ? (k.calls_this_hour || 0) : 0;

  return new Response(JSON.stringify({
    success:      true,
    partner_name: k.partner_name,
    partner_type: k.partner_type,
    key_prefix:   k.key_prefix,
    active:       !!k.active,
    quota: {
      rate_limit_per_hour: k.rate_limit_per_hour,
      calls_this_hour:     callsThisHour,
      remaining_this_hour: Math.max(0, k.rate_limit_per_hour - callsThisHour),
      hour_resets_at:      new Date((nowHour + 1) * 3_600_000).toISOString(),
    },
    total_calls: k.total_calls || 0,
    created_at:  k.created_at ? new Date(k.created_at).toISOString() : null,
    last_used:   k.last_used  ? new Date(k.last_used).toISOString()  : null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ..._cors },
  });
}

// POST /api/v1/admin/maas/create-key — provision a new MaaS API key (super-admin only).
// Generates a cryptographically random 32-byte key, formats as maas_live_{base64url},
// stores only the SHA-256 hash. Returns the raw key ONCE in the response body.
async function handleMaaSCreateKey(request, claims, env) {
  let body;
  try { body = await request.json(); }
  catch(e) { return apiError(400, 'Malformed JSON request body'); }

  const { workspace_key, partner_name, partner_type, rate_limit_per_hour } = body || {};

  if (!workspace_key) return apiError(400, 'workspace_key is required');
  if (!partner_name)  return apiError(400, 'partner_name is required');

  const validTypes = new Set(['ehr','pharmacy','research','government','pharma','other']);
  if (partner_type && !validTypes.has(partner_type)) {
    return apiError(400, 'partner_type must be one of: ehr, pharmacy, research, government, pharma, other');
  }

  const rateLimit = parseInt(rate_limit_per_hour) || 1000;
  if (rateLimit < 1 || rateLimit > 100_000) {
    return apiError(400, 'rate_limit_per_hour must be between 1 and 100000');
  }

  // Generate cryptographically random 32-byte key
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Encode as base64url (no padding, URL-safe characters)
  const b64url = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const rawKey = 'maas_live_' + b64url;
  const prefix = rawKey.slice(0, 18); // 'maas_live_' + first 8 chars

  const keyHash = await _hashMaaSKey(rawKey);
  const keyId   = crypto.randomUUID();
  const now     = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO maas_api_keys
      (key_id, key_hash, key_prefix, workspace_key, partner_name, partner_type,
       allowed_endpoints, rate_limit_per_hour, calls_this_hour, hour_window_start,
       total_calls, created_at, last_used, active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      keyId, keyHash, prefix, workspace_key, partner_name,
      partner_type || 'other',
      '*', rateLimit, 0, null, 0, now, null, 1
    ).run();
  } catch(e) {
    return apiError(500, 'Failed to create API key', e.message);
  }

  return apiResponse({
    key_id:              keyId,
    raw_key:             rawKey,
    key_prefix:          prefix,
    workspace_key,
    partner_name,
    partner_type:        partner_type || 'other',
    rate_limit_per_hour: rateLimit,
    created_at:          new Date(now).toISOString(),
    warning:             'This API key will not be shown again. Store it securely before closing this response.',
  }, 201);
}

// ── DHIS2 Integration Handlers ─────────────────────────────────────────────
//
// Password encryption: AES-GCM, 256-bit key derived from workspace_key via HKDF.
// Storage format: <iv_b64url>.<ciphertext_b64url>

async function _dhis2DeriveKey(workspaceKey, env) {
  // SECURITY: DHIS2_ENC_SECRET must be set as a Wrangler secret (wrangler secret put DHIS2_ENC_SECRET).
  // NEVER use the default key in production — it is public source code.
  // After setting the secret, all DHIS2 connections must be re-saved to re-encrypt with the real key.
  const secret = env.DHIS2_ENC_SECRET;
  if (!secret || secret === 'atlas-dhis2-default-enc-secret-change-in-prod') {
    throw new Error('DHIS2_ENC_SECRET is not configured — set via: wrangler secret put DHIS2_ENC_SECRET');
  }
  const rawKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt: new TextEncoder().encode(workspaceKey),
      info: new TextEncoder().encode('dhis2-pw-enc'),
    },
    rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

function _b64uEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _b64uDecode(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function _dhis2EncryptPassword(plain, workspaceKey, env) {
  const key = await _dhis2DeriveKey(workspaceKey, env);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return _b64uEncode(iv) + '.' + _b64uEncode(ct);
}

async function _dhis2DecryptPassword(enc, workspaceKey, env) {
  const parts = (enc || '').split('.');
  if (parts.length !== 2) throw new Error('Malformed encrypted password');
  const key   = await _dhis2DeriveKey(workspaceKey, env);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: _b64uDecode(parts[0]) }, key, _b64uDecode(parts[1])
  );
  return new TextDecoder().decode(plain);
}

function _dhis2BasicAuth(username, password) {
  return 'Basic ' + btoa(username + ':' + password);
}

// All outbound DHIS2 HTTP calls. Hard 10-second timeout.
async function _dhis2Fetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res  = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    const ct   = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    clearTimeout(timer);
    return { ok: false, status: 0, data: null, error: e.message };
  }
}

// Retrieves a DHIS2 connection and validates workspace ownership.
async function _dhis2LoadConnection(connectionId, claims, env) {
  if (!connectionId || connectionId.length > 64) return { err: apiError(400, 'Invalid connection ID') };
  const conn = await env.DB.prepare(
    'SELECT * FROM dhis2_connections WHERE id = ? AND active = 1'
  ).bind(connectionId).first();
  if (!conn) return { err: apiError(404, 'DHIS2 connection not found') };
  if (claims.role !== 'superadmin' && conn.workspace_key !== claims.workspace_key) {
    return { err: apiError(403, 'Access denied to this DHIS2 connection') };
  }
  return { conn };
}

// POST /api/v1/dhis2/connect
async function handleDHIS2Connect(request, claims, env) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  const { server_url, username, password, program_id, org_unit_id, map_data_element_prefix } = body;
  if (!server_url) return apiError(400, 'server_url is required');
  if (!username)   return apiError(400, 'username is required');
  if (!password)   return apiError(400, 'password is required');

  let parsedUrl;
  try { parsedUrl = new URL(server_url); }
  catch(e) { return apiError(400, 'server_url is not a valid URL'); }

  const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
  if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
    return apiError(400, 'server_url must use HTTPS for non-localhost connections');
  }

  const baseUrl = server_url.replace(/\/$/, '');

  // Verify credentials against DHIS2 /api/me
  const meResult = await _dhis2Fetch(baseUrl + '/api/me', {
    headers: { 'Authorization': _dhis2BasicAuth(username, password), 'Accept': 'application/json' },
  });

  if (!meResult.ok) {
    const detail = meResult.status === 401
      ? 'Invalid DHIS2 credentials'
      : meResult.status === 0
        ? 'Could not reach DHIS2 server (timeout or network error)'
        : 'DHIS2 server returned HTTP ' + meResult.status;
    return apiError(400, 'DHIS2 connectivity test failed', detail);
  }

  let passwordEnc;
  try {
    passwordEnc = await _dhis2EncryptPassword(password, claims.workspace_key, env);
  } catch(e) {
    return apiError(500, 'Password encryption failed', e.message);
  }

  const id     = crypto.randomUUID();
  const prefix = map_data_element_prefix || 'ATLAS_MAP';
  const now    = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO dhis2_connections
        (id, workspace_key, server_url, username, password_enc,
         program_id, org_unit_id, map_data_element_prefix,
         last_sync, sync_count, active, created_at)
      VALUES (?,?,?,?,?,?,?,?,NULL,0,1,?)
    `).bind(
      id, claims.workspace_key, baseUrl, username, passwordEnc,
      program_id || null, org_unit_id || null, prefix, now
    ).run();

    return apiResponse({
      connection_id: id,
      server_url:    baseUrl,
      username,
      program_id:    program_id  || null,
      org_unit_id:   org_unit_id || null,
      dhis2_user:    meResult.data?.displayName || meResult.data?.username || username,
      created_at:    now,
    }, 201);
  } catch(e) {
    return apiError(500, 'Failed to save DHIS2 connection', e.message);
  }
}

// POST /api/v1/dhis2/sync/:connectionId
async function handleDHIS2Sync(connectionId, claims, env, ctx) {
  const loaded = await _dhis2LoadConnection(connectionId, claims, env);
  if (loaded.err) return loaded.err;
  const { conn } = loaded;

  let password;
  try {
    password = await _dhis2DecryptPassword(conn.password_enc, conn.workspace_key, env);
  } catch(e) {
    return apiError(500, 'Password decryption failed — connection may need to be reconfigured', e.message);
  }

  const authHeader = _dhis2BasicAuth(conn.username, password);

  let assessments;
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        id, submitted_at, ts,
        pe_score, arch_score, exec_score, ctx_score, peacs_phenotype, condition,
        (COALESCE(q1,0)+COALESCE(q2,0)+COALESCE(q3,0)+COALESCE(q4,0)
         +COALESCE(q5,0)+COALESCE(q6,0)+COALESCE(q7,0)+COALESCE(q8,0)) AS additive_score
      FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map'
        AND (dhis2_synced IS NULL OR dhis2_synced = 0)
      ORDER BY ts ASC LIMIT 500
    `).bind(conn.workspace_key).all();
    assessments = results;
  } catch(e) {
    return apiError(500, 'Failed to load pending assessments', e.message);
  }

  if (!assessments.length) {
    return apiResponse({ synced: 0, failed: 0, errors: [], message: 'No pending assessments to sync' });
  }

  const prefix    = conn.map_data_element_prefix || 'ATLAS_MAP';
  const eventsUrl = conn.server_url + '/api/events';
  let synced = 0, failed = 0;
  const errors = [];

  for (const a of assessments) {
    const eventDate = a.submitted_at
      ? a.submitted_at.slice(0, 10)
      : new Date(a.ts).toISOString().slice(0, 10);

    const eventPayload = {
      status: 'COMPLETED',
      eventDate,
      dataValues: [
        { dataElement: prefix + '_PE',        value: a.pe_score       != null ? String(parseFloat(a.pe_score.toFixed(4)))         : '' },
        { dataElement: prefix + '_ARCH',      value: a.arch_score     != null ? String(parseFloat(a.arch_score.toFixed(4)))       : '' },
        { dataElement: prefix + '_EXEC',      value: a.exec_score     != null ? String(parseFloat(a.exec_score.toFixed(4)))       : '' },
        { dataElement: prefix + '_CTX',       value: a.ctx_score      != null ? String(parseFloat(a.ctx_score.toFixed(4)))        : '' },
        { dataElement: prefix + '_ADDITIVE',  value: a.additive_score != null ? String(parseFloat(a.additive_score.toFixed(2)))   : '' },
        { dataElement: prefix + '_PHENOTYPE', value: a.peacs_phenotype || '' },
        { dataElement: prefix + '_CONDITION', value: a.condition || '' },
      ],
    };
    if (conn.program_id)  eventPayload.program = conn.program_id;
    if (conn.org_unit_id) eventPayload.orgUnit  = conn.org_unit_id;

    const result = await _dhis2Fetch(eventsUrl, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    if (result.ok) {
      const eventId = result.data?.response?.importSummaries?.[0]?.reference || null;
      try {
        await env.DB.prepare(
          'UPDATE assessments SET dhis2_synced = 1, dhis2_event_id = ? WHERE id = ?'
        ).bind(eventId, a.id).run();
      } catch(e) {
        console.warn('Failed to mark dhis2_synced for', a.id, e.message);
      }
      synced++;
    } else {
      failed++;
      const errMsg = result.data && typeof result.data === 'object'
        ? (result.data.message || result.data.description || JSON.stringify(result.data).slice(0, 200))
        : (result.error || 'HTTP ' + result.status);
      errors.push({ assessment_id: a.id, error: errMsg });
    }
  }

  // Persist sync stats (fire-and-forget)
  ctx.waitUntil(
    env.DB.prepare(
      'UPDATE dhis2_connections SET last_sync = ?, sync_count = sync_count + ? WHERE id = ?'
    ).bind(Date.now(), synced, connectionId).run()
    .catch(e => console.warn('DHIS2 sync stat update failed:', e.message))
  );

  return apiResponse({ synced, failed, errors, total_pending: assessments.length });
}

// GET /api/v1/dhis2/status/:connectionId
async function handleDHIS2Status(connectionId, claims, env) {
  const loaded = await _dhis2LoadConnection(connectionId, claims, env);
  if (loaded.err) return loaded.err;
  const { conn } = loaded;

  let password = null, serverReachable = false, serverUser = null;
  try { password = await _dhis2DecryptPassword(conn.password_enc, conn.workspace_key, env); }
  catch(e) { /* health will be needs_auth */ }

  if (password) {
    const me = await _dhis2Fetch(conn.server_url + '/api/me', {
      headers: { 'Authorization': _dhis2BasicAuth(conn.username, password), 'Accept': 'application/json' }
    });
    serverReachable = me.ok;
    serverUser = me.data?.displayName || null;
  }

  let pendingCount = 0;
  try {
    const row = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM assessments
      WHERE workspace_key = ? AND instrument_type = 'map'
        AND (dhis2_synced IS NULL OR dhis2_synced = 0)
    `).bind(conn.workspace_key).first();
    pendingCount = row?.cnt || 0;
  } catch(e) { /* non-fatal */ }

  return apiResponse({
    connection_id:    conn.id,
    server_url:       conn.server_url,
    username:         conn.username,
    program_id:       conn.program_id,
    org_unit_id:      conn.org_unit_id,
    server_reachable: serverReachable,
    server_user:      serverUser,
    last_sync:        conn.last_sync,
    sync_count:       conn.sync_count,
    pending_count:    pendingCount,
    active:           conn.active === 1,
    created_at:       conn.created_at,
    health:           password === null ? 'needs_auth' : serverReachable ? 'connected' : 'unreachable',
  });
}

// DELETE /api/v1/dhis2/connect/:connectionId
async function handleDHIS2Disconnect(connectionId, claims, env) {
  const loaded = await _dhis2LoadConnection(connectionId, claims, env);
  if (loaded.err) return loaded.err;

  try {
    await env.DB.prepare('UPDATE dhis2_connections SET active = 0 WHERE id = ?')
      .bind(connectionId).run();
    return apiResponse({ connection_id: connectionId, deactivated: true });
  } catch(e) {
    return apiError(500, 'Failed to deactivate connection', e.message);
  }
}

// POST /api/v1/dhis2/pull-orgunits/:connectionId
async function handleDHIS2PullOrgUnits(connectionId, claims, env) {
  const loaded = await _dhis2LoadConnection(connectionId, claims, env);
  if (loaded.err) return loaded.err;
  const { conn } = loaded;

  let password;
  try {
    password = await _dhis2DecryptPassword(conn.password_enc, conn.workspace_key, env);
  } catch(e) {
    return apiError(500, 'Password decryption failed', e.message);
  }

  const authHeader = _dhis2BasicAuth(conn.username, password);

  // Fetch org units within the API user's accessible hierarchy
  const ouUrl = conn.server_url
    + '/api/organisationUnits.json'
    + '?fields=id,displayName,level,path,children[id,displayName,level,path]'
    + '&paging=false&order=level:asc,displayName:asc'
    + '&withinUserHierarchy=true';

  const result = await _dhis2Fetch(ouUrl, {
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
  });

  if (!result.ok) {
    return apiError(502, 'Failed to fetch org units from DHIS2', 'HTTP ' + result.status);
  }

  const flatUnits = result.data?.organisationUnits || [];

  function buildOrgTree(units) {
    const nodeMap = {};
    units.forEach(u => {
      nodeMap[u.id] = { id: u.id, name: u.displayName, level: u.level, path: u.path, children: [] };
    });
    units.forEach(u => {
      (u.children || []).forEach(c => {
        if (!nodeMap[c.id]) {
          nodeMap[c.id] = { id: c.id, name: c.displayName, level: c.level, path: c.path, children: [] };
        }
        nodeMap[u.id].children.push(nodeMap[c.id]);
      });
    });
    const roots = units
      .filter(u => (u.path || '').split('/').filter(Boolean).length === 1)
      .map(u => nodeMap[u.id]);
    return roots.length ? roots : Object.values(nodeMap).filter(n => n.level === 1);
  }

  return apiResponse({ org_unit_tree: buildOrgTree(flatUnits), total: flatUnits.length });
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI Annual Snapshot Handlers
// ══════════════════════════════════════════════════════════════════════════════

// Classify a PE score into the three GAI risk tiers.
function _peRiskTier(pe) {
  if (pe >= 0.75) return 'green';
  if (pe >= 0.50) return 'amber';
  return 'high';
}

// POST /api/v1/gai/compute-snapshot
// Aggregates all MAP assessments for the workspace's country for a given year,
// then upserts a row into gai_annual_snapshots.
async function handleGAIComputeSnapshot(request, claims, env) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  const { gai_year, workspace_key } = body;
  if (!gai_year || typeof gai_year !== 'number' || gai_year < 2000 || gai_year > 2100) {
    return apiError(400, 'gai_year must be a four-digit integer (e.g. 2025)');
  }

  // Determine which workspace to query: super-admin can specify any, others use their own.
  const targetWS = (claims.role === 'superadmin' && workspace_key) ? workspace_key : claims.workspace_key;
  if (!targetWS) return apiError(400, 'workspace_key is required');

  // Year window in milliseconds (ts column is epoch ms).
  const yearStart = new Date(gai_year, 0, 1).getTime();
  const yearEnd   = new Date(gai_year + 1, 0, 1).getTime();

  try {
    // Fetch all MAP assessments for this workspace within the target year.
    const { results: rows } = await env.DB.prepare(`
      SELECT pe_score, arch_score, exec_score, ctx_score,
             condition, country, country_iso2
      FROM assessments
      WHERE workspace_key = ?
        AND instrument_type = 'map'
        AND pe_score IS NOT NULL
        AND ts >= ? AND ts < ?
    `).bind(targetWS, yearStart, yearEnd).all();

    if (!rows || rows.length === 0) {
      return apiError(422, 'No MAP assessments found for this workspace in the specified year');
    }

    // Determine country from the majority of rows.
    const countryVotes = {};
    const countryNameVotes = {};
    rows.forEach(function(r) {
      const iso = r.country_iso2 || 'XX';
      countryVotes[iso] = (countryVotes[iso] || 0) + 1;
      if (r.country) countryNameVotes[iso] = r.country;
    });
    const country_iso2 = Object.keys(countryVotes).reduce(function(a, b) {
      return countryVotes[a] >= countryVotes[b] ? a : b;
    });
    const country_name = countryNameVotes[country_iso2] || country_iso2;

    const n = rows.length;

    // Compute domain means.
    let archSum = 0, execSum = 0, ctxSum = 0, peSum = 0;
    let archN = 0, execN = 0, ctxN = 0, peN = 0;
    let high = 0, amber = 0, green = 0;

    // Conditions breakdown: { condition: { n, pe_sum } }.
    const condMap = {};

    rows.forEach(function(r) {
      if (r.arch_score != null) { archSum += r.arch_score; archN++; }
      if (r.exec_score != null) { execSum += r.exec_score; execN++; }
      if (r.ctx_score  != null) { ctxSum  += r.ctx_score;  ctxN++; }
      if (r.pe_score   != null) {
        peSum += r.pe_score;
        peN++;
        const tier = _peRiskTier(r.pe_score);
        if (tier === 'high')  high++;
        else if (tier === 'amber') amber++;
        else green++;
      }
      if (r.condition) {
        if (!condMap[r.condition]) condMap[r.condition] = { n: 0, pe_sum: 0 };
        condMap[r.condition].n++;
        if (r.pe_score != null) condMap[r.condition].pe_sum += r.pe_score;
      }
    });

    const arch_mean = archN ? archSum / archN : null;
    const exec_mean = execN ? execSum / execN : null;
    const ctx_mean  = ctxN  ? ctxSum  / ctxN  : null;
    const pe_mean   = peN   ? peSum   / peN   : null;

    // Determine dominant domain (lowest mean).
    let dominant_domain = 'balanced';
    if (arch_mean != null && exec_mean != null && ctx_mean != null) {
      const domains = { architecture: arch_mean, execution: exec_mean, context_guard: ctx_mean };
      const minKey = Object.keys(domains).reduce(function(a, b) {
        return domains[a] <= domains[b] ? a : b;
      });
      const vals = Object.values(domains);
      const minVal = domains[minKey];
      const allEqual = vals.every(function(v) { return Math.abs(v - minVal) < 0.001; });
      dominant_domain = allEqual ? 'balanced' : minKey;
    }

    const total = high + amber + green || 1;
    const risk_pct_high  = parseFloat(((high  / total) * 100).toFixed(2));
    const risk_pct_amber = parseFloat(((amber / total) * 100).toFixed(2));
    const risk_pct_green = parseFloat(((green / total) * 100).toFixed(2));

    const conditions_json = JSON.stringify(
      Object.entries(condMap).sort(function(a, b) { return b[1].n - a[1].n; }).map(function(entry) {
        return {
          condition:   entry[0],
          n:           entry[1].n,
          pe_mean:     entry[1].n ? parseFloat((entry[1].pe_sum / entry[1].n).toFixed(4)) : null,
        };
      })
    );

    const snapshot_id  = crypto.randomUUID();
    const created_at   = Date.now();

    // Upsert: if a row for (gai_year, country_iso2) already exists, replace it.
    await env.DB.prepare(`
      INSERT INTO gai_annual_snapshots
        (snapshot_id, gai_year, country_iso2, country_name, n_assessments,
         pe_mean, arch_mean, exec_mean, ctx_mean, dominant_domain,
         risk_pct_high, risk_pct_amber, risk_pct_green, conditions_json,
         created_at, is_published)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(gai_year, country_iso2) DO UPDATE SET
        snapshot_id    = excluded.snapshot_id,
        country_name   = excluded.country_name,
        n_assessments  = excluded.n_assessments,
        pe_mean        = excluded.pe_mean,
        arch_mean      = excluded.arch_mean,
        exec_mean      = excluded.exec_mean,
        ctx_mean       = excluded.ctx_mean,
        dominant_domain= excluded.dominant_domain,
        risk_pct_high  = excluded.risk_pct_high,
        risk_pct_amber = excluded.risk_pct_amber,
        risk_pct_green = excluded.risk_pct_green,
        conditions_json= excluded.conditions_json,
        created_at     = excluded.created_at
    `).bind(
      snapshot_id, gai_year, country_iso2, country_name, n,
      pe_mean   != null ? parseFloat(pe_mean.toFixed(6))   : null,
      arch_mean != null ? parseFloat(arch_mean.toFixed(6)) : null,
      exec_mean != null ? parseFloat(exec_mean.toFixed(6)) : null,
      ctx_mean  != null ? parseFloat(ctx_mean.toFixed(6))  : null,
      dominant_domain,
      risk_pct_high, risk_pct_amber, risk_pct_green,
      conditions_json, created_at
    ).run();

    return apiResponse({
      snapshot_id,
      gai_year,
      country_iso2,
      country_name,
      n_assessments:   n,
      pe_mean,
      arch_mean,
      exec_mean,
      ctx_mean,
      dominant_domain,
      risk_pct_high,
      risk_pct_amber,
      risk_pct_green,
      conditions:      JSON.parse(conditions_json),
      is_published:    false,
      created_at,
      note: 'Snapshot computed. Set is_published=1 to make visible on the public GAI dashboard.',
    }, 201);
  } catch(e) {
    return apiError(500, 'Snapshot computation failed', e.message);
  }
}

// GET /api/v1/gai/snapshots/:year [PUBLIC]
// Returns all published GAI snapshots for the given year, sorted by pe_mean descending.
async function handleGAISnapshotsPublic(year, env) {
  if (!year || year < 2000 || year > 2100) return apiError(400, 'Invalid year');

  try {
    const { results } = await env.DB.prepare(`
      SELECT snapshot_id, gai_year, country_iso2, country_name, n_assessments,
             pe_mean, arch_mean, exec_mean, ctx_mean, dominant_domain,
             risk_pct_high, risk_pct_amber, risk_pct_green, conditions_json, created_at
      FROM gai_annual_snapshots
      WHERE gai_year = ? AND is_published = 1
      ORDER BY pe_mean DESC
    `).bind(year).all();

    const snapshots = (results || []).map(function(r) {
      return {
        ...r,
        conditions: _parseJsonArray(r.conditions_json),
        conditions_json: undefined,
      };
    });

    return apiResponse({
      year,
      count:     snapshots.length,
      snapshots,
    });
  } catch(e) {
    return apiError(500, 'Database error', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Open Data Handlers
// ══════════════════════════════════════════════════════════════════════════════

// Validate an open-data download token from Authorization header or ?token= query param.
async function _validateOpenDataToken(request, env) {
  let token = null;

  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('token') || null;
  }

  if (!token) return { ok: false, error: 'Access token required. Include Authorization: Bearer <token> or ?token=<token>' };

  try {
    const row = await env.DB.prepare(
      'SELECT * FROM open_data_requests WHERE token = ? AND approved = 1 LIMIT 1'
    ).bind(token).first();

    if (!row) return { ok: false, error: 'Invalid or unrecognised access token' };
    if (!row.token_expires || row.token_expires < Date.now()) {
      return { ok: false, error: 'Access token has expired. Please contact the TESSERA Data Committee to renew.' };
    }

    return { ok: true, row };
  } catch(e) {
    return { ok: false, error: 'Token validation error: ' + e.message };
  }
}

// GET /api/v1/open-data/catalog [PUBLIC]
// Returns metadata about available open-data packages (published GAI snapshots).
async function handleOpenDataCatalog(env) {
  try {
    // Summarise available published data by year.
    const { results: years } = await env.DB.prepare(`
      SELECT
        gai_year,
        COUNT(*) as country_count,
        SUM(n_assessments) as total_assessments,
        MIN(created_at) as earliest_snapshot
      FROM gai_annual_snapshots
      WHERE is_published = 1
      GROUP BY gai_year
      ORDER BY gai_year DESC
    `).all();

    const packages = (years || []).map(function(y) {
      return {
        year:              y.gai_year,
        countries_included: y.country_count,
        total_assessments: y.total_assessments,
        published_at:      y.earliest_snapshot ? new Date(y.earliest_snapshot).toISOString() : null,
        fields_available:  [
          'country_iso2', 'country_name', 'year',
          'condition', 'n',
          'pe_mean', 'arch_mean', 'exec_mean', 'ctx_mean',
          'dominant_domain',
          'risk_pct_high', 'risk_pct_amber', 'risk_pct_green',
        ],
        format_options:    ['csv'],
        access_requirements: 'Free to approved researchers. Submit a request at /api/v1/open-data/request-access. Access reviewed within 5 business days.',
        doi_pending: `tessera.${y.gai_year}`,
        download_endpoint: '/api/v1/open-data/download?year=' + y.gai_year,
      };
    });

    return apiResponse({
      initiative:  'TESSERA Open Data Initiative',
      operator:    'Scala Carta Foundation / TESSERA GRC',
      license:     'CC BY 4.0 — acknowledge TESSERA GRC and Scala Carta Foundation in all publications.',
      contact:     'research@scalacartafoundation.org',
      packages,
      total_packages: packages.length,
    });
  } catch(e) {
    return apiError(500, 'Catalog retrieval failed', e.message);
  }
}

// GET /api/v1/open-data/download [TOKEN-GATED]
// Returns de-identified, aggregated MAP data as CSV.
// Aggregated at country+condition+year level. No individual patient records.
async function handleOpenDataDownload(request, env) {
  const tokenCheck = await _validateOpenDataToken(request, env);
  if (!tokenCheck.ok) return apiError(401, tokenCheck.error);

  const url  = new URL(request.url);
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year'), 10) : null;

  try {
    // Build the base query: join snapshot-level data with condition breakdowns.
    // Since conditions_json encodes per-condition counts from the snapshot,
    // we expand those out alongside the snapshot domain means.
    let snapshotQuery = `
      SELECT snapshot_id, gai_year, country_iso2, country_name,
             n_assessments, pe_mean, arch_mean, exec_mean, ctx_mean,
             dominant_domain, risk_pct_high, risk_pct_amber, risk_pct_green,
             conditions_json
      FROM gai_annual_snapshots
      WHERE is_published = 1
    `;
    const params = [];
    if (year) { snapshotQuery += ' AND gai_year = ?'; params.push(year); }
    snapshotQuery += ' ORDER BY gai_year DESC, country_iso2 ASC';

    const { results: snapshots } = await env.DB.prepare(snapshotQuery).bind(...params).all();

    if (!snapshots || snapshots.length === 0) {
      return new Response('country_iso2,country_name,year,condition,n,pe_mean,arch_mean,exec_mean,ctx_mean,dominant_domain,risk_pct_high,risk_pct_amber,risk_pct_green\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tessera_open_data.csv"',
          ..._cors,
        },
      });
    }

    const csvHeaders = [
      'country_iso2', 'country_name', 'year', 'condition', 'n',
      'pe_mean', 'arch_mean', 'exec_mean', 'ctx_mean',
      'dominant_domain', 'risk_pct_high', 'risk_pct_amber', 'risk_pct_green',
    ];

    const csvRows = [csvHeaders.join(',')];

    snapshots.forEach(function(snap) {
      const conditions = _parseJsonArray(snap.conditions_json);

      if (conditions.length > 0) {
        conditions.forEach(function(cond) {
          csvRows.push([
            snap.country_iso2,
            JSON.stringify(snap.country_name || ''),
            snap.gai_year,
            JSON.stringify(cond.condition || 'unspecified'),
            cond.n || 0,
            cond.pe_mean   != null ? cond.pe_mean.toFixed(4)       : '',
            snap.arch_mean != null ? snap.arch_mean.toFixed(4)      : '',
            snap.exec_mean != null ? snap.exec_mean.toFixed(4)      : '',
            snap.ctx_mean  != null ? snap.ctx_mean.toFixed(4)       : '',
            snap.dominant_domain || '',
            snap.risk_pct_high  != null ? snap.risk_pct_high.toFixed(2)  : '',
            snap.risk_pct_amber != null ? snap.risk_pct_amber.toFixed(2) : '',
            snap.risk_pct_green != null ? snap.risk_pct_green.toFixed(2) : '',
          ].join(','));
        });
      } else {
        // Snapshot has no condition breakdown: emit one aggregate row.
        csvRows.push([
          snap.country_iso2,
          JSON.stringify(snap.country_name || ''),
          snap.gai_year,
          JSON.stringify('all'),
          snap.n_assessments || 0,
          snap.pe_mean   != null ? snap.pe_mean.toFixed(4)   : '',
          snap.arch_mean != null ? snap.arch_mean.toFixed(4) : '',
          snap.exec_mean != null ? snap.exec_mean.toFixed(4) : '',
          snap.ctx_mean  != null ? snap.ctx_mean.toFixed(4)  : '',
          snap.dominant_domain || '',
          snap.risk_pct_high  != null ? snap.risk_pct_high.toFixed(2)  : '',
          snap.risk_pct_amber != null ? snap.risk_pct_amber.toFixed(2) : '',
          snap.risk_pct_green != null ? snap.risk_pct_green.toFixed(2) : '',
        ].join(','));
      }
    });

    const yearSuffix = year ? ('_' + year) : '';
    return new Response(csvRows.join('\n') + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="tessera_open_data' + yearSuffix + '.csv"',
        ..._cors,
      },
    });
  } catch(e) {
    return apiError(500, 'Download failed', e.message);
  }
}

// POST /api/v1/open-data/request-access [PUBLIC]
// Saves an access request and fires a background notification to Firebase.
async function handleOpenDataRequestAccess(request, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, 'Invalid JSON body');

  const { requester_name, institution, email, purpose } = body;
  if (!requester_name || typeof requester_name !== 'string' || !requester_name.trim()) {
    return apiError(400, 'requester_name is required');
  }
  if (!institution || typeof institution !== 'string' || !institution.trim()) {
    return apiError(400, 'institution is required');
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return apiError(400, 'A valid email address is required');
  }
  if (!purpose || typeof purpose !== 'string' || purpose.trim().length < 20) {
    return apiError(400, 'purpose must be at least 20 characters describing planned use');
  }

  const request_id = crypto.randomUUID();
  const created_at = Date.now();

  try {
    await env.DB.prepare(`
      INSERT INTO open_data_requests
        (request_id, requester_name, institution, email, purpose, created_at)
      VALUES (?,?,?,?,?,?)
    `).bind(
      request_id,
      requester_name.trim(),
      institution.trim(),
      email.trim().toLowerCase(),
      purpose.trim(),
      created_at
    ).run();
  } catch(e) {
    return apiError(500, 'Failed to save access request', e.message);
  }

  // Background: log notification to Firebase open_data_notifications node.
  // Uses env.FIREBASE_DB_URL (set in wrangler.toml as a secret or var).
  ctx.waitUntil(_logOpenDataNotification(request_id, requester_name.trim(), institution.trim(), email.trim(), purpose.trim(), created_at, env));

  return apiResponse({
    request_id,
    status:  'received',
    message: 'Your request has been received. The TESSERA Data Committee reviews requests within 5 business days.',
    contact: 'research@scalacartafoundation.org',
  }, 201);
}

// Background helper: logs the open-data access request to Firebase Realtime Database.
async function _logOpenDataNotification(request_id, requester_name, institution, email, purpose, created_at, env) {
  const firebaseUrl = env.FIREBASE_DB_URL;
  if (!firebaseUrl) return; // Not configured — skip silently.

  try {
    const payload = {
      request_id,
      requester_name,
      institution,
      email,
      purpose,
      notify_email: 'research@scalacartafoundation.org',
      created_at,
      status: 'pending_review',
    };

    await fetch(firebaseUrl + '/open_data_notifications/' + request_id + '.json', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch(e) {
    console.error('_logOpenDataNotification failed:', e.message);
  }
}

// POST /api/v1/admin/open-data/approve/:requestId [SUPER-ADMIN]
// Generates a 30-day access token and saves it to the request record.
async function handleOpenDataApprove(requestId, env) {
  if (!requestId || requestId.length > 64) return apiError(400, 'Invalid request ID');

  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM open_data_requests WHERE request_id = ? LIMIT 1'
    ).bind(requestId).first();

    if (!existing) return apiError(404, 'Access request not found');
    if (existing.approved === 1) {
      return apiResponse({
        request_id:    requestId,
        already_approved: true,
        token:         existing.token,
        token_expires: existing.token_expires,
        note: 'This request was already approved. The existing token is returned.',
      });
    }

    // Generate a cryptographically random 32-byte token, base64url-encoded.
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const token    = 'odt_' + Array.from(rawBytes).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');

    const token_expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await env.DB.prepare(`
      UPDATE open_data_requests
      SET approved = 1, token = ?, token_expires = ?
      WHERE request_id = ?
    `).bind(token, token_expires, requestId).run();

    return apiResponse({
      request_id:    requestId,
      approved:      true,
      token,
      token_expires,
      token_expires_iso: new Date(token_expires).toISOString(),
      requester_name: existing.requester_name,
      institution:    existing.institution,
      email:          existing.email,
      note: 'Share this token with the requester. It grants 30-day read access to GET /api/v1/open-data/download.',
    });
  } catch(e) {
    return apiError(500, 'Approval failed', e.message);
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
