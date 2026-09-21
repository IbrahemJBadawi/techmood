import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { NewOpportunityForm } from './NewOpportunityForm';

export default async function NewOpportunityPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: canPost }, { data: teams }, { data: paths }] = await Promise.all([
    supabase.rpc('can_post_opportunity', { p_kind: 'freelance', p_team: null }),
    supabase.from('teams').select('id, title_ar').eq('leader_id', user.id),
    supabase.from('learning_paths').select('id, title_ar').eq('status', 'published').order('sort_order'),
  ]);

  if (canPost !== true && (teams?.length ?? 0) === 0) {
    return (
      <>
        <Link className="btn btn-ghost btn-sm" href="/marketplace">{t('→ رجوع للسوق', '← Back to work')}</Link>
        <p className="notice" style={{ marginTop: 16 }}>
          {t('نشر الفرص يحتاج دوراً معتمداً: شركة، مؤسس، قائد فريق، أو فريلانسر. اطلب الدور من صفحة الجواز المهني — دور الطالب وحده يتيح لك التقدّم على الفرص لا نشرها.',
             'Posting needs an approved role: organisation, founder, team lead or freelancer. Ask for one from your passport — the student role lets you apply to openings, not publish them.')}
        </p>
      </>
    );
  }

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/marketplace">{t('→ رجوع للسوق', '← Back to work')}</Link>

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
        paths={paths ?? []}
      />
    </>
  );
}
