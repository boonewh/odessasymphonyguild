-- Track admin-applied late fees on student records.
-- Late fees are applied manually from the admin roster, not automatically
-- at the deadline. late_fee_amount stores what was actually added so it
-- can be removed exactly, even if the configured fee changes later.
-- Run this in the Supabase SQL Editor.

alter table public.students
  add column if not exists late_fee_applied boolean not null default false,
  add column if not exists late_fee_amount  integer;
