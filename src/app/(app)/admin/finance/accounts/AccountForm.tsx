'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { PayField, PaymentMethod } from '@/lib/database.types';

import { savePaymentAccount, type AccountState } from './actions';

const PURPOSES: { key: string; ar: string; en: string }[] = [
  { key: 'mentoring', ar: 'جلسات الإرشاد', en: 'Mentoring' },
  { key: 'projects',  ar: 'أعمال السوق',  en: 'Projects' },
  { key: 'sales',     ar: 'بيع المشاريع', en: 'Project sales' },
  { key: 'courses',   ar: 'الدورات',      en: 'Courses' },
];

const FIELDS: { key: PayField; ar: string; en: string }[] = [
  { key: 'recipient_name', ar: 'اسم المستفيد', en: 'Beneficiary' },
  { key: 'bank_name',      ar: 'البنك',        en: 'Bank' },
  { key: 'account_number', ar: 'رقم الحساب',   en: 'Account' },
  { key: 'iban',           ar: 'IBAN',         en: 'IBAN' },
  { key: 'swift',          ar: 'SWIFT',        en: 'SWIFT' },
  { key: 'bank_address',   ar: 'عنوان البنك',  en: 'Bank address' },
  { key: 'wallet_number',  ar: 'رقم المحفظة',  en: 'Wallet' },
  { key: 'account_email',  ar: 'البريد',       en: 'Email' },
  { key: 'city',           ar: 'المدينة',      en: 'City' },
  { key: 'country',        ar: 'الدولة',       en: 'Country' },
];

const mask = (value: string | null) =>
  !value ? '' : value.length <= 4 ? '••••' : `${'•'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;

/**
 * One receiving account. The numbers are masked until an admin asks to see
 * them — on a shared screen, the full IBAN is not something to leave open.
 */
export function AccountForm({ method }: { method: PaymentMethod }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<AccountState, FormData>(savePaymentAccount, undefined);
  const [open, setOpen] = useState(false);

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="key" value={method.key} />

      <div className="row-between">
        <h3 style={{ fontSize: '1rem' }}>{method.icon} {method.name_ar}</h3>
        <label className="switch-row" style={{ margin: 0 }}>
          <input type="checkbox" name="enabled" defaultChecked={method.is_enabled} />
          <span>{t('مفعّل', 'Active')}</span>
        </label>
      </div>

      {!open ? (
        <div className="summary-rows" style={{ marginTop: 10 }}>
          {[
            [t('المستفيد', 'Recipient'), method.recipient_name],
            [t('رقم الحساب', 'Account'), mask(method.account_number)],
            [t('رقم المحفظة', 'Wallet'), mask(method.wallet_number)],
            ['IBAN', mask(method.iban)],
            [t('البريد', 'Email'), method.account_email ? method.account_email.replace(/^(.).*(@.*)$/, '$1•••$2') : null],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div className="summary-row" key={label}>
              <span className="muted">{label}</span><span className="eng" dir="ltr">{value}</span>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
            {t('اعرض وعدّل', 'Show and edit')}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="field-row">
            <div className="field">
              <label>{t('اسم المستفيد', 'Recipient name')}</label>
              <input name="recipient_name" defaultValue={method.recipient_name ?? ''} />
            </div>
            <div className="field">
              <label>{t('البنك', 'Bank')}</label>
              <input name="bank_name" defaultValue={method.bank_name ?? ''} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>{t('رقم الحساب', 'Account number')}</label>
              <input name="account_number" dir="ltr" defaultValue={method.account_number ?? ''} />
            </div>
            <div className="field">
              <label>{t('رقم المحفظة', 'Wallet number')}</label>
              <input name="wallet_number" dir="ltr" defaultValue={method.wallet_number ?? ''} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>IBAN</label>
              <input name="iban" dir="ltr" defaultValue={method.iban ?? ''} />
            </div>
            <div className="field">
              <label>SWIFT / BIC</label>
              <input name="swift" dir="ltr" defaultValue={method.swift ?? ''} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>{t('بريد الاستلام (PayPal)', 'Receiving email (PayPal)')}</label>
              <input name="account_email" type="email" dir="ltr" defaultValue={method.account_email ?? ''} />
            </div>
            <div className="field">
              <label>{t('عنوان البنك', 'Bank address')}</label>
              <input name="bank_address" dir="ltr" defaultValue={method.bank_address ?? ''} />
            </div>
          </div>
          <div className="field">
            <label>{t('تعليمات للدافع', 'Instructions for the payer')}</label>
            <textarea name="instructions" rows={2} defaultValue={method.instructions_ar ?? ''} />
          </div>
        </div>
      )}

      <fieldset className="field" style={{ marginTop: 10 }}>
        <legend>{t('ما يراه الدافع — وما هو للتحويل من الخارج فقط', 'What the payer sees — and what is only for transfers from abroad')}</legend>
        <table className="data">
          <tbody>
            {FIELDS.map((field) => (
              <tr key={field.key}>
                <td>{t(field.ar, field.en)}</td>
                <td>
                  <label>
                    <input type="checkbox" name="display_fields" value={field.key}
                           defaultChecked={method.display_fields.includes(field.key)} /> {t('يظهر', 'Shown')}
                  </label>
                </td>
                <td>
                  <label>
                    <input type="checkbox" name="international_fields" value={field.key}
                           defaultChecked={method.international_fields.includes(field.key)} /> {t('للخارج', 'Abroad only')}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <fieldset className="field" style={{ marginTop: 10 }}>
        <legend>{t('يُستخدم لاستقبال', 'Used to receive')}</legend>
        <div className="tags-row">
          {PURPOSES.map((purpose) => (
            <label key={purpose.key} className="chip">
              <input type="checkbox" name="use_for" value={purpose.key}
                     defaultChecked={method.use_for.includes(purpose.key)} /> {t(purpose.ar, purpose.en)}
            </label>
          ))}
          <label className="chip">
            <input type="checkbox" name="supports_payout" defaultChecked={method.supports_payout} />
            {' '}{t('تحويل السحوبات', 'Sending withdrawals')}
          </label>
        </div>
      </fieldset>

      {!open && (
        <>
          {/* keep the numbers as they are when saving from the masked view */}
          <input type="hidden" name="recipient_name" value={method.recipient_name ?? ''} />
          <input type="hidden" name="bank_name" value={method.bank_name ?? ''} />
          <input type="hidden" name="account_number" value={method.account_number ?? ''} />
          <input type="hidden" name="wallet_number" value={method.wallet_number ?? ''} />
          <input type="hidden" name="iban" value={method.iban ?? ''} />
          <input type="hidden" name="swift" value={method.swift ?? ''} />
          <input type="hidden" name="account_email" value={method.account_email ?? ''} />
          <input type="hidden" name="bank_address" value={method.bank_address ?? ''} />
        </>
      )}

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>{t('احفظ', 'Save')}</button>
    </form>
  );
}
