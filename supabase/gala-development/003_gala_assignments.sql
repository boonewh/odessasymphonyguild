-- OSG GALA DEVELOPMENT ONLY. These numbers are not an approved venue layout.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

create table public.gala_table_assignments (
  order_id uuid primary key references public.gala_orders(id),
  table_number integer unique check(table_number between 1 and 999),
  revision integer not null default 0 check(revision >= 0),
  updated_at timestamptz not null default now()
);
create table public.gala_assignment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.gala_orders(id),
  previous_number integer,
  table_number integer,
  revision integer not null,
  actor text not null default 'local-development-admin',
  created_at timestamptz not null default now(),
  unique(order_id, revision)
);
alter table public.gala_table_assignments enable row level security;
alter table public.gala_assignment_events enable row level security;
revoke all on public.gala_table_assignments, public.gala_assignment_events from anon, authenticated;
grant select, insert, update on public.gala_table_assignments to service_role;
grant select, insert on public.gala_assignment_events to service_role;
grant usage, select on sequence public.gala_assignment_events_id_seq to service_role;

create function public.gala_assign_table(p_order uuid, p_number integer, p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare purchase public.gala_orders; current_assignment public.gala_table_assignments; old_number integer;
begin
  if p_revision is null or p_revision < 0 or (p_number is not null and (p_number < 1 or p_number > 999)) then
    raise exception 'Invalid assignment';
  end if;
  select * into purchase from public.gala_orders where id=p_order for update;
  if not found or purchase.status <> 'paid' or purchase.tier is null
    or purchase.details->>'kind' is distinct from 'tables'
    or purchase.details->'purchase'->>'product' is distinct from purchase.tier then
    raise exception 'Only paid table purchases can be assigned';
  end if;
  insert into public.gala_table_assignments(order_id) values(p_order) on conflict do nothing;
  select * into current_assignment from public.gala_table_assignments where order_id=p_order for update;
  if current_assignment.revision <> p_revision then
    raise exception 'Assignment changed; reload before editing';
  end if;
  if current_assignment.table_number is not distinct from p_number then return to_jsonb(current_assignment); end if;
  old_number := current_assignment.table_number;
  -- The unique constraint serializes two different orders competing for a number.
  update public.gala_table_assignments set table_number=p_number, revision=revision+1, updated_at=now()
    where order_id=p_order returning * into current_assignment;
  insert into public.gala_assignment_events(order_id,previous_number,table_number,revision)
    values(p_order,old_number,p_number,current_assignment.revision);
  return to_jsonb(current_assignment);
end $$;

-- One snapshot of ALL paid tables; independent of the latest-100 general admin list.
create function public.gala_assignment_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by table_number nulls last, created_at, id),'[]'::jsonb)
  from (
    select o.id, o.tier, o.details->'contact' as buyer,
      8 + (o.details->'purchase'->>'extraSeats')::integer as seats,
      a.table_number, coalesce(a.revision,0) as revision, o.created_at
    from public.gala_orders o left join public.gala_table_assignments a on a.order_id=o.id
    where o.status='paid' and o.tier is not null and o.details->>'kind'='tables'
      and o.details->'purchase'->>'product'=o.tier
  ) row_data;
$$;
revoke all on function public.gala_assign_table(uuid,integer,integer), public.gala_assignment_list() from public, anon, authenticated;
grant execute on function public.gala_assign_table(uuid,integer,integer), public.gala_assignment_list() to service_role;
notify pgrst, 'reload schema';
commit;
