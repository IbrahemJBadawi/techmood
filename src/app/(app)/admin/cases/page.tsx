import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { CASE_STATUS } from '@/lib/cases';
import { TICKET_PRIORITY } from '@/lib/support';

export const generateMetadata = localizedTitle('القضايا — إدارة TechMood', 'Cases — TechMood admin');

export default async function AdminCasesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: raw } = await searchParams;
  const filter = raw === 'closed' || raw === 'all' ? raw : 'open';
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: cases } = await supabase.rpc('admin_cases', { p_filter: filter });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('القضايا', 'Cases')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('القضية تجمع البلاغات والأشخاص والعمليات والأدلة والملاحظات والقرار في مكان واحد. تُفتح من صفحة البلاغ.',
             'A case gathers the tickets, people, operations, evidence, notes and the decision in one place. Open one from a ticket.')}
        </p>
      </section>
      <div className="tags-row section-block">
        {(['open', 'closed', 'all'] as const).map((key) => (
          <Link key={key} className={`chip${key === filter ? ' is-active' : ''}`} href={`/admin/cases?filter=${key}`}>
            {key === 'open' ? t('مفتوحة', 'Open') : key === 'closed' ? t('مغلقة', 'Closed') : t('الكل', 'All')}
          </Link>
        ))}
      </div>
      {(cases ?? []).length === 0 ? (
        <p className="notice">{t('لا قضايا هنا.', 'No cases here.')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr><th>{t('القضية', 'Case')}</th><th>{t('الأطراف', 'People')}</th><th>{t('الأولوية', 'Priority')}</th><th>{t('الحالة', 'Status')}</th></tr>
          </thead>
          <tbody>
            {cases!.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/cases/${row.id}`}><span className="eng">#{row.code}</span></Link>
                  <div style={{ fontSize: '0.82rem' }}>{row.title_ar}</div>
                </td>
                <td style={{ fontSize: '0.82rem' }}>{row.reporter_name ?? '—'} → {row.reported_name ?? '—'}<div className="muted">{t(`${row.tickets} بلاغ`, `${row.tickets} tickets`)}</div></td>
                <td><span className={`status-pill ${TICKET_PRIORITY[row.priority].className}`}>{t(TICKET_PRIORITY[row.priority].label)}</span></td>
                <td><span className={`status-pill ${CASE_STATUS[row.status].className}`}>{t(CASE_STATUS[row.status].label)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
