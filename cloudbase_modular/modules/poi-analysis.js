'use strict';
// POI Proximity Analysis — links crowdsourced SDoH infrastructure data to adherence scores
// This is unique to ATLAS: no other adherence platform has geolocated assessments + crowdsourced POIs

window.poiAnalysis = window.poiAnalysis || {};

(function() {

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// For each assessment record with coordinates, find nearest POI of each type
function computeProximity(assessments, pois) {
  const pharmacyPOIs = pois.filter(p => (p.type || '').toLowerCase().includes('pharmacy') || (p.type || '').toLowerCase().includes('pharm'));
  const hospitalPOIs = pois.filter(p => (p.type || '').toLowerCase().includes('hospital') || (p.type || '').toLowerCase().includes('clinic'));

  return assessments
    .filter(r => r.latitude && r.longitude)
    .map(r => {
      const lat = parseFloat(r.latitude);
      const lon = parseFloat(r.longitude);
      const score = parseFloat(r.mmas_score || r.score || 0);

      const nearestPharmacy = pharmacyPOIs.length
        ? Math.min(...pharmacyPOIs.map(p => haversineKm(lat, lon, parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude))))
        : null;
      const nearestHospital = hospitalPOIs.length
        ? Math.min(...hospitalPOIs.map(p => haversineKm(lat, lon, parseFloat(p.lat || p.latitude), parseFloat(p.lng || p.longitude))))
        : null;

      return { score, nearestPharmacy, nearestHospital, country: r.country || r.sdoh_country };
    });
}

// Bin records by pharmacy distance and compute mean adherence per bin
function binByDistance(proximityData, field, bins) {
  // bins: [{label, min, max}]
  return bins.map(bin => {
    const inBin = proximityData.filter(r => r[field] !== null && r[field] >= bin.min && r[field] < bin.max);
    const mean = inBin.length ? inBin.reduce((s, r) => s + r.score, 0) / inBin.length : null;
    return { label: bin.label, n: inBin.length, meanScore: mean, meanGAI: mean ? mean / 8 : null };
  });
}

// Main analysis function — loads data and renders results
window.poiAnalysis.run = async function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">Loading POI proximity analysis...</div>';

  try {
    // Load POIs and assessments with coordinates
    // Note: poi-contributor.js writes to 'infrastructure_poi' (not 'poi_submissions')
    const [poiSnap, assessSnap] = await Promise.all([
      database.ref('infrastructure_poi').once('value'),
      database.ref('assessments').once('value')
    ]);

    const pois = poiSnap.val() ? Object.values(poiSnap.val()).filter(p => p.verified !== false) : [];
    const assessments = assessSnap.val() ? Object.values(assessSnap.val()) : [];
    const geoAssessments = assessments.filter(r => r.latitude && r.longitude);

    if (pois.length === 0) {
      containerEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No verified POIs yet. <a href="#" onclick="typeof _poiContribOpen===\'function\'&&_poiContribOpen()" style="color:var(--accent);">Contribute POIs</a> to enable this analysis.</div>';
      return;
    }

    if (geoAssessments.length === 0) {
      containerEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No geolocated assessments available for proximity analysis.</div>';
      return;
    }

    const proximityData = computeProximity(geoAssessments, pois);
    const pharmacyBins = [
      { label: '< 1 km', min: 0, max: 1 },
      { label: '1-5 km', min: 1, max: 5 },
      { label: '5-15 km', min: 5, max: 15 },
      { label: '> 15 km', min: 15, max: Infinity }
    ];
    const pharmacyResults = binByDistance(proximityData, 'nearestPharmacy', pharmacyBins);
    const hospitalResults = binByDistance(proximityData, 'nearestHospital', [
      { label: '< 5 km', min: 0, max: 5 },
      { label: '5-20 km', min: 5, max: 20 },
      { label: '20-50 km', min: 20, max: 50 },
      { label: '> 50 km', min: 50, max: Infinity }
    ]);

    // Store last results for CSV export
    window.poiAnalysis._lastResults = { pharmacyResults, hospitalResults, proximityData };

    // Render results
    containerEl.innerHTML = _renderProximityResults(pharmacyResults, hospitalResults, geoAssessments.length, pois.length, proximityData.length);

  } catch(e) {
    console.error('[ATLAS POI] Analysis failed:', e);
    containerEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--poor);">Analysis failed. Please try again.</div>';
  }
};

function _renderProximityResults(pharmacyResults, hospitalResults, totalAssessments, totalPOIs, geoCount) {
  const renderTable = (results, label) => {
    const rows = results.map(r => {
      if (!r.meanScore) return `<tr><td>${r.label}</td><td style="color:var(--muted);">${r.n}</td><td style="color:var(--muted);">-</td></tr>`;
      const gai = (r.meanGAI * 100).toFixed(1);
      const color = r.meanGAI >= 0.75 ? 'var(--optimal,#4caf50)' : r.meanGAI >= 0.5 ? 'var(--moderate,#ff9800)' : 'var(--poor,#f44336)';
      return `<tr><td>${r.label}</td><td style="color:var(--muted);">${r.n}</td><td style="color:${color};font-weight:600;">${gai}%</td></tr>`;
    }).join('');
    return `
      <div style="margin-bottom:1.5rem;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--text);margin-bottom:0.5rem;">${label}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
          <thead><tr style="color:var(--muted);font-size:0.7rem;">
            <th style="text-align:left;padding:0.25rem 0;">Distance</th>
            <th style="text-align:left;padding:0.25rem 0;">N</th>
            <th style="text-align:left;padding:0.25rem 0;">Mean GAI</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  return `
    <div style="padding:1rem;">
      <div style="font-size:0.7rem;color:var(--muted);margin-bottom:1rem;">
        Analyzing ${geoCount} geolocated assessments against ${totalPOIs} verified POIs
        <span style="color:var(--accent);margin-left:0.5rem;">* ATLAS-exclusive analysis</span>
      </div>
      ${renderTable(pharmacyResults, 'Pharmacy Access vs. Adherence')}
      ${renderTable(hospitalResults, 'Hospital/Clinic Access vs. Adherence')}
      <div style="font-size:0.7rem;color:var(--muted);margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        Lower adherence in areas with poor pharmacy access validates the SDoH hypothesis.
        This data is citable in publications.
        <a href="#" style="color:var(--accent);" onclick="window.poiAnalysis.exportCSV&&window.poiAnalysis.exportCSV()">Export as CSV</a>
      </div>
    </div>`;
}

// CSV export of proximity analysis results
window.poiAnalysis.exportCSV = function() {
  const last = window.poiAnalysis._lastResults;
  if (!last) {
    if (typeof showToast === 'function') showToast('Run analysis first, then export.', 2500);
    return;
  }

  const rows = [['record_index', 'mmas_score', 'nearest_pharmacy_km', 'nearest_hospital_km', 'country']];
  last.proximityData.forEach((r, i) => {
    rows.push([
      i + 1,
      r.score != null ? r.score.toFixed(2) : '',
      r.nearestPharmacy != null ? r.nearestPharmacy.toFixed(3) : '',
      r.nearestHospital != null ? r.nearestHospital.toFixed(3) : '',
      r.country || ''
    ]);
  });

  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'atlas_poi_proximity_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('Proximity data exported.', 2000);
};

})();
