-- Add optional columns to state_events. Run in Supabase → SQL Editor after the main table exists.
-- Existing rows get NULL for new columns; new inserts can fill them.
-- =============================================================================

alter table public.state_events
  add column if not exists source text,
  add column if not exists session_id text,
  add column if not exists extra jsonb;

comment on column public.state_events.source is 'Optional: where the event came from (e.g. personal_view, social_view, overlay)';
comment on column public.state_events.session_id is 'Optional: group events in the same session (e.g. one per tab load)';
comment on column public.state_events.extra is 'Optional: extra key-value data (JSON)';

create index if not exists state_events_session_id_idx on state_events (session_id) where session_id is not null;
create index if not exists state_events_source_idx on state_events (source) where source is not null;
