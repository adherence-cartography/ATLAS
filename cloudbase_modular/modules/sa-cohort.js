// sa-cohort.js — Cohort Intelligence: cohort builder, filter readers, preview/save, comparison, risk stratification, trajectory

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — COHORT INTELLIGENCE
// Builder · Comparison · Risk Stratification · Longitudinal Trajectories
// ══════════════════════════════════════════════════════════════════════════════

// Cohort state
const _saCohorts   = {};      // { id: { name, filters, records } } — up to 20 saved cohorts
let   _saCohortA   = null;    // active cohort A id for comparison
let   _saCohortB   = null;    // active cohort B id for comparison
let   _saCohortTab = 'build'; // 'build' | 'compare' | 'risk' | 'trajectory'
let   _saCiLastCtx = null;    // last cohort compare context — for Claude interpretation

function _saRenderCohort(container) {
  container.style.padding = '24px 28px';
  container.innerHTML = `
  <!-- Sub-nav -->
  <div style="display:flex;gap:6px;margin-bottom:22px;border-bottom:1px solid ${_C.border};padding-bottom:16px;">
    ${[
      ['build',      '◫',  'Cohort Builder'],
      ['compare',    '◬',  'Comparison'],
      ['risk',       '◐',  'Risk Stratification'],
      ['trajectory', '◩',  'Longitudinal Trajectory'],
    ].map(([id, icon, lbl]) => `
      <button id="sa-ci-btn-${id}" onclick="saCohortTab('${id}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:7px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;
               background:${id==='build'?_C.amberFaint:'transparent'};
               border:1px solid ${id==='build'?'rgba(212,168,67,0.35)':_C.border};
               color:${id==='build'?_C.amber:_C.muted};">
        ${icon} ${lbl}
      </button>`).join('')}
    <div style="margin-left:auto;font-size:0.78rem;color:${_C.dim};display:flex;align-items:center;gap:6px;">
      Saved cohorts: <span id="sa-cohort-count" style="color:${_C.cyan};">0</span> / 20
    </div>
  </div>

  <!-- Content pane -->
  <div id="sa-ci-body"></div>`;

  saCohortTab('build');
}

function saCohortTab(tab) {
  _saCohortTab = tab;

  ['build','compare','risk','trajectory'].forEach(id => {
    const btn = document.getElementById('sa-ci-btn-' + id);
    if (!btn) return;
    const active = id === tab;
    btn.style.background   = active ? _C.amberFaint : 'transparent';
    btn.style.borderColor  = active ? 'rgba(212,168,67,0.35)' : _C.border;
    btn.style.color        = active ? _C.amber : _C.muted;
  });

  const body = document.getElementById('sa-ci-body');
  if (!body) return;

  switch (tab) {
    case 'build':      _saCiRenderBuilder(body);      break;
    case 'compare':    _saCiRenderComparison(body);   break;
    case 'risk':       _saCiRenderRisk(body);         break;
    case 'trajectory': _saCiRenderTrajectory(body);   break;
  }
}

// ── COHORT BUILDER ────────────────────────────────────────────────────────────

