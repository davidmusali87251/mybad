-- Sessions table: one row per app session (joinable with state_events).
-- A trigger creates a session row when the first event with that session_id arrives.
-- JOIN state_events to sessions on session_id; join to shared_stats, shared_what_happened,
-- streak_reflections on anonymous_id for integrated analytics.
--
-- Run after supabase-state-events.sql and supabase-state-events-add-columns.sql.
-- =============================================================================

create table if not exists public.sessions (
  session_id text primary key,
  anonymous_id text not null,
  mode text,
  started_at timestamptz default now()
);

comment on table public.sessions is 'One row per app session; created when first state_events row with that session_id is inserted.';
create index if not exists sessions_anonymous_id_idx on public.sessions (anonymous_id);
create index if not exists sessions_started_at_idx on public.sessions (started_at desc);

alter table public.sessions enable row level security;

create or replace function public.state_events_ensure_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.sessions (session_id, anonymous_id, mode, started_at)
  values (new.session_id, new.anonymous_id, new.mode, coalesce(new.created_at, now()))
  on conflict (session_id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists state_events_ensure_session_trigger on public.state_events;
create trigger state_events_ensure_session_trigger
  after insert on public.state_events
  for each row
  when (new.session_id is not null and new.session_id <> '')
  execute function public.state_events_ensure_session();

-- Example: events with session start time
--   SELECT e.kind, e.value, e.source, e.created_at, s.started_at
--   FROM state_events e
--   LEFT JOIN sessions s ON s.session_id = e.session_id
--   ORDER BY e.created_at DESC;
-- Example: event count per session
--   SELECT s.session_id, s.anonymous_id, s.started_at, count(e.id) AS events
--   FROM sessions s
--   LEFT JOIN state_events e ON e.session_id = s.session_id
--   GROUP BY s.session_id, s.anonymous_id, s.started_at;
-- Same anonymous_id appears in shared_stats, shared_what_happened, streak_reflections:
--   join those with state_events or sessions on anonymous_id for integrated analytics.
