-- LOCAL SANDBOX ONLY. Apply after 001 in OSG Gala Development, never live OSG.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;
alter table public.gala_accounting_outbox drop constraint gala_accounting_outbox_status_check;
alter table public.gala_accounting_outbox
  add constraint gala_accounting_outbox_status_check check(status in ('pending','processing','synced','review')),
  add column realm_id text,
  add column payload jsonb,
  add column lease_owner uuid,
  add column lease_until timestamptz,
  add column dispatched_at timestamptz,
  add column receipt_id text,
  add column last_error text,
  add column attempts integer not null default 0,
  add column synced_at timestamptz;
create unique index gala_qb_receipt_unique on public.gala_accounting_outbox(realm_id,receipt_id);
create table public.gala_qb_connection (
  id integer primary key check(id=1),
  sealed_tokens text,
  lock_owner uuid,
  lock_until timestamptz
);
insert into public.gala_qb_connection(id) values(1);
alter table public.gala_qb_connection enable row level security;
revoke all on public.gala_qb_connection from public,anon,authenticated;
grant all on public.gala_qb_connection to service_role;

create function public.gala_accounting_claim(p_id uuid,p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.gala_accounting_outbox;
begin
  select * into strict job from public.gala_accounting_outbox where order_id=p_id for update;
  if not exists(select 1 from public.gala_orders where id=p_id and status='paid') then raise exception 'Paid order required'; end if;
  if job.status='synced' or job.lease_until > now() then return null; end if;
  update public.gala_accounting_outbox set status='processing',lease_owner=p_owner,lease_until=now()+interval '2 minutes',attempts=attempts+1
    where order_id=p_id returning * into job;
  return to_jsonb(job);
end $$;
create function public.gala_accounting_prepare(p_id uuid,p_owner uuid,p_realm text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.gala_accounting_outbox;
begin
  select * into strict job from public.gala_accounting_outbox where order_id=p_id for update;
  if job.lease_owner is distinct from p_owner or job.lease_until<=now() then raise exception 'Lease lost'; end if;
  if job.payload is not null then
    if job.payload<>p_payload or job.realm_id<>p_realm then raise exception 'Immutable accounting payload'; end if;
  else
    update public.gala_accounting_outbox set realm_id=p_realm,payload=p_payload where order_id=p_id returning * into job;
  end if;
  return to_jsonb(job);
end $$;
create function public.gala_accounting_dispatch(p_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_accounting_outbox set dispatched_at=now()
    where order_id=p_id and lease_owner=p_owner and lease_until>now() and payload is not null and dispatched_at is null;
  if not found then raise exception 'Dispatch not allowed'; end if;
end $$;
create function public.gala_accounting_finish(p_id uuid,p_owner uuid,p_receipt text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_accounting_outbox set status='synced',receipt_id=p_receipt,synced_at=now(),last_error=null,lease_owner=null,lease_until=null
    where order_id=p_id and lease_owner=p_owner and lease_until>now();
  if not found then raise exception 'Lease lost'; end if;
end $$;
create function public.gala_accounting_review(p_id uuid,p_owner uuid,p_code text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_accounting_outbox set status='review',last_error=p_code,lease_owner=null,lease_until=null
    where order_id=p_id and lease_owner=p_owner;
end $$;
create function public.gala_qb_lock(p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_qb_connection set lock_owner=p_owner,lock_until=now()+interval '2 minutes'
    where id=1 and (lock_until is null or lock_until<=now());
  return found;
end $$;
create function public.gala_qb_save(p_owner uuid,p_sealed text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_qb_connection set sealed_tokens=p_sealed where id=1 and lock_owner=p_owner and lock_until>now();
  if not found then raise exception 'Connection lease lost'; end if;
end $$;
create function public.gala_qb_unlock(p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.gala_qb_connection set lock_owner=null,lock_until=null where id=1 and lock_owner=p_owner;
end $$;
revoke all on function public.gala_accounting_claim(uuid,uuid), public.gala_accounting_prepare(uuid,uuid,text,jsonb),
  public.gala_accounting_dispatch(uuid,uuid),public.gala_accounting_finish(uuid,uuid,text),public.gala_accounting_review(uuid,uuid,text),
  public.gala_qb_lock(uuid),public.gala_qb_save(uuid,text),public.gala_qb_unlock(uuid) from public,anon,authenticated;
grant execute on function public.gala_accounting_claim(uuid,uuid),public.gala_accounting_prepare(uuid,uuid,text,jsonb),
  public.gala_accounting_dispatch(uuid,uuid),public.gala_accounting_finish(uuid,uuid,text),public.gala_accounting_review(uuid,uuid,text),
  public.gala_qb_lock(uuid),public.gala_qb_save(uuid,text),public.gala_qb_unlock(uuid) to service_role;
commit;
