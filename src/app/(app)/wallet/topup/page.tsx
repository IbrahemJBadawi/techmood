import { redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { TopupForm } from './TopupForm';

export const generateMetadata = localizedTitle('اشحن رصيدك — TechMood', 'Top up — TechMood');

export default async function TopupPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // the transfer methods a member may pay by, the same as for sessions
  const { data: methods } = await supabase.from('payment_methods')
    .select('key, name_ar, name_en, icon, use_for').eq('is_enabled', true).order('sort_order');
  const usable = (methods ?? []).filter((m) => (m.use_for as string[]).includes('mentoring'));

  return (
    <>
      <BackLink href="/wallet" label={t('المحفظة', 'Wallet')} />
      <h2 className="section-block" style={{ fontSize: '1.2rem' }}>{t('اشحن رصيدك', 'Top up your balance')}</h2>
      {usable.length === 0
        ? <p className="notice">{t('لا توجد طريقة تحويل متاحة الآن.', 'No transfer method is available right now.')}</p>
        : <TopupForm methods={usable} />}
    </>
  );
}
