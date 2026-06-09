// ── MMAS-8 score recompute helper ────────────────────────────────────────────
// Derives score from individual items rather than stored r.score, to correct
// historical records where q8 was stored as integer index (0–4).
// Old format: 0=Never, 1=Rarely, 2=Sometimes, 3=Usually, 4=Always (index).
// Current format: q8 is stored as the actual score value (1, 0.75, 0.5, 0.25, 0).
// MMAS-8 presents q8 as a single "Never/Rarely" option (val=1); MAP has separate
// Never (1.0) and Rarely (0.75) entries stored in map_q8 — handled separately.
// Only integers 2, 3, 4 are unambiguously old-format indices. Values 0 and 1
// are treated as direct scores since the current form stores 1 for "Never/Rarely".
function _recomputeMMASScore(r) {
  // MAP records use map_q* fields — fall back to stored score for those
  if (r.tool === 'map' || r.map_q1 !== undefined) return r.score || 0;
  const binary = (parseFloat(r.q1)||0) + (parseFloat(r.q2)||0) + (parseFloat(r.q3)||0) +
                 (parseFloat(r.q4)||0) + (parseFloat(r.q5)||0) + (parseFloat(r.q6)||0) +
                 (parseFloat(r.q7)||0);
  const raw = r.q8;
  let q8val;
  if (typeof raw === 'number') {
    // All integers 0–4 are stored as index values: 0=Never/Rarely(1), 1=Once in a while(0.75),
    // 2=Sometimes(0.5), 3=Usually(0.25), 4=All the time(0). Non-integer decimals are already scores.
    if (Number.isInteger(raw) && raw >= 0 && raw <= 4) {
      q8val = [1, 0.75, 0.5, 0.25, 0][raw]; // 0→1, 1→0.75, 2→0.5, 3→0.25, 4→0
    } else {
      q8val = raw; // already a decimal score (e.g. 0.75)
    }
  } else {
    const s = String(raw || '').trim().toLowerCase();
    q8val = ({'never/rarely':1, 'never / rarely':1, never:1,
              rarely:0.75, 'once in a while':0.75,
              sometimes:0.5, often:0.25, usually:0.25,
              always:0, 'all the time':0})[s] ?? 0;
  }
  return binary + q8val;
}

// ══════════════════════════════════════════════
// INSTITUTION COMMAND CENTER
// ══════════════════════════════════════════════
// ── Resolve which workspace keys this institution is allowed to see ──────────
// Super-admin role is set in Firebase token claims by Lambda — never hardcoded here
// Institution key: sees only workspaces where parent_institution === currentWorkspace
// Returns Promise<Set<string>> of allowed workspace keys (null = allow all)
// Result is cached per session to avoid redundant Firebase reads on re-renders
/** @type {Set<string>|null|undefined} Cached allowed workspace set; null = all workspaces (superadmin); undefined = not yet resolved */
let _allowedWSCache = undefined;
/** @type {string|null} Workspace key for which _allowedWSCache was last computed */
let _allowedWSCacheKey = null;

/**
 * Resolves the set of workspace keys visible to the current user based on their role.
 * - Superadmin:   returns null (all workspaces, no filter)
 * - Institution:  own workspace + all child PI and clinician workspaces across the network
 * - PI:           own workspace + all child clinician workspaces across the network (same scope as institution)
 * - Clinician:    own workspace only; data flows upward to PI and institution tiers
 * - All others:   Set containing only their own workspace key
 * Result is cached per session per workspace key.
 * @returns {Promise<Set<string>|null>} Allowed workspace keys, or null for unrestricted access
 */
async function resolveAllowedWorkspaces() {
  const ws = (currentWorkspace || '').toUpperCase();
  // Return cached result if workspace hasn't changed
  if (_allowedWSCache !== undefined && _allowedWSCacheKey === ws) return _allowedWSCache;

  // ── SUPERADMIN: sees every workspace, no filter ──────────────────────────
  if (isSuperAdmin()) { _allowedWSCache = null; _allowedWSCacheKey = ws; return null; }

  // Also check live Firebase token claims as a secondary confirmation
  try {
    const user = firebase.auth().currentUser;
    if (user) {
      const tokenResult = await user.getIdTokenResult();
      if (tokenResult.claims && tokenResult.claims.role === 'superadmin') {
        _allowedWSCache = null; _allowedWSCacheKey = ws; return null;
      }
    }
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'Superadmin token check failed: ' + e.message);
  }
  // ── PI: sees own workspace + all child workspaces across the network ────────
  // PI (programme lead) has the same network-level visibility as institution.
  // Three discovery paths run in parallel:
  //   1. parent_pi === this key           (direct PI→clinician link)
  //   2. parent_institution === myParentInst  (all siblings under the same institution umbrella)
  //   3. _childWorkspaces on the profile  (statically declared children, same as institution)
  // All paths are additive. Data from clinician tiers flows upward to PI and institution.
  if (isPIMode()) {
    const allowed      = new Set([ws]);
    const myParentInst = (workspaceProfile?.parent_institution || '').toUpperCase();

    // Path 3: statically declared child workspaces (matches institution behaviour)
    if (workspaceProfile && workspaceProfile._childWorkspaces) {
      workspaceProfile._childWorkspaces.forEach(k => allowed.add(k.toUpperCase()));
    }

    // PERF NOTE (Fix 3 — deferred): These two Firebase reads duplicate the reads in
    // loadMmasCohortData() and loadPeacsCohortData(), causing up to 6 full-node reads
    // per PI login. The fix is to populate window._atlasAssessmentsCache in the cohort
    // loaders and read from it here instead of hitting Firebase again. This is safe only
    // if the cohort loaders are guaranteed to have run first, which currently cannot be
    // assumed because resolveAllowedWorkspaces() and the cohort loaders race at login.
    // Requires a load-order guarantee (e.g. cohort loaders await resolveAllowedWorkspaces
    // and populate the cache before returning) — not safe to wire in isolation here.
    try {
      const snap = await database.ref('assessments').once('value');
      const all = snap.val();
      if (all) {
        Object.values(all).forEach(r => {
          const code     = (r.institution_code   || '').toUpperCase();
          const parentPi = (r.parent_pi          || '').toUpperCase();
          const parentIn = (r.parent_institution || '').toUpperCase();
          if (!code) return;
          // Path 1: direct parent_pi link
          if (parentPi === ws) allowed.add(code);
          // Path 2: full network umbrella — same parent institution
          if (myParentInst && parentIn === myParentInst) allowed.add(code);
        });
      }
    } catch(e) {
      if (window._atlasLog) window._atlasLog('warn', 'PI child discovery failed: ' + e.message);
    }
    try {
      const pSnap = await database.ref('peacs_assessments').once('value');
      const pAll = pSnap.val();
      if (pAll) {
        Object.values(pAll).forEach(r => {
          const code     = (r.institution_code   || '').toUpperCase();
          const parentPi = (r.parent_pi          || '').toUpperCase();
          const parentIn = (r.parent_institution || '').toUpperCase();
          if (!code) return;
          if (parentPi === ws) allowed.add(code);
          if (myParentInst && parentIn === myParentInst) allowed.add(code);
        });
      }
    } catch(e) {
      if (window._atlasLog) window._atlasLog('warn', 'PI PEACS child discovery failed: ' + e.message);
    }
    _allowedWSCache = allowed; _allowedWSCacheKey = ws; return allowed;
  }

  if (isIndependentMode() || (!isInstitutionMode())) {
    const r = new Set([ws]); _allowedWSCache = r; _allowedWSCacheKey = ws; return r;
  }

  // ── INSTITUTION: sees own workspace + all child PI workspaces ────────────
  // A child PI workspace has parent_institution === this institution's key.
  // We discover children dynamically from the assessments data so no manual
  // _childWorkspaces list needs to be maintained in SSM.
  const allowed = new Set([ws]);

  // Pull any statically-declared children from the profile (optional)
  if (workspaceProfile && workspaceProfile._childWorkspaces) {
    workspaceProfile._childWorkspaces.forEach(k => allowed.add(k.toUpperCase()));
  }

  // Dynamically discover children: any record whose institution_code has
  // a parent_institution pointing back to this institution key.
  // We do this by checking the assessments node for known child codes.
  // (Children tag their submissions with their own institution_code, and
  //  their SSM profile has parent_institution === this key.)
  // Since we can't query SSM from the client, we trust the data:
  // any institution_code value that appears in records submitted by a PI
  // whose parent_institution === ws is a child. We approximate this by
  // Dynamic child discovery: query Firebase assessments for any record
  // tagged with parent_institution === this institution key.
  // SSM profiles for child workspaces must have parent_institution set
  // (confirmed configured in AWS SSM) so submissions arrive pre-tagged.
  // PERF NOTE (Fix 3 — deferred): same triple-read issue as PI branch above.
  try {
    const snap = await database.ref('assessments').once('value');
    const all = snap.val();
    if (all) {
      Object.values(all).forEach(r => {
        const parent = (r.parent_institution || '').toUpperCase();
        if (parent === ws && r.institution_code) {
          allowed.add(r.institution_code.toUpperCase());
        }
      });
    }
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'resolveAllowedWorkspaces child discovery failed: ' + e.message);
  }

  // Also discover from PEACS assessments so command center patient panel
  // rolls up child PI cohorts correctly.
  try {
    const pSnap = await database.ref('peacs_assessments').once('value');
    const pAll = pSnap.val();
    if (pAll) {
      Object.values(pAll).forEach(r => {
        const parent = (r.parent_institution || '').toUpperCase();
        if (parent === ws && r.institution_code) {
          allowed.add(r.institution_code.toUpperCase());
        }
      });
    }
  } catch(e) {
    if (window._atlasLog) window._atlasLog('warn', 'resolveAllowedWorkspaces PEACS child discovery failed: ' + e.message);
  }

  _allowedWSCache = allowed;
  _allowedWSCacheKey = ws;
  return allowed;
}

