// sa-globe.js — Geographic Intelligence: map init, layer toggles, cluster drawer, region explain, layer visibility
// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — GLOBAL ATLAS (full-bleed Mapbox globe with toggleable data layers)
// ══════════════════════════════════════════════════════════════════════════════

// Globe state
let _saGlobeMap       = null;   // mapboxgl.Map instance
let _saGlobeLayers    = { density: true, heatmap: false, alerts: true, peacs: false, poi: false, tessera: false };
let _saGlobeFilter    = 'all';  // 'all' | 'mmas' | 'map' | 'peacs'
let _saGlobeClickPanel = null;  // current cluster detail panel content
let _saPoiPopup       = null;   // active Mapbox popup for POI clicks
let _saTesseraPopup   = null;   // active Mapbox popup for TESSERA GRC member clicks

// Time slider state
let _saGlobeAllFeatures  = [];    // full unfiltered feature array (all instruments, all times)
let _saGlobeTimeMonths   = [];    // [{ts, label}] — one entry per calendar month in the dataset
let _saGlobeTimeIndex    = 0;     // current slider position; === _saGlobeTimeMonths.length means "All Time"
let _saGlobeTimeMs       = null;  // null = no cutoff; otherwise ms timestamp of month end
let _saGlobeTimePlaying  = false;
let _saGlobeTimeTimer    = null;
let _saGlobeHideInvalidTs = false; // superadmin toggle: exclude ts=0 records

const _MB_TOKEN = ATLAS_MAPBOX_TOKEN;

function _saRenderGlobe(container) {
  // The globe tab takes over the FULL main area — zero padding
  container.style.padding = '0';
  container.style.overflow = 'hidden';
  container.style.position = 'relative';

  // Reset time slider state on each globe render (tab re-entry tears down the DOM)
  _saGlobeAllFeatures = [];
  _saGlobeTimeMonths  = [];
  _saGlobeTimeIndex   = 0;
  _saGlobeTimeMs      = null;
  _saGlobeTimePlaying = false;
  if (_saGlobeTimeTimer) { clearInterval(_saGlobeTimeTimer); _saGlobeTimeTimer = null; }

  container.innerHTML = `
    <!-- Map canvas -->
    <div id="sa-globe-map" style="position:absolute;inset:0;"></div>

    <!-- Layer controls panel (top-right) -->
    <div id="sa-globe-ctrl" style="
      position:absolute;top:16px;right:16px;z-index:10;
      width:220px;background:rgba(2,12,27,0.92);
      border:1px solid ${_C.borderB};border-radius:10px;
      backdrop-filter:blur(12px);overflow:hidden;
    ">
      <div style="padding:12px 14px;border-bottom:1px solid ${_C.border};">
        <div style="font-size:0.72rem;letter-spacing:0.26em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:2px;">Map Layers</div>
        <div style="font-size:0.96rem;font-weight:700;color:${_C.text};">Global Atlas</div>
      </div>
      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid ${_C.border};">
        ${_saLayerToggle('density', '◉', 'Adherence Density', _C.amber,  true)}
        ${_saLayerToggle('heatmap', '⬡', 'Score Heatmap',     _C.cyan,   false)}
        ${_saLayerToggle('alerts',  '◐', 'Alert Zones',       _C.red,    true)}
        ${_saLayerToggle('peacs',   '◈', 'PEACS Activity',    _C.purple, false)}
        ${_saLayerToggle('poi',     '⬟', 'Verified POIs',     _C.green,  false)}
        ${_saLayerToggle('tessera', '◎', 'TESSERA GRC Members', '#d4a843', false)}
      </div>
      <!-- POI contribute button (shown when POI layer is active) -->
      <div id="sa-globe-poi-contrib-wrap" style="display:none;padding:8px 14px;border-bottom:1px solid ${_C.border};">
        <button onclick="typeof _poiContribOpen==='function'?_poiContribOpen():alert('poi-contributor.js not loaded')"
          style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;
                 padding:6px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(46,201,138,0.35);
                 background:rgba(46,201,138,0.08);color:#2ec98a;transition:background 0.15s;">
          📍 Add POI
        </button>
        <div id="sa-poi-zero-state" style="display:none;margin-top:8px;padding:8px 10px;border-radius:6px;background:rgba(46,201,138,0.04);border:1px solid rgba(46,201,138,0.14);font-family:'IBM Plex Mono',monospace;font-size:0.69rem;color:rgba(46,201,138,0.7);line-height:1.55;text-align:center;">
          No verified POIs in your region yet.<br/>Be the first — click Add POI to contribute.
        </div>
      </div>
      <!-- Instrument filter -->
      <div style="padding:10px 14px;border-bottom:1px solid ${_C.border};">
        <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Instrument</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${['all','mmas','map','peacs'].map(f => `
            <button id="sa-gf-${f}" onclick="saGlobeFilter('${f}')"
              style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;
                     padding:3px 7px;border-radius:4px;cursor:pointer;border:1px solid ${_C.border};
                     background:${f==='all'?_C.amberFaint:'transparent'};
                     color:${f==='all'?_C.amber:_C.muted};transition:all 0.15s;">
              ${f.toUpperCase()}
            </button>`).join('')}
        </div>
      </div>
      <!-- Legend -->
      <div style="padding:10px 14px;">
        <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Adherence Scale</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="height:6px;flex:1;border-radius:3px;background:linear-gradient(to right,#ef4444,#f97316,#d4a843,#38bdf8,#10b981);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px;">
          <span style="font-size:0.68rem;color:${_C.dim};">Low</span>
          <span style="font-size:0.68rem;color:${_C.dim};">High</span>
        </div>
      </div>
    </div>

    <!-- TESSERA Live counter (top-left, shown when TESSERA layer is on) -->
    <div id="sa-tessera-counter" style="
      position:absolute;top:16px;left:16px;z-index:10;
      background:rgba(2,12,27,0.92);border:1px solid rgba(212,168,67,0.28);
      border-radius:10px;padding:10px 14px;backdrop-filter:blur(12px);
      display:none;min-width:190px;
    ">
      <div style="font-size:0.62rem;letter-spacing:0.26em;text-transform:uppercase;color:rgba(212,168,67,0.65);margin-bottom:6px;">TESSERA GRC</div>
      <div style="display:flex;gap:14px;">
        <div style="text-align:center;">
          <div id="sa-tess-institutions" style="font-size:1.1rem;font-weight:700;color:#d4a843;">—</div>
          <div style="font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(107,128,153,0.7);">Institutions</div>
        </div>
        <div style="text-align:center;">
          <div id="sa-tess-countries" style="font-size:1.1rem;font-weight:700;color:#38bdf8;">—</div>
          <div style="font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(107,128,153,0.7);">Countries</div>
        </div>
        <div style="text-align:center;">
          <div id="sa-tess-studies" style="font-size:1.1rem;font-weight:700;color:#2ec98a;">—</div>
          <div style="font-size:0.60rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(107,128,153,0.7);">Open Studies</div>
        </div>
      </div>
      <button onclick="_saOpenResearchExchange()" style="
        margin-top:10px;width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.66rem;
        letter-spacing:0.14em;text-transform:uppercase;padding:5px 8px;border-radius:5px;
        cursor:pointer;border:1px solid rgba(212,168,67,0.3);background:rgba(212,168,67,0.07);
        color:#d4a843;transition:background 0.15s;" onmouseover="this.style.background='rgba(212,168,67,0.14)'" onmouseout="this.style.background='rgba(212,168,67,0.07)'">
        ◎ Research Exchange →
      </button>
    </div>

    <!-- Stats overlay (bottom-left) -->
    <div style="position:absolute;bottom:16px;left:16px;z-index:10;display:flex;gap:8px;">
      ${_saGlobeStat('sa-globe-total', 'Points', '—')}
      ${_saGlobeStat('sa-globe-countries', 'Countries', '—')}
      ${_saGlobeStat('sa-globe-ws', 'Workspaces', '—')}
    </div>

    <!-- Cluster detail drawer (right side, hidden by default) -->
    <div id="sa-globe-drawer" style="
      position:absolute;top:0;right:0;bottom:0;z-index:20;
      width:0;overflow:hidden;transition:width 0.25s ease;
      background:rgba(2,12,27,0.96);border-left:1px solid ${_C.borderB};
      backdrop-filter:blur(16px);
    ">
      <div id="sa-globe-drawer-body" style="width:300px;height:100%;overflow-y:auto;padding:20px 18px;"></div>
    </div>

    <!-- AI explain btn (appears on cluster click) -->
    <div id="sa-globe-ai-btn" style="display:none;position:absolute;bottom:16px;right:240px;z-index:15;">
      <button onclick="_saGlobeExplainRegion()" style="
        font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.1em;text-transform:uppercase;
        background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};
        padding:8px 14px;border-radius:7px;cursor:pointer;backdrop-filter:blur(8px);">
        ◍ Explain This Region →
      </button>
    </div>

    <!-- Time slider — shown after data loads when valid timestamps are found -->
    <div id="sa-time-slider-bar" style="
      display:none;position:absolute;bottom:64px;left:50%;transform:translateX(-50%);z-index:10;
      width:clamp(320px,52vw,540px);background:rgba(2,12,27,0.92);
      border:1px solid rgba(56,189,248,0.18);border-radius:10px;
      padding:10px 16px;backdrop-filter:blur(12px);">
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="sa-time-play-btn" onclick="saGlobeTimeTogglePlay()" title="Play / Pause" style="
          flex-shrink:0;width:28px;height:28px;border-radius:50%;
          border:1px solid rgba(56,189,248,0.35);background:rgba(56,189,248,0.1);
          color:#38bdf8;cursor:pointer;font-size:0.78rem;padding:0;line-height:1;
          display:flex;align-items:center;justify-content:center;">▶</button>
        <div id="sa-time-label" style="
          flex-shrink:0;width:80px;font-family:'IBM Plex Mono',monospace;
          font-size:0.74rem;color:#e8f0f8;text-align:center;letter-spacing:0.05em;">All Time</div>
        <input type="range" id="sa-time-range" min="0" max="1" value="1" step="1"
          oninput="saGlobeTimeScrub(this.value)"
          style="flex:1;accent-color:#38bdf8;cursor:pointer;" />
        <div id="sa-time-count" style="
          flex-shrink:0;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;
          color:rgba(56,189,248,0.65);min-width:54px;text-align:right;">— pts</div>
      </div>
      <!-- Superadmin row: timestamp audit info + hide toggle (shown if isSuperAdmin) -->
      <div id="sa-time-admin-row" style="
        display:none;margin-top:8px;padding-top:8px;
        border-top:1px solid rgba(56,189,248,0.1);
        align-items:center;justify-content:space-between;">
        <div style="font-size:0.68rem;color:rgba(96,120,152,0.8);font-family:'IBM Plex Mono',monospace;">
          <span id="sa-time-invalid-count" style="color:rgba(239,68,68,0.75);">0</span> records missing timestamps
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;
          font-size:0.68rem;color:rgba(138,160,184,0.8);font-family:'IBM Plex Mono',monospace;">
          <input type="checkbox" id="sa-time-hide-invalid"
            onchange="saGlobeTimeHideInvalid(this.checked)"
            style="accent-color:#ef4444;cursor:pointer;" />
          Hide unverified
        </label>
      </div>
    </div>`;

  // Restore padding for other tabs when switching away
  container._saGlobePad = true;

  _saInitGlobeMap();
}

