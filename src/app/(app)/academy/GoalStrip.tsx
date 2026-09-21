import Link from 'next/link';

import { contentText } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n.server';
import type { Database } from '@/lib/database.types';

type Goal = Database['public']['Functions']['career_goals_catalogue']['Returns'][number];
type Step = Database['public']['Functions']['career_goal_plan']['Returns'][number];

/**
 * The goal band under the hero: one line about where all this is going.
 *
 * Someone who has chosen a goal sees how far along they are and the one rung
 * in front of them. Someone who has not sees the question the academy would
 * rather they answered than "which course looks interesting".
 */
export async function GoalStrip({ goal, next }: { goal: Goal | null; next: Step | null }) {
  const t = await getT();
  const locale = await getLocale();

  if (!goal) {
    return (
      <section className="section-block">
        <div className="panel goal-strip">
          <div>
            <p className="kicker">{t('قبل اختيار دورة', 'Before picking a course')}</p>
            <h3 style={{ fontSize: '1rem', margin: '4px 0' }}>{t('ماذا تريد أن تصبح؟', 'What do you want to become?')}</h3>
            <p className="muted" style={{ fontSize: '0.84rem' }}>
              {t('اختر هدفاً مهنياً وستجد أمامك سلّماً مرتّباً بدل قائمة دورات.',
                 'Choose a career goal and you get an ordered ladder instead of a list of courses.')}
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/academy/goals">{t('اختر هدفك', 'Choose your goal')}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-block">
      <div className="panel goal-strip">
        <div>
          <p className="kicker">{t('هدفك المهني', 'Your career goal')}</p>
          <h3 style={{ fontSize: '1rem', margin: '4px 0' }}>{contentText(locale, goal.title_ar, goal.title_en)}</h3>
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            {t(`${goal.steps_done} من ${goal.steps_total} خطوات`, `${goal.steps_done} of ${goal.steps_total} steps`)}
            {next && ` · ${t('التالي: ', 'Next: ')}${contentText(locale, next.title_ar, next.title_en)}`}
          </p>
          <div
            className="progress-track"
            style={{ marginTop: 8, maxWidth: 320 }}
            role="progressbar"
            aria-valuenow={goal.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('تقدّمك نحو الهدف', 'Progress towards the goal')}
          >
            <div className="progress-fill" style={{ width: `${goal.percent}%` }} />
          </div>
        </div>
        <Link className="btn btn-ghost btn-sm" href={`/academy/goals/${goal.slug}`}>{t('اعرض الخطة', 'See the plan')}</Link>
      </div>
    </section>
  );
}
