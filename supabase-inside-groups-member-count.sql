-- SlipUp Inside: Get group member count (anonymous)
-- Run after supabase-inside-groups.sql
-- Allows showing "X members" in the UI without exposing identities.
-- Only returns count for groups the user belongs to (RLS via auth).
-- =============================================================================

create or replace function public.get_group_member_count(p_group_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_group_id in (select auth_my_group_ids()) then
      (select count(*)::int from public.group_members where group_id = p_group_id)
    else null
  end;
$$;

comment on function public.get_group_member_count(uuid) is 'Returns member count for a group. Caller must be in the group (checked by RLS on group_members when called from client).';

-- Allow authenticated users; the client will call with a group_id they belong to
grant execute on function public.get_group_member_count(uuid) to authenticated;
