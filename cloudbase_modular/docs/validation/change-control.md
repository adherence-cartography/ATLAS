# Change Control Standard Operating Procedure
## ATLAS Medication Adherence Platform — 21 CFR Part 11 Compliance
**Document ID:** ATLAS-CC-SOP-001  
**Revision:** 1.0  
**Date:** 2026-05-27  
**Prepared by:** Philip Morisky, Adherence Inc.  
**CFR Reference:** 21 CFR Part 11 §11.10(k) — use of appropriate controls over systems documentation

---

## 1. Purpose

This SOP governs all changes to the ATLAS platform components that affect data integrity, audit trail completeness, electronic signature validity, access controls, or scoring algorithms. It ensures that changes are assessed, implemented, validated, and approved before deployment.

---

## 2. Scope — What Constitutes a Change

A change requiring this SOP applies to any modification of:

| Component | Examples |
|-----------|---------|
| `modules/db-shim.js` | Changes to `DYNA_PATHS`, `CFR11_AUDIT_TABLES`, `_cfr11Audit()`, `_sha256()`, `_dynaWrite()`, the `push()` or `set()` methods, Lambda URL |
| `modules/auth-workspace.js` | Changes to session timeout value (`TIMEOUT_MS`), LOGIN_FAILURE logging, `validateWorkspaceCode()`, `_submitOTP()`, `_grantWorkspaceAccess()` |
| `modules/superadmin-workspace.js` | Changes to `_rlConfirmDelete()`, `_rlExecuteDelete()`, `_ATLAS_MODULES` role assignments, Audit Log viewer (`_alLoad()`, `_alApplyFilter()`, `_alRenderTable()`) |
| `modules/esignature.js` | Any change to the `_eSign()` function, re-authentication flow, signature record structure |
| `assess.html` | Changes to `submitMMAS()`, `_submitMMASCore()`, `submitMAP()`, `_submitMAPCore()`, MMAS-8 scoring logic, MAP scoring logic (`computeMAPPE()`), e-signature wiring |
| Firebase Security Rules | Changes to read/write rules for `audit_log`, `assessments`, `peacs_assessments`, `esignatures` |
| AWS Lambda handler | Changes to `/db`, `/validate-key`, `/verify-otp` endpoint logic |

Changes to non-functional code (UI styling, text labels, non-scoring UI components) do not require this SOP, but must still be documented in commit history.

---

## 3. Change Classification

| Class | Description | PI Sign-off Required | OQ Re-run Required |
|-------|-------------|---------------------|-------------------|
| Class 1 — Minor | Cosmetic change to UI not affecting data flow, scoring, or audit | No | No |
| Class 2 — Moderate | Change to a validated module that does not alter data schema, scoring algorithm, or audit trail structure | No | Re-run affected test cases only |
| Class 3 — Major | Change to scoring algorithm (MMAS-8, MAP PE formula), audit trail schema, e-signature flow, session timeout value, Firebase Security Rules, or Lambda endpoint logic | **Yes** | Full OQ re-run required |
| Class 4 — Emergency | Critical production bug requiring immediate hotfix to a validated module | Yes (retrospective within 5 business days) | Abbreviated OQ (affected test cases only); full OQ within 30 days |

---

## 4. Pre-Change: Impact Assessment

Before implementing any Class 2, 3, or 4 change:

1. **Identify affected SRS requirements.** Open `docs/validation/SRS.md` and list every requirement that the proposed change touches.
2. **Identify affected OQ test cases.** Cross-reference with `docs/validation/RTM.md` to list every OQ test case that validates the affected requirements.
3. **Assess data integrity risk.** If the change could alter how `payload_hash` is computed, how `signature_id` is linked, or how `actor_uid` is recorded, classify as Class 3.
4. **Assess backward compatibility.** If the change alters the schema of existing `audit_log`, `assessments`, or `esignatures` records, document the migration plan.
5. **Document the assessment.** Write a brief (1 paragraph minimum) impact summary in the change request ticket or commit description.

**PI sign-off required for Class 3:** Philip Morisky must review and approve the impact assessment before implementation begins.

---

## 5. Change Implementation

