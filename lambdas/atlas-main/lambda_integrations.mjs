/**
 * lambda_integrations.mjs
 * Integration endpoint handlers for ATLAS Lambda:
 *
 *   POST /redcap-test          — Test REDCap API connectivity + save config to SSM
 *   POST /redcap-push          — Push MAP assessments to REDCap project
 *   POST /redcap-pull          — Pull REDCap records into ATLAS workspace
 *   POST /fhir-webhook-save    — Save FHIR webhook config for a workspace
 *   POST /fhir-webhook-test    — Test a configured FHIR webhook endpoint
 *   POST /admin/provision-key  — Institution admin: provision a member key
 *
 * Field aliases: Lambda accepts both `workspace_key` and `workspace`; both
 * `redcap_url`/`api_url` and `redcap_token`/`api_token`; both `webhook_url`/`fhir_url`.
 *
 * BP-SEC-01: verify-otp attempt counter (exported helpers used by index.mjs)
 */

import https from 'https';
import crypto from 'crypto';
import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import {
  ssm, ses, SES_FROM_EMAIL, respond, corsHeaders,
  lookupWorkspaceKey, isRateLimited, _ssmForKey,
} from './index.mjs';

// ── Constants ─────────────────────────────────────────────────────────────────
const REDCAP_SSM_PREFIX   = '/atlas/redcap/';         // non-secret config
const REDCAP_TOKEN_PREFIX = '/atlas/redcap-tokens/';  // SecureString
const FHIR_SSM_PREFIX     = '/atlas/fhir-webhooks/';  // SecureString
const OTP_ATTEMPTS_PREFIX = '/atlas/otp-attempts/';

const OTP_MAX_ATTEMPTS = 3;
const OTP_LOCKOUT_MS   = 15 * 60 * 1000; // 15 min

// ── Field alias helper ────────────────────────────────────────────────────────
// Accepts either modern name or legacy/client-side variant
function pick(body, ...keys) {
  for (const k of keys) if (body[k] !== undefined && body[k] !== null && body[k] !== '') return body[k];
  return undefined;
}

// ══════════════════════════════════════════════════════════════════════════════
// BP-SEC-01: OTP attempt tracking
// Exported helpers for use in index.mjs handleVerifyOTP
// ══════════════════════════════════════════════════════════════════════════════

export async function getOTPAttempts(sessionToken) {
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name: OTP_ATTEMPTS_PREFIX + sessionToken,
      WithDecryption: false,
    }));
    return JSON.parse(res.Parameter.Value);
  } catch(_) { return { count: 0, lockedAt: null }; }
}

export async function incrementOTPAttempts(sessionToken, lock = false) {
  const current = await getOTPAttempts(sessionToken);
  const updated = {
    count:    current.count + 1,
    lockedAt: lock ? Date.now() : current.lockedAt,
  };
  await ssm.send(new PutParameterCommand({
    Name:      OTP_ATTEMPTS_PREFIX + sessionToken,
    Value:     JSON.stringify(updated),
    Type:      'String',
    Overwrite: true,
  }));
  return updated;
}

export async function clearOTPAttempts(sessionToken) {
  try {
    await ssm.send(new DeleteParameterCommand({ Name: OTP_ATTEMPTS_PREFIX + sessionToken }));
  } catch(_) {}
}

export function isOTPLocked(attempts) {
  if (!attempts || attempts.count < OTP_MAX_ATTEMPTS) return false;
  if (!attempts.lockedAt) return false;
  return Date.now() - attempts.lockedAt < OTP_LOCKOUT_MS;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Resolve workspace key from body (accepts 'workspace_key' or 'workspace') */
function resolveKey(body) {
  return (pick(body, 'workspace_key', 'workspace') || '').trim().toUpperCase() || null;
}

async function authenticateKey(wk, origin) {
  if (!wk) return { error: respond(400, { error: 'workspace_key required' }, origin) };
  const profile = await lookupWorkspaceKey(wk);
  if (!profile)        return { error: respond(403, { error: 'Invalid workspace key' }, origin) };
  if (!profile.active) return { error: respond(403, { error: 'Workspace suspended' }, origin) };
  return { profile };
}

/** Make an HTTPS request. Returns { status, body } */
function httpsPost(parsedUrl, payload, headers, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || 443,
      path:     parsedUrl.pathname + (parsedUrl.search || ''),
      method:   'POST',
      headers,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        let parsed = d;
        try { parsed = JSON.parse(d); } catch(_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

function validateUrl(rawUrl, requireHttps = false) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch(e) { return { error: 'Invalid URL: ' + e.message }; }
  if (requireHttps && parsed.protocol !== 'https:') return { error: 'URL must use HTTPS' };
  if (!['https:', 'http:'].includes(parsed.protocol)) return { error: 'URL must use http or https' };
  const host = parsed.hostname;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost$|::1$)/.test(host)) {
    return { error: 'Private/loopback URLs not permitted' };
  }
  return { parsed };
}

