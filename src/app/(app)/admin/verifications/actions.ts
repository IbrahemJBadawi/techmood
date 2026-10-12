'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type ReviewState = { error?: string; ok?: string } | undefined;

/**
 * Approve or refuse an identity check (0161). The database hands back the
 * document's path, and the document is deleted here — only the outcome stays.
 */
export async function reviewVerification(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const approve = formData.get('decision') === 'approve';
  const { data: path, error } = await supabase.rpc('review_identity_verification', {
    p_id: String(formData.get('id') ?? ''), p_approve: approve,
    p_reason: String(formData.get('reason') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };
  if (path) await supabase.storage.from('identity-docs').remove([path]);
  revalidatePath('/admin/verifications');
  return { ok: approve ? t('✓ وُثّق الحساب وحُذفت الوثيقة', '✓ Verified; the document was deleted') : t('رُفض، ووصل السبب للعضو، وحُذفت الوثيقة', 'Refused; the member was told why; the document was deleted') };
}

export async function revokeVerification(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_verification', {
    p_profile: String(formData.get('profile_id') ?? ''), p_reason: String(formData.get('reason') ?? '').trim(),
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/admin/verifications');
  return { ok: t('أُزيلت العلامة', 'Badge removed') };
}
