// ══════════════════════════════════════════════
// PEACS PLATFORM (researcher — stub connectors)
// These connect to the same PEACS logic from the
// original index.html. The full PEACS assessment,
// ══════════════════════════════════════════════
// KYBOS CUBE™ & ADHERENCE LOOM™ ENGINE
// ══════════════════════════════════════════════
/**
 * Linearly interpolates between two hex colour strings.
 * @param {string} a - Starting hex colour (e.g. '#ef4444')
 * @param {string} b - Ending hex colour
 * @param {number} t - Interpolation factor 0–1
 * @returns {string} Interpolated hex colour
 */
function lerpHex(a,b,t){const h=s=>parseInt(s.slice(1),16);const ar=h(a)>>16,ag=(h(a)>>8)&255,ab=h(a)&255,br=h(b)>>16,bg=(h(b)>>8)&255,bb=h(b)&255;return'#'+[Math.round(ar+(br-ar)*t),Math.round(ag+(bg-ag)*t),Math.round(ab+(bb-ab)*t)].map(v=>v.toString(16).padStart(2,'0')).join('');}
/**
 * Maps a PEACS PE score (0–1) to a colour on a red → amber → yellow → blue → green gradient.
 * @param {number} pe - PE composite score in the range 0–1
 * @returns {string} CSS hex colour string
 */
function peColor(pe){if(!pe)return'#ef4444';if(pe<=0.25)return lerpHex('#ef4444','#f59e0b',pe/0.25);if(pe<=0.5)return lerpHex('#f59e0b','#eab308',(pe-0.25)/0.25);if(pe<=0.75)return lerpHex('#eab308','#3b82f6',(pe-0.5)/0.25);return lerpHex('#3b82f6','#10b981',(pe-0.75)/0.25);}
/**
 * Groups PEACS assessment records by user_id and sorts each group by timestamp.
 * @param {Object[]} all - Array of PEACS assessment objects
 * @returns {Object.<string, Object[]>} Map of user_id → sorted assessment array
 */
function groupByUser(all){const m={};all.forEach(a=>{const uid=a.user_id||'anon';if(!m[uid])m[uid]=[];m[uid].push(a);});Object.values(m).forEach(arr=>arr.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)));return m;}

// Groups by patient_number when present so repeat assessments from the same patient
// connect as a trajectory even across different devices/sessions.
// Falls back to user_id for records without a patient_number.
/**
 * Groups PEACS records by patient_number (preferred) or user_id, sorting each group by timestamp.
 * Enables trajectory charts across devices/sessions for the same patient.
 * @param {Object[]} all - Array of PEACS assessment objects
 * @returns {Object.<string, {key:string, patient_number:string|null, user_id:string|null, pts:Object[]}>}
 */
function groupByPatient(all) {
  const m = {};
  all.forEach(a => {
    const pn = a.patient_number && String(a.patient_number).trim();
    const key = pn ? 'pat:' + pn : 'uid:' + (a.user_id || 'anon');
    if (!m[key]) m[key] = { key, patient_number: pn || null, user_id: a.user_id || null, pts: [] };
    m[key].pts.push(a);
  });
  Object.values(m).forEach(g => g.pts.sort((a, b) => (a.timestamp||0) - (b.timestamp||0)));
  return m;
}

let surfacesOn=false, kybosSelectedUid=null, loomSelectedIdx=null;
let _peacsCache = null;
/**
 * Loads PEACS assessments from Firebase with role-based workspace filtering, caching the
 * result in memory for the session. Subsequent calls resolve immediately from cache.
 * @param {function(Object[]): void} cb - Callback receiving the filtered assessments array
 * @returns {void}
 */
function loadPeacsCache(cb){
  if(_peacsCache){cb(_peacsCache);return;}
  database.ref('peacs_assessments').once('value',snap=>{
    const val=snap.val();
    const all=val?Object.values(val):[];
    const ws=(currentWorkspace||'').toUpperCase();
    let filtered;
    if(!ws||isSuperAdmin()){
      filtered=all;
    } else if(isInstitutionMode()){
      filtered=all.filter(r=>{
        const code=(r.institution_code||'').toUpperCase();
        const parent=(r.parent_institution||'').toUpperCase();
        return code===ws||parent===ws;
      });
    } else if(typeof isPIMode==='function'&&isPIMode()){
      if(typeof resolveAllowedWorkspaces==='function'){
        resolveAllowedWorkspaces().then(allowedWS=>{
          const piFiltered=all.filter(r=>{
            const code=(r.institution_code||'').toUpperCase();
            return code===ws||(allowedWS&&allowedWS.has(code));
          });
          _peacsCache=piFiltered;
          if(typeof cb==='function')cb(_peacsCache);
        });
        return;
      } else {
        filtered=all.filter(r=>(r.institution_code||'').toUpperCase()===ws);
      }
    } else {
      filtered=all.filter(r=>(r.institution_code||'').toUpperCase()===ws);
    }
    _peacsCache=filtered;
    cb(_peacsCache);
  });
}
/** Clears the in-memory PEACS cache so the next call to loadPeacsCache re-fetches from Firebase. @returns {void} */
function invalidatePeacsCache(){_peacsCache=null;}

// ══════════════════════════════════════════════
// PHENOTYPE DEMO ENGINE
// Preset trajectories for explorer showcase — loads synthetic multi-patient
// data into _peacsCache so KYBOS and Loom render without Firebase.
// ══════════════════════════════════════════════

let _activePhenotypeDemo = null;
let _peacsCacheBeforeDemo = null;

const _PEACS_PHENOTYPE_DEMOS = (function(){
  const W = 14 * 24 * 3600 * 1000; // 2-week interval
  const T = Date.now();
  function pt(pn, uid, i, b, m, s) {
    const pe = Math.pow(Math.max(0, b * m * s), 1/3);
    return { patient_number: pn, user_id: uid, timestamp: T - (4-i)*W, base: b, mvmt: m, strata: s, pe: +pe.toFixed(4), city: null, country: null };
  }
  return {
    'Intentional Resistor': {
      emoji: '⚡', color: '#ef4444',
      description: 'Deliberate non-adherence — all three dimensions remain consistently low across every assessment cycle. Resistance is stable, not situational.',
      patients: [
        [pt('IR-001','ir1',0, 0.14,0.09,0.18), pt('IR-001','ir1',1, 0.12,0.07,0.16), pt('IR-001','ir1',2, 0.10,0.11,0.14), pt('IR-001','ir1',3, 0.11,0.08,0.15)],
        [pt('IR-002','ir2',0, 0.18,0.12,0.22), pt('IR-002','ir2',1, 0.15,0.09,0.19), pt('IR-002','ir2',2, 0.13,0.08,0.17)],
        [pt('IR-003','ir3',0, 0.12,0.10,0.17), pt('IR-003','ir3',1, 0.10,0.13,0.15), pt('IR-003','ir3',2, 0.09,0.08,0.13), pt('IR-003','ir3',3, 0.08,0.07,0.12)],
      ]
    },
    'Routine Forgetter': {
      emoji: '🕐', color: '#f59e0b',
      description: 'Strong habit architecture (BASE) but chronically low MVMT — behaviorally structured patients who consistently forget the prior 7-day window.',
      patients: [
        [pt('RF-001','rf1',0, 0.72,0.18,0.62), pt('RF-001','rf1',1, 0.68,0.14,0.60), pt('RF-001','rf1',2, 0.74,0.22,0.65), pt('RF-001','rf1',3, 0.70,0.17,0.63)],
        [pt('RF-002','rf2',0, 0.65,0.20,0.58), pt('RF-002','rf2',1, 0.70,0.16,0.60), pt('RF-002','rf2',2, 0.67,0.19,0.62)],
        [pt('RF-003','rf3',0, 0.75,0.25,0.65), pt('RF-003','rf3',1, 0.71,0.17,0.63), pt('RF-003','rf3',2, 0.73,0.21,0.64), pt('RF-003','rf3',3, 0.69,0.15,0.61)],
      ]
    },
    'Situational Skipper': {
      emoji: '✈️', color: '#8b6ff5',
      description: 'High BASE and STRATA — excellent when home. MVMT oscillates sharply: full adherence in stable periods, near-zero during travel or schedule disruption.',
      patients: [
        [pt('SS-001','ss1',0, 0.80,0.85,0.72), pt('SS-001','ss1',1, 0.78,0.18,0.70), pt('SS-001','ss1',2, 0.82,0.88,0.74), pt('SS-001','ss1',3, 0.79,0.15,0.71), pt('SS-001','ss1',4, 0.81,0.84,0.73)],
        [pt('SS-002','ss2',0, 0.77,0.80,0.68), pt('SS-002','ss2',1, 0.75,0.20,0.66), pt('SS-002','ss2',2, 0.78,0.82,0.70)],
        [pt('SS-003','ss3',0, 0.84,0.88,0.76), pt('SS-003','ss3',1, 0.82,0.12,0.74), pt('SS-003','ss3',2, 0.85,0.90,0.78), pt('SS-003','ss3',3, 0.83,0.14,0.75)],
      ]
    },
    'Side-Effect Avoider': {
      emoji: '💊', color: '#3b82f6',
      description: 'BASE erodes progressively — the patient initially tries but reduces the habit structure as side effects accumulate. MVMT and STRATA hold moderate while BASE collapses.',
      patients: [
        [pt('SE-001','se1',0, 0.28,0.48,0.55), pt('SE-001','se1',1, 0.22,0.40,0.50), pt('SE-001','se1',2, 0.18,0.38,0.48), pt('SE-001','se1',3, 0.14,0.35,0.46)],
        [pt('SE-002','se2',0, 0.30,0.50,0.58), pt('SE-002','se2',1, 0.24,0.44,0.52), pt('SE-002','se2',2, 0.19,0.38,0.48)],
        [pt('SE-003','se3',0, 0.25,0.45,0.52), pt('SE-003','se3',1, 0.20,0.42,0.50), pt('SE-003','se3',2, 0.16,0.36,0.47), pt('SE-003','se3',3, 0.13,0.32,0.44)],
      ]
    },
    'Optimistic Stopper': {
      emoji: '☀️', color: '#10b981',
      description: 'Classic tapering collapse — all three dimensions start at peak adherence and decline together as the patient feels better and self-discontinues treatment.',
      patients: [
        [pt('OS-001','os1',0, 0.90,0.92,0.85), pt('OS-001','os1',1, 0.78,0.76,0.75), pt('OS-001','os1',2, 0.55,0.50,0.60), pt('OS-001','os1',3, 0.30,0.25,0.38), pt('OS-001','os1',4, 0.12,0.10,0.20)],
        [pt('OS-002','os2',0, 0.88,0.90,0.82), pt('OS-002','os2',1, 0.72,0.68,0.70), pt('OS-002','os2',2, 0.48,0.42,0.55), pt('OS-002','os2',3, 0.24,0.20,0.32)],
        [pt('OS-003','os3',0, 0.85,0.88,0.80), pt('OS-003','os3',1, 0.65,0.60,0.68), pt('OS-003','os3',2, 0.38,0.32,0.45), pt('OS-003','os3',3, 0.16,0.14,0.22)],
      ]
    }
  };
})();

function renderPhenotypePicker() {
  const defs = _PEACS_PHENOTYPE_DEMOS;
  const active = _activePhenotypeDemo;
  const btns = Object.entries(defs).map(([name, d]) => {
    const isActive = name === active;
    const borderCol = isActive ? d.color : 'rgba(255,255,255,0.1)';
    const bgCol     = isActive ? `${d.color}1a` : 'rgba(255,255,255,0.03)';
    const textCol   = isActive ? d.color : '#6b8099';
    return `<button onclick="loadPhenotypeDemo('${name}')" data-pheno="${name}"
      style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:6px 13px;border:1px solid ${borderCol};border-radius:20px;background:${bgCol};color:${textCol};cursor:pointer;white-space:nowrap;transition:all 0.2s;"
      onmouseenter="if('${name}'!==(_activePhenotypeDemo||''))this.style.borderColor='${d.color}88',this.style.color='${d.color}'"
      onmouseleave="if('${name}'!==(_activePhenotypeDemo||''))this.style.borderColor='rgba(255,255,255,0.1)',this.style.color='#6b8099'"
      >${d.emoji} ${name}</button>`;
  }).join('');
  const clearBtn = active
    ? `<button onclick="clearPhenotypeDemo()" style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:6px 13px;border:1px solid rgba(255,255,255,0.12);border-radius:20px;background:none;color:rgba(255,255,255,0.3);cursor:pointer;white-space:nowrap;margin-left:4px;">← Real Data</button>`
    : '';
  const desc = active
    ? `<div style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;color:${defs[active].color}88;line-height:1.55;margin-top:8px;">${defs[active].description}</div>`
    : `<div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;color:#3d506a;line-height:1.5;margin-top:8px;">Select a phenotype to load a preset trajectory example, or use real workspace data.</div>`;
  const demoBanner = active
    ? `<div style="margin-top:8px;padding:6px 10px;border-radius:5px;background:rgba(239,100,80,0.1);border:1px solid rgba(239,100,80,0.3);font-family:'IBM Plex Mono\',monospace;font-size:0.74rem;color:rgba(239,100,80,0.9);letter-spacing:0.06em;">
        ⚠ DEMO MODE — synthetic data only. Real patient records are not displayed. Click "← Real Data" to restore.
      </div>`
    : '';
  return `<div id="phenotype-picker" style="padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(4,8,15,0.4);">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:#3d506a;white-space:nowrap;">⬡ Phenotype Examples</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${btns}${clearBtn}</div>
    </div>
    ${demoBanner}
    ${desc}
  </div>`;
}

function loadPhenotypeDemo(name) {
  const def = _PEACS_PHENOTYPE_DEMOS[name];
  if (!def) return;
  if (!_activePhenotypeDemo) _peacsCacheBeforeDemo = _peacsCache; // save real data on first activation
  _activePhenotypeDemo = name;
  _peacsCache = def.patients.flat();
  // Re-render whichever visualization tab is active
  const tab = (typeof currentPeacsTab !== 'undefined') ? currentPeacsTab : 'kybos';
  const content = document.getElementById('peacs-tab-content');
  if (tab === 'kybos' && content) {
    content.innerHTML = renderKybos();
    requestAnimationFrame(() => { drawKybos(null); populateKybosCards(); });
  } else if (tab === 'loom' && content) {
    content.innerHTML = renderLoom();
    requestAnimationFrame(drawLoom);
  }
}

function clearPhenotypeDemo() {
  _activePhenotypeDemo = null;
  _peacsCache = _peacsCacheBeforeDemo; // restore real data; null triggers re-fetch if no real data existed
  _peacsCacheBeforeDemo = null;
  const tab = (typeof currentPeacsTab !== 'undefined') ? currentPeacsTab : 'kybos';
  const content = document.getElementById('peacs-tab-content');
  if (tab === 'kybos' && content) {
    content.innerHTML = renderKybos();
    requestAnimationFrame(() => { drawKybos(null); populateKybosCards(); });
  } else if (tab === 'loom' && content) {
    content.innerHTML = renderLoom();
    requestAnimationFrame(drawLoom);
  }
}

// ── KYBOS ────────────────────────────────────
function drawKybos(selKey){
  const el=document.getElementById('kybos-chart');if(!el)return;
  el.innerHTML='<div style="padding:40px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--muted);">Loading…</div>';
  loadPeacsCache(allReal=>{
    const myUid=getUserId();const traces=[];
    const byPat=groupByPatient(allReal);const isFiltered=!!selKey;
    Object.entries(byPat).forEach(([key,grp])=>{
      const pts=grp.pts;
      const isMe=pts.some(p=>p.user_id===myUid);
      const faded=isFiltered&&key!==selKey;
      const op=faded?0.06:isMe?1:0.6;
      const color=isMe?'#d4a843':peColor(pts[pts.length-1].pe||0);
      const mode=pts.length>1?'lines+markers':'markers';
      const label=grp.patient_number?`Patient #${grp.patient_number}`:(isMe?'My Trajectory':'···'+(grp.user_id||'').slice(-4));
      traces.push({type:'scatter3d',x:pts.map(p=>p.base),y:pts.map(p=>p.mvmt),z:pts.map(p=>p.strata),mode,
        line:pts.length>1?{color,width:isMe?5:2,dash:isMe?'dash':'solid'}:undefined,
        marker:{size:pts.map((_,i)=>pts.length>1&&i===pts.length-1?isMe?14:8:isMe?10:5),color:pts.map((_,i)=>pts.length>1&&i===pts.length-1?'#fff':color),opacity:op,symbol:isMe?'diamond':'circle',line:{width:isMe?2:1,color:isMe?'white':'rgba(255,255,255,0.2)'}},
        name:label,
        text:pts.map((p,i)=>`Assessment ${i+1}${grp.patient_number?' · Pat #'+grp.patient_number:''}<br>PE: ${(p.pe||0).toFixed(4)}<br>BASE: ${(p.base||0).toFixed(3)}<br>MVMT: ${(p.mvmt||0).toFixed(3)}<br>STRATA: ${(p.strata||0).toFixed(3)}`),
        hovertemplate:'%{text}<extra></extra>',showlegend:true});
    });
    // ── STRATA Planes — transparent flat mesh surfaces ──────────────────────
    if(surfacesOn){
      const planeColors=['rgba(78,156,245,0.07)','rgba(139,111,245,0.07)','rgba(46,201,138,0.07)'];
      const planeLines=['rgba(78,156,245,0.22)','rgba(139,111,245,0.22)','rgba(46,201,138,0.22)'];
      const planeLabels=['STRATA 0.30 · Low Threshold','STRATA 0.60 · Moderate Threshold','STRATA 0.90 · High Threshold'];
      [0.3,0.6,0.9].forEach((sl,pi)=>{
        // Build a 2D grid for the surface mesh
        const N=11; // 11×11 grid = 0.0 to 1.0 in steps of 0.1
        const bVals=Array.from({length:N},(_,i)=>i/10);
        const mVals=Array.from({length:N},(_,i)=>i/10);
        // Plotly surface needs z as 2D array [rows][cols]
        const zGrid=mVals.map(()=>bVals.map(()=>sl));
        traces.push({
          type:'surface',
          x:bVals, y:mVals, z:zGrid,
          showscale:false,
          opacity:0.13,
          colorscale:[[0,planeColors[pi]],[1,planeColors[pi]]],
          contours:{
            x:{show:true,color:planeLines[pi],width:1,highlight:false},
            y:{show:true,color:planeLines[pi],width:1,highlight:false},
            z:{show:false}
          },
          hovertemplate:`${planeLabels[pi]}<extra></extra>`,
          showlegend:false,
          name:planeLabels[pi]
        });
      });
    }

    // ── Predictive Trajectory Forecast — project ahead for multi-assessment patients ──
    Object.entries(byPat).forEach(([key,grp])=>{
      const pts=grp.pts;
      if(pts.length<2) return;
      const faded=isFiltered&&key!==selKey;
      if(faded) return; // only draw forecast for visible/selected patients
      const isMe=pts.some(p=>p.user_id===myUid);
      const color=isMe?'#d4a843':peColor(pts[pts.length-1].pe||0);

      // Linear regression on [BASE, MVMT, STRATA] as fn of assessment index
      const n=pts.length;
      const xs=Array.from({length:n},(_,i)=>i);
      function linReg(vals){
        const xMean=xs.reduce((a,b)=>a+b,0)/n;
        const yMean=vals.reduce((a,b)=>a+b,0)/n;
        const num=xs.reduce((s,x,i)=>s+(x-xMean)*(vals[i]-yMean),0);
        const den=xs.reduce((s,x)=>s+(x-xMean)**2,0);
        const slope=den?num/den:0;
        return {slope, intercept:yMean-slope*xMean};
      }
      const bReg=linReg(pts.map(p=>p.base||0));
      const mReg=linReg(pts.map(p=>p.mvmt||0));
      const sReg=linReg(pts.map(p=>p.strata||0));

      // Project 2 steps forward
      const steps=2;
      const lastIdx=n-1;
      const forecastPts=Array.from({length:steps},(_,i)=>{
        const fi=lastIdx+i+1;
        const bF=Math.max(0,Math.min(1,bReg.slope*fi+bReg.intercept));
        const mF=Math.max(0,Math.min(1,mReg.slope*fi+mReg.intercept));
        const sF=Math.max(0,Math.min(1,sReg.slope*fi+sReg.intercept));
        const peF=Math.pow(Math.max(0,bF*mF*sF),1/3);
        return {b:bF,m:mF,s:sF,pe:peF};
      });

      // Draw connector from last real point to first forecast
      const last=pts[lastIdx];
      traces.push({
        type:'scatter3d',
        x:[last.base||0, forecastPts[0].b],
        y:[last.mvmt||0, forecastPts[0].m],
        z:[last.strata||0, forecastPts[0].s],
        mode:'lines',
        line:{color,width:isMe?3:1.5,dash:'dot'},
        hoverinfo:'skip',showlegend:false,opacity:0.55
      });

      // Forecast points
      traces.push({
        type:'scatter3d',
        x:forecastPts.map(p=>p.b),
        y:forecastPts.map(p=>p.m),
        z:forecastPts.map(p=>p.s),
        mode:'markers',
        marker:{
          size:forecastPts.map((_,i)=>i===0?(isMe?12:7):(isMe?9:5)),
          color:forecastPts.map(p=>peColor(p.pe)),
          opacity:0.7,
          symbol:'diamond-open',
          line:{width:isMe?2:1,color}
        },
        text:forecastPts.map((p,i)=>`Forecast +${i+1}<br>PE: ${p.pe.toFixed(4)}<br>BASE: ${p.b.toFixed(3)}<br>MVMT: ${p.m.toFixed(3)}<br>STRATA: ${p.s.toFixed(3)}`),
        hovertemplate:'%{text}<extra></extra>',
        name:`Forecast · ${grp.patient_number?'Pat #'+grp.patient_number:(isMe?'My Trajectory':'···'+(grp.user_id||'').slice(-4))}`,
        showlegend:false
      });
    });
    if(!traces.length){el.innerHTML='<div class="empty-state" style="padding:60px;text-align:center;color:var(--muted);">No PEACS data yet — submit an assessment to populate the Cube.</div>';return;}
    ensurePlotly().then(() => {
    Plotly.newPlot(el,traces,{height:620,paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',scene:{xaxis:{title:{text:'BASE',font:{color:'#4e9cf5',size:11}},color:'#2d4060',backgroundcolor:'rgba(6,13,26,0.0)',gridcolor:'rgba(78,156,245,0.08)',zerolinecolor:'rgba(78,156,245,0.15)',showspikes:false,range:[-0.02,1.02]},yaxis:{title:{text:'MVMT',font:{color:'#8b6ff5',size:11}},color:'#2d4060',backgroundcolor:'rgba(6,13,26,0.0)',gridcolor:'rgba(139,111,245,0.08)',zerolinecolor:'rgba(139,111,245,0.15)',showspikes:false,range:[-0.02,1.02]},zaxis:{title:{text:'STRATA',font:{color:'#2ec98a',size:11}},color:'#2d4060',backgroundcolor:'rgba(6,13,26,0.0)',gridcolor:'rgba(46,201,138,0.08)',zerolinecolor:'rgba(46,201,138,0.15)',showspikes:false,range:[-0.02,1.02]},camera:{eye:{x:1.6,y:1.6,z:1.4},up:{x:0,y:0,z:1}},aspectmode:'cube',bgcolor:'rgba(0,0,0,0)',dragmode:'orbit'},showlegend:false,font:{color:'#4a6080',family:'IBM Plex Mono, monospace',size:10},margin:{l:0,r:0,t:0,b:0}},{responsive:true,displayModeBar:false});
    }); // end ensurePlotly
  });
}

function kybosSelectUser(key){
  const panel=document.getElementById('kybos-forecast-panel');
  const fc=document.getElementById('kybos-forecast-content');
  if(kybosSelectedUid===key){
    kybosSelectedUid=null;
    document.querySelectorAll('.kybos-user-card').forEach(c=>{c.style.opacity='1';c.style.transform='none';});
    drawKybos(null);
    if(panel)panel.style.display='none';
    return;
  }
  kybosSelectedUid=key;
  document.querySelectorAll('.kybos-user-card').forEach(c=>{
    const isSelected=c.dataset.patkey===key;
    c.style.opacity=isSelected?'1':'0.3';
    c.style.transform=isSelected?'scale(1.01)':'none';
  });
  drawKybos(key);

  // Build forecast panel
  loadPeacsCache(allReal=>{
    const byPat=groupByPatient(allReal);
    const grp=byPat[key]; if(!grp||!fc||!panel)return;
    const pts=grp.pts;
    if(pts.length<2){
      panel.style.display='block';
      fc.innerHTML=`<div style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;color:#6b8099;">Need 2+ assessments to forecast. Only ${pts.length} recorded.</div>`;
      return;
    }
    const n=pts.length;
    const xs=Array.from({length:n},(_,i)=>i);
    function linReg(vals){const xM=xs.reduce((a,b)=>a+b,0)/n,yM=vals.reduce((a,b)=>a+b,0)/n,num=xs.reduce((s,x,i)=>s+(x-xM)*(vals[i]-yM),0),den=xs.reduce((s,x)=>s+(x-xM)**2,0);const sl=den?num/den:0;return{slope:sl,intercept:yM-sl*xM};}
    const bR=linReg(pts.map(p=>p.base||0)),mR=linReg(pts.map(p=>p.mvmt||0)),sR=linReg(pts.map(p=>p.strata||0));
    const forecast=[1,2].map(fi=>{
      const i=n-1+fi;
      const b=Math.max(0,Math.min(1,bR.slope*i+bR.intercept));
      const m=Math.max(0,Math.min(1,mR.slope*i+mR.intercept));
      const s=Math.max(0,Math.min(1,sR.slope*i+sR.intercept));
      const pe=Math.pow(Math.max(0,b*m*s),1/3);
      return{b,m,s,pe};
    });
    const lastPe=pts[n-1].pe||0;
    const f1pe=forecast[0].pe;
    const f2pe=forecast[1].pe;
    const trend=f1pe>lastPe+0.02?'↑ Improving':f1pe<lastPe-0.02?'↓ Declining':'→ Stable';
    const trendCol=f1pe>lastPe+0.02?'#10b981':f1pe<lastPe-0.02?'#ef4444':'#f59e0b';
    const peZone=pe=>pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
    const label=grp.patient_number?`Patient #${grp.patient_number}`:'This Patient';
    panel.style.display='block';
    fc.innerHTML=`
      <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#cdd8e8;margin-bottom:8px;">${label}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;color:#6b8099;">Current PE</span>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;color:#d4a843;font-weight:600;">${lastPe.toFixed(3)}</span>
        <span style="font-size:0.86rem;color:${trendCol};margin-left:4px;">${trend}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px;">
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;color:#3d506a;margin-bottom:4px;">Next assessment</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;font-weight:600;color:${peColor(f1pe)};">${f1pe.toFixed(3)}</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#6b8099;margin-top:2px;">${peZone(f1pe)}</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#3d506a;margin-top:4px;">B ${forecast[0].b.toFixed(2)} · M ${forecast[0].m.toFixed(2)} · S ${forecast[0].s.toFixed(2)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px;">
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;color:#3d506a;margin-bottom:4px;">+2 assessments</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;font-weight:600;color:${peColor(f2pe)};">${f2pe.toFixed(3)}</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#6b8099;margin-top:2px;">${peZone(f2pe)}</div>
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#3d506a;margin-top:4px;">B ${forecast[1].b.toFixed(2)} · M ${forecast[1].m.toFixed(2)} · S ${forecast[1].s.toFixed(2)}</div>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;color:#2d3f52;margin-top:8px;">Linear extrapolation based on ${n} assessments. Dotted line visible in cube.</div>`;
  });
}

function renderKybos(){
  return`<div style="background:#060d1a;border-radius:18px;overflow:hidden;box-shadow:0 0 60px rgba(0,0,0,0.6);">

    <!-- Header bar -->
    <div style="display:flex;align-items:center;gap:14px;padding:18px 24px 14px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;letter-spacing:0.22em;text-transform:uppercase;color:#d4a843;margin-bottom:3px;">Theory of Predictive Emergence</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.45rem;font-weight:300;color:#e8f0f8;letter-spacing:-0.01em;">KYBOS Cube™</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span id="kybos-badge" style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:#4a6080;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:3px 12px;">Loading…</span>
        <button id="kybos-planes-btn" onclick="surfacesOn=!surfacesOn;this.style.background=surfacesOn?'rgba(212,168,67,0.15)':'rgba(255,255,255,0.04)';this.style.borderColor=surfacesOn?'rgba(212,168,67,0.4)':'rgba(255,255,255,0.1)';this.style.color=surfacesOn?'#d4a843':'#6b8099';document.getElementById('kybos-chart').innerHTML='';drawKybos(kybosSelectedUid);" style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;transition:all 0.2s;">Threshold Planes</button>
        <button onclick="const el=document.getElementById('kybos-chart');if(el&&window.Plotly)Plotly.relayout(el,{'scene.camera.eye':{x:1.6,y:1.6,z:1.4}})" style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;">Reset View</button>
        <button onclick="kybosSelectedUid=null;document.querySelectorAll('.kybos-user-card').forEach(c=>c.classList.remove('kybos-selected','kybos-faded'));drawKybos(null);document.getElementById('kybos-forecast-panel').style.display='none';" style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;">Show All</button>
      </div>
    </div>

    <!-- Legend strip -->
    <div style="display:flex;align-items:center;gap:24px;padding:10px 24px;border-bottom:1px solid rgba(255,255,255,0.04);flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:7px;">
        <svg width="32" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#4e9cf5" stroke-width="2.5"/><circle cx="28" cy="5" r="3.5" fill="#fff" stroke="#4e9cf5" stroke-width="1.5"/></svg>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Actual trajectory</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <svg width="36" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#d4a843" stroke-width="1.5" stroke-dasharray="3,2"/><polygon points="30,2 36,5 30,8" fill="none" stroke="#d4a843" stroke-width="1.5"/></svg>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Forecast projection</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:14px;height:14px;border-radius:2px;background:rgba(212,168,67,0.25);border:1px solid rgba(212,168,67,0.5);"></div>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Your assessments</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:24px;height:8px;background:rgba(46,201,138,0.12);border:1px solid rgba(46,201,138,0.3);border-radius:2px;"></div>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">STRATA threshold plane</span>
      </div>
      <div style="margin-left:auto;font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;color:#3d506a;">PE = (BASE × MVMT × STRATA)<sup>1/3</sup> · Click a patient to isolate &amp; forecast</div>
    </div>

    ${renderPhenotypePicker()}

    <!-- Main split: cube (wide) + patient list (narrow) -->
    <div style="display:grid;grid-template-columns:1fr 280px;min-height:620px;">

      <!-- Cube -->
      <div style="padding:0;position:relative;">
        <div id="kybos-chart" style="min-height:620px;width:100%;"></div>
        <!-- Axis legend overlay -->
        <div style="position:absolute;bottom:16px;left:20px;display:flex;gap:16px;">
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#4e9cf5;"></div><span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#4e9cf5;">BASE · Biological</span></div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#8b6ff5;"></div><span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#8b6ff5;">MVMT · Behavioral</span></div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#2ec98a;"></div><span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#2ec98a;">STRATA · Contextual</span></div>
        </div>
      </div>

      <!-- Patient list + forecast panel -->
      <div style="border-left:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;overflow:hidden;">

        <!-- Forecast panel (hidden until patient selected) -->
        <div id="kybos-forecast-panel" style="display:none;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(212,168,67,0.04);">
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;letter-spacing:0.16em;text-transform:uppercase;color:#d4a843;margin-bottom:10px;">Predictive Forecast</div>
          <div id="kybos-forecast-content"></div>
        </div>

        <!-- Patient cards -->
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:#3d506a;padding:14px 18px 8px;">Participants</div>
        <div id="kybos-cards-col" style="overflow-y:auto;flex:1;padding:0 10px 12px;">
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.61rem;color:#3d506a;padding:20px;text-align:center;">Loading…</div>
        </div>
      </div>
    </div>

  </div>`;
}

function populateKybosCards(){
  loadPeacsCache(allReal=>{
    const myUid=getUserId();
    const byPat=groupByPatient(allReal);
    const patList=Object.entries(byPat).sort(([,a],[,b])=>{
      const aMe=a.pts.some(p=>p.user_id===myUid);
      const bMe=b.pts.some(p=>p.user_id===myUid);
      return aMe?-1:bMe?1:0;
    });
    const badge=document.getElementById('kybos-badge');
    if(badge)badge.textContent=`${allReal.length} assessments · ${patList.length} participants`;
    const col2=document.getElementById('kybos-cards-col');
    if(!col2)return;

    const peZone=pe=>pe>=0.85?{label:'Optimal',c:'#10b981'}:pe>=0.70?{label:'Good',c:'#3b82f6'}:pe>=0.55?{label:'Moderate',c:'#f59e0b'}:pe>=0.40?{label:'Poor',c:'#ef4444'}:{label:'Critical',c:'#991b1b'};

    const userCardsHtml=patList.map(([key,grp])=>{
      const pts=grp.pts;
      const isMe=pts.some(p=>p.user_id===myUid);
      const lastPt=pts[pts.length-1];
      const pe=lastPt.pe||0;
      const zone=peZone(pe);
      const col=isMe?'#d4a843':zone.c;
      const headLabel=grp.patient_number?`#${grp.patient_number}`:(isMe?'My Data':`···${(grp.user_id||'').slice(-4)}`);
      const isTrajectory=pts.length>1;

      // Mini spark of PE values
      const sparkMax=1, sparkW=80, sparkH=18;
      let spark='';
      if(isTrajectory){
        const peVals=pts.map(p=>p.pe||0);
        const pts2=peVals.map((v,i)=>`${Math.round(i/(peVals.length-1||1)*sparkW)},${Math.round(sparkH-(v/sparkMax)*sparkH)}`).join(' ');
        spark=`<svg width="${sparkW}" height="${sparkH}" style="overflow:visible;"><polyline points="${pts2}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/><circle cx="${Math.round(sparkW)}" cy="${Math.round(sparkH-(peVals[peVals.length-1]/sparkMax)*sparkH)}" r="2.5" fill="${col}"/></svg>`;
      }

      return`<div class="kybos-user-card" data-patkey="${key}" onclick="kybosSelectUser('${key}')"
        style="margin:4px 0;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${col}55;border-radius:8px;cursor:pointer;transition:all 0.2s;"
        onmouseenter="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(255,255,255,0.12)'"
        onmouseleave="this.style.background='rgba(255,255,255,0.02)';this.style.borderColor='rgba(255,255,255,0.06)'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;color:${col};font-weight:500;letter-spacing:0.05em;">${headLabel}</div>
          <div style="display:flex;align-items:center;gap:5px;">
            ${isTrajectory?spark:''}
            <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;color:${zone.c};background:${zone.c}18;border:1px solid ${zone.c}33;border-radius:10px;padding:1px 6px;">${zone.label}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#4e9cf5;">B ${(lastPt.base||0).toFixed(2)}</span>
          <span style="color:#3d506a;font-size:0.80rem;">·</span>
          <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#8b6ff5;">M ${(lastPt.mvmt||0).toFixed(2)}</span>
          <span style="color:#3d506a;font-size:0.80rem;">·</span>
          <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#2ec98a;">S ${(lastPt.strata||0).toFixed(2)}</span>
          <span style="margin-left:auto;font-family:'IBM Plex Mono\',monospace;font-size:0.88rem;color:${col};font-weight:600;">PE ${pe.toFixed(3)}</span>
        </div>
        ${isTrajectory?`<div style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;color:#3d506a;margin-top:5px;letter-spacing:0.06em;">${pts.map(p=>(p.pe||0).toFixed(2)).join(' → ')}</div>`:''}
      </div>`;
    }).join('');
    col2.innerHTML=userCardsHtml||'<div style="font-family:IBM Plex Mono,monospace;font-size:0.61rem;color:#3d506a;padding:20px;text-align:center;">No data yet.</div>';
  });
}

// ── LOOM ─────────────────────────────────────
function drawLoom(){
  const el=document.getElementById('loom-chart');if(!el)return;
  el.innerHTML='<div style="padding:40px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--muted);">Loading…</div>';
  loadPeacsCache(allReal=>{
    const pts=allReal.slice().sort((a,b)=>(a.pe||0)-(b.pe||0));
    if(!pts.length){el.innerHTML='<div class="empty-state" style="padding:60px;text-align:center;color:var(--muted);">No PEACS data yet — submit an assessment to populate the Loom.</div>';return;}
    window.loomPts=pts;
    const W=el.offsetWidth||900,H=480,t=80,b2=40,l=60,r2=60,aw=W-l-r2,ah=H-t-b2;
    const axes=['BASE','MVMT','STRATA','PE'];const xs=axes.map((_,i)=>l+i*(aw/(axes.length-1)));
    function makePath(v){return xs.map((x,i)=>`${i===0?'M':'L'}${x},${t+ah*(1-v[i])}`).join(' ');}
    let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px;overflow:visible;"><defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    pts.forEach((pt,idx)=>{const col=peColor(pt.pe||0);svg+=`<path class="loom-line" data-idx="${idx}" d="${makePath([pt.base||0,pt.mvmt||0,pt.strata||0,pt.pe||0])}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>`;});
    axes.forEach((ax,i)=>{svg+=`<line x1="${xs[i]}" y1="${t}" x2="${xs[i]}" y2="${t+ah}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;svg+=`<text x="${xs[i]}" y="${t-14}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#6b8099" letter-spacing="1">${ax}</text>`;[0,0.25,0.5,0.75,1].forEach(v=>{const y=t+ah*(1-v);svg+=`<line x1="${xs[i]-4}" y1="${y}" x2="${xs[i]+4}" y2="${y}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;svg+=`<text x="${xs[i]-8}" y="${y+4}" text-anchor="end" font-family="IBM Plex Mono" font-size="9" fill="#3d506a">${v.toFixed(2)}</text>`;});});
    svg+=`</svg>`;
    el.innerHTML=`<div>${svg}</div>`;
    el.querySelectorAll('.loom-line').forEach(path=>{path.addEventListener('click',()=>loomSelectByIdx(parseInt(path.dataset.idx),pts));});
    // populate cards sidebar
    const loomBadge=document.getElementById('loom-badge');if(loomBadge)loomBadge.textContent=`${pts.length} assessments`;
    const loomCards=document.getElementById('loom-cards-col');
    if(loomCards){
      const cardsHtml=pts.map((a,idx)=>{
        const col=peColor(a.pe||0);
        const patLabel=a.patient_number?`Patient #${a.patient_number}`:(a.user_id?`UID ···${String(a.user_id).slice(-6)}`:`Assessment #${idx+1}`);
        const locStr=[a.city,a.country].filter(Boolean).join(', ');
        return`<div class="loom-patient-card" data-idx="${idx}" onclick="loomSelectByIdx(${idx},window.loomPts)" style="border-left:3px solid ${col}55;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-family:var(--font-mono);font-size:0.88rem;color:${col};font-weight:500;">${_esc(patLabel)}</div>
            ${locStr?`<div style="font-family:var(--font-mono);font-size:0.90rem;color:rgba(255,255,255,0.3);">${_esc(locStr)}</div>`:''}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <span class="diag-chip" style="border-color:rgba(78,156,245,0.18);color:var(--base)">B ${(a.base||0).toFixed(3)}</span>
            <span class="diag-chip" style="border-color:rgba(139,111,245,0.18);color:var(--mvmt)">M ${(a.mvmt||0).toFixed(3)}</span>
            <span class="diag-chip" style="border-color:rgba(46,201,138,0.18);color:var(--strata)">S ${(a.strata||0).toFixed(3)}</span>
            <span class="diag-chip" style="border-color:${col}33;color:${col}">PE ${(a.pe||0).toFixed(4)}</span>
          </div>
        </div>`;
      }).join('');
      loomCards.innerHTML=`<div style="font-family:var(--font-mono);font-size:0.86rem;letter-spacing:0.1em;color:var(--dim);text-transform:uppercase;margin-bottom:12px;">Assessments — ${pts.length}</div>${cardsHtml}`;
    }
  });
}

function loomSelectByIdx(idx,pts){
  const lines=document.querySelectorAll('.loom-line');const cards=document.querySelectorAll('.loom-patient-card');
  if(loomSelectedIdx===idx){loomSelectedIdx=null;lines.forEach(l=>{l.style.opacity='';l.style.strokeWidth='';});cards.forEach(c=>c.classList.remove('loom-selected','loom-faded'));return;}
  loomSelectedIdx=idx;
  lines.forEach(l=>{const li=parseInt(l.dataset.idx);if(li===idx){l.style.opacity='1';l.style.strokeWidth='3px';}else{l.style.opacity='0.04';l.style.strokeWidth='1px';}});
  cards.forEach(c=>{const ci=parseInt(c.dataset.idx);if(ci===idx){c.classList.add('loom-selected');c.classList.remove('loom-faded');}else{c.classList.add('loom-faded');c.classList.remove('loom-selected');}});
}

function renderLoom(){
  return`<div>
    <h2 class="section-header">Adherence Loom™</h2>
    <p class="section-sub">Parallel coordinates weaving global PEACS trajectories across all four TPE dimensions — BASE, MVMT, STRATA, and the resultant PE. Click a thread or card to isolate a participant. Lines converging toward zero reveal geometric constraint.</p>
    <div class="vis-card">
      <div class="vis-toolbar">
        <span class="vis-label">Threads</span>
        <span class="vis-badge" id="loom-badge">Loading…</span>
      </div>
      ${renderPhenotypePicker()}
      <div class="loom-split">
        <div class="loom-chart-col" style="padding:20px 16px;"><div id="loom-chart" style="min-height:480px;"></div></div>
        <div class="loom-cards-col" id="loom-cards-col"><div style="font-family:var(--font-mono);font-size:0.86rem;letter-spacing:0.1em;color:var(--dim);text-transform:uppercase;margin-bottom:12px;">Loading…</div></div>
      </div>
    </div>
  </div>`;
}
// via the peacsState object below.
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// PEACS ENGINE
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// PEACS MULTILINGUAL QUESTION DATA
// ══════════════════════════════════════════════
let peacsCurrentLang = 'en';

const PEACS_QUESTIONS = {
  en: {
    name: 'English', native: 'English', dir: 'ltr',
    // Researcher intro notes
    base_intro: 'Now I am going to ask you a few questions about the habits and routines you generally follow when taking this medication. Think about what is typically true for you (over the past month). There are no right or wrong answers; please answer honestly.',
    mvmt_intro: 'The next questions are about your experience taking your medication over the past 7 days…',
    strata_intro: 'Next, we will ask you questions about your support, living situation, transportation, finances, and understanding of your treatment.',
    // BASE answer labels
    base_opts: ['Yes', 'Sometimes', 'No'],
    // MVMT answer labels
    mvmt_opts: ['No', 'Yes, once', 'Yes, more than once'],
    // BASE dimension title
    base_dim: 'BASE — Behavioral Architecture & Stability Evaluation',
    base_period: 'Past 30 Days · 7 Questions · Habit Structure',
    mvmt_dim: 'MVMT — Measurable Variance Minimal Term',
    mvmt_period: 'Past 7 Days · 7 Questions · Temporal Fidelity',
    strata_dim: 'STRATA — Social and Treatment Relational Access and Terrain',
    strata_period: 'Current Quarter · 8 Questions · Four-Tier Anchoring',
    // Question titles
    bq1_title:'Memory Architecture',    bq1:'Do you reliably remember to take your medication as scheduled, even on stressful days?',
    bq2_title:'Routine Stability',       bq2:'Do you maintain a consistent routine for taking your medication when your daily schedule changes?',
    bq3_title:'Symptom Resilience',      bq3:'If you begin to feel better, do you continue your medication exactly as prescribed?',
    bq4_title:'Adaptive Flexibility',    bq4:'Can you adapt your daily routine to make sure you take your medication when your schedule shifts?',
    bq5_title:'Side-Effect Tolerance',   bq5:'If you experience side effects, can you continue treatment while managing them?',
    bq6_title:'Behavioral Integration',  bq6:'Does taking medication fit naturally into your daily life?',
    bq7_title:'Preparedness Structure',  bq7:"Do you routinely keep a backup supply so you don't run out of medication?",
    mq1_title:'Timing Consistency',      mq1:'In the past 7 days, did you have trouble taking your medication at the same time each day?',
    mq2_title:'Dose Completion',         mq2:'In the past 7 days, did you miss any doses?',
    mq3_title:'Symptom-Based Skipping',  mq3:'In the past 7 days, did you skip or stop taking medication because you felt better?',
    mq4_title:'Side-Effect Response',    mq4:'In the past 7 days, did you stop or skip medication because of side effects?',
    mq5_title:'Environmental Disruption',mq5:'In the past 7 days, did travel, being away, or your environment cause you to miss medication?',
    mq6_title:'Schedule Adaptation',     mq6:'In the past 7 days, did you have difficulty adjusting your routine to take medication when your schedule changed?',
    mq7_title:'Daily Integration',       mq7:'In the past 7 days, did taking medication feel like a hassle or not fit naturally into daily life?',
    sq1_title:'Primary Support Person',  sq1:'Who helps you remember or manage your medications?',
    sq1_opts:['Spouse','Adult child or other family member','Friend, neighbor, or caregiver','I manage independently'],
    sq2_title:'Contact Frequency',       sq2:'How often do you have meaningful contact with family or friends?',
    sq2_opts:['Daily or several times per week','Once per week','A few times per month','Rarely or almost never'],
    sq3_title:'Living Situation',        sq3:'What is your current living arrangement?',
    sq3_opts:['Live with spouse or family members','Live alone with family or support nearby','Assisted or supported living arrangement','Live alone with family far away, or in temporary/transitional housing'],
    sq4_title:'Emergency Contact Network',sq4:'If you had a medical emergency, who would know and be able to help?',
    sq4_opts:['Multiple people who would respond quickly','At least one person who would respond','Someone who might eventually notice','Probably no one or definitely no one'],
    sq5_title:'Transportation Access',   sq5:'How do you usually get to medical appointments or the pharmacy?',
    sq5_opts:['I drive myself or have reliable, flexible transport','Family or friends provide transport, or public transport is available','Medical transport, taxi, or transport obtained with difficulty','Cannot reliably get to appointments or pharmacy'],
    sq6_title:'Treatment Continuity',    sq6:'How reliably can you get your medications and attend follow-up appointments when needed?',
    sq6_opts:['Medications and appointments are reliably available when needed','Usually available but with occasional delays or difficulties','Frequently delayed or difficult to access','Unreliable; significant gaps in access to medications or follow-up'],
    sq7_title:'Information & Literacy',  sq7:'How well do you understand the instructions for taking your medications?',
    sq7_opts:['Completely understand and can explain to others','Understand most instructions','Understand some but am uncertain about parts','Often confused or uncertain about how to take medication'],
    sq8_title:'Adherence Beliefs',       sq8:'How strongly do you believe your medication is necessary and will help you?',
    sq8_opts:['Strongly believe it is necessary and effective','Generally believe it helps','Uncertain whether it is helping','Often doubt its necessity or effectiveness'],
    // Patient pairing note
    pairing_title:'⚠ Patient Pairing Protocol',
    pairing_body:'Patients must complete the MMAS-8 assessment first to receive an assigned Patient ID. This ID pairs MMAS-8 adherence data with PEACS behavioral prediction scores for longitudinal cross-instrument analysis.',
    patient_id_label:'Patient ID',
    patient_id_hint:'(auto-filled from MMAS session · editable)',
    submit_btn:'Submit PEACS Assessment →',
  },
  el: {
    name: 'Greek', native: 'Ελληνικά', dir: 'ltr',
    base_intro: 'Τώρα θα σας κάνω μερικές ερωτήσεις σχετικά με τις συνήθειες και τις ρουτίνες που ακολουθείτε συνήθως όταν παίρνετε αυτό το φάρμακο. Σκεφθείτε τι ισχύει για εσάς συνήθως (κατά τον τελευταίο μήνα). Δεν υπάρχουν σωστές ή λάθος απαντήσεις· παρακαλώ απαντήστε ειλικρινά.',
    mvmt_intro: 'Οι επόμενες ερωτήσεις αφορούν την εμπειρία σας σχετικά με τη λήψη του φαρμάκου τις τελευταίες 7 ημέρες…',
    strata_intro: 'Στη συνέχεια, θα σας κάνουμε ερωτήσεις σχετικά με την υποστήριξή σας, τις συνθήκες διαβίωσης, τις μετακινήσεις, τα οικονομικά και την κατανόηση της αγωγής σας.',
    base_opts: ['Ναι', 'Μερικές φορές', 'Όχι'],
    mvmt_opts: ['Όχι', 'Ναι, μία φορά', 'Ναι, περισσότερες φορές'],
    base_dim: 'BASE — Αξιολόγηση Συμπεριφορικής Δομής και Σταθερότητας',
    base_period: 'Τελευταίος μήνας · 7 Ερωτήσεις · Δομή Συνηθειών',
    mvmt_dim: 'MVMT — Ελάχιστη Μετρήσιμη Διακύμανση',
    mvmt_period: 'Τελευταίες 7 ημέρες · 7 Ερωτήσεις · Χρονική Συνέπεια',
    strata_dim: 'STRATA — Κοινωνική και Θεραπευτική Πρόσβαση, Σχέσεις και Περιβάλλον',
    strata_period: 'Τρέχον τρίμηνο · 8 Ερωτήσεις · Τετρακλιμακωτή Αξιολόγηση',
    bq1_title:'Αρχιτεκτονική Μνήμης',   bq1:'Λαμβάνετε τη φαρμακευτική σας αγωγή σύμφωνα με το πρόγραμμα, ακόμη και σε ημέρες με αυξημένο στρες;',
    bq2_title:'Σταθερότητα Ρουτίνας',   bq2:'Διατηρείτε σταθερή ρουτίνα στη λήψη της φαρμακευτικής σας αγωγής, όταν αλλάζει το καθημερινό σας πρόγραμμα;',
    bq3_title:'Ανθεκτικότητα Συμπτωμάτων', bq3:'Όταν αρχίζετε να αισθάνεστε καλύτερα, συνεχίζετε τη φαρμακευτική σας αγωγή ακριβώς όπως έχει συνταγογραφηθεί;',
    bq4_title:'Προσαρμοστική Ευελιξία', bq4:'Όταν αλλάζει το πρόγραμμά σας, προσαρμόζετε την καθημερινή σας ρουτίνα ώστε να λαμβάνετε τη φαρμακευτική σας αγωγή;',
    bq5_title:'Ανοχή Παρενεργειών',     bq5:'Όταν εμφανίζετε ανεπιθύμητες ενέργειες, συνεχίζετε τη θεραπεία σας διαχειριζόμενοι τα συμπτώματα;',
    bq6_title:'Συμπεριφορική Ενσωμάτωση', bq6:'Η λήψη της φαρμακευτικής σας αγωγής εντάσσεται φυσικά στην καθημερινότητά σας;',
    bq7_title:'Δομή Προετοιμασίας',     bq7:'Διατηρείτε επαρκές απόθεμα της φαρμακευτικής σας αγωγής, ώστε να μην σας τελειώνει;',
    mq1_title:'Συνέπεια Χρονισμού',     mq1:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που δυσκολευτήκατε να λάβετε τη φαρμακευτική σας αγωγή την ίδια ώρα κάθε ημέρα;',
    mq2_title:'Ολοκλήρωση Δόσης',       mq2:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που παραλείψατε κάποια δόση της φαρμακευτικής σας αγωγής;',
    mq3_title:'Παράλειψη λόγω Συμπτωμάτων', mq3:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που σταματήσατε ή παραλείψατε να λάβετε τη φαρμακευτική σας αγωγή επειδή αισθανθήκατε καλύτερα;',
    mq4_title:'Αντίδραση σε Παρενέργειες', mq4:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που σταματήσατε ή παραλείψατε να λάβετε τη φαρμακευτική σας αγωγή λόγω ανεπιθύμητων ενεργειών;',
    mq5_title:'Περιβαλλοντική Διαταραχή', mq5:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που παραλείψατε να λάβετε τη φαρμακευτική σας αγωγή, λόγω ταξιδιού, απουσίας από το σπίτι ή αλλαγής περιβάλλοντος;',
    mq6_title:'Προσαρμογή Προγράμματος', mq6:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που δυσκολευτήκατε να προσαρμόσετε τη ρουτίνα σας, ώστε να λάβετε τη φαρμακευτική σας αγωγή όταν άλλαζε το πρόγραμμά σας;',
    mq7_title:'Καθημερινή Ενσωμάτωση',  mq7:'Τις τελευταίες 7 ημέρες, υπήρξαν φορές που η λήψη της φαρμακευτικής σας αγωγής σας φάνηκε δύσκολη ή δεν εντασσόταν φυσικά στην καθημερινότητά σας;',
    sq1_title:'Κύριο Υποστηρικτικό Πρόσωπο', sq1:'Ποιος σας βοηθά να θυμάστε ή να διαχειρίζεστε τη φαρμακευτική σας αγωγή;',
    sq1_opts:['Σύζυγος/Σύντροφος','Ενήλικο παιδί ή άλλο μέλος της οικογένειας','Φίλος/Φίλη, γείτονας ή φροντιστής','Διαχειρίζομαι τη φαρμακευτική μου αγωγή μόνος/μόνη μου'],
    sq2_title:'Συχνότητα Επαφής',        sq2:'Πόσο συχνά έχετε ουσιαστική επαφή με την οικογένεια ή φίλους;',
    sq2_opts:['Καθημερινά ή αρκετές φορές την εβδομάδα','Μία φορά την εβδομάδα','Μερικές φορές τον μήνα','Σπάνια ή σχεδόν ποτέ'],
    sq3_title:'Συνθήκες Διαβίωσης',      sq3:'Ποια είναι η τρέχουσα κατάσταση διαβίωσής σας;',
    sq3_opts:['Διαμένω με σύζυγο/σύντροφο ή/και μέλη της οικογένειας','Διαμένω μόνος/μόνη μου, αλλά έχω οικογένεια ή υποστήριξη κοντά','Διαμένω σε υποστηριζόμενη ή προστατευμένη δομή διαβίωσης','Διαμένω μόνος/μόνη μου, με την οικογένεια μακριά ή σε προσωρινή/μεταβατική στέγαση'],
    sq4_title:'Δίκτυο Έκτακτης Επικοινωνίας', sq4:'Εάν είχατε μια επείγουσα ιατρική κατάσταση, ποιος θα το γνώριζε και θα μπορούσε να σας βοηθήσει;',
    sq4_opts:['Πολλά άτομα, που θα ανταποκρίνονταν άμεσα','Τουλάχιστον ένα άτομο, που θα ανταποκρινόταν','Κάποιος που πιθανόν θα το αντιλαμβανόταν αργότερα','Πιθανότατα κανείς ή σίγουρα κανείς'],
    sq5_title:'Πρόσβαση σε Μεταφορικά',  sq5:'Πώς μετακινείστε συνήθως για ιατρικά ραντεβού ή για το φαρμακείο;',
    sq5_opts:['Οδηγώ ο ίδιος/η ίδια ή έχω αξιόπιστη και ευέλικτη μετακίνηση','Μεταφέρομαι από οικογένεια ή φίλους, ή υπάρχει πρόσβαση σε δημόσια συγκοινωνία','Χρησιμοποιώ ιατρική μεταφορά, ταξί ή μετακίνηση που εξασφαλίζεται με δυσκολία','Δεν μπορώ να μετακινηθώ αξιόπιστα για ραντεβού ή στο φαρμακείο'],
    sq6_title:'Συνέχεια Θεραπείας',      sq6:'Πόσο σταθερά μπορείτε να προμηθεύεστε τα φάρμακά σας και να προσέρχεστε στα επανεξεταστικά ραντεβού όταν χρειάζεται;',
    sq6_opts:['Τα φάρμακα και τα ραντεβού είναι σταθερά διαθέσιμα όταν χρειάζεται','Τα φάρμακα και τα ραντεβού είναι συνήθως διαθέσιμα, αλλά με περιστασιακές καθυστερήσεις ή δυσκολίες','Συχνά καθυστερούν ή είναι δύσκολα προσβάσιμα','Υπάρχουν σημαντικά προβλήματα πρόσβασης ή κενά στη λήψη φαρμάκων ή/και στην παρακολούθηση'],
    sq7_title:'Κατανόηση & Γραμματισμός', sq7:'Πόσο καλά κατανοείτε τις οδηγίες για τη λήψη της φαρμακευτικής σας αγωγής;',
    sq7_opts:['Τις κατανοώ πλήρως και μπορώ να τις εξηγήσω και σε άλλους','Κατανοώ τις περισσότερες οδηγίες','Κατανοώ κάποιες οδηγίες, αλλά έχω αβεβαιότητα σε ορισμένα σημεία','Συχνά νιώθω σύγχυση ή αβεβαιότητα σχετικά με το πώς να λαμβάνω τα φάρμακά μου'],
    sq8_title:'Πεποιθήσεις για την Αγωγή', sq8:'Σε ποιο βαθμό πιστεύετε ότι η φαρμακευτική σας αγωγή είναι απαραίτητη και θα σας βοηθήσει;',
    sq8_opts:['Πιστεύω απόλυτα ότι είναι απαραίτητη και αποτελεσματική','Πιστεύω γενικά ότι βοηθά','Δεν είμαι βέβαιος/βέβαιη αν βοηθά','Συχνά αμφιβάλλω για την αναγκαιότητα ή την αποτελεσματικότητά της'],
    pairing_title:'⚠ Πρωτόκολλο Αντιστοίχισης Ασθενή',
    pairing_body:'Οι ασθενείς πρέπει πρώτα να συμπληρώσουν την αξιολόγηση MMAS-8 για να λάβουν αναγνωριστικό ασθενή. Αυτό το αναγνωριστικό συνδέει τα δεδομένα συμμόρφωσης MMAS-8 με τις βαθμολογίες PEACS για διαχρονική διαστρωματική ανάλυση.',
    patient_id_label:'Κωδικός Ασθενή',
    patient_id_hint:'(αυτόματη συμπλήρωση από τη συνεδρία MMAS · επεξεργάσιμο)',
    submit_btn:'Υποβολή Αξιολόγησης PEACS →',
  },
  es: {
    name: 'Spanish', native: 'Español', dir: 'ltr',
    base_intro: 'Ahora le haré algunas preguntas sobre los hábitos y rutinas que sigue generalmente al tomar este medicamento. Piense en lo que es habitualmente cierto para usted (durante el último mes). No hay respuestas correctas ni incorrectas; por favor responda con sinceridad.',
    mvmt_intro: 'Las siguientes preguntas son sobre su experiencia tomando su medicamento durante los últimos 7 días…',
    strata_intro: 'A continuación, le haremos preguntas sobre su apoyo, situación de vida, transporte, finanzas y comprensión de su tratamiento.',
    base_opts: ['Sí', 'A veces', 'No'],
    mvmt_opts: ['No', 'Sí, una vez', 'Sí, más de una vez'],
    base_dim: 'BASE — Evaluación de Arquitectura y Estabilidad Conductual',
    base_period: 'Últimos 30 días · 7 preguntas · Estructura de hábitos',
    mvmt_dim: 'MVMT — Varianza Mínima Medible',
    mvmt_period: 'Últimos 7 días · 7 preguntas · Fidelidad temporal',
    strata_dim: 'STRATA — Acceso Social, Relacional y Contextual al Tratamiento',
    strata_period: 'Trimestre actual · 8 preguntas · Anclaje de cuatro niveles',
    bq1_title:'Arquitectura de Memoria',    bq1:'¿Recuerda con fiabilidad tomar su medicamento según lo programado, incluso en días de estrés?',
    bq2_title:'Estabilidad de Rutina',      bq2:'¿Mantiene una rutina consistente para tomar su medicamento cuando cambia su horario diario?',
    bq3_title:'Resiliencia ante Síntomas',  bq3:'Si empieza a sentirse mejor, ¿continúa tomando su medicamento exactamente como se lo recetaron?',
    bq4_title:'Flexibilidad Adaptativa',    bq4:'¿Puede adaptar su rutina diaria para asegurarse de tomar su medicamento cuando cambia su horario?',
    bq5_title:'Tolerancia a Efectos Secundarios', bq5:'Si experimenta efectos secundarios, ¿puede continuar el tratamiento mientras los maneja?',
    bq6_title:'Integración Conductual',     bq6:'¿Tomar el medicamento encaja naturalmente en su vida diaria?',
    bq7_title:'Estructura de Preparación',  bq7:'¿Mantiene habitualmente una reserva de medicamento para no quedarse sin él?',
    mq1_title:'Consistencia de Horario',    mq1:'En los últimos 7 días, ¿tuvo dificultades para tomar su medicamento a la misma hora cada día?',
    mq2_title:'Cumplimiento de Dosis',      mq2:'En los últimos 7 días, ¿omitió alguna dosis?',
    mq3_title:'Omisión por Síntomas',       mq3:'En los últimos 7 días, ¿dejó de tomar el medicamento porque se sentía mejor?',
    mq4_title:'Respuesta a Efectos Secundarios', mq4:'En los últimos 7 días, ¿suspendió o saltó el medicamento por efectos secundarios?',
    mq5_title:'Interferencia Ambiental',    mq5:'En los últimos 7 días, ¿un viaje, ausencia o cambio de entorno le hizo perder alguna dosis?',
    mq6_title:'Adaptación de Horario',      mq6:'En los últimos 7 días, ¿tuvo dificultades para ajustar su rutina y tomar el medicamento cuando cambió su horario?',
    mq7_title:'Integración Diaria',         mq7:'En los últimos 7 días, ¿tomar el medicamento le resultó una molestia o no encajó naturalmente en su vida cotidiana?',
    sq1_title:'Persona de Apoyo Principal', sq1:'¿Quién le ayuda a recordar o gestionar sus medicamentos?',
    sq1_opts:['Cónyuge o pareja','Hijo adulto u otro familiar','Amigo, vecino o cuidador','Me manejo de forma independiente'],
    sq2_title:'Frecuencia de Contacto',     sq2:'¿Con qué frecuencia tiene contacto significativo con familiares o amigos?',
    sq2_opts:['A diario o varias veces por semana','Una vez por semana','Algunas veces al mes','Rara vez o casi nunca'],
    sq3_title:'Situación de Vivienda',      sq3:'¿Cuál es su situación de vivienda actual?',
    sq3_opts:['Vivo con cónyuge o familiares','Vivo solo/a con familia o apoyo cercano','Vivienda asistida o tutelada','Vivo solo/a con familia lejos o en vivienda temporal'],
    sq4_title:'Red de Contacto de Emergencia', sq4:'En caso de emergencia médica, ¿quién lo sabría y podría ayudarle?',
    sq4_opts:['Varias personas que responderían rápidamente','Al menos una persona que respondería','Alguien que podría enterarse con el tiempo','Probablemente nadie o definitivamente nadie'],
    sq5_title:'Acceso a Transporte',        sq5:'¿Cómo suele ir a sus citas médicas o a la farmacia?',
    sq5_opts:['Conduzco o tengo transporte fiable y flexible','Familiar o amigo me lleva, o hay transporte público disponible','Transporte médico, taxi u obtenido con dificultad','No puedo llegar de forma fiable a citas o farmacia'],
    sq6_title:'Continuidad del Tratamiento', sq6:'¿Con qué fiabilidad puede obtener sus medicamentos y acudir a las citas de seguimiento?',
    sq6_opts:['Medicamentos y citas siempre disponibles cuando se necesitan','Generalmente disponibles con retrasos o dificultades ocasionales','Con frecuencia retrasados o difíciles de obtener','Poco fiables; con importantes brechas en acceso a medicamentos o seguimiento'],
    sq7_title:'Comprensión e Información',  sq7:'¿Qué tan bien comprende las instrucciones para tomar sus medicamentos?',
    sq7_opts:['Los comprendo completamente y puedo explicarlos a otros','Comprendo la mayoría de las instrucciones','Comprendo algunos pero tengo dudas en partes','Con frecuencia me confundo o tengo incertidumbre sobre cómo tomarlos'],
    sq8_title:'Creencias sobre la Adherencia', sq8:'¿Cuánto cree que su medicamento es necesario y le ayudará?',
    sq8_opts:['Estoy firmemente convencido/a de que es necesario y eficaz','En general creo que ayuda','No estoy seguro/a de si está ayudando','Con frecuencia dudo de su necesidad o eficacia'],
    pairing_title:'⚠ Protocolo de Vinculación del Paciente',
    pairing_body:'Los pacientes deben completar primero la evaluación MMAS-8 para recibir un ID de paciente. Este ID vincula los datos de adherencia MMAS-8 con las puntuaciones PEACS para análisis longitudinal entre instrumentos.',
    patient_id_label:'ID del Paciente',
    patient_id_hint:'(completado automáticamente desde la sesión MMAS · editable)',
    submit_btn:'Enviar Evaluación PEACS →',
  },
  fr: {
    name: 'French', native: 'Français', dir: 'ltr',
    base_intro: 'Je vais maintenant vous poser quelques questions sur les habitudes et les routines que vous suivez généralement lorsque vous prenez ce médicament. Pensez à ce qui est généralement vrai pour vous (au cours du mois dernier). Il n\'y a pas de bonnes ou de mauvaises réponses ; veuillez répondre honnêtement.',
    mvmt_intro: 'Les questions suivantes portent sur votre expérience de prise de médicament au cours des 7 derniers jours…',
    strata_intro: 'Ensuite, nous vous poserons des questions sur votre soutien, votre situation de logement, vos transports, vos finances et votre compréhension de votre traitement.',
    base_opts: ['Oui', 'Parfois', 'Non'],
    mvmt_opts: ['Non', 'Oui, une fois', 'Oui, plus d\'une fois'],
    base_dim: 'BASE — Évaluation de l\'Architecture et de la Stabilité Comportementale',
    base_period: '30 derniers jours · 7 questions · Structure des habitudes',
    mvmt_dim: 'MVMT — Variance Minimale Mesurable',
    mvmt_period: '7 derniers jours · 7 questions · Fidélité temporelle',
    strata_dim: 'STRATA — Accès Social, Relationnel et Contextuel au Traitement',
    strata_period: 'Trimestre en cours · 8 questions · Ancrage à quatre niveaux',
    bq1_title:'Architecture Mnésique',      bq1:'Prenez-vous votre médicament de manière fiable selon le calendrier prévu, même lors de journées stressantes ?',
    bq2_title:'Stabilité de la Routine',    bq2:'Maintenez-vous une routine cohérente pour prendre votre médicament lorsque votre emploi du temps quotidien change ?',
    bq3_title:'Résilience aux Symptômes',   bq3:'Si vous commencez à vous sentir mieux, continuez-vous à prendre votre médicament exactement comme prescrit ?',
    bq4_title:'Flexibilité Adaptative',     bq4:'Pouvez-vous adapter votre routine quotidienne pour vous assurer de prendre votre médicament lorsque votre emploi du temps change ?',
    bq5_title:'Tolérance aux Effets Secondaires', bq5:'Si vous ressentez des effets secondaires, pouvez-vous poursuivre le traitement tout en les gérant ?',
    bq6_title:'Intégration Comportementale', bq6:'La prise de médicament s\'intègre-t-elle naturellement dans votre vie quotidienne ?',
    bq7_title:'Structure de Préparation',   bq7:'Gardez-vous habituellement un stock de réserve pour ne pas manquer de médicament ?',
    mq1_title:'Cohérence des Horaires',     mq1:'Au cours des 7 derniers jours, avez-vous eu du mal à prendre votre médicament à la même heure chaque jour ?',
    mq2_title:'Respect des Doses',          mq2:'Au cours des 7 derniers jours, avez-vous oublié des doses ?',
    mq3_title:'Omission liée aux Symptômes', mq3:'Au cours des 7 derniers jours, avez-vous arrêté ou sauté votre médicament parce que vous vous sentiez mieux ?',
    mq4_title:'Réaction aux Effets Secondaires', mq4:'Au cours des 7 derniers jours, avez-vous arrêté ou sauté votre médicament en raison d\'effets secondaires ?',
    mq5_title:'Perturbation Environnementale', mq5:'Au cours des 7 derniers jours, un voyage, une absence ou votre environnement vous ont-ils fait manquer une dose ?',
    mq6_title:'Adaptation du Planning',     mq6:'Au cours des 7 derniers jours, avez-vous eu du mal à ajuster votre routine pour prendre votre médicament lorsque votre planning a changé ?',
    mq7_title:'Intégration Quotidienne',    mq7:'Au cours des 7 derniers jours, la prise de médicament vous a-t-elle semblé contraignante ou ne s\'intégrait-elle pas naturellement à votre vie ?',
    sq1_title:'Personne de Soutien Principale', sq1:'Qui vous aide à vous souvenir ou à gérer vos médicaments ?',
    sq1_opts:['Conjoint(e) ou partenaire','Enfant adulte ou autre membre de la famille','Ami(e), voisin(e) ou aidant(e)','Je me gère de manière indépendante'],
    sq2_title:'Fréquence de Contact',       sq2:'À quelle fréquence avez-vous un contact significatif avec votre famille ou vos amis ?',
    sq2_opts:['Quotidiennement ou plusieurs fois par semaine','Une fois par semaine','Quelques fois par mois','Rarement ou presque jamais'],
    sq3_title:'Situation de Logement',      sq3:'Quelle est votre situation de logement actuelle ?',
    sq3_opts:['Je vis avec mon conjoint ou des membres de ma famille','Je vis seul(e) avec famille ou soutien à proximité','Logement assisté ou encadré','Je vis seul(e) avec famille éloignée ou en logement temporaire'],
    sq4_title:'Réseau de Contact d\'Urgence', sq4:'En cas d\'urgence médicale, qui serait informé et pourrait vous aider ?',
    sq4_opts:['Plusieurs personnes qui répondraient rapidement','Au moins une personne qui répondrait','Quelqu\'un qui pourrait éventuellement le remarquer','Probablement personne ou définitivement personne'],
    sq5_title:'Accès aux Transports',       sq5:'Comment vous rendez-vous habituellement à vos rendez-vous médicaux ou à la pharmacie ?',
    sq5_opts:['Je conduis ou j\'ai un transport fiable et flexible','Famille ou amis m\'accompagnent, ou transport en commun disponible','Transport médical, taxi ou transport obtenu avec difficulté','Je ne peux pas me rendre de manière fiable aux rendez-vous ou à la pharmacie'],
    sq6_title:'Continuité du Traitement',   sq6:'Dans quelle mesure pouvez-vous obtenir vos médicaments et assister aux rendez-vous de suivi ?',
    sq6_opts:['Médicaments et rendez-vous toujours disponibles quand nécessaire','Généralement disponibles avec des retards ou difficultés occasionnels','Souvent retardés ou difficiles d\'accès','Peu fiables ; lacunes importantes dans l\'accès aux médicaments ou au suivi'],
    sq7_title:'Information et Littératie',  sq7:'Dans quelle mesure comprenez-vous les instructions pour prendre vos médicaments ?',
    sq7_opts:['Je comprends parfaitement et peux l\'expliquer à d\'autres','Je comprends la plupart des instructions','Je comprends certaines parties mais ai des incertitudes','Je suis souvent confus(e) ou incertain(e) sur comment les prendre'],
    sq8_title:'Croyances sur le Traitement', sq8:'Dans quelle mesure croyez-vous que votre médicament est nécessaire et vous aidera ?',
    sq8_opts:['Je suis fermement convaincu(e) qu\'il est nécessaire et efficace','Je crois généralement qu\'il aide','Je ne suis pas sûr(e) qu\'il aide','Je doute souvent de sa nécessité ou de son efficacité'],
    pairing_title:'⚠ Protocole d\'Association du Patient',
    pairing_body:'Les patients doivent d\'abord compléter l\'évaluation MMAS-8 pour recevoir un identifiant patient. Cet identifiant associe les données d\'adhérence MMAS-8 aux scores PEACS pour une analyse longitudinale inter-instruments.',
    patient_id_label:'ID du Patient',
    patient_id_hint:'(rempli automatiquement depuis la session MMAS · modifiable)',
    submit_btn:'Soumettre l\'Évaluation PEACS →',
  },
  it: {
    name: 'Italian', native: 'Italiano', dir: 'ltr',
    base_intro: 'Le farò ora alcune domande sulle abitudini e le routine che segue generalmente quando assume questo farmaco. Pensi a ciò che è tipicamente vero per lei (nell\'ultimo mese). Non esistono risposte giuste o sbagliate; risponda con sincerità.',
    mvmt_intro: 'Le domande seguenti riguardano la sua esperienza nell\'assunzione del farmaco negli ultimi 7 giorni…',
    strata_intro: 'Di seguito, le faremo domande sul suo supporto, la situazione abitativa, i trasporti, le finanze e la comprensione del suo trattamento.',
    base_opts: ['Sì', 'A volte', 'No'],
    mvmt_opts: ['No', 'Sì, una volta', 'Sì, più di una volta'],
    base_dim: 'BASE — Valutazione dell\'Architettura e della Stabilità Comportamentale',
    base_period: 'Ultimi 30 giorni · 7 domande · Struttura delle abitudini',
    mvmt_dim: 'MVMT — Varianza Minima Misurabile',
    mvmt_period: 'Ultimi 7 giorni · 7 domande · Fedeltà temporale',
    strata_dim: 'STRATA — Accesso Sociale, Relazionale e Contestuale al Trattamento',
    strata_period: 'Trimestre corrente · 8 domande · Ancoraggio a quattro livelli',
    bq1_title:'Architettura della Memoria', bq1:'Riesce a ricordare in modo affidabile di assumere il farmaco come previsto, anche nelle giornate stressanti?',
    bq2_title:'Stabilità della Routine',    bq2:'Mantiene una routine coerente per l\'assunzione del farmaco quando il suo programma quotidiano cambia?',
    bq3_title:'Resilienza ai Sintomi',      bq3:'Se comincia a sentirsi meglio, continua ad assumere il farmaco esattamente come prescritto?',
    bq4_title:'Flessibilità Adattiva',      bq4:'Riesce ad adattare la sua routine quotidiana per assicurarsi di assumere il farmaco quando il programma cambia?',
    bq5_title:'Tolleranza agli Effetti Collaterali', bq5:'Se sperimenta effetti collaterali, riesce a continuare il trattamento gestendoli?',
    bq6_title:'Integrazione Comportamentale', bq6:'L\'assunzione del farmaco si inserisce naturalmente nella sua vita quotidiana?',
    bq7_title:'Struttura di Preparazione',  bq7:'Mantiene abitualmente una scorta di riserva del farmaco per non rimanerne sprovvisto?',
    mq1_title:'Coerenza degli Orari',       mq1:'Negli ultimi 7 giorni, ha avuto difficoltà ad assumere il farmaco alla stessa ora ogni giorno?',
    mq2_title:'Completamento delle Dosi',   mq2:'Negli ultimi 7 giorni, ha saltato qualche dose?',
    mq3_title:'Omissione per Sintomi',      mq3:'Negli ultimi 7 giorni, ha smesso o saltato il farmaco perché si sentiva meglio?',
    mq4_title:'Risposta agli Effetti Collaterali', mq4:'Negli ultimi 7 giorni, ha interrotto o saltato il farmaco a causa di effetti collaterali?',
    mq5_title:'Interferenza Ambientale',    mq5:'Negli ultimi 7 giorni, un viaggio, un\'assenza o l\'ambiente le ha fatto saltare qualche dose?',
    mq6_title:'Adattamento del Programma', mq6:'Negli ultimi 7 giorni, ha avuto difficoltà ad adattare la sua routine per assumere il farmaco quando il programma è cambiato?',
    mq7_title:'Integrazione Quotidiana',    mq7:'Negli ultimi 7 giorni, l\'assunzione del farmaco le è sembrata un fastidio o non si è inserita naturalmente nella vita quotidiana?',
    sq1_title:'Persona di Supporto Principale', sq1:'Chi la aiuta a ricordare o gestire i suoi farmaci?',
    sq1_opts:['Coniuge o partner','Figlio adulto o altro familiare','Amico, vicino o caregiver','Gestisco in modo indipendente'],
    sq2_title:'Frequenza dei Contatti',     sq2:'Con quale frequenza ha contatti significativi con familiari o amici?',
    sq2_opts:['Quotidianamente o più volte a settimana','Una volta a settimana','Alcune volte al mese','Raramente o quasi mai'],
    sq3_title:'Situazione Abitativa',       sq3:'Qual è la sua attuale sistemazione abitativa?',
    sq3_opts:['Vivo con coniuge o familiari','Vivo da solo/a con famiglia o supporto vicino','Struttura di vita assistita o supportata','Vivo da solo/a con famiglia lontana o in alloggio temporaneo'],
    sq4_title:'Rete di Contatti di Emergenza', sq4:'In caso di emergenza medica, chi ne sarebbe a conoscenza e potrebbe aiutarla?',
    sq4_opts:['Più persone che risponderebbero rapidamente','Almeno una persona che risponderebbe','Qualcuno che potrebbe eventualmente accorgersene','Probabilmente nessuno o definitivamente nessuno'],
    sq5_title:'Accesso ai Trasporti',       sq5:'Come raggiunge solitamente gli appuntamenti medici o la farmacia?',
    sq5_opts:['Guido o ho trasporto affidabile e flessibile','Familiari o amici mi accompagnano, o è disponibile il trasporto pubblico','Trasporto medico, taxi o ottenuto con difficoltà','Non riesco ad arrivare in modo affidabile agli appuntamenti o in farmacia'],
    sq6_title:'Continuità del Trattamento', sq6:'Quanto affidabilmente riesce a ottenere i farmaci e a partecipare agli appuntamenti di follow-up?',
    sq6_opts:['Farmaci e appuntamenti sempre disponibili quando necessario','Generalmente disponibili con ritardi o difficoltà occasionali','Spesso in ritardo o difficili da ottenere','Inaffidabili; lacune significative nell\'accesso ai farmaci o al follow-up'],
    sq7_title:'Informazione e Alfabetizzazione', sq7:'Quanto bene comprende le istruzioni per assumere i suoi farmaci?',
    sq7_opts:['Li comprendo completamente e posso spiegarli ad altri','Comprendo la maggior parte delle istruzioni','Ne comprendo alcune ma ho incertezze in alcune parti','Spesso sono confuso/a o incerto/a su come assumerli'],
    sq8_title:'Credenze sull\'Aderenza',    sq8:'Quanto crede che il suo farmaco sia necessario e la aiuterà?',
    sq8_opts:['Sono fermamente convinto/a che sia necessario ed efficace','In genere credo che aiuti','Non sono sicuro/a che stia aiutando','Spesso dubito della sua necessità o efficacia'],
    pairing_title:'⚠ Protocollo di Abbinamento del Paziente',
    pairing_body:'I pazienti devono prima completare la valutazione MMAS-8 per ricevere un ID paziente. Questo ID collega i dati di aderenza MMAS-8 con i punteggi PEACS per l\'analisi longitudinale tra strumenti.',
    patient_id_label:'ID Paziente',
    patient_id_hint:'(compilato automaticamente dalla sessione MMAS · modificabile)',
    submit_btn:'Invia Valutazione PEACS →',
  },
  de: {
    name: 'German', native: 'Deutsch', dir: 'ltr',
    base_intro: 'Ich werde Ihnen nun einige Fragen zu den Gewohnheiten und Routinen stellen, die Sie beim Einnehmen dieses Medikaments im Allgemeinen befolgen. Denken Sie daran, was für Sie typischerweise zutrifft (im letzten Monat). Es gibt keine richtigen oder falschen Antworten; bitte antworten Sie ehrlich.',
    mvmt_intro: 'Die folgenden Fragen beziehen sich auf Ihre Erfahrungen bei der Einnahme Ihres Medikaments in den letzten 7 Tagen…',
    strata_intro: 'Als nächstes werden wir Ihnen Fragen zu Ihrer Unterstützung, Wohnsituation, Transport, Finanzen und Ihrem Verständnis Ihrer Behandlung stellen.',
    base_opts: ['Ja', 'Manchmal', 'Nein'],
    mvmt_opts: ['Nein', 'Ja, einmal', 'Ja, mehr als einmal'],
    base_dim: 'BASE — Bewertung der Verhaltensarchitektur und -stabilität',
    base_period: 'Letzte 30 Tage · 7 Fragen · Gewohnheitsstruktur',
    mvmt_dim: 'MVMT — Messbare Minimalvarianz',
    mvmt_period: 'Letzte 7 Tage · 7 Fragen · Zeitliche Treue',
    strata_dim: 'STRATA — Sozialer, Relationaler und Kontextueller Behandlungszugang',
    strata_period: 'Aktuelles Quartal · 8 Fragen · Vierstufige Verankerung',
    bq1_title:'Gedächtnisarchitektur',      bq1:'Nehmen Sie Ihr Medikament zuverlässig nach Plan ein, auch an stressigen Tagen?',
    bq2_title:'Routinestabilität',          bq2:'Behalten Sie eine konsistente Routine bei der Medikamenteneinnahme bei, wenn sich Ihr täglicher Zeitplan ändert?',
    bq3_title:'Symptomresilienz',           bq3:'Wenn Sie sich besser zu fühlen beginnen, nehmen Sie Ihr Medikament weiterhin genau wie verschrieben ein?',
    bq4_title:'Adaptive Flexibilität',      bq4:'Können Sie Ihre tägliche Routine anpassen, um sicherzustellen, dass Sie Ihr Medikament einnehmen, wenn sich Ihr Zeitplan ändert?',
    bq5_title:'Nebenwirkungstoleranz',      bq5:'Wenn Sie Nebenwirkungen erleben, können Sie die Behandlung fortsetzen, während Sie diese bewältigen?',
    bq6_title:'Verhaltensintegration',      bq6:'Fügt sich die Medikamenteneinnahme natürlich in Ihren Alltag ein?',
    bq7_title:'Vorbereitungsstruktur',      bq7:'Halten Sie routinemäßig einen Vorrat bereit, damit Ihnen das Medikament nicht ausgeht?',
    mq1_title:'Zeitliche Konsistenz',       mq1:'Hatten Sie in den letzten 7 Tagen Schwierigkeiten, Ihr Medikament jeden Tag zur gleichen Zeit einzunehmen?',
    mq2_title:'Dosiserfüllung',             mq2:'Haben Sie in den letzten 7 Tagen Dosen ausgelassen?',
    mq3_title:'Symptombedingte Auslassung', mq3:'Haben Sie in den letzten 7 Tagen das Medikament abgesetzt oder ausgelassen, weil Sie sich besser fühlten?',
    mq4_title:'Reaktion auf Nebenwirkungen', mq4:'Haben Sie in den letzten 7 Tagen das Medikament wegen Nebenwirkungen abgesetzt oder ausgelassen?',
    mq5_title:'Umgebungsstörung',           mq5:'Haben Sie in den letzten 7 Tagen aufgrund einer Reise, Abwesenheit oder Ihrer Umgebung eine Dosis versäumt?',
    mq6_title:'Zeitplananpassung',          mq6:'Hatten Sie in den letzten 7 Tagen Schwierigkeiten, Ihre Routine anzupassen, um das Medikament einzunehmen, als sich Ihr Zeitplan änderte?',
    mq7_title:'Tägliche Integration',       mq7:'Fühlte sich die Medikamenteneinnahme in den letzten 7 Tagen wie ein Aufwand an oder passte nicht natürlich in Ihren Alltag?',
    sq1_title:'Hauptunterstützungsperson',  sq1:'Wer hilft Ihnen dabei, an Ihre Medikamente zu denken oder sie zu verwalten?',
    sq1_opts:['Ehepartner oder Partner','Erwachsenes Kind oder anderes Familienmitglied','Freund, Nachbar oder Betreuer','Ich komme selbstständig zurecht'],
    sq2_title:'Kontakthäufigkeit',          sq2:'Wie oft haben Sie bedeutungsvollen Kontakt mit Familie oder Freunden?',
    sq2_opts:['Täglich oder mehrmals pro Woche','Einmal pro Woche','Einige Male im Monat','Selten oder fast nie'],
    sq3_title:'Wohnsituation',              sq3:'Wie ist Ihre aktuelle Wohnsituation?',
    sq3_opts:['Ich lebe mit Ehepartner oder Familienmitgliedern','Ich lebe allein mit Familie oder Unterstützung in der Nähe','Betreutes oder unterstütztes Wohnen','Ich lebe allein mit Familie weit weg oder in vorübergehender Unterkunft'],
    sq4_title:'Notfallkontaktnetzwerk',     sq4:'Wenn Sie einen medizinischen Notfall hätten, wer würde es wissen und könnte helfen?',
    sq4_opts:['Mehrere Personen, die schnell reagieren würden','Mindestens eine Person, die reagieren würde','Jemand, der es vielleicht irgendwann bemerken würde','Wahrscheinlich niemand oder definitiv niemand'],
    sq5_title:'Transportzugang',            sq5:'Wie gelangen Sie normalerweise zu Arzttermine oder zur Apotheke?',
    sq5_opts:['Ich fahre selbst oder habe zuverlässigen, flexiblen Transport','Familie oder Freunde bringen mich, oder öffentliche Verkehrsmittel sind verfügbar','Medizintransport, Taxi oder Transport mit Schwierigkeiten','Ich kann nicht zuverlässig zu Terminen oder zur Apotheke gelangen'],
    sq6_title:'Behandlungskontinuität',     sq6:'Wie zuverlässig können Sie Ihre Medikamente bekommen und Nachsorgetermine wahrnehmen?',
    sq6_opts:['Medikamente und Termine immer verfügbar wenn nötig','Meistens verfügbar mit gelegentlichen Verzögerungen oder Schwierigkeiten','Häufig verzögert oder schwer zugänglich','Unzuverlässig; erhebliche Lücken beim Zugang zu Medikamenten oder Nachsorge'],
    sq7_title:'Information und Gesundheitskompetenz', sq7:'Wie gut verstehen Sie die Anweisungen zur Einnahme Ihrer Medikamente?',
    sq7_opts:['Ich verstehe vollständig und kann es anderen erklären','Ich verstehe die meisten Anweisungen','Ich verstehe einiges, bin aber bei Teilen unsicher','Ich bin oft verwirrt oder unsicher, wie ich sie einnehmen soll'],
    sq8_title:'Überzeugungen zur Adhärenz', sq8:'Wie stark glauben Sie, dass Ihr Medikament notwendig ist und Ihnen helfen wird?',
    sq8_opts:['Ich bin fest überzeugt, dass es notwendig und wirksam ist','Ich glaube generell, dass es hilft','Ich bin nicht sicher, ob es hilft','Ich zweifle oft an seiner Notwendigkeit oder Wirksamkeit'],
    pairing_title:'⚠ Patientenzuordnungsprotokoll',
    pairing_body:'Patienten müssen zuerst die MMAS-8-Bewertung abschließen, um eine Patienten-ID zu erhalten. Diese ID verknüpft MMAS-8-Adhärenzdaten mit PEACS-Scores für die longitudinale, instrumentenübergreifende Analyse.',
    patient_id_label:'Patienten-ID',
    patient_id_hint:'(automatisch aus der MMAS-Sitzung ausgefüllt · bearbeitbar)',
    submit_btn:'PEACS-Bewertung einreichen →',
  },
  pt: {
    name: 'Portuguese', native: 'Português', dir: 'ltr',
    base_intro: 'Vou agora fazer-lhe algumas perguntas sobre os hábitos e rotinas que geralmente segue ao tomar este medicamento. Pense no que é tipicamente verdade para si (no último mês). Não há respostas certas ou erradas; por favor responda com honestidade.',
    mvmt_intro: 'As perguntas seguintes são sobre a sua experiência a tomar o medicamento nos últimos 7 dias…',
    strata_intro: 'De seguida, faremos perguntas sobre o seu suporte, situação habitacional, transporte, finanças e compreensão do seu tratamento.',
    base_opts: ['Sim', 'Às vezes', 'Não'],
    mvmt_opts: ['Não', 'Sim, uma vez', 'Sim, mais de uma vez'],
    base_dim: 'BASE — Avaliação da Arquitetura e Estabilidade Comportamental',
    base_period: 'Últimos 30 dias · 7 perguntas · Estrutura de hábitos',
    mvmt_dim: 'MVMT — Variância Mínima Mensurável',
    mvmt_period: 'Últimos 7 dias · 7 perguntas · Fidelidade temporal',
    strata_dim: 'STRATA — Acesso Social, Relacional e Contextual ao Tratamento',
    strata_period: 'Trimestre atual · 8 perguntas · Ancoragem de quatro níveis',
    bq1_title:'Arquitetura de Memória',     bq1:'Recorda-se de forma fiável de tomar o medicamento conforme programado, mesmo em dias stressantes?',
    bq2_title:'Estabilidade da Rotina',     bq2:'Mantém uma rotina consistente para tomar o medicamento quando o seu horário diário muda?',
    bq3_title:'Resiliência aos Sintomas',   bq3:'Se começar a sentir-se melhor, continua a tomar o medicamento exatamente como prescrito?',
    bq4_title:'Flexibilidade Adaptativa',   bq4:'Consegue adaptar a sua rotina diária para garantir que toma o medicamento quando o horário muda?',
    bq5_title:'Tolerância a Efeitos Secundários', bq5:'Se tiver efeitos secundários, consegue continuar o tratamento enquanto os gere?',
    bq6_title:'Integração Comportamental',  bq6:'Tomar o medicamento encaixa-se naturalmente na sua vida diária?',
    bq7_title:'Estrutura de Preparação',    bq7:'Mantém habitualmente uma reserva de medicamento para não ficar sem ele?',
    mq1_title:'Consistência de Horário',    mq1:'Nos últimos 7 dias, teve dificuldade em tomar o medicamento à mesma hora todos os dias?',
    mq2_title:'Cumprimento de Doses',       mq2:'Nos últimos 7 dias, esqueceu-se de alguma dose?',
    mq3_title:'Omissão por Sintomas',       mq3:'Nos últimos 7 dias, deixou de tomar ou saltou o medicamento porque se sentiu melhor?',
    mq4_title:'Resposta a Efeitos Secundários', mq4:'Nos últimos 7 dias, parou ou saltou o medicamento por causa de efeitos secundários?',
    mq5_title:'Perturbação Ambiental',      mq5:'Nos últimos 7 dias, uma viagem, ausência ou o seu ambiente fez com que faltasse a alguma dose?',
    mq6_title:'Adaptação de Horário',       mq6:'Nos últimos 7 dias, teve dificuldade em ajustar a sua rotina para tomar o medicamento quando o horário mudou?',
    mq7_title:'Integração Diária',          mq7:'Nos últimos 7 dias, tomar o medicamento pareceu-lhe um incómodo ou não se integrou naturalmente na vida quotidiana?',
    sq1_title:'Pessoa de Apoio Principal',  sq1:'Quem o/a ajuda a lembrar ou gerir os seus medicamentos?',
    sq1_opts:['Cônjuge ou parceiro/a','Filho/a adulto/a ou outro familiar','Amigo/a, vizinho/a ou cuidador/a','Giro de forma independente'],
    sq2_title:'Frequência de Contacto',     sq2:'Com que frequência tem contacto significativo com familiares ou amigos?',
    sq2_opts:['Diariamente ou várias vezes por semana','Uma vez por semana','Algumas vezes por mês','Raramente ou quase nunca'],
    sq3_title:'Situação Habitacional',      sq3:'Qual é a sua situação habitacional atual?',
    sq3_opts:['Vivo com cônjuge ou familiares','Vivo sozinho/a com família ou apoio próximo','Habitação assistida ou apoiada','Vivo sozinho/a com família longe ou em habitação temporária'],
    sq4_title:'Rede de Contacto de Emergência', sq4:'Em caso de emergência médica, quem saberia e poderia ajudar?',
    sq4_opts:['Várias pessoas que responderiam rapidamente','Pelo menos uma pessoa que responderia','Alguém que poderia eventualmente dar conta','Provavelmente ninguém ou definitivamente ninguém'],
    sq5_title:'Acesso a Transporte',        sq5:'Como se desloca habitualmente às consultas médicas ou à farmácia?',
    sq5_opts:['Conduzo ou tenho transporte fiável e flexível','Familiar ou amigo leva-me, ou há transporte público disponível','Transporte médico, táxi ou obtido com dificuldade','Não consigo chegar de forma fiável a consultas ou à farmácia'],
    sq6_title:'Continuidade do Tratamento', sq6:'Com que fiabilidade consegue obter os medicamentos e comparecer às consultas de acompanhamento?',
    sq6_opts:['Medicamentos e consultas sempre disponíveis quando necessário','Geralmente disponíveis com atrasos ou dificuldades ocasionais','Frequentemente atrasados ou difíceis de obter','Pouco fiáveis; lacunas significativas no acesso a medicamentos ou acompanhamento'],
    sq7_title:'Informação e Literacia',     sq7:'Quão bem compreende as instruções para tomar os seus medicamentos?',
    sq7_opts:['Compreendo completamente e consigo explicar a outros','Compreendo a maioria das instruções','Compreendo alguns mas tenho dúvidas em partes','Frequentemente confuso/a ou incerto/a sobre como tomá-los'],
    sq8_title:'Crenças sobre a Adesão',     sq8:'Em que medida acredita que o seu medicamento é necessário e vai ajudá-lo/a?',
    sq8_opts:['Acredito firmemente que é necessário e eficaz','Em geral acredito que ajuda','Não tenho certeza se está a ajudar','Frequentemente duvido da sua necessidade ou eficácia'],
    pairing_title:'⚠ Protocolo de Emparelhamento do Paciente',
    pairing_body:'Os pacientes devem primeiro completar a avaliação MMAS-8 para receber um ID de paciente. Este ID liga os dados de adesão MMAS-8 às pontuações PEACS para análise longitudinal entre instrumentos.',
    patient_id_label:'ID do Paciente',
    patient_id_hint:'(preenchido automaticamente da sessão MMAS · editável)',
    submit_btn:'Submeter Avaliação PEACS →',
  },
  pl: {
    name: 'Polish', native: 'Polski', dir: 'ltr',
    base_intro: 'Teraz zadam Panu/Pani kilka pytań dotyczących nawyków i rutyn, które zazwyczaj stosuje Pan/Pani podczas przyjmowania tego leku. Proszę pomyśleć o tym, co jest dla Pana/Pani typowe (w ciągu ostatniego miesiąca). Nie ma odpowiedzi dobrych ani złych; proszę odpowiadać szczerze.',
    mvmt_intro: 'Następne pytania dotyczą doświadczeń związanych z przyjmowaniem leku w ciągu ostatnich 7 dni…',
    strata_intro: 'Następnie zadamy pytania dotyczące wsparcia, warunków mieszkaniowych, transportu, sytuacji finansowej i rozumienia leczenia.',
    base_opts: ['Tak', 'Czasami', 'Nie'],
    mvmt_opts: ['Nie', 'Tak, raz', 'Tak, więcej niż raz'],
    base_dim: 'BASE — Ocena Architektury i Stabilności Zachowania',
    base_period: 'Ostatnie 30 dni · 7 pytań · Struktura nawyków',
    mvmt_dim: 'MVMT — Mierzalna Minimalna Wariancja',
    mvmt_period: 'Ostatnie 7 dni · 7 pytań · Wierność czasowa',
    strata_dim: 'STRATA — Społeczny, Relacyjny i Kontekstualny Dostęp do Leczenia',
    strata_period: 'Bieżący kwartał · 8 pytań · Czterostopniowe zakotwiczenie',
    bq1_title:'Architektura pamięci',             bq1:'Czy niezawodnie pamięta Pan/Pani o przyjęciu leku zgodnie z harmonogramem, nawet w stresujące dni?',
    bq2_title:'Stabilność rutyny',                bq2:'Czy utrzymuje Pan/Pani stałą rutynę przyjmowania leku, gdy zmienia się Pana/Pani dzienny harmonogram?',
    bq3_title:'Odporność na objawy',              bq3:'Jeśli zaczyna Pan/Pani czuć się lepiej, czy nadal przyjmuje Pan/Pani lek dokładnie tak, jak przepisano?',
    bq4_title:'Adaptacyjna elastyczność',         bq4:'Czy potrafi Pan/Pani dostosować codzienną rutynę, aby upewnić się, że przyjmuje Pan/Pani lek, gdy harmonogram ulega zmianie?',
    bq5_title:'Tolerancja na działania niepożądane', bq5:'Jeśli doświadcza Pan/Pani działań niepożądanych, czy może Pan/Pani kontynuować leczenie, jednocześnie sobie z nimi radząc?',
    bq6_title:'Integracja behawioralna',           bq6:'Czy przyjmowanie leku naturalnie wpisuje się w Pana/Pani codzienne życie?',
    bq7_title:'Struktura przygotowania',           bq7:'Czy rutynowo utrzymuje Pan/Pani zapas leku, aby nie zabrakło?',
    mq1_title:'Spójność czasowa',                  mq1:'Czy w ciągu ostatnich 7 dni miał(a) Pan/Pani trudności z przyjmowaniem leku o tej samej porze każdego dnia?',
    mq2_title:'Realizacja dawek',                  mq2:'Czy w ciągu ostatnich 7 dni opuścił(a) Pan/Pani jakieś dawki?',
    mq3_title:'Pomijanie z powodu objawów',        mq3:'Czy w ciągu ostatnich 7 dni odstawił(a) lub pominął(a) Pan/Pani lek, ponieważ czuł(a) się Pan/Pani lepiej?',
    mq4_title:'Reakcja na działania niepożądane',  mq4:'Czy w ciągu ostatnich 7 dni odstawił(a) lub pominął(a) Pan/Pani lek z powodu działań niepożądanych?',
    mq5_title:'Zakłócenie środowiskowe',           mq5:'Czy w ciągu ostatnich 7 dni podróż, nieobecność lub środowisko spowodowały pominięcie dawki?',
    mq6_title:'Adaptacja harmonogramu',            mq6:'Czy w ciągu ostatnich 7 dni miał(a) Pan/Pani trudności z dostosowaniem rutyny, aby przyjąć lek, gdy harmonogram uległ zmianie?',
    mq7_title:'Codzienna integracja',              mq7:'Czy przyjmowanie leku w ciągu ostatnich 7 dni sprawiało wrażenie uciążliwości lub nie wpisywało się naturalnie w codzienne życie?',
    sq1_title:'Główna osoba wspierająca',          sq1:'Kto pomaga Panu/Pani pamiętać o lekach lub nimi zarządzać?',
    sq1_opts:['Małżonek lub partner/ka','Dorosłe dziecko lub inny członek rodziny','Przyjaciel, sąsiad lub opiekun','Radzę sobie samodzielnie'],
    sq2_title:'Częstotliwość kontaktów',           sq2:'Jak często ma Pan/Pani znaczący kontakt z rodziną lub przyjaciółmi?',
    sq2_opts:['Codziennie lub kilka razy w tygodniu','Raz w tygodniu','Kilka razy w miesiącu','Rzadko lub prawie nigdy'],
    sq3_title:'Sytuacja mieszkaniowa',             sq3:'Jak wygląda Pana/Pani obecna sytuacja mieszkaniowa?',
    sq3_opts:['Mieszkam z małżonkiem lub członkami rodziny','Mieszkam sam/a z rodziną lub wsparciem w pobliżu','Mieszkanie chronione lub z opieką','Mieszkam sam/a z rodziną daleko lub w tymczasowym lokum'],
    sq4_title:'Sieć kontaktów alarmowych',         sq4:'Gdyby miał(a) Pan/Pani nagłe zdarzenie medyczne, kto by o tym wiedział i mógł pomóc?',
    sq4_opts:['Kilka osób, które szybko by zareagowały','Co najmniej jedna osoba, która by zareagowała','Ktoś, kto mógłby się w końcu zorientować','Prawdopodobnie nikt lub zdecydowanie nikt'],
    sq5_title:'Dostęp do transportu',              sq5:'Jak zazwyczaj dociera Pan/Pani na wizyty lekarskie lub do apteki?',
    sq5_opts:['Prowadzę samochód lub mam niezawodny i elastyczny transport','Rodzina lub znajomi mnie przewożą, lub dostępny jest transport publiczny','Transport medyczny, taksówka lub uzyskiwany z trudnością','Nie mogę niezawodnie docierać na wizyty lub do apteki'],
    sq6_title:'Ciągłość leczenia',                 sq6:'Jak niezawodnie może Pan/Pani uzyskać leki i uczęszczać na wizyty kontrolne?',
    sq6_opts:['Leki i wizyty zawsze dostępne gdy potrzebne','Zazwyczaj dostępne z okazjonalnymi opóźnieniami lub trudnościami','Często opóźnione lub trudno dostępne','Zawodne; znaczące luki w dostępie do leków lub opieki następczej'],
    sq7_title:'Informacja i piśmienność zdrowotna', sq7:'Jak dobrze rozumie Pan/Pani instrukcje dotyczące przyjmowania leków?',
    sq7_opts:['Rozumiem w pełni i potrafię wytłumaczyć innym','Rozumiem większość instrukcji','Rozumiem część, ale mam wątpliwości co do niektórych fragmentów','Często jestem zdezorientowany/a lub niepewny/a jak je przyjmować'],
    sq8_title:'Przekonania dotyczące adherencji',  sq8:'W jakim stopniu wierzy Pan/Pani, że lek jest konieczny i pomoże Panu/Pani?',
    sq8_opts:['Jestem głęboko przekonany/a, że jest konieczny i skuteczny','Ogólnie uważam, że pomaga','Nie jestem pewien/pewna, czy pomaga','Często wątpię w jego konieczność lub skuteczność'],
    pairing_title:'⚠ Protokół przypisania pacjenta',
    pairing_body:'Pacjenci muszą najpierw ukończyć ocenę MMAS-8, aby otrzymać identyfikator pacjenta. Ten identyfikator łączy dane adherencji MMAS-8 z wynikami PEACS do podłużnej analizy między instrumentami.',
    patient_id_label:'ID pacjenta',
    patient_id_hint:'(automatycznie wypełniane z sesji MMAS · edytowalne)',
    submit_btn:'Prześlij ocenę PEACS →',
  },

  nl: {
    name: 'Dutch', native: 'Nederlands', dir: 'ltr',
    base_intro: 'Ik ga u nu een aantal vragen stellen over de gewoonten en routines die u normaal gesproken volgt bij het innemen van dit medicijn. Denk na over wat voor u typisch is (in de afgelopen maand). Er zijn geen goede of foute antwoorden; antwoord zo eerlijk mogelijk.',
    mvmt_intro: 'De volgende vragen gaan over uw ervaringen met het innemen van medicijnen in de afgelopen 7 dagen...',
    strata_intro: 'Nu stellen we vragen over steun, woonomstandigheden, vervoer, financiën en begrip van de behandeling.',
    base_opts: ['Ja', 'Soms', 'Nee'],
    mvmt_opts: ['Nee', 'Ja, één keer', 'Ja, meer dan één keer'],
    base_dim: 'BASE — Beoordeling van Architectuur en Gedragsstabiliteit',
    base_period: 'Afgelopen 30 dagen · 7 vragen · Gewoontestructuur',
    mvmt_dim: 'MVMT — Meetbare Minimale Variantie',
    mvmt_period: 'Afgelopen 7 dagen · 7 vragen · Tijdstrouw',
    strata_dim: 'STRATA — Sociale, Relationele en Contextuele Behandelingstoegang',
    strata_period: 'Huidig kwartaal · 8 vragen · Vierpuntsverankering',
    bq1_title: 'Geheugenarchitectuur',        bq1: 'Herinnert u zich betrouwbaar uw medicatie in te nemen volgens schema, zelfs op stressvolle dagen?',
    bq2_title: 'Routinestabiliteit',           bq2: 'Handhaaft u een consistente medicinaticroutine wanneer uw dagelijks schema verandert?',
    bq3_title: 'Symptoomveerkracht',           bq3: 'Als u zich beter begint te voelen, neemt u uw medicijnen dan nog steeds precies zoals voorgeschreven?',
    bq4_title: 'Adaptieve flexibiliteit',      bq4: 'Kunt u uw dagelijkse routine aanpassen om er zeker van te zijn dat u uw medicijnen inneemt wanneer uw schema verandert?',
    bq5_title: 'Bijwerkingstolerantie',        bq5: 'Als u bijwerkingen ervaart, kunt u dan doorgaan met de behandeling terwijl u er mee omgaat?',
    bq6_title: 'Gedragsintegratie',            bq6: 'Past het innemen van uw medicijnen op een natuurlijke manier in uw dagelijks leven?',
    bq7_title: 'Voorbereidingsstructuur',      bq7: 'Houdt u routinematig een voorraad medicijnen bij zodat u niet door uw voorraad heen raakt?',
    mq1_title: 'Tijdsconsistentie',            mq1: 'Heeft u de afgelopen 7 dagen moeite gehad uw medicijnen elke dag op hetzelfde tijdstip in te nemen?',
    mq2_title: 'Dosisuitvoering',              mq2: 'Heeft u de afgelopen 7 dagen doses gemist?',
    mq3_title: 'Symptoomgestimuleerd overslaan', mq3: 'Heeft u de afgelopen 7 dagen uw medicijnen gestaakt of gemist omdat u zich beter voelde?',
    mq4_title: 'Bijwerkingsreactie',           mq4: 'Heeft u de afgelopen 7 dagen uw medicijnen gestaakt of gemist vanwege bijwerkingen?',
    mq5_title: 'Omgevingsstoring',             mq5: 'Heeft reizen, afwezigheid of omgeving de afgelopen 7 dagen een gemiste dosis veroorzaakt?',
    mq6_title: 'Schemaadaptatie',              mq6: 'Heeft u de afgelopen 7 dagen moeite gehad uw routine aan te passen om uw medicijnen in te nemen wanneer uw schema veranderde?',
    mq7_title: 'Dagelijkse integratie',        mq7: 'Voelde het innemen van uw medicijnen de afgelopen 7 dagen als een last of paste het niet op een natuurlijke manier in uw dagelijks leven?',
    sq1_title: 'Primaire steunpersoon',        sq1: 'Wie helpt u uw medicijnen te onthouden of te beheren?',
    sq1_opts: ['Echtgenoot of partner', 'Volwassen kind of ander familielid', 'Vriend, buur of verzorger', 'Ik red me zelfstandig'],
    sq2_title: 'Contactfrequentie',            sq2: 'Hoe vaak heeft u betekenisvol contact met familie of vrienden?',
    sq2_opts: ['Dagelijks of meerdere keren per week', 'Eén keer per week', 'Enkele keren per maand', 'Zelden of bijna nooit'],
    sq3_title: 'Woonsituatie',                 sq3: 'Hoe ziet uw huidige woonsituatie eruit?',
    sq3_opts: ['Ik woon samen met echtgenoot of familieleden', 'Ik woon alleen maar heb familie of steun in de buurt', 'Beschermd of verzorgd wonen', 'Ik woon alleen met familie ver weg of in tijdelijke huisvesting'],
    sq4_title: 'Noodnetwerk',                  sq4: 'Als u een medisch noodgeval zou hebben, wie zou dat weten en kunnen helpen?',
    sq4_opts: ['Meerdere mensen die snel zouden reageren', 'Minimaal één persoon die zou reageren', 'Iemand die het uiteindelijk zou merken', 'Waarschijnlijk niemand of zeker niemand'],
    sq5_title: 'Vervoerstoegang',              sq5: 'Hoe gaat u normaal gesproken naar doktersafspraken of de apotheek?',
    sq5_opts: ['Ik rijd zelf of heb betrouwbaar en flexibel vervoer', 'Familie of vrienden brengen mij, of openbaar vervoer is beschikbaar', 'Medisch vervoer, taxi of met moeite verkregen', 'Ik kan niet betrouwbaar naar afspraken of de apotheek'],
    sq6_title: 'Zorgcontinuïteit',             sq6: 'Hoe betrouwbaar kunt u medicijnen krijgen en controleafspraken bijwonen?',
    sq6_opts: ['Medicijnen en afspraken altijd beschikbaar wanneer nodig', 'Doorgaans beschikbaar met incidentele vertragingen of moeilijkheden', 'Vaak vertraagd of moeilijk te verkrijgen', 'Onbetrouwbaar; aanzienlijke hiaten in medicijn- of zorgtoegankelijkheid'],
    sq7_title: 'Informatie en gezondheidsvaardigheden', sq7: 'Hoe goed begrijpt u de instructies voor het innemen van uw medicijnen?',
    sq7_opts: ['Ik begrijp het volledig en kan het aan anderen uitleggen', 'Ik begrijp de meeste instructies', 'Ik begrijp een deel, maar heb vragen over sommige delen', 'Ik ben vaak in de war of onzeker over hoe ik ze moet innemen'],
    sq8_title: 'Adherentieovertuigingen',      sq8: 'In welke mate gelooft u dat het medicijn noodzakelijk is en u zal helpen?',
    sq8_opts: ['Ik ben er diep van overtuigd dat het noodzakelijk en effectief is', 'Over het algemeen denk ik dat het helpt', 'Ik weet niet zeker of het helpt', 'Ik twijfel vaak aan de noodzaak of effectiviteit ervan'],
    pairing_title: '⚠ Patiëntkoppelingsprotocol',
    pairing_body: 'Patiënten moeten eerst de MMAS-8-beoordeling voltooien om een patiënt-ID te ontvangen. Dit ID koppelt MMAS-8-adherentiedata aan PEACS-resultaten voor longitudinale analyse tussen instrumenten.',
    patient_id_label: 'Patiënt-ID',
    patient_id_hint: '(automatisch ingevuld vanuit MMAS-sessie · bewerkbaar)',
    submit_btn: 'PEACS-beoordeling indienen →',
  },
  da: {
    name: 'Danish', native: 'Dansk', dir: 'ltr',
    base_intro: 'Jeg vil nu stille dig nogle spørgsmål om de vaner og rutiner, du normalt følger, når du tager dette medicin. Tænk på, hvad der er typisk for dig (i løbet af den seneste måned). Der er ingen rigtige eller forkerte svar; besvar så ærligt som muligt.',
    mvmt_intro: 'De næste spørgsmål handler om dine erfaringer med at tage medicin i løbet af de seneste 7 dage...',
    strata_intro: 'Derefter stiller vi spørgsmål om støtte, boligforhold, transport, økonomi og forståelse af behandlingen.',
    base_opts: ['Ja', 'Sommetider', 'Nej'],
    mvmt_opts: ['Nej', 'Ja, én gang', 'Ja, mere end én gang'],
    base_dim: 'BASE — Vurdering af Arkitektur og Adfærdsstabilitet',
    base_period: 'Seneste 30 dage · 7 spørgsmål · Vanestruktur',
    mvmt_dim: 'MVMT — Målbar Minimal Varians',
    mvmt_period: 'Seneste 7 dage · 7 spørgsmål · Tidstroværdighed',
    strata_dim: 'STRATA — Social, Relationel og Kontekstuel Behandlingsadgang',
    strata_period: 'Indeværende kvartal · 8 spørgsmål · Firpunktsforankring',
    bq1_title: 'Hukommelsesarkitektur',        bq1: 'Husker du pålideligt at tage din medicin ifølge skemaet, selv på stressende dage?',
    bq2_title: 'Rutinestabilitet',             bq2: 'Opretholder du en konsekvent medicinroutine, når dit daglige skema ændres?',
    bq3_title: 'Symptomrobusthed',             bq3: 'Hvis du begynder at have det bedre, tager du stadig din medicin præcis som foreskrevet?',
    bq4_title: 'Adaptiv fleksibilitet',        bq4: 'Kan du tilpasse din daglige rutine for at sikre, at du tager din medicin, når dit skema ændrer sig?',
    bq5_title: 'Bivirkningstolerancе',         bq5: 'Hvis du oplever bivirkninger, kan du så fortsætte behandlingen, mens du håndterer dem?',
    bq6_title: 'Adfærdsintegration',           bq6: 'Passer det at tage din medicin naturligt ind i dit daglige liv?',
    bq7_title: 'Forberedelsesstruktur',        bq7: 'Opretholder du rutinemæssigt et lager af medicin, så du ikke løber tør?',
    mq1_title: 'Tidskonsistens',               mq1: 'Har du haft svært ved at tage din medicin på samme tid hver dag i løbet af de seneste 7 dage?',
    mq2_title: 'Dosisudførelse',               mq2: 'Har du misset doser i løbet af de seneste 7 dage?',
    mq3_title: 'Symptomudløst spring',         mq3: 'Har du stoppet eller misset din medicin de seneste 7 dage, fordi du følte dig bedre?',
    mq4_title: 'Bivirkningsreaktion',          mq4: 'Har du stoppet eller misset din medicin de seneste 7 dage på grund af bivirkninger?',
    mq5_title: 'Miljøforstyrrelse',            mq5: 'Har rejse, fravær eller miljø forårsaget en misset dosis de seneste 7 dage?',
    mq6_title: 'Skematilpasning',              mq6: 'Har du haft svært ved at tilpasse din rutine til at tage din medicin, når dit skema ændrede sig de seneste 7 dage?',
    mq7_title: 'Daglig integration',           mq7: 'Føltes det at tage din medicin som en byrde eller passede det ikke naturligt ind i hverdagen de seneste 7 dage?',
    sq1_title: 'Primær støtteperson',          sq1: 'Hvem hjælper dig med at huske eller håndtere dine mediciner?',
    sq1_opts: ['Ægtefælle eller partner', 'Voksent barn eller andet familiemedlem', 'Ven, nabo eller plejeperson', 'Jeg klarer mig selvstændigt'],
    sq2_title: 'Kontaktfrekvens',              sq2: 'Hvor ofte har du meningsfuld kontakt med familie eller venner?',
    sq2_opts: ['Dagligt eller flere gange om ugen', 'Én gang om ugen', 'Nogle gange om måneden', 'Sjældent eller næsten aldrig'],
    sq3_title: 'Boligsituation',               sq3: 'Hvad er din nuværende boligsituation?',
    sq3_opts: ['Jeg bor med ægtefælle eller familiemedlemmer', 'Jeg bor alene men har familie eller støtte i nærheden', 'Beskyttet eller plejeboliger', 'Jeg bor alene med familie langt væk eller i midlertidig bolig'],
    sq4_title: 'Nødnetværk',                   sq4: 'Hvis du havde en medicinsk nødsituation, hvem ville vide det og kunne hjælpe?',
    sq4_opts: ['Flere mennesker, der ville reagere hurtigt', 'Mindst én person, der ville reagere', 'Nogen, der til sidst ville bemærke det', 'Sandsynligvis ingen eller bestemt ingen'],
    sq5_title: 'Transportadgang',              sq5: 'Hvordan kommer du normalt til lægeaftaler eller apoteket?',
    sq5_opts: ['Jeg kører selv eller har pålideligt og fleksibelt transport', 'Familie eller venner kører mig, eller offentlig transport er tilgængeligt', 'Medicinsk transport, taxa eller opnået med besvær', 'Jeg kan ikke pålideligt komme til aftaler eller apoteket'],
    sq6_title: 'Plejekontinuitet',             sq6: 'Hvor pålideligt kan du få medicin og deltage i opfølgende aftaler?',
    sq6_opts: ['Medicin og aftaler altid tilgængelige når det er nødvendigt', 'Normalt tilgængeligt med lejlighedsvise forsinkelser eller vanskeligheder', 'Ofte forsinket eller svært at få fat i', 'Upålideligt; væsentlige huller i adgang til medicin eller opfølgende pleje'],
    sq7_title: 'Information og sundhedskompetencer', sq7: 'Hvor godt forstår du instruktionerne for at tage dine mediciner?',
    sq7_opts: ['Jeg forstår det fuldt ud og kan forklare det til andre', 'Jeg forstår de fleste instruktioner', 'Jeg forstår noget, men er i tvivl om nogle dele', 'Jeg er ofte forvirret eller usikker på, hvordan jeg skal tage dem'],
    sq8_title: 'Adherenceopfattelser',         sq8: 'I hvilken grad tror du, at medicinen er nødvendig og vil hjælpe dig?',
    sq8_opts: ['Jeg er dybt overbevist om, at det er nødvendigt og effektivt', 'Generelt mener jeg, at det hjælper', 'Jeg er ikke sikker på, om det hjælper', 'Jeg tvivler ofte på dens nødvendighed eller effektivitet'],
    pairing_title: '⚠ Patientkoblingsprotokol',
    pairing_body: 'Patienter skal først gennemføre MMAS-8-vurderingen for at modtage et patient-ID. Dette ID forbinder MMAS-8-adherencedata med PEACS-resultater til longitudinal analyse på tværs af instrumenter.',
    patient_id_label: 'Patient-ID',
    patient_id_hint: '(udfyldes automatisk fra MMAS-session · redigerbar)',
    submit_btn: 'Indsend PEACS-vurdering →',
  },
  sv: {
    name: 'Swedish', native: 'Svenska', dir: 'ltr',
    base_intro: 'Jag kommer nu att ställa några frågor om de vanor och rutiner du normalt följer när du tar detta läkemedel. Tänk på vad som är typiskt för dig (under den senaste månaden). Det finns inga rätta eller felaktiga svar; svara så ärligt som möjligt.',
    mvmt_intro: 'Nästa frågor handlar om dina erfarenheter av att ta medicin under de senaste 7 dagarna...',
    strata_intro: 'Sedan ställer vi frågor om stöd, boendesituation, transport, ekonomi och förståelse av behandlingen.',
    base_opts: ['Ja', 'Ibland', 'Nej'],
    mvmt_opts: ['Nej', 'Ja, en gång', 'Ja, mer än en gång'],
    base_dim: 'BASE — Bedömning av Arkitektur och Beteendestabilitet',
    base_period: 'Senaste 30 dagarna · 7 frågor · Vanorstruktur',
    mvmt_dim: 'MVMT — Mätbar Minimal Varians',
    mvmt_period: 'Senaste 7 dagarna · 7 frågor · Tidstrohet',
    strata_dim: 'STRATA — Social, Relationell och Kontextuell Behandlingstillgång',
    strata_period: 'Innevarande kvartal · 8 frågor · Fyrapunktsförankring',
    bq1_title: 'Minnesarkitektur',             bq1: 'Kommer du på ett tillförlitligt sätt ihåg att ta ditt läkemedel enligt schema, även på stressiga dagar?',
    bq2_title: 'Rutinstabilitet',              bq2: 'Håller du en konsekvent medicinrutin när ditt dagliga schema ändras?',
    bq3_title: 'Symptomrobusthet',             bq3: 'Om du börjar känna dig bättre, tar du fortfarande ditt läkemedel exakt som ordinerat?',
    bq4_title: 'Adaptiv flexibilitet',         bq4: 'Kan du anpassa din dagliga rutin för att säkerställa att du tar ditt läkemedel när ditt schema ändras?',
    bq5_title: 'Biverkningstolerans',          bq5: 'Om du upplever biverkningar, kan du då fortsätta behandlingen medan du hanterar dem?',
    bq6_title: 'Beteendeintegration',          bq6: 'Passar det att ta ditt läkemedel naturligt in i ditt dagliga liv?',
    bq7_title: 'Förberedelsesstruktur',        bq7: 'Håller du rutinmässigt ett förråd av läkemedel så att du inte tar slut?',
    mq1_title: 'Tidskonsistens',               mq1: 'Har du haft svårt att ta ditt läkemedel vid samma tid varje dag under de senaste 7 dagarna?',
    mq2_title: 'Dosutförande',                 mq2: 'Har du missat doser under de senaste 7 dagarna?',
    mq3_title: 'Symptomutlöst hoppning',       mq3: 'Har du slutat ta eller missat ditt läkemedel under de senaste 7 dagarna eftersom du mådde bättre?',
    mq4_title: 'Biverkningsreaktion',          mq4: 'Har du slutat ta eller missat ditt läkemedel under de senaste 7 dagarna på grund av biverkningar?',
    mq5_title: 'Miljöstörning',                mq5: 'Har resor, frånvaro eller miljö orsakat en missad dos under de senaste 7 dagarna?',
    mq6_title: 'Schemaanpassning',             mq6: 'Har du haft svårt att anpassa din rutin för att ta ditt läkemedel när ditt schema ändrades under de senaste 7 dagarna?',
    mq7_title: 'Daglig integration',           mq7: 'Kändes det att ta ditt läkemedel under de senaste 7 dagarna som en börda eller passade det inte naturligt in i vardagen?',
    sq1_title: 'Primär stödperson',            sq1: 'Vem hjälper dig att komma ihåg eller hantera dina läkemedel?',
    sq1_opts: ['Make/maka eller partner', 'Vuxet barn eller annan familjemedlem', 'Vän, granne eller vårdgivare', 'Jag klarar mig självständigt'],
    sq2_title: 'Kontaktfrekvens',              sq2: 'Hur ofta har du meningsfullt kontakt med familj eller vänner?',
    sq2_opts: ['Dagligen eller flera gånger i veckan', 'En gång i veckan', 'Några gånger i månaden', 'Sällan eller nästan aldrig'],
    sq3_title: 'Boendesituation',              sq3: 'Hur ser din nuvarande boendesituation ut?',
    sq3_opts: ['Jag bor med make/maka eller familjemedlemmar', 'Jag bor ensam men har familj eller stöd i närheten', 'Skyddat boende eller serviceboende', 'Jag bor ensam med familj långt borta eller i tillfälligt boende'],
    sq4_title: 'Akutnätverk',                  sq4: 'Om du skulle ha en medicinsk nödsituation, vem skulle veta om det och kunna hjälpa?',
    sq4_opts: ['Flera personer som snabbt skulle reagera', 'Minst en person som skulle reagera', 'Någon som till slut skulle märka det', 'Troligtvis ingen eller absolut ingen'],
    sq5_title: 'Transporttillgång',            sq5: 'Hur tar du dig normalt till läkarbesök eller apoteket?',
    sq5_opts: ['Jag kör själv eller har pålitligt och flexibelt transport', 'Familj eller vänner skjutsar mig, eller kollektivtrafik finns tillgänglig', 'Sjuktransport, taxi eller erhållen med svårighet', 'Jag kan inte på ett tillförlitligt sätt ta mig till besök eller apoteket'],
    sq6_title: 'Vård­kontinuitet',             sq6: 'Hur tillförlitligt kan du få läkemedel och delta i uppföljningsbesök?',
    sq6_opts: ['Läkemedel och besök alltid tillgängliga när det behövs', 'Vanligtvis tillgängliga med enstaka förseningar eller svårigheter', 'Ofta försenade eller svåra att få tag på', 'Opålitliga; betydande luckor i tillgång till läkemedel eller uppföljande vård'],
    sq7_title: 'Information och hälsokunskap', sq7: 'Hur väl förstår du instruktionerna för att ta dina läkemedel?',
    sq7_opts: ['Jag förstår det fullt ut och kan förklara det för andra', 'Jag förstår de flesta instruktioner', 'Jag förstår en del men är osäker på vissa delar', 'Jag är ofta förvirrad eller osäker på hur jag ska ta dem'],
    sq8_title: 'Följsamhetsövertygelser',      sq8: 'I vilken utsträckning tror du att läkemedlet är nödvändigt och kommer att hjälpa dig?',
    sq8_opts: ['Jag är djupt övertygad om att det är nödvändigt och effektivt', 'Generellt sett tror jag att det hjälper', 'Jag är inte säker på om det hjälper', 'Jag tvivlar ofta på dess nödvändighet eller effektivitet'],
    pairing_title: '⚠ Patientkopplingsprotokoll',
    pairing_body: 'Patienter måste först genomföra MMAS-8-bedömningen för att få ett patient-ID. Detta ID kopplar MMAS-8-följsamhetsdata till PEACS-resultat för longitudinell analys över instrument.',
    patient_id_label: 'Patient-ID',
    patient_id_hint: '(fylls i automatiskt från MMAS-session · redigerbar)',
    submit_btn: 'Skicka in PEACS-bedömning →',
  },

  fi: {
    name: 'Finnish', native: 'Suomi', dir: 'ltr',
    base_intro: 'Esitän nyt joitakin kysymyksiä tottumuksista ja rutiineista, joita noudatat yleensä ottaessasi tätä lääkettä. Ajattele, mikä on sinulle tyypillistä (viimeisen kuukauden aikana). Oikeita tai vääriä vastauksia ei ole; vastaa niin rehellisesti kuin mahdollista.',
    mvmt_intro: 'Seuraavat kysymykset koskevat kokemuksiasi lääkkeen ottamisesta viimeisten 7 päivän aikana...',
    strata_intro: 'Sen jälkeen esitämme kysymyksiä tuesta, asumisolosuhteista, liikkumisesta, taloudesta ja hoidon ymmärtämisestä.',
    base_opts: ['Kyllä', 'Joskus', 'Ei'],
    mvmt_opts: ['Ei', 'Kyllä, kerran', 'Kyllä, useammin kuin kerran'],
    base_dim: 'BASE — Arkkitehtuuri- ja Käyttäytymistasapaino',
    base_period: 'Viimeiset 30 päivää · 7 kysymystä · Taparakenne',
    mvmt_dim: 'MVMT — Mitattava Minimaalinen Vaihtelu',
    mvmt_period: 'Viimeiset 7 päivää · 7 kysymystä · Aikatäsmällisyys',
    strata_dim: 'STRATA — Sosiaalinen, Suhteellinen ja Kontekstuaalinen Hoitoon Pääsy',
    strata_period: 'Kuluva vuosineljännes · 8 kysymystä · Neljäpisteankkurointi',
    bq1_title: 'Muistiarkkitehtuuri',         bq1: 'Muistatko luotettavasti ottaa lääkkeesi aikataulun mukaan, jopa stressaavina päivinä?',
    bq2_title: 'Rutiinistabiliteetti',         bq2: 'Ylläpidätkö johdonmukaista lääkerutiinia, kun päivittäinen aikataulusi muuttuu?',
    bq3_title: 'Oireenkestävyys',              bq3: 'Jos alat voida paremmin, otitko lääkkeesi silti täsmälleen kuten määrätty?',
    bq4_title: 'Mukautuva joustavuus',         bq4: 'Pystytkö sopeuttamaan päivittäistä rutiiniasi varmistaaksesi, että otat lääkkeesi, kun aikataulusi muuttuu?',
    bq5_title: 'Haittavaikutusten sietokyky', bq5: 'Jos sinulla on haittavaikutuksia, pystytkö jatkamaan hoitoa samalla kun hallitset niitä?',
    bq6_title: 'Käyttäytymisintegraatio',      bq6: 'Sopeutuuko lääkkeesi ottaminen luontevasti jokapäiväiseen elämääsi?',
    bq7_title: 'Valmistelurakenne',            bq7: 'Ylläpidätkö rutiinimaisesti lääkevarastoa niin, ettet jää ilman?',
    mq1_title: 'Aikajohdonmukaisuus',         mq1: 'Onko sinulla ollut vaikeuksia ottaa lääkettäsi samaan aikaan joka päivä viimeisten 7 päivän aikana?',
    mq2_title: 'Annossuoritus',               mq2: 'Oletko jättänyt annoksia väliin viimeisten 7 päivän aikana?',
    mq3_title: 'Oire­lähtöinen väliin jättö', mq3: 'Oletko lopettanut tai jättänyt lääkkeesi väliin viimeisten 7 päivän aikana, koska voit paremmin?',
    mq4_title: 'Haittavaikutusreaktio',       mq4: 'Oletko lopettanut tai jättänyt lääkkeesi väliin viimeisten 7 päivän aikana haittavaikutusten takia?',
    mq5_title: 'Ympäristöhäiriö',             mq5: 'Onko matkailu, poissaolo tai ympäristö aiheuttanut väliin jääneen annoksen viimeisten 7 päivän aikana?',
    mq6_title: 'Aikataulusopeutuminen',       mq6: 'Onko sinulla ollut vaikeuksia mukauttaa rutiiniasi lääkkeen ottamiseksi, kun aikataulusi muuttui viimeisten 7 päivän aikana?',
    mq7_title: 'Päivittäinen integraatio',    mq7: 'Tuntuiko lääkkeesi ottaminen viimeisten 7 päivän aikana taakalta tai sopeutuiko se luontevasti jokapäiväiseen elämään?',
    sq1_title: 'Ensisijainen tukihenkilö',    sq1: 'Kuka auttaa sinua muistamaan tai hallitsemaan lääkkeitäsi?',
    sq1_opts: ['Puoliso tai kumppani', 'Aikuinen lapsi tai muu perheenjäsen', 'Ystävä, naapuri tai hoitaja', 'Selviän itsenäisesti'],
    sq2_title: 'Yhteystiheys',                sq2: 'Kuinka usein sinulla on merkityksellinen yhteys perheeseen tai ystäviin?',
    sq2_opts: ['Päivittäin tai useita kertoja viikossa', 'Kerran viikossa', 'Muutaman kerran kuukaudessa', 'Harvoin tai lähes ei koskaan'],
    sq3_title: 'Asumistilanne',               sq3: 'Millainen nykyinen asumistilanteesi on?',
    sq3_opts: ['Asun puolison tai perheenjäsenten kanssa', 'Asun yksin mutta perhe tai tuki on lähellä', 'Tuettu tai hoitokodiasuminen', 'Asun yksin, perhe kaukana tai tilapäismajoituksessa'],
    sq4_title: 'Hätäverkosto',               sq4: 'Jos sinulla olisi lääketieteellinen hätätilanne, kuka tietäisi siitä ja voisi auttaa?',
    sq4_opts: ['Useita ihmisiä, jotka reagoisivat nopeasti', 'Vähintään yksi henkilö, joka reagoisi', 'Joku, joka lopulta huomaisi', 'Todennäköisesti ei kukaan tai ehdottomasti ei kukaan'],
    sq5_title: 'Liikkumismahdollisuudet',    sq5: 'Miten normaalisti pääset lääkärikäynneille tai apteekkiin?',
    sq5_opts: ['Ajан itse tai minulla on luotettava ja joustava kuljetus', 'Perhe tai ystävät kuljettavat, tai julkinen liikenne on saatavilla', 'Lääkäriajoneuvo, taksi tai vaikeasti hankittu', 'En pysty luotettavasti pääsemään käynneille tai apteekkiin'],
    sq6_title: 'Hoidon jatkuvuus',           sq6: 'Kuinka luotettavasti saat lääkkeitä ja osallistut seurantakäynneille?',
    sq6_opts: ['Lääkkeet ja käynnit aina saatavilla kun tarvitaan', 'Yleensä saatavilla satunnaisilla viivästymisillä tai vaikeuksilla', 'Usein viivästynyt tai vaikea saada', 'Epäluotettava; merkittäviä aukkoja lääke- tai hoitoon pääsyssä'],
    sq7_title: 'Tieto ja terveyslukutaito',  sq7: 'Kuinka hyvin ymmärrät ohjeet lääkkeidesi ottamiseen?',
    sq7_opts: ['Ymmärrän täysin ja voin selittää muille', 'Ymmärrän useimmat ohjeet', 'Ymmärrän osan, mutta minulla on kysymyksiä joistakin osista', 'Olen usein hämmentynyt tai epävarma siitä, miten ne otetaan'],
    sq8_title: 'Hoitoon sitoutumisen uskomukset', sq8: 'Missä määrin uskot lääkkeen olevan välttämätön ja auttavan sinua?',
    sq8_opts: ['Olen syvästi vakuuttunut siitä, että se on välttämätön ja tehokas', 'Yleensä uskon sen auttavan', 'En ole varma auttaako se', 'Epäilen usein sen tarpeellisuutta tai tehokkuutta'],
    pairing_title: '⚠ Potilaspariutumisprotokolla',
    pairing_body: 'Potilaiden on ensin suoritettava MMAS-8-arviointi saadakseen potilastunnuksen. Tämä tunnus yhdistää MMAS-8-hoitoon sitoutumistiedot PEACS-tuloksiin pitkittäisanalyysiä varten instrumenttien välillä.',
    patient_id_label: 'Potilastunnus',
    patient_id_hint: '(täytetään automaattisesti MMAS-istunnosta · muokattavissa)',
    submit_btn: 'Lähetä PEACS-arviointi →',
  },
  af: {
    name: 'Afrikaans', native: 'Afrikaans', dir: 'ltr',
    base_intro: 'Ek gaan nou \'n paar vrae stel oor die gewoontes en roetines wat jy gewoonlik volg wanneer jy hierdie medisyne neem. Dink na oor wat tipies vir jou is (in die afgelope maand). Daar is geen regte of verkeerde antwoorde nie; antwoord so eerlik as moontlik.',
    mvmt_intro: 'Die volgende vrae handel oor jou ervarings met die neem van medisyne in die afgelope 7 dae...',
    strata_intro: 'Dan stel ons vrae oor ondersteuning, behuisingsomstandighede, vervoer, finansies en begrip van die behandeling.',
    base_opts: ["Ja", "Soms", "Nee"],
    mvmt_opts: ["Nee", "Ja, een keer", "Ja, meer as een keer"],
    base_dim: 'BASE — Assessering van Argitektuur en Gedragstabiliteit',
    base_period: 'Afgelope 30 dae · 7 vrae · Gewoontestruktuur',
    mvmt_dim: 'MVMT — Meetbare Minimale Variasie',
    mvmt_period: 'Afgelope 7 dae · 7 vrae · Tydstrou',
    strata_dim: 'STRATA — Sosiale, Verhoudingsgerigte en Kontekstuele Behandelingstoegang',
    strata_period: 'Huidige kwartaal · 8 vrae · Vierptyksverankering',
    bq1_title: 'Geheueargitektuur',           bq1: 'Onthou jy betroubaar om jou medisyne volgens skedule te neem, selfs op stresvolle dae?',
    bq2_title: 'Roetinestabiliteit',           bq2: 'Handhaaf jy \'n konsekwente medisyne-roetine wanneer jou daaglikse skedule verander?',
    bq3_title: 'Simptoomveerkragtigheid',      bq3: 'As jy beter begin voel, neem jy steeds jou medisyne presies soos voorgeskryf?',
    bq4_title: 'Aanpasbare buigsaamheid',      bq4: 'Kan jy jou daaglikse roetine aanpas om seker te maak dat jy jou medisyne neem wanneer jou skedule verander?',
    bq5_title: 'Newe-effek toleransie',        bq5: 'As jy newe-effekte ervaar, kan jy steeds voortgaan met die behandeling terwyl jy daarmee omgaan?',
    bq6_title: 'Gedragsintegrasie',            bq6: 'Pas die neem van jou medisyne op \'n natuurlike manier in jou daaglikse lewe in?',
    bq7_title: 'Voorbereidingstruktuur',       bq7: 'Handhaaf jy roetinegewys \'n voorraad medisyne sodat jy nie daarsonder sit nie?',
    mq1_title: 'Tydskonsekwentheid',          mq1: 'Het jy die afgelope 7 dae gesukkel om jou medisyne elke dag op dieselfde tyd te neem?',
    mq2_title: 'Dosis-uitvoering',            mq2: 'Het jy die afgelope 7 dae dosisse gemis?',
    mq3_title: 'Simptoom-gedrewe oorslaap',   mq3: 'Het jy die afgelope 7 dae jou medisyne gestaak of gemis omdat jy beter gevoel het?',
    mq4_title: 'Newe-effek reaksie',          mq4: 'Het jy die afgelope 7 dae jou medisyne gestaak of gemis weens newe-effekte?',
    mq5_title: 'Omgewingsteuring',            mq5: 'Het reis, afwesigheid of omgewing die afgelope 7 dae \'n gemiste dosis veroorsaak?',
    mq6_title: 'Skedule-aanpassing',          mq6: 'Het jy die afgelope 7 dae gesukkel om jou roetine aan te pas om jou medisyne te neem toe jou skedule verander het?',
    mq7_title: 'Daaglikse integrasie',        mq7: 'Het die neem van jou medisyne die afgelope 7 dae soos \'n las gevoel of het dit nie op \'n natuurlike manier in die daaglikse lewe ingepas nie?',
    sq1_title: 'Primêre steunpersoon',        sq1: 'Wie help jou om jou medisyne te onthou of te bestuur?',
    sq1_opts: ["Eggenoot of vennoot", "Volwasse kind of ander familielid", "Vriend, buurman of versorger", "Ek red myself selfstandig"],
    sq2_title: 'Kontakfrekwensie',            sq2: 'Hoe gereeld het jy betekenisvolle kontak met familie of vriende?',
    sq2_opts: ["Daagliks of meerdere kere per week", "Een keer per week", "Paar keer per maand", "Selde of byna nooit"],
    sq3_title: 'Behuisingsituasie',           sq3: 'Hoe lyk jou huidige behuisingsituasie?',
    sq3_opts: ["Ek woon saam met eggenoot of familielede", "Ek woon alleen maar het familie of ondersteuning naby", "Beskermde woning of versorging", "Ek woon alleen met familie ver weg of in tydelike behuising"],
    sq4_title: 'Noodnetwerk',                 sq4: "As jy \'n mediese noodgeval sou hê, wie sou dit weet en kan help?",
    sq4_opts: ["Verskeie mense wat vinnig sou reageer", "Ten minste een persoon wat sou reageer", "Iemand wat uiteindelik sou agterkom", "Waarskynlik niemand of beslis niemand"],
    sq5_title: 'Vervoertoegang',              sq5: 'Hoe kom jy gewoonlik na doktersafsprake of die apteek?',
    sq5_opts: ["Ek bestuur self of het betroubare en buigsame vervoer", "Familie of vriende vervoer my, of openbare vervoer is beskikbaar", "Mediese vervoer, taxi of met moeite verkry", "Ek kan nie betroubaar na afsprake of die apteek kom nie"],
    sq6_title: 'Sorgkontinuïteit',            sq6: 'Hoe betroubaar kan jy medisyne kry en opvolg-afsprake bywoon?',
    sq6_opts: ["Medisyne en afsprake altyd beskikbaar wanneer nodig", "Gewoonlik beskikbaar met geleentelike vertragings of moeilikhede", "Dikwels vertraag of moeilik om te kry", "Onbetroubaar; beduidende gapings in toegang tot medisyne of opvolgsorg"],
    sq7_title: 'Inligting en gesondheidsgeletterdheid', sq7: 'Hoe goed verstaan jy die instruksies vir die neem van jou medisyne?',
    sq7_opts: ["Ek verstaan dit ten volle en kan dit aan ander verduidelik", "Ek verstaan die meeste instruksies", "Ek verstaan \'n deel, maar het vrae oor sommige dele", "Ek is dikwels verward of onseker oor hoe om dit te neem"],
    sq8_title: 'Nakoming oortuigings',        sq8: 'In welke mate glo jy dat die medisyne noodsaaklik is en jou sal help?',
    sq8_opts: ["Ek is diep oortuig dat dit noodsaaklik en effektief is", "Oor die algemeen dink ek dit help", "Ek is nie seker of dit help nie", "Ek twyfel dikwels aan die noodsaaklikheid of effektiwiteit daarvan"],
    pairing_title: '⚠ Pasiënt-koppelingsprotokol',
    pairing_body: "Pasiënte moet eers die MMAS-8-assessering voltooi om \'n pasiënt-ID te ontvang. Hierdie ID koppel MMAS-8-nakomingsdata aan PEACS-resultate vir longitudinale analise oor instrumente.",
    patient_id_label: 'Pasiënt-ID',
    patient_id_hint: '(outomaties ingevul uit MMAS-sessie · bewerkbaar)',
    submit_btn: 'Dien PEACS-assessering in →',
  },
  hr: {
    name: 'Croatian', native: 'Hrvatski', dir: 'ltr',
    base_intro: 'Sada ću vam postaviti nekoliko pitanja o navikama i rutinama koje obično slijedite pri uzimanju ovog lijeka. Razmislite o onome što je za vas tipično (u proteklom mjesecu). Nema točnih ili pogrešnih odgovora; odgovorite što iskrenije.',
    mvmt_intro: 'Sljedeća pitanja odnose se na vaša iskustva s uzimanjem lijekova u proteklih 7 dana...',
    strata_intro: 'Zatim ćemo postavljati pitanja o potpori, uvjetima stanovanja, prijevozu, financijama i razumijevanju liječenja.',
    base_opts: ['Da', 'Ponekad', 'Ne'],
    mvmt_opts: ['Ne', 'Da, jednom', 'Da, više puta'],
    base_dim: 'BASE — Procjena Arhitekture i Stabilnosti Ponašanja',
    base_period: 'Proteklih 30 dana · 7 pitanja · Struktura navika',
    mvmt_dim: 'MVMT — Mjerljiva Minimalna Varijacija',
    mvmt_period: 'Proteklih 7 dana · 7 pitanja · Vremenska dosljednost',
    strata_dim: 'STRATA — Socijalni, Relacijski i Kontekstualni Pristup Liječenju',
    strata_period: 'Tekuće tromjesečje · 8 pitanja · Četverostupanjsko sidrenje',
    bq1_title: 'Arhitektura pamćenja',        bq1: 'Pouzdano se sjećate uzimanja lijeka prema rasporedu, čak i na stresne dane?',
    bq2_title: 'Stabilnost rutine',           bq2: 'Održavate li dosljednu rutinu uzimanja lijekova kada se mijenja vaš dnevni raspored?',
    bq3_title: 'Otpornost na simptome',       bq3: 'Ako se počnete osjećati bolje, uzimate li i dalje lijek točno kako je propisano?',
    bq4_title: 'Prilagodljiva fleksibilnost', bq4: 'Možete li prilagoditi svoju dnevnu rutinu kako biste bili sigurni da uzimate lijek kada se raspored promijeni?',
    bq5_title: 'Tolerancija nuspojava',       bq5: 'Ako doživljavate nuspojave, možete li nastaviti s liječenjem dok se s njima nosite?',
    bq6_title: 'Bihevioralna integracija',    bq6: 'Uklapa li se uzimanje lijeka na prirodan način u vaš svakodnevni život?',
    bq7_title: 'Struktura pripreme',          bq7: 'Rutinski održavate zalihu lijekova kako vam ne bi ponestalo?',
    mq1_title: 'Vremenska dosljednost',       mq1: 'Jeste li imali poteškoća s uzimanjem lijeka u isto vrijeme svaki dan u proteklih 7 dana?',
    mq2_title: 'Izvršenje doze',              mq2: 'Jeste li propustili doze u proteklih 7 dana?',
    mq3_title: 'Simptomom potaknuto preskakanje', mq3: 'Jeste li u proteklih 7 dana prestali ili propustili lijek jer ste se osjećali bolje?',
    mq4_title: 'Reakcija na nuspojave',       mq4: 'Jeste li u proteklih 7 dana prestali ili propustili lijek zbog nuspojava?',
    mq5_title: 'Ometanje okoline',            mq5: 'Je li putovanje, odsutnost ili okolina uzrokovala propuštenu dozu u proteklih 7 dana?',
    mq6_title: 'Prilagodba rasporeda',        mq6: 'Jeste li imali poteškoća s prilagodbom rutine uzimanja lijeka kada se raspored promijenio u proteklih 7 dana?',
    mq7_title: 'Dnevna integracija',          mq7: 'Je li uzimanje lijeka u proteklih 7 dana djelovalo kao teret ili se nije prirodno uklopilo u svakodnevni život?',
    sq1_title: 'Primarna osoba potpore',      sq1: 'Tko vam pomaže pamtiti ili upravljati lijekovima?',
    sq1_opts: ['Supružnik ili partner', 'Odraslo dijete ili drugi član obitelji', 'Prijatelj, susjed ili skrbnik', 'Brinem se sam/a'],
    sq2_title: 'Učestalost kontakata',        sq2: 'Koliko često imate smislen kontakt s obitelji ili prijateljima?',
    sq2_opts: ['Svakodnevno ili nekoliko puta tjedno', 'Jednom tjedno', 'Nekoliko puta miesečno', 'Rijetko ili gotovo nikad'],
    sq3_title: 'Stambena situacija',          sq3: 'Kakva je vaša trenutna stambena situacija?',
    sq3_opts: ['Živim sa supružnikom ili članovima obitelji', 'Živim sam/a ali imam obitelj ili podršku u blizini', 'Zaštićeno ili njegovano stanovanje', 'Živim sam/a s obitelji daleko ili u privremenom smještaju'],
    sq4_title: 'Hitna mreža',                 sq4: 'Ako biste imali medicinski hitni slučaj, tko bi to znao i mogao pomoći?',
    sq4_opts: ['Nekoliko osoba koje bi brzo reagirale', 'Barem jedna osoba koja bi reagirala', 'Netko tko bi to na kraju primijetio', 'Vjerojatno nitko ili sigurno nitko'],
    sq5_title: 'Pristup prijevozu',           sq5: 'Kako normalno dolazite na liječničke preglede ili u ljekarnu?',
    sq5_opts: ['Vozim se sam/a ili imam pouzdan i fleksibilan prijevoz', 'Obitelj ili prijatelji me voze, ili je javni prijevoz dostupan', 'Medicinski prijevoz, taksi ili s teškoćama', 'Ne mogu pouzdano doći na preglede ili u ljekarnu'],
    sq6_title: 'Kontinuitet skrbi',           sq6: 'Koliko pouzdano možete dobiti lijekove i pohađati kontrolne preglede?',
    sq6_opts: ['Lijekovi i pregledi uvijek dostupni kad su potrebni', 'Obično dostupni s povremenim kašnjenjima ili poteškoćama', 'Često odgođeni ili teško dostupni', 'Nepouzdano; značajne praznine u pristupu lijekovima ili praćenju'],
    sq7_title: 'Informiranost i zdravstvena pismenost', sq7: 'Koliko dobro razumijete upute za uzimanje lijekova?',
    sq7_opts: ['U potpunosti razumijem i mogu objasniti drugima', 'Razumijem većinu uputa', 'Razumijem dio, ali imam pitanja o nekim dijelovima', 'Često sam zbunjen/a ili nesiguran/a kako ih uzimati'],
    sq8_title: 'Uvjerenja o pridržavanju',    sq8: 'U kojoj mjeri vjerujete da je lijek neophodan i da će vam pomoći?',
    sq8_opts: ['Duboko sam uvjeren/a da je neophodan i učinkovit', 'Općenito mislim da pomaže', 'Nisam siguran/a pomaže li', 'Često sumnjam u njegovu neophodnost ili učinkovitost'],
    pairing_title: '⚠ Protokol uparivanja pacijenta',
    pairing_body: 'Pacijenti moraju prvo završiti MMAS-8 procjenu kako bi primili ID pacijenta. Ovaj ID povezuje MMAS-8 podatke o adherenciji s PEACS rezultatima za longitudinalnu analizu između instrumenata.',
    patient_id_label: 'ID pacijenta',
    patient_id_hint: '(automatski popunjeno iz MMAS sesije · moguće urediti)',
    submit_btn: 'Pošalji PEACS procjenu →',
  },
  sq: {
    name: 'Albanian', native: 'Shqip', dir: 'ltr',
    base_intro: 'Tani do t\'ju bëj disa pyetje rreth zakoneve dhe rutinave që ndiqni zakonisht kur merrni këtë ilaç. Mendoni për atë që është tipike për ju (gjatë muajit të fundit). Nuk ka përgjigje të sakta ose të gabuara; përgjigjuni sa më sinqerisht.',
    mvmt_intro: 'Pyetjet e ardhshme kanë të bëjnë me përvojat tuaja të marrjes së ilaçeve gjatë 7 ditëve të fundit...',
    strata_intro: 'Pastaj do të bëjmë pyetje rreth mbështetjes, kushteve të strehimit, transportit, financave dhe kuptimit të trajtimit.',
    base_opts: ['Po', 'Ndonjëherë', 'Jo'],
    mvmt_opts: ['Jo', 'Po, një herë', 'Po, më shumë se një herë'],
    base_dim: 'BASE — Vlerësimi i Arkitekturës dhe Stabilitetit të Sjelljes',
    base_period: '30 ditët e fundit · 7 pyetje · Struktura e zakoneve',
    mvmt_dim: 'MVMT — Varianca Minimale e Matshme',
    mvmt_period: '7 ditët e fundit · 7 pyetje · Besnikëria ndaj kohës',
    strata_dim: 'STRATA — Qasja Sociale, Relacionale dhe Kontekstuale ndaj Trajtimit',
    strata_period: 'Tremujori aktual · 8 pyetje · Ankorimi me katër pikë',
    bq1_title: 'Arkitektura e kujtesës',      bq1: 'A mbani mend me besueshmëri të merrni ilaçin tuaj sipas orarit, edhe në ditët stresuese?',
    bq2_title: 'Stabiliteti i rutinës',        bq2: 'A mbani një rutinë të qëndrueshme të marrjes së ilaçeve kur orari juaj ditor ndryshon?',
    bq3_title: 'Rezistenca ndaj simptomave',  bq3: 'Nëse filloni të ndiheni mirë, a merrni ende ilaçin tuaj saktësisht siç është përshkruar?',
    bq4_title: 'Fleksibiliteti adaptiv',       bq4: 'A mund të përshtatni rutinën tuaj ditore për të siguruar që merrni ilaçin kur orari ndryshon?',
    bq5_title: 'Toleranca ndaj efekteve anësore', bq5: 'Nëse keni efekte anësore, a mund të vazhdoni trajtimin ndërsa i menaxhoni ato?',
    bq6_title: 'Integrimi i sjelljes',         bq6: 'A përshtatet marrja e ilaçit tuaj në mënyrë natyrale në jetën tuaj të përditshme?',
    bq7_title: 'Struktura e përgatitjes',      bq7: 'A mbani rutinisht një rezervë ilaçesh për të mos mbetur pa to?',
    mq1_title: 'Konsistenca kohore',           mq1: 'A keni pasur vështirësi të merrni ilaçin tuaj në të njëjtën kohë çdo ditë gjatë 7 ditëve të fundit?',
    mq2_title: 'Ekzekutimi i dozës',           mq2: 'A keni humbur doza gjatë 7 ditëve të fundit?',
    mq3_title: 'Kapërcimi i shkaktuar nga simptomat', mq3: 'A keni ndaluar ose humbur ilaçin tuaj gjatë 7 ditëve të fundit sepse ndiheshit mirë?',
    mq4_title: 'Reagimi ndaj efekteve anësore', mq4: 'A keni ndaluar ose humbur ilaçin tuaj gjatë 7 ditëve të fundit për shkak të efekteve anësore?',
    mq5_title: 'Ndërhyrja e mjedisit',         mq5: 'A ka shkaktuar udhëtimi, mungesa ose mjedisi një dozë të humbur gjatë 7 ditëve të fundit?',
    mq6_title: 'Përshtatja e orarit',          mq6: 'A keni pasur vështirësi të përshtatni rutinën tuaj për të marrë ilaçin kur orari ndryshoi gjatë 7 ditëve të fundit?',
    mq7_title: 'Integrimi ditor',              mq7: 'A u ndie marrja e ilaçit tuaj si një barrë gjatë 7 ditëve të fundit ose nuk u integrua natyrshëm në jetën e përditshme?',
    sq1_title: 'Personi primar mbështetës',    sq1: 'Kush ju ndihmon të mbani mend ose të menaxhoni ilaçet tuaja?',
    sq1_opts: ['Bashkëshort ose partner', 'Fëmijë i rritur ose anëtar tjetër i familjes', 'Mik, fqinj ose kujdestar', 'Kujdesem vetë'],
    sq2_title: 'Frekuenca e kontakteve',       sq2: 'Sa shpesh keni kontakt kuptimplotë me familjen ose miqtë?',
    sq2_opts: ['Çdo ditë ose disa herë në javë', 'Një herë në javë', 'Disa herë në muaj', 'Rrallë ose pothuajse kurrë'],
    sq3_title: 'Situata e strehimit',          sq3: 'Si është situata juaj aktuale e strehimit?',
    sq3_opts: ['Jetoj me bashkëshort ose anëtarë të familjes', 'Jetoj vetëm por kam familje ose mbështetje afër', 'Strehim i mbrojtur ose me kujdes', 'Jetoj vetëm me familje larg ose në strehim të përkohshëm'],
    sq4_title: 'Rrjeti i emergjencës',         sq4: 'Nëse do të kishit një emergjencë mjekësore, kush do ta dinte dhe mund të ndihmonte?',
    sq4_opts: ['Disa persona që do të reagonin shpejt', 'Të paktën një person që do të reagonte', 'Dikush që përfundimisht do ta vinte re', 'Ndoshta askush ose sigurisht askush'],
    sq5_title: 'Qasja në transport',           sq5: 'Si shkoni zakonisht te takimet mjekësore ose në farmaci?',
    sq5_opts: ['Drejtoj vetë ose kam transport të besueshëm dhe fleksibël', 'Familja ose miqtë më transportojnë, ose transporti publik është i disponueshëm', 'Transport mjekësor, taksi ose i marrë me vështirësi', 'Nuk mund të arrij me besueshmëri në takime ose në farmaci'],
    sq6_title: 'Vazhdimësia e kujdesit',       sq6: 'Sa me besueshmëri mund të merrni ilaçe dhe të merrni pjesë në takimet e ndjekjes?',
    sq6_opts: ['Ilaçet dhe takimet gjithmonë të disponueshme kur nevojiten', 'Zakonisht të disponueshme me vonesa ose vështirësi të herëpashershme', 'Shpesh të vonuara ose të vështira për t\'u siguruar', 'Jo të besueshme; boshllëqe të konsiderueshme në qasjen ndaj ilaçeve ose kujdesit pasues'],
    sq7_title: 'Informacioni dhe shkrim-leximi shëndetësor', sq7: 'Sa mirë i kuptoni udhëzimet për marrjen e ilaçeve tuaja?',
    sq7_opts: ['I kuptoj plotësisht dhe mund t\'ia shpjegoj të tjerëve', 'Kuptoj shumicën e udhëzimeve', 'Kuptoj një pjesë, por kam pyetje rreth disa pjesëve', 'Shpesh jam i/e hutuar ose i/e pasigurt se si t\'i marr'],
    sq8_title: 'Besimet rreth pajtueshmërisë', sq8: 'Në çfarë mase besoni se ilaçi është i nevojshëm dhe do t\'ju ndihmojë?',
    sq8_opts: ['Jam thellësisht i/e bindur se është i nevojshëm dhe efektiv', 'Në përgjithësi besoj se ndihmon', 'Nuk jam i/e sigurt nëse ndihmon', 'Shpesh dyshoj rreth nevojës ose efektivitetit të tij'],
    pairing_title: '⚠ Protokolli i çiftëzimit të pacientit',
    pairing_body: 'Pacientët duhet të plotësojnë së pari vlerësimin MMAS-8 për të marrë një ID pacienti. Ky ID lidh të dhënat e pajtueshmërisë MMAS-8 me rezultatet PEACS për analizë longitudinale ndër instrumente.',
    patient_id_label: 'ID i pacientit',
    patient_id_hint: '(plotësohet automatikisht nga sesioni MMAS · i redaktueshëm)',
    submit_btn: 'Dërgo vlerësimin PEACS →',
  },

  ru: {
    name: 'Russian', native: 'Русский', dir: 'ltr',
    base_intro: 'Сейчас я задам вам несколько вопросов о привычках и режимах, которых вы обычно придерживаетесь при приёме этого лекарства. Думайте о том, что для вас типично (за последний месяц). Правильных или неправильных ответов нет; отвечайте как можно честнее.',
    mvmt_intro: 'Следующие вопросы касаются вашего опыта приёма лекарств за последние 7 дней...',
    strata_intro: 'Затем мы зададим вопросы о поддержке, жилищных условиях, транспорте, финансах и понимании лечения.',
    base_opts: ['Да', 'Иногда', 'Нет'],
    mvmt_opts: ['Нет', 'Да, один раз', 'Да, более одного раза'],
    base_dim: 'BASE — Оценка Архитектуры и Стабильности Поведения',
    base_period: 'Последние 30 дней · 7 вопросов · Структура привычек',
    mvmt_dim: 'MVMT — Измеримая Минимальная Дисперсия',
    mvmt_period: 'Последние 7 дней · 7 вопросов · Временная точность',
    strata_dim: 'STRATA — Социальный, Реляционный и Контекстуальный Доступ к Лечению',
    strata_period: 'Текущий квартал · 8 вопросов · Четырёхуровневое якорение',
    bq1_title: 'Архитектура памяти',          bq1: 'Надёжно ли вы помните принять лекарство по расписанию, даже в напряжённые дни?',
    bq2_title: 'Стабильность режима',         bq2: 'Поддерживаете ли вы постоянный режим приёма лекарств при изменении распорядка дня?',
    bq3_title: 'Устойчивость к симптомам',    bq3: 'Если вы начинаете чувствовать себя лучше, всё равно ли вы принимаете лекарство точно так, как назначено?',
    bq4_title: 'Адаптивная гибкость',         bq4: 'Можете ли вы подстраивать распорядок дня, чтобы убедиться, что принимаете лекарство при изменении расписания?',
    bq5_title: 'Переносимость побочных эффектов', bq5: 'Если у вас возникают побочные эффекты, можете ли вы продолжать лечение, справляясь с ними?',
    bq6_title: 'Поведенческая интеграция',    bq6: 'Вписывается ли приём лекарства естественным образом в вашу повседневную жизнь?',
    bq7_title: 'Структура подготовки',        bq7: 'Регулярно ли вы поддерживаете запас лекарств, чтобы не остаться без них?',
    mq1_title: 'Временная последовательность', mq1: 'Возникали ли у вас трудности с приёмом лекарства в одно и то же время каждый день в течение последних 7 дней?',
    mq2_title: 'Выполнение дозировки',        mq2: 'Пропускали ли вы дозы в течение последних 7 дней?',
    mq3_title: 'Пропуск из-за симптомов',     mq3: 'Прекращали ли вы приём или пропускали лекарство в течение последних 7 дней, потому что чувствовали себя лучше?',
    mq4_title: 'Реакция на побочные эффекты', mq4: 'Прекращали ли вы приём или пропускали лекарство в течение последних 7 дней из-за побочных эффектов?',
    mq5_title: 'Средовые помехи',             mq5: 'Вызывали ли поездки, отсутствие или окружающая среда пропуск дозы в течение последних 7 дней?',
    mq6_title: 'Адаптация расписания',        mq6: 'Возникали ли трудности с адаптацией режима для приёма лекарства при изменении расписания в течение последних 7 дней?',
    mq7_title: 'Ежедневная интеграция',       mq7: 'Ощущался ли приём лекарства в течение последних 7 дней как бремя или не вписывался естественным образом в повседневную жизнь?',
    sq1_title: 'Основной помощник',           sq1: 'Кто помогает вам помнить о приёме лекарств или управлять ими?',
    sq1_opts: ['Супруг или партнёр', 'Взрослый ребёнок или другой член семьи', 'Друг, сосед или опекун', 'Справляюсь самостоятельно'],
    sq2_title: 'Частота контактов',           sq2: 'Как часто у вас есть значимый контакт с семьёй или друзьями?',
    sq2_opts: ['Ежедневно или несколько раз в неделю', 'Один раз в неделю', 'Несколько раз в месяц', 'Редко или почти никогда'],
    sq3_title: 'Жилищная ситуация',           sq3: 'Какова ваша текущая жилищная ситуация?',
    sq3_opts: ['Живу с супругом или членами семьи', 'Живу один(а), но семья или поддержка рядом', 'Защищённое или опекунское жильё', 'Живу один(а), семья далеко или во временном жилье'],
    sq4_title: 'Экстренная сеть',             sq4: 'Если у вас возникнет медицинская чрезвычайная ситуация, кто об этом узнает и сможет помочь?',
    sq4_opts: ['Несколько человек, которые быстро отреагируют', 'Хотя бы один человек, который отреагирует', 'Кто-то, кто в конечном итоге заметит', 'Скорее всего, никто или точно никто'],
    sq5_title: 'Доступность транспорта',      sq5: 'Как вы обычно добираетесь на врачебные приёмы или в аптеку?',
    sq5_opts: ['Езжу сам(а) или есть надёжный и гибкий транспорт', 'Семья или друзья везут меня, или доступен общественный транспорт', 'Медицинский транспорт, такси или с трудом', 'Не могу надёжно добраться на приёмы или в аптеку'],
    sq6_title: 'Непрерывность лечения',       sq6: 'Насколько надёжно вы можете получать лекарства и посещать контрольные визиты?',
    sq6_opts: ['Лекарства и визиты всегда доступны, когда нужно', 'Как правило, доступны с периодическими задержками', 'Часто откладываются или трудно доступны', 'Ненадёжно; существенные пробелы в доступе к лекарствам или наблюдению'],
    sq7_title: 'Информация и медицинская грамотность', sq7: 'Насколько хорошо вы понимаете инструкции по приёму лекарств?',
    sq7_opts: ['Понимаю полностью и могу объяснить другим', 'Понимаю большинство инструкций', 'Понимаю частично, но есть вопросы', 'Часто запутываюсь или не уверен(а), как принимать'],
    sq8_title: 'Убеждения относительно приверженности', sq8: 'В какой мере вы верите, что лекарство необходимо и поможет вам?',
    sq8_opts: ['Глубоко убеждён(а), что оно необходимо и эффективно', 'В целом считаю, что оно помогает', 'Не уверен(а), помогает ли оно', 'Часто сомневаюсь в его необходимости или эффективности'],
    pairing_title: '⚠ Протокол сопряжения пациента',
    pairing_body: 'Пациенты должны сначала пройти оценку MMAS-8, чтобы получить идентификатор пациента. Этот идентификатор связывает данные о приверженности MMAS-8 с результатами PEACS для лонгитюдного анализа между инструментами.',
    patient_id_label: 'ID пациента',
    patient_id_hint: '(автоматически заполняется из сессии MMAS · редактируемый)',
    submit_btn: 'Отправить оценку PEACS →',
  },
  uk: {
    name: 'Ukrainian', native: 'Українська', dir: 'ltr',
    base_intro: 'Зараз я поставлю вам кілька запитань про звички та режими, яких ви зазвичай дотримуєтеся при прийомі цього ліку. Думайте про те, що для вас типово (за останній місяць). Правильних чи неправильних відповідей немає; відповідайте якомога чесніше.',
    mvmt_intro: 'Наступні запитання стосуються вашого досвіду прийому ліків за останні 7 днів...',
    strata_intro: 'Потім ми поставимо запитання про підтримку, умови проживання, транспорт, фінанси та розуміння лікування.',
    base_opts: ['Так', 'Іноді', 'Ні'],
    mvmt_opts: ['Ні', 'Так, один раз', 'Так, більше одного разу'],
    base_dim: 'BASE — Оцінка Архітектури та Стабільності Поведінки',
    base_period: 'Останні 30 днів · 7 запитань · Структура звичок',
    mvmt_dim: 'MVMT — Вимірювана Мінімальна Дисперсія',
    mvmt_period: 'Останні 7 днів · 7 запитань · Часова точність',
    strata_dim: 'STRATA — Соціальний, Реляційний та Контекстуальний Доступ до Лікування',
    strata_period: 'Поточний квартал · 8 запитань · Чотирирівневе якорювання',
    bq1_title: 'Архітектура пам\'яті',        bq1: 'Чи надійно ви пам\'ятаєте прийняти ліки за розкладом, навіть у напружені дні?',
    bq2_title: 'Стабільність режиму',         bq2: 'Чи підтримуєте ви постійний режим прийому ліків, коли змінюється розпорядок дня?',
    bq3_title: 'Стійкість до симптомів',      bq3: 'Якщо ви починаєте почуватися краще, чи все одно приймаєте ліки точно так, як призначено?',
    bq4_title: 'Адаптивна гнучкість',         bq4: 'Чи можете ви пристосовувати розпорядок дня, щоб переконатися, що приймаєте ліки при зміні розкладу?',
    bq5_title: 'Переносимість побічних ефектів', bq5: 'Якщо у вас виникають побічні ефекти, чи можете ви продовжувати лікування, справляючись з ними?',
    bq6_title: 'Поведінкова інтеграція',      bq6: 'Чи вписується прийом ліків природним чином у ваше повсякденне життя?',
    bq7_title: 'Структура підготовки',        bq7: 'Чи регулярно ви підтримуєте запас ліків, щоб не залишитися без них?',
    mq1_title: 'Часова послідовність',        mq1: 'Чи виникали у вас труднощі з прийомом ліків в один і той же час щодня протягом останніх 7 днів?',
    mq2_title: 'Виконання дозування',         mq2: 'Чи пропускали ви дози протягом останніх 7 днів?',
    mq3_title: 'Пропуск через симптоми',      mq3: 'Чи припиняли ви прийом або пропускали ліки протягом останніх 7 днів, бо почувалися краще?',
    mq4_title: 'Реакція на побічні ефекти',   mq4: 'Чи припиняли ви прийом або пропускали ліки протягом останніх 7 днів через побічні ефекти?',
    mq5_title: 'Середовищні перешкоди',       mq5: 'Чи спричиняли подорожі, відсутність або оточення пропуск дози протягом останніх 7 днів?',
    mq6_title: 'Адаптація розкладу',          mq6: 'Чи виникали труднощі з адаптацією режиму для прийому ліків при зміні розкладу протягом останніх 7 днів?',
    mq7_title: 'Щоденна інтеграція',          mq7: 'Чи відчувався прийом ліків протягом останніх 7 днів як тягар або не вписувався природним чином у повсякденне життя?',
    sq1_title: 'Основний помічник',           sq1: 'Хто допомагає вам пам\'ятати про ліки або керувати ними?',
    sq1_opts: ['Чоловік/дружина або партнер', 'Дорослий(а) дитина або інший член сім\'ї', 'Друг, сусід або опікун', 'Справляюся самостійно'],
    sq2_title: 'Частота контактів',           sq2: 'Як часто у вас є значущий контакт із сім\'єю або друзями?',
    sq2_opts: ['Щодня або кілька разів на тиждень', 'Раз на тиждень', 'Кілька разів на місяць', 'Рідко або майже ніколи'],
    sq3_title: 'Житлова ситуація',            sq3: 'Яка ваша поточна житлова ситуація?',
    sq3_opts: ['Живу з чоловіком/дружиною або членами сім\'ї', 'Живу сам(а), але сім\'я або підтримка поруч', 'Захищене або опікунське житло', 'Живу сам(а), сім\'я далеко або у тимчасовому житлі'],
    sq4_title: 'Екстрена мережа',             sq4: 'Якщо у вас виникне медична надзвичайна ситуація, хто про це дізнається і зможе допомогти?',
    sq4_opts: ['Кілька людей, які швидко відреагують', 'Принаймні одна людина, яка відреагує', 'Хтось, хто зрештою помітить', 'Мабуть, ніхто або точно ніхто'],
    sq5_title: 'Доступність транспорту',      sq5: 'Як ви зазвичай дістаєтеся до лікарських прийомів або аптеки?',
    sq5_opts: ['Їджу сам(а) або є надійний і гнучкий транспорт', 'Сім\'я або друзі відвозять мене, або доступний громадський транспорт', 'Медичний транспорт, таксі або з труднощами', 'Не можу надійно дістатися до прийомів або аптеки'],
    sq6_title: 'Безперервність лікування',    sq6: 'Наскільки надійно ви можете отримувати ліки та відвідувати контрольні візити?',
    sq6_opts: ['Ліки та візити завжди доступні, коли потрібно', 'Як правило, доступні з періодичними затримками', 'Часто відкладаються або важкодоступні', 'Ненадійно; суттєві прогалини в доступі до ліків або спостереженні'],
    sq7_title: 'Інформація та медична грамотність', sq7: 'Наскільки добре ви розумієте інструкції щодо прийому ліків?',
    sq7_opts: ['Розумію повністю і можу пояснити іншим', 'Розумію більшість інструкцій', 'Розумію частково, але є запитання', 'Часто плутаюся або не впевнений(а), як приймати'],
    sq8_title: 'Переконання щодо прихильності', sq8: 'Якою мірою ви вірите, що ліки необхідні і допоможуть вам?',
    sq8_opts: ['Глибоко переконаний(а), що вони необхідні й ефективні', 'Загалом вважаю, що вони допомагають', 'Не впевнений(а), чи вони допомагають', 'Часто сумніваюся в їхній необхідності або ефективності'],
    pairing_title: '⚠ Протокол сполучення пацієнта',
    pairing_body: 'Пацієнти повинні спочатку пройти оцінку MMAS-8, щоб отримати ідентифікатор пацієнта. Цей ідентифікатор зв\'язує дані про прихильність MMAS-8 з результатами PEACS для лонгітюдного аналізу між інструментами.',
    patient_id_label: 'ID пацієнта',
    patient_id_hint: '(автоматично заповнюється із сесії MMAS · редаговано)',
    submit_btn: 'Надіслати оцінку PEACS →',
  },
  tr: {
    name: 'Turkish', native: 'Türkçe', dir: 'ltr',
    base_intro: 'Şimdi size bu ilacı alırken genellikle izlediğiniz alışkanlıklar ve rutinler hakkında birkaç soru soracağım. Sizin için tipik olan şeyi düşünün (son bir ay içinde). Doğru veya yanlış cevap yoktur; mümkün olduğunca dürüst cevaplayın.',
    mvmt_intro: 'Sonraki sorular son 7 gündeki ilaç alma deneyimlerinizle ilgilidir...',
    strata_intro: 'Ardından destek, yaşam koşulları, ulaşım, finans ve tedaviyi anlama hakkında sorular soracağız.',
    base_opts: ['Evet', 'Bazen', 'Hayır'],
    mvmt_opts: ['Hayır', 'Evet, bir kez', 'Evet, birden fazla kez'],
    base_dim: 'BASE — Mimari ve Davranış Stabilitesi Değerlendirmesi',
    base_period: 'Son 30 gün · 7 soru · Alışkanlık yapısı',
    mvmt_dim: 'MVMT — Ölçülebilir Minimum Varyans',
    mvmt_period: 'Son 7 gün · 7 soru · Zamansal sadakat',
    strata_dim: 'STRATA — Sosyal, İlişkisel ve Bağlamsal Tedaviye Erişim',
    strata_period: 'Mevcut çeyrek · 8 soru · Dört noktalı sabitleme',
    bq1_title: 'Bellek mimarisi',             bq1: 'Stresli günlerde bile programınıza göre ilacınızı almayı güvenilir biçimde hatırlıyor musunuz?',
    bq2_title: 'Rutin stabilitesi',            bq2: 'Günlük programınız değiştiğinde tutarlı bir ilaç rutini sürdürüyor musunuz?',
    bq3_title: 'Semptom direnci',              bq3: 'Daha iyi hissetmeye başladığınızda ilacınızı tam olarak reçete edildiği gibi almaya devam ediyor musunuz?',
    bq4_title: 'Uyarlanabilir esneklik',       bq4: 'Programınız değiştiğinde ilacınızı almayı garantilemek için günlük rutininizi uyarlayabiliyor musunuz?',
    bq5_title: 'Yan etki toleransı',           bq5: 'Yan etkiler yaşıyorsanız, bunlarla başa çıkarken tedaviye devam edebiliyor musunuz?',
    bq6_title: 'Davranışsal entegrasyon',      bq6: 'İlacınızı almak günlük yaşamınıza doğal olarak uyuyor mu?',
    bq7_title: 'Hazırlık yapısı',              bq7: 'İlaç stokunuzu bitirmemek için rutin olarak yedekte bulunduruyor musunuz?',
    mq1_title: 'Zamansal tutarlılık',          mq1: 'Son 7 günde ilacınızı her gün aynı saatte almakta güçlük çektiniz mi?',
    mq2_title: 'Doz uygulaması',              mq2: 'Son 7 günde doz atladınız mı?',
    mq3_title: 'Semptom kaynaklı atlama',      mq3: 'Son 7 günde daha iyi hissettiğiniz için ilacınızı bıraktınız veya atladınız mı?',
    mq4_title: 'Yan etki tepkisi',             mq4: 'Son 7 günde yan etkiler nedeniyle ilacınızı bıraktınız veya atladınız mı?',
    mq5_title: 'Çevresel aksaklık',            mq5: 'Son 7 günde seyahat, yokluk veya çevre bir doz atlamanıza yol açtı mı?',
    mq6_title: 'Program uyarlaması',           mq6: 'Son 7 günde programınız değiştiğinde ilacınızı almak için rutininizi uyarlamakta güçlük çektiniz mi?',
    mq7_title: 'Günlük entegrasyon',           mq7: 'Son 7 günde ilacınızı almak bir yük gibi hissettirdi mi veya günlük yaşama doğal olarak uyum sağlamadı mı?',
    sq1_title: 'Birincil destek kişisi',       sq1: 'İlaçlarınızı hatırlamanıza veya yönetmenize kim yardımcı oluyor?',
    sq1_opts: ['Eş veya partner', 'Yetişkin çocuk veya başka bir aile üyesi', 'Arkadaş, komşu veya bakıcı', 'Bağımsız olarak hallediyorum'],
    sq2_title: 'İletişim sıklığı',             sq2: 'Aile veya arkadaşlarınızla ne sıklıkla anlamlı iletişim kuruyorsunuz?',
    sq2_opts: ['Günlük veya haftada birkaç kez', 'Haftada bir kez', 'Ayda birkaç kez', 'Nadiren veya neredeyse hiç'],
    sq3_title: 'Yaşam durumu',                sq3: 'Mevcut yaşam durumunuz nasıl?',
    sq3_opts: ['Eş veya aile üyeleriyle birlikte yaşıyorum', 'Yalnız yaşıyorum ama yakınımda aile veya destek var', 'Korumalı veya bakım tesisinde yaşıyorum', 'Yalnız yaşıyorum, aile uzakta veya geçici konutta'],
    sq4_title: 'Acil ağı',                    sq4: 'Tıbbi bir acil durumunuz olsaydı, kim bilir ve yardım edebilirdi?',
    sq4_opts: ['Hızlı tepki verecek birkaç kişi', 'En az bir tepki verecek kişi', 'Eninde sonunda fark edecek biri', 'Muhtemelen kimse veya kesinlikle kimse'],
    sq5_title: 'Ulaşım erişimi',               sq5: 'Doktor randevularına veya eczaneye genellikle nasıl gidiyorsunuz?',
    sq5_opts: ['Kendim kullanıyorum veya güvenilir ve esnek ulaşımım var', 'Aile veya arkadaşlar götürüyor ya da toplu taşıma mevcut', 'Tıbbi taşıma, taksi veya güçlükle temin edilen', 'Randevulara veya eczaneye güvenilir şekilde gidemiyorum'],
    sq6_title: 'Bakım sürekliliği',            sq6: 'İlaçları ne kadar güvenilir şekilde temin edebiliyorsunuz ve takip randevularına katılabiliyorsunuz?',
    sq6_opts: ['İlaçlar ve randevular her zaman ihtiyaç duyulduğunda mevcut', 'Genellikle mevcut, zaman zaman gecikme veya güçlük var', 'Sık sık gecikiyor veya bulmak zor', 'Güvenilir değil; ilaç veya takip bakımına erişimde önemli boşluklar var'],
    sq7_title: 'Bilgi ve sağlık okuryazarlığı', sq7: 'İlaçlarınızı alma talimatlarını ne kadar iyi anlıyorsunuz?',
    sq7_opts: ['Tamamen anlıyorum ve başkalarına açıklayabilirim', 'Talimatların çoğunu anlıyorum', 'Bir kısmını anlıyorum ama bazı bölümler hakkında sorularım var', 'Çoğu zaman nasıl alacağım konusunda kafam karışık veya emin değilim'],
    sq8_title: 'Uyum inançları',               sq8: 'İlacın gerekli olduğuna ve size yardımcı olacağına ne ölçüde inanıyorsunuz?',
    sq8_opts: ['Gerekli ve etkili olduğuna derinden inanıyorum', 'Genel olarak yardımcı olduğunu düşünüyorum', 'Yardımcı olup olmadığından emin değilim', 'Gerekliliği veya etkinliği konusunda sık sık şüphe duyuyorum'],
    pairing_title: '⚠ Hasta eşleştirme protokolü',
    pairing_body: 'Hastaların hasta kimliği alabilmek için önce MMAS-8 değerlendirmesini tamamlamaları gerekir. Bu kimlik, enstrümanlar arası boylamsal analiz için MMAS-8 uyum verilerini PEACS sonuçlarıyla bağlar.',
    patient_id_label: 'Hasta kimliği',
    patient_id_hint: '(MMAS oturumundan otomatik doldurulur · düzenlenebilir)',
    submit_btn: 'PEACS değerlendirmesini gönder →',
  },

  ar: {
    name: 'Arabic', native: 'العربية', dir: 'rtl',
    base_intro: 'سأطرح عليك الآن بعض الأسئلة حول العادات والأنماط التي تتبعها عادةً عند تناول هذا الدواء. فكّر فيما هو معتاد بالنسبة لك (خلال الشهر الماضي). لا توجد إجابات صحيحة أو خاطئة؛ كن صادقاً قدر الإمكان.',
    mvmt_intro: 'تتعلق الأسئلة التالية بتجربتك في تناول الأدوية خلال السبعة أيام الماضية...',
    strata_intro: 'سنطرح بعد ذلك أسئلة حول الدعم وظروف السكن والنقل والمال وفهم العلاج.',
    base_opts: ['نعم', 'أحياناً', 'لا'],
    mvmt_opts: ['لا', 'نعم، مرة واحدة', 'نعم، أكثر من مرة'],
    base_dim: 'BASE — تقييم البنية واستقرار السلوك',
    base_period: 'آخر 30 يوماً · 7 أسئلة · بنية العادات',
    mvmt_dim: 'MVMT — التباين الأدنى القابل للقياس',
    mvmt_period: 'آخر 7 أيام · 7 أسئلة · الدقة الزمنية',
    strata_dim: 'STRATA — الوصول الاجتماعي والعلائقي والسياقي إلى العلاج',
    strata_period: 'الربع الحالي · 8 أسئلة · ترسيخ رباعي المستويات',
    bq1_title: 'بنية الذاكرة',                bq1: 'هل تتذكر بشكل موثوق تناول دوائك وفق الجدول الزمني حتى في الأيام المشغولة؟',
    bq2_title: 'استقرار الروتين',              bq2: 'هل تحافظ على روتين ثابت لتناول الدواء عند تغيّر جدولك اليومي؟',
    bq3_title: 'مقاومة الأعراض',              bq3: 'إذا بدأت تشعر بتحسّن، هل تواصل تناول دوائك تماماً كما وُصف لك؟',
    bq4_title: 'المرونة التكيّفية',            bq4: 'هل يمكنك تعديل روتينك اليومي لضمان تناول دوائك عند تغيّر جدولك؟',
    bq5_title: 'تحمّل الآثار الجانبية',        bq5: 'إذا عانيت من آثار جانبية، هل تستطيع الاستمرار في العلاج مع التعامل معها؟',
    bq6_title: 'التكامل السلوكي',              bq6: 'هل يندمج تناول دوائك بشكل طبيعي في حياتك اليومية؟',
    bq7_title: 'بنية الإعداد',                bq7: 'هل تحتفظ بانتظام باحتياطي من الدواء حتى لا تنفد كميته؟',
    mq1_title: 'الاتساق الزمني',              mq1: 'هل واجهت صعوبة في تناول دوائك في نفس الوقت كل يوم خلال الأيام السبعة الماضية؟',
    mq2_title: 'الالتزام بالجرعة',             mq2: 'هل فاتتك أي جرعات خلال الأيام السبعة الماضية؟',
    mq3_title: 'التخطي بسبب الأعراض',         mq3: 'هل أوقفت أو تخطيت الدواء خلال الأيام السبعة الماضية لأنك شعرت بتحسّن؟',
    mq4_title: 'رد الفعل تجاه الآثار الجانبية', mq4: 'هل أوقفت أو تخطيت الدواء خلال الأيام السبعة الماضية بسبب الآثار الجانبية؟',
    mq5_title: 'الاضطراب البيئي',             mq5: 'هل تسبّب السفر أو الغياب أو البيئة في تفويت جرعة خلال الأيام السبعة الماضية؟',
    mq6_title: 'تكيّف الجدول',               mq6: 'هل واجهت صعوبة في تكييف روتينك لتناول الدواء عند تغيّر جدولك خلال الأيام السبعة الماضية؟',
    mq7_title: 'التكامل اليومي',              mq7: 'هل شعرت أن تناول دوائك خلال الأيام السبعة الماضية كان عبئاً أو لم يندمج بشكل طبيعي في حياتك اليومية؟',
    sq1_title: 'مُعين رئيسي',                 sq1: 'من يساعدك على تذكّر دوائك أو إدارته؟',
    sq1_opts: ['زوج/زوجة أو شريك', 'ابن/ابنة بالغ أو فرد آخر من العائلة', 'صديق أو جار أو مُقدّم رعاية', 'أتعامل معه باستقلالية'],
    sq2_title: 'تكرار التواصل',               sq2: 'كم مرة تتواصل بشكل مجدٍ مع العائلة أو الأصدقاء؟',
    sq2_opts: ['يومياً أو عدة مرات في الأسبوع', 'مرة في الأسبوع', 'عدة مرات في الشهر', 'نادراً أو بالكاد'],
    sq3_title: 'وضع السكن',                   sq3: 'ما هو وضع سكنك الحالي؟',
    sq3_opts: ['أعيش مع زوج/زوجة أو أفراد العائلة', 'أعيش وحدي لكن العائلة أو الدعم قريب', 'سكن محمي أو رعاية مدارة', 'أعيش وحدي والعائلة بعيدة أو في مسكن مؤقت'],
    sq4_title: 'شبكة الطوارئ',               sq4: 'إذا تعرضت لطارئ طبي، من سيعلم بذلك ويستطيع المساعدة؟',
    sq4_opts: ['عدة أشخاص سيستجيبون بسرعة', 'شخص واحد على الأقل سيستجيب', 'شخص ما سيلاحظ في نهاية المطاف', 'على الأرجح لا أحد أو بالتأكيد لا أحد'],
    sq5_title: 'توافر وسائل النقل',            sq5: 'كيف تنتقل عادةً إلى مواعيدك الطبية أو الصيدلية؟',
    sq5_opts: ['أقود بنفسي أو لديّ وسيلة نقل موثوقة ومرنة', 'يأخذني أحد أفراد العائلة أو الأصدقاء، أو يتوفر نقل عام', 'نقل طبي أو سيارة أجرة أو بصعوبة', 'لا أستطيع الوصول بشكل موثوق إلى المواعيد أو الصيدلية'],
    sq6_title: 'استمرارية الرعاية',            sq6: 'ما مدى موثوقية قدرتك على الحصول على الأدوية وحضور المتابعات؟',
    sq6_opts: ['الأدوية والمواعيد متاحة دائماً عند الحاجة', 'متاحة بشكل عام مع تأخيرات أو صعوبات متفرقة', 'كثيراً ما تتأخر أو يصعب الحصول عليها', 'غير موثوقة؛ ثغرات كبيرة في الوصول إلى الأدوية أو المتابعة'],
    sq7_title: 'المعلومات والثقافة الصحية',    sq7: 'ما مدى فهمك لتعليمات تناول دوائك؟',
    sq7_opts: ['أفهمها تماماً ويمكنني شرحها للآخرين', 'أفهم معظم التعليمات', 'أفهم بعضها لكن لديّ أسئلة حول أجزاء', 'كثيراً ما أشعر بالارتباك أو عدم التأكد من طريقة التناول'],
    sq8_title: 'معتقدات الالتزام',             sq8: 'إلى أي مدى تؤمن بأن الدواء ضروري وسيفيدك؟',
    sq8_opts: ['مقتنع تماماً بأنه ضروري وفعّال', 'أعتقد بشكل عام أنه مفيد', 'لست متأكداً مما إذا كان يُفيد', 'كثيراً ما أشكّ في ضرورته أو فاعليته'],
    pairing_title: '⚠ بروتوكول ربط المريض',
    pairing_body: 'يجب على المرضى إكمال تقييم MMAS-8 أولاً للحصول على معرّف المريض. يربط هذا المعرّف بيانات الالتزام لـ MMAS-8 بنتائج PEACS للتحليل الطولي بين الأدوات.',
    patient_id_label: 'معرّف المريض',
    patient_id_hint: '(يُملأ تلقائياً من جلسة MMAS · قابل للتعديل)',
    submit_btn: 'إرسال تقييم PEACS →',
  },
  hi: {
    name: 'Hindi', native: 'हिन्दी', dir: 'ltr',
    base_intro: 'अब मैं आपसे कुछ सवाल पूछूँगा उन आदतों और दिनचर्याओं के बारे में जो आप आमतौर पर यह दवाई लेते समय अपनाते हैं। सोचिए कि आपके लिए क्या सामान्य है (पिछले एक महीने में)। कोई सही या गलत उत्तर नहीं है; जितना हो सके उतना ईमानदारी से जवाब दें।',
    mvmt_intro: 'अगले सवाल पिछले 7 दिनों में आपके दवाई लेने के अनुभव से संबंधित हैं...',
    strata_intro: 'फिर हम समर्थन, रहने की स्थिति, परिवहन, वित्त और उपचार की समझ के बारे में सवाल पूछेंगे।',
    base_opts: ['हाँ', 'कभी-कभी', 'नहीं'],
    mvmt_opts: ['नहीं', 'हाँ, एक बार', 'हाँ, एक से अधिक बार'],
    base_dim: 'BASE — आर्किटेक्चर और व्यवहार स्थिरता मूल्यांकन',
    base_period: 'पिछले 30 दिन · 7 प्रश्न · आदत संरचना',
    mvmt_dim: 'MVMT — मापने योग्य न्यूनतम भिन्नता',
    mvmt_period: 'पिछले 7 दिन · 7 प्रश्न · समय की सटीकता',
    strata_dim: 'STRATA — उपचार तक सामाजिक, संबंधात्मक और प्रासंगिक पहुँच',
    strata_period: 'वर्तमान तिमाही · 8 प्रश्न · चार-बिंदु लंगर',
    bq1_title: 'स्मृति संरचना',               bq1: 'क्या आप व्यस्त दिनों में भी अनुसूची के अनुसार दवाई लेना विश्वसनीय रूप से याद रख पाते हैं?',
    bq2_title: 'दिनचर्या की स्थिरता',          bq2: 'क्या आप अपनी दैनिक दिनचर्या बदलने पर भी दवाई लेने की निरंतर दिनचर्या बनाए रखते हैं?',
    bq3_title: 'लक्षण प्रतिरोध',              bq3: 'अगर आप बेहतर महसूस करने लगें, तो क्या आप तब भी दवाई ठीक उसी तरह लेते रहते हैं जैसा बताया गया है?',
    bq4_title: 'अनुकूली लचीलापन',             bq4: 'क्या आप अपनी दैनिक दिनचर्या को इस तरह अपना सकते हैं कि अनुसूची बदलने पर भी आप दवाई ले सकें?',
    bq5_title: 'दुष्प्रभाव सहनशीलता',          bq5: 'अगर आपको दुष्प्रभाव होते हैं, तो क्या आप उनसे निपटते हुए उपचार जारी रख सकते हैं?',
    bq6_title: 'व्यवहारिक एकीकरण',            bq6: 'क्या दवाई लेना आपके दैनिक जीवन में स्वाभाविक रूप से फिट बैठता है?',
    bq7_title: 'तैयारी संरचना',               bq7: 'क्या आप नियमित रूप से दवाई का भंडार बनाए रखते हैं ताकि वह खत्म न हो?',
    mq1_title: 'समय की निरंतरता',             mq1: 'क्या पिछले 7 दिनों में प्रत्येक दिन एक ही समय पर दवाई लेने में आपको कठिनाई हुई?',
    mq2_title: 'खुराक का पालन',              mq2: 'क्या पिछले 7 दिनों में कोई खुराक छूट गई?',
    mq3_title: 'लक्षण के कारण छोड़ना',         mq3: 'क्या पिछले 7 दिनों में आपने दवाई बंद की या छोड़ी क्योंकि आप बेहतर महसूस कर रहे थे?',
    mq4_title: 'दुष्प्रभाव की प्रतिक्रिया',     mq4: 'क्या पिछले 7 दिनों में आपने दुष्प्रभावों के कारण दवाई बंद की या छोड़ी?',
    mq5_title: 'पर्यावरणीय बाधा',             mq5: 'क्या पिछले 7 दिनों में यात्रा, अनुपस्थिति या वातावरण के कारण कोई खुराक छूट गई?',
    mq6_title: 'अनुसूची अनुकूलन',             mq6: 'क्या पिछले 7 दिनों में अनुसूची बदलने पर दवाई लेने के लिए अपनी दिनचर्या अनुकूलित करने में कठिनाई हुई?',
    mq7_title: 'दैनिक एकीकरण',               mq7: 'क्या पिछले 7 दिनों में दवाई लेना एक बोझ की तरह लगा या दैनिक जीवन में स्वाभाविक रूप से फिट नहीं हुआ?',
    sq1_title: 'प्राथमिक सहायक',              sq1: 'आपकी दवाई याद रखने या प्रबंधन में कौन मदद करता है?',
    sq1_opts: ['पति/पत्नी या साथी', 'वयस्क बच्चा या परिवार का अन्य सदस्य', 'मित्र, पड़ोसी या देखभालकर्ता', 'स्वतंत्र रूप से संभाल लेता/लेती हूँ'],
    sq2_title: 'संपर्क की आवृत्ति',            sq2: 'आप कितनी बार परिवार या मित्रों के साथ सार्थक संपर्क में रहते हैं?',
    sq2_opts: ['प्रतिदिन या सप्ताह में कई बार', 'सप्ताह में एक बार', 'महीने में कई बार', 'शायद ही कभी या लगभग कभी नहीं'],
    sq3_title: 'रहने की स्थिति',              sq3: 'आपकी वर्तमान रहने की स्थिति क्या है?',
    sq3_opts: ['पति/पत्नी या परिवार के सदस्यों के साथ', 'अकेले रहता/रहती हूँ लेकिन परिवार या सहायता पास में है', 'संरक्षित या प्रबंधित देखभाल आवास', 'अकेले रहता/रहती हूँ, परिवार दूर है या अस्थायी आवास में'],
    sq4_title: 'आपातकालीन नेटवर्क',           sq4: 'अगर आपको कोई चिकित्सा आपात स्थिति हो, तो कौन जानेगा और मदद कर सकेगा?',
    sq4_opts: ['कई लोग जो तुरंत प्रतिक्रिया देंगे', 'कम से कम एक व्यक्ति जो प्रतिक्रिया देगा', 'कोई जो अंततः ध्यान देगा', 'शायद कोई नहीं या निश्चित रूप से कोई नहीं'],
    sq5_title: 'परिवहन की उपलब्धता',           sq5: 'आप आमतौर पर डॉक्टर के अपॉइंटमेंट या फार्मेसी कैसे जाते हैं?',
    sq5_opts: ['खुद चलाता/चलाती हूँ या विश्वसनीय और लचीला परिवहन है', 'परिवार या मित्र ले जाते हैं, या सार्वजनिक परिवहन उपलब्ध है', 'चिकित्सा परिवहन, टैक्सी, या मुश्किल से', 'अपॉइंटमेंट या फार्मेसी तक विश्वसनीय रूप से नहीं पहुँच सकता/सकती'],
    sq6_title: 'देखभाल की निरंतरता',           sq6: 'आप कितनी विश्वसनीयता से दवाइयाँ प्राप्त कर सकते हैं और अनुवर्ती अपॉइंटमेंट में उपस्थित हो सकते हैं?',
    sq6_opts: ['दवाइयाँ और अपॉइंटमेंट हमेशा जरूरत पड़ने पर उपलब्ध हैं', 'आमतौर पर उपलब्ध हैं, कभी-कभी देरी या कठिनाई के साथ', 'अक्सर विलंबित होते हैं या प्राप्त करना मुश्किल है', 'अविश्वसनीय; दवाई या अनुवर्ती देखभाल तक पहुँच में महत्वपूर्ण अंतराल'],
    sq7_title: 'जानकारी और स्वास्थ्य साक्षरता',  sq7: 'आप दवाई लेने के निर्देशों को कितनी अच्छी तरह समझते हैं?',
    sq7_opts: ['पूरी तरह समझता/समझती हूँ और दूसरों को समझा सकता/सकती हूँ', 'अधिकांश निर्देश समझता/समझती हूँ', 'कुछ समझता/समझती हूँ लेकिन कुछ भागों के बारे में प्रश्न हैं', 'अक्सर भ्रमित हूँ या कैसे लेना है इसके बारे में अनिश्चित हूँ'],
    sq8_title: 'अनुपालन विश्वास',              sq8: 'आप कितना मानते हैं कि दवाई आवश्यक है और आपकी मदद करेगी?',
    sq8_opts: ['दृढ़ता से मानता/मानती हूँ कि यह आवश्यक और प्रभावी है', 'आमतौर पर मानता/मानती हूँ कि यह मदद करती है', 'यकीन नहीं कि यह मदद करती है या नहीं', 'अक्सर इसकी आवश्यकता या प्रभावशीलता पर संदेह होता है'],
    pairing_title: '⚠ रोगी युग्मन प्रोटोकॉल',
    pairing_body: 'रोगियों को रोगी ID प्राप्त करने के लिए पहले MMAS-8 मूल्यांकन पूरा करना होगा। यह ID इंटर-इंस्ट्रुमेंट लॉन्गिट्यूडिनल विश्लेषण के लिए MMAS-8 अनुपालन डेटा को PEACS परिणामों से जोड़ती है।',
    patient_id_label: 'रोगी ID',
    patient_id_hint: '(MMAS सत्र से स्वतः भरा जाता है · संपादन योग्य)',
    submit_btn: 'PEACS मूल्यांकन सबमिट करें →',
  },
  ur: {
    name: 'Urdu', native: 'اردو', dir: 'rtl',
    base_intro: 'اب میں آپ سے کچھ سوالات پوچھوں گا ان عادات اور معمولات کے بارے میں جو آپ عام طور پر یہ دوا لیتے وقت اپناتے ہیں۔ سوچیں کہ آپ کے لیے کیا معمول ہے (گزشتہ ایک مہینے میں)۔ کوئی صحیح یا غلط جواب نہیں ہے؛ جتنا ممکن ہو ایمانداری سے جواب دیں۔',
    mvmt_intro: 'اگلے سوالات گزشتہ 7 دنوں میں آپ کے دوا لینے کے تجربے سے متعلق ہیں...',
    strata_intro: 'اس کے بعد ہم سہارے، رہائشی حالات، نقل و حمل، مالیات اور علاج کی سمجھ کے بارے میں سوالات کریں گے۔',
    base_opts: ['ہاں', 'کبھی کبھی', 'نہیں'],
    mvmt_opts: ['نہیں', 'ہاں، ایک بار', 'ہاں، ایک سے زیادہ بار'],
    base_dim: 'BASE — فن تعمیر اور رویے کے استحکام کی تشخیص',
    base_period: 'گزشتہ 30 دن · 7 سوالات · عادت کا ڈھانچہ',
    mvmt_dim: 'MVMT — قابل پیمائش کم سے کم تغیر',
    mvmt_period: 'گزشتہ 7 دن · 7 سوالات · وقتی درستگی',
    strata_dim: 'STRATA — علاج تک سماجی، تعلقاتی اور سیاقی رسائی',
    strata_period: 'موجودہ سہ ماہی · 8 سوالات · چار نکاتی لنگر اندازی',
    bq1_title: 'یادداشت کا ڈھانچہ',            bq1: 'کیا آپ مصروف دنوں میں بھی شیڈول کے مطابق اپنی دوا لینا قابل اعتماد طریقے سے یاد رکھتے ہیں؟',
    bq2_title: 'معمول کا استحکام',              bq2: 'کیا آپ اپنے روزانہ کے معمول میں تبدیلی کے باوجود دوا لینے کا مستقل معمول برقرار رکھتے ہیں؟',
    bq3_title: 'علامات کے خلاف مزاحمت',         bq3: 'اگر آپ بہتر محسوس کرنے لگیں، تو کیا آپ تب بھی اپنی دوا بالکل اسی طرح لیتے رہتے ہیں جیسا تجویز کیا گیا ہے؟',
    bq4_title: 'موافق لچک',                    bq4: 'کیا آپ اپنے روزانہ کے معمول کو ایسے ڈھال سکتے ہیں کہ شیڈول بدلنے پر بھی آپ دوا لے سکیں؟',
    bq5_title: 'ضمنی اثرات کی برداشت',          bq5: 'اگر آپ کو ضمنی اثرات ہوں، تو کیا آپ ان سے نمٹتے ہوئے علاج جاری رکھ سکتے ہیں؟',
    bq6_title: 'رویاتی انضمام',                bq6: 'کیا دوا لینا آپ کی روزمرہ زندگی میں قدرتی طور پر فٹ بیٹھتا ہے؟',
    bq7_title: 'تیاری کا ڈھانچہ',              bq7: 'کیا آپ باقاعدگی سے دوا کا ذخیرہ رکھتے ہیں تاکہ وہ ختم نہ ہو؟',
    mq1_title: 'وقتی تسلسل',                  mq1: 'کیا گزشتہ 7 دنوں میں ہر روز ایک ہی وقت پر دوا لینے میں آپ کو دشواری ہوئی؟',
    mq2_title: 'خوراک کی پابندی',              mq2: 'کیا گزشتہ 7 دنوں میں کوئی خوراک چھوٹ گئی؟',
    mq3_title: 'علامات کی وجہ سے چھوڑنا',       mq3: 'کیا گزشتہ 7 دنوں میں آپ نے دوا بند کی یا چھوڑی کیونکہ آپ بہتر محسوس کر رہے تھے؟',
    mq4_title: 'ضمنی اثرات کا ردعمل',           mq4: 'کیا گزشتہ 7 دنوں میں ضمنی اثرات کی وجہ سے آپ نے دوا بند کی یا چھوڑی؟',
    mq5_title: 'ماحولیاتی رکاوٹ',              mq5: 'کیا گزشتہ 7 دنوں میں سفر، غیر حاضری یا ماحول کی وجہ سے کوئی خوراک چھوٹ گئی؟',
    mq6_title: 'شیڈول موافقت',                mq6: 'کیا گزشتہ 7 دنوں میں شیڈول بدلنے پر دوا لینے کے لیے اپنا معمول ڈھالنے میں دشواری ہوئی؟',
    mq7_title: 'روزانہ کا انضمام',              mq7: 'کیا گزشتہ 7 دنوں میں دوا لینا ایک بوجھ لگا یا روزمرہ زندگی میں قدرتی طور پر فٹ نہیں ہوا؟',
    sq1_title: 'بنیادی مددگار',                sq1: 'آپ کی دوا یاد رکھنے یا اس کا انتظام کرنے میں کون مدد کرتا ہے؟',
    sq1_opts: ['شوہر/بیوی یا ساتھی', 'بالغ بچہ یا خاندان کا دوسرا فرد', 'دوست، پڑوسی یا نگہبان', 'خود مستقل طور پر سنبھالتا/سنبھالتی ہوں'],
    sq2_title: 'رابطے کی تعدد',                sq2: 'آپ خاندان یا دوستوں کے ساتھ کتنی بار بامعنی رابطے میں رہتے ہیں؟',
    sq2_opts: ['روزانہ یا ہفتے میں کئی بار', 'ہفتے میں ایک بار', 'مہینے میں کئی بار', 'کبھی کبھار یا تقریباً کبھی نہیں'],
    sq3_title: 'رہائشی صورتحال',               sq3: 'آپ کی موجودہ رہائشی صورتحال کیا ہے؟',
    sq3_opts: ['شوہر/بیوی یا خاندان کے افراد کے ساتھ', 'اکیلے رہتا/رہتی ہوں لیکن خاندان یا سہارا قریب ہے', 'محفوظ یا نگرانی شدہ رہائش', 'اکیلے رہتا/رہتی ہوں، خاندان دور ہے یا عارضی رہائش میں'],
    sq4_title: 'ہنگامی نیٹ ورک',               sq4: 'اگر آپ کو طبی ہنگامی صورتحال پیش آئے، تو کون جانے گا اور مدد کر سکے گا؟',
    sq4_opts: ['کئی لوگ جو فوری ردعمل دیں گے', 'کم از کم ایک شخص جو ردعمل دے گا', 'کوئی جو بالآخر نوٹس کرے گا', 'شاید کوئی نہیں یا یقیناً کوئی نہیں'],
    sq5_title: 'نقل و حمل کی دستیابی',          sq5: 'آپ عام طور پر ڈاکٹر کی ملاقاتوں یا دواخانے کیسے جاتے ہیں؟',
    sq5_opts: ['خود گاڑی چلاتا/چلاتی ہوں یا قابل اعتماد اور لچکدار نقل و حمل ہے', 'خاندان یا دوست لے جاتے ہیں، یا عوامی نقل و حمل دستیاب ہے', 'طبی نقل و حمل، ٹیکسی، یا مشکل سے', 'ملاقاتوں یا دواخانے تک قابل اعتماد طریقے سے نہیں پہنچ سکتا/سکتی'],
    sq6_title: 'نگہداشت کا تسلسل',             sq6: 'آپ کتنے قابل اعتماد طریقے سے دوائیں حاصل کر سکتے ہیں اور فالو اپ ملاقاتوں میں شامل ہو سکتے ہیں؟',
    sq6_opts: ['دوائیں اور ملاقاتیں ہمیشہ ضرورت پر دستیاب ہیں', 'عموماً دستیاب، کبھی کبھار تاخیر یا دشواری کے ساتھ', 'اکثر تاخیر ہوتی ہے یا حاصل کرنا مشکل ہے', 'غیر قابل اعتماد؛ دوا یا فالو اپ نگہداشت تک رسائی میں اہم خلاء'],
    sq7_title: 'معلومات اور صحت خواندگی',       sq7: 'آپ دوا لینے کی ہدایات کتنی اچھی طرح سمجھتے ہیں؟',
    sq7_opts: ['مکمل طور پر سمجھتا/سمجھتی ہوں اور دوسروں کو بتا سکتا/سکتی ہوں', 'زیادہ تر ہدایات سمجھتا/سمجھتی ہوں', 'کچھ سمجھتا/سمجھتی ہوں لیکن کچھ حصوں کے بارے میں سوالات ہیں', 'اکثر الجھن میں رہتا/رہتی ہوں یا یقین نہیں کہ کیسے لوں'],
    sq8_title: 'پابندی کے عقائد',              sq8: 'آپ کتنا یقین رکھتے ہیں کہ دوا ضروری ہے اور آپ کی مدد کرے گی؟',
    sq8_opts: ['پختہ یقین ہے کہ یہ ضروری اور مؤثر ہے', 'عموماً سمجھتا/سمجھتی ہوں کہ یہ مدد کرتی ہے', 'یقین نہیں کہ یہ مدد کرتی ہے یا نہیں', 'اکثر اس کی ضرورت یا مؤثریت پر شک ہوتا ہے'],
    pairing_title: '⚠ مریض جوڑی پروٹوکول',
    pairing_body: 'مریضوں کو مریض ID حاصل کرنے کے لیے پہلے MMAS-8 تشخیص مکمل کرنا ہوگا۔ یہ ID بین الآلاتی طولانی تجزیے کے لیے MMAS-8 کے پابندی ڈیٹا کو PEACS نتائج سے جوڑتی ہے۔',
    patient_id_label: 'مریض ID',
    patient_id_hint: '(MMAS سیشن سے خود بخود بھرا جاتا ہے · قابل ترمیم)',
    submit_btn: 'PEACS تشخیص جمع کریں →',
  },
  bn: {
    name: 'Bengali', native: 'বাংলা', dir: 'ltr',
    base_intro: 'এখন আমি আপনাকে এই ওষুধ খাওয়ার সময় আপনি সাধারণত যে অভ্যাস ও রুটিন অনুসরণ করেন সে সম্পর্কে কিছু প্রশ্ন করব। ভাবুন আপনার জন্য কোনটি স্বাভাবিক (গত এক মাসে)। কোনো সঠিক বা ভুল উত্তর নেই; যতটা সম্ভব সৎভাবে উত্তর দিন।',
    mvmt_intro: 'পরবর্তী প্রশ্নগুলো গত ৭ দিনে আপনার ওষুধ খাওয়ার অভিজ্ঞতার সাথে সম্পর্কিত...',
    strata_intro: 'এরপর আমরা সহায়তা, বাসস্থানের অবস্থা, পরিবহন, অর্থ এবং চিকিৎসা বোঝার বিষয়ে প্রশ্ন করব।',
    base_opts: ['হ্যাঁ', 'কখনো কখনো', 'না'],
    mvmt_opts: ['না', 'হ্যাঁ, একবার', 'হ্যাঁ, একাধিকবার'],
    base_dim: 'BASE — আর্কিটেকচার এবং আচরণগত স্থিতিশীলতা মূল্যায়ন',
    base_period: 'গত ৩০ দিন · ৭টি প্রশ্ন · অভ্যাসের কাঠামো',
    mvmt_dim: 'MVMT — পরিমাপযোগ্য ন্যূনতম বিচ্যুতি',
    mvmt_period: 'গত ৭ দিন · ৭টি প্রশ্ন · সময়গত নির্ভুলতা',
    strata_dim: 'STRATA — চিকিৎসায় সামাজিক, সম্পর্কীয় এবং প্রাসঙ্গিক প্রবেশাধিকার',
    strata_period: 'বর্তমান ত্রৈমাসিক · ৮টি প্রশ্ন · চার-বিন্দু নোঙর',
    bq1_title: 'স্মৃতি কাঠামো',               bq1: 'ব্যস্ত দিনেও কি আপনি সময়সূচি অনুযায়ী ওষুধ খাওয়া নির্ভরযোগ্যভাবে মনে রাখতে পারেন?',
    bq2_title: 'রুটিনের স্থিতিশীলতা',          bq2: 'দৈনিক রুটিন পরিবর্তন হলেও কি আপনি ওষুধ খাওয়ার ধারাবাহিক রুটিন বজায় রাখেন?',
    bq3_title: 'লক্ষণ প্রতিরোধ',              bq3: 'আপনি যদি ভালো অনুভব করতে শুরু করেন, তবুও কি নির্ধারিতভাবে ওষুধ খেতে থাকেন?',
    bq4_title: 'অভিযোজিত নমনীয়তা',           bq4: 'সময়সূচি পরিবর্তন হলে ওষুধ খাওয়া নিশ্চিত করতে কি আপনি আপনার দৈনিক রুটিন মানিয়ে নিতে পারেন?',
    bq5_title: 'পার্শ্বপ্রতিক্রিয়া সহনশীলতা',   bq5: 'পার্শ্বপ্রতিক্রিয়া হলে সেগুলো সামলে চিকিৎসা চালিয়ে যেতে পারেন?',
    bq6_title: 'আচরণগত একীভূতকরণ',           bq6: 'ওষুধ খাওয়া কি আপনার দৈনন্দিন জীবনে স্বাভাবিকভাবে মিলে যায়?',
    bq7_title: 'প্রস্তুতির কাঠামো',             bq7: 'ওষুধের মজুত শেষ না হয় সেজন্য কি আপনি নিয়মিত রিজার্ভ রাখেন?',
    mq1_title: 'সময়গত ধারাবাহিকতা',           mq1: 'গত ৭ দিনে প্রতিদিন একই সময়ে ওষুধ খেতে কি কষ্ট হয়েছে?',
    mq2_title: 'ডোজ পালন',                   mq2: 'গত ৭ দিনে কোনো ডোজ বাদ গেছে কি?',
    mq3_title: 'লক্ষণের কারণে এড়ানো',          mq3: 'গত ৭ দিনে ভালো অনুভব করায় কি ওষুধ বন্ধ করেছেন বা বাদ দিয়েছেন?',
    mq4_title: 'পার্শ্বপ্রতিক্রিয়ার প্রতিক্রিয়া',  mq4: 'গত ৭ দিনে পার্শ্বপ্রতিক্রিয়ার কারণে ওষুধ বন্ধ করেছেন বা বাদ দিয়েছেন?',
    mq5_title: 'পরিবেশগত বাধা',               mq5: 'গত ৭ দিনে ভ্রমণ, অনুপস্থিতি বা পরিবেশের কারণে কোনো ডোজ বাদ গেছে?',
    mq6_title: 'সময়সূচি অভিযোজন',             mq6: 'গত ৭ দিনে সময়সূচি পরিবর্তনে ওষুধ খাওয়ার জন্য রুটিন মানিয়ে নিতে কষ্ট হয়েছে?',
    mq7_title: 'দৈনিক একীভূতকরণ',             mq7: 'গত ৭ দিনে ওষুধ খাওয়া কি বোঝা মনে হয়েছে বা দৈনন্দিন জীবনে স্বাভাবিকভাবে মেলেনি?',
    sq1_title: 'প্রাথমিক সহায়ক',              sq1: 'আপনার ওষুধ মনে রাখতে বা পরিচালনা করতে কে সাহায্য করেন?',
    sq1_opts: ['স্বামী/স্ত্রী বা সঙ্গী', 'প্রাপ্তবয়স্ক সন্তান বা অন্য পরিবারের সদস্য', 'বন্ধু, প্রতিবেশী বা যত্নশীল', 'স্বাধীনভাবে সামলাই'],
    sq2_title: 'যোগাযোগের ঘনত্ব',              sq2: 'আপনি পরিবার বা বন্ধুদের সাথে কত ঘন ঘন অর্থপূর্ণ যোগাযোগে থাকেন?',
    sq2_opts: ['প্রতিদিন বা সপ্তাহে কয়েকবার', 'সপ্তাহে একবার', 'মাসে কয়েকবার', 'কদাচিৎ বা প্রায় কখনো না'],
    sq3_title: 'বাসস্থানের অবস্থা',            sq3: 'আপনার বর্তমান বাসস্থানের অবস্থা কেমন?',
    sq3_opts: ['স্বামী/স্ত্রী বা পরিবারের সদস্যদের সাথে', 'একা থাকি কিন্তু পরিবার বা সহায়তা কাছে', 'সংরক্ষিত বা ব্যবস্থাপিত যত্নের আবাসন', 'একা থাকি, পরিবার দূরে বা অস্থায়ী আবাসে'],
    sq4_title: 'জরুরি নেটওয়ার্ক',             sq4: 'চিকিৎসা জরুরি অবস্থায় কে জানবেন এবং সাহায্য করতে পারবেন?',
    sq4_opts: ['কয়েকজন যারা দ্রুত সাড়া দেবেন', 'অন্তত একজন যিনি সাড়া দেবেন', 'কেউ যিনি শেষ পর্যন্ত লক্ষ্য করবেন', 'সম্ভবত কেউ না বা নিশ্চিতভাবে কেউ না'],
    sq5_title: 'পরিবহন সুবিধা',               sq5: 'আপনি সাধারণত ডাক্তারের অ্যাপয়েন্টমেন্ট বা ফার্মেসিতে কীভাবে যান?',
    sq5_opts: ['নিজে চালাই বা নির্ভরযোগ্য এবং নমনীয় পরিবহন আছে', 'পরিবার বা বন্ধু নিয়ে যান, বা গণপরিবহন আছে', 'চিকিৎসা পরিবহন, ট্যাক্সি, বা কষ্টে', 'অ্যাপয়েন্টমেন্ট বা ফার্মেসিতে নির্ভরযোগ্যভাবে পৌঁছাতে পারি না'],
    sq6_title: 'সেবার ধারাবাহিকতা',            sq6: 'আপনি কতটা নির্ভরযোগ্যভাবে ওষুধ পেতে এবং ফলো-আপ অ্যাপয়েন্টমেন্টে যেতে পারেন?',
    sq6_opts: ['ওষুধ এবং অ্যাপয়েন্টমেন্ট সর্বদা প্রয়োজনে পাওয়া যায়', 'সাধারণত পাওয়া যায়, মাঝে মাঝে বিলম্ব বা সমস্যা', 'প্রায়ই বিলম্বিত হয় বা পাওয়া কঠিন', 'অনির্ভরযোগ্য; ওষুধ বা ফলো-আপ সেবায় উল্লেখযোগ্য ফাঁক'],
    sq7_title: 'তথ্য ও স্বাস্থ্য সাক্ষরতা',     sq7: 'আপনি ওষুধ খাওয়ার নির্দেশাবলী কতটা ভালো বোঝেন?',
    sq7_opts: ['পুরোপুরি বুঝি এবং অন্যদের বোঝাতে পারি', 'বেশিরভাগ নির্দেশাবলী বুঝি', 'কিছুটা বুঝি কিন্তু কিছু অংশ নিয়ে প্রশ্ন আছে', 'প্রায়ই বিভ্রান্ত থাকি বা কীভাবে খাব জানি না'],
    sq8_title: 'মেনে চলার বিশ্বাস',             sq8: 'আপনি কতটা বিশ্বাস করেন যে ওষুধটি প্রয়োজনীয় এবং আপনাকে সাহায্য করবে?',
    sq8_opts: ['দৃঢ়ভাবে বিশ্বাস করি এটি প্রয়োজনীয় এবং কার্যকর', 'সাধারণত মনে করি এটি সাহায্য করে', 'নিশ্চিত নই এটি সাহায্য করে কিনা', 'প্রায়ই এর প্রয়োজনীয়তা বা কার্যকারিতা নিয়ে সংশয় থাকে'],
    pairing_title: '⚠ রোগী যুগলবন্দি প্রোটোকল',
    pairing_body: 'রোগী ID পেতে রোগীদের প্রথমে MMAS-8 মূল্যায়ন সম্পন্ন করতে হবে। এই ID ইন্টার-ইন্সট্রুমেন্ট দীর্ঘায়িত বিশ্লেষণের জন্য MMAS-8 আনুগত্য ডেটাকে PEACS ফলাফলের সাথে সংযুক্ত করে।',
    patient_id_label: 'রোগী ID',
    patient_id_hint: '(MMAS সেশন থেকে স্বয়ংক্রিয়ভাবে পূরণ হয় · সম্পাদনযোগ্য)',
    submit_btn: 'PEACS মূল্যায়ন জমা দিন →',
  },

  ja: {
    name: 'Japanese', native: '日本語', dir: 'ltr',
    base_intro: 'これから、この薬を服用する際に通常どのような習慣やルーティンを取っているかについていくつか質問します。（過去1か月間の）あなたにとって典型的なことを考えてください。正しい答えも間違った答えもありません。できるだけ正直に答えてください。',
    mvmt_intro: '次の質問は、過去7日間の服薬経験に関するものです...',
    strata_intro: '次に、サポート、居住状況、交通手段、財政、治療の理解に関する質問をします。',
    base_opts: ['はい', '時々', 'いいえ'],
    mvmt_opts: ['いいえ', 'はい、1回', 'はい、複数回'],
    base_dim: 'BASE — アーキテクチャおよび行動安定性評価',
    base_period: '過去30日間 · 7問 · 習慣の構造',
    mvmt_dim: 'MVMT — 測定可能な最小分散',
    mvmt_period: '過去7日間 · 7問 · 時間的な精度',
    strata_dim: 'STRATA — 治療への社会的・関係的・文脈的アクセス',
    strata_period: '現在の四半期 · 8問 · 4段階アンカリング',
    bq1_title: '記憶のアーキテクチャ',           bq1: '忙しい日でも、スケジュール通りに薬を飲むことを確実に覚えていられますか？',
    bq2_title: 'ルーティンの安定性',             bq2: '日々のスケジュールが変わっても、一貫した服薬ルーティンを維持できますか？',
    bq3_title: '症状への抵抗力',                bq3: '体調が良くなり始めても、処方通りに薬を飲み続けていますか？',
    bq4_title: '適応的柔軟性',                 bq4: 'スケジュールが変わったときに、薬を飲めるように日常のルーティンを調整できますか？',
    bq5_title: '副作用への耐性',                bq5: '副作用が出た場合でも、それに対処しながら治療を続けられますか？',
    bq6_title: '行動的統合',                   bq6: '薬を飲むことが日常生活に自然に溶け込んでいますか？',
    bq7_title: '準備の構造',                   bq7: '薬が切れないように定期的にストックを確保していますか？',
    mq1_title: '時間的一貫性',                 mq1: '過去7日間、毎日同じ時間に薬を飲むのが難しかったですか？',
    mq2_title: '用量の遵守',                   mq2: '過去7日間、服薬を飛ばしてしまいましたか？',
    mq3_title: '症状による飛ばし',              mq3: '過去7日間、体調が良くなったため薬をやめたり飛ばしたりしましたか？',
    mq4_title: '副作用への反応',               mq4: '過去7日間、副作用のために薬をやめたり飛ばしたりしましたか？',
    mq5_title: '環境的障害',                   mq5: '過去7日間、旅行・外出・環境によって服薬を飛ばしてしまいましたか？',
    mq6_title: 'スケジュールの適応',            mq6: '過去7日間、スケジュールが変わった際に服薬のためにルーティンを調整するのが難しかったですか？',
    mq7_title: '日常的統合',                   mq7: '過去7日間、服薬が負担に感じたり、日常生活に自然に溶け込まなかったりしましたか？',
    sq1_title: '主なサポーター',               sq1: '薬を覚えたり管理したりするのに誰が助けてくれますか？',
    sq1_opts: ['配偶者またはパートナー', '成人の子どもまたは他の家族', '友人、近所の人、または介護者', '自分で自立して管理している'],
    sq2_title: '連絡の頻度',                   sq2: '家族や友人と意味のある接触をどのくらいの頻度でしていますか？',
    sq2_opts: ['毎日または週に数回', '週に1回', '月に数回', 'めったにない、またはほとんどない'],
    sq3_title: '居住状況',                    sq3: '現在の居住状況はどうですか？',
    sq3_opts: ['配偶者や家族と同居', '一人暮らしだが、家族やサポートが近くにいる', '保護された施設または管理ケア住宅', '一人暮らしで、家族が遠方または仮住まい'],
    sq4_title: '緊急ネットワーク',              sq4: '医療上の緊急事態が発生した場合、誰が知り、助けてくれますか？',
    sq4_opts: ['すぐに対応できる複数の人', '少なくとも1人が対応してくれる', 'やがて気づいてくれる人', 'おそらく誰もいない、または確実に誰もいない'],
    sq5_title: '交通手段',                    sq5: '通常、受診や薬局へはどのように行きますか？',
    sq5_opts: ['自分で運転、または信頼できる柔軟な交通手段がある', '家族や友人が送ってくれる、または公共交通機関が使える', '医療用交通、タクシー、または苦労して', '受診や薬局に確実に行けない'],
    sq6_title: 'ケアの継続性',                 sq6: '薬を確実に入手し、フォローアップの受診に出席できますか？',
    sq6_opts: ['薬と受診はいつでも必要なときに利用可能', '通常は利用可能で、時々遅延や困難がある', '頻繁に遅延するか、入手が難しい', '信頼性が低い；薬やフォローアップへのアクセスに大きな差がある'],
    sq7_title: '情報とヘルスリテラシー',         sq7: '薬の服用指示をどの程度理解していますか？',
    sq7_opts: ['完全に理解しており、他の人にも説明できる', 'ほとんどの指示を理解している', '一部理解しているが、いくつかの部分については質問がある', '服用方法についてよく混乱するか、不確かである'],
    sq8_title: 'アドヒアランスに関する信念',      sq8: '薬が必要であり、助けになると信じていますか？',
    sq8_opts: ['必要かつ効果的であると強く信じている', '一般的に役立つと思う', '役立つかどうか確信が持てない', '必要性や有効性についてしばしば疑念がある'],
    pairing_title: '⚠ 患者ペアリングプロトコル',
    pairing_body: '患者は患者IDを取得するために、まずMMAX-8評価を完了する必要があります。このIDは、ツール間の縦断分析のためにMMAS-8のアドヒアランスデータとPEACSの結果を紐付けます。',
    patient_id_label: '患者ID',
    patient_id_hint: '（MMASセッションから自動入力 · 編集可能）',
    submit_btn: 'PEACS評価を送信する →',
  },
  ko: {
    name: 'Korean', native: '한국어', dir: 'ltr',
    base_intro: '이제 이 약을 복용할 때 일반적으로 따르는 습관과 루틴에 대해 몇 가지 질문을 드리겠습니다. 지난 한 달 동안 당신에게 전형적인 것이 무엇인지 생각해보세요. 옳고 그른 답은 없습니다. 가능한 한 솔직하게 답해주세요.',
    mvmt_intro: '다음 질문들은 지난 7일 동안의 복약 경험에 관한 것입니다...',
    strata_intro: '이후 지원, 주거 상황, 교통, 재정, 치료 이해에 관한 질문을 드리겠습니다.',
    base_opts: ['예', '가끔', '아니오'],
    mvmt_opts: ['아니오', '예, 한 번', '예, 두 번 이상'],
    base_dim: 'BASE — 아키텍처 및 행동 안정성 평가',
    base_period: '지난 30일 · 7문항 · 습관 구조',
    mvmt_dim: 'MVMT — 측정 가능한 최소 분산',
    mvmt_period: '지난 7일 · 7문항 · 시간적 정확성',
    strata_dim: 'STRATA — 치료에 대한 사회적, 관계적, 맥락적 접근',
    strata_period: '현재 분기 · 8문항 · 4단계 앵커링',
    bq1_title: '기억 구조',                    bq1: '바쁜 날에도 일정에 따라 약을 복용하는 것을 확실히 기억할 수 있습니까?',
    bq2_title: '루틴 안정성',                  bq2: '일상 일정이 변경되어도 일관된 복약 루틴을 유지합니까?',
    bq3_title: '증상 저항력',                  bq3: '기분이 좋아지기 시작하더라도 처방된 대로 약을 계속 복용합니까?',
    bq4_title: '적응적 유연성',                bq4: '일정이 변경될 때 약을 복용할 수 있도록 일상 루틴을 조정할 수 있습니까?',
    bq5_title: '부작용 내성',                  bq5: '부작용이 있어도 이를 관리하면서 치료를 계속할 수 있습니까?',
    bq6_title: '행동적 통합',                  bq6: '약 복용이 일상생활에 자연스럽게 맞습니까?',
    bq7_title: '준비 구조',                    bq7: '약이 떨어지지 않도록 정기적으로 비축합니까?',
    mq1_title: '시간적 일관성',                mq1: '지난 7일 동안 매일 같은 시간에 약을 복용하는 데 어려움이 있었습니까?',
    mq2_title: '용량 준수',                    mq2: '지난 7일 동안 약을 빠뜨린 적이 있습니까?',
    mq3_title: '증상으로 인한 건너뜀',           mq3: '지난 7일 동안 기분이 좋아졌기 때문에 약을 중단하거나 빠뜨린 적이 있습니까?',
    mq4_title: '부작용 반응',                  mq4: '지난 7일 동안 부작용으로 인해 약을 중단하거나 빠뜨린 적이 있습니까?',
    mq5_title: '환경적 방해',                  mq5: '지난 7일 동안 여행, 부재 또는 환경으로 인해 용량을 빠뜨린 적이 있습니까?',
    mq6_title: '일정 적응',                    mq6: '지난 7일 동안 일정이 변경될 때 약을 복용하기 위해 루틴을 조정하는 데 어려움이 있었습니까?',
    mq7_title: '일상적 통합',                  mq7: '지난 7일 동안 약 복용이 부담처럼 느껴지거나 일상생활에 자연스럽게 맞지 않았습니까?',
    sq1_title: '주요 지원자',                  sq1: '약을 기억하거나 관리하는 데 누가 도움을 줍니까?',
    sq1_opts: ['배우자 또는 파트너', '성인 자녀 또는 다른 가족 구성원', '친구, 이웃 또는 돌봄 제공자', '독립적으로 처리함'],
    sq2_title: '연락 빈도',                    sq2: '가족이나 친구들과 얼마나 자주 의미 있는 접촉을 합니까?',
    sq2_opts: ['매일 또는 주 여러 번', '주 1회', '월 여러 번', '드물게 또는 거의 없음'],
    sq3_title: '주거 상황',                    sq3: '현재 주거 상황은 어떻습니까?',
    sq3_opts: ['배우자나 가족과 함께 거주', '혼자 살지만 가족이나 지원이 가까이 있음', '보호된 또는 관리 돌봄 주거', '혼자 살며 가족이 멀리 있거나 임시 주거'],
    sq4_title: '응급 네트워크',                sq4: '의료 응급 상황이 발생하면 누가 알고 도움을 줄 수 있습니까?',
    sq4_opts: ['빠르게 반응할 여러 사람', '반응할 사람이 적어도 한 명', '결국 알아차릴 사람', '아마도 아무도 없거나 확실히 아무도 없음'],
    sq5_title: '교통수단 접근성',               sq5: '일반적으로 의사 예약이나 약국에 어떻게 갑니까?',
    sq5_opts: ['직접 운전하거나 신뢰할 수 있고 유연한 교통수단이 있음', '가족이나 친구가 데려다주거나 대중교통 이용 가능', '의료 이송, 택시 또는 어렵게', '예약이나 약국에 신뢰할 수 있게 갈 수 없음'],
    sq6_title: '치료 연속성',                  sq6: '약을 얼마나 신뢰할 수 있게 구할 수 있고 후속 예약에 참석할 수 있습니까?',
    sq6_opts: ['약과 예약은 필요할 때 항상 이용 가능', '일반적으로 이용 가능하나 가끔 지연 또는 어려움', '자주 지연되거나 구하기 어려움', '신뢰할 수 없음; 약이나 후속 치료 접근에 상당한 차이'],
    sq7_title: '정보 및 건강 리터러시',          sq7: '약 복용 지침을 얼마나 잘 이해합니까?',
    sq7_opts: ['완전히 이해하고 다른 사람에게 설명할 수 있음', '대부분의 지침을 이해함', '일부 이해하지만 일부 부분에 대해 질문이 있음', '어떻게 복용해야 하는지 자주 혼란스럽거나 불확실함'],
    sq8_title: '복약 준수 신념',               sq8: '약이 필요하고 도움이 될 것이라고 얼마나 믿습니까?',
    sq8_opts: ['필요하고 효과적이라고 강하게 믿음', '일반적으로 도움이 된다고 생각함', '도움이 되는지 확신이 없음', '필요성이나 효과에 대해 자주 의심함'],
    pairing_title: '⚠ 환자 페어링 프로토콜',
    pairing_body: '환자는 환자 ID를 받으려면 먼저 MMAS-8 평가를 완료해야 합니다. 이 ID는 도구 간 종단 분석을 위해 MMAS-8 복약 준수 데이터를 PEACS 결과와 연결합니다.',
    patient_id_label: '환자 ID',
    patient_id_hint: '(MMAS 세션에서 자동 입력 · 편집 가능)',
    submit_btn: 'PEACS 평가 제출 →',
  },
  zh: {
    name: 'Chinese (Simplified)', native: '中文（简体）', dir: 'ltr',
    base_intro: '现在我将向您询问有关您在服用这种药物时通常遵循的习惯和日常规律的一些问题。请考虑对您来说什么是典型的（在过去一个月内）。没有正确或错误的答案；请尽可能诚实地回答。',
    mvmt_intro: '以下问题涉及您过去7天的服药经历...',
    strata_intro: '接下来我们将询问有关支持、居住状况、交通、财务和对治疗理解的问题。',
    base_opts: ['是', '有时', '否'],
    mvmt_opts: ['否', '是，一次', '是，不止一次'],
    base_dim: 'BASE — 架构与行为稳定性评估',
    base_period: '过去30天 · 7个问题 · 习惯结构',
    mvmt_dim: 'MVMT — 可测量的最小变异',
    mvmt_period: '过去7天 · 7个问题 · 时间精确性',
    strata_dim: 'STRATA — 治疗的社会、关系和情境获取',
    strata_period: '当前季度 · 8个问题 · 四级锚定',
    bq1_title: '记忆架构',                    bq1: '即使在忙碌的日子里，您也能可靠地记得按计划服药吗？',
    bq2_title: '日常规律稳定性',               bq2: '当您的日常时间表改变时，您能维持一致的服药规律吗？',
    bq3_title: '症状抵抗力',                  bq3: '当您开始感觉好转时，您仍然会完全按照处方服药吗？',
    bq4_title: '适应灵活性',                  bq4: '当时间表变化时，您能调整日常规律以确保服药吗？',
    bq5_title: '副作用耐受性',                bq5: '如果出现副作用，您能在应对它们的同时继续治疗吗？',
    bq6_title: '行为整合',                    bq6: '服药自然地融入您的日常生活了吗？',
    bq7_title: '准备结构',                    bq7: '您是否定期保持药物储备以避免断药？',
    mq1_title: '时间一致性',                  mq1: '在过去7天里，每天在同一时间服药有困难吗？',
    mq2_title: '剂量依从性',                  mq2: '在过去7天里，有漏服的情况吗？',
    mq3_title: '因症状而跳过',                mq3: '在过去7天里，因为感觉好转而停药或漏服吗？',
    mq4_title: '副作用反应',                  mq4: '在过去7天里，因副作用而停药或漏服吗？',
    mq5_title: '环境干扰',                    mq5: '在过去7天里，旅行、外出或环境导致漏服吗？',
    mq6_title: '时间表适应',                  mq6: '在过去7天里，当时间表变化时调整日常规律以服药有困难吗？',
    mq7_title: '日常整合',                    mq7: '在过去7天里，服药感觉像是负担或不自然地融入日常生活吗？',
    sq1_title: '主要支持者',                  sq1: '谁帮助您记住或管理药物？',
    sq1_opts: ['配偶或伴侣', '成年子女或其他家庭成员', '朋友、邻居或护理人员', '独立处理'],
    sq2_title: '联系频率',                    sq2: '您与家人或朋友有意义的接触频率如何？',
    sq2_opts: ['每天或每周几次', '每周一次', '每月几次', '很少或几乎没有'],
    sq3_title: '居住状况',                    sq3: '您目前的居住状况如何？',
    sq3_opts: ['与配偶或家庭成员同住', '独居但家人或支持在附近', '保护性或托管照护住所', '独居且家人在远处或临时住所'],
    sq4_title: '紧急联络网络',                sq4: '如果您遇到医疗紧急情况，谁会知道并能提供帮助？',
    sq4_opts: ['有几个人会迅速响应', '至少有一个人会响应', '有人最终会注意到', '可能没有人或确定没有人'],
    sq5_title: '交通便利性',                  sq5: '您通常如何前往医疗预约或药房？',
    sq5_opts: ['自己驾车或有可靠灵活的交通方式', '家人或朋友接送，或可乘坐公共交通', '医疗交通、出租车或费力地', '无法可靠地前往预约或药房'],
    sq6_title: '护理连续性',                  sq6: '您能多可靠地获得药物并参加随访预约？',
    sq6_opts: ['药物和预约在需要时始终可用', '通常可用，偶尔有延误或困难', '经常延误或难以获得', '不可靠；药物或随访护理获取存在重大差距'],
    sq7_title: '信息与健康素养',               sq7: '您对服药说明的理解程度如何？',
    sq7_opts: ['完全理解并能向他人解释', '理解大部分说明', '部分理解，但有些部分有疑问', '经常困惑或不确定如何服用'],
    sq8_title: '依从性信念',                  sq8: '您在多大程度上相信药物是必要的并且会帮助您？',
    sq8_opts: ['强烈相信它是必要且有效的', '总体上认为它有帮助', '不确定它是否有帮助', '经常怀疑其必要性或有效性'],
    pairing_title: '⚠ 患者配对协议',
    pairing_body: '患者必须首先完成MMAS-8评估以获得患者ID。该ID将MMAS-8依从性数据与PEACS结果关联，用于跨工具纵向分析。',
    patient_id_label: '患者ID',
    patient_id_hint: '（从MMAS会话自动填写 · 可编辑）',
    submit_btn: '提交PEACS评估 →',
  },
  'zh-TW': {
    name: 'Chinese (Traditional)', native: '中文（繁體）', dir: 'ltr',
    base_intro: '現在我將向您詢問有關您在服用這種藥物時通常遵循的習慣和日常規律的一些問題。請考慮對您來說什麼是典型的（在過去一個月內）。沒有正確或錯誤的答案；請盡可能誠實地回答。',
    mvmt_intro: '以下問題涉及您過去7天的服藥經歷...',
    strata_intro: '接下來我們將詢問有關支持、居住狀況、交通、財務和對治療理解的問題。',
    base_opts: ['是', '有時', '否'],
    mvmt_opts: ['否', '是，一次', '是，不止一次'],
    base_dim: 'BASE — 架構與行為穩定性評估',
    base_period: '過去30天 · 7個問題 · 習慣結構',
    mvmt_dim: 'MVMT — 可測量的最小變異',
    mvmt_period: '過去7天 · 7個問題 · 時間精確性',
    strata_dim: 'STRATA — 治療的社會、關係和情境獲取',
    strata_period: '當前季度 · 8個問題 · 四級錨定',
    bq1_title: '記憶架構',                    bq1: '即使在忙碌的日子裡，您也能可靠地記得按計畫服藥嗎？',
    bq2_title: '日常規律穩定性',               bq2: '當您的日常時間表改變時，您能維持一致的服藥規律嗎？',
    bq3_title: '症狀抵抗力',                  bq3: '當您開始感覺好轉時，您仍然會完全按照處方服藥嗎？',
    bq4_title: '適應靈活性',                  bq4: '當時間表變化時，您能調整日常規律以確保服藥嗎？',
    bq5_title: '副作用耐受性',                bq5: '如果出現副作用，您能在應對它們的同時繼續治療嗎？',
    bq6_title: '行為整合',                    bq6: '服藥自然地融入您的日常生活了嗎？',
    bq7_title: '準備結構',                    bq7: '您是否定期保持藥物儲備以避免斷藥？',
    mq1_title: '時間一致性',                  mq1: '在過去7天裡，每天在同一時間服藥有困難嗎？',
    mq2_title: '劑量依從性',                  mq2: '在過去7天裡，有漏服的情況嗎？',
    mq3_title: '因症狀而跳過',                mq3: '在過去7天裡，因為感覺好轉而停藥或漏服嗎？',
    mq4_title: '副作用反應',                  mq4: '在過去7天裡，因副作用而停藥或漏服嗎？',
    mq5_title: '環境干擾',                    mq5: '在過去7天裡，旅行、外出或環境導致漏服嗎？',
    mq6_title: '時間表適應',                  mq6: '在過去7天裡，當時間表變化時調整日常規律以服藥有困難嗎？',
    mq7_title: '日常整合',                    mq7: '在過去7天裡，服藥感覺像是負擔或不自然地融入日常生活嗎？',
    sq1_title: '主要支持者',                  sq1: '誰幫助您記住或管理藥物？',
    sq1_opts: ['配偶或伴侶', '成年子女或其他家庭成員', '朋友、鄰居或護理人員', '獨立處理'],
    sq2_title: '聯繫頻率',                    sq2: '您與家人或朋友有意義的接觸頻率如何？',
    sq2_opts: ['每天或每週幾次', '每週一次', '每月幾次', '很少或幾乎沒有'],
    sq3_title: '居住狀況',                    sq3: '您目前的居住狀況如何？',
    sq3_opts: ['與配偶或家庭成員同住', '獨居但家人或支持在附近', '保護性或托管照護住所', '獨居且家人在遠處或臨時住所'],
    sq4_title: '緊急聯絡網絡',                sq4: '如果您遇到醫療緊急情況，誰會知道並能提供幫助？',
    sq4_opts: ['有幾個人會迅速響應', '至少有一個人會響應', '有人最終會注意到', '可能沒有人或確定沒有人'],
    sq5_title: '交通便利性',                  sq5: '您通常如何前往醫療預約或藥房？',
    sq5_opts: ['自己駕車或有可靠靈活的交通方式', '家人或朋友接送，或可乘坐公共交通', '醫療交通、計程車或費力地', '無法可靠地前往預約或藥房'],
    sq6_title: '護理連續性',                  sq6: '您能多可靠地獲得藥物並參加隨訪預約？',
    sq6_opts: ['藥物和預約在需要時始終可用', '通常可用，偶爾有延誤或困難', '經常延誤或難以獲得', '不可靠；藥物或隨訪護理獲取存在重大差距'],
    sq7_title: '資訊與健康素養',               sq7: '您對服藥說明的理解程度如何？',
    sq7_opts: ['完全理解並能向他人解釋', '理解大部分說明', '部分理解，但有些部分有疑問', '經常困惑或不確定如何服用'],
    sq8_title: '依從性信念',                  sq8: '您在多大程度上相信藥物是必要的並且會幫助您？',
    sq8_opts: ['強烈相信它是必要且有效的', '總體上認為它有幫助', '不確定它是否有幫助', '經常懷疑其必要性或有效性'],
    pairing_title: '⚠ 患者配對協議',
    pairing_body: '患者必須首先完成MMAS-8評估以獲得患者ID。該ID將MMAS-8依從性數據與PEACS結果關聯，用於跨工具縱向分析。',
    patient_id_label: '患者ID',
    patient_id_hint: '（從MMAS會話自動填寫 · 可編輯）',
    submit_btn: '提交PEACS評估 →',
  },
  vi: {
    name: 'Vietnamese', native: 'Tiếng Việt', dir: 'ltr',
    base_intro: 'Bây giờ tôi sẽ hỏi bạn một số câu hỏi về thói quen và thói quen bạn thường tuân theo khi uống loại thuốc này. Hãy nghĩ về điều gì là điển hình đối với bạn (trong tháng vừa qua). Không có câu trả lời đúng hay sai; hãy trả lời thành thật nhất có thể.',
    mvmt_intro: 'Các câu hỏi tiếp theo liên quan đến kinh nghiệm dùng thuốc của bạn trong 7 ngày qua...',
    strata_intro: 'Sau đó chúng tôi sẽ hỏi về sự hỗ trợ, điều kiện nhà ở, giao thông, tài chính và hiểu biết về điều trị.',
    base_opts: ['Có', 'Đôi khi', 'Không'],
    mvmt_opts: ['Không', 'Có, một lần', 'Có, nhiều hơn một lần'],
    base_dim: 'BASE — Đánh giá Kiến trúc và Ổn định Hành vi',
    base_period: '30 ngày qua · 7 câu hỏi · Cấu trúc thói quen',
    mvmt_dim: 'MVMT — Phương sai Tối thiểu Có thể Đo lường',
    mvmt_period: '7 ngày qua · 7 câu hỏi · Độ chính xác thời gian',
    strata_dim: 'STRATA — Tiếp cận Điều trị Xã hội, Quan hệ và Bối cảnh',
    strata_period: 'Quý hiện tại · 8 câu hỏi · Neo bốn cấp độ',
    bq1_title: 'Kiến trúc bộ nhớ',             bq1: 'Bạn có thể nhớ uống thuốc theo lịch trình một cách đáng tin cậy, ngay cả trong những ngày bận rộn không?',
    bq2_title: 'Ổn định thói quen',             bq2: 'Bạn có duy trì thói quen uống thuốc nhất quán khi lịch trình hàng ngày thay đổi không?',
    bq3_title: 'Kháng cự triệu chứng',          bq3: 'Khi bạn bắt đầu cảm thấy tốt hơn, bạn có vẫn tiếp tục uống thuốc đúng như đã được kê toa không?',
    bq4_title: 'Linh hoạt thích ứng',           bq4: 'Khi lịch trình thay đổi, bạn có thể điều chỉnh thói quen hàng ngày để đảm bảo uống thuốc không?',
    bq5_title: 'Chịu đựng tác dụng phụ',        bq5: 'Nếu bạn gặp tác dụng phụ, bạn có thể tiếp tục điều trị trong khi xử lý chúng không?',
    bq6_title: 'Tích hợp hành vi',              bq6: 'Việc uống thuốc có tự nhiên phù hợp với cuộc sống hàng ngày của bạn không?',
    bq7_title: 'Cấu trúc chuẩn bị',             bq7: 'Bạn có thường xuyên dự trữ thuốc để tránh hết thuốc không?',
    mq1_title: 'Tính nhất quán về thời gian',   mq1: 'Trong 7 ngày qua, bạn có gặp khó khăn trong việc uống thuốc vào cùng một thời điểm mỗi ngày không?',
    mq2_title: 'Tuân thủ liều lượng',           mq2: 'Trong 7 ngày qua, bạn có bỏ lỡ liều nào không?',
    mq3_title: 'Bỏ qua do triệu chứng',         mq3: 'Trong 7 ngày qua, bạn có ngừng hoặc bỏ qua thuốc vì cảm thấy tốt hơn không?',
    mq4_title: 'Phản ứng với tác dụng phụ',     mq4: 'Trong 7 ngày qua, bạn có ngừng hoặc bỏ qua thuốc do tác dụng phụ không?',
    mq5_title: 'Gián đoạn môi trường',          mq5: 'Trong 7 ngày qua, việc đi lại, vắng nhà hoặc môi trường có khiến bạn bỏ lỡ liều không?',
    mq6_title: 'Thích nghi lịch trình',         mq6: 'Trong 7 ngày qua, khi lịch trình thay đổi, bạn có gặp khó khăn khi điều chỉnh thói quen để uống thuốc không?',
    mq7_title: 'Tích hợp hàng ngày',            mq7: 'Trong 7 ngày qua, việc uống thuốc có cảm thấy như gánh nặng hoặc không tự nhiên phù hợp với cuộc sống hàng ngày không?',
    sq1_title: 'Người hỗ trợ chính',            sq1: 'Ai giúp bạn nhớ hoặc quản lý thuốc?',
    sq1_opts: ['Vợ/chồng hoặc bạn đời', 'Con cái hoặc thành viên gia đình khác', 'Bạn bè, hàng xóm hoặc người chăm sóc', 'Tự xử lý độc lập'],
    sq2_title: 'Tần suất liên lạc',             sq2: 'Bạn có liên lạc ý nghĩa với gia đình hoặc bạn bè bao lâu một lần?',
    sq2_opts: ['Hàng ngày hoặc vài lần một tuần', 'Một lần một tuần', 'Vài lần một tháng', 'Hiếm khi hoặc gần như không bao giờ'],
    sq3_title: 'Tình trạng nhà ở',              sq3: 'Tình trạng nhà ở hiện tại của bạn là gì?',
    sq3_opts: ['Sống với vợ/chồng hoặc thành viên gia đình', 'Sống một mình nhưng gia đình hoặc hỗ trợ ở gần', 'Nhà ở được bảo vệ hoặc chăm sóc có quản lý', 'Sống một mình, gia đình ở xa hoặc trong nhà tạm'],
    sq4_title: 'Mạng lưới khẩn cấp',            sq4: 'Nếu bạn gặp tình huống khẩn cấp về y tế, ai sẽ biết và có thể giúp đỡ?',
    sq4_opts: ['Nhiều người phản ứng nhanh', 'Ít nhất một người sẽ phản ứng', 'Ai đó cuối cùng sẽ nhận ra', 'Có thể không ai hoặc chắc chắn không ai'],
    sq5_title: 'Khả năng tiếp cận giao thông',   sq5: 'Bạn thường đi đến cuộc hẹn y tế hoặc nhà thuốc bằng cách nào?',
    sq5_opts: ['Tự lái hoặc có phương tiện giao thông đáng tin cậy và linh hoạt', 'Gia đình hoặc bạn bè đưa đi, hoặc có giao thông công cộng', 'Giao thông y tế, taxi hoặc rất khó khăn', 'Không thể đến cuộc hẹn hoặc nhà thuốc một cách đáng tin cậy'],
    sq6_title: 'Liên tục chăm sóc',             sq6: 'Bạn có thể lấy thuốc và tham dự cuộc hẹn theo dõi một cách đáng tin cậy như thế nào?',
    sq6_opts: ['Thuốc và cuộc hẹn luôn có sẵn khi cần', 'Thường có sẵn với đôi khi chậm trễ hoặc khó khăn', 'Thường bị trì hoãn hoặc khó lấy', 'Không đáng tin cậy; khoảng cách lớn trong việc tiếp cận thuốc hoặc theo dõi chăm sóc'],
    sq7_title: 'Thông tin và hiểu biết sức khỏe', sq7: 'Bạn hiểu hướng dẫn uống thuốc của mình như thế nào?',
    sq7_opts: ['Hoàn toàn hiểu và có thể giải thích cho người khác', 'Hiểu hầu hết các hướng dẫn', 'Hiểu một phần nhưng có câu hỏi về một số phần', 'Thường bối rối hoặc không chắc cách uống'],
    sq8_title: 'Niềm tin tuân thủ',             sq8: 'Bạn tin tưởng ở mức độ nào rằng thuốc là cần thiết và sẽ giúp bạn?',
    sq8_opts: ['Tin tưởng mạnh mẽ rằng nó cần thiết và hiệu quả', 'Nhìn chung nghĩ rằng nó có ích', 'Không chắc liệu nó có giúp ích không', 'Thường nghi ngờ về sự cần thiết hoặc hiệu quả của nó'],
    pairing_title: '⚠ Giao thức ghép đôi bệnh nhân',
    pairing_body: 'Bệnh nhân phải hoàn thành đánh giá MMAS-8 trước để nhận ID bệnh nhân. ID này liên kết dữ liệu tuân thủ MMAS-8 với kết quả PEACS để phân tích dọc liên công cụ.',
    patient_id_label: 'ID bệnh nhân',
    patient_id_hint: '(Tự động điền từ phiên MMAS · có thể chỉnh sửa)',
    submit_btn: 'Gửi đánh giá PEACS →',
  },
  id: {
    name: 'Indonesian', native: 'Bahasa Indonesia', dir: 'ltr',
    base_intro: 'Sekarang saya akan mengajukan beberapa pertanyaan tentang kebiasaan dan rutinitas yang biasanya Anda ikuti saat minum obat ini. Pikirkan apa yang biasa bagi Anda (dalam sebulan terakhir). Tidak ada jawaban yang benar atau salah; jawablah sejujur mungkin.',
    mvmt_intro: 'Pertanyaan-pertanyaan berikut berkaitan dengan pengalaman minum obat Anda dalam 7 hari terakhir...',
    strata_intro: 'Kemudian kami akan mengajukan pertanyaan tentang dukungan, kondisi tempat tinggal, transportasi, keuangan, dan pemahaman tentang pengobatan.',
    base_opts: ['Ya', 'Kadang-kadang', 'Tidak'],
    mvmt_opts: ['Tidak', 'Ya, sekali', 'Ya, lebih dari sekali'],
    base_dim: 'BASE — Penilaian Arsitektur dan Stabilitas Perilaku',
    base_period: '30 hari terakhir · 7 pertanyaan · Struktur kebiasaan',
    mvmt_dim: 'MVMT — Varians Minimum yang Dapat Diukur',
    mvmt_period: '7 hari terakhir · 7 pertanyaan · Ketepatan waktu',
    strata_dim: 'STRATA — Akses Sosial, Relasional, dan Kontekstual ke Pengobatan',
    strata_period: 'Kuartal saat ini · 8 pertanyaan · Penahan empat tingkat',
    bq1_title: 'Arsitektur memori',             bq1: 'Apakah Anda dapat mengingat minum obat sesuai jadwal secara konsisten, bahkan di hari-hari sibuk?',
    bq2_title: 'Stabilitas rutinitas',           bq2: 'Apakah Anda mempertahankan rutinitas minum obat yang konsisten saat jadwal harian Anda berubah?',
    bq3_title: 'Ketahanan terhadap gejala',      bq3: 'Ketika Anda mulai merasa lebih baik, apakah Anda tetap minum obat persis seperti yang diresepkan?',
    bq4_title: 'Fleksibilitas adaptif',          bq4: 'Apakah Anda dapat menyesuaikan rutinitas harian Anda untuk memastikan minum obat saat jadwal berubah?',
    bq5_title: 'Toleransi efek samping',         bq5: 'Jika Anda mengalami efek samping, apakah Anda dapat melanjutkan pengobatan sambil mengatasinya?',
    bq6_title: 'Integrasi perilaku',             bq6: 'Apakah minum obat secara alami sesuai dengan kehidupan sehari-hari Anda?',
    bq7_title: 'Struktur persiapan',             bq7: 'Apakah Anda secara teratur mempertahankan cadangan obat agar tidak kehabisan?',
    mq1_title: 'Konsistensi waktu',              mq1: 'Dalam 7 hari terakhir, apakah Anda kesulitan minum obat pada waktu yang sama setiap hari?',
    mq2_title: 'Kepatuhan dosis',                mq2: 'Dalam 7 hari terakhir, apakah Anda melewatkan dosis?',
    mq3_title: 'Melewati karena gejala',         mq3: 'Dalam 7 hari terakhir, apakah Anda berhenti atau melewatkan obat karena merasa lebih baik?',
    mq4_title: 'Respons efek samping',           mq4: 'Dalam 7 hari terakhir, apakah Anda berhenti atau melewatkan obat karena efek samping?',
    mq5_title: 'Gangguan lingkungan',            mq5: 'Dalam 7 hari terakhir, apakah perjalanan, ketidakhadiran, atau lingkungan menyebabkan Anda melewatkan dosis?',
    mq6_title: 'Adaptasi jadwal',                mq6: 'Dalam 7 hari terakhir, apakah Anda kesulitan menyesuaikan rutinitas untuk minum obat saat jadwal berubah?',
    mq7_title: 'Integrasi harian',               mq7: 'Dalam 7 hari terakhir, apakah minum obat terasa seperti beban atau tidak secara alami sesuai dengan kehidupan sehari-hari?',
    sq1_title: 'Pendukung utama',                sq1: 'Siapa yang membantu Anda mengingat atau mengelola obat?',
    sq1_opts: ['Suami/istri atau pasangan', 'Anak dewasa atau anggota keluarga lain', 'Teman, tetangga, atau pengasuh', 'Menangani secara mandiri'],
    sq2_title: 'Frekuensi kontak',               sq2: 'Seberapa sering Anda memiliki kontak yang bermakna dengan keluarga atau teman?',
    sq2_opts: ['Setiap hari atau beberapa kali seminggu', 'Sekali seminggu', 'Beberapa kali sebulan', 'Jarang atau hampir tidak pernah'],
    sq3_title: 'Situasi tempat tinggal',         sq3: 'Bagaimana situasi tempat tinggal Anda saat ini?',
    sq3_opts: ['Tinggal dengan suami/istri atau anggota keluarga', 'Tinggal sendiri tetapi keluarga atau dukungan dekat', 'Tempat tinggal berproteksi atau perawatan terkelola', 'Tinggal sendiri, keluarga jauh atau di tempat tinggal sementara'],
    sq4_title: 'Jaringan darurat',               sq4: 'Jika Anda mengalami keadaan darurat medis, siapa yang akan tahu dan dapat membantu?',
    sq4_opts: ['Beberapa orang yang akan merespons dengan cepat', 'Setidaknya satu orang yang akan merespons', 'Seseorang yang akhirnya akan menyadari', 'Mungkin tidak ada atau pasti tidak ada'],
    sq5_title: 'Aksesibilitas transportasi',     sq5: 'Bagaimana Anda biasanya pergi ke janji medis atau apotek?',
    sq5_opts: ['Mengemudi sendiri atau memiliki transportasi yang andal dan fleksibel', 'Keluarga atau teman mengantar, atau transportasi umum tersedia', 'Transportasi medis, taksi, atau dengan susah payah', 'Tidak dapat pergi ke janji atau apotek secara andal'],
    sq6_title: 'Kontinuitas perawatan',          sq6: 'Seberapa andalnya Anda bisa mendapatkan obat dan menghadiri janji tindak lanjut?',
    sq6_opts: ['Obat dan janji selalu tersedia saat dibutuhkan', 'Umumnya tersedia dengan sesekali keterlambatan atau kesulitan', 'Sering tertunda atau sulit didapat', 'Tidak dapat diandalkan; kesenjangan signifikan dalam akses ke obat atau perawatan tindak lanjut'],
    sq7_title: 'Informasi dan literasi kesehatan', sq7: 'Seberapa baik Anda memahami petunjuk cara minum obat?',
    sq7_opts: ['Memahami sepenuhnya dan dapat menjelaskan kepada orang lain', 'Memahami sebagian besar petunjuk', 'Memahami sebagian tetapi memiliki pertanyaan tentang beberapa bagian', 'Sering bingung atau tidak yakin cara meminumnya'],
    sq8_title: 'Keyakinan kepatuhan',            sq8: 'Sejauh mana Anda percaya bahwa obat itu diperlukan dan akan membantu Anda?',
    sq8_opts: ['Sangat percaya bahwa itu diperlukan dan efektif', 'Umumnya berpikir itu membantu', 'Tidak yakin apakah itu membantu', 'Sering meragukan kebutuhannya atau efektivitasnya'],
    pairing_title: '⚠ Protokol pencocokan pasien',
    pairing_body: 'Pasien harus terlebih dahulu menyelesaikan penilaian MMAS-8 untuk menerima ID pasien. ID ini menghubungkan data kepatuhan MMAS-8 dengan hasil PEACS untuk analisis longitudinal antar instrumen.',
    patient_id_label: 'ID pasien',
    patient_id_hint: '(Diisi otomatis dari sesi MMAS · dapat diedit)',
    submit_btn: 'Kirim penilaian PEACS →',
  },
  ms: {
    name: 'Malay', native: 'Bahasa Melayu', dir: 'ltr',
    base_intro: 'Sekarang saya akan mengemukakan beberapa soalan tentang tabiat dan rutin yang biasanya anda ikuti semasa mengambil ubat ini. Fikirkanlah apa yang biasa bagi anda (dalam sebulan yang lalu). Tiada jawapan yang betul atau salah; jawab dengan sejujur mungkin.',
    mvmt_intro: 'Soalan-soalan berikut berkaitan dengan pengalaman mengambil ubat anda dalam 7 hari yang lalu...',
    strata_intro: 'Kemudian kami akan mengemukakan soalan tentang sokongan, keadaan kediaman, pengangkutan, kewangan, dan pemahaman tentang rawatan.',
    base_opts: ['Ya', 'Kadang-kadang', 'Tidak'],
    mvmt_opts: ['Tidak', 'Ya, sekali', 'Ya, lebih dari sekali'],
    base_dim: 'BASE — Penilaian Seni Bina dan Kestabilan Tingkah Laku',
    base_period: '30 hari lepas · 7 soalan · Struktur tabiat',
    mvmt_dim: 'MVMT — Varians Minimum yang Boleh Diukur',
    mvmt_period: '7 hari lepas · 7 soalan · Ketepatan masa',
    strata_dim: 'STRATA — Akses Sosial, Hubungan dan Kontekstual kepada Rawatan',
    strata_period: 'Suku semasa · 8 soalan · Penambatan empat peringkat',
    bq1_title: 'Seni bina ingatan',             bq1: 'Bolehkah anda mengingati untuk mengambil ubat mengikut jadual secara boleh dipercayai, walaupun pada hari yang sibuk?',
    bq2_title: 'Kestabilan rutin',              bq2: 'Adakah anda mengekalkan rutin pengambilan ubat yang konsisten apabila jadual harian anda berubah?',
    bq3_title: 'Ketahanan gejala',              bq3: 'Apabila anda mula berasa lebih baik, adakah anda masih mengambil ubat dengan tepat seperti yang ditetapkan?',
    bq4_title: 'Fleksibiliti adaptif',           bq4: 'Bolehkah anda menyesuaikan rutin harian anda untuk memastikan pengambilan ubat apabila jadual berubah?',
    bq5_title: 'Toleransi kesan sampingan',      bq5: 'Jika anda mengalami kesan sampingan, bolehkah anda meneruskan rawatan sambil mengatasinya?',
    bq6_title: 'Integrasi tingkah laku',         bq6: 'Adakah pengambilan ubat sesuai secara semula jadi dalam kehidupan harian anda?',
    bq7_title: 'Struktur persediaan',            bq7: 'Adakah anda sentiasa mengekalkan simpanan ubat untuk mengelak kehabisan?',
    mq1_title: 'Konsistensi masa',               mq1: 'Dalam 7 hari yang lalu, adakah anda menghadapi kesukaran mengambil ubat pada masa yang sama setiap hari?',
    mq2_title: 'Pematuhan dos',                 mq2: 'Dalam 7 hari yang lalu, adakah anda terlepas sebarang dos?',
    mq3_title: 'Langkau disebabkan gejala',      mq3: 'Dalam 7 hari yang lalu, adakah anda berhenti atau melangkau ubat kerana berasa lebih baik?',
    mq4_title: 'Tindak balas kesan sampingan',   mq4: 'Dalam 7 hari yang lalu, adakah anda berhenti atau melangkau ubat disebabkan kesan sampingan?',
    mq5_title: 'Gangguan persekitaran',          mq5: 'Dalam 7 hari yang lalu, adakah perjalanan, ketiadaan atau persekitaran menyebabkan anda terlepas dos?',
    mq6_title: 'Penyesuaian jadual',             mq6: 'Dalam 7 hari yang lalu, adakah anda menghadapi kesukaran menyesuaikan rutin untuk mengambil ubat apabila jadual berubah?',
    mq7_title: 'Integrasi harian',               mq7: 'Dalam 7 hari yang lalu, adakah pengambilan ubat terasa seperti beban atau tidak secara semula jadi sesuai dalam kehidupan harian?',
    sq1_title: 'Penyokong utama',                sq1: 'Siapa yang membantu anda mengingati atau menguruskan ubat?',
    sq1_opts: ['Suami/isteri atau pasangan', 'Anak dewasa atau ahli keluarga lain', 'Rakan, jiran atau pengasuh', 'Urus sendiri secara bebas'],
    sq2_title: 'Kekerapan hubungan',             sq2: 'Berapa kerap anda mempunyai hubungan yang bermakna dengan keluarga atau rakan?',
    sq2_opts: ['Setiap hari atau beberapa kali seminggu', 'Sekali seminggu', 'Beberapa kali sebulan', 'Jarang atau hampir tidak pernah'],
    sq3_title: 'Situasi kediaman',               sq3: 'Bagaimana situasi kediaman semasa anda?',
    sq3_opts: ['Tinggal bersama suami/isteri atau ahli keluarga', 'Tinggal bersendirian tetapi keluarga atau sokongan berdekatan', 'Kediaman terlindung atau penjagaan terurus', 'Tinggal bersendirian, keluarga jauh atau di kediaman sementara'],
    sq4_title: 'Rangkaian kecemasan',            sq4: 'Jika anda mengalami kecemasan perubatan, siapa yang akan tahu dan boleh membantu?',
    sq4_opts: ['Beberapa orang yang akan bertindak balas dengan cepat', 'Sekurang-kurangnya seorang yang akan bertindak balas', 'Seseorang yang akhirnya akan sedar', 'Mungkin tiada siapa atau pasti tiada siapa'],
    sq5_title: 'Kebolehcapaian pengangkutan',    sq5: 'Bagaimana anda biasanya pergi ke temujanji perubatan atau farmasi?',
    sq5_opts: ['Memandu sendiri atau mempunyai pengangkutan yang boleh dipercayai dan fleksibel', 'Keluarga atau rakan menghantar, atau pengangkutan awam tersedia', 'Pengangkutan perubatan, teksi atau dengan susah payah', 'Tidak boleh pergi ke temujanji atau farmasi secara boleh dipercayai'],
    sq6_title: 'Kesinambungan penjagaan',        sq6: 'Seberapa boleh dipercayaikah anda boleh mendapatkan ubat dan menghadiri temujanji susulan?',
    sq6_opts: ['Ubat dan temujanji sentiasa tersedia apabila diperlukan', 'Umumnya tersedia dengan sesekali kelewatan atau kesukaran', 'Sering tertunda atau sukar diperolehi', 'Tidak boleh dipercayai; jurang yang ketara dalam akses kepada ubat atau penjagaan susulan'],
    sq7_title: 'Maklumat dan literasi kesihatan', sq7: 'Seberapa baik anda memahami arahan pengambilan ubat anda?',
    sq7_opts: ['Faham sepenuhnya dan boleh menerangkan kepada orang lain', 'Faham kebanyakan arahan', 'Faham sebahagian tetapi mempunyai soalan tentang beberapa bahagian', 'Sering keliru atau tidak pasti bagaimana untuk mengambilnya'],
    sq8_title: 'Kepercayaan pematuhan',          sq8: 'Sejauh manakah anda percaya bahawa ubat itu perlu dan akan membantu anda?',
    sq8_opts: ['Sangat percaya ia perlu dan berkesan', 'Umumnya fikir ia membantu', 'Tidak pasti sama ada ia membantu', 'Sering meragui keperluannya atau keberkesanannya'],
    pairing_title: '⚠ Protokol pemadanan pesakit',
    pairing_body: 'Pesakit mesti terlebih dahulu melengkapkan penilaian MMAS-8 untuk menerima ID pesakit. ID ini menghubungkan data pematuhan MMAS-8 dengan keputusan PEACS untuk analisis longitudinal antara instrumen.',
    patient_id_label: 'ID pesakit',
    patient_id_hint: '(Diisi secara automatik dari sesi MMAS · boleh diedit)',
    submit_btn: 'Hantar penilaian PEACS →',
  },
  tl: {
    name: 'Filipino', native: 'Filipino', dir: 'ltr',
    base_intro: 'Ngayon ay magtatanong ako sa iyo ng ilang katanungan tungkol sa mga gawi at rutina na karaniwang sinusunod mo kapag iniinom ang gamot na ito. Isipin kung ano ang karaniwang nangyayari para sa iyo (sa nakalipas na isang buwan). Walang tama o maling sagot; sagutin nang makatotohanan hangga\'t maaari.',
    mvmt_intro: 'Ang mga sumusunod na tanong ay may kaugnayan sa iyong karanasan sa pag-inom ng gamot sa nakalipas na 7 araw...',
    strata_intro: 'Pagkatapos ay magtatanong kami tungkol sa suporta, kondisyon ng tirahan, transportasyon, pananalapi, at pag-unawa sa paggamot.',
    base_opts: ['Oo', 'Minsan', 'Hindi'],
    mvmt_opts: ['Hindi', 'Oo, isang beses', 'Oo, mahigit isang beses'],
    base_dim: 'BASE — Pagtatasa ng Arkitektura at Katatagan ng Gawi',
    base_period: 'Nakalipas na 30 araw · 7 tanong · Istraktura ng gawi',
    mvmt_dim: 'MVMT — Nasusukat na Pinakamababang Pagkakaiba',
    mvmt_period: 'Nakalipas na 7 araw · 7 tanong · Katumpakan sa oras',
    strata_dim: 'STRATA — Panlipunan, Relasyon, at Kontekstwal na Pag-access sa Paggamot',
    strata_period: 'Kasalukuyang quarter · 8 tanong · Apat na antas na pag-angkla',
    bq1_title: 'Arkitektura ng memorya',         bq1: 'Maaasahan mo bang maaalala ang pag-inom ng gamot ayon sa iskedyul, kahit sa masisikap na araw?',
    bq2_title: 'Katatagan ng rutina',            bq2: 'Pinapanatili mo ba ang pare-parehong rutina sa pag-inom ng gamot kapag nagbago ang iyong pang-araw-araw na iskedyul?',
    bq3_title: 'Pagtutol sa sintomas',           bq3: 'Kapag nagsimula kang makaramdam ng mas maganda, patuloy ka pa rin bang umiinom ng gamot nang eksakto ayon sa inireseta?',
    bq4_title: 'Angkop na kakayahang umangkop',  bq4: 'Maaari mo bang i-adjust ang iyong pang-araw-araw na rutina upang matiyak ang pag-inom ng gamot kapag nagbago ang iskedyul?',
    bq5_title: 'Pagtitiis sa epekto ng gamot',   bq5: 'Kung mayroon kang epekto ng gamot, maaari ka bang magpatuloy ng paggamot habang hinaharap ang mga ito?',
    bq6_title: 'Integrasyon ng gawi',            bq6: 'Ang pag-inom ng gamot ba ay natural na akma sa iyong pang-araw-araw na buhay?',
    bq7_title: 'Istraktura ng paghahanda',       bq7: 'Regular ka bang nagtatago ng reserba ng gamot upang maiwasang maubusan?',
    mq1_title: 'Pagkakatulad sa oras',           mq1: 'Sa nakalipas na 7 araw, nahirapan ka bang uminom ng gamot sa parehong oras araw-araw?',
    mq2_title: 'Pagsunod sa dosis',              mq2: 'Sa nakalipas na 7 araw, napalampas mo ba ang anumang dosis?',
    mq3_title: 'Paglaktaw dahil sa sintomas',    mq3: 'Sa nakalipas na 7 araw, huminto ka ba o nakalaktaw ng gamot dahil nakaramdam ng mas maganda?',
    mq4_title: 'Reaksyon sa epekto ng gamot',    mq4: 'Sa nakalipas na 7 araw, huminto ka ba o nakalaktaw ng gamot dahil sa epekto ng gamot?',
    mq5_title: 'Pagkagambala ng kapaligiran',    mq5: 'Sa nakalipas na 7 araw, ang paglalakbay, pagkawala, o kapaligiran ba ay nagdulot ng paglaktaw ng dosis?',
    mq6_title: 'Pag-angkop ng iskedyul',         mq6: 'Sa nakalipas na 7 araw, nahirapan ka bang i-adjust ang rutina para sa pag-inom ng gamot kapag nagbago ang iskedyul?',
    mq7_title: 'Pang-araw-araw na integrasyon',  mq7: 'Sa nakalipas na 7 araw, ang pag-inom ng gamot ba ay parang pabigat o hindi natural na akma sa pang-araw-araw na buhay?',
    sq1_title: 'Pangunahing tagasuporta',        sq1: 'Sino ang tumutulong sa iyo na maalalang o pamahalaan ang gamot?',
    sq1_opts: ['Asawa o kasosyo', 'Matatandang anak o ibang miyembro ng pamilya', 'Kaibigan, kapitbahay, o tagapag-alaga', 'Hinahawakan nang nagsasarili'],
    sq2_title: 'Dalas ng pakikipag-ugnayan',     sq2: 'Gaano kadalas ka nagkakaroon ng makabuluhang pakikipag-ugnayan sa pamilya o mga kaibigan?',
    sq2_opts: ['Araw-araw o ilang beses sa isang linggo', 'Isang beses sa isang linggo', 'Ilang beses sa isang buwan', 'Bihirang-bihira o halos hindi kailanman'],
    sq3_title: 'Sitwasyon sa tirahan',           sq3: 'Ano ang iyong kasalukuyang sitwasyon sa tirahan?',
    sq3_opts: ['Nakatira kasama ang asawa o mga miyembro ng pamilya', 'Nakatira mag-isa ngunit pamilya o suporta ay malapit', 'Protektadong tirahan o pinamamahalaang pag-aalaga', 'Nakatira mag-isa, pamilya ay malayo o sa pansamantalang tirahan'],
    sq4_title: 'Network sa emerhensiya',         sq4: 'Kung mayroon kang medikal na emerhensiya, sino ang makakaalam at makakatulong?',
    sq4_opts: ['Ilang tao na mabilis na tutugon', 'Hindi bababa sa isang tao na tutugon', 'May isang tao na kalaunan ay mapapansin', 'Marahil walang sinuman o tiyak na walang sinuman'],
    sq5_title: 'Accessibility ng transportasyon', sq5: 'Paano ka karaniwang pumupunta sa medikal na appointment o parmasya?',
    sq5_opts: ['Nagmamaneho ng sarili o may mapagkakatiwalaang at nababaluktot na transportasyon', 'Pamilya o mga kaibigan ang nagdadala, o available ang pampublikong transportasyon', 'Medikal na transportasyon, taksi, o may kahirapan', 'Hindi makarating nang may katiyakan sa appointment o parmasya'],
    sq6_title: 'Pagpapatuloy ng pag-aalaga',     sq6: 'Gaano ka kapaki-pakinabang na makuha ang gamot at lumahok sa mga follow-up na appointment?',
    sq6_opts: ['Ang gamot at appointment ay palaging available kapag kailangan', 'Karaniwang available na may paminsan-minsang pagkaantala o kahirapan', 'Madalas na naantala o mahirap makuha', 'Hindi maaasahan; malaking kaibahan sa access sa gamot o follow-up na pag-aalaga'],
    sq7_title: 'Impormasyon at health literacy',  sq7: 'Gaano mo kahusay na naiintindihan ang mga tagubilin sa pag-inom ng iyong gamot?',
    sq7_opts: ['Ganap na naiintindihan at kayang ipaliwanag sa iba', 'Naiintindihan ang karamihan ng mga tagubilin', 'Naiintindihan ang ilan ngunit may mga tanong tungkol sa ilang bahagi', 'Madalas na nalilito o hindi sigurado kung paano ito inumin'],
    sq8_title: 'Paniniwala sa pagsunod',         sq8: 'Gaano mo pinaniniwalaan na ang gamot ay kailangan at makakatulong sa iyo?',
    sq8_opts: ['Matibay na naniniwala na ito ay kailangan at epektibo', 'Sa pangkalahatan ay iniisip na ito ay nakakatulong', 'Hindi sigurado kung ito ay nakakatulong', 'Madalas na nagdududa sa pangangailangan o bisa nito'],
    pairing_title: '⚠ Protokol ng pagpapares ng pasyente',
    pairing_body: 'Ang mga pasyente ay kailangang makumpleto muna ang MMAS-8 na pagtatasa upang makatanggap ng ID ng pasyente. Ang ID na ito ay nag-uugnay ng data ng pagsunod ng MMAS-8 sa mga resulta ng PEACS para sa inter-instrument na longitudinal na pagsusuri.',
    patient_id_label: 'ID ng pasyente',
    patient_id_hint: '(Awtomatikong napupuno mula sa MMAS session · maaaring i-edit)',
    submit_btn: 'Isumite ang PEACS na pagtatasa →',
  },
  sw: {
    name: 'Swahili', native: 'Kiswahili', dir: 'ltr',
    base_intro: 'Sasa nitakuuliza maswali machache kuhusu tabia na desturi unazofuata kawaida unapotumia dawa hii. Fikiria ni nini cha kawaida kwako (katika mwezi uliopita). Hakuna majibu sahihi au yasiyosahihi; jibu kwa uaminifu kadri uwezavyo.',
    mvmt_intro: 'Maswali yafuatayo yanahusiana na uzoefu wako wa kutumia dawa katika siku 7 zilizopita...',
    strata_intro: 'Kisha tutauliza maswali kuhusu msaada, hali ya makazi, usafiri, fedha, na uelewa wa matibabu.',
    base_opts: ['Ndiyo', 'Wakati mwingine', 'Hapana'],
    mvmt_opts: ['Hapana', 'Ndiyo, mara moja', 'Ndiyo, zaidi ya mara moja'],
    base_dim: 'BASE — Tathmini ya Muundo na Uthabiti wa Tabia',
    base_period: 'Siku 30 zilizopita · Maswali 7 · Muundo wa tabia',
    mvmt_dim: 'MVMT — Tofauti Ndogo Inayoweza Kupimika',
    mvmt_period: 'Siku 7 zilizopita · Maswali 7 · Usahihi wa wakati',
    strata_dim: 'STRATA — Ufikiaji wa Kijamii, Kihusiano na Muktadha kwa Matibabu',
    strata_period: 'Robo ya sasa · Maswali 8 · Nanga ya viwango vinne',
    bq1_title: 'Muundo wa kumbukumbu',           bq1: 'Je, unaweza kukumbuka kwa kuaminika kuchukua dawa kulingana na ratiba, hata siku za shughuli nyingi?',
    bq2_title: 'Uthabiti wa desturi',             bq2: 'Je, unashikilia desturi thabiti ya kuchukua dawa wakati ratiba yako ya kila siku inabadilika?',
    bq3_title: 'Upinzani wa dalili',              bq3: 'Unappoanza kuhisi vizuri zaidi, je, bado unaendelea kutumia dawa kama ilivyoagizwa?',
    bq4_title: 'Unyumbufu wa kujirekebisha',      bq4: 'Je, unaweza kurekebisha desturi yako ya kila siku ili kuhakikisha unachukua dawa ratiba inapobadilika?',
    bq5_title: 'Uvumilivu wa madhara',            bq5: 'Ukipata madhara, je, unaweza kuendelea na matibabu ukiyashughulikia?',
    bq6_title: 'Muunganiko wa tabia',             bq6: 'Je, kuchukua dawa kunaingia kwa kawaida katika maisha yako ya kila siku?',
    bq7_title: 'Muundo wa maandalizi',            bq7: 'Je, unaweka akiba ya dawa mara kwa mara ili kuzuia kukosa?',
    mq1_title: 'Uthabiti wa wakati',              mq1: 'Katika siku 7 zilizopita, je, ulikuwa na ugumu wa kuchukua dawa kwa wakati mmoja kila siku?',
    mq2_title: 'Kufuata kipimo',                 mq2: 'Katika siku 7 zilizopita, je, ulisahau kipimo chochote?',
    mq3_title: 'Kuruka kwa sababu ya dalili',     mq3: 'Katika siku 7 zilizopita, je, ulisimama au kuruka dawa kwa sababu ulihisi vizuri zaidi?',
    mq4_title: 'Mwitikio wa madhara',             mq4: 'Katika siku 7 zilizopita, je, ulisimama au kuruka dawa kwa sababu ya madhara?',
    mq5_title: 'Usumbufu wa mazingira',           mq5: 'Katika siku 7 zilizopita, je, safari, kutokuwepo au mazingira yalisababisha kukosa kipimo?',
    mq6_title: 'Kurekebisha ratiba',              mq6: 'Katika siku 7 zilizopita, je, ulikuwa na ugumu wa kurekebisha desturi ya kuchukua dawa ratiba ilipobadilika?',
    mq7_title: 'Muunganiko wa kila siku',         mq7: 'Katika siku 7 zilizopita, je, kuchukua dawa kulionekana kama mzigo au halikuingia kwa kawaida katika maisha ya kila siku?',
    sq1_title: 'Msaidizi mkuu',                  sq1: 'Ni nani anayekusaidia kukumbuka au kusimamia dawa yako?',
    sq1_opts: ['Mume/mke au mpenzi', 'Mtoto mzima au mwanafamilia mwingine', 'Rafiki, jirani, au mlezi', 'Ninashughulikia kwa kujitegemea'],
    sq2_title: 'Mara kwa mara ya mawasiliano',   sq2: 'Mara ngapi una mawasiliano ya maana na familia au marafiki?',
    sq2_opts: ['Kila siku au mara kadhaa kwa wiki', 'Mara moja kwa wiki', 'Mara kadhaa kwa mwezi', 'Mara chache au karibu kamwe'],
    sq3_title: 'Hali ya makazi',                 sq3: 'Hali yako ya sasa ya makazi ni nini?',
    sq3_opts: ['Ninaishi na mume/mke au wanafamilia', 'Ninaishi peke yangu lakini familia au msaada uko karibu', 'Makazi ya kulindwa au ya utunzaji uliosimamiwa', 'Ninaishi peke yangu, familia iko mbali au katika makazi ya muda'],
    sq4_title: 'Mtandao wa dharura',             sq4: 'Kama ukipata dharura ya kimatibabu, ni nani atakayejua na kuweza kusaidia?',
    sq4_opts: ['Watu kadhaa ambao watajibu haraka', 'Angalau mtu mmoja atakayejibu', 'Mtu ambaye hatimaye ataona', 'Labda hakuna au hakika hakuna'],
    sq5_title: 'Upatikanaji wa usafiri',         sq5: 'Kawaida unafikia vipi miadi ya kimatibabu au duka la dawa?',
    sq5_opts: ['Ninaendesha mwenyewe au nina usafiri wa kuaminika na wa kubadilika', 'Familia au marafiki wanabeba, au usafiri wa umma unapatikana', 'Usafiri wa kimatibabu, teksi, au kwa shida', 'Siwezi kufikia miadi au duka la dawa kwa kuaminika'],
    sq6_title: 'Mwendelezo wa utunzaji',          sq6: 'Ni kwa kiasi gani unaweza kwa kuaminika kupata dawa na kuhudhuria miadi ya ufuatiliaji?',
    sq6_opts: ['Dawa na miadi inapatikana kila wakati inapohitajika', 'Kwa ujumla inapatikana na ucheleweshaji au ugumu wa mara kwa mara', 'Mara nyingi huchelewa au ni vigumu kupata', 'Haiaminiwi; mapungufu makubwa katika ufikiaji wa dawa au utunzaji wa ufuatiliaji'],
    sq7_title: 'Taarifa na ujuzi wa afya',        sq7: 'Je, unaelewa jinsi gani maelekezo ya kuchukua dawa yako?',
    sq7_opts: ['Naelewa kikamilifu na ninaweza kueleza kwa wengine', 'Naelewa maelekezo mengi', 'Naelewa baadhi lakini nina maswali kuhusu sehemu zingine', 'Mara nyingi ninachanganyikiwa au sina uhakika jinsi ya kuchukua'],
    sq8_title: 'Imani za kufuata',               sq8: 'Kwa kiasi gani unaamini kwamba dawa ni muhimu na itakusaidia?',
    sq8_opts: ['Ninaamini sana kwamba ni muhimu na yenye ufanisi', 'Kwa ujumla ninafikiria inasaidia', 'Siko uhakika kama inasaidia', 'Mara nyingi ninashuku haja yake au ufanisi wake'],
    pairing_title: '⚠ Itifaki ya kuoanisha mgonjwa',
    pairing_body: 'Wagonjwa lazima kwanza wakamilishe tathmini ya MMAS-8 ili kupokea kitambulisho cha mgonjwa. Kitambulisho hiki kinaunganisha data ya kufuata ya MMAS-8 na matokeo ya PEACS kwa uchambuzi wa longitudinal kati ya vyombo.',
    patient_id_label: 'Kitambulisho cha mgonjwa',
    patient_id_hint: '(Inajaza kiotomatiki kutoka kwa kipindi cha MMAS · inaweza kuhaririwa)',
    submit_btn: 'Wasilisha tathmini ya PEACS →',
  },
};

function setPeacsLang(lang) {
  if (!PEACS_QUESTIONS[lang]) return;
  peacsCurrentLang = lang;
  const sel = document.getElementById('peacs-lang-select');
  if (sel) sel.value = lang;
}

function buildPeacsLangSelect() {
  const sel = document.getElementById('peacs-lang-select');
  if (!sel) return;
  sel.innerHTML = '';
  Object.entries(PEACS_QUESTIONS)
    .sort((a,b) => a[1].name.localeCompare(b[1].name))
    .forEach(([code, d]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = d.name + (d.native !== d.name ? ` — ${d.native}` : '');
      if (code === peacsCurrentLang) opt.selected = true;
      sel.appendChild(opt);
    });
  sel.addEventListener('change', () => {
    peacsCurrentLang = sel.value;
    // Re-render assessment if currently on assess tab
    const content = document.getElementById('peacs-tab-content');
    if (content && document.querySelector('#peacs-tab-bar .tab-btn.active')?.dataset.tab === 'assess') {
      content.innerHTML = renderPeacsAssessment();
      updatePeacsFloater();
      // Restore any answers already given
      Object.entries(peacsState.base).forEach(([id,val])=>{
        const btn=document.querySelector(`.peacs-q-opt[data-id="${id}"][data-val="${val}"]`);
        if(btn){btn.classList.add('selected');btn.closest('.peacs-q-card')?.classList.add('answered');}
      });
      Object.entries(peacsState.mvmt).forEach(([id,val])=>{
        const btn=document.querySelector(`.peacs-q-opt[data-id="${id}"][data-val="${val}"]`);
        if(btn){btn.classList.add('selected');btn.closest('.peacs-q-card')?.classList.add('answered');}
      });
      Object.entries(peacsState.strata).forEach(([id,val])=>{
        const btn=document.querySelector(`.peacs-q-opt[data-id="${id}"][data-val="${val}"]`);
        if(btn){btn.classList.add('selected');btn.closest('.peacs-q-card')?.classList.add('answered');}
      });
    }
  });
}

const BASE_QS = [
  {id:'bq1',title:'Memory Architecture',    question:'Do you reliably remember to take your medication as scheduled, even on stressful days?',                          opts:['Yes','Sometimes','No']},
  {id:'bq2',title:'Routine Stability',       question:'Do you maintain a consistent routine for taking your medication when your daily schedule changes?',                opts:['Yes','Sometimes','No']},
  {id:'bq3',title:'Symptom Resilience',      question:'If you begin to feel better, do you continue your medication exactly as prescribed?',                             opts:['Yes','Sometimes','No']},
  {id:'bq4',title:'Adaptive Flexibility',    question:'Can you adapt your daily routine to make sure you take your medication when your schedule shifts?',                opts:['Yes','Sometimes','No']},
  {id:'bq5',title:'Side-Effect Tolerance',   question:'If you experience side effects, can you continue treatment while managing them?',                                 opts:['Yes','Sometimes','No']},
  {id:'bq6',title:'Behavioral Integration',  question:'Does taking medication fit naturally into your daily life?',                                                       opts:['Yes','Sometimes','No']},
  {id:'bq7',title:'Preparedness Structure',  question:"Do you routinely keep a backup supply so you don't run out of medication?",                                       opts:['Yes','Sometimes','No']},
];
const MVMT_QS = [
  {id:'mq1',title:'Timing Consistency',      question:'In the past 7 days, did you have trouble taking your medication at the same time each day?',                      opts:['No','Yes, once','Yes, more than once']},
  {id:'mq2',title:'Dose Completion',          question:'In the past 7 days, did you miss any doses?',                                                                    opts:['No','Yes, once','Yes, more than once']},
  {id:'mq3',title:'Symptom-Based Skipping',  question:'In the past 7 days, did you skip or stop taking medication because you felt better?',                             opts:['No','Yes, once','Yes, more than once']},
  {id:'mq4',title:'Side-Effect Response',    question:'In the past 7 days, did you stop or skip medication because of side effects?',                                    opts:['No','Yes, once','Yes, more than once']},
  {id:'mq5',title:'Environmental Disruption',question:'In the past 7 days, did travel, being away, or your environment cause you to miss medication?',                   opts:['No','Yes, once','Yes, more than once']},
  {id:'mq6',title:'Schedule Adaptation',     question:'In the past 7 days, did you have difficulty adjusting your routine to take medication when your schedule changed?',opts:['No','Yes, once','Yes, more than once']},
  {id:'mq7',title:'Daily Integration',       question:'In the past 7 days, did taking medication feel like a hassle or not fit naturally into daily life?',               opts:['No','Yes, once','Yes, more than once']},
];
const STRATA_QS = [
  {id:'sq1',title:'Primary Support Person',  question:'Who helps you remember or manage your medications?',
    opts:[['Spouse',1.00],['Adult child or other family member',0.67],['Friend, neighbor, or caregiver',0.33],['I manage independently',0.00]]},
  {id:'sq2',title:'Contact Frequency',       question:'How often do you have meaningful contact with family or friends?',
    opts:[['Daily or several times per week',1.00],['Once per week',0.67],['A few times per month',0.33],['Rarely or almost never',0.00]]},
  {id:'sq3',title:'Living Situation',        question:'What is your current living arrangement?',
    opts:[['Live with spouse or family members',1.00],['Live alone with family or support nearby',0.67],['Assisted or supported living arrangement',0.33],['Live alone with family far away, or in temporary/transitional housing',0.00]]},
  {id:'sq4',title:'Emergency Contact Network',question:'If you had a medical emergency, who would know and be able to help?',
    opts:[['Multiple people who would respond quickly',1.00],['At least one person who would respond',0.67],['Someone who might eventually notice',0.33],['Probably no one or definitely no one',0.00]]},
  {id:'sq5',title:'Transportation Access',   question:'How do you usually get to medical appointments or the pharmacy?',
    opts:[['I drive myself or have reliable, flexible transport',1.00],['Family or friends provide transport, or public transport is available',0.67],['Medical transport, taxi, or transport obtained with difficulty',0.33],['Cannot reliably get to appointments or pharmacy',0.00]]},
  {id:'sq6',title:'Treatment Continuity',    question:'How reliably can you get your medications and attend follow-up appointments when needed?',
    opts:[['Medications and appointments are reliably available when needed',1.00],['Usually available but with occasional delays or difficulties',0.67],['Frequently delayed or difficult to access',0.33],['Unreliable; significant gaps in access to medications or follow-up',0.00]]},
  {id:'sq7',title:'Information & Literacy',  question:'How well do you understand the instructions for taking your medications?',
    opts:[['Completely understand and can explain to others',1.00],['Understand most instructions',0.67],['Understand some but am uncertain about parts',0.33],['Often confused or uncertain about how to take medication',0.00]]},
  {id:'sq8',title:'Adherence Beliefs',       question:'How strongly do you believe your medication is necessary and will help you?',
    opts:[['Strongly believe it is necessary and effective',1.00],['Generally believe it helps',0.67],['Uncertain whether it is helping',0.33],['Often doubt its necessity or effectiveness',0.00]]},
];

const BM = {'Yes':1.00,'Sometimes':0.50,'No':0.00};
const MM = {'No':1.00,'Yes, once':0.50,'Yes, more than once':0.00};

// Question ID → dimension lookup (used by the MAP inference engine)
const _PEACS_QID_DIM = {};
BASE_QS.forEach(q   => { _PEACS_QID_DIM[q.id] = 'base';   });
MVMT_QS.forEach(q   => { _PEACS_QID_DIM[q.id] = 'mvmt';   });
STRATA_QS.forEach(q => { _PEACS_QID_DIM[q.id] = 'strata'; });

// ── MAP→PEACS CROSS-INFERENCE ─────────────────────────────────────────────────
// Reads MAP answers (window.mapAnswers, set in assess.html) and derives PEACS
// pre-selections. Called at the start of renderPeacsAssessment() so that
// peacsQCard() can mark the correct buttons when building the HTML string.
//
// Mapping rationale (MAP stored values: 1 = adherent, 0 = non-adherent):
//   BASE
//     bq1 Memory Architecture      ← map_q1 (forget)             1→"Yes"  0→"No"
//     bq3 Symptom Resilience       ← map_q6 (pause when better)  1→"Yes"  0→"No"
//     bq4 Adaptive Flexibility     ← map_q4 (hard when routine changes) 1→"Yes" 0→"No"
//     bq5 Side-Effect Tolerance    ← map_q3 (stopped on own)     1→"Yes"  0→"No"
//     bq6 Behavioral Integration   ← map_q7 (big challenge)      1→"Yes"  0→"No"
//   MVMT (binary MAP → conservative MVMT: 0 maps to "Yes, once" not "Yes, more than once")
//     mq2 Dose Completion          ← map_q2 (intentional skip)   1→"No"   0→"Yes, once"
//     mq3 Symptom-Based Skipping   ← map_q6 (pause when better)  1→"No"   0→"Yes, once"
//     mq4 Side-Effect Response     ← map_q3 (stopped on own)     1→"No"   0→"Yes, once"
//     mq5 Environmental Disruption ← map_q4 (routine/travel)     1→"No"   0→"Yes, once"
//     mq7 Daily Integration        ← map_q7 (big challenge)      1→"No"   0→"Yes, once"
function _buildMapInference() {
  window._peacsMapInference = {};
  const ma = window.mapAnswers;
  if (!ma || typeof ma !== 'object' || !Object.keys(ma).length) return;

  const v   = k => parseFloat(ma[k] ?? NaN);
  const has = k => !isNaN(v(k));

  // BASE
  if (has('map_q1')) window._peacsMapInference.bq1 = v('map_q1') >= 1 ? 'Yes' : 'No';
  if (has('map_q6')) window._peacsMapInference.bq3 = v('map_q6') >= 1 ? 'Yes' : 'No';
  if (has('map_q4')) window._peacsMapInference.bq4 = v('map_q4') >= 1 ? 'Yes' : 'No';
  if (has('map_q3')) window._peacsMapInference.bq5 = v('map_q3') >= 1 ? 'Yes' : 'No';
  if (has('map_q7')) window._peacsMapInference.bq6 = v('map_q7') >= 1 ? 'Yes' : 'No';

  // MVMT
  if (has('map_q2')) window._peacsMapInference.mq2 = v('map_q2') >= 1 ? 'No' : 'Yes, once';
  if (has('map_q6')) window._peacsMapInference.mq3 = v('map_q6') >= 1 ? 'No' : 'Yes, once';
  if (has('map_q3')) window._peacsMapInference.mq4 = v('map_q3') >= 1 ? 'No' : 'Yes, once';
  if (has('map_q4')) window._peacsMapInference.mq5 = v('map_q4') >= 1 ? 'No' : 'Yes, once';
  if (has('map_q7')) window._peacsMapInference.mq7 = v('map_q7') >= 1 ? 'No' : 'Yes, once';
}

// ── INTAKE→PEACS CROSS-INFERENCE ─────────────────────────────────────────────
// Reads social-support answers collected in the MAP SDoH intake form
// (window._sessionData, populated by _submitMAPCore) and derives PEACS
// pre-selections for questions that were not already covered by MAP inference.
//
// Mapping:
//   STRATA
//     sq1 Primary Support Person   ← sdoh_sq1  (1 / 0.67 / 0.33 / 0)
//     sq2 Contact Frequency        ← sdoh_sq2  (1 / 0.67 / 0.33 / 0)
//     sq3 Living Situation         ← sdoh_sq3  (1 / 0.67 / 0.33 / 0)
//     sq4 Emergency Contact Network← sdoh_sq4  (1 / 0.67 / 0.33 / 0)
//   BASE
//     bq7 Preparedness Structure   ← sdoh_bq7  ("Yes" / "Sometimes" / "No")
function _buildIntakeInference() {
  window._peacsIntakeInference = {};
  const sd = window._sessionData;
  if (!sd || typeof sd !== 'object') return;
  // STRATA — numeric string values must match String(opt[1]) in peacsQCard
  if (sd.sq1 && sd.sq1 !== '') window._peacsIntakeInference.sq1 = sd.sq1;
  if (sd.sq2 && sd.sq2 !== '') window._peacsIntakeInference.sq2 = sd.sq2;
  if (sd.sq3 && sd.sq3 !== '') window._peacsIntakeInference.sq3 = sd.sq3;
  if (sd.sq4 && sd.sq4 !== '') window._peacsIntakeInference.sq4 = sd.sq4;
  // BASE — text values must match engOpts strings in peacsQCard
  if (sd.bq7 && sd.bq7 !== '') window._peacsIntakeInference.bq7 = sd.bq7;
}

function _buildGeoInference() {
  window._peacsGeoInference = {};
  const sd = window._sessionData;
  if (!sd || typeof sd !== 'object') return;
  // STRATA — numeric string values matching String(opt[1]) in peacsQCard
  if (sd.sq5 !== undefined && sd.sq5 !== '') window._peacsGeoInference.sq5 = sd.sq5;
  if (sd.sq6 !== undefined && sd.sq6 !== '') window._peacsGeoInference.sq6 = sd.sq6;
}

// Write BOTH the MAP inference map AND the intake inference map into peacsState
// so live scores reflect pre-selections immediately. Only sets questions that
// are not already answered. Called after HTML injection.
function _applyMapInferenceToPeacsState() {
  let applied = 0;
  const mapInf = window._peacsMapInference;
  if (mapInf && Object.keys(mapInf).length) {
    Object.entries(mapInf).forEach(([qid, val]) => {
      const dim = _PEACS_QID_DIM[qid];
      if (!dim) return;
      if (peacsState[dim][qid] === undefined) { peacsState[dim][qid] = val; applied++; }
    });
  }
  const intakeInf = window._peacsIntakeInference;
  if (intakeInf && Object.keys(intakeInf).length) {
    Object.entries(intakeInf).forEach(([qid, val]) => {
      const dim = _PEACS_QID_DIM[qid];
      if (!dim) return;
      if (peacsState[dim][qid] === undefined) { peacsState[dim][qid] = val; applied++; }
    });
  }
  const geoInf = window._peacsGeoInference;
  if (geoInf && Object.keys(geoInf).length) {
    Object.entries(geoInf).forEach(([qid, val]) => {
      const dim = _PEACS_QID_DIM[qid];
      if (!dim) return;
      if (peacsState[dim][qid] === undefined) { peacsState[dim][qid] = val; applied++; }
    });
  }
  if (applied > 0) updatePeacsFloater();
}

// peacsState declared above at module scope

// Guard against extra keys (future feature tags, ZOE metadata) poisoning the count.
// Check that every specific question ID is present rather than relying on raw Object.keys length.
const calcBase   = r => BASE_QS.every(q => r[q.id] !== undefined)   ? BASE_QS.reduce((s,q)=>s+(BM[r[q.id]]??0),0)/7   : null;
const calcMvmt   = r => MVMT_QS.every(q => r[q.id] !== undefined)   ? MVMT_QS.reduce((s,q)=>s+(MM[r[q.id]]??0),0)/7   : null;
const calcStrata = r => STRATA_QS.every(q => r[q.id] !== undefined) ? STRATA_QS.reduce((s,q)=>s+(parseFloat(r[q.id])??0),0)/8 : null;
const calcPE     = (b,m,s) => (b===null||m===null||s===null) ? null : Math.pow(Math.max(0,b)*Math.max(0,m)*Math.max(0,s),1/3);

function getPeZone(pe) {
  if (pe===null||pe===undefined) return {label:'—',color:'#4a4a6a'};
  if (pe>=0.85) return {label:'Optimal Alignment',    color:'#10b981'};
  if (pe>=0.70) return {label:'Good Alignment',       color:'#3b82f6'};
  if (pe>=0.55) return {label:'Moderate Alignment',   color:'#f59e0b'};
  if (pe>=0.40) return {label:'Poor Alignment',       color:'#ef4444'};
  return        {label:'Critical Misalignment',       color:'#991b1b'};
}

function getPeacsDiag(pe, b, m, s) {
  const dims = [{score:b,n:'BASE',l:'Behavioral Architecture'},{score:m,n:'MVMT',l:'Execution Consistency'},{score:s,n:'STRATA',l:'Support Network'}];
  const weak = dims.reduce((a,c)=>a.score<=c.score?a:c);
  if (pe>=0.70) return {primary:'Strong Adherence Capacity',type:'Maintenance & Monitoring',actions:['Continue current regimen with periodic assessment','Reinforce existing behavioral patterns','Proactive monitoring for environmental changes','Build on patient confidence and self-efficacy']};
  if (pe>=0.55) {
    const mp = {
      BASE: {primary:'Behavioral Architecture Deficit',type:'Habit Formation Focus',actions:['Implementation intentions ("If X, then take medication")','Environmental restructuring — visible placement','Habit stacking — link to existing daily routines','Gradual complexity reduction']},
      MVMT: {primary:'Temporal Execution Instability',type:'Reminder & Timing Systems',actions:['Electronic reminder systems (phone alarms, SMS)','Smart pill bottles with alarm timers','Dose timing optimization','Travel medication kits']},
      STRATA:{primary:'Support Network Deficit',type:'Social-Environmental Intervention',actions:['Social work referral for resource navigation','Family/caregiver education and engagement','Community pharmacy partnership','Transportation assistance programs']},
    };
    return mp[weak.n];
  }
  if (pe>=0.40) return {primary:`Multi-Dimensional Deficit (Primary: ${weak.l})`,type:'Comprehensive Care Coordination',actions:[`Focus intervention on ${weak.l}`,'Care coordinator assignment','Weekly check-in calls','Medication regimen simplification review','Patient assistance program referral']};
  return {primary:'Critical Adherence Risk',type:'Intensive Support Protocol',actions:['Immediate care team consultation','Consider supervised dosing or home health','Comprehensive social services evaluation','Alternative formulation review (long-acting, combination)','Emergency support network establishment']};
}

// ── PHENOTYPE CONFIDENCE SCORING ──────────────────────────────────────────────
/**
 * Computes relative confidence scores (0-1) for all 5 PEACS phenotypes based on
 * the BASE, MVMT, and STRATA dimension scores of a record.
 * Returns { primary: string, scores: { [phenotype]: number } }
 * @param {Object} record - PEACS record with base, mvmt, strata (0-1) fields
 * @returns {{ primary: string, scores: Object.<string, number> }}
 */
function _peacsComputeConfidence(record) {
  const b = parseFloat(record.base)   || 0;
  const m = parseFloat(record.mvmt)   || 0;
  const s = parseFloat(record.strata) || 0;

  // For Optimistic Stopper, we need trajectory info — use pe as a proxy.
  // High PE with declining signal: use composite pe value relative to dims.
  const pe = parseFloat(record.pe) || Math.pow(Math.max(0, b * m * s), 1/3);

  // Raw affinity scores per phenotype based on domain pattern
  // Intentional Resistor:  low BASE, moderate MVMT, moderate STRATA
  const irScore = (1 - b) * 0.6 + (1 - Math.abs(m - 0.5)) * 0.2 + (1 - Math.abs(s - 0.5)) * 0.2;

  // Routine Forgetter:  moderate BASE, very low MVMT, moderate STRATA
  const rfScore = (1 - Math.abs(b - 0.6)) * 0.2 + (1 - m) * 0.6 + (1 - Math.abs(s - 0.55)) * 0.2;

  // Situational Skipper:  high BASE, oscillating MVMT, high STRATA
  const ssScore = b * 0.35 + (1 - Math.abs(m - 0.5)) * 0.3 + s * 0.35;

  // Side-Effect Avoider:  low BASE (fear-driven), low-moderate MVMT, low-moderate STRATA
  const seScore = (1 - b) * 0.5 + (1 - Math.abs(m - 0.4)) * 0.25 + (1 - Math.abs(s - 0.5)) * 0.25;

  // Optimistic Stopper:  high PE but low trajectory — high starting PE relative to current
  // Approximate with: moderately high BASE but lower m+s relative to b
  const osScore = b * 0.5 + (b > 0 ? Math.max(0, b - (m + s) / 2) : 0) * 0.5;

  const rawMap = {
    'Intentional Resistor':  Math.max(0, irScore),
    'Routine Forgetter':     Math.max(0, rfScore),
    'Situational Skipper':   Math.max(0, ssScore),
    'Side-Effect Avoider':   Math.max(0, seScore),
    'Optimistic Stopper':    Math.max(0, osScore),
  };

  const total = Object.values(rawMap).reduce((a, v) => a + v, 0) || 1;
  const scores = {};
  let primary = 'Routine Forgetter';
  let maxScore = -1;
  for (const [name, raw] of Object.entries(rawMap)) {
    scores[name] = raw / total;
    if (scores[name] > maxScore) { maxScore = scores[name]; primary = name; }
  }
  return { primary, scores };
}

/**
 * Renders a horizontal confidence bar chart for all 5 PEACS phenotypes.
 * The primary phenotype row is highlighted. Uses inline CSS.
 * @param {{ primary: string, scores: Object.<string, number> }} conf - Output of _peacsComputeConfidence
 * @returns {string} HTML string
 */
function _peacsConfidenceBar(conf) {
  const PHENOTYPE_COLORS = {
    'Intentional Resistor': '#ef4444',
    'Routine Forgetter':    '#f59e0b',
    'Situational Skipper':  '#8b6ff5',
    'Side-Effect Avoider':  '#3b82f6',
    'Optimistic Stopper':   '#10b981',
  };
  const rows = Object.entries(conf.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, pct]) => {
      const isPrimary = name === conf.primary;
      const col = PHENOTYPE_COLORS[name] || '#6b8099';
      const pctStr = (pct * 100).toFixed(1) + '%';
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <div style="width:130px;font-family:'IBM Plex Mono\',monospace;font-size:0.72rem;color:${isPrimary ? col : 'rgba(200,214,232,0.45)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;">${name}</div>
        <div style="flex:1;height:10px;background:rgba(255,255,255,0.04);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${(pct * 100).toFixed(1)}%;background:${col};opacity:${isPrimary ? '0.85' : '0.35'};border-radius:4px;transition:width 0.4s;"></div>
        </div>
        <div style="width:38px;text-align:right;font-family:'IBM Plex Mono\',monospace;font-size:0.72rem;color:${isPrimary ? col : 'rgba(200,214,232,0.4)'};">${pctStr}</div>
      </div>`;
    }).join('');

  return `<div style="margin:12px 0;padding:12px 14px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
    <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(200,214,232,0.4);margin-bottom:9px;">Phenotype Confidence</div>
    ${rows}
  </div>`;
}


function peacsQCard(q, dim) {
  const L = PEACS_QUESTIONS[peacsCurrentLang] || PEACS_QUESTIONS.en;
  const isStrata     = dim === 'strata';
  const questionText = L[q.id] || q.question;
  const titleText    = L[q.id + '_title'] || q.title;

  // Determine inference source — MAP > intake > geo (geo is least trusted, most easily overridden)
  const mapInferredVal    = (window._peacsMapInference    || {})[q.id];
  const intakeInferredVal = (window._peacsIntakeInference || {})[q.id];
  const geoInferredVal    = (window._peacsGeoInference    || {})[q.id];
  const inferredVal  = mapInferredVal !== undefined ? mapInferredVal : (intakeInferredVal !== undefined ? intakeInferredVal : geoInferredVal);
  const inferSource  = mapInferredVal !== undefined ? 'map' : (intakeInferredVal !== undefined ? 'intake' : (geoInferredVal !== undefined ? 'geo' : null));
  const isInferred   = inferSource !== null;

  let opts;
  if (isStrata) {
    const translatedOpts = L[q.id + '_opts'];
    opts = q.opts.map(([_label, val], idx) => {
      const label = translatedOpts ? translatedOpts[idx] : _label;
      const sel   = isInferred && String(val) === String(inferredVal) ? ' selected' : '';
      return `<button class="peacs-q-opt${sel}" data-dim="${dim}" data-id="${q.id}" data-val="${val}" onclick="selectPeacsOpt(this)">${label}</button>`;
    }).join('');
  } else {
    const engOpts  = dim === 'base' ? ['Yes','Sometimes','No'] : ['No','Yes, once','Yes, more than once'];
    const dispOpts = dim === 'base' ? (L.base_opts || engOpts) : (L.mvmt_opts || engOpts);
    opts = engOpts.map((engVal, idx) => {
      const label = dispOpts[idx] || engVal;
      const sel   = isInferred && engVal === inferredVal ? ' selected' : '';
      return `<button class="peacs-q-opt${sel}" data-dim="${dim}" data-id="${q.id}" data-val="${engVal}" onclick="selectPeacsOpt(this)">${label}</button>`;
    }).join('');
  }

  const cardClass = inferSource === 'map'
    ? ' map-inferred answered'
    : inferSource === 'intake'
      ? ' intake-inferred answered'
      : inferSource === 'geo'
        ? ' geo-inferred answered'
        : '';
  const infBadge = inferSource === 'map'
    ? `<span class="peacs-inferred-badge" title="Pre-selected from MAP responses">From MAP</span>`
    : inferSource === 'intake'
      ? `<span class="peacs-inferred-badge peacs-intake-badge" title="Pre-selected from intake form">From intake</span>`
      : inferSource === 'geo'
        ? `<span class="peacs-inferred-badge peacs-geo-badge" title="Auto-scored from your location data">Near you</span>`
        : '';

  return `<div class="peacs-q-card${cardClass}" id="card-${q.id}">
    <div class="peacs-q-title">${titleText}${infBadge}</div>
    <div class="peacs-q-text">${questionText}</div>
    <div class="peacs-q-opts">${opts}</div>
  </div>`;
}

function selectPeacsOpt(btn) {
  const dim = btn.dataset.dim;
  const id  = btn.dataset.id;
  const val = btn.dataset.val;
  // Deselect siblings
  btn.closest('.peacs-q-opts').querySelectorAll('.peacs-q-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const card = btn.closest('.peacs-q-card');
  card.classList.add('answered');

  // Log when patient overrides an inferred answer (MAP, intake, or geo)
  const mapInferred    = (window._peacsMapInference    || {})[id];
  const intakeInferred = (window._peacsIntakeInference || {})[id];
  const geoInferred    = (window._peacsGeoInference    || {})[id];
  const inferred   = mapInferred !== undefined ? mapInferred : (intakeInferred !== undefined ? intakeInferred : geoInferred);
  const inferSrc   = mapInferred !== undefined ? 'map' : (intakeInferred !== undefined ? 'intake' : (geoInferred !== undefined ? 'geo' : null));
  if (inferred !== undefined && val !== String(inferred)) {
    window._peacsMapOverrides = window._peacsMapOverrides || [];
    window._peacsMapOverrides.push({ qid: id, dim, source: inferSrc, inferred, chosen: val, ts: Date.now() });
    const badge = card.querySelector('.peacs-inferred-badge');
    if (badge) { badge.textContent = 'Edited'; badge.style.opacity = '0.45'; }
  }

  // Store answer
  peacsState[dim][id] = val;
  updatePeacsFloater();
}

// ── Cartographic PE Triangle ──────────────────────────
function renderPeTriangle(containerId, arch, exec, ctx) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const a = Math.max(0, Math.min(1, parseFloat(arch) || 0));
  const e = Math.max(0, Math.min(1, parseFloat(exec) || 0));
  const c = Math.max(0, Math.min(1, parseFloat(ctx)  || 0));

  // Equilateral triangle vertices (centred in 200×180 SVG)
  const cx = 100, cy = 90, R = 70;
  const pts = [
    [cx, cy - R],                                     // top    = Architecture
    [cx + R * Math.sin(Math.PI*2/3), cy + R * Math.cos(Math.PI*2/3)], // bottom-right = Execution
    [cx - R * Math.sin(Math.PI*2/3), cy + R * Math.cos(Math.PI*2/3)]  // bottom-left  = Context
  ];
  const scaled = [
    [cx + (pts[0][0]-cx)*a, cy + (pts[0][1]-cy)*a],
    [cx + (pts[1][0]-cx)*e, cy + (pts[1][1]-cy)*e],
    [cx + (pts[2][0]-cx)*c, cy + (pts[2][1]-cy)*c]
  ];
  const poly = pts.map(p=>p.join(',')).join(' ');
  const inner = scaled.map(p=>p.join(',')).join(' ');

  container.innerHTML = `
    <div class="carto-pe-triangle">
      <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid lines -->
        ${[0.25,0.5,0.75,1].map(f => {
          const sp = pts.map(p => [cx+(p[0]-cx)*f, cy+(p[1]-cy)*f].join(',')).join(' ');
          return `<polygon points="${sp}" fill="none" stroke="rgba(37,99,235,0.08)" stroke-width="1"/>`;
        }).join('')}
        <!-- Axis lines -->
        ${pts.map(p => `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="rgba(37,99,235,0.12)" stroke-width="1"/>`).join('')}
        <!-- Outer triangle -->
        <polygon points="${poly}" fill="rgba(37,99,235,0.04)" stroke="rgba(37,99,235,0.2)" stroke-width="1.5"/>
        <!-- Score area -->
        <polygon points="${inner}" fill="rgba(37,99,235,0.15)" stroke="#2563eb" stroke-width="2"/>
        <!-- Vertex dots -->
        ${scaled.map((p,i) => {
          const colors = ['#2563eb','#7c3aed','#10b981'];
          return `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${colors[i]}" stroke="white" stroke-width="1.5"/>`;
        }).join('')}
        <!-- Labels -->
        <text x="${pts[0][0]}" y="${pts[0][1]-10}" text-anchor="middle" font-size="9" font-weight="700" fill="#2563eb" font-family="monospace">ARCH ${(a*100).toFixed(0)}%</text>
        <text x="${pts[1][0]+8}" y="${pts[1][1]+4}" text-anchor="start"  font-size="9" font-weight="700" fill="#7c3aed" font-family="monospace">EXEC ${(e*100).toFixed(0)}%</text>
        <text x="${pts[2][0]-8}" y="${pts[2][1]+4}" text-anchor="end"    font-size="9" font-weight="700" fill="#10b981" font-family="monospace">CTX ${(c*100).toFixed(0)}%</text>
      </svg>
    </div>`;
}

function renderPeacsResults(b, m, s, pe) {
  const enabledDims = window._peacsEnabledDims || ['base','mvmt','strata'];
  const partialMode = enabledDims.length < 3;
  const zone = pe !== null ? getPeZone(pe) : { color: 'rgba(200,214,232,0.5)', label: 'Partial study — PE not computed' };
  const diag = pe !== null ? getPeacsDiag(pe, b, m, s) : { primary: 'Dimension recorded successfully.', type: 'Research validation mode', actions: [] };
  const fmt  = (v, dec) => v !== null ? v.toFixed(dec) : '—';
  const html = `<div class="peacs-result-card">
    <div style="font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.14em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">PEACS v2.0 · Result${partialMode ? ' · Research Mode' : ''}</div>
    ${partialMode ? `<div style="background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;color:rgba(212,168,67,0.85);">Collected: ${enabledDims.map(d=>d.toUpperCase()).join(' · ')} — dimension scores saved. PE composite requires all 3 dimensions.</div>` : ''}
    <div class="peacs-result-scores">
      ${enabledDims.includes('base')   ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--base)">${fmt(b,3)}</div><div class="peacs-score-lbl">BASE</div></div>` : ''}
      ${enabledDims.includes('mvmt')   ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--mvmt)">${fmt(m,3)}</div><div class="peacs-score-lbl">MVMT</div></div>` : ''}
      ${enabledDims.includes('strata') ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--strata)">${fmt(s,3)}</div><div class="peacs-score-lbl">STRATA</div></div>` : ''}
      ${pe !== null ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:${zone.color}">${fmt(pe,4)}</div><div class="peacs-score-lbl">PE Score</div></div>` : ''}
    </div>
    <div style="font-family:var(--font-mono);font-size:0.80rem;padding:8px 12px;border-radius:7px;background:${zone.color}18;border:1px solid ${zone.color}44;color:${zone.color};margin-bottom:16px;">${zone.label}</div>
    ${pe !== null ? `<div id="pr-pe-triangle" style="margin:14px 0;"></div>` : ''}
    ${(b !== null && m !== null && s !== null) ? _peacsConfidenceBar(_peacsComputeConfidence({base:b, mvmt:m, strata:s, pe})) : ''}
    <div class="peacs-diag-box">
      <div class="peacs-diag-title">${diag.primary}</div>
      <div class="peacs-diag-type">${diag.type}</div>
      ${diag.actions.map(a=>`<div class="peacs-diag-action"><span style="color:var(--base);flex-shrink:0">→</span>${a}</div>`).join('')}
    </div>
    ${pe !== null ? `
    <div id="pr-ai-interpret-wrap" style="margin:0 0 14px;">
      <button id="pr-ai-interpret-btn" onclick="peacsInterpretResults(${pe !== null ? pe.toFixed(4) : 'null'},${b !== null ? b.toFixed(3) : 'null'},${m !== null ? m.toFixed(3) : 'null'},${s !== null ? s.toFixed(3) : 'null'},'${zone.label}')" style="width:100%;font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.28);color:var(--mvmt);border-radius:10px;padding:11px 16px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:7px;" onmouseover="this.style.background='rgba(139,111,245,0.16)'" onmouseout="this.style.background='rgba(139,111,245,0.08)'">
        <span>✦</span><span>Interpret My Results</span>
      </button>
      <div id="pr-ai-interpret-response" style="display:none;margin-top:10px;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.28);border-radius:10px;padding:14px 16px;">
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.76rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mvmt);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span style="width:4px;height:4px;border-radius:50%;background:var(--mvmt);box-shadow:0 0 5px var(--mvmt);display:inline-block;"></span>ZOE · Interpretation
        </div>
        <div id="pr-ai-interpret-text" style="font-size:0.88rem;color:var(--text);line-height:1.65;"></div>
      </div>
    </div>` : ''}
    <button class="peacs-retake-btn" onclick="retakePeacs()">← Retake Assessment</button>
  </div>`;
  // Schedule PE triangle render after HTML is injected into the DOM
  if (pe !== null) {
    setTimeout(() => renderPeTriangle('pr-pe-triangle', b !== null ? b : 0, m !== null ? m : 0, s !== null ? s : 0), 0);
  }
  return html;
}

// ── ✦ PEACS AI Interpretation handler ────────────────────────────────────────
async function peacsInterpretResults(pe, archScore, execScore, ctxScore, pattern) {
  const btn = document.getElementById('pr-ai-interpret-btn');
  const responseBox = document.getElementById('pr-ai-interpret-response');
  const responseText = document.getElementById('pr-ai-interpret-text');
  if (!btn || !responseBox || !responseText) return;

  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:0.5;">✦ Interpreting…</span>';
  responseBox.style.display = '';
  responseText.innerHTML = '<span style="display:inline-block;width:70%;height:0.85em;border-radius:4px;background:rgba(139,111,245,0.18);animation:rcAiPulse 1.4s ease-in-out infinite;vertical-align:middle;"></span>';

  try {
    const prompt = `PEACS Assessment results: PE Score: ${pe !== null ? pe : '—'}. Architecture domain: ${archScore !== null ? (archScore * 10).toFixed(1) : '—'}/10. Execution domain: ${execScore !== null ? (execScore * 10).toFixed(1) : '—'}/10. Context domain: ${ctxScore !== null ? (ctxScore * 10).toFixed(1) : '—'}/10. Overall pattern: ${pattern}. Interpret what this means for this patient's adherence trajectory and what they should focus on.`;
    const resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 250,
        system: 'You are ZOE, the ATLAS adherence guide. Interpret PEACS results in plain language for the patient. 2-3 sentences max. Be specific to their scores.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text?.trim();
    if (text) {
      responseText.textContent = text;
    } else {
      responseBox.style.display = 'none';
      btn.disabled = false;
      btn.innerHTML = '<span>✦</span><span>Interpret My Results</span>';
    }
  } catch(e) {
    responseBox.style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = '<span>✦</span><span>Interpret My Results</span>';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PEACS INTERVAL-AWARE DIMENSION TRACKING
// Each dimension is stored and tracked independently.
// Firebase paths:
//   /peacs_dimensions/{patient_id}/{dimension}/  →  latest record per dimension
//   /peacs_dimension_history/{patient_id}/{dimension}/{pushKey}  →  full history
//   /peacs_assessments/  →  composite PE records (backward compatible, written when
//                           a full valid PE can be computed from current + cached dims)
//
// Intervals (configurable):
//   BASE   — 30 days  (behavioral architecture — monthly)
//   MVMT   — 7 days   (execution/timing — weekly)
//   STRATA — 90 days  (context/environment — quarterly)
//
// On load, ATLAS fetches the patient's latest record per dimension.
// Any dimension within its valid window is pre-filled (greyed out, locked)
// and counts toward PE calculation without re-answering.
// Only due dimensions are presented to the patient.
// ══════════════════════════════════════════════════════════════════════════

const PEACS_INTERVALS = { base: 30, mvmt: 7, strata: 90 }; // days

// Cache of last-fetched dimension data for current patient
window._peacsDimCache    = { base: null, mvmt: null, strata: null };
window._peacsDimDue      = { base: true,  mvmt: true,  strata: true  };
window._peacsEnabledDims = ['base','mvmt','strata']; // overridden per workspace from peacs_dims profile field
window._sessionData      = null; // populated by startSession()
window._peacsMapInference    = {}; // { qid: preselected_val } — built by _buildMapInference()
window._peacsIntakeInference = {}; // { qid: preselected_val } — built by _buildIntakeInference()
window._peacsGeoInference    = {}; // { qid: preselected_val } — built from Overpass API result in _buildGeoInference()
window._peacsMapOverrides    = []; // [{ qid, source, inferred, chosen, ts }] — patient override log

// ── SESSION MANAGEMENT ────────────────────────────────────────────────────────
function openSessionModal() {
  const modal = document.getElementById('session-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  // Restore instrument selection if a session is already active
  const sd = window._sessionData;
  if (sd?.instrument) {
    const radio = document.querySelector(`input[name="sess-instrument"][value="${sd.instrument}"]`);
    if (radio) radio.checked = true;
  }
}

function closeSessionModal() {
  const modal = document.getElementById('session-modal');
  if (modal) modal.style.display = 'none';
}

function generateSessionPatientId() {
  // No longer called from a modal input — kept as a utility for future use
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(2)), b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  return 'PT-' + rand;
}

function startSession() {
  const instrument = document.querySelector('input[name="sess-instrument"]:checked')?.value || 'both';

  // Generate a session patient ID now so MMAS and PEACS share the same identifier
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(2)), b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const pid = 'PT-' + rand;
  window._sessionPatientId = pid;

  // Minimal session record — SDoH is captured in the MMAS form after consent
  window._sessionData = {
    patientId:  pid,
    instrument,
    startedAt:  Date.now(),
  };

  closeSessionModal();
  updateSessionSummaryBar();

  // Route to informed consent. The consent-proceed handler reads _postConsentInstrument
  // to know whether to land on MMAS or PEACS after consent is given.
  window._postConsentInstrument = instrument;
  _postConsentTarget = 'dashboard';
  document.getElementById('consent-checkbox').checked = false;
  document.getElementById('consent-proceed-btn').disabled = true;
  // Render consent text matching the instrument this session will use
  renderConsentForInstrument(instrument);
  showScreen('screen-consent');
}

function clearSession() {
  window._sessionData       = null;
  window._sessionPatientId  = null;
  updateSessionSummaryBar();
  showToast('Session ended.', 2000);
}

function updateSessionSummaryBar() {
  const bar   = document.getElementById('session-summary-bar');
  const badge = document.getElementById('session-active-badge');
  const label = document.getElementById('sess-btn-label');
  if (!bar) return;
  const sd = window._sessionData;
  if (!sd) {
    bar.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (label) label.textContent = 'Start New Patient Session';
    return;
  }
  bar.style.display = 'flex';
  if (badge) badge.style.display = '';
  if (label) label.textContent = 'Edit Session';
  const pidEl = document.getElementById('session-summary-pid');
  const detEl = document.getElementById('session-summary-detail');
  if (pidEl) pidEl.textContent = '⊕ ' + sd.patientId;
  if (detEl) detEl.textContent = (sd.instrument || 'both').toUpperCase();
}

function _populateMmasFromSession() {
  // Pre-fill only the patient number so MMAS and PEACS share the same session ID.
  // All other SDoH is entered once by the researcher in the MMAS form.
  const pid = window._sessionData?.patientId || window._sessionPatientId;
  if (!pid) return;
  const el = document.getElementById('sdoh-patient-num');
  if (el) el.value = pid;
}

// ── PEACS SDoH HELPERS ────────────────────────────────────────────────────────
// Parallel to the MMAS sdoh-* functions but scoped to p-sdoh-* / p-med-* IDs.

let _pMedRowCount = 0;

function pAddMedRow(prefill) {
  const list = document.getElementById('p-med-list');
  if (!list) return;
  const id = ++_pMedRowCount;
  const row = document.createElement('div');
  row.id = 'p-med-row-' + id;
  row.style.cssText = 'background:var(--card2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative;';
  const routeOpts = ROUTES.map(r => '<option' + (prefill && prefill.route===r?' selected':'') + '>' + r + '</option>').join('');
  const freqOpts  = DOSING_FREQS.map(([label, val]) => '<option value="' + val + '"' + (prefill && prefill.frequency===val?' selected':'') + '>' + label + '</option>').join('');
  row.innerHTML =
    '<button type="button" onclick="document.getElementById(\'p-med-row-\' + id + \'\').remove();pSyncMedCountFromRows();" title="Remove"'
    + ' style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--dim);cursor:pointer;font-size:1.1rem;line-height:1;padding:0 4px;">&times;</button>'
    + '<div style="grid-column:1/-1;font-family:var(--font-mono);font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;">Medication ' + id + '</div>'
    + '<div style="grid-column:1/-1;">'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Drug / API Name</label>'
    +   '<input class="sdoh-input" id="p-med-name-' + id + '" type="text" placeholder="e.g., Metformin" value="' + (prefill&&prefill.name||'') + '"/>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Strength</label>'
    +   '<input class="sdoh-input" id="p-med-strength-' + id + '" type="text" placeholder="e.g., 500mg" value="' + (prefill&&prefill.strength||'') + '"/>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Type</label>'
    +   '<select class="sdoh-select" id="p-med-type-' + id + '">'
    +   '<option value="">— Select —</option>'
    +   '<option' + (prefill&&prefill.type==='Single API'?' selected':'') + '>Single API</option>'
    +   '<option' + (prefill&&prefill.type==='Combination (FDC)'?' selected':'') + '>Combination (FDC)</option>'
    +   '<option' + (prefill&&prefill.type==='Biological'?' selected':'') + '>Biological</option>'
    +   '</select>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Route</label>'
    +   '<select class="sdoh-select" id="p-med-route-' + id + '">' + routeOpts + '</select>'
    + '</div>'
    + '<div>'
    +   '<label class="sdoh-label" style="margin-bottom:4px;display:block;">Frequency</label>'
    +   '<select class="sdoh-select" id="p-med-freq-' + id + '"><option value="">— Select —</option>' + freqOpts + '</select>'
    + '</div>';
  list.appendChild(row);
}

function pSyncMedRowsToCount(n) {
  n = parseInt(n, 10);
  if (isNaN(n)) return;
  const list = document.getElementById('p-med-list');
  if (!list) return;
  const existing = list.querySelectorAll('div[id^="p-med-row-"]').length;
  if (n > existing) {
    for (let i = existing; i < n; i++) pAddMedRow();
  } else if (n < existing) {
    const rows = list.querySelectorAll('div[id^="p-med-row-"]');
    for (let i = n; i < rows.length; i++) rows[i].remove();
  }
}

function pSyncMedCountFromRows() {
  const list = document.getElementById('p-med-list');
  const sel  = document.getElementById('p-sdoh-num-medications');
  if (!list || !sel) return;
  const n = list.querySelectorAll('div[id^="p-med-row-"]').length;
  sel.value = n > 0 && n <= 10 ? String(n) : '';
}

function pGetMedications() {
  const rows = document.querySelectorAll('#p-med-list > div[id^="p-med-row-"]');
  const meds = [];
  rows.forEach(function(row) {
    const n = row.id.replace('p-med-row-','');
    const name = document.getElementById('p-med-name-'+n)?.value.trim() || '';
    if (!name) return;
    meds.push({
      name,
      strength:  document.getElementById('p-med-strength-'+n)?.value.trim() || '',
      type:      document.getElementById('p-med-type-'+n)?.value             || '',
      route:     document.getElementById('p-med-route-'+n)?.value            || '',
      frequency: document.getElementById('p-med-freq-'+n)?.value             || '',
    });
  });
  return meds;
}

function rebuildPeacsConditionDropdown() {
  const sel = document.getElementById('p-sdoh-condition');
  if (!sel || typeof _CONDITION_GROUPS === 'undefined') return;
  const prevSelected = new Set(Array.from(sel.selectedOptions).map(o => o.value));
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = '— Select condition —';
  sel.appendChild(ph);
  _CONDITION_GROUPS.forEach(group => {
    const og = document.createElement('optgroup');
    og.label = group.en;
    group.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.en; opt.textContent = item.en;
      if (prevSelected.has(item.en)) opt.selected = true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  // Condition display listener
  sel.addEventListener('change', () => {
    const disp  = document.getElementById('p-sdoh-condition-display');
    const other = document.getElementById('p-sdoh-condition-other');
    const chosen = Array.from(sel.selectedOptions).map(o => o.value).filter(Boolean);
    if (disp) {
      if (chosen.length) { disp.style.display=''; disp.textContent = chosen.join(' · '); }
      else               { disp.style.display='none'; disp.textContent=''; }
    }
    if (other) {
      other.style.display = chosen.includes('Other') ? '' : 'none';
    }
  });
}

// Called after renderPeacsAssessment() HTML is injected into the DOM.
// Populates the condition dropdown, auto-fills location, and pre-fills session SDoH.
function initPeacsSdohSection() {
  rebuildPeacsConditionDropdown();

  // Auto-fill location
  const loc = userLocation || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value) el.value = val; };
  setVal('p-sdoh-country', loc.country || '');
  setVal('p-sdoh-city',    loc.city    || '');

  // Pre-fill patient number from session / MMAS field
  const pid = window._sessionData?.patientId || window._sessionPatientId
    || document.getElementById('sdoh-patient-num')?.value.trim() || '';
  if (pid) setVal('p-sdoh-patient-num', pid);

  // If session data was enriched with MMAS SDoH, pre-fill all fields
  const sd = window._sessionData;
  if (sd) {
    setVal('p-sdoh-country',   sd.country   || '');
    setVal('p-sdoh-city',      sd.city      || '');
    if (sd.gender)    { const el = document.getElementById('p-sdoh-gender');    if (el) el.value = sd.gender; }
    if (sd.age)       { const el = document.getElementById('p-sdoh-age');       if (el) el.value = sd.age; }
    if (sd.education) { const el = document.getElementById('p-sdoh-education'); if (el) el.value = sd.education; }
    if (sd.condition) {
      const condSel = document.getElementById('p-sdoh-condition');
      if (condSel) {
        const opts = Array.from(condSel.options);
        const conditions = sd.condition.split(';').map(s => s.trim()).filter(Boolean);
        conditions.forEach(c => {
          const match = opts.find(o => o.value.toLowerCase() === c.toLowerCase());
          if (match) match.selected = true;
        });
        if (!conditions.some(c => opts.find(o => o.value.toLowerCase() === c.toLowerCase()))) {
          const otherOpt = opts.find(o => o.value === 'Other');
          if (otherOpt) otherOpt.selected = true;
          const otherIn = document.getElementById('p-sdoh-condition-other');
          if (otherIn) { otherIn.value = sd.condition; otherIn.style.display = ''; }
        }
        condSel.dispatchEvent(new Event('change'));
      }
    }
    if (sd.medication) {
      const pMedList = document.getElementById('p-med-list');
      if (pMedList && pMedList.children.length === 0) {
        pAddMedRow({ name: sd.medication });
        pSyncMedCountFromRows();
      }
    }
  }

  // Fire geo inference as fallback for patients navigating directly to PEACS
  // (without coming through MAP submit). Non-blocking.
  if (typeof _fetchOverpassGeoInference === 'function') {
    const sd = window._sessionData;
    const hasPostal     = !!(sd && sd.postal);
    const hasGps        = typeof userLocation !== 'undefined' && !!(userLocation && userLocation.latitude);
    const alreadyScored = !!(sd && sd.sq5 !== undefined && sd.sq6 !== undefined);
    if ((hasPostal || hasGps) && !alreadyScored) {
      _fetchOverpassGeoInference().catch(() => {});
    }
  }

  // Apply MAP→PEACS inferences into peacsState and refresh the live score floater.
  // Runs after all SDoH fields are filled so the floater update is final.
  _applyMapInferenceToPeacsState();
}

// ── TREND VIEW ────────────────────────────────────────────────────────────────
function renderPeacsTrend() {
  const sd = window._sessionData;
  const patId = sd?.patientId || window._sessionPatientId || '';
  return `<div style="padding:28px 24px;">
    <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:8px;">Longitudinal Analysis</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.45rem;font-weight:300;color:var(--bright);margin-bottom:20px;">Patient Trend · Last 10 Visits</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <input id="trend-patient-id" value="${patId}" placeholder="Enter Patient ID" style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.3);color:var(--bright);border-radius:7px;padding:9px 12px;outline:none;flex:1;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(212,168,67,0.65)'" onblur="this.style.borderColor='rgba(212,168,67,0.3)'"/>
      <button onclick="loadPeacsTrend(document.getElementById('trend-patient-id').value.trim())" style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.35);color:var(--pe);border-radius:7px;padding:9px 16px;cursor:pointer;white-space:nowrap;transition:all 0.2s;" onmouseover="this.style.background='rgba(212,168,67,0.22)'" onmouseout="this.style.background='rgba(212,168,67,0.12)'">Load Trend →</button>
    </div>
    <div id="trend-chart-area" style="min-height:300px;display:flex;align-items:center;justify-content:center;">
      <div style="color:var(--dim);font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;text-align:center;">${patId ? 'Loading…' : 'Enter a patient ID above and click Load Trend.'}</div>
    </div>
    <div id="trend-records-list" style="margin-top:24px;"></div>
  </div>`;
}

async function loadPeacsTrend(rawPatId) {
  const patId = (rawPatId || '').trim();
  const chartArea = document.getElementById('trend-chart-area');
  const listArea  = document.getElementById('trend-records-list');
  if (!patId) { showToast('Enter a patient ID first.'); return; }
  if (!chartArea) return;
  chartArea.style.minHeight = '300px';
  chartArea.style.display = 'flex';
  chartArea.innerHTML = '<div style="color:var(--dim);font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;">Loading…</div>';
  try {
    const snap = await database.ref('peacs_assessments').orderByChild('patient_number').equalTo(patId).limitToLast(50).once('value');
    const data = snap.val();
    if (!data) {
      chartArea.innerHTML = '<div style="color:var(--dim);font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;padding:40px 0;text-align:center;">No PEACS records found for <strong style="color:var(--bright);">' + _esc(patId) + '</strong>.</div>';
      return;
    }
    let records = Object.values(data).sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
    if (records.length > 10) records = records.slice(records.length - 10);

    const dates   = records.map(r => new Date(r.timestamp).toLocaleDateString());
    const bases   = records.map(r => r.base   !== undefined ? +parseFloat(r.base).toFixed(3)   : null);
    const mvmts   = records.map(r => r.mvmt   !== undefined ? +parseFloat(r.mvmt).toFixed(3)   : null);
    const stratas = records.map(r => r.strata !== undefined ? +parseFloat(r.strata).toFixed(3) : null);
    const pes     = records.map(r => (!r.partial && r.pe !== undefined) ? +parseFloat(r.pe).toFixed(4) : null);

    chartArea.innerHTML = '<div id="trend-plotly-chart" style="width:100%;height:340px;"></div>';
    chartArea.style.display = 'block';

    await ensurePlotly();
    const traces = [];
    if (bases.some(v=>v!==null))   traces.push({ x:dates, y:bases,   name:'BASE',   mode:'lines+markers', line:{color:'#4e9cf5',width:2}, marker:{size:7,symbol:'circle'} });
    if (mvmts.some(v=>v!==null))   traces.push({ x:dates, y:mvmts,   name:'MVMT',   mode:'lines+markers', line:{color:'#8b6ff5',width:2}, marker:{size:7,symbol:'circle'} });
    if (stratas.some(v=>v!==null)) traces.push({ x:dates, y:stratas, name:'STRATA', mode:'lines+markers', line:{color:'#2ec98a',width:2}, marker:{size:7,symbol:'circle'} });
    if (pes.some(v=>v!==null))     traces.push({ x:dates, y:pes,     name:'PE',     mode:'lines+markers', line:{color:'#d4a843',width:3,dash:'dot'}, marker:{size:9,symbol:'diamond'} });

    const zoneLines = [
      {y:0.85, color:'rgba(16,185,129,0.22)',  label:'Optimal'},
      {y:0.70, color:'rgba(59,130,246,0.18)',  label:'Good'},
      {y:0.55, color:'rgba(245,158,11,0.18)',  label:'Moderate'},
      {y:0.40, color:'rgba(239,68,68,0.18)',   label:'Poor'},
    ].map(z => ({type:'line',x0:0,x1:1,xref:'paper',y0:z.y,y1:z.y,line:{color:z.color,width:1,dash:'dot'}}));

    Plotly.newPlot('trend-plotly-chart', traces, {
      paper_bgcolor:'transparent', plot_bgcolor:'transparent',
      font:{family:'IBM Plex Mono,monospace',color:'rgba(200,220,245,0.65)',size:11},
      xaxis:{ tickfont:{size:10}, gridcolor:'rgba(255,255,255,0.06)', linecolor:'rgba(255,255,255,0.08)', zeroline:false },
      yaxis:{ range:[0,1.05], tickfont:{size:10}, gridcolor:'rgba(255,255,255,0.06)', linecolor:'rgba(255,255,255,0.08)', zeroline:false, title:{text:'Score',font:{size:11}} },
      legend:{ orientation:'h', x:0, y:1.14, font:{size:11}, bgcolor:'transparent' },
      margin:{t:50,b:50,l:55,r:16},
      shapes: zoneLines,
    }, {responsive:true, displayModeBar:false});

    if (listArea) {
      listArea.innerHTML = `
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">Visit History · ${records.length} record${records.length!==1?'s':''}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="text-align:left;padding:7px 8px;color:var(--muted);font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.1em;font-weight:400;text-transform:uppercase;">Date</th>
            <th style="text-align:right;padding:7px 8px;color:var(--base);font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">BASE</th>
            <th style="text-align:right;padding:7px 8px;color:var(--mvmt);font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">MVMT</th>
            <th style="text-align:right;padding:7px 8px;color:var(--strata);font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">STRATA</th>
            <th style="text-align:right;padding:7px 8px;color:var(--pe);font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">PE / Zone</th>
          </tr></thead>
          <tbody>
            ${records.map(r => {
              const isPartial = !!r.partial;
              const peVal = r.pe !== undefined ? +parseFloat(r.pe) : null;
              const zc = peVal >= 0.85 ? '#10b981' : peVal >= 0.70 ? '#3b82f6' : peVal >= 0.55 ? '#f59e0b' : peVal >= 0.40 ? '#ef4444' : '#991b1b';
              const zone = r.pe_zone || '—';
              return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
                <td style="padding:8px 8px;color:var(--muted);">${new Date(r.timestamp).toLocaleDateString()}</td>
                <td style="text-align:right;padding:8px 8px;color:var(--base);">${r.base !== undefined ? parseFloat(r.base).toFixed(3) : '—'}</td>
                <td style="text-align:right;padding:8px 8px;color:var(--mvmt);">${isPartial ? '<span style="color:var(--dim);">—</span>' : (r.mvmt !== undefined ? parseFloat(r.mvmt).toFixed(3) : '—')}</td>
                <td style="text-align:right;padding:8px 8px;color:var(--strata);">${isPartial ? '<span style="color:var(--dim);">—</span>' : (r.strata !== undefined ? parseFloat(r.strata).toFixed(3) : '—')}</td>
                <td style="text-align:right;padding:8px 8px;">
                  <span style="color:${isPartial?'var(--dim)':zc};font-weight:600;">${isPartial ? 'BASE only' : (peVal !== null ? peVal.toFixed(4) : '—')}</span>
                  ${!isPartial && zone!=='—' ? '<span style="display:block;font-size:0.75rem;color:'+zc+';opacity:0.7;">'+_esc(zone)+'</span>' : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    }
  } catch(e) {
    console.error('Trend load error:', e);
    chartArea.innerHTML = '<div style="color:var(--dim);padding:40px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;">Error loading trend data. Check console for details.</div>';
  }
}

// Returns a _peacsDimDue object where enabled dims start as "due" and disabled dims are false
function _defaultPeacsDimDue() {
  const eds = window._peacsEnabledDims || ['base','mvmt','strata'];
  return { base: eds.includes('base'), mvmt: eds.includes('mvmt'), strata: eds.includes('strata') };
}

function _peacsDimAge(rec) {
  if (!rec || !rec.timestamp) return Infinity;
  return (Date.now() - rec.timestamp) / 86400000; // days
}

function _peacsDimValid(dim, rec) {
  return _peacsDimAge(rec) <= PEACS_INTERVALS[dim];
}

// Fetch latest dimension records for a given patient ID from Firebase
async function loadPeacsDimensions(patientId) {
  // Sync enabled dims from workspace profile each time
  window._peacsEnabledDims = (workspaceProfile?.peacs_dims?.length > 0)
    ? workspaceProfile.peacs_dims
    : ['base','mvmt','strata'];
  const enabledDims = window._peacsEnabledDims;

  if (!patientId) {
    window._peacsDimCache = { base: null, mvmt: null, strata: null };
    window._peacsDimDue   = _defaultPeacsDimDue();
    return;
  }
  const ws = (currentWorkspace || '').toUpperCase();
  // Sanitise patient ID for Firebase key (no dots, $, #, [, ], /)
  const safeId = patientId.replace(/[.$#\[\]/]/g, '_').toUpperCase();
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;

  try {
    const snap = await db.ref(`peacs_dimensions/${safeId}`).once('value');
    const data = snap.val() || {};
    window._peacsDimCache = {
      base:   data.base   || null,
      mvmt:   data.mvmt   || null,
      strata: data.strata || null,
    };
    // All enabled dims are always due — interval check is advisory only, not a gate
    window._peacsDimDue = {
      base:   enabledDims.includes('base'),
      mvmt:   enabledDims.includes('mvmt'),
      strata: enabledDims.includes('strata'),
    };
  } catch(e) {
    window._peacsDimCache = { base: null, mvmt: null, strata: null };
    window._peacsDimDue   = _defaultPeacsDimDue();
  }
}

// Pre-fill peacsState from cached (valid) dimensions
function _preFillFromCache() {
  ['base','mvmt','strata'].forEach(dim => {
    const rec = window._peacsDimCache[dim];
    if (!rec || window._peacsDimDue[dim]) return; // due — don't pre-fill
    // Restore individual question answers from the stored record
    if (dim === 'base') {
      BASE_QS.forEach(q => { if (rec[q.id] !== undefined) peacsState.base[q.id] = rec[q.id]; });
    } else if (dim === 'mvmt') {
      MVMT_QS.forEach(q => { if (rec[q.id] !== undefined) peacsState.mvmt[q.id] = rec[q.id]; });
    } else if (dim === 'strata') {
      STRATA_QS.forEach(q => { if (rec[q.id] !== undefined) peacsState.strata[q.id] = rec[q.id]; });
    }
  });
}

// Format how long ago a dimension was last taken
function _dimAgoStr(rec) {
  const days = _peacsDimAge(rec);
  if (days === Infinity) return 'Never taken';
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  return Math.round(days) + ' days ago';
}

// ── Modified renderPeacsAssessment ──────────────────────────────────────────
function renderPeacsAssessment() {
  _buildMapInference();    // derive pre-selections from MAP answers
  _buildIntakeInference(); // derive pre-selections from SDoH intake form answers
  _buildGeoInference();    // derive pre-selections from Overpass API geolocation result
  const L = PEACS_QUESTIONS[peacsCurrentLang] || PEACS_QUESTIONS.en;

  // Dimension status badges
  function dimStatusBadge(dim) {
    const rec = window._peacsDimCache[dim];
    const due = window._peacsDimDue[dim];
    const interval = PEACS_INTERVALS[dim];
    if (!rec) return `<span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(245,158,11,0.4);color:rgba(245,158,11,0.9);background:rgba(245,158,11,0.06);">First visit</span>`;
    const daysAgo = Math.round(_peacsDimAge(rec));
    const daysLeft = Math.ceil(interval - _peacsDimAge(rec));
    if (daysLeft > 0) {
      return `<span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(46,201,138,0.35);color:rgba(46,201,138,0.9);background:rgba(46,201,138,0.06);">Last taken ${daysAgo}d ago · recommended again in ${daysLeft}d</span>`;
    }
    return `<span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(245,158,11,0.4);color:rgba(245,158,11,0.9);background:rgba(245,158,11,0.06);">Last taken ${daysAgo}d ago · recommended interval: ${interval}d</span>`;
  }

  // Render a dimension section — always interactive, interval is advisory only
  function dimSection(dim, qs, label, acronym, intro, dotClass, introBg, introBorder) {
    const cards = qs.map(q => peacsQCard(q, dim)).join('');
    const lockStyle = '';
    const lockedNote = '';
    return `<div class="dimension-section">
      <div class="dim-header">
        <div class="dim-dot ${dotClass}"></div>
        <div>
          <div class="dim-title">${label} <span class="dim-acronym">${acronym}</span></div>
          <div class="dim-subtitle" style="display:flex;align-items:center;gap:8px;">
            <span>${dim === 'base' ? L.base_period : dim === 'mvmt' ? L.mvmt_period : L.strata_period}</span>
            ${dimStatusBadge(dim)}
          </div>
        </div>
      </div>
      <div style="font-size:0.84rem;color:var(--muted);line-height:1.6;background:${introBg};border:1px solid ${introBorder};border-radius:8px;padding:12px 14px;margin-bottom:12px;font-style:italic;">${intro}</div>
      ${lockedNote}
      <div style="${lockStyle}">${cards}</div>
    </div>`;
  }

  const enabledDims = window._peacsEnabledDims || ['base','mvmt','strata'];
  const partialMode = enabledDims.length < 3;
  const headerNote = '';

  const partialNote = partialMode
    ? `<div style="background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;color:rgba(212,168,67,0.85);line-height:1.6;">Research mode — this workspace collects: <strong>${enabledDims.map(d=>d.toUpperCase()).join(' · ')}</strong>. PE composite score requires all 3 dimensions and will not be calculated.</div>`
    : '';

  return `<div class="assess-layout">
    <div class="assess-questions">

      <!-- PEACS SDoH Section — mirrors MMAS patient & medication form -->
      <div class="sdoh-section" id="p-sdoh-section">
        <div class="sdoh-header">
          <span class="sdoh-tag">📋 Patient &amp; Medication Information</span>
          <span class="sdoh-sub">Required for clinical coordinators. Links this PEACS assessment to a patient record and provides SDoH context for the PE score.</span>
        </div>
        <div class="sdoh-grid">
          <div class="sdoh-field">
            <label class="sdoh-label">Country</label>
            <input class="sdoh-input" id="p-sdoh-country" type="text" placeholder="e.g., United States" autocomplete="country"/>
            <span class="sdoh-note">Auto-detected. Edit if incorrect.</span>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">City</label>
            <input class="sdoh-input" id="p-sdoh-city" type="text" placeholder="e.g., Long Beach" autocomplete="address-level2"/>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Patient Number <span class="sdoh-optional">optional</span></label>
            <input class="sdoh-input" id="p-sdoh-patient-num" type="text" placeholder="Auto-generated"
              oninput="peacsPatientIdChanged(this.value)"/>
            <span class="sdoh-note">Links to this patient's dimension history and prior visits.</span>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Study ID <span class="sdoh-optional">optional</span></label>
            <input class="sdoh-input" id="p-sdoh-study-id" type="text" placeholder="e.g., UCLA-PHARM-2026" style="text-transform:uppercase;"/>
            <span class="sdoh-note">Provided by your PI to group submissions.</span>
          </div>
          <div class="sdoh-field sdoh-full">
            <label class="sdoh-label">Medical Condition Being Treated <span class="sdoh-optional">optional</span></label>
            <select class="sdoh-select" id="p-sdoh-condition" multiple size="5" style="height:auto;min-height:120px;"></select>
            <div id="p-sdoh-condition-display" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.18);border-radius:8px;font-size:0.84rem;color:var(--muted);line-height:1.6;"></div>
            <input class="sdoh-input" id="p-sdoh-condition-other" type="text" placeholder="Please specify condition" style="display:none;margin-top:8px;"/>
            <span class="sdoh-note">Hold Ctrl / Cmd to select multiple. Your selections appear below.</span>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Number of Medications <span class="sdoh-optional">optional</span></label>
            <select class="sdoh-select" id="p-sdoh-num-medications" onchange="pSyncMedRowsToCount(this.value)">
              <option value="">— Select —</option>
              <option value="1">1</option><option value="2">2</option><option value="3">3</option>
              <option value="4">4</option><option value="5">5</option><option value="6">6</option>
              <option value="7">7</option><option value="8">8</option><option value="9">9</option>
              <option value="10">10</option>
            </select>
            <span class="sdoh-note">Total medications currently prescribed.</span>
          </div>
          <div class="sdoh-field sdoh-full">
            <label class="sdoh-label">Medications <span class="sdoh-optional">optional — add one or more</span></label>
            <div id="p-med-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:10px;"></div>
            <button type="button" onclick="pAddMedRow();pSyncMedCountFromRows();" style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px dashed var(--border2);color:var(--dim);border-radius:var(--r);padding:9px 16px;cursor:pointer;width:100%;transition:all 0.2s;">+ Add Medication</button>
            <span class="sdoh-note">Add each medication separately. Supports combination therapy and polypharmacy.</span>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Gender <span class="sdoh-optional">optional</span></label>
            <select class="sdoh-select" id="p-sdoh-gender">
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other/Prefer not to say">Other / Prefer not to say</option>
            </select>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Age Range <span class="sdoh-optional">optional</span></label>
            <select class="sdoh-select" id="p-sdoh-age">
              <option value="">— Select —</option>
              <option>Under 18</option><option>18–24</option><option>25–34</option>
              <option>35–44</option><option>45–54</option><option>55–64</option>
              <option>65–74</option><option>75 or older</option><option>Prefer not to say</option>
            </select>
          </div>
          <div class="sdoh-field">
            <label class="sdoh-label">Highest Level of Education <span class="sdoh-optional">optional</span></label>
            <select class="sdoh-select" id="p-sdoh-education">
              <option value="">— Select —</option>
              <option>No formal education</option>
              <option>Primary school (Elementary)</option>
              <option>Secondary school (High school)</option>
              <option>Some college / University (incomplete)</option>
              <option>Associate degree / Trade school</option>
              <option>Bachelor's degree</option>
              <option>Master's degree</option>
              <option>Doctoral degree (PhD, MD, JD, etc.)</option>
              <option>Prefer not to say</option>
            </select>
          </div>
          <div class="sdoh-field sdoh-full">
            <label class="sdoh-label">Additional Social Determinants <span class="sdoh-optional">optional</span></label>
            <div id="p-sdoh-custom-rows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>
            <button type="button" onclick="addSdohCustomRow('p-sdoh-custom-rows')" style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px dashed var(--border2);color:var(--dim);border-radius:var(--r);padding:8px 16px;cursor:pointer;width:100%;transition:all 0.2s;" onmouseenter="this.style.borderColor='var(--muted)';this.style.color='var(--text)'" onmouseleave="this.style.borderColor='var(--border2)';this.style.color='var(--dim)'">+ Add Field</button>
            <span class="sdoh-note">Define your own SDOH fields — housing, employment, insurance, food access, etc. Both the field name and response are free text.</span>
          </div>
        </div>
      </div>

      ${partialNote}
      ${headerNote}
      ${(()=>{
        const mapN    = Object.keys(window._peacsMapInference    || {}).length;
        const intakeN = Object.keys(window._peacsIntakeInference || {}).length;
        const geoN    = Object.keys(window._peacsGeoInference    || {}).length;
        const total   = mapN + intakeN + geoN;
        if (!total) return '';
        const chips = [
          mapN    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(212,168,67,0.85);background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.22);border-radius:12px;padding:3px 10px;">${mapN} from MAP</span>` : '',
          intakeN ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(78,156,245,0.85);background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);border-radius:12px;padding:3px 10px;">${intakeN} from intake</span>` : '',
          geoN    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(46,201,138,0.85);background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.22);border-radius:12px;padding:3px 10px;">${geoN} location-scored</span>` : '',
        ].filter(Boolean).join('');
        return `<div id="peacs-inference-banner" style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.16);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
          <div>
            <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(46,201,138,0.6);margin-bottom:6px;">SDoH Intelligence · ${total} of 22 pre-filled</div>
            <div style="font-size:0.82rem;color:var(--muted);line-height:1.55;margin-bottom:8px;">These answers were pre-selected from your earlier responses. Review each one and adjust if needed — every change is logged.</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
          </div>
          <button onclick="document.getElementById('peacs-inference-banner').style.display='none'" style="flex-shrink:0;background:none;border:none;color:var(--dim);font-size:1.1rem;cursor:pointer;padding:0;line-height:1;" title="Dismiss">&times;</button>
        </div>`;
      })()}
      ${enabledDims.includes('base')   ? dimSection('base',   BASE_QS,   'BASE',   L.base_dim.replace('BASE — ',''),   L.base_intro,   'base',   'rgba(78,156,245,0.04)',   'rgba(78,156,245,0.12)')   : ''}
      ${enabledDims.includes('mvmt')   ? dimSection('mvmt',   MVMT_QS,   'MVMT',   L.mvmt_dim.replace('MVMT — ',''),   L.mvmt_intro,   'mvmt',   'rgba(139,111,245,0.04)',  'rgba(139,111,245,0.12)')   : ''}
      ${enabledDims.includes('strata') ? dimSection('strata', STRATA_QS, 'STRATA', L.strata_dim.replace('STRATA — ',''),L.strata_intro, 'strata', 'rgba(46,201,138,0.04)',   'rgba(46,201,138,0.12)')   : ''}
      <button class="peacs-submit-btn" id="peacs-submit-btn" disabled onclick="submitPeacs()">${L.submit_btn}</button>
    </div>
    <div class="assess-floater" id="peacs-floater">
      <div class="fl-label">Predictive Emergence</div>
      <div class="fl-pe" id="fl-pe">—</div>
      <div class="fl-zone" id="fl-zone">Answer questions to begin</div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--base)">BASE</span><span id="fb-base">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill b" id="bar-b"></div></div></div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--mvmt)">MVMT</span><span id="fb-mvmt">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill m" id="bar-m"></div></div></div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--strata)">STRATA</span><span id="fb-strata">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill s" id="bar-s"></div></div></div>
      <div class="fl-prog"><span class="fl-prog-n" id="prog-n">0 / 22</span><div class="fl-prog-bar"><div class="fl-prog-fill" id="prog-f"></div></div></div>
    </div>
  </div>`;
}

// Called when patient ID field changes — load their dimension history
let _peacsPatIdTimer = null;
function peacsPatientIdChanged(val) {
  clearTimeout(_peacsPatIdTimer);
  const id = val.trim();
  if (!id) {
    window._peacsDimCache = { base: null, mvmt: null, strata: null };
    window._peacsDimDue   = _defaultPeacsDimDue();
    peacsState.base={}; peacsState.mvmt={}; peacsState.strata={};
    updatePeacsFloater();
    return;
  }
  _peacsPatIdTimer = setTimeout(async () => {
    await loadPeacsDimensions(id);
    // Reset answers, then pre-fill valid dims
    peacsState.base={}; peacsState.mvmt={}; peacsState.strata={};
    _preFillFromCache();
    // Re-render assessment with updated due/not-due status
    const content = document.getElementById('peacs-tab-content');
    if (content && document.querySelector('#peacs-tab-bar .tab-btn.active')?.dataset.tab === 'assess') {
      const savedId = id;
      content.innerHTML = renderPeacsAssessment();
      // Restore patient ID in the new input
      const inp = document.getElementById('peacs-patient-id');
      if (inp) inp.value = savedId;
    }
    updatePeacsFloater();
    _applyMapInferenceToPeacsState();
  }, 600); // debounce 600ms
}

// ── Modified submitPeacs ──────────────────────────────────────────────────
async function submitPeacs() {
  const enabledDims = window._peacsEnabledDims || ['base','mvmt','strata'];
  const b  = enabledDims.includes('base')   ? calcBase(peacsState.base)     : null;
  const m  = enabledDims.includes('mvmt')   ? calcMvmt(peacsState.mvmt)     : null;
  const s  = enabledDims.includes('strata') ? calcStrata(peacsState.strata) : null;
  const pe = calcPE(b, m, s); // null when any enabled dim is missing, or when < 3 dims enabled

  // Require all ENABLED dims to have valid scores
  const anyMissing = enabledDims.some(d =>
    (d==='base' && b===null) || (d==='mvmt' && m===null) || (d==='strata' && s===null)
  );
  if (anyMissing) { showToast('Please answer all due questions for the active dimensions.'); return; }

  // Write pe back to peacsState so downstream hooks (percentile badge etc.) can read it
  peacsState.pe = pe;

  const btn = document.getElementById('peacs-submit-btn');
  if (btn) { btn.disabled=true; btn.textContent='Submitting…'; }

  if (!userLocation || (!userLocation.latitude && !userLocation.longitude)) await requestGeolocation();

  // Read patient ID — PEACS SDoH field takes priority over legacy inputs
  const patientId = (document.getElementById('p-sdoh-patient-num')?.value.trim())
    || (document.getElementById('peacs-patient-id')?.value.trim())
    || (document.getElementById('sdoh-patient-num')?.value.trim())
    || window._sessionPatientId || userId || null;

  const now = Date.now();
  const safeId = patientId ? patientId.replace(/[.$#\[\]/]/g, '_').toUpperCase() : null;

  // Read SDoH from PEACS form fields (PEACS-only path),
  // falling back to session data (MMAS→PEACS handoff path), then geolocation.
  const pCountry   = document.getElementById('p-sdoh-country')?.value.trim();
  const pCity      = document.getElementById('p-sdoh-city')?.value.trim();
  const pGender    = document.getElementById('p-sdoh-gender')?.value      || '';
  const pAge       = document.getElementById('p-sdoh-age')?.value         || '';
  const pEducation = document.getElementById('p-sdoh-education')?.value   || '';
  const pSdohCustom = getSdohCustomData('p-sdoh-custom-rows');
  const pStudyId   = document.getElementById('p-sdoh-study-id')?.value.trim().toUpperCase() || window._activeStudyId || '';
  const pCondSel   = document.getElementById('p-sdoh-condition');
  const pSelConds  = pCondSel ? Array.from(pCondSel.selectedOptions).map(o=>o.value).filter(Boolean) : [];
  const pCondOther = document.getElementById('p-sdoh-condition-other')?.value.trim() || '';
  const pCondition = pSelConds.join('; ') || pCondOther || '';
  const pMeds      = pGetMedications();
  const pPrimaryMed = pMeds[0] ? [pMeds[0].name, pMeds[0].strength].filter(Boolean).join(' ') : '';

  const _sd = window._sessionData;
  const commonMeta = {
    patient_number: patientId,
    user_id:        userId,
    timestamp:      now,
    country:        (typeof _normalizeCountry === 'function' ? _normalizeCountry(pCountry || _sd?.country || userLocation.country) : normalizeCountry(pCountry || _sd?.country || userLocation.country)),
    city:           pCity      || _sd?.city        || userLocation.city,
    latitude:       userLocation.latitude,
    longitude:      userLocation.longitude,
    country_code:   userLocation.country_code,
    ...(pGender    || _sd?.gender    ? { gender:    pGender    || _sd?.gender    } : {}),
    ...(pAge       || _sd?.age       ? { age:       pAge       || _sd?.age       } : {}),
    ...(pEducation || _sd?.education ? { education: pEducation || _sd?.education } : {}),
    ...(pCondition || _sd?.condition ? { condition: pCondition || _sd?.condition } : {}),
    ...(pPrimaryMed|| _sd?.medication? { medication:pPrimaryMed|| _sd?.medication} : {}),
    ...(pStudyId                     ? { study_id:  pStudyId                     } : {}),
    ...(pMeds.length > 1             ? { medications_json: JSON.stringify(pMeds) } : {}),
    ...(pSdohCustom                  ? { sdoh_custom: pSdohCustom               } : {}),
    ...(currentWorkspace ? { institution_code: currentWorkspace } : {}),
    ...(workspaceProfile?.parent_institution ? { parent_institution: workspaceProfile.parent_institution } : {}),
    ...(workspaceProfile?.parent_pi          ? { parent_pi:          workspaceProfile.parent_pi          } : {}),
    // MAP inference metadata — research provenance for pre-selected answers
    ...(Object.keys(window._peacsMapInference || {}).length ? {
      map_inferred_count: Object.keys(window._peacsMapInference).length,
      map_inferred_qids:  Object.keys(window._peacsMapInference).join(','),
    } : {}),
    // Intake inference metadata — SDoH intake form pre-selections
    ...(Object.keys(window._peacsIntakeInference || {}).length ? {
      intake_inferred_count: Object.keys(window._peacsIntakeInference).length,
      intake_inferred_qids:  Object.keys(window._peacsIntakeInference).join(','),
    } : {}),
    ...(Object.keys(window._peacsGeoInference || {}).length ? {
      geo_inferred_count: Object.keys(window._peacsGeoInference).length,
      geo_inferred_qids:  Object.keys(window._peacsGeoInference).join(','),
    } : {}),
    ...(window._peacsMapOverrides?.length ? {
      map_inference_overrides: JSON.stringify(window._peacsMapOverrides),
    } : {}),
  };

  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;

  try {
    // ── 1. Write individual dimension records (only for due dimensions) ──
    if (safeId) {
      const dimUpdates = {};

      // Declare dim records so they're accessible for the cache update below
      let baseRec = null, mvmtRec = null, strataRec = null;

      if (window._peacsDimDue.base && enabledDims.includes('base')) {
        const baseAnswers = {};
        BASE_QS.forEach(q => { if (peacsState.base[q.id] !== undefined) baseAnswers[q.id] = peacsState.base[q.id]; });
        baseRec = { ...commonMeta, ...baseAnswers, score: +b.toFixed(4), dimension: 'base' };
        dimUpdates[`peacs_dimensions/${safeId}/base`] = baseRec;
        // Also push to history
        const baseHistKey = db.ref(`peacs_dimension_history/${safeId}/base`).push().key;
        dimUpdates[`peacs_dimension_history/${safeId}/base/${baseHistKey}`] = baseRec;
      }

      if (window._peacsDimDue.mvmt && enabledDims.includes('mvmt')) {
        const mvmtAnswers = {};
        MVMT_QS.forEach(q => { if (peacsState.mvmt[q.id] !== undefined) mvmtAnswers[q.id] = peacsState.mvmt[q.id]; });
        mvmtRec = { ...commonMeta, ...mvmtAnswers, score: +m.toFixed(4), dimension: 'mvmt' };
        dimUpdates[`peacs_dimensions/${safeId}/mvmt`] = mvmtRec;
        const mvmtHistKey = db.ref(`peacs_dimension_history/${safeId}/mvmt`).push().key;
        dimUpdates[`peacs_dimension_history/${safeId}/mvmt/${mvmtHistKey}`] = mvmtRec;
      }

      if (window._peacsDimDue.strata && enabledDims.includes('strata')) {
        const strataAnswers = {};
        STRATA_QS.forEach(q => { if (peacsState.strata[q.id] !== undefined) strataAnswers[q.id] = peacsState.strata[q.id]; });
        strataRec = { ...commonMeta, ...strataAnswers, score: +s.toFixed(4), dimension: 'strata' };
        dimUpdates[`peacs_dimensions/${safeId}/strata`] = strataRec;
        const strataHistKey = db.ref(`peacs_dimension_history/${safeId}/strata`).push().key;
        dimUpdates[`peacs_dimension_history/${safeId}/strata/${strataHistKey}`] = strataRec;
      }

      if (Object.keys(dimUpdates).length > 0) {
        await atlasDB('peacs_dimensions').update(dimUpdates);
      }

      // Capture source flags before resetting due state
      const _baseWasNew   = !!window._peacsDimDue.base;
      const _mvmtWasNew   = !!window._peacsDimDue.mvmt;
      const _strataWasNew = !!window._peacsDimDue.strata;

      // Update local dim cache with what was just submitted
      if (baseRec)   window._peacsDimCache.base   = baseRec;
      if (mvmtRec)   window._peacsDimCache.mvmt   = mvmtRec;
      if (strataRec) window._peacsDimCache.strata = strataRec;
      window._peacsDimDue = { base: false, mvmt: false, strata: false };

      // ── 2. Write record to peacs_assessments (full PE when all 3 dims; partial BASE score when fewer) ──
      const _writePeacsPin = (peVal) => {
        if (!userLocation.latitude || !userLocation.longitude) return;
        atlasDB('peacs_mapData').push({
          pe:        +peVal.toFixed(4),
          latitude:  userLocation.latitude,
          longitude: userLocation.longitude,
          country:   commonMeta.country   || 'Unknown',
          city:      commonMeta.city      || 'Unknown',
          ts:        commonMeta.timestamp || Date.now(),
        }).catch(e => console.error('[PEACS] peacs_mapData write failed:', e));
      };
      if (pe !== null && !isNaN(pe) && enabledDims.length === 3) {
        const entry = {
          ...commonMeta,
          base:    +b.toFixed(4),
          mvmt:    +m.toFixed(4),
          strata:  +s.toFixed(4),
          pe:      +pe.toFixed(4),
          pe_score: +pe.toFixed(4), // alias for older queries
          pe_zone: getPeZone(pe).label,
          base_source:   _baseWasNew   ? 'new' : 'carried',
          mvmt_source:   _mvmtWasNew   ? 'new' : 'carried',
          strata_source: _strataWasNew ? 'new' : 'carried',
        };
        await atlasDB('peacs_assessments').push(entry);
        updatePeacsPublicStats(pe);
        _writePeacsPin(pe);
      } else if (b !== null) {
        // Partial mode — write BASE score only so dashboard shows student progress
        const entry = {
          ...commonMeta,
          base:    +b.toFixed(4),
          pe:      +b.toFixed(4), // BASE score stands in for PE so validate rule passes
          pe_score: +b.toFixed(4),
          pe_zone: 'BASE only',
          partial: true,
          dims_collected: enabledDims.join(','),
        };
        await atlasDB('peacs_assessments').push(entry);
        updatePeacsPublicStats(b);
        _writePeacsPin(b);
      }
    } else {
      // No safeId — write to peacs_assessments (full or partial)
      if (pe !== null && !isNaN(pe) && enabledDims.length === 3) {
        const entry = {
          ...commonMeta,
          base: +b.toFixed(4), mvmt: +m.toFixed(4), strata: +s.toFixed(4),
          pe: +pe.toFixed(4), pe_score: +pe.toFixed(4),
          pe_zone: getPeZone(pe).label,
          base_source:   window._peacsDimDue.base   ? 'new' : 'carried',
          mvmt_source:   window._peacsDimDue.mvmt   ? 'new' : 'carried',
          strata_source: window._peacsDimDue.strata ? 'new' : 'carried',
        };
        await atlasDB('peacs_assessments').push(entry);
        updatePeacsPublicStats(pe);
        _writePeacsPin(pe);
        window._peacsDimDue = { base: false, mvmt: false, strata: false };
      } else if (b !== null) {
        // Partial mode, no patient ID
        const entry = {
          ...commonMeta,
          base:    +b.toFixed(4),
          pe:      +b.toFixed(4),
          pe_score: +b.toFixed(4),
          pe_zone: 'BASE only',
          partial: true,
          dims_collected: enabledDims.join(','),
        };
        await atlasDB('peacs_assessments').push(entry);
        updatePeacsPublicStats(b);
        _writePeacsPin(b);
      }
    }

    invalidatePeacsCache();
    window._pendingGlobeSpin = true;
    showToast('PEACS submitted successfully.', 3000);
    const content = document.getElementById('peacs-tab-content');
    if (content) content.innerHTML = renderPeacsResults(b, m, s, pe);
    document.querySelectorAll('#peacs-tab-bar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='results'));
    // If this is a combined session (MMAS + PEACS), offer continuation to MMAS
    if (window._sessionData?.instrument === 'both' && content) {
      const contBtn = document.createElement('button');
      contBtn.textContent = '← Continue to MMAS Assessment';
      contBtn.style.cssText = 'display:block;width:calc(100% - 48px);margin:16px 24px 0;padding:13px;font-family:\'IBM Plex Mono\',monospace;font-size:0.80rem;letter-spacing:0.14em;text-transform:uppercase;background:linear-gradient(135deg,rgba(78,156,245,0.12),rgba(46,201,138,0.08));border:1px solid rgba(78,156,245,0.3);color:var(--base);border-radius:var(--r);cursor:pointer;transition:all 0.2s;';
      contBtn.onmouseover = () => { contBtn.style.background='linear-gradient(135deg,rgba(78,156,245,0.22),rgba(46,201,138,0.14))'; };
      contBtn.onmouseout  = () => { contBtn.style.background='linear-gradient(135deg,rgba(78,156,245,0.12),rgba(46,201,138,0.08))'; };
      contBtn.onclick = () => { showScreen('screen-mmas'); _populateMmasFromSession(); };
      content.appendChild(contBtn);
    }

  } catch(e) {
    console.error(e);
    showToast('Submission error. Please try again.');
    if (btn) { btn.disabled=false; btn.textContent='Submit PEACS Assessment →'; }
  }
}

// ── Override updatePeacsFloater to allow partial submission ───────────────
// Submit button is enabled as soon as all DUE dimensions are answered.
function updatePeacsFloater() {
  const b = calcBase(peacsState.base);
  const m = calcMvmt(peacsState.mvmt);
  const s = calcStrata(peacsState.strata);
  const pe = calcPE(b, m, s);
  const zone = pe !== null ? getPeZone(pe) : null;

  const peEl   = document.getElementById('fl-pe');
  const zoneEl = document.getElementById('fl-zone');
  if (peEl)   { peEl.textContent  = pe !== null ? pe.toFixed(4) : '—'; peEl.style.color = zone?.color || ''; }
  if (zoneEl) { zoneEl.textContent = pe !== null ? zone.label : 'Answer due questions to begin'; zoneEl.style.color = zone?.color || ''; }

  const setBar = (id, val) => { const el=document.getElementById(id); if(el) el.style.width=(val!==null?Math.round(val*100):0)+'%'; };
  setBar('bar-b', b); setBar('bar-m', m); setBar('bar-s', s);

  const fbBase = document.getElementById('fb-base'); if(fbBase) fbBase.textContent = b!==null?b.toFixed(3):'—';
  const fbMvmt = document.getElementById('fb-mvmt'); if(fbMvmt) fbMvmt.textContent = m!==null?m.toFixed(3):'—';
  const fbStr  = document.getElementById('fb-strata');if(fbStr)  fbStr.textContent  = s!==null?s.toFixed(3):'—';

  // Count only the questions in DUE dimensions toward progress
  const due = window._peacsDimDue;
  const dueTotal = (due.base ? BASE_QS.length : 0) + (due.mvmt ? MVMT_QS.length : 0) + (due.strata ? STRATA_QS.length : 0);
  const dueAnswered =
    (due.base   ? Object.keys(peacsState.base).length   : 0) +
    (due.mvmt   ? Object.keys(peacsState.mvmt).length   : 0) +
    (due.strata ? Object.keys(peacsState.strata).length : 0);

  const totalDisplay = dueTotal > 0 ? dueTotal : BASE_QS.length + MVMT_QS.length + STRATA_QS.length;
  const progF = document.getElementById('prog-f'); if (progF) progF.style.width = Math.round(dueAnswered/Math.max(totalDisplay,1)*100)+'%';
  const progN = document.getElementById('prog-n'); if (progN) progN.textContent = dueAnswered + ' / ' + totalDisplay + (dueTotal < 22 ? ' due' : '');

  // Enable submit when all due dimensions have valid scores
  const enabledDims = window._peacsEnabledDims || ['base','mvmt','strata'];
  const baseDone   = !due.base   || b !== null;
  const mvmtDone   = !due.mvmt   || m !== null;
  const strataDone = !due.strata || s !== null;
  // If all 3 dims are enabled, require a valid PE composite; for partial workspaces just require all enabled dims answered
  const allDueDone = baseDone && mvmtDone && strataDone && (
    enabledDims.length === 3
      ? pe !== null
      : enabledDims.every(d => (d==='base'&&b!==null)||(d==='mvmt'&&m!==null)||(d==='strata'&&s!==null))
  );

  const submitBtn = document.getElementById('peacs-submit-btn');
  if (submitBtn) submitBtn.disabled = !allDueDone;
}

// Patch switchPeacsTab to load dimensions when patient ID is known
function retakePeacs() {
  peacsState.base={}; peacsState.mvmt={}; peacsState.strata={};
  window._peacsDimCache = { base: null, mvmt: null, strata: null };
  window._peacsDimDue   = _defaultPeacsDimDue();
  document.querySelectorAll('#peacs-tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  switchPeacsTab('assess');
}

const _origSwitchPeacsTab = window.switchPeacsTab;
function switchPeacsTab(tab) {
  currentPeacsTab = tab;
  document.querySelectorAll('#peacs-tab-bar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const content  = document.getElementById('peacs-tab-content');
  const mapShell = document.getElementById('peacs-map-shell');
  if (tab === 'map') {
    mapShell.classList.add('active'); mapShell.style.display='flex';
    content.style.display='none';
    initPeacsMap(); return;
  }
  mapShell.classList.remove('active'); mapShell.style.display='none';
  content.style.display='block';

  if (tab === 'assess') {
    // Load dimensions for known patient ID before rendering
    const patId = window._sessionData?.patientId || window._sessionPatientId
      || document.getElementById('p-sdoh-patient-num')?.value.trim()
      || document.getElementById('sdoh-patient-num')?.value.trim()
      || '';
    if (patId) {
      loadPeacsDimensions(patId).then(() => {
        peacsState.base={}; peacsState.mvmt={}; peacsState.strata={};
        _preFillFromCache();
        content.innerHTML = renderPeacsAssessment();
        initPeacsSdohSection();
        updatePeacsFloater();
      });
    } else {
      peacsState.base={}; peacsState.mvmt={}; peacsState.strata={};
      window._peacsDimCache = { base: null, mvmt: null, strata: null };
      window._peacsDimDue   = _defaultPeacsDimDue();
      content.innerHTML = renderPeacsAssessment();
      initPeacsSdohSection();
      updatePeacsFloater();
    }
  } else if (tab === 'results') {
    const b=calcBase(peacsState.base), m=calcMvmt(peacsState.mvmt), s=calcStrata(peacsState.strata), pe=calcPE(b,m,s);
    if (pe !== null) { content.innerHTML = renderPeacsResults(b, m, s, pe); }
    else { content.innerHTML = '<div class="empty-state" style="padding:60px 24px;text-align:center;"><div style="font-family:var(--font-display);font-size:1.4rem;font-weight:300;color:var(--bright);margin-bottom:8px;">No results yet</div><div style="font-size:0.88rem;color:var(--dim);">Complete the due dimensions first, then return here to view your PEACS profile.</div></div>'; }
  } else if (tab === 'kybos') {
    content.innerHTML = renderKybos();
    requestAnimationFrame(() => { drawKybos(null); populateKybosCards(); });
  } else if (tab === 'loom') {
    content.innerHTML = renderLoom();
    requestAnimationFrame(drawLoom);
  } else if (tab === 'diagnostics') {
    content.innerHTML = '<div id="peacs-diag-list"><div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">Loading…</div></div>';
    loadPeacsDiagnostics();
  } else if (tab === 'trend') {
    content.innerHTML = renderPeacsTrend();
    const trendPatId = window._sessionData?.patientId || window._sessionPatientId || '';
    if (trendPatId) requestAnimationFrame(() => loadPeacsTrend(trendPatId));
  } else if (tab === 'history') {
    // Patient assessment history: chronological list of all sessions for this patient
    content.innerHTML = '<div id="peacs-history-list"><div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">Loading history…</div></div>';
    loadPeacsCache(allData => {
      const el = document.getElementById('peacs-history-list');
      if (!el) return;
      const patId = window._sessionData?.patientId || window._sessionPatientId || '';
      const relevant = patId
        ? allData.filter(r => String(r.patient_number||'').trim() === String(patId).trim() || r.user_id === getUserId())
        : allData.filter(r => r.user_id === getUserId());
      if (!relevant.length) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;"><div style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--bright);margin-bottom:10px;">No Assessment History</div><div style="font-size:0.88rem;color:var(--muted);line-height:1.7;max-width:400px;">No PEACS history data available. Complete a PEACS assessment to populate this view.</div></div>`;
        return;
      }
      const sorted = relevant.slice().sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
      const peZone = pe => pe>=0.85?{label:'Optimal',c:'#10b981'}:pe>=0.70?{label:'Good',c:'#3b82f6'}:pe>=0.55?{label:'Moderate',c:'#f59e0b'}:pe>=0.40?{label:'Poor',c:'#ef4444'}:{label:'Critical',c:'#991b1b'};
      el.innerHTML = `<div style="padding:24px;">
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:#3d506a;margin-bottom:16px;">Assessment History — ${sorted.length} record${sorted.length===1?'':'s'}</div>
        ${sorted.map((a,i) => {
          const z = peZone(a.pe||0);
          const ts = new Date(a.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
          const patLabel = a.patient_number ? `Patient #${a.patient_number}` : (a.user_id ? `UID ···${String(a.user_id).slice(-6)}` : `Record ${i+1}`);
          return `<div class="peacs-result-card" style="margin-bottom:10px;display:flex;align-items:center;gap:14px;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.88rem;color:var(--bright);font-weight:500;margin-bottom:3px;">${_esc(patLabel)}</div>
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;color:var(--muted);">${ts}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
              <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;color:#4e9cf5;">B ${(a.base||0).toFixed(3)}</span>
              <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;color:#8b6ff5;">M ${(a.mvmt||0).toFixed(3)}</span>
              <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.84rem;color:#2ec98a;">S ${(a.strata||0).toFixed(3)}</span>
              <span style="font-family:'IBM Plex Mono\',monospace;font-size:0.90rem;font-weight:600;color:${z.c};background:${z.c}18;border:1px solid ${z.c}33;border-radius:6px;padding:2px 8px;">PE ${(a.pe||0).toFixed(4)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    });
  } else if (tab === 'summary') {
    // Workspace-level aggregate summary: cohort statistics across all assessments
    content.innerHTML = '<div id="peacs-summary-body"><div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">Loading summary…</div></div>';
    loadPeacsCache(allData => {
      const el = document.getElementById('peacs-summary-body');
      if (!el) return;
      if (!allData.length) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;"><div style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--bright);margin-bottom:10px;">No Summary Data Available</div><div style="font-size:0.88rem;color:var(--muted);line-height:1.7;max-width:400px;">No workspace PEACS data available. Complete a PEACS assessment to populate this summary view.</div></div>`;
        return;
      }
      const n = allData.length;
      const avg = k => allData.reduce((s,r)=>s+(r[k]||0),0)/n;
      const avgBase = avg('base'), avgMvmt = avg('mvmt'), avgStrata = avg('strata'), avgPe = avg('pe');
      const byPat = groupByPatient(allData);
      const patCount = Object.keys(byPat).length;
      const peZone = pe => pe>=0.85?{label:'Optimal',c:'#10b981'}:pe>=0.70?{label:'Good',c:'#3b82f6'}:pe>=0.55?{label:'Moderate',c:'#f59e0b'}:pe>=0.40?{label:'Poor',c:'#ef4444'}:{label:'Critical',c:'#991b1b'};
      const zoneCounts = {Optimal:0,Good:0,Moderate:0,Poor:0,Critical:0};
      allData.forEach(r => { const z = peZone(r.pe||0); zoneCounts[z.label]++; });
      const zoneColors = {Optimal:'#10b981',Good:'#3b82f6',Moderate:'#f59e0b',Poor:'#ef4444',Critical:'#991b1b'};
      const avgZone = peZone(avgPe);
      el.innerHTML = `<div style="padding:24px;max-width:720px;">
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:#3d506a;margin-bottom:20px;">Workspace Cohort Summary — ${n} assessment${n===1?'':'s'} · ${patCount} patient${patCount===1?'':'s'}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
          ${[['BASE',avgBase,'#4e9cf5'],['MVMT',avgMvmt,'#8b6ff5'],['STRATA',avgStrata,'#2ec98a'],['AVG PE',avgPe,avgZone.c]].map(([lbl,val,col])=>`
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;text-align:center;">
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:1.4rem;font-weight:600;color:${col};">${val.toFixed(3)}</div>
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;color:#3d506a;margin-top:4px;">${lbl}</div>
            </div>`).join('')}
        </div>
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:#3d506a;margin-bottom:10px;">PE Zone Distribution</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${Object.entries(zoneCounts).map(([zone,count])=>{
            const pct = n ? Math.round(count/n*100) : 0;
            const col = zoneColors[zone];
            return `<div style="display:flex;align-items:center;gap:10px;">
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;color:${col};width:70px;flex-shrink:0;">${zone}</div>
              <div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width 0.4s;"></div></div>
              <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.82rem;color:#6b8099;width:50px;text-align:right;flex-shrink:0;">${count} (${pct}%)</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });
  } else if (tab === 'export') {
    // Data export: download workspace PEACS records as JSON or CSV
    content.innerHTML = '<div id="peacs-export-body"><div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">Preparing export…</div></div>';
    loadPeacsCache(allData => {
      const el = document.getElementById('peacs-export-body');
      if (!el) return;
      if (!allData.length) {
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;"><div style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--bright);margin-bottom:10px;">No Export Data Available</div><div style="font-size:0.88rem;color:var(--muted);line-height:1.7;max-width:400px;">No PEACS assessment records available to export. Complete a PEACS assessment to populate this view.</div></div>`;
        return;
      }
      const n = allData.length;
      const triggerDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      el.innerHTML = `<div style="padding:32px;max-width:560px;">
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;color:#3d506a;margin-bottom:20px;">Export PEACS Records — ${n} assessment${n===1?'':'s'}</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button onclick="(function(){
            const data=${JSON.stringify(allData)};
            const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
            const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='peacs_export_'+Date.now()+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
          })()" style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.25);color:#4e9cf5;border-radius:8px;padding:12px 20px;cursor:pointer;text-align:left;transition:all 0.2s;"
            onmouseenter="this.style.background='rgba(78,156,245,0.15)'" onmouseleave="this.style.background='rgba(78,156,245,0.08)'">
            Download JSON — Full record set with all fields
          </button>
          <button onclick="(function(){
            const data=${JSON.stringify(allData)};
            const header='patient_number,user_id,timestamp,base,mvmt,strata,pe,city,country,institution_code';
            const rows=data.map(r=>[r.patient_number||'',r.user_id||'',r.timestamp||'',r.base||'',r.mvmt||'',r.strata||'',r.pe||'',r.city||'',r.country||'',r.institution_code||''].join(','));
            const blob=new Blob([[header,...rows].join('\\n')],{type:'text/csv'});
            const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='peacs_export_'+Date.now()+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
          })()" style="font-family:'IBM Plex Mono\',monospace;font-size:0.86rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.25);color:#2ec98a;border-radius:8px;padding:12px 20px;cursor:pointer;text-align:left;transition:all 0.2s;"
            onmouseenter="this.style.background='rgba(46,201,138,0.15)'" onmouseleave="this.style.background='rgba(46,201,138,0.08)'">
            Download CSV — Flat table for Excel / SPSS
          </button>
        </div>
        <div style="font-family:'IBM Plex Mono\',monospace;font-size:0.80rem;color:#2d3f52;margin-top:16px;line-height:1.6;">Fields exported: patient_number, user_id, timestamp, base, mvmt, strata, pe, city, country, institution_code.</div>
      </div>`;
    });
  } else {
    // Unknown or unimplemented tab — render a specific empty state without "Coming soon."
    const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1).replace(/-/g,' ');
    content.innerHTML = `<div class="empty-state" style="padding:60px 24px;text-align:center;">
      <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:300;color:var(--bright);margin-bottom:8px;">${_esc(tabLabel)}</div>
      <div style="font-size:0.88rem;color:var(--dim);line-height:1.7;max-width:360px;margin:0 auto;">No ${_esc(tabLabel)} data available. Complete a PEACS assessment to populate this view.</div>
    </div>`;
  }
}

function loadPeacsDiagnostics() {
  database.ref('peacs_assessments').once('value', snap => {
    const el = document.getElementById('peacs-diag-list');
    if (!el) return;
    const data = snap.val();
    if (!data) { el.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">No PEACS assessments yet.</div>'; return; }
    const ws = (currentWorkspace || '').toUpperCase();
    let records = Object.values(data);
    if (ws && !isSuperAdmin()) {
      if (isInstitutionMode()) {
        const tagged = records.filter(r => {
          const code   = (r.institution_code  || '').toUpperCase();
          const parent = (r.parent_institution || '').toUpperCase();
          return code === ws || parent === ws;
        });
        records = tagged.length > 0 ? tagged : records;
      } else {
        const tagged = records.filter(r => (r.institution_code || '').toUpperCase() === ws);
        records = tagged.length > 0 ? tagged : records.filter(r => !r.institution_code);
      }
    }
    records = records.sort((a,b) => (b.timestamp||0) - (a.timestamp||0)).slice(0, 30);
    if (!records.length) {
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;">
          <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--bright);margin-bottom:10px;">No PEACS Diagnostics Yet</div>
          <div style="font-size:0.88rem;color:var(--muted);line-height:1.7;max-width:380px;">Submit a PEACS assessment to generate diagnostic profiles here. Each submission produces an Adherence Architecture, Execution, and Context breakdown with recommended interventions.</div>
        </div>`;
      return;
    }
    el.innerHTML = records.map(a => {
      const z    = getPeZone(a.pe);
      const diag = getPeacsDiag(a.pe, a.base, a.mvmt, a.strata);
      const ts   = new Date(a.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
      const patLabel = a.patient_number ? `Patient #${a.patient_number}` : (a.user_id ? `UID ···${String(a.user_id).slice(-6)}` : '');
      const locStr = [a.city, a.country].filter(Boolean).join(', ');
      return `<div class="peacs-result-card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--bright);font-weight:500;">${_esc(patLabel||ts)}</div>
          <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);">${patLabel?ts+(locStr?' · '+_esc(locStr):''):_esc(locStr)}</div>
        </div>
        <div class="peacs-result-scores">
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--base)">${(a.base||0).toFixed(3)}</div><div class="peacs-score-lbl">BASE</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--mvmt)">${(a.mvmt||0).toFixed(3)}</div><div class="peacs-score-lbl">MVMT</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--strata)">${(a.strata||0).toFixed(3)}</div><div class="peacs-score-lbl">STRATA</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:${z.color}">${(a.pe||0).toFixed(4)}</div><div class="peacs-score-lbl">PE</div></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.88rem;padding:6px 10px;border-radius:6px;background:${z.color}18;border:1px solid ${z.color}44;color:${z.color};margin-bottom:12px;">${z.label}</div>
        ${_peacsConfidenceBar(_peacsComputeConfidence(a))}
        <div class="peacs-diag-box">
          <div class="peacs-diag-title">${diag.primary}</div>
          <div class="peacs-diag-type">${diag.type}</div>
          ${diag.actions.map(ac=>`<div class="peacs-diag-action"><span style="color:var(--base);flex-shrink:0">→</span>${ac}</div>`).join('')}
        </div>
      </div>`;
    }).join('');
  });
}

// PEACS map location clusters: locationKey → { records:[], marker, popup }
let peacsClusters = {};

function buildPeacsPopupHTML(records, idx) {
  const a = records[idx];
  const peZones = {'Optimal':'#10b981','Good':'#3b82f6','Moderate':'#f59e0b','Poor':'#ef4444','Critical':'#991b1b'};
  const getZone = pe => pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
  const pe   = (a.pe||0).toFixed(4);
  const b    = (a.base||0).toFixed(3);
  const m    = (a.mvmt||0).toFixed(3);
  const s    = (a.strata||0).toFixed(3);
  const z    = getZone(a.pe||0);
  const col  = peZones[z];
  const total = records.length;
  const patId = a.patient_number ? `Patient #${a.patient_number}` : (a.user_id ? `UID ···${String(a.user_id).slice(-6)}` : '');
  const dateStr = a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  // avg PE for this cluster
  const avgPE = (records.reduce((s,r)=>s+(r.pe||0),0)/total).toFixed(3);
  return `<div style="padding:0;font-family:'IBM Plex Sans',sans-serif;background:#0d1525;border-radius:10px;min-width:260px;">
    <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
        <div style="font-weight:600;font-size:13px;color:#e2eaf4;">${a.city&&a.city!=='Unknown'?a.city:'—'}, ${a.country&&a.country!=='Unknown'?a.country:'—'}</div>
        ${total>1?`<div style="font-family:'IBM Plex Mono\',monospace;font-size:9px;color:#6b8099;padding:2px 7px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;">${total} entries · avg PE ${avgPE}</div>`:''}
      </div>
    </div>
    <div style="padding:10px 14px;">
      ${patId?`<div style="font-family:'IBM Plex Mono\',monospace;font-size:10px;color:#6b8099;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">${patId}</div>`:''}
      <div style="font-size:12px;color:${col};font-weight:700;margin-bottom:6px;">PE ${pe} · ${z}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(78,156,245,0.3);color:#4e9cf5;">BASE ${b}</span>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(139,111,245,0.3);color:#8b6ff5;">MVMT ${m}</span>
        <span style="font-family:'IBM Plex Mono\',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(46,201,138,0.3);color:#2ec98a;">STRATA ${s}</span>
      </div>
      ${a.institution_code?`<div style="font-size:10px;color:#6b8099;font-family:'IBM Plex Mono\',monospace;margin-bottom:4px;">${a.institution_code}</div>`:''}
      ${dateStr?`<div style="font-size:10px;color:#4a5f78;font-family:'IBM Plex Mono\',monospace;">${dateStr}</div>`:''}
    </div>
    ${total>1?`<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;">
      <button onclick="peacsPopupNav(this,${-1})" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;${idx===0?'opacity:0.3;pointer-events:none;':''}">‹</button>
      <span style="font-family:'IBM Plex Mono\',monospace;font-size:10px;color:#4a5f78;">${idx+1} / ${total}</span>
      <button onclick="peacsPopupNav(this,${1})" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;${idx===total-1?'opacity:0.3;pointer-events:none;':''}">›</button>
    </div>`:''}
  </div>`;
}

// Called from inline onclick in popup nav buttons
function peacsPopupNav(btn, dir) {
  const wrapper = btn.closest('.mapboxgl-popup-content');
  if (!wrapper) return;
  const key = wrapper.dataset.peacsKey;
  if (!key || !peacsClusters[key]) return;
  const cluster = peacsClusters[key];
  cluster.popupIdx = Math.max(0, Math.min(cluster.records.length-1, cluster.popupIdx + dir));
  cluster.popup.setHTML(buildPeacsPopupHTML(cluster.records, cluster.popupIdx));
  // Re-attach key after setHTML re-renders
  setTimeout(()=>{
    const w2 = cluster.popup.getElement()&&cluster.popup.getElement().querySelector('.mapboxgl-popup-content');
    if(w2) w2.dataset.peacsKey = key;
  },10);
}

function addPeacsClusterMarker(key, cluster) {
  if (!peacsMap) return;
  if (cluster.marker) cluster.marker.remove();
  const records = cluster.records;
  const avgPE   = records.length > 0 ? records.reduce((s,r)=>s+(r.pe||0),0)/records.length : 0;
  const peZones = {'Optimal':'#10b981','Good':'#3b82f6','Moderate':'#f59e0b','Poor':'#ef4444','Critical':'#991b1b'};
  const getZone = pe => pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
  const z       = getZone(avgPE);
  const col     = peZones[z];
  const sz      = Math.min(10+records.length*2, 28);
  // Keys are either "lat,lng" or "city||country" — fall back to first record's coords for city keys
  let [lat,lng] = key.split(',').map(parseFloat);
  if (isNaN(lat) || isNaN(lng)) {
    const firstWithCoords = records.find(r => r.latitude && r.longitude && !isNaN(r.latitude) && !isNaN(r.longitude));
    if (!firstWithCoords) return; // no usable coordinates — skip this cluster
    lat = firstWithCoords.latitude;
    lng = firstWithCoords.longitude;
  }

  const el  = document.createElement('div');
  el.style.cssText = 'width:0;height:0;position:relative;cursor:pointer;';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;top:${-sz/2}px;left:${-sz/2}px;border-radius:50%;background:${col};box-shadow:0 0 6px ${col};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:9px;transition:transform 0.15s,box-shadow 0.15s;transform-origin:center center;`;
  if (records.length>1) dot.textContent = records.length;
  el.appendChild(dot);

  cluster.popup = new mapboxgl.Popup({ offset:sz/2+4, maxWidth:'310px', closeButton:true, closeOnClick:false })
    .setLngLat([lng, lat]);
  cluster.popupIdx = cluster.popupIdx || 0;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    dot.style.transform = 'scale(1.5)';
    cluster.popup.setHTML(buildPeacsPopupHTML(records, cluster.popupIdx));
    cluster.popup.addTo(peacsMap);
    setTimeout(()=>{
      const w = cluster.popup.getElement()&&cluster.popup.getElement().querySelector('.mapboxgl-popup-content');
      if(w) w.dataset.peacsKey = key;
      dot.style.transform = '';
    },15);
  });
  cluster.popup.on('close', () => { dot.style.transform=''; });

  // Subtle glow on hover, click opens popup
  el.addEventListener('mouseenter', () => { dot.style.boxShadow=`0 0 14px ${col}`; });
  el.addEventListener('mouseleave', () => { dot.style.boxShadow=`0 0 6px ${col}`; });

  cluster.marker = new mapboxgl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(peacsMap);
}

function initPeacsMap() {
  if (peacsMapInited) { ensureMapbox().then(()=>{ setTimeout(()=>peacsMap&&peacsMap.resize(),100); }); return; }
  peacsMapInited = true;
  peacsClusters = {};
  ensureMapbox().then(() => {
    mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;
    peacsMap = new mapboxgl.Map({
      container:'peacs-map',
      style:(window._mapboxThemeStyle||'mapbox://styles/mapbox/dark-v11'),
      center:[0,20], zoom:2, projection:'globe'
    });
    peacsMap.addControl(new mapboxgl.NavigationControl());
    peacsMap.on('load', () => {
      const fog = window._mapboxFog || {
        color: '#04091c', 'high-color': '#0d1a3a',
        'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
      };
      peacsMap.setFog(fog);
      database.ref('peacs_assessments').once('value', snap => {
        const data = snap.val();
        if (!data) return;
        const allVals = Object.values(data);
        // Count ALL records for total — matches dashboard count
        const totalEl = document.getElementById('peacs-map-total');
        if (totalEl) totalEl.textContent = allVals.length.toLocaleString();
        // Only plot records that have valid coords
        allVals.forEach(a => {
          if (!a.latitude||!a.longitude) return;
          const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
          if (!peacsClusters[key]) peacsClusters[key] = { records:[], marker:null, popup:null, popupIdx:0 };
          peacsClusters[key].records.push(a);
        });
        Object.entries(peacsClusters).forEach(([key,cluster]) => addPeacsClusterMarker(key, cluster));
      });
      // Live listener for new PEACS submissions
      if (!window._peacsMapListenerActive) {
        window._peacsMapListenerActive = true;
      const since = Date.now();
      database.ref('peacs_assessments').on('child_added', snap => {
        const a = snap.val();
        if (!a || !a.timestamp || a.timestamp <= since) return;
        // Always update total count — even if no coords
        const totalEl = document.getElementById('peacs-map-total');
        if (totalEl) {
          const current = parseInt(totalEl.textContent.replace(/,/g,'')) || 0;
          totalEl.textContent = (current + 1).toLocaleString();
        }
        // Only plot on map if coords are valid
        if (!a.latitude || !a.longitude) return;
        const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
        if (!peacsClusters[key]) peacsClusters[key] = { records:[], marker:null, popup:null, popupIdx:0 };
        peacsClusters[key].records.push(a);
        addPeacsClusterMarker(key, peacsClusters[key]);
      });
      } // end !window._peacsMapListenerActive
    });
  }); // end ensureMapbox
}

