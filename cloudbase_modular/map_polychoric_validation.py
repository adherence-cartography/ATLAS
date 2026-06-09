import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

"""
MAP Tool - Polychoric Psychometric Validation  (corrected)
==========================================================
Tetrachoric/polychoric correlations + McDonald's omega
Domain structure:
  Architecture (A) : Q2, Q3, Q6   binary
  Execution    (E) : Q1, Q5, Q8   Q1,Q5 binary / Q8 ordinal 5-tier
  Context      (C) : Q4, Q7       binary
N = 1000
"""

import numpy as np
from scipy import stats, optimize
from scipy.stats import norm, multivariate_normal as mvn
from itertools import combinations
import warnings
warnings.filterwarnings('ignore')

np.random.seed(2026)
N = 1000

# =============================================================================
# 1. DATA GENERATION  — proper IRT parameterisation
# =============================================================================
# Latent factors on standard normal scale.
# Three domain-specific factors + one weak general adherence factor.
# g_load=0.35 produces cross-domain polychoric r ≈ 0.12 (disc^2 * g_load^2).
# Domain-specific variance fraction = 1 - g_load^2 ≈ 0.88.

g_load  = 0.35
general = np.random.normal(0, 1, N)

def domain_factor(g, gl=g_load):
    spec = np.random.normal(0, 1, N)
    raw  = np.sqrt(1 - gl**2) * spec + gl * g
    return (raw - raw.mean()) / raw.std()   # ensure exact N(0,1)

arch_z = domain_factor(general)   # Architecture latent
exec_z = domain_factor(general)   # Execution latent
ctx_z  = domain_factor(general)   # Context latent

# Normal-ogive item: P(X=1|theta) = Phi(disc * theta - diff)
# disc ≈ 0.65 gives within-domain polychoric r ≈ disc^2 ≈ 0.42
# Item difficulties calibrated to realistic clinical marginals:
#   ~50-60% score adherently on Architecture items (intentional stopping less common)
#   ~55-70% score adherently on Execution items  (forgetting common)
#   ~55-65% score adherently on Context items

def ogive(theta, disc, diff):
    """P(X=1|theta) via normal ogive (IRT 2PL normal-ogive parameterisation)."""
    prob = norm.cdf(disc * theta - diff)
    return (np.random.uniform(size=N) < prob).astype(float)

# Architecture — intentional-stopping items
# Difficulties calibrated so ~45-55% respond adherently (score 1)
q2 = ogive(arch_z, disc=0.65, diff=-0.10)   # deliberate omission  P(1)≈0.54
q3 = ogive(arch_z, disc=0.60, diff=-0.20)   # stopped-side-effects P(1)≈0.58
q6 = ogive(arch_z, disc=0.60, diff=-0.20)   # stopped-controlled   P(1)≈0.58

# Execution — behavioural habit items
q1 = ogive(exec_z, disc=0.65, diff= 0.00)   # ever forgets         P(1)≈0.50
q5 = ogive(exec_z, disc=0.55, diff=-0.60)   # took last dose       P(1)≈0.73 (easier)

# Q8 ordinal — 5-tier frequency of forgetting
# Realistic distribution: Never≈50%, Rarely≈20%, Sometimes≈15%, Often≈10%, Always≈5%
# Generated as a thresholded normal (exec_z + noise, more items-specific variance)
q8_z  = -0.55 * exec_z + np.sqrt(1-0.55**2) * np.random.normal(0,1,N)  # negative: high adherence -> "never" -> Q8=1.0
q8_z  = (q8_z - q8_z.mean()) / q8_z.std()
# Thresholds cut points at cumulative proportions 0.50, 0.70, 0.85, 0.95
q8_t  = [norm.ppf(p) for p in [0.50, 0.70, 0.85, 0.95]]
q8_cat= np.digitize(q8_z, q8_t)          # 0=never .. 4=always
# Reverse so higher latent adherence = higher score (never=1.0, always=0.0)
q8    = np.array([1.00, 0.75, 0.50, 0.25, 0.00])[q8_cat]

