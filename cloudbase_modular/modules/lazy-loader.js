// ── Lazy loader: call once, returns a Promise that resolves when script is ready ──

/** @type {Object.<string, Promise<void>>} Cache of in-flight or completed script load promises keyed by src URL */
const _lazyScripts = {};

/**
 * Lazily loads an external script exactly once, returning a shared Promise.
 * If the script's global symbol already exists the Promise resolves immediately.
 * @param {string} src - Absolute URL of the script to load
 * @param {string} [globalCheck] - Optional global variable name; if already present, skips loading
 * @returns {Promise<void>}
 */
function lazyLoad(src, globalCheck) {
  if (_lazyScripts[src]) return _lazyScripts[src];
  if (globalCheck && window[globalCheck]) { _lazyScripts[src] = Promise.resolve(); return _lazyScripts[src]; }
  _lazyScripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return _lazyScripts[src];
}
const MAPBOX_JS  = 'https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.js';
const PLOTLY_JS  = 'https://cdn.plot.ly/plotly-2.27.0.min.js';
const SHEETJS    = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
// Convenience helpers used throughout the codebase:
/** @returns {Promise<void>} Resolves when Mapbox GL JS is ready */
function ensureMapbox()  { return lazyLoad(MAPBOX_JS,  'mapboxgl'); }
/** @returns {Promise<void>} Resolves when Plotly is ready */
function ensurePlotly()  { return lazyLoad(PLOTLY_JS,  'Plotly'); }
/** @returns {Promise<void>} Resolves when SheetJS (XLSX) is ready */
function ensureSheetJS() { return lazyLoad(SHEETJS,    'XLSX'); }

/** Canonical Mapbox public token — update here to rotate across all modules */
const ATLAS_MAPBOX_TOKEN = 'pk.eyJ1IjoicGhpbG03MTUiLCJhIjoiY21lOHBudmd6MGd5ejJscHdiNmpvNDQ1biJ9.viiogsAaQqrQ1GYTYIUaCA';
