import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { ACTIVITY_VERBS, SPRINT_STATUS, TEAM_KIND, TEAM_STATUS, isOverdue } from '@/lib/teams';

import { TeamNav } from './TeamNav';
import { AiSurface } from '@/components/AiSurface';

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: members }, { data: tasks }, { data: sprint }, { data: xp }, { data: stars }, { data: activity }] =
    await Promise.all([
      supabase.from('team_members').select('profile_id, role, responsibility_ar').eq('team_id', teamId),
      supabase.from('team_tasks').select('id, title_ar, column_key, assignee_id, due_on, priority').eq('team_id', teamId),
      supabase.from('sprints').select('*').eq('team_id', teamId).eq('status', 'active').order('number', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('team_xp').select('total_xp').eq('team_id', teamId).maybeSingle(),
      supabase.from('team_stars').select('stars_avg, reviews_count').eq('team_id', teamId).maybeSingle(),
      supabase.from('team_activity').select('id, verb, subject_ar, actor_id, created_at').eq('team_id', teamId).order('created_at', { ascending: false }).limit(8),
    ]);

  const memberIds = (members ?? []).map((row) => row.profile_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));
  const isLeader = team.leader_id === user.id;

  const all = tasks ?? [];
  const done = all.filter((task) => task.column_key === 'done');
  const blocked = all.filter((task) => task.column_key === 'blocked');
  const review = all.filter((task) => task.column_key === 'review');
  const overdue = all.filter((task) => isOverdue(task.due_on, task.column_key));
  const progress = all.length > 0 ? Math.round((done.length / all.length) * 100) : 0;

  const sprintTasks = sprint ? all.filter((task) => task.column_key !== 'done') : [];

  return (
    <>
      <AiSurface surface="team" scope="team" entityType="team" entityId={team.id} label={team.title_ar} />

      <section className="panel section-block">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{team.title_ar}</h2>
            <div className="tags-row" style={{ marginTop: 8 }}>
              <span className="id-chip">{team.team_code}</span>
              <span className="tag">{t(TEAM_KIND[team.kind])}</span>
              <span className={`status-pill ${TEAM_STATUS[team.status].className}`}>
                {t(TEAM_STATUS[team.status].text)}
              </span>
            </div>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/messages">{t('محادثة الفريق', 'Team conversation')}</Link>
        </div>

        {team.description_ar && (
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 12 }}>{team.description_ar}</p>
        )}

        <div className="row-between" style={{ marginTop: 18 }}>
          <span className="muted" style={{ fontSize: '0.82rem' }}>{t('تقدّم المهام', 'Task progress')}</span>
          <span className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>{progress}%</span>
        </div>
        <div className="progress-track" style={{ marginTop: 6 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <TeamNav teamId={teamId} />

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{done.length}/{all.length}</div>
            <div className="lbl">{t('مهام مكتملة', 'Tasks done')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{members?.length ?? 0}</div>
            <div className="lbl">{t('أعضاء', 'Members')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{xp?.total_xp ?? 0}</div>
            <div className="lbl">{t('نقاط الفريق', 'Team points')}</div>
          </div>
          <div className="stat-tile">
            <div className="val"><Stars value={stars?.stars_avg ?? 0} /></div>
            <div className="lbl">{t(`${stars?.reviews_count ?? 0} تقييم منتور`, `${stars?.reviews_count ?? 0} mentor ${(stars?.reviews_count ?? 0) === 1 ? 'review' : 'reviews'}`)}</div>
          </div>
        </div>
      </section>

      {/* A leader needs to see where to step in, not a wall of numbers. */}
      {isLeader && (overdue.length > 0 || blocked.length > 0 || review.length > 0) && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('يحتاج انتباهك', 'Needs your attention')}</h3>
          <div className="tags-row">
            {overdue.length > 0 && <span className="status-pill status-danger">🔴 {t(`${overdue.length} مهمة متأخرة`, `${overdue.length} overdue`)}</span>}
            {blocked.length > 0 && <span className="status-pill status-pending">🟠 {t(`${blocked.length} مهمة متوقفة`, `${blocked.length} blocked`)}</span>}
            {review.length > 0 && <span className="status-pill status-muted">🔵 {t(`${review.length} بانتظار المراجعة`, `${review.length} in review`)}</span>}
          </div>

          <table className="data" style={{ marginTop: 14 }}>
            <thead><tr><th>{t('العضو', 'Member')}</th><th>{t('قيد التنفيذ', 'In progress')}</th><th>{t('متوقفة', 'Blocked')}</th><th>{t('متأخرة', 'Overdue')}</th></tr></thead>
            <tbody>
              {(members ?? []).map((member) => {
                const mine = all.filter((task) => task.assignee_id === member.profile_id);
                return (
                  <tr key={member.profile_id}>
                    <td>{nameById.get(member.profile_id) ?? '—'}</td>
                    <td className="eng">{mine.filter((task) => task.column_key === 'doing').length}</td>
                    <td className="eng">{mine.filter((task) => task.column_key === 'blocked').length}</td>
                    <td className="eng">{mine.filter((task) => isOverdue(task.due_on, task.column_key)).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="detail-grid">
        <section className="panel">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.98rem' }}>
              {sprint ? t(`السبرنت ${sprint.number}`, `Sprint ${sprint.number}`) : t('العمل الحالي', 'Current work')}
            </h3>
            {sprint && (
              <span className={`status-pill ${SPRINT_STATUS[sprint.status].className}`}>
                {t(SPRINT_STATUS[sprint.status].text)}
              </span>
            )}
          </div>

          {sprint?.goal_ar && (
            <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>🎯 {sprint.goal_ar}</p>
          )}

          {sprintTasks.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا مهام مفتوحة حالياً.', 'No open tasks right now.')}</p>
          ) : (
            <table className="data">
              <thead><tr><th>{t('المهمة', 'Task')}</th><th>{t('المسؤول', 'Owner')}</th><th>{t('الحالة', 'Status')}</th><th>{t('الموعد', 'Due')}</th></tr></thead>
              <tbody>
                {sprintTasks.slice(0, 8).map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/teams/${teamId}/tasks/${task.id}`} style={{ color: 'var(--royal-dark)' }}>
                        {task.title_ar}
                      </Link>
                    </td>
                    <td>{task.assignee_id ? nameById.get(task.assignee_id) ?? '—' : <span className="muted">{t('بلا مسؤول', 'Unassigned')}</span>}</td>
                    <td>
                      {task.column_key === 'blocked' ? (
                        <span className="status-pill status-danger">{t('متوقفة', 'Blocked')}</span>
                      ) : task.column_key === 'review' ? (
                        <span className="status-pill status-pending">{t('مراجعة', 'In review')}</span>
                      ) : (
                        <span className="status-pill status-muted">{t('قيد التنفيذ', 'In progress')}</span>
                      )}
                    </td>
                    <td className="eng">
                      {task.due_on ? (
                        <span style={{ color: isOverdue(task.due_on, task.column_key) ? 'var(--danger)' : undefined }}>
                          {task.due_on}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Link className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} href={`/teams/${teamId}/tasks`}>
            {t('كل المهام', 'All tasks')}
          </Link>
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('النشاط', 'Activity')}</h3>
          {(activity?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا نشاط بعد.', 'No activity yet.')}</p>
          ) : (
            <ul className="timeline">
              {activity!.map((entry) => (
                <li key={entry.id} className="done">
                  <span className="tl-dot" />
                  <span className="tl-label">
                    {nameById.get(entry.actor_id ?? '') ?? t('عضو', 'A member')}{' '}
                    {ACTIVITY_VERBS[entry.verb] ? t(ACTIVITY_VERBS[entry.verb]) : entry.verb}
                    {entry.subject_ar && <span className="muted"> «{entry.subject_ar}»</span>}
                    <br />
                    <span className="muted eng" style={{ fontSize: '0.74rem' }}>
                      {new Date(entry.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
