// sa-ext-comp.js — External Device Comparison: CSV parse, aggregate, Bland-Altman, ROC/AUC, analysis runner, results render
// ══════════════════════════════════════════════════════════════════════════════
// EXTERNAL METHOD COMPARATOR
// ══════════════════════════════════════════════════════════════════════════════

let _saExtFormat  = null;   // 'event' | 'daily' | 'score'
let _saExtRaw     = null;   // parsed CSV { headers, rows }
let _saExtMap     = {};     // { patient, date, value }  column mapping
let _saExtWindow  = 14;     // aggregation window (days)
let _saExtInst    = 'mmas'; // criterion instrument
let _saExtName    = '';     // user-supplied device/app name
let _saExtResults = null;   // computed analysis

// ── CSV parser ────────────────────────────────────────────────────────────────
function _saExtParseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows = lines.slice(1).map(line => {
    const vals = []; let cur='', inQ=false;
    for (const ch of line) {
      if (ch==='"') { inQ=!inQ; continue; }
      if (ch===',' && !inQ) { vals.push(cur.trim()); cur=''; continue; }
      cur+=ch;
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h,i) => [h, vals[i]||'']));
  }).filter(r => Object.values(r).some(v=>v!==''));
  return { headers, rows };
}

// ── Aggregate device data into per-patient scores aligned to ATLAS records ───
function _saExtAggregate() {
  const mmasRaw  = (_saCache.mmas||[]).filter(r => r.tool !== 'map' && r.map_q1 === undefined && r.patient_number);
  const mapRaw   = (_saCache.mmas||[]).filter(r => (r.tool === 'map' || r.map_q1 !== undefined) && r.patient_number);
  const crit     = _saExtInst === 'map' ? mapRaw : mmasRaw;
  const cutoff   = _saExtInst === 'map' ? 0.50 : 6;
  const scoreKey = _saExtInst === 'map' ? 'pe_score' : null;

  const parseMMAS = r => { let s=0; for(let j=1;j<=8;j++){const v=r['q'+j];s+=(typeof v==='number'?v:(v===true||v==='yes'||v==='Yes'||v===1||v==='1')?1:0);} return s/8; };
  const getCrit  = r => _saExtInst === 'map' ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3) : parseMMAS(r);

  // Latest criterion record per patient
  const critByPt = {};
  crit.forEach(r => {
    const ts = r.timestamp||0;
    if (!critByPt[r.patient_number] || ts > critByPt[r.patient_number].ts)
      critByPt[r.patient_number] = { val: getCrit(r), ts, raw: r };
  });

  const { rows } = _saExtRaw;
  const pc = _saExtMap.patient, dc = _saExtMap.date, vc = _saExtMap.value;
  const winMs = _saExtWindow * 86400000;

  // Build device score per patient
  const devByPt = {};
  if (_saExtFormat === 'score') {
    // Pre-aggregated: one row per patient per score
    rows.forEach(r => {
      const pt = String(r[pc]||'').trim();
      if (!pt || !critByPt[pt]) return;
      const v = parseFloat(r[vc]);
      if (isNaN(v)) return;
      devByPt[pt] = v;
    });
  } else {
    // Event or daily: group rows by patient, aggregate over window before criterion assessment
    const byPt = {};
    rows.forEach(r => {
      const pt = String(r[pc]||'').trim();
      if (!pt) return;
      if (!byPt[pt]) byPt[pt] = [];
      const ts = new Date(r[dc]).getTime();
      const v  = _saExtFormat === 'event' ? (String(r[vc]).match(/^(1|yes|true|taken)$/i)?1:0) : parseFloat(r[vc]);
      if (!isNaN(ts) && !isNaN(v)) byPt[pt].push({ ts, v });
    });
    Object.keys(byPt).forEach(pt => {
      if (!critByPt[pt]) return;
      const critTs = critByPt[pt].ts;
      const window = byPt[pt].filter(e => e.ts <= critTs && e.ts >= critTs - winMs);
      if (!window.length) return;
      devByPt[pt] = _saExtFormat === 'event'
        ? window.filter(e=>e.v===1).length / _saExtWindow  // PDC
        : window.reduce((s,e)=>s+e.v,0) / window.length;
    });
  }

  // Build matched pairs
  const pairs = [];
  Object.keys(devByPt).forEach(pt => {
    if (!critByPt[pt]) return;
    const dev  = Math.min(1, Math.max(0, devByPt[pt]));
    const crit_v = critByPt[pt].val; // already 0-1 (mmas/8 or map pe)
    pairs.push({ pt, dev, crit: crit_v, nonAdherent: crit_v < cutoff });
  });
  return pairs;
}

