-- Fix: infinite recursion in group_members RLS + groups insert RLS
-- Run this in Supabase SQL Editor
-- =============================================================================

-- RPC: Create group and add creator (bypasses RLS)
create or replace function public.create_group(group_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_group_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  v_group_name := coalesce(nullif(trim(group_name), ''), 'My group');
  v_group_name := left(v_group_name, 80);
  insert into groups (name, created_by) values (v_group_name, v_user_id)
  returning id, name into v_group_id, v_group_name;
  insert into group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'creator');
  return json_build_object('success', true, 'group_id', v_group_id, 'group_name', v_group_name);
end;
$$;
grant execute on function public.create_group(text) to authenticated;

-- Helper: returns group_ids the current user belongs to (bypasses RLS to avoid recursion)
create or replace function public.auth_my_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

-- Helper: returns group_ids where current user is creator
create or replace function public.auth_my_creator_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from public.group_members where user_id = auth.uid() and role = 'creator';
$$;

grant execute on function public.auth_my_group_ids() to authenticated;
grant execute on function public.auth_my_group_ids() to anon;
grant execute on function public.auth_my_creator_group_ids() to authenticated;

-- Drop and recreate group_members policies (no self-reference)
drop policy if exists "Members can read their group members" on group_members;
create policy "Members can read their group members"
  on group_members for select
  using (group_id in (select auth_my_group_ids()));

drop policy if exists "Creators can add members; creator can add self when creating" on group_members;
create policy "Creators can add members; creator can add self when creating"
  on group_members for insert
  to authenticated
  with check (
    group_id in (select id from groups where created_by = auth.uid())
    or
    group_id in (select auth_my_creator_group_ids())
  );

drop policy if exists "Creators can delete members" on group_members;
create policy "Creators can delete members"
  on group_members for delete
  to authenticated
  using (group_id in (select auth_my_creator_group_ids()));

-- Fix groups policies that reference group_members (can also cause recursion)
drop policy if exists "Users can read groups they belong to" on groups;
create policy "Users can read groups they belong to"
  on groups for select
  using (id in (select auth_my_group_ids()));

drop policy if exists "Creators can update their groups" on groups;
create policy "Creators can update their groups"
  on groups for update
  to authenticated
  using (
    created_by = auth.uid()
    or id in (select auth_my_creator_group_ids())
  );

-- Fix group_invites policies that reference group_members
drop policy if exists "Creators can create invites" on group_invites;
create policy "Creators can create invites"
  on group_invites for insert
  to authenticated
  with check (group_id in (select auth_my_creator_group_ids()));

drop policy if exists "Creators can delete invites" on group_invites;
create policy "Creators can delete invites"
  on group_invites for delete
  to authenticated
  using (group_id in (select auth_my_creator_group_ids()));

-- Fix shared tables (if they had recursive group_members refs)
drop policy if exists "Auth insert inside with group" on shared_what_happened;
create policy "Auth insert inside with group" on shared_what_happened for insert to authenticated
  with check (mode = 'inside' and group_id is not null and group_id in (select auth_my_group_ids()));

drop policy if exists "Auth select inside own groups" on shared_what_happened;
create policy "Auth select inside own groups" on shared_what_happened for select to authenticated
  using ((mode = 'personal' and group_id is null) or (mode = 'inside' and group_id in (select auth_my_group_ids())));

drop policy if exists "Auth insert stats for own group" on shared_stats_inside;
create policy "Auth insert stats for own group" on shared_stats_inside for insert to authenticated
  with check (group_id is not null and group_id in (select auth_my_group_ids()));

drop policy if exists "Auth select stats for own groups" on shared_stats_inside;
create policy "Auth select stats for own groups" on shared_stats_inside for select to authenticated
  using (group_id in (select auth_my_group_ids()));

drop policy if exists "Auth insert inside intentions" on shared_intentions;
create policy "Auth insert inside intentions" on shared_intentions for insert to authenticated
  with check (mode = 'inside' and group_id is not null and group_id in (select auth_my_group_ids()));

drop policy if exists "Auth select inside intentions" on shared_intentions;
create policy "Auth select inside intentions" on shared_intentions for select to authenticated
  using (mode = 'personal' or (mode = 'inside' and group_id in (select auth_my_group_ids())));
