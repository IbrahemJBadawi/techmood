'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { SessionCriterion } from '@/lib/database.types';

export type RateState = { error?: string; ok?: string } | undefined;

/**
 * Rating the session. Which criteria arrive depends on which side is writing,
 * and the database decides everything else: that the session happened, that
 * this person was in it, that they have not already written, and when the two
 * ratings are unsealed.
 */
export async function rateSession(_prev: RateState, formData: FormData): Promise<RateState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const criteria = String(formData.get('criteria') ?? '').split(',').filter(Boolean) as SessionCriterion[];
  const scores: Partial<Record<SessionCriterion, number>> = {};
  for (const criterion of criteria) {
    const raw = String(formData.get(criterion) ?? '').trim();
    if (raw) scores[criterion] = Number(raw);
  }

  if (Object.keys(scores).length === 0) {
    return { error: t('اختر درجة واحدة على الأقل.', 'Give at least one score.') };
  }

  const { error } = await supabase.rpc('rate_session', {
    p_booking: String(formData.get('booking_id') ?? ''),
    p_scores: scores,
    p_comment: String(formData.get('comment') ?? '').trim() || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/sessions'));
  if (error) return { error: dbError(t, error.message) };

  return {
    ok: t('وصل تقييمك. يُفتح للطرف الآخر حين يكتب تقييمه.',
          'Your rating is in. It opens to the other side once they have written theirs.'),
  };
}

export type JoinState = { error?: string } | undefined;

/**
 * Entering the room.
 *
 * The browser does not decide this: the database checks that the person is a
 * named participant and that the door is open against its own clock, and the
 * join is written to the presence log — which is what attendance is counted
 * from afterwards.
 */
export async function joinSession(sessionId: string): Promise<JoinState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('join_video_session', { p_session: sessionId });
  revalidatePath(`/sessions/${sessionId}`);
  if (error) return { error: dbError(t, error.message) };
  return undefined;
}

/**
 * Leaving is not cancelling and not ending: it writes one more line in the
 * log, the session keeps running until its time is up, and the same person may
 * come back before then.
 */
export async function leaveSession(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc('leave_video_session', { p_session: sessionId });
  revalidatePath(`/sessions/${sessionId}`);
}
