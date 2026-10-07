'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { LOCALE_COOKIE } from '@/lib/i18n';
import type { UiLanguage } from '@/lib/database.types';

/**
 * The interface language.
 *
 * Written twice on purpose: to the cookie, which is what every render reads
 * (and what a signed-out visitor has), and to the profile, which is the durable
 * copy that follows the account onto a new device. Signing in copies the
 * profile back onto the cookie.
 */
export async function setLanguage(formData: FormData) {
  const language = String(formData.get('language') ?? 'ar') as UiLanguage;
  if (language !== 'ar' && language !== 'en') return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, language, {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ language }).eq('id', user.id);
  }

  revalidatePath('/', 'layout');
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', user.id)
    .eq('is_read', false);

  revalidatePath('/', 'layout');
}

/** One notification read, from the long-press menu (design lab 3). */
export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', user.id)
    .eq('id', String(formData.get('notification_id') ?? ''));

  revalidatePath('/', 'layout');
}

/**
 * How many new notifications, or messages from others, arrived after `since` —
 * read as the member, so RLS limits it to their own. The page polls this and
 * offers «↑ جديد» instead of reloading under the reader's eyes.
 */
export async function newSince(scope: 'notifications' | 'messages', since: string): Promise<number> {
  if (Number.isNaN(Date.parse(since))) return 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  if (scope === 'notifications') {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id).gt('created_at', since);
    return count ?? 0;
  }
  const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true })
    .gt('created_at', since).neq('sender_id', user.id).is('deleted_at', null);
  return count ?? 0;
}
