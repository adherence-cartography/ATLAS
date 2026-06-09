// ══════════════════════════════════════════════
// BULK UPLOAD
// ══════════════════════════════════════════════
/**
 * Shows the researcher attestation modal before proceeding with a bulk upload.
 * On confirmation, calls `processBulkUpload(file)`.
 * @param {File} file - The XLSX/CSV file selected by the researcher
 * @returns {void}
 */
function _showBulkAcknowledgement(file) {
  const existing = document.getElementById('bulk-ack-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'bulk-ack-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;max-width:520px;width:100%;padding:32px 32px 28px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--pe);margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--pe);display:inline-block;"></span>
        Data Integrity Acknowledgement
      </div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright);margin-bottom:12px;line-height:1.4;">
        Researcher Attestation Required
      </div>
      <div style="font-size:0.84rem;color:var(--text);line-height:1.7;margin-bottom:20px;">
        By uploading this file, I attest that:
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:22px;">
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <span style="color:var(--strata);flex-shrink:0;font-size:0.9rem;">1.</span>
          <span style="font-size:0.84rem;color:var(--text);line-height:1.6;">The data contained in this file was collected from real participants under informed consent or under an applicable ethics exemption, and reflects their genuine responses to the MMAS-8 instrument.</span>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <span style="color:var(--strata);flex-shrink:0;font-size:0.9rem;">2.</span>
          <span style="font-size:0.84rem;color:var(--text);line-height:1.6;">The information is true and correct to the best of my knowledge. I have not fabricated, altered, or misrepresented any participant responses.</span>
        </div>
        <div style="display:flex;gap:10px;">
          <span style="color:var(--strata);flex-shrink:0;font-size:0.9rem;">3.</span>
          <span style="font-size:0.84rem;color:var(--text);line-height:1.6;">I understand that this data will contribute to a global research dataset and that submitting false data constitutes research misconduct under applicable institutional and legal standards.</span>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;color:var(--muted);margin-bottom:20px;">
        File: <span style="color:var(--text);">${file.name}</span>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="bulk-ack-confirm" style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:var(--strata);border:none;color:#080e1a;border-radius:10px;padding:13px;cursor:pointer;font-weight:600;transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''">
          I Attest — Proceed with Upload
        </button>
        <button id="bulk-ack-cancel" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid var(--border2);color:var(--muted);border-radius:10px;padding:13px 18px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--border2)';this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">
          Cancel
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('bulk-ack-confirm').addEventListener('click', () => {
    overlay.remove();
    processBulkUpload(file);
  });
  document.getElementById('bulk-ack-cancel').addEventListener('click', () => {
    overlay.remove();
  });
}

/**
 * Opens the drag-and-drop bulk upload modal (`#dnd-bulk-modal`).
 * Falls back to triggering the legacy hidden file-input if the modal is not found.
 * @returns {void}
 */
function openBulkUpload() {
  // Open the new drag-and-drop upload modal
  const modal = document.getElementById('dnd-bulk-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.scrollTop = 0;
    // Re-initialise Lucide icons inside the modal
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    // Fallback to legacy hidden-input click if modal not found
    document.getElementById('bulk-file-input').value = '';
    document.getElementById('bulk-file-input').click();
  }
}



/**
 * Processes a bulk-upload file (XLSX or CSV) using SheetJS.
 * Parses patient records, validates required columns, writes each valid record to Firebase,
 * and shows a progress modal during upload.
 * @param {File} file - The XLSX or CSV file to upload
 * @returns {Promise<void>}
 */
async function processBulkUpload(file) {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const modal     = document.getElementById('bulk-modal');
  const titleEl   = document.getElementById('bulk-modal-title');
  const msgEl     = document.getElementById('bulk-modal-msg');
  const progBar   = document.getElementById('bulk-progress-bar');
  const progLabel = document.getElementById('bulk-progress-label');
  const closeBtn  = document.getElementById('bulk-modal-close');

  modal.style.display = 'flex';
  titleEl.textContent = _t.upload_reading_file || 'Reading file…';
  msgEl.textContent   = _t.upload_parsing || 'Parsing your Excel template.';
  progBar.style.width = '0%';
  closeBtn.style.display = 'none';

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      await ensureSheetJS();
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type:'array' });

      // Try named sheets first, then fall back to sheet index 1 or 0
      const sheetName = workbook.SheetNames.find(n =>
        n.includes('Data Entry') || n.includes('📊') || n.includes('data')
      ) || workbook.SheetNames[1] || workbook.SheetNames[0];

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header:1 });

      // ── Extract study metadata from header rows (v2 template) ──────────────
      const studyMeta = {
        study_title:       String(rows[1]?.[1] || '').trim(),
        pi_name:           String(rows[2]?.[1] || '').trim(),
        study_institution: String(rows[3]?.[1] || '').trim(),
        irb_number:        String(rows[4]?.[1] || '').trim(),
        clinicaltrials_id: String(rows[5]?.[1] || '').trim(),
        study_phase:       String(rows[6]?.[1] || '').trim(),
      };

      const metaErrors = [];
      if (!studyMeta.study_title)       metaErrors.push('Study Title (cell B2) is required');
      if (!studyMeta.pi_name)           metaErrors.push('Principal Investigator (cell B3) is required');
      if (!studyMeta.study_institution) metaErrors.push('Institution (cell B4) is required');
      if (metaErrors.length) {
        titleEl.textContent = 'Study information missing';
        msgEl.innerHTML = '<span style="color:#f59e0b;">Please fill in the Study Information section before uploading:</span><br/><br/>' +
          metaErrors.map(m => `• ${m}`).join('<br/>') +
          '<br/><br/><span style="color:var(--muted);font-size:0.85em;">Download the v2 template using the ↓ Template button and fill in rows 2–4.</span>';
        progBar.style.background = 'var(--poor)';
        closeBtn.style.display = 'block'; closeBtn.textContent = 'Close';
        closeBtn.onclick = () => { modal.style.display='none'; };
        return;
      }

      // Dynamically locate the column-header row (contains 'Country' in col 0)
      // so we tolerate SheetJS skipping the empty separator row in the template.
      let headerRowIdx = 8; // safe fallback (template spec)
      for (let _i = 0; _i < Math.min(rows.length, 15); _i++) {
        if (String(rows[_i]?.[0] || '').trim().toLowerCase().startsWith('country')) {
          headerRowIdx = _i;
          break;
        }
      }

      // EXAMPLE detection: check col 0 (old template) OR col 2 / patient ID (new template)
      const _isExampleRow = row =>
        String(row[0]||'').toUpperCase().includes('EXAMPLE') ||
        String(row[2]||'').toUpperCase().includes('EXAMPLE');
      const candidateRows = rows.slice(headerRowIdx + 1).filter(row =>
        row && row.length >= 10 &&
        row[0] &&
        !_isExampleRow(row)
      );

      if (!candidateRows.length) {
        titleEl.textContent = _t.upload_no_data || 'No data found';
        msgEl.textContent   = _t.upload_no_valid_rows || 'No valid data rows were found. Make sure patient rows begin at row 11 of the Data Entry sheet.';
        progBar.style.background = 'var(--poor)';
        closeBtn.style.display = 'block';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => { modal.style.display='none'; };
        return;
      }

      // ── PRE-VALIDATION: full row-level check before any Firebase writes ──
      // MMAS-8 Q8 options: "Never/Rarely" (combined) | "Once in a while" | "Sometimes" | "Usually" | "All of the time"
      // MAP Q8 options:    "Never" | "Rarely" | "Sometimes" | "Often" | "All of the time"
      const VALID_Q8_FREQS = ['never/rarely','never / rarely','never','once in a while','onceinawhile',
                              'rarely','sometimes','often','usually','all of the time','all the time','always'];
      const rowErrors = [];
      const validRows = [];

      candidateRows.forEach((row, idx) => {
        const rowNum = idx + headerRowIdx + 2; // 1-indexed, offset by detected header position
        const errors = [];
        const country = row[0]; const city = row[1];
        const _q1=row[11],_q2=row[12],_q3=row[13],_q4=row[14],_q5=row[15],_q6=row[16],_q7=row[17],_q8=row[18];

        if (!country || String(country).trim() === '') errors.push('missing Country');

        // Validate Q1–Q7 (must be YES/NO or 0/1)
        [[_q1,'Q1'],[_q2,'Q2'],[_q3,'Q3'],[_q4,'Q4'],[_q5,'Q5'],[_q6,'Q6'],[_q7,'Q7']].forEach(([v,qn]) => {
          if (v === undefined || v === null || v === '') { errors.push(`${qn} missing`); return; }
          if (typeof v === 'number') { if (v !== 0 && v !== 1) errors.push(`${qn} must be 0 or 1, got ${v}`); return; }
          const s = String(v).trim().toUpperCase();
          if (s !== 'YES' && s !== 'NO') errors.push(`${qn} invalid value "${v}" (expected YES/NO or 0/1)`);
        });

        // Validate Q8 frequency
        if (_q8 === undefined || _q8 === null || _q8 === '') {
          errors.push('Q8 missing');
        } else if (typeof _q8 !== 'number') {
          const s8 = String(_q8).trim().toLowerCase();
          if (!VALID_Q8_FREQS.includes(s8)) errors.push(`Q8 unrecognised frequency "${_q8}" (use: ${VALID_Q8_FREQS.slice(0,4).join('/')}…)`);
        }

        if (errors.length) {
          rowErrors.push({ rowNum, errors });
        } else {
          validRows.push(row);
        }
      });

      // If ANY rows failed pre-validation, show error modal before writing anything
      if (rowErrors.length) {
        titleEl.textContent = `${rowErrors.length} row${rowErrors.length>1?'s':''} failed validation`;
        const validCount = validRows.length;
        msgEl.innerHTML = `<span style="color:#f59e0b;">${rowErrors.length} row${rowErrors.length>1?'s':''} have errors and will not be uploaded.</span>${validCount ? ` <span style="color:#10b981;">${validCount} valid row${validCount>1?'s':''} ready to upload.</span>` : ' <span style="color:#ef4444;">No valid rows found.</span>'}`;
        const errorHTML = rowErrors.map(e => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:#f59e0b;">Row ${e.rowNum}:</span> <span style="font-size:0.88rem;color:var(--muted);">${e.errors.join(' · ')}</span></div>`).join('');
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'max-height:180px;overflow-y:auto;background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 14px;margin:12px 0;text-align:left;';
        errorBox.innerHTML = errorHTML;
        msgEl.after(errorBox);
        progBar.style.background = 'var(--poor)';
        closeBtn.style.display = 'block';
        if (!validCount) {
          closeBtn.textContent = 'Close';
          closeBtn.onclick = () => { modal.style.display='none'; errorBox.remove(); };
          return;
        }
        // Offer to upload only valid rows
        const uploadValidBtn = document.createElement('button');
        uploadValidBtn.textContent = `Upload ${validCount} valid row${validCount>1?'s':''} anyway`;
        uploadValidBtn.style.cssText = 'margin-top:12px;margin-right:10px;font-family:var(--font-mono);font-size:0.71rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.4);color:#2ec98a;border-radius:var(--r);padding:10px 20px;cursor:pointer;';
        closeBtn.textContent = 'Cancel';
        closeBtn.onclick = () => { modal.style.display='none'; errorBox.remove(); uploadValidBtn.remove(); };
        closeBtn.style.display = 'block';
        closeBtn.after(uploadValidBtn);
        uploadValidBtn.onclick = async () => {
          uploadValidBtn.remove(); errorBox.remove();
          await runBulkUploads(validRows, studyMeta);
        };
        return;
      }

      await runBulkUploads(validRows, studyMeta);

    } catch(err) {
      console.error('[bulk]', err);
      titleEl.textContent = _t.upload_failed || 'Upload failed';
      const _errMsg = err?.message || String(err) || '';
      if (_errMsg.toLowerCase().includes('load') || _errMsg.toLowerCase().includes('script') || _errMsg.toLowerCase().includes('cdn')) {
        msgEl.textContent = 'Could not load the Excel parser library. Please check your internet connection and try again.';
      } else if (_errMsg) {
        msgEl.textContent = 'Could not parse the file: ' + _errMsg + '. Please use the official ATLAS Excel template.';
      } else {
        msgEl.textContent = 'Could not parse the file. Please use the official ATLAS Excel template.';
      }
      progBar.style.background = 'var(--poor)';
      closeBtn.style.display   = 'block';
      closeBtn.textContent     = 'Close';
      closeBtn.onclick = () => { modal.style.display='none'; };
    }
  };
  reader.readAsArrayBuffer(file);

  // ── Hoisted outside try/catch so Firebase errors surface correctly ──
  async function runBulkUploads(rowsToUpload, studyMeta) {
      const total = rowsToUpload.length;
      // Stagger writes so live spectators see dots appear one by one
      const delay = total <= 20 ? 800 : total <= 100 ? 400 : 150;

      titleEl.textContent = 'Uploading ' + total + ' records…';
      msgEl.textContent   = _t.upload_geocoding || 'Geocoding locations and writing to the live map.';

      let uploaded = 0, skipped = 0;

      for (const row of rowsToUpload) {
        const [country, city, patientNum, condition, drugType, drugName,
               drugStrength, route, gender, ageRange, education,
               _q1, _q2, _q3, _q4, _q5, _q6, _q7, _q8freq] = row;

        function yesno(v, reversed) {
          if (typeof v === 'number') return v;
          const s = String(v).trim().toUpperCase();
          return reversed ? (s==='YES'?1:s==='NO'?0:0) : (s==='NO'?1:s==='YES'?0:0);
        }
        function q8score(v) {
          if (typeof v === 'number') {
            const indexMap = { 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0 };
            return indexMap[v] !== undefined ? indexMap[v] : 0;
          }
          const s = String(v).trim().toLowerCase();
          if (s==='never/rarely'||s==='never / rarely')     return 1;    // MMAS-8 combined option
          if (s==='never')                                  return 1;    // MAP standalone Never
          if (s==='once in a while'||s==='onceinawhile')    return 0.75; // MMAS-8
          if (s==='rarely')                                 return 0.75; // MAP standalone Rarely
          if (s==='sometimes')                              return 0.5;
          if (s==='often'||s==='usually')                   return 0.25;
          if (s==='all of the time'||s==='all the time'||s==='always') return 0;
          return parseFloat(v) || 0;
        }

        const q1=yesno(_q1,false), q2=yesno(_q2,false), q3=yesno(_q3,false),
              q4=yesno(_q4,false), q5=yesno(_q5,true),  q6=yesno(_q6,false),
              q7=yesno(_q7,false), q8=q8score(_q8freq);
        const total_score = q1+q2+q3+q4+q5+q6+q7+q8;
        const cat = getAdherenceCategory(total_score);

        // Nominatim usage policy: max 1 req/sec. Enforce a 1100ms floor between geocode calls.
        let lat=0, lng=0;
        try {
          const geo = await fetch(
            'https://nominatim.openstreetmap.org/search?city='+encodeURIComponent(city||'')+
            '&country='+encodeURIComponent(country)+'&format=json&limit=1',
            { headers: { 'User-Agent': 'ATLAS-AdherenceProject/2026' } }
          );
          const gd = await geo.json();
          if (gd.length > 0) { lat=parseFloat(gd[0].lat); lng=parseFloat(gd[0].lon); }
          // Enforce Nominatim rate limit (1 req/sec min) regardless of row delay setting
          await new Promise(r => setTimeout(r, 1100));
        } catch(ge) {}

        const submission = {
          user_id:         getUserId(),
          timestamp:       Date.now(),
          score:           total_score,
          adherence_level: cat.label,
          country:         normalizeCountry(String(country||'')),
          city:            String(city||''),
          latitude:        lat, longitude: lng,
          patient_number:  String(patientNum||''),
          condition:       String(condition||''),
          drug_type:       String(drugType||''),
          drug_name:       String(drugName||''),
          drug_strength:   String(drugStrength||''),
          route_of_administration: String(route||''),
          gender:          String(gender||''),
          age_range:       String(ageRange||''),
          education_level: String(education||''),
          role:            'researcher',
          data_tier:       'clinical',
          q1,q2,q3,q4,q5,q6,q7,q8,
          // Study provenance
          study_title:       studyMeta.study_title,
          pi_name:           studyMeta.pi_name,
          study_institution: studyMeta.study_institution,
          irb_number:        studyMeta.irb_number   || null,
          clinicaltrials_id: studyMeta.clinicaltrials_id || null,
          study_phase:       studyMeta.study_phase  || null,
          upload_source:     'bulk',
        };
        if (currentWorkspace) {
          submission.institution_code = currentWorkspace;
          // Tag with parent_institution so institution dashboards can roll up child PI data
          if (workspaceProfile && workspaceProfile.parent_institution) {
            submission.parent_institution = workspaceProfile.parent_institution;
          }
          // Tag with parent_pi so PI dashboards can see their assigned students
          if (workspaceProfile && workspaceProfile.parent_pi) {
            submission.parent_pi = workspaceProfile.parent_pi;
          }
        }
        // Tag with active campaign if one is running at upload time
        const _bulkCamp = detectActiveCampaign();
        if (_bulkCamp) {
          submission.campaign_id = _bulkCamp.id;
        }
        // Compute & store MMAS-8 PE domain scores
        const _bPE = computeMMASPE(submission);
        if (_bPE) { submission.mmas_pe = _bPE.pe; submission.mmas_a = _bPE.a; submission.mmas_e = _bPE.e; submission.mmas_c = _bPE.c; }

        try {
          await atlasDB('assessments').push(submission);
          // Guard against 0,0 null-island when Nominatim returns no result
          const bulkHasCoords = lat !== 0 || lng !== 0;
          await database.ref('mapData').push({
            score:           total_score,
            adherence_level: cat.label,
            latitude:  bulkHasCoords ? lat : null,
            longitude: bulkHasCoords ? lng : null,
            country: normalizeCountry(String(country||'')),
            city:    String(city||''),
            timestamp: submission.timestamp,
            campaign_id: _bulkCamp ? _bulkCamp.id : null,
            // Study provenance for map popups
            study_title:       studyMeta.study_title,
            pi_name:           studyMeta.pi_name,
            study_institution: studyMeta.study_institution,
            irb_number:        studyMeta.irb_number   || null,
            clinicaltrials_id: studyMeta.clinicaltrials_id || null,
          });
          updatePublicStats(total_score, normalizeCountry(String(country||'')));
          uploaded++;
        } catch(fe) {
          skipped++;
        }

        // Update progress
        progBar.style.width = Math.round((uploaded+skipped)/total*100) + '%';
        progLabel.textContent = (uploaded+skipped) + ' / ' + total + ' records';

        if (uploaded+skipped < total) await new Promise(r=>setTimeout(r, delay));
      }

      // Done
      titleEl.textContent = '✓ Upload complete';
      msgEl.textContent   = uploaded + ' records submitted to the live map' +
        (skipped > 0 ? ' · ' + skipped + ' skipped due to errors.' : '.');
      progBar.style.width      = '100%';
      progBar.style.background = '#10b981';
      progLabel.textContent    = uploaded + ' / ' + total + ' uploaded';
      closeBtn.style.display   = 'block';
      closeBtn.textContent     = 'Done — Refresh Dashboard';

      // Capture upload stats for publication license flow
      const _uploadedCount = uploaded;
      const _uploadRows    = rowsToUpload || [];
      window._lastBulkUpload = {
        n: _uploadedCount,
        dateRange: (function() {
          try {
            const dates = _uploadRows.map(r => r.timestamp || r.date || r.Date || '').filter(Boolean).sort();
            if (!dates.length) return null;
            const fmt = d => { try { return new Date(d).toLocaleDateString('en-US', {month:'short',year:'numeric'}); } catch(e) { return d; } };
            return fmt(dates[0]) + (dates.length > 1 && dates[0] !== dates[dates.length-1] ? ' – ' + fmt(dates[dates.length-1]) : '');
          } catch(e) { return null; }
        })(),
        countries: (function() {
          try {
            const cs = [...new Set(_uploadRows.map(r => r.country || r.Country || '').filter(Boolean))];
            return cs.length ? cs.join(', ') : null;
          } catch(e) { return null; }
        })(),
      };

      closeBtn.onclick = () => {
        modal.style.display = 'none';
        loadMmasCohortData();
        // Offer publication license flow after patients hit the map
        if (_uploadedCount >= 10) {
          setTimeout(() => openPubLicenseFlow(window._lastBulkUpload), 1400);
        }
      };
      showToast('Bulk upload complete — '+uploaded+' records.', 4000);
      // Record this batch in history for rollback capability
      recordBatchUpload(
        file && file.name ? file.name : 'upload.xlsx',
        uploaded,
        (typeof workspaceProfile !== 'undefined' && workspaceProfile?.email) || (typeof firebase !== 'undefined' && firebase.auth()?.currentUser?.email) || 'Admin',
        [] // batchIds — push keys not captured in legacy flow; upgrade to collect if needed
      );
  } // end runBulkUploads

} // end processBulkUpload

// ── Drag-and-Drop Bulk Upload ─────────────────────────

let _dndParsedRows = [];
let _dndImportTool = 'mmas'; // default to MMAS-8

function setDndImportTool(tool) {
  _dndImportTool = tool;
  const mmasBtn = document.getElementById('dnd-tool-mmas');
  const mapBtn  = document.getElementById('dnd-tool-map');
  const eyebrow = document.getElementById('dnd-modal-eyebrow');
  const warning = document.getElementById('dnd-tool-warning');
  const tmplBtn  = document.getElementById('dnd-template-btn');
  const step2txt = document.getElementById('dnd-step2-instructions');
  if (tool === 'mmas') {
    if (mmasBtn) { mmasBtn.style.background='rgba(78,156,245,0.18)'; mmasBtn.style.borderColor='rgba(78,156,245,0.55)'; mmasBtn.style.color='rgba(78,156,245,0.95)'; }
    if (mapBtn)  { mapBtn.style.background='rgba(0,0,0,0)'; mapBtn.style.borderColor='rgba(255,255,255,0.15)'; mapBtn.style.color='rgba(255,255,255,0.4)'; }
    if (eyebrow) eyebrow.textContent = 'Import · MMAS-8 Data';
    if (warning) warning.innerHTML = 'Records tagged as <strong style="color:#ef4444;">MMAS-8</strong> will be stored with <code style="font-size:0.68rem;color:#9ca3af;">tool:"mmas"</code> — they will never appear in MAP metrics.';
    if (tmplBtn) tmplBtn.textContent = '↓ Download MMAS-8 Template (.csv)';
    if (step2txt) step2txt.innerHTML = 'Fill in each patient row: <strong style="color:#cdd8e8;">Yes / No</strong> for Q1–Q7, and <strong style="color:#cdd8e8;">Never/Rarely | Once in a while | Sometimes | Usually | All the time</strong> for Q8 (MMAS-8). Save the file, then upload below.';
  } else {
    if (mapBtn)  { mapBtn.style.background='rgba(46,201,138,0.18)'; mapBtn.style.borderColor='rgba(46,201,138,0.55)'; mapBtn.style.color='rgba(46,201,138,0.95)'; }
    if (mmasBtn) { mmasBtn.style.background='rgba(0,0,0,0)'; mmasBtn.style.borderColor='rgba(255,255,255,0.15)'; mmasBtn.style.color='rgba(255,255,255,0.4)'; }
    if (eyebrow) eyebrow.textContent = 'Import · MAP Data';
    if (warning) warning.innerHTML = 'Records tagged as <strong style="color:#10b981;">MAP</strong> will be stored with <code style="font-size:0.68rem;color:#9ca3af;">tool:"map"</code> — they will never appear in MMAS-8 metrics. Columns: MAP_Q1–MAP_Q8.';
    if (tmplBtn) tmplBtn.textContent = '↓ Download MAP Template (.xlsm)';
    if (step2txt) step2txt.innerHTML = 'Fill in each patient row: <strong style="color:#cdd8e8;">Yes / No</strong> for Q1–Q7, and <strong style="color:#cdd8e8;">Never | Rarely | Sometimes | Often | All of the time</strong> for Q8 (MAP frequency scale). Save the file, then upload below.';
  }
  // Re-validate if file already loaded
  if (_dndParsedRows.length > 0 || document.getElementById('dnd-validation-grid')?.style.display !== 'none') {
    const zone = document.getElementById('dnd-zone');
    const inp = zone?.querySelector('input[type=file]');
    if (inp?.files?.length) { const e = {target:inp}; dndFileChosen(e); }
  }
}

function dndDragOver(e) {
  e.preventDefault();
  document.getElementById('dnd-zone')?.classList.add('drag-over');
}
function dndDragLeave(e) {
  document.getElementById('dnd-zone')?.classList.remove('drag-over');
}
function dndDrop(e) {
  e.preventDefault();
  document.getElementById('dnd-zone')?.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) dndProcessFile(file);
}
function dndFileChosen(e) {
  const file = e.target?.files?.[0];
  if (file) dndProcessFile(file);
}

async function dndProcessFile(file) {
  const nameEl = document.getElementById('dnd-file-name');
  if (nameEl) nameEl.textContent = file.name;
  if (!file.name.endsWith('.csv')) {
    try { await ensureSheetJS(); } catch(e) { console.error('SheetJS load failed:', e); }
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    let rows = [];
    try {
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(evt.target.result);
        const lines = text.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
        const headers = lines[0].map(h => h.toLowerCase().replace(/\s+/g,'_'));
        rows = lines.slice(1).filter(l => l.some(c => c)).map(l => {
          const obj = {};
          headers.forEach((h, i) => obj[h] = l[i] || '');
          return obj;
        });
      } else {
        const wb = XLSX.read(evt.target.result, {type:'array'});
        // Find the data sheet — prefer "Data Entry", fall back to sheet[1] then sheet[0]
        const sheetName = wb.SheetNames.find(n =>
          n.toLowerCase().includes('data entry') || n.includes('📊') || n.toLowerCase().includes('data')
        ) || wb.SheetNames[1] || wb.SheetNames[0];
        const rawSheet = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, defval:''});

        // Locate the column-header row (first row where col 0 starts with 'country')
        let hdrIdx = -1;
        for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
          if (String(rawSheet[i][0]||'').trim().toLowerCase().startsWith('country')) { hdrIdx = i; break; }
        }
        if (hdrIdx < 0) { rows = []; }
        else {
          // Find each column's index by matching header text — handles any column order or long labels
          const hdrRow = rawSheet[hdrIdx];
          const norm = s => String(s||'').toLowerCase().replace(/[\s\-—_#*?()]+/g,'');
          const findColIdx = (...terms) => {
            for (let c = 0; c < hdrRow.length; c++) {
              const h = norm(hdrRow[c]);
              for (const t of terms) { if (h.startsWith(norm(t))) return c; }
            }
            return -1;
          };
          const cCountry   = findColIdx('country');
          const cCity      = findColIdx('city','town','municipality');
          const cPatient   = findColIdx('patient','participantid','patientid','patno','userid','id');
          const cCondition = findColIdx('condition','diagnosis','medicalcondition');
          const cDrugType  = findColIdx('drugtype','drugclass','medicationtype','medtype');
          const cDrugName  = findColIdx('drugname','medicationname','medication');
          const cDrugStr   = findColIdx('drugstrength','strength','dose');
          const cRoute     = findColIdx('route','routeofadministration');
          const cGender    = findColIdx('gender','sex');
          const cAge       = findColIdx('age','agerange');
          const cEduc      = findColIdx('education');
          const cQ = [1,2,3,4,5,6,7,8].map(n => findColIdx(`q${n}`,'mmasq'+n,'mapq'+n,'mq'+n));

          const _isExRow = row => row.some(c => String(c||'').toUpperCase().includes('EXAMPLE'));
          rows = rawSheet.slice(hdrIdx + 1)
            .filter(row => row && row.some(c => c !== '') && !_isExRow(row))
            .map(row => ({
              country:    cCountry   >= 0 ? String(row[cCountry]  ||'').trim() : '',
              city:       cCity      >= 0 ? String(row[cCity]     ||'').trim() : '',
              condition:  cCondition >= 0 ? String(row[cCondition]||'').trim() : '',
              patient:    cPatient   >= 0 ? String(row[cPatient]  ||'').trim() : '',
              drugtype:   cDrugType  >= 0 ? String(row[cDrugType] ||'').trim() : '',
              drugname:   cDrugName  >= 0 ? String(row[cDrugName] ||'').trim() : '',
              drugstrength: cDrugStr >= 0 ? String(row[cDrugStr]  ||'').trim() : '',
              route:      cRoute     >= 0 ? String(row[cRoute]    ||'').trim() : '',
              gender:     cGender    >= 0 ? String(row[cGender]   ||'').trim() : '',
              age:        cAge       >= 0 ? String(row[cAge]      ||'').trim() : '',
              education:  cEduc      >= 0 ? String(row[cEduc]     ||'').trim() : '',
              q1: cQ[0]>=0 ? String(row[cQ[0]]||'').trim() : '',
              q2: cQ[1]>=0 ? String(row[cQ[1]]||'').trim() : '',
              q3: cQ[2]>=0 ? String(row[cQ[2]]||'').trim() : '',
              q4: cQ[3]>=0 ? String(row[cQ[3]]||'').trim() : '',
              q5: cQ[4]>=0 ? String(row[cQ[4]]||'').trim() : '',
              q6: cQ[5]>=0 ? String(row[cQ[5]]||'').trim() : '',
              q7: cQ[6]>=0 ? String(row[cQ[6]]||'').trim() : '',
              q8: cQ[7]>=0 ? String(row[cQ[7]]||'').trim() : '',
            }))
            .filter(r => Object.values(r).some(v => v !== ''));
        }
      }
    } catch(err) { console.error('DnD parse error:', err); return; }
    dndValidateRows(rows);
  };
  reader.readAsArrayBuffer(file);
}

