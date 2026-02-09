# How to enable sharing (easy steps)

The app says: *"Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js to enable sharing"*.  
Do this:

---

## Step 1: Get a free Supabase account

1. Open: **https://supabase.com**
2. Click **Start your project**
3. Sign up (email or GitHub) and sign in

---

## Step 2: Create a project (if you don’t have one)

1. Click **New project**
2. Pick an organization (or create one)
3. **Name:** e.g. `slipup`  
4. **Database password:** choose one and **save it** somewhere safe  
5. Click **Create new project** and wait 1–2 minutes

---

## Step 3: Copy your URL and key

1. In the left menu, click the **gear icon** (Settings)
2. Click **API**
3. On that page you’ll see:
   - **Project URL** — something like `https://abcdefghijk.supabase.co`  
     → **Copy** that whole URL
   - **Project API keys** — find the row that says **anon** and **public**  
     → Click **Reveal** and **Copy** that long key (starts with `eyJ...`)

---

## Step 4: Put them into config.js

1. Open the file **config.js** in your project (same folder as index.html)
2. Find these two lines:
   - `SUPABASE_URL: '',`
   - `SUPABASE_ANON_KEY: '',`
3. Paste your values **between the quotes**:
   - Paste the **Project URL** where it says `SUPABASE_URL: ''`
   - Paste the **anon key** where it says `SUPABASE_ANON_KEY: ''`
4. Save the file

Example (with fake values):

```js
SUPABASE_URL: 'https://abcdefghijk.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...',
```

---

## Step 5: Create the database tables (one time)

Supabase needs a few tables for sharing. In the app’s **README.md** there is a section with SQL. Do this once:

1. In Supabase, left menu → **SQL Editor**
2. Click **New query**
3. Copy the SQL from README (the part that creates `shared_stats`, `shared_entries`, etc.)
4. Paste into the editor and click **Run**

---

## Done

Reload your app in the browser. The message about SUPABASE_URL and SUPABASE_ANON_KEY should go away, and sharing will work.

---

**If you don’t want sharing:**  
You can leave `config.js` as it is. The app works without it; only the “share” / “others’ results” features need these two values.
