# SlipUp — Testing Checklist

Quick checks before and after deploy across PWA, web, iOS, and Android.

---

## Before deploy

- [ ] Run `node bump-version.js` (updates `?v=` in HTML and `CACHE_NAME` in `sw.js`)

---

## After deploy

### Web (desktop)

- [ ] Hero text: "See your patterns. Keep what supports you. Gently release the rest."
- [ ] Hero link: "Why SlipUp?"
- [ ] Add card label: "What slipped?"
- [ ] Mood pills: Calm, Focused, Overwhelmed, Curious, Drained
- [ ] Phase tabs (Personal / Social / Inside) switch correctly
- [ ] Share my result and Others' results work (if Supabase configured)

### PWA

- [ ] Install from browser menu (Chrome/Edge: Install SlipUp)
- [ ] "New version available" banner appears when SW update is pending
- [ ] Refresh button loads latest version
- [ ] App works offline (cached assets)

### iOS Safari / PWA

- [ ] Hero sub-line wraps cleanly on narrow screens
- [ ] Mood pills (Focused, Overwhelmed, Drained) wrap; no overflow
- [ ] + Add button text centered in button
- [ ] 16px inputs at ≤480px (no zoom on focus)
- [ ] Safe areas respected (notch/inset)

### Android Chrome / PWA

- [ ] Top bar at ~380px width: mood button ("Overwhelmed") fits or truncates with ellipsis
- [ ] Type pills stack at ≤420px
- [ ] Touch targets ≥44px for main buttons
- [ ] Community filters single-column at ≤380px

---

## Quick local test

```bash
npm run serve
# Open http://localhost:3333
# Resize to 380px width to simulate narrow phone
# Cycle mood to "Overwhelmed" and check top bar
```
