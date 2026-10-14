-- DEVELOPMENT ONLY. Read-only, complete ledger snapshot; no business rows changed.
begin;
do $$ begin
  if not exists(select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Development marker required';
  end if;
end $$;

-- One SQL statement sees orders, payment confirmations and accounting history at
-- one database snapshot. JSON aggregation avoids PostgREST's row response limit.
create function public.gala_ledger_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'details', o.details, 'amount', o.amount, 'currency', o.currency,
      'status', o.status, 'created_at', o.created_at,
      'stripe_session_id', o.stripe_session_id, 'payment_intent_id', o.payment_intent_id,
      'confirmed_at', (select min(e.created_at) from public.gala_payment_events e where e.order_id=o.id and e.state='paid')
    ) order by o.created_at, o.id) from public.gala_orders o), '[]'::jsonb),
    'accounting', coalesce((select jsonb_agg(jsonb_build_object(
      'order_id', a.order_id, 'status', a.status, 'dispatched_at', a.dispatched_at,
      'receipt_id', a.receipt_id, 'realm_id', a.realm_id
    ) order by a.order_id) from public.gala_accounting_outbox a), '[]'::jsonb)
  );
$$;
revoke all on function public.gala_ledger_snapshot() from public, anon, authenticated;
grant execute on function public.gala_ledger_snapshot() to service_role;
commit;
