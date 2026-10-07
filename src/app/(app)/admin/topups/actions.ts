'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type ReviewState = { error?: string; ok?: string } | undefined;

/** Approve a top-up (the balance grows) or turn it down with a reason the member sees (0151). */
export async function reviewTopup(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const approve = formData.get('decision') === 'approve';
  const { error } = await supabase.rpc('review_topup', {
    p_topup: String(formData.get('topup_id') ?? ''), p_approve: approve,
    p_reason: String(formData.get('reason') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/admin/topups');
  return { ok: approve ? t('✓ تمّت الموافقة', '✓ Approved') : t('رُفض، ووصل السبب للعضو', 'Turned down; the member was told why') };
}