function dndValidateRows(rawRows) {
  _dndParsedRows = [];
  const tbody = document.getElementById('dnd-val-tbody');
  const grid = document.getElementById('dnd-validation-grid');
  const summary = document.getElementById('dnd-summary-bar');
  const submitBtn = document.getElementById('dnd-submit-btn');
  if (!tbody) return;
  let validCount = 0, errorCount = 0;
  const html = [];
  rawRows.forEach((row, idx) => {
    const errors = [];
    const get = (...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_#]+/g,'') === k.toLowerCase().replace(/[\s_#]+/g,''));
        if (found && row[found] !== '' && row[found] !== undefined) return String(row[found]).trim();
      }
      return '';
    };
    const country   = get('country') || 'Unknown';
    const condition = get('condition','medicalcondition','diagnosis');
    const patNum = get('patientno','patientnumber','patient','patno','userid','id');
    const isMAPImport = _dndImportTool === 'map';
    let q1,q2,q3,q4,q5,q6,q7,q8;
    if (isMAPImport) {
      q1=get('map_q1','mapq1','mq1'); q2=get('map_q2','mapq2','mq2');
      q3=get('map_q3','mapq3','mq3'); q4=get('map_q4','mapq4','mq4');
      q5=get('map_q5','mapq5','mq5'); q6=get('map_q6','mapq6','mq6');
      q7=get('map_q7','mapq7','mq7'); q8=get('map_q8','mapq8','mq8');
    } else {
      q1=get('q1'); q2=get('q2'); q3=get('q3'); q4=get('q4');
      q5=get('q5'); q6=get('q6'); q7=get('q7'); q8=get('q8');
    }
    if (!condition) errors.push('Missing condition');
    [q1,q2,q3,q4,q5,q6,q7].forEach((q,i) => {
      const label = isMAPImport ? `MAP_Q${i+1}` : `Q${i+1}`;
      if (q==='') errors.push(`${label} missing`);
      else if (!['0','1','yes','no','y','n'].includes(q.toLowerCase())) errors.push(`${label} invalid`);
    });
    if (q8==='') errors.push(isMAPImport?'MAP_Q8 missing':'Q8 missing');
    else if (isMAPImport) {
      // MAP Q8: "In a typical week, how often do you have trouble taking all your medications as prescribed?"
      // 5-point Likert: Never | Rarely | Sometimes | Often | All of the time
      if (!['0','0.25','0.5','0.75','1','never','rarely','sometimes','often','all the time','all of the time'].includes(q8.toLowerCase().trim()))
        errors.push('MAP_Q8 invalid — expected: Never | Rarely | Sometimes | Often | All of the time');
    } else if (!['0','0.25','0.5','0.75','1',
      'never','rarely','never/rarely','never / rarely',
      'once in a while','onceinawhile',
      'sometimes',
      'often','usually',
      'always','all the time','all of the time'
    ].includes(q8.toLowerCase().trim())) errors.push('Q8 invalid — expected: Never/Rarely | Once in a while | Sometimes | Usually | All the time');
    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
      if (isMAPImport) {
        const toBool = v => { const s=String(v||'').toLowerCase(); return (s==='yes'||s==='1')?1:0; };
        // MAP Q8 is a 5-point Likert (same scoring as MMAS Q8): Never=1, Rarely=0.75, Sometimes=0.5, Often=0.25, All of the time=0
        const mapQ8Score = v => { const s=String(v||'').toLowerCase().trim(); const m={'never':1,'1':1,'rarely':0.75,'0.75':0.75,'sometimes':0.5,'0.5':0.5,'often':0.25,'0.25':0.25,'all the time':0,'all of the time':0,'0':0}; return m[s]??0; };
        const mq = [q1,q2,q3,q4,q5,q6,q7].map(toBool);
        const mq8 = mapQ8Score(q8);
        const score = (mq.reduce((a,b)=>a+b,0) + mq8).toFixed(2);
        const arch = ((mq[1]+mq[2]+mq[5])/3);
        const exec = ((mq[0]+mq[4]+mq8)/3);                        // Execution: Q1, Q5, Q8
        const ctx  = 0.5 + 0.5*((mq[3]+mq[6])/2);                // Context-Guard: 0.5+0.5×mean(Q4,Q7)
        const pe   = Math.pow(Math.max(0,arch*exec*ctx),1/3).toFixed(4);
        _dndParsedRows.push({tool:'map',patient_number:patNum||`ROW-${idx+2}`,country,condition,
          map_q1:q1,map_q2:q2,map_q3:q3,map_q4:q4,map_q5:q5,map_q6:q6,map_q7:q7,map_q8:q8,
          score,arch_score:arch.toFixed(4),exec_score:exec.toFixed(4),ctx_score:ctx.toFixed(4),pe_score:pe,
          gender:get('gender'),age_range:get('age','agerange'),education:get('education','educationlevel')});
      } else {
        const score = dndComputeScore(q1,q2,q3,q4,q5,q6,q7,q8);
        _dndParsedRows.push({tool:'mmas',patient_number:patNum||`ROW-${idx+2}`,
          country, city:get('city','town'), condition,
          q1,q2,q3,q4,q5,q6,q7,q8, score,
          gender:get('gender'),age_range:get('age','agerange'),education:get('education','educationlevel'),
          drug_type:get('drugtype','drugclass','medicationtype'),
          drug_name:get('drugname','medicationname','medication'),
          drug_strength:get('drugstrength','strength','dose'),
          route_of_administration:get('route','routeofadministration')});
      }
    } else { errorCount++; }
    const qSummary = [q1,q2,q3,q4,q5,q6,q7,q8].map(q=>q||'?').join(' ');
    html.push(`<tr class="${isValid?'dnd-row-valid':'dnd-row-error'}">
      <td class="dnd-row-num">${idx+2}</td>
      <td class="dnd-row-status">${isValid?'&#10003;':'&#10007;'}</td>
      <td style="font-weight:600;">${patNum||'&mdash;'}</td>
      <td>${country}</td><td>${condition||'&mdash;'}</td>
      <td style="font-family:monospace;font-size:0.68rem;">${qSummary}</td>
      <td class="dnd-error-msg">${errors.join(', ')}</td></tr>`);
  });
  tbody.innerHTML = html.join('') || '<tr><td colspan="7" style="color:#9ca3af;padding:12px;">No data rows found.</td></tr>';
  if (grid) grid.style.display = 'block';
  if (summary) summary.style.display = 'flex';
  const vc=document.getElementById('dnd-valid-count'); if(vc) vc.textContent=`${validCount} valid`;
  const ec=document.getElementById('dnd-error-count'); if(ec) ec.textContent=`${errorCount} errors`;
  const sc=document.getElementById('dnd-submit-count'); if(sc) sc.textContent=validCount;
  if (submitBtn) submitBtn.classList.toggle('visible', validCount > 0);
}

function dndComputeScore(q1,q2,q3,q4,q5,q6,q7,q8) {
  const boolScore  = v => { const s=String(v||'').toLowerCase(); return (s==='no'||s==='0')?1:0; };
  const boolScoreR = v => { const s=String(v||'').toLowerCase(); return (s==='yes'||s==='1')?1:0; };
  // MMAS-8: "Never/Rarely" (combined)=1, "Once in a while"=0.75, "Sometimes"=0.5, "Usually"=0.25, "All of the time"=0
  // MAP:    "Never"=1, "Rarely"=0.75, "Sometimes"=0.5, "Often"=0.25, "All of the time"=0
  const q8map = {'never/rarely':1,'never / rarely':1,'never':1,'0':1,
                 'rarely':0.75,'once in a while':0.75,'onceinawhile':0.75,'1':0.75,'0.75':0.75,
                 'sometimes':0.5,'2':0.5,'0.5':0.5,
                 'often':0.25,'usually':0.25,'3':0.25,'0.25':0.25,
                 'always':0,'all the time':0,'all of the time':0,'4':0};
  return (boolScore(q1)+boolScore(q2)+boolScore(q3)+boolScore(q4)+boolScoreR(q5)+boolScore(q6)+boolScore(q7)+(q8map[String(q8).toLowerCase()]??0)).toFixed(2);
}

async function dndSubmitUpload() {
  if (_dndParsedRows.length === 0) return;
  const btn = document.getElementById('dnd-submit-btn');
  if (btn) { btn.disabled=true; btn.textContent=`Uploading ${_dndParsedRows.length} records...`; }

  // Ensure Firebase auth is active before writing — same guard used by individual submissions
  if (typeof firebase !== 'undefined' && firebase.auth && !firebase.auth().currentUser) {
    await new Promise((resolve) => {
      const unsub = firebase.auth().onAuthStateChanged(user => {
        unsub();
        if (user) { resolve(); }
        else { firebase.auth().signInAnonymously().then(resolve).catch(resolve); }
      });
      setTimeout(resolve, 8000); // safety timeout
    });
  }

  let uploaded = 0;
  const db = (typeof database !== 'undefined' && database) || window._firebaseDb;
  for (const row of _dndParsedRows) {
    try {
      // Convert raw YES/NO strings to numeric scores — patient card expects 0/1, not strings
      const _yn  = (v, rev) => { const s=String(v||'').trim().toLowerCase(); return rev?(s==='yes'||s==='1'?1:0):(s==='no'||s==='0'?1:0); };
      const _q8n = v => { if (typeof v==='number') { const _i={0:1,1:0.75,2:0.5,3:0.25,4:0}; return _i[v]!==undefined?_i[v]:0; } const s=String(v||'').trim().toLowerCase(); const _m={'never':1,'rarely':0.75,'once in a while':0.75,'sometimes':0.5,'often':0.25,'usually':0.25,'always':0,'all the time':0,'all of the time':0}; return (_m[s] !== undefined ? _m[s] : (parseFloat(v) || 0)); };
      const submission = {
        ...row,
        score:            parseFloat(row.score) || 0,   // rule: isNumber() — toFixed() returns string
        // q1–q7 stored as numeric scores (0/1); q8 as decimal — patient card truthy-checks these
        ...(row.tool !== 'map' ? {
          q1: _yn(row.q1, false), q2: _yn(row.q2, false), q3: _yn(row.q3, false),
          q4: _yn(row.q4, false), q5: _yn(row.q5, true),  q6: _yn(row.q6, false),
          q7: _yn(row.q7, false), q8: _q8n(row.q8),
        } : {}),
        source:           'bulk_dnd',
        upload_source:    'bulk_dnd',
        timestamp:        Date.now(),
        user_id:          (typeof getUserId === 'function') ? getUserId() : ('dnd-' + Date.now()),
        institution_code: currentWorkspace || null,
        role:             (workspaceProfile && workspaceProfile.role) || 'researcher',
      };
      // Tag with parent hierarchy so institution/PI dashboards roll up this data
      if (workspaceProfile && workspaceProfile.parent_institution) {
        submission.parent_institution = workspaceProfile.parent_institution;
      }
      if (workspaceProfile && workspaceProfile.parent_pi) {
        submission.parent_pi = workspaceProfile.parent_pi;
      }
      if (db) {
        await db.ref('assessments').push(submission);
        updatePublicStats(submission.score, submission.country);
      }
      uploaded++;
    } catch(e) { console.error('Upload error row', row.patient_number, e); }
  }
  if (btn) { btn.disabled=false; btn.textContent=`Uploaded ${uploaded} of ${_dndParsedRows.length} records`; btn.style.background='#10b981'; }
  _dndParsedRows = [];
  setTimeout(() => closeBulkUploadDialog(), 3000);
}

/**
 * Generates and downloads the ATLAS Bulk Upload Template v2 as a CSV file.
 * Pre-fills study metadata from `atlas_study_config` in localStorage if available.
 * @returns {void}
 */
