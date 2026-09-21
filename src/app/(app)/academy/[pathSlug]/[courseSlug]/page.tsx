import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { type Text } from '@/lib/i18n';
import { Assignment, Evaluation, Submission } from '@/lib/database.types';

import { toggleLesson } from '../../actions';
import { SubmissionPanel } from '../../SubmissionPanel';

const LESSON_KIND_LABELS: Record<string, Text> = {
  video:    { ar: 'فيديو',        en: 'Video' },
  article:  { ar: 'مقال',         en: 'Article' },
  reading:  { ar: 'قراءة',        en: 'Reading' },
  exercise: { ar: 'تمرين',        en: 'Exercise' },
  live:     { ar: 'جلسة مباشرة',  en: 'Live session' },
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
    .select('id, slug, title_ar, description_ar, estimated_hours')
    .eq('slug', courseSlug)
    .single();

  if (!course) notFound();

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title_ar, sort_order, lessons(id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)')
    .eq('course_id', course.id)
    .order('sort_order');

  const lessons = (modules ?? [])
    .flatMap((module) => (module.lessons as unknown as { id: string; title_ar: string; title_en: string | null; kind: string; duration_minutes: number | null; summary_ar: string | null; sort_order: number }[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order);

  const lessonIds = lessons.map((lesson) => lesson.id);

  const [{ data: progress }, { data: assignments }] = await Promise.all([
    supabase.from('lesson_progress').select('lesson_id, status').eq('profile_id', user.id).in('lesson_id', lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('assignments')
      .select('id, kind, lesson_id, course_id, title_ar, brief_ar, required_evidence, is_required, is_group_work')
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

  const { data: isComplete } = await supabase.rpc('is_course_complete', {
    p_profile: user.id,
    p_course: course.id,
  });

  const completedLessons = new Set(
    (progress ?? []).filter((row) => row.status === 'completed').map((row) => row.lesson_id),
  );

  const revalidate = `/academy/${pathSlug}/${courseSlug}`;
  const typedAssignments = (assignments ?? []) as Assignment[];
  const courseProject = typedAssignments.find((assignment) => assignment.kind === 'course_project');
  const courseTask = typedAssignments.find((assignment) => assignment.kind === 'course_task');

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

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{course.title_ar}</h2>
          <span className={`status-pill ${isComplete ? 'status-ok' : 'status-muted'}`}>
            {isComplete ? t('مكتملة', 'Completed') : t('قيد التقدّم', 'In progress')}
          </span>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>{course.description_ar}</p>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
          {t('الشهادة تتطلب إكمال كل الدروس ', 'The certificate needs every lesson finished ')}
          <strong>{t('واعتماد', 'and')}</strong>
          {t(' كل الأعمال المطلوبة أدناه.', ' every required piece of work below approved.')}
        </p>
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{t('دروس الدورة', 'Course lessons')}</h3>
            {lessons.map((lesson) => {
              const done = completedLessons.has(lesson.id);
              return (
                <div className="lesson-row" key={lesson.id}>
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
                  <div className="lesson-info">
                    <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{lesson.title_ar}</span>
                    {lesson.summary_ar && (
                      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>{lesson.summary_ar}</p>
                    )}
                    <div className="lesson-meta">
                      <span className="tag">{LESSON_KIND_LABELS[lesson.kind] ? t(LESSON_KIND_LABELS[lesson.kind]) : lesson.kind}</span>
                      {lesson.duration_minutes && <span className="eng">{lesson.duration_minutes} min</span>}
                      {lesson.title_en && <span className="eng muted">{lesson.title_en}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {typedAssignments
            .filter((assignment) => assignment.kind === 'lesson_assignment')
            .map((assignment) => {
              const submission = submissionFor(assignment.id);
              return (
                <SubmissionPanel
                  key={assignment.id}
                  assignmentId={assignment.id}
                  title={assignment.title_ar}
                  brief={assignment.brief_ar}
                  requiredEvidence={assignment.required_evidence}
                  submission={submission}
                  evaluations={evaluationsFor(submission?.id)}
                  hasOpenReevaluation={hasOpenReevaluation(submission?.id)}
                  revalidatePath={revalidate}
                />
              );
            })}
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
