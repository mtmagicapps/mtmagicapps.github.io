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
const cfg = readJson('site.config.json');
const FR = readJson('i18n/fr.json');
const BASE = cfg.url.replace(/\/$/, '');
const LANGS = ['en', 'fr'];
const changed = [];
const errors = [];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function readJson(p) { return JSON.parse(read(p)); }
function write(p, content) {
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

const PAGES = cfg.pages.map((p) => p.path);
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
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
      const name = text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '').split(' | ')[0];
      out.push({ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: cfg.app.name, item: absUrl('vag-scope/index.html', lang) },
        { '@type': 'ListItem', position: 2, name, item: absUrl(page.path, lang) }] });
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
  // Runs before the first paint: a remembered EN/FR choice, or a French browser on its first visit, opens the right
  // copy. Without a remembered choice it only ever goes towards French, so crawlers (English, no storage) stay put.
  const alts = JSON.stringify(Object.fromEntries(LANGS.map((l) => [l, urlPath(page.path, l)])));
  const redirect = `<script>(function(){var a=${alts},l=document.documentElement.lang,s;try{s=localStorage.getItem('lang')}` +
    `catch(e){}var w=s||(/^fr/i.test(navigator.language||'')?'fr':l);if(w!==l&&a[w])location.replace(a[w]+location.hash)})()</script>`;
  const lines = [
    redirect,
    `<link rel="canonical" href="${url}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(page.path, l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${absUrl(page.path, 'en')}">`,
    `<meta property="og:type" content="website">`,
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

for (const page of cfg.pages) {
  const src = read(page.path).replace(/^<!-- Generated by[^\n]*\n/, '');
  for (const lang of LANGS) {
    let html = lang === 'fr' ? localizeUrls(translate(src, page.path), page.path) : src;
    if (page.md) {
      const md = read(page.md.replace('{lang}', lang));
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
    html = region(html, 'lang', langSwitch(page, lang), page.path);
    html = region(html, 'head', head(page, lang, html), page.path);
    if (lang === 'fr') html = html.replace(/^<!doctype html>\n/i, (d) => d + GENERATED(page.path));
    write(outFile(page.path, lang), html);
  }
}

// ---- sitemap, robots, llms ---------------------------------------------------------------------------------------

write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  cfg.pages.flatMap((p) => LANGS.map((lang) => '  <url>\n    <loc>' + absUrl(p.path, lang) + '</loc>\n' +
    LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${absUrl(p.path, l)}"/>\n`).join('') +
    '  </url>\n')).join('') + '</urlset>\n');

write('robots.txt', `# Every crawler is welcome, AI assistants included.\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

function pageInfo(file, lang) {
  const html = read(outFile(file, lang));
  return { title: text((/<title[^>]*>([\s\S]*?)<\/title>/.exec(html) || [])[1] || ''),
    desc: text((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '') };
}
if (!CHECK || !changed.length) {
  write('llms.txt', `# ${cfg.app.name}\n\n> ${cfg.app.description.en}\n\n` +
    cfg.llms.facts.map((f) => `- ${f}`).join('\n') + '\n\n## Pages\n\n' +
    PAGES.map((f) => { const i = pageInfo(f, 'en'); return `- [${i.title}](${absUrl(f, 'en')}): ${i.desc}`; }).join('\n') +
    '\n\n## En français\n\n' +
    PAGES.map((f) => { const i = pageInfo(f, 'fr'); return `- [${i.title}](${absUrl(f, 'fr')}): ${i.desc}`; }).join('\n') + '\n');
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
