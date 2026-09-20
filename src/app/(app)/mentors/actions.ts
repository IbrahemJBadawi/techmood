'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type BookingState = { error?: string } | undefined;

/**
 * Creates the booking request. The price is NOT sent from here — the database
 * function reads it from the mentor's level. The slot is held for the student
 * while they pay, and released automatically if they never do.
 */
export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const mentorId = String(formData.get('mentor_id') ?? '');
  const sessionTypeId = String(formData.get('session_type_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  const methodKey = String(formData.get('method_key') ?? '');
  const goal = String(formData.get('goal') ?? '').trim();

  if (!sessionTypeId) return { error: 'اختر نوع الجلسة.' };
  if (!startsAt) return { error: 'اختر موعداً متاحاً.' };
  if (!methodKey) return { error: 'اختر طريقة الدفع.' };
  if (goal.length < 10) return { error: 'اكتب هدف الجلسة في جملة واضحة على الأقل.' };

  const reviewItems = formData
    .getAll('review_items')
    .map(String)
    .filter(Boolean)
    .map((raw) => {
      const [kind, id, ...label] = raw.split('|');
      return { kind, id: id || null, label: label.join('|') };
    });

  const { data, error } = await supabase.rpc('create_booking_request', {
    p_mentor: mentorId,
    p_session_type: sessionTypeId,
    p_starts_at: startsAt,
    p_method_key: methodKey,
    p_goal: goal,
    p_review_items: reviewItems,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('conflicting key value') || message.includes('bookings_no_overlap')) {
      return { error: 'هذا الموعد لم يعد متاحاً — اختر موعداً آخر.' };
    }
    if (message.includes('72 hours') || message.includes('in advance')) {
      return { error: 'يجب أن يكون الحجز قبل 72 ساعة على الأقل من موعد الجلسة.' };
    }
    if (message.includes('availability')) {
      return { error: 'الموعد المختار خارج أوقات توفر المنتور.' };
    }
    return { error: 'تعذّر إنشاء الطلب — حاول مرة أخرى.' };
  }

  const booking = data as { id: string } | null;
  if (!booking?.id) return { error: 'تعذّر إنشاء الطلب.' };

  revalidatePath('/bookings');
  redirect(`/bookings/${booking.id}/pay`);
}
