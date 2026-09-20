'use client';

import { useActionState, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/booking';
import type { PaymentMethod } from '@/lib/database.types';

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
  const [state, formAction, pending] = useActionState(submitPaymentProof, undefined as PaymentState);

  const [proofPath, setProofPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState('');

  const details: { label: string; value: string | null }[] = [
    { label: 'اسم المستفيد', value: method.recipient_name },
    { label: 'رقم الحساب', value: method.account_number },
    { label: 'رقم المحفظة', value: method.wallet_number },
    { label: 'IBAN', value: method.iban },
    { label: 'SWIFT / BIC', value: method.swift },
    { label: 'البنك', value: method.bank_name },
    { label: 'عنوان البنك', value: method.bank_address },
    { label: 'المدينة', value: method.city },
    { label: 'الدولة', value: method.country },
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
      setUploadError('الصيغ المقبولة: PNG أو JPG فقط.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError('أقصى حجم للإيصال 5 ميغابايت.');
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
      setUploadError('تعذّر رفع الإيصال — حاول مرة أخرى.');
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
            <span className="cl">المبلغ المطلوب</span>
            <div className="cv" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>{money(amount)}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(String(amount), 'المبلغ')}>
            {copied === 'المبلغ' ? 'تم النسخ ✓' : 'نسخ'}
          </button>
        </div>

        {details.map((row) => (
          <div className="copy-row" key={row.label}>
            <div>
              <span className="cl">{row.label}</span>
              <div className="cv">{row.value}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(row.value!, row.label)}>
              {copied === row.label ? 'تم النسخ ✓' : 'نسخ'}
            </button>
          </div>
        ))}

        {details.length === 0 && (
          <p className="notice">
            لم يضبط المشرف بيانات هذه الطريقة بعد. تواصل مع فريق TechMood قبل التحويل.
          </p>
        )}
      </div>

      <form action={formAction} className="panel">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="proof_path" value={proofPath} />

        <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>إثبات الدفع</h3>

        {method.requires_reference && (
          <div className="field">
            <label htmlFor="reference">
              {method.reference_label_ar ?? 'الرقم المرجعي'} — إلزامي
            </label>
            <input id="reference" name="reference" dir="ltr" required />
          </div>
        )}

        {!method.requires_reference && (
          <div className="field">
            <label htmlFor="reference">رقم العملية (اختياري)</label>
            <input id="reference" name="reference" dir="ltr" />
          </div>
        )}

        {method.requires_receipt && (
          <div className="field">
            <label htmlFor="receipt">صورة الإيصال — PNG أو JPG، بحد أقصى 5 ميغابايت</label>
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
            {uploading && <p className="muted" style={{ fontSize: '0.82rem' }}>جارٍ الرفع…</p>}
            {uploadError && <p className="notice notice-danger">{uploadError}</p>}

            {proofPath && (
              <div className="card" style={{ marginTop: 10 }}>
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="معاينة الإيصال" style={{ maxHeight: 200, objectFit: 'contain', borderRadius: 8 }} />
                )}
                <div className="row-between">
                  <span style={{ fontSize: '0.84rem' }}>
                    {fileName} <span style={{ color: 'var(--ok)' }}>✓ جاهز</span>
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeFile}>إزالة</button>
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
          {pending ? 'جارٍ الإرسال…' : 'إرسال طلب الحجز'}
        </button>

        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          سيراجع فريق TechMood عملية الدفع، ثم يُرسل الطلب إلى المنتور للموافقة.
        </p>
      </form>
    </>
  );
}
