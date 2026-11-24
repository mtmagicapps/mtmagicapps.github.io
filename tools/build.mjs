#!/usr/bin/env node
// Site build: no dependencies, run with `node tools/build.mjs` (`--check` fails if anything is out of date).
//
// The English pages listed in site.config.json are the sources. The build
//   - fills the marked regions of each English page in place (<!-- build:NAME --> … <!-- /build:NAME -->):
//     head (canonical, hreflang, Open Graph, JSON-LD), lang (EN/FR links) and md (markdown rendered to HTML);
//   - turns store badges (<a … data-store="play|appstore" data-utm="…">) into live links once the store is live;
//   - writes the French copy of every page under fr/, translated with i18n/fr.json (data-i18n, data-i18n-alt,
//     data-i18n-content keys; a missing key fails the build);
//   - renders the adapter list (vag-scope/adapters.json, affiliate links marked) into its region;
//   - writes sitemap.xml, robots.txt and llms.txt;
//   - fails if any published file contains a denied brand name (hashed, so this public repo does not name it) or an
//     e-mail address.
// It prints every file it changed, one per line (the pre-commit hook stages them).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
// --audit (public CI): audit the committed site without the private guide sources, generating nothing.
const AUDIT = process.argv.includes('--audit');
// Guide sources, drafts included, live in the private growth repository and never in this public one (history too).
const CONTENT = path.resolve(process.env.VAGSCOPE_CONTENT || path.join(ROOT, '..', 'vagscope_growth', 'content', 'guides'));
if (!AUDIT && !fs.existsSync(CONTENT)) {
  console.error(`build: guide sources not found at ${CONTENT}. Check out vagscope_growth next to this repository ` +
    '(or set VAGSCOPE_CONTENT), or run --audit.');
  process.exit(1);
}
const cfg = readJson('site.config.json');
const FR = readJson('i18n/fr.json');
const BASE = cfg.url.replace(/\/$/, '');
const LANGS = ['en', 'fr'];
const changed = [];
const errors = [];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function readJson(p) { return JSON.parse(read(p)); }
const OUT = new Map(); // every file the build writes, for the audit
function write(p, content) {
  OUT.set(p, content);
  const abs = path.join(ROOT, p);
  const old = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (old === content) return;
  changed.push(p);
  if (CHECK) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function text(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// ---- URLs -------------------------------------------------------------------------------------------------------

// ---- guides -----------------------------------------------------------------------------------------------------
// One guide = <slug>.en.md + <slug>.fr.md in vagscope_growth/content/guides, each opening with a front matter block:
// status (draft or published), title (the h1), seo_title (optional, the <title> before " | VAG Scope"), description,
// answer (the one- or two-sentence direct answer shown first), published and updated (YYYY-MM-DD). Only guides
// published in both languages become /vag-scope/guides/<slug>/ and join the list page; drafts never reach this repo.

function frontMatter(file) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
  if (!m) { errors.push(`${file}: no front matter`); return { meta: {}, body: '' }; }
  const meta = {};
  for (const line of m[1].split('\n')) { const k = /^(\w+):\s*(.*)$/.exec(line); if (k) meta[k[1]] = k[2].trim(); }
  return { meta, body: m[2] };
}
const GUIDES = AUDIT ? [] : [...new Set(fs.readdirSync(CONTENT)
  .map((f) => (/^([a-z0-9-]+)\.(en|fr)\.md$/.exec(f) || [])[1]).filter(Boolean))].sort().map((slug) => {
  const g = { slug, path: `vag-scope/guides/${slug}/index.html`, generated: 'guide', jsonld: ['TechArticle', 'BreadcrumbList'], lang: {} };
  for (const l of LANGS) {
    const file = `${slug}.${l}.md`;
    if (!fs.existsSync(path.join(CONTENT, file))) { g.missing = true; continue; }
    g.lang[l] = frontMatter(file);
  }
  return g;
}).filter((g) => !g.missing && LANGS.every((l) => g.lang[l].meta.status === 'published')).map((g) => {
  for (const l of LANGS) for (const k of ['title', 'description', 'answer', 'published', 'updated']) {
    if (!g.lang[l].meta[k]) errors.push(`content/guides/${g.slug}.${l}.md: no "${k}" in the front matter`);
  }
  return g;
});
const MODELS = AUDIT || !fs.existsSync(path.join(ROOT, 'vag-scope/models.json')) ? [] : readJson('vag-scope/models.json').map((m) => ({
  ...m, path: `vag-scope/models/${m.slug}/index.html`, generated: 'model', jsonld: ['TechArticle', 'BreadcrumbList', 'FAQPage'],
}));
const MODEL_PAGES = MODELS.filter((m) => m.page);
const ALL = [...cfg.pages,
  ...(GUIDES.length ? [{ path: 'vag-scope/guides/index.html', generated: 'guides', jsonld: ['BreadcrumbList'] }] : []), ...GUIDES,
  ...(MODELS.length ? [{ path: 'vag-scope/models/index.html', generated: 'models', jsonld: ['ItemList', 'BreadcrumbList', 'FAQPage'] }] : []), ...MODEL_PAGES];
const PAGES = ALL.map((p) => p.path);
// "vag-scope/index.html" -> "/vag-scope/", "vag-scope/privacy.html" -> "/vag-scope/privacy.html"
function urlPath(file, lang) { return (lang === 'fr' ? '/fr/' : '/') + file.replace(/(^|\/)index\.html$/, '$1'); }
function absUrl(file, lang) { return BASE + urlPath(file, lang); }
function outFile(file, lang) { return lang === 'fr' ? 'fr/' + file : file; }

// Rewrites relative href/src of a page copied to fr/: assets become root-absolute, links to a listed page go to
// its French copy.
function localizeUrls(html, file) {
  const dir = '/' + path.posix.dirname(file).replace(/^\.$/, '');
  html = html.replace(/\ssrcset="([^"]*)"/g, (all, v) => ' srcset="' + v.split(',').map((c) => {
    const [u, w] = c.trim().split(/\s+/);
    return (/^([a-z]+:|\/)/i.test(u) ? u : path.posix.normalize(path.posix.join(dir, u))) + (w ? ' ' + w : '');
  }).join(', ') + '"');
  return html.replace(/\s(href|src)="([^"]*)"/g, (all, attr, v) => {
    if (/^([a-z]+:|\/\/|#)/i.test(v)) return all;
    const m = /^([^#?]*)([?#].*)?$/.exec(v);
    let p = v.startsWith('/') ? m[1] : path.posix.normalize(path.posix.join(dir === '/' ? '/' : dir + '/', m[1] || './'));
    if ((m[1] === '' || m[1].endsWith('/')) && !p.endsWith('/')) p += '/';
    const asFile = (p.endsWith('/') ? p + 'index.html' : p).replace(/^\//, '');
    const target = PAGES.includes(asFile) ? '/fr' + p : p;
    return ` ${attr}="${target}${m[2] || ''}"`;
  });
}

// ---- HTML helpers -----------------------------------------------------------------------------------------------

// Replaces the inner HTML of every element carrying attr="key" with fn(key, inner).
function replaceInner(html, attr, fn) {
  const open = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\s${attr}="([^"]+)"[^>]*>`, 'g');
  let out = '', last = 0, m;
  while ((m = open.exec(html))) {
    const tag = m[1].toLowerCase(), start = m.index + m[0].length;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = start;
    let depth = 1, end = -1, close, c;
    while ((c = re.exec(html))) {
      if (c[1]) { if (--depth === 0) { end = c.index; close = re.lastIndex; break; } }
      else if (!c[0].endsWith('/>')) depth++;
    }
    if (end < 0) throw new Error(`unclosed <${tag} ${attr}="${m[2]}">`);
    out += html.slice(last, start) + fn(m[2], html.slice(start, end)) + html.slice(end, close);
    last = close;
    open.lastIndex = close;
  }
  return out + html.slice(last);
}

