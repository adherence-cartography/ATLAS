'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// MAP ASSESSMENT MODULE — ATLAS v8.7.0
// Multidimensional Adherence Parameters (MAP) Instrument
// Created by Philip Morisky — next-generation adherence science tool
//
// TRIADIC scoring model: Architecture x Execution x Context-Guard
// PE = (A * E * Cg)^(1/3) — geometric mean, weakest domain governs outcome
//
// Global scope pattern — no imports/exports.
// All functions are attached to window implicitly via global declarations.
// ══════════════════════════════════════════════════════════════════════════════

// ── MAP Design Tokens ─────────────────────────────────────────────────────────
// Matches ATLAS platform token set exactly.
// --ink:#080e1a  --surface:#0d1525  --card:#111d30  --border:rgba(255,255,255,0.07)
// --bright:#e8f0f8  --muted:#6b8099  --base:#4e9cf5  --pe:#d4a843
// Domain accent colors: amber=Architecture, cyan=Execution, purple=Context-Guard

var MAP_COLORS = {
  pe:           '#d4a843',
  architecture: '#f59e0b',
  execution:    '#22d3ee',
  context:      '#a78bfa',
  surface:      '#0d1525',
  card:         '#111d30',
  border:       'rgba(255,255,255,0.07)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  ink:          '#080e1a',
};

// ── Item definitions — MAP instrument (not MMAS-8) ───────────────────────────
// Architecture (A)   = mean(Q2, Q3, Q6)   — intentional adherence decisions
// Execution (E)      = mean(Q1, Q5, Q8)   — routine, habit, memory
// Context-Guard (Cg) = 0.5 + 0.5 * mean(Q4, Q7), floored at 0.5 — barriers
// Q2 and Q3 use a 14-day rolling anchor for longitudinal independence.
var MAP_QUESTIONS = [
  {
    id: 'q1', domain: 'execution', label: 'E',
    text: 'Are there times when you forget to take your medications?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q2', domain: 'architecture', label: 'A',
    text: 'In the past two weeks, have there been times when you chose to skip a dose (for example, because of side effects, cost, or feeling better)?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q3', domain: 'architecture', label: 'A',
    text: 'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q4', domain: 'context', label: 'C',
    text: 'When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q5', domain: 'execution', label: 'E',
    text: 'Were you able to take your last dose as directed?',
    type: 'binary',
    coding: { Yes: 1, No: 0 },
  },
  {
    id: 'q6', domain: 'architecture', label: 'A',
    text: 'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q7', domain: 'context', label: 'C',
    text: 'Does keeping up with your medication routine feel like a big challenge in your everyday life?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q8', domain: 'execution', label: 'E',
    text: 'In a typical week, how often do you have trouble taking all your medications as prescribed?',
    type: 'ordinal',
    options: [
      { label: 'Never',        value: 1.00 },
      { label: 'Rarely',       value: 0.75 },
      { label: 'Sometimes',    value: 0.50 },
      { label: 'Often',        value: 0.25 },
      { label: 'All the time', value: 0.00 },
    ],
  },
];

// ── Domain lookup maps ─────────────────────────────────────────────────────────
var MAP_INTERVENTION_TARGETS = {
  architecture: 'Belief restructuring and shared decision-making',
  execution:    'Behavioral cue systems and routine anchoring',
  context_guard:'Environmental barrier reduction and social support activation',
};

