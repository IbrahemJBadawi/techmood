'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n.client';

import { attachPayoutProof } from './actions';

/**
 * Optional: the admin's receipt for money sent out. It goes into the payee's
 * own folder of a private bucket, so the payee can read the receipt for money
 * sent to them and nobody else can.
 */
export function PayoutProof({ requestId, payeeId, hasProof }: {
  requestId: string;
  payeeId: string;
  hasProof: boolean;
}) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(hasProof ? 'done' : 'idle');

  async function upload(file: File) {
    setState('busy');
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${payeeId}/${requestId}-${Date.now()}.${extension}`;
    const { error } = await createClient().storage.from('payout-proofs').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) { setState('error'); return; }
    const result = await attachPayoutProof(requestId, path);
    setState(result.ok ? 'done' : 'error');
  }

  return (
    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
      {state === 'done' ? t('✓ إثبات التحويل مرفوع', '✓ Transfer proof attached')
        : state === 'busy' ? t('جارٍ الرفع…', 'Uploading…')
        : state === 'error' ? t('تعذّر الرفع — أعد المحاولة', 'Upload failed — try again')
        : t('ارفع إثبات التحويل (اختياري)', 'Attach transfer proof (optional)')}
      <input type="file" hidden accept="image/png,image/jpeg,application/pdf"
             onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </label>
  );
}