function _saLayerToggle(id, icon, label, color, defaultOn) {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:7px;">
      <span style="font-size:0.94rem;color:${color};opacity:0.8;">${icon}</span>
      <span style="font-size:0.84rem;color:${_C.muted};">${label}</span>
    </div>
    <button id="sa-layer-${id}" onclick="saToggleLayer('${id}')"
      style="width:32px;height:16px;border-radius:8px;border:none;cursor:pointer;position:relative;transition:background 0.2s;
             background:${defaultOn ? color : 'rgba(56,189,248,0.1)'};">
      <span style="position:absolute;top:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left 0.2s;
                   left:${defaultOn ? '18px' : '2px'};box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>
    </button>
  </div>`;
}

function _saGlobeStat(id, label, val) {
  return `<div style="background:rgba(2,12,27,0.85);border:1px solid ${_C.border};border-radius:7px;padding:8px 12px;backdrop-filter:blur(8px);">
    <div id="${id}" style="font-size:0.85rem;font-weight:700;color:${_C.cyan};">${val}</div>
    <div style="font-size:0.70rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};">${label}</div>
  </div>`;
}

function _saInitGlobeMap() {
  if (!window.mapboxgl) {
    document.getElementById('sa-globe-map').innerHTML =
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${_C.muted};font-size:1.00rem;">Mapbox GL not available.</div>`;
    return;
  }

  if (!mapboxgl.accessToken) mapboxgl.accessToken = _MB_TOKEN;

  // Tear down previous globe instance if tab was re-entered
  if (_saGlobeMap) { try { _saGlobeMap.remove(); } catch(e) {} _saGlobeMap = null; }

  _saGlobeMap = new mapboxgl.Map({
    container:  'sa-globe-map',
    style:      'mapbox://styles/mapbox/dark-v11',
    projection: 'globe',
    zoom:       1.4,
    center:     [10, 20],
    antialias:  true,
  });

  _saGlobeMap.on('load', () => {
    // Atmosphere + fog
    _saGlobeMap.setFog({
      color:             '#04091c',
      'high-color':      '#0d1a3a',
      'horizon-blend':   0.06,
      'space-color':     '#010408',
      'star-intensity':  0.45,
    });

    // Add navigation control
    _saGlobeMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Build GeoJSON from cached data and add all layers
    _saGlobeAddData();
  });
}

