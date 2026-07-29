'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// MaaS Portal Module — ATLAS v8.7.0
// MAP-as-a-Service: API key management dashboard and developer documentation.
//
// Exposes two global functions:
//   renderMaaSPortal(containerId, workspaceKey)
//   renderMaaSDocumentation(containerId)
//
// Design tokens: --ink:#080e1a  --surface:#0d1525  --card:#111d30
//   --base:#4e9cf5  --pe:#d4a843  --bright:#e8f0f8  --muted:#6b8099
// Fonts: IBM Plex Sans (body), IBM Plex Mono (labels/code)
// Global scope pattern — no imports/exports. All functions are globals.
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared CSS injection guard ────────────────────────────────────────────────
function _maasInjectStyles() {
  if (document.getElementById('maas-portal-styles')) return;
  var style = document.createElement('style');
  style.id = 'maas-portal-styles';
  style.textContent = [
    // Base layout
    '.maas-portal { font-family: "IBM Plex Sans", sans-serif; color: #e8f0f8; background: #0d1525; min-height: 100%; }',
    '.maas-section { background: #111d30; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }',
    '.maas-section-title { font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; color: #6b8099; margin-bottom: 18px; }',

    // Page header
    '.maas-header { padding: 0 0 28px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 28px; }',
    '.maas-header-title { font-size: 1.55rem; font-weight: 600; color: #e8f0f8; margin: 0 0 6px; letter-spacing: -0.01em; }',
    '.maas-header-sub { font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; color: #6b8099; letter-spacing: 0.06em; }',
    '.maas-header-badge { display: inline-block; font-family: "IBM Plex Mono", monospace; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; background: rgba(78,156,245,0.1); border: 1px solid rgba(78,156,245,0.25); color: #4e9cf5; margin-left: 10px; vertical-align: middle; }',

    // Buttons
    '.maas-btn { font-family: "IBM Plex Mono", monospace; font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; transition: opacity 0.18s, background 0.18s; display: inline-flex; align-items: center; gap: 7px; }',
    '.maas-btn:hover { opacity: 0.85; }',
    '.maas-btn:disabled { opacity: 0.35; cursor: not-allowed; }',
    '.maas-btn-primary { background: #4e9cf5; color: #080e1a; }',
    '.maas-btn-danger  { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }',
    '.maas-btn-ghost   { background: rgba(255,255,255,0.05); color: #e8f0f8; border: 1px solid rgba(255,255,255,0.1); }',
    '.maas-btn-sm { padding: 5px 12px; font-size: 0.62rem; }',

    // Table
    '.maas-table-wrap { overflow-x: auto; }',
    '.maas-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }',
    '.maas-table th { font-family: "IBM Plex Mono", monospace; font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: #6b8099; padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }',
    '.maas-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; color: #e8f0f8; }',
    '.maas-table tr:last-child td { border-bottom: none; }',
    '.maas-table tr:hover td { background: rgba(255,255,255,0.02); }',

    // Status badges
    '.maas-badge { display: inline-block; font-family: "IBM Plex Mono", monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 20px; }',
    '.maas-badge-active   { background: rgba(16,185,129,0.1);  color: #10b981; border: 1px solid rgba(16,185,129,0.2);  }',
    '.maas-badge-revoked  { background: rgba(239,68,68,0.1);   color: #ef4444; border: 1px solid rgba(239,68,68,0.2);   }',
    '.maas-badge-ehr      { background: rgba(78,156,245,0.1);  color: #4e9cf5; border: 1px solid rgba(78,156,245,0.2);  }',
    '.maas-badge-pharmacy { background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }',
    '.maas-badge-research { background: rgba(212,168,67,0.1);  color: #d4a843; border: 1px solid rgba(212,168,67,0.2);  }',
    '.maas-badge-other    { background: rgba(107,128,153,0.1); color: #6b8099; border: 1px solid rgba(107,128,153,0.2); }',

    // Key prefix mono display
    '.maas-key-prefix { font-family: "IBM Plex Mono", monospace; font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 5px; color: #4e9cf5; letter-spacing: 0.04em; }',

    // Modal overlay
    '.maas-modal-overlay { position: fixed; inset: 0; background: rgba(8,14,26,0.85); backdrop-filter: blur(4px); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 20px; }',
    '.maas-modal { background: #111d30; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 80px rgba(0,0,0,0.6); }',
    '.maas-modal-header { padding: 22px 26px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; }',
    '.maas-modal-title { font-size: 1.05rem; font-weight: 600; color: #e8f0f8; }',
    '.maas-modal-close { background: none; border: none; color: #6b8099; cursor: pointer; font-size: 1.2rem; line-height: 1; padding: 4px; transition: color 0.15s; }',
    '.maas-modal-close:hover { color: #e8f0f8; }',
    '.maas-modal-body { padding: 22px 26px; }',
    '.maas-modal-footer { padding: 16px 26px 22px; display: flex; gap: 10px; justify-content: flex-end; }',

    // Form fields
    '.maas-field { margin-bottom: 18px; }',
    '.maas-label { font-family: "IBM Plex Mono", monospace; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: #6b8099; margin-bottom: 7px; display: block; }',
    '.maas-input { width: 100%; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 13px; color: #e8f0f8; font-family: "IBM Plex Sans", sans-serif; font-size: 0.9rem; outline: none; transition: border-color 0.15s; box-sizing: border-box; }',
    '.maas-input:focus { border-color: rgba(78,156,245,0.5); }',
    '.maas-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%236b8099\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }',

    // Raw key display
    '.maas-key-reveal { background: rgba(0,0,0,0.4); border: 1px solid rgba(78,156,245,0.3); border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }',
    '.maas-key-reveal-label { font-family: "IBM Plex Mono", monospace; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: #4e9cf5; margin-bottom: 10px; }',
    '.maas-key-reveal-value { font-family: "IBM Plex Mono", monospace; font-size: 0.82rem; color: #e8f0f8; word-break: break-all; line-height: 1.6; margin-bottom: 12px; }',
    '.maas-key-warning { font-size: 0.8rem; color: #d4a843; background: rgba(212,168,67,0.08); border: 1px solid rgba(212,168,67,0.2); border-radius: 8px; padding: 10px 14px; }',

    // Code snippet tabs
    '.maas-snippet-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 0; }',
    '.maas-snippet-tab { font-family: "IBM Plex Mono", monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 8px 16px; cursor: pointer; border: none; background: none; color: #6b8099; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; }',
    '.maas-snippet-tab.active { color: #4e9cf5; border-bottom-color: #4e9cf5; }',
    '.maas-snippet-tab:hover:not(.active) { color: #e8f0f8; }',
    '.maas-snippet-pane { display: none; }',
    '.maas-snippet-pane.active { display: block; }',
    '.maas-code-block { background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); border-top: none; border-radius: 0 0 8px 8px; padding: 18px 20px; position: relative; }',
    '.maas-code-block pre { font-family: "IBM Plex Mono", monospace; font-size: 0.78rem; color: #e8f0f8; margin: 0; white-space: pre; overflow-x: auto; line-height: 1.6; }',
    '.maas-code-copy { position: absolute; top: 10px; right: 10px; font-family: "IBM Plex Mono", monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 5px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #6b8099; cursor: pointer; transition: color 0.15s, background 0.15s; }',
    '.maas-code-copy:hover { color: #e8f0f8; background: rgba(255,255,255,0.1); }',

    // Analytics
    '.maas-analytics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }',
    '@media (max-width: 640px) { .maas-analytics-grid { grid-template-columns: 1fr; } }',
    '.maas-stat-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 18px; }',
    '.maas-stat-label { font-family: "IBM Plex Mono", monospace; font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: #6b8099; margin-bottom: 8px; }',
    '.maas-stat-value { font-size: 1.9rem; font-weight: 600; color: #e8f0f8; line-height: 1; }',
    '.maas-stat-sub { font-family: "IBM Plex Mono", monospace; font-size: 0.65rem; color: #6b8099; margin-top: 4px; }',

    // SVG bar chart
    '.maas-chart-wrap { overflow: hidden; }',
    '.maas-chart-svg { width: 100%; overflow: visible; }',

    // Top partners list
    '.maas-partner-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }',
    '.maas-partner-row:last-child { border-bottom: none; }',
    '.maas-partner-bar-track { flex: 1; height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }',
    '.maas-partner-bar-fill { height: 5px; background: #4e9cf5; border-radius: 3px; }',
    '.maas-partner-name { font-size: 0.85rem; color: #e8f0f8; min-width: 140px; }',
    '.maas-partner-calls { font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; color: #6b8099; min-width: 60px; text-align: right; }',

    // Empty state
    '.maas-empty { text-align: center; padding: 40px 20px; color: #6b8099; }',
    '.maas-empty-icon { font-size: 2.4rem; margin-bottom: 12px; opacity: 0.4; }',
    '.maas-empty-text { font-size: 0.9rem; }',

    // Loading spinner
    '.maas-loading { display: flex; align-items: center; gap: 10px; color: #6b8099; font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; padding: 20px 0; }',
    '@keyframes maas-spin { to { transform: rotate(360deg); } }',
    '.maas-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #4e9cf5; border-radius: 50%; animation: maas-spin 0.7s linear infinite; }',

    // Docs
    '.maas-doc-section { margin-bottom: 32px; }',
    '.maas-doc-h2 { font-size: 1.15rem; font-weight: 600; color: #e8f0f8; margin: 0 0 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.07); }',
    '.maas-doc-h3 { font-family: "IBM Plex Mono", monospace; font-size: 0.78rem; letter-spacing: 0.06em; color: #4e9cf5; margin: 20px 0 8px; }',
    '.maas-doc-p { font-size: 0.88rem; color: rgba(232,240,248,0.8); line-height: 1.7; margin-bottom: 12px; }',
    '.maas-doc-p a { color: #4e9cf5; text-decoration: none; }',
    '.maas-doc-p a:hover { text-decoration: underline; }',
    '.maas-endpoint-block { background: rgba(0,0,0,0.3); border-radius: 10px; border: 1px solid rgba(255,255,255,0.07); overflow: hidden; margin-bottom: 20px; }',
    '.maas-endpoint-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }',
    '.maas-method { font-family: "IBM Plex Mono", monospace; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; padding: 3px 9px; border-radius: 5px; }',
    '.maas-method-post { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }',
    '.maas-method-get  { background: rgba(78,156,245,0.12);  color: #4e9cf5; border: 1px solid rgba(78,156,245,0.2);  }',
    '.maas-endpoint-path { font-family: "IBM Plex Mono", monospace; font-size: 0.82rem; color: #e8f0f8; }',
    '.maas-endpoint-body { padding: 14px 18px; }',
    '.maas-table-sm { width: 100%; border-collapse: collapse; font-size: 0.8rem; }',
    '.maas-table-sm th { font-family: "IBM Plex Mono", monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: #6b8099; padding: 6px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); }',
    '.maas-table-sm td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(232,240,248,0.85); vertical-align: top; }',
    '.maas-table-sm td:first-child { font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; color: #4e9cf5; }',
    '.maas-table-sm tr:last-child td { border-bottom: none; }',
    '.maas-error-code { font-family: "IBM Plex Mono", monospace; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }',
    '.maas-error-401 { background: rgba(239,68,68,0.1);   color: #ef4444; }',
    '.maas-error-422 { background: rgba(245,158,11,0.1);  color: #f59e0b; }',
    '.maas-error-429 { background: rgba(212,168,67,0.1);  color: #d4a843; }',
    '.maas-error-400 { background: rgba(107,128,153,0.1); color: #6b8099; }',
    '.maas-error-500 { background: rgba(239,68,68,0.08);  color: #ef4444; }',
    '.maas-fhir-note { background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.15); border-radius: 8px; padding: 14px 16px; font-size: 0.84rem; color: rgba(232,240,248,0.8); line-height: 1.6; }',
    '.maas-fhir-note strong { color: #a78bfa; }',
  ].join('\n');
  document.head.appendChild(style);
}

