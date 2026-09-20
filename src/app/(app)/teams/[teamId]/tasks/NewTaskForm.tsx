'use client';

import { useActionState, useState } from 'react';

import { createTask, type TeamState } from '../../actions';

export function NewTaskForm({
  teamId,
  members,
  sprints,
}: {
  teamId: string;
  members: { id: string; name: string }[];
  sprints: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTask, undefined as TeamState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        + مهمة جديدة
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="title">عنوان المهمة</label>
        <input id="title" name="title" required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="description">الوصف ومعايير الإنجاز</label>
        <textarea id="description" name="description" rows={3} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="assignee_id">المسؤول</label>
          <select id="assignee_id" name="assignee_id" defaultValue="">
            <option value="">بلا مسؤول</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="due_on">الموعد النهائي</label>
          <input id="due_on" name="due_on" type="date" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="priority">الأولوية</label>
          <select id="priority" name="priority" defaultValue="normal">
            <option value="low">منخفضة</option>
            <option value="normal">عادية</option>
            <option value="high">مرتفعة</option>
            <option value="urgent">عاجلة</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sprint_id">السبرنت</label>
          <select id="sprint_id" name="sprint_id" defaultValue="">
            <option value="">بلا سبرنت</option>
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
          {pending ? 'جارٍ الإضافة…' : 'أضف المهمة'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إغلاق</button>
      </div>
    </form>
  );
}
