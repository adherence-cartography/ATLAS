# ATLAS REST API v1 — Setup Guide

ATLAS REST API layer: Cloudflare Worker + D1 (serverless SQLite).
Institutions and third-party systems can integrate with ATLAS via standard
HTTP. Firebase JWT tokens issued to workspace users are accepted as Bearer
credentials — no separate API key system required.

---

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
  installed and authenticated (`wrangler login`)
- Cloudflare account with Workers and D1 access

---

## Step 1 — Create the D1 database

```bash
wrangler d1 create atlas-db
```

The output will include a `database_id`. Copy it.

Example output:
```
✅ Successfully created DB 'atlas-db' in region WEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "atlas-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## Step 2 — Add the database_id to wrangler.api.toml

Open `api/wrangler.api.toml` and replace the placeholder:

```toml
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

with the UUID from Step 1.

---

## Step 3 — Run the schema

```bash
# From the cloudbase_modular/ directory:
wrangler d1 execute atlas-db --file=api/schema.sql

# Verify tables were created:
wrangler d1 execute atlas-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Step 4 — Deploy the API worker

```bash
# From the cloudbase_modular/ directory:
wrangler deploy --config api/wrangler.api.toml
```

This deploys `api/_api_worker.js` as a separate Cloudflare Worker named
`atlas-api`. It runs independently of the main `atlas` worker and is
accessible at `https://atlas-api.<your-subdomain>.workers.dev`.

---

## Step 5 — Route /api/* from the main worker (optional)

If you want `https://atlas.adherence.cc/api/v1/*` to hit the API worker
(instead of a separate subdomain), add a service binding to the main
`wrangler.toml` and proxy in `_worker.js`.

**In `wrangler.toml`:**

```toml
[[services]]
binding = "API_WORKER"
service  = "atlas-api"
```

**In `_worker.js`** — add before the `isAssessPath` block:

```javascript
// Proxy /api/* requests to the API worker
if (url.pathname.startsWith('/api/')) {
  return env.API_WORKER.fetch(request);
}
```

Redeploy the main worker after this change:

```bash
wrangler deploy
```

---

## Environment variables

The API worker reads only from the D1 binding (`env.DB`). No additional
environment variables are required for basic operation.

If you add full JWT signature verification (see Security section below),
you will need the Firebase project ID available at runtime. You can either
hard-code it in `_api_worker.js` (it is already in `firebase-init.js` as
`adherence-project-2026`) or set it as a Worker secret:

```bash
wrangler secret put FIREBASE_PROJECT_ID --config api/wrangler.api.toml
# Enter: adherence-project-2026
```

---

## Security — JWT signature verification

**Current state:** The worker decodes the JWT payload and checks the `exp`
claim only. It does NOT verify the RS256 signature against Firebase's public
keys. This is acceptable when the API worker is deployed behind Cloudflare
Access (which validates the token before it reaches the Worker), or while
in development/testing.

**For production without Cloudflare Access**, implement full signature
verification:

1. Fetch Firebase public keys from:
   `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
2. Use the Web Crypto API (`crypto.subtle.verify`) with the RS256 algorithm
   and the matching public key (identified by the JWT `kid` header claim).
3. Verify the `iss` claim equals
   `https://securetoken.google.com/adherence-project-2026`
4. Verify the `aud` claim equals `adherence-project-2026`

Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

Cache the public keys response (it includes `Cache-Control` headers) using
`ctx.waitUntil` + Cloudflare Cache API to avoid fetching on every request.

---

## Rate limiting

The main `atlas` worker applies IP-based rate limiting (60 req/min via
Cache API) before proxying. If the API worker is accessed directly on its
own subdomain (not proxied), it inherits no rate limit.

To add a dedicated limit, copy the `checkRateLimit` function from
`_worker.js` into `_api_worker.js` and call it at the top of `fetch()`.
For globally consistent counters across all Cloudflare PoPs, add a KV
namespace binding and replace the Cache API calls with KV get/put.

---

## Example API calls (curl)

Obtain a Firebase ID token for your workspace first (the ATLAS frontend
calls `firebase.auth().currentUser.getIdToken()` — copy it from DevTools
or from your integration code).

```bash
TOKEN="eyJhbGciOiJS..."   # Firebase ID token

# Health check (no token required)
curl https://atlas-api.<subdomain>.workers.dev/api/v1/health

# Workspace profile
curl -H "Authorization: Bearer $TOKEN" \
     https://atlas-api.<subdomain>.workers.dev/api/v1/workspace

# List assessments (paginated)
curl -H "Authorization: Bearer $TOKEN" \
     "https://atlas-api.<subdomain>.workers.dev/api/v1/assessments?page=1&limit=50"

# Filter by adherence tier
curl -H "Authorization: Bearer $TOKEN" \
     "https://atlas-api.<subdomain>.workers.dev/api/v1/assessments?tier=low"

# Submit a new MMAS-8 assessment
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "q1": 0, "q2": 0, "q3": 0, "q4": 0,
       "q5": 0, "q6": 0, "q7": 0, "q8": 0,
       "patient_number": "PT-001",
       "condition": "hypertension",
       "medication": "lisinopril",
       "country": "US"
     }' \
     https://atlas-api.<subdomain>.workers.dev/api/v1/assessments

# Get a single assessment by ID
curl -H "Authorization: Bearer $TOKEN" \
     https://atlas-api.<subdomain>.workers.dev/api/v1/assessments/<id>

# Workspace aggregate statistics
curl -H "Authorization: Bearer $TOKEN" \
     https://atlas-api.<subdomain>.workers.dev/api/v1/stats

# Public platform-wide stats (no token required)
curl https://atlas-api.<subdomain>.workers.dev/api/v1/stats/public

# Export all assessments as CSV
curl -H "Authorization: Bearer $TOKEN" \
     https://atlas-api.<subdomain>.workers.dev/api/v1/export/csv \
     -o atlas_export.csv
```

---

## MMAS-8 scoring reference

| Score | Tier   | Meaning                    |
|-------|--------|----------------------------|
| 8     | high   | High adherence             |
| 6–7   | medium | Medium adherence           |
| < 6   | low    | Low adherence              |

Q1–Q7 are boolean (0 = took medication, 1 = missed).
Q8 is a 0–4 Likert scale (0 = never forgot, 4 = always forgot).

MMAS-8 © Donald E. Morisky. Use governed by license from Adherence Inc.

---

## File inventory

```
api/
  _api_worker.js     — Cloudflare Worker source (all route handlers)
  schema.sql         — D1 table definitions + indexes
  wrangler.api.toml  — Wrangler config for the atlas-api worker
  SETUP.md           — This file
```
