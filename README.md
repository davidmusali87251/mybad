# Mistake Tracker

A simple web app to count and track mistakes by **day**, **week**, and **month**.

## Features

- **Add mistakes** — One tap to log; optional short note (e.g. what happened).
- **View by period** — Switch between **Today**, **This week**, and **This month**.
- **Stats** — See total count for the selected period and average per day.
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
  created_at timestamptz default now()
);

alter table shared_stats enable row level security;
create policy "Allow anonymous insert" on shared_stats for insert with check (true);
create policy "Allow anonymous select" on shared_stats for select using (true);
```

3. Go to **Settings → API**. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key — the long JWT that starts with `eyJ...` (under "Project API keys"). Do **not** use a key that looks like `sb_publishable_...`; that is not the anon key.
4. Open `config.js` and set:

```js
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // anon public key (long JWT)
};
```

5. Serve the app over HTTP (e.g. `npx serve .` or `python -m http.server 8080`). If you open `index.html` via `file://`, some features may not work.
6. Reload the app. You’ll see **Share my result** and **Others' results**; sharing is anonymous (no account, no name).
