-- Cron job for detect-new-launch: runs every 1 minute.

select cron.unschedule('detect-new-launch-cron')
  from cron.job where jobname = 'detect-new-launch-cron';

select cron.schedule(
  'detect-new-launch-cron',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://cslhekwiuksvjwezaevh.supabase.co/functions/v1/detect-new-launch',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGhla3dpdWtzdmp3ZXphZXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxMTgxMywiZXhwIjoyMDk1Mzg3ODEzfQ.rV0mODdSerwdG2sVFFUZUowj0G4iQ48ZVGZH-l9TxY4", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
