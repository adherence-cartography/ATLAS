# ATLAS Lambda Functions

This folder contains AWS Lambda functions that serve as server-side proxies for
the ATLAS platform. They keep sensitive credentials out of the browser
environment and enforce authentication before reaching external APIs.

---

## Functions

### claude-proxy.js

**Purpose:** Secure server-side proxy for Anthropic Claude API calls.

All AI requests from ATLAS Mission Control (Intelligence Brief, NLQ, Cohort
Comparison) route through this function when `window.ATLAS_CONFIG.aiProxyUrl`
is set. The function:

1. Validates the caller's Firebase ID token (must be a signed-in ATLAS user).
2. Clamps the model to the ATLAS-approved allow-list.
3. Enforces a 4096 token cap.
4. Forwards the request to `api.anthropic.com/v1/messages` using the
   `ANTHROPIC_API_KEY` environment variable stored in Lambda — never exposed
   to the client.
5. Emits a structured CloudWatch log entry with uid, workspace key, model,
   and token counts for usage auditing.

---

## Required Environment Variables

Set these in the Lambda function's Configuration > Environment Variables panel
(or via AWS SAM / CDK):

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-…`). Obtain from console.anthropic.com. |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON string of the Firebase service account key. Download from Firebase Console > Project Settings > Service Accounts > Generate new private key. Paste the entire JSON as a single-line string. |

Neither variable should appear in source code, `.env` files checked into git,
or client-side bundles.

---

## Deployment — Manual (AWS Console)

1. Install the dependency locally:
   ```
   cd lambda
   npm init -y
   npm install firebase-admin
   ```
2. Zip the contents (not the folder itself):
   ```
   zip -r claude-proxy.zip claude-proxy.js node_modules package.json
   ```
3. In AWS Console > Lambda > Create function:
   - Runtime: Node.js 20.x
   - Handler: `claude-proxy.handler`
   - Architecture: x86_64 (or arm64 for lower cost)
4. Upload the zip under Code > Upload from .zip file.
5. Add environment variables under Configuration > Environment variables.
6. Set timeout to 30 seconds (Anthropic calls can take up to 10–15s on Sonnet/Opus).
7. Memory: 256 MB is sufficient for Haiku; use 512 MB if using Sonnet or Opus.

---

## Deployment — AWS SAM

Create `template.yaml` alongside this README:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  ClaudeProxy:
    Type: AWS::Serverless::Function
    Properties:
      Handler: claude-proxy.handler
      Runtime: nodejs20.x
      CodeUri: ./
      Timeout: 30
      MemorySize: 256
      Environment:
        Variables:
          ANTHROPIC_API_KEY: !Sub '{{resolve:ssm:/atlas/anthropic_api_key}}'
          FIREBASE_SERVICE_ACCOUNT: !Sub '{{resolve:ssm:/atlas/firebase_service_account}}'
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /claude
            Method: POST
        Preflight:
          Type: HttpApi
          Properties:
            Path: /claude
            Method: OPTIONS
```

Deploy:
```
sam build && sam deploy --guided
```

Store secrets in AWS SSM Parameter Store as SecureString values at the paths
shown above rather than hard-coding them in the template.

---

## API Gateway Configuration

After deploying via Lambda console or SAM, configure API Gateway:

1. Create an HTTP API (preferred for lower latency and cost over REST API).
2. Add a route: `POST /claude` pointing to the Lambda integration.
3. Add a route: `OPTIONS /claude` pointing to the same Lambda integration
   (required for CORS pre-flight from the browser).
4. Under CORS settings for the API, set:
   - Allow origins: `https://atlas.adherence.cc`, `https://www.adherence.cc`
   - Allow headers: `Content-Type, Authorization`
   - Allow methods: `POST, OPTIONS`
5. Deploy the API to a stage (e.g. `prod`).
6. Note the invoke URL: `https://<api-id>.execute-api.<region>.amazonaws.com/claude`

---

## Configuring the Client (window.ATLAS_CONFIG.aiProxyUrl)

The three client modules (`sa-ai.js`, `sa-command.js`, `sa-cohort.js`) all read:

```js
const ATLAS_AI_PROXY_URL = window.ATLAS_CONFIG?.aiProxyUrl || null;
```

When this is set, all Claude calls route through the proxy with the user's
Firebase ID token. When it is `null` or unset, the modules fall back to direct
browser-to-Anthropic calls using the key stored in `sessionStorage`.

Set `window.ATLAS_CONFIG` in one of two places:

**Option A — inline in `index.html` before module scripts load:**

```html
<script>
  window.ATLAS_CONFIG = {
    aiProxyUrl: 'https://<api-id>.execute-api.<region>.amazonaws.com/claude'
  };
</script>
```

**Option B — in `firebase-init.js` after the Firebase config block:**

```js
window.ATLAS_CONFIG = window.ATLAS_CONFIG || {};
window.ATLAS_CONFIG.aiProxyUrl = 'https://<api-id>.execute-api.<region>.amazonaws.com/claude';
```

Option A is preferred: it ensures the value is available before any module
script executes, and `firebase-init.js` is auth-infrastructure code that should
not carry application routing config.

To disable the proxy (fall back to direct calls), remove the property or set it
to `null`:
```js
window.ATLAS_CONFIG.aiProxyUrl = null;
```

---

## Estimated Monthly Cost

At 1,000 AI calls per month using Claude Haiku 4.5 as the default model:

| Item | Rate | Estimate |
|---|---|---|
| Anthropic input tokens | $0.25 / 1M tokens | ~$0.10 (avg 400 input tokens/call) |
| Anthropic output tokens | $1.25 / 1M tokens | ~$0.19 (avg 150 output tokens/call) |
| Lambda invocations | $0.20 / 1M requests | ~$0.0002 |
| Lambda compute (256 MB, ~3s avg) | $0.0000166667 / GB-s | ~$0.012 |
| API Gateway HTTP API | $1.00 / 1M requests | ~$0.001 |
| **Total** | | **~$0.30 / month** |

Switching to Claude Sonnet 4.6 increases Anthropic costs by roughly 12x
(Sonnet is $3/1M input, $15/1M output). At 1,000 calls/month that is still
only ~$3–4/month. Lambda and API Gateway costs are negligible at this volume.

CloudWatch Logs are included in the AWS Free Tier for the first 5 GB/month;
structured log entries from this function are small (under 500 bytes each).
