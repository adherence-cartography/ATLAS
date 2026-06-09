// poi-contributor.js — ATLAS Phase 4: Infrastructure POI Contributor
// ══════════════════════════════════════════════════════════════════════════════
// Crowdsourced SDoH infrastructure POI submission and community verification.
//
// Dependencies (must be present on the page before this script):
//   - firebase  (Firebase compat SDK, v9.x compat shim)
//   - database  (window.database = firebase.database() initialised in firebase-init.js)
//   - window.userLocation  (optional { lat, lon } set by geolocation module)
//   - showToast(msg)  (optional — defined in forms-helpers.js and assess.html)
//
// Public API:
//   _poiContribOpen(lat, lon)       — open the contribution modal
//   _poiContribSubmit(formData)     — write a new POI record to Firebase
//   _poiContribVerify(key, record)  — increment confirmations on an existing POI
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

// ── Internal helpers ──────────────────────────────────────────────────────────

function _poiToast(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
  } else {
    alert(msg);
  }
}

function _poiCurrentUid() {
  try {
    return firebase.auth().currentUser?.uid || 'anon';
  } catch (e) {
    return 'anon';
  }
}

function _poiCloseModal() {
  const el = document.getElementById('atlas-poi-modal-overlay');
  if (el) el.remove();
}

// ── Stylesheet (injected once) ────────────────────────────────────────────────

function _poiInjectStyles() {
  if (document.getElementById('atlas-poi-contrib-styles')) return;
  const s = document.createElement('style');
  s.id = 'atlas-poi-contrib-styles';
  s.textContent = `
    #atlas-poi-modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(4, 9, 28, 0.82);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      animation: poi-fade-in 0.18s ease;
    }
    @keyframes poi-fade-in { from { opacity: 0; } to { opacity: 1; } }

    #atlas-poi-modal {
      background: #0a1527;
      border: 1px solid rgba(212,168,67,0.26);
      border-radius: var(--r, 10px);
      width: 100%;
      max-width: 420px;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }

    .poi-modal-header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid rgba(212,168,67,0.12);
    }
    .poi-modal-eyebrow {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.68rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(212,168,67,0.55);
      margin-bottom: 4px;
    }
    .poi-modal-title {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 1.00rem;
      font-weight: 600;
      color: rgba(205,216,232,0.92);
      letter-spacing: 0.04em;
    }

    .poi-modal-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 13px;
    }

    .poi-field label {
      display: block;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.70rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(96,120,152,0.9);
      margin-bottom: 5px;
    }
    .poi-field select,
    .poi-field input[type="text"],
    .poi-field textarea {
      width: 100%;
      background: rgba(7,14,29,0.9);
      border: 1px solid rgba(212,168,67,0.14);
      border-radius: 6px;
      color: rgba(205,216,232,0.9);
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 0.88rem;
      padding: 8px 10px;
      outline: none;
      transition: border-color 0.15s;
      -webkit-appearance: none;
    }
    .poi-field select:focus,
    .poi-field input[type="text"]:focus,
    .poi-field textarea:focus {
      border-color: rgba(212,168,67,0.38);
    }
    .poi-field select option {
      background: #0a1527;
    }
    .poi-field textarea {
      resize: vertical;
      min-height: 64px;
    }
    .poi-coords-display {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.72rem;
      color: rgba(96,120,152,0.75);
      padding: 6px 0 0;
    }

    .poi-modal-footer {
      padding: 12px 20px 18px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      border-top: 1px solid rgba(212,168,67,0.12);
    }
    .poi-btn-cancel {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.78rem;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      background: transparent;
      border: 1px solid rgba(212,168,67,0.18);
      color: rgba(138,160,184,0.8);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .poi-btn-cancel:hover { background: rgba(212,168,67,0.07); }
    .poi-btn-submit {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.78rem;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      background: rgba(46,201,138,0.12);
      border: 1px solid rgba(46,201,138,0.35);
      color: #2ec98a;
      padding: 8px 20px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .poi-btn-submit:hover { background: rgba(46,201,138,0.22); }
    .poi-btn-submit:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(s);
}

// ── Public: open contribution modal ──────────────────────────────────────────

/**
 * Opens the POI contribution modal.
 * @param {number} [lat]  Latitude pre-fill. Falls back to window.userLocation.
 * @param {number} [lon]  Longitude pre-fill. Falls back to window.userLocation.
 */
function _poiContribOpen(lat, lon) {
  _poiInjectStyles();
  _poiCloseModal(); // remove any stale modal

  const loc = window.userLocation || {};
  const useLat = lat != null ? lat : (loc.lat != null ? loc.lat : null);
  const useLon = lon != null ? lon : (loc.lon != null ? loc.lon : null);

  const coordText = (useLat != null && useLon != null)
    ? `${(+useLat).toFixed(5)}, ${(+useLon).toFixed(5)}`
    : 'Location not available — allow browser location access and retry';

  const overlay = document.createElement('div');
  overlay.id = 'atlas-poi-modal-overlay';

  // Close on backdrop click
  overlay.addEventListener('click', e => { if (e.target === overlay) _poiCloseModal(); });

  overlay.innerHTML = `
    <div id="atlas-poi-modal" role="dialog" aria-modal="true" aria-label="Add Infrastructure POI">
      <div class="poi-modal-header">
        <div class="poi-modal-eyebrow">Help map medication access infrastructure in your community</div>
        <div class="poi-modal-title">Add Infrastructure POI</div>
      </div>
      <div class="poi-modal-body">
        <div class="poi-field">
          <label for="poi-type">Type</label>
          <select id="poi-type">
            <option value="pharmacy">Pharmacy</option>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="transport">Public Transport Stop</option>
            <option value="food_bank">Food Bank</option>
            <option value="community_center">Community Center</option>
          </select>
        </div>
        <div class="poi-field">
          <label for="poi-name">Name</label>
          <input type="text" id="poi-name" placeholder='e.g. "CVS Pharmacy #1234"' maxlength="120" autocomplete="off"/>
        </div>
        <div class="poi-field">
          <label for="poi-address">Address <span style="opacity:0.5;">(optional)</span></label>
          <input type="text" id="poi-address" placeholder="123 Main St" maxlength="200" autocomplete="off"/>
        </div>
        <div class="poi-field">
          <label for="poi-city">City</label>
          <input type="text" id="poi-city" placeholder="City" maxlength="80" autocomplete="off"/>
        </div>
        <div class="poi-field">
          <label for="poi-country">Country</label>
          <input type="text" id="poi-country" placeholder="Country" maxlength="80" autocomplete="off"/>
        </div>
        <div class="poi-field">
          <label for="poi-notes">Notes <span style="opacity:0.5;">(optional)</span></label>
          <textarea id="poi-notes" placeholder="Anything helpful for other contributors..." maxlength="400"></textarea>
        </div>
        <div class="poi-coords-display">
          📍 Coordinates: <span id="poi-coord-display">${coordText}</span>
        </div>
      </div>
      <div class="poi-modal-footer">
        <button class="poi-btn-cancel" onclick="_poiCloseModal()">Cancel</button>
        <button class="poi-btn-submit" id="poi-submit-btn"
          onclick="_poiContribSubmit({
            lat: ${useLat != null ? +useLat : 'null'},
            lon: ${useLon != null ? +useLon : 'null'}
          })">Submit POI</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Focus first field for accessibility
  setTimeout(() => {
    const first = overlay.querySelector('#poi-name');
    if (first) first.focus();
  }, 80);
}

