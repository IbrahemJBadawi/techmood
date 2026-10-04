import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import type { Evaluation, Submission } from '@/lib/database.types';

import { Icon } from '@/components/Icon';

import { enrolInPath } from '../actions';
import { ProgressRing } from '../ProgressRing';
import { schoolLook } from '../schools';
import { SubmissionPanel } from '../SubmissionPanel';

export default async function PathPage({
  params,
  searchParams,
}: {
  params: Promise<{ pathSlug: string }>;
  searchParams: Promise<{ join?: string }>;
}) {
  const { pathSlug } = await params;
  const { join } = await searchParams;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: path } = await supabase
    .from('learning_paths')
    .select('id, slug, title_ar, description_ar, tagline_ar, tags, estimated_hours, status, author_id, schools(slug, name_ar, name_en)')
    .eq('slug', pathSlug)
    .single();

  if (!path) notFound();
  // A path the admin hid or switched off is not on the map, nor behind its URL.
  // A mentor's path waiting in the studio (0115) is seen by its author only.
  const isAuthor = Boolean(path.author_id) && path.author_id === user.id;
  const preview = path.status === 'draft' && isAuthor;
  if ((path.status === 'draft' || path.status === 'archived') && !preview) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) notFound();
  }
  const { data: author } = path.author_id
    ? await supabase.from('profiles').select('id, full_name').eq('id', path.author_id).maybeSingle()
    : { data: null };

  const { data: pathCourses } = await supabase
    .from('path_courses')
    .select('is_required, sort_order, courses(id, slug, title_ar, description_ar, estimated_hours, status, author_id)')
    .eq('path_id', path.id)
    .order('sort_order');

  // The path as a learner sees it (0078, 0118): open and «coming soon» courses
  // open; a course still being written (draft) is listed as «being prepared»,
  // by title only, so the learner knows the path is not finished rather than
  // wondering where its required courses went; a switched-off course is gone.
  const courses = (pathCourses ?? [])
    .map((row) => {
      const course = row.courses as unknown as { id: string; slug: string; title_ar: string; description_ar: string | null; estimated_hours: number | null; status: string; author_id: string | null };
      return {
        ...course,
        isRequired: row.is_required,
        // a draft the viewer did not write: shown, not opened
        outline: course.status === 'draft' && course.author_id !== user.id,
      };
    })
    .filter((course) => course.status !== 'archived');

  // Completion is asked of the database so the UI and the certificate rule can
  // never disagree about what "complete" means.
  const completion = await Promise.all(
    courses.map(async (course) => {
      // A draft has no open work yet, so it would read as "complete" — the
      // author previewing it sees the path as a learner starting it would.
      if (preview || course.outline) return { courseId: course.id, complete: false };
      const { data } = await supabase.rpc('is_course_complete', { p_profile: user.id, p_course: course.id });
      return { courseId: course.id, complete: data === true };
    }),
  );

  // How ready each course is: its lessons that are open now, of all it will
  // have. A course with lessons still being prepared can still be entered.
  const { data: courseLessons } = courses.length
    ? await supabase.from('modules').select('course_id, lessons(status)').in('course_id', courses.map((course) => course.id))
    : { data: [] };
  const readiness = new Map<string, { open: number; total: number }>();
  for (const row of courseLessons ?? []) {
    const lessons = ((row.lessons as unknown as { status: string }[] | null) ?? [])
      .filter((lesson) => lesson.status === 'published' || lesson.status === 'planned');
    const current = readiness.get(row.course_id) ?? { open: 0, total: 0 };
    current.total += lessons.length;
    current.open += lessons.filter((lesson) => lesson.status === 'published').length;
    readiness.set(row.course_id, current);
  }

  const [{ data: pathCompleteRaw }, { data: pathSkills }] = await Promise.all([
    supabase.rpc('is_path_complete', { p_profile: user.id, p_path: path.id }),
    supabase.rpc('path_skills', { p_path: path.id }),
  ]);

  const pathComplete = !preview && pathCompleteRaw === true;

  const [{ data: enrolment }, { data: pathConversation }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id')
      .eq('profile_id', user.id)
      .eq('path_id', path.id)
      .maybeSingle(),
    supabase.from('conversations').select('id').eq('path_id', path.id).maybeSingle(),
  ]);

  const { data: groupProject } = await supabase
    .from('assignments')
    .select('id, title_ar, brief_ar, required_evidence, status')
    .eq('path_id', path.id)
    .eq('kind', 'path_project')
    .maybeSingle();

  // The path project is handed in here, like a course project on its course's
  // page: a project link, with a YouTube walkthrough if the team made one.
  const { data: projectSubmission } = groupProject && enrolment
    ? await supabase
        .from('submissions')
        .select('id, assignment_id, profile_id, team_id, status, current_version, created_at, updated_at')
        .eq('assignment_id', groupProject.id)
        .eq('profile_id', user.id)
        .maybeSingle()
    : { data: null };
  const [{ data: projectEvaluations }, { data: projectReevaluation }] = projectSubmission
    ? await Promise.all([
        supabase
          .from('evaluations')
          .select('id, submission_id, version_id, evaluator_id, decision, stars, score, feedback_ar, created_at, evaluator:evaluator_id(full_name, display_name, techmood_id, avatar_url)')
          .eq('submission_id', projectSubmission.id)
          .order('created_at', { ascending: true }),
        supabase.from('reevaluation_requests').select('submission_id')
          .eq('status', 'open').eq('submission_id', projectSubmission.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  const doneCount = completion.filter((item) => item.complete).length;
  const percent = courses.length ? Math.round((doneCount / courses.length) * 100) : 0;
  const school = path.schools as unknown as { slug: string; name_ar: string; name_en: string | null } | null;
  const look = schoolLook(school?.slug);
  // The first course not yet complete is where the learner is now.
  const currentIndex = courses.findIndex(
    (course) => course.status === 'published' && !completion.find((item) => item.courseId === course.id)?.complete,
  );

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/academy">{t('→ رجوع للأكاديمية', '← Back to the academy')}</Link>

      {preview && (
        <p className="notice" style={{ marginTop: 16 }}>
          {t('معاينة: هكذا يظهر مسارك في الأكاديمية بعد اعتماده. لا يراه غيرك الآن.',
             'Preview: this is how your path appears in the academy once approved. Nobody else sees it yet.')}
          {' '}<Link href={`/studio/paths/${path.id}`}>{t('عد للاستوديو', 'Back to the studio')}</Link>
        </p>
      )}

      {join === 'failed' && (
        <p className="notice notice-danger" style={{ marginTop: 16 }}>
          {t('تعذّر الالتحاق بهذا المسار الآن. أعد المحاولة، وإن تكرر فأخبرنا من «المساعدة والبلاغات».',
             'Joining this path failed. Try again; if it keeps failing, tell us in Help & reports.')}
        </p>
      )}

      <section className="section-block ac-cover" style={{ marginTop: 16, '--hue': look.color } as React.CSSProperties}>
        <div className="ac-cover-top">
          <span className="ac-cover-icon"><Icon name={look.icon} size={26} /></span>
          <div className="ac-cover-titles">
            {school && <p className="ac-cover-school">{t.locale === 'ar' ? school.name_ar : (school.name_en ?? school.name_ar)}</p>}
            <h2>{path.title_ar}</h2>
          </div>
          <ProgressRing percent={percent} size={64} stroke={6} label={t('تقدّم المسار', 'Path progress')} />
        </div>
        {author && (
          <p className="ac-byline">
            {t('من إعداد المنتور', 'By mentor')} <Link href={`/mentors/${author.id}`}>{author.full_name}</Link>
          </p>
        )}
        <p className="ac-cover-desc">{path.description_ar}</p>
        {path.tagline_ar && <p className="ac-cover-tagline">{path.tagline_ar}</p>}

        <ul className="ac-cover-meta">
          <li><Icon name="layers" size={15} />{t(`${doneCount} من ${courses.length} دورات مكتملة`, `${doneCount} of ${courses.length} courses done`)}</li>
          {path.estimated_hours && <li><Icon name="clock" size={15} /><span className="eng">~{path.estimated_hours}h</span></li>}
          {path.tags?.slice(0, 4).map((tag) => <li className="eng" key={tag}>{tag}</li>)}
        </ul>

        {/* A path never closes, so enrolling is simply joining — and it is what
            gives you the path's conversation with everyone else on it. */}
        <div className="ac-cover-actions">
          {enrolment ? (
            <>
              <span className="ac-cover-joined"><Icon name="check" size={16} />{t('أنت ملتحق بهذا المسار', 'You are on this path')}</span>
              {pathConversation && (
                <Link className="btn btn-sm ac-cover-ghost" href={`/messages?c=${pathConversation.id}`}>
                  <Icon name="message" size={16} />{t('محادثة المسار', 'Path conversation')}
                </Link>
              )}
            </>
          ) : preview ? null : (
            <form action={enrolInPath}>
              <input type="hidden" name="path_id" value={path.id} />
              <input type="hidden" name="revalidate" value={`/academy/${path.slug}`} />
              <button className="btn ac-cover-cta">{t('التحق بالمسار', 'Join the path')}</button>
            </form>
          )}
        </div>
      </section>

      {(pathSkills ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem' }}>{t('مهارات هذا المسار', 'What this path teaches')}</h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {t('مجموع ما تثبته دورات المسار. تُوثَّق على ملفك واحدة واحدة كلما اعتُمد عمل يثبتها.',
               'The sum of what its courses prove — recorded on your profile one at a time, as the work proving each is approved.')}
          </p>
          <div className="tags-row" style={{ marginTop: 10 }}>
            {(pathSkills ?? []).map((skill) => (
              <span className="tag" key={skill.slug}>{skill.name_ar}</span>
            ))}
          </div>
        </section>
      )}

      <div className="detail-grid">
        <section>
          <h3 className="academy-heading">{t('خط سير المسار', 'The path, step by step')}</h3>
          <ol className="ac-trail" style={{ '--hue': look.color } as React.CSSProperties}>
            {courses.map((course, index) => {
              const complete = completion.find((item) => item.courseId === course.id)?.complete;
              const planned = course.status === 'planned';
              const state = complete ? 'is-done' : index === currentIndex ? 'is-now' : planned || course.outline ? 'is-soon' : '';
              if (course.outline) {
                // Being written: its place in the path, not a page to open yet.
                return (
                  <li className={`ac-stop ${state}`} key={course.id}>
                    <span className="ac-stop-node" aria-hidden="true"><Icon name="lock" size={18} /></span>
                    <div className="ac-stop-card is-outline">
                      <span className="ac-stop-head">
                        <span className="ac-stop-no">{t(`الدورة ${index + 1} من ${courses.length}`, `Course ${index + 1} of ${courses.length}`)}</span>
                        <span className="status-pill status-pending">{t('قيد التحضير', 'Being prepared')}</span>
                      </span>
                      <strong>{course.title_ar}</strong>
                      <span className="ac-stop-ready is-empty">
                        {course.isRequired
                          ? t('دورة مطلوبة تُكتب الآن — تُفتح هنا حين تجهز دروسها.', 'A required course being written — it opens here when its lessons are ready.')
                          : t('دورة اختيارية تُكتب الآن.', 'An elective being written.')}
                      </span>
                    </div>
                  </li>
                );
              }
              return (
                <li className={`ac-stop ${state}`} key={course.id}>
                  <span className="ac-stop-node" aria-hidden="true">
                    {complete ? <Icon name="check" size={20} /> : planned ? <Icon name="lock" size={18} /> : <span className="eng">{index + 1}</span>}
                  </span>
                  <Link className="ac-stop-card" href={`/academy/${path.slug}/${course.slug}`}>
                    <span className="ac-stop-head">
                      <span className="ac-stop-no">{t(`الدورة ${index + 1} من ${courses.length}`, `Course ${index + 1} of ${courses.length}`)}</span>
                      {planned ? (
                        <span className="status-pill status-pending">{t('قريباً', 'Coming soon')}</span>
                      ) : (
                        <span className={`status-pill ${complete ? 'status-ok' : index === currentIndex ? 'status-pending' : 'status-muted'}`}>
                          {complete ? t('مكتملة', 'Completed') : index === currentIndex ? t('أنت هنا', 'You are here') : course.isRequired ? t('مطلوبة', 'Required') : t('اختيارية', 'Elective')}
                        </span>
                      )}
                    </span>
                    <strong>{course.title_ar}</strong>
                    {course.description_ar && <span className="ac-stop-desc">{course.description_ar}</span>}
                    {(() => {
                      // What is ready in this course, and what is still being prepared.
                      const ready = readiness.get(course.id) ?? { open: 0, total: 0 };
                      if (ready.total === 0) {
                        return <span className="ac-stop-ready is-empty">{t('الدروس قيد التحضير', 'Lessons are being prepared')}</span>;
                      }
                      return (
                        <span className={`ac-stop-ready${ready.open < ready.total ? ' is-partial' : ''}`}>
                          {ready.open < ready.total
                            ? t(`${ready.open} من ${ready.total} دروس جاهزة — الباقي قيد التحضير`, `${ready.open} of ${ready.total} lessons ready — the rest are being prepared`)
                            : t(`${ready.total} دروس جاهزة`, `${ready.total} lessons ready`)}
                        </span>
                      );
                    })()}
                    <span className="ac-stop-go">
                      {planned ? t('ما ستتعلمه', 'What it will teach') : complete ? t('راجع الدورة', 'Review') : t('افتح الدورة', 'Open the course')}
                      <Icon name="arrow" size={15} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <aside>
          {groupProject && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>🏆 {groupProject.title_ar}</h3>
              <span className="badge-pill" style={{ marginTop: 8 }}>{t('مشروع جماعي', 'Group project')}</span>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 10 }}>{groupProject.brief_ar}</p>
              {groupProject.status === 'planned' && (
                <p className="notice" style={{ marginTop: 10 }}>{t('يُفتح التسليم قريباً.', 'Hand-in opens soon.')}</p>
              )}
            </div>
          )}

          {groupProject && enrolment && groupProject.status === 'published' && (
            <SubmissionPanel
              assignmentId={groupProject.id}
              title={t('سلّم مشروع المسار', 'Hand in the path project')}
              brief={null}
              requiredEvidence={groupProject.required_evidence}
              submission={(projectSubmission ?? null) as Submission | null}
              evaluations={(projectEvaluations ?? []) as unknown as Evaluation[]}
              revalidatePath={`/academy/${path.slug}`}
              hasOpenReevaluation={Boolean(projectReevaluation)}
              isProject
            />
          )}

          {!preview && <div className="panel">
            <h3 style={{ fontSize: '0.98rem' }}>{t('شهادة المسار', 'Path certificate')}</h3>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 8 }}>
              {pathComplete
                ? t('اكتملت متطلبات المسار — يمكنك إصدار شهادته من صفحة الشهادات.',
                    'The path requirements are met — you can issue its certificate from the certificates page.')
                : !courses.some((course) => course.isRequired && course.status === 'published')
                  ? t('تُصدَر حين تُفتح الدورات المطلوبة في هذا المسار وتُكملها — ما زالت قيد التحضير.',
                      'Issued once this path’s required courses open and you complete them — they are still being prepared.')
                  : t('تُصدَر بعد اعتماد كل الأعمال المطلوبة في دورات المسار ومشروعه الجماعي.',
                    'Issued once every required piece of work in the path\u2019s courses and its group project has been approved.')}
            </p>
            {pathComplete && (
              <Link className="btn btn-sky btn-sm" style={{ marginTop: 10 }} href="/certificates">
                {t('إصدار الشهادة', 'Issue the certificate')}
              </Link>
            )}
          </div>}
        </aside>
      </div>
    </>
  );
}
