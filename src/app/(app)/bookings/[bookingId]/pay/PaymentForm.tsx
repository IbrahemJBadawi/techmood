'use client';

import { useActionState, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { PayTo } from '@/lib/database.types';
import { PayToDetails } from '@/components/PayToDetails';

import { useT } from '@/lib/i18n.client';

import { submitPaymentProof, type PaymentState } from '../../actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg'];

export function PaymentForm({
  bookingId,
  payTo,
  userId,
}: {
  bookingId: string;
  payTo: PayTo;
  userId: string;
}) {
  const method = payTo;
  const t = useT();
  const [state, formAction, pending] = useActionState(submitPaymentProof, undefined as PaymentState);

  const [proofPath, setProofPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState('');

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
        <PayToDetails payTo={payTo} />
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
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('✓ تم الدفع', '✓ I have paid')}
        </button>

        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          {t('بعد إتمام التحويل اضغط «تم الدفع». يُرسَل طلب تأكيد إلى TechMood، ولا يُعتمد الدفع قبل مراجعته — بعدها يُرسل الحجز إلى المنتور.',
             'Once the transfer is done, press “I have paid”. A confirmation request goes to TechMood, and the payment is not approved until it is checked — then the booking goes to the mentor.')}
        </p>
      </form>
    </>
  );
}
