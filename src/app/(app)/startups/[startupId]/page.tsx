import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { STARTUP_STAGES } from '@/lib/incubator';

import { StartupNav } from './StartupNav';
import { ApplyPanel } from './ApplyPanel';
import { setStartupStage } from '../actions';

export default async function StartupOverviewPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase.from('startups').select('*').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: canEdit }, { data: progress }, { data: cards }, { data: goals }, { data: history }, { data: application }] =
    await Promise.all([
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

  return (
    <>
      <section className="panel section-block">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{startup.name_ar}</h2>
            {startup.one_liner_ar && (
              <p className="muted" style={{ fontSize: '0.92rem', marginTop: 6 }}>{startup.one_liner_ar}</p>
            )}
          </div>
          <div className="tags-row">
            {startup.is_in_incubator && <span className="badge-pill">في الحاضنة</span>}
            <span className={`status-pill ${startup.is_public ? 'status-ok' : 'status-muted'}`}>
              {startup.is_public ? 'معروض' : 'خاص'}
            </span>
          </div>
        </div>

        {startup.problem_ar && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: '0.8rem' }}>المشكلة</p>
            <p style={{ fontSize: '0.89rem' }}>{startup.problem_ar}</p>
          </div>
        )}

        {startup.solution_ar && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: '0.8rem' }}>الحل</p>
            <p style={{ fontSize: '0.89rem' }}>{startup.solution_ar}</p>
          </div>
        )}
      </section>

      <StartupNav startupId={startupId} />

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>مرحلة المشروع</h3>
        <div className="roadmap-stages">
          {STARTUP_STAGES.map((stage, index) => (
            <div
              key={stage.key}
              className={`stage-step${index < stageIndex ? ' done' : index === stageIndex ? ' current' : ''}`}
            >
              <strong>{stage.label}</strong>
              <span>{stage.hint}</span>
              {canEdit === true && index !== stageIndex && (
                <form action={setStartupStage}>
                  <input type="hidden" name="startup_id" value={startupId} />
                  <input type="hidden" name="stage" value={stage.key} />
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem', marginTop: 6 }}>
                    انقل هنا
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{cards?.length ?? 0}</div>
            <div className="lbl">بطاقات نموذج العمل</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{progress?.percent ?? 0}%</div>
            <div className="lbl">خطة العمل</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{goals?.length ?? 0}</div>
            <div className="lbl">أهداف SMART</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{startup.users_count}</div>
            <div className="lbl">مستخدمون</div>
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
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>سجل المراحل</h3>
          {(history?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>لا سجل بعد.</p>
          ) : (
            <ul className="timeline">
              {history!.map((entry, index) => (
                <li key={`${entry.stage}-${entry.changed_at}`} className={index === 0 ? 'current' : 'done'}>
                  <span className="tl-dot" />
                  <span className="tl-label">
                    {STARTUP_STAGES.find((stage) => stage.key === entry.stage)?.label ?? entry.stage}
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
            الحاضنة
          </Link>
        </aside>
      </div>
    </>
  );
}