// ── Country name → ISO2 resolver ─────────────────────────────────────────────
// Used at submission time so a manually typed country overrides the IP/GPS code.
const _COUNTRY_CODES = {afghanistan:'AF',albania:'AL',algeria:'DZ',angola:'AO',argentina:'AR',armenia:'AM',australia:'AU',austria:'AT',azerbaijan:'AZ',bahrain:'BH',bangladesh:'BD',belarus:'BY',belgium:'BE',bolivia:'BO',brazil:'BR',bulgaria:'BG',cambodia:'KH',cameroon:'CM',canada:'CA',chile:'CL',china:'CN',colombia:'CO','costa rica':'CR',croatia:'HR',cuba:'CU',cyprus:'CY','czech republic':'CZ',czechia:'CZ',denmark:'DK','dominican republic':'DO',ecuador:'EC',egypt:'EG','el salvador':'SV',ethiopia:'ET',finland:'FI',france:'FR',georgia:'GE',germany:'DE',ghana:'GH',greece:'GR',guatemala:'GT',honduras:'HN','hong kong':'HK',hungary:'HU',india:'IN',indonesia:'ID',iran:'IR',iraq:'IQ',ireland:'IE',israel:'IL',italy:'IT','ivory coast':'CI',jamaica:'JM',japan:'JP',jordan:'JO',kazakhstan:'KZ',kenya:'KE',kuwait:'KW',latvia:'LV',lebanon:'LB',libya:'LY',lithuania:'LT',luxembourg:'LU',malaysia:'MY',malta:'MT',mexico:'MX',moldova:'MD',morocco:'MA',mozambique:'MZ',myanmar:'MM',namibia:'NA',nepal:'NP',netherlands:'NL','new zealand':'NZ',nicaragua:'NI',nigeria:'NG','north korea':'KP','north macedonia':'MK',norway:'NO',oman:'OM',pakistan:'PK',panama:'PA',paraguay:'PY',peru:'PE',philippines:'PH',poland:'PL',portugal:'PT',qatar:'QA',romania:'RO',russia:'RU','russian federation':'RU','saudi arabia':'SA',senegal:'SN',serbia:'RS',singapore:'SG','slovak republic':'SK',slovakia:'SK',slovenia:'SI',somalia:'SO','south africa':'ZA','south korea':'KR',spain:'ES','sri lanka':'LK',sweden:'SE',switzerland:'CH',syria:'SY',taiwan:'TW',tajikistan:'TJ',tanzania:'TZ',thailand:'TH',tunisia:'TN',turkey:'TR',uganda:'UG',ukraine:'UA','united arab emirates':'AE',uae:'AE','united kingdom':'GB',uk:'GB','great britain':'GB','united states':'US',usa:'US','united states of america':'US',uruguay:'UY',uzbekistan:'UZ',venezuela:'VE',vietnam:'VN',yemen:'YE',zambia:'ZM',zimbabwe:'ZW'};
function resolveCountryCode(typedCountry, geoFallback) {
  if (typedCountry) {
    const key = typedCountry.trim().toLowerCase();
    if (_COUNTRY_CODES[key]) return _COUNTRY_CODES[key];
    if (key.length === 2) return key.toUpperCase(); // already an ISO2 code
  }
  return geoFallback || 'XX';
}

