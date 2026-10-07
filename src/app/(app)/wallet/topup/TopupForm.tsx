'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import { MethodLogo } from '@/components/MethodLogo';
import { NumberStepper } from '@/components/NumberStepper';

import { requestPurchase, requestTopup, type CreditState } from '../credit-actions';

const AMOUNTS = [10, 25, 50, 100];

/** What a transfer pays for when it is not a plain top-up (0155): shown, priced, and posted as is. */
export type Purchase = { label: string; amount: number; fields: Record<string, string> };

/**
 * How much, and by which transfer (design lab 4: «تحويل بأي مبلغ + إيصال»).
 * With a purchase (Premium or a package) the amount is its price, and the
 * purchase completes when TechMood approves the receipt.
 */
export function TopupForm({ methods, purchase }: {
  methods: { key: string; name_ar: string; name_en: string; icon: string | null }[];
  purchase?: Purchase;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(purchase ? requestPurchase : requestTopup, undefined as CreditState);
  const [amount, setAmount] = useState(purchase ? String(purchase.amount) : '25');
  // a preset remounts the field with its value; typing and − / + only update the label
  const [preset, setPreset] = useState(0);
  const pick = (value: number) => { setAmount(String(value)); setPreset((n) => n + 1); };
  const [method, setMethod] = useState(methods[0]?.key ?? '');

  return (
    <form action={action} className="panel section-block topup-form">
      {purchase ? (
        <div className="topup-purchase">
          {Object.entries(purchase.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <span className="muted">{t('تدفع ثمن', 'You are paying for')}</span>
          <strong>{purchase.label}</strong>
          <b className="eng">{money(purchase.amount)}</b>
        </div>
      ) : (
        <fieldset className="topup-amounts">
          <legend>{t('كم تريد أن تشحن؟', 'How much?')}</legend>
          <div className="choice-chips-row">
            {AMOUNTS.map((value) => (
              <label key={value} className="choice-chip">
                <input type="radio" name="preset" checked={amount === String(value)} onChange={() => pick(value)} />
                <span className="eng">{money(value)}</span>
              </label>
            ))}
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="topup-amount">{t('أو اكتب أي مبلغ (5$ – 500$)', 'Or any amount (5$ – 500$)')}</label>
            <NumberStepper key={preset} id="topup-amount" name="amount" min={5} max={500} step={5} defaultValue={amount}
                           onInput={(event) => setAmount((event.target as HTMLInputElement).value)} />
          </div>
        </fieldset>
      )}

      <fieldset className="topup-methods">
        <legend>{t('كيف ستحوّل؟', 'How will you transfer?')}</legend>
        <div className="method-cards">
          {methods.map((m) => (
            <label key={m.key} className={`method-card${method === m.key ? ' is-current' : ''}`}>
              <input type="radio" name="method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} className="sr-only" />
              <MethodLogo methodKey={m.key} icon={m.icon} />
              <span className="method-card-text"><strong>{t(m.name_ar, m.name_en)}</strong></span>
              <span className="method-card-check" aria-hidden>{method === m.key ? '✓' : ''}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending || !method} aria-busy={pending}>
        {pending ? t('جارٍ…', 'Working…')
          : purchase ? t(`متابعة — ادفع ${money(purchase.amount)}`, `Continue — pay ${money(purchase.amount)}`)
          : t(`متابعة — شحن ${money(Number(amount) || 0)}`, `Continue — top up ${money(Number(amount) || 0)}`)}
      </button>
      <p className="muted" style={{ fontSize: '0.78rem' }}>
        {purchase ? t('في الخطوة التالية تظهر بيانات التحويل. بعد التحويل ارفع الإيصال، ويُفعَّل ما اشتريته حين تتحقق منه TechMood، ويصلك إشعار.',
                      'Next you see where to send it. After the transfer, upload the receipt; your purchase is activated once TechMood checks it, and you are notified.') : t('في الخطوة التالية تظهر بيانات التحويل. بعد التحويل ارفع الإيصال، ويُشحن رصيدك حين تتحقق منه TechMood. الرصيد يُصرف داخل المنصة ولا يُسحب نقداً.',
           'Next you see where to send it. After the transfer, upload the receipt; your balance grows once TechMood checks it. The balance is spent on the platform and is not withdrawable.')}
      </p>
    </form>
  );
}
