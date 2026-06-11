// sa-shell.js — ATLAS Mission Control: shell, state, nav rail, tab router, shared utilities
// ══════════════════════════════════════════════════════════════════════════════
// ATLAS MISSION CONTROL — Superadmin Workspace
// Phase 1 : Shell · Tab Scaffold · Live Top Bar
// Phase 2 : Command Center — GAI Gauge · Instrument Breakdown ·
//           Live Activity Feed · AI Briefing · 24-Hour Heatmap
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

// ─── Module-level state ────────────────────────────────────────────────────────
let _saOpen       = false;
let _saActiveTab  = 'command';
let _saFbListeners = [];      // { ref, event, fn } — removed on close
let _saTopBarTimer = null;    // setInterval for clock tick
let _saAiOpen     = true;     // AI sidebar visibility

// Cached dataset snapshots (refreshed when Command Center loads)
const _saCache = { mmas: [], peacs: [], map: [], workspaces: {} };

// ─── Design token system ─────────────────────────────────────────────────────
// _C is populated from CSS custom properties via _saResolveColors().
// Two themes: dark (Mission Control default) and light (clinical / patient paths).
// Modules read _C at render time — switching theme is one _saResolveColors() call.
// CSS classes use var(--mc-*) directly; inline template styles use _C.*.
//
// Access control: _saCurrentRole gates which modules render in the nav rail.
// Data scoping: PI-level queries filter by institution_code (see _saLoadCache).
//   superadmin → all data
//   pi         → institution_code === user.institutionCode only
//   student    → own records only (Observatory read-only view)
//
// Module portability: any module render function can be called from outside
// Mission Control by: (1) setting data-atlas-theme on host element,
// (2) calling _saResolveColors(hostEl), (3) calling _saRenderXxx(hostEl).
let _saCurrentRole = 'superadmin'; // resolved from auth token at open time

const _C = {
  bg:'#070e1d', bg2:'#0a1527', surface:'#0d1b2e',
  border:'rgba(212,168,67,0.12)', borderB:'rgba(212,168,67,0.26)',
  amber:'#d4a843', amberDim:'rgba(212,168,67,0.55)', amberFaint:'rgba(212,168,67,0.09)',
  cyan:'#38bdf8', cyanDim:'rgba(56,189,248,0.5)',
  green:'#2ec98a', greenDim:'rgba(46,201,138,0.45)', greenFaint:'rgba(46,201,138,0.08)',
  red:'#ef4444', blue:'#4e9cf5', purple:'#8b6ff5',
  text:'rgba(205,216,232,0.92)', muted:'rgba(138,160,184,0.8)',
  dim:'rgba(96,120,152,0.65)', navy:'rgba(212,168,67,0.06)',
};

