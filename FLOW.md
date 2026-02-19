# SlipUp — User flow & structure

A working document to think through the flow of the app.

---

## Core loop (from CONCEPT_NEXT_LEVEL)

> **log → see patterns → reflect**

Everything should support this loop, not replace it.

---

## Decision criteria (2026)

Decisions are grounded in:

1. **User intent** — What is the user trying to do at this moment? Morning = intention. In-the-moment = log. Evening = see patterns + reflect (+ optionally share). The UI should align with time-of-day and task, not scatter related intents across tabs.
2. **SlipUp styles** — Calm, mirror-not-judge, gentle. Type colors reflect intent (avoidable = notice without blame, fertile = growth, observed = reflective). No gamification, no dark patterns. Privacy-first. Copy and structure should feel like a pause, not pressure.

---

## Current structure (index.html)

### Entry points
- **Landing** → CTA → index.html
- **Top bar:** Settings (reminder), Brand, 🌍 slip-ups (→ Social), Mood, + Add (→ add section)
- **Phase tabs:** Personal | Social

### Personal view (vertical scroll order)
| # | Section | Purpose |
|---|---------|---------|
| 1 | Hero | Tagline, "What is this?" |
| 2 | Phase tabs | Personal / Social / Inside |
| 3 | **Add card** | Log a mistake (what happened, mood, type, + Add) |
| 4 | Period tabs | Today / This week / This month |
| 5 | Stats | Count, avg, exploration index |
| 6 | Stats insight block | Note, breakdown, chart, streak |
| 7 | Headline stat | "Lots of experimenting" etc. |
| 8 | Insights | Weekly digest, today vs avg, time, patterns, mood, bias check |
| 9 | Premium | Unlock $5 |
| 10 | Progress | This week vs last week |
| 11 | Trends | Avoidable ↓ Fertile ↑ |
| 12 | Chart | Last 2 weeks line chart |
| 13 | History | Recent entries, filters, export |
| 14 | **Reflection** | Reduce / Keep (end-of-day) |

