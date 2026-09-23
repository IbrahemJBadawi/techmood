'use client';

import { useActionState, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/booking';
import type { PaymentMethod } from '@/lib/database.types';

import { useT } from '@/lib/i18n.client';

import { submitPaymentProof, type PaymentState } from '../../actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg'];

export function PaymentForm({
  bookingId,
  method,
  amount,
  userId,
}: {
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  userId: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitPaymentProof, undefined as PaymentState);

  const [proofPath, setProofPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState('');

  const details: { label: string; value: string | null }[] = [
    { label: t('اسم المستفيد', 'Recipient name'), value: method.recipient_name },
    { label: t('رقم الحساب', 'Account number'), value: method.account_number },
    { label: t('رقم المحفظة', 'Wallet number'), value: method.wallet_number },
    { label: 'IBAN', value: method.iban },
    { label: 'SWIFT / BIC', value: method.swift },
    { label: t('البنك', 'Bank'), value: method.bank_name },
    { label: t('عنوان البنك', 'Bank address'), value: method.bank_address },
    { label: t('المدينة', 'City'), value: method.city },
    { label: t('الدولة', 'Country'), value: method.country },
  ].filter((row) => Boolean(row.value));

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  }

  async function upload(file: File) {
    setUploadError('');

    // Checked here for a fast answer; the bucket and the database check again.
    if (!ALLOWED.includes(file.type)) {
      setUploadError(t('الصيغ المقبولة: PNG أو JPG فقط.', 'Accepted formats: PNG or JPG only.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(t('أقصى حجم للإيصال 5 ميغابايت.', 'A receipt may be at most 5 MB.'));
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    const key = `${userId}/${bookingId}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from('payment-proofs').upload(key, file, {
      contentType: file.type,
      upsert: false,
    });

    setUploading(false);

    if (error) {
      setUploadError(t('تعذّر رفع الإيصال — حاول مرة أخرى.', 'The receipt could not be uploaded — try again.'));
      return;
    }

    setProofPath(key);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  function removeFile() {
    setProofPath('');
    setFileName('');
    setPreview('');
  }

  return (
    <>
      <div className="panel section-block">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>
          {method.icon} {method.name_ar}
        </h3>
        <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 14 }}>
          {method.instructions_ar}
        </p>

        <div className="copy-row">
          <div>
            <span className="cl">{t('المبلغ المطلوب', 'Amount due')}</span>
            <div className="cv" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>{money(amount)}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(String(amount), 'amount')}>
            {copied === 'amount' ? t('تم النسخ ✓', 'Copied ✓') : t('نسخ', 'Copy')}
          </button>
        </div>

        {details.map((row) => (
          <div className="copy-row" key={row.label}>
            <div>
              <span className="cl">{row.label}</span>
              <div className="cv">{row.value}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(row.value!, row.label)}>
              {copied === row.label ? t('تم النسخ ✓', 'Copied ✓') : t('نسخ', 'Copy')}
            </button>
          </div>
        ))}

        {details.length === 0 && (
          <p className="notice">
            {t('لم يضبط المشرف بيانات هذه الطريقة بعد. تواصل مع فريق TechMood قبل التحويل.', 'An admin has not filled in this method’s details yet. Talk to TechMood before transferring anything.')}
          </p>
        )}
      </div>

      <form action={formAction} className="panel">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="proof_path" value={proofPath} />

        <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('إثبات الدفع', 'Proof of payment')}</h3>

        {method.requires_reference && (
          <div className="field">
            <label htmlFor="reference">
              {method.reference_label_ar ?? t('الرقم المرجعي', 'Reference number')}{t(' — إلزامي', ' — required')}
            </label>
            <input id="reference" name="reference" dir="ltr" required />
          </div>
        )}

        {!method.requires_reference && (
          <div className="field">
            <label htmlFor="reference">{t('رقم العملية (اختياري)', 'Transaction number (optional)')}</label>
            <input id="reference" name="reference" dir="ltr" />
          </div>
        )}

        {method.requires_receipt && (
          <div className="field">
            <label htmlFor="receipt">{t('صورة الإيصال — PNG أو JPG، بحد أقصى 5 ميغابايت', 'Receipt image — PNG or JPG, 5 MB max')}</label>
            <input
              id="receipt"
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            {uploading && <p className="muted" style={{ fontSize: '0.82rem' }}>{t('جارٍ الرفع…', 'Uploading…')}</p>}
            {uploadError && <p className="notice notice-danger">{uploadError}</p>}

            {proofPath && (
              <div className="card" style={{ marginTop: 10 }}>
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt={t('معاينة الإيصال', 'Receipt preview')} style={{ maxHeight: 200, objectFit: 'contain', borderRadius: 8 }} />
                )}
                <div className="row-between">
                  <span style={{ fontSize: '0.84rem' }}>
                    {fileName} <span style={{ color: 'var(--ok)' }}>{t('✓ جاهز', '✓ ready')}</span>
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeFile}>{t('إزالة', 'Remove')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={pending || uploading || (method.requires_receipt && !proofPath)}
        >
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('✓ حوّلت المبلغ — أرسل للتأكيد', '✓ I have transferred it — send for confirmation')}
        </button>

        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          {t('هذا لا يعني أن الدفع تمّ: يعني أنك تطلب من TechMood التأكّد. بعد التأكيد يُرسل الطلب إلى المنتور للموافقة.',
             'This does not mean the payment is done: it asks TechMood to check it. Once confirmed, the request goes to the mentor to accept.')}
        </p>
      </form>
    </>
  );
}