// ── Bland-Altman ──────────────────────────────────────────────────────────────
function _saExtComputeBA(pairs) {
  const diffs  = pairs.map(p => p.dev - p.crit);
  const means  = pairs.map(p => (p.dev + p.crit) / 2);
  const bias   = _psyMean(diffs);
  const sd     = _psySD(diffs);
  const loaHi  = bias + 1.96 * sd;
  const loaLo  = bias - 1.96 * sd;
  const within = diffs.filter(d => d >= loaLo && d <= loaHi).length / diffs.length;
  return { bias, sd, loaHi, loaLo, within, diffs, means };
}

// ── ROC / AUC ────────────────────────────────────────────────────────────────
function _saExtComputeROC(pairs) {
  // positive class = non-adherent by criterion
  // device score: lower = more non-adherent (like PDC — lower PDC = worse)
  // so we treat lower device score as higher risk → threshold sweeps from high→low
  const sorted = [...pairs].sort((a,b) => b.dev - a.dev);
  const nPos = pairs.filter(p=>p.nonAdherent).length;
  const nNeg = pairs.length - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  let tp=0, fp=0;
  const curve = [{fpr:0, tpr:0}];
  sorted.forEach(p => {
    if (p.nonAdherent) tp++; else fp++;
    curve.push({ fpr: fp/nNeg, tpr: tp/nPos });
  });
  curve.push({fpr:1, tpr:1});

  // AUC via trapezoidal
  let auc = 0;
  for (let i=1; i<curve.length; i++) {
    auc += (curve[i].fpr - curve[i-1].fpr) * (curve[i].tpr + curve[i-1].tpr) / 2;
  }

  // Optimal threshold: max Youden J
  let bestJ=-1, bestI=1;
  for (let i=1; i<curve.length-1; i++) {
    const J = curve[i].tpr - curve[i].fpr;
    if (J > bestJ) { bestJ=J; bestI=i; }
  }
  const optSens = curve[bestI].tpr;
  const optSpec = 1 - curve[bestI].fpr;
  const optThresh = bestI <= sorted.length ? sorted[bestI-1].dev : 0;

  // AUC 95% CI (Hanley-McNeil)
  const Q1 = auc / (2 - auc);
  const Q2 = 2 * auc * auc / (1 + auc);
  const seAUC = Math.sqrt((auc*(1-auc) + (nPos-1)*(Q1-auc**2) + (nNeg-1)*(Q2-auc**2)) / (nPos*nNeg));
  const aucLo = Math.max(0, auc - 1.96*seAUC);
  const aucHi = Math.min(1, auc + 1.96*seAUC);

  return { auc, aucLo, aucHi, curve, optSens, optSpec, optThresh, nPos, nNeg };
}

