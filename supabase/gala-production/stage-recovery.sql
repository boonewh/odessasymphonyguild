-- Operator-only setup for the approved production membership project.
-- Separate from the one-time schema installer. Does not open sales.
-- The secret is generated inside Vault, never embedded in SQL text/history.
-- Copy ONLY this named secret privately to Vercel GALA_LIVE_RECOVERY_SECRET.
-- The schedule remains inactive until the hosted endpoint is verified.
begin;
select pg_advisory_xact_lock(hashtext('gala-live-recovery-setup'));
do $$ begin
  if not exists (select 1 from public.gala_environment where id=1 and name='osg-gala-production') then
    raise exception 'Gala production database required';
  end if;
  if not exists (select 1 from public.gala_operating_state where id=1 and not sales_open and not invitations_open) then
    raise exception 'Initial scheduler staging requires closed sales and invitations';
  end if;
end $$;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if exists (select 1 from cron.job where jobname='gala-live-payment-recovery' and active) then
    raise exception 'Existing active Gala recovery job requires operator review';
  end if;
  if not exists (select 1 from vault.secrets where name='gala_live_recovery_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'gala_live_recovery_secret',
      'OSG Gala production payment recovery; matches Vercel GALA_LIVE_RECOVERY_SECRET'
    );
  end if;
  if (select count(*) from vault.decrypted_secrets
      where name='gala_live_recovery_secret' and decrypted_secret ~ '^[a-f0-9]{64}$') <> 1 then
    raise exception 'Expected one valid Gala live recovery secret';
  end if;
end $$;

select cron.schedule('gala-live-payment-recovery', '* * * * *', $job$
  select net.http_post(
    url := 'https://www.odessasymphonyguild.org/api/gala/recovery/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name='gala_live_recovery_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$job$);

-- In the same transaction as creation: the scheduler never observes an active job.
select cron.alter_job(
  (select jobid from cron.job where jobname='gala-live-payment-recovery'),
  active := false
);
commit;

select jobname, schedule, active from cron.job where jobname='gala-live-payment-recovery';
