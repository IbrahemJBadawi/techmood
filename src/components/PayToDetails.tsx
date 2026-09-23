'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import type { PayField, PayTo } from '@/lib/database.types';

const LABEL: Record<PayField, { ar: string; en: string }> = {
  recipient_name: { ar: 'اسم المستفيد',   en: 'Beneficiary name' },
  bank_name:      { ar: 'البنك',          en: 'Bank name' },
  account_number: { ar: 'رقم الحساب',     en: 'Account number' },
  iban:           { ar: 'IBAN',           en: 'IBAN' },
  swift:          { ar: 'SWIFT / BIC',    en: 'SWIFT / BIC' },
  bank_address:   { ar: 'عنوان البنك',     en: 'Bank address' },
  wallet_number:  { ar: 'رقم المحفظة',    en: 'Wallet number' },
  account_email:  { ar: 'بريد PayPal',     en: 'PayPal email' },
  city:           { ar: 'المدينة',         en: 'City' },
  country:        { ar: 'الدولة',          en: 'Country' },
};

/**
 * Exactly what it takes to pay with the chosen method, each field copyable.
 *
 * The fields come from `payment_instructions()`, which returns only the ones
 * this method shows — a wallet payment never receives the IBAN, not even
 * hidden in the page. The ones that only matter for transfers from abroad
 * (SWIFT, the bank's address) sit under their own heading, so a local payer
 * is not asked to wonder whether they need them.
 */
export function PayToDetails({ payTo }: { payTo: PayTo }) {
  const t = useT();
  const [copied, setCopied] = useState('');

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  }

  const valueOf = (field: PayField) => payTo[field] as string | null;
  const shown = payTo.display_fields.filter((field) => valueOf(field));
  const local = shown.filter((field) => !payTo.international_fields.includes(field));
  const abroad = shown.filter((field) => payTo.international_fields.includes(field));

  const row = (key: string, label: string, value: string, strong = false) => (
    <div className="copy-row" key={key}>
      <div>
        <span className="cl">{label}</span>
        <div className="cv" dir="ltr" style={strong ? { fontWeight: 700, color: 'var(--royal-dark)' } : undefined}>
          {value}
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(value, key)}>
        {copied === key ? t('تم النسخ ✓', 'Copied ✓') : t('نسخ', 'Copy')}
      </button>
    </div>
  );

  return (
    <div className="pay-to-details">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{payTo.icon} {payTo.name_ar}</h3>
      {payTo.instructions_ar && (
        <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>{payTo.instructions_ar}</p>
      )}

      {row('amount', t('المبلغ المطلوب', 'Amount due'), money(Number(payTo.amount_usd)), true)}
      {local.map((field) => row(field, t(LABEL[field].ar, LABEL[field].en), valueOf(field)!))}

      {abroad.length > 0 && (
        <>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '12px 0 4px' }}>
            {t('للتحويل من خارج فلسطين فقط:', 'Only for transfers from outside Palestine:')}
          </p>
          {abroad.map((field) => row(field, t(LABEL[field].ar, LABEL[field].en), valueOf(field)!))}
        </>
      )}

      {row('code', t('اكتب هذا الرقم في ملاحظة التحويل', 'Put this in the transfer note'), payTo.payment_code)}

      {shown.length === 0 && (
        <p className="notice">
          {t('لم تكتمل بيانات هذه الطريقة بعد. اختر طريقة أخرى أو تواصل مع TechMood قبل أي تحويل.',
             'This method’s details are not complete yet. Choose another, or talk to TechMood before transferring anything.')}
        </p>
      )}
    </div>
  );
}