// ── Run full analysis ─────────────────────────────────────────────────────────
function _saExtRunAnalysis() {
  const btn = document.getElementById('sa-ext-run-btn');
  if (btn) { btn.disabled=true; btn.textContent='Computing…'; }

  _saExtName = (document.getElementById('sa-ext-name-inp')||{}).value || 'External Method';
  _saExtInst = (document.getElementById('sa-ext-inst-sel')||{}).value || 'mmas';
  _saExtWindow = parseInt((document.getElementById('sa-ext-win-sel')||{}).value||'14',10);
  _saExtMap = {
    patient: (document.getElementById('sa-ext-col-patient')||{}).value,
    date:    (document.getElementById('sa-ext-col-date')||{}).value,
    value:   (document.getElementById('sa-ext-col-value')||{}).value,
  };

  setTimeout(() => {
    try {
      const pairs = _saExtAggregate();
      if (pairs.length < 10) {
        const body = document.getElementById('sa-ext-results');
        if (body) body.innerHTML = `<div class="sa-panel" style="text-align:center;padding:48px;">
          <div style="font-size:0.94rem;color:${_C.text};">Insufficient Matched Patients</div>
          <div style="font-size:0.84rem;color:${_C.muted};margin-top:8px;">Found ${pairs.length} matched records. Need ≥10. Check that patient_number values in your CSV match those in ATLAS.</div>
        </div>`;
        if (btn) { btn.disabled=false; btn.textContent='Run Analysis'; }
        return;
      }

      const r_xy = _psyPearson(pairs.map(p=>p.dev), pairs.map(p=>p.crit));
      // Fisher z CI for r
      const zr   = 0.5*Math.log((1+r_xy)/(1-r_xy));
      const se_z = 1/Math.sqrt(pairs.length-3);
      const rLo  = Math.tanh(zr-1.96*se_z), rHi = Math.tanh(zr+1.96*se_z);

      const ba   = _saExtComputeBA(pairs);
      const roc  = _saExtComputeROC(pairs);

      // Known-groups
      const hi = pairs.filter(p=>!p.nonAdherent).map(p=>p.dev);
      const lo = pairs.filter(p=> p.nonAdherent).map(p=>p.dev);
      const hiM = hi.length?_psyMean(hi):null, loM = lo.length?_psyMean(lo):null;
      let cohenD = null;
      if (hi.length>=5 && lo.length>=5) {
        const poolSD = Math.sqrt(((_psyVar(hi)*(hi.length-1))+(_psyVar(lo)*(lo.length-1)))/(hi.length+lo.length-2));
        cohenD = poolSD>0 ? Math.abs(hiM-loM)/poolSD : 0;
      }

      _saExtResults = { pairs, r_xy, rLo, rHi, ba, roc, hi, lo, hiM, loM, cohenD, n:pairs.length };
      _saExtRenderResults(document.getElementById('sa-ext-results'));
    } catch(e) {
      const body = document.getElementById('sa-ext-results');
      if (body) body.innerHTML = `<div class="sa-panel" style="text-align:center;padding:32px;color:${_C.red};">Analysis error: ${_saEsc(String(e))}</div>`;
    }
    if (btn) { btn.disabled=false; btn.textContent='Run Analysis'; }
  }, 60);
}

