import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { money } from '@/lib/booking';

import { reviewListing } from '../sections-actions';

export const metadata = { title: 'Market review — TechMood' };

/**
 * Listings waiting for a person to check them (0099): what is sold, the demo,
 * and the hidden delivery link — which only the seller, the admins and a paid
 * buyer ever see. Verified, a listing shows with its mark; refused, it leaves
 * the market and a warning goes on the seller's record.
 */
export default async function AdminMarketPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const { data: pending } = await supabase.rpc('admin_pending_listings');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('مراجعة السوق', 'Market review')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">{t('لوحة الإدارة', 'Admin panel')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('افتح رابط التسليم وتأكّد أنه يطابق الوصف وأنه عمل البائع. التحقق يُظهره في السوق بعلامة «تم التحقق»؛ الرفض يُخرجه ويسجّل تنبيهاً على البائع.',
             'Open the delivery link and check that it matches the description and is the seller’s own work. Verifying puts it on the market, marked verified; refusing takes it off and records a warning on the seller.')}
        </p>
      </section>

      {(pending ?? []).length === 0 ? (
        <p className="notice">{t('لا عروض بانتظار المراجعة.', 'No listings waiting for review.')}</p>
      ) : (
        (pending ?? []).map((listing) => (
          <article className="panel section-block" key={listing.id}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1rem' }}>{listing.project_title} <span className="id-chip">{listing.listing_code}</span></h3>
                <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                  <Link href={`/admin/users/${listing.seller_id}`}>{listing.seller_name}</Link>
                  {listing.seller_warnings > 0 && (
                    <span className="status-pill status-danger" style={{ marginInlineStart: 6 }}>
                      {listing.seller_warnings} {t('تنبيهات سابقة', 'previous warnings')}
                    </span>
                  )}
                  {' · '}<span className="date">{formatDateTime(locale, listing.created_at)}</span>
                </p>
              </div>
              <span className="eng" style={{ fontWeight: 700 }}>{money(listing.price_usd)}</span>
            </div>

            <p style={{ fontSize: '0.88rem', marginTop: 10 }}>{listing.summary_ar}</p>
            {listing.includes.length > 0 && (
              <div className="tags-row" style={{ marginTop: 8 }}>
                {listing.includes.map((item) => <span className="badge-pill" key={item}>{item}</span>)}
              </div>
            )}

            <dl className="invoice-meta" style={{ marginTop: 12 }}>
              <div>
                <dt>{t('رابط التسليم (مخفي عن السوق)', 'Delivery link (hidden from the market)')}</dt>
                <dd>{listing.delivery_url
                  ? <a href={listing.delivery_url} target="_blank" rel="noopener noreferrer" className="eng">{listing.delivery_url}</a>
                  : '—'}</dd>
              </div>
              <div>
                <dt>{t('العرض التجريبي', 'Demo')}</dt>
                <dd>{listing.demo_url
                  ? <a href={listing.demo_url} target="_blank" rel="noopener noreferrer" className="eng">{listing.demo_url}</a>
                  : '—'}</dd>
              </div>
            </dl>

            <div className="row-actions" style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <ActionForm action={reviewListing} submitLabel={t('تحقّقت — اعرضه', 'Verified — list it')}>
                <input type="hidden" name="listing_id" value={listing.id} />
                <input type="hidden" name="decision" value="approve" />
              </ActionForm>
              <ActionForm action={reviewListing} submitLabel={t('ارفض', 'Refuse')} variant="ghost">
                <input type="hidden" name="listing_id" value={listing.id} />
                <input type="hidden" name="decision" value="reject" />
                <input name="note" required minLength={10} placeholder={t('سبب الرفض — يصل للبائع', 'Reason — the seller reads it')} />
              </ActionForm>
            </div>
          </article>
        ))
      )}
    </>
  );
}
