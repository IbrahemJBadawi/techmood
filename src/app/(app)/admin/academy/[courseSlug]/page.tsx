import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, type Text } from '@/lib/i18n';
import type { ContentStatus, EvidenceKind, Lesson, LessonKind, LessonVideo } from '@/lib/database.types';
import { ActionForm } from '@/components/ActionForm';

import {
  addLesson, addModule, addResource, addVideo, linkCourse, removeResource, removeVideo, saveAssignment,
  saveCourseDetails, saveCredentialSlot, saveLesson, setCourseStatusTo, setLessonStatus, unlinkCourse,
} from '../actions';
import { STATUS_LABEL, STATUS_ORDER, STATUS_PILL, STATUS_SHORT } from '../status';

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
  'outcomes_ar' | 'case_study_ar' | 'case_question_ar' | 'challenge_ar' | 'sort_order' | 'status'>;

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
    .select('id, slug, title_ar, title_en, description_ar, status, estimated_hours')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title_ar, sort_order, lessons(id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, outcomes_ar, case_study_ar, case_question_ar, challenge_ar, sort_order, status)')
    .eq('course_id', course.id)
    .order('sort_order');

  const lessonIds = (modules ?? []).flatMap((unit) =>
    ((unit.lessons as unknown as LessonRow[]) ?? []).map((lesson) => lesson.id));

  const safeIds = lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000'];
  const [
    { data: videos }, { data: resources }, { data: credentials }, { data: providers },
    { data: memberships }, { data: allPaths }, { data: assignments },
  ] = await Promise.all([
    supabase.from('lesson_videos').select('id, lesson_id, title_ar, title_en, description_ar, url, duration_minutes, sort_order').in('lesson_id', safeIds).order('sort_order'),
    supabase.from('lesson_resources').select('id, lesson_id, label, url, kind').in('lesson_id', safeIds),
    supabase.from('lesson_credentials').select('lesson_id, provider_id, credential_name, credential_url, requires_application, note_ar').in('lesson_id', safeIds),
    supabase.from('credential_providers').select('id, name, is_active').order('sort_order'),
    supabase.from('path_courses').select('path_id, is_required, sort_order').eq('course_id', course.id),
    supabase.from('learning_paths').select('id, slug, title_ar, title_en, status').order('sort_order'),
    supabase.from('assignments').select('id, kind, lesson_id, course_id, title_ar, brief_ar, is_required, status')
      .or(`course_id.eq.${course.id},lesson_id.in.(${safeIds.join(',')})`),
  ]);

  const credentialOf = new Map((credentials ?? []).map((row) => [row.lesson_id, row]));
  const pathById = new Map((allPaths ?? []).map((path) => [path.id, path]));
  const statusSelect = (value: ContentStatus) => (
    <select name="status" defaultValue={value} aria-label={t('الحالة', 'Status')}>
      {STATUS_ORDER.map((status) => <option key={status} value={status}>{t(STATUS_LABEL[status])}</option>)}
    </select>
  );
  const assignmentForm = (assignment: NonNullable<typeof assignments>[number]) => (
    <ActionForm action={saveAssignment} className="admin-lesson-form" key={assignment.id} submitLabel={t('احفظ المشروع', 'Save the project')}>
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="revalidate" value={here} />
      <div className="field-row">
        <div className="field">
          <label htmlFor={`at-${assignment.id}`}>{t('العنوان', 'Title')}</label>
          <input id={`at-${assignment.id}`} name="title_ar" defaultValue={assignment.title_ar} required />
        </div>
        <div className="field">
          <label htmlFor={`as-${assignment.id}`}>{t('الحالة', 'Status')}</label>
          {statusSelect(assignment.status)}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`ab-${assignment.id}`}>{t('المطلوب', 'The brief')}</label>
        <textarea id={`ab-${assignment.id}`} name="brief_ar" rows={2} defaultValue={assignment.brief_ar ?? ''} />
      </div>
      <label className="switch-row"><input type="checkbox" name="is_required" defaultChecked={assignment.is_required} />{t('مطلوب لإكمال الدرس/الدورة', 'Required to complete the lesson/course')}</label>
    </ActionForm>
  );

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
              <span className={`status-pill ${STATUS_PILL[course.status]}`}>{t(STATUS_SHORT[course.status])}</span>
            </p>
          </div>
          <ActionForm action={setCourseStatusTo} className="admin-inline-form" submitLabel={t('طبّق', 'Apply')}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="revalidate" value={here} />
            {statusSelect(course.status)}
          </ActionForm>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ fontSize: '0.86rem' }}>{t('تعديل تفاصيل الدورة', 'Edit the course details')}</summary>
          <ActionForm action={saveCourseDetails} className="admin-lesson-form" submitLabel={t('احفظ', 'Save')}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="revalidate" value={here} />
            <div className="field-row">
              <div className="field">
                <label htmlFor="course-title">{t('الاسم', 'Title')}</label>
                <input id="course-title" name="title_ar" defaultValue={course.title_ar} required />
              </div>
              <div className="field">
                <label htmlFor="course-title-en">{t('الاسم بالإنجليزية', 'English title')}</label>
                <input id="course-title-en" name="title_en" defaultValue={course.title_en ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="course-hours">{t('الساعات', 'Hours')}</label>
                <input id="course-hours" name="estimated_hours" type="number" min={1} max={500} defaultValue={course.estimated_hours ?? ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="course-desc">{t('الوصف', 'Description')}</label>
              <textarea id="course-desc" name="description_ar" rows={3} defaultValue={course.description_ar ?? ''} />
            </div>
          </ActionForm>
        </details>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('المسارات التي تضم الدورة', 'Paths this course is in')}</h3>
        <ul className="admin-mini-list">
          {(memberships ?? []).map((membership) => {
            const path = pathById.get(membership.path_id);
            if (!path) return null;
            return (
              <li key={membership.path_id}>
                <span>{contentText(locale, path.title_ar, path.title_en)}</span>
                <span className={`status-pill ${STATUS_PILL[path.status]}`}>{t(STATUS_SHORT[path.status])}</span>
                <ActionForm action={linkCourse} className="admin-inline-form" variant="ghost" submitLabel={t('احفظ', 'Save')}>
                  <input type="hidden" name="path_id" value={membership.path_id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <input type="hidden" name="revalidate" value={here} />
                  <input name="sort_order" type="number" min={0} defaultValue={membership.sort_order} style={{ width: 70 }} aria-label={t('الترتيب', 'Order')} />
                  <label className="switch-row"><input type="checkbox" name="is_required" defaultChecked={membership.is_required} />{t('أساسية', 'Required')}</label>
                </ActionForm>
                <ActionForm action={unlinkCourse} variant="ghost" submitLabel={t('أزل', 'Remove')}>
                  <input type="hidden" name="path_id" value={membership.path_id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <input type="hidden" name="revalidate" value={here} />
                </ActionForm>
              </li>
            );
          })}
        </ul>
        <ActionForm action={linkCourse} className="admin-inline-form" variant="ghost" submitLabel={t('أضف لمسار', 'Add to a path')}>
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="revalidate" value={here} />
          <select name="path_id" required defaultValue="" aria-label={t('المسار', 'Path')}>
            <option value="" disabled>{t('— اختر مساراً —', '— Choose a path —')}</option>
            {(allPaths ?? []).filter((path) => !(memberships ?? []).some((membership) => membership.path_id === path.id)).map((path) => (
              <option key={path.id} value={path.id}>{contentText(locale, path.title_ar, path.title_en)}</option>
            ))}
          </select>
          <label className="switch-row"><input type="checkbox" name="is_required" defaultChecked />{t('أساسية', 'Required')}</label>
        </ActionForm>
      </section>

      {(assignments ?? []).filter((assignment) => assignment.course_id === course.id).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem' }}>{t('مشاريع الدورة', 'The course’s projects')}</h3>
          {(assignments ?? []).filter((assignment) => assignment.course_id === course.id).map(assignmentForm)}
        </section>
      )}

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
                    <span className={`status-pill ${STATUS_PILL[lesson.status]}`}>{t(STATUS_SHORT[lesson.status])}</span>
                    {credentialOf.has(lesson.id) && <span className="tag">{t('بشهادة خارجية', 'External credential')}</span>}
                  </summary>

                  <ActionForm action={setLessonStatus} className="admin-inline-form" submitLabel={t('طبّق', 'Apply')}>
                    <input type="hidden" name="lesson_id" value={lesson.id} />
                    <input type="hidden" name="revalidate" value={here} />
                    {statusSelect(lesson.status)}
                  </ActionForm>

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
                    <h4>{t('شهادة خارجية', 'External credential')}</h4>
                    <p className="muted" style={{ fontSize: '0.8rem' }}>
                      {t('درس يُنجز بشهادة من جهة أخرى (Anthropic، Google، IBM…) تُراجع قبل احتسابه، ومعها تطبيق عملي هنا إن اخترت ذلك.',
                         'A lesson earned with another organisation’s credential (Anthropic, Google, IBM…), checked before it counts — plus practice here if you choose.')}
                    </p>
                    <ActionForm action={saveCredentialSlot} className="admin-lesson-form" variant="ghost" submitLabel={credentialOf.has(lesson.id) ? t('احفظ الشهادة', 'Save the credential') : t('اجعله درساً بشهادة', 'Make it a credential lesson')}>
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <input type="hidden" name="revalidate" value={here} />
                      <div className="field-row">
                        <div className="field">
                          <label htmlFor={`cp-${lesson.id}`}>{t('الجهة', 'Provider')}</label>
                          <select id={`cp-${lesson.id}`} name="provider_id" required defaultValue={credentialOf.get(lesson.id)?.provider_id ?? ''}>
                            <option value="" disabled>—</option>
                            {(providers ?? []).filter((provider) => provider.is_active).map((provider) => (
                              <option key={provider.id} value={provider.id}>{provider.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`cn-${lesson.id}`}>{t('اسم الشهادة كما تصدرها الجهة', 'Credential name as the provider issues it')}</label>
                          <input id={`cn-${lesson.id}`} name="credential_name" defaultValue={credentialOf.get(lesson.id)?.credential_name ?? ''} />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor={`cu-${lesson.id}`}>{t('رابطها الرسمي', 'Its official page')}</label>
                        <input id={`cu-${lesson.id}`} name="credential_url" type="url" pattern="https://.*" placeholder="https://…" defaultValue={credentialOf.get(lesson.id)?.credential_url ?? ''} />
                      </div>
                      <label className="switch-row">
                        <input type="checkbox" name="requires_application" defaultChecked={credentialOf.get(lesson.id)?.requires_application ?? true} />
                        {t('يحتاج تطبيقاً عملياً داخل تكمود أيضاً', 'Also needs practice inside TechMood')}
                      </label>
                      <input name="note_ar" placeholder={t('ملاحظة للطالب (اختياري)', 'A note for the learner (optional)')} defaultValue={credentialOf.get(lesson.id)?.note_ar ?? ''} />
                    </ActionForm>
                    {credentialOf.has(lesson.id) && (
                      <ActionForm action={saveCredentialSlot} variant="ghost" submitLabel={t('ألغِ ربطه بشهادة', 'Stop requiring a credential')}>
                        <input type="hidden" name="lesson_id" value={lesson.id} />
                        <input type="hidden" name="remove" value="yes" />
                        <input type="hidden" name="revalidate" value={here} />
                      </ActionForm>
                    )}
                  </div>

                  {(assignments ?? []).filter((assignment) => assignment.lesson_id === lesson.id).length > 0 && (
                    <div className="admin-sub">
                      <h4>{t('تطبيق الدرس', 'The lesson’s practice')}</h4>
                      {(assignments ?? []).filter((assignment) => assignment.lesson_id === lesson.id).map(assignmentForm)}
                    </div>
                  )}

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
