'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ReviewCriterion } from '@/lib/database.types';

export type ReviewState = { error?: string; ok?: string } | undefined;

const CRITERIA: ReviewCriterion[] = [
  'requirements', 'technical_quality', 'ui_ux', 'problem_solving', 'documentation', 'completeness',
];

/** Picking an entry up, so the builder can see somebody is looking at it. */
export async function claimEntry(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('start_exhibition_review', { p_entry: String(formData.get('entry_id') ?? '') });
  revalidatePath('/review/exhibition');
}

/**
 * The judgement.
 *
 * The scores are sent as they were typed; the database is what refuses an
 * approval with a criterion missing, and what clamps a star to 1..5. This
 * action does not re-implement either rule — it reports the refusal.
 */
export async function reviewEntry(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const approve = String(formData.get('decision') ?? '') === 'approve';
  const scores: Partial<Record<ReviewCriterion, number>> = {};
  for (const criterion of CRITERIA) {
    const raw = String(formData.get(criterion) ?? '').trim();
    if (raw) scores[criterion] = Number(raw);
  }

  const note = String(formData.get('note') ?? '').trim();
  if (!approve && note.length < 10) {
    return { error: t('اكتب للطالب ما الذي يحتاج تعديلاً — الرفض بلا سبب لا يعلّم شيئاً.',
                      'Say what needs changing — a rejection with no reason teaches nothing.') };
  }

  const { error } = await supabase.rpc('review_exhibition_entry', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_approve: approve,
    p_note: note || null,
    p_scores: scores,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/review/exhibition');
  revalidatePath('/exhibition');
  return {
    ok: approve
      ? t('اعتُمد المشروع. عرضه في المعرض قرار أصحابه.', 'Approved. Whether it goes on the wall is the builders’ call.')
      : t('أُعيد المشروع لأصحابه مع ملاحظاتك.', 'Sent back to the builders with your notes.'),
  };
}
