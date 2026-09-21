-- =============================================================================
-- TechMood — 0031 Bookings are written by functions, not by the client
--
-- A defect found while wiring "join the session" onto the student home page.
--
-- 0011 gave the two parties a blanket update policy on `bookings`:
--
--   create policy bookings_update_parties on public.bookings
--     for update to authenticated
--     using  (student_id = auth.uid() or mentor_id = auth.uid() or is_admin())
--     with check (same);
--
-- It was written for "the student cancels and the mentor decides", and 0016
-- then moved both of those into SECURITY DEFINER functions — but the policy
-- stayed, and it never restricted WHICH columns may change. So any student
-- could, with one PostgREST call against their own booking:
--
--   * set status = 'confirmed', skipping the mentor's decision entirely, which
--     the booking document forbids in as many words;
--   * set status = 'completed', which fires on_booking_completed() and so
--     credits the mentor's wallet and awards session XP for a session that
--     never happened;
--   * rewrite price_usd and mentor_share_usd, after create_booking_request()
--     had carefully taken the price out of the client's hands.
--
-- The fix is the rule the rest of this schema already follows: a booking's
-- state moves through a function that authorises the move, and the table takes
-- no writes from clients at all — not by policy, and not by privilege either,
-- so a future policy cannot reopen it by accident.
-- =============================================================================

drop policy if exists bookings_update_parties on public.bookings;

revoke insert, update, delete on public.bookings from authenticated;

-- ---------------------------------------------------------------------------
-- Calling off a booking
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  rec   record;
begin
  select * into rec from public.bookings where id = p_booking;
  if rec is null then
    raise exception 'الحجز غير موجود';
  end if;

  if not (
    rec.student_id = v_me
    or rec.mentor_id = v_me
    or (rec.team_id is not null and public.is_team_leader(rec.team_id))
    or public.is_admin()
  ) then
    raise exception 'هذا الحجز ليس لك';
  end if;

  if rec.status in ('completed', 'cancelled', 'refunded', 'expired') then
    raise exception 'لا يمكن إلغاء حجز في هذه الحالة';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_reason = coalesce(nullif(btrim(p_reason), ''),
                                     case when rec.student_id = v_me then 'ألغاه الطالب'
                                          when rec.mentor_id = v_me then 'ألغاها المنتور'
                                          else 'أُلغي' end)
   where id = p_booking;

  -- Tell the other side. A cancellation nobody hears about is a no-show.
  if rec.mentor_id is not null and rec.mentor_id <> v_me then
    perform public.notify(rec.mentor_id, 'booking', 'أُلغيت جلسة',
                          rec.booking_code, '/mentor-requests');
  end if;
  if rec.student_id is not null and rec.student_id <> v_me then
    perform public.notify(rec.student_id, 'booking', 'أُلغيت جلستك',
                          rec.booking_code, '/bookings/' || p_booking::text);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Where the session happens
-- ---------------------------------------------------------------------------
create or replace function public.set_meeting_url(p_booking uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  rec   record;
  v_url text := nullif(btrim(p_url), '');
begin
  select * into rec from public.bookings where id = p_booking;
  if rec is null then
    raise exception 'الحجز غير موجود';
  end if;

  if not (rec.mentor_id = v_me or public.is_admin()) then
    raise exception 'رابط الجلسة يضعه المنتور';
  end if;

  if rec.status <> 'confirmed' then
    raise exception 'لا يُضاف رابط إلا لجلسة مؤكدة';
  end if;

  if v_url is not null and v_url !~* '^https?://' then
    raise exception 'الرابط يجب أن يبدأ بـ http أو https';
  end if;

  update public.bookings set meeting_url = v_url where id = p_booking;

  if v_url is not null and rec.student_id is not null then
    perform public.notify(rec.student_id, 'booking', 'رابط جلستك جاهز',
                          rec.booking_code, '/bookings/' || p_booking::text);
  end if;
end;
$$;

grant execute on function public.cancel_booking(uuid, text)   to authenticated;
grant execute on function public.set_meeting_url(uuid, text)  to authenticated;
