-- Membership QuickBooks OAuth. Do not apply to live without an authorized release.
begin;
create table public.qb_oauth_attempts (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  binding_hash text not null check (binding_hash ~ '^[a-f0-9]{64}$'),
  context_hash text not null check (context_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (clock_timestamp() + interval '10 minutes')
);
create index qb_oauth_attempts_expiry on public.qb_oauth_attempts (expires_at);
alter table public.qb_oauth_attempts enable row level security;
revoke all on public.qb_oauth_attempts from public, anon, authenticated, service_role;

create function public.qb_oauth_issue(p_state text, p_binding text, p_context text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.qb_oauth_attempts where expires_at <= clock_timestamp();
  insert into public.qb_oauth_attempts(state_hash, binding_hash, context_hash)
  values (p_state, p_binding, p_context);
end;
$$;
create function public.qb_oauth_consume(p_state text, p_binding text, p_context text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare consumed text;
begin
  -- Atomic claim: concurrent callbacks cannot both win.
  delete from public.qb_oauth_attempts
  where state_hash = p_state and binding_hash = p_binding and context_hash = p_context
    and expires_at > clock_timestamp()
  returning state_hash into consumed;
  return consumed is not null;
end;
$$;
revoke all on function public.qb_oauth_issue(text,text,text) from public, anon, authenticated;
revoke all on function public.qb_oauth_consume(text,text,text) from public, anon, authenticated;
grant execute on function public.qb_oauth_issue(text,text,text) to service_role;
grant execute on function public.qb_oauth_consume(text,text,text) to service_role;
commit;
