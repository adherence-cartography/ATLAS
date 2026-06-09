// ══════════════════════════════════════════════
// MMAS MAP (researcher view)
// ══════════════════════════════════════════════
/**
 * Initialises the MMAS-8 researcher map using Mapbox GL. Skips re-initialisation
 * if the map is already created, and shows a graceful fallback if Mapbox fails to load
 * within 8 seconds.
 * @returns {void}
 */
function initMmasMap() {
  if (mmasMapInited) { ensureMapbox().then(()=>{ setTimeout(()=>mmasMapInstance&&mmasMapInstance.resize(),100); }); return; }
  mmasMapInited = true;

  // Timeout fallback — if Mapbox doesn't load in 8 seconds, show a graceful message
  const _mapTimeout = setTimeout(() => {
    const mc = document.getElementById('mmas-map');
    if (mc && !mmasMapInited) {
      mc.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:24px;text-align:center;">' +
        '<span style="font-size:1.8rem;">📍</span>' +
        '<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--muted);">Map unavailable on this connection</div>' +
        '<button onclick="initMmasMap()" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.12);border:1px solid rgba(78,156,245,0.3);color:var(--base);padding:8px 18px;border-radius:8px;cursor:pointer;">↺ Retry</button>' +
        '</div>';
    }
  }, 8000);

  ensureMapbox().then(() => {
    clearTimeout(_mapTimeout);
    mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
    mmasMapInstance = new mapboxgl.Map({
      container: 'mmas-map',
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0,20], zoom:2, projection:'globe'
    });
    mmasMapInstance.addControl(new mapboxgl.NavigationControl());

    mmasMapInstance.on('load', () => {
      const fog = window._mapboxFog || {
        color: '#04091c', 'high-color': '#0d1a3a',
        'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
      };
      mmasMapInstance.setFog(fog);
      if (!window._mmasMapRotInt) {
        window._mmasMapRotInt = setInterval(() => {
          if (!spectatorActive && mmasMapInstance.getZoom() < 3) {
            const c = mmasMapInstance.getCenter(); c.lng += 0.3; if (c.lng > 180) c.lng = -180; mmasMapInstance.setCenter(c);
          }
        }, 1500);
      }
      mmasMapInstance.on('movestart', () => { if (window._mmasMapRotInt) { clearInterval(window._mmasMapRotInt); window._mmasMapRotInt = null; } });
      if (!mmasListening) loadMmasMapData();
    });
  }).catch(() => {
    clearTimeout(_mapTimeout);
    const mc = document.getElementById('mmas-map');
    if (mc) mc.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:24px;text-align:center;">' +
      '<span style="font-size:1.8rem;">📍</span>' +
      '<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--muted);">Map could not be loaded</div>' +
      '<button onclick="initMmasMap()" style="font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(78,156,245,0.12);border:1px solid rgba(78,156,245,0.3);color:var(--base);padding:8px 18px;border-radius:8px;cursor:pointer;">↺ Retry</button>' +
      '</div>';
  });
}

/**
 * Loads all existing /mapData records from Firebase and adds them as markers,
 * then starts the live listener for subsequent submissions.
 * @returns {void}
 */
function loadMmasMapData() {
  mmasListening = true;
  mmasTotal=0; mmasCountries=new Set(); mmasCountryData={}; mmasMarkersMap={};
  database.ref('mapData').once('value', snap => {
    const data = snap.val();
    if (data) Object.values(data).forEach(a => addMmasMarker(a));
    listenMmasLive();
  });
}

/**
 * Attaches a Firebase onChildAdded listener to /mapData, adding only new records
 * submitted after the listener was registered. Guards against duplicate attachment.
 * @returns {void}
 */
function listenMmasLive() {
  if (window._mmasLiveListenerActive) return;
  window._mmasLiveListenerActive = true;
  const since = Date.now();
  database.ref('mapData').on('child_added', snap => {
    const a = snap.val();
    if (a.timestamp > since) addMmasMarker(a);
  });
}

