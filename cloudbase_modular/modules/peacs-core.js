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
      style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:6px 13px;border:1px solid ${borderCol};border-radius:20px;background:${bgCol};color:${textCol};cursor:pointer;white-space:nowrap;transition:all 0.2s;"
      onmouseenter="if('${name}'!==(_activePhenotypeDemo||''))this.style.borderColor='${d.color}88',this.style.color='${d.color}'"
      onmouseleave="if('${name}'!==(_activePhenotypeDemo||''))this.style.borderColor='rgba(255,255,255,0.1)',this.style.color='#6b8099'"
      >${d.emoji} ${name}</button>`;
  }).join('');
  const clearBtn = active
    ? `<button onclick="clearPhenotypeDemo()" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:6px 13px;border:1px solid rgba(255,255,255,0.12);border-radius:20px;background:none;color:rgba(255,255,255,0.3);cursor:pointer;white-space:nowrap;margin-left:4px;">← Real Data</button>`
    : '';
  const desc = active
    ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:${defs[active].color}88;line-height:1.55;margin-top:8px;">${defs[active].description}</div>`
    : `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#3d506a;line-height:1.5;margin-top:8px;">Select a phenotype to load a preset trajectory example — or use real workspace data.</div>`;
  return `<div id="phenotype-picker" style="padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(4,8,15,0.4);">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:#3d506a;white-space:nowrap;">⬡ Phenotype Examples</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${btns}${clearBtn}</div>
    </div>
    ${desc}
  </div>`;
}

function loadPhenotypeDemo(name) {
  const def = _PEACS_PHENOTYPE_DEMOS[name];
  if (!def) return;
  _activePhenotypeDemo = name;
  // Flatten all patient trajectories into a single cache array
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
  _peacsCache = null;
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
      fc.innerHTML=`<div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:#6b8099;">Need 2+ assessments to forecast. Only ${pts.length} recorded.</div>`;
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
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#cdd8e8;margin-bottom:8px;">${label}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:#6b8099;">Current PE</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:#d4a843;font-weight:600;">${lastPe.toFixed(3)}</span>
        <span style="font-size:0.86rem;color:${trendCol};margin-left:4px;">${trend}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;color:#3d506a;margin-bottom:4px;">Next assessment</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:600;color:${peColor(f1pe)};">${f1pe.toFixed(3)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#6b8099;margin-top:2px;">${peZone(f1pe)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#3d506a;margin-top:4px;">B ${forecast[0].b.toFixed(2)} · M ${forecast[0].m.toFixed(2)} · S ${forecast[0].s.toFixed(2)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;color:#3d506a;margin-bottom:4px;">+2 assessments</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:600;color:${peColor(f2pe)};">${f2pe.toFixed(3)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#6b8099;margin-top:2px;">${peZone(f2pe)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#3d506a;margin-top:4px;">B ${forecast[1].b.toFixed(2)} · M ${forecast[1].m.toFixed(2)} · S ${forecast[1].s.toFixed(2)}</div>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:#2d3f52;margin-top:8px;">Linear extrapolation based on ${n} assessments. Dotted line visible in cube.</div>`;
  });
}

