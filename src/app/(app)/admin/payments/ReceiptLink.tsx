'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { receiptUrl } from './actions';

/**
 * Receipts live in a private bucket. Rather than exposing a permanent URL, an
 * admin asks for a short-lived signed link at the moment they want to look.
 */
export function ReceiptLink({ proofPath }: { proofPath: string }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setLoading(true);
    setFailed(false);
    const signed = await receiptUrl(proofPath);
    setLoading(false);
    if (signed) setUrl(signed);
    else setFailed(true);
  }

  if (url) {
    return (
      <div style={{ marginTop: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={t('إيصال الدفع', 'Payment receipt')}
          style={{ maxHeight: 340, borderRadius: 8, border: '1px solid var(--line)' }}
        />
        <a className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} href={url} target="_blank" rel="noreferrer noopener">
          {t('فتح بالحجم الكامل ↗', 'Open full size ↗')}
        </a>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={open} disabled={loading}>
        {loading ? t('جارٍ التحميل…', 'Loading…') : t('عرض الإيصال', 'View receipt')}
      </button>
      {failed && <p className="notice notice-danger" style={{ marginTop: 8 }}>{t('تعذّر فتح الإيصال.', 'The receipt could not be opened.')}</p>}
    </div>
  );
}
