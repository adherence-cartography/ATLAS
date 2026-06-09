// sa-gai.js — GAI Index: sub-tab switcher, color/tier helpers, bar, sparkline, big gauge, overview, trend, leaderboard, distribution, export, schedule, webhook

// ══════════════════════════════════════════════════════════════════════════════
// GAI INDEX TAB — Global Adherence Index
// Full composite score from all active instruments (MMAS-8 · MAP · PEACS).
// Sub-views: Overview · Trend · Leaderboard · Distribution · Export
// ══════════════════════════════════════════════════════════════════════════════

let _saGaiSubTab = 'overview';

// MAP PE helper — always recomputes from items with Context-Guard (never trusts stored pe_score)
const _gaiMapPE = r => Math.pow(Math.max(0,
  ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3 *
  ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3 *
  (0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)
), 1/3);

function _saRenderGAI(container) {
  container.style.padding = '24px 28px';

  // ── Compute GAI from cache (load if empty) ────────────────────────────────
  const _doRender = () => {
    // Single canonical formula — same as command tab and AI brief
    const _d = _saComputeGAI();
    const mmasOnly   = (_saCache.mmas||[]).filter(r => r.map_q1 === undefined);
    const mapInstr   = (_saCache.mmas||[]).filter(r => r.map_q1 !== undefined);
    const peacs      = _saCache.peacs || [];
    const mmasNorm   = _d.mmasNorm;
    const mapNorm    = _d.mapNorm;
    const peacsNorm  = _d.peacsNorm;
    const components = _d.components;
    const gai        = _d.gai;

    // MAP subscale means
    const mapArch = mapInstr.filter(r=>r.arch_score!=null).map(r=>+r.arch_score);
    const mapExec = mapInstr.filter(r=>r.exec_score!=null).map(r=>+r.exec_score);
    const mapCtx  = mapInstr.filter(r=>r.ctx_score!=null).map(r=>+r.ctx_score);
    const mapSubs = [
      { label:'Architecture', val: mapArch.length ? mapArch.reduce((a,b)=>a+b,0)/mapArch.length : null, col:_C.amber  },
      { label:'Execution',    val: mapExec.length ? mapExec.reduce((a,b)=>a+b,0)/mapExec.length : null, col:_C.cyan   },
      { label:'Context',      val: mapCtx.length  ? mapCtx.reduce((a,b)=>a+b,0)/mapCtx.length  : null, col:_C.purple },
    ];

    // PEACS subscale means
    const pBase  = peacs.filter(r=>r.base!=null).map(r=>+r.base);
    const pMvmt  = peacs.filter(r=>r.mvmt!=null).map(r=>+r.mvmt);
    const pStrata= peacs.filter(r=>r.strata!=null).map(r=>+r.strata);
    const peacsSubs = [
      { label:'BASE',   val: pBase.length  ? pBase.reduce((a,b)=>a+b,0)/pBase.length   : null, col:_C.blue   },
      { label:'MVMT',   val: pMvmt.length  ? pMvmt.reduce((a,b)=>a+b,0)/pMvmt.length   : null, col:_C.green  },
      { label:'STRATA', val: pStrata.length? pStrata.reduce((a,b)=>a+b,0)/pStrata.length: null, col:_C.purple },
    ];

    // Workspace leaderboard
    const wsMap = {};
    const _addToWs = (ws, type, r) => {
      if (!wsMap[ws]) wsMap[ws] = { mmas:[], map:[], peacs:[] };
      wsMap[ws][type].push(r);
    };
    mmasOnly.forEach(r => _addToWs(r.institution_code||r.workspace||'Unknown', 'mmas', r));
    mapInstr.forEach(r => _addToWs(r.institution_code||r.workspace||'Unknown', 'map',  r));
    peacs.forEach(r    => _addToWs(r.institution_code||'Unknown',              'peacs',r));

    const wsRanked = Object.entries(wsMap).map(([ws, d]) => {
      const wMmas = d.mmas.length ? d.mmas.reduce((s,r)=>s+(r.score||0),0)/d.mmas.length/8 : null;
      const wMap  = _geomMean(d.map.map(r=>_gaiMapPE(r)));
      const wPe   = _geomMean(d.peacs.filter(r=>r.pe!=null).map(r=>+r.pe));
      const wComps = [wMmas, wMap, wPe].filter(v => v != null);
      const wGai   = wComps.length ? _geomMean(wComps) : 0;
      return { ws, gai: wGai, n: d.mmas.length + d.map.length + d.peacs.length,
               mmas:d.mmas.length, map:d.map.length, peacs:d.peacs.length };
    }).filter(w => w.n >= 3).sort((a,b) => b.gai - a.gai);

    // 12-week trend (all records bucketed by timestamp)
    const WEEK  = 7*24*60*60*1000;
    const now   = Date.now();
    const trend = Array.from({length:12}, (_,i) => {
      const end   = now - i * WEEK;
      const start = end - WEEK;
      const wM = mmasOnly.filter(r => (r.timestamp||0) >= start && (r.timestamp||0) < end);
      const wP = mapInstr.filter(r => (r.timestamp||0) >= start && (r.timestamp||0) < end);
      const wC = peacs.filter(r    => (r.timestamp||0) >= start && (r.timestamp||0) < end);
      const tM = wM.length ? wM.reduce((s,r)=>s+(r.score||0),0)/wM.length/8 : null;
      const tP = _geomMean(wP.map(r=>_gaiMapPE(r)));
      const tC = _geomMean(wC.filter(r=>r.pe!=null).map(r=>+r.pe));
      const tComps = [tM,tP,tC].filter(v=>v!=null);
      const tGai   = tComps.length ? _geomMean(tComps) : null;
      const wkLabel = new Date(end - WEEK/2);
      return { label: (wkLabel.getMonth()+1) + '/' + wkLabel.getDate(),
               gai: tGai, n: wM.length + wP.length + wC.length };
    }).reverse();

    // Risk distribution — score each individual record
    const _classify = v => v >= 0.85 ? 0 : v >= 0.70 ? 1 : v >= 0.55 ? 2 : v >= 0.40 ? 3 : 4;
    const tiers = ['Optimal','Good','Moderate','Poor','Critical'];
    const tierColors = [_C.green, _C.cyan, _C.amber, '#f97316', _C.red];
    const dist  = [0,0,0,0,0];
    mmasOnly.forEach(r  => { if(r.score!=null) dist[_classify((r.score||0)/8)]++; });
    mapInstr.forEach(r  => { dist[_classify(_gaiMapPE(r))]++; });
    peacs.forEach(r     => { if(r.pe!=null) dist[_classify(+r.pe)]++; });
    const distTotal = dist.reduce((a,b)=>a+b,0) || 1;

    // Predictive trajectory — simple linear regression on trend gai values
    const validTrend = trend.filter(w => w.gai != null && w.n > 0);
    let predNext = null;
    if (validTrend.length >= 3) {
      const n = validTrend.length;
      const xs = validTrend.map((_,i) => i);
      const ys = validTrend.map(w => w.gai);
      const xm = xs.reduce((a,b)=>a+b,0)/n;
      const ym = ys.reduce((a,b)=>a+b,0)/n;
      const slope = xs.reduce((s,x,i)=>s+(x-xm)*(ys[i]-ym),0) / xs.reduce((s,x)=>s+(x-xm)**2,0);
      const intercept = ym - slope * xm;
      predNext = Math.min(1, Math.max(0, intercept + slope * n));
    }

    container.innerHTML = `
    <!-- Sub-nav -->
    <div style="display:flex;gap:6px;margin-bottom:24px;border-bottom:1px solid ${_C.border};padding-bottom:16px;align-items:center;">
      ${[
        ['overview',     '◎', 'Overview'    ],
        ['trend',        '◈', 'Trend'       ],
        ['leaderboard',  '⬡', 'Leaderboard' ],
        ['distribution', '◐', 'Distribution'],
        ['export',       '◩', 'Export'      ],
      ].map(([id, icon, lbl]) => `
        <button id="sa-gai-btn-${id}" onclick="_saGaiSub('${id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:7px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;
                 background:${id===_saGaiSubTab?_C.amberFaint:'transparent'};
                 border:1px solid ${id===_saGaiSubTab?_C.amberDim:_C.border};
                 color:${id===_saGaiSubTab?_C.amber:_C.muted};">
          ${icon} ${lbl}
        </button>`).join('')}
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${gai>=0.70?_C.green:gai>=0.55?_C.amber:_C.red};display:inline-block;box-shadow:0 0 6px ${gai>=0.70?_C.green:gai>=0.55?_C.amber:_C.red};"></span>
        <span style="font-size:0.78rem;color:${_C.dim};letter-spacing:0.14em;text-transform:uppercase;">Live · ${(mmasOnly.length+mapInstr.length+peacs.length).toLocaleString()} records</span>
      </div>
    </div>
    <div id="sa-gai-sub-body"></div>`;

    // Stash computed data for sub-tabs
    container._gaiData = { gai, components, mapSubs, peacsSubs, trend, wsRanked, dist, distTotal, tiers, tierColors, predNext, mmasOnly, mapInstr, peacs };
    _saGaiDrawSub(container);
  };

  // Load data if cache empty
  if (!(_saCache.mmas||[]).length && !(_saCache.peacs||[]).length) {
    container.innerHTML = `<div style="padding:60px;text-align:center;color:${_C.muted};font-size:0.94rem;">Loading GAI data…</div>`;
    const todo = { mmas:false, peacs:false, map:false };
    const _check = () => { if (todo.mmas && todo.peacs && todo.map) _doRender(); };
    database.ref('assessments').once('value', s => {
      _saCache.mmas = s.val() ? Object.values(s.val()) : [];
      todo.mmas = true; _check();
    });
    database.ref('peacs_assessments').once('value', s => {
      _saCache.peacs = s.val() ? Object.values(s.val()) : [];
      todo.peacs = true; _check();
    });
    database.ref('mapData').once('value', s => {
      _saCache.map = s.val() ? Object.values(s.val()) : [];
      todo.map = true; _check();
    });
  } else {
    _doRender();
  }
}