# Context — situational/environmental items
q4 = ogive(ctx_z, disc=0.65, diff=-0.10)   # environment barrier   P(1)≈0.54
q7 = ogive(ctx_z, disc=0.65, diff=-0.10)   # daily burden          P(1)≈0.54

arch_score = (q2 + q3 + q6) / 3
exec_score = (q1 + q5 + q8) / 3
ctx_score  = (q4 + q7) / 2
pe_score   = np.cbrt(arch_score * exec_score * ctx_score)

item_names = ['Q2','Q3','Q6','Q1','Q5','Q8','Q4','Q7']
domain_map = {'Q2':'A','Q3':'A','Q6':'A','Q1':'E','Q5':'E','Q8':'E','Q4':'C','Q7':'C'}
all_items  = np.column_stack([q2, q3, q6, q1, q5, q8, q4, q7])
idx_arch, idx_exec, idx_ctx = [0,1,2], [3,4,5], [6,7]


# =============================================================================
# 2. TETRACHORIC / POLYCHORIC CORRELATION  (ML estimation)
# =============================================================================

def bvn_cdf(h, k, rho):
    """P(Z1 <= h, Z2 <= k) for bivariate normal with correlation rho."""
    cov = [[1.0, rho], [rho, 1.0]]
    return mvn.cdf([h, k], mean=[0, 0], cov=cov)


def tetrachoric_r(x, y):
    """
    ML tetrachoric correlation for two binary (0/1) vectors.
    Model: X=1 iff Z_x > tau_x  (Z_x ~ N(0,1))
    P(X=1) = P(Z_x > tau_x) => tau_x = Phi^{-1}(P(X=0)) = norm.ppf(1-px)
    P(X=1,Y=1) = P(Z_x>tau_x, Z_y>tau_y) = Phi_2(-tau_x, -tau_y, rho)
    """
    x, y = np.asarray(x, float), np.asarray(y, float)
    px  = x.mean()                           # P(X=1)
    py  = y.mean()
    p11 = ((x == 1) & (y == 1)).mean()

    # Guard against extreme marginals
    eps = 1e-6
    px  = np.clip(px,  eps, 1-eps)
    py  = np.clip(py,  eps, 1-eps)
    p11 = np.clip(p11, eps, min(px, py) - eps)

    tau_x = norm.ppf(1.0 - px)   # Phi^{-1}(P(X=0))
    tau_y = norm.ppf(1.0 - py)

    # Observed cell proportions
    obs = np.array([
        p11,          # P(X=1, Y=1)
        px  - p11,    # P(X=1, Y=0)
        py  - p11,    # P(X=0, Y=1)
        1 - px - py + p11  # P(X=0, Y=0)
    ])
    obs = np.clip(obs, eps, 1)

    def neg_ll(rho):
        rho = float(np.clip(rho, -0.9999, 0.9999))
        p11h = bvn_cdf(-tau_x, -tau_y, rho)
        hat  = np.array([
            p11h,
            px  - p11h,
            py  - p11h,
            1 - px - py + p11h
        ])
        hat = np.clip(hat, eps, 1)
        return -float(np.sum(obs * np.log(hat)))

    res = optimize.minimize_scalar(neg_ll, bounds=(-0.9999, 0.9999),
                                   method='bounded', options={'xatol': 1e-7})
    return float(res.x)


