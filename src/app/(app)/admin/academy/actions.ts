'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ActionFormState } from '@/components/ActionForm';
import type { ContentStatus, EvidenceKind, LessonKind } from '@/lib/database.types';

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

/* -------------------------------------------------------------------------
 * Control over every part of the catalogue (0078)
 *
 * Status for a course, lesson or project is one of four:
 *   published — open · planned — «قريباً» (shown, not usable) ·
 *   draft — hidden while it is written · archived — switched off.
 * A path's open/«قريباً» follows its courses; the admin chooses whether that
 * rule applies (auto) or holds the path back / switches it off.
 * ------------------------------------------------------------------------- */

const STATUSES: ContentStatus[] = ['draft', 'planned', 'published', 'archived'];

function statusOf(formData: FormData): ContentStatus {
  const value = String(formData.get('status') ?? '') as ContentStatus;
  return STATUSES.includes(value) ? value : 'draft';
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

async function result(formData: FormData, error: { message: string } | null, ok: { ar: string; en: string }): Promise<ActionFormState> {
  const t = await getT();
  revalidateFor(formData);
  revalidatePath('/academy');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t(ok.ar, ok.en) };
}

const SAVED = { ar: 'حُفظ.', en: 'Saved.' };

export async function setCourseStatusTo(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('courses').update({ status: statusOf(formData) }).eq('id', text(formData, 'course_id'));
  return result(formData, error, SAVED);
}

export async function setLessonStatus(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('lessons').update({ status: statusOf(formData) }).eq('id', text(formData, 'lesson_id'));
  return result(formData, error, SAVED);
}

export async function setAssignmentStatus(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('assignments').update({ status: statusOf(formData) }).eq('id', text(formData, 'assignment_id'));
  return result(formData, error, SAVED);
}

export async function setPathMode(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const mode = text(formData, 'mode');
  const { error } = await supabase.rpc('set_path_mode', {
    p_path: text(formData, 'path_id'),
    p_mode: (['auto', 'draft', 'archived'].includes(mode) ? mode : 'auto') as 'auto' | 'draft' | 'archived',
  });
  return result(formData, error, SAVED);
}

export async function createPath(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { data: last } = await supabase.from('learning_paths').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  // Announced («قريباً») until one of its courses is published.
  const { error } = await supabase.from('learning_paths').insert({
    slug: text(formData, 'slug').toLowerCase(),
    title_ar: text(formData, 'title_ar'),
    title_en: text(formData, 'title_en') || null,
    description_ar: text(formData, 'description_ar') || null,
    school_id: text(formData, 'school_id') || null,
    status: 'planned',
    sort_order: (last?.[0]?.sort_order ?? 0) + 1,
  });
  return result(formData, error, { ar: 'أُضيف المسار — «قريباً» حتى تُنشر إحدى دوراته.', en: 'Path added — «coming soon» until one of its courses is published.' });
}

export async function savePathDetails(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('learning_paths').update({
    title_ar: text(formData, 'title_ar'),
    title_en: text(formData, 'title_en') || null,
    description_ar: text(formData, 'description_ar') || null,
    tagline_ar: text(formData, 'tagline_ar') || null,
    school_id: text(formData, 'school_id') || null,
  }).eq('id', text(formData, 'path_id'));
  return result(formData, error, SAVED);
}

export async function createCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const hours = text(formData, 'estimated_hours');
  const { error } = await supabase.from('courses').insert({
    slug: text(formData, 'slug').toLowerCase(),
    title_ar: text(formData, 'title_ar'),
    title_en: text(formData, 'title_en') || null,
    description_ar: text(formData, 'description_ar') || null,
    estimated_hours: hours ? Number(hours) : null,
    status: 'draft',
  });
  return result(formData, error, { ar: 'أُضيفت الدورة كمسودة. اكتب دروسها ثم انشرها.', en: 'Course added as a draft. Write its lessons, then publish it.' });
}

export async function saveCourseDetails(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const hours = text(formData, 'estimated_hours');
  const { error } = await supabase.from('courses').update({
    title_ar: text(formData, 'title_ar'),
    title_en: text(formData, 'title_en') || null,
    description_ar: text(formData, 'description_ar') || null,
    estimated_hours: hours ? Number(hours) : null,
  }).eq('id', text(formData, 'course_id'));
  return result(formData, error, SAVED);
}

/** Putting a course in a path (or changing its place in it). */
export async function linkCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const pathId = text(formData, 'path_id');
  const order = text(formData, 'sort_order');
  let sortOrder = order ? Number(order) : NaN;
  if (!Number.isFinite(sortOrder)) {
    const { data: last } = await supabase.from('path_courses').select('sort_order').eq('path_id', pathId).order('sort_order', { ascending: false }).limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1;
  }
  const { error } = await supabase.from('path_courses').upsert({
    path_id: pathId,
    course_id: text(formData, 'course_id'),
    is_required: formData.get('is_required') === 'on',
    sort_order: sortOrder,
  });
  return result(formData, error, SAVED);
}

export async function unlinkCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('path_courses').delete()
    .eq('path_id', text(formData, 'path_id'))
    .eq('course_id', text(formData, 'course_id'));
  return result(formData, error, { ar: 'أُزيلت الدورة من المسار.', en: 'The course was taken out of the path.' });
}

export async function saveAssignment(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.from('assignments').update({
    title_ar: text(formData, 'title_ar'),
    brief_ar: text(formData, 'brief_ar') || null,
    is_required: formData.get('is_required') === 'on',
    status: statusOf(formData),
  }).eq('id', text(formData, 'assignment_id'));
  return result(formData, error, SAVED);
}

/**
 * A lesson earned with an outside credential (0073): which provider, which
 * credential, and whether practice inside TechMood is also required.
 */
export async function saveCredentialSlot(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const lessonId = text(formData, 'lesson_id');
  if (formData.get('remove') === 'yes') {
    const { error } = await supabase.from('lesson_credentials').delete().eq('lesson_id', lessonId);
    return result(formData, error, { ar: 'لم يعد الدرس مرتبطاً بشهادة.', en: 'The lesson no longer needs a credential.' });
  }
  const { error } = await supabase.from('lesson_credentials').upsert({
    lesson_id: lessonId,
    provider_id: text(formData, 'provider_id'),
    credential_name: text(formData, 'credential_name') || null,
    credential_url: text(formData, 'credential_url') || null,
    requires_application: formData.get('requires_application') === 'on',
    note_ar: text(formData, 'note_ar') || null,
  });
  return result(formData, error, SAVED);
}
