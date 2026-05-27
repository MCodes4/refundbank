-- pg_cron jobs — run every 2 minutes

select cron.unschedule('detect-token-cron') from cron.job where jobname = 'detect-token-cron';
select cron.unschedule('claim-fees-cron')   from cron.job where jobname = 'claim-fees-cron';
select cron.unschedule('scan-holders-cron') from cron.job where jobname = 'scan-holders-cron';

select cron.schedule(
  'detect-token-cron',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://cslhekwiuksvjwezaevh.supabase.co/functions/v1/detect-token',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGhla3dpdWtzdmp3ZXphZXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxMTgxMywiZXhwIjoyMDk1Mzg3ODEzfQ.rV0mODdSerwdG2sVFFUZUowj0G4iQ48ZVGZH-l9TxY4", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'claim-fees-cron',
  '*/2 * * * *',
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
  '1-59/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://cslhekwiuksvjwezaevh.supabase.co/functions/v1/scan-holders',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGhla3dpdWtzdmp3ZXphZXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxMTgxMywiZXhwIjoyMDk1Mzg3ODEzfQ.rV0mODdSerwdG2sVFFUZUowj0G4iQ48ZVGZH-l9TxY4", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
