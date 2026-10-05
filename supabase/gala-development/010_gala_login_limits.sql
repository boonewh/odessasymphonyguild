-- DEVELOPMENT ONLY. Provisional engineering limits, not production access approval.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development')
    or to_regclass('public.gala_staff') is null then
    raise exception 'Gala development access schema required';
  end if;
end $$;

create table public.gala_login_limits (
  bucket text primary key check(bucket='global' or bucket ~ '^[a-f0-9]{64}$'),
  attempts integer not null check(attempts between 0 and 120),
  expires_at timestamptz not null
);
insert into public.gala_login_limits values('global',0,now());
alter table public.gala_login_limits enable row level security;
revoke all on public.gala_login_limits from public,anon,authenticated;
grant select,insert,update,delete on public.gala_login_limits to service_role;

-- Serialize admission before Auth is called. Fixed windows do not slide on denial.
-- Five attempts per normalized email/15 minutes, plus 120 total/5 minutes.
-- Neither successful login nor app restart resets these durable counters.
create function public.gala_consume_staff_login(p_account text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare total public.gala_login_limits; account public.gala_login_limits; checked_at timestamptz;
begin
  if p_account is null or p_account !~ '^[a-f0-9]{64}$' then raise exception 'Invalid login bucket'; end if;
  select * into strict total from public.gala_login_limits where bucket='global' for update;
  checked_at:=clock_timestamp();
  if total.expires_at<=checked_at then
    update public.gala_login_limits set attempts=0,expires_at=checked_at+interval '5 minutes'
      where bucket='global' returning * into total;
  end if;
  if total.attempts>=120 then
    return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from total.expires_at-checked_at))::integer));
  end if;
  delete from public.gala_login_limits where bucket<>'global' and expires_at<=checked_at;
  select * into account from public.gala_login_limits where bucket=p_account;
  if found and account.attempts>=5 then
    return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from account.expires_at-checked_at))::integer));
  end if;
  insert into public.gala_login_limits values(p_account,1,checked_at+interval '15 minutes')
    on conflict(bucket) do update set attempts=public.gala_login_limits.attempts+1;
  update public.gala_login_limits set attempts=attempts+1 where bucket='global';
  return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;
revoke all on function public.gala_consume_staff_login(text) from public,anon,authenticated;
grant execute on function public.gala_consume_staff_login(text) to service_role;
notify pgrst,'reload schema';
commit;
