-- Shared intentions (Today's intention / micro-goal) — anonymous, global chart.
-- Same pattern as shared_what_happened: anon insert + anon select for public feed.
--
-- HOW TO RUN: In Supabase Dashboard → SQL Editor → New query:
--   1. Copy ALL the SQL below (from "create table" to end of last policy)
--   2. Paste into query box and click Run
--   3. Table Editor → refresh → you should see "shared_intentions"
-- =============================================================================
--
-- TABLE SHAPE:
--   id, anonymous_id, intention (text, max 60 chars), mode, created_at
--
-- Web vs PWA: Same table, same RLS. App uses navigator.onLine to skip push when offline.
-- Rate: One intention per save (blur). App can dedupe same text in same session.

create table if not exists public.shared_intentions (
  id uuid default gen_random_uuid() primary key,
  anonymous_id text not null,
  intention text not null,
  mode text not null default 'personal',
  created_at timestamptz default now()
);

comment on table public.shared_intentions is 'Anonymous shared intentions (micro-goal). For global "what others are aiming for" chart.';
comment on column public.shared_intentions.intention is 'Today''s intention text, max 13 chars (matches app limit).';
comment on column public.shared_intentions.mode is 'App mode: personal | inside';

create index if not exists shared_intentions_created_at_idx on shared_intentions (created_at desc);
create index if not exists shared_intentions_mode_idx on shared_intentions (mode);

alter table shared_intentions enable row level security;

drop policy if exists "Allow anonymous insert" on shared_intentions;
create policy "Allow anonymous insert" on shared_intentions for insert with check (true);

drop policy if exists "Allow anonymous select" on shared_intentions;
create policy "Allow anonymous select" on shared_intentions for select using (true);

-- No update/delete for anon: insert-only, same as shared_what_happened.
