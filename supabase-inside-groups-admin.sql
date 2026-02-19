-- SlipUp Inside: Group administration (edit, members, remove, leave)
-- Run after supabase-inside-groups.sql
-- Adds: update_group_name, get_group_members, remove_member, leave_group
-- =============================================================================

-- RPC: Update group name (creator only)
create or replace function public.update_group_name(p_group_id uuid, p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if p_group_id is null then
    return json_build_object('success', false, 'error', 'Group required');
  end if;
  if p_group_id not in (select auth_my_creator_group_ids()) then
    return json_build_object('success', false, 'error', 'Only group creators can edit the name');
  end if;
  v_name := coalesce(nullif(trim(p_name), ''), 'My group');
  v_name := left(v_name, 80);
  update groups set name = v_name where id = p_group_id;
  return json_build_object('success', true, 'group_name', v_name);
end;
$$;
grant execute on function public.update_group_name(uuid, text) to authenticated;

-- RPC: Get members of a group (members can read; returns user_id, role, joined_at for remove/display)
create or replace function public.get_group_members(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_members json;
begin
  if auth.uid() is null then
    return json_build_object('members', '[]'::json, 'error', 'Not authenticated');
  end if;
  if p_group_id is null or p_group_id not in (select auth_my_group_ids()) then
    return json_build_object('members', '[]'::json, 'error', 'Not in this group');
  end if;
  select coalesce(json_agg(
    json_build_object('user_id', m.user_id, 'role', m.role, 'joined_at', m.joined_at)
  ), '[]'::json)
  into v_members
  from (
    select user_id, role, joined_at from group_members
    where group_id = p_group_id
    order by (role = 'creator') desc, joined_at asc
  ) m;
  return json_build_object('members', v_members);
end;
$$;
grant execute on function public.get_group_members(uuid) to authenticated;

-- RPC: Remove a member (creator only; cannot remove last creator)
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_count int;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if p_group_id is null or p_user_id is null then
    return json_build_object('success', false, 'error', 'Group and user required');
  end if;
  if p_group_id not in (select auth_my_creator_group_ids()) then
    return json_build_object('success', false, 'error', 'Only creators can remove members');
  end if;
  -- Cannot remove last creator
  select count(*) into v_creator_count from group_members where group_id = p_group_id and role = 'creator';
  if v_creator_count <= 1 then
    select count(*) into v_creator_count from group_members where group_id = p_group_id and user_id = p_user_id and role = 'creator';
    if v_creator_count > 0 then
      return json_build_object('success', false, 'error', 'Cannot remove the last creator. Transfer ownership or delete the group instead.');
    end if;
  end if;
  delete from group_members where group_id = p_group_id and user_id = p_user_id;
  if not found then
    return json_build_object('success', false, 'error', 'Member not found');
  end if;
  return json_build_object('success', true);
end;
$$;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- RPC: Leave group (member leaves; creator cannot leave if last creator)
create or replace function public.leave_group(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_count int;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if p_group_id is null then
    return json_build_object('success', false, 'error', 'Group required');
  end if;
  if p_group_id not in (select auth_my_group_ids()) then
    return json_build_object('success', false, 'error', 'You are not in this group');
  end if;
  -- Creator can't leave if last creator
  select count(*) into v_creator_count from group_members where group_id = p_group_id and role = 'creator';
  if v_creator_count <= 1 then
    if exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid() and role = 'creator') then
      return json_build_object('success', false, 'error', 'You are the last creator. Transfer ownership to another member first, or delete the group.');
    end if;
  end if;
  delete from group_members where group_id = p_group_id and user_id = auth.uid();
  return json_build_object('success', true);
end;
$$;
grant execute on function public.leave_group(uuid) to authenticated;

comment on function public.update_group_name(uuid, text) is 'Creator updates group name. Max 80 chars.';
comment on function public.get_group_members(uuid) is 'Members can list group members (user_id, role, joined_at).';
comment on function public.remove_member(uuid, uuid) is 'Creator removes a member. Cannot remove last creator.';
comment on function public.leave_group(uuid) is 'Member leaves group. Creator cannot leave if last creator.';

-- RPC: Transfer ownership to another member (creator only; must be existing member)
create or replace function public.transfer_ownership(p_group_id uuid, p_new_creator_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if p_group_id is null or p_new_creator_user_id is null then
    return json_build_object('success', false, 'error', 'Group and member required');
  end if;
  if p_group_id not in (select auth_my_creator_group_ids()) then
    return json_build_object('success', false, 'error', 'Only creators can transfer ownership');
  end if;
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = p_new_creator_user_id) then
    return json_build_object('success', false, 'error', 'Member not in this group');
  end if;
  if p_new_creator_user_id = auth.uid() then
    return json_build_object('success', false, 'error', 'You are already the creator');
  end if;
  update group_members set role = 'member' where group_id = p_group_id and user_id = auth.uid();
  update group_members set role = 'creator' where group_id = p_group_id and user_id = p_new_creator_user_id;
  update groups set created_by = p_new_creator_user_id where id = p_group_id;
  return json_build_object('success', true);
end;
$$;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
comment on function public.transfer_ownership(uuid, uuid) is 'Creator transfers ownership to another member.';

-- RPC: List active invites for a group (creator only)
create or replace function public.get_group_invites(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invites json;
begin
  if auth.uid() is null then
    return json_build_object('invites', '[]'::json, 'error', 'Not authenticated');
  end if;
  if p_group_id is null or p_group_id not in (select auth_my_creator_group_ids()) then
    return json_build_object('invites', '[]'::json, 'error', 'Only creators can view invites');
  end if;
  select coalesce(json_agg(
    json_build_object('id', gi.id, 'invite_token', gi.invite_token, 'expires_at', gi.expires_at, 'created_at', gi.created_at)
  ), '[]'::json)
  into v_invites
  from (select id, invite_token, expires_at, created_at from group_invites where group_id = p_group_id order by created_at desc) gi;
  return json_build_object('invites', v_invites);
end;
$$;
grant execute on function public.get_group_invites(uuid) to authenticated;

-- RPC: Cancel an invite (creator only)
create or replace function public.cancel_group_invite(p_group_id uuid, p_invite_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  if p_group_id is null or p_invite_id is null then
    return json_build_object('success', false, 'error', 'Group and invite required');
  end if;
  if p_group_id not in (select auth_my_creator_group_ids()) then
    return json_build_object('success', false, 'error', 'Only creators can cancel invites');
  end if;
  delete from group_invites where id = p_invite_id and group_id = p_group_id;
  if not found then
    return json_build_object('success', false, 'error', 'Invite not found');
  end if;
  return json_build_object('success', true);
end;
$$;
grant execute on function public.cancel_group_invite(uuid, uuid) to authenticated;