function buildMmasPopupHTML(records, idx) {
  const a   = records[idx];
  const cat = getAdherenceCategory(a.score);
  const total = records.length;
  const inaItems = (a.q1!==undefined) ? ['q1','q2','q3','q4','q5','q6','q7','q8'].filter(k=>a[k]===0).map(k=>'Q'+(parseInt(k.replace('q','')))) : [];
  const {intentional=0,unintentional=0} = (a.q1!==undefined) ? classifyPattern(a) : {};
  const pattern = (a.q1!==undefined) ? (intentional>unintentional?'INA':unintentional>intentional?'UNA':a.score>=8?'High Adherence':'Mixed') : '—';
  const patColors = {'INA':'#ef4444','UNA':'#f59e0b','High Adherence':'#10b981','Mixed':'#8b6ff5'};
  const patCol = patColors[pattern]||'#6b8099';
  const dateStr = a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
  const patientId = a.patient_number ? `Patient #${a.patient_number}` : (a.user_id ? `UID ···${String(a.user_id).slice(-6)}` : '');
  return `<div style="font-family:'IBM Plex Sans',sans-serif;background:rgba(8,14,26,0.97);border-radius:12px;min-width:240px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.06);">
    <div style="padding:14px 16px 12px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#4a5f78;margin-bottom:6px;">MMAS-8 · ${total} submission${total>1?'s':''}</div>
      <div style="font-size:14px;font-weight:600;color:#e8f0f8;margin-bottom:3px;">${(a.city&&a.city!=='Unknown')?a.city:'—'}, ${(a.country&&a.country!=='Unknown')?a.country:'—'}</div>
      ${patientId?`<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b8099;margin-bottom:6px;">${patientId}</div>`:''}
      <div style="font-size:26px;font-weight:300;color:${cat.color};font-family:'Cormorant Garamond',Georgia,serif;line-height:1;margin-bottom:4px;">${a.score.toFixed(2)} <span style="font-size:13px;color:#6b8099;">/ 8</span></div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.1em;color:${cat.color};text-transform:uppercase;margin-bottom:8px;">${cat.label}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid ${patCol}33;color:${patCol};">${pattern}</span>
        ${inaItems.length?`<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(239,68,68,0.25);color:#ef4444;">Flags: ${inaItems.join(', ')}</span>`:''}
      </div>
      ${a.condition?`<div style="font-size:11px;color:#6b8099;font-family:'IBM Plex Mono',monospace;margin-bottom:4px;">${a.condition}</div>`:''}
      ${a.study_title?`<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#4a5f78;margin-bottom:3px;">Study</div>
        <div style="font-size:11px;color:#c8d8ea;font-style:italic;margin-bottom:2px;">${a.study_title}</div>
        ${a.pi_name?`<div style="font-size:10px;color:#6b8099;font-family:'IBM Plex Mono',monospace;">${a.pi_name}${a.study_institution?' · '+a.study_institution:''}</div>`:''}
        ${a.irb_number?`<div style="font-size:10px;color:#4a5f78;font-family:'IBM Plex Mono',monospace;">IRB ${a.irb_number}</div>`:''}
        ${a.clinicaltrials_id?`<div style="font-size:10px;color:#4a5f78;font-family:'IBM Plex Mono',monospace;">${a.clinicaltrials_id}</div>`:''}
      </div>`:''}
      ${dateStr?`<div style="font-size:10px;color:#4a5f78;font-family:'IBM Plex Mono',monospace;margin-top:4px;">${dateStr}</div>`:''}
    </div>
    ${total>1?`<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);">
      <button onclick="mmasPopupNav(this,${-1})" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;${idx===0?'opacity:0.3;pointer-events:none;':''}">‹</button>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5f78;">${idx+1} / ${total}</span>
      <button onclick="mmasPopupNav(this,${1})" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#6b8099;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;${idx===total-1?'opacity:0.3;pointer-events:none;':''}">›</button>
    </div>`:''}
  </div>`;
}

function mmasPopupNav(btn, dir) {
  const wrapper = btn.closest('.mapboxgl-popup-content');
  if (!wrapper) return;
  const key = wrapper.dataset.mmasKey;
  if (!key) return;
  let cluster = mmasMarkersMap[key];
  if (!cluster && window._mmasInlineClusters) cluster = window._mmasInlineClusters[key];
  if (!cluster || !cluster.records) return;
  cluster.popupIdx = Math.max(0, Math.min(cluster.records.length-1, (cluster.popupIdx||0) + dir));
  cluster.popup.setHTML(buildMmasPopupHTML(cluster.records, cluster.popupIdx));
  setTimeout(()=>{
    const w2 = cluster.popup.getElement() && cluster.popup.getElement().querySelector('.mapboxgl-popup-content');
    if (w2) w2.dataset.mmasKey = key;
  }, 10);
}

// ── Country normalization — ISO2 codes + abbreviations → full names ─────────
const _NORM_COUNTRY = {
  'Af':'Afghanistan','Al':'Albania','Dz':'Algeria','Ao':'Angola','Ar':'Argentina',
  'Am':'Armenia','Au':'Australia','At':'Austria','Az':'Azerbaijan','Bh':'Bahrain',
  'Bd':'Bangladesh','By':'Belarus','Be':'Belgium','Bo':'Bolivia','Br':'Brazil',
  'Bg':'Bulgaria','Kh':'Cambodia','Cm':'Cameroon','Ca':'Canada','Cl':'Chile',
  'Cn':'China','Co':'Colombia','Hr':'Croatia','Cu':'Cuba','Cy':'Cyprus',
  'Cz':'Czech Republic','Dk':'Denmark','Do':'Dominican Republic','Ec':'Ecuador',
  'Eg':'Egypt','Et':'Ethiopia','Fi':'Finland','Fr':'France','Ge':'Georgia',
  'De':'Germany','Gh':'Ghana','Gr':'Greece','Gt':'Guatemala','Hn':'Honduras',
  'Hk':'Hong Kong','Hu':'Hungary','In':'India','Id':'Indonesia','Ir':'Iran',
  'Iq':'Iraq','Ie':'Ireland','Il':'Israel','It':'Italy','Jm':'Jamaica',
  'Jp':'Japan','Jo':'Jordan','Kz':'Kazakhstan','Ke':'Kenya','Kw':'Kuwait',
  'Lv':'Latvia','Lb':'Lebanon','Ly':'Libya','Lt':'Lithuania','Lu':'Luxembourg',
  'My':'Malaysia','Mt':'Malta','Mx':'Mexico','Md':'Moldova','Ma':'Morocco',
  'Mz':'Mozambique','Mm':'Myanmar','Na':'Namibia','Np':'Nepal','Nl':'Netherlands',
  'Nz':'New Zealand','Ni':'Nicaragua','Ng':'Nigeria','No':'Norway','Om':'Oman',
  'Pk':'Pakistan','Pa':'Panama','Py':'Paraguay','Pe':'Peru','Ph':'Philippines',
  'Pl':'Poland','Pt':'Portugal','Qa':'Qatar','Ro':'Romania','Ru':'Russia',
  'Sa':'Saudi Arabia','Sn':'Senegal','Rs':'Serbia','Sg':'Singapore','So':'Somalia',
  'Za':'South Africa','Kr':'South Korea','Es':'Spain','Lk':'Sri Lanka',
  'Se':'Sweden','Ch':'Switzerland','Sy':'Syria','Tw':'Taiwan','Tj':'Tajikistan',
  'Tz':'Tanzania','Th':'Thailand','Tn':'Tunisia','Tr':'Turkey','Ug':'Uganda',
  'Ua':'Ukraine','Ae':'United Arab Emirates','Gb':'United Kingdom',
  'Us':'United States','Uy':'Uruguay','Uz':'Uzbekistan','Ve':'Venezuela',
  'Vn':'Vietnam','Ye':'Yemen','Zm':'Zambia','Zw':'Zimbabwe',
  'Usa':'United States','Uk':'United Kingdom','Uae':'United Arab Emirates',
  'Czechia':'Czech Republic','Russian Federation':'Russia',
  'Great Britain':'United Kingdom','Britain':'United Kingdom',
  'Korea':'South Korea',
};

function _normalizeCountry(raw) {
  if (!raw) return 'Unknown';
  const titled = raw.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return _NORM_COUNTRY[titled] || titled;
}

function addMmasMarker(a) {
  if (!a.latitude || !a.longitude) return;
  mmasTotal++;
  if (a.country && a.country !== 'Unknown') {
    const _ck = _normalizeCountry(a.country);
    mmasCountries.add(_ck);
    if (!mmasCountryData[_ck]) mmasCountryData[_ck]={ count:0, totalScore:0 };
    mmasCountryData[_ck].count++;
    mmasCountryData[_ck].totalScore += a.score;
  }
  updateMmasMapStats();

  const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
  if (!mmasMarkersMap[key]) mmasMarkersMap[key]={ count:0, scores:[], records:[], marker:null, popup:null, popupIdx:0, lat:parseFloat(a.latitude), lng:parseFloat(a.longitude) };
  const loc = mmasMarkersMap[key];
  loc.count++; loc.scores.push(a.score); loc.records.push(a);
  const avg = loc.scores.reduce((x,y)=>x+y,0)/loc.scores.length;
  const cat = getAdherenceCategory(avg);

  if (!mmasMapInstance) return;
  if (loc.marker) loc.marker.remove();
  const sz = Math.min(20+loc.count*2, 40);
  const el = document.createElement('div');
  el.style.cssText = 'width:0;height:0;position:relative;cursor:pointer;';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;top:${-sz/2}px;left:${-sz/2}px;border-radius:50%;background:${cat.color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;transition:transform 0.18s,box-shadow 0.18s;transform-origin:center center;`;
  if (loc.count > 1) dot.textContent = loc.count;
  el.appendChild(dot);

  // ── Trajectory glyph: shown when a patient_number has ≥2 scores in this cluster ──
  const patRecords = {};
  loc.records.forEach(r => { if (r.patient_number) { if (!patRecords[r.patient_number]) patRecords[r.patient_number]=[]; patRecords[r.patient_number].push(r); } });
  const multiPat = Object.values(patRecords).find(arr => arr.length >= 2);
  if (multiPat) {
    const sorted = [...multiPat].sort((a,b)=>a.timestamp-b.timestamp);
    const first = sorted[0].score, last = sorted[sorted.length-1].score;
    const delta = last - first;
    const glyph = document.createElement('div');
    const glyphColor = delta > 0.1 ? '#10b981' : delta < -0.1 ? '#ef4444' : '#6b8099';
    const glyphIcon  = delta > 0.1 ? '↑' : delta < -0.1 ? '↓' : '→';
    glyph.style.cssText = `position:absolute;top:${-sz/2-11}px;left:${-sz/2+2}px;font-size:9px;font-weight:700;color:${glyphColor};background:rgba(8,14,26,0.85);border:1px solid ${glyphColor}55;border-radius:4px;padding:0 3px;line-height:14px;font-family:monospace;pointer-events:none;`;
    glyph.textContent = glyphIcon + ' ' + Math.abs(delta).toFixed(1);
    el.appendChild(glyph);
  }

  loc.popup = new mapboxgl.Popup({ offset: sz/2+4, maxWidth:'310px', closeButton:true, closeOnClick:false })
    .setLngLat([loc.lng, loc.lat]);
  loc.popupIdx = 0;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    dot.style.transform = 'scale(1.4)';
    loc.popup.setHTML(buildMmasPopupHTML(loc.records, loc.popupIdx));
    loc.popup.addTo(mmasMapInstance);
    setTimeout(() => {
      const w = loc.popup.getElement() && loc.popup.getElement().querySelector('.mapboxgl-popup-content');
      if (w) w.dataset.mmasKey = key;
      dot.style.transform = '';
    }, 15);
  });
  loc.popup.on('close', () => { dot.style.transform = ''; });
  el.addEventListener('mouseenter', () => { dot.style.boxShadow = `0 4px 18px ${cat.color}99`; });
  el.addEventListener('mouseleave', () => { dot.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)'; });

  loc.marker = new mapboxgl.Marker({element:el, anchor:'center'}).setLngLat([loc.lng,loc.lat]).addTo(mmasMapInstance);
}

// ══════════════════════════════════════════════
// INITIATIVE 4: PREDICTIVE RISK BANDS HEATMAP
// ══════════════════════════════════════════════
let _heatmapActive = false;

