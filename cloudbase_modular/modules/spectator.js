// ══════════════════════════════════════════════════════════════════════════
// UNIFIED PATIENT LANGUAGE RENDERER
// Single entry point called whenever language changes.
// Translates: entry screen → consent → MMAS questions + UI → result modal.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// COMPLETE ENGLISH FALLBACK — fills every missing key in every language
// This runs once after all merges, guaranteeing 100% coverage.
// Any language missing a translation gets the English string silently.
// ══════════════════════════════════════════════════════════════════════════
(function() {
  var en = ATLAS_STRINGS.en;
  Object.keys(ATLAS_STRINGS).forEach(function(lang) {
    if (lang === 'en') return;
    var t = ATLAS_STRINGS[lang];
    Object.keys(en).forEach(function(key) {
      if (t[key] === undefined) {
        // Copy English value, but wrap functions (like questionOf)
        if (typeof en[key] === 'function') {
          t[key] = en[key];
        } else {
          t[key] = en[key];
        }
      }
    });
  });
})();

/**
 * Sets the active UI language and re-renders all patient-path screens
 * (entry, consent, MMAS questions + form labels, result modal) in the chosen language.
 * Also updates RTL/LTR document direction for Arabic and Urdu.
 * @param {string} lang - BCP-47 language code (must be a key in ATLAS_STRINGS)
 * @returns {void}
 */
