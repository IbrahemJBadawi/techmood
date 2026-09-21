import type { Database } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';

import { ContinueLearning, type Resume } from '../home/student/ContinueLearning';
import { AcademyExplorer } from './AcademyExplorer';
import { AcademyHero } from './AcademyHero';
import { AcademyMap } from './AcademyMap';
import { GoalStrip } from './GoalStrip';
import { CourseCard } from './CourseCard';
import { EmptyState } from './EmptyState';
import { PathCard } from './PathCard';
import {
  LEVEL_ORDER, pathTitle,
  type AcademyCourse, type AcademyPath, type AcademyRoadmapPath,
} from './types';

type Goal = Database['public']['Functions']['career_goals_catalogue']['Returns'][number];
type GoalStep = Database['public']['Functions']['career_goal_plan']['Returns'][number];

const SUGGESTION_LIMIT = 3;
const MY_COURSES_LIMIT = 6;

/** In progress first, then untouched, then what is already behind you. */
const BY_ATTENTION: Record<string, number> = { in_progress: 0, not_started: 1, completed: 2 };

/**
 * The academy is where learning is discovered, chosen and resumed.
 *
 * Read top to bottom it answers: where do I stand, what am I looking for, which
 * field, what am I already on, where did I stop, what would suit me next, which
 * courses are in front of me, and what else exists.
 *
 * Every number on this page — progress, completion, status, level — is computed
 * by academy_paths() and academy_courses() from the same helpers the path and
 * course pages use, so no two screens can disagree about what "complete" means.
 */
