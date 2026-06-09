// sa-records.js — Data Ledger: _RL state, styles, record browser, proxy upload, filter/render, table, row interactions, pagination, delete flow



// ══════════════════════════════════════════════════════════════════════════════
// DATA LEDGER — Superadmin record browser · select · delete
// Firebase paths: assessments (MMAS-8) · mapData (MAP) · peacs_assessments (PEACS)
// ══════════════════════════════════════════════════════════════════════════════

const _RL = {                    // module-level state, prefixed _RL to avoid collision
  raw:          [],              // { _key, _type, ...fields }  — full merged dataset
  filtered:     [],              // after search/filter applied
  selected:     new Set(),       // Firebase keys selected for deletion
  loading:      false,
  filter:       { type:'all', query:'', dateFrom:'', dateTo:'' },
  expandedKey:  null,            // key of expanded row (detail drawer)
  page:         0,
  pageSize:     50,
  mapKeyIndex:  {},              // assessmentKey → mapData/peacs_mapData Firebase key
};

// CSS injected once (idempotent)
function _rlInjectStyles() {
  if (document.getElementById('rl-styles')) return;
  const s = document.createElement('style');
  s.id = 'rl-styles';
  s.textContent = `
    .rl-table{width:100%;border-collapse:collapse;font-size:0.83rem;}
    .rl-table th{padding:8px 10px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim);font-weight:400;border-bottom:1px solid var(--mc-border-b);text-align:left;white-space:nowrap;}
    .rl-table td{padding:7px 10px;border-bottom:1px solid var(--mc-border);color:var(--mc-text);vertical-align:middle;white-space:nowrap;}
    .rl-table tr.rl-row:hover td{background:rgba(212,168,67,0.04);cursor:pointer;}
    .rl-table tr.rl-row.rl-checked td{background:rgba(239,68,68,0.06);}
    .rl-table tr.rl-expanded-row td{background:rgba(212,168,67,0.05);}
    .rl-cb{width:15px;height:15px;cursor:pointer;accent-color:#ef4444;}
    .rl-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid;font-weight:500;}
    .rl-badge-mmas{color:#4e9cf5;border-color:rgba(78,156,245,0.35);background:rgba(78,156,245,0.07);}
    .rl-badge-map {color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .rl-badge-peacs{color:#8b6ff5;border-color:rgba(139,111,245,0.35);background:rgba(139,111,245,0.07);}
    .rl-expand-drawer{background:var(--mc-bg2);border-top:1px solid var(--mc-border);}
    .rl-expand-drawer td{padding:14px 16px;}
    .rl-field-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 20px;}
    .rl-field{display:flex;flex-direction:column;gap:2px;}
    .rl-field-lbl{font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim);}
    .rl-field-val{font-size:0.82rem;color:var(--mc-text);word-break:break-word;overflow-wrap:anywhere;}
    .rl-field-wide{grid-column:1/-1;}
    .rl-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
    .rl-search{flex:1;min-width:180px;background:var(--mc-bg2);border:1px solid var(--mc-border);color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.83rem;padding:7px 12px;border-radius:6px;outline:none;}
    .rl-search:focus{border-color:rgba(212,168,67,0.4);}
    .rl-filter-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid var(--mc-border);background:transparent;color:var(--mc-dim);cursor:pointer;transition:all 0.12s;}
    .rl-filter-btn.rl-active{background:var(--mc-amber-faint);border-color:var(--mc-amber);color:var(--mc-amber);}
    .rl-filter-btn:hover:not(.rl-active){background:var(--mc-navy);color:var(--mc-text);}
    .rl-del-btn{font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.10em;text-transform:uppercase;padding:7px 18px;border-radius:6px;border:1px solid rgba(239,68,68,0.45);background:rgba(239,68,68,0.08);color:#ef4444;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
    .rl-del-btn:hover:not(:disabled){background:rgba(239,68,68,0.18);border-color:rgba(239,68,68,0.7);}
    .rl-del-btn:disabled{opacity:0.32;cursor:default;}
    .rl-date-input{background:var(--mc-bg2);border:1px solid var(--mc-border);color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:6px 10px;border-radius:6px;outline:none;width:140px;}
    .rl-date-input:focus{border-color:rgba(212,168,67,0.4);}
    .rl-page-btn{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;padding:5px 12px;border-radius:5px;border:1px solid var(--mc-border);background:transparent;color:var(--mc-dim);cursor:pointer;}
    .rl-page-btn:hover:not(:disabled){background:var(--mc-navy);color:var(--mc-text);}
    .rl-page-btn:disabled{opacity:0.28;cursor:default;}
    @keyframes rl-spin{to{transform:rotate(360deg)}}
    /* Trajectory chart */
    .rl-traj{margin-bottom:14px;background:var(--mc-bg);border:1px solid var(--mc-border);border-radius:8px;padding:12px 14px;}
    .rl-traj-hdr{font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
    .rl-traj-svg{width:100%;height:64px;overflow:visible;}
    .rl-traj-dot{cursor:pointer;transition:r 0.1s;}
    .rl-traj-dot:hover{r:5;}
    .rl-traj-tip{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;fill:var(--mc-text);}
    /* Intervention log */
    .rl-intv{margin-bottom:14px;background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.18);border-radius:8px;padding:12px 14px;}
    .rl-intv-hdr{font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(78,156,245,0.7);margin-bottom:8px;}
    .rl-intv-entry{display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;}
    .rl-intv-textarea{flex:1;background:var(--mc-bg);border:1px solid rgba(78,156,245,0.2);border-radius:5px;color:var(--mc-text);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;padding:6px 10px;resize:none;outline:none;min-height:38px;}
    .rl-intv-textarea:focus{border-color:rgba(78,156,245,0.5);}
    .rl-intv-save{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;padding:6px 14px;border-radius:5px;border:1px solid rgba(78,156,245,0.4);background:rgba(78,156,245,0.08);color:rgba(78,156,245,0.9);cursor:pointer;white-space:nowrap;}
    .rl-intv-save:hover{background:rgba(78,156,245,0.15);}
    .rl-intv-log-item{font-family:'IBM Plex Mono',monospace;font-size:0.74rem;color:var(--mc-dim);padding:4px 0;border-bottom:1px solid rgba(78,156,245,0.08);}
    .rl-intv-log-item:last-child{border-bottom:none;}
    .rl-intv-ts{color:rgba(78,156,245,0.55);margin-right:8px;}
  `;
  document.head.appendChild(s);
}

// ── Entry point ────────────────────────────────────────────────────────────────
let _rlSubTab = 'browser'; // 'browser' | 'proxy'

function _saRenderRecords(container) {
  _rlInjectStyles();
  _RL.selected.clear();
  _RL.page = 0;
  _RL.expandedKey = null;
  _rlRenderShell(container);
}

function _rlRenderShell(container) {
  container.innerHTML = `
    <div style="margin-bottom:18px;">
      <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · Data Ledger</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.55rem;font-weight:300;color:${_C.text};">Data Governance</div>
    </div>
    <!-- Sub-tab bar -->
    <div style="display:flex;gap:6px;margin-bottom:22px;border-bottom:1px solid ${_C.border};padding-bottom:0;">
      <button id="rl-tab-browser" onclick="_rlSwitchTab('browser')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 18px;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;transition:all 0.15s;color:${_rlSubTab==='browser'?_C.amber:_C.dim};border-bottom-color:${_rlSubTab==='browser'?_C.amber:'transparent'};">
        ◫ Record Browser
      </button>
      <button id="rl-tab-proxy" onclick="_rlSwitchTab('proxy')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;padding:8px 18px;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;transition:all 0.15s;color:${_rlSubTab==='proxy'?_C.amber:_C.dim};border-bottom-color:${_rlSubTab==='proxy'?_C.amber:'transparent'};">
        ↑ Proxy Upload
      </button>
    </div>
    <div id="rl-subtab-body"></div>
  `;
  _rlSwitchTab(_rlSubTab, true /* skipRender already in DOM */);
}

function _rlSwitchTab(tab, skipShellRebuild) {
  _rlSubTab = tab;
  // Update tab button styles in-place if shell already rendered
  ['browser','proxy'].forEach(t => {
    const btn = document.getElementById('rl-tab-' + t);
    if (btn) {
      btn.style.color = t === tab ? _C.amber : _C.dim;
      btn.style.borderBottomColor = t === tab ? _C.amber : 'transparent';
    }
  });
  const body = document.getElementById('rl-subtab-body');
  if (!body) return;
  if (tab === 'browser') _rlRenderBrowser(body);
  else                   _rlRenderProxy(body);
}

