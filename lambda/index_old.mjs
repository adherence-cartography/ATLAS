/**
 * ZOE · ATLAS Lambda Proxy (index.mjs — ES Module)
 * Routes:
 *   POST /zoe                     — ZOE AI voice agent
 *   POST /validate-key            — Workspace key validation + Firebase custom token
 *   POST /verify-otp              — Superadmin MFA — verify OTP and issue token
 *   POST /resend-otp              — Superadmin MFA — resend OTP
 *   POST /issue-key               — Automated workspace key issuance + permission registry
 *   POST /admin/edit-key          — Edit key profile fields (name, email, institution, parent, study)
 *   POST /seat-checkout           — Stripe checkout for à la carte institution seat purchases
 *   POST /create-checkout-session — Stripe Checkout session creation
 *   POST /stripe-webhook          — Stripe payment webhook
 *   POST /send-magic-link         — Firebase magic link for self-serve keys
 *   GET  /verify-cert             — Public certificate verification (HTML response)
 */

import https from 'https';
import crypto from 'crypto';
import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { handleStripeRoutes } from './lambda_stripe_handler.mjs';

// ── AWS clients ───────────────────────────────────────────────────────────────
const ssm = new SSMClient({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });
const _wsCache = new Map();

// ── Config ────────────────────────────────────────────────────────────────────
const SES_FROM_EMAIL  = process.env.SES_FROM_EMAIL  || 'info@adherence.cc';
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const OTP_SSM_PREFIX  = '/atlas/mfa-sessions/';
const PERM_SSM_PREFIX = '/atlas/permissions/';
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://adherence-project-2026-default-rtdb.firebaseio.com';
const VERIFY_BASE_URL = 'https://keys.adherence.cc/verify';

// ── Firebase service account (from env vars) ──────────────────────────────────
function getServiceAccount() {
  const email  = process.env.FIREBASE_CLIENT_EMAIL;
  const keyB64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (!email || !keyB64) throw new Error('FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY_B64 missing');
  const private_key = Buffer.from(keyB64, 'base64').toString('utf8');
  return { client_email: email, private_key };
}

// ── SSM workspace key lookup ──────────────────────────────────────────────────
async function lookupWorkspaceKey(key) {
  if (_wsCache.has(key)) return _wsCache.get(key);
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name: '/atlas/workspaces/' + key,
      WithDecryption: true
    }));
    const profile = JSON.parse(res.Parameter.Value);
    _wsCache.set(key, profile);
    return profile;
  } catch(e) { return null; }
}

// ── Firebase custom token minting ─────────────────────────────────────────────
async function mintFirebaseToken(uid, claims) {
  const sa  = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header  = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims
  });
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const keyObject = crypto.createPrivateKey({ key: sa.private_key, format: 'pem', type: 'pkcs8' });
  const signature = sign.sign(keyObject, 'base64url');
  return `${signingInput}.${signature}`;
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://atlas.adherence.cc',
  'https://www.atlas.adherence.cc',
  'https://keys.adherence.cc',
  'https://keys-adherence.pages.dev',
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1'
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    'Content-Type': 'application/json'
  };
}

function respond(statusCode, body, origin) {
  return { statusCode, headers: corsHeaders(origin || ''), body: JSON.stringify(body) };
}

// ══════════════════════════════════════════════════════════════════════════════
// MFA HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function generateOTP() {
  // 6 cryptographically random digits — never Math.random()
  return String(crypto.randomInt(100000, 999999));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function storeOTPSession(sessionToken, otp, keyName, email) {
  const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
  await ssm.send(new PutParameterCommand({
    Name:      OTP_SSM_PREFIX + sessionToken,
    Value:     JSON.stringify({ otp, keyName, email, expiresAt, used: false }),
    Type:      'SecureString',
    Overwrite: true,
  }));
}

async function getOTPSession(sessionToken) {
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name:           OTP_SSM_PREFIX + sessionToken,
      WithDecryption: true,
    }));
    return JSON.parse(res.Parameter.Value);
  } catch(e) { return null; }
}

async function deleteOTPSession(sessionToken) {
  try {
    await ssm.send(new DeleteParameterCommand({ Name: OTP_SSM_PREFIX + sessionToken }));
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// PERMISSION REGISTRY HELPERS
// Every Letter of Permission gets a cryptographic cert number written to both
// SSM (durable, private) and Firebase (readable by verify endpoint).
// ══════════════════════════════════════════════════════════════════════════════

function generateCertNum() {
  // MMAS8R-XXXXXXXX-XXXXXXXX-XXXXXXXX — cryptographically random, server-side only
  // Format signals instrument type. Hex blocks are unguessable without server access.
  const a = crypto.randomBytes(4).toString('hex').toUpperCase();
  const b = crypto.randomBytes(4).toString('hex').toUpperCase();
  const c = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MMAS8R-${a}-${b}-${c}`;
}

async function writePermissionRegistry(certNum, record) {
  // Write to SSM (primary — never deleted, audit-grade)
  try {
    await ssm.send(new PutParameterCommand({
      Name:      PERM_SSM_PREFIX + certNum,
      Value:     JSON.stringify(record),
      Type:      'SecureString',
      Overwrite: false, // never overwrite — immutable record
    }));
  } catch(e) {
    console.error('[registry] SSM write failed:', e.message);
  }

  // Write to Firebase REST API (public read for verify endpoint)
  // Needs a service-account token — mint one for the write then discard
  try {
    const token = await mintFirebaseToken('system_registry', { role: 'superadmin' });
    // Exchange custom token for ID token via Firebase Auth REST
    const idToken = await exchangeCustomTokenForIdToken(token);
    const dbPath  = `permissions/${certNum.replace(/\//g, '_')}`;
    const url     = `${FIREBASE_DB_URL}/${dbPath}.json?auth=${idToken}`;
    await firebaseRestPut(url, record);
    console.log('[registry] Firebase write OK:', certNum);
  } catch(e) {
    console.error('[registry] Firebase write failed (SSM record intact):', e.message);
    // Non-fatal — SSM is the source of truth
  }
}

async function readPermissionRegistry(certNum) {
  // Try SSM first (authoritative)
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name:           PERM_SSM_PREFIX + certNum,
      WithDecryption: true,
    }));
    return JSON.parse(res.Parameter.Value);
  } catch(e) {
    // Fall back to Firebase
    try {
      const dbPath = `permissions/${certNum.replace(/\//g, '_')}`;
      const url    = `${FIREBASE_DB_URL}/${dbPath}.json`;
      return await firebaseRestGet(url);
    } catch(e2) {
      return null;
    }
  }
}

