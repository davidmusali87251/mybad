-- State events: register each possible state element with anonymous_id (short types).
-- Use for analytics, funnels, or dashboards — all anonymous.
--
-- TABLE SHAPE: 6 columns only — id, anonymous_id, kind, value, mode, created_at.
-- The "elements" are not 6 columns: they are the possible (kind, value) pairs below.
-- Each event = one ROW with one kind and one value (e.g. kind='phase', value='social').
--
-- THE TABLE WILL NOT APPEAR IN SUPABASE UNTIL YOU RUN THIS SCRIPT.
--
-- HOW TO RUN: In Supabase Dashboard → SQL Editor → New query:
--   1. Copy ALL the SQL below (from "create table" to the end of the last "create policy" line)
--   2. Paste into the query box and click Run
--   3. Table Editor (left sidebar) → refresh if needed → you should see "state_events"
-- =============================================================================
--
-- Possible (kind, value) pairs — one row per event; kind and value are text columns:
--
--   kind            | values
--   ----------------+----------------------------------------------------------------------
--   phase           | personal | social | inside | group
--   period          | day | week | month
--   filter_type     | all | avoidable | fertile | observed
--   filter_theme    | all | calm | focus | stressed | curious | tired
--   entry_type      | avoidable | fertile | observed   (when adding an entry)
--   theme           | calm | focus | stressed | curious | tired   (mood at log time)
--   bias_reason     | harm | failed | different | triggered | unsure   (Bias Check choice)
--   streak_choice   | discipline | responsibility | pressure | curiosity | fear | commitment | not-sure
--   view            | main | add_section | stats | insights | micro_goal | trends | line_chart |
--                   | export_section | reflection_section | reflection_history | community_section |
--                   | community_entries | global_chart | social_share | settings | streak_panel |
--                   | bias_check_overlay | others_results | world_slipups
--   action          | share | add_entry | add_from_community | add_from_empty | export_csv |
--                   | export_json | export_reflections | reminder_on | reminder_off | payment_click |
--                   | unlock_click | bias_check_open | refresh_feed | refresh_entries |
--                   | shared_entries_toggle | add_to_home_dismiss | micro_goal_share
--   filter_type_personal | all | avoidable | fertile | observed   (personal history filter)
--   mode            | personal | inside   (app mode; stored in column "mode", optional)
--

create table if not exists public.state_events (
  id uuid default gen_random_uuid() primary key,
  anonymous_id text not null,
  kind text not null,
  value text not null,
  mode text,
  created_at timestamptz default now()
);

comment on table public.state_events is 'Anonymous state/event log: phase, filters, views, actions (short types).';
comment on column public.state_events.kind is 'Short type: phase | period | filter_type | filter_theme | entry_type | bias_reason | streak_choice | view | action | filter_type_personal';
comment on column public.state_events.value is 'Short value, e.g. personal, focus, share';
comment on column public.state_events.mode is 'App mode when event occurred: personal | inside';

create index if not exists state_events_anonymous_id_idx on state_events (anonymous_id);
create index if not exists state_events_kind_idx on state_events (kind);
create index if not exists state_events_created_at_idx on state_events (created_at desc);
create index if not exists state_events_kind_value_idx on state_events (kind, value);

alter table state_events enable row level security;

drop policy if exists "Allow anonymous insert" on state_events;
create policy "Allow anonymous insert" on state_events for insert with check (true);

-- No select/update/delete for anon: app only inserts; use Dashboard or service role to query
--
-- WHY THE TABLE IS EMPTY: Rows appear only when the app sends events. Ensure (1) config has
-- SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_STATE_EVENTS_TABLE: 'state_events', (2) you use
-- the app (switch phase, add entry, share, change filters, etc.). To see sample data, use
-- Table Editor → Import data from CSV and choose supabase-state-events-sample.csv (columns:
-- anonymous_id, kind, value, mode; id and created_at are optional / auto-filled).
--
-- If you don't see "state_events" in Table Editor, run supabase-state-events-verify.sql
-- in SQL Editor to list all public tables. In Table Editor, set the schema dropdown to "public".
--
-- ADD MORE COLUMNS: Run supabase-state-events-add-columns.sql to add optional columns
-- (source, session_id, extra). The app can then send those when inserting.