function _saCiRenderBuilder(body) {
  const wsOptions = Object.keys(_saCache.workspaces).slice(0, 200);

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start;">

    <!-- Filter card -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Define Cohort</div>
      <div class="sa-section-title">Cohort Builder</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;">

        <!-- Name -->
        <div style="grid-column:1/-1;">
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Cohort Name</div>
          <input id="sa-cb-name" placeholder="e.g. Cardiovascular Q1 2026" value="Cohort ${Object.keys(_saCohorts).length + 1}"
            style="width:100%;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.92rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;" />
        </div>

        <!-- Instrument -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Instrument</div>
          <select id="sa-cb-inst"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All Instruments</option>
            <option value="mmas">MMAS-8 only</option>
            <option value="map">MAP only</option>
            <option value="peacs">PEACS only</option>
          </select>
        </div>

        <!-- Score range -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Score Range (0–8)</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input id="sa-cb-score-min" type="number" min="0" max="8" step="0.1" value="0" placeholder="Min"
              style="flex:1;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                     font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;" />
            <span style="color:${_C.dim};font-size:0.90rem;">—</span>
            <input id="sa-cb-score-max" type="number" min="0" max="8" step="0.1" value="8" placeholder="Max"
              style="flex:1;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                     font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;" />
          </div>
        </div>

        <!-- Date range -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Date Range</div>
          <select id="sa-cb-date"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All Time</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 180 Days</option>
            <option value="365">Last 12 Months</option>
          </select>
        </div>

        <!-- Country -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Country</div>
          <input id="sa-cb-country" placeholder="e.g. United States (blank = all)"
            style="width:100%;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;" />
        </div>

        <!-- Adherence tier -->
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Adherence Tier</div>
          <select id="sa-cb-tier"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All Tiers</option>
            <option value="high">High ≥ 7 / ≥ 0.85</option>
            <option value="medium">Medium 6–7 / 0.55–0.85</option>
            <option value="low">Low &lt; 6 / &lt; 0.55</option>
          </select>
        </div>

      </div>

      <div style="margin-top:18px;display:flex;gap:10px;align-items:center;">
        <button onclick="_saCiPreviewCohort()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 20px;border-radius:7px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.borderB};color:${_C.cyan};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(56,189,248,0.12)'" onmouseout="this.style.background='${_C.navy}'">
          ◍ Preview
        </button>
        <button onclick="_saCiSaveCohort()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 20px;border-radius:7px;cursor:pointer;background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.15)'" onmouseout="this.style.background='${_C.amberFaint}'">
          + Save Cohort
        </button>
        <div id="sa-cb-preview-stat" style="margin-left:auto;font-size:0.90rem;color:${_C.muted};"></div>
      </div>
    </div>

    <!-- Saved cohorts -->
    <div class="sa-panel" style="max-height:480px;overflow-y:auto;">
      <div class="sa-section-eyebrow">Saved Cohorts</div>
      <div id="sa-saved-cohorts" style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        <div style="font-size:0.88rem;color:${_C.dim};font-style:italic;">No cohorts saved yet.</div>
      </div>
    </div>
  </div>

  <!-- Preview results -->
  <div id="sa-cb-preview" style="margin-top:16px;"></div>`;
}

function _saCiBuildRecords(filters) {
  const dateTs = filters.date !== 'all' ? Date.now() - (+filters.date * 86400000) : 0;
  const scoreMin = +filters.scoreMin, scoreMax = +filters.scoreMax;
  const countryF = (filters.country || '').trim().toLowerCase();

  const process = (arr, inst) => arr.filter(r => {
    if (filters.inst !== 'all' && inst !== filters.inst) return false;
    const ts = r.timestamp || 0;
    if (ts < dateTs) return false;
    const norm = inst === 'mmas' ? (r.score||0)/8 : (r.pe!=null ? +r.pe : (r.score||0)/8);
    const scaledScore = norm * 8;
    if (scaledScore < scoreMin || scaledScore > scoreMax) return false;
    if (countryF && !(r.country||'').toLowerCase().includes(countryF)) return false;
    if (filters.tier !== 'all') {
      if (filters.tier === 'high'   && norm <  0.85) return false;
      if (filters.tier === 'medium' && (norm < 0.55 || norm >= 0.85)) return false;
      if (filters.tier === 'low'    && norm >= 0.55) return false;
    }
    return true;
  }).map(r => ({ ...r, _inst: inst, _norm: inst==='mmas'?(r.score||0)/8:(r.pe!=null?+r.pe:(r.score||0)/8) }));

  return [
    ...process(_saCache.mmas,  'mmas'),
    ...process(_saCache.map,   'map'),
    ...process(_saCache.peacs, 'peacs'),
  ];
}

function _saReadBuilderFilters() {
  return {
    name:     (document.getElementById('sa-cb-name')?.value      || 'Cohort').trim(),
    inst:     document.getElementById('sa-cb-inst')?.value       || 'all',
    scoreMin: document.getElementById('sa-cb-score-min')?.value  || '0',
    scoreMax: document.getElementById('sa-cb-score-max')?.value  || '8',
    date:     document.getElementById('sa-cb-date')?.value       || 'all',
    country:  document.getElementById('sa-cb-country')?.value    || '',
    tier:     document.getElementById('sa-cb-tier')?.value       || 'all',
  };
}

function _saCiPreviewCohort() {
  const filters = _saReadBuilderFilters();
  const records = _saCiBuildRecords(filters);
  const preview = document.getElementById('sa-cb-preview');
  const stat    = document.getElementById('sa-cb-preview-stat');
  if (stat) stat.textContent = records.length.toLocaleString() + ' records match';
  if (!preview) return;

  if (!records.length) {
    preview.innerHTML = `<div class="sa-panel" style="color:${_C.dim};font-size:0.94rem;">No records match the current filters.</div>`;
    return;
  }

  // Quick stats
  const meanNorm = records.reduce((s,r)=>s+r._norm,0)/records.length;
  const sd = Math.sqrt(records.reduce((s,r)=>s+Math.pow(r._norm-meanNorm,2),0)/records.length);
  const countries = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
  const ws = new Set(records.map(r=>r.institution_code||r.workspace).filter(Boolean)).size;
  const byInst = { mmas:0, map:0, peacs:0 };
  records.forEach(r => byInst[r._inst]++);

  preview.innerHTML = `
  <div class="sa-panel">
    <div class="sa-section-eyebrow">Preview: ${_saEsc(filters.name)}</div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:12px;">
      ${_saCiStat('N',          records.length.toLocaleString(), _C.cyan)}
      ${_saCiStat('Mean Score', meanNorm.toFixed(3),             _C.amber)}
      ${_saCiStat('SD',         sd.toFixed(3),                   _C.muted)}
      ${_saCiStat('MMAS-8',     byInst.mmas.toLocaleString(),    _C.blue)}
      ${_saCiStat('MAP',        byInst.map.toLocaleString(),     _C.green)}
      ${_saCiStat('PEACS',      byInst.peacs.toLocaleString(),   _C.purple)}
    </div>
    <div style="display:flex;gap:16px;margin-top:14px;font-size:0.82rem;color:${_C.muted};">
      <span>${countries} countries</span>
      <span>${ws} workspaces</span>
    </div>
    ${_saCiScoreHistogram(records)}
  </div>`;
}

function _saCiSaveCohort() {
  if (Object.keys(_saCohorts).length >= 20) {
    if (typeof showToast==='function') showToast('Maximum 20 saved cohorts reached. Delete one first.', 3000);
    return;
  }
  const filters = _saReadBuilderFilters();
  const records = _saCiBuildRecords(filters);
  const id = 'c_' + Date.now();
  _saCohorts[id] = { id, name: filters.name, filters, records };
  _saRenderSavedCohorts();
  const stat = document.getElementById('sa-cb-preview-stat');
  if (stat) stat.textContent = '✓ Saved: ' + filters.name;
  _saSetEl('sa-cohort-count', Object.keys(_saCohorts).length.toString());
}

function _saRenderSavedCohorts() {
  const wrap = document.getElementById('sa-saved-cohorts');
  if (!wrap) return;
  const ids = Object.keys(_saCohorts);
  if (!ids.length) {
    wrap.innerHTML = `<div style="font-size:0.88rem;color:${_C.dim};font-style:italic;">No cohorts saved yet.</div>`;
    return;
  }
  wrap.innerHTML = ids.map(id => {
    const c = _saCohorts[id];
    const mean = c.records.length ? (c.records.reduce((s,r)=>s+r._norm,0)/c.records.length).toFixed(3) : '—';
    const isA  = _saCohortA === id, isB = _saCohortB === id;
    return `
    <div style="padding:10px 12px;background:${_C.navy};border:1px solid ${isA?_C.amber:isB?_C.cyan:_C.border};border-radius:7px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:0.88rem;font-weight:700;color:${_C.text};flex:1;">${_saEsc(c.name)}</span>
        <span style="font-size:0.78rem;color:${_C.muted};">${c.records.length.toLocaleString()} rec</span>
      </div>
      <div style="font-size:0.78rem;color:${_C.muted};margin-bottom:7px;">Mean: <strong style="color:${_C.amber};">${mean}</strong></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        <button onclick="_saCiSetCohortA('${id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;
                 padding:3px 7px;border-radius:4px;cursor:pointer;
                 background:${isA?_C.amberFaint:'transparent'};border:1px solid ${isA?'rgba(212,168,67,0.35)':_C.border};
                 color:${isA?_C.amber:_C.dim};">A</button>
        <button onclick="_saCiSetCohortB('${id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;
                 padding:3px 7px;border-radius:4px;cursor:pointer;
                 background:${isB?'rgba(56,189,248,0.1)':'transparent'};border:1px solid ${isB?_C.borderB:_C.border};
                 color:${isB?_C.cyan:_C.dim};">B</button>
        <button onclick="_saCiDeleteCohort('${id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;
                 padding:3px 7px;border-radius:4px;cursor:pointer;margin-left:auto;
                 background:transparent;border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.5);">✕</button>
      </div>
    </div>`;
  }).join('');
}

function _saCiSetCohortA(id) { _saCohortA = id; _saRenderSavedCohorts(); }
function _saCiSetCohortB(id) { _saCohortB = id; _saRenderSavedCohorts(); }
function _saCiDeleteCohort(id) {
  delete _saCohorts[id];
  if (_saCohortA === id) _saCohortA = null;
  if (_saCohortB === id) _saCohortB = null;
  _saRenderSavedCohorts();
  _saSetEl('sa-cohort-count', Object.keys(_saCohorts).length.toString());
}

// ── COMPARISON ────────────────────────────────────────────────────────────────

function _saCiRenderComparison(body) {
  const cA = _saCohortA ? _saCohorts[_saCohortA] : null;
  const cB = _saCohortB ? _saCohorts[_saCohortB] : null;

  if (!cA || !cB) {
    body.innerHTML = `
    <div class="sa-panel" style="text-align:center;padding:40px;">
      <div style="font-size:1.5rem;opacity:0.2;margin-bottom:10px;">◬</div>
      <div style="font-size:1.00rem;color:${_C.muted};margin-bottom:6px;">Select two cohorts to compare.</div>
      <div style="font-size:0.88rem;color:${_C.dim};">
        Go to Cohort Builder → save two cohorts → assign one as A and one as B.<br>
        Currently: A = <strong style="color:${_C.amber};">${cA?_saEsc(cA.name):'(none)'}</strong>
        · B = <strong style="color:${_C.cyan};">${cB?_saEsc(cB.name):'(none)'}</strong>
      </div>
    </div>`;
    return;
  }

  const statsA = _saCiStats(cA.records);
  const statsB = _saCiStats(cB.records);

  // Cohen's d
  const pooledSD = Math.sqrt((Math.pow(statsA.sd,2) + Math.pow(statsB.sd,2)) / 2) || 0.001;
  const d = ((statsA.mean - statsB.mean) / pooledSD);
  const dLabel = Math.abs(d) < 0.2 ? 'Negligible' : Math.abs(d) < 0.5 ? 'Small' : Math.abs(d) < 0.8 ? 'Medium' : 'Large';

  // Store for Claude handler
  _saCiLastCtx = { cA, cB, statsA, statsB, d, dLabel };

  body.innerHTML = `
  <!-- Header chips -->
  <div style="display:flex;gap:12px;margin-bottom:18px;">
    <div style="flex:1;padding:12px 16px;background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.3);border-radius:8px;">
      <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:3px;">Cohort A</div>
      <div style="font-size:1.05rem;font-weight:700;color:${_C.amber};">${_saEsc(cA.name)}</div>
      <div style="font-size:0.82rem;color:${_C.muted};">N = ${cA.records.length.toLocaleString()}</div>
    </div>
    <div style="display:flex;align-items:center;font-size:1.5rem;color:${_C.dim};padding:0 8px;">vs</div>
    <div style="flex:1;padding:12px 16px;background:rgba(56,189,248,0.07);border:1px solid ${_C.borderB};border-radius:8px;">
      <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.cyanDim};margin-bottom:3px;">Cohort B</div>
      <div style="font-size:1.05rem;font-weight:700;color:${_C.cyan};">${_saEsc(cB.name)}</div>
      <div style="font-size:0.82rem;color:${_C.muted};">N = ${cB.records.length.toLocaleString()}</div>
    </div>
  </div>

  <!-- Stats comparison grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">

    <div class="sa-panel">
      <div class="sa-section-eyebrow">Descriptive Statistics</div>
      ${_saCiCompareRow('Mean Score', statsA.mean.toFixed(3), statsB.mean.toFixed(3), statsA.mean > statsB.mean)}
      ${_saCiCompareRow('SD',         statsA.sd.toFixed(3),   statsB.sd.toFixed(3),   null)}
      ${_saCiCompareRow('Median',     statsA.median.toFixed(3), statsB.median.toFixed(3), statsA.median > statsB.median)}
      ${_saCiCompareRow('Min',        statsA.min.toFixed(3),  statsB.min.toFixed(3),   null)}
      ${_saCiCompareRow('Max',        statsA.max.toFixed(3),  statsB.max.toFixed(3),   null)}
      ${_saCiCompareRow('High Adh.%', (statsA.pctHigh*100).toFixed(1)+'%', (statsB.pctHigh*100).toFixed(1)+'%', statsA.pctHigh > statsB.pctHigh)}
      ${_saCiCompareRow('Low Adh.%',  (statsA.pctLow*100).toFixed(1)+'%',  (statsB.pctLow*100).toFixed(1)+'%',  statsA.pctLow < statsB.pctLow)}
    </div>

    <div class="sa-panel">
      <div class="sa-section-eyebrow">Effect Size · Significance</div>
      <div style="text-align:center;padding:16px 0 12px;">
        <div style="font-size:2rem;font-weight:700;color:${Math.abs(d)<0.2?_C.muted:Math.abs(d)<0.5?_C.cyan:Math.abs(d)<0.8?_C.amber:_C.red};">
          ${d >= 0 ? '+' : ''}${d.toFixed(3)}
        </div>
        <div style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">Cohen's d · ${dLabel} Effect</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid ${_C.border};padding-top:12px;">
        ${_saCiEffectBar(Math.abs(d))}
        <div style="font-size:0.82rem;color:${_C.muted};line-height:1.6;margin-top:8px;">
          ${d >= 0
            ? `Cohort A scores <strong style="color:${_C.amber};">${d.toFixed(2)} SDs higher</strong> than Cohort B on average.`
            : `Cohort B scores <strong style="color:${_C.cyan};">${Math.abs(d).toFixed(2)} SDs higher</strong> than Cohort A on average.`}
          <br>Effect size is ${dLabel.toLowerCase()} (Cohen's d thresholds: 0.2 small, 0.5 medium, 0.8 large).
        </div>
      </div>
    </div>
  </div>

  <!-- Distribution comparison: side-by-side histograms -->
  <div class="sa-panel" style="margin-bottom:14px;">
    <div class="sa-section-eyebrow">Score Distribution Comparison</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:12px;">
      <div>
        <div style="font-size:0.78rem;color:${_C.amber};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Cohort A · ${_saEsc(cA.name)}</div>
        ${_saCiScoreHistogram(cA.records, _C.amber)}
      </div>
      <div>
        <div style="font-size:0.78rem;color:${_C.cyan};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Cohort B · ${_saEsc(cB.name)}</div>
        ${_saCiScoreHistogram(cB.records, _C.cyan)}
      </div>
    </div>
  </div>

  <!-- AI Interpretation -->
  <div class="sa-panel">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
      <div class="sa-section-eyebrow" style="margin-bottom:0;">AI Interpretation</div>
      ${(sessionStorage.getItem('atlas_claude_key')||'').trim()
        ? `<button onclick="_saCiInterpretWithClaude()" id="sa-ci-gen-btn"
             style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;
                    padding:5px 10px;border-radius:5px;cursor:pointer;
                    background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">◍ Interpret with Claude</button>`
        : `<span style="font-size:0.68rem;color:${_C.dim};">Add Claude API key in Config tab</span>`}
    </div>
    <div id="sa-ci-narrative" style="font-size:0.90rem;color:${_C.muted};line-height:1.7;margin-top:8px;">
      ${_saCiCompareNarrative(cA, cB, statsA, statsB, d, dLabel)}
    </div>
    <div id="sa-ci-llm" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid ${_C.border};font-size:0.90rem;color:${_C.text};line-height:1.8;"></div>
  </div>`;
}

function _saCiStats(records) {
  if (!records.length) return { mean:0, sd:0, median:0, min:0, max:0, pctHigh:0, pctLow:0 };
  const norms = records.map(r=>r._norm).sort((a,b)=>a-b);
  const n     = norms.length;
  const mean  = norms.reduce((s,v)=>s+v,0)/n;
  const sd    = Math.sqrt(norms.reduce((s,v)=>s+Math.pow(v-mean,2),0)/n);
  const median = n%2===0 ? (norms[n/2-1]+norms[n/2])/2 : norms[Math.floor(n/2)];
  return {
    mean, sd, median,
    min: norms[0], max: norms[n-1],
    pctHigh: norms.filter(v=>v>=0.85).length/n,
    pctLow:  norms.filter(v=>v<0.55).length/n,
  };
}

function _saCiCompareRow(label, valA, valB, aWins) {
  const winCol = _C.amber, loseCol = _C.cyan;
  return `
  <div style="display:grid;grid-template-columns:1fr 70px 70px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid ${_C.border};">
    <span style="font-size:0.82rem;color:${_C.muted};">${label}</span>
    <span style="font-size:0.90rem;font-weight:600;color:${aWins===true?winCol:aWins===false?_C.dim:_C.text};text-align:right;">${valA}</span>
    <span style="font-size:0.90rem;font-weight:600;color:${aWins===false?loseCol:aWins===true?_C.dim:_C.text};text-align:right;">${valB}</span>
  </div>`;
}

function _saCiEffectBar(absD) {
  const thresholds = [{ d:0.2,lbl:'Small'}, {d:0.5,lbl:'Medium'}, {d:0.8,lbl:'Large'}];
  const pct = Math.min(100, (absD / 1.2) * 100);
  const col = absD < 0.2 ? _C.muted : absD < 0.5 ? _C.cyan : absD < 0.8 ? _C.amber : _C.red;
  return `
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      ${thresholds.map(t=>`<span style="font-size:0.68rem;color:${_C.dim};">${t.lbl} (${t.d})</span>`).join('')}
    </div>
    <div style="height:6px;background:${_C.navy};border-radius:3px;overflow:hidden;position:relative;">
      ${thresholds.map(t=>`<div style="position:absolute;top:0;bottom:0;left:${(t.d/1.2*100).toFixed(1)}%;width:1px;background:${_C.border};"></div>`).join('')}
      <div style="height:100%;width:${pct.toFixed(1)}%;background:${col};border-radius:3px;transition:width 0.6s;"></div>
    </div>
    <div style="text-align:right;margin-top:3px;font-size:0.68rem;color:${col};">d = ${absD.toFixed(3)}</div>
  </div>`;
}

function _saCiCompareNarrative(cA, cB, sA, sB, d, dLabel) {
  const higher = d >= 0 ? cA.name : cB.name;
  const lower  = d >= 0 ? cB.name : cA.name;
  const absd   = Math.abs(d);
  return `Comparing <strong style="color:${_C.amber};">${_saEsc(cA.name)}</strong> (N=${cA.records.length.toLocaleString()}) against
    <strong style="color:${_C.cyan};">${_saEsc(cB.name)}</strong> (N=${cB.records.length.toLocaleString()}):
    <br><br>
    <strong style="color:${_C.text};">${_saEsc(higher)}</strong> scores ${absd.toFixed(2)} standard deviations higher
    on average (Cohen's d = ${d.toFixed(3)}, ${dLabel} effect). The mean difference is
    ${Math.abs(sA.mean - sB.mean).toFixed(3)} normalised score units.
    ${sA.pctLow > sB.pctLow
      ? `Cohort A has a higher proportion of low-adherence records (${(sA.pctLow*100).toFixed(0)}% vs ${(sB.pctLow*100).toFixed(0)}%) — this cohort may require closer monitoring or intervention.`
      : `Cohort B carries more low-adherence records (${(sB.pctLow*100).toFixed(0)}% vs ${(sA.pctLow*100).toFixed(0)}%).`}`;
}

async function _saCiInterpretWithClaude() {
  const btn = document.getElementById('sa-ci-gen-btn');
  const llm = document.getElementById('sa-ci-llm');
  if (!llm || !_saCiLastCtx) return;

  if (btn) { btn.disabled = true; btn.textContent = '⟳ Interpreting…'; }
  llm.style.display = 'block';
  llm.innerHTML = `<span style="color:${_C.dim};">Generating Claude interpretation…</span>`;

  const { cA, cB, statsA: sA, statsB: sB, d, dLabel } = _saCiLastCtx;
  const ctx = {
    cohort_a: { name: cA.name, n: cA.records.length, mean: +sA.mean.toFixed(4), sd: +sA.sd.toFixed(4), median: +sA.median.toFixed(4), pct_high: +(sA.pctHigh*100).toFixed(1), pct_low: +(sA.pctLow*100).toFixed(1) },
    cohort_b: { name: cB.name, n: cB.records.length, mean: +sB.mean.toFixed(4), sd: +sB.sd.toFixed(4), median: +sB.median.toFixed(4), pct_high: +(sB.pctHigh*100).toFixed(1), pct_low: +(sB.pctLow*100).toFixed(1) },
    cohens_d: +d.toFixed(4),
    effect_size: dLabel,
    mean_diff: +(sA.mean - sB.mean).toFixed(4),
  };

  const key   = (sessionStorage.getItem('atlas_claude_key')  || '').trim();
  const model =  sessionStorage.getItem('atlas_claude_model') || 'claude-haiku-4-5-20251001';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model, max_tokens: 500,
        system: 'You are ATLAS AI, an adherence science specialist. Interpret a cohort comparison in ATLAS Mission Control. Write 2-3 short paragraphs covering: what the Cohen\'s d effect size means clinically, which cohort is performing better and why this matters, and what interventions or follow-up actions the data suggests. Use the exact numbers from the context. No markdown headers.',
        messages: [{ role: 'user', content: `Interpret this cohort comparison:\n\n${JSON.stringify(ctx)}` }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    llm.innerHTML = text
      ? `<div style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Claude Interpretation</div>`
        + text.split('\n\n').map(p => `<p style="margin:0 0 10px 0;">${_saEsc(p)}</p>`).join('')
      : `<span style="color:${_C.dim};">No interpretation returned.</span>`;
  } catch(e) {
    llm.innerHTML = `<span style="color:rgba(239,68,68,0.7);">Error: ${_saEsc(e.message)}</span>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '◍ Re-interpret'; }
  }
}