// Inject CSS custom property tokens into <head> (idempotent).
function _saInjectStyles() {
  if (document.getElementById('atlas-mc-tokens')) return;
  const s = document.createElement('style');
  s.id = 'atlas-mc-tokens';
  s.textContent = `
    /* ── ATLAS Design Tokens ── dark (Mission Control) ── */
    :root {
      --mc-bg:#070e1d;       --mc-bg2:#0a1527;      --mc-surface:#0d1b2e;
      --mc-border:rgba(212,168,67,0.12);  --mc-border-b:rgba(212,168,67,0.26);
      --mc-amber:#d4a843;    --mc-amber-dim:rgba(212,168,67,0.55); --mc-amber-faint:rgba(212,168,67,0.09);
      --mc-cyan:#38bdf8;     --mc-cyan-dim:rgba(56,189,248,0.5);
      --mc-green:#2ec98a;    --mc-red:#ef4444;   --mc-blue:#4e9cf5; --mc-purple:#8b6ff5;
      --mc-text:rgba(205,216,232,0.92);  --mc-muted:rgba(138,160,184,0.8);
      --mc-dim:rgba(96,120,152,0.65);    --mc-navy:rgba(212,168,67,0.06);
    }
    /* ── light theme — clinical / patient / PI paths ── */
    [data-atlas-theme="light"] {
      --mc-bg:#faf8f4;       --mc-bg2:#f3ede3;      --mc-surface:#ffffff;
      --mc-border:rgba(180,140,60,0.18);  --mc-border-b:rgba(180,140,60,0.38);
      --mc-amber:#b8882e;    --mc-amber-dim:rgba(184,136,46,0.65); --mc-amber-faint:rgba(184,136,46,0.07);
      --mc-cyan:#0284c7;     --mc-cyan-dim:rgba(2,132,199,0.4);
      --mc-green:#059669;    --mc-red:#dc2626;   --mc-blue:#2563eb; --mc-purple:#7c3aed;
      --mc-text:#1a1614;     --mc-muted:#5c4e3e;
      --mc-dim:#9a8878;      --mc-navy:rgba(180,140,60,0.05);
    }
    /* ── CSS utility classes using CSS vars (theme-aware) ── */
    @keyframes sa-pulse{0%,100%{opacity:1}50%{opacity:.35}}
    @keyframes sa-feed-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
    #sa-overlay *::-webkit-scrollbar{width:4px}
    #sa-overlay *::-webkit-scrollbar-track{background:transparent}
    #sa-overlay *::-webkit-scrollbar-thumb{background:rgba(212,168,67,.22);border-radius:2px}
    .sa-nav-btn{display:flex;align-items:center;gap:9px;padding:10px 16px;cursor:pointer;border:none;background:none;width:100%;text-align:left;border-radius:6px;transition:background .15s;color:var(--mc-dim);font-family:'IBM Plex Mono',monospace;font-size:.86rem;letter-spacing:.1em;text-transform:uppercase}
    .sa-nav-btn:hover{background:var(--mc-amber-faint);color:var(--mc-text)}
    .sa-nav-btn.sa-active{background:var(--mc-amber-faint);color:var(--mc-amber);border-left:2px solid var(--mc-amber);padding-left:14px}
    .sa-nav-btn.sa-locked{opacity:.38;cursor:default}
    .sa-panel{background:var(--mc-surface);border:1px solid var(--mc-border);border-radius:10px;padding:20px 22px}
    .sa-panel-sm{background:var(--mc-surface);border:1px solid var(--mc-border);border-radius:10px;padding:14px 18px}
    .sa-kpi{display:flex;flex-direction:column;gap:4px}
    .sa-kpi-val{font-size:1.75rem;font-weight:700;line-height:1;letter-spacing:-.03em}
    .sa-kpi-lbl{font-size:.74rem;letter-spacing:.22em;text-transform:uppercase}
    .sa-section-eyebrow{font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:var(--mc-amber-dim);margin-bottom:4px}
    .sa-section-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;font-weight:400;color:var(--mc-text);margin-bottom:16px}
    .sa-feed-item{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--mc-border);animation:sa-feed-in .3s ease;font-size:.86rem}
    .sa-feed-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:3px}
    .sa-tag{display:inline-block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;padding:1px 5px;border-radius:3px;border:1px solid}
  `;
  document.head.appendChild(s);
}

