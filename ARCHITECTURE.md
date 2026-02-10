# Architecture & technical decisions

This document captures the constraints and technical decisions derived from the product vision. Constraints protect the spirit of the system.

---

## 1. Dual-phase architecture: Personal + Social

**Personal phase (default)**

- All mistake entries are stored locally first (localStorage).
- The app is fully usable without an account.
- Personal stats (counts, averages, trends, reflections) are computed client-side.
- The personal phase prioritizes privacy, speed, and zero friction.

**Social phase (opt-in)**

- Users can choose to share selected entries or aggregates.
- Shared data is anonymous by default.
- The social layer is additive, never required.

---

## 2. Identity model (minimal and non-intrusive)

- No real names.
- No mandatory email at first.
- Each user gets:
  - a persistent anonymous ID (UUID stored locally)
  - an optional alias (user-chosen, non-unique)
- Identity exists only to preserve continuity, not reputation.

---

## 3. Data model: mistakes

Each mistake entry includes:

- **timestamp**
- **type:** `avoidable` | `fertile`
- **optional note** (short text)
- **visibility flag:** `private` | `shared_anonymous` | `stats_only`

No public per-user history is exposed.

---

## 4. Social layer (non-competitive by design)

There are **no**:

- leaderboards
- rankings
- scores
- comparisons between users

Instead, the social layer provides:

- aggregated global stats (percentages, distributions)
- time-based trends (today / week / month)
- shared reflections generated from collective data

Example outputs:

- “This week, 61% of logged mistakes were fertile.”
- “Most users logged more fertile mistakes than avoidable ones.”

---

## 5. Backend: Supabase

Shared data (anonymous stats and optional shared entries) is stored in Supabase. Row-level security and anonymous keys keep the client simple and the backend minimal.

---

## 6. Privacy-first defaults

- All data is private by default.
- Sharing is explicit and reversible.
- No dark patterns or forced onboarding.
- Users can delete all their data locally and remotely.

---

## 7. Non-goals (explicit)

The app will **not**:

- optimize for engagement metrics
- gamify mistakes
- encourage comparison
- collect personal profiling data
- use AI APIs for core logic
