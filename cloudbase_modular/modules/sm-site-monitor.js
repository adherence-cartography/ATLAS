// ══════════════════════════════════════════════════════════════════════════════
// SITE MONITOR — sm-site-monitor.js
// Sponsored Trial tier tab for institution dashboard (institution_sponsored role)
// Zones: Site Status Grid | Enrollment Funnel | Overdue Alerts | Protocol Gantt
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

// ─── Module-level state ────────────────────────────────────────────────────────

/** @type {Function|null} Firebase real-time listener unsubscribe handle */
let _smListener = null;

/** @type {Object[]} Current site data array (live or demo) */
let _smSites = [];

/** @type {boolean} True when running on seeded demo data */
let _smDemoMode = false;

/** @type {{col: string, dir: 'asc'|'desc'}} Grid sort state */
let _smSort = { col: 'code', dir: 'asc' };

/** @type {string} Current search filter string */
let _smFilter = '';

/** @type {string|null} Currently expanded site row id */
let _smExpandedSiteId = null;

// ─── Role helpers ──────────────────────────────────────────────────────────────

function smCanFlag() {
  return ['institution_sponsored', 'superadmin'].includes(
    typeof _role !== 'undefined' ? _role : ''
  );
}

function smSponsorOnly() {
  return (typeof _role !== 'undefined' ? _role : '') === 'sponsor_observer';
}

/** Returns the site_id this coordinator is restricted to, or null for full access. */
function smCoordinatorSiteId() {
  if (typeof _role !== 'undefined' && _role === 'pi') {
    // Convention: last segment of workspace key identifies site when PI-scoped
    if (typeof _workspaceKey !== 'undefined') {
      const parts = _workspaceKey.split('-');
      return parts[parts.length - 1] || null;
    }
  }
  return null;
}

// ─── Demo data seed ────────────────────────────────────────────────────────────

function smBuildDemoData() {
  const now = Date.now();
  const day = 86400000;
  const month = 30 * day;

  const statuses = ['on_track', 'on_track', 'on_track', 'on_track', 'on_track', 'watch', 'watch', 'alert'];

  const sites = [];
  for (let i = 1; i <= 8; i++) {
    const code = `RWTCAD-00${i}`;
    const status = statuses[i - 1];
    const enrolledCount = status === 'alert' ? 20 : status === 'watch' ? 28 + i : 35 + i;
    const ltfuCount = status === 'alert' ? 3 : status === 'watch' ? 1 : 0;
    const progressFactor = enrolledCount / 44;

    // Build synthetic participant list for overdue calculations
    const participants = {};
    const numParticipants = enrolledCount;
    for (let p = 1; p <= numParticipants; p++) {
      const pid = `${code}-P${String(p).padStart(3, '0')}`;
      const enrolled = now - (month * 14) - (Math.random() * month * 4);
      const a1Open  = enrolled + (month * 0);
      const a1Close = a1Open  + (month * 1.5);
      const a2Open  = enrolled + (month * 5.5);
      const a2Close = a2Open  + (month * 1.5);
      const a3Open  = enrolled + (month * 11.5);
      const a3Close = a3Open  + (month * 1.5);

      const a1Completed = now > a1Open ? enrolled + month + (Math.random() * (month * 0.5)) : null;
      const a2Completed = (a1Completed && now > a2Open && Math.random() > (status === 'alert' ? 0.4 : 0.2))
        ? a2Open + (Math.random() * month) : null;
      const a3Completed = (a2Completed && now > a3Open && Math.random() > 0.6)
        ? a3Open + (Math.random() * month) : null;

      const isOverdue = (
        (now > a1Close && !a1Completed) ||
        (now > a2Close && a1Completed && !a2Completed) ||
        (now > a3Close && a2Completed && !a3Completed)
      );

      participants[pid] = {
        assessment_windows: {
          a1: { open: a1Open, close: a1Close, completed_ts: a1Completed },
          a2: { open: a2Open, close: a2Close, completed_ts: a2Completed },
          a3: { open: a3Open, close: a3Close, completed_ts: a3Completed },
        },
        overdue: isOverdue,
        ltfu: p <= ltfuCount,
      };
    }

    sites.push({
      id: code,
      code,
      name: `RWTCAD Clinical Site ${i}`,
      pi_name: ['Dr. Vasquez', 'Dr. Okonkwo', 'Dr. Patel', 'Dr. Chen', 'Dr. Rahman', 'Dr. Silva', 'Dr. Novak', 'Dr. Abebe'][i - 1],
      enrollment_target: 44,
      enrolled_count: enrolledCount,
      ltfu_count: ltfuCount,
      last_activity_ts: now - (Math.random() * 7 * day),
      status,
      coordinator_emails: [
        `coord${i}a@rwtcad-site${i}.org`,
        `coord${i}b@rwtcad-site${i}.org`,
      ],
      participants,
    });
  }
  return sites;
}

// ─── Data loading ──────────────────────────────────────────────────────────────

/**
 * Attach a Firebase real-time listener on sites; calls cb(sitesArray) on each update.
 * Falls back to demo data if the path is empty.
 */
