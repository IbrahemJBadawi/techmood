'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { CATEGORIES, PRODUCT_TYPES } from '@/lib/showcase';

import { createShowcaseProject, type ShowcaseState } from '../showcase-actions';

/**
 * Step one of a project page: a name, what kind of product it is, and where it
 * should appear. Pictures, links, the description and the price come next, on
 * the page's editor.
 */
export function NewPersonalProjectForm({
  intent,
  assignmentId,
  assignmentTitle,
  defaultType,
}: {
  intent: 'gallery' | 'market' | 'both';
  defaultType: 'full_project' | 'digital_service';
  assignmentId: string | null;
  assignmentTitle: string | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createShowcaseProject, undefined as ShowcaseState);

  return (
    <form action={formAction} className="panel section-block stack">
      {assignmentId && <input type="hidden" name="assignment_id" value={assignmentId} />}
      {assignmentTitle && (
        <p className="notice" style={{ margin: 0 }}>
          {t('يُربط المشروع بتسليمك: ', 'Linked to your hand-in: ')}<strong>{assignmentTitle}</strong>
          {t(' — وتُنقل روابطه إلى صفحة المشروع.', ' — its links are copied to the page.')}
        </p>
      )}

      <div className="field">
        <label htmlFor="title">{t('اسم المشروع', 'Project name')}</label>
        <input id="title" name="title" required minLength={3} maxLength={160} defaultValue={assignmentTitle ?? ''} />
      </div>

      <div className="rules-grid">
        <div className="field">
          <label htmlFor="product_type">{t('نوع المنتج', 'Product type')}</label>
          <select id="product_type" name="product_type" defaultValue={defaultType}>
            {Object.entries(PRODUCT_TYPES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">{t('التصنيف', 'Category')}</label>
          <select id="category" name="category" defaultValue="web">
            {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="sc-intent">
        <legend>{t('أين يظهر؟', 'Where should it appear?')}</legend>
        <label><input type="radio" name="intent" value="gallery" defaultChecked={intent === 'gallery'} /> 🖼️ {t('في المعرض', 'In the gallery')}</label>
        <label><input type="radio" name="intent" value="market" defaultChecked={intent === 'market'} /> 🛒 {t('للبيع في السوق', 'For sale in the market')}</label>
        <label><input type="radio" name="intent" value="both" defaultChecked={intent === 'both'} /> {t('كلاهما', 'Both')}</label>
      </fieldset>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <div>
        <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>
          {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('التالي: الصور والتفاصيل ←', 'Next: pictures and details →')}
        </button>
      </div>
    </form>
  );
}
