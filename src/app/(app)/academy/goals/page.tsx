import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { GoalCard, type Goal } from './GoalCard';

/**
 * "What do you want to become?" — the question the academy document asks
 * instead of "which courses do you want".
 *
 * A goal crosses paths and schools and does not stop at the catalogue: it ends
 * in a real project, a portfolio, a team and work. The list is short on
 * purpose; a goal is written by the academy, not generated.
 */
export default async function GoalsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.rpc('career_goals_catalogue');
  const goals = (data ?? []) as Goal[];

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/academy">{t('→ رجوع للأكاديمية', '← Back to the academy')}</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('ماذا تريد أن تصبح؟', 'What do you want to become?')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '64ch' }}>
          {t('الهدف المهني ليس مساراً أكبر. هو سلّم يعبر عدة مسارات ومدارس، ولا ينتهي عند آخر درس: ينتهي بمشروع حقيقي، ومعرض أعمال، وفريق، وعمل.',
             'A career goal is not a bigger path. It is a ladder across several paths and schools, and it does not end at the last lesson: it ends in a real project, a portfolio, a team and work.')}
        </p>
      </section>

      {goals.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا أهداف منشورة بعد', 'No goals published yet')}</h3>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            {t('الأهداف تُكتب من الإدارة مسارًا مسارًا. تصفّح الأكاديمية ريثما تُنشر.',
               'Goals are written by the academy, one at a time. Browse the academy meanwhile.')}
          </p>
          <Link className="btn btn-primary btn-sm" href="/academy">{t('تصفّح الأكاديمية', 'Browse the academy')}</Link>
        </div>
      ) : (
        <div className="card-grid">
          {goals.map((goal) => <GoalCard goal={goal} revalidate="/academy/goals" key={goal.id} />)}
        </div>
      )}
    </>
  );
}
