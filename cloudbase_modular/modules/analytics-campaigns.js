// ══════════════════════════════════════════════
// COHORT PDF EXPORT — canvas-rendered one-pager
// No external library. Uses window.open + print.
// ══════════════════════════════════════════════
/**
 * Exports a one-page cohort summary PDF using canvas rendering and `window.print()`.
 * Reads MMAS and PEACS data from `dashMmasData` and `dashPeacsData` globals.
 * No external library — builds a styled `<div>` in a new window and prints it.
 * @returns {void}
 */
function exportCohortPDF() {
  const mmas  = (typeof dashMmasData  !== 'undefined' && dashMmasData.length)  ? dashMmasData  : [];
  const peacs = (typeof dashPeacsData !== 'undefined' && dashPeacsData.length) ? dashPeacsData : [];

  if (!mmas.length && !peacs.length) {
    showToast('No cohort data loaded yet.', 2500);
    return;
  }

  const btn = document.getElementById('cohort-pdf-btn');
  if (btn) { btn.textContent = '⟳ Building…'; btn.disabled = true; }

  // ── Stats ──────────────────────────────────────
  const valid   = mmas.filter(r => r.score !== undefined && r.score !== null);
  const n       = valid.length;
  const avgS    = n ? (valid.reduce((s,r)=>s+(r.score||0),0)/n).toFixed(2) : '—';
  const hiN     = valid.filter(r=>r.score===8).length;
  const unaN    = valid.filter(r=>r.score>=6&&r.score<8).length;
  const inaN    = valid.filter(r=>r.score<6).length;
  const hiPct   = n ? Math.round(hiN/n*100) : 0;
  const unaPct  = n ? Math.round(unaN/n*100) : 0;
  const inaPct  = n ? Math.round(inaN/n*100) : 0;
  const countries = [...new Set(valid.map(r=>r.country).filter(c=>c&&c!=='Unknown'))];

  const pValid  = peacs.filter(r=>r.pe!==undefined&&r.pe!==null);
  const avgPE   = pValid.length ? (pValid.reduce((s,r)=>s+(r.pe||0),0)/pValid.length).toFixed(3) : '—';
  const avgBase = pValid.length ? (pValid.reduce((s,r)=>s+(r.base||0),0)/pValid.length).toFixed(3) : '—';
  const avgMvmt = pValid.length ? (pValid.reduce((s,r)=>s+(r.mvmt||0),0)/pValid.length).toFixed(3) : '—';
  const avgStr  = pValid.length ? (pValid.reduce((s,r)=>s+(r.strata||0),0)/pValid.length).toFixed(3) : '—';

  const ws   = (typeof currentWorkspace !== 'undefined' && currentWorkspace) ? currentWorkspace : 'Cohort';
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  // Score distribution (0–8)
  const dist = Array(9).fill(0);
  valid.forEach(r => { const sc=r.score||0; dist[sc>=8?8:Math.min(7,Math.max(0,Math.floor(sc)))]++; });
  const distMax = Math.max(...dist, 1);

  // ── Build HTML ──────────────────────────────────
  const barRows = dist.map((v,i) => {
    const pct = Math.round(v/n*100);
    const w   = Math.round(v/distMax*200);
    const col = i===8?'#10b981':i>=6?'#3b82f6':i>=4?'#f59e0b':'#ef4444';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:#888;width:18px;text-align:right;padding-right:6px;">${i}</td>
      <td><div style="height:12px;width:${w}px;background:${col};border-radius:2px;"></div></td>
      <td style="font-family:monospace;font-size:10px;color:#666;padding-left:6px;">${v} <span style="color:#aaa;">(${pct}%)</span></td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>ATLAS Cohort Report · ${ws} · ${date}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#fff;color:#1a2535;font-family:'IBM Plex Sans',sans-serif;padding:40px 52px;}
    @media print{body{padding:20px 32px;}}
    .header-rule{height:3px;background:linear-gradient(90deg,#1a2535,#d4a843,transparent);margin-bottom:28px;}
    h1{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:#080e1a;letter-spacing:0.03em;}
    .sub{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a9ab0;margin-top:4px;margin-bottom:28px;}
    .section-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:#d4a843;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #eee;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;}
    .kpi{background:#f8f7f5;border-radius:6px;padding:14px 16px;border-left:3px solid #e8e4dc;}
    .kpi.hi{border-left-color:#10b981;} .kpi.una{border-left-color:#3b82f6;} .kpi.ina{border-left-color:#ef4444;} .kpi.pe{border-left-color:#d4a843;}
    .kpi-val{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:#080e1a;line-height:1;}
    .kpi-lbl{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#8a9ab0;margin-top:4px;}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
    .card{background:#f8f7f5;border-radius:8px;padding:18px 20px;}
    table.dist td{padding:2px 0;}
    .peacs-dims{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px;}
    .dim{text-align:center;padding:10px;background:#fff;border-radius:6px;border:1px solid #eee;}
    .dim-val{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;}
    .dim-lbl{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#8a9ab0;margin-top:3px;}
    .footer{margin-top:32px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}
    .footer-brand{font-family:'Cormorant Garamond',serif;font-size:13px;color:#8a9ab0;}
    .footer-legal{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#aaa;text-align:right;max-width:320px;line-height:1.5;}
    .country-list{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#6b7a8d;line-height:1.8;margin-top:8px;}
  </style>
  </head><body>
  <div class="header-rule"></div>
  <h1>Adherence <em style="font-style:italic;color:#d4a843;">Cartography</em> · ATLAS</h1>
  <div class="sub">Cohort Intelligence Report · Workspace: ${ws} · ${date}</div>

  <div class="section-label">MMAS-8 Key Performance Indicators — ${n} Assessments · ${countries.length} Countries</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${avgS}</div><div class="kpi-lbl">Mean MMAS-8 Score</div></div>
    <div class="kpi hi"><div class="kpi-val" style="color:#10b981;">${hiPct}%</div><div class="kpi-lbl">High Adherence (8.0)</div></div>
    <div class="kpi una"><div class="kpi-val" style="color:#3b82f6;">${unaPct}%</div><div class="kpi-lbl">Unassured (6.0–7.99)</div></div>
    <div class="kpi ina"><div class="kpi-val" style="color:#ef4444;">${inaPct}%</div><div class="kpi-lbl">Inadequate (&lt;6.0)</div></div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="section-label">Score Distribution</div>
      <table class="dist"><tbody>${barRows}</tbody></table>
    </div>
    <div class="card">
      <div class="section-label">Geographic Reach</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;color:#080e1a;margin-top:4px;">${countries.length}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#8a9ab0;margin-bottom:10px;">Countries represented</div>
      <div class="country-list">${countries.slice(0,24).join(' · ')}</div>
    </div>
  </div>

  ${pValid.length ? `
  <div class="section-label">PEACS v2.0 — Theory of Predictive Emergence · ${pValid.length} Profiles</div>
  <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:0;">
    <div class="kpi pe"><div class="kpi-val" style="color:#d4a843;">${avgPE}</div><div class="kpi-lbl">Mean PE Score</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#4e9cf5;">${avgBase}</div><div class="kpi-lbl">Avg BASE</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#8b6ff5;">${avgMvmt}</div><div class="kpi-lbl">Avg MVMT</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#2ec98a;">${avgStr}</div><div class="kpi-lbl">Avg STRATA</div></div>
  </div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#8a9ab0;margin-top:10px;">PE = (BASE × MVMT × STRATA)^(1/3) · Theory of Predictive Emergence © Adherence Inc.</div>
  ` : ''}

  <div class="footer">
    <div class="footer-brand">Adherence <em style="font-style:italic;">Cartography</em> · ATLAS Platform · atlas.adherence.cc</div>
    <div class="footer-legal">MMAS-8 © Donald E. Morisky. Licensed exclusively to Adherence Inc. This report contains aggregate, de-identified population-level statistics only. No individual patient data is included or recoverable. Generated ${date}.</div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('Allow pop-ups to export PDF.', 3000); if(btn){btn.textContent='↓ Cohort PDF';btn.disabled=false;} return; }
  win.document.write(html);
  win.document.close();

  // Auto-trigger print dialog after fonts load
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 800);
  };

  if (btn) { setTimeout(() => { btn.textContent='↓ Cohort PDF'; btn.disabled=false; }, 1200); }
  showToast('PDF ready — print dialog opening.', 2500);
}


/**
 * Generates a shareable result card image for a patient's MMAS-8 score.
 * Renders to an off-screen `<canvas>` and offers copy/download options.
 * @param {number} score - MMAS-8 total score (0–8)
 * @param {{ label: string, color: string }} cat - Adherence category object from `getAdherenceCategory`
 * @param {string} pattern - Adherence pattern label (e.g. `'Intentional Non-Adherence'`)
 * @returns {void}
 */
function shareResultCard(score, cat, pattern) {
  // Wait for web fonts to load so canvas renders IBM Plex Mono correctly
  const _doRender = () => {
  const W=1080,H=1080;
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');

  // Background
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#080e1a');bg.addColorStop(0.6,'#0d1525');bg.addColorStop(1,'#111d30');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  // Glow
  const glow=ctx.createRadialGradient(W/2,H*0.45,0,W/2,H*0.45,320);
  glow.addColorStop(0,cat.color+'28');glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  // Top accent line
  ctx.fillStyle=cat.color;ctx.fillRect(0,0,W,6);

  // ATLAS global badge
  ctx.save();
  ctx.font='500 24px monospace';
  const bText='ATLAS · GLOBAL ADHERENCE MAP · atlas.adherence.cc';
  const bw=ctx.measureText(bText).width+48;
  ctx.fillStyle='rgba(212,168,67,0.08)';
  _rcRoundRect(ctx,W/2-bw/2,56,bw,42,21);ctx.fill();
  ctx.strokeStyle='rgba(212,168,67,0.18)';ctx.lineWidth=1;
  _rcRoundRect(ctx,W/2-bw/2,56,bw,42,21);ctx.stroke();
  ctx.fillStyle='rgba(212,168,67,0.55)';ctx.textAlign='center';
  ctx.fillText(bText,W/2,84);
  ctx.restore();

  // Brand
  ctx.save();
  ctx.font='300 42px Georgia,serif';ctx.fillStyle='rgba(255,255,255,0.85)';ctx.textAlign='center';
  ctx.fillText('Adherence Cartography',W/2,186);
  ctx.font='300 24px Georgia,serif';ctx.fillStyle='rgba(212,168,67,0.6)';
  ctx.fillText('ATLAS · Adherence Tracking and Longitudinal Assessment System',W/2,224);
  ctx.restore();

  // Divider
  ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(W*0.2,264);ctx.lineTo(W*0.8,264);ctx.stroke();

  // Score — huge
  ctx.save();
  ctx.font='300 210px Georgia,serif';ctx.fillStyle=cat.color;ctx.textAlign='center';
  ctx.fillText(score.toFixed(2),W/2,518);
  ctx.restore();

  // /8
  ctx.save();
  ctx.font='300 48px Georgia,serif';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='center';
  ctx.fillText('/ 8',W/2,574);
  ctx.restore();

  // Level
  ctx.save();
  ctx.font='600 36px monospace';ctx.fillStyle=cat.color;ctx.textAlign='center';
  ctx.fillText(cat.label.toUpperCase(),W/2,636);
  ctx.restore();

  // Pattern
  ctx.save();
  ctx.font='400 26px sans-serif';ctx.fillStyle='rgba(255,255,255,0.42)';ctx.textAlign='center';
  ctx.fillText(pattern,W/2,682);
  ctx.restore();

  // Score bar
  const bX=(W-560)/2,bY=722,bH=12;
  ctx.fillStyle='rgba(255,255,255,0.07)';
  _rcRoundRect(ctx,bX,bY,560,bH,6);ctx.fill();
  const fill=Math.max(0,Math.min(1,score/8));
  ctx.fillStyle=cat.color;
  _rcRoundRect(ctx,bX,bY,560*fill,bH,6);ctx.fill();
  // Tick marks
  for(let i=0;i<=8;i++){
    const tx=bX+(i/8)*560;
    ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(tx-0.5,bY-4,1,bH+8);
    ctx.font='300 17px monospace';ctx.fillStyle='rgba(255,255,255,0.22)';ctx.textAlign='center';
    ctx.fillText(i,tx,bY+bH+22);
  }

  // Divider
  ctx.strokeStyle='rgba(255,255,255,0.06)';
  ctx.beginPath();ctx.moveTo(W*0.15,822);ctx.lineTo(W*0.85,822);ctx.stroke();

  // CTA
  ctx.save();
  ctx.font='400 23px monospace';ctx.fillStyle='rgba(255,255,255,0.32)';ctx.textAlign='center';
  ctx.fillText('Take your assessment  ·  atlas.adherence.cc',W/2,878);
  ctx.restore();

  // IP line
  ctx.save();
  ctx.font='300 17px monospace';ctx.fillStyle='rgba(255,255,255,0.16)';ctx.textAlign='center';
  ctx.fillText('MMAS-8 © MMAR LLC  ·  ATLAS © Adherence Cartography',W/2,938);
  ctx.restore();

  // Bottom accent
  ctx.fillStyle=cat.color+'55';ctx.fillRect(0,H-6,W,6);

  // Export
  canvas.toBlob(blob=>{
    const file=new File([blob],'mmas-result-atlas.png',{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({
        title:'My MMAS-8 Result · ATLAS',
        text:`I scored ${score.toFixed(2)}/8 on the MMAS-8 (${cat.label}). Take yours at atlas.adherence.cc #NotADoseADuration #MMAS8 #MedicationAdherence`,
        files:[file]
      }).catch(()=>_rcCopyOrDownload(blob));
    } else {
      _rcCopyOrDownload(blob);
    }
  },'image/png');
  }; // end _doRender
  // Ensure IBM Plex Mono is loaded before drawing
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(_doRender);
  } else {
    _doRender();
  }
}

function _rcCopyOrDownload(blob){
  if(navigator.clipboard&&window.ClipboardItem){
    navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>{
      showToast('📋 Result card copied! Paste into LinkedIn, Twitter, or any social platform.');
    }).catch(()=>_rcDownload(blob));
  } else {
    _rcDownload(blob);
  }
}

function _rcDownload(blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='mmas-result-atlas.png';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  showToast('📥 Result card downloaded — share on LinkedIn or social media!');
}

function _rcRoundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}




// ══════════════════════════════════════════════
// ZOE — AI VOICE AGENT (Web Speech API + Claude)
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// ZOE FINALIZE — with transcript + SOAP generation
// ══════════════════════════════════════════════
const ZOE_Q_LABELS = [
  'Do you sometimes forget to take your pills?',
  'People sometimes miss taking their medications for reasons other than forgetting. Over the past two weeks, were there any days when you did not take your medicine?',
  'Have you ever cut back or stopped taking your medication without telling your doctor, because you felt worse when you took it?',
  'When you travel or leave home, do you sometimes forget to bring along your medication?',
  'Did you take your medicine yesterday?',
  'When you feel like your condition is under control, do you sometimes stop taking your medicine?',
  'Taking medication every day is a real inconvenience for some people. Do you ever feel hassled about sticking to your treatment plan?',
  'How often do you have difficulty remembering to take all your medication?'
];

/**
 * Finalises the ZOE voice-guided MMAS-8 session, computes the score, and submits the assessment.
 * Called after all 8 questions have been answered via voice recognition.
 * @returns {void}
 */
function zoeFinalize(){
  if (window._zoeFinalizing) return; // prevent double-fire from patchZoeFinalize
  window._zoeFinalizing = true;

  // Snapshot clean numeric scores before mmasAnswers gets populated with strings
  window._zoeScoresSnapshot = [...zoeScores];

  zoeScores.forEach((sv,i)=>{
    if(i===7){
      const q8Val=sv===1?'never':sv===0.75?'rarely':sv===0.5?'sometimes':sv===0.25?'often':sv===0?'always':'sometimes';
      mmasAnswers['q8']=q8Val;
    } else {
      if(i===4) mmasAnswers['q5']=sv===1?'yes':'no';
      else mmasAnswers['q'+(i+1)]=sv===0?'yes':'no';
    }
  });

  // Build structured transcript
  window._zoeTranscript = [];
  let qIdx = 0;
  zoeHistory.filter(h=>h.role==='user').forEach(turn=>{
    const m = turn.content.match(/Patient said: "(.+)"/s);
    if(m && qIdx<8){
      window._zoeTranscript.push({
        question_number: qIdx+1,
        question: ZOE_Q_LABELS[qIdx],
        patient_response: m[1].trim(),
        extracted_score: zoeScores[qIdx]!==undefined ? zoeScores[qIdx] : null
      });
      qIdx++;
    }
  });

  // Close ZOE cleanly — this hides the overlay and cancels speech
  zoeClose();

  // Render the MMAS form with ZOE answers populated
  renderMMASQuestions();
  updateMMASProgress();

  // Show a brief "generating SOAP" toast instead of re-opening the overlay
  // (re-opening the overlay was causing Q1 to re-display)
  showToast('ZOE assessment complete. Generating clinical note…', 3000);

  generateZoeSOAP().then(soap=>{
    window._zoeSoapNote = soap;
    window._zoeFinalizing = false;
    // Schedule follow-up flag based on score
    _zoeScheduleFollowUp(zoeScores, soap);
    setTimeout(()=>{
      const sb=document.getElementById('mmas-submit-btn');
      if(sb){sb.disabled=false;sb.click();}
    },400);
  }).catch(()=>{
    window._zoeSoapNote = null;
    window._zoeFinalizing = false;
    _zoeScheduleFollowUp(zoeScores, null);
    setTimeout(()=>{
      const sb=document.getElementById('mmas-submit-btn');
      if(sb){sb.disabled=false;sb.click();}
    },400);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PASS 2: ZOE FOLLOW-UP SCHEDULING
// ══════════════════════════════════════════════════════════════════════════

function _zoeScheduleFollowUp(scores, soap) {
  if (!currentWorkspace || window._wsMode === 'explorer') return;
  const totalScore = scores.reduce((a,b) => a + (b||0), 0);
  const inaItems   = [2,5].filter(i => (scores[i]||0) < 1);
  const unaItems   = [0,1,3,7].filter(i => (scores[i]||0) < 1);
  const isINA      = inaItems.length > unaItems.length;
  const hasClinFlag= soap && soap.clinical_flags && soap.clinical_flags.length > 0;
  const pid        = window._zoeSdohSnapshot?.patientNum || null;
  let intervalDays, urgency, reason;
  if (isINA || hasClinFlag || totalScore < 4) {
    intervalDays = 7; urgency = 'urgent';
    reason = isINA ? 'Intentional non-adherence pattern — motivational intervention recommended within 7 days'
           : hasClinFlag ? 'Clinical flags from ZOE: ' + soap.clinical_flags.slice(0,2).join(' · ')
           : 'Low adherence score — follow-up within 7 days';
  } else if (totalScore < 6) {
    intervalDays = 14; urgency = 'moderate';
    reason = 'Medium adherence — reassess in 14 days';
  } else {
    intervalDays = 30; urgency = 'routine';
    reason = 'High adherence — routine reassessment in 30 days';
  }
  const dueDate    = new Date(Date.now() + intervalDays * 86400000);
  const dueDateStr = dueDate.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const dueISO     = dueDate.toISOString().split('T')[0];
  window._zoeFollowUp = { intervalDays, urgency, reason, dueDate: dueISO, patientId: pid };
  if (currentWorkspace && isResearcherMode()) {
    database.ref('alerts/' + currentWorkspace).push({
      timestamp: Date.now(), type: 'followup', urgency, reason,
      due_date: dueISO, interval_days: intervalDays, score: totalScore,
      patient_number: pid, zoe_session: true,
      flags: [{ type: urgency === 'urgent' ? 'ina' : 'followup',
                label: urgency === 'urgent' ? 'Follow-up Required (7 days)' : 'Follow-up Due (' + intervalDays + ' days)' }],
      reviewed: false, workspace: currentWorkspace,
    }).catch(() => {});
  }
  setTimeout(() => _showZoeFollowUpCard(pid, intervalDays, urgency, reason, dueDateStr, totalScore, dueISO), 1200);
}

function _showZoeFollowUpCard(pid, days, urgency, reason, dueDateStr, score, dueISO) {
  const existing = document.getElementById('zoe-followup-card');
  if (existing) existing.remove();
  // Expose pid for ZOE Remote URL builder
  if (pid) window._currentPatientId = pid;
  const colors = {
    urgent:   { border:'rgba(239,68,68,0.4)',  bg:'rgba(239,68,68,0.05)',  text:'#ef4444', label:'Urgent — 7 days' },
    moderate: { border:'rgba(245,158,11,0.4)', bg:'rgba(245,158,11,0.05)', text:'#f59e0b', label:'Moderate — 14 days' },
    routine:  { border:'rgba(46,201,138,0.3)', bg:'rgba(46,201,138,0.04)', text:'#2ec98a', label:'Routine — 30 days' },
  };
  const c = colors[urgency] || colors.routine;
  const card = document.createElement('div');
  card.id = 'zoe-followup-card';
  card.style.cssText = 'margin:16px 0 0;background:' + c.bg + ';border:1px solid ' + c.border + ';border-left:3px solid ' + c.text + ';border-radius:10px;padding:16px 20px;animation:fadeUp 0.35s ease both;';
  card.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:200px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:' + c.text + ';margin-bottom:6px;">⏱ Follow-Up Scheduled · ' + c.label + '</div>' +
        '<div style="font-size:0.84rem;color:var(--text);margin-bottom:5px;line-height:1.55;"><strong>Next assessment due:</strong> ' + dueDateStr + '</div>' +
        '<div style="font-size:0.76rem;color:var(--muted);line-height:1.6;">' + reason + '</div>' +
        (pid ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;color:var(--dim);margin-top:6px;">Patient: ' + _esc(pid) + ' · MMAS-8: ' + score.toFixed(2) + ' / 8</div>' : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">' +
        '<button onclick="_copyFollowUpLink(\'' + dueISO + '\',\'' + (pid||'') + '\')" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(255,255,255,0.05);border:1px solid var(--border2);color:var(--muted);border-radius:6px;padding:6px 12px;cursor:pointer;">📋 Copy reminder link</button>' +
        '<button onclick="document.getElementById(\'zoe-followup-card\').remove()" style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid var(--border);color:var(--dim);border-radius:6px;padding:6px 12px;cursor:pointer;">Dismiss</button>' +
      '</div>' +
    '</div>' +
    '<div class="zoe-remote-trigger" id="zoe-remote-trigger">' +
      '<div class="zoe-remote-title"><i data-lucide="mic" style="width:14px;height:14px;"></i> ZOE Remote Assessment</div>' +
      '<div class="zoe-remote-desc">Send a voice-guided MAP assessment link directly to your patient\'s phone. They complete it on their own device — no visit required.</div>' +
      '<div class="zoe-remote-row">' +
        '<input class="zoe-sms-input" id="zoe-sms-number" type="tel" placeholder="+1 (555) 000-0000" />' +
        '<button class="zoe-send-btn" onclick="sendZoeRemoteLink()">Send SMS</button>' +
        '<button class="zoe-copy-link-btn" onclick="copyZoeRemoteLink()">Copy Link</button>' +
      '</div>' +
      '<div class="zoe-remote-status" id="zoe-remote-status"></div>' +
    '</div>';
  const zoeOverlay = document.getElementById('zoe-overlay');
  if (zoeOverlay && zoeOverlay.parentNode) {
    zoeOverlay.parentNode.insertBefore(card, zoeOverlay.nextSibling);
    card.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
}

function _copyFollowUpLink(dueISO, pid) {
  const params = new URLSearchParams();
  if (currentWorkspace) params.set('key', currentWorkspace);
  if (pid) params.set('pid', pid);
  params.set('due', dueISO);
  const url = 'https://assess.adherence.cc?' + params.toString();
  // Append patient portal link when a patient ID is available
  const portalUrl = pid ? 'https://atlas.adherence.cc?portal=' + encodeURIComponent(pid) : null;
  const copyText = portalUrl ? url + '\n\nPatient portal: ' + portalUrl : url;
  navigator.clipboard.writeText(copyText).then(
    () => showToast('Follow-up link copied — share with patient or calendar', 3000),
    () => showToast('Link: ' + url, 5000)
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PATIENT PORTAL — data loading and rendering
// ══════════════════════════════════════════════════════════════════════════

/**
 * Loads all MMAS-8 assessment records for a specific patient from Firebase.
 * @param {string} patientId - The patient identifier to query (matches `patient_number` field)
 * @returns {Promise<void>}
 */
async function loadPatientPortalData(patientId) {
  const idEl = document.getElementById('pp-patient-id');
  if (idEl) idEl.textContent = 'Patient ID: ' + patientId;

  try {
    const db = (typeof database !== 'undefined' && database) ? database
              : (window._firebaseDb || (typeof firebase !== 'undefined' ? firebase.database() : null));
    if (!db) { renderPortalError('Unable to connect to database.'); return; }

    // Query assessments by patient_number
    const snap = await db.ref('assessments').orderByChild('patient_number').equalTo(patientId).once('value');
    const records = [];
    snap.forEach(function(child) { records.push(Object.assign({ key: child.key }, child.val())); });
    records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    if (records.length === 0) {
      renderPortalError('No assessment records found for this patient ID.');
      return;
    }

    renderPatientPortal(patientId, records);
  } catch(e) {
    console.error('Patient portal error:', e);
    renderPortalError('Error loading your data. Please try again or contact your care coordinator.');
  }
}

/**
 * Renders the patient portal view for a given patient's longitudinal MMAS-8 records.
 * @param {string} patientId - Patient identifier
 * @param {Array<Object>} records - Array of MMAS-8 assessment records for this patient
 * @returns {void}
 */
function renderPatientPortal(patientId, records) {
  const body = document.getElementById('pp-body');
  if (!body) return;

  const latest = records[0];
  const score = parseFloat(latest.score) || 0;
  const scoreClass = score >= 8 ? 'high' : score >= 6 ? 'medium' : 'low';
  const levelLabel = score >= 8 ? 'High Adherence' : score >= 6 ? 'Medium Adherence' : 'Low Adherence';
  const latestDate = latest.timestamp ? new Date(latest.timestamp).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Recent';

  // PE domain scores from q1-q8
  const q1=parseFloat(latest.q1||0),q2=parseFloat(latest.q2||0),q3=parseFloat(latest.q3||0);
  const q4=parseFloat(latest.q4||0),q5=parseFloat(latest.q5||0),q6=parseFloat(latest.q6||0);
  const q7=parseFloat(latest.q7||0),q8=parseFloat(latest.q8||0);
  const arch = ((q2+q3+q6)/3).toFixed(2);
  const exec = ((q1+q5+q8)/3).toFixed(2);
  const ctx  = (0.5+0.5*(q4+q7)/2).toFixed(2);

  // Friendly tips based on lowest domain
  const domains = [{name:'Architecture',val:parseFloat(arch)},{name:'Execution',val:parseFloat(exec)},{name:'Context',val:parseFloat(ctx)}];
  const weakest = domains.sort(function(a,b){return a.val-b.val;})[0].name;
  const tipsMap = {
    Architecture: [
      'Talk to your doctor or pharmacist about any doubts you have about your medication.',
      'Understanding why your medication matters can make it easier to stay consistent.',
      'Ask about alternatives if side effects are a concern — there may be better options.'
    ],
    Execution: [
      'Try taking your medication at the same time each day — link it to a daily habit like meals.',
      'A weekly pill organiser can help you track whether you\'ve taken each dose.',
      'Set a daily phone reminder for your medication time.'
    ],
    Context: [
      'If cost or access is a barrier, ask your pharmacist about generic options or patient assistance programs.',
      'Keep a small supply of medication with you when travelling.',
      'Let your care coordinator know if your schedule or circumstances have changed — they can help.'
    ]
  };
  const tips = tipsMap[weakest] || tipsMap['Execution'];

  // History rows (up to 10)
  const historyRows = records.slice(0, 10).map(function(r) {
    const s = parseFloat(r.score)||0;
    const col = s >= 8 ? '#10b981' : s >= 6 ? '#f59e0b' : '#ef4444';
    const d = r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '\u2014';
    return '<div class="pp-history-row">' +
      '<span class="pp-history-date">' + d + '</span>' +
      '<span class="pp-history-score" style="color:' + col + ';">' + s.toFixed(2) + ' / 8</span>' +
      '</div>';
  }).join('');

  const greetEl = document.getElementById('pp-patient-greeting');
  if (greetEl) greetEl.textContent = score >= 8 ? 'Great work \u2014 keep it up!' : score >= 6 ? 'You\'re making progress' : 'Let\'s work on this together';

  const accentColor = scoreClass==='high'?'#10b981':scoreClass==='medium'?'#f59e0b':'#ef4444';
  body.innerHTML =
    '<div class="pp-score-hero">' +
      '<div class="pp-score-label">Your Latest Adherence Score</div>' +
      '<div class="pp-score-big ' + scoreClass + '">' + score.toFixed(2) + '<span style="font-size:1.2rem;font-weight:500;color:#9ca3af;"> / 8</span></div>' +
      '<div class="pp-score-level" style="color:' + accentColor + ';">' + levelLabel + '</div>' +
      '<div class="pp-score-date">' + latestDate + '</div>' +
    '</div>' +
    '<div class="pp-pe-domains">' +
      '<div class="pp-domain-card arch"><div class="pp-domain-name">Motivation</div><div class="pp-domain-score">' + arch + '</div></div>' +
      '<div class="pp-domain-card exec"><div class="pp-domain-name">Routine</div><div class="pp-domain-score">' + exec + '</div></div>' +
      '<div class="pp-domain-card ctx"><div class="pp-domain-name">Access</div><div class="pp-domain-score">' + ctx + '</div></div>' +
    '</div>' +
    '<div class="pp-history-card">' +
      '<div class="pp-history-title">Your Assessment History</div>' +
      historyRows +
    '</div>' +
    '<div class="pp-tips-card">' +
      '<div class="pp-tips-title">Personalised Tips for You</div>' +
      tips.map(function(t,i) {
        return '<div class="pp-tip-item"><div class="pp-tip-icon" style="background:#eff6ff;color:#2563eb;">' + (i+1) + '</div><span>' + t + '</span></div>';
      }).join('') +
    '</div>' +
    '<div class="pp-contact-card">' +
      '<div style="font-size:0.82rem;font-weight:700;color:#4338ca;margin-bottom:6px;">Questions about your medications?</div>' +
      '<div style="font-size:0.78rem;color:#6b7280;">Contact your care coordinator or pharmacist. Bring this summary to your next appointment.</div>' +
    '</div>';
}

function renderPortalError(msg) {
  const body = document.getElementById('pp-body');
  if (body) body.innerHTML = '<div class="pp-loading"><div style="font-size:1.5rem;margin-bottom:8px;">\u26a0\ufe0f</div>' + msg + '</div>';
}

// ══════════════════════════════════════════════════════════════════════════
// PASS 3: DAILY INTAKE PANEL (Pharmacist Quick-Entry)
// ══════════════════════════════════════════════════════════════════════════

function initDailyIntakePanel() {
  const panel = document.getElementById('daily-intake-panel');
  if (!panel) return;
  const role = workspaceProfile?.role || '';
  if (['clinician','pharmacist'].includes(role)) {
    panel.style.display = 'block';
  }
}

function toggleDailyIntake() {
  const body = document.getElementById('daily-intake-body');
  const icon = document.getElementById('daily-intake-icon');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▸' : '▾';
}

function dailyIntakeSubmit() {
  const g = id => document.getElementById(id);
  const pid       = g('di-pid')?.value?.trim();
  const drug      = g('di-drug')?.value?.trim();
  const condition = g('di-condition')?.value?.trim();
  const q1        = g('di-q1')?.value;
  const q2        = g('di-q2')?.value;
  const q3        = g('di-q3')?.value;
  const notes     = g('di-notes')?.value?.trim();
  const flagFull  = g('di-flag-full')?.checked;
  if (!pid) { showToast('Patient ID required.', 3000); g('di-pid')?.focus(); return; }
  const answered    = [q1,q2,q3].filter(v => v !== null && v !== undefined && v !== '').length;
  const rapidScore  = answered === 3 ? (parseFloat(q1)||0)+(parseFloat(q2)||0)+(parseFloat(q3)||0) : null;
  const entry = {
    timestamp: Date.now(), patient_number: pid,
    user_id: getUserId(),               // required by Firebase validate rule
    score: rapidScore !== null ? rapidScore * (8/3) : -1, // normalised indicator; -1 = rapid screen only
    drug_name: drug||null, condition: condition||null,
    rapid_score: rapidScore, rapid_answered: answered,
    notes: notes||null, flag_full_zoe: flagFull||false,
    institution_code: currentWorkspace, intake_type: 'daily_rapid',
    logged_by: workspaceProfile?.name || currentWorkspace,
  };
  if (!currentWorkspace) { showToast('No workspace active.', 2500); return; }
  atlasDB('assessments').push(entry).then(() => {
    if (typeof mtmRender === 'function') mtmRender();
    if ((rapidScore !== null && rapidScore < 2) || flagFull) {
      database.ref('alerts/' + currentWorkspace).push({
        timestamp: Date.now(),
        type: flagFull ? 'zoe_requested' : 'rapid_low',
        urgency: 'urgent',
        reason: flagFull ? 'Full ZOE assessment requested for ' + pid
               : 'Rapid screen: score ' + rapidScore + '/3 — low adherence risk',
        score: rapidScore, patient_number: pid,
        drug_name: drug||null, condition: condition||null,
        zoe_session: false,
        flags: [{ type:'una', label: flagFull ? 'ZOE Requested' : 'Rapid Screen Low' }],
        reviewed: false, workspace: currentWorkspace,
      }).catch(() => {});
    }
    ['di-pid','di-drug','di-condition','di-notes'].forEach(id => { const e=g(id); if(e) e.value=''; });
    ['di-q1','di-q2','di-q3'].forEach(id => { const e=g(id); if(e) e.value=''; });
    const fl = g('di-flag-full'); if(fl) fl.checked = false;
    showToast(flagFull ? 'Patient ' + pid + ' logged — flagged for full ZOE'
              : rapidScore !== null ? 'Patient ' + pid + ' — rapid screen ' + rapidScore + '/3 logged'
              : 'Patient ' + pid + ' logged', 4000);
    const ctr = g('di-today-count');
    if (ctr) ctr.textContent = parseInt(ctr.textContent||'0') + 1;
  }).catch(e => {
    showToast('Log failed — check connection', 3000);
    console.error('[daily-intake]', e.message);
  });
}


/**
 * Generates a clinical SOAP note for the current patient using ZOE AI.
 * Posts to the ATLAS SOAP endpoint and renders the structured note in the result modal.
 * @returns {Promise<void>}
 */
async function generateZoeSOAP(){
  if(!zoeHistory.length) return null;
  const transcriptText=(window._zoeTranscript||[]).map(t=>`Q${t.question_number}: ${t.question}\nPatient: "${t.patient_response}" (Score: ${t.extracted_score})`).join('\n\n');
  const totalScore=zoeScores.reduce((a,b)=>a+(b||0),0);
  const cat=getAdherenceCategory(totalScore);
  const inaItems=[],unaItems=[];
  [0,1,3,7].forEach(i=>{if((zoeScores[i]||0)<1)unaItems.push('Q'+(i+1));});
  [2,5].forEach(i=>{if((zoeScores[i]||0)<1)inaItems.push('Q'+(i+1));});
  // Q5 (index 4) and Q7 (index 6) are neutral — excluded from INA/UNA classification
  const pattern=inaItems.length>unaItems.length?'Intentional Non-Adherence (INA)':unaItems.length>inaItems.length?'Unintentional Non-Adherence (UNA)':totalScore>=8?'High Adherence':'Mixed Pattern';

  const prompt=`You are a clinical documentation specialist generating a SOAP note from a ZOE AI voice assessment using the MMAS-8 medication adherence scale.

ASSESSMENT DATA:
- MMAS-8 Score: ${totalScore.toFixed(2)} / 8
- Adherence Level: ${cat.label}
- Pattern: ${pattern}
- INA items: ${inaItems.length?inaItems.join(', '):'None'}
- UNA items: ${unaItems.length?unaItems.join(', '):'None'}

VERBATIM VOICE TRANSCRIPT:
${transcriptText}

Generate a complete SOAP note. Use the patient's own words to enrich each section. Be concise but clinically useful. Do not fabricate details not in the transcript.

Respond ONLY with valid JSON, no preamble:
{"subjective":"Patient reported experiences in their own words 2-4 sentences","objective":"MMAS-8 score adherence level flagged items pattern factual only","assessment":"Clinical interpretation of adherence pattern risk level likely barriers 2-3 sentences","plan":"Actionable recommendations for treating clinician as newline-separated bullet points","clinical_flags":["specific concerns worth surfacing to clinician"],"zoe_note":"One sentence from ZOE perspective what stood out most"}`;

  const resp=await fetch('/lambda-proxy/zoe',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:800,messages:[{role:'user',content:prompt}]})
  });
  const data=await resp.json();
  const raw=data.content?.[0]?.text||'{}';
  try{return JSON.parse(raw.replace(/```json|```/g,'').trim());}
  catch{return {subjective:raw,objective:'',assessment:'',plan:'',clinical_flags:[],zoe_note:''};}
}

// ══════════════════════════════════════════════
// ZOE HTML overlay + button wiring
// ══════════════════════════════════════════════
function initZoeButtons(){
  // ZOE browser compatibility check
  (function() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg\//.test(navigator.userAgent);
    const warn = document.getElementById('zoe-browser-warning');
    if (warn && !isChrome && !isEdge) {
      warn.style.display = 'block';
    }
  })();

  const launch=_zId('zoe-launch-btn');
  if(launch)launch.addEventListener('click',zoeOpen);
  const exit=_zId('zoe-exit-btn');
  if(exit)exit.addEventListener('click',()=>{zoeClose();if(Object.keys(mmasAnswers).length>0){renderMMASQuestions();updateMMASProgress();}showToast('ZOE session ended. Your answers have been saved to the form.');});
  const mic=_zId('zoe-mic-btn');
  if(mic)mic.addEventListener('click',()=>{if(zoeListening){if(zoeRecognition)zoeRecognition.stop();}else{zoeStartListening();}});
  const skip=_zId('zoe-skip-btn');
  if(skip)skip.addEventListener('click',()=>{
    if(zoeCurrQ<8){
      // Q5 (index 4) is reversed: Yes=1 (took last dose) is the non-penalizing default when skipped
      const isQ5 = zoeCurrQ === 4;
      const isQ8 = zoeCurrQ === 7;
      zoeScores[zoeCurrQ] = (isQ5 || isQ8) ? 1 : 0;
      if (isQ5) {
        mmasAnswers['q5'] = 'yes';
      } else if (isQ8) {
        mmasAnswers['q8'] = 'never'; // skip Q8 = assume never has difficulty (non-penalizing)
      } else {
        mmasAnswers['q'+(zoeCurrQ+1)] = 'yes'; // Q1-Q4, Q6-Q7: skip = assume 'yes' (no problem)
      }
      zoeSetPill(zoeCurrQ,'done');
      const n=zoeCurrQ+1;
      if(n>=8){zoeFinalize();}
      else{zoeCurrQ=n;zoeSetPill(zoeCurrQ,'active');zoeShowControls(false);const qt=ZOE_QUESTIONS[zoeCurrQ];zoeSetQ(qt);zoeSpeak(qt,()=>{zoeSetOrb('idle');zoeSetStatus('Your turn — tap Speak','rgba(139,111,245,0.7)');zoeShowControls(true);});}
    }
  });
}

// ══════════════════════════════════════════════
// PATIENT RECORD DRILLDOWN (PI Dashboard)
// ══════════════════════════════════════════════
function showPatientRecord(idx){
  const records = window._dashRecords || [];
  const r = records[idx];
  if(!r) return;
  _renderPatientRecord(r);
}

// Stable-key lookup — immune to data refreshes between render and click
function showPatientRecordByKey(key){
  const records = window._dashRecords || [];
  const r = records.find(rec => (rec.user_id+'|'+rec.timestamp) === key);
  if(!r) return;
  _renderPatientRecord(r);
}

function _renderPatientRecord(r){
  // Detect instrument — MAP uses map_q1 prefix; MMAS-8 uses q1 (no prefix)
  const isMap = r.tool === 'map' || r.map_q1 !== undefined;

  // For MAP: compute PE = geometric mean(Architecture, Execution, Context)
  let mapPE = null, mapArch = null, mapExec = null, mapCtx = null;
  if (isMap) {
    mapArch = ((parseFloat(r.map_q2)||0) + (parseFloat(r.map_q3)||0) + (parseFloat(r.map_q6)||0)) / 3;
    mapExec = ((parseFloat(r.map_q1)||0) + (parseFloat(r.map_q5)||0) + (parseFloat(r.map_q8)||0)) / 3;
    mapCtx  = 0.5 + 0.5 * (((parseFloat(r.map_q4)||0) + (parseFloat(r.map_q7)||0)) / 2);  // Context-Guard
    mapPE   = (mapArch > 0 && mapExec > 0) ? Math.pow(mapArch * mapExec * mapCtx, 1/3) : (parseFloat(r.map_pe) || null);
  }

  const displayScore = isMap ? (mapPE !== null ? mapPE : parseFloat(r.score) || 0) : (parseFloat(r.score) || 0);
  const cat = getAdherenceCategory(isMap ? (mapPE !== null ? mapPE * 8 : r.score) : r.score); // MAP PE 0-1 → scale to MMAS-8 0-8 for category lookup
  let pat = '—';
  if (!isMap) {
    if (r.score === 8) pat = 'High Adherence';
    else if (r.q1 !== undefined) {
      const {intentional, unintentional} = classifyPattern(r);
      pat = intentional > unintentional ? 'Intentional Non-Adherence (INA)' : unintentional > intentional ? 'Unintentional Non-Adherence (UNA)' : 'Mixed Pattern';
    }
  }

  const modal = document.getElementById('patient-record-modal');
  if(!modal) return;

  document.getElementById('pr-eyebrow').textContent = 'Patient Record · ATLAS · ' + new Date(r.timestamp).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  document.getElementById('pr-name').textContent = r.patient_number || 'Anonymous Patient';
  const metaParts = [r.country, r.city].filter(Boolean);
  document.getElementById('pr-meta').textContent = metaParts.join('  ·  ');

  // Study provenance — populate for bulk-uploaded records
  const provPanel = document.getElementById('pr-study-provenance');
  if (provPanel) {
    if (r.study_title) {
      document.getElementById('pr-study-title').textContent = r.study_title;
      const piParts = [r.pi_name, r.study_institution].filter(Boolean);
      document.getElementById('pr-study-pi').textContent = piParts.join('  ·  ');
      const extras = [
        r.irb_number        ? 'IRB ' + r.irb_number         : null,
        r.clinicaltrials_id ? r.clinicaltrials_id            : null,
        r.study_phase       ? r.study_phase                  : null,
      ].filter(Boolean).join('  ·  ');
      document.getElementById('pr-study-extras').textContent = extras;
      provPanel.style.display = 'block';
    } else {
      provPanel.style.display = 'none';
    }
  }
  const scoreEl = document.getElementById('pr-score');
  const levelEl = document.getElementById('pr-level');
  const patternEl = document.getElementById('pr-pattern');

  if (isMap) {
    // MAP: show PE as primary score, domain breakdown replaces adherence category
    scoreEl.textContent = mapPE !== null ? mapPE.toFixed(3) + ' PE' : '—';
    scoreEl.style.color = mapPE !== null ? (mapPE >= 1.0 ? '#059669' : mapPE >= 0.75 ? '#d97706' : '#dc2626') : '#94a3b8';
    const archStr = mapArch !== null ? mapArch.toFixed(2) : '—';
    const execStr = mapExec !== null ? mapExec.toFixed(2) : '—';
    const ctxStr  = mapCtx  !== null ? mapCtx.toFixed(2)  : '—';
    levelEl.textContent = `ARCH ${archStr}  ·  EXEC ${execStr}  ·  CTX ${ctxStr}`;
    levelEl.style.color = '#6b8099';
    patternEl.textContent = '—';
  } else {
    scoreEl.textContent = displayScore.toFixed(2);
    scoreEl.style.color = cat.color;
    levelEl.textContent = cat.label.toUpperCase();
    levelEl.style.color = cat.color;
    patternEl.textContent = pat;
  }

  // APE phenotype badge — MMAS-8 only (requires q1–q8 item responses)
  const prApeBadge = document.getElementById('pr-ape-badge');
  if (prApeBadge) {
    if (!isMap && r.q1 !== undefined && typeof classifyApePhenotype === 'function') {
      const apeResult = classifyApePhenotype(r);
      if (apeResult && apeResult.length) {
        const allBadges = apeResult.slice(0,3).map((x,i) => {
          const cc = x.phenotype.color || '#6b8099';
          const opacity = i === 0 ? '1' : '0.45';
          return `<span style="font-size:0.82rem;padding:2px 8px;border-radius:8px;background:${cc}18;color:${cc};border:1px solid ${cc}35;margin-right:4px;opacity:${opacity};white-space:nowrap;">${x.phenotype.icon} ${x.phenotype.name} ${Math.round(x.prob*100)}%</span>`;
        }).join('');
        prApeBadge.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);margin-bottom:5px;">APE Phenotype</div>${allBadges}`;
      } else { prApeBadge.innerHTML = ''; }
    } else { prApeBadge.innerHTML = ''; }
  }

  // SOAP note — editable textarea
  const soapDiv = document.getElementById('pr-soap');
  const soapTa = document.getElementById('soap-note-textarea');
  const zoeNoteEl = document.getElementById('pr-zoe-note-display');
  const soap = r.soap_note;
  if(soap && soapTa && soapDiv){
    const header = 'SOAP NOTE — ZOE ATLAS Assessment\nPatient: '+(r.patient_number||'Anonymous')+'\nDate: '+new Date(r.timestamp).toLocaleString()+'\nMMAS-8: '+r.score.toFixed(2)+'/8  |  '+cat.label+'  |  '+pat;
    soapTa.value = buildSoapCopyText(soap, header);
    if(zoeNoteEl && soap.zoe_note) zoeNoteEl.textContent = 'ZOE: "' + soap.zoe_note + '"';
    soapDiv.style.display = 'block';
  } else if(soapDiv){
    soapDiv.style.display='none';
  }

  // Voice transcript
  const txDiv = document.getElementById('pr-transcript');
  const txContent = document.getElementById('pr-transcript-content');
  if(r.zoe_transcript && r.zoe_transcript.length && txContent && txDiv){
    txContent.innerHTML = r.zoe_transcript.map(t=>`
      <div class="pr-q-row">
        <div class="pr-q">Q${t.question_number}: ${_esc(t.question)}</div>
        <div class="pr-a">"${_esc(t.patient_response)}"</div>
      </div>`).join('');
    txDiv.style.display='block';
  } else if(txDiv){
    txDiv.style.display='none';
  }

  // ── Medication section ─────────────────────────────────────────────────────
  const hasMed = r.drug_type || r.drug_name || r.drug_strength || r.dosing_frequency
               || r.route_of_administration || r.num_medications || r.condition;
  const medSection = document.getElementById('pr-medication-section');
  if (medSection) {
    medSection.style.display = hasMed ? '' : 'none';
    if (hasMed) {
      const _prSet = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (val) { el.textContent = val; el.className = 'pr-data-val'; }
        else      { el.textContent = 'Not recorded'; el.className = 'pr-data-val empty'; }
      };
      _prSet('pr-drug-type',    r.drug_type || r.drugType || null);
      _prSet('pr-drug-name',    r.drug_name || r.drugName || null);
      _prSet('pr-drug-strength',r.drug_strength || r.drugStrength || null);
      _prSet('pr-dosing-freq',  r.dosing_frequency || null);
      _prSet('pr-route',        r.route_of_administration || null);
      _prSet('pr-num-meds',     r.num_medications != null ? String(r.num_medications) : null);
      _prSet('pr-condition',    Array.isArray(r.condition) ? r.condition.join(', ') : (r.condition || null));
    }
  }

  // ── Patient Profile / SDoH section ────────────────────────────────────────
  const hasProfile = r.age_range || r.gender || r.education_level || r.education || r.country || r.city;
  const profSection = document.getElementById('pr-profile-section');
  if (profSection) {
    profSection.style.display = hasProfile ? '' : 'none';
    if (hasProfile) {
      const _prSet2 = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (val) { el.textContent = val; el.className = 'pr-data-val'; }
        else      { el.textContent = 'Not recorded'; el.className = 'pr-data-val empty'; }
      };
      _prSet2('pr-age-range',  r.age_range || null);
      _prSet2('pr-gender',     r.gender || null);
      _prSet2('pr-education',  r.education_level || r.education || null);
      _prSet2('pr-country',    r.country || null);
      _prSet2('pr-city',       r.city || null);
    }
  }

  // ── Question responses / MAP domain scores ────────────────────────────────
  const qSection    = document.getElementById('pr-questions-section');
  const qGrid       = document.getElementById('pr-q-grid');
  const qSectionHdr = qSection ? qSection.querySelector('.pr-data-section-hdr') : null;

  if (qSection && qGrid) {
    if (isMap && r.map_q1 !== undefined) {
      // MAP — show map_q1–map_q8 numeric responses, same layout as MMAS-8
      qSection.style.display = '';
      if (qSectionHdr) qSectionHdr.textContent = '📋 MAP Question Responses';
      const mapQLabels = [
        'Forgot dose','Changed time','Stopped feeling bad','Travel/home omission',
        'Took yesterday','Side effects','Financial barrier','Remembers all doses',
      ];
      qGrid.innerHTML = [1,2,3,4,5,6,7,8].map(n => {
        const val = r['map_q' + n];
        const answered = val !== undefined && val !== null && val !== '';
        const display = answered ? String(val) : '—';
        return `<div class="pr-q-cell" title="Q${n}: ${mapQLabels[n-1]}">
          <div class="pr-q-cell-num">Q${n}</div>
          <div class="pr-q-cell-val" style="color:#475569;">${display}</div>
        </div>`;
      }).join('');
    } else if (!isMap && r.q1 !== undefined) {
      // MMAS-8 — show Q1–Q8 item responses
      qSection.style.display = '';
      if (qSectionHdr) qSectionHdr.textContent = '📋 MMAS-8 Question Responses';
      const qLabels = [
        'Forgot dose','Changed time','Stopped feeling bad','Travel/home omission',
        'Took yesterday','Side effects','Financial barrier','Remembers all doses',
      ];
      qGrid.innerHTML = [1,2,3,4,5,6,7,8].map(n => {
        const val = r['q'+n];
        const answered = val !== undefined && val !== null && val !== '';
        const q8Map = { 1:'Never', 0.75:'Rarely', 0.5:'Sometimes', 0.25:'Often', 0:'All the time' };
        const isPositive = n === 8 ? parseFloat(val) >= 0.75 : val === 1;
        const display = !answered ? '—'
          : (n === 8 ? (q8Map[parseFloat(val)] ?? String(val))
             : n === 5 ? (val === 1 ? 'Yes' : 'No')
             : (val === 1 ? 'No' : 'Yes'));
        const cls = !answered ? '' : (isPositive ? 'yes' : 'no');
        return `<div class="pr-q-cell" title="Q${n}: ${qLabels[n-1]}">
          <div class="pr-q-cell-num">Q${n}</div>
          <div class="pr-q-cell-val ${cls}">${display}</div>
        </div>`;
      }).join('');
    } else {
      qSection.style.display = 'none';
    }
  }

  modal.style.display='';
  modal.classList.add('active');
  const scrollBox = modal.querySelector('.pr-box-scroll');
  if(scrollBox) scrollBox.scrollTop=0;
}

// ── Atlas Custom Confirm Modal ──────────────────────────────────────────────
// Replaces native confirm() to match ATLAS design system.
// Usage: showAtlasConfirm({ title, message, onConfirm, onCancel? })
function showAtlasConfirm({ title, message, onConfirm, onCancel }) {
  const modal  = document.getElementById('atlas-confirm-modal');
  const titleEl = document.getElementById('atlas-confirm-title');
  const msgEl   = document.getElementById('atlas-confirm-msg');
  const okBtn   = document.getElementById('atlas-confirm-ok');
  const cancelBtn = document.getElementById('atlas-confirm-cancel');
  if (!modal) { if (confirm(message)) onConfirm(); else if (onCancel) onCancel(); return; }
  titleEl.textContent = title || 'Confirm';
  msgEl.textContent   = message || '';
  const close = () => { closeModal(modal); };
  openModal(modal, { label: title || 'Confirm', onEscape: () => { close(); if (onCancel) onCancel(); } });
  okBtn.onclick     = () => { close(); onConfirm(); };
  cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };
  modal.onclick     = e => { if (e.target === modal) { close(); if (onCancel) onCancel(); } };
}

function closePatientRecord(){
  const modal=document.getElementById('patient-record-modal');
  if(modal){ modal.classList.remove('active'); modal.style.display='none'; }
}

// ══════════════════════════════════════════════
// SHARED SOAP RENDERER — single source of truth
// Used by both the result modal (ZOE) and the PI drilldown modal
// ══════════════════════════════════════════════
const SOAP_COLORS = {
  S: 'rgba(139,111,245,0.6)',
  O: 'rgba(78,156,245,0.6)',
  A: 'rgba(212,168,67,0.7)',
  P: 'rgba(46,201,138,0.6)'
};

function buildSoapSectionsHTML(soap) {
  const sections = [];
  if (soap.subjective) sections.push(`<div style="margin-bottom:10px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.61rem;letter-spacing:0.12em;text-transform:uppercase;color:${SOAP_COLORS.S};margin-bottom:4px;">S — Subjective</div><div style="font-size:0.88rem;line-height:1.75;">${soap.subjective}</div></div>`);
  if (soap.objective)  sections.push(`<div style="margin-bottom:10px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.61rem;letter-spacing:0.12em;text-transform:uppercase;color:${SOAP_COLORS.O};margin-bottom:4px;">O — Objective</div><div style="font-size:0.88rem;line-height:1.75;">${soap.objective}</div></div>`);
  if (soap.assessment) sections.push(`<div style="margin-bottom:10px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.61rem;letter-spacing:0.12em;text-transform:uppercase;color:${SOAP_COLORS.A};margin-bottom:4px;">A — Assessment</div><div style="font-size:0.88rem;line-height:1.75;">${soap.assessment}</div></div>`);
  if (soap.plan) {
    const lines = soap.plan.split('\n').filter(Boolean).map(l => `<div style="display:flex;gap:8px;margin-bottom:4px;"><span style="color:var(--strata);margin-top:2px;">›</span><span>${l.replace(/^[•\-\*]\s*/, '')}</span></div>`).join('');
    sections.push(`<div style="margin-bottom:10px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.61rem;letter-spacing:0.12em;text-transform:uppercase;color:${SOAP_COLORS.P};margin-bottom:6px;">P — Plan</div>${lines}</div>`);
  }
  if (soap.clinical_flags && soap.clinical_flags.length) {
    const flags = soap.clinical_flags.map(f => `<div style="display:flex;gap:8px;margin-bottom:3px;"><span style="color:#ef4444;">⚑</span><span style="font-size:0.86rem;">${f}</span></div>`).join('');
    sections.push(`<div style="padding:10px 12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:8px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(239,68,68,0.6);margin-bottom:6px;">⚑ Clinical Flags</div>${flags}</div>`);
  }
  return sections.join('');
}

function buildSoapCopyText(soap, header) {
  return [
    header || 'SOAP NOTE — ZOE ATLAS Assessment',
    'Generated: ' + new Date().toLocaleString(),
    '─────────────────────────────────',
    'S (Subjective):\n' + (soap.subjective || ''),
    '',
    'O (Objective):\n'  + (soap.objective  || ''),
    '',
    'A (Assessment):\n' + (soap.assessment || ''),
    '',
    'P (Plan):\n'       + (soap.plan       || ''),
    soap.clinical_flags && soap.clinical_flags.length ? '\nCLINICAL FLAGS:\n' + soap.clinical_flags.map(f => '⚑ ' + f).join('\n') : '',
    soap.zoe_note ? '\nZOE Note: "' + soap.zoe_note + '"' : '',
    '─────────────────────────────────',
    'MMAS-8 © MMAR LLC · ATLAS © Adherence Cartography'
  ].filter(Boolean).join('\n');
}

function copySoapNote(taId, btnId) {
  const ta = document.getElementById(taId || 'soap-note-textarea');
  const btn = document.getElementById(btnId || 'pr-copy-soap-btn');
  if (!ta) return;
  navigator.clipboard.writeText(ta.value)
    .then(() => {
      if (btn) { btn.textContent = '✓ Copied!'; btn.style.color = 'var(--strata)'; setTimeout(() => { btn.textContent = 'Copy for Chart'; btn.style.color = ''; }, 2500); }
    })
    .catch(() => showToast('Select and copy manually.'));
}

function renderSoapOnResultModal() {
  const soap = window._zoeSoapNote;
  const soapPanel = document.getElementById('rc-soap-panel');
  const soapTa    = document.getElementById('rc-soap-textarea');
  const zoeNote   = document.getElementById('rc-zoe-note');
  if (!soap || !soapPanel || !soapTa) return;

  // SOAP notes are a clinical-grade institution feature
  if (!isInstitutionMode() && !isSuperAdmin()) return;

  soapTa.value = buildSoapCopyText(soap);
  if (zoeNote && soap.zoe_note) zoeNote.textContent = 'ZOE: "' + soap.zoe_note + '"';
  soapPanel.style.display = 'block';

  // copy button handler is set via inline onclick; no override needed

  // ── ZOE Read-Back Mode ─────────────────────────────────────────────────────
  // Reads the SOAP note aloud so the clinician can confirm hands-free.
  const readbackBtn = document.getElementById('rc-soap-readback-btn');
  if (readbackBtn && window.speechSynthesis) {
    readbackBtn.onclick = () => {
      const synth = window.speechSynthesis;
      if (synth.speaking) {
        synth.cancel();
        readbackBtn.textContent = '🔊 ZOE Read-Back';
        readbackBtn.style.borderColor = 'rgba(46,201,138,0.3)';
        readbackBtn.style.color = 'var(--strata)';
        return;
      }
      const fullText = [
        'Subjective. ' + (soap.subjective || ''),
        'Objective. ' + (soap.objective  || ''),
        'Assessment. ' + (soap.assessment || ''),
        'Plan. ' + (soap.plan ? soap.plan.replace(/\n/g, '. ').replace(/^[•\-\*]\s*/gm,'') : ''),
        soap.zoe_note ? 'ZOE note. ' + soap.zoe_note : ''
      ].filter(Boolean).join(' … ');

      const utt = new SpeechSynthesisUtterance(fullText);
      utt.rate = 0.9; utt.pitch = 1.1; utt.volume = 1;
      const voices = synth.getVoices();
      const v = voices.find(v=>/samantha|karen|victoria|zira|hazel|moira/i.test(v.name)&&v.lang.startsWith('en'))
        || voices.find(v=>v.lang.startsWith('en')&&v.localService)
        || voices.find(v=>v.lang.startsWith('en'))
        || voices[0];
      if (v) utt.voice = v;

      readbackBtn.textContent = '⏹ Stop Reading';
      readbackBtn.style.borderColor = 'rgba(46,201,138,0.7)';
      readbackBtn.style.color = '#2ec98a';
      utt.onend = utt.onerror = () => {
        readbackBtn.textContent = '🔊 ZOE Read-Back';
        readbackBtn.style.borderColor = 'rgba(46,201,138,0.3)';
        readbackBtn.style.color = 'var(--strata)';
      };
      synth.speak(utt);
      showToast('🔊 ZOE is reading the note aloud — no screen touch needed.', 3500);
    };
  } else if (readbackBtn) {
    readbackBtn.style.display = 'none'; // hide if TTS not supported
  }
}


// ══════════════════════════════════════════════
// ████  ATLAS PULSE SENTINEL  ████
// Real-time adherence triage & PI alert system
// ══════════════════════════════════════════════

let _sentinelListener = null;
let _sentinelReviewedKeys = new Set();
// Sentinel alert threshold — default 6.0 (low adherence). Configurable per workspace.
// Stored in localStorage as 'atlas_sentinel_threshold_{workspace}'.
let _sentinelThreshold = 6;
function _loadSentinelThreshold() {
  const ws = currentWorkspace || 'default';
  const saved = parseFloat(localStorage.getItem('atlas_sentinel_threshold_' + ws));
  if (!isNaN(saved) && saved >= 1 && saved <= 8) _sentinelThreshold = saved;
}
function _saveSentinelThreshold(val) {
  const ws = currentWorkspace || 'default';
  localStorage.setItem('atlas_sentinel_threshold_' + ws, val);
  _sentinelThreshold = val;
}

/**
 * Initialises the ATLAS Pulse Sentinel real-time adherence triage system.
 * Sets up Firebase listeners for low-adherence alerts for the active workspace.
 * Should be called once after a researcher or institution workspace is authenticated.
 * @returns {void}
 */
function initSentinel() {
  if (!currentWorkspace || !(isResearcherMode() || isInstitutionMode() || isSuperAdmin())) return;
  if (_sentinelListener) return; // guard: don't stack listeners
  _loadSentinelThreshold();

  // Load previously reviewed alert keys from localStorage
  try {
    const saved = localStorage.getItem('atlas_sentinel_reviewed_' + currentWorkspace);
    if (saved) _sentinelReviewedKeys = new Set(JSON.parse(saved));
  } catch(e) {}

  _injectSentinelUI();

  if (isInstitutionMode()) {
    // Institution: scan dashMmasData for all children with score < 6
    _sentinelLoadInstitutionAlerts();
    // Live listener: catch new low-score submissions from children
    const ws = (currentWorkspace || '').toUpperCase();
    const since = Date.now();
    database.ref('assessments').on('child_added', snap => {
      const r = snap.val();
      if (!r || !r.timestamp || r.timestamp <= since) return;
      const rWs     = (r.institution_code   || '').toUpperCase();
      const rParent = (r.parent_institution || '').toUpperCase();
      if (rWs === ws) return; // skip institution's own
      if (rParent !== ws && rWs === ws) return;
      if ((r.score || 0) >= _sentinelThreshold) return;
      const key   = snap.key;
      const flags = _triageSentinelFlags(r);
      if (!flags.length) flags.push({ type: 'una', label: 'Low Adherence' });
      _renderSentinelAlert(key, Object.assign({workspace: rWs, flags}, r));
      _updateSentinelBadge();
    });
    _sentinelListener = true;
    return;
  }

  // Researcher / superadmin: watch Firebase /alerts/{workspace}
  const alertRef = database.ref('alerts/' + currentWorkspace);
  _sentinelListener = alertRef.on('child_added', snap => {
    const alert = snap.val();
    const key   = snap.key;
    if (!alert) return;
    _renderSentinelAlert(key, alert);
    _updateSentinelBadge();
  });

  alertRef.on('child_changed', snap => {
    const alert = snap.val();
    const key   = snap.key;
    if (!alert) return;
    _updateSentinelAlertCard(key, alert);
    _updateSentinelBadge();
  });
}

function _sentinelLoadInstitutionAlerts() {
  const feed = document.getElementById('sentinel-feed');
  if (!feed) return;
  const ph = feed.querySelector('[data-placeholder]');
  if (ph) ph.remove();

  const ws      = (currentWorkspace || '').toUpperCase();
  const mmas    = dashMmasData || [];
  const lowScore = mmas.filter(r => {
    const rWs = (r.institution_code || '').toUpperCase();
    return rWs && rWs !== ws && (r.score || 0) < _sentinelThreshold;
  }).sort((a,b) => (a.score||0) - (b.score||0)); // worst first

  if (!lowScore.length) {
    feed.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);">No patients with score &lt; 6 across student cohorts.</div>';
    return;
  }

  lowScore.forEach((r, idx) => {
    const key   = 'inst_' + (r.user_id || idx) + '_' + (r.timestamp || idx);
    const flags = _triageSentinelFlags(r);
    if (!flags.length) flags.push({ type: 'una', label: 'Low Adherence' });
    _renderSentinelAlert(key, {
      timestamp:      r.timestamp,
      score:          r.score,
      patient_number: r.patient_number || null,
      country:        r.country || 'Unknown',
      city:           r.city || '',
      condition:      r.condition || null,
      drug_name:      r.drug_name || null,
      workspace:      (r.institution_code || '').toUpperCase(),
      flags
    });
  });
  _updateSentinelBadge();
}

function _injectSentinelUI() {
  if (document.getElementById('sentinel-panel')) return;
  const dashBody = document.querySelector('#screen-dashboard .dash-body');
  if (!dashBody) return;

  const panel = document.createElement('div');
  panel.id = 'sentinel-panel';
  panel.style.cssText = 'margin-bottom:20px;';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.18);border-radius:14px 14px 0 0;cursor:pointer;" id="sentinel-header" onclick="toggleSentinelPanel()">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;" id="sentinel-dot" class="sentinel-dot-blink"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.18em;text-transform:uppercase;color:#ef4444;">ATLAS Pulse Sentinel</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;color:rgba(239,68,68,0.5);" data-i18n="sentinelSub">· Real-Time Adherence Triage</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.08em;color:rgba(239,68,68,0.45);" onclick="event.stopPropagation()">
          <span>Alert at</span>
          <select id="sentinel-threshold-sel" onchange="sentinelSetThreshold(parseFloat(this.value))" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);color:rgba(239,68,68,0.8);font-family:'IBM Plex Mono',monospace;font-size:0.70rem;border-radius:4px;padding:2px 4px;cursor:pointer;outline:none;">
            <option value="4">≤ 4.0</option>
            <option value="5">≤ 5.0</option>
            <option value="6" selected>≤ 6.0</option>
            <option value="7">≤ 7.0</option>
          </select>
        </div>
        <div id="sentinel-badge" style="display:none;background:#ef4444;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;border-radius:20px;padding:2px 9px;font-weight:600;"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:rgba(239,68,68,0.5);" id="sentinel-toggle-icon">▼</span>
      </div>
    </div>
    <div id="sentinel-body" style="display:none;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.18);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;">
      <div style="padding:12px 18px;border-bottom:1px solid rgba(239,68,68,0.1);display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:rgba(239,68,68,0.6);">FLAGS: Scores &lt;6 · INA patterns · ZOE-detected clinical flags</span>
        <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;">
          <button onclick="exportSentinelCSV()" title="Columns: patient_number, score, pattern, flag_type, flag_label, country, timestamp" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.25);color:rgba(239,68,68,0.6);border-radius:6px;padding:4px 10px;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.borderColor='rgba(239,68,68,0.5)';this.style.color='#ef4444'" onmouseleave="this.style.borderColor='rgba(239,68,68,0.25)';this.style.color='rgba(239,68,68,0.6)'">↓ Export Alerts CSV</button>
          <span class="export-cols">Columns: patient_number, score, pattern, flag_type, flag_label, country, timestamp</span>
        </div>
        <button onclick="clearReviewedSentinelAlerts()" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.08);color:var(--dim);border-radius:6px;padding:4px 10px;cursor:pointer;">Clear Reviewed</button>
      </div>
      <div id="sentinel-feed" style="max-height:420px;overflow-y:auto;">
        <div style="padding:24px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:var(--dim);" data-placeholder>Monitoring cohort — no critical alerts yet.</div>
      </div>
    </div>`;

  // Insert before the first child (top of dash body)
  dashBody.insertBefore(panel, dashBody.firstChild);

  // Inject blink animation if not present
  if (!document.getElementById('sentinel-style')) {
    const s = document.createElement('style');
    s.id = 'sentinel-style';
    s.textContent = `
      @keyframes sentinelBlink{0%,100%{opacity:1;box-shadow:0 0 8px #ef4444;}50%{opacity:0.4;box-shadow:0 0 3px #ef4444;}}
      .sentinel-dot-blink{animation:sentinelBlink 1.8s ease-in-out infinite;}
      .sentinel-alert-card{padding:14px 18px;border-bottom:1px solid rgba(239,68,68,0.08);display:flex;gap:14px;align-items:flex-start;animation:fadeUp 0.35s ease both;transition:background 0.2s;}
      .sentinel-alert-card:hover{background:rgba(239,68,68,0.04);}
      .sentinel-alert-card.reviewed{opacity:0.45;}
      .sentinel-score-pill{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.8rem;font-weight:300;line-height:1;color:#ef4444;min-width:40px;}
      .sentinel-score-pill.moderate{color:#f59e0b;}
      .sentinel-meta{flex:1;min-width:0;}
      .sentinel-pid{font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--text);font-weight:500;margin-bottom:3px;}
      .sentinel-detail{font-family:'IBM Plex Mono',monospace;font-size:0.84rem;color:var(--muted);line-height:1.6;}
      .sentinel-flag-pill{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;padding:2px 7px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);color:#ef4444;background:rgba(239,68,68,0.06);margin:2px 2px 0 0;}
      .sentinel-flag-pill.ina{border-color:rgba(239,68,68,0.3);color:#ef4444;}
      .sentinel-flag-pill.una{border-color:rgba(245,158,11,0.3);color:#f59e0b;}
      .sentinel-flag-pill.zoe{border-color:rgba(139,111,245,0.3);color:var(--mvmt);}
      .sentinel-review-btn{font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid rgba(239,68,68,0.25);color:rgba(239,68,68,0.7);border-radius:6px;padding:5px 12px;cursor:pointer;transition:all 0.2s;white-space:nowrap;flex-shrink:0;}
      .sentinel-review-btn:hover{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}
      .sentinel-review-btn.done{border-color:rgba(46,201,138,0.3);color:var(--optimal);cursor:default;}
      .sentinel-ts{font-family:'IBM Plex Mono',monospace;font-size:0.90rem;color:var(--dim);margin-top:3px;}
    `;
    document.head.appendChild(s);
  }
}

/**
 * Toggles the Sentinel alert panel open/closed.
 * @returns {void}
 */
function toggleSentinelPanel() {
  const body = document.getElementById('sentinel-body');
  const icon = document.getElementById('sentinel-toggle-icon');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (icon) icon.textContent = open ? '▲' : '▼';
}

function _triageSentinelFlags(record) {
  const flags = [];
  const score = record.score || 0;
  const ws    = record.institution_code;

  if (score < _sentinelThreshold) {
    const {intentional = 0, unintentional = 0} = record.q1 !== undefined ? classifyPattern(record) : {};
    flags.push({ type: intentional >= unintentional ? 'ina' : 'una', label: intentional >= unintentional ? 'INA Pattern' : 'UNA Pattern' });
  }
  if (record.soap_note && record.soap_note.clinical_flags && record.soap_note.clinical_flags.length) {
    record.soap_note.clinical_flags.forEach(f => flags.push({ type: 'zoe', label: f }));
  }
  return flags;
}

// Write a sentinel alert to Firebase when a critical submission lands
/**
 * Fires a new Sentinel alert for a low-adherence assessment record.
 * Writes the alert to Firebase `sentinel_alerts/{workspace}/{key}` and renders it in the UI.
 * @param {Object} record - MMAS-8 assessment record that triggered the alert
 * @param {string} assessmentKey - Firebase key of the triggering assessment
 * @returns {Promise<void>}
 */
async function fireSentinelAlert(record, assessmentKey) {
  if (!currentWorkspace || !isResearcherMode()) return;
  const score = record.score || 0;
  const hasClinicalFlags = record.soap_note && record.soap_note.clinical_flags && record.soap_note.clinical_flags.length;
  if (score >= _sentinelThreshold && !hasClinicalFlags) return; // not critical — don't fire

  const flags = _triageSentinelFlags(record);
  if (!flags.length) return;

  const alert = {
    timestamp:        Date.now(),
    assessment_key:   assessmentKey || null,
    score:            score,
    patient_number:   record.patient_number || null,
    country:          record.country || 'Unknown',
    city:             record.city    || 'Unknown',
    condition:        record.condition || null,
    drug_name:        record.drug_name || null,
    zoe_session:      !!record.zoe_session,
    clinical_flags:   hasClinicalFlags ? record.soap_note.clinical_flags : [],
    flags:            flags,
    reviewed:         false,
    reviewed_by:      null,
    reviewed_at:      null,
    workspace:        currentWorkspace
  };

  try {
    await database.ref('alerts/' + currentWorkspace).push(alert);
  } catch(e) { /* non-blocking */ }
}

function _renderSentinelAlert(key, alert) {
  const feed = document.getElementById('sentinel-feed');
  if (!feed) return;
  if (document.getElementById('sentinel-card-' + key)) {
    _updateSentinelAlertCard(key, alert);
    return;
  }

  const placeholder = feed.querySelector('[data-placeholder]');
  if (placeholder) placeholder.remove();

  const score  = alert.score || 0;
  const isLow  = score < _sentinelThreshold;
  const ts     = alert.timestamp ? new Date(alert.timestamp).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
  const pid    = _esc(alert.patient_number || 'Anonymous');
  const loc    = _esc([alert.city, alert.country].filter(c => c && c !== 'Unknown').join(', ') || 'Unknown location');
  const cond   = alert.condition ? ` · ${_esc(alert.condition)}` : '';
  const drug   = alert.drug_name ? ` · ${_esc(alert.drug_name)}` : '';
  const reviewed = alert.reviewed || _sentinelReviewedKeys.has(key);

  const flagPills = (alert.flags || []).map(f =>
    `<span class="sentinel-flag-pill ${_esc(f.type)}">${_esc(f.label)}</span>`
  ).join('');
  const clinFlags = (alert.clinical_flags || []).map(f =>
    `<span class="sentinel-flag-pill zoe">⚑ ${_esc(f)}</span>`
  ).join('');

  const card = document.createElement('div');
  card.id = 'sentinel-card-' + key;
  card.className = 'sentinel-alert-card' + (reviewed ? ' reviewed' : '');
  card.innerHTML = `
    <div class="sentinel-score-pill ${score >= _sentinelThreshold ? 'moderate' : ''}">${score.toFixed(2)}</div>
    <div class="sentinel-meta" style="width:100%;">
      <div class="sentinel-pid">${pid}${alert.zoe_session ? ' <span class="sentinel-flag-pill zoe">ZOE</span>' : ''}</div>
      <div class="sentinel-detail">${loc}${cond}${drug}</div>
      <div style="margin-top:5px;">${flagPills}${clinFlags}</div>
      <div class="sentinel-ts">${ts}</div>
      <div class="sentinel-escalation" id="esc-${key}">
        <!-- Stage 1: Assign -->
        <div class="sentinel-esc-stage">1 &middot; Assign</div>
        <div class="sentinel-esc-row">
          <input class="sentinel-assign-input" id="esc-assign-${key}" placeholder="Coordinator name or email" />
          <button class="sentinel-assign-btn" onclick="sentinelAssign('${key}')">Assign</button>
        </div>
        <div id="esc-assigned-${key}" class="sentinel-audit-line"></div>
        <!-- Stage 2: Contact Outcome -->
        <div class="sentinel-esc-stage" style="margin-top:8px;">2 &middot; Contact Outcome</div>
        <div class="sentinel-contact-btns" id="esc-contact-${key}">
          <button class="sentinel-contact-btn" onclick="sentinelContact('${key}','reached')" data-outcome="reached">Reached</button>
          <button class="sentinel-contact-btn" onclick="sentinelContact('${key}','no-answer')" data-outcome="no-answer">No Answer</button>
          <button class="sentinel-contact-btn" onclick="sentinelContact('${key}','declined')" data-outcome="declined">Declined</button>
          <button class="sentinel-contact-btn" onclick="sentinelContact('${key}','referred')" data-outcome="referred">Referred</button>
        </div>
        <!-- Stage 3: Resolve -->
        <button class="sentinel-resolve-btn" id="esc-resolve-${key}" onclick="sentinelResolve('${key}')" disabled>
          Mark Resolved &amp; Close
        </button>
        <div id="esc-resolved-${key}"></div>
      </div>
    </div>`;

  feed.insertBefore(card, feed.firstChild);
  _sentinelRestoreEsc(key);
}

function _updateSentinelAlertCard(key, alert) {
  const card = document.getElementById('sentinel-card-' + key);
  if (!card) { _renderSentinelAlert(key, alert); return; }
  const btn = document.getElementById('sentinel-btn-' + key);
  if (alert.reviewed) {
    card.classList.add('reviewed');
    if (btn) { btn.textContent = '✓ Reviewed'; btn.classList.add('done'); }
  }
}

/**
 * Marks a Sentinel alert as reviewed by the current clinician.
 * Updates Firebase and persists reviewed keys to localStorage.
 * @param {string} key - Firebase key of the Sentinel alert
 * @param {HTMLElement} btn - The "Mark Reviewed" button element (disabled during request)
 * @returns {Promise<void>}
 */
async function markSentinelReviewed(key, btn) {
  if (!key || !currentWorkspace) return;
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  try {
    await database.ref('alerts/' + currentWorkspace + '/' + key).update({
      reviewed:    true,
      reviewed_by: userId || 'unknown',
      reviewed_at: Date.now()
    });
    _sentinelReviewedKeys.add(key);
    // Persist reviewed set locally
    try { localStorage.setItem('atlas_sentinel_reviewed_' + currentWorkspace, JSON.stringify([..._sentinelReviewedKeys])); } catch(e) {}
    const card = document.getElementById('sentinel-card-' + key);
    if (card) card.classList.add('reviewed');
    if (btn) { btn.textContent = '✓ Reviewed'; btn.classList.add('done'); btn.disabled = false; }
    _updateSentinelBadge();
    showToast('Marked reviewed.', 2000);
  } catch(e) {
    if (btn) { btn.textContent = 'Mark Reviewed'; btn.disabled = false; }
    showToast('Could not update — try again.');
  }
}

function _updateSentinelBadge() {
  const badge = document.getElementById('sentinel-badge');
  const dot   = document.getElementById('sentinel-dot');
  if (!badge) return;
  const feed  = document.getElementById('sentinel-feed');
  if (!feed) return;
  const cards = feed.querySelectorAll('.sentinel-alert-card:not(.reviewed)');
  const count = cards.length;
  if (count > 0) {
    badge.textContent = count + ' unreviewed';
    badge.style.display = '';
    if (dot) dot.classList.add('sentinel-dot-blink');
  } else {
    badge.style.display = 'none';
    if (dot) dot.classList.remove('sentinel-dot-blink');
  }
}

function clearReviewedSentinelAlerts() {
  const feed = document.getElementById('sentinel-feed');
  if (!feed) return;
  feed.querySelectorAll('.sentinel-alert-card.reviewed').forEach(c => c.remove());
  if (!feed.querySelector('.sentinel-alert-card')) {
    const p = document.createElement('div');
    p.setAttribute('data-placeholder', '');
    p.style.cssText = 'padding:24px;text-align:center;font-family:IBM Plex Mono,monospace;font-size:0.90rem;color:var(--dim);';
    p.textContent = 'Monitoring cohort — no unreviewed alerts.';
    feed.appendChild(p);
  }
  _updateSentinelBadge();
}

/**
 * Exports all active Sentinel alerts as a CSV file.
 * @returns {void}
 */
function exportSentinelCSV() {
  if (!currentWorkspace) return;
  database.ref('alerts/' + currentWorkspace).once('value', snap => {
    const data = snap.val();
    if (!data) { showToast('No sentinel alerts to export yet.'); return; }
    const rows = Object.entries(data).map(([k, a]) => [
      k,
      new Date(a.timestamp).toISOString(),
      a.patient_number || 'Anonymous',
      (a.score || 0).toFixed(2),
      a.country || 'Unknown',
      a.city || 'Unknown',
      a.condition || '',
      a.drug_name || '',
      (a.flags || []).map(f => f.label).join('; '),
      (a.clinical_flags || []).join('; '),
      a.zoe_session ? 'Yes' : 'No',
      a.reviewed ? 'Yes' : 'No',
      a.reviewed_by || '',
      a.reviewed_at ? new Date(a.reviewed_at).toISOString() : ''
    ]);
    triggerCSVDownload(
      ['Alert_Key','Timestamp','Patient_ID','Score','Country','City','Condition','Drug','Flags','Clinical_Flags','ZOE_Session','Reviewed','Reviewed_By','Reviewed_At'],
      rows,
      'atlas-sentinel-alerts-' + currentWorkspace.toLowerCase() + '-' + new Date().toISOString().split('T')[0] + '.csv'
    );
    showToast('Sentinel alerts exported.', 2500);
  });
}

// ── Sentinel Escalation Workflow ─────────────────────
const _sentinelEscState = {}; // keyed by alertId

function sentinelAssign(alertId) {
  const input = document.getElementById(`esc-assign-${alertId}`);
  if (!input || !input.value.trim()) return;
  const assignee = input.value.trim();
  const ts = new Date().toLocaleString();

  if (!_sentinelEscState[alertId]) _sentinelEscState[alertId] = {};
  _sentinelEscState[alertId].assignedTo = assignee;
  _sentinelEscState[alertId].assignedAt = ts;

  const auditLine = document.getElementById(`esc-assigned-${alertId}`);
  if (auditLine) auditLine.textContent = `Assigned to ${assignee} · ${ts}`;
  if (input) { input.disabled = true; input.style.background = '#f9fafb'; }

  // Persist to Firebase if available
  _sentinelPersistEsc(alertId);
}

function sentinelContact(alertId, outcome) {
  const ts = new Date().toLocaleString();
  if (!_sentinelEscState[alertId]) _sentinelEscState[alertId] = {};
  _sentinelEscState[alertId].contactOutcome = outcome;
  _sentinelEscState[alertId].contactAt = ts;

  // Update button states
  const container = document.getElementById(`esc-contact-${alertId}`);
  if (container) {
    container.querySelectorAll('.sentinel-contact-btn').forEach(btn => {
      btn.classList.remove('selected','reached','no-answer','declined','referred');
      if (btn.dataset.outcome === outcome) {
        btn.classList.add('selected', outcome);
      }
    });
  }

  // Enable resolve button
  const resolveBtn = document.getElementById(`esc-resolve-${alertId}`);
  if (resolveBtn) resolveBtn.disabled = false;

  _sentinelPersistEsc(alertId);
}

function sentinelResolve(alertId) {
  const state = _sentinelEscState[alertId] || {};
  if (!state.contactOutcome) return;
  const ts = new Date().toLocaleString();
  state.resolvedAt = ts;
  state.resolved = true;

  // Show resolved badge
  const resolvedEl = document.getElementById(`esc-resolved-${alertId}`);
  if (resolvedEl) {
    resolvedEl.innerHTML = `
      <div class="sentinel-resolved-badge">
        <i data-lucide="check-circle" style="width:12px;height:12px;"></i>
        Resolved · ${state.contactOutcome} · ${ts}
      </div>
      <div class="sentinel-audit-line">
        ${state.assignedTo ? `Assigned: ${state.assignedTo} · ` : ''}Contact: ${state.contactOutcome} · Resolved: ${ts}
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Disable resolve button
  const resolveBtn = document.getElementById(`esc-resolve-${alertId}`);
  if (resolveBtn) { resolveBtn.disabled = true; resolveBtn.textContent = '✓ Resolved'; resolveBtn.style.background = '#10b981'; }

  // Mark card as resolved
  const card = document.getElementById(`esc-${alertId}`) && document.getElementById(`esc-${alertId}`).closest('.sentinel-alert-card');
  if (card) {
    card.classList.add('reviewed');
    card.style.opacity = '0.6';
  }

  // Update badge count
  if (typeof _updateSentinelBadge === 'function') _updateSentinelBadge();

  _sentinelPersistEsc(alertId);
}

/**
 * Updates the sentinel alert threshold and reflects the selection in the UI dropdown.
 * @param {number} val - New threshold value (1–8). Alerts fire for scores below this value.
 */
function sentinelSetThreshold(val) {
  _saveSentinelThreshold(val);
  const sel = document.getElementById('sentinel-threshold-sel');
  if (sel) sel.value = String(val);
  showToast('Sentinel threshold set to ≤ ' + val.toFixed(1) + '. Reloading alerts…', 3000);
  // Reload institution alerts with new threshold
  const feed = document.getElementById('sentinel-feed');
  if (feed) { feed.innerHTML = ''; }
  if (typeof _sentinelLoadInstitutionAlerts === 'function') _sentinelLoadInstitutionAlerts();
}

function _sentinelPersistEsc(alertId) {
  const state = _sentinelEscState[alertId];
  if (!state) return;
  // Persist to localStorage for session continuity
  try {
    const stored = JSON.parse(localStorage.getItem('atlas_sentinel_esc') || '{}');
    stored[alertId] = state;
    localStorage.setItem('atlas_sentinel_esc', JSON.stringify(stored));
  } catch(e) {}

  // Persist to Firebase if path is known
  try {
    const db = window._firebaseDb || (typeof firebase !== 'undefined' && firebase.database && firebase.database());
    if (db) db.ref(`sentinel_esc/${alertId}`).set(state);
  } catch(e) {}
}

// Restore escalation state on card render
function _sentinelRestoreEsc(alertId) {
  try {
    const stored = JSON.parse(localStorage.getItem('atlas_sentinel_esc') || '{}');
    const state = stored[alertId];
    if (!state) return;
    _sentinelEscState[alertId] = state;
    if (state.assignedTo) {
      const input = document.getElementById(`esc-assign-${alertId}`);
      const auditLine = document.getElementById(`esc-assigned-${alertId}`);
      if (input) { input.value = state.assignedTo; input.disabled = true; input.style.background = '#f9fafb'; }
      if (auditLine) auditLine.textContent = `Assigned to ${state.assignedTo} · ${state.assignedAt || ''}`;
    }
    if (state.contactOutcome) {
      sentinelContact(alertId, state.contactOutcome);
    }
    if (state.resolved) {
      sentinelResolve(alertId);
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════
// FIREBASE SECURITY RULES PANEL
// Visible to superadmin and institution roles only.
// Shows the recommended Realtime Database ruleset and API key threat model.
// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
// FEATURE 1: ADHERENCE PHENOTYPING ENGINE (APE)
// 5-phenotype probabilistic model
// Phenotypes: Intentional Resistor · Routine Forgetter · Situational Skipper
//             Side-Effect Avoider · Optimistic Stopper
// ══════════════════════════════════════════════
const APE_PHENOTYPES = [
  {
    id:'intentional_resistor', name:'Intentional Resistor', icon:'⚡',
    color:'#ef4444', desc:'Deliberately chooses not to take medication, often due to beliefs about necessity or efficacy.',
    interventions:['Motivational interviewing','Beliefs clarification counselling','Shared decision-making sessions'],
    // Weighted item contributions: Q2(high),Q3(high),Q6(high),Q7(moderate)
    _score: r => {
      const q2=1-parseFloat(r.q2||0), q3=1-parseFloat(r.q3||0);
      const q6=1-parseFloat(r.q6||0), q7=1-parseFloat(r.q7||0);
      return (q2*0.35 + q3*0.30 + q6*0.25 + q7*0.10);
    }
  },
  {
    id:'routine_forgetter', name:'Routine Forgetter', icon:'🕐',
    color:'#f59e0b', desc:'Forgets doses consistently due to poor habit formation or lack of environmental cues.',
    interventions:['Pill organizer + visual cues','Smartphone alarm systems','Habit-stacking counselling'],
    _score: r => {
      const q1=1-parseFloat(r.q1||0), q4=1-parseFloat(r.q4||0);
      const q8raw = typeof r.q8==='number' ? ({0:1,1:0.75,2:0.5,3:0.25,4:0}[r.q8]??0.5) : (typeof r.q8==='string' ? ({never:1,rarely:0.75,'once in a while':0.75,sometimes:0.5,often:0.25,usually:0.25,always:0,'all the time':0}[r.q8.toLowerCase()]??0.5) : 0.5);
      return (q1*0.40 + q4*0.25 + (1-q8raw)*0.35);
    }
  },
  {
    id:'situational_skipper', name:'Situational Skipper', icon:'✈️',
    color:'#8b6ff5', desc:'Misses doses primarily when routine disrupted — travel, schedule changes, or environmental shifts.',
    interventions:['Travel medication kit','Environmental restructuring','Portable reminder systems'],
    _score: r => {
      const q4=1-parseFloat(r.q4||0), q5=parseFloat(r.q5||0)===1?0:1;
      return (q4*0.55 + q5*0.45);
    }
  },
  {
    id:'side_effect_avoider', name:'Side-Effect Avoider', icon:'💊',
    color:'#3b82f6', desc:'Stops or reduces medication due to experienced or anticipated adverse effects.',
    interventions:['Side-effect management counselling','Formulation alternatives review','Patient assistance hotline'],
    _score: r => {
      const q3=1-parseFloat(r.q3||0);
      return q3; // Q3 is the primary marker for side-effect-driven non-adherence
    }
  },
  {
    id:'optimistic_stopper', name:'Optimistic Stopper', icon:'☀️',
    color:'#10b981', desc:'Stops medication when symptoms improve, believing condition is resolved.',
    interventions:['Disease education sessions','Outcome expectation counselling','Condition monitoring alerts'],
    _score: r => {
      const q6=1-parseFloat(r.q6||0);
      return q6;
    }
  }
];

function classifyApePhenotype(record) {
  // Returns array of {phenotype, prob} sorted descending
  // Only non-high-adherence records contribute meaningfully
  if (!record || record.q1 === undefined) return null;
  const scores = APE_PHENOTYPES.map(ph => ({ ph, raw: ph._score(record) }));
  const total = scores.reduce((s,x) => s + x.raw, 0) || 1;
  return scores.map(x => ({ phenotype: x.ph, prob: x.raw / total })).sort((a,b) => b.prob - a.prob);
}

let _apeOpen = false;
function toggleApePanel() {
  // APE (Adherence Phenotyping Engine) is available to all tiers.
  // PPE (Predictive Emergence — advanced PEACS scoring) is the higher-tier gate, not APE.
  _apeOpen = !_apeOpen;
  const body = document.getElementById('ape-body');
  const icon = document.getElementById('ape-toggle-icon');
  if (body) body.style.display = _apeOpen ? '' : 'none';
  if (icon) icon.textContent = _apeOpen ? '▲ Hide' : '▼ Show';
}

/**
 * Renders the Adherence Phenotype Engine (APE) panel with phenotype distribution charts.
 * @param {Array<Object>} records - MMAS-8 assessment records for the cohort
 * @returns {void}
 */
function renderAPE(records) {
  if (!records || !records.length) return;
  const panel = document.getElementById('ape-panel');
  if (!panel) return;
  // Do NOT bail on display:none — render data regardless so it's ready when panel opens

  // Count phenotype plurality assignments across cohort
  const counts = {}; APE_PHENOTYPES.forEach(p => counts[p.id] = 0);
  let classified = 0;
  records.forEach(r => {
    if (r.score === 8) return; // skip perfect adherers
    const result = classifyApePhenotype(r);
    if (!result) return;
    classified++;
    const top = result[0]; // plurality phenotype
    if (top && top.prob > 0.15) counts[top.phenotype.id]++;
  });

  const grid = document.getElementById('ape-cards-grid');
  if (!grid) return;
  const maxCount = Math.max(...Object.values(counts), 1);
  // Store classified records for the patient filter panel
  window._apeRecords = records.filter(r => r.score !== 8 && r.tool !== 'map' && r.map_q1 === undefined);
  window._apeFilter = null;

  grid.innerHTML = APE_PHENOTYPES.map(ph => {
    const n = counts[ph.id];
    const pct = classified > 0 ? Math.round(n / classified * 100) : 0;
    const barW = Math.round(n / maxCount * 100);
    return `<div class="ape-phenotype-card" id="ape-card-${ph.id}" style="background:${ph.color}0a;border-color:${ph.color}25;cursor:pointer;" onclick="apeFilterByPhenotype('${ph.id}')" title="Click to see individual patients">
      <div class="ape-ph-icon">${ph.icon}</div>
      <div class="ape-ph-name" style="color:${ph.color}99;">${ph.name}</div>
      <div class="ape-ph-count" style="color:${ph.color};">${n}</div>
      <div class="ape-ph-pct">${pct}% of non-high cohort</div>
      <div class="ape-ph-bar"><div class="ape-ph-bar-fill" style="width:${barW}%;background:${ph.color};"></div></div>
      <div style="font-size:0.86rem;color:var(--muted);line-height:1.6;margin-top:8px;">${ph.desc}</div>
      <div style="font-family:var(--font-mono);font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;color:${ph.color}60;margin-top:8px;text-align:center;">↓ View patients</div>
    </div>`;
  }).join('');

  // Top interventions row
  const topPh = APE_PHENOTYPES.reduce((a,b) => counts[a.id] >= counts[b.id] ? a : b);
  const intRow = document.getElementById('ape-intervention-row');
  if (intRow) {
    intRow.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);margin-right:8px;">Top phenotype interventions → ${topPh.name}:</span>`
      + topPh.interventions.map(i => `<span class="ape-int-chip">${i}</span>`).join('');
  }

  // Show all-patient list by default
  apeRenderPatients();
}

// ══════════════════════════════════════════════════════════════════════════════
// PE DOMAIN ANALYSIS — Theory of Predictive Emergence applied to MMAS-8
// Gated: researcher / PI / institution / superadmin only (not student)
// ══════════════════════════════════════════════════════════════════════════════
let _peDomainOpen = false;

function togglePEDomainPanel() {
  _peDomainOpen = !_peDomainOpen;
  const body = document.getElementById('pe-domain-body');
  const icon = document.getElementById('pe-domain-toggle-icon');
  if (body) body.style.display = _peDomainOpen ? '' : 'none';
  if (icon) icon.textContent = _peDomainOpen ? '▲ Hide' : '▼ Show';
}

// PE Domain table state
window._peDomainRecords    = [];
window._peDomainPageSize   = 20;
window._peDomainPage       = 0;
window._peDomainSortCol    = 'pe';
window._peDomainSortDir    = 1;   // 1 = asc, -1 = desc
window._peDomainSearch     = '';
window._peDomainConstraint = '';

function peDomainSort(col) {
  if (window._peDomainSortCol === col) window._peDomainSortDir *= -1;
  else { window._peDomainSortCol = col; window._peDomainSortDir = 1; }
  window._peDomainPage = 0;
  renderPEDomainTable();
}

function renderPEDomainTable() {
  const tbody   = document.getElementById('pe-domain-tbody');
  const pager   = document.getElementById('pe-domain-pager');
  const countEl = document.getElementById('pe-domain-count');
  if (!tbody) return;

  let rows = window._peDomainRecords || [];

  // Search filter
  const q = (window._peDomainSearch || '').toLowerCase().trim();
  if (q) rows = rows.filter(r => (r.patient_number || '').toLowerCase().includes(q));

  // Constraint filter
  const cf = window._peDomainConstraint || '';
  if (cf) rows = rows.filter(r => {
    const minDom = Math.min(r._a, r._e, r._c);
    return (r._a === minDom ? 'A' : r._e === minDom ? 'E' : 'C') === cf;
  });

  // Sort
  const col = window._peDomainSortCol || 'pe';
  const dir = window._peDomainSortDir || 1;
  rows = [...rows].sort((a, b) => {
    if (col === '#')     return dir * (a.patient_number || '').localeCompare(b.patient_number || '');
    if (col === 'score') return dir * ((a.score || 0) - (b.score || 0));
    if (col === 'pe')    return dir * (a._pe - b._pe);
    if (col === 'a')     return dir * (a._a - b._a);
    if (col === 'e')     return dir * (a._e - b._e);
    if (col === 'c')     return dir * (a._c - b._c);
    if (col === 'date')  return dir * ((a.timestamp || 0) - (b.timestamp || 0));
    return dir * (a._pe - b._pe);
  });

  // Update sort indicators
  ['num','score','pe','a','e','c','date'].forEach(k => {
    const el = document.getElementById('pe-th-' + k);
    if (!el) return;
    const colMap = { num: '#', score: 'score', pe: 'pe', a: 'a', e: 'e', c: 'c', date: 'date' };
    const base = k.toUpperCase() === 'NUM' ? '#' : k.toUpperCase();
    if (colMap[k] === col) el.textContent = base + (dir === 1 ? ' ↑' : ' ↓');
    else el.textContent = base + ' ↕';
  });

  const pageSize   = window._peDomainPageSize || 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  window._peDomainPage = Math.max(0, Math.min(window._peDomainPage, totalPages - 1));
  const page = window._peDomainPage;

  if (countEl) countEl.textContent = rows.length + ' patient' + (rows.length !== 1 ? 's' : '');

  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.84rem;">No patients match this filter.</td></tr>`;
    if (pager) pager.style.display = 'none';
    return;
  }

  tbody.innerHTML = pageRows.map(r => {
    const cat = getAdherenceCategory(r.score);
    const d = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const peColor = r._pe >= 0.75 ? '#10b981' : r._pe >= 0.5 ? '#f59e0b' : '#ef4444';
    const minDom = Math.min(r._a, r._e, r._c);
    const constDom = r._a === minDom ? 'A' : r._e === minDom ? 'E' : 'C';
    const constColor = constDom === 'A' ? 'var(--base)' : constDom === 'E' ? 'var(--mvmt)' : 'var(--strata)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:6px 8px;color:var(--muted);">${_esc(r.patient_number) || '—'}</td>
      <td style="padding:6px 8px;color:${cat.color};font-weight:600;">${(r.score || 0).toFixed(2)}</td>
      <td style="padding:6px 8px;color:${peColor};font-weight:600;font-family:var(--font-mono);">${r._pe.toFixed(3)}</td>
      <td style="padding:6px 8px;color:var(--base);font-family:var(--font-mono);">${r._a.toFixed(2)}</td>
      <td style="padding:6px 8px;color:var(--mvmt);font-family:var(--font-mono);">${r._e.toFixed(2)}</td>
      <td style="padding:6px 8px;color:var(--strata);font-family:var(--font-mono);">${r._c.toFixed(2)}</td>
      <td style="padding:6px 8px;"><span style="font-size:0.78rem;padding:1px 6px;border-radius:6px;background:${constColor}18;color:${constColor};border:1px solid ${constColor}35;">${constDom}</span></td>
      <td style="padding:6px 8px;color:var(--dim);font-size:0.88rem;">${d}</td>
    </tr>`;
  }).join('');

  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    const info = document.getElementById('pe-domain-pageinfo');
    const prev = document.getElementById('pe-domain-prev');
    const next = document.getElementById('pe-domain-next');
    if (info) info.textContent = `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length}`;
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= totalPages - 1;
  }
}

function exportPEDomainCSV() {
  const records = window._peDomainRecords || [];
  if (!records.length) { showToast('No PE domain data to export.'); return; }
  const headers = ['Patient_Num', 'Score', 'Adherence_Level', 'PE', 'Architecture_A', 'Execution_E', 'Context_C', 'Primary_Constraint', 'Date'];
  const rows = records.map(r => {
    const cat = getAdherenceCategory(r.score);
    const minDom = Math.min(r._a, r._e, r._c);
    const constDom = r._a === minDom ? 'Architecture' : r._e === minDom ? 'Execution' : 'Context';
    return [
      r.patient_number || '',
      (r.score || 0).toFixed(2),
      cat ? cat.label : '',
      r._pe.toFixed(4),
      r._a.toFixed(4),
      r._e.toFixed(4),
      r._c.toFixed(4),
      constDom,
      new Date(r.timestamp).toISOString()
    ];
  });
  triggerCSVDownload(headers, rows, 'pe-domain-analysis-' + new Date().toISOString().split('T')[0] + '.csv');
  showToast('Exported ' + rows.length + ' PE domain records.', 3000);
}

/**
 * Renders the PEACS PE-domain breakdown analysis panel.
 * @param {Array<Object>} records - PEACS assessment records for the cohort
 * @returns {void}
 */
function renderPEDomainAnalysis(records) {
  const panel = document.getElementById('pe-domain-panel');
  const content = document.getElementById('pe-domain-content');
  if (!panel || !content) return;

  // Gate: researcher / PI / institution / superadmin only
  const role = workspaceProfile && workspaceProfile.role;
  if (!role || role === 'student') { panel.style.display = 'none'; return; }

  // Compute PE for all records that have Q responses
  const peRecords = records.map(r => {
    // Prefer cached values but only if all four are finite numbers
    const cached = (r.mmas_pe !== undefined && r.mmas_pe !== null &&
                    r.mmas_a  !== undefined && r.mmas_a  !== null)
      ? { pe: r.mmas_pe, a: r.mmas_a, e: r.mmas_e, c: r.mmas_c }
      : computeMMASPE(r);
    if (!cached) return null;
    const pe = +cached.pe, a = +cached.a, e = +cached.e, c = +cached.c;
    // Drop any record where any domain value is not a real finite number
    if (!isFinite(pe) || !isFinite(a) || !isFinite(e) || !isFinite(c)) return null;
    return { ...r, _pe: pe, _a: a, _e: e, _c: c };
  }).filter(Boolean);

  if (!peRecords.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  // Cohort aggregates
  const n = peRecords.length;
  const avgPE = peRecords.reduce((s,r)=>s+r._pe,0)/n;
  const avgA  = peRecords.reduce((s,r)=>s+r._a, 0)/n;
  const avgE  = peRecords.reduce((s,r)=>s+r._e, 0)/n;
  const avgC  = peRecords.reduce((s,r)=>s+r._c, 0)/n;

  // Constraint distribution — which domain is lowest per patient
  let cntA=0, cntE=0, cntC=0;
  peRecords.forEach(r => {
    const min = Math.min(r._a, r._e, r._c);
    if (r._a === min) cntA++;
    else if (r._e === min) cntE++;
    else cntC++;
  });

  const bar = (v, color, label) => `<div style="margin-bottom:10px;">
    <div style="font-family:var(--font-mono);font-size:0.80rem;color:${color};display:flex;justify-content:space-between;margin-bottom:3px;">
      <span>${label}</span><span>${v.toFixed(2)}</span>
    </div>
    <div style="height:8px;border-radius:4px;background:var(--border2);overflow:hidden;">
      <div style="height:100%;width:${Math.round(v*100)}%;background:${color};border-radius:4px;transition:width 0.9s ease;"></div>
    </div>
  </div>`;

  const constraintLabel = avgA <= avgE && avgA <= avgC ? 'Architecture'
    : avgE <= avgA && avgE <= avgC ? 'Execution' : 'Context';
  const constraintHint = constraintLabel === 'Architecture'
    ? 'Cohort-level constraint in beliefs & decisions — target education and motivational interventions.'
    : constraintLabel === 'Execution'
    ? 'Cohort-level constraint in behavioral reliability — target reminders, routines, and adherence aids.'
    : 'Cohort-level constraint in burden & friction — target access, cost, and regimen complexity.';

  // Store records for interactive table
  window._peDomainRecords = peRecords;
  window._peDomainPage = 0;

  const thStyle = (color) => `font-family:var(--font-mono);font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;color:${color||'var(--dim)'};padding:6px 8px;text-align:left;cursor:pointer;user-select:none;white-space:nowrap;`;
  const thSort = (col, color) => `<th style="${thStyle(color)}" onclick="peDomainSort('${col}')" title="Sort by ${col}">`;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;padding-top:16px;">
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:16px;">
        <div style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;">Cohort PE Average</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:300;color:var(--pe);line-height:1;margin-bottom:6px;">${isFinite(avgPE) ? avgPE.toFixed(3) : '—'}</div>
        <div style="font-family:var(--font-mono);font-size:0.76rem;color:rgba(212,168,67,0.65);">n = ${n} assessments with domain data</div>
      </div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:16px;">
        <div style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Primary Constraint Distribution</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;">
          <div><div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--base);">${Math.round(cntA/n*100)}%</div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">Architecture</div></div>
          <div><div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--mvmt);">${Math.round(cntE/n*100)}%</div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">Execution</div></div>
          <div><div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--strata);">${Math.round(cntC/n*100)}%</div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">Context</div></div>
        </div>
      </div>
    </div>
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:20px;">
      <div style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">Domain Averages</div>
      ${bar(avgA,'var(--base)','Architecture (A) · Q2, Q3, Q6 — Decisions & Beliefs')}
      ${bar(avgE,'var(--mvmt)','Execution (E) · Q1, Q4, Q5, Q8 — Behavioral Reliability')}
      ${bar(avgC,'var(--strata)','Context (C) · Q7 — Burden & Friction')}
      <div style="margin-top:10px;padding:10px 12px;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:8px;font-family:var(--font-mono);font-size:0.78rem;color:var(--pe);">
        ◈ ${constraintHint}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <span style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);flex-shrink:0;">Individual PE Profiles</span>
      <input id="pe-domain-search" type="text" placeholder="Search patient #…" oninput="window._peDomainSearch=this.value;window._peDomainPage=0;renderPEDomainTable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 10px;color:var(--text);outline:none;width:150px;"/>
      <select id="pe-domain-constraint" onchange="window._peDomainConstraint=this.value;window._peDomainPage=0;renderPEDomainTable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--muted);outline:none;cursor:pointer;">
        <option value="">All Constraints</option>
        <option value="A">Architecture</option>
        <option value="E">Execution</option>
        <option value="C">Context</option>
      </select>
      <select id="pe-domain-pagesize" onchange="window._peDomainPageSize=+this.value;window._peDomainPage=0;renderPEDomainTable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--muted);outline:none;cursor:pointer;">
        <option value="10">10 / page</option>
        <option value="20" selected>20 / page</option>
        <option value="50">50 / page</option>
        <option value="100">100 / page</option>
      </select>
      <button onclick="exportPEDomainCSV()" style="font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);color:var(--pe);border-radius:5px;padding:4px 12px;cursor:pointer;" onmouseenter="this.style.background='rgba(212,168,67,0.16)'" onmouseleave="this.style.background='rgba(212,168,67,0.08)'">↓ Export CSV</button>
      <span id="pe-domain-count" style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);margin-left:auto;white-space:nowrap;"></span>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          ${thSort('#')}<span id="pe-th-num"># ↕</span></th>
          ${thSort('score')}<span id="pe-th-score">Score ↕</span></th>
          ${thSort('pe','var(--pe)')}<span id="pe-th-pe">PE ↕</span></th>
          ${thSort('a','var(--base)')}<span id="pe-th-a">A ↕</span></th>
          ${thSort('e','var(--mvmt)')}<span id="pe-th-e">E ↕</span></th>
          ${thSort('c','var(--strata)')}<span id="pe-th-c">C ↕</span></th>
          <th style="font-family:var(--font-mono);font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);padding:6px 8px;text-align:left;">Limit</th>
          ${thSort('date')}<span id="pe-th-date">Date ↕</span></th>
        </tr></thead>
        <tbody id="pe-domain-tbody"></tbody>
      </table>
    </div>
    <div id="pe-domain-pager" style="display:none;align-items:center;justify-content:space-between;padding:8px 2px;margin-top:4px;font-family:var(--font-mono);font-size:0.84rem;color:var(--muted);">
      <span id="pe-domain-pageinfo"></span>
      <div style="display:flex;gap:4px;">
        <button id="pe-domain-prev" onclick="window._peDomainPage--;renderPEDomainTable()" style="font-family:var(--font-mono);font-size:0.84rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:3px 10px;cursor:pointer;">← Prev</button>
        <button id="pe-domain-next" onclick="window._peDomainPage++;renderPEDomainTable()" style="font-family:var(--font-mono);font-size:0.84rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:3px 10px;cursor:pointer;">Next →</button>
      </div>
    </div>`;

  renderPEDomainTable();
}

// ─── APE Patient Filter Functions ────────────────────────────────────────────
window._apeFilter = null;

function apeFilterByPhenotype(phenoId) {
  window._apeFilter = phenoId;
  APE_PHENOTYPES.forEach(ph => {
    const card = document.getElementById('ape-card-' + ph.id);
    if (!card) return;
    if (ph.id === phenoId) {
      card.style.boxShadow = '0 0 0 2px ' + ph.color;
      card.style.transform = 'translateY(-3px)';
      card.style.opacity = '';
    } else {
      card.style.boxShadow = '';
      card.style.transform = '';
      card.style.opacity = '0.45';
    }
  });
  const ph = APE_PHENOTYPES.find(p => p.id === phenoId);
  const label = document.getElementById('ape-filter-label');
  const clearBtn = document.getElementById('ape-filter-clear');
  if (label && ph) label.innerHTML = `<span style="color:${ph.color};">${ph.icon} ${ph.name}</span>`;
  if (clearBtn) clearBtn.style.display = '';
  apeRenderPatients();
}

function apeFilterClear() {
  window._apeFilter = null;
  APE_PHENOTYPES.forEach(ph => {
    const card = document.getElementById('ape-card-' + ph.id);
    if (!card) return;
    card.style.boxShadow = '';
    card.style.transform = '';
    card.style.opacity = '';
  });
  const label = document.getElementById('ape-filter-label');
  if (label) label.textContent = 'Showing all phenotypes';
  const clearBtn = document.getElementById('ape-filter-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  const searchEl = document.getElementById('ape-patient-search');
  if (searchEl) searchEl.value = '';
  apeRenderPatients();
}

// APE patient table state
window._apePatientPage     = 0;
window._apePatientPageSize = 20;
window._apePatientRows     = []; // cache for CSV export

function apeRenderPatients() {
  const section = document.getElementById('ape-patient-section');
  const tbody   = document.getElementById('ape-patient-tbody');
  const countEl = document.getElementById('ape-patient-count');
  const pager   = document.getElementById('ape-patient-pager');
  if (!section || !tbody) return;

  const allRecords   = window._apeRecords || [];
  const filterPhenoId = window._apeFilter || null;
  const searchQ      = ((document.getElementById('ape-patient-search') || {}).value || '').toLowerCase().trim();

  let rows = allRecords.map(r => {
    const result = classifyApePhenotype(r);
    if (!result || !result.length) return null;
    const top = result[0];
    return { r, phenotype: top.phenotype, prob: top.prob };
  }).filter(Boolean);

  if (filterPhenoId) rows = rows.filter(x => x.phenotype.id === filterPhenoId);
  if (searchQ) rows = rows.filter(x => {
    const r = x.r;
    return (r.patient_number||'').toLowerCase().includes(searchQ)
        || (r.country||'').toLowerCase().includes(searchQ)
        || (r.condition||'').toLowerCase().includes(searchQ)
        || (r.drug_name||'').toLowerCase().includes(searchQ);
  });

  rows.sort((a,b) => b.prob - a.prob);
  window._apePatientRows = rows; // cache for export
  section.style.display = '';

  const pageSize   = window._apePatientPageSize || 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  window._apePatientPage = Math.max(0, Math.min(window._apePatientPage || 0, totalPages - 1));
  const page = window._apePatientPage;

  if (countEl) countEl.textContent = rows.length + ' patient' + (rows.length !== 1 ? 's' : '');

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--dim);font-family:var(--font-mono);font-size:0.84rem;">No patients match this filter.</td></tr>`;
    if (pager) pager.style.display = 'none';
    return;
  }

  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  tbody.innerHTML = pageRows.map(({r, phenotype, prob}) => {
    const c = phenotype.color || '#6b8099';
    const probPct = Math.round(prob * 100);
    const patId = r.patient_number || '—';
    const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '—';
    const score = typeof r.score === 'number' ? r.score.toFixed(2) : '—';
    const cat = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(r.score) : { color: '#6b8099' };
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="showPatientRecordByKey(${JSON.stringify(r.user_id+'|'+r.timestamp)})" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
      <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.88rem;color:var(--muted);">${_esc(patId)}</td>
      <td style="padding:8px 10px;"><span style="font-size:0.82rem;padding:2px 8px;border-radius:8px;background:${c}18;color:${c};border:1px solid ${c}35;white-space:nowrap;">${phenotype.icon} ${phenotype.name}</span></td>
      <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:0.88rem;color:${c};">${probPct}%</td>
      <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:0.80rem;font-weight:600;color:${cat.color};">${score}</td>
      <td style="padding:8px 10px;font-size:0.82rem;color:var(--muted);">${_esc(r.country)||'—'}</td>
      <td style="padding:8px 10px;font-size:0.80rem;color:var(--text);">${_esc(r.condition)||'—'}</td>
      <td style="padding:8px 10px;font-size:0.80rem;color:var(--text);">${_esc(r.drug_name)||'—'}</td>
      <td style="padding:8px 10px;font-family:var(--font-mono);font-size:0.84rem;color:var(--dim);white-space:nowrap;">${date}</td>
    </tr>`;
  }).join('');

  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    const info = document.getElementById('ape-patient-pageinfo');
    const prev = document.getElementById('ape-pat-prev');
    const next = document.getElementById('ape-pat-next');
    if (info) info.textContent = `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length}`;
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= totalPages - 1;
  }
}

function exportAPEPatientsCSV() {
  const rows = window._apePatientRows || [];
  if (!rows.length) { showToast('No APE patient data to export.'); return; }
  const headers = ['Patient_Num', 'Phenotype', 'Probability_Pct', 'Score', 'Country', 'Condition', 'Drug', 'Date'];
  const csvRows = rows.map(({r, phenotype, prob}) => [
    r.patient_number || '',
    phenotype.name || '',
    Math.round(prob * 100),
    typeof r.score === 'number' ? r.score.toFixed(2) : '',
    r.country || '',
    r.condition || '',
    r.drug_name || '',
    r.timestamp ? new Date(r.timestamp).toISOString() : ''
  ]);
  triggerCSVDownload(headers, csvRows, 'ape-phenotypes-' + new Date().toISOString().split('T')[0] + '.csv');
  showToast('Exported ' + csvRows.length + ' APE phenotype records.', 3000);
}

// ══════════════════════════════════════════════
// FEATURE 2: DRUG-CONDITION OUTCOME STRATIFICATION
// ══════════════════════════════════════════════
function getDrugClass(drugName) {
  if (!drugName) return null;
  const dn = drugName.toLowerCase();
  if (/metformin|glipizide|sitagliptin|empagliflozin|dapagliflozin|semaglutide|insulin/.test(dn)) return 'Antidiabetics';
  if (/lisinopril|amlodipine|losartan|atenolol|hydrochlorothiazide|ramipril|valsartan|carvedilol/.test(dn)) return 'Antihypertensives';
  if (/atorvastatin|rosuvastatin|simvastatin|pravastatin/.test(dn)) return 'Statins';
  if (/warfarin|apixaban|rivaroxaban|dabigatran/.test(dn)) return 'Anticoagulants';
  if (/levothyroxine|synthroid/.test(dn)) return 'Thyroid';
  if (/albuterol|fluticasone|salmeterol|montelukast/.test(dn)) return 'Respiratory';
  if (/sertraline|fluoxetine|escitalopram|venlafaxine|bupropion|lithium|olanzapine/.test(dn)) return 'Psychotropics';
  if (/tenofovir|emtricitabine|dolutegravir|efavirenz/.test(dn)) return 'Antiretrovirals';
  if (/amoxicillin|azithromycin|ciprofloxacin|doxycycline/.test(dn)) return 'Antibiotics';
  return null;
}

let _stratOpen = false;
function toggleStratPanel() {
  _stratOpen = !_stratOpen;
  const body = document.getElementById('strat-collapsible');
  const btn  = document.getElementById('strat-collapse-btn');
  if (body) body.style.display = _stratOpen ? '' : 'none';
  if (btn)  btn.textContent    = _stratOpen ? '−' : '+';
  if (_stratOpen) renderStratification();
}

function renderStratification() {
  const body = document.getElementById('strat-body');
  if (!body) return;
  if (!dashMmasData || !dashMmasData.length) {
    body.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:12px 0;">No data. Submit assessments with drug/condition information to populate this view.</div>';
    return;
  }
  const viewBy = document.getElementById('strat-view-by')?.value || 'condition';
  const minN   = parseInt(document.getElementById('strat-min-n')?.value || '3');

  // Group records
  const groups = {};
  dashMmasData.forEach(r => {
    let key = null;
    if (viewBy === 'condition') key = r.condition || null;
    else if (viewBy === 'drug_class') key = getDrugClass(r.drug_name) || (r.drug_type || null);
    else if (viewBy === 'country') key = r.country || null;
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r.score || 0);
  });

  const rows = Object.entries(groups)
    .filter(([,scores]) => scores.length >= minN)
    .map(([label, scores]) => {
      const n = scores.length;
      const mean = scores.reduce((a,b)=>a+b,0) / n;
      const variance = scores.reduce((a,b)=>a+Math.pow(b-mean,2),0) / n;
      const se = Math.sqrt(variance/n);
      const ci95 = 1.96 * se;
      return { label, n, mean, ci95 };
    })
    .sort((a,b) => b.mean - a.mean);

  if (!rows.length) {
    body.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:12px 0;">Not enough data for selected grouping (try reducing min n).</div>';
    return;
  }

  body.innerHTML = rows.map(row => {
    const cat = getAdherenceCategory(row.mean);
    const barPct = Math.round(row.mean / 8 * 100);
    const ciLow  = Math.max(0, row.mean - row.ci95).toFixed(2);
    const ciHigh = Math.min(8, row.mean + row.ci95).toFixed(2);
    return `<div class="strat-row">
      <div class="strat-label" title="${_esc(row.label)}">${_esc(row.label.length > 26 ? row.label.substring(0,24)+'…' : row.label)}</div>
      <div class="strat-bar-wrap"><div class="strat-bar-fill" style="width:${barPct}%;background:${cat.color};"></div></div>
      <div class="strat-val" style="color:${cat.color};">${row.mean.toFixed(2)}</div>
      <div class="strat-n">n=${row.n}</div>
      <div class="strat-ci">[${ciLow}–${ciHigh}]</div>
    </div>`;
  }).join('');

  // Wire export
  const exportBtn = document.getElementById('strat-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      triggerCSVDownload(
        ['Group','Mean_Score','N','CI_Low','CI_High'],
        rows.map(r => [r.label, r.mean.toFixed(3), r.n, Math.max(0,r.mean-r.ci95).toFixed(3), Math.min(8,r.mean+r.ci95).toFixed(3)]),
        'atlas_stratification.csv'
      );
    };
  }
}

// ══════════════════════════════════════════════
// FEATURE 3: NATURAL LANGUAGE COHORT QUERY
// ══════════════════════════════════════════════
function nlqSetQuery(text) {
  const input = document.getElementById('nlq-input');
  if (input) { input.value = text; input.focus(); }
}

/**
 * Runs a natural language query against the loaded cohort data using the ATLAS NLQ engine.
 * @returns {Promise<void>}
 */
async function runNLQ() {
  // Phase 1: NLQ requires advanced PEACS tier
  if (!requirePeacsTier('advanced')) return;

  const input = document.getElementById('nlq-input');
  const btn   = document.getElementById('nlq-submit-btn');
  const resultEl = document.getElementById('nlq-result');
  const hdrEl    = document.getElementById('nlq-result-hdr');
  const bodyEl   = document.getElementById('nlq-result-body');
  if (!input || !input.value.trim()) return;
  if (!dashMmasData || !dashMmasData.length) {
    showToast('No cohort data loaded. Load your dashboard first.'); return;
  }

  btn.disabled = true; btn.textContent = 'Thinking…';
  resultEl.style.display = '';

  const query = input.value.trim();
  // Build a compact schema summary for Claude
  const schema = {
    total_records: dashMmasData.length,
    fields: ['score (0-8)', 'country', 'city', 'condition', 'drug_name', 'drug_type', 'gender', 'age_range', 'education', 'institution_code', 'timestamp'],
    score_range: '0–8 (High=8, Medium=6–7.99, Low<6)',
    sample_conditions: [...new Set(dashMmasData.map(r=>r.condition).filter(Boolean))].slice(0,12)
  };

  // Use language-aware system instruction
  var _nlqLang = (typeof window._atlasLang !== 'undefined' && window._atlasLang) ? window._atlasLang : 'en';
  var _nlqT = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[_nlqLang]) ? ATLAS_STRINGS[_nlqLang] : ATLAS_STRINGS.en;
  var _nlqSysPrompt = _nlqT.nlqSystemPrompt || ATLAS_STRINGS.en.nlqSystemPrompt;

  const prompt = `${_nlqSysPrompt}

The researcher asked: "${query}"

Available dataset schema: ${JSON.stringify(schema)}

Return ONLY valid JSON (no preamble):
{
  "interpretation": "one sentence explaining what you understood",
  "filter_rules": [
    {"field": "score", "op": "<", "value": 6},
    {"field": "condition", "op": "contains_ci", "value": "diabetes"}
  ],
  "result_summary": "one sentence describing what this query should reveal",
  "suggested_columns": ["score","country","condition","drug_name"]
}

Supported ops: <, <=, >, >=, ==, !=, contains_ci (case-insensitive string contains), in (value is an array)`;

  try {
    const resp = await fetch('/lambda-proxy/zoe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:600, messages:[{role:'user',content:prompt}] })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());

    // Apply filters
    const rules = parsed.filter_rules || [];
    const filtered = dashMmasData.filter(record => {
      return rules.every(rule => {
        const val = record[rule.field];
        if (val === undefined || val === null) return false;
        switch(rule.op) {
          case '<':  return parseFloat(val) < rule.value;
          case '<=': return parseFloat(val) <= rule.value;
          case '>':  return parseFloat(val) > rule.value;
          case '>=': return parseFloat(val) >= rule.value;
          case '==': return String(val).toLowerCase() === String(rule.value).toLowerCase();
          case '!=': return String(val).toLowerCase() !== String(rule.value).toLowerCase();
          case 'contains_ci': return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
          case 'in': return Array.isArray(rule.value) && rule.value.map(v=>String(v).toLowerCase()).includes(String(val).toLowerCase());
          default: return true;
        }
      });
    });

    hdrEl.textContent = `"${parsed.interpretation}" · ${filtered.length} record${filtered.length!==1?'s':''} matched`;

    if (!filtered.length) {
      bodyEl.innerHTML = '<div class="nlq-result-empty">No records matched this query. Try broader criteria.</div>';
    } else {
      const cols = parsed.suggested_columns || ['score','country','condition'];
      const avgScore = filtered.reduce((a,r)=>a+(r.score||0),0)/filtered.length;
      const cat = getAdherenceCategory(avgScore);
      bodyEl.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:300;color:${cat.color};">${avgScore.toFixed(2)}<span style="font-size:0.86rem;color:var(--dim);"> / 8 avg</span></div>
          <div style="font-size:0.82rem;color:var(--muted);line-height:1.6;max-width:400px;">${parsed.result_summary||''}</div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.90rem;">
            <thead><tr>${cols.map(c=>`<th style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);">${c}</th>`).join('')}</tr></thead>
            <tbody>
              ${filtered.slice(0,50).map(r=>`<tr>${cols.map(c=>{
                const v = r[c]!==undefined&&r[c]!==null ? r[c] : '—';
                const col = c==='score' ? getAdherenceCategory(parseFloat(v)||0).color : 'var(--text)';
                return `<td style="padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.03);color:${col};">${_esc(String(v))}</td>`;
              }).join('')}</tr>`).join('')}
              ${filtered.length > 50 ? `<tr><td colspan="${cols.length}" style="padding:8px 10px;color:var(--dim);font-family:var(--font-mono);font-size:0.82rem;">…and ${filtered.length-50} more records. Export CSV for full dataset.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <button onclick="triggerCSVDownload(['score','country','condition','drug_name','gender','timestamp'],window._nlqFiltered.map(r=>[r.score,r.country,r.condition,r.drug_name,r.gender,new Date(r.timestamp).toISOString()]),'atlas_query_export.csv')" style="margin-top:10px;font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.25);color:var(--mvmt);border-radius:6px;padding:7px 14px;cursor:pointer;">↓ Export ${filtered.length} Records CSV</button>`;
      window._nlqFiltered = filtered;
    }
  } catch(err) {
    hdrEl.textContent = 'Query error';
    bodyEl.innerHTML = '<div class="nlq-result-empty">Unable to process query. Please try again.</div>';
  }
  btn.disabled = false; btn.textContent = 'Ask →';
}

// ══════════════════════════════════════════════
// FEATURE 4: LONGITUDINAL TRAJECTORY CARDS
// ══════════════════════════════════════════════
/**
 * Renders longitudinal adherence trajectory cards for patients with multiple assessments.
 * @param {Array<Object>} records - MMAS-8 assessment records (multiple per patient for trajectory)
 * @returns {void}
 */
function renderTrajectoryCards(records) {
  const wrap  = document.getElementById('traj-cards-wrap');
  const badge = document.getElementById('traj-count-badge');
  if (!wrap) return;

  // Group by patient_number (primary key) or user_id (secondary)
  const byPatient = {};
  records.forEach(r => {
    const key = r.patient_number ? ('pt_' + r.patient_number) : (r.user_id ? ('uid_' + r.user_id) : null);
    if (!key) return;
    if (!byPatient[key]) byPatient[key] = [];
    byPatient[key].push(r);
  });

  // Only patients with 2+ assessments
  const trajectories = Object.entries(byPatient)
    .map(([id, recs]) => ({ id, recs: recs.sort((a,b)=>a.timestamp-b.timestamp) }))
    .filter(t => t.recs.length >= 2);

  if (badge) badge.textContent = trajectories.length > 0 ? `${trajectories.length} patient${trajectories.length!==1?'s':''} with trajectory data` : 'No multi-assessment patients yet';

  if (!trajectories.length) {
    wrap.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:20px;">No patients with multiple assessments yet. Trajectories appear once a patient completes 2+ MMAS-8 assessments under the same Patient ID.</div>';
    return;
  }

  wrap.innerHTML = trajectories.slice(0,20).map(t => {
    const scores = t.recs.map(r=>r.score);
    const first = scores[0], last = scores[scores.length-1];
    const delta = last - first;
    const trend = delta > 0.5 ? '↑ Improving' : delta < -0.5 ? '↓ Declining' : '→ Stable';
    const trendCol = delta > 0.5 ? 'var(--optimal)' : delta < -0.5 ? 'var(--poor)' : 'var(--muted)';
    const label = t.id.startsWith('pt_') ? `Patient #${t.id.replace('pt_','')}` : `User ···${t.id.replace('uid_','').slice(-6)}`;

    // Mini SVG sparkline
    const W=180, H=36, pad=4;
    const minS=Math.min(...scores,0), maxS=Math.max(...scores,8);
    const xStep = (W-pad*2) / Math.max(scores.length-1,1);
    const yScale = (H-pad*2) / (maxS-minS || 1);
    const pts = scores.map((s,i) => `${pad + i*xStep},${H-pad-(s-minS)*yScale}`);
    const polyline = pts.join(' ');
    const lastCat = getAdherenceCategory(last);

    return `<div class="traj-card">
      <div class="traj-card-id">${_esc(label)} · ${t.recs.length} assessments</div>
      <svg class="traj-sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <polyline points="${polyline}" fill="none" stroke="${lastCat.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${scores.map((s,i)=>`<circle cx="${pad+i*xStep}" cy="${H-pad-(s-minS)*yScale}" r="3" fill="${lastCat.color}"/>`).join('')}
      </svg>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:var(--font-display);font-size:1.4rem;font-weight:300;color:${lastCat.color};">${last.toFixed(2)}</span>
        <div class="traj-trend" style="color:${trendCol};">${trend}</div>
        <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);margin-left:auto;">${first.toFixed(2)}→${last.toFixed(2)}</span>
      </div>
      <div class="traj-insight">${_buildTrajInsight(t.recs)}</div>
    </div>`;
  }).join('');
}

function _buildTrajInsight(recs) {
  const scores = recs.map(r=>r.score);
  const delta = scores[scores.length-1] - scores[0];
  const dates = recs.map(r=>new Date(r.timestamp));
  const d0 = dates[0].toLocaleDateString('en-US',{month:'short',year:'numeric'});
  const dN = dates[dates.length-1].toLocaleDateString('en-US',{month:'short',year:'numeric'});
  if (Math.abs(delta) < 0.5) return `Score stable (${scores[0].toFixed(2)}→${scores[scores.length-1].toFixed(2)}) between ${d0} and ${dN}.`;
  if (delta > 0) return `Score improved by ${delta.toFixed(2)} points between ${d0} and ${dN}. Positive adherence trajectory.`;
  // Find which questions worsened (lower score = worse for Q1–Q4, Q6–Q8; Q5 is reversed)
  const first = recs[0], last = recs[recs.length-1];
  const worseQs = [];
  // Q1–Q4, Q6–Q7: score 1 = good, 0 = problem. Decline means l < f.
  ['q1','q2','q3','q4','q6','q7'].forEach(q => {
    const f = parseFloat(first[q] ?? 1), l = parseFloat(last[q] ?? 1);
    if (l < f) worseQs.push(q.toUpperCase());
  });
  // Q5 is reversed: score 1 = took last scheduled dose (good), 0 = missed it (bad). Same direction.
  const f5 = parseFloat(first.q5 ?? 1), l5 = parseFloat(last.q5 ?? 1);
  if (l5 < f5) worseQs.push('Q5');
  // Q8: 1 = never has difficulty (good), 0 = always has difficulty (bad). Decline means l < f.
  const f8 = parseFloat(first.q8 ?? 1), l8 = parseFloat(last.q8 ?? 1);
  if (l8 < f8) worseQs.push('Q8');
  return `Score declined ${Math.abs(delta).toFixed(2)} points (${d0}→${dN}).${worseQs.length ? ' Increased difficulty on: ' + worseQs.join(', ') + '.' : ''}`;
}

// ══════════════════════════════════════════════
// FEATURE 5: INTERVENTION MATCHING MODULE
// ══════════════════════════════════════════════
const INTERVENTIONS_DB = [
  {
    name:'Smart Pill Organizer with Alarm', icon:'⏰', difficulty:1,
    for_patterns:['Routine Forgetter','Mixed Pattern','Unintentional Non-Adherence'],
    desc:'Electronic pill dispensers with built-in alarms reduce dose omissions by up to 40% in RCT evidence.',
    cite:'Checchi KD et al. Patient adherence and the use of pill organizers. JAPhA 2014.',
    color:'#f59e0b'
  },
  {
    name:'Motivational Interviewing', icon:'🗣', difficulty:2,
    for_patterns:['Intentional Non-Adherence','Intentional Resistor'],
    desc:'Brief MI sessions with trained clinicians address ambivalence and medication beliefs in intentional non-adherers.',
    cite:'Palacio A et al. Motivational interviewing improves medication adherence. J Gen Intern Med 2016.',
    color:'#ef4444'
  },
  {
    name:'Blister Pack Program', icon:'💊', difficulty:1,
    for_patterns:['Situational Skipper','Routine Forgetter'],
    desc:'Pre-packaged unit-dose blister packs simplify travel adherence and reduce disruption-related missed doses.',
    cite:'Zedler BK et al. Adherence with unit-of-use packaging. J Manag Care Pharm 2011.',
    color:'#8b6ff5'
  },
  {
    name:'SMS Reminder Protocol', icon:'📱', difficulty:1,
    for_patterns:['Routine Forgetter','Unintentional Non-Adherence'],
    desc:'Automated daily SMS reminders show consistent improvement in adherence across 16 meta-analyzed trials.',
    cite:'Thakkar J et al. Mobile telephone text messaging for medication adherence. JAMA Intern Med 2016.',
    color:'#3b82f6'
  },
  {
    name:'Side-Effect Management Consultation', icon:'🩺', difficulty:2,
    for_patterns:['Side-Effect Avoider','Intentional Non-Adherence'],
    desc:'Structured clinical review of adverse effects with formulation alternatives or co-medication reduces intentional stopping.',
    cite:'Horne R et al. Concordance, adherence and compliance in medicine taking. Report for NICE 2005.',
    color:'#06b6d4'
  },
  {
    name:'Care Coordinator Assignment', icon:'👩‍⚕️', difficulty:3,
    for_patterns:['Low Adherence','Critical Misalignment','Intentional Resistor'],
    desc:'Dedicated care coordinator for complex patients reduces hospitalisation and improves multi-drug adherence.',
    cite:'Peikes D et al. Effects of care coordination on hospitalization. JAMA 2009.',
    color:'#10b981'
  },
  {
    name:'Disease Education Session', icon:'📋', difficulty:2,
    for_patterns:['Optimistic Stopper','Medium Adherence'],
    desc:'Structured education about chronic disease course and the consequences of stopping medication when feeling well.',
    cite:'Horne R. Compliance, adherence, and concordance. Chest 2006.',
    color:'#a78bfa'
  },
  {
    name:'Community Pharmacy Partnership', icon:'🏪', difficulty:2,
    for_patterns:['Low Adherence','Routine Forgetter'],
    desc:'Medication synchronisation and CMR at community pharmacies reduces abandoned prescriptions and refill gaps.',
    cite:'Holdford DA et al. Medication synchronization programs. J Manag Care Spec Pharm 2015.',
    color:'#f97316'
  }
];

/**
 * Opens the ATLAS Intervention Matrix (IVM) modal with AI-generated clinical suggestions.
 * @param {number} score - MMAS-8 score (0–8)
 * @param {string} pattern - Adherence pattern label
 * @param {Object} classifyResult - Output from `classifyApePhenotype` / classification engine
 * @returns {Promise<void>}
 */
async function openIvmModal(score, pattern, classifyResult) {
  const modal   = document.getElementById('ivm-modal');
  const sub     = document.getElementById('ivm-subtitle');
  const cardsW  = document.getElementById('ivm-cards-wrap');
  if (!modal) return;

  const catLabel = getAdherenceCategory(score).label;
  modal.style.display = 'flex';

  // ── Loading state ──────────────────────────────────────────────────────────
  if (sub) sub.textContent = `Matching interventions to your profile…`;
  cardsW.innerHTML = `<div style="padding:32px;text-align:center;">
    <div style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--mvmt);margin-bottom:10px;animation:blink 1.4s ease-in-out infinite;">🤖 AI Matching…</div>
    <div style="font-size:0.84rem;color:var(--muted);line-height:1.7;">Claude is personalizing evidence-based interventions<br>based on your adherence profile and health context.</div>
  </div>`;

  // ── Build context for AI ───────────────────────────────────────────────────
  const sdoh = window._zoeSdohSnapshot || {};
  const condition  = sdoh.condition || 'Not specified';
  const drug       = sdoh.drugName  || 'Not specified';
  const drugType   = sdoh.drugType  || '';
  const ageRange   = sdoh.ageRange  || 'Not specified';
  const education  = sdoh.education || 'Not specified';

  const { intentional = 0, unintentional = 0 } = classifyResult || {};
  const patternDetail = intentional > unintentional
    ? `Intentional Non-Adherence (INA) — patient deliberately skips/stops doses. Intentional flags: ${intentional}, Unintentional: ${unintentional}.`
    : unintentional > intentional
    ? `Unintentional Non-Adherence (UNA) — patient forgets or faces practical barriers. Unintentional flags: ${unintentional}, Intentional: ${intentional}.`
    : score >= 8
    ? 'High Adherence — no barriers identified.'
    : `Mixed Pattern — both intentional and unintentional factors present. Each: ${intentional}/${unintentional}.`;

  const prompt = `You are a clinical pharmacist and medication adherence specialist for ATLAS, Adherence Cartography's research platform (Philip Morisky, Founder).

PATIENT PROFILE:
- MMAS-8 Score: ${score.toFixed(2)} / 8.0
- Adherence Level: ${catLabel}
- Adherence Pattern: ${patternDetail}
- Medical Condition: ${condition}
- Medication / Drug Type: ${drug}${drugType ? ' ('+drugType+')' : ''}
- Age Range: ${ageRange}
- Education Level: ${education}

Generate exactly 4 personalized, evidence-based medication adherence interventions matched to this specific patient profile. Each must cite a real publication or clinical guideline.

Respond ONLY with valid JSON array, no preamble, no markdown:
[
  {
    "icon": "emoji",
    "name": "Short intervention name (3-6 words)",
    "desc": "2-3 sentence description tailored to this patient's specific pattern and context. Be concrete and actionable.",
    "cite": "Author et al. (Year). Journal Name. Real citation.",
    "difficulty": 1,
    "color": "#hex",
    "rationale": "One sentence on why this specifically fits this patient's score/pattern/condition."
  }
]
difficulty: 1=easy, 2=moderate, 3=advanced. color: use #4e9cf5 (blue), #8b6ff5 (purple), #2ec98a (green), or #d4a843 (gold).`;

  try {
    const resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const raw  = data.content?.[0]?.text || '[]';
    let ivList;
    try { ivList = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch { ivList = []; }

    if (!Array.isArray(ivList) || !ivList.length) throw new Error('empty');

    if (sub) sub.textContent = `${ivList.length} AI-personalized interventions · ${catLabel} · ${pattern}`;

    cardsW.innerHTML = ivList.map((iv, i) => {
      const dots = [1,2,3].map(d=>`<div class="ivm-diff-dot${d<=(iv.difficulty||1)?' filled':''}"></div>`).join('');
      return `<div class="ivm-card" style="border-color:${iv.color||'#4e9cf5'}22;">
        <div class="ivm-card-hdr">
          <span class="ivm-card-icon">${iv.icon||'💊'}</span>
          <span class="ivm-card-name">${iv.name||'Intervention'}</span>
          <span class="ivm-card-tag" style="color:${iv.color||'#4e9cf5'};border-color:${iv.color||'#4e9cf5'}44;">
            ${(iv.difficulty||1)===1?'Easy':(iv.difficulty||1)===2?'Moderate':'Advanced'}
          </span>
        </div>
        <div class="ivm-card-desc">${iv.desc||''}</div>
        ${iv.rationale ? `<div style="font-size:0.90rem;color:var(--base);background:rgba(78,156,245,0.05);border-left:2px solid rgba(78,156,245,0.3);padding:6px 10px;border-radius:0 6px 6px 0;margin-bottom:8px;font-style:italic;">💡 ${iv.rationale}</div>` : ''}
        <div class="ivm-card-cite">📎 ${iv.cite||''}</div>
        <div class="ivm-card-footer">
          <div style="display:flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);">
            Complexity: <div class="ivm-difficulty">${dots}</div>
          </div>
          <button class="ivm-share-btn" onclick="shareIvmAI(${i})">Share with Care Team →</button>
        </div>
      </div>`;
    }).join('');

    window._ivmAIDisplay = ivList;

  } catch(err) {
    // Fallback to static DB on failure
    if (sub) sub.textContent = `${catLabel} · ${pattern} — matched from evidence library`;
    const matched = INTERVENTIONS_DB.filter(iv =>
      iv.for_patterns.some(p => p === pattern || p === catLabel)
    );
    const display = matched.length > 0 ? matched : INTERVENTIONS_DB.slice(0,3);
    window._ivmDisplay = display;
    cardsW.innerHTML = display.map((iv,i) => {
      const dots = [1,2,3].map(d=>`<div class="ivm-diff-dot${d<=iv.difficulty?' filled':''}"></div>`).join('');
      return `<div class="ivm-card" style="border-color:${iv.color}22;">
        <div class="ivm-card-hdr">
          <span class="ivm-card-icon">${iv.icon}</span>
          <span class="ivm-card-name">${iv.name}</span>
          <span class="ivm-card-tag" style="color:${iv.color};border-color:${iv.color}44;">
            ${iv.difficulty===1?'Easy':iv.difficulty===2?'Moderate':'Advanced'}
          </span>
        </div>
        <div class="ivm-card-desc">${iv.desc}</div>
        <div class="ivm-card-cite">📎 ${iv.cite}</div>
        <div class="ivm-card-footer">
          <div style="display:flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);">
            Complexity: <div class="ivm-difficulty">${dots}</div>
          </div>
          <button class="ivm-share-btn" onclick="shareIntervention(${i})">Share with Care Team →</button>
        </div>
      </div>`;
    }).join('');
  }
}

function shareIvmAI(idx) {
  const iv = (window._ivmAIDisplay || [])[idx];
  if (!iv) return;
  const text = `ATLAS Adherence Platform — AI-Personalized Intervention\n\n${iv.icon} ${iv.name}\n\n${iv.desc}\n\n${iv.rationale ? 'Why this fits: '+iv.rationale+'\n\n' : ''}Evidence: ${iv.cite}\n\nImplementation Complexity: ${(iv.difficulty||1)===1?'Low':(iv.difficulty||1)===2?'Moderate':'High'}\n\n— Generated by ATLAS AI · adherence.cc`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Intervention copied — paste into EHR or care team message.'));
  } else {
    showToast('Select and copy the intervention text manually.');
  }
}

/**
 * Closes the IVM (Intervention Matrix) modal.
 * @returns {void}
 */
function closeIvmModal() {
  const m = document.getElementById('ivm-modal');
  if (m) m.style.display = 'none';
}

function shareIntervention(idx) {
  const iv = (window._ivmDisplay || [])[idx];
  if (!iv) return;
  const text = `ATLAS Adherence Platform — Intervention Recommendation\n\n${iv.icon} ${iv.name}\n\n${iv.desc}\n\nEvidence: ${iv.cite}\n\nImplementation Complexity: ${iv.difficulty===1?'Low':iv.difficulty===2?'Moderate':'High'}\n\n— Generated by ATLAS · adherence.cc`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Intervention copied — paste into EHR or care team message.'));
  } else {
    showToast('Select and copy the intervention text manually.');
  }
}




// ══════════════════════════════════════════════
// SHARED CONDITION NORMALIZER
// ══════════════════════════════════════════════
const _COND_SYNONYMS = {
  // Type 2 Diabetes — all variants
  'type 2 diabetes mellitus':        { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'type 2 diabetes':                 { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  't2dm':                            { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'diabetes mellitus type 2':        { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'dm type 2':                       { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'type ii diabetes':                { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'diabetes type 2':                 { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'diabetes mellitus, type 2':       { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  'niddm':                           { key: 'type2_diabetes', label: 'Type 2 Diabetes Mellitus' },
  // Type 1 Diabetes
  'type 1 diabetes mellitus':        { key: 'type1_diabetes', label: 'Type 1 Diabetes Mellitus' },
  'type 1 diabetes':                 { key: 'type1_diabetes', label: 'Type 1 Diabetes Mellitus' },
  't1dm':                            { key: 'type1_diabetes', label: 'Type 1 Diabetes Mellitus' },
  'type i diabetes':                 { key: 'type1_diabetes', label: 'Type 1 Diabetes Mellitus' },
  'iddm':                            { key: 'type1_diabetes', label: 'Type 1 Diabetes Mellitus' },
  // Generic diabetes (no type specified)
  'diabetes':                        { key: 'diabetes_nos',   label: 'Diabetes (unspecified)' },
  'diabetes mellitus':               { key: 'diabetes_nos',   label: 'Diabetes (unspecified)' },
  'dm':                              { key: 'diabetes_nos',   label: 'Diabetes (unspecified)' },
  // Hypertension
  'hypertension':                    { key: 'hypertension',   label: 'Hypertension' },
  'high blood pressure':             { key: 'hypertension',   label: 'Hypertension' },
  'htn':                             { key: 'hypertension',   label: 'Hypertension' },
  'arterial hypertension':           { key: 'hypertension',   label: 'Hypertension' },
  // Hyperlipidaemia
  'hyperlipidaemia':                 { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'dyslipidaemia':                   { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'hyperlipidemia':                  { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'dyslipidemia':                    { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'hyperlipidaemia / dyslipidaemia': { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'high cholesterol':                { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'hypercholesterolaemia':           { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  'hypercholesterolemia':            { key: 'hyperlipidaemia', label: 'Hyperlipidaemia / Dyslipidaemia' },
  // Hypothyroidism
  'hypothyroidism':                  { key: 'hypothyroidism',  label: 'Hypothyroidism' },
  'underactive thyroid':             { key: 'hypothyroidism',  label: 'Hypothyroidism' },
  'hashimoto':                       { key: 'hypothyroidism',  label: 'Hypothyroidism' },
  "hashimoto's":                     { key: 'hypothyroidism',  label: 'Hypothyroidism' },
  // Asthma
  'asthma':                          { key: 'asthma',          label: 'Asthma' },
  'bronchial asthma':                { key: 'asthma',          label: 'Asthma' },
  // Heart failure
  'heart failure':                   { key: 'heart_failure',   label: 'Heart Failure' },
  'chf':                             { key: 'heart_failure',   label: 'Heart Failure' },
  'congestive heart failure':        { key: 'heart_failure',   label: 'Heart Failure' },
  // COPD
  'copd':                            { key: 'copd',            label: 'COPD' },
  'chronic obstructive pulmonary disease': { key: 'copd',      label: 'COPD' },
  // CKD
  'ckd':                             { key: 'ckd',             label: 'Chronic Kidney Disease' },
  'chronic kidney disease':          { key: 'ckd',             label: 'Chronic Kidney Disease' },
  // Atrial fibrillation
  'atrial fibrillation':             { key: 'afib',            label: 'Atrial Fibrillation' },
  'af':                              { key: 'afib',            label: 'Atrial Fibrillation' },
  'afib':                            { key: 'afib',            label: 'Atrial Fibrillation' },
  // Depression / anxiety
  'depression':                      { key: 'depression',      label: 'Depression' },
  'major depressive disorder':       { key: 'depression',      label: 'Depression' },
  'mdd':                             { key: 'depression',      label: 'Depression' },
  'anxiety':                         { key: 'anxiety',         label: 'Anxiety' },
  'anxiety disorder':                { key: 'anxiety',         label: 'Anxiety' },
};
function normalizeCondition(raw) {
  if (!raw) return null;
  const lc = raw.trim().toLowerCase();
  return _COND_SYNONYMS[lc] || { key: lc, label: raw.trim() };
}

// ══════════════════════════════════════════════
// INSTITUTION ANALYTICS DASHBOARD
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// PPE — PEACS PHENOTYPING ENGINE
// 5 behavioral architecture profiles derived from
// BASE (habit), MVMT (execution), STRATA (context)
// ══════════════════════════════════════════════
const PPE_PROFILES = [
  {
    id: 'structural_deficient',
    name: 'Structural Deficient',
    icon: '🏗',
    color: '#ef4444',
    desc: 'Weak habit architecture. Poor routine formation means medication-taking never becomes automatic regardless of intent.',
    interventions: ['Habit-stacking protocol', 'Environmental design audit', 'Cue-routine-reward restructuring'],
    _score: r => {
      const b = r.base ?? null, m = r.mvmt ?? null, s = r.strata ?? null;
      if (b === null) return 0;
      // High score = low BASE with relatively better MVMT/STRATA
      const baseDeficit = 1 - b;
      const executionOk = m !== null ? m : 0.5;
      return baseDeficit * 0.65 + (1 - executionOk) * 0.20 + (s !== null ? (1-s)*0.15 : 0);
    }
  },
  {
    id: 'execution_lapsed',
    name: 'Execution Lapsed',
    icon: '📉',
    color: '#f59e0b',
    desc: 'Recent behavioral breakdown. Established habits exist (moderate BASE) but recent week execution has deteriorated.',
    interventions: ['Short-term check-in protocol', 'Relapse trigger identification', 'Re-engagement coaching'],
    _score: r => {
      const b = r.base ?? null, m = r.mvmt ?? null;
      if (b === null || m === null) return 0;
      // Good BASE but poor MVMT = classic execution lapse
      const baseOk   = b >= 0.5 ? b : 0;
      const mvmtPoor = 1 - m;
      return baseOk * 0.50 + mvmtPoor * 0.50;
    }
  },
  {
    id: 'context_constrained',
    name: 'Context Constrained',
    icon: '🌐',
    color: '#3b82f6',
    desc: 'External environment undermining adherence. Adequate behavior but social support, access, or circumstances working against the patient.',
    interventions: ['Social support mapping', 'Access and transport solutions', 'Community health worker referral'],
    _score: r => {
      const b = r.base ?? null, m = r.mvmt ?? null, s = r.strata ?? null;
      if (s === null) return 0;
      const strataDeficit = 1 - s;
      const behaviorOk = (b !== null && m !== null) ? (b + m) / 2 : (b ?? m ?? 0.5);
      return strataDeficit * 0.70 + (behaviorOk * 0.15) + ((1 - strataDeficit) * 0.15);
    }
  },
  {
    id: 'compoundly_fragile',
    name: 'Compoundly Fragile',
    icon: '⚠',
    color: '#991b1b',
    desc: 'Critical risk. All three dimensions compromised — structural, behavioral, and contextual factors simultaneously failing.',
    interventions: ['Intensive case management', 'Multidisciplinary team review', 'Simplified regimen consideration'],
    _score: r => {
      const b = r.base ?? null, m = r.mvmt ?? null, s = r.strata ?? null;
      if (b === null && m === null && s === null) return 0;
      const vals = [b, m, s].filter(v => v !== null);
      const allLow = vals.every(v => v < 0.55);
      const meanDeficit = 1 - (vals.reduce((a,v)=>a+v,0)/vals.length);
      return allLow ? meanDeficit * 1.2 : meanDeficit * 0.4;
    }
  },
  {
    id: 'conditionally_stable',
    name: 'Conditionally Stable',
    icon: '⚖',
    color: '#10b981',
    desc: 'Moderate PE with high dimension variance. Patient is stable but fragile — one disruption away from lapse.',
    interventions: ['Maintenance reinforcement', 'Contingency planning', 'Periodic reassessment scheduling'],
    _score: r => {
      const b = r.base ?? null, m = r.mvmt ?? null, s = r.strata ?? null;
      const vals = [b, m, s].filter(v => v !== null);
      if (vals.length < 2) return 0;
      const mean = vals.reduce((a,v)=>a+v,0)/vals.length;
      const variance = vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length;
      const peOk = mean >= 0.50 && mean < 0.80;
      return peOk ? variance * 3.0 + 0.1 : variance * 0.8;
    }
  }
];

function classifyPpePhenotype(record) {
  if (!record || (record.base === undefined && record.mvmt === undefined && record.strata === undefined)) return null;
  const scores = PPE_PROFILES.map(ph => ({ ph, raw: Math.max(0, ph._score(record)) }));
  const total  = scores.reduce((s,x) => s + x.raw, 0) || 1;
  return scores.map(x => ({ profile: x.ph, prob: x.raw / total })).sort((a,b) => b.prob - a.prob);
}

// ── Institution APE embed toggle + render ────────────────
let _instApeOpen = false;
function toggleInstApe() {
  _instApeOpen = !_instApeOpen;
  const body = document.getElementById('inst-ape-embed-body');
  const icon = document.getElementById('inst-ape-toggle-icon');
  if (body) body.style.display = _instApeOpen ? '' : 'none';
  if (icon) icon.textContent   = _instApeOpen ? '▲ Hide' : '▼ Show';
  if (_instApeOpen) renderInstApe();
}

function renderInstApe() {
  const records = dashMmasData || [];
  const nonHigh = records.filter(r => r.tool !== 'map' && r.map_q1 === undefined && (r.score || 0) < 8);
  const grid = document.getElementById('inst-ape-embed-grid');
  const bars = document.getElementById('inst-ape-embed-bars');
  if (!grid || !bars || typeof APE_PHENOTYPES === 'undefined') return;

  // Phenotype counts
  const counts = {};
  APE_PHENOTYPES.forEach(p => counts[p.id] = 0);
  nonHigh.forEach(r => {
    const res = classifyApePhenotype(r);
    if (res && res.length && res[0].prob > 0.15) counts[res[0].phenotype.id]++;
  });
  const total = nonHigh.length || 1;
  const maxC  = Math.max(...Object.values(counts), 1);

  // Cards
  grid.innerHTML = APE_PHENOTYPES.map(ph => {
    const n = counts[ph.id], pct = Math.round(n/total*100);
    return `<div onclick="filterPatientsByApePhenotype('${ph.id}')" style="background:${ph.color}0d;border:1px solid ${ph.color}30;border-radius:8px;padding:12px 10px;text-align:center;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor='${ph.color}66'" onmouseout="this.style.borderColor='${ph.color}30'" title="Click to filter patient panel to ${ph.name}">
      <div style="font-size:1.2rem;margin-bottom:4px;">${ph.icon}</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:${ph.color};line-height:1;">${n}</div>
      <div style="font-family:var(--font-mono);font-size:0.80rem;text-transform:uppercase;color:${ph.color}aa;margin-top:3px;">${ph.name}</div>
      <div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);margin-top:2px;">${pct}%</div>
      <div style="font-family:var(--font-mono);font-size:0.90rem;color:${ph.color}77;margin-top:4px;">↓ filter patients</div>
    </div>`;
  }).join('');

  // Bars
  bars.innerHTML = APE_PHENOTYPES.map(ph => {
    const n = counts[ph.id], pct = Math.round(n/total*100);
    return `<div style="display:flex;align-items:center;gap:8px;">
      <span style="font-family:var(--font-mono);font-size:0.88rem;min-width:130px;color:${ph.color}99;">${ph.icon} ${ph.name}</span>
      <div style="flex:1;height:7px;background:var(--card2);border-radius:4px;overflow:hidden;">
        <div style="width:${Math.round(n/maxC*100)}%;height:100%;background:${ph.color};border-radius:4px;transition:width 0.7s;"></div>
      </div>
      <span style="font-family:var(--font-mono);font-size:0.80rem;color:${ph.color};min-width:26px;text-align:right;">${n}</span>
      <span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);min-width:28px;">${pct}%</span>
    </div>`;
  }).join('');
}

// ── Institution Drug-Condition Strat embed ────────────────
let _instStratOpen = false;
function toggleInstStrat() {
  _instStratOpen = !_instStratOpen;
  const body = document.getElementById('inst-strat-embed-body');
  const icon = document.getElementById('inst-strat-toggle-icon');
  if (body) body.style.display = _instStratOpen ? '' : 'none';
  if (icon) icon.textContent   = _instStratOpen ? '▲ Hide' : '▼ Show';
  if (_instStratOpen) renderInstStrat();
}

function renderInstStrat() {
  const body = document.getElementById('inst-strat-body');
  if (!body) return;
  const records = dashMmasData || [];
  if (!records.length) { body.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">No data yet.</div>'; return; }

  const viewBy = document.getElementById('inst-strat-view-by')?.value || 'condition';
  const minN   = parseInt(document.getElementById('inst-strat-min-n')?.value || '3');

  const groups = {};
  records.forEach(r => {
    let key;
    if (viewBy === 'condition')  key = r.condition  ? normalizeCondition(r.condition)?.label || r.condition : null;
    else if (viewBy === 'drug_class') key = r.drug_class || r.drug_name || null;
    else key = r.country || null;
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r.score || 0);
  });

  const rows = Object.entries(groups)
    .filter(([,v]) => v.length >= minN)
    .map(([k,v]) => {
      const n   = v.length;
      const avg = v.reduce((a,x)=>a+x,0)/n;
      const sd  = Math.sqrt(v.reduce((a,x)=>a+(x-avg)**2,0)/n);
      const ci  = 1.96 * sd / Math.sqrt(n);
      return { k, n, avg, ci };
    })
    .sort((a,b) => b.avg - a.avg);

  if (!rows.length) { body.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">No groups meet minimum n threshold.</div>'; return; }

  const maxAvg = 8;
  body.innerHTML = rows.map(({k,n,avg,ci}) => {
    const cat  = getAdherenceCategory(avg);
    const barW = Math.round(avg/maxAvg*100);
    const ciL  = Math.max(0, avg-ci), ciR = Math.min(8, avg+ci);
    return `<div style="margin-bottom:9px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
        <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;" title="${_esc(k)}">${_esc(k)}</span>
        <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);">n=${n} · <span style="color:${cat.color};">${avg.toFixed(2)}</span> ±${ci.toFixed(2)}</span>
      </div>
      <div style="position:relative;height:10px;background:var(--card2);border-radius:5px;overflow:visible;">
        <div style="position:absolute;left:0;top:0;width:${barW}%;height:100%;background:${cat.color}40;border-radius:5px;"></div>
        <div style="position:absolute;left:${barW}%;top:50%;transform:translate(-50%,-50%);width:3px;height:14px;background:${cat.color};border-radius:2px;"></div>
        <div style="position:absolute;left:${Math.round(ciL/maxAvg*100)}%;top:4px;width:${Math.max(1,Math.round((ciR-ciL)/maxAvg*100))}%;height:2px;background:${cat.color};opacity:0.5;border-radius:1px;"></div>
      </div>
    </div>`;
  }).join('');
}

// ── PPE toggle + render ───────────────────────────────────
let _instPpeOpen = false;
function toggleInstPPE() {
  _instPpeOpen = !_instPpeOpen;
  const body = document.getElementById('inst-ppe-body');
  const icon = document.getElementById('inst-ppe-toggle-icon');
  if (body) body.style.display = _instPpeOpen ? '' : 'none';
  if (icon) icon.textContent   = _instPpeOpen ? '▲ Hide' : '▼ Show';
  if (_instPpeOpen) renderInstPPE();
}

let _instPEOpen = false;
function toggleInstPEPanel() {
  _instPEOpen = !_instPEOpen;
  const body = document.getElementById('inst-pe-embed-body');
  const icon = document.getElementById('inst-pe-toggle-icon');
  if (body) body.style.display = _instPEOpen ? '' : 'none';
  if (icon) icon.textContent   = _instPEOpen ? '▲ Hide' : '▼ Show';
}


// Institution PE panel table state
window._instPESiteArr    = [];
window._instPEPageSize   = 20;
window._instPEPage       = 0;
window._instPESortCol    = 'pe';
window._instPESortDir    = 1;
window._instPESearch     = '';
window._instPEConstraint = '';

function instPESort(col) {
  if (window._instPESortCol === col) window._instPESortDir *= -1;
  else { window._instPESortCol = col; window._instPESortDir = 1; }
  window._instPEPage = 0;
  renderInstPETable();
}

function renderInstPETable() {
  const tbody   = document.getElementById('inst-pe-table-tbody');
  const pager   = document.getElementById('inst-pe-pager');
  const countEl = document.getElementById('inst-pe-count');
  if (!tbody) return;

  let rows = window._instPESiteArr || [];

  // Search filter
  const q = (window._instPESearch || '').toLowerCase().trim();
  if (q) rows = rows.filter(r => r.ws.toLowerCase().includes(q));

  // Constraint filter
  const cf = window._instPEConstraint || '';
  if (cf) rows = rows.filter(r => r.lim === cf);

  // Sort
  const col = window._instPESortCol || 'pe';
  const dir = window._instPESortDir || 1;
  rows = [...rows].sort((a, b) => {
    if (col === 'site') return dir * a.ws.localeCompare(b.ws);
    if (col === 'pe')   return dir * (a.spe - b.spe);
    if (col === 'a')    return dir * (a.sa  - b.sa);
    if (col === 'e')    return dir * (a.se  - b.se);
    if (col === 'c')    return dir * (a.sc  - b.sc);
    if (col === 'n')    return dir * (a.sn  - b.sn);
    return dir * (a.spe - b.spe);
  });

  // Update sort indicators
  ['site','pe','a','e','c','n'].forEach(k => {
    const el = document.getElementById('inst-pe-th-' + k);
    if (!el) return;
    const base = k.toUpperCase();
    el.textContent = (k === col) ? base + (dir === 1 ? ' ↑' : ' ↓') : base + ' ↕';
  });

  const pageSize   = window._instPEPageSize || 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  window._instPEPage = Math.max(0, Math.min(window._instPEPage || 0, totalPages - 1));
  const page = window._instPEPage;

  if (countEl) countEl.textContent = rows.length + ' site' + (rows.length !== 1 ? 's' : '');

  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.84rem;">No sites match this filter.</td></tr>`;
    if (pager) pager.style.display = 'none';
    return;
  }

  tbody.innerHTML = pageRows.map(s => `<tr style="border-bottom:1px solid var(--border);">
    <td style="font-family:var(--font-mono);font-size:0.84rem;color:var(--muted);padding:5px 8px;">${_esc(s.ws)}</td>
    <td style="font-family:var(--font-mono);font-size:0.84rem;color:${s.spe>=0.75?'#10b981':s.spe>=0.5?'#f59e0b':'#ef4444'};font-weight:600;text-align:right;padding:5px 8px;">${s.spe.toFixed(3)}</td>
    <td style="font-family:var(--font-mono);font-size:0.84rem;color:var(--base);text-align:right;padding:5px 8px;">${s.sa.toFixed(2)}</td>
    <td style="font-family:var(--font-mono);font-size:0.84rem;color:var(--mvmt);text-align:right;padding:5px 8px;">${s.se.toFixed(2)}</td>
    <td style="font-family:var(--font-mono);font-size:0.84rem;color:var(--strata);text-align:right;padding:5px 8px;">${s.sc.toFixed(2)}</td>
    <td style="text-align:center;padding:5px 8px;"><span style="font-size:0.78rem;padding:1px 7px;border-radius:6px;background:${s.limCol}18;color:${s.limCol};border:1px solid ${s.limCol}35;">${s.lim}</span></td>
    <td style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);text-align:right;padding:5px 8px;">${s.sn}</td>
  </tr>`).join('');

  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    const info = document.getElementById('inst-pe-pageinfo');
    const prev = document.getElementById('inst-pe-prev');
    const next = document.getElementById('inst-pe-next');
    if (info) info.textContent = `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length}`;
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= totalPages - 1;
  }
}

function exportInstPECSV() {
  const rows = window._instPESiteArr || [];
  if (!rows.length) { showToast('No PE domain data to export.'); return; }
  const headers = ['Site', 'Avg_PE', 'Avg_A', 'Avg_E', 'Avg_C', 'Primary_Constraint', 'n_Records'];
  const csvRows = rows.map(s => [
    s.ws, s.spe.toFixed(4), s.sa.toFixed(4), s.se.toFixed(4), s.sc.toFixed(4),
    s.lim === 'A' ? 'Architecture' : s.lim === 'E' ? 'Execution' : 'Context',
    s.sn
  ]);
  triggerCSVDownload(headers, csvRows, 'inst-pe-domain-' + new Date().toISOString().split('T')[0] + '.csv');
  showToast('Exported ' + csvRows.length + ' site records.', 3000);
}

function renderInstPEPanel(childMmas) {
  const content = document.getElementById('inst-pe-embed-content');
  const panel   = document.getElementById('inst-pe-panel');
  if (!content || !panel) return;

  // Compute PE for every record that has Q responses
  const peRecs = (childMmas || []).map(r => {
    const cached = (r.mmas_pe !== undefined && r.mmas_pe !== null &&
                    r.mmas_a  !== undefined && r.mmas_a  !== null)
      ? { pe: r.mmas_pe, a: r.mmas_a, e: r.mmas_e, c: r.mmas_c }
      : computeMMASPE(r);
    if (!cached) return null;
    const pe = +cached.pe, a = +cached.a, e = +cached.e, c = +cached.c;
    if (!isFinite(pe) || !isFinite(a) || !isFinite(e) || !isFinite(c)) return null;
    return { ws: (r.institution_code || '').toUpperCase(), pe, a, e, c };
  }).filter(Boolean);

  if (!peRecs.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  // Org-wide aggregates
  const n    = peRecs.length;
  const avgPE = peRecs.reduce((s,r)=>s+r.pe,0)/n;
  const avgA  = peRecs.reduce((s,r)=>s+r.a, 0)/n;
  const avgE  = peRecs.reduce((s,r)=>s+r.e, 0)/n;
  const avgC  = peRecs.reduce((s,r)=>s+r.c, 0)/n;
  let   cntA=0, cntE=0, cntC=0;
  peRecs.forEach(r => { const m=Math.min(r.a,r.e,r.c); if(r.a===m) cntA++; else if(r.e===m) cntE++; else cntC++; });

  // Per-site aggregates
  const bySite = {};
  peRecs.forEach(r => {
    if (!r.ws) return;
    if (!bySite[r.ws]) bySite[r.ws] = { pe:[], a:[], e:[], c:[] };
    bySite[r.ws].pe.push(r.pe); bySite[r.ws].a.push(r.a);
    bySite[r.ws].e.push(r.e);   bySite[r.ws].c.push(r.c);
  });
  const siteArr = Object.entries(bySite).map(([ws, d]) => {
    const sn   = d.pe.length;
    const spe  = d.pe.reduce((s,v)=>s+v,0)/sn;
    const sa   = d.a.reduce((s,v)=>s+v,0)/sn;
    const se   = d.e.reduce((s,v)=>s+v,0)/sn;
    const sc   = d.c.reduce((s,v)=>s+v,0)/sn;
    const minV = Math.min(sa,se,sc);
    const lim  = sa===minV?'A':se===minV?'E':'C';
    const limCol = lim==='A'?'var(--base)':lim==='E'?'var(--mvmt)':'var(--strata)';
    return { ws, spe, sa, se, sc, lim, limCol, sn };
  }).sort((a,b) => a.spe - b.spe);

  // Store for interactive table
  window._instPESiteArr = siteArr;
  window._instPEPage    = 0;

  const constraintLabel = avgA<=avgE&&avgA<=avgC?'Architecture':avgE<=avgA&&avgE<=avgC?'Execution':'Context';
  const peColor = !isFinite(avgPE) ? '#6b8099' : avgPE >= 0.75 ? '#10b981' : avgPE >= 0.5 ? '#f59e0b' : '#ef4444';

  const thS = (col, color, align) => `<th style="font-family:var(--font-mono);font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;color:${color||'var(--dim)'};padding:5px 8px;text-align:${align||'left'};cursor:pointer;user-select:none;white-space:nowrap;" onclick="instPESort('${col}')"><span id="inst-pe-th-${col}"></span></th>`;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:300;color:${peColor};line-height:1;">${isFinite(avgPE) ? avgPE.toFixed(3) : '—'}</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:0.1em;">Org PE</div>
      </div>
      <div style="background:var(--card2);border:1px solid rgba(78,156,245,0.2);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:300;color:var(--base);line-height:1;">${isFinite(avgA) ? avgA.toFixed(2) : '—'}</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:0.1em;">Avg A</div>
      </div>
      <div style="background:var(--card2);border:1px solid rgba(139,111,245,0.2);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:300;color:var(--mvmt);line-height:1;">${isFinite(avgE) ? avgE.toFixed(2) : '—'}</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:0.1em;">Avg E</div>
      </div>
      <div style="background:var(--card2);border:1px solid rgba(46,201,138,0.2);border-radius:8px;padding:12px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:300;color:var(--strata);line-height:1;">${isFinite(avgC) ? avgC.toFixed(2) : '—'}</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:0.1em;">Avg C</div>
      </div>
    </div>
    <div style="background:rgba(212,168,67,0.05);border:1px solid rgba(212,168,67,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
      <div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--pe);">◈ Org constraint: <strong>${constraintLabel}</strong></div>
      <div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">
        <span style="color:var(--base);">A</span>: ${Math.round(cntA/n*100)}% &nbsp;
        <span style="color:var(--mvmt);">E</span>: ${Math.round(cntE/n*100)}% &nbsp;
        <span style="color:var(--strata);">C</span>: ${Math.round(cntC/n*100)}%
        &nbsp;·&nbsp; n=${n} records
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <input id="inst-pe-search" type="text" placeholder="Search site…" oninput="window._instPESearch=this.value;window._instPEPage=0;renderInstPETable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 10px;color:var(--text);outline:none;width:150px;"/>
      <select id="inst-pe-constraint" onchange="window._instPEConstraint=this.value;window._instPEPage=0;renderInstPETable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--muted);outline:none;cursor:pointer;">
        <option value="">All Constraints</option>
        <option value="A">Architecture</option>
        <option value="E">Execution</option>
        <option value="C">Context</option>
      </select>
      <select id="inst-pe-pagesize" onchange="window._instPEPageSize=+this.value;window._instPEPage=0;renderInstPETable()" style="font-family:var(--font-mono);font-size:0.86rem;background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--muted);outline:none;cursor:pointer;">
        <option value="10">10 / page</option>
        <option value="20" selected>20 / page</option>
        <option value="50">50 / page</option>
        <option value="100">100 / page</option>
      </select>
      <button onclick="exportInstPECSV()" style="font-family:var(--font-mono);font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);color:var(--pe);border-radius:5px;padding:4px 12px;cursor:pointer;" onmouseenter="this.style.background='rgba(212,168,67,0.16)'" onmouseleave="this.style.background='rgba(212,168,67,0.08)'">↓ Export CSV</button>
      <span id="inst-pe-count" style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);margin-left:auto;white-space:nowrap;"></span>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          ${thS('site','var(--dim)','left')}
          ${thS('pe','var(--pe)','right')}
          ${thS('a','var(--base)','right')}
          ${thS('e','var(--mvmt)','right')}
          ${thS('c','var(--strata)','right')}
          <th style="font-family:var(--font-mono);font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);padding:5px 8px;text-align:center;">Limit</th>
          ${thS('n','var(--dim)','right')}
        </tr></thead>
        <tbody id="inst-pe-table-tbody"></tbody>
      </table>
    </div>
    <div id="inst-pe-pager" style="display:none;align-items:center;justify-content:space-between;padding:8px 2px;margin-top:4px;font-family:var(--font-mono);font-size:0.84rem;color:var(--muted);">
      <span id="inst-pe-pageinfo"></span>
      <div style="display:flex;gap:4px;">
        <button id="inst-pe-prev" onclick="window._instPEPage--;renderInstPETable()" style="font-family:var(--font-mono);font-size:0.84rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:3px 10px;cursor:pointer;">← Prev</button>
        <button id="inst-pe-next" onclick="window._instPEPage++;renderInstPETable()" style="font-family:var(--font-mono);font-size:0.84rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:3px 10px;cursor:pointer;">Next →</button>
      </div>
    </div>`;

  renderInstPETable();
}

function renderInstPPE() {
  const grid = document.getElementById('inst-ppe-grid');
  const irow = document.getElementById('inst-ppe-intervention-row');
  if (!grid) return;

  const peacs  = dashPeacsData || [];
  const counts = {};
  PPE_PROFILES.forEach(p => counts[p.id] = 0);
  let dominant = null, domCount = 0;

  peacs.forEach(r => {
    const res = classifyPpePhenotype(r);
    if (!res || !res.length) return;
    if (res[0].prob > 0.15) {
      counts[res[0].profile.id]++;
      if (counts[res[0].profile.id] > domCount) { domCount = counts[res[0].profile.id]; dominant = res[0].profile; }
    }
  });

  const total = peacs.length || 1;
  const maxC  = Math.max(...Object.values(counts), 1);

  grid.innerHTML = PPE_PROFILES.map(ph => {
    const n = counts[ph.id], pct = Math.round(n/total*100);
    return `<div onclick="filterPatientsByPpePhenotype('${ph.id}')" style="background:${ph.color}0d;border:1px solid ${ph.color}30;border-radius:8px;padding:12px 10px;text-align:center;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor='${ph.color}66'" onmouseout="this.style.borderColor='${ph.color}30'" title="Click to filter patient panel to ${ph.name}">
      <div style="font-size:1.3rem;margin-bottom:4px;">${ph.icon}</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${ph.color};line-height:1;">${n}</div>
      <div style="font-family:var(--font-mono);font-size:0.80rem;text-transform:uppercase;letter-spacing:0.08em;color:${ph.color}aa;margin-top:3px;">${ph.name}</div>
      <div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);margin-top:2px;">${pct}%</div>
      <div style="margin-top:6px;height:4px;background:var(--card2);border-radius:2px;overflow:hidden;">
        <div style="width:${Math.round(n/maxC*100)}%;height:100%;background:${ph.color};border-radius:2px;transition:width 0.7s;"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.90rem;color:${ph.color}77;margin-top:4px;">↓ filter patients</div>
    </div>`;
  }).join('');

  if (dominant && irow) {
    irow.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);">Dominant profile: <span style="color:${dominant.color};">${dominant.icon} ${dominant.name}</span> · Recommended interventions:</span>
      ${dominant.interventions.map(iv => `<span style="font-family:var(--font-mono);font-size:0.86rem;padding:3px 9px;border-radius:12px;border:1px solid ${dominant.color}35;color:${dominant.color};background:${dominant.color}0a;">${iv}</span>`).join('')}`;
  }
}

function showInstPpeDetail(profileId) {
  const ph = PPE_PROFILES.find(p => p.id === profileId);
  if (!ph || !document.getElementById('inst-ppe-intervention-row')) return;
  const irow = document.getElementById('inst-ppe-intervention-row');
  irow.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.88rem;color:${ph.color};margin-bottom:6px;">${ph.icon} ${ph.name} — ${ph.desc}</div>
    ${ph.interventions.map(iv => `<span style="font-family:var(--font-mono);font-size:0.86rem;padding:3px 9px;border-radius:12px;border:1px solid ${ph.color}35;color:${ph.color};background:${ph.color}0a;">${iv}</span>`).join('')}`;
}

function exportStratCSV(records) {
  if (typeof exportStratificationCSV === 'function') { exportStratificationCSV(); return; }
  if (!records || !records.length) { showToast('No data to export.'); return; }
  const rows = [['Condition','Drug Class','Country','Score'].join(',')];
  records.forEach(r => rows.push([r.condition||'',r.drug_class||r.drug_name||'',r.country||'',r.score||0].map(v=>`"${v}"`).join(',')));
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'stratification_export.csv'; a.click();
}

function exportInstBandCSV() {
  const byWS    = window._instBandByWS || {};
  const filterWs = (document.getElementById('inst-band-filter-ws') || {}).value || '';
  const filterCo = (document.getElementById('inst-band-filter-country') || {}).value || '';
  const getBand  = s => s>=8?5:s>=6?4:s>=5?3:s>=4?2:s>=3?1:0;
  const bandLabels = ['<3','3-3.99','4-4.99','5-5.99','6-7.99','8'];
  let wsEntries = Object.entries(byWS);
  if (filterWs) wsEntries = wsEntries.filter(([w]) => w === filterWs);
  const headers = ['Workspace', ...bandLabels.map(b => 'Band_'+b.replace(/[^0-9a-z]/gi,'_')), 'Total'];
  const rows = [];
  wsEntries.forEach(([w, d]) => {
    const recs = filterCo ? d.mmas.filter(r => (r.country||'').trim().toLowerCase() === filterCo.toLowerCase()) : d.mmas;
    if (!recs.length) return;
    const counts = [0,0,0,0,0,0];
    recs.forEach(r => counts[getBand(r.score||0)]++);
    rows.push([w, ...counts, recs.length]);
  });
  if (!rows.length) { showToast('No data to export.'); return; }
  triggerCSVDownload(headers, rows, 'inst-band-distribution-' + new Date().toISOString().split('T')[0] + '.csv');
  showToast('Exported ' + rows.length + ' workspaces.', 3000);
}

// ── Track A · MAP section renderer ───────────────────────────────────────────
function _renderInstMapSection(allMmas, childMmas) {
  const el = id => document.getElementById(id);
  const _mA = r => ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
  const _mE = r => ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
  const _mC = r => 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;

  const mapRecs = (allMmas || []).filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const n = mapRecs.length;

  if (el('inst-kpi-map-n')) el('inst-kpi-map-n').textContent = n > 0 ? n.toLocaleString() : '—';

  if (!n) {
    if (el('inst-map-domain-bars')) el('inst-map-domain-bars').innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">No MAP records yet — run Track A sessions to populate.</div>';
    ['inst-kpi-map-add','inst-kpi-map-pe','inst-kpi-map-constraint','inst-kpi-map-ina'].forEach(id => { if(el(id)) el(id).textContent='—'; });
    return;
  }

  const scores = mapRecs.map(r => +r.score || 0);
  const avgAdd = scores.reduce((a,b)=>a+b,0)/n;

  let sumA=0, sumE=0, sumC=0, cntA=0, cntE=0, cntC=0;
  mapRecs.forEach(r => {
    const a=_mA(r), e=_mE(r), c=_mC(r);
    sumA+=a; sumE+=e; sumC+=c;
    const mn=Math.min(a,e,c);
    if (a===mn) cntA++; else if (e===mn) cntE++; else cntC++;
  });
  const avgA=sumA/n, avgE=sumE/n, avgC=sumC/n;
  const constrained = avgA<=avgE&&avgA<=avgC ? 'Arch' : avgE<=avgA&&avgE<=avgC ? 'Exec' : 'Ctx';
  const constLabel  = avgA<=avgE&&avgA<=avgC ? 'Architecture' : avgE<=avgA&&avgE<=avgC ? 'Execution' : 'Context';

  const peArr = mapRecs.map(r => {
    return Math.pow(Math.max(0,_mA(r)*_mE(r)*_mC(r)),1/3);
  }).filter(v=>isFinite(v)&&v>0);
  const avgPE = peArr.length ? peArr.reduce((a,b)=>a+b,0)/peArr.length : 0;

  let mapINA=0;
  mapRecs.forEach(r => {
    if ((r.score||0)>=8) return;
    if (typeof classifyPattern==='function') { try { const cp=classifyPattern(r); if(cp.intentional>cp.unintentional) mapINA++; } catch(e){ console.warn('atlas: classifyPattern error', e); } }
  });

  if (el('inst-kpi-map-add'))        el('inst-kpi-map-add').textContent        = avgAdd.toFixed(2);
  if (el('inst-kpi-map-pe'))         el('inst-kpi-map-pe').textContent         = avgPE ? avgPE.toFixed(3) : '—';
  if (el('inst-kpi-map-constraint')) el('inst-kpi-map-constraint').textContent = constrained;
  if (el('inst-kpi-map-ina'))        el('inst-kpi-map-ina').textContent        = Math.round(mapINA/n*100)+'%';

  // Domain bars
  const domBars = el('inst-map-domain-bars');
  if (domBars) {
    const bar = (label, val, col, qsub) => {
      const pct = Math.min(100, Math.round(val*100));
      return `<div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <span style="font-family:var(--font-mono);font-size:0.76rem;color:${col};">${label}</span>
          <span style="font-family:var(--font-mono);font-size:0.76rem;color:var(--muted);">${val.toFixed(3)} &nbsp;<span style="font-size:0.65rem;color:var(--dim);">${qsub}</span></span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:2px;">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width 0.7s;"></div>
        </div>
      </div>`;
    };
    domBars.innerHTML =
      bar('Architecture · Intentional Decision-Making', avgA, 'rgba(212,168,67,0.85)', 'Q2 Q3 Q6') +
      bar('Execution · Behavioral Reliability',         avgE, 'rgba(78,156,245,0.85)',  'Q1 Q4 Q5 Q8') +
      bar('Context · Perceived Burden & Access',        avgC, 'rgba(46,201,138,0.85)',  'Q7') +
      `<div style="margin-top:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;display:flex;gap:18px;flex-wrap:wrap;font-family:var(--font-mono);font-size:0.70rem;color:var(--muted);">
        <span>PE Composite: <strong style="color:var(--pe);">${avgPE?avgPE.toFixed(3):'—'}</strong></span>
        <span>Primary Constraint: <strong style="color:var(--poor);">${constLabel}</strong></span>
        <span style="color:rgba(212,168,67,0.7);">A-limited: ${Math.round(cntA/n*100)}%</span>
        <span style="color:rgba(78,156,245,0.7);">E-limited: ${Math.round(cntE/n*100)}%</span>
        <span style="color:rgba(46,201,138,0.7);">C-limited: ${Math.round(cntC/n*100)}%</span>
        <span>${n.toLocaleString()} MAP records</span>
      </div>`;
  }
}

function renderInstitutionBandTable(page) {
  const bandTable = document.getElementById('inst-band-table');
  if (!bandTable) return;

  const PAGE_SIZE = +(document.getElementById('inst-band-pagesize') || {value: window._instBandPageSize || 10}).value || window._instBandPageSize || 10;
  window._instBandPageSize = PAGE_SIZE;
  window._instBandPage = Math.max(1, page || window._instBandPage || 1);

  const byWS    = window._instBandByWS || {};
  const filterWs = (document.getElementById('inst-band-filter-ws')?.value   || '').trim();
  const filterCo = (document.getElementById('inst-band-filter-country')?.value || '').trim();

  let wsEntries = Object.entries(byWS);
  if (filterWs) wsEntries = wsEntries.filter(([w]) => w === filterWs);
  const filteredByWS = {};
  wsEntries.forEach(([w, d]) => {
    const recs = filterCo ? d.mmas.filter(r => (r.country||'').trim().toLowerCase() === filterCo.toLowerCase()) : d.mmas;
    if (recs.length > 0) filteredByWS[w] = recs;
  });

  const wsKeys = Object.keys(filteredByWS);
  if (!wsKeys.length) {
    bandTable.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;padding:8px 0;">No data matches this filter.</div>';
    const pager = document.getElementById('inst-band-pager');
    if (pager) pager.style.display = 'none';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(wsKeys.length / PAGE_SIZE));
  window._instBandPage = Math.min(window._instBandPage, totalPages);
  const pageKeys = wsKeys.slice((window._instBandPage - 1) * PAGE_SIZE, window._instBandPage * PAGE_SIZE);

  const bands     = ['< 3','3–3.99','4–4.99','5–5.99','6–7.99','8'];
  const bandColor = ['#991b1b','#ef4444','#f97316','#f59e0b','#3b82f6','#10b981'];
  const getBand   = s => s>=8?5:s>=6?4:s>=5?3:s>=4?2:s>=3?1:0;

  const rows = pageKeys.map(w => {
    const recs   = filteredByWS[w];
    const counts = [0,0,0,0,0,0];
    recs.forEach(r => counts[getBand(r.score||0)]++);
    const n = recs.length || 1;
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:0.86rem;color:var(--muted);padding:3px 8px 3px 0;white-space:nowrap;overflow:hidden;max-width:90px;text-overflow:ellipsis;" title="${_esc(w)}">${_esc(w)}</td>
      ${counts.map((c,i) => {
        const pct   = Math.round(c/n*100);
        const alpha = pct > 0 ? Math.max(0.15, pct/100) : 0;
        const bg    = bandColor[i] + Math.round(alpha*255).toString(16).padStart(2,'0');
        return `<td style="text-align:center;padding:2px 3px;"><div style="background:${bg};border-radius:2px;width:100%;height:15px;display:flex;align-items:center;justify-content:center;"><span style="font-family:var(--font-mono);font-size:0.80rem;color:#fff;opacity:${pct>10?1:0.6};">${pct>0?pct+'%':''}</span></div></td>`;
      }).join('')}
    </tr>`;
  }).join('');

  bandTable.innerHTML = `<table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);text-align:left;padding:0 8px 5px 0;">Workspace</th>
      ${bands.map((b,i) => `<th style="font-family:var(--font-mono);font-size:0.80rem;color:${bandColor[i]};text-align:center;padding:0 3px 5px;">${b}</th>`).join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  const pager = document.getElementById('inst-band-pager');
  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    const lbl = document.getElementById('inst-band-page-label');
    const prev = document.getElementById('inst-band-prev');
    const next = document.getElementById('inst-band-next');
    if (lbl) lbl.textContent = `${window._instBandPage} / ${totalPages}  (${wsKeys.length} workspaces)`;
    if (prev) prev.disabled = window._instBandPage <= 1;
    if (next) next.disabled = window._instBandPage >= totalPages;
  }
}

/**
 * Renders the full Institution Command Center dashboard.
 * Populates KPI strips, workspace breakdown tables, maps, and analytics panels
 * using `dashMmasData` and `dashPeacsData` globals. Only runs in institution mode.
 * @returns {void}
 */
function renderInstitutionDashboard() {
  if (!isInstitutionMode()) return;
  const mmas  = dashMmasData  || [];
  const peacs = dashPeacsData || [];
  const ws    = (currentWorkspace || '').toUpperCase();
  const el    = id => document.getElementById(id);

  // ── KPI strip ────────────────────────────────
  const byWS = {};
  mmas.forEach(r => {
    const w = (r.institution_code || '').toUpperCase();
    if (!w || w === ws) return; // skip institution's own — students only
    if (!byWS[w]) byWS[w] = { mmas: [], peacs: [] };
    byWS[w].mmas.push(r);
  });
  peacs.forEach(r => {
    const w = (r.institution_code || '').toUpperCase();
    if (!w || w === ws) return;
    if (!byWS[w]) byWS[w] = { mmas: [], peacs: [] };
    byWS[w].peacs.push(r);
  });

  // childMmas/childPeacs: records from child workspaces only (for per-workspace breakdown)
  const childMmas  = mmas.filter(r => { const w=(r.institution_code||'').toUpperCase(); return w && w !== ws; });
  const childPeacs = peacs.filter(r => { const w=(r.institution_code||'').toUpperCase(); return w && w !== ws; });
  // KPI totals use the full dashMmasData (mmas) so institution-direct records are included,
  // matching the count shown in the collective student cohort banner.
  const total    = mmas.length;
  const totalP   = peacs.length;
  const students = Object.keys(byWS).length || Object.keys(
    [...childMmas,...childPeacs].reduce((acc,r) => { const w=(r.institution_code||'').toUpperCase(); if(w&&w!==ws) acc[w]=1; return acc; }, {})
  ).length;
  const avgScore = total > 0 ? (mmas.reduce((s,r)=>s+(r.score||0),0)/total) : 0;
  const countries = new Set(mmas.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;

  // MAP PE for the KPI strip (MAP records only)
  const _mapA = r => ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
  const _mapE = r => ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
  const _mapC = r => 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
  const mapRecsFull = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const mapPeArr = mapRecsFull.map(r => {
    return Math.pow(Math.max(0, _mapA(r)*_mapE(r)*_mapC(r)), 1/3);
  }).filter(v => isFinite(v) && v > 0);
  const avgMapPe = mapPeArr.length ? mapPeArr.reduce((a,b)=>a+b,0)/mapPeArr.length : 0;

  if (el('inst-kpi-students'))  el('inst-kpi-students').textContent  = students || '—';
  if (el('inst-kpi-mmas'))      el('inst-kpi-mmas').textContent      = total.toLocaleString();
  if (el('inst-kpi-peacs'))     el('inst-kpi-peacs').textContent     = totalP.toLocaleString();
  if (el('inst-kpi-avg'))       el('inst-kpi-avg').textContent       = avgScore > 0 ? avgScore.toFixed(2) : '—';
  if (el('inst-kpi-pe'))        el('inst-kpi-pe').textContent        = avgMapPe > 0 ? avgMapPe.toFixed(3) : '—';
  if (el('inst-kpi-countries')) el('inst-kpi-countries').textContent = countries || '—';
  // INA rate and High% populated after ina/high are counted below — see deferred update

  // ── Adherence distribution ─────────────────
  let ina=0, una=0, mixed=0, high=0;
  childMmas.forEach(r => {
    if ((r.score||0) >= 8) { high++; return; }
    if (r.q1 === undefined) { una++; return; }
    try {
      const {intentional, unintentional} = classifyPattern(r);
      if (intentional > unintentional) ina++;
      else if (unintentional > intentional) una++;
      else mixed++;
    } catch(e) { una++; }
  });
  const pct = n => total > 0 ? Math.round(n/total*100) : 0;
  if (el('inst-pct-ina'))   el('inst-pct-ina').textContent   = pct(ina)+'%';
  if (el('inst-pct-una'))   el('inst-pct-una').textContent   = pct(una)+'%';
  if (el('inst-pct-mixed')) el('inst-pct-mixed').textContent = pct(mixed)+'%';
  if (el('inst-pct-high'))  el('inst-pct-high').textContent  = pct(high)+'%';
  // Populate new KPI strip cells
  if (el('inst-kpi-ina-rate'))  el('inst-kpi-ina-rate').textContent  = total > 0 ? pct(ina)+'%' : '—';
  if (el('inst-kpi-high-rate')) el('inst-kpi-high-rate').textContent = total > 0 ? pct(high)+'%' : '—';
  renderBenchmarkStrip('inst-benchmark-container', avgScore > 0 ? avgScore : 0, total);

  const distBar = el('inst-adh-dist');
  if (distBar && total > 0) {
    distBar.innerHTML = `
      <div style="flex:${ina};background:var(--poor);min-width:${ina?2:0}px;"></div>
      <div style="flex:${una};background:var(--moderate);min-width:${una?2:0}px;"></div>
      <div style="flex:${mixed};background:var(--mvmt);min-width:${mixed?2:0}px;"></div>
      <div style="flex:${high};background:var(--optimal);min-width:${high?2:0}px;border-radius:0 4px 4px 0;"></div>`;
  }

  // Vertical bars
  const adhBars   = el('inst-adh-bars');
  const adhCounts = el('inst-adh-counts');
  const adhLabels = el('inst-adh-labels');
  if (adhBars && total > 0) {
    const items = [{n:ina,label:'INA',col:'var(--poor)'},{n:una,label:'UNA',col:'var(--moderate)'},{n:mixed,label:'Mixed',col:'var(--mvmt)'},{n:high,label:'High',col:'var(--optimal)'}];
    const maxN = Math.max(...items.map(i=>i.n), 1);
    // Count row — sits above bars, no overlap possible
    if (adhCounts) adhCounts.innerHTML = items.map(i =>
      `<div style="flex:1;text-align:center;font-family:var(--font-mono);font-size:0.82rem;font-weight:500;color:${i.col};">${i.n}</div>`
    ).join('');
    // Bar columns — pure bars, no numbers inside
    adhBars.innerHTML = items.map(i =>
      `<div style="flex:1;display:flex;align-items:flex-end;">
        <div style="width:100%;background:${i.col};border-radius:3px 3px 0 0;height:${Math.max(Math.round(i.n/maxN*48),3)}px;"></div>
      </div>`
    ).join('');
    // Label row below bars
    if (adhLabels) adhLabels.innerHTML = items.map(i =>
      `<span style="flex:1;text-align:center;font-family:var(--font-mono);font-size:0.82rem;color:${i.col};">${i.label}</span>`
    ).join('');
  }

  // ── Per-student workspace list ───────────────
  const wsList = el('inst-ws-list');
  if (wsList) {
    const wsArr = Object.entries(
      [...mmas,...peacs].reduce((acc,r) => {
        const w = (r.institution_code||'').toUpperCase();
        if (!w || w === ws) return acc;
        if (!acc[w]) acc[w] = {mmas:[], peacs:[]};
        return acc;
      }, byWS)
    ).sort((a,b) => b[1].mmas.length - a[1].mmas.length);

    if (!wsArr.length) {
      wsList.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No student data yet.</div>';
    } else {
      const maxN = Math.max(...wsArr.map(([,d])=>d.mmas.length), 1);
      wsList.innerHTML = wsArr.map(([w, d]) => {
        const n = d.mmas.length;
        const avg = n > 0 ? (d.mmas.reduce((s,r)=>s+(r.score||0),0)/n).toFixed(2) : '—';
        const cat = n > 0 ? getAdherenceCategory(parseFloat(avg)||0) : {color:'var(--dim)'};
        const barW = Math.round(n/maxN*100);
        return `<div style="display:flex;align-items:center;gap:8px;">
          <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--muted);min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(w)}">${_esc(w)}</span>
          <div style="flex:1;height:6px;background:var(--card2);border-radius:3px;overflow:hidden;">
            <div style="width:${barW}%;height:100%;background:${cat.color};border-radius:3px;transition:width 0.8s;"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.82rem;color:${cat.color};min-width:32px;text-align:right;">${avg}</span>
          <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);min-width:20px;text-align:right;">${n}</span>
        </div>`;
      }).join('');
    }
  }

  // ── Score band heatmap per student ──────────
  // Store data on window so the filter dropdowns can re-render without re-fetching
  window._instBandByWS = byWS;
  window._instBandMmas = mmas;

  // Populate workspace dropdown
  const bandWsSel = document.getElementById('inst-band-filter-ws');
  if (bandWsSel) {
    const currentWs = bandWsSel.value;
    const wsKeys = Object.keys(byWS).sort();
    bandWsSel.innerHTML = '<option value="">All Workspaces</option>' +
      wsKeys.map(w => `<option value="${w}"${w===currentWs?' selected':''}>${w}</option>`).join('');
  }
  // Populate country dropdown from all MMAS records
  const bandCoSel = document.getElementById('inst-band-filter-country');
  if (bandCoSel) {
    const currentCo = bandCoSel.value;
    // Normalise to title-case so "INDIA", "India", "india" all collapse to one entry
    const toTitle = s => s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const countries = [...new Set(mmas.map(r => toTitle((r.country||'').trim())).filter(c=>c&&c!=='Unknown'))].sort();
    bandCoSel.innerHTML = '<option value="">All Countries</option>' +
      countries.map(c => `<option value="${c}"${c===currentCo?' selected':''}>${c}</option>`).join('');
  }
  renderInstitutionBandTable(1);

  // ── Track A · MAP section ──────────────────
  _renderInstMapSection(mmas, childMmas);

  // ── MMAS Care Gap Monitor ───────────────────
  _renderInstCareGap(mmas);

  // ── PEACS PE zones ───────────────────────────
  const peZones = el('inst-pe-zones');
  if (peZones && totalP > 0) {
    const zones = [
      {label:'Optimal',min:0.85,max:1,col:'#10b981',desc:'PE ≥ 0.85'},
      {label:'Good',min:0.70,max:0.85,col:'#3b82f6',desc:'0.70–0.84'},
      {label:'Moderate',min:0.55,max:0.70,col:'#f59e0b',desc:'0.55–0.69'},
      {label:'Poor',min:0,max:0.55,col:'#ef4444',desc:'< 0.55'}
    ];
    peZones.innerHTML = zones.map(z => {
      const n = childPeacs.filter(r=>(r.pe||0)>=z.min && (r.pe||0)<z.max).length;
      const p = Math.round(n/totalP*100);
      return `<div style="background:${z.col}12;border:1px solid ${z.col}30;border-radius:6px;padding:10px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:${z.col};">${n}</div>
        <div style="font-family:var(--font-mono);font-size:0.84rem;text-transform:uppercase;color:${z.col}99;margin-top:2px;">${z.label}</div>
        <div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);margin-top:1px;">${p}% · ${z.desc}</div>
      </div>`;
    }).join('');
  }
  const peDims = el('inst-pe-dims');
  if (peDims && totalP > 0) {
    const avgBase   = (childPeacs.reduce((s,r)=>s+(r.base||0),0)/totalP).toFixed(3);
    const avgMvmt   = (childPeacs.reduce((s,r)=>s+(r.mvmt||0),0)/totalP).toFixed(3);
    const avgStrata = (childPeacs.reduce((s,r)=>s+(r.strata||0),0)/totalP).toFixed(3);
    peDims.innerHTML = [
      {label:'BASE',val:avgBase,col:'var(--base)'},
      {label:'MVMT',val:avgMvmt,col:'var(--mvmt)'},
      {label:'STRATA',val:avgStrata,col:'var(--strata)'}
    ].map(d => `<div style="flex:1;text-align:center;background:var(--card2);border-radius:6px;padding:8px;">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;color:${d.col};">${d.val}</div>
      <div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--dim);text-transform:uppercase;margin-top:2px;">${d.label}</div>
    </div>`).join('');
  }


  // ── Top conditions (normalized + deduplicated) ──
  const condEl = el('inst-conditions');
  if (condEl) {
    const condCounts = {}, condLabels = {};
    childMmas.forEach(r => {
      if (!r.condition) return;
      const norm = normalizeCondition(r.condition);
      if (!norm) return;
      condCounts[norm.key] = (condCounts[norm.key]||0) + 1;
      if (!condLabels[norm.key]) condLabels[norm.key] = norm.label;
    });
    const sorted = Object.entries(condCounts).sort((a,b)=>b[1]-a[1]).slice(0, 8);
    const maxC2 = sorted[0]?.[1] || 1;
    condEl.innerHTML = sorted.length ? sorted.map(([k,n]) => {
      const label = condLabels[k] || k;
      return `<div style="display:flex;align-items:center;gap:6px;">
        <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(label)}">${_esc(label)}</span>
        <div style="flex-shrink:0;width:50px;height:5px;background:var(--card2);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.round(n/maxC2*100)}%;height:100%;background:var(--base);border-radius:3px;transition:width 0.6s;"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--base);flex-shrink:0;min-width:18px;text-align:right;">${n}</span>
      </div>`;
    }).join('') : '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No condition data yet.</div>';
  }

  // ── Attention flags ──────────────────────────
  const flagsEl = el('inst-flags');
  if (flagsEl) {
    const flags = [];
    const inaRate = total > 0 ? ina/total : 0;
    if (inaRate > 0.3) flags.push({col:'var(--poor)', msg:`High INA rate across cohort: ${Math.round(inaRate*100)}% intentional non-adherence`});
    const lowScoreWS = Object.entries(byWS).filter(([,d]) => d.mmas.length >= 3 && (d.mmas.reduce((s,r)=>s+(r.score||0),0)/d.mmas.length) < 6);
    if (lowScoreWS.length) flags.push({col:'var(--moderate)', msg:`${lowScoreWS.length} workspace${lowScoreWS.length>1?'s':''} with mean score < 6.0 (low adherence): ${lowScoreWS.map(([w])=>_esc(w)).join(', ')}`});
    const noData = Object.keys(byWS).filter(w => byWS[w].mmas.length === 0);
    if (noData.length) flags.push({col:'var(--dim)', msg:`${noData.length} workspace${noData.length>1?'s':''} with PEACS but no MMAS data`});
    if (avgMapPe > 0 && avgMapPe < 0.55) flags.push({col:'var(--poor)', msg:`Collective PE mean below threshold: ${avgMapPe.toFixed(3)} (target ≥ 0.70)`});
    if (!flags.length) flags.push({col:'var(--optimal)', msg:'No issues detected — cohort performing within expected parameters'});
    flagsEl.innerHTML = flags.map(f => `<div style="font-family:var(--font-mono);font-size:0.80rem;color:${f.col};padding:4px 8px;background:${f.col}12;border-radius:4px;border-left:2px solid ${f.col};">⚑ ${f.msg}</div>`).join('');
  }

  // ── Coverage list ────────────────────────────
  const covEl = el('inst-coverage-list'); // hidden legacy element — kept for compatibility
  const wsCovEl = el('inst-ws-coverage-list');
  if (wsCovEl) {
    const allWS = new Set([
      ...Object.keys(byWS),
      ...mmas.map(r=>(r.institution_code||'').toUpperCase()).filter(w=>w&&w!==ws),
      ...peacs.map(r=>(r.institution_code||'').toUpperCase()).filter(w=>w&&w!==ws)
    ]);
    const peByWS = {};
    peacs.forEach(r => { const w=(r.institution_code||'').toUpperCase(); if(w&&w!==ws){if(!peByWS[w])peByWS[w]=[];peByWS[w].push(r);} });
    const wsArr2 = [...allWS].sort();
    const maxN3 = Math.max(...wsArr2.map(w=>(byWS[w]?.mmas.length||0)), 1);
    if (!wsArr2.length) {
      wsCovEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No student data yet.</div>';
    } else {
      wsCovEl.innerHTML = wsArr2.map(w => {
        const mN = byWS[w]?.mmas.length || 0;
        const pN = peByWS[w]?.length || 0;
        const avg = mN > 0 ? (byWS[w].mmas.reduce((s,r)=>s+(r.score||0),0)/mN) : null;
        const cat = avg !== null ? getAdherenceCategory(avg) : {color:'var(--dim)'};
        const hasMmas = mN > 0, hasPeacs = pN > 0;
        const covColor = hasMmas && hasPeacs ? 'var(--optimal)' : hasMmas || hasPeacs ? 'var(--base)' : 'var(--poor)';
        const covLabel = hasMmas && hasPeacs ? 'Both' : hasMmas ? 'MMAS' : hasPeacs ? 'PEACS' : 'None';
        const barW = Math.round(mN/maxN3*100);
        return `<div style="display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:0;padding:4px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:6px;overflow:hidden;">
            <div style="width:6px;height:6px;border-radius:50%;background:${covColor};flex-shrink:0;"></div>
            <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(w)}">${_esc(w)}</span>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.80rem;color:${cat.color};text-align:right;padding-left:10px;min-width:36px;">${avg!==null?avg.toFixed(2):'—'}</span>
          <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);text-align:right;padding-left:10px;min-width:24px;">${mN}</span>
          <span style="font-family:var(--font-mono);font-size:0.86rem;color:${covColor};text-align:right;padding-left:10px;min-width:40px;">${covLabel}</span>
        </div>`;
      }).join('');
    }
  }
  // ── Activity feed removed — redundant with command center patient panel ──

  // ── Country breakdown chart (replaces heavy Mapbox globe) ────────────────
  const countryChartEl = el('inst-country-chart');
  if (countryChartEl) {
    const cCounts = {};
    childMmas.forEach(r => {
      const c = (r.country || 'Unknown').trim();
      cCounts[c] = (cCounts[c] || 0) + 1;
    });
    const cSorted = Object.entries(cCounts).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    const cMax = cSorted[0]?.[1] || 1;
    if (!cSorted.length) {
      countryChartEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">No geographic data yet.</div>';
    } else {
      countryChartEl.innerHTML = cSorted.map(([c,n]) => {
        const pct = Math.round(n/cMax*100);
        const barCol = n === cMax ? 'var(--base)' : 'var(--border2)';
        return `<div style="display:flex;align-items:center;gap:7px;">
          <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--muted);min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(c)}">${_esc(c)}</span>
          <div style="flex:1;height:6px;background:var(--card2);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--base);border-radius:3px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--base);flex-shrink:0;min-width:22px;text-align:right;">${n}</span>
        </div>`;
      }).join('');
    }
  }

  // ── PEACS per-student coverage ───────────────
  const peacsEl = el('inst-peacs-coverage');
  if (peacsEl) {
    const peByWS = {};
    peacs.forEach(r => {
      const w = (r.institution_code||'').toUpperCase();
      if (!w || w === ws) return;
      if (!peByWS[w]) peByWS[w] = [];
      peByWS[w].push(r);
    });
    const allWS2 = [...new Set([
      ...Object.keys(byWS),
      ...Object.keys(peByWS)
    ])].sort();
    if (!allWS2.length) {
      peacsEl.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">No PEACS data yet.</div>';
    } else {
      peacsEl.innerHTML = allWS2.map(w => {
        const pRecs = peByWS[w] || [];
        const mRecs = byWS[w]?.mmas || [];
        const avgPe = pRecs.length > 0 ? (pRecs.reduce((s,r)=>s+(r.pe||0),0)/pRecs.length) : null;
        const peCol = avgPe === null ? 'var(--dim)' : avgPe>=0.85?'#10b981':avgPe>=0.70?'#3b82f6':avgPe>=0.55?'#f59e0b':'#ef4444';
        const hasBoth = mRecs.length > 0 && pRecs.length > 0;
        return `<div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:0;padding:4px 0;border-bottom:1px solid var(--border);">
          <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(w)}">${_esc(w)}</span>
          <span style="font-family:var(--font-mono);font-size:0.80rem;color:${peCol};text-align:right;padding-left:10px;min-width:44px;">${avgPe!==null?avgPe.toFixed(3):'—'}</span>
          <span style="font-family:var(--font-mono);font-size:0.84rem;color:${hasBoth?'var(--optimal)':'var(--dim)'};text-align:right;padding-left:8px;min-width:28px;">${pRecs.length>0?pRecs.length+'×':'—'}</span>
        </div>`;
      }).join('');
    }
  }

  // ── MMAS × PE scatter chart (SVG) ────────────
  const corrEl = el('inst-corr-chart');
  if (corrEl && mmas.length > 0 && peacs.length > 0) {
    // Match MMAS and PEACS records by patient_number
    const peByPat = {};
    childPeacs.forEach(r => { if (r.patient_number) peByPat[r.patient_number] = r; });
    const paired = childMmas.filter(r => r.patient_number && peByPat[r.patient_number])
      .map(r => ({ mmas: r.score||0, pe: peByPat[r.patient_number].pe||0 }));

    if (paired.length >= 3) {
      const W = corrEl.offsetWidth || 300, H = 200;
      const pad = { l:32, r:12, t:8, b:28 };
      const xMin=0, xMax=8, yMin=0, yMax=1;
      const sx = v => pad.l + (v-xMin)/(xMax-xMin)*(W-pad.l-pad.r);
      const sy = v => H-pad.b - (v-yMin)/(yMax-yMin)*(H-pad.t-pad.b);

      // Simple linear regression
      const n = paired.length;
      const xBar = paired.reduce((s,p)=>s+p.mmas,0)/n;
      const yBar = paired.reduce((s,p)=>s+p.pe,0)/n;
      const sxy  = paired.reduce((s,p)=>s+(p.mmas-xBar)*(p.pe-yBar),0);
      const sxx  = paired.reduce((s,p)=>s+(p.mmas-xBar)**2,0);
      const m    = sxx ? sxy/sxx : 0;
      const b    = yBar - m*xBar;
      const r2   = sxx ? (sxy**2/(sxx*paired.reduce((s,p)=>s+(p.pe-yBar)**2,0)||1)) : 0;

      const dots = paired.map(p => {
        const cat = getAdherenceCategory(p.mmas);
        return `<circle cx="${sx(p.mmas).toFixed(1)}" cy="${sy(p.pe).toFixed(1)}" r="3" fill="${cat.color}" fill-opacity="0.65" stroke="${cat.color}" stroke-width="0.5"/>`;
      }).join('');

      // Regression line
      const x1=xMin, x2=xMax, y1=m*x1+b, y2=m*x2+b;
      const regLine = `<line x1="${sx(x1)}" y1="${sy(Math.max(0,Math.min(1,y1)))}" x2="${sx(x2)}" y2="${sy(Math.max(0,Math.min(1,y2)))}" stroke="rgba(212,168,67,0.5)" stroke-width="1.5" stroke-dasharray="4,3"/>`;

      // Axes
      const xAxis = `<line x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}" stroke="var(--border2)" stroke-width="1"/>`;
      const yAxis = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}" stroke="var(--border2)" stroke-width="1"/>`;
      const xLabels = [0,2,4,6,8].map(v=>`<text x="${sx(v)}" y="${H-pad.b+9}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="8" fill="var(--dim)">${v}</text>`).join('');
      const yLabels = [0,0.25,0.5,0.75,1].map(v=>`<text x="${pad.l-3}" y="${sy(v)+3}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="8" fill="var(--dim)">${v}</text>`).join('');
      const r2Label = `<text x="${W-pad.r}" y="${pad.t+10}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9" fill="rgba(212,168,67,0.7)">R²=${r2.toFixed(3)}  n=${n}</text>`;
      const xAxisLbl = `<text x="${(W-pad.l-pad.r)/2+pad.l}" y="${H}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="8" fill="var(--dim)">MMAS-8 Score</text>`;
      const yAxisLbl = `<text x="10" y="${(H-pad.t-pad.b)/2+pad.t}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="8" fill="var(--dim)" transform="rotate(-90 10 ${(H-pad.t-pad.b)/2+pad.t})">PE Score</text>`;

      corrEl.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${xAxis}${yAxis}${xLabels}${yLabels}${dots}${regLine}${r2Label}${xAxisLbl}${yAxisLbl}</svg>`;
    } else {
      corrEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--font-mono);font-size:0.84rem;color:var(--dim);">Need ≥ 3 matched patient pairs for scatter chart.</div>`;
    }
  } else if (corrEl) {
    corrEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--font-mono);font-size:0.84rem;color:var(--dim);">No matched MMAS + PEACS pairs yet.</div>`;
  }

  // ── Reload sentinel with fresh children data ──
  if (isInstitutionMode() && document.getElementById('sentinel-panel')) {
    const feed = document.getElementById('sentinel-feed');
    if (feed) { feed.innerHTML = ''; _sentinelLoadInstitutionAlerts(); }
  }

  // ── CTO4: Compliance Status Widget ───────────────────────────────────────
  if (typeof _instRenderComplianceWidget === 'function') _instRenderComplianceWidget();
}