function _rlRenderBrowser(container) {
  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.15rem;font-weight:300;color:${_C.text};margin-bottom:4px;">Patient Record Manager</div>
      <div style="font-size:0.83rem;color:${_C.muted};margin-top:4px;line-height:1.6;">
        Browse, search, and permanently delete individual patient submissions across all instruments.
        Checkbox one or many records — a single confirmation deletes the batch from Firebase.
      </div>
    </div>

    <!-- Toolbar -->
    <div class="rl-toolbar">
      <!-- Instrument filter pills -->
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="rl-filter-btn rl-active" id="rl-f-all"   onclick="_rlSetType('all')">All</button>
        <button class="rl-filter-btn"            id="rl-f-mmas"  onclick="_rlSetType('mmas')">MMAS-8</button>
        <button class="rl-filter-btn"            id="rl-f-map"   onclick="_rlSetType('map')">MAP</button>
        <button class="rl-filter-btn"            id="rl-f-peacs" onclick="_rlSetType('peacs')">PEACS</button>
      </div>

      <!-- Search -->
      <input class="rl-search" id="rl-search" placeholder="Search workspace key, patient #, country, session ID…"
        oninput="_rlOnSearch(this.value)"/>

      <!-- Date range -->
      <input type="date" class="rl-date-input" id="rl-date-from" title="From date"
        onchange="_rlApplyFilter()" style="color-scheme:dark;">
      <span style="color:${_C.dim};font-size:0.80rem;">→</span>
      <input type="date" class="rl-date-input" id="rl-date-to" title="To date"
        onchange="_rlApplyFilter()" style="color-scheme:dark;">

      <!-- Reload -->
      <button onclick="_rlLoad()" title="Reload from Firebase"
        style="background:transparent;border:1px solid ${_C.border};color:${_C.dim};border-radius:6px;padding:6px 11px;cursor:pointer;font-size:0.90rem;"
        onmouseover="this.style.color='${_C.text}'" onmouseout="this.style.color='${_C.dim}'">↻</button>

      <!-- Delete button — spacer pushes it right -->
      <div style="flex:1;"></div>
      <span id="rl-sel-count" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_C.dim};white-space:nowrap;"></span>
      <button class="rl-del-btn" id="rl-del-btn" disabled onclick="_rlConfirmDelete()">⊘ Delete Selected</button>
    </div>

    <!-- Loading state -->
    <div id="rl-loading" style="display:flex;align-items:center;gap:12px;padding:32px 0;color:${_C.muted};font-size:0.86rem;">
      <div style="width:18px;height:18px;border:2px solid ${_C.amber};border-top-color:transparent;border-radius:50%;animation:rl-spin 0.7s linear infinite;"></div>
      Loading records from Firebase…
    </div>

    <!-- Table container -->
    <div id="rl-table-wrap" style="display:none;">
      <!-- Summary bar -->
      <div id="rl-summary" style="display:flex;align-items:center;gap:16px;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;font-size:0.77rem;color:${_C.dim};"></div>

      <!-- Select-all bar (shows when any result exists) -->
      <div id="rl-selall-bar" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${_C.navy};border:1px solid ${_C.border};border-radius:7px 7px 0 0;border-bottom:none;">
        <input type="checkbox" id="rl-selall-cb" class="rl-cb" onchange="_rlToggleAll(this.checked)" title="Select all visible">
        <label for="rl-selall-cb" style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};cursor:pointer;user-select:none;">
          Select all on this page
        </label>
      </div>

      <div style="overflow-x:auto;border:1px solid ${_C.border};border-radius:0 0 8px 8px;">
        <table class="rl-table">
          <thead>
            <tr>
              <th style="width:36px;"></th>
              <th>Instrument</th>
              <th>Date · Time</th>
              <th>Score</th>
              <th>Country</th>
              <th>Workspace</th>
              <th>Patient #</th>
              <th>Session ID</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody id="rl-tbody"></tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;">
        <div id="rl-page-info" style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_C.dim};"></div>
        <div style="display:flex;gap:8px;">
          <button class="rl-page-btn" id="rl-prev-btn" onclick="_rlPage(-1)" disabled>← Prev</button>
          <button class="rl-page-btn" id="rl-next-btn" onclick="_rlPage(1)">Next →</button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div id="rl-empty" style="display:none;padding:48px 0;text-align:center;color:${_C.dim};font-size:0.86rem;">
      No records match the current filter.
    </div>

    <!-- Delete confirmation modal -->
    <div id="rl-confirm-modal" style="display:none;position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.88);align-items:center;justify-content:center;padding:24px;">
      <div style="background:#070e1d;border:1px solid rgba(239,68,68,0.4);border-top:3px solid #ef4444;border-radius:10px;max-width:440px;width:100%;padding:28px 28px 22px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(239,68,68,0.7);margin-bottom:8px;">Superadmin · Irreversible Action</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;color:#e8f0f8;margin-bottom:10px;">Confirm Permanent Delete</div>
        <p id="rl-modal-msg" style="font-size:0.86rem;color:rgba(138,160,184,0.9);line-height:1.7;margin-bottom:18px;"></p>
        <p style="font-size:0.82rem;color:rgba(239,68,68,0.8);margin-bottom:10px;">Type <strong style="color:#ef4444;">DELETE</strong> to confirm:</p>
        <input id="rl-confirm-input" type="text" autocomplete="off"
          style="width:100%;background:#0a1527;border:1px solid rgba(239,68,68,0.35);color:#e8f0f8;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:9px 12px;border-radius:6px;outline:none;margin-bottom:18px;"
          oninput="document.getElementById('rl-confirm-exec').disabled=this.value!=='DELETE'"
          onkeydown="if(event.key==='Enter'&&this.value==='DELETE')_rlExecuteDelete()"/>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button onclick="_rlCloseModal()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:8px 18px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(205,216,232,0.7);cursor:pointer;">
            Cancel
          </button>
          <button id="rl-confirm-exec" onclick="_rlExecuteDelete()" disabled
            style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:8px 20px;border-radius:6px;border:1px solid rgba(239,68,68,0.5);background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;transition:all 0.15s;"
            onmouseover="if(!this.disabled)this.style.background='rgba(239,68,68,0.28)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">
            Delete Records
          </button>
        </div>
      </div>
    </div>
  `;

  _rlLoad();
}

// ══════════════════════════════════════════════════════════════════════════════
// PROXY UPLOAD — upload Excel on behalf of any workspace without touching
// the superadmin's own auth session or the target user's profile
// ══════════════════════════════════════════════════════════════════════════════

const _PU = {
  targetKey:     '',       // the workspace key we're uploading into
  targetProfile: null,     // resolved workspace profile object
  file:          null,     // staged File object
  status:        'idle',   // idle | resolving | ready | uploading | done | error
  instrument:    'mmas',   // 'mmas' | 'map'
};

function _rlRenderProxy(container) {
  container.innerHTML = `
    <div style="max-width:680px;">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.15rem;font-weight:300;color:${_C.text};margin-bottom:4px;">Proxy Bulk Upload</div>
      <div style="font-size:0.83rem;color:${_C.muted};line-height:1.7;margin-bottom:22px;">
        Upload an Excel file into <em>any researcher or student workspace</em> without logging in as that user,
        changing their password, or touching their profile. Records are stamped with the target workspace key —
        they appear in that user's dashboard instantly, exactly as if they uploaded the file themselves.
      </div>

      <!-- Step 1: Target workspace -->
      <div class="sa-panel" style="margin-bottom:14px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Step 1 · Target Workspace</div>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <input id="pu-key-input" type="text" placeholder="e.g. STU-ABC123 or RES-XYZ789"
            style="flex:1;background:${_C.bg2};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:9px 14px;border-radius:7px;outline:none;letter-spacing:0.06em;text-transform:uppercase;"
            oninput="this.value=this.value.toUpperCase()"
            onkeydown="if(event.key==='Enter')_puResolveKey()"/>
          <button onclick="_puResolveKey()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;padding:9px 18px;border-radius:7px;border:1px solid ${_C.border};background:${_C.navy};color:${_C.amber};cursor:pointer;white-space:nowrap;transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,168,67,0.12)'" onmouseout="this.style.background='${_C.navy}'">
            Resolve →
          </button>
        </div>
        <div id="pu-key-status" style="margin-top:10px;font-size:0.82rem;min-height:20px;"></div>
        <!-- Workspace info card — shown after resolve -->
        <div id="pu-ws-card" style="display:none;margin-top:12px;padding:12px 14px;background:${_C.bg2};border:1px solid rgba(46,201,138,0.25);border-left:3px solid ${_C.green};border-radius:7px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:0.82rem;">
            <div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Workspace Key</span><br><span id="pu-ws-key" style="color:${_C.amber};font-family:'IBM Plex Mono',monospace;"></span></div>
            <div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Role</span><br><span id="pu-ws-role" style="color:${_C.text};"></span></div>
            <div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Owner / PI</span><br><span id="pu-ws-name" style="color:${_C.text};"></span></div>
            <div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Institution</span><br><span id="pu-ws-inst" style="color:${_C.text};"></span></div>
          </div>
          <div style="margin-top:8px;font-size:0.76rem;font-family:'IBM Plex Mono',monospace;color:${_C.green};">✓ Workspace verified — records will be tagged with this key</div>
        </div>
      </div>

      <!-- Step 2: Instrument -->
      <div class="sa-panel" style="margin-bottom:14px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Step 2 · Instrument</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button id="pu-inst-mmas" onclick="_puSetInstrument('mmas')"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;padding:7px 18px;border-radius:6px;cursor:pointer;transition:all 0.15s;
                   background:rgba(78,156,245,0.18);border:1px solid rgba(78,156,245,0.55);color:rgba(78,156,245,0.95);">
            MMAS-8
          </button>
          <button id="pu-inst-map" onclick="_puSetInstrument('map')"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;padding:7px 18px;border-radius:6px;cursor:pointer;transition:all 0.15s;
                   background:transparent;border:1px solid ${_C.border};color:${_C.muted};">
            MAP
          </button>
        </div>
        <div id="pu-inst-hint" style="font-size:0.79rem;color:${_C.muted};line-height:1.6;">
          Records tagged as <strong style="color:rgba(78,156,245,0.95);">MMAS-8</strong> — Q1–Q7: Yes/No · Q5 reversed · Q8: Never/Rarely | Once in a while | Sometimes | Usually | All the time.
        </div>
      </div>

      <!-- Step 3: File -->
      <div class="sa-panel" style="margin-bottom:14px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Step 3 · Upload File</div>
        <div id="pu-dropzone"
          style="border:2px dashed ${_C.border};border-radius:8px;padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;"
          onclick="document.getElementById('pu-file-input').click()"
          ondragover="event.preventDefault();this.style.borderColor='${_C.amber}';this.style.background='${_C.navy}';"
          ondragleave="this.style.borderColor='${_C.border}';this.style.background='';"
          ondrop="_puDrop(event)">
          <div style="font-size:1.5rem;margin-bottom:8px;opacity:0.5;">📊</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_C.muted};">Drop ATLAS Excel template here, or click to browse</div>
          <div style="font-size:0.74rem;color:${_C.dim};margin-top:4px;">.xlsx, .xls, .xlsm · ATLAS v2 template format</div>
        </div>
        <input type="file" id="pu-file-input" accept=".xlsx,.xls,.xlsm" style="display:none" onchange="_puFileChosen(this.files[0])"/>
        <div id="pu-file-status" style="margin-top:10px;font-size:0.82rem;min-height:18px;"></div>
      </div>

      <!-- Step 4: Launch -->
      <div class="sa-panel" style="margin-bottom:14px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Step 4 · Run Upload</div>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <button id="pu-launch-btn" onclick="_puLaunch()" disabled
            style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.10em;text-transform:uppercase;padding:11px 26px;border-radius:7px;border:1px solid rgba(46,201,138,0.5);background:rgba(46,201,138,0.10);color:${_C.green};cursor:pointer;transition:all 0.2s;opacity:0.4;"
            onmouseover="if(!this.disabled){this.style.background='rgba(46,201,138,0.18)';this.style.opacity='1';}"
            onmouseout="if(!this.disabled){this.style.background='rgba(46,201,138,0.10)';}">
            ↑ Upload into Workspace
          </button>
          <div style="font-size:0.78rem;color:${_C.dim};line-height:1.5;">
            Both workspace key and file must be confirmed above.<br>
            Your superadmin session is <strong style="color:${_C.text};">never modified</strong> — only the target workspace key is injected into records.
          </div>
        </div>
        <!-- Progress -->
        <div id="pu-progress-wrap" style="display:none;margin-top:16px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:${_C.dim};">
            <span id="pu-prog-label">Uploading…</span>
            <span id="pu-prog-pct">0%</span>
          </div>
          <div style="height:4px;border-radius:2px;background:${_C.navy};overflow:hidden;">
            <div id="pu-prog-bar" style="height:100%;width:0%;background:${_C.green};transition:width 0.3s;border-radius:2px;"></div>
          </div>
        </div>
        <!-- Result -->
        <div id="pu-result" style="display:none;margin-top:14px;padding:12px 14px;border-radius:7px;font-size:0.83rem;line-height:1.6;"></div>
      </div>

      <!-- How it works -->
      <details style="margin-top:6px;">
        <summary style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};cursor:pointer;user-select:none;">How this works · no impersonation needed</summary>
        <div style="margin-top:10px;padding:14px;background:${_C.bg2};border:1px solid ${_C.border};border-radius:7px;font-size:0.82rem;color:${_C.muted};line-height:1.75;">
          <p>Every patient record in ATLAS has an <code style="color:${_C.amber};">institution_code</code> field that links it to a workspace. The bulk upload normally sets this field to the currently logged-in user's workspace key.</p>
          <p style="margin-top:8px;">Proxy Upload does exactly the same thing — it just lets you specify a <em>different</em> workspace key instead of your own. Your Firebase auth token is used for the write (so rules are satisfied), but the record's <code style="color:${_C.amber};">institution_code</code> points to the student's workspace. Their dashboard filters by that field, so the records appear immediately in their view.</p>
          <p style="margin-top:8px;color:${_C.dim};">No password change · no session cookie swap · no user profile modification · no email trigger. The student's account is completely untouched.</p>
        </div>
      </details>
    </div>
  `;
  _puSyncLaunchBtn();
}

// ── Proxy upload state management ──────────────────────────────────────────────
async function _puResolveKey() {
  const input = document.getElementById('pu-key-input');
  const statusEl = document.getElementById('pu-key-status');
  const card  = document.getElementById('pu-ws-card');
  if (!input || !statusEl) return;

  const key = input.value.trim().toUpperCase();
  if (!key) { statusEl.innerHTML = `<span style="color:${_C.amber};">Enter a workspace key first.</span>`; return; }

  statusEl.innerHTML = `<span style="color:${_C.dim};">Resolving…</span>`;
  card.style.display = 'none';
  _PU.targetKey     = '';
  _PU.targetProfile = null;

  try {
    const db = window.firebase?.database ? window.firebase.database()
             : (typeof database !== 'undefined' ? database : null);
    if (!db) throw new Error('Firebase not available');

    const snap = await db.ref('workspaces/' + key).once('value');
    const profile = snap.val();
    if (!profile) {
      statusEl.innerHTML = `<span style="color:${_C.red};">⚠ Workspace key <strong>${_saEsc(key)}</strong> not found in Firebase.</span>`;
      _puSyncLaunchBtn();
      return;
    }

    _PU.targetKey     = key;
    _PU.targetProfile = profile;

    // Populate card
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    _set('pu-ws-key',  key);
    _set('pu-ws-role', profile.role || profile.tier || '—');
    _set('pu-ws-name', profile.name || profile.pi_name || profile.owner || '—');
    _set('pu-ws-inst', profile.institution || profile.study_institution || profile.university || '—');

    card.style.display = 'block';
    statusEl.innerHTML = '';
  } catch (e) {
    statusEl.innerHTML = `<span style="color:${_C.red};">Error: ${_saEsc(e.message)}</span>`;
  }
  _puSyncLaunchBtn();
}

function _puDrop(event) {
  event.preventDefault();
  const dz = document.getElementById('pu-dropzone');
  if (dz) { dz.style.borderColor = _C.border; dz.style.background = ''; }
  const file = event.dataTransfer?.files?.[0];
  if (file) _puFileChosen(file);
}

function _puFileChosen(file) {
  if (!file) return;
  _PU.file = file;
  const statusEl = document.getElementById('pu-file-status');
  const dz       = document.getElementById('pu-dropzone');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color:${_C.green};">✓ ${_saEsc(file.name)}</span> <span style="color:${_C.dim};">${(file.size/1024).toFixed(0)} KB</span>`;
  }
  if (dz) {
    dz.style.borderColor = _C.green;
    dz.querySelector('div:nth-child(2)').textContent = file.name;
  }
  _puSyncLaunchBtn();
}

