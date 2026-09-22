import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, type Text } from '@/lib/i18n';
import type { Assignment, Evaluation, Lesson, LessonVideo, Submission } from '@/lib/database.types';

import { Pomodoro } from '../../../../home/student/Pomodoro';
import { toggleLesson } from '../../../actions';
import { LessonBoard } from '../../../LessonBoard';
import { ShareDraft } from '../../../ShareDraft';
import { SubmissionPanel } from '../../../SubmissionPanel';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';

const KIND_LABEL: Record<string, Text> = {
  video:    { ar: 'فيديو',       en: 'Video' },
  article:  { ar: 'مقال',        en: 'Article' },
  reading:  { ar: 'قراءة',       en: 'Reading' },
  exercise: { ar: 'تمرين',       en: 'Exercise' },
  live:     { ar: 'جلسة مباشرة', en: 'Live session' },
};

const EVIDENCE_LABEL: Record<string, Text> = {
  github:    { ar: 'مستودع الكود',   en: 'Code repository' },
  linkedin:  { ar: 'منشور توثيق',    en: 'A write-up post' },
  youtube:   { ar: 'فيديو شرح',      en: 'A walkthrough video' },
  drive:     { ar: 'ملفات',          en: 'Files' },
  portfolio: { ar: 'معرض الأعمال',   en: 'Portfolio' },
  website:   { ar: 'موقع',           en: 'A website' },
  file:      { ar: 'ملف',            en: 'A file' },
};

type LessonRow = Pick<Lesson,
  'id' | 'slug' | 'title_ar' | 'title_en' | 'kind' | 'duration_minutes' | 'summary_ar' |
  'outcomes_ar' | 'case_study_ar' | 'case_question_ar' | 'challenge_ar' | 'sort_order'>;

