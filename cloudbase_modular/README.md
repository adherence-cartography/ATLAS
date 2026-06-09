# ATLAS Platform — Cloudbase Modular

ATLAS (Adherence Tracking & Learning Assessment System) is the web application powering [atlas.adherence.cc](https://atlas.adherence.cc). It delivers MMAS-8 and PEACS adherence assessments, a multi-role research dashboard, and clinical billing tools (MTM/CCM/RTM) to researchers, clinicians, institutions, and patients worldwide. The platform is deployed as a Cloudflare Workers edge site backed by Firebase Realtime Database and Firebase Auth.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Edge runtime | Cloudflare Workers (`_worker.js`) |
| Static assets | Cloudflare CDN (bound via `ASSETS`) |
| Auth | Firebase Auth — anonymous + custom token (Magic Link) |
| Database | Firebase Realtime Database |
| File storage | AWS S3 (bulk upload template `.xlsm`) |
| Frontend | Vanilla JS, modular `.js` files loaded via `lazy-loader.js` |

---

## Directory Structure

```
cloudbase_modular/
├── _worker.js          # Cloudflare Worker: rate limiting, routing, security headers, S3 proxy
├── wrangler.toml       # Cloudflare deployment config (worker name, assets binding)
├── index.html          # Main app shell (dashboard, public entry, workspace login)
├── assess.html         # Standalone assessment page (served at /assess)
├── atlas.css           # Global stylesheet
├── _v86_html.html      # Legacy v8.6 HTML snapshot (reference only)
├── _v86_js.js          # Legacy v8.6 JS snapshot (reference only)
├── _psych_html.html    # Psychology module HTML snapshot (reference only)
├── _psych_js.js        # Psychology module JS snapshot (reference only)
└── modules/            # All feature modules — see Module Map below
```

---

## Module Map

| File | Purpose |
|---|---|
| `firebase-init.js` | Firebase app init, anonymous auth, public stats aggregation, audit log writer, session expiry guard |
| `auth-roles.js` | Role helpers (`isSuperAdmin`, `isPIMode`, `isClinician`, etc.), feature entitlement gates, View-As toolbar for superadmin QA |
| `auth-workspace.js` | Workspace key entry, Magic Link flow, custom token sign-in, `sessionStorage` caching |
| `app-init.js` | App bootstrap — DOM ready, module load order, global state init |
| `lazy-loader.js` | Deferred script loading; loads modules on demand to reduce initial parse time |
| `dashboard-core.js` | Main dashboard render loop, screen routing, workspace entry gate |
| `dashboard-refresh.js` | Live data refresh, Firebase listener management, polling intervals |
| `dashboard-sections-b.js` | Secondary dashboard panels (stats cards, charts, cohort views) |
| `dashboard-utils.js` | Shared dashboard helpers (formatters, date utils, DOM builders) |
| `translations.js` | ATLAS i18n / translation system: locale strings, language switching |
| `admin-panel.js` | Admin panel UI: workspace management, user list, key generation |
| `admin-keys.js` | Workspace key CRUD — create, revoke, audit key usage |
| `admin-tools.js` | Supplementary admin tooling (exports, bulk ops, diagnostics) |
| `audit-router-state.js` | Client-side router state tracker; feeds audit log with screen transitions |
| `mmas-submission.js` | MMAS-8 assessment form logic, scoring, and Firebase write |
| `consent-mmas-questions.js` | Consent flow and MMAS question rendering |
| `peacs-core.js` | PEACS assessment engine — scoring, tier gating, results rendering |
| `forms-helpers.js` | Shared form validation, input masking, error display utilities |
| `export-functions.js` | CSV / data export, export cap enforcement, audit logging of exports |
| `bulk-upload-analytics.js` | Bulk `.xlsm` upload parser, validation, batch Firebase writes |
| `clinical-billing.js` | MTM / CCM / RTM billing code panels, role-gated by clinician type |
| `clinical-practice.js` | Clinical practice dashboard: patient list, intervention guidance, CPO panel |
| `pi-research.js` | PI / investigator view: cohort analytics, sub-workspace management, IRB cert |
| `analytics-campaigns.js` | Campaign performance analytics, outreach tracking |
| `campaigns-perpetual.js` | Campaign builder UI — create, schedule, and manage campaigns |
| `student-workspace.js` | Student-tier workspace: limited export cap, basic PEACS, thesis tools |
| `explorer.js` | Explorer / public mode: anonymous public stats view, no auth required |
| `spectator.js` | Spectator role: read-only view of a single workspace, no writes |
| `partners.js` | Partner portal: co-branding, partner workspace linking |
| `help-account.js` | In-app help drawer, account settings, contact/support flow |
| `lang-conditions.js` | Condition and language lookup tables for assessment localisation |
| `theme-geo.js` | Theme switcher and geo-based display adjustments |
| `qr-generation.js` | QR code generation for assessment links and workspace entry |
| `ui/` | UI component sub-modules (modals, toasts, tables, etc.) |

---

## Deployment

```bash
cd cloudbase_modular
npx wrangler deploy
```

This deploys `_worker.js` plus all static assets in `./` to Cloudflare as the `atlas` worker.

### Production Build (minified)
```bash
npm install        # Install Vite, Vitest, Playwright
npm run build      # Minifies JS/CSS → dist/
wrangler deploy --config wrangler.prod.toml  # Deploy minified build
```

### Development (unminified, source maps)
```bash
wrangler dev       # Serves cloudbase_modular/ directly on localhost:8787
```

**To roll back instantly**, deploy from the untouched production backup instead:

```bash
cd cloudbase          # original monolithic build — never modified
npx wrangler deploy
```

---

## Auth Flow

1. **Anonymous auth** — every visitor gets a Firebase anonymous session on page load; enables public reads (entry stats, map) without a workspace key.
2. **Magic Link** — user requests a login link at their email; a Lambda function validates the request and mints a **Firebase Custom Token** containing their role and workspace claims.
3. **Custom token sign-in** — `signInWithCustomToken(token)` replaces the anonymous session with a verified identity.
4. **Workspace profile loaded** — `workspaceProfile` is fetched from `/workspace_profiles/<key>` in Firebase; role and feature flags are read from this object.
5. **Role assigned** — all UI gating, data scope, and feature access derive from `workspaceProfile.role` (server-set, not client-settable).

---

## Role Hierarchy

```
superadmin
  └─ institution  (health / academic / AMC)
       └─ pi  (principal investigator)
            └─ researcher
            └─ clinician  (pharmacist / np / pa / rn / md / care_coordinator)
            └─ student
  └─ independent  (isolated single-workspace researcher)
  └─ observer     (read-only global view)
  └─ spectator    (read-only single workspace)
  └─ explorer     (public anonymous stats)
```

Role is the **sole source of truth** for data scope and feature access. Never gate on `tier` alone.

---

## Adding a New Feature

1. Create or edit the relevant file in `modules/`.
2. Test locally: `npx wrangler dev` (serves the worker + assets on `localhost:8787`).
3. Deploy: `npx wrangler deploy`.

Keep new logic in a dedicated module file; avoid adding to `firebase-init.js` or `auth-roles.js` unless the change is cross-cutting.

---

## Security Notes

| Control | Where |
|---|---|
| Edge rate limiting | `_worker.js` — 60 req/min per IP, CF Cache API, per-PoP |
| Security headers | `_worker.js` — HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy` |
| SRI hashes | `index.html` / `assess.html` — all third-party CDN scripts carry `integrity=` attributes |
| Firebase security rules | `firebase/` directory (separate repo/config) — enforces role-scoped reads/writes server-side |
| Domain lock | `firebase-init.js` — throws and blanks the page if loaded outside `atlas.adherence.cc` |
| No secrets in client code | Firebase config is a **public client config** (restricted by Firebase rules + domain lock); no private keys, service account credentials, or API secrets are present in this repo |

---

## Firebase Database Paths

| Path | Contents |
|---|---|
| `/assessments` | All MMAS-8 assessment records (auth-gated, scoped by workspace) |
| `/workspace_profiles` | Workspace key metadata, role, features, institution config |
| `/public_stats` | Aggregate counts mirrored from `/assessments` — publicly readable |
| `/peacs_assessments` | PEACS assessment records |
| `/peacs_public_stats` | Aggregate PEACS counts — publicly readable |
| `/audit_log` | All significant data-access events (superadmin-readable only) |
| `/ws_audit/<key>` | Per-workspace audit log visible to PI and institution roles |
| `/campaigns` | Campaign definitions and outreach tracking records |
| `/export_counts` | Monthly CSV export usage counters per workspace (cap enforcement) |
| `/site_banner` | Operator-controlled site-wide banner message |

---

## Rollback

`C:\Users\philm\Documents\atlas_v8\cloudbase\` is the **untouched production backup** of the pre-modularisation monolith. It is never modified. To instantly revert the live site to the last known-good state:

```bash
cd "C:\Users\philm\Documents\atlas_v8\cloudbase"
npx wrangler deploy
```