function refreshCommandCenter() {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  atlasAuditLog('command_center_read', { workspace: currentWorkspace });
  const iccRefresh = document.getElementById('icc-last-refresh');
  if (iccRefresh) iccRefresh.textContent = _t.status_loading || 'Loading…';

  // ── Set SDOH panels to loading state explicitly ───────────────────────────
  ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.86rem;">' + (_t.status_loading || 'Loading…') + '</div>';
  });

  resolveAllowedWorkspaces().then(allowedWS => {

    // ── Fire assessments and peacs_assessments in parallel ───────────────────
    // peacs_dimensions is fetched separately with its own error handler so a
    // permission_denied on that path (common before Firebase rules are updated)
    // doesn't kill the benchmark table, demographics, and patient panel.
    Promise.all([
      database.ref('assessments').once('value'),
      database.ref('peacs_assessments').once('value'),
    ]).then(([aSnap, pSnap]) => {

      // ── assessments ───────────────────────────────────────────────────────
      const all = aSnap.val();
      if (!all) { renderCommandCenterEmpty(); return; }

      Object.entries(all).forEach(([k, v]) => { v._fbKey = k; });

      const records = Object.values(all).filter(r => {
        if (r.map_q1 !== undefined) return false; // exclude MAP instrument records from MMAS-8 aggregates
        if (!r.institution_code) {
          if (allowedWS === null) { r._ws_display = 'PATIENT (Anonymous)'; return true; }
          return false;
        }
        if (allowedWS === null) return true;
        return allowedWS.has(r.institution_code.toUpperCase());
      });

      const mapRecords = Object.values(all).filter(r => {
        if (r.map_q1 === undefined) return false; // MAP instrument records only
        if (!r.institution_code) return allowedWS === null;
        if (allowedWS === null) return true;
        return allowedWS.has(r.institution_code.toUpperCase());
      });

      const byWS = {};
      records.forEach(r => { const ws=r._ws_display||r.institution_code||null; if(!ws||ws==='Unknown')return; if(!byWS[ws])byWS[ws]=[]; byWS[ws].push(r); });
      const totalPIs = Object.keys(byWS).length;
      const totalPts = records.length;
      const orgAvg   = totalPts > 0 ? (records.reduce((s,r)=>s+(r.score||0),0)/totalPts).toFixed(2) : '—';
      const orgAvgNum = parseFloat(orgAvg) || 0;
      const classP = r => { try { return classifyPattern(r); } catch(e) { return {intentional:0,unintentional:0}; } };
      const inaCount   = records.filter(r => { const p=classP(r); return p.intentional>p.unintentional; }).length;
      const unaCount   = records.filter(r => { const p=classP(r); return p.unintentional>p.intentional; }).length;
      const mixedCount = records.filter(r => { const p=classP(r); return p.intentional===p.unintentional && (r.score||0)!==8; }).length;
      const highCount  = records.filter(r => (r.score||0)===8).length;
      const inaRate    = totalPts > 0 ? Math.round(inaCount/totalPts*100)+'%' : '—';
      const countries  = new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
      const el = id => document.getElementById(id);

      // ── Purple collective banner ────────────────────────────────────────────
      const ws = (currentWorkspace || '').toUpperCase();
      const childWS = Object.keys(byWS).filter(w => w !== ws && w !== 'PATIENT (Anonymous)');
      const instName = workspaceProfile ? (workspaceProfile.name || ws) : ws;
      if (el('icc-institution-name'))  el('icc-institution-name').textContent  = instName;
      if (el('icc-child-count-badge')) el('icc-child-count-badge').textContent = childWS.length + ' workspaces';
      if (el('icc-coll-workspaces'))   el('icc-coll-workspaces').textContent   = childWS.length || totalPIs;
      if (el('icc-coll-patients'))     el('icc-coll-patients').textContent     = totalPts.toLocaleString();
      if (el('icc-coll-avg'))          el('icc-coll-avg').textContent          = orgAvg;
      if (el('icc-coll-ina'))          el('icc-coll-ina').textContent          = inaRate;
      if (el('icc-coll-high'))         el('icc-coll-high').textContent         = totalPts > 0 ? Math.round(highCount/totalPts*100)+'%' : '—';
      if (el('icc-coll-countries'))    el('icc-coll-countries').textContent    = countries;
      const distBar = el('icc-coll-dist-bar');
      if (distBar && totalPts > 0) {
        distBar.innerHTML = `
          <div style="flex:${inaCount};background:var(--poor);min-width:${inaCount?2:0}px;"></div>
          <div style="flex:${unaCount};background:var(--moderate);min-width:${unaCount?2:0}px;"></div>
          <div style="flex:${mixedCount};background:var(--mvmt);min-width:${mixedCount?2:0}px;"></div>
          <div style="flex:${highCount};background:var(--optimal);min-width:${highCount?2:0}px;border-radius:0 3px 3px 0;"></div>`;
      }
      const pct = n => totalPts > 0 ? Math.round(n/totalPts*100)+'%' : '—';
      if (el('icc-coll-ina-pct'))   el('icc-coll-ina-pct').textContent   = pct(inaCount);
      if (el('icc-coll-una-pct'))   el('icc-coll-una-pct').textContent   = pct(unaCount);
      if (el('icc-coll-mixed-pct')) el('icc-coll-mixed-pct').textContent = pct(mixedCount);
      if (el('icc-coll-high-pct'))  el('icc-coll-high-pct').textContent  = pct(highCount);

      const tbody = el('icc-benchmark-tbody');
      if (tbody) {
        if (!Object.keys(byWS).length) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.90rem;">No workspace-tagged submissions yet.</td></tr>';
        } else {
          window._benchRows=Object.entries(byWS).map(([ws,recs])=>{
            const n=recs.length,avg=n?(recs.reduce((s,r)=>s+(r.score||0),0)/n):0;
            const high=recs.filter(r=>(r.score||0)===8).length;
            const ina=recs.filter(r=>{const p=classP(r);return p.intentional>p.unintentional;}).length;
            const una=recs.filter(r=>{const p=classP(r);return p.unintentional>p.intentional;}).length;
            const diff=avg-orgAvgNum,diffStr=diff>=0?`<span style="color:var(--optimal)">+${diff.toFixed(2)}</span>`:`<span style="color:var(--poor)">${diff.toFixed(2)}</span>`;
            const cat=getAdherenceCategory(avg),highPct=n?Math.round(high/n*100):0;
            return {ws,html:`<tr class="bench-site-row" data-site-key="${ws}" onclick="applySiteFilter('${ws.replace(/'/g,'&#39;')}','${ws.replace(/'/g,'&#39;')}')" style="border-bottom:1px solid var(--border);"><td style="padding:10px 14px;font-family:var(--font-mono);font-size:0.80rem;color:var(--bright);">${_esc(ws)}</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--muted);">${n}</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.88rem;font-weight:500;color:${cat.color};">${avg.toFixed(2)}</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--optimal);">${highPct}%</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--poor);">${ina}</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.80rem;color:var(--moderate);">${una}</td><td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.90rem;">${diffStr}</td><td style="padding:10px;text-align:center;"><span style="font-family:var(--font-mono);font-size:0.80rem;padding:2px 7px;border-radius:10px;background:${cat.color}18;color:${cat.color};border:1px solid ${cat.color}44;">${cat.label}</span></td></tr>`};
          });
          renderBenchRows();
        }
      }

      const patBars = el('icc-pattern-bars'); if (patBars) patBars.innerHTML = '';

      // ── Conditions ────────────────────────────────────────────────────────
      const condList = el('icc-conditions-list');
      if (condList) {
        const condRaw = {}, condDisplay = {};
        records.forEach(r => {
          if (!r.condition) return;
          const norm = normalizeCondition(r.condition);
          if (!norm) return;
          condRaw[norm.key] = (condRaw[norm.key]||0) + 1;
          if (!condDisplay[norm.key]) condDisplay[norm.key] = norm.label;
        });
        const sorted = Object.entries(condRaw).sort((a,b)=>b[1]-a[1]).slice(0, 8);
        const maxCn = sorted[0]?.[1] || 1;
        condList.innerHTML = sorted.length ? sorted.map(([k,n]) => {
          const label = condDisplay[k] || k;
          return `<div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${label}">${label}</span>
            <div style="flex-shrink:0;width:40px;height:4px;background:var(--card2);border-radius:2px;overflow:hidden;">
              <div style="width:${Math.round(n/maxCn*100)}%;height:100%;background:var(--base);border-radius:2px;"></div>
            </div>
            <span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--base);flex-shrink:0;min-width:18px;text-align:right;">${n}</span>
          </div>`;
        }).join('') : '<span style="color:var(--dim);font-size:0.86rem;">No condition data yet.</span>';
      }

      if (iccRefresh) iccRefresh.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
      try { renderICCDemographics(records); } catch(e) { console.error('renderICCDemographics error:', e); }

      // ── peacs_assessments (parallel fetch) ───────────────────────────────
      const peacsRaw = pSnap.val() || {};
      Object.entries(peacsRaw).forEach(([k, v]) => { v._fbKey = k; });
      const peacsAll = Object.values(peacsRaw);
      const peacsFiltered = allowedWS === null ? peacsAll : peacsAll.filter(r => {
        const code = (r.institution_code || '').toUpperCase();
        return code && allowedWS.has(code);
      });
      try { buildPatientPanel(records, peacsFiltered, mapRecords); } catch(e) {
        console.error('buildPatientPanel error:', e);
        const _ptbody = document.getElementById('icc-patient-tbody');
        if (_ptbody) _ptbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--poor);padding:20px;font-family:var(--font-mono);font-size:0.86rem;">Patient panel error: ${(e&&e.message||String(e)).slice(0,120)}</td></tr>`;
      }

      // ── Avg preliminary PE (mmas_pe) in collective banner ────────────────
      if (el('icc-coll-avg-pe')) {
        const peVals = records.map(r => r.mmas_pe).filter(v => typeof v === 'number' && !isNaN(v));
        const avgPE  = peVals.length > 0 ? (peVals.reduce((s, v) => s + v, 0) / peVals.length) : null;
        el('icc-coll-avg-pe').textContent = avgPE !== null ? avgPE.toFixed(3) : '—';
        const peColor = avgPE === null ? 'var(--mvmt)'
          : avgPE >= 0.85 ? '#10b981'
          : avgPE >= 0.70 ? '#3b82f6'
          : avgPE >= 0.55 ? '#f59e0b'
          : '#ef4444';
        el('icc-coll-avg-pe').style.color = peColor;
      }

      // ── peacs_dimensions — separate read with its own error handler ───────
      // Isolated so a permission_denied here doesn't affect anything above.
      // After deploying updated Firebase rules (add root .read for institution
      // + superadmin on peacs_dimensions), this will populate correctly.
      const wsPatientNums = new Set(
        records.filter(r => r.patient_number)
               .map(r => String(r.patient_number).trim().toUpperCase())
      );

      // Force token refresh so the database connection uses the latest claims.
      const _dimRead = () => database.ref('peacs_dimensions').once('value');
      const _user = firebase.auth().currentUser;
      (_user ? _user.getIdToken(true) : Promise.resolve())
        .catch(() => {})
        .then(freshToken => {
          if (freshToken && typeof freshToken === 'string') {
            try {
              const _pay = JSON.parse(atob(freshToken.split('.')[1]));
              console.log('[ATLAS] peacs_dimensions token claims at read time:', JSON.stringify({role:_pay.role, workspace:_pay.workspace, tier:_pay.tier}));
            } catch(_) {}
          }
          return _dimRead();
        })
        .then(dimSnap => {
          const dimData = dimSnap.val() || {};
          const strataRecords = [];
          Object.values(dimData).forEach(patDims => {
            if (!patDims || !patDims.strata) return;
            const sr = patDims.strata;
            const code   = (sr.institution_code || '').toUpperCase();
            const patNum = sr.patient_number ? String(sr.patient_number).trim().toUpperCase() : null;
            if (allowedWS === null) {
              strataRecords.push(sr);
            } else if (code && allowedWS.has(code)) {
              strataRecords.push(sr);
            } else if (!code && patNum && wsPatientNums.has(patNum)) {
              sr._ws_fallback = true;
              strataRecords.push(sr);
            }
          });
          try {
            renderICCSDoH(strataRecords, peacsFiltered, records);
          } catch(e) {
            console.error('renderICCSDoH error:', e);
            const errHtml = `<span style="color:var(--poor);font-family:var(--font-mono);font-size:0.88rem;">SDOH render error: ${(e&&e.message||String(e)).slice(0,100)}</span>`;
            ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk']
              .forEach(id => { const e2=document.getElementById(id); if(e2) e2.innerHTML=errHtml; });
          }
        })
        .catch(permErr => {
          const errCode = permErr && permErr.code;
          const errMsg  = permErr && permErr.message ? permErr.message : String(permErr);
          console.warn('peacs_dimensions read error:', errCode, errMsg);
          // Diagnose: if permission_denied the token role claim is missing/wrong.
          // Rules are global — once set they cover all institutions. Check the user's
          // Firebase custom claim: firebase.auth().currentUser.getIdTokenResult()
          //   then inspect .claims.role — it must equal 'institution'.
          const isPermDenied = errCode === 'PERMISSION_DENIED' || (errMsg && errMsg.toLowerCase().includes('permission'));
          const fixMsg = isPermDenied
            ? `<span style="color:var(--muted);font-family:var(--font-mono);font-size:0.88rem;">
                SDOH access denied — Firebase rules are correct.<br/>
                This user's auth token is missing the <code style="color:var(--pe);">role: 'institution'</code> custom claim.<br/>
                Have the user log out and back in, or verify the Lambda sets custom claims for this key.
               </span>`
            : `<span style="color:var(--muted);font-family:var(--font-mono);font-size:0.88rem;">
                SDOH load error: <code style="color:var(--poor);">${errCode || errMsg}</code>
               </span>`;
          ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk']
            .forEach(id => { const e2=document.getElementById(id); if(e2) e2.innerHTML=fixMsg; });
        });

    }).catch(e => {
      const msg = e && e.message ? e.message : String(e);
      console.error('refreshCommandCenter error:', msg, e);
      if (iccRefresh) iccRefresh.textContent = 'Error: ' + msg.slice(0, 80);
      const errHtml = `<span style="color:var(--poor);font-family:var(--font-mono);font-size:0.88rem;">Error: ${msg.slice(0,120)}<br/>Check browser console (F12) for details.</span>`;
      ['icc-sdoh-living','icc-sdoh-access','icc-sdoh-literacy','icc-sdoh-support','icc-sdoh-risk'].forEach(id => {
        const e2 = document.getElementById(id); if (e2) e2.innerHTML = errHtml;
      });
    });

  }); // end resolveAllowedWorkspaces.then
} // end refreshCommandCenter
function renderCommandCenterEmpty() {
  const tbody=document.getElementById('icc-benchmark-tbody');
  if(tbody) tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.90rem;">No institution data found.</td></tr>';
}
window._benchRows=[];window._benchPageSize=20;window._benchQuery='';
function renderBenchRows(){
  var tb=document.getElementById('icc-benchmark-tbody');if(!tb)return;
  var q=(window._benchQuery||'').toLowerCase();
  var rows=window._benchRows||[];
  var f=q?rows.filter(function(r){return r.ws.toLowerCase().indexOf(q)>=0;}):rows;
  var ps=window._benchPageSize||20;
  if(!f.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:20px;font-family:var(--font-mono);font-size:0.90rem;">No workspaces match.</td></tr>';return;}
  var html=f.slice(0,ps).map(function(r){return r.html;}).join('');
  if(f.length>ps)html+='<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:7px;font-family:var(--font-mono);font-size:0.80rem;border-top:1px solid var(--border);">Showing '+ps+' of '+f.length+' workspaces</td></tr>';
  tb.innerHTML=html;
}
function filterBenchmarkTable(q){window._benchQuery=q||'';renderBenchRows();}
function setBenchPageSize(v){window._benchPageSize=parseInt(v)||20;renderBenchRows();}

// ── Site Benchmarking Drill-Down ─────────────────────
let _activeSiteFilter = null;

function applySiteFilter(siteKey, siteLabel) {
  _activeSiteFilter = siteKey;
  const banner = document.getElementById('site-filter-banner');
  const label = document.getElementById('site-filter-label');
  if (banner) banner.classList.add('visible');
  if (label) label.textContent = siteLabel || siteKey;
  document.querySelectorAll('.bench-site-row').forEach(r => {
    r.classList.toggle('active', r.dataset.siteKey === siteKey);
  });
  filterPatientPanelBySite(_activeSiteFilter);
}

function clearSiteFilter() {
  _activeSiteFilter = null;
  const banner = document.getElementById('site-filter-banner');
  if (banner) banner.classList.remove('visible');
  document.querySelectorAll('.bench-site-row').forEach(r => r.classList.remove('active'));
  filterPatientPanelBySite(null);
}

function filterPatientPanelBySite(siteKey) {
  const wsSel = document.getElementById('icc-patient-ws-filter');
  if (wsSel) {
    // Case-insensitive option match — wsSel.value = X silently fails if no exact match
    const match = siteKey
      ? [...wsSel.options].find(o => o.value.toUpperCase() === siteKey.toUpperCase())
      : null;
    wsSel.value = match ? match.value : '';
  }
  const searchInput = document.getElementById('icc-patient-search');
  filterPatientPanel(searchInput ? searchInput.value : '');
}

// ── Patient Activity Panel ────────────────────────────────────────────────────
// Merges MMAS assessments + PEACS assessments by patient_number, shows coverage
window._patientPanelData = []; // cache for filter

function buildPatientPanel(mmasRecords, peacsRecords, mapRecords = []) {
  const byPatient = {};
  const _initPt = (pid, ws, wsRaw) => ({ pid, ws: wsRaw || '—', mmas: [], peacs: [], map: [], lastTs: 0, studies: new Set() });

  mmasRecords.forEach(r => {
    const pid = (r.patient_number || '').toString().trim().toUpperCase();
    if (!pid) return;
    const ws = (r.institution_code || '').toUpperCase();
    const key = pid + '|' + ws;
    if (!byPatient[key]) byPatient[key] = _initPt(pid, ws, r.institution_code);
    byPatient[key].mmas.push(r);
    if ((r.timestamp || 0) > byPatient[key].lastTs) byPatient[key].lastTs = r.timestamp || 0;
    if (r.study_title) byPatient[key].studies.add(r.study_title);
  });

  peacsRecords.forEach(r => {
    const pid = (r.patient_number || '').toString().trim().toUpperCase();
    if (!pid) return;
    const ws = (r.institution_code || '').toUpperCase();
    const key = pid + '|' + ws;
    if (!byPatient[key]) byPatient[key] = _initPt(pid, ws, r.institution_code);
    byPatient[key].peacs.push(r);
    if ((r.timestamp || 0) > byPatient[key].lastTs) byPatient[key].lastTs = r.timestamp || 0;
    if (byPatient[key].ws === '—' && r.institution_code) byPatient[key].ws = r.institution_code;
    if (r.study_title) byPatient[key].studies.add(r.study_title);
  });

  mapRecords.forEach(r => {
    const pid = (r.patient_number || '').toString().trim().toUpperCase();
    if (!pid) return;
    const ws = (r.institution_code || '').toUpperCase();
    const key = pid + '|' + ws;
    if (!byPatient[key]) byPatient[key] = _initPt(pid, ws, r.institution_code);
    byPatient[key].map.push(r);
    if ((r.timestamp || 0) > byPatient[key].lastTs) byPatient[key].lastTs = r.timestamp || 0;
    if (byPatient[key].ws === '—' && r.institution_code) byPatient[key].ws = r.institution_code;
    if (r.study_title) byPatient[key].studies.add(r.study_title);
  });

  const rows = Object.values(byPatient).sort((a, b) => b.lastTs - a.lastTs);
  window._patientPanelData = rows;

  // ── Surface quick-filter bar above the patient records table ─────────────
  const patientTableWrap = document.getElementById('icc-patient-tbody')?.closest('table')?.parentElement;
  if (patientTableWrap) _injectPatientQuickFilter(patientTableWrap);
  _populateQuickFilterConditions(rows);

  renderPatientRows(rows);
  if (typeof populatePatientWorkspaceDropdown === 'function') populatePatientWorkspaceDropdown();
  if (typeof populatePatientStudyDropdown === 'function') populatePatientStudyDropdown();
}

// ── Quick-filter bar for patient panel ──────────────────────────────────────
function _injectPatientQuickFilter(containerEl) {
  if (document.getElementById('patient-quick-filter-bar')) return; // already injected
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const bar = document.createElement('div');
  bar.id = 'patient-quick-filter-bar';
  bar.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0 14px;';
  bar.innerHTML = `
    <input id="pqf-search" type="search" placeholder="Search patient ID or condition…"
      style="flex:1;min-width:160px;font-family:var(--font-mono);font-size:0.78rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);padding:8px 12px;border-radius:8px;outline:none;"
      oninput="applyPatientQuickFilter()" />
    <select id="pqf-condition"
      style="font-family:var(--font-mono);font-size:0.75rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer;"
      onchange="applyPatientQuickFilter()">
      <option value="">${_t.filter_all_conditions || 'All conditions'}</option>
    </select>
    <select id="pqf-tier"
      style="font-family:var(--font-mono);font-size:0.75rem;background:var(--card2);border:1px solid var(--border2);color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer;"
      onchange="applyPatientQuickFilter()">
      <option value="">All tiers</option>
      <option value="high">HIGH only</option>
      <option value="medium">MED only</option>
      <option value="low">LOW only</option>
    </select>`;
  containerEl.insertBefore(bar, containerEl.firstChild);
}

function _populateQuickFilterConditions(rows) {
  const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  const sel = document.getElementById('pqf-condition');
  if (!sel) return;
  const condSet = new Set();
  rows.forEach(p => {
    (p.mmas || []).forEach(r => { if (r.condition) condSet.add(r.condition); });
    (p.peacs || []).forEach(r => { if (r.condition) condSet.add(r.condition); });
  });
  const current = sel.value;
  const opts = [...condSet].sort().map(c => `<option value="${c.toLowerCase()}"${c.toLowerCase()===current?' selected':''}>${c}</option>`).join('');
  sel.innerHTML = '<option value="">' + (_t.filter_all_conditions || 'All conditions') + '</option>' + opts;
}

function applyPatientQuickFilter() {
  const search = (document.getElementById('pqf-search')?.value || '').toLowerCase();
  const condition = (document.getElementById('pqf-condition')?.value || '').toLowerCase();
  const tier = (document.getElementById('pqf-tier')?.value || '').toLowerCase();

  document.querySelectorAll('.records-table tbody tr, .icc-patient-row').forEach(row => {
    const text = row.textContent.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchCondition = !condition || text.includes(condition);
    const matchTier = !tier || row.dataset.tier === tier || text.includes(tier);
    row.style.display = (matchSearch && matchCondition && matchTier) ? '' : 'none';
  });
}

// Pagination state
window._patientPage     = 1;
window._patientPageSize = 20;
window._patientFiltered = [];

function renderPatientRows(rows) {
  const tbody = document.getElementById('icc-patient-tbody');
  const empty = document.getElementById('icc-patient-empty');
  const pagination = document.getElementById('icc-patient-pagination');
  if (!tbody) return;

  window._patientFiltered = rows;
  window._patientPage = 1;
  _renderPatientPage();
}

function _renderPatientPage() {
  const rows      = window._patientFiltered || [];
  const page      = window._patientPage;
  const pageSize  = window._patientPageSize;
  const tbody     = document.getElementById('icc-patient-tbody');
  const empty     = document.getElementById('icc-patient-empty');
  const pagination= document.getElementById('icc-patient-pagination');
  const pageInfo  = document.getElementById('icc-patient-pageinfo');
  const pageBtns  = document.getElementById('icc-patient-page-btns');
  const prevBtn   = document.getElementById('icc-pat-prev');
  const nextBtn   = document.getElementById('icc-pat-next');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (pagination) pagination.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';

  const totalPages = Math.ceil(rows.length / pageSize);
  const start      = (page - 1) * pageSize;
  const pageRows   = rows.slice(start, start + pageSize);

  const timeAgo = ts => {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return 'Just now';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    if (d < 86400) return Math.floor(d/3600) + 'h ago';
    if (d < 604800) return Math.floor(d/86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  };

  tbody.innerHTML = pageRows.map((p, localI) => {
    const i        = start + localI; // global index for toggle IDs
    const hasMmas  = p.mmas.length > 0;
    const hasPeacs = p.peacs.length > 0;
    const hasMap   = p.map && p.map.length > 0;
    const hasAny   = hasMmas || hasPeacs || hasMap;
    const coverageColor = (hasMmas || hasMap) && hasPeacs ? 'var(--optimal)' : hasAny ? 'var(--moderate)' : 'var(--poor)';
    const coverageLabel = (hasMmas && hasPeacs) || (hasMap && hasPeacs) ? 'Complete'
      : hasMmas && hasMap ? 'MMAS + MAP'
      : hasMmas ? 'MMAS only'
      : hasMap ? 'MAP only'
      : hasPeacs ? 'PEACS only'
      : 'None';
    const mmasScore = hasMmas ? _recomputeMMASScore(p.mmas[p.mmas.length-1]).toFixed(2) : null;
    const mmasInterp = hasMmas ? (typeof mmasScoreInterpretation === 'function' ? mmasScoreInterpretation(mmasScore) : null) : null;
    const peScore   = hasPeacs ? (p.peacs[p.peacs.length-1].pe_score !== undefined ? p.peacs[p.peacs.length-1].pe_score.toFixed(2) : '✓') : null;
    const mapLatest = hasMap ? p.map.reduce((b, r) => (!b || (r.timestamp||0) > (b.timestamp||0)) ? r : b, null) : null;
    const mapScore  = mapLatest && mapLatest.score !== undefined ? parseFloat(mapLatest.score).toFixed(3) : null;
    const mapColor  = !mapScore ? 'var(--dim)' : parseFloat(mapScore) >= 0.85 ? 'var(--optimal)' : parseFloat(mapScore) >= 0.70 ? 'var(--base)' : parseFloat(mapScore) >= 0.55 ? 'var(--moderate)' : 'var(--poor)';

    return `<tr id="pat-row-${i}" style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="togglePatientDetail(${i})" data-pid="${_esc(p.pid)}" data-ws="${_esc(p.ws)}">
      <td style="padding:10px 14px;font-family:var(--font-mono);font-size:0.71rem;color:var(--bright);font-weight:500;">${_esc(p.pid)}</td>
      <td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.61rem;color:var(--dim);">${_esc(p.ws)}</td>
      <td style="padding:10px;text-align:center;">
        ${hasMmas
          ? `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;"><span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--base);font-weight:600;">${mmasScore}${mmasInterp ? mmasInterp.badge : ''}</span><span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">${p.mmas.length}×</span></span>`
          : `<span style="color:var(--border2);font-size:0.86rem;">—</span>`}
      </td>
      <td style="padding:10px;text-align:center;">
        ${hasMap
          ? `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;"><span style="font-family:var(--font-mono);font-size:0.90rem;color:${mapColor};font-weight:600;">${mapScore}</span><span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">${p.map.length}×</span></span>`
          : `<span style="color:var(--border2);font-size:0.86rem;">—</span>`}
      </td>
      <td style="padding:10px;text-align:center;">
        ${hasPeacs
          ? `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;"><span style="font-family:var(--font-mono);font-size:0.90rem;color:var(--strata);font-weight:600;">${peScore}</span><span style="font-family:var(--font-mono);font-size:0.86rem;color:var(--dim);">${p.peacs.length}×</span></span>`
          : `<span style="color:var(--border2);font-size:0.86rem;">—</span>`}
      </td>
      <td style="padding:10px;text-align:center;">
        <span style="font-family:var(--font-mono);font-size:0.80rem;padding:2px 8px;border-radius:10px;background:${coverageColor}18;color:${coverageColor};border:1px solid ${coverageColor}44;">${coverageLabel}</span>
      </td>
      <td style="padding:10px;font-family:var(--font-mono);font-size:0.88rem;color:var(--muted);">${timeAgo(p.lastTs)}</td>
      <td style="padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.90rem;color:var(--dim);" id="pat-chevron-${i}">▸</td>
    </tr>
    <tr id="pat-detail-${i}" style="display:none;background:var(--card2);border-bottom:1px solid var(--border);">
      <td colspan="8" style="padding:14px 18px;">
        ${(() => {
          const sMap = {};
          p.mmas.forEach(r => {
            if (!r.study_title) return;
            const k = r.study_title;
            if (!sMap[k]) sMap[k] = { title: r.study_title, pi: r.pi_name || null, institution: r.study_institution || null, earliest: Infinity, latest: 0 };
            if ((r.timestamp||0) < sMap[k].earliest) sMap[k].earliest = r.timestamp;
            if ((r.timestamp||0) > sMap[k].latest)   sMap[k].latest   = r.timestamp;
          });
          const ss = Object.values(sMap);
          if (!ss.length) return '';
          const fd = ts => ts === Infinity || !ts ? '—' : new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
          return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            ${ss.map(s => `<div style="background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.18);border-radius:8px;padding:8px 14px;min-width:180px;flex:1;">
              <div style="font-family:var(--font-mono);font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(78,156,245,0.5);margin-bottom:3px;">Study Source</div>
              <div style="font-size:0.86rem;color:var(--text);font-weight:500;margin-bottom:2px;">${s.title}</div>
              ${s.pi ? `<div style="font-size:0.78rem;color:var(--muted);">${s.pi}${s.institution ? ' · ' + s.institution : ''}</div>` : ''}
              <div style="font-family:var(--font-mono);font-size:0.70rem;color:var(--dim);margin-top:3px;">${fd(s.earliest)} – ${fd(s.latest)}</div>
            </div>`).join('')}
          </div>`;
        })()}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--base);margin-bottom:8px;">MMAS-8 History</div>
            ${hasMmas
              ? p.mmas.map(r => {
                  const fbk = r._fbKey || '';
                  const _canEditMmas = isSuperAdmin() || (isPi() && workspaceProfile?.can_edit_children && (r.parent_pi||'').toUpperCase() === currentWorkspace);
                  const editBtn = _canEditMmas ? `<button onclick="event.stopPropagation();atlasEditRecord('assessments','${fbk}',${JSON.stringify(r).replace(/"/g,'&quot;')})" style="font-family:var(--font-mono);font-size:0.86rem;padding:1px 6px;border-radius:3px;border:1px solid rgba(78,156,245,0.4);background:rgba(78,156,245,0.08);color:var(--base);cursor:pointer;margin-left:6px;">✎ Edit</button><button onclick="event.stopPropagation();atlasDeleteRecord('assessments','${fbk}','${p.pid}')" style="font-family:var(--font-mono);font-size:0.86rem;padding:1px 6px;border-radius:3px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:var(--poor);cursor:pointer;margin-left:3px;">✕ Delete</button>` : '';
                  const _rsc = _recomputeMMASScore(r);
                  const _si = typeof mmasScoreInterpretation === 'function' ? mmasScoreInterpretation(_rsc) : null;
                  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:0.88rem;"><span style="color:var(--muted);">${new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><span style="color:var(--base);font-weight:600;">Score: ${_rsc.toFixed(2)}${_si ? _si.badge : ''}</span><span style="color:var(--dim);">${r.adherence_level||'—'}</span><span>${editBtn}</span></div>`;
                }).join('')
              : `<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No MMAS-8 recorded</div>`}
          </div>
          <div>
            <div style="font-family:var(--font-mono);font-size:0.80rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--strata);margin-bottom:8px;">PEACS History</div>
            ${hasPeacs
              ? p.peacs.map(r => {
                  const fbk = r._fbKey || '';
                  const _canEditPeacs = isSuperAdmin() || (isPi() && workspaceProfile?.can_edit_children && (r.parent_pi||'').toUpperCase() === currentWorkspace);
                  const editBtn = _canEditPeacs ? `<button onclick="event.stopPropagation();atlasEditRecord('peacs_assessments','${fbk}',${JSON.stringify(r).replace(/"/g,'&quot;')})" style="font-family:var(--font-mono);font-size:0.86rem;padding:1px 6px;border-radius:3px;border:1px solid rgba(46,201,138,0.4);background:rgba(46,201,138,0.08);color:var(--strata);cursor:pointer;margin-left:6px;">✎ Edit</button><button onclick="event.stopPropagation();atlasDeleteRecord('peacs_assessments','${fbk}','${p.pid}')" style="font-family:var(--font-mono);font-size:0.86rem;padding:1px 6px;border-radius:3px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:var(--poor);cursor:pointer;margin-left:3px;">✕ Delete</button>` : '';
                  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:0.88rem;"><span style="color:var(--muted);">${new Date(r.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><span style="color:var(--strata);font-weight:600;">${r.pe_score !== undefined ? 'PE: '+Number(r.pe_score).toFixed(2) : '✓ Completed'}</span><span style="color:var(--dim);">${r.adherence_level||r.risk_level||'—'}</span><span>${editBtn}</span></div>`;
                }).join('')
              : `<div style="color:var(--dim);font-family:var(--font-mono);font-size:0.88rem;">No PEACS recorded</div>`}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Update pagination controls
  if (pagination) pagination.style.display = totalPages > 1 ? 'flex' : 'none';
  if (pageInfo)   pageInfo.textContent = `Showing ${start + 1}–${Math.min(start + pageSize, rows.length)} of ${rows.length} patients`;
  if (prevBtn)    prevBtn.disabled = page <= 1;
  if (nextBtn)    nextBtn.disabled = page >= totalPages;

  // Page number buttons — show up to 7 around current page
  if (pageBtns) {
    const range = [];
    const delta = 3;
    for (let p = Math.max(1, page - delta); p <= Math.min(totalPages, page + delta); p++) range.push(p);
    pageBtns.innerHTML = range.map(p =>
      `<button onclick="patientGoToPage(${p})" style="font-family:var(--font-mono);font-size:0.61rem;min-width:26px;padding:3px 6px;border-radius:4px;cursor:pointer;border:1px solid ${p===page ? 'var(--base)' : 'var(--border2)'};background:${p===page ? 'rgba(78,156,245,0.15)' : 'none'};color:${p===page ? 'var(--base)' : 'var(--muted)'};">${p}</button>`
    ).join('');
  }
}

