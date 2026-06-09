/**
 * lambda_stripe_handler.mjs
 * Handles all Stripe-related routes for the ATLAS Lambda:
 *
 *   POST /create-checkout-session  — Create Stripe Checkout session (workspace subscription)
 *   POST /gai-checkout             — Create Stripe Checkout for GAI report purchase
 *   POST /send-magic-link          — Send Firebase magic-link email
 *   POST /stripe-webhook           — Handle all Stripe webhook events:
 *        checkout.session.completed       → issue workspace key
 *        invoice.payment_succeeded        → renew subscription_end; issue letter if study_title added post-registration
 *        invoice.payment_failed           → flag workspace + warn user
 *        customer.subscription.updated   → detect cancellation/past_due
 *        customer.subscription.deleted   → revoke workspace + cert
 */

import https from 'https';
import crypto from 'crypto';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import {
  ssm, ses, SES_FROM_EMAIL, FIREBASE_DB_URL, VERIFY_BASE_URL, LETTER_TIERS,
  mintFirebaseToken, exchangeCustomTokenForIdToken, firebaseRestPut,
  readPermissionRegistry, writePermissionRegistry, generateCertNum,
  generatePermissionLetter, findByStripeCustomer, findByStripeSubscription,
  updateWorkspaceProfile, revokeWorkspaceCertRegistry, sendLetterEmailStandalone,
  respond, corsHeaders, handleIssueKey,
} from './index.mjs';

// ── Stripe config ─────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY     || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ATLAS_BASE_URL        = 'https://atlas.adherence.cc';

// Map Stripe Price IDs → role + plan_type
// Set these as Lambda env vars (STRIPE_PRICE_STUDENT_MONTHLY, etc.)
function getPriceInfo(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_STUDENT_MONTHLY]:    { role: 'student',    plan_type: 'monthly' },
    [process.env.STRIPE_PRICE_RESEARCHER_MONTHLY]: { role: 'researcher', plan_type: 'monthly' },
    [process.env.STRIPE_PRICE_PI_MONTHLY]:         { role: 'pi',         plan_type: 'monthly' },
    [process.env.STRIPE_PRICE_STUDENT_ANNUAL]:     { role: 'student',    plan_type: 'annual'  },
    [process.env.STRIPE_PRICE_RESEARCHER_ANNUAL]:  { role: 'researcher', plan_type: 'annual'  },
    [process.env.STRIPE_PRICE_PI_ANNUAL]:          { role: 'pi',         plan_type: 'annual'  },
  };
  return map[priceId] || null;
}

const STRIPE_PRICE_GAI_STANDARD = process.env.STRIPE_PRICE_GAI_STANDARD || '';
const STRIPE_PRICE_GAI_ANNUAL   = process.env.STRIPE_PRICE_GAI_ANNUAL   || '';

