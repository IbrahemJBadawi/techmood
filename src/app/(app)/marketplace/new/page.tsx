import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { NewOpportunityForm } from './NewOpportunityForm';
import { BackLink } from '@/components/BackLink';

export const generateMetadata = localizedTitle('فرصة جديدة — TechMood', 'New opportunity — TechMood');

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ startup?: string }>;
}) {
  const { startup } = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: canPost }, { data: teams }, { data: paths }, { data: memberships }, { data: accessRows }] = await Promise.all([
    supabase.rpc('can_post_opportunity', { p_kind: 'freelance', p_team: null }),
    supabase.from('teams').select('id, title_ar').eq('leader_id', user.id),
    supabase.from('learning_paths').select('id, title_ar').eq('status', 'published').order('sort_order'),
    // The companies this person actually runs — hiring belongs to them.
    supabase.from('startup_members')
      .select('startup_id, role, startups(id, name_ar)')
      .eq('profile_id', user.id)
      .in('role', ['founder', 'cofounder', 'manager']),
    supabase.rpc('business_access'),
  ]);
  const access = accessRows?.[0];

  const companies = (memberships ?? [])
    .map((row) => row.startups as unknown as { id: string; name_ar: string } | null)
    .filter(Boolean) as { id: string; name_ar: string }[];

  if (canPost !== true && (teams?.length ?? 0) === 0 && companies.length === 0) {
    return (
      <>
        <BackLink href="/marketplace" label={t('رجوع للسوق', 'Back to work')} />
        <section className="panel section-block business-gate" style={{ marginTop: 16 }}>
          <h3>💼 {t('النشر في TechMood Business', 'Publishing on TechMood Business')}</h3>
          <p className="muted">{t('نشر الوظائف ومشاريع العمل الحر لمشتركي Premium الذين يحملون دور فريلانسر أو عميل أو شركة (أو منتور). التقدّم على الفرص مفتوح لكل عضو.',
                                  'Publishing jobs and freelance projects is for Premium members with a freelancer, client or company role (or mentors). Applying stays open to every member.')}</p>
          <ul className="business-gate-list">
            <li className={access?.premium ? 'is-ok' : ''}>{access?.premium ? '✓' : '✦'} {t('اشتراك Premium', 'A Premium membership')}
              {!access?.premium && <> — <a href="/premium">{t('اشترك', 'Subscribe')}</a></>}</li>
            <li className={access?.freelancer || access?.company_status === 'approved' ? 'is-ok' : ''}>
              {access?.freelancer || access?.company_status === 'approved' ? '✓' : '•'} {t('دور فريلانسر أو عميل أو شركة', 'A freelancer, client or company role')}
              {access?.company_status === 'pending_review' && <> — {t('حساب الشركة قيد التوثيق', 'company account being verified')}</>}
              {!access?.freelancer && access?.company_status !== 'approved' && <> — <a href="/settings/roles">{t('اختر دورك', 'Choose your role')}</a></>}
            </li>
          </ul>
        </section>
      </>
    );
  }

  return (
    <>
      <BackLink href="/marketplace" label={t('رجوع للسوق', 'Back to work')} />

      <section className="section-block" style={{ marginTop: 16, maxWidth: 680 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('انشر فرصة', 'Post an opening')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('المتطلبات التي تحددها إرشادية: تظهر للمتقدّم كمقارنة مع سجله، ولا تمنعه من التقدّم. القرار يبقى لك.',
             'The requirements you set are advisory: an applicant sees them next to their own record, and is never blocked by them. The decision stays yours.')}
        </p>
      </section>

      <NewOpportunityForm
        canPostGeneral={canPost === true}
        teams={teams ?? []}
        companies={companies}
        defaultCompany={startup}
        paths={paths ?? []}
      />
    </>
  );
}
