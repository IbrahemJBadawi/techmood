'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { CANVAS_KIND } from '@/lib/incubator';
import type { CanvasKind } from '@/lib/database.types';

import { createCanvas, type CanvasState } from './actions';

const KINDS = Object.keys(CANVAS_KIND) as CanvasKind[];

/** Adding a wall. A custom one is just blocks somebody names themselves. */
export function NewCanvasForm({ startupId }: { startupId: string }) {
  const t = useT();
  const [kind, setKind] = useState<CanvasKind>('lean');
  const [state, formAction, pending] = useActionState(createCanvas, undefined as CanvasState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('لوحة جديدة', 'A new canvas')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {t(CANVAS_KIND[kind].hint)}
      </p>

      <input type="hidden" name="startup_id" value={startupId} />

      <div className="rules-grid" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="kind">{t('النوع', 'Kind')}</label>
          <select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as CanvasKind)}>
            {KINDS.map((option) => (
              <option key={option} value={option}>{t(CANVAS_KIND[option].label)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">{t('الاسم (اختياري)', 'Title (optional)')}</label>
          <input id="title" name="title" />
        </div>
      </div>

      {kind === 'custom' && (
        <div className="field">
          <label htmlFor="blocks">{t('خاناتك، مفصولة بفاصلة', 'Your blocks, comma separated')}</label>
          <input id="blocks" name="blocks" placeholder={t('المشكلة، الحل، المخاطر', 'Problem, solution, risks')} />
        </div>
      )}

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : t('أنشئ اللوحة', 'Create it')}
      </button>
    </form>
  );
}
