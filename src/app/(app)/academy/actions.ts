'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { precheckSubmission, writeLessonQuiz } from '@/lib/ai-tasks';
import type { CourseCriterion, EvidenceKind } from '@/lib/database.types';

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

  // The first lesson of a course also joins its path (0118), so the academy
  // and home pages change too.
  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  revalidatePath('/academy');
  revalidatePath('/home');
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

  const evidence: { kind: EvidenceKind; url: string; label: string }[] = required
    .map((kind) => ({ kind, url: String(formData.get(`url_${kind}`) ?? '').trim(), label: kind as string }))
    .filter((item) => item.url.length > 0);

  const missing = required.filter((kind) => !evidence.some((item) => item.kind === kind));
  if (missing.length > 0) {
    return { error: t('الرجاء إدخال كل الروابط المطلوبة قبل التسليم.', 'Please fill in every required link before submitting.') };
  }

  // A project: its own link is required; YouTube and LinkedIn are optional (0096).
  if (formData.get('is_project')) {
    const projectKinds: EvidenceKind[] = ['github', 'website', 'portfolio', 'drive'];
    const projectKind = String(formData.get('project_kind') ?? 'github') as EvidenceKind;
    const projectUrl = String(formData.get('url_project') ?? '').trim();
    if (!projectUrl) {
      return { error: t('رابط المشروع مطلوب.', 'The project link is required.') };
    }
    evidence.push({ kind: projectKinds.includes(projectKind) ? projectKind : 'github', url: projectUrl, label: 'project' });

    for (const kind of ['youtube', 'linkedin'] as EvidenceKind[]) {
      const url = String(formData.get(`url_${kind}`) ?? '').trim();
      if (url && !required.includes(kind)) evidence.push({ kind, url, label: kind });
    }
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
    if (error.message.includes('YouTube')) {
      return { error: t('رابط الشرح يجب أن يكون من YouTube.', 'The walkthrough link must be a YouTube link.') };
    }
    if (error.message.includes('رابط المشروع')) {
      return { error: t('رابط المشروع مطلوب.', 'The project link is required.') };
    }
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
  const back = String(formData.get('revalidate') ?? '/academy');

  // Through enrol_in_path (0118): a plain upsert here could never save, because
  // the unique index on (profile_id, path_id) is partial. A refusal is shown on
  // the path page instead of the page silently staying the same.
  const { error } = await supabase.rpc('enrol_in_path', { p_path: pathId });
  revalidatePath(back);
  revalidatePath('/academy');
  revalidatePath('/home');
  // Back to the same page either way, so it shows «you are on this path» at once.
  redirect(error ? `${back}?join=failed` : back);
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

  // Choosing a goal also joins its first path (0119): the academy and home
  // page change with it.
  revalidatePath(String(formData.get('revalidate') ?? '/academy/goals'));
  revalidatePath('/academy');
  revalidatePath('/home');
}

export async function clearGoal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('clear_career_goal');

  revalidatePath(String(formData.get('revalidate') ?? '/academy/goals'));
}

export type CredentialState = { error?: string; ok?: string } | undefined;

/**
 * Handing in somebody else's credential. The database checks that the lesson
 * asks for one, that it has been named, and that the link is a link; a person
 * then opens it at the provider. Nothing here claims it is verified.
 */
export async function submitCredential(
  _prev: CredentialState,
  formData: FormData,
): Promise<CredentialState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const lessonId = String(formData.get('lesson_id') ?? '');
  const { error } = await supabase.rpc('submit_credential', {
    p_lesson: lessonId,
    p_url: String(formData.get('url') ?? '').trim(),
    p_code: String(formData.get('code') ?? '').trim() || null,
    p_issued: String(formData.get('issued_on') ?? '') || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصلت الشهادة، وتنتظر من يفتحها عند المُصدِر ويوثّقها.',
                 'Your credential is in, waiting for someone to open it at the provider and verify it.') };
}

/** Rating a finished course (0081). The database checks the course is finished. */
export async function rateCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const supabase = await createClient();
  const scores: Partial<Record<CourseCriterion, number>> = {};
  for (const criterion of ['content', 'clarity', 'practice', 'pace', 'usefulness'] as CourseCriterion[]) {
    const raw = String(formData.get(criterion) ?? '').trim();
    if (raw) scores[criterion] = Number(raw);
  }
  if (Object.keys(scores).length === 0) {
    return { error: t('اختر درجة واحدة على الأقل.', 'Give at least one score.') };
  }
  const recommend = formData.get('recommend');
  const { error } = await supabase.rpc('rate_course', {
    p_course: String(formData.get('course_id') ?? ''),
    p_scores: scores,
    p_recommend: recommend === 'yes' ? true : recommend === 'no' ? false : null,
    p_liked: String(formData.get('liked') ?? '').trim() || null,
    p_improve: String(formData.get('improve') ?? '').trim() || null,
  });
  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('شكراً — وصل تقييمك للأكاديمية.', 'Thank you — your rating reached the academy.') };
}

// ---------------------------------------------------------------------------
// The lesson's short quiz (0139) and the first look at submitted work (0140)
// ---------------------------------------------------------------------------

export type QuizState = {
  ready: boolean;
  generating: boolean;
  questions: { q: string; options: string[] }[];
  passed: boolean;
  last: { correct: number; total: number; at: string } | null;
};

export type QuizResult = {
  correct: number;
  total: number;
  passed: boolean;
  results: { answer: number; chosen: number; ok: boolean; why: string }[];
};

/** Asks for the lesson's quiz to be written now, then returns it (without answers). */
export async function prepareLessonQuiz(lessonId: string): Promise<{ state: QuizState | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const written = await writeLessonQuiz(supabase, lessonId);
  const { data, error } = await supabase.rpc('lesson_quiz', { p_lesson: lessonId });
  if (error) return { state: null, error: error.message };
  return { state: data as QuizState, error: written.ok ? undefined : written.error };
}

/** Grades on the server; the answers and their reasons come back only now. */
export async function answerLessonQuiz(lessonId: string, answers: number[], revalidate: string): Promise<{ result?: QuizResult; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.rpc('submit_lesson_quiz', { p_lesson: lessonId, p_answers: answers });
  if (error) return { error: dbError(await getT(), error.message) };
  revalidatePath(revalidate);
  return { result: data as QuizResult };
}

export type Precheck = {
  status: 'pending' | 'done' | 'failed';
  result: {
    summary: string;
    items: { item: string; status: 'found' | 'missing' | 'unclear'; note: string }[];
    next: string;
  } | null;
  created_at: string;
};

/** The first look at a submission's newest version, written now. */
export async function runPrecheck(submissionId: string, revalidate: string): Promise<{ precheck: Precheck | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const run = await precheckSubmission(supabase, submissionId);
  const { data } = await supabase
    .from('submission_prechecks')
    .select('status, result, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  revalidatePath(revalidate);
  return { precheck: (data as Precheck | null) ?? null, error: run.ok ? undefined : run.error };
}
