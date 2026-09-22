'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { StartupMemberRole } from '@/lib/database.types';

export type TeamState = { error?: string; ok?: string } | undefined;

/**
 * Bringing somebody into the room. By TechMood ID, because one account is one
 * professional identity — a co-founder is not a second login.
 */
export async function addMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const techmoodId = String(formData.get('techmood_id') ?? '').trim().toUpperCase();

  const { data: person } = await supabase
    .from('profiles').select('id').eq('techmood_id', techmoodId).maybeSingle();

  if (!person) return { error: t('لا يوجد حساب بهذا المعرّف.', 'No account with that ID.') };

  const { error } = await supabase.from('startup_members').insert({
    startup_id: startupId,
    profile_id: person.id,
    role: String(formData.get('role') ?? 'member') as StartupMemberRole,
    title_ar: String(formData.get('title') ?? '').trim() || null,
  });

  revalidatePath(`/startups/${startupId}/team`);
  if (error) {
    return error.code === '23505'
      ? { error: t('هذا الشخص في الفريق بالفعل.', 'They are already in the room.') }
      : { error: t('تعذّرت الإضافة — الإدارة فقط من تضيف أعضاء.', 'That failed — only whoever runs the company adds people.') };
  }

  return { ok: t('أُضيف إلى مساحة العمل.', 'They are in the workspace.') };
}

/** Changing what somebody may do here. */
export async function setMemberRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('startup_members')
    .update({ role: String(formData.get('role') ?? 'member') as StartupMemberRole })
    .eq('startup_id', startupId)
    .eq('profile_id', String(formData.get('profile_id') ?? ''));

  revalidatePath(`/startups/${startupId}/team`);
}

export async function removeMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('startup_members')
    .delete()
    .eq('startup_id', startupId)
    .eq('profile_id', String(formData.get('profile_id') ?? ''));

  revalidatePath(`/startups/${startupId}/team`);
}