function region(html, name, content, file) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(\\s*<!-- /build:${name} -->)`);
  if (!re.test(html)) { errors.push(`${file}: no build:${name} region`); return html; }
  return html.replace(re, (_, a, b) => a + content + b);
}

function frKey(file, key) {
  if (!(key in FR)) { errors.push(`i18n/fr.json: missing "${key}" (used in ${file})`); return null; }
  return FR[key];
}

function translate(html, file) {
  html = html.replace(/<html lang="en"/, '<html lang="fr"');
  html = replaceInner(html, 'data-i18n', (k, inner) => frKey(file, k) ?? inner);
  html = html.replace(/(<[^>]*\salt=")([^"]*)("[^>]*\sdata-i18n-alt="([^"]+)")/g, (all, a, en, b, k) => {
    const v = frKey(file, k); return v == null ? all : a + esc(v) + b;
  });
  html = html.replace(/(<[^>]*\scontent=")([^"]*)("[^>]*\sdata-i18n-content="([^"]+)")/g, (all, a, en, b, k) => {
    const v = frKey(file, k); return v == null ? all : a + esc(v) + b;
  });
  return html;
}

// ---- markdown (headings, paragraphs, lists, bold, italic, code, links) ---------------------------------------------

function inlineMd(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
}
function renderMd(md) {
  const out = []; let para = [], list = false;
  const flush = () => { if (para.length) { out.push('<p>' + inlineMd(para.join(' ')) + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); closeList(); out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); }
    else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { flush(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inlineMd(m[1]) + '</li>'); }
    else if (!line.trim()) { flush(); closeList(); }
    else { closeList(); para.push(line.trim()); }
  }
  flush(); closeList();
  return out.join('\n');
}

// Guides: ## and ### headings (with ids), paragraphs, - and 1. lists, > notes, | tables.
const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function renderGuideMd(md) {
  const out = []; let para = [], list = null, quote = [], table = [];
  const flush = () => { if (para.length) { out.push('      <p>' + inlineMd(para.join(' ')) + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push(`      </${list}>`); list = null; } };
  const closeQuote = () => { if (quote.length) { out.push('      <aside class="note"><p>' + inlineMd(quote.join(' ')) + '</p></aside>'); quote = []; } };
  const closeTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !/^\|?\s*:?-{3,}/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    out.push('      <div class="table-wrap"><table>\n        <thead><tr>' + rows[0].map((c) => `<th scope="col">${inlineMd(c)}</th>`).join('') +
      '</tr></thead>\n        <tbody>\n' + rows.slice(1).map((r) => '          <tr>' + r.map((c, i) => `<td data-label="${esc(text(inlineMd(rows[0][i] || '')))}">${inlineMd(c)}</td>`).join('') + '</tr>').join('\n') +
      '\n        </tbody>\n      </table></div>');
    table = [];
  };
  const closeAll = () => { flush(); closeList(); closeQuote(); closeTable(); };
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    let m;
    if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { closeAll(); const n = m[1].length; out.push(`      <h${n} id="${slugify(m[2])}">${inlineMd(m[2])}</h${n}>`); }
    else if (/^\|/.test(line)) { flush(); closeList(); closeQuote(); table.push(line.trim()); }
    else if ((m = /^>\s?(.*)$/.exec(line))) { flush(); closeList(); closeTable(); quote.push(m[1]); }
    else if ((m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line))) {
      flush(); closeQuote(); closeTable();
      const t = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (list !== t) { closeList(); out.push(`      <${t}>`); list = t; }
      out.push('        <li>' + inlineMd(m[2]) + '</li>');
    }
    else if (!line.trim()) closeAll();
    else { closeList(); closeQuote(); closeTable(); para.push(line.trim()); }
  }
  closeAll();
  return out.join('\n');
}

const GUIDE_UI = {
  en: { guides: 'Guides', all: '← All guides', updated: 'Updated', h1: 'VAG Scope guides',
    seo: 'VW, Audi, Seat and Škoda OBD guides',
    intro: 'Practical guides to checking a used VW, Audi, Seat or Škoda, choosing an open Bluetooth ELM327 adapter and diagnosing control units from your phone.',
    related: 'Related guides',
    compatBannerH: 'Checking a specific car model?',
    compatBannerP: 'Browse the compatibility directory by generation to see protocol support (TP 2.0, 11-bit and 29-bit UDS) and SFD notes.',
    compatBannerA: 'Check model compatibility →',
    clusters: {
      buying: { title: 'Used-car mileage & VIN checks', desc: 'How to verify odometer readings and control-unit VINs before you buy.' },
      adapters: { title: 'Open ELM327 adapters & setup', desc: 'Which Bluetooth adapters handle VW-group protocols cleanly and why open hardware beats locked dongles.' },
      diy: { title: 'Offline DIY diagnostics & coding', desc: 'Scanning, live data, coding and service resets without subscriptions, credits or laptops.' },
      performance: { title: 'Live data, procedures & Performance Hub', desc: 'Measuring blocks, guided procedures, 0-500 km/h timing and virtual dyno.' },
      general: { title: 'More guides', desc: '' },
    } },
  fr: { guides: 'Guides', all: '← Tous les guides', updated: 'Mis à jour le', h1: 'Guides VAG Scope',
    seo: 'Guides OBD pour VW, Audi, Seat et Škoda',
    intro: 'Guides pratiques pour vérifier une VW, Audi, Seat ou Škoda d’occasion, choisir un ELM327 Bluetooth ouvert et diagnostiquer vos calculateurs.',
    related: 'Autres guides utiles',
    compatBannerH: 'Vous vérifiez un modèle précis ?',
    compatBannerP: 'Consultez la liste de compatibilité par génération pour voir le protocole (TP 2.0, UDS 11 bits ou 29 bits) et le statut SFD.',
    compatBannerA: 'Voir les modèles compatibles →',
    clusters: {
      buying: { title: 'Achat d’occasion : kilométrage et VIN', desc: 'Comparer le compteur aux calculateurs et vérifier le VIN avant de signer.' },
      adapters: { title: 'Adaptateurs ELM327 ouverts', desc: 'Quels boîtiers Bluetooth tiennent la route en TP 2.0 et UDS, et pourquoi éviter les clones et boîtiers verrouillés.' },
      diy: { title: 'Diagnostic et codage hors ligne', desc: 'Scan complet, mesures en direct, codage et entretien sans abonnement, sans crédits et sans PC portable.' },
      performance: { title: 'Mesures en direct, procédures et Performance Hub', desc: 'Blocs de mesures, procédures guidées, chronos 0-500 km/h et banc virtuel.' },
      general: { title: 'Autres guides', desc: '' },
    } },
};
const MODEL_UI = {
  en: {
    hub: 'Compatible models', all: '← All compatible models',
    h1: 'Compatible VW, Audi, Seat and Škoda models',
    seo: 'Compatible VW, Audi, Seat & Škoda models',
    hubDesc: 'Check VAG Scope compatibility by VW, Audi, Seat, Škoda or Cupra generation: TP 2.0, 11-bit and 29-bit UDS protocols, SFD status and ELM327 setup.',
    intro: 'Check which diagnostic protocol your Volkswagen, Audi, Seat, Škoda or Cupra uses (TP 2.0, 11-bit UDS or 29-bit UDS), whether SFD write protection applies, and which open Bluetooth ELM327 adapter to use.',
    searchLabel: 'Filter by model, chassis code, year or platform',
    searchPh: 'e.g. Golf 7, 5G, A4 B8, 8K, Octavia, MQB, 2016…',
    allBrands: 'All brands',
    empty: 'No matching generation in this list yet. Any 2004-2010 TP 2.0 or 2012+ UDS VW-group car is supported by protocol.',
    cols: ['Model', 'Years', 'Platform', 'Protocol', 'SFD / Status'],
    proto: {
      tp20: 'CAN TP 2.0',
      mixed: 'Mixed TP 2.0 + 11-bit UDS',
      uds11: '11-bit CAN UDS',
      uds29: '11-bit & 29-bit CAN UDS',
    },
    status: {
      real_car: 'Tested on real car + demo',
      demo: 'Built-in demo car + protocol support',
      protocol: 'Protocol supported (testers welcome)',
    },
    sfdYes: 'SFD on selected 2020+ modules (offline read/scan works; online SFD write unlock not supported)',
    sfdNo: 'No SFD write lock (offline reading and coding supported)',
    sfdShortYes: 'Read/scan offline · SFD write lock',
    sfdShortNo: 'Full offline read & coding',
    siblingLink: 'See platform guide:',
    eraH: 'VAG diagnostic protocols by era',
    eraIntro: 'Volkswagen Group vehicles moved through four main CAN diagnostic eras. Knowing your car’s era tells you immediately what VAG Scope can read and write.',
    eraCols: ['Era', 'Protocol', 'Example platforms', 'What VAG Scope supports'],
    eraRows: [
      ['Before 2004', 'K-Line (KWP1281 / KWP2000)', 'Golf 4 (1J), A3 8L, A4 B5/B6', 'Not supported on CAN-only ELM327 paths.'],
      ['2004-2010', 'CAN TP 2.0', 'PQ35 (Golf 5, A3 8P), C6 (4F)', 'Full offline scan, measuring blocks, coding, adaptations, mileage/VIN checks and Performance Hub.'],
      ['2009-2014', 'Mixed TP 2.0 + 11-bit UDS', 'Golf 6, Passat B7, A1 8X, Octavia 2 FL', 'Automatic unit-by-unit protocol switching across both old and new modules.'],
      ['2012-2020', '11-bit CAN UDS', 'MQB (Golf 7, A3 8V, Leon 5F), MLB / B9', 'Full offline scan, rich multi-unit mileage/VIN checks, live data, coding and Performance Hub with no SFD lock.'],
      ['2020+', '11-bit & 29-bit CAN UDS (4-hex)', 'MQB-evo (Golf 8, Leon KL), MEB (ID.3, ID.4)', 'Offline scan, 29-bit EV/hybrid modules, live data, health/mileage/VIN checks and Performance Hub. Online SFD write unlock is not supported.'],
    ],
    hubFaqH: 'Common compatibility questions',
    hubFaqs: [
      {
        q: 'My exact VW, Audi, Seat or Škoda model is not in the table. Will it still work?',
        a: 'Yes, if it uses CAN TP 2.0 (roughly 2004-2010) or UDS on 11-bit or 29-bit CAN ids (roughly 2012 onwards). You can also preview the four built-in demo cars (Audi RS6 C6, Audi S3 8V, Audi A1 8X, VW ID.4 GTX) straight from the home screen before buying an adapter.',
      },
      {
        q: 'Does VAG Scope work on pre-2004 K-line cars like a Golf 4 or Audi A4 B6?',
        a: 'No. VAG Scope targets CAN TP 2.0 (2004+) and UDS (2012+) vehicles. Pre-2004 K-line-only cars (and some K-line-only comfort modules on early A4 B7s) are not supported over CAN-only ELM327 paths.',
      },
      {
        q: 'What does SFD protection change on 2020+ MQB-evo and MEB cars?',
        a: 'SFD/SFD2 requires an online server-signed token to unlock protected write commands. Because VAG Scope has zero network permission by design, it works 100% offline for scanning, fault codes, live data, mileage/VIN checks and Performance Hub, and deliberately does not perform online SFD unlocks.',
      },
      {
        q: 'Which adapter works on Android vs iPhone?',
        a: 'On Android, both Classic Bluetooth (SPP) and Bluetooth Low Energy (BLE) ELM327 adapters work; VAG Scope is built and tested with the vLinker MC+ and vGate iCar Pro 2S. The upcoming iPhone version requires a BLE adapter (both recommended models include BLE).',
      },
      {
        q: 'How can I help verify a model on a real car?',
        a: 'Use the Contact form at the bottom of the site or share an exported protocol log from your car so we can confirm exact control-unit coverage and add your chassis to the verified list.',
      },
    ],
    specH: 'Technical overview',
    specCols: ['Item', 'Detail'],
    specRows: ['Brand & model', 'Chassis / type codes', 'Model years', 'Platform', 'Protocol', 'Verification status', 'SFD write protection', 'Recommended adapter'],
    adapterVal: 'Open Bluetooth ELM327 (vLinker MC+ or vGate iCar Pro 2S; Classic or BLE on Android, BLE on iPhone)',
    obdH: 'Where is the OBD-II port?',
    mileageH: 'Mileage & VIN check on this generation',
    checkH: 'What to check before buying or maintaining',
    whatWorksH: 'What VAG Scope supports on this chassis',
    faqH: 'Frequently asked questions',
    platformPeersH: 'Same-platform siblings',
    peersH: 'Other models from',
    guidesH: 'Helpful guides for this car',
    updated: '2026-11-24',
  },
  fr: {
    hub: 'Modèles compatibles', all: '← Tous les modèles compatibles',
    h1: 'Modèles VW, Audi, Seat et Škoda compatibles',
    seo: 'Modèles VW, Audi, Seat et Škoda compatibles',
    hubDesc: 'Vérifiez la compatibilité de VAG Scope par génération VW, Audi, Seat, Škoda ou Cupra : TP 2.0, UDS 11 et 29 bits, statut SFD et adaptateur ELM327.',
    intro: 'Vérifiez le protocole de diagnostic de votre Volkswagen, Audi, Seat, Škoda ou Cupra (TP 2.0, UDS 11 bits ou UDS 29 bits), la présence éventuelle de SFD et l’adaptateur ELM327 Bluetooth ouvert adapté.',
    searchLabel: 'Filtrer par modèle, code châssis, année ou plateforme',
    searchPh: 'ex. Golf 7, 5G, A4 B8, 8K, Octavia, MQB, 2016…',
    allBrands: 'Toutes les marques',
    empty: 'Aucune génération correspondante dans cette liste. Toute voiture du groupe VW en TP 2.0 (2004-2010) ou UDS (2012+) est prise en charge par protocole.',
    cols: ['Modèle', 'Années', 'Plateforme', 'Protocole', 'SFD / Statut'],
    proto: {
      tp20: 'CAN TP 2.0',
      mixed: 'Mixte TP 2.0 + UDS 11 bits',
      uds11: 'UDS CAN 11 bits',
      uds29: 'UDS CAN 11 et 29 bits',
    },
    status: {
      real_car: 'Testée sur vraie voiture + démo',
      demo: 'Voiture de démo intégrée + protocole',
      protocol: 'Prise en charge par protocole',
    },
    sfdYes: 'Protection SFD sur certains modules 2020+ (lecture/scan hors ligne OK ; pas de déverrouillage SFD en ligne)',
    sfdNo: 'Pas de verrouillage SFD (lecture et codage hors ligne)',
    sfdShortYes: 'Lecture/scan hors ligne · SFD en écriture',
    sfdShortNo: 'Lecture et codage hors ligne',
    siblingLink: 'Voir le guide plateforme :',
    eraH: 'Les protocoles de diagnostic VAG par génération',
    eraIntro: 'L’électronique du groupe Volkswagen a traversé quatre grandes générations CAN. Connaître celle de votre voiture indique tout de suite ce que VAG Scope lit et écrit.',
    eraCols: ['Période', 'Protocole', 'Plateformes types', 'Prise en charge VAG Scope'],
    eraRows: [
      ['Avant 2004', 'Ligne K (KWP1281 / KWP2000)', 'Golf 4 (1J), A3 8L, A4 B5/B6', 'Non pris en charge sur les chemins ELM327 CAN uniquement.'],
      ['2004-2010', 'CAN TP 2.0', 'PQ35 (Golf 5, A3 8P), C6 (4F)', 'Scan complet hors ligne, blocs de mesures, codage, adaptations, contrôles kilométrage/VIN et Performance Hub.'],
      ['2009-2014', 'Mixte TP 2.0 + UDS 11 bits', 'Golf 6, Passat B7, A1 8X, Octavia 2 FL', 'Bascule automatique calculateur par calculateur entre les deux protocoles.'],
      ['2012-2020', 'UDS CAN 11 bits', 'MQB (Golf 7, A3 8V, Leon 5F), MLB / B9', 'Scan complet hors ligne, nombreux relevés kilométrage/VIN, mesures en direct, codage et Performance Hub sans SFD.'],
      ['2020+', 'UDS CAN 11 et 29 bits (4 hexa)', 'MQB-evo (Golf 8, Leon KL), MEB (ID.3, ID.4)', 'Scan hors ligne, modules électriques/hybrides 29 bits, mesures en direct, bilans santé/kilométrage/VIN et Performance Hub. Pas de déverrouillage SFD en ligne.'],
    ],
    hubFaqH: 'Questions fréquentes sur la compatibilité',
    hubFaqs: [
      {
        q: 'Mon modèle VW, Audi, Seat ou Škoda n’est pas dans le tableau, est-il compatible ?',
        a: 'Oui s’il utilise CAN TP 2.0 (environ 2004-2010) ou UDS sur CAN 11 ou 29 bits (environ 2012 et après). Vous pouvez aussi tester les quatre voitures de démonstration intégrées (Audi RS6 C6, Audi S3 8V, Audi A1 8X, VW ID.4 GTX) dès l’écran d’accueil.',
      },
      {
        q: 'VAG Scope fonctionne-t-elle sur une voiture d’avant 2004 en ligne K (Golf 4, A4 B6) ?',
        a: 'Non. VAG Scope cible les voitures en CAN TP 2.0 (2004+) et UDS (2012+). Les anciens véhicules uniquement en ligne K (et certains modules confort en ligne K des premières A4 B7) ne passent pas.',
      },
      {
        q: 'Que change la protection SFD sur les modèles 2020+ (MQB-evo et MEB) ?',
        a: 'SFD/SFD2 impose un jeton signé par les serveurs du constructeur pour débloquer certaines écritures. Comme VAG Scope n’a aucune permission réseau par conception, la lecture, le scan, le bilan de santé, le kilométrage, le VIN et le Performance Hub fonctionnent 100 % hors ligne, mais le déverrouillage SFD en ligne n’est pas géré.',
      },
      {
        q: 'Quel adaptateur faut-il sur Android et sur iPhone ?',
        a: 'Sur Android, Bluetooth classique (SPP) et BLE fonctionnent tous les deux (testée avec vLinker MC+ et vGate iCar Pro 2S). La future version iPhone demandera impérativement un adaptateur BLE : les deux modèles recommandés gèrent déjà le BLE.',
      },
      {
        q: 'Comment aider à valider un modèle sur une vraie voiture ?',
        a: 'Écrivez-nous via le formulaire Contact en bas du site avec un retour ou un journal de protocole exporté depuis l’appli pour confirmer la prise en charge exacte de votre génération.',
      },
    ],
    specH: 'Fiche technique',
    specCols: ['Élément', 'Détail'],
    specRows: ['Marque et modèle', 'Codes châssis', 'Années', 'Plateforme', 'Protocole', 'Statut de vérification', 'Protection SFD', 'Adaptateur recommandé'],
    adapterVal: 'ELM327 Bluetooth ouvert (vLinker MC+ ou vGate iCar Pro 2S ; Classique ou BLE sur Android, BLE sur iPhone)',
    obdH: 'Où se trouve la prise OBD ?',
    mileageH: 'Contrôle du kilométrage et du VIN sur cette génération',
    checkH: 'Points à vérifier avant achat ou à l’entretien',
    whatWorksH: 'Ce que VAG Scope gère sur cette voiture',
    faqH: 'Questions fréquentes',
    platformPeersH: 'Modèles sur la même plateforme',
    peersH: 'Autres modèles',
    guidesH: 'Guides utiles pour cette voiture',
    updated: '2026-11-24',
  },
};
const CLUSTER_ORDER = ['buying', 'adapters', 'diy', 'performance', 'general'];
const fmtDate = (d, lang) => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function renderGenerated(page, lang) {
  const ui = GUIDE_UI[lang];
  const mui = MODEL_UI[lang];
  let title, desc, main, extraScript = '';
  if (page.generated === 'guide') {
    const { meta, body } = page.lang[lang];
    title = `${meta.seo_title || meta.title} | VAG Scope`;
    desc = meta.description;
    const badges = read('tools/templates/stores.html').replace(/\{\{utm\}\}/g, 'guide_' + page.slug.replace(/-/g, '_'));
    const cluster = meta.cluster || 'general';
    const others = GUIDES.filter((g) => g.slug !== page.slug && g.lang[lang])
      .sort((a, b) => Number((b.lang[lang].meta.cluster || 'general') === cluster) - Number((a.lang[lang].meta.cluster || 'general') === cluster) ||
        b.lang[lang].meta.updated.localeCompare(a.lang[lang].meta.updated))
      .slice(0, 3);
    const relatedHtml = others.length ? `\n      <section class="related-guides" aria-labelledby="related-h">
        <h2 id="related-h">${ui.related}</h2>
        <ul class="guide-list">${others.map((g) => `
          <li><a href="/vag-scope/guides/${g.slug}/"><h3>${esc(g.lang[lang].meta.title)}</h3><p>${esc(g.lang[lang].meta.description)}</p></a></li>`).join('')}
        </ul>
      </section>` : '';
    main = `    <article class="wrap doc guide">
      <p class="doc-back"><a href="/vag-scope/guides/">${ui.all}</a></p>
      <h1>${esc(meta.title)}</h1>
      <p class="guide-meta">${ui.updated} <time datetime="${meta.updated}">${fmtDate(meta.updated, lang)}</time></p>
      <p class="answer">${inlineMd(meta.answer)}</p>
