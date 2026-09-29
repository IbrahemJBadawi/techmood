import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';

import { PriceRow } from './PriceRow';

export const generateMetadata = localizedTitle('أسعاري — TechMood', 'My prices — TechMood');

/**
 * A mentor's own prices.
 *
 * Each level has a band (0077): the mentor prices every kind of session inside
 * it, up or down, and TechMood's share is the level's percentage of whatever
 * they choose. The same price applies however the session is booked — by a
 * learner, a team (per seat) or a company (per seat).
 */
export default async function MentorPricingPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isMentor } = await supabase.rpc('is_mentor');
  if (isMentor !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمنتورز المعتمدين.', 'This page is for approved mentors.')}</p>;
  }

  const { data: mentor } = await supabase
    .from('mentor_profiles')
    .select('level')
    .eq('profile_id', user.id)
    .single();

  const [{ data: prices }, { data: level }] = await Promise.all([
    supabase.rpc('mentor_price_list', { p_mentor: user.id }),
    supabase
      .from('mentor_levels')
      .select('level, title, badge, min_session_usd, max_session_usd, session_price_usd, commission_pct')
      .eq('level', mentor?.level ?? 'L1')
      .single(),
  ]);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/mentor-requests">{t('→ طلبات الجلسات', '← Session requests')}</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('أسعاري وجلساتي', 'My prices and sessions')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '70ch' }}>
          {t(`مستواك ${level?.badge ?? ''} ${level?.title ?? ''}. المستوى يحدد نطاق السعر المسموح به: للساعة من ${level?.min_session_usd ?? '—'} إلى ${level?.max_session_usd ?? '—'} دولاراً، وأنت تحدد سعرك داخله حسب خبرتك ونوع الجلسة. نسبة تكمود ${level?.commission_pct ?? '—'}%، والجلسات الأقصر تُحسب بنسبة مدتها.`,
             `Your level: ${level?.badge ?? ''} ${level?.title ?? ''}. A level sets the allowed price range: $${level?.min_session_usd ?? '—'} to $${level?.max_session_usd ?? '—'} an hour, and you name your own price inside it by your experience and the kind of session. TechMood keeps ${level?.commission_pct ?? '—'}%; shorter sessions are priced by their length.`)}
          {' '}<Link href="/mentor-requests/level">{t('مستواي وطلب الترقية', 'My level and upgrade request')}</Link>
        </p>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {t('جلسة الفريق أو الشركة تُحسب بالسعر نفسه لكل مقعد.', 'A team or company session is charged the same price per seat.')}
        </p>
      </section>

      {(prices ?? []).map((row) => (
        <PriceRow
          key={row.session_type_id}
          sessionTypeId={row.session_type_id}
          name={contentText(t.locale, row.name_ar, row.name_en)}
          duration={row.duration_minutes}
          price={Number(row.price_usd)}
          isCustom={row.is_custom}
          offered={row.is_active}
          min={Number(row.min_usd)}
          max={Number(row.max_usd)}
          fallback={Number(row.default_usd)}
          commissionPct={Number(level?.commission_pct ?? 0)}
        />
      ))}
    </>
  );
}
