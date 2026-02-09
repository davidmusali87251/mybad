# SlipUp — Taking the concept to the next level

This document outlines directions to evolve SlipUp from a daily tracker into a fuller "smarter relationship with mistakes" experience. Use it to prioritize features and align design decisions.

---

## Implementation status (at a glance)

| Direction | Feature | Status |
|-----------|---------|--------|
| 1. Habit reinforcement | Streaks & nudges | ✅ In app (streak note, "Last log was X days ago") |
| 1. Habit reinforcement | Optional reminder (8pm) | ✅ Settings: "Notify me for evening check-in (8pm)" |
| 1. Habit reinforcement | Micro-goals | ✅ "Today's intention" + "You hit it" / "Tomorrow's another day" |
| 2. Smarter reflection | Context-aware prompts | ✅ Afternoon/fertile prompts in reflection section |
| 2. Smarter reflection | Weekly digest (one sentence) | ✅ "This week in one sentence" in insights |
| 3. Share & progress | Share as image | ✅ "Share as image" button (card with stats) |
| 3. Share & progress | SlipUp Inside — group pulse | ✅ Inside mode with heat/shift/support, anonymous sharing |
| 4. Calm personalization | Themes (calm / focus / warm) | ✅ Theme toggle in header |
| 4. Calm personalization | Optional reminders | ✅ Same as above (8pm check-in) |
| 5. Technical | Data layer (by day, week, type) | ✅ filterByPeriod, getDayCountsLastN, etc. |
| 5. Technical | Offline-first | ✅ PWA, service worker; add/view works offline |

---

## 1. Gentle habit reinforcement

**Streaks & nudges**  
Surface light encouragement without guilt: e.g. "You've logged 3 days in a row" or "Last log was 2 days ago — a quick check-in can help." Optional reminder: "Evening check-in?" (browser/PWA).

**Micro-goals**  
Optional daily intent: "Today I'll keep avoidable under 3" or "One fertile experiment." Single toggle or short sentence; at day end show "You hit it" or "Tomorrow's another day" (no shaming).

---

## 2. Smarter reflection

**Context-aware prompts**  
Use patterns to tailor reflection: e.g. if most entries are avoidable in the afternoon, prompt: "What often happens around that time?" If fertile is low: "What's one small experiment you could try tomorrow?"

**Weekly digest (one sentence)**  
End of week: one auto sentence from the data, e.g. "This week: fewer avoidable on days you logged in the morning" or "Your best exploration day was Tuesday." Stays in-app or optional email if you add it later.

---

## 3. Share & show progress

**Share as image**  
Export a simple card: chart + 2–3 stats + "This week with SlipUp." Lets users share with a coach, team, or themselves without exposing raw data.

**SlipUp Inside — group pulse only**  
For groups: one shared view (e.g. "This week: heat ↓, shift ↑") with no individual breakdown. Lets facilitators see trend without identifying anyone.

---

## 4. Calm personalization

**Themes / mood**  
Optional "calm" vs "focus" (or similar) that only tweaks accent and maybe one background tone. Keeps the product feeling like their space.

**Optional reminders**  
Single daily check-in (e.g. 8pm), off by default, with copy like "Time for a quick look at your day." PWA or browser notification.

---

## 5. Technical enablers

**Data layer**  
Keep entries and stats easy to query (by day, week, type) so weekly digest, prompts, and "share as image" stay simple to implement.

**Offline-first**  
Ensure add + view works offline and syncs when back online if you introduce sync later (e.g. optional account).

---

## How to use this

- Pick **one or two** directions per release (e.g. streaks + weekly sentence first).
- Keep the core loop intact: **log → see patterns → reflect.** New features should support that loop, not replace it.
- Preserve voice: calm, non-shaming, "mirror not judge."
