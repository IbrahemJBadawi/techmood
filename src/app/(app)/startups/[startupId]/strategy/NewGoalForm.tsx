'use client';

import { useActionState, useState } from 'react';

import { saveSmartGoal, type StartupState } from '../../actions';
import { useT } from '@/lib/i18n.client';

export function NewGoalForm({ startupId }: { startupId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveSmartGoal, undefined as StartupState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        {t('+ هدف SMART', '+ SMART goal')}
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="title">{t('عنوان الهدف', 'Goal title')}</label>
        <input id="title" name="title" required placeholder={t('مثال: الوصول إلى 25 عيادة مشتركة', 'For example: reach 25 partner clinics')} />
      </div>

      <div className="field">
        <label htmlFor="specific">{t('محدد — ما الذي سيحدث بالضبط؟', 'Specific — what exactly will happen?')}</label>
        <textarea id="specific" name="specific" rows={2} required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="metric_label">{t('قابل للقياس — وحدة القياس', 'Measurable — the unit')}</label>
          <input id="metric_label" name="metric_label" required placeholder={t('عيادة مشتركة', 'partner clinics')} />
        </div>
        <div className="field">
          <label htmlFor="current_value">{t('القيمة الحالية', 'Current value')}</label>
          <input id="current_value" name="current_value" type="number" step="0.01" defaultValue={0} dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="baseline_value">{t('نقطة البداية', 'Baseline')}</label>
          <input id="baseline_value" name="baseline_value" type="number" step="0.01" defaultValue={0} dir="ltr" required />
        </div>
        <div className="field">
          <label htmlFor="target_value">{t('القيمة المستهدفة', 'Target')}</label>
          <input id="target_value" name="target_value" type="number" step="0.01" dir="ltr" required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="achievable">{t('قابل للتحقيق — لماذا هو ممكن بمواردك؟', 'Achievable — why is it possible with what you have?')}</label>
        <textarea id="achievable" name="achievable" rows={2} />
      </div>

      <div className="field">
        <label htmlFor="relevant">{t('ذو صلة — لماذا يهم هذا الهدف الآن؟', 'Relevant — why does this matter now?')}</label>
        <textarea id="relevant" name="relevant" rows={2} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="starts_on">{t('محدد بزمن — من', 'Time-bound — from')}</label>
          <input id="starts_on" name="starts_on" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="due_on">{t('إلى', 'to')}</label>
          <input id="due_on" name="due_on" type="date" required />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الحفظ…', 'Saving…') : t('أضف الهدف', 'Add goal')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إغلاق', 'Close')}</button>
      </div>
    </form>
  );
}