### Social view (Share tab — contribution-first)
| # | Section | Purpose |
|---|---------|---------|
| 1 | **Share unified** | Your stats, period tabs, ready to share, Share my result |
| 2 | Global chart | Others' recent anonymous shares |
| 3 | Community metrics | Last 7 days shares/people |
| — | World feed | Via top bar 🌍 or Global chart 🌍 icon (Everyone's entries) |

---

## Ideal user journeys

### Morning (intention-setting)
1. Open app (Personal tab)
2. **Set today's intention** (micro-goal) — *planned:* before add card (currently in Social tab)
3. Optional: Quick glance at yesterday / streak (scroll down)
4. Close

---

### In-the-moment (logging)
1. Something happens → open app
2. Add mistake (what, mood, type)
3. See immediate feedback (stats update)
4. Optionally glance at patterns

**Works well:** Add card is first. Fast path.

---

### Evening (reflect & share)
1. Open app
2. Review day (stats, charts) — "Reflect" CTA surfaces when ready
3. **Reflection** — Reduce / Keep
4. Optional: "Share today's result?" prompt → Social / share flow

**Resolved:** Add higher Reflect CTA; add post-reflection Share prompt. (See Resolved section.)

---

## Flow issues

### 1. Intention vs outcome order — ✅ Fixed
- **Micro-goal** (intention) now appears *before* add card — intention first, then logging
- Intention is a morning thing; stats are an outcome thing
- **Done:** Moved intention to top of Personal view

### 2. Two "today" concepts
- Period tabs: Today / This week / This month (for *viewing*)
- Micro-goal: "Today's intention" (for *planning*)
- Reflection: "Today's reflection" (for *closing*)
- All three are day-scoped but scattered. Consider grouping:
  - **Start of day:** Intention
  - **During day:** Add + quick stats
  - **End of day:** Stats + Reflection + Share

### 3. Social is parallel, not integrated
- Personal and Social are tabs — no natural bridge
- After reflection, user might want to share. They have to switch tabs.
- **Option:** Post-reflection prompt: "Share today's result?" → goes to Social

### 4. Long scroll in Personal
- Add → Stats → Micro-goal → Insights → Premium → Progress → Trends → Chart → History → Reflection
- Many sections, one scroll. Hard to form a clear mental model.
- **Option:** Group into phases (Capture | See | Reflect | Share)

### 5. Period tabs control everything
- One set of period tabs drives: stats, insights, charts, history, share count
- Personal and Social each have their own period tabs (Personal at top, Social when you switch)
- Consistent. But the "Today" in micro-goal and reflection is always today — not period-dependent. Good.

---

## Proposed flow (for discussion)

### Option A: Three zones
```
┌─────────────────────────────────────┐
│ CAPTURE                             │
│ Add + (optional) Today's intention   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ SEE                                 │
│ Period tabs → Stats → Insights →     │
│ Progress → Trends → Chart → History  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ REFLECT & SHARE                     │
│ Reflection + "Share today?" link     │
└─────────────────────────────────────┘
```

### Option B: Match time of day
- **Morning:** Intention at top (collapsible when empty)
- **Anytime:** Add + Stats (the core)
- **Evening:** Reflection + optional share prompt

### Option C: Minimal reorder — ✅ Implemented
- Micro-goal moved to top: before add card (first thing after phase tabs)
- Keep everything else as-is
- Low effort, clearer "intention before outcome"

---

## Resolved (by user intent + SlipUp styles)

### 1. Micro-goal — Move to Personal (before Add)

**Decision:** Move micro-goal from Social tab to Personal view, before the Add card.

**User intent:** Intention-setting is a *start-of-day* action, before logging. Current placement (first in Social tab) misaligns: users who stay in Personal never see it; those who go to Social may have already logged. Copy says "Before you log" — it should appear *before* Add.

**SlipUp styles:** Keeps intention as a gentle pause, not buried behind a share flow. Matches CONCEPT_NEXT_LEVEL: "optional daily intent" in the morning.

**Action:** Relocate `micro-goal-section` from `#social-view` to `#personal-view`, immediately after phase tabs, before add-section.

---

### 2. Reflection — Add higher "Reflect" CTA (evening)

**Decision:** Keep reflection at bottom, but add a subtle "Reflect" CTA higher (e.g. in stats insight block or after History).

**User intent:** Evening = review + reflect. Reflection is currently at the end of a long scroll; many users won't reach it. A CTA surfaces the option without forcing — "Ready to reflect?" or "Today's reflection" link that scrolls to the section.

**SlipUp styles:** Soft, non-pushy. Mirror-not-judge. The CTA should feel like an invitation, not a guilt trip. Use existing card/button styles (e.g. `.btn-quick` or accent link).

**Action:** Add a "Reflect" / "Today's reflection" link or button after History (or in stats block when period = day), scrolls to `#reflection-section`. Optional: show only in evening hours (e.g. after 6pm local).

---

### 3. Social — Add post-reflection "Share today?" prompt

**Decision:** Add a gentle post-reflection prompt: "Share today's result?" → links to Social tab or opens share flow.

**User intent:** After reflecting, users may want to contribute. Right now they must remember to switch tabs. A prompt bridges the moment without forcing.

**SlipUp styles:** Explicit, reversible. "Share today?" not "You should share." Dismissable. No dark pattern. Copy: "Want to add today's result to the world chart?" or similar.

**Action:** In reflection-section, after user fills Reduce/Keep (or on blur), show optional line: "Share today's result?" → switches to Social and scrolls to share button, or triggers share flow in-place.

---

### 4. Sections — Group into Capture / See / Reflect (visual only)

**Decision:** Add lightweight visual grouping (headings or dividers) to support mental model. No major reorder; keep single scroll.

**User intent:** Users need a clear map: Capture (add + intention), See (stats, insights, trends, history), Reflect (reflection + share). Grouping reduces cognitive load without changing the flow.

**SlipUp styles:** Minimal. Use existing section headers or a thin divider + small label (e.g. "Capture" / "See" / "Reflect"). Same typography and accent treatment as `.section-hint`. No heavy boxes or tabs.

**Action:** Add optional aria-labels or visual group labels (e.g. `role="region" aria-label="Capture"`) around Add + micro-goal, Stats through History, Reflection. Style with `.section-hint`-like treatment.

---

## Summary

| Aspect | Current | Decision |
|--------|---------|----------|
| Micro-goal | First in Social tab | **Move** to Personal, before Add card |
| Reflection | At bottom only | **Keep** at bottom + add higher "Reflect" CTA |
| Social | Separate tab | **Add** post-reflection "Share today?" prompt |
| Sections | Single long scroll | **Group** visually (Capture / See / Reflect), keep scroll |