function _puSyncLaunchBtn() {
  const btn = document.getElementById('pu-launch-btn');
  if (!btn) return;
  const ready = !!_PU.targetKey && !!_PU.file;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '1' : '0.4';
  btn.style.cursor  = ready ? 'pointer' : 'default';
}

function _puSetInstrument(inst) {
  _PU.instrument = inst;
  const mmasBtn = document.getElementById('pu-inst-mmas');
  const mapBtn  = document.getElementById('pu-inst-map');
  const hint    = document.getElementById('pu-inst-hint');
  if (mmasBtn) {
    mmasBtn.style.background   = inst === 'mmas' ? 'rgba(78,156,245,0.18)' : 'transparent';
    mmasBtn.style.borderColor  = inst === 'mmas' ? 'rgba(78,156,245,0.55)' : 'rgba(255,255,255,0.15)';
    mmasBtn.style.color        = inst === 'mmas' ? 'rgba(78,156,245,0.95)' : 'rgba(255,255,255,0.4)';
  }
  if (mapBtn) {
    mapBtn.style.background   = inst === 'map' ? 'rgba(46,201,138,0.18)' : 'transparent';
    mapBtn.style.borderColor  = inst === 'map' ? 'rgba(46,201,138,0.55)' : 'rgba(255,255,255,0.15)';
    mapBtn.style.color        = inst === 'map' ? 'rgba(46,201,138,0.95)' : 'rgba(255,255,255,0.4)';
  }
  if (hint) {
    hint.innerHTML = inst === 'map'
      ? 'Records tagged as <strong style="color:rgba(46,201,138,0.95);">MAP</strong> — stored with <code>tool:"map"</code> and MAP_Q1–MAP_Q8. Q1–Q7: Yes/No · Q5 reversed · Q8: Never | Rarely | Sometimes | Often | All of the time. Use the ATLAS MAP template.'
      : 'Records tagged as <strong style="color:rgba(78,156,245,0.95);">MMAS-8</strong> — Q1–Q7: Yes/No · Q5 reversed · Q8: Never/Rarely | Once in a while | Sometimes | Usually | All the time. Use the ATLAS MMAS-8 template.';
  }
  // Reset file if already staged — different column layout
  _PU.file = null;
  const fs = document.getElementById('pu-file-status');
  if (fs) fs.textContent = '';
  const inp = document.getElementById('pu-file-input');
  if (inp) inp.value = '';
  _puSyncLaunchBtn();
}

