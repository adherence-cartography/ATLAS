// ══════════════════════════════════════════════════════════════════════════
//  PARENT_INSTITUTION BACKFILL UTILITY — Superadmin only
//  Fixes historical MMAS-8 records that were submitted by child PI workspaces
//  before the parent_institution field was added to submitMMAS().
//
//  Strategy:
//  1. Read all assessments from Firebase
//  2. Build a map of institution_code → parent_institution using PEACS records
//     (which already have the field correctly set)
//  3. Find MMAS records missing parent_institution but whose institution_code
//     appears in the PEACS-derived map
//  4. Batch-write parent_institution to each affected record via .update()
//  5. Show live progress with counts and allow cancellation
// ══════════════════════════════════════════════════════════════════════════

/**
 * Opens the parent_institution backfill utility modal. Superadmin access required.
 * Creates the modal DOM on first call; subsequent calls re-open the existing element.
 * @returns {void}
 */
window.openBackfillModal = function() {
  if (!isSuperAdmin()) { showToast('⛔ Superadmin access required.'); return; }
  const existing = document.getElementById('backfill-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'backfill-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:32px 30px;max-width:520px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,0.6);">
      <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--pe);margin-bottom:10px;">⚙ Superadmin · Backfill Utility</div>
      <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:300;color:var(--bright);margin-bottom:6px;">Parent Institution Backfill</div>
      <div style="font-size:0.84rem;color:var(--muted);line-height:1.7;margin-bottom:20px;">
        Finds MMAS-8 records submitted by child PI workspaces that are missing the
        <code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-size:0.81rem;">parent_institution</code>
        field, and writes it — making those records visible on institution dashboards.
        Uses PEACS records (already correctly tagged) as the source of truth.
      </div>

      <!-- Dry run option -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:12px 14px;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.18);border-radius:8px;">
        <input type="checkbox" id="backfill-dryrun" checked style="width:16px;height:16px;accent-color:var(--pe);cursor:pointer;">
        <div>
          <div style="font-family:var(--font-mono);font-size:0.90rem;color:var(--pe);margin-bottom:2px;">Dry run mode (recommended first)</div>
          <div style="font-size:0.90rem;color:var(--muted);">Scans and counts affected records without writing to Firebase.</div>
        </div>
      </div>

      <!-- Progress area -->
      <div id="backfill-progress" style="display:none;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.86rem;color:var(--muted);margin-bottom:6px;">
          <span id="backfill-status-label">Scanning…</span>
          <span id="backfill-pct">0%</span>
        </div>
        <div style="background:rgba(255,255,255,0.06);border-radius:4px;height:5px;overflow:hidden;margin-bottom:10px;">
          <div id="backfill-bar" style="height:100%;background:var(--pe);border-radius:4px;width:0%;transition:width 0.3s ease;"></div>
        </div>
        <div id="backfill-log" style="font-family:var(--font-mono);font-size:0.86rem;color:var(--muted);line-height:1.8;max-height:180px;overflow-y:auto;background:rgba(0,0,0,0.2);border-radius:6px;padding:10px 12px;"></div>
      </div>

      <!-- Result summary -->
      <div id="backfill-result" style="display:none;padding:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;margin-bottom:18px;">
        <div id="backfill-result-text" style="font-family:var(--font-mono);font-size:0.80rem;color:var(--optimal);line-height:1.8;"></div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="backfill-cancel-btn" onclick="document.getElementById('backfill-modal').remove()" style="font-family:var(--font-mono);font-size:0.90rem;padding:8px 18px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--muted);cursor:pointer;">Cancel</button>
        <button id="backfill-run-btn" onclick="runBackfill()" style="font-family:var(--font-mono);font-size:0.90rem;padding:8px 18px;border-radius:7px;border:1px solid rgba(212,168,67,0.4);background:rgba(212,168,67,0.1);color:var(--pe);cursor:pointer;font-weight:600;">▶ Run Scan</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

