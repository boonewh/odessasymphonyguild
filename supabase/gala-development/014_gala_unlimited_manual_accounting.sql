-- DEVELOPMENT ONLY. October 19: board-approved unlimited tables; manual bookkeeping.
-- NULL capacity means unlimited; a nonnegative integer restores a finite cap.
-- Existing paid/pending orders are never canceled by a capacity change.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;
alter table public.gala_inventory alter column capacity drop not null;
alter table public.gala_inventory drop constraint gala_inventory_board_confirmed_check;
comment on column public.gala_inventory.capacity is 'NULL = unlimited; nonnegative integer = maximum paid plus pending tables.';
update public.gala_inventory set capacity=null,board_confirmed=true;

create or replace function public.gala_reserve(p_id uuid,p_hash text,p_details jsonb,p_amount integer,p_description text,p_tier text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.gala_orders; selections jsonb; selection jsonb; requested record; available integer; used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.gala_orders where id=p_id;
  if found then
    if existing.request_hash<>p_hash then raise exception 'Request ID reused with different details'; end if;
    return to_jsonb(existing);
  end if;
  selections:=case when p_details->>'kind'='cart' then p_details->'purchases'
    when p_details->>'kind'='tables' then jsonb_build_array(p_details->'purchase') else '[]'::jsonb end;
  if selections is null or jsonb_typeof(selections)<>'array' or jsonb_array_length(selections)>10 then
    raise exception 'Invalid cart selections';
  end if;
  if p_details->>'kind'='cart' and p_tier is not null then raise exception 'Invalid cart tier'; end if;
  for selection in select value from jsonb_array_elements(selections) loop
    if selection->>'product' in ('platinum','gold','silver') and
      ((selection->>'quantity')::integer is distinct from 1 or (selection->>'extraSeats')::integer not between 0 and 2
        or selection->>'extraSeats' is null) then raise exception 'Invalid table selection'; end if;
  end loop;
  -- Lock tiers in the same order for every cart. Every requested tier succeeds or the
  -- transaction rolls back; timestamps never release inventory without verified expiry.
  for requested in select value->>'product' as tier,count(*) as quantity from jsonb_array_elements(selections)
    where value->>'product' in ('platinum','gold','silver') group by value->>'product' order by value->>'product' loop
    select capacity into strict available from public.gala_inventory where tier=requested.tier for update;
    select count(*) into used from public.gala_order_tables t join public.gala_orders o on o.id=t.order_id
      where t.tier=requested.tier and o.status<>'expired';
    if available is not null and used+requested.quantity>available then raise exception 'Table tier sold out or reserved'; end if;
  end loop;
  insert into public.gala_orders(id,request_hash,details,amount,description,tier)
    values(p_id,p_hash,p_details,p_amount,p_description,p_tier) returning * into existing;
  insert into public.gala_order_tables(order_id,line_index,tier,seats)
    select p_id,(position-1)::integer,value->>'product',8+(value->>'extraSeats')::integer
    from jsonb_array_elements(selections) with ordinality as s(value,position)
    where value->>'product' in ('platinum','gold','silver');
  return to_jsonb(existing);
end $$;

create or replace function public.gala_inventory_counts()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by tier),'[]'::jsonb) from (
    select i.tier,i.capacity,i.board_confirmed,
      count(*) filter(where o.status in ('reserved','awaiting_payment')) as held,
      count(*) filter(where o.status='paid') as paid,
      case when i.capacity is null then null else greatest(0,i.capacity-count(*) filter(where o.status<>'expired')) end as available,
      i.capacity is null as unlimited,
      case when i.capacity is null then false else count(*) filter(where o.status<>'expired')>i.capacity end as over_limit
    from public.gala_inventory i left join public.gala_order_tables t on t.tier=i.tier
    left join public.gala_orders o on o.id=t.order_id group by i.tier
  ) row_data;
$$;

create or replace function public.gala_apply_payment(p_id uuid, p_session text, p_state text, p_payment text, p_event text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.gala_orders; recorded public.gala_payment_events;
begin
  select * into strict existing from public.gala_orders where id = p_id for update;
  if p_session is null or p_session not like 'cs_test_%' then raise exception 'Test session required'; end if;
  if existing.stripe_session_id is not null and existing.stripe_session_id <> p_session then raise exception 'Session mismatch'; end if;
  if p_state not in ('paid','expired') or p_state is null then raise exception 'Invalid transition'; end if;
  if p_state = 'paid' and (p_payment is null or p_payment not like 'pi_%') then raise exception 'Verified payment required'; end if;
  if existing.status in ('paid','expired') and existing.status <> p_state then raise exception 'Conflicting terminal state requires review'; end if;
  if existing.payment_intent_id is not null and existing.payment_intent_id is distinct from p_payment then raise exception 'Payment mismatch'; end if;
  select * into recorded from public.gala_payment_events where event_id = p_event;
  if found then
    if recorded.order_id <> p_id or recorded.state <> p_state then raise exception 'Event conflict'; end if;
    return to_jsonb(existing);
  end if;
  insert into public.gala_payment_events(event_id, order_id, state) values(p_event, p_id, p_state);
  update public.gala_orders set stripe_session_id = p_session, status = p_state,
    payment_intent_id = p_payment, updated_at = now() where id = p_id returning * into existing;
  return to_jsonb(existing);
end $$;


-- Preserve every historical receipt/batch, but remove application access to connection
-- tokens and all retired accounting write RPCs. No other QuickBooks integration changes.
update public.gala_qb_connection set sealed_tokens=null,lock_owner=null,lock_until=null;
revoke all on public.gala_qb_connection from service_role;
revoke insert,update,delete,truncate on public.gala_accounting_outbox from service_role;
do $$ declare fn regprocedure; begin
  for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'gala_qb_%' or p.proname like 'gala_accounting_%'
      or p.proname in ('gala_final_prepare','gala_final_claim','gala_final_dispatch','gala_final_finish','gala_final_review'))
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
  end loop;
end $$;
commit;
