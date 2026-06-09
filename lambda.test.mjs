/**
 * lambda.test.mjs — ATLAS Lambda unit tests
 * Run with: node --test lambda.test.mjs
 * Requires Node 18+ (Lambda runtime is Node 20)
 *
 * Tests pure utility functions only — no AWS SDK calls, no network.
 * Integration tests (route handlers with mocked SSM/SES) can be added
 * once a mock layer is in place.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ── Inline the pure functions under test ─────────────────────────────────────
// These are duplicated here so the test file has zero dependencies on AWS SDK.
// If you extract helpers into a separate utils.mjs, import them directly instead.

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local[0] + '***';
  return masked + '@' + domain;
}

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isRateLimited(map, ip, endpoint, maxReqs, windowMs) {
  if (!ip) return false;
  const key  = `${ip}:${endpoint}`;
  const now  = Date.now();
  const hits = (map.get(key) || []).filter(ts => now - ts < windowMs);
  if (hits.length >= maxReqs) return true;
  hits.push(now);
  map.set(key, hits);
  return false;
}

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

function respond(statusCode, body, origin) {
  return { statusCode, body: JSON.stringify(body) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('maskEmail', () => {
  test('masks local part, preserves domain', () => {
    assert.equal(maskEmail('philip@adherence.cc'), 'p***@adherence.cc');
  });
  test('works with short local part', () => {
    assert.equal(maskEmail('a@domain.edu'), 'a***@domain.edu');
  });
  test('works with dots and plus in email', () => {
    const result = maskEmail('john.smith+test@university.edu');
    assert.match(result, /^j\*\*\*@university\.edu$/);
  });
});

describe('generateOTP', () => {
  test('returns 6 digits', () => {
    const otp = generateOTP();
    assert.match(otp, /^\d{6}$/);
  });
  test('is within valid range', () => {
    for (let i = 0; i < 50; i++) {
      const n = parseInt(generateOTP(), 10);
      assert.ok(n >= 100000 && n <= 999999, `OTP out of range: ${n}`);
    }
  });
  test('produces varied output (not constant)', () => {
    const otps = new Set(Array.from({ length: 20 }, generateOTP));
    assert.ok(otps.size > 1, 'OTP generator produced identical values');
  });
});

describe('generateSessionToken', () => {
  test('returns 64-char hex string', () => {
    const tok = generateSessionToken();
    assert.match(tok, /^[0-9a-f]{64}$/);
  });
  test('tokens are unique', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));
    assert.equal(tokens.size, 100, 'Token collision detected');
  });
});

describe('isRateLimited', () => {
  test('allows requests under the limit', () => {
    const map = new Map();
    assert.equal(isRateLimited(map, '1.2.3.4', 'test', 3, 60000), false);
    assert.equal(isRateLimited(map, '1.2.3.4', 'test', 3, 60000), false);
    assert.equal(isRateLimited(map, '1.2.3.4', 'test', 3, 60000), false);
  });
  test('blocks on the (maxReqs+1)th request', () => {
    const map = new Map();
    isRateLimited(map, '1.2.3.4', 'test', 3, 60000);
    isRateLimited(map, '1.2.3.4', 'test', 3, 60000);
    isRateLimited(map, '1.2.3.4', 'test', 3, 60000);
    assert.equal(isRateLimited(map, '1.2.3.4', 'test', 3, 60000), true);
  });
  test('different IPs have independent limits', () => {
    const map = new Map();
    isRateLimited(map, '1.1.1.1', 'test', 2, 60000);
    isRateLimited(map, '1.1.1.1', 'test', 2, 60000);
    assert.equal(isRateLimited(map, '1.1.1.1', 'test', 2, 60000), true,  'IP A should be blocked');
    assert.equal(isRateLimited(map, '2.2.2.2', 'test', 2, 60000), false, 'IP B should not be blocked');
  });
  test('different endpoints have independent limits', () => {
    const map = new Map();
    isRateLimited(map, '1.2.3.4', 'route-a', 1, 60000);
    assert.equal(isRateLimited(map, '1.2.3.4', 'route-a', 1, 60000), true,  'route-a should be blocked');
    assert.equal(isRateLimited(map, '1.2.3.4', 'route-b', 1, 60000), false, 'route-b should not be blocked');
  });
  test('passes for unknown IP (null)', () => {
    const map = new Map();
    assert.equal(isRateLimited(map, null, 'test', 1, 60000), false);
    assert.equal(isRateLimited(map, '',   'test', 1, 60000), false);
  });
});

describe('verifyStripeSignature', () => {
  function makeHeader(body, secret, tsOverride) {
    const ts  = tsOverride ?? Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    return `t=${ts},v1=${sig}`;
  }

  test('accepts a valid signature', () => {
    const body   = '{"type":"checkout.session.completed"}';
    const secret = 'whsec_test_secret_abc123';
    const header = makeHeader(body, secret);
    assert.doesNotThrow(() => verifyStripeSignature(body, header, secret));
  });

  test('rejects a tampered body', () => {
    const secret  = 'whsec_test_secret_abc123';
    const body    = '{"type":"checkout.session.completed"}';
    const header  = makeHeader(body, secret);
    assert.throws(
      () => verifyStripeSignature('{"type":"invoice.payment_failed"}', header, secret),
      /mismatch/
    );
  });

  test('rejects a wrong secret', () => {
    const body   = '{"type":"checkout.session.completed"}';
    const header = makeHeader(body, 'correct_secret');
    assert.throws(
      () => verifyStripeSignature(body, header, 'wrong_secret'),
      /mismatch/
    );
  });

  test('rejects a timestamp older than 5 minutes', () => {
    const body      = '{"type":"test"}';
    const secret    = 'whsec_abc';
    const staleTs   = Math.floor(Date.now() / 1000) - 400; // 400s ago > 300s limit
    const staleSig  = crypto.createHmac('sha256', secret).update(`${staleTs}.${body}`).digest('hex');
    const header    = `t=${staleTs},v1=${staleSig}`;
    assert.throws(
      () => verifyStripeSignature(body, header, secret),
      /too old/
    );
  });

  test('rejects a missing signature header', () => {
    assert.throws(
      () => verifyStripeSignature('body', '', 'secret'),
      /Missing/
    );
  });

  test('rejects a malformed header', () => {
    assert.throws(
      () => verifyStripeSignature('body', 'garbage_header', 'secret'),
      /Malformed/
    );
  });
});

describe('respond helper', () => {
  test('returns correct statusCode and serialised body', () => {
    const r = respond(200, { valid: true }, 'https://atlas.adherence.cc');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(JSON.parse(r.body), { valid: true });
  });
  test('returns 429 for rate limit response', () => {
    const r = respond(429, { error: 'Too many attempts' }, '');
    assert.equal(r.statusCode, 429);
    assert.equal(JSON.parse(r.body).error, 'Too many attempts');
  });
});
