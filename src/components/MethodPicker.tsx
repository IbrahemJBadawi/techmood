'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { choosePaymentMethod } from '@/app/(app)/wallet/actions';

export type MethodOption = {
  key: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  category: string;
  is_current: boolean;
};

/** What the button on each card says, by what the method pays to. */
function revealLabel(option: MethodOption, t: (ar: string, en: string) => string) {
  if (option.key === 'paypal') return t('عرض بريد PayPal', 'Show the PayPal email');
  if (['jawwal_pay', 'palpay'].includes(option.key)) return t('عرض رقم المحفظة', 'Show the wallet number');
  if (option.key.includes('bank') || option.key === 'international_transfer') {
    return t('عرض بيانات التحويل', 'Show transfer details');
  }
  return t('عرض بيانات الدفع', 'Show payment details');
}

/**
 * «اختر طريقة الدفع». Only methods that are on, complete, and collect for
 * this kind of payment are offered (`payment_options()`), and choosing one
 * switches the open payment to it — the details below then show that method's
 * fields and nothing else.
 */
export function MethodPicker({ paymentId, options, revalidate }: {
  paymentId: string;
  options: MethodOption[];
  revalidate: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  if (options.length <= 1) return null;

  return (
    <div className="method-picker">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('اختر طريقة الدفع', 'Choose how to pay')}</h3>
      <div className="method-cards">
        {options.map((option) => (
          <div key={option.key} className={`method-card${option.is_current ? ' is-current' : ''}`}>
            <strong>{option.icon} {option.name_ar}</strong>
            {option.is_current ? (
              <span className="status-pill status-ok">{t('المختارة', 'Chosen')}</span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const result = await choosePaymentMethod(paymentId, option.key, revalidate);
                  setError(result.ok ? '' : result.error ?? '');
                  router.refresh();
                })}
              >
                {revealLabel(option, t)}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="notice notice-danger">{error}</p>}
    </div>
  );
}
