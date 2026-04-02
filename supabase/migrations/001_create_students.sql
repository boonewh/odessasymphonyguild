-- Belles & Beaux student records
-- Run this in the Supabase SQL Editor

create table public.students (
  -- Identity
  id              uuid primary key default gen_random_uuid(),
  school_year     text not null,
  submitted_at    timestamptz not null default now(),

  -- Student info
  first_name      text not null,
  middle_name     text,
  last_name       text not null,
  nickname        text,
  cell_number     text not null,
  school          text not null,
  grade           text not null,  -- '9' | '10' | '11' | '12'
  gender          text not null,
  tshirt_size     text not null,

  -- Membership
  membership_type text not null,  -- 'freshman' | 'returning' | 'new_sophomore' | 'new_junior' | 'new_senior'
  dues_amount     integer not null, -- stored in dollars (300, 400, 575, 895)

  -- Mom
  mom_name           text,
  mom_address        text,
  mom_city           text,
  mom_state          text,
  mom_zip            text,
  mom_cell           text,
  mom_email          text,
  mom_formal_name    text,

  -- Dad
  dad_name           text,
  dad_address        text,
  dad_city           text,
  dad_state          text,
  dad_zip            text,
  dad_cell           text,
  dad_email          text,
  dad_formal_name    text,

  -- Payment tracking
  paid            boolean not null default false,
  paid_at         timestamptz,

  -- QuickBooks (filled in once QB is connected)
  qb_customer_id  text,
  qb_invoice_id   text,
  qb_payment_link text
);

-- Useful indexes for the admin roster
create index students_school_year_idx on public.students (school_year);
create index students_paid_idx        on public.students (paid);
create index students_last_name_idx   on public.students (last_name);

-- Row-level security — enable but keep open for now (tighten once auth is added)
alter table public.students enable row level security;

-- Temporary: allow all inserts from the anon key (the form submits as anon)
create policy "Allow public insert" on public.students
  for insert with check (true);

-- Temporary: allow service role full access (API route reads/writes)
create policy "Allow service role full access" on public.students
  using (true)
  with check (true);
