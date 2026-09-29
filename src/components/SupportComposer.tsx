'use client';

import { useActionState, useRef, useState, useTransition, type ReactNode } from 'react';

import { browserClient } from '@/lib/supabase/lazy-client';
import { useT } from '@/lib/i18n.client';

type State = { error?: string; ok?: string } | undefined;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * A support form with an optional attachment.
 *
 * The file goes from the browser into the writer's own folder of the private
 * support-files bucket (the storage policy only allows that folder), and the
 * form then carries its path; the database checks the path is the writer's.
 */
export function SupportComposer({
  action, userId, children, submitLabel, resetOnSuccess = false,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  userId: string;
  children: ReactNode;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, undefined as State);
  const [uploadError, setUploadError] = useState('');
  const [busy, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  async function submit(formData: FormData) {
    setUploadError('');
    const file = formData.get('file');
    formData.delete('file');
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        setUploadError(t('أقصى حجم للمرفق 10 ميغابايت.', 'An attachment may be at most 10 MB.'));
        return;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, '-').slice(-60);
      const path = `${userId}/${Date.now()}-${safe}`;
      const { error } = await (await browserClient()).storage.from('support-files').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) {
        setUploadError(t('تعذّر رفع المرفق، حاول مرة أخرى.', 'The attachment could not be uploaded — try again.'));
        return;
      }
      formData.set('attachment', path);
    }
    startTransition(() => {
      formAction(formData);
      if (resetOnSuccess) form.current?.reset();
    });
  }

  return (
    <form ref={form} action={submit} className="stack">
      {children}
      <div className="field">
        <label htmlFor="support-file">{t('📎 مرفق (صورة تحويل، لقطة شاشة، ملف) — اختياري', '📎 Attachment (transfer receipt, screenshot, file) — optional')}</label>
        <input id="support-file" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf" />
      </div>
      {uploadError && <p className="notice notice-danger">{uploadError}</p>}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-primary btn-sm" type="submit" disabled={pending || busy}>
        {pending || busy ? t('جارٍ الإرسال…', 'Sending…') : submitLabel}
      </button>
    </form>
  );
}
