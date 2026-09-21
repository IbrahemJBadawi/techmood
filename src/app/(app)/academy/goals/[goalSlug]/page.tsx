import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, type Text } from '@/lib/i18n';
import type { Database, GoalMilestone } from '@/lib/database.types';

import { chooseGoal, clearGoal } from '../../actions';

type Step = Database['public']['Functions']['career_goal_plan']['Returns'][number];
type Goal = Database['public']['Functions']['career_goals_catalogue']['Returns'][number];

/** Where a milestone is actually earned. The plan links there, it does not award it. */
const MILESTONE_HREF: Record<GoalMilestone, string> = {
  assessment:   '/academy',
  real_project: '/academy',
  portfolio:    '/passport',
  mentorship:   '/mentors',
  team:         '/teams',
  work:         '/marketplace',
  startup:      '/incubator',
};

const MILESTONE_CTA: Record<GoalMilestone, Text> = {
  assessment:   { ar: 'إلى الأكاديمية',   en: 'To the academy' },
  real_project: { ar: 'إلى الأكاديمية',   en: 'To the academy' },
  portfolio:    { ar: 'إلى جواز سفرك',    en: 'To your passport' },
  mentorship:   { ar: 'إلى المنتورين',    en: 'To the mentors' },
  team:         { ar: 'إلى الفرق',        en: 'To the teams' },
  work:         { ar: 'إلى السوق',        en: 'To the marketplace' },
  startup:      { ar: 'إلى الحاضنة',      en: 'To the incubator' },
};

/**
 * One goal, rung by rung.
 *
 * The plan is a timeline and not a checklist, because the order is the point:
 * each rung stands on the one below it. Nothing here is stored — finish a
 * course anywhere in the academy, join a team, get an application accepted,
 * and the rung it belongs to moves by itself.
 *
 * A rung whose content is still an outline says so and offers no link. The
 * plan would rather admit a gap than send somebody into an empty page.
 */
export default async function GoalPlanPage({
  params,
}: {
  params: Promise<{ goalSlug: string }>;
}) {
  const { goalSlug } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: catalogue }, { data: planRows }] = await Promise.all([
    supabase.rpc('career_goals_catalogue'),
    supabase.rpc('career_goal_plan', { p_goal: goalSlug }),
  ]);

  const goal = ((catalogue ?? []) as Goal[]).find((row) => row.slug === goalSlug);
  if (!goal) notFound();

  const steps = (planRows ?? []) as Step[];
  const here = `/academy/goals/${goalSlug}`;
  // The next rung is the first one that is not behind you and can be taken.
  const next = steps.find((step) => !step.is_done && step.is_open) ?? null;

  const hrefFor = (step: Step) => {
    if (step.kind === 'path') return `/academy/${step.slug}`;
    if (step.kind === 'course') return step.path_slug ? `/academy/${step.path_slug}/${step.slug}` : null;
    return step.milestone ? MILESTONE_HREF[step.milestone] : null;
  };

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/academy/goals">{t('→ كل الأهداف', '← All goals')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between">
          <div>
            <p className="kicker">{t('هدف مهني', 'Career goal')}</p>
            <h2 style={{ fontSize: '1.3rem', margin: '4px 0' }}>{contentText(locale, goal.title_ar, goal.title_en)}</h2>
          </div>
          <form action={goal.is_chosen ? clearGoal : chooseGoal}>
            <input type="hidden" name="goal" value={goal.slug} />
            <input type="hidden" name="revalidate" value={here} />
            <button className={`btn btn-sm ${goal.is_chosen ? 'btn-ghost' : 'btn-primary'}`} type="submit">
              {goal.is_chosen ? t('ألغِ اختياره', 'Drop this goal') : t('اجعله هدفي', 'Make it my goal')}
            </button>
          </form>
        </div>

        {goal.outcome_ar && <p style={{ fontSize: '0.92rem', marginTop: 10 }}>{goal.outcome_ar}</p>}

        <div className="academy-progress" style={{ marginTop: 14, maxWidth: 420 }}>
          <div className="row-between">
            <span className="muted">
              {t(`${goal.steps_done} من ${goal.steps_total} خطوات`, `${goal.steps_done} of ${goal.steps_total} steps`)}
            </span>
            <span className="eng">{goal.percent}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={goal.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('تقدّمك نحو الهدف', 'Progress towards the goal')}
          >
            <div className="progress-fill" style={{ width: `${goal.percent}%` }} />
          </div>
        </div>
      </section>

      {next && (
        <section className="panel section-block">
          <p className="kicker">{t('خطوتك التالية', 'Your next step')}</p>
          <h3 style={{ fontSize: '1rem', margin: '4px 0 10px' }}>{contentText(locale, next.title_ar, next.title_en)}</h3>
          {hrefFor(next) && (
            <Link className="btn btn-primary btn-sm" href={hrefFor(next)!}>
              {next.kind === 'milestone' && next.milestone
                ? t(MILESTONE_CTA[next.milestone])
                : t('ابدأ', 'Start')}
            </Link>
          )}
        </section>
      )}

      <section className="section-block">
        <h3 className="academy-heading">{t('الخطة كاملة', 'The whole plan')}</h3>
        <ol className="timeline goal-plan">
          {steps.map((step) => {
            const href = hrefFor(step);
            const current = next?.step_id === step.step_id;
            return (
              <li className={step.is_done ? 'done' : current ? 'current' : ''} key={step.step_id}>
                <span className="tl-dot" aria-hidden />
                <div className="goal-step">
                  <span className="tl-label">
                    {contentText(locale, step.title_ar, step.title_en)}
                  </span>
                  <span className="goal-step-meta">
                    <span className="tag">
                      {step.kind === 'course' ? t('دورة', 'Course')
                        : step.kind === 'path' ? t('مسار', 'Path')
                        : t('محطة', 'Milestone')}
                    </span>
                    {step.is_done && <span className="status-pill status-ok">{t('✓ تمّ', '✓ Done')}</span>}
                    {!step.is_done && !step.is_open && (
                      <span className="tag">{t('قريباً', 'Not built yet')}</span>
                    )}
                    {step.percent !== null && step.percent > 0 && !step.is_done && (
                      <span className="eng muted">{step.percent}%</span>
                    )}
                  </span>
                  {step.note_ar && <p className="muted goal-step-note">{step.note_ar}</p>}
                  {href && !step.is_done && step.is_open && (
                    <Link className="goal-step-link" href={href}>
                      {step.kind === 'milestone' && step.milestone
                        ? t(MILESTONE_CTA[step.milestone])
                        : t('افتح', 'Open')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 12 }}>
          {t('لا شيء في هذه الخطة يُعلَّم يدوياً. كل خطوة تُقرأ من القاعدة التي تملكها أصلاً: إتمام الدورة، اعتماد العمل، مقعدك في فريق، قبول طلبك على فرصة.',
             'Nothing in this plan is ticked by hand. Every step is read from the rule that already owns it: course completion, approved work, your seat on a team, an accepted application.')}
        </p>
      </section>
    </>
  );
}
