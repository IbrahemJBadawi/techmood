'use client';

import { useState, useTransition } from 'react';

import { UploadCard } from '@/components/UploadCard';
import { browserClient } from '@/lib/supabase/lazy-client';
import { useT } from '@/lib/i18n.client';

import { requestVerification } from './actions';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The document goes straight from the browser into the member's own folder in
 * a private bucket; only they and an admin can open it, and it is deleted as
 * soon as the admin decides.
 */
export function VerificationForm({ userId }: { userId: string }) {
  const t = useT();
  const [legalName, setLegalName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (legalName.trim().length < 3) {
      setError(t('اكتب اسمك كما هو في الوثيقة.', 'Write your name as it appears on the document.'));
      return;
    }
    if (!file) {
      setError(t('اختر صورة الوثيقة.', 'Pick a photo of the document.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('أقصى حجم 5 ميغابايت.', 'At most 5 MB.'));
      return;
    }
    startTransition(async () => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const supabase = await browserClient();
      const { error: uploadError } = await supabase.storage.from('identity-docs').upload(path, file, {
        contentType: file.type || 'application/octet-stream', upsert: false,
      });
      if (uploadError) {
        setError(t('تعذّر رفع الوثيقة — صورة أو PDF حتى 5 ميغابايت.', 'The document could not be uploaded — an image or PDF up to 5 MB.'));
        return;
      }
      const result = await requestVerification(legalName.trim(), path);
      if (!result.ok) setError(result.error ?? '');
      else setSent(true);
    });
  }

  if (sent) {
    return <p className="notice notice-ok">{t('أُرسل طلبك — ستصلك النتيجة بإشعار.', 'Sent — you will be notified of the outcome.')}</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <div className="field">
        <label htmlFor="legal_name">{t('اسمك كما في الوثيقة', 'Your name as on the document')}</label>
        <input id="legal_name" value={legalName} onChange={(e) => setLegalName(e.target.value)}
               maxLength={120} autoComplete="name" required />
      </div>
      <UploadCard
        id="identity-doc"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        label={t('صورة الهوية أو جواز السفر', 'Photo of your ID or passport')}
        hint={t('صورة واضحة أو PDF — حتى 5 ميغابايت', 'A clear photo or PDF — up to 5 MB')}
        status={pending ? 'busy' : error ? 'error' : file ? 'done' : 'idle'}
        onPick={(next) => { setFile(next); setError(''); }}
        onClear={() => setFile(null)}
      />
      {error && <p className="notice notice-danger">{error}</p>}
      <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }} disabled={pending}>
        {pending ? t('يُرسل…', 'Sending…') : t('أرسل للمراجعة', 'Send for review')}
      </button>
    </form>
  );
}
