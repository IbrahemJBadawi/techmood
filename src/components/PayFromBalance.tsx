'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import { MethodLogo } from '@/components/MethodLogo';
import { payWithCredit, payWithPackage, type CreditState } from '@/app/(app)/wallet/credit-actions';

export type UsablePackage = { id: string; sessions_left: number; sessions_total: number; discount_pct: number };

/**
 * «ادفع من رصيدك» beside the transfer (design lab 4: «يختار المستخدم الرصيد
 * أو التحويل»): the balance, if it covers the amount, pays at once; a package
 * with this mentor pays one session. A transfer stays the other choice below.
 */
export function PayFromBalance({ paymentId, amount, balance, next, packages = [] }: {
  paymentId: string; amount: number; balance: number; next: string; packages?: UsablePackage[];
}) {
  const t = useT();
  const [creditState, creditAction, creditPending] = useActionState(payWithCredit, undefined as CreditState);
  const [pkgState, pkgAction, pkgPending] = useActionState(payWithPackage, undefined as CreditState);
  const enough = balance >= amount;
  const usable = packages.filter((k) => k.sessions_left > 0);

  return (
    <section className="panel section-block pay-choice">
      <h3 style={{ fontSize: '0.98rem' }}>{t('ادفع الآن بنقرة', 'Pay now in one tap')}</h3>

      {usable.map((k) => (
        <form key={k.id} action={pkgAction} className="pay-choice-row">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="hidden" name="package_id" value={k.id} />
          <input type="hidden" name="next" value={next} />
          <span className="method-logo" aria-hidden style={{ width: 40, height: 40, background: '#6D4AE8', fontSize: 18 }}>🎟️</span>
          <span className="pay-choice-text">
            <strong>{t('ادفع من باقتك', 'Pay from your package')}</strong>
            <small>{t(`${k.sessions_left} من ${k.sessions_total} جلسات متبقية · خصم ${k.discount_pct}%`, `${k.sessions_left} of ${k.sessions_total} sessions left · ${k.discount_pct}% off`)}</small>
          </span>
          <button className="btn btn-primary btn-sm" disabled={pkgPending} aria-busy={pkgPending}>{t('استخدم جلسة', 'Use one')}</button>
        </form>
      ))}
      {pkgState?.error && <p className="notice notice-danger">{pkgState.error}</p>}

      <form action={creditAction} className="pay-choice-row">
        <input type="hidden" name="payment_id" value={paymentId} />
        <input type="hidden" name="next" value={next} />
        <MethodLogo methodKey="wallet" />
        <span className="pay-choice-text">
          <strong>{t('ادفع من رصيدك', 'Pay from your balance')}</strong>
          <small>{t('رصيدك ', 'Balance ')}<span className="eng">{money(balance)}</span>
            {enough ? t(` · يبقى ${money(balance - amount)}`, ` · ${money(balance - amount)} left after`) : t(' — لا يكفي', ' — not enough')}</small>
        </span>
        {enough
          ? <button className="btn btn-primary btn-sm" disabled={creditPending} aria-busy={creditPending}>{t(`ادفع ${money(amount)}`, `Pay ${money(amount)}`)}</button>
          : <Link className="btn btn-ghost btn-sm" href="/wallet/topup">{t('اشحن رصيدك', 'Top up')}</Link>}
      </form>
      {creditState?.error && <p className="notice notice-danger">{creditState.error}</p>}

      <p className="pay-choice-or"><span>{t('أو ادفع بتحويل وإيصال', 'or pay by transfer and receipt')}</span></p>
    </section>
  );
}
