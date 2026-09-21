import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';

import { setPathStatus } from './actions';
import { PublishForm } from './PublishForm';

export const metadata = { title: 'Academy content — TechMood' };

/**
 * Where the catalogue is written.
 *
 * 0033 put fifty paths on the map and wrote six of them. This is the screen
 * that turns an outline into a course: pick the course, write its lessons,
 * publish it, and when a path's required courses are all published, publish
 * the path. Nothing here can shortcut that order — the database refuses it.
 */
export default async function AdminAcademyPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const [{ data: courses }, { data: paths }, { data: lessonRows }] = await Promise.all([
    supabase.from('courses').select('id, slug, title_ar, title_en, status').order('status').order('title_ar'),
    supabase.from('learning_paths').select('id, slug, title_ar, title_en, status, sort_order').order('sort_order'),
    supabase.from('lessons').select('id, module_id'),
    ]);

  const { data: modules } = await supabase.from('modules').select('id, course_id');

  // One count per course, done here rather than in as many queries.
  const lessonsPerModule = new Map<string, number>();
  for (const lesson of lessonRows ?? []) {
    lessonsPerModule.set(lesson.module_id, (lessonsPerModule.get(lesson.module_id) ?? 0) + 1);
  }
  const lessonsPerCourse = new Map<string, number>();
  for (const unit of modules ?? []) {
    lessonsPerCourse.set(
      unit.course_id,
      (lessonsPerCourse.get(unit.course_id) ?? 0) + (lessonsPerModule.get(unit.id) ?? 0),
    );
  }

  const drafts = (courses ?? []).filter((course) => course.status !== 'published');
  const live = (courses ?? []).filter((course) => course.status === 'published');
  const announced = (paths ?? []).filter((path) => path.status === 'planned');

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('محتوى الأكاديمية', 'Academy content')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('الخريطة فيها خمسون مساراً، والمكتوب منها ستة. هنا تتحوّل المخططات إلى دورات: اكتب دروس الدورة، انشرها، وحين تُنشر كل دورات المسار الأساسية يمكن نشر المسار. لا يمكن نشر دورة بلا دروس ولا مسار بلا دوراته — القاعدة في قاعدة البيانات لا في هذه الصفحة.',
             'The map holds fifty paths and six are written. This is where an outline becomes a course: write its lessons, publish it, and once a path’s required courses are all published, publish the path. An empty course and a path missing its courses are refused by the database, not by this page.')}
        </p>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">
          {t(`مخططات بانتظار الكتابة (${drafts.length})`, `Outlines waiting to be written (${drafts.length})`)}
        </h3>
        {drafts.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا مخططات — كل الدورات منشورة.', 'No outlines — every course is published.')}</p>
        ) : (
          <ul className="admin-course-list">
            {drafts.map((course) => (
              <li key={course.id}>
                <Link href={`/admin/academy/${course.slug}`}>{contentText(locale, course.title_ar, course.title_en)}</Link>
                <span className="muted eng">{lessonsPerCourse.get(course.id) ?? 0} lessons</span>
                <span className="tag">{t('مسودة', 'Draft')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t(`دورات منشورة (${live.length})`, `Published courses (${live.length})`)}</h3>
        <ul className="admin-course-list">
          {live.map((course) => (
            <li key={course.id}>
              <Link href={`/admin/academy/${course.slug}`}>{contentText(locale, course.title_ar, course.title_en)}</Link>
              <span className="muted eng">{lessonsPerCourse.get(course.id) ?? 0} lessons</span>
              <span className="status-pill status-ok">{t('منشورة', 'Published')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t(`مسارات مُعلَنة (${announced.length})`, `Announced paths (${announced.length})`)}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          {t('المسار يُنشر بعد نشر دوراته الأساسية. المحاولة قبل ذلك تُرفض وتُخبرك بما ينقص.',
             'A path is published once its required courses are. Trying earlier is refused, and the refusal names what is missing.')}
        </p>
        <ul className="admin-course-list">
          {announced.map((path) => (
            <li key={path.id}>
              <Link href={`/academy/${path.slug}`}>{contentText(locale, path.title_ar, path.title_en)}</Link>
              <span className="muted eng">#{path.sort_order}</span>
              <PublishForm
                action={setPathStatus}
                idName="path_id"
                idValue={path.id}
                status={path.status}
                publishedValue="published"
                draftValue="planned"
                revalidate="/admin/academy"
                publishLabel={t('انشر المسار', 'Publish the path')}
                withdrawLabel={t('أعده مُعلَناً', 'Announce again')}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
