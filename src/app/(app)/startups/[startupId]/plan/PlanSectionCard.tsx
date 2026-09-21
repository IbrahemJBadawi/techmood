'use client';

import { useState } from 'react';

import type { BusinessPlanSection, PlanSection } from '@/lib/database.types';

import { savePlanSection } from '../../actions';
import { useT } from '@/lib/i18n.client';
import type { Text } from '@/lib/i18n';

export function PlanSectionCard({
  startupId,
  sectionKey,
  label,
  hint,
  value,
  canEdit,
}: {
  startupId: string;
  sectionKey: PlanSection;
  label: Text;
  hint: Text;
  value: BusinessPlanSection | null;
  canEdit: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isComplete = value?.is_complete ?? false;
  const body = value?.body_ar ?? '';

  return (
    <article className={`plan-section${isComplete ? ' done' : ''}`}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem' }}>{t(label)}</h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>{t(hint)}</p>
        </div>
        <span className={`status-pill ${isComplete ? 'status-ok' : body ? 'status-pending' : 'status-muted'}`}>
          {isComplete ? t('مكتمل', 'Complete') : body ? t('مسوّدة', 'Draft') : t('فارغ', 'Empty')}
        </span>
      </div>

      {!open && body && (
        <p style={{ fontSize: '0.88rem', marginTop: 12, whiteSpace: 'pre-wrap' }}>{body}</p>
      )}

      {canEdit && !open && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
          {body ? t('تعديل', 'Edit') : t('اكتب هذا القسم', 'Write this section')}
        </button>
      )}

      {open && (
        <form action={savePlanSection} style={{ marginTop: 14 }}>
          <input type="hidden" name="startup_id" value={startupId} />
          <input type="hidden" name="section" value={sectionKey} />

          <div className="field">
            <textarea name="body" rows={7} defaultValue={body} autoFocus />
          </div>

          <label className="badge-pill" style={{ cursor: 'pointer', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" name="is_complete" defaultChecked={isComplete} />
            {t('علّم القسم كمكتمل', 'Mark the section complete')}
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>{t('حفظ', 'Save')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      )}
    </article>
  );
}
