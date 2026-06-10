// ── End ATLAS v8.6 Institution Research Modules ──────────────────────────────

/**
 * Renders the Study Module panel: populates metadata fields, enrollment progress bars,
 * protocol timeline, LTFU/deviation tables, and the site activation tracker.
 * Reads from window.studyConfig and window._cohortData.
 * @returns {void}
 */
function renderStudyModule() {
  // Metadata
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('study-meta-name', studyConfig.name);
  set('study-meta-irb', studyConfig.irb);
  set('study-meta-sponsor', studyConfig.sponsor);
  set('study-meta-protocol', studyConfig.protocol);
  set('study-meta-start', studyConfig.start ? new Date(studyConfig.start).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'}) : '');
  set('study-meta-lock', studyConfig.lock ? new Date(studyConfig.lock).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'}) : '');

  // Last-modified banner
  if (studyConfig.last_modified_at) {
    const dt = new Date(studyConfig.last_modified_at).toLocaleString();
    const by = studyConfig.last_modified_by || 'unknown';
    const modEl = document.getElementById('study-config-last-modified');
    if (modEl) {
      modEl.textContent = `Last modified: ${dt} · by ${by}`;
      modEl.style.display = 'block';
    }
  }

  // Enrollment
  const cohortData = window._cohortData || [];
  const siteMap = {};
  cohortData.forEach(p => {
    const site = p.institution_code || p.siteKey || 'Unknown';
    if (!siteMap[site]) siteMap[site] = 0;
    siteMap[site]++;
  });
  const total = cohortData.length;
  const target = studyConfig.target || 500;
  const pct = Math.min(100, Math.round((total / target) * 100));
  const te = document.getElementById('study-enroll-total'); if (te) te.textContent = total;
  const tg = document.getElementById('study-enroll-target'); if (tg) tg.textContent = target;
  const tp = document.getElementById('study-enroll-pct'); if (tp) tp.textContent = pct + '%';
  const bar = document.getElementById('study-enroll-bar'); if (bar) { bar.style.width = pct + '%'; if (pct >= 100) bar.classList.add('complete'); }

  const rowsEl = document.getElementById('study-enrollment-rows');
  if (rowsEl) {
    const siteTarget = Math.round(target / Math.max(Object.keys(siteMap).length, 1));
    rowsEl.innerHTML = Object.entries(siteMap).sort((a,b) => b[1]-a[1]).map(([site, n]) => {
      const sp = Math.min(100, Math.round((n / siteTarget) * 100));
      return `<div class="enrollment-site-row">
        <span class="enrollment-site-name">${site}</span>
        <div class="enrollment-bar-wrap"><div class="enrollment-bar-fill${sp>=100?' complete':''}" style="width:${sp}%;"></div></div>
        <span class="enrollment-num">${n}</span>
        <span class="enrollment-num">${siteTarget}</span>
        <span class="enrollment-pct">${sp}%</span>
      </div>`;
    }).join('') || '<p style="font-size:0.82rem;color:#9ca3af;padding:12px 0;">No enrollment data available.</p>';
  }

  // Timeline
  const tbody = document.getElementById('study-timeline-body');
  if (tbody && studyConfig.start) {
    const startDate = new Date(studyConfig.start);
    const now = new Date();
    const rows = [{ label: 'Baseline', dayOffset: 0, window: 14, type: 'baseline' }];
    (studyConfig.visits || [30,90,180]).forEach(d => rows.push({ label: `Day ${d} Follow-up`, dayOffset: d, window: studyConfig.window || 7, type: 'followup' }));
    if (studyConfig.lock) rows.push({ label: 'Data Lock', dayOffset: Math.round((new Date(studyConfig.lock)-startDate)/86400000), window: 0, type: 'datalock' });

    tbody.innerHTML = rows.map(r => {
      const windowStart = new Date(startDate.getTime() + r.dayOffset * 86400000);
      const windowEnd = new Date(windowStart.getTime() + r.window * 86400000);
      const isOpen = now >= windowStart && now <= windowEnd;
      const isPast = now > windowEnd;
      const statusLabel = r.type === 'datalock' ? 'Fixed' : (isOpen ? 'Open' : (isPast ? 'Closed' : 'Pending'));
      const barClass = r.type === 'datalock' ? 'datalock' : (isOpen ? 'open' : (isPast ? r.type : 'pending'));
      const nCollected = r.type === 'baseline' ? total : '—';
      const dateStr = windowStart.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) + (r.window > 0 ? ` – ${windowEnd.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}` : '');
      return `<tr>
        <td style="font-weight:600;">${_esc(r.label)}</td>
        <td><div class="timeline-bar ${barClass}">${dateStr}</div></td>
        <td><span style="font-size:0.78rem;font-weight:700;color:${isOpen?'#10b981':(isPast?'#6b7280':'#9ca3af')}">${statusLabel}</span></td>
        <td style="text-align:center;">${nCollected}</td>
      </tr>`;
    }).join('');
  } else if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#9ca3af;font-size:0.82rem;padding:12px;">Configure study start date to view timeline.</td></tr>';
  }

  // LTFU
  renderLTFU(cohortData);
  renderDeviations(cohortData);

  // Site Activation Tracker
  renderSiteTracker();

  // ATLAS Study Registry panel
  renderStudyRegistryPanel();
}

// ── ATLAS Study Registry Panel (researcher-facing) ───────────────────────────
// Shows the researcher their ATLAS registry entry, ATLAS Study ID to share with
// participants, linked record count, and sequential analysis summary.

async function renderStudyRegistryPanel() {
  const container = document.getElementById('study-registry-panel');
  if (!container) return;

  container.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.80rem;color:var(--dim);padding:12px 0;">Loading registry…</div>`;

  try {
    const db = (typeof firebase !== 'undefined') ? firebase.database() : null;
    if (!db) { container.innerHTML = ''; return; }

    // Look up studies matching this workspace key or PI name from studyConfig
    const wsKey = (typeof currentWorkspace !== 'undefined') ? currentWorkspace : null;
    const snap  = await db.ref('research_studies').once('value');
    const all   = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,_key:k})) : [];

    // Match by workspace_key field or PI match or IRB match from studyConfig
    const matched = all.filter(s =>
      (wsKey && s.workspace_key === wsKey) ||
      (studyConfig.irb  && s.irb  === studyConfig.irb) ||
      (studyConfig.name && s.title === studyConfig.name)
    );

    const cohortData   = window._cohortData || [];
    const mmasRecs     = cohortData.filter(r => r.map_q1 === undefined);
    const mapRecs      = cohortData.filter(r => r.map_q1 !== undefined);

    const statusCol = { planning:'#9ca3af', active:'#10b981', analysis:'#38bdf8', published:'#d4a843', closed:'rgba(239,68,68,0.5)' };

    if (!matched.length) {
      container.innerHTML = `
      <div style="border:1px solid rgba(212,168,67,0.2);border-radius:10px;padding:18px 20px;background:rgba(212,168,67,0.03);margin-top:18px;">
        <div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:8px;">ATLAS Meta-Analysis Registry</div>
        <div style="font-size:0.88rem;color:var(--dim);margin-bottom:12px;line-height:1.6;">
          Your study is not yet listed in the ATLAS registry. Pre-registering gives your study an
          <strong style="color:var(--text);">ATLAS Study ID</strong> — participants enter this on the assessment form to automatically
          link their records to your study. It also adds your findings to the platform's meta-analysis forest plot.
        </div>
        <div style="font-size:0.82rem;color:var(--dim);margin-bottom:12px;">
          To register, open <strong style="color:var(--text);">ATLAS Mission Control → Research → Study Registry</strong>
          and click <strong style="color:var(--text);">Pre-Register Study</strong>.
        </div>
        <div style="font-size:0.76rem;padding:10px 14px;background:rgba(46,201,138,0.06);border:1px solid rgba(46,201,138,0.18);border-radius:7px;color:rgba(46,201,138,0.8);line-height:1.7;">
          <strong>Why register?</strong> Pre-registration timestamps your hypothesis before data collection, combats publication bias,
          enables sequential analysis monitoring, and qualifies your study for the ATLAS living meta-analysis.
        </div>
      </div>`;
      return;
    }

    // Render each matched study
    container.innerHTML = `
    <div style="margin-top:18px;">
      <div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,168,67,0.7);margin-bottom:12px;">ATLAS Meta-Analysis Registry</div>
      ${matched.map(s => {
        const col = statusCol[s.status] || '#9ca3af';
        const allRecs = [...mmasRecs, ...mapRecs];
        const linked  = s.atlas_id ? allRecs.filter(r => r.study_id === s.atlas_id) : [];
        const n       = linked.length;
        const scores  = linked.map(r => r.map_q1!==undefined ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3)*8 : +r.score||0);
        const mean    = n ? (scores.reduce((a,b)=>a+b,0)/n).toFixed(3) : null;
        const preregDate = s.prereg_locked_at ? new Date(s.prereg_locked_at).toLocaleDateString() : null;
        return `
        <div style="border:1px solid rgba(255,255,255,0.08);border-left:3px solid ${col};border-radius:8px;padding:16px 18px;margin-bottom:12px;background:rgba(255,255,255,0.02);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
            <div>
              <div style="font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:2px;">${_esc(s.title||'Untitled')}</div>
              <div style="font-size:0.76rem;color:var(--dim);">${_esc(s.pi||'—')} · ${_esc(s.institution||'—')}</div>
            </div>
            <span style="font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:2px 8px;border:1px solid ${col};border-radius:3px;color:${col};white-space:nowrap;">${s.status||'—'}</span>
          </div>

          ${s.atlas_id ? `
          <div style="padding:10px 14px;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.2);border-radius:7px;margin-bottom:10px;">
            <div style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(212,168,67,0.6);margin-bottom:4px;">ATLAS Study ID · share with participants</div>
            <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;color:rgba(212,168,67,0.9);letter-spacing:0.08em;cursor:pointer;"
              onclick="navigator.clipboard?.writeText('${_esc(s.atlas_id)}').then(()=>showToast&&showToast('ATLAS ID copied',1500))"
              title="Click to copy">${_esc(s.atlas_id)} ⧉</div>
            <div style="font-size:0.72rem;color:var(--dim);margin-top:3px;">Participants enter this in the Study ID field on the assessment form.</div>
          </div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div style="padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:5px;border:1px solid rgba(255,255,255,0.06);">
              <div style="font-family:var(--font-mono);font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Linked Records</div>
              <div style="font-size:1.0rem;font-weight:700;color:#38bdf8;margin-top:2px;">${n}</div>
            </div>
            <div style="padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:5px;border:1px solid rgba(255,255,255,0.06);">
              <div style="font-family:var(--font-mono);font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);">Mean Score</div>
              <div style="font-size:1.0rem;font-weight:700;color:var(--text);margin-top:2px;">${mean||'—'}</div>
            </div>
          </div>

          <div style="display:flex;gap:10px;font-size:0.74rem;color:var(--dim);flex-wrap:wrap;">
            ${s.irb ? `<span>IRB: ${_esc(s.irb)}</span>` : ''}
            ${s.clinicaltrials_id ? `<span>CT.gov: ${_esc(s.clinicaltrials_id)}</span>` : ''}
            ${preregDate ? `<span style="color:#10b981;">✓ Pre-registered ${preregDate}</span>` : `<span style="color:#f97316;">Not yet pre-registered</span>`}
            ${s.null_result ? `<span style="color:#f97316;">● Null result flagged</span>` : ''}
            ${s.doi ? `<span style="color:rgba(212,168,67,0.8);">Published · ${_esc(s.doi)}</span>` : ''}
          </div>
          ${(s.conditions||[]).length ? `
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">
            ${s.conditions.map(c=>`<span style="font-size:0.68rem;padding:2px 7px;background:rgba(46,201,138,0.07);border:1px solid rgba(46,201,138,0.18);border-radius:3px;color:rgba(46,201,138,0.8);">${_esc(c)}</span>`).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  } catch(e) {
    container.innerHTML = '';
  }
}

