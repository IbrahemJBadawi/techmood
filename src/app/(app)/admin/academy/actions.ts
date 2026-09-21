'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { EvidenceKind, LessonKind } from '@/lib/database.types';

export type PublishState = { error?: string; ok?: string } | undefined;

/**
 * Authoring the catalogue.
 *
 * Every write here is an ordinary table write: the catalogue's admin policies
 * (0011) already say only an admin may write it, and the publish guards (0036)
 * already say what may be published. These actions add no permission of their
 * own — if they were called by somebody who is not an admin, the database
 * would refuse them, not this file.
 */

/** A textarea of one item per line becomes an array; blank lines are dropped. */
function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function revalidateFor(formData: FormData) {
  revalidatePath(String(formData.get('revalidate') ?? '/admin/academy'));
}

export async function saveLesson(formData: FormData) {
  const supabase = await createClient();

  const duration = String(formData.get('duration_minutes') ?? '').trim();

  await supabase
    .from('lessons')
    .update({
      title_ar: String(formData.get('title_ar') ?? '').trim(),
      title_en: String(formData.get('title_en') ?? '').trim() || null,
      kind: String(formData.get('kind') ?? 'video') as LessonKind,
      duration_minutes: duration ? Number(duration) : null,
      summary_ar: String(formData.get('summary_ar') ?? '').trim() || null,
      outcomes_ar: lines(formData.get('outcomes_ar')),
      case_study_ar: String(formData.get('case_study_ar') ?? '').trim() || null,
      case_question_ar: String(formData.get('case_question_ar') ?? '').trim() || null,
      challenge_ar: String(formData.get('challenge_ar') ?? '').trim() || null,
    })
    .eq('id', String(formData.get('lesson_id') ?? ''));

  revalidateFor(formData);
}

export async function addLesson(formData: FormData) {
  const supabase = await createClient();

  const moduleId = String(formData.get('module_id') ?? '');
  const { data: existing } = await supabase
    .from('lessons')
    .select('sort_order')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: false })
    .limit(1);

  await supabase.from('lessons').insert({
    module_id: moduleId,
    title_ar: String(formData.get('title_ar') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'video') as LessonKind,
    sort_order: (existing?.[0]?.sort_order ?? 0) + 1,
  });

  revalidateFor(formData);
}

export async function addModule(formData: FormData) {
  const supabase = await createClient();

  const courseId = String(formData.get('course_id') ?? '');
  const { data: existing } = await supabase
    .from('modules')
    .select('sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: false })
    .limit(1);

  await supabase.from('modules').insert({
    course_id: courseId,
    title_ar: String(formData.get('title_ar') ?? '').trim(),
    sort_order: (existing?.[0]?.sort_order ?? 0) + 1,
  });

  revalidateFor(formData);
}

export async function addVideo(formData: FormData) {
  const supabase = await createClient();

  const lessonId = String(formData.get('lesson_id') ?? '');
  const { data: existing } = await supabase
    .from('lesson_videos')
    .select('sort_order')
    .eq('lesson_id', lessonId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const duration = String(formData.get('duration_minutes') ?? '').trim();

  await supabase.from('lesson_videos').insert({
    lesson_id: lessonId,
    title_ar: String(formData.get('title_ar') ?? '').trim(),
    title_en: String(formData.get('title_en') ?? '').trim() || null,
    description_ar: String(formData.get('description_ar') ?? '').trim() || null,
    url: String(formData.get('url') ?? '').trim(),
    duration_minutes: duration ? Number(duration) : null,
    sort_order: (existing?.[0]?.sort_order ?? 0) + 1,
  });

  revalidateFor(formData);
}

export async function removeVideo(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('lesson_videos').delete().eq('id', String(formData.get('video_id') ?? ''));
  revalidateFor(formData);
}

export async function addResource(formData: FormData) {
  const supabase = await createClient();

  await supabase.from('lesson_resources').insert({
    lesson_id: String(formData.get('lesson_id') ?? ''),
    label: String(formData.get('label') ?? '').trim(),
    url: String(formData.get('url') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'website') as EvidenceKind,
  });

  revalidateFor(formData);
}

export async function removeResource(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('lesson_resources').delete().eq('id', String(formData.get('resource_id') ?? ''));
  revalidateFor(formData);
}

/**
 * Publishing, and taking something back.
 *
 * The conditions live in the database (0036): a course with no lessons and a
 * path whose required courses are still outlines are refused there. What comes
 * back here is the reason, so the page can say it.
 */
export async function setCourseStatus(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const t = await getT();
  const supabase = await createClient();
  const status = String(formData.get('status') ?? 'draft') as 'draft' | 'published';

  const { error } = await supabase
    .from('courses')
    .update({ status })
    .eq('id', String(formData.get('course_id') ?? ''));

  revalidateFor(formData);
  if (error) return { error: dbError(t, error.message) };
  return { ok: status === 'published' ? t('نُشرت الدورة.', 'The course is published.') : t('عادت الدورة مسودة.', 'The course is a draft again.') };
}

export async function setPathStatus(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const t = await getT();
  const supabase = await createClient();
  const status = String(formData.get('status') ?? 'planned') as 'planned' | 'published';

  const { error } = await supabase
    .from('learning_paths')
    .update({ status })
    .eq('id', String(formData.get('path_id') ?? ''));

  revalidateFor(formData);
  if (error) return { error: dbError(t, error.message) };
  return { ok: status === 'published' ? t('نُشر المسار.', 'The path is published.') : t('عاد المسار إلى المُعلَن.', 'The path is announced again.') };
}
