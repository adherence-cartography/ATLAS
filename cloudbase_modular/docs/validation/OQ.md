# Operational Qualification (OQ)
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-OQ-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.  
**Prerequisite:** IQ-001 passed (all acceptance criteria met)

---

## 1. Purpose

This OQ document defines test scripts that verify the ATLAS platform operates as specified under 21 CFR Part 11. Each test case specifies preconditions, inputs, execution steps, expected results, and acceptance criteria.

---

## 2. Test Environment

- Browser: Google Chrome (latest stable)
- Firebase project: ATLAS production (or staging — identical rules)
- Authenticated user: researcher account with `email/password` enabled in Firebase Auth
- Workspace key: a valid SSM-backed researcher workspace key

---

## TC-OQ-001: MMAS-8 Scoring Verification

**CFR reference:** Algorithmic accuracy (instrument integrity)  
**Code location:** `assess.html` — `submitMMAS()` / `_submitMMASCore()`, `getAdherenceCategory(score)`

### Test Cases

| Case | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Expected Score | Expected Category |
|------|----|----|----|----|----|----|----|----|---------------|-------------------|
| TC-OQ-001a | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 8.0 | High Adherence |
| TC-OQ-001b | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 | Low Adherence |
| TC-OQ-001c | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 7.0 | Medium-High Adherence |
| TC-OQ-001d | 1 | 0 | 1 | 1 | 0 | 1 | 0 | 1 | 5.0 | Medium Adherence |
| TC-OQ-001e | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 4.0 | Low-Medium Adherence |

**Steps:**
1. Open `assess.html` in test browser.
2. Advance to MMAS-8 screen.
3. Enter each test case's Q1–Q8 answers using the UI sliders/buttons.
4. Before submitting, open the browser console and type: `console.log(Object.values(mmasAnswers).reduce((a,b)=>a+b,0))` to verify the pre-submission score.
5. Submit and verify the result modal shows the expected score and category.

**Pass condition:** Computed score matches expected score exactly (no floating-point error > 0.01). Category label matches expected.

---

## TC-OQ-002: MAP Scoring Verification

**CFR reference:** Algorithmic accuracy  
**Code location:** `assess.html` — `submitMAP()` / `_submitMAPCore()`, `computeMAPPE()`

| Case | map_q1 | map_q2 | map_q3 | map_q4 | map_q5 | map_q6 | map_q7 | map_q8 | Expected Score | Expected PE |
|------|--------|--------|--------|--------|--------|--------|--------|--------|---------------|-------------|
| TC-OQ-002a | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 8.00 | 1.000 |
| TC-OQ-002b | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 | 4.00 | ~0.500 (A×E×C)^1/3 |
| TC-OQ-002c | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 4.00 | varies by domain |

**Steps:**
1. Open `assess.html?tool=map&consented=1`.
2. Answer all 8 MAP items per test case.
3. Click Submit.
4. Verify score shown in result modal matches expected.
5. Verify PE domain breakdown (Architecture = Q2+Q3+Q6/3, Execution = Q1+Q4+Q5+Q8/4, Context = Q7/1).

**Pass condition:** Total score within ±0.01 of expected. PE formula `(A × E × C)^(1/3)` computed correctly.

---

## TC-OQ-003: Audit Trail Generation

**CFR reference:** 21 CFR Part 11 §11.10(d)(e)  
**Code location:** `modules/db-shim.js` — `_cfr11Audit()`, `CFR11_AUDIT_TABLES`

**Precondition:** Researcher signed in with workspace key. `atlasDB` loaded.

**Steps:**
1. Open browser console on `assess.html`.
2. Execute: `atlasDB('assessments').push({ test: true, tool: 'mmas', score: 7, timestamp: Date.now() })`
3. Wait 2 seconds.
4. Execute: `database.ref('audit_log').orderByChild('cfr11').equalTo(true).limitToLast(5).once('value').then(s => console.log(JSON.stringify(s.val(), null, 2)))`
5. Examine the returned entries.

