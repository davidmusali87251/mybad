# Project inconsistencies report

Checked folder: `C:\Users\sd_mu\mistake-tracker` (SlipUp app).  
**Last updated:** Feb 2026.

---

## Resolved (previous report)
- **"I can't tell"** — Now has handler: `quickAdd(getSelectedType())`.
- **Reflections key** — Now mode-specific: `mistake-tracker-reflections-inside` vs `mistake-tracker-reflections`.
- **SlipUp Inside table** — Documented in README (shared_stats_inside SQL).
- **Service worker** — terms.html, refund.html, inside.html included. config.js removed from pre-cache to avoid install fail when missing.
- **GitHub Actions PayPal** — Workflow includes PAYPAL_CLIENT_ID, PAYPAL_HOSTED_BUTTON_ID.

---

## Current issues

### 1. **Resolved — UI elements now implemented**
- **micro-goal-section** — Saves intention per day; evaluates vs today's stats (e.g. "under 3 avoidable", "one fertile").
- **insights-section** — weekly-digest, day-vs-average, time-of-day, top-patterns, more-patterns all populated.
- **btn-share-image** — Downloads PNG of current stats.
- **add-to-home-banner** — Shows when PWA-installable; dismiss saves to localStorage.
- **reminder-checkbox** — Saves preference; requests Notification permission; schedules 8pm daily reminder.

---

## Documentation

### 2. **README live demo URL**
- README links to `davidmusali87251.github.io/mybad`; CNAME is `www.slipup.io`. Consider aligning or noting mybad as legacy demo.

---

## Minor (safe as-is)
- **app.js** references `btn-quick-avoidable`, `btn-quick-fertile`, `btn-quick-observed`, `btn-repeat-last` which do not exist in HTML. Code guards with `if (btn)` so no runtime error.
