'use client';

import { useState } from 'react';

import { TASK_COLUMNS } from '@/lib/teams';
import type { TaskColumn } from '@/lib/database.types';

import { moveTask } from '../../actions';
import { useT } from '@/lib/i18n.client';

/**
 * Moving a card. Choosing "blocked" asks for the reason inline, because the
 * database refuses a blocked task that does not say what is blocking it.
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
  const [target, setTarget] = useState<TaskColumn | null>(null);

  if (target === 'blocked') {
    return (
      <form action={moveTask} style={{ marginTop: 10 }}>
        <input type="hidden" name="team_id" value={teamId} />
        <input type="hidden" name="task_id" value={taskId} />
        <input type="hidden" name="column_key" value="blocked" />
        <input name="blocked_reason" required placeholder={t('ما الذي يمنع التنفيذ؟', 'What is blocking it?')} style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="btn btn-primary btn-sm">{t('تأكيد', 'Confirm')}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTarget(null)}>{t('إلغاء', 'Cancel')}</button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      {TASK_COLUMNS.filter((column) => column.key !== current).map((column) =>
        column.key === 'blocked' ? (
          <button
            key={column.key}
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 9px', fontSize: '0.72rem' }}
            onClick={() => setTarget('blocked')}
          >
            {t(column.label)}
          </button>
        ) : (
          <form action={moveTask} key={column.key}>
            <input type="hidden" name="team_id" value={teamId} />
            <input type="hidden" name="task_id" value={taskId} />
            <input type="hidden" name="column_key" value={column.key} />
            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 9px', fontSize: '0.72rem' }}>
              {t(column.label)}
            </button>
          </form>
        ),
      )}
    </div>
  );
}
