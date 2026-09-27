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

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/support">{t('→ بلاغاتي', '← My tickets')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="kicker eng">#{ticket.code}</p>
            <h2 style={{ fontSize: '1.15rem', marginTop: 4 }}>{ticket.subject_ar}</h2>
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

      <TicketThread ticketId={ticket.id} />

      {closed ? (
        <p className="notice" style={{ marginTop: 16 }}>
          {t('أُغلق هذا البلاغ. إن استمرت المشكلة ', 'This ticket is closed. If the problem continues, ')}
          <Link href="/support/new">{t('افتح بلاغاً جديداً', 'open a new one')}</Link>.
        </p>
      ) : (
        <section className="panel section-block" style={{ marginTop: 16 }}>
          <SupportComposer action={replyToTicket} userId={user.id} submitLabel={t('أرسل', 'Send')} resetOnSuccess>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <div className="field">
              <label htmlFor="body">{t('رسالتك', 'Your message')}</label>
              <textarea id="body" name="body" rows={3} required maxLength={5000} />
            </div>
          </SupportComposer>
        </section>
      )}
    </>
  );
}
