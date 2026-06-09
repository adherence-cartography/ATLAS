// sa-audit.js — 21 CFR Part 11 Audit Log: _AL state, load from Firebase, filters, table render, JSON drawer, pagination

// ══════════════════════════════════════════════════════════════════════════════
// 21 CFR PART 11 — AUDIT LOG VIEWER
// Immutable, append-only audit trail browser for superadmin.
// ══════════════════════════════════════════════════════════════════════════════

// ── Audit Log state ────────────────────────────────────────────────────────────
let _AL = {
  raw:      [],
  filtered: [],
  page:     0,
  pageSize: 50,
  loading:  false,
  filters: { action:'', table:'', search:'', dateFrom:'', dateTo:'' },
};

// CSS injected once (idempotent)
function _alInjectStyles() {
  if (document.getElementById('al-styles')) return;
  const s = document.createElement('style');
  s.id = 'al-styles';
  s.textContent = `
    .al-table{width:100%;border-collapse:collapse;font-size:0.83rem;}
    .al-table th{padding:8px 10px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim);font-weight:400;border-bottom:1px solid var(--mc-border-b);text-align:left;white-space:nowrap;}
    .al-table td{padding:7px 10px;border-bottom:1px solid var(--mc-border);color:var(--mc-text);vertical-align:middle;word-break:break-all;}
    .al-table tr.al-row:hover td{background:rgba(212,168,67,0.04);cursor:pointer;}
    .al-table tr.al-drawer-row td{background:rgba(10,18,38,0.9);border-top:1px solid var(--mc-border);}
    .al-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid;font-weight:500;white-space:nowrap;}
    .al-badge-CREATE{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .al-badge-UPDATE{color:#d4a843;border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.07);}
    .al-badge-DELETE{color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.07);}
    .al-badge-ESIGN{color:#4e9cf5;border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.07);}
    .al-badge-LOGIN_FAILURE{color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.10);}
    .al-badge-SESSION_TIMEOUT{color:#d4a843;border-color:rgba(212,168,67,0.35);background:rgba(212,168,67,0.10);}
    .al-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
    .al-select{background:var(--mc-bg2);border:1px solid var(--mc-border);color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:6px 10px;border-radius:6px;outline:none;}
    .al-select:focus{border-color:rgba(212,168,67,0.4);}
    .al-search{flex:1;min-width:180px;background:var(--mc-bg2);border:1px solid var(--mc-border);color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.83rem;padding:7px 12px;border-radius:6px;outline:none;}
    .al-search:focus{border-color:rgba(212,168,67,0.4);}
    .al-date-input{background:var(--mc-bg2);border:1px solid var(--mc-border);color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:6px 10px;border-radius:6px;outline:none;width:140px;}
    .al-date-input:focus{border-color:rgba(212,168,67,0.4);}
    .al-reload-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:6px 14px;border-radius:5px;border:1px solid var(--mc-border);background:transparent;color:var(--mc-dim);cursor:pointer;transition:all 0.12s;white-space:nowrap;}
    .al-reload-btn:hover{background:var(--mc-amber-faint);border-color:var(--mc-amber);color:var(--mc-amber);}
    .al-page-btn{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;padding:5px 12px;border-radius:5px;border:1px solid var(--mc-border);background:transparent;color:var(--mc-dim);cursor:pointer;}
    .al-page-btn:hover:not(:disabled){background:var(--mc-navy);color:var(--mc-text);}
    .al-page-btn:disabled{opacity:0.28;cursor:default;}
    .al-drawer-toggle{background:none;border:none;cursor:pointer;color:var(--mc-dim);font-size:0.80rem;padding:2px 6px;border-radius:3px;transition:color 0.12s;}
    .al-drawer-toggle:hover{color:var(--mc-amber);}
  `;
  document.head.appendChild(s);
}

