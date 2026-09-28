'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

export type PayerAccountOption = {
  id: string;
  label: string | null;
  holder_name: string;
  account_ref: string;
  is_default: boolean;
};

const masked = (value: string) => (value.length <= 4 ? value : `•••• ${value.slice(-4)}`);

/**
 * "The account you paid from" (0097): a saved one, or typed with this payment.
 * TechMood keeps it on the payment so a refund goes back where the money came
 * from.
 */
export function PayerAccountFields({ accounts }: { accounts: PayerAccountOption[] }) {
  const t = useT();
  const preferred = accounts.find((account) => account.is_default) ?? accounts[0];
  const [choice, setChoice] = useState(preferred?.id ?? 'new');

  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
      <legend style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}>
        {t('الحساب الذي دفعت منه', 'The account you paid from')}
      </legend>
      <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
        {t('يُحفظ مع الدفعة لإرجاع المبلغ إليه عند الحاجة. تراه أنت والإدارة فقط.',
           'Kept with the payment so a refund can go back to it. Only you and TechMood see it.')}
      </p>

      {accounts.length > 0 && (
        <select name="payer_account" value={choice} onChange={(event) => setChoice(event.target.value)}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {(account.label ?? account.holder_name)} — {masked(account.account_ref)}
              {account.is_default ? t(' (افتراضي)', ' (default)') : ''}
            </option>
          ))}
          <option value="new">{t('حساب آخر…', 'Another account…')}</option>
        </select>
      )}
      {accounts.length === 0 && <input type="hidden" name="payer_account" value="new" />}

      {choice === 'new' && (
        <div style={{ marginTop: 8 }}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="payer_holder">{t('اسم صاحب الحساب', 'Account holder')}</label>
              <input id="payer_holder" name="payer_holder" required minLength={2} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="payer_account_ref">{t('رقم الحساب أو المحفظة أو البريد', 'Account, wallet number or email')}</label>
              <input id="payer_account_ref" name="payer_account_ref" dir="ltr" required minLength={3} maxLength={120} />
            </div>
          </div>
          <label className="switch-row" style={{ fontSize: '0.84rem' }}>
            <input type="checkbox" name="payer_save" defaultChecked={accounts.length === 0} />
            {t('احفظه حساباً افتراضياً لدفعاتي القادمة', 'Save it as my default for future payments')}
          </label>
        </div>
      )}
    </fieldset>
  );
}
