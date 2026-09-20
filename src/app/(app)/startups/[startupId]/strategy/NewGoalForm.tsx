'use client';

import { useActionState, useState } from 'react';

import { saveSmartGoal, type StartupState } from '../../actions';

export function NewGoalForm({ startupId }: { startupId: string }) {
  const [state, formAction, pending] = useActionState(saveSmartGoal, undefined as StartupState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        + هدف SMART
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="title">عنوان الهدف</label>
        <input id="title" name="title" required placeholder="مثال: الوصول إلى 25 عيادة مشتركة" />
      </div>

      <div className="field">
        <label htmlFor="specific">محدد — ما الذي سيحدث بالضبط؟</label>
        <textarea id="specific" name="specific" rows={2} required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="metric_label">قابل للقياس — وحدة القياس</label>
          <input id="metric_label" name="metric_label" required placeholder="عيادة مشتركة" />
        </div>
        <div className="field">
          <label htmlFor="current_value">القيمة الحالية</label>
          <input id="current_value" name="current_value" type="number" step="0.01" defaultValue={0} dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="baseline_value">نقطة البداية</label>
          <input id="baseline_value" name="baseline_value" type="number" step="0.01" defaultValue={0} dir="ltr" required />
        </div>
        <div className="field">
          <label htmlFor="target_value">القيمة المستهدفة</label>
          <input id="target_value" name="target_value" type="number" step="0.01" dir="ltr" required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="achievable">قابل للتحقيق — لماذا هو ممكن بمواردك؟</label>
        <textarea id="achievable" name="achievable" rows={2} />
      </div>

      <div className="field">
        <label htmlFor="relevant">ذو صلة — لماذا يهم هذا الهدف الآن؟</label>
        <textarea id="relevant" name="relevant" rows={2} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="starts_on">محدد بزمن — من</label>
          <input id="starts_on" name="starts_on" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="due_on">إلى</label>
          <input id="due_on" name="due_on" type="date" required />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : 'أضف الهدف'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إغلاق</button>
      </div>
    </form>
  );
}
