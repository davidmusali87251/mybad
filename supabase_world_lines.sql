-- World Lines (SlipUp Social) — one short anonymous line, filtered by client_day (local day).
-- Run in Supabase SQL Editor. Safe for web / PWA / iOS (RLS only).

create extension if not exists pgcrypto;

-- world_lines
create table if not exists public.world_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_day date not null,
  mode text not null check (mode in ('personal','inside')),
  type text not null check (type in ('avoidable','fertile','observed','any')),
  theme text not null check (theme in ('calm','focus','stressed','curious','tired','any')),
  text varchar(90) not null,
  hidden boolean not null default false
);

alter table public.world_lines
  add constraint world_lines_text_not_blank
  check (char_length(btrim(text)) >= 1);

create index if not exists world_lines_client_day_idx on public.world_lines (client_day);
create index if not exists world_lines_created_at_idx on public.world_lines (created_at desc);
create index if not exists world_lines_hidden_idx on public.world_lines (hidden);
create index if not exists world_lines_client_day_created_idx on public.world_lines (client_day, created_at desc);

alter table public.world_lines enable row level security;

drop policy if exists "Public read world lines" on public.world_lines;
create policy "Public read world lines"
  on public.world_lines for select
  using (hidden = false);

drop policy if exists "Public insert world lines" on public.world_lines;
create policy "Public insert world lines"
  on public.world_lines for insert
  with check (hidden = false);

-- world_line_reports (insert-only)
create table if not exists public.world_line_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  line_id uuid not null references public.world_lines(id) on delete cascade
);

create index if not exists world_line_reports_line_id_idx on public.world_line_reports (line_id);
create index if not exists world_line_reports_created_at_idx on public.world_line_reports (created_at desc);

alter table public.world_line_reports enable row level security;

drop policy if exists "Public insert world line reports" on public.world_line_reports;
create policy "Public insert world line reports"
  on public.world_line_reports for insert
  with check (true);