// ══════════════════════════════════════════════
// FEATURE 6: SITE BENCHMARKING
// ══════════════════════════════════════════════
/**
 * Renders the adherence benchmarking panel comparing cohort performance to global norms.
 * @param {Array<Object>} cohortRecords - MMAS-8 records for the current cohort
 * @returns {void}
 */
function renderBenchmarking(cohortRecords) {
  const wrap   = document.getElementById('bench-dist-wrap');
  const insight = document.getElementById('bench-insight');
  if (!wrap || !cohortRecords || !cohortRecords.length) return;

  // Cohort distribution in integer score buckets 0–8
  const cohortDist = Array(9).fill(0);
  cohortRecords.forEach(r => {
    const sc = r.score||0; const bucket = sc>=8?8:Math.min(7,Math.max(0,Math.floor(sc)));
    cohortDist[bucket]++;
  });
  const cohortTotal = cohortRecords.length || 1;

  // Pull global distribution from Firebase mapData (public pool)
  database.ref('mapData').once('value', snap => {
    const allData = snap.val() ? Object.values(snap.val()) : [];
    const globalDist = Array(9).fill(0);
    allData.forEach(r => {
      const sc2 = r.score||0; const bucket = sc2>=8?8:Math.min(7,Math.max(0,Math.floor(sc2)));
      globalDist[bucket]++;
    });
    const globalTotal = allData.length || 1;

    const maxPct = Math.max(
      ...cohortDist.map(v=>v/cohortTotal),
      ...globalDist.map(v=>v/globalTotal),
      0.01
    );

    wrap.innerHTML = '';
    for (let i=0; i<=8; i++) {
      const cPct = cohortDist[i] / cohortTotal;
      const gPct = globalDist[i] / globalTotal;
      const bar = document.createElement('div');
      bar.className = 'bench-bar-group';
      bar.style.flexDirection = 'column';
      bar.style.alignItems = 'center';
      bar.innerHTML = `
        <div style="display:flex;gap:2px;align-items:flex-end;height:160px;width:100%;">
          <div class="bench-bar" style="background:var(--strata);height:${Math.round(cPct/maxPct*160)}px;" title="Your cohort: ${Math.round(cPct*100)}%"></div>
          <div class="bench-bar" style="background:rgba(255,255,255,0.15);height:${Math.round(gPct/maxPct*160)}px;" title="Global: ${Math.round(gPct*100)}%"></div>
        </div>
        <div class="bench-bar-label">${i}</div>`;
      wrap.appendChild(bar);
    }

    // ── Benchmark banner card ────────────────────────────────────────────────
    const cohortAvg = cohortRecords.reduce((a,r)=>a+(r.score||0),0)/cohortTotal;
    const globalAvg = allData.length ? allData.reduce((a,r)=>a+(r.score||0),0)/globalTotal : null;
    const cohortHighPct = Math.round(cohortDist[8]/cohortTotal*100);
    const globalHighPct = globalTotal > 0 ? Math.round(globalDist[8]/globalTotal*100) : null;

    // Remove previous banner if any
    const prevBanner = document.getElementById('bench-banner-card');
    if (prevBanner) prevBanner.remove();

    if (globalAvg !== null && wrap.parentElement) {
      const diff = cohortAvg - globalAvg;
      const isAbove = diff >= 0;
      const absDiff = Math.abs(diff).toFixed(2);
      const diffColor = isAbove ? 'var(--optimal)' : '#ef4444';
      const arrow = isAbove ? '↑' : '↓';
      const globalMedian = (() => {
        // Approximate median from distribution
        let cum = 0;
        for (let i=0; i<=8; i++) {
          cum += globalDist[i];
          if (cum >= globalTotal/2) return i;
        }
        return 4;
      })();
      const cohortMedian = (() => {
        let cum = 0;
        for (let i=0; i<=8; i++) {
          cum += cohortDist[i];
          if (cum >= cohortTotal/2) return i;
        }
        return 4;
      })();
      const medDiff = cohortMedian - globalMedian;

      // ── Pearson's second skewness coefficient: 3(mean−median)/SD ──────────
      // Positive = right-skewed (tail toward high adherence, most patients at low end)
      // Negative = left-skewed (tail toward low adherence, most patients at high end)
      const cohortSD = cohortTotal > 1
        ? Math.sqrt(cohortRecords.reduce((s,r)=>s+Math.pow((r.score||0)-cohortAvg,2),0)/(cohortTotal-1))
        : 0;
      const cohortSkew = cohortSD > 0
        ? parseFloat((3 * (cohortAvg - cohortMedian) / cohortSD).toFixed(2))
        : 0;
      const skewLabel = cohortSkew > 0.5 ? 'Right-skewed'
        : cohortSkew < -0.5 ? 'Left-skewed'
        : 'Approximately symmetric';
      const skewInterpretation = cohortSkew > 0.5
        ? 'Most patients cluster at lower adherence; a small tail of high adherers pulls the mean up. Mean overstates typical patient experience.'
        : cohortSkew < -0.5
        ? 'Most patients cluster at high adherence; a small tail of poor adherers pulls the mean down. Median better represents typical patient experience.'
        : 'Score distribution is approximately symmetric. Mean and median are aligned — both are reliable central tendency measures for this cohort.';
      const skewColor = Math.abs(cohortSkew) > 0.5 ? '#f59e0b' : 'var(--optimal)';

      const banner = document.createElement('div');
      banner.id = 'bench-banner-card';
      banner.style.cssText = 'margin-bottom:16px;';
      banner.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px;">
          <div style="background:rgba(255,255,255,0.02);border:1px solid ${diffColor}33;border-radius:12px;padding:16px 18px;text-align:center;position:relative;overflow:hidden;">
            <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,${diffColor}0a,transparent 65%);"></div>
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">vs Global Mean</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;font-weight:300;color:${diffColor};line-height:1;">${arrow} ${absDiff}</div>
            <div style="font-size:0.90rem;color:var(--muted);margin-top:4px;">points ${isAbove?'above':'below'} global average of <strong style="color:var(--bright);">${globalAvg.toFixed(2)}</strong></div>
          </div>
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(78,156,245,0.2);border-radius:12px;padding:16px 18px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Cohort Mean · SD</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;font-weight:300;color:var(--base);line-height:1;">${cohortAvg.toFixed(2)}</div>
            <div style="font-size:0.90rem;color:var(--muted);margin-top:4px;">${cohortTotal} patient${cohortTotal!==1?'s':''} · ±${cohortSD.toFixed(2)} SD · ${cohortHighPct}% high adh.</div>
          </div>
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 18px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Median Comparison</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;font-weight:300;color:${medDiff>=0?'var(--optimal)':'#ef4444'};line-height:1;">${medDiff>=0?'+':''}${medDiff}</div>
            <div style="font-size:0.90rem;color:var(--muted);margin-top:4px;">vs global median of <strong style="color:var(--bright);">${globalMedian}</strong></div>
          </div>
          <div style="background:rgba(255,255,255,0.02);border:1px solid ${skewColor}33;border-radius:12px;padding:16px 18px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Distribution Skew</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;font-weight:300;color:${skewColor};line-height:1;">${cohortSkew > 0 ? '+' : ''}${cohortSkew}</div>
            <div style="font-size:0.90rem;color:var(--muted);margin-top:4px;">${skewLabel}</div>
          </div>
          ${globalHighPct !== null ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(139,111,245,0.2);border-radius:12px;padding:16px 18px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">High Adherence Rate</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;font-weight:300;color:var(--mvmt);line-height:1;">${cohortHighPct}%</div>
            <div style="font-size:0.90rem;color:var(--muted);margin-top:4px;">vs global ${globalHighPct}% (MMAS-8 = 8.0)</div>
          </div>` : ''}
        </div>
        <div class="bench-insight-strip" id="bench-insight-strip-auto">
          Your cohort scores <strong style="color:${diffColor};">${absDiff} points ${isAbove?'above':'below'}</strong> the global ATLAS mean of <strong>${globalAvg.toFixed(2)}</strong>.
          ${Math.abs(medDiff) > 0 ? `Median is ${medDiff > 0 ? 'higher' : 'lower'} than global by ${Math.abs(medDiff)} point${Math.abs(medDiff)!==1?'s':''}.` : 'Median aligns with global benchmark.'}
          ${Math.abs(cohortSkew) > 0.5 ? ` Skew (${cohortSkew > 0 ? '+' : ''}${cohortSkew}): ${skewInterpretation}` : ''}
          ${cohortHighPct > (globalHighPct||0)+5 ? ' 🟢 High adherence rate notably exceeds global benchmark.' : cohortHighPct < (globalHighPct||0)-5 ? ' 🔴 High adherence rate lags behind global benchmark — consider targeted intervention.' : ''}
        </div>`;
      wrap.parentElement.insertBefore(banner, wrap);
    }

    // Keep existing bench-insight element updated
    if (insight) {
      const cohortAvgF = cohortRecords.reduce((a,r)=>a+(r.score||0),0)/cohortTotal;
      let txt = `Cohort mean: <strong style="color:var(--strata);">${cohortAvgF.toFixed(2)}</strong> / 8 · ${cohortTotal} patients`;
      if (globalAvg !== null) {
        const diff = cohortAvgF - globalAvg;
        txt += ` · Global ATLAS mean: <strong>${globalAvg.toFixed(2)}</strong> · <strong style="color:${diff>=0?'var(--optimal)':'#ef4444'};">${Math.abs(diff).toFixed(2)} pts ${diff>=0?'above':'below'}</strong> global.`;
      }
      insight.innerHTML = txt;
    }
  });
}

