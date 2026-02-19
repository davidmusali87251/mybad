# State events table — what to run and update

## 1. Supabase (run once)

- Open your project in **Supabase** → **SQL Editor** → **New query**.
- Copy the full contents of **`supabase-state-events.sql`** (from `create table` to the end of the last `create policy` line).
- Paste and click **Run**.
- Then run **`supabase-state-events-add-columns.sql`** (adds `source`, `session_id`, `extra`). The app sends these on every event.
- In **Table Editor**, set schema to **public** and confirm **state_events** appears.

You only need to **re-run** this if you delete the table or change the schema.

---

## 2. Config (update for local use)

- Open **`config.js`** (copy from `config.example.js` if you don’t have it).
- Set at least:
  - `SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co'`
  - `SUPABASE_ANON_KEY: 'eyJ...'`
- Optional: `SUPABASE_STATE_EVENTS_TABLE: 'state_events'`  
  (the app already defaults to `state_events` if this is empty.)

Save the file. No need to change anything else for state events.

---

## 3. Run the app (local)

From the project folder:

```bash
npm run serve
```

or:

```bash
npm start
```

Open the URL (e.g. http://localhost:3333), use the app (switch tabs, add entry, share, change filters, etc.). Each action sends an event; new rows appear in **state_events** in Supabase.

---

## 4. Deploy (GitHub Actions)

If you deploy via GitHub Actions:

- In the repo: **Settings** → **Secrets and variables** → **Actions**.
- Add secret **`SUPABASE_STATE_EVENTS_TABLE`** with value **`state_events`** (optional; the workflow default is already `state_events`).
- Push to `main` or re-run the workflow. No code change needed.

---

## Summary

| Step              | What to do                                      |
|-------------------|-------------------------------------------------|
| **Supabase**      | Run `supabase-state-events.sql` once in SQL Editor. |
| **config.js**     | Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.     |
| **Local app**     | `npm run serve` then use the app in the browser. |
| **Deploy**        | Add secret `SUPABASE_STATE_EVENTS_TABLE` if you want it explicit; then push or re-run workflow. |

You don’t need to run any new script or re-run the SQL unless the table is missing or you changed the schema.
