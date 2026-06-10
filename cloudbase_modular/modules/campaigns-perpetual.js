// ══════════════════════════════════════════════════════════════════
//  CAMPAIGN SYSTEM — Perpetual Wall Events
//  Firebase node: /campaigns/{id}
//  Schema: { name, icon, color, condition, start_ms, end_ms,
//             created_by, created_at, active }
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Campaign
 * @property {string} id - Firebase push key
 * @property {string} name - Display name
 * @property {string} icon - Emoji icon character
 * @property {string} color - CSS hex color
 * @property {string|null} condition - Optional medical condition filter
 * @property {number} start_ms - Start timestamp in ms
 * @property {number} end_ms - End timestamp in ms
 * @property {string} created_by - Workspace key of creator
 * @property {number} created_at - Creation timestamp in ms
 * @property {boolean} active - Whether the campaign is active (false = archived)
 */

/** @type {Object.<string, Campaign>} In-memory registry: campaign_id → campaign object */
window._campaignRegistry = {};
// Live submission counts per campaign (populated during spectator session)
window._campLiveCounts   = {};
// Currently selected color in the create form
window._campSelectedColor = '#ef4444';
// Current filter in spectator (null = show all)
window._campActiveFilter  = null;

// ── Load all campaigns from Firebase on init ──────────────────────
/**
 * Subscribes to the Firebase /campaigns node and keeps window._campaignRegistry in sync.
 * Also refreshes open admin lists and spectator timeline/banner on every update.
 * @returns {void}
 */
function initCampaignSystem() {
  database.ref('campaigns').on('value', snap => {
    const raw = snap.val() || {};
    window._campaignRegistry = {};
    Object.entries(raw).forEach(([id, c]) => {
      window._campaignRegistry[id] = { ...c, id };
    });
    // Refresh any open UI
    if (document.getElementById('camp-admin-list')) _renderCampaignAdminList();
    if (spectatorActive) {
      renderCampaignTimeline();
      _updateCampaignBanner();
    }
  });
}

// ── Detect whether a campaign is currently live (by date) ─────────
/**
 * Returns the currently live campaign (if any) based on the current timestamp.
 * @returns {Campaign|null}
 */
function detectActiveCampaign() {
  const now = Date.now();
  const active = Object.values(window._campaignRegistry).find(c =>
    c.start_ms <= now && c.end_ms >= now
  );
  return active || null;
}

// ── Create a new campaign (superadmin only) ───────────────────────
/**
 * Reads the campaign creation form and pushes a new campaign to Firebase /campaigns.
 * Restricted to superadmin. Validates name, start, and end date before writing.
 * @returns {Promise<void>}
 */
