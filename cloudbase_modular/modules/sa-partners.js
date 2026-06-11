// sa-partners.js — Partner Integrations: register partner orgs, API key management, usage analytics, webhook log

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER INTEGRATIONS — Superadmin only
// Firebase paths: partner_keys/{apiKey}, partner_usage/{apiKey}/{YYYY-MM-DD},
//                 partner_webhook_log/{apiKey}, workspaces/{workspaceCode}
// ══════════════════════════════════════════════════════════════════════════════

const _CP = window._ATLAS_COLORS || {
  bg:'#070e1d', bg2:'#0a1527', surface:'#0d1b2e',
  border:'rgba(212,168,67,0.12)', borderB:'rgba(212,168,67,0.26)',
  amber:'#d4a843', amberDim:'rgba(212,168,67,0.55)', amberFaint:'rgba(212,168,67,0.09)',
  cyan:'#38bdf8', cyanDim:'rgba(56,189,248,0.5)',
  green:'#2ec98a', greenDim:'rgba(46,201,138,0.45)', greenFaint:'rgba(46,201,138,0.08)',
  red:'#ef4444', blue:'#4e9cf5', purple:'#8b6ff5',
  text:'rgba(205,216,232,0.92)', muted:'rgba(138,160,184,0.8)',
  dim:'rgba(96,120,152,0.65)', navy:'rgba(212,168,67,0.06)',
};

// ── Module-level state ────────────────────────────────────────────────────────
let _partnersCache = [];
let _partnerUsageCache = {};

