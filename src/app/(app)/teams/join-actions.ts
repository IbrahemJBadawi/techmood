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

/** Apply for one open seat (0170): the join request names the role. */
export async function applyToOpening(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_to_team_opening', {
    p_opening: String(formData.get('opening_id') ?? ''),
    p_message: String(formData.get('message') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/teams');
  return { ok: t('✓ أُرسل طلبك — يصلك إشعار حين يردّ قائد الفريق.', '✓ Request sent — you will be notified when the team lead answers.') };
}

/** Open or close a seat, or add one — the leader's (row-level security checks it). */
export async function saveOpening(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const t = await getT();
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const { error } = id
    ? await supabase.from('team_openings').update({ is_open: formData.get('is_open') === 'true' }).eq('id', id).eq('team_id', teamId)
    : await supabase.from('team_openings').insert({
        team_id: teamId,
        role_ar: String(formData.get('role') ?? '').trim(),
        seats: Math.min(10, Math.max(1, Number(formData.get('seats') ?? 1) || 1)),
        skills: String(formData.get('skills') ?? '').split(/[,،]/).map((skill) => skill.trim()).filter(Boolean).slice(0, 8),
      });
  if (error) return { error: error.message.includes('check') ? t('اكتب اسم الدور (حرفان على الأقل).', 'Name the role (two letters at least).') : dbError(t, error.message) };
  revalidatePath(`/teams/${teamId}/members`);
  revalidatePath('/teams');
  return { ok: id ? t('حُدّث.', 'Updated.') : t('أُضيف الدور المطلوب.', 'Role added.') };
}
