# Volumen — volumen.media

Bilingual (EN/ES) music-photography site for Reinaldo Ramirez (Austin, TX). Noir,
cinematic, single-page portfolio + a contact page. Live at https://volumen.media
(also volumenmag.netlify.app), hosted on **Netlify**, auto-deployed from `main`.

## Stack
- Static HTML/CSS/JS, **no build step**. Each page is self-contained (inline `<style>` + `<script>`).
- GSAP + Lenis (smooth scroll) via CDN on the homepage.
- **Netlify Functions** (Node, ESM) + **Netlify Blobs** for the likes backend.
- Fonts: Bebas Neue (display), Inter (body), Space Mono (labels/UI).

## Key files
- `index.html` — the homepage (the "noir" redesign; the single source of truth for the
  main page). Amp-switch intro, hero, gallery (Flow/Grid toggle), lightbox, Community
  Picks + Photo of the Week, hamburger menu.
- `contact.html` — noir contact page (press/booking; working Formspree form `maqlbbnv`).
- `netlify/functions/likes.mjs` — likes + Photo-of-the-Week backend (Netlify Blobs).
- `netlify.toml` — `publish="."`, functions dir, clean-URL + 404 redirects,
  `/landing-noir.html → /` 301, cache/security headers, `NODE_VERSION=20`.
- `photos/` — web-optimized JPEGs (~1600px). Camera originals (`DSC_*`, `Untitled-*`) are gitignored.

## Design system (homepage tokens — match these on any new page)
`--black #050505 · --ink #ededed · --quiet #6c6c6c · --line #1c1c1c · --red #bf2d1f · --pad clamp(18px,4vw,48px)`

## Conventions
- **Bilingual:** every user-facing string has `data-en`/`data-es`; `setLang()` swaps
  `innerHTML`; choice persists in `localStorage['volumen-lang']`.
- **Photo key** = filename stem (e.g. `photos/singer-bw.jpg` → `"singer-bw"`). The
  allowlist in `likes.mjs` MUST stay in sync with the gallery `<figure>`s in `index.html`.
- **Likes:** global counts in Blobs (store `volumen-likes` in prod, `volumen-likes-preview`
  on deploy previews — split by request host). Strong-consistency reads. Per-photo "liked"
  flag is `localStorage['volumen-liked']` (one like per browser). Counts self-clean to `{}` at zero.
- **Photo of the Week** = this week's (Monday, UTC) most-liked, falling back to last week →
  all-time → a default frame.

## Workflow
- Work on branch `landing-minimal`; open a PR to `main`; Netlify auto-deploys `main` to production.
- **Verify on the deploy preview** before merging — it runs functions/Blobs. The local
  `python -m http.server` can't run functions, so the frontend degrades gracefully offline.
- After merge, confirm on https://volumen.media.

## Notes / gotchas
- `pit-video.html` has a pre-existing uncommitted local edit that is NOT part of recent work — leave it unless asked.
- Photo of the Week resets weekly in **UTC** (flips ~Sat evening Austin time).
- Older pages (`home.html`, `editorial.html`, `interviews.html`, `events.html`) use a
  separate older red+gold aesthetic with shared `styles.css`/`main.js` — the noir system
  above applies to `index.html` and `contact.html`.
