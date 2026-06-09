/**
 * @fileoverview Role-based access control helpers for the ATLAS platform.
 * Single source of truth for workspace mode, role gates, View-As impersonation,
 * and feature entitlement checks.
 * @module auth-roles
 */

/**
 * @typedef {'superadmin'|'institution'|'pi'|'researcher'|'clinician'|'student'|'spectator'} AtlasRole
 */

/**
 * @typedef {'institutions'|'independent'} WorkspaceTier
 */

/**
 * @typedef {Object} WorkspaceProfile
 * @property {AtlasRole} role
 * @property {string} workspace_key
 * @property {string} [display_name]
 * @property {WorkspaceTier} [tier]
 * @property {string} [parent_institution]
 * @property {'health'|'academic'|'amc'} [institution_type]
 * @property {Object} [features]
 */

// ══════════════════════════════════════════════
// WORKSPACE MODE HELPERS — single source of truth
// ══════════════════════════════════════════════
// Returns true when the current session is an institution-tier workspace.
// A workspace is institution-tier when _wsMode is 'institution' OR the key
// is tagged institution in its profile. Falls back to old INDEPENDENT check.
// ── Role helpers — network visibility hierarchy ──────────────────────────────
// Roles set server-side by Lambda in Firebase token claims and workspaceProfile:
//   superadmin  → sees all workspaces globally, no filter
//   institution → network executive (CEO/COO/CTO/Director) — sees all child PI and
//                 clinician workspaces across the network; data flows up to this tier
//   pi          → programme lead — sees all child clinician workspaces across the network;
//                 same network-level visibility as institution; data flows up to this tier
//   clinician   → data entry and patient-facing; data flows upward to PI and institution tiers
//   researcher  → sees only their own cohort (parent_institution links them upward)
//   independent → sees only their own cohort, fully isolated

// ── Role helpers — strict role-based gates ───────────────────────────────────
// Role is the ONLY source of truth for what a user can see.
// tier ("institutions" / "researchers") controls features unlocked.
// role ("superadmin" / "institution" / "pi" / "clinician" / "researcher" / "independent") controls scope.
//
// ROLE MAP:
//   superadmin  → platform operator — sees all workspaces globally, full Mission Control
//   institution → network executive level — sees all child PI and clinician workspaces across the network
//   pi          → programme lead — sees all child clinician workspaces across the network (same scope as institution)
//   clinician   → data contributor — sees own cohort only; data visible to PI and institution above them
//   researcher  → sees own cohort only; linked upward via parent_institution
//   independent → standalone user — sees own cohort only, fully isolated
//
// IMPORTANT: tier:"institutions" is shared by superadmin AND institution roles.
// Never gate on tier alone — always check role.

/**
 * Returns true if the current workspace profile has the superadmin role.
 *
 * @returns {boolean}
 */
function isSuperAdmin() {
  if (!workspaceProfile) return false;
  return workspaceProfile.role === 'superadmin';
}

/**
 * Alias for isPIMode(). Returns true if the active role is 'pi'.
 *
 * @returns {boolean}
 */
function isPi() { return isPIMode(); } // alias — canonical: isPIMode()

/**
 * Returns true only for role 'institution' or 'superadmin'.
 * Does NOT rely on _wsMode — role comes from the server-validated SSM profile only.
 *
 * @returns {boolean}
 */
function isInstitutionMode() {
  // ONLY true for role:"institution" or role:"superadmin"
  // _wsMode is intentionally NOT used here — it reflects which button the user
  // clicked on the entry screen, NOT their actual role. Role comes from the
  // server-validated SSM profile only. A student clicking "Institution" on the
  // entry screen must not get institution access.
  if (!currentWorkspace || currentWorkspace === 'INDEPENDENT') return false;
  if (isSuperAdmin()) return true;
  if (workspaceProfile && workspaceProfile.role === 'institution') return true;
  return false;
}

// Normalize institution_type (snake_case from Lambda/SSM) → institutionType (camelCase used by ATLAS frontend)
// Call once after any workspaceProfile assignment from an external source.
function _normalizeInstType(profile) {
  if (!profile) return;
  if (profile.institution_type && !profile.institutionType) {
    profile.institutionType = profile.institution_type;
  }
}

