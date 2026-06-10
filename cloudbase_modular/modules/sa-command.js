// sa-command.js — Command Center: GAI gauge, data loader, heatmap, workspace breakdown, live feed, AI briefing, anomaly detection

// Proxy URL resolved inline per-call via window.ATLAS_CONFIG?.aiProxyUrl
// (declared as const in sa-ai.js — do not redeclare here; all scripts share one global scope)

function _saRenderCommand(container) {
  container.innerHTML = `
  <!-- ROW 1: GAI + Instruments + Alert zones -->
  <div style="display:grid;grid-template-columns:240px 1fr 1fr 1fr;gap:14px;margin-bottom:14px;">

    <!-- GAI Gauge -->
    <div class="sa-panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;">
      <div class="sa-section-eyebrow">Global Adherence Index</div>
      <div id="sa-gai-wrap" style="position:relative;margin:10px 0;">
        ${_saGaugeSVG('sa-gauge-arc', 0)}
      </div>
      <div id="sa-gai-val" style="font-size:2rem;font-weight:700;color:${_C.amber};letter-spacing:-0.04em;text-align:center;margin-top:2px;">—</div>
      <div id="sa-gai-tier" style="font-size:0.74rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.muted};margin-top:2px;text-align:center;">Loading…</div>
      <div style="width:100%;border-top:1px solid ${_C.border};margin-top:12px;padding-top:10px;display:flex;justify-content:space-around;">
        <div class="sa-kpi" style="align-items:center;">
          <div id="sa-gai-n" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.cyan};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Records</div>
        </div>
        <div class="sa-kpi" style="align-items:center;">
          <div id="sa-gai-ws" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.cyan};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Workspaces</div>
        </div>
        <div class="sa-kpi" style="align-items:center;">
          <div id="sa-gai-countries" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.cyan};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Countries</div>
        </div>
      </div>
    </div>

    <!-- MAP -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">MAP · Multidimensional</div>
      <div style="font-size:1.02rem;font-weight:700;color:${_C.green};margin-bottom:12px;">Adherence Parameters</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        <div class="sa-kpi">
          <div id="sa-map-n" class="sa-kpi-val" style="color:${_C.green};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Assessments</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-map-pe" class="sa-kpi-val" style="font-size:1.35rem;color:${_C.green};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Mean PE</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-map-arch" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(16,185,129,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Architecture</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-map-exec" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(16,185,129,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Execution</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-map-ctx" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(16,185,129,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Context</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-map-delta" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.muted};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">7-Day Δ</div>
        </div>
      </div>
      <div id="sa-map-bar" style="margin-top:14px;height:4px;border-radius:2px;background:rgba(16,185,129,0.12);overflow:hidden;">
        <div id="sa-map-bar-fill" style="height:100%;background:${_C.green};border-radius:2px;width:0%;transition:width 0.8s ease;"></div>
      </div>
    </div>

    <!-- MMAS-8 -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">MMAS-8 · Morisky</div>
      <div style="font-size:1.02rem;font-weight:700;color:${_C.blue};margin-bottom:12px;">Medication Adherence Scale</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        <div class="sa-kpi">
          <div id="sa-mmas-n" class="sa-kpi-val" style="color:${_C.blue};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Assessments</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-mmas-avg" class="sa-kpi-val" style="font-size:1.35rem;color:${_C.blue};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Mean / 8</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-mmas-hi" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.green};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">High ≥7</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-mmas-med" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.amber};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Medium 6–7</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-mmas-lo" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.red};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Low &lt;6</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-mmas-countries" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.muted};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Countries</div>
        </div>
      </div>
      <div id="sa-mmas-bar" style="margin-top:14px;height:4px;border-radius:2px;background:rgba(96,165,250,0.12);overflow:hidden;">
        <div id="sa-mmas-bar-fill" style="height:100%;background:${_C.blue};border-radius:2px;width:0%;transition:width 0.8s ease;"></div>
      </div>
    </div>

    <!-- PEACS -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">PEACS · Predictive Emergence</div>
      <div style="font-size:1.02rem;font-weight:700;color:${_C.purple};margin-bottom:12px;">Assessment &amp; Context Score</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        <div class="sa-kpi">
          <div id="sa-peacs-n" class="sa-kpi-val" style="color:${_C.purple};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Assessments</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-peacs-avg" class="sa-kpi-val" style="font-size:1.35rem;color:${_C.purple};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">Mean PE</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-peacs-s1" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(167,139,250,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">BASE sess.</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-peacs-s2" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(167,139,250,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">MVMT sess.</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-peacs-s3" class="sa-kpi-val" style="font-size:0.95rem;color:rgba(167,139,250,0.7);">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">STRATA sess.</div>
        </div>
        <div class="sa-kpi">
          <div id="sa-peacs-complete" class="sa-kpi-val" style="font-size:0.95rem;color:${_C.muted};">—</div>
          <div class="sa-kpi-lbl" style="color:${_C.dim};">3-sess. rate</div>
        </div>
      </div>
      <div id="sa-peacs-bar" style="margin-top:14px;height:4px;border-radius:2px;background:rgba(167,139,250,0.12);overflow:hidden;">
        <div id="sa-peacs-bar-fill" style="height:100%;background:${_C.purple};border-radius:2px;width:0%;transition:width 0.8s ease;"></div>
      </div>
    </div>
  </div>

  <!-- ROW 2: Live Feed + Heatmap -->
  <div style="display:grid;grid-template-columns:1fr 360px;gap:14px;margin-bottom:14px;">

    <!-- 24-Hour Activity Heatmap -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Activity Timeline</div>
      <div style="font-size:1.00rem;font-weight:700;color:${_C.text};margin-bottom:14px;">24-Hour Assessment Heatmap</div>
      <div id="sa-heatmap" style="display:flex;gap:3px;align-items:flex-end;height:70px;"></div>
      <div id="sa-heatmap-labels" style="display:flex;gap:3px;margin-top:5px;"></div>
      <div style="display:flex;gap:16px;margin-top:12px;">
        <div style="display:flex;align-items:center;gap:5px;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:${_C.dim};">
          <span style="width:8px;height:8px;border-radius:1px;background:${_C.green};opacity:0.8;"></span>MAP
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:${_C.dim};">
          <span style="width:8px;height:8px;border-radius:1px;background:${_C.blue};opacity:0.8;"></span>MMAS-8
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:0.76rem;letter-spacing:0.1em;text-transform:uppercase;color:${_C.dim};">
          <span style="width:8px;height:8px;border-radius:1px;background:${_C.purple};opacity:0.8;"></span>PEACS
        </div>
      </div>
    </div>

    <!-- Workspace breakdown -->
    <div class="sa-panel">
      <div class="sa-section-eyebrow">Platform Scope</div>
      <div style="font-size:1.00rem;font-weight:700;color:${_C.text};margin-bottom:14px;">Workspace Distribution</div>
      <div id="sa-ws-breakdown" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>
  </div>

  <!-- ROW 3: Live Feed full width -->
  <div class="sa-panel">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="width:6px;height:6px;border-radius:50%;background:${_C.cyan};box-shadow:0 0 6px ${_C.cyan};animation:sa-pulse 2s infinite;"></span>
      <div class="sa-section-eyebrow" style="margin-bottom:0;">Live Assessment Stream</div>
      <div id="sa-feed-count" style="margin-left:auto;font-size:0.74rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};"></div>
    </div>
    <div id="sa-live-feed" style="display:flex;flex-direction:column;max-height:220px;overflow-y:auto;">
      <div style="font-size:0.90rem;color:${_C.dim};font-style:italic;padding:8px 0;">Initializing live stream…</div>
    </div>
  </div>`;

  // Load data
  _saLoadCommandData();
}

