// ══════════════════════════════════════════════════════════════════════════
// RESEARCHER / STUDENT PATIENT PANEL — rpp*
// Read-only cohort view: one row per unique patient_number, merging MMAS
// and PEACS records. Sortable, expandable. No edit/delete controls.
// Only rendered for isPIResearcher() && !isInstitutionMode().
// ══════════════════════════════════════════════════════════════════════════

/**
 * Recompute MMAS-8 total score from individual item values stored in Firebase.
 * Always use this instead of r.score to correct historical records where q8 was
 * stored as an integer index (0–4) but incorrectly counted as a raw score.
 *
 * Convention (matches q8Label in dashboard-core.js):
 *   - q8 integer 0–4 → index: 0=Never(1.0), 1=Once in a while(0.75),
 *                              2=Sometimes(0.5), 3=Usually(0.25), 4=All the time(0)
 *   - q8 non-integer decimal → already a score, use directly
 *   - q8 string → mapped via label lookup
 */
function _recomputeMMASScore(r) {
  // MAP records use map_q* fields — fall back to stored score for those
  if (r.tool === 'map' || r.map_q1 !== undefined) return r.score || 0;
  const binary = (parseFloat(r.q1)||0) + (parseFloat(r.q2)||0) + (parseFloat(r.q3)||0) +
                 (parseFloat(r.q4)||0) + (parseFloat(r.q5)||0) + (parseFloat(r.q6)||0) +
                 (parseFloat(r.q7)||0);
  const raw = r.q8;
  let q8val;
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 0 && raw <= 4) {
      q8val = [1, 0.75, 0.5, 0.25, 0][raw];
    } else {
      q8val = raw; // already a decimal score (e.g. 0.75)
    }
  } else {
    const s = String(raw || '').trim().toLowerCase();
    q8val = ({ never:1, rarely:0.75, 'once in a while':0.75, sometimes:0.5,
               often:0.25, usually:0.25, always:0, 'all the time':0 })[s] ?? 0;
  }
  return binary + q8val;
}

/** @type {Object[]} Raw MMAS assessment records for the researcher/student panel */
window._rppMmasData  = [];
/** @type {Object[]} Raw PEACS assessment records for the researcher/student panel */
window._rppPeacsData = [];
/** @type {Array<{pid: string, mmas: Object[], peacs: Object[], lastTs: number}>} Patient rows grouped by patient_number */
window._rppData      = [];
/** @type {Array<{pid: string, mmas: Object[], peacs: Object[], lastTs: number}>} Current filtered subset of _rppData */
window._rppFiltered  = [];
/** @type {string} Current sort key: 'recent'|'score_asc'|'score_desc'|'pid'|'visits' */
window._rppSort      = 'recent';
/** @type {number} Current page index (0-based) */
window._rppPage      = 0;
/** @type {number} Rows per page */
window._rppPageSize  = 20;

/**
 * Sets the RPP MMAS dataset and triggers a full panel rebuild.
 * Called from loadMmasCohortData after MMAS records are loaded.
 * @param {Object[]} mmasRecords - Array of MMAS assessment records
 * @returns {void}
 */
function rppBuild(mmasRecords) {
  window._rppMmasData = mmasRecords || [];
  _rppRebuild();
}

/**
 * Sets the RPP PEACS dataset and triggers a full panel rebuild.
 * Called from loadPeacsCohortData after PEACS records are loaded.
 * @param {Object[]} peacsRecords - Array of PEACS assessment records
 * @returns {void}
 */
function rppMergePeacs(peacsRecords) {
  window._rppPeacsData = peacsRecords || [];
  _rppRebuild();
}

// Merge both data sources and re-render
function _rppRebuild() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const mmas  = window._rppMmasData;
  const peacs = window._rppPeacsData;
  if (!mmas.length && !peacs.length) {
    const tbody = document.getElementById('rpp-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.90rem;">' + (_t.empty_no_records_submit || 'No records yet. Submit your first assessment above.') + '</td></tr>';
    return;
  }

  const byPid = {};

  mmas.forEach(r => {
    const pid = (r.patient_number || '').toString().trim().toUpperCase() || 'UNASSIGNED';
    if (!byPid[pid]) byPid[pid] = { pid, mmas: [], peacs: [], lastTs: 0 };
    byPid[pid].mmas.push(r);
    if ((r.timestamp || 0) > byPid[pid].lastTs) byPid[pid].lastTs = r.timestamp;
  });

  peacs.forEach(r => {
    const pid = (r.patient_number || '').toString().trim().toUpperCase() || 'UNASSIGNED';
    if (!byPid[pid]) byPid[pid] = { pid, mmas: [], peacs: [], lastTs: 0 };
    byPid[pid].peacs.push(r);
    if ((r.timestamp || 0) > byPid[pid].lastTs) byPid[pid].lastTs = r.timestamp;
  });

  window._rppData     = Object.values(byPid);
  window._rppFiltered = [...window._rppData];
  window._rppPage     = 0;
  _rppApplySort();
  _rppRender();
  _rppUpdateSummary();
  _resUpdateAnalytics();
  _cpoUpdate();
  // Refresh clinician worklist if active
  if (typeof window._clinRefreshFromRpp === 'function') window._clinRefreshFromRpp();
}

/**
 * Filters the RPP patient list by the current search input value (matches patient ID prefix).
 * Resets to page 0 and re-renders.
 * @returns {void}
 */
function rppFilter() {
  const q = (document.getElementById('rpp-search')?.value || '').trim().toUpperCase();
  window._rppFiltered = q
    ? window._rppData.filter(p => p.pid.includes(q))
    : [...window._rppData];
  window._rppPage = 0;
  _rppApplySort();
  _rppRender();
}

/**
 * Sets the RPP sort order and re-renders the patient table.
 * @param {'recent'|'score_asc'|'score_desc'|'pid'|'visits'} val - Sort key
 * @returns {void}
 */
function rppSort(val) {
  window._rppSort = val;
  window._rppPage = 0;
  _rppApplySort();
  _rppRender();
}

function _rppApplySort() {
  const rows = window._rppFiltered;
  switch (window._rppSort) {
    case 'score_asc':
      rows.sort((a, b) => _rppLatestMmas(a) - _rppLatestMmas(b)); break;
    case 'score_desc':
      rows.sort((a, b) => _rppLatestMmas(b) - _rppLatestMmas(a)); break;
    case 'pid':
      rows.sort((a, b) => a.pid.localeCompare(b.pid)); break;
    case 'visits':
      rows.sort((a, b) => (b.mmas.length + b.peacs.length) - (a.mmas.length + a.peacs.length)); break;
    case 'recent':
    default:
      rows.sort((a, b) => b.lastTs - a.lastTs); break;
  }
}

function _rppLatestMmas(p) {
  if (!p.mmas.length) return 0;
  return [...p.mmas].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0]?.score || 0;
}

function _rppRender() {
  const tbody    = document.getElementById('rpp-tbody');
  const empty    = document.getElementById('rpp-empty');
  const count    = document.getElementById('rpp-count');
  const pager    = document.getElementById('rpp-pager');
  const pageInfo = document.getElementById('rpp-pageinfo');
  const prevBtn  = document.getElementById('rpp-prev-btn');
  const nextBtn  = document.getElementById('rpp-next-btn');
  if (!tbody) return;

  const allRows  = window._rppFiltered;
  const pageSize = window._rppPageSize || 20;
  const page     = window._rppPage    || 0;
  const total    = allRows.length;
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (count) count.textContent = `${total} patient${total !== 1 ? 's' : ''}`;

  if (!total) {
    tbody.innerHTML = '';
    if (empty)  empty.style.display  = 'block';
    if (pager)  pager.style.display  = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Slice to current page
  const start = page * pageSize;
  const rows  = allRows.slice(start, start + pageSize);

  // Update pager controls
  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    if (pageInfo) pageInfo.textContent = `Page ${page + 1} of ${totalPages}`;
    if (prevBtn)  prevBtn.disabled = page === 0;
    if (nextBtn)  nextBtn.disabled = page >= totalPages - 1;
  }

  const timeAgo = ts => {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)     return 'Just now';
    if (d < 3600)   return Math.floor(d/60)   + 'm ago';
    if (d < 86400)  return Math.floor(d/3600) + 'h ago';
    if (d < 604800) return Math.floor(d/86400)+ 'd ago';
    return new Date(ts).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  };

  const patLabels = {
    ina:  '<span style="font-family:var(--font-mono);font-size:0.90rem;padding:2px 6px;border-radius:8px;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">INA</span>',
    una:  '<span style="font-family:var(--font-mono);font-size:0.90rem;padding:2px 6px;border-radius:8px;background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">UNA</span>',
    mixed:'<span style="font-family:var(--font-mono);font-size:0.90rem;padding:2px 6px;border-radius:8px;background:rgba(139,111,245,0.12);color:#8b6ff5;border:1px solid rgba(139,111,245,0.3);">Mixed</span>',
    high: '<span style="font-family:var(--font-mono);font-size:0.90rem;padding:2px 6px;border-radius:8px;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);">High</span>',
  };

  tbody.innerHTML = rows.map((p, localIdx) => {
    const idx = start + localIdx; // global index — stable across pages for detail toggle IDs
    const mmasSorted  = [...p.mmas].sort((a, b) => (a.timestamp||0) - (b.timestamp||0));
    const peacssSorted = [...p.peacs].sort((a, b) => (a.timestamp||0) - (b.timestamp||0));
    const latestMmas  = mmasSorted[mmasSorted.length - 1];
    const latestPeacs = peacssSorted[peacssSorted.length - 1];

    // MMAS display — recompute from items to correct historical q8 index-vs-score bug
    const mmasScore = latestMmas ? _recomputeMMASScore(latestMmas) : 0;
    const cat = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(mmasScore) : { color:'#4e9cf5' };
    const mmasCell = p.mmas.length
      ? `<span style="font-family:var(--font-mono);font-size:0.86rem;font-weight:600;color:${cat.color};">${mmasScore.toFixed(2)}</span><span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);margin-left:3px;">${p.mmas.length}×</span>`
      : `<span style="color:var(--dim);font-size:0.90rem;">—</span>`;

    // PEACS display
    const peScore = latestPeacs?.pe ?? latestPeacs?.pe_score ?? null;
    const peacsCell = p.peacs.length
      ? `<span style="font-family:var(--font-mono);font-size:0.86rem;font-weight:600;color:var(--strata);">${peScore !== null ? peScore.toFixed(3) : '✓'}</span><span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);margin-left:3px;">${p.peacs.length}×</span>`
      : `<span style="color:var(--dim);font-size:0.90rem;">—</span>`;

    // Coverage pill
    const both = p.mmas.length && p.peacs.length;
    const coverageColor = both ? 'var(--optimal)' : 'var(--moderate)';
    const coverageLabel = both ? 'Both' : p.mmas.length ? 'MMAS' : 'PEACS';
    const coverageCell  = `<span style="font-family:var(--font-mono);font-size:0.88rem;padding:2px 7px;border-radius:8px;background:${coverageColor}18;color:${coverageColor};border:1px solid ${coverageColor}44;">${coverageLabel}</span>`;

    // Pattern from latest MMAS
    let pat = 'una';
    if (mmasScore >= 8) pat = 'high';
    else if (latestMmas?.q1 !== undefined) {
      try {
        const { intentional, unintentional } = classifyPattern(latestMmas);
        pat = intentional > unintentional ? 'ina' : unintentional > intentional ? 'una' : 'mixed';
      } catch(e) {}
    }

    // MMAS trend sparkline
    let trendCell = '<td style="text-align:center;color:var(--dim);font-size:0.90rem;">—</td>';
    if (mmasSorted.length >= 2) {
      const first = _recomputeMMASScore(mmasSorted[0]), last = mmasScore;
      const delta = last - first;
      const tColor = delta > 0.1 ? '#10b981' : delta < -0.1 ? '#ef4444' : '#6b8099';
      const tIcon  = delta > 0.1 ? '↑' : delta < -0.1 ? '↓' : '→';
      const pts    = mmasSorted.map(r => _recomputeMMASScore(r));
      const W = 44, H = 16;
      const minS = Math.min(...pts), maxS = Math.max(...pts), range = maxS - minS || 1;
      const coords = pts.map((s, i) => `${(i/(pts.length-1||1)*W).toFixed(1)},${(H-(s-minS)/range*H).toFixed(1)}`).join(' ');
      trendCell = `<td style="text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:3px;">
          <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
            <polyline points="${coords}" fill="none" stroke="${tColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${((mmasSorted.length-1)/(mmasSorted.length-1||1)*W).toFixed(1)}" cy="${(H-(mmasScore-minS)/range*H).toFixed(1)}" r="2" fill="${tColor}"/>
          </svg>
          <span style="font-size:0.88rem;color:${tColor};font-weight:600;">${tIcon}</span>
        </div>
      </td>`;
    }

    const condition = latestMmas?.condition || latestPeacs?.condition || '—';
    const condShort = condition.length > 22 ? condition.slice(0,20)+'…' : condition;

    // ── Expanded detail row ───────────────────────────────────────────────
    const mmasHistRows = mmasSorted.slice().reverse().map(r => {
      const sc = _recomputeMMASScore(r);
      const rc = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(sc) : { color:'#4e9cf5' };
      const dt = new Date(r.timestamp).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
      const studyBadge = r.study_title
        ? `<span title="${_esc(r.study_title)}${r.pi_name?' · '+_esc(r.pi_name):''}" style="font-family:var(--font-mono);font-size:0.78rem;padding:1px 5px;border-radius:5px;background:rgba(78,156,245,0.08);color:rgba(78,156,245,0.6);border:1px solid rgba(78,156,245,0.18);white-space:nowrap;margin-left:4px;cursor:default;">Study</span>`
        : '';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="font-family:var(--font-mono);font-size:0.82rem;color:var(--muted);padding:5px 8px;">${dt}</td>
        <td style="font-family:var(--font-mono);font-size:0.88rem;font-weight:600;color:${rc.color};padding:5px 8px;text-align:center;">${sc.toFixed(2)}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:${rc.color};padding:5px 8px;">${r.adherence_level||'—'}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);padding:5px 8px;">${_esc(r.condition)||'—'}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);padding:5px 8px;">${_esc(r.drug_name)||'—'}${studyBadge}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:5px 8px;text-align:center;">${_esc(r.age_range)||'—'}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:5px 8px;text-align:center;">${_esc(r.gender)||'—'}</td>
      </tr>`;
    }).join('');

    const peacsHistRows = peacssSorted.slice().reverse().map(r => {
      const pe  = r.pe ?? r.pe_score ?? null;
      const zone = pe !== null ? (pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical') : '—';
      const zc   = {'Optimal':'#10b981','Good':'#3b82f6','Moderate':'#f59e0b','Poor':'#ef4444','Critical':'#991b1b'}[zone] || '#6b8099';
      const dt   = new Date(r.timestamp).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="font-family:var(--font-mono);font-size:0.82rem;color:var(--muted);padding:5px 8px;">${dt}</td>
        <td style="font-family:var(--font-mono);font-size:0.88rem;font-weight:600;color:var(--strata);padding:5px 8px;text-align:center;">${pe !== null ? pe.toFixed(3) : '✓'}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:${zc};padding:5px 8px;">${zone}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);padding:5px 8px;">${(r.base||0).toFixed(3)}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);padding:5px 8px;">${(r.mvmt||0).toFixed(3)}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);padding:5px 8px;">${(r.strata||0).toFixed(3)}</td>
        <td style="font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);padding:5px 8px;">${r.risk_level||r.adherence_level||'—'}</td>
      </tr>`;
    }).join('');

    return `<tr id="rpp-row-${idx}" style="border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;"
        onmouseenter="this.style.background='rgba(255,255,255,0.02)'"
        onmouseleave="this.style.background=''"
        onclick="rppToggleDetail(${idx})">
      <td style="padding:10px 14px;font-family:var(--font-mono);font-size:0.71rem;color:var(--bright);font-weight:500;">${p.pid}</td>
      <td style="padding:10px;text-align:center;">${coverageCell}</td>
      <td style="padding:10px;text-align:center;">${mmasCell}</td>
      <td style="padding:10px;text-align:center;">${peacsCell}</td>
      <td style="padding:10px;text-align:center;">${patLabels[pat] || '—'}</td>
      ${trendCell}
      <td style="padding:10px;font-family:var(--font-mono);font-size:0.86rem;color:var(--muted);" title="${condition}">${condShort}</td>
      <td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">${timeAgo(p.lastTs)}</td>
    </tr>
    <tr id="rpp-detail-${idx}" style="display:none;background:var(--card2);border-bottom:1px solid var(--border);">
      <td colspan="8" style="padding:16px 18px;">
        <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:10px;">
          <button onclick="event.stopPropagation();_rppPrintRecord(${JSON.stringify(p).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')});" style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.22);color:var(--base);border-radius:6px;padding:5px 12px;cursor:pointer;transition:all 0.18s;" onmouseover="this.style.background='rgba(78,156,245,0.15)'" onmouseout="this.style.background='rgba(78,156,245,0.07)'">🖨 Print Result Card</button>
        </div>
        ${(() => {
          // Collect unique studies from this patient's MMAS records
          const studyMap = {};
          p.mmas.forEach(r => {
            if (!r.study_title) return;
            const k = r.study_title;
            if (!studyMap[k]) studyMap[k] = { title: r.study_title, pi: r.pi_name || null, institution: r.study_institution || null, earliest: Infinity, latest: 0 };
            if ((r.timestamp||0) < studyMap[k].earliest) studyMap[k].earliest = r.timestamp;
            if ((r.timestamp||0) > studyMap[k].latest)   studyMap[k].latest   = r.timestamp;
          });
          const studies = Object.values(studyMap);
          if (!studies.length) return '';
          const fmtD = ts => ts === Infinity || !ts ? '—' : new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
          return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            ${studies.map(s => `<div style="background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.18);border-radius:8px;padding:8px 14px;min-width:200px;flex:1;">
              <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(78,156,245,0.5);margin-bottom:4px;">Study Source</div>
              <div style="font-size:0.88rem;color:var(--text);font-weight:500;margin-bottom:2px;">${s.title}</div>
              ${s.pi ? `<div style="font-size:0.80rem;color:var(--muted);">${s.pi}${s.institution ? ' · ' + s.institution : ''}</div>` : ''}
              <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);margin-top:4px;">${fmtD(s.earliest)} – ${fmtD(s.latest)}</div>
            </div>`).join('')}
          </div>`;
        })()}
        <div style="display:grid;grid-template-columns:${p.mmas.length && p.peacs.length ? '1fr 1fr' : '1fr'};gap:16px;">
          ${p.mmas.length ? `<div>
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--base);margin-bottom:8px;">MMAS-8 History (${p.mmas.length} visit${p.mmas.length!==1?'s':''})</div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                ${['Date','Score','Level','Condition','Drug','Age','Gender'].map(h=>`<th style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);padding:3px 8px;text-align:left;border-bottom:1px solid var(--border);">${h}</th>`).join('')}
              </tr></thead>
              <tbody>${mmasHistRows}</tbody>
            </table>
          </div>` : ''}
          ${p.peacs.length ? `<div>
            <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--strata);margin-bottom:8px;">PEACS History (${p.peacs.length} visit${p.peacs.length!==1?'s':''})</div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                ${['Date','PE','Zone','BASE','MVMT','STRATA','Risk'].map(h=>`<th style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);padding:3px 8px;text-align:left;border-bottom:1px solid var(--border);">${h}</th>`).join('')}
              </tr></thead>
              <tbody>${peacsHistRows}</tbody>
            </table>
          </div>` : ''}
        </div>
        ${(() => {
          if (!latestMmas) return '';
          try { return _renderMAPProtocolPanelHTML(latestMmas); } catch(e) { return ''; }
        })()}
      </td>
    </tr>`;
  }).join('');
}

// ── Print a patient's latest MMAS record as a clinical result card ────────────
function _rppPrintRecord(p) {
  const latestMmas = [...p.mmas].sort((a, b) => (a.timestamp||0) - (b.timestamp||0)).slice(-1)[0];
  if (!latestMmas) { showToast('No MMAS record to print for this patient.', 2500); return; }
  const score = _recomputeMMASScore(latestMmas);
  const cat   = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(score) : { color:'#4e9cf5', label:'—' };
  const date  = new Date(latestMmas.timestamp || Date.now()).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
  const highPct = Math.round((score / 8) * 100);
  const existing = document.getElementById('print-result-card');
  if (existing) existing.remove();
  const card = document.createElement('div');
  card.id = 'print-result-card';
  card.style.display = 'none';
  card.innerHTML = `
    <div class="prc-brand">Adherence Cartography · ATLAS · MMAS-8 Assessment</div>
    <div class="prc-title">Patient Adherence Record · ${_esc(p.pid)}</div>
    <div class="prc-sub">Assessment date: ${date} · Condition: ${_esc(latestMmas.condition||'—')} · Drug: ${_esc(latestMmas.drug_name||'—')} · Workspace: ${_esc(currentWorkspace||'—')}</div>
    <div class="prc-score" style="color:${cat.color}">${score.toFixed(2)}</div>
    <div class="prc-level" style="color:${cat.color}">${cat.label}</div>
    <div class="prc-pattern">Age: ${_esc(latestMmas.age_range||'—')} · Gender: ${_esc(latestMmas.gender||'—')}</div>
    <div class="prc-bar-row">
      <div style="flex:${highPct};background:${cat.color};"></div>
      <div style="flex:${100-highPct};background:#f3f4f6;"></div>
    </div>
    <div class="prc-bar-label">${highPct}% of maximum adherence score (8.0)</div>
    <div class="prc-footer">
      <div>
        <div>Adherence Cartography · Adherence Inc. · 100 Oceangate, 12th Floor, Long Beach, CA 90802</div>
        <div>info@adherence.cc · atlas.adherence.cc</div>
        <div class="prc-ip">MMAS-8 is intellectual property of MMAR LLC. ATLAS is the intellectual property of Adherence Cartography. Permission required for use.</div>
      </div>
    </div>`;
  document.body.appendChild(card);
  document.body.classList.add('printing-result');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-result'); const c = document.getElementById('print-result-card'); if (c) c.remove(); }, 1000);
}

// ── MAP Phenotype Protocol Panel ──────────────────────────────────────────────
/**
 * Returns an HTML string for the MAP phenotype coaching protocol panel.
 * Used inline inside the rpp detail row template.
 * @param {Object} record - assessment record with q1-q8 or map_q* fields
 * @returns {string} HTML string
 */
function _renderMAPProtocolPanelHTML(record) {
  if (!record) return '';
  const phenotype = (typeof deriveMAPPhenotype === 'function') ? deriveMAPPhenotype(record) : 'PA';
  const MAP_P = (typeof MAP_PHENOTYPE !== 'undefined') ? MAP_PHENOTYPE : null;
  const p = MAP_P ? MAP_P[phenotype] : null;
  if (!p) return '';

  const protocols = {
    INA: [
      'Explore medication necessity beliefs — ask open questions, avoid telling',
      'Apply MI reflective prompts to surface ambivalence about medication',
      'Share anonymized peer narratives of patients who overcame similar concerns',
      'Escalate to prescriber if INA pattern persists across 2 consecutive assessments',
      'Do NOT use didactic information delivery — contraindicated for INA'
    ],
    UNA: [
      'Map dosing schedule to an existing daily routine (habit cue pairing)',
      'Configure SMS/push reminders with patient-selected timing and modality',
      'Review pill administration technique — check for swallowing/dexterity barriers',
      'Set up weekly adherence streak tracking with positive reinforcement',
      'Check refill process — is the pharmacy workflow adding friction?'
    ],
    PA: [
      'Conduct brief structured check-in to identify specific disruption contexts',
      'Build contingency plan for travel, schedule changes, and refill lapses',
      'Provide stress-adherence psychoeducation if emotional patterns are present',
      'Send proactive reminder during identified high-risk periods (travel, illness)',
      'Review co-pay burden — financial barriers often drive partial adherence'
    ],
    A: [
      'Acknowledge adherence milestone — positive reinforcement sustains behavior',
      'Schedule next MAP reassessment (recommended: 90 days)',
      'Educate on known disruption triggers: new medications, formulary changes, life transitions',
      'Set alert for phenotype regression at next assessment',
      'No active intervention required — maintenance protocol only'
    ]
  };

  const steps = protocols[phenotype] || [];
  const badgeHTML = (typeof mapPhenotypeBadge === 'function') ? mapPhenotypeBadge(phenotype, false) : `<span>${phenotype}</span>`;
  return `<div style="background:${p.bg};border:1px solid ${p.border};border-radius:10px;padding:16px 18px;margin:12px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      ${badgeHTML}
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:${p.color};">${p.protocol} Protocol</span>
    </div>
    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px;">
      ${steps.map((s,i) => `
        <li style="display:flex;gap:10px;align-items:flex-start;font-size:0.82rem;color:var(--text,#c8d6e8);line-height:1.5;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.60rem;color:${p.color};flex-shrink:0;margin-top:2px;">${String(i+1).padStart(2,'0')}</span>
          ${s}
        </li>`).join('')}
    </ul>
  </div>`;
}

/**
 * Renders the MAP phenotype coaching protocol panel into a DOM container.
 * @param {Object} record - assessment record with q1-q8 fields
 * @param {HTMLElement} container - element to append the panel into
 * @returns {HTMLElement|undefined} the created panel div, or undefined
 */
function _renderMAPProtocolPanel(record, container) {
  if (!record || !container) return;
  const html = _renderMAPProtocolPanelHTML(record);
  if (!html) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const panel = wrapper.firstElementChild;
  if (panel) container.appendChild(panel);
  return panel;
}

function _rppUpdateSummary() {
  const bar = document.getElementById('rpp-summary-bar');
  if (!bar) return;

  // Gather latest MMAS score per patient (cross-sectional snapshot)
  const patients = window._rppData || [];
  const scores = [];
  let nHigh = 0, nMed = 0, nLow = 0;
  // Q-item fail tallies — track which question is most commonly non-adherent
  // Q1-Q4,Q6,Q7: non-adherent = 1 (YES); Q5: non-adherent = 0 (NO); Q8: non-adherent = < 1
  const qFails = { q1:0, q2:0, q3:0, q4:0, q5:0, q6:0, q7:0, q8:0 };
  const qTotal = { q1:0, q2:0, q3:0, q4:0, q5:0, q6:0, q7:0, q8:0 };

  patients.forEach(p => {
    if (!p.mmas.length) return;
    const latest = [...p.mmas].sort((a, b) => (b.timestamp||0) - (a.timestamp||0))[0];
    const s = latest.score ?? 0;
    scores.push(s);
    if (s >= 8)       nHigh++;
    else if (s >= 6)  nMed++;
    else              nLow++;

    // Item-level failures on all assessments (not just latest)
    p.mmas.forEach(r => {
      ['q1','q2','q3','q4','q5','q6','q7','q8'].forEach(q => {
        if (r[q] === undefined) return;
        qTotal[q]++;
        if (q === 'q5') { if (r[q] === 0) qFails[q]++; }        // q5 reversed: NO = fail
        else if (q === 'q8') { if (r[q] < 1) qFails[q]++; }     // q8: less than 1 = fail
        else { if (r[q] === 1) qFails[q]++; }                    // q1-4,6,7: YES = fail
      });
    });
  });

  if (!scores.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';

  const n    = scores.length;
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const sd   = n > 1 ? Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const se   = sd / Math.sqrt(n);
  const ci95 = se * 1.96;

  // Top barrier: Q item with highest fail rate
  const qLabels = {
    q1: 'Q1 Forgetting', q2: 'Q2 Reasons', q3: 'Q3 Stopping',
    q4: 'Q4 Travel',     q5: 'Q5 Yesterday', q6: 'Q6 Control',
    q7: 'Q7 Hassle',     q8: 'Q8 Frequency',
  };
  let topQ = null, topRate = 0;
  Object.keys(qFails).forEach(q => {
    if (!qTotal[q]) return;
    const rate = qFails[q] / qTotal[q];
    if (rate > topRate) { topRate = rate; topQ = q; }
  });

  const pct = v => (n ? Math.round(v / n * 100) : 0);
  const fmt = v => v.toFixed(2);

  const set = (id, val, lbl, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<span class="rpp-stat-val" style="${color?'color:'+color:''}">${val}</span><span class="rpp-stat-lbl">${lbl}</span>`;
  };

  set('rss-n',      n,                              'Patients');
  set('rss-mean',   fmt(mean) + ' / 8',             'Mean Score');
  set('rss-sd',     '± ' + fmt(sd),                 'Std Dev');
  set('rss-ci',     fmt(mean - ci95) + '–' + fmt(mean + ci95), '95% CI');
  set('rss-high',   nHigh + ' (' + pct(nHigh) + '%)', 'High ≥8',   '#10b981');
  set('rss-med',    nMed  + ' (' + pct(nMed)  + '%)', 'Medium 6–8', '#f59e0b');
  set('rss-low',    nLow  + ' (' + pct(nLow)  + '%)', 'Low <6',     '#ef4444');
  if (topQ) {
    set('rss-barrier', qLabels[topQ] + ' (' + Math.round(topRate * 100) + '% fail)', 'Top Barrier', '#8b6ff5');
  } else {
    const barrierEl = document.getElementById('rss-barrier');
    if (barrierEl) barrierEl.innerHTML = '';
  }
}

