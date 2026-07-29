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
  mintFirebaseToken, exchangeCustomTokenForIdToken, firebaseRestPut, firebaseRestGet, firebaseRestPost,
  readPermissionRegistry, writePermissionRegistry, generateCertNum,
  generatePermissionLetter, findByStripeCustomer, findByStripeSubscription,
  updateWorkspaceProfile, revokeWorkspaceCertRegistry, sendLetterEmailStandalone,
  respond, corsHeaders, handleIssueKey,
} from './index.mjs';

const TESSERA_TIER_MAP = { 1:'institutional', 2:'validation', 3:'affiliate', 4:'student', 5:'industry' };

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
  const meta             = session.metadata || {};
  const name             = meta.name         || 'Researcher';
  const email            = session.customer_email || meta.email || '';
  const institution      = meta.institution  || name;
  const study_title      = meta.study_title  || null;
  const intended_use     = meta.intended_use || null;
  const role             = meta.role         || 'researcher';
  const plan_type        = meta.plan_type    || 'monthly';
  const inst_type        = meta.inst_type    || null;
  const tessera_app_key = meta.tessera_app_key || null;

  if (!email) { console.warn('[checkout.complete] No email on session', session.id); return; }

  const result = await handleIssueKey({
    name, email, institution, role, study_title, intended_use,
    stripe_session_id:       session.id,
    stripe_customer_id:      session.customer        || null,
    stripe_subscription_id:  session.subscription    || null,
    plan_type,
    inst_type,
  }, 'https://atlas.adherence.cc');

  // If this was a TESSERA paid application, create member record/letter/tile from staging
  if (tessera_app_key) {
    try {
      const resultBody = JSON.parse(result.body || '{}');
      const issuedKey  = resultBody.key;

      const token   = await mintFirebaseToken('system_registry', { role: 'superadmin' });
      const idToken = await exchangeCustomTokenForIdToken(token);

      // Read staging record written by Mission Control on approval
      const staging = await firebaseRestGet(
        `${FIREBASE_DB_URL}/consortium_pending_members/${tessera_app_key}.json?auth=${idToken}`
      );
      if (!staging || staging.error) {
        console.warn(`[checkout.complete] No staging record for app ${tessera_app_key}`);
        return;
      }

      const tierStr   = TESSERA_TIER_MAP[staging.tier] || 'affiliate';
      const instruments = (staging.instruments && staging.instruments.length)
        ? staging.instruments.join(', ') : 'MAP, MMAS-8';
      const now = Date.now();

      // 1. Create member record
      const memberData = {
        name:          staging.name          || '',
        contact_email: staging.contact_email || staging.email || '',
        email:         staging.email         || staging.contact_email || '',
        institution:   staging.institution   || '',
        department:    staging.department    || '',
        country:       staging.country       || '',
        role:          staging.role          || '',
        tier:          staging.tier          || 3,
        study_title:   staging.study_title   || '',
        disease_areas: staging.disease_areas || [],
        instruments:   staging.instruments   || [],
        irb_status:    staging.irb_status    || '',
        description:   staging.description   || '',
        open_science:  staging.open_science  || false,
        lmic_eligible: staging.lmic_eligible || false,
        orcid:         staging.orcid         || '',
        linkedin:      staging.linkedin      || '',
        applied_at:    staging.applied_at    || now,
        approved_at:   now,
        application_ref: staging.application_ref || '',
        workspace_key: issuedKey || null,
        status:        'active',
        source:        'tessera-signup-form-v1',
      };
      const memberResp  = await firebaseRestPost(`${FIREBASE_DB_URL}/consortium_members.json?auth=${idToken}`, memberData);
      const newMemberKey = memberResp?.name;

      // 2. Create consortium letter
      await firebaseRestPost(`${FIREBASE_DB_URL}/consortium_letters.json?auth=${idToken}`, {
        recipient_name:   staging.name        || '',
        country:          staging.country     || '',
        institution:      staging.institution || '',
        study_title:      staging.study_title || '',
        instrument:       instruments,
        purpose:          staging.description || 'Research use within the TESSERA GRC consortium',
        grant_agency:     staging.grant_agency    || '',
        grant_mechanism:  staging.grant_mechanism || '',
        status:           'issued',
        issued_at:        now,
        auto_issued:      true,
        member_key:       newMemberKey || null,
      });

      // 3. Create mosaic tile
      const tileData = {
        name:        staging.name        || '',
        country:     staging.country     || '',
        countryFlag: staging.country_flag || '',
        tier:        tierStr,
        joinedAt:    now,
      };
      if (staging.role)        tileData.role        = staging.role;
      if (staging.institution) tileData.affiliation = staging.institution;
      if (staging.orcid)       tileData.orcid       = staging.orcid;
      if (staging.linkedin)    tileData.linkedin    = staging.linkedin;
      const tileResp = await firebaseRestPost(`${FIREBASE_DB_URL}/tessera_tiles.json?auth=${idToken}`, tileData);
      const tileKey  = tileResp?.name;

      // 4. Link tile back to member record
      if (newMemberKey && tileKey) {
        await firebaseRestPut(`${FIREBASE_DB_URL}/consortium_members/${newMemberKey}/tessera_tile_key.json?auth=${idToken}`, tileKey);
      }

      // 5. Update application: approved + member key
      await firebaseRestPut(`${FIREBASE_DB_URL}/consortium_applications/${tessera_app_key}/status.json?auth=${idToken}`, 'approved');
      if (newMemberKey) {
        await firebaseRestPut(`${FIREBASE_DB_URL}/consortium_applications/${tessera_app_key}/member_key.json?auth=${idToken}`, newMemberKey);
      }
      if (issuedKey) {
        await firebaseRestPut(`${FIREBASE_DB_URL}/consortium_applications/${tessera_app_key}/workspace_key.json?auth=${idToken}`, issuedKey);
      }

      // 6. Remove staging record
      await firebaseRestPut(`${FIREBASE_DB_URL}/consortium_pending_members/${tessera_app_key}.json?auth=${idToken}`, null);

      console.log(`[checkout.complete] TESSERA app ${tessera_app_key} → member ${newMemberKey} → workspace ${issuedKey}`);
    } catch(e) {
      console.error('[checkout.complete] TESSERA post-payment provisioning failed:', e.message);
    }
  }
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

