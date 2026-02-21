# SlipUp

© 2026 SlipUp. All rights reserved.

A simple web app to count and track mistakes by **day**, **week**, and **month**.

**Live:** [https://www.slipup.io](https://www.slipup.io)

Design and constraints are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Product roadmap

- **Phase 1 – Personal** ✓  
  Error log, classification (Avoidable / Fertile / Observed), automatic reflection, simple statistics (counts, exploration index, streaks, trends, week-over-week).

- **Phase 2 – Social** (first version live; expanding)  
  View anonymous entries and shared stats from others, category “Observed” (patterns in others/the system), collective comparison (your exploration vs recent shares), social trend summary.

## Features

- **Add mistakes** — One tap to log; optional short note (e.g. what happened).
- **View by period** — Switch between **Today**, **This week**, and **This month**.
- **Stats** — See total count for the selected period, average per day, and **exploration index** (fertile ÷ total).
- **Your trends** — Separate curves for avoidable (goal ↓) and fertile (goal ↔ or ↑) over the last 7 days.
- **Automatic reflection** — A short, rule-based summary of the day’s mistakes (no AI, just your counts).
- **Recent entries** — List of recent mistakes with time/date.
- **Persistent** — Data is stored in your browser (localStorage).
- **Share anonymously** — Share your current period stats so anyone can see (no account, no name).
- **Others' results** — See recent anonymous shares from all users.

### SlipUp Inside (groups)

SlipUp Inside reuses the same app shell but switches copy and stats to fit **group check‑ins** (e.g. units, programs):

- **Heat / Shift / Support** instead of Avoidable / Fertile / Observed.
- **Shift index** instead of exploration index (shift ÷ (heat + shift)).
- Anonymous sharing uses the same `shared_what_happened` table with `mode = 'inside'`, plus a separate `shared_stats_inside` table for group stats (see SQL above).
- The mood system is the same (calm, focus, stressed, curious, tired), and reflections + entries are stored separately per mode on the same browser.
- **Group management** — Run `supabase-inside-groups.sql` first, then `supabase-inside-groups-admin.sql` for edit name, member list, remove/leave. Run `supabase-community-entries-inside.sql` for the shared entries table. Run `supabase-group-mode-upgrade.sql` for participation tracking, invite preview, activity feed, streaks, and moderator role.

## How to run

1. Open `index.html` in your browser (double-click or drag into Chrome/Edge/Firefox).

Or run a local server from the folder:

```bash
# npm (project default)
npm run serve
# → http://localhost:3333

# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then go to `http://localhost:3333` (npm) or `http://localhost:8080` (or the port shown).

No install required for local use. For **sharing** and **viewing others' results**, set up Supabase once (free) below.

### Install as app (PWA)

When the app is served over **HTTPS** (e.g. on GitHub Pages), you can install it like an app:

- **Desktop (Chrome/Edge):** Open the app → menu (⋮) → “Install SlipUp”.
- **Mobile (Android):** Open in Chrome → menu → “Add to Home screen” or “Install app”.
- **iOS (Safari):** Share → “Add to Home Screen”.

The app includes a `manifest.json` and a service worker (`sw.js`) so it can be installed and works better offline. **Note:** The PWA opens the personal tracker (`index.html`) by default. For SlipUp Inside, use `inside.html` via a direct link or bookmark. The SW never caches `config.js` so "Everyone's recent entries" and sharing work correctly when installed as a PWA.

### Cache busting (GitHub Pages deploys)

CSS and JS files use version params (e.g. `styles.css?v=12`, `app.js?v=12`) so browsers load fresh assets after each deploy. **Before pushing a major update**, run:

```bash
node bump-version.js
```

This bumps `?v=` in all HTML files and `CACHE_NAME` in `sw.js`. Optionally pass a version: `node bump-version.js 12`.

---

## Enable anonymous sharing (optional)

Sharing lets you **publish your current stats** and **see everyone else's shared results** (all anonymous).

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase dashboard: **SQL Editor** → run this:

```sql
create table shared_stats (
  id uuid default gen_random_uuid() primary key,
  period text not null,
  count int not null,
  avg_per_day float,
  created_at timestamptz default now(),
  anonymous_id text
);

-- One table for all "what happened" entries (personal + Inside); app filters by mode
create table shared_what_happened (
  id uuid default gen_random_uuid() primary key,
  note text,
  type text not null default 'avoidable',
  mode text not null default 'personal',
  theme text not null default 'calm',
  hour_utc smallint,
  created_at timestamptz default now()
);

alter table shared_stats enable row level security;
create policy "Allow anonymous insert" on shared_stats for insert with check (true);
create policy "Allow anonymous select" on shared_stats for select using (true);

alter table shared_what_happened enable row level security;
create policy "Allow anonymous insert" on shared_what_happened for insert with check (true);
create policy "Allow anonymous select" on shared_what_happened for select using (true);

-- Optional: for SlipUp Inside (group check-ins), create a separate stats table:
create table if not exists shared_stats_inside (
  id uuid default gen_random_uuid() primary key,
  period text not null,
  count int not null,
  avg_per_day float,
  created_at timestamptz default now(),
  anonymous_id text
);
alter table shared_stats_inside enable row level security;
create policy "Allow anonymous insert" on shared_stats_inside for insert with check (true);
create policy "Allow anonymous select" on shared_stats_inside for select using (true);
```

3. Go to **Settings → API**. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key — the long JWT that starts with `eyJ...` (under "Project API keys"). Do **not** use a key that looks like `sb_publishable_...`; that is not the anon key.
4. Create your local config (so your keys are not committed):
   - Copy `config.example.js` to `config.js`.
   - Open `config.js` and set your URL and anon key:

```js
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // anon public key (long JWT)
};
```

   `config.js` is in `.gitignore`, so it stays local and your keys are not pushed to the repo.

   **Deploy (GitHub Pages) — use secrets, no config.js in the repo:** The live site must **not** use a committed `config.js`. The workflow `.github/workflows/main.yml` builds `config.js` from **repository secrets** at deploy time. (1) In the repo: **Settings → Secrets and variables → Actions** → add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PAYMENT_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_HOSTED_BUTTON_ID`, `SUPABASE_STATS_TABLE`, `SUPABASE_ENTRIES_TABLE`, `SUPABASE_CHART_TABLE`, `SUPABASE_DAILY_SUMMARIES_TABLE`, `SUPABASE_STREAK_REFLECTIONS_TABLE`, `SUPABASE_STATE_EVENTS_TABLE`, `SUPABASE_INTENTIONS_TABLE`, `SUPABASE_TODAYS_REFLECTIONS_TABLE`. (2) **Settings → Pages** → Source: **GitHub Actions**. (3) Push to `main`/`master` or run the workflow from the Actions tab. The published site gets full sharing (and PayPal if those secrets are set); the repo never contains `config.js`.

5. Serve the app over HTTP (e.g. `npx serve .` or `python -m http.server 8080`). If you open `index.html` via `file://`, some features may not work.
6. Reload the app. You'll see **Share my result** and **Others' results**; sharing is anonymous (no account, no name).

### "Could not find the table 'public.shared_what_happened' in the schema cache"

The **Everyone's recent entries** feature uses the `shared_what_happened` table. If you set up Supabase before this was added, run this in **SQL Editor** (Dashboard → SQL Editor → New query):

```sql
create table if not exists shared_what_happened (
  id uuid default gen_random_uuid() primary key,
  note text,
  type text not null default 'avoidable',
  mode text not null default 'personal',
  theme text not null default 'calm',
  hour_utc smallint,
  created_at timestamptz default now()
);

alter table shared_what_happened enable row level security;
create policy "Allow anonymous insert" on shared_what_happened for insert with check (true);
create policy "Allow anonymous select" on shared_what_happened for select using (true);
```

Then reload the app. If you get "policy already exists", you can ignore it and just run the `create table` part.

### "column shared_stats.anonymous_id does not exist"

Add the column in **SQL Editor** (Dashboard → SQL Editor → New query). Run once:

```sql
alter table shared_stats add column if not exists anonymous_id text;
```

If you created `shared_what_happened` earlier without the `theme` column, add it once:

```sql
alter table shared_what_happened add column if not exists theme text not null default 'calm';
```

Then reload the app. After this, "Others' results" will group shares by anonymous user.

### "Couldn't sync: new row violates row-level security policy"

The app uses the **anon** key for inserts (no login). Supabase RLS must allow anonymous inserts. In **SQL Editor** (Dashboard → SQL Editor → New query), run:

```sql
drop policy if exists "Allow anonymous insert" on shared_what_happened;
drop policy if exists "Anon insert personal only" on shared_what_happened;
create policy "Allow anonymous insert" on shared_what_happened for insert to anon with check (true);

drop policy if exists "Allow anonymous select" on shared_what_happened;
drop policy if exists "Anon select personal only" on shared_what_happened;
create policy "Allow anonymous select" on shared_what_happened for select to anon using (true);
```

If you use `shared_entries_personal`, run `supabase-fix-rls-shared-entries.sql` instead (it fixes both tables).

### Using `shared_entries_personal` for the world feed

To use the `shared_entries_personal` table (instead of `shared_what_happened`):

1. The table must exist with columns: `id`, `note`, `type`, `theme`, `hour_utc`, `created_at`.
2. Enable RLS and add policies. Run in **SQL Editor**:

```sql
alter table shared_entries_personal enable row level security;
drop policy if exists "Anon insert personal" on shared_entries_personal;
create policy "Anon insert personal" on shared_entries_personal for insert to anon with check (true);
drop policy if exists "Anon select personal" on shared_entries_personal;
create policy "Anon select personal" on shared_entries_personal for select to anon using (true);
```

3. In `config.js`, set:

```js
SUPABASE_ENTRIES_TABLE_PERSONAL: 'shared_entries_personal'
```

4. Reload the app. The world feed will read from and write to `shared_entries_personal`.

### Richer Others' results (optional type breakdown)

To show avoidable/fertile/observed breakdown and exploration % in "Others' results", run `supabase-shared-stats-breakdown.sql` in **SQL Editor**. This adds `avoidable_count`, `fertile_count`, `observed_count` to `shared_stats` and `shared_stats_inside`. New shares will include the breakdown; existing rows stay as before.

To show **most mood** (e.g. "mostly tired") in Recent shares, run `supabase-shared-stats-top-theme.sql` in **SQL Editor**. This adds `top_theme` to both tables. New shares will include the dominant mood from the period; existing rows stay as before.

### Global counting chart table (`shared_chart_counts`)

The **Avoidable ↓ · Fertile ↔ or ↑** chart in "Everyone's recent entries" aggregates counts from shared entries. To store these in a dedicated Supabase table (for dashboards, reporting, or future use), run the script:

1. In Supabase: **SQL Editor** → **New query**
2. Open `supabase-global-chart.sql` from this project and paste its contents
3. Run the query

This creates:

- **`shared_chart_counts`** — `mode`, `window_size` (10 or 50), `avoidable`, `fertile`, `observed`, `total`, `updated_at`
- A trigger on `shared_what_happened` that keeps the table in sync when entries are added or removed
- RLS allowing anonymous **select** only (writes happen via the trigger)

The app still derives chart data from the entries list. The table is available for direct queries or future optimization.

**State events (optional)** — To log each possible state element (phase, filters, views, actions) with an anonymous ID (short types, for analytics or dashboards), run `supabase-state-events.sql` in **SQL Editor**. Then set `SUPABASE_STATE_EVENTS_TABLE: 'state_events'` in config (or the same name as repo secret). The table has `anonymous_id`, `kind`, `value`, `mode`, `created_at`; the app can call `logStateEvent(kind, value)` to record events.

### Group "Others' results" by same anonymous user

To group shared stats by anonymous user (one row per person, still no names), add the column and run once in **SQL Editor**:

```sql
alter table shared_stats add column if not exists anonymous_id text;
```

The app will then send a per-browser anonymous ID when sharing and group results by it in the UI.

### Social tab or phase tabs not working (web, PWA, iOS, Android)

If the Social tab does nothing when clicked, or tabs work only in an incognito/private window, the app is likely using **stale cached JavaScript** from an older deploy.

**Quick fixes:**
1. **Click the Refresh button** — If you see a "New version available" banner, click **Refresh** to load the latest version.
2. **Hard refresh** — Desktop: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac). Mobile: Close the tab and reopen, or clear site data.
3. **Unregister the service worker** — DevTools → Application → Service Workers → Unregister, then reload.
4. **Click the SlipUp brand** (top-left) on index — This forces an update check and reload when a new version is available.