${renderGuideMd(body)}${relatedHtml}
      <aside class="guide-cta" aria-labelledby="guide-cta-h">
        <h2 id="guide-cta-h" data-i18n="gcta_h">Run the check on your own car</h2>
        <p data-i18n="gcta_p">VAG Scope does it from your phone and a Bluetooth ELM327 adapter: no account, no network, and every result shows its evidence.</p>
        <div class="actions">
          <a class="cta" href="${cfg.waitlist}" target="_blank" rel="noopener" data-until-live="play" data-i18n="cta_notify">Get notified at launch</a>
${badges}        </div>
      </aside>
    </article>`;
  } else if (page.generated === 'guides') {
    title = `${ui.seo} | VAG Scope`;
    desc = ui.intro;
    const byCluster = new Map();
    for (const g of GUIDES.filter((x) => x.lang[lang])) {
      const c = g.lang[lang].meta.cluster || 'general';
      if (!byCluster.has(c)) byCluster.set(c, []);
      byCluster.get(c).push(g);
    }
    const sections = CLUSTER_ORDER.filter((c) => byCluster.has(c)).map((c) => {
      const info = ui.clusters[c] || ui.clusters.general;
      const items = byCluster.get(c).sort((a, b) => b.lang[lang].meta.updated.localeCompare(a.lang[lang].meta.updated) || a.slug.localeCompare(b.slug));
      return `      <section class="guide-cluster" id="cluster-${c}">
        <h2>${esc(info.title)}</h2>${info.desc ? `\n        <p>${esc(info.desc)}</p>` : ''}
        <ul class="guide-list">${items.map((g) => `
          <li><a href="/vag-scope/guides/${g.slug}/"><h3>${esc(g.lang[lang].meta.title)}</h3><p>${esc(g.lang[lang].meta.description)}</p></a></li>`).join('')}
        </ul>
      </section>`;
    }).join('\n');
    const compatBox = MODELS.length ? `\n      <aside class="note">
        <p><strong>${esc(ui.compatBannerH)}</strong> ${esc(ui.compatBannerP)} <a href="/vag-scope/models/">${esc(ui.compatBannerA)}</a></p>
      </aside>` : '';
    main = `    <section class="wrap doc guides">
      <p class="doc-back"><a href="/vag-scope/">← VAG Scope</a></p>
      <h1>${ui.h1}</h1>
      <p class="answer">${ui.intro}</p>${compatBox}