// ── ROUTE: POST /tessera-payment-link ─────────────────────────────────────────
// Creates a Stripe Checkout session for a TESSERA applicant who was approved but
// needs to pay before receiving their workspace key. Emails the payment link.
// Body: { member_key, name, email, institution, study_title?, role? }
async function handleTesseraPaymentLink(rawBody, headers) {
  const origin = headers?.origin || headers?.Origin || '';
  let body = {};
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {}); } catch(_) {}

  const { app_key, name, email, institution, study_title, role } = body;
  if (!app_key || !email || !name || !institution) {
    return respond(400, { error: 'app_key, name, email, and institution are required' }, origin);
  }

  const priceId = process.env.STRIPE_PRICE_STUDENT_ANNUAL;
  if (!priceId) {
    return respond(500, { error: 'STRIPE_PRICE_STUDENT_ANNUAL not configured' }, origin);
  }

  const resolvedRole = role || 'student';
  const params = {
    'mode':                                              'subscription',
    'payment_method_types[]':                            'card',
    'line_items[0][price]':                              priceId,
    'line_items[0][quantity]':                           '1',
    'customer_email':                                    email,
    'success_url':                                       `https://atlas.adherence.cc?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':                                        `https://scalacartafoundation.org?checkout=cancel`,
    'metadata[name]':                                    name,
    'metadata[email]':                                   email,
    'metadata[institution]':                             institution,
    'metadata[study_title]':                             study_title || '',
    'metadata[role]':                                    resolvedRole,
    'metadata[plan_type]':                               'annual',
    'metadata[tessera_app_key]':                         app_key,
    'subscription_data[metadata][role]':                 resolvedRole,
    'subscription_data[metadata][plan_type]':            'annual',
    'subscription_data[metadata][institution]':          institution,
    'subscription_data[metadata][study_title]':          study_title || '',
    'subscription_data[metadata][tessera_app_key]':      app_key,
  };

  let session;
  try {
    session = await stripeRequest('/v1/checkout/sessions', 'POST', params);
    if (session.error) return respond(400, { error: session.error.message }, origin);
  } catch(e) {
    console.error('[tessera-payment-link] Stripe error:', e.message);
    return respond(500, { error: 'Stripe error: ' + e.message }, origin);
  }

  // Email the payment link to the applicant
  try {
    const studyLine = study_title
      ? `<p style="font-size:0.84rem;line-height:1.7;color:rgba(200,220,240,0.6);margin:0 0 20px;">Study: <em style="color:rgba(200,220,240,0.88);">${study_title}</em></p>`
      : '';
    await ses.send(new SendEmailCommand({
      Source:      `TESSERA GRC <${SES_FROM_EMAIL}>`,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'TESSERA GRC — Complete your membership', Charset: 'UTF-8' },
        Body: {
          Html: { Data: `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:32px 20px;background:#060e1e;font-family:'IBM Plex Mono',Courier,monospace;color:#c8d8ea;">
<div style="max-width:540px;margin:0 auto;border:1px solid rgba(212,168,67,0.22);border-top:3px solid rgba(212,168,67,0.75);border-radius:4px;padding:36px;">
  <div style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:24px;">TESSERA GRC · Scala Carta Foundation</div>
  <h1 style="font-family:Georgia,serif;font-size:1.6rem;font-weight:300;color:#fff;margin:0 0 16px;">Your application has been approved.</h1>
  <p style="font-size:0.88rem;line-height:1.8;color:rgba(200,220,240,0.8);margin:0 0 14px;">
    Hi ${name}, your application to join TESSERA GRC as a Student Affiliate has been reviewed and approved by the Scala Carta Foundation.
  </p>
  ${studyLine}
  <p style="font-size:0.84rem;line-height:1.8;color:rgba(200,220,240,0.7);margin:0 0 28px;">
    To activate your membership and receive your ATLAS workspace key and Letter of Permission, complete the $199/year Student Affiliate membership payment using the secure link below. Your key and letter will be issued automatically once payment is confirmed.
  </p>
  <a href="${session.url}" style="display:inline-block;padding:14px 32px;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.48);border-radius:8px;color:#e8c96a;font-size:0.88rem;text-decoration:none;letter-spacing:0.06em;font-family:'IBM Plex Mono',monospace;">Complete Membership Payment — $199/yr →</a>
  <p style="margin-top:32px;font-size:0.76rem;color:rgba(200,220,240,0.35);line-height:1.7;">
    Questions? <a href="mailto:info@adherence.cc" style="color:rgba(212,168,67,0.5);">info@adherence.cc</a>
  </p>
  <hr style="border:none;border-top:1px solid rgba(212,168,67,0.12);margin:20px 0;"/>
  <p style="font-size:0.76rem;color:rgba(200,220,240,0.3);margin:0;line-height:1.8;">
    Philip Morisky, MBA<br/>
    Founder, Scala Carta Foundation &middot; CEO, Adherence Cartography<br/>
    <a href="https://adherence.cc" style="color:rgba(212,168,67,0.4);text-decoration:none;">adherence.cc</a> &middot; <a href="https://scalacartafoundation.org" style="color:rgba(212,168,67,0.4);text-decoration:none;">scalacartafoundation.org</a>
  </p>
</div>
</body></html>`, Charset: 'UTF-8' },
          Text: { Data: [
            `Hi ${name},`,
            ``,
            `Your TESSERA GRC application has been approved by the Scala Carta Foundation.`,
            study_title ? `Study: ${study_title}\n` : '',
            `Complete your $199/year Student Affiliate membership payment here:`,
            ``,
            session.url,
            ``,
            `Your ATLAS workspace key and Letter of Permission will be issued automatically once payment is confirmed.`,
            ``,
            `Questions? info@adherence.cc`,
            ``,
            `Philip Morisky, MBA`,
            `Founder, Scala Carta Foundation · CEO, Adherence Cartography`,
            `adherence.cc · scalacartafoundation.org`,
          ].filter(l => l !== null).join('\n'), Charset: 'UTF-8' },
        },
      },
    }));
    console.log(`[tessera-payment-link] Payment email sent to ${email} for app ${app_key}`);
  } catch(e) {
    console.error('[tessera-payment-link] Email failed:', e.message);
  }

  return respond(200, { url: session.url, session_id: session.id, sent: true }, origin);
}

// ── Main router ───────────────────────────────────────────────────────────────
export async function handleStripeRoutes(path, method, rawBody, headers) {
  if (path.startsWith('/stripe-webhook'))           return handleStripeWebhook(rawBody, headers);
  if (path.startsWith('/create-checkout-session'))  return handleCreateCheckoutSession(rawBody, headers);
  if (path.startsWith('/institution-checkout'))     return handleInstCheckout(rawBody, headers);
  if (path.startsWith('/seat-checkout'))            return handleSeatCheckout(rawBody, headers);
  if (path.startsWith('/gai-checkout'))             return handleGAICheckout(rawBody, headers);
  if (path.startsWith('/tessera-payment-link'))     return handleTesseraPaymentLink(rawBody, headers);
  if (path.startsWith('/send-magic-link'))          return handleSendMagicLink(rawBody, headers);

  const origin = headers?.origin || headers?.Origin || '';
  return respond(404, { error: 'Unknown Stripe route: ' + path }, origin);
}
