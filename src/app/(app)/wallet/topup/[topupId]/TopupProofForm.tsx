'use client';

import { useActionState, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n.client';
import { UploadCard } from '@/components/UploadCard';

import { submitTopupProof, type CreditState } from '../../credit-actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg'];

/** The receipt of a top-up transfer: uploaded to the payer's own private folder, then sent for review. */
export function TopupProofForm({ topupId, userId, requiresReceipt, requiresReference, referenceLabel }: {
  topupId: string; userId: string; requiresReceipt: boolean; requiresReference: boolean; referenceLabel: string | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(submitTopupProof, undefined as CreditState);
  const [proofPath, setProofPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function upload(file: File) {
    setUploadError('');
    if (!ALLOWED.includes(file.type)) { setUploadError(t('الصيغ المقبولة: PNG أو JPG فقط.', 'PNG or JPG only.')); return; }
    if (file.size > MAX_BYTES) { setUploadError(t('أقصى حجم للإيصال 5 ميغابايت.', 'At most 5 MB.')); return; }
    setUploading(true);
    const key = `${userId}/topup-${topupId}-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
    const { error } = await createClient().storage.from('payment-proofs').upload(key, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) { setUploadError(t('تعذّر رفع الإيصال — حاول مرة أخرى.', 'Upload failed — try again.')); return; }
    setProofPath(key);
  }

  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;

  return (
    <form action={action} className="panel">
      <input type="hidden" name="topup_id" value={topupId} />
      <input type="hidden" name="proof_path" value={proofPath} />
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('إثبات التحويل', 'Proof of transfer')}</h3>
      <div className="field">
        <label htmlFor="reference">
          {requiresReference ? `${referenceLabel ?? t('الرقم المرجعي', 'Reference number')}${t(' — إلزامي', ' — required')}` : t('رقم العملية (اختياري)', 'Transaction number (optional)')}
        </label>
        <input id="reference" name="reference" dir="ltr" required={requiresReference} />
      </div>
      {requiresReceipt && (
        <div className="field">
          <span className="field-label">{t('صورة الإيصال', 'Receipt image')}</span>
          <UploadCard id="topup-receipt" accept="image/png,image/jpeg"
                      label={t('اختر صورة الإيصال أو اسحبها هنا', 'Pick the receipt image, or drop it here')}
                      hint={t('PNG أو JPG، بحد أقصى 5 ميغابايت', 'PNG or JPG, 5 MB max')}
                      status={uploading ? 'busy' : uploadError ? 'error' : proofPath ? 'done' : 'idle'}
                      onPick={(file) => void upload(file)} onClear={() => { setProofPath(''); setUploadError(''); }} />
          {uploadError && <p className="notice notice-danger" style={{ marginTop: 8 }}>{uploadError}</p>}
        </div>
      )}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-primary" style={{ width: '100%' }}
              disabled={pending || uploading || (requiresReceipt && !proofPath)} aria-busy={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('✓ حوّلت المبلغ', '✓ I have transferred it')}
      </button>
    </form>
  );
}