// ── GAI sub-tab switcher ───────────────────────────────────────────────────────
function _saGaiSub(id) {
  _saGaiSubTab = id;
  ['overview','trend','leaderboard','distribution','export'].forEach(k => {
    const b = document.getElementById('sa-gai-btn-' + k);
    if (!b) return;
    const on = k === id;
    b.style.background   = on ? _C.amberFaint : 'transparent';
    b.style.color        = on ? _C.amber : _C.muted;
    b.style.borderColor  = on ? _C.amberDim : _C.border;
  });
  const container = document.getElementById('sa-main');
  if (container) _saGaiDrawSub(container);
}

function _saGaiDrawSub(container) {
  const body = document.getElementById('sa-gai-sub-body');
  if (!body || !container._gaiData) return;
  const d = container._gaiData;
  switch (_saGaiSubTab) {
    case 'overview':     body.innerHTML = _saGaiOverviewHTML(d);     break;
    case 'trend':        body.innerHTML = _saGaiTrendHTML(d);        break;
    case 'leaderboard':  body.innerHTML = _saGaiLeaderHTML(d);       break;
    case 'distribution': body.innerHTML = _saGaiDistHTML(d);         break;
    case 'export':       body.innerHTML = _saGaiExportHTML(d);       break;
  }
}

// ── GAI color helper ───────────────────────────────────────────────────────────
function _saGaiColor(v) {
  return v >= 0.85 ? _C.green : v >= 0.70 ? _C.cyan : v >= 0.55 ? _C.amber : v >= 0.40 ? '#f97316' : _C.red;
}
function _saGaiTier(v) {
  return v >= 0.85 ? 'Optimal' : v >= 0.70 ? 'Good' : v >= 0.55 ? 'Moderate' : v >= 0.40 ? 'Poor' : 'Critical';
}

