-- OSG GALA DEVELOPMENT ONLY. No payment, inventory or accounting mutations.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

create table public.gala_gift_fulfillment (
  order_id uuid not null references public.gala_orders(id),
  recipient_index integer not null check(recipient_index >= 0),
  status text not null default 'pending' check(status in ('pending','prepared','delivered')),
  revision integer not null default 0 check(revision >= 0),
  updated_at timestamptz not null default now(),
  primary key(order_id,recipient_index)
);
create table public.gala_gift_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.gala_orders(id),
  recipient_index integer not null,
  previous_status text not null,
  status text not null,
  revision integer not null,
  reason text,
  actor text not null default 'local-development-admin',
  created_at timestamptz not null default now(),
  unique(order_id,recipient_index,revision)
);
alter table public.gala_gift_fulfillment enable row level security;
alter table public.gala_gift_events enable row level security;
revoke all on public.gala_gift_fulfillment, public.gala_gift_events from anon, authenticated;
grant select,insert,update on public.gala_gift_fulfillment to service_role;
grant select,insert on public.gala_gift_events to service_role;
grant usage,select on sequence public.gala_gift_events_id_seq to service_role;

create function public.gala_set_gift_status(p_order uuid,p_recipient integer,p_status text,p_revision integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare purchase public.gala_orders; current_gift public.gala_gift_fulfillment; previous text; old_rank integer; new_rank integer;
begin
  if p_recipient is null or p_recipient<0 or p_revision is null or p_revision<0
    or p_status is null or p_status not in ('pending','prepared','delivered') or length(coalesce(p_reason,''))>300 then
    raise exception 'Invalid gift update';
  end if;
  select * into purchase from public.gala_orders where id=p_order for update;
  if not found or purchase.status<>'paid' or purchase.details->>'kind' is distinct from 'gifts' then
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

create function public.gala_gift_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by student,order_id,recipient_index),'[]'::jsonb) from (
    select o.id as order_id,(g.position-1)::integer as recipient_index,o.details->'contact' as buyer,
      g.gift->>'student' as student,g.gift->>'grade' as grade,
      (g.gift->>'roses')::integer as roses,(g.gift->>'cookies')::integer as cookies,
      coalesce(f.status,'pending') as status,coalesce(f.revision,0) as revision
    from public.gala_orders o
    cross join lateral jsonb_array_elements(case when o.details->>'kind'='gifts' then o.details->'gifts' else '[]'::jsonb end) with ordinality as g(gift,position)
    left join public.gala_gift_fulfillment f on f.order_id=o.id and f.recipient_index=g.position-1
    where o.status='paid' and o.details->>'kind'='gifts'
  ) row_data;
$$;
revoke all on function public.gala_set_gift_status(uuid,integer,text,integer,text),public.gala_gift_list() from public,anon,authenticated;
grant execute on function public.gala_set_gift_status(uuid,integer,text,integer,text),public.gala_gift_list() to service_role;
notify pgrst, 'reload schema';
commit;
