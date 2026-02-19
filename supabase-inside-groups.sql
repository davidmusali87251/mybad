-- SlipUp Inside: Auth + Groups
-- Run in Supabase Dashboard → SQL Editor
-- Enables login and group-scoped sharing for Inside only. Personal app stays anonymous.
-- =============================================================================

-- 1. Groups table
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

comment on table public.groups is 'SlipUp Inside groups. Creator and members can share within the group.';
create index if not exists groups_created_by_idx on groups (created_by);

-- 2. Group members (who belongs to which group)
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('creator', 'member')),
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

comment on table public.group_members is 'Members of SlipUp Inside groups.';
create index if not exists group_members_group_id_idx on group_members (group_id);
create index if not exists group_members_user_id_idx on group_members (user_id);

-- 3. Group invites (invite link or email)
create table if not exists public.group_invites (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null references groups(id) on delete cascade,
  invite_token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.group_invites is 'Invite links for SlipUp Inside groups. Share link to add members.';
create index if not exists group_invites_token_idx on group_invites (invite_token);
create index if not exists group_invites_group_id_idx on group_invites (group_id);

-- 4. Add group_id to shared tables (for Inside only; null for personal)
alter table public.shared_what_happened add column if not exists group_id uuid references groups(id) on delete set null;
alter table public.shared_stats_inside add column if not exists group_id uuid references groups(id) on delete set null;
alter table public.shared_intentions add column if not exists group_id uuid references groups(id) on delete set null;

create index if not exists shared_what_happened_group_mode_idx on shared_what_happened (group_id, mode);
create index if not exists shared_stats_inside_group_idx on shared_stats_inside (group_id);

-- 5. Helper functions (avoid RLS recursion when policies reference same table)
create or replace function public.auth_my_group_ids()
returns setof uuid language sql security definer set search_path = public stable
as $$ select group_id from public.group_members where user_id = auth.uid(); $$;

create or replace function public.auth_my_creator_group_ids()
returns setof uuid language sql security definer set search_path = public stable
as $$ select group_id from public.group_members where user_id = auth.uid() and role = 'creator'; $$;

grant execute on function public.auth_my_group_ids() to authenticated, anon;
grant execute on function public.auth_my_creator_group_ids() to authenticated;

-- 6. RLS for groups
alter table groups enable row level security;

create policy "Users can read groups they belong to"
  on groups for select using (id in (select auth_my_group_ids()));

create policy "Authenticated users can create groups"
  on groups for insert to authenticated with check (auth.uid() = created_by);

create policy "Creators can update their groups"
  on groups for update to authenticated
  using (created_by = auth.uid() or id in (select auth_my_creator_group_ids()));

-- 7. RLS for group_members
alter table group_members enable row level security;

create policy "Members can read their group members"
  on group_members for select using (group_id in (select auth_my_group_ids()));

create policy "Creators can add members; creator can add self when creating"
  on group_members for insert to authenticated
  with check (
    group_id in (select id from groups where created_by = auth.uid())
    or group_id in (select auth_my_creator_group_ids())
  );

create policy "Creators can delete members"
  on group_members for delete to authenticated
  using (group_id in (select auth_my_creator_group_ids()));

-- 8. RLS for group_invites
alter table group_invites enable row level security;

create policy "Anyone can read invite by token (for join flow)"
  on group_invites for select using (true);

create policy "Creators can create invites"
  on group_invites for insert to authenticated
  with check (group_id in (select auth_my_creator_group_ids()));

create policy "Creators can delete invites"
  on group_invites for delete to authenticated
  using (group_id in (select auth_my_creator_group_ids()));

-- RPC: Create group and add creator (bypasses RLS; avoids auth.uid() issues)
create or replace function public.create_group(group_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
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

-- RPC: Join group via invite token (user calls this after login)
create or replace function public.join_group_by_invite(invite_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_expires_at timestamptz;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  select gi.group_id, gi.expires_at into v_group_id, v_expires_at
  from group_invites gi
  where gi.invite_token = join_group_by_invite.invite_token;
  if v_group_id is null then
    return json_build_object('success', false, 'error', 'Invalid invite');
  end if;
  if v_expires_at is not null and v_expires_at < now() then
    return json_build_object('success', false, 'error', 'Invite expired');
  end if;
  insert into group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'member')
  on conflict (group_id, user_id) do nothing;
  return json_build_object('success', true, 'group_id', v_group_id);
end;
$$;
grant execute on function public.join_group_by_invite(text) to authenticated;

-- 8. shared_what_happened: keep anon for personal, add auth for inside
-- Existing anon policies stay for mode=personal (no group_id)
-- New: authenticated users can insert/select when mode=inside and in group

drop policy if exists "Allow anonymous insert" on shared_what_happened;
create policy "Anon insert personal only"
  on shared_what_happened for insert
  to anon
  with check (mode = 'personal' and group_id is null);

drop policy if exists "Allow anonymous select" on shared_what_happened;
create policy "Anon select personal only"
  on shared_what_happened for select
  to anon
  using (mode = 'personal' and group_id is null);

create policy "Auth insert inside with group"
  on shared_what_happened for insert to authenticated
  with check (mode = 'inside' and group_id is not null and group_id in (select auth_my_group_ids()));

create policy "Auth select inside own groups"
  on shared_what_happened for select to authenticated
  using ((mode = 'personal' and group_id is null) or (mode = 'inside' and group_id in (select auth_my_group_ids())));

-- 9. shared_stats_inside: require auth + group
alter table shared_stats_inside enable row level security;

drop policy if exists "Allow anonymous insert" on shared_stats_inside;
drop policy if exists "Allow anonymous select" on shared_stats_inside;

create policy "Auth insert stats for own group"
  on shared_stats_inside for insert to authenticated
  with check (
    group_id is not null
    and group_id in (select auth_my_group_ids())
  );

create policy "Auth select stats for own groups"
  on shared_stats_inside for select to authenticated
  using (group_id in (select auth_my_group_ids()));

-- 10. shared_intentions: anon for personal, auth for inside
drop policy if exists "Allow anonymous insert" on shared_intentions;
create policy "Anon insert personal intentions"
  on shared_intentions for insert to anon
  with check (mode = 'personal' and group_id is null);

drop policy if exists "Allow anonymous select" on shared_intentions;
create policy "Anon select personal intentions"
  on shared_intentions for select to anon
  using (mode = 'personal');

create policy "Auth insert inside intentions"
  on shared_intentions for insert to authenticated
  with check (mode = 'inside' and group_id is not null and group_id in (select auth_my_group_ids()));

create policy "Auth select inside intentions"
  on shared_intentions for select to authenticated
  using (mode = 'personal' or (mode = 'inside' and group_id in (select auth_my_group_ids())));
