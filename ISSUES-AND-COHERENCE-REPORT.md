# Issues & Web/PWA Coherence Report

**Date:** Feb 2026 (updated)  
**Scope:** Issue types, lint errors, web vs PWA consistency

---

## 1. Lint / CSS issues

| Location | Issue | Severity |
|----------|-------|----------|
| `styles.css` — various | `:has()` selectors — some linters flag this (CSS L4, newer syntax) | Minor |

**Details:** Multiple rules use `:has()` (e.g. `.insight-block:not(:has(...))`, `.type-pill:has(...)`, `.entry-item:has(...)`). Valid in modern browsers but can confuse older CSS parsers/linters.

**Status:** stylelint-disable comments added above the two rules that hide empty `.insight-label` margins (insight-weekly-digest and general insight-block). Other `:has()` rules typically pass; treat any remaining lint warnings as acceptable.

---

## 2. Web vs PWA coherence

### 2.1 Meta & manifest

| Check | Status |
|-------|--------|
| `theme-color` meta | All HTML: `#14141a` — consistent |
| `manifest.json` theme_color | `#14141a` — matches |
| `apple-mobile-web-app-*` | index, inside, landing, privacy, terms, refund — present |
| `viewport-fit=cover` | All pages — present |

### 2.2 Service worker

| Check | Status |
|-------|--------|
| SW registration | index.html, inside.html, landing.html |
| Scope | `./` (full origin) |
| config.js | Never cached — always fetched fresh |
| Cache name | Set automatically on deploy: workflow runs `bump-version.js` with run number so each deploy gets a unique version. No manual bump needed. |

**Note:** Landing registers the SW so PWA install can be triggered from the landing page. Legal pages (privacy, terms, refund) do not. When the user installs from index, the SW controls the origin. When opened from the installed app, those pages are still served by the SW. Behavior is coherent.

### 2.3 Top bar structure

| Page | Top bar content | Notes |
|------|-----------------|-------|
| index.html | [bell] SlipUp \| slipups, mood, + Add | Full app bar |
| inside.html | [bell] SlipUp \| slipups, mood, + Add | Same as index |
| privacy, terms, refund | SlipUp \| mood, + Add | No bell, no slipups |
| landing.html | No top bar | Hero layout only |

Legal pages use a reduced bar on purpose. PWA users land on index first (start_url).

### 2.4 Add-to-home banner

| Condition | Behavior |
|-----------|----------|
| Display mode | Shown only when not `standalone` |
| PWA install | Not shown (standalone) |
| Web browser | Shown after 2s if install is possible |

Coherent: no banner in PWA, banner in browser.

### 2.5 PWA-specific behavior

| Feature | Implementation |
|---------|----------------|
| Note tooltip | Custom tooltip because native `title` is unreliable in standalone |
| Touch targets | Period tabs use `min-height: 44px` for taps |

### 2.6 Asset versioning

| Asset | Version param | SW precache |
|-------|---------------|-------------|
| styles.css | `?v=N` (bumped on deploy) | `./styles.css?v=N` ✓ |
| app.js | `?v=N` (bumped on deploy) | `./app.js?v=N` ✓ |
| config.js | `?v=N` | Not cached |

Precache URLs match HTML requests. The deploy workflow runs `node bump-version.js ${{ github.run_number }}` so you don't need to run it before deploy. Full DOM/SW/web-vs-PWA audit: **INCONSISTENCIES-REPORT.md**.

### 2.7 PWA vs Web feature parity

| Feature | Web | PWA (standalone) | Coherent |
|---------|-----|-------------------|----------|
| Add mistake/entry | ✓ | ✓ | Yes |
| Micro-goal, Share intention (Inside) | ✓ | ✓ | Yes |
| Shared intentions fetch | ✓ (when online) | ✓ (when online) | Yes |
| Sharing / Supabase | ✓ (config.js fresh) | ✓ (config.js never cached) | Yes |
| Add-to-home banner | Shown (if PWA-capable) | Hidden (already installed) | Yes |
| Note tooltip | Native title unreliable | Custom tooltip | Yes |
| Top bar slip-ups button | ✓ | ✓ | Yes |
| Export CSV/JSON/reflections | ✓ (gated by paid) | ✓ (gated by paid) | Yes |
| Reminder (8pm) | ✓ (Notification API) | ✓ (Notification API) | Yes |
| Offline | Add/view entries (localStorage) | Same | Yes |
| Offline sharing | Skipped (navigator.onLine check) | Same | Yes |

### 2.8 Page-to-PWA navigation

| From | To | Via | Works in PWA |
|------|-----|-----|--------------|
| index | inside | phase tab link | Yes (SW serves inside.html) |
| inside | index | brand / + Add href | Yes (+ Add: href="#main", brand: inside.html) |
| landing | index | CTA | Yes |
| legal (privacy, terms, refund) | index | top bar links | Yes (SW serves from cache/network) |

### 2.9 Web vs PWA issues (SlipUp Inside)

| Issue | Web | PWA | Mitigation |
|-------|-----|-----|------------|
| **Group storage** | sessionStorage cleared on tab close | sessionStorage cleared when PWA killed → user sees gate again | **Fixed:** Use localStorage so group choice persists across PWA reopens |
| **Magic link auth (iOS)** | Opens in Safari, session in Safari storage | PWA has isolated storage on iOS → no shared session | Prefer **password sign-in** in PWA; magic link may require re-login if opened in browser |
| **Magic link auth (Android)** | Same as Web | PWA shares storage with browser | Works |
| **Manifest start_url** | N/A | Opens `index.html` (personal) | Inside users: bookmark or open `inside.html` directly after install |
| **auth-inside.html SW** | N/A | Now registers SW for consistency | Ensures auth page is served by SW when reached from PWA |

---

## 3. Page type matrix

| Page | Manifest | SW reg | app.js | Top bar | Mode |
|------|----------|--------|--------|---------|------|
| index.html | ✓ | ✓ | ✓ | Full | personal |
| inside.html | ✓ | ✓ | ✓ | Full | inside |
| auth-inside.html | — | ✓ | — | Minimal | — |
| landing.html | ✓ | ✓ | — | None | — |
| privacy.html | ✓ | — | — | Minimal | — |
| terms.html | ✓ | — | — | Minimal | — |
| refund.html | ✓ | — | — | Minimal | — |

---

## 4. Findings summary

### Strengths

- Theme and colors aligned between manifest and HTML
- config.js never cached so Supabase works correctly
- Add-to-home banner only shown in browser
- Custom note tooltip for PWA
- DOM and app.js refs consistent (see INCONSISTENCIES-REPORT.md)

### Minor gaps

1. ~~**SW precache:** Uses unversioned paths~~ **Resolved:** STATIC_ASSETS now use versioned paths.
2. ~~**CSS linter:** `:has()` triggers parser warnings~~ **Addressed:** stylelint-disable comment added; treat as acceptable.
3. **Legal pages top bar:** No settings icon — intentional and acceptable.

### Recommendations

1. No need to run bump-version before deploy; the workflow does it automatically (version = run number).
2. Leave CSS `:has()` as is unless you need to support older tools.
3. ~~(Optional) Use versioned paths in `STATIC_ASSETS`~~ **Done:** sw.js STATIC_ASSETS use `./styles.css?v=N` and `./app.js?v=N`; bump-version.js updates them on bump.
