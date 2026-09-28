import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SupportComposer } from '@/components/SupportComposer';
import { TicketThread } from '@/components/TicketThread';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { ESCALATION, TICKET_CATEGORY, TICKET_RELATED, TICKET_STATUS } from '@/lib/support';

import { replyToTicket } from '../actions';

/** One ticket, as a conversation with support. */
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS returns the ticket only to its reporter (and admins).
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, code, category, subject_ar, status, needs_human, escalation_reason, related_type, reporter_id')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket || ticket.reporter_id !== user.id) notFound();

  const closed = ['resolved', 'rejected', 'closed'].includes(ticket.status);
  const { data: articles } = await supabase.from('kb_articles').select('slug, title_ar')
    .eq('status', 'published').eq('category', ticket.category).order('sort_order').limit(3);

  return (
    <>
      <Link className="sp-back" href="/support">{t('→ المساعدة والبلاغات', '← Help & reports')}</Link>

      <section className="hm-card sp-ticket-head section-block">
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="sp-code"><bdi>#{ticket.code}</bdi></p>
            <h1>{ticket.subject_ar}</h1>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
              {t(TICKET_CATEGORY[ticket.category])}
              {ticket.related_type && <> · {t(TICKET_RELATED[ticket.related_type])}</>}
            </p>
          </div>
          <span className={`status-pill ${TICKET_STATUS[ticket.status].className}`}>{t(TICKET_STATUS[ticket.status].label)}</span>
        </div>
        {ticket.needs_human && !closed && (
          <p className="notice" style={{ marginTop: 12 }}>
            {t('يراجع فريق الدعم هذه الحالة بنفسه', 'The support team is handling this personally')}
            {ticket.escalation_reason && ESCALATION[ticket.escalation_reason] ? ` — ${t(ESCALATION[ticket.escalation_reason])}` : ''}.
          </p>
        )}
      </section>

      {(articles ?? []).length > 0 && !closed && (
        <p className="notice section-block">
          {t('قد تفيدك: ', 'This may help: ')}
          {articles!.map((article, index) => (
            <span key={article.slug}>{index > 0 && ' · '}<Link href={`/support/help/${article.slug}`}>{article.title_ar}</Link></span>
          ))}
        </p>
      )}

      <TicketThread ticketId={ticket.id} />

      {closed ? (
        <p className="notice tk-closed">
          {t('أُغلق هذا البلاغ. إن استمرت المشكلة ', 'This ticket is closed. If the problem continues, ')}
          <Link href="/support/new">{t('افتح بلاغاً جديداً', 'open a new one')}</Link>.
        </p>
      ) : (
        <section className="hm-card tk-compose">
          <SupportComposer action={replyToTicket} userId={user.id} submitLabel={t('أرسل', 'Send')} resetOnSuccess>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <div className="field">
              <label htmlFor="body" className="sr-only">{t('رسالتك', 'Your message')}</label>
              <textarea id="body" name="body" rows={3} required maxLength={5000} placeholder={t('اكتب ردّك…', 'Write your reply…')} />
            </div>
          </SupportComposer>
        </section>
      )}
    </>
  );
}