// Exchange Firebase custom token for a short-lived ID token (for REST writes)
async function exchangeCustomTokenForIdToken(customToken) {
  const apiKey  = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY not set');
  const payload = JSON.stringify({ token: customToken, returnSecureToken: true });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path:     `/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.idToken) resolve(j.idToken);
          else reject(new Error('No idToken: ' + d));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

// Firebase REST PUT
function firebaseRestPut(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u       = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

// Firebase REST GET (unauthenticated — for public /permissions node)
// Firebase REST POST — for push() equivalent (returns { name: "-Nxxx..." })
function firebaseRestPost(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u       = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function firebaseRestGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j === null || j.error) resolve(null);
          else resolve(j);
        } catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function sendOTPEmail(toEmail, otp, keyName) {
  const body = [
    'ATLAS Platform — Superadmin Verification',
    '',
    'Your one-time verification code is:',
    '',
    '  ' + otp,
    '',
    'This code expires in ' + OTP_TTL_MINUTES + ' minutes.',
    'Key: ' + keyName,
    'Time: ' + new Date().toUTCString(),
    '',
    'If you did not request this, someone may have your superadmin key.',
    'Contact info@adherence.cc immediately.',
    '',
    '— Adherence Cartography · ATLAS',
  ].join('\n');

  await ses.send(new SendEmailCommand({
    Source:      'ATLAS Security <' + SES_FROM_EMAIL + '>',
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: 'ATLAS: Your verification code is ' + otp },
      Body:    { Text: { Data: body } },
    },
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /validate-key  (MODIFIED — MFA for superadmin)
// ══════════════════════════════════════════════════════════════════════════════
async function handleValidateKey(body, origin) {
  const { key } = body;
  if (!key || typeof key !== 'string') return respond(400, { error: 'Missing key' }, origin);

  const normalizedKey = key.trim().toUpperCase();
  const profile = await lookupWorkspaceKey(normalizedKey);

  if (!profile || profile.active === false) {
    return respond(200, { valid: false }, origin);
  }

  // ── All keyed roles: trigger OTP if email is on record ───────────────────
  // Patient / Explorer paths (no key) never reach this route.
  // Any key that has an email address goes through OTP verification.
  // Legacy keys without email fall through to immediate token issuance.
  const email = profile.email;
  if (email) {
    const otp          = generateOTP();
    const sessionToken = generateSessionToken();
    try {
      await storeOTPSession(sessionToken, otp, normalizedKey, email);
      await sendOTPEmail(email, otp, normalizedKey);
      console.log('[MFA] OTP sent to', email, 'for key', normalizedKey, 'role:', profile.role);
    } catch(e) {
      console.error('[MFA] Failed to send OTP:', e.message);
      return respond(500, { valid: false, error: 'Could not send verification email — try again' }, origin);
    }
    return respond(200, {
      valid:         true,
      mfa_required:  true,
      session_token: sessionToken,
      profile: {
        name:               profile.name            || normalizedKey,
        cohortLabel:        profile.cohortLabel     || profile.name || normalizedKey,
        color:              profile.color           || '#8b6ff5',
        active:             true,
        tier:               profile.tier            || 'researchers',
        role:               profile.role            || 'researcher',
        parent_institution: profile.parent_institution || null,
        parent_pi:          profile.parent_pi          || null,
      }
    }, origin);
  }

  // ── Fallback: no email on record (legacy key) — issue token immediately ───
  console.warn('[MFA] Key has no email, bypassing OTP:', normalizedKey);
  try {
    const token = await mintFirebaseToken('workspace_' + normalizedKey, {
      workspace:   normalizedKey,
      tier:        profile.tier               || 'researchers',
      role:        profile.role               || 'researcher',
      institution: profile.parent_institution || normalizedKey
    });
    return respond(200, {
      valid: true, token,
      profile: {
        name:               profile.name            || normalizedKey,
        cohortLabel:        profile.cohortLabel     || profile.name || normalizedKey,
        color:              profile.color           || '#8b6ff5',
        active:             true,
        tier:               profile.tier            || 'researchers',
        role:               profile.role            || 'researcher',
        parent_institution: profile.parent_institution || null,
        parent_pi:          profile.parent_pi          || null,
      }
    }, origin);
  } catch(e) {
    console.error('mintFirebaseToken failed:', e.message);
    return respond(500, { error: 'Token generation failed: ' + e.message }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /verify-otp  (NEW)
// ══════════════════════════════════════════════════════════════════════════════
async function handleVerifyOTP(body, origin) {
  const { session_token, otp } = body;

  if (!session_token || typeof session_token !== 'string' || session_token.length !== 64) {
    return respond(400, { valid: false, error: 'Invalid session token' }, origin);
  }
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return respond(400, { valid: false, error: 'Invalid code format' }, origin);
  }

  const session = await getOTPSession(session_token);
  if (!session) {
    return respond(200, { valid: false, error: 'Code expired or already used. Please enter your key again.' }, origin);
  }
  if (Date.now() > session.expiresAt) {
    await deleteOTPSession(session_token);
    return respond(200, { valid: false, error: 'Code has expired. Please enter your key again.' }, origin);
  }
  if (session.used) {
    return respond(200, { valid: false, error: 'Code already used. Please start again.' }, origin);
  }

  // Constant-time comparison — prevents timing attacks
  const expected = Buffer.from(session.otp.padStart(10, '0'));
  const received = Buffer.from(otp.padStart(10, '0'));
  const match    = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!match) {
    return respond(200, { valid: false, error: 'Incorrect code. Please check and try again.' }, origin);
  }

  // Correct — consume session immediately so it can never be replayed
  await deleteOTPSession(session_token);

  // Issue Firebase custom token for the superadmin
  // Look up the actual key profile to get the correct role/tier
  const profile = await lookupWorkspaceKey(session.keyName);
  if (!profile || profile.active === false) {
    return respond(200, { valid: false, error: 'Key is no longer active.' }, origin);
  }
  try {
    const token = await mintFirebaseToken('workspace_' + session.keyName.toLowerCase(), {
      workspace:   session.keyName,
      role:        profile.role        || 'researcher',
      tier:        profile.tier        || 'researchers',
      institution: profile.parent_institution || session.keyName,
    });
    console.log('[MFA] OTP verified, token issued for', session.keyName, 'role:', profile.role);
    return respond(200, { valid: true, token }, origin);
  } catch(e) {
    console.error('[MFA] mintFirebaseToken failed after OTP verify:', e.message);
    return respond(500, { valid: false, error: 'Token generation failed: ' + e.message }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /resend-otp  (NEW)
// ══════════════════════════════════════════════════════════════════════════════
async function handleResendOTP(body, origin) {
  const { session_token } = body;
  if (!session_token || typeof session_token !== 'string') {
    return respond(400, { error: 'Invalid session token' }, origin);
  }

  const session = await getOTPSession(session_token);
  if (!session || session.used || Date.now() > session.expiresAt) {
    return respond(200, { error: 'Session expired — please enter your key again' }, origin);
  }

  // Generate fresh OTP and extend TTL
  const newOTP = generateOTP();
  await storeOTPSession(session_token, newOTP, session.keyName, session.email);

  try {
    await sendOTPEmail(session.email, newOTP, session.keyName);
    return respond(200, { sent: true }, origin);
  } catch(e) {
    console.error('[MFA] Resend failed:', e.message);
    return respond(500, { error: 'Could not send email — try again' }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /issue-key  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

const TIERS = {
  student:     { prefix: 'STU',  label: 'Student',                peacs: 'Basic'              },
  researcher:  { prefix: 'RES',  label: 'Independent Researcher',  peacs: 'Standard (v2.0)'   },
  pi:          { prefix: 'PI',   label: 'Funded PI / Clinician',   peacs: 'Advanced (STRATA)'  },
  institution: { prefix: 'INST', label: 'Institution',             peacs: 'Full platform'      },
};

const NOISE = new Set([
  'university','universities','college','colleges','medical','school','schools',
  'hospital','hospitals','institute','institutes','institution','center','centre',
  'health','healthcare','sciences','science','system','network','clinic',
  'academy','national','international','global','regional','general','royal',
  'of','the','and','at','in','for','a','an','de','del','van','von','le','la',
]);

function buildAbbrev(name) {
  const VOWELS = new Set('aeiou');
  const words  = name
    .replace(/[''`]/g, '').replace(/[-–—/]/g, ' ').replace(/[^a-zA-Z0-9 ]/g, '')
    .trim().split(/\s+/).map(w => w.toLowerCase())
    .filter(w => w.length >= 2 && !NOISE.has(w));
  if (!words.length) {
    const raw  = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const cons = raw.split('').filter(c => !VOWELS.has(c));
    return (cons.slice(0, 4).join('') || raw.slice(0, 4)).toUpperCase().padEnd(4, 'X');
  }
  const consOf = w => w.split('').filter(c => /[a-z]/.test(c) && !VOWELS.has(c));
  let result = consOf(words[0]).slice(0, 4).join('');
  for (let i = 1; i < words.length && result.length < 4; i++) {
    result += consOf(words[i]).slice(0, 4 - result.length).join('');
  }
  if (result.length < 4) result = (result + words[0].replace(/[^a-z]/g, '')).slice(0, 4);
  return result.slice(0, 4).toUpperCase().padEnd(4, 'X');
}