1. Create a feature branch from the current `main` branch. Branch name format: `cfr11/change-description` (e.g. `cfr11/extend-timeout-45min`).
2. Implement the change in the feature branch only.
3. Self-review: read the diff against the requirements it affects. Check:
   - Does `_cfr11Audit()` still fire for all CFR11_AUDIT_TABLES?
   - Does `_sha256()` still return a 64-character hex string?
   - Does `_eSign()` still require a password and call `signInWithEmailAndPassword`?
   - Does the session timeout IIFE still register all 5 event listeners?
4. Do not modify any validation document (`IQ.md`, `OQ.md`, `PQ.md`, `SRS.md`, `RTM.md`) in the same commit as the functional change — these are separate commits.

---

## 6. Validation: OQ Re-run

After implementation and before merging to `main`:

1. Run all OQ test cases identified in the impact assessment.
2. For Class 3 changes, run all 8 OQ test cases (TC-OQ-001 through TC-OQ-008).
3. Document results in the OQ Execution Log table in `OQ.md`.
4. If any test case fails: do not proceed. Fix the issue, increment the iteration, re-run.

---

## 7. Approval Before Deployment

### Class 2 and 3

1. All affected OQ test cases pass.
2. Philip Morisky reviews the diff and the OQ results.
3. Philip Morisky signs off in the change request (written email or digital signature on the commit is acceptable).
4. Update `RTM.md` to reflect any new or modified code locations.

### Class 4 (Emergency)

1. Implement fix on emergency branch.
2. Run abbreviated OQ (affected test cases only).
3. Philip Morisky provides verbal or email approval for immediate deployment.
4. Full documentation (impact assessment, OQ results) completed within 5 business days.

---

## 8. Deployment

1. Merge feature branch to `main` via pull request (or direct push for emergency changes).
2. Tag the commit with a version: `v8.x.y-cfr11` where x.y increments per change.
3. Record the deployment in the table below:

| Version Tag | Change Summary | Deployed By | Deployment Date | OQ Cases Passed |
|-------------|---------------|-------------|-----------------|-----------------|
| v8.1.0-cfr11 | Initial CFR-11 implementation (Phases 1–5) | Philip Morisky | 2026-05-27 | All (pending) |

4. Deploy to production (push to Firebase Hosting, update Lambda if applicable).

---

## 9. Post-Deployment Verification

Within 2 hours of deployment:

1. **Audit trail check:** Submit one test MMAS-8 assessment via the deployed production URL. Verify `audit_log` receives a CREATE entry with `cfr11: true`.
2. **E-signature check:** In Mission Control, initiate a deletion. Verify the `_eSign` modal appears and requires a password.
3. **Spot-check 3 records:** Open Data Ledger, select 3 records from the past 24 hours. Verify each has a corresponding `audit_log` CREATE entry.
4. If any verification fails: initiate rollback immediately (see §11).

---

## 10. Rollback Procedure

The pre-CFR-11 codebase is preserved in the `cloudbase/` directory (rollback backup) at `C:\Users\philm\Documents\atlas_v8\cloudbase\`.

**Rollback steps:**
1. Identify the last known-good deployment tag.
2. Revert `cloudbase_modular/` to the last-good tag: `git checkout <last-good-tag> -- .`
3. Re-deploy.
4. Verify core functionality (workspace key sign-in, MMAS-8 submission) is working.
5. Investigate and fix the regression in a new feature branch before re-deploying the failed change.

**Note:** Rollback does not delete audit entries already written. The `audit_log` path is append-only and Firebase rules prevent deletion.

---

## 11. Emergency Change Procedure (Hotfix Path)

For critical production issues (data loss, security vulnerability, scoring bug):

1. **Immediate:** Philip Morisky authorises hotfix verbally or via email. Record the authorisation timestamp.
2. Implement the minimum-scope fix on an `emergency/<description>` branch.
3. Run TC-OQ-001 (scoring) and TC-OQ-003 (audit trail) at minimum.
4. Deploy immediately upon Philip Morisky email approval.
5. Within 5 business days: complete full impact assessment, run full OQ, update RTM.md, obtain written sign-off from Philip Morisky.

---

## 12. Document Control

This SOP itself is subject to change control. Any revision to this document:
- Requires Philip Morisky sign-off.
- Must increment the revision number.
- Must be committed with a message starting with `[SOP-UPDATE]`.

| Revision | Date | Author | Changes |
|----------|------|--------|---------|
| 1.0 | 2026-05-27 | Philip Morisky | Initial release — covers Phases 1–5 CFR-11 implementation |

---

*End of Change Control SOP.*
