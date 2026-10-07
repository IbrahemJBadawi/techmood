'use client';

import { useActionState, useState } from 'react';

import { money } from '@/lib/booking';
import { useT } from '@/lib/i18n.client';

import { savePrice, type MentorFormState } from '../availability-actions';

/**
 * One kind of session: whether it is offered, and at what price.
 *
 * The preview does the platform's arithmetic so the mentor sees their own share
 * before saving; the saved figure is still the database's (session_quote), and
 * a price outside the band is refused there, not here.
 */
export function PriceRow({
  sessionTypeId,
  name,
  duration,
  price,
  isCustom,
  offered,
  min,
  max,
  fallback,
  commissionPct,
}: {
  sessionTypeId: string;
  name: string;
  duration: number;
  price: number;
  isCustom: boolean;
  offered: boolean;
  min: number;
  max: number;
  fallback: number;
  commissionPct: number;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(savePrice, undefined as MentorFormState);
  const [draft, setDraft] = useState(isCustom ? String(price) : '');

  const effective = draft === '' ? fallback : Number(draft);
  const valid = Number.isFinite(effective) && effective >= min && effective <= max;
  const platform = valid ? Math.round(effective * commissionPct) / 100 : 0;

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="session_type_id" value={sessionTypeId} />
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '0.98rem' }}>{name}</h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            <span className="eng">{duration} min</span>
            {' · '}
            {t('المسموح لمستواك', 'Your level’s range')}{' '}
            <span className="eng">{money(min)} – {money(max)}</span>
            {' · '}
            {t('الافتراضي', 'Default')} <span className="eng">{money(fallback)}</span>
          </p>
        </div>
        <label className="switch-row">
          <input type="checkbox" name="offered" defaultChecked={offered} />
          {t('أقدّم هذه الجلسة', 'I offer this session')}
        </label>
      </div>

      <div className="field-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={`price-${sessionTypeId}`}>{t('سعري بالدولار (فارغ = الافتراضي)', 'My price in USD (empty = default)')}</label>
          <input
            id={`price-${sessionTypeId}`}
            name="price"
            type="number"
            step="0.5"
            min={min}
            max={max}
            value={draft}
            placeholder={String(fallback)}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <div className="field">
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {valid
              ? t(`حصتك ${money(effective - platform)} · تكمود ${money(platform)} (${commissionPct}%)`,
                  `You get ${money(effective - platform)} · TechMood ${money(platform)} (${commissionPct}%)`)
              : t('خارج حدود مستواك', 'Outside your level’s range')}
          </span>
        </div>
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending || !valid} aria-busy={pending}>
          {pending ? t('جارٍ…', 'Working…') : t('احفظ', 'Save')}
        </button>
      </div>
      {state?.error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ marginTop: 10 }}>{state.ok}</p>}
    </form>
  );
}
