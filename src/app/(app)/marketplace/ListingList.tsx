import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { avatarColor } from '@/lib/mentor-look';
import type { PaymentMethodPublic, SaleLicence } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { BuyForm } from '../projects/[projectId]/Money';
import { PUBLIC_METHOD_COLUMNS } from '@/lib/database.types';

const LICENCE: Record<SaleLicence, Text> = {
  usage_rights:  { ar: 'حق استخدام',  en: 'Usage rights' },
  full_transfer: { ar: 'نقل كامل',    en: 'Full transfer' },
};

/**
 * Finished work that is for sale.
 *
 * Every listing here carries the code of its exhibition entry, so a buyer can
 * check that the work was judged before it was priced — which is the only
 * reason a market like this is worth more than a folder of zip files.
 */
export async function ListingList({ search }: { search?: string }) {
  const t = await getT();
  const supabase = await createClient();

  const [{ data: listings }, { data: methods }] = await Promise.all([
    supabase.rpc('market_listings', { p_search: search ?? null, p_limit: 24 }),
    supabase.from('payment_methods').select(PUBLIC_METHOD_COLUMNS).eq('is_enabled', true).order('sort_order'),
  ]);

  if ((listings ?? []).length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا مشاريع معروضة للبيع', 'Nothing on sale yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('يُعرض هنا العمل المكتمل الذي مرّ بالتقييم وظهر في المعرض — لا مشاريع غير منتهية.',
             'What appears here is finished work that was judged and exhibited — never an unfinished project.')}
        </p>
      </div>
    );
  }

  return (
    <div className="market-grid">
      {(listings ?? []).map((listing) => (
        <article className="mk-card" key={listing.id} style={{ '--hue': avatarColor(listing.listing_code) } as React.CSSProperties}>
          <div className="gl-cover mk-cover" aria-hidden="true">
            <span className="gl-initial">{(listing.project_title ?? "?").trim().charAt(0)}</span>
            <span className="gl-top">
              <span className="gl-kind">{t(LICENCE[listing.licence])}</span>
              {listing.discount_pct > 0 && <span className="gl-rating eng">-{listing.discount_pct}%</span>}
            </span>
          </div>

          <div className="mk-body">
            <div className="mk-title-row">
              <h3>{listing.project_title}</h3>
              {listing.verified && <span className="mk-verified">✓ {t('موثّق', 'Verified')}</span>}
            </div>
            <p className="mk-seller">
              {listing.team_title ?? listing.seller_name}
              {listing.seller_rating !== null && (
                <> · <span className="eng">★ {Number(listing.seller_rating).toFixed(1)}</span></>
              )}
              {' · '}{t(`${listing.sales_count} مبيعات`, `${listing.sales_count} sales`)}
            </p>
            <p className="mk-summary">{listing.summary_ar}</p>

            {(listing.includes.length > 0 || listing.technologies.length > 0) && (
              <div className="mk-chips">
                {listing.includes.map((item) => <span key={item}>{item}</span>)}
                {listing.technologies.slice(0, 4).map((tech) => <span className="eng" key={tech}>{tech}</span>)}
              </div>
            )}

            <div className="mk-price-row">
              <span className="mk-price eng">
                {money(listing.effective_price)}
                {listing.discount_pct > 0 && <s>{money(listing.price_usd)}</s>}
              </span>
              <span className="mk-links">
                {listing.demo_url && (
                  <a className="btn btn-ghost btn-sm" href={listing.demo_url} target="_blank" rel="noopener noreferrer">
                    {t('عرض تجريبي', 'Demo')}
                  </a>
                )}
                {listing.entry_code && (
                  <Link className="btn btn-ghost btn-sm" href={`/exhibition/${listing.entry_code}/verify`}>
                    {t('تحقّق', 'Check')}
                  </Link>
                )}
              </span>
            </div>

            <div className="mk-buy">
              <BuyForm listingId={listing.id} methods={(methods ?? []) as PaymentMethodPublic[]} />
            </div>

            <p className="mk-note">
              {t('رابط التسليم يصلك بعد تأكيد الدفع، ولا ينتقل المال للبائع إلا بعد استلامك.',
                 'The delivery link reaches you once the payment is confirmed; the seller is paid only once you have it.')}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
