// sa-platform.js — Platform Management: workspaces, campaigns, API keys, letters of permission, site banner, module paths, access requests, system

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM TAB — Administrative Oversight
// Sub-sections: Workspaces · Campaigns · Internal Keys · Partner APIs · Letters · Site Banner · Module Paths · Requests · System
// ══════════════════════════════════════════════════════════════════════════════

let _saPlatTab = 'workspaces';
let _saPlatWsAll = [];

const _SA_PLAT_SUBS = [
  { id: 'workspaces', label: '⬡ Workspaces'   },
  { id: 'campaigns',  label: '◆ Campaigns'    },
  { id: 'api',        label: '◈ Developer Keys' },
  { id: 'partners',   label: '⬡ Partner APIs'  },
  { id: 'letters',    label: '✉ Letters'      },
  { id: 'banner',     label: '📢 Banner'       },
  { id: 'modules',    label: '◫ Module Paths' },
  { id: 'requests',   label: '◐ Requests'     },
  { id: 'system',     label: '◉ System'       },
];

function _saRenderPlatform(container) {
  container.innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:4px;">Mission Control · Platform</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_C.text};">Administrative Oversight</div>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid ${_C.border};padding-bottom:12px;flex-wrap:wrap;">
      ${_SA_PLAT_SUBS.map(s => `
        <button data-plat="${s.id}" onclick="_saPlatNav('${s.id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;
          text-transform:uppercase;padding:6px 14px;border-radius:6px;cursor:pointer;
          transition:all 0.18s;border:1px solid transparent;background:transparent;color:${_C.muted};">
          ${s.label}
        </button>`).join('')}
    </div>
    <div id="sa-plat-body"></div>
  `;
  _saPlatNav(_saPlatTab);
}

function _saPlatNav(tab) {
  _saPlatTab = tab;
  document.querySelectorAll('[data-plat]').forEach(b => {
    const on = b.dataset.plat === tab;
    b.style.background    = on ? _C.amberFaint : 'transparent';
    b.style.color         = on ? _C.amber       : _C.muted;
    b.style.borderColor   = on ? _C.amberDim    : 'transparent';
  });
  const body = document.getElementById('sa-plat-body');
  if (!body) return;
  body.innerHTML = `<div style="color:${_C.muted};font-size:0.96rem;padding:20px 0;">Loading…</div>`;
  switch (tab) {
    case 'workspaces': _saPlatWorkspaces(body); break;
    case 'campaigns':  _saPlatCampaigns(body);  break;
    case 'api':        _saPlatApiKeys(body);    break;
    case 'partners':   (window.saPartnersInit ? window.saPartnersInit(body) : (body.innerHTML = `<div style="color:${_C.muted};padding:20px;">Partner API module not loaded.</div>`)); break;
    case 'letters':    _saPlatLetters(body);    break;
    case 'banner':     _saPlatBanner(body);        break;
    case 'modules':    _saPlatModulePaths(body);  break;
    case 'requests':   _saPlatRequests(body);     break;
    case 'system':     _saPlatSystem(body);        break;
  }
}

// ── Workspaces ────────────────────────────────────────────────────────────────

async function _saPlatWorkspaces(container) {
  try {
    const token = await _accGetToken();
    const [keysRes, aSnap, pSnap, wsSnap, deletedSnap] = await Promise.all([
      fetch(LAMBDA_URL + '/admin/list-keys', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      }).then(r => r.json()),
      database.ref('assessments').once('value').catch(() => null),
      database.ref('peacs_assessments').once('value').catch(() => null),
      database.ref('workspaces').once('value').catch(() => null),
      database.ref('atlas_deleted_keys').once('value').catch(() => null),
    ]);
    if (keysRes.error) throw new Error('Lambda: ' + keysRes.error);
    const deletedKeys = new Set(Object.keys((deletedSnap && deletedSnap.val()) || {}));
    const wsMap = {};
    if (wsSnap && wsSnap.val()) Object.entries(wsSnap.val()).forEach(([k,v]) => { wsMap[k.toUpperCase()] = v; });
    const mmasCounts = {}, mapCounts = {}, peacsCounts = {}, lastSeen = {};
    const _tally = (snap, counts) => { if (snap && snap.val()) Object.values(snap.val()).forEach(r => { const c=(r.institution_code||'').toUpperCase(); if(!c)return; counts[c]=(counts[c]||0)+1; if(r.timestamp) lastSeen[c]=Math.max(lastSeen[c]||0,r.timestamp); }); };
    if (aSnap && aSnap.val()) Object.values(aSnap.val()).forEach(r => { const c=(r.institution_code||'').toUpperCase(); if(!c)return; const bucket=(r.tool==='map'||r.map_q1!==undefined)?mapCounts:mmasCounts; bucket[c]=(bucket[c]||0)+1; if(r.timestamp) lastSeen[c]=Math.max(lastSeen[c]||0,r.timestamp); });
    _tally(pSnap, peacsCounts);
    _saPlatWsAll = (keysRes.keys || [])
      .filter(k => !deletedKeys.has(k.key||''))
      .map(k => {
        const ws = wsMap[(k.key||'').toUpperCase()] || {};
        return { ...k, ...(ws.name?{name:ws.name}:{}), ...(ws.institution?{institution:ws.institution}:{}),
          mmas: mmasCounts[(k.key||'').toUpperCase()]||0,
          map: mapCounts[(k.key||'').toUpperCase()]||0,
          peacs: peacsCounts[(k.key||'').toUpperCase()]||0,
          lastActive: lastSeen[(k.key||'').toUpperCase()]||0,
          region: ws.region || null };
      });
    _saPlatRenderWsTable(container, _saPlatWsAll);
  } catch(e) {
    container.innerHTML = `<div style="color:${_C.red};font-size:0.96rem;">Error loading workspaces: ${_saEsc(e.message)}</div>`;
  }
}

function _saPlatRenderWsTable(container, keys) {
  const timeAgo = ts => { if(!ts)return'—'; const d=Date.now()-ts; if(d<86400000)return Math.floor(d/3600000)+'h ago'; if(d<30*86400000)return Math.floor(d/86400000)+'d ago'; return new Date(ts).toLocaleDateString(); };
  const roleColor = { superadmin:_C.amber, institution:_C.purple, pi:_C.blue, researcher:_C.cyan, student:_C.green, independent:_C.green, observer:_C.dim, clinician:_C.green };
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      <input id="sa-plat-ws-q" type="text" placeholder="Search key · name · institution · role…"
        oninput="_saPlatWsFilter(this.value)"
        style="flex:1;background:${_C.surface};border:1px solid ${_C.border};border-radius:7px;padding:8px 14px;
        color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.94rem;outline:none;"
        onfocus="this.style.borderColor='${_C.borderB}'" onblur="this.style.borderColor='${_C.border}'"/>
      <span style="font-size:0.80rem;letter-spacing:0.1em;color:${_C.dim};white-space:nowrap;">${keys.length} workspaces</span>
      <button onclick="_saPlatWsNew()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:7px 14px;border-radius:6px;cursor:pointer;white-space:nowrap;
               background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;"
        onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">
        + Add New
      </button>
    </div>
    <div style="overflow:auto;max-height:calc(100vh - 300px);">
      <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
        <thead>
          <tr style="border-bottom:1px solid ${_C.borderB};">
            ${['Key','Name','Role','Institution','MMAS','MAP','PEACS','Last Active','Region',''].map(h=>`<th style="text-align:left;padding:8px 10px;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};font-weight:400;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="sa-plat-ws-tbody">
          ${_saPlatWsRows(keys)}
        </tbody>
      </table>
    </div>`;
}

function _saPlatWsRows(keys) {
  const timeAgo = ts => { if(!ts)return'—'; const d=Date.now()-ts; if(d<86400000)return Math.floor(d/3600000)+'h ago'; if(d<30*86400000)return Math.floor(d/86400000)+'d ago'; return new Date(ts).toLocaleDateString(); };
  const roleColor = { superadmin:_C.amber, institution:_C.purple, pi:_C.blue, researcher:_C.cyan, student:_C.green, independent:_C.green, observer:_C.dim };
  if (!keys.length) return `<tr><td colspan="10" style="padding:24px;text-align:center;color:${_C.dim};font-size:0.90rem;">No matches</td></tr>`;
  return keys.map(k => {
    const rc = roleColor[k.role] || _C.muted;
    return `<tr style="border-bottom:1px solid ${_C.border};transition:background 0.12s;"
        onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
      <td style="padding:9px 10px;font-size:0.86rem;color:${_C.amber};letter-spacing:0.06em;">${_saEsc(k.key||'')}</td>
      <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_saEsc(k.name||'')}">${_saEsc(k.name||'—')}</td>
      <td style="padding:9px 10px;"><button onclick="_saPlatWsSetRole('${_saEsc(k.key||'')}','${_saEsc(k.role||'')}')" title="Click to change role" style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border-radius:4px;cursor:pointer;background:${rc}18;border:1px solid ${rc}44;color:${rc};transition:all 0.15s;" onmouseover="this.style.background='${rc}30'" onmouseout="this.style.background='${rc}18'">${_saEsc(k.role||'?')}</button></td>
      <td style="padding:9px 10px;font-size:0.84rem;color:${_C.muted};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_saEsc(k.institution||'—')}</td>
      <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};text-align:right;">${k.mmas||0}</td>
      <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};text-align:right;">${k.map||0}</td>
      <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};text-align:right;">${k.peacs||0}</td>
      <td style="padding:9px 10px;font-size:0.82rem;color:${_C.muted};">${timeAgo(k.lastActive)}</td>
      <td style="padding:9px 10px;">
        ${(()=>{ const r=k.region||'us'; const cfg={us:{label:'US',color:_C.blue},eu:{label:'EU',color:'#06b6d4'},uae:{label:'UAE',color:_C.green}}[r]||{label:r.toUpperCase(),color:_C.dim}; return `<button onclick="_saPlatWsSetRegion('${_saEsc(k.key||'')}','${r}')" title="Click to change data region" style="font-family:'IBM Plex Mono',monospace;font-size:0.64rem;letter-spacing:0.14em;text-transform:uppercase;padding:2px 8px;border-radius:4px;cursor:pointer;background:${cfg.color}18;border:1px solid ${cfg.color}44;color:${cfg.color};transition:all 0.15s;" onmouseover="this.style.background='${cfg.color}30'" onmouseout="this.style.background='${cfg.color}18'">${cfg.label}</button>`; })()}
      </td>
      <td style="padding:9px 10px;">
        <div style="display:flex;gap:6px;">
          <button onclick="accOpenEditKey('${_saEsc(k.key||'')}');setTimeout(()=>{const o=document.getElementById('sa-overlay');if(o)o.style.zIndex='9800';},50);"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:4px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">Edit</button>
          <button onclick="_saPlatWsDelete('${_saEsc(k.key||'')}','${_saEsc(k.name||k.key||'')}')"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid ${_C.red}44;color:${_C.red};transition:all 0.15s;"
            onmouseover="this.style.background='rgba(239,68,68,0.12)'" onmouseout="this.style.background='transparent'">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _saPlatWsFilter(q) {
  q = (q||'').toLowerCase();
  const filtered = q ? _saPlatWsAll.filter(k =>
    (k.key||'').toLowerCase().includes(q) || (k.name||'').toLowerCase().includes(q) ||
    (k.institution||'').toLowerCase().includes(q) || (k.role||'').toLowerCase().includes(q)
  ) : _saPlatWsAll;
  const tbody = document.getElementById('sa-plat-ws-tbody');
  if (tbody) tbody.innerHTML = _saPlatWsRows(filtered);
}

// ── Add New Workspace modal ────────────────────────────────────────────────────
function _saPlatWsAutoKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = n => Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  const role = document.getElementById('sa-ws-new-role')?.value || 'researcher';
  const prefixMap = { student:'STU', clinician:'CLI', pharmacist:'PHRM', np:'NP', pa:'PA', rn:'RN', md:'MD', care_coordinator:'CC', researcher:'RES', pi:'PI', institution_academic:'INST-ACAD', institution_health:'INST-HLTH', institution_amc:'INST-AMC', observer:'OBS', independent:'IND', superadmin:'SA' };
  const prefix = prefixMap[role] || 'RES';
  const el = document.getElementById('sa-ws-new-key');
  if (el) el.value = `${prefix}-${seg(4)}-${seg(4)}-2027`;
}

