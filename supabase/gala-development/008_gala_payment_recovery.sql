-- DEVELOPMENT ONLY: durable recovery, independent of the browser and latest-100 dashboard.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development environment required';
  end if;
end $$;
create table public.gala_payment_recovery (
  order_id uuid primary key references public.gala_orders(id),
  outcome text not null default 'waiting' check(outcome in ('waiting','pending','creation_needs_review','retry_required','paid','expired')),
  attempts integer not null default 0,
  failures integer not null default 0,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  check ((lease_token is null) = (lease_until is null))
);
create table public.gala_recovery_worker (
  id integer primary key check(id=1), last_poll_at timestamptz not null
);
create table public.gala_recovery_actions (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.gala_orders(id),
  reason text not null check(length(trim(reason)) between 3 and 300),
  actor text not null default 'local-development-admin', created_at timestamptz not null default now()
);
alter table public.gala_payment_recovery enable row level security;
alter table public.gala_recovery_worker enable row level security;
alter table public.gala_recovery_actions enable row level security;
revoke all on public.gala_payment_recovery,public.gala_recovery_worker,public.gala_recovery_actions from anon,authenticated;
grant select,insert,update on public.gala_payment_recovery,public.gala_recovery_worker to service_role;
grant select,insert on public.gala_recovery_actions to service_role;
grant usage on sequence public.gala_recovery_actions_id_seq to service_role;

create function public.gala_claim_recovery(p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare candidate public.gala_payment_recovery;
begin
  if p_token is null then raise exception 'Lease token required'; end if;
  insert into public.gala_recovery_worker values(1,now()) on conflict(id) do update set last_poll_at=excluded.last_poll_at;
  insert into public.gala_payment_recovery(order_id)
    select id from public.gala_orders where status in ('reserved','awaiting_payment') on conflict do nothing;
  select * into candidate from public.gala_payment_recovery
    where outcome not in ('paid','expired') and next_check_at<=now() and (lease_until is null or lease_until<=now())
    order by next_check_at,order_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.gala_payment_recovery set lease_token=p_token,lease_until=now()+interval '5 minutes',attempts=attempts+1
    where order_id=candidate.order_id;
  return (select to_jsonb(o) from public.gala_orders o where id=candidate.order_id);
end $$;

create function public.gala_finish_recovery(p_order uuid,p_token uuid,p_outcome text) returns void
language plpgsql security invoker set search_path='' as $$
declare item public.gala_payment_recovery; actual text; next_failures integer; delay_seconds integer;
begin
  if p_outcome is null or p_outcome not in ('pending','creation_needs_review','retry_required','paid','expired') then raise exception 'Invalid outcome'; end if;
  select * into strict item from public.gala_payment_recovery where order_id=p_order for update;
  if item.lease_token is distinct from p_token or item.lease_until<=now() or item.lease_token is null then raise exception 'Stale lease'; end if;
  select status into strict actual from public.gala_orders where id=p_order;
  -- A webhook may settle the order while the worker was reading the provider.
  if actual in ('paid','expired') then p_outcome=actual;
  elsif p_outcome in ('paid','expired') then raise exception 'Unverified terminal outcome'; end if;
  next_failures=case when p_outcome='retry_required' then least(item.failures+1,20) else 0 end;
  delay_seconds=case when p_outcome='creation_needs_review' then 600
    when p_outcome='retry_required' then least(1800,60*power(2,least(next_failures-1,5))::integer) else 60 end;
  update public.gala_payment_recovery set outcome=p_outcome,failures=next_failures,last_checked_at=now(),
    next_check_at=now()+make_interval(secs=>delay_seconds),lease_token=null,lease_until=null where order_id=p_order;
end $$;

create function public.gala_retry_recovery(p_order uuid,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare actual text; item public.gala_payment_recovery;
begin
  if p_reason is null or length(trim(p_reason)) not between 3 and 300 then raise exception 'Reason required'; end if;
  select status into strict actual from public.gala_orders where id=p_order;
  if actual not in ('reserved','awaiting_payment') then raise exception 'Order is already settled'; end if;
  insert into public.gala_payment_recovery(order_id) values(p_order) on conflict do nothing;
  select * into strict item from public.gala_payment_recovery where order_id=p_order for update;
  if item.lease_until>now() then raise exception 'Check already running'; end if;
  update public.gala_payment_recovery set next_check_at=now(),lease_token=null,lease_until=null where order_id=p_order;
  insert into public.gala_recovery_actions(order_id,reason) values(p_order,trim(p_reason));
end $$;

create function public.gala_recovery_dashboard() returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object('lastPollAt',(select last_poll_at from public.gala_recovery_worker where id=1),
    'total',(select count(*) from public.gala_orders where status in ('reserved','awaiting_payment')),
    'entries',coalesce((select jsonb_agg(x) from (
      select o.id,o.description,o.created_at,o.stripe_session_id,
        coalesce(r.outcome,'waiting') as outcome,coalesce(r.attempts,0) as attempts,
        coalesce(r.failures,0) as failures,r.last_checked_at,r.next_check_at,r.lease_until
      from public.gala_orders o left join public.gala_payment_recovery r on r.order_id=o.id
      where o.status in ('reserved','awaiting_payment')
      order by case when r.outcome in ('creation_needs_review','retry_required') then 0 else 1 end,o.created_at,o.id limit 100
    ) x),'[]'::jsonb))
$$;
revoke all on function public.gala_claim_recovery(uuid),public.gala_finish_recovery(uuid,uuid,text),public.gala_retry_recovery(uuid,text),public.gala_recovery_dashboard() from public,anon,authenticated;
grant execute on function public.gala_claim_recovery(uuid),public.gala_finish_recovery(uuid,uuid,text),public.gala_retry_recovery(uuid,text),public.gala_recovery_dashboard() to service_role;
commit;
