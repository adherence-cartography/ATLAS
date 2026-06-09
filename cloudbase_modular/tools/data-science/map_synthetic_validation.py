import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

"""
MAP Tool - Synthetic Psychometric Validation
=============================================
New domain structure under TPE:
  Architecture (A) : Q2, Q3, Q6  — beliefs & intentional decisions    (INA items)
  Execution    (E) : Q1, Q5, Q8  — behavioural habits & last-dose     (UNA items + neutral Q5)
  Context      (C) : Q4, Q7      — situational barriers & burden      (Neutral items)

  PE = (A × E × C)^(1/3)   non-compensatory geometric mean

Scoring:
  Q1,Q2,Q3,Q4,Q5,Q6,Q7 : binary  0 = non-adherent response, 1 = adherent response
  Q5                    : reverse-scored (Yes=1 took dose = adherent)
  Q8                    : ordinal  never=1.00  rarely=0.75  sometimes=0.50
                                   often=0.25  always=0.00

N = 500 synthetic participants generated via a 3-factor latent model with
a small general adherence factor to reflect realistic inter-domain overlap.
"""

import numpy as np
from scipy import stats
from itertools import combinations

np.random.seed(2026)
N = 500

# ── 1. LATENT FACTOR GENERATION ──────────────────────────────────────────────
# Three domain latent scores + a small general adherence factor
# Beta distributions chosen to approximate published adherence distributions:
#   ~28% high, ~45% medium, ~27% low  (Morisky et al. 2008 references)

general   = np.random.beta(2.8, 2.2, N)          # general adherence tendency
arch_lat  = np.clip(0.65*np.random.beta(2.8,2.2,N) + 0.35*general, 0, 1)
exec_lat  = np.clip(0.65*np.random.beta(2.8,2.2,N) + 0.35*general, 0, 1)
ctx_lat   = np.clip(0.65*np.random.beta(3.2,2.0,N) + 0.35*general, 0, 1)
# Context latent slightly higher (environmental barriers less universal than forgetting)


# ── 2. ITEM GENERATION ───────────────────────────────────────────────────────
def binary_item(latent, disc=2.8, diff=0.0):
    """2PL IRT-inspired binary item.  disc=discrimination, diff=difficulty offset."""
    prob = 1 / (1 + np.exp(-disc * (latent - 0.5 + diff)))
    return (np.random.uniform(size=N) < prob).astype(float)

# Architecture — intentional stopping items (slightly harder to endorse adherently)
q2 = binary_item(arch_lat, disc=2.8, diff= 0.05)   # deliberate omission past 2wk
q3 = binary_item(arch_lat, disc=2.6, diff= 0.10)   # stopped due to side effects
q6 = binary_item(arch_lat, disc=2.6, diff= 0.10)   # stopped when felt controlled

# Execution — behavioural habit items
q1 = binary_item(exec_lat, disc=2.8, diff= 0.00)   # ever forgets
q5 = binary_item(exec_lat, disc=2.2, diff=-0.10)   # took last dose (reverse: easier to score 1)

# Q8 ordinal — map latent execution to 5-tier frequency scale
q8_raw  = np.clip(exec_lat + np.random.normal(0, 0.18, N), 0, 1)
q8_bins = np.digitize(q8_raw, [0.20, 0.40, 0.60, 0.80])
q8      = np.array([1.00, 0.75, 0.50, 0.25, 0.00])[q8_bins]

# Context — situational / environmental items
q4 = binary_item(ctx_lat, disc=2.7, diff= 0.08)    # environment barrier when travelling
q7 = binary_item(ctx_lat, disc=2.7, diff= 0.05)    # daily burden / hassle


# ── 3. DOMAIN SCORES & PE ────────────────────────────────────────────────────
arch_score = (q2 + q3 + q6) / 3
exec_score = (q1 + q5 + q8) / 3
ctx_score  = (q4 + q7) / 2
pe_score   = np.cbrt(arch_score * exec_score * ctx_score)

arch_items = np.column_stack([q2, q3, q6])
exec_items = np.column_stack([q1, q5, q8])
ctx_items  = np.column_stack([q4, q7])
all_items  = np.column_stack([q2, q3, q6, q1, q5, q8, q4, q7])


# ── 4. RELIABILITY ───────────────────────────────────────────────────────────
def cronbach_alpha(mat):
    k        = mat.shape[1]
    item_var = np.var(mat, axis=0, ddof=1)
    total_var= np.var(mat.sum(axis=1), ddof=1)
    if total_var == 0: return np.nan
    return (k / (k - 1)) * (1 - item_var.sum() / total_var)

def spearman_brown_2item(x, y):
    r = np.corrcoef(x, y)[0, 1]
    return (2 * r) / (1 + r)