// ── MAP PE helper — always recomputes from items with Context-Guard ───────────
function _saMapPE(r) {
  const a = ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
  const e = ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
  const c = 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
  return Math.pow(Math.max(0, a*e*c), 1/3);
}
function _saMapArch(r) { return ((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3; }
function _saMapExec(r) { return ((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3; }
function _saMapCtx(r)  { return 0.5 + 0.5*((+r.map_q4||0)+(+r.map_q7||0))/2; }

// ── GAI Gauge SVG ─────────────────────────────────────────────────────────────

function _saGaugeSVG(arcId, pct) {
  const R = 64, CX = 72, CY = 72, SW = 10;
  const circ = 2 * Math.PI * R;
  // Arc goes from 135° to 405° (270° sweep)
  const sweep = circ * 0.75;
  const fill  = sweep * Math.min(1, Math.max(0, pct));
  const gap   = sweep - fill;
  // Rotation offset to start at 135°
  const rot   = -225;
  return `
  <svg width="144" height="144" viewBox="0 0 144 144">
    <!-- Track -->
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(56,189,248,0.08)" stroke-width="${SW}"
      stroke-dasharray="${sweep} ${circ - sweep}"
      stroke-dashoffset="0"
      stroke-linecap="round"
      transform="rotate(${rot} ${CX} ${CY})" />
    <!-- Fill -->
    <circle id="${arcId}" cx="${CX}" cy="${CY}" r="${R}" fill="none"
      stroke="${_C.amber}" stroke-width="${SW}"
      stroke-dasharray="${fill} ${circ - fill}"
      stroke-dashoffset="0"
      stroke-linecap="round"
      transform="rotate(${rot} ${CX} ${CY})"
      style="transition:stroke-dasharray 0.9s ease;filter:drop-shadow(0 0 4px ${_C.amber});" />
    <!-- Centre dot -->
    <circle cx="${CX}" cy="${CY}" r="3" fill="${_C.amber}" opacity="0.5"/>
    <!-- Tick marks -->
    ${[0, 0.25, 0.5, 0.75, 1].map(t => {
      const ang = (135 + t * 270) * Math.PI / 180;
      const x1 = CX + (R - 7) * Math.cos(ang), y1 = CY + (R - 7) * Math.sin(ang);
      const x2 = CX + (R + 2) * Math.cos(ang), y2 = CY + (R + 2) * Math.sin(ang);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(56,189,248,0.25)" stroke-width="1.5"/>`;
    }).join('')}
  </svg>`;
}

function _saUpdateGauge(pct) {
  const arc = document.getElementById('sa-gauge-arc');
  if (!arc) return;
  const R = 64, circ = 2 * Math.PI * R, sweep = circ * 0.75;
  const fill = sweep * Math.min(1, Math.max(0, pct));
  arc.setAttribute('stroke-dasharray', `${fill} ${circ - fill}`);
  // Colour by tier
  const col = pct >= 0.85 ? _C.green
            : pct >= 0.70 ? _C.cyan
            : pct >= 0.55 ? _C.amber
            : pct >= 0.40 ? '#f97316'
            : _C.red;
  arc.setAttribute('stroke', col);
  arc.style.filter = `drop-shadow(0 0 4px ${col})`;
}

// ── Canonical GAI Computation — single source of truth ───────────────────────
// All three display locations (Command tab, GAI Index Tab, AI brief) call this.
// Formula: geometric mean of per-instrument normalized 0-1 scores.
//   MMAS-8:  arithmetic mean of raw scores ÷ 8
//   MAP:     geometric mean of pe_score values (already 0-1)
//   PEACS:   geometric mean of pe values (already 0-1)
// Shared geometric-mean helper used by GAI tab sub-calculations
const _geomMean = arr => arr.length
  ? Math.exp(arr.reduce((s,v) => s + Math.log(Math.max(0.001, Math.min(1, v))), 0) / arr.length)
  : null;

// Returns { gai, mmasNorm, mapNorm, peacsNorm, mmasN, mapN, peacsN, components }

function _saComputeGAI() {
  const _gm = _geomMean;

  const mmasOnly = (_saCache.mmas||[]).filter(r => r.map_q1 === undefined);
  const mapInstr = (_saCache.mmas||[]).filter(r => r.map_q1 !== undefined);
  const peacs    = _saCache.peacs || [];

  const mmasNorm  = mmasOnly.length
    ? mmasOnly.reduce((s,r) => s + (r.score||0), 0) / mmasOnly.length / 8
    : null;
  const mapNorm   = _gm(mapInstr.map(r => _saMapPE(r)));
  const peacsNorm = _gm(peacs.filter(r => r.pe != null).map(r => +r.pe));

  const components = [
    mmasNorm  != null ? { label:'MMAS-8', val:mmasNorm,  n:mmasOnly.length, col:_C.blue   } : null,
    mapNorm   != null ? { label:'MAP',    val:mapNorm,   n:mapInstr.length, col:_C.amber  } : null,
    peacsNorm != null ? { label:'PEACS',  val:peacsNorm, n:peacs.length,    col:_C.purple } : null,
  ].filter(Boolean);

  const gai = components.length ? _gm(components.map(c => c.val)) : 0;

  return {
    gai: Math.min(1, Math.max(0, gai || 0)),
    mmasNorm, mapNorm, peacsNorm,
    mmasN: mmasOnly.length, mapN: mapInstr.length, peacsN: peacs.length,
    components,
  };
}

// ── Firebase Data Loader ───────────────────────────────────────────────────────

function _saLoadCommandData() {
  if (typeof database === 'undefined') {
    _saShowError('Firebase not available.'); return;
  }
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayTs = todayStart.getTime();

  // Mission Control is superadmin-only — always global, no institution scoping.
  // MMAS-8
  const mmasRef = database.ref('assessments');
  mmasRef.once('value', snap => {
    _saCache.mmas = snap.val() ? Object.values(snap.val()) : [];
    _saRefreshCommandUI(todayTs);
  });

  // PEACS
  const peacsRef = database.ref('peacs_assessments');
  peacsRef.once('value', snap => {
    _saCache.peacs = snap.val() ? Object.values(snap.val()) : [];
    _saRefreshCommandUI(todayTs);
  });

  // MAP
  const mapRef = database.ref('mapData');
  mapRef.once('value', snap => {
    _saCache.map = snap.val() ? Object.values(snap.val()) : [];
    _saRefreshCommandUI(todayTs);
  });

  // Workspaces — Firebase node for metadata cache (subset of all issued keys)
  const wsRef = database.ref('workspaces');
  wsRef.once('value', snap => {
    const allWs = snap.val() || {};
    if (_saCurrentRole === 'pi' && _saInstitutionCode) {
      _saCache.workspaces = Object.fromEntries(
        Object.entries(allWs).filter(([,v]) => (v.code||v.institution_code||'') === _saInstitutionCode)
      );
    } else {
      _saCache.workspaces = allWs;
    }
    _saRefreshCommandUI(todayTs);
  });

  // Workspace count — authoritative source is Lambda key registry, not Firebase node.
  // Firebase workspaces only contains keys that have been explicitly configured;
  // the Lambda registry contains all issued keys. Fetch asynchronously and update
  // the ribbon stat once resolved, leaving the Firebase-derived count as placeholder.
  _accGetToken().then(token => {
    return fetch(LAMBDA_URL + '/admin/list-keys', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    }).then(r => r.json());
  }).then(res => {
    const deletedSnap = database.ref('atlas_deleted_keys').once('value');
    return deletedSnap.then(dSnap => {
      const deletedKeys = new Set(Object.keys((dSnap && dSnap.val()) || {}));
      const activeKeys = (res.keys || []).filter(k =>
        !deletedKeys.has((k.key||'').toUpperCase()) && !deletedKeys.has(k.key||'')
      );
      _saSetStat('sa-stat-ws', activeKeys.length.toLocaleString());
    });
  }).catch(() => { /* ribbon keeps Firebase-derived count on Lambda failure */ });

  // Live stream — child_added on all three (show last 48h in feed)
  const feedTs = Date.now() - 48 * 3600 * 1000;

  const mmasLive = mmasRef.orderByChild('timestamp').startAt(feedTs);
  const mmasLiveFn = snap => {
    const rec = snap.val();
    if (!rec) return;
    // MAP instrument records share the assessments node — route by field presence
    const isMap = rec.tool === 'map' || rec.map_q1 !== undefined;
    _saFeedItem(rec, isMap ? 'map' : 'mmas');
  };
  mmasLive.on('child_added', mmasLiveFn);
  _saFbListeners.push({ ref: mmasLive, event: 'child_added', fn: mmasLiveFn });

  const peacsLive = peacsRef.orderByChild('timestamp').startAt(feedTs);
  const peacsLiveFn = snap => _saFeedItem(snap.val(), 'peacs');
  peacsLive.on('child_added', peacsLiveFn);
  _saFbListeners.push({ ref: peacsLive, event: 'child_added', fn: peacsLiveFn });

  // mapData (mapRef) is NOT listened to for the live feed — MAP instrument records
  // are written to both 'assessments' and 'mapData', so mmasLive already catches them.
  // Adding a mapLive listener here would cause every MAP assessment to appear twice.
}

// ── Full UI Refresh from Cached Data ─────────────────────────────────────────

function _saRefreshCommandUI(todayTs) {
  const mmas     = _saCache.mmas;
  const peacs    = _saCache.peacs;
  const map      = _saCache.map;
  const wsMap    = _saCache.workspaces;

  // ── Top bar totals ─────────────────────────────────────────────────────────
  // assessments is the source of truth for all MAP instrument records.
  // MAP records are identified by tool:'map' OR map_q1 field (legacy fallback).
  // Both checks are required — some records have only one depending on when they were written.
  const mapInstrRecs = mmas.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
  const totalAll = mmas.length + peacs.length;
  _saSetStat('sa-stat-total',   totalAll.toLocaleString());
  _saSetStat('sa-stat-mmas',    mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined && (r.timestamp||0) >= todayTs).length.toString());
  _saSetStat('sa-stat-map',     mapInstrRecs.filter(r => (r.timestamp||0) >= todayTs).length.toString());
  _saSetStat('sa-stat-peacs',   peacs.filter(r=> (r.timestamp||0) >= todayTs).length.toString());

  const wsCount = Object.keys(wsMap).length;
  // Only write to ribbon if Lambda hasn't already set the authoritative count.
  const wsEl = document.getElementById('sa-stat-ws');
  if (!wsEl || wsEl.textContent === '—') {
    _saSetStat('sa-stat-ws', wsCount.toString());
  }

  // Active sessions proxy: assessments in last 30 min (mapData excluded — geographic duplicates)
  const activeTs = Date.now() - 30 * 60 * 1000;
  const active = (mmas.filter(r=>(r.timestamp||0)>=activeTs).length
               + peacs.filter(r=>(r.timestamp||0)>=activeTs).length);
  _saSetStat('sa-stat-sessions', active.toString());

  // ── GAI — single canonical formula via _saComputeGAI() ──────────────────────
  const _gaiData = _saComputeGAI();
  let gai = _gaiData.gai;

  const gaiPct = Math.min(1, Math.max(0, gai));
  _saSetStat('sa-stat-gai', gaiPct.toFixed(3));
  _saUpdateGauge(gaiPct);

  const gaiValEl  = document.getElementById('sa-gai-val');
  const gaiTierEl = document.getElementById('sa-gai-tier');
  if (gaiValEl) gaiValEl.textContent = gaiPct.toFixed(3);
  if (gaiTierEl) {
    const tier = gaiPct >= 0.85 ? '● Optimal' : gaiPct >= 0.70 ? '● Good' : gaiPct >= 0.55 ? '◐ Moderate' : gaiPct >= 0.40 ? '◑ Poor' : '○ Critical';
    const col  = gaiPct >= 0.85 ? _C.green : gaiPct >= 0.70 ? _C.cyan : gaiPct >= 0.55 ? _C.amber : gaiPct >= 0.40 ? '#f97316' : _C.red;
    gaiTierEl.textContent = tier;
    gaiTierEl.style.color = col;
  }

  const countries = new Set([
    ...mmas.map(r=>r.country), ...peacs.map(r=>r.country), ...map.map(r=>r.country)
  ].filter(c=>c&&c!=='Unknown')).size;

  _saSetEl('sa-gai-n',        totalAll.toLocaleString());
  _saSetEl('sa-gai-ws',       wsCount.toString());
  _saSetEl('sa-gai-countries', countries.toString());

  // ── MAP panel — MAP instrument records only (map_q1 field in assessments) ──
  _saSetEl('sa-map-n', mapInstrRecs.length.toLocaleString());
  if (mapInstrRecs.length) {
    const peMean = mapInstrRecs.reduce((s,r)=>s+_saMapPE(r),0)/mapInstrRecs.length;
    const arch   = mapInstrRecs.reduce((s,r)=>s+_saMapArch(r),0)/mapInstrRecs.length;
    const exec   = mapInstrRecs.reduce((s,r)=>s+_saMapExec(r),0)/mapInstrRecs.length;
    const ctx    = mapInstrRecs.reduce((s,r)=>s+_saMapCtx(r),0)/mapInstrRecs.length;
    _saSetEl('sa-map-pe',   peMean.toFixed(3));
    _saSetEl('sa-map-arch', arch.toFixed(3));
    _saSetEl('sa-map-exec', exec.toFixed(3));
    _saSetEl('sa-map-ctx',  ctx.toFixed(3));
    _saSetEl('sa-map-delta', '—');
    const fill = document.getElementById('sa-map-bar-fill');
    if (fill && peMean != null) fill.style.width = (peMean * 100).toFixed(1) + '%';
  }

  // ── MMAS panel — MMAS-8 only (exclude MAP records that share the assessments node) ──
  const mmasOnly = mmas.filter(r => r.map_q1 === undefined);
  _saSetEl('sa-mmas-n', mmasOnly.length.toLocaleString());
  if (mmasOnly.length) {
    const avg = mmasOnly.reduce((s,r)=>s+(r.score||0),0)/mmasOnly.length;
    const hi  = mmasOnly.filter(r=>(r.score||0)>=7).length;
    const med = mmasOnly.filter(r=>(r.score||0)>=6 && (r.score||0)<7).length;
    const lo  = mmasOnly.filter(r=>(r.score||0)<6).length;
    const mc  = new Set(mmasOnly.map(r=>r.country).filter(c=>c&&c!=='Unknown')).size;
    _saSetEl('sa-mmas-avg',       avg.toFixed(2));
    _saSetEl('sa-mmas-hi',        hi.toLocaleString());
    _saSetEl('sa-mmas-med',       med.toLocaleString());
    _saSetEl('sa-mmas-lo',        lo.toLocaleString());
    _saSetEl('sa-mmas-countries', mc.toString());
    const fill = document.getElementById('sa-mmas-bar-fill');
    if (fill) fill.style.width = ((avg / 8) * 100).toFixed(1) + '%';
  }

  // ── PEACS panel ───────────────────────────────────────────────────────────
  _saSetEl('sa-peacs-n', peacs.length.toLocaleString());
  if (peacs.length) {
    const pValid = peacs.filter(r=>r.pe!=null);
    const avg    = pValid.length ? pValid.reduce((s,r)=>s+(+r.pe||0),0)/pValid.length : 0;
    const s1     = peacs.filter(r=>r.session===1||r.session_number===1).length;
    const s2     = peacs.filter(r=>r.session===2||r.session_number===2).length;
    const s3     = peacs.filter(r=>r.session===3||r.session_number===3).length;
    const pats   = new Set(peacs.map(r=>r.patient_number)).size;
    const full   = pats > 0 ? ((s3 / pats) * 100).toFixed(0) + '%' : '—';
    _saSetEl('sa-peacs-avg',      avg.toFixed(3));
    _saSetEl('sa-peacs-s1',       s1.toLocaleString());
    _saSetEl('sa-peacs-s2',       s2.toLocaleString());
    _saSetEl('sa-peacs-s3',       s3.toLocaleString());
    _saSetEl('sa-peacs-complete', full);
    const fill = document.getElementById('sa-peacs-bar-fill');
    if (fill) fill.style.width = Math.min(100, avg * 100).toFixed(1) + '%';
  }

  // ── 24-hour heatmap ───────────────────────────────────────────────────────
  _saRenderHeatmap(mmas, peacs, map);

  // ── Workspace breakdown ───────────────────────────────────────────────────
  _saRenderWsBreakdown(wsMap, mmas);

  // ── AI briefing ───────────────────────────────────────────────────────────
  _saRenderBriefing(mmas, peacs, map, gaiPct, todayTs);

  // ── Anomaly queue (sidebar) ───────────────────────────────────────────────
  _saRunAnomalyDetection();
}

// ── 24-Hour Heatmap ───────────────────────────────────────────────────────────

function _saRenderHeatmap(mmas, peacs, map) {
  const wrap  = document.getElementById('sa-heatmap');
  const lblEl = document.getElementById('sa-heatmap-labels');
  if (!wrap) return;

  // Build hourly buckets for today
  const now = new Date();
  const todayBuckets = Array.from({length: 24}, (_,h) => ({
    h, map: 0, mmas: 0, peacs: 0
  }));

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const ts0 = todayStart.getTime();

  [...mmas, ...peacs, ...map].forEach(r => {
    const ts = r.timestamp || 0;
    if (ts < ts0) return;
    const h = new Date(ts).getHours();
    if (!todayBuckets[h]) return;
    // Categorize by tool field, not by which Firebase node the record came from.
    // mapData contains geo-pins for both MMAS-8 and MAP uploads — using the array
    // membership check incorrectly bucketed all mapData records as MAP.
    if (peacs.includes(r) || r.tool === 'peacs')  todayBuckets[h].peacs++;
    else if (r.tool === 'map')                     todayBuckets[h].map++;
    else                                           todayBuckets[h].mmas++;
  });

  const maxCount = Math.max(1, ...todayBuckets.map(b => b.map + b.mmas + b.peacs));
  const curH = now.getHours();

  wrap.innerHTML = '';
  if (lblEl) lblEl.innerHTML = '';

  todayBuckets.forEach(b => {
    const total = b.map + b.mmas + b.peacs;
    const pct   = total / maxCount;
    const isCur = b.h === curH;

    const col = document.createElement('div');
    col.style.cssText = `flex:1;display:flex;flex-direction:column;gap:1px;align-items:center;position:relative;`;
    col.title = `${b.h.toString().padStart(2,'0')}:00 — MAP:${b.map} MMAS:${b.mmas} PEACS:${b.peacs}`;

    const totalH = 70;
    const mapH   = Math.round((b.map   / maxCount) * totalH);
    const mmasH  = Math.round((b.mmas  / maxCount) * totalH);
    const peacsH = Math.round((b.peacs / maxCount) * totalH);

    col.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:flex-end;height:${totalH}px;width:100%;gap:1px;">
        <div style="height:${peacsH}px;background:${_C.purple};opacity:${pct>0?0.85:0.1};border-radius:1px 1px 0 0;"></div>
        <div style="height:${mmasH}px;background:${_C.blue};opacity:${pct>0?0.85:0.1};"></div>
        <div style="height:${mapH}px;background:${_C.green};opacity:${pct>0?0.85:0.1};border-radius:0 0 1px 1px;"></div>
      </div>
      ${isCur ? `<div style="position:absolute;top:-4px;width:1px;height:calc(100% + 4px);background:${_C.amber};opacity:0.6;"></div>` : ''}
    `;
    wrap.appendChild(col);

    if (lblEl && b.h % 4 === 0) {
      const lbl = document.createElement('div');
      lbl.style.cssText = `flex:1;font-size:0.70rem;color:${_C.dim};text-align:center;`;
      lbl.textContent = b.h.toString().padStart(2,'0');
      lblEl.appendChild(lbl);
    } else if (lblEl) {
      const spacer = document.createElement('div');
      spacer.style.flex = '1';
      lblEl.appendChild(spacer);
    }
  });
}