// ── Utility helpers ───────────────────────────────────────────────────────────
function _maasEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _maasTypeBadge(type) {
  var cls = 'maas-badge-' + (['ehr','pharmacy','research'].indexOf(type) >= 0 ? type : 'other');
  return '<span class="maas-badge ' + cls + '">' + _maasEsc(type || 'other') + '</span>';
}

function _maasStatusBadge(active) {
  return active
    ? '<span class="maas-badge maas-badge-active">Active</span>'
    : '<span class="maas-badge maas-badge-revoked">Revoked</span>';
}

function _maasFormatDate(isoStr) {
  if (!isoStr) return 'Never';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function _maasApiFetch(path, opts) {
  var token = null;
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      return firebase.auth().currentUser.getIdToken().then(function(t) {
        var headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, (opts && opts.headers) || {});
        return fetch(path, Object.assign({}, opts, { headers: headers })).then(function(r) { return r.json(); });
      });
    }
  } catch(e) {}
  return fetch(path, opts).then(function(r) { return r.json(); });
}

// ── Code snippets ─────────────────────────────────────────────────────────────
function _maasSnippets(rawKey) {
  var key = rawKey || 'maas_live_YOUR_KEY_HERE';
  return {
    JavaScript: [
      '// MAP Scoring via ATLAS MaaS API',
      'const response = await fetch(\'https://atlas.adherence.cc/api/maas/v1/score\', {',
      '  method: \'POST\',',
      '  headers: {',
      '    \'Authorization\': \'Bearer ' + key + '\',',
      '    \'Content-Type\': \'application/json\'',
      '  },',
      '  body: JSON.stringify({',
      '    responses: [1, 0, 1, 1, 1, 0, 1, 0.75], // Q1-Q8',
      '    condition: \'Hypertension\',',
      '    patient_ref: \'YOUR-PATIENT-ID\'',
      '  })',
      '});',
      '',
      'const { scores, domain_analysis, phenotype, risk_flag } = await response.json();',
      '',
      '// Core PE scoring',
      'console.log(`PE: ${scores.pe} | Tier: ${scores.pe_tier} | Adherence: ${scores.adherence_level}`);',
      '',
      '// Domain breakdown — strength labels included, no threshold logic needed',
      'console.log(`Architecture:  ${scores.architecture} (${domain_analysis.architecture.label}, gap: ${domain_analysis.architecture.gap_to_optimal})`);',
      'console.log(`Execution:     ${scores.execution} (${domain_analysis.execution.label}, gap: ${domain_analysis.execution.gap_to_optimal})`);',
      'console.log(`Context-Guard: ${scores.context_guard} (${domain_analysis.context_guard.label}, gap: ${domain_analysis.context_guard.gap_to_optimal})`);',
      '',
      '// Phenotype — full clinical narrative ready for EHR note insertion',
      'console.log(`Phenotype: ${phenotype.classification} [${phenotype.confidence} confidence]`);',
      'console.log(`Summary:   ${phenotype.description}`);',
      'console.log(`Protocol:  ${phenotype.full_intervention}`);',
      '',
      '// Risk flag for EHR alert widgets: "none" | "elevated" | "high"',
      'if (risk_flag !== \'none\') {',
      '  triggerClinicalAlert(risk_flag, phenotype.classification);',
      '}',
    ].join('\n'),

    Python: [
      '# MAP Scoring via ATLAS MaaS API',
      'import requests',
      '',
      'MAAS_KEY = \'' + key + '\'',
      'BASE_URL = \'https://atlas.adherence.cc/api/maas/v1\'',
      '',
      'response = requests.post(',
      '    f\'{BASE_URL}/score\',',
      '    headers={',
      '        \'Authorization\': f\'Bearer {MAAS_KEY}\',',
      '        \'Content-Type\': \'application/json\'',
      '    },',
      '    json={',
      '        \'responses\': [1, 0, 1, 1, 1, 0, 1, 0.75],  # Q1-Q8',
      '        \'condition\': \'Hypertension\',',
      '        \'patient_ref\': \'YOUR-PATIENT-ID\'',
      '    }',
      ')',
      '',
      'data      = response.json()',
      'scores    = data[\'scores\']',
      'domains   = data[\'domain_analysis\']',
      'phenotype = data[\'phenotype\']',
      'risk      = data[\'risk_flag\']',
      '',
      '# Core PE scoring',
      'print(f"PE: {scores[\'pe\']} | Tier: {scores[\'pe_tier\']} | Adherence: {scores[\'adherence_level\']}")',
      '',
      '# Domain breakdown — strength labels included, no threshold logic needed',
      'for domain, info in domains.items():',
      '    print(f"  {domain}: {info[\'score\']:.4f} ({info[\'label\']}, gap: {info[\'gap_to_optimal\']:.4f})")',
      '',
      '# Phenotype — structured for EHR note or care plan generation',
      'print(f"Phenotype: {phenotype[\'classification\']} [{phenotype[\'confidence\']}]")',
      'print(f"Summary:   {phenotype[\'description\']}")',
      'print(f"Protocol:  {phenotype[\'full_intervention\']}")',
      'print(f"Risk flag: {risk}")',
    ].join('\n'),

    cURL: [
      'curl -X POST https://atlas.adherence.cc/api/maas/v1/score \\',
      '  -H "Authorization: Bearer ' + key + '" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{',
      '    "responses": [1, 0, 1, 1, 1, 0, 1, 0.75],',
      '    "condition": "Hypertension",',
      '    "patient_ref": "YOUR-PATIENT-ID"',
      '  }\'',
      '',
      '# Response includes: scores (pe, pe_tier, adherence_level, domain scores),',
      '# domain_analysis (per-domain label + gap_to_optimal),',
      '# phenotype (classification, description, full_intervention),',
      '# and risk_flag ("none" | "elevated" | "high")',
    ].join('\n'),

    PHP: [
      '<?php',
      '// MAP Scoring via ATLAS MaaS API',
      '$maasKey = \'' + key + '\';',
      '$baseUrl = \'https://atlas.adherence.cc/api/maas/v1\';',
      '',
      '$payload = json_encode([',
      '    \'responses\'   => [1, 0, 1, 1, 1, 0, 1, 0.75],  // Q1-Q8',
      '    \'condition\'   => \'Hypertension\',',
      '    \'patient_ref\' => \'YOUR-PATIENT-ID\'',
      ']);',
      '',
      '$ch = curl_init($baseUrl . \'/score\');',
      'curl_setopt_array($ch, [',
      '    CURLOPT_POST           => true,',
      '    CURLOPT_POSTFIELDS     => $payload,',
      '    CURLOPT_RETURNTRANSFER => true,',
      '    CURLOPT_HTTPHEADER     => [',
      '        \'Authorization: Bearer \' . $maasKey,',
      '        \'Content-Type: application/json\',',
      '    ],',
      ']);',
      '',
      '$data      = json_decode(curl_exec($ch), true);',
      'curl_close($ch);',
      '',
      '$scores    = $data[\'scores\'];',
      '$domains   = $data[\'domain_analysis\'];',
      '$phenotype = $data[\'phenotype\'];',
      '$risk      = $data[\'risk_flag\'];',
      '',
      '// Core PE scoring',
      'echo "PE: {$scores[\'pe\']} | Tier: {$scores[\'pe_tier\']} | Adherence: {$scores[\'adherence_level\']}\\n";',
      '',
      '// Domain breakdown',
      'foreach ($domains as $domain => $info) {',
      '    echo "  $domain: {$info[\'score\']} ({$info[\'label\']}, gap: {$info[\'gap_to_optimal\']})\\n";',
      '}',
      '',
      '// Phenotype — ready for EHR note or care plan',
      'echo "Phenotype: {$phenotype[\'classification\']} [{$phenotype[\'confidence\']}]\\n";',
      'echo "Summary:   {$phenotype[\'description\']}\\n";',
      'echo "Protocol:  {$phenotype[\'full_intervention\']}\\n";',
      'echo "Risk flag: $risk\\n";',
    ].join('\n'),
  };
}

