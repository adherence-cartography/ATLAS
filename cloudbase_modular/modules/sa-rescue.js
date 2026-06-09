// sa-rescue.js — Data Rescue: render shell, scan, workspace lookup, file parse, execute migration, mark migrated
// ══════════════════════════════════════════════════════════════════════════════
// DATA RESCUE — pub_license orphan migration tool
// Recovers mapData records written by the old buggy guestPubLicUpload (source:'pub_license')
// into the assessments node under a specified workspace.
//
// Two modes:
//   Full rescue  — admin re-uploads the original Excel file; all SDoH fields,
//                  individual Q1-Q8 responses, and patient codes are recovered.
//   Score rescue — no file; only score + geo migrated from Firebase records.
// ══════════════════════════════════════════════════════════════════════════════

const _rescue = {
  orphans:       [],
  scanDone:      false,
  file:          null,
  parsedRows:    null,
  _rawRows:      null,
  _headerRowIdx: null,
  targetWs:      '',
  studyMeta:     {},
};

// ── Render shell ──────────────────────────────────────────────────────────────

function _saRenderRescue(container) {
  container.style.padding = '28px 32px';
  container.innerHTML = `
    <div style="max-width:820px;margin:0 auto;">
      <div style="font-size:0.7rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:6px;">Data Rescue</div>
      <div style="font-size:1.18rem;font-weight:700;color:${_C.text};margin-bottom:20px;">pub_license Orphan Migration</div>

      <div style="background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.22);border-radius:8px;
                  padding:16px 20px;margin-bottom:28px;font-size:0.83rem;color:${_C.muted};line-height:1.7;">
        Records uploaded via the publication-only path before the June 2026 fix were written
        to <code>mapData</code> with <code>source:'pub_license'</code> and <code>institution_code:null</code> —
        visible in the AI briefing but absent from all workspace analytics.<br><br>
        <strong style="color:${_C.amber};">Full rescue (recommended):</strong> Re-upload the original Excel file to recover all SDoH fields
        (patient code, condition, drug, gender, age, education) and individual Q1-Q8 responses.
        The orphan mapData records are then flagged <code>migrated:true</code> to prevent double-counting.<br><br>
        <strong style="color:${_C.amber};">Score rescue (fallback):</strong> If the file is unavailable, migrate existing Firebase records
        with score + country/city only — SDoH fields will be blank.
      </div>

      <!-- Step 1: Scan -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;margin-bottom:16px;">
        <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:14px;">Step 1 — Scan for orphan records</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;color:${_C.dim};display:block;margin-bottom:4px;">From date</label>
            <input id="rescue-from-date" type="date"
              style="width:100%;background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                     color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 10px;">
          </div>
          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;color:${_C.dim};display:block;margin-bottom:4px;">To date</label>
            <input id="rescue-to-date" type="date"
              style="width:100%;background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                     color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 10px;">
          </div>
          <button onclick="_saRescueScan()"
            style="padding:9px 22px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;font-weight:600;
                   letter-spacing:0.08em;border-radius:6px;cursor:pointer;white-space:nowrap;
                   background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);color:${_C.text};">
            Scan orphan records
          </button>
        </div>
        <div id="rescue-scan-result" style="margin-top:14px;display:none;"></div>
      </div>

      <!-- Step 2: Target workspace -->
      <div id="rescue-step2" style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;margin-bottom:16px;display:none;">
        <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:14px;">Step 2 — Target workspace</div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <label style="font-size:0.75rem;color:${_C.dim};display:block;margin-bottom:4px;">Workspace code</label>
            <input id="rescue-ws" placeholder="e.g. WS-ABC123" oninput="_saRescueLookupWs()"
              style="width:100%;background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                     color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.82rem;padding:8px 10px;">
          </div>
          <div id="rescue-ws-status" style="font-size:0.8rem;color:${_C.dim};padding-bottom:8px;"></div>
        </div>
      </div>

      <!-- Step 3: File (optional) -->
      <div id="rescue-step3" style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;margin-bottom:16px;display:none;">
        <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Step 3 — Upload original Excel file</div>
        <div style="font-size:0.78rem;color:${_C.muted};margin-bottom:14px;">Optional — skip for Score Rescue (score + geo only). Required for Full Rescue (all SDoH + Q values).</div>
        <label style="display:inline-flex;align-items:center;gap:8px;padding:9px 18px;
                      background:rgba(255,255,255,0.05);border:1px solid ${_C.border};border-radius:6px;
                      cursor:pointer;font-size:0.82rem;color:${_C.text};">
          <span>Choose Excel file</span>
          <input type="file" accept=".xlsx,.xlsm,.xls" style="display:none;"
            onchange="_saRescueHandleFile(this)">
        </label>
        <div id="rescue-file-status" style="margin-top:12px;font-size:0.8rem;color:${_C.dim};"></div>
        <div id="rescue-file-preview" style="margin-top:12px;display:none;"></div>
      </div>

      <!-- Step 4: Execute -->
      <div id="rescue-step4" style="background:rgba(255,255,255,0.03);border:1px solid ${_C.border};border-radius:8px;padding:20px;display:none;">
        <div style="font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:14px;">Step 4 — Execute migration</div>
        <button onclick="_saRescueExecute()"
          style="padding:10px 28px;font-family:'IBM Plex Mono',monospace;font-size:0.84rem;font-weight:700;
                 letter-spacing:0.08em;border-radius:6px;cursor:pointer;
                 background:rgba(46,201,138,0.18);border:1px solid rgba(46,201,138,0.4);color:rgba(46,201,138,0.95);">
          Execute Rescue
        </button>
        <div id="rescue-execute-status" style="margin-top:16px;font-size:0.83rem;color:${_C.dim};"></div>
      </div>
    </div>
  `;

  const now = new Date(), from = new Date(now);
  from.setDate(from.getDate() - 90);
  const fd = document.getElementById('rescue-from-date');
  const td = document.getElementById('rescue-to-date');
  if (fd) fd.value = from.toISOString().slice(0, 10);
  if (td) td.value = now.toISOString().slice(0, 10);

  Object.assign(_rescue, { orphans:[], scanDone:false, file:null, parsedRows:null,
    _rawRows:null, _headerRowIdx:null, targetWs:'', studyMeta:{} });
}