// ── RISK STRATIFICATION ───────────────────────────────────────────────────────

function _saCiRenderRisk(body) {
  const allRecords = [..._saCache.mmas, ..._saCache.map, ..._saCache.peacs].map(r => {
    const inst = _saCache.mmas.includes(r) ? 'mmas' : _saCache.map.includes(r) ? 'map' : 'peacs';
    const norm = inst === 'mmas' ? (r.score||0)/8 : (r.pe!=null ? +r.pe : (r.score||0)/8);
    return { ...r, _inst: inst, _norm: norm };
  });

  // Tier assignment: STABLE / WATCH / AT-RISK / CRITICAL
  const tiered = allRecords.map(r => {
    const tier = r._norm >= 0.85 ? 'STABLE'
               : r._norm >= 0.70 ? 'WATCH'
               : r._norm >= 0.55 ? 'AT-RISK'
               : 'CRITICAL';
    return { ...r, _tier: tier };
  });

  const counts = { STABLE: 0, WATCH: 0, 'AT-RISK': 0, CRITICAL: 0 };
  tiered.forEach(r => counts[r._tier]++);
  const total = tiered.length || 1;

  const tierDef = [
    { key: 'CRITICAL', col: _C.red,    label: 'Critical',   desc: 'Immediate intervention required' },
    { key: 'AT-RISK',  col: '#f97316', label: 'At-Risk',    desc: 'Enhanced monitoring recommended' },
    { key: 'WATCH',    col: _C.amber,  label: 'Watch',      desc: 'Routine follow-up'               },
    { key: 'STABLE',   col: _C.green,  label: 'Stable',     desc: 'On track — maintain current plan'},
  ];

  body.innerHTML = `
  <!-- Tier summary -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
    ${tierDef.map(t => `
    <div class="sa-panel" style="border-left:3px solid ${t.col};">
      <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${t.col};margin-bottom:6px;">${t.label}</div>
      <div style="font-size:2rem;font-weight:700;color:${t.col};line-height:1;">${counts[t.key].toLocaleString()}</div>
      <div style="font-size:0.78rem;color:${_C.muted};margin-top:3px;">${((counts[t.key]/total)*100).toFixed(1)}%</div>
      <div style="height:3px;border-radius:2px;background:${_C.navy};margin-top:10px;overflow:hidden;">
        <div style="height:100%;width:${((counts[t.key]/total)*100).toFixed(1)}%;background:${t.col};"></div>
      </div>
      <div style="font-size:0.74rem;color:${_C.dim};margin-top:6px;line-height:1.4;">${t.desc}</div>
    </div>`).join('')}
  </div>

  <!-- Controls -->
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
    <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};">Filter:</div>
    ${tierDef.map(t => `
      <button onclick="_saCiRiskFilter('${t.key}')" id="sa-risk-btn-${t.key}"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;
               padding:4px 10px;border-radius:4px;cursor:pointer;transition:all 0.15s;
               background:transparent;border:1px solid ${t.col};color:${t.col};opacity:0.7;"
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
        ${t.label} (${counts[t.key]})
      </button>`).join('')}
    <button onclick="_saCiRiskFilter('ALL')" id="sa-risk-btn-ALL"
      style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;
             padding:4px 10px;border-radius:4px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};">
      All
    </button>
    <input id="sa-risk-search" placeholder="Search workspace or country…" oninput="_saCiRiskSearch()"
      style="margin-left:auto;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
             font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:6px 12px;border-radius:6px;outline:none;width:220px;" />
  </div>

  <!-- Table -->
  <div class="sa-panel" style="padding:0;overflow:hidden;">
    <div style="overflow-x:auto;">
      <table id="sa-risk-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${_C.bg2};">
            ${['Tier','Instrument','Workspace','Country','Score','Timestamp'].map(h =>
              `<th style="padding:10px 14px;text-align:left;font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody id="sa-risk-body"></tbody>
      </table>
    </div>
    <div id="sa-risk-pagination" style="padding:10px 14px;border-top:1px solid ${_C.border};display:flex;align-items:center;gap:10px;"></div>
  </div>`;

  // Store tiered data
  window._saRiskRows = tiered;
  window._saRiskFilter = 'ALL';
  window._saRiskPage = 0;
  _saCiRiskRender();
}

function _saCiRiskFilter(tier) {
  window._saRiskFilter = tier;
  window._saRiskPage   = 0;
  _saCiRiskRender();
}

function _saCiRiskSearch() {
  window._saRiskPage = 0;
  _saCiRiskRender();
}

function _saCiRiskRender() {
  const allRows = window._saRiskRows || [];
  const filter  = window._saRiskFilter || 'ALL';
  const search  = (document.getElementById('sa-risk-search')?.value || '').toLowerCase();
  const page    = window._saRiskPage || 0;
  const perPage = 25;

  const tierDef = {
    STABLE:   { col: _C.green,  label: 'STABLE'   },
    WATCH:    { col: _C.amber,  label: 'WATCH'     },
    'AT-RISK':{ col: '#f97316', label: 'AT-RISK'   },
    CRITICAL: { col: _C.red,    label: 'CRITICAL'  },
  };

  let rows = allRows;
  if (filter !== 'ALL') rows = rows.filter(r => r._tier === filter);
  if (search) rows = rows.filter(r =>
    (r.institution_code||'').toLowerCase().includes(search) ||
    (r.workspace||'').toLowerCase().includes(search) ||
    (r.country||'').toLowerCase().includes(search)
  );

  // Sort: CRITICAL first
  const tierOrder = { CRITICAL: 0, 'AT-RISK': 1, WATCH: 2, STABLE: 3 };
  rows = [...rows].sort((a,b) => (tierOrder[a._tier]||3) - (tierOrder[b._tier]||3));

  const totalPages = Math.ceil(rows.length / perPage);
  const pageRows   = rows.slice(page * perPage, (page+1) * perPage);

  const tbody = document.getElementById('sa-risk-body');
  if (!tbody) return;

  tbody.innerHTML = pageRows.map(r => {
    const td  = tierDef[r._tier] || { col: _C.muted, label: r._tier };
    const ts  = r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '—';
    const ws  = r.institution_code || r.workspace || '—';
    return `<tr style="border-bottom:1px solid ${_C.border};transition:background 0.1s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
      <td style="padding:9px 14px;white-space:nowrap;">
        <span style="font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${td.col};padding:2px 6px;border:1px solid ${td.col};border-radius:3px;opacity:0.85;">${td.label}</span>
      </td>
      <td style="padding:9px 14px;font-size:0.84rem;color:${_C.muted};text-transform:uppercase;letter-spacing:0.08em;">${r._inst}</td>
      <td style="padding:9px 14px;font-size:0.86rem;color:${_C.text};">${_saEsc(ws)}</td>
      <td style="padding:9px 14px;font-size:0.86rem;color:${_C.muted};">${_saEsc(r.country||'—')}</td>
      <td style="padding:9px 14px;font-size:0.90rem;font-weight:700;color:${td.col};">${r._norm.toFixed(3)}</td>
      <td style="padding:9px 14px;font-size:0.82rem;color:${_C.dim};">${ts}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="padding:20px;text-align:center;color:${_C.dim};font-size:0.90rem;">No records match.</td></tr>`;

  // Pagination
  const pag = document.getElementById('sa-risk-pagination');
  if (pag) {
    pag.innerHTML = `
      <span style="font-size:0.78rem;color:${_C.dim};">${rows.length.toLocaleString()} records · page ${page+1} of ${Math.max(1,totalPages)}</span>
      <button onclick="window._saRiskPage=Math.max(0,window._saRiskPage-1);_saCiRiskRender();" ${page===0?'disabled':''} style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;border-radius:4px;border:1px solid ${_C.border};background:transparent;color:${_C.muted};cursor:pointer;${page===0?'opacity:0.35;cursor:default;':''}">← Prev</button>
      <button onclick="window._saRiskPage=Math.min(${totalPages-1},window._saRiskPage+1);_saCiRiskRender();" ${page>=totalPages-1?'disabled':''} style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;border-radius:4px;border:1px solid ${_C.border};background:transparent;color:${_C.muted};cursor:pointer;${page>=totalPages-1?'opacity:0.35;cursor:default;':''}">Next →</button>`;
  }
}

