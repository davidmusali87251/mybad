## SlipUp – Agent Context

This file exists to give future AI agents enough context to work on this project quickly and safely.

### What this project is

- **Name**: SlipUp  
- **Type**: Client-side web app (static HTML/CSS/JS)  
- **Purpose**: Track mistakes/moments by **day/week/month**, classify as **Avoidable / Fertile / Observed** (or **Heat / Shift / Support** in group mode), and encourage daily reflection and a “mirror, not judge” relationship with mistakes.  
- **Tech stack**:
  - Static HTML: `index.html` (personal), `inside.html` (groups / “SlipUp Inside”), `landing.html`, `privacy.html`
  - Vanilla CSS (`styles.css`)
  - Vanilla JavaScript (`app.js`) – no framework; same script for both apps, mode set by `window.SLIPUP_MODE` before loading
  - Optional Supabase backend for anonymous sharing
  - Deployed via GitHub Pages at `https://www.slipup.io`
  - Project docs: `README.md` (setup + Supabase SQL), `ARCHITECTURE.md`, `CONCEPT_NEXT_LEVEL.md` (product direction), `HOW-TO-ENABLE-SHARING.md` (plain-English Supabase guide)

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
  - Entries:
    - Personal: `mistake-tracker-entries`
    - Inside: `mistake-tracker-entries-inside`
    - Shape: array of `{ at, note, type, scope }`.
  - Reflections:
    - Personal: `mistake-tracker-reflections`
    - Inside: `mistake-tracker-reflections-inside`
  - Unlock state:
    - Personal: `mistake-tracker-unlocked`
    - Inside: `mistake-tracker-unlocked-inside`
  - Anonymous ID:
    - Personal: `mistake-tracker-anon-id`
    - Inside: `mistake-tracker-anon-id-inside`
  - Micro-goal per day:
    - Personal: `mistake-tracker-micro-goal`
    - Inside: `mistake-tracker-micro-goal-inside`
  - Theme selection:
    - `mistake-tracker-theme` (values: `calm` | `focus` | `warm`)
  - Reminder opt-in:
    - Personal: `mistake-tracker-reminder`
    - Inside: `mistake-tracker-reminder-inside`
  - Misc:
    - `slipup_first_visit_sent`, `slipup-visited`, `slipup-dismiss-add-to-home` (used for one-time events and banners)

### Backend / Supabase (optional)

- Config: `window.MISTAKE_TRACKER_CONFIG` from `config.js` (git‑ignored). Keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`; optional payment keys.
- **Tables by mode**:
  - Personal: `shared_stats`, `shared_entries`
  - Inside: `shared_stats_inside`, `shared_entries_inside`
- In `app.js`, `STATS_TABLE` and `ENTRIES_TABLE` are set from `MODE` (`'inside'` → `*_inside` tables). All share/fetch logic uses these.
- **Others’ results**: list is limited to **5** items (`MAX_OTHER_RESULTS = 5` in `fetchSharedStats`).
- **Events**: optional `slipup_events` table is used for anonymous analytics events (`purchase_button_clicked`, `unlock_button_clicked`, `first_visit`), shared by both modes.
- `README.md` documents SQL and RLS for creating all Supabase tables (`shared_stats*`, `shared_entries*`, `slipup_events`), plus common migration fixes.

### Main code touchpoints (`app.js`)

- **MODE**: `'personal'` | `'inside'` from `window.SLIPUP_MODE`.
- **TYPE_PHRASES / getTypeLabel()**: mode‑aware labels (e.g. Heat/Shift/Support for Inside).
- **filterByPeriod()**, **getDayCountsLastN(n)** (avoidable + fertile only), **getDayCountsLastNFull(n)** (adds observed, total, exploration %) – used for stats chart and insights.
- **renderStats()**: core counts, avg/day, exploration/shift index, streak text (“X days in a row” / “Last log was N days ago”).
- **renderTrends()**, **renderStatsTableAndLineChart()** (line chart only), **renderAdditionalInsights(filtered)** (Today vs average, When you log, Repeating notes, **getMorePatternLines()** → 10 pattern chips).
- **Reflection & micro-goals**:
  - `renderReflection()`, `updateReflection()`, `renderYesterdayReflection()`, `generateAutoReflection()` / `renderAutoReflection()` implement the daily reflection loop.
  - `loadMicroGoal()`, `saveMicroGoal()`, `renderMicroGoal()`, `evaluateMicroGoal()` implement the “Today’s intention” + “You hit it / Tomorrow’s another day” micro-goal feature.
- **Sharing & community**:
  - `pushEntryToShared`, `getSupabase`, `shareAnonymously`, `fetchSharedStats`, `fetchSharedEntries`, `showCommunitySetupMessage`, `showCommunityEntriesSetupMessage` use `STATS_TABLE` and `ENTRIES_TABLE` and handle “Unregistered API key” and missing-table cases gracefully.

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