function toggleMmasHeatmap() {
  if (!mmasMapInstance) return;
  const btn = document.getElementById('map-heatmap-btn');
  _heatmapActive = !_heatmapActive;

  if (_heatmapActive) {
    // Build GeoJSON from current marker data
    const features = Object.values(mmasMarkersMap)
      .filter(loc => loc.scores && loc.scores.length && loc.lat && loc.lng)
      .map(loc => {
        const avg = loc.scores.reduce((a,b)=>a+b,0)/loc.scores.length;
        // Invert: low MMAS = high risk intensity
        const riskIntensity = Math.max(0, (8 - avg) / 8);
        return { type:'Feature', geometry:{ type:'Point', coordinates:[loc.lng, loc.lat] }, properties:{ risk: riskIntensity, avg } };
      });

    const geojson = { type:'FeatureCollection', features };

    // Add or update source
    if (mmasMapInstance.getSource('mmas-risk-heat')) {
      mmasMapInstance.getSource('mmas-risk-heat').setData(geojson);
    } else {
      mmasMapInstance.addSource('mmas-risk-heat', { type:'geojson', data:geojson });
    }

    // Remove existing layer if present
    if (mmasMapInstance.getLayer('mmas-risk-heat-layer')) mmasMapInstance.removeLayer('mmas-risk-heat-layer');

    mmasMapInstance.addLayer({
      id: 'mmas-risk-heat-layer',
      type: 'heatmap',
      source: 'mmas-risk-heat',
      maxzoom: 9,
      paint: {
        // Weight by risk intensity
        'heatmap-weight': ['interpolate',['linear'],['get','risk'], 0,0, 1,1],
        // Intensity ramps up with zoom
        'heatmap-intensity': ['interpolate',['linear'],['zoom'], 0,1, 9,3],
        // Color: green (safe) → amber → red (high risk)
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,   'rgba(16,185,129,0)',
          0.2, 'rgba(16,185,129,0.45)',
          0.45,'rgba(212,168,67,0.65)',
          0.7, 'rgba(239,68,68,0.7)',
          1.0, 'rgba(185,28,28,0.85)'
        ],
        'heatmap-radius': ['interpolate',['linear'],['zoom'], 0,20, 9,40],
        'heatmap-opacity': 0.72
      }
    }, 'waterway-label'); // insert below labels

    btn.style.background = 'rgba(212,168,67,0.22)';
    btn.style.borderColor = 'rgba(212,168,67,0.6)';
    btn.style.color = '#d4a843';
    btn.textContent = '🌡 Hide Risks';
    showToast('🌡 Risk heat bands active — red = low adherence regions', 3500);
  } else {
    if (mmasMapInstance.getLayer('mmas-risk-heat-layer')) mmasMapInstance.removeLayer('mmas-risk-heat-layer');
    btn.style.background = 'rgba(212,168,67,0.08)';
    btn.style.borderColor = 'rgba(212,168,67,0.25)';
    btn.style.color = 'var(--pe)';
    btn.textContent = '🌡 Risk Bands';
    showToast('Risk bands hidden.', 1800);
  }
}

function updateMmasMapStats() {
  const tot = document.getElementById('map-total-count');
  const cnt = document.getElementById('map-countries-count');
  const avg = document.getElementById('map-avg-score');
  if (tot) tot.textContent = mmasTotal.toLocaleString();
  if (cnt) cnt.textContent = mmasCountries.size;
  if (avg && mmasTotal>0) {
    let ts=0,tc=0; Object.values(mmasCountryData).forEach(d=>{ts+=d.totalScore;tc+=d.count;});
    const mapAvg = tc > 0 ? ts / tc : NaN;
    avg.textContent = (tc > 0 && !isNaN(mapAvg)) ? mapAvg.toFixed(2) : '—';
  }
}

// ══════════════════════════════════════════════
// SPECTATOR MODE
// ══════════════════════════════════════════════
function _showSpectatorIntro() {
  if (window._spectatorIntroShown) return;
  window._spectatorIntroShown = true;
  const el = document.createElement('div');
  el.id = 'spectator-intro-card';
  el.style.cssText = [
    'position:fixed;bottom:48px;left:50%;transform:translateX(-50%)',
    'z-index:19999;pointer-events:none',
    'opacity:0;transition:opacity 0.9s ease',
    'max-width:620px;width:90%',
  ].join(';');
  el.innerHTML = `
    <div style="
      text-align:center;
      padding:22px 32px 20px;
      background:rgba(4,9,26,0.82);
      border:1px solid rgba(212,168,67,0.2);
      border-top:2px solid rgba(212,168,67,0.55);
      border-radius:12px;
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
    ">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.32em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:12px;">
        Adherence Cartography · ATLAS
      </div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.4rem,3vw,2.2rem);font-weight:300;color:#ffffff;line-height:1.3;letter-spacing:0.03em;">
        Every pin is a person.<br/>
        <em style="font-style:italic;color:rgba(212,168,67,0.9);">Every person chose to be counted.</em>
      </div>
    </div>`;
  document.getElementById('spectator-overlay').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { try { el.remove(); } catch(e) {} }, 950);
  }, 4200);
}

function enterSpectatorMode() {
  spectatorActive = true;
  document.getElementById('spectator-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  // Hide site banner — cinematic mode should be immersive with no overlapping elements
  const _wb = document.getElementById('whd-banner');
  if (_wb) { _wb.dataset.spectatorHidden = _wb.style.display || ''; _wb.style.display = 'none'; }
  // Show cinematic intro tagline on first entry
  setTimeout(_showSpectatorIntro, 600);

  // On mobile, collapse all panels immediately so the globe is always visible.
  // The user can expand a panel by tapping its '+' button.
  if (window.innerWidth <= 768) {
    document.querySelectorAll('.cine-collapse-btn').forEach(btn => {
      const body = document.getElementById(btn.getAttribute('data-target'));
      if (!body) return;
      body.style.maxHeight = '0px';
      body.style.overflow  = 'hidden';
      btn.textContent = '+';
    });
  }


  // Pause dashboard mini-map rotation intervals — they keep running behind the overlay
  if (window._miniMmasRotInt)  { clearInterval(window._miniMmasRotInt);  window._miniMmasRotInt  = null; }
  if (window._miniPeacsRotInt) { clearInterval(window._miniPeacsRotInt); window._miniPeacsRotInt = null; }

  if (!spectatorMapInited) {
    spectatorMapInited = true;
    ensureMapbox().then(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
    spectatorMap = new mapboxgl.Map({
      container:'spectator-map',
      style:'mapbox://styles/mapbox/satellite-streets-v12',
      center:[0,20], zoom:2, projection:'globe',
      fadeDuration: 0,           // skip tile fade-in animation — pure GPU saving
      renderWorldCopies: false,  // don't render globe copies at low zoom
      maxTileCacheSize: 20,      // cap tile cache — reduces memory pressure on long sessions
      collectResourceTiming: false
    });
    spectatorMap.on('load', () => {
      const fog = window._mapboxFog || {
        color: '#04091c', 'high-color': '#0d1a3a',
        'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
      };
      spectatorMap.setFog(fog);
      spectatorMap.setProjection('globe');
      _initSpectatorLayers();
      _initPartnerLayers();
      // Guard: wait for Firebase auth before reading data so stats don't show 0
      const _doLoad = () => { loadSpectatorData(); _loadPartnerSites(); };
      const _u = firebase.auth().currentUser;
      if (_u) { _doLoad(); }
      else {
        const _unsub = firebase.auth().onAuthStateChanged(u => { if (u) { _unsub(); _doLoad(); } });
        setTimeout(_doLoad, 5000); // hard fallback
      }
    });
    }); // end ensureMapbox
  } else {
    updateCinematicStats();
    updateCinematicLeaderboard();
    // Restart cinematic tour — tourActive was cleared on last exit
    startCinematicTour();
    // Re-seed and restart the ticker (rAF was cancelled on exit)
    renderTicker();
  }
}

function exitSpectatorMode() {
  spectatorActive = false;
  tourActive = false;
  if (tourTimeout) { clearTimeout(tourTimeout); tourTimeout = null; }
  document.getElementById('spectator-overlay').classList.remove('active');
  document.body.style.overflow = '';
  // Restore site banner if it was visible before entering spectator mode
  const _wb = document.getElementById('whd-banner');
  if (_wb && _wb.dataset.spectatorHidden !== undefined) {
    if (_wb.dataset.spectatorHidden && _wb.dataset.spectatorHidden !== 'none') _wb.style.display = _wb.dataset.spectatorHidden;
    delete _wb.dataset.spectatorHidden;
  }
  // Re-seed ticker position so it starts cleanly on next open
  if (tickerAnimId) { cancelAnimationFrame(tickerAnimId); tickerAnimId = null; }
  if (_partnerRefreshId) { clearInterval(_partnerRefreshId); _partnerRefreshId = null; }
  // Resume dashboard mini-map rotations that were paused on enter
  if (typeof dashMiniMmas !== 'undefined' && dashMiniMmas) {
    if (!window._miniMmasRotInt) window._miniMmasRotInt = setInterval(() => {
      const c = dashMiniMmas.getCenter(); c.lng = (c.lng + 0.15) % 360; dashMiniMmas.setCenter(c);
    }, 80);
  }
  if (typeof dashMiniPeacs !== 'undefined' && dashMiniPeacs) {
    if (!window._miniPeacsRotInt) window._miniPeacsRotInt = setInterval(() => {
      const c = dashMiniPeacs.getCenter(); c.lng = (c.lng + 0.18) % 360; dashMiniPeacs.setCenter(c);
    }, 80);
  }
}

