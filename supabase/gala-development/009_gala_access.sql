-- DEVELOPMENT ONLY. Does not provision users, enable public sales, or approve stock.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

create table public.gala_staff (
  user_id uuid primary key,
  enabled boolean not null default false,
  accounting boolean not null default false
);
create table public.gala_staff_sessions (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.gala_staff(user_id),
  expires_at timestamptz not null
);
alter table public.gala_orders add column customer_hash text check(customer_hash ~ '^[a-f0-9]{64}$');
alter table public.gala_invitation_requests add column customer_hash text check(customer_hash ~ '^[a-f0-9]{64}$');
alter table public.gala_staff enable row level security;
alter table public.gala_staff_sessions enable row level security;
revoke all on public.gala_staff,public.gala_staff_sessions from public,anon,authenticated;
grant select,update on public.gala_staff to service_role;
grant select,insert,update,delete on public.gala_staff_sessions to service_role;
grant update(customer_hash) on public.gala_invitation_requests to service_role;

create function public.gala_staff_identity(p_session text,p_accounting boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare staff public.gala_staff;
begin
  select u.* into staff from public.gala_staff u join public.gala_staff_sessions s on s.user_id=u.user_id
    where s.token_hash=p_session and s.expires_at>now() and u.enabled
    and (not p_accounting or u.accounting) for share of u,s;
  if not found then raise exception 'Staff access required'; end if;
  return jsonb_build_object('userId',staff.user_id,'accounting',staff.accounting);
end $$;
create function public.gala_create_staff_session(p_user uuid,p_session text,p_seconds integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_seconds is null or p_seconds not between 1 and 28800 then raise exception 'Invalid session lifetime'; end if;
  perform 1 from public.gala_staff where user_id=p_user and enabled for share;
  if not found then raise exception 'Staff access required'; end if;
  delete from public.gala_staff_sessions where expires_at<=now();
  insert into public.gala_staff_sessions values(p_session,p_user,now()+make_interval(secs=>p_seconds));
end $$;

-- Ownership is established in the reservation transaction, including response-loss retries.
-- A legacy fixture with no owner cannot be claimed just by knowing its UUID/details.
create function public.gala_customer_reserve(p_customer text,p_id uuid,p_hash text,p_details jsonb,p_amount integer,p_description text,p_tier text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_customer is null or p_customer !~ '^[a-f0-9]{64}$' then raise exception 'Customer required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  if exists(select 1 from public.gala_orders where id=p_id and customer_hash is distinct from p_customer) then
    raise exception 'Order unavailable';
  end if;
  result:=public.gala_reserve(p_id,p_hash,p_details,p_amount,p_description,p_tier);
  update public.gala_orders set customer_hash=p_customer where id=p_id;
  return result;
end $$;
create function public.gala_customer_invitations(p_customer text,p_details jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare request_id uuid := (p_details->>'requestId')::uuid;
begin
  if p_customer is null or p_customer !~ '^[a-f0-9]{64}$' then raise exception 'Customer required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,17));
  if exists(select 1 from public.gala_invitation_requests where id=request_id and customer_hash is distinct from p_customer) then
    raise exception 'Request unavailable';
  end if;
  perform public.gala_request_invitations(p_details);
  update public.gala_invitation_requests set customer_hash=p_customer where id=request_id;
  return request_id;
end $$;

-- Trusted transaction-local actor, never accepted from a browser's mutation body.
alter table public.gala_assignment_events alter column actor set default coalesce(nullif(current_setting('gala.actor',true),''),'local-development-admin');
alter table public.gala_gift_events alter column actor set default coalesce(nullif(current_setting('gala.actor',true),''),'local-development-admin');
alter table public.gala_invitation_events alter column actor set default coalesce(nullif(current_setting('gala.actor',true),''),'local-development-admin');
alter table public.gala_recovery_actions alter column actor set default coalesce(nullif(current_setting('gala.actor',true),''),'local-development-admin');

create function public.gala_staff_mutation(p_session text,p_operation text,p_args jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare identity jsonb; result jsonb;
begin
  identity:=public.gala_staff_identity(p_session,false);
  perform set_config('gala.actor',identity->>'userId',true);
  case p_operation
    when 'gala_assign_table' then result:=public.gala_assign_table((p_args->>'p_order')::uuid,(p_args->>'p_number')::integer,(p_args->>'p_revision')::integer);
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
revoke all on function public.gala_staff_identity(text,boolean),public.gala_create_staff_session(uuid,text,integer),
  public.gala_customer_reserve(text,uuid,text,jsonb,integer,text,text),public.gala_customer_invitations(text,jsonb),
  public.gala_staff_mutation(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.gala_staff_identity(text,boolean),public.gala_create_staff_session(uuid,text,integer),
  public.gala_customer_reserve(text,uuid,text,jsonb,integer,text,text),public.gala_customer_invitations(text,jsonb),
  public.gala_staff_mutation(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
