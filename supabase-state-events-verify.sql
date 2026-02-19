-- Run this in Supabase → SQL Editor (New query, paste, Run).
-- 1) First query: lists all tables in public schema. Look for "state_events".
-- 2) Second query: if state_events exists, returns one row; if table missing, you get an error.

SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- If the above shows state_events, the table exists. Then in Table Editor (left sidebar):
--   - Click the schema dropdown and choose "public" if it isn’t already.
--   - Refresh the page (F5 or reload). You should see state_events in the list.
--
-- Quick check that the table is readable (run alone if you like):
-- SELECT count(*) FROM state_events;
