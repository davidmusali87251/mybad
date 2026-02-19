# Project inconsistencies report

Checked folder: `C:\Users\sd_mu\mistake-tracker` (SlipUp app).  
**Last updated:** Feb 2026.

---

## Audit summary (current)

**No critical inconsistencies.** DOM ↔ JS refs match on both index and inside. + Add (top bar, community, empty state) is wired. Web and PWA behavior are coherent. The deploy workflow bumps asset version automatically (no need to run bump-version.js before deploy).

---

## 1. DOM ↔ JavaScript

| Check | Status |
|-------|--------|
| **app.js getElementById** | All refs exist in index.html or inside.html (shared IDs match on both). |
| **Dynamic elements** | `#streak-reflection-panel` and `#main` exist (panel created in JS; `#main` on add-section). |
| **Null-safe usage** | Code guards refs with `if (el)` before use where needed. |

No missing IDs; no dead refs.

---

## 2. Asset versions & service worker

| Item | Current | Notes |
|------|---------|--------|
| **HTML ?v=** | Set by bump-version.js / workflow | index, inside, landing, privacy, terms, refund |
| **sw.js CACHE_NAME** | `slip-track-vN` | Must match version in HTML |
| **sw.js STATIC_ASSETS** | `styles.css?v=N`, `app.js?v=N` | Precache list |
| **config.js** | Never cached | SW fetch handler skips config.js so PWA always gets fresh config |

**Action:** Not required manually. The deploy workflow runs `node bump-version.js ${{ github.run_number }}` so each deploy gets a unique version (run number). To bump locally (e.g. for testing): `node bump-version.js` or `node bump-version.js N`.

---

## 3. Web vs PWA coherence

### 3.1 Meta & manifest

| Check | Status |
|-------|--------|
| **theme-color (meta)** | `#14141a` on all 6 HTML pages |
| **manifest.json theme_color** | `#14141a` — matches |
| **manifest.json background_color** | `#14141a` |
| **viewport** | `width=device-width, initial-scale=1.0, viewport-fit=cover` on all pages |
| **apple-mobile-web-app-capable** | `yes` on all pages |
| **apple-mobile-web-app-status-bar-style** | `black-translucent` on all pages |
| **manifest link** | Present on index, inside, landing (legal pages use same meta set) |

### 3.2 Service worker

| Check | Status |
|-------|--------|
| **Registration** | index.html, inside.html, and landing.html (landing registers so PWA install can be triggered from there; legal pages do not) |
| **Scope** | `./` (full origin) |
| **config.js** | Never cached; always network fetch |
| **HTML strategy** | Network-first for HTML so updates apply without SW version bump |
| **CSS/JS strategy** | Cache-first (versioned URLs) |

When the user installs from index, the SW controls the origin. Legal and landing pages are still served by the SW when opened from the installed app. Coherent.

### 3.3 Top bar & + Add

| Page | Top bar | + Add (id="top-bar-add") |
|------|---------|---------------------------|
| index.html | SlipUp \| 🌍 slip-ups \| mood \| + Add | href="index.html"; JS preventDefault() → scroll to #main, focus input |
| inside.html | Same | href="index.html"; JS preventDefault() → scroll to #main, focus input |

On both pages, the click handler prevents navigation and scrolls to the add section on the **current** page. If JS failed to load, inside’s + Add would navigate to index (minor edge case).

### 3.4 Add-to-home banner

Shown when not already in standalone (PWA) mode. Dismissible; no inconsistency.

---

## 4. Index vs inside (intentional differences)

- **Copy:** mistakes vs moments, Share my result vs Share my period, etc.
- **shared-empty:** Initial HTML text differs; JS sets MODE-aware text on load.
- **Insights intro:** Different wording (entries vs check-ins, heat/shifts).

No bug; by design.

---

## 5. Minor (safe as-is)

- **Asset vs SW version** — Can drift by one until next `node bump-version.js` before deploy.
- **README “How to run”** — Resolved: README now documents `npm run serve` (port 3333).
- **Landing SW** — Landing registers the SW so PWA install can be triggered from the landing page. Legal pages do not; they still load correctly when reached from PWA (SW serves them from cache/network).

---

## 6. Resolved (previous)

- first-time-nudge, sharedEmpty (Inside), README demo URL
- Dead button refs removed; headline-stat, reflection-context-prompt wired
- config.example.js SUPABASE_DAILY_SUMMARIES_TABLE; manifest/README PWA note
- Cache busting; bump-version.js; skip links, tablist aria, #main
- + Add (top-bar-add, btn-add-from-community, empty-state) wired in app.js
