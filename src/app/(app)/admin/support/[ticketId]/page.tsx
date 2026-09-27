import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { SupportComposer } from '@/components/SupportComposer';
import { TicketThread } from '@/components/TicketThread';
import { aiConfigured } from '@/lib/ai-claude';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { ESCALATION, TICKET_CATEGORY, TICKET_PRIORITY, TICKET_RELATED, TICKET_STATUS } from '@/lib/support';
import type { TicketStatus } from '@/lib/database.types';

import { replyToTicket } from '../../../support/actions';
import { assistTicket, openCaseFromTicket, setTicketStatus } from '../actions';

const NEXT_STATUS: TicketStatus[] = ['under_review', 'pending_user', 'resolved', 'rejected', 'closed'];

/** One ticket, from the administration's side: context, conversation, decision. */
export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket) notFound();

  const people = [ticket.reporter_id, ticket.reported_profile_id].filter(Boolean) as string[];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, techmood_id').in('id', people);
  const person = (id: string | null) => (profiles ?? []).find((row) => row.id === id);
  const reporter = person(ticket.reporter_id);
  const reported = person(ticket.reported_profile_id);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/admin/support">{t('→ الدعم والبلاغات', '← Support & reports')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p className="kicker eng">#{ticket.code}</p>
            <h2 style={{ fontSize: '1.15rem', marginTop: 4 }}>{ticket.subject_ar}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
              {t(TICKET_CATEGORY[ticket.category])}
              {ticket.related_type && <> · {t(TICKET_RELATED[ticket.related_type])} <span className="eng">{ticket.related_id?.slice(0, 8)}</span></>}
            </p>
            <p style={{ fontSize: '0.86rem', marginTop: 6 }}>
              {t('المُبلِّغ: ', 'Reporter: ')}
              <Link href={`/admin/users/${ticket.reporter_id}`}>{reporter?.full_name}</Link> <span className="id-chip">{reporter?.techmood_id}</span>
              {reported && (
                <>
                  {' · '}{t('بخصوص: ', 'About: ')}
                  <Link href={`/admin/users/${reported.id}`}>{reported.full_name}</Link> <span className="id-chip">{reported.techmood_id}</span>
                </>
              )}
            </p>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className={`status-pill ${TICKET_STATUS[ticket.status].className}`}>{t(TICKET_STATUS[ticket.status].label)}</span>
            <span className={`status-pill ${TICKET_PRIORITY[ticket.priority].className}`}>{t(TICKET_PRIORITY[ticket.priority].label)}</span>
            {ticket.escalation_reason && ESCALATION[ticket.escalation_reason] && (
              <span className="tag">Needs Human Review · {t(ESCALATION[ticket.escalation_reason])}</span>
            )}
          </div>
        </div>
      </section>

      <section className="panel section-block">
        <div className="row-between">
          <h3 style={{ fontSize: '0.98rem' }}>✨ AI Assist</h3>
          <ActionForm action={assistTicket} variant="ghost" submitLabel={t('اقرأ البلاغ بالذكاء الاصطناعي', 'Read the ticket with AI')}>
            <input type="hidden" name="ticket_id" value={ticket.id} />
          </ActionForm>
        </div>
        {!aiConfigured() && (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {t('غير موصول بمزوّد نموذج هنا — يعمل حين يُضبط ANTHROPIC_API_KEY.', 'No model provider is connected here — it works once ANTHROPIC_API_KEY is set.')}
          </p>
        )}
        {ticket.ai_summary_ar ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: '0.88rem', whiteSpace: 'pre-line' }}>{ticket.ai_summary_ar}</p>
            <p style={{ fontSize: '0.86rem', marginTop: 8 }}>
              <strong>{t('الخطوة المقترحة: ', 'Suggested next step: ')}</strong>{ticket.ai_suggested_action}
            </p>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              {ticket.ai_category && <>{t('التصنيف المقترح: ', 'Suggested category: ')}{t(TICKET_CATEGORY[ticket.ai_category])} · </>}
              {ticket.ai_confidence !== null && <>{t('الثقة: ', 'Confidence: ')}<span className="eng">{ticket.ai_confidence}%</span> · </>}
              {t('اقتراح — القرار لك.', 'A suggestion — the decision is yours.')}
            </p>
          </div>
        ) : null}
      </section>

      <TicketThread ticketId={ticket.id} viewer="admin" />

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('ردّ على صاحب البلاغ', 'Reply to the reporter')}</h3>
          <SupportComposer action={replyToTicket} userId={user.id} submitLabel={t('أرسل', 'Send')} resetOnSuccess>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <div className="field">
              <textarea name="body" rows={3} required maxLength={5000} aria-label={t('الرد', 'Reply')} />
            </div>
            <label className="switch-row"><input type="checkbox" name="internal" />{t('ملاحظة داخلية (لا يراها صاحب البلاغ)', 'Internal note (the reporter does not see it)')}</label>
          </SupportComposer>
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('القرار', 'Decision')}</h3>
          <ActionForm action={setTicketStatus} className="stack" submitLabel={t('طبّق', 'Apply')}>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <select name="status" defaultValue="under_review" aria-label={t('الحالة', 'Status')}>
              {NEXT_STATUS.map((status) => <option key={status} value={status}>{t(TICKET_STATUS[status].label)}</option>)}
            </select>
            <textarea name="note" rows={2} placeholder={t('ما يُكتب لصاحب البلاغ (مطلوب للحل والرفض وطلب المعلومات)', 'What the reporter reads (required to resolve, reject or ask)')} />
          </ActionForm>

          <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
            {ticket.case_id ? (
              <Link className="btn btn-primary btn-sm" href={`/admin/cases/${ticket.case_id}`}>{t('افتح القضية', 'Open the case')}</Link>
            ) : (
              <ActionForm action={openCaseFromTicket} className="stack" variant="ghost" submitLabel={t('حوّله إلى قضية', 'Open a case')}>
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <input name="title" required minLength={3} defaultValue={ticket.subject_ar} aria-label={t('عنوان القضية', 'Case title')} />
              </ActionForm>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
