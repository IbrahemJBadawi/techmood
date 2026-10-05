-- =============================================================================
-- 0125 — The founder's session rules: a $10 start, instant booking, absences
--
-- 1. Level 1's default price is $10 an hour (the range stays $10–$30, and
--    TechMood's 33.33% stays: $3.33 + $6.67). A mentor who named their own
--    price keeps it.
--
-- 2. Instant booking. A slot inside the usual notice window (72 hours by
--    default) can be booked "now", at +50% (instant_booking_surcharge_pct),
--    as long as it starts at least instant_booking_min_minutes from now — the
--    time TechMood needs to confirm the payment. The booking says so
--    (bookings.is_instant), the calendar offers such slots as 'instant', and
--    the price is set where every booking is priced (price_booking), so no
--    path can book an instant slot at the ordinary price. Moving a booking
--    still needs the full notice.
--
-- 3. Absence.
--    * The mentor did not come (the learner records it): the mentor has 24
--      hours to say it was held. If they do not, the learner is refunded in
--      full, automatically. If they do, the admins decide.
--    * The learner did not come (the mentor records it): the first time, the
--      learner keeps the session — one free reschedule within 14 days, no
--      refund. A second absence, or no new time within 14 days, counts the
--      session as held.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Level 1 starts at $10
-- ---------------------------------------------------------------------------
update public.mentor_levels
   set session_price_usd  = 10,
       platform_share_usd = round(10 * commission_pct / 100, 2),
       mentor_share_usd   = 10 - round(10 * commission_pct / 100, 2)
 where level = 'L1';

insert into public.platform_settings (key, value, description_ar) values
  ('instant_booking_surcharge_pct', '50',  'الزيادة على سعر الجلسة عند الحجز الفوري (داخل مهلة الحجز المعتادة)'),
  ('instant_booking_min_minutes',   '120', 'أقل مدة بين الحجز الفوري وبداية الجلسة، لتأكيد الدفع'),
  ('mentor_absence_dispute_hours',  '24',  'مهلة المنتور للاعتراض على تسجيل غيابه قبل الاسترداد التلقائي'),
  ('learner_reschedule_days',       '14',  'مهلة الطالب لاختيار موعد جديد بعد غيابه الأول')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Instant booking
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column is_instant boolean not null default false;

comment on column public.bookings.is_instant is
  'Booked inside the usual notice window, at the instant surcharge (0125).';

-- Priced here, whatever path wrote it (0077). Named bookings_price, this runs
-- before bookings_rules (triggers fire in name order), so the rules see the
-- instant mark.
create or replace function public.price_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote  record;
  v_notice integer := coalesce(public.setting_int('booking_min_notice_hours'), 72);
  v_factor numeric := 1;
begin
  if new.session_type_id is null then
    return new;
  end if;

  new.is_instant := new.scheduled_start < now() + (v_notice || ' hours')::interval;
  if new.is_instant then
    v_factor := 1 + coalesce(public.setting_int('instant_booking_surcharge_pct'), 50) / 100.0;
  end if;

  select * into v_quote from public.session_quote(new.mentor_id, new.session_type_id);
  if not found then
    return new;
  end if;

  new.price_usd          := round(v_quote.price_usd * v_factor, 2) * greatest(new.seats, 1);
  new.platform_share_usd := round(v_quote.platform_share_usd * v_factor, 2) * greatest(new.seats, 1);
  new.mentor_share_usd   := new.price_usd - new.platform_share_usd;
  return new;
end;
$$;

revoke execute on function public.price_booking() from public, anon, authenticated;

-- The booking rules (0047), with the instant window.
create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dow        smallint;
  v_start_time time;
  v_end_time   time;
  v_notice     integer;
  v_instant    integer;
  v_limit      integer;
  v_buffer     integer;
  v_today      integer;
