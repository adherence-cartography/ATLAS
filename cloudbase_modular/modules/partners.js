// ══════════════════════════════════════════════════════════════════════════
// ACADEMIC PARTNERS DATA
// ══════════════════════════════════════════════════════════════════════════
// ▶ TO ADD A PARTNER: copy one object, paste at the end of the array, fill in.
// ▶ TO REMOVE A PARTNER: delete its object (and the trailing comma if needed).
// ▶ Fields:
//   flag     — emoji flag e.g. "🇮🇹"
//   country  — label shown under the flag
//   accent   — CSS color for the flag/country label, pick from:
//              "var(--pe)"     = gold
//              "var(--base)"   = blue
//              "var(--strata)" = green
//              "var(--mvmt)"   = purple
//   name     — institution name (displayed in serif)
//   desc     — one or two sentences about the partnership
//   span     — true = card stretches full width (good for combined entries)
// ══════════════════════════════════════════════════════════════════════════
// Partners are organised into categories matching adherence.cc/partners/
// dot colours: blue=var(--base), gold=var(--pe), green=var(--strata), purple=var(--mvmt)
/**
 * @typedef {{ flag: string, country: string, name: string, type: string, dot: 'blue'|'gold'|'green'|'purple', span?: boolean }} PartnerEntry
 * @typedef {{ title: string, entries: PartnerEntry[], note?: string }} PartnerCategory
 */

/**
 * Bundled fallback partner data used when the remote `partners.json` fetch fails.
 * Each category contains a list of institutional partner entries for the partners modal.
 * @type {PartnerCategory[]}
 */
const ATLAS_PARTNER_CATEGORIES = [
  {
    title: 'Universities & Academic Research',
    entries: [
      { flag:'🇨🇾', country:'Cyprus',      name:'University of Nicosia',                               type:'University',            dot:'blue'   },
      { flag:'🇩🇪', country:'Germany',     name:'Universitätsklinikum Heidelberg',                     type:'University Hospital',   dot:'blue'   },
      { flag:'🇬🇷', country:'Greece',      name:'Democritus University of Thrace',                     type:'University',            dot:'blue'   },
      { flag:'🇮🇹', country:'Italy',       name:'Istituto Oncologico Veneto I.R.C.C.S',                type:'Research Institute',    dot:'blue'   },
      { flag:'🇴🇲', country:'Oman',        name:'NUST — National University of Science and Technology',type:'University · MOU',      dot:'green'  },
      { flag:'🇪🇸', country:'Spain',       name:'Hospital Universitario La Paz',                       type:'Hospital',              dot:'blue'   },
      { flag:'🇮🇳', country:'India',       name:'Amrita Vishwa Vidyapeetham',                          type:'University',            dot:'blue'   },
      { flag:'🇮🇳', country:'India',       name:'Maharishi Markandeshwar University',                  type:'University',            dot:'blue'   },
      { flag:'🇮🇳', country:'India',       name:'Sri Balaji Vidyapeeth',                               type:'University',            dot:'blue'   },
      { flag:'🇯🇵', country:'Japan',       name:'Hokkaido University — 北海道大学',                    type:'University',            dot:'blue'   },
      { flag:'🇲🇾', country:'Malaysia',    name:'Universiti Sains Malaysia (USM)',                     type:'University',            dot:'blue'   },
      { flag:'🇲🇾', country:'Malaysia',    name:'Universiti Malaya',                                   type:'University',            dot:'blue'   },
      { flag:'🇵🇭', country:'Philippines', name:'Centro Escolar University — School of Pharmacy',      type:'University',            dot:'blue'   },
      { flag:'🇵🇭', country:'Philippines', name:'Cebu Doctors College',                                type:'University',            dot:'blue'   },
      { flag:'🇻🇳', country:'Vietnam',     name:'National Geriatric Hospital',                         type:'Hospital',              dot:'blue'   },
      { flag:'🇧🇮', country:'Burundi',     name:'Hope Africa University',                              type:'University',            dot:'blue'   },
      { flag:'🇺🇬', country:'Uganda',      name:'Makerere University',                                 type:'University',            dot:'blue'   },
      { flag:'🇧🇷', country:'Brazil',      name:'Instituto da Criança — Hospital das Clínicas FMUSP',  type:'Hospital',              dot:'blue'   },
      { flag:'🇵🇪', country:'Peru',        name:'Junta de Beneficencia — Ayudar es la gran obra',      type:'Charitable Institution',dot:'blue'   },
      { flag:'🇺🇸', country:'USA',         name:"Children's Hospital of Michigan",                     type:'Hospital · ΞXPERT',     dot:'gold'   },
    ]
  },
  {
    title: 'Institutional Partners',
    entries: [
      { flag:'🇮🇹', country:'Italy',    name:'SIMAT — Società Italiana di Medicina e Assistenza Territoriale', type:'Scientific Society · MOU', dot:'green'  },
      { flag:'🇧🇹', country:'Bhutan',   name:'Ministry of Health, Kingdom of Bhutan',                          type:'Government',               dot:'purple' },
      { flag:'🇨🇴', country:'Colombia', name:'ALAT — Asociación Latinoamericana de Tórax',                     type:'Medical Society',           dot:'blue'   },
      { flag:'🇨🇴', country:'Colombia', name:'HapREDco',                                                       type:'Health Research',           dot:'blue'   },
    ]
  },
  {
    title: 'Commercial & Technology',
    entries: [
      { flag:'🇫🇷', country:'France',      name:'Observia',           type:'Digital Health',      dot:'blue' },
      { flag:'🇫🇷', country:'France',      name:'Medissimo',          type:'Smart Packaging',     dot:'blue' },
      { flag:'🇫🇷', country:'France',      name:'Mes Médocs du Jour', type:'Patient App',         dot:'blue' },
      { flag:'🇫🇷', country:'France',      name:'Rosetta Omics',      type:'Precision Medicine',  dot:'blue' },
      { flag:'🇬🇷', country:'Greece',      name:'MaMeds',             type:'Digital Health',      dot:'blue' },
      { flag:'🇮🇹', country:'Italy',       name:'Sempli Farma',       type:'Pharmacy',            dot:'blue' },
      { flag:'🇰🇷', country:'South Korea', name:'InHandPlus',         type:'Technology · AI Wearable', dot:'blue' },
      { flag:'🇦🇪', country:'UAE',         name:'Al Thiqa Pharmacy',  type:'Pharmacy · Abu Dhabi',dot:'gold' },
      { flag:'🇬🇧', country:'UK',          name:'CaringUp',           type:'Patient Engagement',  dot:'blue' },
      { flag:'🇬🇧', country:'UK',          name:'YOURmeds',           type:'Smart Packaging',     dot:'blue' },
      { flag:'🇺🇸', country:'USA',         name:'A-S Medication Solutions', type:'Medication Management', dot:'blue' },
    ]
  },
  {
    title: 'Pharmaceutical',
    note: 'The MMAS-8 has been used as a validated adherence endpoint in peer-reviewed clinical trials sponsored by these companies.',
    entries: [
      { flag:'💊', country:'Global', name:'Novartis',    type:'NCT00394823 · NCT01709812 · NCT02335892 · NCT05734053', dot:'gold' },
      { flag:'💊', country:'Global', name:'Pfizer',      type:'NCT00343200 · NCT00709787 · NCT01293825 · NCT01388166', dot:'gold' },
      { flag:'💊', country:'Global', name:'AstraZeneca', type:'NCT00681759 · NCT00769080 · NCT00873249 · NCT00927420 · NCT01176682 · NCT01577563', dot:'gold' },
      { flag:'💊', country:'Global', name:'AbbVie',      type:'NCT01768858 · NCT02750800 · NCT04080856',              dot:'gold' },
      { flag:'💊', country:'Global', name:'Janssen',     type:'NCT02262676 · NCT02610153 · NCT02996435',              dot:'gold' },
    ]
  },
];

