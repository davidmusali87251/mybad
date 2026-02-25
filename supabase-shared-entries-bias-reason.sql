-- Add bias_reason to shared entries (Observed: harm, failed, different, triggered, unsure)
-- Run once in Supabase SQL Editor. Add to shared_entries_personal / shared_entries_inside if you use those.

alter table public.shared_what_happened add column if not exists bias_reason text;
comment on column public.shared_what_happened.bias_reason is 'Bias Check choice for observed: harm | failed | different | triggered | unsure';

-- If using shared_entries_personal or shared_entries_inside tables, run the matching line(s):
alter table public.shared_entries_personal add column if not exists bias_reason text;
comment on column public.shared_entries_personal.bias_reason is 'Bias Check choice for observed: harm | failed | different | triggered | unsure';
-- alter table public.shared_entries_inside add column if not exists bias_reason text;
