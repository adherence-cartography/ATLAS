// sa-psychometrics.js — Psychometrics: two-tier nav (group → subtab), MMAS/MAP/PEACS
// Instruments are strictly separated: MMAS-8 | MAP | PEACS
// PEACS owns Architecture (base) / Execution (mvmt) / Context (strata) subscale scores.
// MAP owns item-level data (map_q1–map_q8) and derives its own domain scores from items.



// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

let _saPsyGroup      = 'overview';
let _saPsyTab        = null;
let _saPsyInstrument = 'mmas';
let _saPsyCache      = {};
let _saPsyPredLag    = 30;

// ── Two-tier group → subtab definitions ──────────────────────────────────────

const _SA_PSY_GROUPS = {
  mmas: [
    { id:'overview',      label:'Overview',      subs: null },
    { id:'psychometrics', label:'Psychometrics',  subs: [
      { id:'reliability', label:'Reliability'       },
      { id:'items',       label:'Item Analysis'     },
      { id:'factor',      label:'Factor Structure'  },
      { id:'irt',         label:'IRT Parameters'    },
    ]},
    { id:'validity',      label:'Validity',       subs: [
      { id:'content',        label:'Content'        },
      { id:'criterion',      label:'Criterion'      },
      { id:'predictive',     label:'Predictive'     },
      { id:'classification', label:'Classification' },
    ]},
  ],
  map: [
    { id:'overview',      label:'Overview',      subs: null },
    { id:'psychometrics', label:'Psychometrics',  subs: [
      { id:'reliability', label:'Reliability'       },
      { id:'items',       label:'Item Analysis'     },
      { id:'factor',      label:'Factor Structure'  },
      { id:'irt',         label:'IRT Parameters'    },
    ]},
    { id:'domains',       label:'Domains',        subs: [
      { id:'radar',       label:'Radar Profile'    },
      { id:'limitation',  label:'Limitation'       },
      { id:'noncomp',     label:'Non-Compensatory' },
      { id:'q8',          label:'Q8 Ordinal'       },
    ]},
    { id:'patterns',      label:'Patterns',       subs: [
      { id:'inaua',          label:'INA / UNA'        },
      { id:'classification', label:'Classification'   },
      { id:'drivers',        label:'Item Drivers'     },
    ]},
    { id:'validity',      label:'Validity',       subs: [
      { id:'content',        label:'Content'        },
      { id:'criterion',      label:'Criterion'      },
      { id:'construct',      label:'Construct'      },
      { id:'predictive',     label:'Predictive'     },
      { id:'classification', label:'Classification' },
    ]},
  ],
  peacs: [
    { id:'overview',      label:'Overview',      subs: [
      { id:'summary',      label:'Summary'      },
      { id:'subscales',    label:'Subscales'    },
      { id:'distribution', label:'Distribution' },
    ]},
    { id:'correlations',  label:'Correlations',  subs: null },
    { id:'validation',    label:'Validation',    subs: [
      { id:'cross',        label:'Cross-Instrument' },
      { id:'confusion',    label:'Confusion Matrix' },
      { id:'roc',          label:'ROC / AUC'        },
      { id:'calibration',  label:'Calibration'      },
      { id:'guard',        label:'Context Guard'     },
    ]},
    { id:'trajectories',  label:'Trajectories',  subs: [
      { id:'longitudinal', label:'Longitudinal'      },
      { id:'zones',        label:'Zone Transitions'  },
      { id:'drift',        label:'Drift Analysis'    },
    ]},
  ],
};

// ── Item label sets ────────────────────────────────────────────────────────────
const _MMAS_LABELS = [
  'Forgetting to take medicine',
  'Missed doses over past 2 weeks',
  'Stopped without telling doctor',
  'Forgetting when away from home',
  'Took all medicine yesterday',
  'Stopped when condition felt controlled',
  'Feels hassled sticking to treatment plan',
  'Frequency of difficulty remembering',
];
const _MAP_LABELS = [
  'Takes medication at scheduled times [Execution]',
  'Has a system/routine for taking medication [Architecture]',
  'Plans medication around daily schedule [Architecture]',
  'Takes medication even when away from home [Context]',
  'Remembers to take medication without reminders [Execution]',
  'Has contingency plan if dose is missed [Architecture]',
  'Environment supports consistent medication-taking [Context]',
  'Rarely misses doses due to competing priorities [Execution]',
];
const _MMAS_SHORT = ['Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8'];
const _MAP_SHORT  = ['Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8'];

// ══════════════════════════════════════════════════════════════════════════════
// ENTRY / NAV
// ══════════════════════════════════════════════════════════════════════════════

function _saRenderPsychometrics(container) {
  _saPsyCache      = {};
  _saPsyGroup      = 'overview';
  _saPsyTab        = null;
  const inst       = _saPsyInstrument;

  container.innerHTML = `
    <div style="margin-bottom:4px;">
      <div class="sa-section-eyebrow">◈ Psychometrics</div>
      <div class="sa-section-title">Instrument Analysis</div>
    </div>

    <!-- Instrument selector -->
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;">
      <span style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-right:6px;">Instrument</span>
      ${[
        { id:'mmas',  label:'MMAS-8', n: (_saCache.mmas||[]).filter(r=>r.tool!=='map'&&r.map_q1===undefined).length },
        { id:'map',   label:'MAP',    n: (_saCache.mmas||[]).filter(r=>r.map_q1!==undefined).length },
        { id:'peacs', label:'PEACS',  n: (_saCache.peacs||[]).length },
      ].map(s=>`
        <button id="sa-psy-inst-${s.id}" onclick="_saPsySetInstrument('${s.id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.08em;
                 padding:6px 16px;border-radius:6px;cursor:pointer;transition:all 0.15s;
                 border:1px solid ${s.id===inst?'rgba(212,168,67,0.4)':_C.border};
                 background:${s.id===inst?'rgba(212,168,67,0.14)':'transparent'};
                 color:${s.id===inst?_C.amber:_C.muted};">
          ${s.label} <span style="font-size:0.70rem;opacity:0.65;">(${s.n.toLocaleString()})</span>
        </button>`).join('')}
    </div>

    <!-- Group tabs (Tier 1) -->
    <div id="sa-psy-groups" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;"></div>

    <!-- Subtab nav (Tier 2, conditional) -->
    <div id="sa-psy-tabs" style="display:flex;gap:6px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid ${_C.border};flex-wrap:wrap;min-height:0;"></div>

    <div id="sa-psy-body"></div>`;

  _saPsyBuildGroupNav(inst);
  _saPsySetGroup('overview');
}

function _saPsySetInstrument(inst) {
  _saPsyInstrument = inst;
  _saPsyGroup      = 'overview';
  _saPsyTab        = null;
  ['mmas','map','peacs'].forEach(id => {
    const b = document.getElementById('sa-psy-inst-'+id);
    if (!b) return;
    const on = id===inst;
    b.style.background  = on ? 'rgba(212,168,67,0.14)' : 'transparent';
    b.style.borderColor = on ? 'rgba(212,168,67,0.4)'  : _C.border;
    b.style.color       = on ? _C.amber : _C.muted;
  });
  _saPsyBuildGroupNav(inst);
  _saPsySetGroup('overview');
}

// Build Tier-1 group button row
function _saPsyBuildGroupNav(inst) {
  const groups = _SA_PSY_GROUPS[inst] || [];
  const row = document.getElementById('sa-psy-groups');
  if (!row) return;
  row.innerHTML = groups.map(g=>`
    <button id="sa-psy-grp-${g.id}" onclick="_saPsySetGroup('${g.id}')"
      style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;
             padding:7px 18px;border-radius:6px;cursor:pointer;transition:all 0.15s;
             border:1px solid ${_C.border};background:transparent;color:${_C.muted};">
      ${g.label}
    </button>`).join('');
}

// Activate a Tier-1 group
function _saPsySetGroup(groupId) {
  _saPsyGroup = groupId;
  const inst   = _saPsyInstrument;
  const groups = _SA_PSY_GROUPS[inst] || [];
  const group  = groups.find(g=>g.id===groupId);

  // Update group button styles
  groups.forEach(g => {
    const b = document.getElementById('sa-psy-grp-'+g.id);
    if (!b) return;
    const on = g.id===groupId;
    b.style.background  = on ? 'rgba(212,168,67,0.14)' : 'transparent';
    b.style.borderColor = on ? 'rgba(212,168,67,0.4)'  : _C.border;
    b.style.color       = on ? _C.amber : _C.muted;
  });

  // Build subtab row
  const tabRow = document.getElementById('sa-psy-tabs');
  if (tabRow) {
    if (group && group.subs && group.subs.length > 0) {
      _saPsyTab = group.subs[0].id;
      tabRow.style.display = 'flex';
      tabRow.innerHTML = group.subs.map(s=>`
        <button id="sa-psy-tab-${s.id}" onclick="_saPsySetTab('${s.id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.07em;
                 padding:5px 14px;border-radius:5px;cursor:pointer;transition:all 0.15s;
                 border:1px solid ${s.id===_saPsyTab?'rgba(212,168,67,0.35)':_C.border};
                 background:${s.id===_saPsyTab?'rgba(212,168,67,0.10)':'transparent'};
                 color:${s.id===_saPsyTab?_C.amber:_C.muted};">
          ${s.label}
        </button>`).join('');
    } else {
      _saPsyTab = null;
      tabRow.style.display = 'none';
      tabRow.innerHTML = '';
    }
  }

  _saPsyDispatch();
}

// Activate a Tier-2 subtab
function _saPsySetTab(tabId) {
  _saPsyTab = tabId;
  const inst   = _saPsyInstrument;
  const groups = _SA_PSY_GROUPS[inst] || [];
  const group  = groups.find(g=>g.id===_saPsyGroup);
  if (group && group.subs) {
    group.subs.forEach(s => {
      const b = document.getElementById('sa-psy-tab-'+s.id);
      if (!b) return;
      const on = s.id===tabId;
      b.style.background  = on ? 'rgba(212,168,67,0.10)' : 'transparent';
      b.style.borderColor = on ? 'rgba(212,168,67,0.35)' : _C.border;
      b.style.color       = on ? _C.amber : _C.muted;
    });
  }
  _saPsyDispatch();
}

// Compatibility shim — old single-arg _saPsyNav still works (used by legacy callers)
function _saPsyNav(tabId) { _saPsySetTab(tabId); }

// ── Central content dispatch ──────────────────────────────────────────────────

function _saPsyDispatch() {
  const body = document.getElementById('sa-psy-body');
  if (!body) return;
  body.innerHTML = `<div style="color:${_C.muted};font-size:0.86rem;padding:40px 0;text-align:center;">Computing…</div>`;

  setTimeout(() => {
    const inst  = _saPsyInstrument;
    const group = _saPsyGroup;
    const tab   = _saPsyTab;

    // Ensure base computation cache
    if (inst !== 'peacs' && !_saPsyCache[inst]) {
      _saPsyCache[inst] = _saPsyComputeItems(inst);
    }
    if (inst === 'peacs' && !_saPsyCache.peacs) {
      _saPsyCache.peacs = _saPsyComputePEACS();
    }

    if (inst === 'peacs') {
      switch (group) {
        case 'overview':
          switch (tab||'summary') {
            case 'summary':      _saPsyPeacsOverview(body);   break;
            case 'subscales':    _saPsyPeacsSubscales(body);  break;
            case 'distribution': _saPsyPeacsDist(body);       break;
            default:             _saPsyPeacsOverview(body);
          }
          break;
        case 'correlations':   _saPsyPeacsCorr(body);                         break;
        case 'validation':     _saPsyPeacsValidation(body,   tab||'cross');    break;
        case 'trajectories':   _saPsyPeacsTrajectories(body, tab||'longitudinal'); break;
        default:               _saPsyPeacsOverview(body);
      }
    } else {
      // MMAS or MAP
      switch (group) {
        case 'overview':       _saPsyOverview(body, inst);                     break;
        case 'psychometrics':
          switch (tab||'reliability') {
            case 'reliability': _saPsyReliability(body); break;
            case 'items':       _saPsyItems(body);       break;
            case 'factor':      _saPsyFactor(body);      break;
            case 'irt':         _saPsyIRT(body);         break;
          }
          break;
        case 'domains':        _saPsyMapDomains(body,   tab||'radar');         break;
        case 'patterns':       _saPsyMapPatterns(body,  tab||'inaua');         break;
        case 'validity': {
          if (!_saPsyCache[inst+'_validity'])
            _saPsyCache[inst+'_validity'] = _saPsyComputeValidity(inst);
          switch (tab||'content') {
            case 'content':        _saPsyValidityContent(body);        break;
            case 'criterion':      _saPsyValidityCriterion(body);      break;
            case 'construct':      _saPsyValidityConstruct(body);      break;
            case 'predictive':     _saPsyValidityPredictive(body);     break;
            case 'classification': _saPsyClassification(body, inst);   break;
          }
          break;
        }
        default: _saPsyOverview(body, inst);
      }
    }
  }, 30);
}


// ══════════════════════════════════════════════════════════════════════════════
// STATISTICAL HELPERS  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _psyMean(a) { return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0; }
function _psyVar(a)  {
  if (a.length < 2) return 0;
  const m = _psyMean(a);
  return a.reduce((s,x)=>s+(x-m)**2,0) / (a.length-1);
}
function _psySD(a) { return Math.sqrt(_psyVar(a)); }
function _psyPearson(a, b) {
  const n=a.length; if (n<2) return 0;
  const ma=_psyMean(a), mb=_psyMean(b);
  let num=0,da2=0,db2=0;
  for(let i=0;i<n;i++){const da=a[i]-ma,db=b[i]-mb;num+=da*db;da2+=da*da;db2+=db*db;}
  const d=Math.sqrt(da2*db2); return d<1e-12?0:num/d;
}
function _psyLogit(p) { p=Math.max(0.001,Math.min(0.999,p)); return Math.log(p/(1-p)); }


// ══════════════════════════════════════════════════════════════════════════════
// MMAS / MAP ITEM COMPUTATION  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyComputeItems(inst) {
  const prefix = inst === 'map' ? 'map_q' : 'q';
  const raw = (_saCache.mmas||[]).filter(r => r[prefix+'1'] !== undefined);
  const K = 8;
  if (raw.length < 30) return { insufficient:true, n:raw.length };

  const parse = v =>
    typeof v==='number' ? v
    : (v===true||v==='true'||v==='yes'||v==='Yes'||v===1||v==='1') ? 1
    : (v===false||v==='false'||v==='no'||v==='No'||v===0||v==='0') ? 0
    : NaN;

  const matrix = raw
    .map(r => Array.from({length:K},(_,j)=>parse(r[prefix+(j+1)])))
    .filter(row => row.every(v=>!isNaN(v)));
  const n = matrix.length;
  if (n < 30) return { insufficient:true, n };

  const cols   = Array.from({length:K},(_,j)=>matrix.map(r=>r[j]));
  const totals = matrix.map(r=>r.reduce((s,x)=>s+x,0));

  const itemMeans = cols.map(_psyMean);
  const itemSDs   = cols.map(_psySD);
  const itemVars  = cols.map(_psyVar);
  const totalVar  = _psyVar(totals);
  const totalSD   = _psySD(totals);
  const totalMean = _psyMean(totals);

  const rIT = cols.map((col,j)=>{
    const rest=totals.map((t,i)=>t-matrix[i][j]);
    return _psyPearson(col,rest);
  });

  const alpha = totalVar>0 ? (K/(K-1))*(1-itemVars.reduce((s,v)=>s+v,0)/totalVar) : 0;
  const sem   = totalSD*Math.sqrt(1-Math.max(0,alpha));

  const oddT  = matrix.map(r=>r[0]+r[2]+r[4]+r[6]);
  const evenT = matrix.map(r=>r[1]+r[3]+r[5]+r[7]);
  const rHalf = _psyPearson(oddT,evenT);
  const splitHalf = 2*rHalf/(1+Math.abs(rHalf));

  const loadings = rIT.map(r=>r*Math.sqrt(Math.max(0,alpha)));
  const sumL = loadings.reduce((s,l)=>s+l,0);
  const sumE = loadings.map((l,j)=>Math.max(0,itemVars[j]-l**2)).reduce((s,v)=>s+v,0);
  const omega = sumL**2>0 ? sumL**2/(sumL**2+sumE) : alpha;

  const corrMatrix=Array.from({length:K},(_,i)=>
    Array.from({length:K},(_,j)=>i===j?1:_psyPearson(cols[i],cols[j]))
  );
  let rSum=0,rCnt=0;
  for(let i=0;i<K;i++) for(let j=i+1;j<K;j++){rSum+=corrMatrix[i][j];rCnt++;}
  const avgInterCorr=rCnt?rSum/rCnt:0;

  const sorted=[...matrix].sort((a,b)=>b.reduce((s,x)=>s+x,0)-a.reduce((s,x)=>s+x,0));
  const n27=Math.max(2,Math.floor(n*0.27));
  const up27=sorted.slice(0,n27),lo27=sorted.slice(-n27);
  const discrimD=Array.from({length:K},(_,j)=>_psyMean(up27.map(r=>r[j]))-_psyMean(lo27.map(r=>r[j])));

  const irtA=rIT.map(r=>{const c=Math.max(-0.999,Math.min(0.999,r));return c/Math.sqrt(1-c**2);});
  const irtB=itemMeans.map(p=>_psyLogit(1-p));

  const scoreDist=Array.from({length:9},(_,s)=>totals.filter(t=>Math.round(t)===s).length);

  // MAP-specific: subscale scores
  let subscales = null;
  if (inst === 'map') {
    subscales = {
      arch: raw.map(r=>((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3),
      exec: raw.map(r=>((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3),
      ctx:  raw.map(r=>0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2),
      pe:   raw.map(r=>Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3)),
    };
  }

  return { n, K, inst, alpha, omega, sem, splitHalf, rHalf,
           itemMeans, itemSDs, itemVars, rIT, loadings, discrimD,
           corrMatrix, avgInterCorr, irtA, irtB,
           scoreDist, totalMean, totalSD, subscales,
           raw };  // expose raw for new analyses
}


// ══════════════════════════════════════════════════════════════════════════════
// PEACS COMPUTATION  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyComputePEACS() {
  const raw = (_saCache.peacs||[]).filter(r => r.pe != null);
  if (raw.length < 10) return { insufficient:true, n:raw.length };

  const pe     = raw.map(r=>parseFloat(r.pe??0)).filter(v=>!isNaN(v)&&v>0);
  const base   = raw.map(r=>parseFloat(r.base??0)).filter(v=>!isNaN(v)&&v>=0);
  const mvmt   = raw.map(r=>parseFloat(r.mvmt??0)).filter(v=>!isNaN(v)&&v>=0);
  const strata = raw.map(r=>parseFloat(r.strata??0)).filter(v=>!isNaN(v)&&v>=0);

  const stat = arr => arr.length ? {
    n:    arr.length,
    mean: _psyMean(arr),
    sd:   _psySD(arr),
    min:  Math.min(...arr),
    max:  Math.max(...arr),
    p25:  arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length*0.25)],
    p50:  arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length*0.50)],
    p75:  arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length*0.75)],
  } : { n:0,mean:0,sd:0,min:0,max:0,p25:0,p50:0,p75:0 };

  const paired = raw.filter(r=>r.base!==undefined&&r.mvmt!==undefined&&r.strata!==undefined);
  const pBase   = paired.map(r=>+r.base);
  const pMvmt   = paired.map(r=>+r.mvmt);
  const pStrata = paired.map(r=>+r.strata);
  const pPe     = paired.map(r=>+(r.pe_score??r.pe??0));

  const corrBM = _psyPearson(pBase,pMvmt);
  const corrBS = _psyPearson(pBase,pStrata);
  const corrMS = _psyPearson(pMvmt,pStrata);
  const corrBP = _psyPearson(pBase,pPe);
  const corrMP = _psyPearson(pMvmt,pPe);
  const corrSP = _psyPearson(pStrata,pPe);

  const bins10 = Array.from({length:10},(_,i)=>pe.filter(v=>v>=i/10&&v<(i+1)/10).length);
  bins10[9] += pe.filter(v=>v>=1.0).length;

  return { n:raw.length, nPaired:paired.length,
           pe:stat(pe), base:stat(base), mvmt:stat(mvmt), strata:stat(strata),
           corrBM, corrBS, corrMS, corrBP, corrMP, corrSP,
           bins10, peRaw:pe, raw };  // expose raw for new analyses
}


// ══════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS  (unchanged + new helpers)
// ══════════════════════════════════════════════════════════════════════════════

function _psyInsuf(container, d, instLabel) {
  container.innerHTML = `
    <div class="sa-panel" style="text-align:center;padding:48px 24px;">
      <div style="font-size:2rem;opacity:0.2;margin-bottom:12px;">◈</div>
      <div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Item-Level Data Required</div>
      <div style="font-size:0.84rem;color:${_C.muted};max-width:440px;margin:0 auto;line-height:1.65;">
        Found <strong style="color:${_C.text};">${(d.n||0).toLocaleString()}</strong> ${instLabel} records with individual item fields.
        Minimum 30 required.
      </div>
    </div>`;
}

function _psyKpi(label, val, color, sub) {
  return `<div class="sa-panel" style="text-align:center;padding:18px 12px;">
    <div style="font-size:1.65rem;font-weight:700;color:${color};font-family:'IBM Plex Mono',monospace;line-height:1;">${val}</div>
    <div style="font-size:0.84rem;color:${_C.text};margin:6px 0 3px;">${label}</div>
    <div style="font-size:0.74rem;color:${_C.dim};">${sub}</div>
  </div>`;
}

function _psyGauge(label, val, color) {
  const pct=Math.min(100,Math.max(0,val*100)).toFixed(1);
  return `<div style="margin-bottom:13px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
      <span style="font-size:0.84rem;color:${_C.text};">${label}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:${color};font-weight:700;">${val.toFixed(3)}</span>
    </div>
    <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;"></div>
    </div>
  </div>`;
}

