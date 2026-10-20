-- Included at the end of the atomic fresh-install bundle. Not a standalone migration.
-- A database operator must explicitly open sales after the release is approved.
create table public.gala_operating_state (
  id integer primary key check(id=1),
  sales_open boolean not null default false,
  invitations_open boolean not null default false
);
insert into public.gala_operating_state(id) values(1);
alter table public.gala_operating_state enable row level security;
revoke all on public.gala_operating_state from public,anon,authenticated,service_role;
grant select on public.gala_operating_state to service_role;

create function public.gala_require_open() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
  -- Definer rights allow locking this row without granting application UPDATE.
  -- Share lock keeps the setting stable until this reservation commits. Closing
  -- sales waits for in-flight reservations; payment/recovery updates remain valid.
  if tg_table_name='gala_orders' then
    select sales_open into allowed from public.gala_operating_state where id=1 for share;
  elsif tg_table_name='gala_invitation_requests' then
    select invitations_open into allowed from public.gala_operating_state where id=1 for share;
  end if;
  if allowed is distinct from true then raise exception 'Gala submissions are closed'; end if;
  return new;
end $$;
create trigger gala_open_sales before insert on public.gala_orders
  for each row execute function public.gala_require_open();
create trigger gala_open_invitations before insert on public.gala_invitation_requests
  for each row execute function public.gala_require_open();

-- Existing customer RPCs insert then attach the owner in one transaction.
-- Check the final stored row at commit, so even service-side coding mistakes
-- cannot persist an unowned order/request or erase an existing owner's identity.
create function public.gala_require_customer() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_hash text;
begin
  if tg_table_name='gala_orders' then
    select customer_hash into owner_hash from public.gala_orders where id=new.id;
  elsif tg_table_name='gala_invitation_requests' then
    select customer_hash into owner_hash from public.gala_invitation_requests where id=new.id;
  end if;
  if owner_hash is null or owner_hash !~ '^[a-f0-9]{64}$' then raise exception 'Customer ownership required'; end if;
  if tg_op='UPDATE' and old.customer_hash is not null and owner_hash is distinct from old.customer_hash then
    raise exception 'Customer ownership cannot change';
  end if;
  return null;
end $$;
create constraint trigger gala_order_owner after insert or update on public.gala_orders
  deferrable initially deferred for each row execute function public.gala_require_customer();
create constraint trigger gala_invitation_owner after insert or update on public.gala_invitation_requests
  deferrable initially deferred for each row execute function public.gala_require_customer();

-- Shared-password administration records the role, not a made-up person's name.
-- Named-account tables remain empty for schema compatibility, but their old
-- mutation/session APIs are unavailable to the production application.
revoke all on public.gala_staff,public.gala_staff_sessions from service_role;
revoke all on function public.gala_staff_identity(text,boolean),
  public.gala_create_staff_session(uuid,text,integer),public.gala_staff_mutation(text,text,jsonb) from service_role;
revoke insert,update,delete,truncate on public.gala_environment from service_role;
revoke all on function public.gala_require_open(),public.gala_require_customer() from public,anon,authenticated;

-- All tables/functions in this dedicated project are private. Revoke defaults
-- as well as the current grants so future migrations do not silently expose data.
revoke all on all tables in schema public from public,anon,authenticated;
revoke all on all sequences in schema public from public,anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
alter default privileges in schema public revoke all on sequences from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.gala_orders) or exists(select 1 from public.gala_invitation_requests)
    or exists(select 1 from public.gala_staff) or exists(select 1 from public.gala_payment_events)
    or exists(select 1 from public.gala_accounting_outbox) or exists(select 1 from public.gala_final_total)
    or exists(select 1 from public.gala_qb_connection where sealed_tokens is not null) then
    raise exception 'Fresh production installation must contain no business/test records or credentials';
  end if;
  if (select count(*) from public.gala_inventory where capacity is null and board_confirmed)<>3 then
    raise exception 'Board-approved unlimited inventory required';
  end if;
end $$;