// ── Workspace Breakdown ───────────────────────────────────────────────────────

function _saRenderWsBreakdown(wsMap, mmas) {
  const wrap = document.getElementById('sa-ws-breakdown');
  if (!wrap) return;

  const roles = {};
  Object.values(wsMap).forEach(ws => {
    const r = ws.role || ws.tier || 'unknown';
    roles[r] = (roles[r] || 0) + 1;
  });

  const order = ['superadmin','institution','pi','researcher','clinician','student','observer','unknown'];
  const colors = {
    superadmin:'#d4a843', institution:'#a78bfa', pi:'#60a5fa',
    researcher:'#34d399', clinician:'#10b981', student:'#38bdf8',
    observer:'#94a3b8', unknown:'#475569'
  };

  const total = Object.values(roles).reduce((a,b)=>a+b,0) || 1;

  wrap.innerHTML = order.filter(r=>roles[r]).map(r => {
    const n   = roles[r];
    const pct = (n / total * 100).toFixed(0);
    const col = colors[r] || '#94a3b8';
    return `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:6px;height:6px;border-radius:50%;background:${col};flex-shrink:0;"></div>
      <div style="font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;color:${_C.muted};flex:1;">${r}</div>
      <div style="font-size:0.90rem;font-weight:700;color:${col};">${n}</div>
      <div style="width:60px;height:3px;border-radius:2px;background:rgba(56,189,248,0.08);overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:2px;"></div>
      </div>
    </div>`;
  }).join('') || `<div style="font-size:0.90rem;color:${_C.dim};">No workspace data.</div>`;
}

