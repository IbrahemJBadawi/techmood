'use client';

import { useActionState, useState } from 'react';

import { money } from '@/lib/booking';
import type { PayoutAccount } from '@/lib/database.types';

import { addPayoutAccount, requestPayout, type WalletState } from './actions';
import { useT } from '@/lib/i18n.client';

export function PayoutPanel({
  accounts,
  methods,
  available,
  minimum,
}: {
  accounts: PayoutAccount[];
  methods: { key: string; name_ar: string; icon: string | null }[];
  available: number;
  minimum: number;
}) {
  const t = useT();
  const [requestState, requestAction, requesting] = useActionState(requestPayout, undefined as WalletState);
  const [accountState, accountAction, savingAccount] = useActionState(addPayoutAccount, undefined as WalletState);
  const [addingAccount, setAddingAccount] = useState(false);

  const canRequest = accounts.length > 0 && available >= minimum;

  return (
    <div className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('سحب الرصيد', 'Withdraw')}</h3>

      {accounts.length === 0 ? (
        <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>
          {t('أضف حساباً تستلم عليه أرباحك أولاً.', 'Add an account to receive your earnings first.')}
        </p>
      ) : (
        <form action={requestAction}>
          <div className="field">
            <label htmlFor="account_id">{t('الحساب', 'Account')}</label>
            <select id="account_id" name="account_id" required defaultValue={accounts[0]?.id}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label_ar ?? account.holder_name} —{' '}
                  {account.wallet_number ?? account.account_number ?? account.iban}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="amount">
              {t(`المبلغ — المتاح ${money(available)}، والحد الأدنى ${money(minimum)}`,
                 `Amount — ${money(available)} available, ${money(minimum)} minimum`)}
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={minimum}
              max={Math.max(available, 0)}
              step="0.01"
              required
              dir="ltr"
            />
          </div>

          {requestState?.error && (
            <p className="notice notice-danger" style={{ marginBottom: 12 }}>{requestState.error}</p>
          )}
          {requestState?.ok && <p className="notice" style={{ marginBottom: 12 }}>{requestState.ok}</p>}

          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={requesting || !canRequest}>
            {requesting ? t('جارٍ الإرسال…', 'Sending…') : t('اطلب سحباً', 'Request a payout')}
          </button>

          {!canRequest && available < minimum && (
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              {t('رصيدك المتاح أقل من الحد الأدنى للسحب.', 'Your available balance is below the payout minimum.')}
            </p>
          )}
        </form>
      )}

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        {accounts.length > 0 && (
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
            {t(`${accounts.length} حساب سحب محفوظ`, `${accounts.length} saved payout ${accounts.length === 1 ? 'account' : 'accounts'}`)}
          </p>
        )}

        {!addingAccount ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingAccount(true)}>
            {t('+ أضف حساب سحب', '+ Add a payout account')}
          </button>
        ) : (
          <form action={accountAction}>
            <div className="field">
              <label htmlFor="method_key">{t('طريقة الاستلام', 'Payout method')}</label>
              <select id="method_key" name="method_key" required defaultValue={methods[0]?.key}>
                {methods.map((method) => (
                  <option key={method.key} value={method.key}>
                    {method.icon} {method.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="holder_name">{t('اسم صاحب الحساب', 'Account holder')}</label>
              <input id="holder_name" name="holder_name" required />
            </div>

            <div className="field">
              <label htmlFor="wallet_number">{t('رقم المحفظة', 'Wallet number')}</label>
              <input id="wallet_number" name="wallet_number" dir="ltr" />
            </div>

            <div className="field">
              <label htmlFor="account_number">{t('رقم الحساب البنكي', 'Bank account number')}</label>
              <input id="account_number" name="account_number" dir="ltr" />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="iban">IBAN</label>
                <input id="iban" name="iban" dir="ltr" />
              </div>
              <div className="field">
                <label htmlFor="swift">SWIFT</label>
                <input id="swift" name="swift" dir="ltr" />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="bank_name">{t('البنك', 'Bank')}</label>
                <input id="bank_name" name="bank_name" />
              </div>
              <div className="field">
                <label htmlFor="country">{t('الدولة', 'Country')}</label>
                <input id="country" name="country" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="label">{t('تسمية مختصرة (اختياري)', 'A short label (optional)')}</label>
              <input id="label" name="label" placeholder={t('حسابي الأساسي', 'My main account')} />
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
              {t('أدخل رقم محفظة أو رقم حساب أو IBAN على الأقل. بياناتك المالية لا يقرأها إلا أنت وإدارة TechMood عند تنفيذ التحويل.',
                 'Enter at least a wallet number, an account number or an IBAN. Your financial details are read only by you, and by TechMood when the transfer is made.')}
            </p>

            {accountState?.error && (
              <p className="notice notice-danger" style={{ marginBottom: 12 }}>{accountState.error}</p>
            )}
            {accountState?.ok && <p className="notice" style={{ marginBottom: 12 }}>{accountState.ok}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-sm" disabled={savingAccount}>
                {savingAccount ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ الحساب', 'Save account')}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingAccount(false)}>
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