// ── Entry point ────────────────────────────────────────────────────────────────
function _saRenderAuditLog(container) {
  _alInjectStyles();
  _AL.page = 0;
  _AL.filters = { action:'', table:'', search:'', dateFrom:'', dateTo:'' };

  container.innerHTML = `
    <div style="margin-bottom:18px;">
      <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · 21 CFR Part 11</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.55rem;font-weight:300;color:${_C.text};">Audit Log</div>
    </div>

    <!-- CFR-11 compliance badge -->
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.28);border-radius:20px;padding:5px 14px;margin-bottom:20px;">
      <span style="width:7px;height:7px;border-radius:50%;background:#2ec98a;display:inline-block;"></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:#2ec98a;">21 CFR Part 11 &middot; Immutable Audit Trail &middot; Append-Only</span>
    </div>

    <!-- Filter toolbar -->
    <div class="al-toolbar">
      <input type="date" class="al-date-input" id="al-date-from" title="From date" placeholder="From"
        onchange="_AL.filters.dateFrom=this.value;_alApplyFilter()"/>
      <input type="date" class="al-date-input" id="al-date-to" title="To date" placeholder="To"
        onchange="_AL.filters.dateTo=this.value;_alApplyFilter()"/>
      <select class="al-select" id="al-filter-action" onchange="_AL.filters.action=this.value;_alApplyFilter()">
        <option value="">All Actions</option>
        <option value="CREATE">CREATE</option>
        <option value="UPDATE">UPDATE</option>
        <option value="DELETE">DELETE</option>
        <option value="ESIGN">ESIGN</option>
        <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
        <option value="SESSION_TIMEOUT">SESSION_TIMEOUT</option>
      </select>
      <select class="al-select" id="al-filter-table" onchange="_AL.filters.table=this.value;_alApplyFilter()">
        <option value="">All Tables</option>
        <option value="assessments">assessments</option>
        <option value="peacs_assessments">peacs_assessments</option>
        <option value="mapData">mapData</option>
        <option value="auth">auth</option>
        <option value="session">session</option>
      </select>
      <input class="al-search" id="al-search" placeholder="Search actor, record ID…"
        oninput="_AL.filters.search=this.value;_alApplyFilter()"/>
      <button class="al-reload-btn" onclick="_alLoad()">↻ Reload</button>
    </div>

    <!-- Summary stats -->
    <div id="al-stats" style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_C.muted};margin-bottom:12px;">Loading…</div>

    <!-- Table area -->
    <div id="al-table-wrap"></div>

    <!-- Pagination -->
    <div id="al-pagination" style="display:flex;align-items:center;gap:10px;margin-top:14px;font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_C.dim};"></div>
  `;

  _alLoad();
}

// ── Load from Firebase ─────────────────────────────────────────────────────────
async function _alLoad() {
  _AL.loading = true;
  const statsEl = document.getElementById('al-stats');
  const tableEl = document.getElementById('al-table-wrap');
  if (statsEl) statsEl.textContent = 'Loading…';
  if (tableEl) tableEl.innerHTML = `<div style="padding:32px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_C.dim};">Loading audit entries…</div>`;

  try {
    const db = (typeof database !== 'undefined') ? database : null;
    if (!db) { if (statsEl) statsEl.textContent = 'Firebase not available.'; return; }

    let entries = [];
    try {
      const snap = await db.ref('audit_log').orderByChild('cfr11').equalTo(true).once('value');
      const val = snap.val();
      if (val) {
        entries = Object.entries(val).map(([k, v]) => ({ _key: k, ...v })).filter(e => e.cfr11 === true);
      }
    } catch(qErr) {
      // Fallback: read all audit_log entries and filter cfr11===true
      const snap2 = await db.ref('audit_log').once('value');
      const val2 = snap2.val();
      if (val2) {
        entries = Object.entries(val2)
          .map(([k, v]) => ({ _key: k, ...v }))
          .filter(e => e.cfr11 === true);
      }
    }

    _AL.raw = entries;
    _alApplyFilter();
  } catch(e) {
    if (tableEl) tableEl.innerHTML = `<div style="color:${_C.red};padding:20px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;">⚠ Error loading audit log: ${_saEsc(e.message)}</div>`;
  } finally {
    _AL.loading = false;
  }
}

// ── Apply filters and sort ─────────────────────────────────────────────────────
function _alApplyFilter() {
  const { action, table, search, dateFrom, dateTo } = _AL.filters;
  let result = _AL.raw.slice();

  if (action)   result = result.filter(e => e.action === action);
  if (table)    result = result.filter(e => e.table === table);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(e =>
      (e.actor_email || '').toLowerCase().includes(q) ||
      (e.record_id   || '').toLowerCase().includes(q) ||
      (e.actor_uid   || '').toLowerCase().includes(q) ||
      (e.workspace   || '').toLowerCase().includes(q)
    );
  }
  if (dateFrom) {
    const from = new Date(dateFrom).getTime();
    result = result.filter(e => new Date(e.timestamp_utc || 0).getTime() >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo).getTime() + 86399999; // end of day
    result = result.filter(e => new Date(e.timestamp_utc || 0).getTime() <= to);
  }

  // Sort newest first
  result.sort((a, b) => new Date(b.timestamp_utc || 0) - new Date(a.timestamp_utc || 0));

  _AL.filtered = result;
  _AL.page = 0;

  const statsEl = document.getElementById('al-stats');
  if (statsEl) {
    statsEl.textContent = `Total entries: ${_AL.raw.length.toLocaleString()} · Filtered: ${_AL.filtered.length.toLocaleString()}`;
  }

  _alRenderTable();
}

