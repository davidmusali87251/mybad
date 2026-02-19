# SlipUp — Project Audit Report

**Date:** Feb 16, 2026  
**Scope:** Issues, inconsistencies, Web vs PWA coherence, styles, deployment

---

## Executive summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | ✓ Fixed |
| Moderate | 4 | ✓ Fixed |
| Minor | 5 | Optional / doc updates |

---

## 1. Critical ✓ Fixed

### 1.1 Deploy workflow missing `SUPABASE_INTENTIONS_TABLE`

**Location:** `.github/workflows/main.yml` (config generation step)

**Issue:** The workflow builds `config.js` from repository secrets but did **not** include `SUPABASE_INTENTIONS_TABLE`.

**Status:** ✓ Fixed. Added `SUPABASE_INTENTIONS_TABLE` to env and config object. README deploy secrets list updated.

---

## 2. Moderate ✓ Fixed

### 2.1 README "How to run" — missing npm

**Status:** ✓ Fixed. README now lists `npm run serve` (port 3333) as the project default.

### 2.2 SW registration — landing.html registers service worker

**Status:** ✓ Documented. Reports (INCONSISTENCIES-REPORT, ISSUES-AND-COHERENCE-REPORT) updated to note that landing registers the SW so PWA install can be triggered from the landing page.

### 2.3 project-context.mdc — SW cache strategy typo

**Status:** ✓ Fixed. Doc now correctly states `cache: 'no-store'` for HTML fetch.

### 2.4 First `:has()` selector without stylelint-disable

**Status:** ✓ Fixed. stylelint-disable comment added above the insight-weekly-digest `:has()` rule in styles.css.

---

## 3. Minor / Optional

### 3.1 Asset version in reports

**Status:** INCONSISTENCIES-REPORT and ISSUES-AND-COHERENCE-REPORT mention `?v=15` and `slip-track-v15`. Current code uses `?v=16` / `slip-track-v16`. No functional impact; reports are just outdated.

### 3.2 Font loading differences

| Page | DM Sans | JetBrains Mono |
|------|---------|----------------|
| index, inside | Full (ital + wght) | Yes |
| landing | Full (ital + wght) | No |
| privacy, terms, refund | No italic | No |

Legal/landing pages don’t need monospace. Acceptable as-is.

### 3.3 Legal pages top bar

Legal pages (privacy, terms, refund) use a reduced top bar (SlipUp | mood | + Add) without the bell or slip-ups button. This is intentional. They use inline scripts for theme only, not `app.js`.

### 3.4 inside.html + Add href

`inside.html` has `+ Add` linking to `index.html`. `app.js` uses `preventDefault` and scrolls to `#main` on the current page. If JS fails, the user would navigate to index. Minor edge case; acceptable.

### 3.5 Color consistency

Type colors are consistent: `--avoidable #c99a7a`, `--fertile #6ba88a`, `--observed #8b9bb8` in `styles.css` and `app.js` line chart. No drift.

---

## 4. Web vs PWA coherence

| Check | Result |
|-------|--------|
| theme-color (meta + manifest) | `#14141a` across all pages ✓ |
| config.js never cached | SW skips config.js ✓ |
| Add-to-home banner | Shown in browser, hidden in standalone ✓ |
| Note tooltip | Custom (PWA-safe) ✓ |
| Offline: add/view entries | localStorage works ✓ |
| Offline: sharing / intentions | Skipped when offline ✓ |
| HTML fetch strategy | Network-first (`cache: 'no-store'`) ✓ |
| CSS/JS fetch strategy | Cache-first (versioned URLs) ✓ |

No Web vs PWA coherence issues found.

---

## 5. Style audit

| Item | Status |
|------|--------|
| `:has()` usage | 8 instances; one has stylelint-disable |
| CSS variables (type colors) | Consistent with app.js hex values |
| Duplicate/conflicting rules | None found |
| Linter | No reported errors |

---

## 6. Recommendations

1. **Immediate:** Add `SUPABASE_INTENTIONS_TABLE` to the deploy workflow config generation.
2. **Soon:** Update README with `npm run serve`.
3. **Optional:** Correct project-context.mdc SW cache wording; update reports if landing SW registration is intentional.
4. **Optional:** Add stylelint-disable above the L630 `:has()` rule if your tooling flags it.

---

*Generated from full project scan. Existing INCONSISTENCIES-REPORT and ISSUES-AND-COHERENCE-REPORT remain valid for their scope; this audit supplements them.*
