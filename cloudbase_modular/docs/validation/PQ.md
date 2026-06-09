# Performance Qualification (PQ)
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-PQ-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.  
**Prerequisite:** OQ-001 passed (all 8 OQ test cases passed)

---

## 1. Purpose

This Performance Qualification (PQ) document verifies that the ATLAS platform performs correctly under realistic production conditions. PQ tests use real user workflows, representative data volumes, and concurrent access scenarios.

---

## PQ-001: End-to-End Patient Assessment with Audit Verification

**Scope:** Full patient journey — ZOE voice session + manual submission → audit trail verification  
**CFR reference:** §11.10(d)(e) — complete audit trail from submission to storage

**Participants:** 1 researcher (workspace key active), 1 patient (voice session)

**Steps:**
1. Researcher signs in with workspace key via Institution path.
2. Patient initiates MMAS-8 assessment via ZOE voice interface.
3. ZOE captures Q1–Q8 answers via speech. Researcher reviews ZOE-suggested scores in the MMAS panel.
4. Researcher adjusts one score manually (simulating clinical override).
5. Researcher submits via "Submit Assessment" button.
6. In researcher workspace (within 30 seconds of submission): open Data Ledger → Record Browser. Locate the new record by timestamp.
7. Superadmin opens Mission Control → Audit Log. Apply filter: `table = assessments`, `action = CREATE`. Locate entry matching the `client_ts` from the submitted record.

**Acceptance criteria:**
- AC-PQ-001-1: Assessment record appears in Data Ledger within 3 seconds of submission.
- AC-PQ-001-2: Audit entry exists with `cfr11: true`, `action: "CREATE"`, `table: "assessments"`.
- AC-PQ-001-3: Audit `payload_hash` (SHA-256) matches recomputation from the stored record's JSON.
- AC-PQ-001-4: Audit `actor_email` matches the researcher's signed-in email.
- AC-PQ-001-5: If researcher session is workspace-authenticated, `signature_id` is present in the assessment record (e-signature flow was triggered).

---

## PQ-002: Bulk Upload — 62-Record XLSM with Score Verification

**Scope:** Proxy upload of a complete research cohort; full data integrity check  
**CFR reference:** §11.10(b)(e) — record integrity and complete audit trail

**Test data:** 62-row XLSM file. Rows include at least:
- 15 records with score 8 (all Q1–Q8 = 1) → High Adherence
- 15 records with score 0 (all Q1–Q8 = 0) → Low Adherence
- 32 records with mixed scores, pre-computed expected totals

**Steps:**
1. Superadmin signs in and opens Mission Control → Data Ledger → Proxy Upload.
2. Upload the 62-row XLSM file.
3. After upload completes: navigate to Record Browser, filter by upload session timestamp.
4. Export or inspect the 62 records. Verify scores against pre-computed expected values.
5. Open Audit Log, filter `action = CREATE`, `table = assessments`, date = today.

**Acceptance criteria:**
- AC-PQ-002-1: Exactly 62 new records written to `assessments` (verified by count in Record Browser).
- AC-PQ-002-2: All 62 records have correct `score` values matching pre-computed expected values (spot-check 10 random rows).
- AC-PQ-002-3: Exactly 62 `audit_log` entries with `action: "CREATE"` and `table: "assessments"` for the upload session.
- AC-PQ-002-4: No duplicate records (each `_key` in Firebase is unique — Firebase RTDB push guarantees this).
- AC-PQ-002-5: Upload completes within 120 seconds.

---

## PQ-003: Superadmin Deletes 5 Records — Audit Trail Completeness

**Scope:** Deletion workflow with e-signature; verify audit trail for each deletion  
**CFR reference:** §11.10(d)(e), §11.200 — deletion events audited and signed

**Precondition:** 5 test records in `assessments` (use records written in PQ-002 or TC-OQ-008).

**Steps:**
1. Superadmin opens Data Ledger → Record Browser.
2. Selects 5 records using checkboxes.
3. Clicks "⊘ Delete Selected".
4. E-signature modal appears. Enters correct password. Clicks "Delete Records".
5. Verifies 5 records are removed from Record Browser.
6. Opens Audit Log → filter `action = DELETE`.

**Acceptance criteria:**
- AC-PQ-003-1: Exactly 5 `audit_log` entries with `action: "DELETE"`.
- AC-PQ-003-2: Each DELETE entry contains `signature_id` referencing a record in `esignatures`.
- AC-PQ-003-3: Each DELETE entry contains `record_id` matching one of the 5 deleted Firebase keys.
- AC-PQ-003-4: Each DELETE entry contains `actor_email` = superadmin's email.
- AC-PQ-003-5: The 5 records are no longer retrievable via `database.ref('assessments').child(key).once('value')`.

---

## PQ-004: Audit Log Viewer — 1000+ Entries, Pagination, Date Filter

**Scope:** Performance of `_saRenderAuditLog()` / `_alLoad()` under realistic data volume  
**CFR reference:** §11.10(d) — audit trail must be accessible for review