**Expected result:**
- At least one entry with `cfr11: true`, `action: "CREATE"`, `table: "assessments"`.
- Entry contains `actor_email` matching the signed-in researcher email.
- Entry contains `payload_hash` — a 64-character hex string (SHA-256).
- `timestamp_utc` is a valid ISO 8601 string within 5 seconds of the write.

**Pass condition:** All 5 fields present and correct. No duplicate entries for the single push.

---

## TC-OQ-004: E-Signature Flow

**CFR reference:** 21 CFR Part 11 §11.100, §11.200  
**Code location:** `modules/esignature.js` — `_eSign()`

### TC-OQ-004a: Successful signature

**Precondition:** User signed in with email/password workspace key (not anonymous).

**Steps:**
1. Open browser console. Execute: `_eSign({ title: 'Test Signature', meaning: 'OQ test sign', actionLabel: 'Test Sign', recordRef: 'oq_test', onConfirm: id => console.log('SIG_ID:', id), onCancel: () => console.log('CANCELLED') })`
2. Modal appears. Verify: signer name/email shown (read-only), date/time auto-populated (read-only), meaning pre-filled.
3. Enter the correct password.
4. Click "Test Sign".

**Expected result:** Console logs `SIG_ID: <firebase_key>`. Modal closes. Record exists in Firebase `esignatures/<sig_id>`. Audit entry in `audit_log` with `action: "ESIGN"`, `signature_id` matching the returned key.

### TC-OQ-004b: Failed signature (wrong password)

**Steps:**
1. Repeat TC-OQ-004a but enter an incorrect password.
2. Click "Test Sign".

**Expected result:** Error message "Authentication failed — incorrect password" appears in red within the modal. Modal remains open. No `esignatures` record written. No `audit_log` entry with `action: "ESIGN"`.

**Pass condition:** 004a completes with valid `signature_id`; 004b shows error without writing records.

---

## TC-OQ-005: Session Timeout

**CFR reference:** 21 CFR Part 11 §11.10(f)  
**Code location:** `modules/auth-workspace.js` — IIFE at bottom of file, `TIMEOUT_MS = 30 * 60 * 1000`

**Setup for test:** Temporarily reduce `TIMEOUT_MS` to `2 * 60 * 1000` (2 minutes) by editing auth-workspace.js in a test branch.

**Precondition:** Researcher signed in. Firebase Auth user present.

**Steps:**
1. Sign in with a researcher workspace key.
2. Do not interact with the page for 2 minutes.
3. Observe the page.

**Expected result:** After 2 minutes of inactivity, the page redirects to `?session=timeout`. An audit entry exists in `audit_log` with `cfr11: true`, `action: "SESSION_TIMEOUT"`, `actor_uid` matching the signed-in user.

**Pass condition:** Redirect occurs within 5 seconds of the 2-minute timeout. Audit entry present.

**Restore:** Revert `TIMEOUT_MS` to `30 * 60 * 1000` before production deployment.

---

## TC-OQ-006: Role-Based Access Control — Audit Log Tab

**CFR reference:** 21 CFR Part 11 §11.10(g)  
**Code location:** `modules/superadmin-workspace.js` — `_ATLAS_MODULES`, `saTab()`, `_saCurrentRole`

### TC-OQ-006a: Superadmin can access Audit Log tab

**Steps:**
1. Sign in as superadmin (key with `role: "superadmin"` in SSM).
2. Open Mission Control (the superadmin overlay).
3. Verify the "Audit Log" nav button (icon ⊕) is visible in the left rail.
4. Click "Audit Log".

**Expected result:** `_saRenderAuditLog()` renders: CFR-11 badge, filter toolbar, table. `_alLoad()` fires and populates entries.

### TC-OQ-006b: Non-superadmin cannot access Audit Log tab

**Steps:**
1. Open browser console with a researcher/PI session.
2. Execute: `saTab('auditlog')` (if Mission Control is not available, this function will not be defined — that is the pass condition).