// ══════════════════════════════════════════════════════════════════════════════
// REDCAP ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /redcap-test
 * Body: { workspace_key|workspace, api_url|redcap_url, api_token|redcap_token,
 *         id_field?, score_field?, phenotype_field? }
 * Tests connectivity to a REDCap instance. On success, saves config + token to SSM.
 * Returns: { ok, project_title, project_id, token_hash }
 */
async function handleREDCapTest(body, origin) {
  const wk  = resolveKey(body);
  const url = pick(body, 'api_url', 'redcap_url');
  const tok = pick(body, 'api_token', 'redcap_token');

  const auth = await authenticateKey(wk, origin);
  if (auth.error) return auth.error;

  if (!url || !tok) return respond(400, { error: 'api_url and api_token required' }, origin);

  const urlCheck = validateUrl(url);
  if (urlCheck.error) return respond(400, { error: urlCheck.error }, origin);
  const parsedUrl = urlCheck.parsed;

  // REDCap API path is /api/ appended to the base URL
  const apiPath = parsedUrl.pathname.replace(/\/?$/, '/') + 'api/';
  const apiParsed = new URL(url);
  apiParsed.pathname = apiPath;
  apiParsed.search = '';

  const testPayload = new URLSearchParams({
    token:   tok,
    content: 'project',
    format:  'json',
  }).toString();

  try {
    const result = await httpsPost(apiParsed, testPayload, {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(testPayload),
    });

    if (result.status !== 200 || !result.body?.project_id) {
      return respond(200, {
        ok:     false,
        error:  'REDCap returned unexpected response',
        status: result.status,
        detail: typeof result.body === 'object' ? result.body?.error : result.body,
      }, origin);
    }

    // Save config (non-secret) and token (SecureString) to SSM
    const tokenHash = crypto.createHash('sha256').update(tok).digest('hex').slice(0, 16);
    const config = {
      url:              url,
      token_hash:       tokenHash,
      id_field:         pick(body, 'id_field')         || 'record_id',
      score_field:      pick(body, 'score_field')      || 'mmas8_score',
      phenotype_field:  pick(body, 'phenotype_field')  || 'map_phenotype',
      project_id:       result.body.project_id,
      project_title:    result.body.project_title,
      connected_at:     Date.now(),
    };

    const targetSSM = _ssmForKey ? _ssmForKey(wk) : ssm;
    await Promise.all([
      targetSSM.send(new PutParameterCommand({
        Name: REDCAP_SSM_PREFIX + wk, Value: JSON.stringify(config), Type: 'String', Overwrite: true,
      })),
      targetSSM.send(new PutParameterCommand({
        Name: REDCAP_TOKEN_PREFIX + wk, Value: tok, Type: 'SecureString', Overwrite: true,
      })),
    ]);

    console.log(`[redcap-test] ws=${wk} connected project=${result.body.project_id}`);
    return respond(200, {
      ok:            true,
      project_title: result.body.project_title,
      project_id:    result.body.project_id,
      token_hash:    tokenHash,
    }, origin);

  } catch(e) {
    console.error('[redcap-test]', e.message);
    return respond(200, { ok: false, error: 'Could not reach REDCap: ' + e.message }, origin);
  }
}

/**
 * POST /redcap-push
 * Body: { workspace_key|workspace, records: [...] }
 */
