# How to develop SlipUp

A practical guide to run, change, and ship the site.

---

## 1. Run locally

No build step. Open the app in a browser or use a local server:

```bash
# Option A: open directly
# Double-click index.html or drag it into Chrome/Firefox

# Option B: local server (recommended; avoids some CORS/localStorage quirks)
python -m http.server 8080
# or
npx serve .
```

Then open **http://localhost:8080** (or the port shown). Use:

- **http://localhost:8080/index.html** — Personal app  
- **http://localhost:8080/inside.html** — SlipUp Inside (groups)  
- **http://localhost:8080/landing.html** — Landing page  
- **http://localhost:8080/privacy.html** — Privacy policy  

---

## 2. Key files (where to change what)

| Goal | File(s) |
|------|--------|
| **UI structure (personal app)** | `index.html` |
| **UI structure (groups)** | `inside.html` |
| **Landing / marketing** | `landing.html` |
| **Privacy text** | `privacy.html` |
| **All styling** | `styles.css` (variables at top: `--accent`, `--bg`, etc.) |
| **Logic, data, rendering** | `app.js` (one codebase; mode from `window.SLIPUP_MODE`) |
| **Config (Supabase, payment)** | `config.js` (create from `config.example.js`; not in git) |
| **PWA / install** | `manifest.json`, `sw.js` |

Both apps use the **same** `app.js`. Mode is set in the HTML before the script:

- `index.html`: no `SLIPUP_MODE` → personal (mistakes, avoidable/fertile/observed).  
- `inside.html`: `<script>window.SLIPUP_MODE = 'inside';</script>` before `app.js` → groups (moments, heat/shift/support).

When you add a feature, check both `index.html` and `inside.html` if the UI is shared; in `app.js` use `MODE === 'inside'` when wording or tables differ.

---

## 3. Adding features

- **New UI only:** Add HTML in the right page(s), add classes/ids, style in `styles.css`.  
- **New behavior:** In `app.js` add DOM refs (e.g. `getElementById`), then functions and event listeners. Prefer one place that runs on load (e.g. where `renderStats()` is called) so everything stays in sync.  
- **New data:** Prefer `localStorage` with a key (see `STORAGE_KEY`, `REFLECTIONS_KEY`, `MICRO_GOAL_KEY` in `app.js`). Keep one JSON object or array per key.  
- **Backend:** Only Supabase is used (optional). Tables: `shared_stats` / `shared_entries` (personal) and `shared_stats_inside` / `shared_entries_inside` (Inside). See README for SQL and RLS.

**Product ideas** are in **CONCEPT_NEXT_LEVEL.md** (streaks, weekly digest, share-as-image, themes, reminders, etc.). Many are already implemented; the rest are a good backlog.

**Guidelines:**

- Keep the loop: **log → see patterns → reflect**. New features should support it.  
- Voice: calm, non-shaming, “mirror not judge.”  
- No framework: stay with vanilla HTML/CSS/JS so the site stays simple and fast.

---

## 4. Deployment (GitHub Pages)

1. Push the repo to GitHub (e.g. `davidmusali87251/mybad`).  
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` (or `master`) → folder **/ (root)**.  
3. Custom domain (optional): set **www.slipup.io** in Pages; in your DNS add a CNAME for `www` → `davidmusali87251.github.io`.

After each push to that branch, the site updates in a minute or two. No build step.

---

## 5. Optional: Supabase (sharing & others’ results)

1. Sign up at [supabase.com](https://supabase.com), create a project.  
2. Copy `config.example.js` to `config.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.  
3. In Supabase SQL Editor, run the table creation scripts from **README.md** (for both personal and Inside tables).  
4. Leave `config.js` out of git (it’s in `.gitignore`).

Without `config.js`, the app still runs; sharing and “Others’ results” are disabled.

---

## 6. Quick checklist before shipping

- [ ] Test **index.html** and **inside.html** (add entry, change period, check insights, reflection, share if enabled).  
- [ ] Test **landing.html** and **privacy.html** (links, theme toggle).  
- [ ] Bump cache if needed: e.g. `app.js?v=5` in HTML so returning users get new JS.  
- [ ] If you changed Supabase tables or RLS, run the SQL and test share/fetch.

---

## 7. Where to read more

- **README.md** — Product overview, Supabase setup, PWA install.  
- **AGENT_CONTEXT.md** — For AI/agents: data model, MODE, main functions.  
- **CONCEPT_NEXT_LEVEL.md** — Product directions and next-level ideas.