// ── Site Activation Tracker ───────────────────────────

let _studySites = JSON.parse(localStorage.getItem('atlas_study_sites') || '[]');
let _siteTrackerMap = null;

/** Opens the Add Site modal and clears all form fields. @returns {void} */
function openAddSiteModal() {
  ['name','city','country','lat','lng','pi','target'].forEach(f => {
    const el = document.getElementById(`site-form-${f}`); if (el) el.value = '';
  });
  const activEl = document.getElementById('site-form-activated'); if (activEl) activEl.value = '';
  const statusEl = document.getElementById('site-form-status');
  if (statusEl) statusEl.value = 'planned';
  const modal = document.getElementById('add-site-modal');
  if (modal) { modal.style.display = 'flex'; if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

/** Closes the Add Site modal. @returns {void} */
function closeAddSiteModal() {
  const modal = document.getElementById('add-site-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * Reads the Add Site form and appends the new site to _studySites, persisting to localStorage.
 * @returns {void}
 */
function saveNewSite() {
  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const site = {
    id: 'SITE-' + Date.now(),
    name: get('site-form-name') || 'Unnamed Site',
    city: get('site-form-city'),
    country: get('site-form-country'),
    lat: parseFloat(get('site-form-lat')) || null,
    lng: parseFloat(get('site-form-lng')) || null,
    pi: get('site-form-pi'),
    target: parseInt(get('site-form-target')) || 0,
    status: get('site-form-status') || 'planned',
    activatedDate: get('site-form-activated') || null
  };
  _studySites.push(site);
  localStorage.setItem('atlas_study_sites', JSON.stringify(_studySites));
  closeAddSiteModal();
  renderSiteTracker();
}

/** Renders both the site tracker table and map. @returns {void} */
function renderSiteTracker() {
  renderSiteTrackerTable();
  renderSiteTrackerMap();
}

/** Renders the site activation tracker table, cross-referencing _studySites with cohort data. @returns {void} */
function renderSiteTrackerTable() {
  const tbody = document.getElementById('site-tracker-tbody');
  if (!tbody) return;
  const cohortData = window._cohortData || allRecords || [];

  if (_studySites.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#9ca3af;font-size:0.82rem;padding:14px;text-align:center;">No sites configured. Click "Add Site" to begin.</td></tr>';
    return;
  }

  const statusColors = { active:'#10b981', enrolled:'#f59e0b', pending:'#ef4444', planned:'#d1d5db' };
  const statusLabels = { active:'Active', enrolled:'Enrolled', pending:'Pending', planned:'Planned' };

  tbody.innerHTML = _studySites.map(site => {
    const enrolled = cohortData.filter(p => (p.institution_code||p.siteKey||'').includes(site.id) || (p.city||'').toLowerCase() === (site.city||'').toLowerCase()).length;
    const color = statusColors[site.status] || '#d1d5db';
    const label = statusLabels[site.status] || site.status;
    const activDate = site.activatedDate ? new Date(site.activatedDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    return `<tr>
      <td style="font-weight:600;">${site.name}</td>
      <td style="color:#6b7280;">${[site.city,site.country].filter(Boolean).join(', ')}</td>
      <td style="color:#6b7280;">${site.pi||'—'}</td>
      <td><span class="site-status-dot ${site.status}"></span>${label}</td>
      <td style="text-align:center;font-weight:700;">${enrolled}</td>
      <td style="text-align:center;">${site.target||'—'}</td>
      <td style="color:#6b7280;">${activDate}</td>
    </tr>`;
  }).join('');
}

/** Initialises or updates the Mapbox map showing site activation markers. @returns {void} */
function renderSiteTrackerMap() {
  const container = document.getElementById('site-tracker-map-container');
  if (!container || !window.mapboxgl) return;
  if (!mapboxgl.accessToken) {
    mapboxgl.accessToken = ATLAS_MAPBOX_TOKEN;
  }

  if (_siteTrackerMap) {
    updateSiteTrackerMarkers();
    return;
  }

  try {
    _siteTrackerMap = new mapboxgl.Map({
      container: 'site-tracker-map-container',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [10, 25],
      zoom: 1.4,
      projection: 'mercator'
    });
    _siteTrackerMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    _siteTrackerMap.on('load', updateSiteTrackerMarkers);
  } catch(e) {
    container.innerHTML = '<div style="padding:20px;color:#9ca3af;text-align:center;font-size:0.82rem;">Map unavailable. Sites listed in table above.</div>';
  }
}

/** Removes all existing site marker elements and re-adds them from _studySites. @returns {void} */
function updateSiteTrackerMarkers() {
  if (!_siteTrackerMap) return;
  const statusColors = { active:'#10b981', enrolled:'#f59e0b', pending:'#ef4444', planned:'#9ca3af' };

  // Remove existing markers
  document.querySelectorAll('.site-tracker-marker').forEach(el => el.remove());

  _studySites.forEach(site => {
    if (!site.lat || !site.lng) return;
    const color = statusColors[site.status] || '#9ca3af';
    const el = document.createElement('div');
    el.className = 'site-tracker-marker';
    el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;`;
    el.title = `${site.name} — ${site.status}`;

    new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([site.lng, site.lat])
      .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(
        `<div style="font-family:inherit;font-size:13px;"><strong>${site.name}</strong><br>${site.city||''}, ${site.country||''}<br><span style="color:${color};font-weight:700;">${site.status.charAt(0).toUpperCase()+site.status.slice(1)}</span></div>`
      ))
      .addTo(_siteTrackerMap);
  });

  // Fit map to markers if any have coordinates
  const coordSites = _studySites.filter(s => s.lat && s.lng);
  if (coordSites.length > 0 && _siteTrackerMap.loaded()) {
    const bounds = coordSites.reduce((b, s) => b.extend([s.lng, s.lat]), new mapboxgl.LngLatBounds([coordSites[0].lng, coordSites[0].lat], [coordSites[0].lng, coordSites[0].lat]));
    if (coordSites.length > 1) _siteTrackerMap.fitBounds(bounds, { padding: 60, maxZoom: 8 });
  }
}

function renderLTFU(cohortData) {
  if (!studyConfig.start || !studyConfig.visits) return;
  const startDate = new Date(studyConfig.start);
  const now = new Date();
  const win = (studyConfig.window || 7) * 86400000;
  const lookahead = 7 * 86400000;
  let missed = [], due = [], ok = [];

  cohortData.forEach(p => {
    const enrollDate = p.enrollDate ? new Date(p.enrollDate) : (p.timestamp ? new Date(p.timestamp) : null);
    if (!enrollDate) return;
    studyConfig.visits.forEach(dayOffset => {
      const visitDue = new Date(enrollDate.getTime() + dayOffset * 86400000);
      const visitClose = new Date(visitDue.getTime() + win);
      const hasVisit = (cohortData.filter(x => x.patient_number === p.patient_number).length > 1);
      if (now > visitClose && !hasVisit) {
        missed.push({ id: p.patient_number || p.userId || '—', site: p.institution_code || '—', enrolled: enrollDate.toLocaleDateString(), due: visitDue.toLocaleDateString(), closes: visitClose.toLocaleDateString() });
      } else if (now < visitClose && (visitClose - now) < lookahead) {
        due.push({ id: p.patient_number || p.userId || '—', site: p.institution_code || '—', enrolled: enrollDate.toLocaleDateString(), due: visitDue.toLocaleDateString(), closes: visitClose.toLocaleDateString() });
      } else if (now >= visitDue && now <= visitClose) {
        ok.push({ id: p.patient_number || p.userId || '—', site: p.institution_code || '—', enrolled: enrollDate.toLocaleDateString(), due: visitDue.toLocaleDateString(), closes: visitClose.toLocaleDateString() });
      }
    });
  });

  const mc = document.getElementById('ltfu-missed-count'); if (mc) mc.textContent = missed.length;
  const dc = document.getElementById('ltfu-due-count'); if (dc) dc.textContent = due.length;
  const oc = document.getElementById('ltfu-ok-count'); if (oc) oc.textContent = ok.length;

  const tb = document.getElementById('ltfu-table-body');
  if (tb) {
    const allRows = [
      ...missed.map(r => ({ ...r, status: 'missed', label: 'Missed' })),
      ...due.map(r => ({ ...r, status: 'due', label: 'Due Soon' })),
      ...ok.slice(0, 20).map(r => ({ ...r, status: 'ok', label: 'On Track' }))
    ];
    tb.innerHTML = allRows.length ? allRows.map(r =>
      `<tr><td>${_esc(r.id)}</td><td>${_esc(r.site)}</td><td>${_esc(r.enrolled)}</td><td>${_esc(r.due)}</td><td>${_esc(r.closes)}</td><td class="ltfu-status-${_esc(r.status)}">${_esc(r.label)}</td></tr>`
    ).join('') : '<tr><td colspan="6" style="color:#9ca3af;font-size:0.82rem;padding:12px;">No LTFU records. Configure study start date and enrollment data.</td></tr>';
  }
}

function renderDeviations(cohortData) {
  if (!studyConfig.start || !studyConfig.visits) return;
  const deviations = [];
  const win = (studyConfig.window || 7) * 86400000;

  cohortData.forEach(p => {
    const enrollDate = p.enrollDate ? new Date(p.enrollDate) : (p.timestamp ? new Date(p.timestamp) : null);
    if (!enrollDate || !p.timestamp) return;
    const actualDate = new Date(p.timestamp);
    studyConfig.visits.forEach((dayOffset, i) => {
      if (i === 0) return; // skip baseline
      const expectedDate = new Date(enrollDate.getTime() + dayOffset * 86400000);
      const diff = Math.round((actualDate - expectedDate) / 86400000);
      const absDiff = Math.abs(diff);
      if (absDiff > 7) {
        deviations.push({
          id: p.patient_number || p.userId || '—',
          site: p.institution_code || '—',
          visitType: `Day ${dayOffset} Follow-up`,
          expected: expectedDate.toLocaleDateString(),
          actual: actualDate.toLocaleDateString(),
          daysOff: diff > 0 ? `+${diff}` : `${diff}`,
          severity: absDiff > 14 ? 'major' : 'minor'
        });
      }
    });
  });

  const tb = document.getElementById('deviation-table-body');
  if (tb) {
    tb.innerHTML = deviations.length ? deviations.map(d =>
      `<tr class="deviation-${d.severity}"><td>${d.id}</td><td>${d.site}</td><td>${d.visitType}</td><td>${d.expected}</td><td>${d.actual}</td><td>${d.daysOff}d</td><td><span class="deviation-badge ${d.severity}">${d.severity}</span></td></tr>`
    ).join('') : '<tr><td colspan="7" style="color:#9ca3af;font-size:0.82rem;padding:12px;">No protocol deviations detected.</td></tr>';
  }
}

function exportStudyEnrollmentCSV() {
  const cohortData = window._cohortData || [];
  const rows = [['patient_number','site','score','pattern','condition','country','timestamp']];
  cohortData.forEach(p => rows.push([p.patient_number||'',p.institution_code||'',p.score||'',p.pattern||'',p.condition||'',p.country||'',p.timestamp||'']));
  _downloadCSV(rows, 'atlas_enrollment_' + new Date().toISOString().slice(0,10) + '.csv');
}

function exportLTFUReport() {
  const tb = document.getElementById('ltfu-table-body');
  if (!tb) return;
  const rows = [['patient_id','site','enrolled','visit_due','window_closes','status']];
  tb.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 6) rows.push(Array.from(tds).map(td => td.textContent.trim()));
  });
  _downloadCSV(rows, 'atlas_ltfu_' + new Date().toISOString().slice(0,10) + '.csv');
}

function exportDeviationLog() {
  const tb = document.getElementById('deviation-table-body');
  if (!tb) return;
  const rows = [['patient_id','site','visit_type','expected','actual','days_off','severity']];
  tb.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 7) rows.push(Array.from(tds).map(td => td.textContent.trim()));
  });
  _downloadCSV(rows, 'atlas_deviations_' + new Date().toISOString().slice(0,10) + '.csv');
}

function exportIRBSummary() {
  const cohortData = window._cohortData || [];
  const lines = [
    `ATLAS Clinical Study — IRB Progress Summary`,
    `Generated: ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}`,
    ``,
    `Study Name: ${studyConfig.name || '—'}`,
    `IRB Number: ${studyConfig.irb || '—'}`,
    `Sponsor: ${studyConfig.sponsor || '—'}`,
    `Protocol Version: ${studyConfig.protocol || '—'}`,
    `Study Start: ${studyConfig.start || '—'}`,
    `Data Lock: ${studyConfig.lock || '—'}`,
    ``,
    `ENROLLMENT`,
    `Total Enrolled: ${cohortData.length} of ${studyConfig.target || 500} (${Math.round(cohortData.length/(studyConfig.target||500)*100)}%)`,
    ``,
    `LTFU SUMMARY`,
    `Missed Window: ${document.getElementById('ltfu-missed-count')?.textContent || 0}`,
    `Due in 7 Days: ${document.getElementById('ltfu-due-count')?.textContent || 0}`,
    `On Track: ${document.getElementById('ltfu-ok-count')?.textContent || 0}`,
    ``,
    `PROTOCOL DEVIATIONS`,
    `Total Flagged: ${document.getElementById('deviation-table-body')?.querySelectorAll('tr').length || 0}`,
    ``,
    `Instrument: MAP (Multidimensional Adherence Parameters) — Morisky, 2026`,
    `Platform: ATLAS — Adherence Inc.`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'atlas_irb_summary_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
}

// helper — reuse or define if not already present
function _downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Billing code sub-tab switcher ────────────────────────────────────────────
function switchBillCodeTab(tab) {
  document.querySelectorAll('.bill-code-tab').forEach(function(btn) {
    var active = btn.dataset.billTab === tab;
    btn.style.color            = active ? (tab === 'mtm' ? 'var(--mvmt)' : tab === 'ccm' ? 'var(--base)' : tab === 'rtm' ? 'var(--strata)' : tab === 'tcm' ? 'var(--pe)' : 'var(--text)') : 'var(--dim)';
    btn.style.borderBottomColor = active ? btn.style.color : 'transparent';
  });
  var panels = { mtm:'bill-panel-mtm', ccm:'bill-panel-ccm', rtm:'bill-panel-rtm', tcm:'bill-panel-tcm', summary:'bill-panel-summary' };
  Object.keys(panels).forEach(function(k) {
    var p = document.getElementById(panels[k]);
    if (p) p.style.display = k === tab ? '' : 'none';
  });
  if (tab === 'rtm') renderRTMPatientGrid();
  if (tab === 'summary') renderBillingSummary();
  if (tab === 'ccm') {
    var ml = document.getElementById('ccm-month-label');
    if (ml) ml.textContent = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  if (tab === 'rtm') {
    var rl = document.getElementById('rtm-month-label');
    if (rl) rl.textContent = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
}

// ── CCM time logger ──────────────────────────────────────────────────────────
var _ccmTimeLog = []; // [{ pid, minutes, activity, ts }]

function logCCMTime() {
  var pid  = (document.getElementById('ccm-patient-id')  || {}).value || '';
  var mins = parseInt((document.getElementById('ccm-minutes') || {}).value || '0', 10);
  var act  = (document.getElementById('ccm-activity') || {}).value || 'med_review';
  if (!pid || !mins || mins < 1) { showToast('Enter a patient ID and valid minutes before logging.', 3500); return; }
  var actLabels = { med_review:'Medication Review', care_plan:'Care Plan Update', adherence_counsel:'Adherence Counseling', care_coord:'Care Coordination', patient_contact:'Patient Contact', barrier_id:'Barrier Identification' };
  _ccmTimeLog.push({ pid: pid.toUpperCase(), minutes: mins, activity: actLabels[act] || act, ts: new Date() });
  renderCCMTimeTable();
  updateBillingMonthlyWidget();
  document.getElementById('ccm-patient-id').value = '';
  document.getElementById('ccm-minutes').value    = '';
  showToast('CCM time logged: ' + mins + ' min for ' + pid.toUpperCase(), 2500);
}

function renderCCMTimeTable() {
  var el = document.getElementById('ccm-time-table');
  if (!el) return;
  if (!_ccmTimeLog.length) { el.textContent = 'No CCM time logged this month.'; return; }
  // Group by patient
  var byPID = {};
  _ccmTimeLog.forEach(function(e) { byPID[e.pid] = (byPID[e.pid] || 0) + e.minutes; });
  var html = '<table style="width:100%;border-collapse:collapse;font-size:0.74rem;">';
  html += '<tr style="color:var(--dim);border-bottom:1px solid var(--border);"><th style="text-align:left;padding:5px 8px;">Patient</th><th style="text-align:right;padding:5px 8px;">Total Min</th><th style="text-align:right;padding:5px 8px;">Code Eligible</th><th style="text-align:right;padding:5px 8px;">Status</th></tr>';
  Object.keys(byPID).forEach(function(pid) {
    var total = byPID[pid];
    var code  = total >= 60 ? '99487 (Complex)' : total >= 30 ? '99491 (Provider)' : total >= 20 ? '99490 (Staff)' : 'Insufficient';
    var ok    = total >= 20;
    html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 8px;color:var(--text);">' + pid + '</td><td style="padding:6px 8px;text-align:right;color:var(--base);">' + total + '</td><td style="padding:6px 8px;text-align:right;color:var(--mvmt);">' + code + '</td><td style="padding:6px 8px;text-align:right;"><span style="color:' + (ok ? 'var(--strata)' : 'var(--dim)') + '">' + (ok ? '✓ Billable' : '⧖ Pending') + '</span></td></tr>';
  });
  html += '</table>';
  el.innerHTML = html;
}

// ── TCM discharge tracker ─────────────────────────────────────────────────────
var _tcmPatients = [];

function addTCMPatient() {
  var pid  = (document.getElementById('tcm-patient-id')      || {}).value || '';
  var date = (document.getElementById('tcm-discharge-date')  || {}).value || '';
  var code = (document.getElementById('tcm-complexity')      || {}).value || '99495';
  if (!pid || !date) { showToast('Enter patient ID and discharge date.', 3000); return; }
  var discharge = new Date(date);
  var now       = new Date();
  var daysOut   = Math.floor((now - discharge) / 86400000);
  var contactDue = new Date(discharge); contactDue.setDate(contactDue.getDate() + 2);
  var f2fDue     = new Date(discharge); f2fDue.setDate(f2fDue.getDate() + (code === '99496' ? 7 : 14));
  _tcmPatients.push({ pid: pid.toUpperCase(), discharge: discharge, code: code, contactDue: contactDue, f2fDue: f2fDue, daysOut: daysOut, added: now });
  renderTCMPatientList();
  document.getElementById('tcm-patient-id').value     = '';
  document.getElementById('tcm-discharge-date').value = '';
  showToast('TCM tracking started for ' + pid.toUpperCase(), 2500);
}

function renderTCMPatientList() {
  var el = document.getElementById('tcm-patient-list');
  if (!el) return;
  if (!_tcmPatients.length) { el.textContent = 'No discharge patients currently tracked.'; return; }
  var now = new Date();
  var html = '<table style="width:100%;border-collapse:collapse;font-size:0.74rem;">';
  html += '<tr style="color:var(--dim);border-bottom:1px solid var(--border);"><th style="text-align:left;padding:5px 8px;">Patient</th><th style="padding:5px 8px;">Code</th><th style="padding:5px 8px;">Discharge</th><th style="padding:5px 8px;">Contact Due</th><th style="padding:5px 8px;">F2F Due</th><th style="padding:5px 8px;">Status</th></tr>';
  _tcmPatients.forEach(function(p) {
    var contactOverdue = now > p.contactDue;
    var f2fOverdue     = now > p.f2fDue;
    var statusColor    = f2fOverdue ? 'var(--poor)' : contactOverdue ? 'var(--moderate)' : 'var(--strata)';
    var status         = f2fOverdue ? '⚠ F2F Overdue' : contactOverdue ? '! Contact Overdue' : '✓ On Track';
    html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 8px;color:var(--text);">' + p.pid + '</td><td style="padding:6px 8px;color:var(--pe);font-family:var(--font-mono);">' + p.code + '</td><td style="padding:6px 8px;">' + p.discharge.toLocaleDateString() + '</td><td style="padding:6px 8px;">' + p.contactDue.toLocaleDateString() + '</td><td style="padding:6px 8px;">' + p.f2fDue.toLocaleDateString() + '</td><td style="padding:6px 8px;"><span style="color:' + statusColor + '">' + status + '</span></td></tr>';
  });
  html += '</table>';
  el.innerHTML = html;
}

// ── RTM patient data-day grid ─────────────────────────────────────────────────
function renderRTMPatientGrid() {
  var el = document.getElementById('rtm-patient-grid');
  if (!el) return;
  if (!currentWorkspace || currentWorkspace === 'EXPLORER') { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim);font-family:var(--font-mono);font-size:0.76rem;grid-column:1/-1;">No workspace active.</div>'; return; }
  // Count unique submission days per patient in current month from loaded records
  var monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  var patientDays = {};
  try {
    var rows = (typeof allRecords !== 'undefined' ? allRecords : []);
    rows.forEach(function(r) {
      if (!r || !r.pid) return;
      var day = (r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : null);
      if (!day || !day.startsWith(monthKey)) return;
      if (!patientDays[r.pid]) patientDays[r.pid] = new Set();
      patientDays[r.pid].add(day);
    });
  } catch(e) {}
  var pids = Object.keys(patientDays);
  if (!pids.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim);font-family:var(--font-mono);font-size:0.76rem;grid-column:1/-1;">No RTM patients tracked this month.<br/>Patient data days are auto-counted from MMAS submissions.</div>'; return; }
  var html = '';
  pids.forEach(function(pid) {
    var days = patientDays[pid].size;
    var pct  = Math.min(100, Math.round(days / 16 * 100));
    var ok   = days >= 16;
    html += '<div style="background:var(--card);border:1px solid ' + (ok ? 'rgba(46,201,138,0.3)' : 'var(--border)') + ';border-radius:var(--r);padding:12px 14px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><span style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text);">' + pid + '</span><span style="font-family:var(--font-mono);font-size:0.80rem;color:' + (ok ? 'var(--strata)' : 'var(--base)') + ';">' + days + '/16d</span></div>'
      + '<div style="background:rgba(255,255,255,0.06);border-radius:4px;height:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (ok ? 'var(--strata)' : 'var(--base)') + ';border-radius:4px;transition:width 0.4s;"></div></div>'
      + '<div style="font-family:var(--font-mono);font-size:0.60rem;color:' + (ok ? 'var(--strata)' : 'var(--dim)') + ';margin-top:5px;">' + (ok ? '✓ 98976 Billable' : '⧖ Needs ' + (16 - days) + ' more days') + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
}

// ── Monthly billing summary renderer ─────────────────────────────────────────
function renderBillingSummary() {
  var sl = document.getElementById('summary-month-label');
  if (sl) sl.textContent = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  updateBillingMonthlyWidget();
  var kpis = document.getElementById('billing-summary-kpis');
  if (kpis) {
    var ccmBillable = _ccmTimeLog.reduce(function(acc, e) { acc[e.pid] = (acc[e.pid] || 0) + e.minutes; return acc; }, {});
    var ccmPts = Object.values(ccmBillable).filter(function(m) { return m >= 20; }).length;
    kpis.innerHTML = [
      ['MTM Encounters', (document.getElementById('bill-mo-mtm') || {}).textContent || '—', 'var(--mvmt)'],
      ['CCM Patients Billable', ccmPts || '—', 'var(--base)'],
      ['RTM Patients ≥16d', (document.getElementById('bill-mo-rtm') || {}).textContent || '—', 'var(--strata)'],
      ['Est. Monthly Revenue', (document.getElementById('bill-mo-est') || {}).textContent || '—', 'var(--pe)'],
    ].map(function(row) {
      return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:var(--r);padding:12px 14px;text-align:center;"><div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:500;color:' + row[2] + ';margin-bottom:3px;">' + row[1] + '</div><div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);">' + row[0] + '</div></div>';
    }).join('');
  }
}

function updateBillingMonthlyWidget() {
  // Rough revenue estimates from logged data
  var mtmCount = parseInt((document.getElementById('cpo-99605') || {}).textContent || '0', 10)
               + parseInt((document.getElementById('cpo-99606') || {}).textContent || '0', 10);
  var mtmEl = document.getElementById('bill-mo-mtm');
  if (mtmEl) mtmEl.textContent = mtmCount || '—';
  var ccmPts = Object.values(
    _ccmTimeLog.reduce(function(a, e) { a[e.pid] = (a[e.pid] || 0) + e.minutes; return a; }, {})
  ).filter(function(m) { return m >= 20; }).length;
  var ccmEl = document.getElementById('bill-mo-ccm');
  if (ccmEl) ccmEl.textContent = ccmPts || '—';
  var est = (mtmCount * 45) + (ccmPts * 62);
  var estEl = document.getElementById('bill-mo-est');
  if (estEl) estEl.textContent = est > 0 ? '$' + est.toLocaleString() : '—';
}

function exportBillingSummaryCSV() {
  if (!_ccmTimeLog.length && !_tcmPatients.length) { showToast('No billing data to export this month.', 3000); return; }
  var rows = [['Type','Patient ID','Code','Minutes/Days','Activity','Date']];
  _ccmTimeLog.forEach(function(e) { rows.push(['CCM', e.pid, '99490/99491', e.minutes, e.activity, e.ts.toLocaleDateString()]); });
  _tcmPatients.forEach(function(p) { rows.push(['TCM', p.pid, p.code, p.discharge.toLocaleDateString(), 'Post-Discharge', p.added.toLocaleDateString()]); });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'ATLAS_Billing_' + new Date().toISOString().slice(0,7) + '.csv';
  a.click();
}

function exportCMRDocument() {
  var role = (workspaceProfile && workspaceProfile.name) || 'Clinician';
  var date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  var text = 'COMPREHENSIVE MEDICATION REVIEW (CMR) SUMMARY\n';
  text += '==============================================\n';
  text += 'Provider: ' + role + '\n';
  text += 'Date: ' + date + '\n';
  text += 'Workspace: ' + (currentWorkspace || 'N/A') + '\n\n';
  text += 'DOCUMENTATION CHECKLIST (MTM — CPT 99605/99606/99607):\n';
  text += '  □ Patient consent on file\n';
  text += '  □ Current medication list reviewed\n';
  text += '  □ Drug therapy problems identified\n';
  text += '  □ Adherence barriers documented\n';
  text += '  □ Interventions recommended\n';
  text += '  □ Follow-up plan established\n';
  text += '  □ CMR summary sent to patient\n';
  text += '  □ Session time ≥15 min logged\n\n';
  text += 'NOTE: MTM (MTMS) codes are billed to Medi-Cal / Medicare Part D only — not Medicare Part B.\n';
  text += 'Per ACBH/CMS requirements. Always verify current payer guidelines before submission.\n\n';
  text += 'Generated by ATLAS Platform v8 · Adherence Cartography · ' + date;
  var a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  a.download = 'ATLAS_CMR_Summary_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
}

/**
 * Exports a PBM-formatted MTM billing report as CSV.
 * Generates a summary suitable for Medicare Part D / Medi-Cal MTM program submission.
 * Columns: Date, Patient_ID, CPT_Code, Service_Type, Minutes, Provider_Name,
 *          Provider_Credential, Diagnosis_Code, Payer, Workspace, Status
 */
function exportMTMBillingReport() {
  var date     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  var isoDate  = new Date().toISOString().slice(0, 10);
  var provider = (workspaceProfile && (workspaceProfile.name || workspaceProfile.display_name)) || 'Pharmacist';
  var cred     = getClinicianLabel ? getClinicianLabel() : 'PharmD';
  var ws       = (typeof currentWorkspace !== 'undefined' ? currentWorkspace : '') || 'ATLAS-WS';

  // Gather MTM encounters from CCM log (99490-type) and standalone MTM records
  var rows = [
    ['Date_of_Service','Patient_ID','CPT_Code','Service_Type','Duration_min',
     'Provider_Name','Provider_Credential','Diagnosis_Code_ICD10',
     'Payer_Type','Workspace_Key','Billing_Status','MMAS8_Score','Adherence_Level']
  ];

  // Pull CCM/MTM time log entries
  if (typeof _ccmTimeLog !== 'undefined' && _ccmTimeLog.length) {
    _ccmTimeLog.forEach(function(e) {
      var mins = e.minutes || 0;
      var cpt  = mins >= 60 ? '99491' : '99490';
      rows.push([
        e.ts ? new Date(e.ts).toLocaleDateString('en-US') : isoDate,
        e.pid || 'UNASSIGNED',
        cpt,
        'Chronic Care Management — Medication Adherence',
        mins,
        provider, cred,
        'Z79.899',        // ICD-10: long-term use of other medication
        'Medicare Part D',
        ws,
        'Pending Submission',
        '—', '—'
      ]);
    });
  }

  // Pull explicit MTM encounter counts from CPT display elements
  var mtm05 = parseInt((document.getElementById('cpo-99605') || {}).textContent || '0', 10);
  var mtm06 = parseInt((document.getElementById('cpo-99606') || {}).textContent || '0', 10);
  var mtm07 = parseInt((document.getElementById('cpo-99607') || {}).textContent || '0', 10);
  var mo    = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (mtm05 > 0) rows.push([mo,'BATCH-MTM','99605','MTM — Initial CMR (≥ 15 min)',15,provider,cred,'Z79.899','Medicare Part D',ws,'Pending Submission','—','—']);
  if (mtm06 > 0) rows.push([mo,'BATCH-MTM','99606','MTM — Follow-up (≥ 15 min)',15,provider,cred,'Z79.899','Medicare Part D',ws,'Pending Submission','—','—']);
  if (mtm07 > 0) rows.push([mo,'BATCH-MTM','99607','MTM — Add-on (≥ 15 min)',15,provider,cred,'Z79.899','Medicare Part D',ws,'Pending Submission','—','—']);

  if (rows.length < 2) {
    if (typeof showToast === 'function') showToast('No MTM billing data recorded this period. Log CCM time or enter MTM encounters first.', 4000);
    return;
  }

  var esc = function(v) {
    var s = String(v == null ? '' : v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  var csv = rows.map(function(r) { return r.map(esc).join(','); }).join('\n');

  // Add PBM submission header block as comments
  var header = '# ATLAS MTM BILLING REPORT — PBM SUBMISSION\r\n';
  header += '# Provider: ' + provider + ' · ' + cred + '\r\n';
  header += '# Workspace: ' + ws + '\r\n';
  header += '# Generated: ' + date + '\r\n';
  header += '# CPT Codes: 99605 (Initial CMR ≥15 min) · 99606 (Follow-up ≥15 min) · 99607 (Add-on)\r\n';
  header += '# Payer: Medicare Part D / Medi-Cal MTM Program\r\n';
  header += '# NOTE: Verify payer-specific requirements before submission. Not Medicare Part B.\r\n';
  header += '# Diagnosis: Z79.899 (Long-term use of other medication) — update per patient record.\r\n#\r\n';

  var blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'ATLAS_MTM_Billing_Report_' + isoDate + '.csv';
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  if (typeof showToast === 'function') showToast('MTM Billing Report exported — review before PBM submission.', 4000);
}

// ── Billing tab initializer ───────────────────────────────────────────────────
var _instBillingTabInited = false;

function initInstBillingTab() {
  // Determine billing access — clinician roles or superadmin only (not researcher, not PI)
  var tier = ((workspaceProfile && (workspaceProfile.tier || workspaceProfile.role || workspaceProfile.contract_tier)) || '').toLowerCase();
  var hasBilling = isSuperAdmin() || isClinician() || tier === 'institution';

  var lockedNotice = document.getElementById('inst-billing-locked-notice');
  var billingTabs  = document.getElementById('billing-code-tabs');
  if (lockedNotice) lockedNotice.style.display = hasBilling ? 'none' : '';
  if (billingTabs)  billingTabs.style.display  = hasBilling ? '' : 'none';

  // Update header to reflect clinician sub-type
  var headerEy = document.getElementById('billing-header-eyebrow');
  if (headerEy && isClinician()) {
    headerEy.textContent = '⚕ Clinical Billing · ' + getClinicianLabel();
  }

  if (!hasBilling) return;

  if (_instBillingTabInited) return;
  _instBillingTabInited = true;

  // Move legacy MTM Timer + Audit panels into MTM slot (same as before)
  var timerSlot  = document.getElementById('inst-mtm-timer-slot');
  var timerPanel = document.getElementById('mtm-timer-panel');
  if (timerSlot && timerPanel) {
    timerPanel.style.display  = '';
    timerPanel.style.marginTop = '0';
    timerSlot.appendChild(timerPanel);
  }
  var auditSlot  = document.getElementById('inst-mtm-audit-slot');
  var auditPanel = document.getElementById('mtm-audit-panel');
  if (auditSlot && auditPanel) {
    auditPanel.style.display  = '';
    auditPanel.style.marginTop = '0';
    auditSlot.appendChild(auditPanel);
  }

  // Set month labels
  var mo = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  var ccmMo = document.getElementById('ccm-month-label'); if (ccmMo) ccmMo.textContent = mo;
  var rtmMo = document.getElementById('rtm-month-label'); if (rtmMo) rtmMo.textContent = mo;

  // Determine if this is a pharmacist — show billing capacity note
  var cap = getClinicianBillingCapacity();
  if (cap && !cap.mtm_independent) {
    var mtmNote = document.createElement('div');
    mtmNote.style.cssText = 'margin-top:10px;padding:8px 12px;background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.2);border-radius:6px;font-size:0.74rem;color:var(--muted);';
    mtmNote.textContent = 'Note: MTM independent billing applies to PharmD/pharmacists. ' + getClinicianLabel() + ' bills MTM as collaborating provider or supervised staff — verify with your payer before submission.';
    var mtmPanel2 = document.getElementById('bill-panel-mtm');
    if (mtmPanel2) mtmPanel2.insertBefore(mtmNote, mtmPanel2.firstChild);
  }

  updateBillingMonthlyWidget();
  if (typeof mtmRender === 'function') setTimeout(mtmRender, 80);
  // C4: Show billing disclaimer banner on first load
  setTimeout(_billingShowDisclaimer, 150);
}

var _instMTMTabInited = false;
function initInstMTMTab() {
  // All clinician roles have MTM access (PharmD bills independently; others as collaborating provider)
  var hasMTM = isSuperAdmin() || isClinician() || isInstitutionMode();

  var lockedNotice = document.getElementById('inst-mtm-locked-notice');
  if (lockedNotice) lockedNotice.style.display = hasMTM ? 'none' : '';

  if (!hasMTM) return;

  if (_instMTMTabInited) return; // already moved panels — don't re-append
  _instMTMTabInited = true;

  // Move MTM Session Timer into inst-mtm-timer-slot
  var timerSlot  = document.getElementById('inst-mtm-timer-slot');
  var timerPanel = document.getElementById('mtm-timer-panel');
  if (timerSlot && timerPanel) {
    timerPanel.style.display  = '';
    timerPanel.style.marginTop = '0';
    timerSlot.appendChild(timerPanel);
  }

  // Move MTM Audit Log into inst-mtm-audit-slot
  var auditSlot  = document.getElementById('inst-mtm-audit-slot');
  var auditPanel = document.getElementById('mtm-audit-panel');
  if (auditSlot && auditPanel) {
    auditPanel.style.display  = '';
    auditPanel.style.marginTop = '0';
    auditSlot.appendChild(auditPanel);
  }

  // Ensure MTM timer scroll target (audit panel "New Session" button) points upward
  var jumpBtn = auditPanel && auditPanel.querySelector('button[onclick*="mtm-timer-panel"]');
  if (jumpBtn) {
    jumpBtn.onclick = function() {
      var t = document.getElementById('mtm-timer-panel');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  // Re-render the audit log now that it's visible
  if (typeof mtmRender === 'function') setTimeout(mtmRender, 80);
}

// ══════════════════════════════════════════════════════════════════
// INSTITUTION SEAT MANAGEMENT TAB
// ══════════════════════════════════════════════════════════════════
var _instSeatsTabInited  = false;
var _instProvMode        = null;   // 'pi' | 'member'
var _instProvParentPiKey = null;   // PI key when mode === 'member'
var _instProvSeatType    = null;   // resolved seat type

function initInstSeatsTab() {
  if (_instSeatsTabInited) return;
  _instSeatsTabInited = true;
  _loadInstSeatStatus();
}

async function _loadInstSeatStatus() {
  const errEl  = document.getElementById('inst-seats-error');
  const barEl  = document.getElementById('inst-seats-quota-bar');
  const treeEl = document.getElementById('inst-seats-tree');
  if (errEl) errEl.style.display = 'none';

  try {
    const res  = await fetch(LAMBDA_URL + '/institution/seat-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inst_key: currentWorkspace }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to load seat status');

    _renderInstSeatsQuotaBar(data.quota);
    _renderInstSeatsHierarchy(data.seats || [], data.quota);

    // Tab badge
    const remaining = Object.values(data.quota).reduce((s, q) => s + (q.included_remaining || 0), 0);
    const badge = document.getElementById('inst-seats-tab-badge');
    if (badge) {
      badge.textContent = remaining > 0 ? remaining + ' remaining' : 'Full';
      badge.style.display = '';
      badge.style.background = remaining > 0 ? 'rgba(46,201,138,0.15)' : 'rgba(212,168,67,0.15)';
      badge.style.borderColor = remaining > 0 ? 'rgba(46,201,138,0.35)' : 'rgba(212,168,67,0.35)';
      badge.style.color = remaining > 0 ? 'var(--strata)' : 'var(--gold)';
    }
  } catch(e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ''; }
  }
}

function _renderInstSeatsQuotaBar(quota) {
  const bar = document.getElementById('inst-seats-quota-bar');
  if (!bar || !quota) return;
  const cfg = {
    pi:               { label: 'PI',           color: 'rgba(139,111,245,0.8)' },
    pharmacist:       { label: 'PharmD',        color: 'rgba(212,168,67,0.8)' },
    np:               { label: 'NP',           color: 'rgba(212,168,67,0.7)' },
    pa:               { label: 'PA',           color: 'rgba(212,168,67,0.7)' },
    rn:               { label: 'RN',           color: 'rgba(212,168,67,0.7)' },
    md:               { label: 'MD/DO',        color: 'rgba(212,168,67,0.7)' },
    care_coordinator: { label: 'Care Coord.',  color: 'rgba(212,168,67,0.7)' },
    researcher:       { label: 'Researcher',   color: 'rgba(78,156,245,0.8)' },
    student:          { label: 'Student',      color: 'rgba(46,201,138,0.8)' },
    observer:         { label: 'Observer',     color: 'rgba(255,255,255,0.35)' },
  };
  bar.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--dim);margin-right:4px;">Seats</span>` +
    Object.entries(quota).map(([type, q]) => {
      const c = cfg[type] || { label: type, color: 'var(--dim)' };
      const rem = q.included_remaining ?? Math.max(0, q.included_max - q.included_used);
      const tag = rem > 0
        ? `<span style="color:${c.color};">${q.included_used}/${q.included_max}</span>`
        : `<span style="color:rgba(212,168,67,0.6);">${q.included_used}/${q.included_max} full</span>`;
      return `<span style="font-family:var(--font-mono);font-size:0.78rem;padding:3px 10px;border-radius:20px;border:1px solid var(--border2);white-space:nowrap;">
        <span style="color:var(--dim);">${c.label} </span>${tag}
        ${q.purchased > 0 ? `<span style="color:rgba(78,156,245,0.6);font-size:0.68rem;">+${q.purchased}</span>` : ''}
      </span>`;
    }).join('') +
    `<a href="https://keys.adherence.cc#section-seats" target="_blank" style="margin-left:auto;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(78,156,245,0.6);text-decoration:none;white-space:nowrap;">Purchase More →</a>`;
}

function _renderInstSeatsHierarchy(seats, quota) {
  const tree = document.getElementById('inst-seats-tree');
  if (!tree) return;

  const piList   = seats.filter(s => s.role === 'pi');
  const members  = seats.filter(s => s.role !== 'pi');
  const piQuota  = quota?.pi || {};
  const piRem    = piQuota.included_remaining ?? Math.max(0, (piQuota.included_max || 0) - (piQuota.included_used || 0));

  const roleColor = {
    pi:               'rgba(139,111,245,0.85)',
    pharmacist:       'rgba(212,168,67,0.85)',
    np:               'rgba(212,168,67,0.75)',
    pa:               'rgba(212,168,67,0.75)',
    rn:               'rgba(212,168,67,0.75)',
    md:               'rgba(212,168,67,0.75)',
    care_coordinator: 'rgba(212,168,67,0.75)',
    researcher:       'rgba(78,156,245,0.85)',
    student:          'rgba(46,201,138,0.85)',
    observer:         'rgba(212,168,67,0.85)',
  };
  const roleLabel = {
    pi:               'PI',
    pharmacist:       'PharmD',
    np:               'NP',
    pa:               'PA',
    rn:               'RN',
    md:               'MD/DO',
    care_coordinator: 'Care Coord.',
    researcher:       'Researcher',
    student:          'Student',
    observer:         'Observer',
  };

  function memberRow(m, indent) {
    const auditBy = m.provisionedBy || null;
    const auditAt = m.provisionedAt ? new Date(m.provisionedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null;
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px 9px ${indent}px;border-bottom:1px solid var(--border2);">
      <span style="color:var(--border2);font-size:0.70rem;flex-shrink:0;">└─</span>
      <span style="flex:1;font-size:0.84rem;color:var(--text);">${m.name || '—'}</span>
      <span style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:${roleColor[m.role]||'var(--dim)'};">${roleLabel[m.role]||m.role}</span>
      <span style="font-size:0.72rem;color:var(--muted);">${m.email || ''}</span>
      <span style="font-family:var(--font-mono);font-size:0.60rem;color:rgba(212,168,67,0.55);letter-spacing:0.06em;">${m.key}</span>
      <span class="audit-col${auditBy ? '' : ' no-data'}" title="Provisioned by">${auditBy || 'Not recorded'}</span>
      <span class="audit-col${auditAt ? '' : ' no-data'}" title="Provisioned at">${auditAt || 'Not recorded'}</span>
    </div>`;
  }

  let html = '';

  // Institution root row
  html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--r) var(--r) 0 0;border-bottom:none;">
    <span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.18em;text-transform:uppercase;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);color:rgba(212,168,67,0.7);border-radius:20px;padding:2px 9px;">Institution</span>
    <span style="font-size:0.88rem;color:var(--bright);">${workspaceProfile?.institution || currentWorkspace || '—'}</span>
    <span style="font-family:var(--font-mono);font-size:0.60rem;color:var(--dim);margin-left:4px;">${currentWorkspace || ''}</span>
  </div>`;

  const rowsWrap = `<div style="border:1px solid var(--border);border-radius:0 0 var(--r) var(--r);overflow:hidden;">`;

  let rows = '';

  if (!piList.length && !members.length) {
    rows += `<div style="text-align:center;padding:32px;color:var(--dim);font-family:var(--font-mono);font-size:0.80rem;">No seats provisioned yet. Add a PI to begin building your team.</div>`;
  }

  // PI rows
  piList.forEach(pi => {
    const piMembers = members.filter(m => (m.parent_pi || '').toUpperCase() === pi.key.toUpperCase());
    // Remaining member quota for each type
    const memberTypes = ['researcher','student','observer'];
    const canAddMember = memberTypes.some(t => {
      const q = quota?.[t] || {};
      return (q.included_remaining ?? Math.max(0, (q.included_max||0)-(q.included_used||0))) > 0;
    });

    const piAuditBy = pi.provisionedBy || null;
    const piAuditAt = pi.provisionedAt ? new Date(pi.provisionedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null;
    rows += `<div style="border-bottom:1px solid var(--border);">
      <!-- PI header row -->
      <div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(139,111,245,0.04);">
        <span style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(139,111,245,0.7);background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.2);border-radius:20px;padding:2px 9px;">PI</span>
        <span style="flex:1;font-size:0.88rem;color:var(--bright);font-weight:500;">${pi.name || '—'}</span>
        <span style="font-size:0.78rem;color:var(--muted);">${pi.email || ''}</span>
        <span style="font-family:var(--font-mono);font-size:0.60rem;color:rgba(212,168,67,0.55);letter-spacing:0.06em;">${pi.key}</span>
        <span class="audit-col${piAuditBy ? '' : ' no-data'}" title="Provisioned by">${piAuditBy || 'Not recorded'}</span>
        <span class="audit-col${piAuditAt ? '' : ' no-data'}" title="Provisioned at">${piAuditAt || 'Not recorded'}</span>
        ${canAddMember
          ? `<button onclick="openInstProvMember('${pi.key}','${(pi.name||'').replace(/'/g,'\\\'')}')" style="flex-shrink:0;padding:4px 11px;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(46,201,138,0.08);border:1px solid rgba(46,201,138,0.25);color:var(--strata);border-radius:4px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" onmouseover="this.style.background='rgba(46,201,138,0.16)'" onmouseout="this.style.background='rgba(46,201,138,0.08)'">+ Add Member</button>`
          : ''
        }
      </div>
      <!-- PI's members -->
      ${piMembers.length
        ? piMembers.map(m => memberRow(m, 32)).join('')
        : `<div style="padding:9px 14px 9px 44px;font-family:var(--font-mono);font-size:0.72rem;color:var(--dim);border-bottom:none;">No members assigned yet.</div>`
      }
    </div>`;
  });

  // + Add PI button row
  rows += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;${piList.length ? 'border-top:1px solid var(--border2);' : ''}">
    ${piRem > 0
      ? `<button onclick="openInstProvPi()" style="padding:6px 14px;font-family:var(--font-mono);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.25);color:rgba(139,111,245,0.8);border-radius:4px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(139,111,245,0.16)'" onmouseout="this.style.background='rgba(139,111,245,0.08)'">+ Add PI</button>
         <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">${piRem} of ${piQuota.included_max||2} slots available</span>`
      : `<span style="font-family:var(--font-mono);font-size:0.72rem;color:rgba(212,168,67,0.6);">PI quota full (${piQuota.included_max||2}/${piQuota.included_max||2})</span>
         <a href="https://keys.adherence.cc#section-seats" target="_blank" style="font-family:var(--font-mono);font-size:0.68rem;color:rgba(78,156,245,0.6);text-decoration:none;">Purchase additional PI seats →</a>`
    }
  </div>`;

  // Unassigned members (members with no parent_pi, or parent_pi not found in piList)
  const piKeys = new Set(piList.map(p => p.key.toUpperCase()));
  const unassigned = members.filter(m => !m.parent_pi || !piKeys.has((m.parent_pi||'').toUpperCase()));
  if (unassigned.length) {
    rows += `<div style="border-top:1px solid var(--border);background:rgba(255,255,255,0.01);">
      <div style="padding:8px 14px;font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border2);">Unassigned Members</div>
      ${unassigned.map(m => memberRow(m, 28)).join('')}
    </div>`;
  }

  tree.innerHTML = html + rowsWrap + rows + '</div>';

  // Store seat data for CSV export
  window._instSeatsData = seats;

  // Inject export button below the tree (remove any existing one first)
  const existingExport = document.getElementById('inst-seats-export-btn-wrap');
  if (existingExport) existingExport.remove();
  const exportWrap = document.createElement('div');
  exportWrap.id = 'inst-seats-export-btn-wrap';
  exportWrap.style.marginTop = '10px';
  exportWrap.innerHTML = `<button onclick="exportSeatAuditCSV()" style="padding:7px 14px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;font-size:0.78rem;font-weight:600;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
    <i data-lucide="download" style="width:13px;height:13px;"></i> Export Seat Audit CSV
  </button>`;
  tree.parentNode.insertBefore(exportWrap, tree.nextSibling);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [exportWrap] });
}

// ── Open provision modal — PI mode ────────────────────────
function openInstProvPi() {
  _instProvMode        = 'pi';
  _instProvParentPiKey = null;
  _instProvSeatType    = 'pi';

  const titleEl = document.getElementById('inst-prov-modal-title');
  if (titleEl) titleEl.textContent = 'Add Principal Investigator';

  document.getElementById('inst-prov-pi-context').style.display = 'none';
  document.getElementById('inst-prov-type-row').style.display   = 'none';
  document.getElementById('inst-prov-name').value  = '';
  document.getElementById('inst-prov-email').value = '';
  const errEl = document.getElementById('inst-prov-error');
  if (errEl) errEl.style.display = 'none';
  const btn = document.getElementById('inst-prov-submit');
  if (btn) { btn.disabled = false; btn.textContent = 'Issue PI Key →'; }

  const modal = document.getElementById('inst-prov-modal');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => document.getElementById('inst-prov-name')?.focus(), 80);
}

// ── Open provision modal — Member mode (under a specific PI) ──
function openInstProvMember(piKey, piName) {
  _instProvMode        = 'member';
  _instProvParentPiKey = piKey;
  _instProvSeatType    = 'researcher';  // default; user selects

  const titleEl = document.getElementById('inst-prov-modal-title');
  if (titleEl) titleEl.textContent = 'Add Team Member';

  const ctx = document.getElementById('inst-prov-pi-context');
  const lbl = document.getElementById('inst-prov-pi-name-label');
  if (ctx) ctx.style.display = '';
  if (lbl) lbl.textContent = piName;

  document.getElementById('inst-prov-type-row').style.display = '';
  _instSelectMemberType('researcher');  // pre-select first option

  document.getElementById('inst-prov-name').value  = '';
  document.getElementById('inst-prov-email').value = '';
  const errEl = document.getElementById('inst-prov-error');
  if (errEl) errEl.style.display = 'none';
  const btn = document.getElementById('inst-prov-submit');
  if (btn) { btn.disabled = false; btn.textContent = 'Issue Seat Key →'; }

  const modal = document.getElementById('inst-prov-modal');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => document.getElementById('inst-prov-name')?.focus(), 80);
}

function _instSelectMemberType(type) {
  _instProvSeatType = type;
  // Sync the dropdown select value
  var sel = document.getElementById('inst-prov-type-select');
  if (sel) sel.value = type;
  // Also sync legacy radio inputs for backward compat
  ['researcher','pharmacist','student','observer','md','np','pa','rn','care_coordinator'].forEach(t => {
    const el = document.getElementById(`inst-prov-type-${t}`);
    if (!el) return;
    // Legacy label toggle buttons (now hidden) — style no-op on hidden inputs
    if (el.tagName === 'LABEL') {
      if (t === type) {
        el.style.background   = 'rgba(46,201,138,0.10)';
        el.style.borderColor  = 'rgba(46,201,138,0.40)';
        el.style.color        = 'var(--strata)';
      } else {
        el.style.background  = '';
        el.style.borderColor = 'var(--border)';
        el.style.color       = 'var(--dim)';
      }
    } else if (el.tagName === 'INPUT') {
      el.checked = (t === type);
    }
  });
}

function closeInstProvModal() {
  const modal = document.getElementById('inst-prov-modal');
  if (modal) modal.style.display = 'none';
  _instProvMode = _instProvParentPiKey = _instProvSeatType = null;
}

async function submitInstProvisionSeat() {
  const name  = (document.getElementById('inst-prov-name')?.value  || '').trim();
  const email = (document.getElementById('inst-prov-email')?.value || '').trim();
  const errEl = document.getElementById('inst-prov-error');
  const btn   = document.getElementById('inst-prov-submit');

  if (errEl) errEl.style.display = 'none';
  const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = ''; } };

  if (!name)  return showErr('Enter a name for this seat holder.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showErr('Enter a valid email address.');
  if (!_instProvSeatType) return showErr('No seat type selected — close and try again.');

  if (btn) { btn.disabled = true; btn.textContent = 'Issuing…'; }

  try {
    const _adminUser  = firebase.auth().currentUser;
    const _adminEmail = workspaceProfile?.email || _adminUser?.email || _adminUser?.displayName || 'Admin';
    const payload = {
      inst_key:      currentWorkspace,
      seat_type:     _instProvSeatType,
      name, email,
      provisionedBy: _adminEmail,
      provisionedAt: new Date().toISOString(),
    };
    if (_instProvParentPiKey) payload.parent_pi = _instProvParentPiKey;

    const res  = await fetch(LAMBDA_URL + '/institution/provision-seat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.status === 402 || data.quota_full) {
      showErr(`All included ${_instProvSeatType} seats are in use. Purchase additional seats at keys.adherence.cc.`);
      if (btn) { btn.disabled = false; btn.textContent = 'Issue Seat Key →'; }
      return;
    }
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to provision seat');

    closeInstProvModal();
    showToast(`✓ ${data.role.toUpperCase()} seat issued — key sent to ${email}`, 5000);

    _instSeatsTabInited = false;
    _loadInstSeatStatus();
  } catch(e) {
    showErr(e.message || 'Could not issue seat — try again or contact info@adherence.cc.');
    if (btn) { btn.disabled = false; btn.textContent = 'Issue Seat Key →'; }
  }
}

function exportSeatAuditCSV() {
  const seats = window._instSeatsData || [];
  const rows  = [['key','name','email','role','parent_pi','provisioned_by','provisioned_at']];
  seats.forEach(s => {
    rows.push([
      s.key           || '',
      s.name          || '',
      s.email         || '',
      s.role          || '',
      s.parent_pi     || '',
      s.provisionedBy || 'Not recorded',
      s.provisionedAt || 'Not recorded',
    ]);
  });
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'atlas_seat_audit_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

function initMTMAuditPanel() {
  if (isPIMode()) return; // PI workspace: no MTM — research tool only
  const panel = document.getElementById('mtm-audit-panel');
  if (!panel) return;
  const role  = workspaceProfile?.role || window._wsMode || '';
  const show  = isClinician() || isInstitutionMode() || isSuperAdmin()
                || currentWorkspace === 'EXPLORER'; // show in explorer for demo
  if (show) {
    // Institution users: panel lives inside the MTM tab — don't force it visible in dash-body
    if (isInstitutionMode()) {
      mtmRender(); // init data state only
    } else {
      panel.style.display = 'block';
      mtmRender();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MTM SESSION TIMER — Live stopwatch system for CMS CPT billing
// Service · Documentation · Travel — auto-calculates CPT code combination
// Persists running state in sessionStorage so refresh doesn't kill a session
// ══════════════════════════════════════════════════════════════════════════

// State object for three independent timers
window.mtmTimerState = {
  svc: { running: false, elapsed: 0, startTs: null },
  doc: { running: false, elapsed: 0, startTs: null },
  trv: { running: false, elapsed: 0, startTs: null },
};
window._mtmTimerRAF = null;

// ── Initialise: restore session state — called from initMTMTimerPanel after DOM ready ──
function mtmTimerRestoreSession() {
  try {
    const saved = sessionStorage.getItem('atlas_mtm_timer');
    if (!saved) return;
    const s = JSON.parse(saved);
    const now = Date.now();
    ['svc','doc','trv'].forEach(k => {
      if (!s[k]) return;
      mtmTimerState[k].elapsed = s[k].elapsed || 0;
      if (s[k].running && s[k].startTs) {
        mtmTimerState[k].elapsed += Math.floor((now - s[k].startTs) / 1000);
        mtmTimerState[k].running = true;
        mtmTimerState[k].startTs = now;
      }
    });
  } catch(e) {}
}

function mtmTimerSaveSession() {
  const now = Date.now();
  if (window._mtmLastSave && (now - window._mtmLastSave) < 10000) return;
  window._mtmLastSave = now;
  try {
    const snap = {};
    ['svc','doc','trv'].forEach(k => {
      snap[k] = {
        elapsed: mtmTimerGetElapsed(k),
        running: mtmTimerState[k].running,
        startTs: mtmTimerState[k].running ? mtmTimerState[k].startTs : null,
      };
    });
    sessionStorage.setItem('atlas_mtm_timer', JSON.stringify(snap));
  } catch(e) {}
}

function mtmTimerGetElapsed(k) {
  const t = mtmTimerState[k];
  if (!t.running || !t.startTs) return t.elapsed;
  return t.elapsed + Math.floor((Date.now() - t.startTs) / 1000);
}

function mtmTimerFmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

// ── Core tick — runs via rAF loop when any timer is active ──
function mtmTimerTick() {
  const svcS = mtmTimerGetElapsed('svc');
  const docS = mtmTimerGetElapsed('doc');
  const trvS = mtmTimerGetElapsed('trv');
  const totS = svcS + docS + trvS;

  const d_svc = document.getElementById('mtm-svc-display');
  const d_doc = document.getElementById('mtm-doc-display');
  const d_trv = document.getElementById('mtm-trv-display');
  const d_tot = document.getElementById('mtm-total-display');

  if (d_svc) d_svc.textContent = mtmTimerFmt(svcS);
  if (d_doc) d_doc.textContent = mtmTimerFmt(docS);
  if (d_trv) d_trv.textContent = mtmTimerFmt(trvS);
  if (d_tot) d_tot.textContent = mtmTimerFmt(totS);

  mtmTimerUpdateThresholds(svcS, totS);
  mtmTimerUpdateBadge();
  mtmTimerSaveSession();

  const anyRunning = mtmTimerState.svc.running || mtmTimerState.doc.running || mtmTimerState.trv.running;
  if (anyRunning) {
    window._mtmTimerRAF = setTimeout(mtmTimerTick, 1000);
  } else {
    window._mtmTimerRAF = null;
  }
}

function mtmTimerEnsureLoop() {
  if (!window._mtmTimerRAF) {
    window._mtmTimerRAF = setTimeout(mtmTimerTick, 100);
  }
}

// ── Toggle a specific clock ──
function mtmTimerToggle(k) {
  const t = mtmTimerState[k];
  const btn = document.getElementById('mtm-' + k + '-btn');
  if (t.running) {
    // Pause: accumulate elapsed
    t.elapsed = mtmTimerGetElapsed(k);
    t.running = false;
    t.startTs = null;
    if (btn) { btn.textContent = '▶ Resume'; btn.style.opacity = '0.75'; }
  } else {
    t.running = true;
    t.startTs = Date.now();
    if (btn) { btn.textContent = '⏸ Pause'; btn.style.opacity = '1'; }
    mtmTimerEnsureLoop();
  }
  mtmTimerSaveSession();
}

function mtmTimerReset(k) {
  const t = mtmTimerState[k];
  t.running = false;
  t.elapsed = 0;
  t.startTs = null;
  const btn = document.getElementById('mtm-' + k + '-btn');
  if (btn) { btn.textContent = '▶ Start'; btn.style.opacity = '1'; }
  // Single tick to refresh displays
  const dispMap = { svc: 'mtm-svc-display', doc: 'mtm-doc-display', trv: 'mtm-trv-display' };
  const d = document.getElementById(dispMap[k]);
  if (d) d.textContent = '00:00';
  mtmTimerUpdateBadge();
  mtmTimerSaveSession();
}

function mtmTimerResetAll() {
  ['svc','doc','trv'].forEach(k => mtmTimerReset(k));
  const tot = document.getElementById('mtm-total-display');
  if (tot) tot.textContent = '00:00';
  mtmTimerUpdateThresholds(0, 0);
  // Clear session storage
  try { sessionStorage.removeItem('atlas_mtm_timer'); } catch(e) {}
  showToast('Session timer reset', 2000);
}

// ── Threshold indicator dots ──
function mtmTimerUpdateThresholds(svcS, totS) {
  const svcMin = svcS / 60;
  const totMin = totS / 60;

  const setThresh = (id, dotId, met) => {
    const row = document.getElementById(id);
    const dot = document.getElementById(dotId);
    if (!row || !dot) return;
    if (met) {
      dot.style.background = 'var(--optimal)';
      dot.style.boxShadow  = '0 0 5px var(--optimal)';
      row.style.color      = 'var(--text)';
    } else {
      dot.style.background = 'var(--border2)';
      dot.style.boxShadow  = 'none';
      row.style.color      = 'var(--dim)';
    }
  };

  setThresh('mtm-thresh-15', 'mtm-thresh-15-dot', svcMin >= 15);
  setThresh('mtm-thresh-23', 'mtm-thresh-23-dot', totMin >= 23);
  setThresh('mtm-thresh-38', 'mtm-thresh-38-dot', totMin >= 38);
}

// ── CPT badge: live auto-suggest in header ──
function mtmTimerUpdateBadge() {
  const badge = document.getElementById('mtm-timer-cpt-badge');
  if (!badge) return;
  const ptType = document.getElementById('mtm-timer-pt-type')?.value || 'established';
  const svcS   = mtmTimerGetElapsed('svc');
  const docS   = mtmTimerGetElapsed('doc');
  const trvS   = mtmTimerGetElapsed('trv');
  const totS   = svcS + docS + trvS;
  const svcMin = Math.floor(svcS / 60);
  const totMin = Math.floor(totS / 60);

  if (svcMin < 1 && totMin < 1) {
    badge.textContent = 'CPT — start a session';
    badge.style.color = 'var(--dim)';
    badge.style.borderColor = 'rgba(139,111,245,0.22)';
    return;
  }

  const result = mtmCalcCPT(svcMin, totMin, ptType === 'new');
  badge.textContent = result.display;

  if (svcMin >= 15) {
    badge.style.color = 'var(--mvmt)';
    badge.style.borderColor = 'rgba(139,111,245,0.5)';
    badge.style.background  = 'rgba(139,111,245,0.1)';
  } else {
    badge.style.color = 'var(--pe)';
    badge.style.borderColor = 'rgba(212,168,67,0.4)';
    badge.style.background  = 'rgba(212,168,67,0.06)';
  }
}

// ── Core CPT calculation (per ACBH rules from PDF) ──
// Service time drives base code (99605/99606). Total time drives add-ons.
// If svc >= 23 min: base code reverts to 15 min, remainder → 99607(s)
// 99607: each additional 8–22 min block
function mtmCalcCPT(svcMin, totMin, isNewPatient) {
  const base = isNewPatient ? '99605' : '99606';

  if (svcMin < 15) {
    return {
      codes: [],
      display: svcMin > 0 ? 'Under 15 min (not billable yet)' : 'CPT — start a session',
      warning: true,
    };
  }

  // Base encounter covers 15–22 min of service time
  if (totMin <= 22) {
    return { codes: [base], display: base + ' (' + totMin + ' min total)', warning: false };
  }

  // 23+ min total: base = 15 min, remaining time → 99607 add-ons
  let remaining = totMin - 15;
  const codes = [base];
  while (remaining >= 8) {
    codes.push('99607');
    remaining = remaining >= 22 ? remaining - 22 : 0;
    if (remaining < 8) break;
  }

  return {
    codes,
    display: codes.join(' + ') + ' (' + totMin + ' min total)',
    warning: false,
  };
}

// ── Commit encounter to MTM log (Firebase + local display) ──
function mtmTimerCommit() {
  const pid     = (document.getElementById('mtm-timer-pid')?.value || '').trim();
  const ptType  = document.getElementById('mtm-timer-pt-type')?.value || 'established';
  const payer   = document.getElementById('mtm-timer-payer')?.value || 'medi-cal';
  const notes   = (document.getElementById('mtm-timer-notes')?.value || '').trim();

  if (!pid) {
    showToast('Patient ID is required to commit encounter.', 3000);
    const pidField = document.getElementById('mtm-timer-pid');
    if (pidField) { pidField.style.borderColor = 'var(--poor)'; setTimeout(() => { pidField.style.borderColor = 'var(--border2)'; }, 2500); }
    return;
  }

  const svcS = mtmTimerGetElapsed('svc');
  const docS = mtmTimerGetElapsed('doc');
  const trvS = mtmTimerGetElapsed('trv');
  const totS = svcS + docS + trvS;
  const svcMin = Math.floor(svcS / 60);
  const totMin = Math.floor(totS / 60);

  if (svcMin < 15) {
    showToast('Service time must be at least 15 minutes to bill an MTM encounter.', 3500);
    return;
  }

  const cptResult = mtmCalcCPT(svcMin, totMin, ptType === 'new');
  const primaryCPT = cptResult.codes[0] || '99606';
  const addOnCodes = cptResult.codes.slice(1);
  const now        = Date.now();
  const dateStr    = new Date(now).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });

  const encounter = {
    timestamp:   now,
    date:        dateStr,
    patient_id:  pid,
    patient_type: ptType,
    payer,
    cpt_primary:  primaryCPT,
    cpt_addons:   addOnCodes,
    cpt_codes:    cptResult.codes,
    cpt_display:  cptResult.display,
    svc_sec:      svcS,
    doc_sec:      docS,
    trv_sec:      trvS,
    total_sec:    totS,
    svc_min:      svcMin,
    total_min:    totMin,
    notes,
    workspace:    currentWorkspace || '—',
    instrument:   'MMAS-8® (TX 8-632-533)',
    source:       'timer',
  };

  // Push to Firebase if available
  if (typeof database !== 'undefined' && currentWorkspace && currentWorkspace !== 'EXPLORER') {
    const ref = database.ref('mtm_encounters/' + currentWorkspace);
    ref.push(encounter).then(() => {
      showToast('Encounter committed — ' + cptResult.display, 3500);
    }).catch(() => {
      showToast('Encounter committed locally (sync pending).', 3000);
    });
  } else {
    showToast('Encounter committed — ' + cptResult.display, 3500);
  }

  // Store locally for immediate render in audit log
  if (!window._mtmManualEncounters) window._mtmManualEncounters = [];
  window._mtmManualEncounters.unshift(encounter);

  // Log to audit system
  if (typeof atlasAuditLog === 'function') {
    atlasAuditLog('mtm_timer_commit', { pid, cpt: primaryCPT, total_min: totMin, workspace: currentWorkspace });
  }

  // Refresh audit log table
  if (typeof mtmRender === 'function') setTimeout(mtmRender, 150);

  // Reset timer for next patient
  mtmTimerResetAll();

  // Clear commit fields
  const pidField   = document.getElementById('mtm-timer-pid');
  const notesField = document.getElementById('mtm-timer-notes');
  if (pidField)   pidField.value   = '';
  if (notesField) notesField.value = '';
}

// ── Initialise timer panel visibility (same rules as audit log) ──
function initMTMTimerPanel() {
  if (isPIMode()) return; // PI workspace: no MTM — research tool only
  const panel = document.getElementById('mtm-timer-panel');
  if (!panel) return;
  const role = workspaceProfile?.role || window._wsMode || '';
  const show = isClinician() || isInstitutionMode() || isSuperAdmin()
               || currentWorkspace === 'EXPLORER';
  if (show) {
    // Institution users: panel lives inside the MTM tab — don't force it visible in dash-body
    if (!isInstitutionMode()) {
      panel.style.display = 'block';
    }
    mtmTimerRestoreSession(); // deferred from parse time — safe now that DOM exists
    const anyRunning = mtmTimerState.svc.running || mtmTimerState.doc.running || mtmTimerState.trv.running;
    if (anyRunning) {
      ['svc','doc','trv'].forEach(k => {
        if (mtmTimerState[k].running) {
          const btn = document.getElementById('mtm-' + k + '-btn');
          if (btn) btn.textContent = '⏸ Pause';
        }
      });
      mtmTimerEnsureLoop();
    }
  }
}

// ── C4: Billing Code Disclaimer ───────────────────────────────────────────
function _billingShowDisclaimer() {
  const key = '_billing_disc_dismissed';
  if (sessionStorage.getItem(key)) return;
  const panels = ['mtm-panel','ccm-panel','rtm-panel','billing-panel','clinical-billing-panel'];
  let target = null;
  for (const id of panels) { target = document.getElementById(id); if (target) break; }
  if (!target) {
    // Fallback: inject after first billing tab button
    target = document.querySelector('.billing-tab-content,.billing-content,.mtm-tab-content');
  }
  if (!target) return;
  if (document.getElementById('billing-disclaimer')) return; // already shown
  const banner = document.createElement('div');
  banner.id = 'billing-disclaimer';
  banner.className = 'billing-disc-banner';
  banner.innerHTML = `
    <span class="billing-disc-icon">⚠</span>
    <span class="billing-disc-text">Verify these codes with your billing department for your specific payer mix and plan contracts. ATLAS displays standard CPT codes; local coverage policies vary.</span>
    <button class="billing-disc-dismiss" onclick="_billingDismissDisclaimer()">Dismiss</button>
  `;
  target.insertBefore(banner, target.firstChild);
}

function _billingDismissDisclaimer() {
  sessionStorage.setItem('_billing_disc_dismissed', '1');
  const banner = document.getElementById('billing-disclaimer');
  if (banner) { banner.style.opacity = '0'; setTimeout(() => banner.remove(), 300); }
}
window._billingShowDisclaimer = _billingShowDisclaimer;
window._billingDismissDisclaimer = _billingDismissDisclaimer;

// ── BP-PRC-01: Student Publication License Flow ───────────────────────────────

/**
 * Opens the student publication license flow, with a role gate to redirect
 * funded researchers / PIs to the duration-based publication rights path.
 * @returns {void}
 */
function openPubLicenseFlow() {
  // BP-PRC-01: Role gate — funded researchers/PIs should use duration-based path
  const _role = (typeof getCurrentRole === 'function') ? getCurrentRole() :
                (typeof _currentRole !== 'undefined') ? _currentRole : 'researcher';
  const _studentEligibleRoles = ['student'];
  if (!_studentEligibleRoles.includes(_role)) {
    // Show funded researcher path modal instead
    _showFundedResearcherPublicationInfo();
    return;
  }

  // Student path: redirect to the student publication license purchase page
  window.open('https://atlas.adherence.cc?publish=1', '_blank', 'noopener');
}

function _showFundedResearcherPublicationInfo() {
  // Show a modal explaining funded researcher publication rights
  const existing = document.getElementById('_funded-pub-info-modal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = '_funded-pub-info-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(2,6,18,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="background:var(--card,#111e32);border:1px solid var(--border2,rgba(255,255,255,0.13));border-top:2px solid var(--base,#4e9cf5);border-radius:14px;max-width:520px;width:100%;padding:36px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(78,156,245,0.7);margin-bottom:10px;">Publication Rights · Funded Research</div>
      <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:var(--bright,#e8f0f8);margin-bottom:12px;">Duration-Based Publication Rights</h2>
      <p style="font-size:0.84rem;color:var(--muted,#6b8099);line-height:1.75;margin-bottom:16px;">As a PI or institutional researcher, your publication rights are priced by study duration — not the student flat rate. Active subscribers already have publication rights included in their workspace subscription.</p>
      <div style="background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.18);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:0.78rem;color:var(--muted,#6b8099);line-height:1.7;">
        <strong style="color:rgba(78,156,245,0.85);">If you already have an active workspace subscription</strong> — your Letter of Permission is already included. No additional purchase needed. Find it under Account → Documents.<br/><br/>
        <strong style="color:rgba(78,156,245,0.85);">If your study ran without a subscription</strong> — email info@adherence.cc with your IRB protocol number, study start/end dates, and funding source for a custom quote.
      </div>
      <div style="display:flex;gap:10px;">
        <a href="mailto:info@adherence.cc?subject=Publication%20Rights%20%E2%80%93%20Funded%20Study" style="flex:1;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.3);color:rgba(78,156,245,0.9);padding:11px;border-radius:7px;text-decoration:none;">Email for Quote →</a>
        <button onclick="document.getElementById('_funded-pub-info-modal').style.display='none'" style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid rgba(255,255,255,0.15);color:var(--muted,#6b8099);padding:11px 18px;border-radius:7px;cursor:pointer;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.openPubLicenseFlow = openPubLicenseFlow;
window._showFundedResearcherPublicationInfo = _showFundedResearcherPublicationInfo;

