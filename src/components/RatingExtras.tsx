'use client';

import { useT } from '@/lib/i18n.client';

/**
 * The part of a rating that stars cannot say (0081): would you recommend it,
 * what helped most, what could be better. All three are optional.
 */
export function RatingExtras({ idPrefix }: { idPrefix: string }) {
  const t = useT();
  return (
    <>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor={`${idPrefix}-liked`}>{t('ما أكثر شيء استفدت منه؟ (اختياري)', 'What helped you most? (optional)')}</label>
        <textarea id={`${idPrefix}-liked`} name="liked" rows={2} maxLength={1000} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-improve`}>{t('ما الذي يمكن تحسينه؟ (اختياري)', 'What could be better? (optional)')}</label>
        <textarea id={`${idPrefix}-improve`} name="improve" rows={2} maxLength={1000} />
      </div>
      <fieldset className="field" style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: '0.86rem' }}>{t('هل توصي بهذه التجربة؟', 'Would you recommend this experience?')}</legend>
        <div className="tags-row">
          <label className="switch-row"><input type="radio" name="recommend" value="yes" />{t('نعم', 'Yes')}</label>
          <label className="switch-row"><input type="radio" name="recommend" value="no" />{t('لا', 'No')}</label>
        </div>
      </fieldset>
    </>
  );
}
