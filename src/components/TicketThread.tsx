import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_EVENT } from '@/lib/support';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

/**
 * A ticket's timeline and conversation, as whoever is reading may see them —
 * row level security decides whether internal notes are among them (0083).
 */
export async function TicketThread({ ticketId, viewer = 'reporter' }: { ticketId: string; viewer?: 'reporter' | 'admin' }) {
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

  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' });
  const who = (kind: string) =>
    kind === 'assistant' ? t('🤖 مساعد تكمود (رد آلي)', '🤖 TechMood assistant (automated)')
      : kind === 'admin' ? t('🛟 فريق الدعم', '🛟 Support team')
        : kind === 'system' ? t('النظام', 'System')
          : viewer === 'admin' ? t('👤 صاحب البلاغ', '👤 Reporter') : t('أنت', 'You');

  const mine = (kind: string) => (viewer === 'admin' ? kind === 'admin' : kind === 'user');

  return (
    <div className="tk-grid">
      <section className="hm-card tk-chat">
        <h3 className="tk-h">{t('المحادثة', 'Conversation')}</h3>
        <div className="tk-bubbles">
          {(messages ?? []).map((row) => (
            <article
              key={row.id}
              className={`tk-bubble is-${row.author_kind}${mine(row.author_kind) ? ' is-mine' : ''}${row.is_internal ? ' is-internal' : ''}`}
            >
              <strong className="tk-who">
                {who(row.author_kind)}
                {row.is_internal && <span className="tag" style={{ marginInlineStart: 6 }}>{t('داخلي', 'Internal')}</span>}
              </strong>
              <p>{row.body_ar}</p>
              {files.has(row.id) && (
                <a className="tk-file" href={files.get(row.id)} target="_blank" rel="noreferrer noopener">
                  📎 {t('المرفق', 'Attachment')}
                </a>
              )}
              <span className="tk-time date">{time.format(new Date(row.created_at))}</span>
            </article>
          ))}
        </div>
      </section>

      <aside className="hm-card tk-side">
        <h3 className="tk-h">{t('الخط الزمني', 'Timeline')}</h3>
        <ol className="tk-timeline">
          {(events ?? []).map((row) => (
            <li key={row.id}>
              <strong>{TICKET_EVENT[row.kind] ? t(TICKET_EVENT[row.kind]) : row.note_ar}</strong>
              {row.note_ar && TICKET_EVENT[row.kind] && row.note_ar !== TICKET_EVENT[row.kind].ar && (
                <span className="muted">{row.note_ar}</span>
              )}
              <span className="tk-time date">{time.format(new Date(row.created_at))}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
