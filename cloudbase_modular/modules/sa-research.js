// sa-research.js — Research Hub: data export, group analysis, study registry, ATLAS IDs, meta-analysis, forest export, citations



// ══════════════════════════════════════════════════════════════════════════════
// RESEARCH TAB — Data Export · Group Analysis · Study Registry · Citations
// ══════════════════════════════════════════════════════════════════════════════

let _saResTab = 'export';

const _SA_RES_SUBS = [
  { id: 'export',   icon: '◫', label: 'Data Export'    },
  { id: 'analysis', icon: '◬', label: 'Group Analysis' },
  { id: 'registry', icon: '◈', label: 'Study Registry' },
  { id: 'meta',     icon: '◎', label: 'Meta-Analysis'  },
  { id: 'refs',     icon: '◩', label: 'Citations'      },
];

function _saRenderResearch(container) {
  container.style.padding = '24px 28px';
  container.innerHTML = `
  <div style="margin-bottom:20px;">
    <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · Research</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_C.text};">Research Console</div>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:22px;border-bottom:1px solid ${_C.border};padding-bottom:16px;flex-wrap:wrap;">
    ${_SA_RES_SUBS.map(s => `
      <button id="sa-res-btn-${s.id}" onclick="saResTab('${s.id}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:7px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;
               background:${s.id==='export'?_C.amberFaint:'transparent'};
               border:1px solid ${s.id==='export'?'rgba(212,168,67,0.35)':_C.border};
               color:${s.id==='export'?_C.amber:_C.muted};">
        ${s.icon} ${s.label}
      </button>`).join('')}
  </div>

  <div id="sa-res-body"></div>`;

  saResTab('export');
}

function saResTab(tab) {
  _saResTab = tab;
  _SA_RES_SUBS.forEach(s => {
    const btn = document.getElementById('sa-res-btn-' + s.id);
    if (!btn) return;
    const active = s.id === tab;
    btn.style.background  = active ? _C.amberFaint : 'transparent';
    btn.style.borderColor = active ? 'rgba(212,168,67,0.35)' : _C.border;
    btn.style.color       = active ? _C.amber : _C.muted;
  });
  const body = document.getElementById('sa-res-body');
  if (!body) return;
  switch (tab) {
    case 'export':   _saResRenderExport(body);   break;
    case 'analysis': _saResRenderAnalysis(body); break;
    case 'registry': _saResRenderRegistry(body); break;
    case 'meta':     _saResRenderMeta(body);     break;
    case 'refs':     _saResRenderRefs(body);     break;
  }
}

// ── DATA EXPORT ───────────────────────────────────────────────────────────────

