'use strict';
const AWS = require('aws-sdk');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
}

const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });
const db = admin.database();

async function getWeeklyMetrics(workspaceKey) {
  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = now - oneWeekMs;
  const lastWeekStart = now - (2 * oneWeekMs);

  const snap = await db.ref('assessments').orderByChild('institution_code').equalTo(workspaceKey).once('value');
  const records = snap.val() ? Object.values(snap.val()) : [];

  const thisWeek = records.filter(r => (r.timestamp || r.created_at || 0) >= thisWeekStart);
  const lastWeek = records.filter(r => (r.timestamp || r.created_at || 0) >= lastWeekStart && (r.timestamp || r.created_at || 0) < thisWeekStart);

  const gai = (arr) => arr.length ? (arr.reduce((s, r) => s + parseFloat(r.mmas_score || r.score || 0) / 8, 0) / arr.length) : null;
  const atRisk = (arr) => arr.filter(r => parseFloat(r.mmas_score || r.score || 0) < 6).length;

  const thisGAI = gai(thisWeek);
  const lastGAI = gai(lastWeek);
  const delta = (thisGAI !== null && lastGAI !== null) ? (thisGAI - lastGAI) : null;

  return {
    newSubmissions: thisWeek.length,
    currentGAI: thisGAI,
    gaoDelta: delta,
    atRiskCount: atRisk(thisWeek),
    atRiskDelta: lastWeek.length > 0 ? atRisk(thisWeek) - atRisk(lastWeek) : null
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
        <span style="color:#555;font-size:0.875rem;">⚠ At-risk patients (MMAS &lt; 6)</span>
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