def polychoric_r(x, y):
    """
    Polychoric correlation for ordinal items.
    Uses tetrachoric for binary pairs; general ML for ordinal x ordinal.
    """
    cats_x = np.unique(x)
    cats_y = np.unique(y)

    # Both binary -> tetrachoric
    if len(cats_x) == 2 and len(cats_y) == 2:
        bx = (x == cats_x.max()).astype(float)
        by = (y == cats_y.max()).astype(float)
        return tetrachoric_r(bx, by)

    eps = 1e-7

    # Estimate thresholds from marginal cumulative proportions
    def marginal_thresholds(v, cats):
        thresholds = []
        cum = 0.0
        for c in sorted(cats)[:-1]:
            cum += (v == c).mean()
            thresholds.append(norm.ppf(np.clip(cum, eps, 1-eps)))
        return thresholds

    thx = marginal_thresholds(x, cats_x)
    thy = marginal_thresholds(y, cats_y)
    nx, ny = len(cats_x), len(cats_y)

    # Observed contingency proportions
    obs = np.zeros((nx, ny))
    for xi, cx in enumerate(sorted(cats_x)):
        for yi, cy in enumerate(sorted(cats_y)):
            obs[xi, yi] = ((x == cx) & (y == cy)).mean()
    obs = np.clip(obs, eps, 1)

    def cell_prob(i, j, rho):
        lo_x = thx[i-1] if i > 0         else -8.0
        hi_x = thx[i]   if i < len(thx)  else  8.0
        lo_y = thy[j-1] if j > 0         else -8.0
        hi_y = thy[j]   if j < len(thy)  else  8.0
        p = (bvn_cdf(hi_x, hi_y, rho) - bvn_cdf(lo_x, hi_y, rho)
             - bvn_cdf(hi_x, lo_y, rho) + bvn_cdf(lo_x, lo_y, rho))
        return float(np.clip(p, eps, 1))

    def neg_ll(rho):
        rho = float(np.clip(rho, -0.9999, 0.9999))
        ll  = 0.0
        for i in range(nx):
            for j in range(ny):
                ll += obs[i, j] * np.log(cell_prob(i, j, rho))
        return -ll

    res = optimize.minimize_scalar(neg_ll, bounds=(-0.9999, 0.9999),
                                   method='bounded', options={'xatol': 1e-5})
    return float(res.x)


def build_poly_matrix(items, names):
    k = items.shape[1]
    R = np.eye(k)
    total = k*(k-1)//2
    done  = 0
    for i, j in combinations(range(k), 2):
        r = polychoric_r(items[:, i], items[:, j])
        R[i, j] = R[j, i] = r
        done += 1
        print(f"    [{done:2d}/{total}] {names[i]}-{names[j]}: rho = {r:+.4f}")
    return R


# =============================================================================
# 3. FACTOR ANALYSIS ON POLYCHORIC MATRIX
# =============================================================================

def psd_repair(R):
    """Force positive semi-definite by flooring eigenvalues at 0.001."""
    R = (R + R.T) / 2  # symmetrise
    ev = np.linalg.eigvalsh(R)
    if ev.min() < 0.001:
        R += (-ev.min() + 0.001) * np.eye(R.shape[0])
    return R


def principal_axis_factor(R, n_factors=1, max_iter=200, tol=1e-8):
    """
    Iterative principal axis factoring.
    Returns loadings (k x n_factors), communalities, eigenvalues.
    """
    k    = R.shape[0]
    h2   = np.clip(np.diag(R), 0.1, 0.99) if not np.allclose(np.diag(R), 1) \
           else np.full(k, 0.5)

    for _ in range(max_iter):
        R_red = R.copy()
        np.fill_diagonal(R_red, h2)
        eigvals, eigvecs = np.linalg.eigh(R_red)
        # Descending order
        order   = np.argsort(eigvals)[::-1]
        eigvals = eigvals[order]
        eigvecs = eigvecs[:, order]

        # Keep only positive eigenvalues up to n_factors
        n_use = min(n_factors, int((eigvals > 0).sum()))
        if n_use == 0:
            n_use = 1
        L = eigvecs[:, :n_use] * np.sqrt(np.maximum(eigvals[:n_use], 0))

        new_h2 = np.clip((L**2).sum(axis=1), 0.001, 0.999)
        if np.max(np.abs(new_h2 - h2)) < tol:
            break
        h2 = new_h2

    return L, h2, eigvals


# =============================================================================
# 4. MCDONALD'S OMEGA
# =============================================================================

def omega_total(loadings_1f):
    """omega_t from single-factor solution."""
    lam = np.abs(loadings_1f).ravel()
    uniq = np.clip(1 - lam**2, 0.001, 1)
    return lam.sum()**2 / (lam.sum()**2 + uniq.sum())


