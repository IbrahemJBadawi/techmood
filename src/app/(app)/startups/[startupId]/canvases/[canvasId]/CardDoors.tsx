'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { cardToGoal, cardToProject, type CanvasState } from '../actions';

export type DoorCard = {
  id: string;
  body_ar: string;
  linked: { target_kind: string; target_id: string }[];
};

/**
 * The door out of the wall.
 *
 * A card is a thought; this is where it becomes a goal with a number and a
 * date, or a project the company runs. The link home is kept, so the work can
 * always answer "where did this come from?".
 */
export function CardDoors({ cards, revalidate }: { cards: DoorCard[]; revalidate: string }) {
  const t = useT();
  const [selected, setSelected] = useState(cards[0]?.id ?? '');
  const [goalState, goalAction, goalPending] = useActionState(cardToGoal, undefined as CanvasState);
  const [projectState, projectAction, projectPending] = useActionState(cardToProject, undefined as CanvasState);

  const card = cards.find((item) => item.id === selected);

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '0.96rem' }}>{t('حوّل بطاقة إلى عمل', 'Turn a card into work')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {t('الفكرة التي لا تصبح هدفاً أو مشروعاً تبقى على الحائط. اختر بطاقة وقرّر ما تفعله بها.',
           'An idea that never becomes a goal or a project stays on the wall. Pick a card and decide what happens to it.')}
      </p>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="card">{t('البطاقة', 'The card')}</label>
        <select id="card" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {cards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.body_ar.slice(0, 70)}{item.linked.length > 0 ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {card && card.linked.length > 0 && (
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          {t('هذه البطاقة صارت بالفعل: ', 'This card already became: ')}
          {card.linked.map((link) => (link.target_kind === 'goal' ? t('هدف', 'a goal') : t('مشروع', 'a project'))).join('، ')}
        </p>
      )}

      <div className="rules-grid" style={{ marginTop: 14, alignItems: 'start' }}>
        <form action={goalAction} className="panel" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: '0.88rem' }}>{t('إلى هدف SMART', 'Into a SMART goal')}</strong>
          <input type="hidden" name="card_id" value={selected} />
          <input type="hidden" name="revalidate" value={revalidate} />

          <div className="field">
            <label htmlFor="metric">{t('ما الذي نقيسه؟', 'What do we measure?')}</label>
            <input id="metric" name="metric" placeholder={t('عميل، عيادة، طلب', 'customers, clinics, orders')} required />
          </div>
          <div className="field">
            <label htmlFor="target">{t('الرقم المستهدف', 'Target')}</label>
            <input id="target" name="target" type="number" min="1" step="1" required />
          </div>
          <div className="field">
            <label htmlFor="due">{t('بحلول', 'By')}</label>
            <input id="due" name="due" type="date" required />
          </div>

          {goalState?.error && <p className="notice notice-danger">{goalState.error}</p>}
          {goalState?.ok && <p className="notice notice-ok">{goalState.ok}</p>}

          <button className="btn btn-primary btn-sm" disabled={goalPending || !selected}>
            {goalPending ? t('جارٍ…', 'Working…') : t('اجعلها هدفاً', 'Make it a goal')}
          </button>
        </form>

        <form action={projectAction} className="panel" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: '0.88rem' }}>{t('إلى مشروع', 'Into a project')}</strong>
          <input type="hidden" name="card_id" value={selected} />
          <input type="hidden" name="revalidate" value={revalidate} />

          <div className="field">
            <label htmlFor="project-title">{t('اسم المشروع', 'Project name')}</label>
            <input id="project-title" name="title" placeholder={card?.body_ar.slice(0, 40)} />
          </div>

          {projectState?.error && <p className="notice notice-danger">{projectState.error}</p>}
          {projectState?.ok && <p className="notice notice-ok">{projectState.ok}</p>}

          <button className="btn btn-primary btn-sm" disabled={projectPending || !selected}>
            {projectPending ? t('جارٍ…', 'Working…') : t('ابدأ مشروعاً', 'Start a project')}
          </button>
        </form>
      </div>
    </section>
  );
}
