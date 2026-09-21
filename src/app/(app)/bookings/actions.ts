'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
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
