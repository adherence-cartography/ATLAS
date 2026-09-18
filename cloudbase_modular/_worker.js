import apiWorker from './api/_api_worker.js';

// ── Stripe helpers ───────────────────────────────────────────────────────────
const PRICE_TO_TIER = {
  'price_1TyOP3DCONQBAuS4cBDLdobx': { name: 'Institutional Partner',       lmic: false, id: 1 },
  'price_1TyOOmDCONQBAuS4h9G9h8JR': { name: 'Validation Partner',          lmic: false, id: 2 },
  'price_1TyOO2DCONQBAuS4ZqQwgRla': { name: 'Research Affiliate',          lmic: false, id: 3 },
  'price_1TyOOMDCONQBAuS4U0L6umrb': { name: 'Student Affiliate',           lmic: false, id: 4 },
  'price_1TyOPtDCONQBAuS43H5414OX': { name: 'Institutional Partner (LMIC)', lmic: true,  id: 1 },
  'price_1TyOPfDCONQBAuS4cgcKgPm2': { name: 'Validation Partner (LMIC)',   lmic: true,  id: 2 },
  'price_1TyOPPDCONQBAuS451jqqL6O': { name: 'Research Affiliate (LMIC)',   lmic: true,  id: 3 },
};

const FIREBASE_DB = 'https://adherence-project-2026-default-rtdb.firebaseio.com';

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  let ts = '', sigs = [];
  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=');
    const k = part.slice(0, eq), v = part.slice(eq + 1);
    if (k === 't') ts = v;
    if (k === 'v1') sigs.push(v);
  }
  if (!ts || !sigs.length) throw new Error('Missing t or v1 in Stripe-Signature');
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > 300) throw new Error('Stale webhook timestamp');
  const signed = new TextEncoder().encode(ts + '.' + rawBody);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac  = await crypto.subtle.sign('HMAC', key, signed);
  const hex  = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (!sigs.includes(hex)) throw new Error('Stripe signature mismatch');
}

