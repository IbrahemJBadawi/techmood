'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionFormState } from '@/components/ActionForm';
import type { CourseLevel, LessonKind } from '@/lib/database.types';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';

/**
 * The mentor's studio (0115). Every write is a database function that checks
 * the author and that the piece is still being edited; these actions only
 * turn a form into its arguments and say what happened.
 */

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

/** One item per line; blank lines are dropped. */
function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** «title | https://…» per line; a bare link is a line too. */
function links(value: string, titleKey: 'title_ar' | 'label') {
  return lines(value).map((line) => {
    const at = line.search(/https?:\/\//);
    const url = (at >= 0 ? line.slice(at) : line).trim();
    const title = at > 0 ? line.slice(0, at).replace(/[|:\-–—\s]+$/, '').trim() : '';
    return { [titleKey]: title || null, url };
  });
}

function done(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
export async function createStudioCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('studio_create_course', {
    p_title_ar: text(formData, 'title_ar'),
    p_title_en: text(formData, 'title_en') || null,
    p_description_ar: text(formData, 'description_ar') || null,
    p_level: (text(formData, 'level') || 'beginner') as CourseLevel,
  });
  if (error || !data) return { error: dbError(t, error?.message ?? '') };
  done(['/studio']);
  redirect(`/studio/courses/${data}`);
}

export async function saveStudioCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'course_id');
  const hours = Number(text(formData, 'estimated_hours'));
  const { error } = await supabase.rpc('studio_update_course', {
    p_course: id,
    p_title_ar: text(formData, 'title_ar'),
    p_title_en: text(formData, 'title_en') || null,
    p_description_ar: text(formData, 'description_ar') || null,
    p_level: (text(formData, 'level') || 'beginner') as CourseLevel,
    p_estimated_hours: Number.isFinite(hours) && hours > 0 ? hours : null,
  });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio', `/studio/courses/${id}`]);
  return { ok: t('حُفظت بيانات الدورة.', 'The course details are saved.') };
}

export async function deleteStudioCourse(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_delete_course', { p_course: text(formData, 'course_id') });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio']);
  redirect('/studio');
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
export async function addStudioModule(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const course = text(formData, 'course_id');
  const { error } = await supabase.rpc('studio_add_module', { p_course: course, p_title_ar: text(formData, 'title_ar') });
  if (error) return { error: dbError(t, error.message) };
  done([`/studio/courses/${course}`]);
  return { ok: t('أُضيفت الوحدة.', 'Module added.') };
}

export async function renameStudioModule(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_update_module', {
    p_module: text(formData, 'module_id'), p_title_ar: text(formData, 'title_ar'),
  });
  if (error) return { error: dbError(t, error.message) };
  done([`/studio/courses/${text(formData, 'course_id')}`]);
  return { ok: t('حُفظ.', 'Saved.') };
}

export async function deleteStudioModule(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_delete_module', { p_module: text(formData, 'module_id') });
  if (error) return { error: dbError(t, error.message) };
  done([`/studio/courses/${text(formData, 'course_id')}`]);
  return { ok: t('حُذفت الوحدة.', 'Module deleted.') };
}