// Build GeoJSON + add all Mapbox layers from the cached dataset
function _saGlobeAddData() {
  const map = _saGlobeMap;
  if (!map) return;

  const features = [];

  // MMAS points
  _saCache.mmas.forEach(r => {
    if (!r.latitude || !r.longitude) return;
    if (r.map_q1 !== undefined) return; // MAP records handled below
    const score = r.score || 0;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+r.longitude, +r.latitude] },
      properties: {
        instrument: 'mmas',
        score:      score,
        normScore:  score / 8,
        workspace:  r.institution_code || 'Unknown',
        country:    r.country || 'Unknown',
        source:     r.source || r.assessment_mode || 'mmas',
        ts:         r.timestamp || 0,
      }
    });
  });

  // MAP instrument points — all records in assessments node with map_q1 present.
  // Includes pharmacy gateway, CHW gateway, and self-assessment submissions.
  _saCache.mmas.filter(r => r.map_q1 !== undefined && r.latitude && r.longitude).forEach(r => {
    const _a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const _e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const _c=Math.max(0.5, 0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2);
    const pe = Math.pow(Math.max(0,_a*_e*_c),1/3);
    // Determine origin: pharmacy, chw, or self-assessment
    const origin = r.source || r.upload_source || r.assessment_mode || 'map';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+r.longitude, +r.latitude] },
      properties: {
        instrument: 'map',
        score:      pe * 8,
        normScore:  pe,
        workspace:  r.institution_code || r.workspace || r.site_id || 'Unknown',
        country:    r.country || 'Unknown',
        source:     origin,
        ts:         r.timestamp || 0,
      }
    });
  });

  // PEACS points
  _saCache.peacs.forEach(r => {
    if (!r.latitude || !r.longitude) return;
    const pe = r.pe != null ? +r.pe : 0;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+r.longitude, +r.latitude] },
      properties: {
        instrument: 'peacs',
        score:      pe * 8,
        normScore:  pe,
        workspace:  r.institution_code || 'Unknown',
        country:    r.country || 'Unknown',
        source:     r.source || r.assessment_mode || 'peacs',
        ts:         r.timestamp || 0,
      }
    });
  });

  // Store the full unfiltered set so time slider and instrument filter can work from it
  _saGlobeAllFeatures = features.slice();

  // Initialize time slider (shows only if valid timestamps are present)
  _saGlobeInitTimeSlider(features);

  const geojson = { type: 'FeatureCollection', features };

  // Update overlay stats
  const countries = new Set(features.map(f => f.properties.country).filter(c => c !== 'Unknown')).size;
  const workspaces = new Set(features.map(f => f.properties.workspace).filter(w => w !== 'Unknown')).size;
  _saSetEl('sa-globe-total',    features.length.toLocaleString());
  _saSetEl('sa-globe-countries', countries.toString());
  _saSetEl('sa-globe-ws',        workspaces.toString());

  // ── Source ──────────────────────────────────────────────────────────────────
  if (map.getSource('sa-data')) {
    map.getSource('sa-data').setData(geojson);
  } else {
    map.addSource('sa-data', {
      type: 'geojson', data: geojson,
      cluster: true, clusterMaxZoom: 10, clusterRadius: 45,
      clusterProperties: {
        sum_norm:  ['+', ['get', 'normScore']],
        count:     ['+', 1],
      }
    });
  }

  // ── Layer: Cluster circles ───────────────────────────────────────────────────
  if (!map.getLayer('sa-clusters')) {
    map.addLayer({
      id: 'sa-clusters', type: 'circle', source: 'sa-data',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'interpolate', ['linear'],
          ['/', ['get', 'sum_norm'], ['get', 'point_count']],
          0,   '#ef4444',
          0.4, '#f97316',
          0.55,'#d4a843',
          0.7, '#38bdf8',
          0.85,'#10b981',
        ],
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 1, 14, 50, 26, 500, 38, 5000, 52],
        'circle-opacity': 0.82,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(226,232,240,0.2)',
      }
    });
  }

  // ── Layer: Cluster count labels ──────────────────────────────────────────────
  if (!map.getLayer('sa-cluster-count')) {
    map.addLayer({
      id: 'sa-cluster-count', type: 'symbol', source: 'sa-data',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font':  ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size':  11,
      },
      paint: { 'text-color': '#ffffff' }
    });
  }

  // ── Layer: Unclustered single points ─────────────────────────────────────────
  if (!map.getLayer('sa-points')) {
    map.addLayer({
      id: 'sa-points', type: 'circle', source: 'sa-data',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'interpolate', ['linear'], ['get', 'normScore'],
          0, '#ef4444', 0.4, '#f97316', 0.55, '#d4a843', 0.7, '#38bdf8', 0.85, '#10b981',
        ],
        'circle-radius':       6,
        'circle-opacity':      0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(226,232,240,0.25)',
      }
    });
  }

  // ── Layer: Alert zones (pulse rings for low-adherence clusters) ──────────────
  if (!map.getLayer('sa-alerts')) {
    map.addLayer({
      id: 'sa-alerts', type: 'circle', source: 'sa-data',
      filter: ['all', ['has', 'point_count'],
        ['<', ['/', ['get', 'sum_norm'], ['get', 'point_count']], 0.5]],
      paint: {
        'circle-color':        'transparent',
        'circle-radius':       ['interpolate', ['linear'], ['get', 'point_count'], 1, 20, 500, 50],
        'circle-opacity':      0,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ef4444',
        'circle-stroke-opacity': 0.55,
      }
    });
  }

  // ── Layer: PEACS activity (distinct colour) ──────────────────────────────────
  if (!map.getLayer('sa-peacs-layer')) {
    map.addLayer({
      id: 'sa-peacs-layer', type: 'circle', source: 'sa-data',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'instrument'], 'peacs']],
      layout: { visibility: 'none' },
      paint: {
        'circle-color':        '#a78bfa',
        'circle-radius':       7,
        'circle-opacity':      0.8,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(167,139,250,0.4)',
      }
    });
  }

  // ── Layer: Heatmap ───────────────────────────────────────────────────────────
  if (!map.getLayer('sa-heatmap-layer')) {
    map.addLayer({
      id: 'sa-heatmap-layer', type: 'heatmap', source: 'sa-data',
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight':    ['interpolate', ['linear'], ['get', 'normScore'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 3],
        'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 0, 20, 10, 40],
        'heatmap-opacity':   ['interpolate', ['linear'], ['zoom'], 7, 0.85, 14, 0],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(0,0,0,0)',
          0.2, 'rgba(239,68,68,0.5)',
          0.4, 'rgba(249,115,22,0.7)',
          0.6, 'rgba(212,168,67,0.85)',
          0.8, 'rgba(56,189,248,0.9)',
          1.0, 'rgba(16,185,129,1)',
        ],
      }
    });
  }

  // ── Click handler: cluster → drawer ─────────────────────────────────────────
  map.on('click', 'sa-clusters', e => {
    const props  = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates;
    const avg    = props.sum_norm / props.count;
    _saGlobeOpenDrawer({
      lat: coords[1], lng: coords[0],
      count: props.point_count,
      avgNorm: avg,
      avgScore: (avg * 8).toFixed(2),
    });
  });

  map.on('click', 'sa-points', e => {
    const p = e.features[0].properties;
    _saGlobeOpenDrawer({
      lat: e.features[0].geometry.coordinates[1],
      lng: e.features[0].geometry.coordinates[0],
      count: 1,
      avgNorm: p.normScore,
      avgScore: (p.normScore * 8).toFixed(2),
      instrument: p.instrument,
      workspace: p.workspace,
      country: p.country,
    });
  });

  // Pointer cursor on clusters/points
  ['sa-clusters', 'sa-points'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  });

  // Apply current layer visibility state
  _saGlobeApplyLayerVisibility();
}