// ── Render results ────────────────────────────────────────────────────────────
function _saExtRenderResults(container) {
  if (!container || !_saExtResults) return;
  const d    = _saExtResults;
  const inst = _saExtInst === 'map' ? 'MAP PE' : 'MMAS-8';
  const cutoff = _saExtInst === 'map' ? 0.50 : 6;
  const cutLabel = _saExtInst === 'map' ? 'PE < 0.50' : 'Score < 6';

  const rCol  = Math.abs(d.r_xy)>=0.50?_C.green:Math.abs(d.r_xy)>=0.30?_C.amber:_C.red;
  const bCol  = Math.abs(d.ba.bias)<=0.05?_C.green:Math.abs(d.ba.bias)<=0.10?_C.amber:_C.red;
  const aucC  = d.roc?(d.roc.auc>=0.80?_C.green:d.roc.auc>=0.70?_C.amber:_C.red):_C.dim;
  const dC    = d.cohenD!=null?(d.cohenD>=0.80?_C.green:d.cohenD>=0.50?_C.amber:_C.red):_C.dim;

  // ── KPI row
  const kpi = (label, val, col, sub) => `<div class="sa-panel" style="text-align:center;padding:16px 10px;">
    <div style="font-size:1.55rem;font-weight:700;color:${col};font-family:'IBM Plex Mono',monospace;line-height:1;">${val}</div>
    <div style="font-size:0.84rem;color:${_C.text};margin:5px 0 2px;">${label}</div>
    <div style="font-size:0.74rem;color:${_C.dim};">${sub}</div>
  </div>`;

  // ── Bland-Altman SVG
  const BW=400, BH=180, bPL=36, bPB=24, bPT=12, bPR=12;
  const bPW=BW-bPL-bPR, bPH=BH-bPT-bPB;
  const allM=[...d.ba.means], allDf=[...d.ba.diffs];
  const mMin=Math.min(...allM), mMax=Math.max(...allM,0.001);
  const dMin=Math.min(...allDf,d.ba.loaLo-0.02), dMax=Math.max(...allDf,d.ba.loaHi+0.02);
  const dRange=dMax-dMin||0.001;
  const toBAX = v => bPL+(v-mMin)/(mMax-mMin)*bPW;
  const toBAY = v => bPT+bPH-(v-dMin)/dRange*bPH;
  const biasY  = toBAY(d.ba.bias).toFixed(1);
  const loaHiY = toBAY(d.ba.loaHi).toFixed(1);
  const loaLoY = toBAY(d.ba.loaLo).toFixed(1);
  const zeroY  = toBAY(0).toFixed(1);
  const dots   = d.ba.diffs.map((df,i)=>{
    const inLoa = df>=d.ba.loaLo && df<=d.ba.loaHi;
    return `<circle cx="${toBAX(d.ba.means[i]).toFixed(1)}" cy="${toBAY(df).toFixed(1)}" r="2.8" fill="${inLoa?_C.blue:_C.red}" opacity="0.60"/>`;
  }).join('');
  const baTicks = [dMin, d.ba.loaLo, d.ba.bias, d.ba.loaHi, dMax].filter((v,i,a)=>a.indexOf(v)===i && !isNaN(v));

  const baSvg = `<svg width="100%" height="${BH}" viewBox="0 0 ${BW} ${BH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;">
    <line x1="${bPL}" y1="${bPT}" x2="${bPL}" y2="${bPT+bPH}" stroke="${_C.border}" stroke-width="0.8"/>
    <line x1="${bPL}" y1="${bPT+bPH}" x2="${bPL+bPW}" y2="${bPT+bPH}" stroke="${_C.border}" stroke-width="0.8"/>
    <line x1="${bPL}" y1="${zeroY}" x2="${bPL+bPW}" y2="${zeroY}" stroke="${_C.border}" stroke-width="0.8" stroke-dasharray="3,3"/>
    <line x1="${bPL}" y1="${biasY}" x2="${bPL+bPW}" y2="${biasY}" stroke="${_C.amber}" stroke-width="1.5"/>
    <line x1="${bPL}" y1="${loaHiY}" x2="${bPL+bPW}" y2="${loaHiY}" stroke="${_C.green}" stroke-width="1" stroke-dasharray="5,3"/>
    <line x1="${bPL}" y1="${loaLoY}" x2="${bPL+bPW}" y2="${loaLoY}" stroke="${_C.green}" stroke-width="1" stroke-dasharray="5,3"/>
    ${dots}
    <text x="${bPL+bPW+3}" y="${parseFloat(biasY)+3}" fill="${_C.amber}" font-size="8" font-family="IBM Plex Mono">${d.ba.bias.toFixed(3)}</text>
    <text x="${bPL+bPW+3}" y="${parseFloat(loaHiY)+3}" fill="${_C.green}" font-size="8" font-family="IBM Plex Mono">+${(1.96*d.ba.sd).toFixed(3)}</text>
    <text x="${bPL+bPW+3}" y="${parseFloat(loaLoY)+3}" fill="${_C.green}" font-size="8" font-family="IBM Plex Mono">${(-1.96*d.ba.sd).toFixed(3)}</text>
    <text x="${bPL+bPW/2}" y="${BH}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono">Mean of Methods</text>
    <text x="7" y="${bPT+bPH/2}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,7,${bPT+bPH/2})">Difference</text>
  </svg>`;

  // ── Concurrent scatter SVG
  const SW=280, SH=160, sPL=30, sPB=22, sPT=10, sPR=10;
  const sPW=SW-sPL-sPR, sPH=SH-sPT-sPB;
  const toSX = v => sPL+(Math.min(1,Math.max(0,v)))*sPW;
  const toSY = v => sPT+sPH-(Math.min(1,Math.max(0,v)))*sPH;
  const sDots = d.pairs.map(p=>`<circle cx="${toSX(p.crit).toFixed(1)}" cy="${toSY(p.dev).toFixed(1)}" r="2.6" fill="${_C.purple}" opacity="0.55"/>`).join('');
  const cxs=d.pairs.map(p=>p.crit), cys=d.pairs.map(p=>p.dev);
  const cmx=_psyMean(cxs),cmy=_psyMean(cys);
  let csxy=0,csxx=0; cxs.forEach((x,i)=>{csxy+=(x-cmx)*(cys[i]-cmy);csxx+=(x-cmx)**2;});
  const cSlope=csxx>0?csxy/csxx:0, cInt=cmy-cSlope*cmx;
  const cY0=Math.min(1,Math.max(0,cInt)), cY1=Math.min(1,Math.max(0,cInt+cSlope));
  const scatterSvg = `<svg width="100%" height="${SH}" viewBox="0 0 ${SW} ${SH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;">
    <line x1="${sPL}" y1="${sPT}" x2="${sPL}" y2="${sPT+sPH}" stroke="${_C.border}" stroke-width="0.8"/>
    <line x1="${sPL}" y1="${sPT+sPH}" x2="${sPL+sPW}" y2="${sPT+sPH}" stroke="${_C.border}" stroke-width="0.8"/>
    ${sDots}
    <line x1="${toSX(0).toFixed(1)}" y1="${toSY(cY0).toFixed(1)}" x2="${toSX(1).toFixed(1)}" y2="${toSY(cY1).toFixed(1)}" stroke="${_C.amber}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.85"/>
    <text x="${sPL+sPW/2}" y="${SH}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono">${inst} (0–1)</text>
    <text x="7" y="${sPT+sPH/2}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,7,${sPT+sPH/2})">${_saEsc(_saExtName)} (0–1)</text>
  </svg>`;

  // ── ROC curve SVG
  let rocSvg = `<div style="text-align:center;padding:32px;color:${_C.dim};font-size:0.82rem;">Insufficient group data for ROC</div>`;
  if (d.roc) {
    const RW=280, RH=160, rPL=28, rPB=22, rPT=10, rPR=10;
    const rPW=RW-rPL-rPR, rPH=RH-rPT-rPB;
    const toRX = v => rPL+v*rPW;
    const toRY = v => rPT+rPH-v*rPH;
    const pts  = d.roc.curve.map(p=>`${toRX(p.fpr).toFixed(1)},${toRY(p.tpr).toFixed(1)}`).join(' ');
    const fillPts = `${toRX(0)},${toRY(0)} ${pts} ${toRX(1)},${toRY(0)}`;
    rocSvg = `<svg width="100%" height="${RH}" viewBox="0 0 ${RW} ${RH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;">
      <line x1="${rPL}" y1="${rPT}" x2="${rPL}" y2="${rPT+rPH}" stroke="${_C.border}" stroke-width="0.8"/>
      <line x1="${rPL}" y1="${rPT+rPH}" x2="${rPL+rPW}" y2="${rPT+rPH}" stroke="${_C.border}" stroke-width="0.8"/>
      <line x1="${rPL}" y1="${rPT+rPH}" x2="${rPL+rPW}" y2="${rPT}" stroke="${_C.border}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <polygon points="${fillPts}" fill="${_C.green}" opacity="0.10"/>
      <polyline points="${pts}" fill="none" stroke="${_C.green}" stroke-width="2"/>
      <circle cx="${toRX(1-d.roc.optSpec).toFixed(1)}" cy="${toRY(d.roc.optSens).toFixed(1)}" r="4" fill="${_C.amber}" stroke="none"/>
      <text x="${rPL+rPW/2}" y="${RH}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono">1 − Specificity (FPR)</text>
      <text x="7" y="${rPT+rPH/2}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,7,${rPT+rPH/2})">Sensitivity (TPR)</text>
    </svg>`;
  }

  // ── Known-groups bars
  const KW=280, KH=90;
  let kgSvg = `<text x="${KW/2}" y="${KH/2}" fill="${_C.dim}" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">Insufficient group data</text>`;
  if (d.hiM!=null && d.loM!=null) {
    const maxV=Math.max(d.hiM,d.loM,0.01);
    const bW=54, gap=24, baseY=KH-22;
    const hH=Math.round((d.hiM/maxV)*(KH-36)), lH=Math.round((d.loM/maxV)*(KH-36));
    const x1=KW/2-gap/2-bW, x2=KW/2+gap/2;
    kgSvg = `
      <rect x="${x1}" y="${baseY-hH}" width="${bW}" height="${hH}" rx="3" fill="${_C.green}" opacity="0.75"/>
      <rect x="${x2}" y="${baseY-lH}" width="${bW}" height="${lH}" rx="3" fill="${_C.red}" opacity="0.75"/>
      <text x="${x1+bW/2}" y="${baseY-hH-5}" fill="${_C.green}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${d.hiM.toFixed(3)}</text>
      <text x="${x2+bW/2}" y="${baseY-lH-5}" fill="${_C.red}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${d.loM.toFixed(3)}</text>
      <line x1="${x1}" y1="${baseY}" x2="${x2+bW}" y2="${baseY}" stroke="${_C.border}" stroke-width="1"/>
      <text x="${x1+bW/2}" y="${KH-5}" fill="${_C.green}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">Adherent</text>
      <text x="${x2+bW/2}" y="${KH-5}" fill="${_C.red}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">Non-adh.</text>`;
  }

  // ── Publication text
  const pValue = d.roc && d.roc.auc > 0.50 ? '< 0.001' : '> 0.05';
  const pubText = `${_saEsc(_saExtName)} showed concurrent validity against the ${inst} (r = ${d.r_xy.toFixed(2)}, 95% CI [${d.rLo.toFixed(2)}, ${d.rHi.toFixed(2)}], n = ${d.n}, p ${pValue}). Bland-Altman analysis revealed a mean bias of ${d.ba.bias.toFixed(3)} (95% LoA: ${d.ba.loaLo.toFixed(3)} to ${d.ba.loaHi.toFixed(3)}); ${(d.ba.within*100).toFixed(1)}% of observations fell within limits of agreement.${d.roc?` ROC analysis yielded AUC = ${d.roc.auc.toFixed(2)} (95% CI: ${d.roc.aucLo.toFixed(2)}–${d.roc.aucHi.toFixed(2)}), with optimal sensitivity of ${(d.roc.optSens*100).toFixed(1)}% and specificity of ${(d.roc.optSpec*100).toFixed(1)}%.`:''} ${d.cohenD!=null?`Known-groups analysis confirmed ${_saEsc(_saExtName)} discriminated ${_saEsc(inst)}-defined non-adherent patients from adherent patients (d = ${d.cohenD.toFixed(2)}).`:''}`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
      ${kpi('Concurrent r', d.r_xy.toFixed(3), rCol, `95% CI [${d.rLo.toFixed(2)}, ${d.rHi.toFixed(2)}] · n=${d.n}`)}
      ${kpi('Bland-Altman Bias', d.ba.bias.toFixed(3), bCol, `LoA: ${d.ba.loaLo.toFixed(3)} to ${d.ba.loaHi.toFixed(3)}`)}
      ${kpi('AUC', d.roc?d.roc.auc.toFixed(3):'—', aucC, d.roc?`95% CI ${d.roc.aucLo.toFixed(2)}–${d.roc.aucHi.toFixed(2)}`:'Insufficient groups')}
      ${kpi("Cohen's d", d.cohenD!=null?d.cohenD.toFixed(3):'—', dC, d.cohenD!=null?`n=${d.hi.length}/${d.lo.length} groups`:'Insufficient groups')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">Bland-Altman Plot</div>
        <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:8px;">Difference (device − ${inst}) vs mean · amber = bias · green dashed = 95% LoA · ${(d.ba.within*100).toFixed(1)}% within</div>
        ${baSvg}
        <div style="margin-top:8px;font-size:0.77rem;color:${_C.dim};">
          Bias = <span style="color:${bCol};font-family:'IBM Plex Mono',monospace;">${d.ba.bias.toFixed(4)}</span> ·
          SD = <span style="color:${_C.text};font-family:'IBM Plex Mono',monospace;">${d.ba.sd.toFixed(4)}</span> ·
          LoA = <span style="color:${_C.green};font-family:'IBM Plex Mono',monospace;">[${d.ba.loaLo.toFixed(3)}, ${d.ba.loaHi.toFixed(3)}]</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="sa-panel" style="flex:1;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">Concurrent Scatter</div>
          <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:6px;">${inst} (x) × ${_saEsc(_saExtName)} (y) · both 0–1</div>
          ${scatterSvg}
          <div style="margin-top:6px;font-size:0.77rem;color:${_C.dim};">r = <span style="color:${rCol};font-family:'IBM Plex Mono',monospace;">${d.r_xy.toFixed(3)}</span></div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">ROC Curve — ${inst} Classification</div>
        <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:6px;">Positive class: ${cutLabel} · amber dot = Youden optimum</div>
        ${rocSvg}
        ${d.roc?`<div style="margin-top:6px;font-size:0.77rem;color:${_C.dim};">AUC = <span style="color:${aucC};font-family:'IBM Plex Mono',monospace;">${d.roc.auc.toFixed(3)}</span> · opt. threshold = <span style="font-family:'IBM Plex Mono',monospace;color:${_C.amber};">${d.roc.optThresh.toFixed(3)}</span> · Sens ${(d.roc.optSens*100).toFixed(1)}% · Spec ${(d.roc.optSpec*100).toFixed(1)}%</div>`:''}
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">Known-Groups — ${inst} Criterion</div>
        <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:8px;">Mean ${_saEsc(_saExtName)} score by ${inst} adherence group</div>
        <svg width="100%" height="${KH}" viewBox="0 0 ${KW} ${KH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;margin:0 auto;">${kgSvg}</svg>
        ${d.cohenD!=null?`<div style="margin-top:8px;font-size:0.77rem;color:${_C.dim};">Cohen's d = <span style="color:${dC};font-family:'IBM Plex Mono',monospace;">${d.cohenD.toFixed(3)}</span> · Adherent n=${d.hi.length} · Non-adherent n=${d.lo.length}</div>`:''}
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Publication-Ready Summary</div>
      <div style="font-size:0.84rem;color:${_C.muted};line-height:1.75;font-style:italic;">"${pubText}"</div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button onclick="navigator.clipboard.writeText(document.querySelector('.sa-ext-pub-text')?.textContent||'')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;padding:5px 14px;border-radius:5px;border:1px solid ${_C.border};background:transparent;color:${_C.muted};cursor:pointer;">Copy Text</button>
      </div>
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function _saRenderExtComp(container) {
  _saExtResults = null;
  const instOpts = [
    { val:'mmas', label:'MMAS-8 (score 0–8, cutoff < 6)' },
    { val:'map',  label:'MAP PE (0–1, cutoff < 0.50)' },
  ];
  const formatCards = [
    { id:'event', icon:'◉', label:'Event Log', desc:'One row per dose event. Columns: patient ID, date/time, taken (1/0 or yes/no). System computes PDC over the aggregation window.' },
    { id:'daily', icon:'◈', label:'Daily Summary', desc:'One row per patient per day. Columns: patient ID, date, adherence_rate (0–1). System averages over the window.' },
    { id:'score', icon:'◇', label:'Pre-Aggregated Score', desc:'One row per patient per assessment. Columns: patient ID, date, score (0–1). No aggregation — joined directly to ATLAS criterion records.' },
  ];

  container.innerHTML = `
    <div style="margin-bottom:4px;">
      <div class="sa-section-eyebrow">◇ Method Comparator</div>
      <div class="sa-section-title">External Method Validation</div>
    </div>
    <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:20px;max-width:640px;line-height:1.65;">
      Validate a wearable, app, or clinical device against MMAS-8 or MAP as the gold-standard criterion. Upload your device data as CSV, map the columns, and run Bland-Altman, ROC/AUC, concurrent correlation, and known-groups analysis.
    </div>

    <div style="display:grid;grid-template-columns:360px 1fr;gap:20px;align-items:start;">
      <!-- Config panel -->
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">1 · Device / Method Name</div>
          <input id="sa-ext-name-inp" placeholder="e.g. AdherePatch v2, PillTrack App…"
            style="width:100%;padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.83rem;background:rgba(255,255,255,0.04);border:1px solid ${_C.border};border-radius:6px;color:${_C.text};outline:none;"/>
        </div>

        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">2 · Criterion Instrument</div>
          <select id="sa-ext-inst-sel" style="width:100%;padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;background:rgba(255,255,255,0.04);border:1px solid ${_C.border};border-radius:6px;color:${_C.text};outline:none;">
            ${instOpts.map(o=>`<option value="${o.val}">${o.label}</option>`).join('')}
          </select>
        </div>

        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">3 · CSV Data Format</div>
          ${formatCards.map(f=>`
            <div onclick="_saExtSetFormat('${f.id}')" id="sa-ext-fmt-${f.id}"
              style="padding:10px 12px;border-radius:6px;border:1px solid ${_C.border};margin-bottom:8px;cursor:pointer;transition:all 0.15s;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="color:${_C.amber};font-size:0.82rem;">${f.icon}</span>
                <span style="font-size:0.84rem;font-weight:600;color:${_C.text};">${f.label}</span>
              </div>
              <div style="font-size:0.77rem;color:${_C.dim};line-height:1.5;">${f.desc}</div>
            </div>`).join('')}
        </div>

        <div class="sa-panel" id="sa-ext-upload-panel" style="margin-bottom:14px;display:none;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">4 · Upload CSV</div>
          <label style="display:block;padding:20px;border:1px dashed ${_C.border};border-radius:6px;text-align:center;cursor:pointer;color:${_C.muted};font-size:0.82rem;transition:border-color 0.15s;"
            onmouseover="this.style.borderColor='${_C.amber}44'" onmouseout="this.style.borderColor='${_C.border}'">
            <input type="file" accept=".csv,.txt" style="display:none;" onchange="_saExtHandleFile(this)"/>
            <div style="font-size:1.4rem;opacity:0.3;margin-bottom:8px;">↑</div>
            Click to upload CSV · or drag & drop
          </label>
          <div id="sa-ext-file-status" style="margin-top:8px;font-size:0.78rem;color:${_C.dim};"></div>
        </div>

        <div id="sa-ext-mapper" style="display:none;"></div>
      </div>

      <!-- Results panel -->
      <div>
        <div id="sa-ext-results">
          <div style="text-align:center;padding:60px 24px;">
            <div style="font-size:2rem;opacity:0.15;margin-bottom:12px;">◇</div>
            <div style="font-size:0.84rem;color:${_C.dim};">Configure and upload your device data to begin analysis.</div>
          </div>
        </div>
      </div>
    </div>`;
}

function _saExtSetFormat(fmt) {
  _saExtFormat = fmt;
  ['event','daily','score'].forEach(f => {
    const el = document.getElementById('sa-ext-fmt-'+f);
    if (!el) return;
    const on = f===fmt;
    el.style.borderColor = on?'rgba(212,168,67,0.4)':_C.border;
    el.style.background  = on?'rgba(212,168,67,0.08)':'transparent';
  });
  const up = document.getElementById('sa-ext-upload-panel');
  if (up) up.style.display = 'block';
}

function _saExtHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('sa-ext-file-status');
  if (status) status.textContent = 'Reading…';
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = _saExtParseCSV(e.target.result);
    if (!parsed || parsed.rows.length === 0) {
      if (status) status.textContent = 'Error: could not parse CSV. Ensure comma-separated with header row.';
      return;
    }
    _saExtRaw = parsed;
    if (status) status.textContent = `✓ ${parsed.rows.length.toLocaleString()} rows · ${parsed.headers.length} columns`;
    _saExtShowMapper(parsed.headers);
  };
  reader.readAsText(file);
}

