-- =============================================================================
-- 0046 — Telling people about their sessions
--
-- A session nobody remembers is a session nobody attends, and the platform
-- already knows everything needed to remind them: who the participants are,
-- when it starts, and — since 0044 — whether it ended with anybody in the room.
--
-- Two kinds of message, and they are different in nature:
--
--   * the moment a session exists, everybody it was booked for is told once,
--     as it happens, by a trigger;
--   * the reminders that depend only on the clock (a day before, an hour
--     before, the door opening, the session starting, the session ending) are a
--     job — the database cannot wake itself up, so something has to call it.
--
-- Each timed reminder is written down as it is sent, so running the job twice
-- in the same minute does not send anything twice. That record is what makes
-- the job safe to schedule as often as one likes.
-- =============================================================================

create table public.video_session_reminders (
  session_id uuid not null references public.video_sessions (id) on delete cascade,
  mark       text not null check (mark in ('day', 'hour', 'lobby', 'started', 'ended')),
  sent_at    timestamptz not null default now(),

  primary key (session_id, mark)
);

-- Nobody reads this but the job: it is bookkeeping, not content.
alter table public.video_session_reminders enable row level security;

-- ---------------------------------------------------------------------------
-- The moment a session exists
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.video_sessions%rowtype;
begin
  select * into v_session from public.video_sessions where id = new.session_id;

  perform public.notify(
    new.profile_id,
    case when v_session.session_type = 'team_internal' then 'team' else 'booking' end::public.notification_kind,
    case when v_session.session_type = 'team_internal'
         then 'اجتماع فريقك أصبح في جدولك'
         else 'فُتحت غرفة جلستك'
    end,
    'تبدأ ' || to_char(v_session.start_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') ||
      ' UTC. الباب يفتح قبل الموعد بخمس دقائق، والدخول من حسابك — لا يوجد رابط يُرسل.',
    '/sessions/' || new.session_id
  );

  return new;
end;
$$;

create trigger video_session_participants_notify
  after insert on public.video_session_participants
  for each row execute function public.notify_new_participant();

-- ---------------------------------------------------------------------------
-- One reminder, to everybody in a session, at most once
-- ---------------------------------------------------------------------------
create or replace function public.notify_session(
  p_session uuid,
  p_mark    text,
  p_title   text,
  p_body    text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken boolean;
  v_count integer := 0;
begin
  insert into public.video_session_reminders (session_id, mark)
  values (p_session, p_mark)
  on conflict do nothing
  returning true into v_taken;

  -- Somebody (or an earlier run) already sent this one.
  if v_taken is null then
    return 0;
  end if;

  insert into public.notifications (profile_id, kind, title_ar, body_ar, link)
  select vp.profile_id,
         case when s.session_type = 'team_internal' then 'team' else 'booking' end::public.notification_kind,
         p_title,
         p_body,
         '/sessions/' || p_session
    from public.video_session_participants vp
    join public.video_sessions s on s.id = vp.session_id
   where vp.session_id = p_session;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_session(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The job
-- ---------------------------------------------------------------------------
-- Everything below is decided by the server's clock against the session's own
-- times — the same clock that decides which door is open.
create or replace function public.notify_due_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_total integer := 0;
begin
  -- a day before
  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() + interval '23 hours' and now() + interval '25 hours'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'day', 'جلستك غداً',
      'تبدأ جلستك بعد نحو أربع وعشرين ساعة.');
  end loop;

  -- an hour before
  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() and now() + interval '1 hour'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'hour', 'جلستك بعد ساعة',
      'جهّز ما تحتاجه — تستطيع فحص الكاميرا والميكروفون حين يفتح الباب.');
  end loop;

  -- the door opens
  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() and now() + interval '5 minutes'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'lobby', 'الباب مفتوح',
      'تستطيع الدخول الآن وفحص الصوت والصورة قبل البدء.');
  end loop;

  -- it has started
  for v_row in
    select s.id from public.video_sessions s
     where s.status in ('scheduled', 'live')
       and now() >= s.start_at and now() < s.end_at
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'started', 'بدأت الجلسة',
      'الجلسة جارية الآن.');
  end loop;

  -- it is over, and there is something to say about it
  for v_row in
    select s.id, s.status, s.booking_id from public.video_sessions s
     where s.status in ('completed', 'no_show')
       and s.end_at < now()
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'ended',
      case when v_row.status = 'no_show' then 'انتهت الجلسة دون حضور' else 'انتهت الجلسة' end,
      case
        when v_row.status = 'no_show' then 'لم يدخل أحد الغرفة في وقتها.'
        when v_row.booking_id is not null then 'ملخّص الحضور بالداخل — ويسعدنا تقييمك للجلسة.'
        else 'ملخّص الحضور بالداخل.'
      end);
  end loop;

  return v_total;
end;
$$;

comment on function public.notify_due_sessions is
  'Clock-driven session reminders. Safe to call as often as one likes: each reminder is written down as it is sent.';

revoke execute on function public.notify_due_sessions() from public, anon, authenticated;