def omega_subscale(poly_R_sub, n_items):
    """omega for a domain subscale from its polychoric submatrix."""
    R = psd_repair(poly_R_sub.copy())
    L, h2, eigv = principal_axis_factor(R, n_factors=1)
    lam = L[:, 0]
    ot  = omega_total(lam)

    # Polychoric alpha (Spearman-Brown formula on avg off-diagonal r)
    k = R.shape[0]
    np.fill_diagonal(R, 0)
    avg_r = R.sum() / (k * (k-1))
    alpha_p = (k * avg_r) / (1 + (k-1) * avg_r)

    # Spearman-Brown for 2-item scale
    sb = None
    if k == 2:
        r12 = poly_R_sub[0, 1]
        sb  = (2 * r12) / (1 + r12) if r12 > -1 else np.nan

    return {'omega': ot, 'alpha_poly': alpha_p, 'sb': sb,
            'loadings': lam, 'h2': h2, 'avg_r': avg_r, 'eigv': eigv}


# =============================================================================
# 5. PARALLEL ANALYSIS
# =============================================================================

def parallel_analysis(R_poly, n_sim=200, pct=95):
    k      = R_poly.shape[0]
    real_e = np.sort(np.real(np.linalg.eigvals(R_poly)))[::-1]
    sims   = []
    for _ in range(n_sim):
        Z  = np.random.normal(size=(N, k))
        Rc = np.corrcoef(Z.T)
        sims.append(np.sort(np.real(np.linalg.eigvals(Rc)))[::-1])
    thresh    = np.percentile(sims, pct, axis=0)
    n_factors = int((real_e > thresh).sum())
    return real_e, thresh, n_factors


# =============================================================================
# 6. BARTLETT'S TEST OF SPHERICITY
# =============================================================================

def bartlett_sphericity(R, n):
    k   = R.shape[0]
    det = np.linalg.det(R)
    det = max(det, 1e-300)
    chi2 = -(n - 1 - (2*k + 5)/6) * np.log(det)
    df   = k * (k-1) / 2
    p    = stats.chi2.sf(chi2, df)
    return chi2, df, p


# =============================================================================
# 7. KMO (Kaiser-Meyer-Olkin)
# =============================================================================

def kmo(R):
    R_inv = np.linalg.inv(R)
    # Partial correlations
    P = np.zeros_like(R)
    for i in range(R.shape[0]):
        for j in range(R.shape[0]):
            if i != j:
                P[i, j] = -R_inv[i, j] / np.sqrt(R_inv[i, i] * R_inv[j, j])
    r2  = R**2
    p2  = P**2
    np.fill_diagonal(r2, 0)
    np.fill_diagonal(p2, 0)
    kmo_val = r2.sum() / (r2.sum() + p2.sum())
    return kmo_val


# =============================================================================
# 8. RUN & REPORT
# =============================================================================

SEP  = "-" * 66
SEP2 = "=" * 66

print(f"\n{SEP2}")
print("  MAP TOOL - POLYCHORIC PSYCHOMETRIC VALIDATION")
print(f"  N={N}  /  Tetrachoric+Polychoric ML estimation")
print(f"{SEP2}\n")

# ── Polychoric matrix ────────────────────────────────────────────────────────
print("STEP 1: POLYCHORIC CORRELATION MATRIX")
print(SEP)
poly_R = build_poly_matrix(all_items, item_names)
poly_R = psd_repair(poly_R)

print(f"\n  {'':7}", end='')
for n in item_names:
    print(f"  {n:>6}", end='')
print()
for i, ni in enumerate(item_names):
    dom = domain_map[ni]
    print(f"  {ni}({dom}) ", end='')
    for j in range(len(item_names)):
        print(f"  {poly_R[i,j]:>6.3f}", end='')
    print()