function renderKybos(){
  return`<div style="background:#060d1a;border-radius:18px;overflow:hidden;box-shadow:0 0 60px rgba(0,0,0,0.6);">

    <!-- Header bar -->
    <div style="display:flex;align-items:center;gap:14px;padding:18px 24px 14px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.22em;text-transform:uppercase;color:#d4a843;margin-bottom:3px;">Theory of Predictive Emergence</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.45rem;font-weight:300;color:#e8f0f8;letter-spacing:-0.01em;">KYBOS Cube™</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span id="kybos-badge" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:#4a6080;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:3px 12px;">Loading…</span>
        <button id="kybos-planes-btn" onclick="surfacesOn=!surfacesOn;this.style.background=surfacesOn?'rgba(212,168,67,0.15)':'rgba(255,255,255,0.04)';this.style.borderColor=surfacesOn?'rgba(212,168,67,0.4)':'rgba(255,255,255,0.1)';this.style.color=surfacesOn?'#d4a843':'#6b8099';document.getElementById('kybos-chart').innerHTML='';drawKybos(kybosSelectedUid);" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;transition:all 0.2s;">Threshold Planes</button>
        <button onclick="const el=document.getElementById('kybos-chart');if(el&&window.Plotly)Plotly.relayout(el,{'scene.camera.eye':{x:1.6,y:1.6,z:1.4}})" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;">Reset View</button>
        <button onclick="kybosSelectedUid=null;document.querySelectorAll('.kybos-user-card').forEach(c=>c.classList.remove('kybos-selected','kybos-faded'));drawKybos(null);document.getElementById('kybos-forecast-panel').style.display='none';" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:7px;padding:5px 14px;cursor:pointer;">Show All</button>
      </div>
    </div>

    <!-- Legend strip -->
    <div style="display:flex;align-items:center;gap:24px;padding:10px 24px;border-bottom:1px solid rgba(255,255,255,0.04);flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:7px;">
        <svg width="32" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#4e9cf5" stroke-width="2.5"/><circle cx="28" cy="5" r="3.5" fill="#fff" stroke="#4e9cf5" stroke-width="1.5"/></svg>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Actual trajectory</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <svg width="36" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#d4a843" stroke-width="1.5" stroke-dasharray="3,2"/><polygon points="30,2 36,5 30,8" fill="none" stroke="#d4a843" stroke-width="1.5"/></svg>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Forecast projection</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:14px;height:14px;border-radius:2px;background:rgba(212,168,67,0.25);border:1px solid rgba(212,168,67,0.5);"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">Your assessments</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:24px;height:8px;background:rgba(46,201,138,0.12);border:1px solid rgba(46,201,138,0.3);border-radius:2px;"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a6080;">STRATA threshold plane</span>
      </div>
      <div style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:#3d506a;">PE = (BASE × MVMT × STRATA)<sup>1/3</sup> · Click a patient to isolate &amp; forecast</div>
    </div>

    ${renderPhenotypePicker()}

    <!-- Main split: cube (wide) + patient list (narrow) -->
    <div style="display:grid;grid-template-columns:1fr 280px;min-height:620px;">

      <!-- Cube -->
      <div style="padding:0;position:relative;">
        <div id="kybos-chart" style="min-height:620px;width:100%;"></div>
        <!-- Axis legend overlay -->
        <div style="position:absolute;bottom:16px;left:20px;display:flex;gap:16px;">
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#4e9cf5;"></div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#4e9cf5;">BASE · Biological</span></div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#8b6ff5;"></div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#8b6ff5;">MVMT · Behavioral</span></div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:3px;border-radius:2px;background:#2ec98a;"></div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:#2ec98a;">STRATA · Contextual</span></div>
        </div>
      </div>

      <!-- Patient list + forecast panel -->
      <div style="border-left:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;overflow:hidden;">

        <!-- Forecast panel (hidden until patient selected) -->
        <div id="kybos-forecast-panel" style="display:none;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(212,168,67,0.04);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.16em;text-transform:uppercase;color:#d4a843;margin-bottom:10px;">Predictive Forecast</div>
          <div id="kybos-forecast-content"></div>
        </div>

        <!-- Patient cards -->
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:#3d506a;padding:14px 18px 8px;">Participants</div>
        <div id="kybos-cards-col" style="overflow-y:auto;flex:1;padding:0 10px 12px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.61rem;color:#3d506a;padding:20px;text-align:center;">Loading…</div>
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
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:${col};font-weight:500;letter-spacing:0.05em;">${headLabel}</div>
          <div style="display:flex;align-items:center;gap:5px;">
            ${isTrajectory?spark:''}
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;color:${zone.c};background:${zone.c}18;border:1px solid ${zone.c}33;border-radius:10px;padding:1px 6px;">${zone.label}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#4e9cf5;">B ${(lastPt.base||0).toFixed(2)}</span>
          <span style="color:#3d506a;font-size:0.80rem;">·</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#8b6ff5;">M ${(lastPt.mvmt||0).toFixed(2)}</span>
          <span style="color:#3d506a;font-size:0.80rem;">·</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#2ec98a;">S ${(lastPt.strata||0).toFixed(2)}</span>
          <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:${col};font-weight:600;">PE ${pe.toFixed(3)}</span>
        </div>
        ${isTrajectory?`<div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:#3d506a;margin-top:5px;letter-spacing:0.06em;">${pts.map(p=>(p.pe||0).toFixed(2)).join(' → ')}</div>`:''}
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
            <div style="font-family:var(--font-mono);font-size:0.88rem;color:${col};font-weight:500;">${patLabel}</div>
            ${locStr?`<div style="font-family:var(--font-mono);font-size:0.90rem;color:rgba(255,255,255,0.3);">${locStr}</div>`:''}
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
};

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

