# ATLAS Lambda Functions

All AWS Lambda source code lives here. One subfolder = one deployed Lambda function.

---

## Function Map

| Folder | AWS Function Name | API Gateway URL | Region |
|---|---|---|---|
| `../lambda/` | `atlas-lambda` _(main)_ | `https://api.adherence.cc/` | us-east-1 |
| `atlas-api/` | _(your xckeiwruv7 Lambda)_ | `https://xckeiwruv7.execute-api.us-east-1.amazonaws.com/` | us-east-1 |
| `adherence-pulse/` | `atlas-adherence-pulse` | _(EventBridge scheduled, no HTTP)_ | us-east-1 |
| `gai-api/` | `atlas-gai-api` | `https://api.adherence.cc/gai` | us-east-1 |
| `gai-realtime/` | _(not yet deployed)_ | _(future)_ | us-east-1 |

**`../lambda/`** (atlas-main) is the original main Lambda — ZOE, Stripe, key issuance, OTP,
cert verification. Source lives at `atlas_v8/lambda/`. Edit it there, not here.

**`atlas-api/`** is the Lambda currently deployed at `xckeiwruv7...`. It handles:
- `POST /claude` — Anthropic AI proxy (all Mission Control AI features)
- `POST /inst/*` — institution self-service provisioning

> `claude-proxy/` and `institution/` in this folder are reference copies showing what
> a future split would look like. Deploy `atlas-api/` for now.

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
