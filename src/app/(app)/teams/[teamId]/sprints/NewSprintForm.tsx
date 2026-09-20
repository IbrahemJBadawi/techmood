'use client';

import { useActionState, useState } from 'react';

import { createSprint, type TeamState } from '../../actions';

export function NewSprintForm({
  teamId,
  defaultStart,
  defaultEnd,
}: {
  teamId: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, formAction, pending] = useActionState(createSprint, undefined as TeamState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        + ابدأ سبرنت
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="goal">هدف السبرنت</label>
        <input id="goal" name="goal" placeholder="مثال: إكمال نظام المصادقة" required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="starts_on">يبدأ</label>
          <input id="starts_on" name="starts_on" type="date" defaultValue={defaultStart} required />
        </div>
        <div className="field">
          <label htmlFor="ends_on">ينتهي</label>
          <input id="ends_on" name="ends_on" type="date" defaultValue={defaultEnd} required />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'جارٍ البدء…' : 'ابدأ السبرنت'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إغلاق</button>
      </div>
    </form>
  );
}