// ── Stripe HTTPS helper ───────────────────────────────────────────────────────
function stripeRequest(path, method, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? new URLSearchParams(payload).toString() : '';
    const req  = https.request({
      hostname: 'api.stripe.com',
      path,
      method,
      headers: {
        'Authorization':  `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Stripe-Version': '2024-04-10',
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Stripe parse error: ' + d)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Stripe webhook signature verification ─────────────────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) throw new Error('Missing signature or secret');
  const parts     = sigHeader.split(',').reduce((m, p) => {
    const [k, v] = p.split('='); m[k] = v; return m;
  }, {});
  const timestamp = parts.t;
  const sig       = parts.v1;
  if (!timestamp || !sig) throw new Error('Malformed Stripe-Signature header');
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    throw new Error('Stripe webhook timestamp too old (>5 min)');
  }
  const expected = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    throw new Error('Stripe signature mismatch');
  }
}

// ── ROUTE: POST /create-checkout-session ─────────────────────────────────────
async function handleCreateCheckoutSession(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { price_id, name, email, institution, study_title, intended_use,
          success_url, cancel_url } = body;

  if (!price_id || !email) {
    return respond(400, { error: 'price_id and email required' }, origin);
  }

  const priceInfo = getPriceInfo(price_id);
  const role      = priceInfo?.role      || 'researcher';
  const plan_type = priceInfo?.plan_type || 'monthly';

  const params = {
    'mode':                                      'subscription',
    'payment_method_types[]':                    'card',
    'line_items[0][price]':                      price_id,
    'line_items[0][quantity]':                   '1',
    'customer_email':                            email,
    'success_url':                               success_url || `${ATLAS_BASE_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':                                cancel_url  || `${ATLAS_BASE_URL}?checkout=cancel`,
    'metadata[name]':                            name         || '',
    'metadata[email]':                           email,
    'metadata[institution]':                     institution  || '',
    'metadata[study_title]':                     study_title  || '',
    'metadata[intended_use]':                    intended_use || '',
    'metadata[role]':                            role,
    'metadata[plan_type]':                       plan_type,
    'subscription_data[metadata][role]':         role,
    'subscription_data[metadata][plan_type]':    plan_type,
    'subscription_data[metadata][institution]':  institution  || '',
    'subscription_data[metadata][study_title]':  study_title  || '',
  };

  try {
    const session = await stripeRequest('/v1/checkout/sessions', 'POST', params);
    if (session.error) return respond(400, { error: session.error.message }, origin);
    return respond(200, { url: session.url, session_id: session.id }, origin);
  } catch(e) {
    console.error('[create-checkout-session]', e.message);
    return respond(500, { error: 'Stripe error: ' + e.message }, origin);
  }
}

// ── ROUTE: POST /gai-checkout ─────────────────────────────────────────────────
async function handleGAICheckout(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { tier, name, org, email, note, inquiry_key } = body;
  const priceId = tier === 'annual' ? STRIPE_PRICE_GAI_ANNUAL : STRIPE_PRICE_GAI_STANDARD;

  if (!priceId) {
    return respond(500, { error: 'GAI price ID not configured for tier: ' + (tier || 'standard') }, origin);
  }

  const params = {
    'mode':                    'payment',
    'payment_method_types[]':  'card',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': '1',
    'customer_email':          email || '',
    'success_url':             `${ATLAS_BASE_URL}?gai_success=1&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':              `${ATLAS_BASE_URL}?gai_cancel=1`,
    'metadata[gai_tier]':      tier         || 'standard',
    'metadata[name]':          name         || '',
    'metadata[org]':           org          || '',
    'metadata[note]':          note         || '',
    'metadata[inquiry_key]':   inquiry_key  || '',
  };

  try {
    const session = await stripeRequest('/v1/checkout/sessions', 'POST', params);
    if (session.error) return respond(400, { error: session.error.message }, origin);
    return respond(200, { url: session.url }, origin);
  } catch(e) {
    console.error('[gai-checkout]', e.message);
    return respond(500, { error: 'Stripe error: ' + e.message }, origin);
  }
}

// ── ROUTE: POST /send-magic-link ──────────────────────────────────────────────
async function handleSendMagicLink(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { email } = body;
  if (!email) return respond(400, { error: 'email required' }, origin);

  try {
    const apiKey  = process.env.FIREBASE_WEB_API_KEY;
    const payload = JSON.stringify({ email, requestType: 'EMAIL_SIGNIN' });
    const result  = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'identitytoolkit.googleapis.com',
        path:     `/v1/accounts:sendOobCode?key=${apiKey}`,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      req.on('error', reject); req.write(payload); req.end();
    });
    if (result.error) return respond(400, { error: result.error.message }, origin);
    return respond(200, { sent: true }, origin);
  } catch(e) {
    console.error('[send-magic-link]', e.message);
    return respond(500, { error: 'Magic link failed: ' + e.message }, origin);
  }
}

// ── Webhook: checkout.session.completed → issue workspace key ─────────────────
async function onCheckoutComplete(session) {
  const meta        = session.metadata || {};
  const name        = meta.name         || 'Researcher';
  const email       = session.customer_email || meta.email || '';
  const institution = meta.institution  || name;
  const study_title = meta.study_title  || null;
  const intended_use= meta.intended_use || null;
  const role        = meta.role         || 'researcher';
  const plan_type   = meta.plan_type    || 'monthly';
  const inst_type   = meta.inst_type    || null;  // 'academic' | 'health' | 'amc' — only present for institution checkouts

  if (!email) { console.warn('[checkout.complete] No email on session', session.id); return; }

  await handleIssueKey({
    name, email, institution, role, study_title, intended_use,
    stripe_session_id:       session.id,
    stripe_customer_id:      session.customer        || null,
    stripe_subscription_id:  session.subscription    || null,
    plan_type,
    inst_type,
  }, 'https://atlas.adherence.cc');
}

// ── Webhook: invoice.payment_succeeded ───────────────────────────────────────
async function onInvoicePaymentSucceeded(invoice) {
  const customerId     = invoice.customer;
  const subscriptionId = invoice.subscription;
  // Stripe period_end is in seconds; convert to ms
  const periodEnd = (invoice.lines?.data?.[0]?.period?.end || 0) * 1000;
  if (!customerId) return;

  let profile;
  try {
    profile = await findByStripeCustomer(customerId)
           || await findByStripeSubscription(subscriptionId);
  } catch(e) { console.error('[invoice.succeeded] lookup failed:', e.message); return; }

  if (!profile) { console.warn('[invoice.succeeded] no workspace for customer', customerId); return; }

  const newMonthsPaid = (profile.months_paid || 0) + 1;
  const newSubEnd     = periodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000);

  const updates = {
    months_paid:            newMonthsPaid,
    subscription_end:       newSubEnd,
    active:                 true,
    payment_at_risk:        false,
    stripe_subscription_id: subscriptionId || profile.stripe_subscription_id,
  };

  // ── Letter gate: issue on first invoice if study_title was added after initial
  //    registration (e.g. via /add-study). Already-eligible profiles skip this.
  const shouldIssueLetter =
    !profile.letter_eligible &&
    LETTER_TIERS.has(profile.role) &&
    profile.study_title;

  if (shouldIssueLetter) {
    const certNum = generateCertNum();
    const registryRecord = {
      certNum,
      key:                    profile.key,
      name:                   profile.name,
      institution:            profile.institution,
      study_title:            profile.study_title,
      intended_use:           profile.intended_use || null,
      role:                   profile.role,
      issued_at:              Date.now(),
      subscription_end:       newSubEnd,
      status:                 'active',
      stripe_customer_id:     customerId,
      stripe_subscription_id: subscriptionId,
      verify_url:             `${VERIFY_BASE_URL}?cert=${encodeURIComponent(certNum)}`,
    };
    await writePermissionRegistry(certNum, registryRecord);
    updates.cert_num        = certNum;
    updates.cert_nums       = [...(Array.isArray(profile.cert_nums) ? profile.cert_nums : (profile.cert_num ? [profile.cert_num] : [])), certNum];
    updates.letter_eligible = true;

    // Build a merged profile for the email (includes fresh sub_end + cert)
    const profileForEmail = { ...profile, ...updates };
    try {
      await sendLetterEmailStandalone(profileForEmail);
      console.log(`[invoice.succeeded] Letter issued for ${profile.key} (study title added post-registration).`);
    } catch(e) {
      console.error('[invoice.succeeded] Letter email failed:', e.message);
    }
  } else if (profile.cert_num) {
    // Existing annual/already-eligible cert: update subscription_end in Firebase
    try {
      const record = await readPermissionRegistry(profile.cert_num);
      if (record?.status === 'active') {
        const token   = await mintFirebaseToken('system_registry', { role: 'superadmin' });
        const idToken = await exchangeCustomTokenForIdToken(token);
        const dbPath  = `permissions/${profile.cert_num.replace(/\//g, '_')}`;
        await firebaseRestPut(`${FIREBASE_DB_URL}/${dbPath}.json?auth=${idToken}`,
          { ...record, subscription_end: newSubEnd });
      }
    } catch(e) { console.error('[invoice.succeeded] cert registry update failed:', e.message); }
  }

  try {
    await updateWorkspaceProfile(profile.key, updates);
    console.log(`[invoice.succeeded] ${profile.key}: months_paid=${newMonthsPaid} sub_end=${new Date(newSubEnd).toISOString()}`);
  } catch(e) { console.error('[invoice.succeeded] profile update failed:', e.message); }
}

// ── Webhook: invoice.payment_failed ──────────────────────────────────────────
async function onInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  let profile;
  try { profile = await findByStripeCustomer(customerId); } catch(e) { return; }
  if (!profile?.active) return;

  try { await updateWorkspaceProfile(profile.key, { payment_at_risk: true }); }
  catch(e) { console.error('[invoice.failed] flag failed:', e.message); }

  if (profile.email) {
    try {
      await ses.send(new SendEmailCommand({
        Source:      `ATLAS Platform <${SES_FROM_EMAIL}>`,
        Destination: { ToAddresses: [profile.email] },
        Message: {
          Subject: { Data: 'ATLAS: Payment failed — action required', Charset: 'UTF-8' },
          Body: { Text: { Data: [
            `Hi ${profile.name || 'Researcher'},`,
            ``,
            `A payment for your ATLAS workspace (${profile.key}) could not be processed.`,
            ``,
            `Your access remains active during Stripe's retry window (typically 3–7 days).`,
            `If payment continues to fail, your workspace will be suspended and your`,
            `Letter of Permission will be automatically revoked — this will be visible to any`,
            `IRB or journal checking the certificate verify URL.`,
            ``,
            `To update your payment method, log into your Stripe customer portal or`,
            `reply to this email for assistance.`,
            ``,
            `— Adherence Cartography · ATLAS`,
            `info@adherence.cc`,
          ].join('\n'), Charset: 'UTF-8' } },
        },
      }));
    } catch(e) { console.error('[invoice.failed] warning email failed:', e.message); }
  }
}

// ── Webhook: customer.subscription.deleted ────────────────────────────────────
async function onSubscriptionDeleted(subscription) {
  const customerId     = subscription.customer;
  const subscriptionId = subscription.id;
  if (!customerId) return;

  let profile;
  try {
    profile = await findByStripeCustomer(customerId)
           || await findByStripeSubscription(subscriptionId);
  } catch(e) { console.error('[sub.deleted] lookup failed:', e.message); return; }

  if (!profile) { console.warn('[sub.deleted] no workspace for customer', customerId); return; }

  const now = Date.now();
  try {
    await updateWorkspaceProfile(profile.key, {
      active:           false,
      revoked_at:       new Date(now).toISOString(),
      subscription_end: now,
      payment_at_risk:  false,
    });
    console.log(`[sub.deleted] Revoked workspace ${profile.key}`);
  } catch(e) { console.error('[sub.deleted] revoke workspace failed:', e.message); }

  // Revoke cert in Firebase registry → verify page shows REVOKED
  if (profile.cert_num) {
    await revokeWorkspaceCertRegistry(profile.cert_num, 'subscription_cancelled');
  }

  // Notify user
  if (profile.email) {
    try {
      await ses.send(new SendEmailCommand({
        Source:      `ATLAS Platform <${SES_FROM_EMAIL}>`,
        Destination: { ToAddresses: [profile.email] },
        Message: {
          Subject: { Data: 'ATLAS workspace suspended — subscription cancelled', Charset: 'UTF-8' },
          Body: { Text: { Data: [
            `Hi ${profile.name || 'Researcher'},`,
            ``,
            `Your ATLAS workspace subscription has been cancelled.`,
            `Workspace key: ${profile.key}`,
            ``,
            profile.cert_num
              ? `Your Letter of Permission (cert: ${profile.cert_num}) has been automatically revoked.`
              + `\nThe certificate now shows REVOKED at:\n${VERIFY_BASE_URL}?cert=${encodeURIComponent(profile.cert_num)}`
              + `\nThis status is visible to IRBs, journals, and ethics committees.`
              : '',
            ``,
            `To restore access and reinstate your license, resubscribe at keys.adherence.cc.`,
            `Your cohort data will be accessible immediately upon resubscription.`,
            ``,
            `— Adherence Cartography · ATLAS`,
            `info@adherence.cc`,
          ].filter(Boolean).join('\n'), Charset: 'UTF-8' } },
        },
      }));
    } catch(e) { console.error('[sub.deleted] cancellation email failed:', e.message); }
  }
}

// ── Webhook: customer.subscription.updated ────────────────────────────────────
async function onSubscriptionUpdated(subscription) {
  const status = subscription.status;
  if (status === 'canceled' || status === 'unpaid') {
    return onSubscriptionDeleted(subscription);
  }
  const customerId = subscription.customer;
  if (!customerId) return;
  if (status === 'past_due') {
    try {
      const profile = await findByStripeCustomer(customerId);
      if (profile) await updateWorkspaceProfile(profile.key, { payment_at_risk: true });
    } catch(e) { console.error('[sub.updated] past_due flag failed:', e.message); }
    return;
  }
  if (status === 'active') {
    try {
      const profile = await findByStripeCustomer(customerId);
      if (profile) await updateWorkspaceProfile(profile.key, { payment_at_risk: false, active: true });
    } catch(e) {}
  }
}

// ── ROUTE: POST /stripe-webhook ───────────────────────────────────────────────
async function handleStripeWebhook(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  const sig    = headers?.['stripe-signature'] || headers?.['Stripe-Signature'] || '';

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — rejecting');
    return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'Webhook secret not configured' }) };
  }

  try {
    verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch(e) {
    console.error('[stripe-webhook] Signature verification failed:', e.message);
    return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch(e) {
    return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  console.log('[stripe-webhook] Event:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutComplete(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await onInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await onInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await onSubscriptionDeleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await onSubscriptionUpdated(event.data.object);
        break;
      default:
        // Acknowledge silently — we don't process every event type
        break;
    }
  } catch(e) {
    // Log but return 200 — Stripe retries on non-2xx, we don't want loops from bugs
    console.error('[stripe-webhook] Handler error for', event.type, ':', e.message, e.stack);
  }

  return { statusCode: 200, headers: corsHeaders(origin), body: JSON.stringify({ received: true }) };
}

// ── ROUTE: POST /institution-checkout ────────────────────────────────────────
// Accepts: inst_name, billing_name, billing_email, inst_type, plan_type, po_number
// inst_type: 'academic' | 'health' | 'amc'
// plan_type: 'monthly' | 'annual'
// Routes to the correct Stripe price ID based on type + billing cycle.
// Price IDs are Lambda env vars: STRIPE_PRICE_INST_{TYPE}_{CYCLE} (e.g. STRIPE_PRICE_INST_HEALTH_MONTHLY)
async function handleInstCheckout(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { inst_name, billing_name, billing_email, inst_type, plan_type, po_number } = body;

  if (!inst_name || !billing_email) {
    return respond(400, { error: 'inst_name and billing_email are required' }, origin);
  }
  const validTypes = ['academic', 'health', 'amc'];
  if (!validTypes.includes(inst_type)) {
    return respond(400, { error: `inst_type must be one of: ${validTypes.join(', ')}` }, origin);
  }

  // Resolve env var name: e.g. STRIPE_PRICE_INST_HEALTH_MONTHLY
  const cycle      = (plan_type === 'annual') ? 'ANNUAL' : 'MONTHLY';
  const envVarName = `STRIPE_PRICE_INST_${inst_type.toUpperCase()}_${cycle}`;
  const priceId    = process.env[envVarName];

  if (!priceId) {
    console.error(`[inst-checkout] Missing env var ${envVarName}`);
    return respond(500, { error: `Institution price ID not configured (${envVarName}). Contact info@adherence.cc.` }, origin);
  }

  const INST_LABELS = { academic: 'Institution · Academic', health: 'Institution · Health System', amc: 'Institution · Academic Medical Center' };
  const label = INST_LABELS[inst_type] || 'Institution';

  const params = {
    'mode':                                          'subscription',
    'payment_method_types[]':                        'card',
    'line_items[0][price]':                          priceId,
    'line_items[0][quantity]':                       '1',
    'customer_email':                                billing_email,
    'success_url':                                   `${ATLAS_BASE_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':                                    `https://keys.adherence.cc?checkout=cancel`,
    'metadata[name]':                                billing_name     || inst_name,
    'metadata[email]':                               billing_email,
    'metadata[institution]':                         inst_name,
    'metadata[role]':                                'institution',
    'metadata[inst_type]':                           inst_type,
    'metadata[plan_type]':                           plan_type || 'monthly',
    'metadata[po_number]':                           po_number        || '',
    'subscription_data[metadata][role]':             'institution',
    'subscription_data[metadata][inst_type]':        inst_type,
    'subscription_data[metadata][plan_type]':        plan_type || 'monthly',
    'subscription_data[metadata][institution]':      inst_name,
    'invoice_creation[enabled]':                     'true',
    ...(po_number ? { 'invoice_creation[invoice_data][custom_fields][0][name]': 'PO Number', 'invoice_creation[invoice_data][custom_fields][0][value]': po_number } : {}),
  };

  try {
    const session = await stripeRequest('/v1/checkout/sessions', 'POST', params);
    if (session.error) return respond(400, { error: session.error.message }, origin);
    return respond(200, { url: session.url, session_id: session.id }, origin);
  } catch(e) {
    console.error('[inst-checkout]', e.message);
    return respond(500, { error: 'Stripe error: ' + e.message }, origin);
  }
}

// ── ROUTE: POST /seat-checkout ────────────────────────────────────────────────
// Creates a Stripe Checkout session to purchase additional institution seats.
// Body: { seat_type, inst_key, quantity?, success_url?, cancel_url? }
async function handleSeatCheckout(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { seat_type, inst_key, quantity, success_url, cancel_url } = body;
  if (!seat_type || !inst_key) return respond(400, { error: 'seat_type and inst_key required' }, origin);

  // Price IDs per seat type — set as Lambda env vars
  const SEAT_PRICES = {
    pi:               process.env.STRIPE_PRICE_SEAT_PI       || '',
    researcher:       process.env.STRIPE_PRICE_SEAT_RES      || '',
    student:          process.env.STRIPE_PRICE_SEAT_STU      || '',
    pharmacist:       process.env.STRIPE_PRICE_SEAT_PHARMD   || '',
    np:               process.env.STRIPE_PRICE_SEAT_NP       || '',
    pa:               process.env.STRIPE_PRICE_SEAT_PA       || '',
    rn:               process.env.STRIPE_PRICE_SEAT_RN       || '',
    md:               process.env.STRIPE_PRICE_SEAT_MD       || '',
    care_coordinator: process.env.STRIPE_PRICE_SEAT_CORD     || '',
    observer:         process.env.STRIPE_PRICE_SEAT_OBSERVER || '',
  };

  const priceId = SEAT_PRICES[seat_type];
  if (!priceId) return respond(500, { error: `Seat price not configured for type: ${seat_type} — set STRIPE_PRICE_SEAT_${seat_type.toUpperCase()}` }, origin);

  const qty = Math.max(1, Math.min(50, parseInt(quantity || '1', 10)));

  const params = {
    'mode':                    'subscription',
    'payment_method_types[]':  'card',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': String(qty),
    'success_url':             success_url || `${ATLAS_BASE_URL}?seat_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':              cancel_url  || `${ATLAS_BASE_URL}?seat_checkout=cancel`,
    'metadata[seat_type]':     seat_type,
    'metadata[inst_key]':      inst_key.trim().toUpperCase(),
    'metadata[quantity]':      String(qty),
  };

  try {
    const session = await stripeRequest('/v1/checkout/sessions', 'POST', params);
    if (session.error) return respond(400, { error: session.error.message }, origin);
    return respond(200, { url: session.url, session_id: session.id }, origin);
  } catch(e) {
    console.error('[seat-checkout]', e.message);
    return respond(500, { error: 'Stripe error: ' + e.message }, origin);
  }
}

// ── Main router ───────────────────────────────────────────────────────────────
export async function handleStripeRoutes(path, method, rawBody, headers) {
  if (path.startsWith('/stripe-webhook'))           return handleStripeWebhook(rawBody, headers);
  if (path.startsWith('/create-checkout-session'))  return handleCreateCheckoutSession(rawBody, headers);
  if (path.startsWith('/institution-checkout'))     return handleInstCheckout(rawBody, headers);
  if (path.startsWith('/seat-checkout'))            return handleSeatCheckout(rawBody, headers);
  if (path.startsWith('/gai-checkout'))             return handleGAICheckout(rawBody, headers);
  if (path.startsWith('/send-magic-link'))          return handleSendMagicLink(rawBody, headers);

  const origin = headers?.origin || headers?.Origin || '';
  return respond(404, { error: 'Unknown Stripe route: ' + path }, origin);
}