**Precondition:** `audit_log` Firebase path contains at least 1000 entries (generate via script if needed: 1000 test `push_audit` calls with `cfr11: true`).

**Steps:**
1. Superadmin opens Mission Control → Audit Log.
2. Measure time from click to table render (entries visible on screen).
3. Click "Next →" pagination button 5 times. Verify page number increments, table content changes.
4. Set Date From to 30 days ago, Date To to today. Observe filtered count.
5. Set Action filter to "CREATE". Verify all visible rows show CREATE badge.
6. Type a known actor email in Search field. Verify only that actor's entries appear.
7. Click "← Prev" until back at page 1.

**Acceptance criteria:**
- AC-PQ-004-1: Initial load of 1000+ entries completes within 8 seconds.
- AC-PQ-004-2: Pagination shows 50 entries per page (`_AL.pageSize = 50`). Page N+1 shows different entries from page N.
- AC-PQ-004-3: Date filter correctly excludes entries outside the selected range.
- AC-PQ-004-4: Action filter shows only entries with the selected action badge.
- AC-PQ-004-5: Search filter matches on `actor_email` and `record_id` fields.
- AC-PQ-004-6: Row expand (▼ toggle) shows full JSON of the entry without page scroll issues.

---

## PQ-005: Concurrent Researcher Uploads — No Record Collision

**Scope:** Two researchers upload simultaneously; verify no data loss or collision  
**CFR reference:** §11.10(b) — record integrity under concurrent access

**Precondition:** Two browser sessions open simultaneously, each with a different researcher workspace key.

**Steps:**
1. Researcher A prepares a 10-record XLSM upload in their session.
2. Researcher B prepares a separate 10-record XLSM upload in their session.
3. Both click upload within 5 seconds of each other.
4. Wait for both to complete.
5. Superadmin opens Data Ledger. Filter by each workspace key separately.

**Acceptance criteria:**
- AC-PQ-005-1: Researcher A sees exactly 10 new records tagged with their `institution_code`.
- AC-PQ-005-2: Researcher B sees exactly 10 new records tagged with their `institution_code`.
- AC-PQ-005-3: Total new records = 20 (no collision, no overwrites). Firebase push() is atomic and guarantees unique keys.
- AC-PQ-005-4: 20 separate `audit_log` CREATE entries — 10 per workspace.

---

## PQ-006: Session Timeout Under Real Use — 30-Minute Idle

**Scope:** Verify CFR-11 §11.10(f) session timeout in a real researcher session  
**CFR reference:** §11.10(f) — use of terminal controls / automatic log-off

**Precondition:** Researcher signed in. TIMEOUT_MS = 30 * 60 * 1000 (production value).

**Steps:**
1. Researcher signs in via Institution path.
2. Actively uses the platform for 5 minutes (submits one assessment, browses dashboard).
3. Stops all interaction. Waits 30 minutes.
4. Observes page.

**Acceptance criteria:**
- AC-PQ-006-1: Page redirects to `?session=timeout` within 60 seconds of the 30-minute mark (total idle time ≤ 31 minutes).
- AC-PQ-006-2: `audit_log` contains one entry with `action: "SESSION_TIMEOUT"`, `actor_uid` matching the researcher, timestamp within ±60s of the expected timeout time.
- AC-PQ-006-3: After redirect, attempting to access workspace-protected pages requires re-authentication.
- AC-PQ-006-4: Active interaction (mouse move, click) at 29 minutes resets the timer — timeout does not occur at 30 minutes if the user was active.

---

## 3. PQ Execution Log

| Test ID | Executed By | Date | Pass/Fail | Notes |
|---------|-------------|------|-----------|-------|
| PQ-001 | | | | |
| PQ-002 | | | | |
| PQ-003 | | | | |
| PQ-004 | | | | |
| PQ-005 | | | | |
| PQ-006 | | | | |

---

## 4. Sign-Off

All PQ tests must pass before the system is declared validated for clinical use under 21 CFR Part 11.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| System Owner / PI | Philip Morisky | | |
| Technical Reviewer | | | |

*Retain this document indefinitely per REQ-RET-001.*

---

## Document Sign-Off — Performance Qualification

This Performance Qualification document certifies that the ATLAS platform (v8.9.3) has been demonstrated to perform consistently and reproducibly within defined specifications during normal operating conditions, as described herein. All 6 PQ test cases (PQ-001 through PQ-006) must be executed and passed prior to signing. Signature of this document constitutes declaration that the system is validated for clinical use under 21 CFR Part 11.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Authorized Representative / Principal Investigator | | _______________________ | __________ |
| Quality Reviewer | | _______________________ | __________ |
| Technical Reviewer | | _______________________ | __________ |
| Privacy Officer / Compliance Representative | | _______________________ | __________ |

**Approval Status:** ☐ Approved ☐ Approved with Conditions ☐ Rejected — Requires Revision

**Conditions / Comments:**

_______________________________________________________________________

_______________________________________________________________________

*Per 21 CFR Part 11 §11.10(a), this signed document constitutes the final performance qualification certification for the ATLAS platform. The system is hereby declared validated for its intended clinical use.*