export default async function AcademyPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const [
    { data: pathRows },
    { data: courseRows },
    { data: resumeRows },
    { data: roadmapRows },
    { data: schoolRows },
    { data: goalRows },
  ] = await Promise.all([
    supabase.rpc('academy_paths'),
    supabase.rpc('academy_courses'),
    supabase.rpc('continue_learning'),
    supabase.rpc('academy_roadmap'),
    supabase.from('schools').select('slug, name_ar, name_en').order('sort_order'),
    supabase.rpc('career_goals_catalogue'),
  ]);

  // The chosen goal, and the one rung in front of it. A learner who has chosen
  // nothing costs one query; the plan is only fetched when there is a goal.
  const goal = ((goalRows ?? []) as Goal[]).find((row) => row.is_chosen) ?? null;
  let nextStep: GoalStep | null = null;
  if (goal) {
    const { data: planRows } = await supabase.rpc('career_goal_plan', { p_goal: goal.slug });
    nextStep = ((planRows ?? []) as GoalStep[]).find((step) => !step.is_done && step.is_open) ?? null;
  }

  const paths = (pathRows ?? []) as AcademyPath[];
  const courses = (courseRows ?? []) as AcademyCourse[];
  const roadmap = (roadmapRows ?? []) as AcademyRoadmapPath[];
  const schools = schoolRows ?? [];
  const resume = ((resumeRows as Resume[] | null) ?? [])[0] ?? null;

  const myPaths = paths
    .filter((path) => path.is_enrolled || path.status !== 'not_started')
    .sort((a, b) => (BY_ATTENTION[a.status] ?? 3) - (BY_ATTENTION[b.status] ?? 3));

  const pathsInProgress = paths.filter((path) => path.status === 'in_progress').length;
  const pathsCompleted = paths.filter((path) => path.is_complete).length;
  const coursesCompleted = courses.filter((course) => course.is_complete).length;
  const lessonsCompleted = courses.reduce((sum, course) => sum + course.lessons_done, 0);

  // Suggestions lean towards the schools this learner already chose, and fall
  // back to the start of the catalogue for somebody who has chosen nothing yet.
  const mySchools = new Set(myPaths.map((path) => path.school_slug).filter(Boolean));
  const openPaths = paths.filter((path) => !myPaths.includes(path));
  const suggestedPaths = [...openPaths]
    .sort((a, b) => Number(mySchools.has(b.school_slug)) - Number(mySchools.has(a.school_slug)))
    .slice(0, SUGGESTION_LIMIT);

  const myCourses = courses
    .filter((course) => course.in_enrolled_path)
    .sort((a, b) => (BY_ATTENTION[a.status] ?? 3) - (BY_ATTENTION[b.status] ?? 3));

  // The next rung: one step past the highest level already finished.
  const highestDone = courses
    .filter((course) => course.is_complete)
    .reduce((top, course) => Math.max(top, LEVEL_ORDER.indexOf(course.level)), -1);
  const reach = LEVEL_ORDER[Math.min(highestDone + 1, LEVEL_ORDER.length - 1)];
  const openCourses = courses.filter((course) => !course.in_enrolled_path && course.status === 'not_started');
  const suggestedCourses = [
    ...openCourses.filter((course) => course.level === reach),
    ...openCourses.filter((course) => course.level !== reach),
  ].slice(0, SUGGESTION_LIMIT);

  const heroAction = resume
    ? {
        href: `/academy/${resume.path_slug}/${resume.course_slug}`,
        label: t('تابع التعلّم', 'Continue learning'),
        note: t('آخر درس فتحته ينتظرك.', 'The last lesson you opened is waiting.'),
      }
    : myPaths.length > 0
      ? {
          href: `/academy/${myPaths[0].slug}`,
          label: t('افتح مسارك', 'Open your path'),
          note: pathTitle(locale, myPaths[0]),
        }
      : {
          href: '#academy-explore',
          label: t('اختر مسارك الأول', 'Choose your first path'),
          note: t('المسارات مفتوحة دائماً — لا دفعات ولا انتظار.', 'Paths are always open — no cohorts, nothing to wait for.'),
        };

  return (
    <>
      <AcademyHero
        pathsInProgress={pathsInProgress}
        pathsCompleted={pathsCompleted}
        coursesCompleted={coursesCompleted}
        lessonsCompleted={lessonsCompleted}
        action={heroAction}
      />

      <GoalStrip goal={goal} next={nextStep} />

      <AcademyExplorer paths={paths} courses={courses} roadmap={roadmap}>
        {/* ---- my paths ---- */}
        <section className="section-block" aria-labelledby="academy-my-paths">
          <h2 id="academy-my-paths" className="academy-heading">{t('مساراتي', 'My paths')}</h2>
          {myPaths.length === 0 ? (
            <EmptyState
              title={t('لم تلتحق بمسار بعد', 'You have not joined a path yet')}
              note={t('اختر مساراً من الكتالوج أدناه وابدأ من أول دورة فيه.',
                      'Pick a path from the catalogue below and start with its first course.')}
              actionLabel={t('تصفّح المسارات', 'Browse paths')}
              actionHref="#academy-explore"
            />
          ) : (
            <div className="card-grid">
              {myPaths.map((path) => <PathCard path={path} key={path.id} />)}
            </div>
          )}
        </section>

        {/* ---- continue learning ---- */}
        {resume && (
          <section className="section-block" aria-labelledby="academy-continue">
            <h2 id="academy-continue" className="academy-heading">{t('أكمل من حيث توقّفت', 'Pick up where you left off')}</h2>
            <ContinueLearning resume={resume} />
          </section>
        )}

        {/* ---- suggested paths ---- */}
        {suggestedPaths.length > 0 && (
          <section className="section-block" aria-labelledby="academy-suggested-paths">
            <h2 id="academy-suggested-paths" className="academy-heading">{t('مسارات مقترحة لك', 'Paths suggested for you')}</h2>
            <p className="muted academy-why">
              {mySchools.size > 0
                ? t('من المدارس نفسها التي بدأت منها.', 'From the same schools you already started in.')
                : t('نقاط بداية جيدة، كلها من الصفر.', 'Good places to start, all of them from zero.')}
            </p>
            <div className="card-grid">
              {suggestedPaths.map((path) => <PathCard path={path} key={path.id} />)}
            </div>
          </section>
        )}

        {/* ---- courses inside my paths ---- */}
        {myCourses.length > 0 && (
          <section className="section-block" aria-labelledby="academy-my-courses">
            <h2 id="academy-my-courses" className="academy-heading">{t('دورات مساراتي', 'Courses in my paths')}</h2>
            <div className="card-grid">
              {myCourses.slice(0, MY_COURSES_LIMIT).map((course) => <CourseCard course={course} key={course.id} />)}
            </div>
          </section>
        )}

        {/* ---- suggested courses ---- */}
        {suggestedCourses.length > 0 && (
          <section className="section-block" aria-labelledby="academy-suggested-courses">
            <h2 id="academy-suggested-courses" className="academy-heading">{t('دورات مقترحة لك', 'Courses suggested for you')}</h2>
            <div className="card-grid">
              {suggestedCourses.map((course) => <CourseCard course={course} key={course.id} />)}
            </div>
          </section>
        )}
      </AcademyExplorer>

      <AcademyMap schools={schools} paths={paths} roadmap={roadmap} />
    </>
  );
}