function setAppLanguage(lang) {
  // Persist language selection for session restore
  try { localStorage.setItem('atlas_lang', lang); } catch(e) {}
  var t   = ATLAS_STRINGS[lang] || ATLAS_STRINGS.en;
  var enT = ATLAS_STRINGS.en;  // always English fallback — defined here so all sections can access it
  var q   = MMAS_QUESTIONS[lang] || MMAS_QUESTIONS.en;
  var RTL = (lang === 'ar' || lang === 'ur');
  var dir = RTL ? 'rtl' : 'ltr';

  mmasCurrentLang = lang;

  // Apply RTL/LTR to entire document — ar and ur are right-to-left
  document.documentElement.setAttribute('dir', dir);
  document.body.setAttribute('dir', dir);
  ['screen-entry','screen-consent','screen-mmas','screen-dashboard','screen-peacs'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('dir', dir);
  });

  // Sync lang selector (consolidated to entry screen only)
  ['lang-select-entry'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && el.value !== lang) el.value = lang;
  });

  // ── 1. ENTRY SCREEN ────────────────────────────────────────────────────
  var eScreen = document.getElementById('screen-entry');
  if (eScreen) {
    eScreen.setAttribute('dir', dir);

    // Tagline — inline div with no class, match by current content
    eScreen.querySelectorAll('div').forEach(function(el) {
      if (el.children.length > 0) return;
      var txt = el.textContent.trim();
      // Match tagline against any known translation
      var isTagline = Object.keys(ATLAS_STRINGS).some(function(l) {
        return ATLAS_STRINGS[l].entryTagline && txt === ATLAS_STRINGS[l].entryTagline;
      });
      if (isTagline && t.entryTagline) el.textContent = t.entryTagline;
    });

    // Live feed badge
    var liveBadge = eScreen.querySelector('.elc-live-badge');
    if (liveBadge) {
      var liveSpan = liveBadge.querySelector('span:not(.elc-live-dot)');
      if (liveSpan) liveSpan.textContent = t.entryLiveTag || enT.entryLiveTag;
    }

    // Live counter labels — elc-lbl spans
    var elcLabels = eScreen.querySelectorAll('.elc-lbl');
    var elcKeys = ['liveMMAS','liveCountries','liveAvg','livePEACS'];
    elcLabels.forEach(function(lbl, i) {
      if (elcKeys[i] && t[elcKeys[i]]) lbl.textContent = t[elcKeys[i]];
    });

    // ── Patient card ────────────────────────────────────────────────────
    var pc = document.getElementById('btn-patient');
    if (pc) {
      var pLbl  = pc.querySelector('.path-label');
      var pName = pc.querySelector('.path-name');
      var pDesc = pc.querySelector('.path-desc');
      var pPre  = pc.querySelector('.path-prereg-note');
      if (pLbl)  pLbl.textContent  = t.patientLabel   || enT.patientLabel;
      if (pName) pName.innerHTML   = t.patientName    || enT.patientName;
      if (pDesc) pDesc.textContent = t.patientDesc    || enT.patientDesc;
      if (pPre)  pPre.textContent  = t.patientPreReg  || enT.patientPreReg;
      // Detail bullets
      var pDetails = pc.querySelectorAll('.path-detail > span');
      var pDetailKeys = ['patientDetail1','patientDetail2','patientDetail3'];
      pDetails.forEach(function(sp, i) {
        if (!pDetailKeys[i]) return;
        var dot = sp.querySelector('.path-detail-dot');
        if (dot) sp.innerHTML = dot.outerHTML + ' ' + (t[pDetailKeys[i]] || enT[pDetailKeys[i]] || '');
        else if (t[pDetailKeys[i]]) sp.textContent = t[pDetailKeys[i]];
      });
    }

    // ── Explorer card ───────────────────────────────────────────────────
    var ec = document.getElementById('btn-explorer');
    if (ec) {
      var eLbl  = ec.querySelector('.path-label');
      var eName = ec.querySelector('.path-name');
      var eDesc = ec.querySelector('.path-desc');
      var ePre  = ec.querySelector('.path-prereg-note');
      if (eLbl)  eLbl.textContent  = t.explorerLabel  || enT.explorerLabel;
      if (eName) eName.innerHTML   = t.explorerName   || enT.explorerName;
      if (eDesc) eDesc.textContent = t.explorerDesc   || enT.explorerDesc;
      if (ePre)  ePre.textContent  = t.explorerPreReg || enT.explorerPreReg;
    }

    // ── Researcher card ─────────────────────────────────────────────────
    var rc = document.getElementById('btn-researcher');
    if (rc) {
      var rLbl  = rc.querySelector('.path-label');
      var rName = rc.querySelector('.path-name');
      var rDesc = rc.querySelector('.path-desc');
      var rPre  = rc.querySelector('.path-prereg-note');
      if (rLbl)  rLbl.textContent  = t.researcherLabel  || enT.researcherLabel;
      if (rName) rName.innerHTML   = t.researcherName   || enT.researcherName;
      if (rDesc) rDesc.textContent = t.researcherDesc   || enT.researcherDesc;
      if (rPre)  rPre.textContent  = t.researcherPreReg || enT.researcherPreReg;
    }

    // ── Institution card ────────────────────────────────────────────────
    var ic = document.getElementById('btn-institution');
    if (ic) {
      var iLbl  = ic.querySelector('.path-label');
      var iName = ic.querySelector('.path-name');
      var iDesc = ic.querySelector('.path-desc');
      var iPre  = ic.querySelector('.path-prereg-note');
      if (iLbl)  iLbl.textContent  = t.institutionLabel  || enT.institutionLabel;
      if (iName) iName.innerHTML   = t.institutionName   || enT.institutionName;
      if (iDesc) iDesc.textContent = t.institutionDesc   || enT.institutionDesc;
      if (iPre)  iPre.textContent  = t.institutionPreReg || enT.institutionPreReg;
    }

    // Entry lang label
    var entryLangLbl = document.getElementById('entry-lang-label');
    if (entryLangLbl) entryLangLbl.textContent = t.langLabel || enT.langLabel;
  }

  // ── 2. CONSENT SCREEN ──────────────────────────────────────────────────
  var cScreen = document.getElementById('screen-consent');
  if (cScreen) {
    cScreen.setAttribute('dir', dir);
    var wrap = cScreen.querySelector('.consent-wrap');
    if (wrap) wrap.setAttribute('dir', dir);

    var qs = function(sel) { return cScreen.querySelector(sel); };
    var eyebrow  = qs('.consent-eyebrow');
    var titleEl  = qs('.consent-title');
    var subEl    = qs('.consent-sub');
    if (eyebrow) eyebrow.textContent = t.consentEyebrow;
    if (titleEl) titleEl.innerHTML   = t.consentTitle;
    if (subEl)   subEl.textContent   = t.consentSub;

    var sData = [
      {tag:t.s1tag, title:t.s1title, body:t.s1body, geo:null},
      {tag:t.s2tag, title:t.s2title, body:t.s2body, geo:null},
      {tag:t.s3tag, title:t.s3title, body:t.s3body, geo:null},
      {tag:t.s4tag, title:t.s4title, body:t.s4body, geo:t.geo},
    ];
    var sections = cScreen.querySelectorAll('.consent-section');
    for (var si = 0; si < sections.length && si < 4; si++) {
      var sec = sections[si]; var d = sData[si];
      var tE = sec.querySelector('.consent-section-tag');
      var tiE = sec.querySelector('.consent-section-title');
      var bE  = sec.querySelector('.consent-section-body');
      if (tE)  tE.textContent  = d.tag;
      if (tiE) tiE.textContent = d.title;
      if (bE) {
        if (d.geo !== null) {
          var geoRow  = bE.querySelector('.geo-agree-row');
          var cnodes  = Array.prototype.slice.call(bE.childNodes);
          for (var ci = 0; ci < cnodes.length; ci++) {
            if (cnodes[ci].nodeType === 3) bE.removeChild(cnodes[ci]);
          }
          bE.insertBefore(document.createTextNode(' ' + d.body + ' '), bE.firstChild);
          if (geoRow) {
            var geoSpan = geoRow.querySelector('.geo-agree-text');
            if (geoSpan) geoSpan.textContent = d.geo;
          }
        } else {
          bE.textContent = d.body;
        }
      }
    }

    var langLblEl = document.getElementById('consent-lang-label');
    if (langLblEl) langLblEl.textContent = t.langLabel;
    var chkEl = qs('.consent-checkbox-label');
    if (chkEl) chkEl.textContent = t.checkLabel;
    var procBtn = document.getElementById('consent-proceed-btn');
    if (procBtn) { var wd = procBtn.disabled; procBtn.textContent = t.proceedBtn; procBtn.disabled = wd; }
    var bkBtn = document.getElementById('consent-back-btn');
    if (bkBtn) bkBtn.textContent = t.backBtn;
  }

  // ── 3. MMAS SCREEN ─────────────────────────────────────────────────────
  var mScreen = document.getElementById('screen-mmas');
  if (mScreen) {
    mScreen.setAttribute('dir', dir);

    var mqs = function(sel) { return mScreen.querySelector(sel); };
    var hTitle   = mqs('.mmas-header-title');
    var hSub     = mqs('.mmas-header-sub');
    var hClosing = document.getElementById('mmas-page-closing');
    if (hTitle)   hTitle.textContent   = t.pageTitle;
    if (hSub)     hSub.textContent     = t.pageSub;
    if (hClosing) hClosing.textContent = t.pageClosing || ATLAS_STRINGS.en.pageClosing;

    var sdohTag = mqs('.sdoh-tag');
    var sdohSub = mqs('.sdoh-sub');
    if (sdohTag) sdohTag.textContent = t.sdohTag;
    if (sdohSub) sdohSub.textContent = t.sdohSub;

    // SDoH labels — match by current text against ALL known translations
    var labels = mScreen.querySelectorAll('.sdoh-label');
    var labelKeys = ['labelCountry','labelCity','labelPatient','labelStudy','labelCondition','labelMedCount','labelMeds','labelGender','labelAge','labelEdu'];
    var optKeys   = [false, false, true, true, true, true, true, true, true, true];
    labels.forEach(function(lbl) {
      var cur = lbl.textContent.trim();
      for (var li = 0; li < labelKeys.length; li++) {
        var key = labelKeys[li];
        // Check if current text matches this label in ANY language
        var matched = Object.keys(ATLAS_STRINGS).some(function(l) {
          var v = ATLAS_STRINGS[l][key] || '';
          return cur === v || cur.startsWith(v);
        });
        if (matched) {
          if (optKeys[li]) {
            lbl.innerHTML = t[key] + ' <span class="sdoh-optional">' + t.optional + '</span>';
          } else {
            lbl.textContent = t[key];
          }
          break;
        }
      }
    });

    // Gender options
    var gSel = document.getElementById('sdoh-gender');
    if (gSel && t.genderOpts) {
      var gopts = gSel.querySelectorAll('option');
      t.genderOpts.forEach(function(label, i) { if (gopts[i]) gopts[i].textContent = label; });
    }
    // Age options
    var aSel = document.getElementById('sdoh-age');
    if (aSel && t.ageOpts) {
      var aopts = aSel.querySelectorAll('option');
      t.ageOpts.forEach(function(label, i) { if (aopts[i]) aopts[i].textContent = label; });
    }
    // Placeholders
    var cI = document.getElementById('sdoh-country');
    if (cI) cI.placeholder = t.placeholderCountry;
    var ctI = document.getElementById('sdoh-city');
    if (ctI) ctI.placeholder = t.placeholderCity;
    var coO = document.getElementById('sdoh-condition-other');
    if (coO) coO.placeholder = t.placeholderConditionOther;

    // Submit
    var subBtn = document.getElementById('mmas-submit-btn');
    if (subBtn) subBtn.textContent = t.submitBtn;
    var subNote = mqs('.mmas-submit-note');
    if (subNote) subNote.textContent = t.submitNote;

    // NLQ input placeholder (translated per language)
    var nlqInput = document.getElementById('nlq-input');
    if (nlqInput && (t.nlqPlaceholder || enT.nlqPlaceholder)) {
      nlqInput.placeholder = t.nlqPlaceholder || enT.nlqPlaceholder;
    }

    // MMAS nav buttons
    var ms = function(id, key) { var el = document.getElementById(id); if (el && (t[key]||enT[key])) el.textContent = t[key]||enT[key]; };
    ms('mmas-spectator-btn',        'mmasSpectator');
    ms('mmas-exit-btn',             'mmasExit');
    ms('mmas-inline-cohort-btn',    'mapCohort');
    ms('mmas-inline-spectator-btn', 'mapSpectator');
    ms('add-med-btn',               'mmasAddMed');
    ms('zoe-mic-btn',               'zoeMic');
    ms('zoe-skip-btn',              'zoeSkip');
    ms('zoe-exit-btn',              'zoeExit');

    // MMAS nav tab buttons (Assessment / Live Map)
    mScreen.querySelectorAll('[data-tab]').forEach(function(btn) {
      var tab = btn.getAttribute('data-tab');
      if (tab === 'assess' || tab === 'assessment') btn.textContent = t.mmasNavAssess || enT.mmasNavAssess;
      if (tab === 'map') btn.textContent = t.mmasNavMap || enT.mmasNavMap;
    });

    // ZOE section text
    mScreen.querySelectorAll('div').forEach(function(el) {
      if (el.children.length === 0) {
        var txt = el.textContent.trim();
        if (txt === ATLAS_STRINGS.en.zoeTitle) el.textContent = t.zoeTitle || enT.zoeTitle;
        if (txt === ATLAS_STRINGS.en.zoeSub)   el.textContent = t.zoeSub   || enT.zoeSub;
      }
    });
    mScreen.querySelectorAll('button').forEach(function(btn) {
      if (btn.textContent.trim() === ATLAS_STRINGS.en.zoeBtn) btn.textContent = t.zoeBtn || enT.zoeBtn;
    });

    // Store for question rendering
    window._currentMMASUI = t;
  }

  // ── 4. Re-render MMAS questions ────────────────────────────────────────
  if (typeof renderMMASQuestions === 'function') renderMMASQuestions();
  if (typeof rebuildConditionDropdown === 'function') rebuildConditionDropdown();

  // ── 5. Workspace modal ──────────────────────────────────────────────────
  var wsTitle   = document.getElementById('ws-modal-title');
  var wsSub     = document.getElementById('ws-modal-subtitle');
  var wsInput   = document.getElementById('ws-input');
  var wsSubmit  = document.getElementById('ws-submit');
  var wsCancel  = document.getElementById('ws-cancel');
  var wsBenLbl  = document.getElementById('ws-benefits-label');
  if (wsTitle)  wsTitle.textContent  = t.wsTitle   || enT.wsTitle;
  if (wsSub)    wsSub.textContent    = t.wsSubtitle|| enT.wsSubtitle;
  if (wsInput)  wsInput.placeholder  = t.wsPlaceholder || enT.wsPlaceholder;
  if (wsSubmit) wsSubmit.textContent = t.wsSubmit  || enT.wsSubmit;
  if (wsCancel) wsCancel.textContent = t.wsCancel  || enT.wsCancel;
  if (wsBenLbl) wsBenLbl.textContent = t.wsBenefitsLabel || enT.wsBenefitsLabel;

  // ── 6. Dashboard — translate by ID for nav, then data-i18n for everything else ──
  var g = function(id) { return document.getElementById(id); };
  var s = function(id, key) { var el = g(id); if (el && (t[key]||enT[key])) el.textContent = t[key]||enT[key]; };

  // Nav buttons by ID
  s('dash-new-session-btn',    'dashNewSession');
  s('clinic-mode-toggle-btn',  'dashClinicMode');
  s('dash-exit-btn',           'dashExit');
  s('dash-mmas-export-btn',    'exportMMAS');
  s('dash-bulk-btn',           'bulkUpload');
  s('dash-qr-btn',             'patientQR');
  s('dash-export-btn',         'exportPEACS');
  s('mmas-export-btn',         'exportMMAS');
  s('peacs-export-btn',        'exportPEACS');
  s('irb-cert-btn',            'sessionCert');

  // Theme toggle label — translate "Daylight" / "Night"
  var themeLabel = document.getElementById('theme-toggle-label');
  if (themeLabel) {
    var isDark = !document.documentElement.hasAttribute('data-theme') || document.documentElement.getAttribute('data-theme') !== 'light';
    themeLabel.textContent = isDark ? (t.themeToggleLabel || enT.themeToggleLabel || 'Daylight') : (t.themeToggleLabelDark || enT.themeToggleLabelDark || 'Night');
  }

  // Common action buttons — build reverse lookup across all languages for round-trip safety
  var _btnKeys = ['btnClose','btnCancel','btnSave','btnSaveShort','btnSubmit','btnDelete',
    'btnEdit','btnConfirm','btnDone','btnEndSession','btnContinue','btnBack','btnNext'];
  var btnTextMap = {};
  _btnKeys.forEach(function(key) {
    Object.keys(ATLAS_STRINGS).forEach(function(l) {
      var v = ATLAS_STRINGS[l][key];
      if (v && typeof v === 'string') btnTextMap[v.trim()] = key;
    });
  });
  // Only translate buttons that are leaves (no child elements) and match exactly
  document.querySelectorAll('button, .acc-btn').forEach(function(btn) {
    if (btn.children.length > 0) return;
    var txt = btn.textContent.trim();
    var k = btnTextMap[txt];
    if (k && (t[k] || enT[k])) btn.textContent = t[k] || enT[k];
  });

  // Pulse bar by class order
  var pulseLbls = document.querySelectorAll('#screen-dashboard .pulse-lbl');
  var pulseKeys = ['pulseMMAS','pulseCountries','pulseAvg','pulsePEACS','pulsePE'];
  pulseLbls.forEach(function(lbl, i) {
    if (pulseKeys[i]) lbl.textContent = t[pulseKeys[i]] || enT[pulseKeys[i]] || lbl.textContent;
  });

  // Table headers — build reverse lookup across all languages for round-trip safety
  var _thKeys = ['thScore','thPattern','thCountry','thDate','thTrend','thPatient',
    'thTime','thZone','thLocation','thWorkspace','thPatients','thKey','thName',
    'thRole','thStatus','thPatientID','thCondition','thExports','thLimit','thTier','thExpiry','thCalls'];
  var thMap = {};
  _thKeys.forEach(function(key) {
    Object.keys(ATLAS_STRINGS).forEach(function(l) {
      var v = ATLAS_STRINGS[l][key];
      if (v && typeof v === 'string') thMap[v.trim()] = key;
    });
  });
  document.querySelectorAll('#screen-dashboard th, .acc-card th').forEach(function(th) {
    var k = thMap[th.textContent.trim()];
    if (k && (t[k]||enT[k])) th.textContent = t[k]||enT[k];
  });

  // ── data-i18n: one pass translates ALL stamped elements ──────────────────
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    var val = t[key] || enT[key];
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-html');
    var val = t[key] || enT[key];
    if (val !== undefined) el.innerHTML = val;
  });

  // Stat/button labels by text match (dynamically rendered — no HTML stamp possible)
  // Build a reverse lookup: for each translation key, collect ALL known translated values → key
  // This allows round-trip translation (non-English → English) without hanging threads
  var _dynKeys = [
    'statSubmissions','statCountries','statMean','statMedian','statMode',
    'statHighPct','statINA','statUNA','statMixed','statHigh','statAssessments',
    'statMeanPE','statSD','statOptimal',
    'miniSubmissions','miniCountries','miniAvgScore','miniAssessments','miniAvgPE',
    'sortRecent','sortScoreAsc','sortScoreDesc','sortPID','sortVisits',
    'newAssessment','openPEACS','iccActivePIs','iccTotalPatients','iccOrgAvg','iccINA',
  ];
  var dynMap = {};
  _dynKeys.forEach(function(key) {
    Object.keys(ATLAS_STRINGS).forEach(function(l) {
      var v = ATLAS_STRINGS[l][key];
      if (v && typeof v === 'string') dynMap[v.trim()] = key;
    });
  });
  document.querySelectorAll('#screen-dashboard .stat-lbl, #screen-dashboard .pulse-lbl, #screen-dashboard button, #screen-dashboard option, #screen-dashboard span').forEach(function(el) {
    if (el.children.length > 0) return;
    var k = dynMap[el.textContent.trim()];
    if (k && (t[k]||enT[k])) el.textContent = t[k]||enT[k];
  });

  // ── 7. MMAS Map nav ─────────────────────────────────────────────────────
  var mapBtns = {
    'globe-btn':           t.mapGlobe       || enT.mapGlobe,
    'flat-btn':            t.mapFlat        || enT.mapFlat,
    'map-cohort-toggle-btn': t.mapCohort    || enT.mapCohort,
    'map-spectator-btn':   t.mapSpectator   || enT.mapSpectator,
    'map-heatmap-btn':     t.mapHeatmap     || enT.mapHeatmap,
    'map-export-btn':      t.mapExport      || enT.mapExport,
    'map-refresh-btn':     t.mapRefresh     || enT.mapRefresh,
    'mmas-map-back-btn':   t.mapBack        || enT.mapBack,
  };
  Object.keys(mapBtns).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = mapBtns[id];
  });

  // ── 8. PEACS screen — tabs, nav, legend, map buttons ────────────────────
  var ps = function(id, key) { var el = document.getElementById(id); if (el && (t[key]||enT[key])) el.textContent = t[key]||enT[key]; };
  ps('peacs-back-btn',      'peacsBack');
  ps('tab-results-btn',     'peacsTabResults');
  ps('peacs-globe-btn',     'mapGlobe');
  ps('peacs-flat-btn',      'mapFlat');
  ps('peacs-spectator-btn', 'peacsSpectator');

  // PEACS tab bar — match by data-tab attribute
  document.querySelectorAll('#screen-peacs [data-tab]').forEach(function(btn) {
    var tab = btn.getAttribute('data-tab');
    var keyMap = {
      assess: 'peacsTabAssess', results: 'peacsTabResults',
      map: 'peacsTabMap', kybos: 'peacsTabKybos',
      loom: 'peacsTabLoom', diagnostics: 'peacsTabDiag',
    };
    if (keyMap[tab] && (t[keyMap[tab]]||enT[keyMap[tab]])) btn.textContent = t[keyMap[tab]]||enT[keyMap[tab]];
  });

  // PEACS map overlay text
  var peacsGlobalEl = document.querySelector('#screen-peacs .map-stat-eyebrow');
  if (peacsGlobalEl) peacsGlobalEl.textContent = t.peacsGlobal || enT.peacsGlobal;
  var peacsAssEl = document.querySelector('#screen-peacs .map-stat-sub');
  if (peacsAssEl) peacsAssEl.textContent = t.peacsAssessments || enT.peacsAssessments;

  // PEACS legend
  var legTitle = document.querySelector('#screen-peacs .map-legend-title');
  if (legTitle) legTitle.textContent = t.peacsLegendTitle || enT.peacsLegendTitle;
  var legMap = ['peacsOptimal','peacsGood','peacsModerate','peacsPoor','peacsCritical'];
  document.querySelectorAll('#screen-peacs .legend-lbl').forEach(function(el, i) {
    if (legMap[i] && (t[legMap[i]]||enT[legMap[i]])) el.textContent = t[legMap[i]]||enT[legMap[i]];
  });

  // ── 9. getAdherenceCategory — patch to use translated labels ─────────────
  window._atlasLang = lang;
  window._consentLastLang = lang;
}

