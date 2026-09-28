import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { ESCALATION, TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/support';

export const generateMetadata = localizedTitle('الدعم والبلاغات — إدارة TechMood', 'Support & reports — TechMood admin');

const FILTERS = [
  { key: 'all',       label: { ar: 'الكل', en: 'All' } },
  { key: 'open',      label: { ar: 'مفتوحة', en: 'Open' } },
  { key: 'pending',   label: { ar: 'بانتظار صاحبها', en: 'Pending' } },
  { key: 'escalated', label: { ar: 'مُصعّدة', en: 'Escalated' } },
  { key: 'assistant', label: { ar: 'مع المساعد', en: 'With the assistant' } },
  { key: 'resolved',  label: { ar: 'محلولة', en: 'Resolved' } },
] as const;

/**
 * Support & Reports: every ticket, urgent first. The AI column is filled only
 * when an admin asked AI Assist to read the ticket — it suggests, the admin
 * decides.
 */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: raw } = await searchParams;
  const filter = FILTERS.some((item) => item.key === raw) ? raw! : 'open';
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: tickets }, { data: cases }] = await Promise.all([
    supabase.rpc('admin_tickets', { p_filter: filter }),
    supabase.rpc('admin_cases', { p_filter: 'open' }),
  ]);
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium' });

  return (
    <>
      <section className="section-block row-between">
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{t('الدعم والبلاغات', 'Support & reports')}</h2>
          <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
            {t('الأولوية يحددها النظام، والتصعيد بقواعد مكتوبة. الذكاء الاصطناعي يقترح والإدارة تقرر.',
               'The system sets priority and escalates by written rules. AI suggests; the administration decides.')}
          </p>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/admin/cases">{t(`القضايا المفتوحة (${cases?.length ?? 0})`, `Open cases (${cases?.length ?? 0})`)}</Link>
      </section>

      <div className="tags-row section-block">
        {FILTERS.map((item) => (
          <Link key={item.key} className={`chip${item.key === filter ? ' is-active' : ''}`} href={`/admin/support?filter=${item.key}`}>
            {t(item.label)}
          </Link>
        ))}
      </div>

      {(tickets ?? []).length === 0 ? (
        <p className="notice">{t('لا بلاغات هنا.', 'No tickets here.')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t('البلاغ', 'Ticket')}</th>
              <th>{t('النوع', 'Type')}</th>
              <th>{t('الأولوية', 'Priority')}</th>
              <th>AI</th>
              <th>{t('الحالة', 'Status')}</th>
              <th>{t('تحديث', 'Updated')}</th>
            </tr>
          </thead>
          <tbody>
            {tickets!.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link href={`/admin/support/${ticket.id}`}><span className="eng">#{ticket.code}</span></Link>
                  <div style={{ fontSize: '0.82rem' }}>{ticket.subject_ar}</div>
                  <div className="muted" style={{ fontSize: '0.76rem' }}>
                    {ticket.reporter_name} <span className="eng">{ticket.reporter_techmood_id}</span>
                    {ticket.reported_name && <> → {ticket.reported_name}</>}
                  </div>
                </td>
                <td>
                  {t(TICKET_CATEGORY[ticket.category])}
                  {ticket.escalation_reason && ESCALATION[ticket.escalation_reason] && (
                    <div className="muted" style={{ fontSize: '0.74rem' }}>{t(ESCALATION[ticket.escalation_reason])}</div>
                  )}
                </td>
                <td><span className={`status-pill ${TICKET_PRIORITY[ticket.priority].className}`}>{t(TICKET_PRIORITY[ticket.priority].label)}</span></td>
                <td className="eng" style={{ fontSize: '0.8rem' }}>
                  {ticket.ai_confidence !== null ? `${ticket.ai_confidence}%` : '—'}
                  {ticket.ai_category && <div className="muted">{t(TICKET_CATEGORY[ticket.ai_category])}</div>}
                </td>
                <td><span className={`status-pill ${TICKET_STATUS[ticket.status].className}`}>{t(TICKET_STATUS[ticket.status].label)}</span></td>
                <td className="muted" style={{ fontSize: '0.8rem' }}>{date.format(new Date(ticket.updated_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
