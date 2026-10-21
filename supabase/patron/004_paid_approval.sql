-- Apply once after 003_payments.sql. Payment must precede name approval.
begin;
create or replace function public.patron_moderate() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if TG_OP='INSERT' then
    new.approved_at := null;
    if new.source='online' then new.published := false; end if;
  else
    if new.source is distinct from old.source then raise exception 'patron_source_immutable'; end if;
    new.approved_at := old.approved_at;
  end if;
  if new.dues_status not in ('card_paid','check_recorded') then
    if new.published then raise exception 'patron_payment_required'; end if;
    new.approved_at := null;
  elsif new.published and new.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.patron_moderate() from public,anon,authenticated;
-- Withdraw any approval granted before payment under the former rule.
-- Preserve contact records, payment ledger, and all paid/check approvals.
update public.patron_members set published=false,approved_at=null
  where dues_status not in ('card_paid','check_recorded') and (published or approved_at is not null);
alter table public.patron_members add constraint patron_approval_requires_payment
  check ((not published and approved_at is null) or dues_status in ('card_paid','check_recorded'));
commit;
