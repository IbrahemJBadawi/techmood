import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { StudioReviewState } from '@/lib/database.types';

import { createStudioCourse, createStudioPath } from './actions';
import { LEVELS, REVIEW_STATE } from './review';

export const generateMetadata = localizedTitle('استوديو المحتوى — TechMood', 'Content studio — TechMood');

/**
 * The mentor's studio (0115): the courses and paths they write, where each
 * stands in review, and the way to start a new one. What is published here
 * appears in the academy under the mentor's name and in the gallery on their
 * profile.
 */
export default async function StudioPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isMentor } = await supabase.rpc('is_mentor');
  if (!isMentor) {
    return (
      <section className="section-block">
        <h2>{t('استوديو المحتوى', 'Content studio')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>
          {t('الاستوديو للمنتورز المعتمدين: يكتبون فيه دورات ومسارات بطريقة TechMood وتُنشر في الأكاديمية بأسمائهم.',
             'The studio is for approved mentors: they write courses and paths the TechMood way, published in the academy under their names.')}
          {' '}<Link href="/settings/roles/mentor">{t('قدّم كمنتور', 'Apply as a mentor')}</Link>
        </p>
      </section>
    );
  }

  const [{ data: courses }, { data: paths }, { data: schools }] = await Promise.all([
    supabase.from('courses').select('id, slug, title_ar, review_state, review_note_ar, status, modules(id, lessons(id))')
      .eq('author_id', user.id).order('title_ar'),
    supabase.from('learning_paths').select('id, slug, title_ar, review_state, status, path_courses(course_id)')
      .eq('author_id', user.id).order('title_ar'),
    supabase.from('schools').select('slug, name_ar').order('sort_order'),
  ]);

  const lessonCount = (row: { modules: unknown }) =>
    ((row.modules as { lessons: unknown[] }[] | null) ?? []).reduce((sum, module) => sum + (module.lessons?.length ?? 0), 0);

  return (
    <>
      <section className="section-block">
        <p className="kicker">{t('للمنتورز', 'For mentors')}</p>
        <h2>{t('استوديو المحتوى', 'Content studio')}</h2>
        <p className="muted" style={{ maxWidth: '70ch', marginTop: 6 }}>
          {t('اكتب دوراتك ومساراتك بطريقة TechMood: وحدات ودروس، ولكل درس فيديوهات وما سيتعلمه الطالب ومصادر ودراسة حالة وتكليف عملي. ترسلها للمراجعة، وحين تُعتمد تظهر في الأكاديمية باسمك وفي معرضك على ملفك.',
             'Write your courses and paths the TechMood way: modules and lessons, each with videos, outcomes, sources, a case study and a practical assignment. Send them for review; once approved they appear in the academy under your name and in the gallery on your profile.')}
        </p>
        <p style={{ marginTop: 10 }}>
          <Link className="btn btn-ghost btn-sm" href={`/mentors/${user.id}`}>{t('معرضي العام', 'My public gallery')}</Link>
        </p>
      </section>

      <div className="detail-grid">
        <section className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('دوراتي', 'My courses')}</h3>
          {(courses ?? []).length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>{t('لا دورات بعد — ابدأ أول دورة من النموذج.', 'No courses yet — start the first one below.')}</p>
          ) : (
            <ul className="studio-list">
              {(courses ?? []).map((course) => {
                const state = REVIEW_STATE[course.review_state as StudioReviewState];
                return (
                  <li key={course.id}>
                    <Link href={`/studio/courses/${course.id}`}>{course.title_ar}</Link>
                    <span className="muted">{t(`${lessonCount(course)} درس`, `${lessonCount(course)} lessons`)}</span>
                    <span className={`status-pill ${state.pill}`}>{t(state.text)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <details className="studio-new" open={(courses ?? []).length === 0}>
            <summary>{t('دورة جديدة', 'New course')}</summary>
            <ActionForm action={createStudioCourse} submitLabel={t('أنشئ الدورة', 'Create the course')} className="stack">
              <div className="field">
                <label htmlFor="c-title">{t('عنوان الدورة', 'Course title')}</label>
                <input id="c-title" name="title_ar" required minLength={4} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="c-title-en">{t('العنوان بالإنجليزية (اختياري، ومنه رابط الدورة)', 'English title (optional; the course link comes from it)')}</label>
                <input id="c-title-en" name="title_en" dir="ltr" maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="c-desc">{t('وصف قصير', 'Short description')}</label>
                <textarea id="c-desc" name="description_ar" rows={3} maxLength={600} />
              </div>
              <div className="field">
                <label htmlFor="c-level">{t('المستوى', 'Level')}</label>
                <select id="c-level" name="level" defaultValue="beginner">
                  {LEVELS.map((level) => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
                </select>
              </div>
            </ActionForm>
          </details>
        </section>

        <aside className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('مساراتي', 'My paths')}</h3>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            {t('المسار يجمع دوراتك — ودورات منشورة في الأكاديمية إن شئت — بترتيب يقود المتعلم.',
               'A path gathers your courses — and published academy courses if you like — in an order that leads the learner.')}
          </p>
          {(paths ?? []).length > 0 && (
            <ul className="studio-list">
              {(paths ?? []).map((path) => {
                const state = REVIEW_STATE[path.review_state as StudioReviewState];
                const count = ((path.path_courses as unknown as unknown[] | null) ?? []).length;
                return (
                  <li key={path.id}>
                    <Link href={`/studio/paths/${path.id}`}>{path.title_ar}</Link>
                    <span className="muted">{t(`${count} دورات`, `${count} courses`)}</span>
                    <span className={`status-pill ${state.pill}`}>{t(state.text)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <details className="studio-new">
            <summary>{t('مسار جديد', 'New path')}</summary>
            <ActionForm action={createStudioPath} submitLabel={t('أنشئ المسار', 'Create the path')} className="stack">
              <div className="field">
                <label htmlFor="p-title">{t('عنوان المسار', 'Path title')}</label>
                <input id="p-title" name="title_ar" required minLength={4} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="p-title-en">{t('العنوان بالإنجليزية (اختياري)', 'English title (optional)')}</label>
                <input id="p-title-en" name="title_en" dir="ltr" maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="p-school">{t('المدرسة', 'School')}</label>
                <select id="p-school" name="school" required defaultValue="">
                  <option value="" disabled>{t('اختر', 'Choose')}</option>
                  {(schools ?? []).map((school) => <option key={school.slug} value={school.slug}>{school.name_ar}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-tagline">{t('جملة تعريفية', 'Tagline')}</label>
                <input id="p-tagline" name="tagline_ar" maxLength={140} />
              </div>
            </ActionForm>
          </details>
        </aside>
      </div>
    </>
  );
}
