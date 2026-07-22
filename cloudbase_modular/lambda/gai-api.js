'use strict';
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
}

const db = admin.database();
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' };
const RATE_LIMIT = 100; // per day per key

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }

  const wsKey = (event.queryStringParameters?.key || '').toUpperCase().trim();
  if (!wsKey) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'key parameter required', example: '/gai?key=PI-XXXX-XXXX-2026' }) };
  }

  // Validate key exists in Firebase
  const wsSnap = await db.ref('workspaces/' + wsKey).once('value');
  if (!wsSnap.exists()) {
    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'workspace not found' }) };
  }

  // Rate limiting — check daily call count
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ratePath = `api_calls/${wsKey}/${today}`;
  const rateSnap = await db.ref(ratePath).once('value');
  const currentCount = rateSnap.val() || 0;
  if (currentCount >= RATE_LIMIT) {
    return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Rate limit exceeded (100 requests/day)', reset: 'tomorrow UTC midnight' }) };
  }
  await db.ref(ratePath).set(currentCount + 1);

  // Canonical tri-instrument GAI helpers
  const _mapPE = r => {
    const a = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const e = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const c = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
    return Math.pow(Math.max(0, a*e*c), 1/3);
  };
  const _geomMean = arr => arr.length
    ? Math.exp(arr.reduce((s,v) => s + Math.log(Math.max(0.001, Math.min(1, v))), 0) / arr.length)
    : null;
  const _gai = (aRecs, pRecs) => {
    const mmasOnly = aRecs.filter(r => r.map_q1 === undefined);
    const mapRecs  = aRecs.filter(r => r.map_q1 !== undefined);
    const mN = mmasOnly.length ? mmasOnly.reduce((s,r) => s + parseFloat(r.mmas_score || r.score || 0), 0) / mmasOnly.length / 8 : null;
    const mP = _geomMean(mapRecs.map(r => _mapPE(r)));
    const mC = _geomMean(pRecs.filter(r => r.pe != null).map(r => +r.pe));
    const comps = [mN, mP, mC].filter(v => v != null);
    return comps.length ? _geomMean(comps) : null;
  };

  // Compute GAI metrics — last 30 days for performance
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const [assessSnap, peacsSnap] = await Promise.all([
    db.ref('assessments').orderByChild('institution_code').equalTo(wsKey).once('value'),
    db.ref('peacs').orderByChild('institution_code').equalTo(wsKey).once('value')
  ]);
  const allRecords = assessSnap.val() ? Object.values(assessSnap.val()) : [];
  const allPeacs   = peacsSnap.val()  ? Object.values(peacsSnap.val())  : [];
  const recent      = allRecords.filter(r => (r.timestamp || r.created_at || 0) >= thirtyDaysAgo);
  const recentPeacs = allPeacs.filter(r => (r.timestamp || r.created_at || 0) >= thirtyDaysAgo);

  if (recent.length === 0 && recentPeacs.length === 0) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ workspace: wsKey, gai: null, n: 0, at_risk: 0, trend_7d: null, last_updated: new Date().toISOString() }) };
  }

  const gaiVal = _gai(recent, recentPeacs) || 0;
  const atRisk = [
    ...recent.filter(r => r.map_q1 === undefined).map(r => parseFloat(r.mmas_score || r.score || 0) / 8),
    ...recent.filter(r => r.map_q1 !== undefined).map(r => _mapPE(r)),
    ...recentPeacs.filter(r => r.pe != null).map(r => +r.pe)
  ].filter(v => v < 0.55).length;

  // 7-day trend
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const thisWeekA = recent.filter(r => (r.timestamp || r.created_at || 0) >= sevenDaysAgo);
  const lastWeekA = recent.filter(r => (r.timestamp || r.created_at || 0) < sevenDaysAgo);
  const thisWeekP = recentPeacs.filter(r => (r.timestamp || r.created_at || 0) >= sevenDaysAgo);
  const lastWeekP = recentPeacs.filter(r => (r.timestamp || r.created_at || 0) < sevenDaysAgo);
  let trend7d = null;
  if ((thisWeekA.length || thisWeekP.length) && (lastWeekA.length || lastWeekP.length)) {
    const tg = _gai(thisWeekA, thisWeekP);
    const lg = _gai(lastWeekA, lastWeekP);
    if (tg !== null && lg !== null) trend7d = parseFloat((tg - lg).toFixed(4));
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      workspace: wsKey,
      gai: parseFloat(gaiVal.toFixed(4)),
      n: recent.length + recentPeacs.length,
      at_risk: atRisk,
      trend_7d: trend7d,
      last_updated: new Date().toISOString()
    })
  };
};
