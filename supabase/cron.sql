-- Schedules the daily reminder check.
--
-- Run this ONCE in the Supabase SQL editor, after deploying the send-reminders
-- Edge Function. Replace the two placeholders first.
--
--   <PROJECT_REF>  the subdomain of your Supabase URL
--                  (https://abcdefgh.supabase.co -> abcdefgh)
--   <CRON_SECRET>  the same value you set as the CRON_SECRET function secret
--
-- The job fires every 15 minutes and the function works out whose reminder time
-- has just passed. It does NOT send 96 notifications a day: each person gets at
-- most one, enforced by the primary key on notification_log.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Safe to re-run: drops any previous version of the job first.
select cron.unschedule('plantshare-reminders')
where exists (select 1 from cron.job where jobname = 'plantshare-reminders');

select cron.schedule(
  'plantshare-reminders',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);

-- Check it is registered:
--   select jobname, schedule, active from cron.job;
-- Check recent runs:
--   select * from cron.job_run_details order by start_time desc limit 10;
