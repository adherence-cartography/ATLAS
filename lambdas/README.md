# ATLAS Lambda Functions

All AWS Lambda source code lives here. One subfolder = one deployed Lambda function.

---

## Function Map

| Folder | AWS Function Name | API Gateway URL | Region |
|---|---|---|---|
| `atlas-main/` | `zoe-atlas-proxy` | `https://api.adherence.cc/` | us-east-1 |
| `atlas-api/` | `atlas-claude-proxy` | `https://xckeiwruv7.execute-api.us-east-1.amazonaws.com/` | us-east-1 |
| `adherence-pulse/` | `atlas-adherence-pulse` | _(EventBridge scheduled trigger, no HTTP)_ | us-east-1 |
| `gai-api/` | `atlas-gai-api` | `https://api.adherence.cc/gai` | us-east-1 |
| `atlas-partner-api/` | `atlas-partner-api` | `https://api.adherence.cc/partner` | us-east-1 |
| `gai-realtime/` | _(not yet deployed)_ | _(future)_ | us-east-1 |

### atlas-partner-api — partner instrument scoring API

REST API for third-party platforms to submit MAP, MMAS-8, and PEACS assessments and receive
scored results in real time. Partners authenticate with a pre-issued API key (`X-Partner-Key`
header). All submissions persist to Firebase Realtime Database and optionally push to a
registered webhook endpoint.

**Routes:**
- `GET  /v1/health` — health check (no auth)
- `POST /v1/map/submit` — submit MAP assessment, returns PE + domain scores
- `POST /v1/mmas/submit` — submit MMAS-8 assessment, returns score + adherence level
- `POST /v1/peacs/submit` — submit PEACS scores, returns PE + phenotype + intervention
- `GET  /v1/results/{uuid}` — retrieve a single assessment
- `GET  /v1/patient/{ref}/results` — all assessments for a patient reference
- `GET  /v1/study/{study_id}/results` — all assessments for a study cohort
- `GET  /v1/stats` — partner usage and assessment counts

**Deploy:**
```bash
cd lambdas/atlas-partner-api
npm install
zip -r deploy.zip index.js node_modules package.json
# AWS Console > Lambda > Create function > atlas-partner-api
# Upload deploy.zip | Runtime: Node.js 20.x | Handler: index.handler
# Timeout: 15s | Memory: 256 MB
# Wire to API Gateway under https://api.adherence.cc/partner
```

**Environment variables:**
- `FIREBASE_SERVICE_ACCOUNT` — JSON string of the Firebase service account credentials
- `FIREBASE_DATABASE_URL` — defaults to the ATLAS production database if omitted

**Firebase Database indexes required** (add to `database.rules.json` under `.rules`):
```json
"assessments": {
  ".indexOn": ["partner_key", "patient_ref", "study_id"]
},
"peacs_assessments": {
  ".indexOn": ["partner_key", "patient_ref"]
}
```

**Partner key provisioning:** Add a record to Firebase at `partner_keys/{apiKey}`.
See `atlas-partner-api/README.md` for the full partner key schema.

---

### atlas-main — the core ATLAS Lambda

Handles all authentication, key management, and business logic. Three files deployed together:

- `index.mjs` — main handler (2,700+ lines): key validation, Firebase token minting, OTP/MFA,
  key issuance, magic links, cert verification, ZOE AI, DynamoDB (UAE PDPL), admin routes,
  institution seat provisioning, GAI inquiry
- `lambda_stripe_handler.mjs` — Stripe checkout sessions and webhook handling
- `lambda_integrations.mjs` — REDCap and FHIR webhook integrations

**Update this Lambda when:** changing key validation, email templates, OTP behavior, Stripe
flows, admin endpoints, UAE data residency logic, or adding new integrations.

**Does NOT handle:** Claude AI calls or institution member provisioning (those are `atlas-api`).

> The source of truth for atlas-main is `../lambda/` (original location). The files in
> `atlas-main/` here are kept in sync — always edit `../lambda/` and copy here before deploying.
> `../lambda/index_old.mjs` is an outdated backup — ignore it.

---

### atlas-api — Claude proxy + institution provisioning

One Lambda, two responsibilities:
- `POST /claude` — Anthropic AI proxy for all Mission Control AI features (Intelligence Brief,
  NLQ, Cohort comparison). Validates Firebase ID token before every call.
- `POST /inst/*` — institution self-service member key provisioning

**Update this Lambda when:** changing AI proxy behavior, adding inst provisioning routes,
or updating the Firebase auth check.

---