function smAttachListener(cb) {
  if (typeof database === 'undefined' || typeof _workspaceKey === 'undefined') {
    _smDemoMode = true;
    cb(smBuildDemoData());
    return;
  }

  const sitesRef = database.ref(`workspaces/${_workspaceKey}/sites`);

  _smListener = sitesRef.on('value', async (snap) => {
    const raw = snap.val();
    if (!raw || Object.keys(raw).length === 0) {
      _smDemoMode = true;
      cb(smBuildDemoData());
      return;
    }
    _smDemoMode = false;

    // Expand each site with its participants sub-collection already present in the snapshot
    const sites = Object.entries(raw).map(([siteId, siteData]) => {
      const participants = siteData.participants || {};
      return {
        id: siteId,
        code: siteData.code || siteId,
        name: siteData.name || siteId,
        pi_name: siteData.pi_name || '',
        enrollment_target: siteData.enrollment_target || 0,
        enrolled_count: siteData.enrolled_count || 0,
        ltfu_count: siteData.ltfu_count || 0,
        last_activity_ts: siteData.last_activity_ts || 0,
        status: siteData.status || 'on_track',
        coordinator_emails: siteData.coordinator_emails || [],
        participants,
      };
    });

    // Apply coordinator site restriction
    const restrictToSiteId = smCoordinatorSiteId();
    cb(restrictToSiteId ? sites.filter(s => s.id === restrictToSiteId) : sites);
  });
}

function smDetachListener() {
  if (_smListener && typeof database !== 'undefined' && typeof _workspaceKey !== 'undefined') {
    database.ref(`workspaces/${_workspaceKey}/sites`).off('value', _smListener);
  }
  _smListener = null;
}

// ─── Derived metrics helpers ───────────────────────────────────────────────────

function smAssessmentStats(site) {
  const parts = Object.values(site.participants || {});
  if (parts.length === 0) return { a1: 0, a2: 0, a3: 0 };
  const total = parts.length;
  const a1 = parts.filter(p => p.assessment_windows?.a1?.completed_ts).length;
  const a2 = parts.filter(p => p.assessment_windows?.a2?.completed_ts).length;
  const a3 = parts.filter(p => p.assessment_windows?.a3?.completed_ts).length;
  return {
    a1: Math.round((a1 / total) * 100),
    a2: Math.round((a2 / total) * 100),
    a3: Math.round((a3 / total) * 100),
  };
}

function smComplianceRate(site) {
  const enrolled = site.enrolled_count || 0;
  if (enrolled === 0) return 0;
  const ltfu = site.ltfu_count || 0;
  return Math.round(((enrolled - ltfu) / enrolled) * 100);
}

function smOverdueParticipants(site) {
  const now = Date.now();
  const results = [];
  Object.entries(site.participants || {}).forEach(([pid, p]) => {
    if (p.ltfu) return;
    const wins = p.assessment_windows || {};
    ['a1', 'a2', 'a3'].forEach(key => {
      const w = wins[key];
      if (!w) return;
      if (!w.completed_ts && w.close && now > w.close) {
        const daysPast = Math.floor((now - w.close) / 86400000);
        results.push({
          pid,
          siteCode: site.code,
          siteId: site.id,
          assessment: key.toUpperCase(),
          daysPast,
        });
      }
    });
  });
  return results;
}

