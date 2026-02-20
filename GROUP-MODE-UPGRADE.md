# SlipUp Inside — Group Mode Upgrade Plan

**Status:** Implemented (Phases 1–4)  
**Date:** Feb 2026  
**Goal:** Transform Group Mode into a high-engagement, retention-driven system while preserving SlipUp's values and backward compatibility.

---

## 1. Design Principles (Adapted from Spec + ARCHITECTURE)

**SlipUp constraints (non-negotiable):**
- No leaderboards, rankings, or scores between users (ARCHITECTURE §4)
- No gamification or dark patterns
- Calm, mirror-not-judge, non-judgmental tone
- Privacy-first; anonymous sharing
- Explicit, reversible sharing

**We will add:**
- Participation visibility (who showed up today — counts only, no names)
- Shared goals/milestones (collaborative, not competitive)
- Meaningful activity feed (achievements, new members, milestones)
- Gentle accountability (streaks, consistency)
- Recognition (celebrations, badges for participation — not performance)
- Frictionless invite + group preview

---

## 2. Current State Summary

### Data model (Supabase)
| Table | Purpose |
|-------|---------|
| `groups` | id, name, created_by |
| `group_members` | group_id, user_id, role (creator \| member) |
| `group_invites` | group_id, invite_token, expires_at |
| `shared_what_happened` | entries with group_id for inside mode |
| `shared_entries_inside` | group-scoped shared moments |
| `shared_stats_inside` | group stats |
| `shared_intentions` | intentions with group_id |

### Frontend (vanilla JS)
- `inside.html` — Group gate, Group tab, Shares tab
- `inside-auth.js` — Auth, groups, invites, members, RPCs
- `app.js` — MODE=inside logic, share-to-group, community entries, stats

### Gaps
- No activity feed (new members, milestones)
- No participation indicators (who checked in today)
- No group-level streaks or milestones
- No badges/recognition
- Invite flow exists but no group preview before join
- Roles: only creator / member (no moderator)

---

## 3. Phased Implementation

### Phase 1 — Activity Feed + Participation Visibility (High impact, low conflict)
**Scope:** UI + minimal DB changes

| Feature | Description | Effort |
|---------|-------------|--------|
| **Activity feed** | Central feed: "X joined", "Group reached 50 moments", "Y checked in today" (anonymized) | Medium |
| **Participation indicators** | "3 of 5 checked in today" — counts only, no names | Low |
| **Group milestone** | Celebrate shared milestones (e.g. 25 moments) | Low |
| **Invite preview** | Show group name + member count before joining | Low |

**DB changes:**
- `group_activity` table (optional): `group_id`, `kind` (member_joined, milestone_reached, daily_summary), `metadata` (jsonb), `created_at` — for feed
- Or derive from existing: `group_members`, `shared_entries_inside`, `group_invites` — no new table for Phase 1

**UI:**
- New section: `#group-activity-feed` in Shares tab (or Group tab)
- Participation block: "3 of 5 checked in today" near stats
- Milestone toast/block when group hits N moments

---

### Phase 2 — Streaks + Gentle Accountability
**Scope:** Client + optional server

| Feature | Description | Effort |
|---------|-------------|--------|
| **Personal streak** | Already exists (localStorage) — surface in group context | Low |
| **Group streak** | "Your group has logged 7 days in a row" | Medium |
| **Consistency nudge** | "Last check-in was 2 days ago — a quick one helps." | Low |
| **Shared goal** | Optional group intention: "This week: less heat" | Medium |

**DB:**
- `group_daily_participation` (optional): `group_id`, `date` (date), `participant_count` — for group streak
- Or compute from `shared_entries_inside.created_at` per group per day

---

### Phase 3 — Recognition + Collaborative Mode
**Scope:** Non-competitive rewards

| Feature | Description | Effort |
|---------|-------------|--------|
| **Participation badges** | "5-day streak", "First to share today" (anonymous) | Medium |
| **Collective progress bar** | "Group: 12 moments this week" (no individual breakdown) | Low |
| **Celebration copy** | "Nice — the group showed up today." | Low |
| **Collaborative mode flag** | `groups.mode` = 'collaborative' (future: could add 'supportive') | Low |

**No competitive mode** — ARCHITECTURE forbids leaderboards.

---

### Phase 4 — Admin + Safety (Future)
**Scope:** Extend existing admin