// Institution type helpers — default to health when institutionType is absent (backward compat)
/**
 * Returns true if the active institution workspace is health type (or legacy, which defaults to health).
 *
 * @returns {boolean}
 */
function isHealthInst() {
  if (!isInstitutionMode()) return false;
  const t = workspaceProfile && workspaceProfile.institutionType;
  return !t || t === 'health'; // no type = legacy key → treat as health
}
/**
 * Returns true if the active institution workspace is academic type.
 *
 * @returns {boolean}
 */
function isAcademicInst() {
  if (!isInstitutionMode()) return false;
  return workspaceProfile && workspaceProfile.institutionType === 'academic';
}
/**
 * Returns true if the active institution workspace is Academic Medical Center (AMC) type.
 *
 * @returns {boolean}
 */
function isAmcInst() {
  if (!isInstitutionMode()) return false;
  return workspaceProfile && workspaceProfile.institutionType === 'amc';
}

// Apply tab and panel visibility to the institution dashboard based on institutionType
function _applyInstTabGating() {
  const health   = isHealthInst();
  const academic = isAcademicInst();
  const amc      = isAmcInst();

  // Analytics tab — always visible (both health and academic have data)
  const analyticsBtn = document.getElementById('inst-tab-btn-analytics');
  if (analyticsBtn) analyticsBtn.style.display = '';

  // Reporting tab — always visible, sub-nav items gated inside
  const reportingBtn = document.getElementById('inst-tab-btn-reporting');
  if (reportingBtn) reportingBtn.style.display = '';

  // Reporting sub-nav: Billing only for health/AMC
  const repBillingBtn = document.getElementById('inst-rep-btn-billing');
  if (repBillingBtn) repBillingBtn.style.display = (health || amc) ? '' : 'none';

  // Reporting sub-nav: Hub/Grants/Thesis only for academic/AMC
  ['hub', 'grants', 'thesis'].forEach(sub => {
    const btn = document.getElementById('inst-rep-btn-' + sub);
    if (btn) btn.style.display = (academic || amc) ? '' : 'none';
  });

  // Care gap monitor panel — health/AMC only
  const careGap = document.getElementById('inst-care-gap-panel');
  if (careGap) careGap.style.display = (health || amc) ? '' : 'none';
}

/**
 * Returns true if the current user is in independent workspace mode (fully isolated cohort).
 *
 * @returns {boolean}
 */
function isIndependentMode() {
  if (!workspaceProfile) return false;
  return workspaceProfile.role === 'independent';
}

/**
 * Returns true if the current user has the PI (Principal Investigator) role.
 *
 * @returns {boolean}
 */
function isPIMode() {
  if (!workspaceProfile) return false;
  return workspaceProfile.role === 'pi';
}

/**
 * Returns true for role 'researcher', any clinician role, or 'student'.
 * These users have a workspace but see only their own cohort.
 *
 * @returns {boolean}
 */
function isPIResearcher() {
  // True for role:"researcher", any clinician role, or "student" — has a workspace, sees own cohort only
  if (!workspaceProfile) return false;
  return workspaceProfile.role === 'researcher'
      || workspaceProfile.role === 'student'
      || _clinicianRolesSet.has(workspaceProfile.role);
}

// ── Clinician role system ────────────────────────────────────────────────────
// isClinician() is true for ANY provider-role that uses the clinical billing path:
// pharmacist, np, pa, rn, md, care_coordinator, clinician (generic)
// This gates CCM / RTM / MTM billing panels, CPO panel, and clinical dashboard.
//
// BP-CFR-03: CLINICIAN_ROLES is loaded from Firebase remote config (_config/clinician_roles)
// at startup. Falls back to the hardcoded defaults if the read fails or returns null.
// Use _clinicianRolesSet everywhere; CLINICIAN_ROLES is kept as a const alias for
// backward-compat with code paths that reference it before loadClinicianRoles() resolves.

const _CLINICIAN_ROLES_DEFAULT = ['clinician', 'pharmacist', 'np', 'pa', 'rn', 'md', 'care_coordinator'];

/** Module-level set, populated by loadClinicianRoles(). Defaults to hardcoded list. */
let _clinicianRolesSet = new Set(_CLINICIAN_ROLES_DEFAULT);

/**
 * Loads the clinician roles list from Firebase remote config (_config/clinician_roles).
 * If the read fails or returns a non-array, falls back to the hardcoded defaults.
 * Should be called once after Firebase is initialized (non-blocking).
 * @returns {Promise<void>}
 */
