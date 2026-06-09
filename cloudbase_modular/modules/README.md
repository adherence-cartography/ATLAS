# ATLAS Platform — Module Index

This file is the authoritative map of all platform modules. New developers: read this before touching any module. Each module is responsible for exactly one domain. Cross-module communication happens through global window functions (documented below).

## Architecture Overview

ATLAS is a vanilla JavaScript SPA with 30+ modules loaded via `<script>` tags in `index.html`. Modules communicate through:
- Global window functions (e.g., `showToast()`, `atlasAuditLog()`)
- Firebase Realtime Database as shared state
- `currentWorkspace`, `_currentRole`, `_currentUid` globals set by auth-workspace.js

## Module Table

| Module | Responsibility | Key Exports | Dependencies | Roles |
|--------|---------------|-------------|--------------|-------|
| **firebase-init.js** | Firebase app bootstrap, domain lock, public stats aggregation | `database`, `LAMBDA_URL` globals, `sanitizeFirebaseKey()` | Firebase SDK (CDN) | All |
| **auth-workspace.js** | Workspace key validation via Lambda, Firebase sign-in, MFA/OTP, magic-link flow | `currentWorkspace`, `_currentUid`, `LAMBDA_URL`, `_accGetToken()` | firebase-init.js, Lambda `/validate-key` | All |
| **auth-roles.js** | Role-based access control, workspace mode detection, View-As impersonation, feature entitlement checks | `_currentRole`, `_wsMode`, `isInstitutionTier()`, `hasFeature()`, `canViewAs()` | auth-workspace.js | All |
| **db-shim.js** | UAE data-residency dual-write layer; presents `database.ref()`-compatible API that mirrors writes to DynamoDB (AWS `me-central-1`) | `atlasDB()` | firebase-init.js, Lambda `/dyna-write`, `/dyna-query` | All |
| **app-init.js** | Compliance fact sheets (direct + bulk), IRB template downloads, banner management, compliance page, version history | `openFactSheet()`, `closeFactSheet()`, `switchFactSheet()`, `printFactSheet()`, `accLoadBanner()`, `accSaveBanner()`, `openCompliancePage()`, `downloadIRBTemplate()` | firebase-init.js, auth-workspace.js | pi, institution, superadmin |
| **lazy-loader.js** | On-demand CDN script injection for heavy libraries | `lazyLoad()`, `ensureMapbox()`, `ensurePlotly()`, `ensureSheetJS()` | None | All |
| **audit-router-state.js** | URL hash router (`showScreen()`), platform-wide audit logging | `showScreen()`, `atlasAuditLog()` | firebase-init.js, auth-workspace.js | All |
| **lang-strings.js** | Internationalisation string table for the patient-facing MMAS-8 form | `LANG` object (keyed by ISO language code) | None | patient (anonymous) |
| **lang-conditions.js** | Localised condition/disease name strings for QR generation and patient forms | `CONDITIONS_LANG` object | lang-strings.js | researcher, clinician, pi |
| **theme-geo.js** | Light/dark theme tokens, geo-visual palette, CSS variable injection | `applyTheme()`, `GEO_PALETTE` | None | All |
| **forms-helpers.js** | Shared DOM helpers, input validation utilities, toast notifications | `showToast()`, `showModal()`, `closeModal()`, `fmtDate()`, `debounce()` | None | All |
| **consent-mmas-questions.js** | MMAS-8 question text, consent language, question-rendering helpers | `MMAS_QUESTIONS`, `renderConsentBlock()`, `renderMmasQuestions()` | lang-strings.js | patient (anonymous) |
| **mmas-submission.js** | Live-map Mapbox globe, MMAS-8 assessment submissions, spectator mode, milestone flash, PEACS spectator mode | `initMmasMap()`, `loadMmasMapData()`, `listenMmasLive()`, `enterSpectatorMode()`, `exitSpectatorMode()`, `enterPeacsSpectatorMode()` | lazy-loader.js, firebase-init.js, peacs-core.js | researcher, clinician, spectator |
| **peacs-core.js** | PEACS score computation, Kybos timeline chart, Loom trajectory visualisation, phenotype picker, PEACS diagnostics | `loadPeacsCache()`, `invalidatePeacsCache()`, `drawKybos()`, `renderKybos()`, `drawLoom()`, `renderLoom()`, `renderPhenotypePicker()`, `getPeacsDiag()` | firebase-init.js, lazy-loader.js (Plotly) | researcher, clinician, pi, institution |
| **dashboard-core.js** | Command Centre patient panel, benchmark table, site filter, patient quick-filter, patient profile drill-down | `refreshCommandCenter()`, `buildPatientPanel()`, `openPatientProfile()`, `resolveAllowedWorkspaces()`, `applySiteFilter()` | firebase-init.js, auth-roles.js, peacs-core.js, dashboard-utils.js | researcher, clinician, pi, institution |
| **dashboard-utils.js** | Shared dashboard helpers: score formatting, phenotype colour mapping, sparklines | `scoreColor()`, `phenotypeLabel()`, `renderSparkline()`, `deriveMAPPhenotype()` | None | All |
| **dashboard-refresh.js** | Polling / Firebase listener lifecycle, workspace data refresh, dashboard data cache | `startDashboardRefresh()`, `stopDashboardRefresh()`, `forceRefresh()` | firebase-init.js, dashboard-core.js | researcher, clinician, pi, institution |
| **dashboard-sections-b.js** | Secondary dashboard panels: trend charts, cohort summary cards, intervention flags | `renderTrendPanel()`, `renderCohortSummary()`, `renderInterventionFlags()` | dashboard-core.js, lazy-loader.js (Plotly) | researcher, clinician, pi, institution |
| **export-functions.js** | CSV/XLSX data exports, clinical CSV, codebook download, Command Centre navigation, key issuance UI | `iccExportCSV()`, `exportClinicalCSV()`, `downloadAtlasCodebook()`, `openCommandCenter()`, `openInstitutionControl()`, `accNav()`, `accIssueKey()`, `_accGetToken()` | firebase-init.js, auth-workspace.js, lazy-loader.js (SheetJS) | researcher, clinician, pi, institution, superadmin |
| **admin-keys.js** | Key management table: create, edit, revoke, delete workspace keys; role/permission matrix UI | `accLoadKeys()`, `accOpenEditKey()`, `accSaveEditKey()`, `accRevokeKey()`, `accDeleteKey()`, `accFilterKeys()`, `accRenderKeys()` | export-functions.js, firebase-init.js | superadmin, institution |
| **admin-panel.js** | Superadmin Mission Control: platform stats, workspace overview, global search | `renderAdminPanel()`, `adminSearch()`, `adminLoadStats()` | firebase-init.js, auth-roles.js, admin-keys.js | superadmin |
| **admin-tools.js** | Superadmin diagnostic tools: auth state checker, Firebase rules copy, event config, system diagnostics | `accLoadHelp()`, `accLoadSystem()`, `accCheckAuthState()`, `accSaveEventConfig()`, `accLoadEventConfig()` | firebase-init.js, auth-workspace.js | superadmin |
| **qr-generation.js** | QR code generation for patient intake links, "Wall of Science" project tablets | `openWallModal()`, `loadWallProjects()`, `saveWallProject()`, `openWallProjectEditor()` | firebase-init.js, auth-workspace.js | researcher, clinician, pi, institution |
| **esignature.js** | 21 CFR Part 11 §11.100/§11.200 compliant electronic signature (two-component: Firebase session token + intent attestation) | `window._eSign(opts)` | firebase-init.js only (self-contained) | researcher, clinician, pi, institution |
| **bulk-upload-analytics.js** | Bulk CSV/XLSX upload of historical assessment data, validation, batch write | `openBulkUpload()`, `processBulkFile()`, `validateBulkRow()`, `submitBulkBatch()` | lazy-loader.js (SheetJS), firebase-init.js, auth-workspace.js | researcher, pi, institution |
| **clinical-practice.js** | Clinical roster panel (RPP): patient list, MAP protocol panel, MMAS/PEACS merge, record printing | `rppBuild()`, `rppFilter()`, `rppSort()`, `openPatientProfile()` (clinical), `_renderMAPProtocolPanel()` | firebase-init.js, peacs-core.js, dashboard-utils.js | clinician, pi |
| **clinical-billing.js** | Clinical billing code suggestions, visit documentation helpers, payer mapping | `renderBillingPanel()`, `suggestCPTCodes()`, `exportBillingCSV()` | clinical-practice.js, firebase-init.js | clinician, pi |
| **pi-research.js** | PI research tools: blinded CSV export, data lock, enrollment targets, velocity charts, heatmaps, audit log, snapshots | `initPiResearchPanel()`, `exportBlindedMmasCSV()`, `lockDataset()`, `loadPiSnapshots()`, `downloadSnapshotCSV()`, `renderPiVelocity()`, `renderPiHeatmap()`, `loadPiAuditLog()` | firebase-init.js, auth-roles.js, lazy-loader.js (Plotly) | pi, institution |
| **analytics-campaigns.js** | Cohort PDF export, result share card, ZOE follow-up scheduling, patient portal renderer | `exportCohortPDF()`, `shareResultCard()`, `zoeFinalize()`, `loadPatientPortalData()`, `renderPatientPortal()` | firebase-init.js, dashboard-utils.js | researcher, clinician, pi |
| **campaigns-perpetual.js** | Perpetual campaign management: always-on QR campaigns, link tracking, response rates | `openPerpetualCampaigns()`, `createPerpetualCampaign()`, `loadCampaignStats()` | firebase-init.js, qr-generation.js | researcher, pi, institution |
| **explorer.js** | Data explorer: cross-cohort filtering, custom query builder, chart builder | `openExplorer()`, `explorerFilter()`, `explorerBuildChart()` | firebase-init.js, auth-roles.js, lazy-loader.js (Plotly) | pi, institution, superadmin |
| **partners.js** | Partners / Wall of Science public-facing tablets, project registry | `initPartnersWall()`, `renderWallTablets()` | firebase-init.js, qr-generation.js | All (public display) |
| **spectator.js** | Read-only spectator workspace: limited live-map view, no data entry | `initSpectatorWorkspace()`, `renderSpectatorPanel()` | mmas-submission.js, firebase-init.js | spectator |
| **student-workspace.js** | Student/trainee workspace: guided assessment walkthrough, learning mode | `initStudentWorkspace()`, `renderStudentDashboard()` | firebase-init.js, auth-roles.js, peacs-core.js | student |
| **help-account.js** | In-app help docs, account settings, mission control shortcut, phantom key diagnostics, system info | `accLoadHelp()`, `accHelpToggle()`, `accHelpSearch()`, `accLoadSystem()`, `accCheckAuthState()` | firebase-init.js, auth-workspace.js | All |
| **sa-command.js** | Superadmin Command module: top-level SA navigation shell | `_saRenderCommand()` (internal) | auth-roles.js | superadmin |
| **sa-shell.js** | Superadmin shell layout, section routing, tab management | `showScreen()` (SA variant), router integration | audit-router-state.js, auth-roles.js | superadmin |
| **sa-platform.js** | Superadmin: platform-wide health stats, workspace growth charts, tier breakdown | `_saRenderPlatform()` | firebase-init.js, lazy-loader.js (Plotly) | superadmin |
| **sa-records.js** | Superadmin: global assessment record browser, cross-workspace search | `_saRenderRecords()`, `saRecordsSearch()` | firebase-init.js, dashboard-utils.js | superadmin |
| **sa-cohort.js** | Superadmin: cross-workspace cohort analysis, aggregate phenotype distributions | `_saRenderCohort()`, `saCohortFilter()` | firebase-init.js, peacs-core.js, lazy-loader.js (Plotly) | superadmin |
| **sa-audit.js** | Superadmin: global audit log viewer, event filtering, CSV export | `_saRenderAudit()`, `saAuditFilter()`, `saAuditExport()` | firebase-init.js, audit-router-state.js | superadmin |
| **sa-compliance.js** | Superadmin: workspace compliance status, IRB/consent tracking, expiry alerts | `_saRenderCompliance()`, `saComplianceRefresh()` | firebase-init.js, auth-roles.js | superadmin |
| **sa-research.js** | Superadmin: cross-institution research aggregation, publication-ready dataset builder | `_saRenderResearch()`, `saResearchExport()` | firebase-init.js, pi-research.js | superadmin |
| **sa-lab.js** | Superadmin Lab: experimental features, A/B config, feature flags | `_saRenderLab()`, `saLabToggleFeature()` | firebase-init.js | superadmin |
| **sa-ai.js** | Superadmin AI: Claude-powered platform brief, anomaly detection Z-chart, predictive trend model, NLQ interface | `_saRenderAI()`, `saAiTab()`, `_saAiBriefWithClaude()`, `_saAiNlqSubmit()` | firebase-init.js, lazy-loader.js (Plotly), Lambda `/claude-brief` | superadmin |
| **sa-globe.js** | Superadmin 3-D globe: live assessment heatmap, layer toggles, regional drawer, region explain (AI) | `_saRenderGlobe()`, `saToggleLayer()`, `saGlobeFilter()`, `_saGlobeOpenDrawer()`, `_saGlobeExplainRegion()` | lazy-loader.js (Mapbox), firebase-init.js | superadmin |
| **sa-observatory.js** | Superadmin Observatory: real-time global activity feed, trend analytics, tier monitoring | `_saRenderObservatory()`, `saObsTab()`, `_saObsRenderFeed()`, `_saObsRenderTrends()` | firebase-init.js, lazy-loader.js (Plotly) | superadmin |
| **sa-psychometrics.js** | Superadmin Psychometrics Lab: MMAS-8 and MAP validity/reliability analytics, IRT, Cronbach's α, Pearson correlations | `_saRenderPsychometrics()`, `_saPsySetInstrument()`, `_saPsySetTab()` | firebase-init.js, lazy-loader.js (Plotly) | superadmin |
| **sa-gai.js** | Superadmin GAI (Global Adherence Index): network-level adherence scoring, geographic aggregation | `_saRenderGai()`, `saGaiRefresh()` | firebase-init.js, sa-globe.js | superadmin |
| **sa-ext-comp.js** | Superadmin External Comparators: benchmark against published adherence literature | `_saRenderExtComp()`, `saExtCompSetBenchmark()` | firebase-init.js, lazy-loader.js (Plotly) | superadmin |
| **sa-rescue.js** | Superadmin Rescue: data recovery, orphaned record repair, Firebase rules emergency push | `_saRenderRescue()`, `saRescueOrphans()`, `saRescuePushRules()` | firebase-init.js, admin-tools.js | superadmin |
| **redcap-bridge.js** | REDCap bidirectional sync (BP-INT-02): push ATLAS assessments to REDCap, pull REDCap records into ATLAS | `openREDCapBridge()`, `saveREDCapConfig()`, `syncATLAStoREDCap()`, `syncREDCapToATLAS()`, `disconnectREDCap()` | firebase-init.js, auth-workspace.js, Lambda `/redcap-push`, `/redcap-pull`, `/redcap-test` | pi, institution |
| **fhir-export.js** | HL7 FHIR R4 export (BP-INT-03): convert assessments to FHIR Observations, FHIR Bundle download, webhook config for Epic/Cerner | `assessmentToFHIRObservation()`, `exportFHIRBundle()`, `downloadFHIRBundle()`, `openFHIRWebhookConfig()`, `saveFHIRWebhook()`, `testFHIRWebhook()` | auth-workspace.js, dashboard-utils.js (deriveMAPPhenotype), Lambda `/fhir-webhook-save`, `/fhir-webhook-test` | pi, institution |
| **inst-admin.js** | Institution self-service team management (BP-FOCUS-02): provision/revoke sub-workspace keys, role assignment, expiry | `renderInstAdmin()`, `openAddMemberModal()`, `submitAddMember()`, `revokeInstMember()` | auth-workspace.js, Lambda `/admin/list-keys`, `/admin/provision-key`, `/admin/revoke-key` | institution |

