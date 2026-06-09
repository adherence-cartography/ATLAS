# ATLAS HIPAA Compliance Checklist

Actions required to achieve full HIPAA compliance. The ATLAS codebase is already
HIPAA-ready — these are the owner-side administrative and configuration steps.

---

## Sprint 0 Completion Tracker

Pre-launch actions required before the first covered-entity BAA or clinical deployment. Check each item off as completed.

| # | Owner | Action | Status |
|---|-------|--------|--------|
| 1 | Platform Owner | Sign Google Cloud Healthcare API BAA (GCP Console → Artifact → BAA) | ☐ Pending |
| 2 | Platform Owner | Confirm Firebase project linked to Healthcare API-enabled GCP project | ☐ Pending |
| 3 | Platform Owner | Sign AWS Business Associate Addendum (AWS Console → Artifact → Agreements) | ☐ Pending |
| 4 | DNS Admin | Add SPF, DKIM, and DMARC records for @adherence.cc domain | ☐ Pending |
| 5 | Privacy Officer | Finalize and file Incident Response Plan (docs/compliance/incident-response-sop.md) | ☐ Pending |
| 6 | All infra staff | Complete documented HIPAA workforce training; retain completion records 6 years | ☐ Pending |
| 7 | Platform Owner | Sign Privacy Officer designation memo (docs/compliance/privacy-officer-memo.md) | ☐ Pending |
| 8 | Platform Owner | Apply DynamoDB IAM Deny policy (DeleteItem / UpdateItem) on atlas-audit-log table | ☐ Pending — runbook ready: `docs/compliance/runbooks/aws-dynamodb-iam-deny.md` |
| 9 | Platform Owner | Enable DynamoDB Point-in-Time Recovery (PITR) on atlas-audit-log table | ☐ Pending — runbook ready: `docs/compliance/runbooks/aws-dynamodb-iam-deny.md` |
| 10 | Platform Owner | Enable AWS CloudTrail, archive to S3 bucket atlas-cloudtrail-logs | ☐ Pending — runbook ready: `docs/compliance/runbooks/cloudtrail-setup.md` |
| 11 | Philip Morisky (PI) | Review and sign IQ.md, OQ.md, PQ.md validation documents | ☐ Pending |
| 12 | Privacy Officer | Verify subprocessor register is current (docs/compliance/baa-subprocessors.md) | ☐ Pending |

**Completion definition:** All 12 items must be checked before any PHI is ingested into the production ATLAS platform under a covered-entity BAA.

---

## Cloudflare Edge Infrastructure — Deployment Status

Current state of the Cloudflare Worker layer as of 2026-06-08.

| Status | Item | Notes |
|--------|------|-------|
| ✅ | KV namespace created + wired | Bound to Worker at deploy time; used for rate-limiting counters |
| ✅ | Worker deployed with all bindings | All KV, routing, rate-limiting, and security-header bindings confirmed active |
| ✅ | Lambda integration routes | `/lambda-proxy/*` (us-east-1) and `/lambda-proxy-uae/*` (me-central-1) configured — fully active pending Lambda function deploy |
| ☐ | DynamoDB IAM Deny policy | Console action required — runbook: `docs/compliance/runbooks/aws-dynamodb-iam-deny.md` |
| ☐ | Enable CloudTrail | Console action required — runbook: `docs/compliance/runbooks/cloudtrail-setup.md` |

---

## 1. Sign Google Cloud Healthcare API BAA

Google's BAA covers Firebase (Realtime Database, Auth, Storage) when your project is
enrolled in the Healthcare API.
**GCP Console path:** Console → APIs & Services → Library → search "Cloud Healthcare API"
→ Enable → then navigate to IAM & Admin → Settings → scroll to "Business Associate
Agreement" → Accept.
Direct link: https://console.cloud.google.com/apis/library/healthcare.googleapis.com

---

## 2. Configure Firebase Project Under Google Cloud Healthcare API

After enabling the Healthcare API on your GCP project, confirm your Firebase project
is linked to that same GCP project (Firebase Console → Project Settings → Your apps →
"Google Cloud project" must match).
No endpoint migration is needed for Firebase Realtime Database — the BAA coverage
applies automatically once the Healthcare API is enabled on the linked GCP project.

---

## 3. Sign AWS HIPAA Business Associate Addendum (BAA)

AWS BAA is free and self-service. Covers Lambda, S3, SSM Parameter Store, and
SES (all services ATLAS uses).
**Path:** AWS Console → Artifact → Agreements → AWS Business Associate Addendum →
Accept. Or navigate directly:
https://console.aws.amazon.com/artifact/agreements
Reference list of HIPAA-eligible services: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/

---

## 4. Configure @adherence.cc Email Domain (SPF / DKIM / DMARC)

Required for HIPAA-compliant email communications (breach notifications, BAA
correspondence, MFA OTP delivery).
Add these DNS records at your registrar/DNS provider:
- **SPF:** `TXT @ "v=spf1 include:amazonses.com ~all"` (adjust if using another sender)
- **DKIM:** Generate DKIM keys in AWS SES Console → Verified identities → adherence.cc → DKIM
- **DMARC:** `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@adherence.cc"`

---

## 5. Establish Incident Response Plan

