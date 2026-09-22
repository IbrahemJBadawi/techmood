'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { blockTime, unblockTime, type HubState } from './actions';

export type Block = { id: string; starts_at: string; ends_at: string; reason: string | null };

/**
 * Hours that are yours. Closing time is not cancelling a booking and never
 * touches one — it only stops free hours being offered.
 */
export function BlockTime({ blocks }: { blocks: Block[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(blockTime, undefined as HubState);

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '1rem' }}>{t('وقت مغلق', 'Blocked time')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {t('موعد طبيب، سفر، أو وقت شخصي — الساعات التي تغلقها لا تُعرض للحجز.',
           'A doctor’s appointment, a trip, time of your own — hours you close are not offered for booking.')}
      </p>

      {blocks.length > 0 && (
        <ul className="plain-list" style={{ margin: '14px 0' }}>
          {blocks.map((block) => (
            <li className="row-between" key={block.id} style={{ fontSize: '0.86rem' }}>
              <span>
                {new Date(block.starts_at).toLocaleString('ar-EG', {
                  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                })}
                {' — '}
                {new Date(block.ends_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                {block.reason && <span className="muted"> · {block.reason}</span>}
              </span>
              <form action={unblockTime}>
                <input type="hidden" name="block_id" value={block.id} />
                <button className="btn btn-ghost btn-sm">{t('افتحه', 'Reopen')}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="meeting-form">
        <div className="field">
          <label htmlFor="block-date">{t('اليوم', 'Day')}</label>
          <input id="block-date" name="date" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="block-from">{t('من', 'From')}</label>
          <input id="block-from" name="from" type="time" required />
        </div>
        <div className="field">
          <label htmlFor="block-to">{t('إلى', 'To')}</label>
          <input id="block-to" name="to" type="time" required />
        </div>
        <button className="btn btn-ghost btn-sm" disabled={pending}>
          {pending ? t('جارٍ…', 'Working…') : t('أغلق هذه الساعات', 'Block these hours')}
        </button>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      </form>
    </section>
  );
}
