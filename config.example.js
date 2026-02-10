// Optional: set these to enable anonymous sharing & viewing others' results.
// 1. Copy this file to config.js:  cp config.example.js config.js  (or copy-paste and save as config.js)
// 2. Get URL and anon key from Supabase: project → Settings → API.
//    - SUPABASE_URL: "Project URL" (e.g. https://xxxxx.supabase.co) — no trailing slash.
//    - SUPABASE_ANON_KEY: "anon" "public" key (long JWT starting with eyJ...). Use the same project as the URL.
// 3. Paste your values below. config.js is gitignored so your keys are not committed.
//
// If you see "Invalid API key": URL and key must be from the same Supabase project; use anon key, not service_role.
// If the project is paused, resume it in the Supabase dashboard.
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Optional: URL for "Unlock full version" (e.g. Stripe, Gumroad). Leave empty to hide buy link.
  PAYMENT_URL: '',
  // Optional: PayPal hosted button.
  PAYPAL_CLIENT_ID: '',
  PAYPAL_HOSTED_BUTTON_ID: ''
};