// Populate _C from CSS custom properties on el (or :root if el omitted).
// Call this once before rendering a module in a new theme context.
function _saResolveColors(el) {
  const s = getComputedStyle(el || document.documentElement);
  const g = k => s.getPropertyValue('--mc-'+k).trim();
  Object.assign(_C, {
    bg:         g('bg'),          bg2:        g('bg2'),
    surface:    g('surface'),
    border:     g('border'),      borderB:    g('border-b'),
    amber:      g('amber'),       amberDim:   g('amber-dim'),   amberFaint: g('amber-faint'),
    cyan:       g('cyan'),        cyanDim:    g('cyan-dim'),
    green:      g('green'),       red:        g('red'),
    blue:       g('blue'),        purple:     g('purple'),
    text:       g('text'),        muted:      g('muted'),
    dim:        g('dim'),         navy:       g('navy'),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — called by openCommandCenter() (superadmin) or
//               openInstitutionControl() (pi) in export-functions.js after
//               token verification confirms role claim.
// opts: { role:'superadmin'|'pi'|'student', institutionCode:'XXXX' }
// ══════════════════════════════════════════════════════════════════════════════

function _saOpenMissionControl(opts = {}) {
  // Mission Control is superadmin-only — opts retained for API compatibility
  _saCurrentRole = 'superadmin';

  if (_saOpen) {
    const el = document.getElementById('sa-overlay');
    if (el) { el.style.display = 'flex'; return; }
  }
  _saOpen = true;
  _saFeedItemCount = 0;
  _saInjectShell();
  _saInitTopBar();
  saTab('command');
}

function _saClose() {
  _saOpen = false;
  _saFbListeners.forEach(({ ref: r, event: ev, fn }) => {
    try { r.off(ev, fn); } catch(e) {}
  });
  _saFbListeners = [];
  if (_saTopBarTimer) { clearInterval(_saTopBarTimer); _saTopBarTimer = null; }
  const el = document.getElementById('sa-overlay');
  if (el) el.remove();
}

// ── Mission Control theme toggle ───────────────────────────────────────────────
// Toggles data-atlas-theme on #sa-overlay (dark ↔ light), re-resolves _C color
// tokens, patches every inline-styled shell element, and re-renders the active tab.
function _saMcToggleTheme() {
  const overlay = document.getElementById('sa-overlay');
  if (!overlay) return;

  const isLight = overlay.getAttribute('data-atlas-theme') === 'light';
  const next    = isLight ? 'dark' : 'light';
  overlay.setAttribute('data-atlas-theme', next);

  // Re-resolve _C from the overlay so subsequent renders use the new palette.
  // CSS vars on a live element resolve correctly after data-atlas-theme is set.
  _saResolveColors(overlay);

  // ── Patch shell chrome (all inline-style elements) ──────────────────────────

  // Overall overlay background
  overlay.style.background = _C.bg;

  // Topbar
  const topbar = document.getElementById('sa-topbar');
  if (topbar) {
    topbar.style.background   = _C.bg2;
    topbar.style.borderBottom = '1px solid ' + _C.border;
  }

  // Nav rail — replace entirely so inline ${_C.*} text colors update
  const navContainer = document.getElementById('sa-nav');
  if (navContainer) {
    const freshNav = _saNavRailHTML();
    navContainer.outerHTML = freshNav;
    // Re-attach tab click handlers on the new nav buttons
    document.querySelectorAll('.sa-nav-btn').forEach(b => {
      b.addEventListener('click', () => saTab(b.dataset.saTab));
    });
    // Restore active highlight
    document.querySelectorAll('.sa-nav-btn').forEach(b => {
      b.classList.toggle('sa-active', b.dataset.saTab === _saActiveTab);
    });
  }

  // AI sidebar border
  const sidebar = document.getElementById('sa-ai-sidebar');
  if (sidebar) sidebar.style.borderLeft = '1px solid ' + _C.border;

  // ── Toggle button icon + label ──────────────────────────────────────────────
  const icon  = document.getElementById('sa-theme-icon');
  const label = document.getElementById('sa-theme-label');
  if (icon)  icon.textContent  = next === 'light' ? '☽' : '☀';
  if (label) label.textContent = next === 'light' ? 'Night' : 'Day';

  // ── Sync global theme so the rest of the app matches ───────────────────────
  if (typeof applyTheme === 'function') applyTheme(next);
  try { localStorage.setItem('atlas_theme', next); } catch(e) {}

  // ── Re-render the active module panel so inline ${_C.*} styles update ──────
  // Remove any once-injected module stylesheets so they are re-injected with
  // the correct CSS-var references under the new theme.
  ['rl-styles'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  if (_saActiveTab) saTab(_saActiveTab);
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — SHELL (three-zone layout: nav rail · main · AI sidebar)
// ══════════════════════════════════════════════════════════════════════════════

function _saInjectShell() {
  const prev = document.getElementById('sa-overlay');
  if (prev) prev.remove();

  // Inject CSS token sheet (color tokens are applied per-theme below)
  _saInjectStyles();

  // Inherit global theme — so MC opens in whatever mode the user already has
  const _globalTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  // Temporarily apply the opening theme to _C so the HTML is rendered with correct colors
  if (_globalTheme === 'light') {
    Object.assign(_C, {
      bg:'#faf8f4', bg2:'#f3ede3', surface:'#ffffff',
      border:'rgba(180,140,60,0.18)', borderB:'rgba(180,140,60,0.38)',
      amber:'#b8882e', amberDim:'rgba(184,136,46,0.65)', amberFaint:'rgba(184,136,46,0.07)',
      cyan:'#0284c7', cyanDim:'rgba(2,132,199,0.4)',
      green:'#059669', red:'#dc2626', blue:'#2563eb', purple:'#7c3aed',
      text:'#1a1614', muted:'#5c4e3e', dim:'#9a8878', navy:'rgba(180,140,60,0.05)',
    });
  }

  const overlay = document.createElement('div');
  overlay.id = 'sa-overlay';
  overlay.setAttribute('data-atlas-theme', _globalTheme);
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9900;
    background:${_C.bg};
    display:flex;flex-direction:column;
    font-family:'IBM Plex Mono',monospace;
    overflow:hidden;
  `.replace(/\n\s*/g,' ').trim();

  overlay.innerHTML = `
    ${_saTopBarHTML()}
    <div style="display:flex;flex:1;overflow:hidden;">
      ${_saNavRailHTML()}
      <div id="sa-main" style="flex:1;min-height:0;overflow-y:auto;padding:24px 28px;"></div>
      <div id="sa-ai-sidebar" style="width:320px;border-left:1px solid ${_C.border};display:flex;flex-direction:column;overflow:hidden;transition:width 0.25s ease;">
        ${_saAiSidebarHTML()}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Sync toggle button state with the inherited theme
  const _thIcon  = overlay.querySelector('#sa-theme-icon');
  const _thLabel = overlay.querySelector('#sa-theme-label');
  if (_thIcon)  _thIcon.textContent  = _globalTheme === 'light' ? '☽' : '☀';
  if (_thLabel) _thLabel.textContent = _globalTheme === 'light' ? 'Night' : 'Day';

  overlay.querySelectorAll('[data-sa-tab]').forEach(btn => {
    btn.addEventListener('click', () => saTab(btn.dataset.saTab));
  });
  overlay.querySelector('#sa-close-btn').addEventListener('click', _saClose);
  overlay.querySelector('#sa-ai-toggle').addEventListener('click', _saToggleAI);

  // Populate anomaly queue if cache is already warm (re-opened Mission Control)
  if (_saCache.mmas.length > 0) _saRunAnomalyDetection();
}

// ── Top Bar ──────────────────────────────────────────────────────────────────

function _saTopBarHTML() {
  return `
  <div id="sa-topbar" style="
    background:${_C.bg2};border-bottom:1px solid ${_C.border};
    padding:0 20px;height:52px;display:flex;align-items:center;gap:0;
    flex-shrink:0;
  ">
    <!-- Brand -->
    <div style="display:flex;align-items:center;gap:10px;padding-right:24px;border-right:1px solid ${_C.border};flex-shrink:0;">
      <span id="sa-live-dot" style="width:7px;height:7px;border-radius:50%;background:${_C.amber};box-shadow:0 0 8px ${_C.amber};animation:sa-pulse 2s infinite;flex-shrink:0;"></span>
      <span style="font-size:0.84rem;letter-spacing:0.26em;text-transform:uppercase;color:${_C.amber};font-weight:700;">ATLAS Mission Control</span>
    </div>

    <!-- Live stats strip -->
    <div style="display:flex;flex:1;align-items:center;gap:0;">
      ${_saTopStat('sa-stat-sessions',  'Active Sessions', '—',     _C.cyan)}
      ${_saTopStat('sa-stat-mmas',      'MMAS Today',      '—',     _C.blue)}
      ${_saTopStat('sa-stat-map',       'MAP Today',       '—',     _C.green)}
      ${_saTopStat('sa-stat-peacs',     'PEACS Today',     '—',     _C.purple)}
      ${_saTopStat('sa-stat-total',     'Total Records',   '—',     _C.amber)}
      ${_saTopStat('sa-stat-gai',       'GAI',             '—',     _C.amber)}
      ${_saTopStat('sa-stat-ws',        'Workspaces',      '—',     _C.cyan)}
    </div>

    <!-- Controls -->
    <div style="display:flex;align-items:center;gap:10px;padding-left:20px;border-left:1px solid ${_C.border};flex-shrink:0;">
      <div id="sa-clock" style="font-size:0.86rem;letter-spacing:0.14em;color:${_C.muted};"></div>
      <button onclick="_saMcToggleTheme()" title="Switch Night / Daylight" style="background:${_C.amberFaint};border:1px solid ${_C.border};color:${_C.muted};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;padding:5px 10px;border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:5px;transition:color 0.2s;"><span id="sa-theme-icon">☀</span><span id="sa-theme-label">Day</span></button>
      <button id="sa-ai-toggle" title="Toggle AI Sidebar" style="background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.25);color:${_C.amber};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;padding:5px 10px;border-radius:5px;cursor:pointer;">◍ AI</button>
      <button id="sa-close-btn" title="Exit Mission Control" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);color:rgba(239,68,68,0.8);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;padding:5px 10px;border-radius:5px;cursor:pointer;" onmouseover="this.style.background='rgba(239,68,68,0.16)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">✕ Exit</button>
    </div>
  </div>
  <!-- CSS classes injected by _saInjectStyles() — theme-aware via CSS vars -->`;
}

function _saTopStat(id, label, val, color) {
  return `
  <div style="display:flex;flex-direction:column;gap:1px;padding:0 20px;border-right:1px solid ${_C.border};">
    <div id="${id}" style="font-size:1.05rem;font-weight:700;color:${color};line-height:1;">${val}</div>
    <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};">${label}</div>
  </div>`;
}

// ── Nav Rail ──────────────────────────────────────────────────────────────────

// ── Module registry — single source of truth for visibility + access control ──
// roles:  which user tiers can access this module
// scope:  'admin' = superadmin-only tools | 'data' = research/clinical | 'monitor' = read-only views
// filter: 'global' = all data | 'institution' = scoped to user's institution_code | 'self' = own records
// Modules are portable: render fn accepts any container + theme context.
const _ATLAS_MODULES = {
  command:      { id:'command',      icon:'◉', label:'Command',       roles:['superadmin'], scope:'admin', filter:'global' },
  globe:        { id:'globe',        icon:'⬡', label:'Global Atlas',  roles:['superadmin'], scope:'data',  filter:'global' },
  psychometrics:{ id:'psychometrics',icon:'◈', label:'Psychometrics', roles:['superadmin'], scope:'data',  filter:'global' },
  cohort:       { id:'cohort',       icon:'◫', label:'Cohort Intel',  roles:['superadmin'], scope:'data',  filter:'global' },
  ai:           { id:'ai',           icon:'◍', label:'AI Engine',     roles:['superadmin'], scope:'admin', filter:'global' },
  research:     { id:'research',     icon:'◩', label:'Research',      roles:['superadmin'], scope:'data',  filter:'global' },
  observatory:  { id:'observatory',  icon:'◭', label:'Observatory',   roles:['superadmin'], scope:'monitor',filter:'global'},
  gai:          { id:'gai',          icon:'◎', label:'GAI Index',     roles:['superadmin'], scope:'data',  filter:'global' },
  consortium:   { id:'consortium',   icon:'⬡', label:'Consortium',    roles:['superadmin'], scope:'admin', filter:'global' },
  platform:     { id:'platform',     icon:'◪', label:'Platform',      roles:['superadmin'], scope:'admin', filter:'global' },
  records:      { id:'records',      icon:'◫', label:'Data Ledger',   roles:['superadmin'], scope:'admin', filter:'global' },
  auditlog:     { id:'auditlog',     icon:'⊕', label:'Audit Log',     roles:['superadmin'], scope:'admin', filter:'global' },
  rescue:       { id:'rescue',       icon:'↺', label:'Data Rescue',   roles:['superadmin'], scope:'admin', filter:'global' },
  compliance:   { id:'compliance',   icon:'⊛', label:'Compliance Hub', roles:['superadmin'], scope:'admin', filter:'global' },
  lab:          { id:'lab',          icon:'◈', label:'Instrument Lab',  roles:['superadmin'], scope:'data',  filter:'global' },
};

function _saNavRailHTML() {
  // All modules are superadmin-only — no role filtering needed, but kept for future extensibility
  const visible = Object.values(_ATLAS_MODULES).filter(m => m.roles.includes(_saCurrentRole));

  const items = visible.map(t => {
    return `<button class="sa-nav-btn" data-sa-tab="${t.id}">
      <span style="font-size:1.00rem;opacity:0.7;">${t.icon}</span>
      <span>${t.label}</span>
    </button>`;
  }).join('');

  // Role impersonation roster — mirrors VA_ROLES from auth-roles.js
  // Clicking a role: closes Mission Control → activates view-as → live re-renders dashboard
  const impersonateRoles = [
    { key:'student',              label:'Student',         dot:'#2ec98a' },
    { key:'researcher',           label:'Researcher',      dot:'#8b6ff5' },
    { key:'clinician',            label:'Clinician',       dot:'#10b981' },
    { key:'pi',                   label:'PI',              dot:'#d4a843' },
    { key:'institution_academic', label:'Academic Inst.',  dot:'#4e9cf5' },
    { key:'institution_health',   label:'Health System',   dot:'#4e9cf5' },
    { key:'institution_amc',      label:'Academic MC',     dot:'#4e9cf5' },
    { key:'observer',             label:'Observer',        dot:'#6b8099' },
  ];

  const roleButtons = impersonateRoles.map(r => `
    <button onclick="_saImpersonate('${r.key}')"
      style="display:flex;align-items:center;gap:7px;width:100%;padding:5px 6px;border-radius:5px;
             background:transparent;border:none;cursor:pointer;text-align:left;transition:background 0.12s;"
      onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='transparent'">
      <span style="width:6px;height:6px;border-radius:50%;background:${r.dot};flex-shrink:0;display:inline-block;"></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_C.muted};">${r.label}</span>
    </button>`).join('');

  return `
  <div id="sa-nav" style="
    width:190px;flex-shrink:0;
    background:${_C.bg2};border-right:1px solid ${_C.border};
    display:flex;flex-direction:column;padding:16px 10px;gap:2px;overflow-y:auto;
  ">
    <div style="font-size:0.68rem;letter-spacing:0.28em;text-transform:uppercase;color:${_C.dim};padding:4px 6px 10px;">Navigation</div>
    ${items}
    <div style="margin-top:auto;padding-top:14px;border-top:1px solid ${_C.border};">
      <div style="font-size:0.66rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.dim};padding:4px 6px 8px;display:flex;align-items:center;gap:6px;">
        <span style="color:${_C.amber};opacity:0.6;">◐</span> Impersonate Role
      </div>
      <div style="font-size:0.70rem;color:${_C.dim};padding:0 6px 8px;line-height:1.4;">
        Closes Mission Control — renders live dashboard as selected role.
      </div>
      ${roleButtons}
    </div>
  </div>`;
}

// ── Impersonate: close MC → activate View-As → re-render dashboard as role ────
function _saImpersonate(roleKey) {
  if (typeof VA_ROLES === 'undefined' || !VA_ROLES[roleKey]) {
    showToast('Role not found in VA_ROLES registry.', 2500);
    return;
  }
  _saClose();          // close Mission Control overlay
  // Small delay so the overlay teardown completes before dashboard re-render
  setTimeout(() => {
    if (typeof activateViewAs === 'function') {
      activateViewAs(roleKey);
    } else {
      showToast('View-As system not available.', 2500);
    }
  }, 120);
}

// ── AI Sidebar ────────────────────────────────────────────────────────────────

function _saAiSidebarHTML() {
  return `
  <div style="padding:16px 18px;border-bottom:1px solid ${_C.border};flex-shrink:0;">
    <div style="font-size:0.72rem;letter-spacing:0.26em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:3px;">ATLAS AI</div>
    <div style="font-size:1.00rem;color:${_C.text};">Intelligence Feed</div>
  </div>

  <div id="sa-ai-briefing" style="padding:14px 18px;border-bottom:1px solid ${_C.border};flex-shrink:0;"></div>

  <div style="flex:1;overflow-y:auto;padding:14px 18px;">
    <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.dim};margin-bottom:8px;">Anomaly Queue</div>
    <div id="sa-anomaly-queue" style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:0.90rem;color:${_C.dim};font-style:italic;">Loading anomaly detection…</div>
    </div>
  </div>

  <div style="padding:14px 18px;border-top:1px solid ${_C.border};flex-shrink:0;">
    <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.dim};margin-bottom:8px;">Ask ATLAS AI</div>
    <div style="display:flex;gap:6px;">
      <input id="sa-ai-query" placeholder="Natural language query…" style="flex:1;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:7px 10px;border-radius:5px;outline:none;" />
      <button onclick="_saAskAI()" style="background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.3);color:${_C.amber};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:7px 10px;border-radius:5px;cursor:pointer;">→</button>
    </div>
    <div id="sa-ai-response" style="margin-top:10px;font-size:0.88rem;color:${_C.muted};line-height:1.6;min-height:40px;"></div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB ROUTER
// ══════════════════════════════════════════════════════════════════════════════

function saTab(tabId) {
  const tab = _ATLAS_MODULES[tabId];
  if (!tab || !tab.roles.includes(_saCurrentRole)) return;
  _saActiveTab = tabId;

  // Nav highlight
  document.querySelectorAll('.sa-nav-btn').forEach(b => {
    b.classList.toggle('sa-active', b.dataset.saTab === tabId);
  });

  const main = document.getElementById('sa-main');
  if (!main) return;

  switch (tabId) {
    case 'command':  _saRenderCommand(main);  break;
    case 'globe':    _saRenderGlobe(main);    break;
    case 'cohort':   _saRenderCohort(main);   break;
    case 'psychometrics': _saRenderPsychometrics(main); break;
    case 'ai':       _saRenderAI(main);       break;
    case 'research': _saRenderResearch(main);  break;
    case 'consortium':    (window.saConsortiumInit ? window.saConsortiumInit(main) : (main.innerHTML = `<div style="color:${_C.muted};padding:20px;">Consortium module loading…</div>`)); break;
    case 'platform':     _saRenderPlatform(main);     break;
    case 'observatory':  _saRenderObservatory(main);  break;
    case 'gai':          _saRenderGAI(main);          break;
    case 'records':      _saRenderRecords(main);      break;
    case 'auditlog':     _saRenderAuditLog(main);     break;
    case 'rescue':       _saRenderRescue(main);       break;
    case 'compliance':   _saRenderCompliance(main);   break;
    case 'lab':          _saRenderLab(main);           break;
    default:
      main.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:12px;">
        <div style="font-size:2rem;opacity:0.2;">${tab.icon}</div>
        <div style="font-size:0.84rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.dim};">${tab.label} — Coming Next</div>
        <div style="font-size:0.94rem;color:${_C.muted};">This module is queued for the next build sprint.</div>
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — COMMAND CENTER
// ══════════════════════════════════════════════════════════════════════════════


// ── Shared utilities (moved here from command/audit sections for cross-tab access) ──

function _saSetStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _saSetEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _saShowError(msg) {
  const main = document.getElementById('sa-main');
  if (main) main.innerHTML = `<div style="padding:40px;color:${_C.red};font-size:1.00rem;">${msg}</div>`;
}

// ── Lightweight dialog overlay (renders inside #sa-overlay) ───────────────────
// opts: { title, body (HTML), confirmLabel, onConfirm() → true=close / false=keep open }
function _saShowModal(opts = {}) {
  const existingId = 'sa-mc-modal';
  const prev = document.getElementById(existingId);
  if (prev) prev.remove();

  const backdrop = document.createElement('div');
  backdrop.id = existingId;
  backdrop.style.cssText = `position:absolute;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);`;

  backdrop.innerHTML = `
    <div style="background:${_C.bg2};border:1px solid ${_C.borderB};border-radius:12px;width:${opts.width||'520px'};max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
      <div style="padding:18px 20px;border-bottom:1px solid ${_C.border};display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.96rem;font-weight:700;color:${_C.text};letter-spacing:0.04em;">${opts.title||'Dialog'}</span>
        <button id="sa-mc-modal-x" style="background:none;border:none;color:${_C.dim};font-size:1.1rem;cursor:pointer;padding:0 4px;">✕</button>
      </div>
      <div style="padding:20px;">
        ${opts.body||''}
      </div>
      <div style="padding:14px 20px;border-top:1px solid ${_C.border};display:flex;justify-content:flex-end;gap:10px;">
        <button id="sa-mc-modal-cancel"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:7px 16px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.muted};transition:all 0.15s;">
          Cancel
        </button>
        <button id="sa-mc-modal-ok"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:7px 16px;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;">
          ${opts.confirmLabel||'OK'}
        </button>
      </div>
    </div>`;

  const close = () => backdrop.remove();
  backdrop.querySelector('#sa-mc-modal-x').onclick      = close;
  backdrop.querySelector('#sa-mc-modal-cancel').onclick = close;
  backdrop.querySelector('#sa-mc-modal-ok').onclick = async () => {
    if (!opts.onConfirm) { close(); return; }
    const shouldClose = await opts.onConfirm();
    if (shouldClose !== false) close();
  };

  const overlay = document.getElementById('sa-overlay');
  if (overlay) overlay.appendChild(backdrop);
}


// ── HTML-escape helper (used across all tab files) ──────────────────────────────────
function _saEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
