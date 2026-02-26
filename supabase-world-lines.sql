-- World Lines (SlipUp Social)
-- Run in Supabase SQL Editor. Safe for web / PWA / iOS (RLS only; no service changes).

-- (Optional but safe) ensure gen_random_uuid() exists
create extension if not exists pgcrypto;

-- 1) world_lines
create table if not exists public.world_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- mode is optional but useful if you want to separate Inside vs Personal later
  mode text not null default 'personal' check (mode in ('personal','inside')),

  -- Sacred strings + optional 'any'
  type text not null check (type in ('avoidable','fertile','observed','any')),
  theme text not null check (theme in ('calm','focus','stressed','curious','tired','any')),

  -- One-line reflection
  text varchar(90) not null,
  -- optional client-side grouping; not required for v1
  client_day date null,

  -- moderation
  hidden boolean not null default false
);

-- Prevent empty/whitespace-only lines
alter table public.world_lines
  add constraint world_lines_text_not_blank
  check (char_length(btrim(text)) >= 1);

-- Helpful indexes (recent feed + filters)
create index if not exists world_lines_created_at_idx on public.world_lines (created_at desc);
create index if not exists world_lines_type_idx on public.world_lines (type);
create index if not exists world_lines_theme_idx on public.world_lines (theme);
create index if not exists world_lines_client_day_idx on public.world_lines (client_day);

-- RLS
alter table public.world_lines enable row level security;

-- Public read: only non-hidden
drop policy if exists "Public read world lines" on public.world_lines;
create policy "Public read world lines"
on public.world_lines
for select
using (hidden = false);

-- Public insert: allow anonymous insert; row must not be hidden
drop policy if exists "Public insert world lines" on public.world_lines;
create policy "Public insert world lines"
on public.world_lines
for insert
with check (hidden = false);

-- No public update/delete policies (so they're denied by default with RLS on)


-- 2) world_line_reports (insert-only, no reads)
create table if not exists public.world_line_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  line_id uuid not null references public.world_lines(id) on delete cascade,

  -- Optional reason; keep short + calm
  reason varchar(120) null
);

create index if not exists world_line_reports_line_id_idx on public.world_line_reports (line_id);
create index if not exists world_line_reports_created_at_idx on public.world_line_reports (created_at desc);

alter table public.world_line_reports enable row level security;

-- Anyone can submit a report (insert-only)
drop policy if exists "Public insert world line reports" on public.world_line_reports;
create policy "Public insert world line reports"
on public.world_line_reports
for insert
with check (true);

-- No select/update/delete policies => denied publicly
