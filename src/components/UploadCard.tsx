'use client';

import { useEffect, useRef, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * A file picker drawn as a card (design lab: «بطاقة مع معاينة وتقدّم»):
 * empty, it is a dashed drop zone you tap or drop a file on; with a file, it
 * shows a thumbnail (or a document tile), the name and size, a progress bar
 * while the upload runs, and a way to remove it.
 *
 * It only draws. The caller does the uploading, through `onPick`, and says how
 * it went with `status`. With `name`, the real <input type=file> also travels
 * with the surrounding form, for forms that read the file on submit.
 */
export function UploadCard({
  id, name, accept, label, hint, status = 'idle', disabled, onPick, onClear,
}: {
  id: string;
  name?: string;
  accept?: string;
  label: string;
  hint?: string;
  status?: 'idle' | 'busy' | 'done' | 'error';
  disabled?: boolean;
  onPick?: (file: File) => void;
  onClear?: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [over, setOver] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function take(next: File) {
    setFile(next);
    setPreview(next.type.startsWith('image/') ? URL.createObjectURL(next) : '');
    onPick?.(next);
  }

  function clear() {
    setFile(null);
    setPreview('');
    if (input.current) input.current.value = '';
    onClear?.();
  }

  const size = file ? (file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`) : '';
  const extension = file?.name.split('.').pop()?.toUpperCase().slice(0, 4) ?? '';

  return (
    <div className={`upload-card${file ? ' has-file' : ''}${over ? ' is-over' : ''}${status === 'error' ? ' is-error' : ''}`}>
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        disabled={disabled || status === 'busy'}
        className="upload-input"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) take(next);
        }}
      />

      {!file ? (
        <label
          htmlFor={id}
          className="upload-drop"
          onDragOver={(event) => { event.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            const next = event.dataTransfer.files?.[0];
            if (!next || !input.current) return;
            // keep the real input in step, so a form that reads it gets the dropped file
            const list = new DataTransfer();
            list.items.add(next);
            input.current.files = list.files;
            take(next);
          }}
        >
          <span className="upload-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.1"
                 strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
          </span>
          <span className="upload-label">{label}</span>
          {hint && <span className="upload-hint">{hint}</span>}
        </label>
      ) : (
        <div className="upload-file">
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="upload-thumb" src={preview} alt={t('معاينة', 'Preview')} />
            : <span className="upload-thumb upload-doc eng" aria-hidden="true">{extension || 'FILE'}</span>}
          <div className="upload-meta">
            <strong className="upload-name" dir="auto">{file.name}</strong>
            <span className="upload-sub">
              <bdi dir="ltr">{size}</bdi>
              {' · '}
              {status === 'busy' ? t('جارٍ الرفع…', 'Uploading…')
                : status === 'error' ? t('لم يُرفع', 'Not uploaded')
                : status === 'done' ? t('✓ رُفع', '✓ Uploaded')
                : t('جاهز للإرسال', 'Ready to send')}
            </span>
            <span className={`upload-bar is-${status}`} role="progressbar" aria-label={t('تقدّم الرفع', 'Upload progress')}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={status === 'done' || status === 'idle' ? 100 : undefined}>
              <span />
            </span>
          </div>
          <button type="button" className="upload-remove" onClick={clear} disabled={status === 'busy'}
                  aria-label={t('إزالة الملف', 'Remove the file')}>✕</button>
        </div>
      )}
    </div>
  );
}
