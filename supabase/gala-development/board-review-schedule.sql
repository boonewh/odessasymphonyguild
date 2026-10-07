-- OPTIONAL HOSTED TEST SETUP, not a production migration.
-- Apply only in OSG Gala Development (rhjwjfyjjdsfahlegqvd), after the
-- Preview endpoint is deployed and its authenticated request is verified.
-- First enable pg_cron and pg_net in that project's dashboard and save two
-- Vault secrets (never put their values in this file or the SQL history):
--   gala_board_recovery_secret: matches Preview GALA_RECOVERY_SECRET
--   gala_board_vercel_bypass: Vercel automation bypass for the OSG project
-- The scheduler credential cannot sign in as a board member or create orders.
begin;
do $$ begin
  if not exists (select 1 from public.gala_environment where id=1 and name='osg-gala-development') then
    raise exception 'Gala development database required';
  end if;
  if not exists (select 1 from pg_extension where extname='pg_cron')
    or not exists (select 1 from pg_extension where extname='pg_net') then
    raise exception 'Enable the development pg_cron and pg_net extensions first';
  end if;
  if (select count(*) from vault.decrypted_secrets where name in ('gala_board_recovery_secret','gala_board_vercel_bypass') and length(decrypted_secret)>=32) <> 2 then
    raise exception 'Set the two development-only Vault secrets first';
  end if;
end $$;

-- A fixed job name updates this one schedule on rerun rather than duplicating it.
select cron.schedule('gala-board-payment-recovery', '* * * * *', $job$
  select net.http_post(
    url := 'https://odessasymphonyguild-git-codex-gala-202-a1c1b0-boonewhs-projects.vercel.app/api/gala/recovery/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='gala_board_recovery_secret'),
      'x-vercel-protection-bypass', (select decrypted_secret from vault.decrypted_secrets where name='gala_board_vercel_bypass')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$job$);
commit;

-- Check HTTP responses (a successful cron enqueue alone is not successful recovery):
-- select id, status_code, timed_out from net._http_response order by created desc limit 5;
-- Also verify Gala admin's payment-check timestamp advances on its own.
-- To pause this test job without deleting its history:
-- select cron.alter_job((select jobid from cron.job where jobname='gala-board-payment-recovery'), active := false);