// ── Step 1: Scan ──────────────────────────────────────────────────────────────

async function _saRescueScan() {
  const resultEl = document.getElementById('rescue-scan-result');
  const fromEl   = document.getElementById('rescue-from-date');
  const toEl     = document.getElementById('rescue-to-date');
  if (!resultEl) return;

  resultEl.style.display = 'block';
  resultEl.style.color   = _C.dim;
  resultEl.textContent   = 'Scanning...';

  const fromTs = fromEl && fromEl.value ? new Date(fromEl.value).getTime() : 0;
  const toTs   = toEl && toEl.value ? new Date(toEl.value).getTime() + 86400000 : Date.now();

  try {
    const snap = await database.ref('mapData')
      .orderByChild('timestamp').startAt(fromTs).endAt(toTs).once('value');

    const orphans = [];
    snap.forEach(child => {
      const d = child.val();
      if (d && d.source === 'pub_license' && !d.migrated) {
        orphans.push({ _key: child.key, ...d });
      }
    });

    _rescue.orphans  = orphans;
    _rescue.scanDone = true;

    if (!orphans.length) {
      resultEl.style.color = 'rgba(46,201,138,0.85)';
      resultEl.textContent = 'No unmigrated pub_license orphans found in this date range.';
      return;
    }

    const countries = [...new Set(orphans.map(r => r.country).filter(Boolean))];
    const oldest = orphans.reduce((a, b) => a.timestamp < b.timestamp ? a : b, orphans[0]);
    resultEl.style.color = _C.amber;
    resultEl.innerHTML =
      'Found <strong style="color:' + _C.text + ';">' + orphans.length + '</strong> orphan record' +
      (orphans.length !== 1 ? 's' : '') + ' — ' + countries.slice(0, 6).join(', ') +
      (countries.length > 6 ? ' +more' : '') + '. Oldest: ' +
      (oldest.timestamp ? new Date(oldest.timestamp).toLocaleDateString() : '?') + '.';

    const s2 = document.getElementById('rescue-step2');
    const s3 = document.getElementById('rescue-step3');
    const s4 = document.getElementById('rescue-step4');
    if (s2) s2.style.display = '';
    if (s3) s3.style.display = '';
    if (s4) s4.style.display = '';

  } catch(e) {
    resultEl.style.color = 'rgba(239,100,80,0.9)';
    resultEl.textContent = 'Scan failed: ' + (e.message || e);
  }
}