// ── Live Feed ─────────────────────────────────────────────────────────────────

// Recompute MMAS-8 score from q items to correct Q8 stored as integer index (0–4).
function _saMMASScore(rec) {
  if (rec.q1 === undefined) return Number(rec.score) || 0;
  const binary = (parseFloat(rec.q1)||0)+(parseFloat(rec.q2)||0)+(parseFloat(rec.q3)||0)+
                 (parseFloat(rec.q4)||0)+(parseFloat(rec.q5)||0)+(parseFloat(rec.q6)||0)+(parseFloat(rec.q7)||0);
  const raw = rec.q8;
  let q8val;
  if (typeof raw === 'number') {
    q8val = (Number.isInteger(raw) && raw >= 0 && raw <= 4) ? [1,0.75,0.5,0.25,0][raw] : raw;
  } else {
    const s = String(raw||'').trim().toLowerCase();
    q8val = ({'never/rarely':1,'never / rarely':1,'never':1,'rarely':0.75,'once in a while':0.75,
              'sometimes':0.5,'often':0.25,'usually':0.25,'always':0,'all the time':0})[s] ?? 0;
  }
  return binary + q8val;
}

let _saFeedItemCount = 0;

function _saFeedItem(rec, instrument) {
  if (!rec) return;
  const feed = document.getElementById('sa-live-feed');
  if (!feed) return;

  // Clear the placeholder
  const placeholder = feed.querySelector('div[style*="italic"]');
  if (placeholder) placeholder.remove();

  _saFeedItemCount++;
  const countEl = document.getElementById('sa-feed-count');
  if (countEl) countEl.textContent = _saFeedItemCount + ' events';

  const ts   = rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : '—';
  const ws   = (rec.institution_code || '').slice(0,6) || '—';
  const ctry = rec.country || '—';
  const score = instrument === 'mmas'  ? (rec.score!=null    ? _saMMASScore(rec).toFixed(2)+'/8' : '—')
              : instrument === 'peacs' ? (rec.pe!=null       ? 'PE '+rec.pe.toFixed(3)          : '—')
              : /* map */               (rec.map_q1!=null    ? 'PE '+_saMapPE(rec).toFixed(3)   : rec.score!=null ? rec.score.toFixed(3) : '—');

  const col   = instrument === 'mmas' ? _C.blue : instrument === 'peacs' ? _C.purple : _C.green;
  const label = instrument === 'mmas' ? 'MMAS-8' : instrument === 'peacs' ? 'PEACS' : 'MAP';

  const item = document.createElement('div');
  item.className = 'sa-feed-item';
  item.innerHTML = `
    <div class="sa-feed-dot" style="background:${col};"></div>
    <div style="flex:1;min-width:0;">
      <span class="sa-tag" style="color:${col};border-color:${col};opacity:0.7;margin-right:6px;">${label}</span>
      <span style="color:${_C.muted};">${_esc(ws)} · ${_esc(ctry)}</span>
    </div>
    <div style="color:${col};font-weight:600;white-space:nowrap;">${score}</div>
    <div style="color:${_C.dim};font-size:0.78rem;white-space:nowrap;margin-left:8px;">${ts}</div>
  `;

  feed.insertBefore(item, feed.firstChild);

  // Keep feed to 120 items
  while (feed.children.length > 120) feed.removeChild(feed.lastChild);
}