export async function moveStudioItem(formData: FormData) {
  const supabase = await createClient();
  const direction = text(formData, 'direction') === 'up' ? -1 : 1;
  if (text(formData, 'kind') === 'module') {
    await supabase.rpc('studio_move_module', { p_module: text(formData, 'id'), p_direction: direction });
  } else {
    await supabase.rpc('studio_move_lesson', { p_lesson: text(formData, 'id'), p_direction: direction });
  }
  done([`/studio/courses/${text(formData, 'course_id')}`]);
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
export async function saveStudioLesson(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const course = text(formData, 'course_id');
  const lessonId = text(formData, 'lesson_id') || null;

  const brief = text(formData, 'brief_ar');
  const deliverables = text(formData, 'deliverables_ar');
  const evidence = text(formData, 'evidence');
  const assignment = brief
    ? {
        title_ar: text(formData, 'assignment_title_ar') || null,
        brief_ar: deliverables ? `${brief}\n\n📦 المطلوب تسليمه:\n${deliverables}` : brief,
        required_evidence: evidence ? [evidence] : [],
      }
    : null;

  const { data, error } = await supabase.rpc('studio_save_lesson', {
    p_module: text(formData, 'module_id'),
    p_lesson: lessonId,
    p: {
      title_ar: text(formData, 'title_ar'),
      title_en: text(formData, 'title_en') || null,
      kind: (text(formData, 'kind') || 'video') as LessonKind,
      duration_minutes: text(formData, 'duration_minutes') || null,
      summary_ar: text(formData, 'summary_ar') || null,
      outcomes_ar: lines(text(formData, 'outcomes_ar')),
      videos: links(text(formData, 'videos'), 'title_ar'),
      resources: links(text(formData, 'resources'), 'label'),
      case_study_ar: text(formData, 'case_study_ar') || null,
      case_question_ar: text(formData, 'case_question_ar') || null,
      challenge_ar: text(formData, 'challenge_ar') || null,
      assignment,
    },
  });
  if (error || !data) return { error: dbError(t, error?.message ?? '') };
  done([`/studio/courses/${course}`]);
  if (!lessonId) redirect(`/studio/courses/${course}/lessons/${data}?saved=1`);
  return { ok: t('حُفظ الدرس.', 'Lesson saved.') };
}

export async function deleteStudioLesson(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const course = text(formData, 'course_id');
  const { error } = await supabase.rpc('studio_delete_lesson', { p_lesson: text(formData, 'lesson_id') });
  if (error) return { error: dbError(t, error.message) };
  done([`/studio/courses/${course}`]);
  redirect(`/studio/courses/${course}`);
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
function tags(formData: FormData) {
  return text(formData, 'tags').split(/[,،]/).map((tag) => tag.trim()).filter(Boolean);
}

export async function createStudioPath(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('studio_create_path', {
    p_title_ar: text(formData, 'title_ar'),
    p_title_en: text(formData, 'title_en') || null,
    p_school: text(formData, 'school'),
    p_tagline_ar: text(formData, 'tagline_ar') || null,
    p_description_ar: text(formData, 'description_ar') || null,
    p_tags: tags(formData),
  });
  if (error || !data) return { error: dbError(t, error?.message ?? '') };
  done(['/studio']);
  redirect(`/studio/paths/${data}`);
}

export async function saveStudioPath(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'path_id');
  const { error } = await supabase.rpc('studio_update_path', {
    p_path: id,
    p_title_ar: text(formData, 'title_ar'),
    p_title_en: text(formData, 'title_en') || null,
    p_school: text(formData, 'school'),
    p_tagline_ar: text(formData, 'tagline_ar') || null,
    p_description_ar: text(formData, 'description_ar') || null,
    p_tags: tags(formData),
  });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio', `/studio/paths/${id}`]);
  return { ok: t('حُفظت بيانات المسار.', 'The path details are saved.') };
}

/** Ticked courses, in the order their numbers say; unticked «required» means breadth. */
export async function saveStudioPathCourses(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'path_id');
  const chosen = formData.getAll('course').map(String);
  const ordered = chosen
    .map((course) => ({ course, order: Number(text(formData, `order_${course}`)) || 99 }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.course);
  const optional = chosen.filter((course) => formData.get(`optional_${course}`) === 'on');
  const { error } = await supabase.rpc('studio_set_path_courses', { p_path: id, p_courses: ordered, p_optional: optional });
  if (error) return { error: dbError(t, error.message) };
  done([`/studio/paths/${id}`]);
  return { ok: t('حُفظت دورات المسار.', 'The path’s courses are saved.') };
}

export async function deleteStudioPath(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('studio_delete_path', { p_path: text(formData, 'path_id') });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio']);
  redirect('/studio');
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
export async function submitStudioItem(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const kind = text(formData, 'kind');
  const id = text(formData, 'id');
  const { error } = await supabase.rpc('studio_submit', { p_kind: kind, p_id: id });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio', `/studio/${kind === 'path' ? 'paths' : 'courses'}/${id}`]);
  return { ok: t('أُرسل للمراجعة — يصلك إشعار بالقرار.', 'Sent for review — you will be notified of the decision.') };
}

export async function withdrawStudioItem(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const kind = text(formData, 'kind');
  const id = text(formData, 'id');
  const { error } = await supabase.rpc('studio_withdraw', { p_kind: kind, p_id: id });
  if (error) return { error: dbError(t, error.message) };
  done(['/studio', `/studio/${kind === 'path' ? 'paths' : 'courses'}/${id}`]);
  return { ok: t('سُحب من المراجعة — تستطيع التعديل الآن.', 'Withdrawn — you can edit again.') };
}

export async function reviewStudioItem(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const approve = text(formData, 'decision') === 'approve';
  const { error } = await supabase.rpc('review_studio_item', {
    p_kind: text(formData, 'kind'),
    p_id: text(formData, 'id'),
    p_approve: approve,
    p_note: text(formData, 'note') || null,
  });
  if (error) return { error: dbError(t, error.message) };
  done(['/admin/studio', '/academy']);
  return { ok: approve ? t('نُشر، ووصل المنتور إشعار.', 'Published, and the mentor has been told.') : t('أُعيد للمنتور مع ملاحظتك.', 'Sent back to the mentor with your note.') };
}
