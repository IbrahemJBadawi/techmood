import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { formatDateTime } from '@/lib/i18n';
import { getLocale, getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';

import { reviewStudioItem } from '../../studio/actions';

export const generateMetadata = localizedTitle('مراجعة محتوى المنتورز — إدارة TechMood', 'Mentor content review — TechMood admin');

/**
 * What mentors sent from the studio (0115). Approving a course publishes it
 * with its lessons and work; approving a path announces it, and it opens once
 * one of its courses is ready. Asking for changes says what to change — the
 * mentor reads the note on their studio page.
 */
export default async function AdminStudioPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) notFound();

  const [{ data: courses }, { data: paths }] = await Promise.all([
    supabase.from('courses')
      .select('id, slug, title_ar, description_ar, submitted_at, author_id, modules(id, lessons(id)), path_courses(learning_paths(slug))')
      .eq('review_state', 'submitted').order('submitted_at'),
    supabase.from('learning_paths')
      .select('id, slug, title_ar, description_ar, submitted_at, author_id, path_courses(courses(title_ar, status))')
      .eq('review_state', 'submitted').order('submitted_at'),
  ]);

  const authorIds = [...new Set([...(courses ?? []), ...(paths ?? [])].map((row) => row.author_id).filter(Boolean))] as string[];
  const { data: authors } = await supabase.from('profiles').select('id, full_name')
    .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);
  const nameOf = new Map((authors ?? []).map((row) => [row.id, row.full_name]));

  const decision = (kind: 'course' | 'path', id: string) => (
    <ActionForm action={reviewStudioItem} submitLabel={t('نفّذ القرار', 'Record the decision')} className="stack" >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`d-${id}`}>{t('القرار', 'Decision')}</label>
          <select id={`d-${id}`} name="decision" defaultValue="approve">
            <option value="approve">{t('اعتماد ونشر', 'Approve and publish')}</option>
            <option value="changes">{t('إعادة للمنتور بملاحظات', 'Return to the mentor with notes')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`n-${id}`}>{t('ملاحظة للمنتور', 'Note to the mentor')}</label>
          <textarea id={`n-${id}`} name="note" rows={2} placeholder={t('مطلوبة عند الإعادة', 'Required when returning')} />
        </div>
      </div>
    </ActionForm>
  );

  const empty = (courses ?? []).length === 0 && (paths ?? []).length === 0;

  return (
    <>
      <section className="section-block">
        <h2>{t('مراجعة محتوى المنتورز', 'Mentor content review')}</h2>
        <p className="muted" style={{ marginTop: 6, maxWidth: '70ch' }}>
          {t('ما أرسله المنتورز من الاستوديو. افتح المعاينة، ثم اعتمد أو أعد بملاحظة واضحة.',
             'What mentors sent from the studio. Open the preview, then approve or return it with a clear note.')}
        </p>
      </section>

      {empty && <p className="notice">{t('لا شيء بانتظار المراجعة الآن.', 'Nothing is waiting for review.')}</p>}

      {(courses ?? []).map((course) => {
        const lessons = ((course.modules as unknown as { lessons: unknown[] }[] | null) ?? []).reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0);
        const pathSlug = ((course.path_courses as unknown as { learning_paths: { slug: string } | null }[] | null) ?? [])[0]?.learning_paths?.slug ?? 'preview';
        return (
          <article className="panel section-block" key={course.id}>
            <p className="kicker">{t('دورة', 'Course')} · {nameOf.get(course.author_id ?? '') ?? '—'}</p>
            <h3 style={{ fontSize: '1rem' }}>{course.title_ar}</h3>
            <p className="muted" style={{ fontSize: '0.82rem', margin: '4px 0 8px' }}>
              {t(`${lessons} درس`, `${lessons} lessons`)}
              {course.submitted_at && <> · {formatDateTime(locale, course.submitted_at)}</>}
            </p>
            {course.description_ar && <p style={{ fontSize: '0.88rem' }}>{course.description_ar}</p>}
            <p style={{ margin: '8px 0 12px' }}>
              <Link className="btn btn-ghost btn-sm" href={`/academy/${pathSlug}/${course.slug}`}>{t('افتح المعاينة', 'Open the preview')}</Link>
            </p>
            {decision('course', course.id)}
          </article>
        );
      })}

      {(paths ?? []).map((path) => {
        const courseRows = ((path.path_courses as unknown as { courses: { title_ar: string; status: string } | null }[] | null) ?? [])
          .map((row) => row.courses).filter(Boolean) as { title_ar: string; status: string }[];
        return (
          <article className="panel section-block" key={path.id}>
            <p className="kicker">{t('مسار', 'Path')} · {nameOf.get(path.author_id ?? '') ?? '—'}</p>
            <h3 style={{ fontSize: '1rem' }}>{path.title_ar}</h3>
            {path.description_ar && <p style={{ fontSize: '0.88rem', marginTop: 6 }}>{path.description_ar}</p>}
            <ul style={{ margin: '8px 0 12px', fontSize: '0.86rem' }}>
              {courseRows.map((course) => (
                <li key={course.title_ar}>{course.title_ar} <span className="muted">({course.status === 'published' ? t('منشورة', 'published') : t('غير منشورة بعد', 'not published yet')})</span></li>
              ))}
            </ul>
            <p style={{ margin: '0 0 12px' }}>
              <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}`}>{t('افتح المعاينة', 'Open the preview')}</Link>
            </p>
            {decision('path', path.id)}
          </article>
        );
      })}
    </>
  );
}