// Convenience aliases — all route to setAppLanguage
/**
 * Re-renders all patient-path screens in the specified language.
 * Alias for setAppLanguage() used from inline HTML onchange handlers.
 * @param {string} lang - BCP-47 language code
 * @returns {void}
 */
function renderPatientLanguage(lang) { setAppLanguage(lang); }
function syncConsentLang(langCode)   { setAppLanguage(langCode); }

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT DASHBOARD TAB SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function switchStudentTab(tab) {
  // Update button styles — Publish tab gets gold accent when active
  document.querySelectorAll('.student-tab-btn').forEach(function(btn) {
    var active = btn.dataset.stab === tab;
    var isPublish = btn.dataset.stab === 'publish';
    if (active) {
      btn.style.color             = isPublish ? 'rgba(212,168,67,0.95)' : 'var(--strata)';
      btn.style.borderBottomColor = isPublish ? 'rgba(212,168,67,0.8)' : 'var(--strata)';
    } else {
      btn.style.color             = isPublish ? 'rgba(212,168,67,0.5)' : 'var(--dim)';
      btn.style.borderBottomColor = 'transparent';
    }
  });
  // Show/hide panels
  var panels = ['student-panel-setup', 'student-panel-review', 'student-panel-publish'];
  panels.forEach(function(id) {
    var p = document.getElementById(id);
    if (!p) return;
    var tabKey = id.replace('student-panel-', '');
    p.style.display = tabKey === tab ? '' : 'none';
  });
  if (tab === 'review') { _renderStudentReviewTable(); _updateStudentSessionStats(); }
}