async function _puLaunch() {
  if (!_PU.targetKey || !_PU.file) return;

  const progWrap = document.getElementById('pu-progress-wrap');
  const progBar  = document.getElementById('pu-prog-bar');
  const progLbl  = document.getElementById('pu-prog-label');
  const progPct  = document.getElementById('pu-prog-pct');
  const resultEl = document.getElementById('pu-result');
  const launchBtn= document.getElementById('pu-launch-btn');

  if (launchBtn) { launchBtn.disabled = true; launchBtn.textContent = 'Uploading…'; }
  if (progWrap) progWrap.style.display = 'block';
  if (resultEl) resultEl.style.display = 'none';

  const _prog = (pct, label) => {
    if (progBar) progBar.style.width = pct + '%';
    if (progLbl) progLbl.textContent = label;
    if (progPct) progPct.textContent = pct + '%';
  };

  // ── Scoring helpers — exact match to processBulkUpload in admin-panel.js ──
  // Q1–Q7: NO=1 (adherent), YES=0 (non-adherent). Q5 is REVERSED (YES=1).
  function yesno(v, reversed) {
    if (v === undefined || v === null || v === '') return null; // missing
    if (typeof v === 'boolean') {
      // Excel checkboxes / formula cells come through as JS booleans
      return reversed ? (v ? 1 : 0) : (v ? 0 : 1);
    }
    if (typeof v === 'number') return (v === 0 || v === 1) ? v : null;
    const s = String(v).trim().toUpperCase();
    const isYes = s === 'YES' || s === 'TRUE' || s === '1' || s === 'Y';
    const isNo  = s === 'NO'  || s === 'FALSE' || s === '0' || s === 'N';
    if (!isYes && !isNo) return null;
    return reversed ? (isYes ? 1 : 0) : (isNo ? 1 : 0);
  }
  function q8score(v) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'number') {
      // numeric index: 0=Never(1), 1=Rarely(0.75), 2=Sometimes(0.5), 3=Often(0.25), 4=Always(0)
      const indexMap = { 0:1, 1:0.75, 2:0.5, 3:0.25, 4:0 };
      return indexMap[v] !== undefined ? indexMap[v] : null;
    }
    const s = String(v).trim().toLowerCase();
    // Numeric index (0–4)
    const indexMap = { '0':1, '1':0.75, '2':0.5, '3':0.25, '4':0 };
    if (indexMap[s] !== undefined) return indexMap[s];
    // MMAS-8: "Never/Rarely" is the combined first option (value = 1)
    if (s === 'never/rarely' || s === 'never')   return 1;
    if (s === 'rarely' || s === 'once in a while') return 0.75;
    if (s === 'sometimes')                         return 0.5;
    if (s === 'usually' || s === 'often')          return 0.25;
    if (s === 'all the time' || s === 'all of the time' || s === 'always') return 0;
    return null;
  }

  try {
    await ensureSheetJS();
    const buffer   = await _PU.file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type:'array' });

    const sheetName = workbook.SheetNames.find(n =>
      n.includes('Data Entry') || n.includes('📊') || n.includes('data')
    ) || workbook.SheetNames[1] || workbook.SheetNames[0];

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header:1 });

    // Study metadata from header rows (v2 template — optional for proxy)
    const studyMeta = {
      study_title:       String(rows[1]?.[1] || '').trim() || 'Proxy Upload',
      pi_name:           String(rows[2]?.[1] || '').trim() || (_PU.targetProfile?.name || _PU.targetKey),
      study_institution: String(rows[3]?.[1] || '').trim() || (_PU.targetProfile?.institution || ''),
      irb_number:        String(rows[4]?.[1] || '').trim() || null,
      clinicaltrials_id: String(rows[5]?.[1] || '').trim() || null,
      study_phase:       String(rows[6]?.[1] || '').trim() || null,
    };

    // Locate header row (row where col[0] starts with "country")
    let headerRowIdx = 8;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      if (String(rows[i]?.[0] || '').trim().toLowerCase().startsWith('country')) {
        headerRowIdx = i; break;
      }
    }

    const _isExample = row =>
      String(row[0]||'').toUpperCase().includes('EXAMPLE') ||
      String(row[2]||'').toUpperCase().includes('EXAMPLE');

    // Require at least 19 columns (through Q8 at index 18)
    const dataRows = rows.slice(headerRowIdx + 1).filter(row =>
      row && row.length >= 12 && row[0] && !_isExample(row)
    );

    if (!dataRows.length) {
      // Show a diagnostic to help identify what was found
      const sampleRow = rows[headerRowIdx + 1] || rows[rows.length - 1] || [];
      const diag = `Header found at row ${headerRowIdx + 1}. First data row has ${sampleRow.length} columns. ` +
        `Sheet: "${sheetName}". Total rows in sheet: ${rows.length}.`;
      _puResult('error',
        `No data rows found in the file.<br>` +
        `<span style="font-size:0.78rem;color:${_C.dim};">${_saEsc(diag)}</span><br><br>` +
        `Ensure you are using the ATLAS v2 template and patient rows start after the header.`
      );
      if (launchBtn) { launchBtn.disabled = false; launchBtn.textContent = '↑ Upload into Workspace'; }
      _puSyncLaunchBtn();
      return;
    }

    _prog(3, `Parsed ${dataRows.length} rows — validating…`);

    // ── Column detection — by header name, same approach as admin-panel.js DnD ──
    // Works for both MMAS-8 and MAP templates regardless of column order
    const hdrRow = rows[headerRowIdx] || [];
    const norm   = s => String(s||'').toLowerCase().replace(/[\s\-—_#*?()\[\]]+/g,'');
    const findCol = (...terms) => {
      for (let c = 0; c < hdrRow.length; c++) {
        const h = norm(hdrRow[c]);
        for (const t of terms) { if (h.startsWith(norm(t))) return c; }
      }
      return -1;
    };
    const cCountry   = findCol('country');
    const cCity      = findCol('city','town');
    const cPatient   = findCol('patient','participantid','patientid','id');
    const cCondition = findCol('condition','diagnosis','medicalcondition');
    const cDrugType  = findCol('drugtype','drugclass','medicationtype');
    const cDrugName  = findCol('drugname','medicationname','medication');
    const cDrugStr   = findCol('drugstrength','strength','dose');
    const cRoute     = findCol('route','routeofadministration');
    const cGender    = findCol('gender','sex');
    const cAge       = findCol('age','agerange');
    const cEduc      = findCol('education');
    const isMAP      = _PU.instrument === 'map';
    // MAP template uses MAP_Q1..MAP_Q8; MMAS uses Q1..Q8
    const cQ = isMAP
      ? [1,2,3,4,5,6,7,8].map(n => findCol(`mapq${n}`,`map_q${n}`,`mq${n}`,`q${n}`))
      : [1,2,3,4,5,6,7,8].map(n => findCol(`q${n}`,`mmasq${n}`,`mq${n}`));

    // Q8 scoring — MAP and MMAS share the same 5-point scale labels but differ in text variants
    const q8scoreMAP = v => {
      if (v === undefined || v === null || v === '') return null;
      if (typeof v === 'number') { const m={0:1,1:0.75,2:0.5,3:0.25,4:0}; return m[v]!==undefined?m[v]:null; }
      const s = String(v).trim().toLowerCase();
      const m = {'never':1,'1':1,'rarely':0.75,'0.75':0.75,'sometimes':0.5,'0.5':0.5,'often':0.25,'0.25':0.25,'all the time':0,'all of the time':0,'0':0};
      return m[s] !== undefined ? m[s] : null;
    };

    // Pre-validate all rows first (mirrors processBulkUpload behaviour)
    const rowErrors = [];
    const validRows = [];
    dataRows.forEach((row, idx) => {
      const rowNum = headerRowIdx + 2 + idx;
      const errors = [];
      if (!String(row[cCountry >= 0 ? cCountry : 0]||'').trim()) errors.push('missing Country');

      const qLabel = i => isMAP ? `MAP_Q${i+1}` : `Q${i+1}`;
      const q = [0,1,2,3,4,5,6].map((i) => {
        const c = cQ[i];
        return c >= 0 ? yesno(row[c], i === 4 /* Q5 reversed */) : null;
      });
      const q8raw = cQ[7] >= 0 ? row[cQ[7]] : undefined;
      const q8 = isMAP ? q8scoreMAP(q8raw) : q8score(q8raw);

      q.forEach((v, i) => { if (v === null) errors.push(`${qLabel(i)} missing/invalid`); });
      if (q8 === null) errors.push(`${qLabel(7)} missing/invalid (use: ${isMAP ? 'Never | Rarely | Sometimes | Often | All of the time' : 'Never/Rarely | Once in a while | Sometimes | Usually | All the time'})`);

      if (errors.length) {
        const rawVals = cQ.map((c, i) => {
          const val = c >= 0 ? row[c] : '—';
          return `${qLabel(i)}=${JSON.stringify(val)}`;
        }).join(' ');
        console.warn(`[proxy-upload] Row ${rowNum} SKIPPED (${String(cPatient>=0?row[cPatient]:'?')}): ${errors.join(', ')} | ${rawVals}`);
        rowErrors.push({ rowNum, errors, row });
      } else {
        validRows.push({ row, q1:q[0], q2:q[1], q3:q[2], q4:q[3], q5:q[4], q6:q[5], q7:q[6], q8 });
      }
    });

    if (rowErrors.length > 0 && validRows.length === 0) {
      const sample = rowErrors.slice(0, 5).map(e => {
        const colVals = cQ.map((c, i) => `${isMAP?'MAP_':''}Q${i+1}=${JSON.stringify(c>=0?e.row[c]:'—')}`).join(' ');
        return `Row ${e.rowNum}: ${e.errors.join(', ')}<br><span style="font-size:0.74rem;color:${_C.dim};">${_saEsc(colVals)}</span>`;
      }).join('<br>');
      _puResult('error',
        `All ${rowErrors.length} rows failed validation — 0 uploaded.<br><br>` +
        `<strong>First errors:</strong><br>${sample}<br><br>` +
        `<span style="color:${_C.dim};font-size:0.80rem;">Q1–Q7 must be YES/NO or 0/1. Q5 is reversed (YES=adherent). ${isMAP?'MAP_Q8: Never | Rarely | Sometimes | Often | All of the time.':'Q8: Never/Rarely | Once in a while | Sometimes | Usually | All the time.'}</span>`
      );
      if (launchBtn) { launchBtn.disabled = false; launchBtn.textContent = '↑ Upload into Workspace'; }
      _puSyncLaunchBtn();
      return;
    }

    if (rowErrors.length > 0) {
      const warnEl = document.getElementById('pu-result');
      if (warnEl) {
        warnEl.style.display    = 'block';
        warnEl.style.border     = `1px solid ${_C.amber}`;
        warnEl.style.borderLeft = `3px solid ${_C.amber}`;
        warnEl.style.background = _C.bg2;
        warnEl.style.color      = _C.text;
        const sample = rowErrors.slice(0, 4).map(e => {
          const pat = String(cPatient>=0 ? e.row[cPatient] : '').trim() || `row ${e.rowNum}`;
          const colVals = cQ.map((c,i) => `${isMAP?'MAP_':''}Q${i+1}=${JSON.stringify(c>=0?e.row[c]:'—')}`).join(' ');
          return `<div style="margin-top:4px;"><strong>${_saEsc(pat)}</strong>: ${_saEsc(e.errors.join(', '))}<br>` +
            `<span style="font-size:0.72rem;color:${_C.dim};">${_saEsc(colVals)}</span></div>`;
        }).join('');
        const more = rowErrors.length > 4 ? `<div style="color:${_C.dim};font-size:0.78rem;margin-top:4px;">…and ${rowErrors.length - 4} more skipped rows</div>` : '';
        warnEl.innerHTML = `⚠ <strong>${rowErrors.length} rows skipped</strong> — uploading ${validRows.length} valid rows…${sample}${more}`;
      }
    }

    _prog(5, `Uploading ${validRows.length} records into ${_PU.targetKey}…`);

    const db = window.firebase?.database ? window.firebase.database()
             : (typeof database !== 'undefined' ? database : null);
    if (!db) throw new Error('Firebase not available');

    const total = validRows.length;
    let uploaded = 0, writeFailed = 0;

    // Geocode cache — one Nominatim call per unique city+country, reused across rows.
    // Nominatim requires 1 req/sec; cache hits skip the sleep entirely.
    const _geoCache = {};
    async function _geocode(country, city) {
      const key = (country + '|' + city).toLowerCase();
      if (_geoCache[key] !== undefined) return _geoCache[key]; // instant
      let coords = { lat: 0, lng: 0 };
      try {
        const geo = await fetch(
          'https://nominatim.openstreetmap.org/search?city=' + encodeURIComponent(city) +
          '&country=' + encodeURIComponent(country) + '&format=json&limit=1',
          { signal: AbortSignal.timeout(6000), headers:{ 'User-Agent':'ATLAS-AdherenceProject/2026' } }
        );
        const gd = await geo.json();
        if (gd.length > 0) coords = { lat: parseFloat(gd[0].lat), lng: parseFloat(gd[0].lon) };
        await new Promise(r => setTimeout(r, 1100)); // Nominatim 1 req/sec — only on real fetches
      } catch (_ge) { /* no coords */ }
      _geoCache[key] = coords;
      return coords;
    }

    for (const { row, q1, q2, q3, q4, q5, q6, q7, q8 } of validRows) {
      const country = String(cCountry >= 0 ? row[cCountry] : row[0] || '').trim();
      const city    = String(cCity    >= 0 ? row[cCity]    : row[1] || '').trim();

      const { lat, lng } = await _geocode(country, city);

      let submission;
      if (isMAP) {
        // ── MAP submission — mirrors _submitMAPCore in assess.html ────────────
        const total_score = parseFloat((q1+q2+q3+q4+q5+q6+q7+q8).toFixed(2));
        // PE domain scores — exact formula from computeMAPPE()
        const arch  = +((q2+q3+q6)/3).toFixed(4);                          // Architecture: Q2, Q3, Q6
        const exec  = +((q1+q5+q8)/3).toFixed(4);                          // Execution:    Q1, Q5, Q8
        const ctx   = +(0.5 + 0.5*((q4+q7)/2)).toFixed(4);                // Context-Guard: 0.5+0.5×mean(Q4,Q7)
        const pe    = +Math.pow(Math.max(0, arch*exec*ctx), 1/3).toFixed(4);
        submission = {
          tool:             'map',
          user_id:          typeof getUserId === 'function' ? getUserId() : 'superadmin-proxy',
          timestamp:        Date.now(),
          score:            total_score,
          pe_score:         pe,
          arch_score:       arch,
          exec_score:       exec,
          ctx_score:        ctx,
          map_q1: q1, map_q2: q2, map_q3: q3, map_q4: q4,
          map_q5: q5, map_q6: q6, map_q7: q7, map_q8: q8,
          country:          typeof normalizeCountry === 'function' ? normalizeCountry(country) : country,
          city,
          latitude:         lat, longitude: lng,
          patient_number:   String(cPatient   >= 0 ? row[cPatient]   : ''),
          condition:        String(cCondition >= 0 ? row[cCondition] : ''),
          drug_type:        String(cDrugType  >= 0 ? row[cDrugType]  : ''),
          drug_name:        String(cDrugName  >= 0 ? row[cDrugName]  : ''),
          drug_strength:    String(cDrugStr   >= 0 ? row[cDrugStr]   : ''),
          route_of_administration: String(cRoute >= 0 ? row[cRoute]  : ''),
          gender:           String(cGender    >= 0 ? row[cGender]    : ''),
          age_range:        String(cAge       >= 0 ? row[cAge]       : ''),
          education_level:  String(cEduc      >= 0 ? row[cEduc]      : ''),
          role:             'researcher',
          data_tier:        'clinical',
          ...studyMeta,
          upload_source:    'proxy_bulk',
          uploaded_by:      'superadmin',
          institution_code: _PU.targetKey,
        };
      } else {
        // ── MMAS-8 submission — original logic ────────────────────────────────
        const total_score = q1+q2+q3+q4+q5+q6+q7+q8;
        const cat = (typeof getAdherenceCategory === 'function')
          ? getAdherenceCategory(total_score)
          : { label: total_score >= 8 ? 'High Adherence' : total_score >= 6 ? 'Medium Adherence' : 'Low Adherence' };
        submission = {
          user_id:          typeof getUserId === 'function' ? getUserId() : 'superadmin-proxy',
          timestamp:        Date.now(),
          score:            total_score,
          adherence_level:  cat.label,
          country:          typeof normalizeCountry === 'function' ? normalizeCountry(country) : country,
          city,
          latitude:         lat, longitude: lng,
          patient_number:   String(cPatient   >= 0 ? row[cPatient]   : ''),
          condition:        String(cCondition >= 0 ? row[cCondition] : ''),
          drug_type:        String(cDrugType  >= 0 ? row[cDrugType]  : ''),
          drug_name:        String(cDrugName  >= 0 ? row[cDrugName]  : ''),
          drug_strength:    String(cDrugStr   >= 0 ? row[cDrugStr]   : ''),
          route_of_administration: String(cRoute >= 0 ? row[cRoute]  : ''),
          gender:           String(cGender    >= 0 ? row[cGender]    : ''),
          age_range:        String(cAge       >= 0 ? row[cAge]       : ''),
          education_level:  String(cEduc      >= 0 ? row[cEduc]      : ''),
          role:             'researcher',
          data_tier:        'clinical',
          q1, q2, q3, q4, q5, q6, q7, q8,
          ...studyMeta,
          upload_source:    'proxy_bulk',
          uploaded_by:      'superadmin',
          institution_code: _PU.targetKey,
        };
      }

      // Inherit parent workspace linkage from target profile
      if (_PU.targetProfile?.parent_institution) submission.parent_institution = _PU.targetProfile.parent_institution;
      if (_PU.targetProfile?.parent_pi)          submission.parent_pi          = _PU.targetProfile.parent_pi;

      // MMAS-8 only — PE domain scores from computeMMASPE (MAP already computed above)
      if (!isMAP && typeof computeMMASPE === 'function') {
        const pe = computeMMASPE(submission);
        if (pe) { submission.mmas_pe = pe.pe; submission.mmas_a = pe.a; submission.mmas_e = pe.e; submission.mmas_c = pe.c; }
      }

      try {
        // Write directly to Firebase — bypass atlasDB shim (which would use the
        // superadmin JWT and get rejected by the DynamoDB Lambda for student workspaces).
        await db.ref('assessments').push(submission);

        if (typeof updatePublicStats === 'function') updatePublicStats(submission.score, submission.country);
        uploaded++;
      } catch (fe) {
        console.warn('[proxy-upload] Firebase write failed:', fe);
        writeFailed++;
      }

      const pct = Math.round((uploaded + writeFailed) / total * 100);
      _prog(pct, `${uploaded + writeFailed} / ${total} records`);
      // No artificial write delay — geocode cache hits are instant; real fetches already wait 1.1s
    }

    _prog(100, 'Complete');
    const skippedTotal = rowErrors.length + writeFailed;
    _puResult(
      skippedTotal === 0 ? 'success' : 'partial',
      `✓ Upload complete. <strong>${uploaded}</strong> record${uploaded !== 1 ? 's' : ''} written to workspace <strong>${_saEsc(_PU.targetKey)}</strong>.` +
      (rowErrors.length ? ` · <span style="color:${_C.amber};">${rowErrors.length} rows skipped</span> (validation errors).` : '') +
      (writeFailed     ? ` · <span style="color:${_C.red};">${writeFailed} write failures</span> (check console).` : '') +
      ` Records appear in the student's dashboard immediately.`
    );

  } catch (e) {
    console.error('[proxy-upload]', e);
    _puResult('error', 'Upload failed: ' + _saEsc(e.message));
  }

  if (launchBtn) { launchBtn.disabled = false; launchBtn.textContent = '↑ Upload into Workspace'; }
  _puSyncLaunchBtn();
}

