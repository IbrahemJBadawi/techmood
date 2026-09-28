'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type MentorFormState = { error?: string; ok?: string } | undefined;

/**
 * "Not now", and "again".
 *
 * set_mentor_accepting() (0077) is the one switch: a mentor turns their own
 * requests off — for now, or until a date — and back on whenever they like,
 * including after the platform switched them off for unanswered requests.
 */
export async function setAccepting(_prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const t = await getT();
  const supabase = await createClient();

  const accepting = formData.get('accepting') === 'on';
  const until = String(formData.get('until') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;

  const { error } = await supabase.rpc('set_mentor_accepting', {
    p_accepting: accepting,
    p_until: accepting ? null : until,
    p_note: accepting ? null : note,
  });

  revalidatePath('/mentor-requests');
  revalidatePath('/mentors');
  if (error) return { error: dbError(t, error.message) };
  return {
    ok: accepting
      ? t('عاد استقبال الطلبات. يمكن للطلاب حجزك الآن.', 'Requests are back on. Learners can book you now.')
      : t('أُوقف استقبال الطلبات. الطلبات الحالية تبقى بانتظار ردّك.', 'Requests are off. Requests already sent still wait for your answer.'),
  };
}

/**
 * A mentor's price for one kind of session, and whether they offer it.
 *
 * The band is checked by set_session_price(); an empty price goes back to the
 * level's default. Offering a session type is the mentor's own row (0016).
 */
export async function savePrice(_prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t('يجب تسجيل الدخول', 'Please sign in') };

  const sessionType = String(formData.get('session_type_id') ?? '');
  const raw = String(formData.get('price') ?? '').trim();
  const price = raw === '' ? null : Number(raw);
  if (price !== null && !Number.isFinite(price)) {
    return { error: t('اكتب السعر رقماً.', 'Write the price as a number.') };
  }

  const { error } = await supabase.rpc('set_session_price', { p_session_type: sessionType, p_price: price });
  if (error) return { error: dbError(t, error.message) };

  const { error: offerError } = await supabase
    .from('mentor_session_types')
    .update({ is_active: formData.get('offered') === 'on' })
    .eq('mentor_id', user.id)
    .eq('session_type_id', sessionType);
  if (offerError) return { error: dbError(t, offerError.message) };

  revalidatePath('/mentor-requests/pricing');
  revalidatePath(`/mentors/${user.id}`);
  return { ok: t('حُفظ.', 'Saved.') };
}

/** The upgrade questionnaire (0101). The database checks eligibility and every answer. */
export async function submitLevelUpgrade(_prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const t = await getT();
  const supabase = await createClient();
  const keys = String(formData.get('keys') ?? '').split(',').filter(Boolean);
  const answers = Object.fromEntries(keys.map((key) => [key, String(formData.get(`q-${key}`) ?? '').trim()]));
  const { error } = await supabase.rpc('submit_level_upgrade', { p_answers: answers });
  revalidatePath('/mentor-requests/level');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصل طلبك — تقرؤه الإدارة مع أرقامك ويصلك القرار في الإشعارات.', 'Your request is in — TechMood reads it with your numbers and the decision reaches your notifications.') };
}
