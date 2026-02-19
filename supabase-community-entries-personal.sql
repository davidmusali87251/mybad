-- SlipUp Personal: Community entries table
-- Stores shared slip-ups for the "What's happening" / community-entries-card block (Personal mode).
-- Anonymous insert + select. No group_id — global feed.
--
-- Run in Supabase Dashboard → SQL Editor. Copy entire file and Run.
-- Then set config: SUPABASE_ENTRIES_TABLE: 'shared_entries_personal' for Personal, or use default.
-- =============================================================================

create table if not exists public.shared_entries_personal (
  id uuid default gen_random_uuid() primary key,
  note text,
  type text not null default 'avoidable' check (type in ('avoidable', 'fertile', 'observed')),
  theme text default 'calm' check (theme in ('calm', 'focus', 'stressed', 'curious', 'tired')),
  hour_utc int check (hour_utc >= 0 and hour_utc <= 23),
  created_at timestamptz default now()
);

comment on table public.shared_entries_personal is 'SlipUp Personal: anonymous shared slip-ups for community feed (What''s happening block).';

create index if not exists shared_entries_personal_created_idx on shared_entries_personal (created_at desc);
create index if not exists shared_entries_personal_type_idx on shared_entries_personal (type);

-- RLS: anonymous can insert and select (same as shared_what_happened for personal)
alter table shared_entries_personal enable row level security;

drop policy if exists "Anon insert personal" on shared_entries_personal;
create policy "Anon insert personal"
  on shared_entries_personal for insert to anon
  with check (true);

drop policy if exists "Anon select personal" on shared_entries_personal;
create policy "Anon select personal"
  on shared_entries_personal for select to anon
  using (true);

-- No update/delete for anon: insert-only feed.

-- Note: shared_chart_counts (global chart) is tied to shared_what_happened. If you use this
-- table instead, the chart won't auto-update. You can add a similar trigger, or keep
-- shared_what_happened for chart aggregation.
