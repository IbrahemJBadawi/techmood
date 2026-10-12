'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { ACTIVE_ROLE_COOKIE } from '@/lib/roles';

export async function submitSurvey(input: {
  ease: number; recommend: number; mostUsed: string; pains: string[]; suggestion: string;
}) {
  const t = await getT();
  const supabase = await createClient();
  const role = (await cookies()).get(ACTIVE_ROLE_COOKIE)?.value ?? null;
  const { error } = await supabase.rpc('submit_ux_survey', {
    p_ease: input.ease, p_recommend: input.recommend, p_most_used: input.mostUsed || null,
    p_pains: input.pains, p_suggestion: input.suggestion.trim() || null, p_role: role,
  });
  if (error) return { ok: false, error: dbError(t, error.message) };
  revalidatePath('/home');
  revalidatePath('/academy');
  return { ok: true };
}

/** «Later»: the invitation rests for a week. */
export async function snoozeSurvey() {
  (await cookies()).set('tm-survey-later', '1', { maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' });
  revalidatePath('/home');
  revalidatePath('/academy');
}
