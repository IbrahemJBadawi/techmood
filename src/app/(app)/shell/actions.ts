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