function _puResult(type, html) {
  const el = document.getElementById('pu-result');
  if (!el) return;
  const colors = { success: _C.green, partial: _C.amber, error: _C.red };
  const col = colors[type] || _C.amber;
  el.style.display    = 'block';
  el.style.border     = `1px solid ${col}`;
  el.style.borderLeft = `3px solid ${col}`;
  el.style.background = _C.bg2;
  el.style.color      = _C.text;
  el.innerHTML        = html;
}

// ── Data loading ───────────────────────────────────────────────────────────────
async function _rlLoad() {
  const db = window.firebase?.database ? window.firebase.database()
           : (typeof database !== 'undefined' ? database : null);
  if (!db) { _rlShowError('Firebase not available'); return; }

  _RL.loading = true;
  _RL.selected.clear();
  _rl('rl-loading').style.display = 'flex';
  _rl('rl-table-wrap').style.display = 'none';
  _rl('rl-empty').style.display = 'none';
  _rlUpdateDelBtn();

  try {
    const [assessSnap, peacsSnap, mapSnap, peacsMapSnap] = await Promise.all([
      db.ref('assessments').once('value').catch(() => null),
      db.ref('peacs_assessments').once('value').catch(() => null),
      db.ref('mapData').once('value').catch(() => null),
      db.ref('peacs_mapData').once('value').catch(() => null),
    ]);

    // assessments node holds both MMAS-8 and MAP instrument records.
    // mapData / peacs_mapData hold geographic coordinate pins for the live map.
    const assessRecs = assessSnap && assessSnap.val()
      ? Object.entries(assessSnap.val()).map(([k, v]) => ({
          ...v, _key: k,
          _type: (v.tool === 'map' || v.map_q1 !== undefined) ? 'map' : 'mmas',
        }))
      : [];
    const peacsRecs = peacsSnap && peacsSnap.val()
      ? Object.entries(peacsSnap.val()).map(([k, v]) => ({ ...v, _key: k, _type: 'peacs' }))
      : [];

    _RL.raw = [...assessRecs, ...peacsRecs]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Build reverse index: assessmentKey → mapData Firebase key
    // mapData records store assessment_ref pointing back to the assessment key.
    _RL.mapKeyIndex = {};
    const mData = mapSnap && mapSnap.val();
    if (mData) {
      Object.entries(mData).forEach(([mk, m]) => {
        if (m && m.assessment_ref) _RL.mapKeyIndex[m.assessment_ref] = mk;
      });
    }
    const pmData = peacsMapSnap && peacsMapSnap.val();
    if (pmData) {
      Object.entries(pmData).forEach(([mk, m]) => {
        if (m && m.assessment_ref) _RL.mapKeyIndex[m.assessment_ref] = mk;
      });
    }

    _rlApplyFilter();
  } catch (e) {
    _rlShowError('Load failed: ' + e.message);
  }

  _RL.loading = false;
  _rl('rl-loading').style.display = 'none';
}

