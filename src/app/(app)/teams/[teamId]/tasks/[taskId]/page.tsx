import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { TASK_COLUMNS, TASK_PRIORITY, isOverdue } from '@/lib/teams';

import { addChecklistItem, addTaskComment, toggleChecklistItem } from '../../../actions';
import { MoveTask } from '../MoveTask';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; taskId: string }>;
}) {
  const { teamId, taskId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: task } = await supabase.from('team_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) notFound();

  const [{ data: checklist }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('sort_order'),
    supabase.from('task_comments').select('id, author_id, body_ar, created_at').eq('task_id', taskId).order('created_at'),
    supabase.from('team_members').select('profile_id').eq('team_id', teamId),
  ]);

  const peopleIds = [
    ...new Set([
      ...(members ?? []).map((row) => row.profile_id),
      ...(comments ?? []).map((row) => row.author_id),
    ]),
  ];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', peopleIds.length ? peopleIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));
  const revalidate = `/teams/${teamId}/tasks/${taskId}`;
  const doneCount = (checklist ?? []).filter((item) => item.is_done).length;
  const columnLabel = TASK_COLUMNS.find((column) => column.key === task.column_key)?.label ?? task.column_key;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}/tasks`}>→ رجوع للمهام</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '1.15rem' }}>{task.title_ar}</h2>
          <span className={`status-pill ${task.column_key === 'blocked' ? 'status-danger' : 'status-muted'}`}>
            {columnLabel}
          </span>
        </div>

        <div className="tags-row" style={{ marginTop: 12 }}>
          <span className={`status-pill ${TASK_PRIORITY[task.priority].className}`}>
            {TASK_PRIORITY[task.priority].text}
          </span>
          <span className="badge-pill">
            {task.assignee_id ? nameById.get(task.assignee_id) ?? '—' : 'بلا مسؤول'}
          </span>
          {task.due_on && (
            <span className="badge-pill eng" style={isOverdue(task.due_on, task.column_key) ? { color: 'var(--danger)' } : undefined}>
              {task.due_on}
            </span>
          )}
          <span className="badge-pill eng">+{task.xp_reward} XP</span>
        </div>

        {task.blocked_reason_ar && task.column_key === 'blocked' && (
          <p className="notice notice-danger" style={{ marginTop: 14 }}>⛔ {task.blocked_reason_ar}</p>
        )}

        {task.description_ar && (
          <p style={{ fontSize: '0.9rem', marginTop: 14 }}>{task.description_ar}</p>
        )}

        <MoveTask teamId={teamId} taskId={taskId} current={task.column_key} />
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.98rem' }}>قائمة التحقق</h3>
              <span className="badge-pill eng">{doneCount}/{checklist?.length ?? 0}</span>
            </div>

            {(checklist ?? []).map((item) => (
              <form action={toggleChecklistItem} key={item.id} className="lesson-row" style={{ padding: '9px 0' }}>
                <input type="hidden" name="item_id" value={item.id} />
                <input type="hidden" name="is_done" value={String(item.is_done)} />
                <input type="hidden" name="revalidate" value={revalidate} />
                <button className={`lstat${item.is_done ? ' completed' : ''}`} type="submit" aria-label={item.label_ar}>✓</button>
                <span style={{ fontSize: '0.88rem', textDecoration: item.is_done ? 'line-through' : undefined }}>
                  {item.label_ar}
                </span>
              </form>
            ))}

            <form action={addChecklistItem} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="revalidate" value={revalidate} />
              <input name="label" placeholder="أضف بنداً…" style={{ flex: 1, minWidth: 0 }} />
              <button className="btn btn-ghost btn-sm">إضافة</button>
            </form>
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>النقاش</h3>

            {(comments?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>لا تعليقات بعد.</p>
            ) : (
              comments!.map((comment) => (
                <div key={comment.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div className="row-between">
                    <strong style={{ fontSize: '0.86rem' }}>{nameById.get(comment.author_id) ?? '—'}</strong>
                    <span className="muted eng" style={{ fontSize: '0.74rem' }}>
                      {new Date(comment.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.87rem', marginTop: 5 }}>{comment.body_ar}</p>
                </div>
              ))
            )}

            <form action={addTaskComment} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="revalidate" value={revalidate} />
              <input name="body" placeholder="اكتب تعليقاً…" style={{ flex: 1, minWidth: 0 }} />
              <button className="btn btn-primary btn-sm">إرسال</button>
            </form>
          </div>
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>التسليم</h3>
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            يُرفق التسليم بالمهمة نفسها — مستودع أو عرض أو ملاحظات — لا في المحادثة، حتى يبقى
            العمل قابلاً للتتبع ضمن سجلك المهني.
          </p>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
            انقل المهمة إلى «قيد المراجعة» عندما تنتهي منها.
          </p>
        </aside>
      </div>
    </>
  );
}
