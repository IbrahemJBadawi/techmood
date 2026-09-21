import Link from 'next/link';

import { contentText } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n.server';
import type { Database } from '@/lib/database.types';

import { chooseGoal } from '../actions';

export type Goal = Database['public']['Functions']['career_goals_catalogue']['Returns'][number];

/**
 * A goal as a card: what you would become, how far along you already are, and
 * the one action — look at the plan.
 *
 * The percentage is not a score. It counts the rungs of the ladder that are
 * behind you, and rungs that have not been built yet are not counted at all.
 */
export async function GoalCard({ goal, revalidate }: { goal: Goal; revalidate: string }) {
  const t = await getT();
  const locale = await getLocale();

  return (
    <article className="card academy-card">
      <div className="row-between academy-card-head">
        <span className="kicker">{t('هدف مهني', 'Career goal')}</span>
        {goal.is_chosen && <span className="status-pill status-ok">{t('هدفك', 'Your goal')}</span>}
      </div>

      <h3>{contentText(locale, goal.title_ar, goal.title_en)}</h3>
      {goal.description_ar && <p>{goal.description_ar}</p>}

      <ul className="academy-meta">
        <li>{t(`${goal.steps_total} خطوة`, `${goal.steps_total} steps`)}</li>
        <li>{t(`${goal.steps_done} منها خلفك`, `${goal.steps_done} behind you`)}</li>
      </ul>

      <div className="academy-progress">
        <div className="row-between">
          <span className="muted">{t('تقدّمك نحو الهدف', 'Progress towards the goal')}</span>
          <span className="eng">{goal.percent}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={t('تقدّمك نحو الهدف', 'Progress towards the goal')}
          aria-valuenow={goal.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-fill" style={{ width: `${goal.percent}%` }} />
        </div>
      </div>

      <div className="goal-card-actions">
        <Link className="btn btn-primary btn-sm" href={`/academy/goals/${goal.slug}`}>
          {t('اعرض الخطة', 'See the plan')}
        </Link>
        {!goal.is_chosen && (
          <form action={chooseGoal}>
            <input type="hidden" name="goal" value={goal.slug} />
            <input type="hidden" name="revalidate" value={revalidate} />
            <button className="btn btn-ghost btn-sm" type="submit">{t('اجعله هدفي', 'Make it my goal')}</button>
          </form>
        )}
      </div>
    </article>
  );
}
