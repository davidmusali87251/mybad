-- SlipUp Inside: Community entries table
-- Stores shared moments for the "What's happening in your group" / community-entries-card block.
-- Group-scoped. Requires groups table (run supabase-inside-groups.sql first).
--
-- Run in Supabase Dashboard → SQL Editor. Copy entire file and Run.
-- PREREQUISITE: Run supabase-inside-groups.sql first. It creates:
--   - groups table
--   - group_members table (with group_id column)
--   - auth_my_group_ids() function
-- Then set config: SUPABASE_ENTRIES_TABLE_INSIDE: 'shared_entries_inside' for Inside.
-- =============================================================================

-- Drop existing table if it was created without group_id (fixes "column group_id does not exist")
drop table if exists public.shared_entries_inside cascade;

create table public.shared_entries_inside (
  id uuid default gen_random_uuid() primary key,
  note text,
  type text not null default 'avoidable' check (type in ('avoidable', 'fertile', 'observed')),
  theme text default 'calm' check (theme in ('calm', 'focus', 'stressed', 'curious', 'tired')),
  hour_utc int check (hour_utc >= 0 and hour_utc <= 23),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz default now()
);

comment on table public.shared_entries_inside is 'SlipUp Inside: shared moments per group for community feed (What''s happening in your group block).';

create index if not exists shared_entries_inside_group_created_idx on shared_entries_inside (group_id, created_at desc);
create index if not exists shared_entries_inside_type_idx on shared_entries_inside (group_id, type);

-- RLS: authenticated users can insert/select only for groups they belong to
alter table shared_entries_inside enable row level security;

-- Requires auth_my_group_ids() from supabase-inside-groups.sql
drop policy if exists "Auth insert inside" on shared_entries_inside;
create policy "Auth insert inside"
  on shared_entries_inside for insert to authenticated
  with check (group_id in (select auth_my_group_ids()));

drop policy if exists "Auth select inside" on shared_entries_inside;
create policy "Auth select inside"
  on shared_entries_inside for select to authenticated
  using (group_id in (select auth_my_group_ids()));
