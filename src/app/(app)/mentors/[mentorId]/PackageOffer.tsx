'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import { buyPackage, type CreditState } from '@/app/(app)/wallet/credit-actions';

export type PackageQuote = {
  sessionTypeId: string; sessionName: string;
  tiers: { sessions: number; discount_pct: number; unit_usd: number; total_usd: number; saves_usd: number }[];
};

/** «باقات بخصم» (design lab 4): several sessions with this mentor at once, for less, from the balance. */
export function PackageOffer({ mentorId, quotes, balance }: { mentorId: string; quotes: PackageQuote[]; balance: number }) {
  const t = useT();
  const [state, action, pending] = useActionState(buyPackage, undefined as CreditState);
  const [typeId, setTypeId] = useState(quotes[0]?.sessionTypeId ?? '');
  const [size, setSize] = useState(5);
  const quote = quotes.find((q) => q.sessionTypeId === typeId);
  const tier = quote?.tiers.find((x) => x.sessions === size);
  if (!quote || quote.tiers.length === 0) return null;

  return (
    <section className="panel section-block pkg-offer">
      <h3 style={{ fontSize: '0.98rem' }}>🎟️ {t('باقات بخصم', 'Packages, for less')}</h3>
      <p className="muted" style={{ fontSize: '0.84rem' }}>{t('اشترِ عدة جلسات مرة واحدة من رصيدك، واستخدمها عند كل حجز مع هذا المنتور.', 'Buy several sessions at once from your balance, and use one each time you book this mentor.')}</p>
      {quotes.length > 1 && (
        <div className="choice-chips-row">
          {quotes.map((q) => (
            <label key={q.sessionTypeId} className="choice-chip">
              <input type="radio" name="type_pick" checked={typeId === q.sessionTypeId} onChange={() => setTypeId(q.sessionTypeId)} />
              <span>{q.sessionName}</span>
            </label>
          ))}
        </div>
      )}
      <div className="pkg-tiers">
        {quote.tiers.map((x) => (
          <button type="button" key={x.sessions} className={`pkg-tier${size === x.sessions ? ' is-on' : ''}`} onClick={() => setSize(x.sessions)}
                  aria-pressed={size === x.sessions}>
            <b className="eng">{x.sessions}</b>
            <span>{t('جلسات', 'sessions')}</span>
            <strong className="eng">{money(x.total_usd)}</strong>
            <s className="eng">{money(x.unit_usd * x.sessions)}</s>
            <em>{t(`وفّر ${x.discount_pct}%`, `Save ${x.discount_pct}%`)}</em>
          </button>
        ))}
      </div>
      {state?.ok ? <p className="notice notice-ok">{state.ok}</p> : (
        <form action={action} className="row-actions">
          <input type="hidden" name="mentor_id" value={mentorId} />
          <input type="hidden" name="session_type_id" value={typeId} />
          <input type="hidden" name="sessions" value={size} />
          {tier && balance >= tier.total_usd ? (
            <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
              {t(`اشترِ الباقة من رصيدك — ${money(tier.total_usd)}`, `Buy from your balance — ${money(tier.total_usd)}`)}
            </button>
          ) : (
            <Link className="btn btn-primary" href="/wallet/topup">{t(`اشحن رصيدك (لديك ${money(balance)})`, `Top up (you have ${money(balance)})`)}</Link>
          )}
        </form>
      )}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </section>
  );
}