// Open cluster detail drawer
function _saGlobeOpenDrawer(info) {
  const drawer = document.getElementById('sa-globe-drawer');
  const body   = document.getElementById('sa-globe-drawer-body');
  const aiBtn  = document.getElementById('sa-globe-ai-btn');
  if (!drawer || !body) return;

  const col = info.avgNorm >= 0.85 ? _C.green : info.avgNorm >= 0.70 ? _C.cyan
            : info.avgNorm >= 0.55 ? _C.amber : info.avgNorm >= 0.40 ? '#f97316' : _C.red;
  const tier = info.avgNorm >= 0.85 ? 'Optimal' : info.avgNorm >= 0.70 ? 'Good'
             : info.avgNorm >= 0.55 ? 'Moderate' : info.avgNorm >= 0.40 ? 'Poor' : 'Critical';

  // Store for AI explain
  window._saGlobeCurrentCluster = info;

  // Find nearby assessment records (within ~2 degrees).
  // _saCache.mmas holds both MMAS-8 (no map_q1) and MAP instrument (has map_q1) records.
  // _saCache.map is the mapData geo-pin node — excluded here to avoid double-counting.
  const inRange = r => r.latitude && r.longitude &&
    Math.abs(+r.latitude - info.lat) < 2 && Math.abs(+r.longitude - info.lng) < 2;

  const nearbyMmas  = (_saCache.mmas  || []).filter(r => r.map_q1 === undefined && inRange(r));
  const nearbyMap   = (_saCache.mmas  || []).filter(r => r.map_q1 !== undefined && inRange(r));
  const nearbyPeacs = (_saCache.peacs || []).filter(inRange);
  const nearby = [...nearbyMmas, ...nearbyMap, ...nearbyPeacs];

  const byWs = {};
  nearby.forEach(r => { const w = r.institution_code || r.workspace || '—'; byWs[w] = (byWs[w]||0)+1; });
  const topWs = Object.entries(byWs).sort((a,b) => b[1]-a[1]).slice(0,5);

  const byInst = { mmas: nearbyMmas.length, map: nearbyMap.length, peacs: nearbyPeacs.length };

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:0.72rem;letter-spacing:0.26em;text-transform:uppercase;color:${_C.amberDim};">Cluster Detail</div>
      <button onclick="_saGlobeCloseDrawer()" style="background:none;border:none;color:${_C.dim};font-size:1rem;cursor:pointer;">✕</button>
    </div>

    <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:4px;">${info.lat.toFixed(3)}°, ${info.lng.toFixed(3)}°</div>
    ${info.country ? `<div style="font-size:1.00rem;font-weight:700;color:${_C.text};margin-bottom:12px;">${_esc(info.country)}</div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div class="sa-panel-sm">
        <div style="font-size:1.3rem;font-weight:700;color:${col};">${(info.avgNorm).toFixed(3)}</div>
        <div style="font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Mean Score</div>
      </div>
      <div class="sa-panel-sm">
        <div style="font-size:1.3rem;font-weight:700;color:${_C.text};">${info.count.toLocaleString()}</div>
        <div style="font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};">Records</div>
      </div>
    </div>

    <div style="padding:10px 12px;background:${_C.navy};border:1px solid ${col};border-radius:7px;margin-bottom:14px;">
      <span style="font-size:0.76rem;letter-spacing:0.16em;text-transform:uppercase;color:${col};">● ${tier} Adherence</span>
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Instrument Breakdown</div>
      ${[['MAP', byInst.map, _C.green], ['MMAS-8', byInst.mmas, _C.blue], ['PEACS', byInst.peacs, _C.purple]].map(([lbl,n,c]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <span style="font-size:0.82rem;color:${c};width:50px;">${lbl}</span>
          <div style="flex:1;height:4px;background:${_C.navy};border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${nearby.length?((n/nearby.length)*100).toFixed(0):0}%;background:${c};border-radius:2px;"></div>
          </div>
          <span style="font-size:0.82rem;color:${_C.muted};width:30px;text-align:right;">${n}</span>
        </div>`).join('')}
    </div>

    ${topWs.length ? `
    <div>
      <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Top Workspaces</div>
      ${topWs.map(([ws,n]) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid ${_C.border};">
          <span style="font-size:0.84rem;color:${_C.muted};">${_esc(ws)}</span>
          <span style="font-size:0.84rem;color:${_C.cyan};">${n}</span>
        </div>`).join('')}
    </div>` : ''}`;

  drawer.style.width = '300px';
  if (aiBtn) aiBtn.style.display = 'block';
}

function _saGlobeCloseDrawer() {
  const drawer = document.getElementById('sa-globe-drawer');
  const aiBtn  = document.getElementById('sa-globe-ai-btn');
  if (drawer) drawer.style.width = '0';
  if (aiBtn)  aiBtn.style.display = 'none';
  window._saGlobeCurrentCluster = null;
}

function _saGlobeExplainRegion() {
  const c = window._saGlobeCurrentCluster;
  if (!c) return;
  const resp = document.getElementById('sa-ai-response');
  const q    = document.getElementById('sa-ai-query');
  if (q) q.value = `Explain the adherence profile at ${c.lat.toFixed(2)}, ${c.lng.toFixed(2)} (${c.count} records, mean ${c.avgNorm.toFixed(3)})`;
  _saAskAI();
}

// Toggle a map layer on/off
function saToggleLayer(layerId) {
  _saGlobeLayers[layerId] = !_saGlobeLayers[layerId];
  const btn = document.getElementById('sa-layer-' + layerId);
  const on  = _saGlobeLayers[layerId];
  const col = layerId === 'density' ? _C.amber  : layerId === 'heatmap' ? _C.cyan
            : layerId === 'alerts'  ? _C.red     : layerId === 'poi'     ? _C.green
            : layerId === 'tessera' ? '#d4a843'  : _C.purple;
  if (btn) {
    btn.style.background = on ? col : 'rgba(56,189,248,0.1)';
    const knob = btn.querySelector('span');
    if (knob) knob.style.left = on ? '18px' : '2px';
  }
  // Show/hide the POI contribute button alongside the POI toggle
  if (layerId === 'poi') {
    const wrap = document.getElementById('sa-globe-poi-contrib-wrap');
    if (wrap) wrap.style.display = on ? 'block' : 'none';
    // Lazy-load the POI layer the first time it is turned on
    if (on && _saGlobeMap && !_saGlobeMap.getSource('atlas-poi')) {
      _saLoadPoiLayer(_saGlobeMap);
    }
  }
  // Lazy-load the TESSERA GRC member layer the first time it is turned on
  if (layerId === 'tessera') {
    const counterEl = document.getElementById('sa-tessera-counter');
    if (counterEl) counterEl.style.display = on ? 'block' : 'none';
    if (on && _saGlobeMap && !_saGlobeMap.getSource('tessera-members')) {
      _saLoadTesseraLayer(_saGlobeMap);
    }
  }
  _saGlobeApplyLayerVisibility();
}

function _saGlobeApplyLayerVisibility() {
  const map = _saGlobeMap;
  if (!map || !map.isStyleLoaded()) return;

  const layerMap = {
    density: ['sa-clusters','sa-cluster-count','sa-points'],
    heatmap: ['sa-heatmap-layer'],
    alerts:  ['sa-alerts'],
    peacs:   ['sa-peacs-layer'],
    poi:     ['atlas-poi-layer'],
    tessera: ['tessera-dots','tessera-pulse','tessera-arcs'],
  };

  Object.entries(layerMap).forEach(([key, ids]) => {
    const vis = _saGlobeLayers[key] ? 'visible' : 'none';
    ids.forEach(id => { try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis); } catch(e) {} });
  });
}

// Filter points by instrument — delegates to _saGlobeApplyTimeFilter which
// applies both the instrument filter and the active time cutoff in one pass.
function saGlobeFilter(filter) {
  _saGlobeFilter = filter;

  ['all','mmas','map','peacs'].forEach(f => {
    const btn = document.getElementById('sa-gf-' + f);
    if (!btn) return;
    const active = f === filter;
    btn.style.background  = active ? _C.amberFaint : 'transparent';
    btn.style.color       = active ? _C.amber : _C.muted;
    btn.style.borderColor = active ? 'rgba(212,168,67,0.35)' : _C.border;
  });

  _saGlobeApplyTimeFilter();
}

