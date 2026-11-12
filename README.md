# mtmagicapps.github.io

Website of **mtmagicapps** and of the VAG Scope app, served by GitHub Pages from `main` (folder `/`).
Plain HTML, CSS and a little JavaScript; no cookies, no analytics, no third-party requests.

## Build

```bash
node tools/build.mjs           # after any change; prints the files it wrote
node tools/build.mjs --check   # fails if a generated file is out of date
node tools/build.mjs --audit   # audits the committed pages without the private sources (CI runs this)
```

Node 18 or later, no dependencies. Needs `../vagscope_growth` checked out next to this repository (guide sources).
The English pages listed in `site.config.json` are the sources. The build:

- writes the French copy of each page under `fr/` from `i18n/fr.json` (keys in `data-i18n`, `data-i18n-alt`,
  `data-i18n-content`; a missing key fails the build). Never edit `fr/` by hand.
- fills the `<!-- build:head -->` (canonical, hreflang, Open Graph, JSON-LD), `<!-- build:lang -->` (EN/FR links)
  and `<!-- build:md -->` (privacy policy, changelog) regions of the English pages in place.
- turns the store badges (`data-store`, `data-utm`) into links with a UTM campaign once `app.play.live` or
  `app.appStore.live` is set in `site.config.json`.
- writes `sitemap.xml`, `robots.txt` and `llms.txt` (facts from `site.config.json`).
- fails if any file contains a denied brand name (the list is hashed in the script).

GitHub Pages builds with Jekyll, which skips dotfiles and everything in `_config.yml` (generated from `UNPUBLISHED`
in the build): only pages and assets are served, never sources or notes.

The pre-commit hook runs the build and stages its output. Enable it once per clone:
`git config core.hooksPath .githooks`. It also copies `docs/CHANGELOG.md` and `privacy_{en,fr}.md` from
`../io.mtmagicapps.vagscope` into `vag-scope/`.

## Moving to a custom domain

Set `url` in `site.config.json`, add a `CNAME` file with the domain, run the build, then set the domain in the
repository's Pages settings. GitHub redirects the old `mtmagicapps.github.io` addresses to the new domain, so links
already printed in reports keep working.

## Files

- Guides: sources (drafts included) live in the private `../vagscope_growth/content/guides/<slug>.{en,fr}.md`, never in
  this public repository. Front matter: status (draft or published), title, seo_title, description, answer,
  published, updated. The build renders published ones into `tools/templates/page.html` at `/vag-scope/guides/<slug>/`,
  with a list page, article structured data and sitemap dates. Titles stop at 70 characters, descriptions at 160.
- `index.html`, `vag-scope/index.html`: the pages. `vag-scope/check/`: landing page for the QR code on shared reports.
- `assets/site.css`: styles. `assets/site.js`: language preference, car-screen carousel, mailto contact form.
- `vag-scope/adapters.json`: recommended adapters (name, EN/FR note, sellers with an affiliate flag), rendered by the
  build; affiliate links get `rel="sponsored"` and a visible label.
- `tools/images.sh`: 400/800 px variants of the phone screenshots. `tools/og-card.py`: the EN/FR link-preview cards
  (`assets/img/og-vag-scope-{en,fr}.jpg`).
- `assets/img/`: screenshots (WebP). `assets/fonts/`: Bricolage Grotesque and Figtree (SIL Open Font License).
