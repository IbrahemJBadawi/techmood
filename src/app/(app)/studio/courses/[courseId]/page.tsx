import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { StudioReviewState } from '@/lib/database.types';

import {
  addStudioModule, deleteStudioCourse, deleteStudioModule, moveStudioItem, renameStudioModule,
  saveStudioCourse, submitStudioItem, withdrawStudioItem, saveCoursePrice, promoteCourse,
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
    .select('id, slug, title_ar, title_en, description_ar, level, estimated_hours, status, author_id, review_state, review_note_ar, price_mode, price_usd')
    .eq('id', courseId)
    .maybeSingle();
  if (!course || course.author_id !== user.id) notFound();

  const [{ data: modules }, { data: paths }, { data: plan }, { count: sold }, { data: promos }, { data: dailyRow }] = await Promise.all([
    supabase.from('modules')
      .select('id, title_ar, sort_order, lessons(id, title_ar, kind, sort_order, assignments(id), lesson_videos(id))')
      .eq('course_id', course.id).order('sort_order'),
    supabase.from('path_courses').select('learning_paths(slug, title_ar)').eq('course_id', course.id),
    supabase.from('mentor_course_plans').select('monthly_usd, is_active').eq('mentor_id', user.id).maybeSingle(),
    supabase.from('course_purchases').select('id', { count: 'exact', head: true }).eq('course_id', course.id),
    supabase.from('course_promotions').select('id, days, paid_usd, starts_at, ends_at, impressions, clicks')
      .eq('course_id', course.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('platform_settings').select('value').eq('key', 'course_ad_daily_usd').maybeSingle(),
  ]);
  const adDaily = Number(dailyRow?.value ?? 2) || 2;
  const livePromo = (promos ?? []).find((row) => new Date(row.ends_at) > new Date());
  const dateFmt = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium' });

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

      {/* selling and sponsoring it (design lab 5, 0162) */}
      <section className="panel section-block studio-sell">
        <h3 style={{ fontSize: '1rem' }}>💳 {t('البيع', 'Selling')}</h3>
        <p className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 12px' }}>
          {t('اختر كيف تُدرس الدورة. في المدفوعة يبقى الدرس الأول معاينة مجانية، وتصلك 85٪ من كل بيع في محفظتك بعد 7 أيام (نافذة الاسترداد).',
             'Choose how the course is studied. A paid course keeps its first lesson as a free preview, and 85% of each sale reaches your wallet after 7 days (the refund window).')}
        </p>
        <ActionForm action={saveCoursePrice} submitLabel={t('احفظ', 'Save')} className="studio-price-form">
          <input type="hidden" name="course_id" value={course.id} />
          <div className="field">
            <label htmlFor="price_mode">{t('طريقة الدراسة', 'How it is studied')}</label>
            <select id="price_mode" name="price_mode" defaultValue={course.price_mode}>
              <option value="free">{t('مجانية', 'Free')}</option>
              <option value="once">{t('شراء مرة واحدة', 'Bought once')}</option>
              <option value="subscription" disabled={!plan?.is_active}>
                {t('ضمن اشتراكي الشهري', 'In my monthly plan')}{!plan?.is_active ? t(' (حدّد سعره من الاستوديو)', ' (set it in the studio)') : ''}
              </option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="price_usd">{t('السعر عند الشراء مرة واحدة ($)', 'Price when bought once ($)')}</label>
            <input id="price_usd" name="price_usd" type="number" min={1} max={300} step={0.5} inputMode="decimal"
                   defaultValue={course.price_usd ?? ''} placeholder="20" />
          </div>
        </ActionForm>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          {course.price_mode === 'free' ? t('الدورة مجانية الآن.', 'Free right now.')
            : course.price_mode === 'once' ? t(`تُباع بـ ${course.price_usd}$ — بيعت ${sold ?? 0} مرة.`, `Sold at $${course.price_usd} — ${sold ?? 0} sold.`)
            : t(`ضمن اشتراكك (${plan?.monthly_usd ?? '—'}$ شهرياً).`, `In your plan ($${plan?.monthly_usd ?? '—'} a month).`)}
        </p>
      </section>

      {course.status === 'published' && (
        <section className="panel section-block studio-sell">
          <h3 style={{ fontSize: '1rem' }}>📣 {t('موِّل دورتك', 'Sponsor your course')}</h3>
          <p className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 12px' }}>
            {t(`بطاقة «مُموَّل» لدورتك في الأكاديمية والرئيسية. ${adDaily}$ لليوم من رصيدك، وتتوقف وحدها حين تنتهي الأيام. لا تظهر لأعضاء Premium ولا لمن يملك الدورة.`,
               `A «sponsored» card for your course in the academy and on home pages. $${adDaily} a day from your balance; it stops by itself when the days run out. Never shown to Premium members or to people who have the course.`)}
          </p>
          {livePromo && (
            <p className="notice notice-ok" style={{ marginBottom: 10 }}>
              {t(`مموَّلة حتى ${dateFmt.format(new Date(livePromo.ends_at))} · ظهرت ${livePromo.impressions} مرة · ${livePromo.clicks} نقرة`,
                 `Sponsored until ${dateFmt.format(new Date(livePromo.ends_at))} · ${livePromo.impressions} views · ${livePromo.clicks} clicks`)}
            </p>
          )}
          <ActionForm action={promoteCourse} submitLabel={livePromo ? t('مدّد التمويل', 'Extend') : t('موِّل الآن', 'Sponsor now')}
                      className="inline-form"
                      confirm={t('يُخصم المبلغ من رصيدك الآن ولا يُسترد. متأكد؟', 'The amount comes off your balance now and is not refunded. Sure?')}>
            <input type="hidden" name="course_id" value={course.id} />
            <label className="sr-only" htmlFor="promo_days">{t('عدد الأيام', 'Days')}</label>
            <select id="promo_days" name="days" defaultValue="7">
              {[3, 7, 14, 30].map((days) => (
                <option key={days} value={days}>{t(`${days} أيام — ${(days * adDaily).toFixed(2)}$`, `${days} days — $${(days * adDaily).toFixed(2)}`)}</option>
              ))}
            </select>
          </ActionForm>
        </section>
      )}

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
