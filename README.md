# SlipUp

© 2026 Selim David Musali. All rights reserved.

A simple web app to count and track mistakes by **day**, **week**, and **month**.

**Live demo:** [https://davidmusali87251.github.io/mybad/](https://davidmusali87251.github.io/mybad/)

Design and constraints are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Product roadmap

- **Phase 1 – Personal** ✓  
  Error log, classification (Avoidable / Fertile / Observed), automatic reflection, simple statistics (counts, exploration index, streaks, trends, week-over-week).

- **Phase 2 – Social** (in progress)  
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

## How to run

1. Open `index.html` in your browser (double-click or drag into Chrome/Edge/Firefox).

Or run a local server from the folder:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then go to `http://localhost:8080` (or the port shown).

No install required for local use. For **sharing** and **viewing others' results**, set up Supabase once (free) below.

### Install as app (PWA)

When the app is served over **HTTPS** (e.g. on GitHub Pages), you can install it like an app:

- **Desktop (Chrome/Edge):** Open the app → menu (⋮) → “Install SlipUp”.
- **Mobile (Android):** Open in Chrome → menu → “Add to Home screen” or “Install app”.
- **iOS (Safari):** Share → “Add to Home Screen”.

The app includes a `manifest.json` and a service worker (`sw.js`) so it can be installed and works better offline.

---

## Enable anonymous sharing (optional)

Sharing lets you **publish your current stats** and **see everyone else's shared results** (all anonymous).

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase dashboard: **SQL Editor** → run this for the main SlipUp app (personal mode):

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
  hour_utc smallint,
  created_at timestamptz default now()
);

alter table shared_stats enable row level security;
create policy "Allow anonymous insert" on shared_stats for insert with check (true);
create policy "Allow anonymous select" on shared_stats for select using (true);

alter table shared_what_happened enable row level security;
create policy "Allow anonymous insert" on shared_what_happened for insert with check (true);
create policy "Allow anonymous select" on shared_what_happened for select using (true);
```

If you also use **SlipUp Inside** (`inside.html`, group mode), create the Inside stats table (entries already go into `shared_what_happened` with `mode = 'inside'`):

```sql
create table shared_stats_inside (
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

**Optional – analytics events (for you only)**  
To count how often users click the $5 button, “I've paid — unlock”, and first visit, create one table (same project, shared by personal and Inside):

```sql
create table slipup_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  mode text,
  anonymous_id text,
  created_at timestamptz default now()
);

alter table slipup_events enable row level security;
create policy "Allow anonymous insert" on slipup_events for insert with check (true);
create policy "Allow anonymous select" on slipup_events for select using (true);
```

Events sent: `purchase_button_clicked`, `unlock_button_clicked`, `first_visit`. No PII; you can query in Supabase (Table Editor or SQL) to see counts.

**Optional – analytics columns (for data analysis)**  
The app can send extra columns so you can analyse patterns (e.g. heat vs shift over time, when people log). If your tables already exist, run this once in **SQL Editor**:

```sql
-- Stats: breakdown and exploration %
alter table shared_stats
  add column if not exists avoidable_count int,
  add column if not exists fertile_count int,
  add column if not exists observed_count int,
  add column if not exists exploration_pct int,
  add column if not exists mode text;
alter table shared_stats_inside
  add column if not exists avoidable_count int,
  add column if not exists fertile_count int,
  add column if not exists observed_count int,
  add column if not exists exploration_pct int,
  add column if not exists mode text;

-- (Entries use shared_what_happened, which already has mode and hour_utc.)
```

After this, the app will send these fields on each share and on each shared entry. You can then run queries like “avg exploration_pct by week” or “entries by hour_utc”.

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

   **Deploying (e.g. GitHub Pages):** If you want the live site to use sharing, add a `config.js` with your Supabase URL and anon key to the deployed branch. The anon key is intended to be public; keeping it out of the repo is for cleanliness and so forks use their own project.

   **Protect config.js and still get full service on the live site:** This repo includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds `config.js` from **repository secrets** during deploy, so you never commit keys. Steps: (1) In the repo go to **Settings → Secrets and variables → Actions** and add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PAYMENT_URL`. (2) In **Settings → Pages** set Source to **GitHub Actions**. (3) Push to `main` or run the workflow manually. The published site will have full sharing and payment links; your repo stays without `config.js`.

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

Then reload the app. After this, "Others' results" will group shares by anonymous user.

### Group "Others' results" by same anonymous user

To group shared stats by anonymous user (one row per person, still no names), add the column and run once in **SQL Editor**:

```sql
alter table shared_stats add column if not exists anonymous_id text;
```

The app will then send a per-browser anonymous ID when sharing and group results by it in the UI.

### "Failed: Unregistered API key"

This means Supabase doesn't recognize the key you're using. Fix it by:

- **Use the anon key, not the service role.** In the browser you must use the **anon public** key. Never put `service_role` or a secret key in `config.js`.
- **Get the key from the right place.** In the dashboard go to **Settings → API**. Use the **anon** key from the **Legacy API Keys** tab (the long JWT starting with `eyJ...`). If you use a Publishable key (`sb_publishable_...`) and see this error, switch to the legacy anon key.
- **Same project.** The key must belong to the project whose URL you set. Check that `SUPABASE_URL` matches the project where you copied the key.
- **Exact value.** Paste the key with no extra spaces, newlines, or quotes. Don't rotate or revoke the key in the dashboard without updating `config.js`. You’ll see **Share my result** and **Others' results**; sharing is anonymous (no account, no name).