def avg_inter_item_r(mat):
    k    = mat.shape[1]
    rs   = [np.corrcoef(mat[:,i], mat[:,j])[0,1]
            for i,j in combinations(range(k), 2)]
    return np.mean(rs), np.std(rs)

def corrected_item_total(mat):
    """Item-rest correlations (corrected item-total)."""
    results = []
    for i in range(mat.shape[1]):
        rest  = np.delete(mat, i, axis=1).sum(axis=1)
        r, _  = stats.pearsonr(mat[:, i], rest)
        results.append(r)
    return np.array(results)

alpha_arch = cronbach_alpha(arch_items)
alpha_exec = cronbach_alpha(exec_items)
alpha_ctx  = cronbach_alpha(ctx_items)          # note: 2-item alpha
sb_ctx     = spearman_brown_2item(q4, q7)       # Spearman-Brown preferred for 2 items
alpha_full = cronbach_alpha(all_items)

aic_arch, sd_arch = avg_inter_item_r(arch_items)
aic_exec, sd_exec = avg_inter_item_r(exec_items)
aic_ctx           = np.corrcoef(q4, q7)[0, 1]  # single pair

cit_arch = corrected_item_total(arch_items)
cit_exec = corrected_item_total(exec_items)
cit_ctx  = corrected_item_total(ctx_items)


# ── 5. INTER-DOMAIN CORRELATIONS (discriminant validity) ─────────────────────
r_ae, p_ae = stats.pearsonr(arch_score, exec_score)
r_ac, p_ac = stats.pearsonr(arch_score, ctx_score)
r_ec, p_ec = stats.pearsonr(exec_score, ctx_score)


# ── 6. CONVERGENT VALIDITY — multitrait matrix diagonal vs off-diagonal ───────
# Each item should correlate more with its own domain total than with others
items_labeled = {
    'Q2(A)': (q2,   arch_score, exec_score, ctx_score),
    'Q3(A)': (q3,   arch_score, exec_score, ctx_score),
    'Q6(A)': (q6,   arch_score, exec_score, ctx_score),
    'Q1(E)': (q1,   exec_score, arch_score, ctx_score),
    'Q5(E)': (q5,   exec_score, arch_score, ctx_score),
    'Q8(E)': (q8,   exec_score, arch_score, ctx_score),
    'Q4(C)': (q4,   ctx_score,  arch_score, exec_score),
    'Q7(C)': (q7,   ctx_score,  arch_score, exec_score),
}


# ── 7. EXPLORATORY STRUCTURE — PCA on polychoric proxy ───────────────────────
# Using Pearson on binary items as proxy; full polychoric requires specialist lib
from numpy.linalg import eig

corr_mat = np.corrcoef(all_items.T)
eigenvalues, eigenvectors = eig(corr_mat)
eigenvalues = np.real(eigenvalues)
eigenvalues_sorted = np.sort(eigenvalues)[::-1]
variance_explained = eigenvalues_sorted / eigenvalues_sorted.sum() * 100
cumulative_var     = np.cumsum(variance_explained)


# ── 8. CRITERION VALIDITY ─────────────────────────────────────────────────────
# Synthetic gold standard: weighted latent composite (simulating objective adherence)
# Weights reflect theoretical domain importance: A and E equally predictive, C moderating
gold_std    = np.clip(0.40*arch_lat + 0.40*exec_lat + 0.20*ctx_lat, 0, 1)

r_pe_gold,   p_pe_gold   = stats.pearsonr(pe_score,   gold_std)
r_arch_gold, p_arch_gold = stats.pearsonr(arch_score, gold_std)
r_exec_gold, p_exec_gold = stats.pearsonr(exec_score, gold_std)
r_ctx_gold,  p_ctx_gold  = stats.pearsonr(ctx_score,  gold_std)

# MMAS-style unweighted sum for comparison
mmas_sum = q1+q2+q3+q4+(1-q5)+q6+q7+q8   # traditional MMAS direction (lower = worse)
# Flip so higher = more adherent for fair comparison
mmas_sum_norm = mmas_sum / mmas_sum.max()
r_mmas_gold, p_mmas_gold = stats.pearsonr(mmas_sum_norm, gold_std)


# ── 9. PE SCORE DISTRIBUTION ─────────────────────────────────────────────────
pe_zero_pct    = (pe_score == 0).mean() * 100
pe_only_c_zero = ((ctx_score == 0) & (arch_score > 0) & (exec_score > 0)).mean() * 100
pe_mean        = pe_score.mean()
pe_median      = np.median(pe_score)
pe_std         = pe_score.std()