// ══════════════════════════════════════════════
// CHERRY 1: CONFETTI BURST
// ══════════════════════════════════════════════
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#10b981','#4e9cf5','#8b6ff5','#d4a843','#2ec98a','#ffffff'];
  const particles = Array.from({length:120}, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 120,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    rotV: (Math.random()-0.5)*8,
    w: 8 + Math.random()*8,
    h: 4 + Math.random()*4,
    col: colors[Math.floor(Math.random()*colors.length)],
    alpha: 1
  }));
  let frame = 0;
  function tick() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.05;
      if (frame > 80) p.alpha -= 0.015;
      if (p.y < canvas.height + 20 && p.alpha > 0) {
        alive = true;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      }
    });
    frame++;
    if (alive && frame < 180) requestAnimationFrame(tick);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; }
  }
  requestAnimationFrame(tick);
}

// ══════════════════════════════════════════════
// CHERRY 2: QR CODE GENERATOR (pure JS — no external lib)
// ══════════════════════════════════════════════
function _generateQR(containerId, url, size) {
  const el = document.getElementById(containerId);
  if (!el) return;
  // Minimal URL→dots QR using a pre-encoded matrix for adherence.cc
  // For production, replace with qrcode.js library
  // Here we render a stylised placeholder that looks like a QR
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,size,size);
  // Draw finder pattern top-left
  const cell = size / 10;
  function square(x,y,w,h,color){ ctx.fillStyle=color; ctx.fillRect(x*cell,y*cell,w*cell,h*cell); }
  ctx.fillStyle='#000';
  // Outer rings
  [[0,0,7,7],[0,0,7,1],[0,6,7,1],[0,0,1,7],[6,0,1,7]].forEach(([x,y,w,h])=>square(x,y,w,h,'#000'));
  square(1,1,5,5,'#fff'); square(2,2,3,3,'#000');
  // Bottom-left finder
  [[0,7,7,3],[0,7,7,1],[0,9,7,1],[0,7,1,3],[6,7,1,3]].forEach(([x,y,w,h])=>square(x,y,w,h,'#000'));
  square(1,8,5,1,'#fff'); square(2,8,3,1,'#000');
  // Top-right finder
  [[7,0,3,7],[7,0,3,1],[7,6,3,1],[7,0,1,7],[9,0,1,7]].forEach(([x,y,w,h])=>square(x,y,w,h,'#000'));
  square(8,1,1,5,'#fff'); square(8,2,1,3,'#000');
  // Pseudo data dots
  const pseudo=[[3,3],[4,4],[5,3],[3,5],[5,5],[4,7],[4,8],[3,8],[5,8],[7,3],[8,3],[7,4],[8,4],[7,5],[8,5],[7,8],[8,8],[9,7],[9,9],[3,9],[5,9]];
  pseudo.forEach(([x,y])=>square(x,y,1,1,'#000'));
  el.innerHTML='';
  canvas.style.borderRadius='3px';
  el.appendChild(canvas);
}