async function createCampaign() {
  if (!isSuperAdmin()) { showToast('Superadmin access required.'); return; }
  const name      = document.getElementById('camp-new-name')?.value.trim();
  const startVal  = document.getElementById('camp-new-start')?.value;
  const endVal    = document.getElementById('camp-new-end')?.value;
  const condition = document.getElementById('camp-new-condition')?.value.trim() || null;
  const icon      = document.getElementById('camp-new-icon')?.value || '💊';
  const color     = window._campSelectedColor || '#ef4444';

  if (!name)     { showToast('Campaign name required.'); return; }
  if (!startVal) { showToast('Start date required.'); return; }
  if (!endVal)   { showToast('End date required.'); return; }

  const start_ms = new Date(startVal + 'T00:00:00').getTime();
  const end_ms   = new Date(endVal   + 'T23:59:59').getTime();
  if (end_ms < start_ms) { showToast('End date must be after start date.'); return; }

  const payload = {
    name, icon, color, condition, start_ms, end_ms,
    created_by: currentWorkspace || 'superadmin',
    created_at: Date.now(),
    active: true
  };

  try {
    await database.ref('campaigns').push(payload);
    showToast('Campaign created: ' + name);
    // Clear form
    ['camp-new-name','camp-new-start','camp-new-end','camp-new-condition'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch(e) {
    showToast('Error creating campaign: ' + (e.message || 'Unknown'));
  }
}

// ── Archive (soft-delete) a campaign ─────────────────────────────
/**
 * Soft-deletes a campaign by setting its active flag to false in Firebase.
 * @param {string} id - Firebase key of the campaign to archive
 * @returns {Promise<void>}
 */
async function archiveCampaign(id) {
  if (!isSuperAdmin()) return;
  if (!confirm('Archive this campaign? It will remain in history but no longer tag new submissions.')) return;
  try {
    await database.ref('campaigns/' + id + '/active').set(false);
    showToast('Campaign archived.');
  } catch(e) {
    showToast('Error: ' + (e.message||'Unknown'));
  }
}

// ── Color swatch selector ─────────────────────────────────────────
/**
 * Updates the selected campaign colour and visually marks the active swatch.
 * @param {string} color - CSS hex colour string
 * @param {HTMLElement|null} el - The swatch element that was clicked
 * @returns {void}
 */
function selectCampColor(color, el) {
  window._campSelectedColor = color;
  document.querySelectorAll('.camp-swatch').forEach(s => s.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

// ── Render campaign list in admin panel ───────────────────────────
function _renderCampaignAdminList() {
  const list = document.getElementById('camp-admin-list');
  if (!list) return;
  const camps = Object.values(window._campaignRegistry).sort((a,b) => b.start_ms - a.start_ms);
  if (!camps.length) {
    list.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--dim);padding:10px 0;">No campaigns yet. Create your first one above.</div>';
    return;
  }
  const now = Date.now();
  list.innerHTML = camps.map(c => {
    const isLive    = c.active && c.start_ms <= now && c.end_ms >= now;
    const isUpcoming= c.active && c.start_ms > now;
    const ended     = !c.active || c.end_ms < now;
    const statusBadge = isLive
      ? `<span class="camp-live-badge">● LIVE</span>`
      : isUpcoming
      ? `<span class="camp-ended-badge">UPCOMING</span>`
      : `<span class="camp-ended-badge">ENDED</span>`;
    const startStr  = new Date(c.start_ms).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const endStr    = new Date(c.end_ms).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    // Count submissions tagged with this campaign from global data
    const count = (dashMmasData||[]).filter(r => r.campaign_id === c.id).length;
    return `<div class="camp-list-item">
      <div class="camp-list-dot" style="background:${c.color};box-shadow:0 0 6px ${c.color};"></div>
      <span style="font-size:0.86rem;">${_esc(c.icon||'')}</span>
      <div style="flex:1;min-width:0;">
        <div class="camp-list-name">${_esc(c.name)}</div>
        <div class="camp-list-dates">${startStr} — ${endStr}${c.condition ? ' · ' + _esc(c.condition) : ''}</div>
      </div>
      ${statusBadge}
      <span class="camp-list-count">${count}</span>
      ${!ended ? `<button onclick="archiveCampaign('${c.id}')" style="font-family:var(--font-mono);font-size:0.88rem;padding:2px 7px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);color:var(--poor);cursor:pointer;margin-left:4px;">Archive</button>` : ''}
    </div>`;
  }).join('');
}

// ── Open/close campaign manager panel ────────────────────────────
/** Toggles the campaign manager admin panel open or closed. @returns {void} */
function openCampaignManager() {
  const panel = document.getElementById('campaign-manager-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) _renderCampaignAdminList();
}

// ── Render campaign timeline strip on the Wall ────────────────────
/**
 * Re-renders the campaign timeline pill strip on the spectator Wall screen.
 * Active, upcoming, and ended campaigns are shown with live submission counts.
 * @returns {void}
 */
function renderCampaignTimeline() {
  const strip = document.getElementById('campaign-timeline');
  if (!strip) return;
  const camps = Object.values(window._campaignRegistry)
    .filter(c => c.active !== false)
    .sort((a,b) => a.start_ms - b.start_ms);
  if (!camps.length) { strip.classList.remove('has-campaigns'); return; }
  strip.classList.add('has-campaigns');
  const now = Date.now();
  // Keep label, then pills
  strip.innerHTML = '<span class="camp-timeline-label">CAMPAIGNS ·</span>' +
    camps.map(c => {
      const isLive = c.start_ms <= now && c.end_ms >= now;
      const count  = (window._campLiveCounts[c.id] || 0) +
                     (dashMmasData||[]).filter(r => r.campaign_id === c.id).length;
      const isSelected = window._campActiveFilter === c.id;
      return `<div class="camp-pill${isSelected?' active-filter':''}"
        style="background:${c.color}18;border-color:${c.color}50;color:${c.color};"
        onclick="toggleCampaignFilter('${c.id}')" title="Click to filter Wall to this campaign">
        <div class="camp-pill-dot" style="background:${c.color};${isLive?'box-shadow:0 0 6px '+c.color:'opacity:0.4'};"></div>
        ${_esc(c.icon||'')} ${_esc(c.name)}
        ${count ? `<span style="opacity:0.7;font-size:0.86rem;">${count.toLocaleString()}</span>` : ''}
      </div>`;
    }).join('');
}

// ── Toggle Wall filter to a specific campaign ─────────────────────
/**
 * Toggles the spectator Wall map filter to show only submissions for a given campaign.
 * Clicking the same campaign ID a second time clears the filter.
 * @param {string} id - Campaign ID to filter on
 * @returns {void}
 */
function toggleCampaignFilter(id) {
  window._campActiveFilter = window._campActiveFilter === id ? null : id;
  renderCampaignTimeline();
  _applyCampaignMapFilter();
}

// ── Filter spectator map markers by campaign ──────────────────────
function _applyCampaignMapFilter() {
  if (!spectatorMap || !spectatorMap.isStyleLoaded()) return;
  const filter = window._campActiveFilter;
  // The spectator GeoJSON source already has campaign_id on each feature
  try {
    if (filter) {
      spectatorMap.setFilter('spectator-heat', ['==', ['get','campaign_id'], filter]);
      spectatorMap.setFilter('spectator-dots', ['==', ['get','campaign_id'], filter]);
    } else {
      spectatorMap.setFilter('spectator-heat', null);
      spectatorMap.setFilter('spectator-dots', null);
    }
  } catch(e) { /* layers may not exist yet */ }
}

// ── Update the active campaign banner during live spectator ───────
function _updateCampaignBanner() {
  const banner   = document.getElementById('campaign-banner');
  const dot      = document.getElementById('camp-banner-dot');
  const nameEl   = document.getElementById('camp-banner-name');
  const countEl  = document.getElementById('camp-banner-count');
  if (!banner) return;

  const active = detectActiveCampaign();
  if (!active) { banner.style.display = 'none'; return; }

  const liveCount  = window._campLiveCounts[active.id] || 0;
  const totalCount = liveCount + (dashMmasData||[]).filter(r => r.campaign_id === active.id).length;

  if (dot)     { dot.style.background = active.color; dot.style.color = active.color; }
  if (nameEl)  nameEl.textContent = (active.icon||'') + ' ' + active.name;
  if (countEl) countEl.textContent = totalCount.toLocaleString();
  banner.style.display = 'flex';

  // Update the spectator event label text as well
  const evLabel = document.querySelector('#spectator-overlay .cine-event-label');
  if (evLabel) evLabel.textContent = active.name.toUpperCase();
}

// ── Attach campaign_id to GeoJSON features for map filtering ──────
// Called whenever _updateSpectatorSource runs — patches feature properties
const _origUpdateSpectatorSource = window._updateSpectatorSource;
function _patchSpectatorFeaturesWithCampaign(features) {
  return features.map(f => {
    const ref = f.properties && f.properties.assessment_ref;
    if (!ref) return f;
    // Find the assessment record with this Firebase key
    const rec = (dashMmasData||[]).find(r => r._fbKey === ref) ||
                Object.values(window._campaignRegistry); // fallback
    return f;
  });
}

// ── Hook into enterSpectatorMode to boot campaign UI ─────────────
const _origEnterSpectatorMode = window.enterSpectatorMode;
// We patch the post-init flow by extending loadSpectatorData's callback
const _origLoadSpectatorData = window.loadSpectatorData;

// Override: after spectator data loads, boot campaign UI
(function() {
  const _orig = loadSpectatorData;
  window.loadSpectatorData = function() {
    _orig.apply(this, arguments);
    // Give Firebase time to resolve, then render campaign UI
    setTimeout(() => {
      _updateCampaignBanner();
      renderCampaignTimeline();
    }, 500);
  };
})();

// ── Bootstrap on auth ready ───────────────────────────────────────
// Button visibility is managed exclusively by auth-workspace.js enterResearcherDashboard()
// to avoid duplicate show/hide logic and ensure hasModule() entitlement is respected.
const _origPostLogin = window.onWorkspaceReady;
document.addEventListener('atlas:workspace-ready', () => {
  initCampaignSystem();
});

// Fallback: also try after 3s in case event already fired
setTimeout(() => {
  if (typeof database !== 'undefined' && database) {
    if (!Object.keys(window._campaignRegistry).length) initCampaignSystem();
  }
}, 3000);

// Also refresh campaign banner whenever cinematic stats update
const _origUpdateCinematicStats = updateCinematicStats;
window.updateCinematicStats = function() {
  _origUpdateCinematicStats.apply(this, arguments);
  _updateCampaignBanner();
  renderCampaignTimeline();
};
