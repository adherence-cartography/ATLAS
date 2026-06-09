# tools/data-science

Standalone Python scripts for document generation and psychometric validation of the MAP (Multidimensional Adherence Parameters) instrument. These scripts are research and compliance tools — they do not run as part of the ATLAS platform at runtime.

---

## Scripts

### generate_agreement.py

**Purpose:** Generates the ATLAS Clinical Network Services Agreement as a formatted `.docx` file using the `python-docx` library.

**Output:** `ATLAS_AlThiqa_Network_Agreement_v2.docx` — a formal legal agreement document for the Al Thiqa Pharmacy Network (UAE) covering platform access, user tiers, fees, data protection, research collaboration, and governing law.

**Dependencies:**
```
pip install python-docx
```

**Usage:**
```bash
python generate_agreement.py
```

The output file is written to `C:\Users\philm\documents\ATLAS_AlThiqa_Network_Agreement_v2.docx`. Edit the `out` variable at the bottom of the script to change the output path before running.

**Notes:**
- Placeholder fields (e.g., `[DATE]`, `[ADDRESS]`, pharmacy location names) must be filled in before the document is used for execution
- Should be reviewed by qualified UAE legal counsel before signature
- MMAS-8 licensing terms (Section 8.2) should be confirmed with the instrument licensor prior to signature

---

### map_polychoric_validation.py

**Purpose:** Rigorous psychometric validation of the MAP tool using maximum-likelihood tetrachoric/polychoric correlation estimation and McDonald's omega reliability.

**Method:** Generates N=1,000 synthetic participants via a 3-factor IRT latent model (Architecture, Execution, Context domains with a weak general adherence factor). Computes:
- Full polychoric/tetrachoric correlation matrix (ML estimation via bivariate normal CDF optimization)
- Domain reliability: McDonald's omega and polychoric alpha for each domain
- Full-scale omega total and omega hierarchical
- Parallel analysis (200 simulations, 95th percentile threshold) for factor retention
- Bartlett's test of sphericity and KMO measure of sampling adequacy
- Discriminant validity: within-domain vs cross-domain polychoric r, Fornell-Larcker AVE criterion
- Criterion validity: PE score vs synthetic gold standard, compared to MMAS sum

**Dependencies:**
```
pip install numpy scipy
```

**Usage:**
```bash
python map_polychoric_validation.py
```

**Runtime:** Approximately 2–5 minutes (polychoric ML estimation for 28 item pairs is computationally intensive).

**Summary benchmarks checked (10 total):**
- Bartlett p < 0.001
- KMO >= 0.70
- Architecture and Execution omega >= 0.70
- Context Spearman-Brown >= 0.60
- All within-domain r > cross-domain r (discriminant validity)
- Fornell-Larcker AVE criterion (3/3 domains)
- Parallel analysis retains 3 factors
- Omega hierarchical >= 0.50
- PE score outperforms MMAS sum on criterion validity

---

### map_synthetic_validation.py

**Purpose:** Psychometric validation of the MAP tool using a simpler synthetic data approach with standard Pearson/Cronbach statistics. Faster than the polychoric script and suitable for quick validation checks or presentations.

**Method:** Generates N=500 synthetic participants via a 3-factor Beta-distribution latent model. Computes:
- Cronbach's alpha and Spearman-Brown (Context 2-item scale) for each domain
- Average inter-item correlation (AIC) for each domain
- Corrected item-total correlations
- Inter-domain Pearson correlations (discriminant validity)
- Convergent validity: each item should correlate more with its own domain than with other domains
- PCA eigenvalue analysis (Pearson proxy for polychoric structure)
- Criterion validity: PE score vs synthetic gold standard
- PE score distribution by tier (High/Medium/Low/Zero)
- INA/UNA/Mixed/Adherent classification balance

**Dependencies:**
```
pip install numpy scipy
```

**Usage:**
```bash
python map_synthetic_validation.py
```

**Runtime:** Under 10 seconds.

**Summary benchmarks checked (8 total):**
- Architecture alpha >= 0.70
- Execution alpha >= 0.70
- Context Spearman-Brown >= 0.60
- All corrected item-total correlations >= 0.30
- Inter-domain r < 0.70 (discriminant)
- All items show convergent validity (higher correlation with own domain)
- PCA factor count = 3
- PE score outperforms MMAS sum on criterion validity

---

## Relationship to ATLAS Validation Package

The psychometric validation results from these scripts support the scientific rationale for the MAP instrument's domain structure and scoring formula (PE = geometric mean of Architecture, Execution, Context). They are cited in the ATLAS System Requirements Specification (docs/validation/SRS.md) and may be included in IRB/ethics applications as supporting evidence for the instrument's validity.

The `generate_agreement.py` script is a business development tool for generating client agreements and is not part of the clinical validation package.

---

## Original File Locations

The canonical copies of these scripts are now in this `tools/data-science/` directory. The original copies at the project root (`generate_agreement.py`, `map_polychoric_validation.py`, `map_synthetic_validation.py`) may be deleted once this location is confirmed as the working copy.