// ══════════════════════════════════════════════
// CHERRY 3: CLINIC MODE
// ══════════════════════════════════════════════
let _clinicPin = null;
let _clinicPinEntry = '';
let _clinicPinMode = 'set'; // 'set' | 'confirm' | 'exit'

/**
 * Enters clinic/kiosk mode, hiding researcher UI elements for patient-facing use.
 * @returns {void}
 */
function enterClinicMode() {
  _clinicPinMode = 'set';
  _clinicPinEntry = '';
  _clinicPin = null;
  const label = document.getElementById('clinic-pin-label');
  const sub   = document.getElementById('clinic-pin-sub');
  if (label) label.textContent = 'Set a PIN to Enter Clinic Mode';
  if (sub)   sub.textContent   = 'Choose a 4-digit PIN. You\'ll need it to exit.';
  _refreshPinDots();
  document.getElementById('clinic-pin-modal').classList.add('active');
}

function showClinicPinModal(mode) {
  _clinicPinMode = mode;
  _clinicPinEntry = '';
  const label = document.getElementById('clinic-pin-label');
  const sub   = document.getElementById('clinic-pin-sub');
  const err   = document.getElementById('clinic-pin-error');
  if (err) err.textContent = '';
  if (mode === 'exit') {
    if (label) label.textContent = 'Enter PIN to Exit Clinic Mode';
    if (sub)   sub.textContent   = 'Enter your clinic PIN';
  }
  _refreshPinDots();
  document.getElementById('clinic-pin-modal').classList.add('active');
}

