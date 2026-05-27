-- pg_cron jobs — calls edge functions every 30 minutes

select cron.unschedule('claim-fees-cron')  from cron.job where jobname = 'claim-fees-cron';
select cron.unschedule('scan-holders-cron') from cron.job where jobname = 'scan-holders-cron';

select cron.schedule(
  'claim-fees-cron',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://cslhekwiuksvjwezaevh.supabase.co/functions/v1/claim-fees',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGhla3dpdWtzdmp3ZXphZXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxMTgxMywiZXhwIjoyMDk1Mzg3ODEzfQ.rV0mODdSerwdG2sVFFUZUowj0G4iQ48ZVGZH-l9TxY4", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'scan-holders-cron',
  '5-59/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://cslhekwiuksvjwezaevh.supabase.co/functions/v1/scan-holders',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGhla3dpdWtzdmp3ZXphZXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxMTgxMywiZXhwIjoyMDk1Mzg3ODEzfQ.rV0mODdSerwdG2sVFFUZUowj0G4iQ48ZVGZH-l9TxY4", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
