import apiWorker from './api/_api_worker.js';

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
    // US (auth, ZOE, all non-ALTHIQA routes), UAE (PDPL/me-central-1), EU (GDPR/eu-central-1).
    if (url.pathname.startsWith('/lambda-proxy/'))
      return proxyToLambda(request, url, env.LAMBDA_URL, '/lambda-proxy');

    if (url.pathname.startsWith('/lambda-proxy-uae/'))
      return proxyToLambda(request, url, env.LAMBDA_URL_UAE, '/lambda-proxy-uae');

    if (url.pathname.startsWith('/lambda-proxy-eu/'))
      return proxyToLambda(request, url, env.LAMBDA_URL_EU, '/lambda-proxy-eu');

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

    // ── All other routes: serve index.html, assess.html, or public pages ─────
    const isAssessPath = url.pathname === '/assess' || url.pathname === '/assess/';
    const isConsortiumPath = url.pathname === '/consortium' || url.pathname === '/consortium/';
    const assetPath = isAssessPath ? '/assess.html' : isConsortiumPath ? '/public/consortium.html' : '/index.html';

    const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url), request));

    return new Response(asset.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com api.mapbox.com cdnjs.cloudflare.com www.gstatic.com",
          "connect-src 'self' api.anthropic.com firebaseio.com *.firebaseio.com firebase.googleapis.com identitytoolkit.googleapis.com nominatim.openstreetmap.org api.adherence.cc *.execute-api.us-east-1.amazonaws.com *.execute-api.eu-central-1.amazonaws.com *.execute-api.me-central-1.amazonaws.com api.mapbox.com events.mapbox.com securetoken.googleapis.com",
          "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net unpkg.com cdnjs.cloudflare.com",
          "font-src 'self' fonts.gstatic.com cdn.jsdelivr.net",
          "img-src 'self' data: blob: *.mapbox.com",
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
        'Permissions-Policy': 'microphone=(self)',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Cache-Control': getCacheControl(url.pathname),
      },
    });
  },
};
