# Requirements Traceability Matrix (RTM)
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-RTM-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.

---

## Instructions

This matrix traces every SRS requirement to its:
- CFR 11 section
- Exact code location (file:function/line)
- OQ test case
- Current validation status

Update the Status column after each test execution cycle.

---

## Audit Trail Requirements

| Req ID | Description | CFR 11 Section | Code Location | OQ Test Case | Status |
|--------|-------------|----------------|---------------|--------------|--------|
| REQ-AUD-001 | CREATE on `assessments`/`peacs_assessments`/`mapData` generates audit entry | §11.10(e) | `modules/db-shim.js`: `push()` method — `CFR11_AUDIT_TABLES` check + `_cfr11Audit('CREATE', root, null, data)` | TC-OQ-003 | Pending |
| REQ-AUD-002 | UPDATE on patient tables generates audit entry with `action: "UPDATE"` | §11.10(e) | `modules/db-shim.js`: `set()` method — `CFR11_AUDIT_TABLES` check + `_cfr11Audit('UPDATE', root, segments[0], data)` | TC-OQ-003 | Pending |
| REQ-AUD-003 | DELETE generates audit entry with `record_id` of deleted record | §11.10(e) | `modules/superadmin-workspace.js`: `_rlExecuteDelete(sigId)` — `db.ref('audit_log').push({action:'DELETE', record_id:key, ...})` | TC-OQ-007 | Pending |
| REQ-AUD-004 | All audit entries contain 7 required fields (cfr11, action, table, actor_uid, actor_email, timestamp_utc, client_ts) | §11.10(d) | `modules/db-shim.js`: `_cfr11Audit()` — `entry` object construction | TC-OQ-003 | Pending |
| REQ-AUD-005 | Audit log is append-only; no delete mechanism in UI or code | §11.10(e) | No `audit_log` remove() call exists in any ATLAS module. Firebase Security Rules enforce append-only. | TC-OQ-003 (negative: verify no delete option) | Pending |
| REQ-AUD-006 | SHA-256 payload hash stored in every audit entry | §11.10(b) | `modules/db-shim.js`: `_sha256()` async function; `_cfr11Audit()` — `payload_hash: hash` in entry | TC-OQ-003 | Pending |

---

## Electronic Signature Requirements

| Req ID | Description | CFR 11 Section | Code Location | OQ Test Case | Status |
|--------|-------------|----------------|---------------|--------------|--------|
| REQ-SIG-001 | Two-component authentication: email (auto) + password (re-entered) | §11.200(a)(1) | `modules/esignature.js`: `_eSign()` — `firebase.auth().signInWithEmailAndPassword(email, passwordEl.value)` | TC-OQ-004 | Pending |
| REQ-SIG-002 | `signature_id` linked to signed record and audit entry | §11.50(a) | `assess.html`: `_submitMMASCore(signatureId)` line `if (signatureId) full.signature_id = signatureId`; `_submitMAPCore(signatureId)` line `if (signatureId) mapPayload.signature_id = signatureId`; `modules/superadmin-workspace.js`: `_rlExecuteDelete(sigId)` — audit entry `signature_id: sigId` | TC-OQ-004, TC-OQ-007 | Pending |
| REQ-SIG-003 | Meaning of signature captured in `esignatures` record | §11.50(a) | `modules/esignature.js`: `database.ref('esignatures').push({..., meaning: meaningEl.value, ...})` | TC-OQ-004 | Pending |
| REQ-SIG-004 | Date/time auto-populated and read-only | §11.50(a) | `modules/esignature.js`: `const now = new Date().toISOString()` at function entry; rendered as `<div>` not `<input>` | TC-OQ-004 | Pending |

---

## Access Control Requirements

