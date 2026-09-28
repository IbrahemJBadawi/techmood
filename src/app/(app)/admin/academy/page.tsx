import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT, localizedTitle } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';
import type { ContentStatus } from '@/lib/database.types';

import {
  createCourse, createPath, linkCourse, savePathDetails, setAssignmentStatus, setCourseStatusTo, setPathMode, unlinkCourse,
} from './actions';
import { STATUS_LABEL, STATUS_ORDER, STATUS_PILL, STATUS_SHORT } from './status';

export const generateMetadata = localizedTitle('محتوى الأكاديمية — TechMood', 'Academy content — TechMood');

const HERE = '/admin/academy';

/**
 * The whole catalogue, under the admin's hand.
 *
 * Every path, course, lesson and project can be switched on, off, hidden or
 * marked «قريباً», added and edited. One rule is not the admin's to break,
 * because it is the founder's (0078): a path is open when at least one of its
 * courses is ready, and «قريباً» when none is. The admin decides whether a
 * path follows that rule or is held back / switched off.
 */
export default async function AdminAcademyPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const [
    { data: courses }, { data: paths }, { data: links }, { data: schools },
    { data: lessonRows }, { data: modules }, { data: projects },
  ] = await Promise.all([
    supabase.from('courses').select('id, slug, title_ar, title_en, status').order('title_ar'),
    supabase.from('learning_paths').select('id, slug, title_ar, title_en, description_ar, tagline_ar, school_id, status, sort_order').order('sort_order'),
    supabase.from('path_courses').select('path_id, course_id, is_required, sort_order').order('sort_order'),
    supabase.from('schools').select('id, slug, name_ar, name_en').order('sort_order'),
    supabase.from('lessons').select('id, module_id'),
    supabase.from('modules').select('id, course_id'),
    supabase.from('assignments').select('id, path_id, title_ar, status').eq('kind', 'path_project'),
  ]);

  const lessonsPerModule = new Map<string, number>();
  for (const lesson of lessonRows ?? []) {
    lessonsPerModule.set(lesson.module_id, (lessonsPerModule.get(lesson.module_id) ?? 0) + 1);
  }
  const lessonsPerCourse = new Map<string, number>();
  for (const unit of modules ?? []) {
    lessonsPerCourse.set(unit.course_id, (lessonsPerCourse.get(unit.course_id) ?? 0) + (lessonsPerModule.get(unit.id) ?? 0));
  }

  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  const statusCount = (status: ContentStatus) => (paths ?? []).filter((path) => path.status === status).length;

  const statusSelect = (name: string, value: ContentStatus) => (
    <select name={name} defaultValue={value} aria-label={t('الحالة', 'Status')}>
      {STATUS_ORDER.map((status) => <option key={status} value={status}>{t(STATUS_LABEL[status])}</option>)}
    </select>
  );

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('محتوى الأكاديمية', 'Academy content')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '72ch' }}>
          {t('كل مسار ودورة ودرس ومشروع هنا يمكن تفعيله أو تعطيله أو إخفاؤه أو جعله «قريباً»، وإضافته وتعديله. المسار الذي فيه دورة واحدة جاهزة على الأقل يُفتح تلقائياً، والذي ليس فيه دورة جاهزة يبقى «قريباً».',
             'Every path, course, lesson and project here can be switched on or off, hidden or marked «coming soon», added and edited. A path with at least one ready course opens by itself; a path with none stays «coming soon».')}
        </p>
        <div className="tags-row" style={{ marginTop: 10 }}>
          {STATUS_ORDER.map((status) => (
            <span key={status} className={`status-pill ${STATUS_PILL[status]}`}>
              {t(STATUS_SHORT[status])} <span className="eng">{statusCount(status)}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="section-block detail-grid">
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem' }}>{t('مسار جديد', 'New path')}</h3>
          <ActionForm action={createPath} className="stack" submitLabel={t('أضف المسار', 'Add the path')}>
            <input type="hidden" name="revalidate" value={HERE} />
            <input name="title_ar" required placeholder={t('اسم المسار', 'Path title (Arabic)')} />
            <input name="title_en" placeholder={t('الاسم بالإنجليزية', 'English title')} />
            <input name="slug" required pattern="[a-z0-9-]+" placeholder="slug (a-z, 0-9, -)" className="eng" />
            <select name="school_id" defaultValue="" aria-label={t('المدرسة', 'School')}>
              <option value="">{t('— المدرسة —', '— School —')}</option>
              {(schools ?? []).map((school) => <option key={school.id} value={school.id}>{contentText(locale, school.name_ar, school.name_en)}</option>)}
            </select>
            <textarea name="description_ar" rows={2} placeholder={t('وصف قصير', 'Short description')} />
          </ActionForm>
        </div>
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem' }}>{t('دورة جديدة', 'New course')}</h3>
          <ActionForm action={createCourse} className="stack" submitLabel={t('أضف الدورة', 'Add the course')}>
            <input type="hidden" name="revalidate" value={HERE} />
            <input name="title_ar" required placeholder={t('اسم الدورة', 'Course title (Arabic)')} />
            <input name="title_en" placeholder={t('الاسم بالإنجليزية', 'English title')} />
            <input name="slug" required pattern="[a-z0-9-]+" placeholder="slug (a-z, 0-9, -)" className="eng" />
            <input name="estimated_hours" type="number" min={1} max={500} placeholder={t('الساعات التقديرية', 'Estimated hours')} />
            <textarea name="description_ar" rows={2} placeholder={t('وصف قصير', 'Short description')} />
          </ActionForm>
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t(`المسارات (${paths?.length ?? 0})`, `Paths (${paths?.length ?? 0})`)}</h3>
        <div className="stack">
          {(paths ?? []).map((path) => {
            const pathLinks = (links ?? []).filter((link) => link.path_id === path.id);
            const ready = pathLinks.filter((link) => courseById.get(link.course_id)?.status === 'published').length;
            const mode = path.status === 'draft' || path.status === 'archived' ? path.status : 'auto';
            const pathProjects = (projects ?? []).filter((project) => project.path_id === path.id);
            const here = HERE;

            return (
              <details className="panel admin-lesson" key={path.id}>
                <summary>
                  <span>{contentText(locale, path.title_ar, path.title_en)}</span>
                  <span className="muted eng">#{path.sort_order}</span>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {t(`${ready} من ${pathLinks.length} دورات جاهزة`, `${ready} of ${pathLinks.length} courses ready`)}
                  </span>
                  <span className={`status-pill ${STATUS_PILL[path.status]}`}>{t(STATUS_SHORT[path.status])}</span>
                </summary>

                <ActionForm action={setPathMode} className="admin-inline-form" submitLabel={t('طبّق', 'Apply')}>
                  <input type="hidden" name="path_id" value={path.id} />
                  <input type="hidden" name="revalidate" value={here} />
                  <select name="mode" defaultValue={mode} aria-label={t('وضع المسار', 'Path mode')}>
                    <option value="auto">{t('تلقائي — مفتوح بدورة جاهزة، «قريباً» بدونها', 'Auto — open with a ready course, «coming soon» without')}</option>
                    <option value="draft">{t('مخفي — لا يظهر في الخريطة', 'Hidden — not on the map')}</option>
                    <option value="archived">{t('معطّل — مخفي ولا يعود تلقائياً', 'Off — hidden, and never reopens by itself')}</option>
                  </select>
                  <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}`}>{t('صفحة المسار', 'Path page')}</Link>
                </ActionForm>

                <ActionForm action={savePathDetails} className="admin-lesson-form" submitLabel={t('احفظ التفاصيل', 'Save details')}>
                  <input type="hidden" name="path_id" value={path.id} />
                  <input type="hidden" name="revalidate" value={here} />
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor={`pt-${path.id}`}>{t('الاسم', 'Title')}</label>
                      <input id={`pt-${path.id}`} name="title_ar" defaultValue={path.title_ar} required />
                    </div>
                    <div className="field">
                      <label htmlFor={`pte-${path.id}`}>{t('الاسم بالإنجليزية', 'English title')}</label>
                      <input id={`pte-${path.id}`} name="title_en" defaultValue={path.title_en ?? ''} />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor={`ps-${path.id}`}>{t('المدرسة', 'School')}</label>
                      <select id={`ps-${path.id}`} name="school_id" defaultValue={path.school_id ?? ''}>
                        <option value="">—</option>
                        {(schools ?? []).map((school) => <option key={school.id} value={school.id}>{contentText(locale, school.name_ar, school.name_en)}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`ptag-${path.id}`}>{t('الشعار', 'Tagline')}</label>
                      <input id={`ptag-${path.id}`} name="tagline_ar" defaultValue={path.tagline_ar ?? ''} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`pd-${path.id}`}>{t('الوصف', 'Description')}</label>
                    <textarea id={`pd-${path.id}`} name="description_ar" rows={2} defaultValue={path.description_ar ?? ''} />
                  </div>
                </ActionForm>

                <div className="admin-sub">
                  <h4>{t('دورات المسار', 'The path’s courses')}</h4>
                  <ul className="admin-mini-list">
                    {pathLinks.map((link) => {
                      const course = courseById.get(link.course_id);
                      if (!course) return null;
                      return (
                        <li key={link.course_id}>
                          <Link href={`/admin/academy/${course.slug}`}>{contentText(locale, course.title_ar, course.title_en)}</Link>
                          <span className={`status-pill ${STATUS_PILL[course.status]}`}>{t(STATUS_SHORT[course.status])}</span>
                          <ActionForm action={linkCourse} className="admin-inline-form" variant="ghost" submitLabel={t('احفظ', 'Save')}>
                            <input type="hidden" name="path_id" value={path.id} />
                            <input type="hidden" name="course_id" value={link.course_id} />
                            <input type="hidden" name="revalidate" value={here} />
                            <input name="sort_order" type="number" min={0} defaultValue={link.sort_order} style={{ width: 70 }} aria-label={t('الترتيب', 'Order')} />
                            <label className="switch-row"><input type="checkbox" name="is_required" defaultChecked={link.is_required} />{t('أساسية', 'Required')}</label>
                          </ActionForm>
                          <ActionForm action={unlinkCourse} variant="ghost" submitLabel={t('أزل', 'Remove')}>
                            <input type="hidden" name="path_id" value={path.id} />
                            <input type="hidden" name="course_id" value={link.course_id} />
                            <input type="hidden" name="revalidate" value={here} />
                          </ActionForm>
                        </li>
                      );
                    })}
                  </ul>
                  <ActionForm action={linkCourse} className="admin-inline-form" variant="ghost" submitLabel={t('أضف للمسار', 'Add to the path')}>
                    <input type="hidden" name="path_id" value={path.id} />
                    <input type="hidden" name="revalidate" value={here} />
                    <select name="course_id" required defaultValue="" aria-label={t('الدورة', 'Course')}>
                      <option value="" disabled>{t('— اختر دورة —', '— Choose a course —')}</option>
                      {(courses ?? []).filter((course) => !pathLinks.some((link) => link.course_id === course.id)).map((course) => (
                        <option key={course.id} value={course.id}>{contentText(locale, course.title_ar, course.title_en)}</option>
                      ))}
                    </select>
                    <label className="switch-row"><input type="checkbox" name="is_required" defaultChecked />{t('أساسية', 'Required')}</label>
                  </ActionForm>
                </div>

                {pathProjects.length > 0 && (
                  <div className="admin-sub">
                    <h4>{t('مشروع المسار', 'The path project')}</h4>
                    <ul className="admin-mini-list">
                      {pathProjects.map((project) => (
                        <li key={project.id}>
                          <span>{project.title_ar}</span>
                          <ActionForm action={setAssignmentStatus} className="admin-inline-form" variant="ghost" submitLabel={t('احفظ', 'Save')}>
                            <input type="hidden" name="assignment_id" value={project.id} />
                            <input type="hidden" name="revalidate" value={here} />
                            {statusSelect('status', project.status)}
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t(`الدورات (${courses?.length ?? 0})`, `Courses (${courses?.length ?? 0})`)}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
          {t('الدورة لا تُنشر بلا دروس. «قريباً» تظهر للطلاب وتُحتسب في المسار؛ المسودة والمعطّلة لا تظهر ولا تُحتسب.',
             'A course cannot be published without lessons. «Coming soon» is shown and counts in its path; draft and off are hidden and do not count.')}
        </p>
        <ul className="admin-course-list">
          {(courses ?? []).map((course) => (
            <li key={course.id}>
              <Link href={`/admin/academy/${course.slug}`}>{contentText(locale, course.title_ar, course.title_en)}</Link>
              <span className="muted eng">{lessonsPerCourse.get(course.id) ?? 0} lessons</span>
              <ActionForm action={setCourseStatusTo} className="admin-inline-form" variant="ghost" submitLabel={t('احفظ', 'Save')}>
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="revalidate" value={HERE} />
                {statusSelect('status', course.status)}
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
