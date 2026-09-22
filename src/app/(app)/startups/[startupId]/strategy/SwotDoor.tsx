'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { swotToGoal, type StrategyDoorState } from './actions';

export type SwotOption = { id: string; body_ar: string; quadrant: string };

/**
 * A weakness is where a goal is usually born.
 *
 * The SWOT squares are where a company says what is wrong with it; leaving them
 * as a list of complaints is how they become wallpaper. This turns one into a
 * goal with a number and a date, in the same room.
 */
export function SwotDoor({ items, revalidate }: { items: SwotOption[]; revalidate: string }) {
  const t = useT();
  const [selected, setSelected] = useState(items[0]?.id ?? '');
  const [state, formAction, pending] = useActionState(swotToGoal, undefined as StrategyDoorState);

  if (items.length === 0) return null;

  return (
    <form action={formAction} className="panel section-block meeting-form">
      <input type="hidden" name="revalidate" value={revalidate} />

      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label htmlFor="swot-item">{t('حوّل عنصراً من SWOT إلى هدف', 'Turn a SWOT square into a goal')}</label>
        <select id="swot-item" name="item_id" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.body_ar.slice(0, 70)}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="swot-metric">{t('ما الذي نقيسه؟', 'What do we measure?')}</label>
        <input id="swot-metric" name="metric" required />
      </div>
      <div className="field">
        <label htmlFor="swot-target">{t('الرقم', 'Target')}</label>
        <input id="swot-target" name="target" type="number" min="1" step="1" required />
      </div>
      <div className="field">
        <label htmlFor="swot-due">{t('بحلول', 'By')}</label>
        <input id="swot-due" name="due" type="date" required />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : t('اجعلها هدفاً', 'Make it a goal')}
      </button>

      {state?.error && <p className="notice notice-danger" style={{ gridColumn: '1 / -1' }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ gridColumn: '1 / -1' }}>{state.ok}</p>}
    </form>
  );
}