// ══════════════════════════════════════════════════════════════════════════════
// scoreMAP(responses)
// Pure function. Takes array of 8 values [q1..q8].
// Q1-Q7: binary adherent=1, non-adherent=0
// Q8: ordinal value (Never=1.00, Rarely=0.75, Sometimes=0.50, Often=0.25, All_the_time=0.00)
// Returns triadic score object.
// ══════════════════════════════════════════════════════════════════════════════
function scoreMAP(responses) {
  if (!Array.isArray(responses) || responses.length < 8) {
    throw new Error('scoreMAP: requires array of 8 responses [q1..q8]');
  }

  var q1 = parseFloat(responses[0]);
  var q2 = parseFloat(responses[1]);
  var q3 = parseFloat(responses[2]);
  var q4 = parseFloat(responses[3]);
  var q5 = parseFloat(responses[4]);
  var q6 = parseFloat(responses[5]);
  var q7 = parseFloat(responses[6]);
  var q8 = parseFloat(responses[7]);

  // Validate inputs
  [q1,q2,q3,q4,q5,q6,q7].forEach(function(v, i) {
    if (isNaN(v) || v < 0 || v > 1) {
      throw new Error('scoreMAP: Q' + (i+1) + ' must be 0 or 1, got: ' + responses[i]);
    }
  });
  if (isNaN(q8) || q8 < 0 || q8 > 1) {
    throw new Error('scoreMAP: Q8 must be 0-1 ordinal value, got: ' + responses[7]);
  }

  // Domain means
  // Architecture (A) = mean(Q2, Q3, Q6)
  var architecture = (q2 + q3 + q6) / 3;

  // Execution (E) = mean(Q1, Q5, Q8)
  var execution = (q1 + q5 + q8) / 3;

  // Context-Guard (Cg) = 0.5 + 0.5 * mean(Q4, Q7), floored at 0.5
  var ctx_raw = (q4 + q7) / 2;
  var context_guard = Math.max(0.5, 0.5 + 0.5 * ctx_raw);

  // PE score = geometric mean of the three domains
  var pe = Math.pow(architecture * execution * context_guard, 1/3);

  // Additive score: sum of all 8 items (0-8 scale)
  var additive = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8;

  var low_adherence = additive < 6;

  // Dominant failure = whichever domain is lowest
  var domains = { architecture: architecture, execution: execution, context_guard: context_guard };
  var dominant_failure = Object.keys(domains).reduce(function(min, key) {
    return domains[key] < domains[min] ? key : min;
  });

  // If all domains are equal (balanced), mark context_guard as dominant only if truly low;
  // otherwise default to architecture as intervention priority
  if (domains.architecture === domains.execution && domains.execution === domains.context_guard) {
    dominant_failure = low_adherence ? 'architecture' : 'balanced';
  }

  return {
    pe:               parseFloat(pe.toFixed(4)),
    architecture:     parseFloat(architecture.toFixed(4)),
    execution:        parseFloat(execution.toFixed(4)),
    context_guard:    parseFloat(context_guard.toFixed(4)),
    ctx_raw:          parseFloat(ctx_raw.toFixed(4)),
    additive:         parseFloat(additive.toFixed(2)),
    low_adherence:    low_adherence,
    dominant_failure: dominant_failure === 'balanced' ? 'balanced' : dominant_failure,
    intervention_target: MAP_INTERVENTION_TARGETS[dominant_failure] ||
                         MAP_INTERVENTION_TARGETS['architecture'],
    items: { q1:q1, q2:q2, q3:q3, q4:q4, q5:q5, q6:q6, q7:q7, q8:q8 },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// classifyPEACS(mapResult)
// Takes scoreMAP output, returns PEACS phenotype classification.
//
// Classification logic (order matters — evaluated top to bottom):
//   Optimistic Stopper:   Architecture < 0.5 AND additive >= 5 (was adherent, stopping)
//   Intentional Resistor: Architecture < 0.5 AND architecture is the minimum domain
//   Routine Forgetter:    Execution < 0.5 AND execution is the minimum domain
//   Situational Skipper:  ctx_raw < 0.6 AND context_guard is minimum (before Cg floor applied)
//   Side-Effect Avoider:  mixed low scores with Q4/Q7 pattern suggesting barrier/side-effect
//   Balanced Low:         low_adherence but no single dominant failure
// ══════════════════════════════════════════════════════════════════════════════
function classifyPEACS(mapResult) {
  if (!mapResult || typeof mapResult.pe === 'undefined') {
    throw new Error('classifyPEACS: requires scoreMAP output object');
  }

  var arch = mapResult.architecture;
  var exec = mapResult.execution;
  var cg   = mapResult.context_guard;
  var ctx_raw = typeof mapResult.ctx_raw === 'number' ? mapResult.ctx_raw : cg;
  var add  = mapResult.additive;
  var fail = mapResult.dominant_failure;
  var items = mapResult.items || {};

  // Helper: is this domain the sole minimum?
  function isMinDomain(domain) {
    var vals = { architecture: arch, execution: exec, context_guard: cg };
    var minVal = Math.min(arch, exec, cg);
    return vals[domain] === minVal;
  }

  // Optimistic Stopper: Arch < 0.5 but overall additive score >= 5
  // Profile: patient WAS adherent, now reducing/stopping because symptoms resolved
  if (arch < 0.5 && add >= 5) {
    return {
      phenotype: 'Optimistic Stopper',
      confidence: arch < 0.35 ? 'high' : 'moderate',
      description: 'The patient shows adequate behavioral adherence but holds beliefs that ' +
        'medication may no longer be necessary. Symptom resolution or perceived cure is ' +
        'likely driving intentional dose reduction or planned discontinuation.',
      intervention_protocol: 'Education on illness chronicity; shared goal-setting on ' +
        'long-term medication purpose; re-evaluation of treatment beliefs; ' +
        'structured follow-up to monitor intentional stopping behavior.',
    };
  }

  // Intentional Resistor: Architecture failure is dominant
  if (arch < 0.5 && isMinDomain('architecture')) {
    return {
      phenotype: 'Intentional Resistor',
      confidence: arch < 0.33 ? 'high' : 'moderate',
      description: 'The patient holds beliefs that actively conflict with consistent ' +
        'adherence. Non-adherence is intentional and decision-driven, not circumstantial ' +
        'or forgetful. The Architecture domain is the primary failure.',
      intervention_protocol: 'Motivational interviewing to explore medication beliefs; ' +
        'collaborative re-framing of perceived necessity and concerns; ' +
        'side-effect discussion and alternative regimen negotiation where appropriate.',
    };
  }

  // Routine Forgetter: Execution failure is dominant
  if (exec < 0.5 && isMinDomain('execution')) {
    return {
      phenotype: 'Routine Forgetter',
      confidence: exec < 0.33 ? 'high' : 'moderate',
      description: 'The patient has adequate beliefs about medication but consistently ' +
        'fails to execute the daily routine. Forgetfulness, inconsistent timing, and ' +
        'difficulty remembering are the primary barriers.',
      intervention_protocol: 'Behavioral cue strategies (alarms, pill organizers, ' +
        'habit stacking with existing routines); pharmacy-initiated blister packs; ' +
        'caregiver or digital reminder integration.',
    };
  }

  // Situational Skipper: Context-Guard failure (use ctx_raw before floor to detect real friction)
  // ctx_raw < 0.6 = meaningful environmental burden even if Cg floor keeps it at 0.5
  if (ctx_raw < 0.6 && isMinDomain('context_guard')) {
    return {
      phenotype: 'Situational Skipper',
      confidence: ctx_raw < 0.4 ? 'high' : 'moderate',
      description: 'The patient encounters significant environmental, social, or logistical ' +
        'barriers that interrupt adherence. Medication access, cost, side-effect interference, ' +
        'or social context disrupts an otherwise motivated patient.',
      intervention_protocol: 'Barrier mapping and social support assessment; ' +
        'pharmacy access programs; cost-assistance navigation; ' +
        'regimen simplification to reduce situational demand; peer support linkage.',
    };
  }

  // Side-Effect Avoider: Q4 (cost/access/life) and Q7 (side effects/social) both low,
  // with mixed domain profile suggesting the avoidance is driven by medication experience
  var q4val = items.q4 !== undefined ? items.q4 : 1;
  var q7val = items.q7 !== undefined ? items.q7 : 1;
  if (q4val === 0 && q7val === 0 && arch < 0.7 && exec < 0.7) {
    return {
      phenotype: 'Side-Effect Avoider',
      confidence: 'moderate',
      description: 'The patient experiences both environmental friction (Q4) and side-effect ' +
        'or social interference (Q7) alongside reduced medication beliefs. The non-adherence ' +
        'pattern is consistent with avoidance driven by medication experience.',
      intervention_protocol: 'Side-effect review and symptom management strategies; ' +
        'regimen modification discussion with prescriber; ' +
        'patient education on managing expected effects; barrier support programs.',
    };
  }

  // Balanced Low: low adherence but no single dominant failure
  if (mapResult.low_adherence) {
    return {
      phenotype: 'Balanced Low',
      confidence: 'low',
      description: 'The patient shows globally reduced adherence across all three MAP domains ' +
        'without a single dominant failure pattern. Comprehensive intervention addressing ' +
        'beliefs, routine, and context simultaneously is indicated.',
      intervention_protocol: 'Holistic adherence review; multi-component intervention ' +
        'addressing beliefs, behavioral routines, and environmental barriers in parallel; ' +
        'close monitoring and reassessment after initial intervention.',
    };
  }

  // Adequate adherence
  return {
    phenotype: 'Adequate Adherent',
    confidence: mapResult.pe >= 0.85 ? 'high' : 'moderate',
    description: 'The patient demonstrates adequate adherence across Architecture, Execution, ' +
      'and Context-Guard domains. PE score indicates ' +
      (mapResult.pe >= 0.85 ? 'optimal' : 'good') + ' adherence health.',
    intervention_protocol: 'Maintain current regimen and reinforce adherence behaviors at ' +
      'routine follow-up. Schedule reassessment at next clinical visit.',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// renderMAPAssessmentUI(containerId, options)
// Renders the full 8-question MAP assessment form inside the given container.
// Computes and displays PE, domain scores, and PEACS phenotype in real time.
//
// options: {
//   mode: 'clinical|pharmacy|self|chw'  (default 'clinical')
//   lang: 'en'                          (default 'en', i18n hook)
//   conditionContext: ''                (optional condition/disease context label)
//   onComplete: function(result) {}     (called when form is submitted)
// }
// ══════════════════════════════════════════════════════════════════════════════
function renderMAPAssessmentUI(containerId, options) {
  var opts = options || {};
  var mode  = opts.mode  || 'clinical';
  var lang  = opts.lang  || 'en';
  var condCtx  = opts.conditionContext || '';
  var onComplete = opts.onComplete || null;

  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderMAPAssessmentUI: container not found:', containerId);
    return;
  }

  // State: current responses keyed by question id
  var _responses = {};
  var _submitted  = false;

  // ── Inject scoped CSS if not already present ─────────────────────────────
  if (!document.getElementById('map-assessment-styles')) {
    var style = document.createElement('style');
    style.id = 'map-assessment-styles';
    style.textContent = [
      // Form wrapper
      '.map-form { font-family: var(--font-body, "IBM Plex Sans"), sans-serif; color: var(--bright, #e8f0f8); }',
      '.map-form-header { margin-bottom: 20px; }',
      '.map-form-title { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.6rem; font-weight: 300; color: var(--bright, #e8f0f8); margin: 0 0 4px; }',
      '.map-form-subtitle { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted, #6b8099); }',

      // Live scorebar cluster
      '.map-live-scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }',
      '@media (max-width: 560px) { .map-live-scores { grid-template-columns: repeat(2, 1fr); } }',
      '.map-score-card { background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 12px 14px; text-align: center; }',
      '.map-score-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted, #6b8099); margin-bottom: 6px; }',
      '.map-score-value { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.6rem; font-weight: 300; line-height: 1; }',
      '.map-score-bar-wrap { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 8px; }',
      '.map-score-bar { height: 3px; border-radius: 2px; transition: width 0.4s cubic-bezier(0.22,1,0.36,1); }',

      // Question cards
      '.map-question { background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; transition: border-color 0.2s; }',
      '.map-question.answered { border-color: rgba(255,255,255,0.14); }',
      '.map-question-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }',
      '.map-domain-badge { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.62rem; letter-spacing: 0.12em; font-weight: 700; padding: 3px 8px; border-radius: 5px; flex-shrink: 0; margin-top: 2px; }',
      '.map-domain-badge.A { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }',
      '.map-domain-badge.E { background: rgba(34,211,238,0.12); color: #22d3ee; border: 1px solid rgba(34,211,238,0.25); }',
      '.map-domain-badge.C { background: rgba(167,139,250,0.12); color: #a78bfa; border: 1px solid rgba(167,139,250,0.25); }',
      '.map-question-text { font-size: 0.95rem; line-height: 1.5; color: var(--bright, #e8f0f8); }',
      '.map-question-num { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; color: var(--muted, #6b8099); flex-shrink: 0; margin-top: 3px; }',

      // Answer options
      '.map-options { display: flex; gap: 8px; flex-wrap: wrap; }',
      '.map-option { display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); transition: background 0.15s, border-color 0.15s; font-size: 0.88rem; color: var(--bright, #e8f0f8); user-select: none; }',
      '.map-option:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }',
      '.map-option.selected { border-color: var(--base, #4e9cf5); background: rgba(78,156,245,0.1); color: var(--base, #4e9cf5); }',
      '.map-option input[type=radio] { display: none; }',

      // Results panel
      '.map-results { margin-top: 24px; background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 12px; overflow: hidden; display: none; }',
      '.map-results.visible { display: block; }',
      '.map-results-header { padding: 20px 22px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-results-title { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.3rem; font-weight: 300; color: var(--bright, #e8f0f8); margin-bottom: 4px; }',

      // PE gauge
      '.map-pe-gauge { display: flex; align-items: flex-end; gap: 6px; padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-pe-num { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 3.8rem; font-weight: 300; color: var(--pe, #d4a843); line-height: 1; }',
      '.map-pe-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted, #6b8099); padding-bottom: 10px; }',

      // Domain triadic breakdown
      '.map-triadic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '@media (max-width: 480px) { .map-triadic { grid-template-columns: 1fr; } }',
      '.map-domain-cell { text-align: center; }',
      '.map-domain-cell-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.63rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted, #6b8099); margin-bottom: 8px; }',
      '.map-domain-cell-value { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 2rem; font-weight: 300; line-height: 1; margin-bottom: 8px; }',
      '.map-domain-track { height: 4px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }',
      '.map-domain-fill { height: 4px; border-radius: 3px; }',

      // PEACS phenotype card
      '.map-phenotype-card { padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-phenotype-tag { display: inline-block; font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; border: 1px solid; margin-bottom: 12px; }',
      '.map-phenotype-desc { font-size: 0.88rem; color: rgba(232,240,248,0.8); line-height: 1.6; margin-bottom: 14px; }',
      '.map-intervention-block { background: rgba(78,156,245,0.06); border: 1px solid rgba(78,156,245,0.15); border-radius: 8px; padding: 14px 16px; }',
      '.map-intervention-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--base, #4e9cf5); margin-bottom: 8px; }',
      '.map-intervention-text { font-size: 0.85rem; color: rgba(232,240,248,0.75); line-height: 1.6; }',

      // Submit area
      '.map-submit-area { padding: 18px 22px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }',
      '.map-submit-btn { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 11px 28px; background: var(--base, #4e9cf5); color: #080e1a; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: opacity 0.2s; }',
      '.map-submit-btn:hover { opacity: 0.88; }',
      '.map-submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }',
      '.map-submit-status { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.72rem; color: var(--muted, #6b8099); }',
      '.map-progress-hint { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; color: var(--muted, #6b8099); margin-bottom: 18px; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Build HTML ──────────────────────────────────────────────────────────────
  var modeLabel = { clinical:'Clinical', pharmacy:'Pharmacy', self:'Self-Report', research:'Research', chw:'Community Health Worker' }[mode] || 'Clinical';

  var html = '<div class="map-form">';
  html += '<div class="map-form-header">';
  html += '<div class="map-form-title">MAP Assessment</div>';
  html += '<div class="map-form-subtitle">Multidimensional Adherence Parameters';
  if (condCtx) html += ' &middot; ' + _mapEsc(condCtx);
  html += ' &middot; ' + modeLabel + ' Mode</div>';
  html += '</div>';

  // Live score display
  html += '<div class="map-live-scores">';
  html += '<div class="map-score-card"><div class="map-score-label">PE Score</div>';
  html += '<div class="map-score-value" id="map-live-pe" style="color:#d4a843;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-pe" style="width:0%;background:#d4a843;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">Architecture</div>';
  html += '<div class="map-score-value" id="map-live-arch" style="color:#f59e0b;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-arch" style="width:0%;background:#f59e0b;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">Execution</div>';
  html += '<div class="map-score-value" id="map-live-exec" style="color:#22d3ee;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-exec" style="width:0%;background:#22d3ee;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">Context-Guard</div>';
  html += '<div class="map-score-value" id="map-live-ctx" style="color:#a78bfa;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-ctx" style="width:0%;background:#a78bfa;"></div></div></div>';
  html += '</div>';

  html += '<div class="map-progress-hint" id="map-progress-hint">Answer all 8 questions to compute live PE score</div>';

  // Question cards
  MAP_QUESTIONS.forEach(function(q, idx) {
    html += '<div class="map-question" id="map-q-card-' + q.id + '">';
    html += '<div class="map-question-header">';
    html += '<span class="map-question-num">Q' + (idx+1) + '</span>';
    html += '<span class="map-domain-badge ' + q.label + '">' + ({A:'Architecture',E:'Execution',C:'Context-Guard'}[q.label]) + '</span>';
    html += '<span class="map-question-text">' + _mapEsc(q.text) + '</span>';
    html += '</div>';

    html += '<div class="map-options">';
    if (q.type === 'binary') {
      Object.keys(q.coding).forEach(function(optLabel) {
        var val = q.coding[optLabel];
        html += '<label class="map-option" id="map-opt-' + q.id + '-' + optLabel + '">';
        html += '<input type="radio" name="map-' + q.id + '" value="' + val + '">';
        html += _mapEsc(optLabel);
        html += '</label>';
      });
    } else {
      // Ordinal Q8
      q.options.forEach(function(opt) {
        html += '<label class="map-option" id="map-opt-' + q.id + '-' + opt.value + '">';
        html += '<input type="radio" name="map-' + q.id + '" value="' + opt.value + '">';
        html += _mapEsc(opt.label);
        html += '</label>';
      });
    }
    html += '</div>';
    html += '</div>';
  });

  // Submit
  html += '<div class="map-submit-area">';
  html += '<button class="map-submit-btn" id="map-submit-btn" disabled>Submit Assessment</button>';
  html += '<span class="map-submit-status" id="map-submit-status"></span>';
  html += '</div>';

  // Results panel
  html += '<div class="map-results" id="map-results-panel">';
  html += '<div class="map-results-header"><div class="map-results-title">Assessment Results</div>';
  html += '<div id="map-results-meta" style="font-family:var(--font-mono,\'IBM Plex Mono\'),monospace;font-size:0.65rem;color:var(--muted,#6b8099);"></div></div>';
  html += '<div class="map-pe-gauge"><div class="map-pe-num" id="map-results-pe">--</div>';
  html += '<div class="map-pe-label">PE Score<br>Geometric Mean</div></div>';
  html += '<div class="map-triadic">';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">Architecture</div>';
  html += '<div class="map-domain-cell-value" id="map-res-arch" style="color:#f59e0b;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-arch-bar" style="width:0%;background:#f59e0b;"></div></div></div>';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">Execution</div>';
  html += '<div class="map-domain-cell-value" id="map-res-exec" style="color:#22d3ee;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-exec-bar" style="width:0%;background:#22d3ee;"></div></div></div>';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">Context-Guard</div>';
  html += '<div class="map-domain-cell-value" id="map-res-ctx" style="color:#a78bfa;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-ctx-bar" style="width:0%;background:#a78bfa;"></div></div></div>';
  html += '</div>';
  html += '<div class="map-phenotype-card" id="map-phenotype-block"></div>';
  html += '<div style="padding:0 22px 20px;font-family:var(--font-mono,\'IBM Plex Mono\'),monospace;font-size:0.68rem;color:var(--muted,#6b8099);"></div>';
  html += '</div>';

  html += '</div>'; // .map-form

  container.innerHTML = html;

  // ── Wire up interactivity ─────────────────────────────────────────────────

  function _updateLiveScores() {
    var answered = Object.keys(_responses).length;
    var total    = MAP_QUESTIONS.length;
    var hint = document.getElementById('map-progress-hint');
    var submitBtn = document.getElementById('map-submit-btn');

    if (answered < total) {
      if (hint) hint.textContent = answered + ' / ' + total + ' answered';
      if (submitBtn) submitBtn.disabled = true;
    } else {
      if (hint) hint.textContent = 'All questions answered. Review scores before submitting.';
      if (submitBtn) submitBtn.disabled = _submitted;
    }

    // Need at least enough answers to compute partial domain means
    var responses = MAP_QUESTIONS.map(function(q) { return _responses[q.id]; });
    var allAnswered = responses.every(function(v) { return typeof v === 'number'; });

    if (!allAnswered) {
      // Partial: compute what we can
      _computePartialLive(responses);
      return;
    }

    try {
      var result = scoreMAP(responses);
      _setLiveDisplay(result.pe, result.architecture, result.execution, result.context_guard);
    } catch(e) {
      // Ignore scoring errors during partial input
    }
  }

  function _computePartialLive(responses) {
    // Architecture: Q2(idx1), Q3(idx2), Q6(idx5)
    var archVals = [responses[1], responses[2], responses[5]].filter(function(v) { return typeof v === 'number'; });
    var execVals = [responses[0], responses[4], responses[7]].filter(function(v) { return typeof v === 'number'; });
    var ctxVals  = [responses[3], responses[6]].filter(function(v) { return typeof v === 'number'; });

    var arch = archVals.length ? archVals.reduce(function(s,v){return s+v;},0)/archVals.length : null;
    var exec = execVals.length ? execVals.reduce(function(s,v){return s+v;},0)/execVals.length : null;
    var ctx  = ctxVals.length  ? Math.max(0.5, 0.5 + 0.5 * (ctxVals.reduce(function(s,v){return s+v;},0)/ctxVals.length)) : null;

    var pe = (arch !== null && exec !== null && ctx !== null)
      ? Math.pow(arch * exec * ctx, 1/3) : null;

    _setLiveDisplay(pe, arch, exec, ctx);
  }

  function _setLiveDisplay(pe, arch, exec, ctx) {
    var peEl   = document.getElementById('map-live-pe');
    var archEl = document.getElementById('map-live-arch');
    var execEl = document.getElementById('map-live-exec');
    var ctxEl  = document.getElementById('map-live-ctx');
    var peBar   = document.getElementById('map-bar-pe');
    var archBar = document.getElementById('map-bar-arch');
    var execBar = document.getElementById('map-bar-exec');
    var ctxBar  = document.getElementById('map-bar-ctx');

    if (peEl)   peEl.textContent   = pe   !== null ? pe.toFixed(3)   : '--';
    if (archEl) archEl.textContent = arch !== null ? arch.toFixed(3) : '--';
    if (execEl) execEl.textContent = exec !== null ? exec.toFixed(3) : '--';
    if (ctxEl)  ctxEl.textContent  = ctx  !== null ? ctx.toFixed(3)  : '--';

    if (peBar)   peBar.style.width   = pe   !== null ? (pe   * 100).toFixed(1) + '%' : '0%';
    if (archBar) archBar.style.width = arch !== null ? (arch * 100).toFixed(1) + '%' : '0%';
    if (execBar) execBar.style.width = exec !== null ? (exec * 100).toFixed(1) + '%' : '0%';
    if (ctxBar)  ctxBar.style.width  = ctx  !== null ? (ctx  * 100).toFixed(1) + '%' : '0%';
  }

  // Attach radio listeners
  MAP_QUESTIONS.forEach(function(q, idx) {
    var inputs = container.querySelectorAll('input[name="map-' + q.id + '"]');
    inputs.forEach(function(input) {
      input.addEventListener('change', function() {
        _responses[q.id] = parseFloat(this.value);

        // Highlight selected option, clear others
        var siblings = container.querySelectorAll('input[name="map-' + q.id + '"]');
        siblings.forEach(function(sib) {
          var lbl = sib.closest('.map-option');
          if (lbl) lbl.classList.toggle('selected', sib === input);
        });

        // Mark question card as answered
        var card = document.getElementById('map-q-card-' + q.id);
        if (card) card.classList.add('answered');

        _updateLiveScores();
      });
    });
  });

  // Submit button
  var submitBtn = document.getElementById('map-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (_submitted) return;
      var responses = MAP_QUESTIONS.map(function(q) { return _responses[q.id]; });
      var allAnswered = responses.every(function(v) { return typeof v === 'number'; });
      if (!allAnswered) {
        var status = document.getElementById('map-submit-status');
        if (status) status.textContent = 'Please answer all 8 questions before submitting.';
        return;
      }

      _submitted = true;
      submitBtn.disabled = true;

      var result = scoreMAP(responses);
      var phenotype = classifyPEACS(result);

      _renderResults(result, phenotype);

      if (typeof onComplete === 'function') {
        onComplete({
          responses: responses,
          mapResult: result,
          phenotype: phenotype,
          mode: mode,
          conditionContext: condCtx,
          timestamp: Date.now(),
        });
      }
    });
  }

  function _renderResults(result, phenotype) {
    var panel = document.getElementById('map-results-panel');
    if (!panel) return;
    panel.classList.add('visible');

    // Scroll results into view
    setTimeout(function() {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    // PE display
    var peEl = document.getElementById('map-results-pe');
    if (peEl) { peEl.textContent = result.pe.toFixed(4); peEl.style.color = _mapPeColor(result.pe); }

    // Meta
    var metaEl = document.getElementById('map-results-meta');
    if (metaEl) {
      metaEl.textContent = 'Additive: ' + result.additive.toFixed(2) + ' / 8' +
        (result.low_adherence ? ' · Low Adherence' : '') +
        ' · Dominant Failure: ' + (result.dominant_failure || 'balanced');
    }

    // Triadic domain bars
    function _setDomainResult(valId, barId, value) {
      var el  = document.getElementById(valId);
      var bar = document.getElementById(barId);
      if (el)  el.textContent  = value.toFixed(4);
      if (bar) bar.style.width = (value * 100).toFixed(1) + '%';
    }
    _setDomainResult('map-res-arch', 'map-res-arch-bar', result.architecture);
    _setDomainResult('map-res-exec', 'map-res-exec-bar', result.execution);
    _setDomainResult('map-res-ctx',  'map-res-ctx-bar',  result.context_guard);

    // PEACS phenotype block
    var pBlock = document.getElementById('map-phenotype-block');
    if (pBlock) {
      var confColor = { high: '#10b981', moderate: '#f59e0b', low: '#6b8099' }[phenotype.confidence] || '#6b8099';
      var tagStyle  = 'color:' + confColor + ';border-color:' + confColor + ';background:' +
        confColor.replace(/^#/, 'rgba(') + ',0.08)';

      // Build phenotype content safely
      pBlock.innerHTML = '';

      var tagEl = document.createElement('div');
      tagEl.className = 'map-phenotype-tag';
      tagEl.style.cssText = tagStyle;
      tagEl.textContent = phenotype.phenotype + ' (' + phenotype.confidence + ' confidence)';
      pBlock.appendChild(tagEl);

      var descEl = document.createElement('div');
      descEl.className = 'map-phenotype-desc';
      descEl.textContent = phenotype.description;
      pBlock.appendChild(descEl);

      if (phenotype.intervention_protocol) {
        var intBlock = document.createElement('div');
        intBlock.className = 'map-intervention-block';
        var intLabel = document.createElement('div');
        intLabel.className = 'map-intervention-label';
        intLabel.textContent = 'Intervention Protocol';
        var intText = document.createElement('div');
        intText.className = 'map-intervention-text';
        intText.textContent = phenotype.intervention_protocol;
        intBlock.appendChild(intLabel);
        intBlock.appendChild(intText);
        pBlock.appendChild(intBlock);
      }
    }

    // Update submit button to completion state
    var btn = document.getElementById('map-submit-btn');
    if (btn) {
      btn.textContent = 'Assessment Recorded';
      btn.style.background = '#10b981';
    }
    var status = document.getElementById('map-submit-status');
    if (status) status.textContent = 'Submitted ' + new Date().toLocaleTimeString();
  }
}

// ── PE color interpolation (matches PEACS peColor pattern) ─────────────────
function _mapPeColor(pe) {
  if (!pe || pe <= 0) return '#ef4444';
  if (pe >= 1)        return '#10b981';
  if (pe <= 0.25) return _mapLerpHex('#ef4444', '#f59e0b', pe / 0.25);
  if (pe <= 0.5)  return _mapLerpHex('#f59e0b', '#eab308', (pe - 0.25) / 0.25);
  if (pe <= 0.75) return _mapLerpHex('#eab308', '#3b82f6', (pe - 0.5)  / 0.25);
  return _mapLerpHex('#3b82f6', '#10b981', (pe - 0.75) / 0.25);
}
function _mapLerpHex(a, b, t) {
  var ha = parseInt(a.slice(1), 16), hb = parseInt(b.slice(1), 16);
  var ar = ha >> 16, ag = (ha >> 8) & 255, ab = ha & 255;
  var br = hb >> 16, bg = (hb >> 8) & 255, bb = hb & 255;
  return '#' + [
    Math.round(ar + (br-ar)*t),
    Math.round(ag + (bg-ag)*t),
    Math.round(ab + (bb-ab)*t)
  ].map(function(v) { return v.toString(16).padStart(2,'0'); }).join('');
}

// ── XSS-safe text escaping for HTML insertion ───────────────────────────────
function _mapEsc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ══════════════════════════════════════════════════════════════════════════════
// submitMAPAssessment(data, workspaceKey)
// Saves MAP assessment to Firebase /map_assessments/{id} AND to D1 via the
// Cloudflare Worker API endpoint (/api/v1/map/submit).
// Returns a Promise resolving to the saved record with computed scores.
//
// data: {
//   responses:        [q1..q8] array
//   patient_number:   string (optional)
//   condition:        string (optional)
//   medication:       string (optional)
//   country:          string (optional)
//   country_iso2:     string (optional)
//   language:         string (optional)
//   session_id:       string (optional)
//   assessor_id:      string (optional)
//   assessment_mode:  string (optional, default 'clinical')
//   conditionContext: string (optional)
//   latitude:         number (optional)
//   longitude:        number (optional)
//   city:             string (optional)
// }
// ══════════════════════════════════════════════════════════════════════════════
function submitMAPAssessment(data, workspaceKey) {
  return new Promise(function(resolve, reject) {
    if (!data || !Array.isArray(data.responses) || data.responses.length < 8) {
      return reject(new Error('submitMAPAssessment: data.responses must be array of 8 values'));
    }
    if (!workspaceKey) {
      return reject(new Error('submitMAPAssessment: workspaceKey is required'));
    }

    var mapResult;
    try {
      mapResult = scoreMAP(data.responses);
    } catch(e) {
      return reject(new Error('submitMAPAssessment: scoring failed: ' + e.message));
    }

    var phenotype = classifyPEACS(mapResult);

    var now = Date.now();
    var id  = 'map_' + now + '_' + Math.random().toString(36).slice(2, 9);

    var record = {
      id:               id,
      instrument_type:  'map',
      workspace_key:    workspaceKey,
      // Raw items
      q1: mapResult.items.q1, q2: mapResult.items.q2, q3: mapResult.items.q3,
      q4: mapResult.items.q4, q5: mapResult.items.q5, q6: mapResult.items.q6,
      q7: mapResult.items.q7, q8: mapResult.items.q8,
      // MAP scores
      arch_score:       mapResult.architecture,
      exec_score:       mapResult.execution,
      ctx_score:        mapResult.context_guard,
      pe_score:         mapResult.pe,
      additive_score:   mapResult.additive,
      low_adherence:    mapResult.low_adherence,
      dominant_failure: mapResult.dominant_failure,
      peacs_phenotype:  phenotype.phenotype,
      phenotype_confidence: phenotype.confidence,
      // Metadata
      patient_number:   data.patient_number   || null,
      condition:        data.condition        || data.conditionContext || null,
      medication:       data.medication       || null,
      country:          data.country          || null,
      country_iso2:     data.country_iso2     || null,
      language:         data.language         || 'en',
      assessment_mode:  data.assessment_mode  || 'clinical',
      session_id:       data.session_id       || null,
      assessor_id:      data.assessor_id      || null,
      latitude:         data.latitude         || null,
      longitude:        data.longitude        || null,
      city:             data.city             || null,
      timestamp:        now,
      submitted_at:     new Date(now).toISOString(),
      tool:             'map',
      // Embedded phenotype for Firebase query convenience
      phenotype_data:   phenotype,
    };

    // 1. Save to Firebase
    var fbSavePromise = new Promise(function(res, rej) {
      if (typeof database === 'undefined' || !database) {
        console.warn('submitMAPAssessment: Firebase database not available, skipping Firebase save');
        res(null);
        return;
      }
      database.ref('map_assessments/' + id).set(record, function(err) {
        if (err) {
          console.warn('submitMAPAssessment: Firebase save failed:', err);
          res(null); // Non-fatal: D1 is the authoritative store
        } else {
          res(record);
        }
      });
    });

    // 2. Save to D1 via Worker API
    var apiBase = (typeof ATLAS_API_BASE !== 'undefined' ? ATLAS_API_BASE : '') || '/api/v1';
    var d1SavePromise = new Promise(function(res, rej) {
      // Get Firebase auth token for API call
      var authPromise;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        authPromise = firebase.auth().currentUser.getIdToken();
      } else {
        authPromise = Promise.resolve(null);
      }

      authPromise.then(function(token) {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        return fetch(apiBase + '/map/submit', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            workspace_key:    workspaceKey,
            q1: record.q1, q2: record.q2, q3: record.q3, q4: record.q4,
            q5: record.q5, q6: record.q6, q7: record.q7, q8: record.q8,
            arch_score:       record.arch_score,
            exec_score:       record.exec_score,
            ctx_score:        record.ctx_score,
            pe_score:         record.pe_score,
            peacs_phenotype:  record.peacs_phenotype,
            patient_number:   record.patient_number,
            condition:        record.condition,
            medication:       record.medication,
            country:          record.country,
            country_iso2:     record.country_iso2,
            language:         record.language,
            assessment_mode:  record.assessment_mode,
            session_id:       record.session_id,
            assessor_id:      record.assessor_id,
          }),
        });
      }).then(function(resp) {
        if (!resp) { res(null); return; }
        return resp.json().then(function(json) {
          if (json && json.ok) { res(json.data); }
          else {
            console.warn('submitMAPAssessment: D1 save returned error:', json && json.error);
            res(null);
          }
        });
      }).catch(function(err) {
        console.warn('submitMAPAssessment: D1 API call failed:', err);
        res(null); // Non-fatal: Firebase already has the record
      });
    });

    // 3. Update longitudinal session if session_id is provided
    var sessionUpdatePromise = Promise.resolve(null);
    if (record.session_id && typeof database !== 'undefined' && database) {
      sessionUpdatePromise = _updateMAPLongitudinalSession(record);
    }

    Promise.all([fbSavePromise, d1SavePromise, sessionUpdatePromise])
      .then(function(results) {
        resolve(record);
      })
      .catch(function(err) {
        // Still resolve with the record since Firebase likely saved
        console.warn('submitMAPAssessment: one save target failed, record may be partial:', err);
        resolve(record);
      });
  });
}

// ── Update longitudinal session in Firebase ──────────────────────────────────
function _updateMAPLongitudinalSession(record) {
  return new Promise(function(resolve) {
    if (!record.session_id || !record.patient_number) { resolve(null); return; }

    var ref = database.ref('map_sessions/' + record.session_id);
    ref.once('value', function(snap) {
      var existing = snap.val();
      var now = Date.now();

      if (!existing) {
        // Create new session
        var newSession = {
          session_id:       record.session_id,
          patient_number:   record.patient_number,
          workspace_key:    record.workspace_key,
          condition:        record.condition || null,
          started_at:       now,
          last_updated:     now,
          assessment_count: 1,
          baseline_pe:      record.pe_score,
          latest_pe:        record.pe_score,
          arch_trajectory:  JSON.stringify([record.arch_score]),
          exec_trajectory:  JSON.stringify([record.exec_score]),
          ctx_trajectory:   JSON.stringify([record.ctx_score]),
          pe_trajectory:    JSON.stringify([record.pe_score]),
          dropout_risk:     null,
          dominant_domain:  record.dominant_failure || null,
        };
        ref.set(newSession, function(err) {
          if (err) console.warn('_updateMAPLongitudinalSession: set failed:', err);
          resolve(newSession);
        });
      } else {
        // Update existing session
        var archTraj = _safeJsonParse(existing.arch_trajectory, []);
        var execTraj = _safeJsonParse(existing.exec_trajectory, []);
        var ctxTraj  = _safeJsonParse(existing.ctx_trajectory,  []);
        var peTraj   = _safeJsonParse(existing.pe_trajectory,   []);

        archTraj.push(record.arch_score);
        execTraj.push(record.exec_score);
        ctxTraj.push(record.ctx_score);
        peTraj.push(record.pe_score);

        // Recalculate dominant domain from latest
        var updates = {
          last_updated:     now,
          assessment_count: (existing.assessment_count || 0) + 1,
          latest_pe:        record.pe_score,
          arch_trajectory:  JSON.stringify(archTraj),
          exec_trajectory:  JSON.stringify(execTraj),
          ctx_trajectory:   JSON.stringify(ctxTraj),
          pe_trajectory:    JSON.stringify(peTraj),
          dominant_domain:  record.dominant_failure || existing.dominant_domain,
        };
        if (!existing.baseline_pe) updates.baseline_pe = record.pe_score;

        ref.update(updates, function(err) {
          if (err) console.warn('_updateMAPLongitudinalSession: update failed:', err);
          resolve(updates);
        });
      }
    });
  });
}

function _safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}
