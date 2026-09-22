'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { NotificationKind, NotifyPriority, UserRole } from '@/lib/database.types';

export type BroadcastState = { error?: string; ok?: string } | undefined;

/**
 * Writing an announcement. Writing is not sending: a draft sits until somebody
 * presses send, which is the only chance anybody gets to read it twice.
 */
export async function draftBroadcast(_prev: BroadcastState, formData: FormData): Promise<BroadcastState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 4) return { error: t('اكتب عنواناً واضحاً.', 'Give it a clear title.') };

  const role = String(formData.get('audience_role') ?? '');

  const { error } = await supabase.from('notification_broadcasts').insert({
    kind: String(formData.get('kind') ?? 'system') as NotificationKind,
    title_ar: title,
    body_ar: String(formData.get('body') ?? '').trim() || null,
    link: String(formData.get('link') ?? '').trim() || null,
    priority: String(formData.get('priority') ?? 'info') as NotifyPriority,
    audience_role: role ? (role as UserRole) : null,
    created_by: user.id,
  });

  revalidatePath('/admin/notifications');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظ كمسودّة — راجعه ثم أرسله.', 'Saved as a draft — read it again, then send it.') };
}

/** Sending it. One fan-out through the same engine everything else uses. */
export async function sendBroadcast(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('send_broadcast', { p_broadcast: String(formData.get('broadcast_id') ?? '') });

  revalidatePath('/admin/notifications');
}

export async function deleteBroadcast(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.from('notification_broadcasts')
    .delete()
    .eq('id', String(formData.get('broadcast_id') ?? ''))
    .is('sent_at', null);

  revalidatePath('/admin/notifications');
}
