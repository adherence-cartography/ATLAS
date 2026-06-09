// ══════════════════════════════════════════════
// DASHBOARD DATA LOADING
// ══════════════════════════════════════════════
// Coordination flag: renderCorrelationChart only fires once both
// MMAS and PEACS reads have completed, eliminating the blind 1400ms timer.
let _corrDataReady = { mmas: false, peacs: false };
function _maybeRenderCorrelation() {
  if (_corrDataReady.mmas && _corrDataReady.peacs) {
    _corrDataReady = { mmas: false, peacs: false }; // reset for next reload
    renderCorrelationChart();
  }
}

/**
 * Triggers a full dashboard data reload for both MMAS and PEACS cohort datasets.
 * Debounced — ignores calls made within 2 seconds of the previous load.
 * @returns {void}
 */
function loadDashboardData() {
  const now = Date.now();
  if (window._lastDashLoad && (now - window._lastDashLoad) < 2000) return;
  window._lastDashLoad = now;
  _corrDataReady = { mmas: false, peacs: false };
  loadMmasCohortData();
  loadPeacsCohortData();
}

/**
 * Loads MMAS-8 cohort records from Firebase, filtered to the current user's allowed workspaces.
 * Explorer mode receives synthetic demo data with live global stat card values.
 * @returns {void}
 */
function loadMmasCohortData() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  atlasAuditLog('cohort_read_mmas', { workspace: currentWorkspace });
  const ws = (currentWorkspace || '').toUpperCase();

  // Truly keyless session (shouldn't happen for freemium — they get EXPL-XXXXXXXX)
  if (!ws || ws === 'EXPLORER' || ws === 'INDEPENDENT') {
    dashMmasData = [];
    const luEl = document.getElementById('mmas-last-updated');
    if (luEl) luEl.textContent = 'No assessments yet';
    _finishMmasLoad(dashMmasData);
    return;
  }

  document.getElementById('mmas-last-updated').textContent = _t.status_loading || 'Loading…';
  database.ref('assessments').once('value', snap => {
    const all = snap.val();
    const allRecords = all ? Object.values(all) : [];

    if (isSuperAdmin()) {
      dashMmasData = allRecords;
      _finishMmasLoad(dashMmasData);
    } else if (isInstitutionMode()) {
      resolveAllowedWorkspaces().then(allowedWS => {
        dashMmasData = allRecords.filter(r => {
          const code   = (r.institution_code   || '').toUpperCase();
          const parent = (r.parent_institution || '').toUpperCase();
          if (allowedWS === null) return true;
          return code === ws || parent === ws || allowedWS.has(code);
        });
        _finishMmasLoad(dashMmasData);
      });
    } else if (isPIMode()) {
      // PI sees their own workspace + all students whose parent_pi === this PI key
      resolveAllowedWorkspaces().then(allowedWS => {
        dashMmasData = allRecords.filter(r => {
          const code     = (r.institution_code || '').toUpperCase();
          const parentPi = (r.parent_pi        || '').toUpperCase();
          return code === ws || parentPi === ws || (allowedWS && allowedWS.has(code));
        });
        _finishMmasLoad(dashMmasData);
      });
    } else {
      dashMmasData = allRecords.filter(r =>
        (r.institution_code || '').toUpperCase() === ws
      );
      _finishMmasLoad(dashMmasData);
    }
  });
}

/**
 * Post-processes a loaded MMAS dataset: renders the dashboard, updates the timestamp label,
 * kicks off RPP/analytics/correlation rendering, and logs the audit event.
 * @param {Object[]} dashMmasData - Array of MMAS assessment records
 * @returns {void}
 */
function _finishMmasLoad(dashMmasData) {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const ws = (currentWorkspace || '').toUpperCase();
  // P1: Normalize patient_number on all MMAS records before processing
  if (Array.isArray(dashMmasData)) {
    dashMmasData = dashMmasData.map(r => ({ ...r, patient_number: typeof _normPatientNum === 'function' ? _normPatientNum(r.patient_number) : String(r.patient_number || '').trim().toLowerCase() }));
  }
  renderMmasDashboard(dashMmasData, isInstitutionMode());
  document.getElementById('mmas-last-updated').textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();
  if (!isInstitutionMode() && !isSuperAdmin() && currentWorkspace && currentWorkspace !== 'EXPLORER') {
    rppBuild(dashMmasData);
  }
  setTimeout(() => {
    renderAPE(dashMmasData);
    renderPEDomainAnalysis(dashMmasData);
    renderStratification();
    renderTrajectoryCards(dashMmasData);
    if (isInstitutionMode() || isSuperAdmin()) renderBenchmarking(dashMmasData);
    if (isInstitutionMode()) renderInstitutionDashboard();
  }, 200);
  _corrDataReady.mmas = true;
  _maybeRenderCorrelation();
  // Refresh MTM audit log with latest cohort data
  if (typeof mtmRender === 'function') setTimeout(mtmRender, 100);
  // Refresh student desktop stats now that dashMmasData is populated
  if (document.getElementById('stu-session-count')) {
    _updateStudentSessionStats();
    _renderStudentReviewTable(true);
  }
  // Refresh explorer usage meter now that assessment data is loaded
  if (typeof window._explorerUpdateUsage === 'function') {
    window._explorerUpdateUsage();
  }
  // Refresh clinician dashboard KPIs + sentinel + billing
  if (document.getElementById('clinician-dash-panel')) {
    _updateClinicianDash();
  }
  // Populate Track A · MAP records tab
  if (document.getElementById('map-records-tbody')) {
    _renderMapRecordsTab(dashMmasData);
  }

  // Real-time listener — skip for keyless sessions only.
  // Freemium users (EXPL-XXXXXXXX) have a real isolated cohort and do get live updates.
  if (!ws || ws === 'EXPLORER' || ws === 'INDEPENDENT') return;

  if (window._mmasDashListener) {
    try { database.ref('assessments').off('child_added', window._mmasDashListener); } catch(e) {}
  }
  const since = Date.now();
  window._mmasDashListener = database.ref('assessments').on('child_added', snap => {
    const r = snap.val();
    if (!r || r.timestamp <= since) return;
    // If allowed workspace cache hasn't resolved yet, defer this record to next full reload
    if (!isSuperAdmin() && !isInstitutionMode() && typeof _allowedWSCache === 'undefined') {
      clearTimeout(window._mmasDashRefreshTimer);
      window._mmasDashRefreshTimer = setTimeout(() => {
        if (typeof loadMmasCohortData === 'function') loadMmasCohortData();
      }, 1200);
      return;
    }
    const rWs     = (r.institution_code   || '').toUpperCase();
    const rParent = (r.parent_institution || '').toUpperCase();
    const rParentPi = (r.parent_pi || '').toUpperCase();
    const allowedSet = _allowedWSCache;
    const belongs = isSuperAdmin()
      ? true
      : isInstitutionMode()
        ? (rWs === ws || rParent === ws || (allowedSet && allowedSet.has(rWs)))
        : isPIMode()
          ? (rWs === ws || rParentPi === ws || (allowedSet && allowedSet.has(rWs)))
          : rWs === ws;
    if (belongs) {
      clearTimeout(window._mmasDashRefreshTimer);
      window._mmasDashRefreshTimer = setTimeout(() => {
        loadMmasCohortData();
        if (typeof refreshCommandCenter === 'function' && (isInstitutionMode() || isSuperAdmin())) {
          refreshCommandCenter();
        }
      }, 1200);
    }
  });
}