${sections}
    </section>`;
  } else if (page.generated === 'models') {
    title = `${mui.seo} | VAG Scope`;
    desc = mui.hubDesc;
    extraScript = '\n  <script src="/assets/models.js" defer></script>';
    const badges = read('tools/templates/stores.html').replace(/\{\{utm\}\}/g, 'models_hub');
    const brands = [...new Set(MODELS.map((m) => m.brand))];
    const pills = `<button type="button" class="pill-btn" data-brand-filter="all" aria-pressed="true">${esc(mui.allBrands)}</button>` +
      brands.map((b) => `<button type="button" class="pill-btn" data-brand-filter="${esc(b)}" aria-pressed="false">${esc(b)}</button>`).join('');
    const rows = MODELS.map((m) => {
      const codesStr = (m.codes || []).join(', ');
      const search = `${m.brand} ${m.model} ${codesStr} ${m.years} ${m.platform} ${mui.proto[m.protocol]}`;
      const siblingObj = m.sibling ? MODEL_PAGES.find((x) => x.slug === m.sibling) : null;
      const modelCell = m.page
        ? `<a href="/vag-scope/models/${m.slug}/">${esc(m.brand)} ${esc(m.model)}</a><span class="model-codes">${esc(codesStr)}</span>`
        : `<strong>${esc(m.brand)} ${esc(m.model)}</strong><span class="model-codes">${esc(codesStr)}</span><span class="model-note">${esc(m.note[lang] || m.note.en)}${siblingObj ? ` <a href="/vag-scope/models/${siblingObj.slug}/">${esc(mui.siblingLink)} ${esc(siblingObj.brand)} ${esc(siblingObj.model)}</a>` : ''}</span>`;
      return `          <tr data-model-row data-brand="${esc(m.brand)}" data-search="${esc(search)}">
            <td data-label="${esc(mui.cols[0])}">${modelCell}</td>
            <td data-label="${esc(mui.cols[1])}">${esc(m.years)}</td>
            <td data-label="${esc(mui.cols[2])}">${esc(m.platform)}</td>
            <td data-label="${esc(mui.cols[3])}">${esc(mui.proto[m.protocol])}</td>
            <td data-label="${esc(mui.cols[4])}">${esc(m.sfd ? mui.sfdShortYes : mui.sfdShortNo)}</td>
          </tr>`;
    }).join('\n');
    const eraRowsHtml = mui.eraRows.map((r) => `          <tr>${r.map((c, i) => `<td data-label="${esc(mui.eraCols[i])}">${esc(c)}</td>`).join('')}</tr>`).join('\n');
    const hubFaqHtml = mui.hubFaqs.map((f) => `        <details data-faq><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');
    main = `    <section class="wrap doc models-hub">
      <p class="doc-back"><a href="/vag-scope/">← VAG Scope</a></p>
      <h1>${esc(mui.h1)}</h1>
      <p class="answer">${esc(mui.intro)}</p>
      <div class="model-controls">
        <label for="model-q">${esc(mui.searchLabel)}</label>
        <input id="model-q" type="search" placeholder="${esc(mui.searchPh)}" autocomplete="off">
        <div class="pill-row" role="group" aria-label="${esc(mui.allBrands)}">${pills}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>${mui.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
${rows}
        </tbody>
      </table></div>
      <p id="model-empty" class="note" hidden>${esc(mui.empty)}</p>
      <h2>${esc(mui.eraH)}</h2>
      <p>${esc(mui.eraIntro)}</p>
      <div class="table-wrap"><table>
        <thead><tr>${mui.eraCols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
${eraRowsHtml}
        </tbody>
      </table></div>
      <h2>${esc(mui.hubFaqH)}</h2>
      <div class="faq-list">
${hubFaqHtml}
      </div>
      <aside class="guide-cta" aria-labelledby="guide-cta-h">
        <h2 id="guide-cta-h" data-i18n="gcta_h">Run the check on your own car</h2>
        <p data-i18n="gcta_p">VAG Scope does it from your phone and a Bluetooth ELM327 adapter: no account, no network, and every result shows its evidence.</p>
        <div class="actions">
          <a class="cta" href="${cfg.waitlist}" target="_blank" rel="noopener" data-until-live="play" data-i18n="cta_notify">Get notified at launch</a>
${badges}        </div>
      </aside>
    </section>`;
  } else if (page.generated === 'model') {
    const m = page;
    const car = `${m.brand} ${m.model}`;
    const codesStr = (m.codes || []).join(', ');
    const shortCodes = (m.codes || []).slice(0, 2).join(' / ');
    const proto = mui.proto[m.protocol];
    const badges = read('tools/templates/stores.html').replace(/\{\{utm\}\}/g, 'model_' + m.slug.replace(/-/g, '_'));
    title = `${m.seoTitle[lang]} | VAG Scope`;
    desc = m.metaDesc[lang];
    const worksList = lang === 'fr' ? [
      'Bilan de santé avant achat : codes défaut, comparaison du kilométrage entre calculateurs et contrôle du VIN dans un rapport PDF signé.',
      'Scan complet des calculateurs et identification avancée, effacement des défauts après sauvegarde et confirmation.',
      'Mesures en direct (blocs de mesures / DIDs), graphiques sur 60 s, export CSV, tableaux de bord sur téléphone et Android Auto.',
      'Performance Hub : chronos 0-500 km/h (fusion OBD + capteurs téléphone 100 Hz), banc virtuel et fiches PNG/PDF signées sans GPS.',
      m.sfd
        ? 'Écriture et codage : possibles hors ligne sur les calculateurs non verrouillés SFD ; le déverrouillage SFD en ligne n’est pas géré (aucune permission réseau).'
        : 'Codage, codage long, liste d’installation passerelle, adaptations, réglages de base, tests actionneurs et remise à zéro d’entretien (sauvegarde et relecture automatiques).',
    ] : [
      'Pre-purchase health check: fault codes, cross-module mileage comparison and VIN check in one signed PDF report.',
      'Full control-unit scan, advanced identification and fault clearing with automatic backup and confirmation.',
      'Searchable live data (measuring blocks / UDS DIDs), 60-second charts, CSV logging and Android Auto dashboards.',
      'Performance Hub: 0-500 km/h timing (100 Hz OBD + phone IMU fusion), virtual dyno and signed PNG/PDF proof cards without GPS permission.',
      m.sfd
        ? 'Coding and adaptations: offline writes work on non-SFD modules; online SFD unlock for protected 2020+ modules is not supported because the app has no network permission.'
        : 'Coding, long coding, gateway installation list, adaptations, basic settings, output tests and service reset with automatic backup and read-back.',
    ];
    const platformPeers = MODEL_PAGES.filter((x) => x.platform === m.platform && x.slug !== m.slug);
    const brandPeers = MODEL_PAGES.filter((x) => x.brand === m.brand && x.slug !== m.slug && x.platform !== m.platform).slice(0, 5);
    const specVals = [car, codesStr, m.years, m.platform, proto, mui.status[m.status], m.sfd ? mui.sfdYes : mui.sfdNo, mui.adapterVal];
    const specRows = mui.specRows.map((k, i) => `          <tr><td data-label="${esc(mui.specCols[0])}">${esc(k)}</td><td data-label="${esc(mui.specCols[1])}">${esc(specVals[i])}</td></tr>`).join('\n');
    const faqHtml = (m.faqs[lang] || []).map((f) => `        <details data-faq><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');
    const whatH = lang === 'fr' ? `Ce que VAG Scope gère sur ${m.frName || car}` : mui.whatWorksH;
    main = `    <article class="wrap doc model-page">
      <p class="doc-back"><a href="/vag-scope/models/">${esc(mui.all)}</a></p>
      <h1>${esc(car)} (${esc(shortCodes)}, ${esc(m.years)})</h1>
      <p class="guide-meta">${ui.updated} <time datetime="${mui.updated}">${fmtDate(mui.updated, lang)}</time></p>
      <p class="answer">${esc(m.answer[lang])}</p>
      <h2>${esc(mui.specH)}</h2>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">${esc(mui.specCols[0])}</th><th scope="col">${esc(mui.specCols[1])}</th></tr></thead>
        <tbody>
${specRows}
        </tbody>
      </table></div>
      <h2>${esc(mui.obdH)}</h2>
      <p>${esc(m.obdPort[lang])}</p>
      <h2>${esc(mui.mileageH)}</h2>
      <p>${esc(m.mileageReality[lang])} <a href="/vag-scope/guides/used-car-mileage-check/">${lang === 'fr' ? 'Lire le guide du contrôle kilométrique' : 'Read the mileage check guide'}</a> · <a href="/vag-scope/guides/vin-check/">${lang === 'fr' ? 'Guide de vérification du VIN' : 'VIN check guide'}</a></p>
      <h2>${esc(mui.checkH)}</h2>
      <ul>
${(m.checkpoints[lang] || []).map((c) => `        <li>${esc(c)}</li>`).join('\n')}
      </ul>
      <h2>${esc(whatH)}</h2>
      <p>${esc(m.note[lang] || m.note.en)}</p>
      <ul>
${worksList.map((w) => `        <li>${esc(w)}</li>`).join('\n')}
      </ul>
      <h2>${esc(mui.faqH)}</h2>
      <div class="faq-list">
${faqHtml}
      </div>${platformPeers.length ? `\n      <h2>${esc(mui.platformPeersH)} (${esc(m.platform)})</h2>
      <p class="peer-links">${platformPeers.map((p) => `<a href="/vag-scope/models/${p.slug}/">${esc(p.brand)} ${esc(p.model)} (${esc(p.years)})</a>`).join(' · ')}</p>` : ''}${brandPeers.length ? `\n      <h2>${esc(mui.peersH)} ${esc(m.brand)}</h2>
      <p class="peer-links">${brandPeers.map((p) => `<a href="/vag-scope/models/${p.slug}/">${esc(p.brand)} ${esc(p.model)} (${esc(p.years)})</a>`).join(' · ')}</p>` : ''}
      <h2>${esc(mui.guidesH)}</h2>
      <ul>
        <li><a href="/vag-scope/guides/best-elm327-adapter-vw-audi/">${lang === 'fr' ? 'Quel adaptateur ELM327 Bluetooth choisir' : 'Best ELM327 Bluetooth adapter for VW, Audi, Seat and Škoda'}</a></li>
        <li><a href="/vag-scope/guides/used-car-mileage-check/">${lang === 'fr' ? 'Comment vérifier le kilométrage d’une occasion' : 'How to check the mileage of a used VW, Audi, Seat or Škoda'}</a></li>
        <li><a href="/vag-scope/guides/vin-check/">${lang === 'fr' ? 'Où trouver et vérifier le VIN' : 'Where to find and check the VIN'}</a></li>
      </ul>
      <aside class="guide-cta" aria-labelledby="guide-cta-h">
        <h2 id="guide-cta-h" data-i18n="gcta_h">Run the check on your own car</h2>
        <p data-i18n="gcta_p">VAG Scope does it from your phone and a Bluetooth ELM327 adapter: no account, no network, and every result shows its evidence.</p>
        <div class="actions">
          <a class="cta" href="${cfg.waitlist}" target="_blank" rel="noopener" data-until-live="play" data-i18n="cta_notify">Get notified at launch</a>
${badges}        </div>
      </aside>
    </article>`;
  }
  return read('tools/templates/page.html').replace(/^<!-- Shell of generated pages[^\n]*\n/m, '')
    .replace('{{title}}', esc(title)).replace('{{description}}', esc(desc))
    .replace('{{main}}', () => main).replace('</body>', () => extraScript + '\n  </body>');
}

// ---- regions ----------------------------------------------------------------------------------------------------

function storeUrl(store, utm, lang) {
  if (store === 'play') {
    const q = new URLSearchParams({ id: cfg.app.play.package, hl: lang, utm_source: 'site', utm_campaign: utm });
    return 'https://play.google.com/store/apps/details?' + q;
  }
  return cfg.app.appStore.url;
}
function stores(html, lang) {
  return html.replace(/<a\b([^>]*\sdata-store="(play|appstore)"[^>]*)>/g, (all, attrs, store) => {
    const live = store === 'play' ? cfg.app.play.live : cfg.app.appStore.live && cfg.app.appStore.url;
    const utm = (/\sdata-utm="([^"]+)"/.exec(attrs) || [])[1] || 'site';
    let a = attrs.replace(/\s(href|aria-disabled|target|rel)="[^"]*"/g, '').replace(/\s+is-disabled/, '');
    if (live) a += ` href="${esc(storeUrl(store, utm, lang))}"`;
    else a = a.replace(/class="([^"]*)"/, 'class="$1 is-disabled"') + ' aria-disabled="true"';
    return `<a${a}>`;
  }).replace(/<([a-z]+)\b([^>]*\sdata-until-live="(play|appstore)"[^>]*)>/g, (all, tag, attrs, store) => {
    // pre-launch elements (waitlist button, "coming soon" bar) are hidden once that store is live
    const live = store === 'play' ? cfg.app.play.live : cfg.app.appStore.live && cfg.app.appStore.url;
    return `<${tag}${attrs.replace(/\shidden\b/, '')}${live ? ' hidden' : ''}>`;
  });
}

// Waitlist links carry the page language and where the click came from into the form's hidden fields (lang, source),
// so sign-ups can be counted per page and written to in the right language: source is <page>_<cta|bar|link>.
function pageId(page) {
  if (page.generated === 'guide') return 'guide_' + page.slug.replace(/-/g, '_');
  if (page.generated === 'model') return 'model_' + page.slug.replace(/-/g, '_');
  return page.path.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '').replace(/[/-]+/g, '_').replace(/_$/, '') || 'home';
}
function waitlistLinks(html, page, lang) {
  const base = cfg.waitlist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`<a\\b([^>]*?)\\shref="${base}(?:\\?[^"]*)?"([^>]*)>`, 'g'), (all, a, b) => {
    const cls = (/\sclass="([^"]*)"/.exec(a + b) || [])[1] || '';
    const where = /\bcta\b/.test(cls) ? 'cta' : /data-i18n="notify_a"/.test(a + b) ? 'bar' : 'link';
    const q = new URLSearchParams({ lang, source: `${pageId(page)}_${where}` });
    return `<a${a} href="${cfg.waitlist}?${esc(q.toString())}"${b}>`;
  });
}

