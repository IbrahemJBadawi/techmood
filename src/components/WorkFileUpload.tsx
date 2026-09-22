'use client';

import { useRef, useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n.client';

/** 20 MB, and the bucket's own limit is the one that actually decides. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * A file that is a file.
 *
 * The upload goes straight from the browser to Supabase Storage, so a large
 * attachment never travels through a server action. The bucket's row level
 * security is what authorises it — the folder is the id of the brief or the
 * project, and the policy asks the database whether this person may write
 * there. The row is recorded only once the object exists, so a listing never
 * points at a file that is not up.
 */
export function WorkFileUpload({
  bucket, folder, record, label,
}: {
  bucket: 'brief-files' | 'project-files';
  /** The id whose folder the object lives in — the policy reads it. */
  folder: string;
  /** Records the row once the object is stored. */
  record: (path: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  label?: string;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setError('');

    if (file.size > MAX_BYTES) {
      setError(t('أقصى حجم للملف 20 ميغابايت.', 'A file may be at most 20 MB.'));
      return;
    }

    setBusy(true);

    // A name the storage layer will accept, keeping the original for the label.
    const safe = file.name.replace(/[^\w.\-]+/g, '-').slice(-60);
    const path = `${folder}/${Date.now()}-${safe}`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) {
      setBusy(false);
      setError(t('تعذّر رفع الملف — تأكّد من صلاحيتك ثم حاول مرة أخرى.',
                 'The file could not be uploaded — check you are allowed to, then try again.'));
      return;
    }

    startTransition(async () => {
      const result = await record(path, file.name);
      setBusy(false);
      if (!result.ok) setError(result.error ?? '');
      if (input.current) input.current.value = '';
    });
  }

  return (
    <div className="file-upload">
      <label className="btn btn-ghost btn-sm" htmlFor={`upload-${folder}`}>
        {busy ? t('جارٍ الرفع…', 'Uploading…') : label ?? t('+ ارفع ملفاً', '+ Upload a file')}
      </label>
      <input
        ref={input}
        id={`upload-${folder}`}
        type="file"
        hidden
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {error && <p className="notice notice-danger" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
