-- Key/value settings table for admin-managed configuration.
-- Used to store dues amounts so the treasurer can update them
-- without a code deployment.

create table public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Seed default dues amounts (in dollars)
insert into public.settings (key, value) values
  ('dues_freshman',      '300'),
  ('dues_returning',     '300'),
  ('dues_new_sophomore', '400'),
  ('dues_new_junior',    '575'),
  ('dues_new_senior',    '895'),
  ('late_fee',           '100');

-- RLS: public can read (join form needs pricing), only service role can write
alter table public.settings enable row level security;

create policy "Allow public read" on public.settings
  for select using (true);