// ── Adherence Benchmarks ──────────────────────────────
const ATLAS_BENCHMARKS = {
  // Published literature baselines (Morisky et al. 2008, global aggregates)
  literature: {
    mmas8_mean: 5.93,
    mmas8_high_pct: 31.4,   // % scoring 8.0
    mmas8_medium_pct: 42.1, // % scoring 6.0–7.9
    mmas8_low_pct: 26.5,    // % scoring <6.0
    source: 'Morisky et al., J Clin Hypertension, 2008 (n=1,367)',
    year: 2008
  },
  // ATLAS global average (live, fetched from Firebase; fallback to stored value)
  global: {
    mmas8_mean: 6.21,       // updated periodically
    mmas8_high_pct: 34.2,
    mmas8_medium_pct: 41.8,
    mmas8_low_pct: 24.0,
    source: 'ATLAS Global Dataset 2026 (N>50,000)',
    year: 2026
  }
};

// ── Benchmark Comparison ──────────────────────────────

function renderBenchmarkStrip(containerId, cohortMean, cohortN) {
  const container = document.getElementById(containerId);
  if (!container || !cohortMean || cohortMean === 0) return;

  const litMean = ATLAS_BENCHMARKS.literature.mmas8_mean;
  const globalMean = ATLAS_BENCHMARKS.global.mmas8_mean;
  const maxScore = 8;

  const cohortPct   = Math.round((cohortMean / maxScore) * 100);
  const litPct      = Math.round((litMean / maxScore) * 100);
  const globalPct   = Math.round((globalMean / maxScore) * 100);

  const vsLit    = cohortMean - litMean;
  const vsGlobal = cohortMean - globalMean;

  const deltaClass = (v) => v > 0.1 ? 'positive' : v < -0.1 ? 'negative' : 'neutral';
  const deltaText  = (v) => (v > 0 ? '+' : '') + v.toFixed(2);
  const barClass   = (v) => v > 0.05 ? 'above' : v < -0.05 ? 'below' : 'neutral';

  container.innerHTML = `
    <div class="benchmark-strip">
      <div class="benchmark-strip-title">
        <span>Benchmark Comparison</span>
        <span style="font-size:0.68rem;color:#9ca3af;font-weight:400;">n=${cohortN || '—'}</span>
      </div>
      <div class="benchmark-rows">
        <div class="benchmark-row">
          <span class="benchmark-row-label">Your Cohort</span>
          <div class="benchmark-bar-track">
            <div class="benchmark-bar-cohort ${barClass(vsGlobal)}" style="width:${cohortPct}%;"></div>
            <div class="benchmark-bar-marker lit"    style="left:${litPct}%;"></div>
            <div class="benchmark-bar-marker global" style="left:${globalPct}%;"></div>
          </div>
          <span class="benchmark-score">${cohortMean.toFixed(2)}</span>
          <span class="benchmark-delta neutral">—</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-row-label" style="color:#7c3aed;">ATLAS Global</span>
          <div class="benchmark-bar-track">
            <div class="benchmark-bar-cohort" style="width:${globalPct}%;background:#7c3aed;"></div>
          </div>
          <span class="benchmark-score" style="color:#7c3aed;">${globalMean.toFixed(2)}</span>
          <span class="benchmark-delta ${deltaClass(vsGlobal)}">${deltaText(vsGlobal)}</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-row-label" style="color:#ef4444;">Literature (2008)</span>
          <div class="benchmark-bar-track">
            <div class="benchmark-bar-cohort" style="width:${litPct}%;background:#ef4444;"></div>
          </div>
          <span class="benchmark-score" style="color:#ef4444;">${litMean.toFixed(2)}</span>
          <span class="benchmark-delta ${deltaClass(vsLit)}">${deltaText(vsLit)}</span>
        </div>
      </div>
      <div class="benchmark-legend">
        <div class="benchmark-legend-item"><div class="benchmark-legend-dot" style="background:#7c3aed;"></div>ATLAS Global 2026</div>
        <div class="benchmark-legend-item"><div class="benchmark-legend-dot" style="background:#ef4444;"></div>Morisky et al. 2008</div>
        <div class="benchmark-legend-item" style="font-size:0.65rem;color:#bbb;">Delta = Your cohort vs benchmark</div>
      </div>
    </div>`;
}

function _updateStudentSessionStats() {
  try {
    var allData = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
    // MMAS-8 column: exclude MAP records (tool:'map' or map_q1 present)
    var rows  = allData.filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined; });
    // MAP column: MAP records only
    var mapR  = allData.filter(function(r) { return r.tool === 'map' || r.map_q1 !== undefined; });
    var count = rows.length;
    var avg   = count ? (rows.reduce(function(s, r) { return s + (parseFloat(r.score) || 0); }, 0) / count).toFixed(1) : '—';
    var low   = rows.filter(function(r) { return parseFloat(r.score) < 6; }).length;
    var sc = document.getElementById('stu-session-count'); if (sc) sc.textContent = count || '0';
    var sa = document.getElementById('stu-session-avg');   if (sa) sa.textContent = count ? avg : '—';
    var sl = document.getElementById('stu-session-low');   if (sl) sl.textContent = count ? low : '—';
    // Update MAP count in cohort snapshot
    var smn = document.getElementById('stu-val-map-n'); if (smn) smn.textContent = mapR.length || '—';

    // Compute INA / UNA / Mixed / High pattern counts
    var cHigh = 0, cINA = 0, cUNA = 0, cMixed = 0;
    rows.forEach(function(r) {
      var s = parseFloat(r.score) || 0;
      if (s >= 8) { cHigh++; return; }
      if (r.q1 === undefined) { cUNA++; return; } // no item-level data → treat as UNA
      if (typeof classifyPattern === 'function') {
        var cp = classifyPattern(r);
        if (cp.intentional > cp.unintentional) cINA++;
        else if (cp.unintentional > cp.intentional) cUNA++;
        else cMixed++;
      } else {
        if (s < 4) cINA++; else if (s < 6) cUNA++; else cMixed++;
      }
    });
    var setEl = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('stu-count-high',  count ? cHigh  : '—');
    setEl('stu-count-ina',   count ? cINA   : '—');
    setEl('stu-count-una',   count ? cUNA   : '—');
    setEl('stu-count-mixed', count ? cMixed : '—');

    // Score distribution bar
    if (count > 0) {
      var setPct = function(id, n) { var el = document.getElementById(id); if (el) el.style.width = Math.round(n/count*100) + '%'; };
      setPct('stu-bar-high',  cHigh);
      setPct('stu-bar-una',   cUNA);
      setPct('stu-bar-ina',   cINA);
      setPct('stu-bar-mixed', cMixed);
    }

    const stuMean = parseFloat(avg) || 0;
    renderBenchmarkStrip('stu-benchmark-container', stuMean, rows.length);
    renderStudentPeDomain(allData);  // full dataset — MAP filter applied inside the function
    renderStudentSentinel(rows);
    _updateStudentValidationPanel();
    // Refresh thesis export, power advisor, PEACS tracker, and map badge
    if (typeof window._stuThesisRefreshFromStats === 'function') {
      try { window._stuThesisRefreshFromStats(); } catch(e) {}
    }
  } catch(e) {}
}