// ── Horizontal bar (returns SVG-style div) ─────────────────────────────────────
function _saGaiBar(val, col, w = 280, h = 8) {
  const pct = Math.max(0, Math.min(1, val || 0)) * 100;
  return `<div style="width:${w}px;height:${h}px;background:rgba(56,189,248,0.07);border-radius:${h/2}px;overflow:hidden;">
    <div style="height:100%;width:${pct.toFixed(1)}%;background:${col};border-radius:${h/2}px;transition:width 0.6s ease;box-shadow:0 0 6px ${col}44;"></div>
  </div>`;
}

// ── SVG sparkline ──────────────────────────────────────────────────────────────
function _saGaiSparkline(vals, col, W=280, H=60) {
  const valid = vals.filter(v => v != null);
  if (valid.length < 2) return `<div style="width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;color:${_C.dim};font-size:0.78rem;">Insufficient data</div>`;
  const mn = Math.min(...valid), mx = Math.max(...valid);
  const range = mx - mn || 0.001;
  const pts = vals.map((v,i) => {
    const x = (i / (vals.length-1)) * (W-4) + 2;
    const y = v != null ? H - 4 - ((v-mn)/range) * (H-8) : null;
    return { x, y, v };
  }).filter(p => p.y != null);
  const path = pts.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = path + ` L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  return `<svg width="${W}" height="${H}" style="overflow:visible;">
    <defs>
      <linearGradient id="sg-fill-${col.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#sg-fill-${col.replace('#','')})" />
    <path d="${path}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p,i) => i===pts.length-1 ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${col}" />` : '').join('')}
  </svg>`;
}

