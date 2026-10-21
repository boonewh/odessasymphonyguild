-- Patron dues only. Apply after 002_approval.sql; no Gala or membership changes.
begin;
alter table public.patron_members add column dues_status text not null default 'unpaid'
  check(dues_status in ('unpaid','card_pending','card_expired','card_paid','check_recorded'));
update public.patron_members set dues_status='check_recorded' where source='check';
create function public.patron_initial_dues() returns trigger language plpgsql set search_path=public as $$
begin
  new.dues_status := case when new.source='check' then 'check_recorded' else 'unpaid' end;
  return new;
end;
$$;
revoke all on function public.patron_initial_dues() from public,anon,authenticated;
create trigger patron_initial_dues before insert on public.patron_members
  for each row execute function public.patron_initial_dues();

create table public.patron_payments (
  id uuid primary key,
  patron_id uuid not null references public.patron_members(id),
  owner_hash text not null check(owner_hash ~ '^[a-f0-9]{64}$'),
  mode text not null check(mode in ('sandbox','live')),
  amount integer not null default 10000 check(amount=10000),
  currency text not null default 'usd' check(currency='usd'),
  status text not null default 'pending' check(status in ('pending','paid','expired')),
  email text not null,
  period text not null,
  origin text not null,
  stripe_session_id text unique,
  stripe_payment_id text unique,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  paid_at timestamptz,
  check(status<>'paid' or (stripe_payment_id is not null and stripe_session_id is not null and paid_at is not null)),
  check(stripe_session_id is null or (mode='live' and stripe_session_id like 'cs_live_%') or (mode='sandbox' and stripe_session_id like 'cs_test_%'))
);
create unique index patron_one_active_payment on public.patron_payments(patron_id) where status in ('pending','paid');
alter table public.patron_payments enable row level security;
revoke all on public.patron_payments from public,anon,authenticated;
grant select,insert,update on public.patron_payments to service_role;

create function public.patron_payment_start(p_input jsonb) returns public.patron_payments
language plpgsql security invoker set search_path=public as $$
declare member public.patron_members; payment public.patron_payments;
begin
  -- Serialize the same contact across tabs and request IDs.
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_input->>'email')) || ':' || (p_input->>'period'),0));
  select * into payment from public.patron_payments where id=(p_input->>'requestId')::uuid;
  if found then
    if payment.owner_hash<>p_input->>'ownerHash' or payment.email<>p_input->>'email'
      or payment.period<>p_input->>'period' or payment.mode<>p_input->>'mode' then raise exception 'patron_payment_conflict'; end if;
    return payment;
  end if;
  -- Dues are one payment per contact/year. Refuse a second active payment even
  -- if a later request changes the display name or uses a different browser.
  select p.* into payment from public.patron_payments p
    where p.period=p_input->>'period' and lower(p.email)=lower(p_input->>'email') and p.status in ('pending','paid');
  if found then
    if payment.owner_hash<>p_input->>'ownerHash' then raise exception 'patron_payment_conflict'; end if;
    return payment;
  end if;
  perform public.patron_add(p_input || jsonb_build_object('source','online','published',false));
  select * into member from public.patron_members where period=p_input->>'period'
    and lower(trim(name))=lower(trim(p_input->>'name')) and lower(trim(email))=lower(trim(p_input->>'email')) for update;
  if not found or member.dues_status not in ('unpaid','card_expired') then raise exception 'patron_payment_conflict'; end if;
  insert into public.patron_payments(id,patron_id,owner_hash,mode,email,period,origin)
    values((p_input->>'requestId')::uuid,member.id,p_input->>'ownerHash',p_input->>'mode',p_input->>'email',p_input->>'period',p_input->>'origin')
    returning * into payment;
  update public.patron_members set dues_status='card_pending' where id=member.id;
  return payment;
end;
$$;

create function public.patron_payment_apply(p_id uuid,p_session text,p_status text,p_payment text) returns void
language plpgsql security invoker set search_path=public as $$
declare payment public.patron_payments;
begin
  select * into payment from public.patron_payments where id=p_id for update;
  if not found or p_session is null or p_status not in ('pending','paid','expired') then raise exception 'patron_payment_invalid'; end if;
  if payment.stripe_session_id is not null and payment.stripe_session_id<>p_session then raise exception 'patron_payment_conflict'; end if;
  if payment.status='paid' then
    if p_status='paid' and payment.stripe_payment_id is distinct from p_payment then raise exception 'patron_payment_conflict'; end if;
    return;
  end if;
  if payment.status='expired' then
    if p_status<>'expired' then raise exception 'patron_payment_conflict'; end if;
    -- A replay for an older attempt must not overwrite a newer card/check state.
    return;
  end if;
  if p_status='paid' and (p_payment is null or p_payment not like 'pi_%') then raise exception 'patron_payment_invalid'; end if;
  update public.patron_payments set stripe_session_id=p_session,status=p_status,
    stripe_payment_id=case when p_status='paid' then p_payment else stripe_payment_id end,
    paid_at=case when p_status='paid' then now() else paid_at end, checked_at=now() where id=p_id;
  if p_status='paid' then
    -- Payment never changes approval, published name or contact corrections.
    update public.patron_members set dues_status='card_paid' where id=payment.patron_id;
  elsif p_status='expired' then
    update public.patron_members set dues_status='card_expired' where id=payment.patron_id and dues_status<>'card_paid';
  end if;
end;
$$;
revoke all on function public.patron_payment_start(jsonb),public.patron_payment_apply(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.patron_payment_start(jsonb),public.patron_payment_apply(uuid,text,text,text) to service_role;

create function public.patron_record_check(p_input jsonb,p_period text) returns boolean
language plpgsql security invoker set search_path=public as $$
declare member public.patron_members;
begin
  select * into member from public.patron_members where id=(p_input->>'id')::uuid and period=p_period for update;
  if not found then return false; end if;
  if member.dues_status in ('card_pending','card_paid') then raise exception 'patron_payment_conflict'; end if;
  update public.patron_members set name=p_input->>'name',email=p_input->>'email',phone=p_input->>'phone',
    published=(p_input->>'published')::boolean,dues_status='check_recorded' where id=member.id;
  return true;
end;
$$;
revoke all on function public.patron_record_check(jsonb,text) from public,anon,authenticated;
grant execute on function public.patron_record_check(jsonb,text) to service_role;
commit;
