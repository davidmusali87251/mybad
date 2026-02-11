# Project inconsistencies report

Checked folder: `C:\Users\sd_mu\mistake-tracker` (SlipUp app).

---

## Critical / functional

### 1. **"I can't tell" button has no handler**
- **Where:** `index.html` and `inside.html` both have `<button id="btn-cant-tell" class="btn-quick">I can't tell</button>`.
- **Issue:** `app.js` never calls `getElementById('btn-cant-tell')` or attaches a click listener. The button does nothing.
- **Fix:** Add a click handler that adds one entry with the currently selected type and an empty note (e.g. call `quickAdd(getSelectedType())`).

### 2. **Reflections key shared between Personal and Inside**
- **Where:** `app.js` line 102: `const REFLECTIONS_KEY = 'mistake-tracker-reflections';`
- **Issue:** Both personal (index.html) and SlipUp Inside (inside.html) use the same localStorage key. Reflections are conceptually different (avoidable/fertile vs heat/shift & support). Using both modes on the same browser mixes or overwrites data.
- **Fix:** Use a mode-specific key, e.g. `MODE === 'inside' ? 'mistake-tracker-reflections-inside' : 'mistake-tracker-reflections'`.

### 3. **SlipUp Inside Supabase table not documented**
- **Where:** `app.js` uses `shared_stats_inside` when `MODE === 'inside'`. README only documents `shared_stats` and `shared_what_happened`.
- **Issue:** If someone enables sharing and then uses SlipUp Inside, sharing will fail until they create `shared_stats_inside`.
- **Fix:** In README, add a short section or SQL snippet for creating `shared_stats_inside` (same structure as `shared_stats`) and enabling RLS.

---

## Documentation / copy

### 4. **README live demo URL**
- **Where:** README.md line 7: `**Live demo:** [https://davidmusali87251.github.io/mybad/](...)`
- **Issue:** CNAME is `www.slipup.io`. Demo link points to a different repo/path (`mybad`). May be intentional (legacy) or wrong.
- **Fix:** Point to `https://www.slipup.io` if that is the canonical live site, or add a note that mybad is the demo repo.

### 5. **Landing footer vs app footer**
- **Where:** `landing.html` footer: "Refunds" · …; `index.html` / `inside.html` footer: "Refund policy".
- **Issue:** Wording inconsistency (Refunds vs Refund policy).
- **Fix:** Use "Refund policy" everywhere for consistency.

### 6. **ARCHITECTURE.md data model**
- **Where:** ARCHITECTURE.md says mistake type is `avoidable | fertile`.
- **Issue:** App supports three types: `avoidable`, `fertile`, `observed`.
- **Fix:** Update doc to include `observed`.

---

## Deployment / PWA

### 7. **Service worker cache missing pages**
- **Where:** `sw.js` STATIC_ASSETS lists `index.html`, `landing.html`, `privacy.html`, etc.
- **Issue:** `terms.html`, `refund.html`, and `inside.html` are not in the list. They won’t be cached for offline.
- **Fix:** Add `'./terms.html'`, `'./refund.html'`, `'./inside.html'` to STATIC_ASSETS.

### 8. **GitHub Actions config.js does not include PayPal**
- **Where:** `.github/workflows/main.yml` builds `config.js` with empty `PAYPAL_CLIENT_ID` and `PAYPAL_HOSTED_BUTTON_ID`.
- **Issue:** config.example.js and README mention PayPal; the deploy workflow never passes PayPal secrets, so the deployed site can’t show the PayPal button even if secrets are set.
- **Fix:** In the workflow, add `PAYPAL_CLIENT_ID` and `PAYPAL_HOSTED_BUTTON_ID` from `secrets` when building `config.js`, and document the optional secrets in README.

---

## Minor (safe as-is)

- **app.js** references `btn-quick-avoidable`, `btn-quick-fertile`, `btn-quick-observed`, `btn-repeat-last` which don’t exist in the current HTML. Code guards with `if (btn)` so no runtime error; those are optional quick-add buttons that could be added to the UI later.
