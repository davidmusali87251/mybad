-- Fix RLS: "new row violates row-level security policy" for shared entries
-- Run in Supabase Dashboard → SQL Editor → New query. Copy and Run.
-- =============================================================================
-- This restores permissive anonymous insert/select for shared_what_happened
-- (Personal mode world feed). Use if you get "Couldn't sync: new row violates
-- row-level security policy" when adding a mistake.
-- =============================================================================

-- 1. shared_what_happened (default table for Personal world feed)
drop policy if exists "Allow anonymous insert" on shared_what_happened;
drop policy if exists "Anon insert personal only" on shared_what_happened;
drop policy if exists "Anon insert personal" on shared_what_happened;
create policy "Allow anonymous insert"
  on shared_what_happened for insert to anon
  with check (true);

drop policy if exists "Allow anonymous select" on shared_what_happened;
drop policy if exists "Anon select personal only" on shared_what_happened;
drop policy if exists "Anon select personal" on shared_what_happened;
create policy "Allow anonymous select"
  on shared_what_happened for select to anon
  using (true);

-- 2. shared_entries_personal (when using SUPABASE_ENTRIES_TABLE_PERSONAL: 'shared_entries_personal')
alter table shared_entries_personal enable row level security;

drop policy if exists "Anon insert personal" on shared_entries_personal;
drop policy if exists "Anon select personal" on shared_entries_personal;
drop policy if exists "Allow anonymous insert" on shared_entries_personal;
drop policy if exists "Allow anonymous select" on shared_entries_personal;
drop policy if exists "shared_entries_personal_insert" on shared_entries_personal;
drop policy if exists "shared_entries_personal_select" on shared_entries_personal;

create policy "shared_entries_personal_insert"
  on shared_entries_personal for insert to anon
  with check (true);

create policy "shared_entries_personal_select"
  on shared_entries_personal for select to anon
  using (true);
