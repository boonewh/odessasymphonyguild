-- OSG GALA DEVELOPMENT ONLY. Retain every request; suppression is reversible.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;
alter table public.gala_invitation_recipients
  add column duplicate_request_id uuid,
  add column duplicate_recipient_index integer,
  add constraint gala_invitation_duplicate_target foreign key(duplicate_request_id,duplicate_recipient_index)
    references public.gala_invitation_recipients(request_id,recipient_index),
  add constraint gala_invitation_duplicate_pair check ((duplicate_request_id is null)=(duplicate_recipient_index is null)),
  add constraint gala_invitation_duplicate_self check (duplicate_request_id<>request_id or duplicate_recipient_index<>recipient_index),
  add constraint gala_invitation_suppressed_unprepared check (duplicate_request_id is null or status='requested');
alter table public.gala_invitation_events drop constraint gala_invitation_events_kind_check;
alter table public.gala_invitation_events
  add constraint gala_invitation_events_kind_check check(kind in ('status','address','duplicate')),
  add column resolution_before jsonb,
  add column resolution_after jsonb;

-- A separate decision applies only to these two recipients at these exact addresses.
create table public.gala_invitation_separate_pairs (
  request_id uuid not null, recipient_index integer not null,
  other_request_id uuid not null, other_recipient_index integer not null,
  recipient jsonb not null, other_recipient jsonb not null,
  primary key(request_id,recipient_index,other_request_id,other_recipient_index),
  foreign key(request_id,recipient_index) references public.gala_invitation_recipients,
  foreign key(other_request_id,other_recipient_index) references public.gala_invitation_recipients,
  check(request_id::text||':'||recipient_index::text < other_request_id::text||':'||other_recipient_index::text)
);
alter table public.gala_invitation_separate_pairs enable row level security;
revoke all on public.gala_invitation_separate_pairs from public,anon,authenticated;
grant select,insert,update,delete on public.gala_invitation_separate_pairs to service_role;