function faqItems(html) {
  return [...html.matchAll(/<details\b[^>]*\sdata-faq\b[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map((m) => ({ q: text(m[1]), a: text(m[2]) }));
}

function jsonLd(page, lang, html) {
  const org = { '@type': 'Organization', name: cfg.org.name, legalName: cfg.org.legalName, url: BASE + '/',
    logo: BASE + "/" + cfg.org.logo };
  const out = [];
  for (const type of page.jsonld || []) {
    if (type === 'Organization') out.push(org);
    if (type === 'SoftwareApplication') {
      const app = { '@type': 'SoftwareApplication', name: cfg.app.name, description: cfg.app.description[lang],
        applicationCategory: 'UtilitiesApplication', operatingSystem: cfg.app.operatingSystem,
        inLanguage: ['en', 'fr'], image: BASE + '/' + cfg.app.icon, url: absUrl('vag-scope/index.html', lang),
        publisher: { '@type': 'Organization', name: cfg.org.name, url: BASE + '/' } };
      const sameAs = [];
      if (cfg.app.play.live) {
        sameAs.push('https://play.google.com/store/apps/details?id=' + cfg.app.play.package);
        app.offers = { '@type': 'Offer', price: cfg.app.price, priceCurrency: cfg.app.currency };
      }
      if (cfg.app.appStore.live && cfg.app.appStore.url) sameAs.push(cfg.app.appStore.url);
      if (sameAs.length) app.sameAs = sameAs;
      out.push(app);
    }
    if (type === 'BreadcrumbList') {
      const crumbs = [[cfg.app.name, 'vag-scope/index.html']];
      if (page.path.startsWith('vag-scope/guides/')) crumbs.push([GUIDE_UI[lang].guides, 'vag-scope/guides/index.html']);
      if (page.path.startsWith('vag-scope/models/')) crumbs.push([MODEL_UI[lang].hub, 'vag-scope/models/index.html']);
      if (page.generated === 'guide') crumbs.push([page.lang[lang].meta.title, page.path]);
      else if (page.generated === 'model') crumbs.push([`${page.brand} ${page.model} (${page.years})`, page.path]);
      else if (page.generated !== 'guides' && page.generated !== 'models') {
        crumbs.push([text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '').split(' | ')[0], page.path]);
      }
      out.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, p], i) =>
        ({ '@type': 'ListItem', position: i + 1, name, item: absUrl(p, lang) })) });
    }
    if (type === 'TechArticle') {
      const isModel = page.generated === 'model';
      const headline = isModel ? `${page.brand} ${page.model} (${page.years})` : page.lang[lang].meta.title;
      const desc = isModel ? ((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '') : page.lang[lang].meta.description;
      const published = isModel ? MODEL_UI[lang].updated : page.lang[lang].meta.published;
      const updated = isModel ? MODEL_UI[lang].updated : page.lang[lang].meta.updated;
      const appAbout = { '@type': 'SoftwareApplication', name: cfg.app.name, url: absUrl('vag-scope/index.html', lang) };
      const about = isModel
        ? [appAbout, { '@type': 'Car', name: `${page.brand} ${page.model}`, brand: { '@type': 'Brand', name: page.brand }, vehicleModelDate: page.years }]
        : appAbout;
      out.push({ '@type': 'TechArticle', headline, description: desc, inLanguage: lang,
        datePublished: published, dateModified: updated, url: absUrl(page.path, lang),
        image: BASE + '/' + (cfg.ogImage[lang] || cfg.ogImage.en).src,
        author: { '@type': 'Organization', name: cfg.org.name, url: BASE + '/' },
        publisher: { '@type': 'Organization', name: cfg.org.name, logo: { '@type': 'ImageObject', url: BASE + '/' + cfg.org.logo } },
        about });
    }
    if (type === 'ItemList') {
      out.push({ '@type': 'ItemList', name: MODEL_UI[lang].h1, itemListElement: MODEL_PAGES.map((m, i) => ({
        '@type': 'ListItem', position: i + 1, name: `${m.brand} ${m.model} (${m.years})`, url: absUrl(m.path, lang),
      })) });
    }
    if (type === 'FAQPage') {
      const items = faqItems(html);
      if (!items.length) errors.push(`${page.path}: FAQPage without <details data-faq> items`);
      out.push({ '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a } })) });
    }
  }
  return out.map((o) => '\n  <script type="application/ld+json">' +
    JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c') + '</script>').join('');
}

function head(page, lang, html) {
  const title = text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '');
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  const url = absUrl(page.path, lang);
  const og = cfg.ogImage[lang] || cfg.ogImage.en;
  // search results cut longer titles and descriptions
  if (title.length > 70) errors.push(`${outFile(page.path, lang)}: title has ${title.length} characters (70 at most)`);
  if (text(desc).length > 160) errors.push(`${outFile(page.path, lang)}: description has ${text(desc).length} characters (160 at most)`);
  // Runs before the first paint: a remembered EN/FR choice, or a French browser on its first visit, opens the right
  // copy. Without a remembered choice it only ever goes towards French, so crawlers (English, no storage) stay put.
  const alts = JSON.stringify(Object.fromEntries(LANGS.map((l) => [l, urlPath(page.path, l)])));
  const redirect = `<script>(function(){var a=${alts},l=document.documentElement.lang,s;try{s=localStorage.getItem('lang')}` +
    `catch(e){}var w=s||(/^fr/i.test(navigator.language||'')?'fr':l);if(w!==l&&a[w])location.replace(a[w]+location.hash);` +
    // a click on EN/FR is remembered for the next visit (no other script needed on most pages)
    `document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('a[data-lang]');` +
    `if(t)try{localStorage.setItem('lang',t.dataset.lang)}catch(x){}})})()</script>`;
  const lines = [
    redirect,
    `<link rel="canonical" href="${url}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(page.path, l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${absUrl(page.path, 'en')}">`,
    `<meta property="og:type" content="${page.generated === 'guide' || page.generated === 'model' ? 'article' : 'website'}">`,
    ...(page.generated === 'guide' ? [`<meta property="article:modified_time" content="${page.lang[lang].meta.updated}">`] : []),
    ...(page.generated === 'model' ? [`<meta property="article:modified_time" content="${MODEL_UI[lang].updated}">`] : []),
    `<meta property="og:site_name" content="${esc(cfg.org.name)}">`,
    `<meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_GB'}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${BASE}/${og.src}">`,
    `<meta property="og:image:width" content="${og.width}">`,
    `<meta property="og:image:height" content="${og.height}">`,
    `<meta property="og:image:alt" content="${esc(og.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ];
  return '\n  ' + lines.join('\n  ') + jsonLd(page, lang, html);
}

function langSwitch(page, lang) {
  const names = { en: 'English', fr: 'Français' };
  const link = (l) => `<a href="${urlPath(page.path, l)}" hreflang="${l}" lang="${l}" data-lang="${l}" aria-label="${names[l]}"` +
    (l === lang ? ' aria-current="true"' : '') + `>${l.toUpperCase()}</a>`;
  return `\n          <div class="lang" role="group" aria-label="Language">${LANGS.map(link).join('')}</div>`;
}

// ---- pages ------------------------------------------------------------------------------------------------------

const GENERATED = (file) => `<!-- Generated by tools/build.mjs from ${file}: edit that page or i18n/fr.json, then run node tools/build.mjs. -->\n`;

// GitHub Pages runs Jekyll on this repository: it skips dotfiles and everything listed here, so only the built site is
// served (no Markdown, tools, notes or config). Pages and assets have no front matter, so Jekyll copies them as they
// are. Any other Markdown or script file fails the build.
const UNPUBLISHED = ['README.md', 'CLAUDE.md', 'tools', 'i18n', 'site.config.json', 'vag-scope/CHANGELOG.md',
  'vag-scope/privacy_en.md', 'vag-scope/privacy_fr.md', 'vag-scope/adapters.json', 'vag-scope/models.json'];
const unpublished = (rel) => UNPUBLISHED.some((u) => rel === u || rel.startsWith(u + '/'));
(function checkUnpublished(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name).replace(/^\.\//, '');
    if (e.name.startsWith('.') || unpublished(rel)) continue;
    if (e.isDirectory()) checkUnpublished(rel);
    else if (/\.(md|mjs|py|sh|yml|yaml)$/.test(e.name) && rel !== '_config.yml') errors.push(`${rel}: would be published; move it or add it to UNPUBLISHED`);
    else if (AUDIT && rel.endsWith('.html') && rel !== '404.html') OUT.set(rel, read(rel));
  }
})('.');

if (!AUDIT) {
for (const page of ALL) {
  const src = page.generated ? null : read(page.path).replace(/^<!-- Generated by[^\n]*\n/, '');
  for (const lang of LANGS) {
    let html = page.generated ? renderGenerated(page, lang) : src;
    if (lang === 'fr') html = localizeUrls(translate(html, page.path), page.path);
    if (page.md) {
      // a release still in preparation ("## Unreleased" in the app's changelog) is not published before it ships
      const md = read(page.md.replace('{lang}', lang)).replace(/^## Unreleased\b[\s\S]*?(?=^## |(?![\s\S]))/m, '');
      html = region(html, 'md', '\n' + renderMd(md), page.path);
    }
    if (page.adapters) {
      const ui = lang === 'fr' ? { view: 'Voir sur ', aff: 'Lien affilié' } : { view: 'View on ', aff: 'Affiliate link' };
      html = region(html, 'adapters', readJson(page.adapters).map((a) => `
        <li class="adapter">
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.note[lang] || a.note.en)}</p>
          <div class="adapter-sellers">${a.sellers.map((x) =>
            `<a class="ghost" href="${esc(x.url)}" rel="${x.affiliate ? 'sponsored ' : ''}noopener noreferrer">${ui.view}${esc(x.name)}</a>` +
            (x.affiliate ? `<span class="adapter-tag">${ui.aff}</span>` : '')).join('')}</div>
        </li>`).join(''), page.path);
    }
    html = stores(html, lang);
    html = waitlistLinks(html, page, lang);
    html = region(html, 'lang', langSwitch(page, lang), page.path);
    html = region(html, 'head', head(page, lang, html), page.path);
    const from = page.generated === 'guide' ? `the guide ${page.slug} (vagscope_growth)`
      : page.generated === 'model' ? `vag-scope/models.json (${page.slug})`
      : page.generated === 'models' ? 'vag-scope/models.json'
      : page.generated ? 'the guides' : page.path;
    if (lang === 'fr' || page.generated) html = html.replace(/^<!doctype html>\n/i, (d) => d + GENERATED(from));
    write(outFile(page.path, lang), html);
  }
}

// ---- sitemap, robots, llms ---------------------------------------------------------------------------------------

write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  ALL.flatMap((p) => LANGS.map((lang) => '  <url>\n    <loc>' + absUrl(p.path, lang) + '</loc>\n' +
    (p.generated === 'guide' ? `    <lastmod>${p.lang[lang].meta.updated}</lastmod>\n` : p.generated === 'model' ? `    <lastmod>${MODEL_UI[lang].updated}</lastmod>\n` : '') +
    LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${absUrl(p.path, l)}"/>\n`).join('') +
    '  </url>\n')).join('') + '</urlset>\n');

