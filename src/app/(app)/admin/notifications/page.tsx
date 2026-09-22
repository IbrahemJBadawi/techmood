import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { NOTIFICATION_KIND, PRIORITY } from '@/lib/notifications';
import { roleLabel } from '@/lib/roles';

import { BroadcastForm } from './BroadcastForm';
import { deleteBroadcast, sendBroadcast } from './actions';

export const metadata = { title: 'Announcements — TechMood' };

/**
 * The platform's own voice, and what became of it.
 *
 * The log is the point: an announcement that was sent to two hundred people and
 * read by nine is a fact worth knowing before writing the next one.
 */
export default async function AdminNotificationsPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const [{ data: drafts }, { data: log }, { data: outbox }] = await Promise.all([
    supabase.from('notification_broadcasts')
      .select('id, kind, title_ar, body_ar, link, priority, audience_role, created_at')
      .is('sent_at', null)
      .order('created_at', { ascending: false }),
    supabase.rpc('broadcast_log'),
    supabase.from('email_outbox').select('status'),
  ]);

  const mail = { queued: 0, sent: 0, failed: 0 };
  for (const row of outbox ?? []) {
    if (row.status === 'sent') mail.sent += 1;
    else if (row.status === 'failed') mail.failed += 1;
    else mail.queued += 1;
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('الإعلانات', 'Announcements')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">{t('لوحة الإدارة', 'Admin panel')}</Link>
        </div>
      </section>

      <section className="stat-strip">
        <span className="stat-card">
          <span className="stat-value eng">{mail.queued}</span>
          <span className="stat-label">{t('بريد بانتظار الإرسال', 'Mail waiting')}</span>
        </span>
        <span className="stat-card">
          <span className="stat-value eng">{mail.sent}</span>
          <span className="stat-label">{t('بريد أُرسل', 'Mail sent')}</span>
        </span>
        <span className="stat-card">
          <span className="stat-value eng">{mail.failed}</span>
          <span className="stat-label">{t('بريد فشل', 'Mail failed')}</span>
        </span>
      </section>

      {mail.queued > 0 && (
        <p className="notice section-block">
          {t('البريد يُكتب في طابور داخل قاعدة البيانات مع الإشعار نفسه. إرساله يحتاج مُرسِلاً خارجياً (Edge Function مع مزوّد بريد) — وهو غير مُعدّ في هذا المستودع.',
             'Mail is queued in the database alongside the notification itself. Sending it needs an external sender (an edge function with a mail provider) — which this repository does not configure.')}
        </p>
      )}

      <BroadcastForm />

      {(drafts ?? []).length > 0 && (
        <section className="section-block">
          <h3 className="academy-heading">{t('مسودّات', 'Drafts')}</h3>
          <div className="stack">
            {(drafts ?? []).map((draft) => (
              <article className="panel session-row" key={draft.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-between" style={{ gap: 10 }}>
                    <strong style={{ fontSize: '0.95rem' }}>
                      {NOTIFICATION_KIND[draft.kind].icon} {draft.title_ar}
                    </strong>
                    <span className={`status-pill ${PRIORITY[draft.priority].className}`}>
                      {t(PRIORITY[draft.priority].label)}
                    </span>
                  </div>
                  {draft.body_ar && (
                    <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>{draft.body_ar}</p>
                  )}
                  <p className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                    {draft.audience_role ? t(roleLabel(draft.audience_role)) : t('كل المستخدمين', 'Everybody')}
                    {draft.link && ` · ${draft.link}`}
                  </p>
                </div>

                <div className="session-row-actions">
                  <form action={sendBroadcast}>
                    <input type="hidden" name="broadcast_id" value={draft.id} />
                    <button className="btn btn-primary btn-sm">{t('أرسل', 'Send')}</button>
                  </form>
                  <form action={deleteBroadcast}>
                    <input type="hidden" name="broadcast_id" value={draft.id} />
                    <button className="btn btn-ghost btn-sm">{t('احذف', 'Delete')}</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section-block">
        <h3 className="academy-heading">{t('السجل', 'The log')}</h3>
        {(log ?? []).filter((row) => row.sent_at).length === 0 ? (
          <p className="notice">{t('لم يُرسل إعلان بعد.', 'Nothing has been sent yet.')}</p>
        ) : (
          <table className="data booking-table">
            <thead>
              <tr>
                <th>{t('الإعلان', 'Announcement')}</th>
                <th>{t('لمن', 'To')}</th>
                <th>{t('وصل', 'Reached')}</th>
                <th>{t('قُرئ', 'Read')}</th>
                <th>{t('بريد', 'Mail')}</th>
                <th>{t('التاريخ', 'Sent')}</th>
              </tr>
            </thead>
            <tbody>
              {(log ?? []).filter((row) => row.sent_at).map((row) => (
                <tr key={row.id}>
                  <td data-label={t('الإعلان', 'Announcement')}>
                    {NOTIFICATION_KIND[row.kind].icon} {row.title_ar}
                  </td>
                  <td data-label={t('لمن', 'To')} className="muted">
                    {row.audience_role ? t(roleLabel(row.audience_role)) : t('الكل', 'Everybody')}
                  </td>
                  <td data-label={t('وصل', 'Reached')} className="eng">{row.recipients}</td>
                  <td data-label={t('قُرئ', 'Read')} className="eng">{row.read_count}</td>
                  <td data-label={t('بريد', 'Mail')} className="eng">
                    {row.emails_sent}/{row.emails}
                    {row.emails_failed > 0 && <span style={{ color: 'var(--danger)' }}> · {row.emails_failed}</span>}
                  </td>
                  <td data-label={t('التاريخ', 'Sent')} className="muted">
                    {row.sent_at ? formatDateTime(locale, row.sent_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
