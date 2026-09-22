import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { ORG_KIND, STARTUP_STAGES } from '@/lib/incubator';

import { StartupNav } from './StartupNav';
import { ApplyPanel } from './ApplyPanel';

export default async function StartupOverviewPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase.from('startups').select('*').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: overview }, , { data: progress }, { data: cards }, { data: goals }, { data: history }, { data: application }] =
    await Promise.all([
      supabase.rpc('startup_overview', { p_startup: startupId }),
      supabase.rpc('can_edit_startup', { p_startup: startupId }),
      supabase.from('business_plan_progress').select('*').eq('startup_id', startupId).maybeSingle(),
      supabase.from('canvas_cards').select('id').eq('startup_id', startupId),
      supabase.from('smart_goals').select('id, status').eq('startup_id', startupId),
      supabase.from('startup_stage_history').select('stage, changed_at').eq('startup_id', startupId).order('changed_at', { ascending: false }).limit(6),
      supabase
        .from('incubator_applications')
        .select('id, status, pitch_ar, review_note, created_at')
        .eq('startup_id', startupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const stageIndex = STARTUP_STAGES.findIndex((stage) => stage.key === startup.stage);
  const isFounder = startup.founder_id === user.id;
  const numbers = overview?.[0];

  return (
    <>
      <section className="panel section-block">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{startup.name_ar}</h2>
            {startup.one_liner_ar && (
              <p className="muted" style={{ fontSize: '0.92rem', marginTop: 6 }}>{startup.one_liner_ar}</p>
            )}
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
              {t(ORG_KIND[startup.kind])}
              {startup.industry_ar ? ` · ${startup.industry_ar}` : ''}
              {startup.location_ar ? ` · ${startup.location_ar}` : ''}
            </p>
          </div>
          <div className="tags-row">
            {startup.is_in_incubator && <span className="badge-pill">{t('في الحاضنة', 'In the incubator')}</span>}
            <span className={`status-pill ${startup.is_public ? 'status-ok' : 'status-muted'}`}>
              {startup.is_public ? t('معروض', 'Listed') : t('خاص', 'Private')}
            </span>
          </div>
        </div>

        {startup.problem_ar && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: '0.8rem' }}>{t('المشكلة', 'The problem')}</p>
            <p style={{ fontSize: '0.89rem' }}>{startup.problem_ar}</p>
          </div>
        )}

        {startup.solution_ar && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: '0.8rem' }}>{t('الحل', 'The solution')}</p>
            <p style={{ fontSize: '0.89rem' }}>{startup.solution_ar}</p>
          </div>
        )}
      </section>

      <StartupNav startupId={startupId} />

      <section className="section-block">
        <div className="row-between">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('مرحلة المشروع', 'Stage')}</h3>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/incubation`}>
            {t('رحلة الاحتضان', 'The journey')}
          </Link>
        </div>
        <div className="roadmap-stages">
          {STARTUP_STAGES.map((stage, index) => (
            <div
              key={stage.key}
              className={`stage-step${index < stageIndex ? ' done' : index === stageIndex ? ' current' : ''}`}
            >
              <strong>{t(stage.label)}</strong>
              <span>{t(stage.hint)}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
          {t('لا تُرفع المرحلة بزر: كل مرحلة تطلب عملاً تراه المنصة، ويُقرأ الإنجاز من ذلك العمل.',
             'A stage is not raised by a button: each one asks for work the platform can see, and progress is read off that work.')}
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{numbers?.stage_met ?? 0}/{numbers?.stage_required ?? 0}</div>
            <div className="lbl">{t('متطلبات المرحلة', 'Stage requirements')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.plan_percent ?? progress?.percent ?? 0}%</div>
            <div className="lbl">{t('خطة العمل', 'Business plan')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.canvas_cards ?? cards?.length ?? 0}</div>
            <div className="lbl">{t('بطاقات على اللوحات', 'Cards on the canvases')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.goals_achieved ?? 0}/{numbers?.goals ?? goals?.length ?? 0}</div>
            <div className="lbl">{t('أهداف تحققت', 'Goals achieved')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.projects_done ?? 0}/{numbers?.projects ?? 0}</div>
            <div className="lbl">{t('مشاريع مكتملة', 'Projects finished')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.members ?? 0}</div>
            <div className="lbl">{t('أعضاء المساحة', 'People in the room')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.open_positions ?? 0}</div>
            <div className="lbl">{t('فرص مفتوحة', 'Open positions')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{numbers?.documents ?? 0}</div>
            <div className="lbl">{t('مستندات', 'Documents')}</div>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <section>
          {isFounder && (
            <ApplyPanel
              startupId={startupId}
              isInIncubator={startup.is_in_incubator}
              application={application ?? null}
              canvasCards={cards?.length ?? 0}
            />
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('سجل المراحل', 'Stage history')}</h3>
          {(history?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا سجل بعد.', 'Nothing recorded yet.')}</p>
          ) : (
            <ul className="timeline">
              {history!.map((entry, index) => (
                <li key={`${entry.stage}-${entry.changed_at}`} className={index === 0 ? 'current' : 'done'}>
                  <span className="tl-dot" />
                  <span className="tl-label">
                    {(() => {
                      const found = STARTUP_STAGES.find((option) => option.key === entry.stage);
                      return found ? t(found.label) : entry.stage;
                    })()}
                    <br />
                    <span className="muted eng" style={{ fontSize: '0.74rem' }}>
                      {new Date(entry.changed_at).toLocaleDateString('ar-EG')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} href="/incubator">
            {t('الحاضنة', 'Incubator')}
          </Link>
        </aside>
      </div>
    </>
  );
}
