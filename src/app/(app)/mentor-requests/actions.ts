'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionFormState } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

/**
 * The mentor's decision. Only the booked mentor may make it — checked in the database.
 * Accepting or declining a paid request: a refusal (too late, already decided) is said, not swallowed.
 */
export async function decideBooking(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accept = formData.get('decision') === 'accept';
  const { error } = await supabase.rpc('mentor_decide_booking', {
    p_booking_id: String(formData.get('booking_id') ?? ''),
    p_accept: accept,
    p_reason: String(formData.get('reason') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/mentor-requests');
  if (error) return { error: dbError(t, error.message) };
  return { ok: accept ? t('قُبلت الجلسة.', 'Session accepted.') : t('أُرسل الاعتذار.', 'Declined.') };
}

/*
 * There is no setMeetingUrl here any more.
 *
 * A confirmed booking opens a room inside TechMood (0044), and that room is
 * entered from the account it was booked for, at its own time. An external
 * link was the one thing in this flow that could be forwarded to somebody the
 * session was never booked for — so the mentor is no longer asked for one.
 * bookings.meeting_url and set_meeting_url() still exist in the database and
 * are now unused by any screen.
 */