// ── Research Analytics Panel — full barometer suite ──────────────────────
// Computes cohort-level stats from window._rppData and populates
// the res-analytics-panel barometers, adherence cards, Q-item bars,
// and (conditionally) the longitudinal section.
function _resUpdateAnalytics() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const panel = document.getElementById('res-analytics-panel');
  if (!panel || panel.style.display === 'none') return;

  const patients = window._rppData || [];
  if (!patients.length) return;

  // ── Gather stats from latest MMAS per patient ─────────────────────────
  const scores = [];
  let nHigh = 0, nMed = 0, nLow = 0;
  let nINA = 0, nUNA = 0, nMixed = 0;
  let nWithPeacs = 0;
  const countriesSet = new Set();
  const conditionsSet = new Set();
  const qFails  = { q1:0, q2:0, q3:0, q4:0, q5:0, q6:0, q7:0, q8:0 };
  const qTotals = { q1:0, q2:0, q3:0, q4:0, q5:0, q6:0, q7:0, q8:0 };

  patients.forEach(p => {
    if (p.peacs && p.peacs.length) nWithPeacs++;
    if (!p.mmas || !p.mmas.length) return;

    const latest = [...p.mmas].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    const s = latest.score ?? 0;
    scores.push(s);

    if (latest.country)    countriesSet.add(latest.country.trim());
    if (latest.condition)  conditionsSet.add(latest.condition.trim());

    if (s >= 8)       nHigh++;
    else if (s >= 6)  nMed++;
    else              nLow++;

    // INA / UNA / Mixed — use MAP classifier for map records, MMAS classifier for MMAS records
    if (s < 8) {
      try {
        const _isMap = latest.tool === 'map' || latest.map_q1 !== undefined;
        const _hasItems = _isMap ? (latest.map_q1 !== undefined) : (latest.q1 !== undefined);
        if (_hasItems) {
          const { intentional, unintentional } = _isMap ? classifyMapPattern(latest) : classifyPattern(latest);
          if (intentional > unintentional) nINA++;
          else if (unintentional > intentional) nUNA++;
          else if (intentional || unintentional) nMixed++;
        }
      } catch(e) {}
    }

    // Item-level failures across all assessments for barrier fingerprint
    p.mmas.forEach(r => {
      ['q1','q2','q3','q4','q5','q6','q7','q8'].forEach(q => {
        if (r[q] === undefined) return;
        qTotals[q]++;
        if (q === 'q5') { if (r[q] === 0) qFails[q]++; }
        else if (q === 'q8') { if (parseFloat(r[q]) < 1) qFails[q]++; }
        else { if (r[q] === 1) qFails[q]++; }
      });
    });
  });

  // ── MAP Additive + MAP PE metrics ──────────────────────────────────────────
  const _allRecs = (typeof dashMmasData !== 'undefined' ? dashMmasData : []);
  const mapRecs  = _allRecs.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  {
    const mapScores = mapRecs.map(r => +r.score || 0).filter(v => v > 0);
    const mapAdditiveAvg = mapScores.length ? mapScores.reduce((a, b) => a + b, 0) / mapScores.length : null;
    const mapPeScores = mapRecs.map(r => {
      const arch = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
      const exec = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
      const ctx  = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
      return Math.pow(Math.max(0, arch * exec * ctx), 1/3);
    }).filter(v => isFinite(v) && v > 0);
    const mapPeAvg = mapPeScores.length ? mapPeScores.reduce((a, b) => a + b, 0) / mapPeScores.length : null;
    const _setMap = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _setMap('rap-map-additive', mapAdditiveAvg !== null ? mapAdditiveAvg.toFixed(2) : '—');
    _setMap('rap-map-pe',       mapPeAvg       !== null ? mapPeAvg.toFixed(3)       : '—');
  }

  if (!scores.length) return;

  const n = scores.length;
  const totalP = patients.length;
  const sortedS = [...scores].sort((a,b) => a-b);
  const mean = scores.reduce((s,v) => s+v, 0) / n;
  const sd = n > 1 ? Math.sqrt(scores.reduce((s,v) => s+(v-mean)**2, 0) / (n-1)) : 0;
  const se = sd / Math.sqrt(n);
  const ci95 = se * 1.96;
  const median = n % 2 === 0
    ? (sortedS[n/2-1] + sortedS[n/2]) / 2
    : sortedS[Math.floor(n/2)];
  const pct = v => totalP ? Math.round(v / totalP * 100) : 0;
  const f2 = v => v.toFixed(2);

  // ── Populate barometers ───────────────────────────────────────────────
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('rap-n',          totalP);
  set('rap-mean',       f2(mean));
  set('rap-sd',         'σ ' + f2(sd));
  set('rap-median',     f2(median));
  set('rap-ci',         f2(mean - ci95) + '–' + f2(mean + ci95));
  set('rap-peacs-cov',  Math.round(nWithPeacs / totalP * 100) + '%');
  set('rap-countries',  countriesSet.size || '—');
  set('rap-conditions', conditionsSet.size || '—');

  // Adherence classification cards
  set('rap-high-n',   nHigh);    set('rap-high-pct',   pct(nHigh) + '%');
  set('rap-med-n',    nMed);     set('rap-med-pct',    pct(nMed)  + '%');
  set('rap-low-n',    nLow);     set('rap-low-pct',    pct(nLow)  + '%');
  set('rap-ina-n',    nINA);     set('rap-ina-pct',    pct(nINA)  + '%');
  set('rap-una-n',    nUNA);     set('rap-una-pct',    pct(nUNA)  + '%');
  set('rap-mixed-n',  nMixed);   set('rap-mixed-pct',  pct(nMixed)+ '%');

  // ── Q-item barrier fingerprint bars ──────────────────────────────────
  const qMeta = [
    { q:'q1', lbl:'Q1 · Forgot',    domain:'exec' },
    { q:'q2', lbl:'Q2 · Reasons',   domain:'arch' },
    { q:'q3', lbl:'Q3 · Stopped',   domain:'arch' },
    { q:'q4', lbl:'Q4 · Travel',    domain:'exec' },
    { q:'q5', lbl:'Q5 · Yesterday', domain:'exec' },
    { q:'q6', lbl:'Q6 · Control',   domain:'arch' },
    { q:'q7', lbl:'Q7 · Hassle',    domain:'ctx'  },
    { q:'q8', lbl:'Q8 · Frequency', domain:'exec' },
  ];
  const domainColor = {
    arch: 'rgba(212,168,67,0.70)',
    exec: 'rgba(78,156,245,0.70)',
    ctx:  'rgba(46,201,138,0.70)',
  };
  const qBarsEl = document.getElementById('rap-qbars');
  if (qBarsEl) {
    qBarsEl.innerHTML = qMeta.map(({ q, lbl, domain }) => {
      const rate = qTotals[q] > 0 ? Math.round(qFails[q] / qTotals[q] * 100) : 0;
      const col  = domainColor[domain];
      return `<div class="rap-bar-row">
        <div class="rap-bar-q">${lbl}</div>
        <div class="rap-bar-track"><div class="rap-bar-fill" style="width:${rate}%;background:${col};"></div></div>
        <div class="rap-bar-pct">${rate}%</div>
      </div>`;
    }).join('');
  }

  // ── Longitudinal section ─────────────────────────────────────────────
  const longSection = document.getElementById('rap-long-section');
  const longPts = patients.filter(p => p.mmas && p.mmas.length >= 2);
  if (longPts.length >= 2 && longSection) {
    longSection.style.display = '';
    const totalVis = longPts.reduce((s, p) => s + p.mmas.length, 0);
    const avgVis   = (totalVis / longPts.length).toFixed(1);
    let sumDelta = 0, nImp = 0, nStab = 0, nDec = 0;
    longPts.forEach(p => {
      const sorted = [...p.mmas].sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
      const delta  = sorted[sorted.length-1].score - sorted[0].score;
      sumDelta += delta;
      if (delta > 0.5) nImp++;
      else if (delta < -0.5) nDec++;
      else nStab++;
    });
    const meanDelta = (sumDelta / longPts.length).toFixed(2);
    const dSign     = parseFloat(meanDelta) > 0 ? '+' : '';
    set('rap-long-pts',    longPts.length);
    set('rap-long-avgvis', avgVis);
    set('rap-long-delta',  dSign + meanDelta);
    set('rap-long-imp',    nImp);
    set('rap-long-stab',   nStab);
    set('rap-long-dec',    nDec);
    const dEl = document.getElementById('rap-long-delta');
    if (dEl) dEl.style.color = parseFloat(meanDelta) > 0.1 ? '#10b981'
      : parseFloat(meanDelta) < -0.1 ? '#ef4444' : 'var(--muted)';
  } else if (longSection) {
    longSection.style.display = 'none';
  }

  // ── Timestamp ────────────────────────────────────────────────────────
  const updEl = document.getElementById('rap-updated');
  if (updEl) updEl.textContent = (_t.status_updated || 'Updated') + ' ' + new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

  // ── Clinical Profile — runs for all tiers ─────────────────────────────
  _renderClinicalProfile(patients);

  // ── Subgroup Analysis + Publication Stats — researcher/PI only ────────────
  const _rapSub = document.getElementById('rap-subgroup-section');
  if (_rapSub && _rapSub.style.display !== 'none') _renderSubgroupAnalysis(patients);
  const _rapPub = document.getElementById('rap-pubstats-section');
  if (_rapPub && _rapPub.style.display !== 'none') _renderPubStats(patients, scores, mean, sd, ci95, n);
  const _rapPsych = document.getElementById('rap-psych-section');
  if (_rapPsych && _rapPsych.style.display !== 'none') _renderPsychometrics(patients);

  // ── MAP PE Domain cohort aggregate (researcher only) ──────────────────────
  const rapPeDomEl = document.getElementById('rap-pe-domain');
  const rapPeBody  = document.getElementById('rap-pe-body');
  if (!rapPeDomEl || rapPeDomEl.style.display === 'none' || !rapPeBody) return;

  let nPE = 0, sumA = 0, sumE = 0, sumC = 0, nDomA = 0, nDomE = 0, nDomC = 0;
  mapRecs.forEach(r => {
    const a = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const e = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const c = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
    if (a === 0 && e === 0) return;
    nPE++;
    sumA += a; sumE += e; sumC += c;
    // Dominant constraint = lowest domain score
    if (a <= e && a <= c)     nDomA++;
    else if (e <= a && e <= c) nDomE++;
    else                       nDomC++;
  });

  if (nPE > 0) {
    const avgA = (sumA / nPE).toFixed(2), avgE = (sumE / nPE).toFixed(2), avgC = (sumC / nPE).toFixed(2);
    const pctA = Math.round(nDomA / nPE * 100), pctE = Math.round(nDomE / nPE * 100), pctC = Math.round(nDomC / nPE * 100);
    const domains = [
      { key:'a', label:'Architecture', sub:'Belief · motivation · intent',   avg:avgA, pct:pctA, col:'rgba(212,168,67,0.75)' },
      { key:'e', label:'Execution',    sub:'Routine · forgetfulness · habit', avg:avgE, pct:pctE, col:'rgba(78,156,245,0.75)'  },
      { key:'c', label:'Context',      sub:'Environment · access · cost',     avg:avgC, pct:pctC, col:'rgba(46,201,138,0.75)'  },
    ];
    rapPeBody.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">
        ${domains.map(d => `
          <div style="background:var(--card2);border:1px solid var(--border);border-top:2px solid ${d.col};border-radius:8px;padding:14px 12px;">
            <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:${d.col};margin-bottom:3px;">${d.label}</div>
            <div style="font-size:0.70rem;color:var(--muted);margin-bottom:10px;line-height:1.4;">${d.sub}</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.7rem;font-weight:300;color:var(--bright);line-height:1;">${d.avg}</div>
            <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:4px;">avg domain score</div>
            <div style="margin-top:10px;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${d.pct}%;background:${d.col};border-radius:2px;transition:width 0.7s ease;"></div>
            </div>
            <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--muted);margin-top:4px;">${d.pct}% dominant constraint</div>
          </div>`).join('')}
      </div>
      <div style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);">Based on ${nPE} MAP records · dominant constraint = lowest domain score</div>`;
  } else {
    rapPeBody.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:8px 0;">' + (_t.empty_no_map_pe || 'No MAP PE Domain data in this cohort yet \u2014 run Track A \u00b7 MAP sessions to populate.') + '</div>';
  }
}

// ── Researcher: Subgroup Analysis by Condition ───────────────────────────────
function _renderSubgroupAnalysis(patients) {
  const subEl = document.getElementById('rap-subgroup-section');
  const bodyEl = document.getElementById('rap-subgroup-body');
  if (!subEl || subEl.style.display === 'none' || !bodyEl) return;

  // Gather MMAS records grouped by condition
  const byCondition = {};
  patients.forEach(p => {
    if (!p.mmas || !p.mmas.length) return;
    p.mmas.forEach(r => {
      const cond = (r.condition || 'Unknown').toString().trim();
      if (!cond || cond.length < 2) return;
      if (!byCondition[cond]) byCondition[cond] = { n:0, sumScore:0, nINA:0, nHigh:0, nWithPeacs:0 };
      byCondition[cond].n++;
      const _sc = _recomputeMMASScore(r);
      byCondition[cond].sumScore += _sc;
      if (_sc < 6) byCondition[cond].nINA++;
      if (_sc >= 8) byCondition[cond].nHigh++;
    });
    // PEACS coverage per condition — check patient's latest MMAS condition vs PEACS presence
    const latest = p.mmas.length ? [...p.mmas].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))[0] : null;
    if (latest && p.peacs && p.peacs.length) {
      const cond = (latest.condition || 'Unknown').trim();
      if (byCondition[cond]) byCondition[cond].nWithPeacs++;
    }
  });

  const sorted = Object.entries(byCondition)
    .filter(([,d]) => d.n >= 2)
    .sort((a,b) => b[1].n - a[1].n)
    .slice(0, 12);

  if (!sorted.length) {
    bodyEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">Condition data not available — ensure condition field is populated during assessment.</div>';
    return;
  }

  const rows = sorted.map(([cond, d]) => {
    const mean = (d.sumScore / d.n).toFixed(2);
    const inaP = Math.round(d.nINA / d.n * 100);
    const hiP  = Math.round(d.nHigh / d.n * 100);
    const peaP = Math.round(d.nWithPeacs / d.n * 100);
    const inaCol = inaP >= 50 ? 'var(--poor)' : inaP >= 30 ? 'var(--moderate)' : 'var(--optimal)';
    return `<tr>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.78rem;color:var(--text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${cond}">${cond}</td>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.80rem;text-align:right;color:var(--muted);">${d.n}</td>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.80rem;text-align:right;color:var(--text);">${mean}</td>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.78rem;text-align:right;color:${inaCol};font-weight:600;">${inaP}%</td>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.78rem;text-align:right;color:var(--optimal);">${hiP}%</td>
      <td style="padding:5px 8px;font-family:var(--font-mono);font-size:0.78rem;text-align:right;color:var(--mvmt);">${peaP}%</td>
    </tr>`;
  }).join('');

  bodyEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
    <thead><tr style="border-bottom:1px solid var(--border);">
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);padding:6px 8px;text-align:left;">Condition</th>
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);padding:6px 8px;text-align:right;">n</th>
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--base);padding:6px 8px;text-align:right;">Mean MMAS-8</th>
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--poor);padding:6px 8px;text-align:right;">INA %</th>
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--optimal);padding:6px 8px;text-align:right;">High %</th>
      <th style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mvmt);padding:6px 8px;text-align:right;">PEACS Cov.</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Researcher: Publication-Ready Statistics ─────────────────────────────────