// ══════════════════════════════════════════════
// TRACK A · MAP RECORDS TAB
// Multidimensional Adherence Parameters
// Arch = mean(map_q2,map_q3,map_q6) · Exec = mean(map_q1,map_q4,map_q5,map_q8) · Ctx = map_q7
// ══════════════════════════════════════════════
function _renderMapRecordsTab(records) {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  if (!records || !records.length) return;
  // Only rows saved with tool:'map' — discriminates from MMAS-8 records
  // Legacy records (pre-tool-field) that carry map_q1 are also included
  const mapRows = records.filter(r => r.tool === 'map' || r.map_q1 !== undefined).slice().reverse();

  // Domain helpers — correct MAP PE mapping (Morisky 2026)
  // Architecture (A): intentional decision-making — Q2, Q3, Q6
  // Execution (E): behavioral reliability — Q1, Q5, Q8
  // Context (C_g): Context-Guard — 0.5 + 0.5×mean(Q4,Q7), floors at 0.5 to prevent PE collapse
  // Always computed from item-level data; stored scores are unreliable for legacy records.
  function _arch(r) { return ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; }
  function _exec(r) { return ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; }
  function _ctx(r)  { return 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; }
  function _pat(r) {
    if (r.score===8) return 'high';
    if (typeof classifyPattern==='function') {
      const cp=classifyPattern(r);
      if (cp.intentional>cp.unintentional) return 'ina';
      if (cp.unintentional>cp.intentional) return 'una';
      return 'mixed';
    }
    return 'una';
  }
  const patMap = {ina:'<span class="pattern-pill pattern-ina">INA</span>',una:'<span class="pattern-pill pattern-una">UNA</span>',mixed:'<span class="pattern-pill pattern-mixed">Mixed</span>',high:'<span class="pattern-pill pattern-high">High</span>'};

  // ── Stats ──────────────────────────────────────────────────────────
  const n = mapRows.length;
  const set_el = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  if (n) {
    const countries = new Set(mapRows.map(r=>r.country).filter(Boolean));
    const scores  = mapRows.map(r=>+r.score);
    const archs   = mapRows.map(r=>_arch(r));
    const execs   = mapRows.map(r=>_exec(r));
    const ctxs    = mapRows.map(r=>_ctx(r));
    const avg     = v => (v.reduce((a,b)=>a+b,0)/v.length).toFixed(2);
    const pats    = mapRows.map(r=>_pat(r));
    const nIna   = pats.filter(p=>p==='ina').length;
    const nUna   = pats.filter(p=>p==='una').length;
    const nMixed = pats.filter(p=>p==='mixed').length;
    const nHigh  = pats.filter(p=>p==='high').length;
    // Compute cohort average PE — use stored pe_score when available, else derive
    const peScores = mapRows.map(r => +r.pe_score || Math.pow(Math.max(0,_arch(r)*_exec(r)*_ctx(r)),1/3));
    const avgArch = archs.reduce((a,b)=>a+b,0)/archs.length;
    const avgExec = execs.reduce((a,b)=>a+b,0)/execs.length;
    const avgCtx  = ctxs.reduce((a,b)=>a+b,0)/ctxs.length;
    const avgPE   = peScores.reduce((a,b)=>a+b,0)/peScores.length;
    set_el('map-total', n);
    set_el('map-countries', countries.size);
    set_el('map-avg', avg(scores));
    set_el('map-arch-avg', avg(archs));
    set_el('map-exec-avg', avg(execs));
    set_el('map-ctx-avg', avg(ctxs));
    set_el('map-n-ina',   nIna);
    set_el('map-n-una',   nUna);
    set_el('map-n-mixed', nMixed);
    set_el('map-n-high',  nHigh);
    // ── Sync Track A dashboard card ──────────────────────────────────────
    set_el('mc-map-total',    n.toLocaleString());
    set_el('mc-map-countries',countries.size);
    set_el('mc-map-avg',      avg(scores));
    set_el('mc-map-arch',     avg(archs));
    set_el('mc-map-exec',     avg(execs));
    set_el('mc-map-ctx',      avg(ctxs));
    set_el('mc-map-pe-avg',   (isNaN(avgPE)||!isFinite(avgPE)) ? '—' : avgPE.toFixed(3));
    set_el('mc-map-ina-count',   nIna);
    set_el('mc-map-una-count',   nUna);
    set_el('mc-map-mixed-count', nMixed);
    set_el('mc-map-high-count',  nHigh);
    // Dist bar on the MAP card
    const _s = id => { const el=document.getElementById(id); if(el) el.style.width=(arguments[1]||'0')+'%'; };
    if (n>0) {
      document.getElementById('map-card-seg-high')  && (document.getElementById('map-card-seg-high').style.width  = (nHigh/n*100)+'%');
      document.getElementById('map-card-seg-una')   && (document.getElementById('map-card-seg-una').style.width   = (nUna/n*100)+'%');
      document.getElementById('map-card-seg-ina')   && (document.getElementById('map-card-seg-ina').style.width   = (nIna/n*100)+'%');
      document.getElementById('map-card-seg-mixed') && (document.getElementById('map-card-seg-mixed').style.width = (nMixed/n*100)+'%');
    }
    // Show MAP export button on card
    const mapCardExport = document.getElementById('dash-map-export-btn');
    if (mapCardExport && n > 0) mapCardExport.style.display = '';
  }
  const lastUpdEl = document.getElementById('map-last-updated');
  if (lastUpdEl) lastUpdEl.textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();

  // ── Pagination state ───────────────────────────────────────────────
  window._mapSearch   = window._mapSearch   || '';
  window._mapPageSize = window._mapPageSize || 50;
  let _mapPage = 0;

  const getFiltered = () => {
    const q = (window._mapSearch||'').toLowerCase().trim();
    if (!q) return mapRows;
    return mapRows.filter(r=>(r.patient_number||'').toLowerCase().includes(q)||(r.country||'').toLowerCase().includes(q));
  };

  function renderPage(page) {
    const tbody = document.getElementById('map-records-tbody');
    if (!tbody) return;
    const PAGE_SIZE = +(document.getElementById('map-records-pagesize')||{value:window._mapPageSize||50}).value || window._mapPageSize || 50;
    window._mapPageSize = PAGE_SIZE;
    const filtered = getFiltered();
    _mapPage = Math.max(0, Math.min(page, Math.max(0, Math.ceil(filtered.length/PAGE_SIZE)-1)));
    const rows = filtered.slice(_mapPage*PAGE_SIZE, (_mapPage+1)*PAGE_SIZE);
    if (!rows.length) {
      tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:16px;font-family:var(--font-mono);font-size:0.84rem;">No records match this filter.</td></tr>';
      const pg=document.getElementById('map-records-pager'); if(pg) pg.style.display='none';
      return;
    }
    tbody.innerHTML = rows.map((r,i)=>{
      const a=_arch(r), e=_exec(r), c=_ctx(r);
      const cat=typeof getAdherenceCategory==='function'?getAdherenceCategory(r.score):{color:'var(--text)'};
      const d=new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const rowN = _mapPage*PAGE_SIZE+i+1;
      const pid = r.patient_number||('PAT-'+rowN);
      return `<tr style="cursor:pointer;" onclick="showPatientRecordByKey(${JSON.stringify((r.user_id||'')+"|"+(r.timestamp||'0'))})">
        <td style="color:var(--dim);font-size:0.82rem;">${rowN}</td>
        <td style="color:${cat.color};font-weight:600;">${r.score.toFixed(2)}</td>
        <td style="color:var(--base);font-family:var(--font-mono);">${a.toFixed(2)}</td>
        <td style="color:var(--mvmt);font-family:var(--font-mono);">${e.toFixed(2)}</td>
        <td style="color:var(--strata);font-family:var(--font-mono);">${c.toFixed(2)}</td>
        <td>${patMap[_pat(r)]||'—'}</td>
        <td>${_esc(r.country)||'Unknown'}</td>
        <td style="color:var(--dim);font-size:0.84rem;">${d}</td>
      </tr>`;
    }).join('');
    const pager = document.getElementById('map-records-pager');
    if (pager) {
      const tp = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
      pager.style.display = tp>1 ? 'flex' : 'none';
      const lbl = document.getElementById('map-page-label');
      if (lbl) lbl.textContent = `${_mapPage*PAGE_SIZE+1}–${Math.min((_mapPage+1)*PAGE_SIZE,filtered.length)} of ${filtered.length}`;
      const prev = document.getElementById('map-page-prev'); if(prev) prev.disabled = _mapPage===0;
      const next = document.getElementById('map-page-next'); if(next) next.disabled = _mapPage>=tp-1;
    }
  }
  window._mapRenderPage = renderPage;
  window._mapPage = 0;
  renderPage(0);
}

