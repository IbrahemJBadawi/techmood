'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ShareScope } from '@/lib/database.types';

export type ShareState = { error?: string; ok?: string } | undefined;

/**
 * A link that opens exactly one thing, to whoever holds it, until a date.
 *
 * The token is the whole authorisation, so the share names what it opens —
 * nobody widens it by guessing a URL, and the company can kill it in one click.
 */
export async function createShare(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const scope = String(formData.get('scope') ?? 'showcase') as ShareScope;
  const canvasId = String(formData.get('canvas_id') ?? '') || null;

  if (scope === 'canvas' && !canvasId) {
    return { error: t('اختر اللوحة التي تريد مشاركتها.', 'Choose which canvas you are sharing.') };
  }

  const { error } = await supabase.from('startup_shares').insert({
    startup_id: startupId,
    scope,
    canvas_id: scope === 'canvas' ? canvasId : null,
    label_ar: String(formData.get('label') ?? '').trim() || null,
    expires_on: String(formData.get('expires_on') ?? '') || null,
    created_by: user.id,
  });

  revalidatePath(`/startups/${startupId}/share`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُنشئ الرابط.', 'The link is ready.') };
}

export async function revokeShare(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  await supabase.rpc('revoke_share', { p_share: String(formData.get('share_id') ?? '') });

  revalidatePath(`/startups/${startupId}/share`);
}
