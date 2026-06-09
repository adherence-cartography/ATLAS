// tests/unit/worker.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers to construct mock Cloudflare Worker arguments ─────────────────────

function makeRequest(url, { headers = {} } = {}) {
  return new Request(url, { headers });
}

/**
 * Build a minimal mock `env` with a fake ASSETS binding.
 * `assetResponses` is a map from pathname to [status, body, contentType].
 */
function makeEnv(assetResponses = {}) {
  return {
    ASSETS: {
      fetch: vi.fn(async (req) => {
        const pathname = new URL(req.url).pathname;
        const entry = assetResponses[pathname];
        if (!entry) {
          return new Response('Not Found', { status: 404 });
        }
        const [status, body, ct] = entry;
        return new Response(body, {
          status,
          headers: { 'Content-Type': ct || 'text/html; charset=utf-8' },
        });
      }),
    },
  };
}

/**
 * Build a minimal ExecutionContext mock.
 * `waitUntil` must exist (used by the rate-limiter cache.put).
 */
function makeCtx() {
  return { waitUntil: vi.fn() };
}

/**
 * Build a minimal caches.default mock that starts empty.
 * Supports match/put so the rate-limiter can read & write counters.
 */
function makeCacheMock() {
  const store = new Map();
  return {
    match: vi.fn(async (req) => store.get(req.url) ?? null),
    put: vi.fn(async (req, resp) => {
      // Clone so the body isn't consumed on first read
      store.set(req.url, resp.clone());
    }),
    _store: store,
  };
}

// ── Import the worker under test ───────────────────────────────────────────────
// The worker uses `caches.default` as a global.  We replace it before importing.

let workerFetch;

beforeEach(async () => {
  vi.resetModules();

  // Inject a fresh cache mock as a global for each test so counters reset.
  const cacheMock = makeCacheMock();
  vi.stubGlobal('caches', { default: cacheMock });

  const mod = await import('../../_worker.js');
  workerFetch = mod.default.fetch;
});

// ── www → apex redirect ────────────────────────────────────────────────────────

describe('www → apex redirect', () => {
  it('redirects www.atlas.adherence.cc to atlas.adherence.cc with 301', async () => {
    const req = makeRequest('https://www.atlas.adherence.cc/');
    const env = makeEnv();
    const ctx = makeCtx();

    const res = await workerFetch(req, env, ctx);

    expect(res.status).toBe(301);
    const location = res.headers.get('Location');
    expect(location).toBeDefined();
    expect(location).toMatch(/^https:\/\/atlas\.adherence\.cc/);
    expect(location).not.toMatch(/www\./);
  });

  it('preserves path and query string on redirect', async () => {
    const req = makeRequest('https://www.atlas.adherence.cc/assess?ref=test');
    const res = await workerFetch(req, makeEnv(), makeCtx());

    expect(res.status).toBe(301);
    const location = res.headers.get('Location');
    expect(location).toContain('/assess');
    expect(location).toContain('ref=test');
  });
});

// ── /download/template ────────────────────────────────────────────────────────

describe('/download/template proxy', () => {
  it('returns 200 with Content-Disposition attachment on S3 success', async () => {
    // Stub global fetch so S3 appears to succeed
    const fakeXlsm = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK magic bytes
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(fakeXlsm, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12' },
      })
    ));

    const req = makeRequest('https://atlas.adherence.cc/download/template');
    const res = await workerFetch(req, makeEnv(), makeCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment/);
    expect(res.headers.get('Content-Disposition')).toMatch(/ATLAS_Bulk_Upload\.xlsm/);
    expect(res.headers.get('Content-Type')).toMatch(/ms-excel/);

    vi.unstubAllGlobals();
    vi.stubGlobal('caches', { default: makeCacheMock() }); // restore cache mock
  });

  it('returns 502 when S3 fetch fails (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));

    const req = makeRequest('https://atlas.adherence.cc/download/template');
    const res = await workerFetch(req, makeEnv(), makeCtx());

    expect(res.status).toBe(502);

    vi.unstubAllGlobals();
    vi.stubGlobal('caches', { default: makeCacheMock() });
  });

  it('returns 502 when S3 responds with non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('Forbidden', { status: 403 })
    ));

    const req = makeRequest('https://atlas.adherence.cc/download/template');
    const res = await workerFetch(req, makeEnv(), makeCtx());

    expect(res.status).toBe(502);

    vi.unstubAllGlobals();
    vi.stubGlobal('caches', { default: makeCacheMock() });
  });
});

