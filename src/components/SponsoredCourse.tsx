import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

/**
 * One sponsored mentor course (design lab 5): clearly labelled, one card, and
 * none at all for Premium members — the database decides who sees it (0162).
 */
export async function SponsoredCourse({ className = '' }: { className?: string }) {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('sponsored_course');
  const ad = data?.[0];
  if (!ad || !ad.path_slug) return null;
  const to = `/academy/${ad.path_slug}/${ad.course_slug}`;

  return (
    <aside className={`sponsored-card ${className}`} aria-label={t('دورة مُموَّلة', 'Sponsored course')}>
      <span className="sponsored-tag">{t('مُموَّل', 'Sponsored')}</span>
      <div className="sponsored-body">
        <strong>{ad.title_ar}</strong>
        {ad.description_ar && <p className="muted">{ad.description_ar}</p>}
        <p className="sponsored-meta">
          {ad.mentor_name && <>{t('من المنتور ', 'By ')}{ad.mentor_name} · </>}
          {ad.price_mode === 'once' ? <span className="eng">${Number(ad.price_usd ?? 0)}</span>
            : ad.price_mode === 'subscription' ? t('ضمن اشتراك المنتور', 'In the mentor’s plan') : t('مجانية', 'Free')}
        </p>
      </div>
      <Link className="btn btn-sm btn-primary" href={`/go/sponsored/${ad.promotion_id}?to=${encodeURIComponent(to)}`} prefetch={false}>
        {t('اعرض الدورة', 'See the course')}
      </Link>
    </aside>
  );
}
