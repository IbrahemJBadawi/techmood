import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { NewOpportunityForm } from './NewOpportunityForm';

export default async function NewOpportunityPage() {
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
        <Link className="btn btn-ghost btn-sm" href="/marketplace">→ رجوع للسوق</Link>
        <p className="notice" style={{ marginTop: 16 }}>
          نشر الفرص يحتاج دوراً معتمداً: شركة، مؤسس، قائد فريق، أو فريلانسر. اطلب الدور من صفحة
          الجواز المهني — دور الطالب وحده يتيح لك التقدّم على الفرص لا نشرها.
        </p>
      </>
    );
  }

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/marketplace">→ رجوع للسوق</Link>

      <section className="section-block" style={{ marginTop: 16, maxWidth: 680 }}>
        <h2 style={{ fontSize: '1.2rem' }}>انشر فرصة</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          المتطلبات التي تحددها إرشادية: تظهر للمتقدّم كمقارنة مع سجله، ولا تمنعه من التقدّم.
          القرار يبقى لك.
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
