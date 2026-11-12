# CLAUDE.md

Public website of mtmagicapps and VAG Scope, live on push to `main`. How it is built: `README.md`. The growth plan and
the tasks behind this site live in the private sibling `../vagscope_growth` (`AGENTS.md` there).

## Quality bar (mandatory)

Every change is held to it and checked in a browser before it is called done.

- **Performance**: screenshots through `srcset` (`tools/images.sh` makes the 400/800 variants) with `width`/`height`;
  only the hero images load eagerly; no layout shift; no third-party request, script, font or tracker; nothing shipped
  that a page does not use. Measure LCP and CLS on the page you changed.
- **SEO**: one `h1`; a unique title under 60 characters, keyword first, ending `| VAG Scope`; a description under 155
  characters; French copy through `i18n/fr.json` (never hand-edit `fr/`); internal links to and from new pages; every
  new page listed in `site.config.json`, so it gets canonical, hreflang, Open Graph and the sitemap.
- **GEO**: all text in the HTML, the direct answer first, the fixed product sentence and facts from `site.config.json`,
  structured data only for what the page shows (FAQ items are `<details data-faq>`).
- **UI**: the tokens and components of `assets/site.css`; checked at 375 px and 1280 px, in English and French, with no
  horizontal scroll; visible focus; reduced motion respected.
- **UX**: one primary action per screen; no control that looks usable but is not (badges say "Coming soon" until the
  store is live); every page reachable from a phone (footer links); honest wording, no promise of authenticity.
- **Privacy and guardrails**: no e-mail address and no denied brand name in any file (the build fails on both); no
  cookies, analytics or third-party requests.
