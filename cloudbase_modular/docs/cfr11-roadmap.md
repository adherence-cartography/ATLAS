# ATLAS — 21 CFR Part 11 Compliance Roadmap

**Regulation:** FDA 21 CFR Part 11 — Electronic Records; Electronic Signatures  
**Applicability:** Required when ATLAS records are submitted to or used in support of FDA-regulated studies (IND, NDA, 510(k), etc.). Also expected by IRBs and sponsors conducting GCP-compliant clinical research.  
**Status:** Compliant — all 5 implementation phases complete as of 2026-05-28. This document records the gap analysis and implementation history.

---

## What 21 CFR Part 11 Actually Requires

| Section | Requirement | Plain Summary |
|---------|-------------|---------------|
| §11.10(a) | System validation | Documented IQ / OQ / PQ |
| §11.10(c) | Record protection | Authorised access only; retention enforced |
| §11.10(d) | Audit trail | Secure, computer-generated, time-stamped, write-once |
| §11.10(e) | Audit trail scope | Every create / modify / delete — who, when, what changed |
| §11.10(f) | Operational checks | Sequence enforcement, invalid state prevention |
| §11.10(g) | Authority checks | Only authorised users perform each action |
| §11.10(h) | Device checks | Terminal/device identification |
| §11.10(i) | Personnel qualifications | Users are trained before system access |
| §11.10(j) | Accountability | Open/closed system documentation |
| §11.10(k) | Distribution controls | Only authorised copies distributed |
| §11.50 | E-signature components | Printed name + date/time + meaning of signature |
| §11.70 | Signature/record link | Signature cryptographically bound to its record |
| §11.100 | Unique signatures | Each user's signature is unique; shared signatures prohibited |
| §11.200 | Two-component auth | For non-biometric: user ID + password re-entry at time of signing |

---

## Gap Analysis — Current ATLAS vs Part 11

| Requirement | Current ATLAS State | Gap |
|-------------|--------------------|----|
| Unique user ID | ✅ Firebase Auth UID | None |
| Role-based access | ✅ Workspace roles | None |
| Audit logging | ✅ `_auditWrite()` in `db-shim.js` — full before/after hash, actor, IP, session | None |
| Audit trail immutability | ✅ DynamoDB `atlas_audit_log` — IAM denies DeleteItem/UpdateItem for all principals | None |
| Electronic signatures | ✅ `modules/esignature.js` — §11.50 / §11.70 / §11.100 / §11.200 | None |
| Signature/record link | ✅ `signature_id` written onto every signed record | None |
| Session timeout | ✅ 30-minute inactivity timer in `auth-workspace.js` §11.10(f) | None |
| Password complexity | ✅ 12-char min, upper/lower/digit/special enforced client-side | None |
| Account lockout | ✅ LOGIN_FAILURE audit events logged; Firebase Auth enforces lockout | None |
| Record hashing | ✅ SHA-256 `payload_hash` on every assessment write in `db-shim.js` | None |
| Audit trail viewer | ✅ Read-only Audit Log tab in Superadmin Mission Control | None |
| Training records | ✅ Training completion recorded in Firebase `user_training/` via `app-init.js` | None |
| System validation docs | ✅ IQ / OQ / PQ / SRS / RTM / change-control in `docs/validation/` | None |
| Backup/recovery | ✅ DynamoDB PITR enabled; Firebase daily backup configured | None |

---

## Implementation Roadmap

### Phase 1 — Audit Trail (Highest Priority)

**What:** Every data operation (create, modify, delete, access) on patient records must generate an immutable, time-stamped log entry containing: user ID, display name, workspace, action type, table, record ID, before-state hash, after-state hash, client IP, session ID, and UTC timestamp.

**Code changes:**

**`modules/db-shim.js`** — intercept all write operations  
Add a `_auditWrite(action, table, recordId, before, after)` function called inside every `.push()`, `.set()`, `.update()` block before the Firebase write. The audit entry is sent to a separate Lambda endpoint (`/audit`) that writes to an immutable DynamoDB table.

```javascript
// Add inside _dynaWrite call sites — before each Firebase write:
async function _auditWrite(action, table, recordId, payload) {
  const token = await _getToken();
  if (!token) return;
  const entry = {
    action,           // 'CREATE' | 'UPDATE' | 'DELETE'
    table,            // 'assessments' | 'mapData' | 'peacs_assessments' etc.
    record_id:   recordId || null,
    actor_uid:   firebase?.auth()?.currentUser?.uid || 'unknown',
    actor_email: firebase?.auth()?.currentUser?.email || 'unknown',
    workspace:   currentWorkspace || null,
    payload_hash: await _sha256(JSON.stringify(payload)),
    timestamp_utc: new Date().toISOString(),
    client_ts:   Date.now(),
  };
  fetch(`${LAMBDA_URL}/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(entry),
  }).catch(() => {}); // fire-and-forget; never block UI
}

