'use client';

import { useRef, useState } from 'react';

import { browserClient } from '@/lib/supabase/lazy-client';
import { useT } from '@/lib/i18n.client';
import { mediaUrl } from '@/lib/showcase';

const MAX_IMAGES = 8;
const LONG_SIDE = 1600;
const MAX_INPUT = 20 * 1024 * 1024;

/**
 * A project's screenshots (0121). The first one is the cover.
 *
 * Each picture is shrunk in the browser (longest side 1600px, JPEG) before it
 * is sent into the project's own folder of the public project-media bucket —
 * the bucket refuses non-images and anything over 3 MB, and only the project's
 * editors may write that folder. The list itself is saved with the rest of the
 * form (hidden input "images"); a picture removed here is deleted from storage
 * when the form is saved, not before, so leaving without saving loses nothing.
 */
export function ProjectImagesUploader({ projectId, initial }: { projectId: string; initial: string[] }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(files: FileList) {
    setError('');
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) {
      setError(t(`الحد الأقصى ${MAX_IMAGES} صور.`, `At most ${MAX_IMAGES} pictures.`));
      return;
    }
    setBusy(true);
    try {
      const supabase = await browserClient();
      const added: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith('image/') || file.size > MAX_INPUT) {
          setError(t('بعض الملفات ليست صوراً أو أكبر من 20 ميغابايت — تُركت.', 'Some files were not images or were over 20 MB — skipped.'));
          continue;
        }
        const blob = await shrink(file);
        const path = `${projectId}/${crypto.randomUUID()}.jpg`;
        const { error: upload } = await supabase.storage.from('project-media').upload(path, blob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        });
        if (upload) throw upload;
        added.push(path);
      }
      setImages((current) => [...current, ...added]);
    } catch {
      setError(t('تعذّر رفع صورة — حاول مرة أخرى.', 'A picture could not be uploaded — please try again.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const remove = (path: string) => setImages((current) => current.filter((item) => item !== path));
  const makeCover = (path: string) => setImages((current) => [path, ...current.filter((item) => item !== path)]);

  return (
    <div className="sc-images">
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="images_before" value={JSON.stringify(initial)} />
      <div className="sc-images-grid">
        {images.map((path, index) => (
          <figure className={`sc-thumb${index === 0 ? ' is-cover' : ''}`} key={path}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(path) ?? ''} alt="" loading="lazy" />
            <figcaption>
              {index === 0
                ? <span className="sc-cover-tag">{t('الغلاف', 'Cover')}</span>
                : <button type="button" className="sc-mini" onClick={() => makeCover(path)}>{t('اجعلها الغلاف', 'Make cover')}</button>}
              <button type="button" className="sc-mini is-danger" onClick={() => remove(path)} aria-label={t('احذف الصورة', 'Remove picture')}>✕</button>
            </figcaption>
          </figure>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" className="sc-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? t('جارٍ الرفع…', 'Uploading…') : t('+ أضف صوراً', '+ Add pictures')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
             onChange={(event) => event.target.files && add(event.target.files)} />
      <small className="muted">
        {t(`حتى ${MAX_IMAGES} صور (لقطات شاشة للمشروع). الأولى هي الغلاف في المعرض والسوق.`,
           `Up to ${MAX_IMAGES} pictures (screenshots). The first is the cover in the gallery and the market.`)}
      </small>
      {error && <p className="notice notice-danger" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}

/** Longest side down to 1600px, re-encoded as JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.85);
  });
}