// ── Milestone flash overlay ──
// Fires at key submission thresholds during live broadcast.
// Subtle full-screen pulse — does not interrupt the map.
const _MILESTONES = [100, 250, 500, 1000, 2500, 5000];
let _lastMilestoneFired = 0;
function checkMilestone(total) {
  for (let i = _MILESTONES.length - 1; i >= 0; i--) {
    const m = _MILESTONES[i];
    if (total >= m && _lastMilestoneFired < m) {
      _lastMilestoneFired = m;
      _showMilestoneFlash(m, total);
      break;
    }
  }
}
function _showMilestoneFlash(milestone, total) {
  const existing = document.getElementById('milestone-flash');
  if (existing) existing.remove();
  const countryCount = Object.keys(mmasCountryData).filter(c => c && c !== 'Unknown').length;
  const flash = document.createElement('div');
  flash.id = 'milestone-flash';
  flash.style.cssText = [
    'position:fixed','inset:0','z-index:99990',
    'display:flex','flex-direction:column','align-items:center','justify-content:center',
    'pointer-events:none',
    'background:radial-gradient(ellipse at 50% 40%,rgba(212,168,67,0.08) 0%,rgba(0,0,0,0.0) 65%)',
    'animation:milestoneIn 0.7s cubic-bezier(0.22,1,0.36,1) both'
  ].join(';');
  flash.innerHTML = `
    <div style="text-align:center;padding:48px 60px;
      background:rgba(2,6,18,0.94);
      border:1px solid rgba(212,168,67,0.22);
      border-top:3px solid rgba(212,168,67,0.6);
      max-width:520px;width:90%;
      backdrop-filter:blur(24px);
      box-shadow:0 0 80px rgba(0,0,0,0.8),inset 0 1px 0 rgba(212,168,67,0.1);">
      <!-- Rule lines — engraved -->
      <div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:24px;">
        <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,0.3));"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.32em;text-transform:uppercase;color:rgba(212,168,67,0.5);">ADHERENCE CARTOGRAPHY · THE WALL</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(212,168,67,0.3),transparent);"></div>
      </div>
      <!-- The number — carved large -->
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:5.5rem;font-weight:300;color:#fff;line-height:0.9;letter-spacing:-0.02em;margin-bottom:6px;text-shadow:0 0 60px rgba(212,168,67,0.2);">${milestone.toLocaleString()}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.28em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:28px;">Assessments Recorded</div>
      <!-- Secondary stat -->
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:rgba(255,255,255,0.5);margin-bottom:4px;">${countryCount} <span style="font-size:1rem;">countries</span></div>
      <!-- Bottom rule -->
      <div style="margin-top:28px;display:flex;align-items:center;gap:12px;justify-content:center;">
        <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06));"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.22em;color:rgba(255,255,255,0.2);text-transform:uppercase;">Not a dose. A duration.</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.06),transparent);"></div>
      </div>
    </div>`;
  if (!document.getElementById('milestone-keyframe')) {
    const style = document.createElement('style');
    style.id = 'milestone-keyframe';
    style.textContent = '@keyframes milestoneIn{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.style.transition = 'opacity 1.5s ease';
    flash.style.opacity = '0';
    setTimeout(() => { try { flash.remove(); } catch(e) {} }, 1600);
  }, 7000);
}

// Day / Night toggle for spectator map
// Day  → satellite-streets (bright satellite with labels)
// Night → navigation-night (dark vector — better contrast for adherence dots at night)
let _spectatorIsDay = true;
function toggleSpectatorDayNight() {
  if (!spectatorMap) return;
  _spectatorIsDay = !_spectatorIsDay;
  const style = _spectatorIsDay
    ? 'mapbox://styles/mapbox/satellite-streets-v12'
    : 'mapbox://styles/mapbox/navigation-night-v1';
  spectatorMap.setStyle(style);
  // Re-apply fog after style swap (Mapbox clears it on style change)
  spectatorMap.once('style.load', () => {
    const fog = window._mapboxFog || {
      color: '#04091c', 'high-color': '#0d1a3a',
      'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
    };
    try { spectatorMap.setFog(fog); } catch(e) {}
    _initSpectatorLayers();
    _updateSpectatorSource();
    _initPartnerLayers();
    _updatePartnerSource();
  });
  const btn = document.getElementById('cine-daynight-btn');
  if (btn) btn.textContent = _spectatorIsDay ? '🌙 Night' : '☀️ Day';
}

// ══════════════════════════════════════════════
// PEACS SPECTATOR MODE
// ══════════════════════════════════════════════
let peacsSpectatorMap = null, peacsSpectatorInited = false, peacsSpectatorActive = false;

function enterPeacsSpectatorMode() {
  peacsSpectatorActive = true;
  const overlay = document.getElementById('peacs-spectator-overlay');
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';

  if (!peacsSpectatorInited) {
    peacsSpectatorInited = true;
    ensureMapbox().then(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
    peacsSpectatorMap = new mapboxgl.Map({
      container: 'peacs-spectator-map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 20], zoom: 2
    });
    peacsSpectatorMap.on('load', () => {
      const fog = window._mapboxFog || {
        color: '#04091c', 'high-color': '#0d1a3a',
        'horizon-blend': 0.06, 'space-color': '#010408', 'star-intensity': 0.4
      };
      peacsSpectatorMap.setFog(fog);
      peacsSpectatorMap.setProjection('globe');
      loadPeacsSpectatorData();
    });
    }); // end ensureMapbox
  } else {
    updatePeacsSpectatorStats();
  }
}