/** @type {Record<string,string>} Maps dot color names to CSS custom property values. */
const _DOT_COLORS = { blue:'var(--base)', gold:'var(--pe)', green:'var(--strata)', purple:'var(--mvmt)' };

/**
 * Renders the partners grid into `#partners-grid` using grouped partner data.
 * Each category gets a header row followed by partner entry rows.
 * @param {PartnerCategory[]} categories - Array of partner categories to render
 * @returns {void}
 */
function _renderPartnersGrid(categories) {
  const grid = document.getElementById('partners-grid');
  if (!grid) return;
  grid.innerHTML = '';
  // Override container to single column for list layout
  grid.style.gridTemplateColumns = '1fr';
  grid.style.gap = '0';

  categories.forEach(cat => {
    // Category header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);padding:18px 0 8px;border-bottom:1px solid var(--border2);margin-bottom:4px;margin-top:8px;';
    hdr.textContent = cat.category || cat.title || '';
    grid.appendChild(hdr);

    if (cat.note) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:0.78rem;color:var(--dim);line-height:1.6;padding:8px 0 4px;';
      note.textContent = cat.note;
      grid.appendChild(note);
    }

    cat.entries.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);transition:background 0.15s;';
      const dotColor = _DOT_COLORS[p.dot] || 'var(--base)';
      row.innerHTML = `
        <div style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);flex-shrink:0;min-width:80px;">${p.flag} ${p.country}</span>
        <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:0.97rem;font-weight:300;color:var(--bright);flex:1;">${p.name}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--dim);text-align:right;flex-shrink:0;max-width:180px;line-height:1.5;">${p.type}</span>`;
      grid.appendChild(row);
    });
  });
}

/** @type {string} Remote URL for the live partners JSON data. */
const _PARTNERS_URL = 'https://adherence.cc/partners/partners.json';
/** @type {PartnerCategory[]|null} In-memory cache of fetched partner categories. */
let _partnersCache = null;

/**
 * Opens the Academic Partners modal and loads partner data.
 * Attempts to fetch live data from `_PARTNERS_URL`, falling back to bundled
 * `ATLAS_PARTNER_CATEGORIES` if the fetch fails. Results are cached for the session.
 * @returns {void}
 */
function openAcademicPartnersModal() {
  const m = document.getElementById('academic-partners-modal');
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => { m.style.opacity = '1'; });
  m.onclick = e => { if (e.target === m) closeAcademicPartnersModal(); };

  if (_partnersCache) {
    _renderPartnersGrid(_partnersCache);
    return;
  }
  // Show loading state while fetching
  const grid = document.getElementById('partners-grid');
  if (grid) grid.innerHTML = `<div style="padding:24px 0;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.82rem;">Loading partner network…</div>`;

  fetch(_PARTNERS_URL)
    .then(r => r.json())
    .then(data => {
      _partnersCache = data;
      _renderPartnersGrid(data);
    })
    .catch(() => {
      // Fallback to bundled data if fetch fails (offline / CORS issue)
      _partnersCache = ATLAS_PARTNER_CATEGORIES;
      _renderPartnersGrid(ATLAS_PARTNER_CATEGORIES);
    });
}
/**
 * Closes the Academic Partners modal.
 * @returns {void}
 */
function closeAcademicPartnersModal() {
  const m = document.getElementById('academic-partners-modal');
  m.style.display = 'none';
}