/**
 * Runs the parent_institution backfill scan (and optional write) for historical MMAS records.
 * In dry-run mode (checkbox checked) only counts affected records without writing.
 * Superadmin access required.
 * @returns {Promise<void>}
 */
window.runBackfill = async function() {
  if (!isSuperAdmin()) return;

  const isDryRun  = document.getElementById('backfill-dryrun')?.checked !== false;
  const runBtn    = document.getElementById('backfill-run-btn');
  const cancelBtn = document.getElementById('backfill-cancel-btn');
  const progress  = document.getElementById('backfill-progress');
  const bar       = document.getElementById('backfill-bar');
  const pct       = document.getElementById('backfill-pct');
  const label     = document.getElementById('backfill-status-label');
  const log       = document.getElementById('backfill-log');
  const result    = document.getElementById('backfill-result');
  const resultTxt = document.getElementById('backfill-result-text');

  runBtn.disabled  = true;
  runBtn.textContent = isDryRun ? 'Scanning…' : 'Backfilling…';
  progress.style.display = 'block';
  result.style.display   = 'none';
  log.innerHTML = '';

  let cancelled = false;
  cancelBtn.textContent = 'Stop';
  cancelBtn.onclick = () => { cancelled = true; cancelBtn.textContent = 'Stopping…'; };

  function logLine(msg, color) {
    const line = document.createElement('div');
    line.style.color = color || 'var(--muted)';
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setProgress(done, total, msg) {
    const p = total > 0 ? Math.round(done / total * 100) : 0;
    bar.style.width = p + '%';
    pct.textContent = p + '%';
    if (msg) label.textContent = msg;
  }

  try {
    // ── STEP 1: Build institution_code → parent_institution map from PEACS ──
    logLine('Step 1 · Reading PEACS records to build parent map…');
    setProgress(0, 3, 'Reading PEACS…');

    const pSnap = await database.ref('peacs_assessments').once('value');
    const pAll  = pSnap.val() || {};
    const parentMap = {}; // institution_code → parent_institution
    Object.values(pAll).forEach(r => {
      if (r.institution_code && r.parent_institution) {
        parentMap[r.institution_code.toUpperCase()] = r.parent_institution.toUpperCase();
      }
    });
    const knownChildCodes = Object.keys(parentMap);
    logLine(`  Found ${knownChildCodes.length} child workspace(s) with known parent: ${knownChildCodes.join(', ') || 'none'}`,
      knownChildCodes.length ? 'var(--optimal)' : 'var(--moderate)');

    if (knownChildCodes.length === 0) {
      logLine('  No child workspaces found in PEACS. Nothing to backfill.', 'var(--moderate)');
      setProgress(3, 3, 'Done');
      resultTxt.innerHTML = 'No child workspaces identified in PEACS records.<br>If child PIs have not yet submitted any PEACS assessments, backfill cannot proceed automatically.<br><br>Alternative: use the Edit Record tool to manually set <code>parent_institution</code> on individual records.';
      result.style.display = 'block';
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Scan';
      cancelBtn.textContent = 'Close';
      cancelBtn.onclick = () => document.getElementById('backfill-modal').remove();
      return;
    }

    // ── STEP 2: Read all MMAS assessments ────────────────────────────────────
    if (cancelled) { logLine('Stopped by user.', 'var(--moderate)'); return; }
    logLine('Step 2 · Reading MMAS-8 assessments…');
    setProgress(1, 3, 'Reading MMAS-8…');

    const aSnap = await database.ref('assessments').once('value');
    const aAll  = aSnap.val() || {};
    const allEntries = Object.entries(aAll); // [fbKey, record]

    // ── STEP 3: Identify records needing backfill ─────────────────────────────
    setProgress(2, 3, 'Analysing…');
    const toFix = []; // { fbKey, institution_code, parent_institution }
    allEntries.forEach(([fbKey, r]) => {
      if (!r.institution_code) return; // no workspace — skip
      if (r.parent_institution)  return; // already has it — skip
      const code   = r.institution_code.toUpperCase();
      const parent = parentMap[code];
      if (parent) {
        toFix.push({ fbKey, institution_code: code, parent_institution: parent });
      }
    });

    // Group by institution_code for readable reporting
    const byCode = {};
    toFix.forEach(r => {
      if (!byCode[r.institution_code]) byCode[r.institution_code] = [];
      byCode[r.institution_code].push(r);
    });

    logLine(`  ${allEntries.length} total MMAS records scanned`);
    logLine(`  ${toFix.length} record(s) need parent_institution backfilled`,
      toFix.length > 0 ? 'var(--pe)' : 'var(--optimal)');
    Object.entries(byCode).forEach(([code, recs]) => {
      logLine(`    · ${code} → parent: ${parentMap[code]} (${recs.length} records)`);
    });

    if (isDryRun || toFix.length === 0) {
      setProgress(3, 3, isDryRun ? 'Dry run complete' : 'Nothing to fix');
      resultTxt.innerHTML = isDryRun
        ? `<strong>Dry run complete — no changes written.</strong><br><br>
           Records scanned: ${allEntries.length}<br>
           Records needing backfill: <strong>${toFix.length}</strong><br>
           ${toFix.length > 0
             ? `Child workspace(s): ${knownChildCodes.join(', ')}<br><br>
                Uncheck "Dry run mode" and run again to write the changes.`
             : 'All records already have <code>parent_institution</code> set. No action needed.'}`
        : 'All records already have <code>parent_institution</code>. Nothing to write.';
      result.style.display = 'block';
      result.style.background = toFix.length > 0 ? 'rgba(212,168,67,0.08)' : 'rgba(16,185,129,0.08)';
      result.style.borderColor = toFix.length > 0 ? 'rgba(212,168,67,0.3)' : 'rgba(16,185,129,0.25)';
      resultTxt.style.color = toFix.length > 0 ? 'var(--pe)' : 'var(--optimal)';
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Scan';
      cancelBtn.textContent = 'Close';
      cancelBtn.onclick = () => document.getElementById('backfill-modal').remove();
      return;
    }

    // ── STEP 4: Write updates in batches of 20 ───────────────────────────────
    logLine(`Step 3 · Writing ${toFix.length} update(s) to Firebase…`, 'var(--base)');
    const BATCH = 20;
    let written = 0, failed = 0;

    for (let i = 0; i < toFix.length; i += BATCH) {
      if (cancelled) { logLine('Stopped by user.', 'var(--moderate)'); break; }
      const batch = toFix.slice(i, i + BATCH);
      const updates = {};
      batch.forEach(r => {
        updates[`assessments/${r.fbKey}/parent_institution`] = r.parent_institution;
      });
      try {
        await database.ref().update(updates);
        written += batch.length;
        logLine(`  ✓ Wrote batch ${Math.floor(i/BATCH)+1}: ${batch.length} record(s)`, 'var(--optimal)');
      } catch(e) {
        failed += batch.length;
        logLine(`  ✗ Batch ${Math.floor(i/BATCH)+1} failed: ${e.message}`, 'var(--poor)');
      }
      setProgress(written + failed, toFix.length, `Writing… ${written + failed} / ${toFix.length}`);
      // Small pause between batches to avoid Firebase rate limits
      await new Promise(r => setTimeout(r, 150));
    }

    // ── STEP 5: Done ─────────────────────────────────────────────────────────
    setProgress(toFix.length, toFix.length, 'Complete');
    logLine(`Done. Written: ${written}  Failed: ${failed}`, written > 0 ? 'var(--optimal)' : 'var(--moderate)');

    resultTxt.innerHTML = `
      <strong>Backfill complete.</strong><br><br>
      Records updated: <strong>${written}</strong><br>
      Failures: ${failed}<br><br>
      ${written > 0 ? 'Institution dashboards will now show these records on next data refresh. Click the ↻ refresh button on the dashboard to see updated counts.' : ''}`;
    result.style.display = 'block';
    result.style.background = written > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
    result.style.borderColor = written > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
    resultTxt.style.color = written > 0 ? 'var(--optimal)' : 'var(--poor)';

    runBtn.disabled = false;
    runBtn.textContent = '↻ Run Again';
    cancelBtn.textContent = 'Close';
    cancelBtn.onclick = () => document.getElementById('backfill-modal').remove();

    // Trigger a dashboard refresh automatically if on dashboard
    if (written > 0 && typeof loadMmasCohortData === 'function') {
      setTimeout(loadMmasCohortData, 800);
    }

  } catch(e) {
    logLine('Fatal error: ' + e.message, 'var(--poor)');
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run Scan';
  }
};

// ══════════════════════════════════════════════════════════════════════════
// THE WALL — Project Memorial System
// ══════════════════════════════════════════════════════════════════════════
function _toRoman(n) {
  const map=[[20,'XX'],[19,'XIX'],[18,'XVIII'],[17,'XVII'],[16,'XVI'],[15,'XV'],[14,'XIV'],
    [13,'XIII'],[12,'XII'],[11,'XI'],[10,'X'],[9,'IX'],[8,'VIII'],[7,'VII'],[6,'VI'],
    [5,'V'],[4,'IV'],[3,'III'],[2,'II'],[1,'I']];
  for(const[v,r]of map)if(n>=v)return r;
  return String(n);
}


function openWallModal() {
  const modal = document.getElementById('wall-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  loadWallProjects();
  const sa = document.getElementById('wall-superadmin-controls');
  if (sa) sa.style.display = (typeof isSuperAdmin==='function' && isSuperAdmin()) ? 'block' : 'none';
}
function closeWallModal() {
  const m = document.getElementById('wall-modal');
  if (m) m.style.display = 'none';
  document.body.style.overflow = '';
}

function loadWallProjects() {
  const grid = document.getElementById('wall-projects-grid');
  if (!grid) return;

  // AP2026 is the hardcoded foundation stone — always Inscription I.
  const SEED = {
    name:'Adherence Project 2026',
    start:'2026-03-20', end:'2026-03-27',
    desc:'The inaugural global real-world medication adherence data collection event. Participants from every continent submitted MMAS-8 assessments in real time, building the first living map of global adherence.',
    _seed:true
  };

  // Render immediately with just the seed — no loading delay
  const AP2026_FINAL_TOTAL     = 1710;
  const AP2026_FINAL_COUNTRIES = 23;
  _renderWallTablets([SEED], AP2026_FINAL_TOTAL, AP2026_FINAL_COUNTRIES);

  // Then asynchronously append any extra wall_projects from Firebase
  const db = (typeof database !== 'undefined') ? database : null;
  if (!db) return;
  db.ref('wall_projects').orderByChild('created_at').once('value', snap => {
    const raw = snap.val();
    if (!raw) return; // no extra projects — seed is all we have
    const extra = Object.values(raw).sort((a,b)=>(a.created_at||0)-(b.created_at||0));
    if (extra.length > 0) {
      _renderWallTablets([SEED, ...extra], AP2026_FINAL_TOTAL, AP2026_FINAL_COUNTRIES);
    }
  });
}

function _renderWallTablets(projects, liveTotal, liveCountries) {
  const grid = document.getElementById('wall-projects-grid');
  if (!grid) return;
  if (!projects.length) {
    grid.innerHTML = '<div style="padding:48px 24px;text-align:center;color:rgba(255,255,255,0.15);font-family:\'IBM Plex Mono\',monospace;font-size:0.84rem;letter-spacing:0.14em;text-transform:uppercase;">The wall awaits its first inscription.</div>';
    return;
  }
  grid.innerHTML = projects.map((p, i) => {
    const num = _toRoman(i+1);
    const fmt = d => d ? new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '';
    const dateStr = [fmt(p.start), fmt(p.end)].filter(Boolean).join(' – ');
    const total = p._seed
      ? (liveTotal > 0 ? liveTotal.toLocaleString() : '—')
      : (p.total ? Number(p.total).toLocaleString() : '—');
    const countries = p._seed
      ? (liveCountries > 0 ? liveCountries.toLocaleString() : '—')
      : (p.countries ? Number(p.countries).toLocaleString() : '—');

    return `<div class="wall-tablet">
      <div class="wall-tablet-numeral">${num}</div>
      <div class="wall-tablet-name">${p.name||'Untitled'}</div>
      ${dateStr ? `<div class="wall-tablet-dates">${dateStr}</div>` : ''}
      ${p.desc ? `<div class="wall-tablet-desc">${p.desc}</div>` : ''}
      <div class="wall-tablet-stats">
        <div><div class="wall-tablet-stat-val">${total}</div><div class="wall-tablet-stat-lbl">Assessments</div></div>
        <div><div class="wall-tablet-stat-val">${countries}</div><div class="wall-tablet-stat-lbl">Countries</div></div>
      </div>
    </div>`;
  }).join('');
}

function openWallProjectEditor() {
  closeWallModal();
  const m = document.getElementById('wall-editor-modal');
  if (!m) return;
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  ['wpe-name','wpe-start','wpe-end','wpe-desc','wpe-total','wpe-countries'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const s=document.getElementById('wpe-status'); if(s) s.textContent='';
}
function closeWallEditor() {
  const m=document.getElementById('wall-editor-modal');
  if(m) m.style.display='none';
  document.body.style.overflow='';
}
function autofillWallStats() {
  const st=document.getElementById('wpe-autofill-status');
  if(st) st.textContent='Fetching…';
  const db=(typeof database!=='undefined')?database:null;
  if(!db){if(st)st.textContent='Firebase unavailable.';return;}
  db.ref('assessments').once('value',snap=>{
    const all=snap.val()?Object.values(snap.val()):[];
    const t=all.filter(r=>r.score!==undefined&&r.score!==null).length;
    const c=new Set(all.map(r=>r.country).filter(x=>x&&x!=='Unknown')).size;
    const tf=document.getElementById('wpe-total'); if(tf) tf.value=t;
    const cf=document.getElementById('wpe-countries'); if(cf) cf.value=c;
    if(st) st.textContent=`Pulled: ${t.toLocaleString()} assessments · ${c} countries`;
  });
}
async function saveWallProject() {
  const name=(document.getElementById('wpe-name')?.value||'').trim();
  const st=document.getElementById('wpe-status');
  if(!name){if(st){st.textContent='Project name required.';st.style.color='var(--poor)';}return;}
  if(st){st.textContent='Inscribing…';st.style.color='var(--muted)';}
  try{
    await database.ref('wall_projects').push({
      name,
      start:document.getElementById('wpe-start')?.value||'',
      end:document.getElementById('wpe-end')?.value||'',
      desc:(document.getElementById('wpe-desc')?.value||'').trim(),
      total:parseInt(document.getElementById('wpe-total')?.value)||0,
      countries:parseInt(document.getElementById('wpe-countries')?.value)||0,
      created_at:Date.now()
    });
    if(st){st.textContent='Inscribed.';st.style.color='var(--optimal)';}
    setTimeout(()=>{closeWallEditor();openWallModal();},900);
  }catch(e){
    if(st){st.textContent='Error: '+e.message;st.style.color='var(--poor)';}
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  const wm=document.getElementById('wall-modal');
  if(wm) wm.addEventListener('click',e=>{if(e.target===wm)closeWallModal();});
  const we=document.getElementById('wall-editor-modal');
  if(we) we.addEventListener('click',e=>{if(e.target===we)closeWallEditor();});
});
