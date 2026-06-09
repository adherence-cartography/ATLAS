# ATLAS Authentication Flows

ATLAS uses Firebase Authentication with custom tokens issued by an AWS Lambda
function. Three flows are supported, selected based on the workspace key type
and whether a registered email is on file.

**Lambda base URL:**
`https://fv3y62xuce6w3t37oj73x5gzcq0uwdqo.lambda-url.us-east-1.on.aws`

**Firebase project:** `adherence-project-2026`

---

## Flow 1 — Magic Link (all non-superadmin roles)

Used when the workspace key is associated with a registered email address and
the key does NOT have MFA configured. This is the default flow for researcher,
PI, institution, clinician, and student accounts.

**Lambda response that triggers this flow:** `{ valid: true, magic_required: true, email_hint: "j***@example.com", profile: {...} }`

```
User                    ATLAS Client              Lambda (AWS)           Firebase Auth
 |                           |                        |                       |
 |-- Enter workspace key --> |                        |                       |
 |                           |-- POST /validate-key ->|                       |
 |                           |   { key: "ATLAS-PI-001"|                       |
 |                           |<-- { valid:true,        |                       |
 |                           |    magic_required:true, |                       |
 |                           |    email_hint,          |                       |
 |                           |    profile } -----------|                       |
 |                           |                        |                       |
 |<-- "Check your email" --- |                        |                       |
 |    (magic link sent)      |   (Lambda sent email)  |                       |
 |                           |                        |                       |
 |-- Opens magic link ------>|  (cross-tab or same    |                       |
 |   (in email client)       |   tab via             |                       |
 |                           |   localStorage event)  |                       |
 |                           |                        |                       |
 |                           |-- POST /validate-key ->|                       |
 |                           |   (magic token in URL  |                       |
 |                           |    or storage event)   |                       |
 |                           |<-- { valid:true,        |                       |
 |                           |    token: <Firebase     |                       |
 |                           |    custom token> } -----|                       |
 |                           |                        |                       |
 |                           |-- signInWithCustomToken(token) --------------->|
 |                           |<-- Firebase ID token (with role/workspace      |
 |                           |    claims embedded) ----------------------------|
 |                           |                        |                       |
 |<-- Dashboard unlocked --- |                        |                       |
 |    workspace data loaded  |                        |                       |
```

**Client state variables:**
- `_magicPendingKey` — workspace key waiting for link click
- `_magicPendingProfile` — profile returned at `magic_required` step
- `_magicResendCooldown` — throttles resend button (30-second cooldown)

**Cross-tab completion:** The client calls `_startMagicLinkListener()` which
watches for a `localStorage` event so the original tab can complete sign-in
when the user clicks the link in a different tab or browser window.

**Resend:** `POST /validate-key` with the same key triggers a fresh magic link
via `resendMagicLink()`. A 30-second cooldown is enforced on the button.

---

## Flow 2 — MFA / OTP (superadmin)

Used when the key has `mfa_required: true` in the Lambda response. In the
current implementation this applies to all keys that have an email address
(researcher, student, institution, and superadmin alike), but the OTP
verification endpoint is the path used for superadmin promotion.

**Lambda response that triggers this flow:** `{ valid: true, mfa_required: true, session_token: "...", profile: {...} }`

```
User                    ATLAS Client              Lambda (AWS)           Firebase Auth
 |                           |                        |                       |
 |-- Enter workspace key --> |                        |                       |
 |                           |-- POST /validate-key ->|                       |
 |                           |   { key: "SUPERADMIN"  |                       |
 |                           |<-- { valid:true,        |                       |
 |                           |    mfa_required:true,   |                       |
 |                           |    session_token,       |                       |
 |                           |    profile } -----------|                       |
 |                           |                        |                       |
 |                           |  (stores session_token |                       |
 |                           |   in _mfaSessionToken) |                       |
 |                           |                        |                       |
 |<-- OTP input shown ---    |                        |                       |
 |    "Enter 6-digit code"   |   (Lambda sent OTP to  |                       |
 |    from your email        |    registered email)   |                       |
 |                           |                        |                       |
 |-- Enter 6-digit OTP ----->|                        |                       |
 |                           |-- POST /verify-otp --->|                       |
 |                           |   { session_token,     |                       |
 |                           |     otp: "123456" }    |                       |
 |                           |                        |                       |
 |   [OTP invalid path]      |<-- { valid:false,       |                       |
 |<-- Error shown            |    error: "..." } ------|                       |
 |   (OTP field cleared)     |                        |                       |
 |                           |                        |                       |
 |   [OTP valid path]        |<-- { valid:true,        |                       |
 |                           |    token: <Firebase     |                       |
 |                           |    custom token> } -----|                       |
 |                           |                        |                       |
 |                           |-- signInWithCustomToken(token) --------------->|
 |                           |<-- Firebase ID token (role=superadmin claims)--|
 |                           |                        |                       |
 |                           |  atlasAuditLog(         |                       |
 |                           |    "superadmin_mfa_     |                       |
 |                           |     success")           |                       |
 |                           |                        |                       |
 |<-- Dashboard unlocked --- |                        |                       |
 |    (superadmin access)    |                        |                       |
```