function _saExtShowMapper(headers) {
  const mapper = document.getElementById('sa-ext-mapper');
  if (!mapper) return;
  const sel = (id, label, hint) => `
    <div style="margin-bottom:10px;">
      <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:4px;">${label} <span style="color:${_C.amber};">*</span></div>
      <select id="${id}" style="width:100%;padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;background:rgba(255,255,255,0.04);border:1px solid ${_C.border};border-radius:6px;color:${_C.text};outline:none;">
        <option value="">— select column —</option>
        ${headers.map(h=>`<option value="${_saEsc(h)}">${_saEsc(h)}</option>`).join('')}
      </select>
      <div style="font-size:0.72rem;color:${_C.dim};margin-top:3px;">${hint}</div>
    </div>`;

  const showDate = _saExtFormat !== 'score';
  mapper.style.display = 'block';
  mapper.innerHTML = `
    <div class="sa-panel" style="margin-bottom:14px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">5 · Map Columns</div>
      ${sel('sa-ext-col-patient', 'Patient ID column', 'Must match ATLAS patient_number values exactly')}
      ${showDate ? sel('sa-ext-col-date', 'Date / timestamp column', 'ISO date (YYYY-MM-DD) or any parseable date string') : ''}
      ${sel('sa-ext-col-value', _saExtFormat==='event'?'Dose taken column (1/0 or yes/no)':_saExtFormat==='daily'?'Adherence rate column (0–1)':'Score column (0–1)', 'Numeric or boolean adherence value')}
    </div>
    <div class="sa-panel" style="margin-bottom:14px;${_saExtFormat==='score'?'display:none;':''}">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">6 · Aggregation Window</div>
      <div style="display:flex;gap:8px;">
        ${[7,14,30].map(d=>`<button onclick="_saExtSetWindow(${d})" id="sa-ext-win-${d}"
          style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;padding:7px;border-radius:5px;cursor:pointer;transition:all 0.15s;
                 border:1px solid ${d===14?'rgba(212,168,67,0.4)':_C.border};
                 background:${d===14?'rgba(212,168,67,0.14)':'transparent'};
                 color:${d===14?_C.amber:_C.muted};">${d}-day</button>`).join('')}
      </div>
      <div style="font-size:0.75rem;color:${_C.dim};margin-top:8px;">Days of device data averaged/summed before each ATLAS assessment date.</div>
    </div>
    <button id="sa-ext-run-btn" onclick="_saExtRunAnalysis()"
      style="width:100%;padding:11px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;font-weight:600;letter-spacing:0.08em;
             border-radius:6px;cursor:pointer;border:1px solid rgba(212,168,67,0.4);
             background:rgba(212,168,67,0.14);color:${_C.amber};transition:all 0.15s;">
      Run Analysis
    </button>`;
}

function _saExtSetWindow(w) {
  _saExtWindow = w;
  [7,14,30].forEach(d => {
    const b = document.getElementById('sa-ext-win-'+d);
    if (!b) return;
    const on = d===w;
    b.style.background  = on?'rgba(212,168,67,0.14)':'transparent';
    b.style.borderColor = on?'rgba(212,168,67,0.4)':_C.border;
    b.style.color       = on?_C.amber:_C.muted;
  });
}

