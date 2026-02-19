# SlipUp — Project audit: issues, inconsistencies, web vs PWA, personal vs Inside

**Date:** Feb 2026  
**Scope:** Issues, inconsistencies, unusual style, web vs PWA, personal vs Inside mode

---

## 1. Critical issues

### 1.1 auth-inside.html — version drift

| Item | auth-inside.html | Rest of project |
|------|------------------|-----------------|
| styles.css | `?v=22` | `?v=42` |
| config.js | `?v=23` | `?v=42` |
| inside-auth.js | `?v=23` | inside.html uses `?v=42` |

**Impact:** Auth page may load stale CSS/JS. `bump-version.js` does not include `auth-inside.html` in `HTML_FILES`.

**Fix:** Add `auth-inside.html` to `HTML_FILES` in `bump-version.js` and run `node bump-version.js` to align versions.

---

## 2. Personal vs Inside — terminology inconsistencies

### 2.1 "mistakes" vs "slip-ups" vs "moments"

| Location | Personal | Inside | Issue |
|----------|----------|--------|-------|
| getPeriodLabel() | slip-ups | moments | ✓ Consistent |
| renderProgress() noun | **mistakes** | moments | ❌ Personal should use "slip-ups" |
| updateSocialToShare() | **mistakes** | moments | ❌ Personal should use "slip-ups" |
| getExplorationSoWhat() | "fertile mistakes" | (transformed) | Intentional in copy |
| CSV export filename | mistakes.csv | slipup-inside-mistakes.csv | Acceptable |
| index.html empty-state | "No mistakes logged" | — | Could align to "slip-ups" for consistency |

**Fix:** In `app.js` line 983 (renderProgress) and line 2178 (updateSocialToShare), change personal noun from `'mistakes'` to `'slip-ups'`.

### 2.2 index.html empty-state (static HTML)

- **Current:** "No mistakes logged yet. Add one above."
- **Suggestion:** "No slip-ups logged yet. Add one above." for brand alignment (or leave as-is; JS does not overwrite this).

---

## 3. Web vs PWA

### 3.1 Asset versioning

| Asset | index/inside | auth-inside | sw.js precache |
|-------|--------------|-------------|----------------|
| styles.css | v=42 | v=22 | v=42 |
| app.js | v=42 | — | v=42 |
| config.js | v=42 | v=23 | Not cached ✓ |
| inside-auth.js | v=42 | v=23 | — |

**Summary:** auth-inside.html is the only outlier.

### 3.2 Service worker

- ✓ config.js never cached
- ✓ HTML network-first
- ✓ CSS/JS cache-first with versioned URLs
- ✓ manifest start_url `./index.html`

### 3.3 PWA-specific behavior

- ✓ Add-to-home banner hidden in standalone
- ✓ Note tooltip (native title unreliable in standalone)
- ✓ Touch targets (44px) for period tabs

---

## 4. DOM / structure

### 4.1 Top bar + Add

| Page | top-bar-add href | aria-label |
|------|------------------|------------|
| index.html | index.html | Add mistake |
| inside.html | #main | Add moment |

**Note:** index uses `href="index.html"`; inside uses `href="#main"`. Both use `preventDefault()` in JS to scroll to #main — so inside stays on same page, index also stays (same origin). Coherent.

### 4.2 Social view (index only)

- stat-label-social: initial HTML "mistakes today" — overwritten by getPeriodLabel → "slip-ups today". ✓

### 4.3 Missing from bump-version

- `auth-inside.html` not in HTML_FILES array.

---

## 5. Style / UX coherence

### 5.1 Exploration info tips

- ✓ Stats card: "Exploration" + ? tooltip
- ✓ Inside stats: "Shift" + ? tooltip
- ✓ Weekly digest: "50% exploration" + ? tooltip
- ✓ Progress cards: "50% exploration" + ? tooltip

### 5.2 Period hint

- ✓ index + inside: "See what repeats. Pick your lens."

### 5.3 Stat labels

- ✓ Personal: "slip-ups today", "per day", "Exploration"
- ✓ Inside: "moments today", "per day", "Shift"

---

## 6. Unusual or edge cases

### 6.1 inside.html — phase tabs

- Project context says: "inside: Group (button) | Social (button)". Inside has Social? Needs verification — Inside may have a simplified phase structure (Group only in some flows).

### 6.2 Bias check panel

- index & inside: "Why do you see this as a mistake?" — generic; Inside transforms to "moment" in auto-reflection. Minor; could add Inside-specific copy.

### 6.3 Manifest description

- "Count & reflect on mistakes by day, week, month" — could say "slip-ups" for brand alignment; low priority.

---

## 7. Recommended fixes (prioritized)

1. ~~**High:** Add auth-inside.html to bump-version.js and run bump to align v=42.~~ **DONE**
2. ~~**Medium:** Change renderProgress noun and updateSocialToShare noun from "mistakes" to "slip-ups" for personal mode.~~ **DONE**
3. ~~**Low:** Update index.html empty-state to "No slip-ups logged yet" for consistency.~~ **DONE**
4. **Low:** Update manifest.json description to use "slip-ups" if desired (optional).

---

## 8. Resolved / no action needed

- DOM ↔ JS refs match
- config.js never cached (PWA)
- Personal vs Inside terminology in getPeriodLabel, stats insight, progress diff, exploration — mostly aligned
- Web vs PWA behavior coherent
