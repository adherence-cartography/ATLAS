# ATLAS Partner API

Generic instrument submission API for third-party integrations. Exposes the MAP, MMAS-8, and PEACS assessment instruments as a REST API. Partners authenticate with a pre-issued API key and receive scored results immediately. All submissions are persisted to Firebase and optionally pushed to a registered webhook endpoint.

---

## Authentication

Every request (except `GET /v1/health`) must include the header:

```
X-Partner-Key: <your-api-key>
```

Keys are provisioned manually in Firebase under `partner_keys/{apiKey}`. Contact ATLAS to request a key.

---

## Rate Limits

- Default limit: **1,000 requests per day** per partner key.
- The counter resets at **midnight UTC**.
- A custom limit can be set on the key record (`rate_limit` field).
- When exceeded the API returns `429` with the current count and reset time.

---

## Endpoints

### GET /v1/health

No authentication required. Use this to verify connectivity during integration setup.

**Response 200**
```json
{
  "status": "ok",
  "version": "1.0",
  "timestamp": "2026-06-10T09:00:00.000Z"
}
```

---

### POST /v1/map/submit

Submit a MAP (Medication Adherence Phenotyping) assessment. Requires 8 numeric responses on a 0-1 scale.

**Request body**
```json
{
  "patient_ref": "PATIENT-001",
  "responses": [0.8, 0.6, 0.7, 0.5, 0.9, 0.4, 0.6, 0.8],
  "condition": "hypertension",
  "drug": "amlodipine",
  "age_range": "45-54",
  "gender": "female",
  "city": "London",
  "country": "GB",
  "metadata": { "clinic_id": "CL-42" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_ref` | string | No | Pseudonymised patient identifier (your internal reference) |
| `responses` | number[8] | Yes | Eight MAP responses, each 0.0 to 1.0 |
| `condition` | string | No | Medical condition being treated |
| `drug` | string | No | Medication name |
| `age_range` | string | No | e.g. "45-54" |
| `gender` | string | No | e.g. "female" |
| `city` | string | No | Patient city |
| `country` | string | No | ISO 3166-1 alpha-2 country code |
| `metadata` | object | No | Arbitrary key-value pairs passed through to Firebase |

**Response 200**
```json
{
  "assessment_id": "3f2e1a4b-...",
  "result": {
    "base": 0.833,
    "mvmt": 0.567,
    "strata": 0.775,
    "pe": 0.715,
    "phenotype": "Routine Forgetter",
    "intervention": {
      "strategy": "Habit Anchoring",
      "actions": [
        "Visible pill organizer placement",
        "Smartphone alarm linked to daily routine",
        "Blister pack dispensing"
      ]
    }
  },
  "timestamp": "2026-06-10T09:01:23.456Z"
}
```

**MAP scoring formula**

| Dimension | Inputs | Formula |
|-----------|--------|---------|
| `base` | q1, q5, q8 | mean of responses[0,4,7] |
| `mvmt` | q2, q3, q6 | mean of responses[1,2,5] |
| `strata` | q4, q7 | 0.5 + 0.5 * mean(responses[3,6]) |
| `pe` | all | cube_root(base * mvmt * strata) |

---

### POST /v1/mmas/submit

Submit an MMAS-8 (Morisky Medication Adherence Scale) assessment.

