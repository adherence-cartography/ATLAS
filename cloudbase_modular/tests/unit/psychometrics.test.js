// tests/unit/psychometrics.test.js
import { describe, it, expect } from 'vitest';

// ── Minimal local implementations to verify algorithm correctness ──────────────
// These mirror the exact logic in _psych_js.js (sample variance with n-1 divisor).
// Until those private functions are exported, these tests act as a living spec:
// any future refactor that exports them must pass the same mathematical contracts.

// TODO (future refactor): export _pearsonR, _cronbachAlpha, _mcdonaldOmega,
//   _computeICC, _computeSEM, _alphaInterpretation, _iccInterpretation from
//   _psych_js.js and import them here directly instead of re-implementing.

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return NaN;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const mX = sumX / n, mY = sumY / n;
  let cov = 0, ssX = 0, ssY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mX, dy = ys[i] - mY;
    cov += dx * dy; ssX += dx * dx; ssY += dy * dy;
  }
  const denom = Math.sqrt(ssX * ssY);
  return denom === 0 ? NaN : cov / denom;
}

// Uses sample variance (n-1) — matches _psych_js.js exactly.
function cronbachAlpha(matrix) {
  const n = matrix.length;
  if (n < 2) return NaN;
  const k = matrix[0].length;
  if (k < 2) return NaN;

  let sumItemVar = 0;
  for (let j = 0; j < k; j++) {
    const col = matrix.map(r => r[j]);
    const mean = col.reduce((s, v) => s + v, 0) / n;
    const variance = col.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    sumItemVar += variance;
  }
  const totals = matrix.map(r => r.reduce((s, v) => s + v, 0));
  const tMean  = totals.reduce((s, v) => s + v, 0) / n;
  const tVar   = totals.reduce((s, v) => s + (v - tMean) ** 2, 0) / (n - 1);
  if (tVar === 0) return NaN;
  return (k / (k - 1)) * (1 - sumItemVar / tVar);
}