After deploy, the app shows "New version available" when a Service Worker update is waiting. Use that banner to reload and fix Social/phase tabs.

### Sharing works in the app but Supabase tables don't update

If the app shows "Shared anonymously" or no errors but rows don't appear in the Supabase dashboard:

1. **Check you're looking at the same project.** The app uses `SUPABASE_URL` and `SUPABASE_ANON_KEY` from config (or from GitHub Secrets when deployed). Open the Supabase project that matches that URL (e.g. `https://YOUR_REF.supabase.co`). If the live site uses different secrets, data is in that project, not the one you're viewing.
2. **Check table names.** Personal app writes to `shared_stats` and `shared_what_happened`. SlipUp Inside writes to `shared_stats_inside` and the same `shared_what_happened` (with `mode = 'inside'`). Create any missing tables (see SQL above).
3. **Check RLS.** In Supabase: **Table Editor** → select the table → **Policies**. You need policies that allow **INSERT** and **SELECT** for anonymous users (e.g. "Allow anonymous insert" and "Allow anonymous select" with `true`).
4. **Use the browser console.** When you click "Share my result" or add a mistake, errors are logged with `SlipUp: share stats failed` or `SlipUp: shared_what_happened insert failed`. Open DevTools (F12) → **Console** to see the exact Supabase error (e.g. missing table, RLS violation, wrong key).