// NEW: Render a 2×2 or 3×3 confusion matrix as an annotated heatmap
function _psyConfusionHtml(matrix, rowLabels, colLabels, title) {
  const total = matrix.flat().reduce((s,v)=>s+v,0);
  const maxVal = Math.max(...matrix.flat(), 1);
  const rows = matrix.length;
  const cols = colLabels.length;
  const cellSize = rows===3 ? 80 : 100;

  const cells = matrix.map((row,i)=>
    `<div style="display:flex;">${row.map((v,j)=>{
      const isDiag = i===j;
      const pct = total>0 ? (v/total*100).toFixed(1) : '0.0';
      const intensity = maxVal>0 ? v/maxVal : 0;
      const bg = isDiag
        ? `rgba(46,201,138,${(0.12+intensity*0.55).toFixed(2)})`
        : v===0 ? 'rgba(255,255,255,0.02)'
        : `rgba(239,68,68,${(intensity*0.45).toFixed(2)})`;
      const tc = intensity>0.3||isDiag ? 'rgba(232,240,248,0.95)' : _C.dim;
      return `<div style="width:${cellSize}px;height:${cellSize}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
                           background:${bg};border:1px solid rgba(255,255,255,0.05);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:${rows===3?'1.1':'1.35'}rem;font-weight:700;color:${tc};">${v.toLocaleString()}</div>
        <div style="font-size:0.68rem;color:${tc};opacity:0.75;">${pct}%</div>
      </div>`;
    }).join('')}</div>`
  ).join('');

  const colHeader = `<div style="display:flex;margin-left:${cellSize}px;">
    ${colLabels.map(l=>`<div style="width:${cellSize}px;text-align:center;padding:6px 2px;font-size:0.76rem;color:${_C.muted};">${l}</div>`).join('')}
  </div>`;
  const rowsWithLabel = matrix.map((row,i)=>
    `<div style="display:flex;align-items:center;">
      <div style="width:${cellSize}px;text-align:right;padding-right:10px;font-size:0.76rem;color:${_C.muted};">${rowLabels[i]}</div>
      ${row.map((v,j)=>{
        const isDiag=i===j;
        const pct=total>0?(v/total*100).toFixed(1):'0.0';
        const intensity=maxVal>0?v/maxVal:0;
        const bg=isDiag?`rgba(46,201,138,${(0.12+intensity*0.55).toFixed(2)})`:v===0?'rgba(255,255,255,0.02)':`rgba(239,68,68,${(intensity*0.45).toFixed(2)})`;
        const tc=intensity>0.3||isDiag?'rgba(232,240,248,0.95)':_C.dim;
        return `<div style="width:${cellSize}px;height:${cellSize}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
                             background:${bg};border:1px solid rgba(255,255,255,0.05);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:${rows===3?'1.1':'1.35'}rem;font-weight:700;color:${tc};">${v.toLocaleString()}</div>
          <div style="font-size:0.68rem;color:${tc};opacity:0.75;">${pct}%</div>
        </div>`;
      }).join('')}
    </div>`
  ).join('');

  return `
    <div style="margin-bottom:12px;">
      <div style="font-size:0.70rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:6px;">${title}</div>
      <div style="font-size:0.72rem;color:${_C.dim};margin-bottom:8px;">Predicted (columns) × Actual (rows) · n=${total.toLocaleString()}</div>
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;padding-bottom:2px;margin-left:${cellSize}px;">
          <div style="font-size:0.72rem;color:${_C.dim};letter-spacing:0.1em;text-transform:uppercase;">Predicted →</div>
        </div>
        ${colHeader}
        ${rowsWithLabel}
      </div>
    </div>`;
}

