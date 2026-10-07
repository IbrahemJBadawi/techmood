import { redirect } from 'next/navigation';

import { PremiumBadge } from '@/components/PremiumBadge';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { SubscribeForm } from './SubscribeForm';

export const generateMetadata = localizedTitle('TechMood Premium', 'TechMood Premium');

/** TechMood Premium (design lab 4: «مثل Telegram Premium»): what it gives, the two plans, and where I stand. */
export default async function PremiumPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: offerRows }, { data: balanceRaw }] = await Promise.all([
    supabase.rpc('premium_offer'),
    supabase.rpc('my_credit_balance'),
  ]);
  const offer = offerRows?.[0];
  const until = offer?.my_until ? new Date(offer.my_until) : null;
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'long' });

  const perks = [
    { icon: '✦', title: t('شارة موثّقة', 'A verified badge'), body: t('نجمة Premium بجانب اسمك في ملفك وفي قوائم السوق.', 'The Premium star next to your name on your profile and in market lists.') },
    { icon: '🤖', title: t('مساعد ذكي أكثر', 'More of the assistant'), body: t(`${offer?.ai_daily_premium ?? 150} سؤالاً في اليوم بدل ${offer?.ai_daily ?? 40}.`, `${offer?.ai_daily_premium ?? 150} questions a day instead of ${offer?.ai_daily ?? 40}.`) },
    { icon: '⭐', title: t('ملف مميّز وأولوية', 'Featured, first'), body: t('تظهر أولاً بين الكفاءات في السوق، وبين الأشخاص المقترحين للمتابعة.', 'You appear first among the talent in the market, and among people suggested to follow.') },
    { icon: '🚫', title: t('بلا إعلانات', 'No ads'), body: t('تختفي كل المساحات الترويجية — مثل زر «احجز جلسة» العائم — وأي إعلان يُضاف مستقبلاً لا يظهر لك.', 'Every promotional spot disappears — like the floating «Book a session» button — and no ad added later is shown to you.') },
  ];

  return (
    <>
      <section className="premium-hero section-block">
        <span className="premium-hero-mark" aria-hidden>✦</span>
        <h2>TechMood Premium</h2>
        <p>{t('ادعم TechMood واحصل على مزايا إضافية — بدون إعلانات.', 'Support TechMood and get more — with no ads.')}</p>
        {until && <p className="premium-status"><PremiumBadge /> {t(`أنت عضو حتى ${date.format(until)}`, `You are a member until ${date.format(until)}`)}</p>}
      </section>

      <ul className="premium-perks section-block">
        {perks.map((perk) => (
          <li key={perk.title}>
            <span aria-hidden>{perk.icon}</span>
            <div><strong>{perk.title}</strong><p className="muted">{perk.body}</p></div>
          </li>
        ))}
      </ul>

      <section className="panel section-block">
        <SubscribeForm monthly={Number(offer?.monthly_usd ?? 5)} yearly={Number(offer?.yearly_usd ?? 48)}
                       balance={Number(balanceRaw ?? 0)} member={Boolean(until)} />
      </section>
    </>
  );
}