---

## Global Communication Contracts

These window-scope functions are called across module boundaries. If you rename them, grep the entire codebase.

| Function | Defined in | Called by |
|----------|-----------|-----------|
| `showToast(msg, ms)` | forms-helpers.js | All modules |
| `atlasAuditLog(event, data)` | audit-router-state.js | All modules that write data |
| `showScreen(id)` | audit-router-state.js | Navigation throughout app |
| `_accGetToken()` | export-functions.js | Any module that calls Lambda |
| `deriveMAPPhenotype(record)` | dashboard-utils.js | peacs-core.js, fhir-export.js, analytics-campaigns.js |
| `window._eSign(opts)` | esignature.js | clinical-practice.js, pi-research.js |
| `database` | firebase-init.js | All modules that touch Firebase |
| `currentWorkspace` | auth-workspace.js | All modules |
| `_currentRole` | auth-roles.js | Any module with role gates |
| `_currentUid` | auth-workspace.js | esignature.js, redcap-bridge.js |
| `LAMBDA_URL` | auth-workspace.js | All modules that call Lambda |

---

## Load Order (index.html script tag sequence)

1. Firebase SDK (CDN)
2. `firebase-init.js` — must be first ATLAS module
3. `db-shim.js` — wraps `database` immediately after init
4. `lazy-loader.js` — registers CDN loaders
5. `theme-geo.js` — applies CSS variables before render
6. `forms-helpers.js` — `showToast()` must exist early
7. `lang-strings.js`, `lang-conditions.js`
8. `audit-router-state.js` — `atlasAuditLog()` and `showScreen()` needed by auth
9. `auth-workspace.js`, `auth-roles.js`
10. `esignature.js`
11. `consent-mmas-questions.js`
12. All feature modules (order within this group is flexible)
13. `app-init.js` — calls into all other modules at DOMContentLoaded

---

## Adding a New Module

1. Create `modules/your-module.js` with `'use strict';` at top.
2. Prefix private functions with `_`.
3. Only export functions that other modules or `index.html` inline handlers genuinely need.
4. Add a `<script src="modules/your-module.js"></script>` tag in `index.html` after its dependencies.
5. Add a row to the Module Table above.
6. Log all writes with `atlasAuditLog('YOUR_EVENT', { ... })`.
