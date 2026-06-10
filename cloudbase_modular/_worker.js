// BP-SEC-05: KV-based global rate limiting
// OPERATOR ACTION REQUIRED: Create KV namespace named RATE_LIMIT_KV in Cloudflare dashboard
// and add binding to wrangler.toml:
//   [[kv_namespaces]]
//   binding = "RATE_LIMIT_KV"
//   id = "YOUR_KV_NAMESPACE_ID"
// Until then, Cache API rate limiting remains active (per-PoP, not global)

async function rateLimitKV(ip, env) {
  if (!env.RATE_LIMIT_KV) return false; // KV not configured, allow through (Cache API will handle)
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

// ── Edge Rate Limiter — IP-based, using CF Cache API as ephemeral store ──────
// Limits: 60 requests/minute per IP for non-static paths (POST-like / Firebase
// interaction routes). Static asset extensions (.js, .css, .html, images, fonts)
// are excluded because Cloudflare CDN handles those before the Worker runs.
//
// NOTE: The Cache API approach is lightweight and zero-config, but it is
// per-datacenter (not globally consistent). For production-scale protection
// add a KV namespace binding and replace the cache.match/put calls with
// KV.get/put — that gives globally consistent counters across all PoPs.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

// File extensions that are served directly from CF CDN; skip rate limiting.
const STATIC_EXT_RE = /\.(?:html?|js|mjs|css|map|ico|png|jpe?g|gif|webp|svg|woff2?|ttf|otf|eot|json|xml|txt|pdf|xlsm?)$/i;

async function checkRateLimit(request, ctx) {
  const url = new URL(request.url);

  // Skip static assets — CF CDN serves these before the Worker is invoked,
  // but guard here too for any edge case where they reach the Worker.
  if (STATIC_EXT_RE.test(url.pathname)) return null;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const windowKey = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const cacheKey = new Request(`https://ratelimit.internal/${ip}/${windowKey}`);

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  const count = cached ? parseInt(await cached.text()) + 1 : 1;

  if (count > RATE_LIMIT_MAX) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // Store updated count (non-blocking — does not delay the response)
  const resp = new Response(String(count), {
    headers: { 'Cache-Control': `max-age=${Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)}` },
  });
  ctx.waitUntil(cache.put(cacheKey, resp));
  return null; // null = not rate limited, continue
}

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

export default {
  async fetch(request, env, ctx) {
    // ── BP-SEC-05: KV global rate limit check (runs before Cache API check) ────
    // If RATE_LIMIT_KV binding is configured, use globally-consistent KV counters.
    // If not configured, falls through to the Cache API check below.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await rateLimitKV(ip, env)) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60', 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '0' },
      });
    }

    // ── Security fix C4/S9: IP-based rate limiting at the edge ───────────────
    // Must run before any routing so client-side bypass (DevTools / scripting)
    // cannot circumvent it. Returns a 429 Response if the IP has exceeded the
    // limit, otherwise null and execution continues normally.
    const rateLimitResponse = await checkRateLimit(request, ctx);
    if (rateLimitResponse) return rateLimitResponse;

    const url = new URL(request.url);

    // ── /lambda-proxy/*  →  proxy to US Lambda (auth, ZOE, all non-ALTHIQA routes) ──
    // MUST come before www→apex redirect: a www-origin fetch to /lambda-proxy would be
    // redirected cross-origin, triggering a CORS failure before the Worker could proxy it.
    // Browser calls same-origin /lambda-proxy/validate-key etc.
    // Worker forwards to the Lambda over server-to-server fetch (no CORS needed).
    // This replaces direct browser→Lambda calls which require CORS on API Gateway.
    if (url.pathname.startsWith('/lambda-proxy/')) {
      const LAMBDA_BASE = env.LAMBDA_URL;
      const lambdaPath  = url.pathname.replace('/lambda-proxy', '');
      const lambdaURL   = LAMBDA_BASE + lambdaPath + (url.search || '');
      try {
        // Read body as text first — passing request.body (ReadableStream) directly
        // to a new Request can fail in CF Workers if the stream is already locked.
        const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        const bodyText = hasBody ? await request.text() : undefined;
        const authHeader = request.headers.get('Authorization') || '';
        const lambdaResp = await fetch(lambdaURL, {
          method:  request.method,
          headers: {
            'Content-Type':  'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
          },
          body:    bodyText,
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

    // ── /lambda-proxy-uae/*  →  proxy to UAE Lambda (ALTHIQA data residency only) ──
    // ALTHIQA workspace DB writes route here via db-shim.js.
    // Keeps UAE data in me-central-1 (Abu Dhabi) for data residency compliance.
    if (url.pathname.startsWith('/lambda-proxy-uae/')) {
      const LAMBDA_BASE = env.LAMBDA_URL_UAE;
      const lambdaPath  = url.pathname.replace('/lambda-proxy-uae', '');
      const lambdaURL   = LAMBDA_BASE + lambdaPath + (url.search || '');
      try {
        const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        const bodyText = hasBody ? await request.text() : undefined;
        const authHeader = request.headers.get('Authorization') || '';
        const lambdaResp = await fetch(lambdaURL, {
          method:  request.method,
          headers: {
            'Content-Type':  'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
          },
          body:    bodyText,
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

    // ── All other routes: serve index.html or assess.html ────────────────────
    const isAssessPath = url.pathname === '/assess' || url.pathname === '/assess/';
    const assetPath = isAssessPath ? '/assess.html' : '/index.html';

    const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url), request));

    return new Response(asset.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com api.mapbox.com cdnjs.cloudflare.com www.gstatic.com",
          "connect-src 'self' api.anthropic.com firebaseio.com *.firebaseio.com firebase.googleapis.com identitytoolkit.googleapis.com nominatim.openstreetmap.org api.adherence.cc api.mapbox.com events.mapbox.com securetoken.googleapis.com",
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
