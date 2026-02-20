-- SlipUp Inside: Group Mode Upgrade (Phases 1–4)
-- Run after supabase-inside-groups.sql and supabase-community-entries-inside.sql
-- Adds: user_id for participation tracking, invite preview, participation RPCs, moderator role, group settings
-- =============================================================================

-- Phase 1: user_id for participation tracking ("X of Y checked in today")
alter table public.shared_entries_inside add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists shared_entries_inside_user_id_idx on shared_entries_inside (user_id);
comment on column public.shared_entries_inside.user_id is 'Authenticated user who shared; enables participation count (who checked in today).';

alter table public.shared_what_happened add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists shared_what_happened_user_id_idx on shared_what_happened (user_id);
comment on column public.shared_what_happened.user_id is 'Authenticated user (Inside mode); null for anonymous personal.';

-- Phase 1: RPC — Invite preview (group name + member count, no safe before join)
create or replace function public.get_invite_preview(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_group_id uuid;
  v_group_name text;
  v_member_count int;
  v_expires_at timestamptz;
begin
  select gi.group_id, gi.expires_at into v_group_id, v_expires_at
  from group_invites gi where gi.invite_token = p_token;
  if v_group_id is null then
    return json_build_object('exists', false);
  end if;
  if v_expires_at is not null and v_expires_at < now() then
    return json_build_object('exists', true, 'expired', true);
  end if;
  select g.name into v_group_name from groups g where g.id = v_group_id;
  select count(*) into v_member_count from group_members where group_id = v_group_id;
  return json_build_object(
    'exists', true,
    'group_name', coalesce(v_group_name, 'Group'),
    'member_count', v_member_count,
    'expired', false
  );
end;
$$;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
comment on function public.get_invite_preview(text) is 'Preview invite: group name + member count. No auth required.';

-- Phase 1: RPC — Participation today (distinct users who shared to group today)
-- Supports both shared_entries_inside and shared_what_happened
create or replace function public.get_group_participation_today(p_group_id uuid, p_use_entries_inside boolean default true)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_participant_count int := 0;
  v_total_members int;
  v_today_start timestamptz;
begin
  if p_group_id is null then
    return json_build_object('participant_count', 0, 'member_count', 0, 'error', 'Group required');
  end if;
  select count(*) into v_total_members from group_members where group_id = p_group_id;
  v_today_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if p_use_entries_inside then
    select count(distinct user_id) into v_participant_count
    from shared_entries_inside
    where group_id = p_group_id and created_at >= v_today_start and user_id is not null;
  else
    select count(distinct user_id) into v_participant_count
    from shared_what_happened
    where mode = 'inside' and group_id = p_group_id and created_at >= v_today_start and user_id is not null;
  end if;

  return json_build_object(
    'participant_count', least(v_participant_count, v_total_members),
    'member_count', v_total_members
  );
end;
$$;
grant execute on function public.get_group_participation_today(uuid, boolean) to authenticated;
comment on function public.get_group_participation_today(uuid, boolean) is 'How many members shared today. Used for participation block.';

-- Phase 2: Group streak (consecutive days with at least one share) — must exist before get_group_activity_summary
create or replace function public.get_group_streak_days(p_group_id uuid)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_streak int := 0;
  v_date date;
  v_cur date;
  v_has_share int;
begin
  if p_group_id is null then return 0; end if;
  v_cur := (current_date at time zone 'UTC')::date;
  loop
    select 1 into v_has_share
    from shared_entries_inside
    where group_id = p_group_id
      and (created_at at time zone 'UTC')::date = v_cur
    limit 1;
    if v_has_share is null then exit; end if;
    v_streak := v_streak + 1;
    v_cur := v_cur - interval '1 day';
  end loop;
  return v_streak;
end;
$$;
grant execute on function public.get_group_streak_days(uuid) to authenticated;
comment on function public.get_group_streak_days(uuid) is 'Consecutive days (including today) with at least one shared moment.';

-- Phase 1: RPC — Group activity summary (for activity feed)
create or replace function public.get_group_activity_summary(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_member_count int;
  v_shared_count int;
  v_participant_today int;
  v_today_start timestamptz;
begin
  if p_group_id is null then
    return json_build_object('member_count', 0, 'shared_count', 0, 'participant_today', 0);
  end if;
  select count(*) into v_member_count from group_members where group_id = p_group_id;
  select count(*) into v_shared_count from shared_entries_inside where group_id = p_group_id;
  v_today_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  select count(distinct user_id) into v_participant_today
  from shared_entries_inside where group_id = p_group_id and created_at >= v_today_start and user_id is not null;
  return json_build_object(
    'member_count', v_member_count,
    'shared_count', v_shared_count,
    'participant_today', v_participant_today,
    'shares_today', (select count(*) from shared_entries_inside where group_id = p_group_id and created_at >= v_today_start),
    'streak_days', (select get_group_streak_days(p_group_id))
  );
end;
$$;
grant execute on function public.get_group_activity_summary(uuid) to authenticated;

-- Phase 2/3: groups.mode for collaborative (future: supportive, etc.)
alter table public.groups add column if not exists mode text default 'collaborative' check (mode in ('collaborative', 'supportive'));
comment on column public.groups.mode is 'Group vibe: collaborative (default) or supportive. No competitive per ARCHITECTURE.';

-- Phase 4: moderator role
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check
  check (role in ('creator', 'moderator', 'member'));