async function handleREDCapPush(body, origin) {
  const wk      = resolveKey(body);
  const records = body.records;

  const auth = await authenticateKey(wk, origin);
  if (auth.error) return auth.error;

  if (!Array.isArray(records) || records.length === 0) {
    return respond(400, { error: 'records array required' }, origin);
  }
  if (records.length > 500) {
    return respond(400, { error: 'Maximum 500 records per push' }, origin);
  }

  let config, token;
  try {
    const r = await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new GetParameterCommand({ Name: REDCAP_SSM_PREFIX + wk, WithDecryption: true }));
    config = JSON.parse(r.Parameter.Value);
  } catch(_) { return respond(404, { error: 'REDCap not configured for this workspace' }, origin); }

  try {
    const r = await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new GetParameterCommand({ Name: REDCAP_TOKEN_PREFIX + wk, WithDecryption: true }));
    token = r.Parameter.Value;
  } catch(_) { return respond(500, { error: 'REDCap token not found — reconfigure integration' }, origin); }

  const urlCheck = validateUrl(config.url);
  if (urlCheck.error) return respond(500, { error: 'Stored REDCap URL is invalid' }, origin);

  const apiUrl = new URL(config.url);
  apiUrl.pathname = apiUrl.pathname.replace(/\/?$/, '/') + 'api/';
  apiUrl.search = '';

  const payload = new URLSearchParams({
    token,
    content:           'record',
    action:            'import',
    format:            'json',
    type:              'flat',
    overwriteBehavior: 'normal',
    data:              JSON.stringify(records),
    returnContent:     'count',
    returnFormat:      'json',
  }).toString();

  try {
    const result = await httpsPost(apiUrl, payload, {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    }, 20000);

    if (result.status === 200 && typeof result.body?.count === 'number') {
      console.log(`[redcap-push] ws=${wk} pushed ${result.body.count} records`);
      return respond(200, { ok: true, count: result.body.count }, origin);
    }
    return respond(200, { ok: false, error: 'REDCap import failed', detail: result.body, errors: result.body?.error || 0 }, origin);
  } catch(e) {
    console.error('[redcap-push]', e.message);
    return respond(500, { error: 'REDCap push failed: ' + e.message }, origin);
  }
}

/**
 * POST /redcap-pull
 * Body: { workspace_key|workspace, since_ts? }
 */