# ── Bartlett + KMO ───────────────────────────────────────────────────────────
chi2_b, df_b, p_b = bartlett_sphericity(poly_R, N)
kmo_val            = kmo(poly_R)
print(f"\n  Bartlett's test of sphericity: chi2({int(df_b)}) = {chi2_b:.1f}, p = {p_b:.4f}")
print(f"  KMO measure of sampling adequacy: {kmo_val:.3f}  "
      f"({'Excellent' if kmo_val>=0.9 else 'Good' if kmo_val>=0.8 else 'Acceptable' if kmo_val>=0.7 else 'Low'})")

# ── Domain reliability ───────────────────────────────────────────────────────
print(f"\n\nSTEP 2: DOMAIN RELIABILITY")
print(SEP)

sub_arch = poly_R[np.ix_(idx_arch, idx_arch)]
sub_exec = poly_R[np.ix_(idx_exec, idx_exec)]
sub_ctx  = poly_R[np.ix_(idx_ctx,  idx_ctx )]

res_a = omega_subscale(sub_arch, 3)
res_e = omega_subscale(sub_exec, 3)
res_c = omega_subscale(sub_ctx,  2)

def bmark(v, lo, hi):
    return "Excellent" if v >= hi else "Acceptable" if v >= lo else "LOW"

print(f"\n  {'Domain':<24} {'Items':<12} {'poly-a':>8} {'omega':>7} {'SB-2':>7}  Rating")
print(f"  {'Architecture':<24} {'Q2,Q3,Q6':<12} {res_a['alpha_poly']:>8.3f} {res_a['omega']:>7.3f} {'---':>7}  {bmark(res_a['omega'],0.60,0.75)}")
print(f"  {'Execution':<24} {'Q1,Q5,Q8':<12} {res_e['alpha_poly']:>8.3f} {res_e['omega']:>7.3f} {'---':>7}  {bmark(res_e['omega'],0.60,0.75)}")
print(f"  {'Context (2-item)':<24} {'Q4,Q7':<12} {res_c['alpha_poly']:>8.3f} {res_c['omega']:>7.3f} {res_c['sb']:>7.3f}  {bmark(res_c['sb'],0.50,0.70)}")

print(f"\n  Avg inter-item polychoric r  [target 0.15-0.50]")
print(f"    Architecture : {res_a['avg_r']:.3f}")
print(f"    Execution    : {res_e['avg_r']:.3f}")
print(f"    Context      : {sub_ctx[0,1]:.3f}  (single pair r)")

print(f"\n  Factor loadings on domain factor:")
for lbl, lam, h2 in zip(['Q2','Q3','Q6'], res_a['loadings'], res_a['h2']):
    print(f"    Arch  {lbl}: lam={lam:+.3f}  comm={h2:.3f}")
for lbl, lam, h2 in zip(['Q1','Q5','Q8'], res_e['loadings'], res_e['h2']):
    print(f"    Exec  {lbl}: lam={lam:+.3f}  comm={h2:.3f}")
for lbl, lam, h2 in zip(['Q4','Q7'], res_c['loadings'], res_c['h2']):
    print(f"    Ctx   {lbl}: lam={lam:+.3f}  comm={h2:.3f}")

# ── Full-scale omega ─────────────────────────────────────────────────────────
print(f"\n\nSTEP 3: FULL-SCALE OMEGA (8-item general factor)")
print(SEP)
R_full = psd_repair(poly_R.copy())
L1, h2_1, eig1 = principal_axis_factor(R_full, n_factors=1)
L3, h2_3, eig3 = principal_axis_factor(R_full, n_factors=3)

g_load    = L1[:, 0]
# Omega hierarchical: general factor variance as proportion of total
# Approximate specific factor loadings as residual communality
spec_load = np.sqrt(np.maximum(h2_3 - g_load**2, 0))
uniq_h    = np.maximum(1 - h2_3, 0.001)
total_v   = g_load.sum()**2 + spec_load.sum()**2 + uniq_h.sum()
omega_h_val = g_load.sum()**2 / total_v
omega_t_val = omega_total(g_load)

print(f"\n  General factor loadings (all 8 items on g):")
for n, gl in zip(item_names, g_load):
    bar = "#" * int(abs(gl) * 25)
    print(f"    {n}({domain_map[n]}): {gl:+.3f}  {bar}")
