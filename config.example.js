// Optional: set these to enable anonymous sharing & viewing others' results.
// 1. Copy this file to config.js:  cp config.example.js config.js
// 2. Get URL and anon key from Supabase: project → Settings → API (use Legacy API Keys, anon JWT).
// 3. Paste your values below. config.js is gitignored so your keys are not committed.
window.MISTAKE_TRACKER_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Optional: URL for "Unlock full version" (e.g. Stripe, Gumroad). Leave empty to hide buy link.
  PAYMENT_URL: '',
  // Optional: PayPal hosted button. Get client-id from developer.paypal.com (REST API apps). Create button at PayPal → Products and services → Buttons, then copy the "Hosted button ID" (code view).
  PAYPAL_CLIENT_ID: '',
  PAYPAL_HOSTED_BUTTON_ID: ''
};