// ── Public: submit contribution ───────────────────────────────────────────────

/**
 * Reads form values and writes a new POI record to Firebase.
 * @param {{ lat: number|null, lon: number|null }} coords  Coordinates from modal.
 */
function _poiContribSubmit(coords) {
  if (!window.database) {
    _poiToast('Database not available. Please try again later.');
    return;
  }

  const type    = (document.getElementById('poi-type')?.value    || '').trim();
  const name    = (document.getElementById('poi-name')?.value    || '').trim();
  const address = (document.getElementById('poi-address')?.value || '').trim();
  const city    = (document.getElementById('poi-city')?.value    || '').trim();
  const country = (document.getElementById('poi-country')?.value || '').trim();
  const notes   = (document.getElementById('poi-notes')?.value   || '').trim();

  if (!name) {
    _poiToast('Please enter a name for this POI.');
    document.getElementById('poi-name')?.focus();
    return;
  }
  if (!city) {
    _poiToast('Please enter a city.');
    document.getElementById('poi-city')?.focus();
    return;
  }
  if (coords.lat == null || coords.lon == null) {
    _poiToast('Location coordinates are missing. Allow browser location access and reopen the form.');
    return;
  }

  const uid = _poiCurrentUid();

  const record = {
    type:           type,
    name:           name,
    latitude:       +coords.lat,
    longitude:      +coords.lon,
    country:        country,
    city:           city,
    contributor_id: uid,
    contributed_at: Date.now(),
    confirmations:  1,
    confirmed_by:   [uid],
    verified:       false,
    notes:          notes,
  };
  if (address) record.address = address;

  const submitBtn = document.getElementById('poi-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  database.ref('infrastructure_poi').push(record)
    .then(() => {
      _poiCloseModal();
      _poiToast('POI submitted — thank you!');
    })
    .catch(err => {
      console.error('[ATLAS] POI submit error:', err);
      _poiToast('Submission failed: ' + (err.message || 'Unknown error'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit POI';
      }
    });
}

// ── Public: verify / confirm an existing POI ─────────────────────────────────

/**
 * Lets a second (or later) user confirm an existing POI.
 * Uses a Firebase transaction to prevent double-counting.
 * Sets verified = true once confirmations reaches 2.
 *
 * @param {string} poiKey       Firebase push key under infrastructure_poi/
 * @param {object} currentRecord  The current POI record object (for UID guard)
 */
function _poiContribVerify(poiKey, currentRecord) {
  if (!window.database) {
    _poiToast('Database not available.');
    return;
  }

  const uid = _poiCurrentUid();

  if (uid === 'anon') {
    _poiToast('Sign in to confirm a POI.');
    return;
  }

  // Prevent self-confirmation
  const alreadyConfirmed = Array.isArray(currentRecord.confirmed_by)
    && currentRecord.confirmed_by.includes(uid);
  if (alreadyConfirmed || currentRecord.contributor_id === uid) {
    _poiToast('You have already confirmed this POI.');
    return;
  }

  const ref = database.ref('infrastructure_poi/' + poiKey);

  ref.transaction(poi => {
    if (!poi) return poi; // aborted — node deleted between read and write
    const confirmedBy = Array.isArray(poi.confirmed_by) ? poi.confirmed_by : [];
    if (confirmedBy.includes(uid)) return; // abort if already confirmed
    confirmedBy.push(uid);
    poi.confirmed_by   = confirmedBy;
    poi.confirmations  = confirmedBy.length;
    if (poi.confirmations >= 2) poi.verified = true;
    return poi;
  }).then(result => {
    if (result.committed) {
      _poiToast('POI confirmed — thank you!');
    } else {
      _poiToast('Could not confirm POI — it may have been removed.');
    }
  }).catch(err => {
    console.error('[ATLAS] POI verify error:', err);
    _poiToast('Verification failed: ' + (err.message || 'Unknown error'));
  });
}