function downloadBulkTemplate() {
  // v2 template — study metadata header block (rows 1–8) + patient data (row 9+)
  // Parser reads: study_title=B2, pi_name=B3, institution=B4, irb_number=B5,
  //               clinicaltrials_id=B6, study_phase=B7; patient columns from row 9 onward.
  const cfg = (function(){ try { return JSON.parse(localStorage.getItem('atlas_study_config')||'{}'); } catch(e){ return {}; } })();
  const metaRows = [
    ['"ATLAS Bulk Upload Template v2"',''],
    ['"Study Title"',                  `"${cfg.name            || ''}"`],
    ['"Principal Investigator"',        `"${cfg.pi              || ''}"`],
    ['"Institution"',                   `"${cfg.institution     || ''}"`],
    ['"IRB Number"',                    `"${cfg.irb             || ''}"`],
    ['"ClinicalTrials.gov ID"',         `"${cfg.clinicaltrials  || ''}"`],
    ['"Protocol Version"',              `"${cfg.protocol        || ''}"`],
    ['',''],   // blank separator — row 8
  ];
  const headers     = ['COUNTRY','CITY','PATIENT #','CONDITION','DRUG TYPE','DRUG NAME','DRUG STRENGTH','ROUTE','GENDER','AGE RANGE','EDUCATION','Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8'];
  const instructions= ['Required','Optional','Optional','Required','Optional','Optional','Optional','Optional','Optional','Optional','Optional','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Never/Rarely | Once in a while | Sometimes | Usually | All the time'];
  const sample      = ['United States','New York','PT-001','Hypertension','Single','Lisinopril','10mg','Oral','Female','45-54','College','No','No','No','No','Yes','No','No','Once in a while'];
  const note        = ['"↑ MMAS-8 Template. Q1–Q7: Yes or No. Q8: Never/Rarely | Once in a while | Sometimes | Usually | All the time. Delete this note row before uploading."'];

  const metaCsv  = metaRows.map(r => r.join(',')).join('\n');
  const dataCsv  = [headers, instructions, note, sample].map(r => r.map ? r.map(c=>`"${c}"`).join(',') : r[0]).join('\n');
  const csv      = metaCsv + '\n' + dataCsv;

  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ATLAS_Bulk_Upload_Template_v2.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Downloads the ATLAS MAP Bulk Upload Template.
 * Primary: fetches ATLAS_MAP_Bulk_Upload.xlsm from S3 via the Worker (/download/template?tool=map).
 * Fallback: generates a CSV with correct MAP structure (Q1–Q7 Yes/No, Q8 5-point Likert).
 * MAP Q8: "In a typical week, how often do you have trouble taking all your medications as prescribed?"
 *   → Never | Rarely | Sometimes | Often | All of the time
 * @returns {void}
 */
async function downloadMAPBulkTemplate() {
  const btn = document.getElementById('dnd-template-btn');
  const orig = btn ? btn.textContent : '↓ Download MAP Template (.csv)';
  if (btn) { btn.textContent = '↓ Starting download…'; btn.disabled = true; }

  // ── PRIMARY: Worker → S3 xlsm ────────────────────────────────────────────
  try {
    const res = await fetch('/download/template?tool=map');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ATLAS_MAP_Bulk_Upload.xlsm';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('ATLAS_MAP_Bulk_Upload.xlsm downloaded — open in Excel and enable macros.', 5000);
    if (btn) { btn.textContent = orig; btn.disabled = false; }
    return;
  } catch(_) {
    // fall through to CSV fallback
  }

  // ── FALLBACK: CSV with correct MAP structure ──────────────────────────────
  if (btn) btn.textContent = '↓ Generating CSV fallback…';
  const cfg = (function(){ try { return JSON.parse(localStorage.getItem('atlas_study_config')||'{}'); } catch(e){ return {}; } })();
  const metaRows = [
    ['"ATLAS MAP Bulk Upload Template v2"',''],
    ['"Study Title"',                  `"${cfg.name            || ''}"`],
    ['"Principal Investigator"',        `"${cfg.pi              || ''}"`],
    ['"Institution"',                   `"${cfg.institution     || ''}"`],
    ['"IRB Number"',                    `"${cfg.irb             || ''}"`],
    ['"ClinicalTrials.gov ID"',         `"${cfg.clinicaltrials  || ''}"`],
    ['"Protocol Version"',              `"${cfg.protocol        || ''}"`],
    ['',''],
  ];
  const headers      = ['COUNTRY','CITY','PATIENT #','CONDITION','DRUG TYPE','DRUG NAME','DRUG STRENGTH','ROUTE','GENDER','AGE RANGE','EDUCATION','MAP_Q1','MAP_Q2','MAP_Q3','MAP_Q4','MAP_Q5','MAP_Q6','MAP_Q7','MAP_Q8'];
  const instructions = ['Required','Optional','Optional','Required','Optional','Optional','Optional','Optional','Optional','Optional','Optional','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No','Never|Rarely|Sometimes|Often|All of the time'];
  const sample       = ['United States','New York','PT-001','Hypertension','Single','Lisinopril','10mg','Oral','Female','45-54','College','No','No','No','No','Yes','No','No','Sometimes'];
  const note         = ['"↑ MAP Template. Q1–Q7 = Yes/No. Q8 = Never | Rarely | Sometimes | Often | All of the time. Use MAP_Q1–MAP_Q8 column headers. Delete this note row before uploading."'];

  const metaCsv = metaRows.map(r => r.join(',')).join('\n');
  const dataCsv = [headers, instructions, note, sample].map(r => r.map ? r.map(c=>`"${c}"`).join(',') : r[0]).join('\n');
  const csv     = metaCsv + '\n' + dataCsv;

  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ATLAS_MAP_Bulk_Upload_Template_v2.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  if (typeof showToast === 'function') showToast('MAP template downloaded (CSV fallback). Q1–Q7 = Yes/No; Q8 = Never | Rarely | Sometimes | Often | All of the time.', 5000);
  if (btn) { btn.textContent = orig; btn.disabled = false; }
}
window.downloadMAPBulkTemplate = downloadMAPBulkTemplate;

/**
 * Routes template download to the correct instrument template based on current import tool.
 * @returns {void}
 */
function downloadBulkTemplateForTool() {
  if (_dndImportTool === 'map') {
    // MAP: Worker → S3 xlsm, SheetJS xlsx fallback, CSV last resort
    if (typeof downloadMAPTemplate === 'function') { downloadMAPTemplate(null); }
    else { downloadMAPBulkTemplate(); }
  } else {
    // MMAS-8: Worker → S3 xlsm, SheetJS xlsx fallback
    if (typeof downloadTemplate === 'function') { downloadTemplate(null); }
    else { downloadBulkTemplate(); }
  }
}
window.downloadBulkTemplateForTool = downloadBulkTemplateForTool;

/**
 * Closes the drag-and-drop bulk upload modal and resets all upload state.
 * @returns {void}
 */
function closeBulkUploadDialog() {
  const modal=document.getElementById('dnd-bulk-modal');
  if (modal) modal.style.display='none';
  _dndParsedRows=[];
  _dndImportTool='mmas';
  setDndImportTool('mmas'); // reset selector UI
  const tbody=document.getElementById('dnd-val-tbody'); if(tbody) tbody.innerHTML='';
  const grid=document.getElementById('dnd-validation-grid'); if(grid) grid.style.display='none';
  const summary=document.getElementById('dnd-summary-bar'); if(summary) summary.style.display='none';
  const btn=document.getElementById('dnd-submit-btn');
  if (btn) { btn.classList.remove('visible'); btn.style.background='#2563eb'; btn.disabled=false; btn.innerHTML='Upload <span id="dnd-submit-count">0</span> Valid Records to ATLAS'; }
  const nameEl=document.getElementById('dnd-file-name'); if(nameEl) nameEl.textContent='';
  const zone=document.getElementById('dnd-zone');
  if (zone) { const inp=zone.querySelector('input[type=file]'); if(inp) inp.value=''; }
}

// ══════════════════════════════════════════════
// EVENT STATE ENGINE + COUNTDOWN TIMER
// Dates are read from Firebase /config/event on load.
// Hardcoded values below are fallbacks used only when Firebase is unavailable.
// To update next year's event: write {start, end, name} to /config/event in Firebase console.
// ══════════════════════════════════════════════
let EVENT_START = new Date('2026-03-20T00:00:00Z');
let EVENT_END   = new Date('2026-03-27T23:59:59Z');
let EVENT_NAME  = 'Adherence Project 2026';

// Load event config from Firebase; fall back silently to hardcoded defaults
(function loadEventConfig() {
  try {
    database.ref('/config/event').once('value').then(snap => {
      const cfg = snap.val();
      if (!cfg) return;
      if (cfg.start) { const d = new Date(cfg.start); if (!isNaN(d)) EVENT_START = d; }
      if (cfg.end)   { const d = new Date(cfg.end);   if (!isNaN(d)) EVENT_END   = d; }
      if (cfg.name)  EVENT_NAME = cfg.name;
      // Re-render countdown with updated config
      initCountdown();
    }).catch(() => {}); // Firebase unavailable — keep fallback values
  } catch(e) {}
})();

/**
 * Returns the current phase of the annual adherence event.
 * @returns {'pre'|'active'|'concluded'} Current event phase relative to `EVENT_START` and `EVENT_END`
 */
function getEventPhase() {
  const now = new Date();
  if (now < EVENT_START) return 'pre';
  if (now <= EVENT_END)  return 'active';
  return 'concluded';
}

/**
 * Initialises and starts the event countdown timer.
 * Reads `EVENT_START` and `EVENT_END` (loaded from Firebase `/config/event`).
 * Renders the countdown DOM and updates it every second via `setInterval`.
 * @returns {void}
 */
function initCountdown() {
  // Clear any previous interval to prevent stacking on re-visits
  if (window._countdownInterval) { clearInterval(window._countdownInterval); window._countdownInterval = null; }
  const el      = document.getElementById('entry-countdown');
  const subText = document.getElementById('entry-sub-text');
  if (!el) return;
  const phase = getEventPhase();

  if (phase === 'pre') {
    if (subText) subText.textContent = 'Adherence Cartography · ATLAS is always live. A new campaign opens soon.';
    function renderPre() {
      const now  = new Date();
      const diff = EVENT_START - now;
      if (diff <= 0) { initCountdown(); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      el.innerHTML = `
        <div class="countdown-pre"><span class="countdown-pre-dot"></span>Event opens in</div>
        <div class="countdown-units">
          <div class="countdown-unit"><div class="countdown-num">${String(d).padStart(2,'0')}</div><div class="countdown-lbl">Days</div></div>
          <div class="countdown-sep">:</div>
          <div class="countdown-unit"><div class="countdown-num">${String(h).padStart(2,'0')}</div><div class="countdown-lbl">Hours</div></div>
          <div class="countdown-sep">:</div>
          <div class="countdown-unit"><div class="countdown-num">${String(m).padStart(2,'0')}</div><div class="countdown-lbl">Minutes</div></div>
          <div class="countdown-sep">:</div>
          <div class="countdown-unit"><div class="countdown-num">${String(s).padStart(2,'0')}</div><div class="countdown-lbl">Seconds</div></div>
        </div>`;
    }
    renderPre();
    window._countdownInterval = setInterval(renderPre, 1000);

  } else if (phase === 'active') {
    if (subText) subText.textContent = 'A campaign is active. Choose your path below.';
    function renderActive() {
      const now     = new Date();
      const diff    = EVENT_END - now;
      if (diff <= 0) { initCountdown(); return; }
      const totalMs = EVENT_END - EVENT_START;
      const elapsed = now - EVENT_START;
      const pct     = Math.min(100, Math.round((elapsed / totalMs) * 100));
      const dayNum  = Math.min(8, Math.floor(elapsed / 86400000) + 1);
      const h       = Math.floor(diff / 3600000);
      const m       = Math.floor((diff % 3600000) / 60000);
      const s       = Math.floor((diff % 60000) / 1000);
      el.innerHTML = `
        <div class="countdown-active"><span class="countdown-active-dot"></span>${EVENT_NAME} · Campaign active</div>
        <div class="countdown-day-progress">
          Day ${dayNum} of 8 &nbsp;·&nbsp; ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} remaining
          <div class="countdown-progress-bar"><div class="countdown-progress-fill" style="width:${pct}%"></div></div>
        </div>`;
    }
    renderActive();
    window._countdownInterval = setInterval(renderActive, 1000);

  } else {
    // ── PERPETUAL PHASE ── stats shown in the stats band above; countdown slot stays minimal
    if (subText) subText.textContent = 'Adherence Cartography · ATLAS is always live. Submit an assessment or explore the global map.';
    el.innerHTML = ''; // stats band above handles all numbers — no duplicate needed
  }
}

// ══════════════════════════════════════════════
// IRB SESSION CERTIFICATE
// ══════════════════════════════════════════════
/**
 * Generates and prints an IRB data collection session certificate.
 * Includes workspace name, session ID, MMAS/PEACS counts, countries, and average scores.
 * Appends a hidden print-only `<div>` and triggers `window.print()`.
 * @returns {void}
 */
function generateIRBCertificate() {
  atlasAuditLog('irb_certificate_generated', { workspace: currentWorkspace });
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
  const timeStr  = now.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  const wsName   = workspaceProfile ? workspaceProfile.name || currentWorkspace : currentWorkspace || 'Independent';
  // Split combined dashMmasData into per-instrument arrays
  const allRecords = dashMmasData || [];
  const mmasRecords = allRecords.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const mapRecords  = allRecords.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const mmasN    = mmasRecords.length;
  const mapInstN  = mapRecords.length;
  const peacsN   = dashPeacsData ? dashPeacsData.length : 0;
  const countries = allRecords.length > 0 ? new Set(allRecords.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size : 0;
  const avgScore = mmasN > 0 ? (mmasRecords.reduce((s,r)=>s+(r.score||0),0)/mmasN).toFixed(2) : '—';
  const avgPE    = peacsN > 0 ? (dashPeacsData.reduce((s,r)=>s+(r.pe||0),0)/peacsN).toFixed(3) : '—';
  const sessionId = 'ATLAS-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '-' + Math.random().toString(36).substr(2,6).toUpperCase();

  // MAP domain scores — computed from actual MAP records using MAP item keys
  const avgMapA  = mapInstN > 0 ? (mapRecords.reduce((s,r)=>s+((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3,0)/mapInstN).toFixed(3) : '—';
  const avgMapE  = mapInstN > 0 ? (mapRecords.reduce((s,r)=>s+((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3,0)/mapInstN).toFixed(3) : '—';
  const avgMapC  = mapInstN > 0 ? (mapRecords.reduce((s,r)=>s+(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2),0)/mapInstN).toFixed(3) : '—';
  const avgMapPE = mapInstN > 0 ? (mapRecords.reduce((s,r)=>{
    const a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
    return s+Math.pow(Math.max(0,a*e*c),1/3);
  },0)/mapInstN).toFixed(3) : '—';

  // MMAS-8 adherence phenotype distribution (MMAS records only)
  let mapA = 0, mapPA = 0, mapINA = 0, mapUNA = 0;
  mmasRecords.forEach(r => {
    const s = r.score || 0;
    if (s === 8) { mapA++; }
    else if (s >= 6) { mapPA++; }
    else if (typeof classifyPattern === 'function') {
      const p = classifyPattern(r);
      if (p.intentional > p.unintentional) mapINA++; else mapUNA++;
    } else { mapUNA++; }
  });
  const mapPhenotypeStr = mmasN > 0
    ? `A: ${mapA} · PA: ${mapPA} · UNA: ${mapUNA} · INA: ${mapINA}`
    : '—';

  // PEACS domain averages (BASE = Architecture, MVMT = Execution, STRATA = Context)
  const avgBase   = peacsN > 0 ? (dashPeacsData.reduce((s,r)=>s+(r.base||0),0)/peacsN).toFixed(3) : '—';
  const avgMvmt   = peacsN > 0 ? (dashPeacsData.reduce((s,r)=>s+(r.mvmt||0),0)/peacsN).toFixed(3) : '—';
  const avgStrata = peacsN > 0 ? (dashPeacsData.reduce((s,r)=>s+(r.strata||0),0)/peacsN).toFixed(3) : '—';

  let existing = document.getElementById('print-irb-cert');
  if (existing) existing.remove();
  const cert = document.createElement('div');
  cert.id = 'print-irb-cert';
  cert.style.display = 'none';
  cert.innerHTML = `
    <div class="irb-cert-page">
      <div class="irb-cert-brand">Adherence Cartography · ATLAS</div>
      <div class="irb-cert-title">Data Collection Session Certificate</div>
      <div class="irb-cert-sub">For IRB / Ethics Committee Documentation</div>
      <table class="irb-cert-table">
        <tr><td>Session ID</td><td>${sessionId}</td></tr>
        <tr><td>Institution / Workspace</td><td>${wsName}</td></tr>
        <tr><td>Certificate Generated</td><td>${dateStr} at ${timeStr}</td></tr>
        <tr><td>Collection Window</td><td>ATLAS · Ongoing · Perpetual global data collection</td></tr>
        <tr><td>Platform</td><td>ATLAS · Adherence Tracking and Longitudinal Assessment System</td></tr>
        <tr><td>Instruments Used</td><td>MMAS-8 (Morisky Medication Adherence Scale, v1.0) · MAP (Multidimensional Adherence Parameters) · PEACS v2.0 (Predictive Emergence Assessment for Clinical Services)</td></tr>
        <tr class="irb-cert-section-hdr"><td colspan="2">MMAS-8 Data</td></tr>
        <tr><td>MMAS-8 Submissions</td><td>${mmasN.toLocaleString()}</td></tr>
        <tr><td>MMAS-8 Mean Score</td><td>${avgScore} / 8.0</td></tr>
        <tr><td>Countries Represented</td><td>${countries}</td></tr>
        <tr class="irb-cert-section-hdr"><td colspan="2">MAP — Multidimensional Adherence Parameters</td></tr>
        <tr><td>MAP Assessments</td><td>${mapInstN.toLocaleString()}</td></tr>
        <tr><td>MAP Phenotype Distribution</td><td>${mapPhenotypeStr}</td></tr>
        <tr><td>MAP Mean Architecture (Domain A)</td><td>${avgMapA}</td></tr>
        <tr><td>MAP Mean Execution (Domain E)</td><td>${avgMapE}</td></tr>
        <tr><td>MAP Mean Context (Domain C)</td><td>${avgMapC}</td></tr>
        <tr><td>MAP Mean Predictive Emergence (PE)</td><td>${avgMapPE}</td></tr>
        <tr class="irb-cert-section-hdr"><td colspan="2">PEACS v2.0 — Predictive Emergence Assessment</td></tr>
        <tr><td>PEACS Assessments</td><td>${peacsN.toLocaleString()}</td></tr>
        <tr><td>PEACS Mean BASE (Architecture)</td><td>${avgBase}</td></tr>
        <tr><td>PEACS Mean MVMT (Execution)</td><td>${avgMvmt}</td></tr>
        <tr><td>PEACS Mean STRATA (Context)</td><td>${avgStrata}</td></tr>
        <tr><td>PEACS Mean Predictive Emergence (PE)</td><td>${avgPE}</td></tr>
        <tr class="irb-cert-section-hdr"><td colspan="2">Data Governance</td></tr>
        <tr><td>Data Storage</td><td>Firebase Realtime Database (anonymized) · No personally identifiable information collected</td></tr>
        <tr><td>Consent Protocol</td><td>Informed consent obtained via digital consent form prior to each assessment</td></tr>
      </table>
      <div class="irb-cert-ip">
        <strong>Intellectual Property Notice:</strong> MMAS-8 is the intellectual property of MMAR LLC. ATLAS and PEACS are the intellectual property of Adherence Cartography. All use requires written permission. 100 Oceangate, 12th Floor, Long Beach, CA 90802 · info@adherence.cc · www.adherence.cc
      </div>
      <div class="irb-cert-sig">
        <div class="irb-cert-sig-line"></div>
        <div class="irb-cert-sig-label">Principal Investigator Signature &amp; Date</div>
        <div class="irb-cert-sig-line" style="margin-top:28px;"></div>
        <div class="irb-cert-sig-label">Institution / IRB Representative Signature &amp; Date</div>
      </div>
      <div class="irb-cert-footer">This document was generated automatically from the ATLAS platform. It is intended as supporting documentation only and does not constitute IRB approval.</div>
    </div>`;
  document.body.appendChild(cert);
  document.body.classList.add('printing-irb');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-irb'); const el = document.getElementById('print-irb-cert'); if (el) el.remove(); }, 1200);
}

// ══════════════════════════════════════════════
// CITATION HELPER
// ══════════════════════════════════════════════
/**
 * Opens the citation modal with MMAS-8 / PEACS citation formats (APA, Vancouver, BibTeX, RIS).
 * @returns {void}
 */
function showCitationModal() {
  const year = new Date().getFullYear();
  const blocks = [
    { label: 'MMAS-8 Instrument · APA 7th', id: 'cite-mmas-apa',
      text: 'Krousel-Wood, M., Islam, T., Webber, L. S., Re, R. N., Morisky, D. E., & Muntner, P. (2009). New medication adherence scale versus pharmacy fill rates in seniors with hypertension. American Journal of Managed Care, 15(1), 59–66. PMID: 19146365; PMCID: PMC2728593.' },
    { label: 'MMAS-8 · Vancouver', id: 'cite-mmas-van',
      text: 'Krousel-Wood M, Islam T, Webber LS, Re RN, Morisky DE, Muntner P. New medication adherence scale versus pharmacy fill rates in seniors with hypertension. Am J Manag Care. 2009;15(1):59-66. PMID: 19146365; PMCID: PMC2728593.' },
    { label: 'ATLAS Platform · APA 7th', id: 'cite-atlas-apa',
      text: `Adherence Cartography (${year}). ATLAS: Adherence Tracking and Longitudinal Assessment System [Data collection platform]. Long Beach, CA: Adherence Cartography / Adherence Inc. https://www.adherence.cc` },
    { label: 'PEACS v2.0 · APA 7th', id: 'cite-peacs-apa',
      text: `Morisky, P., & Adherence Cartography (${year}). PEACS v2.0: Predictive Emergence Assessment for Clinical Services. Long Beach, CA: Adherence Cartography / Adherence Inc.` },
    { label: 'Theory of Predictive Emergence · APA 7th', id: 'cite-tpe-apa',
      text: 'Morisky, P. (2026). THE THEORY OF PREDICTIVE EMERGENCE: A Geometric Framework for Behavioral Stability. Zenodo. https://doi.org/10.5281/zenodo.18209699' },
  ];

  let modal = document.getElementById('cite-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cite-modal';
    modal.className = 'cite-modal-overlay';
    document.body.appendChild(modal);
  }

  const blocksHTML = blocks.map(b => `
    <div class="cite-block">
      <div class="cite-block-label">${b.label}</div>
      <div class="cite-block-text" id="${b.id}">${b.text}</div>
      <button class="cite-copy-btn" onclick="copyCite('${b.id}', this)">Copy</button>
    </div>`).join('');

  modal.innerHTML = `
    <div class="cite-modal-box">
      <div class="cite-modal-hdr">
        <span class="cite-modal-title">How to Cite</span>
        <button class="cite-modal-close" id="cite-modal-close">✕</button>
      </div>
      <p class="cite-modal-intro">Use the following citations when publishing research that used MMAS-8 or PEACS data collected through ATLAS.</p>
      ${blocksHTML}
      <div class="cite-ip-notice">
        MMAS-8 is the intellectual property of MMAR LLC. ATLAS and PEACS are intellectual property of Adherence Cartography. Written permission required prior to use. Contact info@adherence.cc · www.adherence.cc
      </div>
    </div>`;

  modal.style.display = 'flex';
  document.getElementById('cite-modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if(e.target === modal) modal.style.display = 'none'; });
}

function copyCite(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  }).catch(() => { showToast('Copy failed — please select and copy manually.'); });
}

function initCiteQuickCopy() {
  const container = document.getElementById('cite-quickcopy-list');
  if (!container) return;
  container.dataset.init = '1';
  const year = new Date().getFullYear();
  const items = [
    { label: 'MMAS-8 Instrument · APA 7th',
      text: 'Krousel-Wood, M., Islam, T., Webber, L. S., Re, R. N., Morisky, D. E., & Muntner, P. (2009). New medication adherence scale versus pharmacy fill rates in seniors with hypertension. American Journal of Managed Care, 15(1), 59–66. PMID: 19146365; PMCID: PMC2728593.',
      col: 'rgba(212,168,67,0.6)' },
    { label: 'ATLAS Platform · APA 7th',
      text: `Adherence Cartography (${year}). ATLAS: Adherence Tracking and Longitudinal Assessment System [Data collection platform]. Long Beach, CA: Adherence Cartography / Adherence Inc. https://www.adherence.cc`,
      col: 'rgba(78,156,245,0.6)' },
    { label: 'PEACS v2.0 · APA 7th',
      text: `Morisky, P., & Adherence Cartography (${year}). PEACS v2.0: Predictive Emergence Assessment for Clinical Services. Long Beach, CA: Adherence Cartography / Adherence Inc.`,
      col: 'rgba(46,201,138,0.6)' },
    { label: 'Theory of Predictive Emergence · APA 7th',
      text: 'Morisky, P. (2026). THE THEORY OF PREDICTIVE EMERGENCE: A Geometric Framework for Behavioral Stability. Zenodo. https://doi.org/10.5281/zenodo.18209699',
      col: 'rgba(212,168,67,0.6)' },
  ];
  container.innerHTML = items.map((item, i) => {
    const qid = 'cite-quick-' + i;
    return `<div style="background:var(--card2);border:1px solid var(--border);border-left:3px solid ${item.col};border-radius:7px;padding:10px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div style="min-width:0;">
        <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:${item.col};margin-bottom:4px;">${item.label}</div>
        <div id="${qid}" style="font-size:0.76rem;color:var(--text);line-height:1.55;word-break:break-word;">${item.text}</div>
      </div>
      <button onclick="copyCiteQuick('${qid}',this)" style="flex-shrink:0;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:4px 10px;cursor:pointer;white-space:nowrap;transition:all 0.2s;" onmouseenter="this.style.color='var(--bright)';this.style.borderColor='var(--border2)'" onmouseleave="this.style.color='var(--dim)'">Copy</button>
    </div>`;
  }).join('');
}

function copyCiteQuick(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    btn.textContent = '✓ Copied';
    btn.style.color = '#10b981';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = 'var(--dim)'; }, 1800);
  }).catch(() => { showToast('Copy failed — please select and copy manually.'); });
}

// ══════════════════════════════════════════════
// CHERRY 1 — ENTRY SCREEN LIVE PULSE COUNTER
// ══════════════════════════════════════════════
function initEntryLiveCounter() {
  if (window._elcInited) return;
  window._elcInited = true;
  const wrap = document.getElementById('entry-live-counter');

  // Also populate the new stats band
  function updateStatsBand(mTotal, countries, avgScore, pTotal) {
    const sb = id => document.getElementById(id);
    function animVal(el, val, dec) {
      if (!el) return;
      const from = parseFloat(el.getAttribute('data-val') || '0');
      const to = parseFloat(val);
      // Only pulse if value changed
      if (Math.abs(to - from) > 0.001) {
        el.classList.remove('live-pop');
        void el.offsetWidth; // force reflow
        el.classList.add('live-pop');
      }
      const dur = 800, t0 = performance.now();
      function tick(now) {
        const p = Math.min((now - t0) / dur, 1);
        const v = from + (to - from) * (1 - Math.pow(1-p, 3));
        el.textContent = dec ? v.toFixed(2) : Math.round(v).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
        else el.setAttribute('data-val', to);
      }
      requestAnimationFrame(tick);
    }
    animVal(sb('entry-sb-total'), mTotal, false);
    animVal(sb('entry-sb-countries'), countries, false);
    animVal(sb('entry-sb-avg'), avgScore, true);
    animVal(sb('entry-sb-peacs'), pTotal, false);
  }

  function animElc(elId, newVal, isDecimal) {
    const el = document.getElementById(elId);
    if (!el) return;
    const from  = parseFloat(el.getAttribute('data-val') || '0');
    const to    = parseFloat(newVal);
    const dur   = 700, t0 = performance.now();
    el.classList.remove('elc-pop'); void el.offsetWidth; el.classList.add('elc-pop');
    function tick(now) {
      const p   = Math.min((now - t0) / dur, 1);
      const val = from + (to - from) * (1 - Math.pow(1-p, 3));
      el.textContent = isDecimal ? val.toFixed(2) : Math.round(val).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
      else el.setAttribute('data-val', to);
    }
    requestAnimationFrame(tick);
  }

  // ── Cherry 2: Live "data as of" timestamp ticker ────────────────────────────
  function updateLiveTimestamp() {
    const el = document.getElementById('entry-sb-updated');
    if (!el) return;
    const ts = window._atlasLastFetchTs;
    if (!ts) { el.textContent = 'live'; return; }
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 10)  { el.textContent = 'just now'; return; }
    if (sec < 60)  { el.textContent = sec + 's ago'; return; }
    const min = Math.floor(sec / 60);
    if (min < 60)  { el.textContent = min + 'm ago'; return; }
    el.textContent = Math.floor(min / 60) + 'h ago';
  }
  // Tick the timestamp label every 15 seconds
  if (!window._atlasTsInterval) {
    window._atlasTsInterval = setInterval(updateLiveTimestamp, 15000);
  }

  function fetchAndRender() {
    database.ref('assessments').once('value', aSnap => {
      const aData    = aSnap.val() ? Object.values(aSnap.val()) : [];
      const mmasData = aData.filter(r => r.map_q1 === undefined); // exclude MAP instrument records
      const mTotal   = mmasData.filter(r => r.score !== undefined && r.score !== null).length;
      const avgScore  = mTotal > 0 ? mmasData.reduce((s,r)=>s+(r.score||0),0)/mTotal : 0;
      database.ref('peacs_assessments').once('value', pSnap => {
        const pData  = pSnap.val() ? Object.values(pSnap.val()) : [];
        const pTotal = pData.length;
        window._atlasLastFetchTs = Date.now();
        // Read countries from mapData — same source as website, uses sdohCountry preference
        // so the count is consistent across all views.
        database.ref('mapData').once('value', mdSnap => {
          const mdVal = mdSnap.val();
          const countries = mdVal
            ? new Set(Object.values(mdVal).map(d=>(d.country||'').trim()).filter(c=>c&&c.toLowerCase()!=='unknown'&&c!=='')).size
            : new Set(aData.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
          // Cache for Explorer dashboard — single source of truth
          window._atlasLiveGlobal = {
            mmasTotal: mTotal, countries, avgScore, peacsTotal: pTotal,
            mmasRecords: mmasData, peacsRecords: pData, fetchedAt: Date.now(),
          };
          // Keep snapshot in sync so injectExplorerSnapshot is always current
          if (mTotal > 0) { EXPLORER_SNAPSHOT.mmasTotal = mTotal; EXPLORER_SNAPSHOT.countries = countries; EXPLORER_SNAPSHOT.avgScore = parseFloat(avgScore.toFixed(2)); }
          if (pTotal > 0) { EXPLORER_SNAPSHOT.peacsTotal = pTotal; }
          updateStatsBand(mTotal, countries, avgScore, pTotal);
          updateLiveTimestamp();
          if (wrap) {
            animElc('elc-mmas-total', mTotal, false);
            animElc('elc-countries', countries, false);
            animElc('elc-avg', avgScore, true);
            animElc('elc-peacs-total', pTotal, false);
          }
        });
      });
    });
  }

  fetchAndRender();
  if (!window._elcListening) {
    window._elcListening = true;
    database.ref('assessments').on('child_added', () => { clearTimeout(window._elcT); window._elcT = setTimeout(fetchAndRender, 900); });
    database.ref('peacs_assessments').on('child_added', () => { clearTimeout(window._elcT); window._elcT = setTimeout(fetchAndRender, 900); });
  }
}

// ══════════════════════════════════════════════
// CHERRY 2 — MMAS × PEACS CORRELATION SCATTER
// ══════════════════════════════════════════════
let _corrInited = false;

function renderCorrelationChart() {
  if (!dashMmasData || !dashPeacsData || !window.Plotly) return;
  if (!dashMmasData.length || !dashPeacsData.length) return;
  // Observers and roles without psychometrics module do not see the correlation panel
  if (typeof isObserverMode === 'function' && isObserverMode()) return;
  if (typeof hasModule === 'function' && !hasModule('analytics_psychometrics')) return;

  if (!document.getElementById('corr-panel')) {
    const dashBody = document.querySelector('#screen-dashboard .dash-body');
    if (!dashBody) return;
    const panel = document.createElement('div');
    panel.id = 'corr-panel';
    panel.className = 'corr-panel';
    panel.innerHTML = `
      <div class="corr-panel-hdr">
        <div>
          <div class="corr-panel-title">MMAS-8 × PEACS Correlation</div>
          <div class="corr-panel-sub">Adherence Score vs. Predictive Emergence</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="corr-panel-badge" id="corr-n-badge">Loading…</div>
          <button class="corr-toggle" id="corr-collapse-btn">▼ Show</button>
        </div>
      </div>
      <div id="corr-body-wrap" style="display:none;">
        <div class="corr-body">
          <div id="corr-chart-wrap"><div style="height:320px;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.71rem;color:var(--dim);">Click Show to render chart.</div></div>
          <div class="corr-insight-row" id="corr-insights"></div>
        </div>
      </div>`;
    dashBody.appendChild(panel);
    document.getElementById('corr-collapse-btn').addEventListener('click', () => {
      const body = document.getElementById('corr-body-wrap');
      const btn  = document.getElementById('corr-collapse-btn');
      const open = body.style.display === 'none';
      body.style.display = open ? '' : 'none';
      btn.textContent    = open ? '▲ Hide' : '▼ Show';
      if (open && !_corrInited) { _corrInited = true; _drawCorrChart(); }
      else if (open) { setTimeout(()=>{ if(window.Plotly && document.getElementById('corr-plotly-div')) window.Plotly.relayout('corr-plotly-div',{autosize:true}); },50); }
    });
  }

  // Build paired records: match MMAS and PEACS by patient_number first,
  // then user_id, then proximity fallback.
  // Keep ALL pairs per patient (not just latest) so bulk uploads show full dataset.

  // Index MMAS by patient_number and by user_id
  const mmasByPatNum = {};
  const mmasByUser   = {};
  dashMmasData.forEach(r => {
    const pn = (r.patient_number || r.patient_id || '').toString().trim().toUpperCase();
    if (pn) {
      if (!mmasByPatNum[pn]) mmasByPatNum[pn] = [];
      mmasByPatNum[pn].push(r);
    }
    if (r.user_id) {
      if (!mmasByUser[r.user_id]) mmasByUser[r.user_id] = [];
      mmasByUser[r.user_id].push(r);
    }
  });

  const paired = [];
  const usedMmasIdx = new Set();

  dashPeacsData.forEach(pr => {
    const pn = (pr.patient_number || pr.patient_id || '').toString().trim().toUpperCase();

    // 1. Match by patient_number (bulk upload path)
    if (pn && mmasByPatNum[pn] && mmasByPatNum[pn].length) {
      // Pair with the closest-in-time MMAS record for this patient
      const candidates = mmasByPatNum[pn];
      const best = candidates.reduce((a, b) =>
        Math.abs((a.timestamp||0)-(pr.timestamp||0)) < Math.abs((b.timestamp||0)-(pr.timestamp||0)) ? a : b
      );
      paired.push({ mmas: best.score, pe: pr.pe||0, country: pr.country||best.country||'Unknown', city: pr.city||best.city||'' });
      return;
    }

    // 2. Match by user_id (live session path)
    if (pr.user_id && mmasByUser[pr.user_id] && mmasByUser[pr.user_id].length) {
      const candidates = mmasByUser[pr.user_id];
      const best = candidates.reduce((a, b) =>
        Math.abs((a.timestamp||0)-(pr.timestamp||0)) < Math.abs((b.timestamp||0)-(pr.timestamp||0)) ? a : b
      );
      paired.push({ mmas: best.score, pe: pr.pe||0, country: pr.country||best.country||'Unknown', city: pr.city||best.city||'' });
    }
  });

  window._corrPaired = paired;
  const badge = document.getElementById('corr-n-badge');
  if (badge) badge.textContent = paired.length > 0 ? `${paired.length} paired record${paired.length!==1?'s':''}` : 'Awaiting paired data';

  if (paired.length >= 2) {
    const xs=paired.map(p=>p.mmas), ys=paired.map(p=>p.pe), n=xs.length;
    const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
    const cov=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/n;
    const sx=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)/n), sy=Math.sqrt(ys.reduce((s,y)=>s+(y-my)**2,0)/n);
    const r=(sx>0&&sy>0)?cov/(sx*sy):0;
    const rl=Math.abs(r)>=0.7?'Strong':Math.abs(r)>=0.4?'Moderate':Math.abs(r)>=0.2?'Weak':'Negligible';
    const el=document.getElementById('corr-insights');
    if(el) el.innerHTML=`
      <div class="corr-insight"><div class="corr-insight-val" style="color:var(--pe);">${r.toFixed(3)}</div><div class="corr-insight-lbl">Pearson r · ${rl} ${r>=0?'positive':'negative'}</div></div>
      <div class="corr-insight"><div class="corr-insight-val">${n}</div><div class="corr-insight-lbl">Paired Records</div></div>
      <div class="corr-insight"><div class="corr-insight-val" style="color:var(--base);">${mx.toFixed(2)}</div><div class="corr-insight-lbl">Mean MMAS Score</div></div>
      <div class="corr-insight"><div class="corr-insight-val" style="color:var(--mvmt);">${my.toFixed(3)}</div><div class="corr-insight-lbl">Mean PE Score</div></div>`;
  }
}

function _drawCorrChart() {
  const paired = window._corrPaired || [];
  if (!paired.length) {
    document.getElementById('corr-chart-wrap').innerHTML = '<div style="height:320px;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.71rem;color:var(--dim);text-align:center;padding:0 20px;">No paired records yet. A user must complete both MMAS-8 and PEACS in the same session.</div>';
    return;
  }

  // ── Group by adherence zone for legend ──────────────────────────────────────
  const zones = {
    High:     { color:'#10b981', pts:[] },
    Moderate: { color:'#f59e0b', pts:[] },
    Low:      { color:'#ef4444', pts:[] }
  };
  paired.forEach(p => {
    const label = p.mmas >= 6 ? (p.mmas === 8 ? 'High' : 'Moderate') : 'Low';
    zones[label].pts.push(p);
  });

  const traces = Object.entries(zones).map(([label, z]) => ({
    x: z.pts.map(p=>p.mmas), y: z.pts.map(p=>p.pe),
    mode:'markers', type:'scatter', name: label + ' Adherence',
    text: z.pts.map(p=>`${p.city?p.city+', ':''}${p.country}<br>MMAS: ${p.mmas.toFixed(2)}<br>PE: ${p.pe.toFixed(4)}<br>${label} Adherence`),
    hovertemplate:'%{text}<extra></extra>',
    marker:{ color:z.color, size:10, opacity:0.82, line:{color:'rgba(255,255,255,0.25)',width:1.5} }
  }));

  // ── Trend line ──────────────────────────────────────────────────────────────
  const xs=paired.map(p=>p.mmas), ys=paired.map(p=>p.pe), n=xs.length;
  const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  const slope=(xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0))/(xs.reduce((s,x)=>s+(x-mx)**2,0)||1);
  const ic=my-slope*mx, xMin=Math.min(...xs), xMax=Math.max(...xs);
  const trend = { x:[xMin,xMax], y:[slope*xMin+ic,slope*xMax+ic], mode:'lines', type:'scatter',
    name:'Trend', line:{color:'rgba(212,168,67,0.55)',width:2,dash:'dot'}, hoverinfo:'skip' };

  // ── Quadrant annotations ────────────────────────────────────────────────────
  const annotations = [
    { x:2, y:0.9, text:'Low MMAS · High PE<br><i>Behavior gap</i>', showarrow:false, font:{size:9,color:'rgba(78,156,245,0.80)',family:'IBM Plex Mono'}, align:'center' },
    { x:7, y:0.9, text:'High MMAS · High PE<br><i>Optimal zone</i>', showarrow:false, font:{size:9,color:'rgba(16,185,129,0.72)',family:'IBM Plex Mono'}, align:'center' },
    { x:2, y:0.08, text:'Low MMAS · Low PE<br><i>Critical risk</i>', showarrow:false, font:{size:9,color:'rgba(239,68,68,0.72)',family:'IBM Plex Mono'}, align:'center' },
    { x:7, y:0.08, text:'High MMAS · Low PE<br><i>Biological gap</i>', showarrow:false, font:{size:9,color:'rgba(245,158,11,0.72)',family:'IBM Plex Mono'}, align:'center' }
  ];

  const layout = {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(255,255,255,0.03)',
    margin:{t:14,r:18,b:54,l:60}, annotations,
    xaxis:{title:{text:'MMAS-8 Score (Behavioral Adherence)',font:{family:'IBM Plex Mono',size:11,color:'#6b8099'}},range:[0,8.4],tickfont:{family:'IBM Plex Mono',size:10,color:'#8a9ab0'},gridcolor:'rgba(255,255,255,0.10)',showline:true,linecolor:'rgba(255,255,255,0.18)',zeroline:false},
    yaxis:{title:{text:'Predictive Emergence — PE (Biological)',font:{family:'IBM Plex Mono',size:11,color:'#6b8099'}},range:[0,1.06],tickfont:{family:'IBM Plex Mono',size:10,color:'#8a9ab0'},gridcolor:'rgba(255,255,255,0.10)',showline:true,linecolor:'rgba(255,255,255,0.18)',zeroline:false},
    legend:{font:{family:'IBM Plex Mono',size:10,color:'#6b8099'},bgcolor:'transparent',bordercolor:'rgba(255,255,255,0.08)',borderwidth:1},
    font:{family:'IBM Plex Sans',color:'#cdd8e8'}, hovermode:'closest',
    shapes:[
      {type:'line',x0:6,x1:6,y0:0,y1:1,line:{color:'rgba(16,185,129,0.22)',width:1,dash:'dot'}},
      {type:'line',x0:0,x1:8,y0:0.7,y1:0.7,line:{color:'rgba(78,156,245,0.22)',width:1,dash:'dot'}}
    ]
  };

  document.getElementById('corr-chart-wrap').innerHTML='<div id="corr-plotly-div" style="width:100%;height:340px;"></div>';
  ensurePlotly().then(() => {
    window.Plotly.newPlot('corr-plotly-div', [...traces, trend], layout, {responsive:true,displayModeBar:false});
  }); // end ensurePlotly
}