write('_config.yml', '# Written by tools/build.mjs (UNPUBLISHED): what GitHub Pages must not serve.\n' +
  'exclude:\n' + UNPUBLISHED.map((p) => `  - ${p}\n`).join(''));

write('robots.txt', `# Every crawler is welcome, AI assistants included.\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

function pageInfo(file, lang) {
  const html = read(outFile(file, lang));
  return { title: text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || ''),
    desc: text((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '') };
}
if (!CHECK || !changed.length) {
  write('llms.txt', `# ${cfg.app.name}\n\n> ${cfg.app.description.en}\n\n` +
    cfg.llms.facts.map((f) => `- ${f}`).join('\n') + '\n\n## Pages\n\n' +
    [...cfg.pages, ...(MODELS.length ? [{ path: 'vag-scope/models/index.html' }] : [])].map((p) => { const i = pageInfo(p.path, 'en'); return `- [${i.title}](${absUrl(p.path, 'en')}): ${i.desc}`; }).join('\n') +
    (GUIDES.length ? '\n\n## Guides\n\n' + GUIDES.map((g) =>
      `- [${g.lang.en.meta.title}](${absUrl(g.path, 'en')}): ${text(inlineMd(g.lang.en.meta.answer))}`).join('\n') : '') +
    (MODEL_PAGES.length ? '\n\n## Compatible models (flagship guides)\n\n' + MODEL_PAGES.map((m) =>
      `- [${m.brand} ${m.model} (${(m.codes || []).slice(0, 2).join('/')}, ${m.years})](${absUrl(m.path, 'en')}): ${m.platform}, ${MODEL_UI.en.proto[m.protocol]}. ${m.sfd ? 'Offline reads/scans work; online SFD unlock not supported.' : 'Full offline read & coding, no SFD lock.'}`).join('\n') : '') +
    '\n\n## En français\n\n' +
    PAGES.filter((f) => !/^vag-scope\/models\/[^/]+\/index\.html$/.test(f)).map((f) => { const i = pageInfo(f, 'fr'); return `- [${i.title}](${absUrl(f, 'fr')}): ${i.desc}`; }).join('\n') + '\n');
}

}

