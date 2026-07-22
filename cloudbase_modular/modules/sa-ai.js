// sa-ai.js — AI Intelligence: intelligence brief, activity heatmap, anomaly detection, Z-chart, predictive analytics, NLQ, API config

// ══════════════════════════════════════════════════════════════════════════════
// AI ENGINE TAB — Intelligence Brief · Anomaly Detection · Predictive Analytics
//                 Natural Language Query · API Config
// ══════════════════════════════════════════════════════════════════════════════

// Proxy URL: if set in ATLAS_CONFIG, all Claude calls route through the Lambda
// proxy (key stays server-side). Falls back to direct browser API call.
const ATLAS_AI_PROXY_URL = window.ATLAS_CONFIG?.aiProxyUrl || null;

let _saAiTab       = 'brief';
let _saAiNlqHistory = [];

const _SA_AI_SUBS = [
  { id: 'brief',   icon: '◉', label: 'Intelligence Brief'   },
  { id: 'anomaly', icon: '◬', label: 'Anomaly Detection'    },
  { id: 'predict', icon: '◩', label: 'Predictive Analytics' },
  { id: 'nlq',     icon: '◫', label: 'NL Query'             },
  { id: 'config',  icon: '◈', label: 'API Config'           },
];

function _saRenderAI(container) {
  container.style.padding = '24px 28px';
  container.innerHTML = `
  <div style="margin-bottom:20px;">
    <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · AI Engine</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_C.text};">ATLAS Intelligence</div>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:22px;border-bottom:1px solid ${_C.border};padding-bottom:16px;flex-wrap:wrap;">
    ${_SA_AI_SUBS.map(s => `
      <button id="sa-ai-btn-${s.id}" onclick="saAiTab('${s.id}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:7px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;
               background:${s.id==='brief'?_C.amberFaint:'transparent'};
               border:1px solid ${s.id==='brief'?'rgba(212,168,67,0.35)':_C.border};
               color:${s.id==='brief'?_C.amber:_C.muted};">
        ${s.icon} ${s.label}
      </button>`).join('')}
    <div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:0.76rem;">
      <span id="sa-ai-key-status"></span>
    </div>
  </div>

  <div id="sa-ai-body"></div>`;

  _saAiUpdateKeyStatus();
  saAiTab('brief');
}

function saAiTab(tab) {
  _saAiTab = tab;
  _SA_AI_SUBS.forEach(s => {
    const btn = document.getElementById('sa-ai-btn-' + s.id);
    if (!btn) return;
    const active = s.id === tab;
    btn.style.background  = active ? _C.amberFaint : 'transparent';
    btn.style.borderColor = active ? 'rgba(212,168,67,0.35)' : _C.border;
    btn.style.color       = active ? _C.amber : _C.muted;
  });
  const body = document.getElementById('sa-ai-body');
  if (!body) return;
  switch (tab) {
    case 'brief':   _saAiRenderBrief(body);   break;
    case 'anomaly': _saAiRenderAnomaly(body); break;
    case 'predict': _saAiRenderPredict(body); break;
    case 'nlq':     _saAiRenderNLQ(body);     break;
    case 'config':  _saAiRenderConfig(body);  break;
  }
}

// ── INTELLIGENCE BRIEF ────────────────────────────────────────────────────────

