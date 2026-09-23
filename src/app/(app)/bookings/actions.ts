'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type PaymentState = { error?: string; ok?: string } | undefined;

/**
 * Hands the payment to TechMood for verification. The receipt itself was
 * uploaded straight to private storage by the browser; only its key travels
 * through here, and the database re-checks that this method actually needed it.
 */
export async function submitPaymentProof(_prev: PaymentState, formData: FormData): Promise<PaymentState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookingId = String(formData.get('booking_id') ?? '');
  const proofPath = String(formData.get('proof_path') ?? '').trim() || null;
  const reference = String(formData.get('reference') ?? '').trim() || null;

  // A path a client sends must live in that client's own folder.
  if (proofPath && !proofPath.startsWith(`${user.id}/`)) {
    return { error: t('ملف الإيصال غير صالح.', 'That receipt file is not valid.') };
  }

  const { error } = await supabase.rpc('submit_payment_proof', {
    p_booking_id: bookingId,
    p_proof_path: proofPath,
    p_reference: reference,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('requires a receipt')) return { error: t('هذه الطريقة تتطلب رفع إيصال الدفع.', 'This method requires a payment receipt.') };
    if (message.includes('requires')) return { error: t('هذه الطريقة تتطلب إدخال الرقم المرجعي.', 'This method requires a reference number.') };
    if (message.includes('expired')) return { error: t('انتهت مهلة حجز الموعد — اختر موعداً من جديد.', 'The slot hold has expired — pick a new time.') };
    if (message.includes('not waiting')) return { error: t('هذا الحجز ليس في مرحلة الدفع.', 'This booking is not at the payment stage.') };
    return { error: t('تعذّر إرسال الدفع — حاول مرة أخرى.', 'The payment could not be sent — try again.') };
  }

  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}`);
}

/**
 * The student calls off a booking they no longer want.
 *
 * This used to write the status straight onto the row, which is exactly the
 * door 0031 closed: a client that may set `cancelled` may also set `completed`.
 * cancel_booking() checks who is asking and which states can still be called
 * off, and tells the other side.
 */
export async function cancelBooking(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookingId = String(formData.get('booking_id') ?? '');

  await supabase.rpc('cancel_booking', {
    p_booking: bookingId,
    p_reason: String(formData.get('reason') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/bookings');
  revalidatePath(`/bookings/${bookingId}`);
}

// ---------------------------------------------------------------------------
// The hub: a mentor's own week, and the rules their day runs by
// ---------------------------------------------------------------------------

export type HubState = { error?: string; ok?: string } | undefined;

/**
 * The mentor's week.
 *
 * One window per day, which is what the five-hour daily cap and the hourly
 * slots make of it anyway. An empty pair of times closes that day, and the
 * database keeps its own rule about how many hours a day may hold.
 */
export async function saveAvailability(_prev: HubState, formData: FormData): Promise<HubState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows: { mentor_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];

  for (let day = 0; day < 7; day += 1) {
    const from = String(formData.get(`from-${day}`) ?? '').trim();
    const to = String(formData.get(`to-${day}`) ?? '').trim();
    if (!from || !to) continue;
    if (to <= from) {
      return { error: t('وقت النهاية يجب أن يكون بعد البداية.', 'The end time has to come after the start.') };
    }
    rows.push({ mentor_id: user.id, day_of_week: day, start_time: from, end_time: to });
  }

  await supabase.from('mentor_availability').delete().eq('mentor_id', user.id);

  if (rows.length > 0) {
    const { error } = await supabase.from('mentor_availability').insert(rows);
    if (error) return { error: dbError(t, error.message) };
  }

  revalidatePath('/bookings');
  return { ok: t('حُفظت أوقاتك الأسبوعية.', 'Your weekly hours are saved.') };
}

/** How many sessions a day, and how much room between two of them. */
export async function saveSchedulingRules(_prev: HubState, formData: FormData): Promise<HubState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('mentor_profiles')
    .update({
      daily_session_limit: Math.min(10, Math.max(1, Number(formData.get('limit') ?? 5))),
      buffer_minutes: Math.min(60, Math.max(0, Number(formData.get('buffer') ?? 0))),
    })
    .eq('profile_id', user.id);

  revalidatePath('/bookings');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظت إعدادات جدولك.', 'Your scheduling rules are saved.') };
}

/**
 * Time that is yours.
 *
 * Blocked time is not a cancelled booking and never touches one: it closes
 * hours that nobody has taken yet, and the calendar stops offering them.
 */
export async function blockTime(_prev: HubState, formData: FormData): Promise<HubState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const date = String(formData.get('date') ?? '');
  const from = String(formData.get('from') ?? '');
  const to = String(formData.get('to') ?? '');
  if (!date || !from || !to) return { error: t('اختر اليوم والساعات.', 'Pick the day and the hours.') };

  const starts = new Date(`${date}T${from}`);
  const ends = new Date(`${date}T${to}`);
  if (Number.isNaN(starts.getTime()) || ends <= starts) {
    return { error: t('وقت النهاية يجب أن يكون بعد البداية.', 'The end time has to come after the start.') };
  }

  const { error } = await supabase.from('mentor_time_off').insert({
    mentor_id: user.id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: String(formData.get('reason') ?? '').trim() || null,
  });

  revalidatePath('/bookings');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُغلقت هذه الساعات.', 'Those hours are closed.') };
}

export async function unblockTime(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.from('mentor_time_off')
    .delete()
    .eq('id', String(formData.get('block_id') ?? ''))
    .eq('mentor_id', user.id);

  revalidatePath('/bookings');
}

/** Answering the admin's question about a payment. The receipt stays as it was. */
export async function answerPaymentQuestion(_prev: PaymentState, formData: FormData): Promise<PaymentState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookingId = String(formData.get('booking_id') ?? '');
  const { error } = await supabase.rpc('answer_payment_info', {
    p_payment: String(formData.get('payment_id') ?? ''),
    p_note: String(formData.get('note') ?? '').trim(),
    p_reference: String(formData.get('reference') ?? '').trim() || null,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}`);
}
