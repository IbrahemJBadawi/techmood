import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { StudioReviewState } from '@/lib/database.types';

import {
  addStudioModule, deleteStudioCourse, deleteStudioModule, moveStudioItem, renameStudioModule,
  saveStudioCourse, submitStudioItem, withdrawStudioItem,
} from '../../actions';
import { LEVELS, REVIEW_STATE, editable } from '../../review';
import { NumberStepper } from '@/components/NumberStepper';

export const generateMetadata = localizedTitle('تحرير دورة — استوديو TechMood', 'Edit a course — TechMood studio');

type StudioLesson = { id: string; title_ar: string; kind: string; sort_order: number; assignments: { id: string }[] | null; lesson_videos: { id: string }[] | null };
type StudioModule = { id: string; title_ar: string; sort_order: number; lessons: StudioLesson[] | null };

/** One course in the studio: its details, its modules and lessons, and review. */
export default async function StudioCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title_ar, title_en, description_ar, level, estimated_hours, status, author_id, review_state, review_note_ar')
    .eq('id', courseId)
    .maybeSingle();
  if (!course || course.author_id !== user.id) notFound();

  const [{ data: modules }, { data: paths }] = await Promise.all([
    supabase.from('modules')
      .select('id, title_ar, sort_order, lessons(id, title_ar, kind, sort_order, assignments(id), lesson_videos(id))')
      .eq('course_id', course.id).order('sort_order'),
    supabase.from('path_courses').select('learning_paths(slug, title_ar)').eq('course_id', course.id),
  ]);

  const state = course.review_state as StudioReviewState;
  const canEdit = editable(state);
  const label = REVIEW_STATE[state];
  const ordered = ((modules ?? []) as unknown as StudioModule[]).map((module) => ({
    ...module,
    lessons: [...(module.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const lessonTotal = ordered.reduce((sum, module) => sum + module.lessons.length, 0);
  const firstPath = ((paths ?? []) as unknown as { learning_paths: { slug: string } | null }[])[0]?.learning_paths?.slug;
  const previewHref = `/academy/${firstPath ?? 'preview'}/${course.slug}`;
  const here = `/studio/courses/${course.id}`;

  const move = (kind: 'module' | 'lesson', id: string, direction: 'up' | 'down', labelText: string) => (
    <form action={moveStudioItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="course_id" value={course.id} />
      <button className="icon-btn" type="submit" aria-label={labelText}>{direction === 'up' ? '↑' : '↓'}</button>
    </form>
  );

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/studio">{t('الاستوديو', 'Studio')}</Link> / <span>{course.title_ar}</span>
      </nav>

      <section className="section-block">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>{course.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
              <span className={`status-pill ${label.pill}`}>{t(label.text)}</span>
              {' · '}{t(`${ordered.length} وحدة · ${lessonTotal} درس`, `${ordered.length} modules · ${lessonTotal} lessons`)}
            </p>
          </div>
          <div className="tags-row">
            <Link className="btn btn-ghost btn-sm" href={previewHref}>{t('معاينة كما يراها الطالب', 'Preview as a learner')}</Link>
            {state === 'approved' && firstPath && (
              <Link className="btn btn-ghost btn-sm" href={`/academy/${firstPath}/${course.slug}`}>{t('في الأكاديمية', 'In the academy')}</Link>
            )}
          </div>
        </div>

        {state === 'changes_requested' && course.review_note_ar && (
          <p className="notice notice-danger lesson-text" style={{ marginTop: 12 }}>
            <strong>{t('ملاحظة المراجعة: ', 'Review note: ')}</strong>{course.review_note_ar}
          </p>
        )}
        {state === 'submitted' && (
          <div className="notice" style={{ marginTop: 12 }}>
            {t('الدورة بانتظار المراجعة ولا تُعدَّل الآن. يصلك إشعار بالقرار.', 'The course is in review and cannot be edited now. You will be notified of the decision.')}
            <ActionForm action={withdrawStudioItem} submitLabel={t('اسحبها لأعدّل', 'Withdraw to edit')} variant="ghost" className="inline-form">
              <input type="hidden" name="kind" value="course" />
              <input type="hidden" name="id" value={course.id} />
            </ActionForm>
          </div>
        )}
        {state === 'approved' && (
          <p className="notice notice-ok" style={{ marginTop: 12 }}>
            {t('الدورة منشورة في الأكاديمية باسمك. المتعلمون يدرسونها الآن، فلا تُعدَّل في مكانها — للتعديل تواصل مع الإدارة.',
               'The course is published in the academy under your name. Learners are studying it, so it is not edited in place — contact the team to change it.')}
          </p>
        )}
        {!firstPath && (
          <p className="notice notice-warn" style={{ marginTop: 12 }}>
            {t('لكي تظهر الدورة في الأكاديمية ضعها في مسار من مساراتك.', 'For the course to appear in the academy, put it in one of your paths.')}
            {' '}<Link href="/studio">{t('المسارات', 'Paths')}</Link>
          </p>
        )}
      </section>

      {canEdit && (
        <details className="panel section-block studio-details">
          <summary>{t('بيانات الدورة', 'Course details')}</summary>
          <ActionForm action={saveStudioCourse} submitLabel={t('احفظ', 'Save')} className="stack">
            <input type="hidden" name="course_id" value={course.id} />
            <div className="field">
              <label htmlFor="title_ar">{t('العنوان', 'Title')}</label>
              <input id="title_ar" name="title_ar" defaultValue={course.title_ar} required minLength={4} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="title_en">{t('العنوان بالإنجليزية', 'English title')}</label>
              <input id="title_en" name="title_en" dir="ltr" defaultValue={course.title_en ?? ''} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="description_ar">{t('الوصف', 'Description')}</label>
              <textarea id="description_ar" name="description_ar" rows={4} defaultValue={course.description_ar ?? ''} maxLength={1200} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="level">{t('المستوى', 'Level')}</label>
                <select id="level" name="level" defaultValue={course.level}>
                  {LEVELS.map((level) => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="estimated_hours">{t('الساعات التقديرية', 'Estimated hours')}</label>
                <NumberStepper id="estimated_hours" name="estimated_hours" min={1} max={500} defaultValue={course.estimated_hours ?? ''} />
              </div>
            </div>
          </ActionForm>
        </details>
      )}

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('الوحدات والدروس', 'Modules and lessons')}</h3>
        {ordered.length === 0 && (
          <p className="muted">{t('ابدأ بوحدة، ثم أضف دروسها.', 'Start with a module, then add its lessons.')}</p>
        )}
        {ordered.map((module, moduleIndex) => (
          <article className="panel studio-module" key={module.id}>
            <div className="studio-module-head">
              <span className="ac-module-n">{moduleIndex + 1}</span>
              {canEdit ? (
                <ActionForm action={renameStudioModule} submitLabel={t('احفظ الاسم', 'Save name')} variant="ghost" className="inline-form grow">
                  <input type="hidden" name="module_id" value={module.id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <input name="title_ar" defaultValue={module.title_ar} aria-label={t('اسم الوحدة', 'Module name')} required minLength={2} maxLength={120} />
                </ActionForm>
              ) : (
                <strong>{module.title_ar}</strong>
              )}
              {canEdit && (
                <div className="studio-row-tools">
                  {moduleIndex > 0 && move('module', module.id, 'up', t('انقل الوحدة للأعلى', 'Move module up'))}
                  {moduleIndex < ordered.length - 1 && move('module', module.id, 'down', t('انقل الوحدة للأسفل', 'Move module down'))}
                  <ActionForm action={deleteStudioModule} submitLabel={t('احذف', 'Delete')} variant="ghost" className="inline-form"
                              confirm={t('تُحذف الوحدة بكل دروسها. متأكد؟', 'The module is deleted with all its lessons. Sure?')}>
                    <input type="hidden" name="module_id" value={module.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                  </ActionForm>
                </div>
              )}
            </div>

            <ol className="studio-lessons">
              {module.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.id}>
                  <Link href={`${here}/lessons/${lesson.id}`}>{lesson.title_ar}</Link>
                  <span className="muted">
                    {t(`${lesson.lesson_videos?.length ?? 0} فيديو`, `${lesson.lesson_videos?.length ?? 0} videos`)}
                    {' · '}
                    {(lesson.assignments?.length ?? 0) > 0 ? t('فيه تكليف', 'has an assignment') : t('بلا تكليف', 'no assignment')}
                  </span>
                  {canEdit && (
                    <span className="studio-row-tools">
                      {lessonIndex > 0 && move('lesson', lesson.id, 'up', t('انقل الدرس للأعلى', 'Move lesson up'))}
                      {lessonIndex < module.lessons.length - 1 && move('lesson', lesson.id, 'down', t('انقل الدرس للأسفل', 'Move lesson down'))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {canEdit && (
              <Link className="btn btn-ghost btn-sm" href={`${here}/lessons/new?module=${module.id}`}>+ {t('درس في هذه الوحدة', 'A lesson in this module')}</Link>
            )}
          </article>
        ))}

        {canEdit && (
          <ActionForm action={addStudioModule} submitLabel={t('أضف وحدة', 'Add a module')} className="inline-form studio-add-module">
            <input type="hidden" name="course_id" value={course.id} />
            <input name="title_ar" placeholder={t('اسم الوحدة الجديدة', 'New module name')} aria-label={t('اسم الوحدة الجديدة', 'New module name')} required minLength={2} maxLength={120} />
          </ActionForm>
        )}
      </section>

      {canEdit && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('جاهزة؟', 'Ready?')}</h3>
          <p className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 12px' }}>
            {t('راجع الدورة في المعاينة، ثم أرسلها. تراجعها الإدارة وتنشرها باسمك، أو تعيدها لك بملاحظات.',
               'Check the course in the preview, then send it. The team reviews it and publishes it under your name, or returns it with notes.')}
          </p>
          <div className="tags-row">
            <ActionForm action={submitStudioItem} submitLabel={t('أرسل للمراجعة', 'Send for review')}>
              <input type="hidden" name="kind" value="course" />
              <input type="hidden" name="id" value={course.id} />
            </ActionForm>
            <ActionForm action={deleteStudioCourse} submitLabel={t('احذف الدورة', 'Delete the course')} variant="ghost"
                        confirm={t('تُحذف الدورة بكل وحداتها ودروسها. متأكد؟', 'The course is deleted with all its modules and lessons. Sure?')}>
              <input type="hidden" name="course_id" value={course.id} />
            </ActionForm>
          </div>
        </section>
      )}
    </>
  );
}
