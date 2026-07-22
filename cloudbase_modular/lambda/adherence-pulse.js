'use strict';
const AWS = require('aws-sdk');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
}

const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });
const db = admin.database();

const _mapPE = r => {
  const a = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
  const e = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
  const c = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
  return Math.pow(Math.max(0, a*e*c), 1/3);
};

const _geomMean = arr => arr.length
  ? Math.exp(arr.reduce((s,v) => s + Math.log(Math.max(0.001, Math.min(1, v))), 0) / arr.length)
  : null;

const _computeGAI = (assessArr, peacsArr) => {
  const mmasOnly = assessArr.filter(r => r.map_q1 === undefined);
  const mapRecs  = assessArr.filter(r => r.map_q1 !== undefined);
  const mmasNorm  = mmasOnly.length ? mmasOnly.reduce((s,r) => s + parseFloat(r.mmas_score || r.score || 0), 0) / mmasOnly.length / 8 : null;
  const mapNorm   = _geomMean(mapRecs.map(r => _mapPE(r)));
  const peacsNorm = _geomMean(peacsArr.filter(r => r.pe != null).map(r => +r.pe));
  const comps = [mmasNorm, mapNorm, peacsNorm].filter(v => v != null);
  return comps.length ? _geomMean(comps) : null;
};

const _atRisk = (assessArr, peacsArr) => {
  const scores = [
    ...assessArr.filter(r => r.map_q1 === undefined).map(r => parseFloat(r.mmas_score || r.score || 0) / 8),
    ...assessArr.filter(r => r.map_q1 !== undefined).map(r => _mapPE(r)),
    ...peacsArr.filter(r => r.pe != null).map(r => +r.pe)
  ];
  return scores.filter(v => v < 0.55).length;
};

async function getWeeklyMetrics(workspaceKey) {
  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = now - oneWeekMs;
  const lastWeekStart = now - (2 * oneWeekMs);

  const [assessSnap, peacsSnap] = await Promise.all([
    db.ref('assessments').orderByChild('institution_code').equalTo(workspaceKey).once('value'),
    db.ref('peacs').orderByChild('institution_code').equalTo(workspaceKey).once('value')
  ]);
  const records    = assessSnap.val() ? Object.values(assessSnap.val()) : [];
  const peacsRecs  = peacsSnap.val()  ? Object.values(peacsSnap.val())  : [];

  const thisWeekA = records.filter(r => (r.timestamp || r.created_at || 0) >= thisWeekStart);
  const lastWeekA = records.filter(r => (r.timestamp || r.created_at || 0) >= lastWeekStart && (r.timestamp || r.created_at || 0) < thisWeekStart);
  const thisWeekP = peacsRecs.filter(r => (r.timestamp || r.created_at || 0) >= thisWeekStart);
  const lastWeekP = peacsRecs.filter(r => (r.timestamp || r.created_at || 0) >= lastWeekStart && (r.timestamp || r.created_at || 0) < thisWeekStart);

  const thisGAI = _computeGAI(thisWeekA, thisWeekP);
  const lastGAI = _computeGAI(lastWeekA, lastWeekP);
  const delta = (thisGAI !== null && lastGAI !== null) ? (thisGAI - lastGAI) : null;

  return {
    newSubmissions: thisWeekA.length + thisWeekP.length,
    currentGAI: thisGAI,
    gaoDelta: delta,
    atRiskCount: _atRisk(thisWeekA, thisWeekP),
    atRiskDelta: (lastWeekA.length + lastWeekP.length) > 0
      ? _atRisk(thisWeekA, thisWeekP) - _atRisk(lastWeekA, lastWeekP)
      : null
  };
}

function formatDelta(d, decimals = 3) {
  if (d === null) return 'N/A';
  return (d >= 0 ? '+' : '') + d.toFixed(decimals);
}

async function sendPulseEmail(toEmail, workspaceKey, metrics) {
  const gaiPct = metrics.currentGAI !== null ? (metrics.currentGAI * 100).toFixed(1) + '%' : 'N/A';
  const deltaTxt = formatDelta(metrics.gaoDelta ? metrics.gaoDelta * 100 : null, 1);
  const subject = `Weekly Adherence Pulse — ${workspaceKey}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
  <div style="background:#0f0f1a;padding:1.5rem;border-radius:10px 10px 0 0;">
    <h2 style="color:#4e9cf5;margin:0 0 0.25rem;">ATLAS Adherence Pulse</h2>
    <p style="color:#888;margin:0;font-size:0.875rem;">Weekly digest for workspace ${workspaceKey}</p>
  </div>
  <div style="background:#fff;padding:1.5rem;border:1px solid #e0e0e0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:0.75rem 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#555;font-size:0.875rem;">📊 Global Adherence Index</span>
        <strong style="float:right;color:#1a1a2e;">${gaiPct} <span style="color:${metrics.gaoDelta >= 0 ? '#4caf50' : '#f44336'};font-size:0.8rem;">(${deltaTxt}%)</span></strong>
      </td></tr>
      <tr><td style="padding:0.75rem 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#555;font-size:0.875rem;">📋 New submissions this week</span>
        <strong style="float:right;color:#1a1a2e;">${metrics.newSubmissions}</strong>
      </td></tr>
      <tr><td style="padding:0.75rem 0;">
        <span style="color:#555;font-size:0.875rem;">⚠ At-risk patients (GAI &lt; 0.55)</span>
        <strong style="float:right;color:#f44336;">${metrics.atRiskCount}</strong>
      </td></tr>
    </table>
    <a href="https://atlas.adherence.cc" style="display:block;margin-top:1.25rem;text-align:center;padding:0.75rem;background:#4e9cf5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">View Full Dashboard →</a>
  </div>
  <div style="background:#f9f9f9;padding:0.75rem 1.5rem;border-radius:0 0 10px 10px;text-align:center;">
    <span style="font-size:0.75rem;color:#999;">ATLAS Platform · <a href="https://atlas.adherence.cc" style="color:#4e9cf5;">Manage preferences</a></span>
  </div>
</div>`;

  await ses.sendEmail({
    Source: process.env.SES_FROM_EMAIL || 'atlas@adherence.cc',
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: `ATLAS Weekly Pulse — ${workspaceKey}\n\nGAI: ${gaiPct} (${deltaTxt}%)\nNew submissions: ${metrics.newSubmissions}\nAt-risk: ${metrics.atRiskCount}\n\nhttps://atlas.adherence.cc` } }
    }
  }).promise();
}

exports.handler = async () => {
  // Get all workspaces with pulse enabled
  const wsSnap = await db.ref('workspaces').once('value');
  const allWS = wsSnap.val() || {};
  const enabled = Object.entries(allWS).filter(([, cfg]) => cfg?.pulse_config?.enabled && cfg?.pulse_config?.email);

  console.log(`Sending pulse to ${enabled.length} workspaces`);
  const results = await Promise.allSettled(
    enabled.map(async ([key, cfg]) => {
      try {
        const metrics = await getWeeklyMetrics(key);
        await sendPulseEmail(cfg.pulse_config.email, key, metrics);
        console.log(`Pulse sent: ${key}`);
      } catch(e) {
        console.error(`Pulse failed for ${key}:`, e.message);
        throw e;
      }
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  return { statusCode: 200, body: JSON.stringify({ sent: succeeded, failed }) };
};