begin
  if tg_op = 'INSERT' or new.scheduled_start is distinct from old.scheduled_start then
    v_notice  := coalesce(public.setting_int('booking_min_notice_hours'), 72);
    v_instant := coalesce(public.setting_int('instant_booking_min_minutes'), 120);
    if tg_op = 'INSERT' and new.is_instant then
      if new.scheduled_start < now() + (v_instant || ' minutes')::interval then
        raise exception 'الحجز الفوري يبدأ بعد % دقيقة على الأقل من الآن', v_instant;
      end if;
    elsif new.scheduled_start < now() + (v_notice || ' hours')::interval then
      raise exception 'a session must be booked at least % hours in advance', v_notice;
    end if;
  end if;

  v_dow        := extract(dow from new.scheduled_start)::smallint;
  v_start_time := new.scheduled_start::time;
  v_end_time   := new.scheduled_end::time;

  -- a date the mentor closed is closed, whatever the weekly rule says
  if exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and not ex.is_open
  ) then
    raise exception 'the mentor is not available on that date';
  end if;

  if not exists (
    select 1 from public.mentor_availability ma
    where ma.mentor_id = new.mentor_id
      and ma.day_of_week = v_dow
      and ma.start_time <= v_start_time
      and ma.end_time   >= v_end_time
  ) and not exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and ex.is_open
      and ex.start_time <= v_start_time
      and ex.end_time   >= v_end_time
  ) then
    raise exception 'the requested slot is outside the mentor published availability';
  end if;

  if exists (
    select 1 from public.mentor_time_off t
    where t.mentor_id = new.mentor_id
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
  ) then
    raise exception 'the mentor is unavailable during the requested slot';
  end if;

  select mp.daily_session_limit, mp.buffer_minutes
    into v_limit, v_buffer
    from public.mentor_profiles mp where mp.profile_id = new.mentor_id;

  if new.status not in ('cancelled', 'rejected', 'refunded', 'expired') then
    select count(*)::int into v_today
      from public.bookings b
     where b.mentor_id = new.mentor_id
       and b.id <> new.id
       and b.scheduled_start::date = new.scheduled_start::date
       and (
         public.booking_holds_time(b.status)
         or (b.status in ('payment_pending', 'payment_submitted')
             and coalesce(b.reserved_until, b.scheduled_start) > now())
       );

    if v_today >= coalesce(v_limit, 5) then
      raise exception 'بلغ المنتور حدّه اليومي من الجلسات';
    end if;

    if coalesce(v_buffer, 0) > 0 and exists (
      select 1 from public.bookings b
       where b.mentor_id = new.mentor_id
         and b.id <> new.id
         and (
           public.booking_holds_time(b.status)
           or (b.status in ('payment_pending', 'payment_submitted')
               and coalesce(b.reserved_until, b.scheduled_start) > now())
         )
         and tstzrange(b.scheduled_start - (v_buffer || ' minutes')::interval,
                       b.scheduled_end   + (v_buffer || ' minutes')::interval, '[)')
             && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
    ) then
      raise exception 'يحتاج المنتور فاصلاً بين الجلسات';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_booking_rules() from public, anon, authenticated;

