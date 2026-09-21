'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { EvidenceKind } from '@/lib/database.types';

export type ActionState = { error?: string; ok?: string } | undefined;

/** Marks a lesson complete or reopens it. XP is granted by the database. */
export async function toggleLesson(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const lessonId = String(formData.get('lesson_id') ?? '');
  const completed = formData.get('completed') === 'true';

  await supabase.from('lesson_progress').upsert(
    {
      profile_id: user.id,
      lesson_id: lessonId,
      status: completed ? 'available' : 'completed',
      completed_at: completed ? null : new Date().toISOString(),
    },
    { onConflict: 'profile_id,lesson_id' },
  );

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
}

/**
 * Submits work for an assignment. The evidence requirements are enforced again
 * inside submit_work(), so a crafted request cannot skip them.
 */
export async function submitWork(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const assignmentId = String(formData.get('assignment_id') ?? '');
  const required = String(formData.get('required_evidence') ?? '')
    .split(',')
    .filter(Boolean) as EvidenceKind[];

  const evidence = required
    .map((kind) => ({ kind, url: String(formData.get(`url_${kind}`) ?? '').trim(), label: kind }))
    .filter((item) => item.url.length > 0);

  const missing = required.filter((kind) => !evidence.some((item) => item.kind === kind));
  if (missing.length > 0) {
    return { error: t('الرجاء إدخال كل الروابط المطلوبة قبل التسليم.', 'Please fill in every required link before submitting.') };
  }

  if (evidence.some((item) => !/^https?:\/\//i.test(item.url))) {
    return { error: t('الروابط يجب أن تبدأ بـ http أو https.', 'Links must start with http or https.') };
  }

  const { error } = await supabase.rpc('submit_work', {
    p_assignment_id: assignmentId,
    p_evidence: evidence,
    p_note: String(formData.get('note') ?? '').slice(0, 1000) || null,
  });

  if (error) {
    return { error: t('تعذّر إرسال التسليم — حاول مرة أخرى.', 'The submission could not be sent — try again.') };
  }

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  return { ok: t('تم التسليم، وهو الآن بانتظار مراجعة منتور.', 'Submitted. It is now waiting for a mentor to review it.') };
}

/** Issues a course or path certificate. Eligibility is checked in the database. */
export async function issueCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const supabase = await createClient();

  const { error } = await supabase.rpc('issue_certificate', {
    p_kind: formData.get('kind') === 'path' ? 'path' : 'course',
    p_target: String(formData.get('target_id') ?? ''),
  });

  if (error) {
    return { error: t('لم تكتمل متطلبات الشهادة بعد — يجب اعتماد كل الأعمال المطلوبة أولاً.', 'The certificate requirements are not met yet — all required work has to be approved first.') };
  }

  revalidatePath('/certificates');
  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  return { ok: t('تم إصدار الشهادة.', 'Certificate issued.') };
}

/**
 * Enrols the caller in a path. A path is always open — there are no cohorts and
 * no intake window — so this is idempotent, and it also joins the path's
 * permanent conversation through a database trigger.
 */
export async function enrolInPath(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const pathId = String(formData.get('path_id') ?? '');

  await supabase
    .from('enrollments')
    .upsert({ profile_id: user.id, path_id: pathId }, { onConflict: 'profile_id,path_id' });

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
}

/**
 * A career goal is chosen, changed and dropped by its owner.
 *
 * Both writes go through functions that resolve the caller themselves, so
 * there is no profile id in the request for anyone to swap.
 */
export async function chooseGoal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const slug = String(formData.get('goal') ?? '');
  await supabase.rpc('choose_career_goal', { p_goal: slug });

  revalidatePath(String(formData.get('revalidate') ?? '/academy/goals'));
}

export async function clearGoal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('clear_career_goal');

  revalidatePath(String(formData.get('revalidate') ?? '/academy/goals'));
}
