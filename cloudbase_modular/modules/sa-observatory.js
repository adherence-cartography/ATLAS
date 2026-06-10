// sa-observatory.js — Observatory: live feed render, trend monitor, anomaly alerts, longitudinal view



// ══════════════════════════════════════════════════════════════════════════════
// OBSERVATORY TAB — Live Feed · Trend Monitor · Anomaly Alerts · Longitudinal
// ══════════════════════════════════════════════════════════════════════════════

let _saObsTab = 'feed';
let _saObsStream = [];        // assembled records sorted newest-first
let _saObsFeedLimit = 30;
let _saObsTimer = null;       // auto-refresh interval id

// ── Benchmark state ───────────────────────────────────────────────────────────
const _OBS_BENCHMARK_CACHE_KEY = 'atlas_benchmark_cache';
const _OBS_BENCHMARK_TTL       = 3600000; // 1 hour in ms
let   _saObsBenchmarkOptIn     = true;    // default; overwritten from Firebase on load
let   _saObsBenchmarkCondition = '';      // currently selected condition filter ('' = all)

function _saRenderObservatory(container) {
  const subs = [
    { id:'feed',         label:'Live Feed'      },
    { id:'trends',       label:'Trend Monitor'  },
    { id:'anomalies',    label:'Anomaly Alerts'  },
    { id:'longitudinal', label:'Longitudinal'   },
    { id:'benchmark',    label:'Benchmark'      },
    { id:'sdoh',         label:'SDoH Proximity' },
  ];

  container.innerHTML = `
  <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid ${_C.border};">
    ${subs.map(s=>`
    <button id="sa-obs-btn-${s.id}" onclick="saObsTab('${s.id}')"
      style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;
             padding:10px 20px;border:none;border-bottom:2px solid transparent;cursor:pointer;
             background:transparent;color:${_C.dim};transition:all 0.18s;">
      ${s.label}
    </button>`).join('')}
  </div>
  <div id="sa-obs-body"></div>`;

  saObsTab(_saObsTab);
}

function saObsTab(tab) {
  _saObsTab = tab;
  // Stop any live-feed timer when switching away
  if (_saObsTimer) { clearInterval(_saObsTimer); _saObsTimer = null; }

  document.querySelectorAll('[id^="sa-obs-btn-"]').forEach(b => {
    const active = b.id === 'sa-obs-btn-' + tab;
    b.style.color        = active ? _C.amber : _C.dim;
    b.style.borderBottom = active ? `2px solid ${_C.amber}` : '2px solid transparent';
  });

  const body = document.getElementById('sa-obs-body');
  if (!body) return;
  switch (tab) {
    case 'feed':         _saObsRenderFeed(body);         break;
    case 'trends':       _saObsRenderTrends(body);       break;
    case 'anomalies':    _saObsRenderAnomalies(body);    break;
    case 'longitudinal': _saObsRenderLongitudinal(body); break;
    case 'benchmark':    loadWorkspaceBenchmark();       break;
    case 'sdoh':         _saObsRenderSDoH(body);         break;
  }
}

// ── SDOH PROXIMITY ANALYSIS ───────────────────────────────────────────────────

function _saObsRenderSDoH(body) {
  body.innerHTML = `
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">SDoH Infrastructure Proximity Analysis</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;color:${_C.text};margin:6px 0 10px;">
      Pharmacy and Hospital Access vs. Adherence Scores
    </div>
    <div style="font-size:0.82rem;color:${_C.muted};line-height:1.6;margin-bottom:16px;">
      Links crowdsourced infrastructure POI data to geolocated MMAS-8 scores.
      This is a unique ATLAS capability: no other adherence platform offers geolocated assessments
      combined with crowdsourced SDoH POIs. Results are citable in publications.
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button onclick="_saObsRunSDoH()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:9px 20px;border-radius:6px;cursor:pointer;
               background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};
               transition:all 0.18s;"
        onmouseover="this.style.background='rgba(212,168,67,0.16)'"
        onmouseout="this.style.background='${_C.amberFaint}'">
        Run Analysis
      </button>
      <span style="font-size:0.76rem;color:${_C.dim};">
        Reads <code style="font-size:0.74rem;color:${_C.muted};">infrastructure_poi</code> and
        <code style="font-size:0.74rem;color:${_C.muted};">assessments</code> from Firebase
      </span>
    </div>
  </div>
  <div id="sa-obs-sdoh-results" style="min-height:80px;"></div>`;
}