// ---- page audit -------------------------------------------------------------------------------------------------
// What search engines and AI crawlers read: one h1, no skipped heading level, unique titles and descriptions,
// self-canonical, reciprocal hreflang, valid JSON-LD, alt text, and internal links that resolve to published files.

const seenTitles = new Map(), seenDescs = new Map();
for (const [file, html] of OUT) {
  if (!file.endsWith('.html')) continue;
  const bad = (m) => errors.push(`${file}: ${m}`);
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) bad(`${h1} h1 elements (one expected)`);
  let prev = 1;
  for (const m of html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<h([1-6])\b/g)) {
    const lvl = +m[1];
    if (lvl > prev + 1) bad(`heading jumps from h${prev} to h${lvl}`);
    prev = lvl;
  }
  const title = text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '');
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  if (seenTitles.has(title)) bad(`same title as ${seenTitles.get(title)}`); else seenTitles.set(title, file);
  if (seenDescs.has(desc)) bad(`same description as ${seenDescs.get(desc)}`); else seenDescs.set(desc, file);
  const page = ALL.find((p) => outFile(p.path, file.startsWith('fr/') ? 'fr' : 'en') === file);
  if (page) {
    const lang = file.startsWith('fr/') ? 'fr' : 'en';
    if (!html.includes(`<html lang="${lang}"`)) bad(`html lang is not ${lang}`);
    if (!html.includes(`<link rel="canonical" href="${absUrl(page.path, lang)}">`)) bad('canonical is not this page');
    for (const l of LANGS) if (!html.includes(`hreflang="${l}" href="${absUrl(page.path, l)}"`)) bad(`no hreflang ${l}`);
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { bad('invalid JSON-LD'); }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) bad('image without alt');
  const dir = '/' + path.posix.dirname(file).replace(/^\.$/, '');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const v = m[1];
    if (/^([a-z]+:|\/\/|#)/i.test(v)) continue;
    let p = (v.startsWith('/') ? v : path.posix.join(dir, v)).replace(/[?#].*$/, '');
    if (p.endsWith('/')) p += 'index.html';
    p = p.replace(/^\//, '');
    const published = !unpublished(p);
    if (!published || (!OUT.has(p) && !fs.existsSync(path.join(ROOT, p)))) bad(`broken or unpublished link ${v}`);
  }
}

// ---- brand guard ------------------------------------------------------------------------------------------------

// SHA-256 of lower-case terms that must never be published (see the private growth repo for the list).
const DENIED = new Set([
  '2bdb5dde4c31eb84dac74d3541e41205813b0090d38f24780a5143700dd8a126',
  '78f53320274a73a59d2dee1644d1ecd2ef5ad8172577644fa05cbf54a8946bb6',
  '9f46acc5c8e6e97b6bf22fb16ad0315ae5d1f569b4cacaa0ebf9fc0bdf68c900',
  'd05a06e99107447e41988703d4c907603a825b3a918f4b94e046890b1e123788',
  '176a7538d96f45b263cc5f9a5c1c9dadb5818b4deaf10eb1cbe66598a6de31e3',
]);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function scan(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory()) { scan(rel); continue; }
    if (!/\.(html|md|js|mjs|json|txt|xml|css|svg)$/.test(e.name)) continue;
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // no e-mail address is ever published (spam); the contact form assembles its address at send time
    if (rel !== 'tools/build.mjs' && /[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-z]{2,}/i.test(body.replace(/@(media|font-face|keyframes|supports|import|context|type|id|graph)\b/g, ''))) {
      errors.push(`${rel}: contains an e-mail address`);
    }
    const words = (body.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g)) || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const forms = [w, w.replace(/-/g, ''), ...w.split('-')];
      if (i + 1 < words.length) forms.push(w + '-' + words[i + 1], w + words[i + 1]);
      if (forms.some((f) => DENIED.has(sha(f)))) { errors.push(`${rel}: contains a denied brand name ("${w}")`); break; }
    }
  }
}
scan('.');

// ---- report -----------------------------------------------------------------------------------------------------

if (errors.length) { console.error(errors.map((e) => 'build: ' + e).join('\n')); process.exit(1); }
if (CHECK && changed.length) {
  console.error('build: out of date, run node tools/build.mjs:\n' + changed.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
if (changed.length) console.log(changed.join('\n'));