// NEW: Render an ROC curve as inline SVG
function _psyRocSvg(points, auc, W, H) {
  if (!points || points.length < 2) return `<div style="text-align:center;padding:20px;font-size:0.82rem;color:${_C.dim};">Insufficient data for ROC curve.</div>`;
  const pad=28;
  const plotW=W-pad*2, plotH=H-pad*2;
  const toX=fpr=>pad+(fpr*plotW);
  const toY=tpr=>pad+plotH-(tpr*plotH);

  const pathD = points.map((p,i)=>`${i===0?'M':'L'}${toX(p.fpr).toFixed(1)},${toY(p.tpr).toFixed(1)}`).join('');
  const fillD = pathD + `L${toX(1)},${toY(0)}L${toX(0)},${toY(0)}Z`;

  const aucColor = auc>=0.80?_C.green:auc>=0.70?_C.amber:_C.red;
  const ticksX=[0,0.25,0.5,0.75,1], ticksY=[0,0.25,0.5,0.75,1];

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:6px;overflow:hidden;">
      <!-- grid lines -->
      ${ticksX.map(v=>`<line x1="${toX(v).toFixed(1)}" y1="${pad}" x2="${toX(v).toFixed(1)}" y2="${pad+plotH}" stroke="${_C.border}" stroke-width="0.7"/>`).join('')}
      ${ticksY.map(v=>`<line x1="${pad}" y1="${toY(v).toFixed(1)}" x2="${pad+plotW}" y2="${toY(v).toFixed(1)}" stroke="${_C.border}" stroke-width="0.7"/>`).join('')}
      <!-- diagonal chance line -->
      <line x1="${toX(0)}" y1="${toY(0)}" x2="${toX(1)}" y2="${toY(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
      <!-- AUC fill -->
      <path d="${fillD}" fill="${aucColor}" opacity="0.12"/>
      <!-- ROC curve -->
      <path d="${pathD}" fill="none" stroke="${aucColor}" stroke-width="2.2"/>
      <!-- axes -->
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad+plotH}" stroke="${_C.border}" stroke-width="1"/>
      <line x1="${pad}" y1="${pad+plotH}" x2="${pad+plotW}" y2="${pad+plotH}" stroke="${_C.border}" stroke-width="1"/>
      <!-- tick labels -->
      ${ticksX.map(v=>`<text x="${toX(v).toFixed(1)}" y="${pad+plotH+14}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('')}
      ${ticksY.map(v=>`<text x="${pad-4}" y="${toY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('')}
      <!-- axis labels -->
      <text x="${pad+plotW/2}" y="${H-2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">False Positive Rate (1−Specificity)</text>
      <text x="9" y="${pad+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,9,${pad+plotH/2})">True Positive Rate (Sensitivity)</text>
      <!-- AUC label -->
      <text x="${pad+plotW-4}" y="${pad+14}" fill="${aucColor}" font-size="10" text-anchor="end" font-family="IBM Plex Mono" font-weight="bold">AUC = ${auc.toFixed(3)}</text>
    </svg>`;
}

// NEW: Compute ROC curve from (score, binaryLabel) arrays
// score: continuous predictor (higher = predicted adherent)
// label: 1 = positive class (non-adherent at T2), 0 = negative
function _psyComputeRoc(scores, labels) {
  if (scores.length < 10) return { points:[], auc:0.5 };
  const n = scores.length;
  const uniqueThresholds = [...new Set(scores)].sort((a,b)=>a-b);
  const points = [];
  const posTotal = labels.filter(l=>l===1).length;
  const negTotal = labels.filter(l=>l===0).length;
  if (!posTotal || !negTotal) return { points:[], auc:0.5 };

  for (const t of uniqueThresholds) {
    const tp = scores.filter((s,i)=>s<t&&labels[i]===1).length;
    const fp = scores.filter((s,i)=>s<t&&labels[i]===0).length;
    points.push({ fpr: fp/negTotal, tpr: tp/posTotal });
  }
  points.unshift({fpr:0,tpr:0});
  points.push({fpr:1,tpr:1});
  points.sort((a,b)=>a.fpr-b.fpr||(a.tpr-b.tpr));

  let auc=0;
  for(let i=1;i<points.length;i++)
    auc+=(points[i].fpr-points[i-1].fpr)*(points[i].tpr+points[i-1].tpr)/2;

  return { points, auc: Math.max(0, Math.min(1, auc)) };
}

// NEW: Compute extended classification metrics
function _psyClassMetrics(TP, FP, FN, TN) {
  const n = TP+FP+FN+TN;
  const sens   = (TP+FN)>0 ? TP/(TP+FN) : null;
  const spec   = (TN+FP)>0 ? TN/(TN+FP) : null;
  const ppv    = (TP+FP)>0 ? TP/(TP+FP) : null;
  const npv    = (TN+FN)>0 ? TN/(TN+FN) : null;
  const acc    = n>0 ? (TP+TN)/n : null;
  const f1     = (2*TP+FP+FN)>0 ? 2*TP/(2*TP+FP+FN) : null;
  const mccD   = Math.sqrt((TP+FP)*(TP+FN)*(TN+FP)*(TN+FN));
  const mcc    = mccD>0 ? (TP*TN-FP*FN)/mccD : null;
  const pe     = n>0 ? (((TP+FP)*(TP+FN)+(TN+FN)*(TN+FP))/(n*n)) : null;
  const kappa  = (pe!=null&&pe<1) ? ((acc-pe)/(1-pe)) : null;
  return { sens, spec, ppv, npv, acc, f1, mcc, kappa, n };
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — OVERVIEW TAB  (MMAS-8 and MAP)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyOverview(container, inst) {
  const d = _saPsyCache[inst];
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  if (d.insufficient) { _psyInsuf(container,d,instLabel); return; }

  if (inst === 'map') {
    // ── MAP Overview ──────────────────────────────────────────────────────────
    const sub = d.subscales;
    if (!sub) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">MAP subscale data unavailable.</div>`; return; }

    const meanPE   = _psyMean(sub.pe);
    const meanArch = _psyMean(sub.arch);
    const meanExec = _psyMean(sub.exec);
    const meanCtx  = _psyMean(sub.ctx);
    const peC = meanPE>=0.75?_C.green:meanPE>=0.50?_C.amber:_C.red;

    // PE zone breakdown
    const zones=[
      {l:'Critical',lo:0,    hi:0.40,c:'#ef4444'},
      {l:'Low',     lo:0.40, hi:0.55,c:'#f97316'},
      {l:'Moderate',lo:0.55, hi:0.70,c:'#f59e0b'},
      {l:'Good',    lo:0.70, hi:0.85,c:'#22c55e'},
      {l:'High',    lo:0.85, hi:1.01,c:'#10b981'},
    ];
    const zoneBars = zones.map(z=>{
      const cnt = sub.pe.filter(v=>v>=z.lo&&v<z.hi).length;
      const pct = sub.pe.length>0?(cnt/sub.pe.length*100):0;
      return `<div style="margin-bottom:9px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:0.82rem;color:${z.c};">${z.l}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">${pct.toFixed(1)}%</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct.toFixed(1)}%;background:${z.c};border-radius:3px;"></div>
        </div>
        <div style="font-size:0.70rem;color:${_C.dim};margin-top:2px;">${cnt.toLocaleString()} records</div>
      </div>`;
    }).join('');

    // INA/UNA quick classification
    const raw = d.raw || [];
    let inaC=0,unaC=0,mixC=0,adhC=0;
    raw.forEach(r=>{
      let ina=0,una=0;
      if ((+r.map_q2||0)<0.5) ina++;
      if ((+r.map_q3||0)<0.5) ina++;
      if ((+r.map_q6||0)<0.5) ina++;
      if ((+r.map_q1||0)<0.5) una++;
      if ((+r.map_q5||0)<0.5) una++;
      if ((+r.map_q8||0)<0.5) una++;
      if (ina===0&&una===0) adhC++;
      else if (ina>una) inaC++;
      else if (una>ina) unaC++;
      else mixC++;
    });
    const totalPat = raw.length||1;
    const patGroups=[
      {l:'Adherent',  n:adhC, c:_C.green},
      {l:'INA',       n:inaC, c:_C.red},
      {l:'UNA',       n:unaC, c:_C.amber},
      {l:'Mixed',     n:mixC, c:_C.purple},
    ];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
        ${_psyKpi('MAP PE (mean)', meanPE.toFixed(3), peC, 'Predictive Emergence')}
        ${_psyKpi('Architecture', meanArch.toFixed(3), _C.blue,   'Domain mean')}
        ${_psyKpi('Execution',    meanExec.toFixed(3), _C.purple, 'Domain mean')}
        ${_psyKpi('Context',      meanCtx.toFixed(3),  _C.green,  'Domain mean (guarded)')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">PE Zone Distribution — n=${d.n.toLocaleString()}</div>
          ${zoneBars}
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Adherence Pattern Classification</div>
          ${patGroups.map(g=>{
            const pct=totalPat>0?(g.n/totalPat*100):0;
            return `<div style="margin-bottom:11px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:0.82rem;color:${g.c};">${g.l}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">${pct.toFixed(1)}% <span style="color:${_C.dim};font-size:0.74rem;">(${g.n})</span></span>
              </div>
              <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${pct.toFixed(1)}%;background:${g.c};border-radius:3px;"></div>
              </div>
            </div>`;
          }).join('')}
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.76rem;color:${_C.dim};line-height:1.6;">
            INA = Intentional Non-Adherence (Architecture items low) ·
            UNA = Unintentional Non-Adherence (Execution items low) ·
            Mixed = both domains impaired.
          </div>
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">MAP Framework Summary</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
          <div><span style="color:${_C.text};">MAP vs MMAS-8</span><br>MAP uses the same 8 items as MMAS-8 but scores them across three behavioral domains rather than a single composite. This reveals <em>why</em> adherence breaks down, not just whether it does.</div>
          <div><span style="color:${_C.text};">PE — Non-Compensatory Design</span><br>PE = (Architecture × Execution × Context)^(1/3). A geometric mean ensures that a single low domain depresses the overall score — high beliefs cannot mask poor execution.</div>
          <div><span style="color:${_C.text};">Clinical Routing</span><br>INA patients respond to motivational approaches targeting beliefs. UNA patients benefit from reminder systems and routine scaffolding. Mixed patterns need multi-modal intervention.</div>
        </div>
      </div>`;

  } else {
    // ── MMAS-8 Overview ───────────────────────────────────────────────────────
    const lowN  = d.scoreDist.slice(0,6).reduce((s,v)=>s+v,0);
    const medN  = d.scoreDist[6]+(d.scoreDist[7]||0);
    const highN = d.scoreDist[8]||0;
    const semC  = _C.cyan;
    const alpC  = d.alpha>=0.80?_C.green:d.alpha>=0.70?_C.amber:_C.red;
    const cols9 = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#2ec98a','#2ec98a'];
    const maxBin = Math.max(...d.scoreDist,1);

    const cats=[
      {l:'Low Adherence',    n:lowN,  pct:d.n>0?(lowN/d.n*100):0,  c:'#ef4444', range:'Score 0–5'},
      {l:'Medium Adherence', n:medN,  pct:d.n>0?(medN/d.n*100):0,  c:'#f59e0b', range:'Score 6–7'},
      {l:'High Adherence',   n:highN, pct:d.n>0?(highN/d.n*100):0, c:'#10b981', range:'Score 8'},
    ];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
        ${_psyKpi('Assessments', d.n.toLocaleString(), _C.text, 'Total MMAS-8 records')}
        ${_psyKpi('Mean Score', d.totalMean.toFixed(2), d.totalMean>=6?_C.green:d.totalMean>=4?_C.amber:_C.red, `SD ${d.totalSD.toFixed(2)} · scale 0–8`)}
        ${_psyKpi('High Adherence', (d.n>0?(highN/d.n*100):0).toFixed(1)+'%', _C.green, 'Score = 8')}
        ${_psyKpi('Cronbach α', d.alpha.toFixed(3), alpC, 'Internal consistency')}
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Score Distribution (0–8)</div>
          <div style="display:flex;align-items:flex-end;gap:5px;height:110px;margin-bottom:8px;">
            ${d.scoreDist.map((cnt,s)=>{
              const h=Math.max(2,(cnt/maxBin)*110);
              const pct=d.n>0?(cnt/d.n*100).toFixed(1):'0.0';
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
                <div style="font-size:0.64rem;color:${_C.dim};">${pct}%</div>
                <div title="Score ${s}: ${cnt.toLocaleString()} (${pct}%)"
                     style="width:100%;height:${h}px;background:${cols9[s]};border-radius:2px 2px 0 0;opacity:0.85;"></div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:5px;">
            ${d.scoreDist.map((_,s)=>`<div style="flex:1;text-align:center;font-size:0.70rem;color:${_C.dim};">${s}</div>`).join('')}
          </div>
          <div style="font-size:0.78rem;color:${_C.dim};margin-top:10px;">
            Mean <span style="color:${_C.text};">${d.totalMean.toFixed(2)}</span> ·
            SD <span style="color:${_C.text};">${d.totalSD.toFixed(2)}</span> ·
            SEM <span style="color:${_C.text};">${d.sem.toFixed(3)}</span> ·
            95% CI ±<span style="color:${_C.text};">${(1.96*d.sem).toFixed(2)}</span>
          </div>
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Adherence Categories</div>
          ${cats.map(c=>`
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span style="font-size:0.82rem;color:${c.c};">${c.l}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.text};">${c.pct.toFixed(1)}%</span>
              </div>
              <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${c.pct.toFixed(1)}%;background:${c.c};border-radius:3px;"></div>
              </div>
              <div style="font-size:0.70rem;color:${_C.dim};margin-top:3px;">${c.n.toLocaleString()} records · ${c.range}</div>
            </div>`).join('')}
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.76rem;color:${_C.dim};line-height:1.6;">
            MMAS-8 cutoffs: High ≥ 8 · Medium 6–7 · Low &lt; 6
          </div>
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">About MMAS-8</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
          <div><span style="color:${_C.text};">Instrument</span><br>The 8-item Morisky Medication Adherence Scale (MMAS-8) is a validated self-report instrument producing a single composite score (0–8). It assesses both forgetting behaviors and intentional dose-skipping.</div>
          <div><span style="color:${_C.text};">Psychometric quality (this cohort)</span><br>α = ${d.alpha.toFixed(3)} — ${d.alpha>=0.80?'meets accepted threshold for internal consistency.':d.alpha>=0.70?'marginally acceptable.':'below threshold — review item distributions.'} SEM of ${d.sem.toFixed(3)} implies score uncertainty of ±${(1.96*d.sem).toFixed(2)} at 95% confidence.</div>
          <div><span style="color:${_C.text};">Next steps</span><br>Explore the Psychometrics group for item-level quality analysis, IRT parameters, and factor structure. Use the Validity group to assess predictive and criterion validity with MAP and PEACS.</div>
        </div>
      </div>`;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// RELIABILITY  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyReliability(container) {
  const d = _saPsyCache[_saPsyInstrument];
  const instLabel = _saPsyInstrument === 'map' ? 'MAP' : 'MMAS-8';
  if (d.insufficient) { _psyInsuf(container,d,instLabel); return; }

  const ac=d.alpha>=0.80?_C.green:d.alpha>=0.70?_C.amber:_C.red;
  const oc=d.omega>=0.80?_C.green:d.omega>=0.70?_C.amber:_C.red;
  const sc=d.splitHalf>=0.80?_C.green:d.splitHalf>=0.70?_C.amber:_C.red;
  const cols9=['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#2ec98a','#2ec98a'];
  const maxBin=Math.max(...d.scoreDist,1);

  const mapSubRow = d.subscales ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid ${_C.border};">
      ${[
        ['Architecture', d.subscales.arch, _C.blue],
        ['Execution',    d.subscales.exec, _C.purple],
        ['Context',      d.subscales.ctx,  _C.green],
        ['PE Score',     d.subscales.pe,   _C.amber],
      ].map(([l,arr,c])=>{
        const m=arr.length?_psyMean(arr):null;
        return `<div style="text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${c};">${m!=null?m.toFixed(3):'—'}</div>
          <div style="font-size:0.76rem;color:${_C.dim};margin-top:3px;">${l} mean</div>
          <div style="font-size:0.72rem;color:${_C.dim};">n=${arr.length.toLocaleString()}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      ${_psyKpi('Cronbach α',    d.alpha.toFixed(3),    ac, 'Internal consistency')}
      ${_psyKpi("McDonald's ω",  d.omega.toFixed(3),    oc, 'Factor model reliability')}
      ${_psyKpi('Split-Half',    d.splitHalf.toFixed(3),sc, 'Spearman-Brown corrected')}
      ${_psyKpi('SEM',           d.sem.toFixed(3),      _C.cyan,'Std error (0–8 scale)')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">${instLabel} Reliability Profile</div>
        ${_psyGauge('Cronbach α',       d.alpha,    ac)}
        ${_psyGauge("McDonald's ω",     d.omega,    oc)}
        ${_psyGauge('Split-Half (S-B)', d.splitHalf,sc)}
        ${mapSubRow}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid ${_C.border};font-size:0.78rem;color:${_C.dim};line-height:1.65;">
          Thresholds: <span style="color:${_C.green};">≥ 0.80</span> good ·
          <span style="color:${_C.amber};">0.70–0.79</span> acceptable ·
          <span style="color:${_C.red};">< 0.70</span> poor · n = ${d.n.toLocaleString()}
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Score Distribution (0–8)</div>
        <div style="display:flex;align-items:flex-end;gap:5px;height:90px;margin-bottom:8px;">
          ${d.scoreDist.map((cnt,s)=>{
            const h=Math.max(2,(cnt/maxBin)*90);
            const pct=(d.n>0?(cnt/d.n*100):0).toFixed(1);
            return `<div style="flex:1;" title="Score ${s}: ${cnt.toLocaleString()} (${pct}%)">
              <div style="width:100%;height:${h}px;background:${cols9[s]};border-radius:2px 2px 0 0;opacity:0.85;cursor:default;"></div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:5px;">
          ${d.scoreDist.map((_,s)=>`<div style="flex:1;text-align:center;font-size:0.70rem;color:${_C.dim};">${s}</div>`).join('')}
        </div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-top:10px;">
          Mean <span style="color:${_C.text};">${d.totalMean.toFixed(2)}</span> ·
          SD <span style="color:${_C.text};">${d.totalSD.toFixed(2)}</span> ·
          95% CI ±<span style="color:${_C.text};">${(1.96*d.sem).toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">Clinical Interpretation</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;font-size:0.82rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};font-weight:600;">Cronbach's α = ${d.alpha.toFixed(3)}</span><br>
          ${d.alpha>=0.80?'Meets the ≥ 0.80 threshold for acceptable internal consistency.':d.alpha>=0.70?'Marginally acceptable. Some heterogeneity may reflect the multi-behavioral nature of adherence.':'Below accepted threshold. Review item distributions and floor/ceiling effects.'}
        </div>
        <div><span style="color:${_C.text};font-weight:600;">McDonald's ω = ${d.omega.toFixed(3)}</span><br>
          More precise under non-tau-equivalent conditions. Values close to α indicate approximate tau-equivalence.
        </div>
        <div><span style="color:${_C.text};font-weight:600;">SEM = ${d.sem.toFixed(3)}</span><br>
          95% confidence interval spans ±${(1.96*d.sem).toFixed(2)} points on the 0–8 scale. Scores near category boundaries warrant cautious interpretation.
        </div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// ITEM ANALYSIS  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyItems(container) {
  const d = _saPsyCache[_saPsyInstrument];
  const inst = _saPsyInstrument;
  const labels = inst === 'map' ? _MAP_LABELS : _MMAS_LABELS;
  const shorts = inst === 'map' ? _MAP_SHORT  : _MMAS_SHORT;
  if (d.insufficient) { _psyInsuf(container,d,inst==='map'?'MAP':'MMAS-8'); return; }

  const rows = labels.map((lbl,j)=>{
    const p=d.itemMeans[j],sd=d.itemSDs[j],rit=d.rIT[j],disc=d.discrimD[j];
    const pc=p>=0.85?_C.green:p>=0.60?_C.amber:_C.red;
    const rc=rit>=0.40?_C.green:rit>=0.25?_C.amber:_C.red;
    const dc=disc>=0.30?_C.green:disc>=0.20?_C.amber:_C.red;
    return `<tr style="border-bottom:1px solid ${_C.border};">
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.amber};">${shorts[j]}</td>
      <td style="padding:10px 14px;font-size:0.80rem;color:${_C.muted};">${_saEsc(lbl)}</td>
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${pc};text-align:right;">${(p*100).toFixed(1)}%</td>
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.muted};text-align:right;">${sd.toFixed(3)}</td>
      <td style="padding:10px 14px;text-align:right;">
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
          <div style="width:56px;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${Math.max(0,rit*100).toFixed(1)}%;background:${rc};"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${rc};">${rit.toFixed(3)}</span>
        </div>
      </td>
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${dc};text-align:right;">${disc.toFixed(3)}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">
        ${inst==='map'?'MAP':'MMAS-8'} Item Statistics — n = ${d.n.toLocaleString()}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:2px solid ${_C.borderB};">
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Item</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Content</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;white-space:nowrap;">p (Adherent)</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;">SD</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;white-space:nowrap;">r<sub>it</sub> corrected</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;white-space:nowrap;">Disc. Index</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Threshold Reference</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">p — Adherence Rate</span><br>Items near 0.50 maximise discrimination. Extreme values compress variance and reduce reliability estimates.</div>
        <div><span style="color:${_C.text};">r<sub>it</sub> — Corrected Item-Total r</span><br><span style="color:${_C.green};">≥ 0.40</span> good · <span style="color:${_C.amber};">0.25–0.39</span> acceptable · <span style="color:${_C.red};">&lt; 0.25</span> problematic.</div>
        <div><span style="color:${_C.text};">D — Discrimination Index</span><br><span style="color:${_C.green};">≥ 0.30</span> good · <span style="color:${_C.amber};">0.20–0.29</span> marginal · <span style="color:${_C.red};">&lt; 0.20</span> poor. Upper/lower 27% contrast (Kelley, 1939).</div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// FACTOR STRUCTURE  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyFactor(container) {
  const d = _saPsyCache[_saPsyInstrument];
  const inst = _saPsyInstrument;
  const labels = inst === 'map' ? _MAP_LABELS : _MMAS_LABELS;
  const shorts = inst === 'map' ? _MAP_SHORT  : _MMAS_SHORT;
  if (d.insufficient) { _psyInsuf(container,d,inst==='map'?'MAP':'MMAS-8'); return; }

  const maxL=Math.max(...d.loadings.map(Math.abs),0.001);
  const mapSubColor = j => j===6?_C.green:[1,2,5].includes(j)?_C.blue:_C.purple;

  const loadingBars=labels.map((lbl,j)=>{
    const l=d.loadings[j];
    const pct=(Math.abs(l)/maxL*100).toFixed(1);
    const lc=inst==='map'?mapSubColor(j):(Math.abs(l)>=0.60?_C.green:Math.abs(l)>=0.40?_C.amber:_C.red);
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
      <div style="width:28px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.amber};flex-shrink:0;">${shorts[j]}</div>
      <div style="flex:1;height:12px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${lc};opacity:0.80;"></div>
      </div>
      <div style="width:48px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${lc};text-align:right;flex-shrink:0;">${l.toFixed(3)}</div>
      <div style="width:190px;font-size:0.78rem;color:${_C.dim};flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_saEsc(lbl)}</div>
    </div>`;
  }).join('');

  const mapLegend = inst==='map' ? `
    <div style="display:flex;gap:14px;margin-top:10px;font-size:0.78rem;">
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;border-radius:2px;background:${_C.blue};"></div>Architecture (Q2,Q3,Q6)</div>
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;border-radius:2px;background:${_C.purple};"></div>Execution (Q1,Q5,Q8)</div>
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;border-radius:2px;background:${_C.green};"></div>Context (Q4,Q7)</div>
    </div>` : '';

  const C=36;
  const heatHeader=`<div style="display:flex;margin-left:${C}px;">${shorts.map(s=>`<div style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:${_C.dim};">${s}</div>`).join('')}</div>`;
  const heatRows=d.corrMatrix.map((row,i)=>{
    const cells=row.map((r,j)=>{
      const intensity=Math.abs(r);
      const bg=i===j?'rgba(212,168,67,0.20)':r>=0?`hsla(142,55%,48%,${(intensity*0.75).toFixed(2)})`:`hsla(0,60%,50%,${(intensity*0.75).toFixed(2)})`;
      const tc=intensity>0.35||i===j?'rgba(240,245,250,0.92)':_C.dim;
      return `<div title="${shorts[i]}×${shorts[j]} = ${r.toFixed(3)}" style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;background:${bg};font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${tc};cursor:default;">${i===j?'–':r.toFixed(2)}</div>`;
    }).join('');
    return `<div style="display:flex;"><div style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:${_C.dim};">${shorts[i]}</div>${cells}</div>`;
  }).join('');

  const modelNote = inst==='map'
    ? 'MAP is structured around 3 latent domains: Architecture (structural capacity), Execution (behavioral execution), and Context (situational support). A 3-factor CFA model with correlated factors is the theoretically motivated structure.'
    : 'MMAS-8 is designed as a unidimensional scale. Literature supports a dominant F1 explaining ~40–50% of variance, with possible method effects on negatively-keyed items (Q1, Q2, Q4).';

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Factor Loadings (Single-Factor Approximation)</div>
          ${loadingBars}
          ${mapLegend}
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.78rem;color:${_C.dim};line-height:1.6;">
            r<sub>it</sub> × √α · Mean inter-item r = <span style="color:${_C.text};">${d.avgInterCorr.toFixed(3)}</span><br>
            <span style="color:${_C.green};">≥ 0.60</span> strong · <span style="color:${_C.amber};">0.40–0.59</span> moderate
          </div>
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Model Notes</div>
          <div style="font-size:0.80rem;color:${_C.muted};line-height:1.65;">${modelNote}<br><br>
            For publication-grade fit indices run a full CFA with polychoric correlations. These are Pearson-based approximations from n = ${d.n.toLocaleString()} records.
          </div>
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Inter-Item Correlation Matrix</div>
        <div style="overflow-x:auto;">${heatHeader}${heatRows}</div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:10px;font-size:0.78rem;color:${_C.dim};">
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:14px;border-radius:2px;background:hsla(142,55%,48%,0.75);"></div>Positive</div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:14px;border-radius:2px;background:hsla(0,60%,50%,0.75);"></div>Negative</div>
          <span>Intensity ∝ |r|</span>
        </div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// IRT PARAMETERS  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyIRT(container) {
  const d = _saPsyCache[_saPsyInstrument];
  const inst = _saPsyInstrument;
  const labels = inst === 'map' ? _MAP_LABELS : _MMAS_LABELS;
  const shorts = inst === 'map' ? _MAP_SHORT  : _MMAS_SHORT;
  if (d.insufficient) { _psyInsuf(container,d,inst==='map'?'MAP':'MMAS-8'); return; }

  const colors=[_C.blue,_C.purple,_C.green,_C.cyan,_C.amber,'#f97316',_C.red,'rgba(138,160,184,0.8)'];

  function iccPath(a,b,W,H){
    const pts=[];
    for(let x=0;x<=W;x+=2){const theta=(x/W)*6-3;const p=1/(1+Math.exp(-a*(theta-b)));pts.push(x.toFixed(1)+','+(H-p*H).toFixed(1));}
    return 'M'+pts.join('L');
  }

  const W500=500,H160=160;
  const allPaths=labels.map((_,j)=>`<path d="${iccPath(d.irtA[j],d.irtB[j],W500,H160)}" fill="none" stroke="${colors[j]}" stroke-width="1.8" opacity="0.9"/>`).join('');
  const legend=labels.map((_,j)=>`
    <div style="display:flex;align-items:center;gap:7px;">
      <div style="width:18px;height:2.5px;background:${colors[j]};border-radius:1px;flex-shrink:0;"></div>
      <span style="font-size:0.78rem;color:${_C.muted};">${shorts[j]} — ${_saEsc(labels[j].replace(/ \[.*?\]/,'').substring(0,30))}</span>
    </div>`).join('');

  const tableRows=labels.map((lbl,j)=>{
    const a=d.irtA[j],b=d.irtB[j];
    const W=120,H=54;
    const ac=a>=1.5?_C.green:a>=0.8?_C.amber:_C.red;
    const bc=Math.abs(b)<=1?_C.green:Math.abs(b)<=2?_C.amber:_C.red;
    return `<tr style="border-bottom:1px solid ${_C.border};">
      <td style="padding:9px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${colors[j]};">${shorts[j]}</td>
      <td style="padding:9px 14px;font-size:0.80rem;color:${_C.muted};">${_saEsc(lbl.replace(/ \[.*?\]/,''))}</td>
      <td style="padding:9px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${ac};text-align:right;">${a.toFixed(3)}</td>
      <td style="padding:9px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${bc};text-align:right;">${b.toFixed(3)}</td>
      <td style="padding:9px 14px;text-align:center;">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:3px;">
          <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="${_C.border}" stroke-width="0.7"/>
          <line x1="${W/2}" y1="0" x2="${W/2}" y2="${H}" stroke="${_C.border}" stroke-width="0.7"/>
          <path d="${iccPath(a,b,W,H)}" fill="none" stroke="${colors[j]}" stroke-width="2.2"/>
        </svg>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 310px;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:4px;">Item Characteristic Curves — 2PL Model</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:12px;">Latent adherence θ (−3 to +3) · P(adherent) on y-axis</div>
        <svg width="100%" height="${H160}" viewBox="0 0 ${W500} ${H160}" style="display:block;background:rgba(255,255,255,0.02);border-radius:6px;overflow:hidden;">
          <line x1="0" y1="${H160/2}" x2="${W500}" y2="${H160/2}" stroke="${_C.border}" stroke-width="1"/>
          <line x1="${W500/2}" y1="0" x2="${W500/2}" y2="${H160}" stroke="${_C.border}" stroke-width="1"/>
          <text x="6" y="${H160-4}" fill="${_C.dim}" font-size="9" font-family="IBM Plex Mono">θ = −3</text>
          <text x="${W500/2-6}" y="${H160-4}" fill="${_C.dim}" font-size="9" font-family="IBM Plex Mono">0</text>
          <text x="${W500-36}" y="${H160-4}" fill="${_C.dim}" font-size="9" font-family="IBM Plex Mono">+3</text>
          <text x="4" y="10" fill="${_C.dim}" font-size="9" font-family="IBM Plex Mono">1.0</text>
          <text x="4" y="${H160/2+4}" fill="${_C.dim}" font-size="9" font-family="IBM Plex Mono">0.5</text>
          ${allPaths}
        </svg>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Items</div>
        <div style="display:flex;flex-direction:column;gap:9px;">${legend}</div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${_C.border};font-size:0.78rem;color:${_C.dim};line-height:1.65;">
          <span style="color:${_C.text};">a</span> — discrimination<br>
          <span style="color:${_C.text};">b</span> — difficulty (logit)<br><br>
          2PL approximated from empirical p-values and corrected r<sub>it</sub>.
        </div>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">IRT Parameter Table — n = ${d.n.toLocaleString()}</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:2px solid ${_C.borderB};">
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Item</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Content</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;white-space:nowrap;">a (Discrimination)</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;white-space:nowrap;">b (Difficulty)</th>
            <th style="padding:8px 14px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:center;font-weight:400;">ICC</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:14px;padding-top:12px;border-top:1px solid ${_C.border};font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">Discrimination (a)</span> — Steepness of ICC. <span style="color:${_C.green};">≥ 1.5</span> high · <span style="color:${_C.amber};">0.8–1.5</span> moderate · <span style="color:${_C.red};">&lt; 0.8</span> low.</div>
        <div><span style="color:${_C.text};">Difficulty (b)</span> — ICC location on latent scale. Negative = frequently endorsed (easy); positive = rarely endorsed. Logit units, range −3 to +3.</div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — MAP DOMAINS TAB
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyMapDomains(container, sub) {
  switch (sub) {
    case 'radar':      _saPsyMapDomainRadar(container);     break;
    case 'limitation': _saPsyMapDomainLimitation(container); break;
    case 'noncomp':    _saPsyMapDomainNonComp(container);   break;
    case 'q8':         _saPsyMapDomainQ8(container);        break;
    default:           _saPsyMapDomainRadar(container);
  }
}

function _saPsyMapDomainRadar(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.subscales) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }
  const sub = d.subscales;
  const mA = _psyMean(sub.arch), mE = _psyMean(sub.exec), mC = _psyMean(sub.ctx);
  const mPE = _psyMean(sub.pe);

  // SVG radar — equilateral triangle axes
  const W=260,H=260,cx=130,cy=130,R=100;
  const angles = [-90, 30, 150]; // top=Architecture, bottom-right=Execution, bottom-left=Context
  const toXY = (val,ai) => {
    const rad = angles[ai]*Math.PI/180;
    return { x: cx + val*R*Math.cos(rad), y: cy + val*R*Math.sin(rad) };
  };

  // Grid rings
  const rings = [0.25,0.5,0.75,1.0].map(r=>{
    const pts = angles.map(a=>{const rad=a*Math.PI/180;return `${(cx+r*R*Math.cos(rad)).toFixed(1)},${(cy+r*R*Math.sin(rad)).toFixed(1)}`;}).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="${_C.border}" stroke-width="0.8"/>`;
  }).join('');

  // Axis lines
  const axisLines = angles.map(a=>{
    const rad=a*Math.PI/180;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(rad)).toFixed(1)}" y2="${(cy+R*Math.sin(rad)).toFixed(1)}" stroke="${_C.border}" stroke-width="1"/>`;
  }).join('');

  // Optimal reference polygon (1.0, 1.0, 1.0)
  const refPts = angles.map((a,i)=>{const p=toXY(1,i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ');

  // Cohort polygon
  const vals = [mA, mE, mC];
  const cohortPts = angles.map((a,i)=>{const p=toXY(vals[i],i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ');

  // Axis labels
  const axLabels = [
    {l:'Architecture', a:-90, dx:0, dy:-12, c:_C.blue},
    {l:'Execution',    a:30,  dx:12, dy:6,  c:_C.purple},
    {l:'Context',      a:150, dx:-12,dy:6,  c:_C.green},
  ].map(({l,a,dx,dy,c})=>{
    const rad=a*Math.PI/180;
    const x=(cx+(R+22)*Math.cos(rad)+dx).toFixed(1);
    const y=(cy+(R+22)*Math.sin(rad)+dy).toFixed(1);
    return `<text x="${x}" y="${y}" fill="${c}" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">${l}</text>`;
  }).join('');

  // Tick labels
  const tickLabels = [0.25,0.5,0.75,1.0].map(r=>{
    const x=(cx+r*R*Math.cos(-90*Math.PI/180)-14).toFixed(1);
    const y=(cy+r*R*Math.sin(-90*Math.PI/180)).toFixed(1);
    return `<text x="${x}" y="${y}" fill="${_C.dim}" font-size="8" text-anchor="end" font-family="IBM Plex Mono">${r.toFixed(2)}</text>`;
  }).join('');

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start;margin-bottom:20px;">
      <div class="sa-panel" style="min-width:280px;">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">MAP Domain Radar</div>
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible;">
          ${rings}${axisLines}
          <polygon points="${refPts}" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/>
          <polygon points="${cohortPts}" fill="rgba(212,168,67,0.15)" stroke="${_C.amber}" stroke-width="2"/>
          ${vals.map((v,i)=>{const p=toXY(v,i);return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${[_C.blue,_C.purple,_C.green][i]}" stroke="${_C.ink}" stroke-width="1.5"/>`;}).join('')}
          ${axLabels}${tickLabels}
        </svg>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:0.76rem;">
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:3px;background:${_C.amber};border-radius:1px;"></div>Cohort mean</div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:3px;background:rgba(255,255,255,0.2);border-radius:1px;stroke-dasharray:3,3;"></div>Optimal (1.0)</div>
        </div>
      </div>
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Domain Profile — n=${d.n.toLocaleString()}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:14px;">
            ${[['Architecture',mA,_C.blue,'Structural capacity — routines, systems, planning (Q2, Q3, Q6)'],
               ['Execution',mE,_C.purple,'Behavioral execution — action, self-monitoring, dose timing (Q1, Q5, Q8)'],
               ['Context',mC,_C.green,'Situational support — environment, access, competing factors (Q4, Q7) · guarded: [0.5,1.0]'],
               ['PE Score',mPE,_C.amber,'Predictive Emergence — geometric mean of all three domains']
              ].map(([l,v,c,desc])=>`
              <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:0.78rem;color:${c};font-weight:600;">${l}</span>
                  <span style="font-family:'IBM Plex Mono',monospace;font-size:1.0rem;font-weight:700;color:${c};">${v.toFixed(3)}</span>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-bottom:8px;">
                  <div style="height:100%;width:${(v*100).toFixed(1)}%;background:${c};border-radius:3px;"></div>
                </div>
                <div style="font-size:0.74rem;color:${_C.dim};line-height:1.5;">${desc}</div>
              </div>`).join('')}
          </div>
          <div style="font-size:0.78rem;color:${_C.dim};line-height:1.65;padding-top:10px;border-top:1px solid ${_C.border};">
            The radar shows where the cohort's mean domain scores fall relative to the optimal profile. Flattened polygons toward a single axis identify the dominant barrier type for this population.
            ${mA < mE && mA < mC ? `<br><span style="color:${_C.blue};">→ This cohort is Architecture-limited. Intervention should target beliefs and intentional decision-making.</span>` :
              mE < mA && mE < mC ? `<br><span style="color:${_C.purple};">→ This cohort is Execution-limited. Focus on habit formation, reminders, and routine scaffolding.</span>` :
              mC < mA && mC < mE ? `<br><span style="color:${_C.green};">→ This cohort is Context-limited. Address environmental barriers and situational support factors.</span>` :
              `<br><span style="color:${_C.amber};">→ All three domains are relatively balanced — no single dominant limitation type.</span>`}
          </div>
        </div>
      </div>
    </div>`;
}

function _saPsyMapDomainLimitation(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.raw) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }

  let archLim=0, execLim=0, ctxLim=0, balanced=0;
  (d.raw||[]).forEach(r=>{
    const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
    const minV = Math.min(a,e,c);
    const range = Math.max(a,e,c)-minV;
    if (range<0.05) balanced++;
    else if (minV===a) archLim++;
    else if (minV===e) execLim++;
    else ctxLim++;
  });
  const total = d.n||1;

  const types=[
    {l:'Architecture-limited',n:archLim,c:_C.blue,  desc:'Lowest in Architecture (Q2,Q3,Q6) — intentional barriers dominant. Patient has reduced belief in or motivation for consistent adherence. Approach: motivational interviewing, education on medication importance, shared decision-making.'},
    {l:'Execution-limited',   n:execLim,c:_C.purple,desc:'Lowest in Execution (Q1,Q5,Q8) — unintentional forgetting dominant. Patient is motivated but lacks reliable routines. Approach: reminder systems, dose organizers, habit-stacking with existing routines.'},
    {l:'Context-limited',     n:ctxLim, c:_C.green, desc:'Lowest in Context (Q4,Q7, guarded) — situational/environmental barriers dominant. Adherence is disrupted by external circumstances. Approach: environmental restructuring, travel planning, peer/social support.'},
    {l:'Balanced (all equal)', n:balanced,c:_C.dim,  desc:'No single domain is substantially lower than the others. May reflect overall adherence, or a uniformly distributed mixed pattern requiring comprehensive multi-modal support.'},
  ];

  container.innerHTML = `
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Domain Limitation Analysis — n=${total.toLocaleString()}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:18px;">
        ${types.map(t=>{
          const pct=total>0?(t.n/total*100):0;
          return `<div style="padding:14px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
              <span style="font-size:0.82rem;color:${t.c};font-weight:600;">${t.l}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:1.2rem;font-weight:700;color:${t.c};">${pct.toFixed(1)}%</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px;">
              <div style="height:100%;width:${pct.toFixed(1)}%;background:${t.c};border-radius:3px;"></div>
            </div>
            <div style="font-size:0.73rem;color:${_C.muted};margin-bottom:6px;">${t.n.toLocaleString()} records</div>
            <div style="font-size:0.76rem;color:${_C.dim};line-height:1.55;">${t.desc}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:0.78rem;color:${_C.dim};line-height:1.65;padding-top:10px;border-top:1px solid ${_C.border};">
        A record is classified by its <em>lowest</em> MAP domain score. Balanced = all three domains within 0.05 of each other. This analysis enables targeted, domain-matched intervention selection — the primary clinical utility of MAP over single-score instruments.
      </div>
    </div>`;
}

function _saPsyMapDomainNonComp(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }

  // Show 4 scenarios illustrating non-compensatory effect
  const scenarios = [
    {name:'Balanced',             a:0.80, e:0.80, c_raw:0.60},
    {name:'Execution collapse',   a:0.80, e:0.20, c_raw:0.60},
    {name:'Architecture collapse',a:0.10, e:0.80, c_raw:0.60},
    {name:'Context at floor',     a:0.80, e:0.80, c_raw:0.00},
  ];
  const rows = scenarios.map(s=>{
    const c_g = 0.5+0.5*s.c_raw;
    const simple = (s.a+s.e+c_g)/3;
    const pe = Math.pow(s.a*s.e*c_g,1/3);
    const gap = simple-pe;
    const gapC = gap>0.12?_C.red:gap>0.05?_C.amber:_C.green;
    return {name:s.name,a:s.a,e:s.e,c_raw:s.c_raw,c_g:c_g,simple:simple,pe:pe,gap:gap,gapC};
  });

  container.innerHTML = `
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Non-Compensatory Design — Geometric vs Arithmetic Mean</div>
      <div style="font-size:0.80rem;color:${_C.muted};margin-bottom:16px;line-height:1.65;">
        MAP PE uses a geometric mean: <span style="color:${_C.text};font-family:'IBM Plex Mono',monospace;">PE = (Architecture × Execution × Context<sub>guarded</sub>)^(1/3)</span><br>
        This is <strong style="color:${_C.text};">non-compensatory</strong> — a high score in one domain cannot offset a critically low score in another. Compare how PE and a simple arithmetic mean diverge as domains collapse.
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:2px solid ${_C.borderB};">
            <th style="padding:8px 14px;font-size:0.73rem;letter-spacing:0.10em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Scenario</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.blue};text-align:center;font-weight:400;">Arch (A)</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.purple};text-align:center;font-weight:400;">Exec (E)</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.green};text-align:center;font-weight:400;">Ctx raw → guarded</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.dim};text-align:center;font-weight:400;">Simple mean</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.amber};text-align:center;font-weight:400;">MAP PE</th>
            <th style="padding:8px 14px;font-size:0.73rem;text-transform:uppercase;color:${_C.dim};text-align:center;font-weight:400;">Difference</th>
          </tr></thead>
          <tbody>
            ${rows.map(r=>`<tr style="border-bottom:1px solid ${_C.border};">
              <td style="padding:12px 14px;font-size:0.82rem;color:${_C.text};">${r.name}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.blue};text-align:center;">${r.a.toFixed(2)}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.purple};text-align:center;">${r.e.toFixed(2)}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.green};text-align:center;">${r.c_raw.toFixed(2)} → ${r.c_g.toFixed(2)}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${_C.dim};text-align:center;">${r.simple.toFixed(3)}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:700;color:${_C.amber};text-align:center;">${r.pe.toFixed(3)}</td>
              <td style="padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${r.gapC};text-align:center;">−${r.gap.toFixed(3)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Context Guard — C<sub>guarded</sub> = 0.5 + 0.5 × C<sub>raw</sub></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">Why the guard?</span><br>Context items (Q4, Q7) measure situational factors that are often absent rather than negative — a patient travelling and a patient with ideal circumstances both get C_raw ≈ 0. Without the guard, PE would collapse to zero even for highly adherent patients who simply lack contextual barriers.</div>
        <div><span style="color:${_C.text};">Mathematical effect</span><br>C_raw ∈ [0, 1] maps to C_guarded ∈ [0.5, 1.0]. This sets a floor so that context can only attenuate PE by at most 21% (vs collapsing it to zero), preserving the signal from Architecture and Execution. See the Context Guard subtab in PEACS → Validation for a live visualization.</div>
      </div>
    </div>`;
}

function _saPsyMapDomainQ8(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.raw) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }

  // Q8 is "Rarely misses doses due to competing priorities [Execution]"
  // Scored 0–1, typically in ordinal steps: 0.0 / 0.25 / 0.50 / 0.75 / 1.0
  const q8vals = (d.raw||[]).map(r=>parseFloat(r.map_q8)||0).filter(v=>!isNaN(v));
  const ordinals = [
    {label:'Always misses',  v:0.00, c:'#ef4444'},
    {label:'Often misses',   v:0.25, c:'#f97316'},
    {label:'Sometimes',      v:0.50, c:'#f59e0b'},
    {label:'Rarely misses',  v:0.75, c:'#22c55e'},
    {label:'Never misses',   v:1.00, c:'#10b981'},
  ];
  const buckets = ordinals.map(o=>({...o, n:q8vals.filter(v=>Math.abs(v-o.v)<0.13).length}));
  const totalQ8 = q8vals.length||1;
  const meanQ8  = q8vals.length ? _psyMean(q8vals) : 0;
  const maxBucket = Math.max(...buckets.map(b=>b.n),1);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Q8 Distribution — "Rarely misses doses due to competing priorities"</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:120px;margin-bottom:10px;">
          ${buckets.map(b=>{
            const h=Math.max(4,(b.n/maxBucket)*120);
            const pct=(b.n/totalQ8*100).toFixed(1);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="font-size:0.68rem;color:${_C.dim};">${pct}%</div>
              <div title="${b.label}: ${b.n} (${pct}%)" style="width:100%;height:${h}px;background:${b.c};border-radius:3px 3px 0 0;opacity:0.85;cursor:default;"></div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          ${buckets.map(b=>`<div style="flex:1;text-align:center;font-size:0.64rem;color:${_C.dim};line-height:1.3;">${b.label}</div>`).join('')}
        </div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-top:12px;padding-top:10px;border-top:1px solid ${_C.border};">
          Mean Q8 = <span style="color:${meanQ8>=0.70?_C.green:meanQ8>=0.50?_C.amber:_C.red};font-family:'IBM Plex Mono',monospace;">${meanQ8.toFixed(3)}</span>
          · n = ${q8vals.length.toLocaleString()} records
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Q8 Clinical Significance</div>
        <div style="font-size:0.80rem;color:${_C.muted};line-height:1.65;">
          <div style="margin-bottom:10px;"><span style="color:${_C.text};">Why Q8 matters</span><br>
            Q8 is the <em>only ordinal item</em> in MMAS-8 and MAP. It asks directly about behavioral execution frequency — how often competing priorities disrupt medication-taking. This item is uniquely sensitive to lifestyle complexity and practical barriers.
          </div>
          <div style="margin-bottom:10px;"><span style="color:${_C.text};">Impact on Execution domain</span><br>
            Q8 contributes one third of the Execution (MVMT) score. In cohorts with low MAP PE, Q8 is often the primary Execution driver — a "sometimes misses" response alone drops Execution by ~0.17 points.
          </div>
          <div><span style="color:${_C.text};">Scoring</span><br>
            Never misses = 1.0 (optimal) · Rarely = 0.75 · Sometimes = 0.50 · Often = 0.25 · Always = 0.00. These map directly to the MMAS-8 Q8 ordinal scale with ordinal-to-numeric conversion.
          </div>
        </div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — MAP PATTERNS TAB
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyMapPatterns(container, sub) {
  switch (sub) {
    case 'inaua':          _saPsyMapPatternInaUna(container);         break;
    case 'classification': _saPsyMapPatternClassification(container); break;
    case 'drivers':        _saPsyMapPatternDrivers(container);        break;
    default:               _saPsyMapPatternInaUna(container);
  }
}

function _saPsyMapPatternInaUna(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.raw) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }

  let counts = {adherent:0, ina:0, una:0, mixed:0};
  (d.raw||[]).forEach(r=>{
    let ina=0, una=0;
    if ((+r.map_q2||0)<0.5) ina++;  // Architecture items
    if ((+r.map_q3||0)<0.5) ina++;
    if ((+r.map_q6||0)<0.5) ina++;
    if ((+r.map_q1||0)<0.5) una++;  // Execution items
    if ((+r.map_q5||0)<0.5) una++;
    if ((+r.map_q8||0)<0.5) una++;
    // Context items (Q4, Q7) excluded from INA/UNA classification
    if (ina===0&&una===0) counts.adherent++;
    else if (ina>una) counts.ina++;
    else if (una>ina) counts.una++;
    else counts.mixed++;
  });
  const total = d.n||1;

  const groups=[
    {key:'adherent',label:'Adherent',   c:_C.green,  desc:'No Architecture or Execution items below threshold. Consistent medication-taking across all behavioral domains.'},
    {key:'ina',     label:'INA',        c:_C.red,    desc:'Intentional Non-Adherence — Architecture items (Q2, Q3, Q6) predominantly low. Patient is deliberately skipping or stopping medication. Requires motivational and belief-change interventions.'},
    {key:'una',     label:'UNA',        c:_C.amber,  desc:'Unintentional Non-Adherence — Execution items (Q1, Q5, Q8) predominantly low. Patient is motivated but forgets or has poor routines. Responds to reminder systems and habit scaffolding.'},
    {key:'mixed',   label:'Mixed',      c:_C.purple, desc:'Both INA and UNA items equally impaired. Complex presentation requiring comprehensive assessment. Consider combined motivational + behavioral support.'},
  ];

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">INA / UNA Distribution — n=${total.toLocaleString()}</div>
        ${groups.map(g=>{
          const pct=total>0?(counts[g.key]/total*100):0;
          return `<div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:0.84rem;color:${g.c};font-weight:600;">${g.label}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:1.0rem;font-weight:700;color:${g.c};">${pct.toFixed(1)}% <span style="font-size:0.76rem;color:${_C.dim};">(${counts[g.key]})</span></span>
            </div>
            <div style="height:7px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct.toFixed(1)}%;background:${g.c};border-radius:4px;"></div>
            </div>
          </div>`;
        }).join('')}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.76rem;color:${_C.dim};line-height:1.6;">
          INA threshold: Architecture items (Q2,Q3,Q6) &lt; 0.50. UNA threshold: Execution items (Q1,Q5,Q8) &lt; 0.50. Context items excluded from classification.
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Pattern Interpretation</div>
        ${groups.map(g=>`
          <div style="padding:10px 12px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-radius:5px;border-left:3px solid ${g.c};">
            <div style="font-size:0.78rem;color:${g.c};font-weight:600;margin-bottom:4px;">${g.label} — ${(counts[g.key]/total*100).toFixed(1)}%</div>
            <div style="font-size:0.77rem;color:${_C.muted};line-height:1.55;">${g.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function _saPsyMapPatternClassification(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.raw) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }
  if (!_saPsyCache.map_validity) _saPsyCache.map_validity = _saPsyComputeValidity('map');
  const v = _saPsyCache.map_validity;

  // Cross-tab: MAP INA/UNA pattern vs MAP PE zone
  const zones=[
    {l:'Critical/Low', lo:0,    hi:0.55},
    {l:'Moderate',     lo:0.55, hi:0.70},
    {l:'Good/High',    lo:0.70, hi:1.01},
  ];
  const patterns=['ina','una','mixed','adherent'];
  const matrix = patterns.map(()=>zones.map(()=>0));

  (d.raw||[]).forEach(r=>{
    let ina=0,una=0;
    if ((+r.map_q2||0)<0.5) ina++;
    if ((+r.map_q3||0)<0.5) ina++;
    if ((+r.map_q6||0)<0.5) ina++;
    if ((+r.map_q1||0)<0.5) una++;
    if ((+r.map_q5||0)<0.5) una++;
    if ((+r.map_q8||0)<0.5) una++;
    let pat = ina===0&&una===0?3:ina>una?0:una>ina?1:2;
    const pe = Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3);
    const zi = zones.findIndex(z=>pe>=z.lo&&pe<z.hi);
    if (zi>=0) matrix[pat][zi]++;
  });

  const patLabels=['INA','UNA','Mixed','Adherent'];
  const zoneLabels=zones.map(z=>z.l);
  const total=matrix.flat().reduce((s,v)=>s+v,0);
  const cellSize=90;

  const hdr=`<div style="display:flex;margin-left:${cellSize}px;">${zoneLabels.map(l=>`<div style="width:${cellSize}px;text-align:center;padding:6px 4px;font-size:0.74rem;color:${_C.muted};">${l}</div>`).join('')}</div>`;
  const rows2=matrix.map((row,i)=>{
    const rowTotal=row.reduce((s,v)=>s+v,0);
    return `<div style="display:flex;align-items:center;">
      <div style="width:${cellSize}px;text-align:right;padding-right:10px;font-size:0.78rem;color:${['#ef4444','#f59e0b','#8b6ff5','#10b981'][i]};">${patLabels[i]}</div>
      ${row.map((cnt,j)=>{
        const isDiag=(i===3&&j===2)||(i===0&&j===0)||(i===1&&j===0);
        const pct=rowTotal>0?(cnt/rowTotal*100).toFixed(1):'0.0';
        const intensity=rowTotal>0?cnt/Math.max(...row,1):0;
        const bg=isDiag?`rgba(46,201,138,${(0.1+intensity*0.5).toFixed(2)})`:cnt===0?'rgba(255,255,255,0.02)':`rgba(239,68,68,${(intensity*0.35).toFixed(2)})`;
        const tc=intensity>0.3||isDiag?'rgba(232,240,248,0.95)':_C.dim;
        return `<div style="width:${cellSize}px;height:${cellSize}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bg};border:1px solid rgba(255,255,255,0.05);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${tc};">${cnt}</div>
          <div style="font-size:0.68rem;color:${tc};opacity:0.75;">${pct}% of row</div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Pattern × PE Zone — Cross-Tabulation</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:12px;">INA/UNA classification (rows) × MAP PE zone (columns) · n=${total.toLocaleString()} · row percentages shown</div>
      <div style="display:flex;flex-direction:column;">
        <div style="font-size:0.72rem;color:${_C.dim};margin-bottom:2px;margin-left:${cellSize}px;letter-spacing:0.1em;text-transform:uppercase;">MAP PE Zone →</div>
        ${hdr}
        ${rows2}
      </div>
      <div style="margin-top:12px;font-size:0.78rem;color:${_C.dim};line-height:1.65;padding-top:10px;border-top:1px solid ${_C.border};">
        Validation expectation: INA patients should cluster in Critical/Low PE zones (intentional barriers depress Architecture, which drives PE down).
        UNA patients may appear in any zone — forgetting doesn't necessarily produce low PE if the behavior is partially maintained.
        Adherent patients should predominantly appear in Good/High PE zones.
      </div>
    </div>`;
}

function _saPsyMapPatternDrivers(container) {
  const d = _saPsyCache.map;
  if (!d || d.insufficient || !d.raw) { _psyInsuf(container,d||{insufficient:true,n:0},'MAP'); return; }

  const raw = d.raw||[];
  const n = raw.length||1;
  const thresh = 0.5;

  const items = [
    {q:'map_q1',label:'Q1 — Scheduled timing',       domain:'Execution',    c:_C.purple},
    {q:'map_q2',label:'Q2 — Has a routine/system',   domain:'Architecture', c:_C.blue},
    {q:'map_q3',label:'Q3 — Plans around schedule',  domain:'Architecture', c:_C.blue},
    {q:'map_q4',label:'Q4 — Takes when away',        domain:'Context',      c:_C.green},
    {q:'map_q5',label:'Q5 — No reminders needed',    domain:'Execution',    c:_C.purple},
    {q:'map_q6',label:'Q6 — Has contingency plan',   domain:'Architecture', c:_C.blue},
    {q:'map_q7',label:'Q7 — Environment supports',   domain:'Context',      c:_C.green},
    {q:'map_q8',label:'Q8 — Rarely misses (priority)',domain:'Execution',   c:_C.purple},
  ];

  const missRates = items.map(item=>{
    const misses = raw.filter(r=>(+r[item.q]||0)<thresh).length;
    return {...item, misses, rate: misses/n};
  });
  const sorted = [...missRates].sort((a,b)=>b.rate-a.rate);

  container.innerHTML = `
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Item Miss Rate — Ranked by Prevalence (score &lt; 0.50)</div>
      ${sorted.map((item,rank)=>{
        const pct=(item.rate*100).toFixed(1);
        const barC=item.rate>=0.40?_C.red:item.rate>=0.25?_C.amber:_C.green;
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:20px;text-align:right;font-size:0.72rem;color:${_C.dim};flex-shrink:0;">${rank+1}</div>
          <div style="width:22px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${item.c};flex-shrink:0;">${item.q.replace('map_','').toUpperCase()}</div>
          <div style="width:90px;flex-shrink:0;">
            <span style="font-size:0.68rem;padding:2px 6px;border-radius:3px;background:${item.c}22;color:${item.c};">${item.domain}</span>
          </div>
          <div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barC};border-radius:5px;opacity:0.85;"></div>
          </div>
          <div style="width:46px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${barC};text-align:right;flex-shrink:0;">${pct}%</div>
          <div style="width:200px;font-size:0.76rem;color:${_C.dim};flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</div>
        </div>`;
      }).join('')}
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.76rem;color:${_C.dim};line-height:1.65;">
        <span style="color:${_C.red};">≥ 40%</span> miss rate = high-priority intervention target ·
        <span style="color:${_C.amber};">25–39%</span> = moderate concern ·
        <span style="color:${_C.green};">&lt; 25%</span> = acceptable.
        Items are scored &lt; 0.50 as "below threshold." This ranking identifies the specific behaviors and beliefs that most often break down in this cohort.
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// VALIDITY COMPUTATION  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyComputeValidity(inst) {
  const base = _saPsyCache[inst];
  if (!base || base.insufficient) return { insufficient: true, n: base ? base.n : 0 };

  const mmasRaw  = (_saCache.mmas||[]).filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRaw   = (_saCache.mmas||[]).filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const peacsRaw = (_saCache.peacs||[]);

  // ── CONTENT VALIDITY ──────────────────────────────────────────────────────
  const weakItems     = base.rIT.map((r,i)=>({i,r})).filter(x=>x.r<0.25);
  const redundantPairs = [];
  for (let i=0;i<8;i++) for (let j=i+1;j<8;j++) {
    if (base.corrMatrix[i][j] > 0.70) redundantPairs.push({i,j,r:base.corrMatrix[i][j]});
  }
  const cvi = base.rIT.filter(r=>r>=0.30).length / 8;
  const archIdx=[1,2,5], execIdx=[0,3,4,7], ctxIdx=[6];
  const domainCVI = inst==='map' ? {
    arch: archIdx.filter(i=>base.rIT[i]>=0.30).length / archIdx.length,
    exec: execIdx.filter(i=>base.rIT[i]>=0.30).length / execIdx.length,
    ctx:  ctxIdx.filter(i=>base.rIT[i]>=0.30).length  / ctxIdx.length,
  } : null;

  // ── CONSTRUCT VALIDITY (MAP) ──────────────────────────────────────────────
  let aveArch=null,aveExec=null,aveCtx=null,corrArchExec=null,corrArchCtx=null,corrExecCtx=null;
  let htmtAE=null,htmtAC=null,htmtEC=null,crArch=null,crExec=null;
  if (inst==='map') {
    const ave = idxs => {
      const lSq=idxs.map(i=>base.loadings[i]**2);
      const mLSq=lSq.reduce((s,v)=>s+v,0)/lSq.length;
      const mErr=lSq.map(v=>1-v).reduce((s,v)=>s+v,0)/lSq.length;
      return mLSq>0?mLSq/(mLSq+mErr):0;
    };
    const cr = idxs => {
      const sumL=idxs.reduce((s,i)=>s+base.loadings[i],0);
      const sumE=idxs.reduce((s,i)=>s+Math.max(0,1-base.loadings[i]**2),0);
      return sumL**2>0?sumL**2/(sumL**2+sumE):0;
    };
    aveArch=ave(archIdx); aveExec=ave(execIdx); aveCtx=ave(ctxIdx);
    crArch=cr(archIdx);   crExec=cr(execIdx);
    const parse=v=>typeof v==='number'?v:(v===true||v===1||v==='1'||v==='yes'||v==='Yes')?1:0;
    const mapMat=mapRaw.map(r=>Array.from({length:8},(_,j)=>parse(r['map_q'+(j+1)]))).filter(row=>row.every(v=>!isNaN(v)));
    if (mapMat.length>=10) {
      const archS=mapMat.map(r=>(r[1]+r[2]+r[5])/3);
      const execS=mapMat.map(r=>(r[0]+r[3]+r[4]+r[7])/4);
      const ctxS =mapMat.map(r=>r[6]);
      corrArchExec=_psyPearson(archS,execS);
      corrArchCtx =_psyPearson(archS,ctxS);
      corrExecCtx =_psyPearson(execS,ctxS);
      const htmt=(iA,iB,corrM)=>{
        const cross=[];iA.forEach(a=>iB.forEach(b=>cross.push(corrM[a][b])));
        const wA=[];for(let p=0;p<iA.length;p++)for(let q=p+1;q<iA.length;q++)wA.push(corrM[iA[p]][iA[q]]);
        const wB=[];for(let p=0;p<iB.length;p++)for(let q=p+1;q<iB.length;q++)wB.push(corrM[iB[p]][iB[q]]);
        if(!cross.length)return null;
        const mCross=cross.reduce((s,v)=>s+v,0)/cross.length;
        const mWA=wA.length?wA.reduce((s,v)=>s+v,0)/wA.length:1;
        const mWB=wB.length?wB.reduce((s,v)=>s+v,0)/wB.length:1;
        const denom=Math.sqrt(Math.max(0,mWA)*Math.max(0,mWB));
        return denom>0?Math.abs(mCross)/denom:null;
      };
      htmtAE=htmt(archIdx,execIdx,base.corrMatrix);
      htmtAC=htmt(archIdx,ctxIdx, base.corrMatrix);
      htmtEC=htmt(execIdx,ctxIdx, base.corrMatrix);
    }
  }

  // ── CRITERION VALIDITY ────────────────────────────────────────────────────
  const parseMMAS=r=>{let s=0;for(let j=1;j<=8;j++){const v=r['q'+j];s+=(typeof v==='number'?v:(v===true||v==='yes'||v==='Yes'||v===1||v==='1')?1:0);}return s;};
  const mmasByPt={};
  mmasRaw.forEach(r=>{if(!r.patient_number)return;const ts=r.timestamp||0;if(!mmasByPt[r.patient_number]||ts>mmasByPt[r.patient_number].ts)mmasByPt[r.patient_number]={val:parseMMAS(r),ts};});
  const mapByPt=(() =>{
    const byPt={};
    mapRaw.filter(r=>r.map_q1!==undefined).forEach(r=>{if(!r.patient_number)return;const ts=r.timestamp||0;const val=Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3);if(!byPt[r.patient_number]||ts>byPt[r.patient_number].ts)byPt[r.patient_number]={val,ts};});
    return byPt;
  })();
  const peacsByPt=(() =>{const byPt={};peacsRaw.forEach(r=>{if(!r.patient_number)return;const pe=+(r.pe_score??r.pe??0);const ts=r.timestamp||0;if(!byPt[r.patient_number]||ts>byPt[r.patient_number].ts)byPt[r.patient_number]={val:pe,ts};});return byPt;})();

  const mmapPairs=[];Object.keys(mmasByPt).forEach(pt=>{if(mapByPt[pt])mmapPairs.push({x:mmasByPt[pt].val,y:mapByPt[pt].val});});
  const concurrentR=mmapPairs.length>=10?_psyPearson(mmapPairs.map(p=>p.x),mmapPairs.map(p=>p.y)):null;
  const mpeacsPairs=[];Object.keys(mmasByPt).forEach(pt=>{if(peacsByPt[pt])mpeacsPairs.push({x:mmasByPt[pt].val,y:peacsByPt[pt].val});});
  const mmasPeacsR=mpeacsPairs.length>=10?_psyPearson(mpeacsPairs.map(p=>p.x),mpeacsPairs.map(p=>p.y)):null;
  const mapPeacsPairs=[];Object.keys(mapByPt).forEach(pt=>{if(peacsByPt[pt])mapPeacsPairs.push({x:mapByPt[pt].val,y:peacsByPt[pt].val});});
  const mapPeacsR=mapPeacsPairs.length>=10?_psyPearson(mapPeacsPairs.map(p=>p.x),mapPeacsPairs.map(p=>p.y)):null;

  const kgHigh=[],kgLow=[];Object.keys(mmasByPt).forEach(pt=>{if(!mapByPt[pt])return;(mmasByPt[pt].val>=6?kgHigh:kgLow).push(mapByPt[pt].val);});
  const kgHighMean=kgHigh.length?_psyMean(kgHigh):null;
  const kgLowMean =kgLow.length ?_psyMean(kgLow):null;
  let cohenD=null;
  if(kgHigh.length>=5&&kgLow.length>=5){const pSD=Math.sqrt(((_psyVar(kgHigh)*(kgHigh.length-1))+(_psyVar(kgLow)*(kgLow.length-1)))/(kgHigh.length+kgLow.length-2));cohenD=pSD>0?Math.abs(kgHighMean-kgLowMean)/pSD:0;}

  const scatterSample=mmapPairs.length>200?mmapPairs.filter((_,i)=>i%Math.ceil(mmapPairs.length/200)===0).slice(0,200):mmapPairs;

  // ── PREDICTIVE VALIDITY ───────────────────────────────────────────────────
  const predRaw=inst==='map'?mapRaw.filter(r=>r.pe_score!==undefined&&r.patient_number):mmasRaw.filter(r=>r.patient_number);
  const predByPt={};predRaw.forEach(r=>{if(!predByPt[r.patient_number])predByPt[r.patient_number]=[];predByPt[r.patient_number].push(r);});
  Object.values(predByPt).forEach(arr=>arr.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)));
  const predCutoff=inst==='map'?0.50:6;

  const buildLag=lagDays=>{
    const lagMs=lagDays*86400000;
    const pairs=[];
    Object.values(predByPt).forEach(recs=>{
      if(recs.length<2)return;
      const t1r=recs[0];
      const t2r=recs.find(r=>(r.timestamp||0)>=(t1r.timestamp||0)+lagMs);
      if(!t2r)return;
      const _mpPE=r=>Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3);
      const t1v=inst==='map'?_mpPE(t1r):parseMMAS(t1r);
      const t2v=inst==='map'?_mpPE(t2r):parseMMAS(t2r);
      if(isNaN(t1v)||isNaN(t2v))return;
      pairs.push({t1:t1v,t2:t2v});
    });
    if(pairs.length<10)return{n:pairs.length,sufficient:false};
    const t1s=pairs.map(p=>p.t1),t2s=pairs.map(p=>p.t2);
    const predR=_psyPearson(t1s,t2s);
    const isLow=v=>v<predCutoff;
    const TP=pairs.filter(p=>isLow(p.t1)&&isLow(p.t2)).length;
    const FP=pairs.filter(p=>isLow(p.t1)&&!isLow(p.t2)).length;
    const FN=pairs.filter(p=>!isLow(p.t1)&&isLow(p.t2)).length;
    const TN=pairs.filter(p=>!isLow(p.t1)&&!isLow(p.t2)).length;
    const n=pairs.length;
    const ppv=(TP+FP)>0?TP/(TP+FP):null;
    const sens=(TP+FN)>0?TP/(TP+FN):null;
    const spec=(TN+FP)>0?TN/(TN+FP):null;
    const acc=n>0?(TP+TN)/n:null;
    const sample=n>150?pairs.filter((_,i)=>i%Math.ceil(n/150)===0).slice(0,150):pairs;
    return{n,sufficient:true,predR,TP,FP,FN,TN,ppv,sens,spec,acc,sample,t1s,t2s};
  };

  const predictive={30:buildLag(30),60:buildLag(60),90:buildLag(90),cutoff:predCutoff};

  return {
    inst,cvi,domainCVI,weakItems,redundantPairs,
    aveArch,aveExec,aveCtx,crArch,crExec,
    corrArchExec,corrArchCtx,corrExecCtx,htmtAE,htmtAC,htmtEC,
    mmapPairs,concurrentR,scatterSample,
    mpeacsPairs,mmasPeacsR,mapPeacsPairs,mapPeacsR,
    kgHigh,kgLow,kgHighMean,kgLowMean,cohenD,
    predictive,
    nMmas:mmasRaw.length,nMap:mapRaw.length,nPeacs:peacsRaw.length,
  };
}


// ══════════════════════════════════════════════════════════════════════════════
// VALIDITY — PREDICTIVE helpers  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyPredSetLag(lag) {
  _saPsyPredLag = lag;
  [30,60,90].forEach(l => {
    const b = document.getElementById('sa-psy-pred-lag-'+l);
    if (!b) return;
    const on = l===lag;
    b.style.background  = on ? 'rgba(212,168,67,0.14)' : 'transparent';
    b.style.borderColor = on ? 'rgba(212,168,67,0.4)'  : _C.border;
    b.style.color       = on ? _C.amber : _C.muted;
  });
  const body     = document.getElementById('sa-psy-pred-body');
  const cacheKey = _saPsyInstrument + '_validity';
  const d        = _saPsyCache[cacheKey];
  if (body && d) body.innerHTML = _saPsyPredPanelHtml(d, lag, _saPsyInstrument);
}

function _saPsyPredPanelHtml(d, lag, inst) {
  const pd = d.predictive[lag];
  const instLabel = inst==='map' ? 'MAP' : 'MMAS-8';
  const cutoff    = d.predictive.cutoff;
  const cutLabel  = inst==='map' ? `PE < ${cutoff}` : `Score < ${cutoff}`;
  const xLabel    = inst==='map' ? 'MAP PE (T1)' : 'MMAS Score (T1)';
  const yLabel    = inst==='map' ? 'MAP PE (T2)' : 'MMAS Score (T2)';
  const xMax      = inst==='map' ? 1 : 8;

  if (!pd.sufficient) {
    return `<div style="text-align:center;padding:28px 0;font-size:0.84rem;color:${_C.muted};">
      Insufficient longitudinal data at ${lag}-day lag — found ${pd.n} pairs, need ≥10.<br>
      <span style="font-size:0.78rem;color:${_C.dim};">Patients require ≥2 ${instLabel} assessments at least ${lag} days apart.</span>
    </div>`;
  }

  const rCol  = Math.abs(pd.predR)>=0.50?_C.green:Math.abs(pd.predR)>=0.30?_C.amber:_C.red;
  const ppvC  = pd.ppv!=null?(pd.ppv>=0.70?_C.green:pd.ppv>=0.50?_C.amber:_C.red):_C.dim;
  const sensC = pd.sens!=null?(pd.sens>=0.70?_C.green:pd.sens>=0.50?_C.amber:_C.red):_C.dim;
  const specC = pd.spec!=null?(pd.spec>=0.70?_C.green:pd.spec>=0.50?_C.amber:_C.red):_C.dim;
  const accC  = pd.acc!=null?(pd.acc>=0.70?_C.green:pd.acc>=0.50?_C.amber:_C.red):_C.dim;
  const fmt   = v => v!=null?(v*100).toFixed(1)+'%':'—';
  const fmtR  = v => v!=null?v.toFixed(3):'—';

  const PSW=320,PSH=160,pPadL=30,pPadB=22,pPadT=10,pPadR=10;
  const pPlotW=PSW-pPadL-pPadR,pPlotH=PSH-pPadT-pPadB;
  const toX=v=>pPadL+(Math.min(xMax,Math.max(0,v))/xMax)*pPlotW;
  const toY=v=>pPadT+pPlotH-(Math.min(xMax,Math.max(0,v))/xMax)*pPlotH;
  const dots=pd.sample.map(p=>`<circle cx="${toX(p.t1).toFixed(1)}" cy="${toY(p.t2).toFixed(1)}" r="2.6" fill="${_C.purple}" opacity="0.50"/>`).join('');
  const refLine=`<line x1="${toX(0).toFixed(1)}" y1="${toY(0).toFixed(1)}" x2="${toX(xMax).toFixed(1)}" y2="${toY(xMax).toFixed(1)}" stroke="${_C.border}" stroke-width="1" stroke-dasharray="3,3"/>`;
  const cutX=toX(cutoff).toFixed(1),cutY=toY(cutoff).toFixed(1);
  const cutLines=`<line x1="${cutX}" y1="${pPadT}" x2="${cutX}" y2="${pPadT+pPlotH}" stroke="${_C.amber}" stroke-width="0.8" stroke-dasharray="2,3" opacity="0.6"/><line x1="${pPadL}" y1="${cutY}" x2="${pPadL+pPlotW}" y2="${cutY}" stroke="${_C.amber}" stroke-width="0.8" stroke-dasharray="2,3" opacity="0.6"/>`;
  const t1s=pd.sample.map(p=>p.t1),t2s=pd.sample.map(p=>p.t2);
  let trendLine='';
  if(t1s.length>=5){const mx=t1s.reduce((s,v)=>s+v,0)/t1s.length,my=t2s.reduce((s,v)=>s+v,0)/t2s.length;let sxy=0,sxx=0;t1s.forEach((x,i)=>{sxy+=(x-mx)*(t2s[i]-my);sxx+=(x-mx)**2;});const slope=sxx>0?sxy/sxx:0,intercept=my-slope*mx;const y0=Math.min(xMax,Math.max(0,intercept));const yX=Math.min(xMax,Math.max(0,intercept+slope*xMax));trendLine=`<line x1="${toX(0).toFixed(1)}" y1="${toY(y0).toFixed(1)}" x2="${toX(xMax).toFixed(1)}" y2="${toY(yX).toFixed(1)}" stroke="${_C.amber}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.85"/>`;}
  const axTicks=inst==='map'?[0,0.25,0.5,0.75,1]:[0,2,4,6,8];
  const axX=axTicks.map(v=>`<text x="${toX(v).toFixed(1)}" y="${PSH-4}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono">${v}</text>`).join('');
  const axY=axTicks.map(v=>`<text x="${pPadL-3}" y="${toY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="8" text-anchor="end" font-family="IBM Plex Mono">${v}</text>`).join('');
  const scatterSvg=`<svg width="100%" height="${PSH}" viewBox="0 0 ${PSW} ${PSH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;"><line x1="${pPadL}" y1="${pPadT}" x2="${pPadL}" y2="${pPadT+pPlotH}" stroke="${_C.border}" stroke-width="0.8"/><line x1="${pPadL}" y1="${pPadT+pPlotH}" x2="${pPadL+pPlotW}" y2="${pPadT+pPlotH}" stroke="${_C.border}" stroke-width="0.8"/>${refLine}${cutLines}${dots}${trendLine}${axX}${axY}<text x="${pPadL+pPlotW/2}" y="${PSH}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono">${xLabel}</text><text x="7" y="${pPadT+pPlotH/2}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,7,${pPadT+pPlotH/2})">${yLabel}</text></svg>`;

  const total=pd.TP+pd.FP+pd.FN+pd.TN;
  const cell=(n,lbl,sublbl,col,bg)=>`<div style="padding:14px 10px;text-align:center;background:${bg};border-radius:4px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.4rem;font-weight:700;color:${col};">${n}</div><div style="font-size:0.76rem;color:${col};margin-top:3px;font-weight:600;">${lbl}</div><div style="font-size:0.72rem;color:${_C.dim};margin-top:2px;">${sublbl}</div><div style="font-size:0.72rem;color:${_C.dim};">${total>0?(n/total*100).toFixed(1)+'%':''}</div></div>`;
  const table2x2=`<div style="margin-bottom:8px;"><div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:3px;font-size:0.74rem;"><div></div><div style="text-align:center;padding:4px;color:${_C.dim};">T2 Non-adherent<br><span style="color:${_C.amber};font-size:0.70rem;">${cutLabel}</span></div><div style="text-align:center;padding:4px;color:${_C.dim};">T2 Adherent<br><span style="color:${_C.amber};font-size:0.70rem;">≥ cutoff</span></div><div style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;padding:4px;color:${_C.dim};font-size:0.72rem;">T1 Non-adh.</div>${cell(pd.TP,'True Positive','Persistent',_C.green,`${_C.green}14`)}${cell(pd.FP,'False Positive','Resolved',_C.amber,`${_C.amber}14`)}<div style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;padding:4px;color:${_C.dim};font-size:0.72rem;">T1 Adherent</div>${cell(pd.FN,'False Negative','New onset',_C.amber,`${_C.amber}14`)}${cell(pd.TN,'True Negative','Sustained',_C.green,`${_C.green}14`)}</div></div>`;

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
      <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.55rem;font-weight:700;color:${rCol};">${fmtR(pd.predR)}</div><div style="font-size:0.82rem;color:${_C.text};margin:5px 0 2px;">Predictive r</div><div style="font-size:0.74rem;color:${_C.dim};">T1 → T2 Pearson · n=${pd.n}</div></div>
      <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.55rem;font-weight:700;color:${ppvC};">${fmt(pd.ppv)}</div><div style="font-size:0.82rem;color:${_C.text};margin:5px 0 2px;">PPV</div><div style="font-size:0.74rem;color:${_C.dim};">Positive predictive value</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${sensC};">${fmt(pd.sens)}</div><div style="font-size:0.73rem;color:${_C.dim};margin-top:3px;">Sensitivity</div></div>
        <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${specC};">${fmt(pd.spec)}</div><div style="font-size:0.73rem;color:${_C.dim};margin-top:3px;">Specificity</div></div>
        <div style="grid-column:1/-1;text-align:center;padding:7px 6px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.0rem;font-weight:700;color:${accC};">${fmt(pd.acc)}</div><div style="font-size:0.73rem;color:${_C.dim};margin-top:2px;">Accuracy</div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div>
        <div style="font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};margin-bottom:8px;">Lagged Scatter — T1 × T2 (${lag}d)</div>
        <div style="font-size:0.76rem;color:${_C.dim};margin-bottom:6px;">Diagonal = perfect prediction · amber dashed = OLS trend · amber hairlines = cutoff (${cutLabel})</div>
        ${scatterSvg}
        <div style="margin-top:6px;font-size:0.77rem;color:${_C.dim};">r(T1,T2) = <span style="color:${rCol};font-family:'IBM Plex Mono',monospace;">${fmtR(pd.predR)}</span> · n=${pd.n} · cutoff = ${cutoff}</div>
      </div>
      <div>
        <div style="font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};margin-bottom:8px;">Classification at ${lag}d Lag — Cutoff: ${cutLabel}</div>
        ${table2x2}
        <div style="font-size:0.77rem;color:${_C.dim};line-height:1.6;"><span style="color:${_C.green};">TP</span> = persistent non-adherence · <span style="color:${_C.amber};">FP</span> = resolved · <span style="color:${_C.amber};">FN</span> = new-onset · <span style="color:${_C.green};">TN</span> = sustained adherence</div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// VALIDITY — SPLIT RENDERS  (Content / Criterion / Construct / Predictive)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyValidityContent(container) {
  const inst      = _saPsyInstrument;
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  const base      = _saPsyCache[inst];
  if (!base||base.insufficient){_psyInsuf(container,base||{insufficient:true,n:0},instLabel);return;}
  const d=_saPsyCache[inst+'_validity'];
  if(!d||d.insufficient){_psyInsuf(container,d||{insufficient:true,n:0},instLabel);return;}

  const shorts=inst==='map'?_MAP_SHORT:_MMAS_SHORT;
  const labels=inst==='map'?_MAP_LABELS:_MMAS_LABELS;
  const badge=(txt,col)=>`<span style="font-size:0.72rem;padding:2px 8px;border-radius:4px;background:${col}22;color:${col};border:1px solid ${col}44;">${txt}</span>`;
  const cviColor=d.cvi>=0.80?_C.green:d.cvi>=0.60?_C.amber:_C.red;

  const itemFlagRows=labels.map((lbl,j)=>{
    const rit=base.rIT[j];
    const isWeak=rit<0.25;
    const isRedun=d.redundantPairs.some(p=>p.i===j||p.j===j);
    const rc=rit>=0.40?_C.green:rit>=0.25?_C.amber:_C.red;
    const flags=[isWeak?badge('Weak',_C.red):'',isRedun?badge('Redundant?',_C.amber):''].filter(Boolean).join(' ');
    return `<tr style="border-bottom:1px solid ${_C.border};">
      <td style="padding:9px 14px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.amber};">${shorts[j]}</td>
      <td style="padding:9px 14px;font-size:0.79rem;color:${_C.muted};">${_saEsc(lbl)}</td>
      <td style="padding:9px 14px;text-align:right;"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;"><div style="width:48px;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${(Math.max(0,rit)*100).toFixed(1)}%;background:${rc};"></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.83rem;color:${rc};">${rit.toFixed(3)}</span></div></td>
      <td style="padding:9px 14px;text-align:right;">${flags||badge('OK',_C.green)}</td>
    </tr>`;
  }).join('');

  const redundantNote=d.redundantPairs.length?d.redundantPairs.map(p=>`${shorts[p.i]}–${shorts[p.j]} (r=${p.r.toFixed(3)})`).join(', '):'None detected (all inter-item r < 0.70)';
  const domainCVIHtml=d.domainCVI?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid ${_C.border};">${[['Architecture',d.domainCVI.arch,_C.blue],['Execution',d.domainCVI.exec,_C.purple],['Context',d.domainCVI.ctx,_C.green]].map(([l,v,c])=>`<div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${v>=0.80?_C.green:v>=0.60?_C.amber:_C.red};">${(v*100).toFixed(0)}%</div><div style="font-size:0.76rem;color:${c};margin-top:4px;">${l}</div><div style="font-size:0.72rem;color:${_C.dim};margin-top:2px;">Domain CVI</div></div>`).join('')}</div>`:'';

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 260px;gap:16px;margin-bottom:14px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Item Flag Table — n = ${base.n.toLocaleString()}</div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid ${_C.borderB};"><th style="padding:8px 14px;font-size:0.73rem;letter-spacing:0.11em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Item</th><th style="padding:8px 14px;font-size:0.73rem;letter-spacing:0.11em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Content</th><th style="padding:8px 14px;font-size:0.73rem;letter-spacing:0.11em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;">r<sub>it</sub></th><th style="padding:8px 14px;font-size:0.73rem;letter-spacing:0.11em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;">Flags</th></tr></thead><tbody>${itemFlagRows}</tbody></table></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="sa-panel" style="text-align:center;">
          <div style="font-size:1.8rem;font-weight:700;color:${cviColor};font-family:'IBM Plex Mono',monospace;">${(d.cvi*100).toFixed(0)}%</div>
          <div style="font-size:0.84rem;color:${_C.text};margin:5px 0 3px;">Content Validity Index</div>
          <div style="font-size:0.76rem;color:${_C.dim};">Items with r<sub>it</sub> ≥ 0.30</div>
          <div style="margin-top:8px;">${d.cvi>=0.80?badge('✓ Adequate',_C.green):d.cvi>=0.60?badge('Marginal',_C.amber):badge('Insufficient',_C.red)}</div>
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Redundancy Check</div>
          <div style="font-size:0.79rem;color:${d.redundantPairs.length?_C.amber:_C.muted};line-height:1.55;">${redundantNote}</div>
        </div>
        ${domainCVIHtml?`<div class="sa-panel">${domainCVIHtml.trim()}</div>`:''}
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Content Validity Interpretation</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">CVI (this platform)</span><br>Proportion of items with corrected r<sub>it</sub> ≥ 0.30. Expert-rated CVI (Lawshe, 1975) requires independent SME panel ratings and is instrument-level evidence obtained prior to deployment.</div>
        <div><span style="color:${_C.text};">Weak items (r<sub>it</sub> &lt; 0.25)</span><br>${d.weakItems.length?d.weakItems.map(x=>shorts[x.i]+' ('+x.r.toFixed(3)+')').join(', '):'None'} — items below threshold add noise without contributing to the construct measured.</div>
        <div><span style="color:${_C.text};">Redundancy (r &gt; 0.70)</span><br>${d.redundantPairs.length?'Flagged pairs may be measuring identical behavior. Consider review in next instrument revision.':'No redundant item pairs detected at r > 0.70 threshold.'}</div>
      </div>
    </div>`;
}

function _saPsyValidityCriterion(container) {
  const inst      = _saPsyInstrument;
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  const base      = _saPsyCache[inst];
  if (!base||base.insufficient){_psyInsuf(container,base||{insufficient:true,n:0},instLabel);return;}
  const d = _saPsyCache[inst+'_validity'];
  if(!d||d.insufficient){_psyInsuf(container,d||{insufficient:true,n:0},instLabel);return;}

  const rColor=r=>r>=0.50?_C.green:r>=0.30?_C.amber:_C.red;
  const fmtR=r=>r!=null?r.toFixed(3):'—';
  const concCol=d.concurrentR!=null?rColor(Math.abs(d.concurrentR)):_C.dim;
  const mprCol =d.mmasPeacsR!=null? rColor(Math.abs(d.mmasPeacsR)) :_C.dim;
  const mprCol2=d.mapPeacsR!=null?  rColor(Math.abs(d.mapPeacsR))  :_C.dim;

  // Scatter SVG
  const SW=400,SH=160,padL=32,padB=22,padT=10,padR=10;
  const plotW=SW-padL-padR,plotH=SH-padT-padB;
  let scatterSvg=`<text x="${padL+plotW/2}" y="${SH/2+5}" fill="${_C.dim}" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">Insufficient paired data (need ≥10 matched patients)</text>`;
  if(d.scatterSample.length>=10){
    const xs=d.scatterSample.map(p=>p.x),ys=d.scatterSample.map(p=>p.y);
    const xRange=8,yRange=1;
    const toSX=x=>padL+(x/xRange)*plotW,toSY=y=>padT+plotH-(y/yRange)*plotH;
    const dots=d.scatterSample.map(p=>`<circle cx="${toSX(Math.min(8,Math.max(0,p.x))).toFixed(1)}" cy="${toSY(Math.min(1,Math.max(0,p.y))).toFixed(1)}" r="2.8" fill="${_C.blue}" opacity="0.55"/>`).join('');
    const mx=_psyMean(xs),my=_psyMean(ys);let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;});const slope=sxx>0?sxy/sxx:0,intercept=my-slope*mx;const y0=Math.min(1,Math.max(0,intercept)),y8=Math.min(1,Math.max(0,intercept+slope*8));
    const trendLine=`<line x1="${toSX(0).toFixed(1)}" y1="${toSY(y0).toFixed(1)}" x2="${toSX(8).toFixed(1)}" y2="${toSY(y8).toFixed(1)}" stroke="${_C.amber}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>`;
    const axisX=[0,2,4,6,8].map(v=>`<text x="${toSX(v).toFixed(1)}" y="${SH-4}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${v}</text>`).join('');
    const axisY=[0,0.5,1].map(v=>`<text x="${padL-4}" y="${toSY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(1)}</text>`).join('');
    scatterSvg=dots+trendLine+axisX+axisY;
  }

  const KW=220,KH=90;
  let kgBars=`<text x="${KW/2}" y="${KH/2}" fill="${_C.dim}" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">Insufficient data</text>`;
  if(d.kgHighMean!=null&&d.kgLowMean!=null){
    const maxVal=Math.max(d.kgHighMean,d.kgLowMean,0.01);
    const bW=54,gap=24,baseY=KH-22;
    const hH=Math.round((d.kgHighMean/maxVal)*(KH-36)),lH=Math.round((d.kgLowMean/maxVal)*(KH-36));
    const x1=KW/2-gap/2-bW,x2=KW/2+gap/2;
    kgBars=`<rect x="${x1}" y="${baseY-hH}" width="${bW}" height="${hH}" rx="3" fill="${_C.green}" opacity="0.75"/><rect x="${x2}" y="${baseY-lH}" width="${bW}" height="${lH}" rx="3" fill="${_C.red}" opacity="0.75"/><text x="${x1+bW/2}" y="${baseY-hH-5}" fill="${_C.green}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${d.kgHighMean.toFixed(3)}</text><text x="${x2+bW/2}" y="${baseY-lH-5}" fill="${_C.red}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${d.kgLowMean.toFixed(3)}</text><line x1="${x1}" y1="${baseY}" x2="${x2+bW}" y2="${baseY}" stroke="${_C.border}" stroke-width="1"/><text x="${x1+bW/2}" y="${KH-5}" fill="${_C.green}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">MMAS≥6</text><text x="${x2+bW/2}" y="${KH-5}" fill="${_C.red}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">MMAS&lt;6</text>`;
  }

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">
      ${_psyKpi('MMAS ↔ MAP PE',fmtR(d.concurrentR),concCol,`n=${d.mmapPairs.length} paired patients`)}
      ${_psyKpi('MMAS ↔ PEACS', fmtR(d.mmasPeacsR), mprCol, `n=${d.mpeacsPairs.length} paired patients`)}
      ${_psyKpi('MAP ↔ PEACS',  fmtR(d.mapPeacsR),  mprCol2,`n=${d.mapPeacsPairs.length} paired patients`)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">MMAS Score × MAP PE — Concurrent Scatter</div>
        <div style="font-size:0.77rem;color:${_C.dim};margin-bottom:8px;">MMAS total (0–8) on x · MAP PE (0–1) on y · dashed = trend · n=${d.scatterSample.length}</div>
        <svg width="100%" height="${SH}" viewBox="0 0 ${SW} ${SH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;"><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.8"/><line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.8"/>${scatterSvg}<text x="${padL+plotW/2}" y="${SH}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">MMAS-8 Score</text><text x="7" y="${padT+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,7,${padT+plotH/2})">MAP PE</text></svg>
        ${d.concurrentR!=null?`<div style="margin-top:8px;font-size:0.79rem;color:${_C.dim};">r = <span style="color:${concCol};font-family:'IBM Plex Mono',monospace;">${d.concurrentR.toFixed(3)}</span> · ${Math.abs(d.concurrentR)>=0.50?'Strong convergence.':Math.abs(d.concurrentR)>=0.30?'Moderate convergence.':'Weak convergence.'}</div>`:''}
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Known-Groups Validity — MAP PE by MMAS Stratum</div>
        <div style="font-size:0.77rem;color:${_C.dim};margin-bottom:10px;">MMAS≥6 (adherent) vs MMAS&lt;6 (non-adherent) · MAP PE means · n=${d.kgHigh.length+d.kgLow.length} paired</div>
        <svg width="100%" height="${KH}" viewBox="0 0 ${KW} ${KH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;margin:0 auto;">${kgBars}</svg>
        ${d.cohenD!=null?`<div style="margin-top:10px;font-size:0.79rem;color:${_C.dim};">Cohen's d = <span style="color:${d.cohenD>=0.80?_C.green:d.cohenD>=0.50?_C.amber:_C.red};font-family:'IBM Plex Mono',monospace;">${d.cohenD.toFixed(3)}</span> · ${d.cohenD>=0.80?'Large effect.':d.cohenD>=0.50?'Medium effect.':'Small effect.'} High n=${d.kgHigh.length} · Low n=${d.kgLow.length}</div>`:`<div style="margin-top:10px;font-size:0.79rem;color:${_C.dim};">Insufficient paired patients (need ≥5 per group).</div>`}
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Criterion Validity Interpretation</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">Concurrent validity</span><br>Cross-instrument Pearson r from matched patient records. Expected r = 0.40–0.65 between MMAS-8 and MAP PE — same construct measured by different methods.</div>
        <div><span style="color:${_C.text};">Known-groups validity</span><br>Patients scoring ≥ 6 on MMAS-8 should show lower MAP PE than those &lt; 6. Cohen's d ≥ 0.50 = adequate group discrimination.</div>
        <div><span style="color:${_C.text};">Cross-instrument correlations</span><br>MMAS ↔ PEACS and MAP ↔ PEACS measure convergent validity across all three instruments. Moderate to strong correlations (r &gt; 0.40) support construct coherence.</div>
      </div>
    </div>`;
}

function _saPsyValidityConstruct(container) {
  const inst      = _saPsyInstrument;
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  const base      = _saPsyCache[inst];
  if (!base||base.insufficient){_psyInsuf(container,base||{insufficient:true,n:0},instLabel);return;}
  const d = _saPsyCache[inst+'_validity'];
  if(!d||d.insufficient){_psyInsuf(container,d||{insufficient:true,n:0},instLabel);return;}

  if (inst !== 'map') {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px 24px;">
      <div style="font-size:0.94rem;color:${_C.text};margin-bottom:10px;">Construct validity analysis is available for MAP only.</div>
      <div style="font-size:0.82rem;color:${_C.muted};max-width:480px;margin:0 auto;line-height:1.65;">
        MMAS-8 is a unidimensional scale without a multi-domain factor structure — AVE, HTMT, and Fornell-Larcker criterion require multiple latent constructs to be meaningful. Switch to MAP instrument for construct validity evidence.
      </div>
    </div>`;
    return;
  }

  const badge=(txt,col)=>`<span style="font-size:0.72rem;padding:2px 8px;border-radius:4px;background:${col}22;color:${col};border:1px solid ${col}44;">${txt}</span>`;
  const htmtBadge=v=>v==null?badge('N/A',_C.dim):v<0.85?badge('✓ Discriminant',_C.green):v<0.90?badge('Marginal',_C.amber):badge('Fails',_C.red);
  const aveBadge =v=>v==null?badge('N/A',_C.dim):v>=0.50?badge('✓ Convergent',_C.green):badge('Fails AVE<0.50',_C.red);
  const rColor=r=>r>=0.50?_C.green:r>=0.30?_C.amber:_C.red;

  const fl=(lbl,ave,cr,col)=>{
    const avePct=(Math.min(1,Math.max(0,ave||0))*100).toFixed(1);
    const crPct =(Math.min(1,Math.max(0,cr ||0))*100).toFixed(1);
    return `<div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};">
      <div style="font-size:0.78rem;color:${col};font-weight:600;margin-bottom:8px;">${lbl}</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:0.76rem;color:${_C.dim};">AVE</span><span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${ave>=0.50?_C.green:_C.red};">${ave!=null?ave.toFixed(3):'—'}</span></div>
      <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${avePct}%;background:${ave>=0.50?_C.green:_C.red};"></div></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:0.76rem;color:${_C.dim};">CR (ω)</span><span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${cr>=0.70?_C.green:_C.red};">${cr!=null?cr.toFixed(3):'—'}</span></div>
      <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${crPct}%;background:${cr>=0.70?_C.green:_C.red};"></div></div>
      <div style="margin-top:8px;">${aveBadge(ave)}</div>
    </div>`;
  };

  const htmtRows=[['Arch ↔ Exec',d.htmtAE],['Arch ↔ Ctx',d.htmtAC],['Exec ↔ Ctx',d.htmtEC]].map(([pair,v])=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid ${_C.border};"><span style="font-size:0.82rem;color:${_C.muted};">${pair}</span><div style="display:flex;align-items:center;gap:8px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${v!=null?(v<0.85?_C.green:v<0.90?_C.amber:_C.red):_C.dim};">${v!=null?v.toFixed(3):'—'}</span>${htmtBadge(v)}</div></div>`).join('');

  const flCriterion=[['Arch²',d.aveArch,d.corrArchExec**2,d.corrArchCtx**2],['Exec²',d.aveExec,d.corrArchExec**2,d.corrExecCtx**2],['Ctx²',d.aveCtx,d.corrArchCtx**2,d.corrExecCtx**2]];
  const flTable=flCriterion.map(([dom,ave,...rsq])=>{const pass=rsq.every(r2=>r2==null||ave==null||ave>r2);return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid ${_C.border};"><span style="font-size:0.82rem;color:${_C.muted};">${dom}</span><div style="display:flex;align-items:center;gap:6px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">AVE=${ave!=null?ave.toFixed(3):'—'}</span><span style="font-size:0.78rem;color:${_C.dim};">vs r²=${rsq.map(v=>v!=null?v.toFixed(3):'—').join(', ')}</span>${pass?badge('✓ Pass',_C.green):badge('Fail',_C.red)}</div></div>`;}).join('');

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">
      ${fl('Architecture (Q2,Q3,Q6)',d.aveArch,d.crArch,_C.blue)}
      ${fl('Execution (Q1,Q4,Q5,Q8)',d.aveExec,d.crExec,_C.purple)}
      ${fl('Context (Q7)',           d.aveCtx, null,    _C.green)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">HTMT Ratios — Discriminant Validity</div>
        ${htmtRows}
        <div style="padding-top:10px;font-size:0.77rem;color:${_C.dim};line-height:1.6;">Heterotrait-Monotrait ratio. Threshold: <span style="color:${_C.green};">< 0.85</span> (strict) · <span style="color:${_C.amber};">< 0.90</span> (liberal).</div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Fornell-Larcker Criterion</div>
        ${flTable}
        <div style="padding-top:10px;font-size:0.77rem;color:${_C.dim};line-height:1.6;">Discriminant validity holds when each domain's AVE exceeds the squared inter-domain correlation (r²) with every other domain.</div>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Inter-Domain Correlations</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
        ${[['Architecture ↔ Execution',d.corrArchExec,_C.blue,_C.purple],['Architecture ↔ Context',d.corrArchCtx,_C.blue,_C.green],['Execution ↔ Context',d.corrExecCtx,_C.purple,_C.green]].map(([lbl,r,c1,c2])=>`<div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:1.15rem;font-weight:700;color:${r!=null?rColor(Math.abs(r)):_C.dim};">${r!=null?r.toFixed(3):'—'}</div><div style="font-size:0.76rem;color:${_C.dim};margin-top:5px;">${lbl}</div><div style="font-size:0.72rem;color:${_C.dim};margin-top:3px;">r² = ${r!=null?(r**2).toFixed(3):'—'}</div></div>`).join('')}
      </div>
    </div>`;
}

function _saPsyValidityPredictive(container) {
  const inst      = _saPsyInstrument;
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  const base      = _saPsyCache[inst];
  if (!base||base.insufficient){_psyInsuf(container,base||{insufficient:true,n:0},instLabel);return;}
  const d = _saPsyCache[inst+'_validity'];
  if(!d||d.insufficient){_psyInsuf(container,d||{insufficient:true,n:0},instLabel);return;}

  container.innerHTML=`
    <div class="sa-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};">Predictive Validity — ${instLabel} T1 → T2 Lagged Correlation</div>
          <div style="font-size:0.77rem;color:${_C.dim};margin-top:3px;">Does an earlier ${instLabel} score predict a later score? Earliest record = T1 · first record ≥ lag = T2</div>
        </div>
        <div style="display:flex;gap:6px;">
          ${[30,60,90].map(l=>`<button id="sa-psy-pred-lag-${l}" onclick="_saPsyPredSetLag(${l})"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;padding:5px 12px;border-radius:5px;cursor:pointer;transition:all 0.15s;
                   border:1px solid ${l===_saPsyPredLag?'rgba(212,168,67,0.4)':_C.border};
                   background:${l===_saPsyPredLag?'rgba(212,168,67,0.14)':'transparent'};
                   color:${l===_saPsyPredLag?_C.amber:_C.muted};">${l}d</button>`).join('')}
        </div>
      </div>
      <div id="sa-psy-pred-body">${_saPsyPredPanelHtml(d, _saPsyPredLag, inst)}</div>
    </div>
    <div class="sa-panel" style="margin-top:14px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Predictive Validity Interpretation</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">Predictive validity</span><br>Lagged Pearson r between T1 and T2 scores on the same instrument. Measures whether the instrument forecasts future adherence status — the most clinically actionable validity evidence.</div>
        <div><span style="color:${_C.text};">PPV and sensitivity</span><br>Among patients flagged as non-adherent at T1, PPV = proportion still non-adherent at T2. Sensitivity = proportion of T2 non-adherent patients correctly identified at T1. For Classification metrics (F1, MCC, κ, ROC/AUC) see the Classification subtab.</div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — CLASSIFICATION TAB (MMAS-8 / MAP Validity → Classification)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyClassification(container, inst) {
  const instLabel = inst==='map'?'MAP':'MMAS-8';
  const base      = _saPsyCache[inst];
  if (!base||base.insufficient){_psyInsuf(container,base||{insufficient:true,n:0},instLabel);return;}
  const d = _saPsyCache[inst+'_validity'];
  if(!d||d.insufficient){_psyInsuf(container,d||{insufficient:true,n:0},instLabel);return;}

  // Use 30-day lag data
  const pd = d.predictive[30];
  if (!pd||!pd.sufficient) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px 24px;">
      <div style="font-size:0.94rem;color:${_C.text};margin-bottom:10px;">Insufficient Longitudinal Data</div>
      <div style="font-size:0.82rem;color:${_C.muted};line-height:1.65;max-width:440px;margin:0 auto;">
        Classification metrics require at least 10 T1→T2 pairs at 30-day lag. Found ${(pd&&pd.n)||0} pairs.<br>
        Patients need ≥2 ${instLabel} assessments at least 30 days apart.
      </div>
    </div>`;
    return;
  }

  const {TP,FP,FN,TN,n} = pd;
  const m = _psyClassMetrics(TP,FP,FN,TN);
  const cutoff = d.predictive.cutoff;
  const cutLabel = inst==='map'?`PE < ${cutoff}`:`Score < ${cutoff}`;

  // ROC curve from T1 scores vs T2 binary labels
  const t1scores = pd.t1s||pd.sample.map(p=>p.t1);
  const t2labels = pd.sample.map(p=>p.t2<cutoff?1:0);
  const allT1    = pd.t1s  || t1scores;
  const allT2bin = pd.t2s ? pd.t2s.map(v=>v<cutoff?1:0) : t2labels;
  const roc = _psyComputeRoc(allT1, allT2bin);

  const fmtPct = v => v!=null?(v*100).toFixed(1)+'%':'—';
  const fmtDec = v => v!=null?v.toFixed(3):'—';
  const colFor = v => v!=null?(v>=0.70?_C.green:v>=0.50?_C.amber:_C.red):_C.dim;

  const metricCards=[
    {l:'Sensitivity',    v:m.sens,  desc:'True Positive Rate — correctly detected non-adherent patients'},
    {l:'Specificity',    v:m.spec,  desc:'True Negative Rate — correctly identified adherent patients'},
    {l:'PPV',            v:m.ppv,   desc:'Positive Predictive Value — precision of non-adherent flag'},
    {l:'NPV',            v:m.npv,   desc:'Negative Predictive Value — precision of adherent classification'},
    {l:'Accuracy',       v:m.acc,   desc:'Overall classification accuracy at cutoff'},
    {l:'F1 Score',       v:m.f1,    desc:'Harmonic mean of precision and recall'},
    {l:'MCC',            v:m.mcc,   desc:'Matthews Correlation Coefficient — balanced metric for imbalanced classes'},
    {l:"Cohen's κ",      v:m.kappa, desc:'Agreement beyond chance — accounts for class imbalance'},
  ].map(({l,v,desc})=>`
    <div style="padding:14px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${_C.border};">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:1.3rem;font-weight:700;color:${colFor(v!=null?Math.abs(v):null)};">${fmtPct(v)}</div>
      <div style="font-size:0.78rem;color:${_C.text};margin:5px 0 3px;">${l}</div>
      <div style="font-size:0.72rem;color:${_C.dim};line-height:1.4;">${desc}</div>
    </div>`).join('');

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          ${_psyConfusionHtml([[TP,FP],[FN,TN]],['Non-Adherent (T2)','Adherent (T2)'],['Non-Adh. (T1)','Adherent (T1)'],`Classification Matrix — ${instLabel} at 30-day lag · Cutoff: ${cutLabel}`)}
          <div style="margin-top:12px;font-size:0.76rem;color:${_C.dim};line-height:1.6;">
            Rows = T2 (actual outcome) · Columns = T1 (prediction) · Green diagonal = correct classifications · n=${n} longitudinal pairs
          </div>
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">ROC Curve — ${instLabel} Predicting T2 Non-Adherence</div>
        ${_psyRocSvg(roc.points, roc.auc, 340, 220)}
        <div style="margin-top:8px;font-size:0.78rem;color:${_C.dim};">
          AUC = <span style="color:${roc.auc>=0.80?_C.green:roc.auc>=0.70?_C.amber:_C.red};font-family:'IBM Plex Mono',monospace;font-weight:700;">${roc.auc.toFixed(3)}</span> ·
          ${roc.auc>=0.80?'Excellent discrimination.':roc.auc>=0.70?'Acceptable discrimination.':roc.auc>=0.60?'Poor discrimination.':'Near-chance performance.'}
          Threshold = ${cutoff} · n=${n}
        </div>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Classification Metrics — All at Default Cutoff (${cutLabel})</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">${metricCards}</div>
      <div style="font-size:0.78rem;color:${_C.dim};line-height:1.65;padding-top:10px;border-top:1px solid ${_C.border};">
        All metrics use the single binary cutoff above. The ROC curve shows performance across all possible thresholds.
        <span style="color:${_C.text};">MCC ≥ 0.50</span> indicates strong binary classification.
        <span style="color:${_C.text};">Cohen's κ ≥ 0.61</span> indicates substantial agreement.
        For multi-threshold optimization, use AUC as the primary metric.
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// PEACS — EXISTING RENDERS  (unchanged)
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyPeacsOverview(container) {
  const d = _saPsyCache.peacs;
  if (d.insufficient) {
    container.innerHTML = `<div class="sa-panel" style="text-align:center;padding:48px;">
      <div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient PEACS Data</div>
      <div style="font-size:0.84rem;color:${_C.muted};">Found ${d.n.toLocaleString()} records. Minimum 10 required.</div>
    </div>`;
    return;
  }

  const peC = d.pe.mean>=0.75?_C.green:d.pe.mean>=0.50?_C.amber:_C.red;
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      ${_psyKpi('PE Score (mean)',     d.pe.mean.toFixed(3),     peC,    'Predictive Emergence')}
      ${_psyKpi('Architecture (mean)',d.base.mean.toFixed(3),   _C.blue, 'Structural capacity')}
      ${_psyKpi('Execution (mean)',   d.mvmt.mean.toFixed(3),   _C.purple,'Behavioral execution')}
      ${_psyKpi('Context (mean)',     d.strata.mean.toFixed(3), _C.green, 'Situational support')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Subscale Profiles</div>
        ${[['PE Score',d.pe,peC],['Architecture',d.base,_C.blue],['Execution',d.mvmt,_C.purple],['Context',d.strata,_C.green]].map(([l,s,c])=>_psyGauge(l,s.mean,c)).join('')}
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${_C.border};font-size:0.78rem;color:${_C.dim};line-height:1.6;">
          All scores on 0–1 scale. n = ${d.n.toLocaleString()} · ${d.nPaired.toLocaleString()} with all subscales.
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Descriptive Statistics</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.80rem;">
          <thead><tr style="border-bottom:1px solid ${_C.borderB};">
            <th style="padding:6px 10px;color:${_C.dim};font-weight:400;text-align:left;">Scale</th>
            <th style="padding:6px 10px;color:${_C.dim};font-weight:400;text-align:right;">n</th>
            <th style="padding:6px 10px;color:${_C.dim};font-weight:400;text-align:right;">Mean</th>
            <th style="padding:6px 10px;color:${_C.dim};font-weight:400;text-align:right;">SD</th>
            <th style="padding:6px 10px;color:${_C.dim};font-weight:400;text-align:right;">Mdn</th>
          </tr></thead>
          <tbody>
            ${[['PE Score',d.pe,peC],['Architecture',d.base,_C.blue],['Execution',d.mvmt,_C.purple],['Context',d.strata,_C.green]].map(([l,s,c])=>`
              <tr style="border-bottom:1px solid ${_C.border};">
                <td style="padding:8px 10px;color:${c};">${l}</td>
                <td style="padding:8px 10px;font-family:'IBM Plex Mono',monospace;color:${_C.muted};text-align:right;">${s.n.toLocaleString()}</td>
                <td style="padding:8px 10px;font-family:'IBM Plex Mono',monospace;color:${_C.text};text-align:right;">${s.mean.toFixed(3)}</td>
                <td style="padding:8px 10px;font-family:'IBM Plex Mono',monospace;color:${_C.muted};text-align:right;">${s.sd.toFixed(3)}</td>
                <td style="padding:8px 10px;font-family:'IBM Plex Mono',monospace;color:${_C.muted};text-align:right;">${s.p50.toFixed(3)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="sa-panel">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">About PEACS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;font-size:0.82rem;color:${_C.muted};line-height:1.65;">
        <div><span style="color:${_C.text};">Predictive Emergence (PE)</span><br>Geometric mean of Architecture, Execution, and Context scores. Range 0–1 where 1.0 = maximal predicted adherence emergence.</div>
        <div><span style="color:${_C.text};">Architecture · Execution · Context</span><br>Three subscales of the PEACS instrument. Unlike MAP, PEACS stores pre-computed subscale scores rather than raw item responses.</div>
        <div><span style="color:${_C.text};">Note on psychometrics</span><br>PEACS stores composite subscale scores rather than individual item responses, so classical item analysis (α, IRT) applies at subscale level only. See Correlations tab.</div>
      </div>
    </div>`;
}

function _saPsyPeacsSubscales(container) {
  const d = _saPsyCache.peacs;
  if (d.insufficient) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">Insufficient data.</div>`; return; }

  const scales = [
    { l:'Architecture', s:d.base,   c:_C.blue,   desc:'Structural and organizational capacity for adherence — routines, systems, planning behaviors.' },
    { l:'Execution',    s:d.mvmt,   c:_C.purple, desc:'Behavioral execution — action initiation, self-monitoring, dose-taking behavior patterns.' },
    { l:'Context',      s:d.strata, c:_C.green,  desc:'Situational and environmental support factors — social context, access, circumstances.' },
    { l:'PE Score',     s:d.pe,     c:_C.amber,  desc:'Predictive Emergence — geometric mean of all three domain scores. Primary PEACS outcome.' },
  ];

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${scales.map(({l,s,c,desc})=>{
        const iqr=s.p75-s.p25;
        return `<div class="sa-panel">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;">
            <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${c};">${l}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:1.2rem;font-weight:700;color:${c};">${s.mean.toFixed(3)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
            ${[['Min',s.min.toFixed(3)],['Q1',s.p25.toFixed(3)],['Mdn',s.p50.toFixed(3)],['Q3',s.p75.toFixed(3)],['Max',s.max.toFixed(3)],['SD',s.sd.toFixed(3)],['IQR',iqr.toFixed(3)],['n',s.n.toLocaleString()]].map(([k,v])=>`
              <div style="text-align:center;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:${_C.text};">${v}</div>
                <div style="font-size:0.70rem;color:${_C.dim};margin-top:2px;">${k}</div>
              </div>`).join('')}
          </div>
          <div style="position:relative;height:18px;background:rgba(255,255,255,0.04);border-radius:4px;margin-bottom:10px;overflow:hidden;">
            <div style="position:absolute;left:${(s.p25*100).toFixed(1)}%;width:${((s.p75-s.p25)*100).toFixed(1)}%;height:100%;background:${c};opacity:0.3;"></div>
            <div style="position:absolute;left:${(s.p50*100).toFixed(1)}%;width:2px;height:100%;background:${c};opacity:0.9;"></div>
            <div style="position:absolute;left:${(s.min*100).toFixed(1)}%;right:${((1-s.max)*100).toFixed(1)}%;height:2px;top:50%;transform:translateY(-50%);background:${c};opacity:0.5;"></div>
          </div>
          <div style="font-size:0.78rem;color:${_C.dim};line-height:1.55;">${_saEsc(desc)}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function _saPsyPeacsDist(container) {
  const d = _saPsyCache.peacs;
  if (d.insufficient) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">Insufficient data.</div>`; return; }

  const maxBin=Math.max(...d.bins10,1);
  const gradColors=['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#2ec98a','#2ec98a','#2ec98a'];
  const hist=d.bins10.map((cnt,i)=>{
    const h=Math.max(2,(cnt/maxBin)*100);
    const lo=(i/10).toFixed(1),hi=((i+1)/10).toFixed(1);
    const pct=(d.pe.n>0?(cnt/d.pe.n*100):0).toFixed(1);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;"><div title="PE ${lo}–${hi}: ${cnt.toLocaleString()} (${pct}%)" style="width:100%;height:${h}px;background:${gradColors[i]};border-radius:2px 2px 0 0;opacity:0.85;cursor:default;"></div></div>`;
  }).join('');
  const xLabels=Array.from({length:11},(_,i)=>`<div style="flex:1;text-align:${i===0?'left':i===10?'right':'center'};font-size:0.68rem;color:${_C.dim};">${(i/10).toFixed(1)}</div>`).join('');
  const cats=[{l:'Critical',lo:0,hi:0.40,c:'#ef4444'},{l:'Low',lo:0.40,hi:0.55,c:'#f97316'},{l:'Moderate',lo:0.55,hi:0.70,c:'#f59e0b'},{l:'Good',lo:0.70,hi:0.85,c:'#22c55e'},{l:'High',lo:0.85,hi:1.01,c:'#10b981'}];
  const total=d.pe.n;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:4px;">PE Score Distribution</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:14px;">n = ${d.pe.n.toLocaleString()} records · range 0.0 – 1.0</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:100px;margin-bottom:6px;">${hist}</div>
        <div style="display:flex;gap:0;margin-bottom:4px;">${xLabels}</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-top:8px;">Mean <span style="color:${_C.text};">${d.pe.mean.toFixed(3)}</span> · Median <span style="color:${_C.text};">${d.pe.p50.toFixed(3)}</span> · SD <span style="color:${_C.text};">${d.pe.sd.toFixed(3)}</span></div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">PE Category Breakdown</div>
        ${cats.map(cat=>{const cnt=d.peRaw.filter(v=>v>=cat.lo&&v<cat.hi).length;const pct=total>0?(cnt/total*100):0;return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:0.82rem;color:${cat.c};">${cat.l}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.text};">${pct.toFixed(1)}%</span></div><div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct.toFixed(1)}%;background:${cat.c};border-radius:3px;"></div></div><div style="font-size:0.70rem;color:${_C.dim};margin-top:2px;">${cnt.toLocaleString()} records · PE ${cat.lo.toFixed(2)}–${Math.min(cat.hi,1).toFixed(2)}</div></div>`;}).join('')}
      </div>
    </div>`;
}

function _saPsyPeacsCorr(container) {
  const d = _saPsyCache.peacs;
  if (d.insufficient) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">Insufficient data.</div>`; return; }

  const scales=['Architecture','Execution','Context','PE Score'];
  const scaleCols=[_C.blue,_C.purple,_C.green,_C.amber];
  const matrix=[[1,d.corrBM,d.corrBS,d.corrBP],[d.corrBM,1,d.corrMS,d.corrMP],[d.corrBS,d.corrMS,1,d.corrSP],[d.corrBP,d.corrMP,d.corrSP,1]];
  const C=58;
  const heatHeader=`<div style="display:flex;margin-left:${C}px;">${scales.map((s,i)=>`<div style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;font-size:0.70rem;color:${scaleCols[i]};text-align:center;">${s.replace(' ','<br>')}</div>`).join('')}</div>`;
  const heatRows=matrix.map((row,i)=>{
    const cells=row.map((r,j)=>{
      const intensity=Math.abs(r);
      const bg=i===j?`rgba(${i===0?'78,156,245':i===1?'139,111,245':i===2?'46,201,138':'212,168,67'},0.20)`:r>=0?`hsla(142,55%,48%,${(intensity*0.8).toFixed(2)})`:`hsla(0,60%,50%,${(intensity*0.8).toFixed(2)})`;
      const tc=intensity>0.3||i===j?'rgba(240,245,250,0.95)':_C.dim;
      return `<div title="${scales[i]} × ${scales[j]}: r = ${r.toFixed(3)}" style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;background:${bg};font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:${tc};cursor:default;">${i===j?'—':r.toFixed(3)}</div>`;
    }).join('');
    return `<div style="display:flex;"><div style="width:${C}px;height:${C}px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;color:${scaleCols[i]};text-align:center;">${scales[i].replace(' ','<br>')}</div>${cells}</div>`;
  }).join('');

  const interpRow=(l,r,c1,c2)=>{const rc=Math.abs(r)>=0.50?_C.green:Math.abs(r)>=0.30?_C.amber:_C.red;return `<tr style="border-bottom:1px solid ${_C.border};"><td style="padding:8px 12px;font-size:0.82rem;"><span style="color:${c1};">${l.split('×')[0].trim()}</span> × <span style="color:${c2};">${l.split('×')[1].trim()}</span></td><td style="padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:${rc};text-align:right;">${r.toFixed(3)}</td><td style="padding:8px 12px;font-size:0.80rem;color:${_C.dim};">${Math.abs(r)>=0.50?'Strong':Math.abs(r)>=0.30?'Moderate':'Weak'} ${r>=0?'positive':'negative'}</td></tr>`;};

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Subscale Correlation Matrix</div>
        <div style="overflow-x:auto;">${heatHeader}${heatRows}</div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:12px;font-size:0.78rem;color:${_C.dim};">
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:14px;border-radius:2px;background:hsla(142,55%,48%,0.75);"></div>Positive</div>
          <div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:14px;border-radius:2px;background:hsla(0,60%,50%,0.75);"></div>Negative</div>
          <span>n = ${d.nPaired.toLocaleString()} paired records</span>
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Pairwise Correlations</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid ${_C.borderB};">
            <th style="padding:8px 12px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Pair</th>
            <th style="padding:8px 12px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:right;font-weight:400;">r</th>
            <th style="padding:8px 12px;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};text-align:left;font-weight:400;">Strength</th>
          </tr></thead>
          <tbody>
            ${interpRow('Architecture × Execution',d.corrBM,_C.blue,_C.purple)}
            ${interpRow('Architecture × Context',  d.corrBS,_C.blue,_C.green)}
            ${interpRow('Execution × Context',     d.corrMS,_C.purple,_C.green)}
            ${interpRow('Architecture × PE',       d.corrBP,_C.blue,_C.amber)}
            ${interpRow('Execution × PE',          d.corrMP,_C.purple,_C.amber)}
            ${interpRow('Context × PE',            d.corrSP,_C.green,_C.amber)}
          </tbody>
        </table>
        <div style="margin-top:14px;font-size:0.78rem;color:${_C.dim};line-height:1.6;">
          <span style="color:${_C.green};">|r| ≥ 0.50</span> strong · <span style="color:${_C.amber};">0.30–0.49</span> moderate · <span style="color:${_C.red};">&lt; 0.30</span> weak<br>
          Subscale independence supports the 3-domain PE model when inter-subscale correlations are moderate rather than high.
        </div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — PEACS VALIDATION TAB
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyPeacsValidation(container, sub) {
  // Ensure cross-instrument cache
  if (!_saPsyCache.peacs_xval) {
    const peacsRaw = (_saCache.peacs||[]).filter(r=>r.pe!=null);
    const mmasRaw  = (_saCache.mmas||[]).filter(r=>r.tool!=='map'&&r.map_q1===undefined);
    const parseMMAS2=r=>{let s=0;for(let j=1;j<=8;j++){const v=r['q'+j];s+=(typeof v==='number'?v:(v===true||v==='yes'||v==='Yes'||v===1||v==='1')?1:0);}return s;};
    const mmasByPt={};mmasRaw.forEach(r=>{if(!r.patient_number)return;const ts=r.timestamp||0;if(!mmasByPt[r.patient_number]||ts>mmasByPt[r.patient_number].ts)mmasByPt[r.patient_number]={val:parseMMAS2(r),ts};});
    const peacsByPt={};peacsRaw.forEach(r=>{if(!r.patient_number)return;const pe=+(r.pe_score??r.pe??0);const ts=r.timestamp||0;if(!peacsByPt[r.patient_number]||ts>peacsByPt[r.patient_number].ts)peacsByPt[r.patient_number]={val:pe,mmas:null,ts,raw:r};});
    const pairs=[];Object.keys(peacsByPt).forEach(pt=>{if(mmasByPt[pt])pairs.push({pe:peacsByPt[pt].val,mmas:mmasByPt[pt].val});});
    const peArr=pairs.map(p=>p.pe),mmasArr=pairs.map(p=>p.mmas);
    const r=pairs.length>=10?_psyPearson(peArr,mmasArr):null;
    _saPsyCache.peacs_xval={pairs,r,peacsRaw,mmasRaw};
  }

  switch (sub) {
    case 'cross':       _saPsyPeacsValidCross(container);       break;
    case 'confusion':   _saPsyPeacsValidConfusion(container);   break;
    case 'roc':         _saPsyPeacsValidRoc(container);         break;
    case 'calibration': _saPsyPeacsValidCalibration(container); break;
    case 'guard':       _saPsyPeacsValidGuard(container);       break;
    default:            _saPsyPeacsValidCross(container);
  }
}

function _saPsyPeacsValidCross(container) {
  const d   = _saPsyCache.peacs;
  const xv  = _saPsyCache.peacs_xval;
  if (d.insufficient) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">Insufficient PEACS data.</div>`; return; }

  const pairs = xv.pairs;
  const r     = xv.r;
  const rCol  = r!=null?(Math.abs(r)>=0.50?_C.green:Math.abs(r)>=0.30?_C.amber:_C.red):_C.dim;

  const SW=380,SH=200,padL=32,padB=24,padT=12,padR=12;
  const plotW=SW-padL-padR, plotH=SH-padT-padB;
  let scatterContent=`<text x="${padL+plotW/2}" y="${SH/2}" fill="${_C.dim}" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">Insufficient paired data (need ≥10)</text>`;
  if (pairs.length>=10) {
    const sample=pairs.length>300?pairs.filter((_,i)=>i%Math.ceil(pairs.length/300)===0).slice(0,300):pairs;
    const toSX=x=>padL+(Math.min(8,Math.max(0,x))/8)*plotW;
    const toSY=y=>padT+plotH-(Math.min(1,Math.max(0,y))*plotH);
    const dots=sample.map(p=>`<circle cx="${toSX(p.mmas).toFixed(1)}" cy="${toSY(p.pe).toFixed(1)}" r="2.8" fill="${_C.amber}" opacity="0.45"/>`).join('');
    const mx=_psyMean(pairs.map(p=>p.mmas)),my=_psyMean(pairs.map(p=>p.pe));
    let sxy=0,sxx=0;pairs.forEach(p=>{sxy+=(p.mmas-mx)*(p.pe-my);sxx+=(p.mmas-mx)**2;});
    const slope=sxx>0?sxy/sxx:0,ic=my-slope*mx;
    const y0=Math.min(1,Math.max(0,ic)),y8=Math.min(1,Math.max(0,ic+slope*8));
    const tl=`<line x1="${toSX(0).toFixed(1)}" y1="${toSY(y0).toFixed(1)}" x2="${toSX(8).toFixed(1)}" y2="${toSY(y8).toFixed(1)}" stroke="${_C.green}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.85"/>`;
    const axX=[0,2,4,6,8].map(v=>`<text x="${toSX(v).toFixed(1)}" y="${SH-4}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${v}</text>`).join('');
    const axY=[0,0.25,0.5,0.75,1].map(v=>`<text x="${padL-4}" y="${toSY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('');
    scatterContent=dots+tl+axX+axY;
  }

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">MMAS-8 Score × PEACS PE — Concurrent Scatter</div>
        <div style="font-size:0.77rem;color:${_C.dim};margin-bottom:8px;">MMAS-8 (0–8) on x · PEACS PE (0–1) on y · n=${pairs.length}</div>
        <svg width="100%" height="${SH}" viewBox="0 0 ${SW} ${SH}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;">
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.8"/>
          <line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.8"/>
          ${scatterContent}
          <text x="${padL+plotW/2}" y="${SH-1}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">MMAS-8 Score</text>
          <text x="9" y="${padT+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,9,${padT+plotH/2})">PEACS PE</text>
        </svg>
        <div style="margin-top:8px;font-size:0.79rem;color:${_C.dim};">r = <span style="color:${rCol};font-family:'IBM Plex Mono',monospace;font-weight:700;">${r!=null?r.toFixed(3):'—'}</span> · ${r!=null?(Math.abs(r)>=0.50?'Strong convergent validity — PEACS PE and MMAS-8 measure a common underlying construct.':Math.abs(r)>=0.30?'Moderate convergence — expected given different measurement methodologies.':'Weak convergence — review instrument alignment.'):'Insufficient paired data.'}</div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Convergent Validity Summary</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${_psyKpi('r(MMAS ↔ PEACS)', r!=null?r.toFixed(3):'—', rCol, `n=${pairs.length} matched patients`)}
        </div>
        <div style="margin-top:14px;font-size:0.80rem;color:${_C.muted};line-height:1.65;">
          <div style="margin-bottom:10px;"><span style="color:${_C.text};">What this tells you</span><br>Cross-instrument agreement between MMAS-8 and PEACS PE. Strong positive r confirms both instruments are measuring the same latent construct (medication adherence behavior).</div>
          <div><span style="color:${_C.text};">Expected range</span><br>r = 0.40–0.65 is expected given that MMAS-8 is composite and PEACS PE is a geometric mean of subscale scores. Higher r would suggest redundancy; lower r would suggest divergent constructs.</div>
        </div>
      </div>
    </div>`;
}

function _saPsyPeacsValidConfusion(container) {
  const xv = _saPsyCache.peacs_xval;
  if (!xv||xv.pairs.length<10) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px;"><div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient cross-instrument data</div><div style="font-size:0.82rem;color:${_C.muted};">Need ≥10 matched patients with both MMAS-8 and PEACS assessments.</div></div>`;
    return;
  }

  // Map both to 3-tier: Low / Moderate / High
  const toMMAScat = s => s<6?0:s<8?1:2;
  const toPEACScat= p => p<0.55?0:p<0.70?1:2;
  const catLabels = ['Low','Moderate','High'];

  // 3×3 matrix: row = actual MMAS tier, col = PEACS-predicted tier
  const mat = [[0,0,0],[0,0,0],[0,0,0]];
  xv.pairs.forEach(({mmas,pe})=>{
    const mi=toMMAScat(mmas), pi=toPEACScat(pe);
    mat[mi][pi]++;
  });
  const total=xv.pairs.length;
  const acc=(mat[0][0]+mat[1][1]+mat[2][2])/total;

  // Cohen's κ (multi-class)
  const rowSums=mat.map(r=>r.reduce((s,v)=>s+v,0));
  const colSums=[0,1,2].map(j=>mat.reduce((s,r)=>s+r[j],0));
  let pe3=0;[0,1,2].forEach(k=>{pe3+=(rowSums[k]/total)*(colSums[k]/total);});
  const kappa=pe3<1?(acc-pe3)/(1-pe3):1;
  const kappaC=kappa>=0.61?_C.green:kappa>=0.41?_C.amber:_C.red;

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start;margin-bottom:16px;">
      <div class="sa-panel">
        ${_psyConfusionHtml(mat,catLabels.map(l=>l+' (MMAS)'),catLabels.map(l=>l+' (PEACS)'),'PEACS PE Tier (predicted) × MMAS-8 Tier (actual)')}
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${_psyKpi('Overall Accuracy',(acc*100).toFixed(1)+'%',acc>=0.70?_C.green:acc>=0.50?_C.amber:_C.red,'3-class agreement')}
          ${_psyKpi("Cohen's κ",kappa.toFixed(3),kappaC,'Beyond-chance agreement')}
        </div>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Tier Mapping</div>
        <div style="font-size:0.80rem;color:${_C.muted};line-height:1.65;margin-bottom:14px;">
          <div style="margin-bottom:8px;"><span style="color:${_C.text};">MMAS-8 tiers</span> · Low = score &lt; 6 · Moderate = 6–7 · High = 8</div>
          <div style="margin-bottom:8px;"><span style="color:${_C.text};">PEACS PE tiers</span> · Low = PE &lt; 0.55 · Moderate = 0.55–0.70 · High = PE ≥ 0.70</div>
          <div><span style="color:${_C.text};">Interpretation</span><br>Green diagonal cells = agreement between instruments. Off-diagonal cells identify patients where PEACS and MMAS-8 disagree. These divergent cases represent the most clinically interesting population — patients who may be adherent by one metric but at risk by another.</div>
        </div>
        <div style="font-size:0.78rem;color:${_C.dim};line-height:1.6;padding-top:10px;border-top:1px solid ${_C.border};">
          <span style="color:${kappa>=0.61?_C.green:kappa>=0.41?_C.amber:_C.red};">κ = ${kappa.toFixed(3)}</span> — ${kappa>=0.61?'Substantial agreement (Landis & Koch, 1977).':kappa>=0.41?'Moderate agreement — some systematic divergence between instruments.':kappa>=0.21?'Fair agreement — instruments disagree on a meaningful proportion of cases.':'Poor agreement — instruments capturing substantially different constructs.'}
        </div>
      </div>
    </div>`;
}

function _saPsyPeacsValidRoc(container) {
  const xv = _saPsyCache.peacs_xval;
  if (!xv||xv.pairs.length<10) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px;"><div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient cross-instrument data</div><div style="font-size:0.82rem;color:${_C.muted};">Need ≥10 matched patients with both MMAS-8 and PEACS assessments.</div></div>`;
    return;
  }

  // PEACS PE as predictor of MMAS non-adherence (MMAS < 6)
  const scores = xv.pairs.map(p=>p.pe);
  const labels = xv.pairs.map(p=>p.mmas<6?1:0);
  const roc = _psyComputeRoc(scores, labels);

  // Compute confusion metrics at PE = 0.55 threshold
  const thresh=0.55;
  const TP=scores.filter((s,i)=>s<thresh&&labels[i]===1).length;
  const FP=scores.filter((s,i)=>s<thresh&&labels[i]===0).length;
  const FN=scores.filter((s,i)=>s>=thresh&&labels[i]===1).length;
  const TN=scores.filter((s,i)=>s>=thresh&&labels[i]===0).length;
  const m=_psyClassMetrics(TP,FP,FN,TN);
  const fmtPct=v=>v!=null?(v*100).toFixed(1)+'%':'—';
  const col=v=>v!=null?(v>=0.70?_C.green:v>=0.50?_C.amber:_C.red):_C.dim;

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-bottom:16px;align-items:start;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">ROC Curve — PEACS PE predicting MMAS-8 Non-Adherence (score &lt; 6)</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:10px;">n=${xv.pairs.length} matched patients · positive class = MMAS &lt; 6 · PEACS PE as continuous predictor</div>
        ${_psyRocSvg(roc.points, roc.auc, 500, 280)}
        <div style="margin-top:10px;font-size:0.79rem;color:${_C.dim};">
          AUC = <span style="color:${roc.auc>=0.80?_C.green:roc.auc>=0.70?_C.amber:_C.red};font-family:'IBM Plex Mono',monospace;font-weight:700;">${roc.auc.toFixed(3)}</span> ·
          ${roc.auc>=0.80?'Excellent — PEACS PE is a strong predictor of MMAS-8 non-adherence.':roc.auc>=0.70?'Acceptable — PEACS PE is a useful but imperfect predictor.':roc.auc>=0.60?'Poor — limited predictive value for MMAS-8 non-adherence.':'Near-chance — PEACS PE and MMAS non-adherence are poorly correlated.'}
        </div>
      </div>
      <div class="sa-panel" style="min-width:180px;">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">At PE = 0.55 cutoff</div>
        ${[['Sensitivity',m.sens],['Specificity',m.spec],['PPV',m.ppv],['NPV',m.npv],['Accuracy',m.acc],['F1',m.f1]].map(([l,v])=>`
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:0.80rem;color:${_C.muted};">${l}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${col(v)};">${fmtPct(v)}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${v!=null?(Math.abs(v)*100).toFixed(1):0}%;background:${col(v)};border-radius:2px;"></div></div>
          </div>`).join('')}
      </div>
    </div>`;
}

function _saPsyPeacsValidCalibration(container) {
  const xv = _saPsyCache.peacs_xval;
  if (!xv||xv.pairs.length<10) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px;"><div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient cross-instrument data</div></div>`;
    return;
  }

  // Divide PE scores into 5 bins (matching zone boundaries)
  const bins=[
    {l:'Critical',lo:0,    hi:0.40,c:'#ef4444'},
    {l:'Low',     lo:0.40, hi:0.55,c:'#f97316'},
    {l:'Moderate',lo:0.55, hi:0.70,c:'#f59e0b'},
    {l:'Good',    lo:0.70, hi:0.85,c:'#22c55e'},
    {l:'High',    lo:0.85, hi:1.01,c:'#10b981'},
  ];

  const calibData=bins.map(bin=>{
    const inBin=xv.pairs.filter(p=>p.pe>=bin.lo&&p.pe<bin.hi);
    const n=inBin.length;
    const meanPE=n>0?_psyMean(inBin.map(p=>p.pe)):null;
    const obsAdh=n>0?inBin.filter(p=>p.mmas>=6).length/n:null;
    return{...bin,n,meanPE,obsAdh};
  }).filter(b=>b.n>0);

  const W=480,H=240,padL=40,padB=40,padT=20,padR=20;
  const plotW=W-padL-padR,plotH=H-padT-padB;
  const toX=pe=>padL+(Math.min(1,Math.max(0,pe))*plotW);
  const toY=p=>padT+plotH-(Math.min(1,Math.max(0,p))*plotH);

  // Diagonal reference line (perfect calibration)
  const diagLine=`<line x1="${toX(0)}" y1="${toY(0)}" x2="${toX(1)}" y2="${toY(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>`;
  const ticks=[0,0.25,0.5,0.75,1.0];
  const axX=ticks.map(v=>`<text x="${toX(v).toFixed(1)}" y="${padT+plotH+15}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('');
  const axY=ticks.map(v=>`<text x="${padL-5}" y="${toY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('');
  const grid=ticks.map(v=>`<line x1="${padL}" y1="${toY(v).toFixed(1)}" x2="${padL+plotW}" y2="${toY(v).toFixed(1)}" stroke="${_C.border}" stroke-width="0.6"/><line x1="${toX(v).toFixed(1)}" y1="${padT}" x2="${toX(v).toFixed(1)}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.6"/>`).join('');

  const bars=calibData.map(b=>{
    if(b.meanPE==null||b.obsAdh==null)return '';
    const bW=22;
    const x=toX(b.meanPE)-bW/2;
    const y0=toY(0);
    const bH=b.obsAdh*(plotH);
    const y1=y0-bH;
    const dot=`<circle cx="${toX(b.meanPE).toFixed(1)}" cy="${toY(b.obsAdh).toFixed(1)}" r="5" fill="${b.c}" stroke="${_C.ink}" stroke-width="1.5"/>`;
    return dot+`<text x="${toX(b.meanPE).toFixed(1)}" y="${toY(b.obsAdh)-9}" fill="${b.c}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${(b.obsAdh*100).toFixed(0)}%</text>`;
  }).join('');

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Calibration Plot — PEACS PE vs Observed MMAS Adherence Rate</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:10px;">Diagonal = perfect calibration · Dots = observed adherence rate per PE zone · n=${xv.pairs.length} paired</div>
        <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:6px;overflow:hidden;">
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          <line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          ${grid}${diagLine}${bars}${axX}${axY}
          <text x="${padL+plotW/2}" y="${H-2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">Mean PEACS PE (zone midpoint)</text>
          <text x="9" y="${padT+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,9,${padT+plotH/2})">Observed MMAS Adherence Rate</text>
        </svg>
      </div>
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">Calibration Table</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
          <thead><tr style="border-bottom:1px solid ${_C.borderB};">
            <th style="padding:6px 8px;color:${_C.dim};font-weight:400;text-align:left;">Zone</th>
            <th style="padding:6px 8px;color:${_C.dim};font-weight:400;text-align:right;">n</th>
            <th style="padding:6px 8px;color:${_C.dim};font-weight:400;text-align:right;">Mean PE</th>
            <th style="padding:6px 8px;color:${_C.dim};font-weight:400;text-align:right;">Obs. Adh.</th>
          </tr></thead>
          <tbody>
            ${calibData.map(b=>`<tr style="border-bottom:1px solid ${_C.border};">
              <td style="padding:7px 8px;color:${b.c};">${b.l}</td>
              <td style="padding:7px 8px;font-family:'IBM Plex Mono',monospace;color:${_C.muted};text-align:right;">${b.n}</td>
              <td style="padding:7px 8px;font-family:'IBM Plex Mono',monospace;color:${_C.text};text-align:right;">${b.meanPE!=null?b.meanPE.toFixed(3):'—'}</td>
              <td style="padding:7px 8px;font-family:'IBM Plex Mono',monospace;color:${b.obsAdh!=null?(b.obsAdh>=0.70?_C.green:b.obsAdh>=0.40?_C.amber:_C.red):_C.dim};text-align:right;">${b.obsAdh!=null?(b.obsAdh*100).toFixed(1)+'%':'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:12px;font-size:0.76rem;color:${_C.dim};line-height:1.6;">
          A well-calibrated model has dots near the diagonal — PE zone predicts actual MMAS adherence rate accurately. Dots above diagonal = PEACS under-predicts adherence (conservative). Dots below = over-predicts.
        </div>
      </div>
    </div>`;
}

function _saPsyPeacsValidGuard(container) {
  const d = _saPsyCache.peacs;
  if (d.insufficient) { container.innerHTML=`<div style="padding:40px;text-align:center;color:${_C.muted};">Insufficient PEACS data.</div>`; return; }

  // strata values are C_guarded (0.5 + 0.5 * C_raw)
  // C_raw = (strata - 0.5) * 2  →  range [0, 1] assuming strata ∈ [0.5, 1.0]
  const strataVals = d.raw ? d.raw.map(r=>parseFloat(r.strata??0)).filter(v=>!isNaN(v)&&v>=0) : d.peRaw.map(()=>0.75);
  const cRaw = strataVals.map(v=>Math.max(0,Math.min(1,(v-0.5)*2)));
  const nWithZeroRaw = cRaw.filter(v=>v<=0.05).length;
  const nTotal = cRaw.length||1;

  // Transform curve points
  const W=320,H=200,padL=36,padB=28,padT=16,padR=16;
  const plotW=W-padL-padR,plotH=H-padT-padB;
  const toX=raw=>padL+(raw*plotW);
  const toY=g=>padT+plotH-((g-0)*plotH);   // y: 0 at bottom, 1 at top, but guard range is 0.5–1.0
  const toYg=g=>padT+plotH-((g-0.5)/0.5*plotH);  // guard value maps [0.5,1.0] to [bottom,top]

  const curvePts=Array.from({length:101},(_,i)=>{const x=i/100;const y=0.5+0.5*x;return `${toX(x).toFixed(1)},${toYg(y).toFixed(1)}`;}).join(' ');
  const ticks=[0,0.25,0.5,0.75,1.0];
  const axX=ticks.map(v=>`<text x="${toX(v).toFixed(1)}" y="${padT+plotH+14}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('');
  const axY=[0.5,0.625,0.75,0.875,1.0].map(v=>`<text x="${padL-5}" y="${toYg(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(3)}</text>`).join('');

  // Histogram of C_raw (before guard)
  const nBins=10;
  const binsRaw=Array.from({length:nBins},(_,i)=>cRaw.filter(v=>v>=i/nBins&&v<(i+1)/nBins).length);
  binsRaw[nBins-1]+=cRaw.filter(v=>v>=1.0).length;
  const maxBin=Math.max(...binsRaw,1);

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Context Guard Transform — C<sub>raw</sub> → C<sub>guarded</sub></div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:10px;">C<sub>guarded</sub> = 0.5 + 0.5 × C<sub>raw</sub> · maps [0, 1] → [0.5, 1.0]</div>
        <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:5px;overflow:hidden;">
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          <line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          ${ticks.map(v=>`<line x1="${toX(v).toFixed(1)}" y1="${padT}" x2="${toX(v).toFixed(1)}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="0.6"/>`).join('')}
          <polyline points="${curvePts}" fill="none" stroke="${_C.green}" stroke-width="2.2"/>
          <!-- 0.5 floor line -->
          <line x1="${padL}" y1="${toYg(0.5).toFixed(1)}" x2="${padL+plotW}" y2="${toYg(0.5).toFixed(1)}" stroke="${_C.amber}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.7"/>
          <text x="${padL+4}" y="${toYg(0.5).toFixed(1)-3}" fill="${_C.amber}" font-size="9" font-family="IBM Plex Mono">floor = 0.500</text>
          ${axX}${axY}
          <text x="${padL+plotW/2}" y="${H-2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">C_raw (raw Context score)</text>
          <text x="9" y="${padT+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,9,${padT+plotH/2})">C_guarded</text>
        </svg>
      </div>
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">C_raw Distribution — Cohort (n=${nTotal.toLocaleString()})</div>
          <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:8px;">
            ${binsRaw.map((cnt,i)=>{const h=Math.max(2,(cnt/maxBin)*80);const pct=(nTotal>0?(cnt/nTotal*100):0).toFixed(1);return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;"><div title="C_raw ${(i/nBins).toFixed(1)}–${((i+1)/nBins).toFixed(1)}: ${cnt} (${pct}%)" style="width:100%;height:${h}px;background:${_C.green};border-radius:2px 2px 0 0;opacity:0.75;cursor:default;"></div></div>`;}).join('')}
          </div>
          <div style="display:flex;gap:4px;">
            ${Array.from({length:nBins+1},(_,i)=>`<div style="flex:1;text-align:center;font-size:0.62rem;color:${_C.dim};">${(i/nBins).toFixed(1)}</div>`).join('')}
          </div>
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:12px;">Guard Impact</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            ${_psyKpi('Near-zero C_raw',(nWithZeroRaw/nTotal*100).toFixed(1)+'%',_C.amber,`${nWithZeroRaw} of ${nTotal} records`)}
            ${_psyKpi('PE Floor Protected',nWithZeroRaw.toLocaleString(),_C.green,'Records preserved from PE = 0')}
          </div>
          <div style="font-size:0.78rem;color:${_C.dim};line-height:1.65;">
            Without the Context Guard, any record with C_raw = 0 would produce PE = 0 — even if Architecture and Execution are excellent. The guard preserves the signal from ${nWithZeroRaw.toLocaleString()} record${nWithZeroRaw!==1?'s':''} (${(nWithZeroRaw/nTotal*100).toFixed(1)}% of cohort) by applying a 0.5 floor to the Context dimension.
          </div>
        </div>
      </div>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW — PEACS TRAJECTORIES TAB
// ══════════════════════════════════════════════════════════════════════════════

function _saPsyPeacsTrajectories(container, sub) {
  // Build longitudinal cache
  if (!_saPsyCache.peacs_traj) {
    const raw = (_saCache.peacs||[]).filter(r=>r.pe!=null&&r.patient_number&&r.timestamp);
    const byPt={};
    raw.forEach(r=>{
      if(!byPt[r.patient_number]) byPt[r.patient_number]=[];
      byPt[r.patient_number].push({pe:+(r.pe_score??r.pe??0), ts:+r.timestamp, base:+(r.base??0), mvmt:+(r.mvmt??0), strata:+(r.strata??0)});
    });
    Object.values(byPt).forEach(arr=>arr.sort((a,b)=>a.ts-b.ts));
    const longitudinal=Object.values(byPt).filter(arr=>arr.length>=2);
    _saPsyCache.peacs_traj={byPt,longitudinal,nPatients:Object.keys(byPt).length,nLong:longitudinal.length};
  }

  switch (sub) {
    case 'longitudinal': _saPsyPeacsLongitudinal(container); break;
    case 'zones':        _saPsyPeacsZoneTransitions(container); break;
    case 'drift':        _saPsyPeacsDrift(container); break;
    default:             _saPsyPeacsLongitudinal(container);
  }
}

function _saPsyPeacsLongitudinal(container) {
  const traj = _saPsyCache.peacs_traj;
  if (traj.nLong < 5) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:48px 24px;">
      <div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient Longitudinal Data</div>
      <div style="font-size:0.84rem;color:${_C.muted};max-width:440px;margin:0 auto;line-height:1.65;">
        Found ${traj.nLong.toLocaleString()} patients with ≥2 PEACS assessments. Need ≥5 for trajectory analysis.<br>
        Ensure patient_number and timestamp fields are present in PEACS records.
      </div>
    </div>`;
    return;
  }

  // Build cohort mean PE by assessment index (up to 8)
  const maxIdx=Math.max(...traj.longitudinal.map(arr=>arr.length));
  const cohortByIdx=Array.from({length:Math.min(maxIdx,8)},(_,i)=>{
    const vals=traj.longitudinal.filter(arr=>arr.length>i).map(arr=>arr[i].pe);
    return{idx:i+1,mean:_psyMean(vals),n:vals.length,sd:_psySD(vals)};
  });

  const W=520,H=200,padL=40,padB=30,padT=16,padR=16;
  const plotW=W-padL-padR,plotH=H-padT-padB;
  const maxIdx2=cohortByIdx.length;
  const toX=i=>padL+(i/(maxIdx2-1||1))*plotW;
  const toY=v=>padT+plotH-(Math.min(1,Math.max(0,v))*plotH);

  // Individual trajectories (max 50)
  const sample=traj.longitudinal.slice(0,50);
  const trailLines=sample.map(arr=>{
    const pts=arr.slice(0,8).map((p,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(p.pe).toFixed(1)}`).join('');
    const finalPE=arr[arr.length-1].pe;
    const col=finalPE>=0.70?'rgba(46,201,138,0.25)':finalPE>=0.55?'rgba(245,158,11,0.20)':'rgba(239,68,68,0.20)';
    return `<path d="${pts}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
  }).join('');

  // Cohort mean line
  const meanLine=cohortByIdx.map((p,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(p.mean).toFixed(1)}`).join('');
  const meanDots=cohortByIdx.map((p,i)=>`<circle cx="${toX(i).toFixed(1)}" cy="${toY(p.mean).toFixed(1)}" r="4" fill="${_C.amber}" stroke="${_C.ink}" stroke-width="1.5"/><title>Assessment ${p.idx}: mean=${p.mean.toFixed(3)} n=${p.n}</title>`).join('');

  const yTicks=[0,0.25,0.5,0.75,1.0];
  const axX=cohortByIdx.map((p,i)=>`<text x="${toX(i).toFixed(1)}" y="${padT+plotH+16}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">A${p.idx}<br>(n=${p.n})</text>`).join('');
  const axY=yTicks.map(v=>`<text x="${padL-5}" y="${toY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(2)}</text><line x1="${padL}" y1="${toY(v).toFixed(1)}" x2="${padL+plotW}" y2="${toY(v).toFixed(1)}" stroke="${_C.border}" stroke-width="0.6"/>`).join('');

  container.innerHTML=`
    <div class="sa-panel" style="margin-bottom:16px;">
      <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Longitudinal PE Trajectories — ${traj.nLong.toLocaleString()} patients with ≥2 assessments</div>
      <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:10px;">Grey/colored lines = individual patients (max 50 shown) · Amber line = cohort mean PE by assessment number</div>
      <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:6px;overflow:hidden;">
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
        <line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
        ${axY}${trailLines}
        <path d="${meanLine}" fill="none" stroke="${_C.amber}" stroke-width="2.5"/>
        ${meanDots}
        ${cohortByIdx.map((p,i)=>`<text x="${toX(i).toFixed(1)}" y="${padT+plotH+16}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">A${p.idx}</text>`).join('')}
        <text x="9" y="${padT+plotH/2}" fill="${_C.dim}" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-90,9,${padT+plotH/2})">PE Score</text>
      </svg>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(${Math.min(cohortByIdx.length,6)},1fr);gap:8px;">
        ${cohortByIdx.slice(0,6).map(p=>`<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.02);border-radius:4px;border:1px solid ${_C.border};"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;font-weight:600;color:${p.mean>=0.70?_C.green:p.mean>=0.55?_C.amber:_C.red};">${p.mean.toFixed(3)}</div><div style="font-size:0.68rem;color:${_C.dim};margin-top:2px;">Assess. ${p.idx}</div><div style="font-size:0.66rem;color:${_C.dim};">n=${p.n}</div></div>`).join('')}
      </div>
    </div>`;
}

function _saPsyPeacsZoneTransitions(container) {
  const traj = _saPsyCache.peacs_traj;
  if (traj.nLong < 5) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px 24px;"><div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient Longitudinal Data</div><div style="font-size:0.84rem;color:${_C.muted};">Need ≥5 patients with ≥2 PEACS assessments.</div></div>`;
    return;
  }

  const zoneOf=pe=>pe>=0.70?'High':pe>=0.55?'Moderate':'Low';
  const zoneColors={'High':_C.green,'Moderate':_C.amber,'Low':_C.red};
  const zones=['Low','Moderate','High'];

  // Count all consecutive transitions
  const transMatrix={};
  zones.forEach(f=>{transMatrix[f]={};zones.forEach(t=>{transMatrix[f][t]=0;});});
  traj.longitudinal.forEach(arr=>{
    for(let i=1;i<arr.length;i++){
      const from=zoneOf(arr[i-1].pe), to=zoneOf(arr[i].pe);
      transMatrix[from][to]++;
    }
  });

  const rowTotal=f=>zones.reduce((s,t)=>s+transMatrix[f][t],0);
  const improving=zones.slice(0,-1).reduce((s,f)=>s+transMatrix[f].High+transMatrix[f].Moderate,0);
  const declining=zones.slice(1).reduce((s,t)=>s+transMatrix.High[t]+transMatrix.Moderate[t]-(t==='Moderate'?transMatrix.Moderate.High:0),0);
  const stable=zones.reduce((s,z)=>s+transMatrix[z][z],0);
  const totalTrans=Object.values(transMatrix).flatMap(v=>Object.values(v)).reduce((s,v)=>s+v,0)||1;

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:auto 1fr;gap:20px;margin-bottom:16px;align-items:start;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Zone Transition Matrix</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:12px;">Row = from-zone · Column = to-zone · n=${totalTrans.toLocaleString()} transitions</div>
        <div style="display:flex;flex-direction:column;">
          <div style="display:flex;margin-left:90px;">${zones.map(z=>`<div style="width:90px;text-align:center;font-size:0.76rem;color:${zoneColors[z]};padding:6px 4px;">→ ${z}</div>`).join('')}</div>
          ${zones.map(f=>{
            const rt=rowTotal(f)||1;
            return `<div style="display:flex;align-items:center;">
              <div style="width:90px;text-align:right;padding-right:10px;font-size:0.78rem;color:${zoneColors[f]};">${f} →</div>
              ${zones.map(t=>{
                const cnt=transMatrix[f][t];
                const pct=rt>0?(cnt/rt*100).toFixed(0):'0';
                const isDiag=f===t;
                const isImprove=(f==='Low'&&t!=='Low')||(f==='Moderate'&&t==='High');
                const isDecline=(f==='High'&&t!=='High')||(f==='Moderate'&&t==='Low');
                const bg=isDiag?`rgba(46,201,138,${(cnt/rt*0.6+0.1).toFixed(2)})`:isImprove?`rgba(46,201,138,${(cnt/rt*0.4).toFixed(2)})`:isDecline?`rgba(239,68,68,${(cnt/rt*0.4).toFixed(2)})`:cnt===0?'rgba(255,255,255,0.02)':'rgba(245,158,11,0.15)';
                const tc=cnt>0?'rgba(232,240,248,0.9)':_C.dim;
                return `<div style="width:90px;height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bg};border:1px solid rgba(255,255,255,0.05);">
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:1.2rem;font-weight:700;color:${tc};">${cnt}</div>
                  <div style="font-size:0.68rem;color:${tc};opacity:0.75;">${pct}% of row</div>
                </div>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div>
        <div class="sa-panel" style="margin-bottom:14px;">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Transition Summary</div>
          ${[
            {l:'Improving',   n:improving,   c:_C.green,  desc:'Moved to a higher PE zone between assessments'},
            {l:'Stable',      n:stable,      c:_C.amber,  desc:'Remained in same PE zone between assessments'},
            {l:'Declining',   n:totalTrans-improving-stable, c:_C.red, desc:'Moved to a lower PE zone between assessments'},
          ].map(g=>{
            const pct=(g.n/totalTrans*100);
            return `<div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span style="font-size:0.82rem;color:${g.c};">${g.l}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;font-weight:700;color:${g.c};">${pct.toFixed(1)}% <span style="font-size:0.74rem;color:${_C.dim};">(${g.n})</span></span>
              </div>
              <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:4px;">
                <div style="height:100%;width:${pct.toFixed(1)}%;background:${g.c};border-radius:3px;"></div>
              </div>
              <div style="font-size:0.73rem;color:${_C.dim};">${g.desc}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="sa-panel">
          <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:10px;">Zone Definitions</div>
          <div style="font-size:0.78rem;color:${_C.muted};line-height:1.65;">
            <span style="color:${_C.green};">High</span> = PE ≥ 0.70 (Good + High zones) ·
            <span style="color:${_C.amber};">Moderate</span> = PE 0.55–0.70 ·
            <span style="color:${_C.red};">Low</span> = PE &lt; 0.55 (Low + Critical zones).
            Transitions are counted for every consecutive pair of assessments per patient.
          </div>
        </div>
      </div>
    </div>`;
}

function _saPsyPeacsDrift(container) {
  const traj = _saPsyCache.peacs_traj;
  if (traj.nLong < 5) {
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px 24px;"><div style="font-size:0.94rem;color:${_C.text};margin-bottom:8px;">Insufficient Longitudinal Data</div><div style="font-size:0.84rem;color:${_C.muted};">Need ≥5 patients with ≥2 PEACS assessments for drift analysis.</div></div>`;
    return;
  }

  // Aggregate by calendar month
  const allRecs=[];
  Object.values(traj.byPt).forEach(arr=>arr.forEach(p=>allRecs.push(p)));
  allRecs.sort((a,b)=>a.ts-b.ts);

  const monthBuckets={};
  allRecs.forEach(p=>{
    const d=new Date(p.ts);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!monthBuckets[key]) monthBuckets[key]=[];
    monthBuckets[key].push(p.pe);
  });
  const months=Object.keys(monthBuckets).sort().slice(-24); // last 24 months
  const mData=months.map((k,i)=>({key:k,idx:i,mean:_psyMean(monthBuckets[k]),n:monthBuckets[k].length}));

  if(mData.length<3){
    container.innerHTML=`<div class="sa-panel" style="text-align:center;padding:40px;"><div style="font-size:0.86rem;color:${_C.muted};">Need data across ≥3 calendar months for drift analysis.</div></div>`;
    return;
  }

  // Linear regression on month index vs mean PE
  const xs=mData.map(m=>m.idx), ys=mData.map(m=>m.mean);
  const mx=_psyMean(xs),my=_psyMean(ys);
  let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;});
  const slope=sxx>0?sxy/sxx:0, intercept=my-slope*mx;
  const r2=_psyPearson(xs,ys)**2;
  const trendDir=slope>0.005?'Improving':slope<-0.005?'Declining':'Stable';
  const trendCol=trendDir==='Improving'?_C.green:trendDir==='Declining'?_C.red:_C.amber;

  const W=520,H=200,padL=40,padB=40,padT=16,padR=16;
  const plotW=W-padL-padR,plotH=H-padT-padB;
  const n2=mData.length;
  const toX=i=>padL+(i/(n2-1||1))*plotW;
  const allY=[...ys,intercept,intercept+slope*(n2-1)].filter(v=>!isNaN(v));
  const yMin=Math.max(0,Math.min(...allY)-0.05),yMax=Math.min(1,Math.max(...allY)+0.05);
  const toY=v=>padT+plotH-((v-yMin)/(yMax-yMin||0.01))*plotH;

  const bars=mData.map((m,i)=>`<rect x="${toX(i)-5}" y="${toY(m.mean).toFixed(1)}" width="10" height="${(plotH-(plotH-((m.mean-yMin)/(yMax-yMin||0.01))*plotH)).toFixed(1)}" fill="${_C.amber}" opacity="0.6" rx="2"/><circle cx="${toX(i).toFixed(1)}" cy="${toY(m.mean).toFixed(1)}" r="3.5" fill="${_C.amber}"/>`).join('');
  const trendPath=`M${toX(0).toFixed(1)},${toY(intercept).toFixed(1)} L${toX(n2-1).toFixed(1)},${toY(intercept+slope*(n2-1)).toFixed(1)}`;
  const xLabels=mData.filter((_,i)=>i%Math.max(1,Math.floor(n2/6))===0).map((m,_,arr)=>`<text x="${toX(m.idx).toFixed(1)}" y="${padT+plotH+20}" fill="${_C.dim}" font-size="8" text-anchor="middle" font-family="IBM Plex Mono" transform="rotate(-40,${toX(m.idx).toFixed(1)},${padT+plotH+20})">${m.key}</text>`).join('');

  container.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-bottom:16px;align-items:start;">
      <div class="sa-panel">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;">Cohort PE Drift — Monthly Mean with Trend</div>
        <div style="font-size:0.78rem;color:${_C.dim};margin-bottom:10px;">${mData.length} months · Last ${mData.length} periods shown · Total n=${allRecs.length.toLocaleString()} assessment records</div>
        <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:rgba(255,255,255,0.02);border-radius:6px;overflow:hidden;">
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          <line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="${_C.border}" stroke-width="1"/>
          ${[0.25,0.5,0.75,1.0].filter(v=>v>=yMin&&v<=yMax).map(v=>`<line x1="${padL}" y1="${toY(v).toFixed(1)}" x2="${padL+plotW}" y2="${toY(v).toFixed(1)}" stroke="${_C.border}" stroke-width="0.6"/><text x="${padL-4}" y="${toY(v).toFixed(1)+3}" fill="${_C.dim}" font-size="9" text-anchor="end" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`).join('')}
          ${bars}
          <path d="${trendPath}" fill="none" stroke="${trendCol}" stroke-width="2" stroke-dasharray="5,3" opacity="0.85"/>
          ${xLabels}
        </svg>
        <div style="margin-top:8px;font-size:0.78rem;color:${_C.dim};">
          Trend: <span style="color:${trendCol};font-family:'IBM Plex Mono',monospace;font-weight:700;">${trendDir}</span> ·
          Slope = <span style="font-family:'IBM Plex Mono',monospace;">${(slope*1000).toFixed(2)}</span> per 1000 months ·
          R² = <span style="font-family:'IBM Plex Mono',monospace;">${r2.toFixed(3)}</span>
        </div>
      </div>
      <div class="sa-panel" style="min-width:180px;">
        <div style="font-size:0.74rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:14px;">Drift Summary</div>
        ${_psyKpi('Direction', trendDir, trendCol, 'Linear trend direction')}
        <div style="margin-top:12px;font-size:0.78rem;color:${_C.muted};line-height:1.65;">
          <div style="margin-bottom:8px;"><span style="color:${_C.text};">Slope</span><br>${(slope*1000).toFixed(2)} PE units / 1,000 months</div>
          <div style="margin-bottom:8px;"><span style="color:${_C.text};">R²</span><br>${r2.toFixed(3)} — ${r2>=0.40?'Strong':r2>=0.20?'Moderate':'Weak'} linear fit</div>
          <div><span style="color:${_C.text};">Interpretation</span><br>${trendDir==='Improving'?'Cohort PE is rising over time — intervention programs may be effective.':trendDir==='Declining'?'Cohort PE is falling — consider reviewing intervention intensity or cohort composition changes.':'No meaningful linear trend detected — cohort PE is stable.'}</div>
        </div>
      </div>
    </div>`;
}
