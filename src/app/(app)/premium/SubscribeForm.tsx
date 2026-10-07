'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import { subscribePremium, type CreditState } from '@/app/(app)/wallet/credit-actions';

/** Choosing a plan and paying from the balance; no automatic renewal (0154). */
export function SubscribeForm({ monthly, yearly, balance, member }: { monthly: number; yearly: number; balance: number; member: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(subscribePremium, undefined as CreditState);
  const [plan, setPlan] = useState<'month' | 'year'>('year');
  const price = plan === 'month' ? monthly : yearly;
  const saves = Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));

  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;
  return (
    <form action={action} className="premium-plans">
      <input type="hidden" name="plan" value={plan} />
      <div className="tiers">
        <button type="button" className={`tier${plan === 'month' ? ' is-on' : ''}`} onClick={() => setPlan('month')} aria-pressed={plan === 'month'}>
          <span>{t('شهري', 'Monthly')}</span><b className="eng">{money(monthly)}</b><small>{t('كل شهر', 'a month')}</small>
        </button>
        <button type="button" className={`tier${plan === 'year' ? ' is-on' : ''}`} onClick={() => setPlan('year')} aria-pressed={plan === 'year'}>
          <span>{t('سنوي', 'Yearly')}</span><b className="eng">{money(yearly)}</b>
          <small>{saves > 0 ? t(`وفّر ${saves}%`, `Save ${saves}%`) : t('كل سنة', 'a year')}</small>
        </button>
      </div>
      {balance >= price ? (
        <button className="btn btn-primary premium-cta" disabled={pending} aria-busy={pending}>
          {member ? t(`جدّد من رصيدك — ${money(price)}`, `Renew from your balance — ${money(price)}`) : t(`اشترك من رصيدك — ${money(price)}`, `Subscribe from your balance — ${money(price)}`)}
        </button>
      ) : (
        <Link className="btn btn-primary premium-cta" href={`/wallet/topup?for=premium&plan=${plan}`}>
          {t(`ادفع بتحويل — ${money(price)}`, `Pay by transfer — ${money(price)}`)}
        </Link>
      )}
      {balance >= price
        ? <Link className="btn btn-ghost btn-sm" href={`/wallet/topup?for=premium&plan=${plan}`}>{t('أو ادفع بتحويل', 'Or pay by transfer')}</Link>
        : balance > 0 && <p className="muted" style={{ fontSize: '0.78rem' }}>{t(`رصيدك ${money(balance)} لا يكفي — ادفع بتحويل، أو `, `Your balance of ${money(balance)} is not enough — pay by transfer, or `)}<Link href="/wallet/topup">{t('اشحن رصيدك', 'top up')}</Link>.</p>}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <p className="muted" style={{ fontSize: '0.78rem' }}>{t('لا تجديد تلقائي: نذكّرك قبل الانتهاء بثلاثة أيام، وتجدد إن أردت.', 'No automatic renewal: we remind you three days before it ends, and you renew if you want.')}</p>
    </form>
  );
}
