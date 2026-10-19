-- DEVELOPMENT ONLY. One final posting for this Gala; never apply to live OSG.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

create table public.gala_final_total (
  id uuid primary key,
  gala text not null unique check(gala='2027'),
  revision text not null check(revision ~ '^[a-f0-9]{64}$'),
  source jsonb not null,
  lines jsonb not null,
  amount bigint not null check(amount>0),
  realm_id text not null check(realm_id ~ '^[0-9]+$'),
  mapping jsonb not null,
  payload jsonb not null,
  actor text not null,
  created_at timestamptz not null default now(),
  status text not null default 'prepared' check(status in ('prepared','processing','synced','review')),
  lease_owner uuid, lease_until timestamptz,
  dispatched_at timestamptz, receipt_id text, synced_at timestamptz,
  attempts integer not null default 0, last_error text,
  unique(realm_id,receipt_id)
);
create table public.gala_final_total_orders (
  order_id uuid primary key references public.gala_orders(id),
  batch_id uuid not null references public.gala_final_total(id),
  amount bigint not null check(amount>0),
  payment_intent_id text not null unique,
  stripe_session_id text not null unique
);
alter table public.gala_final_total enable row level security;
alter table public.gala_final_total_orders enable row level security;
revoke all on public.gala_final_total,public.gala_final_total_orders from public,anon,authenticated,service_role;
grant select on public.gala_final_total,public.gala_final_total_orders to service_role;

-- Serializes finalization against all order and old per-order accounting writes.
-- A frozen final batch closes checkout creation even if dispatch needs review.
create or replace function public.gala_final_sales_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.gala_final_total) then
    -- Late verified webhook/recovery replays may touch updated_at or try the
    -- existing outbox INSERT ON CONFLICT. They cannot change financial data.
    if TG_TABLE_NAME='gala_orders' and TG_OP='UPDATE'
      and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
    if TG_TABLE_NAME='gala_accounting_outbox' and TG_OP='INSERT' then
      if exists(select 1 from public.gala_accounting_outbox where order_id=new.order_id) then return null; end if;
    end if;
    raise exception 'Gala sales closed for final accounting';
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
create trigger gala_final_orders_guard before insert or update or delete on public.gala_orders
  for each row execute function public.gala_final_sales_guard();
create trigger gala_final_accounting_guard before insert or update or delete on public.gala_accounting_outbox
  for each row execute function public.gala_final_sales_guard();