// ── Step 2: Workspace lookup ──────────────────────────────────────────────────

async function _saRescueLookupWs() {
  const wsEl     = document.getElementById('rescue-ws');
  const statusEl = document.getElementById('rescue-ws-status');
  if (!wsEl || !statusEl) return;
  const code = wsEl.value.trim();
  _rescue.targetWs = '';
  if (!code) { statusEl.textContent = ''; return; }
  statusEl.style.color = _C.dim;
  statusEl.textContent = 'Verifying...';
  try {
    const snap = await database.ref('workspaces').orderByChild('workspace_code').equalTo(code).once('value');
    if (snap.exists()) {
      _rescue.targetWs = code;
      statusEl.style.color = 'rgba(46,201,138,0.85)';
      const ws = Object.values(snap.val())[0];
      statusEl.textContent = 'OK — ' + (ws.institution_name || ws.pi_name || code);
    } else {
      statusEl.style.color = 'rgba(239,100,80,0.85)';
      statusEl.textContent = 'Workspace not found';
    }
  } catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Lookup error';
  }
}

// ── Step 3: File parse ────────────────────────────────────────────────────────

async function _saRescueHandleFile(input) {
  const file      = input.files && input.files[0];
  const statusEl  = document.getElementById('rescue-file-status');
  const previewEl = document.getElementById('rescue-file-preview');
  if (!file || !statusEl) return;

  _rescue.file = file; _rescue.parsedRows = null;
  statusEl.style.color = _C.dim;
  statusEl.textContent = 'Reading ' + file.name + '...';

  try { await ensureSheetJS(); } catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Could not load file parser. Check your connection.'; return;
  }

  const buf = await file.arrayBuffer();
  let wb;
  try { wb = XLSX.read(buf, { type:'array', cellDates:true }); }
  catch(e) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'Could not read file — use XLSX, XLSM, or XLS.'; return;
  }

  const sheetName = wb.SheetNames.find(n =>
    n.includes('Data Entry') || n.includes('data')) || wb.SheetNames[1] || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1 });
  if (!rows.length) {
    statusEl.style.color = 'rgba(239,100,80,0.85)';
    statusEl.textContent = 'No data found in file.'; return;
  }

  const isMAP = String(rows[0]?.[0] || '').toUpperCase().includes('MAP');
  _rescue.studyMeta = {
    study_title:       String(rows[1]?.[1] || '').trim(),
    pi_name:           String(rows[2]?.[1] || '').trim(),
    study_institution: String(rows[3]?.[1] || '').trim(),
    irb_number:        String(rows[4]?.[1] || '').trim() || null,
    clinicaltrials_id: String(rows[5]?.[1] || '').trim() || null,
    study_phase:       String(rows[6]?.[1] || '').trim() || null,
  };

  let headerRowIdx = 8;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (String(rows[i]?.[0] || '').trim().toLowerCase().startsWith('country')) { headerRowIdx = i; break; }
  }
  _rescue._rawRows = rows;
  _rescue._headerRowIdx = headerRowIdx;

  const _isEx = r =>
    String(r[0] || '').toUpperCase().includes('EXAMPLE') ||
    String(r[2] || '').toUpperCase().includes('EXAMPLE');
  const dataRows = rows.slice(headerRowIdx + 1).filter(r => r && r.length >= 10 && r[0] && !_isEx(r));

  function _q8s(v) {
    if (typeof v === 'number') { const m = {0:1,1:0.75,2:0.5,3:0.25,4:0}; return m[v] !== undefined ? m[v] : 0; }
    const s = String(v).trim().toLowerCase();
    if (s === 'never/rarely' || s === 'never / rarely') return 1;
    if (s === 'never')                                   return 1;
    if (s === 'once in a while' || s === 'onceinawhile') return 0.75;
    if (s === 'rarely')                                  return 0.75;
    if (s === 'sometimes')                               return 0.5;
    if (s === 'often' || s === 'usually')                return 0.25;
    if (s === 'all of the time' || s === 'all the time' || s === 'always') return 0;
    return parseFloat(v) || 0;
  }
  function _yn(v, rev) {
    if (typeof v === 'number') return v;
    const s = String(v).trim().toUpperCase();
    return rev ? (s === 'YES' ? 1 : 0) : (s === 'NO' ? 1 : 0);
  }

  const parsed = [];
  for (const row of dataRows) {
    const [cr, ci, pn, cond, dt, dn, ds, rt, gn, ar, ed,
           _q1, _q2, _q3, _q4, _q5, _q6, _q7, _q8] = row;
    if ([_q1,_q2,_q3,_q4,_q5,_q6,_q7].some(v => v === undefined || v === null || v === '') ||
        _q8 === undefined || _q8 === null || _q8 === '') continue;
    const q1=_yn(_q1,false), q2=_yn(_q2,false), q3=_yn(_q3,false), q4=_yn(_q4,false),
          q5=_yn(_q5,true),  q6=_yn(_q6,false), q7=_yn(_q7,false), q8=_q8s(_q8);
    const rawScore = q1+q2+q3+q4+q5+q6+q7+q8;
    if (isNaN(rawScore) || rawScore < 0 || rawScore > 8) continue;
    const country = typeof normalizeCountry === 'function'
      ? normalizeCountry(String(cr || '').trim()) : String(cr || '').trim();
    const cat = typeof getAdherenceCategory === 'function'
      ? getAdherenceCategory(rawScore)
      : { label: rawScore >= 8 ? 'High Adherence' : rawScore >= 6 ? 'Medium Adherence' : 'Low Adherence' };
    parsed.push({
      country, city: String(ci || '').trim(), patient_number: String(pn || ''),
      condition: String(cond || ''), drug_type: String(dt || ''), drug_name: String(dn || ''),
      drug_strength: String(ds || ''), route_of_administration: String(rt || ''),
      gender: String(gn || ''), age_range: String(ar || ''), education_level: String(ed || ''),
      q1, q2, q3, q4, q5, q6, q7, q8,
      score: rawScore, adherence_level: cat.label, tool: isMAP ? 'map' : 'mmas',
    });
  }
  _rescue.parsedRows = parsed;

  if (previewEl && parsed.length) {
    previewEl.style.display = '';
    const sample = parsed.slice(0, 5);
    previewEl.innerHTML =
      '<div style="font-size:0.75rem;color:' + _C.dim + ';margin-bottom:8px;">Parsed <strong style="color:' + _C.text + ';">' + parsed.length + '</strong> valid rows (' + (isMAP ? 'MAP' : 'MMAS-8') + ') — showing first ' + sample.length + '</div>' +
      '<div style="overflow-x:auto;"><table style="font-size:0.72rem;font-family:IBM Plex Mono,monospace;border-collapse:collapse;width:100%;"><thead>' +
      '<tr style="color:' + _C.dim + ';border-bottom:1px solid ' + _C.border + ';"><th style="padding:4px 8px;text-align:left;">Country</th><th style="padding:4px 8px;text-align:left;">Patient#</th><th style="padding:4px 8px;text-align:left;">Condition</th><th style="padding:4px 8px;text-align:right;">Score</th><th style="padding:4px 8px;text-align:left;">Level</th></tr></thead><tbody>' +
      sample.map(r =>
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
        '<td style="padding:4px 8px;">' + (r.country || '—') + '</td>' +
        '<td style="padding:4px 8px;">' + (r.patient_number || '—') + '</td>' +
        '<td style="padding:4px 8px;">' + (r.condition || '—') + '</td>' +
        '<td style="padding:4px 8px;text-align:right;">' + r.score + '</td>' +
        '<td style="padding:4px 8px;">' + r.adherence_level + '</td></tr>'
      ).join('') +
      '</tbody></table></div>';
  }

  statusEl.style.color = 'rgba(46,201,138,0.85)';
  statusEl.textContent = 'OK — ' + file.name + ' — ' + parsed.length + ' valid rows ready.';
}