function clinicPinKey(k) {
  const err = document.getElementById('clinic-pin-error');
  if (err) err.textContent = '';
  if (k === 'back') { _clinicPinEntry = _clinicPinEntry.slice(0,-1); }
  else if (_clinicPinEntry.length < 4) { _clinicPinEntry += k; }
  _refreshPinDots();
  if (_clinicPinEntry.length === 4) {
    setTimeout(() => {
      if (_clinicPinMode === 'set') {
        _clinicPin = _clinicPinEntry;
        _clinicPinEntry = '';
        _clinicPinMode = 'confirm';
        if (document.getElementById('clinic-pin-label')) document.getElementById('clinic-pin-label').textContent = 'Confirm Your PIN';
        if (document.getElementById('clinic-pin-sub')) document.getElementById('clinic-pin-sub').textContent = 'Enter the same PIN again to confirm';
        _refreshPinDots();
      } else if (_clinicPinMode === 'confirm') {
        if (_clinicPinEntry === _clinicPin) {
          closeClinicPinModal();
          _activateClinicMode();
        } else {
          if (err) err.textContent = 'PINs do not match. Try again.';
          _clinicPinEntry = ''; _clinicPin = null; _clinicPinMode = 'set';
          if (document.getElementById('clinic-pin-label')) document.getElementById('clinic-pin-label').textContent = 'Set a PIN to Enter Clinic Mode';
          if (document.getElementById('clinic-pin-sub')) document.getElementById('clinic-pin-sub').textContent = 'Choose a 4-digit PIN';
          _refreshPinDots();
        }
      } else if (_clinicPinMode === 'exit') {
        if (_clinicPinEntry === _clinicPin) {
          closeClinicPinModal();
          _deactivateClinicMode();
        } else {
          if (err) err.textContent = 'Incorrect PIN. Try again.';
          _clinicPinEntry = '';
          _refreshPinDots();
        }
      }
    }, 120);
  }
}