// ── Filter + render ────────────────────────────────────────────────────────────
function _rlApplyFilter() {
  const q      = (_RL.filter.query || '').toLowerCase().trim();
  const type   = _RL.filter.type;
  const fromEl = _rl('rl-date-from');
  const toEl   = _rl('rl-date-to');
  const fromMs = fromEl && fromEl.value ? new Date(fromEl.value + 'T00:00:00').getTime() : 0;
  const toMs   = toEl && toEl.value   ? new Date(toEl.value   + 'T23:59:59').getTime() : Infinity;

  _RL.filtered = _RL.raw.filter(r => {
    if (type !== 'all' && r._type !== type) return false;
    const ts = r.timestamp || 0;
    if (ts < fromMs || ts > toMs) return false;
    if (q) {
      const haystack = [
        r.workspace_key, r.institution_code, r.patient_number,
        r.country, r.city, r.session_id, r._key,
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  _RL.page = 0;
  _RL.selected.clear();
  _rlUpdateDelBtn();
  _rlRenderTable();
}

function _rlOnSearch(val) {
  _RL.filter.query = val;
  _rlApplyFilter();
}

function _rlSetType(type) {
  _RL.filter.type = type;
  ['all','mmas','map','peacs'].forEach(t => {
    const b = _rl('rl-f-' + t);
    if (b) b.classList.toggle('rl-active', t === type);
  });
  _rlApplyFilter();
}

// ── Table rendering ────────────────────────────────────────────────────────────
function _rlRenderTable() {
  const tbody  = _rl('rl-tbody');
  const wrap   = _rl('rl-table-wrap');
  const empty  = _rl('rl-empty');
  const sumEl  = _rl('rl-summary');
  if (!tbody) return;

  const total  = _RL.filtered.length;
  if (total === 0) {
    wrap.style.display  = 'none';
    empty.style.display = 'block';
    sumEl.innerHTML     = '';
    return;
  }

  wrap.style.display  = 'block';
  empty.style.display = 'none';

  const ps    = _RL.pageSize;
  const start = _RL.page * ps;
  const page  = _RL.filtered.slice(start, start + ps);

  // Summary bar
  const mCnt  = _RL.filtered.filter(r => r._type === 'mmas').length;
  const pCnt  = _RL.filtered.filter(r => r._type === 'map').length;
  const pcCnt = _RL.filtered.filter(r => r._type === 'peacs').length;
  sumEl.innerHTML = `
    <span>${total.toLocaleString()} record${total !== 1 ? 's' : ''}</span>
    <span style="opacity:0.4;">·</span>
    <span style="color:${_C.blue};">${mCnt.toLocaleString()} MMAS-8</span>
    <span style="color:${_C.green};">${pCnt.toLocaleString()} MAP</span>
    <span style="color:${_C.purple};">${pcCnt.toLocaleString()} PEACS</span>
  `;

  // Rows
  tbody.innerHTML = page.map(r => _rlRowHTML(r)).join('');

  // Re-attach expanded drawer if key still in view
  if (_RL.expandedKey) {
    const still = page.find(r => r._key === _RL.expandedKey);
    if (still) _rlInjectDrawer(still);
    else _RL.expandedKey = null;
  }

  // Pagination controls
  const totalPages = Math.ceil(total / ps);
  const prevBtn    = _rl('rl-prev-btn');
  const nextBtn    = _rl('rl-next-btn');
  const pageInfo   = _rl('rl-page-info');
  if (prevBtn) prevBtn.disabled = _RL.page === 0;
  if (nextBtn) nextBtn.disabled = _RL.page >= totalPages - 1;
  if (pageInfo) pageInfo.textContent =
    `Page ${_RL.page + 1} of ${totalPages} · showing ${start + 1}–${Math.min(start + ps, total)} of ${total.toLocaleString()}`;

  // Reset select-all checkbox
  const sa = _rl('rl-selall-cb');
  if (sa) sa.checked = false;
  _rlUpdateDelBtn();
}

function _rlRowHTML(r) {
  const checked  = _RL.selected.has(r._key);
  const expanded = _RL.expandedKey === r._key;
  const ts       = r.timestamp ? new Date(r.timestamp) : null;
  const date     = ts ? ts.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '—';
  const time     = ts ? ts.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '';
  const score    = _rlScore(r);
  const ws       = _saEsc(r.workspace_key || r.institution_code || '—');
  const patient  = _saEsc(r.patient_number || '—');
  const country  = _saEsc(r.country || '—');
  const session  = _saEsc((r.session_id || r._key || '').slice(0, 14));
  const badge    = `<span class="rl-badge rl-badge-${r._type}">${r._type === 'mmas' ? 'MMAS-8' : r._type.toUpperCase()}</span>`;

  return `
    <tr class="rl-row${checked ? ' rl-checked' : ''}${expanded ? ' rl-expanded-row' : ''}"
        id="rl-row-${_saEsc(r._key)}"
        onclick="_rlRowClick(event,'${_saEsc(r._key)}')">
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="rl-cb" data-key="${_saEsc(r._key)}"
          ${checked ? 'checked' : ''} onchange="_rlToggleOne('${_saEsc(r._key)}',this.checked)">
      </td>
      <td>${badge}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;">
        <div>${date}</div>
        <div style="color:${_C.dim};font-size:0.72rem;">${time}</div>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${score}</td>
      <td>${country}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${_C.amberDim};">${ws}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;">${patient}</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:${_C.dim};">${session}…</td>
      <td style="text-align:center;color:${_C.dim};font-size:0.80rem;">${expanded ? '▲' : '▼'}</td>
    </tr>
    ${expanded ? _rlDrawerHTML(r) : ''}
  `;
}

// Recompute MMAS-8 score from individual items to correct Q8 stored as integer index (0–4).
// Mirrors the convention in clinical-practice.js: integer 0→1, 1→0.75, 2→0.5, 3→0.25, 4→0.
function _rlMMASScore(r) {
  if (r.q1 === undefined) return Number(r.score) || 0;
  const binary = (parseFloat(r.q1)||0)+(parseFloat(r.q2)||0)+(parseFloat(r.q3)||0)+
                 (parseFloat(r.q4)||0)+(parseFloat(r.q5)||0)+(parseFloat(r.q6)||0)+(parseFloat(r.q7)||0);
  const raw = r.q8;
  let q8val;
  if (typeof raw === 'number') {
    q8val = (Number.isInteger(raw) && raw >= 0 && raw <= 4) ? [1,0.75,0.5,0.25,0][raw] : raw;
  } else {
    const s = String(raw||'').trim().toLowerCase();
    q8val = ({'never/rarely':1,'never / rarely':1,'never':1,'rarely':0.75,'once in a while':0.75,
              'sometimes':0.5,'often':0.25,'usually':0.25,'always':0,'all the time':0})[s] ?? 0;
  }
  return binary + q8val;
}

function _rlScore(r) {
  if (r._type === 'mmas')  return r.score !== undefined  ? `<span style="color:${_C.blue};">${_rlMMASScore(r).toFixed(2)}</span>` : '—';
  if (r._type === 'map') {
    if (r.map_q1 !== undefined) {
      const _a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
      const _e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
      const _c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
      return `<span style="color:${_C.green};">${Math.pow(Math.max(0,_a*_e*_c),1/3).toFixed(3)}</span>`;
    }
    return r.mapScore !== undefined ? `<span style="color:${_C.green};">${Number(r.mapScore).toFixed(3)}</span>` : '—';
  }
  if (r._type === 'peacs') return r.pe !== undefined ? `<span style="color:${_C.purple};">${Number(r.pe).toFixed(3)}</span>` : '—';
  return '—';
}

function _rlDrawerHTML(r) {
  // Build a grid of all non-private, non-trivial fields
  const skip = new Set(['_key','_type']);
  const fields = Object.entries(r)
    .filter(([k]) => !skip.has(k))
    .sort(([a], [b]) => a.localeCompare(b));

  const cells = fields.map(([k, v]) => {
    let val = v;
    if (k === 'timestamp' && typeof v === 'number') {
      val = new Date(v).toLocaleString('en-US', {
        month:'short', day:'numeric', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      });
    } else if (k === 'q8' && r._type === 'mmas' && typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4) {
      // Integer q8 is a 0–4 index: map to fractional score (0→1, 1→0.75, 2→0.5, 3→0.25, 4→0)
      val = [1, 0.75, 0.5, 0.25, 0][v];
    } else if (k === 'score' && r._type === 'mmas') {
      // Show the corrected score (fixes records where q8 index was summed as raw value)
      val = _rlMMASScore(r);
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      // Medication / structured array — render each item as "Name · Strength · Route"
      val = v.map(m => {
        const parts = [m.name, m.strength, m.route, m.frequency].filter(Boolean);
        return parts.join(' · ');
      }).join('; ');
    } else if (typeof v === 'object' && v !== null) {
      val = JSON.stringify(v);
    }
    const strVal = String(val ?? '');
    const wide   = strVal.length > 40 ? ' rl-field-wide' : '';
    return `
      <div class="rl-field${wide}">
        <div class="rl-field-lbl">${_saEsc(k)}</div>
        <div class="rl-field-val">${_saEsc(strVal)}</div>
      </div>`;
  }).join('');

  // ── Trajectory chart — all assessments for this patient_number ──────────────
  const pid = r.patient_number || r.patient_id || null;
  const trajHTML = pid ? _rlTrajChart(r._key, pid, r._type) : '';

  // ── Intervention log ────────────────────────────────────────────────────────
  const intvHTML = pid ? _rlIntvHTML(r._key, pid) : '';

  const _rlMapKey = _RL.mapKeyIndex[r._key] || null;
  return `
    <tr class="rl-expand-drawer">
      <td colspan="9">
        <div style="padding:4px 0 8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.20em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">
            Assessment key: ${_saEsc(r._key)}
            ${_rlMapKey ? `<span style="margin-left:18px;color:rgba(120,200,255,0.7);">Map key: ${_saEsc(_rlMapKey)}</span>` : '<span style="margin-left:18px;color:rgba(180,180,180,0.35);font-size:0.62rem;">no map pin</span>'}
            <button onclick="event.stopPropagation();_rlDeleteOne('${_saEsc(r._key)}')"
              style="margin-left:16px;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:2px 10px;border-radius:4px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.06);color:#ef4444;cursor:pointer;">
              Delete this record
            </button>
          </div>
          ${trajHTML}
          ${intvHTML}
          <div class="rl-field-grid">${cells}</div>
        </div>
      </td>
    </tr>`;
}

// ── Score trajectory sparkline ──────────────────────────────────────────────────
// Renders a linked SVG line chart of all MMAS/MAP assessments for a patient_number.
// MMAS scores shown on 0–8 scale. MAP PE scores shown on 0–1 scale (right axis).
function _rlTrajChart(currentKey, pid, type) {
  // Gather all records for this patient across both MMAS and MAP types
  const records = (_RL.raw || [])
    .filter(rec => (rec.patient_number === pid || rec.patient_id === pid))
    .filter(rec => typeof rec.score === 'number' || typeof rec.mmas_pe === 'number' || typeof rec.pe === 'number')
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  if (records.length < 2) return ''; // need at least 2 points to be meaningful

  const W = 520, H = 64, PAD = { l:32, r:8, t:8, b:16 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  // Determine which scale to use based on majority type
  const mmasRecs = records.filter(rec => rec._type === 'mmas' || typeof rec.score === 'number');
  const mapRecs  = records.filter(rec => rec._type === 'map'  && typeof (rec.pe || rec.mmas_pe) === 'number');

  const tMin = records[0].timestamp || 0;
  const tMax = records[records.length - 1].timestamp || tMin + 1;
  const tRange = tMax - tMin || 1;

  function xPos(ts) { return PAD.l + ((ts - tMin) / tRange) * plotW; }
  function yMmas(s) { return PAD.t + plotH - (Math.min(8, Math.max(0, s)) / 8) * plotH; }
  function yMap(pe) { return PAD.t + plotH - (Math.min(1, Math.max(0, pe)) / 1) * plotH; }

  // Build MMAS polyline
  let mmasLine = '', mmasDots = '';
  if (mmasRecs.length >= 2) {
    const pts = mmasRecs.map(rec => ({ x: xPos(rec.timestamp||0), y: yMmas(rec.score), rec }));
    mmasLine = `<polyline points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(78,156,245,0.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    mmasDots = pts.map(p => {
      const isCurrent = p.rec._key === currentKey;
      const dateStr = p.rec.timestamp ? new Date(p.rec.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
      return `<circle class="rl-traj-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isCurrent ? 5 : 3}"
        fill="${isCurrent ? 'rgba(78,156,245,1)' : 'rgba(78,156,245,0.5)'}"
        stroke="${isCurrent ? '#fff' : 'none'}" stroke-width="1.5">
        <title>${dateStr} · MMAS ${p.rec.score?.toFixed(2)}</title>
      </circle>`;
    }).join('');
  }

  // Build MAP/PE polyline
  let mapLine = '', mapDots = '';
  if (mapRecs.length >= 2) {
    const pts = mapRecs.map(rec => ({ x: xPos(rec.timestamp||0), y: yMap(rec.pe ?? rec.mmas_pe ?? 0), rec }));
    mapLine = `<polyline points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(212,168,67,0.55)" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="3 2"/>`;
    mapDots = pts.map(p => {
      const isCurrent = p.rec._key === currentKey;
      const dateStr = p.rec.timestamp ? new Date(p.rec.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
      return `<circle class="rl-traj-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isCurrent ? 5 : 3}"
        fill="${isCurrent ? 'rgba(212,168,67,1)' : 'rgba(212,168,67,0.5)'}"
        stroke="${isCurrent ? '#fff' : 'none'}" stroke-width="1.5">
        <title>${dateStr} · PE ${(p.rec.pe ?? p.rec.mmas_pe)?.toFixed(3)}</title>
      </circle>`;
    }).join('');
  }

  // Y-axis labels
  const yAxisLabels = [0,4,8].map(v => {
    const y = yMmas(v);
    return `<text x="${PAD.l - 4}" y="${y.toFixed(1)}" text-anchor="end" font-family="'IBM Plex Mono',monospace" font-size="8" fill="${_C.dim}" dominant-baseline="middle">${v}</text>`;
  }).join('');

  // Score delta badge (last vs first for MMAS)
  let deltaBadge = '';
  if (mmasRecs.length >= 2) {
    const first = mmasRecs[0].score;
    const last  = mmasRecs[mmasRecs.length - 1].score;
    const delta = last - first;
    const sign  = delta >= 0 ? '+' : '';
    const col   = delta >= 0 ? 'rgba(46,201,138,0.8)' : 'rgba(239,68,68,0.8)';
    deltaBadge = `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:${col};margin-left:10px;">${sign}${delta.toFixed(2)} overall</span>`;
  }

  const legend = [
    mmasRecs.length >= 2 ? `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:18px;height:2px;background:rgba(78,156,245,0.6);display:inline-block;border-radius:1px;"></span>MMAS-8</span>` : '',
    mapRecs.length  >= 2 ? `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:18px;height:2px;background:rgba(212,168,67,0.6);display:inline-block;border-radius:1px;border-top:2px dashed rgba(212,168,67,0.6);"></span>MAP · PE</span>` : '',
  ].filter(Boolean).join('<span style="margin:0 6px;color:var(--mc-border);">|</span>');

  return `
  <div class="rl-traj">
    <div class="rl-traj-hdr">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--mc-dim);">Score Trajectory · ${_saEsc(pid)} · ${records.length} visits ${deltaBadge}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.64rem;color:var(--mc-dim);display:flex;gap:10px;">${legend}</span>
    </div>
    <svg class="rl-traj-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <!-- Grid lines -->
      ${[0,4,8].map(v => {
        const y = yMmas(v).toFixed(1);
        return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="${_C.border}" stroke-width="1"/>`;
      }).join('')}
      ${yAxisLabels}
      ${mmasLine}${mmasDots}
      ${mapLine}${mapDots}
    </svg>
  </div>`;
}

// ── Intervention log ────────────────────────────────────────────────────────────
// Renders logged interventions for a patient_number from _rlIntvCache.
// Write/read path: Firebase workspaces/{ws}/interventions/{pid}/{key}
function _rlIntvHTML(recordKey, pid) {
  // Trigger lazy Firebase fetch after DOM renders
  setTimeout(() => _rlFetchIntv(recordKey, pid), 0);
  const existing = (window._rlIntvCache && window._rlIntvCache[pid]) || [];
  const listHTML = existing.length
    ? existing.map(iv => `
        <div class="rl-intv-log-item">
          <span class="rl-intv-ts">${iv.date || ''}</span>
          <span>${_saEsc(iv.note || '')}</span>
          ${iv.outcome_score != null ? `<span style="margin-left:8px;color:rgba(46,201,138,0.7);font-size:0.70rem;">→ next score ${iv.outcome_score}</span>` : ''}
        </div>`).join('')
    : `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--mc-dim);opacity:0.5;">No interventions logged yet.</div>`;

  return `
  <div class="rl-intv">
    <div class="rl-intv-hdr">Pharmacist Interventions · ${_saEsc(pid)}</div>
    <div id="rl-intv-list-${_saEsc(recordKey)}">${listHTML}</div>
    <div class="rl-intv-entry" style="margin-top:10px;">
      <textarea class="rl-intv-textarea" id="rl-intv-txt-${_saEsc(recordKey)}" rows="1"
        placeholder="Log intervention note (counselling, barrier, regimen change…)"
        onclick="event.stopPropagation()"></textarea>
      <button class="rl-intv-save" onclick="event.stopPropagation();_rlSaveIntv('${_saEsc(recordKey)}','${_saEsc(pid)}')">Save</button>
    </div>
  </div>`;
}

// ── Save an intervention note to Firebase ───────────────────────────────────────
function _rlSaveIntv(recordKey, pid) {
  const txt = (document.getElementById('rl-intv-txt-' + recordKey) || {}).value;
  if (!txt || !txt.trim()) return;
  const ws  = typeof currentWorkspace !== 'undefined' ? currentWorkspace : null;
  if (!ws) { showToast('No active workspace.', 2000); return; }
  const db  = firebase.database();
  const ts  = Date.now();
  const note = txt.trim();
  const ref = db.ref(`workspaces/${ws}/interventions/${pid}`).push();
  ref.set({ note, date: new Date(ts).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}), timestamp: ts, record_key: recordKey, author: typeof userId !== 'undefined' ? userId : null })
    .then(() => {
      if (!window._rlIntvCache) window._rlIntvCache = {};
      if (!window._rlIntvCache[pid]) window._rlIntvCache[pid] = [];
      window._rlIntvCache[pid].unshift({ note, date: new Date(ts).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}), timestamp: ts });
      const listEl = document.getElementById('rl-intv-list-' + recordKey);
      if (listEl) {
        listEl.innerHTML = window._rlIntvCache[pid].map(iv => `
          <div class="rl-intv-log-item">
            <span class="rl-intv-ts">${iv.date || ''}</span>
            <span>${_saEsc(iv.note || '')}</span>
          </div>`).join('');
      }
      const ta = document.getElementById('rl-intv-txt-' + recordKey);
      if (ta) ta.value = '';
      showToast('Intervention logged.', 2000);
      atlasAuditLog('intervention_log', { workspace: ws, patient: pid, note });
    })
    .catch(err => showToast('Error saving intervention: ' + err.message, 3000));
}