// ── CSS (injected once, idempotent) ──────────────────────────────────────────
function _spInjectStyles() {
  if (document.getElementById('sp-styles')) return;
  const s = document.createElement('style');
  s.id = 'sp-styles';
  s.textContent = `
    .sp-card{background:var(--mc-surface,#0d1b2e);border:1px solid var(--mc-border,rgba(212,168,67,0.12));border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color 0.18s;}
    .sp-card:hover{border-color:var(--mc-border-b,rgba(212,168,67,0.26));}
    .sp-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;letter-spacing:0.10em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid;font-weight:500;white-space:nowrap;}
    .sp-badge-active{color:#2ec98a;border-color:rgba(46,201,138,0.35);background:rgba(46,201,138,0.07);}
    .sp-badge-inactive{color:rgba(138,160,184,0.8);border-color:rgba(138,160,184,0.2);background:rgba(138,160,184,0.06);}
    .sp-chip{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;letter-spacing:0.10em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1px solid;margin-right:4px;}
    .sp-chip-map{color:#2ec98a;border-color:rgba(46,201,138,0.4);background:rgba(46,201,138,0.07);}
    .sp-chip-mmas{color:#4e9cf5;border-color:rgba(78,156,245,0.4);background:rgba(78,156,245,0.07);}
    .sp-chip-peacs{color:#8b6ff5;border-color:rgba(139,111,245,0.4);background:rgba(139,111,245,0.07);}
    .sp-action-btn{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:5px;border:1px solid var(--mc-border,rgba(212,168,67,0.12));background:transparent;color:var(--mc-dim,rgba(96,120,152,0.65));cursor:pointer;transition:all 0.12s;}
    .sp-action-btn:hover{background:var(--mc-navy,rgba(212,168,67,0.06));color:var(--mc-text,rgba(205,216,232,0.92));}
    .sp-action-btn-danger:hover{background:rgba(239,68,68,0.09);border-color:rgba(239,68,68,0.4);color:#ef4444;}
    .sp-progress-track{height:4px;border-radius:2px;background:rgba(255,255,255,0.07);overflow:hidden;margin-top:3px;}
    .sp-progress-fill{height:100%;border-radius:2px;transition:width 0.5s ease;}
    .sp-input{width:100%;background:var(--mc-bg2,#0a1527);border:1px solid var(--mc-border,rgba(212,168,67,0.12));color:var(--mc-text,rgba(205,216,232,0.92));font-family:'IBM Plex Mono',monospace;font-size:0.88rem;padding:8px 12px;border-radius:6px;outline:none;box-sizing:border-box;}
    .sp-input:focus{border-color:rgba(212,168,67,0.4);}
    .sp-label{font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--mc-dim,rgba(96,120,152,0.65));margin-bottom:5px;display:block;}
    .sp-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9100;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;}
    .sp-modal{background:var(--mc-bg2,#0a1527);border:1px solid var(--mc-border-b,rgba(212,168,67,0.26));border-radius:14px;width:100%;max-width:560px;padding:32px 32px 28px;position:relative;}
    .sp-slide-panel{position:fixed;top:0;right:0;width:520px;max-width:95vw;height:100vh;background:var(--mc-bg2,#0a1527);border-left:1px solid var(--mc-border-b,rgba(212,168,67,0.26));z-index:9200;overflow-y:auto;padding:28px 24px;box-sizing:border-box;}
    .sp-monospace-box{font-family:'IBM Plex Mono',monospace;font-size:0.90rem;background:var(--mc-bg,#070e1d);border:1px solid var(--mc-border,rgba(212,168,67,0.12));border-radius:6px;padding:12px 14px;color:var(--mc-amber,#d4a843);word-break:break-all;letter-spacing:0.04em;}
    .sp-bar-chart-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
    .sp-bar-chart-label{font-family:'IBM Plex Mono',monospace;font-size:0.66rem;color:var(--mc-dim,rgba(96,120,152,0.65));width:72px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .sp-bar-chart-bar{height:10px;border-radius:3px;background:var(--mc-cyan,#38bdf8);min-width:2px;transition:width 0.4s ease;}
    .sp-bar-chart-val{font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--mc-muted,rgba(138,160,184,0.8));white-space:nowrap;}
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _spRandAlphanumeric(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function _spRandHex(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function _spTimeAgo(ts) {
  if (!ts) return '—';
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  if (d < 30 * 86400000) return Math.floor(d / 86400000) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function _spTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _spCopyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    btn.style.color = _CP.green;
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1800);
  }).catch(() => showToast('Copy failed — select and copy manually.'));
}

const _COUNTRIES = [
  'Greece', 'United States', 'United Kingdom', 'Germany', 'France', 'Spain',
  'Italy', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
  'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Cyprus', 'Malta',
  'Canada', 'Australia', 'New Zealand', 'Japan', 'South Korea', 'Singapore',
  'India', 'China', 'Brazil', 'Mexico', 'Argentina', 'South Africa',
  'Egypt', 'Saudi Arabia', 'UAE', 'Israel', 'Turkey', 'Other',
];

// ── Main render ───────────────────────────────────────────────────────────────
window.saPartnersRender = function(container) {
  _spInjectStyles();
  if (!_partnersCache.length) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_CP.amber};margin-bottom:4px;">Mission Control · Partners</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_CP.text};">Partner Integrations</div>
        </div>
        <button onclick="_saPartnersOpenAddModal()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 18px;border-radius:7px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          + Add Partner
        </button>
      </div>
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:2.5rem;margin-bottom:16px;">◈</div>
        <div style="font-size:1.05rem;color:${_CP.muted};margin-bottom:8px;">No partners yet.</div>
        <div style="font-size:0.88rem;color:${_CP.dim};margin-bottom:24px;">Add your first partner integration.</div>
        <button onclick="_saPartnersOpenAddModal()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 22px;border-radius:7px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          + Add Partner
        </button>
      </div>`;
    return;
  }

  const cards = _partnersCache.map(p => {
    const todayUsage = (_partnerUsageCache[p._key] && _partnerUsageCache[p._key][_spTodayKey()]) || 0;
    const rateLimit  = p.rate_limit || 1000;
    const usagePct   = Math.min(100, Math.round(todayUsage / rateLimit * 100));
    const usageColor = usagePct >= 90 ? _CP.red : usagePct >= 70 ? _CP.amber : _CP.cyan;
    const instruments = (p.instruments || []);
    const webhookShort = p.webhook_url
      ? (p.webhook_url.length > 38 ? p.webhook_url.slice(0, 36) + '…' : p.webhook_url)
      : '—';

    return `
      <div class="sp-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div>
            <div style="font-size:1.05rem;font-weight:600;color:${_CP.text};line-height:1.2;">
              ${p.country_flag ? _esc(p.country_flag) + ' ' : ''}${_esc(p.name || '—')}
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;color:${_CP.dim};margin-top:3px;">
              ${_esc(p.workspace_code || '—')}
            </div>
          </div>
          <span class="sp-badge ${p.active ? 'sp-badge-active' : 'sp-badge-inactive'}">${p.active ? 'Active' : 'Inactive'}</span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
          <span style="font-size:0.70rem;color:${_CP.dim};margin-right:2px;">Instruments:</span>
          ${instruments.includes('MAP')    ? '<span class="sp-chip sp-chip-map">MAP</span>'    : ''}
          ${instruments.includes('MMAS-8') ? '<span class="sp-chip sp-chip-mmas">MMAS-8</span>' : ''}
          ${instruments.includes('PEACS')  ? '<span class="sp-chip sp-chip-peacs">PEACS</span>' : ''}
          ${!instruments.length ? '<span style="font-size:0.75rem;color:'+_CP.dim+';">None assigned</span>' : ''}
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:0.72rem;color:${_CP.dim};">Today's API usage</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:${usageColor};">${todayUsage} / ${rateLimit}</span>
          </div>
          <div class="sp-progress-track">
            <div class="sp-progress-fill" style="width:${usagePct}%;background:${usageColor};"></div>
          </div>
        </div>

        ${p.webhook_url ? `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.72rem;color:${_CP.dim};flex-shrink:0;">Webhook:</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:${_CP.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;" title="${_esc(p.webhook_url)}">${_esc(webhookShort)}</span>
          <button class="sp-action-btn" style="padding:3px 9px;font-size:0.65rem;"
            onclick="_spCopyText('${_esc(p.webhook_url)}',this)">Copy</button>
        </div>` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.72rem;color:${_CP.dim};">Last activity: <span style="color:${_CP.muted};">${_spTimeAgo(p.last_activity)}</span></span>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;border-top:1px solid ${_CP.border};padding-top:12px;">
          <button class="sp-action-btn" onclick="_saPartnersOpenEditModal('${_esc(p._key)}')">Edit</button>
          <button class="sp-action-btn sp-action-btn-danger" onclick="_saPartnersRevokePartner('${_esc(p._key)}','${_esc(p.name)}')">Revoke</button>
          <button class="sp-action-btn" onclick="_saPartnersViewUsage('${_esc(p._key)}','${_esc(p.name)}')">View Data</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_CP.amber};margin-bottom:4px;">Mission Control · Partners</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_CP.text};">Partner Integrations</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:0.78rem;color:${_CP.dim};">${_partnersCache.length} partner${_partnersCache.length !== 1 ? 's' : ''}</span>
        <button onclick="_saPartnersOpenAddModal()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 18px;border-radius:7px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          + Add Partner
        </button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px;">
      ${cards}
    </div>`;
};

// ── Add Partner Modal ─────────────────────────────────────────────────────────
function _saPartnersOpenAddModal() {
  _spInjectStyles();
  const countryOptions = _COUNTRIES.map(c => `<option value="${_esc(c)}">${_esc(c)}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sp-add-overlay';
  overlay.className = 'sp-modal-overlay';
  overlay.innerHTML = `
    <div class="sp-modal" role="dialog" aria-modal="true" aria-label="Add Partner Integration">
      <button onclick="document.getElementById('sp-add-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CP.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CP.amber};margin-bottom:6px;">New Partner</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:${_CP.text};margin-bottom:22px;">Register Partner Integration</div>

      <div style="display:grid;gap:16px;">
        <div>
          <label class="sp-label" for="sp-add-name">Partner Name <span style="color:${_CP.red};">*</span></label>
          <input id="sp-add-name" class="sp-input" type="text" placeholder="e.g. Athens Medical Center" required />
        </div>
        <div>
          <label class="sp-label" for="sp-add-email">Contact Email</label>
          <input id="sp-add-email" class="sp-input" type="email" placeholder="contact@partner.org" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sp-label" for="sp-add-country">Country</label>
            <select id="sp-add-country" class="sp-input" style="cursor:pointer;">
              ${countryOptions}
            </select>
          </div>
          <div>
            <label class="sp-label" for="sp-add-rate">Daily Rate Limit</label>
            <input id="sp-add-rate" class="sp-input" type="number" value="1000" min="1" max="100000" />
          </div>
        </div>
        <div>
          <label class="sp-label">Instruments Allowed</label>
          <div style="display:flex;gap:16px;margin-top:4px;">
            ${['MAP','MMAS-8','PEACS'].map(inst => `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:0.85rem;color:${_CP.text};">
                <input type="checkbox" id="sp-add-inst-${inst.replace('-','').toLowerCase()}" value="${inst}"
                  style="width:14px;height:14px;cursor:pointer;accent-color:${_CP.amber};" />
                ${inst}
              </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="sp-label" for="sp-add-webhook">Webhook URL <span style="color:${_CP.dim};">(optional)</span></label>
          <input id="sp-add-webhook" class="sp-input" type="url" placeholder="https://your-platform.com/webhooks/atlas" />
        </div>
      </div>

      <div id="sp-add-error" style="display:none;margin-top:14px;font-size:0.82rem;color:${_CP.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CP.border};padding-top:18px;">
        <button onclick="document.getElementById('sp-add-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CP.border};
                 background:transparent;color:${_CP.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CP.borderB}';this.style.color='${_CP.text}'"
          onmouseout="this.style.borderColor='${_CP.border}';this.style.color='${_CP.muted}'">
          Cancel
        </button>
        <button id="sp-add-submit-btn" onclick="_spSubmitAddPartner()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          Register Partner
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { const f = document.getElementById('sp-add-name'); if (f) f.focus(); }, 60);
}

async function _spSubmitAddPartner() {
  const name      = (document.getElementById('sp-add-name')?.value || '').trim();
  const email     = (document.getElementById('sp-add-email')?.value || '').trim();
  const country   = document.getElementById('sp-add-country')?.value || '';
  const rateLimit = parseInt(document.getElementById('sp-add-rate')?.value || '1000', 10) || 1000;
  const webhook   = (document.getElementById('sp-add-webhook')?.value || '').trim();
  const errEl     = document.getElementById('sp-add-error');
  const submitBtn = document.getElementById('sp-add-submit-btn');

  if (!name) {
    errEl.textContent = 'Partner name is required.';
    errEl.style.display = 'block';
    document.getElementById('sp-add-name')?.focus();
    return;
  }

  const instruments = [];
  ['MAP','MMAS-8','PEACS'].forEach(inst => {
    const id = 'sp-add-inst-' + inst.replace('-','').toLowerCase();
    if (document.getElementById(id)?.checked) instruments.push(inst);
  });

  // Build workspace code from name
  const workspaceCode = ('PARTNER_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20)).replace(/__+/g, '_');

  // Generate API key and webhook secret
  const year   = new Date().getFullYear();
  const apiKey = `ATLAS-${_spRandAlphanumeric(8)}-${year}`;
  const secret = _spRandHex(32);

  // Country flag lookup (basic)
  const flagMap = {
    'Greece':'🇬🇷','United States':'🇺🇸','United Kingdom':'🇬🇧','Germany':'🇩🇪','France':'🇫🇷',
    'Spain':'🇪🇸','Italy':'🇮🇹','Portugal':'🇵🇹','Netherlands':'🇳🇱','Belgium':'🇧🇪',
    'Switzerland':'🇨🇭','Austria':'🇦🇹','Sweden':'🇸🇪','Norway':'🇳🇴','Denmark':'🇩🇰',
    'Finland':'🇫🇮','Poland':'🇵🇱','Czech Republic':'🇨🇿','Hungary':'🇭🇺','Romania':'🇷🇴',
    'Bulgaria':'🇧🇬','Croatia':'🇭🇷','Cyprus':'🇨🇾','Malta':'🇲🇹','Canada':'🇨🇦',
    'Australia':'🇦🇺','New Zealand':'🇳🇿','Japan':'🇯🇵','South Korea':'🇰🇷','Singapore':'🇸🇬',
    'India':'🇮🇳','China':'🇨🇳','Brazil':'🇧🇷','Mexico':'🇲🇽','Argentina':'🇦🇷',
    'South Africa':'🇿🇦','Egypt':'🇪🇬','Saudi Arabia':'🇸🇦','UAE':'🇦🇪','Israel':'🇮🇱','Turkey':'🇹🇷',
  };

  const partnerData = {
    name,
    email,
    country,
    country_flag: flagMap[country] || '🌐',
    workspace_code: workspaceCode,
    instruments,
    rate_limit: rateLimit,
    webhook_url: webhook || null,
    webhook_secret: secret,
    active: true,
    created_at: Date.now(),
    last_activity: null,
  };

  submitBtn.textContent = 'Registering…';
  submitBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    const db = firebase.database();
    await db.ref('partner_keys/' + apiKey).set(partnerData);
    await db.ref('workspaces/' + workspaceCode).set({
      role: 'partner',
      partner: true,
      name,
      created_at: Date.now(),
    });

    if (typeof atlasAuditLog === 'function') {
      atlasAuditLog('partner_created', { name, workspace: workspaceCode });
    }

    // Remove add modal, show key reveal modal
    document.getElementById('sp-add-overlay')?.remove();
    _spShowKeyRevealModal(apiKey, name, workspaceCode, secret);

    // Refresh cache in background
    window.saPartnersLoad && window.saPartnersLoad();

  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    submitBtn.textContent = 'Register Partner';
    submitBtn.disabled = false;
  }
}

function _spShowKeyRevealModal(apiKey, name, workspaceCode, secret) {
  const overlay = document.createElement('div');
  overlay.id = 'sp-reveal-overlay';
  overlay.className = 'sp-modal-overlay';
  overlay.innerHTML = `
    <div class="sp-modal" role="dialog" aria-modal="true" aria-label="Partner API Key">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:2rem;margin-bottom:8px;">✓</div>
        <div style="font-size:0.72rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CP.green};margin-bottom:6px;">Partner Registered</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.3rem;font-weight:300;color:${_CP.text};">${_esc(name)}</div>
        <div style="font-size:0.78rem;color:${_CP.dim};margin-top:4px;">Workspace: ${_esc(workspaceCode)}</div>
      </div>

      <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:12px 14px;margin-bottom:18px;">
        <div style="font-size:0.74rem;color:${_CP.red};font-weight:500;margin-bottom:4px;">Save this API key — it will not be shown again.</div>
        <div style="font-size:0.75rem;color:${_CP.muted};">Share it securely with the partner. Once you close this dialog it cannot be recovered.</div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CP.dim};margin-bottom:6px;">API Key</div>
        <div class="sp-monospace-box" id="sp-reveal-key">${_esc(apiKey)}</div>
        <button onclick="_spCopyText('${_esc(apiKey)}',this)"
          style="margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:6px 14px;border-radius:5px;cursor:pointer;border:1px solid ${_CP.border};
                 background:transparent;color:${_CP.muted};transition:all 0.12s;"
          onmouseover="this.style.background='${_CP.amberFaint}';this.style.borderColor='${_CP.amberDim}';this.style.color='${_CP.amber}'"
          onmouseout="this.style.background='transparent';this.style.borderColor='${_CP.border}';this.style.color='${_CP.muted}'">
          Copy API Key
        </button>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CP.dim};margin-bottom:6px;">Webhook Secret</div>
        <div class="sp-monospace-box" style="font-size:0.80rem;color:${_CP.muted};">${_esc(secret)}</div>
        <button onclick="_spCopyText('${_esc(secret)}',this)"
          style="margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:6px 14px;border-radius:5px;cursor:pointer;border:1px solid ${_CP.border};
                 background:transparent;color:${_CP.muted};transition:all 0.12s;"
          onmouseover="this.style.background='${_CP.amberFaint}';this.style.borderColor='${_CP.amberDim}';this.style.color='${_CP.amber}'"
          onmouseout="this.style.background='transparent';this.style.borderColor='${_CP.border}';this.style.color='${_CP.muted}'">
          Copy Webhook Secret
        </button>
      </div>

      <div style="display:flex;justify-content:center;border-top:1px solid ${_CP.border};padding-top:18px;">
        <button onclick="document.getElementById('sp-reveal-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:9px 28px;border-radius:6px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          I Have Saved the Key
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

// ── Edit Partner Modal ────────────────────────────────────────────────────────
function _saPartnersOpenEditModal(apiKey) {
  const partner = _partnersCache.find(p => p._key === apiKey);
  if (!partner) { showToast('Partner not found.'); return; }

  const countryOptions = _COUNTRIES.map(c =>
    `<option value="${_esc(c)}" ${partner.country === c ? 'selected' : ''}>${_esc(c)}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sp-edit-overlay';
  overlay.className = 'sp-modal-overlay';
  overlay.innerHTML = `
    <div class="sp-modal" role="dialog" aria-modal="true" aria-label="Edit Partner">
      <button onclick="document.getElementById('sp-edit-overlay').remove()"
        style="position:absolute;top:16px;right:18px;background:none;border:none;color:${_CP.dim};font-size:1.3rem;cursor:pointer;line-height:1;"
        aria-label="Close">×</button>

      <div style="font-size:0.70rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CP.amber};margin-bottom:6px;">Edit Partner</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.35rem;font-weight:300;color:${_CP.text};margin-bottom:22px;">${_esc(partner.name)}</div>

      <div style="display:grid;gap:16px;">
        <div>
          <label class="sp-label" for="sp-edit-name">Partner Name</label>
          <input id="sp-edit-name" class="sp-input" type="text" value="${_esc(partner.name || '')}" />
        </div>
        <div>
          <label class="sp-label" for="sp-edit-email">Contact Email</label>
          <input id="sp-edit-email" class="sp-input" type="email" value="${_esc(partner.email || '')}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="sp-label" for="sp-edit-country">Country</label>
            <select id="sp-edit-country" class="sp-input" style="cursor:pointer;">${countryOptions}</select>
          </div>
          <div>
            <label class="sp-label" for="sp-edit-rate">Daily Rate Limit</label>
            <input id="sp-edit-rate" class="sp-input" type="number" value="${_esc(partner.rate_limit || 1000)}" min="1" max="100000" />
          </div>
        </div>
        <div>
          <label class="sp-label">Instruments Allowed</label>
          <div style="display:flex;gap:16px;margin-top:4px;">
            ${['MAP','MMAS-8','PEACS'].map(inst => `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:0.85rem;color:${_CP.text};">
                <input type="checkbox" id="sp-edit-inst-${inst.replace('-','').toLowerCase()}" value="${inst}"
                  ${(partner.instruments || []).includes(inst) ? 'checked' : ''}
                  style="width:14px;height:14px;cursor:pointer;accent-color:${_CP.amber};" />
                ${inst}
              </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="sp-label" for="sp-edit-webhook">Webhook URL</label>
          <input id="sp-edit-webhook" class="sp-input" type="url" value="${_esc(partner.webhook_url || '')}" />
        </div>
        <div>
          <label class="sp-label">Status</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;color:${_CP.text};">
            <input type="checkbox" id="sp-edit-active" ${partner.active ? 'checked' : ''}
              style="width:14px;height:14px;cursor:pointer;accent-color:${_CP.green};" />
            Active
          </label>
        </div>
      </div>

      <div id="sp-edit-error" style="display:none;margin-top:14px;font-size:0.82rem;color:${_CP.red};"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid ${_CP.border};padding-top:18px;">
        <button onclick="document.getElementById('sp-edit-overlay').remove()"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.10em;text-transform:uppercase;
                 padding:8px 18px;border-radius:6px;cursor:pointer;border:1px solid ${_CP.border};
                 background:transparent;color:${_CP.muted};transition:all 0.15s;"
          onmouseover="this.style.borderColor='${_CP.borderB}';this.style.color='${_CP.text}'"
          onmouseout="this.style.borderColor='${_CP.border}';this.style.color='${_CP.muted}'">
          Cancel
        </button>
        <button id="sp-edit-save-btn" onclick="_spSaveEditPartner('${_esc(apiKey)}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
                 padding:8px 22px;border-radius:6px;cursor:pointer;
                 background:${_CP.amberFaint};border:1px solid ${_CP.amberDim};color:${_CP.amber};transition:all 0.15s;"
          onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_CP.amberFaint}'">
          Save Changes
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _spSaveEditPartner(apiKey) {
  const name      = (document.getElementById('sp-edit-name')?.value || '').trim();
  const email     = (document.getElementById('sp-edit-email')?.value || '').trim();
  const country   = document.getElementById('sp-edit-country')?.value || '';
  const rateLimit = parseInt(document.getElementById('sp-edit-rate')?.value || '1000', 10) || 1000;
  const webhook   = (document.getElementById('sp-edit-webhook')?.value || '').trim();
  const active    = document.getElementById('sp-edit-active')?.checked || false;
  const errEl     = document.getElementById('sp-edit-error');
  const saveBtn   = document.getElementById('sp-edit-save-btn');

  const instruments = [];
  ['MAP','MMAS-8','PEACS'].forEach(inst => {
    const id = 'sp-edit-inst-' + inst.replace('-','').toLowerCase();
    if (document.getElementById(id)?.checked) instruments.push(inst);
  });

  const flagMap = {
    'Greece':'🇬🇷','United States':'🇺🇸','United Kingdom':'🇬🇧','Germany':'🇩🇪','France':'🇫🇷',
    'Spain':'🇪🇸','Italy':'🇮🇹','Canada':'🇨🇦','Australia':'🇦🇺','Cyprus':'🇨🇾',
  };

  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;
  errEl.style.display = 'none';

  try {
    await firebase.database().ref('partner_keys/' + apiKey).update({
      name, email, country,
      country_flag: flagMap[country] || '🌐',
      instruments, rate_limit: rateLimit,
      webhook_url: webhook || null,
      active,
    });

    document.getElementById('sp-edit-overlay')?.remove();
    showToast('✓ Partner updated.', 2200);
    window.saPartnersLoad && window.saPartnersLoad();

  } catch (e) {
    errEl.textContent = 'Save failed: ' + e.message;
    errEl.style.display = 'block';
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = false;
  }
}

// ── Revoke Partner ────────────────────────────────────────────────────────────
window.saPartnersRevokePartner = async function(apiKey, name) {
  if (!confirm(`Revoke API access for "${name}"?\n\nThis will set their key to inactive. They will no longer be able to submit assessments. You can re-activate from the partner card.`)) return;
  try {
    await firebase.database().ref('partner_keys/' + apiKey + '/active').set(false);
    showToast(`✓ Partner "${name}" revoked.`, 2500);
    if (typeof atlasAuditLog === 'function') atlasAuditLog('partner_revoked', { name, apiKey });
    window.saPartnersLoad && window.saPartnersLoad();
  } catch (e) {
    showToast('Revoke failed: ' + e.message, 3000);
  }
};
// Also expose as underscore-prefixed for inline onclick handlers in cards
function _saPartnersRevokePartner(apiKey, name) { window.saPartnersRevokePartner(apiKey, name); }

// ── View Usage Panel ──────────────────────────────────────────────────────────
window.saPartnersViewUsage = async function(apiKey, name) {
  _spInjectStyles();

  // Remove existing panel if open
  document.getElementById('sp-usage-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'sp-usage-panel';
  panel.className = 'sp-slide-panel';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div>
        <div style="font-size:0.68rem;letter-spacing:0.20em;text-transform:uppercase;color:${_CP.amber};margin-bottom:3px;">Usage Analytics</div>
        <div style="font-size:1.1rem;font-weight:600;color:${_CP.text};">${_esc(name)}</div>
      </div>
      <button onclick="document.getElementById('sp-usage-panel').remove()"
        style="background:none;border:none;color:${_CP.dim};font-size:1.4rem;cursor:pointer;line-height:1;padding:4px 8px;"
        aria-label="Close">×</button>
    </div>
    <div id="sp-usage-body" style="color:${_CP.muted};font-size:0.90rem;">Loading…</div>`;

  document.body.appendChild(panel);

  try {
    const db = firebase.database();
    const [usageSnap, webhookSnap] = await Promise.all([
      db.ref('partner_usage/' + apiKey).once('value').catch(() => null),
      db.ref('partner_webhook_log/' + apiKey).orderByKey().limitToLast(20).once('value').catch(() => null),
    ]);

    const usageData  = (usageSnap && usageSnap.val()) || {};
    const webhookRaw = (webhookSnap && webhookSnap.val()) || {};

    // Store in cache
    _partnerUsageCache[apiKey] = usageData;

    // Build 30-day chart data
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      days.push({ key: k, label: String(d.getDate()), val: usageData[k] || 0 });
    }
    const maxVal = Math.max(...days.map(d => d.val), 1);

    // Totals by instrument
    const totals = { MAP: 0, 'MMAS-8': 0, PEACS: 0 };
    Object.values(usageData).forEach(dayData => {
      if (typeof dayData === 'object') {
        Object.entries(dayData).forEach(([inst, n]) => { if (totals[inst] !== undefined) totals[inst] += n; });
      }
    });

    // Webhook log entries
    const webhookEntries = Object.entries(webhookRaw)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 20);

    const chartBars = days.map(d => {
      const barW = Math.round(d.val / maxVal * 100);
      const color = d.val === 0 ? 'rgba(255,255,255,0.06)' : _CP.cyan;
      return `
        <div class="sp-bar-chart-row" title="${d.key}: ${d.val} calls">
          <div class="sp-bar-chart-label">${_esc(d.label)}</div>
          <div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
          </div>
          <div class="sp-bar-chart-val">${d.val}</div>
        </div>`;
    }).join('');

    const webhookRows = webhookEntries.length
      ? webhookEntries.map(([k, v]) => {
          const status = v.status || '—';
          const statusColor = status >= 200 && status < 300 ? _CP.green : _CP.red;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid ${_CP.border};font-size:0.78rem;">
              <span style="font-family:'IBM Plex Mono',monospace;color:${statusColor};width:36px;flex-shrink:0;">${_esc(String(status))}</span>
              <span style="color:${_CP.muted};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(v.url || v.event || k)}</span>
              <span style="color:${_CP.dim};font-size:0.72rem;white-space:nowrap;">${_spTimeAgo(v.timestamp)}</span>
            </div>`;
        }).join('')
      : `<div style="color:${_CP.dim};font-size:0.82rem;padding:12px 0;">No webhook deliveries recorded.</div>`;

    document.getElementById('sp-usage-body').innerHTML = `
      <div style="margin-bottom:22px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CP.dim};margin-bottom:10px;">30-Day API Usage</div>
        <div style="max-height:340px;overflow-y:auto;">${chartBars}</div>
      </div>

      <div style="margin-bottom:22px;">
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CP.dim};margin-bottom:10px;">Totals by Instrument</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${['MAP','MMAS-8','PEACS'].map(inst => {
            const chipClass = inst === 'MAP' ? 'sp-chip-map' : inst === 'MMAS-8' ? 'sp-chip-mmas' : 'sp-chip-peacs';
            return `
              <div style="background:${_CP.bg2};border:1px solid ${_CP.border};border-radius:8px;padding:12px;text-align:center;">
                <span class="sp-chip ${chipClass}" style="margin-bottom:6px;">${inst}</span>
                <div style="font-size:1.35rem;font-weight:700;color:${_CP.text};margin-top:6px;">${totals[inst] || 0}</div>
                <div style="font-size:0.68rem;color:${_CP.dim};">assessments</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_CP.dim};margin-bottom:10px;">Recent Webhook Deliveries (last 20)</div>
        ${webhookRows}
      </div>`;

  } catch (e) {
    document.getElementById('sp-usage-body').innerHTML =
      `<div style="color:${_CP.red};font-size:0.88rem;">Error loading usage data: ${_esc(e.message)}</div>`;
  }
};
// Underscore alias for inline onclick
function _saPartnersViewUsage(apiKey, name) { window.saPartnersViewUsage(apiKey, name); }

// ── Load from Firebase ────────────────────────────────────────────────────────
window.saPartnersLoad = async function() {
  try {
    const snap = await firebase.database().ref('partner_keys').once('value');
    const raw  = snap.val() || {};
    _partnersCache = Object.entries(raw).map(([k, v]) => ({ _key: k, ...v }))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    // Load today's usage for all partners (parallel)
    const today = _spTodayKey();
    await Promise.all(_partnersCache.map(async p => {
      try {
        const uSnap = await firebase.database().ref('partner_usage/' + p._key + '/' + today).once('value');
        if (!_partnerUsageCache[p._key]) _partnerUsageCache[p._key] = {};
        _partnerUsageCache[p._key][today] = uSnap.val() || 0;
      } catch (_) { /* non-fatal */ }
    }));

  } catch (e) {
    showToast('Error loading partners: ' + e.message, 3000);
  }
};

// ── Init (entry point) ────────────────────────────────────────────────────────
window.saPartnersInit = async function(container) {
  if (!container) return;
  container.innerHTML = `<div style="color:${_CP.muted};font-size:0.90rem;padding:20px 0;">Loading partners…</div>`;
  await window.saPartnersLoad();
  window.saPartnersRender(container);
};
