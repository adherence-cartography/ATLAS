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

  // Compute GAI metrics — last 30 days for performance
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const assessSnap = await db.ref('assessments').orderByChild('institution_code').equalTo(wsKey).once('value');
  const allRecords = assessSnap.val() ? Object.values(assessSnap.val()) : [];
  const recent = allRecords.filter(r => (r.timestamp || r.created_at || 0) >= thirtyDaysAgo);

  if (recent.length === 0) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ workspace: wsKey, gai: null, n: 0, at_risk: 0, trend_7d: null, last_updated: new Date().toISOString() }) };
  }

  const scores = recent.map(r => parseFloat(r.mmas_score || r.score || 0) / 8);
  const gai = scores.reduce((s, v) => s + v, 0) / scores.length;
  const atRisk = recent.filter(r => parseFloat(r.mmas_score || r.score || 0) < 6).length;

  // 7-day trend
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const thisWeek = recent.filter(r => (r.timestamp || r.created_at || 0) >= sevenDaysAgo);
  const lastWeek = recent.filter(r => (r.timestamp || r.created_at || 0) < sevenDaysAgo && (r.timestamp || r.created_at || 0) >= (sevenDaysAgo - 7 * 24 * 60 * 60 * 1000));
  let trend7d = null;
  if (thisWeek.length > 0 && lastWeek.length > 0) {
    const thisGAI = thisWeek.reduce((s, r) => s + parseFloat(r.mmas_score || r.score || 0) / 8, 0) / thisWeek.length;
    const lastGAI = lastWeek.reduce((s, r) => s + parseFloat(r.mmas_score || r.score || 0) / 8, 0) / lastWeek.length;
    trend7d = parseFloat((thisGAI - lastGAI).toFixed(4));
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      workspace: wsKey,
      gai: parseFloat(gai.toFixed(4)),
      n: recent.length,
      at_risk: atRisk,
      trend_7d: trend7d,
      last_updated: new Date().toISOString()
    })
  };
};