// ── Snippet block renderer ───────────────────────────────────────────────────
function _renderSnippetBlock(containerId, rawKey) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var langs = ['JavaScript', 'Python', 'cURL', 'PHP'];
  var snippets = _maasSnippets(rawKey);

  var tabsHtml = '<div class="maas-snippet-tabs">';
  langs.forEach(function(lang, i) {
    tabsHtml += '<button class="maas-snippet-tab' + (i === 0 ? ' active' : '') +
      '" data-lang="' + lang + '">' + lang + '</button>';
  });
  tabsHtml += '</div>';

  var panesHtml = '';
  langs.forEach(function(lang, i) {
    panesHtml += '<div class="maas-snippet-pane' + (i === 0 ? ' active' : '') + '" data-pane="' + lang + '">';
    panesHtml += '<div class="maas-code-block">';
    panesHtml += '<button class="maas-code-copy" onclick="(function(el){var pre=el.parentNode.querySelector(\'pre\');navigator.clipboard&&navigator.clipboard.writeText(pre.textContent).then(function(){el.textContent=\'Copied!\';setTimeout(function(){el.textContent=\'Copy\';},1800);});})(this)">Copy</button>';
    panesHtml += '<pre>' + _maasEsc(snippets[lang]) + '</pre>';
    panesHtml += '</div></div>';
  });

  container.innerHTML = tabsHtml + panesHtml;

  // Tab switching
  var tabs = container.querySelectorAll('.maas-snippet-tab');
  var panes = container.querySelectorAll('.maas-snippet-pane');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var lang = tab.getAttribute('data-lang');
      tabs.forEach(function(t) { t.classList.toggle('active', t === tab); });
      panes.forEach(function(p) { p.classList.toggle('active', p.getAttribute('data-pane') === lang); });
    });
  });
}