async function loadClinicianRoles() {
  try {
    const db = (typeof database !== 'undefined' && database) ? database
             : (window.firebase && window.firebase.database ? window.firebase.database() : null);
    if (!db) return;
    const snap = await db.ref('_config/clinician_roles').once('value');
    const val  = snap.val();
    if (Array.isArray(val) && val.length > 0) {
      _clinicianRolesSet = new Set(val);
    }
    // If null or not a valid array, keep the hardcoded default set
  } catch(e) {
    // Silently fall back to hardcoded defaults on any error
    _clinicianRolesSet = new Set(_CLINICIAN_ROLES_DEFAULT);
  }
}

/** Backward-compat alias — code that references CLINICIAN_ROLES directly will use the live set. */
const CLINICIAN_ROLES = _clinicianRolesSet;

/**
 * Returns true for any provider role that uses the clinical billing path
 * (pharmacist, np, pa, rn, md, care_coordinator, clinician).
 *
 * @returns {boolean}
 */
function isClinician() {
  if (!workspaceProfile) return false;
  return _clinicianRolesSet.has(workspaceProfile.role);
}

/**
 * Returns a human-readable credential label for the active clinician role.
 * Falls back to 'Clinician' if no role is set or role is not in the label map.
 *
 * @returns {string}
 */
function getClinicianLabel() {
  const labels = {
    pharmacist:       'PharmD · Clinical Pharmacist',
    np:               'NP · Nurse Practitioner',
    pa:               'PA · Physician Assistant',
    rn:               'RN · Registered Nurse',
    md:               'MD/DO · Physician',
    care_coordinator: 'Care Coordinator',
    clinician:        'Clinician',
  };
  return (workspaceProfile && labels[workspaceProfile.role]) || 'Clinician';
}

/**
 * Returns an object describing which MTM/CCM/RTM billing codes the current clinician role
 * can bill independently versus under supervision.
 *
 * @returns {{ mtm_independent: boolean, mtm_supervised: boolean, ccm_independent: boolean, ccm_supervised: boolean, rtm_independent: boolean, rtm_supervised: boolean }}
 */
function getClinicianBillingCapacity() {
  const role = workspaceProfile && workspaceProfile.role;
  return {
    // MTM: pharmacists bill independently; others supervise/collaborate
    mtm_independent: role === 'pharmacist',
    mtm_supervised:  _clinicianRolesSet.has(role) && role !== 'pharmacist',
    // CCM: NPs, PAs, CNS, CNMs bill independently; RNs/Pharmacists as supervised staff
    ccm_independent: ['np','pa','md'].includes(role),
    ccm_supervised:  ['pharmacist','rn','care_coordinator'].includes(role),
    // RTM: requires QHCP order; NPs, PAs, MDs can bill directly
    rtm_independent: ['np','pa','md'].includes(role),
    rtm_supervised:  ['pharmacist','rn','care_coordinator','clinician'].includes(role),
  };
}

/**
 * Returns true for role 'observer' — read-only global view with no write, export, or admin access.
 *
 * @returns {boolean}
 */
function isObserverMode() {
  // True for role:"observer" — read-only global view, no writes, no exports, no admin
  if (!workspaceProfile) return false;
  return workspaceProfile.role === 'observer';
}

// ── Superadmin View-As ───────────────────────────────────────────────────────
// Lets a signed-in superadmin temporarily simulate any role for QA/debugging.
// workspaceProfile.role is overridden in memory only — the Firebase auth token
// and all data access remain superadmin. resolveAllowedWorkspaces() still
// returns null (all workspaces) via the token claim check on line ~9052.

let _vaOriginalProfile = null;   // saved superadmin profile
let _vaActive          = false;  // true when impersonating

const VA_ROLES = {
  student:               { label: 'Student',                         dot: '#2ec98a' },
  researcher:            { label: 'Researcher',                      dot: '#8b6ff5' },
  clinician:             { label: 'Clinician',                       dot: '#10b981' },
  pi:                    { label: 'PI · Investigator',               dot: '#d4a843' },
  institution_health:    { label: 'Institution · Health System',     dot: '#4e9cf5', profileRole: 'institution', institutionType: 'health'   },
  institution_academic:  { label: 'Institution · Academic',          dot: '#4e9cf5', profileRole: 'institution', institutionType: 'academic' },
  institution_amc:       { label: 'Institution · Academic Med Ctr',  dot: '#4e9cf5', profileRole: 'institution', institutionType: 'amc'      },
  observer:              { label: 'Observer (read-only)',             dot: '#6b8099' },
  publication_license:   { label: 'Publication License',             dot: '#d4a843' },
};

