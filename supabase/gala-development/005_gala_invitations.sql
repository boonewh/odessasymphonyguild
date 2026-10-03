-- OSG GALA DEVELOPMENT ONLY. Invitations never create purchases or accounting jobs.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;
create table public.gala_invitation_requests (
  id uuid primary key,
  details jsonb not null,
  created_at timestamptz not null default now()
);
create table public.gala_invitation_recipients (
  request_id uuid not null references public.gala_invitation_requests(id),
  recipient_index integer not null check(recipient_index between 0 and 19),
  recipient jsonb not null,
  status text not null default 'requested' check(status in ('requested','prepared','mailed')),
  revision integer not null default 0 check(revision>=0),
  updated_at timestamptz not null default now(),
  primary key(request_id,recipient_index)
);
create table public.gala_invitation_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  recipient_index integer not null,
  previous_status text not null,
  status text not null,
  revision integer not null,
  reason text,
  actor text not null default 'local-development-admin',
  created_at timestamptz not null default now(),
  foreign key(request_id,recipient_index) references public.gala_invitation_recipients,
  unique(request_id,recipient_index,revision)
);
alter table public.gala_invitation_requests enable row level security;
alter table public.gala_invitation_recipients enable row level security;
alter table public.gala_invitation_events enable row level security;
revoke all on public.gala_invitation_requests,public.gala_invitation_recipients,public.gala_invitation_events from anon,authenticated;
grant select,insert on public.gala_invitation_requests,public.gala_invitation_events to service_role;
grant select,insert,update on public.gala_invitation_recipients to service_role;
grant usage,select on sequence public.gala_invitation_events_id_seq to service_role;

create function public.gala_request_invitations(p_details jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare request_id uuid; existing jsonb;
begin
  request_id := (p_details->>'requestId')::uuid;
  if request_id is null or jsonb_typeof(p_details->'contact') is distinct from 'object'
    or jsonb_typeof(p_details->'recipients') is distinct from 'array' then raise exception 'Invalid request'; end if;
  if jsonb_array_length(p_details->'recipients') not between 1 and 20 then raise exception 'Invalid recipient count'; end if;
  -- Serialize retries of this request. Changed details must not reuse the same ID.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,17));
  select details into existing from public.gala_invitation_requests where id=request_id;
  if found then
    if existing<>p_details then raise exception 'Request ID already used with different details'; end if;
    return request_id;
  end if;
  insert into public.gala_invitation_requests(id,details) values(request_id,p_details);
  insert into public.gala_invitation_recipients(request_id,recipient_index,recipient)
    select request_id,(position-1)::integer,recipient from jsonb_array_elements(p_details->'recipients') with ordinality as r(recipient,position);
  return request_id;
end $$;

create function public.gala_set_invitation_status(p_request uuid,p_recipient integer,p_status text,p_revision integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.gala_invitation_recipients; previous text; old_rank integer; new_rank integer;
begin
  if p_revision is null or p_revision<0 or p_status is null or p_status not in ('requested','prepared','mailed')
    or length(coalesce(p_reason,''))>300 then raise exception 'Invalid status update'; end if;
  select * into current_row from public.gala_invitation_recipients where request_id=p_request and recipient_index=p_recipient for update;
  if not found then raise exception 'Unknown recipient'; end if;
  if current_row.revision<>p_revision then raise exception 'Recipient changed; refresh before editing'; end if;
  if current_row.status=p_status then return to_jsonb(current_row); end if;
  previous:=current_row.status;
  old_rank:=array_position(array['requested','prepared','mailed'],previous);
  new_rank:=array_position(array['requested','prepared','mailed'],p_status);
  if new_rank>old_rank+1 then raise exception 'Prepare the invitation before marking it mailed'; end if;
  if new_rank<old_rank and length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Correction reason required'; end if;
  update public.gala_invitation_recipients set status=p_status,revision=revision+1,updated_at=now()
    where request_id=p_request and recipient_index=p_recipient returning * into current_row;
  insert into public.gala_invitation_events(request_id,recipient_index,previous_status,status,revision,reason)
    values(p_request,p_recipient,previous,p_status,current_row.revision,nullif(btrim(p_reason),''));
  return to_jsonb(current_row);
end $$;

create function public.gala_invitation_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by created_at,request_id,recipient_index),'[]'::jsonb) from (
    select r.request_id,r.recipient_index,r.recipient,q.details->'contact' as contact,r.status,r.revision,q.created_at,r.updated_at
    from public.gala_invitation_recipients r join public.gala_invitation_requests q on q.id=r.request_id
  ) row_data;
$$;
revoke all on function public.gala_request_invitations(jsonb),public.gala_set_invitation_status(uuid,integer,text,integer,text),public.gala_invitation_list() from public,anon,authenticated;
grant execute on function public.gala_request_invitations(jsonb),public.gala_set_invitation_status(uuid,integer,text,integer,text),public.gala_invitation_list() to service_role;
notify pgrst, 'reload schema';
commit;