// ── Inline SVG bar chart for hourly call volume ──────────────────────────────
function _renderMaaSBarChart(containerId, data24h) {
  // data24h: array of 24 { hour: 0-23, calls: N } objects
  var container = document.getElementById(containerId);
  if (!container) return;

  var W = 600, H = 120, PAD = { top: 10, right: 8, bottom: 28, left: 36 };
  var chartW = W - PAD.left - PAD.right;
  var chartH = H - PAD.top - PAD.bottom;
  var bars = data24h || [];

  var maxCalls = Math.max(1, Math.max.apply(null, bars.map(function(b) { return b.calls || 0; })));

  var barW = chartW / 24;
  var now = new Date();
  var currentHour = now.getHours();

  var svgParts = [
    '<svg class="maas-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">',
    // Y axis labels
    '<text x="' + (PAD.left - 6) + '" y="' + (PAD.top + 4) + '" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9" fill="#6b8099">' + maxCalls + '</text>',
    '<text x="' + (PAD.left - 6) + '" y="' + (PAD.top + chartH / 2 + 4) + '" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9" fill="#6b8099">' + Math.round(maxCalls / 2) + '</text>',
    '<text x="' + (PAD.left - 6) + '" y="' + (PAD.top + chartH + 4) + '" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9" fill="#6b8099">0</text>',
    // Grid lines
    '<line x1="' + PAD.left + '" y1="' + PAD.top + '" x2="' + (PAD.left + chartW) + '" y2="' + PAD.top + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>',
    '<line x1="' + PAD.left + '" y1="' + (PAD.top + chartH / 2) + '" x2="' + (PAD.left + chartW) + '" y2="' + (PAD.top + chartH / 2) + '" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>',
    '<line x1="' + PAD.left + '" y1="' + (PAD.top + chartH) + '" x2="' + (PAD.left + chartW) + '" y2="' + (PAD.top + chartH) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>',
  ];

  bars.forEach(function(b, i) {
    var calls = b.calls || 0;
    var bH = calls === 0 ? 1 : Math.max(2, (calls / maxCalls) * chartH);
    var x = PAD.left + i * barW + barW * 0.15;
    var y = PAD.top + chartH - bH;
    var w = barW * 0.7;
    var isCurrent = (b.hour === currentHour);
    var fill = isCurrent ? '#4e9cf5' : 'rgba(78,156,245,0.35)';

    svgParts.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + bH + '" rx="2" fill="' + fill + '">');
    svgParts.push('<title>Hour ' + b.hour + ':00 — ' + calls + ' calls</title>');
    svgParts.push('</rect>');

    // X axis labels every 6 hours
    if (i % 6 === 0) {
      var lx = PAD.left + i * barW + barW / 2;
      svgParts.push('<text x="' + lx + '" y="' + (H - 4) + '" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="#6b8099">' + b.hour + 'h</text>');
    }
  });

  svgParts.push('</svg>');
  container.innerHTML = svgParts.join('');
}

// ── Build empty 24-hour data structure ───────────────────────────────────────
function _emptyHourlyData() {
  var arr = [];
  var now = new Date();
  for (var i = 23; i >= 0; i--) {
    var h = new Date(now.getTime() - i * 3600000);
    arr.push({ hour: h.getHours(), calls: 0, ts: h.getTime() });
  }
  return arr;
}

