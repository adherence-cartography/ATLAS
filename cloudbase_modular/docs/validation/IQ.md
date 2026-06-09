# Installation Qualification (IQ)
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-IQ-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.  
**System:** ATLAS v8 — cloudbase_modular

---

## 1. Purpose

This Installation Qualification (IQ) document verifies that the ATLAS platform components required for 21 CFR Part 11 compliance are installed, configured, and ready for operational qualification. IQ confirms that each component is present with the correct version and configuration, not that it functions correctly (that is OQ's scope).

---

## 2. Scope

This IQ covers the front-end web application hosted at `cloudbase_modular/`, the AWS Lambda backend, and the data storage infrastructure.

---

## 3. Platform Components

### 3.1 Firebase SDK

| Item | Specification |
|------|--------------|
| SDK Version | Firebase JavaScript SDK compat/9 (firebase-app-compat, firebase-auth-compat, firebase-database-compat) |
| CDN Source | `https://www.gstatic.com/firebasejs/9.x.x/` |
| Auth method | Firebase Authentication (email/password + anonymous + custom token) |
| Database | Firebase Realtime Database — primary clinical data store during dual-write transition |
| Acceptance criterion | `firebase.auth()` and `firebase.database()` resolve without error on page load |

### 3.2 AWS Lambda

| Item | Specification |
|------|--------------|
| Runtime | Node.js 20.x |
| Region (primary) | us-east-1 (N. Virginia) |
| Region (UAE residency) | me-central-1 (Abu Dhabi) |
| Function URL | `https://fv3y62xuce6w3t37oj73x5gzcq0uwdqo.lambda-url.us-east-1.on.aws` |
| Endpoints used | `/db` (dual-write), `/validate-key` (workspace auth), `/verify-otp` (MFA) |
| Auth method | Firebase ID token (Bearer) passed in `Authorization` header |
| Acceptance criterion | POST to `/validate-key` with a valid SSM key returns `{ valid: true, token: "..." }` within 12 seconds |

### 3.3 AWS DynamoDB

| Item | Specification |
|------|--------------|
| Region (primary) | us-east-1 |
| Region (UAE) | me-central-1 |
| Tables | `atlas_assessments`, `atlas_peacs`, `atlas_audit_log` (exact names per Lambda deployment) |
| Write strategy | Dual-write — every write goes to both Firebase and DynamoDB |
| Acceptance criterion | After a test MMAS-8 submission, the corresponding item appears in the DynamoDB `atlas_assessments` table |

### 3.4 Firebase Realtime Database

| Item | Specification |
|------|--------------|
| Database URL | Configured in `firebase-config.js` (not published in source) |
| Security Rules | Authenticated writes required for `assessments`, `peacs_assessments`, `audit_log`, `esignatures` |
| Acceptance criterion | Anonymous signInAnonymously() succeeds; authenticated writes to `assessments` succeed |

### 3.5 Firebase Authentication

| Item | Specification |
|------|--------------|
| Providers enabled | Anonymous, Email/Password, Custom Token |
| Email/Password | Required for e-signature re-authentication (`esignature.js`) |
| Custom Token | Used for workspace key grant flows (`auth-workspace.js`) |
| Acceptance criterion | `firebase.auth().signInWithEmailAndPassword(email, password)` resolves for a valid researcher account |

---

## 4. ATLAS Module File Inventory

| Module | Path | Purpose |
|--------|------|---------|
| `db-shim.js` | `modules/db-shim.js` | Dual-write shim. Presents Firebase `database.ref()` API; routes writes to both Firebase and DynamoDB. Contains CFR11_AUDIT_TABLES, `_sha256`, `_cfr11Audit`. |
| `auth-workspace.js` | `modules/auth-workspace.js` | Workspace key validation, Firebase sign-in flows. Contains 30-min inactivity timeout (CFR-11 §11.10(f)) and LOGIN_FAILURE audit logging. |
| `superadmin-workspace.js` | `modules/superadmin-workspace.js` | Mission Control UI. Contains `_saRenderAuditLog()`, `_alLoad()`, `_alApplyFilter()`, `_alRenderTable()` (Audit Log tab) and CFR-11 e-signature wiring in `_rlConfirmDelete()`. |
| `admin-panel.js` | `modules/admin-panel.js` | PI/institution admin dashboard. Workspace-scoped data views. |
| `assess.html` | `assess.html` | Patient assessment page. Contains `submitMMAS()`, `_submitMMASCore()`, `submitMAP()`, `_submitMAPCore()`. E-signature wired for researcher sessions. |
| `esignature.js` | `modules/esignature.js` | 21 CFR Part 11 §11.100/§11.200 electronic signature modal. Exposes `window._eSign(opts)`. Self-contained — depends only on globally-available `firebase` and `database`. |

---

## 5. Configuration Items

### 5.1 Dual-Write Strategy

Defined in `modules/db-shim.js`:

- **`DYNA_PATHS`** (Set): `assessments`, `peacs_assessments`, `peacs_dimensions`, `peacs_dimension_history`, `audit_log`, `ws_audit` — all paths in this Set are written to DynamoDB in addition to Firebase.
- **`PATH_TO_OP`** (Map): Maps Firebase path names to Lambda operation codes (`push_assessment`, `push_peacs`, `set_peacs_dim`, `push_audit`).
- **Lambda URL**: `https://fv3y62xuce6w3t37oj73x5gzcq0uwdqo.lambda-url.us-east-1.on.aws` — hardcoded in `db-shim.js` and `auth-workspace.js`.

### 5.2 CFR11_AUDIT_TABLES

Defined in `modules/db-shim.js`:

```javascript
const CFR11_AUDIT_TABLES = new Set(['assessments','peacs_assessments','mapData']);
```

Any `.push()` or `.set()` call via `atlasDB()` for these tables automatically triggers a `_cfr11Audit('CREATE', ...)` or `_cfr11Audit('UPDATE', ...)` entry in `audit_log`.

### 5.3 Session Timeout

Configured in `modules/auth-workspace.js`:

```javascript
var TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

Events that reset the idle timer: `click`, `keydown`, `mousemove`, `scroll`, `touchstart`. On timeout: writes `SESSION_TIMEOUT` audit entry, calls `firebase.auth().signOut()`, redirects to `?session=timeout`.

### 5.4 E-Signature Configuration

`modules/esignature.js` — no external configuration required. Uses globally-available `firebase` and `database`. Called via `window._eSign(opts)`.

---

## 6. Installation Acceptance Criteria

| ID | Check | Pass Condition |
|----|-------|---------------|
| IQ-01 | All module files present | All 6 modules listed in §4 exist at their specified paths |
| IQ-02 | Firebase SDK loads | `typeof firebase !== 'undefined'` evaluates to `true` on page load |
| IQ-03 | `atlasDB` global exposed | `typeof atlasDB === 'function'` evaluates to `true` after db-shim.js loads |
| IQ-04 | `_eSign` global exposed | `typeof _eSign === 'function'` evaluates to `true` after esignature.js loads |
| IQ-05 | Firebase connection | `database.ref('.info/connected').once('value')` returns `true` |
| IQ-06 | Lambda reachable | POST to `${LAMBDA_URL}/validate-key` returns HTTP 200 or 400 (not network error) |
| IQ-07 | DynamoDB dual-write | After one test write via `atlasDB('assessments').push(testObj)`, item visible in DynamoDB table |
| IQ-08 | Audit log writable | After IQ-07, `database.ref('audit_log').orderByChild('cfr11').equalTo(true)` returns at least 1 entry |
| IQ-09 | Console clean | No JavaScript errors in browser console on page load of `assess.html` or the Mission Control overlay |

---

## 7. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| System Owner / PI | Philip Morisky | | |
| Technical Reviewer | | | |

---

*This document is part of the ATLAS 21 CFR Part 11 validation package. Retain indefinitely per REQ-RET-001.*

---

## Document Sign-Off — Installation Qualification

This Installation Qualification document certifies that the ATLAS platform (v8.9.3) has been installed in accordance with the vendor's specifications and that all components are present and functional as described herein.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Authorized Representative / Principal Investigator | | _______________________ | __________ |
| Quality Reviewer | | _______________________ | __________ |
| Technical Reviewer | | _______________________ | __________ |

**Approval Status:** ☐ Approved ☐ Approved with Conditions ☐ Rejected — Requires Revision

**Conditions / Comments:**

_______________________________________________________________________

_______________________________________________________________________

*Per 21 CFR Part 11 §11.10(a), this signed document certifies that the system described herein is validated for its intended use.*
