-- Table for "what helped you show up?" streak reflection choices (2-day streak).
-- The app inserts one row each time a user picks an option (Discipline, Responsibility, etc.).
--
-- HOW TO RUN: In Supabase Dashboard → SQL Editor → New query:
--   1. Open this file, select ALL the SQL below (from "create table" to the end)
--   2. Paste into the query box, then Run
-- =============================================================================

create table if not exists streak_reflections (
  id uuid default gen_random_uuid() primary key,
  anonymous_id text not null,
  mode text not null,
  choice text not null,
  streak int not null default 2,
  created_at timestamptz default now()
);

-- Index for querying by time or by anonymous_id (see user choices over time)
create index if not exists streak_reflections_created_at_idx on streak_reflections (created_at desc);
create index if not exists streak_reflections_anonymous_id_idx on streak_reflections (anonymous_id);

-- RLS: anonymous client can insert only; reading is for dashboard/analytics (service role or SQL)
alter table streak_reflections enable row level security;

drop policy if exists "Allow anonymous insert" on streak_reflections;
create policy "Allow anonymous insert" on streak_reflections for insert with check (true);

-- No select/update/delete for anon: only inserts from the app; use Dashboard or SQL to view data
