-- Optional: add type breakdown to shared_stats for richer "Others' results" display.
-- Run in Supabase SQL Editor. Existing rows get NULL; new shares include avoidable/fertile/observed.
-- Personal: shared_stats. Inside: shared_stats_inside.

alter table shared_stats
  add column if not exists avoidable_count int,
  add column if not exists fertile_count int,
  add column if not exists observed_count int;

alter table shared_stats_inside
  add column if not exists avoidable_count int,
  add column if not exists fertile_count int,
  add column if not exists observed_count int;
