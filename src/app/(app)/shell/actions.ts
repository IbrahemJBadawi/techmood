'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { UiLanguage } from '@/lib/database.types';

/**
 * The interface language.
 *
 * Today this changes the document's `lang`, its number and date formatting, and
 * is remembered on the account so the choice follows the person between
 * devices. It does NOT yet translate the copy — there is no English string
 * table, and shipping a switch that silently leaves everything in Arabic would
 * be a worse lie than saying so. The preference is stored now so the
 * translation layer has somewhere to land.
 */
export async function setLanguage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const language = String(formData.get('language') ?? 'ar') as UiLanguage;
  if (language !== 'ar' && language !== 'en') return;

  await supabase.from('profiles').update({ language }).eq('id', user.id);
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