| Req ID | Description | CFR 11 Section | Code Location | OQ Test Case | Status |
|--------|-------------|----------------|---------------|--------------|--------|
| REQ-ACC-001 | Unique Firebase UID per user | §11.100(a) | `modules/db-shim.js`: `_cfr11Audit()` — `actor_uid: user?.uid`; `modules/auth-workspace.js`: Firebase Auth UID assigned at sign-in | TC-OQ-006 | Pending |
| REQ-ACC-002 | Audit Log tab restricted to `superadmin` role | §11.10(g) | `modules/superadmin-workspace.js`: `_ATLAS_MODULES.auditlog.roles: ['superadmin']`; `saTab(tabId)` — `tab.roles.includes(_saCurrentRole)` guard | TC-OQ-006 | Pending |
| REQ-ACC-003 | 30-minute inactivity timeout with `SESSION_TIMEOUT` audit entry | §11.10(f) | `modules/auth-workspace.js`: IIFE at line ~2757 — `TIMEOUT_MS = 30 * 60 * 1000`; event listeners on `click`, `keydown`, `mousemove`, `scroll`, `touchstart`; on timeout: `database.ref('audit_log').push({action:'SESSION_TIMEOUT', ...})` | TC-OQ-005 | Pending |
| REQ-ACC-004 | Failed login logged to `audit_log` | §11.10(f) | `modules/auth-workspace.js`: `submitWorkspaceCode()` — else branch after failed `validateWorkspaceCode()`: `database.ref('audit_log').push({action:'LOGIN_FAILURE', actor_email:code, ...})` | TC-OQ-005 (negative test) | Pending |

---

## Record Integrity Requirements

| Req ID | Description | CFR 11 Section | Code Location | OQ Test Case | Status |
|--------|-------------|----------------|---------------|--------------|--------|
| REQ-INT-001 | SHA-256 hash computed for every patient data payload | §11.10(b) | `modules/db-shim.js`: `_sha256(str)` — Web Crypto API `crypto.subtle.digest('SHA-256', ...)`; called in `_cfr11Audit()` | TC-OQ-003 | Pending |
| REQ-INT-002 | Payload hash stored in `audit_log` entry as `payload_hash` | §11.10(b) | `modules/db-shim.js`: `_cfr11Audit()` — `entry.payload_hash = hash` | TC-OQ-003 | Pending |
| REQ-INT-003 | Hash independently verifiable by recomputation from stored record | §11.10(b) | Comment in `modules/db-shim.js` after `_cfr11Audit`: "Cross-verify: recompute hash from record and compare against audit_log entry for the same client_ts." Manual verification procedure in OQ-003. | TC-OQ-003 | Pending |

---

## Retention Requirements

| Req ID | Description | CFR 11 Section | Code Location | OQ Test Case | Status |
|--------|-------------|----------------|---------------|--------------|--------|
| REQ-RET-001 | Audit log retained indefinitely; no purge policy | §11.10(d) | No `audit_log` delete in any ATLAS module. Firebase Security Rules deny write/delete on `audit_log` children. | TC-OQ-003 (verify no delete button for audit entries) | Pending |
| REQ-RET-002 | Assessment records retained minimum 2 years | 21 CFR §312 / study protocol | No auto-delete Lambda job. Deletion is manual, superadmin-only, e-signed (`_rlConfirmDelete()` → `_eSign()` → `_rlExecuteDelete()`). | TC-OQ-007 (verify deletion requires e-signature) | Pending |

---

## Traceability Summary

| Domain | Total Requirements | IQ Verified | OQ Tested | PQ Confirmed |
|--------|--------------------|-------------|-----------|--------------|
| Audit Trail | 6 | — | — | — |
| E-Signature | 4 | — | — | — |
| Access Control | 4 | — | — | — |
| Record Integrity | 3 | — | — | — |
| Retention | 2 | — | — | — |
| **Total** | **19** | | | |

*Fill in IQ/OQ/PQ columns with Pass/Fail/N/A after each qualification cycle.*

---

*End of RTM. Maintain this matrix in sync with SRS.md on every change.*
