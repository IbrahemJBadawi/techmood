'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import type { MentorshipGoalStatus } from '@/lib/database.types';

export type GoalState = { error?: string; ok?: string } | undefined;

/** A goal is the thread between sessions. Without one they are just receipts. */
export async function addMentorshipGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 2) {
    return { error: t('اكتب الهدف في جملة.', 'Write the goal in a sentence.') };
  }

  const { error } = await supabase.from('mentorship_goals').insert({
    profile_id: user.id,
    title_ar: title,
    detail_ar: String(formData.get('detail') ?? '').trim() || null,
    mentor_id: String(formData.get('mentor_id') ?? '') || null,
    target_on: String(formData.get('target_on') ?? '') || null,
  });

  revalidatePath('/mentorship');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيف الهدف.', 'Goal added.') };
}

export async function closeMentorshipGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const t = await getT();
  const supabase = await createClient();

  const { error } = await supabase.rpc('close_mentorship_goal', {
    p_goal: String(formData.get('goal_id') ?? ''),
    p_status: String(formData.get('status') ?? 'achieved') as MentorshipGoalStatus,
    p_outcome: String(formData.get('outcome') ?? '').trim() || null,
  });

  revalidatePath('/mentorship');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُغلق الهدف.', 'Goal closed.') };
}

/** Saying which goal a booked session was for. */
export async function linkSessionToGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const t = await getT();
  const supabase = await createClient();

  const { error } = await supabase.rpc('link_session_to_goal', {
    p_booking: String(formData.get('booking_id') ?? ''),
    p_goal: String(formData.get('goal_id') ?? '') || null,
  });

  revalidatePath('/mentorship');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('رُبطت الجلسة بالهدف.', 'The session is linked to the goal.') };
}
