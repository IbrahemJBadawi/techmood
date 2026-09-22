import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { ListingForm, type Listing, type Service } from './ListingForm';

export const metadata = { title: 'Market listing — TechMood' };

export default async function FreelancerSettingsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: listing }, { data: services }, { data: role }] = await Promise.all([
    supabase.from('freelancer_profiles')
      .select('is_available, headline_ar, summary_ar, rate_kind, rate_min_usd, rate_max_usd')
      .eq('profile_id', user.id).maybeSingle(),
    supabase.from('freelancer_services')
      .select('id, title_ar, detail_ar, from_usd')
      .eq('profile_id', user.id).order('sort_order'),
    supabase.from('profile_roles')
      .select('status').eq('profile_id', user.id).eq('role', 'freelancer').maybeSingle(),
  ]);

  const approved = role?.status === 'approved';

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('إدراجك في السوق', 'Your market listing')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('السوق لا يصنع لك ملفاً ثانياً — يقرأ هويتك المهنية الواحدة في TechMood. هنا تقرّر فقط أن تكون ظاهراً فيه.',
             'The market does not give you a second profile — it reads your one professional identity on TechMood. Here you only decide to be visible in it.')}
        </p>
      </section>

      {!approved && (
        <p className="notice">
          {t('الإدراج في السوق يحتاج دور «فريلانسر» بعد المراجعة. ', 'Listing yourself needs the freelancer role, after review. ')}
          <Link href="/settings/roles">{t('اطلب الدور من هنا', 'Request it here')}</Link>
        </p>
      )}

      <ListingForm listing={(listing ?? null) as Listing} services={(services ?? []) as Service[]} />
    </>
  );
}