// ── Track A · MAP PE Domain (student read-only) ──────────
function renderStudentPeDomain(cohortData) {
  var _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  // MAP records only — tool:'map' or presence of map_q1
  var mapRecs = (cohortData || []).filter(function(r) {
    return r.tool === 'map' || r.map_q1 !== undefined;
  });
  var setEl = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  if (!mapRecs.length) {
    setEl('stu-pe-arch-score',      '—');
    setEl('stu-pe-exec-score',      '—');
    setEl('stu-pe-ctx-score',       '—');
    setEl('stu-pe-composite-score', '—');
    var cl = document.getElementById('stu-pe-constraint-label');
    if (cl) cl.textContent = _t.sentinel_no_map_records || 'No MAP records yet — run Track A sessions to populate.';
    return;
  }
  var sumA = 0, sumE = 0, sumC = 0, n = 0;
  mapRecs.forEach(function(r) {
    var a = (parseFloat(r.map_q2||0)+parseFloat(r.map_q3||0)+parseFloat(r.map_q6||0))/3;
    var e = (parseFloat(r.map_q1||0)+parseFloat(r.map_q5||0)+parseFloat(r.map_q8||0))/3;
    var c = 0.5 + 0.5*(parseFloat(r.map_q4||0)+parseFloat(r.map_q7||0))/2;
    sumA += a; sumE += e; sumC += c; n++;
  });
  var avgA = sumA / n, avgE = sumE / n, avgC = sumC / n;
  var pe   = Math.pow(Math.max(0, avgA * avgE * avgC), 1/3);
  var fmt  = function(v) { return isNaN(v) || !isFinite(v) ? '—' : v.toFixed(3); };
  setEl('stu-pe-arch-score',      fmt(avgA));
  setEl('stu-pe-exec-score',      fmt(avgE));
  setEl('stu-pe-ctx-score',       fmt(avgC));
  setEl('stu-pe-composite-score', fmt(pe));
  var domains = [{name:'Architecture', val:avgA},{name:'Execution',val:avgE},{name:'Context',val:avgC}];
  var primary = domains.slice().sort(function(a,b){ return a.val-b.val; })[0];
  var cl = document.getElementById('stu-pe-constraint-label');
  if (cl && isFinite(primary.val))
    cl.textContent = (_t.sentinel_primary_constraint || 'Primary constraint') + ': ' + primary.name + ' · ' + mapRecs.length + ' ' + (_t.map_records_analyzed || 'MAP records analyzed');
}

// ── MMAS-8 Sentinel Risk Queue (student) ─────────────────
function renderStudentSentinel(cohortData) {
  var _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  var sentBody  = document.getElementById('stu-sentinel-body');
  var sentBadge = document.getElementById('stu-sentinel-count-badge');
  if (!sentBody) return;
  // MMAS records only (not MAP), score ≤ 4
  var mmasRecs = (cohortData || []).filter(function(r) {
    return r.tool !== 'map' && r.map_q1 === undefined;
  });
  var atRisk = mmasRecs.filter(function(r) { return (parseFloat(r.score)||0) <= 4; });
  // Sort by score ascending (most critical first)
  atRisk.sort(function(a,b) { return (a.score||0) - (b.score||0); });
  if (!atRisk.length) {
    sentBody.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.80rem;color:#94a3b8;text-align:center;padding:14px 0;">' + (_t.sentinel_no_mmas_risk || 'No critical-risk MMAS-8 records (score \u2264 4) in your cohort.') + '</div>';
    if (sentBadge) sentBadge.style.display = 'none';
    return;
  }
  if (sentBadge) { sentBadge.textContent = atRisk.length + ' ' + (_t.sentinel_at_risk || 'at risk'); sentBadge.style.display = ''; }
  var rows = atRisk.slice(0, 10).map(function(r) {
    var score = parseFloat(r.score)||0;
    var col = score <= 2 ? '#dc2626' : '#f59e0b';
    var pid = r.patient_number || r.patientId || '—';
    var cond = r.condition || '—';
    var country = r.country || '—';
    var pattern = '—';
    if (typeof classifyPattern === 'function' && r.q1 !== undefined) {
      try { var cp = classifyPattern(r); pattern = cp.intentional > cp.unintentional ? 'INA' : cp.unintentional > cp.intentional ? 'UNA' : 'Mixed'; } catch(e) {}
    }
    return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:7px 10px;border-radius:6px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);margin-bottom:5px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">PID ' + pid + '</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.70rem;color:#64748b;">' + cond + '</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#dc2626;border-radius:4px;padding:1px 6px;">' + pattern + '</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:1.1rem;font-weight:700;color:' + col + ';">' + score.toFixed(1) + '</span>' +
      '</div>';
  }).join('');
  if (atRisk.length > 10) rows += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:#94a3b8;text-align:center;margin-top:6px;">+ ' + (atRisk.length - 10) + ' ' + (_t.sentinel_more_patients || 'more patients \u2014 export full list for complete review') + '</div>';
  sentBody.innerHTML = rows;
}

