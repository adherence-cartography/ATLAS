# ATLAS Firebase Realtime Database — Schema Reference

**Project:** `adherence-project-2026`
**Database URL:** `https://adherence-project-2026-default-rtdb.firebaseio.com`

All paths are accessed via the Firebase Realtime Database client SDK or the
REST API:
```
GET  https://adherence-project-2026-default-rtdb.firebaseio.com/{path}.json?auth={idToken}
POST https://adherence-project-2026-default-rtdb.firebaseio.com/{path}.json?auth={idToken}
PUT  https://adherence-project-2026-default-rtdb.firebaseio.com/{path}.json?auth={idToken}
```

`{idToken}` is the Firebase ID token from `firebase.auth().currentUser.getIdToken()`.

---

## Access Role Hierarchy

Custom claims embedded in every Firebase JWT issued by ATLAS Lambda:

| Claim | Values |
|-------|--------|
| `role` | `superadmin`, `institution`, `pi`, `researcher`, `clinician`, `student`, `spectator` |
| `workspace_key` | The caller's workspace identifier (e.g. `ATLAS-PI-001`) |
| `parent_institution` | Set for sub-workspaces; grants read on the parent workspace's data |

Anonymous sign-in is used for public/explorer sessions. Anonymous tokens carry
`firebase.sign_in_provider = "anonymous"` and no custom claims.

---

## Path Reference