window._rapPubStatsText = '';
function _renderPubStats(patients, scores, mean, sd, ci95, n) {
  const el = document.getElementById('rap-pubstats-section');
  const body = document.getElementById('rap-pubstats-body');
  if (!el || el.style.display === 'none' || !body) return;
  if (!scores || !scores.length) return;

  const f2 = v => isFinite(v) ? v.toFixed(2) : '—';
  const f3 = v => isFinite(v) ? v.toFixed(3) : '—';
  const median = (() => {
    const s = [...scores].sort((a,b)=>a-b);
    return s.length % 2 === 0 ? (s[s.length/2-1]+s[s.length/2])/2 : s[Math.floor(s.length/2)];
  })();
  const nHigh = scores.filter(s=>s>=8).length;
  const nMed  = scores.filter(s=>s>=6&&s<8).length;
  const nLow  = scores.filter(s=>s<6).length;
  const pct   = v => n ? Math.round(v/n*100) : 0;

  const apa = `M = ${f2(mean)}, SD = ${f2(sd)}, 95% CI [${f2(mean-ci95)}, ${f2(mean+ci95)}], n = ${n}`;
  const van = `${f2(mean)} ± ${f2(sd)} (95% CI: ${f2(mean-ci95)}–${f2(mean+ci95)}; n = ${n})`;
  const distLine = `High adherence: ${nHigh} (${pct(nHigh)}%); Medium: ${nMed} (${pct(nMed)}%); Low: ${nLow} (${pct(nLow)}%)`;
  window._rapPubStatsText = `MMAS-8 Results\n${apa}\nMedian: ${f2(median)}\n${distLine}`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:12px 14px;">
        <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">APA 7th Format</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text);line-height:1.6;">${apa}</div>
      </div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:12px 14px;">
        <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Vancouver / ICMJE Format</div>
        <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text);line-height:1.6;">${van}</div>
      </div>
    </div>
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:12px 14px;">
      <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Adherence Classification (n = ${n})</div>
      <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--muted);line-height:1.7;">${distLine}</div>
      <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--muted);">Median: ${f2(median)} · Range: ${f2(Math.min(...scores))}–${f2(Math.max(...scores))}</div>
    </div>`;
}
function _rapCopyPubStats() {
  if (window._rapPubStatsText) {
    navigator.clipboard.writeText(window._rapPubStatsText).then(() => showToast('Copied to clipboard', 2000));
  }
}

// ══════════════════════════════════════════════
// PSYCHOMETRICS & RELIABILITY MODULE
// Cronbach's α · McDonald's ω · Item-Total Correlations
// Inter-Item Matrix · ICC Test-Retest · SEM
// Researcher/PI tier — gated via _resUpdateAnalytics()
// ATLAS v8.5.0
// ══════════════════════════════════════════════

// ── Item keys for MMAS-8 ─────────────────────────────────────────────────────
const PSYCH_ITEMS = ['q1','q2','q3','q4','q5','q6','q7','q8'];

// Item labels for display
const PSYCH_ITEM_LABELS = {
  q1: 'Q1 · Forgot',
  q2: 'Q2 · Reasons',
  q3: 'Q3 · Stopped',
  q4: 'Q4 · Travel',
  q5: 'Q5 · Yesterday',
  q6: 'Q6 · Control',
  q7: 'Q7 · Hassle',
  q8: 'Q8 · Frequency',
};

// ── _buildMmasMatrix ──────────────────────────────────────────────────────────
// Extracts a numeric item matrix from the patient array.
// Each patient contributes their LATEST MMAS record if all 8 items are present.
// Returns { matrix: number[][], n: number }
function _buildMmasMatrix(patients) {
  const matrix = [];

  patients.forEach(function(p) {
    if (!p.mmas || !p.mmas.length) return;
    const sorted = [...p.mmas].sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    const rec = sorted[0];

    // Resolve q8 — stored as numeric fraction or frequency text
    const q8raw = rec.q8;
    let q8val;
    if (typeof q8raw === 'number') {
      const q8IndexMap = { 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0 };
      q8val = q8IndexMap[q8raw] !== undefined ? q8IndexMap[q8raw] : null;
    } else {
      const q8map = { never: 1, rarely: 0.75, 'once in a while': 0.75, sometimes: 0.5, often: 0.25, usually: 0.25, always: 0, 'all the time': 0 };
      q8val = q8map[String(q8raw || '').toLowerCase().trim()];
      if (q8val === undefined) q8val = null;
    }

    // Validate all items present
    const row = [
      rec.q1, rec.q2, rec.q3, rec.q4,
      rec.q5, rec.q6, rec.q7, q8val,
    ];
    if (row.some(function(v) { return v === undefined || v === null || !isFinite(v); })) return;

    matrix.push(row.map(Number));
  });

  return { matrix: matrix, n: matrix.length };
}

// ── _pearsonR ─────────────────────────────────────────────────────────────────
function _pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return NaN;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const mX = sumX / n, mY = sumY / n;

  let cov = 0, ssX = 0, ssY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mX, dy = ys[i] - mY;
    cov += dx * dy;
    ssX += dx * dx;
    ssY += dy * dy;
  }

  const denom = Math.sqrt(ssX * ssY);
  return denom === 0 ? NaN : cov / denom;
}

// ── _cronbachAlpha ────────────────────────────────────────────────────────────
function _cronbachAlpha(matrix) {
  const n = matrix.length;
  if (n < 2) return NaN;
  const k = matrix[0].length;
  if (k < 2) return NaN;

  let sumItemVar = 0;
  for (let j = 0; j < k; j++) {
    const col = matrix.map(function(row) { return row[j]; });
    const mean = col.reduce(function(s, v) { return s + v; }, 0) / n;
    const variance = col.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / (n - 1);
    sumItemVar += variance;
  }

  const totals = matrix.map(function(row) { return row.reduce(function(s, v) { return s + v; }, 0); });
  const tMean  = totals.reduce(function(s, v) { return s + v; }, 0) / n;
  const tVar   = totals.reduce(function(s, v) { return s + (v - tMean) * (v - tMean); }, 0) / (n - 1);

  if (tVar === 0) return NaN;
  return (k / (k - 1)) * (1 - sumItemVar / tVar);
}

// ── _alphaIfDeleted ───────────────────────────────────────────────────────────
function _alphaIfDeleted(matrix) {
  return PSYCH_ITEMS.map(function(_, j) {
    const reduced = matrix.map(function(row) { return row.filter(function(_, col) { return col !== j; }); });
    return _cronbachAlpha(reduced);
  });
}

// ── _correctedItemTotal ───────────────────────────────────────────────────────
function _correctedItemTotal(matrix) {
  const k = matrix[0].length;
  return PSYCH_ITEMS.map(function(_, j) {
    const itemScores = matrix.map(function(row) { return row[j]; });
    const restScores = matrix.map(function(row) {
      let s = 0;
      for (let col = 0; col < k; col++) { if (col !== j) s += row[col]; }
      return s;
    });
    return _pearsonR(itemScores, restScores);
  });
}

// ── _interItemMatrix ──────────────────────────────────────────────────────────
function _interItemMatrix(matrix) {
  const k = matrix[0].length;
  const cols = Array.from({ length: k }, function(_, j) { return matrix.map(function(row) { return row[j]; }); });
  return cols.map(function(colI, i) {
    return cols.map(function(colJ, j) { return i === j ? 1 : _pearsonR(colI, colJ); });
  });
}

// ── _mcdonaldOmega ────────────────────────────────────────────────────────────
function _mcdonaldOmega(matrix) {
  const n = matrix.length;
  if (n < 3) return NaN;
  const k = matrix[0].length;
  if (k < 2) return NaN;

  const R = _interItemMatrix(matrix);

  let v = Array(k).fill(1 / Math.sqrt(k));
  for (let iter = 0; iter < 200; iter++) {
    const w = R.map(function(row) { return row.reduce(function(s, rij, j) { return s + rij * v[j]; }, 0); });
    const norm = Math.sqrt(w.reduce(function(s, x) { return s + x * x; }, 0));
    if (norm === 0) break;
    const vNew = w.map(function(x) { return x / norm; });
    const diff = vNew.reduce(function(s, x, i) { return s + Math.abs(x - v[i]); }, 0);
    v = vNew;
    if (diff < 1e-10) break;
  }

  const eigenval = v.reduce(function(s, vi, i) {
    return s + vi * R[i].reduce(function(ss, rij, j) { return ss + rij * v[j]; }, 0);
  }, 0);
  const loadings = v.map(function(vi) { return vi * Math.sqrt(Math.max(0, eigenval)); });

  const sumL  = loadings.reduce(function(s, l) { return s + l; }, 0);
  const uniquenesses = loadings.reduce(function(s, l) { return s + (1 - l * l); }, 0);

  const denom = sumL * sumL + uniquenesses;
  if (denom === 0) return NaN;
  return Math.min(1, Math.max(0, (sumL * sumL) / denom));
}

// ── _computeSEM ───────────────────────────────────────────────────────────────
function _computeSEM(matrix, alpha) {
  if (!isFinite(alpha) || alpha >= 1) return NaN;
  const n = matrix.length;
  if (n < 2) return NaN;

  const totals = matrix.map(function(row) { return row.reduce(function(s, v) { return s + v; }, 0); });
  const mean   = totals.reduce(function(s, v) { return s + v; }, 0) / n;
  const sd     = Math.sqrt(totals.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / (n - 1));

  return sd * Math.sqrt(1 - alpha);
}

// ── _normalQuantile (internal helper) ────────────────────────────────────────
function _normalQuantile(p) {
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z0 = t - num / den;
  return p < 0.5 ? -z0 : z0;
}

// ── _computeICC ───────────────────────────────────────────────────────────────
// ICC(2,1) two-way mixed, absolute agreement. Uses first two sorted visits per patient.
function _computeICC(patients) {
  const pairs = [];
  patients.forEach(function(p) {
    if (!p.mmas || p.mmas.length < 2) return;
    const sorted = [...p.mmas].sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    const s1 = sorted[0].score, s2 = sorted[1].score;
    if (s1 === undefined || s2 === undefined || !isFinite(s1) || !isFinite(s2)) return;
    pairs.push([+s1, +s2]);
  });

  const n = pairs.length;
  if (n < 3) return { icc: NaN, ci95lo: NaN, ci95hi: NaN, n: n };

  const k = 2;
  const grandMean = pairs.reduce(function(s, p) { return s + p[0] + p[1]; }, 0) / (n * k);
  const rowMeans  = pairs.map(function(p) { return (p[0] + p[1]) / k; });
  const col1Mean  = pairs.reduce(function(s, p) { return s + p[0]; }, 0) / n;
  const col2Mean  = pairs.reduce(function(s, p) { return s + p[1]; }, 0) / n;
  const colMeans  = [col1Mean, col2Mean];

  const SSb = k * rowMeans.reduce(function(s, rm) { return s + (rm - grandMean) * (rm - grandMean); }, 0);
  const SSr = n * colMeans.reduce(function(s, cm) { return s + (cm - grandMean) * (cm - grandMean); }, 0);
  const SSt = pairs.reduce(function(s, p) { return s + (p[0] - grandMean) * (p[0] - grandMean) + (p[1] - grandMean) * (p[1] - grandMean); }, 0);
  const SSe = SSt - SSb - SSr;

  const dfb = n - 1;
  const dfr = k - 1;
  const dfe = (n - 1) * (k - 1);

  const MSb = SSb / dfb;
  const MSr = SSr / dfr;
  const MSe = dfe > 0 ? SSe / dfe : 0;

  const iccNum = MSb - MSe;
  const iccDen = MSb + (k - 1) * MSe + (k / n) * (MSr - MSe);
  const icc = iccDen === 0 ? NaN : iccNum / iccDen;

  // 95% CI via Wilson-Hilferty chi² approximation
  function chiInvApprox(p, df) {
    const z = _normalQuantile(p);
    const h = 2 / (9 * df);
    return df * Math.pow(Math.max(0, 1 - h + z * Math.sqrt(h)), 3);
  }

  let ci95lo = NaN, ci95hi = NaN;
  if (isFinite(icc) && MSe > 0) {
    const Fobs = MSb / MSe;
    if (isFinite(Fobs) && dfb > 0 && dfe > 0) {
      const chiU_dfb = chiInvApprox(0.975, dfb);
      const chiL_dfb = chiInvApprox(0.025, dfb);
      const chiU_dfe = chiInvApprox(0.975, dfe);
      const chiL_dfe = chiInvApprox(0.025, dfe);

      const Flo = (chiU_dfe > 0) ? (Fobs * dfe / chiU_dfe) * (chiL_dfb / dfb) : NaN;
      const Fhi = (chiL_dfe > 0) ? (Fobs * dfe / chiL_dfe) * (chiU_dfb / dfb) : NaN;

      ci95lo = isFinite(Flo) ? Math.max(-1, Math.min(1, (Flo - 1) / (Flo + k - 1))) : NaN;
      ci95hi = isFinite(Fhi) ? Math.max(-1, Math.min(1, (Fhi - 1) / (Fhi + k - 1))) : NaN;
    }
  }

  return {
    icc:    isFinite(icc) ? Math.max(-1, Math.min(1, icc)) : NaN,
    ci95lo: ci95lo,
    ci95hi: ci95hi,
    n:      n,
  };
}

// ── _alphaInterpretation ──────────────────────────────────────────────────────
function _alphaInterpretation(alpha) {
  if (!isFinite(alpha)) return '—';
  if (alpha >= 0.90) return 'Excellent';
  if (alpha >= 0.80) return 'Good';
  if (alpha >= 0.70) return 'Acceptable';
  if (alpha >= 0.60) return 'Questionable';
  if (alpha >= 0.50) return 'Poor';
  return 'Unacceptable';
}

// ── _iccInterpretation ────────────────────────────────────────────────────────
function _iccInterpretation(icc) {
  if (!isFinite(icc)) return '—';
  if (icc < 0.50) return 'Poor';
  if (icc < 0.75) return 'Moderate';
  if (icc < 0.90) return 'Good';
  return 'Excellent';
}

// ── _renderPsychometrics ──────────────────────────────────────────────────────
function _renderPsychometrics(patients) {
  const section = document.getElementById('rap-psych-section');
  const emptyEl = document.getElementById('rap-psych-empty');
  if (!section) return;

  function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  const built  = _buildMmasMatrix(patients);
  const matrix = built.matrix;
  const n      = built.n;

  if (n < 3) {
    if (emptyEl) emptyEl.style.display = '';
    ['rap-psych-alpha-val','rap-psych-omega-val','rap-psych-sem-val','rap-psych-icc-val'].forEach(function(id) { set(id, '—'); });
    ['rap-psych-alpha-interp','rap-psych-icc-interp','rap-psych-icc-n','rap-psych-n','rap-psych-updated'].forEach(function(id) { set(id, '—'); });
    const ciEl = document.getElementById('rap-psych-icc-ci');
    if (ciEl) ciEl.textContent = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  const alpha   = _cronbachAlpha(matrix);
  const omega   = _mcdonaldOmega(matrix);
  const sem     = _computeSEM(matrix, alpha);
  const iccRes  = _computeICC(patients);
  const citcArr = _correctedItemTotal(matrix);
  const aidArr  = _alphaIfDeleted(matrix);
  const iimMat  = _interItemMatrix(matrix);

  function f3(v) { return isFinite(v) ? v.toFixed(3) : '—'; }

  set('rap-psych-n',           n);
  set('rap-psych-updated',     new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  set('rap-psych-alpha-val',   f3(alpha));
  set('rap-psych-alpha-interp', _alphaInterpretation(alpha));
  set('rap-psych-omega-val',   f3(omega));
  set('rap-psych-sem-val',     f3(sem));
  set('rap-psych-icc-val',     f3(iccRes.icc));
  set('rap-psych-icc-interp',  _iccInterpretation(iccRes.icc));
  set('rap-psych-icc-n',       iccRes.n > 0 ? iccRes.n : '—');

  const ciEl = document.getElementById('rap-psych-icc-ci');
  if (ciEl) {
    ciEl.textContent = (isFinite(iccRes.ci95lo) && isFinite(iccRes.ci95hi))
      ? '95% CI [' + f3(iccRes.ci95lo) + ', ' + f3(iccRes.ci95hi) + ']'
      : iccRes.n < 3 ? 'Need ≥3 repeat visits' : '';
  }

  window._psychLastResults = {
    n: n, alpha: alpha, omega: omega, sem: sem,
    icc: iccRes.icc, ci95lo: iccRes.ci95lo, ci95hi: iccRes.ci95hi, iccN: iccRes.n,
    citcArr: citcArr, aidArr: aidArr, iimMat: iimMat,
  };

  _renderPsychometricsUI(citcArr, aidArr, iimMat, alpha);

  // Validation evidence form — populate from sessionStorage once per session
  if (!window._veInitialized) { _veInit(); window._veInitialized = true; }
}

// ── _renderPsychometricsUI ────────────────────────────────────────────────────
function _renderPsychometricsUI(citcArr, aidArr, iimMat, globalAlpha) {
  const itcEl = document.getElementById('rap-psych-itc-bars');
  const aidEl = document.getElementById('rap-psych-aid-bars');
  const iimEl = document.getElementById('rap-psych-iim-body');

  // A. Item-Total Correlation bars
  if (itcEl) {
    itcEl.innerHTML = PSYCH_ITEMS.map(function(q, i) {
      const r   = citcArr[i];
      const rV  = isFinite(r) ? r : 0;
      const pct = Math.max(0, Math.min(100, Math.round(Math.abs(rV) * 100)));
      const lbl = PSYCH_ITEM_LABELS[q];
      const col = rV >= 0.50 ? 'rgba(46,201,138,0.75)'
                : rV >= 0.30 ? 'rgba(78,156,245,0.75)'
                :              'rgba(239,68,68,0.75)';
      return '<div class="rap-bar-row">' +
        '<div class="rap-bar-q">' + lbl + '</div>' +
        '<div class="rap-bar-track"><div class="rap-bar-fill" style="width:' + pct + '%;background:' + col + ';"></div></div>' +
        '<div class="rap-bar-pct">' + (isFinite(r) ? r.toFixed(2) : '—') + '</div>' +
      '</div>';
    }).join('');
  }

  // B. Alpha-if-Deleted bars
  if (aidEl) {
    const validAid = aidArr.filter(isFinite);
    const minAid   = validAid.length ? Math.min.apply(null, validAid) : 0;
    const maxAid   = validAid.length ? Math.max.apply(null, validAid) : 1;
    const range    = (maxAid - minAid) || 0.01;

    aidEl.innerHTML = PSYCH_ITEMS.map(function(q, i) {
      const a   = aidArr[i];
      const lbl = PSYCH_ITEM_LABELS[q];
      const pct = isFinite(a) ? Math.round(((a - minAid) / range) * 100) : 0;
      const improves = isFinite(a) && isFinite(globalAlpha) && a > globalAlpha + 0.005;
      const col = improves ? 'rgba(239,68,68,0.70)' : 'rgba(78,156,245,0.55)';
      const suffix = improves ? ' ↑' : '';
      return '<div class="rap-bar-row">' +
        '<div class="rap-bar-q">' + lbl + '</div>' +
        '<div class="rap-bar-track"><div class="rap-bar-fill" style="width:' + pct + '%;background:' + col + ';"></div></div>' +
        '<div class="rap-bar-pct">' + (isFinite(a) ? a.toFixed(3) + suffix : '—') + '</div>' +
      '</div>';
    }).join('');
  }

  // C. Inter-Item Correlation Matrix
  if (iimEl && iimMat && iimMat.length) {
    const k = iimMat.length;
    const shortLabels = PSYCH_ITEMS.map(function(q) { return q.toUpperCase(); });

    function cellBg(r, i, j) {
      if (i === j) return 'rgba(255,255,255,0.04)';
      if (!isFinite(r)) return 'transparent';
      const abs = Math.abs(r);
      if (abs >= 0.70) return r > 0 ? 'rgba(46,201,138,0.20)' : 'rgba(239,68,68,0.20)';
      if (abs >= 0.50) return r > 0 ? 'rgba(46,201,138,0.12)' : 'rgba(239,68,68,0.12)';
      if (abs >= 0.30) return 'rgba(78,156,245,0.10)';
      return 'transparent';
    }

    const thS = 'font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim);padding:5px 8px;text-align:center;white-space:nowrap;';
    const tdS = 'font-family:var(--font-mono);font-size:0.72rem;padding:5px 8px;text-align:center;';

    let html = '<table style="border-collapse:collapse;width:100%;min-width:380px;"><thead><tr>';
    html += '<th style="' + thS + 'text-align:left;"></th>';
    shortLabels.forEach(function(l) { html += '<th style="' + thS + '">' + l + '</th>'; });
    html += '</tr></thead><tbody>';

    iimMat.forEach(function(row, i) {
      html += '<tr><td style="' + thS + 'text-align:left;color:var(--dim);">' + shortLabels[i] + '</td>';
      row.forEach(function(r, j) {
        const isDiag = i === j;
        const bg  = cellBg(r, i, j);
        const txt = isDiag ? '·' : (isFinite(r) ? r.toFixed(2) : '—');
        const col = isDiag ? 'var(--dim)' : (isFinite(r) && Math.abs(r) >= 0.50 ? 'var(--text)' : 'var(--muted)');
        html += '<td style="' + tdS + 'background:' + bg + ';color:' + col + ';">' + txt + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    iimEl.innerHTML = html;
  }
}

// ── _rapCopyPsychTable ────────────────────────────────────────────────────────
function _rapCopyPsychTable() {
  const res = window._psychLastResults;
  if (!res) {
    if (typeof showToast === 'function') showToast('No psychometric data to copy — run analysis first.', 3000);
    return;
  }

  function f3(v) { return isFinite(v) ? v.toFixed(3) : 'N/A'; }

  const lines = [];
  lines.push('MMAS-8 Psychometric Analysis — ATLAS v8.5');
  lines.push('═'.repeat(52));
  lines.push('N (complete item records):  ' + res.n);
  lines.push('');
  lines.push('RELIABILITY COEFFICIENTS');
  lines.push("  Cronbach's α:             " + f3(res.alpha) + '  (' + _alphaInterpretation(res.alpha) + ')');
  lines.push("  McDonald's ω (total):     " + f3(res.omega));
  lines.push('  SEM (score units):        ' + f3(res.sem));
  lines.push('  ICC(2,1) test-retest:     ' + f3(res.icc) + '  (' + _iccInterpretation(res.icc) + ')');
  if (isFinite(res.ci95lo) && isFinite(res.ci95hi)) {
    lines.push('  ICC 95% CI:               [' + f3(res.ci95lo) + ', ' + f3(res.ci95hi) + ']  n = ' + res.iccN + ' pairs');
  }
  lines.push('  ICC model: Two-way mixed, absolute agreement, ICC(2,1)');
  lines.push('');
  lines.push('ITEM ANALYSIS');
  lines.push('  Item               CITC      α-if-Deleted');
  lines.push('  ' + '─'.repeat(46));
  PSYCH_ITEMS.forEach(function(q, i) {
    const lbl  = (PSYCH_ITEM_LABELS[q] || q).padEnd(18);
    const citc = isFinite(res.citcArr[i]) ? res.citcArr[i].toFixed(3) : '  N/A';
    const aid  = isFinite(res.aidArr[i])  ? res.aidArr[i].toFixed(3)  : '  N/A';
    lines.push('  ' + lbl + '  ' + citc + '     ' + aid);
  });
  lines.push('');
  lines.push('INTER-ITEM CORRELATION MATRIX (Pearson r)');
  const hdrs = PSYCH_ITEMS.map(function(q) { return q.toUpperCase().padStart(7); }).join('');
  lines.push('         ' + hdrs);
  PSYCH_ITEMS.forEach(function(q, i) {
    const row = res.iimMat[i].map(function(r, j) {
      if (i === j) return '   ·   ';
      return isFinite(r) ? r.toFixed(3).padStart(7) : '   N/A ';
    }).join('');
    lines.push('  ' + q.toUpperCase().padEnd(5) + '  ' + row);
  });
  lines.push('');
  lines.push('Generated by ATLAS v8.5 — ' + new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }));

  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(function() {
    if (typeof showToast === 'function') showToast('Reliability table copied to clipboard', 2500);
  }).catch(function() {
    if (typeof showToast === 'function') showToast('Copy failed — check browser clipboard permissions', 3000);
  });
}

// ── Institution: Care Gap Monitor + Visit Frequency ──────────────────────────
function _renderInstCareGap(allMmas) {
  const gapBody  = document.getElementById('inst-care-gap-body');
  const freqBody = document.getElementById('inst-visit-freq-body');
  const badge    = document.getElementById('inst-care-gap-badge');
  if (!gapBody || !freqBody) return;

  // MMAS records only (no MAP), score < 6
  const mmasOnly = (allMmas || []).filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  if (!mmasOnly.length) {
    gapBody.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">No MMAS-8 records yet.</div>';
    freqBody.innerHTML = gapBody.innerHTML;
    return;
  }

  // Group by patient_number, find latest record
  const byPat = {};
  mmasOnly.forEach(r => {
    const pid = (r.patient_number || '').toString().toUpperCase() || 'ANON';
    if (!byPat[pid]) byPat[pid] = { records: [], lastTs: 0, lastScore: 0, lastCond: '—' };
    byPat[pid].records.push(r);
    if ((r.timestamp||0) > byPat[pid].lastTs) {
      byPat[pid].lastTs    = r.timestamp || 0;
      byPat[pid].lastScore = r.score || 0;
      byPat[pid].lastCond  = r.condition || '—';
    }
  });

  const now = Date.now();
  const MS30 = 30 * 24 * 60 * 60 * 1000;

  // Care gap: score < 6 AND last visit > 30 days ago
  const overdue = Object.entries(byPat)
    .filter(([,d]) => d.lastScore < 6 && (now - d.lastTs) > MS30)
    .map(([pid, d]) => ({ pid, score: d.lastScore, cond: d.lastCond, daysAgo: Math.floor((now - d.lastTs) / (24*60*60*1000)) }))
    .sort((a,b) => b.daysAgo - a.daysAgo)
    .slice(0, 8);

  if (badge) {
    badge.textContent = overdue.length + ' overdue';
    badge.style.display = overdue.length ? '' : 'none';
  }

  if (!overdue.length) {
    gapBody.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--optimal);">✓ No care gaps detected in current cohort.</div>';
  } else {
    gapBody.innerHTML = overdue.map(p => {
      const col = p.score <= 2 ? 'var(--poor)' : p.score <= 4 ? 'var(--moderate)' : '#f59e0b';
      const urgency = p.daysAgo > 90 ? 'color:var(--poor);font-weight:700' : p.daysAgo > 60 ? 'color:var(--moderate)' : 'color:var(--dim)';
      return `<div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text);">${p.pid}</span>
        <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.cond}</span>
        <span style="font-family:var(--font-mono);font-size:0.70rem;${urgency};">${p.daysAgo}d ago</span>
        <span style="font-family:var(--font-mono);font-size:1rem;font-weight:700;color:${col};">${p.score.toFixed(1)}</span>
      </div>`;
    }).join('') + (Object.keys(byPat).length > 8 ? `<div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-top:6px;">Showing 8 most overdue of ${overdue.length} total</div>` : '');
  }

  // Visit frequency: 1 visit, 2–3 visits, 4–9 visits, 10+ visits
  const freqBands = [
    { label: '1 visit',   min:1,  max:1,  col:'rgba(239,68,68,0.7)' },
    { label: '2–3 visits',min:2,  max:3,  col:'rgba(245,158,11,0.7)' },
    { label: '4–9 visits',min:4,  max:9,  col:'rgba(59,130,246,0.7)' },
    { label: '10+ visits',min:10, max:999,col:'rgba(16,185,129,0.7)' },
  ];
  const total = Object.keys(byPat).length;
  freqBody.innerHTML = freqBands.map(b => {
    const n = Object.values(byPat).filter(d => d.records.length >= b.min && d.records.length <= b.max).length;
    const pct = total ? Math.round(n/total*100) : 0;
    return `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
        <span style="font-family:var(--font-mono);font-size:0.76rem;color:${b.col};">${b.label}</span>
        <span style="font-family:var(--font-mono);font-size:0.76rem;color:var(--muted);">${n} patients · ${pct}%</span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${b.col};border-radius:3px;transition:width 0.6s;"></div>
      </div>
    </div>`;
  }).join('') + `<div style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);margin-top:8px;border-top:1px solid var(--border);padding-top:6px;">${total} unique patients tracked</div>`;
}

