import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { STARTUP_STAGES } from '@/lib/incubator';

import { reviewApplication } from './actions';

export default async function AdminIncubatorPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const { data: applications } = await supabase
    .from('incubator_applications')
    .select('id, startup_id, pitch_ar, status, review_note, stage_at_application, plan_percent_at_application, created_at')
    .order('created_at', { ascending: true });

  const startupIds = [...new Set((applications ?? []).map((row) => row.startup_id))];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const { data: startups } = await supabase
    .from('startups')
    .select('id, name_ar, one_liner_ar, founder_id, problem_ar, solution_ar')
    .in('id', startupIds.length ? startupIds : placeholder);

  const founderIds = [...new Set((startups ?? []).map((row) => row.founder_id))];
  const { data: founders } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id')
    .in('id', founderIds.length ? founderIds : placeholder);

  const startupById = new Map((startups ?? []).map((row) => [row.id, row]));
  const founderById = new Map((founders ?? []).map((row) => [row.id, row]));

  const waiting = (applications ?? []).filter((row) => row.status === 'pending_review');
  const settled = (applications ?? []).filter((row) => row.status !== 'pending_review');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('طلبات الحاضنة', 'Incubator applications')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/incubator">{t('الحاضنة', 'Incubator')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('كل طلب يحمل المرحلة ونسبة اكتمال خطة العمل وقت التقديم — حتى تُقارن الطلبات بما كان فعلاً، لا بما صار بعدها.',
             'Every application carries the stage and the business-plan completion as they stood when it was sent — so applications are compared on what was actually true then, not on what happened afterwards.')}
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('بانتظار المراجعة', 'Awaiting review')} ({waiting.length})</h3>

        {waiting.length === 0 ? (
          <p className="notice">{t('لا طلبات بانتظار المراجعة 🎉', 'No applications waiting 🎉')}</p>
        ) : (
          waiting.map((application) => {
            const startup = startupById.get(application.startup_id);
            const founder = founderById.get(startup?.founder_id ?? '');

            return (
              <article className="panel section-block" key={application.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{startup?.name_ar}</h3>
                    <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
                      {founder?.full_name} <span className="id-chip">{founder?.techmood_id}</span>
                    </p>
                  </div>
                  <div className="tags-row">
                    <span className="badge-pill">
                      {(() => {
                        const stage = STARTUP_STAGES.find((s) => s.key === application.stage_at_application);
                        return stage ? t(stage.label) : '—';
                      })()}
                    </span>
                    <span className="badge-pill eng">{t(`خطة ${application.plan_percent_at_application ?? 0}%`, `Plan ${application.plan_percent_at_application ?? 0}%`)}</span>
                  </div>
                </div>

                {startup?.one_liner_ar && (
                  <p style={{ fontSize: '0.89rem', marginTop: 12 }}>{startup.one_liner_ar}</p>
                )}

                {startup?.problem_ar && (
                  <div style={{ marginTop: 12 }}>
                    <p className="muted" style={{ fontSize: '0.78rem' }}>{t('المشكلة', 'The problem')}</p>
                    <p style={{ fontSize: '0.86rem' }}>{startup.problem_ar}</p>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <p className="muted" style={{ fontSize: '0.78rem' }}>{t('طلبه', 'What they are asking for')}</p>
                  <p style={{ fontSize: '0.88rem' }}>{application.pitch_ar}</p>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <form action={reviewApplication}>
                    <input type="hidden" name="application_id" value={application.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn btn-primary btn-sm">{t('اقبل في الحاضنة', 'Accept into the incubator')}</button>
                  </form>
                  <form action={reviewApplication} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                    <input type="hidden" name="application_id" value={application.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="note" required placeholder={t('سبب الرفض — يظهر للمؤسس', 'Why — the founder will see this')} style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-ghost btn-sm">{t('رفض', 'Reject')}</button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('سجلّ الطلبات', 'Application history')}</h3>
          <table className="data">
            <thead><tr><th>{t('المشروع', 'Startup')}</th><th>{t('المرحلة وقت التقديم', 'Stage when applied')}</th><th>{t('الحالة', 'Status')}</th><th>{t('ملاحظة', 'Note')}</th></tr></thead>
            <tbody>
              {settled.map((application) => (
                <tr key={application.id}>
                  <td>{startupById.get(application.startup_id)?.name_ar}</td>
                  <td>
                    {(() => {
                      const stage = STARTUP_STAGES.find((s) => s.key === application.stage_at_application);
                      return stage ? t(stage.label) : '—';
                    })()}
                  </td>
                  <td>
                    <span className={`status-pill ${application.status === 'approved' ? 'status-ok' : 'status-danger'}`}>
                      {application.status === 'approved' ? t('مقبول', 'Accepted') : t('مرفوض', 'Rejected')}
                    </span>
                  </td>
                  <td>{application.review_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
