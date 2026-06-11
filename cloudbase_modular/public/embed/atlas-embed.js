/**
 * atlas-embed.js — ATLAS Assessment Embed Widget
 * Self-contained, dependency-free embed for third-party platforms.
 * Include via a single <script> tag; configure via data-* attributes.
 *
 * Usage:
 *   <div id="atlas-assessment"></div>
 *   <script src="https://atlas.adherence.cc/embed/atlas-embed.js"
 *     data-partner-key="ATLAS-XXXXXXXX-2026"
 *     data-instrument="map"
 *     data-patient-ref="patient-id-123"
 *     data-lang="en"
 *     data-theme="light"
 *     data-container="atlas-assessment"
 *     data-on-complete="myCallbackFunction">
 *   </script>
 */
(function () {
  'use strict';

  // ── Read configuration from script tag ──────────────────────────────────────
  var script = document.currentScript || (function () {
    var scripts = document.querySelectorAll('script[data-partner-key]');
    return scripts[scripts.length - 1] || null;
  })();

  if (!script) {
    console.error('[ATLAS Embed] Could not locate script tag with data-partner-key.');
    return;
  }

  var config = {
    partnerKey: script.dataset.partnerKey || '',
    instrument: (script.dataset.instrument || 'map').toLowerCase(),
    patientRef: script.dataset.patientRef || '',
    lang:       (script.dataset.lang || 'en').toLowerCase(),
    theme:      (script.dataset.theme || 'light').toLowerCase(),
    container:  script.dataset.container || '',
    onComplete: script.dataset.onComplete || '',
    apiBase:    script.dataset.apiBase || 'https://w0g7ua5h93.execute-api.us-east-1.amazonaws.com',
    condition:  script.dataset.condition || '',
  };

  // ── Themes ───────────────────────────────────────────────────────────────────
  var THEMES = {
    light: {
      bg:         '#ffffff',
      bg2:        '#f8f9fb',
      border:     '#e2e8f0',
      text:       '#1a2233',
      muted:      '#64748b',
      dim:        '#94a3b8',
      accent:     '#0891b2',
      accentBg:   'rgba(8,145,178,0.07)',
      accentBdr:  'rgba(8,145,178,0.30)',
      green:      '#059669',
      greenBg:    'rgba(5,150,105,0.07)',
      amber:      '#b45309',
      amberBg:    'rgba(180,83,9,0.07)',
      red:        '#dc2626',
      redBg:      'rgba(220,38,38,0.07)',
      shadow:     '0 4px 24px rgba(0,0,0,0.09)',
    },
    dark: {
      bg:         '#0f1923',
      bg2:        '#162030',
      border:     'rgba(255,255,255,0.10)',
      text:       'rgba(210,220,235,0.92)',
      muted:      'rgba(140,160,185,0.80)',
      dim:        'rgba(100,125,155,0.65)',
      accent:     '#0891b2',
      accentBg:   'rgba(8,145,178,0.12)',
      accentBdr:  'rgba(8,145,178,0.35)',
      green:      '#10b981',
      greenBg:    'rgba(16,185,129,0.09)',
      amber:      '#f59e0b',
      amberBg:    'rgba(245,158,11,0.09)',
      red:        '#ef4444',
      redBg:      'rgba(239,68,68,0.09)',
      shadow:     '0 4px 32px rgba(0,0,0,0.38)',
    },
  };

  var T = THEMES[config.theme] || THEMES.light;

  // ── Translations ─────────────────────────────────────────────────────────────
  var I18N = {
    en: {
      back:         'Back',
      next:         'Next',
      submit:       'Submit',
      yes:          'Yes',
      no:           'No',
      never:        'Never',
      occasionally: 'Once in a while',
      sometimes:    'Sometimes',
      usually:      'Usually',
      always:       'All the time',
      submitting:   'Submitting assessment…',
      result_title: 'Your Assessment Result',
      adherence_level: 'Adherence Level',
      pe_score:     'PE Score',
      high:         'High Adherence',
      moderate:     'Moderate Adherence',
      low:          'Low Adherence',
      error_title:  'Submission Error',
      error_msg:    'Assessment could not be submitted. Please try again.',
      retry:        'Try Again',
      question:     'Question',
      of:           'of',
    },
    el: {
      back:         'Πίσω',
      next:         'Επόμενο',
      submit:       'Υποβολή',
      yes:          'Ναι',
      no:           'Όχι',
      never:        'Ποτέ',
      occasionally: 'Μερικές φορές',
      sometimes:    'Συχνά',
      usually:      'Πολύ συχνά',
      always:       'Πάντα',
      submitting:   'Υποβολή αξιολόγησης…',
      result_title: 'Αποτέλεσμα Αξιολόγησης',
      adherence_level: 'Επίπεδο Συμμόρφωσης',
      pe_score:     'Βαθμός PE',
      high:         'Υψηλή Συμμόρφωση',
      moderate:     'Μέτρια Συμμόρφωση',
      low:          'Χαμηλή Συμμόρφωση',
      error_title:  'Σφάλμα Υποβολής',
      error_msg:    'Η αξιολόγηση δεν μπόρεσε να υποβληθεί. Παρακαλώ δοκιμάστε ξανά.',
      retry:        'Δοκιμάστε ξανά',
      question:     'Ερώτηση',
      of:           'από',
    },
    ar: {
      back:         'رجوع',
      next:         'التالي',
      submit:       'إرسال',
      yes:          'نعم',
      no:           'لا',
      never:        'أبداً',
      occasionally: 'أحياناً',
      sometimes:    'في بعض الأحيان',
      usually:      'غالباً',
      always:       'دائماً',
      submitting:   'جارٍ إرسال التقييم…',
      result_title: 'نتيجة التقييم',
      adherence_level: 'مستوى الالتزام',
      pe_score:     'نقاط PE',
      high:         'التزام مرتفع',
      moderate:     'التزام معتدل',
      low:          'التزام منخفض',
      error_title:  'خطأ في الإرسال',
      error_msg:    'تعذّر إرسال التقييم. يرجى المحاولة مرة أخرى.',
      retry:        'حاول مرة أخرى',
      question:     'سؤال',
      of:           'من',
    },
    es: {
      back:         'Atrás',
      next:         'Siguiente',
      submit:       'Enviar',
      yes:          'Sí',
      no:           'No',
      never:        'Nunca',
      occasionally: 'De vez en cuando',
      sometimes:    'A veces',
      usually:      'Usualmente',
      always:       'Siempre',
      submitting:   'Enviando evaluación…',
      result_title: 'Resultado de la Evaluación',
      adherence_level: 'Nivel de Adherencia',
      pe_score:     'Puntuación PE',
      high:         'Adherencia Alta',
      moderate:     'Adherencia Moderada',
      low:          'Adherencia Baja',
      error_title:  'Error de Envío',
      error_msg:    'No se pudo enviar la evaluación. Por favor, inténtelo de nuevo.',
      retry:        'Reintentar',
      question:     'Pregunta',
      of:           'de',
    },
    fr: {
      back:         'Retour',
      next:         'Suivant',
      submit:       'Soumettre',
      yes:          'Oui',
      no:           'Non',
      never:        'Jamais',
      occasionally: 'De temps en temps',
      sometimes:    'Parfois',
      usually:      'Souvent',
      always:       'Toujours',
      submitting:   'Envoi de l\'évaluation…',
      result_title: 'Résultat de l\'Évaluation',
      adherence_level: 'Niveau d\'Adhésion',
      pe_score:     'Score PE',
      high:         'Adhésion Élevée',
      moderate:     'Adhésion Modérée',
      low:          'Adhésion Faible',
      error_title:  'Erreur de Soumission',
      error_msg:    'L\'évaluation n\'a pas pu être soumise. Veuillez réessayer.',
      retry:        'Réessayer',
      question:     'Question',
      of:           'sur',
    },
  };

  var L = I18N[config.lang] || I18N.en;

  // ── Question Banks ───────────────────────────────────────────────────────────
  // adherent: true = Yes means adherent (score 1); false = Yes means non-adherent (score 0)
  // Q5 is the only question where Yes = adherent = 1
  var QUESTIONS = {
    map: {
      en: [
        { id: 1, type: 'yn',   adherent: false, text: 'Are there times when you forget to take your medications?' },
        { id: 2, type: 'yn',   adherent: false, text: 'In the past two weeks, have there been times when you chose to skip a dose (for example, because of side effects, cost, or feeling better)?' },
        { id: 3, type: 'yn',   adherent: false, text: 'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?' },
        { id: 4, type: 'yn',   adherent: false, text: 'When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?' },
        { id: 5, type: 'yn',   adherent: true,  text: 'Were you able to take your last dose as directed?' },
        { id: 6, type: 'yn',   adherent: false, text: 'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?' },
        { id: 7, type: 'yn',   adherent: false, text: 'Does keeping up with your medication routine feel like a big challenge in your everyday life?' },
        { id: 8, type: 'freq', adherent: null,  text: 'In a typical week, how often do you have trouble taking all your medications as prescribed?' },
      ],
      el: [
        { id: 1, type: 'yn',   adherent: false, text: 'Υπάρχουν φορές που ξεχνάτε να πάρετε τα φάρμακά σας;' },
        { id: 2, type: 'yn',   adherent: false, text: 'Τις τελευταίες δύο εβδομάδες, υπήρχαν φορές που επιλέξατε να παραλείψετε μια δόση (π.χ. λόγω παρενεργειών, κόστους ή επειδή νιώθατε καλύτερα);' },
        { id: 3, type: 'yn',   adherent: false, text: 'Τις τελευταίες δύο εβδομάδες, μειώσατε τη δόση σας ή σταματήσατε ένα φάρμακο μόνοι σας, χωρίς να ενημερώσετε τον γιατρό ή την ομάδα φροντίδας σας, λόγω του πώς σας έκανε να νιώθετε;' },
        { id: 4, type: 'yn',   adherent: false, text: 'Όταν αλλάζει η καθημερινή σας ρουτίνα (π.χ. ταξίδια, διαφορετικές ώρες εργασίας ή διανυκτέρευση εκτός σπιτιού), δυσκολεύεστε να συνεχίσετε κανονικά τα φάρμακά σας;' },
        { id: 5, type: 'yn',   adherent: true,  text: 'Μπορέσατε να πάρετε την τελευταία σας δόση όπως σας έχει οδηγηθεί;' },
        { id: 6, type: 'yn',   adherent: false, text: 'Όταν αρχίζετε να νιώθετε καλύτερα ή βελτιώνονται τα συμπτώματά σας, σκέφτεστε ποτέ να μειώσετε ή να κάνετε παύση στη φαρμακευτική σας αγωγή από μόνοι σας;' },
        { id: 7, type: 'yn',   adherent: false, text: 'Νιώθετε ότι η τήρηση του προγράμματος φαρμακευτικής αγωγής σας αποτελεί μεγάλη πρόκληση στην καθημερινή σας ζωή;' },
        { id: 8, type: 'freq', adherent: null,  text: 'Σε μια τυπική εβδομάδα, πόσο συχνά δυσκολεύεστε να παίρνετε όλα τα φάρμακά σας όπως έχουν συνταγογραφηθεί;' },
      ],
    },
  };

  // Resolve question set: prefer lang-specific, fall back to EN
  function _getQuestions() {
    var bank = QUESTIONS[config.instrument];
    if (!bank) bank = QUESTIONS.map; // default to MAP if unknown
    return bank[config.lang] || bank.en;
  }

  // ── CSS injection ─────────────────────────────────────────────────────────────
  function _injectStyles() {
    var styleId = 'atlas-embed-styles';
    if (document.getElementById(styleId)) return;

    var css = [
      '.atlas-embed-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:' + T.bg + ';border:1px solid ' + T.border + ';border-radius:14px;padding:28px 28px 24px;max-width:560px;margin:0 auto;box-shadow:' + T.shadow + ';box-sizing:border-box;color:' + T.text + ';}',
      '.atlas-embed-progress-track{height:4px;background:' + T.border + ';border-radius:2px;margin-bottom:24px;overflow:hidden;}',
      '.atlas-embed-progress-fill{height:100%;background:' + T.accent + ';border-radius:2px;transition:width 0.45s ease;}',
      '.atlas-embed-eyebrow{font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:' + T.dim + ';margin-bottom:8px;}',
      '.atlas-embed-question{font-size:1.05rem;font-weight:500;color:' + T.text + ';line-height:1.55;margin-bottom:26px;min-height:3em;}',
      '.atlas-embed-yn-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}',
      '.atlas-embed-yn-btn{padding:13px 18px;border-radius:9px;font-size:0.96rem;font-weight:500;cursor:pointer;border:2px solid ' + T.border + ';background:' + T.bg2 + ';color:' + T.muted + ';transition:all 0.17s;text-align:center;}',
      '.atlas-embed-yn-btn:hover{border-color:' + T.accentBdr + ';background:' + T.accentBg + ';color:' + T.accent + ';}',
      '.atlas-embed-yn-btn.atlas-selected{border-color:' + T.accent + ';background:' + T.accentBg + ';color:' + T.accent + ';font-weight:600;}',
      '.atlas-embed-freq-btns{display:grid;gap:8px;margin-bottom:24px;}',
      '.atlas-embed-freq-btn{padding:11px 16px;border-radius:8px;font-size:0.92rem;cursor:pointer;border:1.5px solid ' + T.border + ';background:' + T.bg2 + ';color:' + T.muted + ';transition:all 0.17s;text-align:left;}',
      '.atlas-embed-freq-btn:hover{border-color:' + T.accentBdr + ';background:' + T.accentBg + ';color:' + T.accent + ';}',
      '.atlas-embed-freq-btn.atlas-selected{border-color:' + T.accent + ';background:' + T.accentBg + ';color:' + T.accent + ';font-weight:600;}',
      '.atlas-embed-nav{display:flex;justify-content:space-between;align-items:center;margin-top:8px;}',
      '.atlas-embed-btn{font-size:0.86rem;font-weight:500;padding:10px 22px;border-radius:8px;cursor:pointer;transition:all 0.17s;border:1.5px solid ' + T.accentBdr + ';background:' + T.accentBg + ';color:' + T.accent + ';}',
      '.atlas-embed-btn:hover{background:' + T.accent + ';color:#fff;border-color:' + T.accent + ';}',
      '.atlas-embed-btn:disabled{opacity:0.38;cursor:default;}',
      '.atlas-embed-btn-ghost{background:transparent;border-color:' + T.border + ';color:' + T.muted + ';}',
      '.atlas-embed-btn-ghost:hover{background:' + T.bg2 + ';color:' + T.text + ';border-color:' + T.border + ';}',
      '.atlas-embed-spinner{display:inline-block;width:32px;height:32px;border:3px solid ' + T.border + ';border-top-color:' + T.accent + ';border-radius:50%;animation:atlas-spin 0.7s linear infinite;}',
      '@keyframes atlas-spin{to{transform:rotate(360deg)}}',
      '.atlas-embed-result-card{border-radius:10px;padding:20px 22px;text-align:center;margin-bottom:20px;}',
      '.atlas-embed-result-high{background:' + T.greenBg + ';border:1.5px solid ' + T.green + '33;}',
      '.atlas-embed-result-moderate{background:' + T.amberBg + ';border:1.5px solid ' + T.amber + '33;}',
      '.atlas-embed-result-low{background:' + T.redBg + ';border:1.5px solid ' + T.red + '33;}',
      '.atlas-embed-result-score{font-size:2.8rem;font-weight:700;line-height:1;margin-bottom:6px;letter-spacing:-0.03em;}',
      '.atlas-embed-result-label{font-size:0.96rem;font-weight:600;margin-bottom:4px;}',
      '.atlas-embed-result-phenotype{font-size:0.78rem;opacity:0.75;letter-spacing:0.04em;}',
      '.atlas-embed-error-card{background:' + T.redBg + ';border:1.5px solid ' + T.red + '33;border-radius:10px;padding:18px 20px;text-align:center;}',
    ].join('\n');

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── State ────────────────────────────────────────────────────────────────────
  var state = {
    questions:  [],
    step:       0,        // 0-based question index
    responses:  [],       // array of {question_id, response}
    submitted:  false,
    submitting: false,
    error:      false,
    result:     null,
  };

  // ── Escape HTML ───────────────────────────────────────────────────────────────
  function _h(str) {
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Get host container ───────────────────────────────────────────────────────
  function _getContainer() {
    if (config.container) return document.getElementById(config.container);
    return null;
  }

  // ── Render current step ───────────────────────────────────────────────────────
  function _render() {
    var host = _getContainer();
    if (!host) {
      console.error('[ATLAS Embed] Container element not found: ' + config.container);
      return;
    }

    // Ensure wrapper
    var wrap = host.querySelector('.atlas-embed-wrap');
    if (!wrap) {
      host.innerHTML = '<div class="atlas-embed-wrap"></div>';
      wrap = host.querySelector('.atlas-embed-wrap');
    }

    if (state.submitting) {
      wrap.innerHTML = _renderSubmitting();
    } else if (state.error) {
      wrap.innerHTML = _renderError();
    } else if (state.submitted && state.result) {
      wrap.innerHTML = _renderResult(state.result);
    } else {
      wrap.innerHTML = _renderQuestion();
    }
  }

  function _renderSubmitting() {
    return '<div style="text-align:center;padding:40px 20px;">' +
      '<div class="atlas-embed-spinner" style="margin:0 auto 18px;"></div>' +
      '<div style="color:' + T.muted + ';font-size:0.92rem;">' + _h(L.submitting) + '</div>' +
      '</div>';
  }

  function _renderError() {
    return '<div class="atlas-embed-error-card">' +
      '<div style="font-size:1.7rem;margin-bottom:10px;">⚠</div>' +
      '<div style="font-size:1rem;font-weight:600;color:' + T.red + ';margin-bottom:6px;">' + _h(L.error_title) + '</div>' +
      '<div style="font-size:0.88rem;color:' + T.muted + ';margin-bottom:18px;">' + _h(L.error_msg) + '</div>' +
      '<button class="atlas-embed-btn" onclick="atlasEmbedRetry()">' + _h(L.retry) + '</button>' +
      '</div>';
  }

  function _renderResult(result) {
    var r  = result.result || {};
    var pe = r.pe != null ? r.pe : (typeof result.result === 'number' ? result.result : null);
    var peFmt = pe != null ? Math.round(pe * 100) / 100 : null;
    var tier  = pe >= 0.75 ? 'high' : pe >= 0.55 ? 'moderate' : 'low';
    var cardClass = 'atlas-embed-result-' + tier;
    var tierLabel = tier === 'high' ? L.high : tier === 'moderate' ? L.moderate : L.low;
    var scoreColor = tier === 'high' ? T.green : tier === 'moderate' ? T.amber : T.red;

    return '<div class="atlas-embed-result-card ' + cardClass + '">' +
      '<div class="atlas-embed-result-score" style="color:' + scoreColor + ';">' +
        (peFmt != null ? peFmt : '--') +
      '</div>' +
      '<div class="atlas-embed-result-label" style="color:' + scoreColor + ';">' + _h(tierLabel) + '</div>' +
      '</div>' +
      '<div style="font-size:0.78rem;color:' + T.dim + ';text-align:center;">' +
        _h(L.result_title) + (result.assessment_id ? ' · <span style="font-family:monospace;">' + _h(result.assessment_id) + '</span>' : '') +
      '</div>';
  }

  function _renderQuestion() {
    var q     = state.questions[state.step];
    var total = state.questions.length;
    var pct   = total > 0 ? Math.round((state.step / total) * 100) : 0;
    var resp  = state.responses[state.step];
    var isLast = state.step === total - 1;

    var answersHtml = '';
    if (q.type === 'yn') {
      var ySelected = resp && resp.response === 1 ? ' atlas-selected' : '';
      var nSelected = resp && resp.response === 0 ? ' atlas-selected' : '';
      answersHtml = '<div class="atlas-embed-yn-btns">' +
        '<button class="atlas-embed-yn-btn' + ySelected + '" onclick="atlasEmbedAnswer(1)">' + _h(L.yes) + '</button>' +
        '<button class="atlas-embed-yn-btn' + nSelected + '" onclick="atlasEmbedAnswer(0)">' + _h(L.no) + '</button>' +
        '</div>';
    } else if (q.type === 'freq') {
      // Q8 MAP ordinal: MAP scoring — Never=1.00, Rarely=0.75, Sometimes=0.50, Often=0.25, All the time=0.00
      var freqOptions = [
        { val: 1.00, label: L.never },
        { val: 0.75, label: L.occasionally },
        { val: 0.50, label: L.sometimes },
        { val: 0.25, label: L.usually },
        { val: 0.00, label: L.always },
      ];
      answersHtml = '<div class="atlas-embed-freq-btns">';
      for (var i = 0; i < freqOptions.length; i++) {
        var opt = freqOptions[i];
        var sel = resp && resp.response === opt.val ? ' atlas-selected' : '';
        answersHtml += '<button class="atlas-embed-freq-btn' + sel + '" onclick="atlasEmbedAnswer(' + opt.val + ')">' +
          _h(opt.label) + '</button>';
      }
      answersHtml += '</div>';
    }

    var canNext   = resp != null;
    var backDisabled = state.step === 0 ? ' disabled' : '';
    var nextLabel = isLast ? _h(L.submit) : _h(L.next);

    return '<div class="atlas-embed-progress-track">' +
        '<div class="atlas-embed-progress-fill" style="width:' + pct + '%;"></div>' +
      '</div>' +
      '<div class="atlas-embed-eyebrow">' + _h(L.question) + ' ' + (state.step + 1) + ' ' + _h(L.of) + ' ' + total + '</div>' +
      '<div class="atlas-embed-question">' + _h(q.text) + '</div>' +
      answersHtml +
      '<div class="atlas-embed-nav">' +
        '<button class="atlas-embed-btn atlas-embed-btn-ghost"' + backDisabled + ' onclick="atlasEmbedBack()">' + _h(L.back) + '</button>' +
        '<button class="atlas-embed-btn" ' + (canNext ? '' : 'disabled') + ' onclick="atlasEmbedNext()">' + nextLabel + '</button>' +
      '</div>';
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  window.atlasEmbedAnswer = function (val) {
    if (state.submitting || state.submitted) return;
    var q = state.questions[state.step];
    state.responses[state.step] = { question_id: q.id, response: val };
    _render();
  };

  window.atlasEmbedNext = function () {
    if (state.submitting || state.submitted) return;
    var resp = state.responses[state.step];
    if (resp == null) return;

    if (state.step < state.questions.length - 1) {
      state.step++;
      _render();
    } else {
      _submitAssessment();
    }
  };

  window.atlasEmbedBack = function () {
    if (state.submitting || state.submitted || state.step === 0) return;
    state.step--;
    _render();
  };

  window.atlasEmbedRetry = function () {
    state.error = false;
    state.submitting = false;
    _render();
  };

  // ── Submission ────────────────────────────────────────────────────────────────
  function _submitAssessment() {
    state.submitting = true;
    state.error = false;
    _render();

    var endpoint = config.apiBase + '/v1/' + config.instrument + '/submit';
    // config.apiBase = base URL without trailing slash, e.g. https://w0g7ua5h93.execute-api.us-east-1.amazonaws.com

    // Build flat 0-1 coded response array ordered by question id
    // For yn: adherent=true means Yes=1, No=0; adherent=false means Yes=0, No=1
    // For freq: value is already coded (1.00/0.75/0.50/0.25/0.00)
    var codedResponses = state.questions.map(function (q, idx) {
      var r = state.responses[idx];
      if (!r) return 0;
      if (q.type === 'freq') return r.response; // already 0-1
      // yn: r.response is 1 (Yes) or 0 (No)
      return q.adherent ? r.response : (r.response === 1 ? 0 : 1);
    });

    var payload = {
      patient_ref: config.patientRef,
      responses:   codedResponses,
    };
    if (config.condition) payload.condition = config.condition;

    var done = false;

    // Network timeout: 15 seconds
    var timeoutId = setTimeout(function () {
      if (!done) {
        done = true;
        state.submitting = false;
        state.error = true;
        _render();
      }
    }, 15000);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Partner-Key', config.partnerKey);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || done) return;
      done = true;
      clearTimeout(timeoutId);

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var data = JSON.parse(xhr.responseText);
          state.submitting = false;
          state.submitted  = true;
          state.result     = data;
          _render();
          _fireCallback(data);
        } catch (e) {
          state.submitting = false;
          state.error = true;
          _render();
        }
      } else {
        state.submitting = false;
        state.error = true;
        _render();
      }
    };

    xhr.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(timeoutId);
      state.submitting = false;
      state.error = true;
      _render();
    };

    xhr.send(JSON.stringify(payload));
  }

  // ── On-complete callback ──────────────────────────────────────────────────────
  function _fireCallback(result) {
    if (!config.onComplete) return;
    try {
      var fn = window[config.onComplete];
      if (typeof fn === 'function') {
        fn({
          assessment_id: result.assessment_id || null,
          instrument:    config.instrument,
          result:        result.result || result,
          timestamp:     result.timestamp || Date.now(),
        });
      }
    } catch (e) {
      console.error('[ATLAS Embed] onComplete callback error:', e);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function _init() {
    if (!config.partnerKey) {
      console.error('[ATLAS Embed] data-partner-key is required.');
      return;
    }
    var host = _getContainer();
    if (!host) {
      console.error('[ATLAS Embed] Container not found: #' + config.container);
      return;
    }

    _injectStyles();
    state.questions = _getQuestions();
    state.responses = new Array(state.questions.length).fill(null);
    state.step      = 0;
    _render();
  }

  // Boot: wait for DOM if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
