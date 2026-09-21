import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { STARTUP_STAGES } from '@/lib/incubator';

export default async function IncubatorPage() {
  const t = await getT();
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
            <h2 style={{ fontSize: '1.2rem' }}>{t('الحاضنة', 'Incubator')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              {t('المشاريع ذات الإمكانات تنتقل من فكرة إلى شركة ناشئة بدعم مرشدين وخبراء.', 'Promising projects go from an idea to a startup, with mentors and experts alongside.')}
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/startups/new">{t('+ مشروعك', '+ Your startup')}</Link>
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('مراحل الرحلة', 'The stages')}</h3>
        <div className="roadmap-stages">
          {STARTUP_STAGES.map((stage) => (
            <div className="stage-step" key={stage.key}>
              <strong>{t(stage.label)}</strong>
              <span>{t(stage.hint)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
          {t('مشاريع في الحاضنة', 'In the incubator')} ({inIncubator.length})
        </h3>

        {(startups?.length ?? 0) === 0 ? (
          <p className="notice">{t('لا مشاريع معروضة بعد.', 'Nothing on show yet.')}</p>
        ) : (
          <div className="card-grid">
            {startups!.map((startup) => (
              <article className="card" key={startup.id}>
                <div className="row-between">
                  <span className="tag">
                    {(() => {
                      const stage = STARTUP_STAGES.find((entry) => entry.key === startup.stage);
                      return stage ? t(stage.label) : startup.stage;
                    })()}
                  </span>
                  {startup.is_in_incubator && <span className="badge-pill">{t('في الحاضنة', 'In the incubator')}</span>}
                </div>

                <h3>{startup.name_ar}</h3>
                {startup.one_liner_ar && <p>{startup.one_liner_ar}</p>}

                <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  <span>{t('المؤسس: ', 'Founder: ')}{founderById.get(startup.founder_id) ?? '—'}</span>
                  <span className="eng">{startup.users_count} users</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('ماذا تقدّم لك الحاضنة؟', 'What the incubator gives you')}</h3>
        <div className="card-grid">
          <div className="card"><h3>{t('مرشدون متخصصون', 'Specialist mentors')}</h3><p>{t('في كل مرحلة من مراحل بناء المشروع.', 'At every stage of building the thing.')}</p></div>
          <div className="card"><h3>{t('مراجعة نموذج العمل', 'Business-model review')}</h3><p>{t('جلسات على نموذج عملك وخطتك وأهدافك، لا نصائح عامة.', 'Sessions on your model, your plan and your goals — not general advice.')}</p></div>
          <div className="card"><h3>{t('شبكة شركاء', 'A network')}</h3><p>{t('فرص عرض الفكرة أمام مستثمرين محتملين.', 'Chances to put the idea in front of possible investors.')}</p></div>
        </div>
      </section>
    </>
  );
}