async function resolveAbbrev(base) {
  const existing = new Set();
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/workspaces/', WithDecryption: false,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try { const v = JSON.parse(p.Value); if (v.abbrev) existing.add(v.abbrev); } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) { console.warn('[resolveAbbrev] warn:', e.message); }
  if (!existing.has(base)) return base;
  for (let d = 2; d <= 9; d++) {
    const c = base.slice(0, 3) + d;
    if (!existing.has(c)) return c;
  }
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function randomSuffix() {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf   = crypto.randomBytes(4);
  return Array.from({ length: 4 }, (_, i) => CHARS[buf[i] % CHARS.length]).join('');
}

export async function findByStripeSession(sessionId) {
  if (!sessionId) return null;
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/workspaces/', WithDecryption: true,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try { const v = JSON.parse(p.Value); if (v.stripe_session_id === sessionId) return v; } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) { console.warn('[findByStripeSession] warn:', e.message); }
  return null;
}

export async function generatePermissionLetter(name, institution, study_title, intended_use, key, role, createdAt, certNum, subscription_end, isManual = false) {
  const date    = new Date(createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const expiryDate = subscription_end
    ? new Date(subscription_end).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : null;
  const verifyUrl = `${VERIFY_BASE_URL}?cert=${encodeURIComponent(certNum)}`;
  const useDescriptions = {
    thesis:           'thesis or dissertation study (degree requirement, non-commercial)',
    coursework:       'coursework or class project (non-commercial, educational)',
    independent:      'independent academic research (non-commercial)',
    clinical_practice:'clinical practice quality improvement (non-publication)',
    funded_research:  'funded research study',
    commercial:       'research study',
  };
  const useDesc = useDescriptions[intended_use] || 'research study';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:12pt;color:#000;margin:0;padding:40px;}
  .letterhead{border-bottom:3px solid #1a3a6b;padding-bottom:16px;margin-bottom:28px;display:flex;align-items:flex-start;justify-content:space-between;}
  .org{font-size:14pt;font-weight:bold;color:#1a3a6b;letter-spacing:0.02em;}
  .org-sub{font-size:10pt;color:#444;margin-top:2px;}
  h1{font-size:15pt;font-weight:bold;text-align:center;letter-spacing:0.08em;margin:0 0 6px;}
  .cert{font-size:10pt;text-align:center;color:#555;margin-bottom:6px;}
  .cert-num{font-size:11pt;text-align:center;font-family:'Courier New',monospace;color:#1a3a6b;font-weight:bold;letter-spacing:0.06em;margin-bottom:28px;border:1px solid #c0cfe0;background:#f5f8ff;padding:8px 16px;display:inline-block;}
  p{line-height:1.7;margin:0 0 14px;}
  .section-title{font-weight:bold;margin-top:24px;margin-bottom:4px;}
  .citation{background:#f5f5f5;border-left:3px solid #1a3a6b;padding:10px 14px;font-size:10pt;line-height:1.6;margin:10px 0 16px;}
  .footnote-req{background:#f5f5f5;border-left:3px solid #888;padding:10px 14px;font-size:10pt;margin:10px 0 16px;}
  .sig-block{margin-top:40px;border-top:1px solid #ccc;padding-top:16px;}
  .sig-name{font-weight:bold;font-size:12pt;}
  .sig-title{font-size:10pt;color:#444;}
  .verify-block{margin-top:32px;border-top:1px solid #ddd;padding-top:16px;font-size:9pt;color:#555;line-height:1.8;}
  .verify-url{font-family:'Courier New',monospace;color:#1a3a6b;font-size:9pt;word-break:break-all;}
  .watermark-note{font-size:8pt;color:#888;text-align:center;margin-top:16px;}
</style>
</head><body>
<div class="letterhead">
  <div>
    <div class="org">ADHERENCE INC. · ADHERENCE CARTOGRAPHY</div>
    <div class="org-sub">Licensed Steward of the MMAS-8R Intellectual Property · Long Beach, California</div>
  </div>
</div>
<h1>LETTER OF PERMISSION</h1>
<div class="cert">Certificate Number</div>
<div style="text-align:center;margin-bottom:4px;"><span class="cert-num">${certNum}</span></div>
<div class="cert">Issued: ${date}</div>
<br/>
<p>To Whom It May Concern:</p>
<p>This letter confirms that <strong>${name}</strong> of <strong>${institution}</strong> is granted limited, non-transferable permission to use the Morisky Medication Adherence Scale, 8-item revised version (MMAS-8R) for the purposes of the following ${useDesc}:</p>
<p style="margin-left:24px;font-style:italic;font-weight:500;">"${study_title || 'As described in the associated application'}"</p>
<p>Use is permitted for data collection, analysis, and academic dissemination, including presentation and publication, provided that the original validated wording, structure, and scoring of the MMAS-8R are strictly maintained, and appropriate attribution is included in all outputs. This permission applies solely to the study described above and does not transfer ownership or licensing rights and may not be extended to others without prior written authorization.</p>
${isManual
  ? `<p><strong>License Validity:</strong> This permission is valid through <strong>${expiryDate || 'the date specified in the registry'}</strong>. This letter is issued as a humanitarian access waiver by Adherence Cartography for qualifying researchers in low- and middle-income countries (LMIC). It is not contingent on a paid subscription. Validity and current status can be confirmed at any time using the verification URL below.</p>`
  : `<p><strong>License Validity:</strong> This permission is valid through <strong>${expiryDate || 'end of active subscription period'}</strong> and renews automatically with each billing cycle while the associated ATLAS workspace subscription remains active. If the subscription lapses or is cancelled, this permission is immediately revoked and the certificate status is updated in the public registry. Institutions and journals can verify current status at any time using the URL below.</p>`
}
<div class="section-title">Intellectual Property Notice</div>
<p>The MMAS-8 and its derivatives, including the MMAS-8R, are protected intellectual property of Dr. Donald E. Morisky. All rights are reserved worldwide. © TX 8-632-533.</p>
<div class="section-title">Required Citation</div>
<div class="citation">Krousel-Wood M, Islam T, Webber LS, Re RN, Morisky DE, Muntner P. New medication adherence scale versus pharmacy fill rates in seniors with hypertension. <em>Am J Manag Care.</em> 2009 Jan;15(1):59-66.</div>
<div class="section-title">Required Acknowledgment Footnote</div>
<div class="footnote-req">MMAS-8R® used with permission. www.moriskyscale.com</div>
<div class="sig-block">
  <div class="sig-name">Philip Morisky, MBA</div>
  <div class="sig-title">Founder &amp; Chief Optimus, Adherence Inc.</div>
  <div class="sig-title">info@adherence.cc · adherence.cc</div>
</div>
<div class="verify-block">
  <strong>Certificate Verification</strong><br/>
  This letter can be independently verified online. Present the certificate number and the URL below to any journal editor, IRB officer, or ethics committee to confirm authenticity:<br/>
  <span class="verify-url">${verifyUrl}</span><br/><br/>
  This certificate is registered in the ATLAS Permission Registry and is linked to the workspace key issued to the licensee. Verification confirms name, institution, study title, and issuance date against the authoritative registry record. To report a suspected forgery, contact <strong>info@adherence.cc</strong>.
</div>
<div class="watermark-note">Certificate: ${certNum} · Valid through ${expiryDate || 'subscription end'} — auto-renews with active subscription · adherence.cc</div>
</body></html>`;
}

const LETTER_TIERS = new Set(['student', 'researcher', 'pi', 'institution']);

async function sendWelcomeEmail(email, name, key, role, institution, study_title, intended_use, createdAt, certNum, subscription_end) {
  const tc       = TIERS[role];
  const atlasUrl = `https://atlas.adherence.cc?key=${key}`;
  const includeLetter = LETTER_TIERS.has(role) && study_title && certNum;
  const verifyUrl = certNum ? `${VERIFY_BASE_URL}?cert=${encodeURIComponent(certNum)}` : null;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:32px 20px;background:#060e1e;font-family:'IBM Plex Mono',Courier,monospace;color:#c8d8ea;">
<div style="max-width:560px;margin:0 auto;border:1px solid rgba(212,168,67,0.22);border-top:3px solid rgba(212,168,67,0.75);border-radius:4px;padding:36px;">
  <div style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:24px;">ADHERENCE CARTOGRAPHY · ATLAS</div>
  <h1 style="font-family:Georgia,serif;font-size:1.75rem;font-weight:300;color:#fff;margin:0 0 6px;">Your workspace key is ready.</h1>
  <p style="color:rgba(200,220,240,0.6);font-size:0.86rem;line-height:1.7;margin:0 0 28px;">Welcome, ${name}. Your <strong style="color:#fff;">${tc.label}</strong> workspace for <strong style="color:#fff;">${institution}</strong> has been provisioned.</p>
  <div style="background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.18);border-radius:3px;padding:22px;text-align:center;margin-bottom:28px;">
    <div style="font-size:0.69rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,168,67,0.45);margin-bottom:10px;">Workspace Key</div>
    <div style="font-size:1.65rem;letter-spacing:0.28em;color:rgba(212,168,67,0.95);font-weight:500;">${key}</div>
  </div>
  ${study_title ? `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.78rem;color:rgba(200,220,240,0.5);line-height:1.6;"><span style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.65rem;">Study</span><br/><span style="color:rgba(200,220,240,0.85);font-style:italic;">${study_title}</span></div>` : ''}
  ${includeLetter ? `<div style="background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.2);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.78rem;color:rgba(46,201,138,0.8);line-height:1.6;">Your Letter of Permission is attached as an HTML file. Open in any browser and print to PDF to produce the signed document for your IRB or ethics committee.</div>` : ''}
  ${certNum ? `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.72rem;line-height:1.8;"><span style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.62rem;color:rgba(200,220,240,0.4);">Certificate Number</span><br/><span style="font-family:'Courier New',monospace;font-size:0.88rem;color:rgba(212,168,67,0.9);letter-spacing:0.06em;">${certNum}</span><br/><span style="font-size:0.68rem;color:rgba(200,220,240,0.35);">Verify at: <a href="${verifyUrl}" style="color:rgba(78,156,245,0.7);">${verifyUrl}</a></span></div>` : ''}
  ${(!certNum && LETTER_TIERS.has(role) && study_title) ? `<div style="background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.2);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.78rem;color:rgba(212,168,67,0.7);line-height:1.7;"><span style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.65rem;display:block;margin-bottom:6px;">📋 MMAS-8R Letter of Permission</span>Your formal Letter of Permission will be issued automatically after 3 consecutive months of active subscription. This policy ensures your IRB documentation reflects continuous licensing for the duration of your study. The letter will be emailed to this address once your subscription qualifies.</div>` : ''}
  <a href="${atlasUrl}" style="display:block;text-align:center;background:rgba(78,156,245,0.12);border:1px solid rgba(78,156,245,0.35);color:#7bb8f5;border-radius:4px;padding:13px;text-decoration:none;font-size:0.84rem;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">Open ATLAS with Your Key →</a>
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;font-size:0.72rem;line-height:1.9;color:rgba(255,255,255,0.2);">MMAS-8R © Donald E. Morisky · Licensed exclusively to Adherence Inc.<br/>ATLAS Platform © Adherence Cartography · info@adherence.cc</div>
</div></body></html>`;

  const text = `ATLAS WORKSPACE KEY — ${key}\n\nWelcome ${name},\nYour ${tc.label} workspace for ${institution} is live.${study_title ? '\nStudy: ' + study_title : ''}\n\nKey: ${key}\nOpen ATLAS: ${atlasUrl}\n\n— Adherence Cartography · info@adherence.cc`;

  if (includeLetter) {
    const letterHtml = await generatePermissionLetter(name, institution, study_title, intended_use, key, role, createdAt, certNum, subscription_end);
    const letterB64  = Buffer.from(letterHtml).toString('base64');
    const filename   = `ATLAS_Permission_Letter_${key}.html`;
    const boundary   = `----=_Part_${Date.now()}`;
    const rawMsg = [
      `From: ATLAS Platform <${SES_FROM_EMAIL}>`,
      `Reply-To: info@adherence.cc`,
      `To: ${email}`,
      `Subject: Your ATLAS workspace key: ${key}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      html.replace(/[^\x00-\x7E]/g, c => `=${c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')}`),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8; name="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${filename}"`,
      ``,
      letterB64.match(/.{1,76}/g).join('\n'),
      ``,
      `--${boundary}--`,
    ].join('\r\n');
    await ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawMsg) } }));
  } else {
    await ses.send(new SendEmailCommand({
      Source:           `ATLAS Platform <${SES_FROM_EMAIL}>`,
      ReplyToAddresses: ['info@adherence.cc'],
      Destination:      { ToAddresses: [email] },
      Message: {
        Subject: { Data: `Your ATLAS workspace key: ${key}`, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    }));
  }
}

export async function handleIssueKey(body, origin) {
  const { name, email, institution, role, study_title, intended_use,
          stripe_session_id, stripe_customer_id, stripe_subscription_id,
          plan_type, parent_institution, parent_pi } = body;
  const emailRequired = role !== 'institution';
  if (!name || (emailRequired && !email) || !institution || !role)
    return respond(400, { error: 'Missing required fields: name' + (emailRequired ? ', email' : '') + ', institution, role' }, origin);
  if (!TIERS[role])
    return respond(400, { error: `Invalid role. Must be: ${Object.keys(TIERS).join(', ')}` }, origin);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return respond(400, { error: 'Invalid email address' }, origin);
  if (stripe_session_id) {
    const existing = await findByStripeSession(stripe_session_id);
    if (existing) {
      return respond(200, {
        key: existing.key, tier: existing.role, institution: existing.institution,
        abbrev: existing.abbrev, created_at: existing.created_at,
        atlas_url: `https://atlas.adherence.cc?key=${existing.key}`,
        email_sent: false, idempotent: true,
      }, origin);
    }
  }
  const tc     = TIERS[role];
  const base   = buildAbbrev(institution);
  const abbrev = await resolveAbbrev(base);
  const suffix = randomSuffix();
  const year   = new Date().getFullYear();
  const key    = `${tc.prefix}-${abbrev}-${suffix}-${year}`;
  const now    = Date.now();

  // Letters of Permission are issued immediately upon key issuance for all plans.
  const isAnnual        = plan_type === 'annual';
  const subscriptionEnd = isAnnual ? now + 365*24*60*60*1000 : now + 30*24*60*60*1000;
  const letterEligible  = true;

  // ── Permission Registry — only for eligible plans + study info ────────────
  let certNum = null;
  if (LETTER_TIERS.has(role) && study_title && letterEligible) {
    certNum = generateCertNum();
    const registryRecord = {
      certNum,
      key,
      name:                name.trim(),
      institution:         institution.trim(),
      study_title:         study_title.trim(),
      intended_use:        intended_use || null,
      role,
      issued_at:           now,
      subscription_end:    subscriptionEnd,
      status:              'active',
      stripe_session_id:   stripe_session_id        || null,
      stripe_customer_id:  stripe_customer_id       || null,
      stripe_subscription_id: stripe_subscription_id || null,
      verify_url:          `${VERIFY_BASE_URL}?cert=${encodeURIComponent(certNum)}`,
    };
    await writePermissionRegistry(certNum, registryRecord);
    console.log(`[issue-key] Registry written: ${certNum} for ${key}`);
  }

  const profile = {
    key, name: name.trim(), email: email.trim().toLowerCase(),
    institution: institution.trim(), abbrev, role, tier: role,
    peacs_tier: tc.peacs, study_title: study_title || null,
    intended_use: intended_use || null,
    stripe_session_id:       stripe_session_id       || null,
    stripe_customer_id:      stripe_customer_id      || null,
    stripe_subscription_id:  stripe_subscription_id  || null,
    plan_type:               plan_type               || 'monthly',
    subscription_start:      now,
    subscription_end:        subscriptionEnd,
    months_paid:             1,
    letter_eligible:         letterEligible,
    cert_num:                certNum,
    parent_institution: (parent_institution || '').trim().toUpperCase() || null,
    parent_pi:          (parent_pi          || '').trim().toUpperCase() || null,
    created_at: now, active: true, key_type: 'self_serve',
    cohortLabel: `${abbrev} · ${institution.trim().split(' ').slice(0, 3).join(' ')}`,
    color: '#8b6ff5',
  };
  await ssm.send(new PutParameterCommand({
    Name: `/atlas/workspaces/${key}`, Value: JSON.stringify(profile),
    Type: 'String', Overwrite: false,
  }));

  let emailSent = false;
  try {
    await sendWelcomeEmail(email, name, key, role, institution, study_title, intended_use, now, certNum, subscriptionEnd);
    emailSent = true;
  } catch(e) { console.error('[issue-key] Email failed:', e.message); }
  return respond(201, {
    key, tier: role, institution: institution.trim(), abbrev,
    created_at: now, atlas_url: `https://atlas.adherence.cc?key=${key}`,
    email_sent: emailSent,
    cert_num: certNum || null,
    letter_eligible: letterEligible,
    plan_type: plan_type || 'monthly',
  }, origin);
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /zoe  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════
async function handleZoe(body, origin) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return respond(500, { error: 'API key not configured' }, origin);
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(respond(res.statusCode, JSON.parse(data), origin)); }
        catch(e) { resolve(respond(500, { error: 'Parse error' }, origin)); }
      });
    });
    req.on('error', e => resolve(respond(500, { error: e.message }, origin)));
    req.write(payload); req.end();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: GET /verify-cert?cert=MMAS8R-XXXX-XXXX-XXXX
// Public endpoint — returns branded HTML confirmation page.
// No authentication required. Reads from SSM (primary) or Firebase (fallback).
// ══════════════════════════════════════════════════════════════════════════════
async function handleVerifyCert(certParam, origin) {
  const htmlHeaders = {
    ...corsHeaders(origin),
    'Content-Type': 'text/html; charset=utf-8',
  };

  if (!certParam || typeof certParam !== 'string' || !certParam.startsWith('MMAS8R-')) {
    return {
      statusCode: 400,
      headers: htmlHeaders,
      body: _verifyPage('invalid', null, certParam || ''),
    };
  }

  const cert = certParam.trim().toUpperCase();
  const record = await readPermissionRegistry(cert);

  if (!record) {
    return {
      statusCode: 404,
      headers: htmlHeaders,
      body: _verifyPage('not_found', null, cert),
    };
  }

  const status = record.status === 'revoked' ? 'revoked' : 'active';
  return {
    statusCode: 200,
    headers: htmlHeaders,
    body: _verifyPage(status, record, cert),
  };
}

function _verifyPage(status, record, certNum) {
  const isActive  = status === 'active';
  const isRevoked = status === 'revoked';
  const isInvalid = status === 'invalid' || status === 'not_found';

  const statusColor  = isActive ? '#10b981' : isRevoked ? '#ef4444' : '#f59e0b';
  const statusIcon   = isActive ? '✓' : '✗';
  const statusLabel  = isActive ? 'VALID — PERMISSION ACTIVE'
                     : isRevoked ? 'REVOKED — PERMISSION WITHDRAWN'
                     : status === 'not_found' ? 'NOT FOUND — CERTIFICATE UNRECOGNISED'
                     : 'INVALID — MALFORMED CERTIFICATE NUMBER';

  const issuedDate = record?.issued_at
    ? new Date(record.issued_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : null;

  const rows = record ? [
    ['Certificate Number', certNum],
    ['Issued To',          record.name || '—'],
    ['Institution',        record.institution || '—'],
    ['Study Title',        record.study_title || '—'],
    ['Issue Date',         issuedDate || '—'],
    ['Permission Type',    record.role ? record.role.charAt(0).toUpperCase() + record.role.slice(1) : '—'],
    ['Status',             isActive ? 'Active' : isRevoked ? 'Revoked' + (record.revoked_at ? ` (${new Date(record.revoked_at).toLocaleDateString()})` : '') : '—'],
  ].map(([k,v]) => `<tr><td style="font-weight:600;color:#374151;width:40%;padding:9px 12px;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${k}</td><td style="color:#4b5563;padding:9px 12px;border-bottom:1px solid #f0f0f0;">${v}</td></tr>`).join('')
  : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Certificate Verification · Adherence Cartography</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;background:#f4f6f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
  .card{background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,0.1);max-width:620px;width:100%;overflow:hidden;}
  .header{background:#1a3a6b;padding:28px 32px;color:#fff;}
  .header-brand{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:8px;}
  .header-title{font-size:20px;font-weight:300;color:#fff;}
  .status-bar{padding:16px 32px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #e5e7eb;}
  .status-icon{width:36px;height:36px;border-radius:50%;background:${statusColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:bold;flex-shrink:0;}
  .status-text{font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${statusColor};}
  .body{padding:28px 32px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;}
  .not-found-msg{text-align:center;padding:32px;color:#6b7280;font-size:14px;line-height:1.7;}
  .footer{background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;font-size:11px;color:#9ca3af;line-height:1.8;}
  .footer a{color:#1a3a6b;text-decoration:none;}
  .cert-mono{font-family:'Courier New',monospace;font-size:13px;color:#1a3a6b;background:#f0f4ff;padding:6px 10px;border-radius:4px;display:inline-block;margin-top:4px;word-break:break-all;}
  @media(max-width:480px){.header,.status-bar,.body,.footer{padding-left:20px;padding-right:20px;}}
</style>
</head><body>
<div class="card">
  <div class="header">
    <div class="header-brand">Adherence Cartography · ATLAS Permission Registry</div>
    <div class="header-title">Certificate Verification</div>
  </div>
  <div class="status-bar">
    <div class="status-icon">${statusIcon}</div>
    <div class="status-text">${statusLabel}</div>
  </div>
  <div class="body">
    ${isInvalid ? `<div class="not-found-msg">
      The certificate number <strong>${certNum}</strong> was not found in the ATLAS Permission Registry.<br/><br/>
      If you believe this certificate is valid, please contact <a href="mailto:info@adherence.cc">info@adherence.cc</a> with the full certificate number and the name on the letter.
    </div>` : `
    <table>${rows}</table>
    ${isActive ? `<p style="font-size:13px;color:#374151;line-height:1.7;">This Letter of Permission was issued by Adherence Cartography (Adherence Inc.) and authorises the named individual to use the <strong>MMAS-8R®</strong> (Morisky Medication Adherence Scale, 8-item revised version) for the study described above. This record is the authoritative registry entry. Permission is linked to an active ATLAS workspace subscription.</p>` : ''}
    ${isRevoked ? `<p style="font-size:13px;color:#ef4444;line-height:1.7;">This permission has been revoked by Adherence Cartography. The MMAS-8R may not be used under this certificate. Contact <a href="mailto:info@adherence.cc">info@adherence.cc</a> for further information.</p>` : ''}`}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;">Certificate Number</div>
      <div class="cert-mono">${certNum}</div>
    </div>
  </div>
  <div class="footer">
    MMAS-8R® is the intellectual property of Dr. Donald E. Morisky. © TX 8-632-533. All rights reserved.<br/>
    This registry is maintained by <a href="https://adherence.cc">Adherence Cartography · Adherence Inc.</a> · Long Beach, California<br/>
    To report a suspected forgery or request a letter reissue: <a href="mailto:info@adherence.cc">info@adherence.cc</a><br/>
    Verification timestamp: ${new Date().toUTCString()}
  </div>
</div>
</body></html>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION LIFECYCLE HELPERS — exported for lambda_stripe_handler.mjs
// ══════════════════════════════════════════════════════════════════════════════

// ── ROUTE: POST /gai-inquiry (public — no auth required) ─────────────────────
// Stores inquiry in SSM + emails info@adherence.cc. No Firebase RTDB needed.
async function handleGAIInquiry(body, origin) {
  const { name, organization, email, tier, tier_label, note } = body;
  if (!name || !email || !tier) {
    return respond(400, { error: 'name, email, and tier are required' }, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { error: 'Invalid email address' }, origin);
  }
  const tierLabels = {
    standard:   'GAI Standard — Quarterly PDF ($5,000/yr)',
    annual:     'GAI Annual Deep-Dive ($12,500/yr)',
    enterprise: 'GAI Enterprise — Real-time API ($25,000+/yr)',
  };
  const key = 'GAI-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const record = {
    key,
    name:         String(name).trim().slice(0, 200),
    organization: String(organization || '').trim().slice(0, 200),
    email:        String(email).trim().toLowerCase(),
    tier,
    tier_label:   tierLabels[tier] || tier_label || tier,
    note:         note ? String(note).trim().slice(0, 1000) : null,
    submitted_at: new Date().toISOString(),
    status:       'new',
  };
  try {
    // Write to SSM
    await ssm.send(new PutParameterCommand({
      Name:      `/atlas/gai_inquiries/${key}`,
      Value:     JSON.stringify(record),
      Type:      'String',
      Overwrite: false,
    }));

    // Email notification to info@adherence.cc
    try {
      await ses.send(new SendEmailCommand({
        Source:      `ATLAS Platform <${SES_FROM_EMAIL}>`,
        Destination: { ToAddresses: ['info@adherence.cc'] },
        Message: {
          Subject: { Data: `New GAI Inquiry [${record.tier_label}] — ${record.name}` },
          Body: { Text: { Data: [
            `New GAI report inquiry received via ATLAS.`,
            ``,
            `Tier:         ${record.tier_label}`,
            `Name:         ${record.name}`,
            `Organization: ${record.organization || '—'}`,
            `Email:        ${record.email}`,
            `Note:         ${record.note || '—'}`,
            `Submitted:    ${record.submitted_at}`,
            `Key:          ${key}`,
            ``,
            `View in ATLAS Control under GAI Inquiries.`,
          ].join('\n') } },
        },
      }));
    } catch(emailErr) {
      console.warn('[gai-inquiry] Notification email failed (non-fatal):', emailErr.message);
    }

    console.log('[gai-inquiry] Saved:', key, tier, email);
    return respond(200, { key }, origin);
  } catch(e) {
    console.error('[gai-inquiry] Firebase write failed:', e.message);
    return respond(500, { error: 'Could not save inquiry: ' + e.message }, origin);
  }
}

export { ssm, ses, FIREBASE_DB_URL, SES_FROM_EMAIL, VERIFY_BASE_URL, LETTER_TIERS,
         mintFirebaseToken, exchangeCustomTokenForIdToken, firebaseRestPut, firebaseRestGet, firebaseRestPost,
         readPermissionRegistry, writePermissionRegistry, generateCertNum, respond, corsHeaders,
         lookupWorkspaceKey, _wsCache, buildAbbrev, resolveAbbrev, randomSuffix, TIERS, PutParameterCommand };

export async function findByStripeCustomer(customerId) {
  if (!customerId) return null;
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/workspaces/', WithDecryption: true,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try { const v = JSON.parse(p.Value); if (v.stripe_customer_id === customerId) return v; } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) { console.warn('[findByStripeCustomer]', e.message); }
  return null;
}

export async function findByStripeSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/workspaces/', WithDecryption: true,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try { const v = JSON.parse(p.Value); if (v.stripe_subscription_id === subscriptionId) return v; } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) { console.warn('[findByStripeSubscription]', e.message); }
  return null;
}

export async function updateWorkspaceProfile(key, updates) {
  const normalizedKey = key.trim().toUpperCase();
  const existing = await ssm.send(new GetParameterCommand({
    Name: `/atlas/workspaces/${normalizedKey}`, WithDecryption: true,
  }));
  const profile = JSON.parse(existing.Parameter.Value);
  const updated  = { ...profile, ...updates };
  await ssm.send(new PutParameterCommand({
    Name:      `/atlas/workspaces/${normalizedKey}`,
    Value:     JSON.stringify(updated),
    Type:      'String', Overwrite: true,
  }));
  _wsCache.delete(normalizedKey);
  return updated;
}

export async function revokeWorkspaceCertRegistry(certNum, reason) {
  if (!certNum) return;
  try {
    const record = await readPermissionRegistry(certNum);
    if (!record) return;
    const updated = { ...record, status: 'revoked', revoked_at: Date.now(), revoke_reason: reason || 'subscription_cancelled' };
    const token   = await mintFirebaseToken('system_registry', { role: 'superadmin' });
    const idToken = await exchangeCustomTokenForIdToken(token);
    const dbPath  = `permissions/${certNum.replace(/\//g, '_')}`;
    await firebaseRestPut(`${FIREBASE_DB_URL}/${dbPath}.json?auth=${idToken}`, updated);
    console.log('[revokeWorkspaceCertRegistry] Revoked cert:', certNum);
  } catch(e) {
    console.error('[revokeWorkspaceCertRegistry] failed:', e.message);
  }
}

// Send the permission letter standalone — used when monthly user reaches 3 paid months
export async function sendLetterEmailStandalone(profile) {
  if (!profile.cert_num || !profile.email || !profile.study_title) return;
  const letterHtml  = await generatePermissionLetter(
    profile.name, profile.institution, profile.study_title,
    profile.intended_use, profile.key, profile.role,
    profile.created_at, profile.cert_num, profile.subscription_end
  );
  const letterB64   = Buffer.from(letterHtml).toString('base64');
  const filename    = `ATLAS_Permission_Letter_${profile.key}.html`;
  const boundary    = `----=_Part_${Date.now()}`;
  const certVerifyUrl = `${VERIFY_BASE_URL}?cert=${encodeURIComponent(profile.cert_num)}`;
  const bodyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:32px 20px;background:#060e1e;font-family:'IBM Plex Mono',Courier,monospace;color:#c8d8ea;">
<div style="max-width:560px;margin:0 auto;border:1px solid rgba(212,168,67,0.22);border-top:3px solid rgba(212,168,67,0.75);border-radius:4px;padding:36px;">
  <div style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:24px;">ADHERENCE CARTOGRAPHY · ATLAS</div>
  <h1 style="font-family:Georgia,serif;font-size:1.75rem;font-weight:300;color:#fff;margin:0 0 6px;">Your Letter of Permission is ready.</h1>
  <p style="color:rgba(200,220,240,0.6);font-size:0.86rem;line-height:1.7;margin:0 0 28px;">Your MMAS-8R Letter of Permission has been issued with your ATLAS workspace. The letter is attached — open it in any browser and print to PDF for your IRB or ethics committee.</p>
  <div style="background:rgba(46,201,138,0.05);border:1px solid rgba(46,201,138,0.2);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.78rem;color:rgba(46,201,138,0.8);line-height:1.6;">Open the attached HTML file in any browser and print to PDF for your IRB or ethics committee.</div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.72rem;line-height:1.8;">
    <span style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.62rem;color:rgba(200,220,240,0.4);">Certificate Number</span><br/>
    <span style="font-family:'Courier New',monospace;font-size:0.88rem;color:rgba(212,168,67,0.9);letter-spacing:0.06em;">${profile.cert_num}</span><br/>
    <span style="font-size:0.68rem;color:rgba(200,220,240,0.35);">Verify at: <a href="${certVerifyUrl}" style="color:rgba(78,156,245,0.7);">${certVerifyUrl}</a></span>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;font-size:0.72rem;line-height:1.9;color:rgba(255,255,255,0.2);">MMAS-8R © Donald E. Morisky · Licensed exclusively to Adherence Inc.<br/>ATLAS Platform © Adherence Cartography · info@adherence.cc</div>
</div></body></html>`;

  const rawMsg = [
    `From: ATLAS Platform <${SES_FROM_EMAIL}>`,
    `Reply-To: info@adherence.cc`,
    `To: ${profile.email}`,
    `Subject: Your MMAS-8R Letter of Permission is ready — ${profile.key}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    bodyHtml.replace(/[^\x00-\x7E]/g, c => `=${c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')}`),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    letterB64.match(/.{1,76}/g).join('\n'),
    ``,
    `--${boundary}--`,
  ].join('\r\n');
  await ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawMsg) } }));
  console.log(`[sendLetterEmailStandalone] Letter sent to ${profile.email} for ${profile.key}`);
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  const path   = event.requestContext?.http?.path   || event.path || '/';

  console.log('METHOD:', method, 'PATH:', path, 'ORIGIN:', origin);

  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(origin), body: '' };

  // GET /verify-cert?cert=MMAS8R-... — public, no auth, HTML response
  if ((method === 'GET' || method === 'POST') && path.includes('/verify-cert')) {
    const certParam = event.queryStringParameters?.cert || body?.cert || '';
    return await handleVerifyCert(certParam, origin);
  }

  if (path.startsWith('/stripe-webhook')) {
    return await handleStripeRoutes(path, method, event.body, event.headers);
  }

  if (!ALLOWED_ORIGINS.includes(origin) && origin !== '') {
    console.log('BLOCKED origin:', origin);
    return respond(403, { error: 'Unauthorized origin' }, origin);
  }

  let body = {};
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}); }
  catch(e) { return respond(400, { error: 'Invalid JSON body' }, origin); }

  // Admin routes must come before the body.key catch-all — admin requests include body.key
  // but must NOT be intercepted by handleValidateKey.
  if (path.endsWith('/admin/create-key'))            return handleAdminCreateKey(body, origin, event);
  if (path.endsWith('/admin/revoke-key'))            return handleAdminRevokeKey(body, origin, event);
  if (path.endsWith('/admin/edit-key'))              return handleAdminEditKey(body, origin, event);
  if (path.endsWith('/admin/delete-key'))            return handleAdminDeleteKey(body, origin, event);
  if (path.endsWith('/admin/list-keys'))             return handleAdminListKeys(body, origin, event);
  if (path.endsWith('/admin/list-gai-inquiries'))   return handleAdminListGAIInquiries(body, origin, event);
  if (path.endsWith('/admin/update-gai-inquiry'))   return handleAdminUpdateGAIInquiry(body, origin, event);
  if (path.endsWith('/admin/issue-lop'))             return handleAdminIssueLOP(body, origin, event);
  if (path.endsWith('/admin/list-lops'))             return handleAdminListLOPs(body, origin, event);
  if (path.endsWith('/admin/revoke-lop'))            return handleAdminRevokeLOP(body, origin, event);

  if (path.endsWith('/validate-key') || body.key)  return handleValidateKey(body, origin);
  if (path.endsWith('/verify-otp'))                 return handleVerifyOTP(body, origin);
  if (path.endsWith('/resend-otp'))                 return handleResendOTP(body, origin);
  if (path.endsWith('/zoe')          || body.model) return handleZoe(body, origin);
  if (path.endsWith('/issue-key'))                  return handleIssueKey(body, origin);

  if (path.endsWith('/gai-inquiry'))   return handleGAIInquiry(body, origin);
  if (path.startsWith('/create-checkout-session') || path.startsWith('/send-magic-link') || path.startsWith('/gai-checkout') || path.startsWith('/seat-checkout')) {
    return await handleStripeRoutes(path, method, event.body, event.headers);
  }

  console.log('No route matched. Path:', path, 'Body keys:', Object.keys(body));
  return respond(404, { error: 'Unknown route' }, origin);
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — superadmin Firebase token required in Authorization header
// ══════════════════════════════════════════════════════════════════════════════

async function verifyAdminToken(event) {
  const auth = (event.headers?.authorization || event.headers?.Authorization || '').replace('Bearer ', '').trim();
  if (!auth) throw new Error('Missing Authorization header');
  // Verify via Firebase token introspection endpoint
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`;
  const res = await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ idToken: auth });
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
  if (res.error || !res.users?.length) throw new Error('Invalid token');
  // Decode claims from the token itself (already verified by Firebase)
  const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString());
  if (payload.role !== 'superadmin' && payload?.firebase?.sign_in_attributes?.role !== 'superadmin') {
    // Check custom claims path
    const claims = payload?.['https://hasura.io/jwt/claims'] || payload;
    if (claims.role !== 'superadmin') throw new Error('Superadmin role required');
  }
  return payload;
}

async function handleAdminCreateKey(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { key, name, email, institution, role, study_title, active, mfa_enabled, parent_institution, parent_pi, peacs_dims } = body;
  if (!key || !name || !institution || !role) return respond(400, { error: 'key, name, institution, role required' }, origin);

  const profile = {
    key: key.trim().toUpperCase(), name: name.trim(), email: (email||'').trim().toLowerCase(),
    institution: institution.trim(), role, tier: role, active: active !== false,
    study_title: study_title || null, mfa_enabled: mfa_enabled || false,
    parent_institution: (parent_institution || '').trim().toUpperCase() || null,
    parent_pi:          (parent_pi          || '').trim().toUpperCase() || null,
    peacs_dims: Array.isArray(peacs_dims) ? peacs_dims.filter(d => ['base','mvmt','strata'].includes(d)) : ['base','mvmt','strata'],
    created_at: Date.now(), key_type: 'admin_issued',
    cohortLabel: institution.trim().split(' ').slice(0,3).join(' '),
    color: role === 'institution' ? '#8b6ff5' : role === 'observer' ? '#d4a843' : '#4e9cf5',
  };

  try {
    await ssm.send(new PutParameterCommand({
      Name: `/atlas/workspaces/${profile.key}`,
      Value: JSON.stringify(profile),
      Type: 'String', Overwrite: true,
    }));
  } catch(e) {
    console.error('[admin/create-key] SSM write failed:', e.message);
    return respond(500, { error: 'SSM write failed: ' + e.message }, origin);
  }

  // Send welcome email if email provided and not an observer
  let email_sent = false;
  if (email && role !== 'observer' && role !== 'superadmin') {
    try {
      const tc = TIERS[role] || { label: role };
      await ses.send(new SendEmailCommand({
        Source: `ATLAS Platform <${SES_FROM_EMAIL}>`,
        ReplyToAddresses: ['info@adherence.cc'],
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Your ATLAS workspace key: ${profile.key}` },
          Body: { Text: { Data: `Welcome ${name},\n\nYour ATLAS workspace key is:\n\n  ${profile.key}\n\nInstitution: ${institution}\nRole: ${tc.label||role}\n${study_title?'Study: '+study_title+'\n':''}\nOpen ATLAS: https://atlas.adherence.cc\n\n— Adherence Cartography · info@adherence.cc` } }
        }
      }));
      email_sent = true;
    } catch(e) { console.error('[admin/create-key] Email failed:', e.message); }
  }

  console.log(`[admin/create-key] Issued: ${profile.key} (${role})${profile.parent_institution ? ' → inst: ' + profile.parent_institution : ''}${profile.parent_pi ? ' → pi: ' + profile.parent_pi : ''}`);
  return respond(201, { key: profile.key, tier: role, institution: institution.trim(),
    parent_institution: profile.parent_institution || null,
    parent_pi:          profile.parent_pi          || null,
    atlas_url: `https://atlas.adherence.cc?key=${profile.key}`, email_sent }, origin);
}

