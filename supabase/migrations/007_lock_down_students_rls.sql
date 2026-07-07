-- Lock down the students table: no client-side (anon key) access at all.
-- Run this in the Supabase SQL Editor.
--
-- The original policies from 001 were created without a `to` clause, so they
-- applied to ALL roles — meaning anyone with the public URL + publishable key
-- could SELECT (and via the "full access" policy, UPDATE/DELETE) the entire
-- roster of minors' names and guardian contact info from the browser.
--
-- Every read/write now goes through server API routes using the service role
-- key, which bypasses RLS — so no policies are needed at all:
--   inserts:  /api/belles-beaux/submit, /api/admin/students/add
--   reads:    /api/admin/students (admin roster)
--   updates:  /api/admin/students/[id]/mark-paid, /api/quickbooks/webhook
--   deletes:  /api/admin/students/[id]

drop policy if exists "Allow public insert" on public.students;
drop policy if exists "Allow service role full access" on public.students;

-- RLS stays enabled with no policies = anon and authenticated keys get nothing.