# Adherence tier distribution using PE thresholds
# (analogous to MMAS tiers but domain-informed)
n_high   = (pe_score >= 0.75).sum()
n_medium = ((pe_score >= 0.40) & (pe_score < 0.75)).sum()
n_low    = ((pe_score > 0) & (pe_score < 0.40)).sum()
n_zero   = (pe_score == 0).sum()


# ── 10. INA / UNA CLASSIFICATION BALANCE ─────────────────────────────────────
def classify(record):
    ina = sum([
        1 if record['q2'] == 0 else 0,
        1 if record['q3'] == 0 else 0,
        1 if record['q6'] == 0 else 0,
    ])
    una = sum([
        1 if record['q1'] == 0 else 0,
        1 if record['q8'] < 1  else 0,
    ])
    if   ina > una: return 'INA'
    elif una > ina: return 'UNA'
    elif ina or una: return 'Mixed'
    else:           return 'Adherent'

classifications = [classify({'q1':q1[i],'q2':q2[i],'q3':q3[i],
                              'q6':q6[i],'q8':q8[i]})
                   for i in range(N)]
from collections import Counter
class_counts = Counter(classifications)


# ── PRINT REPORT ──────────────────────────────────────────────────────────────
SEP  = "-" * 62
SEP2 = "=" * 62

print(f"\n{SEP2}")
print("  MAP TOOL — SYNTHETIC PSYCHOMETRIC VALIDATION REPORT")
print(f"  N = {N} synthetic participants · New TPE domain structure")
print(f"{SEP2}")

print(f"\n{'RELIABILITY':}")
print(SEP)
print(f"  {'Domain':<30}  {'α / SB-2':<10}  {'Benchmark'}")
print(f"  {'Architecture (Q2,Q3,Q6)':<30}  {alpha_arch:.3f}       ≥0.70 acceptable")
print(f"  {'Execution  (Q1,Q5,Q8)':<30}  {alpha_exec:.3f}       ≥0.70 acceptable")
print(f"  {'Context    (Q4,Q7)  α':<30}  {alpha_ctx:.3f}       2-item α (see SB below)")
print(f"  {'Context    (Q4,Q7)  SB-2':<30}  {sb_ctx:.3f}       Spearman-Brown (preferred)")
print(f"  {'Full scale (all 8 items)':<30}  {alpha_full:.3f}       MMAS ref: 0.83")

print(f"\n  Average Inter-Item Correlation (AIC)  [target: 0.15–0.50]")
print(f"  {'Architecture':<20}  AIC = {aic_arch:.3f}  (SD={sd_arch:.3f})")
print(f"  {'Execution':<20}  AIC = {aic_exec:.3f}  (SD={sd_exec:.3f})")
print(f"  {'Context':<20}  r   = {aic_ctx:.3f}  (single pair)")

print(f"\n  Corrected Item-Total Correlations  [target: ≥0.30]")
labels_arch = ['Q2','Q3','Q6']
labels_exec = ['Q1','Q5','Q8']
labels_ctx  = ['Q4','Q7']
for lbl, r in zip(labels_arch, cit_arch):
    flag = "PASS" if r >= 0.30 else "FAIL"
    print(f"  Architecture  {lbl}: r = {r:.3f}  {flag}")
for lbl, r in zip(labels_exec, cit_exec):
    flag = "PASS" if r >= 0.30 else "FAIL"
    print(f"  Execution     {lbl}: r = {r:.3f}  {flag}")
for lbl, r in zip(labels_ctx, cit_ctx):
    flag = "PASS" if r >= 0.30 else "FAIL"
    print(f"  Context       {lbl}: r = {r:.3f}  {flag}")

print(f"\n{'DISCRIMINANT VALIDITY — Inter-Domain Correlations':}")
print(SEP)
print(f"  [target: r < 0.70 — domains should be related but distinct]")
print(f"  Architecture ↔ Execution : r = {r_ae:.3f}  (p = {p_ae:.4f})")
print(f"  Architecture ↔ Context   : r = {r_ac:.3f}  (p = {p_ac:.4f})")
print(f"  Execution    ↔ Context   : r = {r_ec:.3f}  (p = {p_ec:.4f})")

print(f"\n{'CONVERGENT VALIDITY — Item-Domain Correlations':}")
print(SEP)
print(f"  {'Item':<8}  {'Own domain':>12}  {'Domain 2':>10}  {'Domain 3':>10}  {'Pass?'}")
for label, (item, own, d2, d3) in items_labeled.items():
    r_own, _ = stats.pearsonr(item, own)
    r_d2,  _ = stats.pearsonr(item, d2)
    r_d3,  _ = stats.pearsonr(item, d3)
    passed   = "PASS" if r_own > max(r_d2, r_d3) else "FAIL"
    print(f"  {label:<8}  {r_own:>12.3f}  {r_d2:>10.3f}  {r_d3:>10.3f}  {passed}")