function _saPlatWsNew() {
  const _inp = (id, ph, extra='') => `<input id="${id}" placeholder="${ph}" ${extra}
    style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;"/>`;
  const _lbl = (text, sub='') => `<label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${text}${sub ? `<span style="opacity:0.45;font-weight:400;margin-left:5px;text-transform:none;letter-spacing:0;font-size:0.78rem;">${sub}</span>` : ''}</label>`;
  const _sec = (title) => `<div style="font-size:0.60rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${_C.border};">${title}</div>`;
  const _note = (txt) => `<div style="font-size:0.68rem;color:${_C.dim};margin-top:3px;line-height:1.4;">${txt}</div>`;
  const _inpSty = `width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;`;

  _saShowModal({
    title: '+ New Workspace',
    width: '700px',
    body: `
      <div style="display:flex;flex-direction:column;gap:18px;">

        <!-- PERSON -->
        <div>
          ${_sec('Person')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1.6fr;gap:10px;">
            <div>${_lbl('First Name')}${_inp('sa-ws-new-fname','e.g. Aliki')}</div>
            <div>${_lbl('Last Name')}${_inp('sa-ws-new-lname','e.g. Peletidi')}</div>
            <div>${_lbl('Email','*')}${_inp('sa-ws-new-email','researcher@university.edu','type="email"')}</div>
          </div>
        </div>

        <!-- WORKSPACE -->
        <div>
          ${_sec('Workspace')}
          <div style="display:grid;grid-template-columns:1.1fr 0.7fr 1fr;gap:10px;">
            <div>
              ${_lbl('Role','*')}
              <select id="sa-ws-new-role"
                style="${_inpSty}cursor:pointer;">
                <option value="student">Student</option>
                <option value="researcher" selected>Researcher</option>
                <option value="clinician">Clinician</option>
                <option value="pi">PI · Multi-Site</option>
                <option value="observer">Observer</option>
                <optgroup label="Institution">
                  <option value="institution_academic">Institution · Academic</option>
                  <option value="institution_health">Institution · Health System</option>
                  <option value="institution_amc">Institution · Academic Med Ctr</option>
                </optgroup>
              </select>
            </div>
            <div>
              ${_lbl('Data Region')}
              <select id="sa-ws-new-region" style="${_inpSty}cursor:pointer;">
                <option value="us" selected>US — Virginia</option>
                <option value="eu">EU — Frankfurt</option>
                <option value="uae">UAE — Abu Dhabi</option>
              </select>
              ${_note('Routes Lambda + data writes.')}
            </div>
            <div>${_lbl('Display Name','(optional)')}${_inp('sa-ws-new-name','e.g. SIMAT Research Group')}
              ${_note('Key is auto-generated by the system and emailed to the recipient.')}</div>
          </div>
        </div>

        <!-- ORGANIZATION & HIERARCHY -->
        <div>
          ${_sec('Organization & Hierarchy')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div>${_lbl('Institution Name')}${_inp('sa-ws-new-inst','e.g. University of Nicosia')}</div>
            <div>
              ${_lbl('Parent Institution Key','(optional)')}
              ${_inp('sa-ws-new-parent-inst','e.g. INST-UNIC-2026','oninput="this.value=this.value.toUpperCase()"')}
              ${_note('Links this workspace under an institution dashboard.')}
            </div>
            <div>
              ${_lbl('Parent PI Key','(optional)')}
              ${_inp('sa-ws-new-parent-pi','e.g. PI-UNIC-AB12-2026','oninput="this.value=this.value.toUpperCase()"')}
              ${_note('For students/researchers under a PI. Gives PI oversight.')}
            </div>
          </div>
        </div>

        <!-- STUDY / CAMPAIGN -->
        <div>
          ${_sec('Study / Campaign <span style="opacity:0.35;font-size:0.56rem;text-transform:none;letter-spacing:0;">— all optional</span>')}
          <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:10px;">
            <div>${_lbl('Study Title')}${_inp('sa-ws-new-study','e.g. Adherence in hypertensive patients — KNH')}</div>
            <div>${_lbl('Campaign Tag')}${_inp('sa-ws-new-campaign','e.g. SIMAT-2026')}</div>
            <div>
              ${_lbl('Key Expiry')}
              <input id="sa-ws-new-expiry" type="date"
                style="${_inpSty}"/>
            </div>
          </div>
        </div>

        <!-- ACCESS & NOTES -->
        <div>
          ${_sec('Access & Notes')}
          <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;">
            <div>
              ${_lbl('PEACS Dimensions')}
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                <label style="display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.muted};cursor:pointer;white-space:nowrap;"><input type="checkbox" id="sa-ws-new-dim-base" checked style="accent-color:var(--base);width:13px;height:13px;"> BASE <span style="color:${_C.dim};font-size:0.76rem;">(30d · behavioral)</span></label>
                <label style="display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.muted};cursor:pointer;white-space:nowrap;"><input type="checkbox" id="sa-ws-new-dim-mvmt" checked style="accent-color:#8b6ff5;width:13px;height:13px;"> MVMT <span style="color:${_C.dim};font-size:0.76rem;">(7d · execution)</span></label>
                <label style="display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:${_C.muted};cursor:pointer;white-space:nowrap;"><input type="checkbox" id="sa-ws-new-dim-strata" checked style="accent-color:var(--strata);width:13px;height:13px;"> STRATA <span style="color:${_C.dim};font-size:0.76rem;">(90d · context)</span></label>
              </div>
            </div>
            <div>
              ${_lbl('SA Note','(internal only)')}
              <textarea id="sa-ws-new-note" placeholder="e.g. Pilot cohort, complimentary access approved by Dr. Morisky · ref email 2026-05-20" rows="4"
                style="${_inpSty}resize:vertical;line-height:1.5;"></textarea>
            </div>
          </div>
        </div>

        <!-- TESSERA GRC -->
        <div>
          ${_sec('TESSERA GRC <span style="opacity:0.35;font-size:0.56rem;text-transform:none;letter-spacing:0;">— optional</span>')}
          <div style="margin-top:6px;">
            <label style="display:inline-flex;align-items:center;gap:8px;font-family:\'IBM Plex Mono\',monospace;font-size:0.82rem;color:${_C.muted};cursor:pointer;">
              <input type="checkbox" id="sa-ws-new-tessera-toggle"
                style="accent-color:#d4a843;width:14px;height:14px;"
                onchange="document.getElementById(\'sa-ws-new-tessera-opts\').style.display=this.checked?\'grid\':\'none\'">
              Add as TESSERA Member
            </label>
          </div>
          <div id="sa-ws-new-tessera-opts" style="display:none;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
            <div>
              ${_lbl('TESSERA Tier','*')}
              <select id="sa-ws-new-tessera-tier" style="${_inpSty}cursor:pointer;">
                <option value="3" selected>Research Affiliate (Tier 3)</option>
                <option value="1">Institutional Partner (Tier 1)</option>
                <option value="2">Validation Partner (Tier 2)</option>
                <option value="4">Student Affiliate (Tier 4)</option>
                <option value="5">Industry Partner (Tier 5)</option>
              </select>
            </div>
            <div>
              ${_lbl('Country','(optional)')}
              <select id="sa-ws-new-tessera-country" style="${_inpSty}cursor:pointer;">
                <option value="">— select country —</option>
                ${(typeof _CONS_COUNTRIES !== 'undefined' ? _CONS_COUNTRIES : ['United States','United Kingdom','Canada','Australia','Germany','France','Brazil','India','China','Japan','South Africa','Other']).map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div id="sa-ws-new-err" style="font-size:0.84rem;color:${_C.red};min-height:18px;"></div>
      </div>`,
    confirmLabel: 'Create Workspace',
    onConfirm: async () => {
      const fname      = (document.getElementById('sa-ws-new-fname')?.value||'').trim();
      const lname      = (document.getElementById('sa-ws-new-lname')?.value||'').trim();
      const email      = (document.getElementById('sa-ws-new-email')?.value||'').trim().toLowerCase();
      const _roleRaw   = document.getElementById('sa-ws-new-role')?.value || 'researcher';
      const nameInput  = (document.getElementById('sa-ws-new-name')?.value||'').trim();
      const name       = nameInput || (fname && lname ? `${fname} ${lname}` : fname || lname || email);
      const inst       = (document.getElementById('sa-ws-new-inst')?.value||'').trim();
      const parentInst = (document.getElementById('sa-ws-new-parent-inst')?.value||'').trim().toUpperCase()||null;
      const parentPi   = (document.getElementById('sa-ws-new-parent-pi')?.value||'').trim().toUpperCase()||null;
      const study      = (document.getElementById('sa-ws-new-study')?.value||'').trim()||null;
      const campaign   = (document.getElementById('sa-ws-new-campaign')?.value||'').trim()||null;
      const expiry     = document.getElementById('sa-ws-new-expiry')?.value||null;
      const note        = (document.getElementById('sa-ws-new-note')?.value||'').trim()||null;
      const tesseraOn   = document.getElementById('sa-ws-new-tessera-toggle')?.checked || false;
      const tesseraTier = tesseraOn ? parseInt(document.getElementById('sa-ws-new-tessera-tier')?.value || '3', 10) : null;
      const tesseraCntry= tesseraOn ? (document.getElementById('sa-ws-new-tessera-country')?.value || '') : null;
      const dims        = ['base','mvmt','strata'].filter(d => document.getElementById('sa-ws-new-dim-'+d)?.checked);
      const region     = document.getElementById('sa-ws-new-region')?.value || 'us';
      const _instTypeMap = { institution_academic:'academic', institution_health:'health', institution_amc:'amc' };
      // Firebase role — the actual role stored in the workspace profile
      const role = _instTypeMap[_roleRaw] ? 'institution' : _roleRaw;
      const institution_type = _instTypeMap[_roleRaw] || null;
      const lambdaRole = role;
      const errEl = document.getElementById('sa-ws-new-err');
      if (!email) { if(errEl) errEl.textContent = 'Email is required.'; return false; }
      if (!inst)  { if(errEl) errEl.textContent = 'Institution name is required.'; return false; }
      if (!dims.length) { if(errEl) errEl.textContent = 'Select at least one PEACS dimension.'; return false; }
      try {
        // Use /issue-key — the only Lambda route that creates keys in SSM.
        // It auto-generates the key and returns it; we then write the full profile to Firebase.
        if (errEl) errEl.textContent = 'Creating workspace…';
        const rawResp = await fetch(LAMBDA_URL + '/issue-key', {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, institution: inst, role: lambdaRole, peacs_dims: dims,
            ...(institution_type ? { institution_type } : {}),
            ...(parentInst ? { parent_institution: parentInst } : {}),
            ...(parentPi   ? { parent_pi: parentPi }           : {}),
            ...(study      ? { study_title: study }            : {})
          })
        });
        const res = await rawResp.json().catch(() => ({}));
        if (!res.key) {
          if(errEl) errEl.textContent = res.error || `Issue failed (HTTP ${rawResp.status}) — ` + JSON.stringify(res);
          return false;
        }
        const issuedKey = res.key;
        // Clear any tombstone for this key
        await database.ref('atlas_deleted_keys/' + issuedKey).remove().catch(() => {});
        // Write full workspace profile to Firebase using the Lambda-issued key
        const wsData = { role, created_at: Date.now(), name, peacs_dims: dims };
        if (fname)          wsData.first_name       = fname;
        if (lname)          wsData.last_name        = lname;
        if (email)          wsData.email            = email;
        if (inst)           wsData.institution      = inst;
        if (institution_type) wsData.institution_type = institution_type;
        if (parentInst)     wsData.parent_institution = parentInst;
        if (parentPi)       wsData.parent_pi        = parentPi;
        if (study)          wsData.study_title      = study;
        if (campaign)       wsData.campaign_tag     = campaign;
        if (expiry)         wsData.expiry           = expiry;
        if (note)           wsData.sa_note          = note;
        if (region && region !== 'us') wsData.region = region;
        if (tesseraOn && tesseraTier) { wsData.tessera_member = true; wsData.tessera_tier = tesseraTier; }
        await database.ref('workspaces/' + issuedKey).update(wsData);
        if (tesseraOn && tesseraTier) {
          await database.ref('consortium_members').push({
            name, email, institution: inst, study_title: study || null,
            country: tesseraCntry || '', tier: tesseraTier, instruments: ['MAP'],
            status: 'active', contact_email: email,
            joined_at: Date.now(), contribution_count: 0,
            workspace_key: issuedKey, source: 'mission_control',
          });
        }
        showToast(`Workspace ${issuedKey} created for ${email}.${tesseraOn ? ' Added to TESSERA.' : ''}`, 4000);
        const container = document.getElementById('sa-plat-body');
        if (container) _saPlatWorkspaces(container);
        return true;
      } catch(e) {
        const msg = e.message || String(e);
        if(errEl) errEl.textContent = msg === 'Failed to fetch'
          ? 'Network error — Lambda may not be deployed or is unreachable. Check AWS Lambda console.'
          : 'Error: ' + msg;
        console.error('[SA create workspace]', e);
        return false;
      }
    }
  });
}