function _updatePeacsFloaterLegacy() {
  const zoneEl = document.getElementById('fl-zone');
  if (peEl) { peEl.textContent = pe!==null ? pe.toFixed(4) : '—'; peEl.style.color = zone.color; }
  if (zoneEl) { zoneEl.textContent = pe!==null ? zone.label : 'Answer questions to begin'; zoneEl.style.color = zone.color; }

  const setBar = (id, val) => { const el=document.getElementById(id); if(el) el.style.width=(val!==null?Math.round(val*100):0)+'%'; };
  setBar('bar-b', b); setBar('bar-m', m); setBar('bar-s', s);

  const fbBase = document.getElementById('fb-base'); if(fbBase) fbBase.textContent = b!==null?b.toFixed(3):'—';
  const fbMvmt = document.getElementById('fb-mvmt'); if(fbMvmt) fbMvmt.textContent = m!==null?m.toFixed(3):'—';
  const fbStr  = document.getElementById('fb-strata');if(fbStr)  fbStr.textContent  = s!==null?s.toFixed(3):'—';

  const _totalPeacsQs = BASE_QS.length + MVMT_QS.length + STRATA_QS.length;
  const progF = document.getElementById('prog-f'); if (progF) progF.style.width = Math.round(answered/_totalPeacsQs*100)+'%';
  const progN = document.getElementById('prog-n'); if (progN) progN.textContent = answered + ' / ' + _totalPeacsQs;

  const submitBtn = document.getElementById('peacs-submit-btn');
  if (submitBtn) submitBtn.disabled = (pe === null);
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

function _renderPeacsAssessmentLegacy() {
  const L = PEACS_QUESTIONS[peacsCurrentLang] || PEACS_QUESTIONS.en;
  const baseCards   = BASE_QS.map(q => peacsQCard(q,'base')).join('');
  const mvmtCards   = MVMT_QS.map(q => peacsQCard(q,'mvmt')).join('');
  const strataCards = STRATA_QS.map(q => peacsQCard(q,'strata')).join('');
  // Pull patient ID from session (set by MMAS submission) → MMAS field → fallback empty
  const autoPatId = window._sessionPatientId || (document.getElementById('sdoh-patient-num')?.value.trim()) || '';
  return `<div class="assess-layout">
    <div class="assess-questions">
      <div style="background:rgba(139,111,245,0.07);border:1px solid rgba(139,111,245,0.2);border-radius:var(--r);padding:16px 18px;margin-bottom:24px;">
        <div style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mvmt);margin-bottom:10px;">${L.pairing_title}</div>
        <div style="font-size:0.88rem;color:var(--muted);line-height:1.65;margin-bottom:14px;">${L.pairing_body}</div>
        <div>
          <label style="font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px;">${L.patient_id_label} <span style="color:var(--dim);font-size:0.80rem;text-transform:none;letter-spacing:0;">${L.patient_id_hint}</span></label>
          <input id="peacs-patient-id" type="text" value="${autoPatId}"
            style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.3);color:var(--bright);border-radius:7px;padding:9px 12px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            placeholder="e.g., ADH1234ABCD or Patient-001"
            onfocus="this.style.borderColor='rgba(139,111,245,0.65)'"
            onblur="this.style.borderColor='rgba(139,111,245,0.3)'"/>
        </div>
      </div>
      <div class="dimension-section">
        <div class="dim-header"><div class="dim-dot base"></div><div><div class="dim-title">BASE <span class="dim-acronym">${L.base_dim.replace('BASE — ','')}</span></div><div class="dim-subtitle">${L.base_period}</div></div></div>
        <div style="font-size:0.84rem;color:var(--muted);line-height:1.6;background:rgba(78,156,245,0.04);border:1px solid rgba(78,156,245,0.12);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-style:italic;">${L.base_intro}</div>
        ${baseCards}
      </div>
      <div class="dimension-section">
        <div class="dim-header"><div class="dim-dot mvmt"></div><div><div class="dim-title">MVMT <span class="dim-acronym">${L.mvmt_dim.replace('MVMT — ','')}</span></div><div class="dim-subtitle">${L.mvmt_period}</div></div></div>
        <div style="font-size:0.84rem;color:var(--muted);line-height:1.6;background:rgba(139,111,245,0.04);border:1px solid rgba(139,111,245,0.12);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-style:italic;">${L.mvmt_intro}</div>
        ${mvmtCards}
      </div>
      <div class="dimension-section">
        <div class="dim-header"><div class="dim-dot strata"></div><div><div class="dim-title">STRATA <span class="dim-acronym">${L.strata_dim.replace('STRATA — ','')}</span></div><div class="dim-subtitle">${L.strata_period}</div></div></div>
        <div style="font-size:0.84rem;color:var(--muted);line-height:1.6;background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.12);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-style:italic;">${L.strata_intro}</div>
        ${strataCards}
      </div>
      <button class="peacs-submit-btn" id="peacs-submit-btn" disabled onclick="submitPeacs()">${L.submit_btn}</button>
    </div>
    <div class="assess-floater" id="peacs-floater">
      <div class="fl-label">Predictive Emergence</div>
      <div class="fl-pe" id="fl-pe">—</div>
      <div class="fl-zone" id="fl-zone">Answer questions to begin</div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--base)">BASE</span><span id="fb-base">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill b" id="bar-b"></div></div></div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--mvmt)">MVMT</span><span id="fb-mvmt">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill m" id="bar-m"></div></div></div>
      <div class="fl-bar"><div class="fl-bar-top"><span style="color:var(--strata)">STRATA</span><span id="fb-strata">—</span></div><div class="fl-bar-track"><div class="fl-bar-fill s" id="bar-s"></div></div></div>
      <div class="fl-prog">
        <div class="fl-prog-row"><span>Progress</span><span id="prog-n">0 / 22</span></div>
        <div class="fl-prog-track"><div class="fl-prog-fill" id="prog-f"></div></div>
      </div>
    </div>
  </div>`;
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
    ${partialMode ? `<div style="background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(212,168,67,0.85);">Collected: ${enabledDims.map(d=>d.toUpperCase()).join(' · ')} — dimension scores saved. PE composite requires all 3 dimensions.</div>` : ''}
    <div class="peacs-result-scores">
      ${enabledDims.includes('base')   ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--base)">${fmt(b,3)}</div><div class="peacs-score-lbl">BASE</div></div>` : ''}
      ${enabledDims.includes('mvmt')   ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--mvmt)">${fmt(m,3)}</div><div class="peacs-score-lbl">MVMT</div></div>` : ''}
      ${enabledDims.includes('strata') ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--strata)">${fmt(s,3)}</div><div class="peacs-score-lbl">STRATA</div></div>` : ''}
      ${pe !== null ? `<div class="peacs-score-chip"><div class="peacs-score-val" style="color:${zone.color}">${fmt(pe,4)}</div><div class="peacs-score-lbl">PE Score</div></div>` : ''}
    </div>
    <div style="font-family:var(--font-mono);font-size:0.80rem;padding:8px 12px;border-radius:7px;background:${zone.color}18;border:1px solid ${zone.color}44;color:${zone.color};margin-bottom:16px;">${zone.label}</div>
    ${pe !== null ? `<div id="pr-pe-triangle" style="margin:14px 0;"></div>` : ''}
    <div class="peacs-diag-box">
      <div class="peacs-diag-title">${diag.primary}</div>
      <div class="peacs-diag-type">${diag.type}</div>
      ${diag.actions.map(a=>`<div class="peacs-diag-action"><span style="color:var(--base);flex-shrink:0">→</span>${a}</div>`).join('')}
    </div>
    ${pe !== null ? `
    <div id="pr-ai-interpret-wrap" style="margin:0 0 14px;">
      <button id="pr-ai-interpret-btn" onclick="peacsInterpretResults(${pe !== null ? pe.toFixed(4) : 'null'},${b !== null ? b.toFixed(3) : 'null'},${m !== null ? m.toFixed(3) : 'null'},${s !== null ? s.toFixed(3) : 'null'},'${zone.label}')" style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.28);color:var(--mvmt);border-radius:10px;padding:11px 16px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:7px;" onmouseover="this.style.background='rgba(139,111,245,0.16)'" onmouseout="this.style.background='rgba(139,111,245,0.08)'">
        <span>✦</span><span>Interpret My Results</span>
      </button>
      <div id="pr-ai-interpret-response" style="display:none;margin-top:10px;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.28);border-radius:10px;padding:14px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mvmt);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
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
        model: 'claude-sonnet-4-20250514',
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
    '<button type="button" onclick="document.getElementById(\'p-med-row-' + id + '\').remove();pSyncMedCountFromRows();" title="Remove"'
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
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:8px;">Longitudinal Analysis</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.45rem;font-weight:300;color:var(--bright);margin-bottom:20px;">Patient Trend · Last 10 Visits</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <input id="trend-patient-id" value="${patId}" placeholder="Enter Patient ID" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.3);color:var(--bright);border-radius:7px;padding:9px 12px;outline:none;flex:1;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(212,168,67,0.65)'" onblur="this.style.borderColor='rgba(212,168,67,0.3)'"/>
      <button onclick="loadPeacsTrend(document.getElementById('trend-patient-id').value.trim())" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.12);border:1px solid rgba(212,168,67,0.35);color:var(--pe);border-radius:7px;padding:9px 16px;cursor:pointer;white-space:nowrap;transition:all 0.2s;" onmouseover="this.style.background='rgba(212,168,67,0.22)'" onmouseout="this.style.background='rgba(212,168,67,0.12)'">Load Trend →</button>
    </div>
    <div id="trend-chart-area" style="min-height:300px;display:flex;align-items:center;justify-content:center;">
      <div style="color:var(--dim);font-family:'IBM Plex Mono',monospace;font-size:0.84rem;text-align:center;">${patId ? 'Loading…' : 'Enter a patient ID above and click Load Trend.'}</div>
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
      chartArea.innerHTML = '<div style="color:var(--dim);font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;padding:40px 0;text-align:center;">No PEACS records found for <strong style="color:var(--bright);">' + patId + '</strong>.</div>';
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
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">Visit History · ${records.length} record${records.length!==1?'s':''}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="text-align:left;padding:7px 8px;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;font-weight:400;text-transform:uppercase;">Date</th>
            <th style="text-align:right;padding:7px 8px;color:var(--base);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">BASE</th>
            <th style="text-align:right;padding:7px 8px;color:var(--mvmt);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">MVMT</th>
            <th style="text-align:right;padding:7px 8px;color:var(--strata);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">STRATA</th>
            <th style="text-align:right;padding:7px 8px;color:var(--pe);font-family:'IBM Plex Mono',monospace;font-size:0.78rem;font-weight:400;text-transform:uppercase;">PE / Zone</th>
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
                  ${!isPartial && zone!=='—' ? '<span style="display:block;font-size:0.75rem;color:'+zc+';opacity:0.7;">'+zone+'</span>' : ''}
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
    if (!rec) return `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(245,158,11,0.4);color:rgba(245,158,11,0.9);background:rgba(245,158,11,0.06);">First visit</span>`;
    const daysAgo = Math.round(_peacsDimAge(rec));
    const daysLeft = Math.ceil(interval - _peacsDimAge(rec));
    if (daysLeft > 0) {
      return `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(46,201,138,0.35);color:rgba(46,201,138,0.9);background:rgba(46,201,138,0.06);">Last taken ${daysAgo}d ago · recommended again in ${daysLeft}d</span>`;
    }
    return `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:2px 8px;border:1px solid rgba(245,158,11,0.4);color:rgba(245,158,11,0.9);background:rgba(245,158,11,0.06);">Last taken ${daysAgo}d ago · recommended interval: ${interval}d</span>`;
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
    ? `<div style="background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:rgba(212,168,67,0.85);line-height:1.6;">Research mode — this workspace collects: <strong>${enabledDims.map(d=>d.toUpperCase()).join(' · ')}</strong>. PE composite score requires all 3 dimensions and will not be calculated.</div>`
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
          mapN    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(212,168,67,0.85);background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.22);border-radius:12px;padding:3px 10px;">${mapN} from MAP</span>` : '',
          intakeN ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(78,156,245,0.85);background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);border-radius:12px;padding:3px 10px;">${intakeN} from intake</span>` : '',
          geoN    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(46,201,138,0.85);background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.22);border-radius:12px;padding:3px 10px;">${geoN} location-scored</span>` : '',
        ].filter(Boolean).join('');
        return `<div id="peacs-inference-banner" style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.16);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(46,201,138,0.6);margin-bottom:6px;">SDoH Intelligence · ${total} of 22 pre-filled</div>
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
    country:        normalizeCountry(pCountry   || _sd?.country    || userLocation.country),
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
      if (pe !== null && enabledDims.length === 3) {
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
      }
    } else {
      // No safeId — write to peacs_assessments (full or partial)
      if (pe !== null && enabledDims.length === 3) {
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
  } else {
    content.innerHTML = `<div class="empty-state" style="padding:60px 24px;text-align:center;"><div style="font-family:var(--font-display);font-size:1.4rem;font-weight:300;color:var(--bright);margin-bottom:8px;">${tab.charAt(0).toUpperCase()+tab.slice(1)}</div><div style="font-size:0.88rem;color:var(--dim);">Coming soon.</div></div>`;
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
          <div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--bright);font-weight:500;">${patLabel||ts}</div>
          <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);">${patLabel?ts+(locStr?' · '+locStr:''):locStr}</div>
        </div>
        <div class="peacs-result-scores">
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--base)">${(a.base||0).toFixed(3)}</div><div class="peacs-score-lbl">BASE</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--mvmt)">${(a.mvmt||0).toFixed(3)}</div><div class="peacs-score-lbl">MVMT</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:var(--strata)">${(a.strata||0).toFixed(3)}</div><div class="peacs-score-lbl">STRATA</div></div>
          <div class="peacs-score-chip"><div class="peacs-score-val" style="color:${z.color}">${(a.pe||0).toFixed(4)}</div><div class="peacs-score-lbl">PE</div></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.88rem;padding:6px 10px;border-radius:6px;background:${z.color}18;border:1px solid ${z.color}44;color:${z.color};margin-bottom:12px;">${z.label}</div>
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
        ${total>1?`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#6b8099;padding:2px 7px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;">${total} entries · avg PE ${avgPE}</div>`:''}
      </div>
    </div>
    <div style="padding:10px 14px;">
      ${patId?`<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b8099;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">${patId}</div>`:''}
      <div style="font-size:12px;color:${col};font-weight:700;margin-bottom:6px;">PE ${pe} · ${z}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(78,156,245,0.3);color:#4e9cf5;">BASE ${b}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(139,111,245,0.3);color:#8b6ff5;">MVMT ${m}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(46,201,138,0.3);color:#2ec98a;">STRATA ${s}</span>
      </div>
      ${a.institution_code?`<div style="font-size:10px;color:#6b8099;font-family:'IBM Plex Mono',monospace;margin-bottom:4px;">${a.institution_code}</div>`:''}
      ${dateStr?`<div style="font-size:10px;color:#4a5f78;font-family:'IBM Plex Mono',monospace;">${dateStr}</div>`:''}
    </div>
    ${total>1?`<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;">
      <button onclick="peacsPopupNav(this,${-1})" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;${idx===0?'opacity:0.3;pointer-events:none;':''}">‹</button>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5f78;">${idx+1} / ${total}</span>
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
  const avgPE   = records.reduce((s,r)=>s+(r.pe||0),0)/records.length;
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
    mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
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