// ── Lazy-load interventions from Firebase when a drawer opens ───────────────────
// Called from _rlIntvHTML via a queued setTimeout so the drawer renders first.
function _rlFetchIntv(recordKey, pid) {
  const ws = typeof currentWorkspace !== 'undefined' ? currentWorkspace : null;
  if (!ws) return;
  const db = window.firebase?.database ? window.firebase.database()
           : (typeof database !== 'undefined' ? database : null);
  if (!db) return;
  db.ref(`workspaces/${ws}/interventions/${pid}`).orderByChild('timestamp').once('value')
    .then(snap => {
      if (!snap.exists()) return;
      if (!window._rlIntvCache) window._rlIntvCache = {};
      window._rlIntvCache[pid] = [];
      snap.forEach(child => {
        const iv = child.val();
        window._rlIntvCache[pid].unshift(iv); // unshift → most recent first after forEach
      });
      // Reverse so most recent is first
      window._rlIntvCache[pid].reverse();
      const listEl = document.getElementById('rl-intv-list-' + recordKey);
      if (!listEl) return; // drawer was closed
      listEl.innerHTML = window._rlIntvCache[pid].length
        ? window._rlIntvCache[pid].map(iv => `
            <div class="rl-intv-log-item">
              <span class="rl-intv-ts">${iv.date || ''}</span>
              <span>${_saEsc(iv.note || '')}</span>
            </div>`).join('')
        : `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:var(--mc-dim);opacity:0.5;">No interventions logged yet.</div>`;
    })
    .catch(() => {}); // silent fail — interventions are supplementary
}