**Client state variables:**
- `_mfaPendingKey` — the key that passed initial validation
- `_mfaPendingProfile` — profile from the validate-key response
- `_mfaSessionToken` — short-lived session token for OTP exchange
- `_mfaResendCooldown` — throttles `/resend-otp` calls (30-second cooldown)

**Resend OTP:** `POST /resend-otp` with `{ session_token }` triggers a fresh
OTP email via `resendSuperadminOTP()`.

**Audit:** On successful MFA completion, `atlasAuditLog("superadmin_mfa_success", { workspace: key })`
is written to `/audit_log`.

**OTP format:** 6 numeric digits, validated client-side with `/^\d{6}$/`
before the network call is made.

---

## Flow 3 — Anonymous (explorer / public)

Used automatically for every visitor who has not entered a workspace key.
Firebase anonymous sign-in gives the session a valid auth token so
Firebase Security Rules that require `auth != null` are satisfied (public
stats, map data, campaigns, site banner, etc.).

```
User                    ATLAS Client              Firebase Auth
 |                           |                        |
 |-- Page load ------------->|                        |
 |                           |-- signInAnonymously() ->|
 |                           |<-- Anonymous session    |
 |                           |   (ephemeral UID,       |
 |                           |    no custom claims)    |
 |                           |                        |
 |<-- Globe / public map --- |                        |
 |    shown immediately      |                        |
 |                           |                        |
 |                           |-- Read /public_stats   |
 |                           |   /mapData             |
 |                           |   /campaigns           |
 |                           |   /site_banner ------->|
 |                           |<-- Data returned        |
 |                           |   (auth != null rules   |
 |                           |    satisfied by anon)   |
 |                           |                        |
 |   [~10 minutes later]     |                        |
 |<-- "Enter workspace key"  |                        |
 |    prompt shown           |                        |
 |                           |                        |
 |   [User enters key]       |                        |
 |   -----> Flow 1 or 2 ----> (anonymous session      |
 |          (above)           overridden by           |
 |                            signInWithCustomToken)  |
```

**Session expiry recovery:** If the Firebase token expires while a workspace
is loaded (e.g. tab left open overnight), `firebase.auth().onIdTokenChanged()`
detects the sign-out, clears `currentWorkspace` and `workspaceProfile` from
state and `sessionStorage`, shows a toast message, and re-establishes anonymous
auth so public Firebase reads continue working.

**Limitations of anonymous sessions:**
- Can read: `/public_stats`, `/peacs_public_stats`, `/mapData`, `/peacs_mapData`, `/campaigns`, `/site_banner`, `/globalStats`, `/partner_sites`, `/wad_checkins`, `/wall_projects`
- Cannot read: `/assessments`, `/peacs_assessments`, `/workspace_profiles`, `/audit_log`, `/workspaces`, `/config`, `/export_counts`, `/bulk_uploads`, `/errors`, `/warnings`
- Cannot write: `/public_stats`, `/peacs_public_stats`, `/audit_log`, `/ws_audit`, `/errors`, `/warnings`

**Note:** Anonymous sessions are not persisted between page reloads (ephemeral
Firebase UID). Workspace sessions are stored in `sessionStorage` under keys
`atlas_workspace` and `atlas_workspace_profile` for the duration of the browser
tab, then cleared.

---

## Key Validation — Lambda Endpoint Summary

| Endpoint | Method | Body | Success Response | Purpose |
|----------|--------|------|-----------------|---------|
| `/validate-key` | POST | `{ key: string }` | `{ valid, token?, mfa_required?, magic_required?, session_token?, email_hint?, profile }` | Initial key lookup; triggers magic link email if configured |
| `/verify-otp` | POST | `{ session_token, otp }` | `{ valid, token?, error? }` | Exchanges OTP code for Firebase custom token |
| `/resend-otp` | POST | `{ session_token }` | 200 OK | Triggers a fresh OTP email for the active session |

**Timeout:** All Lambda calls are aborted after 12 seconds using `AbortController`.
Cold-start Lambda instances may take 3–5 seconds; warm instances typically
respond in under 500 ms.

**Key lookup:** Workspace keys are stored in AWS SSM Parameter Store at
`/atlas/workspaces/{KEY}` as `SecureString` parameters. The Lambda uses an
in-memory cache (`Map`) for warm instance performance and falls back to SSM
on cache miss.

---

## Firebase Custom Token Claims

The Lambda embeds the following claims in every custom token it issues. These
claims are verified server-side by Firebase Security Rules (`auth.token.*`):

| Claim | Type | Description |
|-------|------|-------------|
| `role` | string | Access role: `superadmin`, `institution`, `pi`, `researcher`, `clinician`, `student`, `spectator` |
| `workspace_key` | string | The workspace identifier |
| `parent_institution` | string | Parent institution key (sub-workspaces only) |

Claims are also available on the client via
`firebase.auth().currentUser.getIdTokenResult()` for UI feature-gating.
The Command Center (`openCommandCenter()`) uses `getIdTokenResult(false)` with a
live token refresh to hard-verify superadmin status before displaying
admin controls.
