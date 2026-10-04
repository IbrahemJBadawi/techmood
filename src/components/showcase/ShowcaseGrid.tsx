import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import type { ProductType, ShowcaseCard } from '@/lib/database.types';
import { CATEGORIES, PRODUCT_TYPES, galleryPath, mediaUrl } from '@/lib/showcase';

export type ShowcaseFilters = {
  q?: string; category?: string; type?: string; sort?: string;
};

const SORTS = {
  new:        { ar: 'الأحدث', en: 'Newest' },
  popular:    { ar: 'الأكثر تفاعلاً', en: 'Most popular' },
  price_low:  { ar: 'السعر: الأقل', en: 'Price: low to high' },
  price_high: { ar: 'السعر: الأعلى', en: 'Price: high to low' },
} as const;

/**
 * The cards of the gallery and the market (0121, 0122), with their filters:
 * search, category, product type and order — a plain GET form, so a filtered
 * view is a link that can be shared.
 */
export async function ShowcaseGrid({
  mode, group, filters, inApp, action, hidden = {}, emptyCta,
}: {
  mode: 'all' | 'gallery' | 'market';
  group?: 'projects' | 'services';
  filters: ShowcaseFilters;
  inApp: boolean;
  /** where the filter form submits */
  action: string;
  /** extra query values the form keeps (a tab, for example) */
  hidden?: Record<string, string>;
  emptyCta?: React.ReactNode;
}) {
  const t = await getT();
  const supabase = await createClient();

  const category = filters.category && filters.category in CATEGORIES ? filters.category : null;
  const type = filters.type && filters.type in PRODUCT_TYPES ? (filters.type as ProductType) : null;
  const sort = (filters.sort && filters.sort in SORTS ? filters.sort : 'new') as keyof typeof SORTS;
  const showPrices = mode !== 'gallery';

  const { data } = await supabase.rpc('gallery_projects', {
    p_mode: mode, p_search: filters.q?.trim() || null, p_category: category, p_type: type,
    p_sort: sort, p_limit: 48, p_group: group ?? null,
  });
  const cards = (data ?? []) as ShowcaseCard[];
  const href = (code: string) => (inApp ? `/p/${code}` : galleryPath(code));

  return (
    <>
      <form className="sc-filters" action={action} role="search">
        {Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        <input type="search" name="q" defaultValue={filters.q ?? ''} placeholder={t('ابحث باسم أو تقنية أو مهارة…', 'Search a name, technology or skill…')}
               aria-label={t('بحث', 'Search')} />
        <select name="category" defaultValue={category ?? ''} aria-label={t('التصنيف', 'Category')}>
          <option value="">{t('كل التصنيفات', 'All categories')}</option>
          {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
        </select>
        {group !== 'services' && (
          <select name="type" defaultValue={type ?? ''} aria-label={t('نوع المنتج', 'Product type')}>
            <option value="">{t('كل الأنواع', 'All types')}</option>
            {Object.entries(PRODUCT_TYPES).filter(([key]) => key !== 'digital_service' || !group)
              .map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select>
        )}
        <select name="sort" defaultValue={sort} aria-label={t('الترتيب', 'Sort')}>
          {Object.entries(SORTS).filter(([key]) => showPrices || !key.startsWith('price'))
            .map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
        </select>
        <button className="btn btn-primary btn-sm">{t('تصفية', 'Filter')}</button>
      </form>

      {cards.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا شيء يطابق هذا بعد', 'Nothing matches yet')}</h3>
          {emptyCta}
        </div>
      ) : (
        <div className="sc-grid">
          {cards.map((card) => {
            const cover = mediaUrl(card.cover);
            return (
              <Link className="sc-card-item" href={href(card.code)} key={card.project_id}>
                <span className="sc-card-cover">
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" loading="lazy" />
                    : <span className="sc-card-initial">{card.title.trim().charAt(0)}</span>}
                  {card.product_type && <span className="sc-card-type">{t(PRODUCT_TYPES[card.product_type])}</span>}
                  {showPrices && card.discount_pct > 0 && <span className="sc-card-discount eng">-{card.discount_pct}%</span>}
                </span>
                <span className="sc-card-body">
                  <strong className="sc-card-title">{card.title}</strong>
                  {card.tagline && <span className="sc-card-tagline">{card.tagline}</span>}
                  <span className="sc-card-owner">
                    {card.owner_avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={card.owner_avatar} alt="" className="sc-avatar is-xs" />
                      : <span className="sc-avatar is-xs is-initial">{(card.owner_name ?? '?').charAt(0)}</span>}
                    {card.team_title ?? card.owner_name}
                  </span>
                  {(card.academic_title || card.mentor_rating !== null) && (
                    <span className="sc-card-academy">
                      {card.academic_title && <>🎓 {card.academic_title}</>}
                      {card.mentor_rating !== null && <> · ★ <span className="eng">{Number(card.mentor_rating).toFixed(1)}</span> {t('منتور', 'mentor')}</>}
                    </span>
                  )}
                  <span className="sc-card-stats">
                    <span>❤️ <span className="eng">{card.likes}</span></span>
                    <span>👁️ <span className="eng">{card.views}</span></span>
                    <span>💬 <span className="eng">{card.comments_count}</span></span>
                    {card.listing_id && <span>🛒 <span className="eng">{card.sales_count}</span></span>}
                    {card.rating !== null && <span>⭐ <span className="eng">{card.rating}</span></span>}
                  </span>
                  {showPrices && card.effective_price !== null && (
                    <span className="sc-card-price">
                      <b className="eng">{money(card.effective_price)}</b>
                      {card.discount_pct > 0 && card.price_usd !== null && <s className="eng">{money(card.price_usd)}</s>}
                      {card.negotiable && <small>{t('قابل للتفاوض', 'Negotiable')}</small>}
                      {card.listing_status === 'sold' && <small>{t('مباع', 'Sold')}</small>}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
