-- Table for today's reflections with stats.
-- Stores one row per user per day: Reduce/Keep text + daily counts (avoidable, fertile, observed, exploration).
--
-- HOW TO RUN: In Supabase Dashboard → SQL Editor → New query:
--   1. Copy ALL the SQL below (from "create table" to end of last policy)
--   2. Paste into query box and click Run
--
-- TABLE SHAPE:
--   id, anonymous_id, mode, day_date, avoidable (text), fertile (text), intention_match,
--   avoidable_count, fertile_count, observed_count, exploration_pct, created_at, updated_at
-- =============================================================================

create table if not exists public.todays_reflections (
  id uuid default gen_random_uuid() primary key,
  anonymous_id text not null,
  mode text not null default 'personal',
  day_date date not null,
  avoidable text,
  fertile text,
  intention_match text,
  avoidable_count int not null default 0,
  fertile_count int not null default 0,
  observed_count int not null default 0,
  exploration_pct int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (anonymous_id, mode, day_date)
);

comment on table public.todays_reflections is 'Daily reflections with stats. One row per user per day.';
comment on column public.todays_reflections.day_date is 'Calendar day (local date).';
comment on column public.todays_reflections.avoidable is 'Reduce: one pattern to tweak.';
comment on column public.todays_reflections.fertile is 'Keep: fertile risk glad for.';
comment on column public.todays_reflections.intention_match is 'yes | partially | no | empty.';
comment on column public.todays_reflections.avoidable_count is 'Avoidable entries logged that day.';
comment on column public.todays_reflections.fertile_count is 'Fertile entries logged that day.';
comment on column public.todays_reflections.observed_count is 'Observed entries logged that day.';
comment on column public.todays_reflections.exploration_pct is 'fertile ÷ (avoidable+fertile) * 100, null if no primary entries.';
comment on column public.todays_reflections.mode is 'personal | inside';

create index if not exists todays_reflections_day_date_idx on todays_reflections (day_date desc);
create index if not exists todays_reflections_anonymous_id_idx on todays_reflections (anonymous_id);

-- Update updated_at on row change
create or replace function public.todays_reflections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists todays_reflections_updated_at on todays_reflections;
create trigger todays_reflections_updated_at
  before update on todays_reflections
  for each row execute function public.todays_reflections_updated_at();

alter table todays_reflections enable row level security;

drop policy if exists "Allow anonymous insert" on todays_reflections;
create policy "Allow anonymous insert" on todays_reflections for insert with check (true);

drop policy if exists "Allow anonymous update" on todays_reflections;
create policy "Allow anonymous update" on todays_reflections for update using (true);

drop policy if exists "Allow anonymous select own" on todays_reflections;
create policy "Allow anonymous select own" on todays_reflections for select using (true);

-- No delete: keeps history. Use service role for admin cleanup if needed.