print(f"\n{'EXPLORATORY STRUCTURE — PCA Eigenvalues (Pearson proxy)':}")
print(SEP)
print(f"  [Parallel analysis benchmark: eigenvalue > 1 = plausible factor]")
for i, (ev, pct, cum) in enumerate(zip(eigenvalues_sorted[:6],
                                        variance_explained[:6],
                                        cumulative_var[:6]), 1):
    bar = "#" * int(pct / 2)
    print(f"  Factor {i}: lambda={ev:.3f}  ({pct:5.1f}% var)  cum={cum:5.1f}%  {bar}")
print(f"\n  → Factors with λ > 1.0: {(eigenvalues_sorted > 1.0).sum()}")
print(f"    Expected for 3-domain model: 3 factors")

print(f"\n{'CRITERION VALIDITY — Correlation with Synthetic Gold Standard':}")
print(SEP)
print(f"  [Gold std = 0.40×arch_latent + 0.40×exec_latent + 0.20×ctx_latent]")
print(f"  PE score           : r = {r_pe_gold:.3f}  (p = {p_pe_gold:.2e})")
print(f"  Architecture score : r = {r_arch_gold:.3f}  (p = {p_arch_gold:.2e})")
print(f"  Execution score    : r = {r_exec_gold:.3f}  (p = {p_exec_gold:.2e})")
print(f"  Context score      : r = {r_ctx_gold:.3f}  (p = {p_ctx_gold:.2e})")
print(f"  MMAS sum (comparison)  : r = {r_mmas_gold:.3f}  (p = {p_mmas_gold:.2e})")
delta = r_pe_gold - r_mmas_gold
print(f"\n  PE advantage over MMAS sum: Δr = {delta:+.3f}")

print(f"\n{'PE SCORE DISTRIBUTION':}")
print(SEP)
print(f"  Mean   : {pe_mean:.3f}    Median : {pe_median:.3f}    SD : {pe_std:.3f}")
print(f"  PE = 0 : {pe_zero_pct:.1f}% of sample")
print(f"    of which PE=0 due to Context alone (A>0, E>0): {pe_only_c_zero:.1f}%")
print(f"\n  Tier distribution:")
print(f"  High   (PE ≥ 0.75) : {n_high:>4}  ({n_high/N*100:.1f}%)")
print(f"  Medium (PE 0.40–0.74): {n_medium:>4}  ({n_medium/N*100:.1f}%)")
print(f"  Low    (PE 0.01–0.39): {n_low:>4}  ({n_low/N*100:.1f}%)")
print(f"  Zero   (PE = 0.00) : {n_zero:>4}  ({n_zero/N*100:.1f}%)")

print(f"\n{'INA / UNA CLASSIFICATION BALANCE (new 3-item INA / 2-item UNA)':}")
print(SEP)
total_classified = sum(class_counts.values())
for label in ['INA','UNA','Mixed','Adherent']:
    n   = class_counts.get(label, 0)
    pct = n / total_classified * 100
    bar = "#" * int(pct / 3)
    print(f"  {label:<12}: {n:>4}  ({pct:5.1f}%)  {bar}")

print(f"\n{'SUMMARY ASSESSMENT':}")
print(SEP2)
benchmarks = {
    'Architecture α ≥ 0.70'    : alpha_arch >= 0.70,
    'Execution α ≥ 0.70'       : alpha_exec >= 0.70,
    'Context SB-2 ≥ 0.60'      : sb_ctx >= 0.60,
    'All CIT ≥ 0.30'           : all(np.concatenate([cit_arch,cit_exec,cit_ctx]) >= 0.30),
    'Inter-domain r < 0.70'    : all([r_ae<0.70, r_ac<0.70, r_ec<0.70]),
    'All convergent valid'      : all(
        np.corrcoef(item, own)[0,1] > max(np.corrcoef(item,d2)[0,1], np.corrcoef(item,d3)[0,1])
        for item, own, d2, d3 in items_labeled.values()),
    'PCA factors = 3'          : (eigenvalues_sorted > 1.0).sum() == 3,
    'PE > MMAS criterion r'    : r_pe_gold > r_mmas_gold,
}
for criterion, passed in benchmarks.items():
    mark = "PASS" if passed else "FAIL"
    icon = "[+]" if passed else "[-]"
    print(f"  {icon} {mark}  {criterion}")

passed_n = sum(benchmarks.values())
print(f"\n  {passed_n}/{len(benchmarks)} benchmarks met")
print(f"{SEP2}\n")