/**
 * Initialises the View-As toolbar, making it visible only when the current user is a superadmin.
 * Should be called once after dashboard entry.
 *
 * @returns {void}
 */
function initViewAsToolbar() {
  // Only show for superadmin — called once after dashboard entry
  const toolbar = document.getElementById('va-toolbar');
  if (!toolbar) return;
  toolbar.classList.toggle('visible', isSuperAdmin() || _vaActive);
}

/**
 * Toggles the View-As role selection panel open or closed.
 *
 * @returns {void}
 */
function toggleVaPanel() {
  const panel = document.getElementById('va-panel');
  const btn   = document.getElementById('va-toggle-btn');
  if (!panel || !btn) return;
  const open = panel.classList.toggle('open');
  btn.classList.toggle('panel-open', open);
}

/**
 * Activates the View-As role impersonation for the signed-in superadmin.
 * Overrides workspaceProfile.role in memory only — Firebase auth token and data access remain superadmin.
 * Re-renders the dashboard as the simulated role.
 *
 * @param {string} role - Key from VA_ROLES (e.g. 'researcher', 'institution_health')
 * @returns {void}
 */
function activateViewAs(role) {
  if (!VA_ROLES[role]) return;

  // Publication License is a pre-auth modal flow — just open the modal to preview it
  if (role === 'publication_license') {
    document.getElementById('va-panel')?.classList.remove('open');
    document.getElementById('va-toggle-btn')?.classList.remove('panel-open');
    openPubLicenseFlow({ n: null, dateRange: null, countries: null });
    return;
  }

  // First call: save the real profile
  if (!_vaActive) {
    _vaOriginalProfile = JSON.parse(JSON.stringify(workspaceProfile));
  }
  _vaActive = true;

  // Override role in the live profile object
  // Institution variants carry a profileRole (always 'institution') + institutionType
  const _vaRoleDef = VA_ROLES[role];
  workspaceProfile.role = _vaRoleDef.profileRole || role;
  workspaceProfile.tier = _vaRoleDef.profileRole || role;
  if (_vaRoleDef.institutionType) {
    workspaceProfile.institutionType = _vaRoleDef.institutionType;
  } else {
    delete workspaceProfile.institutionType;
  }

  // Bust the workspace-scope cache so resolveAllowedWorkspaces re-evaluates
  // (token check will still return null/all-workspaces for superadmin)
  _allowedWSCache    = undefined;
  _allowedWSCacheKey = null;

  // Update banner
  const banner = document.getElementById('va-banner');
  const label  = document.getElementById('va-banner-role');
  if (banner) banner.classList.add('active');
  if (label)  label.textContent = VA_ROLES[role].label.toUpperCase();
  document.body.classList.add('va-active');

  // Update in-panel current-view status strip
  const cvBlock = document.getElementById('va-current-view');
  const cvLabel = document.getElementById('va-current-label');
  if (cvBlock) cvBlock.style.display = 'block';
  if (cvLabel) cvLabel.textContent = VA_ROLES[role].label;

  // Highlight the active button, clear others
  Object.keys(VA_ROLES).forEach(r => {
    const b = document.getElementById('va-btn-' + r);
    if (b) b.classList.toggle('active-view', r === role);
  });

  // Close the panel
  document.getElementById('va-panel')?.classList.remove('open');
  document.getElementById('va-toggle-btn')?.classList.remove('panel-open');

  // Re-render the dashboard as the new role
  enterResearcherDashboard();

}

/**
 * Exits View-As impersonation and restores the original superadmin workspace profile.
 * Re-renders the dashboard as superadmin.
 *
 * @returns {void}
 */