function _saAiRenderBrief(body) {
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const ws    = _saCache.workspaces || {};
  const now   = Date.now();
  const day30 = now - 30 * 86400000;
  const day60 = now - 60 * 86400000;

  // ── Instrument separation ────────────────────────────────────────────────────
  const mmasOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRecs  = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const mapPE    = r => { const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; return Math.pow(Math.max(0,a*e*c),1/3); };

  // ── Per-instrument means ─────────────────────────────────────────────────────
  const mmasMean   = mmasOnly.length ? mmasOnly.reduce((s,r)=>s+(r.score||0)/8,0)/mmasOnly.length : null;
  const mapMean    = mapRecs.length  ? mapRecs.reduce((s,r)=>s+mapPE(r),0)/mapRecs.length         : null;
  const peacsMean  = peacs.filter(r=>r.pe!=null).length ? peacs.filter(r=>r.pe!=null).reduce((s,r)=>s+(+r.pe),0)/peacs.filter(r=>r.pe!=null).length : null;

  // ── MMAS 30-day trend ────────────────────────────────────────────────────────
  const mmas30    = mmasOnly.filter(r=>(r.timestamp||0)>=day30);
  const mmasPrior = mmasOnly.filter(r=>(r.timestamp||0)>=day60&&(r.timestamp||0)<day30);
  const mmasRecent = mmas30.length  ? mmas30.reduce((s,r)=>s+(r.score||0)/8,0)/mmas30.length   : null;
  const mmasPriorM = mmasPrior.length ? mmasPrior.reduce((s,r)=>s+(r.score||0)/8,0)/mmasPrior.length : null;
  const trendDelta = (mmasRecent!==null&&mmasPriorM!==null) ? mmasRecent-mmasPriorM : null;

  // ── MAP 30-day trend ─────────────────────────────────────────────────────────
  const map30     = mapRecs.filter(r=>(r.timestamp||0)>=day30);
  const mapPrior  = mapRecs.filter(r=>(r.timestamp||0)>=day60&&(r.timestamp||0)<day30);
  const mapRecent  = map30.length   ? map30.reduce((s,r)=>s+mapPE(r),0)/map30.length     : null;
  const mapPriorM  = mapPrior.length? mapPrior.reduce((s,r)=>s+mapPE(r),0)/mapPrior.length : null;
  const mapTrend   = (mapRecent!==null&&mapPriorM!==null) ? mapRecent-mapPriorM : null;

  // ── Critical records (all instruments) ───────────────────────────────────────
  const mmasCrit  = mmasOnly.filter(r=>(r.score||0)/8 < 0.75).length;
  const mapCrit   = mapRecs.filter(r=>mapPE(r) < 0.55).length;
  const peacsCrit = peacs.filter(r=>r.pe!=null&&+r.pe<0.55).length;
  const totalCrit = mmasCrit + mapCrit + peacsCrit;
  const totalN    = mmasOnly.length + mapRecs.length + peacs.length;
  const critPct   = totalN ? (totalCrit/totalN*100).toFixed(1) : '0.0';

  const last7all  = [...mmasOnly,...mapRecs,...peacs].filter(r=>(r.timestamp||0)>=now-7*86400000).length;

  // ── Workspace stats (normalize all instrument scores to 0–1) ────────────────
  // Derive workspace set from assessment records directly — the Firebase
  // workspaces/ node only contains explicitly-configured keys (a small subset
  // of all issued keys) so using Object.keys(ws) would under-count badly.
  const allDataCodes = new Set([
    ...mmasOnly.map(r=>r.institution_code||r.workspace).filter(Boolean),
    ...mapRecs.map(r=>r.institution_code||r.workspace).filter(Boolean),
    ...peacs.map(r=>r.institution_code||r.workspace).filter(Boolean),
  ]);
  const wsStats = [...allDataCodes].map(code => {
    const mr = mmasOnly.filter(r=>(r.institution_code||r.workspace)===code);
    const mapr= mapRecs.filter(r=>(r.institution_code||r.workspace)===code);
    const pr  = peacs.filter(r=>(r.institution_code||r.workspace)===code);
    const all = [
      ...mr.map(r=>(r.score||0)/8),
      ...mapr.map(r=>mapPE(r)),
      ...pr.filter(r=>r.pe!=null).map(r=>+r.pe),
    ];
    if (!all.length) return null;
    return { code, recs: all.length, mean: all.reduce((s,v)=>s+v,0)/all.length };
  }).filter(Boolean);

  const topWs    = [...wsStats].sort((a,b)=>b.mean-a.mean)[0];
  const bottomWs = [...wsStats].sort((a,b)=>a.mean-b.mean)[0];

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const alerts = [];
  if (trendDelta!==null&&trendDelta<-0.02)
    alerts.push({ level:'warn', text:`MMAS-8 mean declined <strong>${(trendDelta*100).toFixed(1)}%</strong> vs prior 30 days — population adherence trending down.` });
  if (trendDelta!==null&&trendDelta>0.02)
    alerts.push({ level:'ok',   text:`MMAS-8 mean improved <strong>+${(trendDelta*100).toFixed(1)}%</strong> vs prior 30 days.` });
  if (mapTrend!==null&&mapTrend<-0.02)
    alerts.push({ level:'warn', text:`MAP PE mean declined <strong>${(mapTrend*100).toFixed(1)}%</strong> vs prior 30 days.` });
  if (mapTrend!==null&&mapTrend>0.02)
    alerts.push({ level:'ok',   text:`MAP PE mean improved <strong>+${(mapTrend*100).toFixed(1)}%</strong> vs prior 30 days.` });
  if (totalN>0&&totalCrit/totalN>0.15)
    alerts.push({ level:'crit', text:`<strong>${critPct}%</strong> of records across all instruments fall below the low-adherence threshold (normalized < 0.75) — intervention may be warranted across multiple sites.` });
  const alertCol = { crit:_C.red, warn:'#f97316', ok:_C.green, info:_C.cyan };

  // ── KPI row — platform-wide ──────────────────────────────────────────────────
  const kpi = [
    { label:'MMAS-8 Mean',      val: mmasMean!=null?mmasMean.toFixed(3):'—',   sub:`N = ${mmasOnly.length.toLocaleString()}`,  col:_C.blue   },
    { label:'MAP Mean PE',      val: mapMean!=null?mapMean.toFixed(3):'—',      sub:`N = ${mapRecs.length.toLocaleString()}`,   col:_C.green  },
    { label:'PEACS Mean PE',    val: peacsMean!=null?peacsMean.toFixed(3):'—',  sub:`N = ${peacs.length.toLocaleString()}`,     col:_C.purple },
    { label:'MMAS-8 Trend',     val: trendDelta!=null?(trendDelta>=0?'+':'')+(trendDelta*100).toFixed(1)+'%':'—', sub:'30d vs prior 30d', col:trendDelta!=null?(trendDelta>=0?_C.green:_C.red):_C.dim },
    { label:'Critical Records', val: totalCrit.toLocaleString(),                sub:`${critPct}% below 0.55`,                  col:_C.red    },
    { label:'Active Workspaces',val: wsStats.length.toLocaleString(),           sub:'With any instrument data',                col:_C.amber  },
  ];

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px;">
    ${kpi.map(k=>`
    <div class="sa-panel" style="text-align:center;padding:14px 10px;">
      <div style="font-size:1.5rem;font-weight:700;color:${k.col};line-height:1;">${k.val}</div>
      <div style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.text};margin-top:4px;">${k.label}</div>
      <div style="font-size:0.70rem;color:${_C.dim};margin-top:2px;">${k.sub}</div>
    </div>`).join('')}
  </div>

  ${alerts.length ? `
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Active Alerts · ${new Date().toLocaleDateString()}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
      ${alerts.map(a=>`
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:${_C.navy};border-left:3px solid ${alertCol[a.level]};border-radius:4px;">
        <span style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${alertCol[a.level]};white-space:nowrap;">${a.level.toUpperCase()}</span>
        <span style="font-size:0.90rem;color:${_C.muted};line-height:1.6;">${a.text}</span>
      </div>`).join('')}
    </div>
  </div>` : `
  <div class="sa-panel" style="margin-bottom:18px;display:flex;align-items:center;gap:10px;padding:12px 16px;">
    <span style="color:${_C.green};">✓</span>
    <span style="font-size:0.90rem;color:${_C.muted};">No active alerts — platform operating within normal parameters.</span>
  </div>`}

  <div style="display:grid;grid-template-columns:1fr 300px;gap:18px;margin-bottom:18px;">

    <div class="sa-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
        <div class="sa-section-eyebrow" style="margin-bottom:0;">Daily Intelligence Brief</div>
        ${(sessionStorage.getItem('atlas_claude_key')||'').trim()
          ? `<button onclick="_saAiBriefWithClaude()" id="sa-brief-gen-btn"
               style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;
                      padding:5px 10px;border-radius:5px;cursor:pointer;
                      background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">◍ Generate with Claude</button>`
          : `<span style="font-size:0.68rem;color:${_C.dim};">Add API key in Config tab</span>`}
      </div>
      <div id="sa-brief-content" style="font-size:0.92rem;color:${_C.muted};line-height:1.8;margin-top:10px;">
        ${_saAiGenerateBrief(mmasOnly, mapRecs, peacs, wsStats, mmasMean, mmasRecent, trendDelta, mapMean, mapTrend, totalCrit, totalN, last7all)}
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.72rem;color:${_C.dim};">
        Generated ${new Date().toLocaleString()} · <span id="sa-brief-mode">Rule-based analysis</span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${topWs ? `
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Top Performing Workspace</div>
        <div style="font-size:1.00rem;font-weight:700;color:${_C.green};margin-top:6px;">${_saEsc(topWs.code)}</div>
        <div style="font-size:0.82rem;color:${_C.muted};">Mean: <strong style="color:${_C.green};">${topWs.mean.toFixed(3)}</strong> · N = ${topWs.recs}</div>
      </div>` : ''}
      ${bottomWs && topWs && bottomWs.code !== topWs.code ? `
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Lowest Performing Workspace</div>
        <div style="font-size:1.00rem;font-weight:700;color:${_C.red};margin-top:6px;">${_saEsc(bottomWs.code)}</div>
        <div style="font-size:0.82rem;color:${_C.muted};">Mean: <strong style="color:${_C.red};">${bottomWs.mean.toFixed(3)}</strong> · N = ${bottomWs.recs}</div>
      </div>` : ''}
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Instrument Adoption</div>
        <div style="display:flex;flex-direction:column;gap:7px;margin-top:8px;">
          ${[['MMAS-8',mmasOnly.length,_C.blue],['PEACS',peacs.length,_C.purple],['MAP',mapRecs.length,_C.green]].map(([lbl,n,col])=>`
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.74rem;color:${_C.muted};width:55px;">${lbl}</span>
            <div style="flex:1;height:5px;background:${_C.navy};border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${totalN>0?Math.min(100,(n/totalN*100)).toFixed(1):0}%;background:${col};border-radius:3px;"></div>
            </div>
            <span style="font-size:0.78rem;color:${col};width:44px;text-align:right;">${n.toLocaleString()}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="sa-panel">
    <div class="sa-section-eyebrow">Submission Activity · Last 30 Days</div>
    <div style="margin-top:12px;">${_saAiActivityHeatmap([...mmasOnly,...mapRecs,...peacs], 30)}</div>
  </div>`;
}

function _saAiGenerateBrief(mmasOnly, mapRecs, peacs, wsStats, mmasMean, mmasRecent, trendDelta, mapMean, mapTrend, totalCrit, totalN, last7all) {
  const lines = [];
  lines.push(`The ATLAS platform holds <strong style="color:${_C.blue};">${mmasOnly.length.toLocaleString()} MMAS-8</strong>, <strong style="color:${_C.green};">${mapRecs.length.toLocaleString()} MAP</strong>, and <strong style="color:${_C.purple};">${peacs.length.toLocaleString()} PEACS</strong> assessments across <strong style="color:${_C.text};">${wsStats.length} active workspaces</strong>.`);
  if (mmasRecent !== null && trendDelta !== null) {
    const dir = trendDelta > 0.01 ? 'trending upward' : trendDelta < -0.01 ? 'trending downward' : 'holding steady';
    lines.push(`MMAS-8 adherence is <strong style="color:${_C.text};">${dir}</strong> with a 30-day mean of <strong style="color:${_C.amber};">${mmasRecent.toFixed(3)}</strong> (${trendDelta>=0?'+':''}${(trendDelta*100).toFixed(1)}% vs prior period).`);
  }
  if (mapMean !== null) {
    const mapDir = mapTrend !== null ? (mapTrend > 0.01 ? ', trending upward' : mapTrend < -0.01 ? ', trending downward' : '') : '';
    lines.push(`MAP mean PE is <strong style="color:${_C.green};">${mapMean.toFixed(3)}</strong>${mapDir}.${peacs.length > 0 ? ` PEACS mean PE available across ${peacs.length.toLocaleString()} records.` : ''}`);
  }
  if (totalCrit > 0 && totalN > 0) {
    const pct = (totalCrit/totalN*100).toFixed(1);
    lines.push(`<strong style="color:${_C.red};">${totalCrit.toLocaleString()} records (${pct}%)</strong> fall below the low-adherence threshold (normalized &lt; 0.75; MMAS-8 raw score &lt; 6) across all instruments — intervention warranted.`);
  }
  if (wsStats.length > 1) {
    const sorted = [...wsStats].sort((a,b)=>b.mean-a.mean);
    const spread = sorted[0].mean - sorted[sorted.length-1].mean;
    if (spread > 0.15) lines.push(`Workspace performance spans a <strong style="color:${_C.text};">${spread.toFixed(3)}</strong> score range — high inter-site variability suggests context-specific factors are influencing adherence.`);
  }
  lines.push(`<strong style="color:${_C.cyan};">${last7all.toLocaleString()} assessments</strong> across all instruments were recorded in the last 7 days.`);
  return lines.join('<br><br>');
}

async function _saAiBriefWithClaude() {
  const btn  = document.getElementById('sa-brief-gen-btn');
  const div  = document.getElementById('sa-brief-content');
  const mode = document.getElementById('sa-brief-mode');
  if (!div) return;

  if (btn) { btn.disabled = true; btn.textContent = '⟳ Generating…'; }

  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const now   = Date.now();
  const ws    = _saCache.workspaces || {};

  const r30        = mmas.filter(r => (r.timestamp||0) >= now - 30*86400000);
  const r7         = mmas.filter(r => (r.timestamp||0) >= now -  7*86400000);
  // GAI via single canonical formula
  const _briefGai  = _saComputeGAI();
  const globalGAI  = _briefGai.gai;
  const bMmasOnly  = (_saCache.mmas||[]).filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const bMapInstr  = (_saCache.mmas||[]).filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  // MMAS-8 only normalized mean for trend/threshold calcs
  const globalMean = _briefGai.mmasNorm || 0;
  const r30mmas    = r30.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mean30     = r30mmas.length ? r30mmas.reduce((s,r)=>s+(r.score||0),0)/r30mmas.length/8 : null;
  const critN      = bMmasOnly.filter(r => (r.score||0)/8 < 0.75).length;
  const highN      = bMmasOnly.filter(r => (r.score||0) >= 8).length;

  const wsMeans = Object.keys(ws).map(code => {
    const recs = bMmasOnly.filter(r => (r.institution_code||r.workspace) === code);
    return recs.length ? { code, mean: recs.reduce((s,r) => s+(r.score||0)/8, 0)/recs.length, n: recs.length } : null;
  }).filter(Boolean).sort((a,b) => b.mean - a.mean);

  const ctx = {
    mmas_total: bMmasOnly.length,
    peacs_total: peacs.length,
    map_total: bMapInstr.length,
    workspace_count: Object.keys(ws).length,
    gai: +globalGAI.toFixed(4),
    gai_components: {
      mmas_norm:  _briefGai.mmasNorm  != null ? +_briefGai.mmasNorm.toFixed(4)  : null,
      map_norm:   _briefGai.mapNorm   != null ? +_briefGai.mapNorm.toFixed(4)   : null,
      peacs_norm: _briefGai.peacsNorm != null ? +_briefGai.peacsNorm.toFixed(4) : null,
    },
    mmas_mean: +globalMean.toFixed(4),
    mean_30d: mean30 !== null ? +mean30.toFixed(4) : null,
    submissions_7d: r7.length,
    critical_n: critN,
    critical_pct: bMmasOnly.length ? +(critN/bMmasOnly.length*100).toFixed(1) : 0,
    high_adherence_n: highN,
    top_workspace: wsMeans[0] ? { code: wsMeans[0].code, mean: +wsMeans[0].mean.toFixed(4), n: wsMeans[0].n } : null,
    lowest_workspace: wsMeans.length > 1 ? { code: wsMeans[wsMeans.length-1].code, mean: +wsMeans[wsMeans.length-1].mean.toFixed(4), n: wsMeans[wsMeans.length-1].n } : null,
    date: new Date().toLocaleDateString(),
  };

  const key   = (sessionStorage.getItem('atlas_claude_key')  || '').trim();
  const model =  sessionStorage.getItem('atlas_claude_model') || 'claude-haiku-4-5-20251001';

  try {
    const useProxy   = !!ATLAS_AI_PROXY_URL;
    const endpoint   = useProxy ? ATLAS_AI_PROXY_URL : 'https://api.anthropic.com/v1/messages';
    const fbUser     = useProxy ? firebase.auth().currentUser : null;
    if (useProxy && !fbUser) throw new Error('Not signed in');
    const idToken    = useProxy ? (await fbUser.getIdToken()) : null;
    const reqHeaders = useProxy
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
      : { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: `You are ATLAS AI, an adherence science intelligence assistant embedded in ATLAS Mission Control. Write a concise daily intelligence brief for a superadmin reviewing the global medication adherence platform. Use the exact numbers from the provided JSON context. Format as 3-4 short paragraphs covering: (1) overall platform status, (2) adherence trends and critical records, (3) workspace performance highlights, (4) any notable observations or recommendations. Write in a professional analytical tone. No markdown headers or bullet points.`,
        messages: [{ role: 'user', content: `Generate the daily intelligence brief for ${ctx.date}.\n\nPlatform data: ${JSON.stringify(ctx)}` }],
      }),
    });
    if (!res.ok) {
      let errMsg = 'API ' + res.status;
      try { const errBody = await res.json(); errMsg = errBody.error || errBody.message || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    if (text) {
      div.innerHTML = text.split('\n\n').map(p => `<p style="margin:0 0 12px 0;">${_saEsc(p)}</p>`).join('');
      if (mode) mode.textContent = `Claude ${model.replace('claude-','').replace('-20251001','')} · ${new Date().toLocaleTimeString()}`;
    }
  } catch(e) {
    div.innerHTML += `<div style="margin-top:10px;font-size:0.78rem;color:rgba(239,68,68,0.7);">Claude API error: ${_saEsc(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '◍ Re-generate'; }
  }
}

function _saAiActivityHeatmap(mmas, days) {
  const now = Date.now();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    buckets[key] = 0;
  }
  mmas.forEach(r => {
    if (!r.timestamp) return;
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (key in buckets) buckets[key]++;
  });
  const keys = Object.keys(buckets).sort();
  const vals = keys.map(k => buckets[k]);
  const max  = Math.max(...vals, 1);
  const bars = keys.map((k, i) => {
    const v = vals[i], pct = v / max;
    const col = pct < 0.01 ? _C.border : pct < 0.25 ? 'rgba(212,168,67,0.2)' : pct < 0.5 ? 'rgba(212,168,67,0.45)' : pct < 0.75 ? 'rgba(212,168,67,0.7)' : _C.amber;
    return `<div title="${k}: ${v} submissions" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="width:100%;height:28px;background:${col};border-radius:2px;"></div>
      ${i % 7 === 0 ? `<div style="font-size:0.64rem;color:${_C.dim};white-space:nowrap;">${k.slice(5)}</div>` : '<div style="height:11px;"></div>'}
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:2px;align-items:flex-end;">${bars}</div>
    <div style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:0.72rem;color:${_C.dim};">
      <span>Fewer</span>
      ${['rgba(212,168,67,0.2)','rgba(212,168,67,0.45)','rgba(212,168,67,0.7)',_C.amber].map(c=>`<span style="width:14px;height:10px;background:${c};border-radius:2px;display:inline-block;"></span>`).join('')}
      <span>More</span><span style="margin-left:auto;">Peak: ${max}/day</span>
    </div>`;
}

// ── ANOMALY DETECTION ─────────────────────────────────────────────────────────

function _saAiRenderAnomaly(body) {
  const mmas     = _saCache.mmas  || [];
  const peacs    = _saCache.peacs || [];
  const ws       = _saCache.workspaces || {};
  const mmasOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRecs  = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const mapPE    = r => { const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; return Math.pow(Math.max(0,a*e*c),1/3); };

  // Build workspace list from all sources
  const allCodes = new Set([
    ...Object.keys(ws),
    ...mmas.map(r=>r.institution_code||r.workspace).filter(Boolean),
    ...peacs.map(r=>r.institution_code||r.workspace).filter(Boolean),
  ]);

  const wsStats = [...allCodes].map(code => {
    const mr  = mmasOnly.filter(r=>(r.institution_code||r.workspace)===code);
    const mapr= mapRecs.filter(r=>(r.institution_code||r.workspace)===code);
    const pr  = peacs.filter(r=>(r.institution_code||r.workspace)===code&&r.pe!=null);
    const allRecs = [
      ...mr.map(r=>({ts:r.timestamp||0, score:(r.score||0)/8})),
      ...mapr.map(r=>({ts:r.timestamp||0, score:mapPE(r)})),
      ...pr.map(r=>({ts:r.timestamp||0, score:+r.pe})),
    ];
    if (allRecs.length < 3) return null;
    const scores = allRecs.map(r=>r.score);
    const mean   = scores.reduce((s,v)=>s+v,0)/scores.length;
    const sorted = [...allRecs].sort((a,b)=>a.ts-b.ts);
    const half   = Math.floor(sorted.length/2);
    const recentMean = sorted.slice(half).reduce((s,r)=>s+r.score,0)/Math.max(1,sorted.length-half);
    const priorMean  = sorted.slice(0,half).reduce((s,r)=>s+r.score,0)/Math.max(1,half);
    return { code, n: allRecs.length, mean, trend: recentMean - priorMean };
  }).filter(Boolean);

  if (!wsStats.length) {
    body.innerHTML = `<div class="sa-panel" style="text-align:center;padding:40px;color:${_C.dim};">Insufficient workspace data for anomaly analysis.</div>`;
    return;
  }

  const globalMean = wsStats.reduce((s,w)=>s+w.mean,0)/wsStats.length;
  const globalSd   = Math.sqrt(wsStats.reduce((s,w)=>s+Math.pow(w.mean-globalMean,2),0)/wsStats.length) || 0.001;
  const withZ      = wsStats.map(w => ({ ...w, z: (w.mean - globalMean) / globalSd }));
  const sorted     = [...withZ].sort((a,b)=>a.z-b.z);
  const anomalies  = withZ.filter(w => Math.abs(w.z) > 1.5 || Math.abs(w.trend) > 0.08);

  const sev = w => {
    if (w.z < -2 || w.trend < -0.1)  return { label:'CRITICAL',     col:_C.red     };
    if (w.z < -1.5 || w.trend < -0.05) return { label:'ELEVATED',   col:'#f97316'  };
    if (w.z > 2)  return { label:'OUTLIER HIGH', col:_C.green  };
    if (w.z > 1.5) return { label:'ABOVE NORM',  col:_C.cyan   };
    return { label:'NORMAL', col:_C.dim };
  };

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
    ${[
      ['Workspaces Analysed', withZ.length,                          _C.amber],
      ['Anomalies Detected',  anomalies.length,                      anomalies.length>0?_C.red:_C.green],
      ['Below −1.5σ',         withZ.filter(w=>w.z<-1.5).length,     _C.red],
      ['Declining Trend',     withZ.filter(w=>w.trend<-0.05).length, '#f97316'],
    ].map(([lbl,val,col])=>`
    <div class="sa-panel" style="text-align:center;">
      <div style="font-size:2rem;font-weight:700;color:${col};line-height:1;">${val}</div>
      <div style="font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">${lbl}</div>
    </div>`).join('')}
  </div>

  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Workspace Z-Score Distribution (σ from global mean = ${globalMean.toFixed(3)})</div>
    <div style="margin-top:14px;overflow-x:auto;">${_saAiZChart(sorted)}</div>
    <div style="margin-top:8px;font-size:0.74rem;color:${_C.dim};">Zones: red = below −1.5σ, green = above +1.5σ. Global SD = ${globalSd.toFixed(3)}.</div>
  </div>

  <div class="sa-panel" style="padding:0;overflow:hidden;">
    <div style="padding:14px 16px;border-bottom:1px solid ${_C.border};">
      <div class="sa-section-eyebrow">Workspace Anomaly Report · ${withZ.length} sites analysed</div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:${_C.bg2};">
          ${['Status','Workspace','N','Mean Score','Z-Score','Trend Δ','Recommended Action'].map(h=>
            `<th style="padding:9px 14px;text-align:left;font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(w => {
            const s = sev(w);
            const action = w.z < -2 || w.trend < -0.1 ? 'Review immediately'
                         : w.z < -1.5 || w.trend < -0.05 ? 'Monitor closely'
                         : w.z > 1.5 ? 'Positive outlier — study factors'
                         : '—';
            return `<tr style="border-bottom:1px solid ${_C.border};transition:background 0.1s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
              <td style="padding:8px 14px;"><span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:${s.col};padding:2px 5px;border:1px solid ${s.col};border-radius:3px;opacity:0.85;">${s.label}</span></td>
              <td style="padding:8px 14px;font-size:0.88rem;color:${_C.text};">${_saEsc(w.code)}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${w.n}</td>
              <td style="padding:8px 14px;font-size:0.90rem;font-weight:700;color:${_C.amber};">${w.mean.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.90rem;font-weight:700;color:${w.z<-1.5?_C.red:w.z>1.5?_C.green:_C.muted};">${w.z>=0?'+':''}${w.z.toFixed(2)}σ</td>
              <td style="padding:8px 14px;font-size:0.88rem;color:${w.trend<-0.05?_C.red:w.trend>0.05?_C.green:_C.muted};">${w.trend>=0?'+':''}${(w.trend*100).toFixed(1)}%</td>
              <td style="padding:8px 14px;font-size:0.82rem;color:${_C.dim};font-style:italic;">${action}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function _saAiZChart(sorted) {
  if (!sorted.length) return '';
  const W = 700, H = 80, padL = 10, padR = 10, cW = W - padL - padR;
  const minZ = Math.min(-3, ...sorted.map(w=>w.z));
  const maxZ = Math.max(3,  ...sorted.map(w=>w.z));
  const range = maxZ - minZ;
  const xZ = z => padL + ((z - minZ) / range) * cW;

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
    <rect x="${padL}" y="10" width="${cW}" height="40" fill="${_C.navy}" rx="3"/>
    <rect x="${xZ(-1.5)}" y="10" width="${xZ(1.5)-xZ(-1.5)}" height="40" fill="rgba(46,201,138,0.06)"/>
    ${[-2,-1.5,0,1.5,2].map(v=>`
      <line x1="${xZ(v)}" y1="8" x2="${xZ(v)}" y2="52" stroke="${v===0?_C.borderB:_C.border}" stroke-width="${v===0?1.5:1}" stroke-dasharray="${v!==0?'3,3':''}"/>
      <text x="${xZ(v)}" y="68" text-anchor="middle" fill="${_C.dim}" font-family="IBM Plex Mono,monospace" font-size="9">${v>0?'+':''}${v}σ</text>
    `).join('')}
    ${sorted.map((w,i) => {
      const col = w.z < -2 ? _C.red : w.z < -1.5 ? '#f97316' : w.z > 1.5 ? _C.green : _C.cyan;
      return `<circle cx="${xZ(w.z).toFixed(1)}" cy="${20+(i%3)*8}" r="4" fill="${col}" opacity="0.8">
        <title>${w.code}: z=${w.z.toFixed(2)}, mean=${w.mean.toFixed(3)}</title>
      </circle>`;
    }).join('')}
  </svg>`;
}

// ── PREDICTIVE ANALYTICS ──────────────────────────────────────────────────────

function _saAiRenderPredict(body) {
  const mmas     = _saCache.mmas  || [];
  const peacs    = _saCache.peacs || [];
  const mmasOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRecs  = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const mapPE    = r => { const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; return Math.pow(Math.max(0,a*e*c),1/3); };
  // Normalize all instruments to 0–1 for combined trend analysis
  const allRecs = [
    ...mmasOnly.map(r=>({timestamp:r.timestamp, score:(r.score||0)/8, ws:r.institution_code||r.workspace})),
    ...mapRecs.map(r=>({timestamp:r.timestamp, score:mapPE(r), ws:r.institution_code||r.workspace})),
    ...peacs.filter(r=>r.pe!=null).map(r=>({timestamp:r.timestamp, score:+r.pe, ws:r.institution_code||r.workspace})),
  ];

  if (allRecs.length < 10) {
    body.innerHTML = `<div class="sa-panel" style="text-align:center;padding:40px;color:${_C.dim};">Insufficient data for predictive analysis (minimum 10 records required).</div>`;
    return;
  }

  const getBucket = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const withTs = allRecs.filter(r=>r.timestamp);
  const bmap = {};
  withTs.forEach(r => {
    const k = getBucket(r.timestamp);
    if (!bmap[k]) bmap[k] = { sum:0, n:0 };
    bmap[k].sum += r.score; bmap[k].n++;
  });
  const bKeys   = Object.keys(bmap).sort();
  const bMeans  = bKeys.map(k => bmap[k].sum / bmap[k].n);
  const bCounts = bKeys.map(k => bmap[k].n);
  const n       = bMeans.length;

  // Linear regression
  const meanX = (n-1)/2;
  const meanY = bMeans.reduce((s,v)=>s+v,0)/n;
  const sxx   = bMeans.reduce((_,__,i)=>_+Math.pow(i-meanX,2),0);
  const sxy   = bMeans.reduce((s,v,i)=>s+(i-meanX)*(v-meanY),0);
  const slope = sxx ? sxy/sxx : 0, intercept = meanY - slope*meanX;
  const ssRes = bMeans.reduce((s,v,i)=>s+Math.pow(v-(intercept+slope*i),2),0);
  const ssTot = bMeans.reduce((s,v)=>s+Math.pow(v-meanY,2),0);
  const r2    = ssTot ? 1 - ssRes/ssTot : 0;

  const forecasts = [1,2,3].map(m => {
    const d = new Date(); d.setMonth(d.getMonth()+m);
    return { label:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, val:Math.max(0,Math.min(1,intercept+slope*(n-1+m))) };
  });

  // Workspace risk: combine all instruments per workspace, normalized 0-1
  const allWsCodes = new Set([
    ...Object.keys(_saCache.workspaces||{}),
    ...allRecs.map(r=>r.ws).filter(Boolean),
  ]);
  const wsRisk = [...allWsCodes].map(code => {
    const recs = allRecs.filter(r=>r.ws===code&&r.timestamp).sort((a,b)=>a.timestamp-b.timestamp);
    if (recs.length < 5) return null;
    const half = Math.floor(recs.length/2);
    const recent  = recs.slice(half).reduce((s,r)=>s+r.score,0)/Math.max(1,recs.length-half);
    const prior   = recs.slice(0,half).reduce((s,r)=>s+r.score,0)/Math.max(1,half);
    const curMean = recs.reduce((s,r)=>s+r.score,0)/recs.length;
    return { code, trend:recent-prior, curMean, n:recs.length };
  }).filter(Boolean).sort((a,b)=>a.trend-b.trend);

  const atRisk = wsRisk.filter(w=>w.trend<-0.05||w.curMean<0.6);
  const trendCol = slope>0.002?_C.green:slope<-0.002?_C.red:_C.cyan;
  const trendLbl = slope>0.002?'↑ Improving':slope<-0.002?'↓ Declining':'→ Stable';

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
    <div class="sa-panel" style="text-align:center;">
      <div style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Trend Direction</div>
      <div style="font-size:1.4rem;font-weight:700;color:${trendCol};">${trendLbl}</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin-top:4px;">${slope>=0?'+':''}${(slope*100).toFixed(2)}%/mo</div>
    </div>
    <div class="sa-panel" style="text-align:center;">
      <div style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Model Fit (R²)</div>
      <div style="font-size:1.4rem;font-weight:700;color:${r2>0.6?_C.green:r2>0.3?_C.amber:_C.muted};">${r2.toFixed(3)}</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin-top:4px;">Linear regression · ${n} months</div>
    </div>
    ${forecasts.map(f=>`
    <div class="sa-panel" style="text-align:center;border:1px dashed rgba(212,168,67,0.2);">
      <div style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Forecast ${f.label}</div>
      <div style="font-size:1.4rem;font-weight:700;color:${_C.amber};">${f.val.toFixed(3)}</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin-top:4px;">Projected mean</div>
    </div>`).join('')}
  </div>

  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Global Adherence Trend · Monthly Buckets</div>
    <div id="sa-predict-chart" style="height:220px;position:relative;margin-top:14px;"></div>
    <div style="margin-top:8px;font-size:0.74rem;color:${_C.dim};">Amber = observed monthly mean · Cyan dashed = linear fit · ◆ = projected months</div>
  </div>

  <div class="sa-panel">
    <div class="sa-section-eyebrow">At-Risk Workspaces · ${atRisk.length} flagged</div>
    ${atRisk.length === 0 ? `<div style="margin-top:10px;font-size:0.90rem;color:${_C.dim};font-style:italic;">No workspaces meet at-risk criteria (declining >5% or mean <0.60).</div>`
    : `<div style="overflow-x:auto;margin-top:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${_C.bg2};">
            ${['Workspace','N','Current Mean','Trend Δ','Risk Factors'].map(h=>
              `<th style="padding:9px 14px;text-align:left;font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>${atRisk.slice(0,15).map(w=>{
            const factors = [];
            if (w.trend<-0.1) factors.push(`<span style="color:${_C.red};">Sharp decline</span>`);
            else if (w.trend<-0.05) factors.push(`<span style="color:#f97316;">Declining trend</span>`);
            if (w.curMean<0.625) factors.push(`<span style="color:${_C.red};">Critical adherence</span>`);
            else if (w.curMean<0.75) factors.push(`<span style="color:#f97316;">Below threshold</span>`);
            return `<tr style="border-bottom:1px solid ${_C.border};" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
              <td style="padding:8px 14px;font-size:0.88rem;color:${_C.text};">${_saEsc(w.code)}</td>
              <td style="padding:8px 14px;font-size:0.84rem;color:${_C.muted};">${w.n}</td>
              <td style="padding:8px 14px;font-size:0.90rem;font-weight:700;color:${w.curMean<0.75?_C.red:w.curMean<1.0?'#f97316':_C.green};">${w.curMean.toFixed(3)}</td>
              <td style="padding:8px 14px;font-size:0.90rem;color:${w.trend<0?_C.red:_C.green};">${w.trend>=0?'+':''}${(w.trend*100).toFixed(1)}%</td>
              <td style="padding:8px 14px;font-size:0.82rem;">${factors.join(' · ')||'—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`}
  </div>`;

  _saAiDrawPredictChart('sa-predict-chart', bKeys, bMeans, bCounts, slope, intercept, forecasts, n);
}

function _saAiDrawPredictChart(id, labels, values, counts, slope, intercept, forecasts, n) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const W = wrap.offsetWidth||700, H = 200;
  const padL=42, padR=20, padT=10, padB=28;
  const cW=W-padL-padR, cH=H-padT-padB;
  const allV = [...values,...forecasts.map(f=>f.val)];
  const minV = Math.max(0,Math.min(...allV)-0.05), maxV = Math.min(1,Math.max(...allV)+0.05);
  const totalN = n + forecasts.length;
  const sx = i => padL+(i/Math.max(totalN-1,1))*cW;
  const sy = v => padT+(1-(v-minV)/(maxV-minV+0.001))*cH;
  const pts = values.map((v,i)=>`${sx(i).toFixed(1)},${sy(v).toFixed(1)}`);
  const area = `M${padL},${padT+cH} L${pts.join(' L')} L${sx(n-1)},${padT+cH} Z`;
  const reg0=intercept, regN=intercept+slope*(totalN-1);
  const yTicks = [0.25,0.5,0.75,1.0].filter(v=>v>=minV&&v<=maxV);
  const step = Math.max(1,Math.floor(n/6));
  wrap.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
    <defs><linearGradient id="sa-pred-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${_C.amber}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${_C.amber}" stop-opacity="0"/>
    </linearGradient></defs>
    ${yTicks.map(v=>`<line x1="${padL}" y1="${sy(v).toFixed(1)}" x2="${padL+cW}" y2="${sy(v).toFixed(1)}" stroke="${_C.border}" stroke-width="1"/>
      <text x="${padL-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" fill="${_C.dim}" font-family="IBM Plex Mono,monospace" font-size="9">${v.toFixed(2)}</text>`).join('')}
    <path d="${area}" fill="url(#sa-pred-grad)"/>
    <path d="M${sx(0).toFixed(1)},${sy(reg0).toFixed(1)} L${sx(totalN-1).toFixed(1)},${sy(regN).toFixed(1)}" fill="none" stroke="${_C.cyan}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>
    <path d="M${pts.join(' L')}" fill="none" stroke="${_C.amber}" stroke-width="2" stroke-linecap="round"/>
    ${values.map((v,i)=>`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="${_C.amber}"><title>${labels[i]}: ${v.toFixed(3)} (n=${counts[i]})</title></circle>`).join('')}
    ${forecasts.map((f,i)=>`<circle cx="${sx(n+i).toFixed(1)}" cy="${sy(f.val).toFixed(1)}" r="4" fill="none" stroke="${_C.amber}" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.7"/>
      <text x="${sx(n+i).toFixed(1)}" y="${(sy(f.val)-7).toFixed(1)}" text-anchor="middle" fill="${_C.amberDim}" font-family="IBM Plex Mono,monospace" font-size="8">◆${f.val.toFixed(2)}</text>`).join('')}
    ${labels.filter((_,i)=>i%step===0||i===n-1).map(lbl=>{
      const i=labels.indexOf(lbl);
      return `<text x="${sx(i).toFixed(1)}" y="${H-4}" text-anchor="middle" fill="${_C.dim}" font-family="IBM Plex Mono,monospace" font-size="8">${lbl.slice(-5)}</text>`;
    }).join('')}
  </svg>`;
}

// ── NATURAL LANGUAGE QUERY ────────────────────────────────────────────────────

function _saAiRenderNLQ(body) {
  const hasKey = !!(sessionStorage.getItem('atlas_claude_key')||'').trim();
  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 280px;gap:18px;align-items:start;">
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="sa-panel" style="min-height:300px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;" id="sa-nlq-history">
        ${_saAiNlqHistory.length===0
          ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:240px;gap:10px;opacity:0.5;">
              <div style="font-size:2rem;">◫</div>
              <div style="font-size:0.90rem;color:${_C.dim};">Ask ATLAS AI a question about the data.</div>
            </div>`
          : _saAiNlqHistory.map(_saAiNlqBubble).join('')}
      </div>
      <div class="sa-panel" style="display:flex;gap:10px;align-items:center;">
        <input id="sa-nlq-input" placeholder="e.g. What is the global mean adherence score?"
          style="flex:1;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                 font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:9px 14px;border-radius:6px;outline:none;"
          onkeydown="if(event.key==='Enter')_saAiNlqSubmit()"/>
        <button onclick="_saAiNlqSubmit()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 16px;border-radius:6px;cursor:pointer;
                 background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">Ask →</button>
        <button onclick="_saAiNlqClear()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;
                 padding:9px 12px;border-radius:6px;cursor:pointer;
                 background:transparent;border:1px solid ${_C.border};color:${_C.dim};">Clear</button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Suggested Queries</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          ${['What is the global mean MMAS adherence score?','What is the mean MAP PE score across all workspaces?','How many PEACS assessments are on record and what is the mean PE?','How many records fall below critical adherence?','Which workspace has the highest mean score?','What is the 30-day MMAS submission volume?','Compare MMAS and MAP adherence levels.','What percentage of records are high adherence?'].map(q=>`
          <button onclick="document.getElementById('sa-nlq-input').value='${q.replace(/'/g,"\\'")}'"
            style="text-align:left;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;padding:6px 10px;border-radius:5px;cursor:pointer;
                   background:${_C.navy};border:1px solid ${_C.border};color:${_C.muted};transition:all 0.12s;line-height:1.4;"
            onmouseover="this.style.borderColor='rgba(212,168,67,0.35)';this.style.color='${_C.amber}'"
            onmouseout="this.style.borderColor='${_C.border}';this.style.color='${_C.muted}'">${q}</button>`).join('')}
        </div>
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Mode</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${hasKey?_C.green:_C.cyan};display:inline-block;"></span>
          <span style="font-size:0.84rem;color:${hasKey?_C.green:_C.cyan};">${hasKey?'Claude API active':'Rule-based mode'}</span>
        </div>
        ${!hasKey?`<div style="margin-top:8px;font-size:0.78rem;color:${_C.dim};line-height:1.5;">Add a Claude API key in the Config tab to enable LLM responses.</div>`:''}
      </div>
    </div>
  </div>`;
}

function _saAiNlqBubble(msg) {
  const isUser = msg.role === 'user';
  return `<div style="display:flex;flex-direction:column;align-items:${isUser?'flex-end':'flex-start'};gap:3px;">
    <div style="font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};">${isUser?'You':'ATLAS AI'}</div>
    <div style="max-width:88%;padding:10px 14px;border-radius:8px;font-size:0.90rem;line-height:1.6;
               background:${isUser?_C.amberFaint:_C.navy};border:1px solid ${isUser?'rgba(212,168,67,0.2)':_C.border};
               color:${_C.text};">${isUser ? msg.content : (msg.html ? msg.content : _esc(msg.content))}</div>
  </div>`;
}

function _saAiNlqSubmit() {
  const input = document.getElementById('sa-nlq-input');
  const q = (input?.value||'').trim();
  if (!q) return;
  if (input) input.value = '';
  _saAiNlqHistory.push({ role:'user', content:_saEsc(q) });
  _saAiRenderNLQ(document.getElementById('sa-ai-body'));
  setTimeout(async () => {
    const answer = await _saAiNlqAnswer(q);
    _saAiNlqHistory.push({ role:'assistant', content:answer, html:true });
    _saAiRenderNLQ(document.getElementById('sa-ai-body'));
    const hist = document.getElementById('sa-nlq-history');
    if (hist) hist.scrollTop = hist.scrollHeight;
  }, 80);
}

function _saAiNlqClear() {
  _saAiNlqHistory = [];
  _saAiRenderNLQ(document.getElementById('sa-ai-body'));
}

async function _saAiNlqAnswer(q) {
  const key = (sessionStorage.getItem('atlas_claude_key')||'').trim();
  if (key || ATLAS_AI_PROXY_URL) {
    try { return await _saAiCallClaude(q, key); }
    catch(err) {
      // Try the rule engine as fallback; only show error if it has no specific answer
      const fallback = _saAiRuleAnswer(q);
      if (!fallback.startsWith('Summary:')) return fallback;
      return `Unable to reach Claude AI (${err.message || 'network error'}). Try again in a moment.`;
    }
  }
  return _saAiRuleAnswer(q);
}

function _saAiRuleAnswer(q) {
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const ws    = _saCache.workspaces || {};
  const now   = Date.now();
  const qL    = q.toLowerCase();

  const mmasQaOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapQaRecs  = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const _mapQaPE   = r => { const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; return Math.pow(Math.max(0,a*e*c),1/3); };
  const globalMean = mmasQaOnly.length ? mmasQaOnly.reduce((s,r)=>s+(r.score||0)/8,0)/mmasQaOnly.length : 0;
  const mapGlobalMean = mapQaRecs.length ? mapQaRecs.reduce((s,r)=>s+_mapQaPE(r),0)/mapQaRecs.length : null;
  const last30 = mmasQaOnly.filter(r=>(r.timestamp||0)>=now-30*86400000);
  const mean30 = last30.length ? last30.reduce((s,r)=>s+(r.score||0)/8,0)/last30.length : null;
  const critN  = mmasQaOnly.filter(r=>(r.score||0)/8<0.75).length;
  const highN  = mmasQaOnly.filter(r=>(r.score||0)>=8).length;

  const wsMeans = Object.keys(ws).map(code=>{
    const recs=mmasQaOnly.filter(r=>(r.institution_code||r.workspace)===code);
    return recs.length?{code,mean:recs.reduce((s,r)=>s+(r.score||0)/8,0)/recs.length,n:recs.length}:null;
  }).filter(Boolean);

  // If the question references a specific country, region, workspace, or any
  // comparison — the rule engine can't answer it. Fall straight to the summary
  // so the user sees useful data rather than a confidently wrong answer.
  const _hasGeo = /\b(country|countries|region|city|continent|africa|asia|europe|america|australia|north|south|east|west|[a-z]{4,})\b/.test(qL) &&
    !/\b(mmas|peacs|map|score|mean|global|total|count|submission|volume|high adherence|critical)\b/.test(qL);
  const _hasComparison = /\bvs\b|\bversus\b|\bcompare\b|\bdifference\b|\bbetween\b/.test(qL);
  if (!_hasGeo && !_hasComparison) {
    if ((qL.includes('mean')||qL.includes('average'))&&(qL.includes('30')||qL.includes('recent')))
      return mean30!==null?`The 30-day mean MMAS adherence score is <strong>${mean30.toFixed(3)}</strong> (n = ${last30.length.toLocaleString()}).`:'No timestamped records in the last 30 days.';
    if (qL.includes('map')&&(qL.includes('mean')||qL.includes('pe')||qL.includes('score')))
      return mapGlobalMean!==null?`MAP mean PE score is <strong>${mapGlobalMean.toFixed(3)}</strong> across <strong>${mapQaRecs.length.toLocaleString()}</strong> records.`:'No MAP records on file.';
    if (qL.includes('mean')||qL.includes('average')||qL.includes('global'))
      return `MMAS-8 global mean is <strong>${globalMean.toFixed(3)}</strong> (N=${mmasQaOnly.length.toLocaleString()}). MAP mean PE: <strong>${mapGlobalMean!==null?mapGlobalMean.toFixed(3):'—'}</strong> (N=${mapQaRecs.length.toLocaleString()}).`;
    if (qL.includes('critical')||qL.includes('low adherence')||qL.includes('below threshold'))
      return `<strong>${critN.toLocaleString()} MMAS records (${mmasQaOnly.length?(critN/mmasQaOnly.length*100).toFixed(1):0}%)</strong> fall below the low-adherence threshold (score &lt; 6, normalized &lt; 0.75).`;
    if (qL.includes('high adherence'))
      return `<strong>${highN.toLocaleString()} records (${mmasQaOnly.length?(highN/mmasQaOnly.length*100).toFixed(1):0}%)</strong> have achieved high adherence (MMAS-8 score = 8).`;
    if (qL.includes('highest')||qL.includes('top workspace')||qL.includes('best workspace')) {
      const top=[...wsMeans].sort((a,b)=>b.mean-a.mean)[0];
      return top?`Top workspace: <strong>${_saEsc(top.code)}</strong> — MMAS mean ${top.mean.toFixed(3)} (N=${top.n}).`:'No workspace data.';
    }
    if (qL.includes('lowest workspace')||qL.includes('worst workspace')||qL.includes('bottom workspace')) {
      const bot=[...wsMeans].sort((a,b)=>a.mean-b.mean)[0];
      return bot?`Lowest workspace: <strong>${_saEsc(bot.code)}</strong> — MMAS mean ${bot.mean.toFixed(3)} (N=${bot.n}).`:'No workspace data.';
    }
    if (qL.includes('peacs'))
      return `There are <strong>${peacs.length.toLocaleString()} PEACS assessments</strong> on record.`;
    if (qL.includes('submission')||qL.includes('volume')) {
      const l7=[...mmas,...peacs].filter(r=>(r.timestamp||0)>=now-7*86400000).length;
      const p7=[...mmas,...peacs].filter(r=>(r.timestamp||0)>=now-14*86400000&&(r.timestamp||0)<now-7*86400000).length;
      const delta=p7?((l7-p7)/p7*100).toFixed(0):null;
      return `Last 7 days: <strong>${l7.toLocaleString()}</strong> submissions (all instruments). Prior 7: <strong>${p7.toLocaleString()}</strong>.${delta!==null?` Volume ${delta>=0?'+':''}${delta}% vs prior week.`:''}`;
    }
    if (qL.includes('how many')||qL.includes('count')||qL.includes('total'))
      return `Totals: <strong>${mmasQaOnly.length.toLocaleString()} MMAS-8</strong>, <strong>${mapQaRecs.length.toLocaleString()} MAP</strong>, <strong>${peacs.length.toLocaleString()} PEACS</strong> across <strong>${wsMeans.length} workspaces</strong>.`;
  }
  const _ruleKey = (sessionStorage.getItem('atlas_claude_key')||'').trim();
  const hint = (_ruleKey || ATLAS_AI_PROXY_URL) ? '' : ' Add a Claude API key in Config for full natural language support.';
  return `Summary: <strong>${mmasQaOnly.length.toLocaleString()} MMAS-8</strong> (mean ${globalMean.toFixed(3)}), <strong>${mapQaRecs.length.toLocaleString()} MAP</strong>${mapGlobalMean!==null?' (mean PE '+mapGlobalMean.toFixed(3)+')':''}, <strong>${peacs.length.toLocaleString()} PEACS</strong>.${hint}`;
}

async function _saAiCallClaude(query, apiKey) {
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const now   = Date.now();

  const mmasOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRecs  = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const _mapPE   = r => Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3);

  const mmasMean  = mmasOnly.length ? mmasOnly.reduce((s,r)=>s+(r.score||0)/8,0)/mmasOnly.length : 0;
  const mapMean   = mapRecs.length  ? mapRecs.reduce((s,r)=>s+_mapPE(r),0)/mapRecs.length : null;
  const peacsMean = peacs.length    ? peacs.reduce((s,r)=>s+(r.pe!=null?+r.pe:0),0)/peacs.length : null;
  const r30 = mmasOnly.filter(r=>(r.timestamp||0)>=now-30*86400000);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  // Truncate long field values to keep context lean
  const _trunc = (s, max=50) => s.length > max ? s.slice(0, max) : s;

  // Tally a string field into a sorted top-N count object
  const _tally = (recs, field, topN=10) => {
    const map = {};
    for (const r of recs) {
      const v = _trunc((r[field]||'').trim());
      if (!v) continue;
      map[v] = (map[v]||0) + 1;
    }
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,topN)
      .reduce((obj,[k,n])=>{ obj[k]=n; return obj; }, {});
  };

  // Tally + mean adherence per group
  const _tallyMean = (recs, field, topN=12) => {
    const map = {};
    for (const r of recs) {
      const v = _trunc((r[field]||'').trim());
      if (!v) continue;
      if (!map[v]) map[v] = { n:0, sum:0 };
      map[v].n++;
      map[v].sum += (r.score||0)/8;
    }
    return Object.entries(map).sort((a,b)=>b[1].n-a[1].n).slice(0,topN)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3) }; return obj; }, {});
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const wsDataCodes = new Set(mmasOnly.map(r=>r.institution_code||r.workspace).filter(Boolean));

  // Helper: build {n, mean, low_n, high_n} rollups keyed by a string field
  // MMAS: low < 0.75 (validated raw < 6), high >= 1.0 (validated raw = 8)
  // MAP/PEACS: low < 0.75, high >= 0.85 (platform-defined; no published cutoffs)
  const _tallyFull = (recs, scoreKey, field, topN=40, isMap=false) => {
    const map = {};
    const highT = isMap ? 0.85 : 1.0;
    for (const r of recs) {
      const v = _trunc((r[field]||'').trim());
      if (!v || v === 'Unknown') continue;
      const s = isMap ? _mapPE(r) : (r[scoreKey]||0)/8;
      if (!map[v]) map[v] = { n:0, sum:0, low:0, high:0 };
      map[v].n++;
      map[v].sum += s;
      if (s < 0.75) map[v].low++;
      if (s >= highT) map[v].high++;
    }
    return Object.entries(map).sort((a,b)=>b[1].n-a[1].n).slice(0,topN)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3), low_n:v.low, high_n:v.high }; return obj; }, {});
  };

  // ── MMAS-8 breakdowns ─────────────────────────────────────────────────────────
  const mmas_by_country  = _tallyFull(mmasOnly, 'score', 'country', 40);
  const mmas_by_city     = (() => {
    const map = {};
    for (const r of mmasOnly) {
      const city = _trunc((r.city||'').trim()); const ctry = _trunc((r.country||'').trim());
      if (!city || city==='Unknown' || !ctry) continue;
      const k = city+', '+ctry; const s = (r.score||0)/8;
      if (!map[k]) map[k]={ n:0,sum:0,low:0,high:0,country:ctry };
      map[k].n++; map[k].sum+=s;
      if(s<0.75) map[k].low++; if(s>=1.0) map[k].high++;
    }
    return Object.entries(map).filter(([,v])=>v.n>=2).sort((a,b)=>b[1].n-a[1].n).slice(0,60)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3), low_n:v.low, high_n:v.high, country:v.country }; return obj; }, {});
  })();

  const mmas_by_workspace = [...wsDataCodes].map(code => {
    const recs = mmasOnly.filter(r=>(r.institution_code||r.workspace)===code);
    const mean = recs.reduce((s,r)=>s+(r.score||0)/8,0)/recs.length;
    return { code, n:recs.length, mean:+mean.toFixed(3),
      low_n: recs.filter(r=>(r.score||0)/8<0.75).length,
      high_n: recs.filter(r=>(r.score||0)>=8).length };
  }).sort((a,b)=>b.n-a.n).slice(0,15)
    .reduce((obj,w)=>{ obj[w.code]={n:w.n,mean:w.mean,low_n:w.low_n,high_n:w.high_n}; return obj; }, {});

  // Conditions and drugs (MMAS)
  const conditions_global   = _tallyMean(mmasOnly, 'condition', 15);
  const drugs_global        = _tallyMean(mmasOnly, 'drug_name', 12);
  const dosing_frequency    = _tally(mmasOnly, 'dosing_frequency', 8);

  // Conditions per country (top 20 countries, top 5 conditions each)
  const _ctryCondMap = {};
  for (const r of mmasOnly) {
    const c = _trunc((r.country||'').trim()); const cond = _trunc((r.condition||'').trim());
    if (!c || !cond) continue;
    if (!_ctryCondMap[c]) _ctryCondMap[c] = {};
    _ctryCondMap[c][cond] = (_ctryCondMap[c][cond]||0)+1;
  }
  const conditions_by_country = Object.entries(_ctryCondMap)
    .sort((a,b)=>Object.values(b[1]).reduce((s,n)=>s+n,0)-Object.values(a[1]).reduce((s,n)=>s+n,0))
    .slice(0,20)
    .reduce((obj,[c,cm])=>{
      obj[c]=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,5).reduce((o,[k,n])=>{ o[k]=n; return o; },{});
      return obj;
    }, {});

  // ── MAP breakdowns ────────────────────────────────────────────────────────────
  const map_by_country = _tallyFull(mapRecs, null, 'country', 30, true);
  const map_by_city    = (() => {
    const map = {};
    for (const r of mapRecs) {
      const city = _trunc((r.city||'').trim()); const ctry = _trunc((r.country||'').trim());
      if (!city || city==='Unknown' || !ctry) continue;
      const k = city+', '+ctry; const s = _mapPE(r);
      if (!map[k]) map[k]={ n:0,sum:0,low:0,high:0,country:ctry };
      map[k].n++; map[k].sum+=s;
      if(s<0.75) map[k].low++; if(s>=0.85) map[k].high++;
    }
    return Object.entries(map).filter(([,v])=>v.n>=2).sort((a,b)=>b[1].n-a[1].n).slice(0,40)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3), low_n:v.low, high_n:v.high, country:v.country }; return obj; }, {});
  })();
  const map_conditions = _tallyMean(mapRecs, 'condition', 12);
  const map_drugs      = _tallyMean(mapRecs, 'drug_name',  10);

  // ── PEACS breakdowns ──────────────────────────────────────────────────────────
  const peacsScored = peacs.filter(r=>r.pe!=null);
  const _peScore    = r => +r.pe;
  const peacs_by_country = (() => {
    const map = {};
    for (const r of peacsScored) {
      const v = _trunc((r.country||'').trim()); if (!v||v==='Unknown') continue;
      const s = _peScore(r);
      if (!map[v]) map[v]={ n:0,sum:0,low:0,high:0 };
      map[v].n++; map[v].sum+=s;
      if(s<0.75) map[v].low++; if(s>=0.85) map[v].high++;
    }
    return Object.entries(map).sort((a,b)=>b[1].n-a[1].n).slice(0,30)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3), low_n:v.low, high_n:v.high }; return obj; }, {});
  })();
  const peacs_by_city = (() => {
    const map = {};
    for (const r of peacsScored) {
      const city = _trunc((r.city||'').trim()); const ctry = _trunc((r.country||'').trim());
      if (!city||city==='Unknown'||!ctry) continue;
      const k = city+', '+ctry; const s = _peScore(r);
      if (!map[k]) map[k]={ n:0,sum:0,low:0,high:0,country:ctry };
      map[k].n++; map[k].sum+=s;
      if(s<0.75) map[k].low++; if(s>=0.85) map[k].high++;
    }
    return Object.entries(map).filter(([,v])=>v.n>=2).sort((a,b)=>b[1].n-a[1].n).slice(0,30)
      .reduce((obj,[k,v])=>{ obj[k]={ n:v.n, mean:+(v.sum/v.n).toFixed(3), low_n:v.low, high_n:v.high, country:v.country }; return obj; }, {});
  })();

  // Demographics distributions (MMAS)
  const demographics = {
    gender:           _tally(mmasOnly, 'gender',          6),
    age_range:        _tally(mmasOnly, 'age_range',       8),
    education:        _tally(mmasOnly, 'education_level', 6),
    dosing_frequency: _tally(mmasOnly, 'dosing_frequency',6),
  };

  // ── Context object ────────────────────────────────────────────────────────────
  const ctx = {
    date: new Date().toISOString().slice(0,10),
    // MMAS-8
    mmas_total:       mmasOnly.length,
    mmas_global_mean: +mmasMean.toFixed(3),
    mmas_mean_30d:    r30.length ? +(r30.reduce((s,r)=>s+(r.score||0)/8,0)/r30.length).toFixed(3) : null,
    mmas_low_n:       mmasOnly.filter(r=>(r.score||0)/8<0.55).length,
    mmas_high_n:      mmasOnly.filter(r=>(r.score||0)/8>=0.85).length,
    mmas_by_country,   // {country:{n,mean,low_n,high_n}}
    mmas_by_city,      // {"city, country":{n,mean,low_n,high_n,country}}
    mmas_by_workspace, // {workspace:{n,mean,low_n,high_n}}
    conditions_global,     // {condition:{n,mean}}
    conditions_by_country, // {country:{condition:count}}
    drugs_global,          // {drug:{n,mean}}
    dosing_frequency,      // {frequency:count}
    // MAP
    map_total:       mapRecs.length,
    map_global_mean: mapMean !== null ? +mapMean.toFixed(3) : null,
    map_low_n:       mapRecs.filter(r=>_mapPE(r)<0.55).length,
    map_high_n:      mapRecs.filter(r=>_mapPE(r)>=0.85).length,
    map_by_country,  // {country:{n,mean,low_n,high_n}}
    map_by_city,     // {"city, country":{n,mean,low_n,high_n,country}}
    map_conditions,  // {condition:{n,mean}}
    map_drugs,       // {drug:{n,mean}}
    // PEACS
    peacs_total:       peacs.length,
    peacs_global_mean: peacsMean !== null ? +peacsMean.toFixed(3) : null,
    peacs_low_n:       peacsScored.filter(r=>_peScore(r)<0.55).length,
    peacs_high_n:      peacsScored.filter(r=>_peScore(r)>=0.85).length,
    peacs_by_country,  // {country:{n,mean,low_n,high_n}}
    peacs_by_city,     // {"city, country":{n,mean,low_n,high_n,country}}
    // Platform
    demographics,      // {gender, age_range, education, dosing_frequency}
    workspace_count: wsDataCodes.size,
  };

  // Safety valve: trim to ~40KB — drop secondary tables if context grows too large
  // Priority: keep country/city data (most useful); drop workspace then MAP/PEACS city tables
  let ctxFinal = JSON.stringify(ctx);
  if (ctxFinal.length > 40960)
    ctxFinal = JSON.stringify({ ...ctx, mmas_by_workspace: undefined });
  if (ctxFinal.length > 40960)
    ctxFinal = JSON.stringify({ ...ctx, mmas_by_workspace: undefined, map_by_city: undefined, peacs_by_city: undefined });
  if (ctxFinal.length > 40960)
    ctxFinal = JSON.stringify({ ...ctx, mmas_by_workspace: undefined, map_by_city: undefined, peacs_by_city: undefined, mmas_by_city: undefined });
  const model      = sessionStorage.getItem('atlas_claude_model')||'claude-haiku-4-5-20251001';
  const useProxy   = !!ATLAS_AI_PROXY_URL;
  const endpoint   = useProxy ? ATLAS_AI_PROXY_URL : 'https://api.anthropic.com/v1/messages';
  const fbUser     = useProxy ? firebase.auth().currentUser : null;
  if (useProxy && !fbUser) throw new Error('Not signed in');
  const idToken    = useProxy ? (await fbUser.getIdToken()) : null;
  const reqHeaders = useProxy
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
    : { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };

  const res = await fetch(endpoint, {
    method:'POST',
    headers: reqHeaders,
    body:JSON.stringify({model, max_tokens:500,
      system:`You are ATLAS AI, an adherence science intelligence assistant in ATLAS Mission Control. Answer questions using ONLY the real platform data provided in the JSON context. Never say you lack data if it is present in the context.

All numeric adherence values are on a 0–1 scale (e.g. 0.716 = 71.6%). For MMAS-8: low_n = patients with normalized score below 0.75 (raw score below 6, low adherence); high_n = patients with score = 1.00 (raw score = 8, high adherence). For MAP/PEACS: low_n below 0.75; high_n at or above 0.85.

Data fields:
MMAS-8: mmas_by_country, mmas_by_city — {n, mean, low_n, high_n} per location
MAP: map_by_country, map_by_city — {n, mean, low_n, high_n} per location (PE score)
PEACS: peacs_by_country, peacs_by_city — {n, mean, low_n, high_n} per location (PE score)
conditions_global, conditions_by_country — condition prevalence and MMAS-8 mean
map_conditions, map_drugs — MAP-specific condition and drug breakdowns
drugs_global — top medications with adherence means
dosing_frequency — global dosing frequency distribution
demographics — gender, age_range, education, dosing_frequency tallies

For regional questions (e.g. "Western Europe", "Asia"), use your geographic knowledge to identify which countries in mmas_by_country or conditions_by_country belong to that region, then aggregate.

Rules: express means as % (0.716 = 71.6%); cite exact numbers from context; 2–5 sentences; no headers.

Context: ${ctxFinal}`,
      messages:[{role:'user',content:query}]}),
  });
  if (!res.ok) {
    let errMsg = 'API ' + res.status;
    try { const errBody = await res.json(); errMsg = errBody.error || errBody.message || errMsg; } catch(_) {}
    throw new Error(errMsg);
  }
  const data = await res.json();
  return data.content?.[0]?.text||'No response.';
}