// ── Delete Workspace ───────────────────────────────────────────────────────────
// Lambda revoke/delete endpoints are not available — deletion is managed in
// Firebase. A tombstone at atlas_deleted_keys/{key} persists across sessions
// and is filtered out during list rendering. The SSM key entry remains but
// has no profile. Assessment records are retained.
async function _saPlatWsDelete(key, displayName) {
  if (!confirm(`Remove workspace "${displayName || key}"?\n\nThis will delete the workspace profile and hide it from all views. Assessment records are retained.\n\nThis cannot be undone.`)) return;
  try {
    await Promise.all([
      database.ref('workspaces/' + key).remove().catch(() => {}),
      database.ref('atlas_deleted_keys/' + key).set({ deleted_at: Date.now(), key })
    ]);
    showToast(`Workspace ${key} removed.`, 2500);
    const container = document.getElementById('sa-plat-body');
    if (container) _saPlatWorkspaces(container);
  } catch(e) {
    showToast('Remove failed: ' + e.message, 3000);
  }
}

// ── Set Region ────────────────────────────────────────────────────────────────
function _saPlatWsSetRegion(key, currentRegion) {
  const regionCfg = {
    us:  { label: 'US — Virginia (us-east-1)',        color: _C.blue,        desc: 'Default. Routes to US Lambda and Firebase RTDB.' },
    eu:  { label: 'EU — Frankfurt (eu-central-1)',    color: '#06b6d4',      desc: 'GDPR. Routes to EU Lambda. Set workspaceProfile.region = eu.' },
    uae: { label: 'UAE — Abu Dhabi (me-central-1)',   color: _C.green,       desc: 'UAE PDPL. Routes to ALTHIQA Lambda. Workspace key prefix should be ALTHIQA-.' }
  };
  const optHtml = Object.entries(regionCfg).map(([val, cfg]) => `
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid ${val===currentRegion?cfg.color+'66':_C.border};background:${val===currentRegion?cfg.color+'12':'transparent'};cursor:pointer;margin-bottom:6px;transition:all 0.15s;"
      onmouseover="this.style.background='${cfg.color}10'" onmouseout="this.style.background='${val===currentRegion?cfg.color+'12':'transparent'}'">
      <input type="radio" name="sa-region-pick" value="${val}" ${val===currentRegion?'checked':''} style="margin-top:2px;accent-color:${cfg.color};">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;color:${cfg.color};margin-bottom:2px;">${cfg.label}</div>
        <div style="font-size:0.78rem;color:${_C.dim};line-height:1.5;">${cfg.desc}</div>
      </div>
    </label>`).join('');
  _saShowModal({
    title: `Data Region — ${key}`,
    width: '480px',
    body: `
      <div style="font-size:0.80rem;color:${_C.muted};margin-bottom:14px;line-height:1.6;">
        Select the AWS region where this workspace's data writes will be routed.
        Takes effect on the user's next login.
      </div>
      ${optHtml}
      <div id="sa-region-err" style="font-size:0.82rem;color:${_C.red};min-height:16px;margin-top:6px;"></div>`,
    confirmLabel: 'Save Region',
    onConfirm: async () => {
      const picked = document.querySelector('input[name="sa-region-pick"]:checked')?.value;
      if (!picked) { document.getElementById('sa-region-err').textContent = 'Select a region.'; return false; }
      try {
        await database.ref('workspaces/' + key + '/region').set(picked);
        showToast(`Region for ${key} set to ${picked.toUpperCase()}.`, 3000);
        const container = document.getElementById('sa-plat-body');
        if (container) _saPlatWorkspaces(container);
        return true;
      } catch(e) {
        document.getElementById('sa-region-err').textContent = 'Save failed: ' + e.message;
        return false;
      }
    }
  });
}
window._saPlatWsSetRegion = _saPlatWsSetRegion;

// ── Change Workspace Role ─────────────────────────────────────────────────────
function _saPlatWsSetRole(key, currentRole) {
  const roles = [
    { value: 'student',              label: 'Student',               color: _C.green,  desc: 'Thesis/dissertation workspace. Up to 100 records/mo. LMIC and TESSERA affiliate pathway.' },
    { value: 'researcher',           label: 'Researcher',            color: _C.cyan,   desc: 'Standard research workspace. Full assessment suite, MAP, export, and psychometrics.' },
    { value: 'pi',                   label: 'PI · Multi-Site',       color: _C.blue,   desc: 'Principal Investigator workspace. Sub-workspace provisioning, validation pipeline, multi-site oversight.' },
    { value: 'institution_academic', label: 'Institution · Academic',color: _C.purple, desc: 'Academic institution workspace. Population-level command center and multi-PI dashboard.' },
    { value: 'institution_health',   label: 'Institution · Health',  color: _C.purple, desc: 'Health system workspace. Clinical triage, Sentinel alerting, population health.' },
    { value: 'clinician',            label: 'Clinician',             color: _C.green,  desc: 'Data entry and patient-facing. Data flows upward to PI and institution workspaces.' },
    { value: 'observer',             label: 'Observer',              color: _C.dim,    desc: 'Read-only access. No assessment submission or data export.' },
  ];
  const optHtml = roles.map(r => `
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid ${r.value===currentRole?r.color+'66':_C.border};background:${r.value===currentRole?r.color+'12':'transparent'};cursor:pointer;margin-bottom:6px;transition:all 0.15s;"
      onmouseover="this.style.background='${r.color}10'" onmouseout="this.style.background='${r.value===currentRole?r.color+'12':'transparent'}'">
      <input type="radio" name="sa-role-pick" value="${r.value}" ${r.value===currentRole?'checked':''} style="margin-top:2px;accent-color:${r.color};">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;letter-spacing:0.1em;color:${r.color};margin-bottom:2px;">${r.label}</div>
        <div style="font-size:0.78rem;color:${_C.dim};line-height:1.5;">${r.desc}</div>
      </div>
    </label>`).join('');
  _saShowModal({
    title: `Change Role — ${key}`,
    width: '500px',
    body: `
      <div style="font-size:0.80rem;color:${_C.muted};margin-bottom:14px;line-height:1.6;">
        Role change takes effect on the user's next login. TESSERA GRC tier is managed separately in the Consortium panel.
      </div>
      ${optHtml}
      <div id="sa-role-err" style="font-size:0.82rem;color:${_C.red};min-height:16px;margin-top:6px;"></div>`,
    confirmLabel: 'Save Role',
    onConfirm: async () => {
      const picked = document.querySelector('input[name="sa-role-pick"]:checked')?.value;
      if (!picked) { document.getElementById('sa-role-err').textContent = 'Select a role.'; return false; }
      if (picked === currentRole) { document.getElementById('sa-role-err').textContent = 'No change — same role selected.'; return false; }
      try {
        await database.ref('workspaces/' + key + '/role').set(picked);
        if (typeof atlasAuditLog === 'function') atlasAuditLog('workspace_role_changed', { key, from: currentRole, to: picked });
        if (typeof showToast === 'function') showToast(`Role for ${key} changed to ${picked}.`, 3000);
        const container = document.getElementById('sa-plat-body');
        if (container) _saPlatWorkspaces(container);
        return true;
      } catch(e) {
        document.getElementById('sa-role-err').textContent = 'Save failed: ' + e.message;
        return false;
      }
    }
  });
}
window._saPlatWsSetRole = _saPlatWsSetRole;

// ── Campaigns ─────────────────────────────────────────────────────────────────

