-- Install once, separately from the Gala installer. Only new patron_* objects
-- are changed. Existing membership/Gala data, grants and defaults are untouched.
begin;
create table public.patron_members (
  id uuid primary key,
  period text not null check (length(period) between 4 and 20),
  name text not null check (length(trim(name)) between 2 and 120),
  email text not null default '' check (length(email) <= 254),
  phone text not null default '' check (length(phone) <= 40),
  source text not null check (source in ('online', 'check')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
-- Repeated online submissions must never overwrite a volunteer's corrections
-- or republish a hidden entry. Names alone are not a person's identity.
create unique index patron_contact_period on public.patron_members
  (period, lower(trim(name)), lower(trim(email))) where email <> '';
create index patron_period on public.patron_members(period, name, id);
create table public.patron_submission_limits (
  client_hash text primary key check (client_hash ~ '^[a-f0-9]{64}$'),
  started_at timestamptz not null,
  attempts integer not null
);
alter table public.patron_members enable row level security;
alter table public.patron_submission_limits enable row level security;
revoke all on public.patron_members, public.patron_submission_limits from public, anon, authenticated;
grant select, insert, update on public.patron_members to service_role;
grant select, insert, update, delete on public.patron_submission_limits to service_role;

create function public.patron_add(p_input jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  existing public.patron_members;
  attempt_count integer;
begin
  if p_input->>'source' not in ('online','check') or p_input->>'source' is null then
    raise exception 'patron_invalid_source';
  end if;
  -- Serialize retries with the same id before checking payload identity.
  perform pg_advisory_xact_lock(hashtextextended(p_input->>'requestId', 0));
  select * into existing from public.patron_members where id = (p_input->>'requestId')::uuid;
  if found then
    if existing.name <> p_input->>'name' or existing.email <> p_input->>'email'
      or existing.phone <> p_input->>'phone' or existing.period <> p_input->>'period'
      or existing.source <> p_input->>'source' then
      raise exception 'patron_request_conflict';
    end if;
    return;
  end if;
  if p_input->>'source' = 'online' then
    if coalesce(p_input->>'email','') = '' or p_input->>'published' is distinct from 'true' then
      raise exception 'patron_invalid_signup';
    end if;
    delete from public.patron_submission_limits where started_at < now() - interval '1 day';
    insert into public.patron_submission_limits(client_hash, started_at, attempts)
      values(p_input->>'clientHash', now(), 1)
    on conflict(client_hash) do update set
      started_at = case when patron_submission_limits.started_at <= now() - interval '15 minutes'
        then now() else patron_submission_limits.started_at end,
      attempts = case when patron_submission_limits.started_at <= now() - interval '15 minutes'
        then 1 else patron_submission_limits.attempts + 1 end
    returning attempts into attempt_count;
    if attempt_count > 5 then raise exception 'patron_rate_limit'; end if;
  end if;
  insert into public.patron_members(id, period, name, email, phone, source, published)
    values((p_input->>'requestId')::uuid, p_input->>'period', p_input->>'name',
      p_input->>'email', p_input->>'phone', p_input->>'source', (p_input->>'published')::boolean)
    on conflict do nothing;
end;
$$;
revoke all on function public.patron_add(jsonb) from public, anon, authenticated;
grant execute on function public.patron_add(jsonb) to service_role;
commit;