// ── API CONFIG ────────────────────────────────────────────────────────────────

function _saAiRenderConfig(body) {
  const savedKey   = sessionStorage.getItem('atlas_claude_key')   || '';
  const savedModel = sessionStorage.getItem('atlas_claude_model') || 'claude-haiku-4-5-20251001';

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;">

    <div class="sa-panel">
      <div class="sa-section-eyebrow">Claude API Configuration</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px;">
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">API Key</div>
          <div style="display:flex;gap:8px;">
            <input id="sa-cfg-api-key" type="password" placeholder="${savedKey?savedKey.slice(0,8)+'…'+savedKey.slice(-4):'sk-ant-…'}" value="${savedKey}"
              style="flex:1;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};
                     font-family:'IBM Plex Mono',monospace;font-size:0.86rem;padding:8px 12px;border-radius:6px;outline:none;"/>
            <button onclick="_saAiCfgToggleKey()" id="sa-cfg-key-toggle"
              style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;padding:8px 10px;border-radius:6px;cursor:pointer;
                     background:transparent;border:1px solid ${_C.border};color:${_C.dim};">Show</button>
          </div>
          <div style="font-size:0.72rem;color:${_C.dim};margin-top:5px;">Stored in sessionStorage only — cleared when you close the tab. Never sent to Firebase.</div>
        </div>
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:5px;">Model</div>
          <select id="sa-cfg-model"
            style="width:100%;background:${_C.surface};border:1px solid ${_C.border};color:${_C.text};
                   font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:8px 10px;border-radius:6px;outline:none;">
            <option value="claude-haiku-4-5-20251001" ${savedModel==='claude-haiku-4-5-20251001'?'selected':''}>Claude Haiku 4.5 — fast · low cost</option>
            <option value="claude-sonnet-4-6" ${savedModel==='claude-sonnet-4-6'?'selected':''}>Claude Sonnet 4.6 — balanced</option>
            <option value="claude-opus-4-6" ${savedModel==='claude-opus-4-6'?'selected':''}>Claude Opus 4.6 — capable</option>
            <option value="claude-opus-4-7" ${savedModel==='claude-opus-4-7'?'selected':''}>Claude Opus 4.7 — advanced</option>
            <option value="claude-opus-4-8" ${savedModel==='claude-opus-4-8'?'selected':''}>Claude Opus 4.8 — most capable</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="_saAiCfgSave()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                   padding:9px 20px;border-radius:7px;cursor:pointer;
                   background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">Save Config</button>
          <button onclick="_saAiCfgTest()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;
                   padding:9px 16px;border-radius:7px;cursor:pointer;
                   background:transparent;border:1px solid ${_C.border};color:${_C.muted};">Test Connection</button>
        </div>
        <div id="sa-cfg-status" style="font-size:0.88rem;color:${_C.dim};min-height:20px;"></div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Current Status</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:0;">
          ${[
            ['API Key',     savedKey?'Configured':'Not set',   savedKey?_C.green:_C.dim],
            ['Model',       savedModel.replace('claude-','').replace('-20251001',''), _C.text],
            ['NLQ Mode',    savedKey?'Claude API':'Rule-based', savedKey?_C.green:_C.cyan],
            ['Key Storage', 'sessionStorage (ephemeral)',       _C.dim],
          ].map(([lbl,val,col])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${_C.border};">
            <span style="font-size:0.84rem;color:${_C.muted};">${lbl}</span>
            <span style="font-size:0.84rem;font-weight:600;color:${col};">${val}</span>
          </div>`).join('')}
        </div>
        ${savedKey?`<button onclick="_saAiCfgClear()"
          style="margin-top:12px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;
                 padding:7px 14px;border-radius:5px;cursor:pointer;
                 background:transparent;border:1px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.7);">Clear API Key</button>`:''}
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Privacy & Security</div>
        <div style="font-size:0.84rem;color:${_C.muted};line-height:1.7;margin-top:8px;">
          Only <strong style="color:${_C.text};">aggregated statistics</strong> (means, counts) are sent to Claude — no individual patient records are transmitted.<br><br>
          For production, route Claude API calls through a server-side proxy to keep the key out of the browser environment.
        </div>
      </div>
    </div>
  </div>`;
}

function _saAiCfgToggleKey() {
  const inp=document.getElementById('sa-cfg-api-key'), btn=document.getElementById('sa-cfg-key-toggle');
  if(!inp||!btn) return;
  const hidden=inp.type==='password';
  inp.type=hidden?'text':'password'; btn.textContent=hidden?'Hide':'Show';
}

function _saAiCfgSave() {
  const key=(document.getElementById('sa-cfg-api-key')?.value||'').trim();
  const model=document.getElementById('sa-cfg-model')?.value||'claude-haiku-4-5-20251001';
  if(key) sessionStorage.setItem('atlas_claude_key',key);
  sessionStorage.setItem('atlas_claude_model',model);
  const st=document.getElementById('sa-cfg-status');
  if(st) st.innerHTML=`<span style="color:${_C.green};">✓ Configuration saved.</span>`;
  _saAiUpdateKeyStatus();
}

function _saAiCfgClear() {
  sessionStorage.removeItem('atlas_claude_key');
  const st=document.getElementById('sa-cfg-status');
  if(st) st.innerHTML=`<span style="color:${_C.dim};">API key cleared.</span>`;
  _saAiRenderConfig(document.getElementById('sa-ai-body'));
  _saAiUpdateKeyStatus();
}

async function _saAiCfgTest() {
  const key=(document.getElementById('sa-cfg-api-key')?.value||sessionStorage.getItem('atlas_claude_key')||'').trim();
  const model=document.getElementById('sa-cfg-model')?.value||'claude-haiku-4-5-20251001';
  const st=document.getElementById('sa-cfg-status');
  const useProxy = !!ATLAS_AI_PROXY_URL;
  if(!useProxy && !key){if(st)st.innerHTML=`<span style="color:#f97316;">Enter an API key first.</span>`;return;}
  if(st)st.innerHTML=`<span style="color:${_C.dim};">Testing connection…</span>`;
  try {
    const endpoint  = useProxy ? ATLAS_AI_PROXY_URL : 'https://api.anthropic.com/v1/messages';
    const fbUser2   = useProxy ? firebase.auth().currentUser : null;
    if (useProxy && !fbUser2) throw new Error('Not signed in');
    const idToken   = useProxy ? (await fbUser2.getIdToken()) : null;
    const hdrs = useProxy
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
      : { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    const res=await fetch(endpoint,{
      method:'POST',
      headers: hdrs,
      body:JSON.stringify({model,max_tokens:5,messages:[{role:'user',content:'Reply: ok'}]}),
    });
    if(res.ok){if(st)st.innerHTML=`<span style="color:${_C.green};">✓ Claude ${useProxy?'Proxy':'API'} connected (${model}).</span>`;}
    else {
      const err=await res.json().catch(()=>({}));
      if(st)st.innerHTML=`<span style="color:${_C.red};">✗ Error ${res.status}: ${err.error?.message||'Unknown'}</span>`;
    }
  } catch(e){if(st)st.innerHTML=`<span style="color:${_C.red};">✗ ${e.message}</span>`;}
}

function _saAiUpdateKeyStatus() {
  const el=document.getElementById('sa-ai-key-status');
  if(!el) return;
  const hasKey=!!(sessionStorage.getItem('atlas_claude_key')||'').trim();
  el.innerHTML=hasKey
    ?`<span style="width:6px;height:6px;border-radius:50%;background:${_C.green};display:inline-block;margin-right:4px;"></span><span style="color:${_C.green};">Claude API active</span>`
    :`<span style="width:6px;height:6px;border-radius:50%;background:${_C.dim};display:inline-block;margin-right:4px;"></span><span style="color:${_C.dim};">Rule-based mode</span>`;
}
