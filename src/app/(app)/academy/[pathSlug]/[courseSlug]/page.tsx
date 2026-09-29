import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { type Text } from '@/lib/i18n';
import { Assignment, Evaluation, Submission } from '@/lib/database.types';

import { Icon } from '@/components/Icon';

import { toggleLesson } from '../../actions';
import { ProgressRing } from '../../ProgressRing';
import { schoolLook } from '../../schools';
import { SubmissionPanel } from '../../SubmissionPanel';
import { CourseRatingForm } from '../../CourseRatingForm';

const LESSON_KIND_LABELS: Record<string, Text> = {
  video:    { ar: 'فيديو',        en: 'Video' },
  article:  { ar: 'مقال',         en: 'Article' },
  reading:  { ar: 'قراءة',        en: 'Reading' },
  exercise: { ar: 'تمرين',        en: 'Exercise' },
  live:     { ar: 'جلسة مباشرة',  en: 'Live session' },
};

const WORK_STATE: Record<string, { text: Text; pill: string }> = {
  none:              { text: { ar: 'لم يُسلَّم بعد', en: 'Not handed in' }, pill: 'status-muted' },
  draft:             { text: { ar: 'مسودة', en: 'Draft' }, pill: 'status-muted' },
  submitted:         { text: { ar: 'بانتظار المراجعة', en: 'Awaiting review' }, pill: 'status-pending' },
  under_review:      { text: { ar: 'قيد المراجعة', en: 'Under review' }, pill: 'status-pending' },
  changes_requested: { text: { ar: 'مطلوب تعديل', en: 'Changes requested' }, pill: 'status-danger' },
  approved:          { text: { ar: 'معتمد', en: 'Approved' }, pill: 'status-ok' },
  rejected:          { text: { ar: 'مرفوض', en: 'Rejected' }, pill: 'status-danger' },
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ pathSlug: string; courseSlug: string }>;
}) {
  const { pathSlug, courseSlug } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title_ar, description_ar, estimated_hours, status, author_id')
    .eq('slug', courseSlug)
    .single();

  if (!course) notFound();
  // Drafts and switched-off courses are not a learner's to open; a draft is
  // previewed by the mentor writing it (0115) and by admins.
  const preview = course.status === 'draft' && course.author_id === user.id;
  if ((course.status === 'draft' || course.status === 'archived') && !preview) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) notFound();
  }
  const { data: author } = course.author_id
    ? await supabase.from('profiles').select('id, full_name, display_name').eq('id', course.author_id).maybeSingle()
    : { data: null };

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title_ar, sort_order, lessons(id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order, status)')
    .eq('course_id', course.id)
    .order('sort_order');

  type CourseLesson = { id: string; slug: string; title_ar: string; title_en: string | null; kind: string; duration_minutes: number | null; summary_ar: string | null; sort_order: number; status: string };
  // In teaching order: a lesson's sort_order counts within its module, so the
  // module decides first. Hidden and switched-off lessons are not part of the
  // course a learner sees (an admin previewing sees the same); «قريباً»
  // lessons are (0078).
  const courseModules = (modules ?? []).map((module) => ({
    id: module.id,
    title_ar: module.title_ar,
    lessons: ((module.lessons as unknown as CourseLesson[]) ?? [])
      .filter((lesson) => lesson.status === 'published' || lesson.status === 'planned' || (course.status === 'draft' && lesson.status === 'draft'))
      // Previewing a draft course, its draft lessons open as they will once approved.
      .map((lesson) => (course.status === 'draft' && lesson.status === 'draft' ? { ...lesson, status: 'published' } : lesson))
      .sort((a, b) => a.sort_order - b.sort_order),
  })).filter((module) => module.lessons.length > 0);
  const lessons = courseModules.flatMap((module) => module.lessons);

  const lessonIds = lessons.map((lesson) => lesson.id);

  const [{ data: progress }, { data: assignments }] = await Promise.all([
    supabase.from('lesson_progress').select('lesson_id, status').eq('profile_id', user.id).in('lesson_id', lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('assignments')
      .select('id, kind, lesson_id, course_id, title_ar, brief_ar, required_evidence, is_required, is_group_work, status')
      .eq('status', 'published')
      .or(`course_id.eq.${course.id},lesson_id.in.(${lessonIds.length ? lessonIds.join(',') : '00000000-0000-0000-0000-000000000000'})`),
  ]);

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, assignment_id, profile_id, team_id, status, current_version, created_at, updated_at')
    .eq('profile_id', user.id)
    .in('assignment_id', assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000']);

  const submissionIds = (submissions ?? []).map((submission) => submission.id);

  const [{ data: evaluations }, { data: openReevaluations }] = await Promise.all([
    supabase
      .from('evaluations')
      .select('id, submission_id, version_id, evaluator_id, decision, stars, score, feedback_ar, created_at')
      .in('submission_id', submissionIds.length ? submissionIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: true }),
    supabase
      .from('reevaluation_requests')
      .select('submission_id')
      .eq('status', 'open')
      .in('submission_id', submissionIds.length ? submissionIds : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const reevaluationOpenFor = new Set((openReevaluations ?? []).map((row) => row.submission_id));

  const { data: courseSkills } = await supabase.rpc('course_skills', { p_course: course.id });
  const { data: credentialRows } = await supabase.rpc('course_credential_progress', { p_course: course.id });
  const credentials = credentialRows?.[0];

  // A draft has no open work, so it would read as complete; not in preview.
  const { data: completeRaw } = await supabase.rpc('is_course_complete', {
    p_profile: user.id,
    p_course: course.id,
  });
  const isComplete = !preview && completeRaw === true;

  const [{ data: ratingRows }, { data: myRating }] = await Promise.all([
    supabase.rpc('course_rating', { p_course: course.id }),
    supabase.from('course_feedback').select('id').eq('course_id', course.id).eq('profile_id', user.id).maybeSingle(),
  ]);
  const rating = ratingRows?.[0];

  const completedLessons = new Set(
    (progress ?? []).filter((row) => row.status === 'completed').map((row) => row.lesson_id),
  );

  const revalidate = `/academy/${pathSlug}/${courseSlug}`;

  // The course takes the colour of the path it was opened from.
  const { data: pathRow } = await supabase
    .from('learning_paths')
    .select('title_ar, schools(slug)')
    .eq('slug', pathSlug)
    .maybeSingle();
  const look = schoolLook((pathRow?.schools as unknown as { slug: string } | null)?.slug);
  const openLessons = lessons.filter((lesson) => lesson.status === 'published');
  const lessonsDone = openLessons.filter((lesson) => completedLessons.has(lesson.id)).length;
  const lessonPercent = openLessons.length ? Math.round((lessonsDone / openLessons.length) * 100) : 0;
  const nextLesson = openLessons.find((lesson) => !completedLessons.has(lesson.id)) ?? null;
  const typedAssignments = (assignments ?? []) as Assignment[];
  const courseProject = typedAssignments.find((assignment) => assignment.kind === 'course_project');
  const courseTask = typedAssignments.find((assignment) => assignment.kind === 'course_task');
  // A lesson's work, in the order of the lessons it belongs to.
  const lessonWork = lessons.flatMap((lesson) => typedAssignments
    .filter((assignment) => assignment.kind === 'lesson_assignment' && assignment.lesson_id === lesson.id)
    .map((assignment) => ({ assignment, lesson })));

  const submissionFor = (assignmentId: string) =>
    ((submissions ?? []) as Submission[]).find((submission) => submission.assignment_id === assignmentId) ?? null;

  const evaluationsFor = (submissionId: string | undefined) =>
    submissionId
      ? ((evaluations ?? []) as Evaluation[]).filter((evaluation) => evaluation.submission_id === submissionId)
      : [];

  const hasOpenReevaluation = (submissionId: string | undefined) =>
    submissionId ? reevaluationOpenFor.has(submissionId) : false;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href={`/academy/${pathSlug}`}>{t('→ رجوع للمسار', '← Back to the path')}</Link>

      <section className="section-block ac-cover" style={{ marginTop: 16, '--hue': look.color } as React.CSSProperties}>
        <div className="ac-cover-top">
          <span className="ac-cover-icon"><Icon name={look.icon} size={26} /></span>
          <div className="ac-cover-titles">
            {pathRow?.title_ar && <p className="ac-cover-school">{pathRow.title_ar}</p>}
            <h2>{course.title_ar}</h2>
            {author && (
              <p className="ac-byline">
                {t('من إعداد المنتور', 'By mentor')}{' '}
                <Link href={`/mentors/${author.id}`}>{author.display_name || author.full_name}</Link>
              </p>
            )}
          </div>
          <ProgressRing percent={isComplete ? 100 : lessonPercent} size={64} stroke={6} label={t('تقدّم الدورة', 'Course progress')} />
        </div>
        {preview && (
          <p className="notice notice-warn" style={{ margin: '10px 0 0' }}>
            {t('معاينة لدورتك قبل النشر — لا يراها غيرك وغير الإدارة.', 'A preview of your course before it is published — only you and the admins see it.')}{' '}
            <Link href={`/studio/courses/${course.id}`}>{t('ارجع للاستوديو', 'Back to the studio')}</Link>
          </p>
        )}
        <p className="ac-cover-desc">{course.description_ar}</p>

        <ul className="ac-cover-meta">
          <li><Icon name="play" size={15} />{t(`${lessonsDone} من ${openLessons.length} دروس`, `${lessonsDone} of ${openLessons.length} lessons`)}</li>
          {course.estimated_hours && <li><Icon name="clock" size={15} /><span className="eng">~{course.estimated_hours}h</span></li>}
          {rating && rating.rated_count > 0 && (
            <li>
              <Icon name="star" size={15} /><span className="eng">{rating.stars_avg}</span>
              {t(` · ${rating.rated_count} تقييم`, ` · ${rating.rated_count} ratings`)}
              {rating.recommend_pct !== null && t(` · ${rating.recommend_pct}% يوصون بها`, ` · ${rating.recommend_pct}% recommend`)}
            </li>
          )}
          <li>{isComplete ? t('✓ مكتملة', '✓ Completed') : t('قيد التقدّم', 'In progress')}</li>
        </ul>

        {nextLesson && course.status !== 'planned' && (
          <div className="ac-cover-actions">
            <Link className="btn ac-cover-cta" href={`/academy/${pathSlug}/${courseSlug}/${nextLesson.slug}`}>
              {lessonsDone === 0 ? t('ابدأ الدرس الأول', 'Start the first lesson') : t('تابع: ', 'Continue: ')}
              {lessonsDone > 0 && nextLesson.title_ar}
            </Link>
          </div>
        )}
      </section>

      {course.status === 'planned' && (
        <p className="notice section-block">
          {t('هذه الدورة «قريباً» — تظهر هنا لتعرف ما سيأتي، وتُفتح دروسها حين تُنشر.',
             'This course is «coming soon» — shown so you know what is coming; its lessons open when it is published.')}
        </p>
      )}

      <section className="section-block">
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {t('الشهادة تتطلب إكمال كل الدروس ', 'The certificate needs every lesson finished ')}
          <strong>{t('واعتماد', 'and')}</strong>
          {t(' كل الأعمال المطلوبة أدناه.', ' every required piece of work below approved.')}
        </p>

        {(credentials?.credential_lessons ?? 0) > 0 && (
          <div className="stat-tiles" style={{ marginTop: 14 }}>
            <div className="stat-tile">
              <div className="val eng">{credentials?.completed}/{credentials?.credential_lessons}</div>
              <div className="lbl">{t('دروس شهادات مكتملة', 'Credential lessons done')}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{credentials?.applied}/{credentials?.credential_lessons}</div>
              <div className="lbl">{t('تطبيقات عملية معتمدة', 'Practical tasks approved')}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{credentials?.verified}/{credentials?.credential_lessons}</div>
              <div className="lbl">{t('شهادات موثّقة', 'Credentials verified')}</div>
            </div>
          </div>
        )}
      </section>

      {(courseSkills ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem' }}>{t('مهارات هذه الدورة', 'What this course teaches')}</h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {t('مجموع ما تثبته دروسها. كل مهارة تُوثَّق على ملفك حين يعتمد المنتور العمل الذي يثبتها.',
               'The sum of what its lessons prove. Each one is recorded on your profile when a mentor approves the work that proves it.')}
          </p>
          <div className="tags-row" style={{ marginTop: 10 }}>
            {(courseSkills ?? []).map((skill) => (
              <span className="tag" key={skill.slug}>{skill.name_ar}</span>
            ))}
          </div>
        </section>
      )}

      {isComplete && !myRating && <CourseRatingForm courseId={course.id} revalidate={revalidate} />}

      <div className="detail-grid">
        <section>
          <div className="panel section-block ac-lessons" style={{ '--hue': look.color } as React.CSSProperties}>
            <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{t('دروس الدورة', 'Course lessons')}</h3>
            {courseModules.map((module, moduleIndex) => (
              <div className="ac-module" key={module.id}>
                {courseModules.length > 1 && (
                  <p className="ac-module-title">
                    <span className="ac-module-n">{moduleIndex + 1}</span>
                    {module.title_ar}
                    <span className="muted">{t(`${module.lessons.length} دروس`, `${module.lessons.length} lessons`)}</span>
                  </p>
                )}
              {module.lessons.map((lesson) => {
                const done = completedLessons.has(lesson.id);
                const soon = lesson.status !== 'published';
                return (
                  <div className={`lesson-row${done ? ' is-done' : ''}${nextLesson?.id === lesson.id ? ' is-next' : ''}`} key={lesson.id}>
                    {soon ? (
                      <span className="lstat" aria-label={t('قريباً', 'Coming soon')} title={t('قريباً', 'Coming soon')}><Icon name="lock" size={14} /></span>
                    ) : (
                    <form action={toggleLesson}>
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <input type="hidden" name="completed" value={String(done)} />
                      <input type="hidden" name="revalidate" value={revalidate} />
                      <button
                        className={`lstat${done ? ' completed' : ''}`}
                        type="submit"
                        aria-label={done
                          ? t(`إلغاء إكمال ${lesson.title_ar}`, `Mark ${lesson.title_en ?? lesson.title_ar} as not done`)
                          : t(`إكمال ${lesson.title_ar}`, `Mark ${lesson.title_en ?? lesson.title_ar} as done`)}
                      >
                        ✓
                      </button>
                    </form>
                    )}
                    <div className="lesson-info">
                      <Link className="lesson-open" href={`/academy/${pathSlug}/${courseSlug}/${lesson.slug}`}>
                        {lesson.title_ar}
                      </Link>
                      {lesson.summary_ar && (
                        <p className="muted lesson-row-summary">{lesson.summary_ar}</p>
                      )}
                      <div className="lesson-meta">
                        <span className="tag">{LESSON_KIND_LABELS[lesson.kind] ? t(LESSON_KIND_LABELS[lesson.kind]) : lesson.kind}</span>
                        {soon && <span className="status-pill status-pending">{t('قريباً', 'Coming soon')}</span>}
                        {lesson.duration_minutes && <span className="eng">{lesson.duration_minutes} min</span>}
                        {lesson.title_en && <span className="eng muted">{lesson.title_en}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ))}
          </div>

          {lessonWork.length > 0 && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('تكليفات الدروس', 'Lesson assignments')}</h3>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {t('يُسلَّم كل تكليف من صفحة درسه. هنا ترى أين وصلت في كل واحد.',
                   'Each assignment is handed in from its lesson. Here you see where each one stands.')}
              </p>
              <ul className="ac-work">
                {lessonWork.map(({ assignment, lesson }) => {
                  const state = submissionFor(assignment.id)?.status ?? 'none';
                  const label = WORK_STATE[state] ?? WORK_STATE.none;
                  return (
                    <li key={assignment.id}>
                      <Link href={`/academy/${pathSlug}/${courseSlug}/${lesson.slug}`}>{assignment.title_ar}</Link>
                      {!assignment.is_required && <span className="tag">{t('اختياري', 'Optional')}</span>}
                      <span className={`status-pill ${label.pill}`}>{t(label.text)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <aside>
          {courseTask && (
            <SubmissionPanel
              assignmentId={courseTask.id}
              title={courseTask.title_ar}
              brief={courseTask.brief_ar}
              requiredEvidence={courseTask.required_evidence}
              submission={submissionFor(courseTask.id)}
              evaluations={evaluationsFor(submissionFor(courseTask.id)?.id)}
              hasOpenReevaluation={hasOpenReevaluation(submissionFor(courseTask.id)?.id)}
              revalidatePath={revalidate}
            />
          )}

          {courseProject && (
            <SubmissionPanel
              assignmentId={courseProject.id}
              title={courseProject.title_ar}
              brief={courseProject.brief_ar}
              requiredEvidence={courseProject.required_evidence}
              isProject
              submission={submissionFor(courseProject.id)}
              evaluations={evaluationsFor(submissionFor(courseProject.id)?.id)}
              hasOpenReevaluation={hasOpenReevaluation(submissionFor(courseProject.id)?.id)}
              revalidatePath={revalidate}
            />
          )}
        </aside>
      </div>
    </>
  );
}
