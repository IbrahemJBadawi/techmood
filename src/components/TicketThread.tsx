import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_EVENT } from '@/lib/support';

/**
 * A ticket's timeline and conversation, as whoever is reading may see them —
 * row level security decides whether internal notes are among them (0083).
 */
export async function TicketThread({ ticketId }: { ticketId: string }) {
  const t = await getT();
  const supabase = await createClient();

  const [{ data: messages }, { data: events }] = await Promise.all([
    supabase.from('ticket_messages').select('id, author_kind, author_id, body_ar, attachment_path, is_internal, created_at')
      .eq('ticket_id', ticketId).order('created_at'),
    supabase.from('ticket_events').select('id, kind, note_ar, is_internal, created_at')
      .eq('ticket_id', ticketId).order('created_at'),
  ]);

  // Signed, short-lived links; the path itself is never a public URL.
  const files = new Map<string, string>();
  await Promise.all((messages ?? []).filter((row) => row.attachment_path).map(async (row) => {
    const { data } = await supabase.storage.from('support-files').createSignedUrl(row.attachment_path!, 600);
    if (data?.signedUrl) files.set(row.id, data.signedUrl);
  }));

  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' });
  const who = (kind: string) =>
    kind === 'assistant' ? t('🤖 مساعد تكمود (رد آلي)', '🤖 TechMood assistant (automated)')
      : kind === 'admin' ? t('🛟 فريق الدعم', '🛟 Support team')
        : kind === 'system' ? t('النظام', 'System')
          : t('أنت', 'You');

  return (
    <div className="detail-grid">
      <section className="panel">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('المحادثة', 'Conversation')}</h3>
        <div className="stack">
          {(messages ?? []).map((row) => (
            <article
              key={row.id}
              className={`ticket-line is-${row.author_kind}${row.is_internal ? ' is-internal' : ''}`}
            >
              <div className="row-between">
                <strong style={{ fontSize: '0.82rem' }}>
                  {who(row.author_kind)}
                  {row.is_internal && <span className="tag" style={{ marginInlineStart: 6 }}>{t('داخلي', 'Internal')}</span>}
                </strong>
                <span className="muted" style={{ fontSize: '0.74rem' }}>{time.format(new Date(row.created_at))}</span>
              </div>
              <p style={{ fontSize: '0.88rem', marginTop: 6, whiteSpace: 'pre-line' }}>{row.body_ar}</p>
              {files.has(row.id) && (
                <a className="badge-pill" href={files.get(row.id)} target="_blank" rel="noreferrer noopener" style={{ marginTop: 6 }}>
                  📎 {t('المرفق', 'Attachment')}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <aside className="panel">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('الخط الزمني', 'Timeline')}</h3>
        <ul className="finance-timeline">
          {(events ?? []).map((row) => (
            <li key={row.id}>
              <span className="finance-dot">•</span>
              <div>
                <strong style={{ fontSize: '0.84rem' }}>{TICKET_EVENT[row.kind] ? t(TICKET_EVENT[row.kind]) : row.note_ar}</strong>
                {row.note_ar && TICKET_EVENT[row.kind] && row.note_ar !== TICKET_EVENT[row.kind].ar && (
                  <div className="muted" style={{ fontSize: '0.78rem' }}>{row.note_ar}</div>
                )}
                <div className="muted" style={{ fontSize: '0.74rem' }}>{time.format(new Date(row.created_at))}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
