-- Prospective Belles & Beaux families for the following season.
-- Public clients have no direct table access; submissions and admin reads
-- both pass through server routes using the service role.

create table public.belles_beaux_interests (
  id            uuid primary key default gen_random_uuid(),
  submitted_at  timestamptz not null default now(),
  interest_year text not null,
  student_name  text not null check (char_length(student_name) between 2 and 120),
  parent_name   text not null check (char_length(parent_name) between 2 and 120),
  school        text not null check (char_length(school) between 2 and 120),
  parent_email  text not null check (char_length(parent_email) between 3 and 254),
  parent_phone  text not null check (char_length(parent_phone) between 10 and 25)
);

create unique index belles_beaux_interests_family_year_idx
  on public.belles_beaux_interests (
    interest_year,
    lower(student_name),
    lower(parent_email)
  );

create index belles_beaux_interests_year_submitted_idx
  on public.belles_beaux_interests (interest_year, submitted_at desc);

alter table public.belles_beaux_interests enable row level security;

revoke all on table public.belles_beaux_interests from anon, authenticated;
grant select, insert on table public.belles_beaux_interests to service_role;
