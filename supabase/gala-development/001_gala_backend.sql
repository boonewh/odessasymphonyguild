-- DEVELOPMENT PROJECT ONLY. Deliberately outside the production migrations folder.
-- Apply only to the empty OSG Gala Development project. All inventory is test data.
begin;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') then
    raise exception 'Refusing to initialize Gala development in a nonempty database';
  end if;
end $$;

create table public.gala_environment (
  id integer primary key check (id = 1),
  name text not null check (name = 'osg-gala-development')
);
insert into public.gala_environment values (1, 'osg-gala-development');
create table public.gala_inventory (
  tier text primary key check (tier in ('platinum', 'gold', 'silver')),
  capacity integer not null check (capacity >= 0),
  board_confirmed boolean not null default false check (board_confirmed = false)
);
insert into public.gala_inventory(tier, capacity) values ('platinum',20),('gold',20),('silver',20);

create table public.gala_orders (
  id uuid primary key,
  request_hash text not null,
  details jsonb not null,
  amount integer not null check (amount > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  description text not null,
  tier text references public.gala_inventory(tier),
  status text not null default 'reserved' check (status in ('reserved','awaiting_payment','paid','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_session_id text unique,
  payment_intent_id text unique,
  check (status <> 'paid' or (payment_intent_id is not null and stripe_session_id is not null)),
  check (status <> 'expired' or stripe_session_id is not null)
);
create index gala_orders_inventory on public.gala_orders(tier, status);
create table public.gala_payment_events (
  event_id text primary key,
  order_id uuid not null references public.gala_orders(id),
  state text not null check (state in ('paid','expired')),
  created_at timestamptz not null default now()
);
create table public.gala_accounting_outbox (
  order_id uuid primary key references public.gala_orders(id),
  category text not null default 'Symphony Ball',
  status text not null default 'pending' check (status in ('pending','synced','review')),
  created_at timestamptz not null default now()
);

-- All operations are server-only. No browser or anonymous access, including RPC.
alter table public.gala_environment enable row level security;
alter table public.gala_inventory enable row level security;
alter table public.gala_orders enable row level security;
alter table public.gala_payment_events enable row level security;
alter table public.gala_accounting_outbox enable row level security;
revoke all on public.gala_environment, public.gala_inventory, public.gala_orders,
  public.gala_payment_events, public.gala_accounting_outbox from anon, authenticated;
grant all on public.gala_environment, public.gala_inventory, public.gala_orders,
  public.gala_payment_events, public.gala_accounting_outbox to service_role;

create function public.gala_reserve(p_id uuid, p_hash text, p_details jsonb, p_amount integer, p_description text, p_tier text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.gala_orders; available integer; used integer;
begin
  -- Serialize identical request IDs before taking the inventory lock.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into existing from public.gala_orders where id = p_id;
  if found then
    if existing.request_hash <> p_hash then raise exception 'Request ID reused with different details'; end if;
    return to_jsonb(existing);
  end if;
  if p_tier is not null then
    select capacity into available from public.gala_inventory where tier = p_tier for update;
    if not found then raise exception 'Unknown inventory tier'; end if;
    -- Expiration timestamps alone NEVER release inventory.
    select count(*) into used from public.gala_orders where tier = p_tier and status <> 'expired';
    if used >= available then raise exception 'Table tier sold out or reserved'; end if;
  end if;
  insert into public.gala_orders(id, request_hash, details, amount, description, tier)
    values (p_id, p_hash, p_details, p_amount, p_description, p_tier) returning * into existing;
  return to_jsonb(existing);
end $$;

create function public.gala_bind_checkout(p_id uuid, p_session text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.gala_orders;
begin
  select * into strict existing from public.gala_orders where id = p_id for update;
  if p_session is null or p_session not like 'cs_test_%' then raise exception 'Test session required'; end if;
  if existing.stripe_session_id is not null and existing.stripe_session_id <> p_session then
    raise exception 'Order already has another checkout';
  end if;
  update public.gala_orders set stripe_session_id = p_session,
    status = case when status = 'reserved' then 'awaiting_payment' else status end,
    updated_at = now() where id = p_id returning * into existing;
  return to_jsonb(existing);
end $$;

create function public.gala_apply_payment(p_id uuid, p_session text, p_state text, p_payment text, p_event text)
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
  if p_state = 'paid' then
    insert into public.gala_accounting_outbox(order_id) values(p_id) on conflict do nothing;
  end if;
  return to_jsonb(existing);
end $$;

revoke all on function public.gala_reserve(uuid,text,jsonb,integer,text,text) from public, anon, authenticated;
revoke all on function public.gala_bind_checkout(uuid,text) from public, anon, authenticated;
revoke all on function public.gala_apply_payment(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.gala_reserve(uuid,text,jsonb,integer,text,text) to service_role;
grant execute on function public.gala_bind_checkout(uuid,text) to service_role;
grant execute on function public.gala_apply_payment(uuid,text,text,text,text) to service_role;
commit;
