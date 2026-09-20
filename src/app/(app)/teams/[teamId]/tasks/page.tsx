import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { TASK_COLUMNS, TASK_PRIORITY, isOverdue } from '@/lib/teams';

import { TeamNav } from '../TeamNav';
import { NewTaskForm } from './NewTaskForm';
import { MoveTask } from './MoveTask';

export default async function TeamTasksPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: tasks }, { data: members }, { data: sprints }, { data: canCreate }] = await Promise.all([
    supabase
      .from('team_tasks')
      .select('id, title_ar, column_key, priority, assignee_id, due_on, blocked_reason_ar, sprint_id')
      .eq('team_id', teamId)
      .order('sort_order'),
    supabase.from('team_members').select('profile_id, responsibility_ar').eq('team_id', teamId),
    supabase.from('sprints').select('id, number, goal_ar').eq('team_id', teamId).order('number', { ascending: false }),
    supabase.rpc('team_permission', { p_team: teamId, p_permission: 'members_create_tasks' }),
  ]);

  const memberIds = (members ?? []).map((row) => row.profile_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — المهام</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>نظرة عامة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          كل مهمة لها مسؤول وحالة وموعد. المحادثة ليست مكان تتبّع العمل.
        </p>
      </section>

      <TeamNav teamId={teamId} />

      {canCreate === true && (
        <NewTaskForm
          teamId={teamId}
          members={(members ?? []).map((row) => ({
            id: row.profile_id,
            name: nameById.get(row.profile_id) ?? '—',
          }))}
          sprints={(sprints ?? []).map((row) => ({ id: row.id, label: `سبرنت ${row.number}` }))}
        />
      )}

      <div className="kanban-board">
        {TASK_COLUMNS.map((column) => {
          const columnTasks = (tasks ?? []).filter((task) => task.column_key === column.key);

          return (
            <section className="kanban-col" key={column.key}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: '0.88rem' }}>{column.label}</h3>
                <span className="badge-pill eng">{columnTasks.length}</span>
              </div>

              {columnTasks.length === 0 && (
                <p className="muted" style={{ fontSize: '0.8rem' }}>لا مهام</p>
              )}

              {columnTasks.map((task) => {
                const late = isOverdue(task.due_on, task.column_key);
                return (
                  <article className="task-card" key={task.id}>
                    <Link href={`/teams/${teamId}/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                      <strong style={{ fontSize: '0.86rem', display: 'block' }}>{task.title_ar}</strong>
                    </Link>

                    <div className="tags-row" style={{ marginTop: 8 }}>
                      {task.priority !== 'normal' && (
                        <span className={`status-pill ${TASK_PRIORITY[task.priority].className}`}>
                          {TASK_PRIORITY[task.priority].text}
                        </span>
                      )}
                      {task.assignee_id ? (
                        <span className="badge-pill">{nameById.get(task.assignee_id) ?? '—'}</span>
                      ) : (
                        <span className="badge-pill" style={{ opacity: 0.6 }}>بلا مسؤول</span>
                      )}
                      {task.due_on && (
                        <span className="badge-pill eng" style={late ? { color: 'var(--danger)' } : undefined}>
                          {task.due_on}
                        </span>
                      )}
                    </div>

                    {task.column_key === 'blocked' && task.blocked_reason_ar && (
                      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>
                        ⛔ {task.blocked_reason_ar}
                      </p>
                    )}

                    <MoveTask teamId={teamId} taskId={task.id} current={task.column_key} />
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
