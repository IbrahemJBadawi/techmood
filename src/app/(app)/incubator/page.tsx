import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { STARTUP_STAGES } from '@/lib/incubator';

export default async function IncubatorPage() {
  const supabase = await createClient();

  const { data: startups } = await supabase
    .from('startups')
    .select('id, name_ar, one_liner_ar, stage, users_count, is_in_incubator, founder_id')
    .eq('is_public', true)
    .order('is_in_incubator', { ascending: false });

  const founderIds = [...new Set((startups ?? []).map((row) => row.founder_id))];
  const { data: founders } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', founderIds.length ? founderIds : ['00000000-0000-0000-0000-000000000000']);

  const founderById = new Map((founders ?? []).map((row) => [row.id, row.full_name]));
  const inIncubator = (startups ?? []).filter((row) => row.is_in_incubator);

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>الحاضنة</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              المشاريع ذات الإمكانات تنتقل من فكرة إلى شركة ناشئة بدعم مرشدين وخبراء.
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/startups/new">+ مشروعك</Link>
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>مراحل الرحلة</h3>
        <div className="roadmap-stages">
          {STARTUP_STAGES.map((stage) => (
            <div className="stage-step" key={stage.key}>
              <strong>{stage.label}</strong>
              <span>{stage.hint}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
          مشاريع في الحاضنة ({inIncubator.length})
        </h3>

        {(startups?.length ?? 0) === 0 ? (
          <p className="notice">لا مشاريع معروضة بعد.</p>
        ) : (
          <div className="card-grid">
            {startups!.map((startup) => (
              <article className="card" key={startup.id}>
                <div className="row-between">
                  <span className="tag">
                    {STARTUP_STAGES.find((stage) => stage.key === startup.stage)?.label ?? startup.stage}
                  </span>
                  {startup.is_in_incubator && <span className="badge-pill">في الحاضنة</span>}
                </div>

                <h3>{startup.name_ar}</h3>
                {startup.one_liner_ar && <p>{startup.one_liner_ar}</p>}

                <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  <span>المؤسس: {founderById.get(startup.founder_id) ?? '—'}</span>
                  <span className="eng">{startup.users_count} users</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>ماذا تقدّم لك الحاضنة؟</h3>
        <div className="card-grid">
          <div className="card"><h3>مرشدون متخصصون</h3><p>في كل مرحلة من مراحل بناء المشروع.</p></div>
          <div className="card"><h3>مراجعة نموذج العمل</h3><p>جلسات على نموذج عملك وخطتك وأهدافك، لا نصائح عامة.</p></div>
          <div className="card"><h3>شبكة شركاء</h3><p>فرص عرض الفكرة أمام مستثمرين محتملين.</p></div>
        </div>
      </section>
    </>
  );
}
