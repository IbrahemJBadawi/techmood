import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, type Text } from '@/lib/i18n';
import type { Assignment, Evaluation, Lesson, LessonVideo, Submission } from '@/lib/database.types';

import { Pomodoro } from '../../../../home/student/Pomodoro';
import { toggleLesson, type Precheck, type QuizState } from '../../../actions';
import { LessonQuiz } from '../../../LessonQuiz';
import { aiConfigured } from '@/lib/ai-provider';
import { LessonBoard } from '../../../LessonBoard';
import { ShareDraft } from '../../../ShareDraft';
import { siteOrigin } from '@/lib/site';
import { SubmissionPanel } from '../../../SubmissionPanel';
import { CredentialPanel } from '../../../CredentialPanel';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';
import { LessonPlayer } from '@/components/LessonPlayer';
import { CelebrateSubmit } from '@/components/CelebrateSubmit';

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
  'outcomes_ar' | 'case_study_ar' | 'case_question_ar' | 'challenge_ar' | 'sort_order' | 'status'>;

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

  const [{ data: course }, { data: pathRow }] = await Promise.all([
    supabase.from('courses').select('id, slug, title_ar, title_en, status, author_id').eq('slug', courseSlug).single(),
    supabase.from('learning_paths').select('id, slug, title_ar, title_en').eq('slug', pathSlug).maybeSingle(),
  ]);
  if (!course) notFound();

  // A course still being written (the mentor's studio, 0115) is previewed by
  // its author and by admins: drafts included, nothing can be completed.
  const { data: isAdmin } = course.status === 'draft' ? await supabase.rpc('is_admin') : { data: false };
  const preview = course.status === 'draft' && (course.author_id === user.id || isAdmin === true);
  // A hidden (draft) or switched-off (archived) course is closed lesson by
  // lesson too, exactly as its course page is — not only on the map.
  if (course.status === 'draft' && !preview) notFound();
  if (course.status === 'archived') {
    const { data: admin } = await supabase.rpc('is_admin');
    if (admin !== true) notFound();
  }
  const path = pathRow ?? (preview ? { id: '', slug: pathSlug, title_ar: 'معاينة', title_en: 'Preview' } : null);
  if (!path) notFound();

  // Every lesson of the course, in teaching order: the current one, and the
  // one after it, come from the same list — there is no "next lesson" column.
  const { data: modules } = await supabase
    .from('modules')
    .select('id, sort_order, lessons(id, slug, title_ar, title_en, kind, duration_minutes, summary_ar, outcomes_ar, case_study_ar, case_question_ar, challenge_ar, sort_order, status)')
    .eq('course_id', course.id)
    .order('sort_order');

  const lessons = (modules ?? [])
    .flatMap((module) => ((module.lessons as unknown as LessonRow[]) ?? [])
      .filter((lesson) => lesson.status === 'published' || lesson.status === 'planned' || (preview && lesson.status === 'draft'))
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
    supabase.from('assignments').select('id, kind, lesson_id, course_id, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work').eq('lesson_id', lesson.id).in('status', preview ? ['published', 'draft'] : ['published']),
    supabase.from('lesson_progress').select('status').eq('profile_id', user.id).eq('lesson_id', lesson.id).maybeSingle(),
    supabase.rpc('lesson_board', { p_lesson: lesson.id }),
  ]);

  // What finishing this lesson proves: what the lesson teaches and what its
  // own assignment demands. A course and a path read the same union through
  // course_skills() and path_skills(), so the three cannot disagree.
  const { data: skills } = await supabase.rpc('lesson_skills_all', { p_lesson: lesson.id });

  // A credential lesson reads its ladder off the records. When it is one, the
  // "mark as done" button only appears once both halves are in — the database
  // would refuse the tick before then, and a button that always fails is worse
  // than no button.
  const { data: credentialRows } = await supabase.rpc('credential_lesson_state', { p_lesson: lesson.id });
  const credential = credentialRows?.[0] ?? null;
  // A «قريباً» lesson is shown but cannot be finished until it is published (0078).
  const soon = lesson.status !== 'published';
  // Lessons open in order inside a course (0124): until the one before is
  // finished, this one shows only where it sits and the way back.
  const { data: unlockedRow } = preview || soon ? { data: true } : await supabase.rpc('lesson_unlocked', { p_lesson: lesson.id });
  const locked = unlockedRow === false;
  const previousOpen = lessons.slice(0, index).reverse().find((item) => item.status === 'published') ?? null;
  const canTick = !preview && !soon && !locked && (!credential || (credential.verified && credential.applied) || credential.completed);

  // The short quiz (0139): once the lesson has one, it is passed before the
  // lesson completes. Without one (the model was unreachable) nothing waits on it.
  const [{ data: quizRow }, aiReady] = canTick
    ? await Promise.all([supabase.rpc('lesson_quiz', { p_lesson: lesson.id }), aiConfigured(supabase)])
    : [{ data: null }, false];
  const quiz = (quizRow as QuizState | null) ?? null;

  const assignment = ((assignments ?? []) as Assignment[])[0] ?? null;

  let submission: Submission | null = null;
  let evaluations: Evaluation[] = [];
  let precheck: Precheck | null = null;
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
        .select('id, submission_id, version_id, evaluator_id, decision, stars, score, feedback_ar, created_at, evaluator:evaluator_id(full_name, display_name, techmood_id, avatar_url)')
        .eq('submission_id', submission.id)
        .order('created_at');
      evaluations = (rows ?? []) as unknown as Evaluation[];

      // The first look at the newest version (0140), if it has had one.
      const { data: latest } = await supabase
        .from('submission_versions').select('id')
        .eq('submission_id', submission.id).eq('version', submission.current_version).maybeSingle();
      if (latest) {
        const { data: look } = await supabase
          .from('submission_prechecks').select('status, result, created_at')
          .eq('version_id', latest.id).maybeSingle();
        precheck = (look as Precheck | null) ?? null;
      }
    }
  }

  const done = progress?.status === 'completed';
  const here = `/academy/${pathSlug}/${courseSlug}/${lessonSlug}`;

  // Derived, never stored: the lesson's code, where its work belongs in a
  // portfolio, and the draft of the post the document ends each lesson with.
  const position = index + 1;
  const code = `TM-${courseSlug.toUpperCase()}-L${String(position).padStart(2, '0')}`;
  const folder = `TechMood_${pathSlug.toUpperCase()}/${courseSlug}/${lessonSlug}`;
  // The post ends with the member's public TechMood record, so whoever reads
  // it on LinkedIn can see the work behind it.
  const [{ data: me }, origin] = await Promise.all([
    user ? supabase.from('profiles').select('techmood_id').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    siteOrigin(),
  ]);
  const shareDraft = [
    `🚀 Completed Lesson ${position} of TechMood — ${contentText('en', path.title_ar, path.title_en)}!`,
    '',
    `Today I worked through "${contentText('en', lesson.title_ar, lesson.title_en)}"`
      + (assignment ? ` and built ${assignment.title_ar}.` : '.'),
    ...(me?.techmood_id ? ['', `My TechMood record: ${origin}/u/${me.techmood_id}`] : []),
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

      <section className="panel section-block lesson-head">
        <div className="lesson-steps-bar" aria-label={t(`الدرس ${position} من ${lessons.length}`, `Lesson ${position} of ${lessons.length}`)}>
          {lessons.map((item, index) => (
            <span key={item.id} className={index + 1 < position ? 'is-past' : index + 1 === position ? 'is-now' : ''} />
          ))}
        </div>
        <p className="lesson-position">
          {t(`الدرس ${position} من ${lessons.length}`, `Lesson ${position} of ${lessons.length}`)}
        </p>
        <h2 className="lesson-title">{title}</h2>
        <div className="lesson-meta">
          <span className="tag">{KIND_LABEL[lesson.kind] ? t(KIND_LABEL[lesson.kind]) : lesson.kind}</span>
          {lesson.duration_minutes && <span>{t(`${lesson.duration_minutes} دقيقة`, `${lesson.duration_minutes} min`)}</span>}
          <span className="id-chip">{code}</span>
          <AskAI prompt={`اشرح لي فكرة درس «${lesson.title_ar}» بكلمات أبسط ومثال واحد.`} />
        </div>
        {lesson.summary_ar && <p className="muted lesson-summary lesson-text">{lesson.summary_ar}</p>}
        {preview && (
          <p className="notice notice-warn" style={{ marginTop: 10 }}>
            {t('معاينة — هكذا سيرى المتعلم هذا الدرس بعد نشر الدورة. لا يُكمَل ولا يُسلَّم شيء في المعاينة.',
               'Preview — this is how a learner will see the lesson once the course is published. Nothing can be completed or handed in here.')}
          </p>
        )}
        {soon && !preview && (
          <p className="notice" style={{ marginTop: 10 }}>
            {t('هذا الدرس قيد التحضير — اقرأ ما هو جاهز منه، ويُفتح للإكمال حين يُنشر.', 'This lesson is being prepared — read what is ready; it can be completed once it is published.')}
          </p>
        )}
        {!soon && (lesson.kind === 'video' || lesson.kind === 'live') && (videos ?? []).length === 0 && (
          <p className="notice" style={{ marginTop: 10 }}>
            {t('فيديو هذا الدرس يُضاف قريباً. تقدر تدرسه الآن من الملخص والمصادر وتبدأ التكليف، وتكمله كالمعتاد.',
               'This lesson’s video is coming soon. You can study it now from the summary and sources, start the assignment, and complete it as usual.')}
          </p>
        )}
        {canTick && quiz && (quiz.ready || (!done && aiReady)) && (
          <LessonQuiz lessonId={lesson.id} initial={quiz} canWrite={aiReady && !done} revalidate={here} />
        )}
        {canTick && (
          <form action={toggleLesson} className="lesson-done-form">
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <input type="hidden" name="completed" value={String(done)} />
            <input type="hidden" name="revalidate" value={here} />
            {!done && quiz?.ready && !quiz.passed ? (
              <>
                <button className="btn btn-primary btn-lg" type="button" disabled>{t('علّم الدرس كمكتمل', 'Mark the lesson as done')}</button>
                <p className="muted lesson-done-hint">{t('اجتز الاختبار القصير أعلاه أولاً — إجابتان صحيحتان من ثلاث.', 'Pass the short quiz above first — two right answers of three.')}</p>
              </>
            ) : (
              <CelebrateSubmit className={`btn ${done ? 'btn-ghost' : 'btn-primary btn-lg'}`} off={done}>
                {done ? t('✓ مكتمل — تراجع', '✓ Done — undo') : t('علّم الدرس كمكتمل', 'Mark the lesson as done')}
              </CelebrateSubmit>
            )}
          </form>
        )}
      </section>

      {credential && (
        <CredentialPanel lessonId={lesson.id} state={credential} revalidate={here} />
      )}

      {locked && (
        <section className="panel section-block lesson-locked">
          <p className="lesson-lock-icon" aria-hidden="true">🔒</p>
          <h3>{t('هذا الدرس مقفل حتى تُكمل الدرس السابق', 'This lesson opens once you finish the one before it')}</h3>
          <p className="muted">{t('الدروس داخل الدورة تُفتح بالترتيب — أكمل الدرس السابق وعلّمه كمكتمل.', 'Lessons inside a course open in order — finish the previous lesson and mark it done.')}</p>
          {previousOpen && (
            <Link className="btn btn-primary" href={`/academy/${pathSlug}/${courseSlug}/${previousOpen.slug}`}>
              {t('الدرس السابق: ', 'Previous lesson: ')}{contentText(locale, previousOpen.title_ar, previousOpen.title_en)}
            </Link>
          )}
        </section>
      )}

      {!locked && (
      <div className="detail-grid">
          <section>
            {(skills ?? []).length > 0 && (
              <section className="panel section-block ls-tone is-proves">
                <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">🎯</span>{t('ما يثبته هذا الدرس', 'What finishing this proves')}</h3>
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
              <section className="panel section-block ls-tone is-learn">
                <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">💡</span>{t('ما ستتعلمه', 'What you will learn')}</h3>
                <ul className="lesson-outcomes">
                  {lesson.outcomes_ar.map((outcome) => <li key={outcome}>{outcome}</li>)}
                </ul>
              </section>
            )}
  
            {(videos ?? []).length > 0 && (
              <section className="panel section-block ls-tone is-watch">
                <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}><span className="ls-chip" aria-hidden="true">▶</span>{t('الشرح والتطبيق', 'Walkthroughs')}</h3>
                <LessonPlayer videos={((videos ?? []) as LessonVideo[]).map((video) => ({
                  id: video.id, title: contentText(locale, video.title_ar, video.title_en), url: video.url,
                  minutes: video.duration_minutes, description: video.description_ar,
                }))} />
              </section>
            )}
  
            {(resources ?? []).length > 0 && (
              <section className="panel section-block ls-tone is-links">
                <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">📚</span>{t('مصادر المراجعة', 'Review material')}</h3>
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
              <section className="panel section-block ls-tone is-case">
                <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">🧩</span>{t('دراسة حالة', 'Case study')}</h3>
                <p className="lesson-text" style={{ fontSize: '0.9rem', marginTop: 8 }}>{lesson.case_study_ar}</p>
                {lesson.case_question_ar && <p className="quote lesson-text">{lesson.case_question_ar}</p>}
              </section>
            )}
  
            {assignment && (
              <>
                {assignment.required_evidence.length > 0 && (
                  <section className="panel section-block ls-tone is-task">
                    <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">📤</span>{t('المطلوب تسليمه', 'What to hand in')}</h3>
                    <ul className="lesson-outcomes">
                      {assignment.required_evidence.map((kind) => (
                        <li key={kind}>{EVIDENCE_LABEL[kind] ? t(EVIDENCE_LABEL[kind]) : kind}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {preview ? (
                  <section className="panel section-block ls-tone is-task">
                    <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">📝</span>{assignment.title_ar}</h3>
                    {assignment.brief_ar && <p className="lesson-text" style={{ fontSize: '0.9rem', marginTop: 8 }}>{assignment.brief_ar}</p>}
                    <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
                      {t('هنا يسلّم المتعلم عمله بعد النشر.', 'This is where the learner hands in their work once published.')}
                    </p>
                  </section>
                ) : (
                  <SubmissionPanel
                    assignmentId={assignment.id}
                    title={assignment.title_ar}
                    brief={assignment.brief_ar}
                    requiredEvidence={assignment.required_evidence}
                    submission={submission}
                    evaluations={evaluations}
                    revalidatePath={here}
                    precheck={precheck}
                    precheckEnabled={aiReady}
                  />
                )}
              </>
            )}
  
            {lesson.challenge_ar && (
              <section className="panel section-block ls-tone is-challenge">
                <h3 style={{ fontSize: '0.98rem' }}><span className="ls-chip" aria-hidden="true">🚀</span>{t('تحدٍّ إضافي — اختياري', 'An extra challenge — optional')}</h3>
                <p className="lesson-text" style={{ fontSize: '0.9rem', marginTop: 8 }}>{lesson.challenge_ar}</p>
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
      )}
    </>
  );
}