// ── Render paginated table ─────────────────────────────────────────────────────
function _alRenderTable() {
  const wrap = document.getElementById('al-table-wrap');
  const pagEl = document.getElementById('al-pagination');
  if (!wrap) return;

  const { page, pageSize, filtered } = _AL;
  const start  = page * pageSize;
  const end    = Math.min(start + pageSize, filtered.length);
  const rows   = filtered.slice(start, end);
  const pages  = Math.ceil(filtered.length / pageSize) || 1;

  if (filtered.length === 0) {
    wrap.innerHTML = `<div style="padding:32px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_C.dim};">No audit entries match the current filters.</div>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  const badgeClass = a => {
    const map = { CREATE:'CREATE', UPDATE:'UPDATE', DELETE:'DELETE', ESIGN:'ESIGN', LOGIN_FAILURE:'LOGIN_FAILURE', SESSION_TIMEOUT:'SESSION_TIMEOUT' };
    return 'al-badge al-badge-' + (map[a] || 'UPDATE');
  };

  const rowsHTML = rows.map((e, i) => {
    const absIdx = start + i;
    const ts     = e.timestamp_utc ? new Date(e.timestamp_utc).toLocaleString('en-GB', { timeZone:'UTC', hour12:false }) : '—';
    const hash   = e.payload_hash ? e.payload_hash.substring(0, 12) : '—';
    const actor  = _saEsc(e.actor_email || e.actor_uid || '—');
    const ws     = _saEsc(e.workspace || '—');
    const tbl    = _saEsc(e.table || '—');
    const rid    = _saEsc(e.record_id || '—');
    const drawerIdVal = 'al-drawer-' + absIdx;
    return `
      <tr class="al-row" onclick="_alToggleDrawer('${drawerIdVal}')">
        <td style="font-size:0.74rem;white-space:nowrap;">${_saEsc(ts)} UTC</td>
        <td><span class="${badgeClass(e.action)}">${_saEsc(e.action || '—')}</span></td>
        <td style="font-size:0.78rem;">${tbl}</td>
        <td style="font-size:0.78rem;">${actor}</td>
        <td style="font-size:0.78rem;">${ws}</td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:${_C.dim};">${hash}</td>
        <td><button class="al-drawer-toggle" onclick="event.stopPropagation();_alToggleDrawer('${drawerIdVal}')">▼</button></td>
      </tr>
      <tr id="${drawerIdVal}" class="al-drawer-row" style="display:none;">
        <td colspan="7" style="padding:14px 18px;">
          <pre style="margin:0;font-family:'IBM Plex Mono',monospace;font-size:0.74rem;color:${_C.muted};white-space:pre-wrap;word-break:break-all;background:rgba(0,0,0,0.25);border-radius:6px;padding:10px 14px;">${_saEsc(JSON.stringify(e, null, 2))}</pre>
        </td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="al-table">
        <thead>
          <tr>
            <th>Timestamp (UTC)</th>
            <th>Action</th>
            <th>Table</th>
            <th>Actor</th>
            <th>Workspace</th>
            <th>Hash (12)</th>
            <th style="width:32px;"></th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  `;

  // Pagination controls
  if (pagEl) {
    pagEl.innerHTML = `
      <button class="al-page-btn" onclick="_alPage(-1)" ${page === 0 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${page + 1} / ${pages}</span>
      <button class="al-page-btn" onclick="_alPage(1)" ${page >= pages - 1 ? 'disabled' : ''}>Next →</button>
      <span style="margin-left:8px;">Showing ${start + 1}–${end} of ${filtered.length.toLocaleString()}</span>
    `;
  }
}

// ── Toggle JSON drawer for a row ───────────────────────────────────────────────
function _alToggleDrawer(id) {
  const row = document.getElementById(id);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : 'table-row';
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function _alPage(dir) {
  const pages = Math.ceil(_AL.filtered.length / _AL.pageSize) || 1;
  _AL.page = Math.max(0, Math.min(_AL.page + dir, pages - 1));
  _alRenderTable();
  // Scroll table into view
  const wrap = document.getElementById('al-table-wrap');
  if (wrap) wrap.scrollIntoView({ behavior:'smooth', block:'start' });
}

