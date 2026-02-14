// Optional: set these to enable anonymous sharing & viewing others' results.
// FOR LOCAL USE ONLY. Do not commit config.js (it is in .gitignore).
// The deployed site (e.g. GitHub Pages) gets config from repository Secrets, not from this file.
//
// 1. Copy this file to config.js:  cp config.example.js config.js  (or copy-paste and save as config.js)
// 2. Get URL and anon key from Supabase: project → Settings → API.
//    - SUPABASE_URL: "Project URL" (e.g. https://xxxxx.supabase.co) — no trailing slash.
//    - SUPABASE_ANON_KEY: "anon" "public" key (long JWT starting with eyJ...). Same project as the URL.
// 3. Paste your values below.
//
// If you see "Invalid API key": URL and key must be from the same project; use anon key, not service_role; resume project if paused.
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Optional: use your own table names (defaults: shared_stats, shared_what_happened)
  SUPABASE_STATS_TABLE: '',      // e.g. 'daily_summaries' for "Share my result" / Others' results
  SUPABASE_ENTRIES_TABLE: '',    // e.g. 'shared_entries' for "Everyone's recent entries"
  SUPABASE_CHART_TABLE: '',    // Optional: 'shared_chart_counts' for global chart (run supabase-global-chart.sql first)
  SUPABASE_DAILY_SUMMARIES_TABLE: '',  // Optional: extra analytics table when sharing (default: daily_summaries)
  SUPABASE_STREAK_REFLECTIONS_TABLE: '',  // Optional: 'streak_reflections' for "what helped you show up?" choices (run supabase-streak-reflections.sql first)
  // Optional: URL for "Unlock full version" (e.g. Stripe, Gumroad). Leave empty to hide buy link.
  PAYMENT_URL: '',
  // Optional: PayPal hosted button.
  PAYPAL_CLIENT_ID: '',
  PAYPAL_HOSTED_BUTTON_ID: ''
};