// ── GAI Gauge (large) ──────────────────────────────────────────────────────────
function _saGaiBigGauge(gai) {
  const R=90, CX=100, CY=100, SW=13;
  const circ = 2*Math.PI*R, sweep = circ*0.75;
  const fill  = sweep * Math.min(1, Math.max(0, gai));
  const col   = _saGaiColor(gai);
  const rot   = -225;
  return `<svg width="200" height="200" viewBox="0 0 200 200">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(56,189,248,0.07)" stroke-width="${SW}"
      stroke-dasharray="${sweep} ${circ-sweep}" stroke-dashoffset="0" stroke-linecap="round"
      transform="rotate(${rot} ${CX} ${CY})"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${col}" stroke-width="${SW}"
      stroke-dasharray="${fill} ${circ-fill}" stroke-dashoffset="0" stroke-linecap="round"
      transform="rotate(${rot} ${CX} ${CY})" style="filter:drop-shadow(0 0 8px ${col});transition:stroke-dasharray 0.9s;"/>
    ${[0,0.25,0.5,0.75,1].map(t => {
      const a=(135+t*270)*Math.PI/180;
      return `<line x1="${(CX+(R-9)*Math.cos(a)).toFixed(1)}" y1="${(CY+(R-9)*Math.sin(a)).toFixed(1)}"
                    x2="${(CX+(R+3)*Math.cos(a)).toFixed(1)}" y2="${(CY+(R+3)*Math.sin(a)).toFixed(1)}"
               stroke="rgba(56,189,248,0.22)" stroke-width="2"/>`;
    }).join('')}
    <text x="${CX}" y="${CY-6}" text-anchor="middle" font-family="IBM Plex Mono,monospace"
      font-size="26" font-weight="700" fill="${col}">${gai.toFixed(3)}</text>
    <text x="${CX}" y="${CY+14}" text-anchor="middle" font-family="IBM Plex Mono,monospace"
      font-size="10" letter-spacing="3" fill="${col}" opacity="0.7">${_saGaiTier(gai).toUpperCase()}</text>
    <circle cx="${CX}" cy="${CY+36}" r="3" fill="${col}" opacity="0.5"/>
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI — OVERVIEW sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function _saGaiOverviewHTML(d) {
  const { gai, components, mapSubs, peacsSubs, predNext } = d;
  const col   = _saGaiColor(gai);
  const tier  = _saGaiTier(gai);

  // Confidence interval (simple bootstrap approximation using SD proxy)
  const allVals = [
    ...(d.mmasOnly.map(r => (r.score||0)/8)),
    ...(d.mapInstr.map(r=>_gaiMapPE(r))),
    ...(d.peacs.filter(r=>r.pe!=null).map(r=>+r.pe)),
  ];
  const n = allVals.length;
  let ciStr = '—';
  if (n >= 4) {
    const mean = allVals.reduce((a,b)=>a+b,0)/n;
    const sd   = Math.sqrt(allVals.reduce((s,v)=>s+(v-mean)**2,0)/(n-1));
    const se   = sd / Math.sqrt(n);
    const lo   = Math.max(0, gai - 1.96*se);
    const hi   = Math.min(1, gai + 1.96*se);
    ciStr = `[${lo.toFixed(3)}, ${hi.toFixed(3)}]`;
  }

  const instrRows = components.map(c => `
    <div style="display:grid;grid-template-columns:90px 1fr 70px 80px;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid ${_C.border};">
      <div>
        <div style="font-size:0.78rem;font-weight:700;color:${c.col};letter-spacing:0.1em;">${c.label}</div>
        <div style="font-size:0.70rem;color:${_C.dim};margin-top:1px;">${c.n.toLocaleString()} records</div>
      </div>
      <div>${_saGaiBar(c.val, c.col, 260, 7)}</div>
      <div style="font-size:0.94rem;font-weight:700;color:${c.col};text-align:right;font-family:'IBM Plex Mono',monospace;">${c.val.toFixed(3)}</div>
      <div style="text-align:right;">
        <span style="font-size:0.70rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:4px;
          background:${_saGaiColor(c.val)}18;border:1px solid ${_saGaiColor(c.val)}44;color:${_saGaiColor(c.val)};">
          ${_saGaiTier(c.val)}
        </span>
      </div>
    </div>`).join('');

  const mapSubRows = mapSubs.filter(s=>s.val!=null).map(s => `
    <div style="display:grid;grid-template-columns:110px 1fr 70px;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid ${_C.border};">
      <div style="font-size:0.82rem;color:${s.col};">${s.label}</div>
      <div>${_saGaiBar(s.val, s.col, 160, 6)}</div>
      <div style="font-size:0.90rem;font-weight:700;color:${s.col};text-align:right;font-family:'IBM Plex Mono',monospace;">${s.val.toFixed(3)}</div>
    </div>`).join('') || `<div style="color:${_C.dim};font-size:0.84rem;padding:10px 0;">No MAP data collected yet.</div>`;

  const peacsSubRows = peacsSubs.filter(s=>s.val!=null).map(s => `
    <div style="display:grid;grid-template-columns:110px 1fr 70px;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid ${_C.border};">
      <div style="font-size:0.82rem;color:${s.col};">${s.label}</div>
      <div>${_saGaiBar(s.val, s.col, 160, 6)}</div>
      <div style="font-size:0.90rem;font-weight:700;color:${s.col};text-align:right;font-family:'IBM Plex Mono',monospace;">${s.val.toFixed(3)}</div>
    </div>`).join('') || `<div style="color:${_C.dim};font-size:0.84rem;padding:10px 0;">No PEACS data collected yet.</div>`;

  return `
  <div style="display:grid;grid-template-columns:220px 1fr;gap:24px;margin-bottom:24px;">

    <!-- Hero gauge -->
    <div style="background:${_C.surface};border:1px solid ${_C.borderB};border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
      ${_saGaiBigGauge(gai)}
      <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">95% CI ${ciStr}</div>
      ${predNext != null ? `<div style="margin-top:8px;padding:6px 14px;border-radius:6px;background:${_saGaiColor(predNext)}12;border:1px solid ${_saGaiColor(predNext)}33;text-align:center;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};">Projected Next Quarter</div>
        <div style="font-size:1.00rem;font-weight:700;color:${_saGaiColor(predNext)};font-family:'IBM Plex Mono',monospace;">${predNext.toFixed(3)}</div>
      </div>` : ''}
    </div>

    <!-- Formula + instrument breakdown -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Formula card -->
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:16px 20px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Composite Formula</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:${_C.muted};line-height:1.8;">
          GAI = <span style="color:${col};">&#x221B;(MMAS<sub style="font-size:0.7em;">norm</sub> × MAP<sub style="font-size:0.7em;">PE</sub> × PEACS<sub style="font-size:0.7em;">PE</sub>)</span><br>
          <span style="font-size:0.76rem;color:${_C.dim};">Geometric mean of available normalized instrument scores (0–1).</span><br>
          <span style="font-size:0.76rem;color:${_C.dim};">MMAS-8: mean(score)/8 · MAP: geom-mean(PE) · PEACS: geom-mean(PE)</span>
        </div>
      </div>

      <!-- Instrument breakdown -->
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:16px 20px;">
        <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:4px;">Instrument Contributions</div>
        ${components.length ? instrRows : `<div style="color:${_C.dim};font-size:0.88rem;padding:16px 0;">No records in cache.</div>`}
      </div>
    </div>
  </div>

  <!-- Subscale row -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:16px 20px;">
      <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber}44;margin-bottom:10px;">MAP Domains</div>
      ${mapSubRows}
    </div>
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:16px 20px;">
      <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.purple}66;margin-bottom:10px;">PEACS Subscales</div>
      ${peacsSubRows}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI — TREND sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function _saGaiTrendHTML(d) {
  const { trend, gai } = d;
  const vals = trend.map(w => w.gai);
  const validWeeks = trend.filter(w => w.gai != null);

  // Week-over-week delta
  const deltaStr = (() => {
    const last2 = validWeeks.slice(-2);
    if (last2.length < 2) return '—';
    const delta = last2[1].gai - last2[0].gai;
    const sign  = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(3)}`;
  })();
  const deltaCol = deltaStr.startsWith('+') ? _C.green : deltaStr.startsWith('-') ? _C.red : _C.muted;

  const peakWk  = validWeeks.reduce((b,w) => (!b||w.gai>b.gai)?w:b, null);
  const troughWk= validWeeks.reduce((b,w) => (!b||w.gai<b.gai)?w:b, null);

  const trendRows = trend.map((w,i) => `
    <tr style="border-bottom:1px solid ${_C.border};">
      <td style="padding:8px 10px;font-size:0.82rem;color:${_C.muted};">Wk ${i+1} · ${w.label}</td>
      <td style="padding:8px 10px;text-align:right;">
        ${w.gai != null
          ? `<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;">
              ${_saGaiBar(w.gai, _saGaiColor(w.gai), 120, 5)}
              <span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;font-weight:700;color:${_saGaiColor(w.gai)};width:50px;text-align:right;">${w.gai.toFixed(3)}</span>
             </div>`
          : `<span style="color:${_C.dim};font-size:0.82rem;">No data</span>`}
      </td>
      <td style="padding:8px 10px;font-size:0.80rem;color:${_C.dim};text-align:right;">${w.n} records</td>
      <td style="padding:8px 10px;text-align:center;">
        ${w.gai!=null?`<span style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border-radius:4px;
          background:${_saGaiColor(w.gai)}18;border:1px solid ${_saGaiColor(w.gai)}44;color:${_saGaiColor(w.gai)};">${_saGaiTier(w.gai)}</span>`:'—'}
      </td>
    </tr>`).join('');

  return `
  <!-- Summary KPIs -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
    ${[
      ['Current GAI',    gai.toFixed(3),           _saGaiColor(gai)],
      ['WoW Delta',      deltaStr,                  deltaCol         ],
      ['Peak (12 wk)',   peakWk  ? peakWk.gai.toFixed(3)   : '—', _C.green ],
      ['Trough (12 wk)', troughWk? troughWk.gai.toFixed(3) : '—', _C.red   ],
    ].map(([l,v,c]) => `
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:14px 16px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${l}</div>
        <div style="font-size:1.60rem;font-weight:700;color:${c};font-family:'IBM Plex Mono',monospace;line-height:1;">${v}</div>
      </div>`).join('')}
  </div>

  <!-- Sparkline -->
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px 24px;margin-bottom:20px;">
    <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">12-Week GAI Trajectory</div>
    <div style="display:flex;align-items:flex-end;gap:12px;">
      ${_saGaiSparkline(vals, _saGaiColor(gai), 680, 90)}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:0.70rem;color:${_C.dim};">${trend[0]?.label}</span>
      <span style="font-size:0.70rem;color:${_C.dim};">${trend[trend.length-1]?.label}</span>
    </div>
    <!-- Tier reference lines -->
    <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;">
      ${[['Optimal',0.85,_C.green],['Good',0.70,_C.cyan],['Moderate',0.55,_C.amber],['Poor',0.40,'#f97316'],['Critical',0,_C.red]].map(([l,v,c])=>`
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="width:20px;height:2px;background:${c};border-radius:1px;"></div>
          <span style="font-size:0.70rem;color:${c};">${l} ≥${v}</span>
        </div>`).join('')}
    </div>
  </div>

  <!-- Weekly table -->
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
      <thead>
        <tr style="border-bottom:1px solid ${_C.borderB};">
          ${['Week','GAI','Records','Tier'].map(h=>`<th style="padding:10px 10px;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};font-weight:400;text-align:left;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${trendRows}</tbody>
    </table>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI — LEADERBOARD sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function _saGaiLeaderHTML(d) {
  const { wsRanked, gai } = d;
  if (!wsRanked.length) return `<div style="padding:60px;text-align:center;color:${_C.dim};font-size:0.90rem;">No workspace records (≥3) to rank yet.</div>`;

  const max = wsRanked[0]?.gai || 1;
  const rows = wsRanked.slice(0, 25).map((w, i) => {
    const col  = _saGaiColor(w.gai);
    const medal= i===0?'◉':i===1?'◈':i===2?'◬':'';
    const instParts = [
      w.mmas  ? `${w.mmas} MMAS`  : null,
      w.map   ? `${w.map} MAP`    : null,
      w.peacs ? `${w.peacs} PEACS`: null,
    ].filter(Boolean).join(' · ');
    return `
    <tr style="border-bottom:1px solid ${_C.border};transition:background 0.12s;"
        onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
      <td style="padding:10px 12px;font-size:0.80rem;color:${_C.dim};text-align:center;width:36px;">
        ${medal ? `<span style="color:${col};">${medal}</span>` : `<span style="color:${_C.dim};">${i+1}</span>`}
      </td>
      <td style="padding:10px 12px;">
        <div style="font-size:0.90rem;font-weight:700;color:${_C.text};font-family:'IBM Plex Mono',monospace;">${_saEsc(w.ws)}</div>
        <div style="font-size:0.72rem;color:${_C.dim};margin-top:2px;">${instParts}</div>
      </td>
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${_saGaiBar(w.gai / max, col, 180, 6)}
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.94rem;font-weight:700;color:${col};min-width:50px;">${w.gai.toFixed(3)}</span>
        </div>
      </td>
      <td style="padding:10px 12px;text-align:center;">
        <span style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:4px;
          background:${col}18;border:1px solid ${col}44;color:${col};">${_saGaiTier(w.gai)}</span>
      </td>
      <td style="padding:10px 12px;font-size:0.82rem;color:${_C.muted};text-align:right;">${w.n.toLocaleString()}</td>
    </tr>`;
  }).join('');

  const platform = gai;
  const above  = wsRanked.filter(w => w.gai >= platform).length;
  const below  = wsRanked.length - above;

  return `
  <!-- Summary -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
    ${[
      ['Workspaces Ranked', wsRanked.length.toString(),         _C.cyan  ],
      ['Above Platform GAI', above.toString(),                  _C.green ],
      ['Below Platform GAI', below.toString(),                  _C.amber ],
    ].map(([l,v,c]) => `
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:14px 16px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${l}</div>
        <div style="font-size:1.50rem;font-weight:700;color:${c};font-family:'IBM Plex Mono',monospace;">${v}</div>
      </div>`).join('')}
  </div>

  <!-- Platform GAI reference -->
  <div style="background:${_C.surface};border:1px solid ${_C.borderB};border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
    <div style="width:8px;height:8px;border-radius:50%;background:${_saGaiColor(platform)};flex-shrink:0;box-shadow:0 0 6px ${_saGaiColor(platform)};"></div>
    <div style="font-size:0.84rem;color:${_C.muted};">Platform GAI baseline: <span style="color:${_saGaiColor(platform)};font-weight:700;">${platform.toFixed(3)}</span> — workspaces above this line outperform the global average.</div>
  </div>

  <!-- Table -->
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
      <thead>
        <tr style="border-bottom:1px solid ${_C.borderB};">
          ${['#','Workspace','GAI','Tier','Records'].map(h=>`<th style="padding:10px 12px;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};font-weight:400;text-align:left;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI — DISTRIBUTION sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function _saGaiDistHTML(d) {
  const { dist, distTotal, tiers, tierColors, mmasOnly, mapInstr, peacs } = d;
  const pcts = dist.map(c => (c / distTotal * 100));

  // Population-level histogram bars (horizontal)
  const distBars = tiers.map((t,i) => `
    <div style="display:grid;grid-template-columns:90px 1fr 70px 60px;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid ${_C.border};">
      <div style="font-size:0.80rem;color:${tierColors[i]};">${t}</div>
      <div style="height:18px;background:rgba(56,189,248,0.05);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pcts[i].toFixed(1)}%;background:${tierColors[i]};border-radius:4px;transition:width 0.7s ease;opacity:0.82;"></div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:700;color:${tierColors[i]};text-align:right;">${dist[i].toLocaleString()}</div>
      <div style="font-size:0.82rem;color:${_C.dim};text-align:right;">${pcts[i].toFixed(1)}%</div>
    </div>`).join('');

  // Score histogram — bucket all normalized scores into 20 bins
  const allScores = [
    ...mmasOnly.map(r => (r.score||0)/8),
    ...mapInstr.map(r=>_gaiMapPE(r)),
    ...peacs.filter(r=>r.pe!=null).map(r=>+r.pe),
  ];
  const bins = Array(20).fill(0);
  allScores.forEach(v => { const idx = Math.min(19, Math.floor(v*20)); bins[idx]++; });
  const bMax = Math.max(...bins) || 1;
  const hW = 28, hGap = 3, hH = 80;
  const histBars = bins.map((b,i) => {
    const h = Math.max(2, (b/bMax)*hH);
    const cx = i * (hW+hGap) + hW/2;
    const x  = i * (hW+hGap);
    const col = _saGaiColor(i/20);
    return `<rect x="${x}" y="${hH-h}" width="${hW}" height="${h}" rx="3" fill="${col}" opacity="0.75"/>`;
  }).join('');
  const histW = 20*(hW+hGap);

  // Instrument-specific distributions
  const instrDist = [
    { label:'MMAS-8',  vals: mmasOnly.map(r=>(r.score||0)/8), col:_C.blue   },
    { label:'MAP PE',  vals: mapInstr.map(r=>_gaiMapPE(r)), col:_C.amber },
    { label:'PEACS PE',vals: peacs.filter(r=>r.pe!=null).map(r=>+r.pe), col:_C.purple },
  ].filter(s=>s.vals.length>0).map(s => {
    const mean = s.vals.reduce((a,b)=>a+b,0)/s.vals.length;
    const sd   = s.vals.length>1 ? Math.sqrt(s.vals.reduce((a,v)=>a+(v-mean)**2,0)/(s.vals.length-1)) : 0;
    const p25  = (() => { const sorted=[...s.vals].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length*0.25)]||0; })();
    const p75  = (() => { const sorted=[...s.vals].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length*0.75)]||0; })();
    return `
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:14px 16px;">
      <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${s.col};margin-bottom:10px;">${s.label}</div>
      ${[['Mean', mean.toFixed(3)],['SD', sd.toFixed(3)],['P25', p25.toFixed(3)],['P75', p75.toFixed(3)],['N', s.vals.length.toLocaleString()]].map(([l,v])=>`
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:0.78rem;color:${_C.dim};">${l}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;font-weight:700;color:${_C.text};">${v}</span>
        </div>`).join('')}
      <div style="margin-top:8px;">${_saGaiBar(mean, s.col, 180, 5)}</div>
    </div>`;
  }).join('');

  return `
  <!-- Risk tier distribution -->
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">
      Risk Stratification — ${distTotal.toLocaleString()} records
    </div>
    ${distBars}
  </div>

  <!-- Score histogram -->
  <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Score Frequency Distribution (all instruments, 20 bins)</div>
    <svg width="${histW}" height="${hH+4}" style="overflow:visible;">${histBars}</svg>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      <span style="font-size:0.70rem;color:${_C.dim};">0.00</span>
      <span style="font-size:0.70rem;color:${_C.dim};">0.50</span>
      <span style="font-size:0.70rem;color:${_C.dim};">1.00</span>
    </div>
  </div>

  <!-- Per-instrument stats -->
  <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.dim};margin-bottom:10px;">Per-Instrument Descriptive Statistics</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">
    ${instrDist || `<div style="color:${_C.dim};">No data.</div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAI — EXPORT sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function _saGaiExportHTML(d) {
  const { gai, components, dist, distTotal, tiers, tierColors, trend } = d;

  return `
  <!-- Distribution tier header -->
  <div style="background:${_C.surface};border:1px solid ${_C.borderB};border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">GAI Data Distribution</div>
    <div style="font-size:0.92rem;color:${_C.muted};line-height:1.7;">
      GAI data is high-value in its metricsed form — actionable benchmarking and longitudinal adherence science
      that cannot be derived from raw assessment counts alone. Three distribution tiers serve different use cases:
    </div>
  </div>

  <!-- Three tier cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">

    <!-- Snapshot -->
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:1.2rem;color:${_C.cyan};">◩</span>
        <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${_C.cyan};">Snapshot</span>
      </div>
      <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:14px;line-height:1.6;">
        One-time export of the current GAI state — composite score, all instrument breakdowns,
        workspace leaderboard, and risk distribution. Suitable for IRB submissions, grant reports,
        and annual reviews.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
        ${['Current GAI composite','Instrument contributions','Subscale decomposition','12-week trend table','Workspace leaderboard','Risk stratification'].map(f=>`
          <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:${_C.text};">
            <span style="color:${_C.green};">✓</span> ${f}
          </div>`).join('')}
      </div>
      <button onclick="_saGaiExportSnapshot()" style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;padding:9px 0;border-radius:6px;cursor:pointer;background:${_C.cyan}18;border:1px solid ${_C.cyan}44;color:${_C.cyan};transition:all 0.15s;"
        onmouseover="this.style.background='${_C.cyan}28'" onmouseout="this.style.background='${_C.cyan}18'">
        ↓ Download JSON Report
      </button>
    </div>

    <!-- Quarterly -->
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:1.2rem;color:${_C.amber};">◈</span>
        <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${_C.amber};">Quarterly Digest</span>
      </div>
      <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:14px;line-height:1.6;">
        Automated quarterly GAI digest delivered by email or as a downloadable package.
        Includes quarter-over-quarter trend, institution benchmarking, and predictive trajectory.
        Ideal for PIs and department leadership.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div>
          <label style="display:block;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Delivery Email</label>
          <input id="sa-gai-q-email" type="email" placeholder="pi@institution.edu"
            style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;"/>
        </div>
        <div>
          <label style="display:block;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Next Delivery</label>
          <input id="sa-gai-q-date" type="date"
            style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;"/>
        </div>
      </div>
      <button onclick="_saGaiScheduleQuarterly()" style="width:100%;margin-top:12px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;padding:9px 0;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;"
        onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">
        ◆ Schedule Digest
      </button>
      <div id="sa-gai-q-st" style="font-size:0.80rem;color:${_C.muted};margin-top:6px;min-height:16px;"></div>
    </div>

    <!-- Real-time -->
    <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:1.2rem;color:${_C.purple};">◎</span>
        <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${_C.purple};">Real-Time API</span>
      </div>
      <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:14px;line-height:1.6;">
        Live GAI endpoint for programmatic access — dashboards, EHR integrations, and
        research pipelines. Secured with workspace key, returns JSON payload on every call.
      </div>
      <div style="background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:12px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_C.muted};margin-bottom:12px;overflow-x:auto;">
        <span style="color:${_C.dim};">GET</span> /api/gai?key=<span style="color:${_C.amber};">{ws_key}</span><br>
        <span style="color:${_C.dim};">→</span> <span style="color:${_C.green};">{ gai, tier, components, trend, ts }</span>
      </div>
      <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:14px;line-height:1.5;">
        Webhook configuration: push GAI updates to your endpoint whenever a new assessment record is submitted.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div>
          <label style="display:block;font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Webhook URL</label>
          <input id="sa-gai-rt-url" type="url" placeholder="https://your-system.com/webhook"
            style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;outline:none;"/>
        </div>
      </div>
      <button onclick="_saGaiSaveWebhook()" style="width:100%;margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;padding:9px 0;border-radius:6px;cursor:pointer;background:${_C.purple}18;border:1px solid ${_C.purple}44;color:${_C.purple};transition:all 0.15s;"
        onmouseover="this.style.background='${_C.purple}28'" onmouseout="this.style.background='${_C.purple}18'">
        ◎ Save Webhook
      </button>
      <div id="sa-gai-rt-st" style="font-size:0.80rem;color:${_C.muted};margin-top:6px;min-height:16px;"></div>
    </div>
  </div>

  <!-- Pricing context -->
  <div style="background:${_C.navy};border:1px solid ${_C.border};border-radius:10px;padding:18px 20px;">
    <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">What makes GAI worth $10K+/year</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;">
      ${[
        ['Composite psychometric precision', 'Geometric mean across instruments isolates true adherence signal from noise'],
        ['Longitudinal trajectory',           'Week-over-week and quarter trend reveals behavioral drift before clinical impact'],
        ['Workspace benchmarking',            'Rank your cohort against peers — anonymised, institution-level comparison'],
        ['Risk stratification',               'Population pyramid identifies Critical/Poor segments for targeted intervention'],
        ['Predictive forecasting',            'Linear regression on trend gives projected GAI for next quarter planning'],
        ['Multi-instrument synthesis',        'MMAS-8, MAP, PEACS normalized and combined — no other tool does this'],
      ].map(([h,b]) => `
        <div style="padding:8px 0;border-bottom:1px solid ${_C.border};">
          <div style="font-size:0.80rem;font-weight:700;color:${_C.text};margin-bottom:2px;">◎ ${h}</div>
          <div style="font-size:0.76rem;color:${_C.dim};line-height:1.5;">${b}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── GAI Export actions ─────────────────────────────────────────────────────────
function _saGaiExportSnapshot() {
  const container = document.getElementById('sa-main');
  const d = container?._gaiData;
  if (!d) return;
  const payload = {
    generated_at:   new Date().toISOString(),
    platform:       'ATLAS Mission Control',
    gai:            +d.gai.toFixed(4),
    tier:           _saGaiTier(d.gai),
    components:     d.components.map(c => ({ instrument:c.label, score:+c.val.toFixed(4), n:c.n })),
    map_domains:    d.mapSubs.filter(s=>s.val!=null).map(s => ({ domain:s.label, score:+s.val.toFixed(4) })),
    peacs_subscales:d.peacsSubs.filter(s=>s.val!=null).map(s => ({ subscale:s.label, score:+s.val.toFixed(4) })),
    trend_12w:      d.trend.map(w => ({ week:w.label, gai:w.gai!=null?+w.gai.toFixed(4):null, n:w.n })),
    risk_distribution: d.tiers.map((t,i) => ({ tier:t, count:d.dist[i], pct:+(d.dist[i]/d.distTotal*100).toFixed(1) })),
    leaderboard:    d.wsRanked.slice(0,25).map(w => ({ workspace:w.ws, gai:+w.gai.toFixed(4), n:w.n })),
    predicted_next_quarter: d.predNext != null ? +d.predNext.toFixed(4) : null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ATLAS_GAI_Snapshot_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('GAI snapshot downloaded.', 2000);
}

async function _saGaiScheduleQuarterly() {
  const email = (document.getElementById('sa-gai-q-email')?.value||'').trim();
  const date  = document.getElementById('sa-gai-q-date')?.value;
  const st    = document.getElementById('sa-gai-q-st');
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    if (st) { st.textContent='Valid email required.'; st.style.color=_C.red; }
    return;
  }
  if (!date) {
    if (st) { st.textContent='Delivery date required.'; st.style.color=_C.red; }
    return;
  }
  try {
    await database.ref('platform_config/gai_quarterly').push({ email, next_delivery: date, created: Date.now() });
    if (st) { st.textContent='Quarterly digest scheduled ✓'; st.style.color=_C.green; }
    showToast('Quarterly GAI digest scheduled.', 2500);
  } catch(e) {
    if (st) { st.textContent='Error: '+e.message; st.style.color=_C.red; }
  }
}

async function _saGaiSaveWebhook() {
  const url = (document.getElementById('sa-gai-rt-url')?.value||'').trim();
  const st  = document.getElementById('sa-gai-rt-st');
  if (!url || !/^https:\/\//.test(url)) {
    if (st) { st.textContent='HTTPS URL required.'; st.style.color=_C.red; }
    return;
  }
  try {
    await database.ref('platform_config/gai_webhook').set({ url, updated: Date.now() });
    if (st) { st.textContent='Webhook saved ✓'; st.style.color=_C.green; }
    showToast('GAI webhook saved.', 2000);
  } catch(e) {
    if (st) { st.textContent='Error: '+e.message; st.style.color=_C.red; }
  }
}