async function handleAdminRevokeKey(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { key } = body;
  if (!key) return respond(400, { error: 'key required' }, origin);
  const normalizedKey = key.trim().toUpperCase();
  try {
    const existing = await ssm.send(new GetParameterCommand({ Name: `/atlas/workspaces/${normalizedKey}`, WithDecryption: true }));
    const profile = JSON.parse(existing.Parameter.Value);
    profile.active = false;
    profile.revoked_at = new Date().toISOString();
    await ssm.send(new PutParameterCommand({ Name: `/atlas/workspaces/${normalizedKey}`, Value: JSON.stringify(profile), Type: 'String', Overwrite: true }));
    _wsCache.delete(normalizedKey); // clear cache so next lookup sees revoked state
    console.log(`[admin/revoke-key] Revoked: ${normalizedKey}`);
    return respond(200, { revoked: true, key: normalizedKey }, origin);
  } catch(e) {
    return respond(404, { error: 'Key not found: ' + normalizedKey }, origin);
  }
}

async function handleAdminEditKey(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { key, name, email, institution, parent_institution, parent_pi, study_title, peacs_dims } = body;
  if (!key) return respond(400, { error: 'key required' }, origin);
  if (!name || !institution) return respond(400, { error: 'name and institution required' }, origin);
  const normalizedKey = key.trim().toUpperCase();
  try {
    const existing = await ssm.send(new GetParameterCommand({ Name: `/atlas/workspaces/${normalizedKey}`, WithDecryption: true }));
    const profile = JSON.parse(existing.Parameter.Value);
    // Merge editable fields — preserve all other profile fields (role, tier, active, created_at, etc.)
    profile.name        = name.trim();
    profile.email       = (email || '').trim().toLowerCase();
    profile.institution = institution.trim();
    profile.parent_institution = parent_institution ? parent_institution.trim().toUpperCase() : null;
    profile.parent_pi          = parent_pi          ? parent_pi.trim().toUpperCase()          : null;
    profile.study_title = study_title ? study_title.trim() : null;
    if (Array.isArray(peacs_dims)) profile.peacs_dims = peacs_dims.filter(d => ['base','mvmt','strata'].includes(d));
    profile.updated_at  = Date.now();
    await ssm.send(new PutParameterCommand({
      Name: `/atlas/workspaces/${normalizedKey}`,
      Value: JSON.stringify(profile),
      Type: 'String', Overwrite: true,
    }));
    _wsCache.delete(normalizedKey); // invalidate cache so next validate-key sees updated profile
    console.log(`[admin/edit-key] Updated: ${normalizedKey}`);
    return respond(200, { updated: true, key: normalizedKey }, origin);
  } catch(e) {
    if (e.name === 'ParameterNotFound') return respond(404, { error: 'Key not found: ' + normalizedKey }, origin);
    return respond(500, { error: 'Edit failed: ' + e.message }, origin);
  }
}