## Deployment Cheat Sheet

### claude-proxy

Handles all Claude AI calls from Mission Control (Intelligence Brief, NLQ, Cohort comparison).
Validates Firebase ID token before forwarding to Anthropic. API key never leaves the server.

```bash
cd lambdas/claude-proxy
npm install firebase-admin
zip -r deploy.zip index.js node_modules package.json
# Upload deploy.zip in AWS Console > Lambda > atlas-claude-proxy > Code
```

**Environment variables** (set in Lambda > Configuration > Environment variables):
- `ANTHROPIC_API_KEY` — sk-ant-... from console.anthropic.com
- `FIREBASE_SERVICE_ACCOUNT` — paste the full service account JSON as one line

**Settings:** Runtime: Node.js 20.x | Handler: `index.handler` | Timeout: 30s | Memory: 256 MB

---

### institution

Handles institution-tier self-service workspace provisioning. Called by `inst-admin.js`
in the ATLAS dashboard when institution accounts add/remove team members.

```bash
cd lambdas/institution
npm install firebase-admin
zip -r deploy.zip index.js node_modules package.json
# Upload deploy.zip in AWS Console > Lambda > atlas-institution > Code
```

**Environment variables:**
- `FIREBASE_SERVICE_ACCOUNT` — same service account JSON as above

**Settings:** Runtime: Node.js 20.x | Handler: `index.handler` | Timeout: 15s | Memory: 256 MB

**Routes:**
- `POST /inst/list-members` — list sub-workspace keys for the caller's institution
- `POST /inst/provision-key` — create a new sub-workspace key
- `POST /inst/revoke-key` — deactivate a key

> Note: claude-proxy and institution can share the same API Gateway and Lambda if
> you want to keep things simple — just route `/inst/*` to institution and `/claude`
> to claude-proxy. Or deploy as two separate functions.

---

### adherence-pulse

Sends weekly adherence summary emails to PI and institution accounts.
Triggered by a CloudWatch Events / EventBridge rule (not HTTP).

```bash
cd lambdas/adherence-pulse
npm install firebase-admin aws-sdk
zip -r deploy.zip index.js node_modules package.json
# Upload to AWS Console > Lambda > atlas-adherence-pulse > Code
```

**Environment variables:**
- `FIREBASE_SERVICE_ACCOUNT`
- `FROM_EMAIL` — verified SES sender address (e.g. noreply@adherence.cc)

**Settings:** Runtime: Node.js 20.x | Handler: `index.handler` | Timeout: 60s | Memory: 256 MB
**Trigger:** EventBridge rule, cron: `cron(0 8 ? * MON *)` (Mondays 8am UTC)

---

### gai-api

Public HTTP endpoint that returns GAI (Global Adherence Index) metrics for a workspace key.
Used by partner sites embedding the ATLAS GAI widget.

```bash
cd lambdas/gai-api
npm install firebase-admin
zip -r deploy.zip index.js node_modules package.json
# Upload to AWS Console > Lambda > atlas-gai-api > Code
```

**Environment variables:**
- `FIREBASE_SERVICE_ACCOUNT`

**Settings:** Runtime: Node.js 20.x | Handler: `index.handler` | Timeout: 15s | Memory: 256 MB

---

### gai-realtime _(future)_

Placeholder for a future real-time GAI streaming endpoint (WebSocket or SSE).
Will support the live GAI panel in the ATLAS dashboard and partner embeds.

---

## Adding a New Lambda

1. Create a subfolder: `lambdas/your-function-name/`
2. Add `index.js` (or `index.mjs` for ES modules) with `exports.handler`
3. Add a `package.json` with dependencies
4. Update the Function Map table in this README
5. Deploy to AWS and record the function name and URL in the table

---

## Required IAM Permissions

Each Lambda execution role needs:
- `AmazonDynamoDBFullAccess` (if using DynamoDB)
- `AmazonSESFullAccess` (adherence-pulse only)
- `AWSLambdaBasicExecutionRole` (CloudWatch Logs — all functions)
- Firebase Admin SDK uses the service account JSON directly, no AWS IAM needed for Firebase

---

## Shared Environment Variables

Both `FIREBASE_SERVICE_ACCOUNT` and `ANTHROPIC_API_KEY` are sensitive. Store them in
**AWS SSM Parameter Store** as SecureString values and reference them in your Lambda
configuration rather than pasting them directly (to avoid accidental exposure in
screenshots or copy-paste).

Path convention:
- `/atlas/firebase_service_account`
- `/atlas/anthropic_api_key`
