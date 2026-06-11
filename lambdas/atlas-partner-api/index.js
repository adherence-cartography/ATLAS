'use strict';

const admin  = require('firebase-admin');
const https  = require('https');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    ),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      'https://adherence-project-2026-default-rtdb.firebaseio.com'
  });
}
let _db = null;
function getDb() {
  if (!_db) _db = admin.database();
  return _db;
}

// ---------------------------------------------------------------------------
// CORS + response helpers
// ---------------------------------------------------------------------------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Partner-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };
}

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

function errResp(statusCode, message, detail) {
  const body = { error: message };
  if (detail) body.detail = detail;
  return jsonResp(statusCode, body);
}

// ---------------------------------------------------------------------------
// UUID
// ---------------------------------------------------------------------------
function uuidv4() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// ---------------------------------------------------------------------------
// Partner key validation
// ---------------------------------------------------------------------------
async function validatePartner(apiKey) {
  if (!apiKey) return null;
  const snap = await getDb().ref(`partner_keys/${apiKey}`).once('value');
  if (!snap.exists()) return null;
  const partner = snap.val();
  partner.api_key = apiKey;
  return partner;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
async function checkAndIncrementRate(apiKey, rateLimit) {
  const today   = todayKey();
  const ref     = getDb().ref(`partner_usage/${apiKey}/${today}`);
  const limit   = rateLimit || 1000;
  let exceeded  = false;
  let newCount  = 0;

  await ref.transaction(current => {
    const count = (current || 0) + 1;
    newCount = count;
    if (count > limit) {
      exceeded = true;
      return current; // abort — do not increment
    }
    return count;
  });

  return { exceeded, count: newCount, limit };
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------
function scoreMap(q) {
  // Architecture (A): intentional decision-making — Q2, Q3, Q6 → indices 1, 2, 5
  const A  = ((+q[1] || 0) + (+q[2] || 0) + (+q[5] || 0)) / 3;
  // Execution (E): behavioral reliability — Q1, Q5, Q8 → indices 0, 4, 7
  const E  = ((+q[0] || 0) + (+q[4] || 0) + (+q[7] || 0)) / 3;
  // Context-Guard (Cg): environmental friction, floored at 0.5 — Q4, Q7 → indices 3, 6
  const Cg = 0.5 + 0.5 * ((+q[3] || 0) + (+q[6] || 0)) / 2;
  // PE-aligned (multiplicative, 0–1)
  const pe = Math.pow(Math.max(0, A * E * Cg), 1 / 3);
  // Traditional additive (0–8), directly comparable to MMAS-8 benchmarks
  const additive = q.reduce((s, v) => s + (+v || 0), 0);
  return {
    pe:            +pe.toFixed(3),
    architecture:  +A.toFixed(3),
    execution:     +E.toFixed(3),
    context_guard: +Cg.toFixed(3),
    additive:      +additive.toFixed(2),
    low_adherence: additive < 6
  };
}

function scoreMmas(q) {
  let s = 0;
  for (let i = 0; i < 7; i++) s += q[i] ? 0 : 1;
  // Q8 accepts decimal values: Never/Rarely=1.00, Sometimes=0.50, Often=0.25, All the time=0.00
  s += +q[7] || 0;
  const level = s >= 8 ? 'high' : s >= 6 ? 'medium' : 'low';
  const classification = s >= 8 ? 'High Adherence (8)' : s >= 6 ? 'Medium Adherence (6 to <8)' : 'Low Adherence (<6)';
  return {
    score:            +s.toFixed(2),
    normalised:       +(s / 8).toFixed(3),
    adherence_level:  level,
    classification,
    low_adherence:    s < 6
  };
}

// ---------------------------------------------------------------------------
// Phenotype classification
// ---------------------------------------------------------------------------
function classifyPhenotype(base, mvmt, strata) {
  if (base < 0.55 && mvmt >= 0.55 && strata >= 0.55) return 'Intentional Resistor';
  if (mvmt < 0.55 && base >= 0.55 && strata >= 0.55) return 'Routine Forgetter';
  if (strata < 0.55 && base >= 0.55 && mvmt >= 0.55) return 'Situational Skipper';
  if (base < 0.55 && mvmt < 0.55)                    return 'Side-Effect Avoider';
  return 'Optimistic Stopper';
}

// ---------------------------------------------------------------------------
// Intervention library
// ---------------------------------------------------------------------------
const INTERVENTIONS = {
  'Intentional Resistor': {
    strategy: 'Motivational Interviewing',
    actions: [
      'Explore ambivalence with open-ended questions',
      'Collaborative goal-setting',
      'Decisional balance exercise'
    ]
  },
  'Routine Forgetter': {
    strategy: 'Habit Anchoring',
    actions: [
      'Visible pill organizer placement',
      'Smartphone alarm linked to daily routine',
      'Blister pack dispensing'
    ]
  },
  'Situational Skipper': {
    strategy: 'Flexible Dosing Protocol',
    actions: [
      'Travel/emergency medication pack',
      'Agreed \u00b14h dose timing window',
      'Pre-emptive planning for disruptions'
    ]
  },
  'Side-Effect Avoider': {
    strategy: 'Side Effect Management',
    actions: [
      'Identify specific side effect',
      'Timing adjustment (with food/evening)',
      'Therapeutic substitution review'
    ]
  },
  'Optimistic Stopper': {
    strategy: 'Long-term Consequence Education',
    actions: [
      'Calendar-based 30/90/180-day check-ins',
      'Visualise cardiac/disease risk of stopping',
      'Pharmacist review at 3-month mark'
    ]
  }
};

// ---------------------------------------------------------------------------
// Webhook delivery (fire-and-forget)
// ---------------------------------------------------------------------------
function deliverWebhook(partner, payload) {
  if (!partner.webhook_url) return;

  const body      = JSON.stringify(payload);
  const secret    = partner.webhook_secret || '';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  let url;
  try {
    url = new URL(partner.webhook_url);
  } catch (_) {
    console.error(JSON.stringify({ event: 'webhook_invalid_url', partner: partner.api_key, url: partner.webhook_url }));
    return;
  }

  const options = {
    hostname: url.hostname,
    port:     url.port || 443,
    path:     url.pathname + url.search,
    method:   'POST',
    timeout:  5000,
    headers: {
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(body),
      'X-Atlas-Signature': `sha256=${signature}`
    }
  };

  const req = https.request(options, res => {
    console.log(JSON.stringify({
      event:      'webhook_delivered',
      partner:    partner.api_key,
      status:     res.statusCode,
      timestamp:  Date.now()
    }));
    // persist last delivery status
    getDb()
      .ref(`partner_keys/${partner.api_key}/webhook_last_status`)
      .set(res.statusCode)
      .catch(() => {});
  });

  req.on('error', err => {
    console.error(JSON.stringify({
      event:     'webhook_error',
      partner:   partner.api_key,
      message:   err.message,
      timestamp: Date.now()
    }));
    getDb()
      .ref(`partner_keys/${partner.api_key}/webhook_last_status`)
      .set('error')
      .catch(() => {});
  });

  req.on('timeout', () => {
    req.destroy();
    console.error(JSON.stringify({
      event:     'webhook_timeout',
      partner:   partner.api_key,
      timestamp: Date.now()
    }));
  });

  req.write(body);
  req.end();
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
function parseBody(event) {
  try {
    if (!event.body) return {};
    if (typeof event.body === 'object') return event.body;
    return JSON.parse(event.body);
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route: POST /v1/map/submit
// ---------------------------------------------------------------------------
async function handleMapSubmit(event, partner) {
  const body = parseBody(event);
  if (!body) return errResp(400, 'Invalid JSON body');

  const { patient_ref, responses, condition, drug, age_range, gender, city, country, metadata } = body;

  if (!Array.isArray(responses) || responses.length !== 8) {
    return errResp(400, 'responses must be an array of exactly 8 values (0-1)');
  }

  const scores = scoreMap(responses);

  const assessmentId = uuidv4();
  const timestamp    = Date.now();

  const record = {
    assessment_id:    assessmentId,
    tool:             'map',
    source:           'partner_api',
    partner_key:      partner.api_key,
    workspace:        partner.workspace,
    institution_code: partner.workspace,
    patient_ref:      patient_ref || null,
    condition:        condition   || null,
    drug:             drug        || null,
    age_range:        age_range   || null,
    gender:           gender      || null,
    city:             city        || null,
    country:          country     || partner.country || null,
    responses,
    pe:               scores.pe,
    architecture:     scores.architecture,
    execution:        scores.execution,
    context_guard:    scores.context_guard,
    additive:         scores.additive,
    low_adherence:    scores.low_adherence,
    metadata:         metadata || null,
    timestamp
  };

  await getDb().ref(`assessments/${assessmentId}`).set(record);

  console.log(JSON.stringify({
    route:          'map_submit',
    partner:        partner.api_key,
    partner_name:   partner.name,
    assessment_id:  assessmentId,
    instrument:     'map',
    pe:             scores.pe,
    additive:       scores.additive,
    country:        record.country,
    timestamp
  }));

  deliverWebhook(partner, {
    event:         'assessment.completed',
    instrument:    'map',
    assessment_id: assessmentId,
    patient_ref:   patient_ref || null,
    result:        {
      pe:            scores.pe,
      architecture:  scores.architecture,
      execution:     scores.execution,
      context_guard: scores.context_guard,
      additive:      scores.additive,
      low_adherence: scores.low_adherence
    },
    timestamp:     new Date(timestamp).toISOString()
  });

  return jsonResp(200, {
    assessment_id: assessmentId,
    result: {
      pe:            scores.pe,
      architecture:  scores.architecture,
      execution:     scores.execution,
      context_guard: scores.context_guard,
      additive:      scores.additive,
      low_adherence: scores.low_adherence
    },
    timestamp: new Date(timestamp).toISOString()
  });
}

// ---------------------------------------------------------------------------
// Route: POST /v1/mmas/submit
// ---------------------------------------------------------------------------
async function handleMmasSubmit(event, partner) {
  const body = parseBody(event);
  if (!body) return errResp(400, 'Invalid JSON body');

  const { patient_ref, responses, condition, drug, age_range, gender, city, country, metadata } = body;

  if (!Array.isArray(responses) || responses.length !== 8) {
    return errResp(400, 'responses must be an array of exactly 8 values (q1-q7 boolean, q8 1-5)');
  }

  const scores = scoreMmas(responses);
  const assessmentId = uuidv4();
  const timestamp    = Date.now();

  const record = {
    assessment_id:    assessmentId,
    tool:             'mmas',
    source:           'partner_api',
    partner_key:      partner.api_key,
    workspace:        partner.workspace,
    institution_code: partner.workspace,
    patient_ref:      patient_ref || null,
    condition:        condition   || null,
    drug:             drug        || null,
    age_range:        age_range   || null,
    gender:           gender      || null,
    city:             city        || null,
    country:          country     || partner.country || null,
    responses,
    score:            scores.score,
    normalised:       scores.normalised,
    low_adherence:    scores.low_adherence,
    metadata:         metadata || null,
    timestamp
  };

  await getDb().ref(`assessments/${assessmentId}`).set(record);

  console.log(JSON.stringify({
    route:         'mmas_submit',
    partner:       partner.api_key,
    partner_name:  partner.name,
    assessment_id: assessmentId,
    instrument:    'mmas',
    pe_or_score:   scores.score,
    country:       record.country,
    timestamp
  }));

  deliverWebhook(partner, {
    event:         'assessment.completed',
    instrument:    'mmas',
    assessment_id: assessmentId,
    patient_ref:   patient_ref || null,
    result:        scores,
    timestamp:     new Date(timestamp).toISOString()
  });

  return jsonResp(200, {
    assessment_id: assessmentId,
    result:        scores,
    timestamp:     new Date(timestamp).toISOString()
  });
}

// ---------------------------------------------------------------------------
// Route: POST /v1/peacs/submit
// ---------------------------------------------------------------------------
async function handlePeacsSubmit(event, partner) {
  const body = parseBody(event);
  if (!body) return errResp(400, 'Invalid JSON body');

  const { patient_ref, session_type, base, mvmt, strata, pe: inputPe, condition, drug, metadata } = body;

  const validSessionTypes = ['BASE', 'MVMT', 'STRATA'];
  if (session_type && !validSessionTypes.includes(session_type)) {
    return errResp(400, `session_type must be one of: ${validSessionTypes.join(', ')}`);
  }

  // Derive pe: use provided value or compute from base/mvmt/strata
  let peValue = inputPe;
  if (peValue == null && base != null && mvmt != null && strata != null) {
    peValue = +Math.pow(Math.max(0, (+base) * (+mvmt) * (+strata)), 1 / 3).toFixed(3);
  }
  if (peValue == null) {
    return errResp(400, 'Provide either pe or all of base, mvmt, strata to compute pe');
  }

  const bVal = base  != null ? +base  : null;
  const mVal = mvmt  != null ? +mvmt  : null;
  const sVal = strata != null ? +strata : null;

  // Phenotype only classifiable when all three dimensions are present
  let phenotype    = null;
  let intervention = null;
  if (bVal != null && mVal != null && sVal != null) {
    phenotype    = classifyPhenotype(bVal, mVal, sVal);
    intervention = INTERVENTIONS[phenotype];
  }

  const assessmentId = uuidv4();
  const timestamp    = Date.now();

  const record = {
    assessment_id:    assessmentId,
    tool:             'peacs',
    source:           'partner_api',
    partner_key:      partner.api_key,
    workspace:        partner.workspace,
    institution_code: partner.workspace,
    patient_ref:      patient_ref   || null,
    session_type:     session_type  || null,
    base:             bVal,
    mvmt:             mVal,
    strata:           sVal,
    pe:               +peValue,
    phenotype,
    intervention,
    condition:        condition || null,
    drug:             drug      || null,
    metadata:         metadata  || null,
    timestamp
  };

  await getDb().ref(`peacs_assessments/${assessmentId}`).set(record);

  console.log(JSON.stringify({
    route:         'peacs_submit',
    partner:       partner.api_key,
    partner_name:  partner.name,
    assessment_id: assessmentId,
    instrument:    'peacs',
    pe_or_score:   peValue,
    country:       partner.country || null,
    timestamp
  }));

  deliverWebhook(partner, {
    event:         'assessment.completed',
    instrument:    'peacs',
    assessment_id: assessmentId,
    patient_ref:   patient_ref || null,
    result:        { pe: +peValue, phenotype, intervention },
    timestamp:     new Date(timestamp).toISOString()
  });

  return jsonResp(200, {
    assessment_id: assessmentId,
    result: {
      pe:           +peValue,
      phenotype,
      intervention
    },
    timestamp: new Date(timestamp).toISOString()
  });
}

// ---------------------------------------------------------------------------
// Route: GET /v1/results/{assessment_id}
// ---------------------------------------------------------------------------
async function handleGetResult(assessmentId, partner) {
  if (!assessmentId) return errResp(400, 'assessment_id is required');

  // Try assessments first, then peacs_assessments
  let snap = await getDb().ref(`assessments/${assessmentId}`).once('value');
  let record = snap.val();

  if (!record) {
    snap   = await getDb().ref(`peacs_assessments/${assessmentId}`).once('value');
    record = snap.val();
  }

  if (!record) return errResp(404, 'Assessment not found');

  // Verify ownership
  if (record.partner_key !== partner.api_key) {
    return errResp(403, 'This assessment does not belong to your partner account');
  }

  return jsonResp(200, record);
}

// ---------------------------------------------------------------------------
// Route: GET /v1/patient/{patient_ref}/results
// ---------------------------------------------------------------------------
async function handlePatientResults(patientRef, partner, queryParams) {
  if (!patientRef) return errResp(400, 'patient_ref is required');

  const instrumentFilter = queryParams && queryParams.instrument
    ? queryParams.instrument.toLowerCase()
    : null;

  const results = [];

  // Query assessments (map + mmas)
  if (!instrumentFilter || instrumentFilter === 'map' || instrumentFilter === 'mmas') {
    const snap = await getDb()
      .ref('assessments')
      .orderByChild('patient_ref')
      .equalTo(patientRef)
      .once('value');

    snap.forEach(child => {
      const r = child.val();
      if (r.partner_key === partner.api_key) {
        if (!instrumentFilter || r.tool === instrumentFilter) {
          results.push(r);
        }
      }
    });
  }

  // Query peacs_assessments
  if (!instrumentFilter || instrumentFilter === 'peacs') {
    const snap = await getDb()
      .ref('peacs_assessments')
      .orderByChild('patient_ref')
      .equalTo(patientRef)
      .once('value');

    snap.forEach(child => {
      const r = child.val();
      if (r.partner_key === partner.api_key) {
        results.push(r);
      }
    });
  }

  // Sort by timestamp ASC
  results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return jsonResp(200, {
    patient_ref:  patientRef,
    total:        results.length,
    results
  });
}

// ---------------------------------------------------------------------------
// Route: GET /v1/stats
// ---------------------------------------------------------------------------
async function handleStats(partner) {
  const today  = todayKey();
  const month  = currentMonthPrefix();
  const apiKey = partner.api_key;

  // Today's usage
  const todaySnap  = await getDb().ref(`partner_usage/${apiKey}/${today}`).once('value');
  const todayCount = todaySnap.val() || 0;

  // Month total: read all usage keys and sum those matching current month
  const usageSnap = await getDb().ref(`partner_usage/${apiKey}`).once('value');
  let monthTotal  = 0;
  if (usageSnap.exists()) {
    usageSnap.forEach(child => {
      if (child.key && child.key.startsWith(month)) {
        monthTotal += child.val() || 0;
      }
    });
  }

  // Assessment counts (by partner)
  let totalMap = 0, totalMmas = 0, totalPeacs = 0;

  const assessSnap = await getDb()
    .ref('assessments')
    .orderByChild('partner_key')
    .equalTo(apiKey)
    .once('value');
  assessSnap.forEach(child => {
    const r = child.val();
    if (r.tool === 'map')  totalMap++;
    if (r.tool === 'mmas') totalMmas++;
  });

  const peacsSnap = await getDb()
    .ref('peacs_assessments')
    .orderByChild('partner_key')
    .equalTo(apiKey)
    .once('value');
  peacsSnap.forEach(() => { totalPeacs++; });

  // Webhook status
  const partnerSnap   = await getDb().ref(`partner_keys/${apiKey}`).once('value');
  const partnerData   = partnerSnap.val() || {};
  const lastStatus    = partnerData.webhook_last_status || null;

  return jsonResp(200, {
    partner:   partner.name,
    workspace: partner.workspace,
    usage: {
      today:       todayCount,
      rate_limit:  partner.rate_limit || 1000,
      month_total: monthTotal
    },
    assessments: {
      total: totalMap + totalMmas + totalPeacs,
      map:   totalMap,
      mmas:  totalMmas,
      peacs: totalPeacs
    },
    webhook: {
      url_configured:      !!partner.webhook_url,
      last_delivery_status: lastStatus
    }
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  const method  = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const path    = event.path || event.rawPath || '/';
  const headers = corsHeaders();

  // OPTIONS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Health check (no auth)
  if (path === '/v1/health' && method === 'GET') {
    return jsonResp(200, { status: 'ok', version: '1.0', timestamp: new Date().toISOString() });
  }

  // Extract partner key
  const apiKey =
    (event.headers && (event.headers['x-partner-key'] || event.headers['X-Partner-Key'])) ||
    null;

  if (!apiKey) {
    return errResp(401, 'Missing X-Partner-Key header');
  }

  // Validate partner
  let partner;
  try {
    partner = await validatePartner(apiKey);
  } catch (err) {
    console.error(JSON.stringify({ event: 'partner_lookup_error', message: err.message }));
    return errResp(502, 'Error validating partner key', err.message);
  }

  if (!partner) {
    return errResp(401, 'Invalid partner key');
  }

  if (!partner.active) {
    return errResp(403, 'Partner account is inactive. Contact ATLAS support.');
  }

  // Rate limit
  let rateInfo;
  try {
    rateInfo = await checkAndIncrementRate(apiKey, partner.rate_limit);
  } catch (err) {
    console.error(JSON.stringify({ event: 'rate_limit_error', message: err.message }));
    // Non-fatal: allow request through but log
    rateInfo = { exceeded: false };
  }

  if (rateInfo.exceeded) {
    return errResp(429, `Daily rate limit of ${rateInfo.limit} requests exceeded. Resets at midnight UTC.`, {
      limit:  rateInfo.limit,
      count:  rateInfo.count,
      reset:  'midnight UTC'
    });
  }

  // Query params
  const queryParams = event.queryStringParameters || {};

  // ---- Route dispatch ----

  // POST /v1/map/submit
  if (path === '/v1/map/submit' && method === 'POST') {
    const allowed = !partner.instruments || partner.instruments.includes('map');
    if (!allowed) return errResp(403, 'Your partner key does not have access to the MAP instrument');
    try {
      return await handleMapSubmit(event, partner);
    } catch (err) {
      console.error(JSON.stringify({ event: 'map_submit_error', message: err.message, stack: err.stack }));
      return errResp(502, 'Error processing MAP submission', err.message);
    }
  }

  // POST /v1/mmas/submit
  if (path === '/v1/mmas/submit' && method === 'POST') {
    const allowed = !partner.instruments || partner.instruments.includes('mmas');
    if (!allowed) return errResp(403, 'Your partner key does not have access to the MMAS instrument');
    try {
      return await handleMmasSubmit(event, partner);
    } catch (err) {
      console.error(JSON.stringify({ event: 'mmas_submit_error', message: err.message, stack: err.stack }));
      return errResp(502, 'Error processing MMAS submission', err.message);
    }
  }

  // POST /v1/peacs/submit
  if (path === '/v1/peacs/submit' && method === 'POST') {
    const allowed = !partner.instruments || partner.instruments.includes('peacs');
    if (!allowed) return errResp(403, 'Your partner key does not have access to the PEACS instrument');
    try {
      return await handlePeacsSubmit(event, partner);
    } catch (err) {
      console.error(JSON.stringify({ event: 'peacs_submit_error', message: err.message, stack: err.stack }));
      return errResp(502, 'Error processing PEACS submission', err.message);
    }
  }

  // GET /v1/results/{assessment_id}
  const resultsMatch = path.match(/^\/v1\/results\/([^/]+)$/);
  if (resultsMatch && method === 'GET') {
    try {
      return await handleGetResult(resultsMatch[1], partner);
    } catch (err) {
      console.error(JSON.stringify({ event: 'get_result_error', message: err.message }));
      return errResp(502, 'Error retrieving assessment', err.message);
    }
  }

  // GET /v1/patient/{patient_ref}/results
  const patientMatch = path.match(/^\/v1\/patient\/([^/]+)\/results$/);
  if (patientMatch && method === 'GET') {
    try {
      return await handlePatientResults(decodeURIComponent(patientMatch[1]), partner, queryParams);
    } catch (err) {
      console.error(JSON.stringify({ event: 'patient_results_error', message: err.message }));
      return errResp(502, 'Error retrieving patient results', err.message);
    }
  }

  // GET /v1/stats
  if (path === '/v1/stats' && method === 'GET') {
    try {
      return await handleStats(partner);
    } catch (err) {
      console.error(JSON.stringify({ event: 'stats_error', message: err.message }));
      return errResp(502, 'Error retrieving stats', err.message);
    }
  }

  // 404 fallback
  return errResp(404, `Route not found: ${method} ${path}`, {
    available_routes: [
      'GET  /v1/health',
      'POST /v1/map/submit',
      'POST /v1/mmas/submit',
      'POST /v1/peacs/submit',
      'GET  /v1/results/{assessment_id}',
      'GET  /v1/patient/{patient_ref}/results',
      'GET  /v1/stats'
    ]
  });
};
