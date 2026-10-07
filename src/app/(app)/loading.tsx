import { getT } from '@/lib/i18n.server';

/**
 * What a page shows while it loads (design lab: «هيكل رمادي»): grey shapes
 * where the greeting, a card and a list will be, so the page keeps its
 * outline instead of going blank on a slow line.
 */
export default async function Loading() {
  const t = await getT();
  return (
    <div className="sk-page" aria-busy="true" role="status" aria-label={t('يحمّل الصفحة…', 'Loading the page…')}>
      <div className="sk sk-hero" />
      <div className="sk-row">
        <div className="sk sk-line" style={{ width: '40%' }} />
      </div>
      <div className="sk sk-card" />
      <div className="sk-list">
        <div className="sk sk-item" />
        <div className="sk sk-item" />
        <div className="sk sk-item" />
      </div>
    </div>
  );
}
