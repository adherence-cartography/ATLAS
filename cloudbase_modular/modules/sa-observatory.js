// sa-observatory.js — Observatory: live feed render, trend monitor, anomaly alerts, longitudinal view



// ══════════════════════════════════════════════════════════════════════════════
// OBSERVATORY TAB — Live Feed · Trend Monitor · Anomaly Alerts · Longitudinal
// ══════════════════════════════════════════════════════════════════════════════

let _saObsTab = 'feed';
let _saObsStream = [];        // assembled records sorted newest-first
let _saObsFeedLimit = 30;
let _saObsTimer = null;       // auto-refresh interval id

function _saRenderObservatory(container) {
  const subs = [
    { id:'feed',         label:'Live Feed'      },
    { id:'trends',       label:'Trend Monitor'  },
    { id:'anomalies',    label:'Anomaly Alerts'  },
    { id:'longitudinal', label:'Longitudinal'   },
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
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