// ── Clinician Dashboard KPI + Sentinel + Billing updater ─────────────────────
// Mirrors _cpoUpdate() logic but targets clin-* element IDs in the
// clinician-dash-panel injected by enterResearcherDashboard().
function _updateClinicianDash() {
  try {
    const _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
    const panel = document.getElementById('clinician-dash-panel');
    if (!panel) return;

    const rows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
    const mmasRows = rows.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
    const count = mmasRows.length;
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // ── KPI: Total, Average, Sentinel count, Follow-up due ───────────────────
    const avg = count ? (mmasRows.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) / count).toFixed(1) : null;
    const sentinelRecs = mmasRows.filter(r => (parseFloat(r.score) || 0) <= 4);
    const sentinelCount = sentinelRecs.length;

    // Follow-up due: patients whose latest score < 6 AND last seen > 30 days ago
    const cutoff = Date.now() - 30 * 86400000;
    const byPatient = {};
    mmasRows.forEach(r => {
      const pid = r.patient_number || r.user_id || '_anon';
      if (!byPatient[pid] || (r.timestamp || 0) > (byPatient[pid].timestamp || 0)) byPatient[pid] = r;
    });
    const followupDue = Object.values(byPatient).filter(r =>
      (parseFloat(r.score) || 8) < 6 && (r.timestamp || 0) < cutoff
    ).length;

    setText('clin-kpi-total',    count || 0);
    setText('clin-kpi-avg',      avg || '—');
    setText('clin-kpi-sentinel', sentinelCount);
    setText('clin-kpi-followup', followupDue);

    // Color sentinel/followup counts
    const sentEl = document.getElementById('clin-kpi-sentinel');
    if (sentEl) sentEl.style.color = sentinelCount > 0 ? '#dc2626' : '#94a3b8';
    const fuEl = document.getElementById('clin-kpi-followup');
    if (fuEl) fuEl.style.color = followupDue > 0 ? '#d97706' : '#94a3b8';

    // ── Patient count label ───────────────────────────────────────────────────
    setText('clin-rpp-count', count + ' patient' + (count !== 1 ? 's' : ''));

    // Resolve placeholder: point to the researcher-patient-panel table below
    const _clinPlaceholder = document.getElementById('clin-rpp-placeholder');
    if (_clinPlaceholder) {
      if (count > 0) {
        _clinPlaceholder.innerHTML = '<div style="text-align:center;padding:10px 0;">' +
          '<a href="#" onclick="(function(){var t=document.getElementById(\'researcher-patient-panel\');if(t)t.scrollIntoView({behavior:\'smooth\',block:\'start\'});return false;})()" ' +
          'style="font-family:\'IBM Plex Mono\',monospace;font-size:0.76rem;color:#2563eb;text-decoration:none;">' +
          '↓ ' + count + ' records — scroll to full table</a></div>';
      } else {
        _clinPlaceholder.textContent = _t.empty_no_records_start || 'No records yet — start an assessment above.';
      }
    }

    // ── Sentinel section: at-risk patients (score ≤ 4), worst first ──────────
    const sentBody  = document.getElementById('clin-sentinel-body');
    const sentBadge = document.getElementById('clin-sentinel-badge');
    if (sentBody) {
      if (!sentinelCount) {
        sentBody.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.80rem;color:#94a3b8;text-align:center;padding:14px 0;">' + (_t.sentinel_cohort_stable || 'No patients at critical risk \u2014 cohort looks stable.') + '</div>';
        if (sentBadge) sentBadge.style.display = 'none';
      } else {
        if (sentBadge) { sentBadge.textContent = sentinelCount + ' ' + (_t.sentinel_at_risk || 'at risk'); sentBadge.style.display = ''; }
        const sorted = sentinelRecs.slice().sort((a, b) => (parseFloat(a.score)||0) - (parseFloat(b.score)||0));
        const renderRows = sorted.slice(0, 12).map(r => {
          const score = parseFloat(r.score) || 0;
          const col   = score <= 2 ? '#dc2626' : '#f59e0b';
          const pid   = r.patient_number || r.patientId || '—';
          const cond  = r.condition || '—';
          let pattern = '—';
          if (typeof classifyPattern === 'function' && r.q1 !== undefined) {
            try {
              const cp = classifyPattern(r);
              pattern = cp.intentional > cp.unintentional ? 'INA' : cp.unintentional > cp.intentional ? 'UNA' : 'Mixed';
            } catch(e) {}
          }
          // Days since last seen
          const daysSince = r.timestamp ? Math.floor((Date.now() - r.timestamp) / 86400000) : null;
          const daysStr   = daysSince !== null ? (daysSince === 0 ? 'today' : daysSince + 'd ago') : '—';
          return `<div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:8px;align-items:center;padding:8px 12px;border-radius:6px;background:rgba(220,38,38,0.03);border:1px solid rgba(220,38,38,0.12);margin-bottom:5px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">PID ${_esc ? _esc(String(pid)) : String(pid)}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;" title="${_esc ? _esc(String(cond)) : String(cond)}">${_esc ? _esc(String(cond)) : String(cond)}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.2);color:#dc2626;border-radius:4px;padding:1px 6px;">${pattern}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:#94a3b8;">${daysStr}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:${col};">${score.toFixed(1)}</span>
          </div>`;
        }).join('');
        const overflow = sorted.length > 12
          ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:#94a3b8;text-align:center;margin-top:6px;">+ ${sorted.length - 12} more — scroll patient table below</div>`
          : '';
        sentBody.innerHTML = renderRows + overflow;
      }
    }

    // ── Billing: MTM CPT codes (walk full history for 99605 vs 99606) ─────────
    const timed = window._mtmManualEncounters || [];
    const now   = new Date();
    const yr = now.getFullYear(), mo = now.getMonth() + 1;
    const isThisMonth = ts => { const d = new Date(ts); return d.getFullYear() === yr && d.getMonth() + 1 === mo; };
    const fullHist = {};
    let n99605 = 0, n99606 = 0, n99607 = 0;
    [...mmasRows].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).forEach(r => {
      const pid = r.patient_number || r.user_id || '';
      if (typeof mtmSuggestCPT === 'function') {
        const cpt = mtmSuggestCPT(r, fullHist);
        fullHist[pid] = (fullHist[pid] || 0) + 1;
        if (!r.timestamp || !isThisMonth(r.timestamp)) return;
        if (cpt === '99605') n99605++;
        else if (cpt === '99606') n99606++;
        else if (cpt === '99607') n99607++;
      }
    });
    timed.filter(e => e.timestamp && isThisMonth(e.timestamp)).forEach(e => {
      const c = (e.cpt_primary || '').toString();
      if (c.includes('99605')) n99605++;
      else if (c.includes('99606')) n99606++;
      else if (c.includes('99607')) n99607++;
    });

    // CCM / RTM: pull from stored billing panels if available
    const ccmEl = document.getElementById('bill-mo-ccm');
    const rtmEl = document.getElementById('bill-mo-rtm');
    const ccmVal = ccmEl ? ccmEl.textContent : '—';
    const rtmVal = rtmEl ? rtmEl.textContent : '—';

    // Estimated revenue: 99605≈$85 · 99606≈$52 · 99607≈$25
    const estRev = n99605 * 85 + n99606 * 52 + n99607 * 25;
    const fmtRev = estRev === 0 ? '—'
      : estRev >= 1000 ? '$' + (estRev / 1000).toFixed(1) + 'k'
      : '$' + estRev;

    setText('clin-bill-99605', n99605 || '—');
    setText('clin-bill-99606', n99606 || '—');
    setText('clin-bill-99607', n99607 || '—');
    setText('clin-bill-ccm',   ccmVal);
    setText('clin-bill-rtm',   rtmVal);
    setText('clin-bill-rev',   fmtRev);

    // ── Cohort Analytics (collapsed accordion): pattern counts ───────────────
    let cHigh = 0, cINA = 0, cUNA = 0, cMixed = 0;
    mmasRows.forEach(r => {
      const s = parseFloat(r.score) || 0;
      if (s >= 8) { cHigh++; return; }
      if (r.q1 === undefined) { cUNA++; return; }
      if (typeof classifyPattern === 'function') {
        try {
          const cp = classifyPattern(r);
          if (cp.intentional > cp.unintentional) cINA++;
          else if (cp.unintentional > cp.intentional) cUNA++;
          else cMixed++;
        } catch(e) { cUNA++; }
      } else {
        if (s < 4) cINA++; else if (s < 6) cUNA++; else cMixed++;
      }
    });
    setText('clin-count-high',  count ? cHigh  : '—');
    setText('clin-count-ina',   count ? cINA   : '—');
    setText('clin-count-una',   count ? cUNA   : '—');
    setText('clin-count-mixed', count ? cMixed : '—');

  } catch(e) { console.warn('_updateClinicianDash error:', e); }
}