// ══════════════════════════════════════════════
// CHERRY 3 — SPECTATOR LEADERBOARD PDF SNAPSHOT
// ══════════════════════════════════════════════
function exportLeaderboardSnapshot() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const timeStr = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  const total   = (document.getElementById('cine-total')?.textContent?.trim()||'').replace(/[^0-9,]/g,'')||document.getElementById('pulse-mmas-total')?.textContent?.trim()||'—';
  const ctries  = (document.getElementById('cine-countries')?.textContent?.trim()||'').replace(/[^0-9]/g,'')||document.getElementById('pulse-countries')?.textContent?.trim()||'—';
  const avg     = (document.getElementById('cine-avg')?.textContent?.trim()||'').replace(/[^0-9.]/g,'')||document.getElementById('pulse-avg')?.textContent?.trim()||'—';
  const sessId  = 'SNAP-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+Math.random().toString(36).substr(2,5).toUpperCase();

  const sorted = Object.entries(mmasCountryData)
    .map(([c,d])=>({c,count:d.count,avg:d.totalScore/d.count}))
    .sort((a,b)=>b.count-a.count).slice(0,20);
  const maxCount = sorted[0]?.count || 1;
  const medals = ['🥇','🥈','🥉'];

  const rows = sorted.map((x,i) => {
    const cat = getAdherenceCategory(x.avg);
    return `<tr>
      <td style="font-weight:700;width:32px;">${i<3?medals[i]:(i+1)}</td>
      <td style="font-weight:500;">${x.c}</td>
      <td style="text-align:right;font-weight:600;color:${cat.color};width:52px;">${x.avg.toFixed(2)}</td>
      <td style="text-align:right;width:48px;">${x.count}</td>
      <td style="width:90px;"><div class="lb-snap-bar-bg"><div class="lb-snap-bar-fill" style="width:${Math.round(x.count/maxCount*100)}%;background:${cat.color};"></div></div></td>
    </tr>`;
  }).join('');

  let el = document.getElementById('print-lb-snapshot');
  if (el) el.remove();
  const snap = document.createElement('div');
  snap.id = 'print-lb-snapshot';
  snap.style.display = 'none';
  snap.innerHTML = `<div class="lb-snap-page">
    <div class="lb-snap-brand">Adherence Cartography · ATLAS</div>
    <div class="lb-snap-title">Global Adherence Leaderboard</div>
    <div class="lb-snap-sub">Country Rankings by MMAS-8 Submission Volume &amp; Mean Score</div>
    <div class="lb-snap-ts">Snapshot: ${dateStr} at ${timeStr} · Session ID: ${sessId}</div>
    <div class="lb-snap-stats">
      <div class="lb-snap-stat"><div class="lb-snap-stat-val">${total}</div><div class="lb-snap-stat-lbl">Submissions</div></div>
      <div class="lb-snap-stat"><div class="lb-snap-stat-val">${ctries}</div><div class="lb-snap-stat-lbl">Countries</div></div>
      <div class="lb-snap-stat"><div class="lb-snap-stat-val">${avg}</div><div class="lb-snap-stat-lbl">Global Avg</div></div>
      <div class="lb-snap-stat"><div class="lb-snap-stat-val">8.0</div><div class="lb-snap-stat-lbl">MMAS-8 Max</div></div>
    </div>
    <table class="lb-snap-table">
      <thead><tr><th>#</th><th>Country</th><th>Avg Score</th><th>Submissions</th><th>Volume</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="lb-snap-footer">Platform: Adherence Cartography · ATLAS · Instrument: MMAS-8 (Morisky Medication Adherence Scale) · Scores 0–8, High adherence = 8.0</div>
    <div class="lb-snap-ip">MMAS-8 is the intellectual property of MMAR LLC. ATLAS is the intellectual property of Adherence Cartography. Written permission required prior to use. · 100 Oceangate, 12th Floor, Long Beach, CA 90802 · info@adherence.cc · www.adherence.cc</div>
  </div>`;
  document.body.appendChild(snap);
  document.body.classList.add('printing-lb');
  window.print();
  setTimeout(()=>{ document.body.classList.remove('printing-lb'); const e=document.getElementById('print-lb-snapshot'); if(e) e.remove(); }, 1500);
}

// ══════════════════════════════════════════════
// ZOE — AI VOICE AGENT (Web Speech API + Claude)
// ══════════════════════════════════════════════
// ── ZOE Multilingual support ──────────────────────────────────────────────────
// ZOE_SYSTEM and ZOE_QUESTIONS are built at session open from MMAS_QUESTIONS[lang]
// so ZOE asks questions, responds, and clarifies in the patient's chosen language.
// English constants below serve as the fallback if MMAS_QUESTIONS is unavailable.

// Short intro translations for the opening speech (spoken before Claude is called).
// Languages not listed fall back to the English intro — all questions/responses
// will still be in the correct language because the system prompt instructs Claude.
const _ZOE_INTRO_MAP = {
  en: "Hi, I'm ZOE, your ATLAS guide. I'll ask you eight questions about your medication — just answer naturally, however feels right. There are no wrong answers, and everything is completely anonymous. Ready? Let's begin.",
  ar: "مرحباً، أنا زوي، مرشدتك في أطلس. سأطرح عليك ثمانية أسئلة حول دوائك — أجب بشكل طبيعي، كما يناسبك. لا توجد إجابات خاطئة، وكل شيء سري تماماً. هل أنت مستعد؟ لنبدأ.",
  es: "Hola, soy ZOE, tu guía de ATLAS. Te haré ocho preguntas sobre tu medicación — responde naturalmente, como te parezca bien. No hay respuestas incorrectas, y todo es completamente anónimo. ¿Listo? Empecemos.",
  fr: "Bonjour, je suis ZOE, votre guide ATLAS. Je vais vous poser huit questions sur votre médicament — répondez naturellement, comme vous le sentez. Il n'y a pas de mauvaises réponses, et tout est complètement anonyme. Prêt ? Commençons.",
  de: "Hallo, ich bin ZOE, Ihr ATLAS-Leitfaden. Ich werde Ihnen acht Fragen zu Ihrer Medikation stellen — antworten Sie einfach natürlich, wie es sich für Sie richtig anfühlt. Es gibt keine falschen Antworten, und alles ist völlig anonym. Bereit? Fangen wir an.",
  pt: "Olá, sou ZOE, sua guia do ATLAS. Vou fazer oito perguntas sobre sua medicação — responda naturalmente, como se sentir bem. Não há respostas erradas, e tudo é completamente anônimo. Pronto? Vamos começar.",
  tr: "Merhaba, ben ZOE, ATLAS rehberinizim. Size ilacınız hakkında sekiz soru soracağım — doğal bir şekilde, size uygun gelen şekilde yanıtlayın. Yanlış cevap yoktur ve her şey tamamen anonimdir. Hazır mısınız? Başlayalım.",
  hi: "नमस्ते, मैं ZOE हूँ, आपकी ATLAS गाइड। मैं आपसे आपकी दवा के बारे में आठ सवाल पूछूँगी — बस स्वाभाविक रूप से जवाब दीजिए। कोई गलत जवाब नहीं है, और सब कुछ पूरी तरह से गुमनाम है। तैयार हैं? शुरू करते हैं।",
  ur: "ہیلو، میں ZOE ہوں، آپ کی ATLAS رہنما۔ میں آپ سے آپ کی دوائی کے بارے میں آٹھ سوال پوچھوں گی — بس قدرتی طریقے سے جواب دیں۔ کوئی غلط جواب نہیں ہے، اور سب کچھ مکمل طور پر گمنام ہے۔ تیار ہیں؟ شروع کرتے ہیں۔",
  zh: "您好，我是ZOE，您的ATLAS向导。我将问您八个关于您的药物的问题——请自然回答，按您觉得合适的方式。没有错误答案，一切都完全匿名。准备好了吗？让我们开始。",
  ja: "こんにちは、ZOEです。ATLASのガイドです。お薬について8つの質問をします。自然に、気軽にお答えください。間違いはなく、すべて完全に匿名です。準備はいいですか？では始めましょう。",
  ko: "안녕하세요, 저는 ZOE, ATLAS 가이드입니다. 귀하의 약에 대해 8가지 질문을 드리겠습니다. 자연스럽게, 편하게 답해 주세요. 틀린 답은 없으며 모두 완전히 익명입니다. 준비되셨나요? 시작해 봅시다.",
  ru: "Здравствуйте, я ZOE, ваш гид ATLAS. Я задам вам восемь вопросов о ваших лекарствах — просто отвечайте естественно, как вам удобно. Неправильных ответов нет, всё полностью анонимно. Готовы? Начнём.",
};

// UI status strings translated to match the 12 ZOE intro languages + Arabic.
// _zoeStr(key) returns the string in the active ZOE language (fallback → English).
const _ZOE_UI_STRINGS = {
  en: { listening:'Listening…', your_turn:'Your turn — tap Speak', thinking:'ZOE is thinking…', speaking:'ZOE is speaking…',
        complete:'Assessment complete ✓', ready:'Tap Speak when ready', no_speech:'No speech detected',
        no_catch:"I didn't catch that. Tap Speak when you're ready.",
        error_browser:'Voice not supported — use Chrome or Edge',
        error_connection:'Connection error — tap Speak to retry',
        error_retry:'I had trouble connecting. Tap Speak to retry, or close ZOE and use the manual form.',
        json_clarify:'Could you say yes or no for me?', json_compassion:'Let me make sure I understood you correctly.',
        intro_display:"Hi, I'm ZOE. Tap Speak and I'll guide you through your assessment." },
  ar: { listening:'أستمع…', your_turn:'دورك — اضغط تحدث', thinking:'ZOE تفكر…', speaking:'ZOE تتحدث…',
        complete:'اكتمل التقييم ✓', ready:'اضغط تحدث عندما تكون مستعدًا', no_speech:'لم يُكشف عن صوت',
        no_catch:'لم أسمعك. اضغط تحدث عندما تكون مستعدًا.',
        error_browser:'الصوت غير مدعوم — استخدم Chrome أو Edge',
        error_connection:'خطأ في الاتصال — اضغط تحدث للمحاولة مجددًا',
        error_retry:'واجهت مشكلة في الاتصال. اضغط تحدث للمحاولة مجددًا أو أغلق ZOE.',
        json_clarify:'هل يمكنك قول نعم أو لا؟', json_compassion:'دعني أتأكد من أنني فهمتك بشكل صحيح.',
        intro_display:'مرحباً، أنا ZOE. اضغط تحدث وسأرشدك خلال تقييمك.' },
  es: { listening:'Escuchando…', your_turn:'Tu turno — toca Hablar', thinking:'ZOE está pensando…', speaking:'ZOE está hablando…',
        complete:'Evaluación completa ✓', ready:'Toca Hablar cuando estés listo', no_speech:'No se detectó voz',
        no_catch:'No te escuché. Toca Hablar cuando estés listo.',
        error_browser:'Voz no compatible — usa Chrome o Edge',
        error_connection:'Error de conexión — toca Hablar para reintentar',
        error_retry:'Tuve problemas de conexión. Toca Hablar para reintentar, o cierra ZOE y usa el formulario manual.',
        json_clarify:'¿Podrías decir sí o no?', json_compassion:'Déjame asegurarme de que te entendí bien.',
        intro_display:'Hola, soy ZOE. Toca Hablar y te guiaré por tu evaluación.' },
  fr: { listening:"J'écoute…", your_turn:'À vous — appuyez sur Parler', thinking:'ZOE réfléchit…', speaking:'ZOE parle…',
        complete:'Évaluation terminée ✓', ready:'Appuyez sur Parler quand vous êtes prêt', no_speech:'Aucune voix détectée',
        no_catch:"Je n'ai pas bien entendu. Appuyez sur Parler quand vous êtes prêt.",
        error_browser:'Voix non prise en charge — utilisez Chrome ou Edge',
        error_connection:'Erreur de connexion — appuyez sur Parler pour réessayer',
        error_retry:'J\'ai eu du mal à me connecter. Appuyez sur Parler pour réessayer, ou fermez ZOE.',
        json_clarify:'Pourriez-vous dire oui ou non ?', json_compassion:"Laissez-moi vérifier que j'ai bien compris.",
        intro_display:'Bonjour, je suis ZOE. Appuyez sur Parler et je vous guiderai.' },
  de: { listening:'Ich höre zu…', your_turn:'Sie sind dran — tippen Sie Sprechen', thinking:'ZOE denkt nach…', speaking:'ZOE spricht…',
        complete:'Beurteilung abgeschlossen ✓', ready:'Tippen Sie Sprechen, wenn Sie bereit sind', no_speech:'Keine Sprache erkannt',
        no_catch:'Ich habe Sie nicht verstanden. Tippen Sie Sprechen, wenn Sie bereit sind.',
        error_browser:'Sprache nicht unterstützt — verwenden Sie Chrome oder Edge',
        error_connection:'Verbindungsfehler — tippen Sie Sprechen zum Wiederholen',
        error_retry:'Ich hatte Verbindungsprobleme. Tippen Sie Sprechen zum Wiederholen oder schließen Sie ZOE.',
        json_clarify:'Könnten Sie ja oder nein sagen?', json_compassion:'Lassen Sie mich sicherstellen, dass ich Sie richtig verstanden habe.',
        intro_display:'Hallo, ich bin ZOE. Tippen Sie Sprechen und ich führe Sie durch Ihre Beurteilung.' },
  pt: { listening:'Ouvindo…', your_turn:'Sua vez — toque Falar', thinking:'ZOE está pensando…', speaking:'ZOE está falando…',
        complete:'Avaliação completa ✓', ready:'Toque Falar quando estiver pronto', no_speech:'Nenhuma fala detectada',
        no_catch:'Não ouvi você. Toque Falar quando estiver pronto.',
        error_browser:'Voz não suportada — use Chrome ou Edge',
        error_connection:'Erro de conexão — toque Falar para tentar novamente',
        error_retry:'Tive problemas de conexão. Toque Falar para tentar novamente ou feche o ZOE.',
        json_clarify:'Você poderia dizer sim ou não?', json_compassion:'Deixe-me ter certeza de que entendi você corretamente.',
        intro_display:'Olá, sou ZOE. Toque Falar e vou guiá-lo pela avaliação.' },
  tr: { listening:'Dinliyorum…', your_turn:'Sıranız — Konuş\'a dokunun', thinking:'ZOE düşünüyor…', speaking:'ZOE konuşuyor…',
        complete:'Değerlendirme tamamlandı ✓', ready:"Hazır olduğunuzda Konuş'a dokunun", no_speech:'Ses algılanmadı',
        no_catch:"Sizi duymadım. Hazır olduğunuzda Konuş'a dokunun.",
        error_browser:'Ses desteklenmiyor — Chrome veya Edge kullanın',
        error_connection:'Bağlantı hatası — tekrar denemek için Konuş\'a dokunun',
        error_retry:"Bağlanmakta sorun yaşadım. Tekrar denemek için Konuş'a dokunun veya ZOE'yu kapatın.",
        json_clarify:'Evet ya da hayır diyebilir misiniz?', json_compassion:'Sizi doğru anlayıp anlamadığımı kontrol edeyim.',
        intro_display:"Merhaba, ben ZOE. Konuş'a dokunun, sizi yönlendireceğim." },
  hi: { listening:'सुन रही हूँ…', your_turn:'आपकी बारी — बोलें दबाएँ', thinking:'ZOE सोच रही है…', speaking:'ZOE बोल रही है…',
        complete:'मूल्यांकन पूर्ण ✓', ready:'तैयार होने पर बोलें दबाएँ', no_speech:'कोई आवाज़ नहीं सुनी',
        no_catch:'मैं सुन नहीं पाई। तैयार होने पर बोलें दबाएँ।',
        error_browser:'आवाज़ समर्थित नहीं — Chrome या Edge का उपयोग करें',
        error_connection:'कनेक्शन त्रुटि — पुनः प्रयास के लिए बोलें दबाएँ',
        error_retry:'मुझे कनेक्ट करने में समस्या हुई। पुनः प्रयास के लिए बोलें दबाएँ या ZOE बंद करें।',
        json_clarify:'क्या आप हाँ या नहीं कह सकते हैं?', json_compassion:'मुझे सुनिश्चित करने दीजिए कि मैंने आपको सही समझा।',
        intro_display:'नमस्ते, मैं ZOE हूँ। बोलें दबाएँ और मैं आपका मार्गदर्शन करूँगी।' },
  ur: { listening:'سن رہی ہوں…', your_turn:'آپ کی باری — بولیں دبائیں', thinking:'ZOE سوچ رہی ہے…', speaking:'ZOE بول رہی ہے…',
        complete:'تشخیص مکمل ✓', ready:'تیار ہونے پر بولیں دبائیں', no_speech:'کوئی آواز نہیں آئی',
        no_catch:'میں سن نہیں سکی۔ تیار ہونے پر بولیں دبائیں۔',
        error_browser:'آواز سپورٹ نہیں — Chrome یا Edge استعمال کریں',
        error_connection:'کنکشن کی خرابی — دوبارہ کوشش کے لیے بولیں دبائیں',
        error_retry:'مجھے کنیکٹ کرنے میں مسئلہ ہوا۔ دوبارہ کوشش کے لیے بولیں دبائیں یا ZOE بند کریں۔',
        json_clarify:'کیا آپ ہاں یا نہیں کہہ سکتے ہیں؟', json_compassion:'مجھے یقین کرنے دیں کہ میں نے آپ کو صحیح سمجھا۔',
        intro_display:'ہیلو، میں ZOE ہوں۔ بولیں دبائیں اور میں آپ کی رہنمائی کروں گی۔' },
  zh: { listening:'正在聆听…', your_turn:'请发言 — 点击说话', thinking:'ZOE 正在思考…', speaking:'ZOE 正在说话…',
        complete:'评估完成 ✓', ready:'准备好后点击说话', no_speech:'未检测到语音',
        no_catch:'我没听清楚。准备好后请点击说话。',
        error_browser:'不支持语音 — 请使用 Chrome 或 Edge',
        error_connection:'连接错误 — 点击说话重试',
        error_retry:'我遇到连接问题。请点击说话重试，或关闭 ZOE 使用手动表格。',
        json_clarify:'您能说是或否吗？', json_compassion:'让我确认一下我是否正确理解了您的回答。',
        intro_display:'您好，我是 ZOE。点击说话，我将指导您完成评估。' },
  ja: { listening:'聴いています…', your_turn:'あなたの番です — 話すをタップ', thinking:'ZOE は考えています…', speaking:'ZOE が話しています…',
        complete:'評価完了 ✓', ready:'準備ができたら話すをタップ', no_speech:'音声が検出されませんでした',
        no_catch:'聞き取れませんでした。準備ができたら話すをタップしてください。',
        error_browser:'音声未対応 — Chrome または Edge をご使用ください',
        error_connection:'接続エラー — 話すをタップして再試行',
        error_retry:'接続に問題がありました。話すをタップして再試行するか、ZOE を閉じてください。',
        json_clarify:'はいかいいえで答えていただけますか？', json_compassion:'正しく理解できているか確認させてください。',
        intro_display:'こんにちは、ZOE です。話すをタップすると評価をガイドします。' },
  ko: { listening:'듣고 있습니다…', your_turn:'당신의 차례입니다 — 말하기 탭', thinking:'ZOE 가 생각 중입니다…', speaking:'ZOE 가 말하고 있습니다…',
        complete:'평가 완료 ✓', ready:'준비가 되면 말하기를 탭하세요', no_speech:'음성이 감지되지 않았습니다',
        no_catch:'잘 들리지 않았습니다. 준비가 되면 말하기를 탭하세요.',
        error_browser:'음성 미지원 — Chrome 또는 Edge 를 사용하세요',
        error_connection:'연결 오류 — 말하기를 탭해 재시도',
        error_retry:'연결에 문제가 있었습니다. 말하기를 탭해 재시도하거나 ZOE 를 닫으세요.',
        json_clarify:'예 또는 아니오라고 말씀해 주시겠습니까?', json_compassion:'제가 올바르게 이해했는지 확인하겠습니다.',
        intro_display:'안녕하세요, ZOE 입니다. 말하기를 탭하면 평가를 안내해 드리겠습니다.' },
  ru: { listening:'Слушаю…', your_turn:'Ваша очередь — нажмите Говорить', thinking:'ZOE думает…', speaking:'ZOE говорит…',
        complete:'Оценка завершена ✓', ready:'Нажмите Говорить, когда будете готовы', no_speech:'Речь не обнаружена',
        no_catch:'Я не расслышала вас. Нажмите Говорить, когда будете готовы.',
        error_browser:'Голос не поддерживается — используйте Chrome или Edge',
        error_connection:'Ошибка подключения — нажмите Говорить для повтора',
        error_retry:'Возникла проблема с подключением. Нажмите Говорить для повтора или закройте ZOE.',
        json_clarify:'Вы можете сказать да или нет?', json_compassion:'Позвольте убедиться, что я правильно вас поняла.',
        intro_display:'Здравствуйте, я ZOE. Нажмите Говорить, и я проведу вас через оценку.' },
};
// Helper — resolves a UI string in the current ZOE session language.
function _zoeStr(key) {
  const lang = window._zoeActiveLang || (typeof mmasCurrentLang !== 'undefined' ? mmasCurrentLang : 'en');
  return (_ZOE_UI_STRINGS[lang] || _ZOE_UI_STRINGS['en'])[key] || _ZOE_UI_STRINGS['en'][key] || '';
}

// Builds the Claude system prompt with language instruction injected.
function _buildZoeSystem(langName, questions) {
  const langLine = (langName && langName !== 'English')
    ? `\n\nIMPORTANT — LANGUAGE: The patient's selected language is ${langName}. Conduct the ENTIRE assessment in ${langName}. All questions, compassionate responses, and clarifications MUST be in ${langName}. Never switch to English.`
    : '';
  return `You are ZOE, a compassionate AI health guide conducting an MMAS-8 medication adherence assessment for the Adherence Cartography ATLAS platform (Philip Morisky, Founder & Chief Optimus, Adherence Inc.).

MMAS-8 QUESTIONS — ask in order, exactly as written:
Q1: ${questions[0]}
Q2: ${questions[1]}
Q3: ${questions[2]}
Q4: ${questions[3]}
Q5: ${questions[4]}
Q6: ${questions[5]}
Q7: ${questions[6]}
Q8: ${questions[7]}

SCORING:
Q1-Q4, Q6, Q7: YES=0, NO=1
Q5: YES=1, NO=0 (reversed — taking medicine yesterday is good)
Q8: Never/Rarely=1, Once in a while=0.75, Sometimes=0.5, Usually=0.25, All the time=0

YOUR ROLE:
- Listen to natural speech. Extract the clinical answer even from long, nuanced responses.
- Respond with genuine warmth — one brief compassionate acknowledgment before moving on.
- You are a caring human guide, not a clinical form.
- If the patient sounds distressed or shares something difficult, acknowledge it gently.
- If the answer is ambiguous, ask one short clarifying question.
- Never explain the scoring system to the patient.
- Keep responses concise: 1-2 sentences maximum.${langLine}

OUTPUT — respond ONLY with valid JSON, no preamble, no markdown:
{"extracted_answer":"yes|no|never|rarely|sometimes|often|always|unclear","score_value":0-1_or_null,"compassionate_response":"1-2 warm sentences","needs_clarification":true_or_false,"clarification_prompt":"only if needs_clarification"}`;
}

// Builds the 8-question array from MMAS_QUESTIONS[lang], replacing {{COND}} with 'medication'.
// Falls back to English if the language isn't in the set.
function _buildZoeQuestions(lang) {
  const lq = (typeof MMAS_QUESTIONS !== 'undefined' && MMAS_QUESTIONS[lang])
           || (typeof MMAS_QUESTIONS !== 'undefined' && MMAS_QUESTIONS['en'])
           || null;
  if (!lq) return _ZOE_QUESTIONS_EN; // hard fallback
  const r = t => (t || '').replace(/\{\{COND\}\}/g, 'medication');
  // Q8 gets the frequency options appended only for English (other langs: Claude handles it)
  const q8suffix = (lang === 'en')
    ? ' You can say: never or rarely, once in a while, sometimes, usually, or all the time.'
    : '';
  return [r(lq.q1), r(lq.q2), r(lq.q3), r(lq.q4), r(lq.q5), r(lq.q6), r(lq.q7), r(lq.q8) + q8suffix];
}

// English fallback constants (used when MMAS_QUESTIONS not yet loaded)
const _ZOE_QUESTIONS_EN = [
  "Do you sometimes forget to take your pills?",
  "People sometimes miss taking their medications for reasons other than forgetting. Over the past two weeks, were there any days when you did not take your medicine?",
  "Have you ever cut back or stopped taking your medication without telling your doctor, because you felt worse when you took it?",
  "When you travel or leave home, do you sometimes forget to bring along your medication?",
  "Did you take your medicine yesterday?",
  "When you feel like your condition is under control, do you sometimes stop taking your medicine?",
  "Taking medication every day is a real inconvenience for some people. Do you ever feel hassled about sticking to your treatment plan?",
  "How often do you have difficulty remembering to take all your medication? You can say: never or rarely, once in a while, sometimes, usually, or all the time."
];

// Session-active copies — set at zoeOpen() from current language, used throughout the session
let _zoeSessionSystem    = null;
let _zoeSessionQuestions = null;
const ZOE_Q8_MAP = {never:1,rarely:1,'once in a while':0.75,sometimes:0.5,usually:0.25,'all the time':0};

let zoeActive=false,zoeCurrQ=0,zoeScores=[],zoeHistory=[];
let zoeRecognition=null,zoeSynth=window.speechSynthesis;
let zoeListening=false,zoeProcessing=false;

function _zId(id){return document.getElementById(id);}
function zoeSetStatus(t,c){const e=_zId('zoe-status');if(e){e.textContent=t;e.style.color=c||'rgba(139,111,245,0.7)';}}
function zoeSetQ(t){const e=_zId('zoe-q-display');if(e)e.textContent=t;}
function zoeSetTranscript(t){const e=_zId('zoe-transcript');if(e)e.textContent=t?`"${t}"`:''; }
function zoeSetResponse(t){const e=_zId('zoe-response');if(e)e.textContent=t;}
function zoeSetPill(i,s){const e=_zId('zoe-pill-'+i);if(!e)return;e.style.background=s==='done'?'#10b981':s==='active'?'rgba(139,111,245,0.8)':'rgba(255,255,255,0.1)';}
function zoeShowControls(show){const m=_zId('zoe-mic-btn'),s=_zId('zoe-skip-btn');if(m)m.style.display=show?'block':'none';if(s)s.style.display=show?'block':'none';}
function zoeSetOrb(mode){
  const orb=_zId('zoe-orb'),icon=_zId('zoe-orb-icon'),pulse=_zId('zoe-pulse-ring'),listen=_zId('zoe-listen-ring');
  if(!orb)return;
  const styles={
    speaking:{bg:'radial-gradient(circle at 40% 35%,rgba(139,111,245,0.7),rgba(78,156,245,0.4) 50%,rgba(46,201,138,0.2) 100%)',sh:'0 0 60px rgba(139,111,245,0.5),0 0 120px rgba(139,111,245,0.2)',ic:'🔊',p:true,l:false},
    listening:{bg:'radial-gradient(circle at 40% 35%,rgba(46,201,138,0.7),rgba(78,156,245,0.3) 50%,rgba(139,111,245,0.1) 100%)',sh:'0 0 60px rgba(46,201,138,0.5),0 0 120px rgba(46,201,138,0.2)',ic:'🎙',p:false,l:true,anim:'zoeListening 1.4s ease-in-out infinite'},
    thinking:{bg:'radial-gradient(circle at 40% 35%,rgba(212,168,67,0.5),rgba(139,111,245,0.3) 50%,rgba(78,156,245,0.1) 100%)',sh:'0 0 40px rgba(212,168,67,0.3)',ic:'💭',p:true,l:false}
  };
  const s=styles[mode]||{bg:'radial-gradient(circle at 40% 35%,rgba(139,111,245,0.6),rgba(78,156,245,0.3) 50%,rgba(46,201,138,0.15) 100%)',sh:'0 0 40px rgba(139,111,245,0.3)',ic:'🎙',p:false,l:false};
  orb.style.background=s.bg; orb.style.boxShadow=s.sh; orb.style.animation=s.anim||'';
  if(icon)icon.textContent=s.ic;
  if(pulse)pulse.style.display=s.p?'block':'none';
  if(listen)listen.style.display=s.l?'block':'none';
}