/** Formats a unix ms timestamp as a relative string, e.g. "3d ago". */
function smRelativeTime(ts) {
  if (!ts) return 'N/A';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Shared CSS injection ──────────────────────────────────────────────────────

function smInjectStyles() {
  if (document.getElementById('sm-styles')) return;
  const style = document.createElement('style');
  style.id = 'sm-styles';
  style.textContent = `
    /* ── Site Monitor global panel styles ── */
    #inst-tab-panel-sitemonitor {
      font-family: var(--font-mono, 'IBM Plex Mono', monospace);
      color: var(--text, #c8d6e8);
      padding: 0 4px;
    }

    /* Demo banner */
    .sm-demo-banner {
      background: rgba(26,148,136,0.12);
      border: 1px solid rgba(26,148,136,0.35);
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 11.5px;
      color: #1a9488;
      margin-bottom: 18px;
      letter-spacing: 0.04em;
    }

    /* Zone wrappers */
    .sm-zone {
      margin-bottom: 24px;
    }
    .sm-zone-title {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted, #8aa0b8);
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border2, rgba(255,255,255,0.13));
    }

    /* Search / filter row */
    .sm-filter-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .sm-search-input {
      background: var(--card, #111e32);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 5px;
      color: var(--text, #c8d6e8);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      padding: 6px 10px;
      width: 260px;
      outline: none;
      transition: border-color 0.18s;
    }
    .sm-search-input:focus {
      border-color: rgba(26,148,136,0.6);
    }
    .sm-search-input::placeholder { color: var(--muted, #8aa0b8); }

    /* Site grid table */
    .sm-grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .sm-grid-table th {
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted, #8aa0b8);
      padding: 6px 10px;
      border-bottom: 1px solid var(--border2, rgba(255,255,255,0.13));
      cursor: pointer;
      white-space: nowrap;
      user-select: none;
    }
    .sm-grid-table th:hover { color: var(--text, #c8d6e8); }
    .sm-grid-table th.sm-sort-active { color: #1a9488; }
    .sm-sort-arrow { margin-left: 4px; opacity: 0.7; }

    .sm-grid-table td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      vertical-align: middle;
    }
    .sm-grid-table tr.sm-site-row {
      cursor: pointer;
      transition: background 0.14s;
    }
    .sm-grid-table tr.sm-site-row:hover { background: rgba(26,148,136,0.06); }
    .sm-grid-table tr.sm-site-row.sm-row-expanded { background: rgba(26,148,136,0.1); }

    /* Enrollment cell */
    .sm-enroll-cell { min-width: 110px; }
    .sm-enroll-label { font-size: 11px; margin-bottom: 3px; }
    .sm-progress-track {
      height: 4px;
      background: var(--dim, rgba(138,160,184,0.45));
      border-radius: 2px;
      overflow: hidden;
      margin-top: 3px;
    }
    .sm-progress-fill {
      height: 100%;
      border-radius: 2px;
      background: #1a9488;
      transition: width 0.4s;
    }

    /* Assessment pct cells */
    .sm-pct-cell {
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .sm-pct-low  { color: #e06060; }
    .sm-pct-mid  { color: #e8b84b; }
    .sm-pct-high { color: #1a9488; }

    /* Status pills */
    .sm-pill {
      display: inline-block;
      border-radius: 10px;
      padding: 2px 10px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .sm-pill-on_track { background: rgba(26,148,136,0.18); color: #1a9488; border: 1px solid rgba(26,148,136,0.4); }
    .sm-pill-watch    { background: rgba(232,184,75,0.15);  color: #e8b84b; border: 1px solid rgba(232,184,75,0.35); }
    .sm-pill-alert    { background: rgba(224,96,96,0.15);   color: #e06060; border: 1px solid rgba(224,96,96,0.35); }

    /* Expanded drawer */
    .sm-drawer-row td {
      padding: 0;
      border-bottom: 2px solid rgba(26,148,136,0.25);
    }
    .sm-drawer {
      background: rgba(26,148,136,0.04);
      padding: 14px 20px;
      animation: sm-slide-in 0.18s ease;
    }
    @keyframes sm-slide-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .sm-drawer-section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted, #8aa0b8);
      margin: 0 0 6px;
    }
    .sm-drawer-coords {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .sm-coord-chip {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      color: var(--text, #c8d6e8);
    }
    .sm-overdue-mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 12px;
    }
    .sm-overdue-mini-table th {
      text-align: left;
      color: var(--muted, #8aa0b8);
      padding: 4px 8px;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .sm-overdue-mini-table td {
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text, #c8d6e8);
    }
    .sm-no-overdue {
      font-size: 11px;
      color: #1a9488;
      margin-bottom: 12px;
    }

    /* Flag button */
    .sm-flag-btn {
      background: rgba(224,96,96,0.12);
      border: 1px solid rgba(224,96,96,0.35);
      border-radius: 5px;
      color: #e06060;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 4px 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .sm-flag-btn:hover { background: rgba(224,96,96,0.2); }
    .sm-flag-form {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 480px;
    }
    .sm-flag-textarea {
      background: var(--card, #111e32);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 5px;
      color: var(--text, #c8d6e8);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      padding: 8px;
      resize: vertical;
      min-height: 60px;
      outline: none;
    }
    .sm-flag-textarea:focus { border-color: rgba(224,96,96,0.5); }
    .sm-flag-submit {
      align-self: flex-start;
      background: rgba(224,96,96,0.18);
      border: 1px solid rgba(224,96,96,0.45);
      border-radius: 5px;
      color: #e06060;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 5px 14px;
      cursor: pointer;
    }
    .sm-flag-submit:hover { background: rgba(224,96,96,0.28); }
    .sm-flag-confirm {
      font-size: 11px;
      color: #1a9488;
      padding: 4px 0;
    }

    /* Zone 2 row layout */
    .sm-zone2-row {
      display: flex;
      gap: 20px;
    }
    .sm-zone2-left  { flex: 1 1 55%; min-width: 0; }
    .sm-zone2-right { flex: 1 1 40%; min-width: 240px; }

    /* Funnel SVG wrapper */
    .sm-funnel-wrap {
      background: var(--card, #111e32);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 8px;
      padding: 14px 16px;
    }
    .sm-funnel-svg { display: block; width: 100%; }

    /* Overdue alerts panel */
    .sm-overdue-panel {
      background: var(--card, #111e32);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 8px;
      padding: 12px;
      max-height: 320px;
      overflow-y: auto;
    }
    .sm-overdue-card {
      background: rgba(224,96,96,0.06);
      border: 1px solid rgba(224,96,96,0.18);
      border-radius: 6px;
      padding: 9px 12px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .sm-overdue-card-info { flex: 1 1 auto; }
    .sm-overdue-pid  { font-size: 12px; color: var(--bright, #e8f0f8); margin-bottom: 2px; }
    .sm-overdue-meta { font-size: 11px; color: var(--muted, #8aa0b8); }
    .sm-overdue-days {
      font-size: 13px;
      font-weight: 700;
      color: #e06060;
      white-space: nowrap;
      padding-top: 2px;
    }
    .sm-overdue-flag-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .sm-overdue-flag-inline {
      width: 100%;
      margin-top: 8px;
      background: rgba(17,30,50,0.8);
      border-radius: 5px;
      padding: 8px;
    }
    .sm-overdue-flag-ta {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(224,96,96,0.3);
      border-radius: 4px;
      color: var(--text, #c8d6e8);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 6px;
      resize: vertical;
      min-height: 50px;
      outline: none;
    }
    .sm-overdue-flag-ta:focus { border-color: rgba(224,96,96,0.6); }
    .sm-overdue-flag-row { display: flex; gap: 6px; margin-top: 6px; }
    .sm-overdue-flag-submit, .sm-overdue-flag-cancel {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .sm-overdue-flag-submit {
      background: rgba(224,96,96,0.2);
      border: 1px solid rgba(224,96,96,0.4);
      color: #e06060;
    }
    .sm-overdue-flag-cancel {
      background: rgba(138,160,184,0.1);
      border: 1px solid rgba(138,160,184,0.2);
      color: var(--muted, #8aa0b8);
    }
    .sm-no-overdue-msg {
      font-size: 12px;
      color: #1a9488;
      padding: 12px 0;
      text-align: center;
    }

    /* Gantt chart */
    .sm-gantt-wrap {
      background: var(--card, #111e32);
      border: 1px solid var(--border2, rgba(255,255,255,0.13));
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
    }
    .sm-gantt-svg { display: block; }
  `;
  document.head.appendChild(style);
}

// ─── Zone 1: Site Status Grid ──────────────────────────────────────────────────

const SM_COLS = [
  { key: 'code',       label: 'Site',         sortable: true },
  { key: 'pi_name',    label: 'PI',           sortable: true },
  { key: 'enrolled',   label: 'Enrolled',     sortable: true },
  { key: 'a1',         label: 'A1 %',         sortable: true },
  { key: 'a2',         label: 'A2 %',         sortable: true },
  { key: 'a3',         label: 'A3 %',         sortable: true },
  { key: 'compliance', label: 'Compliance',   sortable: true },
  { key: 'ltfu',       label: 'LTFU',         sortable: true },
  { key: 'last_act',   label: 'Last Activity',sortable: true },
  { key: 'status',     label: 'Status',       sortable: true },
];

function smPctClass(pct) {
  if (pct >= 75) return 'sm-pct-high';
  if (pct >= 40) return 'sm-pct-mid';
  return 'sm-pct-low';
}

function smSortedFilteredSites() {
  let sites = _smSites.slice();
  const q = _smFilter.trim().toLowerCase();
  if (q) {
    sites = sites.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.pi_name || '').toLowerCase().includes(q)
    );
  }

  const col = _smSort.col;
  const dir = _smSort.dir === 'asc' ? 1 : -1;
  sites.sort((a, b) => {
    let av, bv;
    if (col === 'code')       { av = a.code;            bv = b.code; }
    else if (col === 'pi_name')    { av = a.pi_name;         bv = b.pi_name; }
    else if (col === 'enrolled')   { av = a.enrolled_count;  bv = b.enrolled_count; }
    else if (col === 'a1')         { av = smAssessmentStats(a).a1; bv = smAssessmentStats(b).a1; }
    else if (col === 'a2')         { av = smAssessmentStats(a).a2; bv = smAssessmentStats(b).a2; }
    else if (col === 'a3')         { av = smAssessmentStats(a).a3; bv = smAssessmentStats(b).a3; }
    else if (col === 'compliance') { av = smComplianceRate(a); bv = smComplianceRate(b); }
    else if (col === 'ltfu')       { av = a.ltfu_count;       bv = b.ltfu_count; }
    else if (col === 'last_act')   { av = a.last_activity_ts; bv = b.last_activity_ts; }
    else if (col === 'status')     { av = a.status;           bv = b.status; }
    else                           { av = a.code;             bv = b.code; }
    if (av < bv) return -1 * dir;
    if (av > bv) return  1 * dir;
    return 0;
  });
  return sites;
}