function _renderStudentReviewTable(resetPage) {
  var _t = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) || (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS.en) || {};
  var el = document.getElementById('stu-review-table');
  if (!el) return;
  try {
    var rows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
    if (!rows.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;color:#94a3b8;">' + (_t.empty_no_records_start || 'No records yet — start a session or import data.') + '</div>';
      return;
    }
    if (resetPage) window._stuPage = 0;
    if (window._stuPageSize === undefined) window._stuPageSize = 10;
    if (window._stuPage === undefined) window._stuPage = 0;
    var pageSize = window._stuPageSize;
    var total = rows.length;
    var totalPages = Math.ceil(total / pageSize);
    var page = Math.min(window._stuPage, totalPages - 1);
    window._stuPage = page;
    var start = page * pageSize;
    var end = Math.min(start + pageSize, total);
    var pageRows = rows.slice(start, end);

    var html = '<div style="overflow-x:auto;">';

    // ── Pagination controls ──
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">';
    html += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;color:#94a3b8;">Showing ' + (start + 1) + '–' + end + ' of ' + total + ' records</span>';
    html += '<div style="display:flex;gap:5px;align-items:center;">';
    html += '<select onchange="window._stuPageSize=parseInt(this.value);window._stuPage=0;_renderStudentReviewTable();" style="background:#fff;border:1px solid rgba(0,0,0,0.14);color:#374151;padding:4px 7px;font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;border-radius:4px;cursor:pointer;">';
    [10, 20, 50, 100].forEach(function(n) {
      html += '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + n + ' / page</option>';
    });
    html += '</select>';
    var prevDis = page === 0 ? ' disabled' : '';
    var nextDis = page >= totalPages - 1 ? ' disabled' : '';
    html += '<button' + prevDis + ' onclick="if(window._stuPage>0){window._stuPage--;_renderStudentReviewTable();}" style="padding:4px 9px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;background:#f0f2f5;border:1px solid rgba(0,0,0,0.12);color:#374151;border-radius:4px;cursor:pointer;' + (page === 0 ? 'opacity:0.35;cursor:default;' : '') + '">‹</button>';
    html += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;color:#475569;min-width:44px;text-align:center;">' + (page + 1) + ' / ' + totalPages + '</span>';
    html += '<button' + nextDis + ' onclick="if(window._stuPage<' + (totalPages - 1) + '){window._stuPage++;_renderStudentReviewTable();}" style="padding:4px 9px;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;background:#f0f2f5;border:1px solid rgba(0,0,0,0.12);color:#374151;border-radius:4px;cursor:pointer;' + (page >= totalPages - 1 ? 'opacity:0.35;cursor:default;' : '') + '">›</button>';
    html += '</div></div>';

    // ── Table ──
    html += '<table style="width:100%;border-collapse:collapse;font-family:\'IBM Plex Mono\',monospace;font-size:0.73rem;">';
    html += '<thead><tr style="border-bottom:2px solid rgba(0,0,0,0.08);">';
    ['Patient ID', 'Tool', 'Score / PE', 'Pattern', 'Sex', 'Age Range', 'Country', 'Study / Session', 'Date'].forEach(function(h) {
      html += '<th style="text-align:left;padding:8px 10px;font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;font-weight:500;white-space:nowrap;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';

    pageRows.forEach(function(r) {
      var date = r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '—';
      var pid = r.patient_number || r.pid || '—';
      var pattern = r.pattern || '—';
      var sex = r.gender || r.sex || '—';
      var ageRange = r.age_range || '—';
      var country = r.country || '—';
      var study = r.study_title || r.session_name || r.study_name || '—';
      var studyDisplay = study.length > 22 ? study.substring(0, 22) + '…' : study;

      // Detect instrument: MAP has tool:'map' or map_q1 fields (map_ prefix).
      // MMAS-8 uses q1–q8 (no prefix) — do NOT use r.q1 as a MAP indicator.
      var isMap = r.tool === 'map' || r.map_q1 !== undefined;
      var toolLabel = isMap ? 'MAP' : 'MMAS-8';
      var toolColor = isMap ? '#0369a1' : '#7c3aed';
      var toolBg    = isMap ? 'rgba(3,105,161,0.08)' : 'rgba(124,58,237,0.08)';

      // Score display: MAP shows PE (geometric mean of Arch × Exec × Ctx domains)
      // MMAS-8 shows additive score (0–8)
      var scoreDisplay, sc;
      if (isMap) {
        var arch = ((parseFloat(r.map_q2)||0) + (parseFloat(r.map_q3)||0) + (parseFloat(r.map_q6)||0)) / 3;
        var exec = ((parseFloat(r.map_q1)||0) + (parseFloat(r.map_q4)||0) + (parseFloat(r.map_q5)||0) + (parseFloat(r.map_q8)||0)) / 4;
        var ctx  = parseFloat(r.map_q7) || 0;
        var pe   = (arch > 0 && exec > 0 && ctx > 0) ? Math.pow(arch * exec * ctx, 1/3) : null;
        scoreDisplay = pe !== null ? pe.toFixed(3) : (r.map_pe !== undefined ? parseFloat(r.map_pe).toFixed(3) : '—');
        var peVal = pe !== null ? pe : parseFloat(r.map_pe) || 0;
        sc = peVal >= 3.5 ? '#059669' : peVal >= 2.5 ? '#d97706' : '#dc2626';
      } else {
        var score = parseFloat(r.score) || 0;
        scoreDisplay = score.toFixed(2);
        sc = score >= 8 ? '#059669' : score >= 6 ? '#d97706' : '#dc2626';
      }

      var rKey = (r.user_id || pid) + '|' + (r.timestamp || '0');
      var safeKey = rKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      html += '<tr onclick="_stuShowPatientDetail(\'' + safeKey + '\')" style="border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;transition:background 0.12s;" onmouseover="this.style.background=\'#eef2ff\'" onmouseout="this.style.background=\'\'">';
      html += '<td style="padding:8px 10px;color:#1e293b;font-weight:500;">' + pid + '</td>';
      html += '<td style="padding:8px 10px;"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.60rem;letter-spacing:0.08em;font-weight:600;color:' + toolColor + ';background:' + toolBg + ';padding:2px 7px;border-radius:4px;">' + toolLabel + '</span></td>';
      html += '<td style="padding:8px 10px;color:' + sc + ';font-weight:600;">' + scoreDisplay + '</td>';
      html += '<td style="padding:8px 10px;color:#475569;">' + pattern + '</td>';
      html += '<td style="padding:8px 10px;color:#64748b;">' + sex + '</td>';
      html += '<td style="padding:8px 10px;color:#64748b;">' + ageRange + '</td>';
      html += '<td style="padding:8px 10px;color:#64748b;">' + country + '</td>';
      html += '<td style="padding:8px 10px;color:#475569;" title="' + study.replace(/"/g, '&quot;') + '">' + studyDisplay + '</td>';
      html += '<td style="padding:8px 10px;color:#94a3b8;white-space:nowrap;">' + date + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="color:#dc2626;padding:16px;font-family:\'IBM Plex Mono\',monospace;font-size:0.78rem;">Unable to load records.</div>';
  }
}

function _stuShowPatientDetail(key) {
  var rows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
  var r = rows.find(function(rec) {
    return ((rec.user_id || rec.patient_number || rec.pid || '') + '|' + (rec.timestamp || '0')) === key;
  });
  if (!r) return;
  if (typeof _renderPatientRecord === 'function') {
    _renderPatientRecord(r);
    var modal = document.getElementById('patient-record-modal');
    if (modal) modal.style.display = 'flex';
  }
}

function _stuExportMMAS() {
  if (typeof exportMMASCSV === 'function') { exportMMASCSV(); return; }
  var btn = document.getElementById('dash-mmas-export-btn');
  if (btn) btn.click();
  else showToast('Use the Export MMAS CSV button on the instrument card below.', 3500);
}

function _stuExportPEACS() {
  var btn = document.getElementById('dash-export-btn') || document.getElementById('peacs-export-btn');
  if (btn) btn.click();
  else showToast('Open PEACS from the instrument card below to export PEACS data.', 3500);
}

// ── Student Validation Study Panel ──────────────────────────────────────────
// Populates Cronbach α, item-total correlations, domain scores, and MAP↔MMAS-8
// convergent validity in the student psychometric validation module.
// MAP records: q1 is defined (item-level data stored)
// MMAS-8 records: q1 === undefined (only total score stored)
// Domain mapping per TPE spec: Arch=Q2,Q3,Q6 · Exec=Q1,Q4,Q5,Q8 · Ctx=Q7
function _updateStudentValidationPanel() {
  try {
    var placeholder = document.getElementById('stu-val-placeholder');
    var panel = document.getElementById('stu-validation-panel');
    if (!panel) return;
    var allRows  = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
    // MAP records are stored with map_q1..map_q8 keys and tool:'map'
    var mapRows  = allRows.filter(function(r) { return r.tool === 'map' || r.map_q1 !== undefined; });
    // MMAS-8 records have q1..q8 keys and no map_q1
    var mmasRows = allRows.filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined; });

    var setEl = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v !== undefined && v !== null ? v : '—'; };

    setEl('stu-val-map-n',  mapRows.length  || '—');
    setEl('stu-val-mmas-n', mmasRows.length || '—');

    // Show placeholder if too few MAP records for meaningful stats
    if (mapRows.length < 10) {
      if (placeholder) placeholder.style.display = '';
      panel.style.display = 'none';
      return;
    }
    if (placeholder) placeholder.style.display = 'none';
    panel.style.display = '';

    var n = mapRows.length;
    var fmt2 = function(v) { return (!isNaN(v) && v !== null) ? v.toFixed(2) : '—'; };
    var fmt3 = function(v) { return (!isNaN(v) && v !== null) ? v.toFixed(3) : '—'; };

    // ── Cronbach's alpha ──────────────────────────────────────────────────
    // α = (k/(k-1)) × (1 − ΣVar_i / Var_total)
    var _alpha = function(rows, items) {
      var m = rows.length;
      if (m < 2) return NaN;
      var k = items.length;
      var itemScores = items.map(function(it) { return rows.map(function(r) { return +(r[it]||0); }); });
      var totals = rows.map(function(r) { return items.reduce(function(s,it){return s + (r[it]||0);},0); });
      var tMean = totals.reduce(function(a,b){return a+b;},0)/m;
      var tVar  = totals.reduce(function(s,t){return s+Math.pow(t-tMean,2);},0)/(m-1);
      if (tVar === 0) return NaN;
      var sumIV = itemScores.reduce(function(s, sc) {
        var mn = sc.reduce(function(a,b){return a+b;},0)/m;
        return s + sc.reduce(function(sv,x){return sv+Math.pow(x-mn,2);},0)/(m-1);
      },0);
      return (k/(k-1)) * (1 - sumIV/tVar);
    };

    var _ALL  = ['q1','q2','q3','q4','q5','q6','q7','q8'];
    var _ARCH = ['q2','q3','q6'];
    var _EXEC = ['q1','q4','q5','q8'];
    // q7 is Context (single item — α not computable, show N/A)

    var alphaAll  = _alpha(mapRows, _ALL);
    var alphaArch = _alpha(mapRows, _ARCH);
    var alphaExec = _alpha(mapRows, _EXEC);

    setEl('stu-val-alpha',      fmt2(alphaAll));
    setEl('stu-val-alpha-arch', alphaArch > 0 ? fmt2(alphaArch) : 'N/A');
    setEl('stu-val-alpha-exec', alphaExec > 0 ? fmt2(alphaExec) : 'N/A');

    // ── Corrected item-total correlations ─────────────────────────────────
    // r_it = Pearson r between item and (total − item)
    var domainOf = { q1:'Exec',q2:'Arch',q3:'Arch',q4:'Exec',q5:'Exec',q6:'Arch',q7:'Ctx',q8:'Exec' };
    var domColor  = { Arch:'#d4a843', Exec:'#4e9cf5', Ctx:'#059669' };
    var itcGrid = document.getElementById('stu-val-itc-grid');
    if (itcGrid) {
      var itcHtml = '';
      _ALL.forEach(function(item, idx) {
        var rest = _ALL.filter(function(_,i){return i!==idx;});
        var xs = mapRows.map(function(r){return +(r[item]||0);});
        var ys = mapRows.map(function(r){return rest.reduce(function(s,it){return s + (r[it]||0);},0);});
        var mx=xs.reduce(function(a,b){return a+b;},0)/n, my=ys.reduce(function(a,b){return a+b;},0)/n;
        var num=0,dx2=0,dy2=0;
        for(var i=0;i<n;i++){var dx=xs[i]-mx,dy=ys[i]-my;num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy;}
        var r_it = (dx2>0&&dy2>0) ? num/Math.sqrt(dx2*dy2) : NaN;
        var pct   = isNaN(r_it) ? 0 : Math.max(0, Math.round(r_it*100));
        var dom   = domainOf[item] || '?';
        var col   = domColor[dom]  || '#94a3b8';
        var qNum  = item.toUpperCase();
        itcHtml += '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;font-weight:700;color:' + col + ';width:22px;flex-shrink:0;">' + qNum + '</span>' +
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;color:#94a3b8;width:26px;flex-shrink:0;">' + dom + '</span>' +
          '<div style="flex:1;height:7px;background:#e2e8f0;border-radius:3px;overflow:hidden;">' +
            '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:3px;transition:width 0.5s;"></div>' +
          '</div>' +
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.54rem;color:#475569;width:38px;text-align:right;flex-shrink:0;">' + fmt3(r_it) + '</span>' +
        '</div>';
      });
      itcGrid.innerHTML = itcHtml;
    }

    // ── Domain averages (corrected mapping: Arch=Q2,Q3,Q6 · Exec=Q1,Q4,Q5,Q8 · Ctx=Q7) ─
    var sumA = 0, sumE = 0, sumC = 0;
    mapRows.forEach(function(r) {
      sumA += ((+r.q2||0) + (+r.q3||0) + (+r.q6||0)) / 3;
      sumE += ((+r.q1||0) + (+r.q4||0) + (+r.q5||0) + (+r.q8||0)) / 4;
      sumC +=  (+r.q7||0);
    });
    var avgA = sumA/n, avgE = sumE/n, avgC = sumC/n;
    setEl('stu-val-arch-val', fmt2(avgA));
    setEl('stu-val-exec-val', fmt2(avgE));
    // Bar widths — MAP items are 0–1 binary; avg domain score is 0–1 scale
    var barEl = function(id, val) { var el = document.getElementById(id); if (el && !isNaN(val)) el.style.width = Math.min(100, Math.round(val*100)) + '%'; };
    barEl('stu-val-arch-bar', avgA);
    barEl('stu-val-exec-bar', avgE);

    // Matched pairs — same patient_number appears in both MAP and MMAS-8 sets
    var mapByPat  = {};
    var mmasByPat = {};
    mapRows.forEach(function(r)  { var p = r.patient_number||''; if (p) mapByPat[p]  = r; });
    mmasRows.forEach(function(r) { var p = r.patient_number||''; if (p) mmasByPat[p] = r; });
    var paired = Object.keys(mapByPat).filter(function(p) { return mmasByPat[p]; });
    setEl('stu-val-paired-n', paired.length || '—');

    if (paired.length >= 3) {
      // Pearson r between MAP score and MMAS-8 score for matched pairs
      var xs = paired.map(function(p) { return parseFloat(mapByPat[p].score)||0; });
      var ys = paired.map(function(p) { return parseFloat(mmasByPat[p].score)||0; });
      var nn = xs.length;
      var mx = xs.reduce(function(a,b){return a+b;},0)/nn;
      var my = ys.reduce(function(a,b){return a+b;},0)/nn;
      var num = 0, dx2 = 0, dy2 = 0;
      for (var i=0;i<nn;i++) { var dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
      var r = (dx2>0&&dy2>0) ? num/Math.sqrt(dx2*dy2) : NaN;
      setEl('stu-val-r', !isNaN(r) ? r.toFixed(3) : '—');

      // Classification agreement
      var agree = 0, extra = 0;
      paired.forEach(function(p) {
        var mRec = mapByPat[p], xRec = mmasByPat[p];
        var mPat = mRec.score>=8 ? 'high' : '?';
        var xPat = xRec.score>=8 ? 'high' : '?';
        if (typeof classifyPattern === 'function' && mRec.q1 !== undefined) {
          var cp = classifyPattern(mRec);
          mPat = cp.intentional>cp.unintentional ? 'ina' : cp.unintentional>cp.intentional ? 'una' : mRec.score>=8 ? 'high' : 'mixed';
        }
        if (typeof classifyPattern === 'function' && xRec.q1 !== undefined) {
          var cp2 = classifyPattern(xRec);
          xPat = cp2.intentional>cp2.unintentional ? 'ina' : cp2.unintentional>cp2.intentional ? 'una' : xRec.score>=8 ? 'high' : 'mixed';
        } else {
          xPat = parseFloat(xRec.score)>=8 ? 'high' : parseFloat(xRec.score)>=6 ? 'una' : 'ina';
        }
        if (mPat === xPat) agree++;
        // MAP flags non-adherence where MMAS-8 didn't
        if ((mPat==='ina'||mPat==='una'||mPat==='mixed') && xPat==='high') extra++;
      });
      setEl('stu-val-agree-pct', Math.round(agree/nn*100)+'%');
      setEl('stu-val-extra-pct', Math.round(extra/nn*100)+'%');
    } else {
      setEl('stu-val-r', '—');
      setEl('stu-val-agree-pct', '—');
      setEl('stu-val-extra-pct', '—');
    }
  } catch(e) {}
}

function _stuExportValidationBundle() {
  try {
    var allRows = (typeof dashMmasData !== 'undefined' && Array.isArray(dashMmasData) ? dashMmasData : []);
    var mapByPat  = {};
    var mmasByPat = {};
    allRows.filter(function(r) { return r.tool === 'map' || r.map_q1 !== undefined; })
           .forEach(function(r) { var p=r.patient_number||''; if(p) mapByPat[p]  = r; });
    allRows.filter(function(r) { return r.tool !== 'map' && r.map_q1 === undefined; })
           .forEach(function(r) { var p=r.patient_number||''; if(p) mmasByPat[p] = r; });
    var paired = Object.keys(mapByPat).filter(function(p) { return mmasByPat[p]; });
    if (!paired.length) {
      showToast('No matched pairs found — collect MAP and MMAS-8 from the same patients.', 4000);
      return;
    }
    var hdr = ['patient_number','map_score','map_arch','map_exec','map_ctx','map_pe',
               'mmas_score','mmas_pattern','country','map_timestamp','mmas_timestamp'].join(',');
    var rows = paired.map(function(p) {
      var m = mapByPat[p], x = mmasByPat[p];
      // Architecture = mean(Q2, Q3, Q6); Execution = mean(Q1, Q5, Q8); Context-Guard = 0.5+0.5×mean(Q4, Q7)
      var a = ((+m.map_q2||0)+(+m.map_q3||0)+(+m.map_q6||0))/3;
      var e = ((+m.map_q1||0)+(+m.map_q5||0)+(+m.map_q8||0))/3;
      var c = 0.5 + 0.5*((+m.map_q4||0)+(+m.map_q7||0))/2;
      var pe = Math.pow(Math.max(0, a*e*c), 1/3);
      return [p, (m.score||0).toFixed(2), a.toFixed(2), e.toFixed(2), c.toFixed(2),
              (isNaN(pe)?'':pe.toFixed(3)), (x.score||0).toFixed(2),
              x.pattern||'', x.country||'',
              m.timestamp||'', x.timestamp||''].join(',');
    });
    var csv = [hdr].concat(rows).join('\n');
    var blob = new Blob([csv], {type:'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'atlas_validation_bundle.csv'; a.click();
    URL.revokeObjectURL(url);
  } catch(e) { showToast('Export failed: ' + e.message, 3500); }
}