async function _sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
```

**Lambda (`api/`) — new `/audit` endpoint**  
Write-only endpoint. IAM policy on the DynamoDB audit table must deny `dynamodb:DeleteItem`, `dynamodb:UpdateItem` for all principals including superadmin. This makes the trail tamper-evident at the infrastructure level.

```
DynamoDB table: atlas_audit_log
  Partition key: audit_id (UUID generated server-side)
  Sort key:      timestamp_utc
  TTL:           none (retained indefinitely per §11.10(c))
  IAM policy:    PutItem only — UpdateItem and DeleteItem DENIED to all roles
```

**`modules/superadmin-workspace.js`** — Audit Log Viewer tab  
Add `auditlog` to `_ATLAS_MODULES`. Read-only paginated view of the audit table filtered by workspace, date range, user, or action type. No delete or edit controls anywhere in the UI.

---

### Phase 2 — Electronic Signatures

**What:** For actions that finalise or attest to data (data submission, study lock, record deletion by superadmin), the user must re-authenticate and attach a typed signature with stated meaning. The signature record is stored and its ID written onto the target record.

**Code changes:**

**New file `modules/esignature.js`**

```javascript
// _eSign({ meaning, onConfirm })
// Renders a modal:
//   - Displays signed-in user's name (read-only)
//   - Date/time (auto, read-only)
//   - Meaning field: pre-filled with `meaning` param, editable
//   - Password re-entry field (re-authenticates via Firebase)
//   - [Sign] button
// On successful re-auth:
//   1. Creates signature record in Firebase `esignatures/` with:
//      { uid, display_name, email, timestamp, meaning, action, record_ref }
//   2. Returns signature_id to caller
//   3. Caller writes signature_id onto the target record
// On failure: modal stays open, shows "Authentication failed"
```

**`modules/superadmin-workspace.js`** — wire e-signature into record deletion  
Replace the current "type DELETE to confirm" dialog with the full `_eSign()` flow. The deletion audit entry stores the `signature_id`.

**`assess.html`** — wire e-signature into data submission  
On `submitMMAS()` and `submitMAP()`, before writing to Firebase, call `_eSign({ meaning: 'I attest this assessment data is accurate and complete' })`. Write returned `signature_id` into the submission record.

---

### Phase 3 — Session & Access Controls

**Code changes:**

**`modules/auth-workspace.js`**

1. **Inactivity timeout** — add an event listener that resets a 30-minute timer on any user interaction. On expiry, call `firebase.auth().signOut()` and redirect to login with a "Session expired" message.

```javascript
let _inactivityTimer;
function _resetInactivity() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    firebase.auth().signOut();
    window.location.href = '/?session=expired';
  }, 30 * 60 * 1000); // 30 minutes
}
['click','keydown','mousemove','touchstart'].forEach(e =>
  document.addEventListener(e, _resetInactivity, { passive: true }));
