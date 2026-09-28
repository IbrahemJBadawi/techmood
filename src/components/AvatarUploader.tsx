'use client';

import { useRef, useState } from 'react';

import { browserClient } from '@/lib/supabase/lazy-client';
import { useT } from '@/lib/i18n.client';
import { avatarColor, initialOf } from '@/lib/mentor-look';

const SIDE = 512;
const MAX_INPUT = 15 * 1024 * 1024;

/**
 * A profile photo, optional and the member's own.
 *
 * The picture is cropped to a centred square and shrunk to 512px in the
 * browser before it is sent, so a phone photo of several megabytes arrives as
 * a small JPEG; the bucket refuses anything that is not an image or is over
 * 2 MB anyway (0108). It lands in the member's own folder, and where the choice is
 * saved at once (Settings) the previous upload is removed so old photos do not
 * pile up.
 */
export function AvatarUploader({
  userId,
  name,
  value,
  onChange,
  size = 96,
  cleanup = true,
}: {
  userId: string;
  name: string;
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  size?: number;
  /** Remove the replaced file at once — only where onChange saves at once too. */
  cleanup?: boolean;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = Boolean(value) && broken !== value;

  async function pick(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError(t('اختر صورة (JPG أو PNG أو WebP).', 'Choose an image (JPG, PNG or WebP).'));
      return;
    }
    if (file.size > MAX_INPUT) {
      setError(t('الصورة كبيرة جداً — اختر صورة أصغر من 15 ميغابايت.', 'That image is too large — pick one under 15 MB.'));
      return;
    }

    setBusy(true);
    try {
      const blob = await squareJpeg(file);
      const supabase = await browserClient();
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upload } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
      });
      if (upload) throw upload;

      const previous = cleanup ? ownPath(value, userId) : null;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await onChange(data.publicUrl);
      if (previous) await supabase.storage.from('avatars').remove([previous]);
    } catch {
      setError(t('تعذّر رفع الصورة — حاول مرة أخرى.', 'The photo could not be uploaded — please try again.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function clear() {
    setError('');
    setBusy(true);
    const previous = cleanup ? ownPath(value, userId) : null;
    try {
      await onChange(null);
      if (previous) await (await browserClient()).storage.from('avatars').remove([previous]);
    } catch {
      setError(t('تعذّرت إزالة الصورة — حاول مرة أخرى.', 'The photo could not be removed — please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="av-up">
      <button
        type="button"
        className="av-up-face"
        style={{ width: size, height: size, background: showImage ? undefined : avatarColor(userId) }}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={value ? t('غيّر الصورة', 'Change photo') : t('أضف صورة', 'Add a photo')}
      >
        {showImage
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value!} alt="" width={size} height={size} onError={() => setBroken(value)} />
          : <span style={{ fontSize: size * 0.4 }}>{initialOf(name)}</span>}
        <span className="av-up-cam" aria-hidden="true">
          {busy ? <span className="av-up-spin" /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </span>
      </button>

      <div className="av-up-side">
        <div className="av-up-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? t('جارٍ الرفع…', 'Uploading…') : value ? t('غيّر الصورة', 'Change photo') : t('أضف صورة', 'Add a photo')}
          </button>
          {value && (
            <button type="button" className="link-button" onClick={clear} disabled={busy}>
              {t('إزالة', 'Remove')}
            </button>
          )}
        </div>
        <p className="muted">
          {t('اختيارية. تظهر على ملفك وفي فرقك ورسائلك. نقصّها مربّعاً ونصغّرها قبل الرفع.',
             'Optional. It shows on your profile, in your teams and messages. We crop it square and shrink it before upload.')}
        </p>
        {error && <p className="notice notice-danger">{error}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />
    </div>
  );
}

/** The storage path of a photo in this member's own folder, or null. */
function ownPath(url: string | null, userId: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/avatars/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = decodeURIComponent(url.slice(at + marker.length));
  return path.startsWith(`${userId}/`) ? path : null;
}

/** Centre-crop to a square and re-encode as a 512px JPEG. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(SIDE, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.88);
  });
}
