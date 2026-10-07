import { redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { TopupForm, type Purchase } from './TopupForm';

export const generateMetadata = localizedTitle('اشحن رصيدك — TechMood', 'Top up — TechMood');

type Search = { for?: string; plan?: string; mentor?: string; type?: string; sessions?: string };

/**
 * A plain top-up, or — from the Premium page or a mentor's packages — paying
 * for one of them by transfer (0155): the same transfer and receipt, for
 * exactly its price.
 */
export default async function TopupPage({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getT();
  const search = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // the transfer methods a member may pay by, the same as for sessions
  const { data: methods } = await supabase.from('payment_methods')
    .select('key, name_ar, name_en, icon, use_for').eq('is_enabled', true).order('sort_order');
  const usable = (methods ?? []).filter((m) => (m.use_for as string[]).includes('mentoring'));

  let purchase: Purchase | undefined;
  if (search.for === 'premium') {
    const plan = search.plan === 'month' ? 'month' : 'year';
    const { data: offer } = await supabase.rpc('premium_offer');
    const row = offer?.[0];
    if (row) {
      purchase = {
        label: plan === 'month' ? t('TechMood Premium — شهر', 'TechMood Premium — a month') : t('TechMood Premium — سنة', 'TechMood Premium — a year'),
        amount: Number(plan === 'month' ? row.monthly_usd : row.yearly_usd),
        fields: { purpose: 'premium', plan },
      };
    }
  } else if (search.for === 'package' && search.mentor && search.type) {
    const sessions = Number(search.sessions) === 3 ? 3 : 5;
    const [{ data: quote }, { data: mentor }, { data: kind }] = await Promise.all([
      supabase.rpc('package_quote', { p_mentor: search.mentor, p_session_type: search.type }),
      supabase.from('profiles').select('full_name').eq('id', search.mentor).maybeSingle(),
      supabase.from('session_types').select('name_ar, name_en').eq('id', search.type).maybeSingle(),
    ]);
    const tier = (quote ?? []).find((row) => row.sessions === sessions);
    if (tier) {
      purchase = {
        label: t(`باقة ${sessions} جلسات${kind ? ` (${kind.name_ar})` : ''} مع ${mentor?.full_name ?? 'المنتور'}`,
                 `${sessions} sessions${kind ? ` (${kind.name_en})` : ''} with ${mentor?.full_name ?? 'the mentor'}`),
        amount: Number(tier.total_usd),
        fields: { purpose: 'package', mentor_id: search.mentor, session_type_id: search.type, sessions: String(sessions) },
      };
    }
  }

  const back = search.for === 'premium' ? { href: '/premium', label: 'Premium' }
    : search.for === 'package' && search.mentor ? { href: `/mentors/${search.mentor}`, label: t('المنتور', 'The mentor') }
    : { href: '/wallet', label: t('المحفظة', 'Wallet') };

  return (
    <>
      <BackLink href={back.href} label={back.label} />
      <h2 className="section-block" style={{ fontSize: '1.2rem' }}>
        {purchase ? t('ادفع بتحويل', 'Pay by transfer') : t('اشحن رصيدك', 'Top up your balance')}
      </h2>
      {usable.length === 0
        ? <p className="notice">{t('لا توجد طريقة تحويل متاحة الآن.', 'No transfer method is available right now.')}</p>
        : <TopupForm methods={usable} purchase={purchase} />}
    </>
  );
}
