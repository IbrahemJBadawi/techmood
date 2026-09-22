'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type BookingState = { error?: string } | undefined;

/**
 * Creates the booking request. The price is NOT sent from here — the database
 * function reads it from the mentor's level. The slot is held for the student
 * while they pay, and released automatically if they never do.
 */
export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const mentorId = String(formData.get('mentor_id') ?? '');
  const sessionTypeId = String(formData.get('session_type_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  const methodKey = String(formData.get('method_key') ?? '');
  const goal = String(formData.get('goal') ?? '').trim();

  if (!sessionTypeId) return { error: t('اختر نوع الجلسة.', 'Choose a session type.') };
  if (!startsAt) return { error: t('اختر موعداً متاحاً.', 'Choose an available time.') };
  if (!methodKey) return { error: t('اختر طريقة الدفع.', 'Choose a payment method.') };
  if (goal.length < 10) return { error: t('اكتب هدف الجلسة في جملة واضحة على الأقل.', 'Write what you want from the session, in at least one clear sentence.') };

  const reviewItems = formData
    .getAll('review_items')
    .map(String)
    .filter(Boolean)
    .map((raw) => {
      const [kind, id, ...label] = raw.split('|');
      return { kind, id: id || null, label: label.join('|') };
    });

  // Who the session is for decides which request this is. A team's session is
  // the leader's to book and is priced per seat — both of which the database
  // decides, not this form.
  const teamId = String(formData.get('team_id') ?? '');
  const members = formData.getAll('seat').map(String).filter(Boolean);

  if (teamId && members.length === 0) {
    return { error: t('اختر عضواً واحداً على الأقل من الفريق.', 'Choose at least one member of the team.') };
  }

  const { data, error } = teamId
    ? await supabase.rpc('create_team_booking_request', {
        p_team: teamId,
        p_mentor: mentorId,
        p_session_type: sessionTypeId,
        p_starts_at: startsAt,
        p_method_key: methodKey,
        p_members: members,
        p_goal: goal,
      })
    : await supabase.rpc('create_booking_request', {
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
      return { error: t('هذا الموعد لم يعد متاحاً — اختر موعداً آخر.', 'That slot is no longer free — pick another.') };
    }
    if (message.includes('72 hours') || message.includes('in advance')) {
      return { error: t('يجب أن يكون الحجز قبل 72 ساعة على الأقل من موعد الجلسة.', 'A booking must be at least 72 hours before the session.') };
    }
    if (message.includes('availability')) {
      return { error: t('الموعد المختار خارج أوقات توفر المنتور.', 'That time is outside the mentor’s available hours.') };
    }
    if (message.includes('قائد الفريق فقط') || message.includes('لأعضاء الفريق فقط')) {
      return { error: dbError(t, message) };
    }
    return { error: t('تعذّر إنشاء الطلب — حاول مرة أخرى.', 'The request could not be created — try again.') };
  }

  const booking = data as { id: string } | null;
  if (!booking?.id) return { error: t('تعذّر إنشاء الطلب.', 'The request could not be created.') };

  revalidatePath('/bookings');
  redirect(`/bookings/${booking.id}/pay`);
}
