-- Add qb_payment_id to students table
-- This stores the QuickBooks Payment entity ID so the webhook can
-- match an incoming payment notification to the correct student record.

alter table public.students
  add column if not exists qb_payment_id text;

create index if not exists students_qb_payment_id_idx
  on public.students (qb_payment_id);