function exitViewAs() {
  if (!_vaActive || !_vaOriginalProfile) return;

  // Restore the original superadmin profile
  Object.assign(workspaceProfile, _vaOriginalProfile);
  // Remove keys that VA may have added but don't exist in the real profile
  if (!_vaOriginalProfile.institutionType) delete workspaceProfile.institutionType;
  _vaActive = false;

  // Bust cache again
  _allowedWSCache    = undefined;
  _allowedWSCacheKey = null;

  // Hide banner and remove body class
  document.getElementById('va-banner')?.classList.remove('active');
  document.body.classList.remove('va-active');

  // Hide in-panel current-view status strip
  const cvBlock = document.getElementById('va-current-view');
  if (cvBlock) cvBlock.style.display = 'none';

  // Reset all role buttons
  Object.keys(VA_ROLES).forEach(r => {
    document.getElementById('va-btn-' + r)?.classList.remove('active-view');
  });

  // Re-render as superadmin
  enterResearcherDashboard();
}

// ── Phase 1: Feature entitlement helper ─────────────────────────────────────
// workspaceProfile.features{} is set server-side in SSM key parameters.
// Falls back to role-based defaults so all existing keys continue to work.
// New keys issued via the Stripe portal will carry explicit features objects.
/**
 * Returns the value of a feature entitlement flag for the current workspace.
 * Checks workspaceProfile.features first; falls back to role-based defaults.
 *
 * @param {string} key - Feature key (e.g. 'csv_export_cap', 'bulk_upload', 'peacs_tier')
 * @returns {boolean|string|number|null} Feature value, or null if not defined
 */
function getFeature(key) {
  const f = workspaceProfile && workspaceProfile.features;
  if (f && typeof f[key] !== 'undefined') return f[key];
  // Role-based fallback defaults for keys issued before features{} was added
  const role = workspaceProfile && workspaceProfile.role;
  // isClinician() may not be callable yet if this is called very early; inline the check
  const _isClin = _clinicianRolesSet && _clinicianRolesSet.has(role);
  const defaults = {
    csv_export_cap:  role === 'student'  ? 100 : null,  // 100/mo for student, unlimited above
    bulk_upload:     role === 'researcher' || _isClin || role === 'pi' || role === 'institution' || role === 'superadmin',
    peacs_tier:      role === 'student'     ? 'basic'
                   : role === 'researcher'  ? 'standard'
                   : _isClin               ? 'standard'
                   : role === 'pi' || role === 'independent' ? 'standard'
                   : 'advanced',
    zoe_soap:        _isClin || role === 'pi' || role === 'institution' || role === 'superadmin',
    api_access:      role === 'pi'          ? 'read'
                   : role === 'institution' ? 'standard'
                   : role === 'superadmin'  ? 'premium' : 'none',
    sentinel:        role === 'researcher' || _isClin || role === 'pi' || role === 'institution' || role === 'superadmin',
    ape:             role === 'researcher' || _isClin || role === 'pi' || role === 'institution' || role === 'superadmin',
    benchmarking:    role === 'pi' || role === 'institution' || role === 'superadmin',
    irb_cert:        role === 'researcher' || _isClin || role === 'pi' || role === 'institution' || role === 'superadmin',
    sub_workspaces:  role === 'pi' || role === 'institution' || role === 'superadmin',
    // Observer: read-only global view for board members and funders
    observer_read_only: role === 'observer',
    // Clinician billing: MTM/CCM/RTM panels
    clinical_billing: _isClin || role === 'researcher' || role === 'pi' || role === 'institution' || role === 'superadmin',
  };
  return typeof defaults[key] !== 'undefined' ? defaults[key] : null;
}

// ── Phase 1: CSV export cap enforcement ─────────────────────────────────────
/**
 * Checks whether the current workspace has remaining monthly CSV export quota.
 * Shows a toast and returns false if the cap has been reached.
 *
 * @param {string} exportType - Identifier for the type of export being performed
 * @returns {Promise<boolean>} True if export is allowed, false if capped or not authenticated
 */
async function checkExportCap(exportType) {
  const cap = getFeature('csv_export_cap');
  if (!cap || cap === null) return true; // unlimited
  if (!currentWorkspace || currentWorkspace === 'EXPLORER') return false;
  try {
    const monthKey = new Date().toISOString().slice(0,7); // YYYY-MM
    const ref = database.ref('/export_counts/' + currentWorkspace + '/' + monthKey);
    const snap = await ref.once('value');
    const used = snap.val() || 0;
    if (used >= cap) {
      showToast('Export limit reached (' + cap + ' records/month on Student tier). Upgrade to Researcher ($49/mo) for unlimited exports.', 6000);
      return false;
    }
    await ref.set(used + 1);
    return true;
  } catch(e) {
    console.warn('[ATLAS] Export cap check failed, denying export:', e.message);
    return false;
  }
}