// ── HTML route serving ────────────────────────────────────────────────────────

describe('HTML routes', () => {
  const assetMap = {
    '/index.html':  [200, '<!DOCTYPE html><html><title>ATLAS</title><body><div id="screen-entry"></div></body></html>', 'text/html; charset=utf-8'],
    '/assess.html': [200, '<!DOCTYPE html><html><title>MMAS-8</title><body></body></html>', 'text/html; charset=utf-8'],
  };

  it('GET / → serves index.html with 200', async () => {
    const req = makeRequest('https://atlas.adherence.cc/');
    const env = makeEnv(assetMap);
    const ctx = makeCtx();

    const res = await workerFetch(req, env, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();

    const body = await res.text();
    expect(body).toContain('ATLAS');
  });

  it('GET /assess → serves assess.html with 200', async () => {
    const req = makeRequest('https://atlas.adherence.cc/assess');
    const env = makeEnv(assetMap);
    const ctx = makeCtx();

    const res = await workerFetch(req, env, ctx);

    expect(res.status).toBe(200);
    const assetReq = env.ASSETS.fetch.mock.calls[0][0];
    expect(new URL(assetReq.url).pathname).toBe('/assess.html');
  });

  it('GET /assess/ (trailing slash) → serves assess.html', async () => {
    const req = makeRequest('https://atlas.adherence.cc/assess/');
    const env = makeEnv(assetMap);
    const ctx = makeCtx();

    const res = await workerFetch(req, env, ctx);

    expect(res.status).toBe(200);
    const assetReq = env.ASSETS.fetch.mock.calls[0][0];
    expect(new URL(assetReq.url).pathname).toBe('/assess.html');
  });

  it('GET /some/unknown/path → falls through to index.html (SPA routing)', async () => {
    const req = makeRequest('https://atlas.adherence.cc/some/unknown/path');
    const env = makeEnv(assetMap);
    const ctx = makeCtx();

    const res = await workerFetch(req, env, ctx);

    expect(res.status).toBe(200);
    const assetReq = env.ASSETS.fetch.mock.calls[0][0];
    expect(new URL(assetReq.url).pathname).toBe('/index.html');
  });

  it('response includes expected security headers', async () => {
    const req = makeRequest('https://atlas.adherence.cc/');
    const res = await workerFetch(req, makeEnv(assetMap), makeCtx());

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Strict-Transport-Security')).toMatch(/max-age/);
  });
});

// ── Rate limiter ───────────────────────────────────────────────────────────────

describe('rate limiter', () => {
  /**
   * Simulate N sequential requests from the same IP against the worker,
   * sharing a single persistent cache mock.
   */
  async function sendNRequests(n, ip = '1.2.3.4') {
    // Fresh cache that persists across all N requests
    const cacheMock = makeCacheMock();
    vi.stubGlobal('caches', { default: cacheMock });

    vi.resetModules();
    const mod = await import('../../_worker.js');
    const fetchFn = mod.default.fetch;

    const assetMap = {
      '/index.html': [200, '<html><title>ATLAS</title></html>', 'text/html'],
    };
    const env = makeEnv(assetMap);

    const responses = [];
    for (let i = 0; i < n; i++) {
      const req = new Request('https://atlas.adherence.cc/', {
        headers: { 'CF-Connecting-IP': ip },
      });
      const ctx = makeCtx();
      const res = await fetchFn(req, env, ctx);

      // The rate-limiter stores the counter non-blocking via ctx.waitUntil.
      // We must flush those promises so the cache is populated for the next request.
      const pendingWrites = ctx.waitUntil.mock.calls.map(([p]) => p);
      await Promise.all(pendingWrites);

      responses.push(res.status);
    }
    return responses;
  }

  it('first 60 requests from an IP are allowed (not 429)', async () => {
    const statuses = await sendNRequests(60);
    expect(statuses.every(s => s !== 429)).toBe(true);
    expect(statuses.every(s => s === 200)).toBe(true);
  }, 15_000);

  it('61st request from same IP returns 429', async () => {
    const statuses = await sendNRequests(61);
    expect(statuses[60]).toBe(429);
  }, 15_000);

  it('429 response includes Retry-After header', async () => {
    // Use a fresh cache mock wired directly so we can inspect headers
    const cacheMock = makeCacheMock();
    vi.stubGlobal('caches', { default: cacheMock });
    vi.resetModules();
    const mod = await import('../../_worker.js');
    const fetchFn = mod.default.fetch;
    const env = makeEnv({ '/index.html': [200, '<html></html>', 'text/html'] });

    // Pre-fill cache with count = 61 to simulate an already-exceeded window
    const windowKey = Math.floor(Date.now() / 60_000);
    const ip = '9.9.9.9';
    const fakeCountResp = new Response('61', {
      headers: { 'Cache-Control': 'max-age=60' },
    });
    const cacheKey = new Request(`https://ratelimit.internal/${ip}/${windowKey}`);
    await cacheMock.put(cacheKey, fakeCountResp);

    const req = new Request('https://atlas.adherence.cc/', {
      headers: { 'CF-Connecting-IP': ip },
    });
    const res = await fetchFn(req, env, makeCtx());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  }, 10_000);

  it('static asset paths bypass rate limiter', async () => {
    // Even after filling the rate limit counter, .js files should be passed
    // through to ASSETS, not blocked. The worker skips RL for STATIC_EXT_RE paths.
    const cacheMock = makeCacheMock();
    vi.stubGlobal('caches', { default: cacheMock });
    vi.resetModules();
    const mod = await import('../../_worker.js');
    const fetchFn = mod.default.fetch;

    // Pre-fill cache at count 100 (well over limit)
    const windowKey = Math.floor(Date.now() / 60_000);
    const ip = '5.5.5.5';
    const cacheKey = new Request(`https://ratelimit.internal/${ip}/${windowKey}`);
    await cacheMock.put(cacheKey, new Response('100', { headers: { 'Cache-Control': 'max-age=60' } }));

    const env = makeEnv({
      '/app.js': [200, 'console.log("ok")', 'application/javascript'],
    });

    // Static .js request — should NOT be blocked
    const req = new Request('https://atlas.adherence.cc/app.js', {
      headers: { 'CF-Connecting-IP': ip },
    });
    const res = await fetchFn(req, env, makeCtx());

    // Static extensions are handled by ASSETS, not rate-limited
    // (worker passes them through; our mock returns 200 for /app.js)
    expect(res.status).not.toBe(429);
  }, 10_000);

  it('different IPs have independent counters', async () => {
    const cacheMock = makeCacheMock();
    vi.stubGlobal('caches', { default: cacheMock });
    vi.resetModules();
    const mod = await import('../../_worker.js');
    const fetchFn = mod.default.fetch;
    const env = makeEnv({ '/index.html': [200, '<html></html>', 'text/html'] });

    // IP A at count 61 → blocked
    const windowKey = Math.floor(Date.now() / 60_000);
    const ipA = '10.0.0.1';
    const ipB = '10.0.0.2';
    await cacheMock.put(
      new Request(`https://ratelimit.internal/${ipA}/${windowKey}`),
      new Response('61', { headers: { 'Cache-Control': 'max-age=60' } })
    );

    const resA = await fetchFn(
      new Request('https://atlas.adherence.cc/', { headers: { 'CF-Connecting-IP': ipA } }),
      env, makeCtx()
    );
    const resB = await fetchFn(
      new Request('https://atlas.adherence.cc/', { headers: { 'CF-Connecting-IP': ipB } }),
      env, makeCtx()
    );

    expect(resA.status).toBe(429); // IP A is blocked
    expect(resB.status).toBe(200); // IP B is unaffected
  }, 10_000);
});