function smRenderGrid(container) {
  container.innerHTML = '';

  // Filter row
  const filterRow = document.createElement('div');
  filterRow.className = 'sm-filter-row';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'sm-search-input';
  searchInput.placeholder = 'Search by site, code, or PI...';
  searchInput.value = _smFilter;
  searchInput.addEventListener('input', (e) => {
    _smFilter = e.target.value;
    smRefreshGrid(container);
  });
  filterRow.appendChild(searchInput);
  container.appendChild(filterRow);

  // Table wrapper
  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';
  container.appendChild(tableWrap);

  const table = document.createElement('table');
  table.className = 'sm-grid-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  SM_COLS.forEach(col => {
    const th = document.createElement('th');
    if (_smSort.col === col.key) th.classList.add('sm-sort-active');
    const arrow = _smSort.col === col.key
      ? `<span class="sm-sort-arrow">${_smSort.dir === 'asc' ? '▲' : '▼'}</span>`
      : '';
    th.innerHTML = col.label + arrow;
    if (col.sortable) {
      th.addEventListener('click', () => {
        if (_smSort.col === col.key) {
          _smSort.dir = _smSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _smSort.col = col.key;
          _smSort.dir = 'asc';
        }
        smRefreshGrid(container);
      });
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const sites = smSortedFilteredSites();

  if (sites.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = SM_COLS.length;
    emptyTd.style.cssText = 'text-align:center; padding:24px; color:var(--muted,#8aa0b8); font-size:12px;';
    emptyTd.textContent = 'No sites match your search.';
    emptyRow.appendChild(emptyTd);
    tbody.appendChild(emptyRow);
  }

  sites.forEach(site => {
    const stats = smAssessmentStats(site);
    const compliance = smComplianceRate(site);
    const enrollPct = site.enrollment_target > 0
      ? Math.min(100, Math.round((site.enrolled_count / site.enrollment_target) * 100))
      : 0;

    const row = document.createElement('tr');
    row.className = 'sm-site-row';
    row.dataset.siteId = site.id;
    if (_smExpandedSiteId === site.id) row.classList.add('sm-row-expanded');

    row.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--bright,#e8f0f8);">${smEsc(site.code)}</div>
        <div style="font-size:10px; color:var(--muted,#8aa0b8); margin-top:1px;">${smEsc(site.name)}</div>
      </td>
      <td>${smEsc(site.pi_name)}</td>
      <td class="sm-enroll-cell">
        <div class="sm-enroll-label">${site.enrolled_count} / ${site.enrollment_target}</div>
        <div class="sm-progress-track">
          <div class="sm-progress-fill" style="width:${enrollPct}%"></div>
        </div>
      </td>
      <td class="sm-pct-cell ${smPctClass(stats.a1)}">${stats.a1}%</td>
      <td class="sm-pct-cell ${smPctClass(stats.a2)}">${stats.a2}%</td>
      <td class="sm-pct-cell ${smPctClass(stats.a3)}">${stats.a3}%</td>
      <td class="sm-pct-cell ${smPctClass(compliance)}">${compliance}%</td>
      <td style="text-align:right;">${site.ltfu_count}</td>
      <td style="font-size:11px; color:var(--muted,#8aa0b8);">${smRelativeTime(site.last_activity_ts)}</td>
      <td><span class="sm-pill sm-pill-${smEsc(site.status)}">${smStatusLabel(site.status)}</span></td>
    `;

    row.addEventListener('click', () => {
      if (_smExpandedSiteId === site.id) {
        _smExpandedSiteId = null;
      } else {
        _smExpandedSiteId = site.id;
      }
      smRefreshGrid(container);
    });

    tbody.appendChild(row);

    // Drawer row
    if (_smExpandedSiteId === site.id) {
      const drawerRow = document.createElement('tr');
      drawerRow.className = 'sm-drawer-row';
      const drawerTd = document.createElement('td');
      drawerTd.colSpan = SM_COLS.length;
      drawerTd.appendChild(smBuildDrawer(site));
      drawerRow.appendChild(drawerTd);
      tbody.appendChild(drawerRow);
    }
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
}

function smRefreshGrid(container) {
  smRenderGrid(container);
}

function smStatusLabel(status) {
  if (status === 'on_track') return 'On Track';
  if (status === 'watch')    return 'Watch';
  if (status === 'alert')    return 'Alert';
  return status;
}

function smEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function smBuildDrawer(site) {
  const drawer = document.createElement('div');
  drawer.className = 'sm-drawer';

  // Coordinator emails
  const coordTitle = document.createElement('div');
  coordTitle.className = 'sm-drawer-section-title';
  coordTitle.textContent = 'Site Coordinators';
  drawer.appendChild(coordTitle);

  const coordWrap = document.createElement('div');
  coordWrap.className = 'sm-drawer-coords';
  if (site.coordinator_emails && site.coordinator_emails.length > 0) {
    site.coordinator_emails.forEach(email => {
      const chip = document.createElement('span');
      chip.className = 'sm-coord-chip';
      chip.textContent = email;
      coordWrap.appendChild(chip);
    });
  } else {
    coordWrap.innerHTML = `<span style="font-size:11px;color:var(--muted,#8aa0b8);">No coordinators on file</span>`;
  }
  drawer.appendChild(coordWrap);

  // Overdue participants
  const overdueTitle = document.createElement('div');
  overdueTitle.className = 'sm-drawer-section-title';
  overdueTitle.style.marginTop = '4px';
  overdueTitle.textContent = 'Overdue Participants';
  drawer.appendChild(overdueTitle);

  const overdueList = smOverdueParticipants(site);
  if (overdueList.length === 0) {
    const noOverdue = document.createElement('div');
    noOverdue.className = 'sm-no-overdue';
    noOverdue.textContent = 'No overdue participants at this site.';
    drawer.appendChild(noOverdue);
  } else {
    const miniTable = document.createElement('table');
    miniTable.className = 'sm-overdue-mini-table';
    miniTable.innerHTML = `
      <thead>
        <tr>
          <th>Participant</th>
          <th>Assessment</th>
          <th>Days Past Window</th>
          ${smCanFlag() && !smSponsorOnly() ? '<th>Action</th>' : ''}
        </tr>
      </thead>
    `;
    const mtbody = document.createElement('tbody');
    overdueList.sort((a, b) => b.daysPast - a.daysPast).forEach(op => {
      const tr = document.createElement('tr');
      const anonPid = op.pid.split('-').slice(-1)[0]; // show only trailing segment
      let flagCell = '';
      if (smCanFlag() && !smSponsorOnly()) {
        flagCell = `<td><button class="sm-flag-btn" data-pid="${smEsc(op.pid)}" data-site="${smEsc(site.id)}" data-assessment="${smEsc(op.assessment)}">Flag Query</button></td>`;
      }
      tr.innerHTML = `
        <td style="font-family:var(--font-mono,monospace); font-size:11px;">${smEsc(anonPid)}</td>
        <td>${smEsc(op.assessment)}</td>
        <td style="color:#e06060; font-weight:600;">${op.daysPast}d</td>
        ${smCanFlag() && !smSponsorOnly() ? '<td></td>' : ''}
      `;
      if (smCanFlag() && !smSponsorOnly()) {
        const flagTd = tr.querySelector('td:last-child');
        const flagBtn = document.createElement('button');
        flagBtn.className = 'sm-flag-btn';
        flagBtn.textContent = 'Flag Query';
        flagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          smOpenFlagForm(flagTd, op.pid, site.id, op.assessment);
        });
        flagTd.appendChild(flagBtn);
      }
      mtbody.appendChild(tr);
    });
    miniTable.appendChild(mtbody);
    drawer.appendChild(miniTable);
  }

  return drawer;
}

function smOpenFlagForm(container, pid, siteId, assessment) {
  // Remove any existing flag form
  const existing = container.querySelector('.sm-flag-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'sm-flag-form';

  const ta = document.createElement('textarea');
  ta.className = 'sm-flag-textarea';
  ta.placeholder = `Describe the concern for ${assessment} overdue at site ${siteId}...`;
  form.appendChild(ta);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'sm-flag-submit';
  submitBtn.textContent = 'Submit Flag';
  submitBtn.addEventListener('click', async () => {
    const msg = ta.value.trim();
    if (!msg) { ta.style.borderColor = 'rgba(224,96,96,0.8)'; return; }
    await smWriteQuery(siteId, pid, assessment, msg);
    form.innerHTML = '<div class="sm-flag-confirm">Query flagged successfully.</div>';
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sm-flag-submit';
  cancelBtn.style.background = 'rgba(138,160,184,0.1)';
  cancelBtn.style.borderColor = 'rgba(138,160,184,0.2)';
  cancelBtn.style.color = 'var(--muted,#8aa0b8)';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => form.remove());

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);
  container.appendChild(form);
}

async function smWriteQuery(siteId, pid, assessment, message) {
  if (_smDemoMode || typeof database === 'undefined' || typeof _workspaceKey === 'undefined') {
    console.log('[SiteMonitor] Demo mode: query not written to Firebase.', { siteId, pid, assessment, message });
    return;
  }
  const queriesRef = database.ref(`workspaces/${_workspaceKey}/queries`);
  const participantCode = String(pid).split('-').slice(-1)[0];
  await queriesRef.push({
    site_id: siteId,
    participant_code: participantCode,
    flagged_by: (typeof _userEmail !== 'undefined' ? _userEmail : 'unknown'),
    flagged_ts: Date.now(),
    message,
    assessment,
    status: 'open',
  });
}

// ─── Zone 2 Left: Enrollment Funnel ───────────────────────────────────────────

function smRenderFunnel(container) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'sm-funnel-wrap';

  // Aggregate counts
  const totalEnrolled = _smSites.reduce((s, site) => s + (site.enrolled_count || 0), 0);
  const totalA1 = _smSites.reduce((s, site) => {
    const parts = Object.values(site.participants || {});
    return s + parts.filter(p => p.assessment_windows?.a1?.completed_ts).length;
  }, 0);
  const totalA2 = _smSites.reduce((s, site) => {
    const parts = Object.values(site.participants || {});
    return s + parts.filter(p => p.assessment_windows?.a2?.completed_ts).length;
  }, 0);
  const totalA3 = _smSites.reduce((s, site) => {
    const parts = Object.values(site.participants || {});
    return s + parts.filter(p => p.assessment_windows?.a3?.completed_ts).length;
  }, 0);

  const stages = [
    { label: 'Enrolled',    count: totalEnrolled, prev: null },
    { label: 'A1 Complete', count: totalA1,       prev: totalEnrolled },
    { label: 'A2 Complete', count: totalA2,       prev: totalA1 },
    { label: 'A3 Complete', count: totalA3,       prev: totalA2 },
  ];

  const svgH = 140;
  const barH = 32;
  const barGap = 10;
  const labelW = 100;
  const countW = 70;
  const pctW = 60;
  const marginT = 20;
  const marginB = 20;

  // We use a 1000-wide viewBox; bar area starts at labelW
  const VW = 1000;
  const barAreaW = VW - labelW - countW - pctW;

  let svgRows = '';
  stages.forEach((stage, i) => {
    const fillRatio = totalEnrolled > 0 ? stage.count / totalEnrolled : 0;
    const barW = Math.round(fillRatio * barAreaW);
    const opacityVal = 1 - (i * 0.18);
    const y = marginT + i * (barH + barGap);
    const convPct = (stage.prev !== null && stage.prev > 0)
      ? Math.round((stage.count / stage.prev) * 100)
      : 100;
    const pctLabel = stage.prev !== null ? `${convPct}%` : '—';

    svgRows += `
      <text x="${labelW - 8}" y="${y + barH / 2 + 5}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="13" fill="#8aa0b8">${stage.label}</text>
      <rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="rgba(26,148,136,${opacityVal.toFixed(2)})"/>
      <text x="${labelW + barAreaW + 8}" y="${y + barH / 2 + 5}" font-family="IBM Plex Mono, monospace" font-size="13" fill="#c8d6e8">${stage.count.toLocaleString()}</text>
      <text x="${labelW + barAreaW + countW + 8}" y="${y + barH / 2 + 5}" font-family="IBM Plex Mono, monospace" font-size="12" fill="${i === 0 ? '#1a9488' : convPct >= 75 ? '#1a9488' : convPct >= 40 ? '#e8b84b' : '#e06060'}">${pctLabel}</text>
    `;
  });

  // Column headers
  const headerY = marginT - 6;
  const headersSVG = `
    <text x="${labelW + barAreaW + 8}" y="${headerY}" font-family="IBM Plex Mono, monospace" font-size="10" fill="#8aa0b8" letter-spacing="1">COUNT</text>
    <text x="${labelW + barAreaW + countW + 8}" y="${headerY}" font-family="IBM Plex Mono, monospace" font-size="10" fill="#8aa0b8" letter-spacing="1">CONV</text>
  `;

  const totalH = marginT + marginB + stages.length * (barH + barGap) - barGap;
  const svg = `<svg class="sm-funnel-svg" viewBox="0 0 ${VW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
    ${headersSVG}
    ${svgRows}
  </svg>`;

  wrap.innerHTML = svg;
  container.appendChild(wrap);
}

// ─── Zone 2 Right: Overdue Alerts ─────────────────────────────────────────────

function smRenderOverdueAlerts(container) {
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'sm-overdue-panel';

  // Collect all overdue across all sites
  let allOverdue = [];
  _smSites.forEach(site => {
    allOverdue = allOverdue.concat(smOverdueParticipants(site));
  });
  allOverdue.sort((a, b) => b.daysPast - a.daysPast);

  if (allOverdue.length === 0) {
    panel.innerHTML = '<div class="sm-no-overdue-msg">No overdue participants across all sites.</div>';
    container.appendChild(panel);
    return;
  }

  allOverdue.forEach(op => {
    const card = document.createElement('div');
    card.className = 'sm-overdue-card';
    card.style.flexDirection = 'column';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.justifyContent = 'space-between';
    topRow.style.alignItems = 'flex-start';
    topRow.style.width = '100%';

    const info = document.createElement('div');
    info.className = 'sm-overdue-card-info';
    const anonPid = op.pid.split('-').slice(-2).join('-');
    info.innerHTML = `
      <div class="sm-overdue-pid">${smEsc(anonPid)}</div>
      <div class="sm-overdue-meta">${smEsc(op.siteCode)} &middot; ${smEsc(op.assessment)} overdue</div>
    `;

    const rightWrap = document.createElement('div');
    rightWrap.className = 'sm-overdue-flag-wrap';

    const daysEl = document.createElement('div');
    daysEl.className = 'sm-overdue-days';
    daysEl.textContent = `${op.daysPast}d`;
    rightWrap.appendChild(daysEl);

    if (smCanFlag() && !smSponsorOnly()) {
      const flagBtn = document.createElement('button');
      flagBtn.className = 'sm-flag-btn';
      flagBtn.style.fontSize = '10px';
      flagBtn.style.padding = '3px 8px';
      flagBtn.textContent = 'Flag';
      flagBtn.addEventListener('click', () => {
        const existingForm = card.querySelector('.sm-overdue-flag-inline');
        if (existingForm) { existingForm.remove(); return; }
        smInlineFlag(card, op.pid, op.siteId, op.assessment);
      });
      rightWrap.appendChild(flagBtn);
    }

    topRow.appendChild(info);
    topRow.appendChild(rightWrap);
    card.appendChild(topRow);
    panel.appendChild(card);
  });

  container.appendChild(panel);
}

function smInlineFlag(card, pid, siteId, assessment) {
  const formWrap = document.createElement('div');
  formWrap.className = 'sm-overdue-flag-inline';

  const ta = document.createElement('textarea');
  ta.className = 'sm-overdue-flag-ta';
  ta.placeholder = `Describe the concern for ${assessment} overdue...`;
  formWrap.appendChild(ta);

  const btnRow = document.createElement('div');
  btnRow.className = 'sm-overdue-flag-row';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'sm-overdue-flag-submit';
  submitBtn.textContent = 'Submit';
  submitBtn.addEventListener('click', async () => {
    const msg = ta.value.trim();
    if (!msg) { ta.style.borderColor = 'rgba(224,96,96,0.8)'; return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    await smWriteQuery(siteId, pid, assessment, msg);
    formWrap.innerHTML = '<div style="font-size:11px; color:#1a9488; padding:4px 0;">Query flagged successfully.</div>';
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sm-overdue-flag-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => formWrap.remove());

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  formWrap.appendChild(btnRow);
  card.appendChild(formWrap);
}

// ─── Zone 3: Protocol Timeline / Gantt ────────────────────────────────────────

function smRenderGantt(container) {
  container.innerHTML = '';

  if (_smSites.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--muted,#8aa0b8); padding:16px;">No site data to display.</div>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'sm-gantt-wrap';

  // Derive study window: 24 months from earliest known activity
  const now = Date.now();
  const day = 86400000;
  const month = 30 * day;

  const earliestActivity = _smSites.reduce((min, s) => Math.min(min, s.last_activity_ts || now), now);
  // Study start approximated as earliest activity minus 14 months (mid-trial estimate)
  const studyStart = earliestActivity - (14 * month);
  const studyEnd   = studyStart + (24 * month);
  const studySpan  = studyEnd - studyStart;

  const rowH     = 32;
  const rowGap   = 4;
  const labelW   = 130;
  const axisH    = 28;
  const marginT  = 32; // space for axis at top
  const marginB  = 10;
  const chartW   = 860;
  const barAreaW = chartW - labelW;

  const numSites = _smSites.length;
  const totalH   = marginT + numSites * (rowH + rowGap) + axisH + marginB;
  const VW       = chartW;

  // Generate month tick marks (every 3 months)
  let axisTicks = '';
  const numMonths = 24;
  for (let m = 0; m <= numMonths; m += 3) {
    const x = labelW + Math.round((m / numMonths) * barAreaW);
    const ts = studyStart + (m * month);
    const d = new Date(ts);
    const mo = d.toLocaleString('default', { month: 'short' });
    const yr = d.getFullYear().toString().slice(2);
    axisTicks += `
      <line x1="${x}" y1="${marginT - 4}" x2="${x}" y2="${marginT + numSites * (rowH + rowGap)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="${x}" y="${marginT - 8}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#8aa0b8">${mo} '${yr}</text>
    `;
  }

  // Today line
  const todayX = labelW + Math.round(((now - studyStart) / studySpan) * barAreaW);
  const todayLine = (now >= studyStart && now <= studyEnd)
    ? `<line x1="${todayX}" y1="${marginT - 4}" x2="${todayX}" y2="${marginT + numSites * (rowH + rowGap)}" stroke="rgba(232,184,75,0.7)" stroke-width="1.5" stroke-dasharray="4,3"/>
       <text x="${todayX}" y="${marginT - 10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#e8b84b">TODAY</text>`
    : '';

  // Rows
  let rowsSVG = '';
  _smSites.forEach((site, idx) => {
    const y = marginT + idx * (rowH + rowGap);
    const cy = y + rowH / 2;

    // Label color by status
    const labelColor = site.status === 'alert' ? '#e06060'
      : site.status === 'watch'    ? '#e8b84b'
      : '#c8d6e8';

    // Enrollment bar: approx enrollment period = first 3 months
    const enrollStart = studyStart;
    const enrollEnd   = studyStart + (3 * month);
    const enrollX = labelW + Math.round(((enrollStart - studyStart) / studySpan) * barAreaW);
    const enrollW = Math.round(((enrollEnd - enrollStart) / studySpan) * barAreaW);

    // Assessment windows at months 0, 6, 12 from enrollment; each 1.5 months wide
    const aWindows = [
      { label: 'A1', start: 0,  color: 'rgba(26,148,136,0.35)', stroke: '#1a9488' },
      { label: 'A2', start: 6,  color: 'rgba(26,148,136,0.25)', stroke: '#1a9488' },
      { label: 'A3', start: 12, color: 'rgba(26,148,136,0.15)', stroke: '#1a9488' },
    ];

    let windowBars = '';
    aWindows.forEach(aw => {
      const awStart = studyStart + (aw.start * month);
      const awEnd   = awStart + (1.5 * month);
      const awX = labelW + Math.round(((awStart - studyStart) / studySpan) * barAreaW);
      const awW = Math.max(2, Math.round(((awEnd - awStart) / studySpan) * barAreaW));
      const awY = y + 6;
      const awH = rowH - 12;
      windowBars += `
        <rect x="${awX}" y="${awY}" width="${awW}" height="${awH}" rx="2"
          fill="${aw.color}" stroke="${aw.stroke}" stroke-width="1" opacity="0.85"/>
        <text x="${awX + awW / 2}" y="${awY + awH / 2 + 4}" text-anchor="middle"
          font-family="IBM Plex Mono, monospace" font-size="8" fill="#1a9488">${aw.label}</text>
      `;
    });

    // Row background
    const rowBg = idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';

    rowsSVG += `
      <rect x="0" y="${y}" width="${VW}" height="${rowH}" fill="${rowBg}"/>
      <text x="${labelW - 8}" y="${cy + 4}" text-anchor="end"
        font-family="IBM Plex Mono, monospace" font-size="11" fill="${labelColor}">${smEsc(site.code)}</text>
      <rect x="${enrollX}" y="${y + 4}" width="${enrollW}" height="${rowH - 8}" rx="3"
        fill="rgba(26,148,136,0.55)"/>
      <text x="${enrollX + enrollW / 2}" y="${cy + 4}" text-anchor="middle"
        font-family="IBM Plex Mono, monospace" font-size="8" fill="#e8f0f8">ENR</text>
      ${windowBars}
    `;
  });

  // X-axis label
  const axisLabelY = marginT + numSites * (rowH + rowGap) + 18;
  const axisLabel = `<text x="${labelW + barAreaW / 2}" y="${axisLabelY}" text-anchor="middle"
    font-family="IBM Plex Mono, monospace" font-size="10" fill="#8aa0b8" letter-spacing="1">STUDY TIMELINE (24 MONTHS)</text>`;

  // Legend
  const legendY = marginT - 20;
  const legend = `
    <rect x="${labelW}" y="${legendY}" width="12" height="8" rx="1" fill="rgba(26,148,136,0.55)"/>
    <text x="${labelW + 16}" y="${legendY + 8}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#8aa0b8">Enrollment</text>
    <rect x="${labelW + 90}" y="${legendY}" width="12" height="8" rx="1" fill="rgba(26,148,136,0.3)" stroke="#1a9488" stroke-width="1"/>
    <text x="${labelW + 106}" y="${legendY + 8}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#8aa0b8">Assessment Windows</text>
    <line x1="${labelW + 240}" y1="${legendY}" x2="${labelW + 240}" y2="${legendY + 8}" stroke="rgba(232,184,75,0.7)" stroke-width="1.5" stroke-dasharray="3,2"/>
    <text x="${labelW + 246}" y="${legendY + 8}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#e8b84b">Today</text>
  `;

  const svgContent = `<svg class="sm-gantt-svg" viewBox="0 0 ${VW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="min-width:${Math.min(VW, 600)}px;">
    ${legend}
    ${axisTicks}
    ${todayLine}
    ${rowsSVG}
    ${axisLabel}
  </svg>`;

  wrap.innerHTML = svgContent;
  container.appendChild(wrap);
}

// ─── Full panel render ─────────────────────────────────────────────────────────

function smRenderAll() {
  const gridContainer    = document.getElementById('sm-grid-container');
  const funnelContainer  = document.getElementById('sm-funnel-container');
  const overdueContainer = document.getElementById('sm-overdue-container');
  const ganttContainer   = document.getElementById('sm-gantt-container');

  // Demo banner — attach to panel root if not present
  const panel = document.getElementById('inst-tab-panel-sitemonitor');
  if (panel) {
    let banner = document.getElementById('sm-demo-banner');
    if (_smDemoMode) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sm-demo-banner';
        banner.className = 'sm-demo-banner';
        banner.textContent = 'Demo data — no live site records found for this workspace. All data shown is illustrative.';
        panel.insertBefore(banner, panel.firstChild);
      }
    } else {
      if (banner) banner.remove();
    }
  }

  if (gridContainer)    smRenderGrid(gridContainer);
  if (funnelContainer)  smRenderFunnel(funnelContainer);
  if (overdueContainer) smRenderOverdueAlerts(overdueContainer);
  if (ganttContainer)   smRenderGantt(ganttContainer);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the Site Monitor tab.
 * Call when the tab becomes active (e.g. inside switchInstDashTab('sitemonitor')).
 */
function smInit() {
  smInjectStyles();

  // Reset volatile state on each init
  _smFilter = '';
  _smExpandedSiteId = null;
  _smSort = { col: 'code', dir: 'asc' };

  smAttachListener((sites) => {
    _smSites = sites;
    smRenderAll();
  });
}

/**
 * Tear down the Site Monitor tab.
 * Call when leaving the tab (e.g. inside switchInstDashTab before switching away).
 */
function smDestroy() {
  smDetachListener();
  _smSites = [];
  _smDemoMode = false;
  _smExpandedSiteId = null;

  // Remove demo banner if present
  const banner = document.getElementById('sm-demo-banner');
  if (banner) banner.remove();
}

// ─── Attach to global scope for tab switching hooks ───────────────────────────
window.smInit    = smInit;
window.smDestroy = smDestroy;