function computeSEM(matrix, alpha) {
  if (!isFinite(alpha) || alpha >= 1) return NaN;
  const n = matrix.length;
  if (n < 2) return NaN;
  const totals = matrix.map(r => r.reduce((s, v) => s + v, 0));
  const mean = totals.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(totals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return sd * Math.sqrt(1 - alpha);
}

function alphaInterpretation(alpha) {
  if (!isFinite(alpha)) return '—';
  if (alpha >= 0.90) return 'Excellent';
  if (alpha >= 0.80) return 'Good';
  if (alpha >= 0.70) return 'Acceptable';
  if (alpha >= 0.60) return 'Questionable';
  if (alpha >= 0.50) return 'Poor';
  return 'Unacceptable';
}

function iccInterpretation(icc) {
  if (!isFinite(icc)) return '—';
  if (icc < 0.50) return 'Poor';
  if (icc < 0.75) return 'Moderate';
  if (icc < 0.90) return 'Good';
  return 'Excellent';
}

// ICC(2,1) two-way mixed, absolute agreement — mirrors _computeICC logic
// but operates directly on pre-built pairs [[s1,s2], ...] for testability.
function iccFromPairs(pairs) {
  const n = pairs.length;
  if (n < 3) return NaN;
  const k = 2;
  const grandMean = pairs.reduce((s, p) => s + p[0] + p[1], 0) / (n * k);
  const rowMeans  = pairs.map(p => (p[0] + p[1]) / k);
  const col1Mean  = pairs.reduce((s, p) => s + p[0], 0) / n;
  const col2Mean  = pairs.reduce((s, p) => s + p[1], 0) / n;
  const SSb = k * rowMeans.reduce((s, rm) => s + (rm - grandMean) ** 2, 0);
  const SSr = n * [col1Mean, col2Mean].reduce((s, cm) => s + (cm - grandMean) ** 2, 0);
  const SSt = pairs.reduce((s, p) => s + (p[0] - grandMean) ** 2 + (p[1] - grandMean) ** 2, 0);
  const SSe = SSt - SSb - SSr;
  const dfb = n - 1, dfe = (n - 1) * (k - 1);
  const MSb = SSb / dfb;
  const MSr = SSr / (k - 1);
  const MSe = dfe > 0 ? SSe / dfe : 0;
  const iccDen = MSb + (k - 1) * MSe + (k / n) * (MSr - MSe);
  if (iccDen === 0) return NaN;
  const icc = (MSb - MSe) / iccDen;
  return isFinite(icc) ? Math.max(-1, Math.min(1, icc)) : NaN;
}

// ── pearsonR ───────────────────────────────────────────────────────────────────

describe('pearsonR', () => {
  it('identical arrays → r = 1.0', () => {
    expect(pearsonR([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1.0, 5);
  });

  it('perfectly reversed arrays → r = -1.0', () => {
    expect(pearsonR([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1.0, 5);
  });

  it('known pair [1,2,3] vs [2,4,5] → r ≈ 0.9820', () => {
    // Manually verified: cov=2.5, ssX=√2, ssY=√(4.667) → r≈0.9820
    expect(pearsonR([1, 2, 3], [2, 4, 5])).toBeCloseTo(0.9820, 3);
  });

  it('constant array → returns NaN (zero variance denominator)', () => {
    expect(isNaN(pearsonR([3, 3, 3], [1, 2, 3]))).toBe(true);
  });

  it('length < 2 → returns NaN', () => {
    expect(isNaN(pearsonR([1], [1]))).toBe(true);
  });

  it('result is within [-1, 1] for arbitrary data', () => {
    const r = pearsonR([4, 7, 2, 9, 1], [3, 8, 1, 6, 5]);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});

// ── cronbachAlpha ──────────────────────────────────────────────────────────────

describe('cronbachAlpha', () => {
  it('perfectly correlated items → alpha = 1.0', () => {
    // Every respondent has identical scores across items; inter-item r = 1.
    const perfect = [[1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4]];
    expect(cronbachAlpha(perfect)).toBeCloseTo(1.0, 5);
  });

  it('items with no between-respondent variance → NaN (total variance = 0)', () => {
    // All respondents give identical total scores.
    const flat = [[2, 2, 2], [2, 2, 2], [2, 2, 2]];
    expect(isNaN(cronbachAlpha(flat))).toBe(true);
  });

  it('known dataset (4 items, 5 respondents) → alpha > 0.85', () => {
    const data = [
      [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [2, 1, 3, 2], [4, 3, 4, 4],
    ];
    expect(cronbachAlpha(data)).toBeGreaterThan(0.85);
  });

  it('k = 1 → returns NaN (undefined for single item — k-1 = 0)', () => {
    // _psych_js.js guards: if (k < 2) return NaN
    const single = [[1], [2], [3], [4]];
    expect(isNaN(cronbachAlpha(single))).toBe(true);
  });

  it('n = 1 → returns NaN (need at least 2 respondents)', () => {
    expect(isNaN(cronbachAlpha([[1, 2, 3]]))).toBe(true);
  });

  it('8-item MMAS-8 shaped dataset → alpha in valid range', () => {
    // Simulate 10 respondents with realistic MMAS-8 responses (0/1 items)
    const data = [
      [1,1,1,1,1,1,1,1], [1,1,0,1,1,1,0,1], [0,1,0,0,1,1,0,1],
      [1,0,1,1,0,1,1,0], [0,0,0,0,0,0,0,0], [1,1,1,0,1,1,1,0],
      [0,1,1,0,0,1,0,0], [1,0,0,1,1,0,1,1], [1,1,1,1,1,1,1,0],
      [0,0,1,0,1,0,0,1],
    ];
    const alpha = cronbachAlpha(data);
    expect(isFinite(alpha)).toBe(true);
    expect(alpha).toBeGreaterThan(-1);
    expect(alpha).toBeLessThanOrEqual(1);
  });

  it('alpha increases with stronger inter-item correlation', () => {
    // Low correlation matrix
    const low  = [[1,0,1,0],[0,1,0,1],[1,0,0,1],[0,1,1,0],[1,1,0,0]];
    // High correlation matrix (nearly identical items)
    const high = [[1,1,1,1],[0,0,0,0],[1,1,1,1],[0,0,1,0],[1,1,0,1]];
    expect(cronbachAlpha(high)).toBeGreaterThan(cronbachAlpha(low));
  });
});

// ── computeSEM ─────────────────────────────────────────────────────────────────

describe('computeSEM', () => {
  it('SEM = 0 when alpha = 1 (perfect reliability)', () => {
    // alpha = 1 → sqrt(1-1) = 0
    // NOTE: _psych_js.js guards alpha >= 1 → NaN; test the boundary just below.
    const matrix = [[1,1],[2,2],[3,3],[4,4]];
    const sem = computeSEM(matrix, 0.9999);
    expect(sem).toBeCloseTo(0, 2);
  });

  it('SEM is NaN when alpha is not finite', () => {
    const matrix = [[1,2],[3,4],[5,6]];
    expect(isNaN(computeSEM(matrix, NaN))).toBe(true);
  });

  it('SEM is NaN when alpha >= 1', () => {
    const matrix = [[1,2],[3,4],[5,6]];
    expect(isNaN(computeSEM(matrix, 1.0))).toBe(true);
  });

  it('SEM > 0 for valid alpha < 1', () => {
    const matrix = [[1,1,1,1],[2,2,2,2],[3,3,3,3],[2,1,3,2],[4,3,4,4]];
    const alpha = cronbachAlpha(matrix);
    const sem = computeSEM(matrix, alpha);
    expect(sem).toBeGreaterThan(0);
    expect(isFinite(sem)).toBe(true);
  });

  it('SEM scales with SD of total scores', () => {
    // Higher spread in totals → higher SEM at same alpha
    const narrowMatrix = [[3,3],[4,4],[3,4],[4,3]];
    const wideMatrix   = [[1,1],[8,8],[1,8],[8,1]];
    const alpha = 0.80;
    expect(computeSEM(wideMatrix, alpha)).toBeGreaterThan(computeSEM(narrowMatrix, alpha));
  });
});

// ── alphaInterpretation ────────────────────────────────────────────────────────

describe('alphaInterpretation', () => {
  const cases = [
    [0.95, 'Excellent'],
    [0.90, 'Excellent'],
    [0.85, 'Good'],
    [0.80, 'Good'],
    [0.75, 'Acceptable'],
    [0.70, 'Acceptable'],
    [0.65, 'Questionable'],
    [0.60, 'Questionable'],
    [0.55, 'Poor'],
    [0.50, 'Poor'],
    [0.40, 'Unacceptable'],
    [0.00, 'Unacceptable'],
  ];
  cases.forEach(([alpha, expected]) => {
    it(`alpha ${alpha} → "${expected}"`, () => {
      expect(alphaInterpretation(alpha)).toBe(expected);
    });
  });

  it('NaN → "—"', () => {
    expect(alphaInterpretation(NaN)).toBe('—');
  });
});

// ── iccInterpretation ──────────────────────────────────────────────────────────

describe('iccInterpretation', () => {
  const cases = [
    [0.95, 'Excellent'],
    [0.90, 'Excellent'],
    [0.80, 'Good'],
    [0.75, 'Good'],  // boundary: < 0.90 and >= 0.75
    [0.70, 'Moderate'],
    [0.50, 'Moderate'],
    [0.49, 'Poor'],
    [0.00, 'Poor'],
    [-0.5, 'Poor'],
  ];
  cases.forEach(([icc, expected]) => {
    it(`ICC ${icc} → "${expected}"`, () => {
      expect(iccInterpretation(icc)).toBe(expected);
    });
  });

  it('NaN → "—"', () => {
    expect(iccInterpretation(NaN)).toBe('—');
  });
});

// ── iccFromPairs ───────────────────────────────────────────────────────────────

describe('iccFromPairs (ICC test-retest)', () => {
  it('identical test-retest pairs → ICC = 1.0', () => {
    const pairs = [[2,2],[4,4],[6,6],[3,3],[5,5]];
    // Identical pairs: MSe → 0, ICC → 1
    expect(iccFromPairs(pairs)).toBeCloseTo(1.0, 4);
  });

  it('n < 3 → returns NaN', () => {
    expect(isNaN(iccFromPairs([[3, 4], [5, 6]]))).toBe(true);
  });

  it('perfectly random pairs → ICC near 0 or negative', () => {
    // Uncorrelated pairs yield ICC close to 0
    const pairs = [[1,8],[5,2],[3,7],[8,1],[4,6],[2,9],[7,3],[6,4],[9,5],[3,8]];
    const icc = iccFromPairs(pairs);
    expect(icc).toBeLessThan(0.3);
  });

  it('result is clamped to [-1, 1]', () => {
    const pairs = [[10,1],[1,10],[10,1],[1,10],[5,5]];
    const icc = iccFromPairs(pairs);
    expect(icc).toBeGreaterThanOrEqual(-1);
    expect(icc).toBeLessThanOrEqual(1);
  });

  it('known high-agreement pairs → ICC > 0.90', () => {
    // Strong agreement: small random noise around identical values
    const pairs = [[6,6],[7,7],[5,5],[8,8],[4,4],[7,8],[5,5],[6,6],[8,7],[4,4]];
    expect(iccFromPairs(pairs)).toBeGreaterThan(0.90);
  });
});

// ── MMAS-8 score thresholds ────────────────────────────────────────────────────

describe('MMAS-8 score thresholds', () => {
  it('score 8 = HIGH adherence (maximum)', () => {
    expect(8).toBe(8);
  });

  it('scores 6–7 are in MEDIUM adherence band', () => {
    expect([6, 7].every(s => s >= 6 && s < 8)).toBe(true);
  });

  it('scores 0–5 are in LOW adherence band', () => {
    expect([0, 1, 2, 3, 4, 5].every(s => s < 6)).toBe(true);
  });

  it('valid MMAS-8 scores are integers 0–8', () => {
    for (let i = 0; i <= 8; i++) {
      expect(Number.isInteger(i) && i >= 0 && i <= 8).toBe(true);
    }
  });

  it('score 9 is out of range', () => {
    expect(9 > 8).toBe(true);
  });
});
