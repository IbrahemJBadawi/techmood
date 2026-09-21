'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

export type FieldState = { error?: string; ok?: string } | undefined;

/** The one field you lead with. The database allows only one, by unique index. */
export async function setPrimaryField(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const fieldId = String(formData.get('field_id') ?? '');

  // Clear first, then set: the partial unique index would otherwise refuse the
  // moment two rows claim to be primary, even for an instant.
  await supabase.from('profile_fields').update({ is_primary: false })
    .eq('profile_id', user.id).eq('is_primary', true);

  const { error } = await supabase.from('profile_fields').update({ is_primary: true })
    .eq('profile_id', user.id).eq('field_id', fieldId);

  if (error) return { error: t('تعذّر الحفظ.', 'Could not save.') };

  revalidatePath('/home');
  revalidatePath('/settings/fields');
  return { ok: t('تم.', 'Done.') };
}
