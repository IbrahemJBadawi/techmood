'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { NotificationKind } from '@/lib/database.types';

export type PreferenceState = { error?: string; ok?: string } | undefined;

/**
 * What a person chose to hear, and how.
 *
 * The mandatory categories are not sent at all — the database would ignore them
 * anyway, and a switch that does nothing is worse than no switch. What is saved
 * here is only what is genuinely theirs to decide.
 */
export async function saveNotificationPreferences(
  _prev: PreferenceState,
  formData: FormData,
): Promise<PreferenceState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const kinds = String(formData.get('kinds') ?? '').split(',').filter(Boolean) as NotificationKind[];

  const rows = kinds.map((kind) => ({
    profile_id: user.id,
    kind,
    in_app: formData.get(`in_app-${kind}`) === 'on',
    email: formData.get(`email-${kind}`) === 'on',
  }));

  if (rows.length === 0) return { error: t('لا شيء لحفظه.', 'Nothing to save.') };

  const { error } = await supabase.from('notification_preferences').upsert(rows);

  revalidatePath('/settings/notifications');
  if (error) return { error: t('تعذّر الحفظ.', 'That could not be saved.') };

  return { ok: t('حُفظت تفضيلاتك.', 'Your choices are saved.') };
}
