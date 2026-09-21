'use client';

import { useActionState, useState } from 'react';

import { createTask, type TeamState } from '../../actions';
import { useT } from '@/lib/i18n.client';

export function NewTaskForm({
  teamId,
  members,
  sprints,
}: {
  teamId: string;
  members: { id: string; name: string }[];
  sprints: { id: string; label: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createTask, undefined as TeamState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        {t('+ مهمة جديدة', '+ New task')}
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="title">{t('عنوان المهمة', 'Task title')}</label>
        <input id="title" name="title" required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="description">{t('الوصف ومعايير الإنجاز', 'Description and definition of done')}</label>
        <textarea id="description" name="description" rows={3} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="assignee_id">{t('المسؤول', 'Owner')}</label>
          <select id="assignee_id" name="assignee_id" defaultValue="">
            <option value="">{t('بلا مسؤول', 'Unassigned')}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="due_on">{t('الموعد النهائي', 'Due date')}</label>
          <input id="due_on" name="due_on" type="date" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="priority">{t('الأولوية', 'Priority')}</label>
          <select id="priority" name="priority" defaultValue="normal">
            <option value="low">{t('منخفضة', 'Low')}</option>
            <option value="normal">{t('عادية', 'Normal')}</option>
            <option value="high">{t('مرتفعة', 'High')}</option>
            <option value="urgent">{t('عاجلة', 'Urgent')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sprint_id">{t('السبرنت', 'Sprint')}</label>
          <select id="sprint_id" name="sprint_id" defaultValue="">
            <option value="">{t('بلا سبرنت', 'No sprint')}</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>{sprint.label}</option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الإضافة…', 'Adding…') : t('أضف المهمة', 'Add task')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إغلاق', 'Close')}</button>
      </div>
    </form>
  );
}
