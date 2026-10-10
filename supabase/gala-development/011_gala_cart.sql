-- DEVELOPMENT ONLY. Preserves legacy orders and assignments. Stock remains unapproved.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

-- One row per purchased table, including several tables within a single payment.
create table public.gala_order_tables (
  order_id uuid not null references public.gala_orders(id),
  line_index integer not null check(line_index between 0 and 9),
  tier text not null references public.gala_inventory(tier),
  seats integer not null check(seats between 8 and 10),
  primary key(order_id,line_index)
);
insert into public.gala_order_tables(order_id,line_index,tier,seats)
  select id,0,tier,8+(details->'purchase'->>'extraSeats')::integer
  from public.gala_orders where tier is not null and details->>'kind'='tables';
alter table public.gala_order_tables enable row level security;
revoke all on public.gala_order_tables from public,anon,authenticated;
grant select,insert on public.gala_order_tables to service_role;
create index gala_order_tables_tier on public.gala_order_tables(tier);

alter table public.gala_table_assignments add column line_index integer not null default 0;
alter table public.gala_table_assignments drop constraint gala_table_assignments_pkey;
alter table public.gala_table_assignments add primary key(order_id,line_index);
alter table public.gala_table_assignments add foreign key(order_id,line_index) references public.gala_order_tables(order_id,line_index);
alter table public.gala_assignment_events add column line_index integer not null default 0;
alter table public.gala_assignment_events drop constraint gala_assignment_events_order_id_revision_key;
alter table public.gala_assignment_events add unique(order_id,line_index,revision);

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
    if used+requested.quantity>available then raise exception 'Table tier sold out or reserved'; end if;
  end loop;
  insert into public.gala_orders(id,request_hash,details,amount,description,tier)
    values(p_id,p_hash,p_details,p_amount,p_description,p_tier) returning * into existing;
  insert into public.gala_order_tables(order_id,line_index,tier,seats)
    select p_id,(position-1)::integer,value->>'product',8+(value->>'extraSeats')::integer
    from jsonb_array_elements(selections) with ordinality as s(value,position)
    where value->>'product' in ('platinum','gold','silver');
  return to_jsonb(existing);
end $$;

create function public.gala_inventory_counts()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by tier),'[]'::jsonb) from (
    select i.tier,i.capacity,i.board_confirmed,
      count(*) filter(where o.status in ('reserved','awaiting_payment')) as held,
      count(*) filter(where o.status='paid') as paid,
      greatest(0,i.capacity-count(*) filter(where o.status<>'expired')) as available
    from public.gala_inventory i left join public.gala_order_tables t on t.tier=i.tier
    left join public.gala_orders o on o.id=t.order_id group by i.tier
  ) row_data;
$$;

create function public.gala_assign_table_line(p_order uuid,p_number integer,p_revision integer,p_line integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare purchase public.gala_orders; current_assignment public.gala_table_assignments; old_number integer;
begin
  if p_line is null or p_line not between 0 and 9 or p_revision is null or p_revision<0
    or (p_number is not null and p_number not between 1 and 999) then raise exception 'Invalid assignment'; end if;
  select * into purchase from public.gala_orders where id=p_order for update;
  if not found or purchase.status<>'paid' or not exists(
    select 1 from public.gala_order_tables where order_id=p_order and line_index=p_line
  ) then raise exception 'Only paid table purchases can be assigned'; end if;
  insert into public.gala_table_assignments(order_id,line_index) values(p_order,p_line) on conflict do nothing;
  select * into current_assignment from public.gala_table_assignments where order_id=p_order and line_index=p_line for update;
  if current_assignment.revision<>p_revision then raise exception 'Assignment changed; reload before editing'; end if;
  if current_assignment.table_number is not distinct from p_number then return to_jsonb(current_assignment); end if;
  old_number:=current_assignment.table_number;
  update public.gala_table_assignments set table_number=p_number,revision=revision+1,updated_at=now()
    where order_id=p_order and line_index=p_line returning * into current_assignment;
  insert into public.gala_assignment_events(order_id,line_index,previous_number,table_number,revision)
    values(p_order,p_line,old_number,p_number,current_assignment.revision);
  return to_jsonb(current_assignment);
end $$;
-- Existing clients and saved orders continue to address their original table.
create or replace function public.gala_assign_table(p_order uuid,p_number integer,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
  select public.gala_assign_table_line(p_order,p_number,p_revision,0);
$$;
create or replace function public.gala_assignment_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by table_number nulls last,created_at,id,line_index),'[]'::jsonb) from (
    select o.id,t.line_index,t.tier,o.details->'contact' as buyer,t.seats,
      a.table_number,coalesce(a.revision,0) as revision,o.created_at
    from public.gala_orders o join public.gala_order_tables t on t.order_id=o.id
    left join public.gala_table_assignments a on a.order_id=o.id and a.line_index=t.line_index
    where o.status='paid'
  ) row_data;
$$;

revoke all on function public.gala_assign_table_line(uuid,integer,integer,integer),public.gala_inventory_counts() from public,anon,authenticated;
grant execute on function public.gala_assign_table_line(uuid,integer,integer,integer),public.gala_inventory_counts() to service_role;