// ── AI Briefing Card (rule-based, Claude API stub ready) ─────────────────────

function _saRenderBriefing(mmas, peacs, map, gai, todayTs) {
  const wrap = document.getElementById('sa-ai-briefing');
  if (!wrap) return;

  const todayMmas  = mmas.filter(r=>r.tool!=='map' && r.map_q1===undefined && (r.timestamp||0)>=todayTs).length;
  const todayMap   = mmas.filter(r=>(r.tool==='map'||r.map_q1!==undefined) && (r.timestamp||0)>=todayTs).length;
  const todayPeacs = peacs.filter(r=>(r.timestamp||0)>=todayTs).length;
  const totalToday = todayMmas + todayMap + todayPeacs;

  const gaiTier = gai >= 0.85 ? 'optimal' : gai >= 0.70 ? 'good' : gai >= 0.55 ? 'moderate' : gai >= 0.40 ? 'poor' : 'critical';
  const mmasOnlyBrief = mmas.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
  const loMmas  = mmasOnlyBrief.filter(r=>(r.score||0)<6).length;
  const loPct   = mmasOnlyBrief.length ? ((loMmas/mmasOnlyBrief.length)*100).toFixed(0) : 0;

  const lines = [
    `GAI is <strong style="color:${gai>=0.70?_C.green:gai>=0.55?_C.amber:_C.red};">${gai.toFixed(3)}</strong> — ${gaiTier} adherence platform-wide.`,
    totalToday > 0 ? `${totalToday.toLocaleString()} assessment${totalToday!==1?'s':''} recorded today across all instruments.` : 'No new assessments recorded today yet.',
    mmasOnlyBrief.length ? `${loPct}% of MMAS-8 cohort falls in low adherence (&lt;6/8) — ${loMmas.toLocaleString()} records flagged.` : 'No MMAS-8 data loaded.',
  ];

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
      <span style="width:5px;height:5px;border-radius:50%;background:${_C.amber};box-shadow:0 0 4px ${_C.amber};"></span>
      <div style="font-size:0.70rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amberDim};">ATLAS Intelligence · ${new Date().toLocaleTimeString()}</div>
    </div>
    ${lines.map(l=>`<div style="font-size:0.88rem;color:${_C.muted};line-height:1.65;margin-bottom:5px;">${l}</div>`).join('')}
    <div style="margin-top:8px;font-size:0.70rem;letter-spacing:0.12em;color:${_C.dim};border-top:1px solid ${_C.border};padding-top:6px;">
      Claude API integration ready — connect <code style="color:${_C.amberDim};">_saCallClaudeAPI()</code> for LLM briefings
    </div>`;
}

async function _saCallClaudeAPI(contextJSON) {
  const key   = (sessionStorage.getItem('atlas_claude_key')  || '').trim();
  const model =  sessionStorage.getItem('atlas_claude_model') || 'claude-haiku-4-5-20251001';
  if (!key) return null;

  // Build full tri-instrument context from cache if not already provided
  const mmas  = _saCache.mmas  || [];
  const peacs = _saCache.peacs || [];
  const mmasOnly = mmas.filter(r => r.map_q1 === undefined);
  const mapRecs  = mmas.filter(r => r.map_q1 !== undefined);
  const now = Date.now();
  const r30 = mmasOnly.filter(r => (r.timestamp||0) >= now - 30*86400000);
  const mmasMean  = mmasOnly.length ? mmasOnly.reduce((s,r)=>s+(r.score||0)/8,0)/mmasOnly.length : 0;
  const mapMean   = mapRecs.length  ? mapRecs.reduce((s,r)=>s+_saMapPE(r),0)/mapRecs.length : null;
  const peacsMean = peacs.length    ? peacs.reduce((s,r)=>s+(r.pe!=null?+r.pe:0),0)/peacs.length : null;

  const enrichedCtx = {
    ...contextJSON.summary,
    mmas_total: mmasOnly.length,
    mmas_global_mean: +mmasMean.toFixed(4),
    mmas_mean_30d: r30.length ? +(r30.reduce((s,r)=>s+(r.score||0)/8,0)/r30.length).toFixed(4) : null,
    map_total: mapRecs.length,
    map_mean_pe: mapMean !== null ? +mapMean.toFixed(4) : null,
    peacs_total: peacs.length,
    peacs_mean_pe: peacsMean !== null ? +peacsMean.toFixed(4) : null,
    workspace_count: Object.keys(_saCache.workspaces||{}).length,
  };

  const userMsg = contextJSON.query
    ? `${contextJSON.query}\n\nData context: ${JSON.stringify(enrichedCtx)}`
    : `Summarise this adherence data: ${JSON.stringify(enrichedCtx)}`;

  const useProxy   = !!(window.ATLAS_CONFIG?.aiProxyUrl);
  const endpoint   = useProxy ? window.ATLAS_CONFIG.aiProxyUrl : 'https://api.anthropic.com/v1/messages';
  const idToken    = useProxy ? (await firebase.auth().currentUser?.getIdToken()) : null;
  const reqHeaders = useProxy
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
    : { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: 'You are ATLAS AI, an adherence science intelligence assistant. ATLAS tracks three instruments: MMAS-8 (score 0–1), MAP Tri-Domain (PE score 0–1, the primary instrument), and PEACS (PE score 0–1). Answer questions with specific numbers from the context. Respond in 1-3 sentences. No markdown headers.',
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || null;
}

// ── Ask ATLAS AI (stub ready for Claude API) ──────────────────────────────────

function _saAskAI() {
  const q = (document.getElementById('sa-ai-query') || {}).value || '';
  if (!q.trim()) return;
  const resp = document.getElementById('sa-ai-response');
  if (!resp) return;
  resp.innerHTML = `<span style="color:${_C.amberDim};">⟳ Processing…</span>`;
  // Build context from cached data
  const ctx = {
    query: q.trim(),
    summary: {
      mmas_n: _saCache.mmas.length,
      peacs_n: _saCache.peacs.length,
      map_n: _saCache.map.length,
      workspaces_n: Object.keys(_saCache.workspaces).length,
    }
  };
  _saCallClaudeAPI(ctx).then(answer => {
    if (answer) {
      resp.innerHTML = `<span style="color:${_C.text};">${answer}</span>`;
    } else {
      // No key set — fall back to rule-based answer
      resp.innerHTML = `<span style="color:${_C.muted};">${_saAiRuleAnswer(ctx.query)}</span>
        <div style="margin-top:6px;font-size:0.72rem;color:${_C.dim};">Rule-based mode · Add Claude API key in Config tab for LLM responses.</div>`;
    }
  }).catch(err => {
    resp.innerHTML = `<span style="color:${_C.dim};">${_saAiRuleAnswer(ctx.query)}</span>
      <div style="margin-top:6px;font-size:0.72rem;color:rgba(239,68,68,0.6);">Claude API error: ${_saEsc(err.message)} — showing rule-based response.</div>`;
  });
}

// ── AI Sidebar Toggle ─────────────────────────────────────────────────────────

function _saToggleAI() {
  _saAiOpen = !_saAiOpen;
  const sb = document.getElementById('sa-ai-sidebar');
  if (sb) sb.style.width = _saAiOpen ? '320px' : '0';
}

// ── Top Bar Live Ticker ───────────────────────────────────────────────────────

function _saInitTopBar() {
  _saTick();
  _saTopBarTimer = setInterval(_saTick, 1000); // live clock
}

function _saTick() {
  const cl = document.getElementById('sa-clock');
  if (cl) cl.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ANOMALY DETECTOR — runs after data loads, flags statistical outliers
// ══════════════════════════════════════════════════════════════════════════════

function _saRunAnomalyDetection() {
  const wrap = document.getElementById('sa-anomaly-queue');
  if (!wrap) return;
  const mmas = _saCache.mmas;
  if (!mmas.length) { wrap.innerHTML = `<div style="font-size:0.88rem;color:${_C.dim};">No anomalies detected.</div>`; return; }

  const anomalies = [];

  // 1. Suspiciously fast completions (if time_to_complete field exists)
  const fast = mmas.filter(r => r.time_to_complete && r.time_to_complete < 60);
  if (fast.length > 0) anomalies.push({ sev: 'warn', msg: `${fast.length} MMAS-8 records completed in <60s — possible straight-lining.` });

  // 2. Perfect scores cluster (score === 8)
  const perfect = mmas.filter(r => (r.score||0) === 8);
  const perfPct  = (perfect.length / mmas.length * 100).toFixed(1);
  if (+perfPct > 40) anomalies.push({ sev: 'warn', msg: `${perfPct}% of MMAS-8 records score 8/8 — ceiling effect or selection bias possible.` });

  // 3. Single-institution dominance
  const byWs = {};
  mmas.forEach(r => { const w = r.institution_code||'Unknown'; byWs[w]=(byWs[w]||0)+1; });
  const topWs   = Object.entries(byWs).sort((a,b)=>b[1]-a[1])[0];
  const topPct  = topWs ? (topWs[1]/mmas.length*100).toFixed(0) : 0;
  if (+topPct > 60) anomalies.push({ sev: 'info', msg: `Workspace ${_esc(topWs[0])} contributes ${topPct}% of all MMAS-8 records.` });

  if (!anomalies.length) anomalies.push({ sev: 'ok', msg: 'No statistical anomalies detected in current dataset.' });

  wrap.innerHTML = anomalies.map(a => {
    const col = a.sev==='warn' ? _C.amber : a.sev==='ok' ? _C.green : _C.cyan;
    return `<div style="display:flex;gap:6px;align-items:flex-start;padding:6px 0;border-bottom:1px solid ${_C.border};">
      <span style="width:5px;height:5px;border-radius:50%;background:${col};margin-top:4px;flex-shrink:0;box-shadow:0 0 4px ${col};"></span>
      <span style="font-size:0.86rem;color:${_C.muted};line-height:1.55;">${a.msg}</span>
    </div>`;
  }).join('');
}

// Anomaly detection fires after data has had time to load from Firebase
// Polled with exponential back-off until cache is populated, then runs once.
(function _scheduleAnomalyDetect(attempt) {
  const delay = Math.min(500 * Math.pow(1.5, attempt), 8000);
  setTimeout(function() {
    if (_saCache.mmas.length > 0 || _saCache.peacs.length > 0) {
      _saRunAnomalyDetection();
    } else if (attempt < 10) {
      _scheduleAnomalyDetect(attempt + 1);
    }
  }, delay);
})(0);

