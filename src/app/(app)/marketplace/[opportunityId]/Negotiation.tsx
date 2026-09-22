'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import type { TermsStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { acceptTerms, proposeTerms, type MarketState } from '../market-actions';

const TERMS_STATUS: Record<TermsStatus, { text: Text; className: string }> = {
  offered:    { text: { ar: 'عرض قائم',   en: 'On the table' }, className: 'status-pending' },
  accepted:   { text: { ar: 'مقبول',      en: 'Accepted' },     className: 'status-ok' },
  superseded: { text: { ar: 'استُبدل',     en: 'Superseded' },   className: 'status-muted' },
  withdrawn:  { text: { ar: 'مسحوب',      en: 'Withdrawn' },    className: 'status-muted' },
};

export type Round = {
  id: string; by_profile: string; by_name: string; amount_usd: number;
  days: number | null; message_ar: string | null; status: TermsStatus; created_at: string;
};

/**
 * The negotiation: rounds, not an auction.
 *
 * Every round is kept and shown to both sides — the agreed price is the last
 * one somebody accepted, not the only one that ever existed. And nobody can
 * accept their own offer, which is the whole difference between an agreement
 * and an announcement.
 */
export function Negotiation({
  applicationId,
  rounds,
  meId,
}: {
  applicationId: string;
  rounds: Round[];
  meId: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(proposeTerms, undefined as MarketState);
  const [acceptState, acceptAction] = useActionState(acceptTerms, undefined as MarketState);

  const agreed = rounds.find((round) => round.status === 'accepted');

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('الاتفاق على السعر', 'Agreeing the price')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('كل جولة محفوظة، والطرف الآخر وحده من يقبل عرضك. لا مزايدة ولا سباق نحو الأرخص.',
           'Every round is kept, and only the other side can accept yours. No auction, no race to the cheapest.')}
      </p>

      {agreed && (
        <p className="notice notice-ok" style={{ marginTop: 12 }}>
          {t('المتفق عليه: ', 'Agreed: ')}
          <span className="eng">{money(agreed.amount_usd)}</span>
          {agreed.days ? ` · ${agreed.days} ${t('يوم', 'days')}` : ''}
        </p>
      )}

      {rounds.length > 0 && (
        <ul className="plain-list" style={{ marginTop: 12 }}>
          {rounds.map((round) => (
            <li className="row-between" key={round.id} style={{ fontSize: '0.86rem', alignItems: 'flex-start' }}>
              <span>
                <strong className="eng">{money(round.amount_usd)}</strong>
                {round.days ? <span className="muted eng"> · {round.days}d</span> : null}
                <span className="muted"> — {round.by_name}</span>
                {round.message_ar && (
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>{round.message_ar}</p>
                )}
              </span>

              <span className="session-row-actions">
                <span className={`status-pill ${TERMS_STATUS[round.status].className}`}>
                  {t(TERMS_STATUS[round.status].text)}
                </span>
                {round.status === 'offered' && round.by_profile !== meId && (
                  <form action={acceptAction}>
                    <input type="hidden" name="terms_id" value={round.id} />
                    <button className="btn btn-primary btn-sm">{t('أقبل', 'Accept')}</button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {acceptState?.error && <p className="notice notice-danger">{acceptState.error}</p>}

      <form action={formAction} className="meeting-form" style={{ marginTop: 14 }}>
        <input type="hidden" name="application_id" value={applicationId} />

        <div className="field">
          <label htmlFor="terms-amount">{t('عرضك (دولار)', 'Your price (USD)')}</label>
          <input id="terms-amount" name="amount" type="number" min="0" step="1" required />
        </div>
        <div className="field">
          <label htmlFor="terms-days">{t('المدة (أيام)', 'Days')}</label>
          <input id="terms-days" name="days" type="number" min="1" max="365" step="1" />
        </div>
        <div className="field">
          <label htmlFor="terms-message">{t('لماذا؟', 'Why?')}</label>
          <input id="terms-message" name="message" />
        </div>
        <button className="btn btn-ghost btn-sm" disabled={pending}>
          {pending ? t('جارٍ…', 'Sending…') : t('اعرض', 'Offer')}
        </button>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      </form>
    </section>
  );
}
