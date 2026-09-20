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
