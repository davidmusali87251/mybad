# SlipUp — Button & Link Function Reference

Reference for what each button/link does, from project docs and code. Use this to verify or restore button behavior.

---

## Top Bar (index.html, inside.html)

| Element | Page | Intended function | Handler location |
|---------|------|-------------------|------------------|
| **btn-settings** | index, inside | Toggle settings dropdown (reminder, invite, manage group, sign out) | app.js ~4355 |
| **top-bar-brand** | index | SlipUp — on index: force reload/update; elsewhere: go to index | app.js ~4384 |
| **btn-theme-top** | index, inside | Cycle mood theme (calm/focus/stressed/curious/tired) | Inline script in HTML |
| **top-bar-world** | index only | Switch to Social → World tab (everyone's entries) | app.js ~4436 |
| **top-bar-slipups** | inside only | Switch to Shares tab (group moments) | app.js ~4450 |
| **top-bar-add** | index, inside | Switch to Personal/Group if on Social/Shares, scroll to #main, focus add input | app.js ~4371 |

---

## Phase Tabs (Personal | Social | Inside)

| Element | Page | Intended function | Handler location |
|---------|------|-------------------|------------------|
| **phase-tab** (data-phase="personal") | index, inside | Switch to Personal/Group view | app.js initPhaseTabs |
| **phase-tab** (data-phase="social") | index, inside | Switch to Social/Shares view | app.js initPhaseTabs |
| **phase-tab--link** (Inside) | index | Navigate to inside.html | `<a href="inside.html">` |

---

## Personal / Group View

| Element | Page | Intended function | Handler location |
|---------|------|-------------------|------------------|
| **btn-share-intention** | index, inside | Share today's intention to shared chart / group | app.js ~3987 |
| **btn-intentions-how** | inside | Toggle "How intentions work" panel | app.js ~4011 |
| **btn-view-older-intentions** | inside | Toggle older intentions view | app.js ~4000 |
| **add-mistake** | index, inside | Add new mistake/moment (disabled until text entered) | app.js addMistake |
| **btn-cant-tell** | index, inside | Quick-add with selected type, empty note | app.js ~4109 |
| **btn-bias-check** | index, inside | Open bias-check modal (when type=observed) | app.js openBiasCheck |
| **btn-bias-check-close** | index, inside | Save bias check choice, close modal | app.js |
| **empty-state** (empty-state-add) | index, inside | Scroll to add card, focus input | app.js ~4111 |
| **btn-share-to-group-select-all** | inside | Select all unshared moments | app.js ~3782 |
| **btn-share-to-group** | inside | Share selected moments to group | app.js ~3791 |

---

## Stats & History

| Element | Page | Intended function | Handler location |
|---------|------|-------------------|------------------|
| **.tab** (data-period) | index, inside | Set period: day/week/month | app.js periodTabs forEach |
| **btn-export-csv** | index, inside | Export entries CSV (gated: full version) | app.js ~4277 |
| **btn-export-reflections** | index, inside | Export reflections CSV (gated) | app.js ~4273 |
| **history-filter** | index, inside | Filter entries by type | Delegated in history-filters |

---

## Social View — Share Tab (index)

| Element | Intended function | Handler location |
|---------|-------------------|------------------|
| **btn-share** | Share stats anonymously | app.js shareAnonymously |
| **btn-refresh-feed** | Refresh shared stats | app.js ~3859 |
| **btn-share-after-reflection** | Switch to Social → Share tab | app.js ~4427 |
| **btn-global-world** (🌍) | Switch to Social → World tab | app.js btnGlobalWorld |
| **btn-link-add-mistake** | Switch to Personal, scroll to add card | app.js btnLinkAddMistake |

---

## Social View — World Tab (index) / Shares (inside)

| Element | Page | Intended function | Handler location |
|---------|------|-------------------|------------------|
| **btn-shared-total** | index, inside | Display only (shows count) | — |
| **btn-add-from-community** | index, inside | Switch to Personal/Group, scroll to add card | app.js ~3814, ~3876 |
| **btn-shared-entries-toggle** | index, inside | Toggle Last 10 / All entries | app.js toggleSharedEntriesView |
| **btn-show-all-shared** | index, inside | Show all shared entries | app.js showAllSharedEntries |
| **btn-download-global-patterns** | index only | Export global patterns CSV (gated) | app.js ~4281 |
| **btn-link-recent-shares** | index only | Switch to Share tab, scroll to community-section | app.js btnLinkRecentShares |
| **shared-entries-empty** (clickable) | index, inside | Switch to Personal/Group, scroll to add | app.js ~3888 |

---

## Reflection

| Element | Intended function | Handler location |
|---------|-------------------|------------------|
| **reflection-avoidable**, **reflection-fertile** | Input + blur save | app.js initReflection |
| **reflection-intention-btn** | Save intention match (yes/partially/no) | app.js ~3936 |
| **streak-reflection-trigger** | Open "What helped you show up?" panel | app.js openStreakReflectionPanel |

---

## Premium

| Element | Intended function | Handler location |
|---------|-------------------|------------------|
| **btn-buy** | Open payment URL | app.js ~4622 |
| **btn-unlock-after-pay** | Unlock full version after payment | app.js ~4638 |
| **btn-buy-unlocked** | (When unlocked) Open payment | app.js ~4629 |

---

## Group Gate (inside.html, before app loads)

| Element | Intended function | Handler location |
|---------|-------------------|------------------|
| **group-gate-tab** | Switch create/join/switch panel | Inline script in inside.html |
| **btn-create-group** | Create new group | Inline script |
| **btn-join-group** | Join via invite link | Inline script |
| **group-gate-group-btn** | Switch to selected group | Inline script |

---

## Hash-based Navigation (index.html)

| Hash | Effect |
|------|--------|
| `#social` | Switch to Social view (Share tab) |
| `#phase-tabs` | Switch to Social → World tab |
| `#community-section` | Switch to Social → Share tab, scroll to Recent shares |
| `#main` | Scroll to add section (browser default) |

---

## Legal & Landing

| Page | Top bar | + Add / Home |
|------|---------|--------------|
| landing.html | Brand only | — |
| landing-inside.html | Brand only | href inside.html |
| privacy, terms, refund | Brand, btn-theme | href index.html |
| auth-inside.html | Brand | href inside.html "Open app" |

---

## Quick Add Buttons (initial commit had these; current uses btn-cant-tell)

The initial commit referenced `btn-quick-avoidable`, `btn-quick-fertile`, `btn-quick-observed`, `repeatLastBtn`, but index.html had only `btn-cant-tell`. The current design uses a single "I can't tell" button for quick-add with the currently selected type.