// ── LONGITUDINAL TRAJECTORY ───────────────────────────────────────────────────

function _saCiRenderTrajectory(body) {
  const cohortIds = Object.keys(_saCohorts);

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start;">

    <!-- Controls -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Trajectory Settings</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Cohort</div>
          <select id="sa-traj-cohort"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All Records (Global)</option>
            ${cohortIds.map(id => `<option value="${id}">${_saEsc(_saCohorts[id].name)}</option>`).join('')}
          </select>
        </div>

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Time Bucket</div>
          <select id="sa-traj-bucket"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="day">Daily</option>
            <option value="week" selected>Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>

        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Instrument</div>
          <select id="sa-traj-inst"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="all">All</option>
            <option value="mmas">MMAS-8</option>
            <option value="map">MAP</option>
            <option value="peacs">PEACS</option>
          </select>
        </div>

        <button onclick="_saCiDrawTrajectory()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 14px;border-radius:7px;cursor:pointer;
                 background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">
          ◩ Draw Trajectory
        </button>
      </div>
    </div>

    <!-- Chart area -->
    <div>
      <div class="sa-panel" style="margin-bottom:14px;">
        <div class="sa-section-eyebrow">Mean Adherence Over Time</div>
        <div id="sa-traj-chart" style="height:240px;position:relative;margin-top:14px;overflow:hidden;"></div>
        <div id="sa-traj-legend" style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap;"></div>
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Trajectory Summary</div>
        <div id="sa-traj-summary" style="margin-top:8px;font-size:0.90rem;color:${_C.muted};line-height:1.7;"></div>
      </div>
    </div>
  </div>`;
}

function _saCiDrawTrajectory() {
  const cohortSel = document.getElementById('sa-traj-cohort')?.value || 'all';
  const bucket    = document.getElementById('sa-traj-bucket')?.value || 'week';
  const instSel   = document.getElementById('sa-traj-inst')?.value   || 'all';

  let records;
  if (cohortSel === 'all') {
    records = [..._saCache.mmas, ..._saCache.map, ..._saCache.peacs].map(r => {
      const inst = _saCache.mmas.includes(r) ? 'mmas' : _saCache.map.includes(r) ? 'map' : 'peacs';
      return { ...r, _inst: inst, _norm: inst==='mmas'?(r.score||0)/8:(r.pe!=null?+r.pe:(r.score||0)/8) };
    });
  } else {
    records = (_saCohorts[cohortSel]?.records || []);
  }

  if (instSel !== 'all') records = records.filter(r => r._inst === instSel);
  records = records.filter(r => r.timestamp && r._norm != null);
  records.sort((a, b) => a.timestamp - b.timestamp);

  if (!records.length) {
    const chart = document.getElementById('sa-traj-chart');
    if (chart) chart.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${_C.dim};font-size:0.94rem;">No timestamped records match.</div>`;
    return;
  }

  // Bucket records
  const getBucket = (ts) => {
    const d = new Date(ts);
    if (bucket === 'day')   return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (bucket === 'month') return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    // Week: ISO week
    const jan1  = new Date(d.getFullYear(), 0, 1);
    const week  = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
  };

  const buckets = {};
  records.forEach(r => {
    const key = getBucket(r.timestamp);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0, ts: r.timestamp };
    buckets[key].sum   += r._norm;
    buckets[key].count += 1;
  });

  const keys  = Object.keys(buckets).sort();
  const means = keys.map(k => buckets[k].sum / buckets[k].count);
  const counts = keys.map(k => buckets[k].count);

  _saCiDrawLineChart('sa-traj-chart', keys, means, counts);

  // Summary
  const first = means[0], last = means[means.length - 1];
  const slope = means.length > 1 ? (last - first) : 0;
  const trend = slope > 0.02 ? '↑ Improving' : slope < -0.02 ? '↓ Declining' : '→ Stable';
  const tCol  = slope > 0.02 ? _C.green : slope < -0.02 ? _C.red : _C.cyan;
  document.getElementById('sa-traj-summary').innerHTML = `
    <strong style="color:${_C.text};">${records.length.toLocaleString()} records</strong> across
    <strong style="color:${_C.text};">${keys.length} ${bucket} buckets</strong>.
    Overall trend: <strong style="color:${tCol};">${trend}</strong>
    (Δ ${slope >= 0 ? '+' : ''}${(slope).toFixed(3)} from first to last bucket).
    Mean range: ${Math.min(...means).toFixed(3)} – ${Math.max(...means).toFixed(3)}.
    Peak volume: ${Math.max(...counts).toLocaleString()} records in a single ${bucket}.`;

  // Legend
  const leg = document.getElementById('sa-traj-legend');
  if (leg) {
    leg.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;font-size:0.74rem;color:${_C.dim};">
        <span style="width:12px;height:2px;background:${_C.amber};display:inline-block;"></span>Mean Score
      </div>
      <div style="display:flex;align-items:center;gap:5px;font-size:0.74rem;color:${_C.dim};">
        <span style="width:12px;height:2px;background:${_C.cyan};display:inline-block;border-top:1px dashed ${_C.cyan};"></span>Volume (count)
      </div>`;
  }
}

// Pure SVG line chart
function _saCiDrawLineChart(containerId, labels, values, volumes) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const W = wrap.offsetWidth || 600, H = 220;
  const padL = 42, padR = 10, padT = 10, padB = 28;
  const cW = W - padL - padR, cH = H - padT - padB;
  const n  = values.length;
  if (!n) { wrap.innerHTML = `<div style="color:${_C.dim};font-size:0.94rem;padding:20px;">No data points.</div>`; return; }

  const maxV = Math.max(...values, 0.01), minV = Math.min(...values);
  const maxVol = Math.max(...volumes, 1);

  const sx = i => padL + (i / Math.max(n-1, 1)) * cW;
  const sy = v => padT + (1 - (v - minV) / (maxV - minV + 0.001)) * cH;
  const syVol = v => padT + (1 - v/maxVol) * cH;

  // Build path
  const pts   = values.map((v,i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`);
  const area  = `M${padL},${padT+cH} L${pts.join(' L')} L${sx(n-1)},${padT+cH} Z`;
  const line  = `M${pts.join(' L')}`;
  const volPts = volumes.map((v,i) => `${sx(i).toFixed(1)},${syVol(v).toFixed(1)}`);
  const volLine = `M${volPts.join(' L')}`;

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // X axis labels (show max 8)
  const step   = Math.max(1, Math.floor(n / 8));
  const xLabels = labels.filter((_,i) => i % step === 0 || i === n-1);
  const xLabelIdxs = labels.reduce((a,_,i) => { if (i%step===0||i===n-1) a.push(i); return a; }, []);

  wrap.innerHTML = `
  <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
    <defs>
      <linearGradient id="sa-traj-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${_C.amber}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${_C.amber}" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Grid lines -->
    ${yTicks.map(v => {
      const y = padT + (1 - v) * cH;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL+cW}" y2="${y.toFixed(1)}" stroke="${_C.border}" stroke-width="1"/>
              <text x="${padL-6}" y="${(y+4).toFixed(1)}" text-anchor="end" fill="${_C.dim}" font-family="IBM Plex Mono,monospace" font-size="9">${v.toFixed(2)}</text>`;
    }).join('')}

    <!-- Area fill -->
    <path d="${area}" fill="url(#sa-traj-grad)"/>

    <!-- Volume line (dashed, secondary) -->
    ${n > 1 ? `<path d="${volLine}" fill="none" stroke="${_C.cyan}" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>` : ''}

    <!-- Mean line -->
    <path d="${line}" fill="none" stroke="${_C.amber}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Data points -->
    ${values.map((v,i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="${_C.amber}" opacity="0.85">
      <title>${labels[i]}: ${v.toFixed(3)} (n=${volumes[i]})</title>
    </circle>`).join('')}

    <!-- X labels -->
    ${xLabelIdxs.map((i,j) => {
      const lbl = labels[i].length > 10 ? labels[i].slice(-7) : labels[i];
      return `<text x="${sx(i).toFixed(1)}" y="${H-6}" text-anchor="middle" fill="${_C.dim}" font-family="IBM Plex Mono,monospace" font-size="8">${lbl}</text>`;
    }).join('')}
  </svg>`;
}

// ── Shared helpers for Cohort Intelligence ─────────────────────────────────────

function _saCiStat(label, val, color) {
  return `<div style="text-align:center;">
    <div style="font-size:1.2rem;font-weight:700;color:${color};line-height:1;">${val}</div>
    <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-top:2px;">${label}</div>
  </div>`;
}

function _saCiScoreHistogram(records, color) {
  color = color || _C.amber;
  const buckets = Array(10).fill(0);
  records.forEach(r => {
    const b = Math.min(9, Math.floor(r._norm * 10));
    buckets[b]++;
  });
  const max = Math.max(...buckets, 1);
  const bars = buckets.map((n,i) => {
    const pct = (n / max * 100).toFixed(0);
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:2px;" title="${(i*0.1).toFixed(1)}–${((i+1)*0.1).toFixed(1)}: ${n}">
      <div style="flex:1;width:100%;background:${_C.navy};border-radius:2px;display:flex;flex-direction:column;justify-content:flex-end;">
        <div style="height:${pct}%;background:${color};border-radius:2px;opacity:0.8;min-height:${n?2:0}px;"></div>
      </div>
      <div style="font-size:0.70rem;color:${_C.dim};">${(i*0.1).toFixed(1)}</div>
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:2px;height:60px;align-items:stretch;margin-top:10px;">${bars}</div>`;
}

