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
    push: formData.get(`push-${kind}`) === 'on',
  }));

  if (rows.length === 0) return { error: t('لا شيء لحفظه.', 'Nothing to save.') };

  const { error } = await supabase.from('notification_preferences').upsert(rows);

  revalidatePath('/settings/notifications');
  if (error) return { error: t('تعذّر الحفظ.', 'That could not be saved.') };

  return { ok: t('حُفظت تفضيلاتك.', 'Your choices are saved.') };
}

/** This device's push subscription (0100), as the browser gave it. */
export async function savePushSubscription(subscription: {
  endpoint: string; p256dh: string; auth: string; userAgent: string;
}): Promise<{ error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_user_agent: subscription.userAgent.slice(0, 300),
  });
  revalidatePath('/settings/notifications');
  return error ? { error: t('تعذّر تفعيل الإشعارات على هذا الجهاز.', 'Device notifications could not be turned on.') } : {};
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint });
  revalidatePath('/settings/notifications');
}