HIPAA requires breach notification to affected individuals within 60 days of
discovery; HHS notification within 60 days (or annually if <500 individuals affected).
Minimum document needed: a written Incident Response Plan naming the Privacy Officer,
describing detection/containment/notification steps, and stored in a durable location
(e.g., Google Drive, Notion). Template available from HHS:
https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html

---

## 6. Complete Workforce HIPAA Training Documentation

All workforce members with access to ATLAS infrastructure (Firebase Console, AWS
Console, GCP Console) must complete documented HIPAA training.
Free HHS training materials: https://www.hhs.gov/hipaa/for-professionals/training/index.html
Record completion dates and retain for 6 years per HIPAA retention requirements.

---

## 7. Designate a Privacy Officer

HIPAA requires a named Privacy Officer responsible for developing and implementing
privacy policies (45 CFR §164.530(a)).
This can be the platform owner (Philip Morisky). Formally document the designation
in writing — a single signed memo is sufficient for a small covered entity/BA.
The Privacy Officer's contact (compliance@adherence.cc) is already surfaced in the
ATLAS compliance modal and fact sheet.

---

## Status Summary

| Item | Who acts | Blocker for BAA? |
|------|----------|-----------------|
| GCP Healthcare API BAA | Platform owner (GCP Console) | Yes |
| Firebase project linkage | Platform owner | Yes |
| AWS BAA | Platform owner (AWS Console) | Yes |
| Email DNS records | DNS admin | No (but required for HIPAA email) |
| Incident Response Plan | Privacy Officer | No (audit requirement) |
| Workforce training | All infra staff | No (audit requirement) |
| Privacy Officer designation | Platform owner | No (audit requirement) |

The ATLAS UI (trust badges, compliance modal, fact sheet) is fully built and will
surface the correct compliance status the moment the BAAs above are signed.

---

## 21 CFR Part 11 — Electronic Records & Electronic Signatures

21 CFR Part 11 (FDA) applies when ATLAS records are used in or submitted to support
FDA-regulated studies (IND, NDA, 510(k)) or GCP-compliant clinical research.

| Item | Status | Who acts |
|------|--------|----------|
| Immutable CFR-11 audit trail (`cfr11:true` entries in `audit_log`) | ✅ Platform Built | None |
| SHA-256 payload hash on every audit entry (`db-shim.js`) | ✅ Platform Built | None |
| Electronic signature module (`esignature.js` — §11.50 / §11.200) | ✅ Platform Built | None |
| E-signature on MMAS-8 and MAP submission (researcher sessions) | ✅ Platform Built | None |
| E-signature on record deletion (Mission Control Data Ledger) | ✅ Platform Built | None |
| 30-minute inactivity session timeout with audit entry | ✅ Platform Built | None |
| Failed login logging to audit trail | ✅ Platform Built | None |
| Audit Log Viewer tab in Mission Control (read-only, superadmin) | ✅ Platform Built | None |
| `esignatures/` Firebase path — signature records with meaning + actor | ✅ Platform Built | None |
| Validation documentation (IQ / OQ / PQ / SRS / RTM) | ✅ Created | Needs PI sign-off |
| Change control SOP (`docs/validation/change-control.md`) | ✅ Created | Owner Action |
| DynamoDB audit table IAM policy: deny DeleteItem / UpdateItem for all roles | ⬜ Owner Action | AWS Console — runbook: `docs/compliance/runbooks/aws-dynamodb-iam-deny.md` |
| AWS DynamoDB Point-in-Time Recovery (PITR) enabled on audit table | ⬜ Owner Action | AWS Console — runbook: `docs/compliance/runbooks/aws-dynamodb-iam-deny.md` |
| AWS CloudTrail enabled and archived (infrastructure-level audit) | ⬜ Owner Action | AWS Console — runbook: `docs/compliance/runbooks/cloudtrail-setup.md` |
| System validation sign-off (PI signature on IQ / OQ / PQ docs) | ⬜ Owner Action | Philip Morisky |

### DynamoDB Audit Table IAM Policy (Owner Action — highest priority)

The immutable audit trail requires that the DynamoDB table holding `audit_log` entries
cannot be updated or deleted by any user — including superadmin and the Lambda execution role.
Add this Deny statement to the Lambda execution role's IAM policy:

```json
{
  "Effect": "Deny",
  "Action": ["dynamodb:DeleteItem", "dynamodb:UpdateItem"],
  "Resource": "arn:aws:dynamodb:*:*:table/atlas-audit-log"
}
```

Also enable **DynamoDB Point-in-Time Recovery** (PITR):
AWS Console → DynamoDB → Tables → atlas-audit-log → Backups → Enable PITR.

### AWS CloudTrail

Enable a trail covering the ATLAS AWS account:
AWS Console → CloudTrail → Create trail → Apply to all regions → S3 bucket: `atlas-cloudtrail-logs`.
This captures all API calls at the infrastructure level (Lambda invocations, DynamoDB access,
S3 reads) and satisfies §11.10(d) at the infrastructure layer.

### Validation Sign-Off

Validation documents are at `docs/validation/`. Philip Morisky must review and sign
IQ.md, OQ.md, and PQ.md before the platform is submitted as part of any FDA-regulated
study package. Print or export to PDF; physically or digitally sign each document.
