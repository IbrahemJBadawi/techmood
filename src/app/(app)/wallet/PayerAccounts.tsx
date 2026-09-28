'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { addPayerAccount, payerAccountAction, type WalletState } from './actions';

type Account = { id: string; label: string | null; holder_name: string; account_ref: string; is_default: boolean };

/** The accounts a person pays from (0097), managed like their payout accounts. */
export function PayerAccounts({ accounts }: { accounts: Account[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addPayerAccount, undefined as WalletState);

  return (
    <>
      {accounts.length === 0 ? (
        <p className="notice" style={{ marginBottom: 12 }}>
          {t('لا حسابات محفوظة. احفظ حساباً افتراضياً ليُسجَّل تلقائياً مع دفعاتك.', 'No saved accounts. Save a default one and it is recorded with your payments automatically.')}
        </p>
      ) : (
        <ul className="wallet-statement" style={{ marginBottom: 14 }}>
          {accounts.map((account) => (
            <li key={account.id}>
              <span className="wallet-label">
                {account.label ?? account.holder_name}
                <span className="muted eng" style={{ display: 'block', fontSize: '0.78rem' }}>{account.account_ref}</span>
              </span>
              {account.is_default ? (
                <span className="status-pill status-ok">{t('افتراضي', 'Default')}</span>
              ) : (
                <form action={payerAccountAction}>
                  <input type="hidden" name="account_id" value={account.id} />
                  <button className="btn btn-ghost btn-sm" name="action" value="default">{t('اجعله افتراضياً', 'Make default')}</button>
                </form>
              )}
              <form action={payerAccountAction}>
                <input type="hidden" name="account_id" value={account.id} />
                <button className="btn btn-ghost btn-sm" name="action" value="delete">{t('حذف', 'Delete')}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="panel">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>{t('أضف حساباً تدفع منه', 'Add an account you pay from')}</h3>
        <div className="field-row">
          <div className="field">
            <label htmlFor="pa_holder">{t('اسم صاحب الحساب', 'Account holder')}</label>
            <input id="pa_holder" name="holder_name" required minLength={2} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="pa_ref">{t('رقم الحساب أو المحفظة أو البريد', 'Account, wallet number or email')}</label>
            <input id="pa_ref" name="account_ref" dir="ltr" required minLength={3} maxLength={120} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pa_label">{t('اسم مختصر (اختياري)', 'A short name (optional)')}</label>
          <input id="pa_label" name="label" maxLength={60} placeholder={t('محفظتي على جوال باي', 'My Jawwal Pay wallet')} />
        </div>
        <label className="switch-row" style={{ fontSize: '0.84rem' }}>
          <input type="checkbox" name="is_default" defaultChecked={accounts.length === 0} />
          {t('افتراضي لدفعاتي', 'Default for my payments')}
        </label>
        {state?.error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{state.error}</p>}
        {state?.ok && <p className="notice notice-ok" style={{ marginTop: 10 }}>{state.ok}</p>}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={pending}>
          {pending ? t('جارٍ…', 'Working…') : t('احفظ', 'Save')}
        </button>
      </form>
    </>
  );
}