-- The calendar (0047): a free slot inside the notice window is 'instant'
-- (bookable now at the surcharge) once it is far enough off to confirm a
-- payment; nearer than that it is 'unavailable'.
create or replace function public.mentor_available_slots(
  p_mentor uuid,
  p_from   date,
  p_to     date
)
returns table (slot_start timestamptz, slot_end timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select coalesce(mp.daily_session_limit, 5) as day_limit,
           coalesce(mp.buffer_minutes, 0)      as buffer_minutes
      from public.mentor_profiles mp where mp.profile_id = p_mentor
  ),
  days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  windows as (
    select dy.day, ma.start_time, ma.end_time
    from days dy
    join public.mentor_availability ma
      on ma.mentor_id = p_mentor
     and ma.day_of_week = extract(dow from dy.day)::smallint
    where not exists (
      select 1 from public.mentor_availability_exceptions ex
      where ex.mentor_id = p_mentor and ex.on_date = dy.day and not ex.is_open
    )
    union all
    select ex.on_date, ex.start_time, ex.end_time
    from public.mentor_availability_exceptions ex
    where ex.mentor_id = p_mentor
      and ex.is_open
      and ex.on_date between p_from and p_to
  ),
  slots as (
    select (w.day + w.start_time + (n || ' hours')::interval)::timestamptz       as slot_start,
           (w.day + w.start_time + ((n + 1) || ' hours')::interval)::timestamptz as slot_end
    from windows w
    cross join lateral generate_series(
      0,
      (extract(epoch from (w.end_time - w.start_time)) / 3600)::int - 1
    ) n
  ),
  load as (
    select b.scheduled_start::date as day, count(*)::int as taken
      from public.bookings b
     where b.mentor_id = p_mentor
       and (
         public.booking_holds_time(b.status)
         or (b.status in ('payment_pending', 'payment_submitted')
             and coalesce(b.reserved_until, b.scheduled_start) > now())
       )
       and b.scheduled_start::date between p_from and p_to
     group by 1
  )
  select sl.slot_start,
         sl.slot_end,
         case
           when exists (
             select 1 from public.mentor_time_off t
             where t.mentor_id = p_mentor
               and tstzrange(t.starts_at, t.ends_at, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'unavailable'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and public.booking_holds_time(b.status)
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'booked'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and b.status in ('payment_pending', 'payment_submitted')
               and coalesce(b.reserved_until, b.scheduled_start) > now()
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'pending'
           when (select buffer_minutes from settings) > 0 and exists (
             select 1 from public.bookings b, settings s
             where b.mentor_id = p_mentor
               and (
                 public.booking_holds_time(b.status)
                 or (b.status in ('payment_pending', 'payment_submitted')
                     and coalesce(b.reserved_until, b.scheduled_start) > now())
               )
               and tstzrange(b.scheduled_start - (s.buffer_minutes || ' minutes')::interval,
                             b.scheduled_end   + (s.buffer_minutes || ' minutes')::interval, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'unavailable'
           when coalesce((select taken from load where load.day = sl.slot_start::date), 0)
                >= (select day_limit from settings) then 'unavailable'
           when sl.slot_start
                < now() + (coalesce(public.setting_int('instant_booking_min_minutes'), 120) || ' minutes')::interval
             then 'unavailable'
           when sl.slot_start
                < now() + (coalesce(public.setting_int('booking_min_notice_hours'), 72) || ' hours')::interval
             then 'instant'
           else 'available'
         end as state
  from slots sl
  order by sl.slot_start;
$$;

-- ---------------------------------------------------------------------------
-- 3. Absence
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column learner_absences      smallint not null default 0,
  add column reschedule_by         timestamptz,
  add column absence_disputed_at   timestamptz;

comment on column public.bookings.reschedule_by is
  'After a first learner absence: the learner may pick a new time until then, once, without paying again (0125).';
comment on column public.bookings.absence_disputed_at is
  'The mentor said a session the learner reported them absent from was held; the admins decide (0125).';

-- The refund itself, for the platform's own rules (the mentor's absence left
-- undisputed). refund_booking() is the admin's door to it.
create or replace function public.refund_booking_now(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking;
  if not found then
    raise exception 'booking % not found', p_booking;
  end if;

  if not exists (
    select 1 from public.payments p where p.booking_id = p_booking and p.status = 'verified'
  ) then
    raise exception 'there is no verified payment on this booking to refund';
  end if;

  update public.bookings
     set status = 'refunded', cancelled_reason = coalesce(p_reason, cancelled_reason)
   where id = p_booking;

  update public.payments set status = 'refunded' where booking_id = p_booking and status = 'verified';

  if v_booking.student_id is not null then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (
      v_booking.student_id, 'refund', v_booking.price_usd, 'available',
      'استرداد قيمة الجلسة ' || v_booking.booking_code, 'bookings', v_booking.id
    );
  end if;

  update public.wallet_entries
     set status = 'cancelled'
   where ref_table = 'bookings' and ref_id = p_booking and kind = 'earning';
end;
$$;

revoke execute on function public.refund_booking_now(uuid, text) from public, anon, authenticated;

create or replace function public.refund_booking(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may refund a booking';
  end if;
  perform public.refund_booking_now(p_booking, p_reason);
end;
$$;

revoke execute on function public.refund_booking(uuid, text) from public, anon;
grant execute on function public.refund_booking(uuid, text) to authenticated;

create or replace function public.record_attendance(p_booking uuid, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_b       public.bookings%rowtype;
  v_admin   boolean := public.is_admin();
  v_mentor  boolean;
  v_learner boolean;
  v_hours   integer := coalesce(public.setting_int('mentor_absence_dispute_hours'), 24);
  v_days    integer := coalesce(public.setting_int('learner_reschedule_days'), 14);
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  v_mentor  := v_b.mentor_id = v_me;
  v_learner := v_b.student_id = v_me
               or (v_b.team_id is not null and public.is_team_leader(v_b.team_id));

  if not (v_mentor or v_learner or v_admin) then
    raise exception 'طرفا الجلسة فقط من يسجّلان الحضور';
  end if;
  if p_outcome not in ('held', 'learner_absent', 'mentor_absent') then
    raise exception 'حالة حضور غير معروفة';
  end if;
  if v_b.status <> 'confirmed' then
    raise exception 'الحضور يُسجَّل لجلسة مؤكّدة لم تُغلق بعد';
  end if;
  if now() < v_b.scheduled_start then
    raise exception 'يُسجَّل الحضور بعد بدء موعد الجلسة';
  end if;

  -- The mentor answers "you did not come" once, within the window: the admins decide.
  if v_mentor and not v_admin and v_b.attendance = 'mentor_absent' and p_outcome = 'held' then
    if v_b.absence_disputed_at is not null then
      raise exception 'اعترضت على تسجيل الغياب بالفعل — تراجعه الإدارة';
    end if;
    if v_b.attendance_at < now() - (v_hours || ' hours')::interval then
      raise exception 'انتهت مهلة الاعتراض على تسجيل الغياب';
    end if;
    update public.bookings set absence_disputed_at = now() where id = p_booking;
    if v_b.student_id is not null then
      perform public.notify(v_b.student_id, 'booking', 'اعترض المنتور على تسجيل غيابه',
        'يقول المنتور إن الجلسة ' || v_b.booking_code || ' انعقدت. تراجع الإدارة الحالة وتبلغك بالقرار.',
        '/bookings/' || p_booking::text);
    end if;
    perform public.notify_admins('خلاف على حضور جلسة',
      'الحجز ' || v_b.booking_code || ' — الطالب سجّل غياب المنتور والمنتور يقول إنها انعقدت. قرّر: استرداد أو انعقاد.',
      '/admin/pricing', 'booking', p_booking);
    return;
  end if;

  if v_b.attendance is not null and not v_admin then
    raise exception 'سُجّل الحضور لهذه الجلسة بالفعل — لأي خلاف افتح بلاغاً';
  end if;
  if not v_admin then
    if v_mentor and p_outcome = 'mentor_absent' then
      raise exception 'المنتور يسجّل: انعقدت، أو لم يحضر الطالب';
    end if;
    if v_learner and not v_mentor and p_outcome <> 'mentor_absent' then
      raise exception 'يسجّل الطالب غياب المنتور فقط؛ المنتور يسجّل انعقاد الجلسة';
    end if;
  end if;

  update public.bookings
     set attendance = p_outcome, attendance_by = v_me, attendance_at = now()
   where id = p_booking;

  if p_outcome = 'held' then
    update public.bookings set status = 'completed', reschedule_by = null where id = p_booking;

  elsif p_outcome = 'learner_absent' then
    if v_b.learner_absences = 0 and v_b.student_id is not null and v_b.team_id is null then
      -- The first absence: the session waits for a new time, once, unpaid.
      update public.bookings
         set learner_absences = 1,
             reschedule_by = now() + (v_days || ' days')::interval
       where id = p_booking;
      perform public.notify(v_b.student_id, 'booking', 'فاتتك الجلسة — لك فرصة واحدة',
        'سجّل المنتور أنك لم تحضر الجلسة ' || v_b.booking_code || '. اختر موعداً جديداً خلال ' || v_days
          || ' يوماً دون دفع جديد — فرصة واحدة، ولا يُسترد المبلغ. إن كان التسجيل خطأ افتح بلاغاً.',
        '/bookings/' || p_booking::text);
    else
      update public.bookings
         set status = 'completed', learner_absences = learner_absences + 1, reschedule_by = null
       where id = p_booking;
      if v_b.student_id is not null then
        perform public.notify(v_b.student_id, 'booking', 'سُجّل غيابك عن الجلسة',
          'سجّل المنتور أنك لم تحضر الجلسة ' || v_b.booking_code
            || ' — وقد استُخدمت فرصة إعادة الجدولة، فتُحتسب الجلسة. إن كان هذا خطأ افتح بلاغاً.',
          '/support/new?type=booking&id=' || p_booking::text || '&category=booking');
      end if;
    end if;

  elsif v_admin then
    -- An admin who records the mentor absent settles it: the learner is refunded.
    perform public.refund_booking(p_booking, 'غياب المنتور');
    if v_b.student_id is not null then
      perform public.notify(v_b.student_id, 'booking', 'أُعيد إليك مبلغ الجلسة',
        'لم يحضر المنتور الجلسة ' || v_b.booking_code || '، فأُعيد المبلغ كاملاً إلى محفظتك.', '/wallet');
    end if;
  else
    perform public.notify(v_b.mentor_id, 'booking', 'سُجّل غيابك عن جلسة',
      'سجّل الطالب أنك لم تحضر الجلسة ' || v_b.booking_code || '. إن كانت قد انعقدت سجّل ذلك خلال '
        || v_hours || ' ساعة، وإلا يُعاد المبلغ للطالب تلقائياً.', '/bookings/' || p_booking::text);
  end if;
end;
$$;

revoke execute on function public.record_attendance(uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, text) to authenticated;

-- The learner's one new time after a first absence.
create or replace function public.reschedule_after_absence(p_booking uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.student_id is distinct from (select auth.uid()) then
    raise exception 'الحجز غير موجود';
  end if;
  if v_b.status <> 'confirmed' or v_b.attendance is distinct from 'learner_absent' or v_b.reschedule_by is null then
    raise exception 'لا توجد فرصة إعادة جدولة لهذه الجلسة';
  end if;
  if v_b.reschedule_by < now() then
    raise exception 'انتهت مهلة إعادة الجدولة';
  end if;

  -- The rules and the no-overlap constraint check the new time like any move.
  update public.bookings
     set scheduled_start = p_starts_at,
         scheduled_end   = p_starts_at + (v_b.scheduled_end - v_b.scheduled_start),
         attendance = null, attendance_by = null, attendance_at = null, attendance_flagged_at = null,
         reschedule_by = null
   where id = p_booking;

  delete from public.booking_meeting_links where booking_id = p_booking;

  perform public.notify(v_b.mentor_id, 'booking', 'موعد جديد لجلسة',
    'اختار الطالب موعداً جديداً للجلسة ' || v_b.booking_code || ' بعد غيابه: '
      || to_char(p_starts_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD HH24:MI') || '. أضف رابط الاجتماع.',
    '/bookings/' || p_booking::text);
end;
$$;

revoke execute on function public.reschedule_after_absence(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_after_absence(uuid, timestamptz) to authenticated;

-- The hourly round (0104), with the two deadlines.
create or replace function public.attendance_housekeeping()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_hours integer := coalesce(public.setting_int('mentor_absence_dispute_hours'), 24);
  r       record;
begin
  -- Nobody recorded it: tell the mentor and the admins, once, two days on.
  for r in
    update public.bookings
       set attendance_flagged_at = now()
     where status = 'confirmed' and attendance is null and attendance_flagged_at is null
       and scheduled_end < now() - interval '48 hours'
    returning id, booking_code, mentor_id
  loop
    v_count := v_count + 1;
    perform public.notify(r.mentor_id, 'booking', 'سجّل حضور الجلسة',
      'لم يُسجَّل حضور الجلسة ' || r.booking_code || ' بعد — حصتك تنتظر التسجيل.', '/bookings/' || r.id::text);
    perform public.notify_admins('جلسة بلا تسجيل حضور',
      'الحجز ' || r.booking_code || ' انتهى قبل يومين ولم يُسجَّل حضوره.', '/admin/pricing', 'booking', r.id);
  end loop;

  -- The mentor was reported absent and did not answer: the learner is refunded.
  for r in
    select b.id, b.booking_code, b.student_id, b.mentor_id
      from public.bookings b
     where b.status = 'confirmed' and b.attendance = 'mentor_absent'
       and b.absence_disputed_at is null
       and b.attendance_at < now() - (v_hours || ' hours')::interval
       and exists (select 1 from public.payments p where p.booking_id = b.id and p.status = 'verified')
  loop
    v_count := v_count + 1;
    perform public.refund_booking_now(r.id, 'غياب المنتور');
    if r.student_id is not null then
      perform public.notify(r.student_id, 'booking', 'أُعيد إليك مبلغ الجلسة',
        'لم يحضر المنتور الجلسة ' || r.booking_code || '، فأُعيد المبلغ كاملاً إلى محفظتك.', '/wallet');
    end if;
    perform public.notify(r.mentor_id, 'booking', 'أُعيد مبلغ جلسة للطالب',
      'سُجّل غيابك عن الجلسة ' || r.booking_code || ' ولم يصل اعتراض خلال المهلة، فأُعيد المبلغ للطالب.',
      '/bookings/' || r.id::text);
  end loop;

  -- A first absence with no new time chosen in time: the session counts.
  for r in
    update public.bookings
       set status = 'completed', reschedule_by = null
     where status = 'confirmed' and attendance = 'learner_absent'
       and reschedule_by is not null and reschedule_by < now()
    returning id, booking_code, student_id
  loop
    v_count := v_count + 1;
    if r.student_id is not null then
      perform public.notify(r.student_id, 'booking', 'انتهت مهلة إعادة الجدولة',
        'لم يُختر موعد جديد للجلسة ' || r.booking_code || ' في المهلة، فاحتُسبت الجلسة.', '/bookings/' || r.id::text);
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.attendance_housekeeping() from public, anon, authenticated;

-- What the admin has to settle: a mentor absence the mentor disputes (or any
-- reported absence still inside its window, if they want to act early).
create or replace function public.admin_attendance_disputes()
returns table (booking_id uuid, booking_code text, student_name text, mentor_name text,
               scheduled_start timestamptz, price_usd numeric, reported_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.booking_code,
         (select coalesce(p.display_name, p.full_name) from public.profiles p where p.id = b.student_id),
         (select coalesce(p.display_name, p.full_name) from public.profiles p where p.id = b.mentor_id),
         b.scheduled_start, b.price_usd, b.attendance_at
    from public.bookings b
   where public.is_admin() and b.status = 'confirmed' and b.attendance = 'mentor_absent'
   order by b.absence_disputed_at nulls last, b.attendance_at;
$$;

revoke execute on function public.admin_attendance_disputes() from public, anon;
grant execute on function public.admin_attendance_disputes() to authenticated;
