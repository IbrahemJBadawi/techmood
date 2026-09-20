'use client';

import { useActionState, useState } from 'react';

import { money } from '@/lib/booking';
import type { PayoutAccount } from '@/lib/database.types';

import { addPayoutAccount, requestPayout, type WalletState } from './actions';

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
  const [requestState, requestAction, requesting] = useActionState(requestPayout, undefined as WalletState);
  const [accountState, accountAction, savingAccount] = useActionState(addPayoutAccount, undefined as WalletState);
  const [addingAccount, setAddingAccount] = useState(false);

  const canRequest = accounts.length > 0 && available >= minimum;

  return (
    <div className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>سحب الرصيد</h3>

      {accounts.length === 0 ? (
        <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>
          أضف حساباً تستلم عليه أرباحك أولاً.
        </p>
      ) : (
        <form action={requestAction}>
          <div className="field">
            <label htmlFor="account_id">الحساب</label>
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
              المبلغ — المتاح {money(available)}، والحد الأدنى {money(minimum)}
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
            {requesting ? 'جارٍ الإرسال…' : 'اطلب سحباً'}
          </button>

          {!canRequest && available < minimum && (
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              رصيدك المتاح أقل من الحد الأدنى للسحب.
            </p>
          )}
        </form>
      )}

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        {accounts.length > 0 && (
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
            {accounts.length} حساب سحب محفوظ
          </p>
        )}

        {!addingAccount ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingAccount(true)}>
            + أضف حساب سحب
          </button>
        ) : (
          <form action={accountAction}>
            <div className="field">
              <label htmlFor="method_key">طريقة الاستلام</label>
              <select id="method_key" name="method_key" required defaultValue={methods[0]?.key}>
                {methods.map((method) => (
                  <option key={method.key} value={method.key}>
                    {method.icon} {method.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="holder_name">اسم صاحب الحساب</label>
              <input id="holder_name" name="holder_name" required />
            </div>

            <div className="field">
              <label htmlFor="wallet_number">رقم المحفظة</label>
              <input id="wallet_number" name="wallet_number" dir="ltr" />
            </div>

            <div className="field">
              <label htmlFor="account_number">رقم الحساب البنكي</label>
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
                <label htmlFor="bank_name">البنك</label>
                <input id="bank_name" name="bank_name" />
              </div>
              <div className="field">
                <label htmlFor="country">الدولة</label>
                <input id="country" name="country" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="label">تسمية مختصرة (اختياري)</label>
              <input id="label" name="label" placeholder="حسابي الأساسي" />
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
              أدخل رقم محفظة أو رقم حساب أو IBAN على الأقل. بياناتك المالية لا يقرأها إلا أنت
              وإدارة TechMood عند تنفيذ التحويل.
            </p>

            {accountState?.error && (
              <p className="notice notice-danger" style={{ marginBottom: 12 }}>{accountState.error}</p>
            )}
            {accountState?.ok && <p className="notice" style={{ marginBottom: 12 }}>{accountState.ok}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-sm" disabled={savingAccount}>
                {savingAccount ? 'جارٍ الحفظ…' : 'احفظ الحساب'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingAccount(false)}>
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