print(f"\n  Omega total      : {omega_t_val:.3f}  (all items, 1 general factor)")
print(f"  Omega hierarchical: {omega_h_val:.3f}  (variance attributable to g only)")
print(f"  Omega subscale   : {omega_t_val - omega_h_val:.3f}  (domain-specific residual)")
print(f"  -> Proportion of total omega explained by g: {omega_h_val/omega_t_val*100:.1f}%")

# ── Parallel analysis ─────────────────────────────────────────────────────────
print(f"\n\nSTEP 4: PARALLEL ANALYSIS (200 simulations, 95th pct)")
print(SEP)
print("  Running...")
real_e, pa_t, n_pa = parallel_analysis(poly_R)
print(f"\n  {'Factor':<8} {'Real lambda':>12} {'PA threshold':>13} {'Retain?'}")
for i, (re, pa) in enumerate(zip(real_e[:7], pa_t[:7]), 1):
    flag = "YES ***" if re > pa else "no"
    print(f"  {i:<8} {re:>12.4f} {pa:>13.4f}  {flag}")
print(f"\n  Parallel analysis: retain {n_pa} factor(s)  [expected: 3]")

# ── Discriminant validity ────────────────────────────────────────────────────
print(f"\n\nSTEP 5: DISCRIMINANT VALIDITY")
print(SEP)

def avg_off(R_sub):
    k = R_sub.shape[0]
    off = R_sub - np.eye(k)
    return off.sum() / (k*(k-1))

within_a = avg_off(sub_arch)
within_e = avg_off(sub_exec)
within_c = sub_ctx[0, 1]

cross_ae = np.mean([poly_R[i,j] for i in idx_arch for j in idx_exec])
cross_ac = np.mean([poly_R[i,j] for i in idx_arch for j in idx_ctx])
cross_ec = np.mean([poly_R[i,j] for i in idx_exec for j in idx_ctx])

ave_a = np.mean(res_a['h2'])
ave_e = np.mean(res_e['h2'])
ave_c = np.mean(res_c['h2'])

print(f"\n  Within-domain avg r  (convergent, higher = better)")
print(f"    Architecture : {within_a:.3f}")
print(f"    Execution    : {within_e:.3f}")
print(f"    Context      : {within_c:.3f}")
print(f"\n  Cross-domain avg r   (discriminant, lower = better)")

def discrim_pass(within_a, within_b, cross):
    return "PASS" if abs(cross) < within_a and abs(cross) < within_b else "FAIL"

print(f"    Arch x Exec  : {cross_ae:.3f}  {discrim_pass(within_a,within_e,cross_ae)}")
print(f"    Arch x Ctx   : {cross_ac:.3f}  {discrim_pass(within_a,within_c,cross_ac)}")
print(f"    Exec x Ctx   : {cross_ec:.3f}  {discrim_pass(within_e,within_c,cross_ec)}")

print(f"\n  Fornell-Larcker criterion (AVE > shared variance r^2)")
print(f"    Arch AVE={ave_a:.3f}  vs shared(AxE)={cross_ae**2:.3f}  {'PASS' if ave_a>cross_ae**2 else 'FAIL'}")
print(f"    Exec AVE={ave_e:.3f}  vs shared(ExC)={cross_ec**2:.3f}  {'PASS' if ave_e>cross_ec**2 else 'FAIL'}")
print(f"    Ctx  AVE={ave_c:.3f}  vs shared(AxC)={cross_ac**2:.3f}  {'PASS' if ave_c>cross_ac**2 else 'FAIL'}")

# ── Criterion validity ───────────────────────────────────────────────────────
print(f"\n\nSTEP 6: CRITERION VALIDITY")
print(SEP)
gold = norm.cdf(0.40*arch_z + 0.40*exec_z + 0.20*ctx_z)   # mapped to 0-1
mmas = (q1+q2+q3+q4+(1-q5)+q6+q7+q8) / 8
r_pe,  p_pe  = stats.pearsonr(pe_score,  gold)
r_mm,  p_mm  = stats.pearsonr(mmas,      gold)
r_ar,  _     = stats.pearsonr(arch_score, gold)
r_ex,  _     = stats.pearsonr(exec_score, gold)
r_ct,  _     = stats.pearsonr(ctx_score,  gold)

