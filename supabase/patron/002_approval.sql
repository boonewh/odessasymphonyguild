-- Apply once after 001_patrons.sql, before deploying the approval UI.
-- Existing online entries have never been reviewed; return them to review.
begin;
alter table public.patron_members add column approved_at timestamptz;
alter table public.patron_members alter column published set default false;
update public.patron_members set published=false where source='online';
update public.patron_members set approved_at=created_at where source='check' and published;

-- Enforce moderation even for older application instances or a caller that
-- supplies published=true. Only a subsequent private admin update can approve.
create function public.patron_moderate() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if TG_OP='INSERT' then
    new.approved_at := null;
    if new.source='online' then new.published := false; end if;
    if new.published then new.approved_at := now(); end if;
  else
    if new.source is distinct from old.source then
      raise exception 'patron_source_immutable';
    end if;
    new.approved_at := old.approved_at;
    if new.published and new.approved_at is null then new.approved_at := now(); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.patron_moderate() from public, anon, authenticated;
create trigger patron_moderation before insert or update on public.patron_members
  for each row execute function public.patron_moderate();
alter table public.patron_members add constraint patron_public_approval
  check (not published or approved_at is not null);

create or replace function public.patron_add(p_input jsonb) returns void
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
    if coalesce(p_input->>'email','') = '' then
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

commit;