**Request body**
```json
{
  "patient_ref": "PATIENT-001",
  "responses": [false, false, true, false, false, false, false, 1],
  "condition": "diabetes",
  "drug": "metformin",
  "age_range": "35-44",
  "gender": "male",
  "city": "Manchester",
  "country": "GB",
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `responses` | array[8] | Yes | Responses 1-7 are boolean (true = missed dose), response 8 is 1-5 scale |

**MMAS scoring formula**

- Each of q1-q7: score 1 if `false` (never missed), 0 if `true` (missed)
- q8: score 1 if value equals 1, otherwise 0
- Total score 0-8. Score below 6 = low adherence.

**Response 200**
```json
{
  "assessment_id": "7c3d2e5f-...",
  "result": {
    "score": 7,
    "normalised": 0.875,
    "low_adherence": false
  },
  "timestamp": "2026-06-10T09:02:11.000Z"
}
```

---

### POST /v1/peacs/submit

Submit a PEACS (Phenotypic Expression of Adherence Composite Score) session result. Use this when MAP subscores have already been computed in your own pipeline and you want to store, phenotype, and trigger webhook delivery.

**Request body**
```json
{
  "patient_ref": "PATIENT-001",
  "session_type": "STRATA",
  "base": 0.72,
  "mvmt": 0.48,
  "strata": 0.81,
  "condition": "hypertension",
  "drug": "lisinopril",
  "metadata": { "session_id": "sess-99" }
}
```

Alternatively, supply a pre-computed `pe` value instead of `base`/`mvmt`/`strata` (phenotype classification will be skipped in that case):

```json
{
  "patient_ref": "PATIENT-001",
  "session_type": "BASE",
  "pe": 0.64,
  "condition": "hypertension",
  "drug": "lisinopril"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_type` | string | No | One of `BASE`, `MVMT`, `STRATA` |
| `base` | number | Conditional | MAP base dimension score (0-1) |
| `mvmt` | number | Conditional | MAP movement dimension score (0-1) |
| `strata` | number | Conditional | MAP strata dimension score (0-1) |
| `pe` | number | Conditional | Pre-computed PE score. Required if base/mvmt/strata not all provided. |

**Response 200**
```json
{
  "assessment_id": "9a1b4c7d-...",
  "result": {
    "pe": 0.638,
    "phenotype": "Side-Effect Avoider",
    "intervention": {
      "strategy": "Side Effect Management",
      "actions": [
        "Identify specific side effect",
        "Timing adjustment (with food/evening)",
        "Therapeutic substitution review"
      ]
    }
  },
  "timestamp": "2026-06-10T09:03:00.000Z"
}
```

---

### GET /v1/results/{assessment_id}

Retrieve a single assessment record. The record must belong to your partner key.

**Example**
```
GET /v1/results/3f2e1a4b-c5d6-7e8f-9012-abcdef012345
X-Partner-Key: pk_live_abcdef
```

Returns the full stored record including all raw inputs, scores, phenotype, and metadata.

**Errors**

| Code | Reason |
|------|--------|
| 404 | Assessment not found |
| 403 | Assessment belongs to a different partner |

---

### GET /v1/patient/{patient_ref}/results

Retrieve all assessments for a given patient reference belonging to your partner account, sorted by timestamp ascending.

**Query parameters**

| Param | Values | Description |
|-------|--------|-------------|
| `instrument` | `map`, `mmas`, `peacs` | Filter by instrument type |

**Example**
```
GET /v1/patient/PATIENT-001/results?instrument=map
X-Partner-Key: pk_live_abcdef
```

**Response 200**
```json
{
  "patient_ref": "PATIENT-001",
  "total": 2,
  "results": [
    { "assessment_id": "...", "tool": "map", "pe": 0.71, "phenotype": "Routine Forgetter", "timestamp": 1749550883456 },
    { "assessment_id": "...", "tool": "map", "pe": 0.79, "phenotype": "Optimistic Stopper", "timestamp": 1749637283456 }
  ]
}
```

---

### GET /v1/stats

Returns usage statistics and assessment counts for your partner account.

**Response 200**
```json
{
  "partner": "Acme Health",
  "workspace": "ACME",
  "usage": {
    "today": 42,
    "rate_limit": 1000,
    "month_total": 834
  },
  "assessments": {
    "total": 1209,
    "map": 800,
    "mmas": 350,
    "peacs": 59
  },
  "webhook": {
    "url_configured": true,
    "last_delivery_status": 200
  }
}
```

---

## Phenotype Reference

| Phenotype | Condition | Recommended Strategy |
|-----------|-----------|---------------------|
| Intentional Resistor | base < 0.55, mvmt >= 0.55, strata >= 0.55 | Motivational Interviewing |
| Routine Forgetter | mvmt < 0.55, base >= 0.55, strata >= 0.55 | Habit Anchoring |
| Situational Skipper | strata < 0.55, base >= 0.55, mvmt >= 0.55 | Flexible Dosing Protocol |
| Side-Effect Avoider | base < 0.55 AND mvmt < 0.55 | Side Effect Management |
| Optimistic Stopper | all others | Long-term Consequence Education |

---

## Webhooks

### Overview

Every successful submission triggers an HTTP POST to your registered `webhook_url`. The request uses a 5-second timeout and does not retry on failure (check `last_delivery_status` via `/v1/stats`).

### Payload format

```json
{
  "event": "assessment.completed",
  "instrument": "map",
  "assessment_id": "3f2e1a4b-...",
  "patient_ref": "PATIENT-001",
  "result": {
    "base": 0.833,
    "mvmt": 0.567,
    "strata": 0.775,
    "pe": 0.715,
    "phenotype": "Routine Forgetter",
    "intervention": { "strategy": "...", "actions": ["..."] }
  },
  "timestamp": "2026-06-10T09:01:23.456Z"
}
```

### Signature verification

Each webhook request includes the header:

```
X-Atlas-Signature: sha256=<hex>
```

The hex value is HMAC-SHA256 of the raw request body using your `webhook_secret`. Verify it on your server before processing:

**Node.js example**
```js
const crypto = require('crypto');

function verifyAtlasWebhook(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

// Express middleware example
app.post('/atlas-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-atlas-signature'];
  if (!verifyAtlasWebhook(req.body, sig, process.env.ATLAS_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  const payload = JSON.parse(req.body.toString());
  // handle payload...
  res.sendStatus(200);
});
```

**Python example**
```python
import hmac, hashlib

def verify_atlas_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature_header, expected)
```

---

## Partner Key Setup

A partner key record in Firebase (`partner_keys/{apiKey}`) has the following structure:

```json
{
  "name": "Acme Health",
  "workspace": "ACME",
  "active": true,
  "instruments": ["map", "mmas", "peacs"],
  "webhook_url": "https://app.acmehealth.com/atlas/webhook",
  "webhook_secret": "whs_super_secret_string",
  "rate_limit": 1000,
  "country": "GB"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the partner organisation |
| `workspace` | string | Short code used as `institution_code` on all stored records |
| `active` | boolean | Set to `false` to immediately suspend a partner without deleting the key |
| `instruments` | string[] | Subset of `["map","mmas","peacs"]` the partner is licensed to use. Omit the field to allow all. |
| `webhook_url` | string | HTTPS endpoint to receive assessment events. Optional. |
| `webhook_secret` | string | Shared secret for HMAC signature verification. Optional but strongly recommended. |
| `rate_limit` | number | Maximum requests per calendar day (UTC). Default: 1000. |
| `country` | string | Default country code applied when not supplied in the submission body. |

To provision a new partner, add the record manually in the Firebase Realtime Database console or via the ATLAS admin API.

---

## Data Stored in Firebase Per Submission

### MAP and MMAS assessments (`assessments/{uuid}`)

| Field | Description |
|-------|-------------|
| `assessment_id` | UUID of this record |
| `tool` | `"map"` or `"mmas"` |
| `source` | `"partner_api"` |
| `partner_key` | The API key used to submit |
| `workspace` | Partner workspace code |
| `institution_code` | Same as workspace (for compatibility with ATLAS query layer) |
| `patient_ref` | Partner's pseudonymised patient identifier |
| `condition` | Medical condition |
| `drug` | Medication name |
| `age_range` | Patient age band |
| `gender` | Patient gender |
| `city` | Patient city |
| `country` | ISO country code |
| `responses` | Raw response array |
| `base`, `mvmt`, `strata`, `pe` | MAP scores (MAP only) |
| `phenotype` | Classified phenotype (MAP only) |
| `intervention` | Recommended intervention object (MAP only) |
| `score`, `normalised`, `low_adherence` | MMAS scores (MMAS only) |
| `metadata` | Arbitrary partner-supplied metadata |
| `timestamp` | Unix ms timestamp |

### PEACS assessments (`peacs_assessments/{uuid}`)

Same fields as above, plus `session_type`. No `responses` array (MAP subscores supplied directly).

### Usage counters (`partner_usage/{apiKey}/{YYYY-MM-DD}`)

Integer counter incremented on every authenticated, non-rate-limited request. Used to enforce daily limits and power the `/v1/stats` endpoint.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON string of the Firebase service account credentials |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL (defaults to the ATLAS production database) |

---

## Error Reference

| Code | Meaning |
|------|---------|
| 400 | Validation error (missing or malformed fields) |
| 401 | Missing or invalid `X-Partner-Key` |
| 403 | Partner inactive, or instrument not licensed for this key |
| 404 | Assessment or route not found |
| 429 | Daily rate limit exceeded |
| 502 | Internal Firebase or processing error |