// ══════════════════════════════════════════════════════════════════════════════
// renderMaaSPortal(containerId, workspaceKey)
// Main MaaS management dashboard.
// ══════════════════════════════════════════════════════════════════════════════
function renderMaaSPortal(containerId, workspaceKey) {
  _maasInjectStyles();
  var container = document.getElementById(containerId);
  if (!container) { console.error('renderMaaSPortal: container not found:', containerId); return; }
  if (!workspaceKey) { console.error('renderMaaSPortal: workspaceKey is required'); return; }

  // State
  var _keys = [];
  var _stats = null;
  var _showCreateForm = false;
  var _createdKey = null; // raw key after creation

  // ── Initial skeleton ──────────────────────────────────────────────────────
  container.innerHTML = [
    '<div class="maas-portal">',
    '  <div class="maas-header">',
    '    <div class="maas-header-title">MAP-as-a-Service (MaaS)',
    '      <span class="maas-header-badge">v1.1</span>',
    '    </div>',
    '    <div class="maas-header-sub">API Integration Portal — Embed MAP scoring into any EHR, pharmacy system, or health app.</div>',
    '  </div>',
    '  <div id="maas-analytics-section"></div>',
    '  <div class="maas-section">',
    '    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">',
    '      <div class="maas-section-title" style="margin-bottom:0;">Active Integrations</div>',
    '      <button class="maas-btn maas-btn-primary" id="maas-open-create">+ New Integration</button>',
    '    </div>',
    '    <div id="maas-keys-table"><div class="maas-loading"><div class="maas-spinner"></div>Loading integrations...</div></div>',
    '  </div>',
    '</div>',
  ].join('');

  // Wire create button
  var createBtn = container.querySelector('#maas-open-create');
  if (createBtn) {
    createBtn.addEventListener('click', function() { _openCreateModal(); });
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  _loadPortalData();

  function _loadPortalData() {
    _maasApiFetch('/api/v1/admin/maas/keys?workspace_key=' + encodeURIComponent(workspaceKey), {
      method: 'GET',
    }).then(function(json) {
      _keys = (json && json.data && json.data.keys) ? json.data.keys : [];
      _stats = (json && json.data && json.data.stats) ? json.data.stats : null;
      _renderKeysTable();
      _renderAnalytics();
    }).catch(function() {
      // Graceful fallback if endpoint not yet available
      _keys = [];
      _renderKeysTable();
      _renderAnalytics();
    });
  }

  // ── Render keys table ─────────────────────────────────────────────────────
  function _renderKeysTable() {
    var wrap = container.querySelector('#maas-keys-table');
    if (!wrap) return;

    if (!_keys.length) {
      wrap.innerHTML = [
        '<div class="maas-empty">',
        '  <div class="maas-empty-icon">&#9670;</div>',
        '  <div class="maas-empty-text">No integrations yet. Create one to get started.</div>',
        '</div>',
      ].join('');
      return;
    }

    var rows = _keys.map(function(k) {
      var lastUsed = k.last_used ? _maasFormatDate(k.last_used) : 'Never';
      return [
        '<tr data-key-id="' + _maasEsc(k.key_id) + '">',
        '  <td><strong>' + _maasEsc(k.partner_name) + '</strong></td>',
        '  <td>' + _maasTypeBadge(k.partner_type) + '</td>',
        '  <td><span class="maas-key-prefix">' + _maasEsc(k.key_prefix) + '...</span></td>',
        '  <td>' + (k.calls_this_hour || 0) + ' / ' + (k.rate_limit_per_hour || 1000) + '</td>',
        '  <td>' + (k.total_calls || 0).toLocaleString() + '</td>',
        '  <td style="font-size:0.8rem;color:#6b8099;">' + _maasEsc(lastUsed) + '</td>',
        '  <td>' + _maasStatusBadge(k.active) + '</td>',
        '  <td>',
        k.active
          ? '<button class="maas-btn maas-btn-danger maas-btn-sm maas-revoke-btn" data-key-id="' + _maasEsc(k.key_id) + '" data-partner="' + _maasEsc(k.partner_name) + '">Revoke</button>'
          : '<span style="font-family:IBM Plex Mono,monospace;font-size:0.65rem;color:#6b8099;">Revoked</span>',
        '  </td>',
        '</tr>',
      ].join('');
    }).join('');

    wrap.innerHTML = [
      '<div class="maas-table-wrap">',
      '<table class="maas-table">',
      '<thead><tr>',
      '<th>Partner</th><th>Type</th><th>Key Prefix</th>',
      '<th>Calls (this hour)</th><th>Total Calls</th><th>Last Used</th>',
      '<th>Status</th><th></th>',
      '</tr></thead>',
      '<tbody>' + rows + '</tbody>',
      '</table>',
      '</div>',
    ].join('');

    // Wire revoke buttons
    var revokeBtns = wrap.querySelectorAll('.maas-revoke-btn');
    revokeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var keyId   = btn.getAttribute('data-key-id');
        var partner = btn.getAttribute('data-partner');
        _confirmRevoke(keyId, partner);
      });
    });
  }

  // ── Analytics section ─────────────────────────────────────────────────────
  function _renderAnalytics() {
    var sec = container.querySelector('#maas-analytics-section');
    if (!sec) return;

    var totalCalls   = _keys.reduce(function(s, k) { return s + (k.total_calls || 0); }, 0);
    var callsThisHr  = _keys.reduce(function(s, k) { return s + (k.calls_this_hour || 0); }, 0);
    var activeCount  = _keys.filter(function(k) { return k.active; }).length;
    var errorRate    = (_stats && _stats.error_rate_24h != null) ? _stats.error_rate_24h.toFixed(1) + '%' : 'N/A';

    // Sort partners by total_calls for the leaderboard
    var sorted = _keys.slice().sort(function(a, b) { return (b.total_calls || 0) - (a.total_calls || 0); });
    var maxPartnerCalls = sorted.length ? (sorted[0].total_calls || 1) : 1;

    var partnerRowsHtml = sorted.slice(0, 6).map(function(k, i) {
      var pct = Math.round(((k.total_calls || 0) / maxPartnerCalls) * 100);
      return [
        '<div class="maas-partner-row">',
        '<span style="font-family:IBM Plex Mono,monospace;font-size:0.65rem;color:#6b8099;min-width:18px;">#' + (i + 1) + '</span>',
        '<span class="maas-partner-name">' + _maasEsc(k.partner_name) + '</span>',
        '<div class="maas-partner-bar-track"><div class="maas-partner-bar-fill" style="width:' + pct + '%"></div></div>',
        '<span class="maas-partner-calls">' + (k.total_calls || 0).toLocaleString() + '</span>',
        '</div>',
      ].join('');
    }).join('') || '<div style="color:#6b8099;font-size:0.85rem;padding:10px 0;">No data yet.</div>';

    // Build 24-hour data from stats if available, else empty
    var hourlyData = (_stats && Array.isArray(_stats.hourly_24h)) ? _stats.hourly_24h : _emptyHourlyData();

    sec.innerHTML = [
      '<div class="maas-section">',
      '  <div class="maas-section-title">Usage Analytics</div>',
      '  <div class="maas-analytics-grid">',
      '    <div class="maas-stat-card">',
      '      <div class="maas-stat-label">Total API Calls</div>',
      '      <div class="maas-stat-value">' + totalCalls.toLocaleString() + '</div>',
      '      <div class="maas-stat-sub">All time, all integrations</div>',
      '    </div>',
      '    <div class="maas-stat-card">',
      '      <div class="maas-stat-label">Calls This Hour</div>',
      '      <div class="maas-stat-value">' + callsThisHr.toLocaleString() + '</div>',
      '      <div class="maas-stat-sub">' + activeCount + ' active integration' + (activeCount !== 1 ? 's' : '') + '</div>',
      '    </div>',
      '    <div class="maas-stat-card">',
      '      <div class="maas-stat-label">Error Rate (24h)</div>',
      '      <div class="maas-stat-value" style="font-size:1.5rem;">' + errorRate + '</div>',
      '      <div class="maas-stat-sub">Auth failures + rate limits</div>',
      '    </div>',
      '  </div>',
      '  <div style="margin-bottom:22px;">',
      '    <div style="font-family:IBM Plex Mono,monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;margin-bottom:10px;">Hourly Call Volume (24h)</div>',
      '    <div class="maas-chart-wrap"><div id="maas-hourly-chart"></div></div>',
      '  </div>',
      '  <div>',
      '    <div style="font-family:IBM Plex Mono,monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;margin-bottom:10px;">Top Partners by Volume</div>',
      '    <div id="maas-partner-list">' + partnerRowsHtml + '</div>',
      '  </div>',
      '</div>',
    ].join('');

    // Render SVG chart after DOM insertion
    setTimeout(function() {
      _renderMaaSBarChart('maas-hourly-chart', hourlyData);
    }, 0);
  }

  // ── Revoke confirmation modal ─────────────────────────────────────────────
  function _confirmRevoke(keyId, partnerName) {
    var overlay = document.createElement('div');
    overlay.className = 'maas-modal-overlay';
    overlay.innerHTML = [
      '<div class="maas-modal" style="max-width:420px;">',
      '  <div class="maas-modal-header">',
      '    <span class="maas-modal-title">Revoke Integration</span>',
      '    <button class="maas-modal-close" id="maas-revoke-cancel-x">&times;</button>',
      '  </div>',
      '  <div class="maas-modal-body">',
      '    <p style="font-size:0.9rem;color:rgba(232,240,248,0.8);line-height:1.6;">',
      '      This will immediately revoke the API key for <strong>' + _maasEsc(partnerName) + '</strong>.',
      '      All calls using this key will begin returning 401 errors. This action cannot be undone.',
      '    </p>',
      '  </div>',
      '  <div class="maas-modal-footer">',
      '    <button class="maas-btn maas-btn-ghost" id="maas-revoke-cancel">Cancel</button>',
      '    <button class="maas-btn maas-btn-danger" id="maas-revoke-confirm">Revoke Key</button>',
      '  </div>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    function _close() { document.body.removeChild(overlay); }

    overlay.querySelector('#maas-revoke-cancel').addEventListener('click', _close);
    overlay.querySelector('#maas-revoke-cancel-x').addEventListener('click', _close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) _close(); });

    overlay.querySelector('#maas-revoke-confirm').addEventListener('click', function() {
      var btn = overlay.querySelector('#maas-revoke-confirm');
      btn.textContent = 'Revoking...';
      btn.disabled = true;

      _maasApiFetch('/api/v1/admin/maas/revoke-key', {
        method: 'POST',
        body: JSON.stringify({ key_id: keyId }),
      }).then(function() {
        _close();
        _loadPortalData();
      }).catch(function(err) {
        btn.textContent = 'Error — try again';
        btn.disabled = false;
        console.error('Revoke failed:', err);
      });
    });
  }

  // ── Create key modal ──────────────────────────────────────────────────────
  function _openCreateModal() {
    var overlay = document.createElement('div');
    overlay.className = 'maas-modal-overlay';
    overlay.innerHTML = [
      '<div class="maas-modal">',
      '  <div class="maas-modal-header">',
      '    <span class="maas-modal-title">New API Integration</span>',
      '    <button class="maas-modal-close" id="maas-create-close-x">&times;</button>',
      '  </div>',
      '  <div class="maas-modal-body" id="maas-create-body">',
      '    <div class="maas-field">',
      '      <label class="maas-label">Partner Name</label>',
      '      <input class="maas-input" id="maas-f-name" type="text" placeholder="e.g. Epic EHR — Memorial Hospital" autocomplete="off">',
      '    </div>',
      '    <div class="maas-field">',
      '      <label class="maas-label">Partner Type</label>',
      '      <select class="maas-input maas-select" id="maas-f-type">',
      '        <option value="ehr">EHR</option>',
      '        <option value="pharmacy">Pharmacy</option>',
      '        <option value="research">Research</option>',
      '        <option value="government">Government</option>',
      '        <option value="pharma">Pharma</option>',
      '        <option value="other">Other</option>',
      '      </select>',
      '    </div>',
      '    <div class="maas-field">',
      '      <label class="maas-label">Rate Limit (calls per hour)</label>',
      '      <input class="maas-input" id="maas-f-rate" type="number" value="1000" min="1" max="100000">',
      '    </div>',
      '    <div id="maas-create-error" style="color:#ef4444;font-size:0.82rem;margin-top:6px;display:none;"></div>',
      '  </div>',
      '  <div class="maas-modal-footer">',
      '    <button class="maas-btn maas-btn-ghost" id="maas-create-cancel">Cancel</button>',
      '    <button class="maas-btn maas-btn-primary" id="maas-create-submit">Generate API Key</button>',
      '  </div>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    function _close() { document.body.removeChild(overlay); }

    overlay.querySelector('#maas-create-close-x').addEventListener('click', _close);
    overlay.querySelector('#maas-create-cancel').addEventListener('click', _close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) _close(); });

    overlay.querySelector('#maas-create-submit').addEventListener('click', function() {
      var name      = (overlay.querySelector('#maas-f-name').value || '').trim();
      var type      = overlay.querySelector('#maas-f-type').value;
      var rateLimit = parseInt(overlay.querySelector('#maas-f-rate').value) || 1000;
      var errEl     = overlay.querySelector('#maas-create-error');

      if (!name) {
        errEl.textContent = 'Partner name is required.';
        errEl.style.display = 'block';
        return;
      }
      if (rateLimit < 1 || rateLimit > 100000) {
        errEl.textContent = 'Rate limit must be between 1 and 100,000.';
        errEl.style.display = 'block';
        return;
      }

      errEl.style.display = 'none';
      var submitBtn = overlay.querySelector('#maas-create-submit');
      submitBtn.textContent = 'Generating...';
      submitBtn.disabled = true;

      _maasApiFetch('/api/v1/admin/maas/create-key', {
        method: 'POST',
        body: JSON.stringify({
          workspace_key:        workspaceKey,
          partner_name:         name,
          partner_type:         type,
          rate_limit_per_hour:  rateLimit,
        }),
      }).then(function(json) {
        if (!json || !json.ok || !json.data || !json.data.raw_key) {
          errEl.textContent = (json && json.error) ? json.error : 'Key generation failed. Try again.';
          errEl.style.display = 'block';
          submitBtn.textContent = 'Generate API Key';
          submitBtn.disabled = false;
          return;
        }
        _showKeyReveal(overlay, json.data);
        _loadPortalData(); // Refresh table in background
      }).catch(function(err) {
        errEl.textContent = 'Request failed: ' + (err && err.message ? err.message : String(err));
        errEl.style.display = 'block';
        submitBtn.textContent = 'Generate API Key';
        submitBtn.disabled = false;
      });
    });
  }

  // ── Key reveal + snippet generator ───────────────────────────────────────
  function _showKeyReveal(overlay, keyData) {
    var body   = overlay.querySelector('#maas-create-body');
    var footer = overlay.querySelector('.maas-modal-footer');
    var titleEl = overlay.querySelector('.maas-modal-title');
    if (titleEl) titleEl.textContent = 'API Key Created';

    if (footer) {
      footer.innerHTML = '<button class="maas-btn maas-btn-primary" id="maas-reveal-done">Done</button>';
      footer.querySelector('#maas-reveal-done').addEventListener('click', function() {
        document.body.contains(overlay) && document.body.removeChild(overlay);
      });
    }

    if (!body) return;

    body.innerHTML = [
      '<div class="maas-key-reveal">',
      '  <div class="maas-key-reveal-label">Your API Key (shown once only)</div>',
      '  <div class="maas-key-reveal-value" id="maas-raw-key-value">' + _maasEsc(keyData.raw_key) + '</div>',
      '  <button class="maas-btn maas-btn-ghost maas-btn-sm" id="maas-copy-raw-key">Copy Key</button>',
      '</div>',
      '<div class="maas-key-warning">',
      '  This key will not be shown again. Copy it now and store it securely in your secrets manager or environment variables.',
      '</div>',
      '<div style="margin-top:20px;">',
      '  <div style="font-family:IBM Plex Mono,monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#6b8099;margin-bottom:10px;">Integration Code</div>',
      '  <div id="maas-snippet-container"></div>',
      '</div>',
    ].join('');

    // Copy key button
    var copyBtn = body.querySelector('#maas-copy-raw-key');
    if (copyBtn && navigator.clipboard) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(keyData.raw_key).then(function() {
          copyBtn.textContent = 'Copied!';
          setTimeout(function() { copyBtn.textContent = 'Copy Key'; }, 2000);
        });
      });
    }

    // Render snippet tabs
    _renderSnippetBlock('maas-snippet-container', keyData.raw_key);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// renderMaaSDocumentation(containerId)