function exportMapCSV() {
  const records = (typeof dashMmasData!=='undefined'&&Array.isArray(dashMmasData)?dashMmasData:[])
    .filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  if (!records.length) { alert('No MAP records to export.'); return; }
  function _arch(r){ return ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; }
  function _exec(r){ return ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; }
  function _ctx(r) { return 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; }
  function _pat(r) {
    if (r.score===8) return 'high';
    if (typeof classifyPattern==='function'){ const cp=classifyPattern(r); return cp.intentional>cp.unintentional?'ina':cp.unintentional>cp.intentional?'una':'mixed'; }
    return 'una';
  }
  const header = 'patient_number,score,arch,exec,ctx,pattern,condition,country,timestamp';
  const rows = records.map(r=>[
    r.patient_number||'',
    r.score.toFixed(2),
    _arch(r).toFixed(2),
    _exec(r).toFixed(2),
    _ctx(r).toFixed(2),
    _pat(r),
    (r.condition||'').replace(/,/g,' '),
    (r.country||'').replace(/,/g,' '),
    r.timestamp||''
  ].join(','));
  const csv = [header,...rows].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='MAP_Export_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// DESCRIPTIVE STATISTICS HELPERS
// ══════════════════════════════════════════════
function calcMedian(scores) {
  if (!scores.length) return null;
  const sorted = scores.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcMode(scores) {
  if (!scores.length) return null;
  // Round to 2dp to handle Q8 fractional values (0.75, 0.5 etc)
  const freq = {};
  scores.forEach(s => {
    const k = parseFloat(s.toFixed(2));
    freq[k] = (freq[k] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  // If all values appear equally often, no meaningful mode — return null
  if (maxFreq === 1) return null;
  const modes = Object.keys(freq).filter(k => freq[k] === maxFreq).map(Number);
  // Return lowest mode if multimodal (most common in adherence bimodal distributions)
  return modes.sort((a, b) => a - b)[0];
}

function renderMmasDashboard(records, isInstitution) {
  const total = records.length;
  const countries = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown'));
  const scores = records.map(r => r.score || 0);
  let ts=0; records.forEach(r=>ts+=r.score||0);
  const avg    = total > 0 ? ts/total : 0;
  const median = total > 0 ? calcMedian(scores) : null;
  const mode   = total > 0 ? calcMode(scores)   : null;
  const high = records.filter(r=>r.score===8).length;

  // Update panel context label
  const lastUpdEl = document.getElementById('mmas-last-updated');
  const panelTitleEl = document.querySelector('.mmas-panel .panel-title');
  if (panelTitleEl) {
    if (isInstitution) {
      const label = workspaceProfile ? (workspaceProfile.name || currentWorkspace) : currentWorkspace;
      panelTitleEl.textContent = label + ' · Cohort';
    } else {
      panelTitleEl.textContent = 'Global Pool';
    }
  }

  document.getElementById('mmas-total').textContent = total.toLocaleString();
  document.getElementById('mmas-countries').textContent = countries.size;
  const _avgEl = document.getElementById('mmas-avg');
  if (_avgEl) {
    const _avgStr = avg > 0 ? avg.toFixed(2) : '—';
    const _avgBadge = (avg > 0 && typeof mmasScoreInterpretation === 'function')
      ? mmasScoreInterpretation(avg).badge : '';
    _avgEl.innerHTML = _avgStr + _avgBadge;
  }
  // Inject score guide strip once beneath the avg stat card
  const _guideId = 'mmas-avg-score-guide';
  if (!document.getElementById(_guideId)) {
    const _avgParent = document.getElementById('mmas-avg') && document.getElementById('mmas-avg').closest('.stat-card, .stat-box, .kpi-card, [class*="card"]');
    const _guideTarget = _avgParent || (document.getElementById('mmas-avg') && document.getElementById('mmas-avg').parentElement);
    if (_guideTarget) {
      const _guide = document.createElement('div');
      _guide.id = _guideId;
      _guide.className = 'mmas-score-guide';
      _guide.innerHTML = '<span class="mmas-score-guide-item"><span class="mmas-badge mmas-high">HIGH</span> = 8</span>'
        + '<span class="mmas-score-guide-item"><span class="mmas-badge mmas-medium">MED</span> = 6–7</span>'
        + '<span class="mmas-score-guide-item"><span class="mmas-badge mmas-low">LOW</span> = &lt;6</span>';
      _guideTarget.appendChild(_guide);
    }
  }
  const medEl = document.getElementById('mmas-median');
  if (medEl) medEl.textContent = median !== null ? median.toFixed(2) : '—';
  const modEl = document.getElementById('mmas-mode');
  if (modEl) modEl.textContent = mode !== null ? mode.toFixed(2) : '—';
  document.getElementById('mmas-high-pct').textContent = total>0?Math.round(high/total*100)+'%':'—';
  document.getElementById('mmas-n-high').textContent = high;
  // Sync mission control card
  const e=id=>document.getElementById(id);
  if(e('mc-mmas-total'))e('mc-mmas-total').textContent=total.toLocaleString();
  if(e('mc-mmas-countries'))e('mc-mmas-countries').textContent=countries.size;
  if(e('mc-mmas-avg'))e('mc-mmas-avg').textContent=avg>0?avg.toFixed(2):'—';
  if(e('pulse-mmas-total'))e('pulse-mmas-total').textContent=total.toLocaleString();
  if(e('pulse-countries'))e('pulse-countries').textContent=countries.size;
  if(e('pulse-avg'))e('pulse-avg').textContent=avg>0?avg.toFixed(2):'—';

  let ina=0, una=0, mixed=0;
  records.forEach(r => {
    if (r.q1 === undefined) { una++; return; }
    const {intentional, unintentional} = classifyPattern(r);
    if ((r.score||0)>=8) return;
    if (intentional>unintentional) ina++;
    else if (unintentional>intentional) una++;
    else mixed++;
  });
  document.getElementById('mmas-n-ina').textContent = ina;
  document.getElementById('mmas-n-una').textContent = una;
  document.getElementById('mmas-n-mixed').textContent = mixed;
  // Sync mc INA boxes
  const e2=id=>document.getElementById(id);
  if(e2('mc-ina-count'))e2('mc-ina-count').textContent=ina;
  if(e2('mc-una-count'))e2('mc-una-count').textContent=una;
  if(e2('mc-mixed-count'))e2('mc-mixed-count').textContent=mixed;
  if(e2('mc-high-count'))e2('mc-high-count').textContent=high;
  renderBenchmarkStrip('res-benchmark-container', avg > 0 ? avg : 0, total);

  if (total > 0) {
    document.getElementById('mmas-seg-high').style.width  = (high/total*100)+'%';
    document.getElementById('mmas-seg-una').style.width   = (una/total*100)+'%';
    document.getElementById('mmas-seg-ina').style.width   = (ina/total*100)+'%';
    document.getElementById('mmas-seg-mixed').style.width = (mixed/total*100)+'%';
  }

  // Individual records table
  const tbody = document.getElementById('mmas-records-tbody');
  if (tbody) {
    if (!records.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:16px;">No records yet.</td></tr>'; return; }
    const patMap = {ina:'<span class="pattern-pill pattern-ina">INA</span>', una:'<span class="pattern-pill pattern-una">UNA</span>', mixed:'<span class="pattern-pill pattern-mixed">Mixed</span>', high:'<span class="pattern-pill pattern-high">High</span>'};
    const _allRows = records.slice().reverse(); // newest first, all records
    window._dashRecords = _allRows;
    window._mmasSearch = window._mmasSearch || '';
    window._mmasPageSize = window._mmasPageSize || 50;

    // ── Pagination state ──────────────────────────────────────────────────
    let _page = 0;
    const getFilteredRows = () => {
      const q = (window._mmasSearch || '').toLowerCase().trim();
      if (!q) return _allRows;
      return _allRows.filter(r => (r.patient_number||'').toLowerCase().includes(q) || (r.country||'').toLowerCase().includes(q));
    };
    const totalPages = () => {
      const ps = +(document.getElementById('mmas-records-pagesize') || {value: window._mmasPageSize || 50}).value || window._mmasPageSize || 50;
      return Math.max(1, Math.ceil(getFilteredRows().length / ps));
    };

    // ── Build patient_number → sorted scores for trajectory ──────────────────
    const patHistory = {};
    records.forEach(r => {
      if (!r.patient_number) return;
      if (!patHistory[r.patient_number]) patHistory[r.patient_number] = [];
      patHistory[r.patient_number].push({ score: r.score, ts: r.timestamp });
    });
    Object.values(patHistory).forEach(arr => arr.sort((a,b)=>a.ts-b.ts));

    function renderPage(page) {
      const PAGE_SIZE = +(document.getElementById('mmas-records-pagesize') || {value: window._mmasPageSize || 50}).value || window._mmasPageSize || 50;
      window._mmasPageSize = PAGE_SIZE;
      const filteredRows = getFilteredRows();
      _page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(filteredRows.length / PAGE_SIZE) - 1)));
      const _rows = filteredRows.slice(_page * PAGE_SIZE, (_page + 1) * PAGE_SIZE);
      if (!_rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:16px;font-family:var(--font-mono);font-size:0.84rem;">No records match this filter.</td></tr>';
        const pager2 = document.getElementById('mmas-records-pager');
        if (pager2) pager2.style.display = 'none';
        return;
      }
      tbody.innerHTML = _rows.map((r,i)=>{
        const cat = getAdherenceCategory(r.score);
        let pat='una';
        if(r.score===8) pat='high';
        else if(r.q1!==undefined){ const {intentional,unintentional}=classifyPattern(r); pat=intentional>unintentional?'ina':unintentional>intentional?'una':'mixed'; }
        const d=new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const zBadge=r.zoe_session?'<span style="font-size:0.80rem;padding:1px 5px;border-radius:8px;background:rgba(139,111,245,0.12);color:rgba(139,111,245,0.7);border:1px solid rgba(139,111,245,0.2);margin-left:4px;">ZOE</span>':'';
        const sBadge=r.soap_note?'<span style="font-size:0.80rem;padding:1px 5px;border-radius:8px;background:rgba(46,201,138,0.1);color:rgba(46,201,138,0.7);border:1px solid rgba(46,201,138,0.2);margin-left:3px;">SOAP</span>':'';
        let trajCell = '<td style="color:var(--dim);font-size:0.90rem;">—</td>';
        if (r.patient_number && patHistory[r.patient_number] && patHistory[r.patient_number].length >= 2) {
          const hist = patHistory[r.patient_number];
          const first = hist[0].score, last = hist[hist.length-1].score;
          const delta = last - first;
          const tColor = delta > 0.1 ? '#10b981' : delta < -0.1 ? '#ef4444' : '#6b8099';
          const tIcon  = delta > 0.1 ? '↑' : delta < -0.1 ? '↓' : '→';
          const tLabel = delta > 0.1 ? 'Improving' : delta < -0.1 ? 'Declining' : 'Stable';
          const pts = hist.map(h=>h.score);
          const W=48, H=18;
          const minS=Math.min(...pts), maxS=Math.max(...pts), range=maxS-minS||1;
          const coords = pts.map((s,ii)=>{ const x=ii/(pts.length-1||1)*W; const y=H-(s-minS)/range*H; return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
          trajCell = `<td title="${tLabel}: ${first.toFixed(2)} → ${last.toFixed(2)} (${delta>=0?'+':''}${delta.toFixed(2)})">
            <div style="display:flex;align-items:center;gap:4px;">
              <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="flex-shrink:0;">
                <polyline points="${coords}" fill="none" stroke="${tColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
                <circle cx="${(pts.length>1?(pts.length-1)/(pts.length-1||1):0)*W}" cy="${H-(pts[pts.length-1]-minS)/range*H}" r="2.5" fill="${tColor}"/>
              </svg>
              <span style="font-size:0.88rem;color:${tColor};font-weight:600;">${tIcon}</span>
            </div>
          </td>`;
        }
        // APE phenotype badge per patient
        let apeBadge = '<td style="color:var(--dim);font-size:0.90rem;">—</td>';
        if (r.score === 8) {
          apeBadge = '<td><span style="font-size:0.82rem;padding:2px 7px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.25);white-space:nowrap;">High Adherence</span></td>';
        } else if (r.q1 !== undefined && typeof classifyApePhenotype === 'function') {
          const apeResult = classifyApePhenotype(r);
          if (apeResult && apeResult.length) {
            const top = apeResult[0];
            const c = top.phenotype.color || '#6b8099';
            const ico = top.phenotype.icon || '';
            const pct = Math.round(top.prob * 100);
            const label = top.phenotype.name || top.phenotype.id;
            apeBadge = `<td title="${label} (${pct}% probability)"><span style="font-size:0.82rem;padding:2px 7px;border-radius:8px;background:${c}18;color:${c};border:1px solid ${c}35;white-space:nowrap;">${ico} ${label}</span></td>`;
          }
        }
        return `<tr style="cursor:pointer;" onclick="showPatientRecordByKey(${JSON.stringify(r.user_id+'|'+r.timestamp)})"><td>${_esc(r.patient_number)||('PAT-'+((_page*PAGE_SIZE)+i+1))}${zBadge}${sBadge}</td><td style="color:${cat.color};font-weight:600;">${r.score.toFixed(2)}</td><td>${patMap[pat]}</td>${apeBadge}<td>${_esc(r.country)||'Unknown'}</td><td>${d}</td>${trajCell}</tr>`;
      }).join('');

      // Update pagination controls
      const pager = document.getElementById('mmas-records-pager');
      const filteredRows2 = getFilteredRows();
      const PAGE_SIZE2 = window._mmasPageSize || 50;
      if (pager) {
        const tp = Math.max(1, Math.ceil(filteredRows2.length / PAGE_SIZE2));
        pager.style.display = tp > 1 ? 'flex' : 'none';
        document.getElementById('mmas-page-label').textContent =
          `${_page * PAGE_SIZE2 + 1}–${Math.min((_page + 1) * PAGE_SIZE2, filteredRows2.length)} of ${filteredRows2.length}`;
        document.getElementById('mmas-page-prev').disabled = _page === 0;
        document.getElementById('mmas-page-next').disabled = _page >= tp - 1;
      }
    }
    window._mmasRenderPage = renderPage;

    // Inject pagination controls above table if not present
    const tableWrap = tbody.closest('table') || tbody.parentElement;
    let pager = document.getElementById('mmas-records-pager');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'mmas-records-pager';
      pager.style.cssText = 'display:none;align-items:center;justify-content:flex-end;gap:8px;padding:8px 4px;font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);';
      pager.innerHTML = `
        <button id="mmas-page-prev" style="font-family:var(--font-mono);font-size:0.90rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:6px;padding:4px 10px;cursor:pointer;" onclick="window._mmasPagePrev && window._mmasPagePrev()">← Prev</button>
        <span id="mmas-page-label" style="color:var(--muted);"></span>
        <button id="mmas-page-next" style="font-family:var(--font-mono);font-size:0.90rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:6px;padding:4px 10px;cursor:pointer;" onclick="window._mmasPageNext && window._mmasPageNext()">Next →</button>`;
      tableWrap.parentElement.insertBefore(pager, tableWrap);
    }
    window._mmasPagePrev = () => renderPage(_page - 1);
    window._mmasPageNext = () => renderPage(_page + 1);

    renderPage(0);
  }
}

function loadPeacsCohortData() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  atlasAuditLog('cohort_read_peacs', { workspace: currentWorkspace });
  const ws = (currentWorkspace || '').toUpperCase();

  // Truly keyless session — empty state
  if (!ws || ws === 'EXPLORER' || ws === 'INDEPENDENT') {
    dashPeacsData = [];
    renderPeacsDashboard([], false);
    const luEl = document.getElementById('peacs-last-updated');
    if (luEl) luEl.textContent = 'No assessments yet';
    _corrDataReady.peacs = true;
    _maybeRenderCorrelation();
    return;
  }

  document.getElementById('peacs-last-updated').textContent = _t.status_loading || 'Loading…';
  database.ref('peacs_assessments').once('value', snap => {
    const all = snap.val();
    const allRecords = all ? Object.values(all) : [];
    const ws = (currentWorkspace || '').toUpperCase();

    if (isSuperAdmin()) {
      dashPeacsData = allRecords;
      renderPeacsDashboard(dashPeacsData, isInstitutionMode());
      document.getElementById('peacs-last-updated').textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();
      _corrDataReady.peacs = true;
      _maybeRenderCorrelation();
      // Re-render institution dashboard now that PEACS data is available —
      // the first render (triggered by MMAS load) ran with dashPeacsData still empty.
      setTimeout(renderInstitutionDashboard, 50);
      return;
    } else if (isInstitutionMode()) {
      resolveAllowedWorkspaces().then(allowedWS => {
        dashPeacsData = allRecords.filter(r => {
          const code   = (r.institution_code  || '').toUpperCase();
          const parent = (r.parent_institution || '').toUpperCase();
          if (allowedWS === null) return true;
          return code === ws || parent === ws || allowedWS.has(code);
        });
        renderPeacsDashboard(dashPeacsData, isInstitutionMode());
        document.getElementById('peacs-last-updated').textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();
        _corrDataReady.peacs = true;
        _maybeRenderCorrelation();
      });
      return;
    } else if (isPIMode()) {
      // PI sees own workspace + direct students (parent_pi) + co-PI sites (allowedWS)
      resolveAllowedWorkspaces().then(allowedWS => {
        dashPeacsData = allRecords.filter(r => {
          const code     = (r.institution_code || '').toUpperCase();
          const parentPi = (r.parent_pi        || '').toUpperCase();
          return code === ws || parentPi === ws || (allowedWS && allowedWS.has(code));
        });
        renderPeacsDashboard(dashPeacsData, isInstitutionMode());
        document.getElementById('peacs-last-updated').textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();
        if (typeof rppMergePeacs === 'function') rppMergePeacs(dashPeacsData);
        _corrDataReady.peacs = true;
        _maybeRenderCorrelation();
      });
      return;
    } else if (!ws || ws === 'EXPLORER' || ws === 'INDEPENDENT') {
      // Handled above before Firebase call — should not reach here.
      dashPeacsData = [];
    } else {
      dashPeacsData = allRecords.filter(r =>
        (r.institution_code || '').toUpperCase() === ws
      );
    }

    // P1: Normalize patient_number on all PEACS records before processing
    if (Array.isArray(dashPeacsData)) {
      dashPeacsData = dashPeacsData.map(r => ({ ...r, patient_number: typeof _normPatientNum === 'function' ? _normPatientNum(r.patient_number) : String(r.patient_number || '').trim().toLowerCase() }));
    }
    renderPeacsDashboard(dashPeacsData, isInstitutionMode());
    document.getElementById('peacs-last-updated').textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString();
    // Researcher/student patient panel — merge PEACS when it loads
    if (!isInstitutionMode() && !isSuperAdmin() && currentWorkspace && currentWorkspace !== 'EXPLORER') {
      rppMergePeacs(dashPeacsData);
    }
    // Signal correlation chart coordinator
    _corrDataReady.peacs = true;
    _maybeRenderCorrelation();

    // Live listener: auto-refresh PEACS dashboard on new submissions (mirrors MMAS pattern)
    if (window._peacsDashListener) {
      try { database.ref('peacs_assessments').off('child_added', window._peacsDashListener); } catch(e) {}
    }
    const _peacsSince = Date.now();
    window._peacsDashListener = database.ref('peacs_assessments').on('child_added', snap => {
      const r = snap.val();
      if (!r || r.timestamp <= _peacsSince) return;
      // If allowed workspace cache hasn't resolved yet, defer this record to next full reload
      if (!isSuperAdmin() && !isInstitutionMode() && typeof _allowedWSCache === 'undefined') {
        clearTimeout(window._peacsDashRefreshTimer);
        window._peacsDashRefreshTimer = setTimeout(() => {
          if (typeof loadPeacsCohortData === 'function') loadPeacsCohortData();
        }, 1200);
        return;
      }
      const rWs     = (r.institution_code   || '').toUpperCase();
      const rParent   = (r.parent_institution || '').toUpperCase();
      const rParentPi = (r.parent_pi          || '').toUpperCase();
      const allowedSet = _allowedWSCache;
      const belongs = isSuperAdmin()
        ? true
        : isInstitutionMode()
          ? (rWs === ws || rParent === ws || (allowedSet && allowedSet.has(rWs)))
          : isPIMode()
            ? (rWs === ws || rParentPi === ws || (allowedSet && allowedSet.has(rWs)))
            : rWs === ws;
      if (belongs) {
        clearTimeout(window._peacsDashRefreshTimer);
        window._peacsDashRefreshTimer = setTimeout(() => {
          loadPeacsCohortData();
          if (typeof refreshCommandCenter === 'function' &&
              (isInstitutionMode() || isSuperAdmin())) {
            refreshCommandCenter();
          }
        }, 1200);
      }
    });
  });
}

function renderPeacsDashboard(records, isInstitution) {
  const total = records.length;
  const countries = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown'));
  // Update panel label
  const peacsTitleEl = document.querySelector('.peacs-panel .panel-title');
  if (peacsTitleEl) {
    if (isInstitution) {
      const label = workspaceProfile ? (workspaceProfile.name || currentWorkspace) : currentWorkspace;
      peacsTitleEl.textContent = label + ' · Cohort';
    } else {
      peacsTitleEl.textContent = 'Global Pool';
    }
  }
  let pes=0; records.forEach(r=>pes+=(r.pe||0));
  const avgPE = total>0?pes/total:0;
  const sdPE  = total>1
    ? Math.sqrt(records.reduce((s,r)=>s+Math.pow((r.pe||0)-avgPE,2),0)/(total-1))
    : 0;
  const opt = records.filter(r=>(r.pe||0)>=0.85).length;

  document.getElementById('peacs-total').textContent = total.toLocaleString();
  document.getElementById('peacs-countries').textContent = countries.size;
  document.getElementById('peacs-avg-pe').textContent = avgPE>0?avgPE.toFixed(3):'—';
  const sdEl = document.getElementById('peacs-sd-pe');
  if (sdEl) sdEl.textContent = total>1 ? '±'+sdPE.toFixed(3) : '—';
  const avgBase=total>0?records.reduce((s,r)=>s+(r.base||0),0)/total:0;
  const avgMvmt=total>0?records.reduce((s,r)=>s+(r.mvmt||0),0)/total:0;
  const avgStrata=total>0?records.reduce((s,r)=>s+(r.strata||0),0)/total:0;
  const bEl=document.getElementById('peacs-avg-base');if(bEl)bEl.textContent=total>0?avgBase.toFixed(3):'—';
  const mEl=document.getElementById('peacs-avg-mvmt');if(mEl)mEl.textContent=total>0?avgMvmt.toFixed(3):'—';
  const sEl=document.getElementById('peacs-avg-strata');if(sEl)sEl.textContent=total>0?avgStrata.toFixed(3):'—';
  document.getElementById('peacs-optimal-pct').textContent = total>0?Math.round(opt/total*100)+'%':'—';
  // Sync mc card + pulse bar
  const ep=id=>document.getElementById(id);
  if(ep('mc-peacs-total'))ep('mc-peacs-total').textContent=total.toLocaleString();
  if(ep('mc-peacs-countries'))ep('mc-peacs-countries').textContent=countries.size;
  if(ep('mc-peacs-avg'))ep('mc-peacs-avg').textContent=avgPE>0?avgPE.toFixed(3):'—';
  if(ep('mc-peacs-avg-base'))ep('mc-peacs-avg-base').textContent=total>0?avgBase.toFixed(3):'—';
  if(ep('mc-peacs-avg-mvmt'))ep('mc-peacs-avg-mvmt').textContent=total>0?avgMvmt.toFixed(3):'—';
  if(ep('mc-peacs-avg-strata'))ep('mc-peacs-avg-strata').textContent=total>0?avgStrata.toFixed(3):'—';
  if(ep('pulse-peacs-total'))ep('pulse-peacs-total').textContent=total.toLocaleString();
  if(ep('pulse-avg-pe'))ep('pulse-avg-pe').textContent=avgPE>0?avgPE.toFixed(3):'—';

  const zones = {optimal:0,good:0,mod:0,poor:0,crit:0};
  records.forEach(r => {
    const pe = r.pe||0;
    if(pe>=0.85)zones.optimal++;
    else if(pe>=0.70)zones.good++;
    else if(pe>=0.55)zones.mod++;
    else if(pe>=0.40)zones.poor++;
    else zones.crit++;
  });
  document.getElementById('peacs-n-optimal').textContent = zones.optimal;
  document.getElementById('peacs-n-good').textContent    = zones.good;
  document.getElementById('peacs-n-mod').textContent     = zones.mod;
  document.getElementById('peacs-n-poor').textContent    = zones.poor;
  // Sync mc pe boxes
  const ep2=id=>document.getElementById(id);
  if(ep2('mc-pe-optimal'))ep2('mc-pe-optimal').textContent=zones.optimal;
  if(ep2('mc-pe-good'))ep2('mc-pe-good').textContent=zones.good;
  if(ep2('mc-pe-mod'))ep2('mc-pe-mod').textContent=zones.mod;
  if(ep2('mc-pe-poor'))ep2('mc-pe-poor').textContent=zones.poor;

  if (total > 0) {
    document.getElementById('peacs-seg-optimal').style.width = (zones.optimal/total*100)+'%';
    document.getElementById('peacs-seg-good').style.width    = (zones.good/total*100)+'%';
    document.getElementById('peacs-seg-mod').style.width     = (zones.mod/total*100)+'%';
    document.getElementById('peacs-seg-poor').style.width    = (zones.poor/total*100)+'%';
    document.getElementById('peacs-seg-crit').style.width    = (zones.crit/total*100)+'%';
  }

  const tbody = document.getElementById('peacs-records-tbody');
  if (tbody) {
    if (!records.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:16px;">No records yet.</td></tr>'; return; }
    const getZone = pe => pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
    const zoneColors = {'Optimal':'#10b981','Good':'#3b82f6','Moderate':'#f59e0b','Poor':'#ef4444','Critical':'#991b1b'};

    const _allPeacsRows = records.slice().reverse(); // newest first, all records
    window._peacsSearch   = window._peacsSearch   || '';
    window._peacsPageSize = window._peacsPageSize || 50;
    window._peacsPage     = 0;

    const getPeacsFiltered = () => {
      const q = (window._peacsSearch || '').toLowerCase().trim();
      if (!q) return _allPeacsRows;
      return _allPeacsRows.filter(r => (r.patient_number||'').toLowerCase().includes(q) || (r.country||'').toLowerCase().includes(q));
    };

    window._peacsRenderPage = function(page) {
      const PAGE_SIZE = +(document.getElementById('peacs-records-pagesize') || {value: window._peacsPageSize || 50}).value || window._peacsPageSize || 50;
      window._peacsPageSize = PAGE_SIZE;
      const filteredRows = getPeacsFiltered();
      const totalPgs = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
      window._peacsPage = Math.max(0, Math.min(page, totalPgs - 1));
      const pageRows = filteredRows.slice(window._peacsPage * PAGE_SIZE, (window._peacsPage + 1) * PAGE_SIZE);

      if (!pageRows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:16px;font-family:var(--font-mono);font-size:0.84rem;">No records match this filter.</td></tr>';
        const pager2 = document.getElementById('peacs-records-pager');
        if (pager2) pager2.style.display = 'none';
        return;
      }

      let _peacsIdx = window._peacsPage * PAGE_SIZE;
      tbody.innerHTML = pageRows.map((r) => {
        _peacsIdx++;
        const z = getZone(r.pe||0); const zc = zoneColors[z];
        const d = new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const patDisplay = r.patient_number || ('PAT-'+_peacsIdx);
        const isPartial = !!r.partial;
        return `<tr>
          <td style="font-family:var(--font-mono);font-size:0.71rem;color:var(--bright);">${patDisplay}</td>
          <td style="font-size:0.88rem;color:var(--dim);">${d}</td>
          <td style="color:var(--base);">${(r.base||0).toFixed(3)}</td>
          <td style="color:var(--mvmt);">${isPartial ? '—' : (r.mvmt||0).toFixed(3)}</td>
          <td style="color:var(--strata);">${isPartial ? '—' : (r.strata||0).toFixed(3)}</td>
          <td style="color:${isPartial?'var(--base)':zc};font-weight:600;">${isPartial ? (r.base||0).toFixed(3) : (r.pe||0).toFixed(4)}</td>
          <td><span style="font-size:0.90rem;padding:2px 7px;border-radius:10px;background:${isPartial?'rgba(78,156,245,0.12)':zc+'22'};color:${isPartial?'var(--base)':zc};border:1px solid ${isPartial?'rgba(78,156,245,0.3)':zc+'44'};">${isPartial ? 'BASE only' : z}</span></td>
          <td style="font-size:0.88rem;color:var(--dim);">${_esc(r.city)||'Unknown'}, ${_esc(r.country)||'Unknown'}</td>
        </tr>`;
      }).join('');

      const pager = document.getElementById('peacs-records-pager');
      if (pager) {
        pager.style.display = totalPgs > 1 ? 'flex' : 'none';
        const lbl = document.getElementById('peacs-page-label');
        const prev = document.getElementById('peacs-page-prev');
        const next = document.getElementById('peacs-page-next');
        if (lbl) lbl.textContent = `${window._peacsPage * PAGE_SIZE + 1}–${Math.min((window._peacsPage + 1) * PAGE_SIZE, filteredRows.length)} of ${filteredRows.length}`;
        if (prev) prev.disabled = window._peacsPage <= 0;
        if (next) next.disabled = window._peacsPage >= totalPgs - 1;
      }
    };

    window._peacsRenderPage(0);
  }
  // Wire schedule engine
  renderPeacsSchedule(records);
}

// ── PEACS Schedule Engine ─────────────────────────────
function renderPeacsSchedule(peacsData) {
  if (!peacsData || peacsData.length === 0) return;
  const now = new Date();
  const cadence = { base: 30, mvmt: 7, strata: 90 };
  const nextDue = { base: null, mvmt: null, strata: null };
  const windowRows = [];
  peacsData.forEach(p => {
    const lastBase   = p.last_base_date   ? new Date(p.last_base_date)   : (p.timestamp ? new Date(p.timestamp) : null);
    const lastMvmt   = p.last_mvmt_date   ? new Date(p.last_mvmt_date)   : (p.timestamp ? new Date(p.timestamp) : null);
    const lastStrata = p.last_strata_date ? new Date(p.last_strata_date) : (p.timestamp ? new Date(p.timestamp) : null);
    const computeNext = (lastDate, days) => lastDate ? new Date(lastDate.getTime() + days * 86400000) : null;
    const baseNext   = computeNext(lastBase,   cadence.base);
    const mvmtNext   = computeNext(lastMvmt,   cadence.mvmt);
    const strataNext = computeNext(lastStrata, cadence.strata);
    const statusFor = (nextDate) => {
      if (!nextDate) return 'pending';
      const diff = Math.round((nextDate - now) / 86400000);
      if (diff < 0)  return 'overdue';
      if (diff <= 2) return 'due-soon';
      return 'open';
    };
    windowRows.push({
      id:           p.patient_number || p.userId || '—',
      enrolled:     p.enrollDate ? new Date(p.enrollDate).toLocaleDateString() : '—',
      baseNext:     baseNext   ? baseNext.toLocaleDateString()   : '—',
      mvmtNext:     mvmtNext   ? mvmtNext.toLocaleDateString()   : '—',
      strataNext:   strataNext ? strataNext.toLocaleDateString() : '—',
      baseStatus:   statusFor(baseNext),
      mvmtStatus:   statusFor(mvmtNext),
      strataStatus: statusFor(strataNext)
    });
    ['base','mvmt','strata'].forEach(inst => {
      const nd = inst === 'base' ? baseNext : inst === 'mvmt' ? mvmtNext : strataNext;
      if (nd && (!nextDue[inst] || nd < nextDue[inst])) nextDue[inst] = nd;
    });
  });
  ['base','mvmt','strata'].forEach(inst => {
    const el = document.getElementById('peacs-' + inst + '-next');
    if (!el) return;
    const nd = nextDue[inst];
    if (!nd) { el.className = 'psc-next no-data'; el.textContent = 'No data'; return; }
    const diff = Math.round((nd - now) / 86400000);
    let cls, txt;
    if (diff < 0)        { cls = 'overdue';  txt = Math.abs(diff) + 'd overdue'; }
    else if (diff === 0) { cls = 'due-soon'; txt = 'Due today'; }
    else if (diff <= 2)  { cls = 'due-soon'; txt = 'Due in ' + diff + 'd'; }
    else                 { cls = 'on-track'; txt = nd.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
    el.className = 'psc-next ' + cls;
    el.textContent = txt;
  });
  const tbody = document.getElementById('peacs-window-tbody');
  if (tbody) {
    tbody.innerHTML = windowRows.map(r =>
      '<tr>' +
        '<td style="font-weight:600;">' + r.id + '</td>' +
        '<td>' + r.enrolled + '</td>' +
        '<td>' + r.baseNext + '</td>' +
        '<td>' + r.mvmtNext + '</td>' +
        '<td>' + r.strataNext + '</td>' +
        '<td><span class="peacs-status-pill ' + r.baseStatus + '">' + r.baseStatus.replace('-',' ') + '</span></td>' +
        '<td><span class="peacs-status-pill ' + r.mvmtStatus + '">' + r.mvmtStatus.replace('-',' ') + '</span></td>' +
        '<td><span class="peacs-status-pill ' + r.strataStatus + '">' + r.strataStatus.replace('-',' ') + '</span></td>' +
      '</tr>'
    ).join('') || '<tr><td colspan="8" style="color:#9ca3af;padding:12px;">No PEACS records.</td></tr>';
  }
}

// ══════════════════════════════════════════════
// CSV EXPORTS
// ══════════════════════════════════════════════
async function exportMmasCSV() {
  atlasAuditLog('export_mmas_csv', { workspace: currentWorkspace });
  // Phase 1: enforce CSV export cap for Student tier
  const capOk = await checkExportCap('mmas');
  if (!capOk) return;
  const isInstitution = isInstitutionMode();
  const isExplorer    = window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER';
  const superAdmin    = isSuperAdmin();
  showToast('Preparing MMAS export…', 2000);

  resolveAllowedWorkspaces().then(allowedWS => {
    // Superadmin gets a joined read (assessments + mapData) to include Firebase keys.
    // Researcher/institution gets a simple assessments read — no Firebase keys shown.
    const fetchPromise = superAdmin
      ? Promise.all([database.ref('assessments').once('value'), database.ref('mapData').once('value')])
      : Promise.all([database.ref('assessments').once('value'), Promise.resolve(null)]);

    fetchPromise.then(([aSnap, mSnap]) => {
      const data = aSnap.val();
      if (!data) { showToast('No data to export yet.'); return; }

      // Stamp Firebase keys and build mapData reverse index (superadmin only)
      let mapKeyIndex = {};
      if (superAdmin) {
        Object.entries(data).forEach(([k, v]) => { v._fbKey = k; });
        const mData = mSnap && mSnap.val();
        if (mData) {
          Object.entries(mData).forEach(([mapKey, m]) => {
            if (m && m.assessment_ref) mapKeyIndex[m.assessment_ref] = mapKey;
          });
        }
      }

      let records = Object.values(data);

      // Filter to workspace scope
      if (!superAdmin) {
        if (isExplorer || !currentWorkspace) { showToast('No active workspace — cannot export.'); return; }
        records = records.filter(a => {
          const code = (a.institution_code || '').toUpperCase();
          return allowedWS === null ? true : (code && allowedWS.has(code));
        });
      }

      const filename = 'mmas-cohort-'+(currentWorkspace||'global').toLowerCase()+'-'+new Date().toISOString().split('T')[0]+'.csv';

      // Superadmin: include Firebase keys as first two columns
      // Researcher/institution: standard columns only
      const _stdCols = [
        'Patient_Num','Institution','Timestamp','Country','City',
        'Score','Adherence_Level','INA_UNA',
        'Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8',
        'Condition','Num_Medications','MMAS_Linked_Drug','Drug_Strength','Dosing_Frequency','Route',
        'Gender','Age_Range','Education_Level',
        'Latitude','Longitude',
        'Study_Title','PI_Name','Study_Institution','IRB','ClinicalTrials_ID','Study_Phase','Upload_Source',
      ];
      const headers = superAdmin
        ? ['Assessments_Key','MapData_Key', ..._stdCols]
        : _stdCols;

      const rows = records.map(a => {
        let pat = 'N/A';
        if (a.q1 !== undefined) { const {intentional,unintentional} = classifyPattern(a); pat = a.score===8?'High':intentional>unintentional?'INA':unintentional>intentional?'UNA':'Mixed'; }
        const base = [
          a.patient_number||'N/A', a.institution_code||currentWorkspace, new Date(a.timestamp).toISOString(),
          a.country||'Unknown', a.city||'Unknown', (a.score||0).toFixed(2), a.adherence_level||'N/A', pat,
          a.q1 !== undefined ? a.q1 : '', a.q2 !== undefined ? a.q2 : '',
          a.q3 !== undefined ? a.q3 : '', a.q4 !== undefined ? a.q4 : '',
          a.q5 !== undefined ? a.q5 : '', a.q6 !== undefined ? a.q6 : '',
          a.q7 !== undefined ? a.q7 : '', a.q8 !== undefined ? a.q8 : '',
          a.condition||'', a.num_medications||'', a.drug_name||'', a.drug_strength||'',
          a.dosing_frequency||'', a.route_of_administration||'',
          a.gender||'', a.age_range||'', a.education_level||a.education||'',
          a.latitude||0, a.longitude||0,
          a.study_title||'', a.pi_name||'', a.study_institution||'',
          a.irb_number||'', a.clinicaltrials_id||'', a.study_phase||'',
          a.upload_source||'manual',
        ];
        if (superAdmin) {
          const mapKey = mapKeyIndex[a._fbKey] || '';
          return [('ID:' + (a._fbKey||'')), mapKey ? ('ID:' + mapKey) : '', ...base];
        }
        return base;
      });

      triggerCSVDownload(headers, rows, filename);
      showToast('Exported '+rows.length+' cohort records.', 3000);
    });
  });
}

async function exportPeacsCSV() {
  atlasAuditLog('export_peacs_csv', { workspace: currentWorkspace });
  // Phase 1: enforce CSV export cap for Student tier
  const capOk = await checkExportCap('peacs');
  if (!capOk) return;
  const isExplorer = window._wsMode === 'explorer' || currentWorkspace === 'EXPLORER';
  showToast('Preparing PEACS export…', 2000);
  resolveAllowedWorkspaces().then(allowedWS => {
    database.ref('peacs_assessments').once('value', snap => {
      const data = snap.val();
      if (!data) { showToast('No PEACS data to export yet.'); return; }
      let records = Object.values(data);

      if (!isSuperAdmin()) {
        if (isExplorer || !currentWorkspace) { showToast('No active workspace — cannot export.'); return; }
        records = records.filter(a => {
          const code = (a.institution_code || '').toUpperCase();
          return allowedWS === null ? true : (code && allowedWS.has(code));
        });
      }

      const filename = 'peacs-cohort-'+currentWorkspace.toLowerCase()+'-'+new Date().toISOString().split('T')[0]+'.csv';
      const headers = ['Patient_Num','Institution','Timestamp','BASE','MVMT','STRATA','PE','PE_Zone','Country','City','Latitude','Longitude'];
      const getZone = pe => pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
      const rows = records.map(a => {
        return [a.patient_number||'N/A', a.institution_code||currentWorkspace, new Date(a.timestamp).toISOString(),
          (a.base||0).toFixed(4),(a.mvmt||0).toFixed(4),(a.strata||0).toFixed(4),(a.pe||0).toFixed(4),
          getZone(a.pe||0), a.country||'Unknown',a.city||'Unknown',a.latitude||0,a.longitude||0];
      });
      triggerCSVDownload(headers, rows, filename);
      showToast('Exported '+rows.length+' cohort PEACS records.', 3000);
    });
  });
}