-- Gift and staff function replacements follow; their existing grants are preserved.
create or replace function public.gala_set_gift_status(p_order uuid,p_recipient integer,p_status text,p_revision integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare purchase public.gala_orders; current_gift public.gala_gift_fulfillment; previous text; old_rank integer; new_rank integer;
begin
  if p_recipient is null or p_recipient<0 or p_revision is null or p_revision<0
    or p_status is null or p_status not in ('pending','prepared','delivered') or length(coalesce(p_reason,''))>300 then
    raise exception 'Invalid gift update';
  end if;
  select * into purchase from public.gala_orders where id=p_order for update;
  if not found or purchase.status<>'paid' or (purchase.details->>'kind' not in ('gifts','cart') or coalesce(jsonb_array_length(purchase.details->'gifts'),0)=0) then
    raise exception 'Only paid gifts can be fulfilled';
  end if;
  if p_recipient >= jsonb_array_length(purchase.details->'gifts') then raise exception 'Unknown recipient'; end if;
  insert into public.gala_gift_fulfillment(order_id,recipient_index) values(p_order,p_recipient) on conflict do nothing;
  select * into current_gift from public.gala_gift_fulfillment where order_id=p_order and recipient_index=p_recipient for update;
  if current_gift.revision<>p_revision then raise exception 'Gift changed; refresh before editing'; end if;
  if current_gift.status=p_status then return to_jsonb(current_gift); end if;
  previous := current_gift.status;
  old_rank := array_position(array['pending','prepared','delivered'],previous);
  new_rank := array_position(array['pending','prepared','delivered'],p_status);
  if new_rank>old_rank+1 then raise exception 'Prepare gifts before handing them out'; end if;
  if new_rank<old_rank and length(btrim(coalesce(p_reason,'')))<3 then raise exception 'A correction reason is required'; end if;
  update public.gala_gift_fulfillment set status=p_status,revision=revision+1,updated_at=now()
    where order_id=p_order and recipient_index=p_recipient returning * into current_gift;
  insert into public.gala_gift_events(order_id,recipient_index,previous_status,status,revision,reason)
    values(p_order,p_recipient,previous,p_status,current_gift.revision,nullif(btrim(p_reason),''));
  return to_jsonb(current_gift);
end $$;

create or replace function public.gala_gift_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by student,order_id,recipient_index),'[]'::jsonb) from (
    select o.id as order_id,(g.position-1)::integer as recipient_index,o.details->'contact' as buyer,
      g.gift->>'student' as student,g.gift->>'grade' as grade,
      (g.gift->>'roses')::integer as roses,(g.gift->>'cookies')::integer as cookies,
      coalesce(f.status,'pending') as status,coalesce(f.revision,0) as revision
    from public.gala_orders o
    cross join lateral jsonb_array_elements(case when o.details->>'kind' in ('gifts','cart') then o.details->'gifts' else '[]'::jsonb end) with ordinality as g(gift,position)
    left join public.gala_gift_fulfillment f on f.order_id=o.id and f.recipient_index=g.position-1
    where o.status='paid' and o.details->>'kind' in ('gifts','cart')
  ) row_data;
$$;
create or replace function public.gala_staff_mutation(p_session text,p_operation text,p_args jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare identity jsonb; result jsonb;
begin
  identity:=public.gala_staff_identity(p_session,false);
  perform set_config('gala.actor',identity->>'userId',true);
  case p_operation
    when 'gala_assign_table' then result:=public.gala_assign_table_line((p_args->>'p_order')::uuid,(p_args->>'p_number')::integer,(p_args->>'p_revision')::integer,coalesce((p_args->>'p_line')::integer,0));
    when 'gala_set_gift_status' then result:=public.gala_set_gift_status((p_args->>'p_order')::uuid,(p_args->>'p_recipient')::integer,p_args->>'p_status',(p_args->>'p_revision')::integer,p_args->>'p_reason');
    when 'gala_set_invitation_status' then result:=public.gala_set_invitation_status((p_args->>'p_request')::uuid,(p_args->>'p_recipient')::integer,p_args->>'p_status',(p_args->>'p_revision')::integer,p_args->>'p_reason');
    when 'gala_set_invitation_address' then result:=public.gala_set_invitation_address((p_args->>'p_request')::uuid,(p_args->>'p_recipient')::integer,p_args->'p_address',(p_args->>'p_revision')::integer,p_args->>'p_reason');
    when 'gala_resolve_invitation_duplicate' then result:=public.gala_resolve_invitation_duplicate((p_args->>'p_request')::uuid,(p_args->>'p_recipient')::integer,(p_args->>'p_revision')::integer,p_args->>'p_decision',(p_args->>'p_target')::uuid,(p_args->>'p_target_recipient')::integer,(p_args->>'p_target_revision')::integer,p_args->>'p_reason');
    when 'gala_retry_recovery' then perform public.gala_retry_recovery((p_args->>'p_order')::uuid,p_args->>'p_reason'); result:='null'::jsonb;
    else raise exception 'Unsupported staff operation';
  end case;
  perform set_config('gala.actor','',true);
  return result;
end $$;
notify pgrst,'reload schema';
commit;