/**
 * One lesson, with everything it takes to finish it.
 *
 * The order is the order of doing the work: what it is, what you will be able
 * to do, what to watch, what to read, what to build, what to hand in, and what
 * comes next — with the board and the timer beside it.
 *
 * Sections the lesson does not carry are not rendered as empty boxes. A lesson
 * whose videos have not been added yet simply has no video section; the page
 * never pretends there is content where there is none.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ pathSlug: string; courseSlug: string; lessonSlug: string }>;
}) {
  const { pathSlug, courseSlug, lessonSlug } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: course }, { data: path }] = await Promise.all([
    supabase.from('courses').select('id, slug, title_ar, title_en').eq('slug', courseSlug).single(),
    supabase.from('learning_paths').select('id, slug, title_ar, title_en').eq('slug', pathSlug).single(),
  ]);
  if (!course || !path) notFound();

  // Every lesson of the course, in teaching order: the current one, and the
  // one after it, come from the same list — there is no "next lesson" column.
  const { data: modules } = await supabase
    .from('modules')
    .select('id, sort_order, lessons(id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, outcomes_ar, case_study_ar, case_question_ar, challenge_ar, sort_order)')
    .eq('course_id', course.id)
    .order('sort_order');

  const lessons = (modules ?? [])
    .flatMap((module) => ((module.lessons as unknown as LessonRow[]) ?? [])
      .map((lesson) => ({ lesson, moduleOrder: module.sort_order })))
    .sort((a, b) => a.moduleOrder - b.moduleOrder || a.lesson.sort_order - b.lesson.sort_order)
    .map((entry) => entry.lesson);

  const index = lessons.findIndex((row) => row.slug === lessonSlug);
  if (index === -1) notFound();
  const lesson = lessons[index];
  const next = lessons[index + 1] ?? null;

  const [
    { data: videos },
    { data: resources },
    { data: assignments },
    { data: progress },
    { data: board },
  ] = await Promise.all([
    supabase.from('lesson_videos').select('id, lesson_id, title_ar, title_en, description_ar, url, duration_minutes, sort_order').eq('lesson_id', lesson.id).order('sort_order'),
    supabase.from('lesson_resources').select('id, lesson_id, label, url, kind').eq('lesson_id', lesson.id),
    supabase.from('assignments').select('id, kind, lesson_id, course_id, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work').eq('lesson_id', lesson.id),
    supabase.from('lesson_progress').select('status').eq('profile_id', user.id).eq('lesson_id', lesson.id).maybeSingle(),
    supabase.rpc('lesson_board', { p_lesson: lesson.id }),
  ]);

  // What finishing this lesson proves: what the lesson teaches and what its
  // own assignment demands. A course and a path read the same union through
  // course_skills() and path_skills(), so the three cannot disagree.
  const { data: skills } = await supabase.rpc('lesson_skills_all', { p_lesson: lesson.id });

  const assignment = ((assignments ?? []) as Assignment[])[0] ?? null;

  let submission: Submission | null = null;
  let evaluations: Evaluation[] = [];
  if (assignment) {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, assignment_id, profile_id, team_id, status, current_version, created_at, updated_at')
      .eq('profile_id', user.id)
      .eq('assignment_id', assignment.id);
    submission = ((submissions ?? []) as Submission[])[0] ?? null;

    if (submission) {
      const { data: rows } = await supabase
        .from('evaluations')
        .select('id, submission_id, version_id, evaluator_id, decision, stars, score, feedback_ar, created_at')
        .eq('submission_id', submission.id)
        .order('created_at');
      evaluations = (rows ?? []) as Evaluation[];
    }
  }

  const done = progress?.status === 'completed';
  const here = `/academy/${pathSlug}/${courseSlug}/${lessonSlug}`;

  // Derived, never stored: the lesson's code, where its work belongs in a
  // portfolio, and the draft of the post the document ends each lesson with.
  const position = index + 1;
  const code = `TM-${courseSlug.toUpperCase()}-L${String(position).padStart(2, '0')}`;
  const folder = `TechMood_${pathSlug.toUpperCase()}/${courseSlug}/${lessonSlug}`;
  const shareDraft = [
    `🚀 Completed Lesson ${position} of TechMood — ${contentText('en', path.title_ar, path.title_en)}!`,
    '',
    `Today I worked through "${contentText('en', lesson.title_ar, lesson.title_en)}"`
      + (assignment ? ` and built ${assignment.title_ar}.` : '.'),
    '',
    '#TechMood #Learning',
  ].join('\n');

  const title = contentText(locale, lesson.title_ar, lesson.title_en);

  return (
    <>
      <AiSurface surface="lesson" entityType="lesson" entityId={lesson.id} label={title} />

      <nav className="lesson-trail" aria-label={t('مكانك', 'Where you are')}>
        <Link href={`/academy/${pathSlug}`}>{contentText(locale, path.title_ar, path.title_en)}</Link>
        <span aria-hidden>/</span>
        <Link href={`/academy/${pathSlug}/${courseSlug}`}>{contentText(locale, course.title_ar, course.title_en)}</Link>
      </nav>

      <section className="panel section-block">
        <div className="row-between">
          <div>
            <p className="kicker eng">{code}</p>
            <h2 style={{ fontSize: '1.2rem', margin: '4px 0' }}>{title}</h2>
            <div className="lesson-meta">
              <span className="tag">{KIND_LABEL[lesson.kind] ? t(KIND_LABEL[lesson.kind]) : lesson.kind}</span>
              {lesson.duration_minutes && <span className="eng">{lesson.duration_minutes} min</span>}
              <span className="eng muted">{t(`الدرس ${position} من ${lessons.length}`, `Lesson ${position} of ${lessons.length}`)}</span>
              <AskAI prompt={`اشرح لي فكرة درس «${lesson.title_ar}» بكلمات أبسط ومثال واحد.`} />
            </div>
          </div>
          <form action={toggleLesson}>
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <input type="hidden" name="completed" value={String(done)} />
            <input type="hidden" name="revalidate" value={here} />
            <button className={`btn btn-sm ${done ? 'btn-ghost' : 'btn-primary'}`} type="submit">
              {done ? t('✓ مكتمل — تراجع', '✓ Done — undo') : t('علّم كمكتمل', 'Mark as done')}
            </button>
          </form>
        </div>
        {lesson.summary_ar && <p className="muted" style={{ fontSize: '0.9rem', marginTop: 10 }}>{lesson.summary_ar}</p>}
      </section>

      <div className="detail-grid">
        <section>
          {(skills ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('ما يثبته هذا الدرس', 'What finishing this proves')}</h3>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                {t('تُضاف هذه المهارات إلى ملفك موثّقة حين يعتمد المنتور تكليف هذا الدرس — لا قبل ذلك.',
                   'These land on your profile as proven when a mentor approves this lesson\u2019s assignment — not before.')}
              </p>
              <div className="tags-row" style={{ marginTop: 10 }}>
                {(skills ?? []).map((skill) => (
                  <span className="tag" key={skill.slug}>{contentText(locale, skill.name_ar, skill.name_en)}</span>
                ))}
              </div>
            </section>
          )}

          {lesson.outcomes_ar.length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('ما ستتعلمه', 'What you will learn')}</h3>
              <ul className="lesson-outcomes">
                {lesson.outcomes_ar.map((outcome) => <li key={outcome}>{outcome}</li>)}
              </ul>
            </section>
          )}

          {(videos ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('الشرح والتطبيق', 'Walkthroughs')}</h3>
              <ul className="lesson-links">
                {((videos ?? []) as LessonVideo[]).map((video) => (
                  <li key={video.id}>
                    <a href={video.url} target="_blank" rel="noreferrer">
                      {contentText(locale, video.title_ar, video.title_en)}
                    </a>
                    {video.duration_minutes && <span className="eng muted"> · {video.duration_minutes} min</span>}
                    {video.description_ar && <p className="muted">{video.description_ar}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(resources ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('مصادر المراجعة', 'Review material')}</h3>
              <ul className="lesson-links">
                {(resources ?? []).map((resource) => (
                  <li key={resource.id}>
                    <a href={resource.url} target="_blank" rel="noreferrer">{resource.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lesson.case_study_ar && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('دراسة حالة', 'Case study')}</h3>
              <p style={{ fontSize: '0.9rem', marginTop: 8 }}>{lesson.case_study_ar}</p>
              {lesson.case_question_ar && <p className="quote">{lesson.case_question_ar}</p>}
            </section>
          )}

          {assignment && (
            <>
              {assignment.required_evidence.length > 0 && (
                <section className="panel section-block">
                  <h3 style={{ fontSize: '0.98rem' }}>{t('المطلوب تسليمه', 'What to hand in')}</h3>
                  <ul className="lesson-outcomes">
                    {assignment.required_evidence.map((kind) => (
                      <li key={kind}>{EVIDENCE_LABEL[kind] ? t(EVIDENCE_LABEL[kind]) : kind}</li>
                    ))}
                  </ul>
                </section>
              )}
              <SubmissionPanel
                assignmentId={assignment.id}
                title={assignment.title_ar}
                brief={assignment.brief_ar}
                requiredEvidence={assignment.required_evidence}
                submission={submission}
                evaluations={evaluations}
                revalidatePath={here}
              />
            </>
          )}

          {lesson.challenge_ar && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('تحدٍّ إضافي — اختياري', 'An extra challenge — optional')}</h3>
              <p style={{ fontSize: '0.9rem', marginTop: 8 }}>{lesson.challenge_ar}</p>
            </section>
          )}

          <section className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('أين يُحفَظ هذا العمل', 'Where this work lives')}</h3>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
              {t('رتّب ملفاتك بهذا المسار حتى يبقى معرض أعمالك مقروءاً:',
                 'Keep your files under this path so your portfolio stays readable:')}
            </p>
            <p className="copy-row"><span className="cv">{folder}</span></p>
          </section>

          {next ? (
            <section className="panel section-block">
              <p className="kicker">{t('الدرس التالي', 'Next lesson')}</p>
              <h3 style={{ fontSize: '1rem', margin: '4px 0 10px' }}>
                {contentText(locale, next.title_ar, next.title_en)}
              </h3>
              <Link className="btn btn-primary btn-sm" href={`/academy/${pathSlug}/${courseSlug}/${next.slug}`}>
                {t('تابع', 'Continue')}
              </Link>
            </section>
          ) : (
            <section className="panel section-block">
              <p className="kicker">{t('آخر درس في الدورة', 'The last lesson of the course')}</p>
              <p className="muted" style={{ fontSize: '0.86rem', margin: '6px 0 10px' }}>
                {t('يبقى مشروع الدورة ومهمتها التطبيقية — وهما ما تُبنى عليه الشهادة.',
                   'The course task and project remain — and they are what the certificate is built on.')}
              </p>
              <Link className="btn btn-primary btn-sm" href={`/academy/${pathSlug}/${courseSlug}`}>
                {t('ارجع للدورة', 'Back to the course')}
              </Link>
            </section>
          )}
        </section>

        <aside>
          <LessonBoard steps={board ?? []} />
          <Pomodoro suggestion={lesson.title_ar} refTable="lessons" refId={lesson.id} />
          <div style={{ marginTop: 16 }}>
            <ShareDraft text={shareDraft} />
          </div>
        </aside>
      </div>
    </>
  );
}