function togglePatientDetail(i) { openPatientProfile(i); }

// ── Full Patient Profile Panel ────────────────────────────────────────────────
function openPatientProfile(globalIndex) {
  const p = (window._patientFiltered || [])[globalIndex];
  if (!p) return;

  const old = document.getElementById('pt-profile-panel');
  const oldOv = document.getElementById('pt-profile-overlay');
  if (old) old.remove();
  if (oldOv) oldOv.remove();

  const fd  = ts => ts ? new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  const esc = s  => (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const SDOH_META = {
    sq1:{label:'Medication Support', opts:['Spouse','Family member','Friend/caregiver','Manages alone']},
    sq2:{label:'Financial Barrier',  opts:['No barrier','Minor barrier','Moderate barrier','Severe barrier']},
    sq3:{label:'Living Situation',   opts:['With family','Alone — support nearby','Assisted living','Isolated/alone']},
    sq4:{label:'Health Literacy',    opts:['High','Good','Limited','Low']},
    sq5:{label:'Transportation',     opts:['Reliable','Available','Difficult to access','Cannot access']},
    sq6:{label:'Medication Access',  opts:['Always available','Usually available','Sometimes unavailable','Often unavailable']},
    sq7:{label:'Caregiver Burden',   opts:['None','Mild','Moderate','Severe']},
    sq8:{label:'Treatment Belief',   opts:['Strongly believes','Generally believes','Uncertain','Often doubts']},
  };

  // Scoring: 0=non-adherent (problem), 1=adherent (no problem) for Q1–Q7
  // Q5 is reverse-scored in both instruments: Yes=1=good, No=0=problem
  // Q8: Likert — float 0–1 (1=Never=best) OR integer 0–4 (0=Never=best, MMAS bulk path)

  const MMAS8_Q = [
    {k:'q1', text:'Do you sometimes forget to take your medicine?'},
    {k:'q2', text:'Over the past two weeks, were there any days when you did not take your medicine?'},
    {k:'q3', text:'Have you ever cut back or stopped taking your medication without telling your doctor because you felt worse when you took it?'},
    {k:'q4', text:'When you travel or leave home, do you sometimes forget to bring along your medication?'},
    {k:'q5', text:'Did you take your medicine yesterday?', reverse:true},
    {k:'q6', text:'When you feel like your condition is under control, do you sometimes stop taking your medicine?'},
    {k:'q7', text:'Taking medication every day is a real inconvenience for some people. Do you ever feel hassled about sticking to your treatment plan?'},
    {k:'q8', text:'How often do you have difficulty remembering to take all your medication?', likert:true},
  ];

  const MAP_INSTRUMENT_Q = [
    {k:'map_q1', text:'Are there times when you forget to take your medications?'},
    {k:'map_q2', text:'In the past two weeks, have there been times when you chose to skip a dose — for example, because of side effects, cost, or feeling better?'},
    {k:'map_q3', text:'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?'},
    {k:'map_q4', text:'When your daily routine changes (e.g. traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?'},
    {k:'map_q5', text:'Were you able to take your last dose as directed?', reverse:true},
    {k:'map_q6', text:'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?'},
    {k:'map_q7', text:'Does keeping up with your medication routine feel like a big challenge in your everyday life?'},
    {k:'map_q8', text:'In a typical week, how often do you have trouble taking all your medications as prescribed?', likert:true},
  ];

  function isMapRecord(r) { return r.tool === 'map' || r.map_q1 !== undefined; }

  // Q8 Likert label — float 0–1 (1=Never=best) or integer 0–4 (0=Never=best)
  function q8Label(raw) {
    const n = parseFloat(raw);
    if (isNaN(n)) return null;
    if (Number.isInteger(n) && n >= 0 && n <= 4) {
      const lbls = ['Never','Once in a while','Sometimes','Usually','All of the time'];
      const cols = ['var(--optimal)','var(--optimal)','var(--moderate)','var(--poor)','var(--poor)'];
      return {text: lbls[n], color: cols[n]};
    }
    if (n >= 0.88) return {text:'Never',          color:'var(--optimal)'};
    if (n >= 0.63) return {text:'Rarely',          color:'var(--optimal)'};
    if (n >= 0.38) return {text:'Sometimes',       color:'var(--moderate)'};
    if (n >= 0.13) return {text:'Often',           color:'var(--poor)'};
    return               {text:'All of the time', color:'var(--poor)'};
  }

  function sqLabel(raw, opts) {
    if (raw === undefined || raw === null) return null;
    const n = parseFloat(raw);
    if (isNaN(n)) return null;
    if (n >= 0 && n <= 1) {
      if (n >= 0.9) return opts[0];
      if (n >= 0.58) return opts[1];
      if (n >= 0.2) return opts[2];
      return opts[3];
    }
    if (Number.isInteger(n) && n >= 0 && n <= 3) return opts[n];
    return null;
  }

  function sqColor(raw) {
    if (raw === undefined || raw === null) return 'var(--dim)';
    const n = parseFloat(raw);
    if (isNaN(n)) return 'var(--dim)';
    const v = (n >= 0 && n <= 1) ? n : [0.9,0.7,0.4,0.1][Math.min(Math.floor(n),3)] ?? 0;
    if (v >= 0.7) return 'var(--optimal)';
    if (v >= 0.45) return 'var(--moderate)';
    return 'var(--poor)';
  }

  // ── Header data ─────────────────────────────────────────────────────────────
  const latestMmas  = p.mmas.length  ? p.mmas[p.mmas.length-1]   : null;
  const latestPeacs = p.peacs.length ? p.peacs[p.peacs.length-1] : null;
  const condition   = latestMmas?.condition   || latestPeacs?.condition  || '—';
  const country     = latestMmas?.country     || latestPeacs?.country    || '—';
  const city        = latestMmas?.city        || '—';
  const medication  = latestMmas?.medication  || '—';
  const locStr      = [city !== '—' ? city : null, country !== '—' ? country : null].filter(Boolean).join(', ') || '—';

  // ── Demographics ─────────────────────────────────────────────────────────────
  const demoItems = [
    ['Age', latestMmas?.age], ['Gender', latestMmas?.gender], ['Education', latestMmas?.education],
    ['Insurance', latestMmas?.insurance], ['Employment', latestMmas?.employment],
    ['Income', latestMmas?.income], ['Housing', latestMmas?.housing], ['Medication', medication],
  ].filter(([,v]) => v && v !== '—' && v !== 'undefined');

  const demoHtml = demoItems.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">
      ${demoItems.map(([l,v]) => `<div style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-family:var(--font-mono);font-size:0.68rem;">
        <span style="color:var(--dim);">${l}: </span><span style="color:var(--text);">${esc(v)}</span></div>`).join('')}
    </div>` : '';

  // ── SDoH ────────────────────────────────────────────────────────────────────
  const sdohSrc = [...p.mmas, ...p.peacs].find(r => Object.keys(SDOH_META).some(k => r[k] !== undefined)) || {};
  const sdohRows = Object.entries(SDOH_META).map(([k, meta]) => {
    const lbl = sqLabel(sdohSrc[k], meta.opts);
    if (!lbl) return '';
    const col = sqColor(sdohSrc[k]);
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:0.76rem;">
      <span style="color:var(--dim);flex:0 0 155px;">${meta.label}</span>
      <span style="width:6px;height:6px;border-radius:50%;background:${col};flex-shrink:0;box-shadow:0 0 4px ${col}80;"></span>
      <span style="color:var(--text);">${esc(lbl)}</span>
    </div>`;
  }).join('');

  const sdohHtml = sdohRows ? `
    <div style="margin-bottom:20px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(78,156,245,0.65);margin-bottom:8px;">Social Determinants of Health</div>
      ${sdohRows}
    </div>` : '';

  // ── MMAS / MAP Assessments ─────────────────────────────────────────────────
  const mmasHtml = p.mmas.length ? `
    <div style="margin-bottom:20px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--base);margin-bottom:10px;">MMAS-8 / MAP Assessments (${p.mmas.length})</div>
      ${p.mmas.map((r, idx) => {
        const isMap   = isMapRecord(r);
        const qSet    = isMap ? MAP_INSTRUMENT_Q : MMAS8_Q;
        const instrLbl= isMap ? 'MAP' : 'MMAS-8';
        const _rsc    = _recomputeMMASScore(r);
        const cat     = typeof getAdherenceCategory === 'function' ? getAdherenceCategory(_rsc) : {color:'var(--base)',label:''};
        const hasItems= qSet.some(q => r[q.k] !== undefined && r[q.k] !== null);
        const itemsId = `pt-map-${globalIndex}-${idx}`;
        const itemsHtml = hasItems ? `
          <div id="${itemsId}" style="display:none;margin-top:8px;padding:8px 10px;background:var(--card);border-radius:6px;border:1px solid var(--border);">
            ${qSet.map(q => {
              if (r[q.k] === undefined || r[q.k] === null) return '';
              if (q.likert) {
                const lk = q8Label(r[q.k]);
                if (!lk) return '';
                return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-family:var(--font-mono);font-size:0.70rem;">
                  <span style="color:${lk.color};flex-shrink:0;">◈</span>
                  <span style="color:var(--muted);flex:1;">${q.text} <span style="color:var(--dim);font-size:0.62rem;">(5-pt)</span></span>
                  <span style="color:${lk.color};font-weight:500;">${lk.text}</span>
                </div>`;
              }
              // 0=non-adherent, 1=adherent. Q5 is reverse: Yes=1=good, No=0=problem
              const isProb   = parseFloat(r[q.k]) < 0.5;
              const answerTxt = q.reverse
                ? (isProb ? 'No' : 'Yes')   // Q5: value=1→"Yes took it"✓, value=0→"No didn't"✗
                : (isProb ? 'Yes' : 'No');   // Q1-Q4,Q6-Q7: value=0→"Yes problem"✗, value=1→"No problem"✓
              return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-family:var(--font-mono);font-size:0.70rem;">
                <span style="color:${isProb ? 'var(--poor)' : 'var(--optimal)'};flex-shrink:0;">${isProb ? '✗' : '✓'}</span>
                <span style="color:var(--muted);flex:1;">${q.text}</span>
                <span style="color:${isProb ? 'var(--poor)' : 'var(--dim)'};">${answerTxt}</span>
              </div>`;
            }).join('')}
          </div>
          <button onclick="const el=document.getElementById('${itemsId}');el.style.display=el.style.display==='none'?'':'none';this.textContent=el.style.display===''?'▾ Hide responses':'▸ Item responses';"
            style="font-family:var(--font-mono);font-size:0.64rem;letter-spacing:0.06em;text-transform:uppercase;background:none;border:none;color:var(--dim);cursor:pointer;padding:3px 0;margin-top:4px;">▸ Item responses</button>` : '';
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--muted);flex:0 0 84px;">${fd(r.timestamp)}</span>
            <span style="font-family:var(--font-mono);font-size:0.86rem;color:${cat.color};font-weight:600;">Score: ${_rsc.toFixed(2)}</span>
            <span style="font-family:var(--font-mono);font-size:0.68rem;padding:2px 8px;border-radius:4px;background:${cat.color}18;color:${cat.color};border:1px solid ${cat.color}44;">${r.adherence_level || cat.label || '—'}</span>
            <span style="font-family:var(--font-mono);font-size:0.64rem;padding:1px 6px;border-radius:4px;background:var(--card2);border:1px solid var(--border);color:var(--dim);">${instrLbl}</span>
            ${r.language && r.language !== 'en' ? `<span style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);">${esc(r.language.toUpperCase())}</span>` : ''}
            ${r.collection_method ? `<span style="font-family:var(--font-mono);font-size:0.66rem;color:var(--dim);">${esc(r.collection_method)}</span>` : ''}
          </div>
          ${itemsHtml}
        </div>`;
      }).join('')}
    </div>` : `<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-bottom:16px;">No MMAS-8 / MAP assessments recorded.</div>`;

  // ── PEACS Assessments ────────────────────────────────────────────────────────
  const peacsHtml = p.peacs.length ? `
    <div style="margin-bottom:20px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--strata);margin-bottom:10px;">PEACS Assessments (${p.peacs.length})</div>
      ${p.peacs.map(r => {
        const pe     = r.pe_score ?? r.pe ?? null;
        const base   = r.base_score ?? r.base ?? null;
        const mvmt   = r.mvmt_score ?? r.mvmt ?? null;
        const strata = r.strata_score ?? r.strata ?? null;
        const peColor = pe !== null ? (pe >= 0.85 ? '#10b981' : pe >= 0.70 ? '#3b82f6' : pe >= 0.55 ? '#f59e0b' : pe >= 0.40 ? '#ef4444' : '#991b1b') : 'var(--dim)';
        return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-family:var(--font-mono);font-size:0.70rem;color:var(--muted);flex:0 0 84px;">${fd(r.timestamp)}</span>
          ${pe     !== null ? `<span style="font-family:var(--font-mono);font-size:0.86rem;color:${peColor};font-weight:600;">PE: ${Number(pe).toFixed(3)}</span>` : ''}
          ${base   !== null ? `<span style="font-family:var(--font-mono);font-size:0.70rem;color:rgba(139,111,245,0.85);">B: ${Number(base).toFixed(2)}</span>` : ''}
          ${mvmt   !== null ? `<span style="font-family:var(--font-mono);font-size:0.70rem;color:rgba(78,156,245,0.85);">M: ${Number(mvmt).toFixed(2)}</span>` : ''}
          ${strata !== null ? `<span style="font-family:var(--font-mono);font-size:0.70rem;color:rgba(46,201,138,0.85);">S: ${Number(strata).toFixed(2)}</span>` : ''}
          ${r.adherence_level || r.risk_level ? `<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);">${esc(r.adherence_level || r.risk_level)}</span>` : ''}
        </div>`;
      }).join('')}
    </div>` : `<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--dim);margin-bottom:16px;">No PEACS assessments recorded.</div>`;

  // ── Study sources ────────────────────────────────────────────────────────────
  const studies = [...p.studies];
  const studyHtml = studies.length ? `
    <div style="margin-bottom:12px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(212,168,67,0.6);margin-bottom:6px;">Study Sources</div>
      ${studies.map(s => `<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--muted);padding:2px 0;">${esc(s)}</div>`).join('')}
    </div>` : '';

  // ── Assemble panel ──────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'pt-profile-panel';
  panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:640px;max-width:100vw;z-index:99990;background:var(--card);border-left:3px solid var(--base);box-shadow:-8px 0 32px rgba(0,0,0,0.4);display:flex;flex-direction:column;animation:slideInRight 0.25s ease;';
  panel.innerHTML = `
    <style>#pt-profile-panel *{box-sizing:border-box;}@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}</style>
    <div style="padding:18px 22px 14px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--card2);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div>
          <div style="font-family:var(--font-mono);font-size:1.0rem;color:var(--bright);font-weight:600;letter-spacing:0.06em;">${esc(p.pid)}</div>
          <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dim);margin-top:3px;">${esc(p.ws)} · ${esc(locStr)} · Last activity: ${fd(p.lastTs)}</div>
        </div>
        <button onclick="document.getElementById('pt-profile-panel').remove();document.getElementById('pt-profile-overlay').remove();"
          style="background:none;border:1px solid var(--border2);border-radius:5px;color:var(--dim);font-size:0.88rem;padding:4px 9px;cursor:pointer;flex-shrink:0;transition:border-color 0.2s;"
          onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">✕</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="font-family:var(--font-mono);font-size:0.66rem;padding:3px 10px;border-radius:10px;background:rgba(78,156,245,0.1);border:1px solid rgba(78,156,245,0.25);color:rgba(78,156,245,0.9);">${esc(condition)}</span>
        <span style="font-family:var(--font-mono);font-size:0.66rem;padding:3px 10px;border-radius:10px;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);color:rgba(212,168,67,0.8);">${p.mmas.length} MMAS · ${p.peacs.length} PEACS</span>
        ${studies.slice(0,2).map(s => `<span style="font-family:var(--font-mono);font-size:0.64rem;padding:3px 10px;border-radius:10px;background:var(--card);border:1px solid var(--border2);color:var(--dim);">${esc(s)}</span>`).join('')}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:18px 22px;">
      ${demoHtml}
      ${sdohHtml}
      ${mmasHtml}
      ${peacsHtml}
      ${studyHtml}
    </div>`;

  document.body.appendChild(panel);

  const overlay = document.createElement('div');
  overlay.id = 'pt-profile-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99989;background:transparent;';
  overlay.onclick = () => { panel.remove(); overlay.remove(); };
  document.body.insertBefore(overlay, panel);
}

function setPatientPageSize(val) {
  window._patientPageSize = parseInt(val) || 20;
  window._patientPage = 1;
  _renderPatientPage();
}

function patientPageNav(dir) {
  const total = Math.ceil((window._patientFiltered || []).length / (window._patientPageSize || 20));
  window._patientPage = Math.max(1, Math.min(total, (window._patientPage || 1) + dir));
  _renderPatientPage();
}

function patientGoToPage(p) {
  window._patientPage = p;
  _renderPatientPage();
}

function filterPatientPanel(query) {
  const filter       = (document.getElementById('icc-patient-filter')?.value)       || 'all';
  const wsFilter     = (document.getElementById('icc-patient-ws-filter')?.value)    || '';
  const studyFilter  = (document.getElementById('icc-patient-study-filter')?.value) || '';
  const q = (query || '').trim().toUpperCase();
  let rows = window._patientPanelData || [];

  if (wsFilter)    rows = rows.filter(p => p.ws.toUpperCase() === wsFilter.toUpperCase());
  else if (q)      rows = rows.filter(p => p.pid.toUpperCase().includes(q) || p.ws.toUpperCase().includes(q));

  if (studyFilter) rows = rows.filter(p => p.studies && p.studies.has(studyFilter));

  if (filter === 'mmas_only')  rows = rows.filter(p => p.mmas.length > 0 && p.peacs.length === 0);
  if (filter === 'peacs_only') rows = rows.filter(p => p.peacs.length > 0 && p.mmas.length === 0);
  if (filter === 'both')       rows = rows.filter(p => p.mmas.length > 0 && p.peacs.length > 0);
  if (filter === 'incomplete') rows = rows.filter(p => p.mmas.length === 0 || p.peacs.length === 0);

  window._patientPage = 1;
  renderPatientRows(rows);
}

function populatePatientWorkspaceDropdown() {
  const sel = document.getElementById('icc-patient-ws-filter');
  if (!sel) return;
  const rows = window._patientPanelData || [];
  const wsList = [...new Set(rows.map(p => p.ws).filter(Boolean))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Workspaces</option>' +
    wsList.map(w => `<option value="${w}"${w===current?' selected':''}>${w}</option>`).join('');
}

function populatePatientStudyDropdown() {
  const sel = document.getElementById('icc-patient-study-filter');
  if (!sel) return;
  const rows = window._patientPanelData || [];
  const allStudies = new Set();
  rows.forEach(p => { if (p.studies) p.studies.forEach(s => allStudies.add(s)); });
  const studyList = [...allStudies].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Studies</option>' +
    studyList.map(s => `<option value="${s}"${s===current?' selected':''}>${s}</option>`).join('');
}
function exportInstitutionCSV() {
  atlasAuditLog('export_institution_csv', { workspace: currentWorkspace });
  resolveAllowedWorkspaces().then(allowedWS => {
    database.ref('assessments').once('value', snap => {
      const all=snap.val();
      if(!all){showToast('No data to export.');return;}
      const records=Object.values(all).filter(r=>{
        if(!r.institution_code) return false;
        if(allowedWS===null) return true;
        return allowedWS.has(r.institution_code.toUpperCase());
      });
      if(!records.length){showToast('No records found for your institution.');return;}
      const classP=r=>{try{return classifyPattern(r);}catch(e){return{intentional:0,unintentional:0};}};
      // PE columns available for researcher / PI / institution / superadmin only
      const _csvHasPE = workspaceProfile && workspaceProfile.role !== 'student';
      const headers=['Workspace','Patient_Num','Timestamp','Country','City','Score','Adherence_Level','INA_UNA','APE_Phenotype','APE_Probability','Condition','Drug_Name','Gender','Age_Range','Latitude','Longitude',
        ...(_csvHasPE ? ['MMAS_PE','Domain_A','Domain_E','Domain_C'] : [])];
      const rows=records.map(r=>{
        const p=classP(r);
        const inaUna=r.score===8?'High':p.intentional>p.unintentional?'INA':p.unintentional>p.intentional?'UNA':'Mixed';
        let apePhenotype='High Adherence', apeProb='';
        if (r.score !== 8 && r.q1 !== undefined && typeof classifyApePhenotype === 'function') {
          const apeResult = classifyApePhenotype(r);
          if (apeResult && apeResult.length) {
            apePhenotype = apeResult[0].phenotype.name || apeResult[0].phenotype.id;
            apeProb = (apeResult[0].prob * 100).toFixed(1) + '%';
          } else { apePhenotype = ''; }
        } else if (r.score !== 8) { apePhenotype = ''; }
        const _rpe = _csvHasPE ? (r.mmas_pe !== undefined ? { pe: r.mmas_pe, a: r.mmas_a, e: r.mmas_e, c: r.mmas_c } : computeMMASPE(r)) : null;
        return[r.institution_code||'',r.patient_number||'N/A',new Date(r.timestamp).toISOString(),r.country||'',r.city||'',(r.score||0).toFixed(2),r.adherence_level||'',inaUna,apePhenotype,apeProb,r.condition||'',r.drug_name||'',r.gender||'',r.age_range||'',r.latitude||'',r.longitude||'',
          ...(_csvHasPE ? [_rpe?_rpe.pe.toFixed(4):'', _rpe?_rpe.a.toFixed(4):'', _rpe?_rpe.e.toFixed(4):'', _rpe?_rpe.c.toFixed(4):''] : [])];
      });
      const label=(currentWorkspace||'institution').toLowerCase();
      triggerCSVDownload(headers,rows,'atlas-'+label+'-all-sites-'+new Date().toISOString().split('T')[0]+'.csv');
      showToast('Exported '+rows.length+' records.',3000);
    });
  });
}
function generateIRBAggregateReport() {
  showToast('Generating IRB Aggregate Report…',2500);
  resolveAllowedWorkspaces().then(allowedWS => {
    database.ref('assessments').once('value', snap => {
      const all=snap.val();
      if(!all){showToast('No data available.');return;}
      const records=Object.values(all).filter(r=>{
        if(r.map_q1 !== undefined) return false; // MMAS-8 report only — MAP has separate export
        if(!r.institution_code) return false;
        if(allowedWS===null) return true;
        return allowedWS.has(r.institution_code.toUpperCase());
      });
      const label=workspaceProfile?(workspaceProfile.name||currentWorkspace):currentWorkspace;
      const byWS={};
      records.forEach(r=>{const ws=r.institution_code||'Unknown';if(!byWS[ws])byWS[ws]=[];byWS[ws].push(r);});
      const total=records.length;
      const avgScore=total?(records.reduce((s,r)=>s+(r.score||0),0)/total).toFixed(2):'N/A';
      const ctries=[...new Set(records.map(r=>r.country).filter(c=>c&&c!=='Unknown'))].join(', ');
      const sep='─'.repeat(50);
      const siteRows=Object.entries(byWS).map(([ws,recs])=>{const n=recs.length,avg=n?(recs.reduce((s,r)=>s+(r.score||0),0)/n).toFixed(2):'N/A';return'  '+ws+': n='+n+', avg='+avg+'/8';}).join('\n');
      const scope=allowedWS===null?'Super-Admin (All Sites)':'Institution-Scoped: '+label;
      const txt=['ADHERENCE CARTOGRAPHY · ATLAS PLATFORM — IRB AGGREGATE REPORT','Institution: '+label,'Scope: '+scope,'Generated: '+new Date().toLocaleString(),'Instrument: MMAS-8 (Morisky Medication Adherence Scale, © Donald E. Morisky)',sep,'AGGREGATE SUMMARY','Total Submissions: '+total,'Active Sites / Workspaces: '+Object.keys(byWS).length,'Countries Represented: '+ctries,'Org-wide Mean MMAS-8 Score: '+avgScore+'/8',sep,'SITE-BY-SITE BREAKDOWN',siteRows,sep,'CITATION','Krousel-Wood M, Islam T, Webber LS, Re RN, Morisky DE, Muntner P. (2009).','New medication adherence scale versus pharmacy fill rates in seniors with hypertension.','Am J Manag Care. 15(1):59-66. PMID: 19146365; PMCID: PMC2728593.','','Platform: Adherence Cartography · ATLAS · atlas.adherence.cc','Not a dose. A duration.'].join('\n');
      const blob=new Blob([txt],{type:'text/plain'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='atlas-irb-aggregate-'+label.replace(/\s+/g,'-').toLowerCase()+'-'+new Date().toISOString().split('T')[0]+'.txt';a.click();URL.revokeObjectURL(url);
      showToast('IRB Aggregate Report downloaded.',3000);
    });
  });
}


// ── BP-UX-01: Quick Actions Hero Card ────────────────────────────────────────

/**
 * Returns the HTML string for the Quick Actions hero card.
 * Shown at the top of the dashboard for roles that collect patient assessments.
 * @returns {string} HTML string or empty string if not applicable
 */
function _renderQuickActionsCard() {
  const role = (typeof workspaceProfile !== 'undefined' && workspaceProfile && workspaceProfile.role)
    ? workspaceProfile.role
    : '';
  const isPatientCollector = ['clinician','researcher','student','pharmacist','pi','independent'].some(r => role.includes(r));
  if (!isPatientCollector) return '';

  return `
    <div id="quick-actions-hero" style="background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.18);border-left:3px solid rgba(46,201,138,0.5);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(46,201,138,0.7);margin-bottom:5px;">Collect Assessment</div>
        <div style="font-size:0.84rem;color:var(--text,#c8d6e8);line-height:1.5;">Show patient a QR code → they scan on their phone → MAP score appears here instantly. Zero IT. No app install.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="${typeof showQRCode === 'function' ? 'showQRCode()' : "document.dispatchEvent(new CustomEvent('atlas:showQR'))"}"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(46,201,138,0.12);border:1px solid rgba(46,201,138,0.35);color:rgba(46,201,138,0.9);padding:9px 16px;border-radius:7px;cursor:pointer;transition:all 0.15s;white-space:nowrap;"
          onmouseover="this.style.background='rgba(46,201,138,0.22)'" onmouseout="this.style.background='rgba(46,201,138,0.12)'">
          ▶ Show QR Code
        </button>
        <button onclick="${typeof openAddPatient === 'function' ? 'openAddPatient()' : "document.dispatchEvent(new CustomEvent('atlas:addPatient'))"}"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);color:var(--muted,#6b8099);padding:9px 16px;border-radius:7px;cursor:pointer;transition:all 0.15s;white-space:nowrap;"
          onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
          + Manual Entry
        </button>
      </div>
    </div>`;
}

/**
 * Injects the Quick Actions hero card at the top of the dashboard body.
 * Idempotent — safe to call on each dashboard render/refresh.
 */
function _injectQuickActionsCard() {
  // Only inject for roles that collect assessments; skip admin/institution/observer/explorer
  if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return;
  if (typeof isInstitutionMode === 'function' && isInstitutionMode()) return;
  if (typeof isObserverMode === 'function' && isObserverMode()) return;
  if (window._wsMode === 'explorer' || (typeof currentWorkspace !== 'undefined' && currentWorkspace === 'EXPLORER')) return;

  const html = _renderQuickActionsCard();
  if (!html) return;

  // Idempotent — only inject once per dashboard session
  if (document.getElementById('quick-actions-hero')) return;

  const db = document.querySelector('#screen-dashboard .dash-body');
  if (!db) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const card = wrapper.firstElementChild;
  if (!card) return;

  // Insert after the context banner (if present), otherwise at top
  const banner = document.getElementById('dash-context-banner');
  if (banner && banner.parentNode === db && banner.nextSibling) {
    db.insertBefore(card, banner.nextSibling);
  } else {
    db.insertBefore(card, db.firstChild);
  }
}

function updateDashContextBanner() {
  const banner = document.getElementById('dash-context-banner');
  if (!banner) return;
  const label = workspaceProfile ? (workspaceProfile.name || currentWorkspace) : currentWorkspace;

  if (isSuperAdmin()) {
    banner.style.display      = 'block';
    banner.textContent        = '◈  Superadmin · All workspaces · Global data access';
    banner.style.background   = 'rgba(212,168,67,0.08)';
    banner.style.color        = 'var(--pe)';
    banner.style.borderBottom = '1px solid rgba(212,168,67,0.15)';
  } else if (isInstitutionMode()) {
    banner.style.display      = 'block';
    banner.textContent        = '🏛  Institution · Cohort scoped to: ' + label;
    banner.style.background   = 'rgba(139,111,245,0.08)';
    banner.style.color        = 'var(--mvmt)';
    banner.style.borderBottom = '1px solid rgba(139,111,245,0.15)';
  } else if (workspaceProfile?.role === 'student') {
    banner.style.display = 'none';
  } else if (isClinician()) {
    banner.style.display      = 'block';
    banner.textContent        = '⚕  Clinical · Patient panel scoped to: ' + label;
    banner.style.background   = 'rgba(16,185,129,0.06)';
    banner.style.color        = '#10b981';
    banner.style.borderBottom = '1px solid rgba(16,185,129,0.18)';
  } else if (isPIResearcher()) {
    banner.style.display      = 'block';
    banner.textContent        = '◇  Researcher · Cohort scoped to: ' + label;
    banner.style.background   = 'rgba(78,156,245,0.07)';
    banner.style.color        = 'var(--base)';
    banner.style.borderBottom = '1px solid rgba(78,156,245,0.14)';
  } else if (isIndependentMode()) {
    banner.style.display      = 'block';
    banner.textContent        = '◆  Independent · Cohort scoped to: ' + label;
    banner.style.background   = 'rgba(46,201,138,0.06)';
    banner.style.color        = 'var(--strata)';
    banner.style.borderBottom = '1px solid rgba(46,201,138,0.12)';
  } else {
    banner.style.display = 'none';
  }
  banner.style.borderTop = 'none';

  // BP-UX-01: Inject Quick Actions card at top of dashboard content area
  // Deferred so workspace-specific panels (clinician-dash-panel, student-dash-panel, etc.)
  // have had a chance to be inserted first. Idempotent — won't double-inject.
  setTimeout(_injectQuickActionsCard, 120);
}