async function _saPlatCampaigns(container) {
  try {
    const snap = await database.ref('campaigns').once('value');
    const raw = snap.val() || {};
    const camps = Object.entries(raw).map(([id,c])=>({id,...c})).sort((a,b)=>(b.created_at||0)-(a.created_at||0));
    container.innerHTML = `
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px;margin-bottom:20px;">
        <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:12px;">New Campaign</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">
          ${[['Campaign Name','sa-plat-camp-name','text','e.g. SIMAT Spring 2026'],['Start Date','sa-plat-camp-start','date',''],['End Date','sa-plat-camp-end','date','']].map(([l,id,t,ph])=>`
            <div>
              <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${l}</label>
              <input id="${id}" type="${t}" placeholder="${ph}" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;"/>
            </div>`).join('')}
          <button onclick="_saPlatCreateCampaign()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;padding:8px 16px;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};white-space:nowrap;transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">+ Create</button>
        </div>
        <div id="sa-plat-camp-st" style="font-size:0.84rem;color:${_C.muted};margin-top:8px;min-height:16px;"></div>
      </div>
      ${!camps.length
        ? `<div style="text-align:center;padding:40px;color:${_C.dim};font-size:0.90rem;">No campaigns yet.</div>`
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
            ${camps.map(c=>{const archived=c.status==='archived'; return `
              <div style="background:${_C.surface};border:1px solid ${archived?_C.border:_C.borderB};border-radius:10px;padding:16px;opacity:${archived?'0.5':'1'};">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                  <span style="font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;padding:2px 8px;border-radius:4px;
                    background:${archived?'rgba(100,116,139,0.1)':'rgba(16,185,129,0.1)'};border:1px solid ${archived?_C.dim:_C.green}44;color:${archived?_C.dim:_C.green};">${archived?'Archived':'Active'}</span>
                  ${!archived?`<button onclick="_saPlatArchiveCamp('${_saEsc(c.id)}')" style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.dim};transition:all 0.15s;" onmouseover="this.style.borderColor='${_C.red}';this.style.color='${_C.red}'" onmouseout="this.style.borderColor='${_C.border}';this.style.color='${_C.dim}'">Archive</button>`:''}
                </div>
                <div style="font-size:1.02rem;color:${_C.text};margin-bottom:5px;">${_saEsc(c.name||'Unnamed')}</div>
                <div style="font-size:0.78rem;color:${_C.dim};">${c.start_date||'—'} → ${c.end_date||'—'}</div>
                ${c.created_at?`<div style="font-size:0.72rem;color:${_C.dim};margin-top:4px;">Created ${new Date(c.created_at).toLocaleDateString()}</div>`:''}
              </div>`;}).join('')}
          </div>`}`;
  } catch(e) { container.innerHTML = `<div style="color:${_C.red};font-size:0.96rem;">Error: ${_saEsc(e.message)}</div>`; }
}

async function _saPlatCreateCampaign() {
  const name  = (document.getElementById('sa-plat-camp-name')?.value||'').trim();
  const start = document.getElementById('sa-plat-camp-start')?.value||'';
  const end   = document.getElementById('sa-plat-camp-end')?.value||'';
  const st    = document.getElementById('sa-plat-camp-st');
  if (!name) { if(st){st.textContent='Campaign name required.';st.style.color=_C.red;} return; }
  if (st) { st.textContent='Creating…'; st.style.color=_C.muted; }
  try {
    await database.ref('campaigns').push({ name, start_date:start, end_date:end, status:'active', created_at:Date.now() });
    if(st){st.textContent='✓ Campaign created.';st.style.color=_C.green;}
    setTimeout(()=>_saPlatCampaigns(document.getElementById('sa-plat-body')), 800);
  } catch(e) { if(st){st.textContent='Error: '+e.message;st.style.color=_C.red;} }
}

async function _saPlatArchiveCamp(id) {
  if (!confirm('Archive this campaign?')) return;
  try { await database.ref('campaigns/'+id+'/status').set('archived'); showToast('Archived.',2000); _saPlatCampaigns(document.getElementById('sa-plat-body')); }
  catch(e) { showToast('Error: '+e.message,3000); }
}

// ── API Keys ──────────────────────────────────────────────────────────────────

async function _saPlatApiKeys(container) {
  try {
    const snap = await database.ref('api_keys').once('value');
    const raw = snap.val() || {};
    const entries = Object.entries(raw).map(([id,k])=>({id,...k})).sort((a,b)=>(b.created_at||0)-(a.created_at||0));
    container.innerHTML = `
      <div style="margin-bottom:18px;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:300;color:${_C.text};margin-bottom:4px;">Developer Keys</div>
        <div style="font-size:0.84rem;color:${_C.muted};">Raw API tokens for developers and technical integrators building with or embedding ATLAS. No org profile required.</div>
      </div>
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px;margin-bottom:20px;">
        <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:12px;">Issue Developer Key</div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:10px;align-items:end;">
          <div>
            <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Client Name</label>
            <input id="sa-plat-api-client" type="text" placeholder="e.g. Research Partner A" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;"/>
          </div>
          <div>
            <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Tier</label>
            <select id="sa-plat-api-tier" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;">
              <option value="standard">Standard</option><option value="research">Research</option><option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Rate/day</label>
            <input id="sa-plat-api-rate" type="number" value="1000" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;"/>
          </div>
          <div>
            <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Expires</label>
            <input id="sa-plat-api-exp" type="date" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;"/>
          </div>
          <button onclick="_saPlatIssueKey()"
            style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;padding:8px 16px;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};white-space:nowrap;transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">Issue Key</button>
        </div>
        <div id="sa-plat-api-st" style="font-size:0.84rem;color:${_C.muted};margin-top:8px;min-height:16px;"></div>
      </div>
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
          <thead><tr style="border-bottom:1px solid ${_C.borderB};">
            ${['Key (masked)','Client','Tier','Rate/day','Calls Today','Expires','Status',''].map(h=>`<th style="text-align:left;padding:8px 10px;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};font-weight:400;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${!entries.length?`<tr><td colspan="8" style="padding:24px;text-align:center;color:${_C.dim};font-size:0.90rem;">No API keys issued.</td></tr>`
            :entries.map(k=>`
              <tr style="border-bottom:1px solid ${_C.border};transition:background 0.12s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
                <td style="padding:9px 10px;font-size:0.82rem;color:${_C.amber};">${_saEsc(k.id.slice(0,18))}…</td>
                <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};">${_saEsc(k.client||'—')}</td>
                <td style="padding:9px 10px;font-size:0.82rem;color:${_C.muted};">${_saEsc(k.tier||'standard')}</td>
                <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};text-align:right;">${k.rate_limit||'—'}</td>
                <td style="padding:9px 10px;font-size:0.88rem;color:${_C.text};text-align:right;">${k.calls_today||0}</td>
                <td style="padding:9px 10px;font-size:0.82rem;color:${_C.muted};">${k.expiry?new Date(k.expiry).toLocaleDateString():'—'}</td>
                <td style="padding:9px 10px;"><span style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:${k.active?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'};border:1px solid ${k.active?_C.green:_C.red}44;color:${k.active?_C.green:_C.red};">${k.active?'Active':'Revoked'}</span></td>
                <td style="padding:9px 10px;">${k.active?`<button onclick="accRevokeApiKey('${_saEsc(k.id)}')" style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;border-radius:4px;cursor:pointer;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:${_C.red};transition:all 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">Revoke</button>`:''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { container.innerHTML = `<div style="color:${_C.red};font-size:0.96rem;">Error: ${_saEsc(e.message)}</div>`; }
}

async function _saPlatIssueKey() {
  const client = (document.getElementById('sa-plat-api-client')?.value||'').trim();
  const tier   = document.getElementById('sa-plat-api-tier')?.value||'standard';
  const rate   = parseInt(document.getElementById('sa-plat-api-rate')?.value||'1000');
  const expiry = document.getElementById('sa-plat-api-exp')?.value||'';
  const st     = document.getElementById('sa-plat-api-st');
  if (!client) { if(st){st.textContent='Client name required.';st.style.color=_C.red;} return; }
  if (st) { st.textContent='Issuing…'; st.style.color=_C.muted; }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const key = 'atlas_' + Array.from({length:32},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  try {
    await database.ref('api_keys/'+key).set({ client, tier, rate_limit:rate, expiry, active:true, calls_today:0, created_at:Date.now() });
    navigator.clipboard?.writeText(key).then(()=>showToast('API key copied to clipboard.',3000));
    if(st){st.textContent='✓ Key issued and copied to clipboard.';st.style.color=_C.green;}
    setTimeout(()=>_saPlatApiKeys(document.getElementById('sa-plat-body')),800);
  } catch(e) { if(st){st.textContent='Error: '+e.message;st.style.color=_C.red;} }
}

// ── Letters of Permission ─────────────────────────────────────────────────────

async function _saPlatLetters(container) {
  const inp = (label, id, type, ph, required) =>
    `<div style="margin-bottom:10px;">
      <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${label}${required?' <span style="color:'+_C.red+';">*</span>':''}</label>
      <input id="${id}" type="${type}" placeholder="${ph}"
        style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;"
        onfocus="this.style.borderColor='${_C.amber}'" onblur="this.style.borderColor='${_C.border}'"/>
    </div>`;
  const sel = (label, id, opts) =>
    `<div style="margin-bottom:10px;">
      <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${label}</label>
      <select id="${id}" style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;">
        ${opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
      </select>
    </div>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:380px 1fr;gap:24px;align-items:start;">

      <!-- Issue form -->
      <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
        <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:16px;">Issue New Letter of Permission</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;">
          <div>${inp('Recipient Name','sa-lop-name','text','Full name',true)}</div>
          <div>${inp('Email','sa-lop-email','email','recipient@…',true)}</div>
        </div>
        ${inp('Institution / University','sa-lop-institution','text','Institution name',true)}
        ${inp('Study Title','sa-lop-study','text','Study or project title',true)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;">
          <div>${sel('Role','sa-lop-role',[['student','Student'],['researcher','Researcher'],['pi','Principal Investigator'],['clinician','Clinician']])}</div>
          <div>${sel('Intended Use','sa-lop-use',[['research','Research'],['clinical','Clinical'],['education','Education']])}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;">
          <div>${inp('Workspace Key (optional)','sa-lop-wskey','text','e.g. MMAS-XXXX',false)}</div>
          <div>${inp('Expiry Date (optional)','sa-lop-expiry','date','',false)}</div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Notes (optional)</label>
          <textarea id="sa-lop-notes" rows="2" placeholder="Internal notes…"
            style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:7px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.86rem;outline:none;resize:vertical;"
            onfocus="this.style.borderColor='${_C.amber}'" onblur="this.style.borderColor='${_C.border}'"></textarea>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:6px;">Instrument</label>
          <div style="display:flex;gap:14px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem;color:${_C.text};"><input type="radio" name="sa-lop-tool" value="MMAS-8" checked style="accent-color:${_C.amber};"> MMAS-8</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem;color:${_C.text};"><input type="radio" name="sa-lop-tool" value="MAP" style="accent-color:${_C.amber};"> MAP</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem;color:${_C.text};"><input type="radio" name="sa-lop-tool" value="MMAS-8+MAP" style="accent-color:${_C.amber};"> Both</label>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <button onclick="_saSuperIssueLOP()" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};border-radius:6px;padding:8px 18px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(212,168,67,0.20)'" onmouseout="this.style.background='${_C.amberFaint}'">Issue Letter →</button>
          <span id="sa-lop-status" style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_C.dim};"></span>
        </div>
        <div id="sa-lop-result" style="display:none;margin-top:12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px 14px;">
          <div style="font-size:0.66rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.green};margin-bottom:4px;">Letter Issued</div>
          <div id="sa-lop-result-cert" style="font-family:'IBM Plex Mono',monospace;font-size:0.92rem;color:${_C.amber};margin-bottom:4px;"></div>
          <div id="sa-lop-result-detail" style="font-size:0.80rem;color:${_C.muted};line-height:1.6;"></div>
        </div>
      </div>

      <!-- Issued letters list -->
      <div id="sa-lop-list" style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
        <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:16px;">Issued Letters</div>
        <div style="color:${_C.dim};font-size:0.88rem;">Loading…</div>
      </div>

    </div>`;

  _saPlatLettersRefresh(document.getElementById('sa-lop-list'));
}

async function _saPlatLettersRefresh(listEl) {
  if (!listEl) return;
  try {
    const token = await _accGetToken();
    const res   = await fetch(LAMBDA_URL + '/admin/list-lops', {
      method:'POST', mode:'cors',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({})
    });
    const data = await res.json();
    const all  = data.lops || [];
    const lmic = all.filter(l => l.key_type === 'admin_lop');
    const std  = all.filter(l => l.key_type !== 'admin_lop');

    const tbl = (lops, title) => {
      if (!lops.length) return `<div style="color:${_C.dim};font-size:0.84rem;padding:6px 0;margin-bottom:16px;">${title}: none on file.</div>`;
      return `
        <div style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.amberDim};margin-bottom:8px;margin-top:4px;">${title} · ${lops.length}</div>
        <div style="overflow:auto;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;">
            <thead><tr style="border-bottom:1px solid ${_C.borderB};">
              ${['Cert #','Name','Institution','Issued','Status',''].map(h=>`<th style="text-align:left;padding:7px 8px;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};font-weight:400;">${h}</th>`).join('')}
            </tr></thead>
            <tbody>${lops.map(l=>`
              <tr style="border-bottom:1px solid ${_C.border};transition:background 0.12s;" onmouseover="this.style.background='${_C.navy}'" onmouseout="this.style.background='transparent'">
                <td style="padding:8px;font-size:0.80rem;color:${_C.amber};" title="${_saEsc(l.certNum||'')}">${_saEsc((l.certNum||'—').slice(0,18))}…</td>
                <td style="padding:8px;font-size:0.84rem;color:${_C.text};">${_saEsc(l.name||'—')}</td>
                <td style="padding:8px;font-size:0.80rem;color:${_C.muted};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_saEsc(l.institution||'')}">${_saEsc(l.institution||'—')}</td>
                <td style="padding:8px;font-size:0.78rem;color:${_C.muted};">${l.issued_at?new Date(l.issued_at).toLocaleDateString():'—'}</td>
                <td style="padding:8px;"><span style="font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:${l.status==='active'?'rgba(16,185,129,0.1)':'rgba(100,116,139,0.1)'};border:1px solid ${l.status==='active'?_C.green:_C.dim}44;color:${l.status==='active'?_C.green:_C.dim};">${_saEsc(l.status||'—')}</span></td>
                <td style="padding:8px;white-space:nowrap;">
                  <button onclick="accReprintLOP('${_saEsc(l.certNum||'')}')" style="font-size:0.64rem;letter-spacing:0.08em;text-transform:uppercase;padding:2px 7px;border-radius:4px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;margin-right:4px;" onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">Reprint</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    };
    listEl.innerHTML = `<div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:16px;">Issued Letters</div>`
      + tbl(lmic, 'LMIC / Admin Letters')
      + tbl(std, 'Standard Letters');
  } catch(e) { listEl.innerHTML = `<div style="color:${_C.red};font-size:0.90rem;">Error loading letters: ${_saEsc(e.message)}</div>`; }
}

async function _saSuperIssueLOP() {
  const name        = document.getElementById('sa-lop-name')?.value.trim();
  const email       = document.getElementById('sa-lop-email')?.value.trim();
  const institution = document.getElementById('sa-lop-institution')?.value.trim();
  const study       = document.getElementById('sa-lop-study')?.value.trim();
  const role        = document.getElementById('sa-lop-role')?.value;
  const intended    = document.getElementById('sa-lop-use')?.value;
  const expiry      = document.getElementById('sa-lop-expiry')?.value || null;
  const wskey       = document.getElementById('sa-lop-wskey')?.value.trim() || null;
  const notes       = document.getElementById('sa-lop-notes')?.value.trim() || null;
  const tool        = document.querySelector('input[name="sa-lop-tool"]:checked')?.value || 'MMAS-8';
  const status      = document.getElementById('sa-lop-status');
  const result      = document.getElementById('sa-lop-result');

  if (!name || !email || !institution || !study) {
    if (status) { status.style.color = _C.red; status.textContent = 'Name, email, institution and study are required.'; }
    return;
  }
  if (status) { status.style.color = _C.muted; status.textContent = 'Issuing…'; }
  if (result) result.style.display = 'none';

  try {
    const token = await _accGetToken();
    const res = await fetch(LAMBDA_URL + '/admin/issue-lop', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name, email, institution, study_title: study, role,
        intended_use: intended, expiry, workspace_key: wskey, lmic_notes: notes, tool })
    });
    const data = await res.json();
    if (data.certNum) {
      if (status) { status.style.color = _C.green; status.textContent = 'Letter issued successfully.'; }
      const certEl   = document.getElementById('sa-lop-result-cert');
      const detailEl = document.getElementById('sa-lop-result-detail');
      if (certEl)   certEl.textContent  = data.certNum;
      if (detailEl) detailEl.innerHTML  = `${_saEsc(data.name)} · ${_saEsc(data.institution)}<br/>Email sent: ${data.email_sent ? 'Yes' : 'No (check SES logs)'}<br/>Verify: <a href="${_saEsc(data.verify_url||'')}" target="_blank" style="color:${_C.amber};">${_saEsc(data.verify_url||'')}</a>`;
      if (result) result.style.display = 'block';
      ['sa-lop-name','sa-lop-email','sa-lop-institution','sa-lop-study','sa-lop-wskey','sa-lop-notes','sa-lop-expiry'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      setTimeout(() => _saPlatLettersRefresh(document.getElementById('sa-lop-list')), 700);
    } else {
      if (status) { status.style.color = _C.red; status.textContent = 'Error: ' + (data.error || 'Unknown error'); }
    }
  } catch(e) {
    if (status) { status.style.color = _C.red; status.textContent = 'Error: ' + e.message; }
  }
}

// ── Site Banner ───────────────────────────────────────────────────────────────

function _saPlatBanner(container) {
  database.ref('site_banner').once('value', snap => {
    const d = snap.val() || {};
    const inp = (l,id,t,val,ph) => `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">${l}</label>
      <input id="${id}" type="${t}" value="${_saEsc(String(val||''))}" placeholder="${ph}" oninput="_saPlatBannerPreview()"
        style="width:100%;box-sizing:border-box;background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:8px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;"/>
    </div>`;
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start;">
        <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:20px;">
          <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:16px;">Site Banner Configuration</div>
          <div style="display:flex;gap:20px;margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.90rem;color:${_C.text};"><input type="radio" id="sa-ban-on" name="sa-ban-active" ${d.active?'checked':''} style="accent-color:${_C.amber};"> Active</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.90rem;color:${_C.text};"><input type="radio" id="sa-ban-off" name="sa-ban-active" ${!d.active?'checked':''} style="accent-color:${_C.amber};"> Inactive</label>
          </div>
          ${inp('Tag / Eyebrow','sa-ban-tag','text',d.tag,'e.g. SYSTEM NOTICE')}
          ${inp('Message','sa-ban-msg','text',d.message,'Main banner message…')}
          ${inp('CTA Button Text','sa-ban-cta','text',d.cta_text,'e.g. Learn More')}
          ${inp('CTA URL','sa-ban-url','text',d.cta_url,'https://…')}
          ${inp('Expires','sa-ban-exp','date',d.expires,'')}
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:${_C.dim};margin-bottom:4px;">Theme</label>
            <select id="sa-ban-theme" onchange="_saPlatBannerPreview()" style="background:${_C.bg2};border:1px solid ${_C.border};border-radius:6px;padding:8px 10px;color:${_C.text};font-family:'IBM Plex Mono',monospace;font-size:0.92rem;outline:none;">
              ${['red','amber','blue','green'].map(t=>`<option value="${t}" ${d.theme===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;gap:10px;">
            <button onclick="_saPlatSaveBanner()" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:8px 18px;border-radius:6px;cursor:pointer;background:${_C.amberFaint};border:1px solid ${_C.amberDim};color:${_C.amber};transition:all 0.15s;" onmouseover="this.style.background='rgba(212,168,67,0.18)'" onmouseout="this.style.background='${_C.amberFaint}'">Publish</button>
            <button onclick="_saPlatClearBanner()" style="font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;padding:8px 18px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid ${_C.border};color:${_C.muted};transition:all 0.15s;" onmouseover="this.style.borderColor='${_C.red}';this.style.color='${_C.red}'" onmouseout="this.style.borderColor='${_C.border}';this.style.color='${_C.muted}'">Clear</button>
          </div>
          <div id="sa-ban-st" style="font-size:0.84rem;color:${_C.muted};margin-top:10px;min-height:16px;"></div>
        </div>
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${_C.dim};margin-bottom:10px;">Preview</div>
          <div id="sa-ban-prev" style="border-radius:8px;padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);">
            <div id="sa-ban-prev-tag" style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.red};margin-bottom:4px;">${_saEsc(d.tag||'')}</div>
            <div id="sa-ban-prev-msg" style="font-size:0.96rem;color:${_C.text};">${_saEsc(d.message||'No message set')}</div>
          </div>
          <div style="margin-top:12px;font-size:0.78rem;color:${_C.dim};">Status: <span style="color:${d.active?_C.green:_C.muted};">${d.active?'LIVE':'Inactive'}</span></div>
          ${d.updated?`<div style="font-size:0.76rem;color:${_C.dim};margin-top:3px;">Last saved: ${new Date(d.updated).toLocaleString()}</div>`:''}
        </div>
      </div>`;
  });
}

function _saPlatBannerPreview() {
  const tag = document.getElementById('sa-ban-tag')?.value||'';
  const msg = document.getElementById('sa-ban-msg')?.value||'';
  const t   = document.getElementById('sa-ban-prev-tag');
  const m   = document.getElementById('sa-ban-prev-msg');
  if (t) t.textContent = tag;
  if (m) m.textContent = msg || 'No message set';
}

async function _saPlatSaveBanner() {
  const active = document.getElementById('sa-ban-on')?.checked;
  const tag    = document.getElementById('sa-ban-tag')?.value.trim()||'';
  const message= document.getElementById('sa-ban-msg')?.value.trim()||'';
  const cta_text=document.getElementById('sa-ban-cta')?.value.trim()||'';
  const cta_url =document.getElementById('sa-ban-url')?.value.trim()||'';
  const expires =document.getElementById('sa-ban-exp')?.value||'';
  const theme   =document.getElementById('sa-ban-theme')?.value||'red';
  const st      =document.getElementById('sa-ban-st');
  if (active && !message) { if(st){st.textContent='Add a message first.';st.style.color=_C.red;} return; }
  const payload = { active:!!active, tag, message, cta_text, cta_url, expires, theme, key:'banner-'+Date.now(), updated:Date.now() };
  try {
    await database.ref('site_banner').set(payload);
    if (typeof _applyBannerData === 'function') _applyBannerData(payload);
    if(st){st.textContent=active?'✓ Banner is now live.':'✓ Saved as inactive.';st.style.color=_C.green;}
    setTimeout(()=>{if(st)st.textContent='';},3000);
  } catch(e) { if(st){st.textContent='Error: '+e.message;st.style.color=_C.red;} }
}

async function _saPlatClearBanner() {
  if (!confirm('Clear the banner? It will disappear from all sites immediately.')) return;
  try {
    await database.ref('site_banner').set({ active:false, key:'cleared-'+Date.now() });
    if (typeof _applyBannerData === 'function') _applyBannerData({ active:false });
    showToast('Banner cleared.',2000);
    _saPlatBanner(document.getElementById('sa-plat-body'));
  } catch(e) { showToast('Error: '+e.message,3000); }
}

// ── Module Paths — plug-and-play module assignment matrix ─────────────────────

// ── Feature Module Catalog ────────────────────────────────────────────────────
// Every user-facing capability as a named building block.
// id       → Firebase key + hasModule(id) identifier
// premium  → requires add-on entitlement flag in workspace record
// Firebase path for module visibility config: platform_config/module_paths
// Schema: { [pathId]: { [moduleId]: true|false } }
// Superadmin-only — end users cannot modify this.

const _ATLAS_FEATURE_CATALOG = {
  assessment: [
    { id:'assess_mmas',  icon:'⬡', label:'MMAS-8 Assessment',        desc:'8-question medication adherence questionnaire + scoring',        premium:false },
    { id:'assess_map',   icon:'◈', label:'MAP Tri-Domain Assessment', desc:'Multi-domain adherence PE scoring — primary instrument',         premium:false },
    { id:'assess_peacs', icon:'◉', label:'PEACS Assessment',          desc:'Predictive Emergence adherence composite scoring',               premium:false },
    { id:'assess_zoe',   icon:'◭', label:'ZOE Voice Assessment',      desc:'AI-guided voice walk-through of the MMAS-8',                    premium:false },
    { id:'assess_bulk',  icon:'◫', label:'Bulk Import / Upload',      desc:'Excel/CSV batch import of historical patient records',           premium:false },
  ],
  analytics: [
    { id:'analytics_mmas',          icon:'◈', label:'MMAS-8 Analytics',        desc:'Score distribution, trends, cohort overview',              premium:false },
    { id:'analytics_map',           icon:'◉', label:'MAP Analytics',            desc:'PE score trends, domain breakdown, APE phenotyping',       premium:false },
    { id:'analytics_peacs',         icon:'◎', label:'PEACS Analytics',          desc:'PE composite trends, dimension tracker, subscale analysis', premium:false },
    { id:'analytics_sdoh',          icon:'◧', label:'SDoH Analysis',            desc:'Social determinants of health panels (5 domains)',         premium:false },
    { id:'analytics_psychometrics', icon:'◈', label:'Psychometrics Suite',      desc:"Cronbach's α, McDonald's ω, SEM, ICC test-retest",        premium:false },
    { id:'analytics_validity',     icon:'◇', label:'Validity Suite',           desc:'Content CVI · criterion concurrent r · construct AVE / HTMT — all instruments', premium:false },
    { id:'analytics_extcomp', icon:'◇', label:'Method Comparator', desc:'Validate wearables, apps & devices against MMAS-8 — Bland-Altman, ROC/AUC, concurrent r, PPV', premium:false },
    { id:'analytics_subgroup',      icon:'◩', label:'Subgroup Analysis',        desc:'Demographic subgroup breakdowns and comparisons',          premium:false },
    { id:'analytics_publication',   icon:'◪', label:'Publication Statistics',   desc:'APA-formatted stats tables for manuscript submission',     premium:false },
    { id:'analytics_power',         icon:'◌', label:'Sample Size Advisor',      desc:'Statistical power analysis — Cronbach α CI target N calculator', premium:false },
    { id:'analytics_geospatial',    icon:'⬡', label:'Cohort Geospatial Map',    desc:'Personal cohort geographic distribution — Mapbox heatmap', premium:false },
  ],
  clinical: [
    { id:'clinical_overview',    icon:'◫', label:'Clinical Overview',      desc:'Patient worklist, KPIs, care gap summary, CPO panel',       premium:false },
    { id:'clinical_care_gaps',   icon:'◬', label:'Care Gap Monitor',       desc:'Automated low-adherence patient flagging and triage',       premium:false },
    { id:'clinical_billing',     icon:'◧', label:'Clinical Billing',       desc:'MTM / CCM / RTM / TCM billing codes, timers, audit trail',  premium:false },
    { id:'clinical_sentinel',    icon:'◭', label:'Sentinel Alerts',        desc:'Real-time critical adherence event alerts and triage',      premium:false },
    { id:'clinical_campaigns',   icon:'◉', label:'Campaign Manager',       desc:'Adherence outreach campaign creation and tracking',         premium:false },
    { id:'clinical_clinic_mode', icon:'◪', label:'Clinic Mode',            desc:'Patient flow protection — hides researcher controls',       premium:false },
  ],
  research: [
    { id:'research_pi_panel',    icon:'◉', label:'PI Research Panel',        desc:'Enrollment targets, CONSORT flow, participant tracking',   premium:false },
    { id:'research_grants',      icon:'◈', label:'Grant Reporting (RPPR)',   desc:'NIH/CDC/HRSA grant narrative auto-generation from data',   premium:false },
    { id:'research_thesis',      icon:'◫', label:'Student Thesis Module',    desc:'MPH/PhD milestones, sign-off, supervisor tracking',        premium:false },
    { id:'research_cross_study', icon:'◩', label:'Cross-Study Research Hub', desc:'Institution-wide multi-PI study aggregation view',         premium:false },
    { id:'research_amendments',  icon:'◪', label:'Protocol Amendment Log',  desc:'IRB amendment tracking — immutable audit trail',           premium:false },
    { id:'research_ivm',         icon:'◎', label:'AI Intervention Matching', desc:'Claude AI evidence-based adherence interventions',         premium:false },
  ],
  compliance: [
    { id:'export_csv',      icon:'↓', label:'Data Export (CSV)',         desc:'Blinded MMAS / MAP / PEACS cohort CSV export',             premium:false },
    { id:'export_irb',      icon:'◫', label:'IRB Protocol Template',    desc:'Boilerplate IRB submission template download',             premium:false },
    { id:'export_citation', icon:'◈', label:'Instrument Citation Tool', desc:'APA/Vancouver citations for MMAS-8, MAP, PEACS',           premium:false },
  ],
  premium: [
    { id:'premium_nlq',        icon:'◍', label:'AI Natural Language Query', desc:'Claude-powered plain-language data interrogation across all instruments', premium:true },
    { id:'premium_ehr',        icon:'◫', label:'EHR / FHIR Integration',    desc:'HL7 FHIR R4 bidirectional connector — Epic, Cerner, Allscripts',         premium:true },
    { id:'premium_outreach',   icon:'◉', label:'Automated Patient Outreach', desc:'SMS/email adherence alerts triggered by low scores — Twilio powered',    premium:true },
    { id:'premium_whitelabel', icon:'◈', label:'White-Label Reporting',      desc:'Institution-branded PDF reports with custom logo, colors, letterhead',   premium:true },
    { id:'premium_api',        icon:'◬', label:'External API Access',        desc:'Versioned REST endpoints for institutional data pipelines and integrations', premium:true },
  ],
};

// ── Default module bundles per path ──────────────────────────────────────────
// Empty _saModPathConfig means "use these defaults". Overrides are stored in
// Firebase at platform_config/module_paths and delta-patched onto these lists.
const _ATLAS_DEFAULT_PATHS = {
  observer:    ['analytics_mmas'],

  student:     ['assess_mmas','assess_map','assess_peacs',
                'analytics_mmas','analytics_psychometrics','analytics_peacs',
                'analytics_power','analytics_geospatial',
                'research_thesis','research_exchange','export_citation','export_irb','export_csv'],

  clinician:   ['assess_mmas','assess_map','assess_peacs','assess_zoe',
                'analytics_sdoh','analytics_mmas',
                'clinical_overview','clinical_care_gaps','clinical_billing','clinical_clinic_mode','clinical_sentinel',
                'export_irb','export_csv','research_ivm','research_exchange'],

  // independent workspaces inherit researcher defaults — no separate entry needed.
  // hasModule() in auth-roles.js aliases independent → researcher at runtime.

  researcher:  ['assess_mmas','assess_map','assess_peacs','assess_bulk',
                'analytics_mmas','analytics_map','analytics_peacs',
                'analytics_psychometrics','analytics_validity','analytics_extcomp','analytics_subgroup','analytics_publication',
                'analytics_power','analytics_geospatial',
                'clinical_sentinel','export_csv','export_citation','export_irb',
                'research_ivm','research_exchange','research_directory','research_open_data','premium_nlq'],

  pi:          ['assess_mmas','assess_map','assess_peacs','assess_bulk',
                'analytics_mmas','analytics_map','analytics_peacs',
                'analytics_psychometrics','analytics_validity','analytics_extcomp','analytics_subgroup','analytics_publication',
                'analytics_power','analytics_geospatial',
                'clinical_sentinel','clinical_campaigns','export_csv','export_citation','export_irb',
                'research_ivm','research_pi_panel','research_grants','research_amendments',
                'research_exchange','research_directory','research_open_data','research_tessera',
                'premium_nlq'],

  institution: ['analytics_mmas','analytics_map','analytics_peacs',
                'analytics_sdoh','analytics_psychometrics','analytics_validity','analytics_geospatial',
                'research_cross_study','research_grants',
                'clinical_sentinel','clinical_billing',
                'assess_bulk','export_csv','export_irb',
                'research_exchange','research_directory','research_open_data','research_inst_mgmt'],
};

// ── User paths (roles eligible for module assignment) ─────────────────────────
// Independent is not listed — it is a structural designation (no parent PI/institution)
// that uses researcher's module defaults. hasModule() aliases independent → researcher.
const _SA_USER_PATHS = [
  { id:'observer',     label:'Observer',     icon:'◭', desc:'Read-only — no data submission'                           },
  { id:'student',      label:'Student',      icon:'◬', desc:'Students and trainees enrolled in programs'               },
  { id:'clinician',    label:'Clinician',    icon:'◫', desc:'Clinical practitioners and care teams (PharmD · NP · PA · RN · MD · Care Coordinator)' },
  { id:'researcher',   label:'Researcher',   icon:'◈', desc:'Research staff — also applies to independent (no-PI) workspaces' },
  { id:'pi',           label:'PI',           icon:'◉', desc:'Principal Investigators — institution-scoped view'        },
  { id:'institution',  label:'Institution',  icon:'◪', desc:'Institution-level admin and oversight view'               },
];

let _saModPathConfig = null; // loaded from Firebase on render

async function _saPlatModulePaths(body) {
  // If already loaded (e.g. user navigated away and back), keep in-memory state
  // so unsaved toggles are not wiped by a Firebase reload.
  if (_saModPathConfig !== null) {
    _saPlatModulePathsRender(body);
    return;
  }

  body.innerHTML = `<div style="color:${_C.muted};font-size:0.88rem;">Loading module configuration…</div>`;

  // Load current config from Firebase on first entry only
  try {
    const db = window.firebase?.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
    if (db) {
      const snap = await db.ref('platform_config/module_paths').once('value');
      _saModPathConfig = snap.val() || {};
    } else {
      _saModPathConfig = {};
    }
  } catch(e) {
    _saModPathConfig = {};
  }

  _saPlatModulePathsRender(body);
}

// ── Display groups for block-banner catalog UI ────────────────────────────────
// Each block = one banner card. Multi-id blocks toggle all constituent modules
// together (e.g. Assessment Instruments = mmas + map + peacs as one banner).
const _SA_MOD_DISPLAY_GROUPS = [
  {
    cat:'assessment', catLabel:'Assessment', catColor: null, // uses _C.blue at render time
    blocks: [
      { ids:['assess_mmas','assess_map','assess_peacs'], icon:'◈',
        label:'Assessment Instruments', sub:'MMAS-8 · MAP Tri-Domain · PEACS',
        desc:'Core adherence instruments — all three bundled as a set' },
      { ids:['assess_zoe'], icon:'◭',
        label:'ZOE Voice', sub:'AI-Guided Voice Assessment',
        desc:'Conversational AI walk-through of MAP and MMAS-8 in 60+ languages' },
      { ids:['assess_bulk'], icon:'◫',
        label:'Bulk Import · Upload', sub:'Excel · CSV Batch',
        desc:'Import historical patient records from Excel or CSV files' },
    ],
  },
  {
    cat:'analytics', catLabel:'Analytics', catColor: null,
    blocks: [
      { ids:['analytics_mmas'],          icon:'◈', label:'MMAS-8 Analytics',      sub:'Score Distribution · Trends',      desc:'Score distribution, trends, cohort overview' },
      { ids:['analytics_map'],           icon:'◉', label:'MAP Analytics',          sub:'PE Domain · APE Phenotyping',      desc:'PE score trends, domain breakdown, APE phenotyping' },
      { ids:['analytics_peacs'],         icon:'◎', label:'PEACS Analytics',        sub:'PE Composite · Dimension Tracker', desc:'PE composite trends, subscale analysis' },
      { ids:['analytics_sdoh'],          icon:'◧', label:'SDoH Analysis',          sub:'Social Risk · 5 Domains',         desc:'Social determinants of health panels' },
      { ids:['analytics_psychometrics'], icon:'◈', label:'Psychometrics Suite',    sub:'Cronbach α · ICC · SEM',          desc:"Cronbach's α, McDonald's ω, SEM, ICC test-retest" },
      { ids:['analytics_validity'],     icon:'◇', label:'Validity Suite',         sub:'CVI · Concurrent r · AVE · HTMT', desc:'Content, criterion & construct validity across all instruments' },
      { ids:['analytics_extcomp'],      icon:'◇', label:'Method Comparator',       sub:'Bland-Altman · ROC · AUC',        desc:'Validate wearables, apps and devices against MAP/MMAS-8' },
      { ids:['analytics_subgroup'],      icon:'◩', label:'Subgroup Analysis',      sub:'Demographic Breakdowns',          desc:'Subgroup breakdowns and comparisons' },
      { ids:['analytics_publication'],   icon:'◪', label:'Publication Statistics', sub:'APA Tables · Manuscript',         desc:'APA-formatted stats tables for manuscript submission' },
      { ids:['analytics_power'],         icon:'◌', label:'Sample Size Advisor',    sub:'Statistical Power · Target N',    desc:'Statistical power analysis and Cronbach α CI' },
      { ids:['analytics_geospatial'],    icon:'⬡', label:'Geospatial Map',         sub:'Cohort Geography · Heatmap',      desc:'Geographic cohort distribution — Mapbox heatmap' },
    ],
  },
  {
    cat:'clinical', catLabel:'Clinical Tools', catColor: null,
    blocks: [
      { ids:['clinical_overview'],    icon:'◫', label:'Clinical Overview',   sub:'Patient Worklist · KPIs · Session',   desc:'Patient worklist, KPIs, care gap summary, CPO panel, session result viewer' },
      { ids:['clinical_care_gaps'],   icon:'◬', label:'Care Gap Monitor',    sub:'Low-Adherence Flagging',              desc:'Automated low-adherence patient flagging and triage' },
      { ids:['clinical_billing'],     icon:'◧', label:'Clinical Billing',    sub:'MTM · CCM · RTM · TCM',               desc:'Billing codes, timers, audit trail' },
      { ids:['clinical_sentinel'],    icon:'◭', label:'Sentinel Alerts',     sub:'Real-Time Critical Alerts',           desc:'Critical adherence event alerts and triage' },
      { ids:['clinical_campaigns'],   icon:'◉', label:'Campaign Manager',    sub:'Outreach · Engagement',               desc:'Adherence outreach campaign creation and tracking' },
      { ids:['clinical_clinic_mode'], icon:'◪', label:'Clinic Mode',         sub:'Patient Flow Protection',             desc:'Hides researcher controls during patient encounters' },
    ],
  },
  {
    cat:'research', catLabel:'Research', catColor: null,
    blocks: [
      { ids:['research_pi_panel'],    icon:'◉', label:'PI Research Panel',        sub:'Enrollment · CONSORT',           desc:'Enrollment targets, CONSORT flow, participant tracking' },
      { ids:['research_grants'],      icon:'◈', label:'Grant Reporting (RPPR)',   sub:'NIH · CDC · HRSA',               desc:'Grant narrative auto-generation from live data' },
      { ids:['research_thesis'],      icon:'◫', label:'Student Thesis Module',    sub:'MPH · PhD Milestones',           desc:'Thesis milestones, sign-off, supervisor tracking' },
      { ids:['research_cross_study'], icon:'◩', label:'Cross-Study Hub',          sub:'Multi-PI Aggregation',           desc:'Institution-wide multi-PI study aggregation view' },
      { ids:['research_amendments'],  icon:'◪', label:'Protocol Amendment Log',  sub:'IRB Audit Trail',                desc:'IRB amendment tracking — immutable audit trail' },
      { ids:['research_ivm'],         icon:'◎', label:'AI Intervention Matching',sub:'Evidence-Based Interventions',   desc:'Claude AI evidence-based adherence interventions' },
    ],
  },
  {
    cat:'compliance', catLabel:'Data & Compliance', catColor: null,
    blocks: [
      { ids:['export_csv'],      icon:'↓', label:'Data Export (CSV)',         sub:'Blinded Cohort Export',    desc:'MMAS / MAP / PEACS cohort CSV export' },
      { ids:['export_irb'],      icon:'◫', label:'IRB Protocol Template',    sub:'Submission Template',      desc:'Boilerplate IRB submission template download' },
      { ids:['export_citation'], icon:'◈', label:'Instrument Citation Tool', sub:'APA · Vancouver',          desc:'Citations for MMAS-8, MAP, PEACS' },
    ],
  },
  {
    cat:'community', catLabel:'Community & Network', catColor: null,
    blocks: [
      { ids:['research_exchange'],    icon:'◎', label:'Research Exchange',      sub:'Collaboration Board · Exchange',        desc:'Community board for collaboration requests, positions, grants, and publications' },
      { ids:['research_directory'],   icon:'◉', label:'Researcher Directory',   sub:'Profile Cards · Network',               desc:'Browse verified ATLAS researcher profiles and request collaborations' },
      { ids:['research_open_data'],   icon:'◫', label:'Open Data Portal',       sub:'Dataset Access Requests',               desc:'Browse and request access to ATLAS open anonymized datasets' },
      { ids:['research_tessera'],     icon:'◈', label:'TESSERA GRC Full Suite', sub:'Funding Board · LMIC · Registry',       desc:'Full TESSERA Grant Resource Center access including funding board and LMIC network' },
      { ids:['research_inst_mgmt'],   icon:'◪', label:'Institution Team Admin', sub:'Member Provisioning · Domain Config',   desc:'Self-service institution team management, key provisioning, and domain configuration' },
      { ids:['research_poi'],         icon:'⬡', label:'POI Contributor',        sub:'Crowdsourced SDoH Infrastructure',      desc:'Submit and verify community SDoH infrastructure points of interest on the globe' },
    ],
  },
  {
    cat:'premium', catLabel:'Premium Add-Ons', catColor: null, isPremium: true,
    blocks: [
      { ids:['premium_nlq'],        icon:'◍', label:'AI Natural Language Query', sub:'Claude-Powered Query',       desc:'Plain-language data interrogation across all instruments', premium:true },
      { ids:['premium_ehr'],        icon:'◫', label:'EHR / FHIR Integration',    sub:'HL7 FHIR R4 Connector',      desc:'Bidirectional sync with Epic, Cerner, Allscripts',        premium:true },
      { ids:['premium_outreach'],   icon:'◉', label:'Automated Patient Outreach', sub:'SMS · Email Alerts',        desc:'Low-adherence triggered patient contact — Twilio powered', premium:true },
      { ids:['premium_whitelabel'], icon:'◈', label:'White-Label Reporting',      sub:'Branded PDF Exports',       desc:'Custom logo, colors, letterhead on all generated reports', premium:true },
      { ids:['premium_api'],        icon:'◬', label:'External API Access',        sub:'REST Data Pipeline',        desc:'Versioned endpoints for institutional integrations',        premium:true },
    ],
  },
];

let _saModPathSelected = 'clinician';

function _saPlatModulePathsRender(body) {
  const cfg = _saModPathConfig || {};

  const CAT_COLORS = {
    assessment: _C.blue, analytics: _C.cyan, clinical: _C.green,
    research: _C.purple, compliance: _C.muted, premium: _C.amber,
  };

  function isEnabled(pathId, modId) {
    if (cfg[pathId]?.[modId] !== undefined) return cfg[pathId][modId];
    return (_ATLAS_DEFAULT_PATHS[pathId] || []).includes(modId);
  }

  // Group-level enabled = ALL constituent modules enabled
  function isGroupEnabled(pathId, ids) {
    return ids.every(id => isEnabled(pathId, id));
  }

  const selPath = _saModPathSelected;
  const selPathDef = _SA_USER_PATHS.find(p => p.id === selPath) || _SA_USER_PATHS[0];

  // Count enabled modules for selected path (flat count across all groups)
  const allModIds = _SA_MOD_DISPLAY_GROUPS.flatMap(g => g.blocks.flatMap(b => b.ids));
  const uniqueEnabled = [...new Set(allModIds)].filter(id => isEnabled(selPath, id)).length;

  // Build toggle button HTML (pill-style).
  // Uses data-path + data-ids (single-quoted attribute) to avoid double-quote
  // escaping issues when embedding JSON arrays inside HTML onclick attributes.
  function toggleBtn(pathId, ids, enabled) {
    return `<button
      data-path="${pathId}" data-ids='${JSON.stringify(ids)}'
      onclick="event.stopPropagation();_saModGroupToggleByEl(this)"
      style="width:42px;height:24px;border-radius:12px;cursor:pointer;flex-shrink:0;
             background:${enabled ? _C.green + '33' : _C.border};
             border:1.5px solid ${enabled ? _C.green : _C.borderB};
             transition:all 0.18s;position:relative;"
      title="${enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}">
      <span style="width:14px;height:14px;border-radius:50%;
        background:${enabled ? _C.green : _C.dim};
        position:absolute;top:4px;transition:left 0.18s;
        left:${enabled ? '23px' : '3px'};"></span>
    </button>`;
  }

  // Build block banner HTML for one block.
  // The entire card is clickable — onclick delegates to the toggle button to avoid
  // double-firing when the user clicks the toggle button itself (button click
  // stops propagation so the card onclick doesn't re-fire).
  function blockBanner(pathId, block, catColor, isPremium) {
    const enabled = isGroupEnabled(pathId, block.ids);
    // Use data-path + data-ids (single-quoted) so JSON double quotes don't
    // break the attribute. Card click and toggle button both call
    // _saModGroupToggleByEl(this) — button uses stopPropagation to avoid double-fire.
    return `<div
        data-path="${pathId}" data-ids='${JSON.stringify(block.ids)}'
        onclick="_saModGroupToggleByEl(this)"
        style="
        background:${enabled ? _C.surface : _C.bg};
        border:1px solid ${enabled ? catColor + '44' : _C.border};
        border-radius:10px;padding:14px 16px;
        display:flex;flex-direction:column;gap:8px;
        transition:all 0.18s;position:relative;cursor:pointer;
        opacity:${enabled ? '1' : '0.6'};"
        onmouseover="this.style.borderColor='${enabled ? catColor + '88' : _C.borderB}'"
        onmouseout="this.style.borderColor='${enabled ? catColor + '44' : _C.border}'">
      ${isPremium ? `<div style="position:absolute;top:10px;right:52px;font-size:0.56rem;color:${_C.amber};border:1px solid rgba(212,168,67,0.3);border-radius:3px;padding:0 5px;letter-spacing:0.06em;">PREMIUM</div>` : ''}
      <div style="position:absolute;top:12px;right:14px;">
        ${toggleBtn(pathId, block.ids, enabled)}
      </div>
      <div style="font-size:0.86rem;margin-right:52px;line-height:1.1;">${block.icon}</div>
      <div>
        <div style="font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:${catColor};margin-bottom:3px;font-weight:600;">${block.label}</div>
        <div style="font-size:0.78rem;color:${_C.text};font-weight:500;margin-bottom:4px;">${block.sub}</div>
        <div style="font-size:0.68rem;color:${_C.dim};line-height:1.4;">${block.desc}</div>
      </div>
    </div>`;
  }

  body.innerHTML = `
  <div style="margin-bottom:20px;">
    <div class="sa-section-eyebrow">Module Catalog</div>
    <div class="sa-section-title" style="margin-bottom:6px;">Plug-and-Play Module Assignment</div>
    <div style="font-size:0.82rem;color:${_C.dim};line-height:1.6;margin-bottom:16px;">
      Select a user path then toggle modules on or off. Assessment Instruments (MMAS-8 · MAP · PEACS) are bundled as one block — they always move together. ZOE Voice and Bulk Import are independent.
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
      ${_SA_USER_PATHS.map(p => {
        const on = p.id === selPath;
        return `<button onclick="_saModPathSelectPath('${p.id}')"
          style="font-family:'IBM Plex Mono',monospace;font-size:0.74rem;letter-spacing:0.12em;
          text-transform:uppercase;padding:7px 14px;border-radius:7px;cursor:pointer;
          transition:all 0.18s;
          background:${on ? _C.amberFaint : 'transparent'};
          border:1px solid ${on ? _C.amberDim : _C.border};
          color:${on ? _C.amber : _C.muted};">
          ${p.icon} ${p.label}
        </button>`;
      }).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding:14px 18px;background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;">
      <span style="font-size:1.4rem;">${selPathDef.icon}</span>
      <div style="flex:1;">
        <div style="font-size:0.92rem;font-weight:700;color:${_C.text};margin-bottom:2px;">${selPathDef.label}</div>
        <div style="font-size:0.74rem;color:${_C.dim};">${selPathDef.desc}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.6rem;font-weight:700;color:${_C.amber};line-height:1;">${uniqueEnabled}</div>
        <div style="font-size:0.60rem;letter-spacing:0.12em;text-transform:uppercase;color:${_C.dim};">modules on</div>
      </div>
    </div>
  </div>

  ${_SA_MOD_DISPLAY_GROUPS.map(group => {
    const col = CAT_COLORS[group.cat] || _C.muted;
    return `
    <div style="margin-bottom:28px;">
      <div style="font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;color:${col};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${_C.border};">
        ${group.catLabel}${group.isPremium ? ' <span style="color:' + _C.amberDim + ';">· add-on entitlement required</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
        ${group.blocks.map(b => blockBanner(selPath, b, col, !!b.premium)).join('')}
      </div>
    </div>`;
  }).join('')}

  <div style="margin-top:8px;padding-top:16px;border-top:1px solid ${_C.border};">
    <div style="font-size:0.72rem;color:${_C.dim};margin-bottom:12px;line-height:1.5;">
      Saving writes this configuration to Firebase and makes it the live default for all <strong style="color:${_C.text};">${selPathDef.label}</strong> workspaces.
      Existing sessions pick up changes on next login. Reset to Factory restores the built-in baseline.
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button onclick="_saModPathSave()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:9px 22px;border-radius:6px;cursor:pointer;
               background:${_C.amberFaint};border:1px solid rgba(212,168,67,0.35);color:${_C.amber};">Set as Default</button>
      <button onclick="_saModPathReset()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:9px 22px;border-radius:6px;cursor:pointer;
               background:transparent;border:1px solid ${_C.border};color:${_C.dim};">Reset to Factory</button>
      <button onclick="_saModPathRefresh()"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;
               padding:9px 22px;border-radius:6px;cursor:pointer;
               background:transparent;border:1px solid ${_C.border};color:${_C.dim};">↺ Reload from Firebase</button>
      <span id="sa-modpath-status" style="font-size:0.82rem;color:${_C.dim};margin-left:8px;"></span>
    </div>
  </div>`;
}

function _saModPathSelectPath(pathId) {
  _saModPathSelected = pathId;
  const body = document.getElementById('sa-plat-body');
  if (body) _saPlatModulePathsRender(body);
}

// Called from data-attribute onclick — reads path + ids from element attributes.
function _saModGroupToggleByEl(el) {
  const pathId = el.getAttribute('data-path');
  const ids = JSON.parse(el.getAttribute('data-ids'));
  _saModGroupToggle(pathId, ids);
}

// Toggle a group of module IDs (or single module) for a given path.
// Reads current state as: enabled iff ALL modules in group are enabled.
function _saModGroupToggle(pathId, moduleIds) {
  if (!_saModPathConfig) _saModPathConfig = {};
  if (!_saModPathConfig[pathId]) _saModPathConfig[pathId] = {};
  const defaults = _ATLAS_DEFAULT_PATHS[pathId] || [];
  const cfg = _saModPathConfig;
  const allEnabled = moduleIds.every(id => {
    if (cfg[pathId]?.[id] !== undefined) return cfg[pathId][id];
    return defaults.includes(id);
  });
  const nowEnabled = !allEnabled;
  moduleIds.forEach(id => { _saModPathConfig[pathId][id] = nowEnabled; });
  const body = document.getElementById('sa-plat-body');
  if (body) _saPlatModulePathsRender(body);
}

async function _saModPathSave() {
  const st = document.getElementById('sa-modpath-status');
  if (st) st.textContent = 'Saving…';
  try {
    const db = window.firebase?.database ? window.firebase.database() : (typeof database !== 'undefined' ? database : null);
    if (db && _saModPathConfig) {
      await db.ref('platform_config/module_paths').set(_saModPathConfig);
      // Refresh in-memory module paths so changes take effect without re-login
      if (typeof _loadModulePaths === 'function') await _loadModulePaths();
      if (st) { st.style.color = _C.green; st.textContent = '✓ Set as default — all new ' + (window._saModPathSelected||'') + ' workspaces inherit this config · existing sessions refresh on next login'; setTimeout(()=>{if(st)st.textContent='';},5000); }
    } else {
      if (st) { st.style.color = _C.red; st.textContent = 'Firebase unavailable'; }
    }
  } catch(e) {
    if (st) { st.style.color = _C.red; st.textContent = 'Save failed: ' + e.message; }
  }
}

function _saModPathReset() {
  if (!confirm('Reset all module paths to default role settings? This will overwrite your current configuration.')) return;
  _saModPathConfig = {};
  const body = document.getElementById('sa-plat-body');
  if (body) _saPlatModulePathsRender(body);
  const st = document.getElementById('sa-modpath-status');
  if (st) { st.style.color = _C.amber; st.textContent = 'Reset to factory baseline — click Set as Default to persist.'; }
}

async function _saModPathRefresh() {
  _saModPathConfig = null; // force Firebase reload
  const body = document.getElementById('sa-plat-body');
  if (body) await _saPlatModulePaths(body);
  const st = document.getElementById('sa-modpath-status');
  if (st) { st.style.color = _C.cyan; st.textContent = 'Reloaded from Firebase.'; setTimeout(()=>{if(st)st.textContent='';},3000); }
}

// ── Module Access Requests ────────────────────────────────────────────────────

async function _saPlatRequests(container) {
  container.innerHTML = `<div style="color:${_C.muted};font-size:0.88rem;padding:12px 0;">Loading requests…</div>`;
  try {
    const wsSnap = await database.ref('workspaces').once('value');
    const wsAll = wsSnap.val() || {};
    const pending = [];
    const granted = [];
    const dismissed = [];

    Object.entries(wsAll).forEach(([wsKey, wsData]) => {
      const reqs = wsData.access_requests || {};
      Object.entries(reqs).forEach(([moduleId, req]) => {
        const entry = {
          wsKey,
          wsName: wsData.institution || wsData.name || wsData.cohortLabel || wsKey,
          wsRole: wsData.role || '—',
          userName: wsData.name || req.name || '—',
          moduleId,
          moduleLabel: req.module_label || moduleId,
          requestedAt: req.requested_at || 0,
          status: req.status || 'pending',
          parentPi: req.parent_pi || wsData.parent_pi || '',
          parentInst: req.parent_institution || wsData.parent_institution || '',
        };
        if (entry.status === 'pending') pending.push(entry);
        else if (entry.status === 'granted') granted.push(entry);
        else dismissed.push(entry);
      });
    });

    // Sort pending newest first
    pending.sort((a,b) => b.requestedAt - a.requestedAt);
    granted.sort((a,b) => b.requestedAt - a.requestedAt);
    dismissed.sort((a,b) => b.requestedAt - a.requestedAt);

    const _fmtDate = ts => ts ? new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const _rowStyle = 'display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr 0.7fr auto;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid ' + _C.border + ';font-size:0.80rem;';
    const _hdrStyle = 'display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr 0.7fr auto;gap:10px;padding:7px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:' + _C.muted + ';border-bottom:1px solid ' + _C.border + ';';

    const renderSection = (title, accentColor, rows, actionHtml) => {
      if (!rows.length) return '';
      return `
        <div style="margin-bottom:24px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.70rem;letter-spacing:0.18em;text-transform:uppercase;color:${accentColor};margin-bottom:10px;">${title} (${rows.length})</div>
          <div style="background:${_C.bg2};border:1px solid ${_C.border};border-radius:8px;overflow:hidden;">
            <div style="${_hdrStyle}">
              <span>Workspace</span><span>User / Role</span><span>Module</span><span>Parent PI</span><span>Date</span><span>Actions</span>
            </div>
            ${rows.map(r => `
              <div style="${_rowStyle}">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:${_C.text};">${_saEsc(r.wsKey)}<div style="font-size:0.68rem;color:${_C.muted};">${_saEsc(r.wsName)}</div></div>
                <div style="color:${_C.muted};">${_saEsc(r.userName)}<div style="font-size:0.68rem;opacity:0.7;">${_saEsc(r.wsRole)}</div></div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:${_C.text};">${_saEsc(r.moduleLabel)}<div style="font-size:0.65rem;color:${_C.muted};">${_saEsc(r.moduleId)}</div></div>
                <div style="font-size:0.72rem;color:${_C.muted};">${_saEsc(r.parentPi || r.parentInst || '—')}</div>
                <div style="font-size:0.72rem;color:${_C.muted};">${_fmtDate(r.requestedAt)}</div>
                <div style="display:flex;gap:6px;flex-shrink:0;">${actionHtml(r)}</div>
              </div>`).join('')}
          </div>
        </div>`;
    };

    const pendingActions = r => `
      <button onclick="_saGrantModuleRequest('${r.wsKey}','${r.moduleId}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:4px 10px;border-radius:5px;cursor:pointer;
        border:1px solid ${_C.greenDim};background:${_C.greenFaint};color:${_C.green};">Grant</button>
      <button onclick="_saDismissModuleRequest('${r.wsKey}','${r.moduleId}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:4px 10px;border-radius:5px;cursor:pointer;
        border:1px solid ${_C.border};background:transparent;color:${_C.muted};">Dismiss</button>`;

    const grantedActions = r => `
      <button onclick="_saRevokeModuleGrant('${r.wsKey}','${r.moduleId}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:4px 10px;border-radius:5px;cursor:pointer;
        border:1px solid ${_C.border};background:transparent;color:${_C.muted};">Revoke</button>`;

    const dismissedActions = r => `
      <button onclick="_saGrantModuleRequest('${r.wsKey}','${r.moduleId}')"
        style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;padding:4px 10px;border-radius:5px;cursor:pointer;
        border:1px solid ${_C.amberDim};background:${_C.amberFaint};color:${_C.amber};">Grant</button>`;

    const emptyState = `<div style="padding:32px;text-align:center;color:${_C.muted};font-size:0.88rem;">No pending module access requests.</div>`;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div>
          <div style="font-size:0.72rem;letter-spacing:0.22em;text-transform:uppercase;color:${_C.amber};margin-bottom:3px;">Module Access · Requests</div>
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.3rem;font-weight:300;color:${_C.text};">Access Request Queue</div>
        </div>
        <button onclick="_saPlatNav('requests')" style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;padding:6px 12px;border-radius:6px;cursor:pointer;border:1px solid ${_C.border};background:transparent;color:${_C.muted};">↺ Refresh</button>
      </div>
      ${!pending.length && !granted.length && !dismissed.length ? emptyState : ''}
      ${renderSection('⏳ Pending', _C.amber, pending, pendingActions)}
      ${renderSection('✓ Granted', _C.green, granted, grantedActions)}
      ${renderSection('✗ Dismissed', _C.muted, dismissed, dismissedActions)}
    `;
  } catch(e) {
    container.innerHTML = `<div style="color:${_C.red||'#f87171'};padding:16px;">Error loading requests: ${e.message}</div>`;
  }
}

async function _saGrantModuleRequest(wsKey, moduleId) {
  try {
    const wsRef = database.ref('workspaces/' + wsKey);
    const snap = await wsRef.once('value');
    const wsData = snap.val() || {};
    const grants = Array.isArray(wsData.module_grants) ? wsData.module_grants : [];
    if (!grants.includes(moduleId)) grants.push(moduleId);
    await wsRef.update({ module_grants: grants });
    await database.ref('workspaces/' + wsKey + '/access_requests/' + moduleId).update({ status: 'granted', granted_at: Date.now() });
    const body = document.getElementById('sa-plat-body');
    if (body) _saPlatRequests(body);
  } catch(e) {
    console.warn('Grant failed:', e);
    alert('Grant failed: ' + e.message);
  }
}

async function _saDismissModuleRequest(wsKey, moduleId) {
  try {
    await database.ref('workspaces/' + wsKey + '/access_requests/' + moduleId).update({ status: 'dismissed', dismissed_at: Date.now() });
    const body = document.getElementById('sa-plat-body');
    if (body) _saPlatRequests(body);
  } catch(e) {
    console.warn('Dismiss failed:', e);
    alert('Dismiss failed: ' + e.message);
  }
}

async function _saRevokeModuleGrant(wsKey, moduleId) {
  try {
    const wsRef = database.ref('workspaces/' + wsKey);
    const snap = await wsRef.once('value');
    const wsData = snap.val() || {};
    const grants = (wsData.module_grants || []).filter(m => m !== moduleId);
    if (grants.length > 0) {
      await wsRef.update({ module_grants: grants });
    } else {
      await wsRef.child('module_grants').remove();
    }
    await database.ref('workspaces/' + wsKey + '/access_requests/' + moduleId).update({ status: 'revoked', revoked_at: Date.now() });
    const body = document.getElementById('sa-plat-body');
    if (body) _saPlatRequests(body);
  } catch(e) {
    console.warn('Revoke failed:', e);
    alert('Revoke failed: ' + e.message);
  }
}

// ── System ────────────────────────────────────────────────────────────────────

async function _saPlatSystem(container) {
  try {
    const token = await _accGetToken();
    const [aSnap, pSnap, apiSnap, keysRes] = await Promise.all([
      database.ref('assessments').once('value').catch(()=>null),
      database.ref('peacs_assessments').once('value').catch(()=>null),
      database.ref('api_keys').once('value').catch(()=>null),
      fetch(LAMBDA_URL + '/admin/list-keys', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({}),
      }).then(r => r.json()).catch(() => ({ keys: [] })),
    ]);

    const allRecs  = aSnap?.val() ? Object.values(aSnap.val()) : [];
    const mmasRecs = allRecs.filter(r => r.tool !== 'map' && r.map_q1 === undefined);
    const mapRecs  = allRecs.filter(r => r.tool === 'map' || r.map_q1 !== undefined);
    const peacsCnt = pSnap?.val() ? Object.keys(pSnap.val()).length : 0;
    const apiActive = apiSnap?.val() ? Object.values(apiSnap.val()).filter(v => v.active).length : 0;
    const wsCnt    = (keysRes.keys || []).length;

    const stats = [
      ['MMAS Assessments', mmasRecs.length, _C.blue],
      ['PEACS Assessments', peacsCnt,        _C.purple],
      ['MAP Assessments',  mapRecs.length,   _C.green],
      ['Workspaces',       wsCnt,            _C.amber],
      ['Active API Keys',  apiActive,        _C.cyan],
    ];
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;">
        ${stats.map(([l,v,c])=>`
          <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1.55rem;font-weight:700;color:${c};font-family:'IBM Plex Mono',monospace;line-height:1;">${v.toLocaleString()}</div>
            <div style="font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:${_C.dim};margin-top:6px;">${l}</div>
          </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px;">
          <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:14px;">Platform</div>
          ${[['Version','ATLAS v8.9.3'],['Build','2026.07.10'],['Firebase Project','adherence-project-2026'],['Lambda (US)','us-east-1 · N. Virginia'],['Lambda (EU)','eu-central-1 · Frankfurt'],['Lambda (UAE)','me-central-1 · Abu Dhabi'],['CDN','Cloudflare Workers']].map(([k,v])=>`
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${_C.border};">
              <span style="font-size:0.82rem;color:${_C.dim};">${k}</span>
              <span style="font-size:0.82rem;color:${_C.text};font-family:'IBM Plex Mono',monospace;">${v}</span>
            </div>`).join('')}
        </div>
        <div style="background:${_C.surface};border:1px solid ${_C.border};border-radius:10px;padding:18px;">
          <div style="font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${_C.amber};margin-bottom:14px;">Quick Actions</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${[
              ['◈ Firebase Console','window.open(\'https://console.firebase.google.com/project/adherence-project-2026/database\',\'_blank\')'],
              ['⬡ Cloudflare Dashboard','window.open(\'https://dash.cloudflare.com\',\'_blank\')'],
              ['◆ AWS Lambda Console','window.open(\'https://us-east-1.console.aws.amazon.com/lambda/\',\'_blank\')'],
              ['◇ Audit Log','atlasAuditLog(\'sa_system_view\',{ts:Date.now()});showToast(\'Audit log entry created.\',2000)'],
            ].map(([l,fn])=>`
              <button onclick="${fn}" style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.1em;text-transform:uppercase;padding:9px 14px;border-radius:6px;cursor:pointer;background:${_C.navy};border:1px solid ${_C.border};color:${_C.text};text-align:left;transition:all 0.15s;" onmouseover="this.style.borderColor='${_C.borderB}'" onmouseout="this.style.borderColor='${_C.border}'">${l}</button>`).join('')}
          </div>
        </div>
      </div>`;
  } catch(e) { container.innerHTML = `<div style="color:${_C.red};font-size:0.96rem;">Error: ${_saEsc(e.message)}</div>`; }
}