function zoeSpeak(text,onEnd){
  if(!zoeSynth){if(onEnd)onEnd();return;}
  zoeSynth.cancel();
  const utt=new SpeechSynthesisUtterance(text);
  utt.rate=0.92;utt.pitch=1.15;utt.volume=1;
  const voices=zoeSynth.getVoices();
  // Resolve current language BCP-47 for voice matching
  const _zoeLangBCP47 = (() => {
    const map = {
      en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', it:'it-IT', pt:'pt-PT', nl:'nl-NL',
      ru:'ru-RU', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', ar:'ar-SA', hi:'hi-IN', tr:'tr-TR',
      pl:'pl-PL', sv:'sv-SE', da:'da-DK', fi:'fi-FI', nb:'nb-NO', cs:'cs-CZ', sk:'sk-SK',
      hu:'hu-HU', ro:'ro-RO', hr:'hr-HR', bg:'bg-BG', uk:'uk-UA', el:'el-GR', he:'he-IL',
      th:'th-TH', id:'id-ID', ms:'ms-MY', vi:'vi-VN', fa:'fa-IR', ur:'ur-PK', bn:'bn-BD',
      sw:'sw-KE'
    };
    return map[mmasCurrentLang] || (mmasCurrentLang.includes('-') ? mmasCurrentLang : 'en-US');
  })();
  // 6-tier fallback voice chain per spec
  const v = voices.find(v=>/samantha|karen|victoria|susan|serena|zira|hazel|moira|fiona|tessa/i.test(v.name)&&v.lang.startsWith(_zoeLangBCP47.split('-')[0]))
    || voices.find(v=>v.lang.startsWith(_zoeLangBCP47.split('-')[0])&&/female|woman|girl/i.test(v.name))
    || voices.find(v=>v.lang.startsWith(_zoeLangBCP47.split('-')[0])&&v.gender==='female')
    || voices.find(v=>v.lang.startsWith('en-US')&&v.localService)
    || voices.find(v=>v.lang.startsWith('en'))
    || voices[0];
  if(v)utt.voice=v;
  utt.lang=_zoeLangBCP47;  // must be set explicitly — voice selection alone doesn't guarantee correct phonetics
  utt.onend=()=>{if(onEnd)onEnd();};
  utt.onerror=()=>{if(onEnd)onEnd();};
  zoeSetOrb('speaking');
  zoeSynth.speak(utt);
}

function zoeStartListening(){
  // On first tap: play intro + Q1, then listening begins after speech
  if(zoePlayIntroThenListen()) return;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){zoeSetStatus(_zoeStr('error_browser'),'#ef4444');return;}
  if(zoeRecognition)try{zoeRecognition.abort();}catch(e){}
  zoeRecognition=new SR();
  zoeRecognition.continuous=false;zoeRecognition.interimResults=true;
  // Follow mmasCurrentLang with full BCP-47 map; graceful fallback to en-US
  const _recLangMap = {
    en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', it:'it-IT', pt:'pt-PT', nl:'nl-NL',
    ru:'ru-RU', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', ar:'ar-SA', hi:'hi-IN', tr:'tr-TR',
    pl:'pl-PL', sv:'sv-SE', da:'da-DK', fi:'fi-FI', nb:'nb-NO', cs:'cs-CZ', sk:'sk-SK',
    hu:'hu-HU', ro:'ro-RO', hr:'hr-HR', bg:'bg-BG', uk:'uk-UA', el:'el-GR', he:'he-IL',
    th:'th-TH', id:'id-ID', ms:'ms-MY', vi:'vi-VN', fa:'fa-IR', ur:'ur-PK', bn:'bn-BD',
    sw:'sw-KE'
  };
  zoeRecognition.lang = _recLangMap[mmasCurrentLang] || (mmasCurrentLang.includes('-') ? mmasCurrentLang : 'en-US');
  zoeRecognition.onstart=()=>{
    zoeListening=true;zoeSetOrb('listening');zoeSetStatus(_zoeStr('listening'),'rgba(46,201,138,0.8)');zoeSetTranscript('');
    const m=_zId('zoe-mic-btn');if(m){m.textContent='⏹ Stop';m.style.borderColor='rgba(46,201,138,0.6)';}
  };
  zoeRecognition.onresult=e=>{
    const t=Array.from(e.results).map(r=>r[0].transcript).join('');
    zoeSetTranscript(t);
    if(e.results[e.results.length-1].isFinal){zoeListening=false;zoeHandleResponse(t);}
  };
  zoeRecognition.onerror=e=>{
    zoeListening=false;zoeSetOrb('idle');
    if(e.error==='no-speech'){zoeSetStatus(_zoeStr('no_speech'),'rgba(212,168,67,0.7)');zoeSetResponse(_zoeStr('no_catch'));}
    else zoeSetStatus('Mic error: '+e.error,'#ef4444');
    const m=_zId('zoe-mic-btn');if(m){m.textContent='🎙 Speak';m.style.borderColor='rgba(139,111,245,0.4)';}
    zoeShowControls(true);
  };
  zoeRecognition.onend=()=>{
    zoeListening=false;
    const m=_zId('zoe-mic-btn');if(m){m.textContent='🎙 Speak';m.style.borderColor='rgba(139,111,245,0.4)';}
    if(!zoeProcessing)zoeSetOrb('idle');
  };
  try{zoeRecognition.start();}catch(e){zoeSetStatus('Could not start mic','#ef4444');zoeShowControls(true);}
}

async function zoeHandleResponse(transcript){
  if(!zoeActive||zoeProcessing)return;
  zoeProcessing=true;
  zoeSetOrb('thinking');zoeSetStatus(_zoeStr('thinking'),'rgba(212,168,67,0.7)');zoeShowControls(false);
  const _activeQs = _zoeSessionQuestions || _ZOE_QUESTIONS_EN;
  const qText=_activeQs[zoeCurrQ];
  zoeHistory.push({role:'user',content:`[Q${zoeCurrQ+1}: "${qText}"]\nPatient said: "${transcript}"`});
  try{
    // ── ZOE routes through Lambda proxy — API key never exposed in client ──
    const resp=await fetch('/lambda-proxy/zoe',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:350,system:(_zoeSessionSystem||''),messages:zoeHistory})
    });
    const data=await resp.json();
    const raw=data.content?.[0]?.text||'{}';
    let p;
    try{p=JSON.parse(raw.replace(/```json|```/g,'').trim());}
    catch{p={needs_clarification:true,clarification_prompt:_zoeStr('json_clarify'),compassionate_response:_zoeStr('json_compassion')};}
    zoeHistory.push({role:'assistant',content:raw});

    if(p.needs_clarification){
      const msg=(p.compassionate_response||'')+' '+(p.clarification_prompt||'');
      zoeSetResponse(msg);
      zoeSpeak(msg,()=>{zoeProcessing=false;zoeSetOrb('idle');zoeSetStatus(_zoeStr('your_turn'),'rgba(139,111,245,0.7)');zoeShowControls(true);});
    } else {
      // Compute score value
      let sv=p.score_value;
      if(sv===null||sv===undefined||isNaN(sv)){
        if(zoeCurrQ===4) sv=p.extracted_answer==='yes'?1:0;
        else if(zoeCurrQ===7) sv=ZOE_Q8_MAP[p.extracted_answer]??0;
        else sv=p.extracted_answer==='no'?1:0;
      }
      zoeScores[zoeCurrQ]=sv;
      // Store in mmasAnswers for submit compatibility
      if(zoeCurrQ===7){
        // Q8 stores as the verbal answer for renderMMASQuestions
        mmasAnswers['q8']=p.extracted_answer||'sometimes';
      } else if(zoeCurrQ===4) {
        // Q5 is reversed: sv=1 means patient took last dose (answered 'yes') — store 'yes'
        mmasAnswers['q5'] = sv===1 ? 'yes' : 'no';
      } else {
        mmasAnswers['q'+(zoeCurrQ+1)]=sv===1?'no':'yes'; // reverse back to yes/no for Q1-Q4, Q6-Q7
      }
      // Override: store numeric directly for scoring
      mmasAnswers['_zoe_q'+(zoeCurrQ+1)]=sv;

      zoeSetPill(zoeCurrQ,'done');
      zoeSetResponse(p.compassionate_response||'');
      const nxt=zoeCurrQ+1;
      zoeSpeak(p.compassionate_response||'',()=>{
        if(!zoeActive)return;
        if(nxt>=8){
          zoeSetStatus(_zoeStr('complete'),'rgba(46,201,138,0.8)');
          zoeSetQ('');
          const _zoeOutro = {
            ar:'لقد أكملت جميع الأسئلة الثمانية. أحسنت. نتيجتك جاهزة الآن.',
            es:'Has completado las ocho preguntas. Muy bien. Tu resultado está listo ahora.',
            fr:'Vous avez répondu aux huit questions. Bien joué. Votre résultat est prêt.',
            de:'Sie haben alle acht Fragen beantwortet. Gut gemacht. Ihr Ergebnis ist jetzt fertig.',
            pt:'Você completou as oito perguntas. Muito bem. Seu resultado está pronto agora.',
            tr:'Sekiz soruyu da tamamladınız. Çok iyi. Sonucunuz şimdi hazır.',
            hi:'आपने सभी आठ प्रश्न पूरे कर लिए। बहुत अच्छे। आपका परिणाम अभी तैयार है।',
            ur:'آپ نے تمام آٹھ سوال مکمل کر لیے۔ شاباش۔ آپ کا نتیجہ اب تیار ہے۔',
            zh:'您已完成所有八道题。做得好。您的结果现在已准备好。',
            ja:'8つの質問をすべて答えていただきました。よくできました。結果がご覧いただけます。',
            ko:'여덟 가지 질문을 모두 완료했습니다. 잘 하셨습니다. 결과가 준비되었습니다.',
            ru:'Вы ответили на все восемь вопросов. Отлично. Ваш результат готов.',
          }[window._zoeActiveLang || 'en'] || 'You\'ve completed all eight questions. Well done. Your result is ready now.';
          zoeSpeak(_zoeOutro,()=>{
            zoeFinalize();
          });
        } else {
          zoeCurrQ=nxt;zoeSetPill(zoeCurrQ,'active');
          const qt=(_zoeSessionQuestions || _ZOE_QUESTIONS_EN)[zoeCurrQ];
          zoeSetQ(qt);zoeSetResponse('');zoeProcessing=false;
          setTimeout(()=>{
            if(!zoeActive)return;
            zoeSetOrb('speaking');zoeSetStatus(_zoeStr('speaking'),'rgba(139,111,245,0.7)');
            zoeSpeak(qt,()=>{
              if(!zoeActive)return;
              zoeSetOrb('idle');zoeSetStatus(_zoeStr('your_turn'),'rgba(139,111,245,0.7)');zoeShowControls(true);
            });
          },350);
        }
      });
      if(nxt<8)zoeProcessing=false;
    }
  }catch(err){
    zoeProcessing=false;zoeSetOrb('idle');
    zoeSetStatus(_zoeStr('error_connection'),'#ef4444');
    zoeSetResponse(_zoeStr('error_retry'));
    zoeShowControls(true);
  }
}


/**
 * Opens the ZOE voice assistant overlay and begins the MMAS-8 voice-guided assessment.
 * Initialises the orb animation and triggers the intro speech sequence.
 * @returns {void}
 */
function zoeOpen(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){showToast('Voice input requires Chrome or Edge. Please switch browsers to use ZOE.');return;}

  // ── SDoH gate: country required before ZOE starts ──
  const countryField = document.getElementById('sdoh-country');
  const countryVal   = countryField?.value?.trim();
  if (!countryVal) {
    showToast('Please enter your country above before starting ZOE.', 4000);
    countryField?.scrollIntoView({ behavior:'smooth', block:'center' });
    setTimeout(() => countryField?.focus(), 500);
    if (countryField) {
      countryField.style.borderColor = 'rgba(239,68,68,0.8)';
      countryField.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.2)';
      setTimeout(() => { countryField.style.borderColor=''; countryField.style.boxShadow=''; }, 2500);
    }
    return;
  }

  // ── Snapshot SDoH fields before overlay covers them ──
  window._zoeSdohSnapshot = {
    country:     normalizeCountry(countryVal),
    city:        document.getElementById('sdoh-city')?.value?.trim() || '',
    patientNum:  document.getElementById('sdoh-patient-num')?.value?.trim() || null,
    studyId:     document.getElementById('sdoh-study-id')?.value?.trim()?.toUpperCase() || null,
    gender:      document.getElementById('sdoh-gender')?.value || null,
    ageRange:    document.getElementById('sdoh-age')?.value || null,
    education:   document.getElementById('sdoh-education')?.value || null,
    drugType:    document.getElementById('sdoh-drug-type')?.value || null,
    drugName:    document.getElementById('sdoh-drug-name')?.value?.trim() || null,
    drugStrength:document.getElementById('sdoh-drug-strength')?.value?.trim() || null,
    route:       document.getElementById('sdoh-route')?.value || null,
    condition: (()=>{
      const sel=document.getElementById('sdoh-condition');
      const other=document.getElementById('sdoh-condition-other')?.value?.trim()||'';
      if(!sel)return null;
      const vals=Array.from(sel.selectedOptions).map(o=>o.value).filter(Boolean);
      return vals.length?vals.map(c=>c==='Other'?(other||'Other'):c).join('; '):null;
    })()
  };

  // Build language-aware session system prompt and questions from current language selection
  const _zsLang = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang) || 'en';
  const _zsLangName = (typeof MMAS_QUESTIONS !== 'undefined' && MMAS_QUESTIONS[_zsLang]?.name) || 'English';
  _zoeSessionQuestions = _buildZoeQuestions(_zsLang);
  _zoeSessionSystem    = _buildZoeSystem(_zsLangName, _zoeSessionQuestions);
  window._zoeActiveLang = _zsLang;

  zoeActive=true; zoeCurrQ=0; zoeScores=[]; zoeHistory=[]; mmasAnswers={};
  window._zoeIntroPlayed = false;  // track whether intro has been spoken yet

  // ── Open inline panel — SILENT. Patient taps Speak to begin. ──
  const overlay=_zId('zoe-overlay');
  if(overlay) overlay.classList.add('active');
  for(let i=0;i<8;i++) zoeSetPill(i, i===0?'active':'');
  zoeSetOrb('idle');
  zoeSetStatus(_zoeStr('ready'),'rgba(139,111,245,0.7)');
  zoeSetQ(_zoeStr('intro_display'));
  zoeSetResponse('');
  zoeSetTranscript('');
  zoeShowControls(true);  // show Speak + Skip immediately — patient is in control
  // Scroll inline panel into view
  setTimeout(()=>{ overlay?.scrollIntoView({behavior:'smooth',block:'start'}); }, 100);
}

// Called the first time patient taps Speak — plays intro then Q1
function zoePlayIntroThenListen(){
  if(window._zoeIntroPlayed) return false;  // already done
  window._zoeIntroPlayed = true;
  zoeShowControls(false);
  zoeSetOrb('speaking'); zoeSetStatus(_zoeStr('speaking'),'rgba(139,111,245,0.7)');
  zoeSetQ('');
  const _introLang = window._zoeActiveLang || 'en';
  const intro = _ZOE_INTRO_MAP[_introLang] || _ZOE_INTRO_MAP['en'];
  zoeSpeak(intro,()=>{
    if(!zoeActive)return;
    const q1=(_zoeSessionQuestions || _ZOE_QUESTIONS_EN)[0];
    zoeSetQ(q1);
    zoeSpeak(q1,()=>{
      if(!zoeActive)return;
      zoeSetOrb('idle'); zoeSetStatus(_zoeStr('your_turn'),'rgba(139,111,245,0.7)'); zoeShowControls(true);
    });
  });
  return true;
}

/**
 * Closes the ZOE voice assistant overlay, stops speech synthesis and recognition.
 * @returns {void}
 */
function zoeClose(){
  zoeActive=false;
  if(zoeRecognition)try{zoeRecognition.abort();}catch(e){}
  if(zoeSynth)zoeSynth.cancel();
  const overlay=_zId('zoe-overlay');
  if(overlay) overlay.classList.remove('active');
  zoeSetOrb('idle');
  window._zoeIntroPlayed = false;
  const btn = _zId('zoe-launch-btn');
  if(btn) btn.scrollIntoView({behavior:'smooth',block:'center'});
}