### Using your own table names (e.g. daily_summaries, shared_entries)

If your Supabase project already has tables like `daily_summaries` and `shared_entries`, set them in config:

```js
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
  SUPABASE_STATS_TABLE: 'daily_summaries',   // for "Share my result" / Others' results
  SUPABASE_ENTRIES_TABLE: 'shared_entries'    // for "Everyone's recent entries"
};
```

**Required columns** (names must match exactly):

- **Stats table** (e.g. `daily_summaries`): `id` (uuid, optional default), `period` (text), `count` (int), `avg_per_day` (float), `created_at` (timestamptz, optional default `now()`), `anonymous_id` (text).
- **Entries table** (e.g. `shared_entries`): `id` (uuid, optional default), `note` (text), `type` (text), `mode` (text), `hour_utc` (smallint), `created_at` (timestamptz, optional default `now()`).

Enable RLS and add policies that allow anonymous **insert** and **select** on both tables (same as in the SQL above for `shared_stats` / `shared_what_happened`).

### "Failed: Unregistered API key"

This means Supabase doesn't recognize the key you're using. Fix it by:

- **Use the anon key, not the service role.** In the browser you must use the **anon public** key. Never put `service_role` or a secret key in config (local `config.js` or repo Secrets).
- **Get the key from the right place.** In the dashboard go to **Settings → API**. Use the **anon** key from the **Legacy API Keys** tab (the long JWT starting with `eyJ...`). If you use a Publishable key (`sb_publishable_...`) and see this error, switch to the legacy anon key.
- **Same project.** The key must belong to the project whose URL you set. Check that `SUPABASE_URL` matches the project where you copied the key.
- **Exact value.** Paste the key with no extra spaces, newlines, or quotes. Don't rotate or revoke the key without updating your local `config.js` or the repo Secrets. You’ll see **Share my result** and **Others' results**; sharing is anonymous (no account, no name).