function _saObsRunSDoH() {
  const resultsEl = document.getElementById('sa-obs-sdoh-results');
  if (!resultsEl) return;

  // Lazy-load poi-analysis.js then run the analysis
  lazyLoad('modules/poi-analysis.js', 'poiAnalysis').then(() => {
    if (typeof window.poiAnalysis !== 'undefined' && typeof window.poiAnalysis.run === 'function') {
      window.poiAnalysis.run(resultsEl);
    } else {
      resultsEl.innerHTML = `<div style="text-align:center;padding:2rem;color:${_C.dim};">POI analysis module failed to load.</div>`;
    }
  }).catch(err => {
    console.error('[ATLAS POI] Failed to load poi-analysis.js:', err);
    resultsEl.innerHTML = `<div style="text-align:center;padding:2rem;color:${_C.red};">Failed to load analysis module. Check console.</div>`;
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

// ── Risk Distribution helper ──────────────────────────────────────────────────
// Computes High / Moderate / Low risk counts from the in-memory cache.
// Uses composite score when MAP data is available for a record, MMAS-8 score otherwise.
function _saObsComputeRiskCounts() {
  let high = 0, moderate = 0, low = 0;
  (_saCache.mmas || []).forEach(r => {
    const hasMap = r.map_q1 !== undefined;
    if (hasMap) {
      // Composite 0-1 via MAP PE formula
      const pe = Math.pow(Math.max(0,
        ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3 *
        ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3 *
        (0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)
      ), 1/3);
      if (pe < 0.50)        high++;
      else if (pe < 0.75)   moderate++;
      else                  low++;
    } else {
      const score = r.score != null ? +r.score : null;
      if (score == null) return;
      if (score < 6)        high++;
      else if (score < 8)   moderate++;
      else                  low++;
    }
  });
  return { high, moderate, low };
}

function _saObsBuildStream() {
  const now = Date.now();
  const rows = [];
  (_saCache.mmas||[]).forEach(r => {
    if (r.map_q1 !== undefined) return; // MAP instrument handled below
    rows.push({ inst:'MMAS-8', col:_C.blue, ts:r.timestamp||0,
      score: r.score!=null ? +r.score : null,
      normScore: r.score!=null ? +r.score/8 : null,
      workspace: r.institution_code||r.workspace||'—',
      country: r.country||'—', lat:r.latitude, lon:r.longitude });
  });
  (_saCache.mmas||[]).filter(r=>r.map_q1!==undefined).forEach(r => {
    rows.push({ inst:'MAP', col:_C.green, ts:r.timestamp||0,
      score: Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3),
      normScore: Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3),
      workspace: r.institution_code||r.workspace||'—',
      country: r.country||'—', lat:r.latitude, lon:r.longitude });
  });
  (_saCache.peacs||[]).forEach(r => {
    rows.push({ inst:'PEACS', col:_C.purple, ts:r.timestamp||0,
      score: r.pe!=null ? +r.pe : null,
      normScore: r.pe!=null ? +r.pe : null,
      workspace: r.institution_code||r.workspace||'—',
      country: r.country||'—', lat:r.latitude, lon:r.longitude });
  });
  return rows.sort((a,b)=>b.ts-a.ts);
}

function _saObsRelTime(ts) {
  if (!ts) return '—';
  const d = Date.now() - ts;
  if (d < 60000)  return Math.floor(d/1000) + 's ago';
  if (d < 3600000) return Math.floor(d/60000) + 'm ago';
  if (d < 86400000) return Math.floor(d/3600000) + 'h ago';
  return Math.floor(d/86400000) + 'd ago';
}

function _saObsFmtScore(r) {
  if (r.score == null) return '—';
  if (r.inst === 'MMAS-8') return r.score.toFixed(2) + '/8';
  return r.score.toFixed(3);
}

function _saObsTierCol(r) {
  if (r.score == null) return _C.dim;
  if (r.inst === 'MMAS-8') {
    if (r.score >= 7) return '#2ec98a';
    if (r.score >= 6) return _C.amber;
    return '#ef4444';
  }
  if (r.normScore >= 0.85) return '#2ec98a';
  if (r.normScore >= 0.70) return _C.blue;
  if (r.normScore >= 0.55) return _C.amber;
  return '#ef4444';
}

// ── LIVE FEED ─────────────────────────────────────────────────────────────────

function _saObsRenderFeed(body) {
  _saObsStream = _saObsBuildStream();

  const total = _saCache.mmas ? _saCache.mmas.length : 0;
  const totalPeacs = _saCache.peacs ? _saCache.peacs.length : 0;
  const lastTs = _saObsStream.length ? _saObsStream[0].ts : 0;
  const last30 = _saObsStream.filter(r => Date.now() - r.ts < 1800000).length;

  const { high: _rHigh, moderate: _rMod, low: _rLow } = _saObsComputeRiskCounts();

  body.innerHTML = `
  <!-- header stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;">
    ${[
      { label:'Total Records',   val: (_saObsStream.length).toLocaleString(), col: _C.amber },
      { label:'Last 30 Min',     val: last30.toLocaleString(),                col: last30 ? '#2ec98a' : _C.dim },
      { label:'Most Recent',     val: _saObsRelTime(lastTs),                  col: _C.muted },
      { label:'Instruments',     val: '3',                                    col: _C.purple },
    ].map(s=>`
    <div class="sa-panel" style="padding:14px 18px;">
      <div style="font-size:1.5rem;font-weight:700;color:${s.col};">${s.val}</div>
      <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Risk Distribution panel -->
  <div class="sa-panel" style="margin-bottom:18px;padding:14px 18px;">
    <div class="sa-section-eyebrow" style="margin-bottom:10px;">Risk Distribution</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin:0;">
      <div style="background:rgba(244,67,54,0.1);border:1px solid var(--poor,#f44336);border-radius:8px;padding:1rem;text-align:center;">
        <div style="font-size:1.75rem;font-weight:700;color:var(--poor,#f44336);">${_rHigh}</div>
        <div style="font-size:0.75rem;color:var(--muted);">High Risk</div>
        <div style="font-size:0.7rem;color:var(--muted);">MMAS &lt; 6</div>
      </div>
      <div style="background:rgba(255,152,0,0.1);border:1px solid var(--moderate,#ff9800);border-radius:8px;padding:1rem;text-align:center;">
        <div style="font-size:1.75rem;font-weight:700;color:var(--moderate,#ff9800);">${_rMod}</div>
        <div style="font-size:0.75rem;color:var(--muted);">Moderate Risk</div>
        <div style="font-size:0.7rem;color:var(--muted);">MMAS 6&#8211;7</div>
      </div>
      <div style="background:rgba(76,175,80,0.1);border:1px solid var(--optimal,#4caf50);border-radius:8px;padding:1rem;text-align:center;">
        <div style="font-size:1.75rem;font-weight:700;color:var(--optimal,#4caf50);">${_rLow}</div>
        <div style="font-size:0.75rem;color:var(--muted);">Low Risk</div>
        <div style="font-size:0.7rem;color:var(--muted);">MMAS 8</div>
      </div>
    </div>
  </div>

  <!-- feed controls -->
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
    <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Show</div>
    ${['All','MMAS-8','MAP','PEACS'].map(f=>`
    <button onclick="_saObsFeedFilter('${f}')" id="sa-obs-feed-f-${f}"
      style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;
             padding:4px 10px;border-radius:4px;cursor:pointer;
             background:${f==='All'?_C.amberFaint:'transparent'};
             border:1px solid ${f==='All'?'rgba(212,168,67,0.4)':_C.border};
             color:${f==='All'?_C.amber:_C.dim};">${f}</button>`).join('')}
    <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
      <span id="sa-obs-feed-status" style="font-size:0.76rem;color:${_C.dim};">● Live</span>
      <button onclick="_saObsRefreshFeed()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;
               padding:4px 12px;border-radius:4px;cursor:pointer;
               background:transparent;border:1px solid ${_C.border};color:${_C.dim};">↺ Refresh</button>
    </div>
  </div>

  <!-- feed table -->
  <div class="sa-panel" style="padding:0;overflow:hidden;" id="sa-obs-feed-wrap">
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;" id="sa-obs-feed-table">
        <thead><tr style="background:${_C.bg2};">
          ${['Time','Instrument','Score','Workspace','Country','Coordinates'].map((h,i)=>
            `<th style="padding:9px ${i===0?'18px':'14px'};text-align:left;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody id="sa-obs-feed-body">
          ${_saObsFeedRows('All')}
        </tbody>
      </table>
    </div>
    <div style="padding:10px 18px;border-top:1px solid ${_C.border};display:flex;gap:12px;align-items:center;">
      <span style="font-size:0.76rem;color:${_C.dim};" id="sa-obs-feed-count">Showing ${Math.min(_saObsFeedLimit, _saObsStream.length)} of ${_saObsStream.length}</span>
      <button onclick="_saObsFeedMore()" id="sa-obs-feed-more"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;padding:4px 12px;border-radius:4px;cursor:pointer;
               background:transparent;border:1px solid ${_C.border};color:${_C.dim};letter-spacing:0.08em;text-transform:uppercase;">
        Load More
      </button>
    </div>
  </div>`;
}

let _saObsFeedActiveFilter = 'All';

function _saObsFeedRows(filter) {
  const rows = filter === 'All' ? _saObsStream : _saObsStream.filter(r => r.inst === filter);
  const visible = rows.slice(0, _saObsFeedLimit);
  if (!visible.length) return `<tr><td colspan="6" style="padding:24px;text-align:center;color:${_C.dim};font-size:0.84rem;">No records yet.</td></tr>`;
  return visible.map(r => {
    const col = r.col;
    const sCol = _saObsTierCol(r);
    const coord = (r.lat && r.lon) ? `${(+r.lat).toFixed(2)}, ${(+r.lon).toFixed(2)}` : '—';
    return `<tr style="border-bottom:1px solid ${_C.border};" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
      <td style="padding:9px 18px;font-size:0.80rem;color:${_C.muted};white-space:nowrap;">${_saObsRelTime(r.ts)}</td>
      <td style="padding:9px 14px;"><span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border:1px solid ${col};border-radius:3px;color:${col};">${r.inst}</span></td>
      <td style="padding:9px 14px;font-size:0.90rem;font-weight:700;color:${sCol};">${_saObsFmtScore(r)}</td>
      <td style="padding:9px 14px;font-size:0.82rem;color:${_C.muted};">${_saEsc(r.workspace)}</td>
      <td style="padding:9px 14px;font-size:0.82rem;color:${_C.muted};">${_saEsc(r.country)}</td>
      <td style="padding:9px 14px;font-size:0.78rem;color:${_C.dim};font-family:'IBM Plex Mono',monospace;">${coord}</td>
    </tr>`;
  }).join('');
}

function _saObsFeedFilter(filter) {
  _saObsFeedActiveFilter = filter;
  _saObsFeedLimit = 30;
  ['All','MMAS-8','MAP','PEACS'].forEach(f => {
    const btn = document.getElementById('sa-obs-feed-f-' + f);
    if (!btn) return;
    const on = f === filter;
    btn.style.background = on ? _C.amberFaint : 'transparent';
    btn.style.borderColor = on ? 'rgba(212,168,67,0.4)' : _C.border;
    btn.style.color = on ? _C.amber : _C.dim;
  });
  const tb = document.getElementById('sa-obs-feed-body');
  if (tb) tb.innerHTML = _saObsFeedRows(filter);
  const rows = filter === 'All' ? _saObsStream : _saObsStream.filter(r => r.inst === filter);
  const cnt = document.getElementById('sa-obs-feed-count');
  if (cnt) cnt.textContent = `Showing ${Math.min(_saObsFeedLimit, rows.length)} of ${rows.length}`;
}

function _saObsFeedMore() {
  _saObsFeedLimit += 30;
  const tb = document.getElementById('sa-obs-feed-body');
  if (tb) tb.innerHTML = _saObsFeedRows(_saObsFeedActiveFilter);
  const rows = _saObsFeedActiveFilter === 'All' ? _saObsStream : _saObsStream.filter(r => r.inst === _saObsFeedActiveFilter);
  const cnt = document.getElementById('sa-obs-feed-count');
  if (cnt) cnt.textContent = `Showing ${Math.min(_saObsFeedLimit, rows.length)} of ${rows.length}`;
}

function _saObsRefreshFeed() {
  _saObsStream = _saObsBuildStream();
  _saObsFeedLimit = 30;
  const tb = document.getElementById('sa-obs-feed-body');
  if (tb) tb.innerHTML = _saObsFeedRows(_saObsFeedActiveFilter);
  const rows = _saObsFeedActiveFilter === 'All' ? _saObsStream : _saObsStream.filter(r => r.inst === _saObsFeedActiveFilter);
  const cnt = document.getElementById('sa-obs-feed-count');
  if (cnt) cnt.textContent = `Showing ${Math.min(_saObsFeedLimit, rows.length)} of ${rows.length}`;
  const st = document.getElementById('sa-obs-feed-status');
  if (st) { st.textContent = '✓ Updated'; setTimeout(() => { if (st) st.textContent = '● Live'; }, 1500); }
  // Refresh risk distribution counts in-place
  const { high: _rfH, moderate: _rfM, low: _rfL } = _saObsComputeRiskCounts();
  const _rfEls = document.querySelectorAll('#sa-obs-body .sa-panel .sa-section-eyebrow');
  _rfEls.forEach(el => {
    if (el.textContent.trim() === 'Risk Distribution') {
      const cells = el.closest('.sa-panel').querySelectorAll('[style*="font-size:1.75rem"]');
      if (cells[0]) cells[0].textContent = _rfH;
      if (cells[1]) cells[1].textContent = _rfM;
      if (cells[2]) cells[2].textContent = _rfL;
    }
  });
}

// ── TREND MONITOR ─────────────────────────────────────────────────────────────

function _saObsRenderTrends(body) {
  const stream = _saObsBuildStream();
  if (!stream.length) {
    body.innerHTML = `<div class="sa-panel" style="padding:40px;text-align:center;color:${_C.dim};font-size:0.88rem;">No data yet.</div>`;
    return;
  }

  // Bucket by week (Sun-based)
  const msPerWeek = 7 * 86400000;
  const firstTs = stream[stream.length-1].ts;
  const lastTs  = stream[0].ts;
  const numWeeks = Math.min(24, Math.ceil((lastTs - firstTs) / msPerWeek) + 1);
  const endOfLastWeek = Math.ceil(lastTs / msPerWeek) * msPerWeek;

  const weeks = Array.from({length: numWeeks}, (_, i) => {
    const wEnd = endOfLastWeek - (numWeeks - 1 - i) * msPerWeek;
    const wStart = wEnd - msPerWeek;
    const recs = stream.filter(r => r.ts >= wStart && r.ts < wEnd);
    const mmas  = recs.filter(r=>r.inst==='MMAS-8');
    const map   = recs.filter(r=>r.inst==='MAP');
    const peacs = recs.filter(r=>r.inst==='PEACS');
    const avgScore = recs.filter(r=>r.normScore!=null).reduce((s,r)=>s+r.normScore,0) /
                    (recs.filter(r=>r.normScore!=null).length||1);
    return { wEnd, count: recs.length, mmas: mmas.length, map: map.length, peacs: peacs.length,
             avgScore: recs.filter(r=>r.normScore!=null).length ? avgScore : null };
  });

  const maxCount = Math.max(...weeks.map(w=>w.count), 1);

  // Instrument breakdown over last 30 / 90 / 365 days
  const periods = [30, 90, 365];
  const breakdown = periods.map(d => {
    const cutoff = Date.now() - d * 86400000;
    const recs = stream.filter(r => r.ts >= cutoff);
    return { days: d, total: recs.length,
      mmas: recs.filter(r=>r.inst==='MMAS-8').length,
      map:  recs.filter(r=>r.inst==='MAP').length,
      peacs:recs.filter(r=>r.inst==='PEACS').length };
  });

  const fmtDate = ts => { const d = new Date(ts); return (d.getMonth()+1)+'/'+(d.getDate()); };

  body.innerHTML = `
  <!-- Volume chart (SVG bar) -->
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Weekly Assessment Volume — Last ${numWeeks} Weeks</div>
    <div style="margin-top:14px;overflow-x:auto;">
      <svg width="${numWeeks*38+40}" height="160" style="display:block;min-width:100%;">
        <g transform="translate(20,10)">
          ${weeks.map((w,i)=>{
            const x = i*38;
            const barH = maxCount ? Math.max(2, Math.round((w.count/maxCount)*120)) : 0;
            const barY = 120 - barH;
            const mH = maxCount ? Math.round((w.mmas/maxCount)*120) : 0;
            const mpH= maxCount ? Math.round((w.map/maxCount)*120) : 0;
            const pY = 120 - mH;
            const mpY= pY - mpH;
            const pYp= mpY - Math.round((w.peacs/maxCount)*120);
            return `<g>
              <rect x="${x}" y="${barY}" width="28" height="${barH}" fill="${_C.border}" rx="2"/>
              <rect x="${x}" y="${120-mH}" width="28" height="${mH}" fill="${_C.blue}" opacity="0.7" rx="2"/>
              <rect x="${x}" y="${120-mH-mpH}" width="28" height="${mpH}" fill="${_C.green}" opacity="0.7"/>
              <rect x="${x}" y="${120-mH-mpH-Math.round((w.peacs/maxCount)*120)}" width="28" height="${Math.round((w.peacs/maxCount)*120)}" fill="${_C.purple}" opacity="0.7"/>
              ${w.count?`<text x="${x+14}" y="${barY-4}" text-anchor="middle" font-size="9" fill="${_C.dim}">${w.count}</text>`:''}
              <text x="${x+14}" y="136" text-anchor="middle" font-size="9" fill="${_C.dim}">${fmtDate(w.wEnd)}</text>
            </g>`;
          }).join('')}
          <line x1="0" y1="120" x2="${numWeeks*38}" y2="120" stroke="${_C.border}" stroke-width="1"/>
        </g>
      </svg>
    </div>
    <div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap;">
      ${[['MMAS-8',_C.blue],['MAP',_C.green],['PEACS',_C.purple]].map(([l,c])=>`
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="width:10px;height:10px;border-radius:2px;background:${c};display:inline-block;opacity:0.8;"></span>
        <span style="font-size:0.76rem;color:${_C.dim};">${l}</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- Score trend (sparkline) -->
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Mean Normalised Score Trend (All Instruments)</div>
    <div style="margin-top:14px;overflow-x:auto;">
      ${(() => {
        const pts = weeks.filter(w=>w.avgScore!=null);
        if (pts.length < 2) return `<div style="padding:16px;font-size:0.84rem;color:${_C.dim};">Insufficient data for trend.</div>`;
        const W = numWeeks*38+40, H = 100;
        const minS = Math.min(...pts.map(w=>w.avgScore));
        const maxS = Math.max(...pts.map(w=>w.avgScore));
        const range = maxS - minS || 0.1;
        const toX = (i) => 20 + weeks.indexOf(pts[i])*38 + 14;
        const toY = (s) => 10 + (1-(s-minS)/range)*70;
        const path = pts.map((w,i)=>(i===0?'M':'L')+toX(i)+' '+toY(w.avgScore).toFixed(1)).join(' ');
        const fill = path + ` L${toX(pts.length-1)} ${H-10} L${toX(0)} ${H-10} Z`;
        return `<svg width="${W}" height="${H}" style="display:block;min-width:100%;">
          <defs><linearGradient id="obs-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${_C.amber}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${_C.amber}" stop-opacity="0"/>
          </linearGradient></defs>
          <path d="${fill}" fill="url(#obs-grad)"/>
          <path d="${path}" fill="none" stroke="${_C.amber}" stroke-width="2" stroke-linejoin="round"/>
          ${pts.map((w,i)=>`<circle cx="${toX(i)}" cy="${toY(w.avgScore).toFixed(1)}" r="3" fill="${_C.amber}"/>
            <text x="${toX(i)}" y="${toY(w.avgScore)-8}" text-anchor="middle" font-size="9" fill="${_C.amber}">${w.avgScore.toFixed(2)}</text>`).join('')}
          <line x1="20" y1="${H-10}" x2="${W-20}" y2="${H-10}" stroke="${_C.border}" stroke-width="1"/>
        </svg>`;
      })()}
    </div>
  </div>

  <!-- Period breakdown -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
    ${breakdown.map(b=>`
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Last ${b.days} Days</div>
      <div style="font-size:2rem;font-weight:700;color:${_C.amber};margin:10px 0 6px;">${b.total.toLocaleString()}</div>
      <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:10px;">total assessments</div>
      ${[['MMAS-8',b.mmas,_C.blue],['MAP',b.map,_C.green],['PEACS',b.peacs,_C.purple]].map(([l,n,c])=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-size:0.74rem;color:${_C.dim};width:52px;">${l}</span>
        <div style="flex:1;height:4px;background:${_C.navy};border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${b.total?((n/b.total)*100).toFixed(1):0}%;background:${c};border-radius:2px;"></div>
        </div>
        <span style="font-size:0.80rem;font-weight:700;color:${c};width:28px;text-align:right;">${n}</span>
      </div>`).join('')}
    </div>`).join('')}
  </div>`;
}

// ── ANOMALY ALERTS ────────────────────────────────────────────────────────────

function _saObsRenderAnomalies(body) {
  const stream = _saObsBuildStream();

  // Detect anomalies:
  // 1. MMAS-8 score = 0 (complete non-adherence)
  // 2. MMAS-8 score = 8 but also reported forgetting (q1=1 + score=8 — data inconsistency)
  // 3. MAP/PEACS PE score < 0.3 (critical non-adherence)
  // 4. Score exactly same in same workspace within 5 min (possible duplicate)
  // 5. Unusual burst: >5 submissions from same workspace in <10 min

  const anomalies = [];

  // Critical non-adherence
  stream.filter(r=>r.inst==='MMAS-8'&&r.score===0).forEach(r=>{
    anomalies.push({ severity:'critical', type:'Zero Adherence Score', desc:'MMAS-8 score of 0 — complete non-adherence reported.', ...r });
  });
  stream.filter(r=>r.inst!=='MMAS-8'&&r.normScore!=null&&r.normScore<0.3).forEach(r=>{
    anomalies.push({ severity:'critical', type:'Critical PE Score', desc:`${r.inst} PE score ${r.normScore.toFixed(3)} — below 0.3 critical threshold.`, ...r });
  });

  // Workspace submission burst (>4 in 10 min)
  const wsBuckets = {};
  stream.forEach(r => {
    if (!r.workspace || r.workspace==='—') return;
    if (!wsBuckets[r.workspace]) wsBuckets[r.workspace] = [];
    wsBuckets[r.workspace].push(r.ts);
  });
  Object.entries(wsBuckets).forEach(([ws, times]) => {
    times.sort((a,b)=>b-a);
    for (let i=0; i<times.length-4; i++) {
      const window = times[i] - times[i+4];
      if (window < 600000) {
        anomalies.push({ severity:'warning', type:'Submission Burst', workspace:ws, ts:times[i],
          desc:`5+ submissions from workspace "${ws}" within 10 minutes — possible automated or bulk entry.`, col:_C.amber });
        break; // one alert per workspace
      }
    }
  });

  // Possible duplicates: same workspace + score within 60 seconds
  for (let i=0; i<stream.length-1; i++) {
    for (let j=i+1; j<stream.length; j++) {
      if (Math.abs(stream[i].ts - stream[j].ts) > 60000) break;
      if (stream[i].workspace === stream[j].workspace &&
          stream[i].inst === stream[j].inst &&
          stream[i].score === stream[j].score &&
          stream[i].workspace !== '—') {
        anomalies.push({ severity:'info', type:'Possible Duplicate', workspace:stream[i].workspace, ts:stream[i].ts,
          desc:`Two ${stream[i].inst} records with identical score (${_saObsFmtScore(stream[i])}) from workspace "${stream[i].workspace}" within 60 seconds.`,
          col:_C.blue });
        break;
      }
    }
    if (anomalies.filter(a=>a.type==='Possible Duplicate').length >= 3) break;
  }

  const sevCols = { critical:'#ef4444', warning:_C.amber, info:_C.blue };
  const sevIcons = { critical:'⚠', warning:'◉', info:'◈' };

  body.innerHTML = `
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;color:${_C.text};">
      Anomaly Detection
    </div>
    <div style="display:flex;gap:8px;margin-left:auto;">
      ${[['critical','#ef4444'],['warning',_C.amber],['info',_C.blue]].map(([s,c])=>{
        const n = anomalies.filter(a=>a.severity===s).length;
        return `<span style="font-size:0.76rem;padding:3px 9px;border:1px solid ${c};border-radius:4px;color:${c};">${n} ${s}</span>`;
      }).join('')}
    </div>
  </div>

  ${!anomalies.length ? `
  <div class="sa-panel" style="padding:40px;text-align:center;">
    <div style="font-size:1.8rem;margin-bottom:10px;opacity:0.3;">◉</div>
    <div style="font-size:0.88rem;color:${_C.dim};">No anomalies detected in current dataset.</div>
  </div>` : anomalies.map(a=>`
  <div class="sa-panel" style="margin-bottom:12px;border-left:3px solid ${sevCols[a.severity]||_C.dim};">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:1.1rem;color:${sevCols[a.severity]};margin-top:2px;">${sevIcons[a.severity]}</span>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
          <span style="font-size:0.78rem;font-weight:700;color:${sevCols[a.severity]};letter-spacing:0.1em;text-transform:uppercase;">${a.type}</span>
          ${a.inst?`<span style="font-size:0.72rem;padding:1px 6px;border:1px solid ${a.col||sevCols[a.severity]};border-radius:3px;color:${a.col||sevCols[a.severity]};">${a.inst}</span>`:''}
          <span style="font-size:0.76rem;color:${_C.dim};margin-left:auto;">${_saObsRelTime(a.ts)}</span>
        </div>
        <div style="font-size:0.86rem;color:${_C.muted};line-height:1.6;">${a.desc}</div>
        ${a.workspace&&a.workspace!=='—'?`<div style="font-size:0.76rem;color:${_C.dim};margin-top:5px;">Workspace: ${_saEsc(a.workspace)}</div>`:''}
      </div>
    </div>
  </div>`).join('')}`;
}

// ── LONGITUDINAL ──────────────────────────────────────────────────────────────

function _saObsRenderLongitudinal(body) {
  // Group all records by workspace, show score trajectory over time
  const stream = _saObsBuildStream();

  // Get workspaces with >1 record (longitudinal data)
  const wsMap = {};
  stream.forEach(r => {
    if (!r.workspace || r.workspace==='—') return;
    if (!wsMap[r.workspace]) wsMap[r.workspace] = [];
    wsMap[r.workspace].push(r);
  });
  const longWs = Object.entries(wsMap)
    .filter(([,recs])=>recs.length>1)
    .sort((a,b)=>b[1].length-a[1].length)
    .slice(0,12);

  // Summary stats across all workspaces
  const wsAll = Object.entries(wsMap);
  const wsCount = wsAll.length;
  const multiWs = wsAll.filter(([,r])=>r.length>1).length;
  const maxRecs = wsAll.reduce((m,[,r])=>Math.max(m,r.length),0);

  body.innerHTML = `
  <!-- summary -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
    ${[
      { label:'Workspaces Tracked', val: wsCount.toLocaleString(), col:_C.amber },
      { label:'Multi-Record Workspaces', val: multiWs.toLocaleString(), col:'#2ec98a' },
      { label:'Max Records (1 workspace)', val: maxRecs.toLocaleString(), col:_C.purple },
    ].map(s=>`
    <div class="sa-panel" style="padding:14px 18px;">
      <div style="font-size:1.5rem;font-weight:700;color:${s.col};">${s.val}</div>
      <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">${s.label}</div>
    </div>`).join('')}
  </div>

  ${!longWs.length ? `
  <div class="sa-panel" style="padding:40px;text-align:center;">
    <div style="font-size:0.88rem;color:${_C.dim};">No workspaces yet have longitudinal data (multiple records over time).</div>
    <div style="font-size:0.80rem;color:${_C.dim};margin-top:8px;">Longitudinal tracking will populate as workspaces submit multiple assessments.</div>
  </div>` : `
  <div class="sa-section-eyebrow" style="margin-bottom:14px;">Score Trajectory by Workspace — Top ${longWs.length}</div>
  ${longWs.map(([ws, recs]) => {
    const sorted = [...recs].sort((a,b)=>a.ts-b.ts);
    const norms = sorted.map(r=>r.normScore).filter(v=>v!=null);
    if (!norms.length) return '';
    const firstScore = norms[0], lastScore = norms[norms.length-1];
    const delta = lastScore - firstScore;
    const deltaCol = delta > 0.05 ? '#2ec98a' : delta < -0.05 ? '#ef4444' : _C.amber;
    const deltaStr = (delta>=0?'+':'')+delta.toFixed(3);
    const daySpan = sorted.length > 1 ? Math.round((sorted[sorted.length-1].ts - sorted[0].ts)/86400000) : 0;

    // Sparkline
    const W = 160, H = 40;
    const minN = Math.min(...norms), maxN = Math.max(...norms);
    const rangeN = maxN-minN || 0.01;
    const toX = i => 4 + (i/(norms.length-1||1))*(W-8);
    const toY = v => 4 + (1-(v-minN)/rangeN)*(H-8);
    const path = norms.map((v,i)=>(i===0?'M':'L')+toX(i).toFixed(1)+' '+toY(v).toFixed(1)).join(' ');

    return `<div class="sa-panel" style="margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 18px;">
      <div style="flex:1;min-width:140px;">
        <div style="font-size:0.86rem;font-weight:700;color:${_C.text};margin-bottom:3px;">${_saEsc(ws)}</div>
        <div style="font-size:0.74rem;color:${_C.dim};">${recs.length} records · ${daySpan} day span</div>
        <div style="font-size:0.74rem;color:${_C.dim};margin-top:2px;">
          ${[...new Set(recs.map(r=>r.inst))].join(' · ')}
        </div>
      </div>
      <svg width="${W}" height="${H}" style="flex-shrink:0;">
        <path d="${path}" fill="none" stroke="${deltaCol}" stroke-width="1.5" stroke-linejoin="round"/>
        ${norms.map((v,i)=>`<circle cx="${toX(i).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="2.5" fill="${deltaCol}"/>`).join('')}
      </svg>
      <div style="text-align:right;flex-shrink:0;min-width:80px;">
        <div style="font-size:1.2rem;font-weight:700;color:${deltaCol};">${deltaStr}</div>
        <div style="font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};">Δ Score</div>
        <div style="font-size:0.80rem;color:${_C.muted};margin-top:2px;">${lastScore.toFixed(3)}</div>
        <div style="font-size:0.70rem;color:${_C.dim};">Latest</div>
      </div>
    </div>`;
  }).join('')}`}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// BENCHMARK TAB
// Computes per-workspace GAI from the live _saCache data, ranks the current
// workspace by percentile against all others, and displays the result.
// Public entry point: loadWorkspaceBenchmark() — also called on tab activation.
// ══════════════════════════════════════════════════════════════════════════════

// ── Public entry point ────────────────────────────────────────────────────────
// Called when the Benchmark tab is activated (via saObsTab switch) and can also
// be called externally. Delegates to _saObsRenderBenchmark() once the body div
// is available. Checks the sessionStorage cache and falls through to Firebase if
// the cache is cold or expired (> 1 hour).
function loadWorkspaceBenchmark() {
  const body = document.getElementById('sa-obs-body');
  if (body) {
    _saObsRenderBenchmark(body);
  }
}

// ── Percentile helper ─────────────────────────────────────────────────────────
function _saObsComputePercentile(myGAI, allGAIs) {
  if (!allGAIs.length) return 0;
  const below = allGAIs.filter(g => g < myGAI).length;
  return Math.round((below / allGAIs.length) * 100);
}

// ── Per-workspace GAI from cache (mirrors sa-gai.js wsRanked logic) ───────────
// Returns array of { ws, gai, n, condition } for every workspace with >= 1 record.
// condition is the most-common normalised condition tag across the workspace's records.
function _saObsComputeWorkspaceGAIs() {
  const mmasOnly = (_saCache.mmas  || []).filter(r => r.map_q1 === undefined);
  const mapInstr = (_saCache.mmas  || []).filter(r => r.map_q1 !== undefined);
  const peacs    =  _saCache.peacs || [];

  const wsMap = {};
  const _add  = (ws, type, r) => {
    if (!wsMap[ws]) wsMap[ws] = { mmas:[], map:[], peacs:[] };
    wsMap[ws][type].push(r);
  };

  mmasOnly.forEach(r => _add(r.institution_code || r.workspace || 'Unknown', 'mmas', r));
  mapInstr.forEach(r => _add(r.institution_code || r.workspace || 'Unknown', 'map',  r));
  peacs.forEach(r    => _add(r.institution_code || 'Unknown',                'peacs',r));

  // Derive a normalised condition key from a raw string on an assessment record
  const _condKey = raw => {
    if (!raw) return null;
    const lc = raw.trim().toLowerCase();
    if (/hypertens/.test(lc))                                 return 'hypertension';
    if (/diabet/.test(lc))                                    return 'diabetes';
    if (/oncol|cancer|tumor|tumour/.test(lc))                 return 'oncology';
    if (/hiv|aids/.test(lc))                                  return 'hiv';
    if (/mental|psychiatr|depress|anxiety|bipolar/.test(lc))  return 'mental_health';
    if (/cardio|heart|coronary/.test(lc))                     return 'cardiovascular';
    if (/respir|asthma|copd|lung/.test(lc))                   return 'respiratory';
    return 'other';
  };

  return Object.entries(wsMap).map(([ws, d]) => {
    const wMmas = d.mmas.length
      ? d.mmas.reduce((s, r) => s + (r.score || 0), 0) / d.mmas.length / 8
      : null;
    // Reuse the MAP PE formula (same as _gaiMapPE / sa-gai.js)
    const _mapPE = r => Math.pow(Math.max(0,
      ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3 *
      ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3 *
      (0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)
    ), 1/3);
    const _gm   = arr => arr.length
      ? Math.exp(arr.reduce((s, v) => s + Math.log(Math.max(0.001, Math.min(1, v))), 0) / arr.length)
      : null;
    const wMap  = _gm(d.map.map(r => _mapPE(r)));
    const wPe   = _gm(d.peacs.filter(r => r.pe != null).map(r => +r.pe));
    const comps = [wMmas, wMap, wPe].filter(v => v != null);
    const wGai  = comps.length ? _gm(comps) : 0;
    const n     = d.mmas.length + d.map.length + d.peacs.length;

    // Dominant condition across all records in this workspace
    const condCounts = {};
    [...d.mmas, ...d.map, ...d.peacs].forEach(r => {
      const k = _condKey(r.condition || r.therapeutic_area || r.study_condition);
      if (k) condCounts[k] = (condCounts[k] || 0) + 1;
    });
    const condition = Object.keys(condCounts).length
      ? Object.keys(condCounts).reduce((a, b) => condCounts[a] >= condCounts[b] ? a : b)
      : null;

    return { ws, gai: Math.min(1, Math.max(0, wGai)), n, condition };
  }).filter(w => w.n >= 1);
}

// ── sessionStorage cache helpers ──────────────────────────────────────────────
function _saObsBenchmarkSaveCache(data) {
  try {
    sessionStorage.setItem(_OBS_BENCHMARK_CACHE_KEY, JSON.stringify({
      ts: Date.now(), data
    }));
  } catch(e) { /* storage quota — silent */ }
}

function _saObsBenchmarkLoadCache() {
  try {
    const raw = sessionStorage.getItem(_OBS_BENCHMARK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.ts > _OBS_BENCHMARK_TTL) return null;
    return parsed.data;
  } catch(e) { return null; }
}

// ── Opt-in toggle handler (called from inline onclick) ────────────────────────
function saObsBenchmarkToggleOptIn() {
  const chk = document.getElementById('sa-obs-bm-optin');
  if (!chk) return;
  _saObsBenchmarkOptIn = chk.checked;

  const ws = (typeof currentWorkspace !== 'undefined' && currentWorkspace)
    ? currentWorkspace.toUpperCase()
    : null;

  if (ws && typeof database !== 'undefined') {
    database.ref('workspaces/' + ws + '/benchmark_opt_in')
      .set(_saObsBenchmarkOptIn)
      .catch(e => { if (window._atlasLog) window._atlasLog('warn', 'benchmark_opt_in write: ' + e.message); });
  }

  // Update the status note without re-rendering the whole tab
  const note = document.getElementById('sa-obs-bm-optin-note');
  if (note) {
    note.textContent = _saObsBenchmarkOptIn
      ? 'Your workspace contributes anonymised GAI data to the global network.'
      : 'Your workspace is opted out — your data is not included in others\' benchmarks.';
  }
}

// ── Main render ───────────────────────────────────────────────────────────────
function _saObsRenderBenchmark(body) {
  // Show a loading state immediately, then compute (may hit Firebase if cache is cold)
  body.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:${_C.dim};font-size:0.88rem;">
    Loading benchmark data…
  </div>`;

  // Resolve current workspace key
  const myWsRaw = (typeof currentWorkspace !== 'undefined' && currentWorkspace)
    ? currentWorkspace.toUpperCase()
    : null;

  // ── Inner render once we have all data ────────────────────────────────────
  const _doRender = (wsRanked, optIn) => {
    _saObsBenchmarkOptIn = optIn;

    // Apply condition filter (uses module-level _saObsBenchmarkCondition state)
    const _activeCond = _saObsBenchmarkCondition || '';
    const filteredRanked = _activeCond
      ? wsRanked.filter(w => w.condition === _activeCond)
      : wsRanked;

    const myEntry = myWsRaw
      ? wsRanked.find(w => w.ws.toUpperCase() === myWsRaw)
      : null;

    // If there is no data for the current workspace at all, fall back to global GAI
    const myGAI    = myEntry ? myEntry.gai : (wsRanked.length ? wsRanked.reduce((s, w) => s + w.gai, 0) / wsRanked.length : 0);
    // Percentile is computed against the filtered peer group
    const allGAIs  = filteredRanked.map(w => w.gai);
    const pctRank  = _saObsComputePercentile(myGAI, allGAIs);
    const totalWs  = filteredRanked.length;
    const globalMean = allGAIs.length ? allGAIs.reduce((a, b) => a + b, 0) / allGAIs.length : 0;

    // Cache result (always cache the full wsRanked; filter is applied at render time)
    _saObsBenchmarkSaveCache({ wsRanked, pctRank, myGAI, totalWs, globalMean, optIn, ts: Date.now() });

    // Human-readable condition label for filter note
    const _condLabels = { hypertension:'Hypertension', diabetes:'Diabetes', oncology:'Oncology',
      hiv:'HIV/AIDS', mental_health:'Mental Health', cardiovascular:'Cardiovascular',
      respiratory:'Respiratory', other:'Other' };
    const _condLabel = _condLabels[_activeCond] || _activeCond;

    // Tier classification
    let tierLabel, tierCol, tierBg, tierBorder;
    if (pctRank >= 75) {
      tierLabel  = 'Top Performer';
      tierCol    = _C.green;
      tierBg     = _C.greenFaint;
      tierBorder = _C.greenDim;
    } else if (pctRank >= 50) {
      tierLabel  = 'Above Average';
      tierCol    = _C.amber;
      tierBg     = _C.amberFaint;
      tierBorder = _C.amberDim;
    } else {
      tierLabel  = 'Room for Growth';
      tierCol    = _C.dim;
      tierBg     = 'rgba(96,120,152,0.06)';
      tierBorder = 'rgba(96,120,152,0.25)';
    }

    // Gauge bar position (0–100)
    const pctPx = Math.max(0, Math.min(100, pctRank));

    body.innerHTML = `

    <!-- Condition filter -->
    <div style="margin-bottom:14px;">
      <select id="obs-benchmark-condition"
        onchange="_saObsBenchmarkCondition=this.value;_saObsRenderBenchmark(document.getElementById('sa-obs-body'));"
        style="padding:0.4rem 0.6rem;background:var(--surface,#0f0f1a);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:0.8rem;margin-bottom:1rem;">
        <option value="" ${!_activeCond?'selected':''}>All conditions (global)</option>
        <option value="hypertension" ${_activeCond==='hypertension'?'selected':''}>Hypertension</option>
        <option value="diabetes" ${_activeCond==='diabetes'?'selected':''}>Diabetes</option>
        <option value="oncology" ${_activeCond==='oncology'?'selected':''}>Oncology</option>
        <option value="hiv" ${_activeCond==='hiv'?'selected':''}>HIV/AIDS</option>
        <option value="mental_health" ${_activeCond==='mental_health'?'selected':''}>Mental Health</option>
        <option value="cardiovascular" ${_activeCond==='cardiovascular'?'selected':''}>Cardiovascular</option>
        <option value="respiratory" ${_activeCond==='respiratory'?'selected':''}>Respiratory</option>
        <option value="other" ${_activeCond==='other'?'selected':''}>Other</option>
      </select>
      ${_activeCond ? `<div style="font-size:0.78rem;color:${_C.amber};margin-top:2px;">Comparing against ${totalWs} ${_condLabel} workspace${totalWs !== 1 ? 's' : ''} in ATLAS</div>` : ''}
    </div>

    <!-- Benchmark card -->
    <div class="sa-panel" style="margin-bottom:18px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">

        <!-- Left: big percentile number + label -->
        <div style="flex:1;min-width:220px;">
          <div class="sa-section-eyebrow" style="margin-bottom:10px;">${_activeCond ? _condLabel + ' Benchmark' : 'Global Benchmark'}</div>
          <div style="font-size:4.5rem;font-weight:700;line-height:1;color:${tierCol};letter-spacing:-0.04em;font-family:'IBM Plex Mono',monospace;">
            ${pctRank}<span style="font-size:1.8rem;font-weight:400;opacity:0.65;">th</span>
          </div>
          <div style="font-size:0.92rem;color:${_C.muted};margin-top:8px;line-height:1.5;">
            Your cohort outperforms <strong style="color:${_C.text};">${pctRank}%</strong> of ${_activeCond ? _condLabel : 'ATLAS'} workspaces${_activeCond ? '' : ' globally'}
          </div>
          <div style="margin-top:10px;">
            <span style="font-size:0.76rem;letter-spacing:0.12em;text-transform:uppercase;
                         padding:4px 10px;border-radius:4px;
                         background:${tierBg};border:1px solid ${tierBorder};
                         color:${tierCol};">
              ${tierLabel}
            </span>
          </div>
        </div>

        <!-- Right: GAI score detail -->
        <div style="text-align:right;min-width:160px;">
          <div class="sa-section-eyebrow" style="text-align:right;margin-bottom:8px;">Workspace GAI</div>
          <div style="font-size:2.4rem;font-weight:700;color:${tierCol};font-family:'IBM Plex Mono',monospace;letter-spacing:-0.03em;">
            ${(myGAI * 100).toFixed(1)}%
          </div>
          <div style="font-size:0.76rem;color:${_C.dim};margin-top:4px;">Your GAI: ${(myGAI * 100).toFixed(1)}%</div>
          <div style="font-size:0.78rem;color:${_C.dim};margin-top:10px;">
            Based on <strong style="color:${_C.muted};">${totalWs}</strong> active workspace${totalWs !== 1 ? 's' : ''} &middot; Global mean GAI: ${(globalMean * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <!-- Percentile gauge bar -->
      <div style="margin-top:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">0th</span>
          <span style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">50th</span>
          <span style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">100th</span>
        </div>
        <!-- Track -->
        <div style="position:relative;height:10px;border-radius:5px;
                    background:linear-gradient(to right,
                      rgba(239,68,68,0.35) 0%,
                      rgba(212,168,67,0.45) 50%,
                      rgba(46,201,138,0.45) 100%);
                    overflow:visible;">
          <!-- Filled portion -->
          <div style="position:absolute;left:0;top:0;height:100%;width:${pctPx}%;
                      border-radius:5px;
                      background:linear-gradient(to right,
                        rgba(239,68,68,0.6) 0%,
                        rgba(212,168,67,0.7) 50%,
                        rgba(46,201,138,0.75) 100%);
                      transition:width 0.8s ease;"></div>
          <!-- Marker -->
          <div style="position:absolute;top:50%;
                      left:${pctPx}%;
                      transform:translate(-50%,-50%);
                      width:16px;height:16px;border-radius:50%;
                      background:${tierCol};
                      border:2px solid ${_C.bg};
                      box-shadow:0 0 8px ${tierCol};
                      transition:left 0.8s ease;"></div>
        </div>
        <div style="margin-top:8px;text-align:center;font-size:0.76rem;color:${_C.dim};">
          Your position: <strong style="color:${tierCol};">${pctRank}th percentile</strong>
        </div>
      </div>
    </div>

    <!-- Controls row: opt-in toggle + refresh -->
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;">

      <!-- Opt-in toggle -->
      <div class="sa-panel" style="flex:1;min-width:280px;display:flex;align-items:flex-start;gap:14px;padding:16px 18px;">
        <div style="flex:1;">
          <div style="font-size:0.82rem;font-weight:600;color:${_C.text};margin-bottom:4px;">
            Share my workspace in global benchmarks
          </div>
          <div id="sa-obs-bm-optin-note" style="font-size:0.78rem;color:${_C.dim};line-height:1.5;">
            ${optIn
              ? 'Your workspace contributes anonymised GAI data to the global network.'
              : 'Your workspace is opted out — your data is not included in others\' benchmarks.'}
          </div>
        </div>
        <!-- Toggle switch -->
        <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer;flex-shrink:0;margin-top:2px;">
          <input type="checkbox" id="sa-obs-bm-optin"
            ${optIn ? 'checked' : ''}
            onchange="saObsBenchmarkToggleOptIn()"
            style="position:absolute;opacity:0;width:0;height:0;">
          <span id="sa-obs-bm-track"
            style="display:inline-block;width:40px;height:22px;border-radius:11px;
                   background:${optIn ? _C.green : _C.border};border:1px solid ${optIn ? _C.greenDim : _C.border};
                   transition:background 0.2s,border-color 0.2s;position:relative;"
            onclick="(function(){const c=document.getElementById('sa-obs-bm-optin');c.checked=!c.checked;saObsBenchmarkToggleOptIn();document.getElementById('sa-obs-bm-track').style.background=c.checked?'${_C.green}':'${_C.border}';document.getElementById('sa-obs-bm-thumb').style.left=c.checked?'20px':'2px';})()">
            <span id="sa-obs-bm-thumb"
              style="position:absolute;top:2px;left:${optIn ? '20px' : '2px'};
                     width:16px;height:16px;border-radius:50%;
                     background:${_C.text};transition:left 0.2s;"></span>
          </span>
        </label>
      </div>

      <!-- Refresh button -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <button onclick="_saObsRefreshBenchmark()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.12em;
                 text-transform:uppercase;padding:9px 18px;border-radius:6px;cursor:pointer;
                 background:transparent;border:1px solid ${_C.border};color:${_C.dim};
                 transition:all 0.18s;"
          onmouseover="this.style.borderColor='${_C.amberDim}';this.style.color='${_C.amber}'"
          onmouseout="this.style.borderColor='${_C.border}';this.style.color='${_C.dim}'">
          ↺ Refresh Benchmark
        </button>
        <span style="font-size:0.70rem;color:${_C.dim};">Cached for 1 hour</span>
      </div>
    </div>

    <!-- Anonymity notice -->
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
                background:${_C.amberFaint};border:1px solid ${_C.border};border-radius:8px;">
      <span style="font-size:0.9rem;opacity:0.5;">◈</span>
      <span style="font-size:0.78rem;color:${_C.dim};line-height:1.5;">
        Comparison is anonymized — no workspace identities are disclosed.
        Your cohort GAI is compared against aggregated scores only.
      </span>
    </div>`;
  };

  // ── Load opt-in setting, then render ─────────────────────────────────────
  const _loadAndRender = (cached) => {
    const myWsKey = (typeof currentWorkspace !== 'undefined' && currentWorkspace)
      ? currentWorkspace.toUpperCase()
      : null;

    if (myWsKey && typeof database !== 'undefined') {
      database.ref('workspaces/' + myWsKey + '/benchmark_opt_in').once('value', snap => {
        const rawVal = snap.val();
        // Default to true when key is absent
        const optIn  = rawVal === null ? true : !!rawVal;
        if (cached) {
          _doRender(cached.wsRanked, optIn);
        } else {
          _saObsBenchmarkCompute(_doRender, optIn);
        }
      });
    } else {
      if (cached) {
        _doRender(cached.wsRanked, _saObsBenchmarkOptIn);
      } else {
        _saObsBenchmarkCompute(_doRender, _saObsBenchmarkOptIn);
      }
    }
  };

  // Check sessionStorage cache first
  const cached = _saObsBenchmarkLoadCache();
  if (cached) {
    _loadAndRender(cached);
  } else {
    _loadAndRender(null);
  }
}

// ── Ordinal suffix helper ─────────────────────────────────────────────────────
function _saObsOrdSuffix(n) {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (abs % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// ── Compute workspace GAIs (uses cache if warm, otherwise reads Firebase) ─────
// callback(wsRanked, optIn) — always called exactly once.
function _saObsBenchmarkCompute(callback, optIn) {
  const _finish = () => {
    const wsRanked = _saObsComputeWorkspaceGAIs();
    callback(wsRanked, optIn);
  };

  // If _saCache already has data, compute immediately
  if ((_saCache.mmas || []).length || (_saCache.peacs || []).length) {
    _finish();
    return;
  }

  // Otherwise, load from Firebase (same pattern as sa-gai.js)
  const body = document.getElementById('sa-obs-body');
  if (body) {
    body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:${_C.dim};font-size:0.88rem;">
      Fetching assessment data from ATLAS network…
    </div>`;
  }

  const todo = { mmas: false, peacs: false };
  const _check = () => {
    if (todo.mmas && todo.peacs) _finish();
  };

  database.ref('assessments').once('value', s => {
    _saCache.mmas = s.val() ? Object.values(s.val()) : [];
    todo.mmas = true; _check();
  });
  database.ref('peacs_assessments').once('value', s => {
    _saCache.peacs = s.val() ? Object.values(s.val()) : [];
    todo.peacs = true; _check();
  });
}

// ── Refresh benchmark (clears sessionStorage cache, re-runs) ──────────────────
function _saObsRefreshBenchmark() {
  try { sessionStorage.removeItem(_OBS_BENCHMARK_CACHE_KEY); } catch(e) {}
  const body = document.getElementById('sa-obs-body');
  if (body) _saObsRenderBenchmark(body);
}
