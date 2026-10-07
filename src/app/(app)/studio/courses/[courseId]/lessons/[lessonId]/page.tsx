import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { StudioReviewState } from '@/lib/database.types';

import { deleteStudioLesson, saveStudioLesson } from '../../../../actions';
import { editable } from '../../../../review';
import { NumberStepper } from '@/components/NumberStepper';

export const generateMetadata = localizedTitle('تحرير درس — استوديو TechMood', 'Edit a lesson — TechMood studio');

const DELIVERABLES = '\n\n📦 المطلوب تسليمه:\n';

/**
 * A lesson in the TechMood shape (0034): what it is, what the learner will be
 * able to do, what to watch and read, a case to think about, one practical
 * assignment with what to hand in, and an optional challenge. The LinkedIn
 * post and the portfolio folder are not written here — the lesson page writes
 * both from the path, course and lesson.
 */
export default async function StudioLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ module?: string; saved?: string }>;
}) {
  const { courseId, lessonId } = await params;
  const { module: moduleParam, saved } = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: course } = await supabase.from('courses')
    .select('id, slug, title_ar, author_id, review_state').eq('id', courseId).maybeSingle();
  if (!course || course.author_id !== user.id) notFound();

  const isNew = lessonId === 'new';
  const { data: lesson } = isNew ? { data: null } : await supabase.from('lessons')
    .select('id, module_id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, outcomes_ar, case_study_ar, case_question_ar, challenge_ar')
    .eq('id', lessonId).maybeSingle();
  if (!isNew && !lesson) notFound();

  const moduleId = lesson?.module_id ?? moduleParam ?? '';
  const { data: moduleRow } = await supabase.from('modules').select('id, title_ar, course_id').eq('id', moduleId).maybeSingle();
  if (!moduleRow || moduleRow.course_id !== course.id) notFound();

  const [{ data: videos }, { data: resources }, { data: assignment }] = lesson
    ? await Promise.all([
        supabase.from('lesson_videos').select('title_ar, url').eq('lesson_id', lesson.id).order('sort_order'),
        supabase.from('lesson_resources').select('label, url').eq('lesson_id', lesson.id).order('sort_order'),
        supabase.from('assignments').select('title_ar, brief_ar, required_evidence').eq('lesson_id', lesson.id).eq('kind', 'lesson_assignment').maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }];

  const [brief, deliverables] = (assignment?.brief_ar ?? '').split(DELIVERABLES);
  const canEdit = editable(course.review_state as StudioReviewState);
  const back = `/studio/courses/${course.id}`;
  const asLines = (rows: { title_ar?: string; label?: string; url: string }[] | null) =>
    (rows ?? []).map((row) => `${row.title_ar ?? row.label ?? ''} | ${row.url}`).join('\n');

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/studio">{t('الاستوديو', 'Studio')}</Link> / <Link href={back}>{course.title_ar}</Link> / <span>{moduleRow.title_ar}</span>
      </nav>
      <section className="section-block">
        <h2>{isNew ? t('درس جديد', 'New lesson') : lesson?.title_ar}</h2>
        {saved && <p className="notice notice-ok" style={{ marginTop: 10 }}>{t('حُفظ الدرس.', 'Lesson saved.')}</p>}
        {!canEdit && <p className="notice" style={{ marginTop: 10 }}>{t('الدورة مُرسلة للمراجعة أو منشورة، فالدرس للعرض فقط.', 'The course is in review or published, so the lesson is read-only.')}</p>}
      </section>

      <ActionForm action={saveStudioLesson} submitLabel={isNew ? t('أنشئ الدرس', 'Create the lesson') : t('احفظ الدرس', 'Save the lesson')} className="studio-lesson-form">
        <input type="hidden" name="course_id" value={course.id} />
        <input type="hidden" name="module_id" value={moduleRow.id} />
        {lesson && <input type="hidden" name="lesson_id" value={lesson.id} />}

        <fieldset className="panel" disabled={!canEdit}>
          <legend>{t('الدرس', 'The lesson')}</legend>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="title_ar">{t('العنوان', 'Title')}</label>
              <input id="title_ar" name="title_ar" defaultValue={lesson?.title_ar ?? ''} required minLength={3} maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="title_en">{t('العنوان بالإنجليزية (اختياري)', 'English title (optional)')}</label>
              <input id="title_en" name="title_en" dir="ltr" defaultValue={lesson?.title_en ?? ''} maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="kind">{t('النوع', 'Kind')}</label>
              <select id="kind" name="kind" defaultValue={lesson?.kind ?? 'video'}>
                <option value="video">{t('فيديو', 'Video')}</option>
                <option value="live">{t('جلسة مسجّلة/مباشرة', 'Live or recorded session')}</option>
                <option value="article">{t('مقال', 'Article')}</option>
                <option value="reading">{t('قراءة', 'Reading')}</option>
                <option value="exercise">{t('تمرين / مشروع', 'Exercise / project')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="duration_minutes">{t('المدة بالدقائق', 'Length in minutes')}</label>
              <NumberStepper id="duration_minutes" name="duration_minutes" min={1} max={999} defaultValue={lesson?.duration_minutes ?? ''} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="summary_ar">{t('عن الدرس — فقرة قصيرة', 'About the lesson — a short paragraph')}</label>
            <textarea id="summary_ar" name="summary_ar" rows={3} defaultValue={lesson?.summary_ar ?? ''} maxLength={1200} />
          </div>
          <div className="field">
            <label htmlFor="outcomes_ar">{t('ما سيتعلمه الطالب — نقطة في كل سطر', 'What the learner will learn — one per line')}</label>
            <textarea id="outcomes_ar" name="outcomes_ar" rows={5} defaultValue={(lesson?.outcomes_ar ?? []).join('\n')} />
          </div>
        </fieldset>

        <fieldset className="panel" disabled={!canEdit}>
          <legend>{t('الشرح والمصادر', 'Walkthroughs and sources')}</legend>
          <div className="field">
            <label htmlFor="videos">{t('الفيديوهات — «العنوان | الرابط» في كل سطر', 'Videos — «title | link» per line')}</label>
            <textarea id="videos" name="videos" rows={4} dir="auto" defaultValue={asLines(videos)} placeholder="الشرح | https://youtu.be/…" />
          </div>
          <div className="field">
            <label htmlFor="resources">{t('مصادر المراجعة — «الاسم | الرابط» في كل سطر', 'Review sources — «name | link» per line')}</label>
            <textarea id="resources" name="resources" rows={3} dir="auto" defaultValue={asLines(resources)} placeholder="التوثيق الرسمي | https://…" />
          </div>
        </fieldset>

        <fieldset className="panel" disabled={!canEdit}>
          <legend>{t('دراسة حالة (اختياري)', 'Case study (optional)')}</legend>
          <div className="field">
            <label htmlFor="case_study_ar">{t('الموقف', 'The situation')}</label>
            <textarea id="case_study_ar" name="case_study_ar" rows={3} defaultValue={lesson?.case_study_ar ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="case_question_ar">{t('السؤال', 'The question')}</label>
            <input id="case_question_ar" name="case_question_ar" defaultValue={lesson?.case_question_ar ?? ''} maxLength={400} />
          </div>
        </fieldset>

        <fieldset className="panel" disabled={!canEdit}>
          <legend>{t('التكليف العملي', 'The practical assignment')}</legend>
          <div className="field">
            <label htmlFor="assignment_title_ar">{t('عنوان التكليف (اختياري)', 'Assignment title (optional)')}</label>
            <input id="assignment_title_ar" name="assignment_title_ar" defaultValue={assignment?.title_ar ?? ''} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="brief_ar">{t('المطلوب من الطالب — اتركه فارغاً إن لم يكن للدرس تكليف', 'What the learner does — leave empty if the lesson has none')}</label>
            <textarea id="brief_ar" name="brief_ar" rows={6} defaultValue={brief ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="deliverables_ar">{t('المطلوب تسليمه — ملف، تقرير، رابط…', 'What to hand in — a file, a report, a link…')}</label>
            <textarea id="deliverables_ar" name="deliverables_ar" rows={3} defaultValue={deliverables ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="evidence">{t('الرابط المطلوب عند التسليم', 'The link required on hand-in')}</label>
            <select id="evidence" name="evidence" defaultValue={assignment?.required_evidence?.[0] ?? 'drive'}>
              <option value="github">{t('مستودع كود (GitHub)', 'A code repository (GitHub)')}</option>
              <option value="drive">{t('ملفات (Drive)', 'Files (Drive)')}</option>
              <option value="website">{t('موقع منشور', 'A published website')}</option>
              <option value="portfolio">{t('صفحة في معرض أعمال', 'A portfolio page')}</option>
              <option value="">{t('بلا رابط محدد', 'No specific link')}</option>
            </select>
          </div>
        </fieldset>

        <fieldset className="panel" disabled={!canEdit}>
          <legend>{t('تحدٍّ إضافي (اختياري)', 'An extra challenge (optional)')}</legend>
          <div className="field">
            <label htmlFor="challenge_ar" className="sr-only">{t('التحدي', 'The challenge')}</label>
            <textarea id="challenge_ar" name="challenge_ar" rows={3} defaultValue={lesson?.challenge_ar ?? ''} />
          </div>
        </fieldset>
      </ActionForm>

      {lesson && canEdit && (
        <div className="section-block">
          <ActionForm action={deleteStudioLesson} submitLabel={t('احذف الدرس', 'Delete the lesson')} variant="ghost"
                      confirm={t('يُحذف الدرس بفيديوهاته وتكليفه. متأكد؟', 'The lesson is deleted with its videos and assignment. Sure?')}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
          </ActionForm>
        </div>
      )}
    </>
  );
}
