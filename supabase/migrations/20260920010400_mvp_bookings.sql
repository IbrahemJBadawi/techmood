-- =============================================================================
-- 0104 — The MVP's booking: confirmed by payment, joined by link, closed by
--        attendance
--
-- The founder's booking flow for the MVP (in force while `in_mvp()`; the full
-- platform keeps the flow it had):
--
--   Pending payment → (learner presses "I paid") Payment under review — the
--   slot is locked from here, by the database's exclusion constraint (0016)
--   → the admin approves → Confirmed, straight away (no second approval by
--   the mentor) → the mentor adds a meeting link (Zoom, Google Meet, …) →
--   the Join button opens in the session window → after it, attendance is
--   recorded → Completed.
--
--   Rejected by the admin → the booking is rejected and the slot released
--   (it used to go back to "pending payment" with a fresh hold).
--
--   The mentor may still decline a confirmed session before it starts: it is
--   cancelled with their reason, the learner is told, and the payment joins
--   the refunds TechMood owes (0077).
--
-- **The meeting link belongs to the booking and to nobody else.** It lives in
-- its own table no client can read; `booking_meeting()` gives it to the mentor
-- and the admins at any time, and to the learner only inside the session
-- window (a few minutes before the start until the end). It is never on a
-- profile, a gallery entry or a public page.
--
-- **Attendance is recorded, not guessed** (the founder's choice over closing
-- sessions automatically). From the start of the session:
--   * the mentor records "held" or "the learner did not come" → Completed
--     (a learner who did not come still used the mentor's hour);
--   * the learner records "the mentor did not come" → the booking waits for an
--     admin, who refunds it or records it held;
--   * whoever records first decides, and a session nobody records within two
--     days of its end is flagged to the mentor and the admins, once.
--
-- Also fixed here: a booking cancelled after payment was listed as a refund
-- owed (0077) but could not be refunded — cancelled → refunded was not an
-- allowed transition.
-- =============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('meeting_opens_minutes_before', '10', 'كم دقيقة قبل الجلسة يظهر زر الدخول لرابط الاجتماع')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 1. The state machine: a cancelled, paid booking can be refunded
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed public.booking_status[];
begin
  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'draft'             then array['payment_pending', 'cancelled']
    when 'payment_pending'   then array['payment_submitted', 'cancelled', 'expired']
    when 'payment_submitted' then array['payment_verified', 'payment_pending', 'rejected', 'cancelled']
    when 'payment_verified'  then array['mentor_pending', 'cancelled', 'refunded']
    when 'mentor_pending'    then array['confirmed', 'rejected', 'cancelled']
    when 'confirmed'         then array['completed', 'cancelled', 'refunded']
    when 'completed'         then array['refunded']
    when 'cancelled'         then array['refunded']
    when 'rejected'          then array['refunded']
    when 'refunded'          then array[]::text[]
    when 'expired'           then array[]::text[]
  end::public.booking_status[];

  if not (new.status = any (v_allowed)) then
    raise exception 'illegal booking transition % -> %', old.status, new.status;
  end if;

  if new.status = 'confirmed' then
    if not exists (
      select 1 from public.payments p
      where p.booking_id = new.id and p.status = 'verified'
    ) then
      raise exception 'a booking cannot be confirmed before its payment is verified';
    end if;
    new.confirmed_at := now();
    new.reserved_until := null;
  end if;

  if new.status = 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Verifying a payment: confirmed at once in the MVP; rejected releases
-- ---------------------------------------------------------------------------
create or replace function public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
  v_escrow  uuid;
  v_row     public.escrows%rowtype;
  v_b       public.bookings%rowtype;
  v_hold    integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;

  select booking_id, escrow_id into v_booking, v_escrow
    from public.payments where id = p_payment_id;

  if v_booking is null and v_escrow is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- ----- an escrow, as 0054 -----
  if v_escrow is not null then
    select * into v_row from public.escrows where id = v_escrow;

    if p_approve then
      update public.payments
         set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
             rejection_reason = null
       where id = p_payment_id;

      update public.escrows set status = 'funded', funded_at = now() where id = v_escrow;

      insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
      values (v_row.payee_id, 'earning', v_row.net_usd, 'pending',
              'مبلغ محتجز لعمل عبر السوق', 'escrows', v_escrow);

      perform public.notify(
        v_row.payee_id, 'payment', 'وصل المبلغ وحُجز',
        'ابدأ العمل — يُفرج عن المبلغ عند قبول التسليم.',
        '/projects/' || coalesce(v_row.project_id::text, ''));
    else
      update public.payments
         set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
             rejection_reason = p_reason
       where id = p_payment_id;

      perform public.notify(
        v_row.payer_id, 'payment', 'لم يُقبل إثبات الدفع', p_reason,
        '/projects/' || coalesce(v_row.project_id::text, ''));
    end if;

    return;
  end if;

  -- ----- a booking -----
  if p_approve then
    update public.payments
       set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = null
     where id = p_payment_id;

    update public.bookings set status = 'payment_verified' where id = v_booking;
    update public.bookings set status = 'mentor_pending' where id = v_booking;

    if public.in_mvp() then
      -- The MVP: the admin's approval is the confirmation.
      update public.bookings set status = 'confirmed', mentor_decided_at = now() where id = v_booking;
      select * into v_b from public.bookings where id = v_booking;

      perform public.notify(v_b.mentor_id, 'booking', 'حجز جديد مؤكّد',
        'جلسة ' || v_b.booking_code || ' — أضف رابط الاجتماع (Zoom أو Google Meet) من صفحة الحجز.',
        '/bookings/' || v_booking::text);
      if v_b.student_id is not null then
        perform public.notify(v_b.student_id, 'booking', 'تأكّد حجزك',
          'تأكّد الدفع وأصبحت الجلسة ' || v_b.booking_code || ' مؤكّدة. يظهر رابط الاجتماع في صفحة الحجز وقت الجلسة.',
          '/bookings/' || v_booking::text);
      end if;
    end if;
  else
    update public.payments
       set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = p_reason
     where id = p_payment_id;

    if public.in_mvp() then
      -- The MVP: a rejected payment releases the slot.
      update public.bookings
         set status = 'rejected',
             cancelled_reason = 'لم يُقبل إثبات الدفع' || coalesce(': ' || nullif(btrim(p_reason), ''), '')
       where id = v_booking;
      select * into v_b from public.bookings where id = v_booking;
      if v_b.student_id is not null then
        perform public.notify(v_b.student_id, 'payment', 'لم يُقبل إثبات الدفع',
          coalesce(nullif(btrim(p_reason), ''), 'راجع الدفعة وأعد الحجز.') || ' — تحرّر الموعد، ويمكنك الحجز من جديد.',
          '/bookings/' || v_booking::text);
      end if;
    else
      update public.bookings
         set status = 'payment_pending',
             reserved_until = greatest(coalesce(reserved_until, now()), now() + (v_hold || ' minutes')::interval)
       where id = v_booking;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The mentor declines a confirmed session
-- ---------------------------------------------------------------------------
create or replace function public.mentor_decline_booking(p_booking uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.mentor_id is distinct from (select auth.uid()) then
    raise exception 'هذا الحجز ليس لك';
  end if;
  if v_b.status not in ('confirmed', 'mentor_pending') then
    raise exception 'لا يمكن الاعتذار عن حجز في هذه الحالة';
  end if;
  if v_b.scheduled_start <= now() then
    raise exception 'بدأ موعد الجلسة — سجّل الحضور بدل الاعتذار';
  end if;
  if char_length(coalesce(btrim(p_reason), '')) < 10 then
    raise exception 'اكتب سبب الاعتذار — يصل للطالب';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_reason = 'اعتذر المنتور: ' || btrim(p_reason),
         mentor_decided_at = now()
   where id = p_booking;

  if v_b.student_id is not null then
    perform public.notify(v_b.student_id, 'booking', 'اعتذر المنتور عن الجلسة',
      btrim(p_reason) || ' — سيُعاد المبلغ إليك.', '/bookings/' || p_booking::text);
  end if;
  perform public.notify_admins('استرداد مستحق: اعتذار منتور',
    'الحجز ' || v_b.booking_code || ' ألغاه المنتور بعد الدفع.', '/admin/pricing', 'booking', p_booking);
end;
$$;

revoke execute on function public.mentor_decline_booking(uuid, text) from public, anon;
grant execute on function public.mentor_decline_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The meeting link — the booking's, and nobody else's
-- ---------------------------------------------------------------------------
create table public.booking_meeting_links (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  url        text not null check (url ~* '^https://[^\s]+$'),
  set_by     uuid references public.profiles (id) on delete set null,
  set_at     timestamptz not null default now()
);

alter table public.booking_meeting_links enable row level security;
-- no policies: read through booking_meeting(), written through set_meeting_link()

create or replace function public.set_meeting_link(p_booking uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b   public.bookings%rowtype;
  v_url text := nullif(btrim(p_url), '');
begin
  select * into v_b from public.bookings where id = p_booking;
  if not found or not (v_b.mentor_id = (select auth.uid()) or public.is_admin()) then
    raise exception 'رابط الاجتماع يضعه منتور الجلسة';
  end if;
  if v_b.status <> 'confirmed' then
    raise exception 'يُضاف الرابط لجلسة مؤكّدة فقط';
  end if;
  if v_url is null or v_url !~* '^https://[^\s]+$' then
    raise exception 'رابط الاجتماع يجب أن يبدأ بـ https:// (Zoom أو Google Meet أو غيرهما)';
  end if;

  insert into public.booking_meeting_links (booking_id, url, set_by)
  values (p_booking, v_url, (select auth.uid()))
  on conflict (booking_id) do update set url = excluded.url, set_by = excluded.set_by, set_at = now();

  if v_b.student_id is not null then
    perform public.notify(v_b.student_id, 'booking', 'رابط جلستك جاهز',
      'يظهر زر الدخول في صفحة الحجز قبل الجلسة بدقائق.', '/bookings/' || p_booking::text);
  end if;
end;
$$;

revoke execute on function public.set_meeting_link(uuid, text) from public, anon;
grant execute on function public.set_meeting_link(uuid, text) to authenticated;

-- 0031's set_meeting_url wrote the link onto the booking row, where every
-- party could read it at any time. It now goes through the new rule.
create or replace function public.set_meeting_url(p_booking uuid, p_url text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.set_meeting_link(p_booking, p_url);
$$;

create or replace function public.booking_meeting(p_booking uuid)
returns table (has_link boolean, url text, opens_at timestamptz, closes_at timestamptz, can_join boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_b      public.bookings%rowtype;
  v_url    text;
  v_opens  timestamptz;
  v_host   boolean;
  v_party  boolean;
begin
  select * into v_b from public.bookings where id = p_booking;
  if not found then
    return;
  end if;

  v_host  := v_b.mentor_id = v_me or public.is_admin();
  v_party := v_host or v_b.student_id = v_me
             or (v_b.team_id is not null and exists (
                   select 1 from public.booking_seats s where s.booking_id = v_b.id and s.profile_id = v_me));
  if not v_party then
    return;
  end if;

  select l.url into v_url from public.booking_meeting_links l where l.booking_id = p_booking;
  v_opens := v_b.scheduled_start
             - (coalesce(public.setting_int('meeting_opens_minutes_before'), 10) || ' minutes')::interval;

  return query select
    v_url is not null,
    case when v_host or (v_b.status = 'confirmed' and now() between v_opens and v_b.scheduled_end)
         then v_url end,
    v_opens,
    v_b.scheduled_end,
    v_b.status = 'confirmed' and v_url is not null and now() between v_opens and v_b.scheduled_end;
end;
$$;

revoke execute on function public.booking_meeting(uuid) from public, anon;
grant execute on function public.booking_meeting(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Attendance
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column attendance       text check (attendance in ('held', 'learner_absent', 'mentor_absent')),
  add column attendance_by    uuid references public.profiles (id) on delete set null,
  add column attendance_at    timestamptz,
  add column attendance_flagged_at timestamptz;

create or replace function public.record_attendance(p_booking uuid, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_b      public.bookings%rowtype;
  v_admin  boolean := public.is_admin();
  v_mentor boolean;
  v_learner boolean;
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

  if p_outcome in ('held', 'learner_absent') then
    update public.bookings set status = 'completed' where id = p_booking;
    if p_outcome = 'learner_absent' and v_b.student_id is not null then
      perform public.notify(v_b.student_id, 'booking', 'سُجّل غيابك عن الجلسة',
        'سجّل المنتور أنك لم تحضر الجلسة ' || v_b.booking_code || '. إن كان هذا خطأ افتح بلاغاً.',
        '/support/new?type=booking&id=' || p_booking::text || '&category=booking');
    end if;
  elsif v_admin then
    -- An admin who records the mentor absent settles it: the learner is refunded.
    perform public.refund_booking(p_booking, 'غياب المنتور');
  else
    perform public.notify(v_b.mentor_id, 'booking', 'سُجّل غيابك عن جلسة',
      'سجّل الطالب أنك لم تحضر الجلسة ' || v_b.booking_code || '. تراجع الإدارة الحالة.', '/bookings/' || p_booking::text);
    perform public.notify_admins('غياب منتور مبلَّغ عنه',
      'الحجز ' || v_b.booking_code || ' — قرّر: استرداد أو انعقاد.', '/admin/pricing', 'booking', p_booking);
  end if;
end;
$$;

revoke execute on function public.record_attendance(uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, text) to authenticated;

-- What the admin has to settle: a mentor reported absent.
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
   order by b.attendance_at;
$$;

revoke execute on function public.admin_attendance_disputes() from public, anon;
grant execute on function public.admin_attendance_disputes() to authenticated;

-- Nobody recorded it: tell the mentor and the admins, once, two days on.
create or replace function public.attendance_housekeeping()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r       record;
begin
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
  return v_count;
end;
$$;

revoke execute on function public.attendance_housekeeping() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-attendance', '23 * * * *', $$select public.attendance_housekeeping()$$);
  end if;
end
$migration$;