// ── POI Layer ─────────────────────────────────────────────────────────────────
// Reads verified infrastructure POIs from Firebase and adds them as a
// circle layer on the globe.  Called lazily when the POI toggle is first
// switched on.  Safe to call multiple times — guards on source existence.
function _saLoadPoiLayer(map) {
  if (!map) return;
  if (!window.database) {
    console.warn('[ATLAS] _saLoadPoiLayer: Firebase database not available');
    return;
  }

  database.ref('infrastructure_poi').once('value').then(snap => {
    const raw = snap.val() || {};
    const features = [];

    Object.values(raw).forEach(poi => {
      if (!poi.verified) return;           // globe only shows confirmed POIs
      if (!poi.latitude || !poi.longitude) return;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+poi.longitude, +poi.latitude] },
        properties: {
          type:          poi.type          || 'unknown',
          name:          poi.name          || 'Unnamed POI',
          city:          poi.city          || '',
          country:       poi.country       || '',
          confirmations: poi.confirmations || 1,
        }
      });
    });

    const geojson = { type: 'FeatureCollection', features };

    // Show zero-state notice when no verified POIs exist
    const zeroEl = document.getElementById('sa-poi-zero-state');
    if (zeroEl) zeroEl.style.display = features.length === 0 ? 'block' : 'none';

    // Source
    if (map.getSource('atlas-poi')) {
      map.getSource('atlas-poi').setData(geojson);
    } else {
      map.addSource('atlas-poi', { type: 'geojson', data: geojson });
    }

    // Layer
    if (!map.getLayer('atlas-poi-layer')) {
      map.addLayer({
        id:     'atlas-poi-layer',
        type:   'circle',
        source: 'atlas-poi',
        layout: { visibility: _saGlobeLayers.poi ? 'visible' : 'none' },
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match', ['get', 'type'],
            'pharmacy',         '#10b981',
            'hospital',         '#ef4444',
            'clinic',           '#3b82f6',
            'transport',        '#f59e0b',
            /* food_bank, community_center, default */ '#8b6ff5'
          ],
          'circle-opacity':        0.85,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   'rgba(255,255,255,0.4)',
        }
      });

      // Click popup
      map.on('click', 'atlas-poi-layer', e => {
        const p    = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const typeLabel = {
          pharmacy:         'Pharmacy',
          hospital:         'Hospital',
          clinic:           'Clinic',
          transport:        'Public Transport',
          food_bank:        'Food Bank',
          community_center: 'Community Center',
        }[p.type] || p.type;

        if (_saPoiPopup) _saPoiPopup.remove();
        _saPoiPopup = new mapboxgl.Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#cdd8e8;padding:4px 2px;">
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;color:#e8f0f8;">${_esc(p.name)}</div>
              <div style="letter-spacing:0.1em;text-transform:uppercase;font-size:0.68rem;color:rgba(46,201,138,0.85);margin-bottom:6px;">${_esc(typeLabel)}</div>
              ${p.city ? `<div style="color:rgba(138,160,184,0.9);margin-bottom:2px;">${_esc(p.city)}${p.country ? ', ' + _esc(p.country) : ''}</div>` : ''}
              <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(138,160,184,0.7);font-size:0.70rem;">
                ${p.confirmations} confirmation${p.confirmations !== 1 ? 's' : ''}
              </div>
            </div>`)
          .addTo(map);
      });

      map.on('mouseenter', 'atlas-poi-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'atlas-poi-layer', () => { map.getCanvas().style.cursor = ''; });
    }
  }).catch(err => {
    console.error('[ATLAS] _saLoadPoiLayer error:', err);
  });
}

// ── TESSERA GRC Member Layer ──────────────────────────────────────────────────
// Reads active consortium members from Firebase at consortium_members and
// places markers at country centroids with pulsing glow rings and arcs.
// Also reads research_exchange cards for the Research Pinboard.
// Called lazily the first time the TESSERA GRC toggle is switched on.
function _saLoadTesseraLayer(map) {
  if (!map || !window.database) return;

  // Full country centroid list covering all TESSERA target regions
  const _tesseraCentroids = {
    // Americas
    'United States':   [-98.35,  39.50], 'USA': [-98.35, 39.50],
    'Canada':          [-96.80,  56.13],
    'Mexico':          [-102.55, 23.63],
    'Brazil':          [-51.93, -14.24],
    'Argentina':       [-63.62, -38.42],
    'Colombia':        [-74.30,   4.57],
    'Peru':            [-75.02,  -9.19],
    'Chile':           [-71.54, -35.68],
    // Europe (full EU + EEA)
    'United Kingdom':  [ -3.44,  55.38], 'UK': [-3.44, 55.38],
    'Germany':         [ 10.45,  51.17],
    'France':          [  2.21,  46.23],
    'Italy':           [ 12.57,  41.87],
    'Spain':           [ -3.75,  40.46],
    'Portugal':        [ -8.22,  39.40],
    'Netherlands':     [  5.29,  52.13],
    'Belgium':         [  4.47,  50.50],
    'Switzerland':     [  8.23,  46.82],
    'Austria':         [ 14.55,  47.52],
    'Sweden':          [ 18.64,  60.13],
    'Norway':          [  8.47,  60.47],
    'Denmark':         [  9.50,  56.26],
    'Finland':         [ 25.75,  61.92],
    'Poland':          [ 19.15,  51.92],
    'Czech Republic':  [ 15.47,  49.82],
    'Hungary':         [ 19.50,  47.16],
    'Romania':         [ 24.97,  45.94],
    'Bulgaria':        [ 25.49,  42.73],
    'Croatia':         [ 15.20,  45.10],
    'Greece':          [ 21.82,  39.07],
    'Cyprus':          [ 33.43,  35.13],
    'Malta':           [ 14.38,  35.94],
    'Turkey':          [ 35.24,  38.96],
    'Israel':          [ 34.85,  31.05],
    // Middle East / Africa
    'UAE':             [ 53.85,  23.42],
    'Saudi Arabia':    [ 45.08,  23.89],
    'Egypt':           [ 30.80,  26.82],
    'Nigeria':         [  8.68,   9.08],
    'Kenya':           [ 37.91,  -0.02],
    'Ethiopia':        [ 40.49,   9.15],
    'Ghana':           [ -1.02,   7.95],
    'South Africa':    [ 25.08, -29.00],
    'Iran':            [ 53.69,  32.43],
    // Asia-Pacific
    'India':           [ 78.96,  20.59],
    'China':           [104.20,  35.86],
    'Japan':           [138.25,  36.20],
    'South Korea':     [127.77,  35.91],
    'Singapore':       [103.82,   1.36],
    'Australia':       [133.78, -25.27],
    'New Zealand':     [174.88, -40.90],
    'Thailand':        [100.99,  15.87],
    'Philippines':     [121.77,  12.88],
    'Indonesia':       [113.92,  -0.79],
    'Malaysia':        [109.70,   3.14],
    'Vietnam':         [108.28,  14.06],
    'Pakistan':        [ 69.35,  30.38],
    'Bangladesh':      [ 90.36,  23.68],
  };

  // Tier definitions (match TESSERA GRC tiers in sa-consortium.js)
  const _tierDef = {
    1: { color: '#d4a843', label: 'Institutional Partner' },
    2: { color: '#4e9cf5', label: 'Validation Partner' },
    3: { color: '#2ec98a', label: 'Research Affiliate' },
    4: { color: '#8b6ff5', label: 'Student Affiliate' },
    5: { color: '#f59e0b', label: 'Industry Partner' },
  };

  // Load members and research exchange cards in parallel
  Promise.all([
    database.ref('consortium_members').once('value'),
    database.ref('research_exchange').once('value'),
  ]).then(([membersSnap, exchangeSnap]) => {
    const raw      = membersSnap.val() || {};
    const exchange = exchangeSnap.val() || {};
    const features = [];
    const arcFeatures = [];
    const now = Date.now();

    // Build per-member card count
    const memberCardCount = {};
    Object.values(exchange).forEach(card => {
      if (card.memberId && card.status !== 'closed' && (!card.expires || card.expires > now)) {
        memberCardCount[card.memberId] = (memberCardCount[card.memberId] || 0) + 1;
      }
    });

    // Build member feature list + populate centroid lookup by memberId
    const memberCoords = {};
    Object.entries(raw).forEach(([memberId, member]) => {
      if (member.status && member.status !== 'active') return;
      const centroid = _tesseraCentroids[member.country];
      if (!centroid) return;

      // Jitter members in the same country slightly so they don't stack
      const idx = features.filter(f => f.properties.country === member.country).length;
      const jitterLng = centroid[0] + (idx % 3 - 1) * 0.8;
      const jitterLat = centroid[1] + Math.floor(idx / 3) * 0.8;
      const coords = [jitterLng, jitterLat];
      memberCoords[memberId] = coords;

      const tier = member.tier ? +member.tier : 3;
      const dotColor = (_tierDef[tier] || _tierDef[3]).color;
      const cardCount = memberCardCount[memberId] || 0;

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          memberId,
          name:        member.name        || 'Unknown',
          institution: member.institution || '',
          country:     member.country     || '',
          pi:          member.pi_name     || member.contact_name || '',
          tier,
          dotColor,
          tierLabel:   (_tierDef[tier] || _tierDef[3]).label,
          cardCount,
          // Serialize collaborations as JSON string (Mapbox properties must be scalar)
          collaborations: JSON.stringify(member.collaborations || []),
        }
      });
    });

    // Build collaboration arc features (GeoJSON LineString between partners)
    const arcsSeen = new Set();
    features.forEach(f => {
      const memberId = f.properties.memberId;
      const collabs  = JSON.parse(f.properties.collaborations || '[]');
      collabs.forEach(partnerId => {
        const arcKey = [memberId, partnerId].sort().join('|');
        if (arcsSeen.has(arcKey)) return;
        arcsSeen.add(arcKey);
        const partnerCoords = memberCoords[partnerId];
        if (!partnerCoords) return;
        arcFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [f.geometry.coordinates, partnerCoords] },
          properties: {}
        });
      });
    });

    // Update TESSERA counter overlay
    const uniqueCountries = new Set(Object.values(raw).map(m => m.country).filter(Boolean)).size;
    const openStudies = Object.values(exchange).filter(c => c.type === 'study_seeking_collaborator' && c.status !== 'closed' && (!c.expires || c.expires > now)).length;
    _saSetEl('sa-tess-institutions', features.length.toString());
    _saSetEl('sa-tess-countries', uniqueCountries.toString());
    _saSetEl('sa-tess-studies', openStudies.toString());

    const geojson     = { type: 'FeatureCollection', features };
    const arcGeojson  = { type: 'FeatureCollection', features: arcFeatures };

    // Member source
    if (map.getSource('tessera-members')) {
      map.getSource('tessera-members').setData(geojson);
    } else {
      map.addSource('tessera-members', { type: 'geojson', data: geojson });
    }

    // Collaboration arcs source
    if (map.getSource('tessera-arcs-src')) {
      map.getSource('tessera-arcs-src').setData(arcGeojson);
    } else {
      map.addSource('tessera-arcs-src', { type: 'geojson', data: arcGeojson });
    }

    // ── Layer: collaboration arcs ──────────────────────────────────────────
    if (!map.getLayer('tessera-arcs')) {
      map.addLayer({
        id:     'tessera-arcs',
        type:   'line',
        source: 'tessera-arcs-src',
        layout: { visibility: _saGlobeLayers.tessera ? 'visible' : 'none' },
        paint: {
          'line-color':   'rgba(212,168,67,0.3)',
          'line-width':   1,
          'line-dasharray': [3, 4],
        }
      });
    }

    // ── Layer: pulsing glow ring (outer) ───────────────────────────────────
    if (!map.getLayer('tessera-pulse')) {
      map.addLayer({
        id:     'tessera-pulse',
        type:   'circle',
        source: 'tessera-members',
        layout: { visibility: _saGlobeLayers.tessera ? 'visible' : 'none' },
        paint: {
          'circle-radius':         14,
          'circle-color':          'transparent',
          'circle-stroke-width':   2,
          'circle-stroke-color':   ['get', 'dotColor'],
          'circle-stroke-opacity': 0.30,
          'circle-opacity':        0,
        }
      });
    }

    // ── Layer: member dots (primary marker) ───────────────────────────────
    if (!map.getLayer('tessera-dots')) {
      map.addLayer({
        id:     'tessera-dots',
        type:   'circle',
        source: 'tessera-members',
        layout: { visibility: _saGlobeLayers.tessera ? 'visible' : 'none' },
        paint: {
          'circle-radius':       9,
          'circle-color':        ['get', 'dotColor'],
          'circle-opacity':      0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.45)',
        }
      });

      // Click: rich popup with Research Exchange CTA
      map.on('click', 'tessera-dots', e => {
        const p      = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const flag   = { 'United States':'🇺🇸','UK':'🇬🇧','United Kingdom':'🇬🇧','Germany':'🇩🇪',
          'France':'🇫🇷','Italy':'🇮🇹','Spain':'🇪🇸','Greece':'🇬🇷','Netherlands':'🇳🇱',
          'Canada':'🇨🇦','Australia':'🇦🇺','Japan':'🇯🇵','India':'🇮🇳','Brazil':'🇧🇷',
          'UAE':'🇦🇪','Israel':'🇮🇱','Turkey':'🇹🇷','Poland':'🇵🇱','Sweden':'🇸🇪',
          'China':'🇨🇳','South Korea':'🇰🇷','Singapore':'🇸🇬','South Africa':'🇿🇦',
        }[p.country] || '🌍';

        if (_saTesseraPopup) _saTesseraPopup.remove();
        _saTesseraPopup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px', offset: 12 })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#cdd8e8;padding:4px 2px;">
              <div style="font-weight:700;font-size:0.90rem;margin-bottom:3px;color:#e8f0f8;">${_esc(p.name)}</div>
              ${p.institution ? `<div style="margin-bottom:5px;color:rgba(200,215,230,0.8);font-size:0.78rem;line-height:1.4;">${_esc(p.institution)}</div>` : ''}
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="letter-spacing:0.1em;text-transform:uppercase;font-size:0.66rem;padding:2px 7px;border-radius:10px;background:${p.dotColor}22;border:1px solid ${p.dotColor}55;color:${p.dotColor};">${_esc(p.tierLabel)}</span>
              </div>
              ${p.country ? `<div style="color:rgba(138,160,184,0.9);margin-bottom:4px;">${flag} ${_esc(p.country)}</div>` : ''}
              ${p.pi ? `<div style="color:rgba(138,160,184,0.7);font-size:0.72rem;margin-bottom:8px;">PI: ${_esc(p.pi)}</div>` : ''}
              ${p.cardCount > 0 ? `
              <div style="margin-top:6px;padding:6px 8px;background:rgba(212,168,67,0.07);border:1px solid rgba(212,168,67,0.2);border-radius:5px;margin-bottom:8px;">
                <span style="color:#d4a843;font-size:0.70rem;">◎ ${p.cardCount} open research card${p.cardCount !== 1 ? 's' : ''}</span>
              </div>` : ''}
              <button onclick="_saOpenResearchExchange('${_esc(p.memberId)}')" style="
                width:100%;margin-top:2px;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;
                letter-spacing:0.12em;text-transform:uppercase;padding:6px 8px;border-radius:5px;
                cursor:pointer;border:1px solid rgba(212,168,67,0.3);background:rgba(212,168,67,0.08);
                color:#d4a843;">View Research Pinboard →</button>
            </div>`)
          .addTo(map);
      });

      map.on('mouseenter', 'tessera-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'tessera-dots', () => { map.getCanvas().style.cursor = ''; });
    }

    // Store exchange data globally for the pinboard panel
    window._saTesseraExchange = exchange;
    window._saTesseraMembers  = raw;

  }).catch(err => {
    console.error('[ATLAS] _saLoadTesseraLayer error:', err);
  });
}