function exitPeacsSpectatorMode() {
  peacsSpectatorActive = false;
  document.getElementById('peacs-spectator-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

const peZoneColors = { Optimal:'#10b981', Good:'#3b82f6', Moderate:'#f59e0b', Poor:'#ef4444', Critical:'#991b1b' };
const getZone = pe => pe>=0.85?'Optimal':pe>=0.70?'Good':pe>=0.55?'Moderate':pe>=0.40?'Poor':'Critical';
let peacsSpectatorClusters = {}; // locationKey → { records:[], lat, lng, city, country, marker, popup }

function loadPeacsSpectatorData() {
  database.ref('peacs_assessments').once('value', snap => {
    const data = snap.val();
    if (data) {
      Object.values(data).forEach(a => ingestPeacsSpectatorRecord(a));
      Object.entries(peacsSpectatorClusters).forEach(([k,cl]) => renderPeacsSpectatorCluster(k,cl));
    }
    updatePeacsSpectatorStats();
    listenPeacsSpectatorLive(peZoneColors, getZone);
  });
}

function ingestPeacsSpectatorRecord(a) {
  if (!a.latitude || !a.longitude) return;
  const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
  if (!peacsSpectatorClusters[key]) peacsSpectatorClusters[key] = {
    records:[], lat:parseFloat(a.latitude), lng:parseFloat(a.longitude),
    city:a.city||'Unknown', country:a.country||'Unknown', marker:null, popup:null
  };
  peacsSpectatorClusters[key].records.push(a);
}

function renderPeacsSpectatorCluster(key, cl) {
  if (!peacsSpectatorMap) return;
  if (cl.marker) cl.marker.remove();
  if (cl.popup)  cl.popup.remove();

  const records = cl.records;
  const count   = records.length;
  const avgPE   = records.reduce((s,r)=>s+(r.pe||0),0) / count;
  const avgBase = records.reduce((s,r)=>s+(r.base||0),0) / count;
  const avgMvmt = records.reduce((s,r)=>s+(r.mvmt||0),0) / count;
  const avgStrata = records.reduce((s,r)=>s+(r.strata||0),0) / count;
  const zone    = getZone(avgPE);
  const col     = peZoneColors[zone];
  const sz      = Math.min(10 + count * 2, 34);
  const half    = sz / 2;

  // Zone breakdown
  const byZone = {Optimal:0,Good:0,Moderate:0,Poor:0,Critical:0};
  records.forEach(r => byZone[getZone(r.pe||0)]++);

  const el  = document.createElement('div');
  el.style.cssText = 'width:0;height:0;position:relative;cursor:crosshair;';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;top:${-half}px;left:${-half}px;border-radius:50%;background:${col};box-shadow:0 0 ${Math.round(sz*0.8)}px ${col};border:1.5px solid rgba(255,255,255,0.45);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9);font-weight:700;font-size:${sz>16?'9px':'0'};transition:transform 0.15s,box-shadow 0.15s;transform-origin:center;`;
  if (count > 1) dot.textContent = count;
  el.appendChild(dot);

  const popupHTML = `
    <div style="padding:14px 16px;font-family:'IBM Plex Sans',sans-serif;background:rgba(8,14,26,0.96);border-radius:12px;min-width:230px;backdrop-filter:blur(10px);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#4a5f78;margin-bottom:6px;">PEACS · ${count} assessment${count>1?'s':''}</div>
      <div style="font-size:14px;font-weight:600;color:#e8f0f8;margin-bottom:3px;">${cl.city}, ${cl.country}</div>
      <div style="font-size:22px;font-weight:300;color:${col};font-family:'Cormorant Garamond',Georgia,serif;line-height:1;margin-bottom:4px;">PE ${avgPE.toFixed(4)}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.1em;color:${col};margin-bottom:12px;text-transform:uppercase;">${zone}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(78,156,245,0.3);color:#4e9cf5;">B ${avgBase.toFixed(3)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(139,111,245,0.3);color:#8b6ff5;">M ${avgMvmt.toFixed(3)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid rgba(46,201,138,0.3);color:#2ec98a;">S ${avgStrata.toFixed(3)}</span>
      </div>
      ${count>1 ? `<div style="display:flex;gap:3px;margin-top:8px;">
        ${byZone.Optimal?`<div style="flex:${byZone.Optimal};background:#10b981;height:3px;border-radius:2px;"></div>`:''}
        ${byZone.Good?`<div style="flex:${byZone.Good};background:#3b82f6;height:3px;border-radius:2px;"></div>`:''}
        ${byZone.Moderate?`<div style="flex:${byZone.Moderate};background:#f59e0b;height:3px;border-radius:2px;"></div>`:''}
        ${byZone.Poor?`<div style="flex:${byZone.Poor};background:#ef4444;height:3px;border-radius:2px;"></div>`:''}
        ${byZone.Critical?`<div style="flex:${byZone.Critical};background:#991b1b;height:3px;border-radius:2px;"></div>`:''}
      </div>` : ''}
    </div>`;

  const popup = new mapboxgl.Popup({
    offset: half + 6, maxWidth:'290px', closeButton:false, closeOnClick:false,
    className:'spectator-popup'
  }).setLngLat([cl.lng, cl.lat]).setHTML(popupHTML);
  cl.popup = popup;

  el.addEventListener('mouseenter', () => {
    dot.style.transform = 'scale(1.4)';
    dot.style.boxShadow = `0 0 ${Math.round(sz)}px ${col},0 0 ${Math.round(sz*1.5)}px ${col}44`;
    popup.addTo(peacsSpectatorMap);
  });
  el.addEventListener('mouseleave', () => {
    dot.style.transform = '';
    dot.style.boxShadow = `0 0 ${Math.round(sz*0.8)}px ${col}`;
    popup.remove();
  });

  cl.marker = new mapboxgl.Marker({element:el, anchor:'center'}).setLngLat([cl.lng,cl.lat]).addTo(peacsSpectatorMap);
}

function addPeacsSpectatorMarker(a, peZoneColorsArg, getZoneArg) {
  // Legacy call signature compatibility — just ingest and re-render
  ingestPeacsSpectatorRecord(a);
  if (a.latitude && a.longitude) {
    const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown') ? (a.city+'||'+a.country).toLowerCase() : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
    if (peacsSpectatorClusters[key]) renderPeacsSpectatorCluster(key, peacsSpectatorClusters[key]);
  }
}

function listenPeacsSpectatorLive(peZoneColors, getZone) {
  if (window._peacsSpectatorListening) return;
  window._peacsSpectatorListening = true;
  const since = Date.now();
  database.ref('peacs_assessments').on('child_added', snap => {
    const a = snap.val();
    if (a.timestamp > since) {
      addPeacsSpectatorMarker(a, peZoneColors, getZone);
      updatePeacsSpectatorStats();
      addToPeacsFeed(a, peZoneColors, getZone);
      if (a.latitude && a.longitude && peacsSpectatorMap) {
        const z = getZone(a.pe||0);
        peacsSpectatorMap.flyTo({ center:[a.longitude,a.latitude], zoom:5, duration:2500 });
        const notify = document.getElementById('ps-notify');
        const loc    = document.getElementById('ps-loc');
        if (notify && loc) {
          notify.style.color = peZoneColors[z];
          loc.textContent = `${a.city||'Unknown'}, ${a.country||'Unknown'} — PE ${(a.pe||0).toFixed(4)} · ${z}`;
          notify.style.display = 'block';
          setTimeout(()=>{ notify.style.display='none'; }, 5000);
        }
      }
    }
  });
}

function addToPeacsFeed(a, peZoneColors, getZone) {
  const feed = document.getElementById('ps-feed');
  if (!feed) return;
  const z   = getZone(a.pe||0);
  const col = peZoneColors[z];
  const div = document.createElement('div');
  div.style.cssText = 'padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);animation:fadeUp 0.4s ease both;';
  // Build sub-elements with textContent for user-sourced strings to prevent XSS
  const line1 = document.createElement('div');
  line1.style.cssText = `font-family:var(--font-mono);font-size:0.88rem;color:${col};margin-bottom:3px;`;
  line1.textContent = `PE ${(a.pe||0).toFixed(4)} · ${z}`;
  const line2 = document.createElement('div');
  line2.style.cssText = 'font-size:0.90rem;color:rgba(255,255,255,0.7);';
  line2.textContent = `${a.city||'Unknown'}, ${a.country||'Unknown'}`;
  const line3 = document.createElement('div');
  line3.style.cssText = 'font-family:var(--font-mono);font-size:0.84rem;color:rgba(255,255,255,0.3);';
  line3.textContent = `B ${(a.base||0).toFixed(3)} · M ${(a.mvmt||0).toFixed(3)} · S ${(a.strata||0).toFixed(3)}`;
  div.appendChild(line1); div.appendChild(line2); div.appendChild(line3);
  const placeholder = feed.querySelector('[data-placeholder]');
  if (placeholder) placeholder.remove();
  feed.insertBefore(div, feed.firstChild);
  if (feed.children.length > 20) feed.removeChild(feed.lastChild);
}

function updatePeacsSpectatorStats() {
  if (window._peacsStatsDebounce) clearTimeout(window._peacsStatsDebounce);
  window._peacsStatsDebounce = setTimeout(_doPeacsSpectatorStats, 1500);
}
function _doPeacsSpectatorStats() {
  window._peacsStatsDebounce = null;
  database.ref('peacs_assessments').once('value', snap => {
    const data = snap.val();
    if (!data) return;
    const vals = Object.values(data);
    const total = vals.length;
    const countries = new Set(vals.map(a=>a.country).filter(c=>c&&c!=='Unknown')).size;
    const avgPE = total > 0 ? (vals.reduce((s,a)=>s+(a.pe||0),0)/total).toFixed(3) : '—';
    const optimal = total > 0 ? Math.round(vals.filter(a=>(a.pe||0)>=0.85).length/total*100)+'%' : '—';
    const t=document.getElementById('ps-total'); if(t)t.textContent=total.toLocaleString();
    const c=document.getElementById('ps-countries'); if(c)c.textContent=countries;
    const p=document.getElementById('ps-avg-pe'); if(p)p.textContent=avgPE;
    const o=document.getElementById('ps-optimal'); if(o)o.textContent=optimal;
  });
}

let spectatorClusters  = {}; // locationKey → { scores:[], lat, lng, city, country }
let spectatorListening = false;
let _spectatorPopup    = null;

// ── GeoJSON WebGL layer system ────────────────────────────────────────────
// One GeoJSON source + two circle layers replaces individual DOM Markers.
// Mapbox renders 5,000 WebGL circles as cheaply as 50. Zero DOM overhead.
// DOM markers (mapboxgl.Marker) require layout+composite per frame each —
// at 200+ locations this is the primary cause of cinematic map choppiness.

function _buildSpectatorGeoJSON() {
  const features = Object.values(spectatorClusters).map(cl => {
    const count = cl.scores.length;
    const avg   = cl.scores.reduce((s,v) => s+v, 0) / count;
    const cat   = getAdherenceCategory(avg);
    const sz    = Math.min(6 + count * 1.4, 22);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cl.lng, cl.lat] },
      properties: {
        color: cat.color, count, avg: avg.toFixed(2),
        city: cl.city, country: cl.country, label: cat.label, radius: sz,
        mapCount: cl.mapCount||0, mmasCount: cl.mmasCount||0
      }
    };
  });
  return { type: 'FeatureCollection', features };
}

function _initSpectatorLayers() {
  if (!spectatorMap || spectatorMap.getSource('sp-clusters')) return;
  spectatorMap.addSource('sp-clusters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  spectatorMap.addLayer({
    id: 'sp-glow', type: 'circle', source: 'sp-clusters',
    paint: {
      'circle-radius':  ['interpolate',['linear'],['get','radius'],6,10,22,32],
      'circle-color':   ['get','color'],
      'circle-opacity': 0.18,
      'circle-blur':    0.8
    }
  });
  spectatorMap.addLayer({
    id: 'sp-dots', type: 'circle', source: 'sp-clusters',
    paint: {
      'circle-radius':       ['get','radius'],
      'circle-color':        ['get','color'],
      'circle-opacity':      0.92,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.45)'
    }
  });
  spectatorMap.on('click', 'sp-dots', e => {
    const p      = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    if (_spectatorPopup) _spectatorPopup.remove();
    _spectatorPopup = new mapboxgl.Popup({
      offset:12, maxWidth:'260px', closeButton:true, closeOnClick:false,
      className:'spectator-popup'
    })
    .setLngLat(coords)
    .setHTML((() => {
      const mc = parseInt(p.mapCount)||0, ms = parseInt(p.mmasCount)||0;
      const toolLine = mc>0 && ms>0
        ? `MAP ${mc} · MMAS-8 ${ms}`
        : mc>0 ? `MAP · ${p.count} submission${p.count>1?'s':''}`
        : `MMAS-8 · ${p.count} submission${p.count>1?'s':''}`;
      return `<div style="padding:12px 14px;font-family:'IBM Plex Sans',sans-serif;background:rgba(8,14,26,0.97);border-radius:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#4a5f78;margin-bottom:5px;">${toolLine}</div>
        <div style="font-size:13px;font-weight:600;color:#e8f0f8;margin-bottom:2px;">${p.city}, ${p.country}</div>
        <div style="font-size:20px;font-weight:300;color:${p.color};font-family:'Cormorant Garamond',Georgia,serif;line-height:1;margin-bottom:8px;">${p.avg} <span style="font-size:12px;color:#6b8099;">/ 8</span></div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.1em;color:${p.color};text-transform:uppercase;">${p.label}</div>
      </div>`;
    })())
    .addTo(spectatorMap);
  });
  spectatorMap.on('mouseenter','sp-dots',() => { spectatorMap.getCanvas().style.cursor='crosshair'; });
  spectatorMap.on('mouseleave','sp-dots',() => { spectatorMap.getCanvas().style.cursor=''; });
}

function _updateSpectatorSource() {
  if (!spectatorMap || !spectatorMap.getSource('sp-clusters')) return;
  spectatorMap.getSource('sp-clusters').setData(_buildSpectatorGeoJSON());
}

// ── Partner site layer ────────────────────────────────────────────────────
// Reads /workspaces from Firebase, filters partner:true, renders as gold
// institutional markers distinct from patient submission dots.
// Re-reads every 60s to pick up new partner activations during the event.

let _partnerSites     = []; // cached partner records
let _partnerRefreshId = null;

function _initPartnerLayers() {
  if (!spectatorMap || spectatorMap.getSource('sp-partners')) return;

  spectatorMap.addSource('sp-partners', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Outer pulse ring
  spectatorMap.addLayer({
    id: 'sp-partner-pulse', type: 'circle', source: 'sp-partners',
    paint: {
      'circle-radius':  14,
      'circle-color':   '#d4a843',
      'circle-opacity': 0.15,
      'circle-blur':    0.6
    }
  });

  // Gold filled dot
  spectatorMap.addLayer({
    id: 'sp-partner-dot', type: 'circle', source: 'sp-partners',
    paint: {
      'circle-radius':       8,
      'circle-color':        '#d4a843',
      'circle-opacity':      1,
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.9)'
    }
  });

  // Click popup
  spectatorMap.on('click', 'sp-partner-dot', e => {
    const p      = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    // Get live submission count for this partner from mmasCountryData
    const countryData = mmasCountryData[p.country] || {};
    const subCount    = p.workspace
      ? Object.values(window._partnerSubCounts || {}).find(x => x.ws === p.workspace)?.count || 0
      : 0;
    if (_spectatorPopup) _spectatorPopup.remove();
    _spectatorPopup = new mapboxgl.Popup({
      offset: 14, maxWidth: '280px', closeButton: true, closeOnClick: false,
      className: 'spectator-popup'
    })
    .setLngLat(coords)
    .setHTML(`<div style="padding:14px 16px;font-family:'IBM Plex Sans',sans-serif;background:rgba(8,14,26,0.97);border-radius:10px;min-width:220px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#d4a843;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
        <span style="width:5px;height:5px;border-radius:50%;background:#d4a843;display:inline-block;"></span>
        Active Research Site
      </div>
      <div style="font-size:14px;font-weight:600;color:#e8f0f8;margin-bottom:2px;">${p.name}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6b8099;margin-bottom:12px;">${p.city}, ${p.country}</div>
      <div style="display:flex;gap:12px;">
        <div style="text-align:center;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300;color:#d4a843;line-height:1;">${p.submissions > 0 ? p.submissions : '—'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5f78;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px;">Submissions</div>
        </div>
        ${p.avg > 0 ? `<div style="text-align:center;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300;color:#4e9cf5;line-height:1;">${p.avg}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5f78;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px;">Avg MMAS</div>
        </div>` : ''}
      </div>
    </div>`)
    .addTo(spectatorMap);
  });
  spectatorMap.on('mouseenter', 'sp-partner-dot', () => { spectatorMap.getCanvas().style.cursor = 'pointer'; });
  spectatorMap.on('mouseleave', 'sp-partner-dot', () => { spectatorMap.getCanvas().style.cursor = ''; });
}

function _buildPartnerGeoJSON() {
  const features = _partnerSites.map(p => {
    // Count submissions for this workspace from assessments data
    let submissions = 0, totalScore = 0;
    // Match by institution_code in assessments — workspace key is the code
    if (p.workspace && window._partnerSubCounts && window._partnerSubCounts[p.workspace]) {
      submissions = window._partnerSubCounts[p.workspace].count;
      totalScore  = window._partnerSubCounts[p.workspace].total;
    }
    const avg = submissions > 0 ? (totalScore / submissions).toFixed(2) : 0;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      properties: {
        name: p.name, city: p.city, country: p.country,
        workspace: p.workspace, submissions, avg,
        color: p.color || '#d4a843'
      }
    };
  });
  return { type: 'FeatureCollection', features };
}

function _updatePartnerSource() {
  if (!spectatorMap || !spectatorMap.getSource('sp-partners')) return;
  spectatorMap.getSource('sp-partners').setData(_buildPartnerGeoJSON());
}

function _loadPartnerSites() {
  database.ref('partner_sites').once('value', snap => {
    if (!snap.exists()) return;
    const sites = [];
    snap.forEach(child => {
      const d = child.val();
      if (d && d.partner === true && d.latitude && d.longitude) {
        sites.push({
          workspace: child.key,
          name:      d.name      || child.key,
          city:      d.city      || '',
          country:   d.country   || '',
          latitude:  d.latitude,
          longitude: d.longitude,
          color:     d.color     || '#d4a843',
          active:    d.active    !== false
        });
      }
    });
    _partnerSites = sites;

    // Count submissions per workspace from assessments
    _countPartnerSubmissions();
  });
}

function _countPartnerSubmissions() {
  if (!_partnerSites.length) return;
  const counts = {};
  database.ref('assessments').once('value', snap => {
    if (snap.exists()) {
      snap.forEach(child => {
        const d = child.val();
        if (d && d.institution_code) {
          const key = d.institution_code.toUpperCase();
          if (!counts[key]) counts[key] = { count: 0, total: 0 };
          counts[key].count++;
          counts[key].total += (d.score || 0);
        }
      });
    }
    window._partnerSubCounts = counts;
    _updatePartnerSource();
  });
  // Refresh counts every 60s while spectator is open
  if (_partnerRefreshId) clearInterval(_partnerRefreshId);
  _partnerRefreshId = setInterval(() => {
    if (spectatorActive) _countPartnerSubmissions();
  }, 60000);
}

function loadSpectatorData() {
  // Reset counters before seeding — if MMAS map tab was visited first, mmasTotal
  // already has values from mapData. Without a reset, loading from assessments here
  // would double-count every record.
  mmasTotal = 0; mmasCountries = new Set(); mmasCountryData = {};

  // Load counts from assessments (source of truth = same node dashboard uses),
  // then load mapData for geo pins. Nested so allVals is in scope for pin rendering.
  database.ref('assessments').once('value', aSnap => {
    const aData = aSnap.val();
    const allAssessments = aData ? Object.values(aData) : [];

    // Seed country-level stats and total count from assessments
    allAssessments.forEach(a => {
      if (a.score === undefined || a.score === null) return;
      mmasTotal++;
      if (a.country && a.country !== 'Unknown') {
        const _ck = _normalizeCountry(a.country);
        mmasCountries.add(_ck);
        if (!mmasCountryData[_ck]) mmasCountryData[_ck] = { count:0, totalScore:0 };
        mmasCountryData[_ck].count++;
        mmasCountryData[_ck].totalScore += (a.score || 0);
      }
    });

    // Now load mapData for geo pins and ticker (has lat/lng/city)
    database.ref('mapData').once('value', snap => {
      const data = snap.val();
      const allVals = data ? Object.values(data) : [];

      // If mapData is empty, fall back to assessments for geo pins
      // (assessments always has coords from the geolocation step)
      const pinSource = allVals.length > 0 ? allVals : allAssessments;

      // Build geo pins (coords required for map markers)
      pinSource.forEach(a => { if(a.latitude&&a.longitude) addSpectatorMarker(a); });
      setTimeout(_updateSpectatorSource, 2000);
      updateCinematicStats();
      updateCinematicLeaderboard();

      // Seed ticker
      pinSource.forEach(a => {
        const score = parseFloat(a.score);
        if (isNaN(score)) return;
        const cat = getAdherenceCategory(score);
        const city = a.city && a.city !== 'Unknown' ? a.city : null;
        const country = a.country && a.country !== 'Unknown' ? a.country : null;
        if (city || country) {
          tickerItems.push(`${city||country}, ${country||''} — ${score.toFixed(2)} (${cat.label})`);
        }
      });

      // Seed rate counter timestamps from historical data (last 2 hours)
      const twoHrAgo = Date.now() - 7200000;
      window._subTimestamps = window._subTimestamps || [];
      pinSource.forEach(a => {
        if (a.timestamp && a.timestamp > twoHrAgo) {
          window._subTimestamps.push(a.timestamp);
        }
      });
      window._subTimestamps = [...new Set(window._subTimestamps)].sort((a,b) => a-b);
      tickerItems = tickerItems.slice(-40).reverse();
      renderTicker();
      listenSpectatorLive();
      startCinematicTour();
    }); // end mapData.once
  }); // end assessments.once
}

function listenSpectatorLive() {
  if (spectatorListening) return; // prevent duplicate listeners on re-entry
  spectatorListening = true;
  const since = Date.now();

  // Listen on assessments for counts — this is the source of truth matching the dashboard.
  // mapData may be missing entries whose coords were null/invalid, causing count mismatch.
  database.ref('assessments').on('child_added', snap => {
    const a = snap.val();
    if (!a || a.timestamp <= since) return;
    if (a.score === undefined || a.score === null) return;
    mmasTotal++;
    if (a.country && a.country !== 'Unknown') {
      const _ck = _normalizeCountry(a.country);
      mmasCountries.add(_ck);
      if (!mmasCountryData[_ck]) mmasCountryData[_ck] = { count:0, totalScore:0 };
      mmasCountryData[_ck].count++;
      mmasCountryData[_ck].totalScore += (a.score || 0);
    }
    updateCinematicStats();
    updateCinematicLeaderboard();
    checkMilestone(mmasTotal);
  });
  database.ref('mapData').on('child_added', snap => {
    const a = snap.val();
    if (a.timestamp > since) {
      if (a.score === undefined || a.score === null) return;
      addSpectatorMarker(a);
      _updateSpectatorSource();
      addToLiveFeed(a);
      addToTicker(a);
      if (a.latitude && a.longitude && spectatorMap) {
        const cat = getAdherenceCategory(a.score);
        // Debounce flyTo — cancel any pending fly and queue this location.
        // Fires 2.5s after the last submission in a burst, preventing competing animations.
        if (window._spectatorFlyTimer) clearTimeout(window._spectatorFlyTimer);
        window._spectatorFlyPending = { lng: a.longitude, lat: a.latitude, cat,
          city: a.city||'Unknown', country: a.country||'Unknown' };
        window._spectatorFlyTimer = setTimeout(() => {
          const p = window._spectatorFlyPending;
          if (!p || !spectatorMap || !spectatorActive) return;
          spectatorMap.flyTo({ center:[p.lng, p.lat], zoom:5, duration:2200 });
          const notify = document.getElementById('cine-notify');
          const loc    = document.getElementById('cine-loc');
          if (notify && loc) {
            loc.textContent = p.city + ', ' + p.country + ' — ' + p.cat.label;
            notify.style.borderColor = p.cat.color;
            notify.classList.add('active');
            setTimeout(() => {
              notify.classList.remove('active');
            }, 5000);
          }
          window._spectatorFlyPending = null;
        }, 2500);
      }
    }
  });

  // Listen for AP2026 check-ins — seed recent ones then stream new ones
  const checkinSince = Date.now() - 86400000; // seed last 24h
  database.ref('wad_checkins').orderByChild('timestamp').startAt(checkinSince)
    .once('value', snap => {
      if (!snap.exists()) return;
      const items = [];
      snap.forEach(child => { items.push(child.val()); });
      // Show most recent 8 to seed the feed
      items.sort((a,b) => (b.timestamp||0) - (a.timestamp||0)).slice(0,8).reverse()
        .forEach(c => addToCheckinFeed(c, false));
    });
  database.ref('wad_checkins').orderByChild('timestamp').startAt(since)
    .on('child_added', snap => {
      const c = snap.val();
      if (c && c.timestamp > since) addToCheckinFeed(c, true);
    });
}

function addToCheckinFeed(c, animate) {
  const feed = document.getElementById('cine-checkin-feed');
  if (!feed) return;
  const ph = feed.querySelector('[data-placeholder]');
  if (ph) ph.remove();
  const item = document.createElement('div');
  item.style.cssText = `display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);${animate ? 'animation:fadeUp 0.4s ease both;' : ''}`;
  item.innerHTML = `
    <span style="font-size:1rem;flex-shrink:0;line-height:1.4;">${c.flag||'🌐'}</span>
    <div style="flex:1;min-width:0;">
      <div style="font-size:0.88rem;color:rgba(255,255,255,0.85);line-height:1.4;">${c.msg||''}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;color:rgba(255,255,255,0.35);margin-top:2px;">${c.country||'Unknown'}</div>
    </div>`;
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > 20) feed.removeChild(feed.lastChild);
}

function addSpectatorMarker(a) {
  if (!spectatorMap || !a.latitude || !a.longitude) return;
  const key = (a.city&&a.city!=='Unknown'&&a.country&&a.country!=='Unknown')
    ? (a.city+'||'+a.country).toLowerCase()
    : parseFloat(a.latitude).toFixed(2)+','+parseFloat(a.longitude).toFixed(2);
  if (!spectatorClusters[key]) spectatorClusters[key] = {
    scores:[], mapCount:0, mmasCount:0,
    lat:parseFloat(a.latitude), lng:parseFloat(a.longitude),
    city:a.city||'Unknown', country:a.country||'Unknown'
  };
  spectatorClusters[key].scores.push(a.score||0);
  if (a.tool === 'map' || a.map_q1 !== undefined) spectatorClusters[key].mapCount++;
  else spectatorClusters[key].mmasCount++;
}

function renderSpectatorCluster(key, cl) {
  // No-op — all rendering handled by _updateSpectatorSource() as a single GeoJSON upload
}

function startCinematicTour() {
  // Auto-tour disabled — globe only moves when a new assessment is submitted live.
  // The listenSpectatorLive() handler flies to each new submission as it arrives.
}

function updateCinematicStats() {
  const te = document.getElementById('cine-total');
  const ce = document.getElementById('cine-countries');
  const ae = document.getElementById('cine-avg');
  if (te) animCount(te, mmasTotal, false);
  // Use live global country count if available — mapData requires lat/lng so
  // it can miss countries that have assessments without valid coordinates.
  const liveCountries = window._atlasLiveGlobal ? window._atlasLiveGlobal.countries : null;
  if (ce) animCount(ce, liveCountries || mmasCountries.size, false);
  if (ae && mmasTotal>0) {
    let ts=0,tc=0; Object.values(mmasCountryData).forEach(d=>{ts+=d.totalScore;tc+=d.count;});
    const globalAvg = tc > 0 ? ts / tc : NaN;
    if (ae) ae.textContent = (tc > 0 && !isNaN(globalAvg)) ? globalAvg.toFixed(2) : '—';
  }
}

function animCount(el, target, dec) {
  const from = parseFloat(el.getAttribute('data-val')||'0');
  const dur=600, st=performance.now();
  function tick(now) {
    const p=Math.min((now-st)/dur,1), val=from+(target-from)*(1-Math.pow(1-p,3));
    el.textContent = dec?val.toFixed(2):Math.round(val).toLocaleString();
    if(p<1)requestAnimationFrame(tick); else el.setAttribute('data-val',target);
  }
  requestAnimationFrame(tick);
}

// Throttled leaderboard updater — max one DOM rebuild per 2 seconds.
// At peak AP2026 volume this fires multiple times per second without throttling.
let _lbThrottleTimer = null;
function updateCinematicLeaderboard() {
  if (_lbThrottleTimer) return; // already scheduled — skip
  _lbThrottleTimer = setTimeout(() => {
    _lbThrottleTimer = null;
    _renderCinematicLeaderboard();
  }, 2000);
}
function _renderCinematicLeaderboard() {
  const lb = document.getElementById('cine-leaderboard');
  if (!lb) return;
  const sorted = Object.entries(mmasCountryData)
    .map(([c,d])=>({c, count:d.count, avg:d.totalScore/d.count}))
    .sort((a,b)=>b.count-a.count);
  const max = sorted[0] ? sorted[0].count : 1;
  const rankClass = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';
  const rankLabel = i => i===0?'I':i===1?'II':i===2?'III':(i+1);
  lb.innerHTML = sorted.map((x,i) => {
    const cat = getAdherenceCategory(x.avg);
    const pct  = Math.round(x.count/max*100);
    return `<div class="wall-lb-row">
      <span class="wall-lb-rank ${rankClass(i)}">${rankLabel(i)}</span>
      <span class="wall-lb-country">${x.c}</span>
      <div class="wall-lb-bar-wrap"><div class="wall-lb-bar-fill" style="width:${pct}%;background:${cat.color};"></div></div>
      <span class="wall-lb-count">${x.count}</span>
    </div>`;
  }).join('');
}

function addToLiveFeed(a) {
  // Track submission timestamps for rate calculation
  const now = Date.now();
  window._subTimestamps = window._subTimestamps || [];
  window._subTimestamps.push(now);
  // Keep only last 2 hours of timestamps to bound memory
  const twoHrAgo = now - 7200000;
  window._subTimestamps = window._subTimestamps.filter(t => t > twoHrAgo);
  const feed = document.getElementById('cine-feed');
  if (!feed) return;
  const ph = feed.querySelector('[data-placeholder]');
  if (ph) ph.remove();
  const cat = getAdherenceCategory(a.score);
  // Campaign badge if this submission is tagged
  let campBadge = '';
  if (a.campaign_id && window._campaignRegistry && window._campaignRegistry[a.campaign_id]) {
    const c = window._campaignRegistry[a.campaign_id];
    campBadge = `<span class="camp-feed-badge" style="color:${c.color};border-color:${c.color};">${c.icon||''} ${c.name.split(' ').slice(0,3).join(' ')}</span>`;
    // Update live banner count
    window._campLiveCounts = window._campLiveCounts || {};
    window._campLiveCounts[a.campaign_id] = (window._campLiveCounts[a.campaign_id]||0) + 1;
    _updateCampaignBanner();
  }
  const item = document.createElement('div');
  item.className = 'cine-feed-item';
  item.style.borderLeft = `3px solid ${cat.color}`;
  const dot = document.createElement('div');
  dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${cat.color};flex-shrink:0;`;
  const locSpan = document.createElement('span');
  locSpan.style.cssText = 'flex:1;font-size:0.82rem;color:rgba(255,255,255,0.8);';
  locSpan.textContent = `${a.city||'Unknown'}, ${a.country||'Unknown'}`;
  if (campBadge) locSpan.insertAdjacentHTML('beforeend', campBadge);
  const scoreSpan = document.createElement('span');
  scoreSpan.style.cssText = `font-size:0.82rem;font-weight:700;color:${cat.color};`;
  scoreSpan.textContent = a.score.toFixed(2);
  item.appendChild(dot); item.appendChild(locSpan); item.appendChild(scoreSpan);
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > 12) feed.removeChild(feed.lastChild);
}

let tickerAnimId = null;

// ── Submission rate counter (per-minute / per-hour) ──
// Updates every 10s; fades in once the first submission arrives
(function startRateCounter() {
  setInterval(() => {
    const ts = window._subTimestamps;
    if (!ts || !ts.length) return;
    const now = Date.now();
    const perMin = ts.filter(t => t > now - 60000).length;
    const perHr  = ts.filter(t => t > now - 3600000).length;
    const minEl  = document.getElementById('cine-rate-min');
    const hrEl   = document.getElementById('cine-rate-hr');
    const minStat = document.getElementById('cine-rate-stat');
    const hrStat  = document.getElementById('cine-rate-hr-stat');
    if (minEl) minEl.textContent = perMin;
    if (hrEl)  hrEl.textContent  = perHr;
    // Fade in once we have data
    if (minStat && minStat.style.opacity === '0') minStat.style.opacity = '0.72';
    if (hrStat  && hrStat.style.opacity  === '0') hrStat.style.opacity  = '0.72';
  }, 10000);
})();
function addToTicker(a) {
  const score = parseFloat(a.score);
  if (isNaN(score)) return; // skip malformed records
  const cat = getAdherenceCategory(score);
  const city = a.city && a.city !== 'Unknown' ? a.city : null;
  const country = a.country && a.country !== 'Unknown' ? a.country : null;
  if (!city && !country) return; // skip entries with no location label at all
  tickerItems.unshift(`${_esc(city||country)}, ${_esc(country||'')} — ${score.toFixed(2)} (${_esc(cat.label)})`);
  if (tickerItems.length > 40) tickerItems.pop();
  renderTicker();
}
function renderTicker() {
  const inner = document.getElementById('cine-ticker-inner');
  if (!inner) return;
  const items = tickerItems.length > 0 ? tickerItems : ['Awaiting live submissions from around the world…'];
  const html = items.map((t,i) => `<span class="ticker-item${i===0?' ticker-latest':''}">${t}</span>`).join('');
  inner.innerHTML = html + html;
  if (tickerAnimId) cancelAnimationFrame(tickerAnimId);
  let x = 0;
  inner.style.transform = 'translateX(0px)';
  // Read scrollWidth ONCE after paint — never inside the loop.
  // Reading layout properties inside rAF forces a reflow every frame, stalling the GPU.
  let halfW = 0;
  requestAnimationFrame(() => {
    halfW = inner.scrollWidth / 2;
    function anim() {
      if (halfW > 0) {
        x -= 0.6;
        if (Math.abs(x) >= halfW) x = 0;
        inner.style.transform = `translateX(${x}px)`;
      }
      tickerAnimId = requestAnimationFrame(anim);
    }
    tickerAnimId = requestAnimationFrame(anim);
  });
}