function _renderClinicalProfile(patients) {
  const panel = document.getElementById('rap-clinical-profile');
  if (!panel) return;

  // Collect all raw MMAS records from the patients object
  const allRecs = [];
  patients.forEach(p => { if (p.mmas) allRecs.push(...p.mmas); });
  if (!allRecs.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  // ── Helper: build a ranked bar-chart HTML from a frequency map ───────────
  function _rankBars(freq, limit, color) {
    const total = Object.values(freq).reduce((s, v) => s + v, 0);
    if (!total) return '<span style="color:var(--dim);font-size:0.80rem;font-style:italic;">No data recorded</span>';
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const maxV = sorted[0][1];
    return sorted.map(([label, count]) => {
      const pct  = Math.round(count / total * 100);
      const barW = Math.round(count / maxV * 100);
      return `<div style="margin-bottom:7px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
          <span style="font-size:0.78rem;color:var(--text);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${label}">${label}</span>
          <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);flex-shrink:0;margin-left:8px;">${count} · ${pct}%</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Conditions ───────────────────────────────────────────────────────────
  const condFreq = {};
  allRecs.forEach(r => {
    const raw = r.condition;
    if (!raw) return;
    const vals = Array.isArray(raw) ? raw : [raw];
    vals.forEach(v => { const k = String(v).trim(); if (k) condFreq[k] = (condFreq[k] || 0) + 1; });
  });
  const condEl = document.getElementById('rap-cp-conditions');
  if (condEl) condEl.innerHTML = _rankBars(condFreq, 6, 'rgba(78,156,245,0.65)');

  // ── Drug class / type ────────────────────────────────────────────────────
  const drugFreq = {};
  allRecs.forEach(r => {
    const v = r.drug_type || r.drugType || r.drug_name || r.drugName;
    if (!v) return;
    const k = String(v).trim();
    if (k) drugFreq[k] = (drugFreq[k] || 0) + 1;
  });
  const drugEl = document.getElementById('rap-cp-drugs');
  if (drugEl) drugEl.innerHTML = _rankBars(drugFreq, 6, 'rgba(139,111,245,0.65)');

  // ── Age range ────────────────────────────────────────────────────────────
  const ageOrder = ['Under 18','18–24','25–34','35–44','45–54','55–64','65–74','75+'];
  const ageFreq  = {};
  allRecs.forEach(r => { const v = r.age_range ? _normalizeAgeBand(r.age_range) : null; if (v && v !== 'Not specified') ageFreq[v] = (ageFreq[v] || 0) + 1; });
  // Sort by known age order, fallback alpha
  const ageSorted = Object.entries(ageFreq).sort((a, b) => {
    const ai = ageOrder.indexOf(a[0]), bi = ageOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const ageEl = document.getElementById('rap-cp-age');
  if (ageEl) {
    if (!ageSorted.length) {
      ageEl.innerHTML = '<span style="color:var(--dim);font-size:0.80rem;font-style:italic;">No data recorded</span>';
    } else {
      const ageTotal = ageSorted.reduce((s, [, v]) => s + v, 0);
      const ageMax   = ageSorted[0] ? Math.max(...ageSorted.map(([, v]) => v)) : 1;
      ageEl.innerHTML = ageSorted.map(([label, count]) => {
        const pct  = Math.round(count / ageTotal * 100);
        const barW = Math.round(count / ageMax * 100);
        return `<div style="margin-bottom:7px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
            <span style="font-size:0.78rem;color:var(--text);">${label}</span>
            <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">${count} · ${pct}%</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:rgba(212,168,67,0.60);border-radius:2px;transition:width 0.5s ease;"></div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── Education level ───────────────────────────────────────────────────────
  const eduOrder = [
    'No formal education','Primary school (Elementary)','Secondary school (High school)',
    'Some college','Associate degree',"Bachelor's degree","Master's degree",
    'Doctoral degree','Professional degree (MD, JD, PharmD)',
  ];
  const eduFreq = {};
  allRecs.forEach(r => {
    const v = r.education_level || r.education;
    if (v) eduFreq[v] = (eduFreq[v] || 0) + 1;
  });
  const eduSorted = Object.entries(eduFreq).sort((a, b) => {
    const ai = eduOrder.indexOf(a[0]), bi = eduOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const eduEl = document.getElementById('rap-cp-education');
  if (eduEl) {
    if (!eduSorted.length) {
      eduEl.innerHTML = '<span style="color:var(--dim);font-size:0.80rem;font-style:italic;">No data recorded</span>';
    } else {
      const eduTotal = eduSorted.reduce((s, [, v]) => s + v, 0);
      const eduMax   = Math.max(...eduSorted.map(([, v]) => v));
      eduEl.innerHTML = eduSorted.map(([label, count]) => {
        const pct  = Math.round(count / eduTotal * 100);
        const barW = Math.round(count / eduMax * 100);
        const short = label.length > 34 ? label.slice(0, 32) + '…' : label;
        return `<div style="margin-bottom:7px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
            <span style="font-size:0.78rem;color:var(--text);" title="${label}">${short}</span>
            <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">${count} · ${pct}%</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:rgba(46,201,138,0.60);border-radius:2px;transition:width 0.5s ease;"></div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── Gender ────────────────────────────────────────────────────────────────
  const genderFreq = {};
  allRecs.forEach(r => { const v = r.gender; if (v) genderFreq[v] = (genderFreq[v] || 0) + 1; });
  const genderEl = document.getElementById('rap-cp-gender');
  if (genderEl) {
    const gTotal = Object.values(genderFreq).reduce((s, v) => s + v, 0);
    if (!gTotal) {
      genderEl.innerHTML = '<span style="color:var(--dim);font-size:0.80rem;font-style:italic;">No data recorded</span>';
    } else {
      const gColors = { Male:'rgba(78,156,245,0.7)', Female:'rgba(139,111,245,0.7)', 'Non-binary':'rgba(46,201,138,0.7)', 'Prefer not to say':'rgba(255,255,255,0.2)' };
      genderEl.innerHTML = `<div style="display:flex;gap:16px;flex-wrap:wrap;">` +
        Object.entries(genderFreq).sort((a,b) => b[1]-a[1]).map(([label, count]) => {
          const pct = Math.round(count / gTotal * 100);
          const col = gColors[label] || 'rgba(255,255,255,0.3)';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${col};line-height:1;">${pct}%</div>
            <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);">${label}</div>
            <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--muted);">n=${count}</div>
          </div>`;
        }).join('') + '</div>';
    }
  }
}

// ── Clinical Practice Overview — pharmacist / researcher tier ────────────────
// Computes today's encounters, monthly MTM CPT billing counts, estimated revenue,
// follow-up queue depth, INA/UNA intervention guidance cards, and PE domain
// practice priority with weakest-domain counseling insight.
// Called from _rppRebuild(). Only runs when cpo-panel is visible.
function _cpoUpdate() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const panel = document.getElementById('cpo-panel');
  if (!panel || panel.style.display === 'none') return;

  const patients = window._rppData || [];
  const mmasRecs = (typeof dashMmasData !== 'undefined') ? dashMmasData : [];
  const timed    = window._mtmManualEncounters || [];

  // ── Time helpers ─────────────────────────────────────────────────────────
  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yr = now.getFullYear(), mo = now.getMonth() + 1;
  const isThisMonth = ts => {
    const d = new Date(ts);
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  };
  const isToday = ts => new Date(ts).toISOString().split('T')[0] === todayStr;

  // ── Today's encounters ────────────────────────────────────────────────────
  const todayMmas  = mmasRecs.filter(r => r.timestamp && isToday(r.timestamp)).length;
  const todayTimed = timed.filter(e => e.timestamp && isToday(e.timestamp)).length;
  const todayCount = todayMmas + todayTimed;

  // ── Monthly CPT counts (walk the full history to assign 99605 vs 99606) ──
  const fullHist = {};
  let n99605 = 0, n99606 = 0, n99607 = 0;
  [...mmasRecs]
    .sort((a,b) => (a.timestamp||0) - (b.timestamp||0))
    .forEach(r => {
      const pid = r.patient_number || r.user_id || '';
      const cpt = mtmSuggestCPT(r, fullHist);
      fullHist[pid] = (fullHist[pid] || 0) + 1;
      if (!r.timestamp || !isThisMonth(r.timestamp)) return;
      if (cpt === '99605') n99605++;
      else if (cpt === '99606') n99606++;
      else if (cpt === '99607') n99607++;
    });
  timed.filter(e => e.timestamp && isThisMonth(e.timestamp)).forEach(e => {
    const c = (e.cpt_primary || '').toString();
    if (c.includes('99605')) n99605++;
    else if (c.includes('99606')) n99606++;
    else if (c.includes('99607')) n99607++;
  });

  // ── Estimated revenue (CMS 2024 national average pharmacist rates) ────────
  // 99605 ≈ $85 · 99606 ≈ $52 · 99607 ≈ $25
  const estRev = n99605 * 85 + n99606 * 52 + n99607 * 25;
  const fmtRev = estRev === 0 ? '—'
    : estRev >= 1000 ? '$' + (estRev / 1000).toFixed(1) + 'k'
    : '$' + estRev;

  // ── Follow-up due ─────────────────────────────────────────────────────────
  const cutoff = now.getTime() - 30 * 86400000; // 30 days
  let followupDue = 0;
  patients.forEach(p => {
    if (!p.mmas.length) return;
    const latest = [...p.mmas].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    if ((latest.score ?? 8) < 6 && (latest.timestamp || 0) < cutoff) followupDue++;
  });

  // ── Populate snapshot strip ───────────────────────────────────────────────
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('cpo-today',        todayCount);
  setText('cpo-99605',        n99605);
  setText('cpo-99606',        n99606);
  setText('cpo-99607',        n99607);
  setText('cpo-followup-due', followupDue);
  setText('cpo-rev',          fmtRev);

  // Color follow-up cell red if >0
  const fuEl = document.getElementById('cpo-followup-due');
  if (fuEl) fuEl.style.color = followupDue > 0 ? '#ef4444' : 'var(--strata)';

  // ── INA / UNA intervention guidance cards ────────────────────────────────
  let nINA = 0, nUNA = 0, nMixed = 0, nPatTotal = 0;
  patients.forEach(p => {
    if (!p.mmas.length) return;
    nPatTotal++;
    const latest = [...p.mmas].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    if ((latest.score ?? 0) >= 8) return;
    try {
      const _isMap = latest.tool === 'map' || latest.map_q1 !== undefined;
      const _hasItems = _isMap ? (latest.map_q1 !== undefined) : (latest.q1 !== undefined);
      if (!_hasItems) return;
      const { intentional, unintentional } = _isMap ? classifyMapPattern(latest) : classifyPattern(latest);
      if (intentional > unintentional) nINA++;
      else if (unintentional > intentional) nUNA++;
      else if (intentional || unintentional) nMixed++;
    } catch(e) {}
  });

  const pct = n => nPatTotal ? Math.round(n / nPatTotal * 100) : 0;
  const patternDefs = [
    {
      n: nINA, pct: pct(nINA), label: 'INA Pattern',
      color: '#8b6ff5', border: 'rgba(139,111,245,0.5)',
      icon: '⚡',
      action: 'Motivational interviewing — address medication beliefs, side-effect concerns, and provider communication barriers.',
    },
    {
      n: nUNA, pct: pct(nUNA), label: 'UNA Pattern',
      color: '#f59e0b', border: 'rgba(245,158,11,0.5)',
      icon: '🔧',
      action: 'Practical tools — reminders, pill organizer, simplified regimen. Patient is willing; behavioral structure is missing.',
    },
    {
      n: nMixed, pct: pct(nMixed), label: 'Mixed Pattern',
      color: 'var(--base)', border: 'rgba(78,156,245,0.5)',
      icon: '◈',
      action: 'Comprehensive MTM review — both intentional and unintentional barriers co-exist. Build trust before adding tools.',
    },
  ];

  const cardsEl = document.getElementById('cpo-pattern-cards');
  if (cardsEl) {
    cardsEl.innerHTML = patternDefs.map(p => `
      <div class="cpo-pat-card" style="border-top:2px solid ${p.border};">
        <div style="display:flex;align-items:baseline;gap:6px;">
          <div class="cpo-pat-val" style="color:${p.color};">${p.n}</div>
          <div class="cpo-pat-pct">${p.pct}%</div>
        </div>
        <div class="cpo-pat-lbl">${p.label}</div>
        <div class="cpo-pat-action">${p.icon} ${p.action}</div>
      </div>`).join('');
  }

  // ── PE Domain practice priority ───────────────────────────────────────────
  // Architecture (A) = mean(Q2,Q3,Q6); Execution (E) = mean(Q1,Q4,Q5,Q8); Context (C) = Q7
  let sumA = 0, sumE = 0, sumC = 0, nDomain = 0;
  patients.forEach(p => {
    p.mmas.forEach(r => {
      if (r.q1 === undefined || r.q2 === undefined || r.q7 === undefined) return;
      const q8n = typeof r.q8 === 'number'
        ? ({0:1,1:0.75,2:0.5,3:0.25,4:0}[r.q8] ?? null)
        : ({never:1,rarely:0.75,'once in a while':0.75,sometimes:0.5,often:0.25,usually:0.25,always:0,'all the time':0}[
            String(r.q8 || '').toLowerCase()
          ] ?? null);
      if (q8n === null) return;
      sumA += ((+(r.q2)||0) + (+(r.q3)||0) + (+(r.q6)||0)) / 3;
      sumE += ((+(r.q1)||0) + (+(r.q4)||0) + (+(r.q5)||0) + q8n) / 4;
      sumC += +(r.q7 || 0);
      nDomain++;
    });
  });

  const dbEl  = document.getElementById('cpo-domain-bars');
  const diEl  = document.getElementById('cpo-domain-insight');
  if (nDomain > 0 && dbEl) {
    const mA = sumA / nDomain, mE = sumE / nDomain, mC = sumC / nDomain;
    const domains = [
      { name:'Architecture', val:mA, color:'rgba(212,168,67,0.80)',  sub:'Beliefs & decisions (Q2,Q3,Q6)' },
      { name:'Execution',    val:mE, color:'rgba(78,156,245,0.80)',   sub:'Behavioral reliability (Q1,Q4,Q5,Q8)' },
      { name:'Context',      val:mC, color:'rgba(46,201,138,0.80)',   sub:'Medication burden (Q7)' },
    ];
    dbEl.innerHTML = domains.map(d => `
      <div class="cpo-domain-row">
        <div class="cpo-domain-lbl" style="color:${d.color};">${d.name}</div>
        <div class="cpo-domain-track"><div class="cpo-domain-fill" style="width:${Math.round(d.val*100)}%;background:${d.color};"></div></div>
        <div class="cpo-domain-val">${d.val.toFixed(2)}</div>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin:-2px 0 9px 78px;">${d.sub}</div>`).join('');

    const weakest = domains.reduce((a,b) => a.val < b.val ? a : b);
    const insights = {
      Architecture: `Focus on <strong style="color:rgba(212,168,67,0.9);">medication beliefs</strong> — patients cite doubt about necessity or fear side effects. Apply motivational interviewing to address the "why bother" barrier.`,
      Execution:    `Address <strong style="color:rgba(78,156,245,0.9);">behavioral consistency</strong> — patients are willing but lack structure. Recommend dose timers, pill organizers, or linking doses to daily anchor habits.`,
      Context:      `Reduce <strong style="color:rgba(46,201,138,0.9);">medication burden</strong> — hassle and inconvenience are driving lapse. Explore once-daily formulations, blister packs, or regimen simplification.`,
    };
    if (diEl) diEl.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:${weakest.color};">Priority · ${weakest.name}</span><br/>${insights[weakest.name] || ''}`;
  } else if (dbEl) {
    dbEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:4px 0;">Awaiting Q-item data for domain analysis.</div>';
  }

  // ── Timestamp ─────────────────────────────────────────────────────────────
  const updEl = document.getElementById('cpo-updated');
  if (updEl) updEl.textContent = (_t.status_updated || 'Updated') + ' ' + now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

function rppToggleDetail(idx) {
  const detail = document.getElementById(`rpp-detail-${idx}`);
  const row    = document.getElementById(`rpp-row-${idx}`);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'table-row';
  if (row) row.style.background = open ? '' : 'rgba(255,255,255,0.02)';
}

// ── Patient Panel CSV Export ──────────────────────────────────────────────
// Exports the currently visible (filtered) patient list as a flat CSV.
// One row per patient × assessment combination — MMAS and PEACS rows
// are interleaved chronologically per patient, labelled by instrument.
// Respects the active search filter so "what you see is what you export."
function rppExportCSV() {
  const rows = window._rppFiltered || [];
  if (!rows.length) { showToast('No patients to export.'); return; }

  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  // ── Header row ────────────────────────────────────────────────────────
  const headers = [
    'patient_id', 'workspace', 'instrument', 'assessment_date', 'timestamp_ms',
    // MMAS-8 fields
    'mmas_score', 'adherence_level', 'pattern', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
    // PEACS fields
    'pe_score', 'pe_zone', 'base', 'mvmt', 'strata',
    // Shared SDoH
    'condition', 'drug_name', 'drug_type', 'drug_strength', 'num_medications',
    'gender', 'age_range', 'education_level',
    'country', 'city',
    // Coverage summary (on first row per patient only)
    'mmas_visits', 'peacs_visits', 'coverage', 'last_activity_ts',
  ];

  const csvRows = [headers.map(k => getVarLabel(k)).join(',')];

  rows.forEach(p => {
    const mmasSorted  = [...p.mmas].sort((a, b) => (a.timestamp||0) - (b.timestamp||0));
    const peacsSorted = [...p.peacs].sort((a, b) => (a.timestamp||0) - (b.timestamp||0));
    const totalMmas   = p.mmas.length;
    const totalPeacs  = p.peacs.length;
    const coverage    = (totalMmas && totalPeacs) ? 'Both' : totalMmas ? 'MMAS only' : 'PEACS only';
    const lastTs      = p.lastTs || '';

    // Determine INA/UNA/Mixed/High pattern from latest MMAS
    const latestMmas = mmasSorted[mmasSorted.length - 1];
    let patternLabel = '';
    if (latestMmas) {
      const mmasScore = latestMmas.score || 0;
      if (mmasScore >= 8) {
        patternLabel = 'High';
      } else {
        try {
          const _isMap = latestMmas.tool === 'map' || latestMmas.map_q1 !== undefined;
          if (_isMap && latestMmas.map_q1 !== undefined) {
            const { intentional, unintentional } = classifyMapPattern(latestMmas);
            patternLabel = intentional > unintentional ? 'INA' : unintentional > intentional ? 'UNA' : 'Mixed';
          } else if (!_isMap && latestMmas.q1 !== undefined) {
            const { intentional, unintentional } = classifyPattern(latestMmas);
            patternLabel = intentional > unintentional ? 'INA' : unintentional > intentional ? 'UNA' : 'Mixed';
          }
        } catch(e) { patternLabel = ''; }
      }
    }

    // ── One row per MMAS assessment ───────────────────────────────────
    mmasSorted.forEach((r, i) => {
      const dt = r.timestamp ? new Date(r.timestamp).toISOString().split('T')[0] : '';
      const sc = r.score !== undefined ? r.score : '';
      const row = [
        esc(p.pid),
        esc(r.institution_code || ''),
        'MMAS-8',
        esc(dt),
        esc(r.timestamp || ''),
        // MMAS fields
        esc(sc !== '' ? Number(sc).toFixed(2) : ''),
        esc(r.adherence_level || ''),
        esc(i === mmasSorted.length - 1 ? patternLabel : ''), // pattern on latest row only
        esc(r.q1 !== undefined ? r.q1 : ''),
        esc(r.q2 !== undefined ? r.q2 : ''),
        esc(r.q3 !== undefined ? r.q3 : ''),
        esc(r.q4 !== undefined ? r.q4 : ''),
        esc(r.q5 !== undefined ? r.q5 : ''),
        esc(r.q6 !== undefined ? r.q6 : ''),
        esc(r.q7 !== undefined ? r.q7 : ''),
        esc(r.q8 !== undefined ? r.q8 : ''),
        // PEACS fields (blank for MMAS row)
        '', '', '', '', '',
        // SDoH
        esc(r.condition || ''),
        esc(r.drug_name || ''),
        esc(r.drug_type || ''),
        esc(r.drug_strength || ''),
        esc(r.num_medications || ''),
        esc(r.gender || ''),
        esc(r.age_range || ''),
        esc(r.education_level || ''),
        esc(r.country || ''),
        esc(r.city || ''),
        // Coverage summary on first row per patient only
        i === 0 ? esc(totalMmas) : '',
        i === 0 ? esc(totalPeacs) : '',
        i === 0 ? esc(coverage) : '',
        i === 0 ? esc(lastTs) : '',
      ];
      csvRows.push(row.join(','));
    });

    // ── One row per PEACS assessment ──────────────────────────────────
    peacsSorted.forEach((r, i) => {
      const dt  = r.timestamp ? new Date(r.timestamp).toISOString().split('T')[0] : '';
      const pe  = r.pe ?? r.pe_score ?? null;
      const zone = pe !== null
        ? (pe >= 0.85 ? 'Optimal' : pe >= 0.70 ? 'Good' : pe >= 0.55 ? 'Moderate' : pe >= 0.40 ? 'Poor' : 'Critical')
        : '';
      const row = [
        esc(p.pid),
        esc(r.institution_code || ''),
        'PEACS',
        esc(dt),
        esc(r.timestamp || ''),
        // MMAS fields (blank for PEACS row)
        '', '', '', '', '', '', '', '', '', '', '',
        // PEACS fields
        esc(pe !== null ? Number(pe).toFixed(4) : ''),
        esc(zone),
        esc(r.base !== undefined ? Number(r.base).toFixed(4) : ''),
        esc(r.mvmt !== undefined ? Number(r.mvmt).toFixed(4) : ''),
        esc(r.strata !== undefined ? Number(r.strata).toFixed(4) : ''),
        // SDoH
        esc(r.condition || ''),
        esc(r.drug_name || ''),
        esc(r.drug_type || ''),
        esc(r.drug_strength || ''),
        esc(r.num_medications || ''),
        esc(r.gender || ''),
        esc(r.age_range || ''),
        esc(r.education_level || ''),
        esc(r.country || ''),
        esc(r.city || ''),
        // Coverage summary blank (already written on MMAS first row, or write here if no MMAS)
        (totalMmas === 0 && i === 0) ? esc(totalMmas) : '',
        (totalMmas === 0 && i === 0) ? esc(totalPeacs) : '',
        (totalMmas === 0 && i === 0) ? esc(coverage) : '',
        (totalMmas === 0 && i === 0) ? esc(lastTs) : '',
      ];
      csvRows.push(row.join(','));
    });
  });

  // ── Build filename ────────────────────────────────────────────────────
  const ws    = (currentWorkspace || 'cohort').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const today = new Date().toISOString().split('T')[0];
  const q     = (document.getElementById('rpp-search')?.value || '').trim();
  const suffix = q ? `_filter_${q.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
  const filename = `atlas_patients_${ws}${suffix}_${today}.csv`;

  // ── Trigger download ──────────────────────────────────────────────────
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`✓ Exported ${rows.length} patient${rows.length !== 1 ? 's' : ''} — ${csvRows.length - 1} assessment rows.`, 3500);
}


// ══════════════════════════════════════════════
// VALIDATION EVIDENCE — PI-entered external data
// ══════════════════════════════════════════════

const _VE_KEY = 'atlas_validation_evidence';

function _veDefault() {
  return {
    criterion:   [{ measure:'', r:'', n:'', p:'' }],
    convergent:  [{ construct:'', direction:'positive', r:'', n:'' }],
    discriminant:[{ construct:'', direction:'negative', r:'', n:'' }],
    cfa: { cfi:'', rmsea:'', rmsea_lo:'', rmsea_hi:'', srmr:'', chi2_df:'', df:'' },
    sensitivity: { cohens_d:'', srm:'', n_pre:'', n_post:'', intervention:'' },
  };
}

function _veLoad() {
  try { return JSON.parse(sessionStorage.getItem(_VE_KEY)||'null') || _veDefault(); }
  catch(e) { return _veDefault(); }
}

function _veInputCss() {
  return 'font-family:var(--font-mono);font-size:0.70rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:4px;padding:4px 8px;color:var(--text);width:100%;box-sizing:border-box;';
}

function _veRemoveCss() {
  return 'font-family:var(--font-mono);font-size:0.62rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.7);border-radius:4px;cursor:pointer;padding:2px 6px;line-height:1;align-self:center;';
}

function _veMakeRow(type, entry) {
  const div = document.createElement('div');
  div.className = 've-'+type+'-row';
  const isCrit = type === 'crit';
  div.style.cssText = 'display:grid;grid-template-columns:'+(isCrit?'2fr 80px 70px 110px 28px':'2fr 110px 80px 70px 28px')+';gap:6px;margin-bottom:6px;align-items:center;';

  function inp(f, ph, inputType, extra) {
    return '<input type="'+(inputType||'text')+'" data-f="'+f+'" placeholder="'+(ph||'')+'" '+(extra||'')
      +' style="'+_veInputCss()+'">';
  }
  function sel(f, opts, val) {
    return '<select data-f="'+f+'" style="'+_veInputCss()+'">'
      + opts.map(function(o){ return '<option value="'+o+'"'+(o===val?' selected':'')+'>'+o+'</option>'; }).join('')
      + '</select>';
  }

  if (isCrit) {
    div.innerHTML = inp('measure','External measure name')
      + inp('r','r','number','min="-1" max="1" step="0.001"')
      + inp('n','n','number','min="1" step="1"')
      + sel('p',['< .001','< .01','< .05','ns'], entry.p||'< .05')
      + '<button onclick="this.parentElement.remove()" style="'+_veRemoveCss()+'">✕</button>';
  } else {
    const isDisc = type === 'disc';
    div.innerHTML = inp('construct','Construct / measure')
      + sel('direction',['positive','negative'], entry.direction||(isDisc?'negative':'positive'))
      + inp('r','r','number','min="-1" max="1" step="0.001"')
      + inp('n','n','number','min="1" step="1"')
      + '<button onclick="this.parentElement.remove()" style="'+_veRemoveCss()+'">✕</button>';
  }

  if (entry.measure) div.querySelector('[data-f="measure"]').value = entry.measure;
  if (entry.construct) div.querySelector('[data-f="construct"]').value = entry.construct;
  if (entry.r) div.querySelector('[data-f="r"]').value = entry.r;
  if (entry.n) div.querySelector('[data-f="n"]').value = entry.n;

  return div;
}

function _veAddRow(type) {
  const container = document.getElementById('ve-'+type+'-rows');
  if (!container) return;
  if (container.children.length >= 5) { if (typeof showToast==='function') showToast('Maximum 5 rows',2000); return; }
  const blank = type==='crit' ? _veDefault().criterion[0] : type==='conv' ? _veDefault().convergent[0] : _veDefault().discriminant[0];
  container.appendChild(_veMakeRow(type, blank));
}

function _vePopulate(d) {
  ['crit','conv','disc'].forEach(function(type) {
    const container = document.getElementById('ve-'+type+'-rows');
    if (!container) return;
    container.innerHTML = '';
    const entries = type==='crit' ? d.criterion : type==='conv' ? d.convergent : d.discriminant;
    (entries.length ? entries : [_veDefault()[type==='crit'?'criterion':type==='conv'?'convergent':'discriminant'][0]]).forEach(function(e) {
      container.appendChild(_veMakeRow(type, e));
    });
  });

  const cfaForm = document.getElementById('ve-cfa-form');
  if (cfaForm) Object.keys(d.cfa).forEach(function(k){ const el=cfaForm.querySelector('[data-f="'+k+'"]'); if(el&&d.cfa[k]) el.value=d.cfa[k]; });

  const sensForm = document.getElementById('ve-sens-form');
  if (sensForm) Object.keys(d.sensitivity).forEach(function(k){ const el=sensForm.querySelector('[data-f="'+k+'"]'); if(el&&d.sensitivity[k]) el.value=d.sensitivity[k]; });
}

function _veSave() {
  const d = _veDefault();

  function rowsOf(type) {
    return Array.from(document.querySelectorAll('.ve-'+type+'-row')).map(function(row) {
      const get = function(f){ const el=row.querySelector('[data-f="'+f+'"]'); return el?el.value:''; };
      return type==='crit'
        ? { measure:get('measure'), r:get('r'), n:get('n'), p:get('p') }
        : { construct:get('construct'), direction:get('direction'), r:get('r'), n:get('n') };
    });
  }
  d.criterion   = rowsOf('crit');
  d.convergent  = rowsOf('conv');
  d.discriminant= rowsOf('disc');

  const cfaForm = document.getElementById('ve-cfa-form');
  if (cfaForm) Object.keys(d.cfa).forEach(function(k){ const el=cfaForm.querySelector('[data-f="'+k+'"]'); if(el) d.cfa[k]=el.value; });

  const sensForm = document.getElementById('ve-sens-form');
  if (sensForm) Object.keys(d.sensitivity).forEach(function(k){ const el=sensForm.querySelector('[data-f="'+k+'"]'); if(el) d.sensitivity[k]=el.value; });

  sessionStorage.setItem(_VE_KEY, JSON.stringify(d));
  if (typeof showToast==='function') showToast('Validation evidence saved', 2000);
}

function _veInit() {
  _vePopulate(_veLoad());
}


// ══════════════════════════════════════════════════════════════════════════
// CLINICIAN WORKLIST — renderClinWorklist / updateClinKPIs / switchClinTab
// Fast-paced clinical surface: nurses, pharmacists, NPs, PAs, MDs.
// Data source: window._rppData (populated by _rppRebuild via rppBuild).
// Default instrument: MAP (PE 0–1). MMAS optional. PEACS = deep / settings.
// ══════════════════════════════════════════════════════════════════════════

/** @type {number} Current worklist page (0-based) */
window._clinWlPage     = 0;
/** @type {number} Rows per worklist page */
window._clinWlPageSize = 15;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the MAP records for a patient row */
function _clinMapRecs(p) {
  return (p.mmas || []).filter(r => r.tool === 'map' || r.map_q1 !== undefined);
}

/** Returns the MMAS-8 records for a patient row */
function _clinMmasRecs(p) {
  return (p.mmas || []).filter(r => r.tool !== 'map' && r.map_q1 === undefined);
}

/** Returns the primary records for a patient based on the selected instrument */
function _clinPrimaryRecs(p) {
  const inst = window._clinDefaultInstrument || 'map';
  if (inst === 'mmas') return _clinMmasRecs(p);
  if (inst === 'peacs') return p.peacs || [];
  return _clinMapRecs(p);
}

/** Latest record from an array sorted by timestamp descending */
function _clinLatest(recs) {
  if (!recs.length) return null;
  return [...recs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
}

/** Get numeric score for the latest primary record */
function _clinScore(p) {
  const inst = window._clinDefaultInstrument || 'map';
  const recs  = _clinPrimaryRecs(p);
  const latest = _clinLatest(recs);
  if (!latest) return null;
  if (inst === 'mmas') return _recomputeMMASScore(latest);
  if (inst === 'peacs') return latest.pe ?? latest.pe_score ?? null;
  return latest.score ?? null; // MAP PE 0-1
}

/** Score color + label for a given instrument + score */
function _clinScoreMeta(score) {
  const inst = window._clinDefaultInstrument || 'map';
  if (score === null) return { color: 'var(--dim)', label: '—' };
  if (inst === 'mmas') {
    if (score >= 8) return { color: '#10b981', label: 'High' };
    if (score >= 6) return { color: '#f59e0b', label: 'Medium' };
    return { color: '#ef4444', label: 'Low' };
  }
  // MAP or PEACS: PE 0-1
  if (score >= 0.85) return { color: '#10b981', label: 'Optimal' };
  if (score >= 0.70) return { color: '#3b82f6', label: 'Good' };
  if (score >= 0.55) return { color: '#f59e0b', label: 'Moderate' };
  if (score >= 0.40) return { color: '#ef4444', label: 'Poor' };
  return { color: '#991b1b', label: 'Critical' };
}

/** Returns true if patient is "at risk" based on instrument threshold */
function _clinAtRisk(score) {
  if (score === null) return false;
  const inst = window._clinDefaultInstrument || 'map';
  if (inst === 'mmas') return score < 6;
  return score < 0.55; // MAP/PEACS: Moderate or worse
}

/** Returns true if the patient has no assessment in ≥30 days AND is at risk */
function _clinOverdue(p) {
  const recs   = _clinPrimaryRecs(p);
  const latest = _clinLatest(recs);
  if (!latest) return false;
  const score   = _clinScore(p);
  const daysAgo = (Date.now() - (latest.timestamp || 0)) / 86400000;
  return _clinAtRisk(score) && daysAgo >= 30;
}

/** Returns the patient status: 'overdue'|'atrisk'|'stable'|'new' */
function _clinStatus(p) {
  const recs = _clinPrimaryRecs(p);
  if (!recs.length) return 'new';
  const score = _clinScore(p);
  if (_clinOverdue(p)) return 'overdue';
  if (_clinAtRisk(score)) return 'atrisk';
  return 'stable';
}

/** Format timestamp as compact relative or date string */
function _clinTimeAgo(ts) {
  if (!ts) return '—';
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60)     return 'Just now';
  if (d < 3600)   return Math.floor(d / 60) + 'm ago';
  if (d < 86400)  return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Build a tiny inline sparkline SVG for a series of numeric scores */
function _clinSparkline(scores, color) {
  if (scores.length < 2) return '';
  const W = 44, H = 14;
  const inst = window._clinDefaultInstrument || 'map';
  const max  = inst === 'mmas' ? 8 : 1;
  const pts  = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;flex-shrink:0;"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

// ── Triage status across all instruments (used for multi-instrument worklist) ─

/** Composite status across MAP, MMAS-8, and PEACS — worst-case wins */
function _clinCompositeStatus(p) {
  const mapRec  = _clinLatest(_clinMapRecs(p));
  const mmasRec = _clinLatest(_clinMmasRecs(p));
  const peacsRec = _clinLatest(p.peacs || []);

  const mapScore  = mapRec  ? (mapRec.score  ?? null) : null;
  const mmasScore = mmasRec ? _recomputeMMASScore(mmasRec) : null;
  const peScore   = peacsRec ? (peacsRec.pe ?? peacsRec.pe_score ?? null) : null;

  const anyRec = mapRec || mmasRec || peacsRec;
  if (!anyRec) return 'new';

  // Check overdue on any instrument (at-risk + ≥30d)
  const cutoff = Date.now() - 30 * 86400000;
  const mapOverdue  = mapScore  !== null && mapScore  < 0.55 && mapRec  && (mapRec.timestamp  || 0) < cutoff;
  const mmasOverdue = mmasScore !== null && mmasScore < 6    && mmasRec && (mmasRec.timestamp  || 0) < cutoff;
  const peOverdue   = peScore   !== null && peScore   < 0.55 && peacsRec && (peacsRec.timestamp || 0) < cutoff;
  if (mapOverdue || mmasOverdue || peOverdue) return 'overdue';

  const mapRisk  = mapScore  !== null && mapScore  < 0.55;
  const mmasRisk = mmasScore !== null && mmasScore < 6;
  const peRisk   = peScore   !== null && peScore   < 0.55;
  if (mapRisk || mmasRisk || peRisk) return 'atrisk';

  return 'stable';
}

/** Latest timestamp across all instruments */
function _clinLastSeenTs(p) {
  const ts = [
    _clinLatest(_clinMapRecs(p))?.timestamp,
    _clinLatest(_clinMmasRecs(p))?.timestamp,
    _clinLatest(p.peacs || [])?.timestamp,
  ].filter(Boolean);
  return ts.length ? Math.max(...ts) : 0;
}

// ── Core worklist render ─────────────────────────────────────────────────────

/**
 * Render the clinician triage worklist. Shows all three instruments per row.
 * Reads window._rppData (same source as researcher RPP).
 */
function renderClinWorklist() {
  const body       = document.getElementById('clin-worklist-body');
  const loadEl     = document.getElementById('clin-worklist-loading');
  const emptyEl    = document.getElementById('clin-worklist-empty');
  const pagerEl    = document.getElementById('clin-worklist-pager');
  const countEl    = document.getElementById('clin-worklist-count');
  const pageLblEl  = document.getElementById('clin-worklist-page-label');
  if (!body) return;

  // Keep care-gaps badge count current whenever worklist data refreshes
  (function _updateCareGapsBadge() {
    const data = window._rppData || [];
    const n = data.filter(p => { const s = _clinCompositeStatus(p); return s === 'overdue' || s === 'atrisk'; }).length;
    const badge = document.getElementById('clin-caregaps-badge');
    if (badge) { badge.textContent = n; badge.style.display = n ? 'inline' : 'none'; }
  })();

  if (loadEl) loadEl.style.display = 'none';

  const allPatients = window._rppData || [];

  // Show all patients that have any record at all
  let rows = allPatients.filter(p =>
    _clinMapRecs(p).length > 0 || _clinMmasRecs(p).length > 0 || (p.peacs || []).length > 0
  );

  // Search
  const q = ((document.getElementById('clin-search')?.value) || '').trim().toUpperCase();
  if (q) rows = rows.filter(p => p.pid.includes(q));

  // Status filter
  const filt = document.getElementById('clin-worklist-filter')?.value || 'all';
  if (filt !== 'all') {
    rows = rows.filter(p => {
      const st = _clinCompositeStatus(p);
      if (filt === 'atrisk')  return st === 'atrisk' || st === 'overdue';
      if (filt === 'overdue') return st === 'overdue';
      if (filt === 'stable')  return st === 'stable';
      return true;
    });
  }

  // Sort
  const sortVal = document.getElementById('clin-sort')?.value || 'status';
  rows.sort((a, b) => {
    if (sortVal === 'recent') {
      return _clinLastSeenTs(b) - _clinLastSeenTs(a);
    }
    if (sortVal === 'pid') {
      return a.pid.localeCompare(b.pid);
    }
    // Default: status — overdue → atrisk → stable → new
    const order = { overdue: 0, atrisk: 1, stable: 2, new: 3 };
    return (order[_clinCompositeStatus(a)] ?? 9) - (order[_clinCompositeStatus(b)] ?? 9);
  });

  const total     = rows.length;
  const pageSize  = window._clinWlPageSize;
  const page      = Math.min(window._clinWlPage, Math.max(0, Math.ceil(total / pageSize) - 1));
  window._clinWlPage = page;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const start      = page * pageSize;
  const pageRows   = rows.slice(start, start + pageSize);

  if (countEl) countEl.textContent = total + ' patient' + (total !== 1 ? 's' : '');

  if (!total) {
    body.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    if (pagerEl) pagerEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // Pager
  if (pagerEl) {
    pagerEl.style.display = totalPages > 1 ? 'flex' : 'none';
    if (pageLblEl) pageLblEl.textContent = 'Page ' + (page + 1) + ' of ' + totalPages;
  }

  body.innerHTML = pageRows.map(p => {
    const status = _clinCompositeStatus(p);
    const lastTs = _clinLastSeenTs(p);

    // MAP
    const mapRec   = _clinLatest(_clinMapRecs(p));
    const mapScore = mapRec ? (mapRec.score ?? null) : null;
    const mapMeta  = _clinScoreMeta(mapScore);
    const mapStr   = mapScore !== null ? mapScore.toFixed(3) : '—';
    const mapCount = _clinMapRecs(p).length;

    // MMAS-8
    const mmasRec   = _clinLatest(_clinMmasRecs(p));
    const mmasScore = mmasRec ? _recomputeMMASScore(mmasRec) : null;
    const mmasStr   = mmasScore !== null ? mmasScore.toFixed(1) : '—';
    const mmasCount = _clinMmasRecs(p).length;
    const mmasColor = mmasScore === null ? 'var(--dim)'
      : mmasScore >= 8 ? '#10b981' : mmasScore >= 6 ? '#f59e0b' : '#ef4444';

    // PEACS
    const peacsRec  = _clinLatest(p.peacs || []);
    const peScore   = peacsRec ? (peacsRec.pe ?? peacsRec.pe_score ?? null) : null;
    const peMeta    = _clinScoreMeta(peScore);
    const peStr     = peScore !== null ? peScore.toFixed(3) : '—';
    const peCount   = (p.peacs || []).length;

    // Status badge
    const statusBadge = {
      overdue: '<span style="font-family:var(--font-mono);font-size:0.64rem;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.30);">Overdue</span>',
      atrisk:  '<span style="font-family:var(--font-mono);font-size:0.64rem;padding:2px 8px;border-radius:20px;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.30);">At Risk</span>',
      stable:  '<span style="font-family:var(--font-mono);font-size:0.64rem;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,0.10);color:#10b981;border:1px solid rgba(16,185,129,0.28);">Stable</span>',
      new:     '<span style="font-family:var(--font-mono);font-size:0.64rem;padding:2px 8px;border-radius:20px;background:rgba(255,255,255,0.06);color:var(--dim);border:1px solid var(--border2);">New</span>',
    }[status] || '';

    const rowBg = status === 'overdue' ? 'rgba(245,158,11,0.03)'
                : status === 'atrisk'  ? 'rgba(239,68,68,0.03)'
                : '';

    // Score cell helper: show score + small count badge if any records
    const scorePill = (str, color, count, dim) =>
      count > 0
        ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;">
             <span style="font-family:var(--font-mono);font-size:0.88rem;font-weight:600;color:${color};">${str}</span>
             <span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--dim);">×${count}</span>
           </div>`
        : `<span style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">—</span>`;

    return `<div style="display:grid;grid-template-columns:minmax(110px,2fr) 90px 90px 90px 80px 100px 80px;gap:0;padding:10px 20px;border-bottom:1px solid var(--border);align-items:center;background:${rowBg};cursor:pointer;transition:background 0.12s;"
      onmouseover="this.style.background='rgba(255,255,255,0.03)'"
      onmouseout="this.style.background='${rowBg}'"
      onclick="openClinPatientBrief('${p.pid}')">
      <div style="display:flex;flex-direction:column;gap:2px;pointer-events:none;">
        <div style="font-family:var(--font-mono);font-size:0.84rem;font-weight:600;color:var(--text);">${p.pid}</div>
        <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);">${_clinTimeAgo(lastTs)}</div>
      </div>
      <div style="text-align:right;pointer-events:none;">${scorePill(mapStr, mapMeta.color, mapCount)}</div>
      <div style="text-align:right;pointer-events:none;">${scorePill(mmasStr, mmasColor, mmasCount)}</div>
      <div style="text-align:right;pointer-events:none;">${scorePill(peStr, peMeta.color, peCount)}</div>
      <div style="text-align:center;pointer-events:none;">${statusBadge}</div>
      <div style="pointer-events:none;"></div>
      <div style="text-align:right;" onclick="event.stopPropagation()">
        <button onclick="openClinPatientBrief('${p.pid}')" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.22);color:var(--base);border-radius:5px;padding:4px 10px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" onmouseover="this.style.background='rgba(78,156,245,0.18)'" onmouseout="this.style.background='rgba(78,156,245,0.08)'">Brief →</button>
      </div>
    </div>`;
  }).join('');

  // Also update KPIs and report with same data
  updateClinKPIs();
  updateClinReport();
}

// ── Pagination ───────────────────────────────────────────────────────────────

function clinWorklistPage(dir) {
  const allPatients = window._rppData || [];
  const rows        = allPatients.filter(p => _clinPrimaryRecs(p).length > 0);
  const total       = rows.length;
  const totalPages  = Math.ceil(total / window._clinWlPageSize) || 1;
  window._clinWlPage = Math.max(0, Math.min(window._clinWlPage + dir, totalPages - 1));
  renderClinWorklist();
}

// ── KPI strip ────────────────────────────────────────────────────────────────

function updateClinKPIs() {
  const allPatients = window._rppData || [];
  const patients = allPatients.filter(p =>
    _clinMapRecs(p).length > 0 || _clinMmasRecs(p).length > 0 || (p.peacs || []).length > 0
  );
  const total = patients.length;

  let mapScoreSum = 0, mapCount = 0, atRisk = 0, followupDue = 0;
  const cutoff = Date.now() - 30 * 86400000;

  patients.forEach(p => {
    const st = _clinCompositeStatus(p);
    if (st === 'atrisk' || st === 'overdue') atRisk++;
    if (st === 'overdue') followupDue++;
    const mapRec = _clinLatest(_clinMapRecs(p));
    if (mapRec) {
      const sc = mapRec.score ?? null;
      if (sc !== null) { mapScoreSum += sc; mapCount++; }
    }
  });

  const avgMap  = mapCount ? mapScoreSum / mapCount : null;
  const avgMeta = _clinScoreMeta(avgMap);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setColor = (id, c) => { const el = document.getElementById(id); if (el) el.style.color = c; };

  set('clin-kpi-total',     total || '—');
  set('clin-kpi-avg',       avgMap !== null ? avgMap.toFixed(3) : '—');
  set('clin-kpi-avg-label', 'MAP PE · 0–1');
  setColor('clin-kpi-avg', avgMeta.color);
  set('clin-kpi-sentinel',  atRisk || (total ? '0' : '—'));
  setColor('clin-kpi-sentinel', atRisk > 0 ? '#ef4444' : '#10b981');
  set('clin-kpi-followup',  followupDue || (total ? '0' : '—'));
  setColor('clin-kpi-followup', followupDue > 0 ? '#f59e0b' : 'var(--moderate)');

  const sentLbl = document.getElementById('clin-kpi-sentinel-label');
  if (sentLbl) sentLbl.textContent = 'across all instruments';
}

// ── My Report tab ────────────────────────────────────────────────────────────

function updateClinReport() {
  const allPatients = window._rppData || [];
  const patients = allPatients.filter(p =>
    _clinMapRecs(p).length > 0 || _clinMmasRecs(p).length > 0 || (p.peacs || []).length > 0
  );
  const total = patients.length;
  const inst  = window._clinDefaultInstrument || 'map';

  let totalAssessments = 0, nStable = 0, nAtRisk = 0;
  const distBuckets = {}; // label → count

  patients.forEach(p => {
    totalAssessments += _clinMapRecs(p).length + _clinMmasRecs(p).length + (p.peacs || []).length;
    const status = _clinCompositeStatus(p);
    if (status === 'stable') nStable++;
    else if (status === 'atrisk' || status === 'overdue') nAtRisk++;
    // Use MAP score for distribution if available, else MMAS
    const mapRec = _clinLatest(_clinMapRecs(p));
    const score  = mapRec ? (mapRec.score ?? null) : null;
    const meta   = _clinScoreMeta(score);
    if (meta.label !== '—') distBuckets[meta.label] = (distBuckets[meta.label] || 0) + 1;
  });

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('clin-rep-total',       total || '—');
  set('clin-rep-assessments', totalAssessments || '—');
  set('clin-rep-stable',      nStable || (total ? '0' : '—'));
  set('clin-rep-atrisk',      nAtRisk || (total ? '0' : '—'));

  const distEl = document.getElementById('clin-rep-dist');
  if (distEl) {
    if (!total) {
      distEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);">No data yet.</div>';
      return;
    }
    const bucketOrder = ['Optimal', 'Good', 'Moderate', 'Poor', 'Critical'];
    const bucketColors = {
      High: '#10b981', Medium: '#f59e0b', Low: '#ef4444',
      Optimal: '#10b981', Good: '#3b82f6', Moderate: '#f59e0b', Poor: '#ef4444', Critical: '#991b1b'
    };
    distEl.innerHTML = bucketOrder.map(label => {
      const count = distBuckets[label] || 0;
      const pct   = total ? Math.round((count / total) * 100) : 0;
      const color = bucketColors[label] || '#6b8099';
      return `<div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);">${label}</span>
          <span style="font-family:var(--font-mono);font-size:0.70rem;color:${color};">${count} <span style="color:var(--dim);">(${pct}%)</span></span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width 0.4s;"></div>
        </div>
      </div>`;
    }).join('');
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

function exportClinReport() {
  const patients = (window._rppData || []).filter(p => _clinPrimaryRecs(p).length > 0);
  const inst     = window._clinDefaultInstrument || 'map';
  const instLbl  = { map: 'MAP_PE', mmas: 'MMAS8', peacs: 'PEACS_PE' }[inst] || inst.toUpperCase();

  const headers = ['Patient_ID', 'Instrument', 'Latest_Score', 'Assessments', 'Status', 'Last_Visit_Days_Ago'];
  const rows    = patients.map(p => {
    const recs   = _clinPrimaryRecs(p);
    const score  = _clinScore(p);
    const latest = _clinLatest(recs);
    const daysAgo = latest ? Math.floor((Date.now() - (latest.timestamp || 0)) / 86400000) : '';
    return [
      p.pid,
      instLbl,
      score !== null ? (inst === 'mmas' ? score.toFixed(2) : score.toFixed(3)) : '',
      recs.length,
      _clinStatus(p),
      daysAgo,
    ].join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'clin_report_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Instrument selector ──────────────────────────────────────────────────────

function setClinDefaultInstrument(inst) {
  window._clinDefaultInstrument = inst;
  try { localStorage.setItem('clin_default_instrument', inst); } catch(e) {}

  // Update instrument button active state
  document.querySelectorAll('.clin-inst-btn').forEach(btn => {
    const active = btn.dataset.inst === inst;
    btn.style.background = active ? 'rgba(78,156,245,0.15)' : 'none';
    btn.style.color      = active ? 'var(--base)'           : 'var(--dim)';
  });

  // Show PEACS notice only when PEACS selected
  const peacsNotice = document.getElementById('clin-peacs-notice');
  if (peacsNotice) {
    peacsNotice.style.display = inst === 'peacs' ? 'flex' : 'none';
  }
}

// ── Tab switching ────────────────────────────────────────────────────────────

function switchClinTab(tab) {
  // Hide all content panes
  document.querySelectorAll('.clin-tab-content').forEach(el => el.style.display = 'none');
  // Deactivate all tab buttons
  document.querySelectorAll('.clin-tab').forEach(btn => {
    btn.style.borderBottomColor = 'transparent';
    btn.style.color = 'var(--dim)';
  });

  // Show selected pane
  const pane = document.getElementById('clin-tab-' + tab);
  if (pane) pane.style.display = '';

  // Activate selected button
  const activeBtn = document.querySelector('.clin-tab[data-clin-tab="' + tab + '"]');
  if (activeBtn) {
    activeBtn.style.borderBottomColor = 'var(--base)';
    activeBtn.style.color = 'var(--base)';
  }

  // Lazy-init tab contents
  if (tab === 'billing') {
    const mount = document.getElementById('clin-billing-mount');
    if (mount && !mount.dataset.loaded) {
      mount.dataset.loaded = '1';
      // Move the full billing panel (lives in inst-tab-panel-billing) into the clinician tab mount
      const billingPanel = document.getElementById('inst-tab-panel-billing');
      if (billingPanel) {
        billingPanel.style.display = '';
        mount.appendChild(billingPanel);
      }
      if (typeof initInstBillingTab === 'function') initInstBillingTab();
    }
  }
  if (tab === 'patients') {
    _renderClinAllPatients();
  }
  if (tab === 'report') {
    updateClinReport();
  }
  if (tab === 'caregaps') {
    renderClinCareGaps();
  }
  if (tab === 'sdoh') {
    renderClinSDoH();
  }
  if (tab === 'session') {
    _renderClinSessionResult();
  }
}

// ── Session Result ────────────────────────────────────────────────────────────
// Shows the most recently completed assessment for the last assessed patient.
// Called when switching to the Session tab after returning from an assessment.

function _renderClinSessionResult() {
  const mount = document.getElementById('clin-session-result-panel');
  if (!mount) return;

  const pid = window._sessionPatientId;
  if (!pid) return; // No session started yet — leave the "No active session" default

  const allPatients = window._rppData || [];
  const p = allPatients.find(function(r) { return r.pid === pid; });
  if (!p) {
    // Data may not have loaded yet — show a waiting state
    mount.innerHTML = '<div style="padding:32px 24px;text-align:center;">'
      + '<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">Loading results for ' + pid + '…</div></div>';
    return;
  }

  const _esc = function(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  const mapRecs  = _clinMapRecs(p);
  const mmasRecs = _clinMmasRecs(p);
  const peacsRecs = p.peacs || [];
  const mapRec   = _clinLatest(mapRecs);
  const mmasRec  = _clinLatest(mmasRecs);
  const peacsRec = _clinLatest(peacsRecs);

  const mapScore  = mapRec  ? (mapRec.score  ?? null) : null;
  const mapPE     = mapRec  ? (mapRec.pe_score ?? mapRec.score ?? null) : null;
  const arch      = mapRec  ? (mapRec.domain_arch ?? mapRec.pe_arch ?? mapRec.arch_score ?? null) : null;
  const exec      = mapRec  ? (mapRec.domain_exec ?? mapRec.pe_exec ?? mapRec.exec_score ?? null) : null;
  const ctx       = mapRec  ? (mapRec.domain_ctx  ?? mapRec.pe_ctx  ?? mapRec.ctx_score  ?? null) : null;
  const mmasScore = mmasRec ? _recomputeMMASScore(mmasRec) : null;
  const peScore   = peacsRec ? (peacsRec.pe ?? peacsRec.pe_score ?? null) : null;

  const mapMeta  = _clinScoreMeta(mapPE);
  const peMeta   = _clinScoreMeta(peScore);
  const mmasColor = mmasScore === null ? 'var(--dim)' : mmasScore >= 8 ? '#10b981' : mmasScore >= 6 ? '#f59e0b' : '#ef4444';

  const domBar = function(label, val, color) {
    if (val === null) return '';
    const pct = Math.round(val * 100);
    return '<div style="margin-bottom:6px;">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">'
      + '<span style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);">' + label + '</span>'
      + '<span style="font-family:var(--font-mono);font-size:0.62rem;color:' + color + ';">' + val.toFixed(3) + '</span>'
      + '</div>'
      + '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">'
      + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:2px;"></div>'
      + '</div></div>';
  };

  const archColor = arch !== null ? (arch >= 0.70 ? '#10b981' : arch >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';
  const execColor = exec !== null ? (exec >= 0.70 ? '#10b981' : exec >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';
  const ctxColor  = ctx  !== null ? (ctx  >= 0.70 ? '#10b981' : ctx  >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';

  // SDoH chips
  let sdohHtml = '';
  if (mapRec) {
    const chips = [];
    if (mapRec.condition) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.20);color:var(--muted);">' + _esc(mapRec.condition) + '</span>');
    if (mapRec.age_range) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">Age: ' + _esc(mapRec.age_range) + '</span>');
    if (mapRec.gender) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">' + _esc(mapRec.gender) + '</span>');
    if (mapRec.education_level) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">Edu: ' + _esc(mapRec.education_level) + '</span>');
    if (mapRec.country) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">' + _esc(mapRec.country) + (mapRec.city ? ' · ' + _esc(mapRec.city) : '') + '</span>');
    if (mapRec.medications && mapRec.medications.length) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.20);color:#8b6ff5;">' + mapRec.medications.map(function(m){ return _esc(m.name || m); }).filter(Boolean).join(' · ') + '</span>');
    if (chips.length) sdohHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;">' + chips.join('') + '</div>';
  }

  // Item responses
  const _mapItemDefs2 = [
    { key:'map_q1', label:'Forgets doses',                type:'UNA' },
    { key:'map_q2', label:'Careless about taking',        type:'INA' },
    { key:'map_q3', label:'Stops — side effects',         type:'INA' },
    { key:'map_q4', label:'Routine change / environment', type:'NEU' },
    { key:'map_q5', label:'Controlled yesterday',         type:'NEU' },
    { key:'map_q6', label:'Stops — feels worse',          type:'INA' },
    { key:'map_q7', label:'Burden / daily hassle',        type:'NEU' },
    { key:'map_q8', label:'Difficulty remembering',       type:'UNA' },
  ];
  let itemsHtml = '';
  if (mapRec && mapRec.map_q1 !== undefined) {
    itemsHtml = '<div style="margin-top:16px;">'
      + '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">MAP Item Responses</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;">'
      + _mapItemDefs2.map(function(d) {
          const raw = mapRec[d.key];
          if (raw === undefined || raw === null) return '';
          const v    = parseFloat(raw);
          const fail = d.key === 'map_q8' ? v < 1 : v === 0;
          const typeColor = d.type === 'INA' ? '#ef4444' : d.type === 'UNA' ? '#f59e0b' : 'var(--dim)';
          const valColor  = fail ? typeColor : '#10b981';
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
            + '<span style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);">' + d.label + '</span>'
            + '<span style="font-family:var(--font-mono);font-size:0.66rem;font-weight:600;color:' + valColor + ';">' + v.toFixed(2) + '</span>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  const ts = mapRec ? (mapRec.timestamp || 0) : (mmasRec ? (mmasRec.timestamp || 0) : 0);
  const tsStr = ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  mount.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--rl);overflow:hidden;">'
    + '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">'
    + '<div>'
    + '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);margin-bottom:2px;">Session Result · Last Assessment</div>'
    + '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.35rem;font-weight:300;color:var(--bright);">' + _esc(pid) + '</div>'
    + '</div>'
    + (tsStr ? '<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);">' + tsStr + '</div>' : '')
    + '</div>'
    + '<div style="padding:18px 20px;">'
    // Scores row
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">'
    // MAP PE
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">'
    + '<div style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">MAP PE</div>'
    + (mapPE !== null ? '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.6rem;font-weight:300;color:' + mapMeta.color + ';line-height:1;">' + mapPE.toFixed(3) + '</div><div style="font-family:var(--font-mono);font-size:0.60rem;color:' + mapMeta.color + ';margin-top:1px;">' + mapMeta.label + '</div>' : '<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--dim);margin-top:4px;">—</div>')
    + '</div>'
    // MMAS-8
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">'
    + '<div style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">MMAS-8</div>'
    + (mmasScore !== null ? '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.6rem;font-weight:300;color:' + mmasColor + ';line-height:1;">' + mmasScore.toFixed(1) + '</div>' : '<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--dim);margin-top:4px;">—</div>')
    + '</div>'
    // PEACS
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">'
    + '<div style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;">PEACS PE</div>'
    + (peScore !== null ? '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:1.6rem;font-weight:300;color:' + peMeta.color + ';line-height:1;">' + peScore.toFixed(3) + '</div><div style="font-family:var(--font-mono);font-size:0.60rem;color:' + peMeta.color + ';margin-top:1px;">' + peMeta.label + '</div>' : '<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--dim);margin-top:4px;">—</div>')
    + '</div>'
    + '</div>'
    // A/E/C domain bars
    + ((arch !== null || exec !== null || ctx !== null) ? '<div style="margin-bottom:14px;">'
      + '<div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">MAP Triadic Breakdown</div>'
      + domBar('Architecture', arch, archColor)
      + domBar('Execution', exec, execColor)
      + domBar('Context', ctx, ctxColor)
      + '</div>' : '')
    + sdohHtml
    + itemsHtml
    + '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">'
    + '<button onclick="_renderClinSessionResult()" style="font-family:var(--font-mono);font-size:0.68rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:5px 12px;cursor:pointer;">Refresh</button>'
    + '<button onclick="openClinPatientBrief(\'' + pid + '\')" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.22);color:var(--base);border-radius:5px;padding:5px 12px;cursor:pointer;">Full Brief →</button>'
    + '</div>'
    + '</div></div>';
}

// ── Care Gap Monitor ─────────────────────────────────────────────────────────
// Shows all patients with overdue or at-risk composite status.
// Gate: hasModule('clinical_care_gaps')

function renderClinCareGaps() {
  const mount = document.getElementById('clin-caregaps-mount');
  if (!mount) return;
  const data = window._rppData || [];

  const flagged = data.filter(p => {
    const s = _clinCompositeStatus(p);
    return s === 'overdue' || s === 'atrisk';
  }).sort((a, b) => {
    const sA = _clinCompositeStatus(a) === 'overdue' ? 0 : 1;
    const sB = _clinCompositeStatus(b) === 'overdue' ? 0 : 1;
    if (sA !== sB) return sA - sB;
    return (a.lastTs || 0) - (b.lastTs || 0); // oldest first within tier
  });

  // Update badge on tab button
  const badge = document.getElementById('clin-caregaps-badge');
  if (badge) {
    badge.textContent = flagged.length;
    badge.style.display = flagged.length ? 'inline' : 'none';
  }

  if (!flagged.length) {
    mount.innerHTML = `<div style="text-align:center;padding:52px 24px;">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:var(--bright);margin-bottom:8px;">No Care Gaps Detected</div>
      <div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--muted);line-height:1.6;">All patients are within monitoring thresholds across MAP, MMAS-8, and PEACS.</div>
    </div>`;
    return;
  }

  const _ts = ts => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  };
  const _esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const rows = flagged.map(p => {
    const status = _clinCompositeStatus(p);
    const statusColor = status === 'overdue' ? '#ef4444' : '#f59e0b';
    const statusLabel = status === 'overdue' ? 'OVERDUE' : 'AT RISK';

    const latestMmas  = (p.mmas  || []).slice(-1)[0];
    const latestPeacs = (p.peacs || []).slice(-1)[0];
    const latestMap   = (p.map   || (p.mmas||[]).filter(r => r.pe !== undefined)).slice(-1)[0];

    const mapVal  = latestMap  ? (+latestMap.pe  || +latestMap.score || 0).toFixed(2) : '—';
    const mmasVal = latestMmas ? (+latestMmas.score || 0).toFixed(1) : '—';
    const peacsBase  = latestPeacs ? +(latestPeacs.base  || 0) : 0;
    const peacsMvmt  = latestPeacs ? +(latestPeacs.mvmt  || 0) : 0;
    const peacsStrat = latestPeacs ? +(latestPeacs.strata|| 0) : 0;
    const peacsVal   = latestPeacs ? (peacsBase + peacsMvmt + peacsStrat).toFixed(2) : '—';

    const lastSeen = _ts(p.lastTs);
    const pid = _esc(p.pid);

    return `<tr style="border-bottom:1px solid var(--border2);cursor:pointer;" onclick="openClinPatientBrief('${p.pid}')">
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.86rem;color:var(--bright);">${pid}</td>
      <td style="padding:10px 12px;"><span style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.10em;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}44;border-radius:4px;padding:2px 8px;">${statusLabel}</span></td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.86rem;color:var(--base);">${mapVal}</td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.86rem;color:#2ec98a;">${mmasVal}</td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.86rem;color:#8b6ff5;">${peacsVal}</td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">${lastSeen}</td>
      <td style="padding:10px 12px;"><button onclick="event.stopPropagation();openClinPatientBrief('${p.pid}')" style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.30);color:#ef4444;border-radius:5px;padding:4px 12px;cursor:pointer;">Brief →</button></td>
    </tr>`;
  }).join('');

  mount.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(239,68,68,0.7);margin-bottom:3px;">◬ Care Gap Monitor</div>
        <div style="font-family:var(--font-mono);font-size:0.76rem;color:var(--muted);">${flagged.length} patient${flagged.length!==1?'s':''} requiring attention · click any row to open brief</div>
      </div>
      <span style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);background:rgba(78,156,245,0.07);border:1px solid rgba(78,156,245,0.18);border-radius:4px;padding:2px 7px;">MODULE: Care Gap Monitor</span>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:8px 12px;text-align:left;">Patient</th>
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:8px 12px;text-align:left;">Status</th>
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--base);padding:8px 12px;text-align:left;">MAP PE</th>
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#2ec98a;padding:8px 12px;text-align:left;">MMAS-8</th>
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#8b6ff5;padding:8px 12px;text-align:left;">PEACS</th>
          <th style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);padding:8px 12px;text-align:left;">Last Seen</th>
          <th style="padding:8px 12px;"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── SDoH Analysis ────────────────────────────────────────────────────────────
// Renders the full institutional SDoH view (Population Risk Stratification +
// Population Demographics) inside the clinician SDoH tab.
//
// Strategy: inject the same HTML structure used by the institution ICC panel
// (with icc-sdoh-* / icc-demo-* IDs) into clin-sdoh-mount, which sits earlier
// in the DOM than the institution panel — so getElementById finds ours first.
// Then call renderICCSDoH() + renderICCDemographics() from admin-tools.js.
// Gate: hasModule('analytics_sdoh')

function renderClinSDoH() {
  const mount = document.getElementById('clin-sdoh-mount');
  if (!mount) return;
  const ws = (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null;
  if (!ws) {
    mount.innerHTML = '<div style="padding:32px;text-align:center;font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">No workspace loaded.</div>';
    return;
  }

  // Inject the full ICC SDoH HTML structure — same layout as institution panel
  mount.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;padding:6px 10px;background:rgba(78,156,245,0.05);border-left:3px solid var(--base);border-radius:3px;">Social Determinants of Health · Population Risk Stratification</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">🏠 Living Situation</div>
          <div id="icc-sdoh-living" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">🚌 Access & Transport</div>
          <div id="icc-sdoh-access" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">📚 Health Literacy & Beliefs</div>
          <div id="icc-sdoh-literacy" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">🤝 Social Support Network</div>
          <div id="icc-sdoh-support" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-left:3px solid var(--poor);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">⚠ High Social Risk</div>
          <div id="icc-sdoh-risk" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;">
          <div style="font-family:var(--font-mono);font-size:0.90rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">💊 Top Conditions</div>
          <div id="icc-conditions-list" style="display:flex;flex-direction:column;gap:4px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Loading…</div></div>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;">
      <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;padding:0 2px;">Population Demographics · Cohort Balance Check</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;">
          <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Gender Distribution</div>
          <div id="icc-demo-gender" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;">
          <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Age Band Distribution</div>
          <div id="icc-demo-age" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">Loading…</div></div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;">
          <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">Education Level</div>
          <div id="icc-demo-edu" style="display:flex;flex-direction:column;gap:5px;"><div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">Loading…</div></div>
        </div>
      </div>
    </div>`;

  // Derive records from already-loaded _rppData (no extra Firebase round-trip for MMAS/PEACS)
  const rppData = window._rppData || [];
  const peacsRecords = rppData.flatMap(p => p.peacs || []);
  const mmasRecords  = rppData.flatMap(p => p.mmas  || []);

  // Mirror _rppData as _patientPanelData so renderICCSDoH patient lookup works
  window._patientPanelData = rppData;

  // Populate demographics immediately from mmas records (has gender/age/education fields)
  if (typeof renderICCDemographics === 'function') {
    renderICCDemographics(mmasRecords);
  }

  // Top Conditions from mmas records
  const condCounts = {};
  mmasRecords.forEach(r => {
    const c = (r.condition || 'Not specified').trim() || 'Not specified';
    condCounts[c] = (condCounts[c] || 0) + 1;
  });
  const condEl = document.getElementById('icc-conditions-list');
  if (condEl) {
    const sorted = Object.entries(condCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const total = mmasRecords.length || 1;
    condEl.innerHTML = sorted.length
      ? sorted.map(([label, n]) => `<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.84rem;padding:2px 0;">
          <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${label}</span>
          <span style="color:var(--dim);margin-left:8px;white-space:nowrap;">${n} · ${Math.round(n/total*100)}%</span>
        </div>`).join('')
      : '<span style="color:var(--dim);font-size:0.86rem;">No condition data.</span>';
  }

  // Load STRATA (peacs_dimensions) filtered by this workspace, then call renderICCSDoH
  firebase.database().ref('peacs_dimensions').once('value', snap => {
    const raw = snap.val() || {};
    const strataRecords = Object.values(raw).filter(r => r.workspace_key === ws || r.workspace === ws);
    if (typeof renderICCSDoH === 'function') {
      renderICCSDoH(strataRecords, peacsRecords, mmasRecords);
    }
  }).catch(() => {
    ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">Error loading STRATA data.</span>';
    });
  });
}



// ── Patients tab — full cross-instrument list ────────────────────────────────

function _renderClinAllPatients() {
  const mount = document.getElementById('clin-rpp-mount');
  if (!mount) return;

  const allPatients = window._rppData || [];
  if (!allPatients.length) {
    mount.innerHTML = '<div id="clin-rpp-placeholder" style="padding:32px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);">No patient records yet.</div>';
    return;
  }

  const timeAgo = ts => {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  };

  mount.innerHTML = allPatients.map(p => {
    const mapRecs  = _clinMapRecs(p);
    const mmasRecs = _clinMmasRecs(p);
    const peacsRecs = p.peacs || [];

    const latestMap  = _clinLatest(mapRecs);
    const latestMmas = _clinLatest(mmasRecs);
    const latestPeacs = _clinLatest(peacsRecs);

    const mapScore  = latestMap  ? (latestMap.score  ?? null) : null;
    const mmasScore = latestMmas ? _recomputeMMASScore(latestMmas) : null;
    const peScore   = latestPeacs ? (latestPeacs.pe ?? latestPeacs.pe_score ?? null) : null;

    const mapColor  = mapScore  !== null ? _clinScoreMeta(mapScore).color  : 'var(--dim)';
    const mmasColor = mmasScore !== null ? (typeof getAdherenceCategory === 'function' ? getAdherenceCategory(mmasScore).color : 'var(--dim)') : 'var(--dim)';
    const peColor   = peScore   !== null ? _clinScoreMeta(peScore).color   : 'var(--dim)';

    return `<div style="display:grid;grid-template-columns:2fr 110px 110px 110px 90px;gap:0;padding:9px 20px;border-bottom:1px solid var(--border);align-items:center;font-family:var(--font-mono);" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
      <div style="font-size:0.82rem;color:var(--text);">${p.pid}</div>
      <div style="font-size:0.80rem;font-weight:600;color:${mapColor};">${mapScore !== null ? mapScore.toFixed(3) : '—'}<span style="font-size:0.62rem;color:var(--dim);margin-left:4px;">${mapRecs.length ? 'MAP ×' + mapRecs.length : ''}</span></div>
      <div style="font-size:0.80rem;font-weight:600;color:${mmasColor};">${mmasScore !== null ? mmasScore.toFixed(2) : '—'}<span style="font-size:0.62rem;color:var(--dim);margin-left:4px;">${mmasRecs.length ? 'MMAS ×' + mmasRecs.length : ''}</span></div>
      <div style="font-size:0.80rem;font-weight:600;color:${peColor};">${peScore !== null ? peScore.toFixed(3) : '—'}<span style="font-size:0.62rem;color:var(--dim);margin-left:4px;">${peacsRecs.length ? 'PEACS ×' + peacsRecs.length : ''}</span></div>
      <div style="font-size:0.72rem;color:var(--dim);">${timeAgo(p.lastTs)}</div>
    </div>`;
  }).join('');

  // Insert column headers before the rows
  const headers = `<div style="display:grid;grid-template-columns:2fr 110px 110px 110px 90px;gap:0;padding:7px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">
    <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Patient</div>
    <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">MAP PE</div>
    <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">MMAS-8</div>
    <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">PEACS PE</div>
    <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Last Visit</div>
  </div>`;
  mount.innerHTML = headers + mount.innerHTML;
}

// ── Patient Brief modal (rounds-mode entry point) ────────────────────────────

/**
 * Opens the patient brief modal — the nurse's starting point for every visit.
 * Shows all 3 instrument scores, MAP domain breakdown, failing MMAS items,
 * PEACS dimension status, and one-tap assessment launch buttons.
 * MTM timer is embedded and auto-starts when the modal opens.
 */
function openClinPatientBrief(pid) {
  const existing = document.getElementById('clin-brief-modal');
  if (existing) existing.remove();

  const allPatients = window._rppData || [];
  const p = allPatients.find(pt => pt.pid === pid);

  // MAP data
  const mapRecs   = p ? _clinMapRecs(p) : [];
  const mapRec    = _clinLatest(mapRecs);
  const mapScore  = mapRec ? (mapRec.score ?? null) : null;
  const mapMeta   = _clinScoreMeta(mapScore);
  const mapCount  = mapRecs.length;

  // MMAS-8 data
  const mmasRecs  = p ? _clinMmasRecs(p) : [];
  const mmasRec   = _clinLatest(mmasRecs);
  const mmasScore = mmasRec ? _recomputeMMASScore(mmasRec) : null;
  const mmasCount = mmasRecs.length;
  const mmasColor = mmasScore === null ? 'var(--dim)'
    : mmasScore >= 8 ? '#10b981' : mmasScore >= 6 ? '#f59e0b' : '#ef4444';
  const mmasLabel = mmasScore === null ? '—'
    : mmasScore >= 8 ? 'High' : mmasScore >= 6 ? 'Medium' : 'Low';

  // PEACS data
  const peacsRecs = p ? (p.peacs || []) : [];
  const peacsRec  = _clinLatest(peacsRecs);
  const peScore   = peacsRec ? (peacsRec.pe ?? peacsRec.pe_score ?? null) : null;
  const peMeta    = _clinScoreMeta(peScore);
  const peCount   = peacsRecs.length;

  // MAP domain bars (Architecture / Execution / Context)
  let mapDomainHtml = '';
  if (mapRec) {
    const arch = mapRec.domain_arch ?? mapRec.pe_arch ?? mapRec.arch_score ?? null;
    const exec = mapRec.domain_exec ?? mapRec.pe_exec ?? mapRec.exec_score ?? null;
    const ctx  = mapRec.domain_ctx  ?? mapRec.pe_ctx  ?? mapRec.ctx_score  ?? null;
    const domBar = (label, val, color) => {
      if (val === null) return '';
      const pct = Math.round(val * 100);
      return `<div style="margin-bottom:7px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">${label}</span>
          <span style="font-family:var(--font-mono);font-size:0.65rem;color:${color};">${(val).toFixed(2)}</span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
        </div>
      </div>`;
    };
    const hasAny = arch !== null || exec !== null || ctx !== null;
    if (hasAny) {
      const archColor = arch !== null ? (arch >= 0.70 ? '#10b981' : arch >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';
      const execColor = exec !== null ? (exec >= 0.70 ? '#10b981' : exec >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';
      const ctxColor  = ctx  !== null ? (ctx  >= 0.70 ? '#10b981' : ctx  >= 0.50 ? '#f59e0b' : '#ef4444') : 'var(--dim)';
      mapDomainHtml = `<div style="margin-top:10px;">
        ${domBar('Architecture', arch, archColor)}
        ${domBar('Execution', exec, execColor)}
        ${domBar('Context', ctx, ctxColor)}
      </div>`;
    }
  }

  // MAP pattern (INA / UNA) — classified from the latest MAP record's map_q1–map_q8 fields
  // INA: map_q2, map_q3, map_q6, map_q7 · UNA: map_q1, map_q4, map_q8 · map_q5 neutral
  let patternHtml = '';
  if (mapRec && mapRec.map_q1 !== undefined && (mapScore === null || mapScore < 8)) {
    try {
      const { intentional, unintentional } = classifyMapPattern(mapRec);
      if (intentional > 0 || unintentional > 0) {
        const pat   = intentional > unintentional ? 'INA · Intentional'
                    : unintentional > intentional  ? 'UNA · Unintentional'
                    : 'Mixed Pattern';
        const pColor = intentional > unintentional ? '#ef4444'
                     : unintentional > intentional  ? '#f59e0b'
                     : '#8b6ff5';
        patternHtml = `<div style="font-family:var(--font-mono);font-size:0.64rem;color:${pColor};margin-top:4px;">Pattern: ${pat}</div>`;
      }
    } catch(e) {}
  }

  // Failing MAP items — items where the patient scored 0 (INA/UNA barrier present)
  // Labels mirror the MMAS-8 item descriptions for MAP (same construct)
  let failingItems = '';
  if (mapRec && mapRec.map_q1 !== undefined) {
    const _mapItemLabels = [
      { key:'map_q1', label:'Forgets doses',                type:'UNA' },
      { key:'map_q2', label:'Careless about taking',        type:'INA' },
      { key:'map_q3', label:'Stops — side effects',         type:'INA' },
      { key:'map_q4', label:'Routine change / environment', type:'NEU' },
      // map_q5 neutral — not shown as barrier
      { key:'map_q6', label:'Stops — feels worse',          type:'INA' },
      { key:'map_q7', label:'Burden / daily hassle',        type:'NEU' },
      { key:'map_q8', label:'Difficulty remembering',       type:'UNA' },
    ];
    const failed = _mapItemLabels.filter(({ key }) => {
      const v = mapRec[key];
      if (v === undefined || v === null) return false;
      return key === 'map_q8' ? parseFloat(v) < 1 : parseFloat(v) === 0;
    });
    if (failed.length) {
      const inaFailed = failed.filter(f => f.type === 'INA');
      const unaFailed = failed.filter(f => f.type === 'UNA');
      const parts = [];
      if (inaFailed.length) parts.push(`<span style="color:#ef4444;">INA: ${inaFailed.map(f=>f.label).join(' · ')}</span>`);
      if (unaFailed.length) parts.push(`<span style="color:#f59e0b;">UNA: ${unaFailed.map(f=>f.label).join(' · ')}</span>`);
      failingItems = `<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dim);margin-top:5px;line-height:1.8;">${parts.join('<br>')}</div>`;
    }
  }

  // PEACS dimension status
  let peacsDetailHtml = '';
  if (peacsRec) {
    const base  = peacsRec.base_score  ?? peacsRec.base  ?? null;
    const mvmt  = peacsRec.mvmt_score  ?? peacsRec.mvmt  ?? null;
    const strata = peacsRec.strata_score ?? peacsRec.strata ?? null;
    const dimRow = (label, val) => {
      if (val === null) return `<span style="color:var(--dim);">${label}: —</span>`;
      const c = val >= 0.70 ? '#10b981' : val >= 0.50 ? '#f59e0b' : '#ef4444';
      return `<span style="color:${c};">${label}: ${val.toFixed(2)}</span>`;
    };
    peacsDetailHtml = `<div style="font-family:var(--font-mono);font-size:0.62rem;margin-top:5px;display:flex;gap:10px;flex-wrap:wrap;">
      ${dimRow('BASE', base)} ${dimRow('MVMT', mvmt)} ${dimRow('STRATA', strata)}
    </div>`;
  }

  // Status
  const status = p ? _clinCompositeStatus(p) : 'new';
  const lastTs = p ? _clinLastSeenTs(p) : 0;

  const statusChip = {
    overdue: 'background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.30);',
    atrisk:  'background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.30);',
    stable:  'background:rgba(16,185,129,0.10);color:#10b981;border:1px solid rgba(16,185,129,0.28);',
    new:     'background:rgba(255,255,255,0.06);color:var(--dim);border:1px solid var(--border2);',
  }[status] || '';
  const statusLabel = { overdue:'Overdue', atrisk:'At Risk', stable:'Stable', new:'New' }[status] || '—';

  // SDoH + MAP item responses section (collapsible)
  const _mapItemDefs = [
    { key:'map_q1', label:'Forgets doses',                type:'UNA' },
    { key:'map_q2', label:'Careless about taking',        type:'INA' },
    { key:'map_q3', label:'Stops — side effects',         type:'INA' },
    { key:'map_q4', label:'Routine change / environment', type:'NEU' },
    { key:'map_q5', label:'Controlled yesterday',         type:'NEU' },
    { key:'map_q6', label:'Stops — feels worse',          type:'INA' },
    { key:'map_q7', label:'Burden / daily hassle',        type:'NEU' },
    { key:'map_q8', label:'Difficulty remembering',       type:'UNA' },
  ];
  let sdohSectionHtml = '';
  if (mapRec) {
    const hasSdoh = mapRec.condition || mapRec.age_range || mapRec.gender || mapRec.education_level || mapRec.country || (mapRec.medications && mapRec.medications.length);
    const hasItems = mapRec.map_q1 !== undefined;
    if (hasSdoh || hasItems) {
      let sdohChipsHtml = '';
      if (hasSdoh) {
        const chips = [];
        if (mapRec.condition) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.20);color:var(--muted);">' + mapRec.condition + '</span>');
        if (mapRec.age_range) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">Age: ' + mapRec.age_range + '</span>');
        if (mapRec.gender) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">' + mapRec.gender + '</span>');
        if (mapRec.education_level) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">Edu: ' + mapRec.education_level + '</span>');
        if (mapRec.country) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);color:var(--dim);">' + mapRec.country + (mapRec.city ? ' · ' + mapRec.city : '') + '</span>');
        if (mapRec.medications && mapRec.medications.length) chips.push('<span style="font-family:var(--font-mono);font-size:0.62rem;padding:2px 8px;border-radius:12px;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.20);color:#8b6ff5;">' + mapRec.medications.map(function(m){ return m.name || m; }).filter(Boolean).join(' · ') + '</span>');
        sdohChipsHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + chips.join('') + '</div>';
      }
      let itemRowsHtml = '';
      if (hasItems) {
        itemRowsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;">' +
          _mapItemDefs.map(function(d) {
            const raw = mapRec[d.key];
            if (raw === undefined || raw === null) return '';
            const v    = parseFloat(raw);
            const fail = d.key === 'map_q8' ? v < 1 : v === 0;
            const typeColor = d.type === 'INA' ? '#ef4444' : d.type === 'UNA' ? '#f59e0b' : 'var(--dim)';
            const valColor  = fail ? typeColor : '#10b981';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
              + '<span style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);">' + d.label + '</span>'
              + '<span style="font-family:var(--font-mono);font-size:0.66rem;font-weight:600;color:' + valColor + ';">' + v.toFixed(2) + '</span>'
              + '</div>';
          }).join('') + '</div>';
      }
      sdohSectionHtml = '<div style="border-bottom:1px solid var(--border);">'
        + '<button onclick="(function(btn){var body=btn.nextElementSibling;var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'\';btn.querySelector(\'.cbchev\').style.transform=open?\'rotate(0deg)\':\' rotate(180deg)\';})(this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:none;border:none;cursor:pointer;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);">'
        + '<span>Patient Data · SDoH &amp; Item Responses</span>'
        + '<span class="cbchev" style="display:inline-block;transition:transform 0.2s;">&#9662;</span>'
        + '</button>'
        + '<div style="display:none;padding:0 20px 16px;">'
        + sdohChipsHtml
        + itemRowsHtml
        + '</div></div>';
    }
  }

  // MTM timer (stored per patient so it persists while modal is open)
  const timerKey = '_clinMtmTimer_' + pid;

  const modal = document.createElement('div');
  modal.id    = 'clin-brief-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9850;background:rgba(0,0,0,0.82);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:16px;width:100%;max-width:540px;position:relative;overflow:hidden;">

      <!-- Top bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">
        <div>
          <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;">Patient Brief · Rounds Mode</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.45rem;font-weight:300;color:var(--bright);">${pid}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:var(--font-mono);font-size:0.66rem;padding:3px 10px;border-radius:20px;${statusChip}">${statusLabel}</span>
          <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">${_clinTimeAgo(lastTs)}</span>
          <button onclick="document.getElementById('clin-brief-modal').remove();clearInterval(window['${timerKey}']);" style="font-family:var(--font-mono);font-size:0.72rem;background:none;border:1px solid var(--border2);color:var(--dim);border-radius:5px;padding:4px 10px;cursor:pointer;">✕</button>
        </div>
      </div>

      <!-- Instrument scores — 3 columns -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid var(--border);">

        <!-- MAP -->
        <div style="padding:16px 18px;border-right:1px solid var(--border);">
          <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">MAP PE</div>
          ${mapScore !== null
            ? `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;font-weight:300;color:${mapMeta.color};line-height:1;">${mapScore.toFixed(3)}</div>
               <div style="font-family:var(--font-mono);font-size:0.65rem;color:${mapMeta.color};margin-top:2px;">${mapMeta.label}</div>
               ${mapDomainHtml}`
            : `<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);margin-top:4px;">Not assessed</div>
               <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:2px;">8-item behavioral</div>`
          }
          ${mapCount > 0 ? `<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--dim);margin-top:8px;">${mapCount} session${mapCount !== 1 ? 's' : ''}</div>` : ''}
        </div>

        <!-- MMAS-8 -->
        <div style="padding:16px 18px;border-right:1px solid var(--border);">
          <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">MMAS-8</div>
          ${mmasScore !== null
            ? `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;font-weight:300;color:${mmasColor};line-height:1;">${mmasScore.toFixed(1)}</div>
               <div style="font-family:var(--font-mono);font-size:0.65rem;color:${mmasColor};margin-top:2px;">${mmasLabel}</div>
               ${patternHtml}
               ${failingItems}`
            : `<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);margin-top:4px;">Not assessed</div>
               <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:2px;">Classic adherence scale</div>`
          }
          ${mmasCount > 0 ? `<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--dim);margin-top:8px;">${mmasCount} session${mmasCount !== 1 ? 's' : ''}</div>` : ''}
        </div>

        <!-- PEACS -->
        <div style="padding:16px 18px;">
          <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">PEACS PE</div>
          ${peScore !== null
            ? `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;font-weight:300;color:${peMeta.color};line-height:1;">${peScore.toFixed(3)}</div>
               <div style="font-family:var(--font-mono);font-size:0.65rem;color:${peMeta.color};margin-top:2px;">${peMeta.label}</div>
               ${peacsDetailHtml}`
            : `<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);margin-top:4px;">Not assessed</div>
               <div style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-top:2px;">3-stage · quarterly</div>`
          }
          ${peCount > 0 ? `<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--dim);margin-top:8px;">${peCount} session${peCount !== 1 ? 's' : ''}</div>` : ''}
        </div>

      </div>

      <!-- SDoH + MAP item responses (collapsible) -->
      ${sdohSectionHtml}

      <!-- C1: Intervention history (collapsible) -->
      <div style="border-bottom:1px solid var(--border);">
        <button onclick="(function(btn){var body=btn.nextElementSibling;var open=body.style.display!=='none';body.style.display=open?'none':'';btn.querySelector('.cbchev2').style.transform=open?'rotate(0deg)':'rotate(180deg)';})(this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:none;border:none;cursor:pointer;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--strata);">
          <span>Intervention History</span>
          <span class="cbchev2" style="display:inline-block;transition:transform 0.2s;">&#9662;</span>
        </button>
        <div style="display:none;padding:0 20px 16px;">
          <div>${_cpRenderIntvHistory(pid) || '<span class="cp-no-intv">No interventions logged yet.</span>'}</div>
        </div>
      </div>

      <!-- MTM Timer + Assess buttons -->
      <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">

        <!-- MTM Timer -->
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">MTM Timer</div>
          <div id="clin-brief-mtm-display" style="font-family:var(--font-mono);font-size:1.10rem;font-weight:600;color:var(--base);letter-spacing:0.05em;min-width:52px;">00:00</div>
          <button id="clin-brief-mtm-btn" onclick="_clinBriefMtmToggle('${pid}')" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.25);color:var(--base);border-radius:5px;padding:4px 10px;cursor:pointer;transition:all 0.15s;">Start</button>
        </div>

        <!-- Assessment launch buttons -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="document.getElementById('clin-brief-modal').remove();clearInterval(window['${timerKey}']);window._clinDefaultInstrument='map';_clinLaunchSessionForPid('${pid}')" style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(78,156,245,0.10);border:1px solid rgba(78,156,245,0.28);color:var(--base);border-radius:6px;padding:7px 14px;cursor:pointer;transition:all 0.15s;white-space:nowrap;" onmouseover="this.style.background='rgba(78,156,245,0.20)'" onmouseout="this.style.background='rgba(78,156,245,0.10)'">MAP →</button>
          <button onclick="document.getElementById('clin-brief-modal').remove();clearInterval(window['${timerKey}']);window._clinDefaultInstrument='mmas';_clinLaunchSessionForPid('${pid}')" style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.25);color:#2ec98a;border-radius:6px;padding:7px 14px;cursor:pointer;transition:all 0.15s;white-space:nowrap;" onmouseover="this.style.background='rgba(46,201,138,0.18)'" onmouseout="this.style.background='rgba(46,201,138,0.08)'">MMAS-8 →</button>
          <button onclick="document.getElementById('clin-brief-modal').remove();clearInterval(window['${timerKey}']);window._clinDefaultInstrument='peacs';_clinLaunchSessionForPid('${pid}')" style="font-family:var(--font-mono);font-size:0.70rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.25);color:#8b6ff5;border-radius:6px;padding:7px 14px;cursor:pointer;transition:all 0.15s;white-space:nowrap;" onmouseover="this.style.background='rgba(139,111,245,0.18)'" onmouseout="this.style.background='rgba(139,111,245,0.08)'">PEACS →</button>
          <button class="cp-log-intv-btn" onclick="event.stopPropagation();cpOpenIntervention('${pid}')">Log Intervention</button>
          <button class="cp-print-btn" onclick="event.stopPropagation();cpPrintSummary('${pid}')">Print Summary</button>
        </div>

      </div>
    </div>`;

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
      clearInterval(window[timerKey]);
    }
  });
  document.body.appendChild(modal);

  // Auto-start MTM timer
  _clinBriefMtmToggle(pid, true);
}

/** Toggle (or force-start) the MTM timer inside the brief modal */
function _clinBriefMtmToggle(pid, forceStart) {
  const timerKey   = '_clinMtmTimer_' + pid;
  const secKey     = '_clinMtmSecs_'  + pid;
  const display    = document.getElementById('clin-brief-mtm-display');
  const btn        = document.getElementById('clin-brief-mtm-btn');
  if (!display) return;

  const running = !!window[timerKey];

  if (running && !forceStart) {
    // Pause
    clearInterval(window[timerKey]);
    window[timerKey] = null;
    if (btn) btn.textContent = 'Resume';
    return;
  }

  if (!forceStart && !running) {
    // Resume — already started
  }

  if (!window[secKey]) window[secKey] = 0;

  window[timerKey] = setInterval(() => {
    window[secKey] = (window[secKey] || 0) + 1;
    const s = window[secKey] % 60;
    const m = Math.floor(window[secKey] / 60);
    const timeStr = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    const d = document.getElementById('clin-brief-mtm-display');
    if (d) {
      d.textContent = timeStr;
      // Color shift: green < 10m, yellow 10–15m, red > 15m
      d.style.color = window[secKey] < 600 ? 'var(--base)' : window[secKey] < 900 ? '#f59e0b' : '#ef4444';
    } else {
      clearInterval(window[timerKey]);
      window[timerKey] = null;
    }
    const b = document.getElementById('clin-brief-mtm-btn');
    if (b) b.textContent = 'Pause';
  }, 1000);
}

/** Launch assessment flow for a given pid without opening the "type PID" dialog */
function _clinLaunchSessionForPid(pid) {
  window._sessionPatientId = pid;
  const inst = window._clinDefaultInstrument || 'map';

  const badge = document.getElementById('clin-session-badge');
  if (badge) badge.style.display = '';

  _postConsentTarget = 'dashboard';

  window._postConsentInstrument = inst === 'peacs' ? 'peacs' : (inst === 'map' ? 'map' : null);

  const consentCb  = document.getElementById('consent-checkbox');
  const consentBtn = document.getElementById('consent-proceed-btn');
  if (consentCb)  consentCb.checked  = false;
  if (consentBtn) consentBtn.disabled = true;
  if (typeof renderConsentForInstrument === 'function') {
    renderConsentForInstrument(inst === 'mmas' ? 'mmas' : inst);
  }
  if (typeof showScreen === 'function') showScreen('screen-consent');
}

// ── New Assessment launch ────────────────────────────────────────────────────
// Goes directly to consent — no patient-ID popup.
// Patient number is entered once on the assessment form itself (auto-filled from
// _sessionPatientId when called from the patient list row).

function openClinNewSession(prefilledPid) {
  // Pre-fill session patient ID if provided (e.g. from patient list row click).
  // Leave blank when called from the "New Assessment" button — user enters it on the form.
  if (prefilledPid) window._sessionPatientId = prefilledPid;

  const inst = window._clinDefaultInstrument || 'map';

  const badge = document.getElementById('clin-session-badge');
  if (badge) badge.style.display = '';

  _postConsentTarget = 'dashboard';
  window._postConsentInstrument = inst === 'peacs' ? 'peacs' : (inst === 'map' ? 'map' : null);

  const consentCb  = document.getElementById('consent-checkbox');
  const consentBtn = document.getElementById('consent-proceed-btn');
  if (consentCb)  consentCb.checked  = false;
  if (consentBtn) consentBtn.disabled = true;
  if (typeof renderConsentForInstrument === 'function') {
    renderConsentForInstrument(inst === 'mmas' ? 'mmas' : inst);
  }
  if (typeof showScreen === 'function') showScreen('screen-consent');
}

// ── Settings panel ───────────────────────────────────────────────────────────

function openClinSettings() {
  // Show a compact settings flyout
  const existing = document.getElementById('clin-settings-modal');
  if (existing) { existing.remove(); return; }

  const inst = window._clinDefaultInstrument || 'map';

  const modal = document.createElement('div');
  modal.id    = 'clin-settings-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:28px 30px;width:100%;max-width:420px;position:relative;">
      <div style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.20em;text-transform:uppercase;color:var(--dim);margin-bottom:6px;">Clinician Settings</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.30rem;font-weight:300;color:var(--bright);margin-bottom:22px;">Workspace Preferences</div>

      <div style="margin-bottom:18px;">
        <div style="font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim);margin-bottom:8px;">Default Instrument</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${['map','mmas','peacs'].map(i => {
            const lbl = { map:'MAP', mmas:'MMAS-8', peacs:'PEACS' }[i];
            const desc = { map:'PE score · 0–1 · 8 behavioral items', mmas:'Adherence score · 0–8 · classic MMAS', peacs:'Staged · 3 dimensions over 1 quarter' }[i];
            const isActive = inst === i;
            return `<button onclick="setClinDefaultInstrument('${i}');updateClinSettingsModal()" style="flex:1;min-width:110px;font-family:var(--font-mono);font-size:0.70rem;padding:10px 12px;border-radius:8px;background:${isActive ? 'rgba(78,156,245,0.14)' : 'var(--card2)'};border:1px solid ${isActive ? 'rgba(78,156,245,0.36)' : 'var(--border2)'};color:${isActive ? 'var(--base)' : 'var(--muted)'};cursor:pointer;text-align:left;transition:all 0.15s;" id="clin-set-btn-${i}">
              <div style="font-weight:600;margin-bottom:3px;">${lbl}${i==='peacs'?' <span style=\\"font-size:0.58rem;background:rgba(139,111,245,0.18);border:1px solid rgba(139,111,245,0.3);color:#8b6ff5;border-radius:3px;padding:1px 4px;\\">DEEP</span>':''}</div>
              <div style="font-size:0.62rem;color:var(--dim);white-space:normal;line-height:1.5;">${desc}</div>
            </button>`;
          }).join('')}
        </div>
      </div>

      ${inst === 'peacs' ? `<div style="background:rgba(139,111,245,0.06);border:1px solid rgba(139,111,245,0.20);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);line-height:1.7;">
        <span style="color:var(--mvmt);margin-right:6px;">◈ PEACS Deep Mode</span>PEACS is administered across three sessions over approximately one quarter (BASE → MVMT → STRATA). Patients must complete all three dimensions for a full PE profile. Best for chronic disease management programs.
      </div>` : ''}

      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button onclick="document.getElementById('clin-settings-modal').remove()" style="font-family:var(--font-mono);font-size:0.76rem;letter-spacing:0.10em;text-transform:uppercase;background:rgba(78,156,245,0.10);border:1px solid rgba(78,156,245,0.28);color:var(--base);border-radius:6px;padding:7px 20px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(78,156,245,0.20)'" onmouseout="this.style.background='rgba(78,156,245,0.10)'">Done</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

/** Refreshes settings modal instrument button states after switching */
function updateClinSettingsModal() {
  const inst = window._clinDefaultInstrument || 'map';
  ['map','mmas','peacs'].forEach(i => {
    const btn = document.getElementById('clin-set-btn-' + i);
    if (!btn) return;
    const active = inst === i;
    btn.style.background   = active ? 'rgba(78,156,245,0.14)' : 'var(--card2)';
    btn.style.borderColor  = active ? 'rgba(78,156,245,0.36)' : 'var(--border2)';
    btn.style.color        = active ? 'var(--base)'            : 'var(--muted)';
  });
}

// ── Hook into _rppRebuild to also refresh the clinician view ─────────────────

(function _patchRppRebuild() {
  const _orig = window._rppRebuildHook;
  // Called at the end of _rppRebuild — see bottom of the rebuild chain
  window._clinRefreshFromRpp = function() {
    if (typeof isClinician === 'function' && isClinician()) {
      const panel = document.getElementById('clinician-dash-panel');
      if (panel && panel.style.display !== 'none') {
        renderClinWorklist();
      }
    }
  };
})();

// ── C1: Intervention Notes ────────────────────────────────────────────────
let _cpCurrentIntvPatient = null;

function cpOpenIntervention(patientNum) {
  _cpCurrentIntvPatient = patientNum;
  const badge = document.getElementById('cp-intv-patient-id');
  if (badge) badge.textContent = patientNum;
  const typeEl = document.getElementById('cp-intv-type');
  const noteEl = document.getElementById('cp-intv-note');
  const fuEl = document.getElementById('cp-intv-followup');
  if (typeEl) typeEl.value = '';
  if (noteEl) noteEl.value = '';
  if (fuEl) fuEl.value = '';
  const errEl = document.getElementById('cp-intv-err');
  if (errEl) errEl.style.display = 'none';
  const modal = document.getElementById('cp-intervention-modal');
  if (modal) modal.style.display = 'flex';
}

function cpCloseIntervention() {
  const modal = document.getElementById('cp-intervention-modal');
  if (modal) modal.style.display = 'none';
  _cpCurrentIntvPatient = null;
}

async function cpSaveIntervention() {
  const type = document.getElementById('cp-intv-type')?.value;
  const note = document.getElementById('cp-intv-note')?.value?.trim();
  const followup = document.getElementById('cp-intv-followup')?.value;
  if (!type) {
    const errEl = document.getElementById('cp-intv-err');
    if (errEl) errEl.style.display = 'block';
    return;
  }
  const patientNum = _cpCurrentIntvPatient;
  if (!patientNum) return;

  const workspaceKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey') || 'unknown';
  const record = {
    type,
    note: note || '',
    followup_date: followup || '',
    timestamp: Date.now(),
    timestamp_iso: new Date().toISOString(),
    patient_number: patientNum,
    workspace: workspaceKey,
    clinician: window._currentUserEmail || 'clinician'
  };

  try {
    // Write to Firebase at /interventions/{workspaceKey}/{sanitizedPatient}/
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (db) {
      const safePat = String(patientNum).replace(/[.#$\[\]]/g, '_');
      const safeWs = String(workspaceKey).replace(/[.#$\[\]]/g, '_');
      await db.ref(`interventions/${safeWs}/${safePat}`).push(record);
    }
    // Update local cache for immediate display
    if (!window._cpInterventions) window._cpInterventions = {};
    if (!window._cpInterventions[patientNum]) window._cpInterventions[patientNum] = [];
    window._cpInterventions[patientNum].unshift(record);

    // Refresh the last-intervention timestamp in the collapsed row
    _cpUpdatePatientRowIntervention(patientNum, record);
    cpCloseIntervention();
    // Show brief success toast if available
    if (typeof showToast === 'function') showToast('Intervention logged.', 'success');
  } catch (err) {
    console.error('[ATLAS] Intervention save error:', err);
    const errEl = document.getElementById('cp-intv-err');
    if (errEl) { errEl.textContent = 'Save failed. Check your connection.'; errEl.style.display = 'block'; }
  }
}

function _cpUpdatePatientRowIntervention(patientNum, record) {
  // Find the last-intervention cell in the patient row and update it
  const rows = document.querySelectorAll('[data-patient-num]');
  rows.forEach(row => {
    if (row.dataset.patientNum === String(patientNum)) {
      const intCell = row.querySelector('.cp-last-intv');
      if (intCell) {
        const typeLabel = {
          counseling:'Counseling', refill_sync:'Refill Sync', care_referral:'Care Referral',
          education:'Education', escalation:'Escalation', phone_followup:'Phone Follow-up',
          mtm_encounter:'MTM Encounter', other:'Other'
        }[record.type] || record.type;
        intCell.textContent = typeLabel + ' · ' + new Date(record.timestamp).toLocaleDateString();
        intCell.classList.add('cp-intv-fresh');
      }
    }
  });
}

// Load interventions for workspace on clinician dashboard init
async function _cpLoadInterventions() {
  const workspaceKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey');
  if (!workspaceKey) return;
  try {
    const db = window._atlasDb || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db) return;
    const safeWs = String(workspaceKey).replace(/[.#$\[\]]/g, '_');
    const snap = await db.ref(`interventions/${safeWs}`).once('value');
    window._cpInterventions = snap.val() || {};
  } catch(e) { /* silent */ }
}

function _cpGetLastIntv(patientNum) {
  const intvs = (window._cpInterventions || {})[String(patientNum).replace(/[.#$\[\]]/g,'_')];
  if (!intvs) return '<span class="cp-no-intv">No interventions logged</span>';
  const entries = Object.values(intvs).sort((a,b) => b.timestamp - a.timestamp);
  if (!entries.length) return '<span class="cp-no-intv">No interventions logged</span>';
  const last = entries[0];
  const label = {counseling:'Counseling',refill_sync:'Refill Sync',care_referral:'Care Referral',education:'Education',escalation:'Escalation',phone_followup:'Phone Follow-up',mtm_encounter:'MTM Encounter',other:'Other'}[last.type] || last.type;
  return label + ' · ' + new Date(last.timestamp).toLocaleDateString();
}

function _cpRenderIntvHistory(patientNum) {
  const intvs = (window._cpInterventions || {})[String(patientNum).replace(/[.#$\[\]]/g,'_')];
  if (!intvs) return '';
  const entries = Object.values(intvs).sort((a,b) => b.timestamp - a.timestamp).slice(0,5);
  if (!entries.length) return '';
  return '<div class="cp-intv-hist-title">Recent Interventions</div>' + entries.map(e => {
    const label = {counseling:'Counseling',refill_sync:'Refill Sync',care_referral:'Care Referral',education:'Education',escalation:'Escalation',phone_followup:'Phone Follow-up',mtm_encounter:'MTM Encounter',other:'Other'}[e.type] || e.type;
    return `<div class="cp-intv-hist-row"><span class="cp-intv-hist-type">${label}</span><span class="cp-intv-hist-date">${new Date(e.timestamp).toLocaleDateString()}</span>${e.note ? `<p class="cp-intv-hist-note">${e.note}</p>` : ''}</div>`;
  }).join('');
}

window.cpOpenIntervention = cpOpenIntervention;
window.cpCloseIntervention = cpCloseIntervention;
window.cpSaveIntervention = cpSaveIntervention;
window._cpGetLastIntv = _cpGetLastIntv;
window._cpRenderIntvHistory = _cpRenderIntvHistory;

// ── C2: Care Summary Print Layout ─────────────────────────────────────────
function cpPrintSummary(patientNum) {
  // Gather patient data from cached cohort arrays
  const mmRec = (window._mmCohort || window._mmasData || []).find(r => String(r.patient_number) === String(patientNum));
  const peRec = (window._peaCohort || window._peacsData || []).find(r => String(r.patient_number) === String(patientNum));
  const intvs = (window._cpInterventions || {})[String(patientNum).replace(/[.#$\[\]]/g,'_')];
  const intvEntries = intvs ? Object.values(intvs).sort((a,b) => b.timestamp - a.timestamp).slice(0,3) : [];

  const score = mmRec ? (mmRec.total_score || mmRec.score || '—') : '—';
  const scoreNum = parseFloat(score);
  const scoreBand = scoreNum >= 6 ? 'High Adherence' : scoreNum >= 4 ? 'Moderate Adherence' : scoreNum < 4 ? 'Low Adherence' : '—';
  const scoreColor = scoreNum >= 6 ? '#10b981' : scoreNum >= 4 ? '#f59e0b' : '#ef4444';

  const condition = mmRec?.condition || mmRec?.primary_condition || '—';
  const medications = mmRec?.medications || mmRec?.med_count || '—';
  const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const wsKey = window._currentWorkspaceKey || sessionStorage.getItem('_wsKey') || 'ATLAS';

  const peSection = peRec ? `
    <h3>PEACS — Adherence Trajectory</h3>
    <table class="cs-table">
      <tr><th>Domain</th><th>Score</th></tr>
      <tr><td>Baseline Adherence</td><td>${peRec.baseline_score || peRec.b_score || '—'}</td></tr>
      <tr><td>Movement (Change)</td><td>${peRec.movement_score || peRec.m_score || '—'}</td></tr>
      <tr><td>Strata (Context)</td><td>${peRec.strata_score || peRec.s_score || '—'}</td></tr>
      <tr><td>PE Composite</td><td><strong>${peRec.pe_score || peRec.composite || '—'}</strong></td></tr>
    </table>` : '<p class="cs-na">PEACS assessment not yet completed for this patient.</p>';

  const intvSection = intvEntries.length ? `
    <h3>Recent Interventions</h3>
    <table class="cs-table">
      <tr><th>Date</th><th>Type</th><th>Note</th></tr>
      ${intvEntries.map(e => {
        const label = {counseling:'Counseling',refill_sync:'Refill Sync',care_referral:'Care Referral',education:'Education',escalation:'Escalation',phone_followup:'Phone Follow-up',mtm_encounter:'MTM Encounter',other:'Other'}[e.type] || e.type;
        return `<tr><td>${new Date(e.timestamp).toLocaleDateString()}</td><td>${label}</td><td>${e.note || '—'}</td></tr>`;
      }).join('')}
    </table>` : '<p class="cs-na">No interventions logged for this patient.</p>';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Care Summary — Patient ${patientNum}</title>
  <style>
    body{font-family:'Arial',sans-serif;font-size:11pt;max-width:7.5in;margin:.75in auto;color:#111;line-height:1.6}
    .cs-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:.6rem;margin-bottom:1.2rem}
    .cs-logo{font-size:14pt;font-weight:bold;letter-spacing:.08em}
    .cs-meta{font-size:9pt;color:#555;text-align:right}
    .cs-score-band{display:inline-block;padding:.3rem .8rem;border-radius:4px;font-weight:bold;font-size:13pt;color:#fff;background:${scoreColor}}
    h2{font-size:13pt;margin:1.2rem 0 .4rem;border-bottom:1px solid #ddd;padding-bottom:.2rem}
    h3{font-size:11pt;margin:.9rem 0 .3rem;color:#333}
    .cs-table{width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:.8rem}
    .cs-table th{background:#eee;border:1px solid #ccc;padding:.3rem .5rem;text-align:left;font-weight:600}
    .cs-table td{border:1px solid #ccc;padding:.3rem .5rem}
    .cs-na{font-style:italic;color:#888;font-size:10pt}
    .cs-sig{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:2rem;padding-top:1rem;border-top:1px solid #333}
    .cs-sig-block{border-top:1px solid #555;padding-top:.3rem;font-size:9pt;color:#555}
    .cs-confidential{font-size:8pt;color:#999;text-align:center;margin-top:1.5rem}
    @media print{body{margin:.5in}}
  </style></head><body>
  <div class="cs-header">
    <div>
      <div class="cs-logo">ATLAS</div>
      <div style="font-size:9pt;color:#555">Adherence Cartography — Care Summary</div>
    </div>
    <div class="cs-meta">
      Generated: ${today}<br>
      Workspace: ${wsKey}<br>
      Patient ID: ${patientNum}
    </div>
  </div>

  <h2>Patient Overview</h2>
  <table class="cs-table">
    <tr><th>Patient ID</th><td>${patientNum}</td><th>Assessment Date</th><td>${mmRec?.submission_date || mmRec?.date || '—'}</td></tr>
    <tr><th>Primary Condition</th><td>${condition}</td><th>Medications</th><td>${medications}</td></tr>
    <tr><th>MMAS-8 Score</th><td><span class="cs-score-band">${score}</span></td><th>Adherence Band</th><td>${scoreBand}</td></tr>
  </table>

  <h2>MMAS-8 Item Responses</h2>
  ${mmRec ? `<table class="cs-table">
    <tr><th>#</th><th>Question</th><th>Response</th></tr>
    <tr><td>1</td><td>Do you sometimes forget to take your medication?</td><td>${mmRec.q1 ?? '—'}</td></tr>
    <tr><td>2</td><td>Over the past 2 weeks, were there days when you did not take your medication?</td><td>${mmRec.q2 ?? '—'}</td></tr>
    <tr><td>3</td><td>Did you ever cut back or stop without telling your doctor?</td><td>${mmRec.q3 ?? '—'}</td></tr>
    <tr><td>4</td><td>When traveling or away, did you sometimes forget your medication?</td><td>${mmRec.q4 ?? '—'}</td></tr>
    <tr><td>5</td><td>Did you take all your medication yesterday?</td><td>${mmRec.q5 ?? '—'}</td></tr>
    <tr><td>6</td><td>Did you stop when you felt your condition was under control?</td><td>${mmRec.q6 ?? '—'}</td></tr>
    <tr><td>7</td><td>Do you feel hassled about sticking to your regimen?</td><td>${mmRec.q7 ?? '—'}</td></tr>
    <tr><td>8</td><td>How often do you have difficulty remembering to take your medications?</td><td>${mmRec.q8 ?? '—'}</td></tr>
  </table>` : '<p class="cs-na">MMAS-8 record not found for this patient.</p>'}

  <h2>PEACS Trajectory</h2>
  ${peSection}

  <h2>Interventions</h2>
  ${intvSection}

  <div class="cs-sig">
    <div class="cs-sig-block">Clinician Name<br><br>&nbsp;<br>&nbsp;</div>
    <div class="cs-sig-block">Signature<br><br>&nbsp;<br>&nbsp;</div>
    <div class="cs-sig-block">Date<br><br>${today}<br>&nbsp;</div>
  </div>
  <div class="cs-confidential">CONFIDENTIAL — For clinical use only. Contains adherence screening data. Not for distribution without patient consent.</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 700); }
}
window.cpPrintSummary = cpPrintSummary;

// ── C3: Export Mode Toggle ────────────────────────────────────────────────
let _cpExportMode = 'research';
function cpSetExportMode(mode) {
  _cpExportMode = mode;
  document.getElementById('cp-exp-research')?.classList.toggle('active', mode === 'research');
  document.getElementById('cp-exp-clinical')?.classList.toggle('active', mode === 'clinical');
  const note = document.getElementById('cp-exp-mode-note');
  if (note) note.textContent = mode === 'clinical'
    ? 'Clinical export uses plain English column headers for clinical documentation.'
    : 'Research export uses instrument variable codes (MMAS_Q1_ForgetMedication, etc.)';
}
function cpTriggerExport(data, filename) {
  if (_cpExportMode === 'clinical') { exportClinicalCSV(data, filename); }
  else if (typeof exportCSV === 'function') { exportCSV(data, filename); }
  else if (typeof exportInstitutionCSV === 'function') { exportInstitutionCSV(); }
}
window.cpSetExportMode = cpSetExportMode;
window.cpTriggerExport = cpTriggerExport;

