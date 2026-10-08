'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type JoinState = { error?: string; ok?: string } | undefined;

/** Ask to join the team behind a project (0156); its leader is told and answers. */
export async function requestToJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_to_join_team', {
    p_team: String(formData.get('team_id') ?? ''),
    p_message: String(formData.get('message') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };
  const back = String(formData.get('back') ?? '');
  if (back.startsWith('/')) revalidatePath(back);
  return { ok: t('✓ أُرسل طلبك — يصلك إشعار حين يردّ قائد الفريق.', '✓ Request sent — you will be notified when the team lead answers.') };
}

/** The leader's answer to a join request. */
export async function decideJoin(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('decide_team_application', {
    p_application_id: String(formData.get('application_id') ?? ''),
    p_accept: String(formData.get('decision')) === 'accept',
  });
  revalidatePath(`/teams/${String(formData.get('team_id') ?? '')}/members`);
}
