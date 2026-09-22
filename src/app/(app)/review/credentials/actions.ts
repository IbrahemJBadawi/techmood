'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type ReviewState = { error?: string; ok?: string } | undefined;

export async function reviewCredential(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();

  const accept = formData.get('decision') === 'verify';
  const { error } = await supabase.rpc('review_credential', {
    p_submission: String(formData.get('submission_id') ?? ''),
    p_accept: accept,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  revalidatePath('/review/credentials');
  if (error) return { error: dbError(t, error.message) };
  return { ok: accept ? t('وُثّقت.', 'Verified.') : t('رُفضت، ووصل السبب لصاحبها.', 'Refused, and the reason has been sent.') };
}
