'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

export type MentorAccessState = { error?: string; ok?: string } | undefined;

/**
 * Letting a mentor in, by name and until a date.
 *
 * The company decides who and for how long; nothing here is implicit, and an
 * expiry that passes closes the door without anybody remembering to close it.
 */
export async function grantMentorAccess(_prev: MentorAccessState, formData: FormData): Promise<MentorAccessState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const techmoodId = String(formData.get('techmood_id') ?? '').trim().toUpperCase();

  const { data: person } = await supabase
    .from('profiles').select('id').eq('techmood_id', techmoodId).maybeSingle();

  if (!person) return { error: t('لا يوجد حساب بهذا المعرّف.', 'No account with that ID.') };

  const { data: isMentor } = await supabase
    .from('mentor_profiles').select('profile_id').eq('profile_id', person.id).maybeSingle();

  if (!isMentor) {
    return { error: t('هذا الحساب ليس منتوراً معتمداً.', 'That account is not an approved mentor.') };
  }

  const { error } = await supabase.from('startup_mentor_access').upsert({
    startup_id: startupId,
    mentor_id: person.id,
    granted_by: user.id,
    note_ar: String(formData.get('note') ?? '').trim() || null,
    expires_on: String(formData.get('expires_on') ?? '') || null,
  });

  revalidatePath(`/startups/${startupId}/mentors`);
  if (error) return { error: t('تعذّر المنح — إدارة الشركة فقط من تمنح الوصول.', 'That failed — only whoever runs the company grants access.') };

  return { ok: t('مُنح الوصول. يرى المنتور اللوحات التي فتحتموها للمنتورين فقط.',
                 'Access granted. The mentor sees the canvases you opened to mentors, and nothing else.') };
}

export async function revokeMentorAccess(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('startup_mentor_access')
    .delete()
    .eq('startup_id', startupId)
    .eq('mentor_id', String(formData.get('mentor_id') ?? ''));

  revalidatePath(`/startups/${startupId}/mentors`);
}