| Feature | Description | Effort |
|---------|-------------|--------|
| **Group health** | Activity trends, participation %, retention signals | Medium |
| ** moderator role** | Add `moderator` to `group_members.role` | Low |
| **Reporting** | Flag inappropriate shared content | Medium |
| **Invite expiry** | Already in schema; enforce in UI | Low |

---

## 4. Technical Approach

### Backward compatibility
- All new columns/tables use `add column if not exists` / `create table if not exists`
- New RPCs; no breaking changes to existing ones
- `app.js` checks for new features (e.g. `if (getGroupParticipantCount)`) before using

### Performance
- Use existing indexes: `shared_entries_inside(group_id, created_at)`, `group_members(group_id)`
- For "participants today": single query grouping by `date_trunc('day', created_at)` and counting distinct `user_id` — but `shared_entries_inside` has no `user_id`. Need to add `user_id` to shared entries for Inside (authenticated) or derive from another source.
  - **Option A:** Add `user_id` to `shared_entries_inside` (nullable for backward compat)
  - **Option B:** Create `group_daily_checkins` on first share of day per user
- Recommendation: Add `user_id` to `shared_entries_inside` for Inside — we have auth, so it's safe. Enables "X checked in" (anonymized as "someone" or "1 more person").

### Security
- RLS unchanged for new tables
- No PII in activity feed
- Invite preview: only group name + member count (no member names)

---

## 5. Concrete Phase 1 Tasks

### 5.1 Participation block (no DB change)
- Query: count distinct days with `created_at` for group in last 24h. Problem: we don't have `user_id` in `shared_entries_inside`.
- **Solution:** Add `user_id` to `shared_entries_inside` (nullable). On insert from Inside, set from `auth.uid()`.
- Migration: `alter table shared_entries_inside add column if not exists user_id uuid references auth.users(id);`
- RLS: policy already restricts by group; user_id is for aggregation only.
- Query: `select count(distinct user_id) from shared_entries_inside where group_id = ? and created_at >= current_date` (adjust for timezone)
- UI: Participation block with "X of Y checked in today"

### 5.2 Activity feed (minimal)
- Events: `member_joined`, `milestone_reached`, `first_share_today`
- Store: Either new `group_activity` table or derive from existing. For Phase 1, derive:
  - **member_joined:** from `group_members.joined_at` — but we'd need to know when. Could add `group_activity` with insert on join.
  - **milestone_reached:** e.g. every 25 shared moments — query count, trigger one-time.
  - **first_share_today:** "Someone shared their first moment today" — from `shared_entries_inside`.
- **Simplest Phase 1:** No new table. Activity feed shows:
  1. "Group has X shared moments" (from count)
  2. "Y members in the group" (from get_group_member_count)
  3. "N checked in today" (from distinct user_id in shared_entries_inside where date = today)
- Add `user_id` to `shared_entries_inside`, then we can show "3 people checked in today" without names.

### 5.3 Invite preview
- New page or modal: `inside.html?invite=TOKEN&preview=1`
- RPC: `get_invite_preview(invite_token)` → `{ group_name, member_count }` (no other info)
- Requires: `group_invites` select by token (already allowed), join `groups` for name, count `group_members`.

### 5.4 Milestone celebration
- When `select count(*) from shared_entries_inside where group_id = ?` crosses 25, 50, 100, etc., show a one-time block or toast.
- Store "last celebrated milestone" in localStorage per group to avoid repeat.

---

## 6. Files to Modify (Phase 1)

| File | Changes |
|------|---------|
| `supabase-*.sql` | New migration: add `user_id` to `shared_entries_inside`, `get_invite_preview` RPC, optional `group_activity` |
| `inside-auth.js` | `getInvitePreview(token)` calling new RPC |
| `inside.html` | Participation block, activity feed section, invite preview handling |
| `app.js` | Fetch participation count, render activity feed, milestone check, insert `user_id` when sharing to group |
| `styles.css` | Styles for activity feed, participation block |

---

## 7. Decision Log

| Decision | Rationale |
|----------|-----------|
| No leaderboards | ARCHITECTURE §4 — "no rankings, scores, comparisons" |
| Add user_id to shared_entries_inside | Enables "N checked in today" without new tables; auth required for Inside |
| Activity feed derived first | Avoid schema change; add `group_activity` in Phase 2 if needed |
| Invite preview = name + count only | Privacy; no member list before join |
| Collaborative-only | Competitive mode violates SlipUp values |

---

*Next step: Implement Phase 1. Start with DB migration (user_id + get_invite_preview), then UI.*