function _rlInjectDrawer(r) {
  const row = document.getElementById('rl-row-' + r._key);
  if (!row) return;
  const existing = row.nextElementSibling;
  if (existing && existing.classList.contains('rl-expand-drawer')) return;
  row.insertAdjacentHTML('afterend', _rlDrawerHTML(r));
}

// ── Row interactions ───────────────────────────────────────────────────────────
function _rlRowClick(event, key) {
  // Don't toggle expand when clicking the checkbox cell
  if (event.target.type === 'checkbox') return;
  if (_RL.expandedKey === key) {
    _RL.expandedKey = null;
  } else {
    _RL.expandedKey = key;
  }
  _rlRenderTable();
}

function _rlToggleOne(key, checked) {
  if (checked) _RL.selected.add(key);
  else          _RL.selected.delete(key);
  // Style the row
  const row = document.getElementById('rl-row-' + key);
  if (row) row.classList.toggle('rl-checked', checked);
  _rlUpdateDelBtn();
  // Update select-all checkbox indeterminate state
  _rlSyncSelAllCheckbox();
}

function _rlToggleAll(checked) {
  const ps    = _RL.pageSize;
  const start = _RL.page * ps;
  const page  = _RL.filtered.slice(start, start + ps);
  page.forEach(r => {
    if (checked) _RL.selected.add(r._key);
    else          _RL.selected.delete(r._key);
    const row = document.getElementById('rl-row-' + r._key);
    if (row) row.classList.toggle('rl-checked', checked);
    const cb = document.querySelector(`input[data-key="${_saEsc(r._key)}"]`);
    if (cb) cb.checked = checked;
  });
  _rlUpdateDelBtn();
}

function _rlSyncSelAllCheckbox() {
  const sa = _rl('rl-selall-cb');
  if (!sa) return;
  const ps    = _RL.pageSize;
  const start = _RL.page * ps;
  const page  = _RL.filtered.slice(start, start + ps);
  const selOnPage = page.filter(r => _RL.selected.has(r._key)).length;
  sa.indeterminate = selOnPage > 0 && selOnPage < page.length;
  sa.checked       = selOnPage > 0 && selOnPage === page.length;
}

function _rlUpdateDelBtn() {
  const n    = _RL.selected.size;
  const btn  = _rl('rl-del-btn');
  const cnt  = _rl('rl-sel-count');
  if (btn) btn.disabled = n === 0;
  if (cnt) cnt.textContent = n > 0 ? `${n} selected` : '';
  if (btn) btn.textContent = n > 0 ? `⊘ Delete ${n} record${n !== 1 ? 's' : ''}` : '⊘ Delete Selected';
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function _rlPage(dir) {
  const total = Math.ceil(_RL.filtered.length / _RL.pageSize);
  _RL.page = Math.max(0, Math.min(total - 1, _RL.page + dir));
  _RL.expandedKey = null;
  _rlRenderTable();
}

// ── Delete flow ────────────────────────────────────────────────────────────────
function _rlDeleteOne(key) {
  _RL.selected.clear();
  _RL.selected.add(key);
  _rlUpdateDelBtn();
  _rlConfirmDelete();
}

function _rlConfirmDelete() {
  const n = _RL.selected.size;
  if (n === 0) return;

  // ── CFR-11 §11.200 — prefer e-signature flow if available ─────────────────
  if (typeof _eSign === 'function') {
    const delBtn = _rl('rl-del-btn');
    if (delBtn) delBtn.disabled = true;
    _eSign({
      title:       'Authorise Record Deletion',
      meaning:     'I authorise the permanent deletion of the selected patient record(s). This action is irreversible.',
      actionLabel: 'Delete Records',
      recordRef:   'data_ledger_delete',
      onConfirm:   function(sigId) { _rlExecuteDelete(sigId); },
      onCancel:    function() { if (delBtn) delBtn.disabled = (_RL.selected.size === 0); },
    });
    return;
  }

  // ── Fallback: type-DELETE confirmation (no e-signature module loaded) ──────
  const modal  = _rl('rl-confirm-modal');
  const msgEl  = _rl('rl-modal-msg');
  const input  = _rl('rl-confirm-input');
  const execBtn= _rl('rl-confirm-exec');
  if (!modal) return;
  msgEl.innerHTML = `You are about to <strong style="color:#ef4444;">permanently delete ${n} record${n !== 1 ? 's' : ''}</strong> from Firebase.
    This cannot be undone and will be immediately reflected in all dashboards, analytics, and exports.`;
  input.value = '';
  if (execBtn) execBtn.disabled = true;
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 80);
}

function _rlCloseModal() {
  const modal = _rl('rl-confirm-modal');
  if (modal) modal.style.display = 'none';
}

async function _rlExecuteDelete(sigId) {
  const db = window.firebase?.database ? window.firebase.database()
           : (typeof database !== 'undefined' ? database : null);
  if (!db) return;

  const modal   = _rl('rl-confirm-modal');
  const execBtn = _rl('rl-confirm-exec');
  if (execBtn) { execBtn.disabled = true; execBtn.textContent = 'Deleting…'; }

  const keys    = Array.from(_RL.selected);
  const pathMap = {};
  _RL.raw.forEach(r => { if (keys.includes(r._key)) pathMap[r._key] = r._type; });

  const dbPath = { mmas:'assessments', map:'mapData', peacs:'peacs_assessments' };
  const errors = [];

  await Promise.all(keys.map(async key => {
    const type = pathMap[key];
    if (!type || !dbPath[type]) { errors.push(key); return; }
    try {
      await db.ref(`${dbPath[type]}/${key}`).remove();

      // Also remove the linked geographic map pin (mapData / peacs_mapData) if one exists.
      // The reverse index was built from assessment_ref → mapData key at load time.
      const linkedMapKey = _RL.mapKeyIndex[key];
      if (linkedMapKey) {
        const mapNode = type === 'peacs' ? 'peacs_mapData' : 'mapData';
        await db.ref(`${mapNode}/${linkedMapKey}`).remove().catch(() => {});
        delete _RL.mapKeyIndex[key];
      }

      // CFR-11 §11.10(e) — audit DELETE entry, linked to e-signature if present
      const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
      db.ref('audit_log').push({
        cfr11:         true,
        action:        'DELETE',
        table:         dbPath[type],
        record_id:     key,
        actor_uid:     user ? user.uid   : 'unknown',
        actor_email:   user ? user.email : 'unknown',
        signature_id:  sigId || null,
        workspace:     (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null,
        timestamp_utc: new Date().toISOString(),
        client_ts:     Date.now(),
      }).catch(function(){});

    } catch(e) {
      errors.push(key);
    }
  }));

  const deleted = keys.length - errors.length;
  if (modal) modal.style.display = 'none';

  // Re-enable delete button
  const delBtn = _rl('rl-del-btn');
  if (delBtn) delBtn.disabled = true; // stays disabled — nothing selected after clear

  // Remove deleted records from local cache and re-render
  const deletedSet = new Set(keys.filter(k => !errors.includes(k)));
  _RL.raw      = _RL.raw.filter(r => !deletedSet.has(r._key));
  _RL.selected.clear();
  _rlApplyFilter();

  // Toast
  _rlToast(
    errors.length === 0
      ? `✓ ${deleted} record${deleted !== 1 ? 's' : ''} permanently deleted.`
      : `${deleted} deleted · ${errors.length} failed (check console).`,
    errors.length === 0 ? _C.green : _C.amber
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function _rl(id) { return document.getElementById(id); }

function _rlToast(msg, color) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:28px;right:28px;z-index:300000;background:#070e1d;border:1px solid ${color};border-left:3px solid ${color};border-radius:8px;padding:12px 18px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${color};max-width:360px;box-shadow:0 4px 24px rgba(0,0,0,0.5);animation:sa-feed-in 0.25s ease;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function _rlShowError(msg) {
  const loading = _rl('rl-loading');
  if (loading) loading.innerHTML = `<span style="color:${_C.red};">⚠ ${_saEsc(msg)}</span>`;
}

function _saEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