// ══════════════════════════════════════════════
// ZOE COHORT BRIEFING — one-click AI audio summary
// ══════════════════════════════════════════════
async function triggerZoeBriefing() {
  const btn  = document.getElementById('zoe-briefing-btn');
  const icon = document.getElementById('zoe-briefing-icon');
  if (!btn) return;

  // Guard: already running
  if (btn.dataset.running === '1') {
    if (zoeSynth) zoeSynth.cancel();
    btn.dataset.running = '0';
    btn.style.borderColor = 'rgba(212,168,67,0.25)';
    btn.style.color = 'rgba(212,168,67,0.8)';
    if (icon) icon.textContent = '◉';
    return;
  }

  // Build cohort snapshot from live globals
  const mmas  = (typeof dashMmasData  !== 'undefined') ? dashMmasData  : [];
  const peacs = (typeof dashPeacsData !== 'undefined') ? dashPeacsData : [];

  if (!mmas.length && !peacs.length) {
    showToast('No cohort data loaded yet — open the dashboard first.', 3000);
    return;
  }

  // Compute quick stats
  const n       = mmas.length;
  const valid   = mmas.filter(r => r.score !== undefined && r.score !== null);
  const avgS    = valid.length ? (valid.reduce((s,r)=>s+(r.score||0),0)/valid.length).toFixed(2) : null;
  const hiPct   = valid.length ? Math.round(valid.filter(r=>r.score===8).length/valid.length*100) : null;
  const inaPct  = valid.length ? Math.round(valid.filter(r=>r.score<6).length/valid.length*100)  : null;
  const unaPct  = valid.length ? Math.round(valid.filter(r=>r.score>=6&&r.score<8).length/valid.length*100) : null;
  const countries = [...new Set(valid.map(r=>r.country).filter(c=>c&&c!=='Unknown'))];
  const topCo   = countries.slice(0,3).join(', ');

  const pValid  = peacs.filter(r=>r.pe!==undefined&&r.pe!==null);
  const avgPE   = pValid.length ? (pValid.reduce((s,r)=>s+(r.pe||0),0)/pValid.length).toFixed(3) : null;

  const ws = (typeof currentWorkspace !== 'undefined' && currentWorkspace) ? currentWorkspace : 'your cohort';

  const prompt = `You are ZOE, the AI voice of the ATLAS platform by Adherence Cartography. 
Deliver a sharp, 4-sentence clinical briefing — spoken aloud — for workspace ${ws}.
Data: ${n} MMAS-8 assessments${avgS?`, mean score ${avgS}/8`:''}${hiPct!==null?`, ${hiPct}% high adherence`:''}${inaPct!==null?`, ${inaPct}% inadequate`:''}${topCo?`, top countries: ${topCo}`:''}${avgPE?`. PEACS PE mean: ${avgPE}`:''}${pValid.length?` across ${pValid.length} PEACS profiles`:''}.
Keep it under 60 words. Start with "Cohort briefing:" and end with one actionable clinical insight. No markdown, no bullet points — pure spoken prose.`;

  // Visual: loading state
  btn.dataset.running = '1';
  btn.style.color = 'rgba(212,168,67,1)';
  btn.style.borderColor = 'rgba(212,168,67,0.6)';
  if (icon) { icon.textContent = '…'; }
  showToast('ZOE is preparing your briefing…', 2000);

  try {
    const res = await fetch(`${LAMBDA_URL}/zoe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        workspace_key: (typeof currentWorkspace !== 'undefined') ? currentWorkspace : '',
        mode: 'briefing'
      })
    });

    if (!res.ok) throw new Error('Lambda ' + res.status);
    const data = await res.json();
    const text = (data.response || data.text || data.content || '').trim();
    if (!text) throw new Error('Empty response');

    if (icon) icon.textContent = '▶';
    showToast('ZOE Briefing ready', 1500);

    // Speak via Web Speech API
    zoeSpeak(text, () => {
      btn.dataset.running = '0';
      btn.style.color = 'rgba(212,168,67,0.8)';
      btn.style.borderColor = 'rgba(212,168,67,0.25)';
      if (icon) icon.textContent = '◉';
    });

  } catch(err) {
    // Fallback: speak a locally-generated briefing without Lambda
    console.error('ZOE briefing Lambda error:', err);
    const fallback = avgS
      ? `Cohort briefing: workspace ${ws} has ${n} MMAS-8 assessments with a mean score of ${avgS} out of 8. ${hiPct}% of patients show high adherence, while ${inaPct}% remain inadequate.${avgPE ? ` PEACS predictive emergence averages ${avgPE} across ${pValid.length} profiles.` : ''} Priority action: target inadequate patients for structured intervention.`
      : `No cohort data available for briefing yet.`;

    if (icon) icon.textContent = '▶';
    zoeSpeak(fallback, () => {
      btn.dataset.running = '0';
      btn.style.color = 'rgba(212,168,67,0.8)';
      btn.style.borderColor = 'rgba(212,168,67,0.25)';
      if (icon) icon.textContent = '◉';
    });
  }
}



// ══════════════════════════════════════════════════════════════════════════
// MTM AUDIT LOG — Medication Therapy Management encounter documentation
// Auto-populates from cohort MMAS-8 data. Formats for CMS CPT 99605/06/07.
// Pharmacist / Researcher tier feature.
// ══════════════════════════════════════════════════════════════════════════

function mtmSuggestCPT(record, patientHistory) {
  // CPT auto-suggestion logic:
  // 99605 = Initial comprehensive review (first encounter for patient, or no recent encounter)
  // 99606 = Follow-up targeted review (patient seen in last 90 days)
  // 99607 = Additional time (score < 4 or INA pattern — indicates complex intervention)
  const pid    = record.patient_number || record.user_id || '';
  const prior  = patientHistory[pid] || 0;
  const score  = record.score || 0;
  const isINA  = record.pattern === 'INA';
  if (prior === 0) return '99605'; // first encounter
  if (score < 4 || isINA) return '99607'; // complex — needs extra time
  return '99606'; // follow-up
}

function mtmBuildLog(records) {
  // Build per-patient encounter history to drive CPT suggestion
  const history = {};
  const sorted  = [...records].sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
  return sorted.map(r => {
    const isMap = r.tool === 'map' || r.map_q1 !== undefined;
    const pid = r.patient_number || r.user_id || '—';
    const cpt = mtmSuggestCPT(r, history);
    history[pid] = (history[pid] || 0) + 1;
    const date = r.timestamp
      ? new Date(r.timestamp).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'})
      : '—';

    // Score and unit — MAP uses PE (0–1), MMAS-8 uses 0–8
    let score, scoreUnit;
    if (isMap) {
      const pe = r.map_q1 !== undefined ? Math.pow(Math.max(0,
            ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3 *
            ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3 *
            (0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)
          ), 1/3) : r.score;
      score     = (pe !== undefined && pe !== null) ? Number(pe).toFixed(3) : '—';
      scoreUnit = 'PE';
    } else {
      score     = (r.score !== undefined && r.score !== null) ? Number(r.score).toFixed(2) : '—';
      scoreUnit = '/ 8';
    }

    const cat = (!isMap && r.score !== undefined) ? getAdherenceCategory(r.score) : { label: '—' };

    // Derive INA/UNA pattern — use instrument-appropriate classifier
    let pattern = '—';
    if (isMap && r.map_q1 !== undefined) {
      const { intentional, unintentional } = typeof classifyMapPattern === 'function'
        ? classifyMapPattern(r) : { intentional: 0, unintentional: 0 };
      const pe = parseFloat(score);
      if (pe >= 0.9) pattern = 'High';
      else if (intentional > unintentional) pattern = 'INA';
      else if (unintentional > intentional) pattern = 'UNA';
      else pattern = 'Mixed';
    } else if (!isMap && r.q1 !== undefined) {
      const { intentional, unintentional } = classifyPattern(r);
      if ((r.score||0) >= 8) pattern = 'High';
      else if (intentional > unintentional) pattern = 'INA';
      else if (unintentional > intentional) pattern = 'UNA';
      else pattern = 'Mixed';
    } else if (r.score !== undefined) {
      if (isMap) { const s = parseFloat(score); pattern = s >= 0.9 ? 'High' : s >= 0.7 ? 'Medium' : 'Low'; }
      else        { pattern = r.score >= 8 ? 'High' : r.score >= 6 ? 'Medium' : 'Low'; }
    }

    const intervention = pattern === 'INA'
      ? 'Motivational counseling — intentional non-adherence identified'
      : pattern === 'UNA'
        ? 'Practical barrier assessment — unintentional pattern. Reminder system recommended'
        : pattern === 'High'
          ? 'Adherence maintenance — patient fully adherent. Positive reinforcement'
          : 'Comprehensive MTM review — mixed adherence pattern';
    return {
      date, pid,
      cpt,
      score,
      scoreUnit,
      adherence: cat.label,
      pattern,
      condition:    r.condition || '—',
      drug:         r.drug_name  || '—',
      intervention,
      instrument:   isMap ? 'MAP Tri-Domain (Morisky, 2026)' : 'MMAS-8® (TX 8-632-533)',
      workspace:    currentWorkspace || '—',
      certNum:      '—',
    };
  });
}

// Current MTM page state (0-indexed)
window._mtmPage = 0;

/**
 * Renders the Medication Therapy Management (MTM) patient panel with pagination.
 * Reads from `window._rppData` and `window._rppFiltered`. Applies current sort and page.
 * @returns {void}
 */
function mtmRender() {
  const tbody      = document.getElementById('mtm-tbody');
  const filter     = document.getElementById('mtm-cpt-filter')?.value || 'all';
  const perPageVal = document.getElementById('mtm-per-page')?.value || '20';
  const mmasRecs   = (typeof dashMmasData !== 'undefined') ? dashMmasData : [];
  if (!tbody) return;

  // ── Merge MMAS-derived entries with manually-timed encounters ──
  const timedEntries = (window._mtmManualEncounters || []).map(enc => ({
    date:         enc.date,
    pid:          enc.patient_id || '—',
    cpt:          enc.cpt_primary || '99606',
    cpt_display:  enc.cpt_display || enc.cpt_primary,
    score:        '—',
    adherence:    '—',
    pattern:      '—',
    condition:    '—',
    drug:         '—',
    intervention: enc.notes || ((typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang === 'ar') ? 'لقاء مباشر — جلسة موقّتة' : 'Direct encounter — pharmacist timed session'),
    instrument:   enc.instrument || 'MMAS-8® (TX 8-632-533)',
    workspace:    enc.workspace || '—',
    duration:     enc.total_min ? (enc.svc_min + ' min svc · ' + enc.total_min + ' min total') : '—',
    source:       'timer',
  }));

  const mmasEntries = mtmBuildLog(mmasRecs).map(e => ({ ...e, duration: '—', source: 'mmas' }));

  // Timed entries appear at top (most recent first); MMAS entries follow sorted by date desc
  const combined = [...timedEntries, ...mmasEntries.reverse()];

  if (!combined.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:28px;text-align:center;color:var(--dim);font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.06em;">No encounters logged yet. Use the Session Timer above to log timed MTM encounters, or complete MMAS-8 assessments to auto-populate.</td></tr>';
    _mtmHidePagination();
    return;
  }

  const log = combined.filter(e => filter === 'all' || e.cpt === filter);

  if (!log.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:28px;text-align:center;color:var(--dim);font-family:var(--font-mono);font-size:0.72rem;">No encounters match this filter.</td></tr>';
    _mtmHidePagination();
    return;
  }

  const total   = log.length;
  const showAll = perPageVal === 'all';
  const perPage = showAll ? total : parseInt(perPageVal, 10);

  if (window._mtmLastFilter !== filter || window._mtmLastPerPage !== perPageVal) {
    window._mtmPage = 0;
    window._mtmLastFilter  = filter;
    window._mtmLastPerPage = perPageVal;
  }

  const totalPages = showAll ? 1 : Math.ceil(total / perPage);
  window._mtmPage  = Math.min(window._mtmPage, totalPages - 1);

  const start = window._mtmPage * perPage;
  const end   = showAll ? total : Math.min(start + perPage, total);
  const page  = log.slice(start, end);

  const cptColor = { '99605':'var(--base)', '99606':'var(--mvmt)', '99607':'var(--pe)' };
  const patColor = { INA:'var(--poor)', UNA:'var(--moderate)', High:'var(--optimal)', Mixed:'var(--mvmt)', Medium:'var(--moderate)' };

  tbody.innerHTML = page.map(e => {
    // CPT badge: for timed entries show full code string; for MMAS entries show single code
    const cptBadges = e.source === 'timer' && e.cpt_display
      ? '<span style="font-family:var(--font-mono);font-size:0.70rem;font-weight:600;color:var(--mvmt);background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.2);border-radius:4px;padding:2px 7px;">' + e.cpt_display.split('(')[0].trim() + '</span>'
      : '<span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:' + (cptColor[e.cpt]||'var(--text)') + ';background:rgba(139,111,245,0.06);border:1px solid rgba(139,111,245,0.15);border-radius:4px;padding:2px 7px;">' + e.cpt + '</span>';

    // Duration cell
    const durCell = e.source === 'timer' && e.duration !== '—'
      ? '<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--strata);">' + e.duration + '</span>'
      : '<span style="color:var(--dim);font-size:0.72rem;">—</span>';

    // Source indicator dot
    const srcDot = e.source === 'timer'
      ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--strata);margin-right:5px;vertical-align:middle;" title="Timed encounter"></span>'
      : '';

    return '<tr style="border-bottom:1px solid var(--border);transition:background 0.15s;" onmouseover="this.style.background=\'rgba(139,111,245,0.04)\'" onmouseout="this.style.background=\'\'">' +
      '<td style="padding:9px 14px;color:var(--text);white-space:nowrap;">' + srcDot + e.date + '</td>' +
      '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">' + e.pid + '</td>' +
      '<td style="padding:9px 14px;">' + cptBadges + '</td>' +
      '<td style="padding:9px 14px;">' + durCell + '</td>' +
      '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.82rem;color:var(--text);font-weight:500;">' + (e.score !== '—' ? e.score + '<span style="font-size:0.65rem;color:var(--dim);margin-left:4px;">' + (e.scoreUnit || '/ 8') + '</span>' : '<span style="color:var(--dim);">—</span>') + '</td>' +
      '<td style="padding:9px 14px;"><span style="font-family:var(--font-mono);font-size:0.68rem;color:' + (patColor[e.pattern]||'var(--dim)') + ';text-transform:uppercase;letter-spacing:0.08em;">' + e.pattern + '</span></td>' +
      '<td style="padding:9px 14px;color:var(--dim);font-size:0.76rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + e.condition + '">' + e.condition + '</td>' +
      '<td style="padding:9px 14px;color:var(--text);font-size:0.76rem;line-height:1.5;max-width:240px;">' + e.intervention + '</td>' +
      '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">' + e.instrument + '</td>' +
    '</tr>';
  }).join('');

  if (showAll || totalPages <= 1) {
    _mtmHidePagination();
  } else {
    _mtmShowPagination(start, end, total, totalPages);
  }
}

function _mtmHidePagination() {
  const p = document.getElementById('mtm-pagination');
  if (p) p.style.display = 'none';
}

function _mtmShowPagination(start, end, total, totalPages) {
  const pag  = document.getElementById('mtm-pagination');
  const info = document.getElementById('mtm-page-info');
  const btns = document.getElementById('mtm-page-btns');
  const prev = document.getElementById('mtm-prev-btn');
  const next = document.getElementById('mtm-next-btn');
  if (!pag) return;

  pag.style.display = 'flex';
  if (info) info.textContent = 'Showing ' + (start + 1) + '–' + end + ' of ' + total + ' encounters';

  // Prev / Next disabled states
  if (prev) { prev.disabled = window._mtmPage === 0; prev.style.opacity = window._mtmPage === 0 ? '0.3' : '1'; }
  if (next) { next.disabled = window._mtmPage >= totalPages - 1; next.style.opacity = window._mtmPage >= totalPages - 1 ? '0.3' : '1'; }

  // Page number buttons — show up to 7, with ellipsis
  if (btns) {
    const cur = window._mtmPage;
    let pages = [];
    if (totalPages <= 7) {
      pages = Array.from({length: totalPages}, (_,i) => i);
    } else {
      pages = [0];
      if (cur > 2) pages.push('…');
      for (let i = Math.max(1, cur-1); i <= Math.min(totalPages-2, cur+1); i++) pages.push(i);
      if (cur < totalPages - 3) pages.push('…');
      pages.push(totalPages - 1);
    }
    btns.innerHTML = pages.map(p => {
      if (p === '…') return '<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);padding:0 4px;">…</span>';
      const active = p === cur;
      return '<button onclick="window._mtmPage=' + p + ';mtmRender()" style="font-family:var(--font-mono);font-size:0.68rem;min-width:26px;height:26px;border-radius:4px;border:1px solid ' + (active ? 'rgba(139,111,245,0.6)' : 'var(--border2)') + ';background:' + (active ? 'rgba(139,111,245,0.15)' : 'none') + ';color:' + (active ? 'var(--mvmt)' : 'var(--muted)') + ';cursor:pointer;transition:all 0.15s;">' + (p + 1) + '</button>';
    }).join('');
  }
}

function mtmPageNav(dir) {
  const perPageVal = document.getElementById('mtm-per-page')?.value || '20';
  const records    = (typeof dashMmasData !== 'undefined') ? dashMmasData : [];
  const filter     = document.getElementById('mtm-cpt-filter')?.value || 'all';
  const total      = mtmBuildLog(records).filter(e => filter === 'all' || e.cpt === filter).length;
  const perPage    = parseInt(perPageVal, 10);
  const totalPages = Math.ceil(total / perPage);
  window._mtmPage  = Math.max(0, Math.min((window._mtmPage || 0) + dir, totalPages - 1));
  mtmRender();
}

/**
 * Exports the current MTM patient list as a CSV file.
 * @returns {void}
 */
function mtmExportCSV() {
  const records = (typeof dashMmasData !== 'undefined') ? dashMmasData : [];
  const timed   = window._mtmManualEncounters || [];
  if (!records.length && !timed.length) { showToast('No MTM encounters to export.', 2500); return; }
  const ws  = workspaceProfile?.name || currentWorkspace || 'ATLAS';

  const timedRows = timed.map(enc => [
    enc.date, enc.patient_id || '—', enc.cpt_display || enc.cpt_primary, enc.total_min ? enc.total_min + ' min' : '—',
    '—', '—', '—', '—', '"' + (enc.notes || ((typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang === 'ar') ? 'لقاء صيدلاني مباشر' : 'Direct pharmacist encounter')) + '"',
    enc.instrument || 'MMAS-8® (TX 8-632-533)', ws, enc.payer || '—'
  ]);
  const mmasRows = mtmBuildLog(records).map(e => [
    e.date, e.pid, e.cpt, '—', e.score, e.adherence, e.pattern, e.condition, '"' + e.intervention + '"', e.instrument, ws, '—'
  ]);

  const hdr  = ['Date','Patient ID','CPT Code','Duration','Score','Adherence Level','Pattern','Condition','Intervention Documented','Instrument','Clinician Workspace','Payer'];
  const csv  = [hdr, ...timedRows, ...mmasRows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `MTM_Audit_Log_${ws.replace(/\s+/g,'-')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  atlasAuditLog('mtm_export_csv', { workspace: currentWorkspace });
  showToast('MTM audit log exported — ' + (timedRows.length + mmasRows.length) + ' encounters', 3000);
}

function mtmExportPDF() {
  const records = (typeof dashMmasData !== 'undefined') ? dashMmasData : [];
  const timed   = window._mtmManualEncounters || [];
  if (!records.length && !timed.length) { showToast('No MTM encounters to export.', 2500); return; }
  const mmasLog = mtmBuildLog(records);
  const ws   = workspaceProfile?.name || currentWorkspace || 'ATLAS';
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const totalCount = timed.length + mmasLog.length;

  // Timed encounter rows
  const timedHTML = timed.map((enc, i) => `
    <tr style="background:${i%2===0?'#fff':'#f9fafb'};">
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-size:11px;">${enc.date}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${enc.patient_id||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:11px;color:#5b3fa8;">${(enc.cpt_display||enc.cpt_primary||'').split('(')[0].trim()}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#0d7a52;">${enc.total_min ? enc.svc_min+'m svc · '+enc.doc_sec/60|0+'m doc · '+enc.trv_sec/60|0+'m trv = '+enc.total_min+'m total' : '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">—</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;">${enc.payer||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;">${enc.notes||((typeof mmasCurrentLang!=='undefined'&&mmasCurrentLang==='ar')?'لقاء صيدلاني مباشر':'Direct pharmacist encounter')}</td>
    </tr>`).join('');

  // MMAS-derived rows
  const mmasHTML = mmasLog.map((e, i) => `
    <tr style="background:${(i+timed.length)%2===0?'#fff':'#f9fafb'};">
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-size:11px;">${e.date}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${e.pid}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:11px;color:#5b3fa8;">${e.cpt}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#888;">${e.instrument}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${e.score} ${e.scoreUnit||'/ 8'} — ${e.adherence} · ${e.pattern}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;">${e.condition}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;">${e.intervention}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a2e;}
  .hdr{border-bottom:3px solid #5b3fa8;padding-bottom:14px;margin-bottom:20px;}
  .org{font-size:13pt;font-weight:bold;color:#1a3a6b;}
  .title{font-size:16pt;font-weight:300;color:#1a1a2e;margin:6px 0;}
  .meta{font-size:9pt;color:#6b7280;}
  .section-hdr{font-size:9pt;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#5b3fa8;padding:8px 0 4px;margin-top:16px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#5b3fa8;color:#fff;padding:8px 10px;font-size:10px;letter-spacing:0.08em;text-align:left;text-transform:uppercase;}
  .footer{margin-top:24px;font-size:8pt;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px;line-height:1.8;}
  </style></head><body>
  <div class="hdr">
    <div class="org">Adherence Cartography · ATLAS Platform</div>
    <div class="title">MTM Audit Log — Medication Therapy Management</div>
    <div class="meta">Clinician: ${ws} · Generated: ${date} · Total Encounters: ${totalCount}</div>
    <div class="meta">Instruments: MMAS-8® (TX 8-632-533) · MAP Tri-Domain — Licensed · Dr. Donald E. Morisky</div>
  </div>
  ${timed.length ? `<div class="section-hdr">⏱ Timed Encounters (${timed.length})</div>
  <table>
    <tr><th>Date</th><th>Patient ID</th><th>CPT Code(s)</th><th>Time Breakdown</th><th>Score</th><th>Payer</th><th>Notes</th></tr>
    ${timedHTML}
  </table>` : ''}
  ${mmasLog.length ? `<div class="section-hdr">Assessment-Derived Encounters (${mmasLog.length})</div>
  <table>
    <tr><th>Date</th><th>Patient ID</th><th>CPT Code</th><th>Instrument</th><th>Score · Level · Pattern</th><th>Condition</th><th>Intervention</th></tr>
    ${mmasHTML}
  </table>` : ''}
  <div class="footer">
    <strong>CMS Billing Reference:</strong> CPT 99605 — Initial MTM by pharmacist, first 15 min · CPT 99606 — Follow-up MTM, first 15 min · CPT 99607 — Each additional 8–22 min block<br/>
    <strong>Medi-Cal note:</strong> Clinical Pharmacists claim MTMS codes to Medi-Cal only — not Medicare (per ACBH/CMS guidance).<br/>
    International: UK MUR/NMS · Australia HMR · EU pharmacist consultation equivalents<br/>
    This document was generated from ATLAS and serves as supporting audit documentation. Verify current payer requirements before submission. MMAS-8® used with permission — adherence.cc
  </div>
  </body></html>`;

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
  atlasAuditLog('mtm_export_pdf', { workspace: currentWorkspace, count: totalCount });
  showToast('MTM audit log opened for printing — ' + totalCount + ' encounters', 3000);
}



// Show MTM panel for pharmacist/researcher tier
// ══════════════════════════════════════════════════════════════════
// INSTITUTION DASHBOARD TAB SYSTEM
// Switches between Overview (analytics) and MTM Services tabs.
// MTM panels are relocated from dash-body into inst-tab-panel-mtm
// on first activation — preventing duplicates and preserving state.
// ══════════════════════════════════════════════════════════════════
/**
 * Switches the active tab in the Institution dashboard.
 * @param {string} tab - Tab identifier (e.g. `'overview'`, `'research'`, `'grants'`)
 * @returns {void}
 */
function switchInstDashTab(tab) {
  // Update tab button styles — all use --base for active
  document.querySelectorAll('.inst-dash-tab').forEach(function(btn) {
    var isActive = btn.dataset.instTab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.color             = isActive ? 'var(--base)' : 'var(--dim)';
    btn.style.borderBottomColor = isActive ? 'var(--base)' : 'transparent';
  });

  // Normalize legacy tab names → new tab names
  if (tab === 'mtm') tab = 'reporting';
  if (tab === 'billing' || tab === 'hub' || tab === 'grants' || tab === 'thesis') {
    // Legacy direct tab calls — redirect to Reporting tab and activate the right sub-tab
    var legacySubTab = tab;
    tab = 'reporting';
    // Will open Reporting tab then switch sub-tab below
    setTimeout(function() { switchInstReportingTab(legacySubTab); }, 0);
  }

  // Show/hide main tab panels
  var overviewPanel   = document.getElementById('inst-tab-panel-overview');
  var analyticsPanel  = document.getElementById('inst-tab-panel-analytics');
  var reportingPanel  = document.getElementById('inst-tab-panel-reporting');
  var seatsPanel      = document.getElementById('inst-tab-panel-seats');
  var studyPanel      = document.getElementById('inst-tab-panel-study');
  var auditPanel      = document.getElementById('inst-tab-panel-audit');
  var labPanel        = document.getElementById('inst-tab-panel-lab');
  var extcompPanel    = document.getElementById('inst-tab-panel-extcomp');
  // Legacy standalone panels (kept for compat — hidden unless accessed via Reporting)
  var billingPanel    = document.getElementById('inst-tab-panel-billing');
  var hubPanel        = document.getElementById('inst-tab-panel-hub');
  var grantsPanel     = document.getElementById('inst-tab-panel-grants');
  var thesisPanel     = document.getElementById('inst-tab-panel-thesis');

  if (overviewPanel)  overviewPanel.style.display  = tab === 'overview'   ? '' : 'none';
  if (analyticsPanel) analyticsPanel.style.display = tab === 'analytics'  ? '' : 'none';
  if (reportingPanel) reportingPanel.style.display = tab === 'reporting'  ? '' : 'none';
  if (seatsPanel)     seatsPanel.style.display     = tab === 'seats'      ? '' : 'none';
  if (studyPanel)     studyPanel.style.display     = tab === 'study'      ? '' : 'none';
  if (auditPanel)     auditPanel.style.display     = tab === 'audit'      ? '' : 'none';
  if (labPanel)       labPanel.style.display       = tab === 'lab'        ? '' : 'none';
  if (extcompPanel)   extcompPanel.style.display   = tab === 'extcomp'    ? '' : 'none';
  if (billingPanel)   billingPanel.style.display   = 'none';
  if (hubPanel)       hubPanel.style.display       = 'none';
  if (grantsPanel)    grantsPanel.style.display    = 'none';
  if (thesisPanel)    thesisPanel.style.display    = 'none';

  // Lazy-init tab content on first open
  if (tab === 'seats')     initInstSeatsTab();
  if (tab === 'study')     renderStudyModule();
  if (tab === 'reporting') { initInstBillingTab(); switchInstReportingTab('billing'); injectInstQuarterlySummaryUI(); }
  if (tab === 'analytics') { /* analytics tab content is static HTML */ }
  // CTO3: Audit tab — no lazy init needed, user clicks Refresh to load
  if (tab === 'lab' && !window._instLabLoaded) {
    window._instLabLoaded = true;
    if (labPanel && typeof _saRenderLab === 'function') {
      var theme = document.documentElement.getAttribute('data-theme') || 'dark';
      labPanel.setAttribute('data-atlas-theme', theme === 'light' ? 'light' : 'dark');
      if (typeof _saResolveColors === 'function') _saResolveColors(labPanel);
      if (typeof _rlInjectStyles === 'function') _rlInjectStyles();
      _saRenderLab(labPanel);
    }
  }
  if (tab === 'extcomp' && !window._instExtCompLoaded) {
    window._instExtCompLoaded = true;
    if (extcompPanel && typeof _saRenderExtComp === 'function') {
      var theme = document.documentElement.getAttribute('data-theme') || 'dark';
      extcompPanel.setAttribute('data-atlas-theme', theme === 'light' ? 'light' : 'dark');
      if (typeof _saResolveColors === 'function') _saResolveColors(extcompPanel);
      _saRenderExtComp(extcompPanel);
    }
  }
}

/**
 * Switches the active sub-tab within the Reporting tab panel.
 * @param {string} sub - Sub-tab name: 'billing', 'hub', 'grants', 'thesis'
 */
function switchInstReportingTab(sub) {
  // Update sub-tab button styles
  document.querySelectorAll('.inst-rep-sub-tab').forEach(function(btn) {
    var isActive = btn.dataset.repTab === sub;
    btn.style.color             = isActive ? 'var(--base)' : 'var(--dim)';
    btn.style.borderBottomColor = isActive ? 'var(--base)' : 'transparent';
  });

  // Move legacy billing/hub/grants/thesis panels into the appropriate sub-panel slot
  var slots = { billing: 'inst-rep-panel-billing', hub: 'inst-rep-panel-hub', grants: 'inst-rep-panel-grants', thesis: 'inst-rep-panel-thesis' };
  var sources = { billing: 'inst-tab-panel-billing', hub: 'inst-tab-panel-hub', grants: 'inst-tab-panel-grants', thesis: 'inst-tab-panel-thesis' };

  Object.keys(slots).forEach(function(key) {
    var slotEl  = document.getElementById(slots[key]);
    var srcEl   = document.getElementById(sources[key]);
    if (!slotEl) return;
    if (key === sub) {
      // Move source panel content into slot if not already there
      if (srcEl && slotEl.children.length === 0) {
        while (srcEl.firstChild) slotEl.appendChild(srcEl.firstChild);
      }
      slotEl.style.display = '';
    } else {
      slotEl.style.display = 'none';
    }
  });

  // Lazy-init
  if (sub === 'billing') initInstBillingTab();
  if (sub === 'hub')     initInstResearchHub();
  if (sub === 'grants')  initInstGrantTab();
  if (sub === 'thesis')  initInstThesisTab();
}

// ── Clinical Study Module ─────────────────────────────

let studyConfig = JSON.parse(localStorage.getItem('atlas_study_config') || 'null') || {
  name: '', pi: '', institution: '', sponsor: '', irb: '', clinicaltrials: '', protocol: '', start: '', lock: '', target: 500, window: 7, visits: [30, 90, 180]
};

function openStudyConfigModal() {
  const m = document.getElementById('study-config-modal');
  if (!m) return;
  document.getElementById('scm-name').value = studyConfig.name || '';
  document.getElementById('scm-pi').value = studyConfig.pi || '';
  document.getElementById('scm-institution').value = studyConfig.institution || '';
  document.getElementById('scm-sponsor').value = studyConfig.sponsor || '';
  document.getElementById('scm-irb').value = studyConfig.irb || '';
  document.getElementById('scm-clinicaltrials').value = studyConfig.clinicaltrials || '';
  document.getElementById('scm-protocol').value = studyConfig.protocol || '';
  document.getElementById('scm-start').value = studyConfig.start || '';
  document.getElementById('scm-lock').value = studyConfig.lock || '';
  document.getElementById('scm-target').value = studyConfig.target || 500;
  document.getElementById('scm-window').value = studyConfig.window || 7;
  document.getElementById('scm-visits').value = (studyConfig.visits || [30,90,180]).join(', ');
  m.style.display = 'flex';
}

function closeStudyConfigModal() {
  const m = document.getElementById('study-config-modal');
  if (m) m.style.display = 'none';
}

function saveStudyConfig() {
  studyConfig = {
    name: document.getElementById('scm-name').value.trim(),
    pi: document.getElementById('scm-pi').value.trim(),
    institution: document.getElementById('scm-institution').value.trim(),
    sponsor: document.getElementById('scm-sponsor').value.trim(),
    irb: document.getElementById('scm-irb').value.trim(),
    clinicaltrials: document.getElementById('scm-clinicaltrials').value.trim(),
    protocol: document.getElementById('scm-protocol').value.trim(),
    start: document.getElementById('scm-start').value,
    lock: document.getElementById('scm-lock').value,
    target: parseInt(document.getElementById('scm-target').value) || 500,
    window: parseInt(document.getElementById('scm-window').value) || 7,
    visits: (document.getElementById('scm-visits').value || '30,90,180').split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)),
    last_modified_at: Date.now(),
    last_modified_by: (typeof workspaceProfile !== 'undefined' && workspaceProfile)
      ? (workspaceProfile.display_name || workspaceProfile.workspace_key || 'unknown')
      : 'unknown',
  };
  localStorage.setItem('atlas_study_config', JSON.stringify(studyConfig));
  closeStudyConfigModal();
  renderStudyModule();
  _syncStudyConfigToFirebase();
}

// ============================================================
// ATLAS v8.6 — INSTITUTION RESEARCH MODULES
// Cross-Study Research Hub · Grant Reporting · Student Thesis
// ============================================================

// ── Utility: apply hub filters (status + PI dropdowns) ──────────────────────
function _instHubApplyFilters() {
  const statusVal = (document.getElementById('inst-hub-status-filter') || {}).value || 'all';
  const piVal     = (document.getElementById('inst-hub-pi-filter') || {}).value || 'all';
  const cards     = document.querySelectorAll('#inst-hub-cards [data-ws-key]');
  const rows      = document.querySelectorAll('#inst-hub-compare-tbody [data-ws-key]');
  cards.forEach(function(card) {
    const status = card.dataset.status || '';
    const wsKey  = card.dataset.wsKey  || '';
    const show   = (statusVal === 'all' || status === statusVal) && (piVal === 'all' || wsKey === piVal);
    card.style.display = show ? '' : 'none';
  });
  rows.forEach(function(row) {
    const status = row.dataset.status || '';
    const wsKey  = row.dataset.wsKey  || '';
    const show   = (statusVal === 'all' || status === statusVal) && (piVal === 'all' || wsKey === piVal);
    row.style.display = show ? '' : 'none';
  });
}

// ── MODULE 1: Cross-Study Research Hub ──────────────────────────────────────

function initInstResearchHub() {
  if (window._instHubInited) return;
  window._instHubInited = true;

  const workspaces = window._instChildWorkspaces || [];
  const cardsEl = document.getElementById('inst-hub-cards');
  if (cardsEl) {
    cardsEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:20px 0;">Loading study configurations…</div>';
  }

  const needsLoad = workspaces.filter(function(ws) { return !ws.studyConfig; });
  if (needsLoad.length === 0) {
    _renderInstResearchHub(workspaces);
    return;
  }

  const promises = needsLoad.map(function(ws) {
    return firebase.database().ref('workspaces/' + ws.key + '/study_config').once('value').then(function(snap) {
      ws.studyConfig = snap.val() || null;
    }).catch(function() {
      ws.studyConfig = null;
    });
  });

  Promise.all(promises).then(function() {
    _renderInstResearchHub(workspaces);
  });
}

function _renderInstResearchHub(workspaces) {
  const today = new Date();

  const configured    = workspaces.filter(function(ws) { return ws.studyConfig && ws.studyConfig.name; });
  const totalStudies  = configured.length;
  const activeStudies = configured.filter(function(ws) {
    const cfg      = ws.studyConfig;
    const enrolled = ws.assessmentCount || 0;
    const target   = parseInt(cfg.target) || 0;
    if (cfg.lock && new Date(cfg.lock) < today) return false;
    if (target > 0 && enrolled >= target) return false;
    return true;
  }).length;

  let totalEnrolled = 0;
  workspaces.forEach(function(ws) { totalEnrolled += (ws.assessmentCount || 0); });

  let completionSum = 0, completionCount = 0;
  configured.forEach(function(ws) {
    const target   = parseInt(ws.studyConfig.target) || 0;
    const enrolled = ws.assessmentCount || 0;
    if (target > 0) { completionSum += Math.min(enrolled / target, 1); completionCount++; }
  });
  const avgCompletion = completionCount > 0 ? Math.round((completionSum / completionCount) * 100) : 0;

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('inst-hub-total-studies',   totalStudies);
  set('inst-hub-active-studies',  activeStudies);
  set('inst-hub-total-enrolled',  totalEnrolled);
  set('inst-hub-completion-rate', avgCompletion + '%');

  var emptyEl = document.getElementById('inst-hub-empty');
  if (emptyEl) emptyEl.style.display = workspaces.length === 0 ? '' : 'none';

  var piFilter = document.getElementById('inst-hub-pi-filter');
  if (piFilter && piFilter.options.length <= 1) {
    workspaces.forEach(function(ws) {
      var opt = document.createElement('option');
      opt.value = ws.key;
      opt.textContent = ws.name || ws.key;
      piFilter.appendChild(opt);
    });
  }

  var tableData = [];

  var cardsEl = document.getElementById('inst-hub-cards');
  if (cardsEl) {
    cardsEl.innerHTML = workspaces.map(function(ws) {
      var cfg      = ws.studyConfig;
      var enrolled = ws.assessmentCount || 0;
      var target   = cfg ? (parseInt(cfg.target) || 0) : 0;
      var pct      = target > 0 ? Math.min(Math.round((enrolled / target) * 100), 100) : 0;

      var statusLabel, statusColor;
      if (!cfg || !cfg.name) {
        statusLabel = 'setup';     statusColor = 'rgba(239,68,68,0.80)';
      } else if (cfg.lock && new Date(cfg.lock) < today) {
        statusLabel = 'locked';    statusColor = 'rgba(245,158,11,0.90)';
      } else if (target > 0 && enrolled >= target) {
        statusLabel = 'complete';  statusColor = 'rgba(46,201,138,0.90)';
      } else {
        statusLabel = 'enrolling'; statusColor = 'var(--base)';
      }
      var statusDisplay = { setup:'Setup Required', locked:'Locked', complete:'Complete', enrolling:'Enrolling' }[statusLabel];

      var alphaStr = '—';
      if (ws.patients && ws.patients.length > 0) {
        try {
          var built = _buildMmasMatrix(ws.patients);
          if (built && built.matrix && built.matrix.length >= 3) {
            var a = _cronbachAlpha(built.matrix);
            alphaStr = isFinite(a) ? a.toFixed(3) : '—';
          }
        } catch(e) {}
      }

      var hasMap     = ws.patients && ws.patients.some(function(p) { return p.map || p.map_q1; });
      var instrument = hasMap ? 'MAP + MMAS-8' : 'MMAS-8';
      var titleStr   = cfg && cfg.name ? _esc(cfg.name) : '<em style="color:var(--dim);">Unconfigured Study</em>';
      var irbStr     = cfg && cfg.irb  ? _esc(cfg.irb)  : '—';
      var piName     = _esc(ws.name || ws.key);
      var meanStr    = (ws.meanScore != null && isFinite(ws.meanScore)) ? Number(ws.meanScore).toFixed(2) : '—';

      tableData.push({
        key: ws.key, name: ws.name || ws.key,
        title: cfg && cfg.name ? cfg.name : 'Unconfigured',
        irb: cfg && cfg.irb ? cfg.irb : '—',
        instrument: instrument,
        enrolled: enrolled, target: target || 0,
        pct: pct, meanScore: meanStr, alpha: alphaStr,
        statusLabel: statusLabel, statusDisplay: statusDisplay
      });

      return '<div data-ws-key="' + _esc(ws.key) + '" data-status="' + statusLabel + '" ' +
        'style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">' +
          '<div>' +
            '<div style="font-family:var(--font-mono);font-size:0.78rem;font-weight:600;color:var(--text);">' + piName + '</div>' +
            '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.05rem;font-weight:600;color:var(--bright);margin-top:2px;">' + titleStr + '</div>' +
            '<div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-top:3px;">IRB: ' + irbStr + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">' +
            '<span style="font-family:var(--font-mono);font-size:0.62rem;background:rgba(255,255,255,0.06);border:1px solid var(--border2);border-radius:3px;padding:2px 7px;color:var(--dim);">' + _esc(instrument) + '</span>' +
            '<span style="font-family:var(--font-mono);font-size:0.62rem;border-radius:3px;padding:2px 7px;color:#fff;background:' + statusColor + ';">' + statusDisplay + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-bottom:4px;">' +
            '<span>Enrollment</span><span>' + enrolled + ' / ' + (target || '—') + '</span>' +
          '</div>' +
          '<div style="background:var(--border2);border-radius:3px;height:5px;overflow:hidden;">' +
            '<div style="background:' + statusColor + ';height:100%;width:' + pct + '%;transition:width 0.4s;"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:16px;font-family:var(--font-mono);font-size:0.72rem;color:var(--muted);">' +
          '<span>Mean <strong style="color:var(--text);">' + meanStr + '</strong></span>' +
          '<span>\u03B1 <strong style="color:var(--text);">' + alphaStr + '</strong></span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window._instHubTableData = tableData;

  var tbody = document.getElementById('inst-hub-compare-tbody');
  if (tbody) {
    tbody.innerHTML = tableData.map(function(row) {
      return '<tr data-ws-key="' + _esc(row.key) + '" data-status="' + row.statusLabel + '" style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);">' + _esc(row.name) + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--muted);">' + _esc(row.title) + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">' + _esc(row.irb) + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">' + _esc(row.instrument) + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);text-align:right;">' + row.enrolled + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--muted);text-align:right;">' + (row.target || '—') + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);text-align:right;">' + row.pct + '%</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);text-align:right;">' + row.meanScore + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);text-align:right;">' + row.alpha + '</td>' +
        '<td style="padding:9px 14px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);">' + _esc(row.statusDisplay) + '</td>' +
        '</tr>';
    }).join('');
  }
}

function _instHubExportCSV() {
  var data = window._instHubTableData || [];
  var headers = ['Workspace/PI','Study Title','IRB #','Instrument','n Enrolled','Target','Completion%','Mean Score','Cronbach \u03B1','Status'];
  var rows = [headers.join(',')];
  data.forEach(function(row) {
    rows.push([row.name, row.title, row.irb, row.instrument,
      row.enrolled, row.target, row.pct + '%', row.meanScore, row.alpha, row.statusDisplay
    ].map(function(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }).join(','));
  });
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'atlas-cross-study-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _instHubCopyReport() {
  var data  = window._instHubTableData || [];
  var today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  var lines = ['ATLAS Cross-Study Research Hub Report', 'Generated: ' + today, '='.repeat(60), ''];
  data.forEach(function(row, i) {
    lines.push((i + 1) + '. ' + row.name);
    lines.push('   Study:      ' + row.title);
    lines.push('   IRB #:      ' + row.irb);
    lines.push('   Instrument: ' + row.instrument);
    lines.push('   Enrolled:   ' + row.enrolled + ' / ' + (row.target || '\u2014') + ' (' + row.pct + '%)');
    lines.push('   Mean Score: ' + row.meanScore);
    lines.push('   Cronbach \u03B1: ' + row.alpha);
    lines.push('   Status:     ' + row.statusDisplay);
    lines.push('');
  });
  lines.push('Generated by ATLAS v8.6 \u2014 Adherence Cartography Platform');
  navigator.clipboard.writeText(lines.join('\n')).then(function() {
    showToast('Cross-study report copied to clipboard', 2500);
  }).catch(function() {
    showToast('Copy failed \u2014 check clipboard permissions', 2500);
  });
}

// ── MODULE 2: Grant Reporting ────────────────────────────────────────────────

window._instGrants = window._instGrants || [];

function initInstGrantTab() {
  if (window._instGrantsInited) return;
  window._instGrantsInited = true;

  var listEl = document.getElementById('inst-grants-list');
  if (listEl) listEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:16px 0;">Loading grants\u2026</div>';

  firebase.database().ref('workspaces/' + currentWorkspace + '/grants').once('value').then(function(snap) {
    var val = snap.val();
    window._instGrants = [];
    if (val) {
      Object.keys(val).forEach(function(k) {
        window._instGrants.push(Object.assign({}, val[k], { id: k }));
      });
    }
    _renderInstGrantList();
  }).catch(function() {
    window._instGrants = [];
    _renderInstGrantList();
  });
}

function _renderInstGrantList() {
  var panel  = document.getElementById('inst-rppr-panel');
  var prompt = document.getElementById('inst-rppr-prompt');
  if (panel)  panel.style.display  = 'none';
  if (prompt) prompt.style.display = '';

  var grants  = window._instGrants || [];
  var listEl  = document.getElementById('inst-grants-list');
  var emptyEl = document.getElementById('inst-grants-empty');
  if (!listEl) return;

  if (grants.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var agencyColors = { NIH:'rgba(78,156,245,0.85)', CDC:'rgba(46,201,138,0.85)', HRSA:'rgba(212,168,67,0.85)', DoD:'rgba(139,111,245,0.85)' };
  var btnStyle = 'font-family:var(--font-mono);font-size:0.68rem;background:var(--card2);border:1px solid var(--border2);border-radius:4px;color:var(--muted);padding:3px 9px;cursor:pointer;';

  listEl.innerHTML = grants.map(function(g) {
    var color = agencyColors[g.agency] || 'rgba(156,163,175,0.80)';
    return '<div style="background:var(--card);border:1px solid var(--border2);border-radius:var(--r);padding:14px 16px;">' +
      '<div style="font-family:var(--font-mono);font-size:0.78rem;font-weight:600;color:var(--text);margin-bottom:6px;">' + _esc(g.title || 'Untitled Grant') + '</div>' +
      '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">' +
        '<span style="font-family:var(--font-mono);font-size:0.62rem;border-radius:3px;padding:2px 7px;color:#fff;background:' + color + ';">' + _esc(g.agency || '\u2014') + '</span>' +
        '<span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);">' + _esc(g.grantNumber || '\u2014') + '</span>' +
      '</div>' +
      '<div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-bottom:3px;">PI: ' + _esc(g.pi || '\u2014') + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-bottom:8px;">Target n: ' + _esc(String(g.targetEnrollment || '\u2014')) + ' \u00B7 Period: ' + _esc(g.periodStart || '\u2014') + ' \u2013 ' + _esc(g.periodEnd || '\u2014') + '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<button onclick="_instSelectGrant(\'' + _esc(g.id) + '\')" style="' + btnStyle + 'color:var(--base);border-color:rgba(78,156,245,0.3);">Generate RPPR</button>' +
        '<button onclick="_instEditGrant(\'' + _esc(g.id) + '\')" style="' + btnStyle + '">Edit</button>' +
        '<button onclick="_instDeleteGrant(\'' + _esc(g.id) + '\')" style="' + btnStyle + 'color:rgba(239,68,68,0.8);border-color:rgba(239,68,68,0.2);">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _instSelectGrant(grantId) {
  var grant = (window._instGrants || []).find(function(g) { return g.id === grantId; });
  if (!grant) return;

  window._instRPPRGrantId = grantId;

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('inst-rppr-grant-title', grant.title || 'Untitled Grant');

  var agencyBadge  = document.getElementById('inst-rppr-agency-badge');
  var agencyColors = { NIH:'rgba(78,156,245,0.85)', CDC:'rgba(46,201,138,0.85)', HRSA:'rgba(212,168,67,0.85)', DoD:'rgba(139,111,245,0.85)' };
  if (agencyBadge) {
    agencyBadge.textContent = grant.agency || '\u2014';
    agencyBadge.style.background = agencyColors[grant.agency] || 'rgba(156,163,175,0.12)';
    agencyBadge.style.color = agencyColors[grant.agency] ? '#fff' : 'var(--muted)';
  }
  set('inst-rppr-grant-number', grant.grantNumber || '\u2014');
  set('inst-rppr-period', grant.periodStart && grant.periodEnd ? grant.periodStart + ' \u2013 ' + grant.periodEnd : '\u2014');

  var childWorkspaces = window._instChildWorkspaces || [];
  var linkedWs = null;
  if (grant.linkedWorkspaceKey) {
    linkedWs = childWorkspaces.find(function(ws) { return ws.key === grant.linkedWorkspaceKey; });
  }
  var allPatients = linkedWs
    ? (linkedWs.patients || [])
    : childWorkspaces.reduce(function(acc, ws) { return acc.concat(ws.patients || []); }, []);

  var enrolled = linkedWs ? (linkedWs.assessmentCount || allPatients.length) : allPatients.length;
  var target   = parseInt(grant.targetEnrollment) || 0;
  var compPct  = target > 0 ? Math.min(Math.round((enrolled / target) * 100), 100) : 0;

  var scores = [], highN = 0, inaN = 0;
  allPatients.forEach(function(p) {
    if (p.mmas && p.mmas.length > 0) {
      var sorted = p.mmas.slice().sort(function(a,b){ return (b.timestamp||0)-(a.timestamp||0); });
      var last   = sorted[0];
      if (last.score != null && isFinite(last.score)) {
        scores.push(+last.score);
        if (+last.score >= 6) highN++;
        if (last.intentional || last.adherence_pattern === 'INA') inaN++;
      }
    }
  });
  var meanScore = scores.length > 0 ? scores.reduce(function(a,b){ return a+b; }, 0) / scores.length : 0;
  var sdScore   = 0;
  if (scores.length > 1) {
    var variance = scores.reduce(function(a,b){ return a + Math.pow(b - meanScore, 2); }, 0) / (scores.length - 1);
    sdScore = Math.sqrt(variance);
  }
  var highPct = scores.length > 0 ? Math.round((highN / scores.length) * 100) : 0;
  var inaPct  = scores.length > 0 ? Math.round((inaN  / scores.length) * 100) : 0;

  var alphaStr = '\u2014', alphaInterp = '', semStr = '\u2014', omegaStr = '\u2014';
  if (allPatients.length >= 3) {
    try {
      var built = _buildMmasMatrix(allPatients);
      if (built && built.matrix && built.matrix.length >= 3) {
        var alpha = _cronbachAlpha(built.matrix);
        if (isFinite(alpha)) {
          alphaStr    = alpha.toFixed(3);
          alphaInterp = _alphaInterpretation(alpha);
          var sem     = sdScore * Math.sqrt(1 - alpha);
          semStr      = isFinite(sem) ? sem.toFixed(3) : '\u2014';
          var omega   = _mcdonaldOmega(built.matrix);
          omegaStr    = isFinite(omega) ? omega.toFixed(3) : '\u2014';
        }
      }
    } catch(e) {}
  }

  set('inst-rppr-enrolled',   enrolled);
  set('inst-rppr-target',     target || '\u2014');
  set('inst-rppr-completion', compPct + '%');
  set('inst-rppr-mean-score', meanScore ? meanScore.toFixed(2) : '\u2014');
  set('inst-rppr-alpha',      alphaStr);
  set('inst-rppr-icc',        omegaStr);

  var genders = {}, ages = [];
  allPatients.forEach(function(p) {
    if (p.gender) genders[p.gender] = (genders[p.gender] || 0) + 1;
    if (p.age && isFinite(p.age)) ages.push(+p.age);
  });
  var genderStr = Object.keys(genders).length > 0
    ? Object.keys(genders).map(function(k) { return genders[k] + ' ' + k; }).join(', ')
    : 'Not recorded';
  var ageStr = ages.length > 0
    ? 'Mean ' + (ages.reduce(function(a,b){ return a+b; }, 0) / ages.length).toFixed(1) + ' yrs'
    : 'Not recorded';
  set('inst-rppr-gender', genderStr);
  set('inst-rppr-age',    ageStr);

  var todayStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  var year     = new Date().getFullYear();
  var demogLine = '';
  if (genderStr !== 'Not recorded') demogLine += 'Gender distribution: ' + genderStr + '.';
  if (ageStr    !== 'Not recorded') demogLine += (demogLine ? ' ' : '') + ageStr + '.';

  var rppr = [
    (grant.grantNumber || '[Grant Number]') + ' \u2014 ' + (grant.title || '[Grant Title]'),
    'Reporting Period: ' + (grant.periodStart || '[start]') + ' to ' + (grant.periodEnd || '[end]'),
    'Principal Investigator: ' + (grant.pi || '[PI]'),
    '',
    'ENROLLMENT',
    'As of ' + todayStr + ', ' + enrolled + ' participants have been enrolled of a target of ' +
      (target || '[target]') + ' (completion: ' + compPct + '%).' + (demogLine ? ' ' + demogLine : ''),
    '',
    'INSTRUMENT & RELIABILITY',
    'All participants completed the MMAS-8 (Morisky Medication Adherence Scale, 8-item; Morisky, ' + year + '). ' +
      'Internal consistency for this sample: Cronbach\u2019s \u03B1 = ' + alphaStr +
      (alphaInterp ? ' (' + alphaInterp + ')' : '') + '. McDonald\u2019s \u03C9 (composite reliability) = ' + omegaStr + '. ' +
      'Standard Error of Measurement: ' + semStr + ' score units.',
    '',
    'ADHERENCE OUTCOMES',
    'Mean MMAS-8 score for this reporting period: ' + (meanScore ? meanScore.toFixed(2) : '\u2014') +
      ' \u00B1 ' + (sdScore ? sdScore.toFixed(2) : '\u2014') + ' (scale 0\u20138; higher = better adherence). ' +
      highPct + '% of participants scored \u22656 (high adherence). ' +
      inaPct + '% met criteria for intentional non-adherence.',
    '',
    'Generated by ATLAS v8.6 \u2014 Adherence Cartography Platform'
  ].join('\n');

  window._instRPPRText = rppr;

  var textarea = document.getElementById('inst-rppr-textarea');
  if (textarea) {
    textarea.value    = rppr;
    textarea.readOnly = false;
  }

  var panel  = document.getElementById('inst-rppr-panel');
  var prompt = document.getElementById('inst-rppr-prompt');
  if (panel)  panel.style.display  = '';
  if (prompt) prompt.style.display = 'none';
}

function _instCopyRPPR() {
  var text = (document.getElementById('inst-rppr-textarea') || {}).value || window._instRPPRText || '';
  navigator.clipboard.writeText(text).then(function() {
    showToast('RPPR block copied to clipboard', 2500);
  }).catch(function() {
    showToast('Copy failed \u2014 check browser clipboard permissions', 2500);
  });
}

function _instDownloadRPPR() {
  var text    = (document.getElementById('inst-rppr-textarea') || {}).value || window._instRPPRText || '';
  var grantId = window._instRPPRGrantId || 'grant';
  var date    = new Date().toISOString().slice(0, 10);
  var blob    = new Blob([text], { type: 'text/plain' });
  var url     = URL.createObjectURL(blob);
  var a       = document.createElement('a');
  a.href      = url;
  a.download  = 'atlas-rppr-' + grantId + '-' + date + '.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _instNewGrant() {
  ['inst-grant-title-input','inst-grant-agency-input','inst-grant-number-input',
   'inst-grant-pi-input','inst-grant-workspace-input','inst-grant-aims-input',
   'inst-grant-start-input','inst-grant-end-input'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var targetEl = document.getElementById('inst-grant-target-input');
  if (targetEl) targetEl.value = '';
  var modalId = document.getElementById('inst-grant-modal-id');
  if (modalId) modalId.value = '';
  var modal = document.getElementById('inst-grant-modal');
  if (modal) modal.style.display = 'flex';
}

function _instEditGrant(grantId) {
  if (!grantId && window._instRPPRGrantId) grantId = window._instRPPRGrantId;
  var grant = (window._instGrants || []).find(function(g) { return g.id === grantId; });
  if (!grant) return;
  var fieldMap = {
    'inst-grant-title-input':     'title',
    'inst-grant-agency-input':    'agency',
    'inst-grant-number-input':    'grantNumber',
    'inst-grant-pi-input':        'pi',
    'inst-grant-workspace-input': 'linkedWorkspaceKey',
    'inst-grant-aims-input':      'aims',
    'inst-grant-start-input':     'periodStart',
    'inst-grant-end-input':       'periodEnd',
    'inst-grant-target-input':    'targetEnrollment'
  };
  Object.keys(fieldMap).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = grant[fieldMap[id]] || '';
  });
  var modalId = document.getElementById('inst-grant-modal-id');
  if (modalId) modalId.value = grantId;
  var modal = document.getElementById('inst-grant-modal');
  if (modal) modal.style.display = 'flex';
}

function _instSaveGrant() {
  var title  = ((document.getElementById('inst-grant-title-input')  || {}).value || '').trim();
  var agency = ((document.getElementById('inst-grant-agency-input') || {}).value || '').trim();
  if (!title)  { showToast('Grant title is required', 2000);  return; }
  if (!agency) { showToast('Select a funding agency', 2000); return; }

  var data = {
    title:              title,
    agency:             agency,
    grantNumber:        ((document.getElementById('inst-grant-number-input')    || {}).value || '').trim(),
    pi:                 ((document.getElementById('inst-grant-pi-input')        || {}).value || '').trim(),
    linkedWorkspaceKey: ((document.getElementById('inst-grant-workspace-input') || {}).value || '').trim(),
    aims:               ((document.getElementById('inst-grant-aims-input')      || {}).value || '').trim(),
    periodStart:        ((document.getElementById('inst-grant-start-input')     || {}).value || '').trim(),
    periodEnd:          ((document.getElementById('inst-grant-end-input')       || {}).value || '').trim(),
    targetEnrollment:   parseInt((document.getElementById('inst-grant-target-input') || {}).value || '0') || 0
  };

  var existingId = ((document.getElementById('inst-grant-modal-id') || {}).value || '').trim();
  var ref = firebase.database().ref('workspaces/' + currentWorkspace + '/grants');
  var promise;
  if (existingId) {
    data.updatedAt = Date.now();
    promise = ref.child(existingId).update(data);
  } else {
    data.createdAt = Date.now();
    promise = ref.push(data);
  }
  promise.then(function() {
    _instCloseGrantModal();
    window._instGrantsInited = false;
    initInstGrantTab();
    showToast('Grant saved', 2000);
  }).catch(function(err) {
    showToast('Error saving grant: ' + (err.message || 'Unknown'), 3000);
  });
}

function _instDeleteGrant(grantId) {
  if (!confirm('Delete this grant record? This cannot be undone.')) return;
  firebase.database().ref('workspaces/' + currentWorkspace + '/grants/' + grantId).remove().then(function() {
    window._instGrantsInited = false;
    initInstGrantTab();
  }).catch(function(err) {
    showToast('Error deleting grant: ' + (err.message || 'Unknown'), 3000);
  });
}

function _instCloseGrantModal() {
  var modal = document.getElementById('inst-grant-modal');
  if (modal) modal.style.display = 'none';
}

// ── MODULE 3: Student Thesis Module ─────────────────────────────────────────

window._instTheses = window._instTheses || [];

function initInstThesisTab() {
  if (window._instThesisInited) return;
  window._instThesisInited = true;

  var listEl = document.getElementById('inst-thesis-list');
  if (listEl) listEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:20px 14px;">Loading thesis projects\u2026</div>';

  firebase.database().ref('workspaces/' + currentWorkspace + '/theses').once('value').then(function(snap) {
    var val = snap.val();
    window._instTheses = [];
    if (val) {
      Object.keys(val).forEach(function(k) {
        window._instTheses.push(Object.assign({}, val[k], { id: k }));
      });
    }
    _renderInstThesisList();
  }).catch(function() {
    window._instTheses = [];
    _renderInstThesisList();
  });
}

function _renderInstThesisList() {
  var theses = window._instTheses || [];
  var filter = ((document.getElementById('inst-thesis-filter') || {}).value) || 'all';

  var total    = theses.length;
  var active   = theses.filter(function(t) { return t.status && t.status !== 'Complete'; }).length;
  var complete = theses.filter(function(t) { return t.status === 'Complete'; }).length;

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('inst-thesis-total',    total);
  set('inst-thesis-active',   active);
  set('inst-thesis-complete', complete);

  var filtered = theses;
  if (filter === 'active')   filtered = theses.filter(function(t) { return t.status !== 'Complete'; });
  if (filter === 'complete') filtered = theses.filter(function(t) { return t.status === 'Complete'; });

  var countLabel = document.getElementById('inst-thesis-count-label');
  if (countLabel) countLabel.textContent = filtered.length + ' of ' + total + ' shown';

  var listEl  = document.getElementById('inst-thesis-list');
  var emptyEl = document.getElementById('inst-thesis-empty');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var statusColors = {
    'Proposal':        'rgba(245,158,11,0.90)',
    'Data Collection': 'rgba(78,156,245,0.90)',
    'Analysis':        'rgba(139,111,245,0.90)',
    'Writing':         'rgba(156,163,175,0.80)',
    'Complete':        'rgba(46,201,138,0.90)'
  };
  var mLabels         = ['IRB Approval','Data Collection','Midpoint Review','Analysis Complete','Defense'];
  var childWorkspaces = window._instChildWorkspaces || [];
  var rowStyle        = 'display:grid;grid-template-columns:1fr 1fr 140px 100px 120px 80px 120px;gap:0;padding:12px 14px;border-bottom:1px solid var(--border);align-items:center;font-family:var(--font-mono);font-size:0.74rem;color:var(--text);';

  listEl.innerHTML = filtered.map(function(t) {
    var statusColor = statusColors[t.status] || 'rgba(156,163,175,0.80)';
    var milestones  = t.milestones || {};
    var mKeys       = ['m1','m2','m3','m4','m5'];
    var allDone     = mKeys.every(function(k) { return milestones[k]; });

    var milestoneDots = mKeys.map(function(k, i) {
      var done = !!milestones[k];
      return '<span title="' + mLabels[i] + '" style="display:inline-block;width:10px;height:10px;border-radius:50%;' +
        (done ? 'background:' + statusColor + ';' : 'background:var(--border2);border:1px solid var(--border2);') +
        'margin-right:3px;"></span>';
    }).join('');

    var enrolledN = 0;
    if (t.studentWorkspaceKey) {
      var ws = childWorkspaces.find(function(w) { return w.key === t.studentWorkspaceKey; });
      if (ws) enrolledN = ws.assessmentCount || 0;
    }
    var targetN = parseInt(t.targetN) || 0;
    var pct     = targetN > 0 ? Math.min(Math.round((enrolledN / targetN) * 100), 100) : 0;

    var actionBtns = '';
    if (t.signedOff) {
      actionBtns = '<span style="font-family:var(--font-mono);font-size:0.68rem;color:rgba(46,201,138,0.9);font-weight:600;">\u2713 Signed Off</span>';
    } else if (allDone) {
      actionBtns = '<button onclick="_instSignOffThesis(\'' + _esc(t.id) + '\')" ' +
        'style="font-family:var(--font-mono);font-size:0.65rem;background:rgba(46,201,138,0.15);border:1px solid rgba(46,201,138,0.4);border-radius:4px;color:rgba(46,201,138,0.9);padding:3px 8px;cursor:pointer;white-space:nowrap;">Sign Off</button>';
    }
    actionBtns += ' <button onclick="_instEditThesis(\'' + _esc(t.id) + '\')" ' +
      'style="font-family:var(--font-mono);font-size:0.65rem;background:var(--card2);border:1px solid var(--border2);border-radius:4px;color:var(--muted);padding:3px 8px;cursor:pointer;">Edit</button>';
    actionBtns += ' <button onclick="_instDeleteThesis(\'' + _esc(t.id) + '\')" ' +
      'style="font-family:var(--font-mono);font-size:0.65rem;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:4px;color:rgba(239,68,68,0.7);padding:3px 8px;cursor:pointer;">Del</button>';

    return '<div style="' + rowStyle + '">' +
      '<div>' +
        '<div style="font-weight:600;color:var(--text);">' + _esc(t.studentName || '\u2014') + '</div>' +
        '<div style="font-family:\'Cormorant Garamond\',serif;font-size:0.92rem;color:var(--muted);margin-top:1px;">' + _esc(t.title || 'Untitled Thesis') + '</div>' +
      '</div>' +
      '<div style="color:var(--muted);">' + _esc(t.supervisorName || '\u2014') + '</div>' +
      '<div>' + milestoneDots + '</div>' +
      '<div style="text-align:right;">' +
        '<div style="color:var(--text);">' + enrolledN + ' / ' + (targetN || '\u2014') + '</div>' +
        '<div style="background:var(--border2);border-radius:2px;height:4px;margin-top:4px;overflow:hidden;">' +
          '<div style="background:' + statusColor + ';height:100%;width:' + pct + '%;"></div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;">' +
        '<span style="font-size:0.62rem;border-radius:3px;padding:2px 7px;color:#fff;background:' + statusColor + ';">' + _esc(t.status || '\u2014') + '</span>' +
      '</div>' +
      '<div style="text-align:right;color:var(--dim);font-size:0.68rem;">' + _esc(t.defenseDate || '\u2014') + '</div>' +
      '<div style="text-align:right;">' + actionBtns + '</div>' +
    '</div>';
  }).join('');
}

function _instNewThesis() {
  ['inst-thesis-title-input','inst-thesis-student-input','inst-thesis-supervisor-input',
   'inst-thesis-workspace-input','inst-thesis-funding-input','inst-thesis-defense-input'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var targetEl = document.getElementById('inst-thesis-target-input');
  if (targetEl) targetEl.value = '';
  var statusEl = document.getElementById('inst-thesis-status-input');
  if (statusEl) statusEl.value = 'Proposal';
  ['inst-thesis-m1','inst-thesis-m2','inst-thesis-m3','inst-thesis-m4','inst-thesis-m5'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.checked = false;
  });
  var modalId = document.getElementById('inst-thesis-modal-id');
  if (modalId) modalId.value = '';
  var modal = document.getElementById('inst-thesis-modal');
  if (modal) modal.style.display = 'flex';
}

function _instEditThesis(thesisId) {
  var thesis = (window._instTheses || []).find(function(t) { return t.id === thesisId; });
  if (!thesis) return;
  var fieldMap = {
    'inst-thesis-title-input':      'title',
    'inst-thesis-student-input':    'studentName',
    'inst-thesis-supervisor-input': 'supervisorName',
    'inst-thesis-status-input':     'status',
    'inst-thesis-workspace-input':  'studentWorkspaceKey',
    'inst-thesis-target-input':     'targetN',
    'inst-thesis-funding-input':    'fundingSource',
    'inst-thesis-defense-input':    'defenseDate'
  };
  Object.keys(fieldMap).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = thesis[fieldMap[id]] || '';
  });
  var milestones = thesis.milestones || {};
  ['m1','m2','m3','m4','m5'].forEach(function(k) {
    var el = document.getElementById('inst-thesis-' + k);
    if (el) el.checked = !!milestones[k];
  });
  var modalId = document.getElementById('inst-thesis-modal-id');
  if (modalId) modalId.value = thesisId;
  var modal = document.getElementById('inst-thesis-modal');
  if (modal) modal.style.display = 'flex';
}

function _instSaveThesis() {
  var title       = ((document.getElementById('inst-thesis-title-input')   || {}).value || '').trim();
  var studentName = ((document.getElementById('inst-thesis-student-input') || {}).value || '').trim();
  if (!title)       { showToast('Thesis title is required', 2000);  return; }
  if (!studentName) { showToast('Student name is required', 2000); return; }

  var milestones = {};
  ['m1','m2','m3','m4','m5'].forEach(function(k) {
    var el = document.getElementById('inst-thesis-' + k);
    milestones[k] = el ? !!el.checked : false;
  });

  var data = {
    title:               title,
    studentName:         studentName,
    supervisorName:      ((document.getElementById('inst-thesis-supervisor-input') || {}).value || '').trim(),
    status:              ((document.getElementById('inst-thesis-status-input')     || {}).value || '').trim() || 'Proposal',
    studentWorkspaceKey: ((document.getElementById('inst-thesis-workspace-input')  || {}).value || '').trim(),
    targetN:             parseInt((document.getElementById('inst-thesis-target-input')  || {}).value || '0') || 0,
    fundingSource:       ((document.getElementById('inst-thesis-funding-input')    || {}).value || '').trim(),
    defenseDate:         ((document.getElementById('inst-thesis-defense-input')    || {}).value || '').trim(),
    milestones:          milestones
  };

  var existingId = ((document.getElementById('inst-thesis-modal-id') || {}).value || '').trim();
  var ref = firebase.database().ref('workspaces/' + currentWorkspace + '/theses');
  var promise;
  if (existingId) {
    data.updatedAt = Date.now();
    promise = ref.child(existingId).update(data);
  } else {
    data.createdAt = Date.now();
    promise = ref.push(data);
  }
  promise.then(function() {
    _instCloseThesisModal();
    window._instThesisInited = false;
    initInstThesisTab();
    showToast('Thesis project saved', 2000);
  }).catch(function(err) {
    showToast('Error saving thesis: ' + (err.message || 'Unknown'), 3000);
  });
}

function _instDeleteThesis(thesisId) {
  if (!confirm('Delete this thesis record? This cannot be undone.')) return;
  firebase.database().ref('workspaces/' + currentWorkspace + '/theses/' + thesisId).remove().then(function() {
    window._instThesisInited = false;
    initInstThesisTab();
  }).catch(function(err) {
    showToast('Error deleting thesis: ' + (err.message || 'Unknown'), 3000);
  });
}

function _instSignOffThesis(thesisId) {
  var signedOffBy = (workspaceProfile && workspaceProfile.name) ? workspaceProfile.name : currentWorkspace;
  firebase.database().ref('workspaces/' + currentWorkspace + '/theses/' + thesisId).update({
    signedOff:   true,
    signedOffAt: Date.now(),
    signedOffBy: signedOffBy
  }).then(function() {
    showToast('Thesis signed off \u2014 record locked', 2500);
    window._instThesisInited = false;
    initInstThesisTab();
  }).catch(function(err) {
    showToast('Error signing off: ' + (err.message || 'Unknown'), 3000);
  });
}

function _instCloseThesisModal() {
  var modal = document.getElementById('inst-thesis-modal');
  if (modal) modal.style.display = 'none';
}

function _instFilterTheses() {
  _renderInstThesisList();
}

// ── Study Config Firebase Sync ───────────────────────────────────────────────
// Called at end of saveStudyConfig() — silent background write

function _syncStudyConfigToFirebase() {
  if (!currentWorkspace || currentWorkspace === 'INDEPENDENT') return;
  try {
    firebase.database().ref('workspaces/' + currentWorkspace + '/study_config').set(studyConfig);
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════
// INSTITUTION SETTINGS MODAL
// ══════════════════════════════════════════════════════════════════

/**
 * Opens the institution settings modal and populates fields from saved config.
 */
function openInstSettings() {
  const modal = document.getElementById('inst-settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Populate study config fields
  const sc = window.studyConfig || {};
  const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  _set('scm-name', sc.name);
  _set('scm-pi', sc.pi);
  _set('scm-institution', sc.institution);
  _set('scm-sponsor', sc.sponsor);
  _set('scm-irb', sc.irb);
  _set('scm-clinicaltrials', sc.clinicaltrials);
  _set('scm-protocol', sc.protocol);
  _set('scm-start', sc.start);
  _set('scm-lock', sc.lock);
  _set('scm-target', sc.target || 500);
  _set('scm-window', sc.window || 7);
  _set('scm-visits', (sc.visits || [30, 90, 180]).join(', '));

  // Populate alert thresholds from localStorage
  const alerts = JSON.parse(localStorage.getItem('atlas_inst_alerts') || '{}');
  _set('inst-alert-caregap-days', alerts.careGapDays || 30);
  _set('inst-alert-score-threshold', alerts.scoreThreshold || 6);
  _set('inst-alert-deviation-days', alerts.deviationDays || 14);

  // Populate billing config
  const bill = JSON.parse(localStorage.getItem('atlas_inst_billing_config') || '{}');
  _set('inst-billing-npi', bill.npi);
  _set('inst-billing-ein', bill.ein);
  _set('inst-billing-entity', bill.entity);
  _set('inst-billing-medi-cal', bill.mediCal);
  _set('inst-billing-taxonomy', bill.taxonomy);

  // Populate branding
  const brand = JSON.parse(localStorage.getItem('atlas_inst_branding') || '{}');
  _set('inst-brand-name', brand.name);
  _set('inst-brand-dept', brand.dept);
  _set('inst-brand-email', brand.email);

  // Gate billing section for health/AMC only
  const billingNav = document.getElementById('inst-settings-nav-billing');
  if (billingNav) billingNav.style.display = (isHealthInst() || isAmcInst()) ? '' : 'none';

  // Populate seat summary
  _renderInstSettingsSeatSummary();

  // CTO5: Render SLA card
  if (typeof _instRenderSLACard === 'function') _instRenderSLACard();

  // Default to Study tab
  switchInstSettingsTab('study');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Closes the institution settings modal.
 */
function closeInstSettings() {
  const modal = document.getElementById('inst-settings-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * Switches the active section in the institution settings sidebar.
 * @param {string} tab - Section name
 */
function switchInstSettingsTab(tab) {
  document.querySelectorAll('.inst-settings-nav').forEach(function(btn) {
    var isActive = btn.dataset.settingsTab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.background    = isActive ? 'rgba(78,156,245,0.10)' : 'none';
    btn.style.borderLeftColor = isActive ? 'var(--base)' : 'transparent';
    btn.style.color          = isActive ? 'var(--text)' : 'var(--dim)';
  });
  document.querySelectorAll('.inst-settings-panel').forEach(function(panel) {
    panel.style.display = panel.id === 'inst-settings-panel-' + tab ? '' : 'none';
  });
}

/**
 * Saves alert threshold settings to localStorage.
 */
function saveInstAlertThresholds() {
  const alerts = {
    careGapDays:     parseInt(document.getElementById('inst-alert-caregap-days').value) || 30,
    scoreThreshold:  parseFloat(document.getElementById('inst-alert-score-threshold').value) || 6,
    deviationDays:   parseInt(document.getElementById('inst-alert-deviation-days').value) || 14,
  };
  localStorage.setItem('atlas_inst_alerts', JSON.stringify(alerts));
  atlasAuditLog && atlasAuditLog('inst_alerts_saved', alerts);
}

/**
 * Saves billing configuration to localStorage.
 */
function saveInstBillingConfig() {
  const bill = {
    npi:      document.getElementById('inst-billing-npi').value.trim(),
    ein:      document.getElementById('inst-billing-ein').value.trim(),
    entity:   document.getElementById('inst-billing-entity').value.trim(),
    mediCal:  document.getElementById('inst-billing-medi-cal').value.trim(),
    taxonomy: document.getElementById('inst-billing-taxonomy').value.trim(),
  };
  localStorage.setItem('atlas_inst_billing_config', JSON.stringify(bill));
  atlasAuditLog && atlasAuditLog('inst_billing_config_saved', { npi: bill.npi, entity: bill.entity });
}

/**
 * Saves report branding settings to localStorage.
 */
function saveInstBranding() {
  const brand = {
    name:  document.getElementById('inst-brand-name').value.trim(),
    dept:  document.getElementById('inst-brand-dept').value.trim(),
    email: document.getElementById('inst-brand-email').value.trim(),
  };
  localStorage.setItem('atlas_inst_branding', JSON.stringify(brand));
}

/**
 * Saves notification preferences to localStorage.
 */
function saveInstNotifications() {
  const notif = {
    careGap:    document.getElementById('inst-notif-caregap').value,
    deviation:  document.getElementById('inst-notif-deviation').value,
    enrollment: document.getElementById('inst-notif-enrollment').value,
    irb:        document.getElementById('inst-notif-irb').value,
  };
  localStorage.setItem('atlas_inst_notifications', JSON.stringify(notif));
}

/**
 * Saves enrollment control settings to localStorage.
 */
function saveInstEnrollmentControls() {
  const ec = {
    active:   document.getElementById('inst-enrollment-active').checked,
    autolock: document.getElementById('inst-enrollment-autolock').checked,
  };
  localStorage.setItem('atlas_inst_enrollment_controls', JSON.stringify(ec));
  atlasAuditLog && atlasAuditLog('inst_enrollment_controls_saved', ec);
}

/**
 * Renders a brief seat utilization summary inside the Access & Audit settings panel.
 */
function _renderInstSettingsSeatSummary() {
  const el = document.getElementById('inst-settings-seat-summary');
  if (!el) return;
  try {
    const quota = workspaceProfile && workspaceProfile.seatQuota;
    const used  = workspaceProfile && workspaceProfile.seatUsed;
    if (!quota) { el.textContent = 'Seat data unavailable — open Team tab to load.'; return; }
    const lines = Object.entries(quota).map(([type, total]) => {
      const u = (used && used[type]) || 0;
      return type.charAt(0).toUpperCase() + type.slice(1) + ': ' + u + ' / ' + total;
    });
    el.innerHTML = lines.map(l => '<div style="margin-bottom:4px;">' + l + '</div>').join('');
  } catch(e) {
    el.textContent = 'Open the Team tab to load seat data.';
  }
}

/**
 * Previews the uploaded institution logo.
 * @param {HTMLInputElement} input
 */
function previewInstLogo(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 1048576) { showToast('Logo must be under 1 MB', 3000); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('inst-logo-preview');
    if (preview) {
      preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" />';
      localStorage.setItem('atlas_inst_logo', e.target.result);
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Shows a brief toast notification inside the settings modal.
 * @param {string} msg
 */
function showInstSettingsToast(msg) {
  const toast = document.getElementById('inst-settings-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}

/**
 * Placeholder for institution audit log export — wire to your audit system.
 */
function exportInstitutionAuditLog() {
  if (typeof atlasAuditLog === 'function') atlasAuditLog('inst_audit_log_exported', {});
  showToast('Audit log export — connect to your audit trail system.', 3000);
}

/**
 * Placeholder for generic document downloads — wire to your document storage.
 * @param {string} docType - 'data-security' | 'hipaa-baa' | 'informed-consent' | 'site-monitoring'
 */
function downloadAtlasDocument(docType) {
  showToast('Downloading ' + docType + ' document…', 2500);
  atlasAuditLog && atlasAuditLog('inst_document_download', { doc: docType });
}

// ── CTO3: Institution Audit Log ───────────────────────────────────────────
let _auditLogCache = [];
let _auditLogPage = 0;
const _AUDIT_PAGE_SIZE = 25;

async function instLoadAuditLog() {
  const wrap = document.getElementById('inst-audit-table-wrap');
  if (wrap) wrap.innerHTML = '<div class="inst-audit-loading">Loading audit log...</div>';
  try {
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db) throw new Error('Database not initialized.');
    const institution = window._currentWorkspaceProfile && (window._currentWorkspaceProfile.parent_institution || window._currentWorkspaceProfile.institution_code)
      || (window._currentWorkspaceKey || '').split('-')[1]
      || sessionStorage.getItem('_wsInstitution');
    if (!institution) throw new Error('Institution code not found in workspace profile.');
    const snap = await db.ref('audit_log').orderByChild('institution').equalTo(institution).limitToLast(500).once('value');
    const raw = snap.val() || {};
    _auditLogCache = Object.values(raw).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    _auditLogPage = 0;
    _instRenderAuditTable();
  } catch(err) {
    if (wrap) wrap.innerHTML = '<div class="inst-audit-err">Error: ' + err.message + '</div>';
  }
}

function instAuditFilter() { _auditLogPage = 0; _instRenderAuditTable(); }

function _instRenderAuditTable() {
  const wrap = document.getElementById('inst-audit-table-wrap');
  if (!wrap) return;
  const actionFilter = (document.getElementById('inst-audit-filter-action') || {}).value || '';
  const dateFilter = (document.getElementById('inst-audit-filter-date') || {}).value || '';
  var filtered = _auditLogCache;
  if (actionFilter) filtered = filtered.filter(function(e) { return (e.action || '').includes(actionFilter); });
  if (dateFilter) {
    var fd = new Date(dateFilter).toDateString();
    filtered = filtered.filter(function(e) { return e.timestamp && new Date(e.timestamp).toDateString() === fd; });
  }
  const total = filtered.length;
  const start = _auditLogPage * _AUDIT_PAGE_SIZE;
  const page = filtered.slice(start, start + _AUDIT_PAGE_SIZE);
  if (!page.length) { wrap.innerHTML = '<div class="inst-audit-empty">No entries found.</div>'; _instRenderAuditPag(total); return; }
  const _isAr = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang === 'ar');
  const tl = _isAr
    ? { assessment_submit: 'تقييم', key_create: 'مفتاح جديد', key_revoke: 'إلغاء المفتاح', export: 'تصدير', login: 'تسجيل دخول', bulk_upload: 'رفع مجمّع', intervention_log: 'تدخّل', mtm_export_pdf: 'تصدير MTM', mtm_timer_start: 'بدء المؤقت', mtm_timer_stop: 'إيقاف المؤقت' }
    : { assessment_submit: 'Assessment', key_create: 'Key Created', key_revoke: 'Key Revoked', export: 'Export', login: 'Login', bulk_upload: 'Bulk Upload', intervention_log: 'Intervention', mtm_export_pdf: 'MTM Export', mtm_timer_start: 'Timer Start', mtm_timer_stop: 'Timer Stop' };
  wrap.innerHTML = '<table class="inst-audit-tbl"><thead><tr><th>Timestamp</th><th>Action</th><th>User / Workspace</th><th>Patient</th><th>Details</th></tr></thead><tbody>' +
    page.map(function(e) {
      return '<tr class="inst-audit-row">' +
        '<td class="inst-audit-ts">' + (e.timestamp ? new Date(e.timestamp).toLocaleString() : '—') + '</td>' +
        '<td><span class="inst-audit-action-badge">' + (tl[e.action] || e.action || '—') + '</span></td>' +
        '<td class="inst-audit-user">' + (e.user || e.workspace || e.key || '—') + '</td>' +
        '<td class="inst-audit-patient">' + (e.patient_number || e.record_id || '—') + '</td>' +
        '<td class="inst-audit-detail">' + (e.detail || e.note || '') + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table><div class="inst-audit-count">Showing ' + (start + 1) + '–' + Math.min(start + _AUDIT_PAGE_SIZE, total) + ' of ' + total + '</div>';
  _instRenderAuditPag(total);
}

function _instRenderAuditPag(total) {
  const pag = document.getElementById('inst-audit-pagination');
  if (!pag) return;
  const pages = Math.ceil(total / _AUDIT_PAGE_SIZE);
  pag.innerHTML = pages <= 1 ? '' : Array.from({ length: pages }, function(_, i) {
    return '<button class="inst-audit-pg-btn' + (i === _auditLogPage ? ' active' : '') + '" onclick="_auditLogPage=' + i + ';_instRenderAuditTable()">' + (i + 1) + '</button>';
  }).join('');
}

function instExportAuditCSV() {
  if (!_auditLogCache.length) { alert('Load the audit log first.'); return; }
  const hdrs = ['Timestamp', 'Action', 'User', 'Patient', 'Institution', 'Detail'];
  const rows = _auditLogCache.map(function(e) {
    return [e.timestamp ? new Date(e.timestamp).toISOString() : '', e.action || '', e.user || e.workspace || '', e.patient_number || '', e.institution || '', e.detail || ''];
  });
  const esc = function(v) { var s = String(v || '').replace(/"/g, '""'); return /[,"\n]/.test(s) ? '"' + s + '"' : s; };
  const csv = [hdrs].concat(rows).map(function(r) { return r.map(esc).join(','); }).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'atlas_audit_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
}
window.instLoadAuditLog = instLoadAuditLog;
window.instAuditFilter = instAuditFilter;
window.instExportAuditCSV = instExportAuditCSV;

// ── CTO4: Compliance Status Widget ────────────────────────────────────────
const _COMPLIANCE_STATUS = [
  { label: 'HIPAA',              status: 'active',      note: 'BAA available upon request' },
  { label: 'BAA',                status: 'active',      note: 'Business Associate Agreement' },
  { label: 'DUA',                status: 'active',      note: 'Data Use Agreement (Health System / AMC)' },
  { label: 'TLS 1.3',            status: 'active',      note: 'Encryption in transit' },
  { label: 'AES-256',            status: 'active',      note: 'Encryption at rest' },
  { label: '21 CFR Part 11',     status: 'active',      note: 'All 5 phases complete — audit trail, e-signatures, session controls, record hashing, validation docs' },
  { label: 'SOC 2 Type II',      status: 'planned',     note: 'Scheduled for 2027 audit cycle' },
  { label: 'UAE Data Residency', status: 'active',      note: 'AWS DynamoDB dual-write (Health System / AMC)' },
];

function _instRenderComplianceWidget() {
  const container = document.getElementById('inst-compliance-band');
  if (!container) return;
  const icon = { active: '✓', 'in-progress': '◑', planned: '○' };
  const cls  = { active: 'comp-active', 'in-progress': 'comp-progress', planned: 'comp-planned' };
  const lbl  = { active: 'Active', 'in-progress': 'In Progress', planned: 'Planned' };
  container.innerHTML =
    '<div class="comp-header">' +
      '<span class="comp-title">Compliance Status</span>' +
      '<a href="/security.html" target="_blank" class="comp-detail-link">Full Security Docs →</a>' +
    '</div>' +
    '<div class="comp-grid">' +
    _COMPLIANCE_STATUS.map(function(item) {
      return '<div class="comp-item ' + cls[item.status] + '" title="' + item.note + '">' +
        '<span class="comp-icon">' + icon[item.status] + '</span>' +
        '<div class="comp-item-body">' +
          '<span class="comp-item-label">' + item.label + '</span>' +
          '<span class="comp-item-status">' + lbl[item.status] + '</span>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>';
  container.style.display = 'block';
}
window._instRenderComplianceWidget = _instRenderComplianceWidget;

// ── CTO5: SLA & Support Tier Display ─────────────────────────────────────
const _SLA_TIERS = {
  academic: { label: 'Academic Institution',   uptime: '99.5%', critical: '8 business hours',  standard: '48 business hours', csm: false, email: 'support@adherence.cc',    features: ['Email support', 'Help documentation', 'Monthly release notes', 'Community forum'] },
  health:   { label: 'Health System',           uptime: '99.9%', critical: '4 business hours',  standard: '24 business hours', csm: true,  email: 'enterprise@adherence.cc', features: ['Dedicated CSM', 'Priority support', 'Quarterly reviews', 'Custom onboarding', 'BAA & DUA included'] },
  amc:      { label: 'Academic Medical Center', uptime: '99.9%', critical: '2 business hours',  standard: '12 business hours', csm: true,  email: 'enterprise@adherence.cc', features: ['Dedicated CSM', 'Priority support', 'Quarterly reviews', 'Custom onboarding', 'BAA & DUA included', 'API integration support', 'Custom reporting'] },
  pi:       { label: 'Investigator Workspace',  uptime: '99.5%', critical: '24 business hours', standard: '72 business hours', csm: false, email: 'support@adherence.cc',    features: ['Email support', 'Help documentation', 'IRB package assistance'] },
  default:  { label: 'Standard',               uptime: '99.5%', critical: '48 business hours', standard: '5 business days',  csm: false, email: 'support@adherence.cc',    features: ['Email support', 'Help documentation'] },
};

function _instRenderSLACard() {
  const container = document.getElementById('inst-sla-card');
  if (!container) return;
  const role = ((window._currentWorkspaceProfile && window._currentWorkspaceProfile.role) || sessionStorage.getItem('_wsRole') || 'default').toLowerCase();
  const key = role.includes('amc') ? 'amc' : role.includes('health') ? 'health' : role.includes('acad') ? 'academic' : role.includes('pi') ? 'pi' : 'default';
  const sla = _SLA_TIERS[key];
  const csmName = window._currentWorkspaceProfile && window._currentWorkspaceProfile.csm_name || null;
  container.innerHTML =
    '<div class="sla-header">' +
      '<span class="sla-eyebrow">Support & SLA</span>' +
      '<span class="sla-tier-label">' + sla.label + '</span>' +
    '</div>' +
    '<div class="sla-grid">' +
      '<div class="sla-metric"><span class="sla-metric-val">' + sla.uptime + '</span><span class="sla-metric-lbl">Uptime SLA</span></div>' +
      '<div class="sla-metric"><span class="sla-metric-val">' + sla.critical + '</span><span class="sla-metric-lbl">Critical Response</span></div>' +
      '<div class="sla-metric"><span class="sla-metric-val">' + sla.standard + '</span><span class="sla-metric-lbl">Standard Response</span></div>' +
    '</div>' +
    '<div class="sla-contact">' +
      '<div class="sla-csm">' +
        '<span class="sla-csm-icon">' + (sla.csm ? '◎' : '✉') + '</span>' +
        '<div>' +
          '<span class="sla-csm-label">' + (sla.csm ? 'Dedicated Customer Success Manager' : 'Support Email') + '</span>' +
          (csmName ? '<span class="sla-csm-name">' + csmName + '</span>' : '') +
          '<a href="mailto:' + sla.email + '" class="sla-csm-email">' + sla.email + '</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="sla-features">' +
      '<span class="sla-features-label">Included with your plan</span>' +
      '<ul class="sla-feat-list">' +
      sla.features.map(function(f) { return '<li class="sla-feat-item"><span class="sla-feat-check">✓</span>' + f + '</li>'; }).join('') +
      '</ul>' +
    '</div>' +
    '<div class="sla-ticket">' +
      '<a href="mailto:' + sla.email + '?subject=ATLAS Support Request — ' + sla.label + '" class="sla-ticket-btn">Open Support Ticket →</a>' +
    '</div>';
  container.style.display = 'block';
}
window._instRenderSLACard = _instRenderSLACard;

// ══════════════════════════════════════════════════════════════════════════════
// ── Institution Quarterly AI Executive Summary ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Injects the Quarterly Executive Summary UI card into the Reporting tab panel.
 * Guard-checked so it only runs once even if switchInstDashTab('reporting') fires
 * multiple times.
 */
function injectInstQuarterlySummaryUI() {
  // ── Quarterly AI Executive Summary ───────────────────────────────────────
  if (!document.getElementById('inst-quarterly-btn')) {
    var _qsWrap = document.createElement('div');
    _qsWrap.style.cssText = 'margin-top:20px;padding:16px 18px;background:rgba(212,168,67,0.04);border:1px solid rgba(212,168,67,0.18);border-radius:10px;';
    _qsWrap.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.66rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--pe);margin-bottom:6px;">Quarterly Executive Summary</div>' +
      '<div style="font-size:0.83rem;color:var(--muted);line-height:1.55;margin-bottom:12px;">AI-drafted summary for CMO, Dean, or Board reporting. Benchmarked against published adherence standards. Review before distribution.</div>' +
      '<button id="inst-quarterly-btn" onclick="generateInstQuarterlySummary()" style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;background:rgba(212,168,67,0.10);border:1px solid rgba(212,168,67,0.35);color:rgba(212,168,67,0.92);padding:8px 18px;border-radius:7px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background=\'rgba(212,168,67,0.18)\'" onmouseout="this.style.background=\'rgba(212,168,67,0.10)\'">✦ Generate Quarterly Executive Summary</button>' +
      '<div id="inst-quarterly-output" style="display:none;margin-top:14px;padding:14px;background:rgba(0,0,0,0.18);border-radius:8px;border:1px solid rgba(255,255,255,0.07);"></div>';

    // Try to inject into the reporting tab panel
    var _repPanel = document.getElementById('inst-tab-panel-reporting') || document.getElementById('accsec-reporting');
    if (_repPanel) _repPanel.appendChild(_qsWrap);
  }
}

/**
 * Calls the ZOE/Claude endpoint to generate a quarterly executive summary
 * for institution leadership (CMO, Dean, Board committee).
 */
async function generateInstQuarterlySummary() {
  var btn = document.getElementById('inst-quarterly-btn');
  var out = document.getElementById('inst-quarterly-output');
  if (!btn || !out) return;
  btn.disabled = true;
  btn.textContent = '✦ Generating…';
  out.style.display = '';
  out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);animation:blink 1.4s ease-in-out infinite;padding:10px;">Generating executive summary…</div>';

  // Collect institution-level data
  var allRecords = window.dashMmasData || window._instMmasData || [];
  var peacsAll   = window.dashPeacsData || window._instPeacsData || [];
  var total = allRecords.length;
  var scores = allRecords.map(function(r){ return parseFloat(r.score||r.mmas_score||0); }).filter(function(s){ return s > 0; });
  var avg = scores.length ? (scores.reduce(function(a,b){return a+b;},0)/scores.length).toFixed(2) : 'N/A';
  var high = scores.filter(function(s){ return s >= 6; }).length;
  var med  = scores.filter(function(s){ return s >= 4 && s < 6; }).length;
  var low  = scores.filter(function(s){ return s < 4; }).length;
  var countries = [...new Set(allRecords.map(function(r){ return r.country; }).filter(Boolean))];

  // Get institution name and type
  var instName = (window.workspaceProfile && (window.workspaceProfile.name || window.workspaceProfile.institution)) || 'the institution';
  var instType = (window.workspaceProfile && window.workspaceProfile.institutionType) || 'health';
  var instTypeLabel = instType === 'academic' ? 'Academic Research Institution' : instType === 'amc' ? 'Academic Medical Center' : 'Health System';

  // Get quarter
  var now = new Date();
  var q = Math.ceil((now.getMonth()+1)/3);
  var qLabel = 'Q' + q + ' ' + now.getFullYear();

  // Count active PIs/sites
  var sites = [...new Set(allRecords.map(function(r){ return r.workspace || r.site; }).filter(Boolean))];

  var prompt = 'Write a professional quarterly executive summary for a healthcare institution\'s medication adherence program.\n\n'
    + 'Institution: ' + instName + ' (' + instTypeLabel + ')\n'
    + 'Reporting Period: ' + qLabel + '\n'
    + 'Platform: ATLAS (Adherence Tracking and Longitudinal Assessment System)\n'
    + 'Total assessments this period: ' + total + '\n'
    + 'Active research sites/workspaces: ' + sites.length + '\n'
    + 'Mean MMAS adherence score: ' + avg + '/8 (benchmark: 5.93, Morisky et al. 2008)\n'
    + 'High adherence (≥6.0): ' + high + ' (' + (total ? Math.round(100*high/total) : 0) + '%)\n'
    + 'Medium adherence (4.0–5.9): ' + med + ' (' + (total ? Math.round(100*med/total) : 0) + '%)\n'
    + 'Low adherence (<4.0): ' + low + ' (' + (total ? Math.round(100*low/total) : 0) + '%)\n'
    + 'Geographic reach: ' + (countries.length || 'not recorded') + ' countries\n'
    + 'PEACS behavioral assessments completed: ' + peacsAll.length + '\n\n'
    + 'Write a 3-paragraph executive summary suitable for a CMO, Dean, or Board committee. Paragraph 1: program overview and enrollment. Paragraph 2: key adherence findings benchmarked against published standards. Paragraph 3: strategic implications and recommended focus areas for next quarter. Use formal executive language. Do not fabricate statistics beyond what is provided.';

  try {
    var resp = await fetch('/lambda-proxy/zoe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await resp.json();
    var text = (data.content && data.content[0] && data.content[0].text) || 'No summary generated.';
    out.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--pe);margin-bottom:10px;">✦ ' + qLabel + ' Executive Summary · AI Draft · ' + instName + '</div>' +
      '<div style="font-family:var(--font-body);font-size:0.88rem;line-height:1.75;color:var(--text);white-space:pre-wrap;">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;align-items:center;">' +
        '<button onclick="(function(){ var t=document.getElementById(\'inst-quarterly-output\').querySelector(\'div:nth-child(2)\'); if(t) navigator.clipboard.writeText(t.textContent); })()" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.25);color:rgba(212,168,67,0.8);padding:5px 13px;border-radius:6px;cursor:pointer;">Copy Text</button>' +
        '<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);">AI draft · review before distribution to leadership</div>' +
      '</div>';
  } catch(e) {
    out.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);padding:10px;">Could not generate summary. Please try again.</div>';
  }
  btn.disabled = false;
  btn.textContent = '✦ Regenerate Summary';
}
