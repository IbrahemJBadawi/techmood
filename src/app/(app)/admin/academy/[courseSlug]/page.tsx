import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, type Text } from '@/lib/i18n';
import type { EvidenceKind, Lesson, LessonKind, LessonVideo } from '@/lib/database.types';

import {
  addLesson, addModule, addResource, addVideo, removeResource, removeVideo, saveLesson, setCourseStatus,
} from '../actions';
import { PublishForm } from '../PublishForm';

const KIND_LABEL: Record<LessonKind, Text> = {
  video:    { ar: 'فيديو',       en: 'Video' },
  article:  { ar: 'مقال',        en: 'Article' },
  reading:  { ar: 'قراءة',       en: 'Reading' },
  exercise: { ar: 'تمرين',       en: 'Exercise' },
  live:     { ar: 'جلسة مباشرة', en: 'Live session' },
};

const RESOURCE_KINDS: EvidenceKind[] = ['website', 'youtube', 'github', 'drive', 'file'];

type LessonRow = Pick<Lesson,
  'id' | 'slug' | 'title_ar' | 'title_en' | 'kind' | 'duration_minutes' | 'summary_ar' |
  'outcomes_ar' | 'case_study_ar' | 'case_question_ar' | 'challenge_ar' | 'sort_order'>;

/**
 * Writing one course.
 *
 * The form is the lesson the learner will read, in the same order: what it is,
 * what they will be able to do, what to watch, what to review, the case, the
 * challenge. A field left empty renders no section on the lesson page, so an
 * author can write a lesson in passes without it ever looking broken.
 */
