import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { APPLICATION_STAGE, OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';
import { Opportunity } from '@/lib/database.types';

export default async function MyApplicationsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: applications } = await supabase
    .from('opportunity_applications')
    .select('id, opportunity_id, stage, cover_note_ar, decision_note_ar, created_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });

  const ids = (applications ?? []).map((row) => row.opportunity_id);

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const byId = new Map((opportunities ?? []).map((row) => [row.id, row as Opportunity]));
  const open = (applications ?? []).filter((row) => row.stage === 'submitted' || row.stage === 'shortlisted');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{t('طلباتي', 'My applications')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              {t(`${open.length} طلب قيد النظر من أصل ${applications?.length ?? 0}.`,
                 `${open.length} of ${applications?.length ?? 0} still under consideration.`)}
            </p>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/marketplace">{t('تصفّح السوق', 'Browse work')}</Link>
        </div>
      </section>

      {(applications?.length ?? 0) === 0 ? (
        <p className="notice">{t('لم تقدّم على أي فرصة بعد.', 'You have not applied to anything yet.')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr><th>{t('الفرصة', 'Opening')}</th><th>{t('النوع', 'Kind')}</th><th>{t('الأجر', 'Pay')}</th><th>{t('الحالة', 'Status')}</th><th>{t('التاريخ', 'Date')}</th><th></th></tr>
          </thead>
          <tbody>
            {applications!.map((application) => {
              const opportunity = byId.get(application.opportunity_id);
              const stage = APPLICATION_STAGE[application.stage];

              return (
                <tr key={application.id}>
                  <td>
                    {opportunity?.title_ar ?? '—'}
                    {application.decision_note_ar && (
                      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                        {application.decision_note_ar}
                      </p>
                    )}
                  </td>
                  <td>{opportunity ? t(OPPORTUNITY_KIND[opportunity.kind].label) : '—'}</td>
                  <td className="eng">{opportunity ? compensationLabel(t.locale, opportunity) : '—'}</td>
                  <td><span className={`status-pill ${stage.className}`}>{t(stage.text)}</span></td>
                  <td className="eng">{new Date(application.created_at).toLocaleDateString('ar-EG')}</td>
                  <td>
                    {opportunity && (
                      <Link className="btn btn-ghost btn-sm" href={`/marketplace/${opportunity.id}`}>{t('عرض', 'View')}</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