print(f"\n  Criterion: synthetic gold standard (0.4*A_lat + 0.4*E_lat + 0.2*C_lat)")
print(f"  PE score           : r = {r_pe:.3f}  (p={p_pe:.2e})")
print(f"  Architecture       : r = {r_ar:.3f}")
print(f"  Execution          : r = {r_ex:.3f}")
print(f"  Context            : r = {r_ct:.3f}")
print(f"  MMAS-sum (legacy)  : r = {r_mm:.3f}  (p={p_mm:.2e})")
print(f"  PE advantage        : delta-r = {r_pe - r_mm:+.3f}")

# PE=0 breakdown
pe0     = (pe_score == 0).mean()*100
ctx_0   = ((ctx_score == 0) & (arch_score > 0) & (exec_score > 0)).mean()*100
exec_0  = ((exec_score == 0) & (ctx_score  > 0)).mean()*100
arch_0  = ((arch_score == 0) & (ctx_score  > 0)).mean()*100

print(f"\n  PE=0 breakdown:")
print(f"    Total PE=0                      : {pe0:.1f}%")
print(f"    Context gate only (A>0, E>0)    : {ctx_0:.1f}%")
print(f"    Execution-driven                : {exec_0:.1f}%")
print(f"    Architecture-driven             : {arch_0:.1f}%")

# INA/UNA balance
from collections import Counter

def classify_new(q1v, q2v, q3v, q6v, q8v):
    ina = (q2v==0) + (q3v==0) + (q6v==0)
    una = (q1v==0) + (q8v<1)
    if   ina > una: return 'INA'
    elif una > ina: return 'UNA'
    elif ina or una: return 'Mixed'
    return 'Adherent'

clf = Counter(classify_new(q1[i],q2[i],q3[i],q6[i],q8[i]) for i in range(N))

print(f"\n  INA/UNA distribution (3-item INA / 2-item UNA / 3-item Neutral):")
for lbl in ['INA','UNA','Mixed','Adherent']:
    n   = clf.get(lbl, 0)
    pct = n/N*100
    bar = "#" * int(pct/3)
    print(f"    {lbl:<12}: {n:>4}  ({pct:5.1f}%)  {bar}")

# ── Summary ──────────────────────────────────────────────────────────────────
print(f"\n\nSUMMARY BENCHMARKS")
print(SEP2)

chk = [
    ("Bartlett p < 0.001 (factorable)",       p_b < 0.001),
    ("KMO >= 0.70 (sampling adequacy)",        kmo_val >= 0.70),
    ("Architecture omega >= 0.70",             res_a['omega'] >= 0.70),
    ("Execution omega >= 0.70",                res_e['omega'] >= 0.70),
    ("Context SB-2 >= 0.60",                   res_c['sb'] is not None and res_c['sb'] >= 0.60),
    ("All within > cross r (discriminant)",    all([abs(cross_ae)<within_a, abs(cross_ae)<within_e,
                                                    abs(cross_ac)<within_a, abs(cross_ac)<within_c,
                                                    abs(cross_ec)<within_e, abs(cross_ec)<within_c])),
    ("Fornell-Larcker AVE (3/3 domains)",      all([ave_a>cross_ae**2, ave_e>cross_ec**2, ave_c>cross_ac**2])),
    ("Parallel analysis = 3 factors",          n_pa == 3),
    ("Omega hierarchical >= 0.50",             omega_h_val >= 0.50),
    ("PE > MMAS-sum criterion r",              r_pe > r_mm),
]

for desc, passed in chk:
    icon = "[+] PASS" if passed else "[-] FAIL"
    print(f"  {icon}  {desc}")

n_pass = sum(p for _, p in chk)
print(f"\n  {n_pass}/{len(chk)} benchmarks met")
print(f"{SEP2}\n")