function _refreshPinDots() {
  for (let i=0;i<4;i++) {
    const dot = document.getElementById('cpd-'+i);
    if (dot) dot.classList.toggle('filled', i < _clinicPinEntry.length);
  }
}

function closeClinicPinModal() {
  document.getElementById('clinic-pin-modal').classList.remove('active');
  _clinicPinEntry = '';
  _refreshPinDots();
}

function _activateClinicMode() {
  document.getElementById('clinic-mode-bar').classList.add('active');
  document.body.classList.add('clinic-mode');
  showScreen('screen-consent');
  document.getElementById('consent-checkbox').checked = false;
  document.getElementById('consent-proceed-btn').disabled = true;
  // Re-render consent in active language when entering clinic mode
  const _clinicLang = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang) ? mmasCurrentLang : 'en';
  const _clinicConsentSel = document.getElementById('lang-select-consent');
  if (_clinicConsentSel) _clinicConsentSel.value = _clinicLang;
  if (typeof renderConsentScreen === 'function') renderConsentScreen(_clinicLang);
  showToast('Clinic Mode active. Hand the device to your patient.', 4000);
  // Request notification permission for daily check-in reminders
  requestAtlasNotificationPermission();
}

function _deactivateClinicMode() {
  document.getElementById('clinic-mode-bar').classList.remove('active');
  document.body.classList.remove('clinic-mode');
  showToast('Clinic Mode exited. Researcher view restored.', 2500);
}