async function handleAdminDeleteKey(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { key } = body;
  if (!key) return respond(400, { error: 'key required' }, origin);
  const normalizedKey = key.trim().toUpperCase();
  try {
    await ssm.send(new DeleteParameterCommand({ Name: `/atlas/workspaces/${normalizedKey}` }));
    _wsCache.delete(normalizedKey);
    console.log(`[admin/delete-key] Deleted: ${normalizedKey}`);
    return respond(200, { deleted: true, key: normalizedKey }, origin);
  } catch(e) {
    if (e.name === 'ParameterNotFound') return respond(404, { error: 'Key not found: ' + normalizedKey }, origin);
    return respond(500, { error: 'Delete failed: ' + e.message }, origin);
  }
}

async function handleAdminListKeys(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const keys = [];
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/workspaces/', WithDecryption: true,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try {
          const v = JSON.parse(p.Value);
          // Exclude MFA session tokens that leaked into workspace path (safety check)
          if (p.Name.includes('/mfa-sessions/')) continue;
          keys.push({
            key:                v.key || p.Name.split('/').pop(),
            name:               v.name || '',
            email:              v.email || '',
            institution:        v.institution || '',
            role:               v.role || 'researcher',
            active:             v.active !== false,
            created_at:         v.created_at || null,
            tier:               v.tier || v.role || '',
            key_type:           v.key_type || 'manual',
            parent_institution: v.parent_institution || null,
            parent_pi:          v.parent_pi          || null,
            study_title:        v.study_title || null,
          });
        } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) {
    return respond(500, { error: 'SSM list failed: ' + e.message }, origin);
  }
  // Sort: active first, then by created_at descending
  keys.sort((a,b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (b.created_at||0) - (a.created_at||0);
  });
  return respond(200, { keys, total: keys.length }, origin);
}

