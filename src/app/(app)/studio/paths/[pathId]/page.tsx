import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { StudioReviewState } from '@/lib/database.types';

import {
  deleteStudioPath, saveStudioPath, saveStudioPathCourses, submitStudioItem, withdrawStudioItem,
} from '../../actions';
import { REVIEW_STATE, editable } from '../../review';

export const generateMetadata = localizedTitle('تحرير مسار — استوديو TechMood', 'Edit a path — TechMood studio');

type CourseOption = { id: string; title_ar: string; status: string; author_id: string | null };

/** One path in the studio: what it is, which courses in which order, and review. */
export default async function StudioPathPage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: path } = await supabase.from('learning_paths')
    .select('id, slug, title_ar, title_en, tagline_ar, description_ar, tags, status, author_id, review_state, review_note_ar, schools(slug)')
    .eq('id', pathId).maybeSingle();
  if (!path || path.author_id !== user.id) notFound();

  const [{ data: linked }, { data: mine }, { data: published }, { data: schools }] = await Promise.all([
    supabase.from('path_courses').select('course_id, is_required, sort_order').eq('path_id', path.id).order('sort_order'),
    supabase.from('courses').select('id, title_ar, status, author_id').eq('author_id', user.id).order('title_ar'),
    supabase.from('courses').select('id, title_ar, status, author_id').eq('status', 'published').is('author_id', null).order('title_ar'),
    supabase.from('schools').select('slug, name_ar').order('sort_order'),
  ]);

  const state = path.review_state as StudioReviewState;
  const canEdit = editable(state);
  const label = REVIEW_STATE[state];
  const link = new Map((linked ?? []).map((row) => [row.course_id, row]));
  const school = (path.schools as unknown as { slug: string } | null)?.slug ?? '';

  const row = (course: CourseOption) => {
    const current = link.get(course.id);
    return (
      <li key={course.id}>
        <input type="checkbox" name="course" value={course.id} defaultChecked={Boolean(current)} aria-label={course.title_ar} />
        <span>
          {course.title_ar}
          {course.author_id === user.id && course.status !== 'published' && (
            <span className="muted" style={{ fontSize: '0.74rem' }}> · {t('تُفتح حين تُعتمد', 'opens once approved')}</span>
          )}
        </span>
        <input type="number" name={`order_${course.id}`} min={1} max={99} defaultValue={current?.sort_order ?? ''}
               aria-label={t('الترتيب', 'Order')} placeholder="#" />
        <label><input type="checkbox" name={`optional_${course.id}`} defaultChecked={current ? !current.is_required : false} /> {t('اختيارية', 'Optional')}</label>
      </li>
    );
  };

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/studio">{t('الاستوديو', 'Studio')}</Link> / <span>{path.title_ar}</span>
      </nav>

      <section className="section-block">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>{path.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
              <span className={`status-pill ${label.pill}`}>{t(label.text)}</span>
              {' · '}{t(`${(linked ?? []).length} دورات`, `${(linked ?? []).length} courses`)}
            </p>
          </div>
          {path.status !== 'draft' && (
            <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}`}>{t('في الأكاديمية', 'In the academy')}</Link>
          )}
        </div>
        {state === 'changes_requested' && path.review_note_ar && (
          <p className="notice notice-danger lesson-text" style={{ marginTop: 12 }}>
            <strong>{t('ملاحظة المراجعة: ', 'Review note: ')}</strong>{path.review_note_ar}
          </p>
        )}
        {state === 'submitted' && (
          <div className="notice" style={{ marginTop: 12 }}>
            {t('المسار بانتظار المراجعة ولا يُعدَّل الآن.', 'The path is in review and cannot be edited now.')}
            <ActionForm action={withdrawStudioItem} submitLabel={t('اسحبه لأعدّل', 'Withdraw to edit')} variant="ghost" className="inline-form">
              <input type="hidden" name="kind" value="path" />
              <input type="hidden" name="id" value={path.id} />
            </ActionForm>
          </div>
        )}
        {state === 'approved' && (
          <p className="notice notice-ok" style={{ marginTop: 12 }}>
            {path.status === 'published'
              ? t('المسار منشور في الأكاديمية باسمك.', 'The path is published in the academy under your name.')
              : t('اعتُمد المسار، ويُفتح في الأكاديمية حين تُعتمد أول دورة فيه.', 'The path is approved, and opens in the academy once its first course is approved.')}
          </p>
        )}
      </section>

      {canEdit && (
        <>
          <details className="panel section-block studio-details" open={(linked ?? []).length === 0}>
            <summary>{t('بيانات المسار', 'Path details')}</summary>
            <ActionForm action={saveStudioPath} submitLabel={t('احفظ', 'Save')} className="stack">
              <input type="hidden" name="path_id" value={path.id} />
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="title_ar">{t('العنوان', 'Title')}</label>
                  <input id="title_ar" name="title_ar" defaultValue={path.title_ar} required minLength={4} maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="title_en">{t('العنوان بالإنجليزية', 'English title')}</label>
                  <input id="title_en" name="title_en" dir="ltr" defaultValue={path.title_en ?? ''} maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="school">{t('المدرسة', 'School')}</label>
                  <select id="school" name="school" defaultValue={school} required>
                    {(schools ?? []).map((row) => <option key={row.slug} value={row.slug}>{row.name_ar}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tags">{t('وسوم — مفصولة بفواصل', 'Tags — comma separated')}</label>
                  <input id="tags" name="tags" defaultValue={(path.tags ?? []).join('، ')} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="tagline_ar">{t('جملة تعريفية', 'Tagline')}</label>
                <input id="tagline_ar" name="tagline_ar" defaultValue={path.tagline_ar ?? ''} maxLength={140} />
              </div>
              <div className="field">
                <label htmlFor="description_ar">{t('لمن هذا المسار، وماذا سيصبح المتعلم قادراً عليه', 'Who the path is for, and what the learner will be able to do')}</label>
                <textarea id="description_ar" name="description_ar" rows={4} defaultValue={path.description_ar ?? ''} maxLength={1200} />
              </div>
            </ActionForm>
          </details>

          <section className="panel section-block">
            <h3 style={{ fontSize: '1rem' }}>{t('دورات المسار', 'The path’s courses')}</h3>
            <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
              {t('اختر الدورات ورقّمها بالترتيب الذي يقود المتعلم. «اختيارية» تعني أن المسار يكتمل بدونها.',
                 'Tick the courses and number them in the order that leads the learner. «Optional» means the path completes without it.')}
            </p>
            <ActionForm action={saveStudioPathCourses} submitLabel={t('احفظ الدورات', 'Save the courses')}>
              <input type="hidden" name="path_id" value={path.id} />
              <p className="kicker" style={{ marginTop: 12 }}>{t('دوراتي', 'My courses')}</p>
              {(mine ?? []).length === 0
                ? <p className="muted" style={{ fontSize: '0.84rem' }}>{t('لا دورات لك بعد.', 'You have no courses yet.')} <Link href="/studio">{t('أنشئ دورة', 'Create one')}</Link></p>
                : <ul className="studio-path-courses">{(mine ?? []).map(row)}</ul>}
              <details>
                <summary className="kicker" style={{ cursor: 'pointer' }}>{t('دورات منشورة في الأكاديمية', 'Courses published in the academy')}</summary>
                <ul className="studio-path-courses">{(published ?? []).map(row)}</ul>
              </details>
            </ActionForm>
          </section>

          <section className="panel section-block">
            <div className="tags-row">
              <ActionForm action={submitStudioItem} submitLabel={t('أرسل المسار للمراجعة', 'Send the path for review')}>
                <input type="hidden" name="kind" value="path" />
                <input type="hidden" name="id" value={path.id} />
              </ActionForm>
              <ActionForm action={deleteStudioPath} submitLabel={t('احذف المسار', 'Delete the path')} variant="ghost"
                          confirm={t('يُحذف المسار (ولا تُحذف دوراته). متأكد؟', 'The path is deleted (its courses are not). Sure?')}>
                <input type="hidden" name="path_id" value={path.id} />
              </ActionForm>
            </div>
          </section>
        </>
      )}
    </>
  );
}
