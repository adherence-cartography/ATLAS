---
document: Business Associate Agreement — Subprocessor Disclosure
classification: Compliance — External
version: 1.1
date: 2026-06-08
---

# ATLAS Platform — Subprocessor Disclosure

This document identifies all third-party subprocessors that may process Protected Health Information (PHI) or Personal Data on behalf of Adherence Inc. in connection with the ATLAS platform (atlas.adherence.cc).

All subprocessors maintain appropriate Data Processing Agreements (DPAs) or Business Associate Agreements (BAAs) with Adherence Inc. prior to any PHI processing.

## Subprocessor Register

### 1. Google LLC — Firebase Platform
- **Services**: Firebase Realtime Database (primary data store), Firebase Authentication, Firebase Cloud Storage
- **Data processed**: Authentication tokens, workspace metadata, assessment records (encrypted at rest)
- **Data centers**: us-central1 (Iowa, USA) — primary; UAE workspaces use AWS (see below)
- **Encryption**: AES-256-GCM at rest; TLS 1.3 in transit
- **BAA**: Google Cloud Healthcare API Business Associate Agreement
- **DPA**: Google Cloud Data Processing Addendum (GDPR)
- **Reference**: cloud.google.com/healthcare/docs/concepts/baa

### 2. Amazon Web Services, Inc. — Cloud Infrastructure
- **Services**: AWS Lambda (serverless compute), Amazon DynamoDB (compliance records, UAE data), Amazon S3 (exports, CloudTrail logs), Amazon SES (email delivery), AWS SSM Parameter Store (secrets management)
- **Data processed**: MMAS-8/MAP assessment records (DynamoDB), audit trail (immutable), workspace credentials (SSM)
- **Data centers**: us-east-1 (Virginia, USA) — primary; me-central-1 (Abu Dhabi, UAE) — UAE workspace data
- **Encryption**: AES-256 SSE at rest; TLS 1.3 in transit; SSM SecureString (KMS-encrypted)
- **BAA**: AWS Business Associate Addendum
- **DPA**: AWS Data Processing Addendum (GDPR)
- **Reference**: aws.amazon.com/compliance/hipaa-compliance/

### 3. Cloudflare, Inc. — Edge Network & Security
- **Services**: Content Delivery Network (CDN), Cloudflare Workers (edge compute, request routing), TLS termination, DDoS protection, Web Application Firewall (WAF), rate limiting
- **Data processed**: HTTP request headers and bodies in transit (not stored); IP addresses for rate limiting (temporary, TTL 120s); no PHI stored at Cloudflare layer
- **Data centers**: Global PoP network (~300 locations); no PHI persisted at any PoP
- **Encryption**: TLS 1.3 for all connections; data in Workers memory only (not persisted)
- **DPA**: Cloudflare Data Processing Addendum (GDPR)
- **Reference**: cloudflare.com/gdpr/subprocessors/
- **Note**: Cloudflare handles all HTTP traffic between end users and ATLAS. Request/response bodies pass through Cloudflare edge in transit but are not logged or stored by Cloudflare infrastructure.

## Data Residency Summary

| Data Type | Primary Location | UAE Workspace Location |
|-----------|-----------------|----------------------|
| Authentication records | Google Firebase (us-central1) | Google Firebase (us-central1) |
| Assessment records (MAP/MMAS-8) | Firebase + DynamoDB (us-east-1) | DynamoDB (me-central-1, Abu Dhabi) |
| Audit trail | Firebase + DynamoDB (us-east-1) | DynamoDB (me-central-1, Abu Dhabi) |
| File exports | S3 (us-east-1, ephemeral) | S3 (me-central-1, ephemeral) |
| Email notifications | AWS SES (us-east-1) | AWS SES (us-east-1) |

## Updates to This Register

Adherence Inc. will provide 30 days advance written notice before adding new subprocessors. Covered entities with data processing agreements may object to new subprocessors within this notice period.

**Last updated:** 2026-06-08  
**Maintained by:** Privacy Officer (compliance@adherence.cc)
