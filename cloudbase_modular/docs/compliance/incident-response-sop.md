---
document: Data Breach Incident Response SOP
classification: Internal — Compliance
version: 1.0
date: 2026-06-08
---

# Data Breach Incident Response — Standard Operating Procedure

## 1. Purpose

This SOP defines the procedures for detecting, containing, assessing, and reporting security incidents and potential data breaches involving Protected Health Information (PHI) or Personal Data processed by the ATLAS platform (atlas.adherence.cc), operated by Adherence Inc.

## 2. Incident Classification

| Level | Definition | Response Time |
|-------|-----------|--------------|
| P0 — Critical | Confirmed PHI breach with >500 individuals affected | Immediate (same day) |
| P1 — High | Confirmed PHI breach with <500 individuals, or suspected breach | Within 24 hours |
| P2 — Medium | Security anomaly with potential PHI exposure | Within 72 hours |
| P3 — Low | Security event with no confirmed PHI exposure | Within 5 business days |

## 3. Detection Sources

- AWS CloudTrail anomaly alerts (unauthorized API calls, unusual access patterns)
- Firebase Security Rules violation logs
- Cloudflare security event notifications
- User-reported suspicious behavior (contact: compliance@adherence.cc)
- Automated Sentinel alerts in ATLAS platform
- Third-party penetration testing findings

## 4. Response Procedure

### Phase 1: Detection & Initial Assessment (0–4 hours)

1. **Receive alert** — from any detection source listed above
2. **Document** — record incident in the ATLAS Incident Log (Firebase: `/incidents/{incident_id}`)
3. **Initial classification** — assign P-level based on classification table
4. **Notify Privacy Officer** — immediately for P0/P1; within 24 hours for P2/P3
5. **Preserve evidence** — export relevant CloudTrail logs, Firebase audit logs, Cloudflare logs before any remediation

### Phase 2: Containment (4–24 hours)

1. **Isolate affected systems** — revoke compromised workspace keys via ATLAS admin console
2. **Rotate credentials** — rotate AWS access keys, Firebase service account keys if compromised
3. **Block suspicious IPs** — via Cloudflare firewall rules
4. **Assess scope** — determine which patient records, workspaces, and data types were potentially exposed
5. **Document containment actions** — all actions logged with timestamps

### Phase 3: Eradication & Recovery (24–72 hours)

1. **Root cause analysis** — identify how the breach occurred
2. **Patch/remediate** — deploy fix via Cloudflare Worker or Lambda update
3. **Verify remediation** — confirm the vulnerability is closed
4. **Restore service** — restore any temporarily suspended services
5. **Document** — complete technical incident report

### Phase 4: Notification (per regulatory timelines)

#### HIPAA Notifications
- **Affected individuals**: Written notice within 60 days of discovery
- **HHS (annual)**: Submit via HHS Breach Reporting Portal for breaches affecting <500 individuals per state, by March 1 of the following calendar year
- **HHS (immediate)**: Submit within 60 days for breaches affecting ≥500 individuals in a single state
- **Media notice**: Required for breaches affecting ≥500 residents of a single state

#### GDPR Notifications (EU/EEA individuals)
- **Supervisory Authority**: Within 72 hours of discovery (Article 33)
- **Affected individuals**: "Without undue delay" if high risk to rights and freedoms (Article 34)

#### UAE PDPL Notifications
- **Regulatory Authority (UAE)**: Promptly upon discovery of a breach likely to harm personal data or privacy

### Phase 5: Post-Incident Review (within 30 days)

1. **Lessons learned** — document what worked and what failed in the response
2. **Policy updates** — update this SOP and relevant security controls
3. **Training** — brief all relevant staff on the incident and remediation
4. **Regulatory close-out** — confirm all notifications have been sent and acknowledged

## 5. Contact List

| Role | Contact | Escalation |
|------|---------|-----------|
| Privacy Officer | compliance@adherence.cc | — |
| Technical Lead | info@adherence.cc | — |
| AWS Support | AWS Console → Support | support.aws.amazon.com |
| Firebase Support | firebase.google.com/support | — |
| Cloudflare Support | dash.cloudflare.com | — |
| HHS OCR Breach Portal | ocrportal.hhs.gov | — |

## 6. Document Control

This SOP shall be reviewed annually and updated following any significant incident. Version history maintained in the ATLAS change control log.

**Approved by:** [Privacy Officer]  
**Date:** 2026-06-08  
**Next Review:** 2027-06-08
