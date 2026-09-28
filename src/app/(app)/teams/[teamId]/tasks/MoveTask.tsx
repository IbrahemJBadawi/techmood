'use client';

import { useRef, useState } from 'react';

import { TASK_COLUMNS } from '@/lib/teams';
import type { TaskColumn } from '@/lib/database.types';

import { moveTask } from '../../actions';
import { useT } from '@/lib/i18n.client';

/**
 * Moving a card: one compact menu instead of a button per column. Choosing
 * "blocked" asks for the reason inline, because the database refuses a
 * blocked task that does not say what is blocking it.
 */
export function MoveTask({
  teamId,
  taskId,
  current,
}: {
  teamId: string;
  taskId: string;
  current: TaskColumn;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState<TaskColumn | ''>('');

  return (
    <form action={moveTask} ref={formRef} className="task-move">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="task_id" value={taskId} />
      <label className="sr-only" htmlFor={`move-${taskId}`}>{t('انقل المهمة', 'Move the task')}</label>
      <select
        id={`move-${taskId}`}
        name="column_key"
        value={target}
        onChange={(event) => {
          const next = event.target.value as TaskColumn;
          setTarget(next);
          // Everything but "blocked" moves at once; "blocked" needs a reason first.
          if (next && next !== 'blocked') setTimeout(() => formRef.current?.requestSubmit(), 0);
        }}
      >
        <option value="">{t('انقل إلى…', 'Move to…')}</option>
        {TASK_COLUMNS.filter((column) => column.key !== current).map((column) => (
          <option key={column.key} value={column.key}>{t(column.label)}</option>
        ))}
      </select>

      {target === 'blocked' && (
        <div className="task-move-reason">
          <input name="blocked_reason" required placeholder={t('ما الذي يمنع التنفيذ؟', 'What is blocking it?')} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm">{t('تأكيد', 'Confirm')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTarget('')}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}
    </form>
  );
}