function _saResRenderExport(body) {
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const mapInstr = mmas.filter(r => r.map_q1 !== undefined);
  const now   = Date.now();

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start;">

    <!-- Export builder -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Export Builder</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-top:14px;">

        <!-- Instrument -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Instrument</div>
          <select id="sa-exp-inst" onchange="_saResExportPreview()"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="mmas">MMAS-8 (${mmas.filter(r=>r.tool!=='map' && r.map_q1===undefined).length.toLocaleString()} records)</option>
            <option value="map">MAP (${mapInstr.length.toLocaleString()} records)</option>
            <option value="peacs">PEACS (${peacs.length.toLocaleString()} records)</option>
            <option value="all">All instruments (${(mmas.length+peacs.length).toLocaleString()} records)</option>
          </select>
        </div>

        <!-- Format -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Format</div>
          <select id="sa-exp-fmt"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="csv">CSV (comma-separated)</option>
            <option value="json">JSON (array of objects)</option>
            <option value="tsv">TSV (tab-separated)</option>
          </select>
        </div>

        <!-- Date range -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Date Range</div>
          <select id="sa-exp-date" onchange="_saResExportPreview()"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last 12 months</option>
          </select>
        </div>

        <!-- Anonymisation -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Anonymisation</div>
          <select id="sa-exp-anon"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="full">Full (no identifiers)</option>
            <option value="coded">Workspace coded (WS_001…)</option>
            <option value="named">Workspace named</option>
          </select>
        </div>

      </div>

      <!-- Field selector -->
      <div style="margin-top:18px;">
        <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:8px;">Include Fields</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="sa-exp-fields">
          ${[
            ['score',     'Score',      true ],
            ['norm',      'Norm (0–1)', true ],
            ['tier',      'Tier',       true ],
            ['timestamp', 'Timestamp',  true ],
            ['country',   'Country',    true ],
            ['workspace', 'Workspace',  false],
            ['items',     'Item Responses', false],
            ['subscales', 'Subscales',  false],
          ].map(([id,lbl,chk])=>`
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:5px 10px;background:${chk?_C.amberFaint:_C.navy};border:1px solid ${chk?'rgba(212,168,67,0.3)':_C.border};border-radius:5px;transition:all 0.12s;"
            id="sa-exp-lbl-${id}">
            <input type="checkbox" id="sa-exp-fld-${id}" ${chk?'checked':''} onchange="_saResFieldToggle('${id}')"
              style="accent-color:${_C.amber};cursor:pointer;"/>
            <span style="font-size:0.78rem;color:${chk?_C.amber:_C.muted};" id="sa-exp-fldtxt-${id}">${lbl}</span>
          </label>`).join('')}
        </div>
      </div>

      <div style="margin-top:18px;display:flex;gap:10px;align-items:center;">
        <button onclick="_saResExportPreview()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 18px;border-radius:7px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.borderB};color:${_C.cyan};">
          ◍ Preview
        </button>
        <button onclick="_saResExportDownload()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 20px;border-radius:7px;cursor:pointer;background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">
          ↓ Download
        </button>
        <div id="sa-exp-stat" style="margin-left:auto;font-size:0.88rem;color:${_C.dim};"></div>
      </div>
    </div>

    <!-- Info + preview -->
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Dataset Summary</div>
        <div style="display:flex;flex-direction:column;gap:0;margin-top:8px;">
          ${[
            ['MMAS-8 records', mmas.filter(r=>r.tool!=='map' && r.map_q1===undefined).length.toLocaleString(), _C.blue  ],
            ['MAP records',    mapInstr.length.toLocaleString(),                   _C.green ],
            ['PEACS records',  peacs.length.toLocaleString(),                      _C.purple],
            ['Countries',      new Set([...mmas,...peacs].map(r=>r.country).filter(c=>c&&c!=='Unknown')).size.toString(), _C.cyan],
            ['Workspaces',     Object.keys(_saCache.workspaces||{}).length.toString(), _C.amber],
          ].map(([lbl,val,col])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${_C.border};">
            <span style="font-size:0.84rem;color:${_C.muted};">${lbl}</span>
            <span style="font-size:0.84rem;font-weight:700;color:${col};">${val}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Export Notes</div>
        <div style="font-size:0.82rem;color:${_C.muted};line-height:1.7;margin-top:8px;">
          All exports are generated client-side from cached data.<br><br>
          <strong style="color:${_C.text};">Full anonymisation</strong> removes workspace identifiers and rounds timestamps to the nearest day.<br><br>
          <strong style="color:${_C.text};">Workspace coded</strong> replaces workspace names with sequential codes (WS_001, WS_002…) for de-identified linking.<br><br>
          Item responses are included only when the instrument stores individual item data (MMAS-8 and MAP).
        </div>
      </div>
    </div>
  </div>

  <!-- Preview table -->
  <div id="sa-exp-preview" style="margin-top:18px;"></div>`;

  _saResExportPreview();
}

function _saResFieldToggle(id) {
  const chk = document.getElementById('sa-exp-fld-' + id);
  const lbl = document.getElementById('sa-exp-lbl-' + id);
  const txt = document.getElementById('sa-exp-fldtxt-' + id);
  if (!chk) return;
  const on = chk.checked;
  if (lbl) { lbl.style.background = on ? _C.amberFaint : _C.navy; lbl.style.borderColor = on ? 'rgba(212,168,67,0.3)' : _C.border; }
  if (txt) txt.style.color = on ? _C.amber : _C.muted;
}

function _saResGetExportRecords() {
  const instSel = document.getElementById('sa-exp-inst')?.value || 'mmas';
  const dateSel = document.getElementById('sa-exp-date')?.value || 'all';
  const dateTs  = dateSel !== 'all' ? Date.now() - (+dateSel * 86400000) : 0;

  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  let records = [];

  if (instSel === 'mmas' || instSel === 'all')
    records.push(...mmas.filter(r => r.tool !== 'map' && r.map_q1===undefined && (r.timestamp||0) >= dateTs).map(r => ({...r, _inst:'mmas'})));
  if (instSel === 'map' || instSel === 'all')
    records.push(...mmas.filter(r => (r.tool === 'map' || r.map_q1 !== undefined) && (r.timestamp||0) >= dateTs).map(r => ({...r, _inst:'map'})));
  if (instSel === 'peacs' || instSel === 'all')
    records.push(...peacs.filter(r => (r.timestamp||0) >= dateTs).map(r => ({...r, _inst:'peacs'})));

  return records;
}

function _saResBuildRow(r, fields, anonMode, wsCodeMap) {
  const inst = r._inst || 'mmas';
  const normScore = inst === 'mmas' ? (r.score||0)/8 : inst === 'map' ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3) : (r.pe!=null?+r.pe:0);
  const rawScore  = inst === 'mmas' ? (r.score||0) : normScore;
  const tier = inst === 'mmas'
    ? (rawScore >= 7 ? 'High' : rawScore >= 6 ? 'Medium' : 'Low')
    : (normScore >= 0.85 ? 'Optimal' : normScore >= 0.70 ? 'Good' : normScore >= 0.55 ? 'Moderate' : 'Poor');

  const wsRaw = r.institution_code || r.workspace || '';
  const ws = anonMode === 'full' ? '' : anonMode === 'coded' ? (wsCodeMap[wsRaw] || '') : wsRaw;
  const ts = r.timestamp ? (anonMode === 'full'
    ? new Date(Math.floor(r.timestamp/86400000)*86400000).toISOString().slice(0,10)
    : new Date(r.timestamp).toISOString()) : '';

  const row = { instrument: inst.toUpperCase() };
  if (fields.score)     row.score      = rawScore;
  if (fields.norm)      row.norm_score = normScore.toFixed(4);
  if (fields.tier)      row.tier       = tier;
  if (fields.timestamp) row.date       = ts;
  if (fields.country)   row.country    = r.country || '';
  if (fields.workspace && anonMode !== 'full') row.workspace = ws;

  if (fields.items) {
    if (inst === 'mmas') {
      for (let i=1;i<=8;i++) row[`q${i}`] = r[`q${i}`]!=null ? +r[`q${i}`] : '';
    } else if (inst === 'map') {
      for (let i=1;i<=8;i++) row[`map_q${i}`] = r[`map_q${i}`]!=null ? +r[`map_q${i}`] : '';
    }
  }
  if (fields.subscales) {
    if (inst === 'map') {
      row.arch_score = r.arch_score!=null ? (+r.arch_score).toFixed(4) : '';
      row.exec_score = r.exec_score!=null ? (+r.exec_score).toFixed(4) : '';
      row.ctx_score  = r.ctx_score!=null  ? (+r.ctx_score).toFixed(4)  : '';
      row.pe_score   = r.map_q1!==undefined ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3).toFixed(4) : '';
    } else if (inst === 'peacs') {
      row.base   = r.base!=null  ? (+r.base).toFixed(4)  : '';
      row.mvmt   = r.mvmt!=null  ? (+r.mvmt).toFixed(4)  : '';
      row.strata = r.strata!=null? (+r.strata).toFixed(4): '';
    }
  }
  return row;
}

function _saResGetFields() {
  return {
    score:     !!(document.getElementById('sa-exp-fld-score')?.checked),
    norm:      !!(document.getElementById('sa-exp-fld-norm')?.checked),
    tier:      !!(document.getElementById('sa-exp-fld-tier')?.checked),
    timestamp: !!(document.getElementById('sa-exp-fld-timestamp')?.checked),
    country:   !!(document.getElementById('sa-exp-fld-country')?.checked),
    workspace: !!(document.getElementById('sa-exp-fld-workspace')?.checked),
    items:     !!(document.getElementById('sa-exp-fld-items')?.checked),
    subscales: !!(document.getElementById('sa-exp-fld-subscales')?.checked),
  };
}

function _saResBuildDataset() {
  const records  = _saResGetExportRecords();
  const fields   = _saResGetFields();
  const anonMode = document.getElementById('sa-exp-anon')?.value || 'full';

  // Build workspace code map
  const wsNames  = [...new Set(records.map(r=>r.institution_code||r.workspace||'').filter(Boolean))].sort();
  const wsCodeMap = Object.fromEntries(wsNames.map((ws,i)=>[ws,`WS_${String(i+1).padStart(3,'0')}`]));

  return records.map(r => _saResBuildRow(r, fields, anonMode, wsCodeMap));
}

function _saResExportPreview() {
  const preview = document.getElementById('sa-exp-preview');
  const stat    = document.getElementById('sa-exp-stat');
  const rows    = _saResBuildDataset();
  if (stat) stat.textContent = rows.length.toLocaleString() + ' records selected';
  if (!preview) return;

  if (!rows.length) {
    preview.innerHTML = `<div class="sa-panel" style="color:${_C.dim};font-size:0.90rem;">No records match the current filters.</div>`;
    return;
  }

  const cols = Object.keys(rows[0]);
  const sample = rows.slice(0, 8);

  preview.innerHTML = `
  <div class="sa-panel" style="padding:0;overflow:hidden;">
    <div style="padding:12px 16px;border-bottom:1px solid ${_C.border};">
      <div class="sa-section-eyebrow">Preview · First ${sample.length} of ${rows.length.toLocaleString()} rows</div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <thead><tr style="background:${_C.bg2};">
          ${cols.map(c=>`<th style="padding:7px 12px;text-align:left;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${c}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${sample.map(row=>`<tr style="border-bottom:1px solid ${_C.border};">
            ${cols.map(c=>`<td style="padding:6px 12px;color:${_C.muted};white-space:nowrap;">${_saEsc(String(row[c]??''))}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function _saResExportDownload() {
  const rows = _saResBuildDataset();
  const fmt  = document.getElementById('sa-exp-fmt')?.value || 'csv';
  const inst = document.getElementById('sa-exp-inst')?.value || 'mmas';
  const stat = document.getElementById('sa-exp-stat');

  if (!rows.length) { if (stat) stat.innerHTML = `<span style="color:#f97316;">No records to export.</span>`; return; }

  let content, mime, ext;
  const cols = Object.keys(rows[0]);

  if (fmt === 'json') {
    content = JSON.stringify(rows, null, 2);
    mime = 'application/json'; ext = 'json';
  } else if (fmt === 'tsv') {
    const sep = '\t';
    content = [cols.join(sep), ...rows.map(r=>cols.map(c=>String(r[c]??'')).join(sep))].join('\n');
    mime = 'text/tab-separated-values'; ext = 'tsv';
  } else {
    const esc = v => { const s=String(v??''); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:''; };
    content = [cols.join(','), ...rows.map(r=>cols.map(c=>{const v=String(r[c]??'');return v.includes(',')||v.includes('"')?`"${v.replace(/"/g,'""')}"`:v;}).join(','))].join('\n');
    mime = 'text/csv'; ext = 'csv';
  }

  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `ATLAS_${inst.toUpperCase()}_${date}.${ext}`;
  a.click(); URL.revokeObjectURL(url);
  if (stat) stat.innerHTML = `<span style="color:${_C.green};">✓ Downloaded ${rows.length.toLocaleString()} rows.</span>`;
}

// ── GROUP ANALYSIS ────────────────────────────────────────────────────────────

function _saResRenderAnalysis(body) {
  body.innerHTML = `
  <div style="display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start;">

    <!-- Controls -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Analysis Settings</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;">

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Instrument</div>
          <select id="sa-ana-inst"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="mmas">MMAS-8</option>
            <option value="peacs">PEACS</option>
          </select>
        </div>

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Group By</div>
          <select id="sa-ana-group"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="workspace">Workspace</option>
            <option value="country">Country</option>
            <option value="tier">Adherence Tier</option>
            <option value="period">Time Period (30d vs prior 30d)</option>
          </select>
        </div>

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Test</div>
          <select id="sa-ana-test"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="descriptive">Descriptive Statistics</option>
            <option value="ttest">Welch's t-test (two groups)</option>
            <option value="mannwhitney">Mann-Whitney U (two groups)</option>
            <option value="anova">One-way ANOVA (all groups)</option>
          </select>
        </div>

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Min Group N</div>
          <input id="sa-ana-minn" type="number" value="5" min="1"
            style="width:100%;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;box-sizing:border-box;"/>
        </div>

        <button onclick="_saResRunAnalysis()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 14px;border-radius:7px;cursor:pointer;
                 background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">
          ◬ Run Analysis
        </button>
      </div>
    </div>

    <!-- Results -->
    <div id="sa-ana-results">
      <div class="sa-panel" style="display:flex;align-items:center;justify-content:center;height:300px;flex-direction:column;gap:10px;">
        <div style="font-size:1.5rem;opacity:0.15;">◬</div>
        <div style="font-size:0.90rem;color:${_C.dim};">Configure settings and click Run Analysis.</div>
      </div>
    </div>
  </div>`;
}

// Stats helpers
function _resMean(a) { return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
function _resSD(a)   { const m=_resMean(a); return a.length>1?Math.sqrt(a.reduce((s,v)=>s+Math.pow(v-m,2),0)/(a.length-1)):0; }
function _resMedian(a) { const s=[...a].sort((x,y)=>x-y),n=s.length; return n%2===0?(s[n/2-1]+s[n/2])/2:s[Math.floor(n/2)]; }

// Normal CDF approximation (Abramowitz & Stegun)
function _resPhi(x) {
  const t = 1/(1+0.2316419*Math.abs(x));
  const d = 0.3989423*Math.exp(-x*x/2);
  const p = d*t*(0.3193815+t*(-0.3565638+t*(1.7814779+t*(-1.8212560+t*1.3302744))));
  return x > 0 ? 1 - p : p;
}

function _resTTest(a, b) {
  const n1=a.length,n2=b.length;
  if(n1<2||n2<2) return {t:null,p:null,df:null};
  const m1=_resMean(a),m2=_resMean(b);
  const v1=_resSD(a)**2,v2=_resSD(b)**2;
  const se=Math.sqrt(v1/n1+v2/n2);
  if(se===0) return {t:0,p:1,df:n1+n2-2};
  const t=(m1-m2)/se;
  // Welch-Satterthwaite df
  const df=Math.pow(v1/n1+v2/n2,2)/(Math.pow(v1/n1,2)/(n1-1)+Math.pow(v2/n2,2)/(n2-1));
  // p-value using normal approx for large df, or beta approx
  const p = df > 30 ? 2*(1-_resPhi(Math.abs(t))) : _resPFromT(Math.abs(t), df);
  return {t,p,df};
}

function _resPFromT(t, df) {
  // Regularized incomplete beta approximation
  const x = df/(df+t*t);
  const a = df/2, b2 = 0.5;
  // Use normal approx for moderate df
  if (df > 10) return 2*(1-_resPhi(t*(1-1/(4*df))/Math.sqrt(1+t*t/(2*df))));
  // Simple approximation
  return Math.min(1, 2*Math.exp(-0.717*t - 0.416*t*t/df));
}

function _resMannWhitney(a, b) {
  const n1=a.length,n2=b.length;
  if(n1<2||n2<2) return {U:null,z:null,p:null};
  // Rank all values combined
  const all=[...a.map(v=>({v,g:0})),...b.map(v=>({v,g:1}))].sort((x,y)=>x.v-y.v);
  let r=1;
  while(r<=all.length){
    let r2=r;
    while(r2<all.length&&all[r2].v===all[r-1].v) r2++;
    const avgR=(r+r2)/2;
    for(let i=r-1;i<r2;i++) all[i].rank=avgR;
    r=r2+1;
  }
  const R1=all.filter(x=>x.g===0).reduce((s,x)=>s+x.rank,0);
  const U1=R1-n1*(n1+1)/2;
  const U=Math.min(U1,n1*n2-U1);
  const mu=n1*n2/2;
  const sigma=Math.sqrt(n1*n2*(n1+n2+1)/12);
  const z=(U-mu)/sigma;
  const p=2*(1-_resPhi(Math.abs(z)));
  return {U,z,p};
}

function _resANOVA(groups) {
  const allVals=groups.flatMap(g=>g.vals);
  const grandMean=_resMean(allVals);
  const N=allVals.length, k=groups.length;
  const SSB=groups.reduce((s,g)=>s+g.vals.length*Math.pow(_resMean(g.vals)-grandMean,2),0);
  const SSW=groups.reduce((s,g)=>s+g.vals.reduce((s2,v)=>s2+Math.pow(v-_resMean(g.vals),2),0),0);
  const dfB=k-1, dfW=N-k;
  if(dfB<1||dfW<1||SSW===0) return {F:null,p:null,eta2:null};
  const F=(SSB/dfB)/(SSW/dfW);
  // p-value: normal approximation via Fisher's F
  const p=Math.max(0,Math.min(1,Math.exp(-0.5*(F-1)*dfB)));
  const eta2=SSB/(SSB+SSW);
  return {F,p,eta2,dfB,dfW};
}

function _saResRunAnalysis() {
  const instSel  = document.getElementById('sa-ana-inst')?.value  || 'mmas';
  const groupSel = document.getElementById('sa-ana-group')?.value || 'workspace';
  const testSel  = document.getElementById('sa-ana-test')?.value  || 'descriptive';
  const minN     = +(document.getElementById('sa-ana-minn')?.value||5);
  const results  = document.getElementById('sa-ana-results');
  if (!results) return;

  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const raw   = instSel === 'mmas' ? mmas.filter(r=>r.tool!=='map' && r.map_q1===undefined) : peacs;
  const toScore = r => instSel === 'mmas' ? (r.score||0)/8 : (r.pe!=null?+r.pe:r.pe_score!=null?+r.pe_score:0);

  // Build groups
  let groups = [];
  const now = Date.now();

  if (groupSel === 'workspace') {
    const wsMap = {};
    raw.forEach(r => {
      const ws = r.institution_code || r.workspace || 'Unknown';
      if (!wsMap[ws]) wsMap[ws] = [];
      wsMap[ws].push(toScore(r));
    });
    groups = Object.entries(wsMap).map(([name,vals])=>({name,vals})).filter(g=>g.vals.length>=minN).sort((a,b)=>_resMean(b.vals)-_resMean(a.vals));
  } else if (groupSel === 'country') {
    const cMap = {};
    raw.forEach(r => {
      const c = r.country || 'Unknown';
      if (!cMap[c]) cMap[c] = [];
      cMap[c].push(toScore(r));
    });
    groups = Object.entries(cMap).map(([name,vals])=>({name,vals})).filter(g=>g.vals.length>=minN).sort((a,b)=>_resMean(b.vals)-_resMean(a.vals));
  } else if (groupSel === 'tier') {
    const tiers = { 'High (≥0.85)':[], 'Medium (0.55–0.85)':[], 'Low (<0.55)':[] };
    raw.forEach(r => {
      const s=toScore(r);
      if(s>=0.85) tiers['High (≥0.85)'].push(s);
      else if(s>=0.55) tiers['Medium (0.55–0.85)'].push(s);
      else tiers['Low (<0.55)'].push(s);
    });
    groups = Object.entries(tiers).map(([name,vals])=>({name,vals})).filter(g=>g.vals.length>=minN);
  } else if (groupSel === 'period') {
    const recent = raw.filter(r=>(r.timestamp||0)>=now-30*86400000).map(toScore);
    const prior  = raw.filter(r=>(r.timestamp||0)>=now-60*86400000&&(r.timestamp||0)<now-30*86400000).map(toScore);
    groups = [{name:'Last 30 days',vals:recent},{name:'Prior 30 days',vals:prior}].filter(g=>g.vals.length>=minN);
  }

  if (!groups.length) {
    results.innerHTML = `<div class="sa-panel" style="color:${_C.dim};padding:30px;text-align:center;">No groups meet the minimum N=${minN} threshold.</div>`;
    return;
  }

  // Descriptive table (always shown)
  const descHTML = `
  <div class="sa-panel" style="padding:0;overflow:hidden;margin-bottom:18px;">
    <div style="padding:12px 16px;border-bottom:1px solid ${_C.border};">
      <div class="sa-section-eyebrow">Descriptive Statistics · ${instSel.toUpperCase()} by ${groupSel} (${groups.length} groups)</div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:${_C.bg2};">
          ${['Group','N','Mean','SD','Median','Min','Max','High%','Low%'].map(h=>
            `<th style="padding:9px 14px;text-align:left;font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>
          ${groups.map((g,i)=>{
            const mean=_resMean(g.vals),sd=_resSD(g.vals),med=_resMedian(g.vals);
            const min=Math.min(...g.vals),max=Math.max(...g.vals);
            const hi=g.vals.filter(v=>v>=0.85).length/g.vals.length*100;
            const lo=g.vals.filter(v=>v<0.55).length/g.vals.length*100;
            const col=mean>=0.85?_C.green:mean>=0.55?_C.amber:_C.red;
            return `<tr style="border-bottom:1px solid ${_C.border};${i===0?'':''}transition:background 0.1s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
              <td style="padding:8px 14px;font-size:0.86rem;color:${_C.text};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_saEsc(g.name)}">${_saEsc(g.name.slice(0,28)+(g.name.length>28?'…':''))}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${g.vals.length.toLocaleString()}</td>
              <td style="padding:8px 14px;font-size:0.90rem;font-weight:700;color:${col};">${mean.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${sd.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${med.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.82rem;color:${_C.dim};">${min.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.82rem;color:${_C.dim};">${max.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.green};">${hi.toFixed(1)}%</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.red};">${lo.toFixed(1)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // Inference test
  let testHTML = '';
  if (testSel === 'ttest' || testSel === 'mannwhitney') {
    if (groups.length < 2) {
      testHTML = `<div class="sa-panel" style="color:${_C.dim};">Need at least 2 groups for comparison tests.</div>`;
    } else {
      // Run pairwise for top 2 groups (or all pairs if ≤4 groups)
      const pairs = [];
      for (let i=0;i<Math.min(groups.length,4);i++)
        for (let j=i+1;j<Math.min(groups.length,4);j++) pairs.push([i,j]);

      const rows = pairs.map(([i,j]) => {
        const A=groups[i], B=groups[j];
        const mA=_resMean(A.vals),mB=_resMean(B.vals);
        const poolSD=Math.sqrt((_resSD(A.vals)**2+_resSD(B.vals)**2)/2)||0.001;
        const cohD=(mA-mB)/poolSD;
        const dLbl=Math.abs(cohD)<0.2?'Negligible':Math.abs(cohD)<0.5?'Small':Math.abs(cohD)<0.8?'Medium':'Large';
        let stat='', p=null;
        if (testSel==='ttest') {
          const r=_resTTest(A.vals,B.vals);
          stat=r.t!=null?`t(${r.df.toFixed(0)}) = ${r.t.toFixed(3)}`:'—';
          p=r.p;
        } else {
          const r=_resMannWhitney(A.vals,B.vals);
          stat=r.z!=null?`U = ${r.U.toFixed(0)}, z = ${r.z.toFixed(3)}`:'—';
          p=r.p;
        }
        const sig = p!=null?(p<0.001?'***':p<0.01?'**':p<0.05?'*':'ns'):'—';
        const pCol = p!=null?(p<0.05?_C.green:_C.dim):_C.dim;
        return `<tr style="border-bottom:1px solid ${_C.border};transition:background 0.1s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
          <td style="padding:8px 14px;font-size:0.84rem;color:${_C.amber};">${_saEsc(A.name.slice(0,20)+(A.name.length>20?'…':''))}</td>
          <td style="padding:8px 14px;font-size:0.84rem;color:${_C.cyan};">${_saEsc(B.name.slice(0,20)+(B.name.length>20?'…':''))}</td>
          <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${stat}</td>
          <td style="padding:8px 14px;font-size:0.90rem;font-weight:700;color:${pCol};">${p!=null?p.toFixed(4):'—'}</td>
          <td style="padding:8px 14px;font-size:0.84rem;font-weight:700;color:${pCol};">${sig}</td>
          <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${cohD.toFixed(3)}</td>
          <td style="padding:8px 14px;font-size:0.82rem;color:${_C.dim};">${dLbl}</td>
        </tr>`;
      }).join('');

      testHTML = `
      <div class="sa-panel" style="padding:0;overflow:hidden;margin-bottom:18px;">
        <div style="padding:12px 16px;border-bottom:1px solid ${_C.border};">
          <div class="sa-section-eyebrow">${testSel==='ttest'?"Welch's Independent t-test":'Mann-Whitney U Test'} · Pairwise Comparisons</div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:${_C.bg2};">
              ${['Group A','Group B','Statistic','p-value','Sig.','Cohen\'s d','Effect'].map(h=>
                `<th style="padding:9px 14px;text-align:left;font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
              ).join('')}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="padding:10px 16px;font-size:0.72rem;color:${_C.dim};">*** p<0.001 · ** p<0.01 · * p<0.05 · ns = not significant. p-values are approximate.</div>
      </div>`;
    }
  } else if (testSel === 'anova') {
    const res = _resANOVA(groups);
    if (res.F === null) {
      testHTML = `<div class="sa-panel" style="color:${_C.dim};">Insufficient variance for ANOVA.</div>`;
    } else {
      const pCol = res.p<0.05?_C.green:_C.dim;
      testHTML = `
      <div class="sa-panel" style="margin-bottom:18px;">
        <div class="sa-section-eyebrow">One-Way ANOVA Result</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;">
          ${[
            ['F-statistic',`F(${res.dfB},${res.dfW}) = ${res.F.toFixed(3)}`,res.F>3.8?_C.green:_C.muted],
            ['p-value',    res.p.toFixed(4),                                pCol],
            ['η² (eta²)',  res.eta2.toFixed(4),                             _C.amber],
            ['Effect Size',res.eta2<0.01?'Negligible':res.eta2<0.06?'Small':res.eta2<0.14?'Medium':'Large', _C.cyan],
          ].map(([lbl,val,col])=>`
          <div style="text-align:center;padding:12px;background:${_C.navy};border-radius:6px;">
            <div style="font-size:1.1rem;font-weight:700;color:${col};line-height:1;">${val}</div>
            <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-top:5px;">${lbl}</div>
          </div>`).join('')}
        </div>
        <div style="margin-top:12px;font-size:0.84rem;color:${_C.muted};line-height:1.7;">
          ${res.p<0.05
            ? `A significant difference in mean adherence scores was found across groups (F(${res.dfB},${res.dfW}) = ${res.F.toFixed(3)}, p = ${res.p.toFixed(4)}, η² = ${res.eta2.toFixed(3)}). The effect size is ${res.eta2<0.01?'negligible':res.eta2<0.06?'small':res.eta2<0.14?'medium':'large'}, indicating that group membership accounts for ${(res.eta2*100).toFixed(1)}% of variance in adherence scores.`
            : `No statistically significant difference was found across groups (F(${res.dfB},${res.dfW}) = ${res.F.toFixed(3)}, p = ${res.p.toFixed(4)}). p-values are approximate.`}
        </div>
      </div>`;
    }
  }

  // Mean comparison bar chart
  const barMax = Math.max(...groups.map(g=>_resMean(g.vals)), 0.01);
  const barChart = `
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Group Mean Comparison (normalised 0–1)</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
      ${groups.slice(0,20).map(g=>{
        const m=_resMean(g.vals);
        const col=m>=0.85?_C.green:m>=0.55?_C.amber:_C.red;
        return `<div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:0.80rem;color:${_C.muted};width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;" title="${_saEsc(g.name)}">${_saEsc(g.name.slice(0,22)+(g.name.length>22?'…':''))}</div>
          <div style="flex:1;height:16px;background:${_C.navy};border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${(m/barMax*100).toFixed(1)}%;background:${col};border-radius:3px;opacity:0.8;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:0.84rem;font-weight:700;color:${col};width:50px;text-align:right;">${m.toFixed(3)}</span>
          <span style="font-size:0.74rem;color:${_C.dim};width:36px;">N=${g.vals.length}</span>
        </div>`;
      }).join('')}
      ${groups.length>20?`<div style="font-size:0.78rem;color:${_C.dim};">… and ${groups.length-20} more groups</div>`:''}
    </div>
  </div>`;

  results.innerHTML = barChart + (testSel!=='descriptive'?testHTML:'') + descHTML;
}

// ── STUDY REGISTRY ────────────────────────────────────────────────────────────

let _saResStudies = null; // cached from Firebase

// Condition list shared with the meta-analysis filter
const _SA_CONDITIONS = [
  'Hypertension','Type 2 Diabetes','HIV/AIDS','Heart Failure','Asthma / COPD',
  'Cancer','Mental Health / Psychiatry','Chronic Kidney Disease','Dyslipidemia',
  'Osteoporosis','Rheumatoid Arthritis','Epilepsy','Anticoagulation','Transplant',
  'Tuberculosis','Malaria','Antiretroviral Therapy','Contraception','Pain Management',
  'Polypharmacy (≥5 medications)','Other',
];

function _saResGenerateAtlasId() {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 9000) + 1000);
  return `ATLAS-${year}-${seq}`;
}

function _saResRenderRegistry(body) {
  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start;">

    <!-- Study list -->
    <div>
      <div class="sa-panel" style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="sa-section-eyebrow" style="margin-bottom:0;">Registered Studies</div>
          <div style="display:flex;gap:8px;">
            <select id="sa-reg-filter-status" onchange="_saResRenderStudyList()"
              style="background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};font-family:'IBM Plex Mono',monospace;
                     font-size:0.76rem;padding:4px 8px;border-radius:5px;outline:none;">
              <option value="all">All status</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="analysis">Analysis</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
            <select id="sa-reg-filter-cond" onchange="_saResRenderStudyList()"
              style="background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};font-family:'IBM Plex Mono',monospace;
                     font-size:0.76rem;padding:4px 8px;border-radius:5px;outline:none;">
              <option value="all">All conditions</option>
              ${_SA_CONDITIONS.map(c=>`<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="sa-reg-list">
          <div style="font-size:0.90rem;color:${_C.dim};">Loading…</div>
        </div>
      </div>
    </div>

    <!-- Add / pre-registration form -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Pre-Register Study</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin:6px 0 14px;line-height:1.5;">
        Register your hypothesis and design <em>before</em> data collection.
        Pre-registration timestamp is locked when you set status to Active.
      </div>
      <div style="display:flex;flex-direction:column;gap:11px;">
        ${[
          ['sa-reg-title',  'Study Title *',              'text',   'e.g. MMAS-8 Validation in Hypertension'],
          ['sa-reg-pi',     'Principal Investigator *',   'text',   'e.g. Dr. J. Smith'],
          ['sa-reg-inst',   'Institution / Affiliation',  'text',   'e.g. UCLA School of Pharmacy'],
          ['sa-reg-irb',    'IRB / Ethics Number',        'text',   'e.g. IRB-2026-001'],
          ['sa-reg-ct',     'ClinicalTrials.gov ID',      'text',   'e.g. NCT12345678'],
          ['sa-reg-start',  'Start Date',                 'date',   ''],
          ['sa-reg-end',    'End Date (projected)',        'date',   ''],
          ['sa-reg-n',      'Target Sample Size (n)',     'number', 'e.g. 150'],
        ].map(([id,lbl,type,ph])=>`
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">${lbl}</div>
          <input id="${id}" type="${type}" placeholder="${ph}"
            style="width:100%;box-sizing:border-box;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.84rem;padding:7px 10px;border-radius:6px;outline:none;"
            ${type==='number'?'min="1"':''}/>
        </div>`).join('')}
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">Condition Focus</div>
          <select id="sa-reg-cond" multiple size="4"
            style="width:100%;box-sizing:border-box;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:6px 8px;border-radius:6px;outline:none;">
            ${_SA_CONDITIONS.map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
          <div style="font-size:0.72rem;color:${_C.dim};margin-top:3px;">Hold Ctrl/Cmd to select multiple.</div>
        </div>
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">Status</div>
          <select id="sa-reg-status"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;padding:7px 10px;border-radius:6px;outline:none;">
            <option value="planning">Planning (pre-registration)</option>
            <option value="active">Active — data collection</option>
            <option value="analysis">Analysis</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">Instruments</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${[['inst-mmas','MMAS-8'],['inst-map','MAP'],['inst-peacs','PEACS']].map(([id,lbl])=>`
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.80rem;color:${_C.muted};padding:4px 8px;background:${_C.navy};border:1px solid ${_C.border};border-radius:4px;">
              <input type="checkbox" id="sa-reg-${id}" style="accent-color:${_C.amber};cursor:pointer;"/> ${lbl}
            </label>`).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">Primary Hypothesis <span style="color:${_C.dim};font-style:italic;">(locked at activation)</span></div>
          <textarea id="sa-reg-hypothesis" rows="2" placeholder="e.g. MMAS-8 scores will be significantly lower in patients with comorbid depression…"
            style="width:100%;box-sizing:border-box;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:7px 10px;border-radius:6px;outline:none;resize:vertical;"></textarea>
        </div>
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:3px;">Notes / DUA</div>
          <textarea id="sa-reg-notes" rows="2" placeholder="Data use agreement notes, exclusion criteria, co-investigators…"
            style="width:100%;box-sizing:border-box;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:7px 10px;border-radius:6px;outline:none;resize:vertical;"></textarea>
        </div>
        <button onclick="_saResAddStudy()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 16px;border-radius:7px;cursor:pointer;
                 background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">
          + Pre-Register Study
        </button>
        <div id="sa-reg-status-msg" style="font-size:0.84rem;color:${_C.dim};min-height:18px;"></div>
      </div>
    </div>
  </div>`;

  _saResLoadStudies();
}

async function _saResLoadStudies() {
  const list = document.getElementById('sa-reg-list');
  if (list) list.innerHTML = `<div style="font-size:0.88rem;color:${_C.dim};">Loading…</div>`;
  try {
    const db = window.firebase?.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
    if (!db) throw new Error('no db');
    const snap = await db.ref('research_studies').orderByChild('created').once('value');
    _saResStudies = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,_key:k})).reverse() : [];
  } catch(e) {
    _saResStudies = [];
  }
  _saResRenderStudyList();
}

function _saResRenderStudyList() {
  const list = document.getElementById('sa-reg-list');
  if (!list) return;
  const studies = _saResStudies || [];

  const filterStatus = document.getElementById('sa-reg-filter-status')?.value || 'all';
  const filterCond   = document.getElementById('sa-reg-filter-cond')?.value   || 'all';

  const filtered = studies.filter(s => {
    const statusOk = filterStatus === 'all' || s.status === filterStatus;
    const condOk   = filterCond   === 'all' || (s.conditions || []).includes(filterCond);
    return statusOk && condOk;
  });

  if (!filtered.length) {
    list.innerHTML = `<div style="font-size:0.88rem;color:${_C.dim};font-style:italic;padding:16px 0;">${
      studies.length ? 'No studies match the selected filters.' : 'No studies registered yet. Use the form to pre-register your first study.'
    }</div>`;
    return;
  }

  // Compute linked record counts from cache
  const allRecs = [...(_saCache.mmas||[]), ...(_saCache.peacs||[])];
  const statusCol = { planning:_C.dim, active:_C.green, analysis:_C.cyan, published:_C.amber, closed:'rgba(239,68,68,0.5)' };
  const statusLabel = { planning:'Planning', active:'Active', analysis:'Analysis', published:'Published', closed:'Closed' };

  list.innerHTML = filtered.map(s => {
    const linkedCount = s.atlas_id ? allRecs.filter(r => r.study_id === s.atlas_id).length : 0;
    const col = statusCol[s.status] || _C.dim;
    const preregLocked = !!s.prereg_locked_at;
    const preregDate = preregLocked ? new Date(s.prereg_locked_at).toLocaleDateString() : null;
    return `
  <div style="padding:14px 16px;background:${_C.navy};border:1px solid ${_C.border};border-radius:7px;margin-bottom:10px;border-left:3px solid ${col};">
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
      <div style="flex:1;">
        <div style="font-size:0.94rem;font-weight:700;color:${_C.text};margin-bottom:2px;">${_saEsc(s.title||'Untitled')}</div>
        <div style="font-size:0.78rem;color:${_C.muted};">PI: ${_saEsc(s.pi||'—')} · ${_saEsc(s.institution||'—')}</div>
        ${s.atlas_id?`<div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:${_C.amber};margin-top:3px;letter-spacing:0.1em;">${_saEsc(s.atlas_id)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <span style="font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;padding:2px 7px;border:1px solid ${col};border-radius:3px;color:${col};white-space:nowrap;">${statusLabel[s.status]||s.status||'—'}</span>
        ${linkedCount>0?`<span style="font-size:0.72rem;color:${_C.cyan};">◉ ${linkedCount} linked records</span>`:'<span style="font-size:0.72rem;color:${_C.dim};">0 linked records</span>'}
      </div>
    </div>
    <div style="display:flex;gap:10px;font-size:0.76rem;color:${_C.dim};flex-wrap:wrap;margin-bottom:8px;">
      ${s.irb?`<span>IRB: ${_saEsc(s.irb)}</span>`:''}
      ${s.clinicaltrials_id?`<span>ClinicalTrials: ${_saEsc(s.clinicaltrials_id)}</span>`:''}
      ${s.start?`<span>Start: ${s.start}</span>`:''}
      ${s.end?`<span>End: ${s.end}</span>`:''}
      ${s.target_n?`<span>Target n: ${s.target_n}</span>`:''}
    </div>
    ${s.conditions?.length?`
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
      ${s.conditions.map(c=>`<span style="font-size:0.70rem;padding:2px 7px;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.2);border-radius:3px;color:${_C.green};">${_saEsc(c)}</span>`).join('')}
    </div>`:''}
    ${preregLocked?`<div style="font-size:0.72rem;color:${_C.green};margin-bottom:6px;">✓ Pre-registered ${preregDate} — hypothesis locked</div>`:''}
    ${s.null_result?`<div style="font-size:0.72rem;color:#f97316;margin-bottom:6px;">◈ Null result flagged</div>`:''}
    ${s.doi?`<div style="font-size:0.78rem;color:${_C.amber};margin-bottom:6px;">Published · DOI: ${_saEsc(s.doi)}</div>`:''}
    ${s.hypothesis?`<div style="font-size:0.78rem;color:${_C.muted};margin-bottom:6px;font-style:italic;">"${_saEsc(s.hypothesis.slice(0,120)+(s.hypothesis.length>120?'…':''))}"</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${s.instruments?.length?`<span style="font-size:0.72rem;color:${_C.dim};">Instruments: ${s.instruments.join(', ')}</span>`:''}
      <button onclick="_saResEditStudyStatus('${s._key}','${s.status||'planning'}')"
        style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;text-transform:uppercase;
               padding:3px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.muted};">Update Status</button>
      <button onclick="_saResDeleteStudy('${s._key}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;text-transform:uppercase;
               padding:3px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid rgba(239,68,68,0.25);color:rgba(239,68,68,0.5);">Delete</button>
    </div>
  </div>`;
  }).join('');
}

async function _saResAddStudy() {
  const msg = document.getElementById('sa-reg-status-msg');
  const status = document.getElementById('sa-reg-status')?.value || 'planning';
  const conditions = Array.from(document.getElementById('sa-reg-cond')?.selectedOptions || []).map(o => o.value).filter(Boolean);
  const study = {
    title:            (document.getElementById('sa-reg-title')?.value||'').trim(),
    pi:               (document.getElementById('sa-reg-pi')?.value||'').trim(),
    institution:      (document.getElementById('sa-reg-inst')?.value||'').trim(),
    irb:              (document.getElementById('sa-reg-irb')?.value||'').trim(),
    clinicaltrials_id:(document.getElementById('sa-reg-ct')?.value||'').trim(),
    start:            document.getElementById('sa-reg-start')?.value||'',
    end:              document.getElementById('sa-reg-end')?.value||'',
    target_n:         parseInt(document.getElementById('sa-reg-n')?.value||'0')||null,
    status,
    conditions,
    instruments:      ['mmas','map','peacs'].filter(i=>document.getElementById('sa-reg-inst-'+i)?.checked),
    hypothesis:       (document.getElementById('sa-reg-hypothesis')?.value||'').trim(),
    notes:            (document.getElementById('sa-reg-notes')?.value||'').trim(),
    atlas_id:         _saResGenerateAtlasId(),
    created:          Date.now(),
    prereg_locked_at: status === 'active' ? Date.now() : null,
  };
  if (!study.title) { if(msg)msg.innerHTML=`<span style="color:#f97316;">Study title is required.</span>`; return; }
  if (!study.pi)    { if(msg)msg.innerHTML=`<span style="color:#f97316;">Principal Investigator is required.</span>`; return; }
  try {
    const db = typeof database !== 'undefined' ? database : null;
    if (!db) throw new Error('no db');
    if(msg)msg.innerHTML=`<span style="color:${_C.dim};">Saving…</span>`;
    await db.ref('research_studies').push(study);
    if(msg)msg.innerHTML=`<span style="color:${_C.green};">✓ Study pre-registered · ID: ${study.atlas_id}</span>`;
    ['sa-reg-title','sa-reg-pi','sa-reg-inst','sa-reg-irb','sa-reg-ct','sa-reg-start','sa-reg-end','sa-reg-n','sa-reg-hypothesis','sa-reg-notes'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.value='';
    });
    ['inst-mmas','inst-map','inst-peacs'].forEach(id=>{const el=document.getElementById('sa-reg-'+id);if(el)el.checked=false;});
    const condEl = document.getElementById('sa-reg-cond');
    if (condEl) Array.from(condEl.options).forEach(o=>o.selected=false);
    _saResLoadStudies();
  } catch(e){
    if(msg)msg.innerHTML=`<span style="color:${_C.red};">Save failed: ${e.message}</span>`;
  }
}

async function _saResEditStudyStatus(key, currentStatus) {
  const study = (_saResStudies||[]).find(s=>s._key===key);
  if (!study) return;

  // Build update modal inline
  const modal = document.createElement('div');
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:99999;display:flex;align-items:center;justify-content:center;`;
  const isDark = document.body.dataset.theme !== 'light';
  modal.innerHTML = `
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:12px;padding:24px 28px;width:420px;max-width:95vw;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:8px;">Update Study</div>
    <div style="font-size:1.0rem;font-weight:700;color:${_C.text};margin-bottom:16px;">${_saEsc(study.title||'Untitled')}</div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Status</div>
        <select id="sreg-edit-status" style="width:100%;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.88rem;padding:8px 10px;border-radius:6px;outline:none;">
          ${['planning','active','analysis','published','closed'].map(s=>`<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div id="sreg-doi-row" style="${currentStatus!=='published'?'display:none':''}">
        <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Publication DOI</div>
        <input id="sreg-edit-doi" type="text" value="${_saEsc(study.doi||'')}" placeholder="e.g. 10.1111/j.1234.5678"
          style="width:100%;box-sizing:border-box;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.84rem;padding:7px 10px;border-radius:6px;outline:none;"/>
      </div>
      <div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.84rem;color:${_C.muted};">
          <input type="checkbox" id="sreg-edit-null" ${study.null_result?'checked':''} style="accent-color:#f97316;cursor:pointer;"/>
          Flag as null / non-significant result
        </label>
        <div style="font-size:0.72rem;color:${_C.dim};margin-top:4px;margin-left:20px;">Null results are displayed in the Meta-Analysis panel to reduce publication bias.</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;">
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 16px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.muted};">Cancel</button>
      <button onclick="_saResSaveStudyUpdate('${key}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 18px;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">Save</button>
    </div>
  </div>`;
  modal.querySelector('#sreg-edit-status').addEventListener('change', function() {
    document.getElementById('sreg-doi-row').style.display = this.value === 'published' ? '' : 'none';
  });
  document.body.appendChild(modal);
  window._saRegEditKey = key;
}

async function _saResSaveStudyUpdate(key) {
  const newStatus  = document.getElementById('sreg-edit-status')?.value || 'planning';
  const doi        = (document.getElementById('sreg-edit-doi')?.value||'').trim();
  const nullResult = document.getElementById('sreg-edit-null')?.checked || false;
  const existing   = (_saResStudies||[]).find(s=>s._key===key);

  const updates = { status: newStatus, null_result: nullResult };
  if (doi) updates.doi = doi;

  // Lock pre-registration timestamp when moving to Active for the first time
  if (newStatus === 'active' && existing && !existing.prereg_locked_at) {
    updates.prereg_locked_at = Date.now();
  }

  try {
    const db = typeof database !== 'undefined' ? database : null;
    if (!db) throw new Error('no db');
    await db.ref('research_studies/'+key).update(updates);
    document.querySelector('[style*="position:fixed"][style*="z-index:99999"]')?.remove();
    _saResLoadStudies();
  } catch(e) { alert('Update failed: '+e.message); }
}

async function _saResDeleteStudy(key) {
  if (!confirm('Delete this study from the registry? This cannot be undone.')) return;
  try {
    const db = typeof database !== 'undefined' ? database : null;
    if (db) await db.ref('research_studies/'+key).remove();
    _saResLoadStudies();
  } catch(e) { alert('Delete failed: '+e.message); }
}

// ── META-ANALYSIS ─────────────────────────────────────────────────────────────

function _saResRenderMeta(body) {
  // Load studies from Firebase if not yet cached (e.g. Meta tab opened before Registry tab)
  if (_saResStudies === null) {
    body.innerHTML = `<div style="padding:40px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.dim};">Loading study registry…</div>`;
    const db = window.firebase?.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
    if (db) {
      db.ref('research_studies').orderByChild('created').once('value').then(snap => {
        _saResStudies = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,_key:k})).reverse() : [];
        _saResRenderMeta(body);
      }).catch(() => { _saResStudies = []; _saResRenderMeta(body); });
    } else {
      _saResStudies = [];
      _saResRenderMeta(body);
    }
    return;
  }
  const studies  = _saResStudies || [];
  const allRecs  = [...(_saCache.mmas||[]), ...(_saCache.peacs||[])];
  const mmasOnly = allRecs.filter(r => r.map_q1 === undefined && r.tool !== 'peacs');
  const mapRecs  = allRecs.filter(r => r.map_q1 !== undefined);
  const peacsRecs= (_saCache.peacs||[]);

  // ── Compute global population means for Cohen's d ─────────────────────────
  const globalMmasMean = mmasOnly.length ? mmasOnly.reduce((s,r)=>s+(+r.score||0),0)/mmasOnly.length : 0;
  const globalMmasSD   = mmasOnly.length > 1
    ? Math.sqrt(mmasOnly.reduce((s,r)=>s+Math.pow((+r.score||0)-globalMmasMean,2),0)/(mmasOnly.length-1)) : 1;

  // ── Build per-study rows ───────────────────────────────────────────────────
  const rows = studies.map(s => {
    const atlasId = s.atlas_id || '';
    const linked  = atlasId ? allRecs.filter(r => r.study_id === atlasId) : [];
    const n       = linked.length;
    if (!n) return { s, n:0, mean:null, sd:null, se:null, ciLo:null, ciHi:null, d:null };

    const scores  = linked.map(r => r.map_q1!==undefined ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3)*8 : +r.score||0);
    const mean    = scores.reduce((a,b)=>a+b,0)/n;
    const sd      = n > 1 ? Math.sqrt(scores.reduce((s,v)=>s+Math.pow(v-mean,2),0)/(n-1)) : 0;
    const se      = sd / Math.sqrt(n);
    const ciLo    = mean - 1.96*se;
    const ciHi    = mean + 1.96*se;
    // Cohen's d vs global MMAS-8 population mean
    const pooledSD= (globalMmasSD + (sd||globalMmasSD)) / 2;
    const d       = pooledSD > 0 ? (mean - globalMmasMean) / pooledSD : null;
    return { s, n, mean, sd, se, ciLo, ciHi, d };
  }).filter(r => r.n > 0 || r.s.status !== 'planning');

  // ── Bias indicators ───────────────────────────────────────────────────────
  const total        = studies.length;
  const preregCount  = studies.filter(s => s.prereg_locked_at).length;
  const publishedCount = studies.filter(s => s.status === 'published').length;
  const completedCount = studies.filter(s => ['published','closed','analysis'].includes(s.status)).length;
  const nullCount    = studies.filter(s => s.null_result).length;
  const publishedNull= studies.filter(s => s.status === 'published' && s.null_result).length;
  const publishRate  = completedCount > 0 ? Math.round(publishedCount/completedCount*100) : null;
  const preregRate   = total > 0 ? Math.round(preregCount/total*100) : null;
  const nullRate     = publishedCount > 0 ? Math.round(publishedNull/publishedCount*100) : null;

  // ── Forest plot scale ─────────────────────────────────────────────────────
  const validRows = rows.filter(r=>r.mean!=null);
  const allScores = validRows.map(r=>r.mean);
  const scaleMin  = Math.max(0, (allScores.length ? Math.min(...allScores) : 0) - 1);
  const scaleMax  = Math.min(8, (allScores.length ? Math.max(...allScores) : 8) + 1);
  const scaleRange= scaleMax - scaleMin || 8;

  // ── Condition filter ──────────────────────────────────────────────────────
  const allConds = [...new Set(studies.flatMap(s=>s.conditions||[]))].filter(Boolean).sort();

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 300px;gap:18px;align-items:start;">

    <!-- Forest plot -->
    <div>
      <div class="sa-panel" style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="sa-section-eyebrow" style="margin-bottom:0;">Forest Plot — ATLAS Study Registry</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="sa-meta-cond" onchange="_saResMetaFilter()"
              style="background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};font-family:'IBM Plex Mono',monospace;
                     font-size:0.76rem;padding:4px 8px;border-radius:5px;outline:none;">
              <option value="all">All conditions</option>
              ${allConds.map(c=>`<option value="${c}">${c}</option>`).join('')}
            </select>
            <button onclick="_saResExportForest()"
              style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;
                     padding:5px 12px;border-radius:5px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};">
              ↓ PRISMA CSV
            </button>
          </div>
        </div>

        ${rows.length === 0 ? `
        <div style="text-align:center;padding:40px 20px;color:${_C.dim};font-size:0.90rem;">
          No studies have linked records yet. Tag submissions with an ATLAS Study ID to populate this plot.
        </div>` : `

        <!-- Scale header -->
        <div style="display:grid;grid-template-columns:200px 1fr 80px 60px 70px;gap:8px;padding:6px 0;border-bottom:1px solid ${_C.border};margin-bottom:8px;">
          ${['Study','Effect (Mean ± 95% CI)','n','Mean','Cohen\'s d'].map(h=>`
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">${h}</div>`).join('')}
        </div>

        <div id="sa-meta-forest-rows">
        ${rows.map(row => {
          const s = row.s;
          const condMatch = (s.conditions||[]).join(';');
          const pctLo  = row.ciLo != null ? ((row.ciLo - scaleMin)/scaleRange*100).toFixed(1) : '0';
          const pctHi  = row.ciHi != null ? ((row.ciHi - scaleMin)/scaleRange*100).toFixed(1) : '0';
          const pctMid = row.mean != null ? ((row.mean  - scaleMin)/scaleRange*100).toFixed(1) : '0';
          const ciWidth= (parseFloat(pctHi)-parseFloat(pctLo)).toFixed(1);
          const dColor = row.d == null ? _C.dim : row.d > 0.5 ? _C.green : row.d < -0.5 ? _C.red : _C.amber;
          return `
          <div class="sa-meta-row" data-conditions="${_saEsc(condMatch)}"
            style="display:grid;grid-template-columns:200px 1fr 80px 60px 70px;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;">
            <div>
              <div style="font-size:0.82rem;font-weight:600;color:${_C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${_saEsc(s.title||'')}">${_saEsc((s.title||'Untitled').slice(0,28)+(s.title?.length>28?'…':''))}</div>
              <div style="font-size:0.70rem;color:${_C.dim};font-family:'IBM Plex Mono',monospace;">${_saEsc(s.atlas_id||'—')}</div>
              ${s.null_result?`<div style="font-size:0.68rem;color:#f97316;">● null result</div>`:''}
            </div>
            <div style="position:relative;height:20px;background:${_C.navy};border-radius:3px;">
              <!-- null-line at global mean -->
              <div style="position:absolute;left:${((globalMmasMean-scaleMin)/scaleRange*100).toFixed(1)}%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.12);"></div>
              ${row.mean != null ? `
              <!-- CI bar -->
              <div style="position:absolute;left:${pctLo}%;width:${ciWidth}%;top:7px;height:6px;background:rgba(78,156,245,0.25);border-radius:2px;"></div>
              <!-- diamond -->
              <div style="position:absolute;left:calc(${pctMid}% - 5px);top:5px;width:10px;height:10px;background:${_C.blue};transform:rotate(45deg);border-radius:1px;"></div>
              ` : `<div style="position:absolute;left:10px;top:4px;font-size:0.70rem;color:${_C.dim};font-family:'IBM Plex Mono',monospace;">no linked records</div>`}
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">${row.n}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">${row.mean!=null?row.mean.toFixed(2):'—'}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${dColor};">${row.d!=null?(row.d>0?'+':'')+row.d.toFixed(2):'—'}</div>
          </div>`;
        }).join('')}
        </div>

        <!-- Scale labels -->
        <div style="display:grid;grid-template-columns:200px 1fr 80px 60px 70px;gap:8px;margin-top:6px;">
          <div></div>
          <div style="position:relative;height:16px;">
            ${[0,25,50,75,100].map(p=>`
            <div style="position:absolute;left:${p}%;transform:translateX(-50%);font-family:'IBM Plex Mono',monospace;font-size:0.64rem;color:${_C.dim};">
              ${(scaleMin + (scaleRange*p/100)).toFixed(1)}
            </div>`).join('')}
          </div>
        </div>
        <div style="margin-top:8px;font-size:0.72rem;color:${_C.dim};line-height:1.5;">
          ◆ Diamond = study mean · Bar = 95% CI · Vertical line = global MMAS-8 population mean (${globalMmasMean.toFixed(2)}) · Cohen's d vs global mean
        </div>
        `}
      </div>

      <!-- Sequential analysis -->
      ${validRows.length > 0 ? `
      <div class="sa-panel">
        <div class="sa-section-eyebrow" style="margin-bottom:8px;">Sequential Analysis — Cumulative Effect Size</div>
        <div style="font-size:0.80rem;color:${_C.dim};margin-bottom:12px;line-height:1.5;">
          Tracks cumulative mean score as records accumulate over time. A stable flat line = robust estimate.
          An abrupt stop at a favorable result is a stopping-early bias signal.
        </div>
        <select id="sa-meta-seq-study" onchange="_saResRenderSequential()"
          style="background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};font-family:'IBM Plex Mono',monospace;
                 font-size:0.84rem;padding:7px 10px;border-radius:6px;outline:none;margin-bottom:14px;width:100%;">
          <option value="">— Select a study to view sequential plot —</option>
          ${validRows.map(r=>`<option value="${r.s.atlas_id}">${_saEsc(r.s.title||r.s.atlas_id)} (n=${r.n})</option>`).join('')}
        </select>
        <div id="sa-meta-seq-plot" style="min-height:80px;"></div>
      </div>` : ''}
    </div>

    <!-- Bias indicators -->
    <div style="display:flex;flex-direction:column;gap:14px;">

      <div class="sa-panel">
        <div class="sa-section-eyebrow" style="margin-bottom:10px;">Bias Indicators</div>
        ${[
          ['Pre-registration rate',   preregRate,   '%', preregRate>=80?_C.green:preregRate>=50?_C.amber:_C.red,
            'Studies that locked hypotheses before data collection. Below 80% indicates risk of post-hoc hypothesis framing (HARKing).'],
          ['Publication rate',        publishRate,  '%', publishRate>=70?_C.green:publishRate>=40?_C.amber:_C.red,
            'Completed/closed studies that published results. Below 50% suggests file-drawer effect — null results going unreported.'],
          ['Null result reporting',   nullRate, '%', nullRate!=null&&nullRate>=20?_C.green:nullRate!=null&&nullRate>=5?_C.amber:_C.red,
            'Share of published studies that flagged null or non-significant results. Low rates indicate publication bias favoring positive findings.'],
        ].map(([label, val, unit, col, note]) => `
        <div style="padding:12px 0;border-bottom:1px solid ${_C.border};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-size:0.80rem;color:${_C.text};font-weight:600;">${label}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:1.0rem;font-weight:700;color:${val!=null?col:_C.dim};">
              ${val!=null?val+'%':'—'}
            </div>
          </div>
          <div style="width:100%;height:4px;background:${_C.navy};border-radius:2px;margin-bottom:5px;">
            <div style="width:${val!=null?val:0}%;height:4px;background:${val!=null?col:_C.dim};border-radius:2px;transition:width 0.4s;"></div>
          </div>
          <div style="font-size:0.74rem;color:${_C.dim};line-height:1.5;">${note}</div>
        </div>`).join('')}
        <div style="padding-top:8px;font-size:0.76rem;color:${_C.dim};">
          Based on ${total} registered stud${total===1?'y':'ies'}.
          ${nullCount > 0 ? `${nullCount} null result${nullCount===1?' has':' have'} been flagged.` : 'No null results flagged yet — encourage researchers to flag non-significant outcomes.'}
        </div>
      </div>

      <div class="sa-panel">
        <div class="sa-section-eyebrow" style="margin-bottom:10px;">Registry Summary</div>
        ${[
          ['Total registered',   total,              _C.text  ],
          ['Pre-registered',     preregCount,        _C.green ],
          ['Active / collecting',studies.filter(s=>s.status==='active').length,   _C.cyan  ],
          ['In analysis',        studies.filter(s=>s.status==='analysis').length,  _C.amber ],
          ['Published',          publishedCount,     _C.amber ],
          ['Null results',       nullCount,          '#f97316'],
          ['Studies w/ data',    validRows.length,   _C.blue  ],
          ['Total linked records',validRows.reduce((s,r)=>s+r.n,0).toLocaleString(), _C.blue],
        ].map(([lbl,val,col])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid ${_C.border};">
          <span style="font-size:0.80rem;color:${_C.muted};">${lbl}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;font-weight:700;color:${col};">${val}</span>
        </div>`).join('')}
      </div>

      <div class="sa-panel">
        <div class="sa-section-eyebrow" style="margin-bottom:10px;">Bias Mitigation Guide</div>
        <div style="font-size:0.78rem;color:${_C.muted};line-height:1.75;">
          <div style="margin-bottom:6px;"><span style="color:${_C.green};">✓</span> <strong style="color:${_C.text};">Pre-register before collecting.</strong> ATLAS locks hypothesis + design timestamp when status → Active.</div>
          <div style="margin-bottom:6px;"><span style="color:${_C.green};">✓</span> <strong style="color:${_C.text};">Flag null results.</strong> Use "Update Status" → null result checkbox. Null results are shown in the forest plot.</div>
          <div style="margin-bottom:6px;"><span style="color:${_C.green};">✓</span> <strong style="color:${_C.text};">Register a ClinicalTrials.gov ID.</strong> External pre-registration combats outcome switching.</div>
          <div style="margin-bottom:6px;"><span style="color:${_C.green};">✓</span> <strong style="color:${_C.text};">Watch the sequential analysis.</strong> Stopping data collection early at a favorable mean is a bias signal.</div>
          <div><span style="color:${_C.green};">✓</span> <strong style="color:${_C.text};">Tag every submission.</strong> Enter the ATLAS Study ID in the assess.html SDoH field so records link automatically.</div>
        </div>
      </div>
    </div>
  </div>`;
}

function _saResMetaFilter() {
  const cond = document.getElementById('sa-meta-cond')?.value || 'all';
  document.querySelectorAll('.sa-meta-row').forEach(row => {
    const rowConds = row.dataset.conditions || '';
    row.style.display = (cond === 'all' || rowConds.includes(cond)) ? '' : 'none';
  });
}

function _saResRenderSequential() {
  const atlasId = document.getElementById('sa-meta-seq-study')?.value;
  const plot    = document.getElementById('sa-meta-seq-plot');
  if (!plot) return;
  if (!atlasId) { plot.innerHTML = ''; return; }

  const allRecs = [...(_saCache.mmas||[]), ...(_saCache.peacs||[])];
  const linked  = allRecs
    .filter(r => r.study_id === atlasId)
    .sort((a,b) => (a.timestamp||0) - (b.timestamp||0));

  if (!linked.length) { plot.innerHTML = `<div style="font-size:0.84rem;color:${_C.dim};padding:12px 0;">No linked records found.</div>`; return; }

  // Build cumulative mean series
  const points = linked.map((r, i) => {
    const subset = linked.slice(0, i+1);
    const scores = subset.map(r2 => r2.pe_score != null ? +r2.pe_score*8 : +r2.score||0);
    return { n: i+1, mean: scores.reduce((a,b)=>a+b,0)/scores.length, ts: r.timestamp };
  });

  const maxMean = Math.max(...points.map(p=>p.mean));
  const minMean = Math.min(...points.map(p=>p.mean));
  const yRange  = Math.max(maxMean - minMean, 0.5);
  const yPad    = yRange * 0.2;
  const yMin    = Math.max(0, minMean - yPad);
  const yMax    = Math.min(8, maxMean + yPad);
  const ySpan   = yMax - yMin || 1;

  const W = 100, H = 70; // percentage-based virtual canvas
  const pts = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length-1)) * W : W/2;
    const y = H - ((p.mean - yMin) / ySpan * H);
    return { x, y, p };
  });

  const pathD = pts.map((pt,i) => `${i===0?'M':'L'}${pt.x},${pt.y}`).join(' ');

  plot.innerHTML = `
  <div style="position:relative;width:100%;padding-bottom:45%;overflow:hidden;border-radius:6px;background:${_C.navy};">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
      <path d="${pathD}" fill="none" stroke="${_C.blue}" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
      ${pts.map(pt=>`<circle cx="${pt.x}" cy="${pt.y}" r="1.2" fill="${_C.blue}" vector-effect="non-scaling-stroke"/>`).join('')}
    </svg>
    <div style="position:absolute;top:4px;left:6px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${_C.dim};">
      Cumulative mean · n=1→${points.length} · Range: ${minMean.toFixed(2)}–${maxMean.toFixed(2)}
    </div>
    <div style="position:absolute;bottom:4px;right:6px;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${_C.dim};">
      Final mean: ${points[points.length-1].mean.toFixed(3)}
    </div>
  </div>`;
}

function _saResExportForest() {
  const studies  = _saResStudies || [];
  const allRecs  = [...(_saCache.mmas||[]), ...(_saCache.peacs||[])];
  const mmasOnly = allRecs.filter(r => r.map_q1 === undefined && r.tool !== 'peacs');
  const globalMmasMean = mmasOnly.length ? mmasOnly.reduce((s,r)=>s+(+r.score||0),0)/mmasOnly.length : 0;
  const globalMmasSD   = mmasOnly.length > 1
    ? Math.sqrt(mmasOnly.reduce((s,r)=>s+Math.pow((+r.score||0)-globalMmasMean,2),0)/(mmasOnly.length-1)) : 1;

  const rows = studies.map(s => {
    const atlasId = s.atlas_id || '';
    const linked  = atlasId ? allRecs.filter(r => r.study_id === atlasId) : [];
    const n       = linked.length;
    const scores  = linked.map(r => r.map_q1!==undefined ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3)*8 : +r.score||0);
    const mean    = n ? scores.reduce((a,b)=>a+b,0)/n : null;
    const sd      = n > 1 ? Math.sqrt(scores.reduce((s2,v)=>s2+Math.pow(v-mean,2),0)/(n-1)) : null;
    const se      = sd != null && n ? sd/Math.sqrt(n) : null;
    const ciLo    = mean != null && se != null ? mean - 1.96*se : null;
    const ciHi    = mean != null && se != null ? mean + 1.96*se : null;
    const pooledSD= ((sd||globalMmasSD)+globalMmasSD)/2;
    const d       = mean != null && pooledSD > 0 ? (mean-globalMmasMean)/pooledSD : null;
    return [
      s.atlas_id||'', s.title||'', s.pi||'', s.institution||'', s.irb||'',
      s.clinicaltrials_id||'', s.status||'', (s.conditions||[]).join('; '),
      n, mean!=null?mean.toFixed(4):'', sd!=null?sd.toFixed(4):'',
      se!=null?se.toFixed(4):'', ciLo!=null?ciLo.toFixed(4):'', ciHi!=null?ciHi.toFixed(4):'',
      d!=null?d.toFixed(4):'', s.prereg_locked_at?new Date(s.prereg_locked_at).toISOString().slice(0,10):'',
      s.null_result?'Yes':'No', s.doi||'',
    ];
  });

  const header = ['atlas_id','title','pi','institution','irb','clinicaltrials_id','status','conditions',
    'n','mean_score','sd','se','ci_lower','ci_upper','cohens_d','prereg_date','null_result','doi'];
  const csv = [header, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ATLAS_ForestPlot_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── CITATIONS ─────────────────────────────────────────────────────────────────

const _SA_REFS = [
  {
    instrument: 'MMAS-8',
    col: _C.blue,
    refs: [
      {
        authors: 'Morisky, D. E., Ang, A., Krousel-Wood, M., & Ward, H. J.',
        year: '2008',
        title: 'Predictive validity of a medication adherence measure in an outpatient setting.',
        journal: 'Journal of Clinical Hypertension, 10(5), 348–354.',
        doi: '10.1111/j.1751-7176.2008.07572.x',
        note: 'Original MMAS-8 validation paper. Establishes 3-tier scoring (Low <6, Medium 6, High 7–8) and predictive validity for blood pressure control.',
      },
      {
        authors: 'Krousel-Wood, M., Islam, T., Webber, L. S., Re, R. N., Morisky, D. E., & Muntner, P.',
        year: '2009',
        title: 'New medication adherence scale versus pharmacy fill rates in seniors with hypertension.',
        journal: 'American Journal of Managed Care, 15(1), 59–66.',
        doi: 'PMID 19146365',
        note: 'Validation in elderly hypertensive population. Demonstrates concordance between self-report MMAS-8 and pharmacy refill records.',
      },
      {
        authors: 'Tan, X., Patel, I., & Chang, J.',
        year: '2014',
        title: 'Review of the four item Morisky Medication Adherence Scale (MMAS-4) and eight item Morisky Medication Adherence Scale (MMAS-8).',
        journal: 'Innovations in Pharmacy, 5(3), 165.',
        doi: '10.24926/iip.v5i3.347',
        note: 'Systematic review of MMAS psychometric properties across conditions and populations.',
      },
    ],
  },
  {
    instrument: 'MAP',
    col: _C.green,
    refs: [
      {
        authors: 'Morisky, P. & ATLAS Research Group.',
        year: '2026',
        title: 'Medication Adherence Profile (MAP): Development and initial validation of a multidimensional adherence instrument.',
        journal: 'Manuscript in preparation.',
        doi: '',
        note: 'Foundational MAP instrument paper. Establishes Architecture (systems), Execution (behaviour), and Context (environment) subscales with geometric PE composite scoring.',
      },
    ],
  },
  {
    instrument: 'PEACS',
    col: _C.purple,
    refs: [
      {
        authors: 'ATLAS Research Group.',
        year: '2026',
        title: 'Patient Engagement and Adherence Composite Scale (PEACS): Technical manual and scoring guide.',
        journal: 'Internal ATLAS documentation. Version 1.0.',
        doi: '',
        note: 'PEACS composite scale specification. Defines Base, Movement, and Strata dimensions and geometric PE computation.',
      },
    ],
  },
  {
    instrument: 'Adherence Science',
    col: _C.amber,
    refs: [
      {
        authors: 'World Health Organization.',
        year: '2003',
        title: 'Adherence to long-term therapies: Evidence for action.',
        journal: 'World Health Organization, Geneva.',
        doi: 'ISBN 9241545992',
        note: 'WHO foundational report. Defines medication adherence, identifies determinants (patient, therapy, health system, socioeconomic, condition factors), and frames non-adherence as a global public health crisis.',
      },
      {
        authors: 'Vrijens, B., De Geest, S., Hughes, D. A., Przemyslaw, K., Demonceau, J., Ruppar, T., … Urquhart, J.',
        year: '2012',
        title: 'A new taxonomy for describing and defining adherence to medications.',
        journal: 'British Journal of Clinical Pharmacology, 73(5), 691–705.',
        doi: '10.1111/j.1365-2125.2012.04167.x',
        note: 'ABC taxonomy: Initiation, Implementation, Discontinuation. Foundational framework for distinguishing phases of adherence behaviour.',
      },
      {
        authors: 'Horne, R., Chapman, S. C., Parham, R., Freemantle, N., Forbes, A., & Cooper, V.',
        year: '2013',
        title: 'Understanding patients\' adherence-related beliefs about medicines prescribed for long-term conditions.',
        journal: 'PLOS ONE, 8(12), e80633.',
        doi: '10.1371/journal.pone.0080633',
        note: 'Necessity-Concerns framework. Demonstrates that patients\' beliefs about necessity of medication and concerns about side effects predict adherence across 18 conditions.',
      },
    ],
  },
];

function _saResRenderRefs(body) {
  body.innerHTML = `
  <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
    <div style="font-size:0.84rem;color:${_C.muted};">
      ${_SA_REFS.reduce((s,g)=>s+g.refs.length,0)} references across ${_SA_REFS.length} categories.
    </div>
    <button onclick="_saResCopyAll()"
      style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;
             padding:6px 14px;border-radius:5px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};">
      Copy All (APA)
    </button>
  </div>

  ${_SA_REFS.map(group=>`
  <div style="margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="width:3px;height:24px;background:${group.col};border-radius:2px;display:inline-block;"></span>
      <span style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${group.col};">${group.instrument}</span>
    </div>
    ${group.refs.map((ref,i)=>`
    <div style="padding:16px 18px;background:${_C.navy};border:1px solid ${_C.border};border-radius:7px;margin-bottom:10px;border-left:3px solid ${group.col};">
      <div style="font-size:0.90rem;color:${_C.text};line-height:1.65;margin-bottom:6px;">
        ${_saEsc(ref.authors)} (${ref.year}). <em style="color:${_C.muted};">${_saEsc(ref.title)}</em> ${_saEsc(ref.journal)}
        ${ref.doi?`<span style="color:${_C.dim};"> DOI/ID: ${_saEsc(ref.doi)}</span>`:''}
      </div>
      <div style="font-size:0.80rem;color:${_C.dim};line-height:1.6;border-top:1px solid ${_C.border};padding-top:7px;margin-top:6px;">
        ${_saEsc(ref.note)}
      </div>
      <div style="margin-top:8px;">
        <button onclick="_saResCopyRef(${_SA_REFS.indexOf(group)},${i})"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;text-transform:uppercase;
                 padding:3px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.dim};
                 transition:all 0.12s;"
          onmouseover="this.style.borderColor='${group.col}';this.style.color='${group.col}'"
          onmouseout="this.style.borderColor='${_C.border}';this.style.color='${_C.dim}'">Copy APA</button>
      </div>
    </div>`).join('')}
  </div>`).join('')}`;
}

function _saResCopyRef(groupIdx, refIdx) {
  const ref = _SA_REFS[groupIdx]?.refs[refIdx];
  if (!ref) return;
  const apa = `${ref.authors} (${ref.year}). ${ref.title} ${ref.journal}${ref.doi?' '+ref.doi:''}`;
  navigator.clipboard?.writeText(apa).then(()=>{
    if(typeof showToast==='function') showToast('Citation copied to clipboard.', 2000);
  }).catch(()=>{});
}

function _saResCopyAll() {
  const all = _SA_REFS.flatMap(g=>g.refs.map(r=>`${r.authors} (${r.year}). ${r.title} ${r.journal}${r.doi?' '+r.doi:''}`));
  navigator.clipboard?.writeText(all.join('\n\n')).then(()=>{
    if(typeof showToast==='function') showToast(`${all.length} citations copied to clipboard.`, 2000);
  }).catch(()=>{});
}
