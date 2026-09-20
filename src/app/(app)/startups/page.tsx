import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { STARTUP_STAGES } from '@/lib/incubator';

export default async function StartupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('startup_members')
    .select('startup_id, role')
    .eq('profile_id', user.id);

  const ids = (memberships ?? []).map((row) => row.startup_id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: startups }, { data: progress }, { data: cardCounts }] = await Promise.all([
    supabase.from('startups').select('*').in('id', ids.length ? ids : placeholder),
    supabase.from('business_plan_progress').select('startup_id, percent').in('startup_id', ids.length ? ids : placeholder),
    supabase.from('canvas_cards').select('startup_id').in('startup_id', ids.length ? ids : placeholder),
  ]);

  const percentById = new Map((progress ?? []).map((row) => [row.startup_id, row.percent]));
  const cardsById = new Map<string, number>();
  for (const row of cardCounts ?? []) {
    cardsById.set(row.startup_id, (cardsById.get(row.startup_id) ?? 0) + 1);
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>مشاريعي الناشئة</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              نموذج العمل وخطة العمل والاستراتيجية — مساحة عملك الخاصة حتى تقرّر أنت غير ذلك.
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/startups/new">+ مشروع جديد</Link>
        </div>
      </section>

      {(startups?.length ?? 0) === 0 ? (
        <p className="notice">
          لا مشاريع بعد. ابدأ بفكرة، واملأ نموذج العمل، ثم قدّم للحاضنة حين تكون جاهزاً.
        </p>
      ) : (
        <div className="card-grid">
          {startups!.map((startup) => {
            const stageIndex = STARTUP_STAGES.findIndex((stage) => stage.key === startup.stage);
            const stagePercent = Math.round(((stageIndex + 1) / STARTUP_STAGES.length) * 100);

            return (
              <article className="card" key={startup.id}>
                <div className="row-between">
                  <span className="tag">{STARTUP_STAGES[stageIndex]?.label ?? startup.stage}</span>
                  {startup.is_in_incubator && <span className="badge-pill">في الحاضنة</span>}
                </div>

                <h3>{startup.name_ar}</h3>
                {startup.one_liner_ar && <p>{startup.one_liner_ar}</p>}

                <div className="progress-track"><div className="progress-fill" style={{ width: `${stagePercent}%` }} /></div>

                <div className="row-between" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                  <span className="eng">نموذج العمل: {cardsById.get(startup.id) ?? 0} بطاقة</span>
                  <span className="eng">خطة العمل: {percentById.get(startup.id) ?? 0}%</span>
                </div>

                <Link className="btn btn-ghost btn-sm" href={`/startups/${startup.id}`}>افتح المشروع</Link>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
