'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { SELECTABLE_ROLES } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

export type RoleState = { error?: string; ok?: string } | undefined;

export async function applyForRole(_prev: RoleState, formData: FormData): Promise<RoleState> {
  const t = await getT();
  const supabase = await createClient();
  const role = String(formData.get('role') ?? '') as UserRole;

  if (!SELECTABLE_ROLES.some((r) => r.value === role && r.needsReview)) {
    return { error: t('هذا الدور لا يُطلب من هنا.', 'That role is not requested from here.') };
  }
  // The mentor role has a form of its own; a one-line note is not enough to
  // decide on someone who will be reviewing other people's work.
  if (role === 'mentor') redirect('/settings/roles/mentor');

  const { error } = await supabase.rpc('apply_for_role', {
    p_role: role,
    p_note: String(formData.get('note') ?? '').trim() || null,
    p_evidence_url: String(formData.get('evidence_url') ?? '').trim() || null,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/settings/roles');
  return {
    ok: t('أُرسل طلبك — ستصلك النتيجة في الإشعارات.',
          'Your request is in — the decision will reach you in your notifications.'),
  };
}

export async function answerRequest(_prev: RoleState, formData: FormData): Promise<RoleState> {
  const t = await getT();
  const supabase = await createClient();

  const { error } = await supabase.rpc('answer_role_request', {
    p_request: String(formData.get('request_id') ?? ''),
    p_note: String(formData.get('note') ?? '').trim(),
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/settings/roles');
  return { ok: t('وصل ردّك — الطلب عاد إلى قائمة المراجعة.', 'Your answer is in — the request is back in the queue.') };
}

export async function withdrawRequest(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('withdraw_role_request', {
    p_request: String(formData.get('request_id') ?? ''),
  });
  revalidatePath('/settings/roles');
}

/** The role the app opens on. Only an approved role is accepted, by trigger. */
export async function setPrimaryRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({ primary_role: String(formData.get('role') ?? '') as UserRole })
    .eq('id', user.id);

  revalidatePath('/', 'layout');
}

export async function submitMentorApplication(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getT();
  const supabase = await createClient();

  const domains = formData.getAll('domains').map(String).filter(Boolean);
  const languages = formData.getAll('languages').map(String).filter(Boolean);

  const { error } = await supabase.rpc('submit_mentor_application', {
    p_headline: String(formData.get('headline') ?? '').trim(),
    p_bio: String(formData.get('bio') ?? '').trim(),
    p_domains: domains,
    p_years: Number(formData.get('years') ?? 0),
    p_weekly_hours: Number(formData.get('weekly_hours') ?? 1),
    p_motivation: String(formData.get('motivation') ?? '').trim(),
    p_experience: String(formData.get('experience') ?? '').trim(),
    p_linkedin_url: String(formData.get('linkedin_url') ?? '').trim() || null,
    p_portfolio_url: String(formData.get('portfolio_url') ?? '').trim() || null,
    p_languages: languages,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/settings/roles');
  redirect('/settings/roles');
}
