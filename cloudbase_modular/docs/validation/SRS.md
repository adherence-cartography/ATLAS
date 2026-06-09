# System Requirements Specification (SRS)
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-SRS-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.

---

## 1. Purpose

This SRS defines the requirements for 21 CFR Part 11 compliance of the ATLAS platform. Requirements are numbered and categorised by compliance domain. Each requirement specifies the applicable CFR 11 section, a verifiable acceptance criterion, and its code location.

---

## 2. Audit Trail Requirements

### REQ-AUD-001
**Statement:** Every CREATE operation on a patient data table (`assessments`, `peacs_assessments`, `mapData`) shall generate an audit log entry in `audit_log` with `cfr11: true` and `action: "CREATE"`.  
**CFR 11 Section:** §11.10(e) — use of audit trails  
**Code location:** `modules/db-shim.js` — `push()` method, `CFR11_AUDIT_TABLES`, `_cfr11Audit('CREATE', ...)`  
**Acceptance criterion:** A call to `atlasDB('assessments').push(data)` produces one `audit_log` entry with `action: "CREATE"` and `table: "assessments"` within 5 seconds.

### REQ-AUD-002
**Statement:** Every UPDATE operation on a patient data table shall generate an audit log entry with `action: "UPDATE"`.  
**CFR 11 Section:** §11.10(e)  
**Code location:** `modules/db-shim.js` — `set()` method, `CFR11_AUDIT_TABLES`, `_cfr11Audit('UPDATE', ...)`  
**Acceptance criterion:** A call to `atlasDB('assessments').set(data)` produces one `audit_log` entry with `action: "UPDATE"`.

### REQ-AUD-003
**Statement:** Every DELETE operation on a patient data record shall generate an audit log entry with `action: "DELETE"`, including the `record_id` (Firebase key) of the deleted record.  
**CFR 11 Section:** §11.10(e)  
**Code location:** `modules/superadmin-workspace.js` — `_rlExecuteDelete(sigId)`, the `db.ref('audit_log').push(...)` call inside the delete loop  
**Acceptance criterion:** After `_rlExecuteDelete()` completes for key K, `audit_log` contains an entry with `action: "DELETE"` and `record_id: K`.

### REQ-AUD-004
**Statement:** Every audit log entry shall contain at minimum: `cfr11: true`, `action`, `table`, `actor_uid`, `actor_email`, `timestamp_utc` (ISO 8601), `client_ts` (Unix ms).  
**CFR 11 Section:** §11.10(d) — date, time, and operator  
**Code location:** `modules/db-shim.js` — `_cfr11Audit()` entry object construction  
**Acceptance criterion:** Spot-check any 10 audit entries — all 7 required fields are present and non-null.

### REQ-AUD-005
**Statement:** Audit log entries shall be append-only. The system shall not provide any UI mechanism to modify or delete `audit_log` records. Firebase Security Rules shall deny `write` (not `push`) on `audit_log`.  
**CFR 11 Section:** §11.10(e) — computer-generated, time-stamped audit trails  
**Code location:** Firebase Security Rules (configured in Firebase Console, not in the codebase). No `audit_log` delete operation exists in any ATLAS module.  
**Acceptance criterion:** Attempting `database.ref('audit_log').child(key).remove()` from the browser console returns a `PERMISSION_DENIED` error.

### REQ-AUD-006
**Statement:** The audit log shall include a SHA-256 hash (`payload_hash`) of the data payload at the time of the audited operation.  
**CFR 11 Section:** §11.10(b) — ability to discern invalid or altered records  
**Code location:** `modules/db-shim.js` — `_sha256()`, `_cfr11Audit()` entry construction  
**Acceptance criterion:** Every audit entry has a `payload_hash` field containing a 64-character hexadecimal string. Recomputing `SHA-256(JSON.stringify(payload))` using Web Crypto API matches the stored hash.

---

## 3. Electronic Signature Requirements

### REQ-SIG-001
**Statement:** The system shall implement a two-component electronic signature consisting of the user's email address (automatically supplied from Firebase Auth) and a password (re-entered at signing time).  
**CFR 11 Section:** §11.200(a)(1) — two distinct identification components  
**Code location:** `modules/esignature.js` — `_eSign()`, `firebase.auth().signInWithEmailAndPassword(email, password)`  
**Acceptance criterion:** The signature modal requires password entry even when the user is already authenticated. Signing without a password is blocked by the modal validation.

### REQ-SIG-002
**Statement:** Every electronic signature shall be linked to the record it authorises via a `signature_id` field on both the signed record and the corresponding `audit_log` entry.  
**CFR 11 Section:** §11.50(a) — signature manifestations  
**Code location:** `assess.html` — `_submitMMASCore(signatureId)` and `_submitMAPCore(signatureId)` set `full.signature_id` / `mapPayload.signature_id`; `superadmin-workspace.js` — `_rlExecuteDelete(sigId)` passes `sigId` to audit entry  
**Acceptance criterion:** After a signed MMAS-8 submission, the `assessments` record contains `signature_id`; the corresponding `audit_log` entry for the same `client_ts` also contains `signature_id`.

### REQ-SIG-003
**Statement:** The meaning of each electronic signature shall be captured and stored in the `esignatures` record at signing time.  
**CFR 11 Section:** §11.50(a) — printed name, date/time, meaning  
**Code location:** `modules/esignature.js` — `meaningEl.value` written to `database.ref('esignatures').push({..., meaning: ...})`  
**Acceptance criterion:** The `esignatures` Firebase record contains a non-empty `meaning` string matching the text displayed/edited in the modal.

