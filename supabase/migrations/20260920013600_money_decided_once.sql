-- =============================================================================
-- 0136 — Money is decided once
--
-- A review of the money paths against the usual failures of hastily built
-- platforms ("the payment notice arrived twice and was counted twice") found:
--
--   * verify_payment did not look at the payment's state on the market
--     (escrow) branch: approving the same payment again wrote the seller's
--     earning a second time, and could put a released or refunded escrow back
--     to «funded». Bookings were already safe — their state machine refuses
--     the second transition. A payment is now decided only while it waits
--     (pending, under review, or answering a question), once.
--   * release_escrow, refund_escrow, review_payout and refund_booking_now read
--     their row, checked its state, then wrote — with nothing stopping two
--     clicks at the same moment from both passing the check. Each now locks
--     the row it decides on; the second call waits, then sees the new state
--     and is refused.
--   * request_payout checked the balance and then wrote the withdrawal: two
--     requests sent together could each see the full balance. Requests from
--     one member now queue behind each other.
--
-- Each function is its latest definition with only these lines changed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_booking uuid;
  v_escrow  uuid;
  v_status  public.payment_status;
  v_row     public.escrows%rowtype;
  v_b       public.bookings%rowtype;
  v_hold    integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;

  -- Locked: a second click, or a second admin at the same moment, waits here
  -- and then finds the payment already decided (0136).
  select booking_id, escrow_id, status into v_booking, v_escrow, v_status
    from public.payments where id = p_payment_id
     for update;

  if v_booking is null and v_escrow is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  if v_status not in ('pending', 'under_review', 'needs_info') then
    raise exception 'هذه الدفعة رُوجعت بالفعل — لا تُقبل أو تُرفض مرتين';
  end if;

  -- ----- an escrow, as 0054 -----
  if v_escrow is not null then
    select * into v_row from public.escrows where id = v_escrow for update;

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
$function$;

CREATE OR REPLACE FUNCTION public.release_escrow(p_escrow uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me  uuid := (select auth.uid());
  v_row public.escrows%rowtype;
begin
  select * into v_row from public.escrows where id = p_escrow for update;
  if not found then
    raise exception 'الحجز المالي غير موجود';
  end if;

  if v_row.status not in ('funded', 'disputed') then
    raise exception 'لا يمكن الإفراج عن حجز في هذه الحالة';
  end if;

  if v_row.payer_id is distinct from v_me and not public.is_admin() then
    raise exception 'الدافع فقط من يفرج عن المبلغ';
  end if;

  if v_row.status = 'disputed' and not public.is_admin() then
    raise exception 'الحجز في نزاع — القرار للإدارة';
  end if;

  update public.escrows
     set status = 'released', released_at = now(), resolution_ar = coalesce(p_note, resolution_ar)
   where id = p_escrow;

  -- The earning was written at net_usd when the money arrived: it is already
  -- the payee's share after commission. Making it spendable is the whole of
  -- the release — there is nothing left to deduct.
  perform public.distribute_escrow_release(p_escrow);

  perform public.notify(
    v_row.payee_id, 'payment', 'أُفرج عن مستحقاتك',
    'المبلغ متاح الآن في محفظتك.', '/wallet', 'escrow', p_escrow);
end;
$function$;

CREATE OR REPLACE FUNCTION public.refund_escrow(p_escrow uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.escrows%rowtype;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;

  select * into v_row from public.escrows where id = p_escrow for update;
  if not found then
    raise exception 'الحجز المالي غير موجود';
  end if;

  if v_row.status not in ('funded', 'disputed') then
    raise exception 'لا يمكن استرداد حجز في هذه الحالة';
  end if;

  update public.escrows
     set status = 'refunded', released_at = now(), resolution_ar = p_reason
   where id = p_escrow;

  update public.wallet_entries
     set status = 'cancelled'
   where ref_table = 'escrows' and ref_id = p_escrow and kind = 'earning';

  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (v_row.payer_id, 'refund', v_row.amount_usd, 'available',
          'استرداد مبلغ محتجز', 'escrows', p_escrow);

  perform public.notify(v_row.payer_id, 'payment', 'أُعيد المبلغ إليك', p_reason, '/wallet');
  perform public.notify(v_row.payee_id, 'payment', 'أُعيد المبلغ للعميل', p_reason, '/wallet');
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_payout(p_request uuid, p_approve boolean, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.payout_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'only an admin may review a payout request';
  end if;

  select * into v_request from public.payout_requests where id = p_request for update;
  if not found then
    raise exception 'payout request % not found', p_request;
  end if;

  if v_request.status in ('paid', 'rejected') then
    raise exception 'this payout request was already settled';
  end if;

  if p_approve then
    update public.payout_requests
       set status = 'paid', reviewed_by = (select auth.uid()), reviewed_at = now(),
           paid_reference = p_reference, note_ar = p_note
     where id = p_request;

    update public.wallet_entries
       set status = 'paid', description_ar = 'سحب رصيد ' || v_request.request_code
     where id = v_request.ledger_entry_id;

    perform public.notify(
      v_request.profile_id, 'payment', 'تمّ تحويل مستحقاتك ' || v_request.request_code,
      case when p_reference is not null then 'مرجع التحويل: ' || p_reference end,
      '/wallet/timeline/payout/' || p_request::text, 'payout', p_request, 'important');
  else
    update public.payout_requests
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
           note_ar = p_note
     where id = p_request;

    update public.wallet_entries
       set status = 'cancelled', description_ar = 'طلب سحب مرفوض ' || v_request.request_code
     where id = v_request.ledger_entry_id;

    perform public.notify(
      v_request.profile_id, 'payment', 'لم يُنفَّذ طلب السحب ' || v_request.request_code,
      p_note, '/wallet?tab=withdrawals', 'payout', p_request, 'important');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refund_booking_now(p_booking uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking for update;
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
$function$;

CREATE OR REPLACE FUNCTION public.request_payout(p_account uuid, p_amount numeric)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me        uuid := (select auth.uid());
  v_available numeric;
  v_minimum   numeric;
  v_account   public.payout_accounts%rowtype;
  v_entry     uuid;
  v_request   public.payout_requests%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_account from public.payout_accounts where id = p_account;
  if v_account.profile_id is distinct from v_me then
    raise exception 'that payout account does not belong to you';
  end if;

  v_minimum := coalesce(public.setting_int('payout_minimum_usd'), 20);
  if p_amount < v_minimum then
    raise exception 'the minimum payout is %', v_minimum;
  end if;

  -- One withdrawal at a time per member: two requests sent together queue
  -- here, and the second sees the balance the first left (0136).
  perform 1 from public.profiles where id = v_me for update;

  select available_usd into v_available from public.wallet_balance where profile_id = v_me;

  if coalesce(v_available, 0) < p_amount then
    raise exception 'requested % but only % is available', p_amount, coalesce(v_available, 0);
  end if;

  -- Held, not spent: the row counts against the balance right away and only
  -- becomes final when an admin marks the transfer done.
  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar)
  values (v_me, 'payout', -p_amount, 'available', 'طلب سحب رصيد')
  returning id into v_entry;

  insert into public.payout_requests (profile_id, account_id, amount_usd, ledger_entry_id)
  values (v_me, p_account, p_amount, v_entry)
  returning * into v_request;

  update public.wallet_entries
     set description_ar = 'طلب سحب ' || v_request.request_code, ref_table = 'payout_requests', ref_id = v_request.id
   where id = v_entry;

  return v_request;
end;
$function$;