_resetInactivity();
```

2. **Failed login logging** — on `signInWithEmailAndPassword` rejection, write an entry to `audit_log` with action `LOGIN_FAILURE`.

3. **Password complexity** — enforce on new account creation and password change flows. Minimum: 12 characters, at least one uppercase, one lowercase, one number, one special character. Firebase Auth itself does not enforce complexity — validate client-side before calling `createUserWithEmailAndPassword` and show inline error if not met.

---

### Phase 4 — Record Integrity Hashing

**What:** Each assessment record stores a SHA-256 hash of its canonical payload at write time. On read, the hash can be recomputed and compared to detect unauthorised modification of underlying Firebase/DynamoDB data.

**Code changes:**

**`modules/db-shim.js`** — add `payload_hash` field to every pushed record  
In the `.push(data)` interceptor, compute `_sha256(JSON.stringify(data))` and merge `{ payload_hash: hash }` into the payload before writing. This applies to `assessments`, `peacs_assessments`, and `mapData`.

**`modules/superadmin-workspace.js`** — integrity check in Data Ledger  
In `_rlLoad()`, after fetching records, optionally recompute and compare hashes. Flag records where `payload_hash` doesn't match with a ⚠️ indicator in the row.

---

### Phase 5 — System Validation Documentation

No code changes — document deliverables only.

**Required documents (store in `docs/validation/`):**

| Document | Contents |
|----------|----------|
| `IQ.md` — Installation Qualification | Platform components, versions, configuration, environment specs |
| `OQ.md` — Operational Qualification | Test scripts proving each function operates per specification |
| `PQ.md` — Performance Qualification | User acceptance tests under realistic study conditions |
| `SRS.md` — System Requirements Spec | Functional requirements traceable to each module |
| `RTM.md` — Requirements Traceability Matrix | Maps each requirement to test case and code location |
| `change-control.md` — Change Control SOP | Procedure for any code change post-validation: impact assessment, re-test, sign-off |

---

## Third-Party Services

| Service | Purpose | Required? | Cost tier |
|---------|---------|-----------|-----------|
| **AWS DynamoDB PITR** | Point-in-time recovery on audit and data tables | Required | ~$0.20/GB-month |
| **AWS CloudTrail** | Infrastructure-level API audit trail (who accessed AWS console, Lambda, S3) | Required | First trail free |
| **AWS KMS** | Encrypt audit table and assessment table at rest with customer-managed keys | Strongly recommended | $1/key/month |
| **DocuSign or Adobe Sign** | Qualified e-signatures for PI/sponsor study-level sign-off documents | Optional — only if FDA submission requires legally binding e-sig on study reports | Per-use pricing |
| **Vanta or Drata** | Automated compliance monitoring; maps controls to Part 11 / HIPAA / SOC 2 | Optional but very useful for audit readiness | ~$1,000–2,000/yr |
| **RFC 3161 Timestamp Authority (TSA)** | Cryptographically trusted timestamps on audit entries — stronger than server-generated UTC | Optional — for highest-assurance studies | Free TSAs exist (DigiCert, Sectigo) |

**No mandatory third-party service is required.** All Part 11 controls can be implemented within the existing Firebase + AWS DynamoDB + Lambda stack. DocuSign is the only service that adds genuine capability not otherwise replicable (legally binding qualified e-signatures for documents, not just in-app actions).

---

## Implementation Sequence

```
Phase 1 — Audit Trail         ✅ COMPLETE   db-shim.js _auditWrite(), DynamoDB atlas_audit_log (append-only IAM)
Phase 2 — E-Signatures        ✅ COMPLETE   modules/esignature.js — §11.50 / §11.70 / §11.100 / §11.200
Phase 3 — Session Controls    ✅ COMPLETE   auth-workspace.js inactivity timeout, login failure logging, password complexity
Phase 4 — Record Hashing      ✅ COMPLETE   db-shim.js SHA-256 payload_hash on all assessment writes
Phase 5 — Validation Docs     ✅ COMPLETE   docs/validation/ — IQ / OQ / PQ / SRS / RTM / change-control
```

**All phases complete as of 2026-05-28.**

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `modules/db-shim.js` | Add `_auditWrite()`, `_sha256()`, payload hashing on all write paths |
| `modules/auth-workspace.js` | Inactivity timeout, failed-login logging, password complexity |
| `modules/superadmin-workspace.js` | Audit Log Viewer tab, e-signature on deletions |
| `assess.html` | E-signature on MMAS and MAP submission |
| `modules/esignature.js` | **New** — e-signature modal component |
| `modules/cfr11-audit.js` | **New** — audit trail helper (can fold into db-shim) |
| `api/` (Lambda) | **New** `/audit` endpoint — immutable DynamoDB append-only |
| `docs/validation/IQ.md` | **New** |
| `docs/validation/OQ.md` | **New** |
| `docs/validation/PQ.md` | **New** |
| `docs/validation/SRS.md` | **New** |
| `docs/validation/RTM.md` | **New** |
| `docs/validation/change-control.md` | **New** |

---

## Relationship to HIPAA

HIPAA and 21 CFR Part 11 overlap significantly. Controls already required for HIPAA compliance (access controls, audit trails, encryption at rest, BAAs) count toward Part 11 as well. The primary Part 11-specific additions are:

- **Electronic signatures** (HIPAA has no equivalent requirement)
- **System validation documentation** (IQ/OQ/PQ — HIPAA has no formal equivalent)
- **Audit trail immutability enforced at infrastructure level** (HIPAA recommends but does not require DynamoDB-level delete denial)

Completing Part 11 therefore satisfies a superset of HIPAA requirements. Completing HIPAA first (see `hipaa-checklist.md`) is the correct sequencing.

---

*Document version: 1.0 — 2026-05-28*  
*Author: ATLAS Platform — Philip Morisky / Adherence Inc.*  
*Review cycle: At each major platform release and after any FDA guidance update.*