async function handleStripeWebhook(request, env) {
  const sig     = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook not configured', { status: 500 });
  }
  try {
    await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch (e) { return new Response('Invalid JSON', { status: 400 }); }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const sid      = session.id;
    const email    = session.customer_details?.email || '';
    const custId   = session.customer || '';
    const subId    = session.subscription || '';
    const name     = session.customer_details?.name || '';
    const safeKey  = sid.replace(/[.$#[\]/]/g, '_');

    // priceId stored in metadata at session creation time
    let priceId = session.metadata?.priceId || '';
    if (!priceId) {
      try {
        const li = await fetch(
          'https://api.stripe.com/v1/checkout/sessions/' + sid + '/line_items?limit=1',
          { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } }
        );
        priceId = (await li.json()).data?.[0]?.price?.id || '';
      } catch (e) { console.error('[stripe-webhook] line_items fetch failed:', e.message); }
    }

    if (session.metadata?.type === 'donation') {
      const record = {
        session_id:    sid,
        customer_email: email,
        customer_name: name,
        price_id:      priceId,
        donation_tier: session.metadata?.donationTier || 'unknown',
        amount_total:  session.amount_total || 0,
        currency:      session.currency || 'usd',
        status:        'received',
        ts:            Date.now(),
      };
      try {
        const _authQ = env.FIREBASE_DB_SECRET ? ('?auth=' + env.FIREBASE_DB_SECRET) : '';
        if (!_authQ) console.error('[stripe-webhook] FIREBASE_DB_SECRET not set — donation write will be denied by security rules');
        const fbResp = await fetch(FIREBASE_DB + '/foundation_donations/' + safeKey + '.json' + _authQ, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
        if (fbResp.ok) {
          console.log('[stripe-webhook] Recorded donation:', sid, record.donation_tier, email);
        } else {
          console.error('[stripe-webhook] Firebase donation write failed:', await fbResp.text());
        }
      } catch (e) {
        console.error('[stripe-webhook] Firebase donation write error:', e.message);
      }
    } else {
      const tier = PRICE_TO_TIER[priceId] || { name: 'Unknown', lmic: false, id: 0 };
      const record = {
        session_id:      sid,
        customer_email:  email,
        customer_name:   name,
        customer_id:     custId,
        subscription_id: subId,
        price_id:        priceId,
        tier:            tier.name,
        tier_id:         tier.id,
        lmic:            tier.lmic,
        amount_total:    session.amount_total || 0,
        currency:        session.currency || 'usd',
        status:          'pending_provisioning',
        ts:              Date.now(),
      };
      try {
        const _authQ = env.FIREBASE_DB_SECRET ? ('?auth=' + env.FIREBASE_DB_SECRET) : '';
        if (!_authQ) console.error('[stripe-webhook] FIREBASE_DB_SECRET not set — payment write will be denied by security rules');
        const fbResp = await fetch(FIREBASE_DB + '/tessera_payments/' + safeKey + '.json' + _authQ, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
        if (fbResp.ok) {
          console.log('[stripe-webhook] Recorded payment:', sid, tier.name, email);
        } else {
          console.error('[stripe-webhook] Firebase write failed:', await fbResp.text());
        }
      } catch (e) {
        console.error('[stripe-webhook] Firebase write error:', e.message);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

// BP-SEC-05: KV global rate limiting — RATE_LIMIT_KV namespace bound in wrangler.toml
async function rateLimitKV(ip, env) {
  if (!env.RATE_LIMIT_KV) {
    console.error('[ATLAS] RATE_LIMIT_KV binding missing — rate limiting disabled');
    return false;
  }
  const kvKey = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
  try {
    const count = parseInt(await env.RATE_LIMIT_KV.get(kvKey) || '0');
    if (count >= 60) return true; // rate limited
    await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), { expirationTtl: 120 });
    return false;
  } catch (e) {
    return false; // fail open if KV errors
  }
}

// File extensions served by CF CDN before the Worker runs; skip rate limiting.
const STATIC_EXT_RE = /\.(?:html?|js|mjs|css|map|ico|png|jpe?g|gif|webp|svg|woff2?|ttf|otf|eot|json|xml|txt|pdf|xlsm?)$/i;

// ── Cache-control strategy ────────────────────────────────────────────────────
// /modules/*.js are actively developed — use no-cache so browsers always
// revalidate. CSS and other static assets stay long-lived.
function getCacheControl(pathname) {
  if (pathname.startsWith('/modules/') && pathname.endsWith('.js')) {
    // Never serve stale module files — always revalidate with origin
    return 'public, max-age=0, must-revalidate';
  }
  if (pathname.endsWith('.css')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
}

async function proxyToLambda(request, url, baseUrl, prefix) {
  const lambdaURL = baseUrl + url.pathname.replace(prefix, '') + (url.search || '');
  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const bodyText = hasBody ? await request.text() : undefined;
    const authHeader = request.headers.get('Authorization') || '';
    const lambdaResp = await fetch(lambdaURL, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: bodyText,
    });
    const responseText = await lambdaResp.text();
    return new Response(responseText, {
      status: lambdaResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const requestId = crypto.randomUUID().substring(0, 8).toUpperCase();
    console.error(`[${requestId}] Lambda proxy error:`, err.message, err.stack);
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable', requestId, ts: Date.now() }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Benchmark Cache — scheduled handler ──────────────────────────────────────
// Runs every 6 hours (see wrangler.toml [triggers]).
// Reads all /assessments, groups by condition, computes anonymised aggregate
// stats, and writes to /benchmark_cache. Enforces n ≥ 20 per condition cell
// so no individual workspace can be reverse-identified.
// Requires FIREBASE_ADMIN_SECRET wrangler secret (legacy database secret).

function _benchSlug(condition) {
  return condition.replace(/[.$#[\]/]/g, '_').substring(0, 120);
}

async function runBenchmarkCache(env) {
  const FB     = env.FIREBASE_DB_URL;
  const secret = env.FIREBASE_ADMIN_SECRET;
  if (!FB || !secret) {
    console.error('[benchmark-cache] FIREBASE_DB_URL or FIREBASE_ADMIN_SECRET missing — skipping');
    return;
  }

  let raw;
  try {
    const resp = await fetch(`${FB}/assessments.json?auth=${encodeURIComponent(secret)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    raw = await resp.json();
  } catch (e) {
    console.error('[benchmark-cache] Failed to read /assessments:', e.message);
    return;
  }

  const records = raw ? Object.values(raw) : [];
  console.log(`[benchmark-cache] Loaded ${records.length} records`);

  const byCondition = {};
  const allScores   = [];

  for (const rec of records) {
    if (!rec || typeof rec.score !== 'number') continue;
    const s = Math.max(0, Math.min(8, rec.score));
    allScores.push(s);
    const cond = (rec.condition || '').trim();
    if (cond) {
      (byCondition[cond] = byCondition[cond] || []).push(s);
    }
  }

  function computeStats(scores) {
    const n = scores.length;
    if (n < 20) return null;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const sd   = n > 1 ? Math.sqrt(scores.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : 0;
    const dist = Array(9).fill(0);
    scores.forEach(s => { const b = s >= 8 ? 8 : Math.max(0, Math.min(7, Math.floor(s))); dist[b]++; });
    const sorted = [...scores].sort((a, b) => a - b);
    const mid    = Math.floor(n / 2);
    const med    = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return {
      n,
      mean:     parseFloat(mean.toFixed(4)),
      sd:       parseFloat(sd.toFixed(4)),
      dist,
      high_pct: parseFloat((dist[8] / n).toFixed(4)),
      med:      parseFloat(med.toFixed(2)),
    };
  }

  const writes    = [];
  const condIndex = {};

  const allStats = computeStats(allScores);
  if (allStats) writes.push({ path: 'benchmark_cache/all/mmas8', data: allStats });

  for (const [condition, scores] of Object.entries(byCondition)) {
    const stats = computeStats(scores);
    if (!stats) continue;
    const slug = _benchSlug(condition);
    writes.push({ path: `benchmark_cache/by_condition/${slug}/mmas8`, data: stats });
    condIndex[slug] = { label: condition, n: stats.n };
  }

  writes.push({ path: 'benchmark_cache/condition_index', data: condIndex });
  writes.push({
    path: 'benchmark_cache/meta',
    data: { last_updated: Date.now(), total_mmas8: allScores.length, condition_count: Object.keys(condIndex).length },
  });

  let ok = 0, fail = 0;
  for (const { path, data } of writes) {
    try {
      const r = await fetch(`${FB}/${path}.json?auth=${encodeURIComponent(secret)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (r.ok) { ok++; }
      else { fail++; console.error(`[benchmark-cache] PUT ${path} → ${r.status}`); }
    } catch (e) {
      fail++;
      console.error(`[benchmark-cache] PUT error ${path}:`, e.message);
    }
  }

  console.log(`[benchmark-cache] Done. ${ok} OK / ${fail} failed. ` +
    `${allScores.length} total records, ${Object.keys(condIndex).length} conditions published.`);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── BP-SEC-05: KV global rate limiting (60 req/min per IP, dynamic paths only) ──
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!STATIC_EXT_RE.test(url.pathname) && await rateLimitKV(ip, env)) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60', 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '0' },
      });
    }

    // ── /api/v1/* and /api/maas/*  →  delegate to ATLAS REST API worker ─────────
    // All D1-backed, Firebase-auth-gated, and MaaS routes are handled by
    // api/_api_worker.js. _worker.js delegates here so a single wrangler.toml
    // entry point covers both the platform shell and the REST API.
    if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/maas/')) {
      return apiWorker.fetch(request, env, ctx);
    }

    // ── Lambda region proxies ─────────────────────────────────────────────────
    // MUST come before www→apex redirect: a www-origin fetch to /lambda-proxy would be
    // redirected cross-origin, triggering a CORS failure before the Worker could proxy it.
    // Browser calls same-origin /lambda-proxy/... etc.; Worker forwards server-to-server.
    // US (auth, ZOE, all non-ALTHIQA routes), UAE (PDPL/me-central-1), EU (GDPR/eu-central-1), Brazil (LGPD/sa-east-1).
    if (url.pathname.startsWith('/lambda-proxy/'))
      return proxyToLambda(request, url, env.LAMBDA_URL, '/lambda-proxy');

    if (url.pathname.startsWith('/lambda-proxy-uae/'))
      return proxyToLambda(request, url, env.LAMBDA_URL_UAE, '/lambda-proxy-uae');

    if (url.pathname.startsWith('/lambda-proxy-eu/'))
      return proxyToLambda(request, url, env.LAMBDA_URL_EU, '/lambda-proxy-eu');

    if (url.pathname.startsWith('/lambda-proxy-brazil/'))
      return proxyToLambda(request, url, env.LAMBDA_URL_BRAZIL, '/lambda-proxy-brazil');

    // ── /lambda-proxy-partner/*  →  proxy to Partner API (MAP/MMAS/PEACS) ────
    // External partner integrations call same-origin /lambda-proxy-partner/v1/...
    // Worker forwards server-to-server; no CORS negotiation needed from browser.
    if (url.pathname.startsWith('/lambda-proxy-partner/')) {
      const LAMBDA_BASE = env.PARTNER_API_URL;
      const lambdaPath  = url.pathname.replace('/lambda-proxy-partner', '');
      const lambdaURL   = LAMBDA_BASE + lambdaPath + (url.search || '');
      try {
        const hasBody  = request.method !== 'GET' && request.method !== 'HEAD';
        const bodyText = hasBody ? await request.text() : undefined;
        const partnerKey = request.headers.get('X-Partner-Key') || '';
        const lambdaResp = await fetch(lambdaURL, {
          method:  request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(partnerKey ? { 'X-Partner-Key': partnerKey } : {}),
          },
          body: bodyText,
        });
        const responseText = await lambdaResp.text();
        return new Response(responseText, {
          status: lambdaResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, X-Partner-Key',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        });
      } catch (err) {
        const requestId = crypto.randomUUID().substring(0, 8).toUpperCase();
        console.error(`[${requestId}] Partner API proxy error:`, err.message);
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable', requestId }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ── /stripe-checkout  →  create Stripe Checkout session ─────────────────
    // Called from scalacartafoundation.org/tessera.html. CORS is restricted to
    // that origin. STRIPE_SECRET_KEY must be set via: wrangler secret put STRIPE_SECRET_KEY
    if (url.pathname === '/stripe-checkout') {
      const origin = request.headers.get('Origin') || '';
      const allowedOrigins = new Set([
        'https://scalacartafoundation.org',
        'https://www.scalacartafoundation.org',
        'https://scalacarta-site.pages.dev',
      ]);
      const corsH = {
        'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://scalacartafoundation.org',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
      };
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsH });
      }
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      try {
        const body = await request.json();
        const { priceId, successUrl, cancelUrl, mode: reqMode, donationTier } = body;
        const checkoutMode = reqMode === 'payment' ? 'payment' : 'subscription';
        if (!priceId || !successUrl || !cancelUrl) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsH }
          });
        }
        const params = new URLSearchParams({
          'mode': checkoutMode,
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          'success_url': successUrl,
          'cancel_url': cancelUrl,
          'metadata[priceId]': priceId,
          'metadata[type]': checkoutMode === 'payment' ? 'donation' : 'membership',
        });
        if (donationTier) params.set('metadata[donationTier]', String(donationTier).slice(0, 50));
        const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const session = await stripeResp.json();
        if (!stripeResp.ok) {
          console.error('[stripe-checkout] Stripe error:', session.error?.message);
          return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...corsH }
          });
        }
        return new Response(JSON.stringify({ url: session.url }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsH }
        });
      } catch (err) {
        console.error('[stripe-checkout] Error:', err.message);
        return new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsH }
        });
      }
    }

    // ── /stripe-webhook  →  receive Stripe checkout events ───────────────────
    // Stripe posts checkout.session.completed here. Signature verified via
    // STRIPE_WEBHOOK_SECRET (set via: wrangler secret put STRIPE_WEBHOOK_SECRET).
    // Records confirmed payments in Firebase /tessera_payments for provisioning.
    if (url.pathname === '/stripe-webhook') {
      if (request.method === 'POST') return handleStripeWebhook(request, env);
      return new Response('Method Not Allowed', { status: 405 });
    }

    // ── /cdn-cgi/geo  →  Cloudflare request.cf geo fields (city, region, ASN, etc.) ──
    // /cdn-cgi/trace only returns country + colo; this endpoint exposes the full
    // request.cf object so the client can log richer location data in audit records.
    if (url.pathname === '/api/geo') {
      const cf = request.cf || {};
      return new Response(JSON.stringify({
        city:        cf.city         || null,
        region:      cf.region       || null,
        regionCode:  cf.regionCode   || null,
        country:     cf.country      || null,
        postalCode:  cf.postalCode   || null,
        latitude:    cf.latitude     || null,
        longitude:   cf.longitude    || null,
        timezone:    cf.timezone     || null,
        asn:         cf.asn          || null,
        asOrg:       cf.asOrganization || null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── www → apex redirect ───────────────────────────────────────────────────
    // Placed AFTER lambda-proxy blocks so www-origin API calls are proxied
    // instead of being redirected cross-origin (which would cause CORS failures).
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    // ── /download/template  →  proxy bulk upload template from S3 ────────────
    // ?tool=map  → ATLAS_MAP_Bulk_Upload.xlsm
    // ?tool=mmas (default) → ATLAS_Bulk_Upload.xlsm
    // Forces a file download (Content-Disposition: attachment) so browsers don't
    // open it in Office Online or attempt inline rendering.
    if (url.pathname === '/download/template') {
      const isMAP   = url.searchParams.get('tool') === 'map';
      const S3_URL  = isMAP
        ? 'https://adherence-project-march-2026.s3.amazonaws.com/ATLAS_MAP_Bulk_Upload.xlsm'
        : 'https://adherence-project-march-2026.s3.amazonaws.com/ATLAS_Bulk_Upload.xlsm';
      const fname   = isMAP ? 'ATLAS_MAP_Bulk_Upload.xlsm' : 'ATLAS_Bulk_Upload.xlsm';
      try {
        const s3 = await fetch(S3_URL);
        if (!s3.ok) return new Response('Template unavailable — contact info@adherence.cc', { status: 502 });
        return new Response(s3.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
            'Content-Disposition': `attachment; filename="${fname}"`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        return new Response('Download failed', { status: 502 });
      }
    }

    // ── Static assets: pass directly through to ASSETS binding ──────────────
    // run_worker_first=true means the Worker intercepts everything, including
    // CSS/JS/fonts/images. These must be served from ASSETS as-is — the
    // index.html catch-all below must never handle them.
    const staticExt = /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|map|txt|xml|json)$/i;
    if (staticExt.test(url.pathname)) {
      const assetResp = await env.ASSETS.fetch(request);
      const cacheHeader = getCacheControl(url.pathname);
      return new Response(assetResp.body, {
        status:  assetResp.status,
        headers: { ...Object.fromEntries(assetResp.headers), 'Cache-Control': cacheHeader },
      });
    }

    // ── All other routes: serve index.html, assess.html, or public pages ─────
    const isAssessPath    = url.pathname === '/assess'    || url.pathname === '/assess/';
    const isConsortiumPath = url.pathname === '/consortium' || url.pathname === '/consortium/';
    const isPharmacyPath  = url.pathname === '/pharmacy'  || url.pathname === '/pharmacy/' || url.pathname === '/pharmacy.html';
    const isLibraryPath   = url.pathname === '/library'   || url.pathname === '/library/';
    const assetPath = isAssessPath    ? '/assess.html'
                    : isConsortiumPath ? '/public/consortium.html'
                    : isPharmacyPath   ? '/pharmacy.html'
                    : isLibraryPath    ? '/library.html'
                    : '/index.html';

    const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url), request));

    return new Response(asset.body, {
      status:  200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com api.mapbox.com cdnjs.cloudflare.com www.gstatic.com *.gstatic.com cdn.plot.ly cdn.sheetjs.com static.cloudflareinsights.com *.google.com *.googleapis.com *.recaptcha.net recaptcha.net firebaseio.com *.firebaseio.com",
          "connect-src 'self' api.anthropic.com firebaseio.com *.firebaseio.com wss://firebaseio.com wss://*.firebaseio.com *.googleapis.com *.firebaseapp.com nominatim.openstreetmap.org api.adherence.cc *.execute-api.us-east-1.amazonaws.com *.execute-api.eu-central-1.amazonaws.com *.execute-api.me-central-1.amazonaws.com *.execute-api.sa-east-1.amazonaws.com *.mapbox.com events.mapbox.com *.lambda-url.us-east-1.on.aws *.lambda-url.eu-central-1.on.aws *.lambda-url.sa-east-1.on.aws",
          "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net unpkg.com cdnjs.cloudflare.com api.mapbox.com",
          "font-src 'self' fonts.gstatic.com cdn.jsdelivr.net",
          "img-src 'self' data: blob: *.mapbox.com api.qrserver.com",
          "worker-src blob:",
          "child-src blob:",
          "frame-src https://adherence-project-2026.firebaseapp.com *.google.com firebaseio.com *.firebaseio.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
        'Permissions-Policy': 'microphone=(self)',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Cache-Control': getCacheControl(url.pathname),
      },
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBenchmarkCache(env));
  },
};
