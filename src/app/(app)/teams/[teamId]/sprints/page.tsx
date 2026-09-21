import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { SPRINT_STATUS } from '@/lib/teams';

import { TeamNav } from '../TeamNav';
import { NewSprintForm } from './NewSprintForm';

export default async function TeamSprintsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar, leader_id').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: sprints }, { data: tasks }] = await Promise.all([
    supabase.from('sprints').select('*').eq('team_id', teamId).order('number', { ascending: false }),
    supabase.from('team_tasks').select('id, sprint_id, column_key').eq('team_id', teamId),
  ]);

  const isLeader = team.leader_id === user.id;

  // Computed here rather than in the form: a client component must stay pure,
  // and a date read during render is not.
  const today = new Date();
  const asDate = (value: Date) => value.toISOString().slice(0, 10);
  const defaultStart = asDate(today);
  const defaultEnd = asDate(new Date(today.getTime() + 14 * 86400000));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar}{t(' — السبرنتات', ' — sprints')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('دورة عمل قصيرة بهدف واضح. في نهايتها تُراجَع المهام المنجزة والمتوقفة وما تعلّمه الفريق.', 'A short cycle with one clear goal. At the end the team reviews what was closed, what got stuck and what it learned.')}
        </p>
      </section>

      <TeamNav teamId={teamId} />

      {isLeader && (
        <NewSprintForm teamId={teamId} defaultStart={defaultStart} defaultEnd={defaultEnd} />
      )}

      {(sprints?.length ?? 0) === 0 ? (
        <p className="notice">{t('لم يبدأ الفريق أي سبرنت بعد.', 'This team has not run a sprint yet.')}</p>
      ) : (
        sprints!.map((sprint) => {
          const mine = (tasks ?? []).filter((task) => task.sprint_id === sprint.id);
          const done = mine.filter((task) => task.column_key === 'done').length;
          const blocked = mine.filter((task) => task.column_key === 'blocked').length;
          const progress = mine.length > 0 ? Math.round((done / mine.length) * 100) : 0;

          return (
            <article className="panel section-block" key={sprint.id}>
              <div className="row-between">
                <h3 style={{ fontSize: '1rem' }}>{t(`السبرنت ${sprint.number}`, `Sprint ${sprint.number}`)}</h3>
                <span className={`status-pill ${SPRINT_STATUS[sprint.status].className}`}>
                  {t(SPRINT_STATUS[sprint.status].text)}
                </span>
              </div>

              <p className="muted eng" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                {sprint.starts_on} → {sprint.ends_on}
              </p>

              {sprint.goal_ar && (
                <p style={{ fontSize: '0.9rem', marginTop: 10 }}>🎯 {sprint.goal_ar}</p>
              )}

              <div className="progress-track" style={{ marginTop: 14 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 6 }}>
                <span className="eng">{done}/{mine.length} {t('مهمة', 'tasks')}</span>
                <span>
                  {blocked > 0 && <span className="status-pill status-danger">{t(`${blocked} متوقفة`, `${blocked} blocked`)}</span>}{' '}
                  <span className="eng">{progress}%</span>
                </span>
              </div>

              {sprint.review_ar && (
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>{t('مراجعة السبرنت', 'Sprint review')}</p>
                  <p style={{ fontSize: '0.87rem' }}>{sprint.review_ar}</p>
                </div>
              )}
            </article>
          );
        })
      )}
    </>
  );
}