export default async function AdminCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title_ar, title_en, description_ar, status')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title_ar, sort_order, lessons(id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, outcomes_ar, case_study_ar, case_question_ar, challenge_ar, sort_order)')
    .eq('course_id', course.id)
    .order('sort_order');

  const lessonIds = (modules ?? []).flatMap((unit) =>
    ((unit.lessons as unknown as LessonRow[]) ?? []).map((lesson) => lesson.id));

  const safeIds = lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000'];
  const [{ data: videos }, { data: resources }] = await Promise.all([
    supabase.from('lesson_videos').select('id, lesson_id, title_ar, title_en, description_ar, url, duration_minutes, sort_order').in('lesson_id', safeIds).order('sort_order'),
    supabase.from('lesson_resources').select('id, lesson_id, label, url, kind').in('lesson_id', safeIds),
  ]);

  const here = `/admin/academy/${courseSlug}`;
  const totalLessons = lessonIds.length;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/admin/academy">{t('→ كل المحتوى', '← All content')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>{contentText(locale, course.title_ar, course.title_en)}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
              {t(`${totalLessons} درساً`, `${totalLessons} lessons`)}
              {' · '}
              {course.status === 'published' ? t('منشورة', 'Published') : t('مسودة', 'Draft')}
            </p>
          </div>
          <PublishForm
            action={setCourseStatus}
            idName="course_id"
            idValue={course.id}
            status={course.status}
            publishedValue="published"
            draftValue="draft"
            revalidate={here}
            publishLabel={t('انشر الدورة', 'Publish the course')}
            withdrawLabel={t('أعدها مسودة', 'Back to draft')}
          />
        </div>
        {course.description_ar && <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>{course.description_ar}</p>}
      </section>

      {(modules ?? []).length === 0 && (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا وحدات بعد', 'No modules yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('الدورة تبدأ بوحدة، والوحدة تحمل الدروس.', 'A course starts with a module, and a module carries the lessons.')}
          </p>
        </div>
      )}

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('أضف وحدة', 'Add a module')}</h3>
        <form action={addModule} className="admin-inline-form">
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="revalidate" value={here} />
          <input name="title_ar" required placeholder={t('اسم الوحدة', 'Module title')} />
          <button className="btn btn-primary btn-sm" type="submit">{t('أضف', 'Add')}</button>
        </form>
      </section>

      {(modules ?? []).map((unit) => {
        const lessons = ((unit.lessons as unknown as LessonRow[]) ?? [])
          .sort((a, b) => a.sort_order - b.sort_order);

        return (
          <section className="section-block" key={unit.id}>
            <h3 className="academy-heading">{unit.title_ar}</h3>

            {lessons.map((lesson) => {
              const lessonVideos = ((videos ?? []) as LessonVideo[]).filter((video) => video.lesson_id === lesson.id);
              const lessonResources = (resources ?? []).filter((resource) => resource.lesson_id === lesson.id);

              return (
                <details className="panel admin-lesson" key={lesson.id}>
                  <summary>
                    <span>{lesson.title_ar}</span>
                    <span className="muted eng">{lesson.slug}</span>
                  </summary>

                  <form action={saveLesson} className="admin-lesson-form">
                    <input type="hidden" name="lesson_id" value={lesson.id} />
                    <input type="hidden" name="revalidate" value={here} />

                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`title-${lesson.id}`}>{t('العنوان', 'Title')}</label>
                        <input id={`title-${lesson.id}`} name="title_ar" defaultValue={lesson.title_ar} required />
                      </div>
                      <div className="field">
                        <label htmlFor={`title-en-${lesson.id}`}>{t('العنوان بالإنجليزية', 'English title')}</label>
                        <input id={`title-en-${lesson.id}`} name="title_en" defaultValue={lesson.title_en ?? ''} />
                      </div>
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`kind-${lesson.id}`}>{t('النوع', 'Kind')}</label>
                        <select id={`kind-${lesson.id}`} name="kind" defaultValue={lesson.kind}>
                          {(Object.keys(KIND_LABEL) as LessonKind[]).map((kind) => (
                            <option value={kind} key={kind}>{t(KIND_LABEL[kind])}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`duration-${lesson.id}`}>{t('المدة بالدقائق', 'Minutes')}</label>
                        <input id={`duration-${lesson.id}`} name="duration_minutes" type="number" min={0} max={600} defaultValue={lesson.duration_minutes ?? ''} />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor={`summary-${lesson.id}`}>{t('الملخص', 'Summary')}</label>
                      <textarea id={`summary-${lesson.id}`} name="summary_ar" rows={2} defaultValue={lesson.summary_ar ?? ''} />
                    </div>

                    <div className="field">
                      <label htmlFor={`outcomes-${lesson.id}`}>{t('ما سيتعلمه الطالب — سطر لكل نقطة', 'What the learner will be able to do — one per line')}</label>
                      <textarea id={`outcomes-${lesson.id}`} name="outcomes_ar" rows={4} defaultValue={lesson.outcomes_ar.join('\n')} />
                    </div>

                    <div className="field">
                      <label htmlFor={`case-${lesson.id}`}>{t('دراسة الحالة', 'Case study')}</label>
                      <textarea id={`case-${lesson.id}`} name="case_study_ar" rows={3} defaultValue={lesson.case_study_ar ?? ''} />
                    </div>

                    <div className="field">
                      <label htmlFor={`case-q-${lesson.id}`}>{t('سؤال دراسة الحالة', 'The question to answer')}</label>
                      <input id={`case-q-${lesson.id}`} name="case_question_ar" defaultValue={lesson.case_question_ar ?? ''} />
                    </div>

                    <div className="field">
                      <label htmlFor={`challenge-${lesson.id}`}>{t('التحدي الإضافي', 'The extra challenge')}</label>
                      <textarea id={`challenge-${lesson.id}`} name="challenge_ar" rows={2} defaultValue={lesson.challenge_ar ?? ''} />
                    </div>

                    <button className="btn btn-primary btn-sm" type="submit">{t('احفظ الدرس', 'Save the lesson')}</button>
                  </form>

                  <div className="admin-sub">
                    <h4>{t('الفيديوهات', 'Videos')}</h4>
                    {lessonVideos.length === 0
                      ? <p className="muted" style={{ fontSize: '0.8rem' }}>{t('لا فيديوهات بعد — لن يظهر القسم للطالب.', 'No videos yet — the learner sees no video section.')}</p>
                      : (
                        <ul className="admin-mini-list">
                          {lessonVideos.map((video) => (
                            <li key={video.id}>
                              <span>{video.title_ar}</span>
                              <a className="eng" href={video.url} target="_blank" rel="noreferrer">{video.url}</a>
                              <form action={removeVideo}>
                                <input type="hidden" name="video_id" value={video.id} />
                                <input type="hidden" name="revalidate" value={here} />
                                <button className="link-button" type="submit">{t('احذف', 'Remove')}</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    <form action={addVideo} className="admin-inline-form">
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <input type="hidden" name="revalidate" value={here} />
                      <input name="title_ar" required placeholder={t('عنوان الفيديو', 'Video title')} />
                      <input name="url" type="url" required placeholder="https://…" />
                      <input name="duration_minutes" type="number" min={0} max={600} placeholder={t('دقائق', 'Minutes')} />
                      <button className="btn btn-ghost btn-sm" type="submit">{t('أضف فيديو', 'Add video')}</button>
                    </form>
                  </div>

                  <div className="admin-sub">
                    <h4>{t('مصادر المراجعة', 'Review material')}</h4>
                    {lessonResources.length > 0 && (
                      <ul className="admin-mini-list">
                        {lessonResources.map((resource) => (
                          <li key={resource.id}>
                            <span>{resource.label}</span>
                            <a className="eng" href={resource.url} target="_blank" rel="noreferrer">{resource.url}</a>
                            <form action={removeResource}>
                              <input type="hidden" name="resource_id" value={resource.id} />
                              <input type="hidden" name="revalidate" value={here} />
                              <button className="link-button" type="submit">{t('احذف', 'Remove')}</button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={addResource} className="admin-inline-form">
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <input type="hidden" name="revalidate" value={here} />
                      <input name="label" required placeholder={t('اسم المصدر', 'Resource label')} />
                      <input name="url" type="url" required placeholder="https://…" />
                      <select name="kind" defaultValue="website" aria-label={t('نوع المصدر', 'Resource kind')}>
                        {RESOURCE_KINDS.map((kind) => <option value={kind} key={kind}>{kind}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" type="submit">{t('أضف مصدراً', 'Add resource')}</button>
                    </form>
                  </div>
                </details>
              );
            })}

            <form action={addLesson} className="admin-inline-form panel">
              <input type="hidden" name="module_id" value={unit.id} />
              <input type="hidden" name="revalidate" value={here} />
              <input name="title_ar" required placeholder={t('عنوان الدرس الجديد', 'New lesson title')} />
              <select name="kind" defaultValue="video" aria-label={t('النوع', 'Kind')}>
                {(Object.keys(KIND_LABEL) as LessonKind[]).map((kind) => (
                  <option value={kind} key={kind}>{t(KIND_LABEL[kind])}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" type="submit">{t('أضف درساً', 'Add lesson')}</button>
            </form>
          </section>
        );
      })}
    </>
  );
}