// ══════════════════════════════════════════════
// INITIATIVE 6: PWA PUSH NOTIFICATION CHECK-IN
// ══════════════════════════════════════════════
let _notifPermission = false;

async function requestAtlasNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    _notifPermission = true;
    scheduleAtlasDailyCheckIn();
    return;
  }
  if (Notification.permission === 'denied') return;
  // Ask the user
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      _notifPermission = true;
      showToast('🔔 Daily medication check-in reminders enabled!', 3000);
      scheduleAtlasDailyCheckIn();
    }
  } catch(e) { /* some browsers block programmatic permission requests outside gesture */ }
}

function scheduleAtlasDailyCheckIn() {
  // Calculate ms until next 9:00 AM local time
  const now = new Date();
  const next9am = new Date();
  next9am.setHours(9, 0, 0, 0);
  if (now >= next9am) next9am.setDate(next9am.getDate() + 1);
  const msUntil = next9am - now;

  clearTimeout(window._atlasNotifTimer);
  window._atlasNotifTimer = setTimeout(() => {
    fireAtlasCheckInNotification();
    // Re-schedule for next day
    scheduleAtlasDailyCheckIn();
  }, msUntil);
}

function fireAtlasCheckInNotification() {
  if (!_notifPermission || Notification.permission !== 'granted') return;
  const n = new Notification('ATLAS · Medication Check-In', {
    body: 'Did you take your medication today? Tap to log your adherence.',
    icon: 'https://adherence.cc/favicon.ico',
    badge: 'https://adherence.cc/favicon.ico',
    tag: 'atlas-daily-checkin',
    requireInteraction: true,
    data: { action: 'checkin', timestamp: Date.now() }
  });
  n.onclick = () => {
    window.focus();
    n.close();
    // Show a lightweight quick-check modal
    showAtlasCheckInPrompt();
  };
}