create function public.gala_final_prepare(p_id uuid,p_revision text,p_source jsonb,p_lines jsonb,
  p_mapping jsonb,p_payload jsonb,p_actor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_source jsonb; total bigint; n integer; job public.gala_final_total;
begin
  lock table public.gala_orders in share row exclusive mode;
  lock table public.gala_accounting_outbox in share row exclusive mode;
  select * into job from public.gala_final_total;
  if found then raise exception 'Final total already exists; recover the saved batch'; end if;
  current_source := public.gala_ledger_snapshot();
  if current_source is distinct from p_source then raise exception 'Ledger changed; refresh before finalizing'; end if;
  if exists(select 1 from public.gala_orders where status not in ('paid','expired')) then raise exception 'Unresolved orders'; end if;
  if exists(select 1 from public.gala_accounting_outbox where status<>'pending' or dispatched_at is not null
    or receipt_id is not null or realm_id is not null or payload is not null or lease_until is not null) then
    raise exception 'Earlier accounting requires review';
  end if;
  if exists(select 1 from public.gala_orders o where o.status='paid' and (o.currency<>'usd'
    or o.payment_intent_id is null or o.stripe_session_id is null
    or not exists(select 1 from public.gala_accounting_outbox a where a.order_id=o.id)
    or not exists(select 1 from public.gala_payment_events e where e.order_id=o.id and e.state='paid'))) then
    raise exception 'Paid evidence missing';
  end if;
  select sum(amount),count(*) into total,n from public.gala_orders where status='paid';
  if n=0 or total is null or total<=0 then raise exception 'Paid sales required'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0
    or (select sum((l->>'amount')::bigint) from jsonb_array_elements(p_lines) l) is distinct from total
    or exists(select 1 from jsonb_array_elements(p_lines) l where l->>'status'<>'paid')
    or exists(select 1 from public.gala_orders o where o.status='paid' and o.amount is distinct from
      (select sum((l->>'amount')::bigint) from jsonb_array_elements(p_lines) l where l->>'orderId'=o.id::text))
    or exists(select 1 from jsonb_array_elements(p_lines) l where not exists
      (select 1 from public.gala_orders o where o.id::text=l->>'orderId' and o.status='paid')) then
    raise exception 'Invalid frozen ledger';
  end if;
  if jsonb_array_length(p_payload->'Line')<>1 or (p_payload#>>'{Line,0,Amount}')::numeric*100 is distinct from total::numeric
    or p_payload#>>'{CurrencyRef,value}' is distinct from 'USD'
    or p_payload#>>'{CustomerRef,value}' is distinct from p_mapping->>'customerId'
    or p_payload#>>'{DepositToAccountRef,value}' is distinct from p_mapping->>'clearingAccountId'
    or p_payload#>>'{Line,0,SalesItemLineDetail,ItemRef,value}' is distinct from p_mapping->>'itemId'
    or p_payload#>>'{Line,0,SalesItemLineDetail,TaxCodeRef,value}' is distinct from 'NON'
    or length(p_actor) not between 1 and 150 then raise exception 'Invalid final receipt'; end if;
  insert into public.gala_final_total(id,gala,revision,source,lines,amount,realm_id,mapping,payload,actor)
    values(p_id,'2027',p_revision,p_source,p_lines,total,p_mapping->>'realmId',p_mapping,p_payload,p_actor) returning * into job;
  insert into public.gala_final_total_orders(order_id,batch_id,amount,payment_intent_id,stripe_session_id)
    select id,p_id,amount,payment_intent_id,stripe_session_id from public.gala_orders where status='paid';
  return to_jsonb(job);
end $$;

create function public.gala_final_claim(p_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.gala_final_total;
begin
  select * into strict job from public.gala_final_total where id=p_id for update;
  if job.status='synced' or job.lease_until>now() then return null; end if;
  update public.gala_final_total set status='processing',lease_owner=p_owner,lease_until=now()+interval '2 minutes',attempts=attempts+1
    where id=p_id returning * into job;
  return to_jsonb(job) || jsonb_build_object('order_id',job.id);
end $$;
create function public.gala_final_dispatch(p_id uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.gala_final_total set dispatched_at=now() where id=p_id and lease_owner=p_owner
    and lease_until>now() and status='processing' and dispatched_at is null;
  if not found then raise exception 'Dispatch not allowed'; end if;
end $$;
create function public.gala_final_finish(p_id uuid,p_owner uuid,p_receipt text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_receipt !~ '^[0-9]+$' then raise exception 'Receipt required'; end if;
  update public.gala_final_total set status='synced',receipt_id=p_receipt,synced_at=now(),last_error=null,lease_owner=null,lease_until=null
    where id=p_id and lease_owner=p_owner and lease_until>now() and status='processing';
  if not found then raise exception 'Lease lost'; end if;
end $$;
create function public.gala_final_review(p_id uuid,p_owner uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.gala_final_total set status='review',last_error='verification_required',lease_owner=null,lease_until=null
    where id=p_id and lease_owner=p_owner and lease_until>now() and status='processing';
end $$;
revoke all on function public.gala_final_sales_guard(),public.gala_final_prepare(uuid,text,jsonb,jsonb,jsonb,jsonb,text),
  public.gala_final_claim(uuid,uuid),public.gala_final_dispatch(uuid,uuid),public.gala_final_finish(uuid,uuid,text),public.gala_final_review(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.gala_final_prepare(uuid,text,jsonb,jsonb,jsonb,jsonb,text),public.gala_final_claim(uuid,uuid),
  public.gala_final_dispatch(uuid,uuid),public.gala_final_finish(uuid,uuid,text),public.gala_final_review(uuid,uuid,text) to service_role;
commit;