async function handleREDCapPull(body, origin) {
  const wk = resolveKey(body);
  const since_ts = body.since_ts;

  const auth = await authenticateKey(wk, origin);
  if (auth.error) return auth.error;

  let config, token;
  try {
    const r = await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new GetParameterCommand({ Name: REDCAP_SSM_PREFIX + wk, WithDecryption: true }));
    config = JSON.parse(r.Parameter.Value);
  } catch(_) { return respond(404, { error: 'REDCap not configured for this workspace' }, origin); }

  try {
    const r = await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new GetParameterCommand({ Name: REDCAP_TOKEN_PREFIX + wk, WithDecryption: true }));
    token = r.Parameter.Value;
  } catch(_) { return respond(500, { error: 'REDCap token not found — reconfigure integration' }, origin); }

  const apiUrl = new URL(config.url);
  apiUrl.pathname = apiUrl.pathname.replace(/\/?$/, '/') + 'api/';
  apiUrl.search = '';

  const exportParams = {
    token,
    content:       'record',
    action:        'export',
    format:        'json',
    type:          'flat',
    rawOrLabel:    'raw',
    returnFormat:  'json',
  };
  if (since_ts && typeof since_ts === 'number') {
    const dt = new Date(since_ts);
    exportParams.dateRangeBegin = dt.toISOString().replace('T', ' ').slice(0, 19);
  }

  const payload = new URLSearchParams(exportParams).toString();

  try {
    const result = await httpsPost(apiUrl, payload, {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    }, 25000);

    if (result.status === 200 && Array.isArray(result.body)) {
      console.log(`[redcap-pull] ws=${wk} pulled ${result.body.length} records`);
      return respond(200, { ok: true, count: result.body.length, records: result.body }, origin);
    }
    return respond(200, { ok: false, error: 'REDCap export failed', detail: result.body }, origin);
  } catch(e) {
    console.error('[redcap-pull]', e.message);
    return respond(500, { error: 'REDCap pull failed: ' + e.message }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FHIR WEBHOOK ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /fhir-webhook-save
 * Body: { workspace_key|workspace, webhook_url|fhir_url, webhook_secret?,
 *         auth_type?, token?, events?: string[] }
 */
async function handleFHIRWebhookSave(body, origin) {
  const wk  = resolveKey(body);
  const url = pick(body, 'webhook_url', 'fhir_url');
  const secret   = pick(body, 'webhook_secret', 'token') || null;
  const authType = pick(body, 'auth_type') || 'none';
  const events   = body.events;

  const auth = await authenticateKey(wk, origin);
  if (auth.error) return auth.error;

  if (!url) return respond(400, { error: 'webhook_url (or fhir_url) required' }, origin);

  const urlCheck = validateUrl(url, true); // require HTTPS
  if (urlCheck.error) return respond(400, { error: urlCheck.error }, origin);

  const config = {
    url,
    secret:     secret,
    auth_type:  authType,
    events:     Array.isArray(events) ? events : ['assessment.completed', 'phenotype.classified'],
    created_at: Date.now(),
    workspace:  wk,
  };

  try {
    await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new PutParameterCommand({
      Name:      FHIR_SSM_PREFIX + wk,
      Value:     JSON.stringify(config),
      Type:      'SecureString',
      Overwrite: true,
    }));
    console.log(`[fhir-webhook-save] ws=${wk} configured`);
    return respond(200, { ok: true, events: config.events }, origin);
  } catch(e) {
    console.error('[fhir-webhook-save]', e.message);
    return respond(500, { error: 'Could not save webhook config: ' + e.message }, origin);
  }
}

/**
 * POST /fhir-webhook-test
 * Body: { workspace_key|workspace, observation? }
 * Sends a test FHIR Observation ping to the configured webhook endpoint.
 */
async function handleFHIRWebhookTest(body, origin) {
  const wk = resolveKey(body);

  const auth = await authenticateKey(wk, origin);
  if (auth.error) return auth.error;

  let config;
  try {
    const res = await ((_ssmForKey ? _ssmForKey(wk) : ssm)).send(new GetParameterCommand({
      Name: FHIR_SSM_PREFIX + wk, WithDecryption: true,
    }));
    config = JSON.parse(res.Parameter.Value);
  } catch(_) { return respond(404, { error: 'FHIR webhook not configured for this workspace' }, origin); }

  const urlCheck = validateUrl(config.url, true);
  if (urlCheck.error) return respond(500, { error: 'Stored webhook URL is invalid' }, origin);
  const parsedUrl = urlCheck.parsed;

  const testBundle = body.observation || {
    resourceType:      'Observation',
    id:                'atlas-test-' + crypto.randomBytes(4).toString('hex'),
    status:            'final',
    code: { coding: [{ system: 'https://adherence.cc/fhir/codes', code: 'MAP-PHENOTYPE', display: 'MAP Adherence Phenotype' }] },
    valueString:       'TEST — ATLAS webhook connectivity check',
    effectiveDateTime: new Date().toISOString(),
    note: [{ text: 'Test notification from ATLAS Platform (adherence.cc)' }],
  };

  const payload = JSON.stringify(testBundle);

  const headers = {
    'Content-Type':   'application/fhir+json',
    'Content-Length': Buffer.byteLength(payload),
    'X-ATLAS-Source': 'atlas.adherence.cc',
    'X-ATLAS-Event':  'webhook.test',
  };

  // Add auth header based on configured auth_type
  if (config.secret) {
    if (config.auth_type === 'bearer') {
      headers['Authorization'] = `Bearer ${config.secret}`;
    } else if (config.auth_type === 'basic') {
      headers['Authorization'] = `Basic ${Buffer.from(config.secret).toString('base64')}`;
    } else {
      // HMAC signature
      const sig = crypto.createHmac('sha256', config.secret).update(payload).digest('hex');
      headers['X-ATLAS-Signature'] = 'sha256=' + sig;
    }
  }

  try {
    const result = await httpsPost(parsedUrl, payload, headers, 10000);
    const ok = result.status >= 200 && result.status < 300;
    console.log(`[fhir-webhook-test] ws=${wk} status=${result.status} ok=${ok}`);
    return respond(200, { ok, status: result.status, message: ok ? 'FHIR server responded ' + result.status : undefined }, origin);
  } catch(e) {
    console.error('[fhir-webhook-test]', e.message);
    return respond(200, { ok: false, error: 'Webhook delivery failed: ' + e.message }, origin);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTITUTION ADMIN: /admin/provision-key
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/provision-key
 * Body: { inst_key, member_email, member_name, member_role }
 * Provisions a new member key under an institution workspace and emails the member.
 * Requires superadmin OR inst_admin role for that workspace.
 */
async function handleAdminProvisionKey(body, origin, event) {
  const authHeader = (event.headers?.authorization || event.headers?.Authorization || '').replace('Bearer ', '').trim();
  if (!authHeader) return respond(401, { error: 'Authorization header required' }, origin);

  let callerPayload;
  try {
    callerPayload = JSON.parse(Buffer.from(authHeader.split('.')[1], 'base64url').toString());
  } catch(_) { return respond(401, { error: 'Invalid token' }, origin); }

  const callerRole      = callerPayload?.role || callerPayload?.claims?.role || '';
  const callerWorkspace = (callerPayload?.workspace || '').toUpperCase();

  const { inst_key, member_email, member_name, member_role } = body;
  if (!inst_key || !member_email || !member_name || !member_role) {
    return respond(400, { error: 'inst_key, member_email, member_name, member_role required' }, origin);
  }

  const normalizedKey = inst_key.trim().toUpperCase();

  const isSuperadmin = callerRole === 'superadmin';
  const isInstAdmin  = callerRole === 'inst_admin' && callerWorkspace === normalizedKey;
  if (!isSuperadmin && !isInstAdmin) {
    return respond(403, { error: 'superadmin or inst_admin role required for this workspace' }, origin);
  }

  const ALLOWED_MEMBER_ROLES = ['researcher', 'clinician', 'pharmacist', 'np', 'pa', 'rn', 'md', 'care_coordinator', 'student', 'spectator'];
  if (!ALLOWED_MEMBER_ROLES.includes(member_role)) {
    return respond(400, { error: `member_role must be one of: ${ALLOWED_MEMBER_ROLES.join(', ')}` }, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member_email)) {
    return respond(400, { error: 'Invalid member_email' }, origin);
  }

  const suffix    = crypto.randomBytes(3).toString('hex').toUpperCase();
  const year      = new Date().getFullYear();
  const memberKey = `${normalizedKey}-MBR-${suffix}-${year}`;
  const now       = Date.now();

  const profile = {
    key:                memberKey,
    name:               member_name.trim(),
    email:              member_email.trim().toLowerCase(),
    role:               member_role,
    tier:               member_role,
    institution:        normalizedKey,
    parent_institution: normalizedKey,
    active:             true,
    key_type:           'institution_member',
    created_at:         now,
    created_by:         callerWorkspace || 'superadmin',
    subscription_start: now,
    subscription_end:   now + 365 * 24 * 60 * 60 * 1000,
  };

  try {
    const targetSSM = _ssmForKey ? _ssmForKey(normalizedKey) : ssm;
    await targetSSM.send(new PutParameterCommand({
      Name: `/atlas/workspaces/${memberKey}`, Value: JSON.stringify(profile),
      Type: 'String', Overwrite: false,
    }));
  } catch(e) {
    console.error('[admin/provision-key] SSM write failed:', e.message);
    return respond(500, { error: 'Could not provision key: ' + e.message }, origin);
  }

  let emailSent = false;
  try {
    const { SendEmailCommand } = await import('@aws-sdk/client-ses');
    await ses.send(new SendEmailCommand({
      Source:      `ATLAS Platform <${SES_FROM_EMAIL}>`,
      Destination: { ToAddresses: [profile.email] },
      Message: {
        Subject: { Data: `Your ATLAS workspace access — ${normalizedKey}`, Charset: 'UTF-8' },
        Body: { Text: { Data: [
          `Hi ${member_name.trim()},`,
          ``,
          `You have been added to the ${normalizedKey} workspace on the ATLAS platform.`,
          ``,
          `Your access key: ${memberKey}`,
          `Role: ${member_role}`,
          ``,
          `To access your workspace:`,
          `https://atlas.adherence.cc?key=${memberKey}`,
          ``,
          `— Adherence Cartography · ATLAS`,
          `info@adherence.cc`,
        ].join('\n'), Charset: 'UTF-8' } },
      },
    }));
    emailSent = true;
  } catch(emailErr) {
    console.warn('[admin/provision-key] Email failed (key still created):', emailErr.message);
  }

  console.log(`[admin/provision-key] Provisioned ${memberKey} for ${member_email} under ${normalizedKey}`);
  return respond(201, {
    ok:         true,
    key:        memberKey,
    role:       member_role,
    email_sent: emailSent,
    atlas_url:  `https://atlas.adherence.cc?key=${memberKey}`,
  }, origin);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════════════════════════
export async function handleIntegrationRoutes(path, method, body, origin, event) {
  if (path.endsWith('/redcap-test'))         return handleREDCapTest(body, origin);
  if (path.endsWith('/redcap-push'))         return handleREDCapPush(body, origin);
  if (path.endsWith('/redcap-pull'))         return handleREDCapPull(body, origin);
  if (path.endsWith('/fhir-webhook-save'))   return handleFHIRWebhookSave(body, origin);
  if (path.endsWith('/fhir-webhook-test'))   return handleFHIRWebhookTest(body, origin);
  if (path.endsWith('/admin/provision-key')) return handleAdminProvisionKey(body, origin, event);
  return null;
}