-- Serialize the small local mailing workflow BEFORE taking recipient row locks.
-- Address, status and duplicate decisions must agree on which entries can be mailed.
create or replace function public.gala_set_invitation_status(p_request uuid,p_recipient integer,p_status text,p_revision integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.gala_invitation_recipients; previous text; old_rank integer; new_rank integer;
begin
  perform pg_advisory_xact_lock(2027,7);
  if p_revision is null or p_revision<0 or p_status is null or p_status not in ('requested','prepared','mailed')
    or length(coalesce(p_reason,''))>300 then raise exception 'Invalid status update'; end if;
  select * into current_row from public.gala_invitation_recipients where request_id=p_request and recipient_index=p_recipient for update;
  if not found then raise exception 'Unknown recipient'; end if;
  if current_row.revision<>p_revision then raise exception 'Recipient changed; refresh before editing'; end if;
  if current_row.duplicate_request_id is not null then raise exception 'Restore suppressed invitation before updating'; end if;
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

create or replace function public.gala_set_invitation_address(
  p_request uuid,p_recipient integer,p_address jsonb,p_revision integer,p_reason text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.gala_invitation_recipients; old_address jsonb; old_status text;
  field_name text; field_value text; normalized jsonb := '{}'::jsonb;
begin
  perform pg_advisory_xact_lock(2027,7);
  if p_revision is null or p_revision<0 or length(btrim(coalesce(p_reason,'')))<3
    or length(p_reason)>300 then raise exception 'Revision and correction reason required'; end if;
  if jsonb_typeof(p_address) is distinct from 'object' then raise exception 'Invalid address'; end if;
  if (select count(*) from jsonb_object_keys(p_address))<>6 then raise exception 'Invalid address fields'; end if;
  foreach field_name in array array['name','address','address2','city','state','zip'] loop
    if jsonb_typeof(p_address->field_name) is distinct from 'string' then raise exception 'Invalid address field'; end if;
    field_value := btrim(p_address->>field_name);
    if length(field_value) < (case field_name when 'address2' then 0 when 'address' then 3 else 2 end)
      or length(field_value) > (case field_name when 'address' then 200 when 'city' then 100
        when 'state' then 2 when 'zip' then 10 else 120 end) then raise exception 'Invalid address length'; end if;
    normalized := normalized || jsonb_build_object(field_name,field_value);
  end loop;
  if (normalized->>'state') !~ '^[A-Za-z]{2}$' or (normalized->>'zip') !~ '^[0-9]{5}(-[0-9]{4})?$'
    then raise exception 'Invalid state or ZIP'; end if;

  select * into current_row from public.gala_invitation_recipients
    where request_id=p_request and recipient_index=p_recipient for update;
  if not found then raise exception 'Unknown recipient'; end if;
  if current_row.revision<>p_revision then raise exception 'Recipient changed; refresh before editing'; end if;
  if current_row.status='mailed' then raise exception 'Mailed addresses are locked'; end if;
  if current_row.recipient=normalized then return to_jsonb(current_row); end if;
  if current_row.duplicate_request_id is not null then raise exception 'Restore suppressed invitation before editing'; end if;
  if exists(select 1 from public.gala_invitation_recipients where duplicate_request_id=p_request and duplicate_recipient_index=p_recipient)
    then raise exception 'Restore linked duplicate entries before changing the retained address'; end if;
  -- Forget separate decisions after an actual correction, even if the address later changes back.
  delete from public.gala_invitation_separate_pairs where (request_id=p_request and recipient_index=p_recipient)
    or (other_request_id=p_request and other_recipient_index=p_recipient);
  old_address:=current_row.recipient; old_status:=current_row.status;
  -- A changed envelope must be prepared again. Never rewrite original request details.
  update public.gala_invitation_recipients set recipient=normalized,status='requested',revision=revision+1,updated_at=now()
    where request_id=p_request and recipient_index=p_recipient returning * into current_row;
  insert into public.gala_invitation_events(request_id,recipient_index,previous_status,status,revision,reason,kind,previous_recipient,recipient)
    values(p_request,p_recipient,old_status,current_row.status,current_row.revision,btrim(p_reason),'address',old_address,normalized);
  return to_jsonb(current_row);
end $$;

create function public.gala_resolve_invitation_duplicate(
  p_request uuid,p_recipient integer,p_revision integer,p_decision text,
  p_target uuid,p_target_recipient integer,p_target_revision integer,p_reason text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare source_row public.gala_invitation_recipients; target_row public.gala_invitation_recipients;
  left_row public.gala_invitation_recipients; right_row public.gala_invitation_recipients;
  old_resolution jsonb; old_status text; new_resolution jsonb;
begin
  perform pg_advisory_xact_lock(2027,7);
  if p_decision is null or p_decision not in ('suppress','separate','restore') or p_revision is null or p_revision<0
    or length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>300 then raise exception 'Invalid duplicate decision'; end if;
  select * into source_row from public.gala_invitation_recipients where request_id=p_request and recipient_index=p_recipient for update;
  if not found then raise exception 'Unknown recipient'; end if;
  if source_row.revision<>p_revision then raise exception 'Recipient changed; refresh before editing'; end if;
  old_status:=source_row.status;
  old_resolution:=jsonb_build_object('duplicate_request_id',source_row.duplicate_request_id,'duplicate_recipient_index',source_row.duplicate_recipient_index);
  if p_decision='restore' then
    if p_target is not null or p_target_recipient is not null or p_target_revision is not null then raise exception 'Restore takes no target'; end if;
    if source_row.duplicate_request_id is null then return to_jsonb(source_row); end if;
    update public.gala_invitation_recipients set duplicate_request_id=null,duplicate_recipient_index=null,status='requested',revision=revision+1,updated_at=now()
      where request_id=p_request and recipient_index=p_recipient returning * into source_row;
    delete from public.gala_invitation_separate_pairs where (request_id=p_request and recipient_index=p_recipient)
      or (other_request_id=p_request and other_recipient_index=p_recipient);
    new_resolution:=jsonb_build_object('decision','restore');
  else
    if p_target is null or p_target_recipient is null or p_target_revision is null or p_target_revision<0
      or (p_target=p_request and p_target_recipient=p_recipient) then raise exception 'Choose a different recipient'; end if;
    select * into target_row from public.gala_invitation_recipients where request_id=p_target and recipient_index=p_target_recipient for update;
    if not found then raise exception 'Unknown retained recipient'; end if;
    if target_row.revision<>p_target_revision then raise exception 'Other recipient changed; refresh before editing'; end if;
    if target_row.duplicate_request_id is not null then raise exception 'Cannot link to a suppressed entry'; end if;
    if p_decision='suppress' and source_row.duplicate_request_id=p_target and source_row.duplicate_recipient_index=p_target_recipient then return to_jsonb(source_row); end if;
    if source_row.duplicate_request_id is not null then raise exception 'Restore before changing a duplicate decision'; end if;
    if p_decision='suppress' then
      if source_row.status='mailed' then raise exception 'Cannot suppress an invitation already mailed'; end if;
      if exists(select 1 from public.gala_invitation_recipients where duplicate_request_id=p_request and duplicate_recipient_index=p_recipient)
        then raise exception 'Cannot suppress an entry retained for other duplicates'; end if;
      update public.gala_invitation_recipients set duplicate_request_id=p_target,duplicate_recipient_index=p_target_recipient,
        status='requested',revision=revision+1,updated_at=now()
        where request_id=p_request and recipient_index=p_recipient returning * into source_row;
    else
      if p_request::text||':'||p_recipient::text < p_target::text||':'||p_target_recipient::text then
        left_row:=source_row;right_row:=target_row;
      else left_row:=target_row;right_row:=source_row; end if;
      if exists(select 1 from public.gala_invitation_separate_pairs where request_id=left_row.request_id and recipient_index=left_row.recipient_index
        and other_request_id=right_row.request_id and other_recipient_index=right_row.recipient_index
        and recipient=left_row.recipient and other_recipient=right_row.recipient) then return to_jsonb(source_row); end if;
      insert into public.gala_invitation_separate_pairs values(left_row.request_id,left_row.recipient_index,right_row.request_id,right_row.recipient_index,left_row.recipient,right_row.recipient)
        on conflict(request_id,recipient_index,other_request_id,other_recipient_index) do update set recipient=excluded.recipient,other_recipient=excluded.other_recipient;
      update public.gala_invitation_recipients set revision=revision+1,updated_at=now()
        where request_id=p_request and recipient_index=p_recipient returning * into source_row;
    end if;
    new_resolution:=jsonb_build_object('decision',p_decision,'target_request_id',p_target,'target_recipient_index',p_target_recipient,
      'recipient',source_row.recipient,'target_recipient',target_row.recipient);
  end if;
  insert into public.gala_invitation_events(request_id,recipient_index,previous_status,status,revision,reason,kind,resolution_before,resolution_after)
    values(p_request,p_recipient,old_status,source_row.status,source_row.revision,btrim(p_reason),'duplicate',old_resolution,new_resolution);
  return to_jsonb(source_row);
end $$;

create or replace function public.gala_invitation_list()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(row_data order by created_at,request_id,recipient_index),'[]'::jsonb) from (
    select r.request_id,r.recipient_index,r.recipient,q.details->'contact' as contact,r.status,r.revision,q.created_at,r.updated_at,
      r.duplicate_request_id,r.duplicate_recipient_index,
      coalesce((select jsonb_agg(other.request_id::text||':'||other.recipient_index::text)
        from public.gala_invitation_separate_pairs p join public.gala_invitation_recipients other
        on (p.request_id=r.request_id and p.recipient_index=r.recipient_index and other.request_id=p.other_request_id and other.recipient_index=p.other_recipient_index and r.recipient=p.recipient and other.recipient=p.other_recipient)
        or (p.other_request_id=r.request_id and p.other_recipient_index=r.recipient_index and other.request_id=p.request_id and other.recipient_index=p.recipient_index and r.recipient=p.other_recipient and other.recipient=p.recipient)
        where r.duplicate_request_id is null and other.duplicate_request_id is null),'[]'::jsonb) as separate_from
    from public.gala_invitation_recipients r join public.gala_invitation_requests q on q.id=r.request_id
  ) row_data;
$$;
revoke all on function public.gala_resolve_invitation_duplicate(uuid,integer,integer,text,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.gala_resolve_invitation_duplicate(uuid,integer,integer,text,uuid,integer,integer,text) to service_role;
notify pgrst, 'reload schema';
commit;
