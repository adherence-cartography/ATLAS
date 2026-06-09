// sa-lab.js — Instrument Lab: item explorer, tier counts, score simulator, norm tables, box plot, equivalence
// ══════════════════════════════════════════════════════════════════════════════
// INSTRUMENT LAB TAB — Item Explorer · Score Simulator · Norm Tables · Equivalence
// ══════════════════════════════════════════════════════════════════════════════

let _saLabTab = 'items';
let _saLabInst = 'mmas';

// MAP PE — always recompute from items with Context-Guard
const _labMapPE = r => Math.pow(Math.max(0,
  ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3 *
  ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3 *
  (0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)
), 1/3);
// Normalised score by instrument
const _labPE = (r, inst) => inst === 'mmas' ? (r.score||0)/8 : inst === 'map' ? _labMapPE(r) : (r.pe!=null?+r.pe:0);

const _SA_LAB_SUBS = [
  { id: 'items',       icon: '◈', label: 'Item Explorer'    },
  { id: 'simulate',    icon: '◍', label: 'Score Simulator'  },
  { id: 'norms',       icon: '◩', label: 'Norm Tables'      },
  { id: 'equivalence', icon: '◬', label: 'Equivalence'      },
];

// ── Instrument definitions ────────────────────────────────────────────────────

const _LAB_INSTRUMENTS = {
  mmas: {
    label: 'MMAS-8',
    full:  'Morisky Medication Adherence Scale – 8 Item',
    scoreRange: [0, 8],
    scoreLabel: 'Adherence Score',
    tiers: [
      { min:8, max:8,   label:'High Adherence',   col:'#2ec98a' },
      { min:6, max:7.9, label:'Medium Adherence', col:'#d4a843' },
      { min:0, max:5.9, label:'Low Adherence',    col:'#ef4444' },
    ],
    items: [
      { id:'q1',  label:'Do you sometimes forget to take your medicine?',                           subscale:'General', reverse:true  },
      { id:'q2',  label:'People sometimes miss taking their medicine for reasons other than forgetting. Over the past two weeks, were there any days when you did not take your medicine?', subscale:'General', reverse:true  },
      { id:'q3',  label:'Have you ever cut back or stopped taking your medicine without telling your doctor because you felt worse when you took it?', subscale:'General', reverse:true  },
      { id:'q4',  label:'When you travel or leave home, do you sometimes forget to bring along your medicine?', subscale:'General', reverse:true  },
      { id:'q5',  label:'Did you take your medicine yesterday?',                                    subscale:'General', reverse:false },
      { id:'q6',  label:'When you feel like your symptoms are under control, do you sometimes stop taking your medicine?', subscale:'General', reverse:true  },
      { id:'q7',  label:'Taking medicine every day is a real inconvenience for some people. Do you ever feel hassled about sticking to your treatment plan?', subscale:'General', reverse:true  },
      { id:'q8',  label:'How often do you have difficulty remembering to take all your medicine?',  subscale:'General', reverse:true, opts:[['Never/Rarely',1],['Once in a while',0.75],['Sometimes',0.5],['Usually',0.25],['All the time',0]] },
    ],
    scoreCalc: (resp) => resp.reduce((s,v,i) => {
      const item = _LAB_INSTRUMENTS.mmas.items[i];
      if (item.opts) return s + v;                              // Q8 Likert: value IS the adherence score
      return s + (item.reverse ? (v===0?1:0) : (v===1?1:0));  // binary: apply question direction
    }, 0),
    subscaleCalc: () => null, // single scale
  },
  map: {
    label: 'MAP',
    full:  'Medication Adherence Profile – 8 Item',
    scoreRange: [0, 1],
    scoreLabel: 'PE Score (0–1)',
    tiers: [
      { min:0.85, max:1.0,  label:'Optimal PE',    col:'#2ec98a' },
      { min:0.70, max:0.849,label:'Good PE',        col:'#4e9cf5' },
      { min:0.55, max:0.699,label:'Moderate PE',    col:'#d4a843' },
      { min:0,    max:0.549,label:'Poor PE',         col:'#ef4444' },
    ],
    items: [
      { id:'map_q1', label:'Are there times when you forget to take your medications?',                                                                                                      subscale:'Execution',    reverse:true  },
      { id:'map_q2', label:'In the past two weeks, have there been times when you chose to skip a dose — for example, because of side effects, cost, or feeling better?',                    subscale:'Architecture', reverse:true  },
      { id:'map_q3', label:'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?', subscale:'Architecture', reverse:true  },
      { id:'map_q4', label:'When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?', subscale:'Context',      reverse:true  },
      { id:'map_q5', label:'Were you able to take your last dose as directed?',                                                                                                              subscale:'Execution',    reverse:false },
      { id:'map_q6', label:'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?',                               subscale:'Architecture', reverse:true  },
      { id:'map_q7', label:'Does keeping up with your medication routine feel like a big challenge in your everyday life?',                                                                  subscale:'Context',      reverse:true  },
      { id:'map_q8', label:'In a typical week, how often do you have trouble taking all your medications as prescribed?',                                                                    subscale:'Execution',    reverse:true, opts:[['Never',1],['Rarely',0.75],['Sometimes',0.5],['Often',0.25],['All of the time',0]] },
    ],
    scoreCalc: (resp) => {
      // Convert raw YES(1)/NO(0) answers to adherence scores using question direction
      const items  = _LAB_INSTRUMENTS.map.items;
      const scored = resp.map((v, i) => {
        const item = items[i];
        if (item.opts) return v; // Q8 Likert: value is already the adherence score
        return item.reverse ? (v === 0 ? 1 : 0) : (v === 1 ? 1 : 0);
      });
      const arch = [scored[1],scored[2],scored[5]].reduce((s,v)=>s+v,0)/3;
      const exec = [scored[0],scored[4],scored[7]].reduce((s,v)=>s+v,0)/3;
      const ctx  = 0.5 + 0.5*(scored[3]+scored[6])/2;
      const pe   = Math.pow(Math.max(0, arch * exec * ctx), 1/3);
      return { arch, exec, ctx, pe };
    },
    subscaleCalc: (resp) => {
      const items  = _LAB_INSTRUMENTS.map.items;
      const scored = resp.map((v, i) => {
        const item = items[i];
        if (item.opts) return v;
        return item.reverse ? (v === 0 ? 1 : 0) : (v === 1 ? 1 : 0);
      });
      const arch = [scored[1],scored[2],scored[5]].reduce((s,v)=>s+v,0)/3;
      const exec = [scored[0],scored[4],scored[7]].reduce((s,v)=>s+v,0)/3;
      const ctx  = 0.5 + 0.5*(scored[3]+scored[6])/2;
      const pe   = Math.pow(Math.max(0, arch * exec * ctx), 1/3);
      return { arch, exec, ctx, pe };
    },
  },
  peacs: {
    label: 'PEACS',
    full:  'Patient Engagement and Adherence Composite Scale',
    scoreRange: [0, 1],
    scoreLabel: 'PE Score (0–1)',
    tiers: [
      { min:0.85, max:1.0,  label:'Optimal PE',    col:'#2ec98a' },
      { min:0.70, max:0.849,label:'Good PE',        col:'#4e9cf5' },
      { min:0.55, max:0.699,label:'Moderate PE',    col:'#d4a843' },
      { min:0,    max:0.549,label:'Poor PE',         col:'#ef4444' },
    ],
    items: [
      // BASE — Behavioral Architecture (7 items, Yes/Sometimes/No → 1/0.5/0)
      { id:'bq1', label:'Do you reliably remember to take your medication as scheduled, even on stressful days?',                          subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq2', label:'Do you maintain a consistent routine for taking your medication when your daily schedule changes?',                subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq3', label:'If you begin to feel better, do you continue your medication exactly as prescribed?',                             subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq4', label:'Can you adapt your daily routine to make sure you take your medication when your schedule shifts?',                subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq5', label:'If you experience side effects, can you continue treatment while managing them?',                                 subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq6', label:'Does taking medication fit naturally into your daily life?',                                                       subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      { id:'bq7', label:"Do you routinely keep a backup supply so you don't run out of medication?",                                       subscale:'Base',     toNum:(v=>({Yes:1,Sometimes:0.5,No:0}[v]??null)), opts:[['Yes',1],['Sometimes',0.5],['No',0]] },
      // MVMT — Movement / Execution Consistency (7 items, No/Yes-once/Yes-more → 1/0.5/0)
      { id:'mq1', label:'In the past 7 days, did you have trouble taking your medication at the same time each day?',                      subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq2', label:'In the past 7 days, did you miss any doses?',                                                                    subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq3', label:'In the past 7 days, did you skip or stop taking medication because you felt better?',                             subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq4', label:'In the past 7 days, did you stop or skip medication because of side effects?',                                    subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq5', label:'In the past 7 days, did travel, being away, or your environment cause you to miss medication?',                   subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq6', label:'In the past 7 days, did you have difficulty adjusting your routine to take medication when your schedule changed?',subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      { id:'mq7', label:'In the past 7 days, did taking medication feel like a hassle or not fit naturally into daily life?',               subscale:'Movement', toNum:(v=>({No:1,'Yes, once':0.5,'Yes, more than once':0}[v]??null)), opts:[['No',1],['Yes, once',0.5],['Yes, more than once',0]] },
      // STRATA — Support Network (8 items, 4-option ordinal → 1/0.67/0.33/0)
      { id:'sq1', label:'Who helps you remember or manage your medications?',                                                              subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Spouse or partner',1],['Adult child or other family member',0.67],['Friend, neighbor, or caregiver',0.33],['I manage independently',0]] },
      { id:'sq2', label:'How often do you have meaningful contact with family or friends?',                                                subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Daily or several times per week',1],['Once per week',0.67],['A few times per month',0.33],['Rarely or almost never',0]] },
      { id:'sq3', label:'What is your current living arrangement?',                                                                        subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Live with spouse or family members',1],['Live alone with family or support nearby',0.67],['Assisted or supported living',0.33],['Live alone with family far away or transitional housing',0]] },
      { id:'sq4', label:'If you had a medical emergency, who would know and be able to help?',                                             subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Multiple people who would respond quickly',1],['At least one person who would respond',0.67],['Someone who might eventually notice',0.33],['Probably no one or definitely no one',0]] },
      { id:'sq5', label:'How do you usually get to medical appointments or the pharmacy?',                                                 subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['I drive myself or have reliable flexible transport',1],['Family or friends or public transport available',0.67],['Medical transport or transport obtained with difficulty',0.33],['Cannot reliably get to appointments or pharmacy',0]] },
      { id:'sq6', label:'How reliably can you get your medications and attend follow-up appointments when needed?',                         subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Medications and appointments reliably available',1],['Usually available with occasional delays',0.67],['Frequently delayed or difficult to access',0.33],['Unreliable with significant gaps in access',0]] },
      { id:'sq7', label:'How well do you understand the instructions for taking your medications?',                                         subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Completely understand and can explain to others',1],['Understand most instructions',0.67],['Understand some but uncertain about parts',0.33],['Often confused or uncertain about how to take medication',0]] },
      { id:'sq8', label:'How strongly do you believe your medication is necessary and will help you?',                                      subscale:'Strata',   toNum:(v=>{ const n=parseFloat(v); return isNaN(n)?null:n; }), opts:[['Strongly believe it is necessary and effective',1],['Generally believe it helps',0.67],['Uncertain whether it is helping',0.33],['Often doubt its necessity or effectiveness',0]] },
    ],
    scoreCalc: (resp) => {
      // resp is array of slider values 0–1, items ordered bq1-7, mq1-7, sq1-8
      const base   = resp.slice(0, 7).reduce((s,v)=>s+v,0)/7;
      const mvmt   = resp.slice(7,14).reduce((s,v)=>s+v,0)/7;
      const strata = resp.slice(14,22).reduce((s,v)=>s+v,0)/8;
      const pe = base > 0 && mvmt > 0 && strata > 0 ? Math.pow(base*mvmt*strata,1/3) : 0;
      return { base, mvmt, strata, pe };
    },
    subscaleCalc: (resp) => {
      const base   = resp.slice(0, 7).reduce((s,v)=>s+v,0)/7;
      const mvmt   = resp.slice(7,14).reduce((s,v)=>s+v,0)/7;
      const strata = resp.slice(14,22).reduce((s,v)=>s+v,0)/8;
      const pe = base > 0 && mvmt > 0 && strata > 0 ? Math.pow(base*mvmt*strata,1/3) : 0;
      return { base, mvmt, strata, pe };
    },
  },
};

function _saRenderLab(container) {
  container.style.padding = '24px 28px';
  container.innerHTML = `
  <div style="margin-bottom:20px;">
    <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · Instrument Lab</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_C.text};">Instrument Lab</div>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:22px;border-bottom:1px solid ${_C.border};padding-bottom:16px;flex-wrap:wrap;">
    ${_SA_LAB_SUBS.map(s => `
      <button id="sa-lab-btn-${s.id}" onclick="saLabTab('${s.id}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:7px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;
               background:${s.id==='items'?_C.amberFaint:'transparent'};
               border:1px solid ${s.id==='items'?'rgba(212,168,67,0.35)':_C.border};
               color:${s.id==='items'?_C.amber:_C.muted};">
        ${s.icon} ${s.label}
      </button>`).join('')}

    <!-- Instrument selector -->
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
      <span style="font-size:0.74rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">Instrument:</span>
      ${[['mmas','MMAS-8',_C.blue],['map','MAP',_C.green],['peacs','PEACS',_C.purple]].map(([id,lbl,col])=>`
      <button id="sa-lab-inst-${id}" onclick="saLabInst('${id}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;
               padding:5px 11px;border-radius:5px;cursor:pointer;transition:all 0.15s;
               background:${id==='mmas'?'rgba(78,156,245,0.1)':'transparent'};
               border:1px solid ${id==='mmas'?col:_C.border};color:${id==='mmas'?col:_C.dim};">${lbl}</button>`).join('')}
    </div>
  </div>

  <div id="sa-lab-body"></div>`;

  saLabTab('items');
}

function saLabTab(tab) {
  _saLabTab = tab;
  _SA_LAB_SUBS.forEach(s => {
    const btn = document.getElementById('sa-lab-btn-' + s.id);
    if (!btn) return;
    const active = s.id === tab;
    btn.style.background  = active ? _C.amberFaint : 'transparent';
    btn.style.borderColor = active ? 'rgba(212,168,67,0.35)' : _C.border;
    btn.style.color       = active ? _C.amber : _C.muted;
  });
  const body = document.getElementById('sa-lab-body');
  if (!body) return;
  switch (tab) {
    case 'items':       _saLabRenderItems(body);       break;
    case 'simulate':    _saLabRenderSimulate(body);    break;
    case 'norms':       _saLabRenderNorms(body);       break;
    case 'equivalence': _saLabRenderEquivalence(body); break;
  }
}

function saLabInst(inst) {
  _saLabInst = inst;
  const cols = { mmas:_C.blue, map:_C.green, peacs:_C.purple };
  ['mmas','map','peacs'].forEach(id => {
    const btn = document.getElementById('sa-lab-inst-' + id);
    if (!btn) return;
    const active = id === inst;
    btn.style.background  = active ? `rgba(${id==='mmas'?'78,156,245':id==='map'?'46,201,138':'139,111,245'},0.1)` : 'transparent';
    btn.style.borderColor = active ? cols[id] : _C.border;
    btn.style.color       = active ? cols[id] : _C.dim;
  });
  // Re-render current tab with new instrument
  const body = document.getElementById('sa-lab-body');
  if (!body) return;
  switch (_saLabTab) {
    case 'items':       _saLabRenderItems(body);       break;
    case 'simulate':    _saLabRenderSimulate(body);    break;
    case 'norms':       _saLabRenderNorms(body);       break;
    case 'equivalence': _saLabRenderEquivalence(body); break;
  }
}

// ── ITEM EXPLORER ─────────────────────────────────────────────────────────────

function _saLabRenderItems(body) {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const records = _saLabGetRecords(_saLabInst);
  const instCol = { mmas:_C.blue, map:_C.green, peacs:_C.purple }[_saLabInst];
  const subColors = { Architecture:_C.amber, Execution:_C.cyan, Context:_C.green, General:_C.blue, Base:_C.blue, Movement:_C.green, Strata:_C.purple };

  // Compute per-item stats from records
  const itemStats = inst.items.map((item, idx) => {
    if (!records.length) return { p:null, rIT:null, disc:null };
    const key = _saLabInst === 'mmas' ? item.id : _saLabInst === 'map' ? item.id : item.id;
    const vals = records.map(r => {
      const v = r[key];
      if (v == null) return null;
      const n = item.toNum ? item.toNum(v) : +v;
      return (n == null || isNaN(n)) ? null : n;
    }).filter(v => v !== null);
    if (!vals.length) return { p:null, rIT:null, disc:null };
    const p = vals.reduce((s,v)=>s+v,0)/vals.length;
    // Corrected item-total r (exclude this item from total)
    const totals = records.map(r => {
      return inst.items.reduce((s,it,i2) => {
        if (i2 === idx) return s;
        const v2 = r[it.id];
        if (v2 == null) return s;
        const n = it.toNum ? it.toNum(v2) : +v2;
        return s + (n == null || isNaN(n) ? 0 : n);
      }, 0);
    });
    const tMean = totals.reduce((s,v)=>s+v,0)/totals.length;
    const tSD   = Math.sqrt(totals.reduce((s,v)=>s+Math.pow(v-tMean,2),0)/totals.length)||0.001;
    const pMean = p, pSD = Math.sqrt(p*(1-p))||0.001;
    const cov   = vals.reduce((s,v,i)=>s+(v-pMean)*(totals[i]-tMean),0)/vals.length;
    const rIT   = cov/(pSD*tSD);
    // Discrimination: upper 27% vs lower 27%
    const sorted = [...vals.map((v,i)=>({v,t:totals[i]}))].sort((a,b)=>a.t-b.t);
    const cut = Math.floor(sorted.length*0.27);
    const lower = sorted.slice(0,cut).map(x=>x.v);
    const upper = sorted.slice(-cut).map(x=>x.v);
    const disc = cut ? (upper.reduce((s,v)=>s+v,0)/cut) - (lower.reduce((s,v)=>s+v,0)/cut) : null;
    return { p, rIT: isNaN(rIT)?null:rIT, disc };
  });

  const subscales = [...new Set(inst.items.map(it=>it.subscale))];
  const subCounts = Object.fromEntries(subscales.map(s=>[s, inst.items.filter(it=>it.subscale===s).length]));

  body.innerHTML = `
  <!-- Instrument header -->
  <div class="sa-panel" style="margin-bottom:18px;display:flex;gap:20px;align-items:center;padding:16px 20px;">
    <div>
      <div style="font-size:0.70rem;letter-spacing:0.2em;text-transform:uppercase;color:${instCol};margin-bottom:4px;">${inst.label}</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;color:${_C.text};">${inst.full}</div>
    </div>
    <div style="display:flex;gap:16px;margin-left:auto;">
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:${instCol};">${inst.items.length}</div>
        <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Items</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:${instCol};">${records.length.toLocaleString()}</div>
        <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Records</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:${instCol};">${subscales.length}</div>
        <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Subscales</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:${instCol};">${inst.scoreRange[0]}–${inst.scoreRange[1]}</div>
        <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Score Range</div>
      </div>
    </div>
  </div>

  <!-- Subscale legend -->
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
    ${subscales.map(s=>`
    <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;background:${_C.navy};border:1px solid ${_C.border};border-radius:5px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${subColors[s]||_C.muted};display:inline-block;"></span>
      <span style="font-size:0.78rem;color:${subColors[s]||_C.muted};">${s}</span>
      <span style="font-size:0.72rem;color:${_C.dim};">(${subCounts[s]} items)</span>
    </div>`).join('')}
    ${!records.length?`<div style="padding:5px 12px;font-size:0.78rem;color:${_C.dim};font-style:italic;">No records yet — item statistics will appear when assessments are submitted.</div>`:''}
  </div>

  <!-- Item table -->
  <div class="sa-panel" style="padding:0;overflow:hidden;">
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:${_C.bg2};">
          ${['#','Subscale','Item Text','Difficulty (p)','Item-Total r','Discrimination','Tier Score'].map((h,i)=>
            `<th style="padding:10px ${i===2?'20px':'14px'};text-align:left;font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};border-bottom:1px solid ${_C.border};white-space:nowrap;">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>
          ${inst.items.map((item, i) => {
            const st = itemStats[i];
            const subCol = subColors[item.subscale] || _C.muted;
            const pBar = st.p !== null ? `
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:50px;height:5px;background:${_C.navy};border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${(st.p*100).toFixed(0)}%;background:${subCol};border-radius:3px;"></div>
                </div>
                <span style="font-size:0.88rem;font-weight:700;color:${subCol};">${st.p.toFixed(3)}</span>
              </div>` : `<span style="color:${_C.dim};">—</span>`;
            const ritCol = st.rIT !== null ? (st.rIT>=0.3?_C.green:st.rIT>=0.2?_C.amber:'#f97316') : _C.dim;
            const discCol = st.disc !== null ? (st.disc>=0.3?_C.green:st.disc>=0.2?_C.amber:'#f97316') : _C.dim;
            const tierScore = inst.tiers[inst.tiers.length-1]; // simplified
            return `<tr style="border-bottom:1px solid ${_C.border};transition:background 0.1s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
              <td style="padding:11px 14px;font-size:0.78rem;color:${_C.dim};font-weight:700;">${item.id.toUpperCase()}</td>
              <td style="padding:11px 14px;">
                <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 6px;border:1px solid ${subCol};border-radius:3px;color:${subCol};white-space:nowrap;">${item.subscale}</span>
              </td>
              <td style="padding:11px 20px;font-size:0.88rem;color:${_C.muted};max-width:340px;line-height:1.5;">${_saEsc(item.label)}</td>
              <td style="padding:11px 14px;">${pBar}</td>
              <td style="padding:11px 14px;font-size:0.90rem;font-weight:700;color:${ritCol};">${st.rIT!==null?st.rIT.toFixed(3):'—'}</td>
              <td style="padding:11px 14px;font-size:0.90rem;font-weight:700;color:${discCol};">${st.disc!==null?st.disc.toFixed(3):'—'}</td>
              <td style="padding:11px 14px;font-size:0.82rem;color:${_C.dim};">${_saLabInst==='mmas'?(item.reverse?'Reverse':'Normal'):'Positive'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Adherence tiers -->
  <div class="sa-panel" style="margin-top:18px;">
    <div class="sa-section-eyebrow">Adherence Tier Classification</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
      ${inst.tiers.map(t=>`
      <div style="flex:1;min-width:160px;padding:12px 16px;background:${_C.navy};border-left:3px solid ${t.col};border-radius:4px;">
        <div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:${t.col};margin-bottom:4px;">${t.label}</div>
        <div style="font-size:1.1rem;font-weight:700;color:${t.col};">${t.min === t.max ? t.min : t.min + ' – ' + t.max}</div>
        ${records.length?`<div style="font-size:0.78rem;color:${_C.dim};margin-top:4px;">${_saLabTierCount(records, t, _saLabInst)} records (${_saLabTierPct(records, t, _saLabInst)})</div>`:''}
      </div>`).join('')}
    </div>
  </div>`;
}

function _saLabTierCount(records, tier, inst) {
  return records.filter(r => {
    const score = inst === 'mmas' ? (r.score||0) : (r.map_q1!==undefined ? _labMapPE(r) : (r.pe!=null?+r.pe:0));
    return score >= tier.min && score <= tier.max;
  }).length.toLocaleString();
}

function _saLabTierPct(records, tier, inst) {
  const n = records.filter(r => {
    const score = inst === 'mmas' ? (r.score||0) : (r.map_q1!==undefined ? _labMapPE(r) : (r.pe!=null?+r.pe:0));
    return score >= tier.min && score <= tier.max;
  }).length;
  return records.length ? (n/records.length*100).toFixed(1)+'%' : '0%';
}

// ── SCORE SIMULATOR ───────────────────────────────────────────────────────────

function _saLabRenderSimulate(body) {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const instCol = { mmas:_C.blue, map:_C.green, peacs:_C.purple }[_saLabInst];
  const subColors = { Architecture:_C.amber, Execution:_C.cyan, Context:_C.green, General:_C.blue, Base:_C.blue, Movement:_C.green, Strata:_C.purple };

  const isBinary = _saLabInst === 'mmas' || _saLabInst === 'map';
  const isPeacs  = _saLabInst === 'peacs';

  // PEACS: subscale section headers
  const subLabels = { Base:'BASE — Behavioral Architecture', Movement:'MVMT — Execution Consistency', Strata:'STRATA — Support Network' };
  let lastSub = null;

  body.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start;">

    <!-- Item response inputs -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">${inst.label} — Response Entry</div>
      <div style="font-size:0.84rem;color:${_C.dim};margin-top:4px;margin-bottom:14px;">
        ${isBinary ? 'Answer each question as the patient would. Yes = 1, No = 0 for positively-phrased items; reversed for negatively-phrased items. Q8 uses a 5-point frequency scale.'
                   : 'Select the actual answer that applies to each question.'}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;" id="sa-sim-items">
        ${inst.items.map((item, i) => {
          const subCol = subColors[item.subscale] || _C.muted;
          let header = '';
          if (isPeacs && item.subscale !== lastSub) {
            lastSub = item.subscale;
            header = `<div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${subCol};
              padding:${i===0?'0':'14px'} 0 6px;border-top:${i===0?'none':'1px solid '+_C.border};margin-top:${i===0?'0':'4px'};">
              ${subLabels[item.subscale]||item.subscale}</div>`;
          }
          if (isBinary && item.opts) {
            // Likert option buttons (used for Q8 on both MMAS and MAP)
            return header + `<div style="padding:10px 14px;background:${_C.navy};border-radius:6px;border:1px solid ${_C.border};" id="sa-sim-row-${i}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="font-size:0.72rem;font-weight:700;color:${_C.dim};">${item.id.toUpperCase()}</span>
                <span style="font-size:0.70rem;padding:1px 5px;border:1px solid ${subCol};border-radius:3px;color:${subCol};letter-spacing:0.1em;text-transform:uppercase;">${item.subscale}</span>
                <span id="sa-sim-rval-${i}" style="margin-left:auto;font-size:0.78rem;font-weight:700;color:${_C.dim};">—</span>
              </div>
              <div style="font-size:0.86rem;color:${_C.muted};line-height:1.5;margin-bottom:8px;">${_saEsc(item.label)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${item.opts.map(([label, val], oi) => `<button id="sa-sim-opt-${i}-${oi}" onclick="_saLabSimPeacsSelect(${i},${oi})"
                  data-val="${val}" data-selected="0"
                  style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.04em;padding:5px 10px;
                         border-radius:4px;cursor:pointer;transition:all 0.15s;background:transparent;
                         border:1px solid ${_C.border};color:${_C.dim};">${_saEsc(label)}</button>`).join('')}
              </div>
            </div>`;
          } else if (isBinary) {
            return header + `<div style="padding:10px 14px;background:${_C.navy};border-radius:6px;border:1px solid ${_C.border};" id="sa-sim-row-${i}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="font-size:0.72rem;font-weight:700;color:${_C.dim};">${item.id.toUpperCase()}</span>
                <span style="font-size:0.70rem;padding:1px 5px;border:1px solid ${subCol};border-radius:3px;color:${subCol};letter-spacing:0.1em;text-transform:uppercase;">${item.subscale}</span>
                <span id="sa-sim-val-${i}" style="margin-left:auto;font-size:0.78rem;font-weight:700;color:${_C.dim};">—</span>
              </div>
              <div style="font-size:0.86rem;color:${_C.muted};line-height:1.5;margin-bottom:8px;">${_saEsc(item.label)}</div>
              <div style="display:flex;gap:8px;">
                <button id="sa-sim-yn-${i}-1" onclick="_saLabSimYesNo(${i},1)" data-val="1" data-selected="0"
                  style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:5px 18px;border-radius:4px;cursor:pointer;transition:all 0.15s;background:transparent;border:1px solid ${_C.border};color:${_C.dim};">Yes</button>
                <button id="sa-sim-yn-${i}-0" onclick="_saLabSimYesNo(${i},0)" data-val="0" data-selected="0"
                  style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;padding:5px 18px;border-radius:4px;cursor:pointer;transition:all 0.15s;background:transparent;border:1px solid ${_C.border};color:${_C.dim};">No</button>
              </div>
            </div>`;
          } else if (isPeacs && item.opts) {
            return header + `<div style="padding:10px 14px;background:${_C.navy};border-radius:6px;border:1px solid ${_C.border};" id="sa-sim-row-${i}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="font-size:0.72rem;font-weight:700;color:${_C.dim};">${item.id.toUpperCase()}</span>
                <span style="font-size:0.70rem;padding:1px 5px;border:1px solid ${subCol};border-radius:3px;color:${subCol};letter-spacing:0.1em;text-transform:uppercase;">${item.subscale}</span>
                <span id="sa-sim-rval-${i}" style="margin-left:auto;font-size:0.78rem;font-weight:700;color:${_C.dim};">—</span>
              </div>
              <div style="font-size:0.86rem;color:${_C.muted};line-height:1.5;margin-bottom:8px;">${_saEsc(item.label)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${item.opts.map(([label, val], oi) => `<button id="sa-sim-opt-${i}-${oi}" onclick="_saLabSimPeacsSelect(${i},${oi})"
                  data-val="${val}" data-selected="0"
                  style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.04em;padding:5px 10px;
                         border-radius:4px;cursor:pointer;transition:all 0.15s;background:transparent;
                         border:1px solid ${_C.border};color:${_C.dim};">${_saEsc(label)}</button>`).join('')}
              </div>
            </div>`;
          } else {
            return header + `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${_C.navy};border-radius:6px;border:1px solid ${_C.border};">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="font-size:0.72rem;font-weight:700;color:${_C.dim};">${item.id.toUpperCase()}</span>
                  <span style="font-size:0.70rem;padding:1px 5px;border:1px solid ${subCol};border-radius:3px;color:${subCol};letter-spacing:0.1em;text-transform:uppercase;">${item.subscale}</span>
                </div>
                <div style="font-size:0.88rem;color:${_C.muted};">${_saEsc(item.label)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <input type="range" id="sa-sim-range-${i}" min="0" max="1" step="0.01" value="0.75"
                  oninput="document.getElementById('sa-sim-rval-${i}').textContent=parseFloat(this.value).toFixed(2);_saLabSimUpdate()"
                  style="width:100px;accent-color:${subCol};" />
                <span id="sa-sim-rval-${i}" style="font-size:0.90rem;font-weight:700;color:${subCol};width:36px;text-align:right;">0.75</span>
              </div>
            </div>`;
          }
        }).join('')}
      </div>

      <div style="display:flex;gap:10px;margin-top:16px;">
        <button onclick="_saLabSimSetAll(1)"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:7px 14px;border-radius:5px;cursor:pointer;background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.3);color:${_C.amber};">
          All Adherent
        </button>
        <button onclick="_saLabSimSetAll(0)"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:7px 14px;border-radius:5px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.dim};">
          All Non-Adherent
        </button>
        <button onclick="_saLabSimRandom()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:7px 14px;border-radius:5px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.dim};">
          Randomise
        </button>
      </div>
    </div>

    <!-- Score output -->
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="sa-panel" id="sa-sim-result">
        <div class="sa-section-eyebrow">Score Output</div>
        <div style="text-align:center;padding:20px 0 16px;">
          <div id="sa-sim-score" style="font-size:3rem;font-weight:700;color:${instCol};line-height:1;">0</div>
          <div id="sa-sim-range-label" style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-top:6px;">${inst.scoreLabel}</div>
        </div>
        <div id="sa-sim-tier-badge" style="text-align:center;margin-bottom:14px;"></div>
        <div id="sa-sim-gauge-wrap" style="height:6px;background:${_C.navy};border-radius:3px;overflow:hidden;margin-bottom:14px;">
          <div id="sa-sim-gauge" style="height:100%;width:0%;border-radius:3px;background:${_C.red};transition:all 0.4s;"></div>
        </div>
        <div id="sa-sim-subscales" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Population Percentile</div>
        <div id="sa-sim-percentile" style="margin-top:8px;font-size:0.90rem;color:${_C.muted};line-height:1.6;"></div>
      </div>
      <div class="sa-panel">
        <div class="sa-section-eyebrow">Interpretation</div>
        <div id="sa-sim-interp" style="margin-top:8px;font-size:0.88rem;color:${_C.muted};line-height:1.7;"></div>
      </div>
    </div>
  </div>`;

  _saLabSimUpdate();
}

function _saLabSimGetResponses() {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const isBinary = _saLabInst === 'mmas' || _saLabInst === 'map';
  const isPeacs  = _saLabInst === 'peacs';
  return inst.items.map((item, i) => {
    if (isBinary && item.opts) {
      const selected = document.querySelector('#sa-sim-row-' + i + ' button[data-selected="1"]');
      return selected ? +selected.dataset.val : item.opts[0][1];
    } else if (isBinary) {
      // YES/NO buttons — read which is selected; return raw answer (1=Yes, 0=No)
      const yBtn = document.getElementById('sa-sim-yn-' + i + '-1');
      const nBtn = document.getElementById('sa-sim-yn-' + i + '-0');
      if (yBtn && yBtn.dataset.selected === '1') return 1;
      if (nBtn && nBtn.dataset.selected === '1') return 0;
      return -1; // unanswered — scores 0 after reverse logic
    } else if (isPeacs && item.opts) {
      const selected = document.querySelector('#sa-sim-row-' + i + ' button[data-selected="1"]');
      return selected ? +selected.dataset.val : item.opts[0][1];
    } else {
      const r = document.getElementById('sa-sim-range-' + i);
      return r ? +r.value : 0;
    }
  });
}

function _saLabSimPeacsSelect(itemIdx, optIdx) {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const item = inst.items[itemIdx];
  if (!item || !item.opts) return;
  const subCol = { Base:_C.blue, Movement:_C.green, Strata:_C.purple }[item.subscale] || _C.amber;
  item.opts.forEach((_, oi) => {
    const btn = document.getElementById('sa-sim-opt-' + itemIdx + '-' + oi);
    if (!btn) return;
    const active = oi === optIdx;
    btn.dataset.selected = active ? '1' : '0';
    btn.style.background  = active ? (subCol + '22') : 'transparent';
    btn.style.borderColor = active ? subCol : _C.border;
    btn.style.color       = active ? subCol : _C.dim;
    btn.style.fontWeight  = active ? '700' : '400';
  });
  const val = item.opts[optIdx][1];
  const valEl = document.getElementById('sa-sim-rval-' + itemIdx);
  if (valEl) { valEl.textContent = val.toFixed(3); valEl.style.color = subCol; }
  const row = document.getElementById('sa-sim-row-' + itemIdx);
  if (row) row.style.borderColor = subCol + '44';
  _saLabSimUpdate();
}

function _saLabSimYesNo(i, answer) {
  // answer: 1 = Yes, 0 = No
  const inst    = _LAB_INSTRUMENTS[_saLabInst];
  const item    = inst.items[i];
  const instCol = { mmas:_C.blue, map:_C.green }[_saLabInst] || _C.amber;
  [1, 0].forEach(v => {
    const btn = document.getElementById('sa-sim-yn-' + i + '-' + v);
    if (!btn) return;
    const active = v === answer;
    btn.dataset.selected = active ? '1' : '0';
    btn.style.background  = active ? instCol + '22' : 'transparent';
    btn.style.borderColor = active ? instCol : _C.border;
    btn.style.color       = active ? instCol : _C.dim;
    btn.style.fontWeight  = active ? '700' : '400';
  });
  // Compute score contribution using question direction, then show it
  const score  = item.reverse ? (answer === 0 ? 1 : 0) : (answer === 1 ? 1 : 0);
  const valEl  = document.getElementById('sa-sim-val-' + i);
  const row    = document.getElementById('sa-sim-row-' + i);
  if (valEl) { valEl.textContent = score; valEl.style.color = score === 1 ? instCol : _C.dim; }
  if (row)   row.style.borderColor = score === 1 ? instCol + '55' : _C.border;
  _saLabSimUpdate();
}

function _saLabSimSetAll(val) {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const isBinary = _saLabInst === 'mmas' || _saLabInst === 'map';
  const isPeacs  = _saLabInst === 'peacs';
  inst.items.forEach((item, i) => {
    if (item.opts) {
      _saLabSimPeacsSelect(i, val === 1 ? 0 : item.opts.length - 1);
      return;
    }
    if (isBinary) {
      // val=1: All Adherent — for reverse items answer No (score 1), non-reverse answer Yes (score 1)
      // val=0: All Non-Adherent — for reverse items answer Yes (score 0), non-reverse answer No (score 0)
      const answer = val === 1 ? (item.reverse ? 0 : 1) : (item.reverse ? 1 : 0);
      _saLabSimYesNo(i, answer);
    } else {
      const r = document.getElementById('sa-sim-range-' + i);
      const rv = document.getElementById('sa-sim-rval-' + i);
      if (r) { r.value = val === 1 ? '1.0' : '0.0'; }
      if (rv) rv.textContent = val === 1 ? '1.00' : '0.00';
    }
  });
  _saLabSimUpdate();
}

function _saLabSimRandom() {
  const inst = _LAB_INSTRUMENTS[_saLabInst];
  const isBinary = _saLabInst === 'mmas' || _saLabInst === 'map';
  const isPeacs  = _saLabInst === 'peacs';
  inst.items.forEach((item, i) => {
    if (item.opts) {
      const r = Math.random();
      const idx = r < 0.55 ? 0 : r < 0.85 ? Math.floor(item.opts.length/2) : item.opts.length-1;
      _saLabSimPeacsSelect(i, idx);
      return;
    }
    if (isBinary) {
      // ~65% chance adherent answer, direction-aware per question
      const adherent = Math.random() > 0.35;
      const answer   = adherent ? (item.reverse ? 0 : 1) : (item.reverse ? 1 : 0);
      _saLabSimYesNo(i, answer);
    } else {
      const v = +(0.3 + Math.random()*0.7).toFixed(2);
      const r = document.getElementById('sa-sim-range-' + i);
      const rv = document.getElementById('sa-sim-rval-' + i);
      if (r) r.value = v;
      if (rv) rv.textContent = v.toFixed(2);
    }
  });
  _saLabSimUpdate();
}

function _saLabSimUpdate() {
  const inst    = _LAB_INSTRUMENTS[_saLabInst];
  const instCol = { mmas:_C.blue, map:_C.green, peacs:_C.purple }[_saLabInst];
  const resp    = _saLabSimGetResponses();
  const result  = inst.scoreCalc(resp);
  const isObj   = typeof result === 'object';
  const score   = isObj ? result.pe : result;
  const maxScore = inst.scoreRange[1];
  const normScore = maxScore > 1 ? score / maxScore : score;

  const tier = inst.tiers.find(t => score >= t.min && score <= t.max) || inst.tiers[inst.tiers.length-1];

  const scoreEl = document.getElementById('sa-sim-score');
  const gaugeEl = document.getElementById('sa-sim-gauge');
  const tierEl  = document.getElementById('sa-sim-tier-badge');
  const subEl   = document.getElementById('sa-sim-subscales');
  const interpEl = document.getElementById('sa-sim-interp');
  const pctEl   = document.getElementById('sa-sim-percentile');

  if (scoreEl) { scoreEl.textContent = maxScore > 1 ? score : score.toFixed(3); scoreEl.style.color = tier.col; }
  if (gaugeEl) { gaugeEl.style.width = (normScore*100).toFixed(1)+'%'; gaugeEl.style.background = tier.col; }
  if (tierEl)  tierEl.innerHTML = `<span style="font-size:0.78rem;letter-spacing:0.18em;text-transform:uppercase;padding:4px 10px;border:1px solid ${tier.col};border-radius:4px;color:${tier.col};">${tier.label}</span>`;

  // Subscales
  if (subEl && isObj) {
    const subColors = { arch:_C.amber, exec:_C.cyan, ctx:_C.green, base:_C.blue, mvmt:_C.green, strata:_C.purple };
    const entries = Object.entries(result).filter(([k])=>k!=='pe');
    subEl.innerHTML = entries.map(([k,v])=>`
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;color:${_C.dim};width:70px;">${k}</span>
        <div style="flex:1;height:5px;background:${_C.navy};border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${(v*100).toFixed(1)}%;background:${subColors[k]||_C.muted};border-radius:3px;transition:width 0.35s;"></div>
        </div>
        <span style="font-size:0.84rem;font-weight:700;color:${subColors[k]||_C.muted};width:42px;text-align:right;">${v.toFixed(3)}</span>
      </div>`).join('');
  } else if (subEl) {
    subEl.innerHTML = '';
  }

  // Percentile from actual data
  if (pctEl) {
    const records = _saLabGetRecords(_saLabInst);
    if (records.length) {
      const scores = records.map(r => {
        if (_saLabInst === 'mmas') return (r.score||0) / 8;
        return _labPE(r, _saLabInst);
      }).sort((a,b)=>a-b);
      const below = scores.filter(s=>s<=normScore).length;
      const pct = (below/scores.length*100).toFixed(0);
      pctEl.innerHTML = `This score is at the <strong style="color:${tier.col};">${pct}th percentile</strong> of the current ${inst.label} population (N = ${records.length.toLocaleString()}).`;
    } else {
      pctEl.innerHTML = `<span style="color:${_C.dim};">No ${inst.label} records on file — percentile comparison will appear once assessments are submitted.</span>`;
    }
  }

  // Interpretation
  if (interpEl) {
    const interps = {
      mmas: {
        high:   'High adherence — the respondent takes medication consistently and experiences minimal barriers. Maintenance-level support is appropriate.',
        medium: 'Medium adherence — some inconsistency is present. Brief motivational intervention or reminders may improve outcomes.',
        low:    'Low adherence — significant non-adherence detected across multiple items. Structured intervention, patient education, and barrier assessment are recommended.',
      },
      map: {
        high:   'Optimal PE — strong Architecture, Execution, and Context foundations. The patient has effective systems and environmental support for medication-taking.',
        medium: 'Moderate PE — one or more subscales are limiting the geometric mean. Review the weakest dimension to target intervention.',
        low:    'Poor PE — broad deficits across MAP subscales. A comprehensive adherence support plan addressing systems (Architecture), behaviour (Execution), and environment (Context) is indicated.',
      },
      peacs: {
        high:   'Optimal PEACS PE — all three composite dimensions are strong. Continue current engagement plan.',
        medium: 'Moderate PEACS PE — at least one composite score is limiting the geometric mean. Identify and address the limiting dimension.',
        low:    'Poor PEACS PE — significant composite deficits. Review Base, Movement, and Strata scores individually to build a targeted intervention.',
      },
    };
    const tier_key = normScore >= 0.85 ? 'high' : normScore >= 0.55 ? 'medium' : 'low';
    interpEl.innerHTML = interps[_saLabInst][tier_key] || '—';
  }
}

// ── NORM TABLES ───────────────────────────────────────────────────────────────

function _saLabRenderNorms(body) {
  const inst    = _LAB_INSTRUMENTS[_saLabInst];
  const records = _saLabGetRecords(_saLabInst);
  const instCol = { mmas:_C.blue, map:_C.green, peacs:_C.purple }[_saLabInst];

  if (!records.length) {
    body.innerHTML = `<div class="sa-panel" style="text-align:center;padding:40px;color:${_C.dim};">No ${inst.label} records available for norm computation.</div>`;
    return;
  }

  const scores = records.map(r => {
    if (_saLabInst === 'mmas') return r.score != null ? +r.score : null;
    if (_saLabInst === 'map') return _labMapPE(r);
    return r.pe!=null?+r.pe:null;
  }).filter(v=>v!==null).sort((a,b)=>a-b);

  const n = scores.length;
  const mean   = scores.reduce((s,v)=>s+v,0)/n;
  const sd     = Math.sqrt(scores.reduce((s,v)=>s+Math.pow(v-mean,2),0)/n);
  const median = n%2===0?(scores[n/2-1]+scores[n/2])/2:scores[Math.floor(n/2)];
  const p10    = scores[Math.floor(n*0.10)], p25 = scores[Math.floor(n*0.25)];
  const p75    = scores[Math.floor(n*0.75)], p90 = scores[Math.floor(n*0.90)];

  // Frequency distribution
  const bins  = _saLabInst === 'mmas' ? 9 : 10;
  const range = inst.scoreRange[1] - inst.scoreRange[0];
  const binW  = range / bins;
  const freq  = Array(bins).fill(0);
  scores.forEach(s => {
    const b = Math.min(bins-1, Math.floor((s - inst.scoreRange[0]) / binW));
    freq[b]++;
  });
  const maxF = Math.max(...freq, 1);

  // Percentile table rows
  const pctRows = [1,5,10,16,25,50,75,84,90,95,99].map(p => ({
    p, score: scores[Math.min(n-1, Math.floor(n*p/100))],
  }));

  body.innerHTML = `
  <!-- Summary stats -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px;">
    ${[
      ['N',      n.toLocaleString(),     instCol],
      ['Mean',   mean.toFixed(_saLabInst==='mmas'?2:3), instCol],
      ['SD',     sd.toFixed(3),          _C.muted],
      ['Median', median.toFixed(_saLabInst==='mmas'?1:3), _C.cyan],
      ['P10',    p10!=null?p10.toFixed(_saLabInst==='mmas'?1:3):'—', _C.dim],
      ['P90',    p90!=null?p90.toFixed(_saLabInst==='mmas'?1:3):'—', _C.green],
    ].map(([lbl,val,col])=>`
    <div class="sa-panel" style="text-align:center;">
      <div style="font-size:1.4rem;font-weight:700;color:${col};line-height:1;">${val}</div>
      <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-top:4px;">${lbl}</div>
    </div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 240px;gap:18px;margin-bottom:18px;">

    <!-- Frequency distribution -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Frequency Distribution (N=${n.toLocaleString()})</div>
      <div style="display:flex;gap:3px;height:120px;align-items:flex-end;margin-top:14px;">
        ${freq.map((f,i) => {
          const lo = (inst.scoreRange[0] + i*binW).toFixed(_saLabInst==='mmas'?0:1);
          const hi = (inst.scoreRange[0] + (i+1)*binW).toFixed(_saLabInst==='mmas'?0:1);
          const pct = (f/maxF*100).toFixed(0);
          const col = inst.tiers.find(t=>+lo>=t.min&&+lo<=t.max)?.col || instCol;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;" title="${lo}–${hi}: ${f} (${(f/n*100).toFixed(1)}%)">
            <div style="font-size:0.66rem;color:${_C.dim};">${f>0?f:''}</div>
            <div style="flex:1;width:100%;background:${_C.navy};border-radius:2px;display:flex;flex-direction:column;justify-content:flex-end;">
              <div style="height:${pct}%;background:${col};border-radius:2px;opacity:0.85;min-height:${f?2:0}px;"></div>
            </div>
            <div style="font-size:0.66rem;color:${_C.dim};">${lo}</div>
          </div>`;
        }).join('')}
      </div>
      <!-- Tier bands -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${inst.tiers.map(t=>`
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:${t.col};display:inline-block;"></span>
          <span style="font-size:0.74rem;color:${_C.dim};">${t.label}: ${scores.filter(s=>s>=t.min&&s<=t.max).length.toLocaleString()} (${(scores.filter(s=>s>=t.min&&s<=t.max).length/n*100).toFixed(1)}%)</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- Percentile table -->
    <div class="sa-panel" style="padding:0;overflow:hidden;">
      <div style="padding:12px 14px;border-bottom:1px solid ${_C.border};">
        <div class="sa-section-eyebrow">Percentile Norms</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:${_C.bg2};">
          <th style="padding:7px 14px;text-align:left;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};">Percentile</th>
          <th style="padding:7px 14px;text-align:right;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};">Score</th>
        </tr></thead>
        <tbody>
          ${pctRows.map(row=>`
          <tr style="border-bottom:1px solid ${_C.border};">
            <td style="padding:7px 14px;font-size:0.84rem;color:${_C.muted};">P${row.p}</td>
            <td style="padding:7px 14px;text-align:right;font-size:0.90rem;font-weight:700;color:${instCol};">${row.score!=null?row.score.toFixed(_saLabInst==='mmas'?1:3):'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Interquartile box -->
  <div class="sa-panel">
    <div class="sa-section-eyebrow">Box Plot Summary</div>
    <div style="margin:18px 20px 8px;">${_saLabBoxPlot(scores, inst, instCol)}</div>
    <div style="display:flex;justify-content:space-around;font-size:0.74rem;color:${_C.dim};margin-top:4px;">
      <span>Min: ${scores[0]!=null?scores[0].toFixed(_saLabInst==='mmas'?0:3):'—'}</span>
      <span>P25: ${p25!=null?p25.toFixed(_saLabInst==='mmas'?1:3):'—'}</span>
      <span>Median: ${median.toFixed(_saLabInst==='mmas'?1:3)}</span>
      <span>P75: ${p75!=null?p75.toFixed(_saLabInst==='mmas'?1:3):'—'}</span>
      <span>Max: ${scores[n-1]!=null?scores[n-1].toFixed(_saLabInst==='mmas'?0:3):'—'}</span>
    </div>
  </div>`;
}

function _saLabBoxPlot(scores, inst, instCol) {
  const n=scores.length; if(!n) return '';
  const min=scores[0], max=scores[n-1];
  const p25=scores[Math.floor(n*0.25)], p75=scores[Math.floor(n*0.75)];
  const med=n%2===0?(scores[n/2-1]+scores[n/2])/2:scores[Math.floor(n/2)];
  const range=inst.scoreRange[1]-inst.scoreRange[0]||1;
  const toX = v => ((v-inst.scoreRange[0])/range*100).toFixed(1)+'%';
  const boxL=toX(p25), boxR=toX(p75), medX=toX(med), minX=toX(min), maxX=toX(max);
  return `<div style="position:relative;height:36px;">
    <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:${_C.border};transform:translateY(-50%);"></div>
    <div style="position:absolute;top:6px;bottom:6px;left:${toX(Math.min(p25,p75))};right:${(100-parseFloat(toX(Math.max(p25,p75)))).toFixed(1)}%;background:${instCol};opacity:0.2;border:1px solid ${instCol};border-radius:2px;"></div>
    <div style="position:absolute;top:4px;bottom:4px;left:${medX};width:2px;background:${instCol};border-radius:1px;transform:translateX(-1px);"></div>
    <div style="position:absolute;top:50%;left:${minX};width:6px;height:6px;background:${instCol};border-radius:50%;transform:translate(-3px,-50%);opacity:0.6;"></div>
    <div style="position:absolute;top:50%;left:${maxX};width:6px;height:6px;background:${instCol};border-radius:50%;transform:translate(-3px,-50%);opacity:0.6;"></div>
  </div>`;
}

// ── EQUIVALENCE ───────────────────────────────────────────────────────────────

function _saLabRenderEquivalence(body) {
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const mapInstr = mmas.filter(r=>r.tool==='map' || r.map_q1!==undefined);

  const mmasLabOnly = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mmasMean  = mmasLabOnly.length ? mmasLabOnly.reduce((s,r)=>s+(r.score||0)/8,0)/mmasLabOnly.length : null;
  const peacsMean = peacs.length ? peacs.filter(r=>r.pe!=null).reduce((s,r)=>s+(+r.pe),0)/peacs.filter(r=>r.pe!=null).length : null;
  const mapMean   = mapInstr.length ? mapInstr.reduce((s,r)=>s+_labMapPE(r),0)/mapInstr.length : null;

  // Tier overlap analysis — MMAS-8 only (MAP and PEACS use pe_score/pe)
  const mmHigh  = mmasLabOnly.filter(r=>(r.score||0)/8>=0.85).length;
  const pcHigh  = peacs.filter(r=>r.pe!=null&&+r.pe>=0.85).length;
  const mapHigh = mapInstr.filter(r=>_labMapPE(r)>=0.85).length;
  const mmLow   = mmasLabOnly.filter(r=>(r.score||0)/8<0.55).length;
  const pcLow   = peacs.filter(r=>r.pe!=null&&+r.pe<0.55).length;
  const mapLow  = mapInstr.filter(r=>_labMapPE(r)<0.55).length;

  body.innerHTML = `
  <!-- Cross-instrument mean comparison -->
  <div class="sa-panel" style="margin-bottom:18px;">
    <div class="sa-section-eyebrow">Mean Score Comparison (normalised 0–1)</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
      ${[['MMAS-8',mmasMean,_C.blue,mmas.length],['MAP',mapMean,_C.green,mapInstr.length],['PEACS',peacsMean,_C.purple,peacs.length]].map(([lbl,mean,col,n])=>`
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="font-size:0.82rem;color:${_C.muted};width:60px;">${lbl}</span>
        <div style="flex:1;height:18px;background:${_C.navy};border-radius:3px;overflow:hidden;position:relative;">
          ${mean!==null?`<div style="height:100%;width:${(mean*100).toFixed(1)}%;background:${col};border-radius:3px;opacity:0.8;transition:width 0.5s;"></div>`:''}
          ${mean!==null?`<div style="position:absolute;top:0;left:${(mean*100).toFixed(1)}%;height:100%;width:1px;background:#fff;opacity:0.4;"></div>`:''}
        </div>
        <span style="font-size:0.90rem;font-weight:700;color:${col};width:52px;text-align:right;">${mean!==null?mean.toFixed(3):'—'}</span>
        <span style="font-size:0.78rem;color:${_C.dim};width:60px;">N=${n.toLocaleString()}</span>
      </div>`).join('')}
    </div>
    ${mmasMean!==null&&peacsMean!==null?`
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid ${_C.border};font-size:0.86rem;color:${_C.muted};line-height:1.7;">
      Mean difference MMAS ↔ PEACS: <strong style="color:${_C.text};">${Math.abs(mmasMean-peacsMean).toFixed(3)}</strong>
      (${mmasMean>peacsMean?'MMAS scores higher':'PEACS scores higher'}).
    </div>`:''}
  </div>

  <!-- Tier concordance -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">
    <div class="sa-panel">
      <div class="sa-section-eyebrow">High-Adherence Population (≥ 0.85)</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        ${[['MMAS-8',mmHigh,mmasLabOnly.length,_C.blue],['PEACS',pcHigh,peacs.length,_C.purple],['MAP',mapHigh,mapInstr.length,_C.green]].map(([lbl,n2,tot,col])=>`
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.80rem;color:${_C.muted};width:60px;">${lbl}</span>
          <div style="flex:1;height:5px;background:${_C.navy};border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${tot?((n2/tot)*100).toFixed(1):0}%;background:${col};border-radius:3px;"></div>
          </div>
          <span style="font-size:0.84rem;color:${col};width:52px;text-align:right;">${n2.toLocaleString()}</span>
          <span style="font-size:0.74rem;color:${_C.dim};width:38px;">${tot?(n2/tot*100).toFixed(1)+'%':'—'}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Low-Adherence Population (< 0.55)</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        ${[['MMAS-8',mmLow,mmasLabOnly.length,_C.blue],['PEACS',pcLow,peacs.length,_C.purple],['MAP',mapLow,mapInstr.length,_C.green]].map(([lbl,n2,tot,col])=>`
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.80rem;color:${_C.muted};width:60px;">${lbl}</span>
          <div style="flex:1;height:5px;background:${_C.navy};border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${tot?((n2/tot)*100).toFixed(1):0}%;background:${col};border-radius:3px;"></div>
          </div>
          <span style="font-size:0.84rem;color:${_C.red};width:52px;text-align:right;">${n2.toLocaleString()}</span>
          <span style="font-size:0.74rem;color:${_C.dim};width:38px;">${tot?(n2/tot*100).toFixed(1)+'%':'—'}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Instrument notes -->
  <div class="sa-panel">
    <div class="sa-section-eyebrow">Construct Notes · Cross-Instrument Interpretation</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:12px;">
      ${[
        ['MMAS-8', _C.blue, 'Single-scale, 8 binary items. Scores 0–8 map to Low (<6), Medium (6 to <8), High (8) adherence tiers. Measures self-reported behaviour across general adherence barriers.'],
        ['MAP',    _C.green,'Multidimensional, 8 binary items. Three subscales — Architecture (systems), Execution (behaviour), Context (environment) — combine into a geometric PE score (0–1). Discriminates structural from behavioural non-adherence.'],
        ['PEACS',  _C.purple,'Composite-only scale. Three clinician-rated or derived dimensions — Base, Movement, Strata — combine into a geometric PE score (0–1). Designed for longitudinal tracking across clinical encounters.'],
      ].map(([lbl,col,desc])=>`
      <div style="padding:14px 16px;background:${_C.navy};border-top:2px solid ${col};border-radius:4px;">
        <div style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${col};margin-bottom:8px;">${lbl}</div>
        <div style="font-size:0.84rem;color:${_C.muted};line-height:1.65;">${desc}</div>
      </div>`).join('')}
    </div>
    <div style="margin-top:14px;font-size:0.80rem;color:${_C.dim};border-top:1px solid ${_C.border};padding-top:10px;line-height:1.6;">
      Cross-instrument correlation analysis will appear here once MAP instrument records are collected. Concurrent validity, convergent correlation (MMAS ↔ MAP), and discriminant analysis (MMAS/MAP ↔ PEACS) will be computed automatically.
    </div>
  </div>`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function _saLabGetRecords(inst) {
  switch (inst) {
    case 'mmas':  return (_saCache.mmas||[]).filter(r=>r.tool!=='map' && r.map_q1===undefined);
    case 'map':   return (_saCache.mmas||[]).filter(r=>r.tool==='map' || r.map_q1!==undefined);
    case 'peacs': return _saCache.peacs||[];
    default:      return [];
  }
}
