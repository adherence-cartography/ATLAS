// sa-globe.js — Geographic Intelligence: map init, layer toggles, cluster drawer, region explain, layer visibility
// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — GLOBAL ATLAS (full-bleed Mapbox globe with toggleable data layers)
// ══════════════════════════════════════════════════════════════════════════════

// Globe state
let _saGlobeMap       = null;   // mapboxgl.Map instance
let _saGlobeLayers    = { density: true, heatmap: false, alerts: true, peacs: false, poi: false };
let _saGlobeFilter    = 'all';  // 'all' | 'mmas' | 'map' | 'peacs'
let _saGlobeClickPanel = null;  // current cluster detail panel content
let _saPoiPopup       = null;   // active Mapbox popup for POI clicks

const _MB_TOKEN = ATLAS_MAPBOX_TOKEN;

function _saRenderGlobe(container) {
  // The globe tab takes over the FULL main area — zero padding
  container.style.padding = '0';
  container.style.overflow = 'hidden';
  container.style.position = 'relative';

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
        ts:         r.timestamp || 0,
      }
    });
  });

  // MAP instrument points (records with map_q1 field in assessments node)
  // Note: _saCache.map (mapData node) is intentionally excluded here — those are geographic
  // duplicates of MMAS assessment records already plotted above from _saCache.mmas.
  _saCache.mmas.filter(r => r.map_q1 !== undefined && r.latitude && r.longitude).forEach(r => {
    const _a=((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3;
    const _e=((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3;
    const _c=0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2;
    const pe = Math.pow(Math.max(0,_a*_e*_c),1/3);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+r.longitude, +r.latitude] },
      properties: {
        instrument: 'map',
        score:      pe * 8,
        normScore:  pe,
        workspace:  r.institution_code || r.workspace || 'Unknown',
        country:    r.country || 'Unknown',
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
        ts:         r.timestamp || 0,
      }
    });
  });

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

  // Find nearby records (within ~2 degrees for a fast approximation)
  const nearby = [..._saCache.mmas, ..._saCache.map, ..._saCache.peacs].filter(r => {
    if (!r.latitude || !r.longitude) return false;
    return Math.abs(+r.latitude - info.lat) < 2 && Math.abs(+r.longitude - info.lng) < 2;
  });

  const byWs = {};
  nearby.forEach(r => { const w = r.institution_code || r.workspace || '—'; byWs[w] = (byWs[w]||0)+1; });
  const topWs = Object.entries(byWs).sort((a,b) => b[1]-a[1]).slice(0,5);

  const byInst = { mmas: 0, map: 0, peacs: 0 };
  _saCache.mmas.filter(r => r.latitude && Math.abs(+r.latitude-info.lat)<2).forEach(()=>byInst.mmas++);
  _saCache.map.filter(r => r.latitude && Math.abs(+r.latitude-info.lat)<2).forEach(()=>byInst.map++);
  _saCache.peacs.filter(r => r.latitude && Math.abs(+r.latitude-info.lat)<2).forEach(()=>byInst.peacs++);

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:0.72rem;letter-spacing:0.26em;text-transform:uppercase;color:${_C.amberDim};">Cluster Detail</div>
      <button onclick="_saGlobeCloseDrawer()" style="background:none;border:none;color:${_C.dim};font-size:1rem;cursor:pointer;">✕</button>
    </div>

    <div style="font-size:0.84rem;color:${_C.muted};margin-bottom:4px;">${info.lat.toFixed(3)}°, ${info.lng.toFixed(3)}°</div>
    ${info.country ? `<div style="font-size:1.00rem;font-weight:700;color:${_C.text};margin-bottom:12px;">${info.country}</div>` : ''}

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
          <span style="font-size:0.84rem;color:${_C.muted};">${ws}</span>
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
            : _C.purple;
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
  };

  Object.entries(layerMap).forEach(([key, ids]) => {
    const vis = _saGlobeLayers[key] ? 'visible' : 'none';
    ids.forEach(id => { try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis); } catch(e) {} });
  });
}

// Filter points by instrument
function saGlobeFilter(filter) {
  _saGlobeFilter = filter;

  // Update button styles
  ['all','mmas','map','peacs'].forEach(f => {
    const btn = document.getElementById('sa-gf-' + f);
    if (!btn) return;
    const active = f === filter;
    btn.style.background = active ? _C.amberFaint : 'transparent';
    btn.style.color      = active ? _C.amber : _C.muted;
    btn.style.borderColor = active ? 'rgba(212,168,67,0.35)' : _C.border;
  });

  const map = _saGlobeMap;
  if (!map || !map.isStyleLoaded()) return;

  // Rebuild features for the active filter
  const filtered = {
    type: 'FeatureCollection',
    features: (map.getSource('sa-data')?._data?.features || [])
      .filter(f => filter === 'all' || f.properties.instrument === filter)
  };

  // Re-inject data (if source exists)
  if (map.getSource('sa-data')) {
    // Need to rebuild GeoJSON then set data
    // NOTE: _saCache.mmas holds both MMAS-8 records (no map_q1) and MAP instrument
    // records (have map_q1). _saCache.map is the mapData node — geographic MMAS
    // duplicates — which should NOT be used here to avoid double-counting.
    const features = [];
    const push = (arr, inst) => arr.forEach(r => {
      if (!r.latitude || !r.longitude) return;
      if (filter !== 'all' && inst !== filter) return;
      const pe = inst === 'mmas' ? (r.score||0)/8 : inst === 'map' ? Math.pow(Math.max(0,((+r.map_q2||0)+(+r.map_q3||0)+(+r.map_q6||0))/3*((+r.map_q1||0)+(+r.map_q5||0)+(+r.map_q8||0))/3*(0.5+0.5*((+r.map_q4||0)+(+r.map_q7||0))/2)),1/3) : (r.pe!=null ? +r.pe : 0);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+r.longitude, +r.latitude] },
        properties: { instrument: inst, score: pe*8, normScore: pe,
          workspace: r.institution_code||r.workspace||'Unknown', country: r.country||'Unknown', ts: r.timestamp||0 }
      });
    });
    push((_saCache.mmas||[]).filter(r => r.map_q1 === undefined), 'mmas');
    push((_saCache.mmas||[]).filter(r => r.map_q1 !== undefined), 'map');
    push(_saCache.peacs, 'peacs');
    map.getSource('sa-data').setData({ type: 'FeatureCollection', features });
    _saSetEl('sa-globe-total', features.length.toLocaleString());
  }
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
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;color:#e8f0f8;">${p.name}</div>
              <div style="letter-spacing:0.1em;text-transform:uppercase;font-size:0.68rem;color:rgba(46,201,138,0.85);margin-bottom:6px;">${typeLabel}</div>
              ${p.city ? `<div style="color:rgba(138,160,184,0.9);margin-bottom:2px;">${p.city}${p.country ? ', ' + p.country : ''}</div>` : ''}
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