// Renders inline API reference documentation styled as a developer portal.
// ══════════════════════════════════════════════════════════════════════════════
function renderMaaSDocumentation(containerId) {
  _maasInjectStyles();
  var container = document.getElementById(containerId);
  if (!container) { console.error('renderMaaSDocumentation: container not found:', containerId); return; }

  container.innerHTML = [
    '<div class="maas-portal" style="padding:0;">',

    // ── Overview ──────────────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">Overview</div>',
    '  <p class="maas-doc-p">',
    '    MAP-as-a-Service (MaaS) turns the Multidimensional Adherence Parameters (MAP) scoring engine into an embeddable REST API.',
    '    Any EHR, pharmacy information system, government health portal, or mobile health application can call MaaS natively',
    '    without deploying ATLAS infrastructure — just include a Bearer token in the Authorization header.',
    '  </p>',
    '  <p class="maas-doc-p">',
    '    MaaS computes the full MAP triadic score (Architecture, Execution, Context-Guard) and the PE geometric mean,',
    '    classifies the PEACS phenotype server-side, and returns enriched clinical data in every response:',
    '    a 5-level PE tier, a 3-level adherence label, per-domain strength labels with gap-to-optimal,',
    '    the full phenotype clinical narrative, the complete intervention protocol, and a risk flag for EHR alert integration.',
    '    All scoring is authoritative and runs identically to the ATLAS platform.',
    '  </p>',
    '  <div class="maas-doc-h3">Use Cases</div>',
    '  <p class="maas-doc-p">',
    '    <strong style="color:#4e9cf5;">EHR Integration:</strong> Embed MAP scoring into Epic, Cerner, or any HL7-compliant EHR.',
    '    Results appear in the patient record alongside clinical notes.',
    '  </p>',
    '  <p class="maas-doc-p">',
    '    <strong style="color:#a78bfa;">Pharmacy Systems:</strong> Trigger MAP scoring at point-of-dispensing or refill.',
    '    Pharmacists receive phenotype-based intervention guidance inline.',
    '  </p>',
    '  <p class="maas-doc-p">',
    '    <strong style="color:#d4a843;">Government Health Apps:</strong> National health portals and public health agencies',
    '    can integrate MAP scoring into patient-facing apps, call center tools, and population health dashboards.',
    '  </p>',
    '  <p class="maas-doc-p">',
    '    <strong style="color:#10b981;">Research Platforms:</strong> Clinical trial EDC systems, registry platforms, and',
    '    population health tools can batch-score cohorts and receive structured PEACS phenotype assignments.',
    '  </p>',
    '</div>',

    // ── Authentication ────────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">Authentication</div>',
    '  <p class="maas-doc-p">',
    '    All MaaS endpoints require a Bearer token in the <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">Authorization</code> header.',
    '    MaaS API keys are provisioned through the ATLAS admin portal and prefixed <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">maas_live_</code>.',
    '  </p>',
    '  <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px 16px;margin-bottom:12px;">',
    '    <pre style="font-family:IBM Plex Mono,monospace;font-size:0.8rem;color:#e8f0f8;margin:0;">Authorization: Bearer maas_live_YOUR_KEY_HERE</pre>',
    '  </div>',
    '  <p class="maas-doc-p">',
    '    Keys are never stored in plaintext. ATLAS stores only the SHA-256 hash. Upon creation, the raw key is shown once.',
    '    Store it in your environment variables or secrets manager immediately.',
    '  </p>',
    '</div>',

    // ── Endpoints ─────────────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">Endpoints</div>',

    // POST /score
    '  <div class="maas-endpoint-block">',
    '    <div class="maas-endpoint-header">',
    '      <span class="maas-method maas-method-post">POST</span>',
    '      <span class="maas-endpoint-path">/api/maas/v1/score</span>',
    '    </div>',
    '    <div class="maas-endpoint-body">',
    '      <p class="maas-doc-p">Score a single patient. Returns triadic domain scores, PE tier, adherence level, domain analysis, PEACS phenotype with full clinical description and intervention protocol, and a risk flag.</p>',
    '      <div class="maas-doc-h3">Request Body</div>',
    '      <table class="maas-table-sm"><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>',
    '      <tbody>',
    '        <tr><td>responses</td><td>number[8]</td><td>Yes</td><td>Q1-Q7: binary (0 or 1). Q8: ordinal (0, 0.25, 0.5, 0.75, 1.0)</td></tr>',
    '        <tr><td>patient_ref</td><td>string</td><td>No</td><td>Your internal patient identifier (stored, never exposed)</td></tr>',
    '        <tr><td>condition</td><td>string</td><td>No</td><td>Medical condition label (e.g. "Hypertension")</td></tr>',
    '        <tr><td>metadata</td><td>object</td><td>No</td><td>Passthrough metadata object (logged, not scored)</td></tr>',
    '      </tbody></table>',
    '      <div class="maas-doc-h3">Response</div>',
    '      <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px 16px;">',
    '        <pre style="font-family:IBM Plex Mono,monospace;font-size:0.75rem;color:#e8f0f8;margin:0;white-space:pre-wrap;">{\n  "success": true,\n  "assessment_id": "uuid",\n  "scores": {\n    "pe": 0.652,\n    "pe_tier": "moderate",\n    "adherence_level": "low",\n    "architecture": 0.333,\n    "execution": 0.833,\n    "context_guard": 1.000,\n    "additive": 5.5,\n    "low_adherence": true\n  },\n  "domain_analysis": {\n    "architecture":  { "score": 0.333, "label": "weak",   "gap_to_optimal": 0.667 },\n    "execution":     { "score": 0.833, "label": "strong", "gap_to_optimal": 0.167 },\n    "context_guard": { "score": 1.000, "label": "strong", "gap_to_optimal": 0.000 }\n  },\n  "phenotype": {\n    "classification": "Intentional Resistor",\n    "confidence": "high",\n    "dominant_failure": "architecture",\n    "intervention_target": "Belief restructuring and shared decision-making",\n    "description": "The patient holds beliefs that actively conflict with consistent adherence. Non-adherence is intentional and decision-driven, not circumstantial or forgetful. The Architecture domain is the primary failure.",\n    "full_intervention": "Motivational interviewing to explore medication beliefs; collaborative re-framing of perceived necessity and concerns; side-effect discussion and alternative regimen negotiation where appropriate."\n  },\n  "risk_flag": "elevated",\n  "meta": {\n    "instrument": "MAP",\n    "version": "1.1",\n    "atlas_assessment_id": "uuid"\n  }\n}</pre>',
    '      </div>',
    '    </div>',
    '  </div>',

    // POST /batch
    '  <div class="maas-endpoint-block">',
    '    <div class="maas-endpoint-header">',
    '      <span class="maas-method maas-method-post">POST</span>',
    '      <span class="maas-endpoint-path">/api/maas/v1/batch</span>',
    '    </div>',
    '    <div class="maas-endpoint-body">',
    '      <p class="maas-doc-p">Score multiple patients in one call. Maximum 50 assessments per batch. Each item in the batch counts as one call against your rate limit.</p>',
    '      <div class="maas-doc-h3">Request Body</div>',
    '      <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px 16px;margin-bottom:12px;">',
    '        <pre style="font-family:IBM Plex Mono,monospace;font-size:0.75rem;color:#e8f0f8;margin:0;white-space:pre-wrap;">{\n  "assessments": [\n    { "responses": [1,0,1,1,1,0,1,0.75], "patient_ref": "P001", "condition": "T2DM" },\n    { "responses": [0,1,0,0,1,1,0,0.25], "patient_ref": "P002" }\n  ]\n}</pre>',
    '      </div>',
    '      <p class="maas-doc-p">Response is a <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">results[]</code> array with one entry per input assessment, each containing the same schema as <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">/score</code> plus an <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">index</code> field and optional <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">patient_ref</code>. Invalid items return <code style="font-family:IBM Plex Mono,monospace;color:#ef4444;">success: false</code> inline without failing the whole batch.</p>',
    '    </div>',
    '  </div>',

    // GET /status
    '  <div class="maas-endpoint-block">',
    '    <div class="maas-endpoint-header">',
    '      <span class="maas-method maas-method-get">GET</span>',
    '      <span class="maas-endpoint-path">/api/maas/v1/status</span>',
    '    </div>',
    '    <div class="maas-endpoint-body">',
    '      <p class="maas-doc-p">Check your API key status, quota usage, and reset time. Useful for health checks and quota monitoring.</p>',
    '      <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px 16px;">',
    '        <pre style="font-family:IBM Plex Mono,monospace;font-size:0.75rem;color:#e8f0f8;margin:0;white-space:pre-wrap;">{\n  "success": true,\n  "partner_name": "Epic EHR - Memorial Hospital",\n  "partner_type": "ehr",\n  "active": true,\n  "quota": {\n    "rate_limit_per_hour": 1000,\n    "calls_this_hour": 42,\n    "remaining_this_hour": 958,\n    "hour_resets_at": "2026-06-14T15:00:00.000Z"\n  },\n  "total_calls": 18340\n}</pre>',
    '      </div>',
    '    </div>',
    '  </div>',

    '</div>',

    // ── MAP Domain Reference ───────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">MAP Domain Reference</div>',
    '  <p class="maas-doc-p">MAP scores are computed from 8 items spanning three triadic domains.</p>',
    '  <table class="maas-table-sm"><thead><tr><th>Domain</th><th>Items</th><th>Formula</th><th>Range</th></tr></thead>',
    '  <tbody>',
    '    <tr>',
    '      <td style="color:#f59e0b;">Architecture (A)</td>',
    '      <td>Q2, Q3, Q6</td>',
    '      <td>mean(Q2, Q3, Q6)</td>',
    '      <td>0 — 1</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#22d3ee;">Execution (E)</td>',
    '      <td>Q1, Q5, Q8</td>',
    '      <td>mean(Q1, Q5, Q8)</td>',
    '      <td>0 — 1</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#a78bfa;">Context-Guard (Cg)</td>',
    '      <td>Q4, Q7</td>',
    '      <td>max(0.5, 0.5 + 0.5 * mean(Q4, Q7))</td>',
    '      <td>0.5 — 1</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#d4a843;">PE Score</td>',
    '      <td>All</td>',
    '      <td>(A x E x Cg)^(1/3) — geometric mean</td>',
    '      <td>0 — 1</td>',
    '    </tr>',
    '  </tbody></table>',
    '  <p class="maas-doc-p" style="margin-top:14px;">',
    '    Q1-Q7 are binary (0 = non-adherent, 1 = adherent). Q8 is ordinal: Never=1.00, Rarely=0.75, Sometimes=0.50, Often=0.25, All the time=0.00.',
    '    Additive score is the sum of all 8 items (0-8 scale). Low adherence = additive &lt; 6.',
    '  </p>',
    '</div>',

    // ── PEACS Phenotype Reference ──────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">PEACS Phenotype Reference</div>',
    '  <p class="maas-doc-p">Phenotypes are classified in priority order. The first matching branch wins.</p>',
    '  <table class="maas-table-sm"><thead><tr><th>Phenotype</th><th>Trigger Condition</th><th>Primary Signal</th></tr></thead>',
    '  <tbody>',
    '    <tr>',
    '      <td style="color:#d4a843;">Optimistic Stopper</td>',
    '      <td>Architecture &lt; 0.5 AND additive &ge; 5</td>',
    '      <td>Patient was adherent but is intentionally stopping</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#f59e0b;">Intentional Resistor</td>',
    '      <td>Architecture &lt; 0.5 AND architecture is minimum domain</td>',
    '      <td>Belief-driven non-adherence; decision-based, not forgetfulness</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#22d3ee;">Routine Forgetter</td>',
    '      <td>Execution &lt; 0.5 AND execution is minimum domain</td>',
    '      <td>Behavioral reliability failure; forgetfulness and inconsistent timing</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#a78bfa;">Situational Skipper</td>',
    '      <td>ctx_raw &lt; 0.6 AND context_guard is minimum domain</td>',
    '      <td>Environmental or logistical barriers; access, cost, or social friction</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#ef4444;">Side-Effect Avoider</td>',
    '      <td>Q4=0 AND Q7=0 AND architecture &lt; 0.7 AND execution &lt; 0.7</td>',
    '      <td>Avoidance driven by medication experience or side effects</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#6b8099;">Balanced Low</td>',
    '      <td>low_adherence = true, no single dominant domain</td>',
    '      <td>Globally reduced adherence across all three domains</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="color:#10b981;">Adequate Adherent</td>',
    '      <td>None of the above match</td>',
    '      <td>Adequate or optimal adherence across all domains</td>',
    '    </tr>',
    '  </tbody></table>',
    '</div>',

    // ── Rate Limits ────────────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">Rate Limits and Quotas</div>',
    '  <p class="maas-doc-p">',
    '    Each API key has a configurable rate limit enforced using a sliding 1-hour window tracked in ATLAS D1.',
    '    The default limit is 1,000 calls per hour. Batch calls count as N calls (one per assessment in the batch).',
    '  </p>',
    '  <table class="maas-table-sm"><thead><tr><th>Plan</th><th>Default Limit</th><th>Notes</th></tr></thead>',
    '  <tbody>',
    '    <tr><td>Standard</td><td>1,000 / hour</td><td>Default for all new integrations</td></tr>',
    '    <tr><td>Research</td><td>5,000 / hour</td><td>Available on request for academic and government partners</td></tr>',
    '    <tr><td>Enterprise</td><td>Up to 100,000 / hour</td><td>Hospital systems and national health agencies</td></tr>',
    '  </tbody></table>',
    '  <p class="maas-doc-p" style="margin-top:12px;">',
    '    When a rate limit is exceeded, the API returns HTTP 429 with a JSON error body including the reset timestamp.',
    '    Check the <code style="font-family:IBM Plex Mono,monospace;color:#4e9cf5;">GET /status</code> endpoint to monitor remaining quota before bulk calls.',
    '  </p>',
    '</div>',

    // ── FHIR Compatibility ─────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">FHIR Compatibility</div>',
    '  <div class="maas-fhir-note">',
    '    <strong>FHIR R4 Observation Mapping:</strong> MaaS responses can be mapped directly to FHIR R4',
    '    <code style="font-family:IBM Plex Mono,monospace;color:#a78bfa;">Observation</code> resources.',
    '    The PE score maps to <code style="font-family:IBM Plex Mono,monospace;color:#a78bfa;">Observation.valueQuantity</code>,',
    '    domain scores map to <code style="font-family:IBM Plex Mono,monospace;color:#a78bfa;">Observation.component[]</code>,',
    '    and the PEACS phenotype maps to <code style="font-family:IBM Plex Mono,monospace;color:#a78bfa;">Observation.interpretation</code>.',
    '    See <a href="javascript:void(0)" onclick="typeof renderFHIRExportPanel===\'function\'&&renderFHIRExportPanel(\'fhir-export-container\')">fhir-export.js</a>',
    '    for the full FHIR export module.',
    '  </div>',
    '</div>',

    // ── Error Codes ────────────────────────────────────────────────────────
    '<div class="maas-section maas-doc-section">',
    '  <div class="maas-doc-h2">Error Codes</div>',
    '  <table class="maas-table-sm"><thead><tr><th>Status</th><th>Code</th><th>Cause</th><th>Resolution</th></tr></thead>',
    '  <tbody>',
    '    <tr>',
    '      <td><span class="maas-error-code maas-error-401">401</span></td>',
    '      <td>Invalid or missing API key</td>',
    '      <td>Bearer token is absent, malformed, or revoked</td>',
    '      <td>Check Authorization header format: <code style="font-family:IBM Plex Mono,monospace;">Bearer maas_live_...</code></td>',
    '    </tr>',
    '    <tr>',
    '      <td><span class="maas-error-code maas-error-429">429</span></td>',
    '      <td>Rate limit exceeded</td>',
    '      <td>Calls this hour have reached the per-key limit</td>',
    '      <td>Wait for the hour window to reset, or contact admin to increase rate limit</td>',
    '    </tr>',
    '    <tr>',
    '      <td><span class="maas-error-code maas-error-422">422</span></td>',
    '      <td>Validation failure</td>',
    '      <td>responses[] values are out of range or wrong type</td>',
    '      <td>Q1-Q7 must be 0 or 1. Q8 must be 0, 0.25, 0.5, 0.75, or 1.0. Array length must be exactly 8.</td>',
    '    </tr>',
    '    <tr>',
    '      <td><span class="maas-error-code maas-error-400">400</span></td>',
    '      <td>Malformed request</td>',
    '      <td>JSON body is missing, invalid, or lacks the responses field</td>',
    '      <td>Ensure Content-Type is application/json and body is valid JSON with a responses[] key</td>',
    '    </tr>',
    '    <tr>',
    '      <td><span class="maas-error-code maas-error-500">500</span></td>',
    '      <td>Internal server error</td>',
    '      <td>Unexpected platform error</td>',
    '      <td>Retry with exponential backoff. If persistent, contact ATLAS support.</td>',
    '    </tr>',
    '  </tbody></table>',
    '  <p class="maas-doc-p" style="margin-top:14px;">',
    '    All error responses follow the same envelope: <code style="font-family:IBM Plex Mono,monospace;color:#ef4444;">{ "ok": false, "error": "...", "detail": ..., "ts": ... }</code>',
    '  </p>',
    '</div>',

    '</div>', // .maas-portal
  ].join('\n');
}

window.renderMaaSPortal = renderMaaSPortal;
