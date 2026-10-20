-- Operator verification after initial installation, before sales activation.
-- Read-only. An exception means installation must be investigated, not opened.
begin transaction isolation level repeatable read read only;
do $verify$
declare obj record; rows_present bigint;
begin
  if (select name from public.gala_environment where id=1) is distinct from 'osg-gala-production' then
    raise exception 'Production Gala marker missing';
  end if;
  if not exists(select 1 from public.gala_operating_state where id=1 and not sales_open and not invitations_open) then
    raise exception 'Sales and invitations must remain closed';
  end if;
  if (select count(*) from public.gala_inventory)<>3
    or exists(select 1 from public.gala_inventory where capacity is not null or not board_confirmed) then
    raise exception 'Expected three approved unlimited tiers';
  end if;
  for obj in select unnest(array[
    'gala_orders','gala_order_tables','gala_invitation_requests','gala_invitation_recipients',
    'gala_staff','gala_staff_sessions','gala_payment_events','gala_accounting_outbox',
    'gala_final_total','gala_payment_recovery'
  ]) as name loop
    execute format('select count(*) from public.%I',obj.name) into rows_present;
    if rows_present<>0 then raise exception 'Fresh installation contains records in %',obj.name; end if;
  end loop;
  if exists(select 1 from public.gala_qb_connection where sealed_tokens is not null) then
    raise exception 'Gala accounting must remain disconnected';
  end if;
  if exists(select 1 from pg_class where relnamespace='public'::regnamespace
    and left(relname,5)='gala_' and relkind='r' and not relrowsecurity) then
    raise exception 'Gala table missing row-level security';
  end if;
  for obj in select unnest(array['anon','authenticated']) as name loop
    if exists(select 1 from pg_class where relnamespace='public'::regnamespace
      and left(relname,5)='gala_' and relkind='r'
      and (has_table_privilege(obj.name,oid,'SELECT') or has_table_privilege(obj.name,oid,'INSERT')
        or has_table_privilege(obj.name,oid,'UPDATE') or has_table_privilege(obj.name,oid,'DELETE'))) then
      raise exception 'Browser role % can access Gala tables',obj.name;
    end if;
    if exists(select 1 from pg_proc where pronamespace='public'::regnamespace
      and left(proname,5)='gala_' and has_function_privilege(obj.name,oid,'EXECUTE')) then
      raise exception 'Browser role % can execute Gala functions',obj.name;
    end if;
  end loop;
  if has_table_privilege('service_role','public.gala_operating_state','UPDATE')
    or has_table_privilege('service_role','public.gala_environment','UPDATE')
    or has_table_privilege('service_role','public.gala_qb_connection','SELECT')
    or has_table_privilege('service_role','public.gala_staff_sessions','SELECT') then
    raise exception 'Application role has unexpected control privileges';
  end if;
end $verify$;
select 'passed' as closed_installation_verification,
  (select name from public.gala_environment where id=1) as environment,
  sales_open,invitations_open from public.gala_operating_state where id=1;
commit;
