// Optional: set these to enable anonymous sharing & viewing others' results.
//
// SECURITY:
// - FOR LOCAL USE ONLY. Do not commit config.js (it is in .gitignore).
// - Use the Supabase ANON key only (never the service_role key) — anon is safe for client-side.
// - The deployed site (e.g. GitHub Pages) gets config from repository Secrets, not from this file.
//
// 1. Copy this file to config.js:  cp config.example.js config.js  (or copy-paste and save as config.js)
// 2. Get URL and anon key from Supabase: project → Settings → API.
//    - SUPABASE_URL: "Project URL" (e.g. https://xxxxx.supabase.co) — no trailing slash.
//    - SUPABASE_ANON_KEY: "anon" "public" key (long JWT starting with eyJ...). Same project as the URL.
// 3. Paste your values below.
//
// === Two cases for world feed table ===
//
// CASE 1 (before / default): Use shared_what_happened (single table, run README SQL).
//   SUPABASE_ENTRIES_TABLE_PERSONAL: ''  or omit
//
// CASE 2: Use shared_entries_personal (separate table, run supabase-fix-rls-shared-entries.sql).
//   SUPABASE_ENTRIES_TABLE_PERSONAL: 'shared_entries_personal'
//
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Optional: use your own table names (defaults: shared_stats, shared_what_happened)
  SUPABASE_STATS_TABLE: '',      // e.g. 'daily_summaries' for "Share my result" / Others' results
  SUPABASE_ENTRIES_TABLE: '',     // Default: shared_what_happened (single table for both modes)
  SUPABASE_ENTRIES_TABLE_PERSONAL: '',  // '' = shared_what_happened (default) | 'shared_entries_personal' = that table
  SUPABASE_ENTRIES_TABLE_INSIDE: '',    // Optional: separate table for Inside community entries. Run supabase-community-entries-inside.sql. Requires groups table.
  SUPABASE_CHART_TABLE: '',    // Optional: 'shared_chart_counts' for global chart (run supabase-global-chart.sql first)
  SUPABASE_DAILY_SUMMARIES_TABLE: '',  // Optional: extra analytics table when sharing (default: daily_summaries)
  SUPABASE_STREAK_REFLECTIONS_TABLE: '',  // Optional: 'streak_reflections' for "what helped you show up?" choices (run supabase-streak-reflections.sql first)
  SUPABASE_STATE_EVENTS_TABLE: '',       // Optional: 'state_events' to log state elements (phase, filters, views, actions) with anonymous_id (run supabase-state-events.sql first)
  SUPABASE_INTENTIONS_TABLE: '',         // Optional: 'shared_intentions' for global intentions chart (run supabase-shared-intentions.sql first)
  SUPABASE_TODAYS_REFLECTIONS_TABLE: '', // Optional: 'todays_reflections' for reflections + stats cloud sync (run supabase-todays-reflections.sql first)
  // Optional: URL for "Unlock full version" (e.g. Stripe, Gumroad). Leave empty to hide buy link.
  PAYMENT_URL: '',
  // Optional: PayPal hosted button.
  PAYPAL_CLIENT_ID: '',
  PAYPAL_HOSTED_BUTTON_ID: ''
};