// ── Step 4: Execute ───────────────────────────────────────────────────────────

async function _saRescueExecute() {
  const statusEl = document.getElementById('rescue-execute-status');
  const setS = (msg, color) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = color || _C.dim; } };

  if (!_rescue.scanDone || !_rescue.orphans.length) {
    setS('Run the scan first (Step 1).', 'rgba(239,100,80,0.85)'); return;
  }
  if (!_rescue.targetWs) {
    setS('Enter and verify a workspace code (Step 2).', 'rgba(239,100,80,0.85)'); return;
  }

  const ws = _rescue.targetWs, orphans = _rescue.orphans, migratedAt = Date.now();
  const _db = () => typeof atlasDB === 'function' ? atlasDB('assessments') : database.ref('assessments');

  // Full rescue — file provided
  if (_rescue.parsedRows && _rescue.parsedRows.length) {
    setS('Writing ' + _rescue.parsedRows.length + ' full records to assessments...');
    let written = 0, failed = 0;
    for (const row of _rescue.parsedRows) {
      try {
        const sub = {
          ...row, ...(_rescue.studyMeta || {}),
          user_id: 'rescue_migration', timestamp: migratedAt,
          institution_code: ws, source: 'pub_license', upload_source: 'rescue_migration',
          role: 'pub_license', data_tier: 'publication', latitude: null, longitude: null,
        };
        if (row.tool !== 'map' && typeof computeMMASPE === 'function') {
          const pe = computeMMASPE(sub);
          if (pe) { sub.mmas_pe=pe.pe; sub.mmas_a=pe.a; sub.mmas_e=pe.e; sub.mmas_c=pe.c; }
        }
        if (row.tool === 'map' && typeof computeMapPE === 'function') {
          const pe = computeMapPE(sub);
          if (pe) { sub.map_pe=pe.pe; sub.map_a=pe.a; sub.map_e=pe.e; sub.map_c=pe.c; }
        }
        await _db().push(sub);
        written++;
      } catch(e) { failed++; }
    }
    setS('Flagging ' + orphans.length + ' orphan records as migrated...');
    await _saRescueMarkMigrated(orphans, ws, migratedAt);
    setS(
      'Full rescue complete — ' + written + ' records written to assessments' +
      (failed ? ', ' + failed + ' failed' : '') +
      ', ' + orphans.length + ' orphan mapData records flagged migrated.',
      'rgba(46,201,138,0.9)'
    );
    return;
  }

  // Score rescue — no file
  setS('Score rescue — writing ' + orphans.length + ' records (score + geo only)...');
  let written = 0, failed = 0;
  for (const rec of orphans) {
    try {
      await _db().push({
        user_id: 'rescue_migration', timestamp: rec.timestamp || migratedAt,
        institution_code: ws, source: 'pub_license', upload_source: 'rescue_migration',
        role: 'pub_license', data_tier: 'publication',
        tool: rec.tool || 'mmas', score: rec.score, adherence_level: rec.adherence_level,
        country: rec.country || 'Unknown', city: rec.city || '',
        latitude: rec.latitude || null, longitude: rec.longitude || null,
        study_title: rec.study_title || null, pi_name: rec.pi_name || null,
        study_institution: rec.study_institution || null, irb_number: rec.irb_number || null,
        clinicaltrials_id: rec.clinicaltrials_id || null, study_phase: rec.study_phase || null,
        // SDoH — not recoverable without the original file
        patient_number: '', condition: '', drug_type: '', drug_name: '',
        drug_strength: '', route_of_administration: '', gender: '', age_range: '', education_level: '',
      });
      written++;
    } catch(e) { failed++; }
  }
  setS('Flagging ' + orphans.length + ' orphan records as migrated...');
  await _saRescueMarkMigrated(orphans, ws, migratedAt);
  setS(
    'Score rescue complete — ' + written + ' records written' +
    (failed ? ', ' + failed + ' failed' : '') +
    ', ' + orphans.length + ' orphans flagged. SDoH fields are blank — provide the Excel file for full recovery.',
    'rgba(212,168,67,0.9)'
  );
}

// ── Mark migrated ─────────────────────────────────────────────────────────────

async function _saRescueMarkMigrated(orphans, targetWs, migratedAt) {
  const updates = {};
  for (const rec of orphans) {
    updates['mapData/' + rec._key + '/migrated']    = true;
    updates['mapData/' + rec._key + '/migrated_to'] = targetWs;
    updates['mapData/' + rec._key + '/migrated_at'] = migratedAt;
  }
  if (Object.keys(updates).length) {
    await database.ref().update(updates);
  }
}
