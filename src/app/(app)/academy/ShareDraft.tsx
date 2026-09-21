'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * A draft post, offered and never required.
 *
 * TechMood does not ask anyone to publish their work to be graded: the mentor
 * reviews what is submitted. This is here because writing down what you built
 * is a good habit, and because the document's lesson ends with one — so the
 * text is written for you, and what you do with it is yours.
 */
export function ShareDraft({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <article className="panel section-block">
      <div className="row-between">
        <h3 style={{ fontSize: '0.98rem' }}>{t('مسوّدة منشور — اختيارية', 'A draft post — optional')}</h3>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t('نُسخت', 'Copied') : t('انسخ', 'Copy')}
        </button>
      </div>
      <pre className="share-draft">{text}</pre>
      <p className="muted" style={{ fontSize: '0.74rem' }}>
        {t('النشر لا يؤثر على تقييمك. المنتور يراجع ما تُسلّمه هنا.',
           'Publishing does not affect your grade. Your mentor reviews what you submit here.')}
      </p>
    </article>
  );
}