// ── Research Exchange / Pinboard ──────────────────────────────────────────────
// Opens the cluster drawer as a Research Pinboard panel. If memberId is provided,
// filters to that member's cards. Otherwise shows the full exchange feed.
function _saOpenResearchExchange(memberId) {
  const drawer = document.getElementById('sa-globe-drawer');
  const body   = document.getElementById('sa-globe-drawer-body');
  if (!drawer || !body) return;

  const exchange = window._saTesseraExchange || {};
  const members  = window._saTesseraMembers  || {};
  const now      = Date.now();

  const typeLabels = {
    study_seeking_collaborator: { label: 'Seeking Collaborator', color: '#d4a843' },
    grant_announcement:         { label: 'Grant Opportunity',    color: '#38bdf8' },
    publication:                { label: 'Publication',          color: '#2ec98a' },
    job_posting:                { label: 'Position Available',   color: '#8b6ff5' },
  };

  let cards = Object.entries(exchange)
    .filter(([, c]) => c.status !== 'closed' && (!c.expires || c.expires > now))
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (b.posted || 0) - (a.posted || 0));

  if (memberId) {
    cards = cards.filter(c => c.memberId === memberId);
  }

  const memberName = memberId && members[memberId] ? members[memberId].name : null;

  const canPost = typeof isSuperAdmin === 'function' && isSuperAdmin();

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-size:0.66rem;letter-spacing:0.26em;text-transform:uppercase;color:rgba(212,168,67,0.65);margin-bottom:2px;">TESSERA GRC</div>
        <div style="font-size:1.00rem;font-weight:700;color:#e8f0f8;">Research Exchange</div>
        ${memberName ? `<div style="font-size:0.76rem;color:rgba(138,160,184,0.8);margin-top:2px;">${_esc(memberName)}</div>` : ''}
      </div>
      <button onclick="_saGlobeCloseDrawer()" style="background:none;border:none;color:rgba(96,120,152,0.65);font-size:1rem;cursor:pointer;">✕</button>
    </div>

    ${memberId ? `<button onclick="_saOpenResearchExchange()" style="
      font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;
      padding:5px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(212,168,67,0.25);
      background:transparent;color:rgba(212,168,67,0.65);margin-bottom:14px;">← All Members</button>` : ''}

    ${canPost ? `
    <button onclick="_saOpenPostCard()" style="
      width:100%;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;font-size:0.70rem;
      letter-spacing:0.14em;text-transform:uppercase;padding:7px 10px;border-radius:6px;
      cursor:pointer;border:1px solid rgba(212,168,67,0.35);background:rgba(212,168,67,0.09);
      color:#d4a843;">+ Post Research Card</button>` : ''}

    ${cards.length === 0 ? `
    <div style="text-align:center;padding:32px 16px;color:rgba(96,120,152,0.65);font-size:0.82rem;line-height:1.7;">
      No active research cards.<br/>
      ${canPost ? 'Post the first card to connect with global collaborators.' : 'Check back soon as TESSERA members post their studies.'}
    </div>` : cards.map(card => {
      const tDef = typeLabels[card.type] || { label: card.type || 'Post', color: '#8b6ff5' };
      const mName = card.memberId && members[card.memberId] ? members[card.memberId].name : '';
      const mCountry = card.memberId && members[card.memberId] ? members[card.memberId].country : '';
      const daysLeft = card.expires ? Math.max(0, Math.ceil((card.expires - now) / 86400000)) : null;
      return `
      <div style="background:rgba(13,27,46,0.9);border:1px solid rgba(212,168,67,0.12);border-radius:8px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;">
          <div>
            <span style="font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;
              padding:2px 6px;border-radius:10px;background:${tDef.color}18;border:1px solid ${tDef.color}40;
              color:${tDef.color};">${_esc(tDef.label)}</span>
          </div>
          ${daysLeft !== null ? `<span style="font-size:0.64rem;color:rgba(96,120,152,0.65);white-space:nowrap;">${daysLeft}d left</span>` : ''}
        </div>
        <div style="font-size:0.88rem;font-weight:700;color:#e8f0f8;margin-bottom:5px;line-height:1.3;">${_esc(card.title || '—')}</div>
        ${mName ? `<div style="font-size:0.74rem;color:rgba(138,160,184,0.8);margin-bottom:4px;">${_esc(mName)}${mCountry ? ' · ' + _esc(mCountry) : ''}</div>` : ''}
        ${card.description ? `<div style="font-size:0.78rem;color:rgba(138,160,184,0.75);line-height:1.55;margin-bottom:8px;">${_esc(card.description).slice(0, 160)}${(card.description||'').length > 160 ? '…' : ''}</div>` : ''}
        ${card.countries_seeking && card.countries_seeking.length ? `
        <div style="font-size:0.70rem;color:rgba(56,189,248,0.8);margin-top:4px;">
          Seeking: ${(Array.isArray(card.countries_seeking) ? card.countries_seeking : [card.countries_seeking]).map(c => _esc(c)).join(', ')}
        </div>` : ''}
        ${card.contact_email ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <a href="mailto:${_esc(card.contact_email)}" style="color:#d4a843;font-size:0.70rem;text-decoration:none;">Contact PI →</a>
        </div>` : ''}
      </div>`;
    }).join('')}`;

  drawer.style.width = '320px';
  document.getElementById('sa-globe-ai-btn') && (document.getElementById('sa-globe-ai-btn').style.display = 'none');
}

// Post a new research exchange card (superadmin only)
function _saOpenPostCard() {
  const body = document.getElementById('sa-globe-drawer-body');
  if (!body) return;

  const members = window._saTesseraMembers || {};
  const memberOptions = Object.entries(members)
    .filter(([, m]) => m.status !== 'inactive')
    .map(([id, m]) => `<option value="${_esc(id)}">${_esc(m.name || id)}</option>`)
    .join('');

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:0.96rem;font-weight:700;color:#e8f0f8;">Post Research Card</div>
      <button onclick="_saOpenResearchExchange()" style="background:none;border:none;color:rgba(96,120,152,0.65);font-size:0.80rem;cursor:pointer;font-family:'IBM Plex Mono',monospace;">← Back</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Member</label>
        <select id="rex-member" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;">
          <option value="">— Select member —</option>${memberOptions}
        </select>
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Type</label>
        <select id="rex-type" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;">
          <option value="study_seeking_collaborator">Seeking Collaborator</option>
          <option value="grant_announcement">Grant Opportunity</option>
          <option value="publication">Publication</option>
          <option value="job_posting">Position Available</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Title</label>
        <input id="rex-title" placeholder="Study or announcement title" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Description (optional)</label>
        <textarea id="rex-desc" placeholder="Brief description (2–3 sentences)" rows="3" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;resize:vertical;box-sizing:border-box;"></textarea>
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Countries Sought (comma-separated)</label>
        <input id="rex-countries" placeholder="e.g. Greece, Germany, Spain" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Contact Email</label>
        <input id="rex-email" type="email" placeholder="pi@institution.edu" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(138,160,184,0.7);display:block;margin-bottom:4px;">Expires (days from today)</label>
        <input id="rex-days" type="number" value="90" min="7" max="365" style="width:100%;background:#0d1b2e;border:1px solid rgba(212,168,67,0.2);color:#cdd8e8;padding:7px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:0.78rem;box-sizing:border-box;" />
      </div>
      <button onclick="_saSubmitResearchCard()" style="
        width:100%;margin-top:4px;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;
        letter-spacing:0.14em;text-transform:uppercase;padding:9px;border-radius:6px;
        cursor:pointer;border:1px solid rgba(212,168,67,0.4);background:rgba(212,168,67,0.12);
        color:#d4a843;font-weight:600;">Post Card →</button>
    </div>`;
}

function _saSubmitResearchCard() {
  if (!window.database) return;
  const memberId = document.getElementById('rex-member')?.value?.trim();
  const type     = document.getElementById('rex-type')?.value;
  const title    = document.getElementById('rex-title')?.value?.trim();
  const desc     = document.getElementById('rex-desc')?.value?.trim();
  const countries = (document.getElementById('rex-countries')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const email    = document.getElementById('rex-email')?.value?.trim();
  const days     = parseInt(document.getElementById('rex-days')?.value) || 90;

  if (!memberId || !title) { alert('Member and title are required.'); return; }

  const card = {
    memberId,
    type:              type || 'study_seeking_collaborator',
    title,
    description:       desc || null,
    countries_seeking: countries.length ? countries : null,
    contact_email:     email || null,
    posted:            Date.now(),
    expires:           Date.now() + days * 86400000,
    status:            'active',
  };

  database.ref('research_exchange').push(card)
    .then(() => {
      showToast('Research card posted to TESSERA Exchange.', 3000);
      // Reload the exchange data and refresh the layer
      database.ref('research_exchange').once('value').then(snap => {
        window._saTesseraExchange = snap.val() || {};
        _saOpenResearchExchange();
      });
    })
    .catch(err => {
      console.error('[ATLAS] Research card post failed:', err);
      alert('Could not post card. Check console for details.');
    });
}

// ── Time Slider ───────────────────────────────────────────────────────────────

// Called from _saGlobeAddData after features are built.
// Computes the month range, logs the timestamp audit, and wires up the slider.
function _saGlobeInitTimeSlider(features) {
  const validTs    = features.map(f => f.properties.ts).filter(t => t > 0);
  const invalidCnt = features.length - validTs.length;
  const pct        = features.length > 0 ? ((invalidCnt / features.length) * 100).toFixed(1) : '0';

  if (validTs.length === 0) return; // no time data — keep slider hidden

  // Build one entry per calendar month from earliest record to now
  const minTs = Math.min(...validTs);
  _saGlobeTimeMonths = [];
  const cursor = new Date(minTs);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const now = Date.now();

  while (cursor.getTime() <= now) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    cursor.setMonth(cursor.getMonth() + 1);
    _saGlobeTimeMonths.push({ ts: cursor.getTime() - 1, label }); // end of that month
  }

  if (_saGlobeTimeMonths.length < 2) return; // dataset spans less than two months

  const rangeEl      = document.getElementById('sa-time-range');
  const bar          = document.getElementById('sa-time-slider-bar');
  const adminRow     = document.getElementById('sa-time-admin-row');
  const invalidEl    = document.getElementById('sa-time-invalid-count');

  if (!bar || !rangeEl) return;

  // Slider max = _saGlobeTimeMonths.length; that index means "All Time" (no cutoff)
  rangeEl.min   = '0';
  rangeEl.max   = String(_saGlobeTimeMonths.length);
  rangeEl.value = String(_saGlobeTimeMonths.length);
  _saGlobeTimeIndex = _saGlobeTimeMonths.length;

  if (invalidEl) invalidEl.textContent = invalidCnt.toString();

  // Show the superadmin row only for superadmins
  if (adminRow && invalidCnt > 0 && typeof isSuperAdmin === 'function' && isSuperAdmin()) {
    adminRow.style.display = 'flex';
  }

  bar.style.display = 'block';
  _saGlobeUpdateTimeLabel();
}

// Single source of truth for what appears on the globe — applies both the
// active time cutoff and the instrument filter to _saGlobeAllFeatures.
function _saGlobeApplyTimeFilter() {
  const map = _saGlobeMap;
  if (!map || !map.isStyleLoaded() || !map.getSource('sa-data')) return;

  let filtered = _saGlobeAllFeatures;

  // Time cutoff (cumulative: show all ts <= cutoff)
  if (_saGlobeTimeMs !== null) {
    filtered = filtered.filter(f => {
      const ts = f.properties.ts;
      if (!ts) return !_saGlobeHideInvalidTs;
      return ts <= _saGlobeTimeMs;
    });
  } else if (_saGlobeHideInvalidTs) {
    filtered = filtered.filter(f => f.properties.ts > 0);
  }

  // Instrument filter on top
  if (_saGlobeFilter !== 'all') {
    filtered = filtered.filter(f => f.properties.instrument === _saGlobeFilter);
  }

  map.getSource('sa-data').setData({ type: 'FeatureCollection', features: filtered });

  // Update stats overlay
  const countries  = new Set(filtered.map(f => f.properties.country).filter(c => c && c !== 'Unknown')).size;
  const workspaces = new Set(filtered.map(f => f.properties.workspace).filter(w => w && w !== 'Unknown')).size;
  _saSetEl('sa-globe-total',     filtered.length.toLocaleString());
  _saSetEl('sa-globe-countries', countries.toString());
  _saSetEl('sa-globe-ws',        workspaces.toString());

  // Update count badge in slider bar
  const countEl = document.getElementById('sa-time-count');
  if (countEl) countEl.textContent = filtered.length.toLocaleString() + ' pts';
}

// Called by the range input's oninput handler
function saGlobeTimeScrub(value) {
  _saGlobeTimeIndex = parseInt(value, 10);
  _saGlobeUpdateTimeLabel();
  _saGlobeApplyTimeFilter();
}

// Sync the label and _saGlobeTimeMs from the current slider index
function _saGlobeUpdateTimeLabel() {
  const labelEl = document.getElementById('sa-time-label');
  if (_saGlobeTimeIndex >= _saGlobeTimeMonths.length) {
    if (labelEl) labelEl.textContent = 'All Time';
    _saGlobeTimeMs = null;
  } else {
    if (labelEl) labelEl.textContent = _saGlobeTimeMonths[_saGlobeTimeIndex].label;
    _saGlobeTimeMs = _saGlobeTimeMonths[_saGlobeTimeIndex].ts;
  }
}

// Play / Pause toggle (called by the ▶ button)
function saGlobeTimeTogglePlay() {
  if (_saGlobeTimePlaying) { _saGlobeTimePause(); } else { _saGlobeTimePlay(); }
}

function saGlobeTimePlay() {
  if (_saGlobeTimePlaying || _saGlobeTimeMonths.length === 0) return;
  _saGlobeTimePlaying = true;
  const playBtn = document.getElementById('sa-time-play-btn');
  if (playBtn) playBtn.textContent = '⏸';

  // Rewind to the beginning if already at the end
  if (_saGlobeTimeIndex >= _saGlobeTimeMonths.length) {
    _saGlobeTimeIndex = 0;
    const rangeEl = document.getElementById('sa-time-range');
    if (rangeEl) rangeEl.value = '0';
    _saGlobeUpdateTimeLabel();
    _saGlobeApplyTimeFilter();
  }

  _saGlobeTimeTimer = setInterval(() => {
    _saGlobeTimeIndex++;
    const rangeEl = document.getElementById('sa-time-range');
    if (rangeEl) rangeEl.value = String(_saGlobeTimeIndex);
    _saGlobeUpdateTimeLabel();
    _saGlobeApplyTimeFilter();
    if (_saGlobeTimeIndex >= _saGlobeTimeMonths.length) _saGlobeTimePause();
  }, 800);
}

function _saGlobeTimePause() {
  _saGlobeTimePlaying = false;
  if (_saGlobeTimeTimer) { clearInterval(_saGlobeTimeTimer); _saGlobeTimeTimer = null; }
  const playBtn = document.getElementById('sa-time-play-btn');
  if (playBtn) playBtn.textContent = '▶';
}

// Superadmin: hide/show records with ts=0
function saGlobeTimeHideInvalid(checked) {
  _saGlobeHideInvalidTs = checked;
  _saGlobeApplyTimeFilter();
}
