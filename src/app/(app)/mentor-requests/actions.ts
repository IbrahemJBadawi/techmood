'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** The mentor's decision. Only the booked mentor may make it — checked in the database. */
export async function decideBooking(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('mentor_decide_booking', {
    p_booking_id: String(formData.get('booking_id') ?? ''),
    p_accept: formData.get('decision') === 'accept',
    p_reason: String(formData.get('reason') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/mentor-requests');
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
