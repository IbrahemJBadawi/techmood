-- =============================================================================
-- 0086 — The platform's clock, scheduled in the database itself
--
-- Four functions only mean anything if something runs them on time:
--
--   expire_stale_bookings()        every 5 min  — release slots held but never paid for
--   close_due_video_sessions()     every 5 min  — end sessions whose time has passed
--   notify_due_sessions()          every 5 min  — reminders that depend only on the clock
--   mentor_request_housekeeping()  every 10 min — decline paid requests a mentor let
--                                                 lapse, pause repeat offenders, end holidays
--
-- They were documented in the README as commands to run by hand. They are now
-- scheduled here with pg_cron, so a fresh `supabase db push` starts the clock.
-- Supabase ships pg_cron; a database without it (a local test cluster) skips
-- this migration with a notice instead of failing, and the functions stay
-- callable by hand. cron.schedule() with the same job name replaces the job,
-- so running this again is harmless.
-- =============================================================================

do $migration$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available here: the platform jobs are not scheduled (run them by hand, see README).';
    return;
  end if;

  -- pg_cron lives in one database (cron.database_name; `postgres` on Supabase).
  -- Anywhere else — a throwaway test database — the jobs are not ours to add.
  if coalesce(current_setting('cron.database_name', true), 'postgres') <> current_database() then
    raise notice 'pg_cron runs in database %, not %: the platform jobs are not scheduled here.',
      coalesce(current_setting('cron.database_name', true), 'postgres'), current_database();
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.schedule('techmood-expire-bookings',  '*/5 * * * *',  $$select public.expire_stale_bookings()$$);
  perform cron.schedule('techmood-close-sessions',   '*/5 * * * *',  $$select public.close_due_video_sessions()$$);
  perform cron.schedule('techmood-notify-sessions',  '*/5 * * * *',  $$select public.notify_due_sessions()$$);
  perform cron.schedule('techmood-mentor-requests',  '*/10 * * * *', $$select public.mentor_request_housekeeping()$$);
end
$migration$;

-- What the admin can see about the clock: which jobs exist and how their last
-- runs went. Empty where pg_cron is not installed.
create or replace function public.admin_scheduled_jobs()
returns table (job text, schedule text, active boolean, last_run timestamptz, last_status text, last_message text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() or to_regclass('cron.job') is null then
    return;
  end if;

  return query execute $q$
    select j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.status::text, left(d.return_message, 300)
      from cron.job j
      left join lateral (
        select r.start_time, r.status, r.return_message
          from cron.job_run_details r
         where r.jobid = j.jobid
         order by r.start_time desc
         limit 1
      ) d on true
     where j.jobname like 'techmood-%'
     order by j.jobname
  $q$;
end;
$$;

grant execute on function public.admin_scheduled_jobs() to authenticated;
