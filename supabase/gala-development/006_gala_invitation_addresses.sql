-- OSG GALA DEVELOPMENT ONLY. Preserve original requests for idempotent retries.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

alter table public.gala_invitation_events
  add column kind text not null default 'status' check(kind in ('status','address')),
  add column previous_recipient jsonb,
  add column recipient jsonb,
  add constraint gala_invitation_address_event_details check (
    kind <> 'address' or (previous_recipient is not null and recipient is not null)
  );

create function public.gala_set_invitation_address(
  p_request uuid,p_recipient integer,p_address jsonb,p_revision integer,p_reason text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.gala_invitation_recipients; old_address jsonb; old_status text;
  field_name text; field_value text; normalized jsonb := '{}'::jsonb;
begin
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
  old_address:=current_row.recipient; old_status:=current_row.status;
  -- A changed envelope must be prepared again. Never rewrite original request details.
  update public.gala_invitation_recipients set recipient=normalized,status='requested',revision=revision+1,updated_at=now()
    where request_id=p_request and recipient_index=p_recipient returning * into current_row;
  insert into public.gala_invitation_events(request_id,recipient_index,previous_status,status,revision,reason,kind,previous_recipient,recipient)
    values(p_request,p_recipient,old_status,current_row.status,current_row.revision,btrim(p_reason),'address',old_address,normalized);
  return to_jsonb(current_row);
end $$;

revoke all on function public.gala_set_invitation_address(uuid,integer,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.gala_set_invitation_address(uuid,integer,jsonb,integer,text) to service_role;
notify pgrst, 'reload schema';
commit;