function showAtlasCheckInPrompt() {
  // Remove any existing prompt
  const existing = document.getElementById('atlas-checkin-prompt');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'atlas-checkin-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.88);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:#0d1421;border:1px solid rgba(46,201,138,0.25);border-radius:20px;max-width:380px;width:100%;padding:36px 28px;text-align:center;">
      <div style="font-size:2.8rem;margin-bottom:12px;">💊</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:var(--bright);margin-bottom:8px;">Daily Medication Check-In</div>
      <div style="font-size:0.88rem;color:var(--muted);line-height:1.7;margin-bottom:28px;">Did you take your medication today as prescribed?</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button onclick="atlasCheckinRespond('yes')" style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4);color:var(--optimal);border-radius:var(--r);padding:14px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.22)'" onmouseout="this.style.background='rgba(16,185,129,0.12)'">
          ✓ Yes — I took my medication
        </button>
        <button onclick="atlasCheckinRespond('missed')" style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:var(--r);padding:14px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.16)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">
          ✕ No — I missed a dose
        </button>
        <button onclick="atlasCheckinRespond('late')" style="font-family:var(--font-mono);font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.3);color:var(--pe);border-radius:var(--r);padding:14px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(212,168,67,0.16)'" onmouseout="this.style.background='rgba(212,168,67,0.08)'">
          ⏱ I took it late / at the wrong time
        </button>
        <button onclick="document.getElementById('atlas-checkin-prompt').remove()" style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:none;color:var(--dim);padding:8px;cursor:pointer;margin-top:4px;">
          Remind me later
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function atlasCheckinRespond(response) {
  const overlay = document.getElementById('atlas-checkin-prompt');
  if (overlay) overlay.remove();

  const uid = firebase.auth().currentUser?.uid || ('anon-' + Date.now());
  const workspace = currentWorkspace || 'public';
  const rec = {
    type: 'daily_checkin',
    response,           // 'yes' | 'missed' | 'late'
    workspace,
    timestamp: Date.now(),
    date: new Date().toISOString().slice(0,10)
  };

  // Write to Firebase
  database.ref(`checkins/${workspace}/${uid}`).push(rec)
    .then(() => {
      const msgs = {
        yes:    '✅ Great job! Logged — keep it up.',
        missed: '📝 Missed dose logged. Try to take your next one on schedule.',
        late:   '⏱ Logged. Consistent timing helps your medication work best.'
      };
      showToast(msgs[response] || 'Check-in logged.', 3500);
    })
    .catch(() => showToast('Check-in recorded locally.', 2000));
}

// Expose inst strat functions to global scope for inline onchange handlers
window.renderInstStrat  = renderInstStrat;
window.toggleInstStrat  = toggleInstStrat;
// ─────────────────────────────────────────────

