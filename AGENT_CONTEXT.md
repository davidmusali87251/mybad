## SlipUp – Agent Context

This file exists to give future AI agents enough context to work on this project quickly and safely.

### What this project is

- **Name**: SlipUp  
- **Type**: Client-side web app (static HTML/CSS/JS)  
- **Purpose**: Track mistakes/moments by **day/week/month**, classify as **Avoidable / Fertile / Observed** (or **Heat / Shift / Support** in group mode), and encourage daily reflection.  
- **Tech stack**:
  - Static HTML: `index.html` (personal), `inside.html` (groups / “SlipUp Inside”), `landing.html`, `privacy.html`
  - Vanilla CSS (`styles.css`)
  - Vanilla JavaScript (`app.js`) – no framework; same script for both apps, mode set by `window.SLIPUP_MODE` before loading
  - Optional Supabase backend for anonymous sharing
  - Deployed via GitHub Pages at `https://www.slipup.io`

### Two apps, one codebase

- **Personal** (`index.html`): `window.SLIPUP_MODE` is unset or `'personal'`. Wording: mistakes, avoidable/fertile/observed, exploration index.
- **Inside** (`inside.html`): `window.SLIPUP_MODE = 'inside'` is set before `app.js`. Wording: moments, heat/shift/support, shift index. Same data model and storage; Supabase uses separate tables for Inside (see below).

### Key user flows

- **Landing (`landing.html`)**  
  - Drives visitors to open the app. Copy focuses on what SlipUp does, how to use it in 30 seconds, and what you see inside. CTAs: “Start now — open the app” / “Open SlipUp” → `index.html`. Link to SlipUp Inside (groups).

- **Main app (personal: `index.html` / Inside: `inside.html`)**  
  - Add entries with optional note and **type**: avoidable (or heat), fertile (or shift), observed (or support).  
  - View stats by period: **Today / This week / This month** (count, avg/day, exploration or shift index).  
  - **Trends**: 7‑day bar chart (avoidable vs fertile / heat vs shift).  
  - **Stats chart**: Line chart for last 14 days (avoidable, fertile, observed, total) – chart only, no table. One chart per app.  
  - **“What we noticed” (insights section)**:
    - **Today**: today’s count vs 7‑day average; short line (e.g. “Slightly busier than usual”).  
    - **When you log**: morning / afternoon / night breakdown for current period.  
    - **Repeating notes**: notes logged more than once in the period (top 3).  
    - **More patterns**: 10 pattern lines rendered as **chips** (e.g. weekday with most avoidable, weekend vs weekday avg, peak hour, dominant type per day, streaks, empty-note rate, note length by type, last 7 vs previous 7, observed share). Empty blocks are hidden.  
  - Progress: “This week vs last week” cards.  
  - Recent entries list with type filter and CSV export.  
  - Reflection: two text areas (avoidable/heat and fertile/shift), auto‑reflection from today’s counts.  
  - Premium: free = 10 entries (`FREE_ENTRY_LIMIT`); full version = $5 one‑time, unlimited entries.

### Persistence & data model

- **Local storage** (browser; same keys for both apps when same origin):
  - `mistake-tracker-entries` → array of `{ at, note, type, scope }`.
  - `mistake-tracker-reflections` → daily reflection text.
  - `mistake-tracker-unlocked` → `"true"` when full version unlocked.
  - `mistake-tracker-anon-id` → UUID for anonymous sharing.

### Backend / Supabase (optional)

- Config: `window.MISTAKE_TRACKER_CONFIG` from `config.js` (git‑ignored). Keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`; optional payment keys.
- **Tables by mode**:
  - Personal: `shared_stats`, `shared_entries`
  - Inside: `shared_stats_inside`, `shared_entries_inside`
- In `app.js`, `STATS_TABLE` and `ENTRIES_TABLE` are set from `MODE` (`'inside'` → `*_inside` tables). All share/fetch logic uses these.
- **Others’ results**: list is limited to **5** items (`MAX_OTHER_RESULTS = 5` in `fetchSharedStats`).
- README documents SQL and RLS for creating the `*_inside` tables.

### Main code touchpoints (`app.js`)

- **MODE**: `'personal'` | `'inside'` from `window.SLIPUP_MODE`.
- **TYPE_PHRASES / getTypeLabel()**: mode‑aware labels (e.g. Heat/Shift/Support for Inside).
- **filterByPeriod()**, **getDayCountsLastN(n)** (avoidable + fertile only), **getDayCountsLastNFull(n)** (adds observed, total, exploration %) – used for stats chart and insights.
- **renderStats()**, **renderTrends()**, **renderStatsTableAndLineChart()** (line chart only), **renderAdditionalInsights(filtered)** (Today, When you log, Repeating notes, **getMorePatternLines()** → chips).
- Share/fetch: **pushEntryToShared**, **fetchSharedStats**, **fetchSharedEntries** use `STATS_TABLE` and `ENTRIES_TABLE`.

### Design & constraints

- See `ARCHITECTURE.md` and `README.md` for product/UX detail.
- Theme in `styles.css` (CSS variables): `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--danger`, etc. Keep consistent.
- No framework: stick to plain HTML/CSS/JS.
- Insights section uses `.insights-section`, `.insight-block`, `.insight-label`, `.insight-text`, `.insight-chips`, `.insight-chip`. Empty insight blocks get `.hidden` in JS.

### Deployment / domains

- GitHub Pages from repo `davidmusali87251/mybad`.
- Live: `https://www.slipup.io` (custom domain; CNAME `www` → `davidmusali87251.github.io`).

### Guidelines for future agents

- **Before editing**: read `README.md`, `ARCHITECTURE.md` (if present), and relevant parts of `app.js` for data and UI.
- **UX/wording**: Keep voice calm, reflective, non‑shaming. Reduce avoidable/heat, keep fertile/shift. Prefer short, focused copy.
- **Landing**: Keep main CTA “open the app”; avoid heavy business/monetization; keep meta aligned with “log → see patterns → change behavior”.
- **Inside vs personal**: When adding features, consider both modes and use MODE / getTypeLabel() and the correct Supabase tables.