| Path | Read Access | Write Access | Description | Schema |
|------|-------------|--------------|-------------|--------|
| `/public_stats` | Public (no auth) | Auth, non-anonymous | Aggregate MMAS-8 platform statistics | [PublicStats](#publicstats) |
| `/peacs_public_stats` | Public (no auth) | Auth, non-anonymous | Aggregate PEACS platform statistics | [PeacsPublicStats](#peacspublicstats) |
| `/assessments/{wsKey}/{id}` | Workspace owner, parent institution, superadmin | Workspace owner, superadmin | MMAS-8 assessment records | [MmasAssessment](#mmasassessment) |
| `/peacs_assessments/{wsKey}/{id}` | Workspace owner, parent institution, superadmin | Workspace owner, superadmin | PEACS assessment records | [PeacsAssessment](#peacsassessment) |
| `/peacs_dimensions` | Superadmin, institution, pi | Any workspace (non-null workspace_key) | PEACS dimension configuration | Object |
| `/workspace_profiles/{wsKey}` | Workspace owner, superadmin | Workspace owner, superadmin | Workspace configuration and feature flags | [WorkspaceProfile](#workspaceprofile) |
| `/workspaces` | Superadmin only (list) | Superadmin only | Master workspace registry | Object |
| `/workspaces/{wsKey}` | Workspace owner, superadmin | Superadmin only | Individual workspace record | Object |
| `/audit_log/{id}` | Superadmin only | Auth, non-anonymous | Platform-wide audit trail | [AuditLogEntry](#auditlogentry) |
| `/ws_audit/{wsKey}/{id}` | Workspace owner, pi, institution, superadmin | Auth, non-anonymous | Per-workspace audit log | Object |
| `/site_banner` | Public (no auth) | Superadmin only | Site-wide announcement banner | [SiteBanner](#sitebanner) |
| `/campaigns/{id}` | Auth (any, including anonymous) | Superadmin only | Campaign definitions for tagging assessments | [Campaign](#campaign) |
| `/mapData/{id}` | Auth (any, including anonymous) | Auth (any, including anonymous) | De-identified geographic pins for MMAS-8 globe | MapPin |
| `/peacs_mapData/{id}` | Auth (any, including anonymous) | Auth (any, including anonymous) | De-identified geographic pins for PEACS globe | MapPin |
| `/globalStats` | Public (no auth) | Auth (any) | Cached global statistics node | Object |
| `/config` | Superadmin only | Superadmin only | Platform configuration | Object |
| `/export_counts/{wsKey}` | Workspace owner, superadmin | Workspace owner, superadmin | Monthly export counters per workspace | Object |
| `/checkins/{wsKey}/{uid}` | Owner (uid match), workspace owner, superadmin | Owner (uid match), workspace owner | Per-user check-in records | Object |
| `/wad_checkins/{id}` | Auth (any, including anonymous) | Auth (any, including anonymous) | World Adherence Day / event check-ins (public feed) | CheckinRecord |
| `/wall_projects/{id}` | Auth (any, including anonymous) | Superadmin only | Featured research projects on the Wall display | Object |
| `/partner_sites/{wsKey}` | Auth (any, including anonymous) | Superadmin only | Partner research site locations for spectator map | PartnerSite |
| `/errors/{id}` | Superadmin only | Auth (any) | Client error reports | Object |
| `/warnings/{id}` | Superadmin only | Auth (any) | Client warning reports | Object |
| `/bulk_uploads/{id}` | Superadmin only | Auth (non-null workspace_key) | Bulk upload receipts and status | Object |

---

## Detailed Schema Definitions

### MmasAssessment

Stored at `/assessments/{workspaceKey}/{pushId}`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `q1` | integer (0–1) | Yes | Forget medication (0 = Never/Rarely, 1 = Sometimes/Usually/Always) |
| `q2` | integer (0–1) | Yes | Careless about taking (0 = No, 1 = Yes) |
| `q3` | integer (0–1) | Yes | Stopped when felt worse |
| `q4` | integer (0–1) | Yes | Stopped when felt better |
| `q5` | integer (0–1) | Yes | Trouble taking yesterday |
| `q6` | integer (0–1) | Yes | Stop when symptoms controlled |
| `q7` | integer (0–1) | Yes | Ever feel hassled by regimen |
| `q8` | integer (0–4) | Yes | Difficulty remembering: 0=Never, 1=Once in a while, 2=Sometimes, 3=Usually, 4=All the time |
| `mmas_score` | number (0–8) | Yes | Total MMAS-8 score |
| `adherence_tier` | string | No | `high` (=8), `medium` (6–<8), `low` (<6) |
| `patient_number` | string | No | De-identified participant ID assigned by researcher |
| `workspace_key` | string | No | Workspace key (mirrors path) |
| `study_id` | string | No | Study/protocol identifier |
| `site_id` | string | No | Site ID within a multi-site study |
| `site_name` | string | No | Human-readable site name |
| `parent_institution` | string | No | Parent institution key |
| `condition` | string | No | Medical condition |
| `medication` | string | No | Medication name or class |
| `age` | integer | No | Participant age in years |
| `age_range` | string | No | Discretized age range |
| `gender` | string | No | Participant gender |
| `education` | string | No | Education level (SDOH) |
| `insurance` | string | No | Insurance status (SDOH) |
| `employment` | string | No | Employment status (SDOH) |
| `income` | string | No | Household income band (SDOH) |
| `housing` | string | No | Housing stability (SDOH) |
| `transport` | string | No | Transportation access (SDOH) |
| `support` | string | No | Social support level (SDOH) |
| `country` | string | No | Full country name |
| `country_iso2` | string (`^[A-Z]{2}$`) | No | ISO 3166-1 alpha-2 code |
| `region` | string | No | Region or state |
| `city` | string | No | City of assessment |
| `latitude` | number | No | GPS latitude at submission |
| `longitude` | number | No | GPS longitude at submission |
| `language` | string | No | BCP47 language code (e.g. `en`, `es`, `ar`) |
| `collection_method` | string | No | `direct`, `qr_scan`, `bulk_upload`, `remote` |
| `institution_code` | string | No | Institution/partner code for spectator partner counts |
| `campaign_id` | string | No | Campaign identifier if submitted under a campaign |
| `ts` | integer (Unix ms) | Yes | Submission timestamp |
| `submitted_at` | string (ISO 8601) | No | Submission datetime string |
| `timestamp` | integer (Unix ms) | No | Alias of `ts` used in older records and mapData |

**Scoring notes:**
- Q1–Q7 each score 1 point for the non-adherent response (1 = adherent, 0 = non-adherent on Q1; reversed logic on others — see codebook).
- Q8 is ordinal 0–4, normalized to a 0–1 contribution in the total.
- `mmas_score` range: 0 (worst) – 8 (perfect adherence).

---

### PeacsAssessment

Stored at `/peacs_assessments/{workspaceKey}/{pushId}`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pe` | number (0–1) | Yes | Composite PEACS score |
| `base` | number (0–1) | Yes | Baseline adherence dimension |
| `mvmt` | number (0–1) | Yes | Movement/motivation dimension |
| `strata` | number (0–1) | Yes | Stratification / barriers dimension |
| `pe_score` | number | No | Alternate field name for `pe` (older records) |
| `workspace_key` | string | No | Workspace key |
| `patient_number` | string | No | De-identified participant ID |
| `condition` | string | No | Medical condition |
| `country` | string | No | Full country name |
| `country_iso2` | string | No | ISO 3166-1 alpha-2 code |
| `city` | string | No | City |
| `latitude` | number | No | GPS latitude |
| `longitude` | number | No | GPS longitude |
| `language` | string | No | BCP47 language code |
| `collection_method` | string | No | `direct`, `qr_scan`, `bulk_upload`, `remote` |
| `ts` | integer (Unix ms) | Yes | Submission timestamp |
| `timestamp` | integer (Unix ms) | No | Alias of `ts` |

**Zone classification:**
- Optimal: pe >= 0.85
- Good: 0.70 <= pe < 0.85
- Moderate: 0.55 <= pe < 0.70
- Poor: 0.40 <= pe < 0.55
- Critical: pe < 0.40

---

### WorkspaceProfile

Stored at `/workspace_profiles/{workspaceKey}`.

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | `superadmin`, `institution`, `pi`, `researcher`, `clinician`, `student`, `spectator` |
| `display_name` | string | Human-readable name |
| `institution_type` | string | `health`, `academic`, `amc` |
| `parent_institution` | string | Key of parent institution (sub-workspaces) |
| `tier` | string | `institutions`, `independent` |
| `features` | object | Feature-flag map (keys: feature name, values: boolean or config) |
| `email` | string | Contact email for magic-link/OTP delivery |
| `created_at` | integer | Creation timestamp (Unix ms) |

---

### PublicStats

Stored at `/public_stats`. Publicly readable (no auth required).

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total MMAS-8 assessments on the platform |
| `score_sum` | number | Running sum of all scores (divide by `total` for average) |
| `high_count` | integer | Assessments with score >= 6 |
| `countries` | object | Map of sanitized country keys to `true` |

**Seeding:** If the node is absent, `seedPublicStatsIfMissing()` populates it from `/assessments` on the first authenticated app load.

---

### PeacsPublicStats

Stored at `/peacs_public_stats`. Publicly readable.

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total PEACS assessments |
| `score_sum` | number | Running sum of pe scores |
| `high_count` | integer | Assessments with pe >= 0.6 |

---

### AuditLogEntry

Stored at `/audit_log/{pushId}` (written) and `/ws_audit/{wsKey}/{pushId}` (workspace copy).

| Field | Type | Description |
|-------|------|-------------|
| `action` | string (max 80 chars) | Action type (e.g. `data_export`, `superadmin_mfa_success`, `workspace_loaded`) |
| `timestamp` | integer (Unix ms) | When the action occurred |
| `uid` | string | Firebase UID of the acting user |
| `workspace` | string | Workspace key at time of action |
| `role` | string | Role claim at time of action |
| `records` | integer | Records involved (export operations) |
| `export_type` | string | Export format: `csv`, `xlsx`, `codebook` |
| `count` | integer | Generic count field |
| `tier` | string | Workspace tier at export time |
| `instrument` | string | Instrument exported: `mmas`, `peacs` |
| `rows` | integer | Row count (bulk operations) |

**Note:** Anonymous sessions never write audit log entries. Only PI, institution,
and superadmin roles generate the workspace-level `/ws_audit` copy.

---

### SiteBanner

Stored at `/site_banner`. Publicly readable; writable only by superadmin.

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Banner text displayed across all sessions |
| `type` | string | `info`, `warning`, `critical` |
| `active` | boolean | Whether the banner is currently displayed |
| `expires_at` | integer (Unix ms) | Optional auto-hide timestamp |

---

### Campaign

Stored at `/campaigns/{campaignId}`. Auth-readable (including anonymous); superadmin write.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Campaign display name |
| `icon` | string | Emoji or short icon string |
| `color` | string | Hex color for feed badges |
| `active` | boolean | Whether campaign is currently running |
| `starts_at` | integer (Unix ms) | Campaign start time |
| `ends_at` | integer (Unix ms) | Campaign end time |
| `description` | string | Campaign description |

---

### MapPin (mapData / peacs_mapData)

Stored at `/mapData/{pushId}` and `/peacs_mapData/{pushId}`.
De-identified — no PII. Auth-readable/writable (including anonymous).

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | MMAS-8 score (mapData) or pe score (peacs_mapData) |
| `city` | string | City name (or "Unknown") |
| `country` | string | Country name (or "Unknown") |
| `latitude` | number | GPS latitude |
| `longitude` | number | GPS longitude |
| `timestamp` | integer (Unix ms) | Submission time |
| `tool` | string | `map` or `mmas` (spectator mode disambiguation) |

---

### PartnerSite

Stored at `/partner_sites/{workspaceKey}`. Auth-readable (including anonymous); superadmin write.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Site display name |
| `city` | string | City |
| `country` | string | Country |
| `latitude` | number | Site latitude |
| `longitude` | number | Site longitude |
| `partner` | boolean | Must be `true` to render on spectator map |
| `active` | boolean | Whether site is currently active |
| `color` | string | Hex color for map marker (default: `#d4a843`) |

---

## Special Behaviors

### Public Stats Transactions

Both `/public_stats` and `/peacs_public_stats` are updated via Firebase
**atomic transactions** (`transaction(n => (n||0)+1)`) on every assessment
submission. This prevents race conditions when multiple clients submit
simultaneously.

### Offline Persistence

The Firebase client is initialized with `firebase.database().goOnline()`.
Assessment writes are queued locally when offline and synced when
connectivity restores — critical for LMIC deployments with intermittent networks.

### Session Expiry Guard

`firebase.auth().onIdTokenChanged()` monitors for session expiry. If the token
lapses while a workspace is loaded, the workspace state is cleared and
anonymous auth is re-established so public reads continue working.

### Country Key Sanitization

Before writing to `/public_stats/countries`, country names are sanitized with:
```js
key = country.trim().replace(/[.#$\/\[\]]/g, '_') || 'unknown'
```
Firebase RTDB key characters `.`, `#`, `$`, `/`, `[`, `]` are replaced with `_`.

### Per-workspace Audit Copy

When `atlasAuditLog()` is called by a PI, institution, or superadmin user,
an abbreviated entry is also pushed to `/ws_audit/{workspaceKey}` so PI-tier
users can view their own access history without full platform visibility.