**Expected result:** If `saTab` is accessible, it returns without rendering because `_ATLAS_MODULES['auditlog'].roles` only contains `['superadmin']` and `_saCurrentRole` is not `'superadmin'`. No audit log content renders.

**Pass condition:** 006a renders audit log; 006b renders nothing or `saTab` is undefined.

---

## TC-OQ-007: Record Deletion Audit Trail

**CFR reference:** 21 CFR Part 11 §11.10(e)  
**Code location:** `modules/superadmin-workspace.js` — `_rlConfirmDelete()`, `_rlExecuteDelete(sigId)`

**Precondition:** Superadmin signed in. At least one test record visible in Data Ledger.

**Steps:**
1. Open Mission Control → Data Ledger → Record Browser.
2. Select one test record using the checkbox.
3. Click "⊘ Delete Selected".
4. E-signature modal appears. Enter correct superadmin password. Click "Delete Records".
5. After deletion, open browser console: `database.ref('audit_log').orderByChild('cfr11').equalTo(true).limitToLast(10).once('value').then(s => console.log(JSON.stringify(s.val(), null, 2)))`

**Expected result:**
- Audit entry with `action: "DELETE"`, `table: "assessments"` (or `mapData`/`peacs_assessments`), `record_id` matching the deleted key.
- Entry contains `signature_id` matching the e-signature record created in step 4.
- Entry contains `actor_email` matching the superadmin's email.

**Pass condition:** All fields present. Record no longer appears in Data Ledger after deletion.

---

## TC-OQ-008: Proxy Bulk Upload Integrity

**CFR reference:** 21 CFR Part 11 §11.10(e) — all created records generate audit entries  
**Code location:** `modules/superadmin-workspace.js` — `_rlRenderProxy()`, proxy upload handler

**Precondition:** A 62-row XLSM test file with valid MMAS-8 data is available.

**Steps:**
1. Open Mission Control → Data Ledger → Proxy Upload tab.
2. Upload the 62-row XLSM file.
3. Confirm upload. Wait for completion toast.
4. Switch to Record Browser. Apply no filters. Verify record count increased by 62.
5. Open browser console: count CFR-11 CREATE entries: `database.ref('audit_log').orderByChild('cfr11').equalTo(true).once('value').then(s => { const all = Object.values(s.val()||{}); const creates = all.filter(e=>e.action==='CREATE'&&e.table==='assessments'); console.log('CREATE count:', creates.length); })`

**Expected result:** 62 new records in `assessments`. 62 new `audit_log` entries with `action: "CREATE"` and `table: "assessments"` corresponding to the upload timestamp.

**Pass condition:** Record count and audit entry count both equal 62.

---

## 3. Test Execution Log

| Test ID | Executed By | Date | Pass/Fail | Notes |
|---------|-------------|------|-----------|-------|
| TC-OQ-001 | | | | |
| TC-OQ-002 | | | | |
| TC-OQ-003 | | | | |
| TC-OQ-004 | | | | |
| TC-OQ-005 | | | | |
| TC-OQ-006 | | | | |
| TC-OQ-007 | | | | |
| TC-OQ-008 | | | | |

---

## 4. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| System Owner / PI | Philip Morisky | | |
| Technical Reviewer | | | |

*All 8 test cases must pass before PQ may begin.*

---

## Document Sign-Off — Operational Qualification

This Operational Qualification document certifies that the ATLAS platform (v8.9.3) has been verified to operate in accordance with its functional specifications under all anticipated operating conditions as described herein. All 8 OQ test cases (TC-OQ-001 through TC-OQ-008) must be executed and passed prior to signing.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Authorized Representative / Principal Investigator | | _______________________ | __________ |
| Quality Reviewer | | _______________________ | __________ |
| Technical Reviewer | | _______________________ | __________ |

**Approval Status:** ☐ Approved ☐ Approved with Conditions ☐ Rejected — Requires Revision

**Conditions / Comments:**

_______________________________________________________________________

_______________________________________________________________________

*Per 21 CFR Part 11 §11.10(a), this signed document certifies that operational qualification of the system described herein is complete and the system performs as specified.*
