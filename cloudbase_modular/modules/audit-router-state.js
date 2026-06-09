/**
 * HTML-escapes a value for safe insertion into HTML markup.
 * @param {*} str - Value to escape; null/undefined becomes an empty string
 * @returns {string} HTML-escaped string
 */
function _esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Modal accessibility utility (WCAG 2.1 — 4.1.2, 2.4.3) ──────────────────
(function() {
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let _prevFocus = null;
  /**
   * Opens a modal dialog with WCAG-compliant focus trap and Escape key handling.
   * @param {HTMLElement} el - The modal DOM element to open
   * @param {{label?: string, display?: string, onEscape?: function}} [opts] - Options
   * @returns {void}
   */
  window.openModal = function(el, opts) {
    if (!el) return;
    opts = opts || {};
    _prevFocus = document.activeElement;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (opts.label) el.setAttribute('aria-label', opts.label);
    el.style.display = opts.display || 'flex';
    const first = el.querySelector(FOCUSABLE);
    if (first) setTimeout(() => first.focus(), 50);
    el._trapFn = function(e) {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(el.querySelectorAll(FOCUSABLE));
      if (!nodes.length) return;
      if (e.shiftKey) { if (document.activeElement === nodes[0]) { e.preventDefault(); nodes[nodes.length-1].focus(); } }
      else            { if (document.activeElement === nodes[nodes.length-1]) { e.preventDefault(); nodes[0].focus(); } }
    };
    el._escapeFn = function(e) { if (e.key === 'Escape' && opts.onEscape) opts.onEscape(); };
    el.addEventListener('keydown', el._trapFn);
    document.addEventListener('keydown', el._escapeFn);
    document.body.style.overflow = 'hidden';
  };
  /**
   * Closes a modal dialog, removes focus-trap listeners, and restores focus to the previously
   * active element.
   * @param {HTMLElement} el - The modal DOM element to close
   * @returns {void}
   */
  window.closeModal = function(el) {
    if (!el) return;
    el.style.display = 'none';
    if (el._trapFn)   { el.removeEventListener('keydown', el._trapFn);   delete el._trapFn; }
    if (el._escapeFn) { document.removeEventListener('keydown', el._escapeFn); delete el._escapeFn; }
    document.body.style.overflow = '';
    if (_prevFocus && _prevFocus.focus) try { _prevFocus.focus(); } catch(e) {}
    _prevFocus = null;
  };
})();

// ══════════════════════════════════════════════
// SCREEN ROUTER — single source of truth
// ══════════════════════════════════════════════
/** @type {string[]} Ordered list of all top-level screen IDs managed by the router */
const SCREENS = ['screen-entry','screen-consent','screen-mmas','screen-dashboard','screen-mmas-map','screen-peacs'];

/**
 * Activates a top-level screen by ID, deactivating all others and scrolling to the top.
 * Also pauses mini-map rotation intervals when leaving the dashboard.
 * @param {string} id - ID of the screen element to show (must be in SCREENS array)
 * @returns {void}
 */
function showScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.remove('active','fade-in');
  });
  const target = document.getElementById(id);
  if (target) { target.classList.add('active','fade-in'); }
  window.scrollTo(0,0);
  updateFloatToggleVisibility();
  // Pause mini-map rotation when not on dashboard — they burn CPU at 80ms intervals
  if (id !== 'screen-dashboard') {
    if (window._miniMmasRotInt)  { clearInterval(window._miniMmasRotInt);  window._miniMmasRotInt  = null; }
    if (window._miniPeacsRotInt) { clearInterval(window._miniPeacsRotInt); window._miniPeacsRotInt = null; }
  }
}

// ══════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════
/** @type {{lat: number, lng: number, city?: string, country?: string}|null} */
let userLocation      = null;
/** @type {string|null} Browser-scoped anonymous session ID */
let userId            = null;
/** @type {string|null} Active workspace key (uppercased) */
let currentWorkspace  = null;
/** @type {import('./auth-roles').WorkspaceProfile|null} */
let workspaceProfile  = null;

// MMAS state
/** @type {Object.<string, number>} Current MMAS-8 answer values keyed by q1–q8 */
let mmasAnswers       = {};   // { q1: val, q2: val, ... q8: val }
let mmasCurrentLang   = 'en';
let mmasTotal         = 0;
let mmasCountries     = new Set();
let mmasCountryData   = {};
let mmasMarkersMap    = {};   // locationKey → { count, scores, marker }
let mmasMapInstance   = null;
let mmasMapInited     = false;
let mmasListening     = false;

// Spectator / cinematic state
let spectatorActive   = false;
let spectatorMap      = null;
let spectatorMapInited= false;
let tourActive        = false;
let tourTimeout       = null;
let tickerItems       = [];

// PEACS state (from the portal track)
let peacsMap          = null;
let peacsMapInited    = false;
let mmasInlineMap     = null; // also used inside DOMContentLoaded for inline tab map
let currentPeacsTab   = 'assess';
let peacsState        = { base:{}, mvmt:{}, strata:{}, completed:false, pe:null };

// Dashboard cohort state
let dashMmasData      = [];
let dashPeacsData     = [];
let _postConsentTarget = 'entry'; // 'entry' | 'dashboard' — where to return on MMAS exit