async function handleAdminListGAIInquiries(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const inquiries = [];
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: '/atlas/gai_inquiries/', WithDecryption: false,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try { inquiries.push(JSON.parse(p.Value)); } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) {
    return respond(500, { error: 'SSM list failed: ' + e.message }, origin);
  }
  inquiries.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return respond(200, { inquiries }, origin);
}

async function handleAdminUpdateGAIInquiry(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { key, status } = body;
  if (!key || !status) return respond(400, { error: 'key and status required' }, origin);
  const validStatuses = ['new', 'contacted', 'converted', 'closed'];
  if (!validStatuses.includes(status)) return respond(400, { error: 'Invalid status' }, origin);
  try {
    const existing = await ssm.send(new GetParameterCommand({
      Name: `/atlas/gai_inquiries/${key}`, WithDecryption: false,
    }));
    const record = JSON.parse(existing.Parameter.Value);
    record.status = status;
    record.status_updated_at = new Date().toISOString();
    await ssm.send(new PutParameterCommand({
      Name: `/atlas/gai_inquiries/${key}`, Value: JSON.stringify(record),
      Type: 'String', Overwrite: true,
    }));
    return respond(200, { updated: true, key, status }, origin);
  } catch(e) {
    return respond(404, { error: 'Inquiry not found: ' + key }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — MANUAL LETTER OF PERMISSION (LMIC / humanitarian waiver)
// ══════════════════════════════════════════════════════════════════════════════

async function handleAdminIssueLOP(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { name, email, institution, study_title, intended_use, role, expiry, workspace_key, lmic_notes } = body;
  if (!name || !email || !institution || !study_title)
    return respond(400, { error: 'name, email, institution, study_title required' }, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return respond(400, { error: 'Invalid email address' }, origin);

  const certNum    = generateCertNum();
  const now        = Date.now();
  const expiryDate = expiry || new Date(now + 365*24*60*60*1000).toISOString().slice(0,10);
  const verifyUrl  = `${VERIFY_BASE_URL}?cert=${encodeURIComponent(certNum)}`;

  const record = {
    certNum, key: workspace_key || null,
    name: name.trim(), email: email.trim().toLowerCase(),
    institution: institution.trim(), study_title: study_title.trim(),
    intended_use: intended_use || null, role: role || 'student',
    issued_at: now, expiry: expiryDate, status: 'active',
    key_type: 'admin_lop', lmic_notes: lmic_notes || null,
    verify_url: verifyUrl,
  };
  await writePermissionRegistry(certNum, record);

  let emailSent = false;
  try {
    const letterHtml = await generatePermissionLetter(
      name.trim(), institution.trim(), study_title.trim(),
      intended_use || null, workspace_key || 'LMIC-WAIVER',
      role || 'student', now, certNum, expiryDate, true
    );
    const letterB64 = Buffer.from(letterHtml).toString('base64');
    const filename  = `ATLAS_Permission_Letter_${certNum}.html`;
    const boundary  = `----=_Part_${Date.now()}`;
    const bodyHtml  = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:32px 20px;background:#060e1e;font-family:'IBM Plex Mono',Courier,monospace;color:#c8d8ea;">
<div style="max-width:560px;margin:0 auto;border:1px solid rgba(212,168,67,0.22);border-top:3px solid rgba(212,168,67,0.75);border-radius:4px;padding:36px;">
  <div style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:24px;">ADHERENCE CARTOGRAPHY · ATLAS</div>
  <h1 style="font-family:Georgia,serif;font-size:1.75rem;font-weight:300;color:#fff;margin:0 0 20px;">Your Letter of Permission.</h1>
  <p style="color:rgba(200,220,240,0.6);font-size:0.86rem;line-height:1.7;margin:0 0 24px;">Dear ${name.trim()},<br/><br/>Your MMAS-8R Letter of Permission has been issued by Adherence Cartography as a humanitarian access waiver. The letter is attached — open it in any browser and print to PDF to produce the signed document for your IRB or ethics committee.</p>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:14px 16px;margin-bottom:20px;font-size:0.72rem;line-height:1.8;">
    <span style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.62rem;color:rgba(200,220,240,0.4);">Certificate Number</span><br/>
    <span style="font-family:'Courier New',monospace;font-size:0.88rem;color:rgba(212,168,67,0.9);letter-spacing:0.06em;">${certNum}</span><br/>
    <span style="font-size:0.68rem;color:rgba(200,220,240,0.35);">Verify at: <a href="${verifyUrl}" style="color:rgba(78,156,245,0.7);">${verifyUrl}</a></span>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;font-size:0.72rem;line-height:1.9;color:rgba(255,255,255,0.2);">MMAS-8R © Donald E. Morisky · Licensed exclusively to Adherence Inc.<br/>ATLAS Platform © Adherence Cartography · info@adherence.cc</div>
</div></body></html>`;
    const rawMsg = [
      `From: ATLAS Platform <${SES_FROM_EMAIL}>`,
      `Reply-To: info@adherence.cc`,
      `To: ${email.trim().toLowerCase()}`,
      `Subject: Your MMAS-8R Letter of Permission · ${certNum}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      bodyHtml.replace(/[^\x00-\x7E]/g, c => `=${c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')}`),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8; name="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${filename}"`,
      ``,
      letterB64.match(/.{1,76}/g).join('\n'),
      ``,
      `--${boundary}--`,
    ].join('\r\n');
    await ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(rawMsg) } }));
    emailSent = true;
  } catch(e) { console.error('[admin/issue-lop] Email failed:', e.message); }

  console.log(`[admin/issue-lop] Issued: ${certNum} for ${name.trim()} (${institution.trim()})`);
  return respond(201, { certNum, verify_url: verifyUrl, email_sent: emailSent,
    name: name.trim(), institution: institution.trim() }, origin);
}

async function handleAdminListLOPs(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const lops = [];
  try {
    let next;
    do {
      const r = await ssm.send(new GetParametersByPathCommand({
        Path: PERM_SSM_PREFIX, WithDecryption: true,
        MaxResults: 10, NextToken: next,
      }));
      for (const p of (r.Parameters || [])) {
        try {
          const v = JSON.parse(p.Value);
          if (v.key_type === 'admin_lop') lops.push(v);
        } catch(_) {}
      }
      next = r.NextToken;
    } while (next);
  } catch(e) {
    return respond(500, { error: 'SSM list failed: ' + e.message }, origin);
  }
  lops.sort((a, b) => (b.issued_at||0) - (a.issued_at||0));
  return respond(200, { lops, total: lops.length }, origin);
}

async function handleAdminRevokeLOP(body, origin, event) {
  try { await verifyAdminToken(event); } catch(e) { return respond(403, { error: e.message }, origin); }
  const { certNum } = body;
  if (!certNum) return respond(400, { error: 'certNum required' }, origin);
  const record = await readPermissionRegistry(certNum.trim().toUpperCase());
  if (!record) return respond(404, { error: 'Certificate not found' }, origin);
  if (record.key_type !== 'admin_lop') return respond(400, { error: 'Not a manually issued LOP' }, origin);
  record.status = 'revoked';
  record.revoked_at = new Date().toISOString();
  // Overwrite both stores — SSM Overwrite:true, Firebase update
  try {
    await ssm.send(new PutParameterCommand({
      Name: PERM_SSM_PREFIX + certNum.trim().toUpperCase(),
      Value: JSON.stringify(record), Type: 'SecureString', Overwrite: true,
    }));
  } catch(e) { return respond(500, { error: 'SSM update failed: ' + e.message }, origin); }
  try {
    const token   = await mintFirebaseToken('system_registry', { role: 'superadmin' });
    const idToken = await exchangeCustomTokenForIdToken(token);
    const dbPath  = `permissions/${certNum.trim().toUpperCase().replace(/\//g, '_')}`;
    await firebaseRestPut(`${FIREBASE_DB_URL}/${dbPath}.json?auth=${idToken}`, record);
  } catch(e) { console.error('[admin/revoke-lop] Firebase update failed (SSM updated):', e.message); }
  console.log(`[admin/revoke-lop] Revoked: ${certNum}`);
  return respond(200, { revoked: true, certNum: certNum.trim().toUpperCase() }, origin);
}