### REQ-SIG-004
**Statement:** The date and time of the signature shall be auto-populated from the client clock at modal open time and stored as `timestamp_utc` (ISO 8601). The user shall not be able to edit the date/time field.  
**CFR 11 Section:** §11.50(a) — date/time  
**Code location:** `modules/esignature.js` — `const now = new Date().toISOString()` set at function entry; rendered in the modal as a read-only display `<div>`, not an editable `<input>`  
**Acceptance criterion:** The date/time shown in the modal matches the system clock within ±2 seconds. The date/time field is not an editable HTML input.

---

## 4. Access Control Requirements

### REQ-ACC-001
**Statement:** Each user of the system shall have a unique, non-reusable identifier. The system shall use Firebase Authentication UIDs as unique user identifiers.  
**CFR 11 Section:** §11.100(a) — unique user identification  
**Code location:** `modules/auth-workspace.js` — Firebase Auth UID stored in every audit entry via `user.uid`; `modules/db-shim.js` — `_cfr11Audit()` captures `actor_uid: user?.uid`  
**Acceptance criterion:** Two different workspace logins produce two different `actor_uid` values in their respective audit entries.

### REQ-ACC-002
**Statement:** Access to patient data tables, the Audit Log viewer, and the Data Ledger shall be restricted by role. Only users with `role: "superadmin"` in their workspace profile may access the Audit Log tab and delete records.  
**CFR 11 Section:** §11.10(g) — use of authority checks  
**Code location:** `modules/superadmin-workspace.js` — `_ATLAS_MODULES.auditlog.roles: ['superadmin']`; `saTab()` checks `tab.roles.includes(_saCurrentRole)` before rendering  
**Acceptance criterion:** Calling `saTab('auditlog')` with `_saCurrentRole !== 'superadmin'` does not render the Audit Log module.

### REQ-ACC-003
**Statement:** The system shall automatically sign out an inactive user after 30 minutes of inactivity and log a `SESSION_TIMEOUT` audit entry.  
**CFR 11 Section:** §11.10(f) — use of terminal controls  
**Code location:** `modules/auth-workspace.js` — IIFE at bottom: `TIMEOUT_MS = 30 * 60 * 1000`, event listeners for `click`, `keydown`, `mousemove`, `scroll`, `touchstart`  
**Acceptance criterion:** After 30 minutes with no user events, `firebase.auth().signOut()` is called and `window.location.href` is set to `?session=timeout`.

### REQ-ACC-004
**Statement:** Failed login attempts shall be logged in `audit_log` with `action: "LOGIN_FAILURE"` and the entered key or email.  
**CFR 11 Section:** §11.10(f)  
**Code location:** `modules/auth-workspace.js` — `submitWorkspaceCode()` else branch after failed `validateWorkspaceCode()`  
**Acceptance criterion:** Entering an invalid workspace key produces an `audit_log` entry with `action: "LOGIN_FAILURE"` and `actor_email: <entered_key>`.

---

## 5. Record Integrity Requirements

### REQ-INT-001
**Statement:** The system shall compute a SHA-256 hash of each patient data record's JSON payload at the time of write.  
**CFR 11 Section:** §11.10(b) — protection of records to enable their accurate and ready retrieval  
**Code location:** `modules/db-shim.js` — `_sha256(JSON.stringify(payload || {}))` called inside `_cfr11Audit()`  
**Acceptance criterion:** `_sha256(JSON.stringify(testObj))` returns a 64-character hex string. Calling it twice with identical inputs returns identical hashes.

### REQ-INT-002
**Statement:** The payload hash shall be stored in the `audit_log` entry as `payload_hash` for every CREATE and UPDATE operation on CFR-11 audit tables.  
**CFR 11 Section:** §11.10(b)  
**Code location:** `modules/db-shim.js` — `_cfr11Audit()`: `payload_hash: hash` in the `entry` object  
**Acceptance criterion:** Every `audit_log` entry with `action: "CREATE"` or `action: "UPDATE"` on `assessments`, `peacs_assessments`, or `mapData` contains a non-empty `payload_hash`.

### REQ-INT-003
**Statement:** The payload hash stored in `audit_log` shall be independently verifiable by recomputing `SHA-256(JSON.stringify(record))` from the stored record and comparing it against the `payload_hash` in the audit entry with the matching `client_ts`.  
**CFR 11 Section:** §11.10(b)  
**Code location:** Comment in `modules/db-shim.js` after `_cfr11Audit` definition: "Cross-verify: recompute hash from record and compare against audit_log entry for the same client_ts."  
**Acceptance criterion:** For any assessment record R, the `audit_log` entry with `table: R.table` and `client_ts: R.timestamp` contains a `payload_hash` equal to `SHA-256(JSON.stringify(R_without_payload_hash))`.

---

## 6. Retention Requirements

### REQ-RET-001
**Statement:** Audit log records in `audit_log` shall be retained indefinitely. No automated purge or TTL policy shall be applied to this Firebase path.  
**CFR 11 Section:** §11.10(d) — audit trails shall be retained  
**Code location:** Firebase Security Rules — no delete rules on `audit_log`; no ATLAS code deletes from `audit_log`  
**Acceptance criterion:** Firebase RTDB `audit_log` path has no expiry rules in the Security Rules configuration.

### REQ-RET-002
**Statement:** Patient assessment records in `assessments`, `peacs_assessments`, and `mapData` shall be retained for a minimum of 2 years from the date of creation, per the study protocol.  
**CFR 11 Section:** Applicable 21 CFR Part 312 and institutional study protocol  
**Code location:** Firebase Security Rules; operational policy. The ATLAS system does not auto-delete records — deletion is a manual, superadmin-only, e-signed operation (REQ-SIG-001).  
**Acceptance criterion:** Records older than 6 months remain accessible in Data Ledger. No automatic deletion job exists in the Lambda codebase.

---

*End of SRS. All requirements are traceable in RTM.md.*
