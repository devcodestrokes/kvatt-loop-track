-- First, unschedule the existing job if it exists
SELECT cron.unschedule('sync-orders-hourly');

-- Create new cron job that runs every 30 minutes
SELECT cron.schedule(
  'sync-orders-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://chuwqlhqmythlccnychv.supabase.co/functions/v1/fetch-orders-api',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"syncType": "incremental"}'::jsonb
  );
  $$
);