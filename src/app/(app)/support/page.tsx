import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_CATEGORY, TICKET_STATUS } from '@/lib/support';

export const metadata = { title: 'Help & reports — TechMood' };

/**
 * Support Center: the person's own tickets, newest activity first.
 * A problem is not only a complaint — a payment question, a booking that did
 * not go through, a bug — so it is "Help & reports", not "Complaints".
 */
export default async function SupportCenterPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: tickets }, { data: articles }] = await Promise.all([
    supabase.rpc('my_tickets'),
    supabase.from('kb_articles').select('slug, title_ar, title_en').eq('status', 'published').order('sort_order').limit(12),
  ]);
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' });

  return (
    <>
      <section className="section-block row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{t('المساعدة والبلاغات', 'Help & reports')}</h2>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '64ch' }}>
            {t('أي مشكلة — دفع، حجز، منتور، مشروع، محتوى، سلوك غير مناسب، أو خلل تقني. يردّ عليك المساعد فوراً بما يعرفه عن عمليتك، ويحوّل ما يحتاج قراراً إلى فريق الدعم.',
               'Any problem — a payment, a booking, a mentor, a project, content, inappropriate behaviour or a bug. The assistant answers at once with what it knows about your operation, and sends anything that needs a decision to the support team.')}
          </p>
        </div>
        <Link className="btn btn-primary" href="/support/new">{t('بلّغ عن مشكلة / اطلب مساعدة', 'Report / get help')}</Link>
      </section>

      {(articles ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('أسئلة شائعة', 'Common questions')}</h3>
          <ul className="admin-mini-list">
            {articles!.map((article) => (
              <li key={article.slug}><Link href={`/support/help/${article.slug}`}>{t.locale === 'en' && article.title_en ? article.title_en : article.title_ar}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {(tickets ?? []).length === 0 ? (
        <p className="notice">{t('لا بلاغات لديك.', 'You have no tickets.')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t('البلاغ', 'Ticket')}</th>
              <th>{t('النوع', 'Type')}</th>
              <th>{t('الحالة', 'Status')}</th>
              <th>{t('آخر تحديث', 'Updated')}</th>
            </tr>
          </thead>
          <tbody>
            {tickets!.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link href={`/support/${ticket.id}`}><span className="eng">#{ticket.code}</span></Link>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{ticket.subject_ar}</div>
                </td>
                <td>{t(TICKET_CATEGORY[ticket.category])}</td>
                <td><span className={`status-pill ${TICKET_STATUS[ticket.status].className}`}>{t(TICKET_STATUS[ticket.status].label)}</span></td>
                <td className="muted">{date.format(new Date(ticket.updated_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
