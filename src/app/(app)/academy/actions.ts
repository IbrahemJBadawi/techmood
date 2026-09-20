'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
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
    return { error: 'الرجاء إدخال كل الروابط المطلوبة قبل التسليم.' };
  }

  if (evidence.some((item) => !/^https?:\/\//i.test(item.url))) {
    return { error: 'الروابط يجب أن تبدأ بـ http أو https.' };
  }

  const { error } = await supabase.rpc('submit_work', {
    p_assignment_id: assignmentId,
    p_evidence: evidence,
    p_note: String(formData.get('note') ?? '').slice(0, 1000) || null,
  });

  if (error) {
    return { error: 'تعذّر إرسال التسليم — حاول مرة أخرى.' };
  }

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  return { ok: 'تم التسليم، وهو الآن بانتظار مراجعة منتور.' };
}

/** Issues a course or path certificate. Eligibility is checked in the database. */
export async function issueCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('issue_certificate', {
    p_kind: formData.get('kind') === 'path' ? 'path' : 'course',
    p_target: String(formData.get('target_id') ?? ''),
  });

  if (error) {
    return { error: 'لم تكتمل متطلبات الشهادة بعد — يجب اعتماد كل الأعمال المطلوبة أولاً.' };
  }

  revalidatePath('/certificates');
  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  return { ok: 'تم إصدار الشهادة.' };
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
