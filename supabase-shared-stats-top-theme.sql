-- Add top_theme (most common mood) to shared stats for display in Recent shares.
-- Run in Supabase SQL Editor. New shares will include "mostly calm", "mostly tired", etc.
-- Existing rows get NULL; UI shows nothing when absent.

alter table shared_stats
  add column if not exists top_theme text;

alter table shared_stats_inside
  add column if not exists top_theme text;
