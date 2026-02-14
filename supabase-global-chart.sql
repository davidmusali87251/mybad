-- Table for the global counting chart (Avoidable ↓ · Fertile ↔ or ↑)
-- Stores pre-aggregated counts from shared_what_happened, updated by trigger on insert.
--
-- HOW TO RUN: Do NOT paste the file path. In Supabase Dashboard:
--   1. Go to SQL Editor → New query
--   2. Open this file in your editor (e.g. VS Code), select ALL the SQL below (from "create table" to the end)
--   3. Copy and paste that text into the Supabase query box, then click Run
-- =============================================================================

create table if not exists shared_chart_counts (
  id uuid default gen_random_uuid() primary key,
  mode text not null,
  window_size int not null,
  avoidable int not null default 0,
  fertile int not null default 0,
  observed int not null default 0,
  total int not null default 0,
  updated_at timestamptz default now(),
  unique (mode, window_size)
);

-- RLS: same as shared_what_happened — anonymous can read
alter table shared_chart_counts enable row level security;
drop policy if exists "Allow anonymous select" on shared_chart_counts;
create policy "Allow anonymous select" on shared_chart_counts for select using (true);

-- Only the trigger should write; anon cannot insert/update (keeps counts consistent)
-- No insert/update policy for anon = only trigger/service can write

-- Function: recompute chart counts for a given mode when shared_what_happened changes
create or replace function refresh_shared_chart_counts()
returns trigger as $$
declare
  v_mode text;
  v_avoid_10 int; v_fert_10 int; v_obs_10 int;
  v_avoid_50 int; v_fert_50 int; v_obs_50 int;
begin
  v_mode := coalesce(new.mode, old.mode, 'personal');

  -- Last 10: count by type for this mode
  with last10 as (
    select type from shared_what_happened
    where mode = v_mode
    order by created_at desc
    limit 10
  )
  select
    count(*) filter (where type = 'avoidable'),
    count(*) filter (where type = 'fertile'),
    count(*) filter (where type = 'observed')
  into v_avoid_10, v_fert_10, v_obs_10
  from last10;

  -- Last 50
  with last50 as (
    select type from shared_what_happened
    where mode = v_mode
    order by created_at desc
    limit 50
  )
  select
    count(*) filter (where type = 'avoidable'),
    count(*) filter (where type = 'fertile'),
    count(*) filter (where type = 'observed')
  into v_avoid_50, v_fert_50, v_obs_50
  from last50;

  insert into shared_chart_counts (mode, window_size, avoidable, fertile, observed, total, updated_at)
  values
    (v_mode, 10, coalesce(v_avoid_10,0), coalesce(v_fert_10,0), coalesce(v_obs_10,0),
     coalesce(v_avoid_10,0)+coalesce(v_fert_10,0)+coalesce(v_obs_10,0), now()),
    (v_mode, 50, coalesce(v_avoid_50,0), coalesce(v_fert_50,0), coalesce(v_obs_50,0),
     coalesce(v_avoid_50,0)+coalesce(v_fert_50,0)+coalesce(v_obs_50,0), now())
  on conflict (mode, window_size) do update set
    avoidable = excluded.avoidable,
    fertile = excluded.fertile,
    observed = excluded.observed,
    total = excluded.total,
    updated_at = excluded.updated_at;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Trigger: after insert (and optionally delete) on shared_what_happened
drop trigger if exists trg_refresh_chart_on_entries on shared_what_happened;
create trigger trg_refresh_chart_on_entries
  after insert or delete on shared_what_happened
  for each row execute function refresh_shared_chart_counts();

-- Backfill existing data for each mode
do $$
declare
  m text;
  a10 int; f10 int; o10 int;
  a50 int; f50 int; o50 int;
begin
  for m in select distinct mode from shared_what_happened
  loop
    with last10 as (
      select type from shared_what_happened where mode = m order by created_at desc limit 10
    )
    select
      count(*) filter (where type = 'avoidable'),
      count(*) filter (where type = 'fertile'),
      count(*) filter (where type = 'observed')
    into a10, f10, o10 from last10;

    with last50 as (
      select type from shared_what_happened where mode = m order by created_at desc limit 50
    )
    select
      count(*) filter (where type = 'avoidable'),
      count(*) filter (where type = 'fertile'),
      count(*) filter (where type = 'observed')
    into a50, f50, o50 from last50;

    insert into shared_chart_counts (mode, window_size, avoidable, fertile, observed, total, updated_at)
    values
      (m, 10, coalesce(a10,0), coalesce(f10,0), coalesce(o10,0), coalesce(a10,0)+coalesce(f10,0)+coalesce(o10,0), now()),
      (m, 50, coalesce(a50,0), coalesce(f50,0), coalesce(o50,0), coalesce(a50,0)+coalesce(f50,0)+coalesce(o50,0), now())
    on conflict (mode, window_size) do update set
      avoidable = excluded.avoidable, fertile = excluded.fertile, observed = excluded.observed,
      total = excluded.total, updated_at = excluded.updated_at;
  end loop;

  -- Ensure we have rows for personal and inside even if empty
  insert into shared_chart_counts (mode, window_size, avoidable, fertile, observed, total, updated_at)
  values
    ('personal', 10, 0, 0, 0, 0, now()),
    ('personal', 50, 0, 0, 0, 0, now()),
    ('inside', 10, 0, 0, 0, 0, now()),
    ('inside', 50, 0, 0, 0, 0, now())
  on conflict (mode, window_size) do nothing;
end $$;