// ── Phase 1: PEACS tier gate ─────────────────────────────────────────────────
/**
 * Gates access to PEACS features by tier level.
 * Shows an upgrade toast and returns false if the current key's tier is below the required level.
 *
 * @param {'basic'|'standard'|'advanced'} needed - Minimum PEACS tier required
 * @returns {boolean} True if access is granted, false if tier is insufficient
 */
function requirePeacsTier(needed) {
  const tierOrder = { basic: 0, standard: 1, advanced: 2 };
  const current = getFeature('peacs_tier') || 'basic';
  if ((tierOrder[current] || 0) >= (tierOrder[needed] || 0)) return true;
  showToast(
    'PEACS ' + needed.charAt(0).toUpperCase() + needed.slice(1) + ' requires a higher-tier key. '
    + 'Contact info@adherence.cc to upgrade.',
    5000
  );
  return false;
}

// ── Module Entitlement System ─────────────────────────────────────────────────
// Phase 1: hasModule() is the consumer gate for the feature module catalog.
// Reads platform_config/module_paths loaded at login into window._atlasModPaths.
// Falls back to always-true so no existing features break until Phase 2 wires
// each component to explicitly call hasModule(id).
//
// Phase 2 (next session): each dashboard section will wrap its render call with
//   if (!hasModule('analytics_sdoh')) return;
// and the Module Paths Platform tab will control what each workspace sees.

/** Cache: loaded from Firebase platform_config/module_paths after login */
let _atlasModPaths = null;

/**
 * Load platform module path config from Firebase.
 * Called once after workspace auth is confirmed.
 * Non-blocking — failures are silent and fall back to permissive defaults.
 */
async function _loadModulePaths() {
  try {
    const db = window.firebase?.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
    if (!db) return;
    const snap = await db.ref('platform_config/module_paths').once('value');
    _atlasModPaths = snap.val() || {};
  } catch (_) {
    _atlasModPaths = {};
  }
}

/**
 * Returns true if the current workspace role has access to the given module ID.
 * Module IDs are defined in _ATLAS_FEATURE_CATALOG (superadmin-workspace.js).
 *
 * Phase 1: Always returns true (backward-compatible — no UI breaks).
 * Phase 2: Reads _atlasModPaths + default path to gate each feature.
 *
 * @param {string} moduleId - e.g. 'analytics_sdoh', 'research_pi_panel'
 * @returns {boolean}
 */
function hasModule(moduleId) {
  // Superadmin always has everything
  if (isSuperAdmin()) return true;
  // Before workspace is set — allow everything (pre-auth safety valve)
  if (!workspaceProfile) return true;

  const role = workspaceProfile.role || 'researcher';

  // 1. Per-workspace revoke — SA explicitly removed this module from this key
  if ((workspaceProfile.module_revokes || []).includes(moduleId)) return false;
  // 2. Per-workspace grant — SA explicitly added this module to this key
  if ((workspaceProfile.module_grants || []).includes(moduleId)) return true;
  // 3. SA role-level override saved to Firebase (platform_config/module_paths)
  const cfg = (_atlasModPaths || {})[role] || {};
  if (cfg[moduleId] !== undefined) return cfg[moduleId];

  // 4. Default paths — single source of truth is _ATLAS_DEFAULT_PATHS in superadmin-workspace.js.
  //    Fall back to fail-closed (false) if that object hasn't loaded yet — fail-open would
  //    grant access when config is missing, which is a security risk (BP-SEC-02).
  if (typeof _ATLAS_DEFAULT_PATHS === 'undefined') {
    console.warn('[ATLAS] hasModule: _ATLAS_DEFAULT_PATHS not loaded — denying access to module:', moduleId);
    return false;
  }

  // pharmacist is unified under clinician; independent inherits researcher defaults
  const lookupRole = role === 'pharmacist'    ? 'clinician'
                   : role === 'independent'   ? 'researcher'
                   : role;
  return (_ATLAS_DEFAULT_PATHS[lookupRole] || []).includes(moduleId);
}

